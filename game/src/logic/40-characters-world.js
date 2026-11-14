// ───────────────────────────── characters ─────────────────────────────

const NAME_RE = /^[가-힣A-Za-z0-9]{2,10}$/;
export function validName(name) {
  return typeof name === "string" && NAME_RE.test(name);
}
/** Where gear is worn. Two rings; everything else one of a kind. `weapon2` is a hybrid's second weapon (Tab swaps; adds no stats). */
const SLOTS = ["weapon", "helm", "armor", "gloves", "boots", "ring1", "ring2", "amulet", "weapon2"];
const GEAR_TYPES = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"];
const isGear = (id) => GEAR_TYPES.includes(ITEMS[id].type);
const isJewel = (id) => ITEMS[id].type === "ring" || ITEMS[id].type === "amulet";
const slotsFor = (type) => (type === "ring" ? ["ring1", "ring2"] : [type]);
const plain = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });

/**
 * The highest choice allowed for each part of a character's look (public/species.js
 * draws them): ear, eyes, nose, fur colour, blush, markings, tunic — then the kind of
 * animal, tail, accent colour and eye colour, where 0 means "as before", so a sheet
 * saved with the first seven alone looks exactly as it did.
 */
const LOOK_MAX = [13, 15, 13, 21, 5, 12, 11, 14, 11, 13, 7];
const cleanLook = (look) => { const lk = Array.isArray(look) ? look : []; return LOOK_MAX.map((m, i) => clamp(lk[i] | 0, 0, m)); };
/** What a new look costs at the mirror in town (거울 · 미용실). */
const LOOK_COST = 500;
/**
 * A brand-new character sheet — this is exactly what gets persisted. Everyone starts a 모험가
 * (adventurer) with six stats at 5, an old dagger in hand and a free weapon to pick at 수련관 카이.
 * (Callers from the four-class days passed `newChar(name, cls, look)`: a look in third place is still taken.)
 */
export function newChar(name, look, oldLook) {
  const lk = Array.isArray(look) ? look : Array.isArray(oldLook) ? oldLook : [];
  return {
    v: 12, name, job: "adventurer",
    // ear, eyes, nose, colour, blush, markings, tunic, species, tail, accent, eye colour
    look: cleanLook(lk),
    // level = 1 + points spent; xp = unspent experience; xpt = experience spent on points (a reset gives it back)
    lvl: 1, xp: 0, xpt: 0, gold: 50,
    st: freshSt(), wm: freshWm(), rs: 0, sw: 0,
    inv: [{ id: "hp_s", n: 5 }, { id: "mp_s", n: 3 }],
    eq: { weapon: plain("w_rogue_1"), helm: null, armor: plain("a_1"), gloves: null, boots: null, ring1: null, ring2: null, amulet: null, weapon2: null },
    q: { i: 0, n: 0, st: 0 },
    bq: null, bn: 0, mk: {}, guild: "", gm: 0, fish: 0,
    // waypoint stones woken, per map a bitmask of its stones (bit 0 = its first stone)
    wp: { town: 1 }, seen: ["town"], ach: [], title: "", cnt: Object.fromEntries(CNT_KEYS.map((k) => [k, 0])), daily: null, tut: { i: 0, n: 0 },
    // 차원 균열 clears today (Phase 2: the daily count), by the day number they were made on
    dim: { day: 0, n: 0 },
    wh:{ items: [], gold: 0 }, pet: "", scr: { atk: 0, def: 0, xp: 0 }, opt: { filter: 0, ahp: 0, amp: 0 },
    qs: QS_EMPTY(), cos: cosEmpty(), sq: sqEmpty(),
    // the bag's size and a house of one's own (v10: 46-bag.js, 64-housing.js)
    bagCap: INV_BASE, house: homeEmpty(),
    // life skills (v12, 58-life.js): life {6 × {lv, xp}}, jobBoard, rep, coopDay, coopDone, pouch
    ...lifeFresh(),
    map: START.map, x: START.x, y: START.y, hp: -1, mp: -1, kills: 0,
  };
}

