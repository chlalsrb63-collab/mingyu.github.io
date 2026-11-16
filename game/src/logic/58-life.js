// ───────────────────────────── life skills: the engine (docs/design/life-and-coop.md B) ─────────────────────────────
// Levels and experience (`gainLife`), the one bonus formula (`lifeOdds`/`lifeRoll`/`lifeTime`), grades of maps
// and levels, what a reeled fish and a cooked fish turn into (`fishLand`, `cookDish`, called from 75 reel/cook),
// the sheet's life fields cleaned (`lifeSheetClean`, called from migrate); L2: the pouch, gathering nodes
// (`lifeNodes`), crafting at the stations (`craftOnce`), the 알바 board and delivery (`jbOffers`, `jbRoute`), trust
// (`addRep`), the life actions (`lifeValidate`/`lifeApply`, `lifeUse*`), `lifeTick`; the wire (`lifeView`,
// `jbView`, `repView`, `lifeSnap`, `lifeDefs`). Tables live in 12-life-tables.js.

/** A fresh sheet's six skills. */
const lifeEmpty = () => Object.fromEntries(LIFE.map((k) => [k, { lv: 1, xp: 0 }]));
/** The highest grade a life level handles (1..5). */
function lifeGrade(L) {
  let g = 0;
  for (const lv of GRADE_LV) if (L >= lv) g++;
  return Math.max(1, g);
}
/** The grade of a map: its own `grade` (editor maps), else by the first tier of its level band; 1 without one. */
function gradeOfMap(m) {
  if (m && Number.isInteger(m.grade) && m.grade >= 1 && m.grade <= 5) return m.grade;
  if (m && Object.hasOwn(GRADE_MAP, m.id)) return GRADE_MAP[m.id];
  const band = m && (m.band || (m.id && Object.hasOwn(MAP_META, m.id) && MAP_META[m.id].band));
  if (!band) return 1;
  let g = 0;
  for (const t of GRADE_TIER) if (band[0] >= t) g++;
  return Math.max(1, g);
}
/** A map's grade by id without building a hunting ground (editor and town maps are built at load). */
const mapGradeOf = (id) => (MAP_META[id].eager ? gradeOfMap(mapOf(id)) : gradeOfMap({ id, band: MAP_META[id].band }));

const r1L = (v) => Math.round(v * 10) / 10;
/**
 * [success %, 대성공 %] at life level L for work unlocked at `unlockLv`, with a mini-game score `s` (50 = no
 * shift) and `extra` %p on the 대성공 (a timing tap). B.2: d = max(0, L − unlockLv).
 */
function lifeOdds(L, unlockLv, s = 50, extra = 0) {
  const d = Math.max(0, L - unlockLv), sh = (clamp(s, 0, 100) - 50) * LIFE_ROLL.score;
  const ok = Math.min(LIFE_ROLL.ok[2], LIFE_ROLL.ok[0] + LIFE_ROLL.ok[1] * d);
  const great = Math.min(LIFE_ROLL.great[2], LIFE_ROLL.great[0] + LIFE_ROLL.great[1] * d);
  return [r1L(clamp(ok + sh, 0, 100)), r1L(clamp(great + sh + extra, 0, 100))];
}
/** One roll of both: { ok, great } (a 대성공 is always a success). */
function lifeRoll(S, L, unlockLv, s = 50, extra = 0) {
  const [ok, great] = lifeOdds(L, unlockLv, s, extra);
  const g = rnd(S) * 100 < great;
  return { ok: g || rnd(S) * 100 < ok, great: g };
}
/** The time factor for channels, bite waits and minimum craft times: −0.8 % a level (×0.6 at 50). */
const lifeTime = (L) => 1 - LIFE_ROLL.time * clamp(L, 1, LIFE_MAX);
/** A life-buff food's effect `k` (P8, ITEMS[].buff.lf: gat bite great dlv lxp) while it lasts, else 0. */
const lifeBuff = (S, p, k) => (p.food && p.food.lf && p.food.until > S.now ? p.food.lf[k] | 0 : 0);
/** Gathering's 덤 chance (0..1) at level L (P7: grows LIFE_STEP.bonus %p a level). */
const gatBonus = (L) => NODE.bonus + (LIFE_STEP.bonus * (clamp(L, 1, LIFE_MAX) - 1)) / 100;
/** What level `lv` of skill `k` gave (P7, the level-up toast): the recipes first known at it, else the steady gains. */
function lifeStepText(k, lv) {
  const made = new Set();
  for (const id of Object.keys(RECIPES)) {
    const r = RECIPES[id];
    if (r.sk !== k || r.lv !== lv || r.any || r.sq) continue;
    made.add(r.gear ? `${ITEMS[r.out[0]].tier}단계 장비` : r.out[0] === "rune*" ? "룬 변환" : ITEMS[r.out[0]].name);
  }
  if (made.size) return `새 제작법: ${[...made].join(", ")}`;
  const t = Math.round((1 - lifeTime(lv)) * 100);
  if (k === "gather") return `채집 시간 -${t}% · 덤 ${r1L(gatBonus(lv) * 100)}%`;
  if (k === "fish") return `입질 대기 -${t}% · 놓치는 기준 ${r1L(FISHING.keep[0] - FISHING.keep[1] * lv)}점`;
  if (k === "deliver") return `꾸러미를 들고 걷는 속도 ${Math.round((JB_PAY.spd[0] + JB_PAY.spd[1] * lv) * 100)}%`;
  return `제작 시간 -${t}% · 대성공 확률 +1.2%p`;
}
/** Experience for work unlocked at `unlockLv`, stale work (20+ levels below) at a quarter; at least 1. */
const lifeXp = (L, unlockLv, base) => Math.max(1, Math.round(L - unlockLv >= LIFE_STALE_D ? base * LIFE_STALE : base));

/**
 * Add `n` experience to one skill's { lv, xp }, levelling up as often as it reaches; never past `cap`
 * (migration caps at 20). Returns the levels reached. Pure: `migrate` uses it on a sheet without a player.
 */
function lifeAdd(e, n, cap = LIFE_MAX) {
  const ups = [];
  if (e.lv >= LIFE_MAX) { e.xp = 0; return ups; }
  e.xp += Math.max(0, Math.floor(n));
  while (e.lv < cap && e.xp >= lifeNeed(e.lv)) { e.xp -= lifeNeed(e.lv); e.lv++; ups.push(e.lv); }
  e.xp = e.lv >= LIFE_MAX ? 0 : Math.min(e.xp, lifeNeed(e.lv) - 1);
  return ups;
}
/** A player gains life experience in skill `k`: each level reached is an event ["lv2", eid, skill index, lv] and a toast. */
function gainLife(S, p, k, n) {
  const i = LIFE.indexOf(k), e = p.ch.life[k];
  if (i < 0 || !e || !(n > 0)) return 0;
  const ups = lifeAdd(e, n * (1 + lifeBuff(S, p, "lxp") / 100));
  for (const lv of ups) {
    S.maps[p.map].ev.push(["lv2", p.eid, i, lv]);
    toast(p, lv >= LIFE_MAX ? `[${LIFE_NAME[i]}] 레벨 ${lv}! 명장의 경지에 올랐습니다.`
      : LIFE_UNLOCK[lv] ? `[${LIFE_NAME[i]}] 레벨 ${lv}! ${LIFE_UNLOCK[lv]} 재료를 다룰 수 있습니다.` : `[${LIFE_NAME[i]}] 레벨 ${lv}! ${lifeStepText(k, lv)}`);
  }
  // (Lv 10/30 in any skill and 50 in each are achievements with titles, 60-content.js ACH)
  if (ups.length) checkAch(S, p);
  p.dirty = true;
  return ups.length;
}

// ── fishing and cooking (B.5)

