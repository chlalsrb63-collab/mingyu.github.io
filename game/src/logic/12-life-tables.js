// ───────────────────────────── life skills: tables (docs/design/life-and-coop.md B) ─────────────────────────────
// Six life skills, levels 1–50 on one curve, separate from combat level and weapon mastery. What they give is
// goods: L1 grew 낚시 and 요리 (graded fish by zone, cooking XP and bonuses); L2 (the second half of this file)
// adds 채집 제작 연금 배달, the stations, the 알바 board and trust; the co-op jobs (C1–C3) need no sheet bump either.
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

// ── recipes (B.6): the campfire fish dishes (L1) here; the stations' recipes (L2) further down.
// RECIPES[id] = { sk, lv, at, in: [[item, n]…], out: [item, n], fee, mg, ms } — the id is the dish.
// Every fish recipe can be cooked at any level (as before life skills); the level only adds bonuses.
const RECIPES = {
  food_s: { sk: "cook", lv: 1, at: "fire", in: [["fish_s", 1]], out: ["food_s", 1], fee: 0, mg: "pan", ms: 0 },
  food_m: { sk: "cook", lv: 10, at: "fire", in: [["fish_m", 1]], out: ["food_m", 1], fee: 0, mg: "pan", ms: 0 },
  food_c: { sk: "cook", lv: 20, at: "fire", in: [["fish_c", 1]], out: ["food_c", 1], fee: 0, mg: "pan", ms: 0 },
  food_v: { sk: "cook", lv: 30, at: "fire", in: [["fish_v", 1]], out: ["food_v", 1], fee: 0, mg: "pan", ms: 0 },
  food_l: { sk: "cook", lv: 40, at: "fire", in: [["fish_l", 1]], out: ["food_l", 1], fee: 0, mg: "pan", ms: 0 },
};
// (`any`: a fish on a campfire cooks at any level and keeps L1's pan rules, cookDish; the economy guard skips it —
// a fish costs an angler's time, not gold)
for (const id of Object.keys(RECIPES)) { ITEMS[RECIPES[id].in[0][0]].recipe = id; RECIPES[id].any = 1; }
/** Cooking (B.5): burnt below burnt[0] − burnt[1]·d (never below burnt[2]); two portions at `two` or on a 대성공. */
const COOKING = { burnt: [35, 0.4, 10], two: 85 };

// ───── L2: gathering, the stations, the 알바 board, trust (life-and-coop.md B.4, B.6–B.10)

// ── gathering nodes (B.4): fixed per map from its id, never depleted; each player waits out their own cooldown
/** Node kinds in wire order (node[0]) → the material letter of LMAT (3 = a crop of CROP, placed by hand). */
const NODE_KINDS = ["h", "o", "w", "c"];
const NODE_NAME = ["약초", "광맥", "통나무", "작물"];
/**
 * cd: a node's cooldown per player (ms) · ch: the channel at Lv 1 before the time factor (ms) · range: px from the
 * node · tap: the "반짝!" window (ms) + lag allowance · tapAt: where in the channel it comes (share) · tapBonus %p
 * 대성공 · bonus: chance of one bonus item · gap: tiles between nodes · clear: tiles kept from doors, signs, stones,
 * NPCs and fires · per/min/max: one node per `per` open tiles, clamped · hidden: pick weight in hidden pockets ·
 * hit: no gathering this long after being hit (ms) · move: px of movement that breaks the channel.
 */
const NODE = { cd: 300000, ch: 2400, range: 24, tap: 700, lag: 250, tapAt: [0.35, 0.75], tapBonus: 15, bonus: 0.04, gap: 6, clear: 3, per: 150, min: 8, max: 60, hidden: 2, hit: 3000, move: 6 };
/** Kind weights per theme [herb, ore, wood]. */
const NODE_W = {
  meadow: [0.5, 0.2, 0.3], forest: [0.4, 0.15, 0.45], crypt: [0.3, 0.5, 0.2], city: [0.2, 0.55, 0.25], sewer: [0.2, 0.55, 0.25],
  cave: [0.3, 0.6, 0.1], abyss: [0.3, 0.6, 0.1], autumn: [0.4, 0.15, 0.45],
};
/**
 * Crops (H10 farm): an editor map's `crops` [[x, y, crop 1..6]…] become nodes [3, crop, x, y] (lifeNodes), even in a
 * safe village; the same channel, tap and per-player cooldown ("they regrow") as every node. Each crop: its name,
 * the gather level it needs, its grade (experience, and the sell price of that grade's herb). Item `m_c<crop>`.
 */
const CROP = [["감자", 1, 1], ["당근", 1, 1], ["양배추", 5, 1], ["무", 10, 2], ["옥수수", 15, 2], ["호박", 20, 3]];
CROP.forEach(([name, lv, g], i) => {
  ITEMS[`m_c${i + 1}`] = { name, type: "lmat", grade: g, mk: "c", price: Math.round(LMAT_SELL[g - 1] / 0.4),
    desc: `${GRADE_NAME[g - 1]} 작물 (채집 Lv.${lv}). 텃밭에서 거둔다. 요리 재료로 쓰인다.` };
});

// ── new goods (B.6). Staples and flasks are bought (쥬쥬, 보글's shelf) and live in the pouch with the materials.
/** Ingots: three ores of a grade at 캉캉's furnace; they sell for exactly the three ores (a smelt never pays). */
const ING_NAME = ["구리 주괴", "강철 주괴", "네온 합금", "심연 주괴", "왕도 은괴"];
ING_NAME.forEach((name, i) => {
  ITEMS[`ing_${i + 1}`] = { name, type: "lmat", grade: i + 1, mk: "i", price: Math.round((LMAT_SELL[i] * 3) / 0.4),
    desc: `${GRADE_NAME[i]} 주괴. 캉캉대장간에서 장비를 만들 때 쓰인다.` };
});
Object.assign(ITEMS, {
  staple: { name: "식재료 꾸러미", type: "mat", price: 12, desc: "쌀, 소금, 기름 한 꾸러미. 화덕 요리에 쓰인다. 재료 주머니에 들어간다." },
  flask: { name: "빈 병", type: "mat", price: 5, desc: "물약을 담는 유리병. 연금술에 쓰인다. 재료 주머니에 들어간다." },
  fd_rice: { name: "들꽃 주먹밥", type: "food", heal: 150, buff: { xp: 4, atk: 2, min: 10 }, price: 38, desc: "HP 150 회복. 10분간 경험치 +4%, 공격력 +2%." },
  fd_skewer: { name: "버섯 꼬치", type: "food", heal: 320, buff: { xp: 5, atk: 4, min: 15 }, price: 78, desc: "HP 320 회복. 15분간 경험치 +5%, 공격력 +4%." },
  fd_stew: { name: "메기 매운탕", type: "food", heal: 600, mana: 120, buff: { xp: 8, atk: 0, min: 15 }, price: 300, desc: "HP 600, MP 120 회복. 15분간 경험치 +8%." },
  fd_steam: { name: "장님고기 찜", type: "food", heal: 1100, buff: { xp: 10, atk: 4, min: 20 }, price: 560, desc: "HP 1100 회복. 20분간 경험치 +10%, 공격력 +4%." },
  // the farm's dishes (H10): the plot's crops, at a campfire or a stove
  fd_potato: { name: "감자구이", type: "food", heal: 100, buff: { xp: 3, atk: 1, min: 10 }, price: 28, desc: "HP 100 회복. 10분간 경험치 +3%, 공격력 +1%." },
  fd_carrot: { name: "당근 수프", type: "food", heal: 140, mana: 60, buff: { xp: 4, atk: 1, min: 10 }, price: 38, desc: "HP 140, MP 60 회복. 10분간 경험치 +4%, 공격력 +1%." },
  fd_veg: { name: "채소 볶음", type: "food", heal: 260, buff: { xp: 5, atk: 3, min: 15 }, price: 58, desc: "HP 260 회복. 15분간 경험치 +5%, 공격력 +3%." },
  fd_corn: { name: "옥수수 호박죽", type: "food", heal: 500, mana: 150, buff: { xp: 7, atk: 3, min: 15 }, price: 115, desc: "HP 500, MP 150 회복. 15분간 경험치 +7%, 공격력 +3%." },
  fd_feast: { name: "쥬쥬 특선 정식", type: "food", heal: 99999, mana: 99999, buff: { xp: 15, atk: 8, min: 30 }, price: 1500, desc: "HP와 MP를 모두 회복. 30분간 경험치 +15%, 공격력 +8%." },
  // elixirs work like the scrolls (the same buff, the same strength) but last longer; `el` routes them through
  // the life `use` path (58-life.js lifeUseApply)
  el_atk: { name: "공격의 엘릭서", type: "buff", buff: "atk", min: 15, el: 1, price: 300, desc: "15분간 공격력 +10%. 공격의 주문서와 같은 힘이 더 오래 간다." },
  el_def: { name: "수호의 엘릭서", type: "buff", buff: "def", min: 15, el: 1, price: 300, desc: "15분간 받는 피해 -12%. 방어의 주문서와 같은 힘이 더 오래 간다." },
  el_xp: { name: "경험의 엘릭서", type: "buff", buff: "xp", min: 15, el: 1, price: 450, desc: "15분간 경험치 +20%. 경험의 주문서와 같은 힘이 더 오래 간다." },
  el_spd: { name: "신속의 물약", type: "buff", buff: "spd", sec: 60, el: 1, price: 200, desc: "60초간 이동속도가 40% 빨라진다." },
  el_all: { name: "연금 정수", type: "buff", buff: "all", min: 20, el: 1, price: 1200, desc: "20분간 공격력 +10%, 받는 피해 -12%, 경험치 +20%. 세 주문서의 힘을 한 병에." },
  stone_b: { name: "축복 강화석", type: "mat", price: 1000, desc: "강화할 때 함께 쓰면 성공 확률이 10%p 오르고, 실패해도 단계가 내려가지 않는다." },
  punch: { name: "홈 송곳", type: "tool", price: 4000, desc: "장착한 장비에 홈을 하나 더 뚫는다 (부위의 최대치까지). 한 번 쓰면 사라진다." },
  whet: { name: "명장의 숫돌", type: "tool", price: 10000, desc: "장착한 장비의 가장 약한 옵션 하나를 새로 굴린다. 한 번 쓰면 사라진다." },
});
/** Blessed stone: +ENH_BLESS %p on the enhancement roll, and a failure never drops a step. */
const ENH_BLESS = 10;