/** Ids that no longer exist, and what they became. */
const OLD_ID = { c_1: "r_2", c_2: "n_3", c_3: "r_4" };
/** Bring a sheet saved by an older version up to the current shape. */
function migrate(ch) {
  // the four-class days (v ≤ 9): a jobless hero of level 4L−3, everything paid back (45-jobs.js)
  if (typeof ch.cls === "string" && !ch.job) migrateV10(ch);
  delete ch.cls; delete ch.tr; delete ch.skl;
  cleanJobs(ch);
  // an older, shorter look is padded with "as before"
  ch.look = cleanLook(ch.look);
  const fix = (g) => {
    if (!g || typeof g.id !== "string") return null;
    const id = OLD_ID[g.id] || g.id.replace("w_ranger_", "w_lancer_");
    if (!ITEMS[id]) return null;
    if (!isGear(id)) return { id, n: g.n | 0 || 1 };
    const out = { id, q: clamp(g.q | 0, 0, 4), enh: clamp(g.enh | 0, 0, 10), af: Array.isArray(g.af) ? g.af : [], sk: g.sk | 0, ru: Array.isArray(g.ru) ? g.ru : [] };
    if (LEGEND[g.lg]) out.lg = g.lg;
    if (SETS[g.set]) out.set = g.set;
    return out;
  };
  ch.inv = (Array.isArray(ch.inv) ? ch.inv : []).map(fix).filter(Boolean);
  const old = isObj(ch.eq) ? ch.eq : {};
  const eq = {};
  for (const k of SLOTS) {
    const g = fix(old[k]);
    eq[k] = g && (k === "weapon2" ? ITEMS[g.id].type === "weapon" : slotsFor(ITEMS[g.id].type).includes(k)) ? g : null;
  }
  // the single accessory slot of old sheets becomes a ring or an amulet
  const acc = fix(old.acc);
  if (acc) {
    const k = slotsFor(ITEMS[acc.id].type)[0];
    if (!eq[k]) eq[k] = acc;
    else if (ch.inv.length < bagCap(ch)) ch.inv.push(acc);
  }
  ch.eq = eq;
  if (!isObj(ch.q)) ch.q = { i: 0, n: 0, st: 0 };
  ch.q = { i: clamp(ch.q.i | 0, 0, QUESTS.length), n: Math.max(0, ch.q.n | 0), st: ch.q.st === 1 ? 1 : 0 };
  ch.bq = isObj(ch.bq) && MOBS[ch.bq.k] ? { k: ch.bq.k, n: ch.bq.n | 0, need: BOUNTY_N } : null;
  ch.bn = ch.bn | 0;
  const mk = {};
  if (isObj(ch.mk)) for (const k of Object.keys(ch.mk)) if (MOBS[k]) mk[k] = ch.mk[k] | 0;
  ch.mk = mk;
  ch.guild = typeof ch.guild === "string" && NAME_RE.test(ch.guild) ? ch.guild : "";
  ch.gm = ch.guild && ch.gm ? 1 : 0;
  ch.fish = ch.fish | 0;
  // the long game: waypoints, places seen, achievements, a title, counters, dailies, first steps
  // (v9: { mapId: bitmask of its stones }; before, a list of maps, each meaning its one stone)
  // (a mask keeps only the stones the map has: a 4x ground has MAP_META.wpn of them)
  const wp = {};
  if (Array.isArray(ch.wp)) { for (const id of ch.wp) if (hasWp(id)) wp[id] = 1; }
  else if (isObj(ch.wp)) for (const id of Object.keys(ch.wp)) { const k = ch.wp[id] & WP_MASK & ((1 << (hasWp(id) ? MAP_META[id].wpn || 1 : 0)) - 1); if (k) wp[id] = k; }
  wp.town = (wp.town | 0) | 1;
  ch.wp = wp;
  // a place inside the map the sheet names (maps change size; addPlayer then finds open ground)
  const mm = typeof ch.map === "string" && Object.hasOwn(MAP_META, ch.map) ? MAP_META[ch.map] : null;
  if (mm) { ch.x = clamp(Number(ch.x) || 0, 0, mm.w * T - 1); ch.y = clamp(Number(ch.y) || 0, 0, mm.h * T - 1); }
  ch.seen = (Array.isArray(ch.seen) ? ch.seen : []).filter((id) => typeof id === "string" && Object.hasOwn(MAP_META, id));
  if (!ch.seen.includes("town")) ch.seen.unshift("town");
  ch.ach = (Array.isArray(ch.ach) ? ch.ach : []).filter((id) => ACH_BY[id]);
  ch.title = typeof ch.title === "string" && ch.ach.includes(ch.title) && ACH_BY[ch.title].title ? ch.title : "";
  // achievement counters (kept in `st` before the six stats took that name)
  const cnt = isObj(ch.cnt) ? ch.cnt : {};
  ch.cnt = {};
  for (const k of CNT_KEYS) ch.cnt[k] = Math.max(0, cnt[k] | 0);
  const dl = ch.daily;
  ch.daily = isObj(dl) && Number.isInteger(dl.day) && Array.isArray(dl.tasks) && dl.tasks.length === 3 && dl.tasks.every((t) => isObj(t) && DAILY_TEXT[t.kind] && (t.kind !== "kill" || MOBS[t.k]))
    ? { day: dl.day, tasks: dl.tasks.map((t) => ({ kind: t.kind, k: t.kind === "kill" ? t.k : null, n: clamp(t.n | 0, 0, t.need | 0), need: Math.max(1, t.need | 0) })), claimed: [0, 1, 2].map((i) => !!(Array.isArray(dl.claimed) && dl.claimed[i])), bonus: !!dl.bonus }
    : null;
  // a character from before the first-steps chain who has clearly found their feet skips it
  ch.tut = isObj(ch.tut) ? { i: clamp(ch.tut.i | 0, 0, TUT.length), n: Math.max(0, ch.tut.n | 0) } : { i: toTier(ch.lvl) >= 5 || (ch.kills | 0) >= 20 ? TUT.length : 0, n: 0 };
  // the warehouse, a pet, scrolls being read, settings
  const wh = isObj(ch.wh) ? ch.wh : {};
  ch.wh = { items: (Array.isArray(wh.items) ? wh.items : []).map(fix).filter(Boolean).slice(0, WH), gold: Math.max(0, Math.floor(num(wh.gold) ? wh.gold : 0)) };
  ch.pet = typeof ch.pet === "string" && ITEMS[ch.pet] && ITEMS[ch.pet].type === "pet" && countItem(ch, ch.pet) > 0 ? ch.pet : "";
  const scr = isObj(ch.scr) ? ch.scr : {};
  ch.scr = { atk: num(scr.atk) ? scr.atk : 0, def: num(scr.def) ? scr.def : 0, xp: num(scr.xp) ? scr.xp : 0 };
  const opt = isObj(ch.opt) ? ch.opt : {};
  ch.opt = { filter: clamp(opt.filter | 0, 0, 2), ahp: clamp(opt.ahp | 0, 0, 90), amp: clamp(opt.amp | 0, 0, 90) };
  // the quick slots 1–9: sheets from before them start with all nine empty
  ch.qs = QS_EMPTY().map((_, i) => (Array.isArray(ch.qs) && ch.qs[i] && qsOk(ch, ch.qs[i]) ? ch.qs[i].slice() : null));
  // the wardrobe (v7): owned cosmetics and the one worn in each slot
  ch.cos = cosClean(ch.cos, ch);
  // side quests from the world map editor (v8): what is under way and what is done
  ch.sq = sqClean(ch.sq);
  // the 차원 균열 daily count (v9)
  ch.dim = isObj(ch.dim) ? { day: Math.max(0, ch.dim.day | 0), n: clamp(ch.dim.n | 0, 0, 999) } : { day: 0, n: 0 };
  // ── bag expansion and housing (v10): the bag 40..100 (old bags were 30), the house cleaned ──
  bagClean(ch);
  ch.house = houseClean(ch.house, fix);
  // ──
  // jobs and stats (v11): four-class sheets were turned into heroes at the top (migrateV10), every sheet's
  // stats, mastery and job cleaned there too (cleanJobs) — before the counters and the bar above read them
  // life skills (v12): an older sheet's 낚시/요리 start from its fish and cook counters (cap Lv 20); the 알바
  // board, trust, co-op days and the 재료 주머니 are cleaned (58-life.js)
  lifeSheetClean(ch);
  ch.v = Math.max(ch.v | 0, 12);
  return ch;
}

