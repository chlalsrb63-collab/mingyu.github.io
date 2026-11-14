// ───────────────────────────── charms (주아나의 참 공방) ─────────────────────────────
// docs/design/charms.md. A charm (참) is its own kind of thing, apart from gear: it drops sealed (미감정) in
// the field and from a rift's own chest, 주아나 (town_charm_juana, role "charm") appraises it, and it then
// sits on a board of up to 5 × 5 cells where its shape has to fit. Only charms on the board do anything.
//
// Sheet (v13): ch.charms = { unlocked, openN, intro, fu, kn, freeId, nextUid, placed, pending, rec }
//   unlocked  the board is open (forever: a stat reset does not touch it)
//   openN     cells bought beyond the inner 3 × 3, in CHARM_EXPAND order (0–16)
//   intro     〈빛나는 조각의 자리〉 0 not taken · 1 hunting · 2 done;  fu  the Lv.50 / Lv.90 follow-ups, each 0/1/2
//   kn        kills counted for the quest under way
//   freeId    1 while the one free appraisal is unspent
//   nextUid   the next charm's id (per character, never reused)
//   placed    [{ c: charm, x, y, r }] — anchor (top-left of the turned shape) and quarter turns 0–3
//   pending   one charm from a rift chest opened with a full bag (claimed at 주아나)
//   rec       charms a migration took off a broken board (claimed at 주아나, never put back by themselves)
// A charm in the bag: { id: "charm", n: 1, uid, seal, rv, tier, src, rev: 0 } and, once appraised,
//   rev: 1, g (1 매직 · 2 레어 · 3 전설), sh (shape id), op [[kind, value, arg]], lg (legendary id).
//   `seal` never leaves the server (charmWire); with `rv` (the rule version it was sealed under) and `src`
//   it decides the appraisal, so asking again — or after a reconnect — gives the same charm.

/** The appraisal rules' version: part of every seal's hash. */
const CHARM_V = 1;
const CHARM_SIZE = 5, CHARM_REC_MAX = 60;
/** Monsters more than this many tiers below the hunter give neither charms nor quest kills. */
const CHARM_LOW = 4;
/** The cells bought one at a time after the inner (1,1)–(3,3), in this order. */
const CHARM_EXPAND = [[4, 1], [4, 2], [4, 3], [1, 4], [2, 4], [3, 4], [4, 4], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [2, 0], [3, 0], [4, 0], [0, 0]];
/** The k-th expansion (k cells already bought, 0–15): 2,000 … 36,500 G, 252,000 G in all. */
const charmExpandCost = (k) => 2000 + 800 * k + 100 * k * k;
/** What an appraisal costs, by the tier the charm came from (never by what it turns out to be). */
const charmIdCost = (tier) => Math.round(200 + 12 * tier);
/** Shapes: cells in the base turn, and what a general option is multiplied by. */
const CHARM_SHAPES = {
  pin: { cells: [[0, 0]], k: 1.0, w: 40 },
  bar2: { cells: [[0, 0], [1, 0]], k: 1.7, w: 25 },
  bar3: { cells: [[0, 0], [1, 0], [2, 0]], k: 2.3, w: 12 },
  elbow: { cells: [[0, 0], [0, 1], [1, 1]], k: 2.3, w: 13 },
  tile2: { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], k: 2.9, w: 10 },
};
const CHARM_SHAPE_IDS = Object.keys(CHARM_SHAPES);
const CHARM_GRADE = ["", "매직", "레어", "전설"];
/**
 * Where a charm comes from (wire `src`): the chance of a sealed charm, the odds of 매직 / 레어 / 전설 once
 * one fell (percent), and the chance of a 참틀 확장못. 4 is 주아나's first charm (always a 매직 1 × 1).
 */
const CHARM_SRC = [
  { name: "필드 사냥", p: 0.006, g: [85, 14.8, 0.2], nail: 0.0005 },
  { name: "필드 정예", p: 0.024, g: [79, 20.65, 0.35], nail: 0.002 },
  { name: "우두머리·수문장", p: 0.12, g: [67, 32.5, 0.5], nail: 0.01 },
  { name: "차원 균열 상자", p: 0.4, g: [60, 39, 1], nail: 0.08 },
  { name: "주아나의 의뢰", p: 0, g: [100, 0, 0], nail: 0 },
];
/**
 * General options on a 1 × 1 charm: [lo, hi] before the shape's coefficient, `pct` for tenths of a percent
 * (whole numbers are floored), `cap` for the whole board, `w` how often it is rolled.
 *   st a stat (arg: its key, added to the stat after its soft cap — combat only) · hp · mp · atk (after gear)
 *   skd one weapon active's damage % (arg: skill id) · skh one healing skill's recovery % (arg: skill id)
 */
