// ── gear: seven kinds of piece, five tiers each
const WEAPON_NAMES = {
  sword: ["녹슨 대검", "강철 양손검", "기사단 클레이모어", "고주파 대검", "차원 절단기"],
  dagger: ["낡은 단검", "암살자의 비수", "쌍독니", "카본 나이프", "균열의 송곳니"],
  spear: ["대나무 창", "강철 장창", "기사단 할버드", "플라즈마 랜스", "차원 관통창"],
  staff: ["견습 지팡이", "룬 지팡이", "현자의 지팡이", "플라즈마 로드", "공허의 홀"],
  book: ["낡은 주문서", "룬 마도서", "현자의 법전", "홀로그램 코덱스", "공허의 서"],
  bow: ["나무 짧은활", "사냥꾼의 장궁", "기사단 전투활", "카본 컴파운드 보우", "균열의 시위"],
  hammer: ["말뚝박이 망치", "강철 노두 망치", "성문지기의 중추", "충격 코일 해머", "균열봉합 추"],
};
/** The word each weapon kind uses in its item ids (persisted: the old class names stay). Anyone may wield anything. */
const WK_ID = { sword: "warrior", dagger: "rogue", spear: "lancer", staff: "mage", book: "book", bow: "bow", hammer: "h" };
const W_ATK = [6, 14, 26, 42, 64];
/** The level each tier of gear asks for, on the 1–200 player scale (= 4·old − 3). */
const G_REQ = [1, 29, 61, 101, 149];
const G_PRICE = [80, 600, 2200, 7000, 20000];
/** Everything worn: id prefix, names by tier, and the stats a plain piece carries. */
const GEAR = {
  helm: { pre: "h", cost: 0.7, names: ["천 두건", "가죽 모자", "강철 투구", "전술 헬멧", "차원 왕관"], st: { def: [1, 3, 6, 10, 15], hp: [0, 15, 35, 65, 110] } },
  armor: { pre: "a", cost: 1, names: ["여행자 옷", "가죽 갑옷", "사슬 갑옷", "전술 방탄복", "차원 외골격"], st: { def: [2, 6, 11, 18, 28], hp: [0, 30, 70, 130, 220] } },
  gloves: { pre: "g", cost: 0.6, names: ["헝겊 장갑", "가죽 장갑", "사슬 장갑", "강화 건틀릿", "차원 손아귀"], st: { atk: [1, 3, 6, 10, 16] } },
  boots: { pre: "b", cost: 0.6, names: ["짚신", "가죽 장화", "강철 각반", "부스터 부츠", "차원 보행기"], st: { def: [1, 2, 4, 7, 11], spd: [2, 3, 4, 6, 8] } },
  ring: { pre: "r", cost: 0.8, names: ["구리 반지", "은 반지", "금 반지", "네온 링", "차원 인장"], st: { atk: [1, 2, 4, 7, 11], crit: [1, 1, 2, 3, 4] } },
  amulet: { pre: "n", cost: 0.8, names: ["나무 목걸이", "은 목걸이", "수호 부적", "홀로 펜던트", "균열의 심장"], st: { hp: [10, 30, 60, 110, 180], mp: [5, 15, 30, 55, 90] } },
};

const ITEMS = {
  // red potions heal a fixed amount plus a share of the drinker's health, so they keep their worth as monsters hit harder
  hp_s: { name: "빨간 물약", type: "pot", heal: 60, pct: 0.1, price: 20, desc: "HP를 60 + 최대 HP의 10% 회복한다." },
  hp_m: { name: "큰 빨간 물약", type: "pot", heal: 220, pct: 0.18, price: 70, desc: "HP를 220 + 최대 HP의 18% 회복한다." },
  hp_l: { name: "농축 빨간 물약", type: "pot", heal: 480, pct: 0.24, price: 150, desc: "HP를 480 + 최대 HP의 24% 회복한다." },
  mp_s: { name: "파란 물약", type: "pot", mana: 40, price: 25, desc: "MP를 40 회복한다." },
  mp_m: { name: "큰 파란 물약", type: "pot", mana: 140, price: 80, desc: "MP를 140 회복한다." },
  mp_l: { name: "농축 파란 물약", type: "pot", mana: 340, price: 170, desc: "MP를 340 회복한다." },
  // charms (66-charms.js): one to a slot, never stacked, sold or stored; `charm_nail` opens a cell of the board
  charm: { name: "참", type: "charm", price: 0, desc: "주아나가 감정해 주는 빛나는 조각. 감정한 참은 참 보드에 놓아야 힘을 낸다." },
  charm_nail: { name: "참틀 확장못", type: "mat", price: 0, desc: "주아나에게 가져가면 골드와 함께 참 보드의 칸을 하나 연다." },
  scr_job: { name: "전직 초기화 주문서", type: "mat", price: 0, desc: "전직관에게 골드와 함께 내면 모험가로 돌아간다. 걸었던 직업의 직업 레벨은 그대로 남는다." },
  scr_lvl: { name: "레벨 초기화 주문서", type: "mat", price: 0, desc: "전직관에게 골드와 함께 내면 레벨과 능력치가 1로 돌아간다. 숙련, 장비, 골드, 직업 레벨은 남는다." },
  stat_seal: { name: "되새김 인장", type: "mat", price: 0, desc: "연금공방에서 제작한다. 수련관 카이에게 골드와 함께 내면 능력치를 되돌리고 투자한 경험치를 돌려받는다." },
  stone: { name: "강화석", type: "mat", price: 150, desc: "대장장이에게 가져가면 장비를 강화할 수 있다. 강화할 때마다 쓴다." },
  ske_stone: { name: "스킬 강화석", type: "mat", price: 0, desc: "마을이나 모닥불 곁에서 액티브 스킬을 강화한다 (+10까지, +3까지는 반드시 성공). 실패하면 이 돌만 사라진다." },
  uncurse: { name: "저주 해제 주문서", type: "mat", price: 1200, desc: "대장장이에게 가져가면 강화에 실패해 저주받은 장비를 푼다. 풀린 장비의 다음 강화는 성공 확률이 10%p 오른다." },
  recall: { name: "귀환 주문서", type: "scroll", price: 60, desc: "2초 동안 읽으면 버드나무광장으로 돌아간다. 움직이거나 피해를 입으면 취소된다." },
  camp: { name: "모닥불 꾸러미", type: "camp", price: 120, desc: "사용하면 그 자리에 3분 동안 모닥불을 피운다. 곁에 앉아 쉬면 빠르게 회복하고 온기를 얻는다." },
  fish_s: { name: "송사리", type: "fish", cook: "food_s", price: 30, desc: "흔한 물고기. 모닥불에서 구울 수 있다." },
  fish_m: { name: "무지개 송어", type: "fish", cook: "food_m", price: 110, desc: "살이 오른 송어. 모닥불에서 구울 수 있다." },
  fish_l: { name: "황금 잉어", type: "fish", cook: "food_l", price: 800, desc: "좀처럼 낚이지 않는 귀한 물고기. 모닥불에서 요리할 수 있다." },
  burnt: { name: "숯덩이가 된 생선", type: "food", heal: 15, buff: { xp: 0, atk: 0, min: 0 }, price: 1, desc: "너무 오래 구웠다. HP 15 회복." },
  food_s: { name: "구운 송사리", type: "food", heal: 80, buff: { xp: 5, atk: 0, min: 10 }, price: 40, desc: "HP 80 회복. 10분간 경험치 +5%." },
  food_m: { name: "송어 소금구이", type: "food", heal: 220, buff: { xp: 10, atk: 0, min: 10 }, price: 150, desc: "HP 220 회복. 10분간 경험치 +10%." },
  food_l: { name: "황금 잉어찜", type: "food", heal: 9999, buff: { xp: 15, atk: 8, min: 15 }, price: 1000, desc: "HP 전부 회복. 15분간 경험치 +15%, 공격력 +8%." },
  // the town's cafe and inn (data/maps/tales_cafe.json, starlight_inn.json): sold only at their own counters
  cafe_coffee: { name: "테일즈 블렌드", type: "food", mana: 120, buff: { xp: 0, atk: 5, min: 10 }, price: 90, desc: "고소하고 진한 커피. MP 120 회복. 10분간 공격력 +5%." },
  cafe_cocoa: { name: "마시멜로 코코아", type: "food", heal: 150, buff: { xp: 5, atk: 0, min: 15 }, price: 70, desc: "달콤하고 따끈하다. HP 150 회복. 15분간 경험치 +5%." },
  cafe_tea: { name: "들꽃 허브차", type: "food", heal: 60, mana: 80, buff: { xp: 3, atk: 0, min: 20 }, price: 50, desc: "바람초원 들꽃을 우렸다. HP 60, MP 80 회복. 20분간 경험치 +3%." },
  cafe_scone: { name: "버터 스콘", type: "food", heal: 220, buff: { xp: 5, atk: 0, min: 10 }, price: 60, desc: "겉은 바삭, 속은 촉촉. HP 220 회복. 10분간 경험치 +5%." },
  cafe_pie: { name: "산딸기 파이", type: "food", heal: 420, buff: { xp: 8, atk: 3, min: 15 }, price: 180, desc: "모카의 자랑. HP 420 회복. 15분간 경험치 +8%, 공격력 +3%." },
  inn_stew: { name: "여관 스튜", type: "food", heal: 360, mana: 60, buff: { xp: 6, atk: 0, min: 20 }, price: 110, desc: "뭉근히 끓인 고기 스튜. HP 360, MP 60 회복. 20분간 경험치 +6%." },
  inn_bread: { name: "갓 구운 호밀빵", type: "food", heal: 120, buff: { xp: 2, atk: 0, min: 10 }, price: 25, desc: "든든한 한 덩이. HP 120 회복. 10분간 경험치 +2%." },
  // scrolls of blessing, ten minutes each; reading the same one again only refills its time (메이플 주문서 · 바람의나라 부적)
  sc_atk: { name: "공격의 주문서", type: "buff", buff: "atk", pct: 10, min: 10, price: 300, desc: "10분간 공격력 +10%. 같은 주문서는 겹치지 않고 남은 시간만 다시 채운다." },
  sc_def: { name: "방어의 주문서", type: "buff", buff: "def", pct: 12, min: 10, price: 300, desc: "10분간 받는 피해 -12%. 같은 주문서는 겹치지 않고 남은 시간만 다시 채운다." },
  sc_xp: { name: "경험의 주문서", type: "buff", buff: "xp", pct: 20, min: 10, price: 450, desc: "10분간 경험치 +20%. 같은 주문서는 겹치지 않고 남은 시간만 다시 채운다." },
  feather: { name: "부활 깃털", type: "revive", price: 250, desc: "쓰러졌을 때 그 자리에서 일어난다 (HP·MP 60%). 경험치를 잃지 않는다." },
  // pets (메이플스토리 펫): a small companion that follows its owner and fetches their loot
  pet_chick: { name: "병아리 펫", type: "pet", radius: 56, price: 2500, desc: "사용하면 곁을 따라다니며 내 전리품을 반경 56 안에서 주워 온다. 다시 사용하면 돌려보낸다." },
  pet_bat: { name: "꼬마 박쥐 펫", type: "pet", radius: 76, price: 9000, desc: "사용하면 곁을 따라다니며 내 전리품을 반경 76 안에서 주워 온다. 다시 사용하면 돌려보낸다." },
  pet_wisp: { name: "도깨비불 펫", type: "pet", radius: 96, price: 24000, desc: "사용하면 곁을 따라다니며 내 전리품을 반경 96 안에서 주워 온다. 다시 사용하면 돌려보낸다." },
  pet_hagfish: { name: "꼬마 먹장어 펫", type: "pet", radius: 104, price: 30000, desc: "꽃무덤 고래에게서 떨어져 나온 꼬마 먹장어. 곁을 따라다니며 내 전리품을 반경 104 안에서 주워 온다. 상점에서는 팔지 않는다." },
};
for (const wk of Object.keys(WEAPON_NAMES)) {
  for (let t = 1; t <= 5; t++) {
    const base = wk === "book" ? { atk: Math.round(W_ATK[t - 1] * 0.85), mp: [15, 35, 60, 100, 150][t - 1] } : { atk: W_ATK[t - 1] };
    ITEMS[`w_${WK_ID[wk]}_${t}`] = { name: WEAPON_NAMES[wk][t - 1], type: "weapon", wk, tier: t, base, req: G_REQ[t - 1], price: G_PRICE[t - 1] };
  }
  // Plain patrol stock for the airship. Crafted and dropped weapons keep the full tier stats.
  for (const t of [4, 5]) {
    const item = ITEMS[`w_${WK_ID[wk]}_${t}`];
    ITEMS[`w_ship_${WK_ID[wk]}_${t}`] = { ...item, name: `정찰대 ${item.name}`, price: t === 4 ? 5000 : 14000,
      base: { ...item.base, atk: Math.floor(item.base.atk * 0.9) }, desc: "바람등호가 정찰대에 지급하는 보급 무기." };
  }
}
// bosses-2 §7: the two field bosses' own finds — a material each (for crafting to come) and a top-tier weapon (drops legendary)
Object.assign(ITEMS, {
  mat_bloodtear: { name: "피눈물 결정", type: "mat", price: 400, desc: "혈루 왕도마뱀이 흘린 붉은 결정. 캉캉대장간에서 강화석 두 개와 함께 축복 강화석으로 굳힐 수 있다." },
  mat_clubclaw: { name: "망치 갯가재 집게", type: "mat", price: 380, desc: "물을 끓게 하던 갯가재의 집게. 캉캉대장간에서 강철 광석과 함께 홈 송곳으로 벼릴 수 있다." },
  w_bloodcrown: { ...ITEMS.w_lancer_5, name: "혈루 왕관 창", uniq: 1 },
  w_cavhammer: { ...ITEMS.w_h_5, name: "공동 망치", uniq: 1 },
});
// bosses-2 §7: the weekly raids' own finds (MOBS[k].drops) — a 4-piece set each (`set`: always that set, never rolled
// elsewhere) and their legendary weapons. 밤장막 is mid-game (tier 4), 꽃무덤 end-game (tier 5).
Object.assign(ITEMS, {
  veil_h: { ...ITEMS.h_4, name: "박쥐 가면", set: "nightveil" },
  veil_a: { ...ITEMS.a_4, name: "장막 망토", set: "nightveil" },
  veil_r: { ...ITEMS.r_4, name: "송곳니 반지", set: "nightveil" },
  veil_n: { ...ITEMS.n_4, name: "흉곽 부적", set: "nightveil" },
  bloom_h: { ...ITEMS.h_5, name: "고래뼈 투구", set: "bloomgrave" },
  bloom_a: { ...ITEMS.a_5, name: "갈비 흉갑", set: "bloomgrave" },
  bloom_r: { ...ITEMS.r_5, name: "혼꽃 반지", set: "bloomgrave" },
  bloom_n: { ...ITEMS.n_5, name: "결정 심장", set: "bloomgrave" },
  w_ribbook: { ...ITEMS.w_book_4, name: "흉곽 등불", uniq: 1 },
  w_whalebow: { ...ITEMS.w_bow_5, name: "고래뼈 활", uniq: 1 },
  w_bloomstaff: { ...ITEMS.w_mage_5, name: "혼꽃 지팡이", uniq: 1 },
});
for (const type of Object.keys(GEAR)) {
  const d = GEAR[type];
  for (let t = 1; t <= 5; t++) {
    const base = {};
    for (const s of Object.keys(d.st)) if (d.st[s][t - 1]) base[s] = d.st[s][t - 1];
    ITEMS[`${d.pre}_${t}`] = { name: d.names[t - 1], type, tier: t, base, req: G_REQ[t - 1], price: Math.round(G_PRICE[t - 1] * d.cost) };
  }
}