/** The quick slots under keys 1–9: each is empty, a skill (["s", index]) or a usable item (["i", id]). */
const QS_N = 9;
const QS_EMPTY = () => Array(QS_N).fill(null);
const QS_USE = ["pot", "food", "camp", "scroll", "buff", "pet"];
/** Is `v` something a quick slot may hold for this character? */
function qsOk(ch, v) {
  if (v === null) return true;
  if (!Array.isArray(v) || v.length !== 2) return false;
  // until J2 a skill is an index into the old skills of the hand's class (LEGACY_CLS)
  if (v[0] === "s") return Number.isInteger(v[1]) && v[1] >= 0 && v[1] < SKILLS.warrior.length;
  if (v[0] === "i") return typeof v[1] === "string" && Object.hasOwn(ITEMS, v[1]) && QS_USE.includes(ITEMS[v[1]].type);
  return false;
}

/**
 * A skill just learned takes the first empty quick slot, unless the player already put it on
 * the bar. Returns the key it went under (1–9), or 0 when it stayed off a full bar.
 */
function qsLearn(ch, i) {
  if (ch.qs.some((v) => v && v[0] === "s" && v[1] === i)) return 0;
  const j = ch.qs.indexOf(null);
  if (j < 0) return 0;
  ch.qs[j] = ["s", i];
  return j + 1;
}