const CHARM_OPT = {
  st: { name: "능력치", lo: 1, hi: 2, cap: 8, w: 30 },
  hp: { name: "HP", lo: 8, hi: 14, cap: 120, w: 18 },
  mp: { name: "MP", lo: 4, hi: 7, cap: 60, w: 14 },
  atk: { name: "공격력", lo: 1, hi: 2, cap: 30, w: 14 },
  skd: { name: "스킬 피해", lo: 2, hi: 3, pct: 1, cap: 12, w: 18 },
  skh: { name: "스킬 회복량", lo: 2, hi: 3, pct: 1, cap: 12, w: 6 },
};
const CHARM_OPT_IDS = Object.keys(CHARM_OPT);
/** The skills an option can name: every weapon active (damage), every skill that heals its caster (recovery). */
const CHARM_SKD = SKILL_ORDER.filter((id) => SKILL[id].kind === "a");
const CHARM_SKH = SKILL_ORDER.filter((id) => SKILL[id].heal > 0);
/**
 * Legendary charms: a fixed shape, one power, one general option. Only one power works on a board (the
 * first placed). `off`: not dropped yet — 수호의 매듭참 waits for a spear or book skill that heals the party.
 */
const CHARM_LEGEND = {
  echo: { name: "메아리 뿔참", shape: "bar3", sk: "rend", k: 0.18, tail: 0.3, cd: 12000,
    desc: "대검 [대지 가르기]의 파동 끝 30%에 처음 맞은 적에게 그 적중 피해의 18%를 한 번 더 준다. 시전당 1회, 12초마다." },
  knot: { name: "수호의 매듭참", shape: "elbow", off: 1, k: 0.04, ms: 4000, cd: 18000,
    desc: "창이나 마도서의 파티 회복 스킬로 HP 50% 미만의 아군을 회복하면 그 아군에게 최대 HP 4%의 보호막을 4초 준다. 18초마다. (아직 열리지 않음)" },
  lens: { name: "길별의 렌즈참", shape: "tile2", sk: "pierce", k: 0.15, ms: 4000, cd: 14000,
    desc: "활 [관통 화살]이 두 번째 표적을 맞히면 그 표적에 4초간 표식을 남긴다. 표식 있는 적에게 하는 다음 기본 공격 1회의 피해 +15%. 14초마다." },
};
const CHARM_LG_LIVE = Object.keys(CHARM_LEGEND).filter((id) => !CHARM_LEGEND[id].off);
/** 주아나's commissions: the first opens the board; the two after it each bring a 참틀 확장못. */
const CHARM_QUESTS = [
  { id: "intro", lv: 30, n: 8, title: "빛나는 조각의 자리", text: "내 수준에 맞는 사냥터의 몬스터 8마리를 잡고 주아나에게 돌아가세요.", reward: "참 보드 3×3 · 미감정 참 1개 · 첫 감정 무료" },
  { id: "f50", lv: 50, n: 8, title: "넓어지는 틀", text: "내 수준에 맞는 사냥터의 몬스터 8마리를 잡고 주아나에게 돌아가세요.", reward: "참틀 확장못 1개" },
  { id: "f90", lv: 90, n: 8, title: "마지막 못 자리", text: "내 수준에 맞는 사냥터의 몬스터 8마리를 잡고 주아나에게 돌아가세요.", reward: "참틀 확장못 1개" },
];
const CHARM_SAY = {
  accept: "볼주머니에 넣기엔 제법 무거운 조각이네요. 빛을 품을 자리를 같이 찾아봐요.",
  appraise: "여기, 테두리에 무늬가 보여요. 돌려 보면 작은 빈자리에도 맞겠어요.",
};

const charmsEmpty = () => ({ unlocked: false, openN: 0, intro: 0, fu: [0, 0], kn: 0, freeId: 0, nextUid: 1, placed: [], pending: null, rec: [] });
const isCharm = (s) => !!s && s.id === "charm";

// ── shapes and the board

/** The cells of shape `sh` after `r` quarter turns, moved back to the origin, in reading order. */
function charmCells(sh, r) {
  let cells = CHARM_SHAPES[sh].cells.map(([x, y]) => [x, y]);
  for (let i = 0; i < (r & 3); i++) cells = cells.map(([x, y]) => [-y, x]);
  const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
/** The open cells of a board with `openN` expansions, as a set of "x,y" (nothing before the board is unlocked). */
function charmOpen(cs) {
  const out = new Set();
  if (!cs.unlocked) return out;
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) out.add(`${x},${y}`);
  for (let i = 0; i < cs.openN; i++) out.add(CHARM_EXPAND[i].join(","));
  return out;
}
/** Why shape `sh` cannot lie at (x, y) turned `r` ("" when it can); `skip` is a charm whose own cells do not count. */
function charmFit(cs, sh, x, y, r, skip) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(r) || r < 0 || r > 3) return "잘못된 자리입니다";
  const open = charmOpen(cs), used = new Set();
  for (const e of cs.placed) if (e.c.uid !== skip) for (const [cx, cy] of charmCells(e.c.sh, e.r)) used.add(`${e.x + cx},${e.y + cy}`);
  const at = charmCells(sh, r).map(([cx, cy]) => [x + cx, y + cy]);
  // (the whole shape is looked at for each reason in turn: off the board, then locked, then taken)
  if (at.some(([px, py]) => px < 0 || py < 0 || px >= CHARM_SIZE || py >= CHARM_SIZE)) return "보드 밖입니다";
  if (at.some(([px, py]) => !open.has(`${px},${py}`))) return "잠긴 칸입니다";
  if (at.some(([px, py]) => used.has(`${px},${py}`))) return "다른 참이 놓인 칸입니다";
  return "";
}

