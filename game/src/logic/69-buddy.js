// ── 짝꿍부르기: a saved contact and a room-local NPC, never an account or party member.

const BUDDY_COOLDOWN = 60 * 60000;
const BUDDY_NAMES = ["보리", "솔이", "두리", "단비", "포포", "모루", "여울", "라온", "콩이", "나루", "초리", "새봄", "밤톨", "하루", "별이"];
const BUDDY_JOBS = Object.keys(JOBS).filter((job) => JOBS[job].wk.length);
const BUDDY_LINES = {
  town: [
    "오늘 날씨 참 좋다. 벚꽃나무길에 가볼래?",
    "모험은 잠깐 쉬어도 돼. 오늘은 천천히 걸을까?",
    "길을 잊어버리면 지도를 열어봐. 가 본 곳은 이름부터 반갑더라.",
    "마을의 이동비석은 먼저 깨워 두면 다음에 편하게 올 수 있어.",
    "가방에 간식 넣어 뒀어? 물어보는 거야. 달라는 건 아니고… 조금만?",
    "나도 멋지게 걷고 싶은데, 신나면 꼬리부터 흔들려.",
  ],
  rain: ["빗소리 들려? 오늘은 발맞춰 걷기 좋겠다.", "비 오는 날엔 모닥불 생각이 나. 따뜻한 데서 조금 쉴까?"],
  night: ["조용하다. 발소리도 오늘은 살금살금 나는 것 같아.", "밤바람이 차네. 불빛 있는 데까지 같이 걷자."],
  blossom_trail: ["분홍 꽃잎이 유채꽃 위에 내려앉았어. 저기 잠깐 서 볼래?", "꽃잎 떨어지는 속도에 맞춰 걸으면 산책이 길어지는 기분이야.", "바람 불 때 봐! 길 전체가 분홍색으로 흔들려."],
  sunset_beach: ["파도 한 번만 더 보고 갈까? …아까도 그렇게 말했지?", "저 큰 모닥불 옆에 앉으면 바다 소리가 더 잘 들릴 것 같아.", "노을이 물 위에 길을 내 줬네. 저 끝에는 뭐가 있을까?"],
  field: ["낯선 사냥터에서는 몬스터를 한 마리씩 상대해 보자.", "잠깐 쉬고 싶으면 모닥불이나 이동비석 쪽으로 가자.", "체력이 줄면 물약부터 챙기자. 급할수록 발밑도 잘 보고!", "이 길은 처음이라 조금 떨려. 같이 가니까 괜찮아."],
  fight: ["네가 먼저 친 녀석은 나도 도울게!", "공격 예고가 보이면 잠깐 물러나자.", "숨 한번 고르고! 우리 발맞춰 싸우자.", "내 꼬리는 흔들려도 조준은 안 흔들린다구."],
  apt: ["쓰레기통이 차면 표시된 반납대로! 난 이쪽 바닥부터 살필게.", "마지막 하나까지 모아보자. 바닥이 점점 깨끗해지는 게 좋다."],
  diner: ["손님 말풍선에 주문이 있어. 난 빈그릇도 챙길게.", "음식은 맞는 테이블로, 빈그릇은 싱크대로! 같이 하니까 바쁜 것도 재밌다."],
  forge: ["네가 주괴를 올려 줘. 모루 옆에서 둘이 스페이스 박자를 맞추자!", "박자가 엇나가도 다음 박자가 와. 하나, 둘, 같이!"],
  alch: ["풀무로 온도를 맞춰 줘. 나는 약초를 골라서 솥과 진열대를 맡을게.", "솥이 끓어넘치면 내가 식힐게. 풀무 박자를 부탁해!"],
  lib: ["빌릴 책은 장르 책장에서, 반납할 책도 같은 장르에 꽂아 줘.", "안내데스크 쪽을 봐 줘. 저쪽 책장은 내가 한번 살펴볼게."],
};

