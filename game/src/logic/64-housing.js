// ───────────────────────────── housing: a house of one's own ─────────────────────────────
// A sheet's `house` = { tier 0..3, style: { floor, wall }, furn: [{ id, uid, x, y, dir }], storage,
// rest, cozy } (tables: HOUSE_TIER, HOUSE_FLOOR, HOUSE_WALL, FURN, HOUSE_REST, HOUSE_TOWN in
// 10-tables.js). Tier 1 is bought at the 하우징 안내인 in town; the "내 집" door beside him leads
// into a private runtime map "house_<eid>" (the owner's entity id: a session's, never the account
// key) built from the sheet: the interior theme of public/iso_interior.js, back walls on row 0 and
// column 0, a cut-down front, the door in the middle of the front, every piece of furniture an
// object (a rug a floor char), turned by `fd`. The map is rebuilt whenever the owner changes
// anything and sent again to everyone inside.
//
// Runtime instances like the 차원 균열 (Phase 0: mapOfS / runtime / exportChar), in their own
// registry `S.homes` so the rift's cap and timers never see them. Who may be inside: the owner,
// and members of the owner's party while the owner is inside (they come in through the door when
// they have no house of their own, or with house_visit at the agent). When the owner leaves, the
// guests are walked out; an empty house closes. Saved inside, a character wakes at the door.
// Furniture is an item (type "furn") until placed; placed storage furniture adds up to the house
// storage (h_dep / h_wd / h_sort, owner only, next to a chest); beds and hearths give 안락한 휴식.

