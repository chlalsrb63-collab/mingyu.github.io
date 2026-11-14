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
/** Node kinds in wire order (node[0]) → the material letter of LMAT. */
const NODE_KINDS = ["h", "o", "w"];
const NODE_NAME = ["약초", "광맥", "통나무"];
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
  // 연금: potions in threes, elixirs, feathers, runes
  hp_s: recipeRow("alch", 1, "alch", [["m_h1", 2], ["flask", 3]], "hp_s", 3, 18),
  mp_s: recipeRow("alch", 1, "alch", [["m_h1", 2], ["flask", 3]], "mp_s", 3, 27),
  hp_m: recipeRow("alch", 10, "alch", [["m_h2", 2], ["flask", 3]], "hp_m", 3, 92),
  mp_m: recipeRow("alch", 10, "alch", [["m_h2", 2], ["flask", 3]], "mp_m", 3, 110),
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
  whet: recipeRow("craft", 50, "craft", [["m_o5", 4], ["m_w5", 2], ["stone_b", 1]], "whet", 1, 5000),
});
const ING_FEE = [5, 10, 20, 40, 60];
for (let g = 1; g <= 5; g++) RECIPES[`ing_${g}`] = recipeRow("craft", GRADE_LV[g - 1], "craft", [[`m_o${g}`, 3]], `ing_${g}`, 1, ING_FEE[g - 1]);
/**
 * Gear (B.6): tier t (2–5) at Lv 12/22/32/42 — four ingots and two planks of grade t, a fee of 30 % of the shop
 * price; rarity q[0]..q[1] (마법..희귀; a 대성공 raises it one step, never 전설/세트), affixes rolled at item level
 * ilvl[t−1]. No batch mode. 48 recipes: six weapon kinds + six other pieces × four tiers.
 */
const GEAR_CRAFT = { lv: [12, 22, 32, 42], ing: 4, wood: 2, fee: 0.3, q: [1, 2], ilvl: [4, 12, 21, 32, 44], ms: 6000 };
for (let t = 2; t <= 5; t++) {
  const ids = [...WK_ORDER.map((wk) => `w_${WK_ID[wk]}_${t}`), ...["helm", "armor", "gloves", "boots", "ring", "amulet"].map((ty) => `${GEAR[ty].pre}_${t}`)];
  for (const id of ids) {
    RECIPES[`gr_${id}`] = recipeRow("craft", GEAR_CRAFT.lv[t - 2], "craft", [[`ing_${t}`, GEAR_CRAFT.ing], [`m_w${t}`, GEAR_CRAFT.wood]], id, 1,
      Math.round(ITEMS[id].price * GEAR_CRAFT.fee), { gear: 1, ms: GEAR_CRAFT.ms });
  }
}
/** Batch crafting (B.6): up to `batch` at once without a mini-game (scored `batchS`) once `batchD`+ levels above the recipe; a failure gives `failXp` of the XP. */
const CRAFT = { batch: 10, batchS: 70, batchD: 20, failXp: 0.5 };

// ── the solo 알바 board (B.9) and delivery (B.8)
/**
 * JB[id] = { kind, npc, lv, sk, item?, n?, to?, text } — kind bring (gathered materials), make (crafted goods
 * no shop sells), fish (caught fish), deliver (a parcel from `npc` to `to`). `lv` is the level of skill `sk`
 * the offer needs. `npc`/`to` are static NPC ids (town, its interiors, 버드나무 마을).
 */
const JB = {
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
};
/**
 * What a board job pays (B.8, B.9): gold gold[0] + gold[1]·L (deliveries dGold, plus up to `tip` more by the time
 * left), life XP lifeNeed(L)·xp in the job's skill, trust `rep` with the NPC (deliveries: repTo with the
 * recipient, repFrom with the sender); `perDay` jobs a day from `offers` offers; L is the job's skill level.
 * A parcel's time limit is path·T / (BASE_SPD·limit[0]) × limit[1] + limit[2] ms (a door counts `door` tiles);
 * carrying it you move at spd[0] + spd[1]·L (0.85 at 1, 1.0 at 25, 1.15 at 50).
 */
const JB_PAY = { gold: [30, 6], dGold: [20, 4], tip: 0.5, xp: 0.25, rep: 2, repTo: 3, repFrom: 1, perDay: 3, offers: 4, limit: [0.85, 1.8, 20000], spd: [0.85, 0.006], door: 2 };
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
const COOP_KINDS = ["apt", "diner", "forge", "alch"];
/** The 재료 주머니 holds materials (ingots too), staples and flasks, up to this many of each. */
const POUCH_MAX = 999;