// ── the full recipe table (B.6). Key = what it makes, except gear (`gr_<item>`), smelting (`ing_g` = its ingot),
// the 2-stone line (`stone_x2`) and rune transmutation (`ru_mix`: inputs "rune*" = any rune, the bag's most
// plentiful first; output a random rune). `at`: fire (any campfire, or 쥬쥬's stove), cook (쥬쥬식당 화덕),
// craft (캉캉), alch (보글). `mg` the client's mini-game, `ms` its minimum time before `craft` is accepted
// (× the time factor). `rep`: needs that NPC's trust ≥ 친구 (REP_TIER[1]). `eq`: the shop items an output stands
// in for (the economy guard prices it against them).
const MG = { fire: ["pan", 0], cook: ["pan", 3000], craft: ["forge", 4500], alch: ["brew", 4000] };
const recipeRow = (sk, lv, at, ins, out, n, fee, more) => ({ sk, lv, at, in: ins, out: [out, n], fee, mg: MG[at][0], ms: MG[at][1], ...more });
Object.assign(RECIPES, {
  // 요리: stove dishes (fd_rice also on any campfire); two at a 대성공
  fd_rice: recipeRow("cook", 5, "fire", [["m_h1", 2], ["staple", 1]], "fd_rice", 1, 0),
  fd_skewer: recipeRow("cook", 15, "cook", [["m_h2", 2], ["staple", 1]], "fd_skewer", 1, 0),
  fd_stew: recipeRow("cook", 20, "cook", [["fish_c", 1], ["m_h3", 1], ["staple", 1]], "fd_stew", 1, 0),
  fd_steam: recipeRow("cook", 30, "cook", [["fish_v", 1], ["m_h4", 2], ["staple", 1]], "fd_steam", 1, 0),
  fd_feast: recipeRow("cook", 50, "cook", [["fish_l", 1], ["m_h5", 2], ["m_h4", 1], ["staple", 2]], "fd_feast", 1, 0),
  cafe_pie: recipeRow("cook", 10, "cook", [["m_h1", 3], ["m_h2", 1], ["staple", 1]], "cafe_pie", 1, 72, { rep: "cafe_moka" }),
  inn_stew: recipeRow("cook", 15, "cook", [["fish_m", 1], ["m_h2", 1], ["staple", 2]], "inn_stew", 1, 8, { rep: "inn_maru" }),
  fd_potato: recipeRow("cook", 1, "fire", [["m_c1", 2]], "fd_potato", 1, 0),
  fd_carrot: recipeRow("cook", 3, "fire", [["m_c2", 2], ["staple", 1]], "fd_carrot", 1, 0),
  fd_veg: recipeRow("cook", 10, "cook", [["m_c3", 1], ["m_c4", 1], ["staple", 1]], "fd_veg", 1, 0),
  fd_corn: recipeRow("cook", 20, "cook", [["m_c5", 1], ["m_c6", 1], ["staple", 1]], "fd_corn", 1, 0),
  // 연금: potions in threes, elixirs, feathers, runes
  hp_s: recipeRow("alch", 1, "alch", [["m_h1", 2], ["flask", 3]], "hp_s", 3, 18),
  mp_s: recipeRow("alch", 1, "alch", [["m_h1", 2], ["flask", 3]], "mp_s", 3, 27),
  hp_m: recipeRow("alch", 10, "alch", [["m_h2", 2], ["flask", 3]], "hp_m", 3, 92),
  mp_m: recipeRow("alch", 10, "alch", [["m_h2", 2], ["flask", 3]], "mp_m", 3, 110),
  stat_seal: recipeRow("alch", 10, "alch", [["m_h2", 1], ["stone", 1]], "stat_seal", 1, 100),
  el_atk: recipeRow("alch", 15, "alch", [["m_h2", 2], ["m_o2", 1], ["flask", 1]], "el_atk", 1, 136, { eq: ["sc_atk"] }),
  hp_l: recipeRow("alch", 20, "alch", [["m_h3", 2], ["flask", 3]], "hp_l", 3, 204),
  mp_l: recipeRow("alch", 20, "alch", [["m_h3", 2], ["flask", 3]], "mp_l", 3, 240),
  el_def: recipeRow("alch", 25, "alch", [["m_h3", 2], ["m_o3", 1], ["flask", 1]], "el_def", 1, 88, { eq: ["sc_def"] }),
  el_xp: recipeRow("alch", 25, "alch", [["m_h3", 2], ["m_o3", 1], ["flask", 1]], "el_xp", 1, 178, { eq: ["sc_xp"] }),
  el_spd: recipeRow("alch", 30, "alch", [["m_h4", 1], ["m_w4", 1], ["flask", 1]], "el_spd", 1, 50),
  feather: recipeRow("alch", 35, "alch", [["m_h4", 2], ["m_o4", 1], ["m_w3", 1]], "feather", 1, 0),
  ru_mix: recipeRow("alch", 40, "alch", [["rune*", 3], ["m_h5", 1]], "rune*", 1, 200),
  el_all: recipeRow("alch", 50, "alch", [["m_h5", 2], ["m_o5", 1], ["m_w5", 1], ["flask", 1]], "el_all", 1, 400, { eq: ["sc_atk", "sc_def", "sc_xp"] }),
  // 제작: the stone (the main sink), camp kits, blessed stones, the punch, the whetstone (ingots and gear below)
  stone: recipeRow("craft", 1, "craft", [["m_o1", 4], ["m_w1", 1]], "stone", 1, 60),
  camp: recipeRow("craft", 5, "craft", [["m_w1", 5]], "camp", 1, 42),
  stone_x2: recipeRow("craft", 10, "craft", [["m_o1", 7], ["m_w1", 2]], "stone", 2, 126, { rep: "kangkang" }),
  stone_b: recipeRow("craft", 20, "craft", [["stone", 3], ["m_o3", 2]], "stone_b", 1, 300),
  punch: recipeRow("craft", 30, "craft", [["m_o4", 3], ["m_w4", 2]], "punch", 1, 2000),
  // the bosses-2 trophies: 피눈물 결정 (혈루 왕도마뱀) and 망치 갯가재 집게 make the two dear tools a cheaper way
  stone_b_bt: recipeRow("craft", 20, "craft", [["stone", 2], ["mat_bloodtear", 1]], "stone_b", 1, 200),
  punch_cc: recipeRow("craft", 25, "craft", [["mat_clubclaw", 2], ["m_o3", 2]], "punch", 1, 1300),
  whet: recipeRow("craft", 50, "craft", [["m_o5", 4], ["m_w5", 2], ["stone_b", 1]], "whet", 1, 5000),
});
const ING_FEE = [5, 10, 20, 40, 60];
for (let g = 1; g <= 5; g++) RECIPES[`ing_${g}`] = recipeRow("craft", GRADE_LV[g - 1], "craft", [[`m_o${g}`, 3]], `ing_${g}`, 1, ING_FEE[g - 1]);
/**
 * Gear (B.6): tier t (2–5) at Lv 12/22/32/42 (tier 6: Lv 50, grade-5 materials ×2) — four ingots and two planks of grade t, a fee of 30 % of the shop
 * price; rarity q[0]..q[1] (마법..희귀; a 대성공 raises it one step, never 전설/세트), affixes rolled at item level
 * ilvl[t−1]. No batch mode. 48 recipes: six weapon kinds + six other pieces × four tiers.
 */
const GEAR_CRAFT = { lv: [12, 22, 32, 42, 50], ing: 4, wood: 2, fee: 0.3, q: [1, 2], ilvl: [4, 12, 21, 32, 44, 49], ms: 6000 };
// Tier 6 (운철, Lv.181) has no ingot of its own: grade-5 materials at twice the count (`mat`), at 캉캉 craft Lv.50.
const GEAR6 = { mat: 5, k: 2 };
for (let t = 2; t <= 6; t++) {
  const ids = [...WK_ORDER.map((wk) => `w_${WK_ID[wk]}_${t}`), ...["helm", "armor", "gloves", "boots", "ring", "amulet"].map((ty) => `${GEAR[ty].pre}_${t}`)];
  const g = t === 6 ? GEAR6.mat : t, k = t === 6 ? GEAR6.k : 1;
  for (const id of ids) {
    RECIPES[`gr_${id}`] = recipeRow("craft", GEAR_CRAFT.lv[t - 2], "craft", [[`ing_${g}`, GEAR_CRAFT.ing * k], [`m_w${g}`, GEAR_CRAFT.wood * k]], id, 1,
      Math.round(ITEMS[id].price * GEAR_CRAFT.fee), { gear: 1, ms: GEAR_CRAFT.ms });
  }
}
/** Batch crafting (B.6): up to `batch` at once without a mini-game (scored `batchS`) once `batchD`+ levels above the recipe; a failure gives `failXp` of the XP. */
const CRAFT = { batch: 10, batchS: 70, batchD: 20, failXp: 0.5 };

// ── the solo 알바 board (B.9) and delivery (B.8)
/**
 * JB[id] = { kind, npc, lv, sk, item?, n?, to?, mob?, map?, rep?, when?, rush?, text } — kind bring (gathered
 * materials), make (crafted goods no shop sells), fish (caught fish), deliver (a parcel from `npc` to `to`), hunt
 * (slay `n` of monster `mob`; `lv` is the CHARACTER level), scout (walk onto map `map[grade]` and come back to
 * `npc`). `lv` is otherwise the level of skill `sk` the offer needs. Board v2: `rep` = trust with `npc` needed
 * before it is offered; `when` "night" | "rain" = an extra offer only while it is night / raining in the town;
 * `rush` = always 긴급 with that many minutes. `npc`/`to` are static NPC ids (town, its interiors, 버드나무 마을).
 * `flag` = [questId, pick]: offered only after that side quest was answered with that pick (arc A2).
 */
