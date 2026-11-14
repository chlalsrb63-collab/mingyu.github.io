// ───────────────────────────── life skills: tables (docs/design/life-and-coop.md B) ─────────────────────────────
// Six life skills, levels 1–50 on one curve, separate from combat level and weapon mastery. What they give is
// goods: L1 (this phase) grows 낚시 and 요리 (graded fish by zone, cooking XP and bonuses); 채집 제작 연금 배달,
// the 알바 board and the co-op jobs plug in later (L2, C1–C3) without another sheet bump.
// Every number here is balance: edit freely, tests/lifeskills.mjs holds the golden values.

/** The six skills in wire order (sheet `life` keys) and their Korean names. */
const LIFE = ["fish", "cook", "gather", "craft", "alch", "deliver"];
const LIFE_NAME = ["낚시", "요리", "채집", "제작", "연금", "배달"];
const LIFE_MAX = 50;
/** Experience from level L to L+1: 50 at 1, 1,040 at 10, 4,040 at 20, 9,040 at 30, 16,040 at 40, 24,050 at 49. */
const lifeNeed = (L) => 10 * L * L + 40;
/** Material grade g (1..5) unlocks at life level GRADE_LV[g−1]; 50 is the 명장 level. */
const GRADE_LV = [1, 10, 20, 30, 40];
/** Life experience for one action at grade g (index g−1); ×1.5 on a 대성공 where the skill says so. */
const RXP = [8, 14, 22, 34, 50];
/** Work on a grade unlocked this many levels below you is stale: ×LIFE_STALE experience. */
const LIFE_STALE_D = 20, LIFE_STALE = 0.25;
/**
 * The bonus formula (B.2), d = max(0, L − unlock level): success min(100, 60 + 1.2·d) %, 대성공
 * min(60, 3 + 1.2·d) %, time × (1 − 0.008·L); a mini-game score s shifts both rolls by (s − 50)·0.2 %p.
 */
const LIFE_ROLL = { ok: [60, 1.2, 100], great: [3, 1.2, 60], time: 0.008, score: 0.2 };
/** A level-up toast names what the level opens. */
const LIFE_UNLOCK = { 10: "2등급", 20: "3등급", 30: "4등급", 40: "5등급", 50: "명장" };

/**
 * Which grade a map's materials and fish are: by the first tier of its level band (meadow 1–7 → G1,
 * forest/crypt → G2, city/sewer → G3, cave/abyss → G4, 단풍 왕도 → G5). An editor map may say `"grade"`.
 */
const GRADE_TIER = [1, 8, 14, 24, 40];
const GRADE_NAME = ["1등급", "2등급", "3등급", "4등급", "5등급"];

// ── materials (B.3): herb / ore / wood of each grade; gathered from L2 on, kept in the 재료 주머니 (pouch)
const LMAT = {
  h: ["들꽃잎", "이끼버섯", "형광 덩굴", "수정꽃", "붉은 단풍잎"],
  o: ["구리 원석", "철광석", "네온 고철", "심연 결정", "왕도 은괴석"],
  w: ["마른 가지", "참나무 목재", "기름 먹은 판자", "화석 목재", "단풍 고목"],
};
const LMAT_KIND = { h: "약초", o: "광석", w: "목재" };
/** What one sells for (the shop pays 40 % of `price`). */
const LMAT_SELL = [6, 14, 30, 60, 110];
for (const k of Object.keys(LMAT)) LMAT[k].forEach((name, i) => {
  ITEMS[`m_${k}${i + 1}`] = { name, type: "lmat", grade: i + 1, mk: k, price: Math.round(LMAT_SELL[i] / 0.4),
    desc: `${GRADE_NAME[i]} ${LMAT_KIND[k]}. 생활 기술의 재료로 쓰인다.` };
});