const HOUSE_PRE = "house_";
/** How long an empty house stays open (ms) before it closes. */
const HOME_EMPTY_MS = 2000;
const isHomeId = (id) => typeof id === "string" && id.startsWith(HOUSE_PRE);
const homeEmpty = () => ({ tier: 0, style: { floor: 0, wall: 0 }, furn: [], storage: [], rest: 0, cozy: 0 });
const homeAt = (S, id) => (S && S.homes && Object.hasOwn(S.homes, id) ? S.homes[id] : null);
const homeIdOf = (p) => HOUSE_PRE + p.eid;
/** The house `p` stands in, or null. */
const homeHere = (p) => (isHomeId(p.map) ? homeAt(p.S, p.map) : null);
/** Pieces standing up (rugs apart) and rugs, each against its own limit. */
const pieceCount = (H) => H.furn.filter((f) => !FURN[f.id].floor).length;
const rugCount = (H) => H.furn.length - pieceCount(H);
/** Storage furniture placed, and the slots it gives. */
const storeCount = (H) => H.furn.filter((f) => FURN[f.id].kind === "store").length;
const storeCap = (H) => H.furn.reduce((n, f) => n + (FURN[f.id].kind === "store" ? FURN[f.id].cap : 0), 0);
/** The room's door (front row, middle) and the tile inside it where everyone comes in. */
const homeDoorAt = (tier) => [HOUSE_TIER[tier].w >> 1, HOUSE_TIER[tier].h - 1];
const homeEntry = (tier) => [HOUSE_TIER[tier].w >> 1, HOUSE_TIER[tier].h - 2];
/** Inside the walls: the floor a piece can stand on. */
const inRoom = (tier, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1 && x <= HOUSE_TIER[tier].w - 2 && y <= HOUSE_TIER[tier].h - 2;
/** A wall piece backs onto the north wall (row 1) or the west wall (column 1): its turn follows. */
const wallDir = (x, y) => (y === 1 ? 0 : x === 1 ? 1 : 0);
/** Where someone coming out of a house stands in town (exportChar: a sheet saved inside wakes there). */
const homeExit = (id) => (isHomeId(id) ? { map: HOUSE_TOWN.map, x: HOUSE_TOWN.out[0] * T + 8, y: HOUSE_TOWN.out[1] * T + 10 } : null);
const playersIn = (S, id) => Object.keys(S.players).map((pid) => S.players[pid]).filter((o) => o.map === id);

/**
 * A sheet's house cleaned (migrate, v10): tier and styles clamped, furniture known and inside the
 * room, one object (and one rug) per tile, within the tier's limits, uids unique. Nothing is ever
 * lost: a piece that cannot stand goes into the storage as an item. `fix` is migrate's item cleaner.
 */
function houseClean(h, fix) {
  const o = isObj(h) ? h : {};
  const tier = clamp(o.tier | 0, 0, HOUSE_TIER.length - 1);
  const st = isObj(o.style) ? o.style : {};
  const out = {
    tier, style: { floor: clamp(st.floor | 0, 0, HOUSE_FLOOR.length - 1), wall: clamp(st.wall | 0, 0, HOUSE_WALL.length - 1) }, furn: [],
    storage: (Array.isArray(o.storage) ? o.storage : []).map(fix).filter(Boolean),
    rest: num(o.rest) ? Math.max(0, o.rest) : 0, cozy: num(o.cozy) ? Math.max(0, o.cozy) : 0,
  };
  const seen = new Set(), uids = new Set();
  const lim = tier ? HOUSE_TIER[tier] : null, entry = tier ? homeEntry(tier) : null;
  for (const f of Array.isArray(o.furn) ? o.furn : []) {
    if (!isObj(f) || typeof f.id !== "string" || !Object.hasOwn(FURN, f.id)) continue;
    const d = FURN[f.id], key = (d.floor ? "g" : "o") + f.x + "," + f.y;
    const fits = lim && inRoom(tier, f.x, f.y) && !seen.has(key) && (d.floor ? rugCount(out) < lim.rugs : pieceCount(out) < lim.furn) && (d.kind !== "store" || storeCount(out) < lim.store) &&
      (d.floor || ((!d.wall || f.x === 1 || f.y === 1) && !(f.x === entry[0] && f.y === entry[1])));
    if (!fits) { stackInto(out.storage, f.id, 1); continue; }
    seen.add(key);
    let uid = Number.isInteger(f.uid) && f.uid > 0 ? f.uid : 0;
    if (!uid || uids.has(uid)) uid = 0;
    out.furn.push({ id: f.id, uid, x: f.x, y: f.y, dir: d.wall ? wallDir(f.x, f.y) : clamp(f.dir | 0, 0, 3) });
    if (uid) uids.add(uid);
  }
  for (const f of out.furn) if (!f.uid) { let u = 1; while (uids.has(u)) u++; f.uid = u; uids.add(u); }
  // a layout that would wall someone off (never made by furn_place) keeps only its rugs
  if (tier && !allReach(tier, out.furn)) for (const f of out.furn.filter((g) => !FURN[g.id].floor)) { out.furn.splice(out.furn.indexOf(f), 1); stackInto(out.storage, f.id, 1); }
  return out;
}
/** The next free uid in a house. */
const nextUid = (H) => H.furn.reduce((m, f) => Math.max(m, f.uid), 0) + 1;

/** Whether every open floor tile of a room with this furniture can be walked to from the door. */
function allReach(tier, furn) {
  const { w, h } = HOUSE_TIER[tier], solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!inRoom(tier, x, y)) solid[y * w + x] = 1;
  for (const f of furn) if (!FURN[f.id].floor) solid[f.y * w + f.x] = 1;
  const [ex, ey] = homeEntry(tier);
  if (solid[ey * w + ex]) return false;
  const seen = new Uint8Array(w * h), st = [ey * w + ex];
  let n = 0;
  while (st.length) {
    const i = st.pop();
    if (seen[i] || solid[i]) continue;
    seen[i] = 1; n++;
    st.push(i + 1, i - 1, i + w, i - w);
  }
  let open = 0;
  for (let i = 0; i < w * h; i++) if (!solid[i]) open++;
  return n === open;
}

/**
 * The house of `ch` as a map (finalized: rows joined, solid, reach). The back walls carry windows
 * (and in the bigger houses a clock, a painting, a banner); the door is in the middle of the front.
 */