/** Runes: one stat each. Socket them into equipped gear; the right sequence forms a runeword. */
const RUNES = {
  ign: ["이그", "atkp", 5], aeg: ["에기", "def", 4], vit: ["비타", "hp", 35], men: ["멘", "mp", 25], cel: ["셀", "spd", 4],
  acu: ["아쿠", "crit", 3], san: ["산", "ls", 2], lum: ["룸", "xp", 6], fos: ["포스", "mf", 10],
};
for (const k of Object.keys(RUNES)) {
  ITEMS[`ru_${k}`] = { name: `${RUNES[k][0]} 룬`, type: "rune", rune: k, price: 500, desc: "장착한 장비의 홈에 끼울 수 있다. 가방에서 선택해 사용." };
}
const RUNE_KEYS = Object.keys(RUNES);
const RUNEWORDS = [
  { name: "섬광", seq: ["ign", "acu"], add: [["atkp", 10], ["critd", 25]] },
  { name: "철벽", seq: ["vit", "aeg"], add: [["hp", 90], ["def", 8]] },
  { name: "탐구자", seq: ["lum", "fos"], add: [["xp", 10], ["mf", 20]] },
  { name: "질풍", seq: ["cel", "acu"], add: [["spd", 6], ["crit", 6]] },
  { name: "피의 맹세", seq: ["san", "ign", "acu"], add: [["ls", 4], ["atkp", 15], ["crit", 5]] },
  { name: "불멸", seq: ["vit", "aeg", "men"], add: [["hp", 180], ["def", 12], ["mp", 60]] },
];

/** Affixes a dropped item can roll: [key, label, prefix word, min, max, per-item-level growth]. */
const AFFIX = [
  ["atk", "공격력", "날카로운", 1, 3, 0.35], ["atkp", "공격력 %", "맹렬한", 3, 8, 0], ["def", "방어력", "단단한", 1, 2, 0.25],
  ["hp", "최대 HP", "강인한", 8, 20, 2], ["mp", "최대 MP", "지혜의", 5, 12, 1], ["crit", "치명타 %", "예리한", 2, 5, 0],
  ["critd", "치명타 피해 %", "잔혹한", 8, 20, 0], ["ls", "흡혈 %", "흡혈의", 1, 3, 0], ["spd", "이동속도 %", "신속의", 3, 7, 0],
  ["xp", "경험치 %", "깨달음의", 3, 8, 0], ["mf", "아이템 발견 %", "행운의", 5, 15, 0], ["gold", "골드 획득 %", "탐욕의", 8, 20, 0],
];
const RARITY = ["일반", "마법", "희귀", "전설", "세트"];
/** How many affixes each rarity rolls: [min, max]. */
const RARITY_AFFIX = [[0, 0], [1, 2], [3, 4], [4, 4], [2, 3]];
/** A legendary piece carries one power no affix can give: [name word, what it does]. */
const LEGEND = {
  chain: ["뇌명의", "공격 시 25% 확률로 번개가 주변 적 2명에게 튄다 (60%)"],
  nova: ["폭렬의", "적을 처치하면 폭발해 주변에 피해를 준다 (80%)"],
  greed: ["황금손의", "골드 획득 +60%"],
  haste: ["질주의", "공격 속도 +15%"],
  thorn: ["가시의", "받은 피해의 40%를 공격한 적에게 되돌려 준다"],
  feast: ["포식자의", "적을 처치할 때마다 최대 HP의 4% 회복"],
  echo: ["메아리의", "스킬 사용 시 20% 확률로 재사용 대기시간이 사라진다"],
  giant: ["거인 사냥꾼의", "정예와 우두머리에게 주는 피해 +30%"],
};
/** Set pieces grow stronger the more of the same set is worn: [pieces, [[stat, value]…]]. */
const SETS = {
  pioneer: { name: "개척자", tiers: [1, 2], types: ["helm", "armor", "gloves", "boots"], bonus: [[2, [["hp", 60]]], [4, [["spd", 10], ["xp", 12]]]] },
  runner: { name: "네온 러너", tiers: [3, 4], types: ["gloves", "boots", "ring", "amulet"], bonus: [[2, [["crit", 6]]], [4, [["atkp", 15], ["spd", 8]]]] },
  rift: { name: "균열 추적자", tiers: [4, 5], types: ["weapon", "helm", "armor", "ring", "amulet"], bonus: [[2, [["mf", 25]]], [3, [["atkp", 12]]], [5, [["ls", 4], ["critd", 40]]]] },
  // the weekly raids' sets (bosses-2 §7): no tiers, so no ordinary piece rolls into them — only their own rows (ITEMS `set`)
  nightveil: { name: "밤장막", tiers: [], types: ["helm", "armor", "ring", "amulet"], bonus: [[2, [["ls", 3]]], [4, [["atkp", 12], ["crit", 5]]]] },
  bloomgrave: { name: "꽃무덤", tiers: [], types: ["helm", "armor", "ring", "amulet"], bonus: [[2, [["hp", 150]]], [4, [["atkp", 15], ["critd", 35]]]] },
};

/** A warehouse (창고) holds this many slots per character, besides gold. */
const WH = 60;
/** The loot filter: the least rarity of gear a label is shown for and a pet fetches. */
const FILTER_Q = [0, 1, 2];
/** How often a pet runs for something. */
const PET_MS = 300;

const SHOP = ["hp_s", "hp_m", "hp_l", "mp_s", "mp_m", "mp_l", "recall", "camp", "stone", "uncurse", "feather", "sc_atk", "sc_def", "sc_xp", "pet_chick", "pet_bat", "pet_wisp", "w_warrior_1", "w_rogue_1", "w_lancer_1", "w_mage_1", "w_book_1", "w_bow_1", "w_h_1", "h_1", "a_1", "g_1", "b_1"];
// success % of the try from +n to +n+1: up to +3 always succeeds (owner, job-freedom.md §8)
const ENH_RATE = [100, 100, 100, 80, 70, 55, 45, 35, 25, 15];
// base-stat bonus % at +n: ~4 %/step to +3, ~2.5 % to +6, ~2 % to +10 (low and high players stay close)
const ENH_PCT = [0, 4, 8, 12, 14.5, 17, 19.5, 21.5, 23.5, 25.5, 27.5];
const enhMul = (e) => 1 + ENH_PCT[e | 0] / 100;
// weapon crit % per step; a lifted curse gives the next try this many %p
// UNCURSE_FEE: the smith's gold per gear tier on top of the scroll (economy review 2026-11-15 §3: tier 1 1.6k … tier 5 3.2k with the scroll)
const ENH_CRIT = 0.5, ENH_UNCURSE = 10, UNCURSE_FEE = 400;

// ── the cosy side: campfires, fishing, guilds
/** Campfires that always burn, by map, in tiles. */
const FIRES = {};          // filled in as each map is generated
/** Each map's waypoint stone, in tiles, and the tile a traveller arrives on beside it. */
const WP = {};
const FIRE_R = 46, FIRE_MS = 180000, FIRE_MAX = 6;
/** Sitting this long by a fire warms you: +10% experience for ten minutes, +2% per friend sitting there too. */
const WARM_SEC = 6, WARM_MS = 600000;
const GUILD_COST = 1000;
/** Each guildmate hunting beside you adds this much experience, up to three. */
const GUILD_XP = 0.05;
const EMOTES = 25;

// ── the hunt: what keeps a hunting ground worth another lap
/** Kills in quick succession build a streak; each step adds 2% experience, up to +50%. */
const STREAK_MS = 8000, STREAK_MAX = 25;
/** Kills of one kind of monster that earn each mastery rank (+3% damage, +2% experience against it). */
const MASTERY = [30, 100, 300, 1000, 3000];
/** A repeatable bounty asks for this many of one monster, and renews itself when paid out. */
const BOUNTY_N = 25;
/** A hunting ground's field boss stands at its fixed spot from the start and is back there this long after it falls (ms). */
const FB_RESP = 600000;
/** Each hunting ground's field boss, by map (its trophy: TROPHIES, 67-trophies.js). */
const FIELD_BOSS = { meadow: "lambmaw", forest: "ribdeer", crypt: "toadbrood", city: "doghead", sewer: "crabskull", cave: "moleworm", abyss: "lionhand", maple: "rotstag", jungle: "loggator", oasis: "mummycamel", coast: "clubshrimp", dunesea: "sandmaw", cloudtemple: "bearmaw_ash", mesa: "crownpeacock" };

/**
 * What an elite carries besides its size: one trait for an elite, two for a
 * guardian or a field boss. [name, what it does] — in the order clients list them.
 */