/** The fight score below which a fish gets away, at this angler's level (30 at 1, 15 at 50). */
const fishKeep = (ch) => FISHING.keep[0] - FISHING.keep[1] * ch.life.fish.lv;
/** How long until a bite (ms), before the weather. */
const fishWait = (S, ch, cut = 0) => (FISHING.wait[0] + rnd(S) * FISHING.wait[1]) * lifeTime(ch.life.fish.lv) * (1 - cut / 100);
/** Entries in a 물고기 도감 (species × sizes seen). */
const fbookN = (ch) => Object.values(ch.fbook || {}).reduce((n, e) => n + (e[1] & 1) + ((e[1] >> 1) & 1) + ((e[1] >> 2) & 1), 0);
/** A landed fish measured (P8) and written into the 물고기 도감; a new entry may reach a FISH_BOOK reward. */
function fishBook(S, p, id, k) {
  if (!Object.hasOwn(FISH_CM, id)) return;
  const ch = p.ch, [lo, hi] = FISH_CM[id], u = clamp(0.75 * rnd(S) + 0.25 * k, 0, 1);
  const cm = Math.round(lo + (hi - lo) * u), z = u < 1 / 3 ? 0 : u < 2 / 3 ? 1 : 2;
  const e = ch.fbook[id] || (ch.fbook[id] = [0, 0]), fresh = !(e[1] & (1 << z)), best = cm > e[0];
  e[0] = Math.max(e[0], cm);
  e[1] |= 1 << z;
  toast(p, `${ITEMS[id].name} ${cm}cm (${FISH_SIZE[z]})${fresh ? " — 물고기 도감에 새로 올렸습니다!" : best ? " — 최고 기록!" : ""}`);
  const n = fresh ? fbookN(ch) : 0, m = FISH_BOOK.find((b) => b[0] === n);
  if (!m) return;
  ch.gold += m[1];
  p.gain.push(["gold", m[1]]);
  if (m[2] && addItem(ch, m[2], 1)) p.gain.push(["item", m[2], 1, 1]);
  toast(p, `물고기 도감 ${n}/${Object.keys(FISH_CM).length * 3}칸! 보상 ${m[1]}G${m[2] ? ` · ${ITEMS[m[2]].name}` : ""}`);
}
/**
 * What a well-enough played fish turns into: candidates are the fish of grade ≤ min(the map's grade, the
 * angler's grade); 황금 잉어 has its own roll everywhere; then the top candidate, the next one down, a stone,
 * else the lowest. 대성공 lands two. Gives the experience. Returns { id, n, great }.
 */
function fishLand(S, p, score) {
  const ch = p.ch, L = ch.life.fish.lv, k = score / 100;
  const cap = Math.min(gradeOfMap(mapOfS(S, p.map)), lifeGrade(L));
  const carp = FISHING.carp[0] + FISHING.carp[1] * k * k + FISHING.carp[2] * L;
  const top = cap >= 2 ? FISHING.top[0] + FISHING.top[1] * k : 0, next = cap >= 3 ? FISHING.next : 0;
  let r = rnd(S);
  let id = (r -= carp) < 0 ? "fish_l" : (r -= top) < 0 ? FISH_G[cap - 1] : (r -= next) < 0 ? FISH_G[cap - 2] : (r -= FISHING.stone) < 0 ? "stone" : FISH_G[0];
  // this water's own fish (P8), never above the angler's grade; a grade-5 one takes 4등급's place, never 황금 잉어's
  const loc = Object.hasOwn(FISH_MAP, p.map) ? FISH_MAP[p.map] : "";
  if (loc && id === FISH_G[Math.min(ITEMS[loc].grade, 4) - 1] && ITEMS[loc].grade <= cap && rnd(S) < FISH_LOCAL) id = loc;
  const g = ITEMS[id].grade || 1, unlock = GRADE_LV[g - 1];
  const great = id !== "stone" && rnd(S) * 100 < lifeOdds(L, unlock, score)[1];
  const n = great && canAdd(ch, id, 2) ? 2 : 1;
  gainLife(S, p, "fish", lifeXp(L, unlock, RXP[g - 1] * (0.5 + score / 100) * (great ? 1.5 : 1)));
  fishBook(S, p, id, k);
  return { id, n, great: n === 2 };
}
/** The recipe a fish is cooked by, or null. */
const fishRecipe = (id) => (Object.hasOwn(ITEMS, id) && ITEMS[id].recipe && RECIPES[ITEMS[id].recipe]) || null;
/** The score below which the pan burns, for this cook and recipe (35 at d = 0, −0.4 a level above it, never below 10). */
const cookBurnt = (L, r) => Math.max(COOKING.burnt[2], COOKING.burnt[0] - COOKING.burnt[1] * Math.max(0, L - r.lv));
/**
 * A recipe cooked with a pan score `s` (0–100): burnt below the threshold (no experience), else the dish,
 * two portions at a near-perfect pan or on a 대성공 roll. Gives the experience. Returns { id, n, great, burnt }.
 */
function cookDish(S, p, r, s) {
  const L = p.ch.life.cook.lv;
  if (s < cookBurnt(L, r)) return { id: "burnt", n: 1, great: false, burnt: true };
  const great = rnd(S) * 100 < lifeOdds(L, r.lv, s)[1];
  gainLife(S, p, "cook", lifeXp(L, r.lv, RXP[lifeGrade(r.lv) - 1] * (great ? 1.5 : 1)));
  const n = r.out[1] * (great || s >= COOKING.two ? 2 : 1);
  sqMade(S, p, r.out[0], n);
  return { id: r.out[0], n, great, burnt: false };
}

// ── the sheet (D): life, jobBoard, rep, coopDay, coopDone, pouch — cleaned by migrate, never trusted

/** One skill table cleaned: every key, lv 1..50, 0 ≤ xp < lifeNeed(lv) (0 at 50); unknown keys dropped. */
function lifeClean(v) {
  const o = isObj(v) ? v : {}, out = {};
  for (const k of LIFE) {
    const e = isObj(o[k]) ? o[k] : {};
    const lv = clamp(Number.isInteger(e.lv) ? e.lv : 1, 1, LIFE_MAX);
    out[k] = { lv, xp: lv >= LIFE_MAX ? 0 : clamp(Math.floor(num(e.xp) ? e.xp : 0), 0, lifeNeed(lv) - 1) };
  }
  return out;
}
/** May the 재료 주머니 hold this item? Materials (ingots too), staples and flasks. */
const pouchOk = (id) => Object.hasOwn(ITEMS, id) && (ITEMS[id].type === "lmat" || id === "staple" || id === "flask");
/**
 * Bring the life fields of a sheet up to date (idempotent). A sheet from before life skills gets them from
 * its counters: 낚시 8 XP a fish caught, 요리 10 XP a dish cooked, neither past Lv 20. Reads ch.fish and the
 * cleaned ch.cnt, so migrate calls it after those.
 */
function lifeSheetClean(ch) {
  if (isObj(ch.life)) ch.life = lifeClean(ch.life);
  else {
    const l = lifeEmpty();
    lifeAdd(l.fish, (ch.fish | 0) * 8, 20);
    lifeAdd(l.cook, (ch.cnt.cook | 0) * 10, 20);
    ch.life = l;
  }
  const jb = isObj(ch.jobBoard) ? ch.jobBoard : {};
  const done = Array.isArray(jb.done) ? [...new Set(jb.done.filter((id) => typeof id === "string" && Object.hasOwn(JB, id)))].slice(0, JB_PAY.perDay + FAIR_JOBS.length) : [];
  const a = isObj(jb.active) ? jb.active : null;
  const active = a && typeof a.id === "string" && Object.hasOwn(JB, a.id) && typeof a.npc === "string" && Object.hasOwn(NPC_MAP, a.npc)
    // a parcel is never saved: a delivery loaded mid-way goes back to "pick it up"
    ? (JB[a.id].kind === "deliver" ? { id: a.id, npc: a.npc, prog: 0, expAt: 0 }
      // a chore keeps the spots done; what was carried (milk, the leash, water) is not saved, so its clock stops too
      : JB[a.id].kind === "chore" ? choreClean(ch, Math.max(0, jb.day | 0), a) : { id: a.id, npc: a.npc, prog: Math.max(0, a.prog | 0), expAt: Math.max(0, num(a.expAt) ? Math.floor(a.expAt) : 0) })
    : null;
  ch.jobBoard = { day: Math.max(0, jb.day | 0), done, active };
  const rep = {};
  if (isObj(ch.rep)) for (const id of Object.keys(ch.rep)) { const n = clamp(ch.rep[id] | 0, 0, 100); if (n > 0 && Object.hasOwn(NPC_MAP, id)) rep[id] = n; }
  ch.rep = rep;
  ch.coopDay = Math.max(0, ch.coopDay | 0);
  ch.coopDone = Array.isArray(ch.coopDone) ? [...new Set(ch.coopDone.filter((k) => COOP_KINDS.includes(k)))].slice(0, COOP_KINDS.length) : [];
  const pouch = {};
  if (isObj(ch.pouch)) for (const id of Object.keys(ch.pouch)) { const n = clamp(ch.pouch[id] | 0, 0, POUCH_MAX); if (n > 0 && pouchOk(id)) pouch[id] = n; }
  ch.pouch = pouch;
  // the 물고기 도감 (P8): known species only, [best cm 0..999, size bits 0..7]; an old sheet starts it empty
  const fb = {};
  if (isObj(ch.fbook)) for (const id of Object.keys(ch.fbook)) {
    const e = ch.fbook[id];
    if (Object.hasOwn(FISH_CM, id) && Array.isArray(e) && (e[1] & 7)) fb[id] = [clamp(Math.floor(num(e[0]) ? e[0] : 0), 0, 999), e[1] & 7];
  }
  ch.fbook = fb;
}
/** A fresh sheet's life fields. */
const lifeFresh = () => ({ life: lifeEmpty(), jobBoard: { day: 0, done: [], active: null }, rep: {}, coopDay: 0, coopDone: [], pouch: {}, fbook: {} });