// ── sealing and appraising

/** A roll of the charm stream: apart from the world's own dice (so nothing else in a seeded run moves). */
function charmRoll(S, p, salt) {
  S.chN = (S.chN | 0) + 1;
  // (the hash only seeds: the generator does the mixing, so counters next to each other do not roll alike)
  return rnd({ seed: strHash(`${S.now}:${p.eid}:${p.ch.name}:${salt}:${S.chN}`) | 0 });
}
/** A sealed charm, not yet anyone's (no uid): from source `src` at world tier `tier`. */
function charmSeal(S, p, src, tier) {
  S.chN = (S.chN | 0) + 1;
  return { seal: Math.floor(rnd({ seed: strHash(`seal:${S.now}:${p.pid}:${p.ch.name}:${p.ch.charms.nextUid}:${S.chN}`) | 0 }) * 4294967296) >>> 0, rv: CHARM_V, tier: clamp(Math.round(tier) || 1, 1, TIER_MAX), src };
}
/** Make a sealed charm this character's own (the next uid): the instance that goes into the bag. */
function charmOwn(ch, c) {
  const out = { id: "charm", n: 1, uid: ch.charms.nextUid++, seal: c.seal >>> 0, rv: c.rv | 0 || CHARM_V, tier: c.tier, src: c.src, rev: 0 };
  if (c.fx) out.fx = 1;
  return out;
}
/** One general option for a shape, not one of `have`: [kind, value, arg]. */
function charmOption(box, sh, have) {
  const total = CHARM_OPT_IDS.reduce((n, k) => n + CHARM_OPT[k].w, 0);
  for (let tries = 0; ; tries++) {
    let roll = rnd(box) * total, kind = CHARM_OPT_IDS[0];
    for (const k of CHARM_OPT_IDS) { if (roll < CHARM_OPT[k].w) { kind = k; break; } roll -= CHARM_OPT[k].w; }
    const o = CHARM_OPT[kind];
    const arg = kind === "st" ? ST_ORDER[ri(box, 0, ST_ORDER.length - 1)] : kind === "skd" ? CHARM_SKD[ri(box, 0, CHARM_SKD.length - 1)] : kind === "skh" ? CHARM_SKH[ri(box, 0, CHARM_SKH.length - 1)] : "";
    const base = o.pct ? ri(box, o.lo * 10, o.hi * 10) / 10 : ri(box, o.lo, o.hi);
    if (tries < 40 && have.some((h) => h[0] === kind && h[2] === arg)) continue;
    const v = base * CHARM_SHAPES[sh].k;
    return [kind, o.pct ? Math.round(v * 10) / 10 : Math.floor(v), arg];
  }
}
/** What a seal holds: { g, sh, op, lg }. The same for the same seal, rule version and source, every time. */
function charmAppraise(c) {
  const box = { seed: strHash(`charm:${c.seal >>> 0}:${c.rv | 0}:${c.src | 0}`) | 0 };
  const odds = (CHARM_SRC[c.src] || CHARM_SRC[0]).g;
  const x = rnd(box) * 100, pick = rnd(box);
  let g = x < odds[0] ? 1 : x < odds[0] + odds[1] ? 2 : 3, sh = "pin", lg = "";
  if (c.fx) g = 1;
  else if (g === 3 && CHARM_LG_LIVE.length) { lg = CHARM_LG_LIVE[Math.floor(pick * CHARM_LG_LIVE.length)]; sh = CHARM_LEGEND[lg].shape; }
  else {
    if (g === 3) g = 2;
    const total = CHARM_SHAPE_IDS.reduce((n, k) => n + CHARM_SHAPES[k].w, 0);
    let roll = pick * total;
    for (const k of CHARM_SHAPE_IDS) { if (roll < CHARM_SHAPES[k].w) { sh = k; break; } roll -= CHARM_SHAPES[k].w; }
  }
  const op = [];
  for (let n = g === 2 ? 2 : 1; n > 0; n--) op.push(charmOption(box, sh, op));
  return { g, sh, op, lg };
}
const charmName = (c) => (!c.rev ? "미감정 참" : c.lg ? CHARM_LEGEND[c.lg].name : `${CHARM_GRADE[c.g]} 참`);
/** What the owner's client is told of a charm: never the seal, and of a sealed one only where it came from. */
function charmWire(c) {
  if (!c.rev) return { id: "charm", n: 1, uid: c.uid, src: c.src, tier: c.tier, rev: 0, cost: charmIdCost(c.tier) };
  const out = { id: "charm", n: 1, uid: c.uid, src: c.src, tier: c.tier, rev: 1, g: c.g, sh: c.sh, op: c.op };
  if (c.lg) out.lg = c.lg;
  return out;
}
/** The bag as the client sees it (selfPayload): everything as it is, charms through charmWire. */
const charmBag = (inv) => (inv.some(isCharm) ? inv.map((s) => (isCharm(s) ? charmWire(s) : s)) : inv);

// ── the sheet