const TRAITS = {
  tough: ["단단함", "받는 피해가 40% 줄어든다"],
  fire: ["화염", "맞으면 불이 붙어 한동안 계속 피해를 입는다"],
  poison: ["맹독", "맞으면 중독되어 한동안 계속 피해를 입는다"],
  swift: ["신속", "이동과 공격이 35% 빠르다"],
  vamp: ["흡혈", "입힌 피해로 제 체력을 회복한다"],
  frost: ["빙결", "맞으면 한동안 발이 느려진다"],
  burst: ["폭발", "쓰러진 자리에서 터진다"],
  thorn: ["가시", "가까이서 때리면 피해의 일부를 되돌려 받는다"],
};
const TRAIT_KEYS = Object.keys(TRAITS);
/** A slowed player moves at this share of their speed, for this long. */
const SLOW = 0.65, SLOW_MS = 2500;
/** How long a charge is telegraphed, a volley is in the air, a spat puddle flies and then lies. */
const CHARGE_MS = 850, VOLLEY_MS = 650, POOL_FLY = 600, POOL_MS = 5000;
/** The tricks a monster may have besides its plain attack, in the order it tries them. */
const MOVES = ["charge", "leap", "slam", "pool", "fan", "pounce", "breath", "spit", "howl", "burrow", "cloud"];
/**
 * The telegraphed tricks (80-simulation.js special): a row opts in with its reach — `pounce`/`spit`/`burrow` from that
 * far, `breath` a cone that long, `howl` rallies kin that near, `cloud` a mist that wide round itself. `ms` the warning
 * (a dash or a step out of the mark escapes it), `k` × atk, `cd` until its next trick, × TRICK_EL[rank] (elites more
 * often); a cone's `half` angle (rad), a ring's `r`, a howl's `dur` (its kin hit × k and run × 1.15) and a cloud's.
 * A recoloured kind (`sp`) has its body's ones unless it names its own.
 */
const TRICKS = {
  pounce: { ms: 750, k: 1.6, cd: 6000, r: 26 },
  breath: { ms: 800, k: 1.5, cd: 6500, half: 0.6 },
  spit: { ms: 700, k: 1.25, cd: 4500, r: 15 },
  howl: { ms: 600, k: 1.25, cd: 12000, dur: 6000 },
  burrow: { ms: 1000, k: 1.8, cd: 8000, r: 28 },
  cloud: { ms: 600, k: 0.35, cd: 9000, dur: 4500 },
};
const TRICK_EL = [1, 0.75, 0.6];
/** A trick's blow staggers only a player who has not reeled within this long (no stun-lock). */
const MV_GRACE = 1200;
/** Hunting grounds hold this many times the monsters their layout asks for; each one drops gear this much less often and hits this much harder. */
/** Walkable tiles per monster on each hunting ground: open fields roomy, dungeon halls packed. */
const DENSITY = { meadow: 12.6, forest: 12.2, crypt: 5.6, city: 10.6, sewer: 6.2, cave: 9.5, abyss: 7, maple: 11.8, jungle: 12.2, oasis: 12.6, coast: 12.6, dunesea: 12.6, frostkeep: 14, cloudtemple: 12.6, mesa: 12.6 };
const GEAR_CUT = 0.3, MOB_ATK = 1.27;
/**
 * Active-area spawning (docs/design/scale-and-rift.md B.4d). A map is cut into CELL × CELL tile
 * cells; a cell wakes when a living player comes within WAKE_R cells (Chebyshev) and is filled
 * out of sight (at least SPAWN_MIN_D tiles from everyone), and sleeps once nobody is within
 * SLEEP_R: its calm monsters leave, and what was killed there comes back no sooner than
 * CELL_RESPAWN_MS after the cell's last kill (so a farmed cell is not reset by walking away).
 * Never more than WAKE_MAX_MOBS standing monsters (chests, guardians, cell monsters) on a map.
 * A cell's crowd follows its hunters: ×(0.75 + 0.25 per player near), at most DENSITY_MAX.
 * Every WAVE_MS a player who moved more than WAVE_MOVE tiles finds WAVE_K more monsters in the
 * cell WAVE_AHEAD cells ahead (never past DENSITY_MAX of its crowd). Cells are looked at every CELL_PASS_MS.
 */
const CELL = 16, WAKE_R = 3, SLEEP_R = 5, WAKE_MAX_MOBS = 230, SPAWN_MIN_D = 14, CELL_RESPAWN_MS = 25000, CELL_PASS_MS = 500;
const DENSITY_MAX = 1.5, WAVE_MS = 90000, WAVE_MOVE = 8, WAVE_AHEAD = 2, WAVE_K = 0.25;
/** Past this level the extra bite tapers off, a little per level: the deep dungeons were already the sharpest. */
const ATK_EASE = [16, 0.016];
/**
 * However thick the crowd, only this many monsters will come for one player of
 * their own accord — the rest wait their turn (anything struck still fights back).
 */
const AGGRO_CAP = 3;

/**
 * Monsters: animals that came back wrong. Beyond the numbers: `fly` crosses anything,
 * `shot` attacks from range and `volley` does so three shots at a time; `leap` pounces
 * from that far, `charge` runs down a marked line from that far, `slam` pounds the
 * ground around itself, `pool` spits a lingering puddle (kind 0 poisons, 1 burns,
 * 2 slows), `fan` throws a spread of shots from that far, and `burst` goes off
 * where it died. A kind with `sp` and `tint` is another's body in another colour —
 * the same beast, grown worse. Listed in the order a character meets them.
 */