const JB_WILLOW = {
  jb_willow_wood: { kind: "bring", npc: "willow_repair", lv: 1, sk: "gather", item: "m_w1", n: 6, text: "젖은 마룻널 말리기 · 바닥을 말릴 아궁이의 땔감으로 [마른 가지]를 버들의 수리대에 가져다주세요." },
  jb_willow_fish: { kind: "fish", npc: "willow_kitchen", lv: 1, sk: "fish", item: "fish_s", n: 5, text: "갈대의 아침 바구니 · 연못에서 잡은 [송사리]를 공동 부엌 화덕으로 가져다주세요. 아침 구이에 쓴대요." },
  jb_willow_rice: { kind: "make", npc: "willow_elder", lv: 5, sk: "cook", item: "fd_rice", n: 3, text: "등교길 주먹밥 · 공동 부엌에서 지은 [들꽃 주먹밥]을 촌장 버들에게 가져다주세요. 아이들 아침밥이래요." },
  jb_willow_potato: { kind: "bring", npc: "willow_farmer", lv: 1, sk: "gather", item: "m_c1", n: 6, text: "수확 돕기 · 텃밭 농부 감자의 밭고랑에서 [감자]를 캐서 가져다주세요. 올해 감자는 알이 굵대요!" },
  jb_willow_radish: { kind: "bring", npc: "willow_farmer", lv: 10, sk: "gather", item: "m_c4", n: 4, text: "김장 준비 · 텃밭 농부 감자가 [무] 4뿌리를 뽑아 달래요. 허리가 아프대요." },
  jb_willow_notice: { kind: "deliver", npc: "willow_bard", to: "willow_florist", lv: 1, sk: "deliver", text: "솔의 공연 통지 · 음유시인 솔의 공연 안내문을 받아 꽃집 아이 봄이에게 전해 주세요." },
  jb_neon_supply: { kind: "make", npc: "willow_doran", lv: 10, sk: "cook", item: "fd_veg", n: 2, flag: ["sq_doran_light", 1], text: "네온 시티 보급 · 도란이 시티에 남은 도톨에게 보낼 [채소 볶음] 2접시를 꾸려요. 불빛 아래 혼자 먹는 저녁이래요." },
};
const JB = {
  ...JB_WILLOW,
  jb_herb1: { kind: "bring", npc: "bogle", lv: 1, sk: "gather", item: "m_h1", n: 6, text: "보글이 [들꽃잎] 6장이 필요하대요. 물약에 넣는대요." },
  jb_wood1: { kind: "bring", npc: "inn_maru", lv: 1, sk: "gather", item: "m_w1", n: 8, text: "여관 주인 마루가 아궁이에 넣을 [마른 가지] 8개를 구해요." },
  jb_ore1: { kind: "bring", npc: "kangkang", lv: 1, sk: "gather", item: "m_o1", n: 6, text: "캉캉이 [구리 원석] 6개를 기다려요. 화덕이 배고프대요!" },
  jb_herb2: { kind: "bring", npc: "bogle", lv: 10, sk: "gather", item: "m_h2", n: 6, text: "보글이 [이끼버섯] 6개가 필요하대요." },
  jb_wood2: { kind: "bring", npc: "dongdong", lv: 10, sk: "gather", item: "m_w2", n: 6, text: "관리인 동동이 아파트 계단을 고치려고 [참나무 목재] 6개를 찾아요." },
  jb_ore2: { kind: "bring", npc: "forge_musoe", lv: 10, sk: "gather", item: "m_o2", n: 6, text: "갑옷장이 무쇠가 [철광석] 6개를 주문했어요." },
  jb_herb3: { kind: "bring", npc: "cafe_moka", lv: 20, sk: "gather", item: "m_h3", n: 5, text: "카페 주인 모카가 새 음료에 쓸 [형광 덩굴] 5줄기를 원해요." },
  jb_ore3: { kind: "bring", npc: "kangkang", lv: 20, sk: "gather", item: "m_o3", n: 5, text: "캉캉이 [네온 고철] 5개로 뭔가 만들어 보겠대요." },
  jb_herb4: { kind: "bring", npc: "bogle", lv: 30, sk: "gather", item: "m_h4", n: 4, text: "보글이 [수정꽃] 4송이를 부탁했어요. 깨지지 않게!" },
  jb_wood4: { kind: "bring", npc: "hall_bori", lv: 30, sk: "gather", item: "m_w4", n: 4, text: "이장 보리가 회관 기둥을 받칠 [화석 목재] 4개를 구해요." },
  jb_ore5: { kind: "bring", npc: "kangkang", lv: 40, sk: "gather", item: "m_o5", n: 4, text: "캉캉이 일생일대의 작품에 쓸 [왕도 은괴석] 4개를 기다려요." },
  jb_rice: { kind: "make", npc: "inn_maru", lv: 5, sk: "cook", item: "fd_rice", n: 3, text: "여관 주인 마루가 손님 도시락으로 [들꽃 주먹밥] 3개를 주문했어요." },
  jb_skewer: { kind: "make", npc: "diner_piri", lv: 15, sk: "cook", item: "fd_skewer", n: 2, text: "떠돌이 악사 피리가 공연 전에 먹을 [버섯 꼬치] 2개를 원해요." },
  jb_carrot: { kind: "bring", npc: "juju", lv: 1, sk: "gather", item: "m_c2", n: 5, text: "쥬쥬가 버드나무 마을 텃밭의 [당근] 5뿌리를 찾아요. 수프에 넣는대요." },
  jb_veg: { kind: "make", npc: "juju", lv: 10, sk: "cook", item: "fd_veg", n: 2, text: "쥬쥬가 점심 특선으로 [채소 볶음] 2접시를 주문했어요. 텃밭에서 갓 딴 채소로!" },
  jb_stew: { kind: "make", npc: "inn_maru", lv: 20, sk: "cook", item: "fd_stew", n: 3, text: "여관 주인 마루가 [메기 매운탕] 3그릇을 주문했어요." },
  jb_ing1: { kind: "make", npc: "smith", lv: 1, sk: "craft", item: "ing_1", n: 3, text: "대장장이 볼칸이 연습용 [구리 주괴] 3개를 부탁했어요." },
  jb_ing2: { kind: "make", npc: "forge_musoe", lv: 10, sk: "craft", item: "ing_2", n: 3, text: "갑옷장이 무쇠가 [강철 주괴] 3개를 기다려요." },
  jb_stoneb: { kind: "make", npc: "smith", lv: 20, sk: "craft", item: "stone_b", n: 1, text: "대장장이 볼칸이 [축복 강화석]을 하나 구경하고 싶대요." },
  jb_elatk: { kind: "make", npc: "merc_grey", lv: 15, sk: "alch", item: "el_atk", n: 2, text: "용병단장 그레이가 원정 전에 [공격의 엘릭서] 2병을 원해요." },
  jb_eldef: { kind: "make", npc: "merc_grey", lv: 25, sk: "alch", item: "el_def", n: 2, text: "용병단장 그레이가 [수호의 엘릭서] 2병을 주문했어요." },
  jb_elxp: { kind: "make", npc: "lib_borum", lv: 25, sk: "alch", item: "el_xp", n: 1, text: "사서 보름이 밤샘 공부용 [경험의 엘릭서] 한 병을 원해요." },
  jb_fish1: { kind: "fish", npc: "willow_fisher", lv: 1, sk: "fish", item: "fish_s", n: 5, text: "낚시꾼 갈대가 미끼로 쓸 [송사리] 5마리를 원해요." },
  jb_fish2: { kind: "fish", npc: "juju", lv: 10, sk: "fish", item: "fish_m", n: 3, text: "쥬쥬가 오늘의 특선에 쓸 [무지개 송어] 3마리를 찾아요." },
  jb_fish3: { kind: "fish", npc: "willow_fisher", lv: 20, sk: "fish", item: "fish_c", n: 2, text: "낚시꾼 갈대가 [은빛 메기] 2마리를 원해요." },
  jb_fish4: { kind: "fish", npc: "inn_maru", lv: 30, sk: "fish", item: "fish_v", n: 2, text: "여관 주인 마루가 귀한 손님상에 올릴 [동굴 장님고기] 2마리를 구해요." },
  jb_dl_cafe: { kind: "deliver", npc: "cafe_moka", to: "juju", lv: 1, sk: "deliver", text: "카페 주인 모카의 원두 자루를 쥬쥬식당 쥬쥬에게 전해 주세요." },
  jb_dl_inn: { kind: "deliver", npc: "inn_maru", to: "store_dari", lv: 1, sk: "deliver", text: "여관 주인 마루의 빈 바구니를 다람쥐 잡화점 다리에게 돌려주세요." },
  jb_dl_forge: { kind: "deliver", npc: "kangkang", to: "bank", lv: 1, sk: "deliver", text: "캉캉이 새로 만든 자물쇠를 마을 창고의 도담에게 전해 주세요." },
  jb_dl_hall: { kind: "deliver", npc: "bogle", to: "hall_bori", lv: 5, sk: "deliver", text: "보글의 수상한 약병을 마을회관 이장 보리에게 전해 주세요. 흔들지 마세요!" },
  jb_dl_willow: { kind: "deliver", npc: "store_dari", to: "willow_elder", lv: 10, sk: "deliver", text: "잡화점 다리의 꾸러미를 버드나무 마을 촌장 버들에게 전해 주세요." },
  jb_dl_flower: { kind: "deliver", npc: "willow_florist", to: "cafe_moka", lv: 10, sk: "deliver", text: "버드나무 마을 봄이의 꽃다발을 테일즈 카페 모카에게 전해 주세요." },
  jb_dl_apt: { kind: "deliver", npc: "juju", to: "dongdong", lv: 25, sk: "deliver", text: "쥬쥬의 도시락을 동동아파트 관리인 동동에게 식기 전에 전해 주세요." },
  jb_dl_lab: { kind: "deliver", npc: "kangkang", to: "bogle", lv: 25, sk: "deliver", text: "캉캉이 고친 가마솥 뚜껑을 보글연금공방 보글에게 전해 주세요." },
  // ── board v2: hunts (character level), scouting, trust-gated, night / rain and 긴급 rows
  jb_hunt_hare: { kind: "hunt", npc: "guard", lv: 1, sk: "gather", mob: "twinhare", n: 6, text: "경비병 토비가 밭을 망치는 [쌍두 토끼] 6마리를 쫓아내 달래요. 머리가 둘이라 두 배로 먹는대요!" },
  jb_hunt_frog: { kind: "hunt", npc: "diner_reg1", lv: 8, sk: "gather", mob: "gutfrog", n: 6, text: "단골 손님 나비가 밤새 우는 [창자 개구리] 6마리 때문에 잠을 못 잔대요." },
  jb_hunt_crow: { kind: "hunt", npc: "willow_florist", lv: 16, sk: "gather", mob: "eyecrow", n: 5, text: "꽃집 아이 봄이의 꽃밭을 [눈알 까마귀] 5마리가 노려봐요. 너무 무섭대요!" },
  jb_hunt_boar: { kind: "hunt", npc: "store_kong", lv: 28, sk: "gather", mob: "splitboar", n: 5, text: "심부름꾼 콩콩이 장 보러 가는 길을 [반쪽 멧돼지] 5마리가 막는대요." },
  jb_hunt_moth: { kind: "hunt", npc: "lib_borum", lv: 48, sk: "gather", mob: "mothface", n: 6, when: "night", text: "밤마다 도서관 창문에 [인면 나방]이 달라붙어요. 사서 보름이 6마리만 치워 달래요." },
  jb_hunt_hound: { kind: "hunt", npc: "merc_grey", lv: 52, sk: "gather", mob: "bonehound", n: 6, rep: 10, text: "용병단장 그레이가 단골에게만 맡기는 토벌이에요. [가죽 벗겨진 사냥개] 6마리!" },
  jb_hunt_squid: { kind: "hunt", npc: "dongdong", lv: 68, sk: "gather", mob: "squidrat", n: 6, text: "관리인 동동이 하수구로 기어 올라오는 [촉수 쥐] 6마리를 잡아 달래요. 으, 미끌미끌!" },
  jb_hunt_bear: { kind: "hunt", npc: "merc_grey", lv: 104, sk: "gather", mob: "bearmaw", n: 3, rep: 30, text: "그레이가 믿는 친구에게만 부탁한대요. [아가리 곰] 3마리, 만만치 않을 거예요." },
  jb_hunt_stag: { kind: "hunt", npc: "inn_toto", lv: 128, sk: "gather", mob: "ribdeer_gold", n: 4, text: "졸린 나그네 토토가 단풍 왕도에서 [단풍 갈비뼈 사슴]에게 쫓겼대요. 4마리만 혼내 주세요." },
  jb_hunt_squirrel: { kind: "hunt", npc: "hall_bori", lv: 156, sk: "gather", mob: "blightsquirrel", n: 5, rush: 25, text: "이장 보리가 급해요! 왕도 길목의 [한 꼬리 다람쥐떼] 5무리를 서둘러 정리해 주세요." },
  jb_sc_pipi: { kind: "scout", npc: "hall_pipi", lv: 1, sk: "deliver", map: ["meadow", "forest", "crypt"], text: "지도 제작자 피피가 새 지도에 그릴 곳을 둘러보고 와 달래요. 길만 보고 오면 돼요!" },
  jb_sc_lira: { kind: "scout", npc: "inn_lira", lv: 5, sk: "deliver", map: ["meadow", "forest", "city"], when: "night", text: "음유시인 리라가 밤 풍경 노래를 짓는대요. 깜깜한 밤길을 다녀와서 들려주세요." },
  jb_sc_lumi: { kind: "scout", npc: "cafe_lumi", lv: 10, sk: "deliver", map: ["city", "sewer", "cave"], text: "책벌레 루미가 소설 배경으로 쓸 곳을 직접 보고 와서 이야기해 달래요." },
  jb_sc_mimi: { kind: "scout", npc: "merc_mimi", lv: 15, sk: "deliver", map: ["forest", "crypt", "abyss"], rush: 12, text: "접수원 미미가 급하게 정찰을 부탁해요! 다녀와서 바로 보고해 주세요." },
  jb_sc_sol: { kind: "scout", npc: "willow_bard", lv: 25, sk: "deliver", map: ["cave", "abyss", "maple"], text: "음유시인 솔이 새 노래의 무대를 찾아요. 어떤 곳인지 보고 와서 들려주세요." },
  jb_fish_somi: { kind: "fish", npc: "cafe_somi", lv: 1, sk: "fish", item: "fish_s", n: 4, text: "단골 손님 솜이네 고양이가 [송사리] 4마리를 목 빠지게 기다려요." },
  jb_fish_rain: { kind: "fish", npc: "willow_fisher", lv: 10, sk: "fish", item: "fish_m", n: 3, when: "rain", text: "비 오는 날엔 물고기가 잘 문대요! 낚시꾼 갈대가 [무지개 송어] 3마리를 기다려요." },
  jb_fish_gold: { kind: "fish", npc: "juju", lv: 25, sk: "fish", item: "fish_l", n: 1, rep: 10, text: "쥬쥬가 단골에게만 슬쩍 부탁해요. 귀하디귀한 [황금 잉어] 한 마리!" },
  jb_wood_rain: { kind: "bring", npc: "dongdong", lv: 1, sk: "gather", item: "m_w1", n: 10, when: "rain", rush: 15, text: "비가 새요! 관리인 동동이 지붕 틈을 막을 [마른 가지] 10개가 급하대요." },
  jb_ore_tong: { kind: "bring", npc: "forge_tong", lv: 20, sk: "gather", item: "m_o3", n: 6, text: "견습 대장장이 통통이 캉캉 몰래 연습하려고 [네온 고철] 6개를 찾아요. 비밀이에요!" },
  jb_crys_bogle: { kind: "bring", npc: "bogle", lv: 30, sk: "gather", item: "m_h4", n: 6, rep: 30, text: "보글이 친구에게만 털어놓는 실험이래요. [수정꽃] 6송이, 조심조심!" },
  jb_steam: { kind: "make", npc: "inn_maru", lv: 30, sk: "cook", item: "fd_steam", n: 2, rep: 30, text: "여관 주인 마루가 친구에게만 맡기는 귀빈상이에요. [장님고기 찜] 2접시!" },
  jb_feast: { kind: "make", npc: "diner_reg2", lv: 50, sk: "cook", item: "fd_feast", n: 1, rush: 30, text: "단골 손님 뭉치가 생일 잔치를 열어요! 서둘러 [쥬쥬 특선 정식]을 차려 주세요." },
  jb_elspd: { kind: "make", npc: "inn_toto", lv: 30, sk: "alch", item: "el_spd", n: 2, text: "졸린 나그네 토토가 잠 깨는 데 좋은 [신속의 물약] 2병을 원해요." },
  jb_dl_tale: { kind: "deliver", npc: "story", to: "inn_lira", lv: 5, sk: "deliver", when: "night", text: "이야기꾼 할머니 소담의 옛이야기 책을 여관의 리라에게 갖다주세요. 밤이 깊기 전에!" },
  jb_dl_kong: { kind: "deliver", npc: "store_kong", to: "merc_mimi", lv: 15, sk: "deliver", text: "심부름꾼 콩콩이 깜빡한 장부를 늑대발 용병사무소 미미에게 전해 주세요." },
  jb_dl_lunch: { kind: "deliver", npc: "juju", to: "willow_fisher", lv: 20, sk: "deliver", rep: 10, text: "쥬쥬가 단골에게만 맡기는 배달이에요. 낚시꾼 갈대의 도시락을 버드나무 마을까지!" },
  // 버드나무 마을 chores (H10, 59-chores.js): `job` a CHORES key, `n` spots (× grade) on CHORE_MAP; JB_PAY.chores a day
  jb_ch_milk: { kind: "chore", job: "milk", npc: "willow_dairy", lv: 1, sk: "deliver", n: 4, text: "목장 주인 음메의 아침 우유를 집집마다 우편함에 넣어 주세요. 우유가 미지근해지기 전에!" },
  jb_ch_weed: { kind: "chore", job: "weed", npc: "willow_farmer", lv: 1, sk: "gather", n: 6, text: "텃밭 농부 감자의 텃밭과 뒷마당 풀숲에서 잡초를 뽑아 주세요. 뿌리까지 쏙!" },
  jb_ch_flyer: { kind: "chore", job: "flyer", npc: "willow_flyer", lv: 3, sk: "deliver", n: 5, text: "전단지 아저씨 팔랑의 장터 전단지를 가로등과 게시판, 표지판에 붙여 주세요." },
  jb_ch_litter: { kind: "chore", job: "litter", npc: "willow_sweeper", lv: 1, sk: "gather", n: 6, text: "환경미화원 쓱싹이 길가와 광장에 떨어진 쓰레기를 주워 달래요." },
  jb_ch_water: { kind: "chore", job: "water", npc: "willow_granny", lv: 5, sk: "gather", n: 5, text: "꽃집 할머니 수국의 꽃밭에 물을 주세요. 물뿌리개는 우물이나 물가에서 채워요." },
  jb_ch_dog: { kind: "chore", job: "dog", npc: "willow_florist", lv: 8, sk: "deliver", n: 4, text: "꽃집 아이 봄이의 강아지 콩떡이를 산책시켜 주세요. 나무 냄새 맡는 걸 좋아해요." },
};
/**
 * The village chores (H10). `spot`: what one act is done to (the toast); `src`: what to fetch before the acts —
 * "npc" from the giver (all the acts at once: the milk bottles, the dog's leash) or "water" (a well or the water's
 * edge, `carry` acts a fill); `timed`: the fetch starts a parcel-like clock and running out fails the job (never
 * 긴급); `box`: the carry code (58-life.js carryOf) held in both hands while acts are carried. CHORE: act reach (px), the least ms between two acts, the reach of a water source (tiles), weeds within this many tiles of
 * the 제초 giver (the farmer's plot and backyard).
 */