/** A saved charm made whole, or null when it cannot be one (no seal, no uid). */
function charmFix(g) {
  if (!isObj(g) || !Number.isInteger(g.uid) || g.uid < 1 || !num(g.seal)) return null;
  const out = { id: "charm", n: 1, uid: g.uid, seal: g.seal >>> 0, rv: clamp(g.rv | 0, 1, CHARM_V), tier: clamp(g.tier | 0, 1, TIER_MAX), src: clamp(g.src | 0, 0, CHARM_SRC.length - 1), rev: g.rev ? 1 : 0 };
  if (g.fx) out.fx = 1;
  if (!out.rev) return out;
  // an appraised charm is what its seal says: anything else on the sheet is put right
  const a = charmAppraise(out);
  out.g = a.g; out.sh = a.sh; out.op = a.op;
  if (a.lg) out.lg = a.lg;
  return out;
}
/**
 * The charm fields of a sheet being migrated (v13; idempotent, after the bag, the warehouse and the house
 * are clean). Every uid is one charm: a second with the same uid, a charm on a cell that is locked, taken
 * or off the board, one that is still sealed on the board, and any that strayed into the warehouse or a
 * house chest go to the recovery queue (`rec`) with a uid of their own — never back onto the board.
 */
function charmsClean(ch) {
  const old = isObj(ch.charms) ? ch.charms : {};
  const cs = charmsEmpty();
  cs.unlocked = !!old.unlocked;
  cs.openN = cs.unlocked ? clamp(old.openN | 0, 0, CHARM_EXPAND.length) : 0;
  cs.intro = cs.unlocked ? 2 : clamp(old.intro | 0, 0, 1);
  cs.fu = [0, 1].map((i) => (cs.unlocked && Array.isArray(old.fu) ? clamp(old.fu[i] | 0, 0, 2) : 0));
  cs.kn = clamp(old.kn | 0, 0, 999);
  cs.freeId = old.freeId ? 1 : 0;
  const seen = new Set(), stray = [];
  let top = 0;
  const all = [];
  const take = (c) => { if (seen.has(c.uid)) return false; seen.add(c.uid); top = Math.max(top, c.uid); return true; };
  // the bag first: what is carried is kept where it is
  const inv = [];
  for (const s of ch.inv) {
    if (!isCharm(s)) { inv.push(s); continue; }
    all.push(s);
    if (take(s)) inv.push(s); else stray.push(s);
  }
  ch.inv = inv;
  for (const e of Array.isArray(old.placed) ? old.placed : []) {
    const c = isObj(e) ? charmFix(e.c) : null;
    if (!c) continue;
    all.push(c);
    if (c.rev && !seen.has(c.uid) && !charmFit(cs, c.sh, e.x, e.y, e.r, 0)) { take(c); cs.placed.push({ c, x: e.x, y: e.y, r: e.r }); }
    else stray.push(c);
  }
  const pend = charmFix(old.pending);
  if (pend) { all.push(pend); if (take(pend)) cs.pending = pend; else stray.push(pend); }
  for (const g of Array.isArray(old.rec) ? old.rec : []) {
    const c = charmFix(g);
    if (!c) continue;
    all.push(c);
    if (take(c)) cs.rec.push(c); else stray.push(c);
  }
  // charms never live in the warehouse or a house chest
  const sweep = (list) => list.filter((s) => { if (!isCharm(s)) return true; const c = charmFix(s); if (c) { all.push(c); stray.push(c); } return false; });
  if (isObj(ch.wh) && Array.isArray(ch.wh.items)) ch.wh.items = sweep(ch.wh.items);
  if (isObj(ch.house) && Array.isArray(ch.house.storage)) ch.house.storage = sweep(ch.house.storage);
  for (const c of all) top = Math.max(top, c.uid);
  cs.nextUid = Math.max(1, old.nextUid | 0, top + 1);
  for (const c of stray) {
    if (seen.has(c.uid)) c.uid = cs.nextUid++;
    seen.add(c.uid);
    if (cs.rec.length < CHARM_REC_MAX) cs.rec.push(c);
  }
  ch.charms = cs;
}

// ── what the board adds

/**
 * The board's total: stats (after their soft caps), HP, MP, attack, per-skill damage and recovery percent —
 * each held to its cap — and the one legendary power at work (the first placed).
 */
function charmSum(ch) {
  const out = { st: Object.fromEntries(ST_ORDER.map((k) => [k, 0])), hp: 0, mp: 0, atk: 0, skd: {}, skh: {}, lg: "" };
  const cs = ch.charms;
  if (!cs || !cs.placed.length) return out;
  for (const e of cs.placed) {
    if (e.c.lg && !out.lg && !CHARM_LEGEND[e.c.lg].off) out.lg = e.c.lg;
    for (const [kind, v, arg] of e.c.op) {
      const cap = CHARM_OPT[kind].cap;
      if (kind === "st") out.st[arg] = Math.min(cap, out.st[arg] + v);
      else if (kind === "skd" || kind === "skh") out[kind][arg] = Math.min(cap, Math.round(((out[kind][arg] || 0) + v) * 10) / 10);
      else out[kind] = Math.min(cap, out[kind] + v);
    }
  }
  return out;
}
/** × a skill's damage, × a skill's healing, from the board (castSkill). */
const charmSkd = (p, id) => 1 + (deriveStats(p).cm.skd[id] || 0) / 100;
const charmSkh = (p, id) => 1 + (deriveStats(p).cm.skh[id] || 0) / 100;
/** Is legendary power `id` at work for `p`, and off its inner cooldown? (The cooldown lives with the player, not the board.) */
function charmReady(S, p, id) {
  if (deriveStats(p).cm.lg !== id) return false;
  return !(p.chCd && p.chCd[id] > S.now);
}
const charmUsed = (S, p, id) => { (p.chCd || (p.chCd = {}))[id] = S.now + CHARM_LEGEND[id].cd; };