const MOBS = {
  // Additional beasts share established hunting sites on their home maps.
  wickhare: { name: "밀랍귀 토끼", lv: 4, hp: 69, atk: 10, def: 1, spd: 30, xp: 23, gold: [5, 11], aggro: 0, range: 17, cd: 1500, pool: 16, poolKind: 1, bonusOptional: true },
  burrlynx: { name: "가시깍지 삵", lv: 9, hp: 186, atk: 24, def: 3, spd: 48, xp: 73, gold: [11, 24], aggro: 78, range: 17, cd: 1200, leap: 86, bonusOptional: true },
  bellnewt: { name: "뼈종 도롱뇽", lv: 14, hp: 322, atk: 38, def: 6, spd: 31, xp: 146, gold: [18, 37], aggro: 78, range: 18, cd: 1500, slam: 28, bonusOptional: true },
  spoolsnipe: { name: "실패부리 도요", lv: 16, hp: 368, atk: 44, def: 5, spd: 42, xp: 172, gold: [20, 42], aggro: 80, range: 52, cd: 1800, shot: true, fan: 92, bonusOptional: true },
  sluiceeel: { name: "쇠살 장어", lv: 24, hp: 945, atk: 77, def: 15, spd: 36, xp: 440, gold: [42, 80], aggro: 76, range: 20, cd: 1600, pool: 22, bonusOptional: true },
  prismmole: { name: "겹렌즈 두더지", lv: 27, hp: 1310, atk: 93, def: 18, spd: 34, xp: 600, gold: [54, 98], aggro: 84, range: 21, cd: 1500, fan: 100, slam: 32, bonusOptional: true },
  // The second wave of beasts (art: mobart_g.js), each with a telegraphed trick and a home ground (ZONE_EXTRA, 33-maps-zones.js).
  slugtongue: { name: "혀 민달팽이", lv: 9, hp: 190, atk: 22, def: 2, spd: 16, xp: 66, gold: [10, 22], aggro: 60, range: 16, cd: 1500, cloud: 30 },
  gnawbadger: { name: "이빨굴 오소리", lv: 11, hp: 250, atk: 28, def: 4, spd: 40, xp: 100, gold: [12, 27], aggro: 88, range: 17, cd: 1100, burrow: 100 },
  gravecricket: { name: "무덤 귀뚜라미", lv: 14, hp: 290, atk: 38, def: 4, spd: 50, xp: 135, gold: [17, 34], aggro: 96, range: 17, cd: 1000, pounce: 96 },
  smoggecko: { name: "매연 도마뱀붙이", lv: 18, hp: 470, atk: 54, def: 6, spd: 44, xp: 230, gold: [26, 52], aggro: 90, range: 18, cd: 1200, breath: 58 },
  dropsloth: { name: "낙하 나무늘보", lv: 22, hp: 820, atk: 70, def: 12, spd: 24, xp: 360, gold: [38, 74], aggro: 80, range: 20, cd: 1500, pounce: 100 },
  gigglehyena: { name: "웃는 하이에나", lv: 23, hp: 880, atk: 74, def: 14, spd: 48, xp: 400, gold: [42, 80], aggro: 90, range: 19, cd: 1100, howl: 110 },
  dunescarab: { name: "해골 쇠똥구리", lv: 30, hp: 1500, atk: 96, def: 26, spd: 32, xp: 720, gold: [60, 108], aggro: 86, range: 20, cd: 1400, burrow: 110 },
  rimewalrus: { name: "서리숨 바다코끼리", lv: 50, hp: 5200, atk: 140, def: 36, spd: 30, xp: 3800, gold: [140, 214], aggro: 84, range: 22, cd: 1600, breath: 64 },
  // Weekly arena opponents, separate from the field boss roster and story fights.
  wickregent: { name: "밀랍굴의 여왕 심지귀", lv: 19, hp: 6200, atk: 105, def: 17, spd: 35, xp: 1800, gold: [130, 230], aggro: 130, range: 24, cd: 1500, boss: true },
  knotwidow: { name: "등불매듭 뿌리거미", lv: 22, hp: 8500, atk: 110, def: 21, spd: 38, xp: 2300, gold: [155, 270], aggro: 132, range: 27, cd: 1450, boss: true },
  knellkeeper: { name: "장례종지기 툼벨", lv: 25, hp: 10000, atk: 125, def: 25, spd: 32, xp: 3100, gold: [195, 310], aggro: 134, range: 29, cd: 1600, boss: true },
  loomcolossus: { name: "찢어진 직조탑 베틀부리", lv: 28, hp: 13000, atk: 136, def: 28, spd: 36, xp: 4100, gold: [225, 375], aggro: 136, range: 28, cd: 1450, boss: true },
  sluiceleviathan: { name: "배수문을 삼킨 잠류아귀", lv: 32, hp: 15500, atk: 145, def: 31, spd: 34, xp: 5200, gold: [265, 435], aggro: 138, range: 30, cd: 1500, boss: true },
  prismcantor: { name: "쌍결정 성가박쥐", lv: 36, hp: 19600, atk: 164, def: 34, spd: 38, xp: 6700, gold: [315, 510], aggro: 140, range: 28, cd: 1380, fly: true, boss: true },
  // 바람초원
  twinhare: { name: "쌍두 토끼", lv: 1, hp: 28, atk: 5, def: 0, spd: 26, xp: 9, gold: [2, 6], aggro: 0, range: 16, cd: 1300 },
  gutfrog: { name: "창자 개구리", lv: 3, hp: 60, atk: 9, def: 1, spd: 24, xp: 18, gold: [4, 10], aggro: 0, range: 16, cd: 1300, leap: 80, pounce: 90 },
  eyecrow: { name: "눈알 까마귀", lv: 5, hp: 82, atk: 13, def: 0, spd: 34, xp: 30, gold: [6, 14], aggro: 0, range: 17, cd: 1200, fly: true, spit: 90 },   // circles the pond and minds its own business, so the shore stays a fishing spot
  lambmaw: { name: "뒤집힌 양", lv: 6, hp: 110, atk: 15, def: 1, spd: 38, xp: 38, gold: [7, 16], aggro: 72, range: 18, cd: 1300, charge: 110 },
  meadowram: { name: "금 간 뿔 숫양", sp: "meadowram", lv: 7, hp: 134, atk: 18, def: 2, spd: 40, xp: 49, gold: [8, 19], aggro: 64, range: 18, cd: 1400, charge: 100 },
  // 속삭임 숲
  splitboar: { name: "반쪽 멧돼지", lv: 8, hp: 170, atk: 23, def: 2, spd: 44, xp: 60, gold: [10, 22], aggro: 80, range: 18, cd: 1100, charge: 104 },
  ribdeer: { name: "갈비뼈 사슴", lv: 10, hp: 330, atk: 26, def: 8, spd: 26, xp: 92, gold: [12, 26], aggro: 64, range: 18, cd: 1400, slam: 34 },
  hydrasnake: { name: "세 머리 뱀", lv: 11, hp: 200, atk: 29, def: 2, spd: 36, xp: 96, gold: [12, 26], aggro: 92, range: 64, cd: 1700, volley: true },
  foxtwine: { name: "꼬인 여우", lv: 12, hp: 230, atk: 28, def: 3, spd: 62, xp: 108, gold: [13, 28], aggro: 96, range: 17, cd: 800, leap: 90 },
  mothface: { name: "인면 나방", lv: 13, hp: 210, atk: 34, def: 2, spd: 44, xp: 118, gold: [14, 30], aggro: 96, range: 72, cd: 1400, fly: true, shot: true, pool: 22, cloud: 34 },
  // 뼈의 지하묘지
  ratking: { name: "쥐 왕", lv: 12, hp: 260, atk: 29, def: 4, spd: 46, xp: 108, gold: [14, 28], aggro: 86, range: 17, cd: 850 },
  twinhare_bone: { name: "해골 쌍두 토끼", sp: "twinhare", tint: "bone", lv: 13, hp: 240, atk: 33, def: 3, spd: 56, xp: 112, gold: [13, 28], aggro: 90, range: 16, cd: 900 },
  bonehound: { name: "가죽 벗겨진 사냥개", lv: 14, hp: 300, atk: 40, def: 5, spd: 58, xp: 140, gold: [18, 36], aggro: 100, range: 18, cd: 1000, leap: 100, howl: 110 },
  toadbrood: { name: "알 밴 두꺼비", lv: 15, hp: 420, atk: 42, def: 8, spd: 28, xp: 160, gold: [20, 40], aggro: 86, range: 20, cd: 1500, pool: 26, pounce: 84 },
  batcluster: { name: "박쥐 덩어리", lv: 16, hp: 360, atk: 46, def: 4, spd: 52, xp: 178, gold: [22, 44], aggro: 96, range: 17, cd: 1100, fly: true, burst: 32 },
  // 네온 시티
  pigeonmass: { name: "비둘기 떼살", lv: 14, hp: 290, atk: 40, def: 5, spd: 56, xp: 140, gold: [18, 36], aggro: 100, range: 70, cd: 1300, fly: true, shot: true, spit: 100 },
  gutfrog_poison: { name: "맹독 창자 개구리", sp: "gutfrog", tint: "poison", lv: 16, hp: 400, atk: 46, def: 5, spd: 32, xp: 180, gold: [22, 44], aggro: 84, range: 17, cd: 1200, leap: 84, pool: 22 },
  doghead: { name: "세 머리 들개", lv: 17, hp: 460, atk: 52, def: 8, spd: 46, xp: 200, gold: [26, 50], aggro: 84, range: 19, cd: 1000, charge: 110, howl: 110 },
  squidrat: { name: "촉수 쥐", lv: 18, hp: 430, atk: 54, def: 6, spd: 54, xp: 225, gold: [26, 52], aggro: 92, range: 18, cd: 1000, pool: 22, poolKind: 2 },
  catsplit: { name: "갈라진 고양이", lv: 19, hp: 500, atk: 60, def: 6, spd: 54, xp: 250, gold: [28, 54], aggro: 92, range: 18, cd: 1000, leap: 100, pounce: 96 },
  fishwalker: { name: "다리 달린 생선", lv: 21, hp: 820, atk: 68, def: 18, spd: 30, xp: 330, gold: [40, 80], aggro: 72, range: 22, cd: 1500, slam: 34 },
  // 하수도
  leechmaw: { name: "거머리 아가리", lv: 22, hp: 800, atk: 73, def: 10, spd: 40, xp: 365, gold: [38, 72], aggro: 84, range: 19, cd: 1100, leap: 84 },
  ratking_bile: { name: "썩은 쥐 왕", sp: "ratking", tint: "bile", lv: 23, hp: 780, atk: 74, def: 10, spd: 50, xp: 400, gold: [40, 76], aggro: 90, range: 17, cd: 850, pool: 24 },
  gatorhalf: { name: "반쪽 악어", lv: 24, hp: 1200, atk: 82, def: 22, spd: 30, xp: 450, gold: [44, 82], aggro: 76, range: 21, cd: 1500, slam: 38, burrow: 100 },
  crabskull: { name: "두개골 게", lv: 25, hp: 1300, atk: 86, def: 24, spd: 34, xp: 490, gold: [48, 88], aggro: 80, range: 20, cd: 1400, charge: 120 },
  eelknot: { name: "뱀장어 매듭", lv: 26, hp: 950, atk: 90, def: 10, spd: 38, xp: 520, gold: [50, 92], aggro: 96, range: 74, cd: 1800, volley: true },
  // 수정 동굴
  spiderhand: { name: "손가락 거미", lv: 24, hp: 900, atk: 82, def: 10, spd: 56, xp: 440, gold: [42, 80], aggro: 92, range: 18, cd: 1000, leap: 96 },
  splitboar_frost: { name: "서리 반쪽 멧돼지", sp: "splitboar", tint: "frost", lv: 25, hp: 1000, atk: 88, def: 12, spd: 48, xp: 480, gold: [46, 86], aggro: 92, range: 19, cd: 1100, charge: 112 },
  moleworm: { name: "눈먼 두더지", lv: 26, hp: 1100, atk: 92, def: 14, spd: 44, xp: 520, gold: [50, 92], aggro: 90, range: 19, cd: 1200, leap: 100, slam: 36, burrow: 110 },
  bearmaw: { name: "아가리 곰", lv: 27, hp: 1600, atk: 98, def: 26, spd: 27, xp: 640, gold: [56, 100], aggro: 76, range: 21, cd: 1500, slam: 40, breath: 56 },
  hydrasnake_steel: { name: "강철 비늘 뱀", sp: "hydrasnake", tint: "steel", lv: 28, hp: 1250, atk: 100, def: 28, spd: 36, xp: 680, gold: [58, 104], aggro: 96, range: 70, cd: 1800, volley: true },
  owlstare: { name: "목 꺾인 올빼미", lv: 29, hp: 1150, atk: 106, def: 12, spd: 40, xp: 720, gold: [60, 108], aggro: 96, range: 76, cd: 1500, fly: true, shot: true, breath: 64 },
  boss: { name: "균열의 군주 크리온", lv: 32, hp: 24000, atk: 150, def: 32, spd: 34, xp: 10000, gold: [1500, 2500], aggro: 130, range: 30, cd: 1400, resp: 180000, boss: true, gear: 1, fan: 150, pool: 30, poolKind: 1 },
  // 피의 심연 — they bite about a fifth softer than they used to: a plainly geared Lv.32 could not stand at the door (probe: 9–34 deaths in two minutes)
  twingoat: { name: "쌍두 염소", lv: 32, hp: 1900, atk: 96, def: 24, spd: 44, xp: 900, gold: [70, 124], aggro: 88, range: 20, cd: 1100, charge: 110 },
  bonehound_ash: { name: "잿빛 사냥개", sp: "bonehound", tint: "ash", lv: 33, hp: 2000, atk: 100, def: 20, spd: 62, xp: 980, gold: [74, 130], aggro: 104, range: 19, cd: 950, leap: 110 },
  horsehalf: { name: "반쪽 말", lv: 34, hp: 2200, atk: 104, def: 22, spd: 60, xp: 1050, gold: [78, 136], aggro: 100, range: 20, cd: 1000, leap: 110 },
  batcluster_blood: { name: "피 박쥐 덩어리", sp: "batcluster", tint: "blood", lv: 35, hp: 2100, atk: 106, def: 18, spd: 54, xp: 1120, gold: [80, 140], aggro: 100, range: 18, cd: 1100, fly: true, burst: 36 },
  lionhand: { name: "손갈기 사자", lv: 35, hp: 2600, atk: 108, def: 26, spd: 50, xp: 1140, gold: [82, 144], aggro: 100, range: 21, cd: 1100, slam: 40, fan: 100, howl: 120 },
  serpentwing: { name: "날개 구렁이", lv: 36, hp: 2000, atk: 110, def: 18, spd: 44, xp: 1220, gold: [86, 150], aggro: 100, range: 78, cd: 1800, fly: true, volley: true, breath: 66 },
  sowseer: { name: "눈 달린 암퇘지", lv: 37, hp: 3000, atk: 112, def: 30, spd: 30, xp: 1300, gold: [90, 158], aggro: 88, range: 22, cd: 1500, pool: 30, poolKind: 2 },
  doghead_fire: { name: "불타는 세 머리 들개", sp: "doghead", tint: "fire", lv: 38, hp: 2900, atk: 116, def: 26, spd: 52, xp: 1400, gold: [94, 164], aggro: 100, range: 20, cd: 1000, charge: 116, pool: 24, poolKind: 1 },
  abyssboss: { name: "심연의 어미", lv: 40, hp: 48000, atk: 200, def: 40, spd: 34, xp: 30000, gold: [4000, 6000], aggro: 140, range: 30, cd: 1400, resp: 240000, boss: true, gear: 1, fan: 160, pool: 34, poolKind: 2, charge: 150 },
  // 정글 해안도로 (maps-v2 M3) — beasts met before, grown worse in the wet heat (new coast species come in a later step)
  catsplit_gold: { name: "표범 무늬 고양이", sp: "catsplit", tint: "gold", lv: 20, hp: 600, atk: 64, def: 6, spd: 56, xp: 290, gold: [32, 62], aggro: 94, range: 18, cd: 1000, leap: 100 },
  toadbrood_poison: { name: "늪 알 밴 두꺼비", sp: "toadbrood", tint: "poison", lv: 21, hp: 760, atk: 68, def: 14, spd: 30, xp: 330, gold: [36, 70], aggro: 86, range: 20, cd: 1500, pool: 26 },
  hydrasnake_poison: { name: "맹독 세 머리 뱀", sp: "hydrasnake", tint: "poison", lv: 23, hp: 780, atk: 78, def: 8, spd: 38, xp: 400, gold: [40, 76], aggro: 94, range: 66, cd: 1700, volley: true },
  mothface_bile: { name: "독가루 나방", sp: "mothface", tint: "bile", lv: 24, hp: 880, atk: 82, def: 8, spd: 44, xp: 450, gold: [44, 84], aggro: 96, range: 72, cd: 1400, fly: true, shot: true, pool: 22 },
  ribdeer_bile: { name: "이끼 갈비뼈 사슴", sp: "ribdeer", tint: "bile", lv: 26, hp: 1500, atk: 92, def: 22, spd: 30, xp: 540, gold: [50, 94], aggro: 80, range: 20, cd: 1400, slam: 38 },
  // 모래바람 오아시스
  foxtwine_gold: { name: "사막 꼬인 여우", sp: "foxtwine", tint: "gold", lv: 28, hp: 1200, atk: 100, def: 12, spd: 62, xp: 680, gold: [58, 104], aggro: 98, range: 17, cd: 850, leap: 96 },
  hydrasnake_gold: { name: "모래 세 머리 뱀", sp: "hydrasnake", tint: "gold", lv: 29, hp: 1250, atk: 102, def: 14, spd: 38, xp: 730, gold: [60, 108], aggro: 96, range: 70, cd: 1700, volley: true },
  lambmaw_bone: { name: "말라붙은 양", sp: "lambmaw", tint: "bone", lv: 30, hp: 1500, atk: 100, def: 16, spd: 40, xp: 790, gold: [64, 114], aggro: 90, range: 19, cd: 1200, charge: 112 },
  eyecrow_ash: { name: "잿빛 눈알 까마귀", sp: "eyecrow", tint: "ash", lv: 31, hp: 1400, atk: 98, def: 12, spd: 46, xp: 850, gold: [66, 118], aggro: 98, range: 18, cd: 1100, fly: true },
  twingoat_gold: { name: "모래 쌍두 염소", sp: "twingoat", tint: "gold", lv: 33, hp: 2000, atk: 100, def: 24, spd: 44, xp: 980, gold: [74, 130], aggro: 90, range: 20, cd: 1100, charge: 110 },
  bearmaw_gold: { name: "모래 아가리 곰", sp: "bearmaw", tint: "gold", lv: 34, hp: 2600, atk: 104, def: 28, spd: 28, xp: 1060, gold: [78, 136], aggro: 80, range: 21, cd: 1500, slam: 40 },
  // 산호 해안
  crabskull_blood: { name: "붉은 두개골 게", sp: "crabskull", tint: "blood", lv: 26, hp: 1370, atk: 92, def: 24, spd: 34, xp: 540, gold: [48, 88], aggro: 84, range: 20, cd: 1400, charge: 118 },
  fishwalker_frost: { name: "푸른 다리 달린 생선", sp: "fishwalker", tint: "frost", lv: 27, hp: 1580, atk: 95, def: 22, spd: 32, xp: 590, gold: [52, 92], aggro: 80, range: 22, cd: 1500, slam: 38 },
  eelknot_frost: { name: "산호 뱀장어 매듭", sp: "eelknot", tint: "frost", lv: 28, hp: 1320, atk: 99, def: 16, spd: 40, xp: 660, gold: [56, 100], aggro: 98, range: 76, cd: 1800, volley: true },
  squidrat_blood: { name: "산호 촉수 쥐", sp: "squidrat", tint: "blood", lv: 29, hp: 1500, atk: 101, def: 18, spd: 56, xp: 715, gold: [59, 105], aggro: 96, range: 18, cd: 1000, pool: 24, poolKind: 2 },
  leechmaw_bone: { name: "흰 거머리 아가리", sp: "leechmaw", tint: "bone", lv: 30, hp: 1700, atk: 103, def: 20, spd: 44, xp: 785, gold: [62, 111], aggro: 92, range: 19, cd: 1100, leap: 90 },
  gatorhalf_steel: { name: "강철 반쪽 악어", sp: "gatorhalf", tint: "steel", lv: 32, hp: 2100, atk: 106, def: 30, spd: 30, xp: 880, gold: [69, 119], aggro: 82, range: 21, cd: 1500, slam: 42 },
  // 모래바다 (dunesea) — placeholders in new tints, to be balanced later (docs/design/level-bands.md): the dunes' own,
  // the oasis belt's, the shallows'; the sand mole is the field boss
  ratking_gold: { name: "모래쥐 왕", sp: "ratking", tint: "gold", lv: 31, hp: 1750, atk: 100, def: 16, spd: 50, xp: 850, gold: [66, 118], aggro: 92, range: 17, cd: 850, pool: 24 },
  spiderhand_bone: { name: "백골 손가락 거미", sp: "spiderhand", tint: "bone", lv: 32, hp: 1950, atk: 102, def: 16, spd: 56, xp: 910, gold: [70, 124], aggro: 94, range: 18, cd: 1000, leap: 96 },
  bonehound_gold: { name: "모래 사냥개", sp: "bonehound", tint: "gold", lv: 33, hp: 1900, atk: 102, def: 18, spd: 58, xp: 980, gold: [74, 130], aggro: 100, range: 18, cd: 1000, leap: 100 },
  owlstare_gold: { name: "모래 올빼미", sp: "owlstare", tint: "gold", lv: 34, hp: 1900, atk: 108, def: 16, spd: 42, xp: 1050, gold: [78, 136], aggro: 98, range: 76, cd: 1500, fly: true, shot: true },
  fishwalker_blood: { name: "붉은 다리 달린 생선", sp: "fishwalker", tint: "blood", lv: 35, hp: 2500, atk: 106, def: 24, spd: 32, xp: 1120, gold: [80, 140], aggro: 80, range: 22, cd: 1500, slam: 38 },
  crabskull_frost: { name: "푸른 두개골 게", sp: "crabskull", tint: "frost", lv: 36, hp: 2600, atk: 108, def: 30, spd: 34, xp: 1220, gold: [86, 150], aggro: 84, range: 20, cd: 1400, charge: 118 },
  moleworm_gold: { name: "모래 두더지", sp: "moleworm", tint: "gold", lv: 37, hp: 2800, atk: 112, def: 22, spd: 44, xp: 1300, gold: [90, 158], aggro: 90, range: 19, cd: 1200, leap: 100, slam: 40 },
  // 운해 사원 · 붉은바위 황금궁 (maps-batch2, batch 1) — existing bodies in new tints with the fallback names of the design
  // doc; the new species (염주 원숭이, 겹날개 두루미, 운해의 범 · 전갈 등뼈, 독수리 갈비, 금관 공작) are a later step. Placeholders,
  // (a recoloured kind must outrank the body it borrows — tests/hard.mjs — so the temple's lowest and its flyer are a hound and an owl,
  // not the doc's squirrels and winged serpent; the mesa's owl is in fire because owlstare_gold is the dune sea's)
  // to be balanced later (docs/design/level-bands.md). ribdeer_frost and serpentwing_bone are the rare kinds (pocket keepers for now)
  splitboar_ash: { name: "먹빛 반쪽 멧돼지", sp: "splitboar", tint: "ash", lv: 31, hp: 1850, atk: 100, def: 16, spd: 48, xp: 850, gold: [66, 118], aggro: 92, range: 19, cd: 1100, charge: 112 },
  ribdeer_gold: { name: "단풍 갈비뼈 사슴", sp: "ribdeer", tint: "gold", lv: 33, hp: 2100, atk: 102, def: 24, spd: 32, xp: 980, gold: [74, 130], aggro: 84, range: 20, cd: 1400, slam: 40 },
  eelknot_gold: { name: "비단 뱀장어 매듭", sp: "eelknot", tint: "gold", lv: 34, hp: 1900, atk: 106, def: 16, spd: 40, xp: 1050, gold: [78, 136], aggro: 98, range: 76, cd: 1800, volley: true },
  ribdeer_frost: { name: "흰 갈비뼈 사슴", sp: "ribdeer", tint: "frost", lv: 34, hp: 2300, atk: 106, def: 26, spd: 34, xp: 1400, gold: [110, 190], aggro: 86, range: 20, cd: 1400, slam: 42 },
  bearmaw_ash: { name: "종지기 곰", sp: "bearmaw", tint: "ash", lv: 35, hp: 2700, atk: 108, def: 28, spd: 28, xp: 1130, gold: [82, 144], aggro: 80, range: 21, cd: 1500, slam: 42, pool: 26, poolKind: 1, charge: 110 },
  spinescorp_fire: { name: "붉은 전갈 등뼈", sp: "spinescorp", tint: "fire", lv: 36, hp: 2500, atk: 110, def: 20, spd: 58, xp: 1200, gold: [86, 150], aggro: 96, range: 18, cd: 950, charge: 114 },
  ribvulture_fire: { name: "붉은 독수리 갈비", sp: "ribvulture", tint: "fire", lv: 38, hp: 2400, atk: 114, def: 18, spd: 46, xp: 1350, gold: [90, 158], aggro: 98, range: 76, cd: 1400, fly: true, shot: true },
  foxtwine_fire: { name: "붉은 꼬인 여우", sp: "foxtwine", tint: "fire", lv: 37, hp: 2600, atk: 112, def: 18, spd: 62, xp: 1300, gold: [90, 158], aggro: 98, range: 17, cd: 850, leap: 96 },
  twingoat_blood: { name: "벼랑 붉은 염소", sp: "twingoat", tint: "blood", lv: 39, hp: 3100, atk: 116, def: 28, spd: 44, xp: 1450, gold: [95, 166], aggro: 90, range: 20, cd: 1100, charge: 112 },
  sowseer_gold: { name: "금박 암퇘지", sp: "sowseer", tint: "gold", lv: 40, hp: 3400, atk: 118, def: 32, spd: 30, xp: 1500, gold: [96, 168], aggro: 88, range: 22, cd: 1500, pool: 30, poolKind: 2 },
  serpentwing_bone: { name: "백골 날개 구렁이", sp: "serpentwing", tint: "bone", lv: 40, hp: 3200, atk: 120, def: 22, spd: 46, xp: 2000, gold: [130, 220], aggro: 100, range: 78, cd: 1800, fly: true, volley: true },
  horsehalf_gold: { name: "황금 반쪽 말", sp: "horsehalf", tint: "gold", lv: 41, hp: 3300, atk: 120, def: 26, spd: 60, xp: 1560, gold: [98, 170], aggro: 100, range: 20, cd: 1000, leap: 110 },
  lionhand_gold: { name: "황금 손갈기 사자", sp: "lionhand", tint: "gold", lv: 42, hp: 3900, atk: 124, def: 30, spd: 52, xp: 1620, gold: [100, 174], aggro: 100, range: 21, cd: 1100, fan: 150, charge: 120, pool: 28, poolKind: 1 },
  // 단풍 왕도 — the fallen kingdom's forest above the chasm, where the blight came up through the roots:
  // beasts and plants alike sprouting violet rot and eyes
  blightsquirrel: { name: "한 꼬리 다람쥐떼", lv: 40, hp: 2400, atk: 114, def: 16, spd: 64, xp: 1500, gold: [96, 168], aggro: 104, range: 18, cd: 850, leap: 100 },
  stumpmaw: { name: "아가리 그루터기", lv: 41, hp: 3600, atk: 118, def: 34, spd: 24, xp: 1560, gold: [98, 170], aggro: 80, range: 22, cd: 1500, slam: 40 },
  crowscare: { name: "까마귀 허수아비", lv: 42, hp: 2600, atk: 120, def: 18, spd: 30, xp: 1620, gold: [100, 174], aggro: 100, range: 78, cd: 1600, shot: true, fan: 96 },
  shroomboar: { name: "버섯등 멧돼지", lv: 43, hp: 3300, atk: 124, def: 28, spd: 48, xp: 1700, gold: [104, 180], aggro: 92, range: 20, cd: 1100, charge: 116, pool: 26, cloud: 34 },
  gravrose: { name: "묘지 장미", lv: 44, hp: 3000, atk: 128, def: 22, spd: 22, xp: 1780, gold: [108, 186], aggro: 96, range: 72, cd: 1600, volley: true, pool: 28, poolKind: 2 },
  rotstag: { name: "썩은 관 사슴왕", lv: 46, hp: 5200, atk: 136, def: 32, spd: 42, xp: 2200, gold: [120, 204], aggro: 92, range: 22, cd: 1300, charge: 124, slam: 42, fan: 100 },
  bogcrown: { name: "검은 왕관 뿌리짐승", sp: "bogcrown", lv: 47, hp: 4250, atk: 138, def: 35, spd: 28, xp: 3100, gold: [118, 184], aggro: 82, range: 22, cd: 1600, slam: 42 },
  hollowowl: { name: "눈먼 문지기 올빼미", sp: "hollowowl", lv: 49, hp: 4050, atk: 144, def: 30, spd: 34, xp: 3550, gold: [122, 195], aggro: 94, range: 68, cd: 1800, fly: true, fan: 105, breath: 70 },
  rootwarden: { name: "얼어붙은 왕릉 파수꾼", sp: "rootwarden", lv: 50, hp: 5500, atk: 155, def: 42, spd: 39, xp: 3950, gold: [134, 210], aggro: 90, range: 22, cd: 1450, charge: 128, slam: 43 },
  // 성에왕의 성채: the open approach, the paired galleries and the crown chamber
  rimehare: { name: "서리창 쌍두토끼", lv: 50, hp: 4600, atk: 142, def: 30, spd: 52, xp: 3400, gold: [132, 204], aggro: 80, range: 18, cd: 1350, leap: 92 },
  frostmoth: { name: "갈라진 유리날개", lv: 50, hp: 4500, atk: 149, def: 33, spd: 37, xp: 3900, gold: [142, 218], aggro: 92, range: 32, cd: 1900, fly: true, fan: 96, cloud: 30 },
  crownstag: { name: "성에왕 유리뿔", lv: 50, hp: 520000, atk: 205, def: 50, spd: 34, xp: 74000, gold: [5200, 7600], aggro: 124, range: 30, cd: 1500, resp: 300000, boss: true, gear: 1, charge: 148, slam: 48, fan: 144, pool: 34, poolKind: 2 },
  // ── new species (public/mobart_e.js). Each took the row of the tinted stand-in it replaced, so the grounds weigh what
  //    they did; the stand-ins' rows stay above for old collections (the ones no longer met: catsplit_gold, toadbrood_poison,
  //    mothface_bile, ribdeer_bile; lambmaw_bone, eyecrow_ash, twingoat_gold, bearmaw_gold; crabskull_blood, fishwalker_frost,
  //    eelknot_frost, squidrat_blood, gatorhalf_steel; spiderhand_bone, owlstare_gold, moleworm_gold, fishwalker_blood, crabskull_frost).
  // 정글 해안도로
  vinemonkey: { name: "덩굴 원숭이", lv: 20, hp: 600, atk: 64, def: 6, spd: 56, xp: 290, gold: [32, 62], aggro: 94, range: 18, cd: 1000, leap: 100 },
  dartbrood: { name: "독개구리 떼", lv: 21, hp: 760, atk: 68, def: 14, spd: 30, xp: 330, gold: [36, 70], aggro: 86, range: 20, cd: 1500, pool: 26, spit: 96 },
  orchidmantis: { name: "난초 사마귀", lv: 24, hp: 880, atk: 82, def: 8, spd: 44, xp: 450, gold: [44, 84], aggro: 96, range: 72, cd: 1400, shot: true, pool: 22 },
  loggator: { name: "악어 통나무", lv: 26, hp: 1500, atk: 92, def: 22, spd: 30, xp: 540, gold: [50, 94], aggro: 80, range: 20, cd: 1400, slam: 38, charge: 110 },
  // 산호 해안
  hermitskull: { name: "집게 소라게 떼", lv: 26, hp: 1370, atk: 92, def: 24, spd: 34, xp: 540, gold: [48, 88], aggro: 84, range: 20, cd: 1400, charge: 118 },
  barnacleseal: { name: "따개비 물개", lv: 27, hp: 1580, atk: 95, def: 22, spd: 32, xp: 590, gold: [52, 92], aggro: 80, range: 22, cd: 1500, slam: 38 },
  brainjelly: { name: "해파리 뇌", lv: 28, hp: 1320, atk: 99, def: 16, spd: 40, xp: 660, gold: [56, 100], aggro: 98, range: 76, cd: 1800, volley: true, cloud: 32 },
  eyegull: { name: "갈매기 눈알", lv: 29, hp: 1500, atk: 101, def: 18, spd: 56, xp: 715, gold: [59, 105], aggro: 96, range: 18, cd: 1000, fly: true, pool: 24, poolKind: 2 },
  coralturtle: { name: "산호 뿔 거북", lv: 32, hp: 2100, atk: 106, def: 30, spd: 30, xp: 880, gold: [69, 119], aggro: 82, range: 21, cd: 1500, slam: 42, charge: 112 },
  // 모래바람 오아시스
  spinescorp_gold: { name: "모래 전갈 등뼈", sp: "spinescorp", tint: "gold", lv: 30, hp: 1800, atk: 100, def: 16, spd: 40, xp: 790, gold: [64, 114], aggro: 90, range: 19, cd: 1200, charge: 112 },
  ribvulture_bone: { name: "백골 독수리 갈비", sp: "ribvulture", tint: "bone", lv: 31, hp: 1750, atk: 98, def: 12, spd: 46, xp: 850, gold: [66, 118], aggro: 98, range: 18, cd: 1100, fly: true },
  cactushog: { name: "선인장 고슴도치", lv: 33, hp: 2000, atk: 100, def: 24, spd: 44, xp: 980, gold: [74, 130], aggro: 90, range: 20, cd: 1100, charge: 110, spit: 90 },
  mummycamel: { name: "미라 낙타", lv: 34, hp: 2600, atk: 104, def: 28, spd: 28, xp: 1060, gold: [78, 136], aggro: 80, range: 21, cd: 1500, slam: 40, charge: 110, spit: 100 },
  // 모래바다
  spinescorp_bone: { name: "백골 전갈 등뼈", sp: "spinescorp", tint: "bone", lv: 32, hp: 2250, atk: 102, def: 16, spd: 56, xp: 910, gold: [70, 124], aggro: 94, range: 18, cd: 1000, charge: 112 },
  ribvulture_gold: { name: "모래 독수리 갈비", sp: "ribvulture", tint: "gold", lv: 34, hp: 1900, atk: 108, def: 16, spd: 42, xp: 1050, gold: [78, 136], aggro: 98, range: 76, cd: 1500, fly: true, shot: true },
  barnacleseal_blood: { name: "붉은 따개비 물개", sp: "barnacleseal", tint: "blood", lv: 35, hp: 2500, atk: 106, def: 24, spd: 32, xp: 1120, gold: [80, 140], aggro: 80, range: 22, cd: 1500, slam: 38 },
  hermitskull_frost: { name: "푸른 집게 소라게 떼", sp: "hermitskull", tint: "frost", lv: 36, hp: 2600, atk: 108, def: 30, spd: 34, xp: 1220, gold: [86, 150], aggro: 84, range: 20, cd: 1400, charge: 118 },
  sandmaw: { name: "모래 지렁이 아가리", lv: 37, hp: 2800, atk: 112, def: 22, spd: 44, xp: 1300, gold: [90, 158], aggro: 90, range: 19, cd: 1200, leap: 100, slam: 40, burrow: 120 },
  // 붉은 협곡 (mesa) and 구름 사원 (cloudtemple) — not met yet: their maps take these when they open (docs/design/maps-batch2.md)
  beadmonkey: { name: "염주 원숭이", lv: 30, hp: 1500, atk: 100, def: 14, spd: 60, xp: 790, gold: [64, 114], aggro: 98, range: 18, cd: 900, leap: 96 },
  wingcrane: { name: "겹날개 두루미", lv: 32, hp: 1700, atk: 104, def: 14, spd: 44, xp: 910, gold: [70, 124], aggro: 98, range: 74, cd: 1700, fly: true, volley: true },
  mistiger: { name: "운해의 범", lv: 36, hp: 30000, atk: 160, def: 34, spd: 40, xp: 14000, gold: [2000, 3200], aggro: 130, range: 30, cd: 1400, resp: 180000, boss: true, gear: 1, charge: 150, leap: 120, fan: 150 },
  spinescorp: { name: "전갈 등뼈", lv: 29, hp: 1400, atk: 96, def: 14, spd: 48, xp: 700, gold: [58, 104], aggro: 94, range: 19, cd: 1000, charge: 114, spit: 100 },
  ribvulture: { name: "독수리 갈비", lv: 30, hp: 1300, atk: 94, def: 10, spd: 44, xp: 760, gold: [60, 110], aggro: 98, range: 76, cd: 1500, fly: true, shot: true },
  airship_gale: { name: "그을린 날개 추격수", lore: "한쪽 날개의 깃이 잿빛으로 굳었다. 바람등호의 신호등이 켜지면 돛줄에 내려앉는다.",
    lv: 26, hp: 840, atk: 74, def: 9, spd: 44, xp: 0, gold: [0, 0], aggro: 105, range: 18, cd: 1250, questOnly: true },
  airship_lookout: { name: "흑기수 외눈수리", lore: "깃이 찢어진 외눈수리가 정찰등 하나를 낚아채 매달고 다닌다. 빛을 본 조류 떼가 그 뒤를 따른다.",
    lv: 28, hp: 4300, atk: 101, def: 13, spd: 36, xp: 0, gold: [0, 0], aggro: 125, range: 70, cd: 1500, shot: true, boss: true, questOnly: true,
    fan: 112, script: { gap: 5800, reach: 148, pats: [["검댕 깃털", "fan"], ["돛대 덮치기", "leapslam"]] } },
  crownpeacock: { name: "금관 공작", lv: 42, hp: 4200, atk: 124, def: 30, spd: 46, xp: 1900, gold: [104, 180], aggro: 92, range: 22, cd: 1300, fan: 150, charge: 120, pool: 28, poolKind: 1 },
  // bosses-2 (docs/design/bosses-2.md §2–3, §6–7): 혈루 왕도마뱀 keeps its own lair in mesa (a boss row: its health is the design's
  // field-boss figure 4,800 × 14, its atk 128 × 1.8), 망치 갯가재 is the coast's field boss (FIELD_BOSS: × 14 / × 1.8 at spawn).
  // `script` drives their fights (56-boss-script.js); `drops` [item, chance, min, max] are their own finds (lootFor).
  bloodhorn: { name: "혈루 왕도마뱀", lv: 41, hp: 67200, atk: 230, def: 32, spd: 34, xp: 32000, gold: [4200, 6400], aggro: 130, range: 30, cd: 1300, resp: 240000,
    boss: true, gear: 1, charge: 140, pool: 26, poolKind: 1, drops: [["mat_bloodtear", 1, 1, 3], ["w_bloodcrown", 0.03]],
    script: { cast: "혈루 대분출", castMs: 4000, stunMs: 4000, stag: 0.04, blast: 2.2, gap: 5000, enrage: 150000, reach: 220,
      pats: [["혈루 사출", "jet"], ["뿔관 돌진", "charge"], ["결정 가시 산탄", "fan"], ["모래 잠행", "leapslam"], ["꼬리 휩쓸기", "cone", { back: 1 }], ["피의 비", "blast"]],
      phases: [
        { at: 0.6, cast: 1, pats: [["혈루 사출", "jet"], ["뿔관 연속 돌진", "charge2"], ["결정 가시 폭풍", "fan3"], ["모래 잠행", "leapslam"], ["꼬리 휩쓸기", "cone", { back: 1 }],
          ["붉은 결정 성장", "adds", { kind: "bloodshard", n: 3, cap: 3, d: 48 }], ["피의 비", "blast"]] },
        // 혈루 폭주: every pattern leaves a burn pool, the gap a quarter shorter
        { at: 0.25, cast: 1, gap: 3750, steps: [{ f: "pool", dt: 400 }], pats: [["혈루 사출", "jet"], ["뿔관 연속 돌진", "charge2"], ["결정 가시 폭풍", "fan3"], ["모래 잠행", "leapslam"],
          ["꼬리 휩쓸기", "cone", { back: 1 }], ["붉은 결정 성장", "adds", { kind: "bloodshard", n: 3, cap: 3, d: 48 }], ["피의 비", "blast"]] },
      ] } },
  // bosses-2 §4–5: the weekly raids (DIM_CHAL.bosses holds their scripts). 밤장막 박쥐군주 at tier 25 (owner, mid-game: the
  // design's tier-45 figures scaled to 크리온's row one band up), 꽃무덤 고래 at the cap; their adds: bats that feed it, hagfish
  // heads that shield it.
  cloakbat: { name: "밤장막 박쥐군주", lv: 25, hp: 21000, atk: 120, def: 22, spd: 36, xp: 7000, gold: [1200, 2000], aggro: 140, range: 30, cd: 1400, boss: true, gear: 1,
    fan: 150, pool: 30, poolKind: 0, drops: [["veil_h", 0.03], ["veil_a", 0.03], ["veil_r", 0.03], ["veil_n", 0.03], ["w_ribbook", 0.04]] },
  nightbat: { name: "밤장막 흡혈박쥐", sp: "nightbat", lv: 25, hp: 500, atk: 40, def: 8, spd: 54, xp: 300, gold: [20, 40], aggro: 220, range: 18, cd: 1100, fly: true },
  bloomwhale: { name: "꽃무덤 고래", lv: 50, hp: 56000, atk: 165, def: 52, spd: 30, xp: 90000, gold: [6000, 9000], aggro: 170, range: 34, cd: 1500, boss: true, gear: 1,
    fan: 160, pool: 34, poolKind: 2, drops: [["bloom_h", 0.025], ["bloom_a", 0.025], ["bloom_r", 0.025], ["bloom_n", 0.025], ["w_whalebow", 0.015], ["w_bloomstaff", 0.015], ["pet_hagfish", 0.02]] },
  hagfishhead: { name: "먹장어 머리", sp: "hagfishhead", lv: 50, hp: 9000, atk: 150, def: 30, spd: 8, xp: 2000, gold: [60, 120], aggro: 300, range: 76, cd: 1500, shot: true },
  // its phase-2 adds.
  bloodshard: { name: "혈루 결정 전갈", sp: "bloodshard", lv: 41, hp: 1000, atk: 110, def: 20, spd: 40, xp: 420, gold: [20, 40], aggro: 140, range: 19, cd: 1100, slam: 34 },
  clubshrimp: { name: "망치 갯가재", lv: 39, hp: 4400, atk: 120, def: 30, spd: 42, xp: 1700, gold: [96, 166], aggro: 92, range: 22, cd: 1200, charge: 120, pool: 26, poolKind: 2,
    drops: [["mat_clubclaw", 1, 1, 3], ["w_cavhammer", 0.03]],
    script: { cast: "초공동 일격", castMs: 5000, stunMs: 5000, stag: 0.04, blast: 2.4, gap: 5000, enrage: 150000,
      pats: [["공동 펀치", "punch"], ["연타 돌진", "charge"], ["물거품 산탄", "fan"], ["소용돌이", "donut"], ["거품 함정", "pools"], ["조수 표식", "mark", { n: 2 }], ["파도 강타", "blast"]],
      // 갑각 균열: punches in pairs, the whirl faster, three marked
      phases: [{ at: 0.5, pats: [["공동 연타", "punch", { n: 2 }], ["연타 돌진", "charge2"], ["물거품 산탄", "fan"], ["소용돌이", "donut", { ms: 1100 }], ["거품 함정", "pools"],
        ["조수 표식", "mark", { n: 3 }], ["파도 강타", "blast"]] }] } },
};
// Treasure chests are "monsters" that never move or fight: break one open for a sure piece of gear.
for (const [id, lv, hp, gold] of [["meadow", 4, 40, [30, 60]], ["forest", 11, 160, [80, 150]], ["crypt", 15, 300, [130, 240]], ["city", 18, 420, [180, 320]],
  ["sewer", 24, 760, [280, 480]], ["cave", 27, 900, [320, 560]], ["abyss", 35, 1500, [520, 900]], ["maple", 43, 1800, [600, 1000]],
  ["jungle", 23, 640, [240, 420]], ["oasis", 31, 1200, [420, 740]], ["coast", 30, 1250, [440, 775]], ["dunesea", 34, 1420, [490, 840]],
  ["cloudtemple", 33, 1380, [480, 820]], ["mesa", 39, 1650, [560, 950]]]) {
  MOBS[`chest_${id}`] = { name: "보물 상자", sp: "chest", lv, hp, atk: 0, def: 0, spd: 0, xp: 0, gold, aggro: 0, range: 0, cd: 1e9, resp: 300000, chest: true, still: true, gear: 1 };
}
for (const k of Object.keys(MOBS)) {
  const d = MOBS[k];
  if (!d.sp) d.sp = k;
  for (const mv in TRICKS) if (d[mv] === undefined && MOBS[d.sp] && MOBS[d.sp][mv]) d[mv] = MOBS[d.sp][mv];
  d.spd = Math.round(d.spd * 0.68);              // the whole world moves at an easier pace
  d.atk = Math.round(d.atk * (MOB_ATK - Math.max(0, d.lv - ATK_EASE[0]) * ATK_EASE[1]));
  d.moves = MOVES.filter((mv) => d[mv]);
  if (!d.resp) d.resp = 4500 + d.lv * 150;       // hunting grounds refill quickly
  if (!d.gear) d.gear = (0.06 + d.lv * 0.002) * GEAR_CUT;
}
/** How long a dungeon's guardian (a fixed rank-2 monster) stays down. */
const GUARD_RESP = 180000;