const CHORE_MAP = "willow";
const CHORES = {
  milk: { name: "우유 배달", spot: "우편함", src: "npc", timed: true, box: 2, get: "우유병을 받았습니다" },
  weed: { name: "제초", spot: "잡초" },
  flyer: { name: "전단지 붙이기", spot: "전단지" },
  litter: { name: "쓰레기 줍기", spot: "쓰레기" },
  water: { name: "꽃밭 물주기", spot: "꽃밭", src: "water", carry: 3, get: "물뿌리개를 가득 채웠습니다" },
  dog: { name: "강아지 산책", spot: "나무", src: "npc", get: "콩떡이의 목줄을 잡았습니다" },
};
const CHORE = { range: 28, gap: 500, src: 1, weed: 12 };
/**
 * Board v2 grades, rolled per offer from (name, day, id): 0 쉬움 · 1 보통 · 2 어려움 by weight `odds`. Items and
 * monsters × n (rounded up), a parcel's time × lim, scouting goes to map[grade]; gold, life XP and trust × pay.
 */
const JB_GRADE = { name: ["쉬움", "보통", "어려움"], odds: [45, 35, 20], n: [1, 1.5, 2], lim: [1, 0.8, 0.65], pay: [1, 1.6, 2.5] };
/** 긴급: one non-delivery offer in `odds` (and every `rush` row) must be finished within `min` minutes (the row's `rush` wins) for gold × bonus; late it still pays without the bonus. */
const JB_RUSH = { odds: 4, min: 15, bonus: 1.5 };
/**
 * What a board job pays (B.8, B.9): gold gold[0] + gold[1]·L (deliveries dGold, plus up to `tip` more by the time
 * left), life XP lifeNeed(L)·xp in the job's skill, trust `rep` with the NPC (deliveries: repTo with the
 * recipient, repFrom with the sender); `perDay` jobs a day from `offers` offers plus `chores` village chores; L is
 * the job's skill level (perDay 3 → 4 with the chores, 2026-11-15).
 * A parcel's time limit is path·T / (BASE_SPD·limit[0]) × limit[1] + limit[2] ms (a door counts `door` tiles);
 * carrying it you move at spd[0] + spd[1]·L (0.85 at 1, 1.0 at 25, 1.15 at 50).
 */
const JB_PAY = { gold: [120, 24], dGold: [80, 16],   // ×4 on 2026-11-15: 알바 is a main gold source (hunting gold × HUNT_GOLD)
  tip: 0.5, xp: 0.25, rep: 2, repTo: 3, repFrom: 1, perDay: 4, offers: 4, chores: 2, limit: [0.85, 1.8, 20000], spd: [0.85, 0.006], door: 2 };
/** A delivery's path in tiles, worked out on first use by `jbRoute` (58-life.js) and kept here. */
const JB_ROUTES = {};
/**
 * NPC trust (B.9) `rep {npcId: 0..100}`, from finished 알바 only. Tiers: 단골 (REP_DISC at their counter, REP_TIP
 * on their 알바 gold), 친구 (the perk below), 가족 (a title: ACH `rep_<id>`). REP_PERK[id] = { who, title, recipe?
 * (taught at 친구), great? (%p 대성공 on stove dishes), elx? (minutes added to every elixir drunk) }.
 */
const REP_TIER = [10, 30, 60], REP_NAME = ["단골", "친구", "가족"], REP_DISC = 0.95, REP_TIP = 1.1;
const REP_PERK = {
  cafe_moka: { who: "모카", title: "모카의 단골", recipe: "cafe_pie" },
  inn_maru: { who: "마루", title: "마루의 단골", recipe: "inn_stew" },
  kangkang: { who: "캉캉", title: "캉캉의 단골", recipe: "stone_x2" },
  bogle: { who: "보글", title: "보글의 단골", elx: 5 },
  juju: { who: "쥬쥬", title: "쥬쥬의 단골", great: 10 },
};
/** Titles at Lv 50 in each skill (ACH `life50_<skill>`), LIFE order. */
const LIFE_MASTER = ["명인 낚시꾼", "명인 요리사", "명인 채집꾼", "명인 대장장이", "명인 연금술사", "명인 배달부"];

// ── fields the later phases fill (the sheet carries them from L1 on, so they never bump it again)
/** The co-op part-time jobs (C1–C3), by the building they run in. */
const COOP_KINDS = ["apt", "diner", "forge", "alch", "pipe", "lib"];
/** The 재료 주머니 holds materials (ingots too), staples and flasks, up to this many of each. */
const POUCH_MAX = 999;