// ── legendary powers (called from the hit itself: 57-weapon-skills.js rend, 45-jobs.js shotTick, 50 basicAttack)

/** 메아리 뿔참: of the monsters a 대지 가르기 wave of length `wl` is about to strike, the first in its last 30% — or null. */
function charmEchoPick(S, p, list, ux, uy, wl) {
  if (!charmReady(S, p, "echo")) return null;
  const from = wl * (1 - CHARM_LEGEND.echo.tail);
  let best = null, at = 0;
  for (const o of list) {
    const along = (o.x - p.x) * ux + (o.y - p.y) * uy;
    if (along < from) continue;
    if (!best || along < at || (along === at && o.id < best.id)) { best = o; at = along; }
  }
  return best;
}
/**
 * … and once the wave has struck it for `dmg`: 18% of that again, as plain damage (no crit, no leech, no
 * mastery, nothing that could set off anything else), and the 12 s wait starts.
 */
function charmEchoHit(S, rt, p, mob, dmg) {
  if (mob.dead || !(dmg > 0)) return;
  charmUsed(S, p, "echo");
  rt.ev.push(["cm", p.eid, 0, Math.round(mob.x), Math.round(mob.y - 6)]);
  // (`dmg` is what reached the monster: a rift's toughness is already in it)
  const hk = mob.hk; mob.hk = 0;
  dealMob(S, rt, mob, p, Math.max(1, Math.round(dmg * CHARM_LEGEND.echo.k)), 0);
  mob.hk = hk;
}
/** 길별의 렌즈참: a 관통 화살 has struck its second target, which lives: it is marked for 4 s. */
function charmLens(S, rt, p, mob) {
  if (mob.dead || !charmReady(S, p, "lens")) return;
  charmUsed(S, p, "lens");
  mob.cmk = { pid: p.pid, until: S.now + CHARM_LEGEND.lens.ms };
  rt.ev.push(["cm", p.eid, 1, Math.round(mob.x), Math.round(mob.y - 6), mob.id]);
}
/** × the marker's next basic attack on a marked monster (the mark is spent by it). */
function charmMarkK(S, rt, p, mob) {
  const mk = mob.cmk;
  if (!mk || mk.pid !== p.pid) return 1;
  mob.cmk = null;
  if (mk.until <= S.now) return 1;
  rt.ev.push(["cm", p.eid, 2, Math.round(mob.x), Math.round(mob.y - 6), mob.id]);
  return 1 + CHARM_LEGEND.lens.k;
}

// ── finding them

/** Does a kill of `mob` count for charms (drops, 주아나's quests) for `p`? A field monster no more than 4 tiers below. */
function charmPrey(rt, mob, p) {
  const d = MOBS[mob.k];
  if (mob.dim || mob.evt || d.chest || d.still || !Object.hasOwn(MAP_META, rt.id)) return false;
  return d.lv >= toTier(p.ch.lvl) - CHARM_LOW;
}
/** The quest under way or next in line: its index in CHARM_QUESTS and its state (0 not taken, 1 hunting), or null when all are done. */
function charmQuest(cs) {
  if (cs.intro < 2) return { i: 0, st: cs.intro };
  for (let i = 0; i < 2; i++) if (cs.fu[i] < 2) return { i: i + 1, st: cs.fu[i] };
  return null;
}
/** A kill credited to `p` (killMob, once per looter): the quest's count, then the dice for a sealed charm and a 확장못. */
function charmKill(S, rt, mob, p) {
  const ch = p.ch, cs = ch.charms;
  if (!charmPrey(rt, mob, p)) return;
  const q = charmQuest(cs);
  if (q && q.st === 1 && cs.kn < CHARM_QUESTS[q.i].n) {
    cs.kn++;
    p.dirty = true;
    if (cs.kn >= CHARM_QUESTS[q.i].n) toast(p, `의뢰 [${CHARM_QUESTS[q.i].title}] 달성! 주아나에게 돌아가세요.`);
  }
  if (!cs.unlocked) return;
  const d = MOBS[mob.k], src = d.boss || mob.el === 2 ? 2 : mob.el === 1 ? 1 : 0, row = CHARM_SRC[src];
  const drop = (o) => rt.drops.push({ id: S.nextId++, g: null, n: 1, q: 0, x: mob.x + Math.round(charmRoll(S, p, "x") * 20 - 10), y: mob.y + Math.round(charmRoll(S, p, "y") * 14 - 6), own: p.pid, freeAt: S.now + 20000, dieAt: S.now + 60000, ...o });
  if (charmRoll(S, p, "f") < row.p) drop({ it: "charm", c: charmSeal(S, p, src, d.lv) });
  if (charmRoll(S, p, "n") < row.nail) drop({ it: "charm_nail" });
}
/** Picking a sealed charm up off the ground (pickUp): one free slot, and it becomes the picker's own. */
function charmPick(S, p, dr) {
  const ch = p.ch;
  if (ch.inv.length >= bagCap(ch)) { bagFull(S, p); return false; }
  ch.inv.push(charmOwn(ch, dr.c));
  p.gain.push(["item", "charm", 1, 0]);
  if (!ch.charms.unlocked) toast(p, "미감정 참을 주웠습니다. 버드나무광장의 주아나가 감정해 줍니다.");
  p.dirty = true;
  saveSoon(p);
  return true;
}
/**
 * A rift's own chest (dimChest), before it opens: with a charm already waiting at 주아나 and no room for
 * both the chest's gear and another charm, the chest stays shut (true) and says why.
 */