/**
 * One chain of errands, leading through every ground in the order a character can survive them.
 * The world map editor may replace the whole chain (data/quests.json "main"; checked by data:check).
 */
const QUESTS = Array.isArray(DATA.quests.main) && DATA.quests.main.length ? DATA.quests.main.map((q) => ({
  mob: String(q.mob), n: Math.max(1, q.n | 0), title: String(q.title || ""), text: String(q.text || ""), xp: Math.max(0, q.xp | 0), gold: Math.max(0, q.gold | 0),
  fb: q.fb ? 1 : 0, items: (Array.isArray(q.items) ? q.items : []).filter((it) => Array.isArray(it) && typeof it[0] === "string" && Object.hasOwn(ITEMS, it[0])).map(([id, n]) => [id, Math.max(1, n | 0)]),
})).filter((q) => Object.hasOwn(MOBS, q.mob)) : [
  { mob: "twinhare", n: 5, title: "초원의 쌍두 토끼", text: "우린 스스로를 작은꼬리들(Tinytales)이라 부르네. 루넬샤의 풀과 나무 사이에 집을 짓고 수천 해를 평화롭게 살았지. 옛날 이 땅을 지옥의 괴물들이 다스렸다는 말은 아이들 겁주는 동화인 줄만 알았네. 그런데 대륙 동쪽 끝에서 풀과 짐승이 뒤틀리더니, 이제 초원까지 왔어. 광장으로 오는 길의 쌍두 토끼 5마리를 물리쳐 주겠나?", xp: 90, gold: 60, items: [["hp_s", 5]] },
  { mob: "gutfrog", n: 6, title: "뒤집힌 개구리", text: "네온 시티가 함락된 뒤 우리는 서쪽 버드나무숲으로 피했네. 광장 식구들은 내일 장이 설 것처럼 웃으며 자리를 펴지만, 피난길에서 돌아오지 못한 이들이 많아. 길목에서 창자 개구리 6마리를 잡아 주게. 뒤따라오는 작은꼬리들이 건너올 수 있도록.", xp: 220, gold: 120, items: [["mp_s", 5]] },
  { mob: "eyecrow", n: 8, title: "지켜보는 것들", text: "숲에서 숨죽이고 기다리기만 할 수 없다고 나선 작은꼬리들이 있네. 자네와 함께 동쪽의 일을 알아보고 싶다더군. 우선 연못 위를 도는 눈알 까마귀 8마리부터 떨어뜨려 주게. 먼저 덤비지는 않지만 사방을 지켜보고 있어.", xp: 520, gold: 200, items: [["stone", 2]] },
  { mob: "lambmaw", n: 8, title: "뒤집힌 것", text: "초원 가장 깊은 곳에 안팎이 뒤집힌 양이 돌아다닌다네. 8마리를 잡아 주게. 고개를 숙이면 곧장 달려드니, 그 줄에서 비켜서게.", xp: 800, gold: 300, items: [["hp_s", 8]] },
  { mob: "lambmaw", n: 1, fb: 1, title: "초원의 우두머리", text: "초원 깊은 곳에 유난히 큰 뒤집힌 양이 버티고 섰다네. 그 녀석이 선 자리로 가 보게. 혼자서 맞서야 할 걸세.", xp: 900, gold: 320, items: [] },
  { mob: "splitboar", n: 10, title: "숲의 반쪽", text: "속삭임 숲에는 몸이 반만 남은 멧돼지가 돌아다닌다네. 10마리를 사냥해 주게. 멀리서도 뛰어드니 동료를 구해 보게.", xp: 1300, gold: 450, items: [["hp_m", 5], ["ru_vit", 1]] },
  { mob: "hydrasnake", n: 10, title: "세 갈래 혀", text: "숲 깊은 곳의 세 머리 뱀 10마리를 베어 주게. 독을 뱉으니 서 있지 말고 움직이게.", xp: 2200, gold: 600, items: [["stone", 3]] },
  { mob: "ribdeer", n: 1, fb: 1, title: "갈비뼈의 주인", text: "속삭임 숲의 갈비뼈 사슴 우두머리가 길을 막고 있다네. 놈이 선 자리로 가서 홀로 쓰러뜨려 주게.", xp: 2400, gold: 650, items: [] },
  { mob: "ratking", n: 12, title: "무덤 아래", text: "숲의 막다른 폐허에 지하묘지로 내려가는 계단이 있다네. 꼬리가 엉킨 쥐 왕 12마리를 정리해 주게.", xp: 3000, gold: 750, items: [["hp_m", 5]] },
  { mob: "toadbrood", n: 10, title: "등에 밴 것", text: "지하묘지의 알 밴 두꺼비 10마리를 잡아 주게. 뱉어 놓은 웅덩이는 한참 남으니, 밟고 서 있지 말게.", xp: 3500, gold: 820, items: [["mp_m", 4]] },
  { mob: "batcluster", n: 10, title: "터지는 것", text: "지하묘지 깊은 곳의 박쥐 덩어리 10마리를 터뜨려 주게. 죽으면서 터지니, 쓰러뜨리고 물러서게.", xp: 4000, gold: 900, items: [["ru_ign", 1]] },
  { mob: "toadbrood", n: 1, fb: 1, title: "알을 품은 어미", text: "지하묘지 깊은 곳에 알을 잔뜩 밴 두꺼비 우두머리가 있네. 그 자리에 서면 놈이 자네만 노릴 걸세.", xp: 4300, gold: 950, items: [] },
  { mob: "pigeonmass", n: 10, title: "다른 세계의 하늘", text: "지하묘지 깊은 회랑 끝에서 네온 시티 변두리로 들어갈 수 있네. 한 덩어리로 뭉친 비둘기 떼살 10마리를 잡아 주게.", xp: 4600, gold: 1000, items: [["mp_m", 5]] },
  { mob: "catsplit", n: 12, title: "뒷골목의 울음", text: "네온 시티 골목의 갈라진 고양이 12마리를 잡아 주게. 소리 없이 뛰어든다네.", xp: 6500, gold: 1300, items: [["stone", 4]] },
  { mob: "doghead", n: 1, fb: 1, title: "세 머리의 왕", text: "네온 시티 골목을 세 머리 들개 우두머리가 휘젓고 다닌다네. 생선 떼를 치러 가기 전에, 놈의 자리로 가서 혼자 상대해 주게.", xp: 10000, gold: 1900, items: [] },
  { mob: "fishwalker", n: 10, title: "뭍에 오른 것", text: "다리 달린 생선 10마리를 쓰러뜨려 주게. 단단하니 파티가 필요할 걸세.", xp: 9500, gold: 1800, items: [["stone", 5]] },
  { mob: "leechmaw", n: 12, title: "도시의 밑바닥", text: "네온 시티 뒷마당에 하수도로 내려가는 구멍이 있다네. 거머리 아가리 12마리를 떼어 내 주게.", xp: 12000, gold: 2200, items: [["hp_m", 8]] },
  { mob: "crabskull", n: 10, title: "남의 머리", text: "하수도에는 남의 두개골을 뒤집어쓴 게가 있다네. 두개골 게 10마리를 부숴 주게. 단단하고, 돌진이 매섭네.", xp: 13500, gold: 2400, items: [["stone", 4]] },
  { mob: "eelknot", n: 10, title: "매듭", text: "하수도 끝의 뱀장어 매듭 10마리를 풀어 주게. 멀리서 전기를 쏜다네.", xp: 15000, gold: 2600, items: [["ru_acu", 1]] },
  { mob: "crabskull", n: 1, fb: 1, title: "하수도의 투구", text: "하수도 끝에 남의 두개골을 겹겹이 쓴 게 우두머리가 있네. 놈이 버틴 자리에서 홀로 깨부숴 주게.", xp: 16000, gold: 2700, items: [] },
  { mob: "bearmaw", n: 8, title: "배에 난 입", text: "하수도 끝 회랑의 물길을 따라가면 수정 동굴이 나와. 아가리 곰 8마리를 쓰러뜨려 주게. 땅을 내리칠 땐 물러서게.", xp: 19000, gold: 3200, items: [["ru_san", 1], ["stone", 5]] },
  { mob: "moleworm", n: 1, fb: 1, title: "땅속의 장님", text: "수정 동굴 깊은 곳의 눈먼 두더지 우두머리가 땅을 뒤집고 있다네. 놈의 자리로 가서 혼자 끝내 주게.", xp: 24000, gold: 3400, items: [] },
  { mob: "loggator", n: 1, fb: 1, v20: 1, title: "썩은 통나무의 주둥이", text: "정글 해안도로 물가에 통나무인 척 누운 악어가 있다네. 지나가는 이를 죄다 삼킨다지. 놈이 누운 자리로 가서 홀로 뒤집어 주게.", xp: 25000, gold: 3500, items: [] },
  { mob: "mummycamel", n: 1, fb: 1, v20: 1, title: "붕대 감은 짐꾼", text: "모래바람 오아시스에 붕대를 칭칭 감은 낙타가 짐을 지고 서성인다네. 상인들이 길을 못 건너 난리일세. 놈의 자리로 가서 홀로 쓰러뜨려 주게.", xp: 28000, gold: 4500, items: [] },
  { mob: "boss", n: 1, title: "균열의 군주", text: "깊은 균열 건너에 군주 크리온이 있네. 놈이 서 있는 곳마다 길이 갈라진다는 보고가 들어왔어. 반드시 파티를 꾸려서 크리온을 쓰러뜨려 주게.", xp: 45000, gold: 8000, items: [["stone", 10], ["ru_lum", 1]] },
  { mob: "horsehalf", n: 12, title: "군주의 뒤편", text: "군주가 쓰러진 자리 뒤에 더 깊은 균열이 열렸네. 피의 심연의 반쪽 말 12마리를 쓰러뜨려 주게.", xp: 30000, gold: 5000, items: [["hp_m", 10], ["ru_fos", 1]] },
  { mob: "lionhand", n: 10, title: "손으로 된 갈기", text: "심연 깊은 곳의 손갈기 사자 10마리를 쓰러뜨려 주게. 땅을 치고, 멀리서는 무언가를 던진다네.", xp: 38000, gold: 6000, items: [["stone", 8]] },
  { mob: "lionhand", n: 1, fb: 1, title: "갈기의 손아귀", text: "심연 깊은 곳에 손으로 된 갈기를 두른 사자 우두머리가 있네. 놈이 선 자리에서 홀로 맞서 주게.", xp: 42000, gold: 5000, items: [] },
  { mob: "bearmaw_ash", n: 1, fb: 1, v20: 1, title: "재 쌓인 종지기", text: "구름 사원 종루에 재를 뒤집어쓴 곰이 종을 붙들고 있다네. 그 종소리에 산이 다 울린다지. 놈이 선 자리로 가서 홀로 입을 막아 주게.", xp: 44000, gold: 5200, items: [] },
  { mob: "sandmaw", n: 1, fb: 1, v20: 1, title: "모래 속의 아가리", text: "모래바다 한복판에서 모래가 소용돌이치면 아가리가 올라온다네. 오아시스 마을 사람들이 그 밑에 발을 못 붙이고 있어. 놈의 자리로 가서 홀로 맞서 주게.", xp: 46000, gold: 5600, items: [] },
  { mob: "abyssboss", n: 1, title: "심연의 어미", text: "심연의 어미 곁에서 변이가 유난히 짙어지네. 어미를 쓰러뜨려 더 번지는 걸 막아 주게. 길 위에 남은 흔적은 그 뒤에 마저 살펴보세.", xp: 120000, gold: 20000, items: [["stone", 20], ["ru_lum", 2]] },
  { mob: "blightsquirrel", n: 12, title: "단풍 아래의 병", text: "어미는 쓰러졌지만, 그 병은 뿌리를 타고 지상으로 번졌다네. 속삭임 숲 동쪽, 단풍에 묻힌 옛 왕도로 가서 한 꼬리 다람쥐떼 12마리를 정리해 주게.", xp: 40000, gold: 6500, items: [["hp_m", 10]] },
  { mob: "shroomboar", n: 12, title: "포자 무덤", text: "왕도의 멧돼지들은 등에 버섯을 키운다네. 버섯등 멧돼지 12마리를 잡아 주게. 뱉어 낸 포자 웅덩이는 독이니 밟지 말게.", xp: 46000, gold: 7200, items: [["stone", 8], ["mp_m", 6]] },
  { mob: "rotstag", n: 4, title: "썩은 왕관", text: "무너진 예배당엔 왕관을 쓴 사슴이 산다네. 옛 왕의 사냥감이었다지. 썩은 관 사슴왕 4마리를 쓰러뜨려, 왕도의 병을 끊어 주게.", xp: 60000, gold: 9000, items: [["stone", 12], ["ru_lum", 1]] },
  { mob: "rotstag", n: 1, fb: 1, title: "썩은 왕관의 주인", text: "무너진 예배당 앞에 가장 큰 썩은 관 사슴왕이 버티고 있다네. 놈의 자리로 가서 홀로 왕관을 꺾어 주게.", xp: 60000, gold: 7000, items: [] },
  { mob: "bogcrown", n: 24, title: "서리에 물든 뿌리", text: "단풍 왕도 안쪽부터 땅이 얼고 있네. 검은 왕관 뿌리짐승 24마리를 베어 오래된 왕릉으로 가는 길을 트게.", xp: 52000, gold: 9500, items: [["stone", 12]] },
  { mob: "hollowowl", n: 28, title: "소리로 지키는 길", text: "왕도 깊은 폐허의 올빼미는 발자국 소리를 듣고 날아오르네. 눈먼 문지기 올빼미 28마리를 쓰러뜨려 사냥길을 열게.", xp: 61000, gold: 11000, items: [["hp_m", 15], ["mp_m", 10]] },
  { mob: "rootwarden", n: 32, title: "얼어붙은 왕의 문", text: "단풍 왕도 남동쪽에서 얼어붙은 왕릉 파수꾼 32마리를 쓰러뜨려 주게. 성에왕의 성채는 Lv.200부터 들어갈 수 있네.", xp: 74000, gold: 15000, items: [["stone", 16], ["ru_fos", 2]] },
  { mob: "crownstag", n: 1, title: "마지막 왕의 뿔", text: "성에왕의 성채 안쪽 왕좌에 유리뿔이 있다네. 원형 광장 바깥으로 빠질 길을 살핀 뒤 동료와 함께 왕을 쓰러뜨리고, 광장에 돌아와 보고해 주게. 정찰대가 왕좌 곁에서 읽어 볼 만한 비석을 찾았다네.", xp: 40000, gold: 24000, items: [["stone", 20], ["ru_lum", 2]] },
];