// ── 협동 아르바이트 (C1, 68-coop.js; docs/design/life-and-coop.md C, "As built — co-op v1")
/**
 * The shared engine's numbers. parN scales the cut-offs and the spawn tempo by the party size at the start: co-op jobs
 * are party-only, 2–4 (owner, 2026-11-15; a shift that drops to 1 goes on at its starting size). Rewards by grade C B A S (C.7).
 */
const COOP_T = {
  briefMs: 8000, feverMs: 60000, endMs: 30000, emptyMs: 20000, max: 6, actMs: 250, near: 56, reach: 28, station: 26,
  zzzMs: 45000, idleMs: 90000, lazy: 0.15, cuts: [0.30, 0.50, 0.70, 0.88], parN: { 2: 1, 3: 1.35, 4: 1.65 },
  // one base reward (about the old A: gold ×2.5 on 2026-11-15, 알바 as a main gold source) × the grade's share C B A S
  // (owner, 2026-11-15: 100 · 105 · 110 · 120 %) for gold, XP and life XP; stones and the gear's rarity stay at base
  base: { gold: 200, xp: 0.20, life: 0.60, stone: 3, gearQ: 1 }, gradeK: [1, 1.05, 1.1, 1.2],
  rep: 5,
};
const COOP_TOOLS = { broom: "빗자루", bin: "쓰레기통", pan: "프라이팬", tray: "쟁반", tongs: "집게", hammer: "망치", fan: "부채", bellows: "풀무", pipein: "급수 담당", pipeout: "배수 담당", desk: "접수 담당", sort: "분류 담당" };
/**
 * 캉캉's big forge hall (forge v2 + ingots; owner, 2026-11-15: "전용 인스턴스 공간은 지금 크기보다 훨씬 크게"): 64×44 like 보글's
 * (the v1 room was 30×16). West: four ingot crates `]` (철 · 은 · 금 · 미스릴, north to south) and the rack `>`; two furnaces `<`
 * with lanterns; four anvils `&` in the middle; two quench barrels `w`; the 진열대 (six counter tiles `m`) far east, 12 tiles
 * from the barrels, with the customers' aisle east of it and their door by the front wall; work benches along the south.
 */
const HALL = { W: 64, H: 44, crate: [[8, 13], [8, 17], [8, 21], [8, 25]], furnace: [[13, 15], [13, 23]], anvil: [[22, 13], [22, 25], [29, 13], [29, 25]],
  quench: [[36, 16], [36, 22]], shelfX: 48, shelfY: 16, door: [49, 41], rack: [4, 32] };
const COOP_HALL = (() => {
  const { W, H } = HALL, o = Array.from({ length: H }, (_, y) => (y === 0 ? "+===^===".repeat(W / 8) : y === H - 1 ? "_".repeat(W) : "=" + " ".repeat(W - 2) + "_").split(""));
  const put = (ch, x, y) => { o[y][x] = ch; };
  for (const [k, ch] of [["crate", "]"], ["furnace", "<"], ["anvil", "&"], ["quench", "w"]]) for (const [x, y] of HALL[k]) put(ch, x, y);
  for (let i = 0; i < 6; i++) put("m", HALL.shelfX, HALL.shelfY + i);
  put(">", HALL.rack[0], HALL.rack[1]);
  for (const [x, y] of HALL.furnace) { put("*", x - 2, y - 1); put("*", x + 2, y - 1); }
  put("g", 1, 1); put("g", W - 2, 1); put("g", 1, H - 2); put("g", W - 2, H - 2);
  for (let x = 16; x <= 23; x++) put("-", x, 36);
  for (let x = 34; x <= 41; x++) put("-", x, 36);
  return o.map((r) => r.join(""));
})();
/**
 * 동동아파트 (apt v3; owner, 2026-11-15: "전용 인스턴스 공간은 지금 크기보다 훨씬 크게"): 64×37 (was 45×19), built in code like HALL.
 * Two wings: 윗동 (ten flats north and south of corridor A, y 8–10) and 아랫동 (eight flats round corridor B, y 26–28), joined by
 * the stairwell (x 27–30, y 11–25) where the tool rack stands; the bins empty at the dumpster in the back yard (뒷마당, x 53–62,
 * y 19–35) through the back door at corridor B's east end, the far end from 윗동. `rows`: [y0, y1, door row, flats]; the
 * middle rows give their third column to the stairwell (a flat x 32–38 beside it).
 */
const APT = { W: 64, H: 37, cols: [[1, 12], [14, 25], [27, 38], [40, 51], [53, 62]], stair: [27, 30, 11, 25], yard: [53, 19, 62, 35],
  rows: [[1, 6, 7, 5], [12, 17, 11, 5], [19, 24, 25, 4], [30, 35, 29, 4]], dump: [60, 27], rack: [29, 12] };
const APT_MAP = (() => {
  const { W, H } = APT, o = Array.from({ length: H }, (_, y) => (y === 0 ? "+===^===".repeat(W / 8) : y === H - 1 ? "_".repeat(W) : "=" + " ".repeat(W - 2) + "_").split(""));
  const g = Array.from({ length: H }, () => "f".repeat(W).split("")), rooms = [];
  const put = (ch, x, y) => { o[y][x] = ch; };
  const [sx0, sx1, sy0, sy1] = APT.stair, stair = (x, y) => x >= sx0 && x <= sx1 && y >= sy0 && y <= sy1;
  for (let x = 1; x < W - 1; x++) if (!stair(x, 18)) put("b", x, 18);
  APT.rows.forEach(([y0, y1, dr, n], ri) => {
    const east = n === 5 ? W - 2 : APT.yard[0] - 2;
    for (let x = 1; x <= east; x++) if (!stair(x, dr)) put("m", x, dr);
    const cols = APT.cols.slice(0, n).map((c, i) => (i === 2 && (ri === 1 || ri === 2) ? [sx1 + 2, c[1]] : c));
    cols.forEach(([x0, x1], i) => {
      rooms.push([x0, y0, x1, y1]);
      const cx = (x0 + x1) >> 1, back = dr > y1 ? y0 : y1;
      for (let y = y0; y <= y1; y++) { if (x1 + 1 < W - 1) put("b", x1 + 1, y); if (x0 - 1 > 0) put("b", x0 - 1, y); }
      put(" ", cx, dr); put(" ", cx + 1, dr);
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) g[y][x] = "uqlu"[(ri + i) % 4];
      put("p", x0 + 1, back); put("p", x0 + 2, back); put("r", x1 - 1, back); put("o", cx, (y0 + y1) >> 1);
      if (x1 - x0 > 8) put("s", cx + 2, (y0 + y1) >> 1);
    });
  });
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (stair(x, y)) { o[y][x] = " "; g[y][x] = "y"; }
  for (const [y0, y1] of [[8, 10], [26, 28]]) for (let y = y0; y <= y1; y++) for (let x = 1; x < W - 1; x++) if (o[y][x] === " ") g[y][x] = "h";
  // the back yard: flagstones, the dumpster `]` (station dump), barrels and plants; the back door at corridor B's east end
  const [yx0, yy0, yx1, yy1] = APT.yard;
  for (let y = yy0; y <= yy1; y++) { put("b", yx0 - 1, y); for (let x = yx0; x <= yx1; x++) { o[y][x] = " "; g[y][x] = "x"; } }
  for (let y = 26; y <= 28; y++) { put(" ", yx0 - 1, y); g[y][yx0 - 1] = "e"; }
  put("]", ...APT.dump); put("w", 62, 20); put("w", 62, 21); put("w", 62, 34); put("g", 53, 19); put("g", 53, 35); put("]", 61, 23);
  put(">", ...APT.rack); put("g", 1, 8); put("g", 62, 8); put("g", 1, 28);
  return { ground: g.map((r) => r.join("")), objects: o.map((r) => r.join("")), rooms };
})();
/**
 * 쥬쥬식당's hall (diner v2; owner, 2026-11-15: "훨씬 크게 … 손님이 계속 몰려오게"): 64×36 (was 44×24), built in code. The kitchen
 * along the north wall (four stoves `:`, three boards `-`, the crates 채소 `]` · 생선 `w` · 고기 `]`, the trash `w`, the sink `r`),
 * the counter at y 7 with an 8-tile pass round the rack and two gaps, and a hall of 20 tables (4 rows × 5, 4–28 tiles from the pass).
 */
const DIN = { W: 64, H: 36, stove: [[6, 1], [10, 1], [14, 1], [18, 1]], board: [[24, 1], [27, 1], [30, 1]], veg: [36, 1], fish: [39, 1], meat: [42, 1],
  trash: [48, 1], sink: [52, 1], pass: [[27, 7], [28, 7], [29, 7], [30, 7], [32, 7], [33, 7], [34, 7], [35, 7]], rack: [31, 7], gaps: [12, 50],
  tables: [12, 18, 24, 30].flatMap((y) => [7, 19, 31, 43, 55].map((x) => [x, y])) };