function charmChestHold(S, p) {
  const ch = p.ch, cs = ch.charms;
  if (!cs.unlocked || !cs.pending || bagCap(ch) - ch.inv.length >= 2) return false;
  if (!(S.now - (p.chNag || -1e9) < 4000)) { p.chNag = S.now; toast(p, "주아나의 보류함에 참이 있고 가방이 가득 찼습니다 — 가방을 두 칸 비워야 보상 상자를 열 수 있습니다."); }
  return true;
}
/** … and once it has paid out: maybe a sealed charm (into the bag, else the one-charm box at 주아나), maybe a 확장못. */
function charmChest(S, dim, p) {
  const ch = p.ch, cs = ch.charms, row = CHARM_SRC[3];
  if (!cs.unlocked) return;
  if (charmRoll(S, p, "d") < row.p) {
    const c = charmOwn(ch, charmSeal(S, p, 3, dim.lv));
    if (ch.inv.length < bagCap(ch)) { ch.inv.push(c); p.gain.push(["item", "charm", 1, 0]); }
    else if (!cs.pending) { cs.pending = c; toast(p, "가방이 가득 차 미감정 참을 주아나가 맡아 두었습니다. 버드나무광장에서 찾아가세요."); }
    p.dirty = true;
  }
  if (charmRoll(S, p, "dn") < row.nail) {
    if (addItem(ch, "charm_nail", 1)) p.gain.push(["item", "charm_nail", 1, 0]);
    else dim.rt.drops.push({ id: S.nextId++, it: "charm_nail", g: null, n: 1, q: 0, x: dim.chest.x, y: dim.chest.y + 8, own: p.pid, freeAt: S.now + 20000, dieAt: S.now + 60000 });
    p.dirty = true;
  }
}

// ── actions

const CHARM_ACTS = ["charm_quest", "charm_id", "charm_place", "charm_move", "charm_remove", "charm_expand", "charm_claim", "charm_destroy"];
/** Charms and 확장못 keep to their own ways: no shop, warehouse or house chest takes them ("" when the action is none of those). */
function charmGuard(ch, a) {
  if (a.t !== "sell" && a.t !== "h_dep" && !(a.t === "wh" && a.a === "put")) return "";
  const s = Number.isInteger(a.s) ? ch.inv[a.s] : null;
  if (isCharm(s)) return a.t === "sell" ? "참은 팔 수 없습니다" : "참은 맡길 수 없습니다";
  if (a.t === "sell" && s && s.id === "charm_nail") return "참틀 확장못은 팔 수 없습니다";
  return "";
}
const charmInBag = (ch, uid) => (Number.isInteger(uid) ? ch.inv.findIndex((s) => isCharm(s) && s.uid === uid) : -1);
const charmOnBoard = (cs, uid) => (Number.isInteger(uid) ? cs.placed.findIndex((e) => e.c.uid === uid) : -1);
const charmTown = (p) => !!mapOfS(p.S, p.map).safe;

