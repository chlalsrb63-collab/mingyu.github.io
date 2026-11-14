// ───────────────────────────── jobs and stats: tables ─────────────────────────────
// docs/design/jobs-and-stats.md. Everybody starts as a 모험가 (adventurer) with six stats at 5;
// a level is one stat point bought with experience; weapon mastery (1–50 per kind) grows by
// using a weapon, and at mastery 20 opens a job. Functions live in 45-jobs.js.

/** The six stats: [key, name, what it does]. Order is the wire order everywhere (`st`, `nx`, `train {a}`). */
const STATS = [
  ["str", "힘", "물리 공격 · 밀림 저항 — 대검·창"],
  ["wil", "의지", "HP · 방어 · 강인도 · 상태 저항"],
  ["dex", "민첩", "공격 속도 · 회피 · 기습/원거리 피해 — 단검·활"],
  ["int", "지능", "마법 공격 · 원소 폭발 — 스태프·마도서"],
  ["wis", "지혜", "MP · MP 회복 · 재사용 감소"],
  ["luk", "행운", "치명타 · 치명 피해 · 아이템 발견 · 발동 확률"],
];
const ST_ORDER = STATS.map((s) => s[0]);
const ST_BASE = 5, ST_CAP = 99;
/** Point cost: pointCost(N, s) = round(tierXp(toTier(N)) / LV_DIV × (1 + STAT_K × max(0, s − STAT_K0))). */
const LV_DIV = 4.4, STAT_K = 0.004, STAT_K0 = 30;
/** The world's own scale (monster levels, map bands): 1–50. Players see 4·tier − 3. */
const TIER_MAX = 50;
/** Weapon kinds in wire order (`wm`, `["wm", eid, kindIndex, lv]`), and the mastery cap. */
const WK_ORDER = ["sword", "dagger", "spear", "staff", "book", "bow"], WM_MAX = 50;
const WK_NAME = { sword: "대검", dagger: "단검", spear: "창", staff: "스태프", book: "마도서", bow: "활" };
/** Mastery a job asks for. */
const JOB_WM = 20;

/** Scaling grades and what they are worth. */
const GRADE = { S: 1.0, A: 0.85, B: 0.7, C: 0.5, D: 0.3 };
/** How each weapon kind scales with the stats (B.5). */
const SCALE = {
  sword: { str: "A", wil: "C" },
  dagger: { dex: "A", luk: "C" },
  spear: { str: "A", wis: "C" },
  staff: { int: "A", wis: "C" },
  book: { int: "A", wil: "C" },
  bow: { dex: "A", luk: "C" },
};
/** A single job adds this to both of its weapon's coefficients. */
const JOB_PLUS = 0.1;
/**
 * The jobs. `single`: one weapon, mastery 20, 5,000 G. `hybrid`: stay a 모험가 until both weapons of
 * the pair reach 20, 20,000 G; `scale` replaces the table for both weapons. Ids are frozen (persisted).
 */
const JOBS = {
  adventurer: { name: "모험가", kind: "none", wk: [], cost: 0 },
  swordsman: { name: "대검전사", kind: "single", wk: ["sword"], cost: 5000 },
  thief: { name: "도적", kind: "single", wk: ["dagger"], cost: 5000 },
  lancer: { name: "창술사", kind: "single", wk: ["spear"], cost: 5000 },
  wizard: { name: "마법사", kind: "single", wk: ["staff"], cost: 5000 },
  warlock: { name: "마도사", kind: "single", wk: ["book"], cost: 5000 },
  archer: { name: "궁수", kind: "single", wk: ["bow"], cost: 5000 },
  spellblade: { name: "마검사", kind: "hybrid", wk: ["sword", "staff"], scale: { str: 0.8, int: 0.8, wil: 0.3, wis: 0.3 }, cost: 20000 },
  tracker: { name: "추적자", kind: "hybrid", wk: ["dagger", "bow"], scale: { dex: 0.8, luk: 0.8 }, cost: 20000 },
  dragoon: { name: "용기사", kind: "hybrid", wk: ["spear", "book"], scale: { str: 0.7, wil: 0.7, int: 0.7, wis: 0.3 }, cost: 20000 },
  hexblade: { name: "주술암살자", kind: "hybrid", wk: ["dagger", "book"], scale: { dex: 0.8, int: 0.8, luk: 0.3, wil: 0.3 }, cost: 20000 },
  stormrider: { name: "폭풍기수", kind: "hybrid", wk: ["spear", "bow"], scale: { str: 0.8, dex: 0.8, wis: 0.3, luk: 0.3 }, cost: 20000 },
  darkknight: { name: "암흑기사", kind: "hybrid", wk: ["sword", "book"], scale: { wil: 0.8, str: 0.8, int: 0.3 }, cost: 20000 },
};