function homeMap(ch, id) {
  const H = ch.house, t = HOUSE_TIER[H.tier], W = t.w, Hh = t.h, floor = HOUSE_FLOOR[H.style.floor][0];
  const m = blank(id, `${ch.name}의 ${t.name}`, W, Hh, floor);
  m.theme = "interior"; m.style = HOUSE_WALL[H.style.wall][0]; m.hf = floor; m.bgm = "inn"; m.safe = true; m.home = 1;
  for (let x = 0; x < W; x++) { m.o[0][x] = "="; m.o[Hh - 1][x] = "_"; }
  for (let y = 1; y < Hh; y++) { m.o[y][W - 1] = "_"; if (y < Hh - 1) m.o[y][0] = "="; }
  // windows along the back walls, and a little more in the bigger houses
  for (let x = 3; x < W - 2; x += 4) m.o[0][x] = "+";
  for (let y = 3; y < Hh - 2; y += 4) m.o[y][0] = "+";
  if (H.tier >= 2) m.o[0][W - 3] = "@";
  if (H.tier >= 3) { m.o[0][5] = "~"; m.o[0][W - 6] = "!"; m.o[Hh - 4][0] = "~"; }
  const [dx, dy] = homeDoorAt(H.tier);
  m.o[dy][dx] = " "; m.g[dy][dx] = "e";
  m.entry = homeEntry(H.tier);
  m.portals.push({ x: dx, y: dy, to: HOUSE_TOWN.map, tx: HOUSE_TOWN.out[0], ty: HOUSE_TOWN.out[1], ok: 1, label: "넥서스 광장" });
  m.fd = {};
  for (const f of H.furn) {
    const d = FURN[f.id];
    if (d.floor) { m.g[f.y][f.x] = d.ch; continue; }
    m.o[f.y][f.x] = d.ch;
    m.fd[f.x + "," + f.y] = f.dir;
  }
  m.marks = [];
  finalize(m);
  buildCells(m);
  return m;
}

// ───────────────────────────── the instance ─────────────────────────────

/** The owner's house, opened (built and made live) if it is not yet. */
function homeOpen(S, owner) {
  if (!S.homes) S.homes = {};
  const id = homeIdOf(owner);
  if (!S.homes[id]) {
    S.homes[id] = { id, owner: owner.pid, map: homeMap(owner.ch, id), born: S.now, emptyAt: S.now };
    runtime(S, id);
  }
  return S.homes[id];
}
/** Build the house again from the owner's sheet (a piece placed, a style, a bigger house) and show it to everyone inside. */
function homeRebuild(S, home) {
  const owner = S.players[home.owner];
  if (!owner) return;
  const m = (home.map = homeMap(owner.ch, home.id));
  const old = S.maps[home.id];
  delete S.maps[home.id];
  const rt = runtime(S, home.id);
  rt.n = old ? old.n : 0;
  rt.who = true;
  for (const o of playersIn(S, home.id)) {
    if (!canStand(m, o.x, o.y)) { o.x = m.entry[0] * T + 8; o.y = m.entry[1] * T + 10; }
    o.sendMap = true; o.fix = true; o.dirty = true;
  }
}
/** Close a house: whoever is inside steps out into town; its live state is gone. */
function homeClose(S, id) {
  if (!homeAt(S, id)) return;
  for (const o of playersIn(S, id)) homeLeave(S, o);
  delete S.maps[id];
  delete S.homes[id];
}
function homeEnter(S, p, home) {
  const [ex, ey] = home.map.entry;
  changeMap(S, p, home.id, ex * T + 8, ey * T + 10);
  p.dirty = true;
  const owner = S.players[home.owner];
  toast(p, home.owner === p.pid ? "내 집에 들어왔습니다. [집 꾸미기]로 가구를 놓고 꾸밀 수 있어요." : `${owner ? owner.ch.name : "파티원"}님의 집에 놀러 왔습니다.`);
  S.maps[home.id].ev.push(["ho", p.eid, 5]);
}
function homeLeave(S, p) {
  const out = homeExit(p.map);
  if (!out) return;
  changeMap(S, p, out.map, out.x, out.y);
  p.dirty = true;
}
/** A party member's open house with its owner inside (that one by entity id, else the first). */
function partyHome(S, p, eid) {
  for (const o of members(S, p)) {
    if (o === p || (eid !== undefined && o.eid !== eid)) continue;
    const h = homeAt(S, homeIdOf(o));
    if (h && o.map === h.id) return h;
  }
  return null;
}
/** Each tick: guests whose host has gone (or who left the party) step out; an empty house closes. */
function homeTick(S, now) {
  if (!S.homes) return;
  for (const id of Object.keys(S.homes)) {
    const home = S.homes[id], owner = S.players[home.owner], ownerIn = !!owner && owner.map === id;
    for (const o of playersIn(S, id)) {
      if (o === owner || (ownerIn && o.party && o.party === owner.party)) continue;
      homeLeave(S, o);
      toast(o, ownerIn ? "파티를 떠나 집 밖으로 나왔습니다." : "집주인이 집을 비워 밖으로 나왔습니다.");
    }
    const rt = S.maps[id];
    if (rt && rt.n > 0) home.emptyAt = now;
    else if (now - home.emptyAt >= HOME_EMPTY_MS) homeClose(S, id);
  }
}
/**
 * The "내 집" door in town (called by mv): your own house, else the open house of a party member
 * who is in it; with neither, a word and a step back.
 */