// ───────────── L2: the 재료 주머니, gathering, crafting, the 알바 board, delivery, trust (B.4, B.6–B.11)

// ── the pouch (B.10): 50 addItem/canAdd/countItem/takeItem route pouch items here first (bag items go first out)
/** How many of `id` the pouch holds. */
const pouchHas = (ch, id) => (ch.pouch && Object.hasOwn(ch.pouch, id) ? ch.pouch[id] : 0);
/** Room left in the pouch for `id` (0 for anything it does not take). */
const pouchRoom = (ch, id) => (ch.pouch && pouchOk(id) ? POUCH_MAX - pouchHas(ch, id) : 0);
/** Take up to `n` of `id` out of the pouch; returns how many are still owed. */
function pouchTake(ch, id, n) {
  const t = Math.min(n, pouchHas(ch, id));
  if (t > 0) { ch.pouch[id] -= t; if (!ch.pouch[id]) delete ch.pouch[id]; }
  return n - t;
}

// ── gathering nodes (B.4)

/** The material a node gives: its kind's letter and its grade (`m_h3`). */
const nodeMat = (n) => `m_${NODE_KINDS[n[0]]}${n[1]}`;
/** The gather level a node needs and the grade its experience goes by (a crop has its own, CROP). */
const nodeLv = (n) => (n[0] === 3 ? CROP[n[1] - 1][1] : GRADE_LV[n[1] - 1]);
const nodeG = (n) => (n[0] === 3 ? CROP[n[1] - 1][2] : n[1]);
/**
 * A map's gathering nodes [kind 0..2 (herb ore wood), grade, tx, ty], placed once from the map's id and kept on
 * the map (the wire sends this list as `map.nodes`). Only hunting grounds have them: reachable tiles at least
 * NODE.gap apart and NODE.clear from doors, signs, waypoint stones, NPCs and fires; one per NODE.per open tiles
 * (clamped to NODE.min..max); hidden pockets weigh double; kinds by the theme's NODE_W. An editor map's hand-placed
 * crops come first, safe or not ([3, crop, x, y]).
 */
function lifeNodes(m) {
  if (m.nodes) return m.nodes;
  m.nodes = (m.crops || []).map(([x, y, c]) => [3, c, x, y]);
  if (m.safe || !m.reach || !Object.hasOwn(MAP_META, m.id)) return m.nodes;
  const W = m.w, H = m.h, g = gradeOfMap(m), wt = NODE_W[m.theme] || NODE_W.meadow, c = NODE.clear;
  const busy = new Uint8Array(W * H);
  const keep = (x, y) => {
    for (let dy = -c; dy <= c; dy++) for (let dx = -c; dx <= c; dx++) if (inMap(m, x + dx, y + dy)) busy[(y + dy) * W + x + dx] = 1;
  };
  for (const pt of m.portals) keep(pt.x, pt.y);
  for (const k of m.marks || []) keep(k.x, k.y);
  for (const n of m.npcs || []) keep(n.x, n.y);
  for (const s of m.stones || []) keep(s.x, s.y);
  for (const [fx, fy] of FIRES[m.id] || []) keep(fx, fy);
  const box = { seed: (strHash(m.id) ^ 0x6e0d) | 0 };
  let open = 0;
  const cand = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    if (!m.reach[i]) continue;
    open++;
    // a weighted shuffle (key u^(1/w)): hidden pockets come up twice as often
    if (!busy[i]) cand.push([Math.pow(rnd(box), 1 / (m.zone && m.zone[i] === Z_HIDDEN ? NODE.hidden : 1)), i]);
  }
  cand.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const want = clamp(Math.round(open / NODE.per), NODE.min, NODE.max), got = [];
  for (const [, i] of cand) {
    if (got.length >= want) break;
    const x = i % W, y = (i - x) / W;
    if (got.some(([gx, gy]) => (gx - x) ** 2 + (gy - y) ** 2 < NODE.gap * NODE.gap)) continue;
    got.push([x, y]);
  }
  for (const [x, y] of got) {
    let r = rnd(box), k = 0;
    while (k < 2 && (r -= wt[k]) >= 0) k++;
    m.nodes.push([k, g, x, y]);
  }
  return m.nodes;
}
/** When node `i` of the player's map is ready for them again (0 = now). */
const nodeReady = (p, i) => (p.ng && p.ng[p.map] && p.ng[p.map][i]) || 0;
/** The nodes of this map the player has spent (waiting out their cooldown), sorted. */
function nodesSpent(p, now) {
  const o = p.ng && p.ng[p.map];
  return o ? Object.keys(o).filter((i) => o[i] > now).map(Number).sort((a, b) => a - b) : [];
}
/** A gathering channel stops: event ["ga", eid, kind, −1] and a toast. */
function gatStop(S, p, why) {
  const g = p.gat;
  p.gat = null;
  S.maps[p.map].ev.push(["ga", p.eid, g ? g.k : 0, -1]);
  if (why) toast(p, why);
}
/** A channel ran out: the material (two on a 대성공), maybe a bonus item, experience, the node's cooldown. */
function gatDone(S, p) {
  const g = p.gat, ch = p.ch, now = S.now;
  p.gat = null;
  const n = lifeNodes(mapOfS(S, p.map))[g.i];
  const L = ch.life.gather.lv, unlock = nodeLv(n), id = nodeMat(n);
  const great = rnd(S) * 100 < lifeOdds(L, unlock, 50, g.extra)[1];
  const cnt = great && canAdd(ch, id, 2) ? 2 : 1;
  if (addItem(ch, id, cnt)) p.gain.push(["item", id, cnt, 0]);
  if (rnd(S) < gatBonus(L)) {
    // a herb's seed of the next grade, a stone in the vein, a bundle of kindling from the log, the next crop's root
    const b = n[0] === 0 ? `m_h${Math.min(5, n[1] + 1)}` : n[0] === 1 ? "stone" : n[0] === 3 ? `m_c${Math.min(CROP.length, n[1] + 1)}` : "camp";
    if (addItem(ch, b, 1)) { p.gain.push(["item", b, 1, 1]); toast(p, `덤으로 ${ITEMS[b].name}${pp(ITEMS[b].name, "을를")} 얻었습니다!`); }
  }
  if (great) toast(p, `대성공! ${ITEMS[id].name} ${cnt}개`);
  gainLife(S, p, "gather", lifeXp(L, unlock, RXP[nodeG(n) - 1] * (great ? 1.5 : 1)));
  ch.cnt.gat++;
  (p.ng || (p.ng = {}))[p.map] = p.ng[p.map] || {};
  p.ng[p.map][g.i] = now + NODE.cd;
  S.maps[p.map].ev.push(["ga", p.eid, n[0], great ? 1 : 0]);
  dailyProg(S, p, "gather");
  checkAch(S, p);
  p.dirty = true;
}

// ── stations and recipes (B.6)