/**
 * Derived-stat constants (B.4), one table so tuning is data-only. Each formula reads eff(stat).
 *   hp = hp[0] + hp[1]·lv + hp[2]·WIL;  mp = mp[0] + mp[1]·lv + mp[2]·WIS + mp[3]·INT;  def = def[0]·lv + def[1]·WIL
 *   atk core = atk[0] + atk[1]·lv;  weapon attack × (1 + wm·wmAtk);  crit = crit[0] + kind crit + crit[1]·LUK
 *   critd = critd[0] + critd[1]·LUK;  attack speed −min(aspd[1], aspd[0]·DEX);  evasion min(eva[1], eva[0]·DEX)
 */
const SFX = {
  hp: [70, 2.5, 13], mp: [30, 0.6, 6, 2], def: [0.12, 0.25], atk: [3, 0.1], wmAtk: 0.01,
  crit: [5, 0.3], critCap: 75, critd: [1.5, 0.008], aspd: [0.005, 0.3], eva: [0.3, 20], sneak: 0.004, far: 90,
  cdr: [0.004, 0.25], mpReg: 0.0004, burst: 0.008, mf: [0.4, 25], proc: 0.01,
  kbr: [0.015, 0.8], poise: [0.015, 0.8], res: [0.01, 0.5],
  physDef: 0.5, magDef: 0.25, stagPx: 14, stagMs: 300,
  /** graze% = graze[0] + graze[1]·tiers above + boss·graze[2] − mastery, within [0, graze[3]] */
  graze: [10, 3, 10, 60], grazeK: 0.5,
};
/** Weapon mastery gains: a hit action (+1, a skill +2) on a monster no more than `lowTier` tiers below you; a kill pays by rank. */
const WM_GAIN = { hit: 1, skill: 2, lowTier: 8, kill: [1, 4, 10], boss: 20 };

/**
 * Stat templates (shares of the points above 5), by weapon kind: the migration of the old four classes
 * (B.11) and the test/probe hero. A mage carrying a book takes the book's.
 */
const BUILD = {
  sword: { str: 0.45, wil: 0.35, dex: 0.05, wis: 0.05, luk: 0.1 },
  dagger: { dex: 0.45, luk: 0.3, wil: 0.15, str: 0.05, wis: 0.05 },
  spear: { str: 0.4, wis: 0.25, wil: 0.25, dex: 0.1 },
  staff: { int: 0.45, wis: 0.3, wil: 0.2, luk: 0.05 },
  book: { int: 0.45, wil: 0.3, wis: 0.2, luk: 0.05 },
  bow: { dex: 0.45, luk: 0.3, wil: 0.15, str: 0.05, wis: 0.05 },
};
/** Old class → [its weapon kind, the single job it becomes at old level 20+]. Mage picks by the weapon in hand. */
const OLD_CLASS = { warrior: ["sword", "swordsman"], rogue: ["dagger", "thief"], lancer: ["spear", "lancer"], mage: ["staff", "wizard"] };
/** How often a hybrid may swap weapons (Tab). */
const WSW_MS = 800;
/** Arrows: at most this many in flight per archer; a finisher pierces one more. */
const SHOT_MAX = 6;