function charmValidate(S, p, a) {
  const ch = p.ch, cs = ch.charms;
  switch (a.t) {
    case "charm_quest": {
      if (!npcNear(p, "charm")) return bad("주아나가 너무 멉니다");
      const q = charmQuest(cs);
      if (!q) return bad("주아나의 의뢰를 모두 마쳤습니다");
      const def = CHARM_QUESTS[q.i];
      if (a.a === "accept") {
        if (q.st !== 0) return bad("이미 진행 중입니다");
        return ch.lvl >= def.lv ? OK : bad(`Lv.${def.lv}부터 받을 수 있는 의뢰입니다`);
      }
      if (a.a === "done") {
        if (q.st !== 1 || cs.kn < def.n) return bad("아직 의뢰를 마치지 못했습니다");
        if (q.i === 0 ? ch.inv.length >= bagCap(ch) : !canAdd(ch, "charm_nail", 1)) return bad("가방을 비우고 다시 오세요");
        return OK;
      }
      return bad("잘못된 요청입니다");
    }
    case "charm_id": {
      const c = ch.inv[charmInBag(ch, a.uid)];
      if (!c) return bad("가방에 없는 참입니다");
      if (c.rev) return bad("이미 감정한 참입니다");
      if (!npcNear(p, "charm")) return bad("주아나가 너무 멉니다");
      if (!cs.freeId && ch.gold < charmIdCost(c.tier)) return bad(`골드가 부족합니다 (${gStr(charmIdCost(c.tier))}G 필요)`);
      return OK;
    }
    case "charm_place": {
      if (!cs.unlocked) return bad("아직 참 보드가 없습니다");
      const c = ch.inv[charmInBag(ch, a.uid)];
      if (!c) return bad("가방에 없는 참입니다");
      if (!c.rev) return bad("감정하지 않은 참은 놓을 수 없습니다");
      if (!charmTown(p)) return bad("참 보드는 마을에서만 바꿀 수 있습니다");
      const why = charmFit(cs, c.sh, a.x, a.y, a.r, 0);
      return why ? bad(why) : OK;
    }
    case "charm_move": {
      const e = cs.placed[charmOnBoard(cs, a.uid)];
      if (!e) return bad("보드에 없는 참입니다");
      if (!charmTown(p)) return bad("참 보드는 마을에서만 바꿀 수 있습니다");
      if (e.x === a.x && e.y === a.y && e.r === a.r) return bad("이미 그 자리에 있습니다");
      const why = charmFit(cs, e.c.sh, a.x, a.y, a.r, e.c.uid);
      return why ? bad(why) : OK;
    }
    case "charm_remove":
      if (charmOnBoard(cs, a.uid) < 0) return bad("보드에 없는 참입니다");
      if (!charmTown(p)) return bad("참 보드는 마을에서만 바꿀 수 있습니다");
      return ch.inv.length < bagCap(ch) ? OK : bad("가방이 가득 찼습니다");
    case "charm_expand": {
      if (!cs.unlocked) return bad("아직 참 보드가 없습니다");
      if (cs.openN >= CHARM_EXPAND.length) return bad("참 보드를 모두 열었습니다");
      // `k`: the expansion being bought — a request sent twice buys one cell, not two
      if (a.k !== cs.openN) return bad("이미 확장한 칸입니다");
      if (!npcNear(p, "charm")) return bad("주아나가 너무 멉니다");
      if (countItem(ch, "charm_nail") < 1) return bad("참틀 확장못이 없습니다");
      const cost = charmExpandCost(cs.openN);
      return ch.gold < cost ? bad(`골드가 부족합니다 (${gStr(cost)}G 필요)`) : OK;
    }
    case "charm_claim":
      if (!cs.pending && !cs.rec.length) return bad("맡겨 둔 참이 없습니다");
      if (!npcNear(p, "charm")) return bad("주아나가 너무 멉니다");
      return ch.inv.length < bagCap(ch) ? OK : bad("가방이 가득 찼습니다");
    case "charm_destroy":
      if (charmInBag(ch, a.uid) < 0) return bad("가방에 없는 참입니다");
      return a.ok === 1 ? OK : bad("참을 부수려면 확인이 필요합니다");
    default: return bad("알 수 없는 행동");
  }
}

function charmApply(S, p, a) {
  const ch = p.ch, cs = ch.charms;
  switch (a.t) {
    case "charm_quest": {
      const q = charmQuest(cs), def = CHARM_QUESTS[q.i];
      const set = (v) => { if (q.i === 0) cs.intro = v; else cs.fu[q.i - 1] = v; };
      if (a.a === "accept") {
        set(1); cs.kn = 0;
        toast(p, `주아나: “${CHARM_SAY.accept}”`);
        toast(p, `의뢰 [${def.title}] — ${def.text}`);
        break;
      }
      set(2); cs.kn = 0;
      if (q.i === 0) {
        cs.unlocked = true; cs.freeId = 1;
        const c = charmOwn(ch, charmSeal(S, p, 4, Math.floor(toTier(ch.lvl))));
        c.fx = 1;
        ch.inv.push(c);
        p.gain.push(["item", "charm", 1, 0]);
        toast(p, "참 보드(3×3)가 열렸습니다! 미감정 참 1개를 받았습니다 — 첫 감정은 무료입니다.");
      } else {
        addItem(ch, "charm_nail", 1);
        p.gain.push(["item", "charm_nail", 1, 0]);
        toast(p, `의뢰 [${def.title}] 완료 — [참틀 확장못] 1개를 받았습니다.`);
      }
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      break;
    }
    case "charm_id": {
      const c = ch.inv[charmInBag(ch, a.uid)], cost = cs.freeId ? 0 : charmIdCost(c.tier);
      if (cs.freeId) cs.freeId = 0; else ch.gold -= cost;
      const r = charmAppraise(c);
      c.rev = 1; c.g = r.g; c.sh = r.sh; c.op = r.op;
      if (r.lg) c.lg = r.lg;
      toast(p, `주아나: “${CHARM_SAY.appraise}”`);
      toast(p, `감정 결과: [${charmName(c)}]${cost ? ` (-${gStr(cost)}G)` : " (무료)"}`);
      if (c.g === 3) sys(S, `${ch.name}님이 전설 참 [${charmName(c)}]${pp(charmName(c), "을를")} 감정받았습니다!`);
      break;
    }
    case "charm_place": {
      const i = charmInBag(ch, a.uid), c = ch.inv[i];
      ch.inv.splice(i, 1);
      cs.placed.push({ c, x: a.x, y: a.y, r: a.r });
      afterGear(S, p);
      break;
    }
    case "charm_move": {
      const e = cs.placed[charmOnBoard(cs, a.uid)];
      e.x = a.x; e.y = a.y; e.r = a.r;
      break;
    }
    case "charm_remove": {
      const i = charmOnBoard(cs, a.uid), e = cs.placed[i];
      cs.placed.splice(i, 1);
      ch.inv.push(e.c);
      afterGear(S, p);
      break;
    }
    case "charm_expand": {
      const cost = charmExpandCost(cs.openN), cell = CHARM_EXPAND[cs.openN];
      takeItem(ch, "charm_nail", 1);
      ch.gold -= cost;
      cs.openN++;
      toast(p, `참 보드의 (${cell[0]}, ${cell[1]}) 칸을 열었습니다. (-${gStr(cost)}G, 확장못 1개)`);
      break;
    }
    case "charm_claim": {
      let n = 0;
      const room = () => ch.inv.length < bagCap(ch);
      if (cs.pending && room()) { ch.inv.push(cs.pending); cs.pending = null; n++; }
      while (cs.rec.length && room()) { ch.inv.push(cs.rec.shift()); n++; }
      p.gain.push(["item", "charm", n, 0]);
      const left = (cs.pending ? 1 : 0) + cs.rec.length;
      toast(p, `맡겨 둔 참 ${n}개를 받았습니다.${left ? ` 가방이 가득 차 ${left}개가 남았습니다.` : ""}`);
      break;
    }
    case "charm_destroy": {
      const i = charmInBag(ch, a.uid), c = ch.inv[i];
      ch.inv.splice(i, 1);
      toast(p, `[${charmName(c)}]${pp(charmName(c), "을를")} 부쉈습니다.`);
      break;
    }
  }
  p.dirty = true;
  saveSoon(p);
}