const DIN_MAP = (() => {
  const { W, H } = DIN, o = Array.from({ length: H }, (_, y) => (y === 0 ? "+===^===".repeat(W / 8) : y === H - 1 ? "_".repeat(W) : "=" + " ".repeat(W - 2) + "_").split(""));
  const g = Array.from({ length: H }, (_, y) => (y >= 1 && y <= 6 ? "l" + "x".repeat(W - 2) + "l" : y === 15 || y === 21 || y === 27 ? "l" + "y".repeat(W - 2) + "l" : "l".repeat(W)));
  const put = (ch, x, y) => { o[y][x] = ch; };
  for (let x = 1; x < W - 1; x++) put("m", x, 7);
  for (const x of DIN.gaps) { put(" ", x, 7); put(" ", x + 1, 7); }
  put(">", ...DIN.rack); put("r", 2, 1); put("r", 60, 1);
  for (const t of DIN.stove) put(":", ...t);
  for (const t of DIN.board) put("-", ...t);
  put("]", ...DIN.veg); put("w", ...DIN.fish); put("]", ...DIN.meat); put("w", ...DIN.trash); put("r", ...DIN.sink);
  for (const [x, y] of DIN.tables) { put("k", x - 1, y); put("o", x, y); put("k", x + 1, y); }
  put("g", 1, 8); put("g", W - 2, 8); put("g", 1, H - 2); put("g", W - 2, H - 2); put("s", 20, H - 2); put("s", 42, H - 2); put("#", 31, H - 2);
  return { ground: g, objects: o.map((r) => r.join("")) };
})();
/** The jobs: name, owner NPC and lobby, shift minutes, the two tools (rotation A B A B), par, combo window, life skill, template. */
const COOP = {
  apt: {
    name: "동동아파트 청소", npc: "dongdong", lobby: "dongdong_apt", mins: 5, tools: ["broom", "bin"], combo: 20000, skill: "deliver",
    // the score is the 청소율 in ‰ (1000 = spotless), so the cut-offs are shares of it: par 1000 · parN[n] · cuts, tuned on walking
    // bots (tests/coop.mjs, owner 2026-11-15: hard, mess keeps coming): quick bots (an act every 300 ms) 604 · 650 · 766 ‰, just over S
    // (581 · 625 · 739); realistic ones (every 400 ms, walking at 90 %) 448 · 473 · 520, B
    par: 1000, parN: { 2: 0.66, 3: 0.71, 4: 0.84 },
    hint: "빗자루로 먼지를 쓸어 모으면, 쓰레기통 담당이 주워 담아 뒷마당(아랫동 동쪽 끝 뒷문)의 버리는 곳에 버려요. 청소율을 최대한 올리세요!",
    // stations (tiles; solid furniture, used from a neighbouring tile): the dumpster in the back yard, the tool rack in the stairwell
    st: { dump: APT.dump, rack: APT.rack },
    start: [[28, 14], [29, 14], [28, 16], [29, 16]],
    rooms: APT_MAP.rooms,
    tpl: { name: "동동아파트 (근무 중)", theme: "interior", style: "lobby", bgm: "clean", safe: true, w: APT.W, h: APT.H, entry: [28, 15], ground: APT_MAP.ground, objects: APT_MAP.objects },
  },
  diner: {
    name: "쥬쥬식당 서빙", npc: "juju", lobby: "juju_diner", mins: 5, tools: ["pan", "tray"], combo: 25000, skill: "cook",
    hint: "프라이팬 담당은 상자에서 재료를 꺼내 도마·화덕을 거쳐 패스대에, 쟁반 담당은 패스대의 요리를 주문한 테이블로! 손님이 계속 몰려와요.",
    // cut-offs tuned on walking bots in the 64×36 hall (tests/coop.mjs: clearing and washing plates; owner 2026-11-15: hard, customers flood in):
    // quick bots (an act every 300 ms) 391 · 804 · 1,467, just over S; realistic ones (every 600 ms, walking at 90 %) 414 · 719 · 985 (S · A · B)
    par: 1000, parN: { 2: 0.43, 3: 0.89, 4: 1.62 },
    // stations (tiles; solid furniture on the kitchen's back wall, used from the tile below; the pass and the rack on the counter at y 7)
    st: { stove: DIN.stove, board: DIN.board, veg: DIN.veg, fish: DIN.fish, meat: DIN.meat, trash: DIN.trash, sink: DIN.sink, pass: DIN.pass, rack: DIN.rack },
    tables: DIN.tables,
    start: [[29, 4], [33, 4], [29, 9], [33, 9]],
    tpl: { name: "쥬쥬식당 (영업 중)", theme: "interior", style: "tavern", bgm: "juju", safe: true, w: DIN.W, h: DIN.H, entry: [31, 9], ground: DIN_MAP.ground, objects: DIN_MAP.objects },
  },
  forge: {
    name: "캉캉대장간 단조", npc: "kangkang", lobby: "kangkang_forge", mins: 5, tools: ["tongs", "hammer"], combo: 40000, skill: "craft",
    hint: "집게 담당은 주문의 색을 보고 맞는 주괴(철·은·금·미스릴)를 상자에서 꺼내 화덕(풀무질로 60~80도) → 달군 주괴를 모루에, 망치 담당은 음표에 맞춰 두드리고(화살표 음표는 방향키) 담금질 → 진열대! 손님이 계속 몰려와요.",
    // the forge engine's words (68-coop.js): piece and grade names, messages
    skin: { orders: ["편자", "단검", "검날", "투구", "냄비", "방패", "갑옷"], grades: ["걸작", "상", "중", "하"], txt: {
      busy: "이 모루는 사용 중이에요 — 옆 모루로!", first: "들고 있는 것을 먼저 담금질하고 진열대에 올리세요",
      cooled: "식었어요 — 집게로 다시 달구세요!", a: ["주문 색에 맞는 주괴 상자에서 주괴를 꺼내세요 (화덕 앞에서는 풀무질!)", "달군 주괴를 빈 모루에 올리세요", "화덕에 넣어 달구세요 (상자에 도로 넣을 수도 있어요)"],
      b: ["모루 위 달군 쇠를 음표에 맞춰 두드리세요", "담금질 통에 식히세요", "진열대(동쪽)에 올리세요"], full: "진열대가 꽉 찼어요 — 손님을 기다리세요!",
      flip: "뒤집기! 화살표 음표는 방향키로", noflip: "방향키는 화살표 음표에서만!", duet: "갑옷은 번갈아 쳐요 — 받는 음표는 다른 사람이!" } },
    // hard cut-offs (owner, 2026-11-15) tuned on walking bots in the 64×44 hall with ingots (tests/coop.mjs): near-perfect bots
    // (92 % perfect) score ≈ 816 · 2,265 · 2,837, just over S; realistic ones (55 / 30 / 15 %) ≈ 597 · 1,612 · 1,812, B
    par: 1000, parN: { 2: 0.86, 3: 2.38, 4: 2.99 },
    // stations (tiles; solid furniture, used from a neighbouring tile; COOP_HALL): the four ingot crates `]` (index = metal),
    // furnaces `<`, anvils `&`, quench barrels `w`, the 진열대 (six counter tiles `m`, far east) and the rack `>`; customers
    // come in at `door` and wait in the aisle east of the counter (`seats`, one per shelf slot)
    st: { crate: HALL.crate, furnace: HALL.furnace, anvil: HALL.anvil, quench: HALL.quench, shelf: [0, 1, 2, 3, 4, 5].map((i) => [HALL.shelfX, HALL.shelfY + i]), rack: HALL.rack },
    seats: [0, 1, 2, 3, 4, 5].map((i) => [HALL.shelfX + 1, HALL.shelfY + i]), door: HALL.door,
    start: [[14, 16], [22, 14], [14, 22], [29, 14]],
    tpl: {
      name: "캉캉대장간 · 대형 단조장 (작업 중)", theme: "interior", style: "forge", bgm: "forge", safe: true, w: HALL.W, h: HALL.H, entry: [20, 19],
      ground: Array.from({ length: HALL.H }, () => "x".repeat(HALL.W)), objects: COOP_HALL,
    },
  },
};
const PIPE_ROOM = { w: 22, h: 18 };
COOP.pipe = {
  name: "마을회관 배관이 터졌어요!", npc: "popo", lobby: "town_hall", mins: 5, tools: ["pipein", "pipeout"],
  par: 135, gradeSec: [0, 45, 90, 135], skill: "craft",
  hint: "급수구와 배수구를 양쪽에서 이어 주세요. 배관의 방향은 고정이고, 망치로 바위를 한 칸 깰 수 있어요.",
  st: {}, start: [[8, 10], [13, 10], [8, 12], [13, 12]],
  tpl: {
    name: "버드나무광장 회관 · 수리 구역", theme: "interior", style: "hall", bgm: "hall", safe: true,
    ...PIPE_ROOM, entry: [10, 12],
    ground: Array.from({ length: PIPE_ROOM.h }, (_, y) => y >= 6 && y < 13 ? "l".repeat(5) + "y".repeat(12) + "l".repeat(5) : "l".repeat(PIPE_ROOM.w)),
    objects: Array.from({ length: PIPE_ROOM.h }, (_, y) => y === 0 ? "=".repeat(PIPE_ROOM.w)
      : y === PIPE_ROOM.h - 1 ? "_".repeat(PIPE_ROOM.w) : "=" + " ".repeat(PIPE_ROOM.w - 2) + "_"),
  },
};

/**
 * 보글's big kiln hall (alch v2; owner, 2026-11-15: every co-op shift runs in its own big hall, "the same building" but roomier):
 * 64×44 (5.9× the forge's 30×16 room; owner: "훨씬 크게"). The kiln `<` in the middle with four 풀무 tiles round its north
 * half and lanterns, the cauldron `&` 3 tiles in front of it; the herb wall west (`]` between two shelves, 21 tiles from the
 * cauldron), the rack `>`, the 진열대 (six counter tiles `m`, 21 tiles east) with the customers' aisle east of it and their door
 * by the front wall; shelves, jars, glassware, work benches and 보글's lectern for flavour. Positions: LAB.
 */
const LAB = { W: 64, H: 44, kiln: [31, 18], pot: [31, 21], herbs: [10, 21], rack: [4, 30], shelfX: 52, shelfY: 18, door: [53, 41] };
const COOP_LAB = (() => {
  const { W, H } = LAB, o = Array.from({ length: H }, (_, y) => (y === 0 ? "+===^===".repeat(W / 8) : y === H - 1 ? "_".repeat(W) : "=" + " ".repeat(W - 2) + "_").split(""));
  const put = (ch, x0, x1, y) => { for (let x = x0; x <= x1; x++) o[y][x] = ch; };
  const [kx, ky] = LAB.kiln, [hx, hy] = LAB.herbs;
  put("b", 3, 12, 1); put(")", 14, 14, 1); put(";", 15, 20, 1); put(")", 22, 22, 1); put("b", 38, 46, 1); put(";", 48, 51, 1); put("w", 58, 60, 1);
  put("g", 1, 1, 1); put("g", W - 2, W - 2, H - 2); put("g", 1, 1, H - 2); put("t", 1, 1, 10); put("t", 1, 1, 11); put("t", 1, 1, 12);
  put("<", kx, kx, ky); put("*", kx - 3, kx - 3, ky - 2); put("*", kx + 3, kx + 3, ky - 2); put("&", LAB.pot[0], LAB.pot[0], LAB.pot[1]);
  put("r", hx, hx, hy - 1); put("]", hx, hx, hy); put("r", hx, hx, hy + 1); put(">", LAB.rack[0], LAB.rack[0], LAB.rack[1]);
  for (let i = 0; i < 6; i++) put("m", LAB.shelfX, LAB.shelfX, LAB.shelfY + i);
  put("-", 16, 23, 32); put(")", 16, 16, 31); put(";", 23, 23, 31); put("-", 38, 45, 32); put(")", 45, 45, 31); put("|", 40, 40, 9);
  put("-", 16, 23, 9); put(";", 18, 18, 8); put("b", 3, 8, H - 2);
  return o.map((r) => r.join(""));
})();
/**
 * 보글연금공방 가마 v2 (owner's concept, 2026-11-15; H9): 풀무 players play ↑→↓← notes at the kiln to heat it, the 부채 holder
 * picks herbs in the recipe's colour order, pours them in, fans a boil-over down, bottles and carries potions to the 진열대,
 * where customers buy them (the forge's shop). Rules COOP_JOB.alch (68-coop.js), numbers COOP_BREW.
 */