// ───────────────────────────── bag expansion and housing (46-bag.js, 64-housing.js) ─────────────────────────────

/**
 * The bag grows from INV_BASE to INV_MAX slots BAG_STEP at a time (action bag_expand, anywhere).
 * Twelve steps, each dearer than the last. The curve is set against what a character has earned
 * by then (README bot: Lv.7 in ~15 min, Lv.40 in ~11 h; mob gold ≈ 5 G a kill at Lv.1–7, ≈ 20 G at
 * Lv.20, ≈ 30 G at Lv.40 after goldK, a few hundred kills an hour): the first +5 (500 G) is an
 * hour's pocket money at Lv.5–8, the middle steps sit next to a tier-3/4 weapon (2,200–7,000 G) and
 * the 꼬마 박쥐 pet (9,000 G), the last ones beside the 도깨비불 pet (24,000 G) and a maxed late skill
 * (≈ 150k G). All twelve: 202,500 G — a long-term sink that keeps paying off, never a wall.
 */
const BAG_STEP = 5;
const BAG_COST = [500, 1000, 2000, 3500, 5500, 8000, 12000, 17000, 24000, 32000, 42000, 55000];
/** The price of the next +5 slots for a bag of `cap` slots (0 at the top). */
const bagCost = (cap) => (cap >= INV_MAX ? 0 : BAG_COST[Math.max(0, Math.floor((cap - INV_BASE) / BAG_STEP))] || 0);