/** Counters kept for achievements (`ch.cnt`; `dim` = 차원 균열 clears). */
const CNT_KEYS = ["elite", "fb", "guard", "evb", "party", "carp", "cook", "rest", "leg", "set", "enh", "rw", "gfound", "evt", "daily", "dim"];
function runeword(g) {
  if (!g.sk || g.ru.length !== g.sk) return null;
  for (const rw of RUNEWORDS) {
    if (rw.seq.length === g.sk && rw.seq.every((r, i) => g.ru[i] === r)) return rw;
  }
  return null;
}
/** The kind of weapon in hand; bare hands fight like the job's weapon, or a dagger. */
const weaponKind = (ch) => (ch.eq.weapon && ITEMS[ch.eq.weapon.id].wk) || (JOBS[ch.job] && JOBS[ch.job].wk[0]) || "dagger";
/** How a character's basic attack lands. */
const armOf = (ch) => WKIND[weaponKind(ch)];
/** Mastery rank (0–5) against one kind of monster. */
function masteryRank(ch, k) {
  const n = ch.mk[k] || 0;
  let r = 0;
  while (r < MASTERY.length && n >= MASTERY[r]) r++;
  return r;
}

/** Everything gear adds up to: base stats, affixes, runes, runewords, set bonuses, legendary powers. */
function gearBonus(ch) {
  const b = { atk: 0, atkp: 0, def: 0, hp: 0, mp: 0, crit: 0, critd: 0, ls: 0, spd: 0, xp: 0, mf: 0, gold: 0 };
  const lg = {}, sets = {};
  const add = (s, v) => { if (s in b) b[s] += v; };
  for (const k of SLOTS) {
    const g = ch.eq[k];
    if (!g || k === "weapon2") continue;
    const base = ITEMS[g.id].base;
    // each enhancement level is worth a tenth of the piece's own stats
    for (const s of Object.keys(base)) add(s, base[s] * (s === "spd" || s === "crit" ? 1 : 1 + 0.1 * g.enh));
    for (const [s, v] of g.af) add(s, v);
    for (const r of g.ru) if (r && RUNES[r]) add(RUNES[r][1], RUNES[r][2]);
    const rw = runeword(g);
    if (rw) for (const [s, v] of rw.add) add(s, v);
    if (g.lg) lg[g.lg] = 1;
    if (g.set) sets[g.set] = (sets[g.set] || 0) + 1;
  }
  for (const id of Object.keys(sets)) {
    for (const [n, list] of SETS[id].bonus) if (sets[id] >= n) for (const [s, v] of list) add(s, v);
  }
  // a worn title and every finished region of the monster collection add their bit
  const ttl = ch.title && ACH_BY[ch.title];
  if (ttl && ttl.bonus) for (const [s, v] of ttl.bonus) add(s, v);
  for (const id of REGIONS) if (regionDone(ch, id)) for (const [s, v] of REGION_BONUS[id]) add(s, v);
  if (lg.greed) b.gold += 60;
  b.lg = lg;
  return b;
}

/** The moment's stats: the sheet's (deriveStats, 45-jobs.js) with buffs, food, scrolls and warmth on top. */
function stats(p) {
  const c = deriveStats(p);
  const now = p.S.now;
  const food = p.food && p.food.until > now ? p.food : null;
  const scr = p.ch.scr || {};
  return {
    mhp: c.mhp, mmp: c.mmp, def: c.def, crit: c.crit, critd: c.critd, ls: c.ls, mf: c.mf, wk: c.wk, mag: c.mag,
    eva: c.eva, aspd: c.aspd, sneak: c.sneak, cdr: c.cdr, mpReg: c.mpReg, burst: c.burst, proc: c.proc, kbr: c.kbr, poise: c.poise, res: c.res,
    xp: c.xp + (food ? food.xp : 0) + (p.warm > now ? p.warmPct : 0) + (scr.xp > now ? ITEMS.sc_xp.pct : 0) + (p.ch.house && p.ch.house.cozy > now ? HOUSE_REST.xp : 0), gold: c.gold, lg: c.lg, arm: c.arm, acd: c.acd,
    atk: Math.round(c.atk0 * (p.atkBuff > now ? 1 + (p.atkBuffK ?? 0.25) : 1) * (food ? 1 + food.atk / 100 : 1) * (scr.atk > now ? 1 + ITEMS.sc_atk.pct / 100 : 1)),
    guard: (scr.def > now ? 1 - ITEMS.sc_def.pct / 100 : 1) * (p.dimWard > now ? 1 - DIM.ward : 1),
    spd: c.spd0 * (p.spdBuff > now ? 1.4 : p.wind > now ? WIND_K : 1) * (p.slowed > now && !(p.giant > now) ? SLOW : 1), spd0: c.spd0,
  };
}