COOP.alch = { ...COOP.forge, name: "보글연금공방 가마", npc: "bogle", lobby: "bogle_lab", tools: ["bellows", "fan"], skill: "alch",
  // hard cut-offs (owner, 2026-11-15) tuned on walking bots in the 64×44 hall (tests/coop.mjs): near-perfect bots (92 % perfect,
  // quick at every station) score ≈ 1,353 · 2,722 · 3,145, just over S; realistic ones (55 / 30 / 15 %, slower) ≈ 1,166 · 1,997 · 2,649, B–A
  par: 1000, parN: { 2: 1.43, 3: 2.89, 4: 3.34 },
  // stations (tiles; solid furniture, used from a neighbouring tile; COOP_LAB): the herb shelf, the kiln (풀무 stand round
  // it), the cauldron in front of it, the 진열대 and its seats, the rack; customers come in at `door`
  st: { herbs: LAB.herbs, kiln: LAB.kiln, pot: LAB.pot, shelf: [0, 1, 2, 3, 4, 5].map((i) => [LAB.shelfX, LAB.shelfY + i]), rack: LAB.rack },
  seats: [0, 1, 2, 3, 4, 5].map((i) => [LAB.shelfX + 1, LAB.shelfY + i]), door: LAB.door,
  start: [[LAB.kiln[0] - 1, LAB.kiln[1] - 1], [LAB.kiln[0] + 1, LAB.kiln[1] - 1], [LAB.kiln[0] - 1, LAB.kiln[1]], [LAB.pot[0], LAB.pot[1] + 2]],
  hint: "풀무 담당은 가마 앞에서 F로 풀무를 잡고 화살표 음표에 맞춰 방향키! 부채 담당은 약재 선반에서 색 순서대로 약재 → 가마솥 → 병에 담아 진열대로. 온도계의 띠를 지키세요!",
  skin: { orders: ["빨간 물약", "파란 물약", "엘릭서", "묘약", "해독제", "무지개 물약"], grades: ["명약", "상", "중", "하"], txt: {
    full: "진열대가 꽉 찼어요 — 손님을 기다리세요!", busy: "가마솥이 아직 끓고 있어요 — 다 되면 부으세요",
    keys: "방향키로 풀무질! (F: 풀무 놓기)", herbBad: "약재 순서가 틀렸어요! 선반에서 F로 다시", fanOnly: "약재와 불 조절은 부채 담당이 해요",
    calm: "넘쳐요! 부채로 F 연타해서 가라앉히세요", a: ["약재 선반에서 F, 방향키로 색 순서대로 약재를 담으세요", "약재를 가마솥에 부으세요", "진열대(동쪽)에 올리세요"],
    b: ["가마 앞에서 F로 풀무를 잡으세요", "가마 앞에서 F로 풀무를 잡으세요", "진열대(동쪽)에 올리세요"] } },
  tpl: { name: "보글연금공방 · 대형 가마실 (작업 중)", theme: "interior", style: "lab", bgm: "brew", safe: true, w: LAB.W, h: LAB.H, entry: [LAB.pot[0], LAB.pot[1] + 3],
    ground: Array.from({ length: LAB.H }, () => "x".repeat(LAB.W)), objects: COOP_LAB } };
/**
 * 보글's kiln (alch v2). The kiln's heat H (0–100) cools toward `amb` by `cool[n]`·(H − amb)/s (more 풀무, a hungrier kiln: everyone pumps); a 풀무 note on the shared chart
 * (`chart` [beat, dir 0 ↑ · 1 → · 2 ↓ · 3 ←] over a `loop`-beat bar at `per[n]` ms a beat, from the run's start + `leadMs`) is
 * judged after the player's own offset (median of the last 5, ±`latMax`): within `perfect` +`heat[0]`, within `good` +`heat[1]`,
 * a wrong key or a press off the beat −`heat[2]`; a note nobody plays just passes. Two or more players on the same note
 * (perfect or good): +`joint` per extra player ("합동 풀무!"); a note while the brew is in band stirs it on `stir` ms (perfect, good, joint). A recipe (`orders`: pts, band lo–hi, `hold` ms in band, herbs in
 * order 0 붉은 꽃잎 ↑ · 1 푸른 이끼 → · 2 황금 뿌리 ↓ · 3 보라 버섯 ←, `at`) brews while H is in its band; its grade is the share of
 * time in band after it first got there, −`boilQ` a boil-over (`grades` [min share, ×pts]). Over `hi + over` for `overMs`, or
 * done and left `doneMs`: it boils over; `foam` fan acts calm it (each −`calmHeat`), else it is lost after `ruinMs`
 * (−`ruinPen`, combo 0). A fan act at a brewing cauldron trims −`trim`. The shop: as the forge's (open, orderMs, deadMs, walk…).
 */
const COOP_BREW = {
  orders: [
    { pts: 40, lo: 30, hi: 45, hold: 8000, herbs: [0, 0] },            // 빨간 물약: low and quick
    { pts: 50, lo: 45, hi: 60, hold: 9000, herbs: [1, 0, 1] },         // 파란 물약
    { pts: 65, lo: 60, hi: 74, hold: 10000, herbs: [2, 0, 2] },        // 엘릭서
    { pts: 85, lo: 76, hi: 90, hold: 11000, herbs: [3, 1, 3, 2] },     // 묘약: high, wants the bellows together
    { pts: 50, lo: 38, hi: 52, hold: 9000, herbs: [1, 2] },            // 해독제
    { pts: 110, lo: 64, hi: 84, hold: 13000, herbs: [0, 1, 2, 3], at: 60000 },   // 무지개 물약: long, from 1:00
  ],
  chart: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 1], [4.5, 3], [5, 0], [6, 2], [7, 0]], loop: 8, per: { 2: 600, 3: 560, 4: 520 },
  amb: 20, H0: 20, cool: { 2: 0.05, 3: 0.11, 4: 0.16 }, heat: [5, 3, 2], joint: 2, perfect: 130, good: 260, latMax: 150, leadMs: 1500,
  stir: [300, 180, 200], over: 6, overMs: 1500, doneMs: 7000, foam: 5, calmHeat: 3, ruinMs: 9000, ruinPen: 15, trim: 6, boilQ: 0.25,
  // hard (owner, 2026-11-15: "손님이 계속 몰려오게"): a customer every few seconds, up to six waiting, short patience
  open: { 2: 5, 3: 6, 4: 6 }, orderMs: { 2: 6000, 3: 4500, 4: 3500 }, firstMs: 1000, deadMs: 55000, latePen: 20,
  walk: 48, browseMs: 1200, leaveMs: 2500, syncMs: 500,
  grades: [[0.75, 1.6], [0.55, 1.3], [0.35, 1.0], [-1e9, 0.5]], timeK: 0.3, tongsK: 0.45, hammerK: 0.55,
};
/**
 * 캉캉대장간 단조 v2 (owner's concept, 2026-11-15; C.6 and H8). Furnaces as v1 (T loses `decay`/s, a tongs act pumps +`pump`,
 * a bar heats +`heatIn`/s at T ≥ `lo`, +`heatLo`/s from 30, scorches above `scorch`; hot `hotMs` out of the fire). On an anvil
 * each piece plays its own pattern `pat` ([beat, note]: 0 a blow · 1 the answer of a second worker (갑옷) · 2–5 a flip with
 * ↑ → ↓ ←) at `per` ms a beat (×`feverK` in fever), the first note `leadMs` after placing. A note within `perfect` ms is +2,
 * within `good` +1, else −1 (after the player's own offset: median of the last 5, ±`latMax`); a missed note also takes
 * `missCool` ms off the bar's heat, which lasts the pattern + `slackMs`; cooled, the tongs reheat it (from `reheat`) and the
 * pattern goes on. Grade by quality q vs notes N (`grades` [min q/N, ×pts]). Quenched pieces go on the 진열대; customers (at
 * most `open[n]`, a new one every `orderMs[n]`, `n + 1` at the open) walk in at `walk` px/s, look `browseMs`, buy the best
 * piece of the kind they came for: pts × grade × (1 + `timeK`·patience left) × mult, tongs `tongsK` / hammers `hammerK`;
 * after `deadMs` they leave angry (−`latePen`, combo 0). A new customer wants a piece nobody waits for on the shelf first.
 */
const COOP_FORGE = {
  // 편자 · 단검 · 검날 · 투구 · 냄비 · 방패 · 갑옷 (COOP.forge.skin.orders); `at`: ms into the shift before anyone orders it
  orders: [
    { pts: 40, per: 700, pat: [[0, 0], [1, 0], [2, 0], [4, 0], [5, 0], [6, 0]] },                                        // 편자: short, light, 3-beat
    { pts: 45, per: 640, pat: [[0, 0], [0.5, 0], [2, 0], [2.5, 0], [4, 0], [4.5, 0], [6, 0]] },                          // 단검: quick pairs
    { pts: 75, per: 760, pat: [[0, 0], [1, 0], [2, 0], [3, 0], [3.75, 0], [4.5, 0], [5.25, 0], [5.75, 0], [6.25, 0], [6.75, 0], [7.25, 0]] },   // 검날: a long chain that speeds up
    { pts: 60, per: 700, pat: [[0, 0], [1.5, 0], [2, 0], [3.5, 0], [4, 0], [5.5, 0], [6, 0], [7, 0]] },                  // 투구: off the beat
    { pts: 55, per: 760, pat: [[0, 0], [1, 0], [2, 0], [3, 0], [4.5, 4], [5.5, 0], [6.5, 0], [7.5, 0]] },                // 냄비: 뒤집기 (↓) halfway
    { pts: 65, per: 900, pat: [[0, 0], [1, 0], [2, 0], [3, 5], [4, 0], [5, 0], [6, 3]] },                                // 방패: slow and heavy, turned ← then →
    { pts: 95, per: 680, at: 60000, pat: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1], [6, 0], [7, 1], [8, 0], [9, 1]] },   // 갑옷: call and response
  ],
  // the four ingots (owner, 2026-11-15): every order names its piece's colour (`col` + piece: "금빛 투구" = 금주괴); a dearer
  // ingot heats `heat`× longer, plays its pattern at `tempo`× the beat with `win`× the judge windows, and sells for `price`×;
  // `w`: how often customers ask for it
  metals: [
    { name: "철주괴", col: "잿빛", heat: 1, tempo: 1, win: 1, price: 1, w: 4 },
    { name: "은주괴", col: "은빛", heat: 1.25, tempo: 0.96, win: 0.94, price: 1.3, w: 3 },
    { name: "금주괴", col: "금빛", heat: 1.5, tempo: 0.92, win: 0.88, price: 1.6, w: 2 },
    { name: "미스릴주괴", col: "청록빛", heat: 1.8, tempo: 0.88, win: 0.82, price: 2, w: 2 },
  ],
  open: { 2: 4, 3: 6, 4: 6 }, orderMs: { 2: 8000, 3: 6000, 4: 4500 }, firstMs: 1000, deadMs: 80000, latePen: 15,
  T0: 60, decay: 4, pump: 9, pumpMs: 300, lo: 60, hi: 80, scorch: 90, heatIn: 14, heatLo: 4, scorchQ: 0.5, hotMs: 12000, reheat: 50, slots: 2,
  leadMs: 1000, feverK: 0.85, perfect: 130, good: 260, latMax: 150, missCool: 1000, slackMs: 4000, laneMs: 90,
  walk: 48, browseMs: 1200, leaveMs: 2500,
  grades: [[1.6, 1.5], [1.0, 1.3], [0.4, 1.0], [-1e9, 0.6]], timeK: 0.3, tongsK: 0.45, hammerK: 0.55, syncMs: 1000,
};
/**
 * 쥬쥬식당 서빙 (C.5, v1 + dirty plates, three dishes). By the party size n at the start: at most `seats[n]` tables
 * order at once, a new order every `orderMs[n]` (n of them at the open), patience `patience[n]` (×feverK in fever).
 * A dish: from its crate, `chop` acts at a board, then `cook` ms on a stove (burnt `burnMs` after it is done), plated
 * at the pass; a tray carries 2 to the table that ordered it. Pay `pts × (1 + 0.5·patience left)`, cook 50 % / server 50 %.
 * The customers eat `eatMs`, then leave a dirty plate that keeps the table closed until a tray takes it (one tray slot) to the
 * sink; `washN` acts there wash it for `washPts`. Plating needs no clean plate (washing only pays and frees tables).
 */