/**
 * A house of one's own (64-housing.js): tier 1 is bought at the 하우징 안내인 in town, 2 and 3 are
 * upgrades (price = that step). w × h is the room with its walls (the back walls on row 0 and
 * column 0, the cut-down front on the last row and column), `furn` how many pieces it holds
 * (not rugs: `rugs` rug tiles more), `store` how many of them may be storage furniture. 10,000 G is a few hours of
 * Lv.15–20 hunting (beside the 꼬마 박쥐 pet); 40,000 and 120,000 G are the big sinks of the
 * middle and late game (the job change is 1,000 / 5,000 G).
 */
const HOUSE_TIER = [
  null,
  { name: "아늑한 오두막", w: 10, h: 8, price: 10000, furn: 12, rugs: 12, store: 2 },
  { name: "넓은 목조주택", w: 14, h: 10, price: 40000, furn: 22, rugs: 24, store: 3 },
  { name: "고급 저택", w: 18, h: 13, price: 120000, furn: 34, rugs: 40, store: 5 },
];
/** Floors (a ground char of the interior theme, public/iso_interior.js) and wallpapers (its STYLE). */
const HOUSE_FLOOR = [["f", "꿀빛 원목 마루"], ["l", "호두나무 마루"], ["x", "돌 타일"], ["h", "헤링본 마루"]];
const HOUSE_WALL = [["cottage", "크림 줄무늬 벽지"], ["inn", "들꽃 벽지"], ["mint", "민트 줄무늬 벽지"], ["hall", "초록 문양 벽지"], ["library", "보랏빛 서재 벽지"]];
/**
 * Furniture, by item id: `ch` the object char the room is drawn with (public/iso_interior.js;
 * a rug is a floor char under the walkway, `floor: 1`), `kind` decor · store (adds `cap` slots to
 * the house storage) · rest (a bed or a hearth: 안락한 휴식), `wall: 1` pieces must back onto a
 * back wall. Prices: small things like a potion stack, the comforts like a tier-2 weapon, the big
 * storage like a pet. Bought from the 하우징 안내인 (furn_buy).
 */
