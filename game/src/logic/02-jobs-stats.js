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
const ST_BASE = 5, AP_PER_LEVEL = 5, ST_CAP = 475;
const ST_SOFT = [180, 280];
/** The world's own scale (monster levels, map bands): 1–50. Players see 4·tier − 3. */
const TIER_MAX = 50;
/** Weapon kinds in wire order (`wm`, `["wm", eid, kindIndex, lv]`), and the mastery cap. */
const WK_ORDER = ["sword", "dagger", "spear", "staff", "book", "bow", "hammer"], WM_MAX = 50;
const WK_NAME = { sword: "대검", dagger: "단검", spear: "창", staff: "스태프", book: "마도서", bow: "활", hammer: "양손해머" };
/** Mastery every job asks for in its weapon (simplified single-weapon branching at Lv.30). */
const JOB_WM = 30, HYB_WM = 30;
const JOB_COST = 1000, HYB_COST = 1000;
const JOB_PROGRESS = { cap: 50, signature: 5, hp: 0.003, mp: 0.002, atk: 0.0024, def: 0.002 };
const JOB_SKILL_RANKS = [
  { lv: JOB_PROGRESS.signature, mp: 0, cd: 0 },
  { lv: 20, mp: 10, cd: 0 },
  { lv: 35, mp: 10, cd: 8 },
  { lv: JOB_PROGRESS.cap, mp: 20, cd: 12 },
];
// Eligible PvE kills boost character XP through 30, then taper to the regular reward at 40.
const HUNT_EARLY = { full: 30, end: 40, ahead: 3, extra: 0.6 };

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
  hammer: { str: "A", wil: "C" },
};
/** A single job adds this to both of its weapon's coefficients. */
const JOB_PLUS = 0.1;
/**
 * The jobs (14 single-weapon jobs, 2 branches per weapon at mastery 30, plus adventurer).
 * Each weapon's primary branch adds JOB_PLUS to its default weapon scaling; the alternate branch supplies
 * its own `scale` profile for distinct build identity. Ids are frozen (persisted).
 */
const JOBS = {
  adventurer: { name: "모험가", kind: "none", wk: [], cost: 0 },
  // ── 대검 (sword)
  swordsman: { name: "바바리안", kind: "single", wk: ["sword"], cost: JOB_COST },
  spellblade: { name: "스펠블레이드", kind: "single", wk: ["sword"], scale: { str: 0.9, int: 0.9, wil: 0.2, wis: 0.2 }, cost: JOB_COST },
  // ── 단검 (dagger)
  thief: { name: "도적", kind: "single", wk: ["dagger"], cost: JOB_COST },
  bladedancer: { name: "블레이드댄서", kind: "single", wk: ["dagger"], scale: { dex: 0.9, luk: 0.65, str: 0.25 }, cost: JOB_COST },
  // ── 창 (spear)
  lancer: { name: "창술사", kind: "single", wk: ["spear"], cost: JOB_COST },
  spellspear: { name: "마창사", kind: "single", wk: ["spear"], scale: { str: 0.85, int: 0.8, wis: 0.55 }, cost: JOB_COST },
  // ── 스태프 (staff)
  wizard: { name: "마법사", kind: "single", wk: ["staff"], cost: JOB_COST },
  trickster: { name: "트릭스터", kind: "single", wk: ["staff"], scale: { int: 0.9, wis: 0.5, luk: 0.45 }, cost: JOB_COST },
  // ── 마도서 (book)
  warlock: { name: "마도사", kind: "single", wk: ["book"], cost: JOB_COST },
  runearcher: { name: "룬브레이커", kind: "single", wk: ["book"], scale: { int: 0.95, wis: 0.45, wil: 0.45 }, cost: JOB_COST },
  // ── 활 (bow)
  archer: { name: "헌터", kind: "single", wk: ["bow"], cost: JOB_COST },
  tracker: { name: "추적자", kind: "single", wk: ["bow"], scale: { dex: 0.9, luk: 0.75, wis: 0.2 }, cost: JOB_COST },
  // ── 양손해머 (hammer)
  destroyer: { name: "파괴자", kind: "single", wk: ["hammer"], cost: JOB_COST },
  paladin: { name: "성기사", kind: "single", wk: ["hammer"], scale: { str: 0.8, wil: 0.7, wis: 0.55 }, cost: JOB_COST },
};

/**
 * Job-unique identity passive traits and live combat gauges (JOB-03).
 * Every single-weapon branch owns a distinct stackable gauge (`0..max`, decays after `ms` out of combat)
 * so the two jobs sharing a weapon feel unmistakably different in cadence and payoff.
 */