export function exportChar(S, pid) {
  const p = S.players[pid];
  if (!p) return null;
  const ch = p.ch;
  ch.map = p.map; ch.x = Math.round(p.x); ch.y = Math.round(p.y);
  // a runtime instance is never saved: whoever is saved inside one wakes in town (out of a house: at its door)
  if (!Object.hasOwn(MAP_META, p.map)) { const back = homeExit(p.map) || START; ch.map = back.map; ch.x = back.x; ch.y = back.y; }
  ch.hp = p.dead ? 0 : Math.round(p.hp); ch.mp = Math.round(p.mp);
  p.save = false;
  return ch;
}

/**
 * Progress worth more than the 15 s save cycle risks (a quest taken or handed in, an enhancement,
 * a level, a skill, the wardrobe, the warehouse) asks for a save soon; the room batches these.
 */
const SAVE_SOON = new Set(["quest", "bq", "sq", "tut", "daily", "enh", "train", "respec", "starter", "job_change", "wh", "cos_buy", "bag_expand", "house_buy", "house_upgrade", "furn_buy", "furn_place", "furn_pick", "h_dep", "h_wd"]);
const saveSoon = (p) => { p.save = true; };
/** The players whose characters asked to be saved soon, cleared as they are handed out. */
export function takeSaves(S) {
  const out = [];
  for (const pid in S.players) if (S.players[pid].save) { S.players[pid].save = false; out.push(pid); }
  return out;
}

// ───────────────────────────── world ─────────────────────────────

/** The nearest tile to (tx, ty) a player can stand on. */
function freeTile(m, tx, ty) {
  for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = tx + dx, y = ty + dy;
    if (x > 1 && y > 1 && x < m.w - 2 && y < m.h - 2 && m.reach[y * m.w + x]) return [x, y];
  }
  return null;
}
function fireNear(rt, p) {
  for (const f of rt.fires) if (dist(p.x, p.y, f.x, f.y) <= FIRE_R) return f;
  return null;
}
/** The centre of the closest water tile within reach of a fishing line, or null. */
function waterNear(m, p) {
  const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
  let best = null, bd = 34;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.g[y][x] !== "w") continue;
    const d = dist(p.x, p.y, x * T + 8, y * T + 8);
    if (d < bd) { bd = d; best = [x * T + 8, y * T + 8]; }
  }
  return best;
}
/** Stand up, reel in: whatever a player was quietly doing stops. */
function rouse(S, p) {
  cancelRecall(S, p, "귀환이 취소되었습니다.");
  p.sit = false;
  if (p.fish) { p.fish = null; S.maps[p.map].ev.push(["f", p.eid, 0]); }
}
function guildNear(S, p) {
  if (!p.ch.guild) return 0;
  let n = 0;
  for (const pid of Object.keys(S.players)) {
    const o = S.players[pid];
    if (o !== p && o.map === p.map && !o.dead && o.ch.guild === p.ch.guild && dist(o.x, o.y, p.x, p.y) <= PARTY_RANGE) n++;
  }
  return Math.min(3, n);
}

function newMob(S, k, r, sp) {
  return { fix: (sp && sp.el) || 0, ep: sp && sp.elite !== undefined ? sp.elite : 0.08, id: S.nextId++, k, r, x: 0, y: 0, hx: 0, hy: 0, hp: 0, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 0, wx: 0, wy: 0, by: {}, dead: false, respAt: 0, slow: 0, stun: 0, dot: null, castAt: 0, el: 0, temp: false, tr: [], act: null, mv: 0, cn: 0 };
}
/**
 * A channel's world. Maps come alive one at a time (runtime): the town at once, every other
 * place when someone first walks in (or an event needs it). `dims` holds runtime instances.
 */