const STATION_ERR = {
  fire: "모닥불이나 화덕 곁에서만 만들 수 있습니다", cook: "쥬쥬식당의 화덕 곁에서만 만들 수 있습니다",
  craft: "캉캉대장간의 캉캉 곁에서만 만들 수 있습니다", alch: "보글연금공방의 보글 곁에서만 만들 수 있습니다",
};
/** Whether `p` stands at a recipe's station: a campfire (or a stove) for `fire`, else an NPC (or thing) of that role. */
const stationNear = (S, p, at) => (at === "fire" ? !!fireNear(S.maps[p.map], p) || npcNear(p, "cook") : npcNear(p, at));
/** A recipe by id, or null. */
const recipeOf = (id) => (typeof id === "string" && Object.hasOwn(RECIPES, id) ? RECIPES[id] : null);
/** Trust with an NPC (0..100). */
const repOf = (ch, id) => (ch.rep && Object.hasOwn(ch.rep, id) ? ch.rep[id] : 0);
/** Why a recipe is not known yet (Korean), or "" — its level (a fish on a fire: any level), its teacher's trust, its quest. */
function recipeWhy(ch, r) {
  if (!r.any && ch.life[r.sk].lv < r.lv) return `${LIFE_NAME[LIFE.indexOf(r.sk)]} 레벨이 부족합니다 (Lv.${r.lv} 필요)`;
  if (r.rep && repOf(ch, r.rep) < REP_TIER[1]) return `${REP_PERK[r.rep].who}${pp(REP_PERK[r.rep].who, "과와")} 친구가 되어야 배울 수 있습니다`;
  if (r.sq && !Object.hasOwn(ch.sq.on, r.sq)) return "퀘스트를 받아야 만들 수 있습니다";   // a quest's own recipe (arc A5's 기록 보존액)
  return "";
}
const runeCount = (ch) => RUNE_KEYS.reduce((n, k) => n + countItem(ch, `ru_${k}`), 0);
/** How many of an input the character has (bag + pouch; "rune*" = every rune). */
const haveOf = (ch, id) => (id === "rune*" ? runeCount(ch) : countItem(ch, id));
/** Take `n` runes, the most plentiful kind first; returns the ids taken. */
function takeRunes(ch, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let best = "", bn = 0;
    for (const k of RUNE_KEYS) { const c = countItem(ch, `ru_${k}`); if (c > bn) { bn = c; best = `ru_${k}`; } }
    if (!best) break;
    takeItem(ch, best, 1);
    out.push(best);
  }
  return out;
}
/** Why `k` crafts of recipe `r` cannot start (Korean), or "": station, inputs, fee, room for the biggest result. */
function craftWhy(S, p, r, k) {
  const ch = p.ch;
  if (p.dead) return "쓰러진 상태입니다";
  const why = recipeWhy(ch, r);
  if (why) return why;
  if (!stationNear(S, p, r.at)) return STATION_ERR[r.at];
  if (r.in.some(([id, n]) => haveOf(ch, id) < n * k)) return "재료가 부족합니다";
  if (ch.gold < r.fee * k) return `골드가 부족합니다 (${r.fee * k}G 필요)`;
  const room = r.gear ? ch.inv.length + k <= bagCap(ch) : r.out[0] === "rune*" ? ch.inv.length + 2 * k <= bagCap(ch) : canAdd(ch, r.out[0], r.out[1] * 2 * k);
  return room ? "" : "가방이 가득 찼습니다";
}
/**
 * One craft of `r` with a mini-game score `s`: inputs taken, success/대성공 rolled (B.2; 쥬쥬's friends get her
 * stove's bonus); a failure gives back half of each input (rounded down) and costs no fee. A fish on a fire keeps
 * L1's pan (cookDish). Gear comes 마법..희귀 (+1 on a 대성공). Returns 0 failed (or burnt), 1 made, 2 대성공.
 */
function craftOnce(S, p, r, s) {
  const ch = p.ch;
  if (r.any) {
    takeItem(ch, r.in[0][0], 1);
    const d = cookDish(S, p, r, s);
    if (addItem(ch, d.id, d.n)) p.gain.push(["item", d.id, d.n, 0]);
    if (!d.burnt) { ch.cnt.cook++; dailyProg(S, p, "cook", fireNear(S.maps[p.map], p) ? "fire" : null); }
    return d.burnt ? 0 : d.great ? 2 : 1;
  }
  const L = ch.life[r.sk].lv;
  const taken = r.in.map(([id, n]) => (id === "rune*" ? takeRunes(ch, n) : (takeItem(ch, id, n), [id, n])));
  const extra = (r.sk === "cook" && r.at === "cook" && REP_PERK.juju.great && repOf(ch, "juju") >= REP_TIER[1] ? REP_PERK.juju.great : 0) + lifeBuff(S, p, "great");
  const roll = lifeRoll(S, L, r.lv, s, extra);
  const xp = lifeXp(L, r.lv, RXP[lifeGrade(r.lv) - 1] * (roll.great ? 1.5 : 1));
  if (!roll.ok) {
    r.in.forEach(([id, n], i) => {
      const back = Math.floor(n / 2);
      if (!back) return;
      if (id === "rune*") for (const ru of taken[i].slice(0, back)) addItem(ch, ru, 1);
      else addItem(ch, id, back);
    });
    gainLife(S, p, r.sk, Math.max(1, Math.round(xp * CRAFT.failXp)));
    return 0;
  }
  ch.gold -= r.fee;
  if (r.gear) {
    const t = ITEMS[r.out[0]].tier;
    let q = clamp(rollRarity(S, 0, 0), GEAR_CRAFT.q[0], GEAR_CRAFT.q[1]);
    if (roll.great) q = Math.min(GEAR_CRAFT.q[1], q + 1);
    const g = rollGear(S, r.out[0], q, GEAR_CRAFT.ilvl[t - 1]);
    g.il = Math.min(200, G_REQ[t - 1] + 10);   // worn from the tier's own level as before (il − 10; tier 6 stays at Lv.181)
    ch.inv.push(g);
    p.gain.push(["item", g.id, 1, g.q]);
  } else {
    const n = r.out[1] * (roll.great ? 2 : 1);
    if (r.out[0] === "rune*") for (let i = 0; i < n; i++) { const id = `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`; if (addItem(ch, id, 1)) p.gain.push(["item", id, 1, 0]); }
    else if (addItem(ch, r.out[0], n)) p.gain.push(["item", r.out[0], n, 0]);
  }
  gainLife(S, p, r.sk, xp);
  sqMade(S, p, r.out[0], r.gear || r.out[0] === "rune*" ? 1 : r.out[1] * (roll.great ? 2 : 1));
  ch.cnt.craft++;
  if (r.sk === "cook") {
    ch.cnt.cook++;
    dailyProg(S, p, "cook", r.at === "fire" && fireNear(S.maps[p.map], p) ? "fire" : null);
  }
  dailyProg(S, p, "craft");
  return roll.great ? 2 : 1;
}

// ── the 알바 board and delivery (B.8, B.9)

/** A new day (06:00 KST) clears the board: done list, the job in hand, a parcel. */
function jbEnsure(S, p) {
  const ch = p.ch, day = dayOf(S.now);
  if (ch.jobBoard.day === day) return;
  if (p.parcel) { p.parcel = null; p.stc = null; }
  if (ch.jobBoard.day && (ch.jobBoard.done.length || ch.jobBoard.active)) toast(p, "알바 게시판이 새로 바뀌었습니다.");
  ch.jobBoard = { day, done: [], active: null };
  p.jbOff = null;
  p.dirty = true;
}
/** Does a sheet qualify for template `t`: its level (hunts: the character's), for a trust row the NPC's trust, for a story row the quest answer. */
const jbQual = (ch, t) => (t.kind === "hunt" ? ch.lvl : ch.life[t.sk].lv) >= t.lv && !(t.rep > repOf(ch, t.npc))
  && (!t.flag || (!!ch.sq.done[t.flag[0]] && (ch.sq.flags[t.flag[0]] | 0) === t.flag[1]));
/** Jobs done today that count toward JB_PAY.perDay (장날 rows do not). */
const jbDoneN = (jb) => jb.done.filter((id) => !JB[id].fair).length;
/**
 * Today's offers for a sheet: up to JB_PAY.offers templates it qualifies for (not the night / rain extras), seeded
 * by name and day; each draw prefers a kind not drawn yet, so a day is a mix.
 */