function buddyClean(value) {
  if (!value || !BUDDY_NAMES.includes(value.name) || !BUDDY_JOBS.includes(value.job)) return null;
  const kit = JOBS[value.job].wk;
  return {
    name: value.name, job: value.job, look: cleanLook(value.look),
    wk: kit.includes(value.wk) ? value.wk : kit[0],
    nextAt: Number.isSafeInteger(value.nextAt) ? Math.max(0, value.nextAt) : 0,
    active: value.active === true,
  };
}

function buddyValidate(S, p, a) {
  if (!["call", "leave", "new"].includes(a.k)) return bad("알 수 없는 짝꿍 요청이에요.");
  if (p.dead || inDim(p) || p.ab) return bad("현재 활동을 마치고 짝꿍에게 연락해 주세요.");
  if (p.buddyCall) return bad("짝꿍이 메시지를 확인하고 있어요.");
  const b = p.ch.buddy;
  if (a.k === "leave") return b?.active ? OK : bad("곁에 있는 짝꿍이 없어요.");
  if (typeof a.m !== "string" || !a.m.trim() || a.m.length > 60 || /[\x00-\x1f\x7f]/.test(a.m)) return bad("메시지를 1~60자로 써 주세요.");
  if (a.k === "call") return b?.active ? bad("짝꿍이 이미 곁에 있어요.") : OK;
  return b && S.now < b.nextAt ? bad("새 짝꿍에게 연락하기까지 아직 시간이 남았어요.") : OK;
}

function buddyApply(S, p, a) {
  if (a.k === "leave") {
    p.ch.buddy.active = false;
    buddyRemove(S, p);
  } else {
    if (!p.ch.buddy || a.k === "new") {
      buddyRemove(S, p);
      const job = BUDDY_JOBS[ri(S, 0, BUDDY_JOBS.length - 1)], kit = JOBS[job].wk;
      const names = BUDDY_NAMES.filter((name) => name !== p.ch.name && name !== p.ch.buddy?.name);
      const look = LOOK_MAX.map((max, slot) => ri(S, slot === 8 ? 1 : 0, max));
      p.ch.buddy = { name: names[ri(S, 0, names.length - 1)], job, wk: kit[ri(S, 0, kit.length - 1)], look, nextAt: S.now + BUDDY_COOLDOWN, active: true };
    }
    p.ch.buddy.active = true;
    p.buddyCall = { replyAt: S.now + 850, arriveAt: S.now + 1800 };
    p.buddyMail = [0, a.m.trim()];
  }
  p.dirty = true;
  saveSoon(p);
}

const buddyPid = (p) => "buddy:" + p.pid;
const buddyOf = (S, p) => S.buddies[buddyPid(p)];

function buddyRemove(S, p) {
  const b = buddyOf(S, p);
  if (!b) return;
  if (S.maps[b.map]) S.maps[b.map].who = true;
  delete S.buddies[b.pid];
}

function buddyPlace(S, b, map, x, y, exact = false) {
  if (S.maps[b.map]) S.maps[b.map].who = true;
  b.map = map;
  const m = mapOfS(S, map);
  const offsets = [[-2 * T, 0], [2 * T, 0], [0, T], [0, -T], [-T, 0], [T, 0]];
  const spot = exact ? [x, y] : offsets.map(([dx, dy]) => [x + dx, y + dy]).find(([sx, sy]) =>
    canStand(m, sx, sy) && canStand(m, (sx + x) / 2, (sy + y) / 2));
  [b.x, b.y] = spot || [x, y];
  b.route = []; b.goal = ""; b.routeAt = 0; b.target = null;
  S.maps[map].who = true;
}

function buddySpawn(S, p) {
  const ch = p.ch.buddy;
  const b = { pid: buddyPid(p), eid: S.nextId++, ch: { ...ch, lvl: p.ch.lvl }, dir: p.dir, toast: [],
    lineAt: S.now + 22000, thinkAt: 0, atkAt: 0, hp: 1, owner: p.pid };
  S.buddies[b.pid] = b;
  buddyPlace(S, b, p.map, p.x, p.y);
  return b;
}

function buddySelf(p) {
  const b = p.ch.buddy;
  return b ? [b.name, b.job, p.ch.lvl, b.active ? 1 : 0, Math.max(0, b.nextAt - p.S.now), p.buddyCall ? 1 : 0] : null;
}