function homeDoor(S, p) {
  if (p.map !== HOUSE_TOWN.map || !HOUSE_TOWN.door.some(([x, y]) => dist(p.x, p.y - 3, x * T + 8, y * T + 8) < 12)) return false;
  if (p.ch.house.tier > 0) { homeEnter(S, p, homeOpen(S, p)); return true; }
  const host = partyHome(S, p);
  if (host) { homeEnter(S, p, host); return true; }
  p.x = HOUSE_TOWN.out[0] * T + 8; p.y = HOUSE_TOWN.out[1] * T + 10; p.fix = true;
  if (S.now >= (p.homeMsgAt || 0)) { p.homeMsgAt = S.now + 3000; toast(p, "아직 내 집이 없습니다. 곁의 하우징 안내인에게서 집을 살 수 있어요."); }
  return true;
}

// ───────────────────────────── actions ─────────────────────────────

/** Why `id` cannot go on (x, y) of the house `home` (whose sheet is H), or null. */
function placeWhy(S, home, H, id, x, y) {
  const d = FURN[id], lim = HOUSE_TIER[H.tier];
  if (!inRoom(H.tier, x, y)) return "방 안의 바닥에만 놓을 수 있습니다";
  if (d.floor && rugCount(H) >= lim.rugs) return `${lim.name}에는 카펫을 ${lim.rugs}장까지 깔 수 있습니다 (집을 넓히면 더 깔 수 있어요)`;
  if (!d.floor && pieceCount(H) >= lim.furn) return `${lim.name}에는 가구를 ${lim.furn}개까지 놓을 수 있습니다 (집을 넓히면 더 놓을 수 있어요)`;
  if (d.kind === "store" && storeCount(H) >= lim.store) return `${lim.name}에는 보관 가구를 ${lim.store}개까지 놓을 수 있습니다`;
  if (H.furn.some((f) => f.x === x && f.y === y && !FURN[f.id].floor === !d.floor)) return d.floor ? "그 자리에는 이미 카펫이 깔려 있습니다" : "그 자리에는 이미 가구가 있습니다";
  if (d.floor) return null;
  if (d.wall && x !== 1 && y !== 1) return `${d.name}${pp(d.name, "은는")} 뒷벽에 붙여 놓아야 합니다`;
  const [ex, ey] = homeEntry(H.tier);
  if (x === ex && y === ey) return "문 앞은 비워 두어야 합니다";
  for (const o of playersIn(S, home.id)) {
    if (o.x + 4 >= x * T && o.x - 4 < x * T + T && o.y >= y * T && o.y - 5 < y * T + T) return "그 자리에 누군가 서 있습니다";
  }
  if (!allReach(H.tier, [...H.furn, { id, x, y }])) return "그 자리에 놓으면 길이 막힙니다. 다른 자리에 놓아 주세요";
  return null;
}
/** The placed piece `uid` of a sheet's house, or null. */
const furnOf = (H, uid) => (Number.isInteger(uid) ? H.furn.find((f) => f.uid === uid) || null : null);
/** The bed or hearth a rest asks for: by uid (the owner knows them), or by its tile (a guest sees only the room). */
const restOf = (H, a) => furnOf(H, a.u) || H.furn.find((f) => f.x === a.x && f.y === a.y && FURN[f.id].kind === "rest") || null;
/** Whether `p` stands close enough to a placed piece (a tile and a bit). */
const furnNear = (p, f) => dist(p.x, p.y - 4, f.x * T + 8, f.y * T + 8) <= 30;
const storeNear = (p, H) => H.furn.some((f) => FURN[f.id].kind === "store" && furnNear(p, f));
const nearAgent = (p) => npcNear(p, "house");