const FURN = {
  fn_chair: { name: "나무 의자", ch: "k", kind: "decor", price: 300, desc: "등받이에 홈이 파인 원목 의자." },
  fn_table: { name: "동그란 탁자", ch: "o", kind: "decor", price: 600, desc: "작은 등과 찻잔이 놓인 동그란 탁자." },
  fn_plant: { name: "화분", ch: "g", kind: "decor", price: 400, desc: "잎이 무성한 초록 화분." },
  fn_lamp: { name: "세움 등불", ch: "*", kind: "decor", price: 700, desc: "밤에도 방을 따뜻하게 밝히는 등불." },
  fn_barrel: { name: "나무통", ch: "w", kind: "decor", price: 300, desc: "쇠테를 두른 튼튼한 나무통." },
  fn_rug_round: { name: "둥근 카펫", ch: "u", kind: "decor", floor: 1, price: 500, desc: "바닥에 까는 둥근 카펫. 위를 걸을 수 있고, 나란히 깔면 커다란 한 장이 된다." },
  fn_rug_check: { name: "체크 카펫", ch: "q", kind: "decor", floor: 1, price: 500, desc: "바닥에 까는 체크무늬 카펫. 위를 걸을 수 있고, 나란히 깔면 커다란 한 장이 된다." },
  fn_shelf: { name: "책장", ch: "b", kind: "decor", wall: 1, price: 1200, desc: "책이 빼곡한 키 큰 책장. 벽에 붙여 둔다." },
  fn_teddy: { name: "곰인형", ch: "(", kind: "decor", price: 1200, desc: "단추 눈의 커다란 곰인형. 리본이 달렸다." },
  fn_armchair: { name: "안락의자", ch: "s", kind: "decor", price: 1500, desc: "푹신한 팔걸이 의자." },
  fn_fishbowl: { name: "금붕어 어항", ch: ")", kind: "decor", price: 1800, desc: "받침대 위의 둥근 어항. 금붕어 두 마리가 산다." },
  fn_cat: { name: "낮잠 고양이 방석", ch: "%", kind: "decor", price: 2500, desc: "방석 위에서 고양이가 둥글게 말려 잔다. 어디서 왔는지는 아무도 모른다." },
  fn_trophy: { name: "트로피 장식장", ch: "t", kind: "decor", wall: 1, price: 3000, desc: "모험의 기념품을 늘어놓는 유리 장식장. 벽에 붙여 둔다." },
  fn_music: { name: "축음기", ch: "?", kind: "decor", price: 3500, desc: "나팔이 달린 축음기. 집에 온기를 더한다." },
  fn_bed: { name: "포근한 침대", ch: "p", kind: "rest", price: 2500, desc: "누우면 [안락한 휴식]: HP·MP 회복, 잠시 경험치 증가 (30분에 한 번)." },
  fn_hearth: { name: "벽난로", ch: "#", kind: "rest", wall: 1, price: 5000, desc: "불을 쬐면 [안락한 휴식]: HP·MP 회복, 잠시 경험치 증가 (30분에 한 번). 벽에 붙여 둔다." },
  fn_chest_wood: { name: "나무 보관함", ch: "[", kind: "store", cap: 20, price: 3000, desc: "집 보관함 +20칸. 집 안의 보관함들은 하나의 창고로 이어진다." },
  fn_chest_iron: { name: "철제 대형 금고", ch: "{", kind: "store", cap: 40, price: 12000, desc: "집 보관함 +40칸. 집 안의 보관함들은 하나의 창고로 이어진다." },
  fn_chest_magic: { name: "마법 대형 창고함", ch: "}", kind: "store", cap: 60, price: 40000, desc: "집 보관함 +60칸. 집 안의 보관함들은 하나의 창고로 이어진다." },
};
for (const id of Object.keys(FURN)) { const f = FURN[id]; ITEMS[id] = { name: f.name, type: "furn", furn: f.kind, price: f.price, desc: f.desc }; }
/** What the 하우징 안내인 sells, in the window's order. */
const FURN_SHOP = Object.keys(FURN);
/** 안락한 휴식: what a bed or a hearth gives (heal shares, the buff's XP % and time, the wait between two). */
const HOUSE_REST = { hp: 0.5, mp: 0.5, xp: 8, ms: 15 * 60000, cd: 30 * 60000 };
/**
 * The town's residential corner (the quiet north-west lane beside 모닥별 여관): the house with the "내 집"
 * door (4 × 3 at `house`, its door the two tiles under its middle), the agent beside it, and
 * where a player stands when they come out.
 */
const HOUSE_TOWN = { map: "town", house: [14, 43], door: [[15, 46], [16, 46]], out: [15, 47], agent: [18, 47] };