function buddyView(p, out) {
  if (p.buddyMail) { out.bm = p.buddyMail; p.buddyMail = null; }
  if (p.buddySay) { out.bs = p.buddySay; p.buddySay = null; }
}

// Search from the current tile only when the goal changes or a route needs refreshing.
// Walk all intermediate tiles, including in cluttered shift maps.
function buddyRoute(m, b, tx, ty, radius, accept) {
  const start = Math.floor(b.y / T) * m.w + Math.floor(b.x / T);
  const q = [start], prev = new Map([[start, -1]]);
  let end = -1, best = Infinity;
  for (let i = 0; i < q.length && i < 2304; i++) {
    const at = q[i], x = at % m.w, y = (at / m.w) | 0;
    const [px, py] = tilePx([x, y]), d = dist(px, py, tx, ty);
    if (d <= radius && accept(px, py)) { end = at; break; }
    if (d < best) { best = d; end = at; }
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const n = ny * m.w + nx;
      if (prev.has(n) || !canStand(m, ...tilePx([nx, ny]))) continue;
      prev.set(n, at); q.push(n);
    }
  }
  const path = [];
  for (let at = end; at !== start && at >= 0; at = prev.get(at)) path.push(tilePx([at % m.w, (at / m.w) | 0]));
  const center = tilePx([start % m.w, (start / m.w) | 0]);
  if (dist(b.x, b.y, ...center) > 1 && canStand(m, ...center)) path.push(center);
  return path.reverse();
}

function buddyWalk(S, b, x, y, radius, dt, accept = () => true, key = "") {
  if (dist(b.x, b.y, x, y) <= radius && accept(b.x, b.y)) { b.route = []; b.goal = ""; return true; }
  const m = mapOfS(S, b.map);
  const goal = [Math.floor(x / T), Math.floor(y / T), key].join();
  if (S.now >= b.routeAt && (goal !== b.goal || !b.route.length)) {
    b.goal = goal;
    b.routeAt = S.now + 450;
    b.route = buddyRoute(m, b, x, y, radius, accept);
  }
  const next = b.route[0];
  if (!next) return false;
  const [nx, ny] = next, dx = nx - b.x, dy = ny - b.y, left = Math.hypot(dx, dy);
  if (left < 0.01) { b.route.shift(); return false; }
  const speed = inDim(b) ? 143 : 113;
  const step = Math.min(left, dt * speed);
  const px = b.x + dx * step / left, py = b.y + dy * step / left;
  if (!canStand(m, px, py)) { b.route = []; return false; }
  b.dir = dirOf(dx, dy);
  b.x = px; b.y = py;
  if (step === left) b.route.shift();
  return false;
}

/** Credit a bounded assist to an already engaged owner through the regular kill/reward path. */
function buddyEngage(S, p, mob) {
  const b = buddyOf(S, p);
  if (b?.map === p.map && !MOBS[mob.k].chest) {
    b.target = mob;
    b.targetAt = S.now + 5500;
  }
}

function buddyFight(S, p, b, dt) {
  const mob = b.target, rt = S.maps[b.map];
  if (!mob || mob.dead || mob.dive || S.now > b.targetAt || dist(p.x, p.y, mob.x, mob.y) > 175) return false;
  const w = WKIND[b.ch.wk], reach = w.shot ? Math.min(98, w.range) : w.range;
  const line = (x, y) => {
    const m = mapOfS(S, b.map), n = Math.ceil(dist(x, y, mob.x, mob.y) / 8);
    for (let i = 1; i < n; i++) if (solidAt(m, x + (mob.x - x) * i / n, y + (mob.y - y) * i / n)) return false;
    return true;
  };
  if (!buddyWalk(S, b, mob.x, mob.y, reach - 3, dt, line, "hunt") || S.now < b.atkAt) return true;
  face(b, mob);
  b.atkAt = S.now + Math.round(w.cd * 1.45);
  rt.ev.push(["a", b.eid, w.fx, Math.round(mob.x), Math.round(mob.y - 6), b.dir, 0]);
  const st = stats(p), type = WEAPON_ELEMENT[b.ch.wk] || "physical";
  const base = Math.max(1, Math.min(5 + b.ch.lvl * 1.1, st.atk * 0.34) * (w.mult || 1));
  const defence = MOBS[mob.k].def * (w.mag ? SFX.magDef : SFX.physDef);
  const damage = Math.max(1, Math.round((base - defence) * elementResist(S, mob, type, 0)));
  dealMob(S, rt, mob, p, damage, false, 0, [[type, damage]], true);
  return true;
}