function jbOffers(ch, day) {
  const box = { seed: strHash(`${ch.name}:${day}:jb`) | 0 };
  const pool = Object.keys(JB).filter((id) => !Object.hasOwn(JB_WILLOW, id) && !JB[id].when && !JB[id].fair && JB[id].kind !== "chore" && jbQual(ch, JB[id]));
  const out = [], kinds = new Set();
  while (out.length < JB_PAY.offers && pool.length) {
    const fresh = pool.filter((id) => !kinds.has(JB[id].kind)), from = fresh.length ? fresh : pool;
    const id = from[ri(box, 0, from.length - 1)];
    pool.splice(pool.indexOf(id), 1);
    out.push(id);
    kinds.add(JB[id].kind);
  }
  // and JB_PAY.chores of 버드나무 마을's chores (H10), each a different one
  const chores = Object.keys(JB).filter((id) => JB[id].kind === "chore" && !JB[id].fair && jbQual(ch, JB[id]));
  for (let i = 0; i < JB_PAY.chores && chores.length; i++) out.push(chores.splice(ri(box, 0, chores.length - 1), 1)[0]);
  return out;
}
/** The town's situation now: "night", "rain" (either, both or none). */
const jbSit = (now) => [isNight(now) ? "night" : "", weatherAt(START.map, now) === WX.rain ? "rain" : ""].filter(Boolean);
/** Today's fixed draw, Willow's standing contracts at their required levels, and current situational offers. */
function jbOffersOf(S, p) {
  jbEnsure(S, p);
  const ch = p.ch, day = ch.jobBoard.day;
  if (!p.jbOff || p.jbOff.day !== day) p.jbOff = { day, ids: jbOffers(ch, day) };
  const extra = Object.keys(JB_WILLOW).filter((id) => jbQual(ch, JB_WILLOW[id]));
  for (const w of jbSit(S.now)) {
    const c = Object.keys(JB).filter((id) => JB[id].when === w && jbQual(ch, JB[id]));
    if (c.length) extra.push(c[(strHash(`${ch.name}:${day}:${w}`) >>> 0) % c.length]);
  }
  // 장날 (63-festival.js): the four festival rows while the market is open
  if (fairOpen(S.now)) for (const id of FAIR_JOBS) if (jbQual(ch, JB[id])) extra.push(id);
  // a taken situational (or festival) job stays on the board after the night, the rain or the market ends
  const a = ch.jobBoard.active;
  if (a && (JB[a.id].when || JB[a.id].fair) && !extra.includes(a.id)) extra.push(a.id);
  return p.jbOff.ids.concat(extra.filter((id) => !p.jbOff.ids.includes(id)));
}
/** An offer's grade (0 쉬움 · 1 보통 · 2 어려움) and 긴급 minutes (0 = none), fixed by name, day and template. */
function jbRoll(ch, day, id) {
  const box = { seed: strHash(`${ch.name}:${day}:${id}:g`) | 0 }, t = JB[id], O = JB_GRADE.odds;
  let r = rnd(box) * O.reduce((a, b) => a + b, 0), g = 0;
  while (g < O.length - 1 && r >= O[g]) { r -= O[g]; g++; }
  const urgent = !t.fair && t.kind !== "deliver" && !(t.kind === "chore" && CHORES[t.job].timed) && (t.rush > 0 || ri(box, 1, JB_RUSH.odds) === 1);
  return { g, rush: urgent ? t.rush || JB_RUSH.min : 0 };
}
/** What the job needs by its grade: items or monsters (n × grade, rounded up), or 0 (deliveries, scouting). */
const jbNeed = (t, g) => (t.n ? Math.ceil(t.n * JB_GRADE.n[g]) : 0);
/** A scouting job's map for its grade. */
const jbMap = (t, g) => t.map[Math.min(g, t.map.length - 1)];
/** A hunt's progress: kills of its monster since it was taken (`active.prog` keeps the kill count at that time). */
const jbKills = (ch, a) => Math.max(0, (ch.mk[JB[a.id].mob] | 0) - a.prog);
/** Where a static NPC stands: { m, x, y }, or null. */
function lifePostAt(id) {
  const m = Object.hasOwn(NPC_MAP, id) ? mapOf(NPC_MAP[id]) : null;
  const n = m && m.npcs.find((o) => o.id === id);
  return n ? { m, x: n.x, y: n.y } : null;
}
/** Tiles walked on `m` from beside (fx, fy) to beside (tx, ty); Infinity when there is no way. */
function legTiles(m, fx, fy, tx, ty) {
  const W = m.w, from = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(m, fx + dx, fy + dy) && m.reach[(fy + dy) * W + fx + dx]) from.push((fy + dy) * W + fx + dx);
  if (!from.length) return Infinity;
  const path = walk(W, m.h, from, (i) => Math.max(Math.abs((i % W) - tx), Math.abs(Math.floor(i / W) - ty)) <= 1, (j) => (m.reach[j] ? 1 : Infinity), tx, ty);
  return path ? path.length - 1 : Infinity;
}
/**
 * A delivery's path in tiles (JB_ROUTES, worked out on first use): sender → their door → across the town →
 * the recipient's door → the recipient, each door JB_PAY.door tiles. Every place hangs off the town.
 */
function jbRoute(id) {
  if (Object.hasOwn(JB_ROUTES, id)) return JB_ROUTES[id];
  const t = JB[id], A = lifePostAt(t.npc), B = lifePostAt(t.to), hub = mapOf(START.map);
  let n = Infinity;
  if (A && B && A.m === B.m) n = legTiles(A.m, A.x, A.y, B.x, B.y);
  else if (A && B) {
    n = 0;
    let at = [A.x, A.y];
    if (A.m !== hub) {
      const d = A.m.portals.find((pt) => pt.to === hub.id);
      n += d ? legTiles(A.m, A.x, A.y, d.x, d.y) + JB_PAY.door : Infinity;
      if (d) at = arrivalOf(null, d);
    }
    if (B.m !== hub) {
      const d = hub.portals.find((pt) => pt.to === B.m.id);
      n += d ? legTiles(hub, at[0], at[1], d.x, d.y) + JB_PAY.door : Infinity;
      if (d) { at = arrivalOf(null, d); n += legTiles(B.m, at[0], at[1], B.x, B.y); }
    } else n += legTiles(hub, at[0], at[1], B.x, B.y);
  }
  JB_ROUTES[id] = n;
  return n;
}
/** A parcel's time limit (ms): the path at 85 % walking speed, × 1.8, + 20 s. */
const jbLimit = (id, g = 0) => Math.round(((jbRoute(id) * T) / (BASE_SPD * JB_PAY.limit[0])) * JB_PAY.limit[1] * JB_GRADE.lim[g] * 1000 + JB_PAY.limit[2]);
/** Walking speed while carrying a parcel (deriveStats reads it): ×0.85 at 배달 1, ×1.0 at 25, ×1.15 at 50. */
const parcelSpd = (ch) => JB_PAY.spd[0] + JB_PAY.spd[1] * ch.life.deliver.lv;
/**
 * What the hero holds in both hands instead of the weapon (the wire's carry code, public/carry.js draws it):
 * 0 nothing · 1 a delivery's parcel · 2 a chore's crate (CHORES `box`) while its acts are carried. Derived, so
 * handing it over, failing or dropping the 알바 puts it down. Attacks and skills wait while it is held (70).
 */