export function setup() {
  const S = { seed: 20251111, now: 0, last: 0, nextId: 1, players: {}, maps: {}, dims: {}, parties: {}, chat: [], n: 0, evt: null };
  runtime(S, START.map);
  return S;
}
/**
 * The live state of map `id` in world `S`, made on first use: its monsters placed, its camps lit.
 * Same shape for every map, a runtime instance ("dim:<n>", registered first with registerDim) too.
 * Null for a map the world does not have.
 */
export function runtime(S, id) {
  const have = S.maps[id];
  if (have) return have;
  const m = mapOfS(S, id);
  if (!m) return null;
  if (!m.cells) buildCells(m);
  const C = m.cells, nc = C.cw * C.ch;
  const rt = { id, mobs: [], drops: [], ev: [], tele: [], zones: [], pools: [], fires: [], props: [], decoys: [], who: false, n: 0, kc: 0, fb: 0,
    // the cells (80-simulation.js cellPass): awake or not, the monsters each should hold (slots), its last kill, when to look again
    cells: new Uint8Array(nc), slots: [], lastKill: new Array(nc).fill(-1e9), cellAt: 0 };
  for (const [fx, fy] of FIRES[id] || []) {
    const at = freeTile(m, fx, fy);
    if (at) rt.fires.push({ id: S.nextId++, x: at[0] * T + 8, y: at[1] * T + 10, until: 0 });
  }
  // chests, bosses and guardians are there from the start and never sleep
  for (const sp of C.fixed) {
    for (let i = 0; i < sp.n; i++) {
      const mob = newMob(S, sp.k, sp.r, sp);
      placeMob(S, m, mob);
      rt.mobs.push(mob);
    }
  }
  // everything else waits in its cell for someone to come near: one slot per monster, empty until the cell wakes
  for (let c = 0; c < nc; c++) {
    const list = [];
    for (const q of C.spawns[c]) for (let i = 0; i < q.n; i++) list.push({ q, c, mob: null, due: 0, extra: false });
    rt.slots.push(list);
  }
  rt.base = rt.slots.map((l) => l.length);
  S.maps[id] = rt;
  return rt;
}
/** The ids of every map alive in `S` (the world's maps that have woken, and runtime instances), in the order they woke. */
function liveMapIds(S) {
  return Object.keys(S.maps);
}
/**
 * Add a runtime instance to the world: `map` a finalized map (generated, never in MAP_META) under
 * an id "dim:<n>". Its live state is made at once. Returns the instance record.
 */
function registerDim(S, { id, map, party = 0, seed = 0, lv = 1, theme = null, expire = 0 }) {
  if (typeof id !== "string" || !id.startsWith("dim:") || Object.hasOwn(S.dims, id) || Object.hasOwn(MAP_META, id)) return null;
  map.id = id;
  const dim = { id, seed, map, party, theme: theme || map.theme || null, lv, born: S.now, expire, state: "run" };
  S.dims[id] = dim;
  dim.rt = runtime(S, id);
  return dim;
}
/** Close a runtime instance: anyone still inside goes to town, its state and loot are gone. */
function closeDim(S, id) {
  if (!Object.hasOwn(S.dims, id)) return;
  for (const pid of Object.keys(S.players)) { const p = S.players[pid]; if (p.map === id) changeMap(S, p, START.map, START.x, START.y); }
  for (const pid of Object.keys(S.parties)) if (S.parties[pid].dim === id) S.parties[pid].dim = 0;
  delete S.maps[id];
  delete S.dims[id];
  delete FIRES[id];
  delete WP[id];
}

/** What rank does to a monster: 1 is an elite, 2 a hunting ground's field boss. */
const ELITE = [{ hp: 1, atk: 1, xp: 1 }, { hp: 3.5, atk: 1.4, xp: 4 }, { hp: 14, atk: 1.8, xp: 30 }];
const mobMax = (mob) => Math.round(MOBS[mob.k].hp * ELITE[mob.el].hp);