// ── fish by grade (B.3, B.5): the zone and the angler's level decide what can bite
// (fish_s/m/l are the old fish; 은빛 메기 and 동굴 장님고기 are new, each with a campfire dish)
Object.assign(ITEMS, {
  fish_c: { name: "은빛 메기", type: "fish", cook: "food_c", price: 220, desc: "도시 하수의 물이 키운 은빛 메기. 모닥불에서 구울 수 있다." },
  fish_v: { name: "동굴 장님고기", type: "fish", cook: "food_v", price: 400, desc: "빛을 모르는 동굴 물고기. 모닥불에서 구울 수 있다." },
  food_c: { name: "은빛 메기 구이", type: "food", heal: 450, buff: { xp: 10, atk: 3, min: 12 }, price: 300, desc: "HP 450 회복. 12분간 경험치 +10%, 공격력 +3%." },
  food_v: { name: "장님고기 꼬치구이", type: "food", heal: 800, buff: { xp: 12, atk: 5, min: 15 }, price: 520, desc: "HP 800 회복. 15분간 경험치 +12%, 공격력 +5%." },
});
/** The fish of each grade (index g−1). 황금 잉어 is grade 5, and also a rare catch anywhere. */
const FISH_G = ["fish_s", "fish_m", "fish_c", "fish_v", "fish_l"];
for (const [i, id] of FISH_G.entries()) ITEMS[id].grade = i + 1;
/**
 * Fishing (B.5). The score k = s/100 of the rhythm game splits the catch: 황금 잉어 first
 * (carp[0] + carp[1]·k² + carp[2]·L), then the top candidate (top[0] + top[1]·k), the next one down
 * (next), a stone (stone), else the lowest. A fight below keep[0] − keep[1]·L gets away.
 * The bite wait is (wait[0] + rnd·wait[1]) × the time factor.
 */
const FISHING = { carp: [0.01, 0.07, 0.001], top: [0.1, 0.3], next: 0.2, stone: 0.04, keep: [30, 0.3], wait: [2500, 4500] };

// ── recipes (B.6): L1 has the campfire fish dishes only; L2 adds the stations, staples and the other skills.
// RECIPES[id] = { sk, lv, at, in: [[item, n]…], out: [item, n], fee, mg, ms } — the id is the dish.
// Every fish recipe can be cooked at any level (as before life skills); the level only adds bonuses.
const RECIPES = {
  food_s: { sk: "cook", lv: 1, at: "fire", in: [["fish_s", 1]], out: ["food_s", 1], fee: 0, mg: "pan", ms: 0 },
  food_m: { sk: "cook", lv: 10, at: "fire", in: [["fish_m", 1]], out: ["food_m", 1], fee: 0, mg: "pan", ms: 0 },
  food_c: { sk: "cook", lv: 20, at: "fire", in: [["fish_c", 1]], out: ["food_c", 1], fee: 0, mg: "pan", ms: 0 },
  food_v: { sk: "cook", lv: 30, at: "fire", in: [["fish_v", 1]], out: ["food_v", 1], fee: 0, mg: "pan", ms: 0 },
  food_l: { sk: "cook", lv: 40, at: "fire", in: [["fish_l", 1]], out: ["food_l", 1], fee: 0, mg: "pan", ms: 0 },
};
for (const id of Object.keys(RECIPES)) ITEMS[RECIPES[id].in[0][0]].recipe = id;
/** Cooking (B.5): burnt below burnt[0] − burnt[1]·d (never below burnt[2]); two portions at `two` or on a 대성공. */
const COOKING = { burnt: [35, 0.4, 10], two: 85 };

// ── fields the later phases fill (the sheet carries them from L1 on, so they never bump it again)
/** The solo 알바 board's templates (L2). Empty until then: no saved `jobBoard` entry survives `migrate`. */
const JB = {};
/** The co-op part-time jobs (C1–C3), by the building they run in. */
const COOP_KINDS = ["apt", "diner", "forge", "alch"];
/** The 재료 주머니 holds materials (and, from L2, staples and flasks) up to this many of each. */
const POUCH_MAX = 999;