function buddyTick(S, dt) {
  for (const p of Object.values(S.players)) {
    if (!p.ch.buddy?.active) continue;
    if (p.buddyCall) {
      const call = p.buddyCall;
      if (call.replyAt && S.now >= call.replyAt) {
        p.buddyMail = [1, "지금 바로 갈게!"]; call.replyAt = 0;
        continue;
      }
      if (S.now < call.arriveAt) continue;
      p.buddyCall = null; p.dirty = true;
    }
    const dim = S.dims[p.map], b = buddyOf(S, p) || buddySpawn(S, p);
    if (b.map !== p.map) buddyPlace(S, b, p.map, p.x, p.y);
    if (b.ch.lvl !== p.ch.lvl) { b.ch.lvl = p.ch.lvl; S.maps[p.map].who = true; }
    if (p.dead) { b.target = null; continue; }
    const m = mapOfS(S, p.map), c = dim?.coop;
    let fighting = false;
    if (c?.pl[b.pid]) {
      if (c.state === "run" || c.state === "fever") buddyJob(S, p, b, c, dt);
    } else if (!dim && !m.safe && (fighting = buddyFight(S, p, b, dt))) {
      // The NPC is already moving into attack range or fighting from there.
    } else if (dist(p.x, p.y, b.x, b.y) > 750) {
      buddyPlace(S, b, p.map, p.x, p.y);
    } else buddyWalk(S, b, p.x, p.y, 31, dt);
    b.toast.length = 0;
    if (S.now < b.lineAt) continue;
    const group = c?.k || (m.safe ? (BUDDY_LINES[p.map] ? p.map : isNight(S.now) ? "night" : weatherAt(p.map, S.now) === WX.rain ? "rain" : "town") : fighting ? "fight" : "field");
    const lines = BUDDY_LINES[group], choices = lines.filter((line) => line !== b.lastLine);
    b.lastLine = choices[ri(S, 0, choices.length - 1)];
    b.lineAt = S.now + ri(S, 35000, 55000);
    p.buddySay = [b.eid, b.lastLine];
  }
}