// ── what the client is told

/** `self.charms`: the board, what waits at 주아나, the quest, the totals and the power at work. */
function charmSelf(p) {
  const ch = p.ch, cs = ch.charms, q = charmQuest(cs), cm = deriveStats(p).cm;
  const lg = cs.placed.find((e) => e.c.lg);
  const sk = cm.lg && CHARM_LEGEND[cm.lg].sk ? SKILL[CHARM_LEGEND[cm.lg].sk] : null;
  return {
    un: cs.unlocked ? 1 : 0, openN: cs.openN, open: [...charmOpen(cs)].map((k) => k.split(",").map(Number)),
    next: cs.unlocked && cs.openN < CHARM_EXPAND.length ? { k: cs.openN, cell: CHARM_EXPAND[cs.openN], cost: charmExpandCost(cs.openN), nail: countItem(ch, "charm_nail") } : null,
    free: cs.freeId,
    placed: cs.placed.map((e) => ({ c: charmWire(e.c), x: e.x, y: e.y, r: e.r })),
    pending: cs.pending ? charmWire(cs.pending) : null, rec: cs.rec.map(charmWire),
    quest: q ? { i: q.i, st: q.st, n: cs.kn, need: CHARM_QUESTS[q.i].n, lv: CHARM_QUESTS[q.i].lv, ok: ch.lvl >= CHARM_QUESTS[q.i].lv ? 1 : 0 } : null,
    sum: { st: ST_ORDER.map((k) => cm.st[k]), hp: cm.hp, mp: cm.mp, atk: cm.atk, skd: cm.skd, skh: cm.skh },
    // the power at work, why it cannot go off just now ("" when it can), and how many legendaries lie on the board
    lg: cm.lg, lgWhy: sk ? skWhy(ch, sk) || "" : lg && !cm.lg ? "아직 열리지 않은 효과입니다" : "", lgN: cs.placed.filter((e) => e.c.lg).length,
  };
}
/** `defs().charms`: everything the board UI draws from. */
function charmDefs() {
  return {
    v: CHARM_V, size: CHARM_SIZE, lv: CHARM_QUESTS[0].lv, low: CHARM_LOW,
    shapes: Object.fromEntries(CHARM_SHAPE_IDS.map((id) => [id, { cells: CHARM_SHAPES[id].cells, k: CHARM_SHAPES[id].k, rot: [0, 1, 2, 3].map((r) => charmCells(id, r)) }])),
    grades: CHARM_GRADE, src: CHARM_SRC.map((s) => s.name),
    opts: Object.fromEntries(CHARM_OPT_IDS.map((k) => [k, { name: CHARM_OPT[k].name, lo: CHARM_OPT[k].lo, hi: CHARM_OPT[k].hi, pct: CHARM_OPT[k].pct ? 1 : 0, cap: CHARM_OPT[k].cap }])),
    skd: CHARM_SKD, skh: CHARM_SKH,
    legend: Object.fromEntries(Object.keys(CHARM_LEGEND).map((id) => { const l = CHARM_LEGEND[id]; return [id, { name: l.name, shape: l.shape, sk: l.sk || "", cd: l.cd, off: l.off ? 1 : 0, desc: l.desc }]; })),
    expand: CHARM_EXPAND, expandCost: CHARM_EXPAND.map((_, k) => charmExpandCost(k)), nail: "charm_nail",
    // appraisal: round(idCost[0] + idCost[1] × the charm's tier) G; the first is free
    idCost: [200, 12],
    quests: CHARM_QUESTS.map(({ id, lv, n, title, text, reward }) => ({ id, lv, n, title, text, reward })), say: CHARM_SAY, npc: "town_charm_juana", role: "charm",
  };
}