function carryOf(p) {
  if (p.parcel) return 1;
  const a = p.ch.jobBoard.active, t = a && JB[a.id];
  return t && t.kind === "chore" && CHORES[t.job].box && a.fill > 0 ? CHORES[t.job].box : 0;
}
const CARRY_NO = "배달 중에는 공격할 수 없어요 — 알바를 그만두면 상자를 내려놓아요";
/** The level a job pays by: its skill's (a hunt: the character's tier, 1–50). */
const jbL = (ch, t) => (t.kind === "hunt" ? clamp(Math.floor(toTier(ch.lvl)), 1, LIFE_MAX) : ch.life[t.sk].lv);
/** A job's gold before any tip or 긴급 bonus (deliveries: B.8, others: B.9) × its grade, +10 % from a 단골's own NPC. */
function jbGold(ch, t, g = 0) {
  if (t.fair) return 0;   // 장날 rows pay tokens (jbPay)
  const L = jbL(ch, t), base = t.kind === "deliver" ? JB_PAY.dGold[0] + JB_PAY.dGold[1] * L : JB_PAY.gold[0] + JB_PAY.gold[1] * L;
  return Math.round(base * JB_GRADE.pay[g] * (repOf(ch, t.npc) >= REP_TIER[0] ? REP_TIP : 1));
}
/** A parcel is lost (late, or its carrier fell): nothing paid, no trust lost, the job off the board's hand. */
function jbFail(S, p) {
  p.parcel = null;
  p.stc = null;
  p.ch.jobBoard.active = null;
  S.maps[p.map].ev.push(["dl", p.eid, 0]);
  toast(p, "배달 실패… 꾸러미를 잃어버렸습니다.");
  p.dirty = true;
}
/** Trust +n with an NPC (capped at 100); crossing a tier says what it opens. */
function addRep(S, p, id, n) {
  if (!Object.hasOwn(NPC_MAP, id) || !(n > 0)) return;
  const ch = p.ch, was = repOf(ch, id), to = Math.min(100, was + n);
  if (to === was) return;
  ch.rep[id] = to;
  const name = npcName(id), perk = REP_PERK[id];
  if (was < REP_TIER[0] && to >= REP_TIER[0]) toast(p, `${name}의 ${REP_NAME[0]}이 되었습니다! (가게 물건 5% 할인, 알바 보수 +10%)`);
  if (was < REP_TIER[1] && to >= REP_TIER[1]) {
    toast(p, `${name}${pp(name, "과와")} ${REP_NAME[1]}가 되었습니다!` + (!perk ? "" : perk.recipe ? ` 제작법 [${ITEMS[RECIPES[perk.recipe].out[0]].name}]${pp(ITEMS[RECIPES[perk.recipe].out[0]].name, "을를")} 배웠습니다.`
      : perk.elx ? ` 엘릭서의 지속 시간이 ${perk.elx}분 늘어납니다.` : perk.great ? ` 화덕 요리의 대성공 확률이 ${perk.great}%p 오릅니다.` : ""));
  }
  if (was < REP_TIER[2] && to >= REP_TIER[2]) toast(p, `${name}${pp(name, "과와")} ${REP_NAME[2]} 같은 사이가 되었습니다!`);
  checkAch(S, p);
  p.dirty = true;
}
/** A board job handed in: items taken (or the parcel), gold (+ the tip), life XP, trust; one more done today. */
function jbPay(S, p) {
  const ch = p.ch, a = ch.jobBoard.active, t = JB[a.id], now = S.now, { g, rush } = jbRoll(ch, ch.jobBoard.day, a.id), k = JB_GRADE.pay[g];
  let gold = jbGold(ch, t, g), fast = false;
  if (t.kind === "deliver") {
    gold += Math.round(gold * JB_PAY.tip * clamp((p.parcel.until - now) / p.parcel.limit, 0, 1));
    p.parcel = null; p.stc = null;
    addRep(S, p, t.to, Math.round(JB_PAY.repTo * k));
    addRep(S, p, t.npc, Math.round(JB_PAY.repFrom * k));
    ch.cnt.deliver++;
  } else {
    if (t.item) takeItem(ch, t.item, jbNeed(t, g));
    // a village chore's produce (P8): one, two from 보통 up
    const gift = t.kind === "chore" && CHORES[t.job].gift;
    if (gift && addItem(ch, gift, g ? 2 : 1)) p.gain.push(["item", gift, g ? 2 : 1, 0]);
    if (t.kind === "chore") ch.cnt.chore++;
    fast = rush > 0 && now <= a.expAt;
    if (fast) gold = Math.round(gold * JB_RUSH.bonus);
    addRep(S, p, t.npc, Math.round(JB_PAY.rep * k));
  }
  ch.gold += gold;
  if (gold) p.gain.push(["gold", gold]);
  const tokens = t.fair ? 0 : gainWillowToken(p, 1), ft = t.fair ? fairGain(S, p, FAIR.job[g]) : 0;
  gainLife(S, p, t.sk, Math.round(lifeNeed(ch.life[t.sk].lv) * JB_PAY.xp * k));
  ch.jobBoard.done.push(a.id);
  ch.jobBoard.active = null;
  S.maps[p.map].ev.push(["dl", p.eid, 2]);
  toast(p, t.fair ? `장날 알바 완료 · 장날 토큰 +${ft}${ft < FAIR.job[g] ? ` (오늘은 ${FAIR.cap}개까지)` : ""}`
    : `알바 완료${fast ? " — 긴급 성공!" : ""} ${gold}G${tokens ? ` · 버드나무토큰 +${tokens}` : ""} (${jbDoneN(ch.jobBoard)}/${JB_PAY.perDay})`);
  checkAch(S, p);
  p.dirty = true;
}

// ── items with a life use (B.11): elixirs, the punch, the whetstone

const lifeUse = (id) => typeof id === "string" && Object.hasOwn(ITEMS, id) && (ITEMS[id].type === "tool" || ITEMS[id].el === 1);
/** How many sockets a piece can ever have (as rollGear: gloves and boots 1, the rest 3; jewellery none). */
const sockCap = (g) => (isJewel(g.id) ? 0 : ITEMS[g.id].type === "gloves" || ITEMS[g.id].type === "boots" ? 1 : 3);
/** The weakest affix of a piece (value against its range's top), by index; −1 without one. */
function weakAffix(g) {
  let best = -1, bv = Infinity;
  (g.af || []).forEach(([k, v], i) => {
    const a = AFFIX.find((x) => x[0] === k);
    const r = a ? v / Math.max(1, a[4]) : 0;
    if (r < bv) { bv = r; best = i; }
  });
  return best;
}
function lifeUseValidate(S, p, a) {
  const ch = p.ch, it = ITEMS[a.id];
  if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
  if (p.dead) return bad("쓰러진 상태입니다");
  if (it.type !== "tool") return OK;
  const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
  if (!g) return bad("장착한 장비를 골라 주세요");
  if (a.id === "punch" && g.sk >= sockCap(g)) return bad(sockCap(g) ? "더 이상 홈을 뚫을 수 없습니다" : "장신구에는 홈을 뚫을 수 없습니다");
  if (a.id === "whet" && weakAffix(g) < 0) return bad("새로 굴릴 옵션이 없습니다");
  return OK;
}
function lifeUseApply(S, p, a) {
  const ch = p.ch, it = ITEMS[a.id], now = S.now;
  takeItem(ch, a.id, 1);
  if (it.el) {
    // the scroll's buff with the elixir's time (보글's friends: + REP_PERK.bogle.elx minutes); never shortens one
    const ms = it.sec ? it.sec * 1000 : (it.min + (repOf(ch, "bogle") >= REP_TIER[1] ? REP_PERK.bogle.elx : 0)) * 60000;
    if (it.buff === "spd") p.spdBuff = Math.max(p.spdBuff, now + ms);
    else for (const k of it.buff === "all" ? ["atk", "def", "xp"] : [it.buff]) ch.scr[k] = Math.max(ch.scr[k] || 0, now + ms);
    S.maps[p.map].ev.push(["u", p.eid, 2]);
    toast(p, `${it.name}${pp(it.name, "을를")} 마셨습니다. ${it.desc.split(".")[0]}.`);
  } else {
    const g = ch.eq[a.k];
    if (a.id === "punch") {
      g.sk++;
      toast(p, `${gearName(g)}에 홈을 뚫었습니다 (${g.sk}/${sockCap(g)}).`);
    } else {
      // the weakest affix goes; a fresh one (not already on the piece) takes its place, rolled at the tier's level
      const i = weakAffix(g), t = ITEMS[g.id].tier || 1;
      const pool = AFFIX.filter((x) => !g.af.some(([k], j) => j !== i && k === x[0]));
      g.af[i] = rollLine(S, pool[ri(S, 0, pool.length - 1)][0], GEAR_CRAFT.ilvl[t - 1], AFFIX_MUL[g.q | 0]);
      toast(p, `${gearName(g)}의 옵션을 새로 다듬었습니다.`);
    }
    S.maps[p.map].ev.push(["e", p.eid, 1]);
    afterGear(S, p);
  }
  p.dirty = true;
}

// ── buying from a 단골's counter, selling and storing from the pouch

/** What `n` of `id` costs here: 5 % off at a counter whose keeper counts you a 단골 (`key` = what was asked for). */
function buyCost(p, key, id, n) {
  const base = ITEMS[id].price * n;
  for (const nd of mapOfS(p.S, p.map).npcs) {
    if (nd.role !== "shop" || repOf(p.ch, nd.id) < REP_TIER[0] || dist(p.x, p.y, nd.x * T + 8, nd.y * T + 12) >= 56) continue;
    if ((nd.goods || SHOP).includes(key)) return Math.floor(base * REP_DISC);
  }
  return base;
}

// ── the life actions (B.11): gat gat_tap craft_open craft jb — appended to 70/75's switches

