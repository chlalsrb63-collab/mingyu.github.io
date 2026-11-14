// ───────────────────────────── life skills: the engine (docs/design/life-and-coop.md B) ─────────────────────────────
// Levels and experience (`gainLife`), the one bonus formula (`lifeOdds`/`lifeRoll`/`lifeTime`), grades of maps
// and levels, what a reeled fish and a cooked fish turn into (`fishLand`, `cookDish`, called from 75 reel/cook),
// the sheet's life fields cleaned (`lifeSheetClean`, called from migrate) and the wire (`lifeView`, `lifeDefs`).
// Tables live in 12-life-tables.js.

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
  const band = m && (m.band || (m.id && Object.hasOwn(MAP_META, m.id) && MAP_META[m.id].band));
  if (!band) return 1;
  let g = 0;
  for (const t of GRADE_TIER) if (band[0] >= t) g++;
  return Math.max(1, g);
}
/** A map's grade by id without building a hunting ground (editor and town maps are built at load). */
const mapGradeOf = (id) => (MAP_META[id].eager ? gradeOfMap(mapOf(id)) : gradeOfMap({ band: MAP_META[id].band }));

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
  const ups = lifeAdd(e, n);
  for (const lv of ups) {
    S.maps[p.map].ev.push(["lv2", p.eid, i, lv]);
    toast(p, lv >= LIFE_MAX ? `[${LIFE_NAME[i]}] 레벨 ${lv}! 명장의 경지에 올랐습니다.`
      : LIFE_UNLOCK[lv] ? `[${LIFE_NAME[i]}] 레벨 ${lv}! ${LIFE_UNLOCK[lv]} 재료를 다룰 수 있습니다.` : `[${LIFE_NAME[i]}] 레벨 ${lv}!`);
  }
  p.dirty = true;
  return ups.length;
}

// ── fishing and cooking (B.5)

/** The fight score below which a fish gets away, at this angler's level (30 at 1, 15 at 50). */
const fishKeep = (ch) => FISHING.keep[0] - FISHING.keep[1] * ch.life.fish.lv;
/** How long until a bite (ms), before the weather. */
const fishWait = (S, ch) => (FISHING.wait[0] + rnd(S) * FISHING.wait[1]) * lifeTime(ch.life.fish.lv);
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
  const id = (r -= carp) < 0 ? "fish_l" : (r -= top) < 0 ? FISH_G[cap - 1] : (r -= next) < 0 ? FISH_G[cap - 2] : (r -= FISHING.stone) < 0 ? "stone" : FISH_G[0];
  const g = ITEMS[id].grade || 1, unlock = GRADE_LV[g - 1];
  const great = id !== "stone" && rnd(S) * 100 < lifeOdds(L, unlock, score)[1];
  const n = great && canAdd(ch, id, 2) ? 2 : 1;
  gainLife(S, p, "fish", lifeXp(L, unlock, RXP[g - 1] * (0.5 + score / 100) * (great ? 1.5 : 1)));
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
  return { id: r.out[0], n: r.out[1] * (great || s >= COOKING.two ? 2 : 1), great, burnt: false };
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
/** May the 재료 주머니 hold this item? Materials, and (from L2) staples and flasks. */
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
  const done = Array.isArray(jb.done) ? [...new Set(jb.done.filter((id) => typeof id === "string" && Object.hasOwn(JB, id)))].slice(0, 3) : [];
  const a = isObj(jb.active) ? jb.active : null;
  const active = a && typeof a.id === "string" && Object.hasOwn(JB, a.id) && typeof a.npc === "string" && Object.hasOwn(NPC_MAP, a.npc)
    // a parcel is never saved: a delivery loaded mid-way goes back to "pick it up"
    ? (JB[a.id].kind === "deliver" ? { id: a.id, npc: a.npc, prog: 0, expAt: 0 } : { id: a.id, npc: a.npc, prog: Math.max(0, a.prog | 0), expAt: Math.max(0, num(a.expAt) ? Math.floor(a.expAt) : 0) })
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
}
/** A fresh sheet's life fields. */
const lifeFresh = () => ({ life: lifeEmpty(), jobBoard: { day: 0, done: [], active: null }, rep: {}, coopDay: 0, coopDone: [], pouch: {} });

// ── the wire (B.12)

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
  };
}