function homeValidate(S, p, a) {
  const ch = p.ch, H = ch.house, here = homeHere(p), own = !!here && here.owner === p.pid, now = S.now;
  if (p.dead) return bad("쓰러진 상태에서는 할 수 없습니다");
  const mine = () => (own ? null : bad("내 집 안에서만 할 수 있습니다"));
  switch (a.t) {
    case "house_buy": {
      if (!nearAgent(p)) return bad("하우징 안내인이 너무 멉니다");
      if (H.tier > 0) return bad("이미 집이 있습니다");
      if (ch.gold < HOUSE_TIER[1].price) return bad(`골드가 부족합니다 (${gStr(HOUSE_TIER[1].price)}G 필요)`);
      return OK;
    }
    case "house_upgrade": {
      if (!own && !nearAgent(p)) return bad("하우징 안내인 곁이나 내 집 안에서 할 수 있습니다");
      if (H.tier < 1) return bad("먼저 집을 마련해야 합니다");
      if (H.tier >= HOUSE_TIER.length - 1) return bad("이미 가장 큰 집입니다");
      const price = HOUSE_TIER[H.tier + 1].price;
      if (ch.gold < price) return bad(`골드가 부족합니다 (${gStr(price)}G 필요)`);
      return OK;
    }
    case "house_style": {
      const no = mine(); if (no) return no;
      const okF = a.floor === undefined || (Number.isInteger(a.floor) && a.floor >= 0 && a.floor < HOUSE_FLOOR.length);
      const okW = a.wall === undefined || (Number.isInteger(a.wall) && a.wall >= 0 && a.wall < HOUSE_WALL.length);
      if (!okF || !okW || (a.floor === undefined && a.wall === undefined)) return bad("잘못된 꾸밈입니다");
      if ((a.floor ?? H.style.floor) === H.style.floor && (a.wall ?? H.style.wall) === H.style.wall) return bad("이미 그 모습입니다");
      return OK;
    }
    case "furn_buy": {
      if (!nearAgent(p)) return bad("하우징 안내인이 너무 멉니다");
      if (typeof a.id !== "string" || !Object.hasOwn(FURN, a.id)) return bad("팔지 않는 가구입니다");
      const n = a.n | 0;
      if (n < 1 || n > 20) return bad("잘못된 수량");
      if (ch.gold < FURN[a.id].price * n) return bad("골드가 부족합니다");
      if (!canAdd(ch, a.id, n)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "furn_place": {
      const no = mine(); if (no) return no;
      if (typeof a.id !== "string" || !Object.hasOwn(FURN, a.id)) return bad("가구가 아닙니다");
      if (countItem(ch, a.id) < 1) return bad("가방에 그 가구가 없습니다");
      if (a.d !== undefined && !(Number.isInteger(a.d) && a.d >= 0 && a.d <= 3)) return bad("잘못된 방향");
      const why = placeWhy(S, here, H, a.id, a.x, a.y);
      return why ? bad(why) : OK;
    }
    case "furn_rot": {
      const no = mine(); if (no) return no;
      const f = furnOf(H, a.u);
      if (!f) return bad("그 가구가 없습니다");
      if (FURN[f.id].floor) return bad("카펫은 돌릴 수 없습니다");
      if (FURN[f.id].wall) return bad("벽에 붙은 가구는 돌릴 수 없습니다");
      return OK;
    }
    case "furn_pick": {
      const no = mine(); if (no) return no;
      const f = furnOf(H, a.u);
      if (!f) return bad("그 가구가 없습니다");
      if (!canAdd(ch, f.id, 1)) return bad("가방이 가득 찼습니다");
      if (FURN[f.id].kind === "store" && storeCap(H) - FURN[f.id].cap < H.storage.length) return bad("보관함에 든 물건이 너무 많아 치울 수 없습니다. 먼저 꺼내 주세요");
      return OK;
    }
    case "h_dep": case "h_wd": {
      const no = mine(); if (no) return no;
      if (!storeNear(p, H)) return bad("보관함 곁에서만 쓸 수 있습니다");
      const from = a.t === "h_dep" ? ch.inv : H.storage;
      const sl = Number.isInteger(a.s) ? from[a.s] : null;
      if (!sl) return bad("아이템이 없습니다");
      const n = isGear(sl.id) ? 1 : a.n | 0;
      if (n < 1 || n > (sl.n || 1)) return bad("잘못된 수량");
      if (a.t === "h_dep") return roomIn(H.storage, storeCap(H), sl.id, n) ? OK : bad("집 보관함이 가득 찼습니다");
      return roomIn(ch.inv, bagCap(ch), sl.id, n) ? OK : bad("가방이 가득 찼습니다");
    }
    case "h_sort": {
      const no = mine(); if (no) return no;
      if (!storeNear(p, H)) return bad("보관함 곁에서만 쓸 수 있습니다");
      return H.storage.length > 1 ? OK : bad("정리할 것이 없습니다");
    }
    case "h_rest": {
      if (!here) return bad("집 안에서만 쉴 수 있습니다");
      const host = S.players[here.owner];
      const f = host ? restOf(host.ch.house, a) : null;
      if (!f || FURN[f.id].kind !== "rest") return bad("쉴 수 있는 가구가 아닙니다");
      if (!furnNear(p, f)) return bad("조금 더 가까이 가야 합니다");
      if (H.rest > now) return bad(`${Math.ceil((H.rest - now) / 60000)}분 뒤에 다시 쉴 수 있습니다`);
      return OK;
    }
    case "house_visit": {
      if (p.map !== HOUSE_TOWN.map || !(nearAgent(p) || HOUSE_TOWN.door.some(([x, y]) => dist(p.x, p.y, x * T + 8, y * T + 8) < 56))) return bad("'내 집' 문 앞이나 하우징 안내인 곁에서 갈 수 있습니다");
      if (!p.party) return bad("파티원의 집에만 놀러 갈 수 있습니다");
      return partyHome(S, p, a.o) ? OK : bad("그 파티원이 지금 집에 있지 않습니다");
    }
    case "house_leave": return here ? OK : bad("집 안이 아닙니다");
    default: return bad("알 수 없는 행동입니다");
  }
}

function homeApply(S, p, a) {
  const ch = p.ch, H = ch.house, here = homeHere(p), rt = S.maps[p.map], now = S.now;
  switch (a.t) {
    case "house_buy": {
      ch.gold -= HOUSE_TIER[1].price;
      H.tier = 1;
      // a housewarming: a bed against the back wall and a wooden chest in the far corner
      const t = HOUSE_TIER[1];
      H.furn = [{ id: "fn_bed", uid: 1, x: 2, y: 1, dir: 0 }, { id: "fn_chest_wood", uid: 2, x: t.w - 2, y: 1, dir: 0 }, { id: "fn_plant", uid: 3, x: 1, y: 1, dir: 0 }];
      rt.ev.push(["u", p.eid, 2]);
      toast(p, `[${t.name}]${pp(t.name, "을를")} 마련했습니다! 곁의 '내 집' 문으로 들어가 보세요. 입주 선물: 포근한 침대, 나무 보관함, 화분`);
      sys(S, `${ch.name}님이 넥서스 광장에 집을 마련했습니다!`);
      break;
    }
    case "house_upgrade": {
      const t = HOUSE_TIER[H.tier + 1];
      ch.gold -= t.price;
      H.tier++;
      if (here && here.owner === p.pid) homeRebuild(S, here);
      else { const h = homeAt(S, homeIdOf(p)); if (h) homeRebuild(S, h); }
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `집을 [${t.name}]으로 넓혔습니다! 가구를 ${t.furn}개, 카펫을 ${t.rugs}장, 보관 가구를 ${t.store}개까지 놓을 수 있습니다.`);
      break;
    }
    case "house_style": {
      if (a.floor !== undefined) H.style.floor = a.floor;
      if (a.wall !== undefined) H.style.wall = a.wall;
      homeRebuild(S, here);
      S.maps[here.id].ev.push(["ho", p.eid, 4]);
      break;
    }
    case "furn_buy": {
      const n = a.n | 0;
      ch.gold -= FURN[a.id].price * n;
      addItem(ch, a.id, n);
      p.gain.push(["item", a.id, n, 0]);
      break;
    }
    case "furn_place": {
      const d = FURN[a.id];
      takeItem(ch, a.id, 1);
      H.furn.push({ id: a.id, uid: nextUid(H), x: a.x, y: a.y, dir: d.wall ? wallDir(a.x, a.y) : (a.d | 0) & 3 });
      homeRebuild(S, here);
      S.maps[here.id].ev.push(["ho", p.eid, 0, a.x * T + 8, a.y * T + 8]);
      break;
    }
    case "furn_rot": {
      const f = furnOf(H, a.u);
      f.dir = (f.dir + 1) & 3;
      homeRebuild(S, here);
      S.maps[here.id].ev.push(["ho", p.eid, 2, f.x * T + 8, f.y * T + 8]);
      break;
    }
    case "furn_pick": {
      const f = furnOf(H, a.u);
      H.furn.splice(H.furn.indexOf(f), 1);
      addItem(ch, f.id, 1);
      homeRebuild(S, here);
      S.maps[here.id].ev.push(["ho", p.eid, 1, f.x * T + 8, f.y * T + 8]);
      break;
    }
    case "h_dep": {
      const sl = ch.inv[a.s];
      if (isGear(sl.id)) { ch.inv.splice(a.s, 1); H.storage.push(sl); }
      else {
        const n = a.n | 0;
        stackInto(H.storage, sl.id, n);
        sl.n -= n;
        if (sl.n <= 0) ch.inv.splice(a.s, 1);
      }
      petCheck(S, p);
      rt.ev.push(["ho", p.eid, 3]);
      break;
    }
    case "h_wd": {
      const sl = H.storage[a.s];
      if (isGear(sl.id)) { H.storage.splice(a.s, 1); ch.inv.push(sl); }
      else {
        const n = a.n | 0;
        addItem(ch, sl.id, n);
        sl.n -= n;
        if (sl.n <= 0) H.storage.splice(a.s, 1);
      }
      rt.ev.push(["ho", p.eid, 3]);
      break;
    }
    case "h_sort": H.storage = sortSlots(H.storage); break;
    case "h_rest": {
      const st = stats(p), host = S.players[here.owner], f = restOf(host.ch.house, a);
      p.hp = Math.min(st.mhp, p.hp + Math.round(st.mhp * HOUSE_REST.hp));
      p.mp = Math.min(st.mmp, p.mp + Math.round(st.mmp * HOUSE_REST.mp));
      H.cozy = now + HOUSE_REST.ms;
      H.rest = now + HOUSE_REST.cd;
      rt.ev.push(["ho", p.eid, 6, f.x * T + 8, f.y * T + 8]);
      toast(p, `[안락한 휴식] ${FURN[f.id].name}에서 푹 쉬었습니다. HP·MP 회복, ${HOUSE_REST.ms / 60000}분간 경험치 +${HOUSE_REST.xp}%.`);
      break;
    }
    case "house_visit": homeEnter(S, p, partyHome(S, p, a.o)); break;
    case "house_leave": homeLeave(S, p); break;
  }
  p.dirty = true;
  saveSoon(p);
}

// ───────────────────────────── wire ─────────────────────────────

/**
 * The sheet's house as its owner sees it (self.house): [tier, floor, wall, storage cap, storage
 * used, rest cooldown ms, where (0 out · 1 at home · 2 a guest), furniture [[uid, id, x, y, dir]…]
 * and the storage slots (both only at home, else 0)].
 */
function homeSelf(p) {
  const H = p.ch.house, here = homeHere(p), at = here ? (here.owner === p.pid ? 1 : 2) : 0, now = p.S.now;
  return [H.tier, H.style.floor, H.style.wall, storeCap(H), H.storage.length, Math.max(0, H.rest - now), at,
    at === 1 ? H.furn.map((f) => [f.uid, f.id, f.x, f.y, f.dir]) : 0, at === 1 ? H.storage : 0];
}
/**
 * The map payload's housing extras: a house's turns (fd, "x,y" → 0 N · 1 W · 2 S · 3 E), its floor
 * under the rugs (hf) and the rest pieces anyone inside may use (rest [[uid, x, y]…]); in town, the
 * "내 집" door (two door tiles, drawn and labelled like any house door).
 */
function homeWire(m, out) {
  if (m.home) {
    out.fd = m.fd; out.hf = m.hf; out.home = 1;
  }
  if (m.id === HOUSE_TOWN.map) for (const [x, y] of HOUSE_TOWN.door) out.portals.push({ x, y, to: "내 집", door: 1, home: 1 });
  return out;
}
/** What the browser needs to draw and price everything (defs().house). */
function homeDefs() {
  return {
    tiers: HOUSE_TIER.map((t) => (t ? { name: t.name, w: t.w, h: t.h, price: t.price, furn: t.furn, rugs: t.rugs, store: t.store } : null)),
    floors: HOUSE_FLOOR, walls: HOUSE_WALL, shop: FURN_SHOP, rest: HOUSE_REST, door: HOUSE_TOWN.door,
    furn: Object.fromEntries(Object.keys(FURN).map((id) => [id, { ch: FURN[id].ch, kind: FURN[id].kind, cap: FURN[id].cap || 0, floor: FURN[id].floor || 0, wall: FURN[id].wall || 0 }])),
  };
}