/** Travel to the named fixture and press the same F / rhythm action a human uses. */
function buddyJob(S, p, b, c, dt) {
  const q = c.pl[b.pid], teammate = c.pl[p.pid];
  if (!teammate || S.now - (teammate.workAt || c.runAt) >= 30000) return;
  const now = S.now, h = q.hold[0], st = COOP[c.k].st, action = { t: "coop_act" };
  const act = (details) => {
    Object.assign(action, details);
    if (coopValidate(S, b, action).ok) coopApply(S, b, action);
  };
  const at = (station, index = 0, details = {}, extra = () => true) => {
    const tile = Array.isArray(st[station][0]) ? st[station][index] : st[station];
    const [x, y] = tilePx(tile);
    const accepts = (px, py) => {
      const here = { x: px, y: py };
      return coopSt(c, here, station) === index && extra(here);
    };
    if (buddyWalk(S, b, x, y, COOP_T.station + 8, dt, accepts, station + index)) act(details);
  };

  if (c.k === "forge") {
    const a = forgeBound(c, b.pid);
    if (a) { if (now >= a.pair.noteAt && now <= a.pair.noteAt + COOP_FORGE.windowMs) act({ beat: 1 }); return; }
    const index = c.anvils.findIndex((anvil) => anvil.order && !anvil.pair && now < anvil.order.until);
    if (index >= 0) at("anvil", index);
    else buddyWalk(S, b, p.x, p.y, 30, dt);
    return;
  }
  if (c.k === "apt") {
    if (q.hold.length >= COOP_APT.binCap || (h && !c.ents.length)) { at("dump"); return; }
    const e = buddyNearest(b, c.ents, (trash) => dist(p.x, p.y, trash.x, trash.y) > 18) || buddyNearest(b, c.ents);
    if (e && buddyWalk(S, b, e.x, e.y, 6, dt)) act();
    return;
  }
  if (c.k === "diner") {
    const available = c.ents.filter((e) => e.t === 3 && e.seated && !e.eatAt && !e.goneAt && now < e.until);
    const tableClear = (spot) => coopSt(c, spot, "stove") < 0 && (!h || coopSt(c, spot, "sink") < 0);
    if (h) {
      const guest = h.r === 3 ? null : available.find((e) => e.r === h.r);
      if (guest) at("tables", guest.ti, {}, tableClear);
      else at("sink");
      return;
    }
    const pot = c.ents.find((e) => e.t === 4 && e.cook === b.pid);
    if (pot && now >= pot.doneAt) { at("stove", pot.si); return; }
    const plate = buddyNearest(b, c.ents, (e) => e.t === 9);
    if (plate) { at("tables", plate.ti, {}, tableClear); return; }
    if (pot) return;
    const stove = st.stove.findIndex((_, i) => !c.ents.some((e) => e.t === 4 && e.si === i));
    const guest = available.find((e) => available.filter((g) => g.r === e.r).length >
      c.ents.filter((o) => o.t === 4 && o.r === e.r).length + Object.values(c.pl).filter((worker) => worker.hold[0]?.r === e.r).length);
    if (guest && stove >= 0) at("stove", stove, { i: stove, r: guest.r });
    return;
  }
  if (c.k === "lib") {
    const waiting = libWaiting(c, now);
    const desk = st.desk.reduce((best, tile, i) => Math.abs(tile[0] * T + 8 - b.x) < Math.abs(st.desk[best][0] * T + 8 - b.x) ? i : best, 0);
    if (h?.kind === 0 && waiting.some((e) => e.id === h.id)) { at("desk", desk); return; }
    const guest = waiting.find((e) => e.kind === 0 && !e.worker);
    if (h || guest) { at("shelf", (h?.g ?? guest.g) * 6 + 2, {}, (spot) => coopSt(c, spot, "desk") < 0); return; }
    if (c.returns.length || waiting.some((e) => e.kind === 1)) at("desk", desk);
    return;
  }
  if (c.k === "alch") {
    // Keep complementary roles even if the human swaps tools at the rack.
    const tool = teammate.tool === "bellows" ? "fan" : "bellows";
    if (q.tool !== tool && !h) { at("rack"); return; }
    const e = c.pot, clear = (spot) => coopSt(c, spot, "rack") < 0;
    if (q.herb) { at("herbs", 0, { d: COOP_BREW.orders[q.herb.r].herbs[q.herb.i] }); return; }
    if (h?.st === "potion") { at("shelf", 2, {}, clear); return; }
    if (e.st === 2 || (e.st === 3 && q.tool === "fan") || (h && e.st === 0)) { at("pot", 0, {}, clear); return; }
    if (q.tool === "fan") {
      if (e.st === 1 && c.kiln.H > COOP_BREW.orders[e.pc.r].hi + 2) at("pot", 0, {}, clear);
      else if (e.st === 0 && !h) at("herbs", 0, {}, clear);
      return;
    }
    const need = e.pc && COOP_BREW.orders[e.pc.r];
    if (!q.bel) { at("kiln", 0, {}, (spot) => clear(spot) && coopSt(c, spot, "pot") < 0); return; }
    let i = Math.max(0, q.ln || 0);
    while (brewNote(c, i) < now - 100) i++;
    if (need && c.kiln.H <= need.lo + 2 && Math.abs(brewNote(c, i) - now) <= 100) act({ d: brewDir(i) });
  }
}

function buddyNearest(b, list, test = () => true) {
  let nearest = null, best = Infinity;
  for (const e of list) {
    const d = dist(b.x, b.y, e.x, e.y);
    if (d < best && test(e)) { best = d; nearest = e; }
  }
  return nearest;
}