const JOB_TRAIT = {
  swordsman:   { id: "rage",      name: "광전사의 분노", short: "분노", max: 5, ms: 7000,  color: "#ff5a3c", color2: "#ffd27a",
    desc: "공격 적중이나 피격 시 분노 +1(최대 5). 중첩당 피해 +1%, 최대 시 받는 피해 -10% 및 다음 스킬이 분노를 소모해 피해 +15%." },
  spellblade:  { id: "arccharge", name: "마검 충전",     short: "마검", max: 4, ms: 8000,  color: "#ff9b42", color2: "#fff2a8",
    desc: "공격이나 스킬 적중 시 마검 충전 +1(최대 4). 중첩당 원소/스킬 피해 +1.5%, 최대 시 다음 스킬이 충전을 소모해 피해 +16%·MP 30% 환급." },
  thief:       { id: "shadow",    name: "암영의 기세",   short: "암영", max: 5, ms: 8000,  color: "#b46aff", color2: "#f0d4ff",
    desc: "치명타나 등 뒤 타격 시 암영 +1(최대 5). 중첩당 치명타 피해 +2.5%, 최대 시 다음 스킬이 암영을 소모해 확정 치명타·피해 +16%." },
  bladedancer: { id: "bloodstep", name: "선혈의 춤사위", short: "선혈", max: 5, ms: 7000,  color: "#f04878", color2: "#ffb8cc",
    desc: "표식·출혈 적 타격이나 스킬 적중 시 선혈 +1(최대 5). 중첩당 공격 속도 +1.5%·이동 속도 +2%, 최대 중첩 유지 중 타격마다 최대 HP 1.5% 흡수." },
  lancer:      { id: "spirit",    name: "창극의 기백",   short: "기백", max: 4, ms: 8000,  color: "#52d8c0", color2: "#d8fff6",
    desc: "창끝 일격이나 스킬 적중 시 기백 +1(최대 4). 중첩당 방어 관통 +3%, 최대 시 다음 스킬이 기백을 소모해 피해 +16%·쿨타임 1.5초 단축." },
  spellspear:  { id: "frostvolt", name: "빙뢰 공명",     short: "빙뢰", max: 4, ms: 8000,  color: "#72d4ff", color2: "#fff098",
    desc: "냉기·번개 타격이나 스킬 적중 시 빙뢰 +1(최대 4). 중첩당 피해 +1.5%, 최대 시 다음 스킬이 빙뢰를 소모해 피해 +15% 및 주변 냉기·번개 파동 방출." },
  wizard:      { id: "arcanum",   name: "대마도사의 비전", short: "비전", max: 5, ms: 9000, color: "#7a9cff", color2: "#e8f2ff",
    desc: "스킬 시전이나 원소 반응 시 비전 +1(최대 5). 중첩당 스킬 피해 +1.5%, 최대 시 다음 스킬이 비전을 소모해 피해 +18%·최대 MP 25% 회복." },
  trickster:   { id: "wilddeck",  name: "트릭 카드",     short: "카드", max: 4, ms: 8500,  color: "#d47aff", color2: "#ffe47a",
    desc: "치명타나 스킬 적중 시 카드 +1(최대 4). 중첩당 치명타 +2.5%p·회피 +2%p, 최대 시 다음 스킬이 카드를 소모해 피해 +15%·쿨타임 25% 즉시 반환." },
  warlock:     { id: "souls",     name: "영혼의 잔재",   short: "영혼", max: 5, ms: 9000,  color: "#9a66f0", color2: "#d4ff9c",
    desc: "낙인 적 타격이나 처치 시 영혼 +1(최대 5). 중첩당 피해 +1.5%·흡혈 +0.6%, 최대 시 다음 스킬이 영혼을 소모해 피해 +16%·최대 HP 8% 회복." },
  runearcher:  { id: "runeseal",  name: "룬 각인",       short: "룬",   max: 4, ms: 9000,  color: "#68c8ff", color2: "#ffca83",
    desc: "스킬 시전이나 원소 반응 시 룬 각인 +1(최대 4). 중첩당 재사용 대기 감소 +2%p, 최대 시 다음 스킬이 각인을 소모해 피해 +16%·최대 HP 8% 신성 보호막." },
  archer:      { id: "focus",     name: "사냥꾼의 집중", short: "집중", max: 5, ms: 8000,  color: "#9ae062", color2: "#fff2a8",
    desc: "원거리 공격이나 스킬 적중 시 집중 +1(최대 5). 중첩당 피해 +1.5%·공격 속도 +2%, 최대 시 다음 스킬이 집중을 소모해 피해 +18%·방어 관통 +20%." },
  tracker:     { id: "prey",      name: "사냥감 추적",   short: "추적", max: 5, ms: 8500,  color: "#76d65c", color2: "#f07298",
    desc: "표식·독·덫 적중 시 추적 +1(최대 5). 중첩당 치명타 +2%p·이동 속도 +2%, 최대 시 다음 스킬이 추적을 소모해 피해 +18%·중독 확정 부여." },
  destroyer:   { id: "quake",     name: "파쇄의 여진",   short: "여진", max: 4, ms: 8000,  color: "#e88a42", color2: "#ffe0a0",
    desc: "해머 정타나 스킬 적중 시 여진 +1(최대 4). 중첩당 피해 +2.5%·경직 저항 +4%p, 최대 시 다음 스킬이 여진을 소모해 피해 +20%·방어구 파쇄 확정 부여." },
  paladin:     { id: "vow",       name: "신성의 서약",   short: "서약", max: 4, ms: 9000,  color: "#ffd468", color2: "#fff8d8",
    desc: "공격·회복·피격 시 서약 +1(최대 4). 중첩당 받는 피해 -2.5%, 최대 시 다음 스킬이 서약을 소모해 자신과 주변 파티원 HP 5% 회복·5% 신성 보호막." },
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
/** A hit grants mastery once per action. Kills add tier/rank credit and, before job mastery, capped practice XP. */
const WM_GAIN = { hit: 1, skill: 2, lowTier: 8, kill: [1, 4, 10], boss: 20, earlyHit: 5, earlyKill: 3.55, earlyXpMax: 60 };

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
  hammer: { str: 0.45, wil: 0.35, dex: 0.05, wis: 0.05, luk: 0.1 },
};
/** Old class → [its weapon kind, the single job it becomes at old level 20+]. Mage picks by the weapon in hand. */
const OLD_CLASS = { warrior: ["sword", "swordsman"], rogue: ["dagger", "thief"], lancer: ["spear", "lancer"], mage: ["staff", "wizard"] };
/** How often a hybrid may swap weapons (Tab). */
const WSW_MS = 800;
/** Arrows: at most this many in flight per archer; a finisher pierces one more. */
const SHOT_MAX = 6;