function placeMob(S, m, mob) {
  const [x0, y0, x1, y1] = mob.r;
  for (let i = 0; i < 40; i++) {
    const tx = ri(S, x0, x1), ty = ri(S, y0, y1);
    if (m.reach[ty * m.w + tx]) {
      mob.x = mob.hx = tx * T + 8;
      mob.y = mob.hy = ty * T + 10;
      break;
    }
  }
  readyMob(S, mob);
}
/** A monster standing where it was put, fresh: its rank and traits rolled, at full health. */
function readyMob(S, mob) {
  // now and then an elite spawns: far tougher, far more rewarding — party prey
  // (how often depends on where: deeper chambers and side vaults breed more of them)
  mob.el = mob.fix || (!MOBS[mob.k].boss && !MOBS[mob.k].chest && rnd(S) < mob.ep ? 1 : 0);
  // an elite carries one trait, a guardian two
  mob.tr = mob.el ? rollTraits(S, mob.el) : [];
  mob.hp = mobMax(mob);
  mob.dead = false; mob.tgt = null; mob.by = {}; mob.st = 0; mob.slow = 0; mob.stun = 0; mob.dot = null; mob.act = null; mob.mv = 0; mob.cn = 0;
  mob.wx = mob.x; mob.wy = mob.y;
  mob.castAt = S.now + 3000 + rnd(S) * 3000;
}
/** How far (tiles) a field boss keeps from the waypoint stone and signposts, and from players. */
const FB_CLEAR = 3, FB_AWAY = 6, FB_SCAN = 18, FB_WARN = 1500;
/**
 * Where a boss walks in: a reachable tile near `ax, ay` (tiles) at least `clear` tiles from every
 * waypoint stone and signpost (so it never hides them) and at least `away` tiles from every living
 * player on the map (so it does not land on a low-level hunter's head). The closest such tile
 * wins; on a small or crowded map the best compromise is taken, and failing that the anchor.
 */
function bossSpot(S, m, ax, ay, clear = FB_CLEAR, away = FB_AWAY) {
  const marks = (m.marks || []).filter((k) => k.kind === "waypoint" || k.kind === "sign").map((k) => [k.x, k.y]);
  if (WP[m.id]) marks.push([WP[m.id].x, WP[m.id].y]);
  const folk = [];
  for (const pid in S.players) { const p = S.players[pid]; if (p.map === m.id && !p.dead) folk.push([p.x / T - 0.5, p.y / T - 0.5]); }
  const near = (list, x, y) => { let b = Infinity; for (const [px, py] of list) b = Math.min(b, Math.hypot(px - x, py - y)); return b; };
  let best = null, bestScore = -1;
  for (let r = 0; r <= FB_SCAN; r++) {
    for (let y = ay - r; y <= ay + r; y++) for (let x = ax - r; x <= ax + r; x++) {
      if (Math.max(Math.abs(x - ax), Math.abs(y - ay)) !== r) continue;
      if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1 || !m.reach[y * m.w + x]) continue;
      const dm = near(marks, x, y), dp = near(folk, x, y);
      if (dm >= clear && dp >= away) return [x, y];
      const score = Math.min(dm, clear) / clear + Math.min(dp, away) / away;
      if (score > bestScore) { bestScore = score; best = [x, y]; }
    }
  }
  return best || [ax, ay];
}
/**
 * A hunting ground's field boss walks in near the kill that summoned it (or at the map's own
 * boss spot, if its designer gave one), but clear of the waypoint stone, the signposts and the
 * hunters themselves, standing still for a moment inside a warning ring where it lands.
 */
function spawnFieldBoss(S, rt, x, y) {
  const m = mapOfS(S, rt.id);
  const mob = newMob(S, FIELD_BOSS[rt.id], [0, 0, 0, 0]);
  mob.el = 2; mob.temp = true;
  mob.tr = rollTraits(S, 2);
  const at = m.bossAt || [Math.floor(x / T), Math.floor(y / T)];
  const [tx, ty] = bossSpot(S, m, clamp(at[0], 0, m.w - 1), clamp(at[1], 0, m.h - 1));
  mob.x = mob.hx = mob.wx = tx * T + 8; mob.y = mob.hy = mob.wy = ty * T + 10;
  mob.hp = mobMax(mob);
  mob.castAt = S.now + 4000;
  mob.stun = S.now + FB_WARN;
  rt.mobs.push(mob);
  rt.fb = mob.id;
  rt.kc = 0;
  rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), 40, FB_WARN]);
  rt.ev.push(["r", mob.id]);
  sys(S, `${m.name}에 우두머리 [${MOBS[mob.k].name}]${pp(MOBS[mob.k].name, "이가")} 나타났습니다!`);
}

export function playerCount(S) {
  return S.n;
}