function lifeValidate(S, p, a) {
  const ch = p.ch, now = S.now;
  switch (a.t) {
    case "gat": {
      if (p.dead) return bad("쓰러진 상태입니다");
      if (p.gat) return bad("이미 채집 중입니다");
      const n = Number.isInteger(a.i) ? lifeNodes(mapOfS(S, p.map))[a.i] : null;
      if (!n) return bad("채집할 수 있는 곳이 아닙니다");
      if (dist(p.x, p.y, n[2] * T + 8, n[3] * T + 10) > NODE.range) return bad("너무 멉니다");
      if (nodeReady(p, a.i) > now) return bad("아직 다시 자라지 않았습니다");
      const need = nodeLv(n);
      if (ch.life.gather.lv < need) return bad(`채집 레벨이 부족합니다 (Lv.${need} 필요)`);
      if (now - p.hitAt < NODE.hit) return bad("싸우는 중에는 채집할 수 없습니다");
      if (!canAdd(ch, nodeMat(n), 2)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "gat_tap": return p.gat ? OK : bad("채집 중이 아닙니다");
    case "craft_open": {
      const r = recipeOf(a.r);
      if (!r) return bad("그런 제작법은 없습니다");
      const why = craftWhy(S, p, r, 1);
      return why ? bad(why) : OK;
    }
    case "craft": {
      const r = recipeOf(a.r);
      if (!r) return bad("그런 제작법은 없습니다");
      if (a.s === undefined) {
        // batch: no mini-game, scored CRAFT.batchS, for recipes CRAFT.batchD+ levels below you (never gear)
        if (!Number.isInteger(a.n) || a.n < 1 || a.n > CRAFT.batch) return bad("잘못된 수량");
        if (r.gear) return bad("장비는 한 번에 하나씩 만들어야 합니다");
        if (r.any || ch.life[r.sk].lv < r.lv + CRAFT.batchD) return bad(`일괄 제작은 제작법보다 ${CRAFT.batchD}레벨 높아야 할 수 있습니다`);
        const why = craftWhy(S, p, r, a.n);
        return why ? bad(why) : OK;
      }
      if (!Number.isFinite(a.s)) return bad("잘못된 요청입니다");
      if (!p.mk || p.mk.r !== a.r) return bad("먼저 제작을 시작하세요");
      if (now - p.mk.at < r.ms * lifeTime(ch.life[r.sk].lv)) return bad("너무 서둘렀습니다");
      const why = craftWhy(S, p, r, 1);
      return why ? bad(why) : OK;
    }
    case "jb": {
      const jb = ch.jobBoard, act = jb.active, t = act ? JB[act.id] : null;
      if (a.a === "take") {
        if (!npcNear(p, "jobs")) return bad("알바 중개인이 너무 멉니다");
        if (typeof a.id !== "string" || !jbOffersOf(S, p).includes(a.id)) return bad("오늘의 알바가 아닙니다");
        if (jb.done.includes(a.id)) return bad("오늘 이미 끝낸 알바입니다");
        if (act) return bad("이미 맡은 알바가 있습니다");
        if (!JB[a.id].fair && jbDoneN(jb) >= JB_PAY.perDay) return bad(`알바는 하루에 ${JB_PAY.perDay}개까지입니다`);
        return OK;
      }
      if (a.a === "drop") return act ? OK : bad("맡은 알바가 없습니다");
      if (t && t.kind === "chore" && (a.a === "pick" || a.a === "do" || a.a === "give")) return choreValidate(S, p, a, act);
      if (a.a === "do") return bad("맡은 마을 알바가 없습니다");
      if (a.a === "pick") {
        if (!t || t.kind !== "deliver") return bad("맡은 배달이 없습니다");
        if (act.prog !== 0) return bad("이미 꾸러미를 받았습니다");
        if (!npcReach(p, t.npc)) return bad(`${npcName(t.npc)}에게 가서 꾸러미를 받으세요`);
        if (p.dead) return bad("쓰러진 상태입니다");
        return OK;
      }
      if (a.a === "give") {
        if (!t) return bad("맡은 알바가 없습니다");
        const to = t.kind === "deliver" ? t.to : t.npc;
        if (!npcReach(p, to)) return bad(`${npcName(to)}에게 가져가세요`);
        if (t.kind === "deliver") return act.prog === 1 && p.parcel && now <= p.parcel.until ? OK : bad("전할 꾸러미가 없습니다");
        const g = jbRoll(ch, jb.day, act.id).g, need = jbNeed(t, g);
        if (t.kind === "hunt") { const k = jbKills(ch, act); return k >= need ? OK : bad(`${MOBS[t.mob].name}${pp(MOBS[t.mob].name, "을를")} 더 잡아야 합니다 (${k}/${need})`); }
        if (t.kind === "scout") return act.prog >= 1 ? OK : bad(`먼저 ${MAP_META[jbMap(t, g)].name}에 다녀오세요`);
        return countItem(ch, t.item) >= need ? OK : bad(`${ITEMS[t.item].name}${pp(ITEMS[t.item].name, "이가")} 부족합니다 (${countItem(ch, t.item)}/${need})`);
      }
      return bad("잘못된 요청입니다");
    }
  }
  return bad("알 수 없는 행동");
}

function lifeApply(S, p, a) {
  const ch = p.ch, now = S.now;
  switch (a.t) {
    case "gat": {
      // a channel of NODE.ch × the time factor; the "반짝!" moment somewhere in tapAt of it (lifeTick sends it)
      rouse(S, p);
      const n = lifeNodes(mapOfS(S, p.map))[a.i], dur = Math.round(NODE.ch * lifeTime(ch.life.gather.lv) * (1 - lifeBuff(S, p, "gat") / 100));
      p.gat = { i: a.i, k: n[0], map: p.map, x: p.x, y: p.y, at: now, end: now + dur, tapAt: now + Math.round(dur * (NODE.tapAt[0] + (NODE.tapAt[1] - NODE.tapAt[0]) * rnd(S))), sent: false, tapped: false, extra: 0 };
      S.maps[p.map].ev.push(["gs", p.eid, n[0], dur]);
      break;
    }
    case "gat_tap": {
      // only the first tap counts, and only inside the window (plus a latency allowance)
      const g = p.gat;
      if (g.tapped) break;
      g.tapped = true;
      if (now >= g.tapAt && now <= g.tapAt + NODE.tap + NODE.lag) g.extra = NODE.tapBonus;
      break;
    }
    case "craft_open":
      p.mk = { r: a.r, at: now };
      S.maps[p.map].ev.push(["mk", p.eid, a.r]);
      break;
    case "craft": {
      const r = RECIPES[a.r], batch = a.s === undefined, k = batch ? a.n : 1, s = batch ? CRAFT.batchS : clamp(Math.round(a.s), 0, 100);
      p.mk = null;
      let made = 0, great = 0, best = 0;
      for (let i = 0; i < k; i++) { const res = craftOnce(S, p, r, s); if (res) made++; if (res === 2) great++; best = Math.max(best, res); }
      const name = r.out[0] === "rune*" ? "룬" : ITEMS[r.out[0]].name;
      toast(p, k > 1 ? `일괄 제작: ${name} — 성공 ${made}/${k}${great ? `, 대성공 ${great}` : ""}`
        : best === 2 ? `대성공! ${name}` : best === 1 ? `${name} 완성` : r.any ? "태워 버렸습니다…" : "제작 실패… 재료의 절반을 건졌습니다.");
      S.maps[p.map].ev.push(["mo", p.eid, a.r, best]);
      if (!batch && r.mg === "pan") fairPan(S, p, s);   // 장날 요리 대회 (63-festival.js)
      checkAch(S, p);
      p.dirty = true;
      break;
    }
    case "jb": {
      const jb = ch.jobBoard;
      if (a.a === "take") {
        const t = JB[a.id], { g, rush } = jbRoll(ch, jb.day, a.id);
        // a hunt keeps the kill count it starts from in `prog`; 긴급 keeps its deadline in `expAt`
        jb.active = { id: a.id, npc: t.npc, prog: t.kind === "hunt" ? ch.mk[t.mob] | 0 : 0, expAt: rush ? now + rush * 60000 : 0 };
        if (t.kind === "chore") Object.assign(jb.active, { got: 0, fill: 0 });
        p.jbSeen = 0; p.jbLate = 0;
        toast(p, `[${JB_GRADE.name[g]}${rush ? ` · 긴급 ${rush}분` : ""}] 알바를 맡았습니다: ${t.text}`);
      } else if (a.a === "drop") {
        if (p.parcel) { p.parcel = null; p.stc = null; }
        jb.active = null;
        toast(p, "알바를 그만두었습니다.");
      } else if (JB[jb.active.id].kind === "chore" && a.a !== "give") choreApply(S, p, a, jb.active);
      else if (a.a === "pick") {
        const t = JB[jb.active.id], limit = Math.round(jbLimit(jb.active.id, jbRoll(ch, jb.day, jb.active.id).g) * (1 + lifeBuff(S, p, "dlv") / 100));
        p.parcel = { id: jb.active.id, from: t.npc, to: t.to, until: now + limit, limit };
        p.stc = null;
        jb.active.prog = 1;
        jb.active.expAt = now + limit;
        S.maps[p.map].ev.push(["dl", p.eid, 1]);
        toast(p, `꾸러미를 받았습니다! ${Math.ceil(limit / 1000)}초 안에 ${npcName(t.to)}에게 전해 주세요.`);
      } else jbPay(S, p);
      p.dirty = true;
      break;
    }
  }
}

/**
 * Once a tick per player (80 tick): a gathering channel sends its "반짝!", breaks on a step, a blow taken or
 * struck, sitting, fishing or death, or finishes; a parcel past its time or with a fallen carrier is lost;
 * spent nodes come back; the board turns over at 06:00 KST.
 */
function lifeTick(S, p, now) {
  const g = p.gat;
  if (g) {
    if (p.map !== g.map || p.dead || p.sit || p.fish || dist(p.x, p.y, g.x, g.y) > NODE.move || p.hitAt > g.at || p.atkAt > g.at) gatStop(S, p, "채집이 끊겼습니다.");
    else if (now >= g.end) gatDone(S, p);
    else if (!g.sent && now >= g.tapAt) { g.sent = true; S.maps[p.map].ev.push(["gt", p.eid, NODE.tap]); }
  }
  if (p.parcel && (p.dead || now > p.parcel.until)) jbFail(S, p);
  choreTick(S, p, now);
  jbWatch(S, p, now);
  fairWatch(S, p, now);
  if (p.ng) for (const id of Object.keys(p.ng)) {
    const o = p.ng[id];
    for (const i of Object.keys(o)) if (o[i] <= now) delete o[i];
    if (!Object.keys(o).length) delete p.ng[id];
  }
  jbEnsure(S, p);
}

/**
 * Board v2, once a tick: a hunt's kill count (a toast per kill, dirty), a scout reaching its map (`prog` 1), and
 * the board re-sent when night or rain starts or ends in the town (its extra offers change).
 */
function jbWatch(S, p, now) {
  const ch = p.ch, a = ch.jobBoard.active, t = a && JB[a.id];
  if (t && (t.kind === "hunt" || t.kind === "scout")) {
    const g = jbRoll(ch, ch.jobBoard.day, a.id).g;
    if (t.kind === "scout" && a.prog === 0 && p.map === jbMap(t, g)) {
      a.prog = 1;
      toast(p, `[알바] ${MAP_META[p.map].name}${pp(MAP_META[p.map].name, "을를")} 둘러봤습니다. ${npcName(t.npc)}에게 알려 주세요!`);
      p.dirty = true;
    } else if (t.kind === "hunt") {
      const need = jbNeed(t, g), k = Math.min(need, jbKills(ch, a));
      if (p.jbSeen !== k) {
        if (p.jbSeen !== undefined && k > p.jbSeen) toast(p, k >= need ? `[알바] ${MOBS[t.mob].name} ${k}/${need} — 다 잡았습니다! ${npcName(t.npc)}에게 알려 주세요.` : `[알바] ${MOBS[t.mob].name} ${k}/${need}`);
        p.jbSeen = k;
        p.dirty = true;
      }
    }
  }
  if (t && t.kind !== "deliver" && !(t.kind === "chore" && CHORES[t.job].timed) && a.expAt && now > a.expAt && p.jbLate !== a.expAt) {
    if (p.jbLate !== undefined) toast(p, "긴급 시간이 지났습니다. 지금 마쳐도 기본 보수는 받습니다.");
    p.jbLate = a.expAt;
    p.dirty = true;
  }
  const sit = jbSit(now).join();
  if (p.jbSit !== sit) { if (p.jbSit !== undefined) p.dirty = true; p.jbSit = sit; }
}

// ── the wire (B.12)

/**
 * self.jb: [day, offers [[id, kind, npc name, text, gold, skill index, grade, need n, 긴급 minutes]…], done ids,
 * active ? [id, prog, need n, parcel secs left (a timed chore's too), 긴급 secs left (0 none, -1 missed), done so far (hunt kills,
 * scout 0/1, chore acts), …a chore's spots [[x, y, done]…] and acts carried (59-chores.js choreView)] : 0].
 */
function jbView(p) {
  const ch = p.ch, day = ch.jobBoard.day, offers = jbOffersOf(p.S, p), a = ch.jobBoard.active, now = p.S.now;
  const ar = a && jbRoll(ch, day, a.id), at = a && JB[a.id], timed = at && at.kind === "chore" && CHORES[at.job].timed && a.fill > 0;
  return [day, offers.map((id) => { const t = JB[id], r = jbRoll(ch, day, id); return [id, t.kind, npcName(t.npc), t.text, jbGold(ch, t, r.g), LIFE.indexOf(t.sk), r.g, jbNeed(t, r.g), r.rush]; }),
    ch.jobBoard.done.slice(), a ? [a.id, a.prog, jbNeed(at, ar.g),
      p.parcel ? Math.max(0, Math.ceil((p.parcel.until - now) / 1000)) : timed ? Math.max(0, Math.ceil((a.expAt - now) / 1000)) : 0,
      a.expAt && at.kind !== "deliver" && !timed ? (now <= a.expAt ? Math.max(1, Math.ceil((a.expAt - now) / 1000)) : -1) : 0,
      at.kind === "hunt" ? Math.min(jbNeed(at, ar.g), jbKills(ch, a)) : at.kind === "scout" ? Math.min(1, a.prog) : at.kind === "chore" ? a.prog : 0,
      ...choreView(ch, a)] : 0];
}
/** self.rep: [[npcId, trust]…] (only NPCs above 0). */
const repView = (ch) => Object.keys(ch.rep).map((id) => [id, ch.rep[id]]);
/** Snapshot field `ng`: this map's nodes the player has spent, only when the list changes (and on arrival). */
function lifeSnap(S, p, out) {
  const ng = nodesSpent(p, S.now), key = ng.join(",");
  if (p.sendMap || key !== p.ngKey) { out.ng = ng; p.ngKey = key; }
}

/** self.life: [lv, xp, need (0 at the cap)] per skill, in LIFE order. */
const lifeView = (ch) => LIFE.map((k) => [ch.life[k].lv, ch.life[k].xp, ch.life[k].lv >= LIFE_MAX ? 0 : lifeNeed(ch.life[k].lv)]);
/** defs().life: the names, the curve, grades, the bonus formula, fish and recipes, each map's grade. */
function lifeDefs() {
  return {
    keys: LIFE, names: LIFE_NAME, max: LIFE_MAX, need: Array.from({ length: LIFE_MAX }, (_, i) => lifeNeed(i + 1)),
    grades: GRADE_LV, gradeName: GRADE_NAME, rxp: RXP, stale: [LIFE_STALE_D, LIFE_STALE], roll: LIFE_ROLL, unlock: LIFE_UNLOCK,
    fish: FISH_G, fishing: { keep: FISHING.keep }, cooking: COOKING,
    recipes: Object.keys(RECIPES).map((id) => ({ id, ...RECIPES[id] })),
    mats: Object.keys(ITEMS).filter((id) => ITEMS[id].type === "lmat"),
    mapGrade: Object.fromEntries(Object.keys(MAP_META).map((id) => [id, mapGradeOf(id)])),
    // L2: nodes (kind letters/names, cooldown, channel at Lv 1, reach, tap window), stations, batch rules, the
    // board's templates and pay, trust tiers and perks, the pouch
    nodes: { kinds: NODE_KINDS, names: NODE_NAME, crop: CROP.map((c) => c[1]), cd: NODE.cd, ch: NODE.ch, range: NODE.range, tap: NODE.tap },
    mg: MG, craft: CRAFT, bless: ENH_BLESS, gearCraft: { q: GEAR_CRAFT.q },
    jb: Object.fromEntries(Object.keys(JB).map((id) => [id, { ...JB[id], npcName: npcName(JB[id].npc), toName: JB[id].to ? npcName(JB[id].to) : "" }])),
    jbPay: JB_PAY, jbGrade: JB_GRADE, jbRush: JB_RUSH, chores: CHORES, chore: { map: CHORE_MAP, range: CHORE.range, src: CHORE.src },
    rep: { tier: REP_TIER, name: REP_NAME, disc: REP_DISC, tip: REP_TIP, perk: REP_PERK },
    pouch: { max: POUCH_MAX, ids: Object.keys(ITEMS).filter(pouchOk) },
    master: LIFE_MASTER,
    // P7/P8: the 덤 step, the waters' own fish, the 물고기 도감 (lengths, sizes, rewards)
    step: LIFE_STEP, fishMap: FISH_MAP, fbook: { cm: FISH_CM, size: FISH_SIZE, at: FISH_BOOK },
  };
}