const COOP_DINER = {
  dishes: [
    { name: "채소 샐러드", crate: "veg", chop: 4, cook: 0, pts: 20, at: 0 },
    { name: "생선구이", crate: "fish", chop: 0, cook: 6000, pts: 30, at: 0 },
    { name: "고기 스튜", crate: "meat", chop: 4, cook: 8000, pts: 45, at: 90000 },
  ],
  seats: { 2: 6, 3: 8, 4: 10 }, orderMs: { 2: 8000, 3: 6000, 4: 4800 }, patience: { 2: 80000, 3: 75000, 4: 70000 }, feverK: 0.8, firstMs: 3000,
  burnMs: 8000, burnPen: 5, angryPen: 15, eatMs: 6000, washN: 3, washPts: 5, trayCap: 2, passCap: 6, serveK: 0.5, cookK: 0.5,
};
/**
 * 동동아파트 청소 v3 (owner, 2026-11-15: "한명은 빗자루, 다른 한명은 쓰레기통 … 아파트 공간을 최대한 많이 치워야함 (%로 표시) …
 * 쓰레기통은 일정량 채우면 꽉 차므로, 중간중간 버리는장소로 가서 비워줘야함"). Every floor tile of the flats, corridors and stairwell
 * starts dirty: dust (1) below `dirt[0]`, litter (2) below `dirt[1]`, else clean. A broom act takes `sweepN` units off the 3×3
 * round its worker into the nearest pile within `pileR` px with room (up to `pileMax` units), else a new one; a bin holds `binCap` 칸 of
 * `binUnit` units each (a pile too big for the room left is taken in part) and only emptying it at the dumpster
 * takes the dirt away. 청소율 = 1 − (dirt + piles + bins) / the opening dirt. New mess by the party size n: `dustN` tiles every
 * `dustMs[n]` (dust drifting) and a resident's `litterN`-tile mess every `litterMs[n]` (×feverK faster in fever); the sofa
 * (`sofaUnits`, two lift it `sofaHp` times) breaks into `sofaPiles` piles. The bin holder gets `holdK` of a load's credit.
 */
const COOP_APT = {
  dirt: [0.62, 0.86], sweepN: 5, pileMax: 40, pileR: 48, binCap: 10, binUnit: 40, holdK: 0.6,
  dustMs: { 2: 6000, 3: 4500, 4: 3500 }, dustN: 2, litterMs: { 2: 15000, 3: 11000, 4: 8500 }, litterN: 6, feverK: 1.5,
  sofaMs: 45000, sofaHp: 4, pairMs: 1500, sofaUnits: 12, sofaPiles: 3,
};
/**
 * 올빼미 도서관 책 분류 (owner, 2026-11-15: "사서가 모두 휴가를 떠나서 … 끊임없이 밀려 들어오는 반납 도서를 각 도서가 꽂혀야할 장르의
 * 책장으로 가져가서 꽂아주세요 … 책 반납을 하러 온 NPC를 맞이하고, 책 반납을 받아서 반납대 위로 올려 두는 역할을 하는 플레이어도 필수!").
 * Its own 64×44 hall, built in code like HALL: the 반납대 (ten counter tiles `m`, x 27–36, y 32; books lie on its slots x 28–35)
 * faces the returners' queue (x 31 from y 33 south towards their door at y 42); the rack `>` (21, 31) west of it; eight genre
 * shelves of six bookcases `b` in two rows of four (y 10 and y 22), shelf i = genre i, used from either side; reading tables between.
 */
const LIBH = { W: 64, H: 44, desk: [27, 36, 32], slots: [28, 32], queue: [31, 33], door: [31, 42], rack: [21, 31],
  shelves: [10, 22].flatMap((y) => [5, 18, 40, 53].map((x) => [x, y])) };
const COOP_LIB_MAP = (() => {
  const { W, H } = LIBH, o = Array.from({ length: H }, (_, y) => (y === 0 ? "+===^===".repeat(W / 8) : y === H - 1 ? "_".repeat(W) : "=" + " ".repeat(W - 2) + "_").split(""));
  const g = Array.from({ length: H }, () => "l".repeat(W).split(""));
  const put = (ch, x, y) => { o[y][x] = ch; };
  for (let x = LIBH.desk[0]; x <= LIBH.desk[1]; x++) put("m", x, LIBH.desk[2]);
  for (const [x0, y] of LIBH.shelves) for (let x = x0; x < x0 + 6; x++) { put("b", x, y); g[y + 1][x] = "y"; g[y - 1][x] = "y"; }
  // the returners' carpet from the door to the desk, the reading tables between the shelf rows, lamps and plants
  for (let y = LIBH.queue[1]; y < H - 1; y++) for (let x = 30; x <= 32; x++) g[y][x] = "y";
  for (const [x, y] of [[29, 14], [35, 14], [29, 18], [35, 18], [12, 16], [47, 16]]) { put("k", x - 1, y); put("o", x, y); put("k", x + 1, y); }
  put(">", ...LIBH.rack);
  for (const [x, y] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2], [26, 41], [36, 41], [14, 28], [49, 28]]) put("g", x, y);
  for (let x = 4; x <= 12; x++) put("-", x, 36);
  for (let x = 51; x <= 59; x++) put("-", x, 36);
  return { ground: g.map((r) => r.join("")), objects: o.map((r) => r.join("")) };
})();
COOP.lib = {
  name: "올빼미 도서관 책 분류", npc: "lib_borum", lobby: "owl_library", mins: 5, tools: ["desk", "sort"], combo: 20000, skill: "deliver",
  // cut-offs tuned on walking bots (tests/coop.mjs, hard): quick and accurate (an act every 300 ms) 1,181 · 2,338 · 3,145, just over
  // S (1,126 · 2,226 · 2,992); realistic (every 400 ms, walking at 90 %, 8 % wrong shelves) 817 · 1,508 · 2,187, B
  par: 1000, parN: { 2: 1.28, 3: 2.53, 4: 3.4 },
  hint: "접수 담당은 반납대에서 줄 선 손님의 책을 받아 반납대에 올리고, 분류 담당은 반납대의 책을 (한 번에 3권까지) 들고 같은 장르의 책장에 꽂으세요! 손님이 줄지어 와요.",
  // stations (tiles): the 반납대's ten tiles, the 48 shelf tiles (shelf i = tiles 6i … 6i+5), the rack
  st: { desk: Array.from({ length: 10 }, (_, i) => [LIBH.desk[0] + i, LIBH.desk[2]]), shelf: LIBH.shelves.flatMap(([x, y]) => [0, 1, 2, 3, 4, 5].map((i) => [x + i, y])), rack: LIBH.rack, door: LIBH.door },
  start: [[29, 30], [33, 30], [27, 29], [35, 29]],
  tpl: { name: "올빼미 도서관 · 대형 서고 (작업 중)", theme: "interior", style: "library", bgm: "cafe", safe: true, w: LIBH.W, h: LIBH.H, entry: [31, 30], ground: COOP_LIB_MAP.ground, objects: COOP_LIB_MAP.objects },
};
/**
 * The library's numbers. Returners arrive every `arriveMs[n]` (÷feverK in fever: the crowd), each with `books` [min, max] books, and
 * queue up to `queueCap[n]`; one not greeted to the end within `patience` leaves angry (−angryPen, combo 0, its books go home). The
 * 접수 takes one book a press onto the 반납대 (`deskCap` slots; full → refused, so slow sorting blocks intake): +intakePts, and
 * +servedPts when a returner's last book is in. The 분류 carries up to `carry` books; at a shelf a press shelves a held book of that
 * genre (+shelvePts, sortK to the sorter, the rest to the one who took it in); with none, the first held book goes in wrong
 * (−wrongPen, combo 0) and marks the shelf until someone pulls it back out. Titles are original (10 a genre).
 */
const COOP_LIB = {
  genres: ["추리소설", "SF소설", "과학소설", "로맨스소설", "웹소설", "판타지소설", "공포소설", "개그소설"],
  cols: ["#4a6ad0", "#40c8d8", "#5ab050", "#f070a8", "#f0a040", "#a070e0", "#b83838", "#f0d840"],
  titles: [
    ["안개 낀 등대의 세 번째 열쇠", "사라진 찻잔의 행방", "새벽 기차의 목격자", "붉은 우체통 사건", "탐정 올리의 마지막 수첩", "거꾸로 걸린 초상화", "열세 번째 손님", "비 오는 날의 알리바이", "잠긴 온실의 비밀", "고양이만 아는 범인"],
    ["목성 정거장 7호", "은하 택배 기사의 하루", "기억을 파는 로봇", "별빛 엔진 수리공", "화성 감자 농장 일지", "시간 우체국", "궤도 위의 도서관", "안드로이드의 첫 휴가", "달 뒷면의 신호", "우주 고래를 따라서"],
    ["꿀벌 박사의 실험 노트", "번개를 병에 담은 소녀", "화석 발굴단의 여름", "현미경 속 작은 왕국", "빙하 연구소의 겨울", "공룡 뼈를 맞춰라", "무지개를 쪼갠 프리즘", "바닷속 화산 탐사기", "씨앗 은행의 수호자", "별자리 지도를 그린 소년"],
    ["벚꽃 정류장에서 만나요", "편지는 일요일에 도착한다", "우산을 나눠 쓴 오후", "빵집 2층의 그 사람", "첫눈 오는 날의 약속", "여름밤 불꽃 아래서", "서툰 고백의 계절", "단골손님의 비밀 메모", "노을빛 자전거", "두 번째 봄의 너"],
    ["회귀한 청소부는 만렙이다", "알고 보니 마왕의 집사", "던전 앞 편의점 사장님", "레벨 1 농부의 성공 일지", "망한 길드 살리는 법", "악역 영애는 낮잠이 좋아", "100층 탑의 막내 사서", "환생했더니 고양이 기사", "무한 회귀 알바생", "별 다섯 개 요리사의 귀환"],
    ["용의 알을 품은 마을", "은빛 숲의 마법사", "구름 섬의 마지막 기사", "잃어버린 왕관의 노래", "여우 마법학교 입학기", "별을 삼킨 드래곤", "바람의 지도", "마법 빗자루 수리점", "검은 탑의 견습생", "요정 왕국 우편배달부"],
    ["자정의 엘리베이터", "웃지 않는 인형", "지하 3층 보일러실", "창밖의 발자국", "불 꺼진 학교의 종소리", "거울 속 두 번째 나", "안개 숲의 노래", "열리지 않는 서랍", "목 없는 허수아비", "끝나지 않는 복도"],
    ["방귀 뀌는 용", "우리 집 고양이는 사장님", "엉망진창 요리 대회", "양말 한 짝의 대모험", "대머리 마법사의 머리카락 찾기", "펭귄 택시 기사", "재채기 왕국", "냉장고 속 작은 파티", "엉덩이 춤 경연 대회", "게으른 닭의 하루"],
  ],
  deskCap: 8, carry: 3, books: [1, 3], arriveMs: { 2: 7000, 3: 4200, 4: 3200 }, feverK: 2, queueCap: { 2: 6, 3: 7, 4: 8 }, patience: 60000,
  intakePts: 2, servedPts: 5, shelvePts: 10, sortK: 0.7, angryPen: 15, wrongPen: 10,
};