/** Put a loaded character into the world. Returns the player's public entity id. */
export function addPlayer(S, pid, ch) {
  if (S.players[pid]) removePlayer(S, pid);
  migrate(ch);
  // a place that is gone (a closed instance, a map removed from the editor's data) is the town
  if (typeof ch.map !== "string" || !Object.hasOwn(MAP_META, ch.map)) ch.map = START.map;
  const p = {
    S, pid, eid: S.nextId++, ch, map: ch.map, x: ch.x, y: ch.y, dir: 0, aim: AIM_N / 4, hp: 1, mp: 0, dead: false, stc: null,
    cds: [0, 0, 0, 0, 0, 0], atkAt: 0, combo: 0, streak: 0, streakAt: 0, potAt: 0, hitAt: 0, mvAt: S.now, chatAt: 0, fullAt: 0, regenAt: S.now,
    sit: false, fish: null, food: null, warm: 0, warmPct: 0, warmT: 0, emoAt: 0, ginv: null, slowed: 0, burn: null, poison: null,
    atkBuff: 0, atkBuffK: 0.25, spdBuff: 0, grit: 0, gritAt: 0, focus: 0, focusAt: 0, sword: null, dirty: true, sendMap: true, fix: true, gain: [], toast: [], party: 0, pinv: null, recall: null,
  };
  // a place that changed under their feet (the hunting grounds grew): the way in of that same ground
  const here = mapOf(p.map);
  if (!(p.x >= 0 && p.y >= 0) || !canStand(here, p.x, p.y) || !here.reach[Math.floor(p.y / T) * here.w + Math.floor(p.x / T)]) {
    p.x = here.entry[0] * T + 8; p.y = here.entry[1] * T + 10;
    if (!here.safe) toast(p, "지형이 넓어져 입구로 이동했습니다.");
  }
  const st = stats(p);
  p.hp = ch.hp > 0 ? Math.min(ch.hp, st.mhp) : st.mhp;
  p.mp = ch.mp >= 0 ? Math.min(ch.mp, st.mmp) : st.mmp;
  if (ch.hp === 0) { p.map = START.map; p.x = START.x; p.y = START.y; }
  S.players[pid] = p;
  S.n++;
  const rt = runtime(S, p.map);
  rt.n++;
  rt.who = true;
  sys(S, `${ch.name}님이 접속했습니다.`);
  ensureDaily(S, p);
  explore(S, p);
  if (TUT[ch.tut.i] && TUT[ch.tut.i].id === "equip" && ch.eq.weapon && ch.sw) tutStep(S, p, "equip");
  checkAch(S, p);
  return p.eid;
}

/** Take a player out of the world; returns the sheet to persist. */
export function removePlayer(S, pid) {
  const p = S.players[pid];
  if (!p) return null;
  const ch = exportChar(S, pid);
  leaveParty(S, p);
  dropAggro(S, p);
  S.maps[p.map].n--;
  S.maps[p.map].who = true;
  delete S.players[pid];
  S.n--;
  return ch;
}

function dropAggro(S, p) {
  for (const mob of S.maps[p.map].mobs) if (mob.tgt === p.pid) mob.tgt = null;
}

function changeMap(S, p, to, x, y) {
  rouse(S, p);
  dropAggro(S, p);
  S.maps[p.map].n--;
  S.maps[p.map].who = true;
  p.map = to; p.x = x; p.y = y;
  classReset(p, false);
  const rt = runtime(S, to);
  rt.n++;
  rt.who = true;
  p.sendMap = true; p.fix = true;
  explore(S, p);
  sqProgress(S, p, "visit", (g) => g.map === to);
}

function sys(S, m) {
  S.chat.push({ sys: 1, m });
}
function toast(p, m) {
  if (p.toast.length < 6) p.toast.push(m);
}

// ───────────────────────────── parties ─────────────────────────────

function members(S, p) {
  const party = S.parties[p.party];
  if (!party) return [p];
  return party.m.map((pid) => S.players[pid]).filter(Boolean);
}
/** Party members close enough to share in what `p` does (always includes `p`). */
function allies(S, p) {
  return members(S, p).filter((o) => o === p || (o.map === p.map && !o.dead && dist(o.x, o.y, p.x, p.y) <= PARTY_RANGE));
}
function leaveParty(S, p) {
  const party = S.parties[p.party];
  p.party = 0;
  if (!party) return;
  party.m = party.m.filter((pid) => pid !== p.pid);
  S.maps[p.map].who = true;
  const rest = party.m.map((pid) => S.players[pid]).filter(Boolean);
  for (const o of rest) { toast(o, `${p.ch.name}님이 파티를 떠났습니다.`); S.maps[o.map].who = true; }
  if (rest.length < 2) {
    for (const o of rest) { o.party = 0; toast(o, "파티가 해산되었습니다."); }
    delete S.parties[party.id];
  }
}

