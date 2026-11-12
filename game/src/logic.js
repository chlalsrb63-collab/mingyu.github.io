/**
 * 루멘테일 온라인 — the whole game world, as plain rules.
 *
 * A party-hunting RPG set where worlds overlap: a fantasy meadow, a neon city
 * and a crystal rift all hang off one hub. Three ideas drive the rules:
 *   - loot is rolled, not listed: eight slots of gear, each piece with a rarity,
 *     random affixes and sockets; legendaries carry a unique power, set pieces
 *     grow stronger together, and runes in the right order form runewords;
 *   - a hunting ground is worth another lap: kill streaks, per-monster mastery,
 *     bounties that renew themselves, and a field boss the kills call out;
 *   - experience never stops mattering: it levels you up, and it can also be
 *     spent, without limit, on permanent training of your base stats;
 *   - hunting together pays: a party shares kills, quest credit and a bonus;
 *   - and there is a quiet side: campfires to sit by, fish to catch and cook,
 *     guilds, and a handful of emotes.
 *
 * This file is the single source of truth. The room (`room.ts`) only moves
 * bytes — it feeds actions and the clock in and fans per-player views out — and
 * the browser gets every table from `defs()` and every map from the server.
 *
 * Real-time notes: time is never read here (the room passes `now` in),
 * randomness comes from a seed in the state, and the world is advanced in
 * place; only characters are persisted (`exportChar`).
 */

export const meta = { game: "루멘테일 온라인", minPlayers: 1, maxPlayers: 40 };

const T = 16;
const INV = 30;
const MAXLV = 50;
const STACK = 99;
const VIEW_X = 280;
const VIEW_Y = 280;
const BASE_SPD = 58;
const PARTY_MAX = 4;
const PARTY_RANGE = 340;
/** Share of a kill's experience each member gets, by how many are in range. */
const PARTY_SHARE = [1, 0.8, 0.7, 0.65];

// ───────────────────────────── tables ─────────────────────────────

/** A weapon kind decides how a basic attack lands. */
const WKIND = {
  // unhurried, weighty blows: each lands harder than a quick one would
  sword: { name: "양손검", cd: 920, range: 34, fx: 0, cleave: 3, kb: 9, mult: 1.3 },
  dagger: { name: "단검", cd: 520, range: 26, fx: 3, kb: 4, mult: 1.35 },
  spear: { name: "창", cd: 780, range: 54, fx: 4, line: 3, kb: 7, mult: 1.4 },
  staff: { name: "마법지팡이", cd: 980, range: 100, fx: 2, kb: 6, mult: 1.2 },
  book: { name: "마법책", cd: 800, range: 84, fx: 5, splash: 26, mult: 1, kb: 4 },
};
/**
 * Basic attacks come in threes: two strokes and a finisher. Strike again within
 * COMBO_MS of the last blow and the count goes on; wait longer and it starts over.
 */
const COMBO_MS = 700, FINISH = { mult: 1.4, kb: 1.8, stun: 280 };
const CLASSES = {
  warrior: { name: "전사", arm: "양손검", wk: ["sword"], hp: [130, 24], mp: [30, 4], atk: [10, 2.6], def: [3, 0.9], crit: 8 },
  rogue: { name: "도적", arm: "단검", wk: ["dagger"], hp: [92, 16], mp: [40, 6], atk: [7, 1.9], def: [1, 0.5], crit: 22 },
  lancer: { name: "창술사", arm: "창", wk: ["spear"], hp: [112, 20], mp: [36, 5], atk: [9, 2.3], def: [2, 0.7], crit: 12 },
  mage: { name: "마도사", arm: "마법지팡이 · 마법책", wk: ["staff", "book"], hp: [76, 13], mp: [60, 10], atk: [9, 2.4], def: [1, 0.4], crit: 10 },
};

const SKILLS = {
  warrior: [
    { id: "strike", name: "강타", lv: 3, mp: 6, cd: 4000, mult: 2.2, stun: 1200, desc: "강력한 일격 (220%) — 맞은 적은 잠시 기절한다" },
    { id: "spin", name: "회전베기", lv: 7, mp: 12, cd: 8000, mult: 1.6, r: 48, desc: "주변의 모든 적을 벤다 (160%)" },
    { id: "shout", name: "전투함성", lv: 12, mp: 15, cd: 30000, dur: 12000, r: 110, desc: "12초간 자신과 주변 파티원의 공격력 25% 증가" },
    { id: "quake", name: "대지 가르기", lv: 18, mp: 22, cd: 14000, mult: 2.4, len: 120, knock: 22, desc: "땅을 갈라 일직선의 적을 날려 버린다 (240%)" },
  ],
  rogue: [
    { id: "vital", name: "급소 찌르기", lv: 3, mp: 6, cd: 3500, mult: 2.0, desc: "반드시 치명타로 들어가는 일격 (200%)" },
    { id: "dash", name: "그림자 도약", lv: 7, mp: 10, cd: 7000, mult: 1.9, len: 120, desc: "적의 등 뒤로 순간이동해 벤다 (190%)" },
    { id: "smoke", name: "연막", lv: 12, mp: 14, cd: 22000, dur: 6000, desc: "적의 시선을 끊고 6초간 이동속도 40% 증가" },
    { id: "fan", name: "맹독 표창", lv: 18, mp: 18, cd: 11000, mult: 1.2, r: 76, n: 5, dot: 0.5, desc: "가까운 적 5명에게 표창을 던져 중독시킨다 (120% + 4초간 독)" },
  ],
  lancer: [
    { id: "pierce", name: "관통 찌르기", lv: 3, mp: 7, cd: 4500, mult: 1.9, len: 96, desc: "일직선의 적을 모두 꿰뚫는다 (190%)" },
    { id: "sweep", name: "초승달 베기", lv: 7, mp: 12, cd: 8000, mult: 1.5, r: 58, knock: 20, desc: "창을 크게 휘둘러 주변의 적을 밀쳐 낸다 (150%)" },
    { id: "vault", name: "도약 강습", lv: 12, mp: 16, cd: 10000, mult: 2.2, len: 130, r: 44, desc: "적에게 뛰어올라 내리꽂는다 (범위 220%, 둔화)" },
    { id: "rain", name: "창 소나기", lv: 18, mp: 24, cd: 16000, mult: 0.9, r: 50, n: 5, every: 500, desc: "하늘에서 창이 다섯 번 쏟아진다 (5회 × 90%)" },
  ],
  mage: [
    { id: "fireball", name: "화염구", lv: 3, mp: 10, cd: 4500, mult: 1.9, r: 34, desc: "폭발하는 불덩이 (범위 190%)" },
    { id: "nova", name: "빙결 파동", lv: 7, mp: 16, cd: 9000, mult: 1.4, r: 58, desc: "주변 적에게 피해를 주고 느리게 한다" },
    { id: "heal", name: "치유의 빛", lv: 12, mp: 22, cd: 12000, r: 90, desc: "자신과 주변 아군의 HP 35% 회복" },
    { id: "meteor", name: "유성우", lv: 18, mp: 30, cd: 18000, mult: 1.3, r: 52, n: 4, every: 700, desc: "지정한 곳에 유성이 네 번 떨어진다 (4회 × 130%)" },
  ],
};

// ── gear: seven kinds of piece, five tiers each
const WEAPON_NAMES = {
  sword: ["녹슨 대검", "강철 양손검", "기사단 클레이모어", "고주파 대검", "차원 절단기"],
  dagger: ["낡은 단검", "암살자의 비수", "쌍독니", "카본 나이프", "균열의 송곳니"],
  spear: ["대나무 창", "강철 장창", "기사단 할버드", "플라즈마 랜스", "차원 관통창"],
  staff: ["견습 지팡이", "룬 지팡이", "현자의 지팡이", "플라즈마 로드", "공허의 홀"],
  book: ["낡은 주문서", "룬 마도서", "현자의 법전", "홀로그램 코덱스", "공허의 서"],
};
/** Which class wields each weapon kind, and the word used in its item ids. */
const WK_CLASS = { sword: "warrior", dagger: "rogue", spear: "lancer", staff: "mage", book: "mage" };
const WK_ID = { sword: "warrior", dagger: "rogue", spear: "lancer", staff: "mage", book: "book" };
const W_ATK = [6, 14, 26, 42, 64];
const G_REQ = [1, 8, 16, 26, 38];
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
  hp_s: { name: "빨간 물약", type: "pot", heal: 60, price: 20, desc: "HP를 60 회복한다." },
  hp_m: { name: "큰 빨간 물약", type: "pot", heal: 220, price: 70, desc: "HP를 220 회복한다." },
  mp_s: { name: "파란 물약", type: "pot", mana: 40, price: 25, desc: "MP를 40 회복한다." },
  mp_m: { name: "큰 파란 물약", type: "pot", mana: 140, price: 80, desc: "MP를 140 회복한다." },
  stone: { name: "강화석", type: "mat", price: 150, desc: "대장장이에게 가져가면 장비를 강화할 수 있다." },
  camp: { name: "모닥불 꾸러미", type: "camp", price: 120, desc: "사용하면 그 자리에 3분 동안 모닥불을 피운다. 곁에 앉아 쉬면 빠르게 회복하고 온기를 얻는다." },
  fish_s: { name: "송사리", type: "fish", cook: "food_s", price: 30, desc: "흔한 물고기. 모닥불에서 구울 수 있다." },
  fish_m: { name: "무지개 송어", type: "fish", cook: "food_m", price: 110, desc: "살이 오른 송어. 모닥불에서 구울 수 있다." },
  fish_l: { name: "황금 잉어", type: "fish", cook: "food_l", price: 800, desc: "좀처럼 낚이지 않는 귀한 물고기. 모닥불에서 요리할 수 있다." },
  burnt: { name: "숯덩이가 된 생선", type: "food", heal: 15, buff: { xp: 0, atk: 0, min: 0 }, price: 1, desc: "너무 오래 구웠다. HP 15 회복." },
  food_s: { name: "구운 송사리", type: "food", heal: 80, buff: { xp: 5, atk: 0, min: 10 }, price: 40, desc: "HP 80 회복. 10분간 경험치 +5%." },
  food_m: { name: "송어 소금구이", type: "food", heal: 220, buff: { xp: 10, atk: 0, min: 10 }, price: 150, desc: "HP 220 회복. 10분간 경험치 +10%." },
  food_l: { name: "황금 잉어찜", type: "food", heal: 9999, buff: { xp: 15, atk: 8, min: 15 }, price: 1000, desc: "HP 전부 회복. 15분간 경험치 +15%, 공격력 +8%." },
};
for (const wk of Object.keys(WEAPON_NAMES)) {
  for (let t = 1; t <= 5; t++) {
    const base = wk === "book" ? { atk: Math.round(W_ATK[t - 1] * 0.85), mp: [15, 35, 60, 100, 150][t - 1] } : { atk: W_ATK[t - 1] };
    ITEMS[`w_${WK_ID[wk]}_${t}`] = { name: WEAPON_NAMES[wk][t - 1], type: "weapon", wk, cls: WK_CLASS[wk], tier: t, base, req: G_REQ[t - 1], price: G_PRICE[t - 1] };
  }
}
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
};

/** Training: experience spent on a permanent stat point. Never capped. */
const TRAIN = {
  str: { name: "힘", gain: 1, stat: "atk", desc: "공격력 +1" },
  vit: { name: "체력", gain: 14, stat: "hp", desc: "최대 HP +14" },
  int: { name: "지력", gain: 9, stat: "mp", desc: "최대 MP +9" },
  grd: { name: "수호", gain: 1, stat: "def", desc: "방어력 +1" },
};
const trainCost = (n) => 120 + 40 * n;

const SHOP = ["hp_s", "hp_m", "mp_s", "mp_m", "camp", "stone", "W1", "w_book_1", "h_1", "a_1", "g_1", "b_1"];
const ENH_RATE = [100, 95, 90, 80, 70, 55, 45, 35, 25, 15];

// ── the cosy side: campfires, fishing, guilds
/** Campfires that always burn, by map, in tiles. */
const FIRES = {};          // filled in as each map is generated
const FIRE_R = 46, FIRE_MS = 180000, FIRE_MAX = 6;
/** Sitting this long by a fire warms you: +10% experience for ten minutes, +2% per friend sitting there too. */
const WARM_SEC = 6, WARM_MS = 600000;
const GUILD_COST = 1000;
/** Each guildmate hunting beside you adds this much experience, up to three. */
const GUILD_XP = 0.05;
const EMOTES = 8;

// ── the hunt: what keeps a hunting ground worth another lap
/** Kills in quick succession build a streak; each step adds 2% experience, up to +50%. */
const STREAK_MS = 8000, STREAK_MAX = 25;
/** Kills of one kind of monster that earn each mastery rank (+3% damage, +2% experience against it). */
const MASTERY = [30, 100, 300, 1000, 3000];
/** A repeatable bounty asks for this many of one monster, and renews itself when paid out. */
const BOUNTY_N = 25;
/** After this many kills in a hunting ground, its field boss appears. */
const FB_KILLS = 60;
const FIELD_BOSS = { meadow: "potcrab", forest: "stump", city: "vend", cave: "geode" };

/**
 * Monsters. Beyond the numbers: `fly` crosses anything, `shot` attacks from range,
 * `leap` pounces from that far, `slam` pounds the ground around itself, and
 * `burst` goes off where it died.
 */
const MOBS = {
  acorn: { name: "도토리 병정", lv: 1, hp: 28, atk: 5, def: 0, spd: 24, xp: 9, gold: [2, 6], aggro: 0, range: 16, cd: 1300 },
  potcrab: { name: "화분 소라게", lv: 3, hp: 60, atk: 9, def: 1, spd: 22, xp: 18, gold: [4, 10], aggro: 0, range: 16, cd: 1300 },
  puff: { name: "민들레 홀씨", lv: 5, hp: 82, atk: 13, def: 0, spd: 34, xp: 30, gold: [6, 14], aggro: 0, range: 17, cd: 1200, fly: true },      // drifts by the pond and minds its own business, so the shore stays a fishing spot
  capfrog: { name: "버섯 개구리", lv: 8, hp: 170, atk: 23, def: 2, spd: 44, xp: 60, gold: [10, 22], aggro: 80, range: 18, cd: 1100, leap: 96 },
  stump: { name: "그루터기 거북", lv: 10, hp: 330, atk: 26, def: 8, spd: 22, xp: 92, gold: [12, 26], aggro: 60, range: 18, cd: 1400 },
  yarn: { name: "털실 거미", lv: 11, hp: 190, atk: 30, def: 2, spd: 58, xp: 92, gold: [12, 26], aggro: 88, range: 16, cd: 1000, leap: 80 },
  lantern: { name: "초롱 반딧불", lv: 13, hp: 210, atk: 34, def: 2, spd: 44, xp: 118, gold: [14, 30], aggro: 96, range: 72, cd: 1400, fly: true, shot: true },
  eyecam: { name: "감시 눈알", lv: 14, hp: 290, atk: 40, def: 5, spd: 56, xp: 140, gold: [18, 36], aggro: 100, range: 70, cd: 1300, fly: true, shot: true },
  signbot: { name: "신호등 보행기", lv: 17, hp: 460, atk: 52, def: 8, spd: 46, xp: 200, gold: [26, 50], aggro: 84, range: 19, cd: 1000 },
  tvhead: { name: "브라운관 유령", lv: 19, hp: 520, atk: 60, def: 6, spd: 40, xp: 250, gold: [28, 54], aggro: 92, range: 66, cd: 1400, fly: true, shot: true },
  vend: { name: "자판기 미믹", lv: 21, hp: 820, atk: 68, def: 18, spd: 30, xp: 330, gold: [60, 120], aggro: 72, range: 22, cd: 1500 },
  candle: { name: "촛농 유령", lv: 23, hp: 880, atk: 78, def: 12, spd: 42, xp: 400, gold: [40, 76], aggro: 88, range: 19, cd: 1100, fly: true, burst: 34 },
  prism: { name: "프리즘 해파리", lv: 25, hp: 900, atk: 86, def: 10, spd: 38, xp: 480, gold: [46, 86], aggro: 96, range: 76, cd: 1500, fly: true, shot: true },
  geode: { name: "정동 골렘", lv: 27, hp: 1600, atk: 98, def: 26, spd: 27, xp: 640, gold: [56, 100], aggro: 76, range: 21, cd: 1500, slam: 40 },
  boss: { name: "균열의 군주 크리온", lv: 30, hp: 22000, atk: 140, def: 30, spd: 34, xp: 9000, gold: [1500, 2500], aggro: 130, range: 30, cd: 1400, resp: 180000, boss: true, gear: 1 },
};
// Treasure chests are "monsters" that never move or fight: break one open for a sure piece of gear.
for (const [id, lv, hp, gold] of [["meadow", 4, 40, [30, 60]], ["forest", 11, 160, [80, 150]], ["city", 18, 420, [180, 320]], ["cave", 26, 900, [320, 560]]]) {
  MOBS[`chest_${id}`] = { name: "보물 상자", sp: "chest", lv, hp, atk: 0, def: 0, spd: 0, xp: 0, gold, aggro: 0, range: 0, cd: 1e9, resp: 300000, chest: true, still: true, gear: 1 };
}
for (const k of Object.keys(MOBS)) {
  const d = MOBS[k];
  if (!d.sp) d.sp = k;
  d.spd = Math.round(d.spd * 0.82);              // the whole world moves at an easier pace
  if (!d.resp) d.resp = 4500 + d.lv * 150;       // hunting grounds refill quickly
  if (!d.gear) d.gear = 0.06 + d.lv * 0.002;
}

const QUESTS = [
  { mob: "acorn", n: 5, title: "첫 발걸음", text: "차원이 겹친 뒤로 초원의 도토리들이 창을 들고 일어섰다네. 도토리 병정 5마리만 정리해 주겠나?", xp: 90, gold: 60, items: [["hp_s", 5]] },
  { mob: "potcrab", n: 6, title: "걸어 다니는 화분", text: "남쪽 꽃밭의 화분이 죄다 걸어 나갔어. 화분 소라게 6마리를 잡아 주게.", xp: 220, gold: 120, items: [["mp_s", 5]] },
  { mob: "puff", n: 8, title: "홀씨 주의보", text: "연못가에 민들레 홀씨가 떠다니며 사람을 쫓는다네. 8마리를 흩어 주면 강화석을 주지.", xp: 520, gold: 200, items: [["stone", 2]] },
  { mob: "capfrog", n: 10, title: "숲의 도약자", text: "속삭임 숲의 버섯 개구리 10마리를 사냥해 주게. 멀리서도 뛰어드니 동료를 구해 보게.", xp: 1300, gold: 450, items: [["hp_m", 5], ["ru_vit", 1]] },
  { mob: "lantern", n: 10, title: "밤길의 초롱", text: "숲 동쪽의 초롱 반딧불 10마리를 꺼뜨려 주게. 불씨를 쏘아 대니 조심하게.", xp: 2200, gold: 600, items: [["stone", 3]] },
  { mob: "eyecam", n: 10, title: "다른 세계의 눈", text: "서쪽 문 너머는 '네온 시티'라는 다른 세계일세. 우리를 지켜보는 감시 눈알 10기를 떨어뜨려 주게.", xp: 4200, gold: 900, items: [["ru_ign", 1]] },
  { mob: "signbot", n: 12, title: "빨간불", text: "네온 시티의 신호등 보행기들이 차원문 앞을 막아섰어. 12기를 멈춰 주게.", xp: 6500, gold: 1300, items: [["mp_m", 5]] },
  { mob: "vend", n: 10, title: "동전 먹는 기계", text: "자판기 미믹 10대를 부숴 주게. 단단하지만 삼킨 동전을 잔뜩 뱉는다네.", xp: 9500, gold: 1800, items: [["stone", 5]] },
  { mob: "geode", n: 8, title: "움직이는 수정", text: "숲 끝의 수정 동굴은 균열의 중심일세. 정동 골렘 8마리를 부숴 주게. 땅을 내리칠 땐 물러서게.", xp: 15000, gold: 2600, items: [["ru_acu", 1], ["ru_san", 1]] },
  { mob: "boss", n: 1, title: "균열의 군주", text: "모든 세계를 뒤섞은 장본인, 균열의 군주 크리온을 쓰러뜨려 주게. 반드시 파티를 꾸려서 가게.", xp: 40000, gold: 8000, items: [["stone", 10], ["ru_lum", 1]] },
];

// ───────────────────────────── helpers ─────────────────────────────

/** Small seeded generator; `box.seed` is advanced in place. */
function rnd(box) {
  box.seed = (box.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(box.seed ^ (box.seed >>> 15), 1 | box.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (box, a, b) => a + Math.floor(rnd(box) * (b - a + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
const xpNeed = (lv) => Math.round(34 * Math.pow(lv, 1.85) + 20);

function dirOf(dx, dy) {
  // 0 down · 1 left · 2 right · 3 up
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
  return dy < 0 ? 3 : 0;
}

// ───────────────────────────── maps ─────────────────────────────

const SOLID_G = "wW";

function blank(id, name, w, h, fill) {
  const g = [];
  const o = [];
  for (let y = 0; y < h; y++) {
    g.push(new Array(w).fill(fill));
    o.push(new Array(w).fill(" "));
  }
  return { id, name, w, h, g, o, big: [], portals: [], npcs: [], spawns: [], safe: false, entry: [2, 2], bgm: "field" };
}
function rect(layer, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (layer[y] && x >= 0 && x < layer[y].length) layer[y][x] = ch;
}
function border(m, ch, n) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (x < n || y < n || x >= m.w - n || y >= m.h - n) m.o[y][x] = ch;
  }
}
/** Sprinkle ground variants / objects; `keep` cells (paths, plazas) are left alone. */
function scatter(m, box, layer, ch, chance, onlyOn) {
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (m.o[y][x] !== " ") continue;
    if (!onlyOn.includes(m.g[y][x])) continue;
    if (rnd(box) < chance) layer[y][x] = ch;
  }
}
/** A walkable strip from (x0,y0) to (x1,y1), two tiles wide, cleared of objects. */
function road(m, x0, y0, x1, y1, ch) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
      m.o[yy][xx] = " ";
      if (dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1 && m.g[yy][xx] !== "b") m.g[yy][xx] = ch;
    }
  }
}
function house(m, x, y, v) {
  rect(m.o, x, y, x + 3, y + 2, "h");
  m.big.push({ t: "house", x, y, v });
}
function portal(m, x, y, to, tx, ty) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) m.o[yy][xx] = " ";
  }
  m.portals.push({ x, y, to, tx, ty });
}
function finalize(m) {
  m.solid = new Array(m.w * m.h).fill(0);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.o[y][x] !== " " || SOLID_G.includes(m.g[y][x])) m.solid[y * m.w + x] = 1;
  }
  // Tiles a player can actually walk to — monsters only spawn there.
  m.reach = new Array(m.w * m.h).fill(0);
  const stack = [m.entry];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
    const i = y * m.w + x;
    if (m.solid[i] || m.reach[i]) continue;
    m.reach[i] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  m.g = m.g.map((r) => r.join(""));
  m.o = m.o.map((r) => r.join(""));
  return m;
}

// ───────────────────────────── maps: procedural terrain ─────────────────────────────
// Every hunting ground is generated, from a fixed seed, by the same idea: lay a
// coarse grid of cells over the map, grow a random spanning tree across it (plus a
// few extra links so there are loops), and turn every edge the tree did NOT take
// into a barrier — a cliff, a hedge, a belt of trees, a river, a row of buildings.
// The links become gaps, bridges and streets. Dead ends become places worth the
// walk: a ruin with a chest, a camp with a fire, a pond to fish in. A last pass
// floods the map from its entry and cuts through anything that still seals a
// place off, so nothing generated can ever be unreachable.

/** Is this tile blocked — by the same rule the browser uses. */
const blockedAt = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.o[y][x] !== " " || SOLID_G.includes(m.g[y][x]);
const inMap = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
/** The free tile nearest to (x, y). */
function spot(m, x, y) {
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && x + dx > 1 && y + dy > 1 && x + dx < m.w - 2 && y + dy < m.h - 2 && !blockedAt(m, x + dx, y + dy)) return [x + dx, y + dy];
  }
  return [x, y];
}
/** Clear a rectangle of objects (never the map's rim). */
function clear(m, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x > 1 && y > 1 && x < m.w - 2 && y < m.h - 2 && !"ha".includes(m.o[y][x])) m.o[y][x] = " ";
}
/** An irregular blob of ground `ch` around (cx, cy); returns nothing, skips water and bridges. */
function blob(m, box, cx, cy, rx, ry, ch, only) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d > 1 + (rnd(box) - 0.5) * 0.5) continue;
    if (only ? only.includes(m.g[y][x]) : !"wb".includes(m.g[y][x])) m.g[y][x] = ch;
  }
}

/**
 * Which cells of a cw × ch grid link to which. `dist` is each cell's distance from
 * the entry along the links, `par` the way back toward it, `deg` its number of links.
 */
function plan(box, cw, ch, entry, loops) {
  const n = cw * ch;
  const key = (a, b) => (a < b ? a * n + b : b * n + a);
  const nbrs = (c) => { const i = c % cw, out = []; if (i > 0) out.push(c - 1); if (i < cw - 1) out.push(c + 1); if (c >= cw) out.push(c - cw); if (c < n - cw) out.push(c + cw); return out; };
  const open = new Set(), seen = new Array(n).fill(false), stack = [entry];
  seen[entry] = true;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const next = nbrs(c).filter((o) => !seen[o]);
    if (!next.length) { stack.pop(); continue; }
    const o = next[ri(box, 0, next.length - 1)];
    seen[o] = true; open.add(key(c, o)); stack.push(o);
  }
  for (let c = 0; c < n; c++) for (const o of nbrs(c)) if (o > c && !open.has(key(c, o)) && rnd(box) < loops) open.add(key(c, o));
  const dist = new Array(n).fill(-1), par = new Array(n).fill(-1), q = [entry];
  dist[entry] = 0;
  for (let h = 0; h < q.length; h++) for (const o of nbrs(q[h])) if (dist[o] < 0 && open.has(key(q[h], o))) { dist[o] = dist[q[h]] + 1; par[o] = q[h]; q.push(o); }
  const deg = new Array(n).fill(0);
  for (let c = 0; c < n; c++) for (const o of nbrs(c)) if (open.has(key(c, o))) deg[c]++;
  return { n, dist, par, deg, linked: (a, b) => open.has(key(a, b)) };
}

/**
 * Make sure every point can be walked to from the map's entry, cutting the
 * cheapest way through whatever is in between (water gets a bridge, rock a floor).
 */
function connectAll(m, pts, floor) {
  const W = m.w, H = m.h;
  const flood = () => {
    const r = new Uint8Array(W * H), st = [m.entry];
    while (st.length) {
      const [x, y] = st.pop();
      if (blockedAt(m, x, y) || r[y * W + x]) continue;
      r[y * W + x] = 1;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return r;
  };
  let reach = flood();
  for (const [px, py] of pts) {
    if (reach[py * W + px]) continue;
    const cost = new Int32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), buckets = [[py * W + px]];
    cost[py * W + px] = 0;
    let goal = -1;
    for (let d = 0; d < buckets.length && goal < 0; d++) {
      const bk = buckets[d];
      for (let k = 0; bk && k < bk.length; k++) {
        const c = bk[k];
        if (cost[c] !== d) continue;
        if (reach[c]) { goal = c; break; }
        const x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 2 || ny < 2 || nx >= W - 2 || ny >= H - 2 || "ha".includes(m.o[ny][nx])) continue;   // never through a building
          const step = blockedAt(m, nx, ny) ? 8 : 1, n = ny * W + nx;
          if (d + step < cost[n]) { cost[n] = d + step; from[n] = c; (buckets[d + step] || (buckets[d + step] = [])).push(n); }
        }
      }
    }
    for (let c = goal; c >= 0; c = from[c]) {
      const x = c % W, y = (c - x) / W;
      m.o[y][x] = " ";
      if (m.g[y][x] === "w") m.g[y][x] = "b"; else if (m.g[y][x] === "W") m.g[y][x] = floor;
    }
    reach = flood();
  }
}

const CS = 10, CR = 9, MG = 3;
/** Shared geometry and bookkeeping for a map built on the cell grid. */
function grid(cfg) {
  const box = { seed: cfg.seed };
  const { cw, ch } = cfg;
  const m = blank(cfg.id, cfg.name, cw * CS + MG * 2, ch * CR + MG * 2, cfg.ground);
  if (cfg.bgm) m.bgm = cfg.bgm;
  const P = plan(box, cw, ch, cfg.entry, cfg.loops);
  const x0 = (c) => MG + (c % cw) * CS, y0 = (c) => MG + Math.floor(c / cw) * CR;
  const mid = (c) => [x0(c) + 4, y0(c) + 4];
  const doors = new Map();                      // "a|b" → [x, y, vertical boundary?, street?]
  const dkey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  // the way from the entry to the exit, cell by cell
  const main = [];
  for (let c = cfg.exit; c >= 0; c = P.par[c]) main.unshift(c);
  // which cells become places: dead ends first, then the deepest of the rest
  const onMain = new Set(main);
  const order = [];
  for (let c = 0; c < P.n; c++) if (c !== cfg.entry && c !== cfg.exit) order.push(c);
  order.sort((a, b) => (P.deg[a] === 1 ? 0 : 1) - (P.deg[b] === 1 ? 0 : 1) || (onMain.has(a) ? 1 : 0) - (onMain.has(b) ? 1 : 0) || P.dist[b] - P.dist[a]);
  const kind = new Array(P.n).fill("field");
  const dead = order.filter((c) => P.deg[c] === 1).length;
  cfg.places.slice(0, Math.max(cfg.min || 5, Math.min(dead, cfg.places.length))).forEach((k, i) => { if (order[i] !== undefined) kind[order[i]] = k; });
  let far = 1;
  for (const d of P.dist) far = Math.max(far, d);
  /** The monster for a cell: deeper cells hold stronger kinds, with a little bleed between bands. */
  const mobFor = (c) => {
    const K = cfg.mobs.length;
    let band = Math.min(K - 1, Math.floor((P.dist[c] / (far + 1)) * K));
    if (rnd(box) < 0.2) band = clamp(band + (rnd(box) < 0.5 ? -1 : 1), 0, K - 1);
    return cfg.mobs[P.dist[c] <= 1 ? 0 : band];
  };
  /** A walkable strip `wd` tiles wide, cleared of objects, that never paves over water or planks. */
  const lay = (ax, ay, bx, by, ch, wd = 2) => {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) || 1;
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(ax + ((bx - ax) * i) / steps), y = Math.round(ay + ((by - ay) * i) / steps);
      for (let dy = -1; dy <= wd; dy++) for (let dx = -1; dx <= wd; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= m.w || yy >= m.h) continue;
        if (xx > 1 && yy > 1 && xx < m.w - 2 && yy < m.h - 2 && !"ha".includes(m.o[yy][xx])) m.o[yy][xx] = " ";
        if (dx >= 0 && dx < wd && dy >= 0 && dy < wd && !"wb".includes(m.g[yy][xx])) m.g[yy][xx] = ch;
      }
    }
  };
  /** Pave from one cell to the next through their door, in right-angled legs. */
  const route = (a, b, ch, wd) => {
    const d = doors.get(dkey(a, b)), [ax, ay] = mid(a), [bx, by] = mid(b);
    if (!d) return;
    if (d[2]) { lay(ax, ay, ax, d[1], ch, wd); lay(ax, d[1], bx, d[1], ch, wd); lay(bx, d[1], bx, by, ch, wd); }
    else { lay(ax, ay, d[0], ay, ch, wd); lay(d[0], ay, d[0], by, ch, wd); lay(d[0], by, bx, by, ch, wd); }
  };
  /** A way in or out on the map's rim: two portal tiles and the two tiles travellers arrive on. */
  const gates = {};
  const gate = (name, side, c) => {
    const [mx, my] = mid(c);
    const g = side === "w" ? { t: [[1, my], [1, my + 1]], a: [[4, my], [4, my + 1]] }
      : side === "e" ? { t: [[m.w - 2, my], [m.w - 2, my + 1]], a: [[m.w - 5, my], [m.w - 5, my + 1]] }
      : { t: [[mx, 1], [mx + 1, 1]], a: [[mx, 4], [mx + 1, 4]] };
    gates[name] = g;
    lay(g.t[0][0], g.t[0][1], mx, my, cfg.road, cfg.roadW || 2);
    for (const [x, y] of g.t) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(m, x + dx, y + dy)) m.o[y + dy][x + dx] = " ";
    return g;
  };
  return { box, m, P, x0, y0, mid, doors, dkey, main, kind, mobFor, lay, route, gate, gates, cw, ch };
}

/** Open country: meadow and forest. Barriers are cliffs, hedges, belts of trees and one river. */
function wild(cfg) {
  const G = grid(cfg);
  const { box, m, P, x0, y0, mid, doors, dkey, kind, cw, ch } = G;
  scatter(m, box, m.g, cfg.tufts, 0.16, cfg.ground);
  scatter(m, box, m.g, '"', 0.04, cfg.ground);
  border(m, cfg.edge, 2);
  // a ragged inner rim, so the map's edge is not a ruled line
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) if ((x === 2 || y === 2 || x === m.w - 3 || y === m.h - 3) && rnd(box) < 0.55) m.o[y][x] = cfg.edge;

  const put = (x, y, t) => {
    if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) return;
    m.o[y][x] = t === "trees" ? cfg.edge : t === "cliff" ? "C" : t === "hedge" ? "H" : "U";
  };
  const pick = () => { let r = rnd(box); for (const [t, w] of cfg.walls) { if (r < w) return t; r -= w; } return cfg.walls[0][0]; };
  const riverAt = (i) => cfg.river === i;          // the river runs down the boundary before column i
  // barriers along every shared edge; a link leaves a gap, or (sometimes) no barrier at all
  for (let c = 0; c < P.n; c++) {
    const i = c % cw, j = Math.floor(c / cw);
    if (i < cw - 1) {
      const e = c + 1, bx = x0(e) - 1, link = P.linked(c, e), gy = y0(c) + 2 + ri(box, 0, CR - 5);
      if (link) doors.set(dkey(c, e), [bx, gy, true]);
      if (!riverAt(i + 1) && !(link && rnd(box) < cfg.merge)) {
        const t = pick();
        let off = 0;
        for (let y = y0(c) - 1; y <= y0(c) + CR - 1; y++) {
          const prev = off;
          if (rnd(box) < 0.35) off = clamp(off + ri(box, -1, 1), -1, 1);
          if (link && y >= gy - 1 && y <= gy + 2) { off = 0; continue; }
          put(bx + off, y, t);
          if (off !== prev) put(bx + prev, y, t);
          if (t === "trees" && rnd(box) < 0.6) put(bx + off + 1, y, t);
        }
      }
    }
    if (j < ch - 1) {
      const s = c + cw, by = y0(s) - 1, link = P.linked(c, s), gx = x0(c) + 2 + ri(box, 0, CS - 6);
      if (link) doors.set(dkey(c, s), [gx, by, false]);
      if (!(link && rnd(box) < cfg.merge)) {
        const t = pick();
        let off = 0;
        for (let x = x0(c) - 1; x <= x0(c) + CS - 1; x++) {
          const prev = off;
          if (rnd(box) < 0.35) off = clamp(off + ri(box, -1, 1), -1, 1);
          if (link && x >= gx - 1 && x <= gx + 2) { off = 0; continue; }
          put(x, by + off, t);
          if (off !== prev) put(x, by + prev, t);
          if (t === "trees" && rnd(box) < 0.6) put(x, by + off + 1, t);
        }
      }
    }
  }
  // the river: one winding line of water, crossed only where a link has a bridge
  if (cfg.river) {
    const bx = MG + cfg.river * CS - 2, bridge = new Set();
    for (let j = 0; j < ch; j++) { const a = j * cw + cfg.river - 1, d = doors.get(dkey(a, a + 1)); if (d) { bridge.add(d[1]); bridge.add(d[1] + 1); d[0] = bx + 1; } }
    let off = 0;
    for (let y = 0; y < m.h; y++) {
      const near = bridge.has(y) || bridge.has(y - 1) || bridge.has(y + 1);
      if (!near && rnd(box) < 0.4) off = clamp(off + ri(box, -1, 1), -2, 2);
      if (near) off = 0;
      const wide = near ? 3 : 2 + (rnd(box) < 0.4 ? 1 : 0);
      for (let k = -1; k <= wide; k++) {
        const x = bx + off + k;
        if (k >= 0 && k < wide) { m.g[y][x] = bridge.has(y) ? "b" : "w"; m.o[y][x] = " "; }
        else if (cfg.shore && y > 1 && y < m.h - 2 && !"wb".includes(m.g[y][x])) m.g[y][x] = cfg.shore;
      }
      // reeds stand in the shallows here and there
      if (!near && y > 2 && y < m.h - 3 && rnd(box) < 0.22) m.o[y][bx + off + (rnd(box) < 0.5 ? 0 : wide - 1)] = "e";
    }
  }
  // what each cell is
  const special = [];
  for (let c = 0; c < P.n; c++) {
    const X = x0(c), Y = y0(c), [cx, cy] = mid(c), k = c === cfg.entry || c === cfg.exit ? "gate" : kind[c];
    const inner = [X + 1, Y + 1, X + CS - 3, Y + CR - 3];
    // loose scenery everywhere first; places clear what they need afterwards
    for (let y = Y; y < Y + CR - 1; y++) for (let x = X; x < X + CS - 1; x++) {
      if (m.o[y][x] !== " " || "wbs".includes(m.g[y][x])) continue;
      const r = rnd(box) / (k === "grove" ? 3.2 : 1);
      m.o[y][x] = r < cfg.tree ? cfg.treeCh : r < cfg.tree + 0.016 ? "B" : r < cfg.tree + 0.026 ? "R" : r < cfg.tree + 0.032 ? "u" : r < cfg.tree + 0.037 ? "l" : " ";
    }
    if (rnd(box) < 0.6) blob(m, box, X + 2 + ri(box, 0, 5), Y + 2 + ri(box, 0, 4), 1.6 + rnd(box) * 1.6, 1.2 + rnd(box), rnd(box) < 0.6 ? "t" : '"', cfg.ground + cfg.tufts + '"');
    if (k === "vault") {
      // a ruin: broken walls around old flagstones, a chest in the middle
      clear(m, cx - 3, cy - 3, cx + 3, cy + 2);
      rect(m.g, cx - 2, cy - 2, cx + 2, cy + 1, "r");
      const gap = cx - 1 + ri(box, 0, 2);
      for (let x = cx - 3; x <= cx + 3; x++) { if (rnd(box) < 0.85) m.o[cy - 3][x] = "U"; if (x !== gap && x !== gap + 1 && rnd(box) < 0.8) m.o[cy + 2][x] = "U"; }
      for (let y = cy - 2; y <= cy + 1; y++) { if (rnd(box) < 0.8) m.o[y][cx - 3] = "U"; if (rnd(box) < 0.8) m.o[y][cx + 3] = "U"; }
      m.o[cy - 2][cx - 2] = "q"; m.o[cy - 2][cx + 2] = "q";
      m.spawns.push({ k: cfg.chest, n: 1, r: [cx, cy - 1, cx, cy - 1] });
      m.spawns.push({ k: G.mobFor(c), n: 2, r: inner });
      special.push([cx, cy - 1], [gap, cy + 3]);
    } else if (k === "camp") {
      clear(m, cx - 3, cy - 2, cx + 3, cy + 3);
      blob(m, box, cx, cy + 0.5, 2.6, 2, cfg.road);
      m.o[cy - 2][cx - 2] = "E"; m.o[cy + 1][cx + 2] = "l"; m.o[cy + 2][cx - 2] = "u";
      FIRES[cfg.id].push([cx, cy]);
      special.push([cx, cy + 1]);
    } else if (k === "pond") {
      clear(m, cx - 4, cy - 3, cx + 4, cy + 3);
      blob(m, box, cx, cy, 3.6, 2.6, cfg.shore || cfg.ground);
      for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 3; x <= cx + 2; x++) if (((x - cx + 0.5) / 3) ** 2 + ((y - cy + 0.5) / 2) ** 2 <= 1) m.g[y][x] = "w";
      for (const [x, y] of [[cx - 2, cy - 1], [cx + 1, cy], [cx - 1, cy + 1]]) if (m.g[y][x] === "w" && rnd(box) < 0.7) m.o[y][x] = "e";
      if (cfg.pondMob) m.spawns.push({ k: cfg.pondMob, n: 3, r: inner });
      special.push([cx - 4, cy]);
    } else if (k === "ruin") {
      // a scatter of fallen stone, and more monsters than anywhere else
      for (let n = 0; n < 5; n++) { const x = X + 1 + ri(box, 0, 6), y = Y + 1 + ri(box, 0, 5); if (m.o[y][x] === " " && !"wb".includes(m.g[y][x])) { m.o[y][x] = n % 2 ? "U" : "q"; m.g[y][x] = "r"; } }
      m.spawns.push({ k: G.mobFor(c), n: cfg.n + 2, r: inner });
    } else if (k === "gate") {
      m.spawns.push({ k: cfg.mobs[c === cfg.entry ? 0 : cfg.mobs.length - 1], n: 2, r: inner });
    } else {
      m.spawns.push({ k: G.mobFor(c), n: cfg.n + (c % 2), r: inner });
      if (k === "grove" || rnd(box) < 0.3) m.spawns.push({ k: G.mobFor(c), n: 1, r: inner });
    }
  }
  // roads: the main route is paved end to end, every other link gets a worn patch at its gap
  for (let i = 1; i < G.main.length; i++) G.route(G.main[i - 1], G.main[i], cfg.road);
  for (const [, d] of doors) {
    clear(m, d[0] - 1, d[1] - 1, d[0] + 2, d[1] + 2);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (!"wb".includes(m.g[d[1] + dy][d[0] + dx])) m.g[d[1] + dy][d[0] + dx] = cfg.road;
  }
  for (const [name, side, c] of cfg.gates) G.gate(name, side, c);
  m.o[mid(cfg.entry)[1] - 2][mid(cfg.entry)[0] + 2] = "G";
  m.gates = G.gates;
  m.entry = G.gates[cfg.gates[0][0]].a[0];
  const pts = [];
  for (let c = 0; c < P.n; c++) pts.push(spot(m, ...mid(c)));
  for (const p of special) pts.push(spot(m, p[0], p[1]));
  for (const name of Object.keys(G.gates)) for (const a of G.gates[name].a) { m.o[a[1]][a[0]] = " "; pts.push(a); }
  connectAll(m, pts, cfg.road);
  return m;
}

/** The city: districts walled off by rows of buildings, joined by streets and the odd alley. */
function city(cfg) {
  const G = grid(cfg);
  const { box, m, P, x0, y0, mid, doors, dkey, kind, cw, ch } = G;
  border(m, "Z", 2);
  const block = (x, y, w, h) => rect(m.o, x, y, x + w - 1, y + h - 1, "Z");
  const tower = (x, y) => (rnd(box) < 0.8 ? house(m, x, y, 4 + ri(box, 0, 3)) : block(x, y, 4, 3));
  const alleys = new Set();
  for (let c = 0; c < P.n; c++) {
    const i = c % cw, j = Math.floor(c / cw), X = x0(c), Y = y0(c);
    if (i < cw - 1) {
      // a column of three buildings between this district and the next; a link leaves one out
      const e = c + 1, bx = x0(e) - 2, link = P.linked(c, e), slot = ri(box, 0, 2);
      const alley = link && rnd(box) < cfg.merge;
      for (let s = 0; s < 3; s++) {
        if (link && s === slot) { if (alley) block(bx, Y + s * 3, 4, 1); continue; }
        tower(bx, Y + s * 3);
      }
      if (link) { doors.set(dkey(c, e), [bx + 1, Y + slot * 3 + (alley ? 1 : 0), true]); if (alley) alleys.add(dkey(c, e)); }
    } else block(X + CS - 2, Y, 2, CR);
    if (i === 0) block(X, Y, 2, CR);
    if (j < ch - 1) {
      // a row between this district and the one below: one building and a stretch of wall
      const s = c + cw, by = y0(s) - 2, link = P.linked(c, s), left = rnd(box) < 0.5;
      const bx = X + (left ? 2 : 4), wx = X + (left ? 6 : 2);
      block(wx, by, 2, 3);
      if (link) doors.set(dkey(c, s), [bx + (left ? 1 : 0), by, false]);
      else tower(bx, by);
    }
  }
  // streets: asphalt three tiles wide along every link that is not an alley
  for (const [k, d] of doors) {
    const [a, b] = k.split("|").map(Number);
    if (!alleys.has(k)) G.route(a, b, "a", 3);
  }
  for (const [name, side, c] of cfg.gates) G.gate(name, side, c);
  // lane dashes down the middle of east-west streets
  for (let y = 3; y < m.h - 3; y++) for (let x = 3; x < m.w - 3; x++) {
    if (m.g[y][x] === "a" && m.g[y - 1][x] === "a" && m.g[y + 1][x] === "a" && m.g[y - 2][x] !== "a" && m.g[y + 2][x] !== "a" && x % 3 === 0) m.g[y][x] = "m";
  }
  const special = [];
  for (let c = 0; c < P.n; c++) {
    const X = x0(c), Y = y0(c), [cx, cy] = mid(c), k = c === cfg.entry ? "gate" : kind[c];
    const inner = [X + 2, Y + 1, X + CS - 4, Y + CR - 4];
    const freeK = (x, y) => m.o[y][x] === " " && m.g[y][x] === "k";
    if (k === "pond") {
      // a pocket park: grass behind a hedge, trees, and a pond
      for (let y = Y + 1; y <= Y + 5; y++) for (let x = X + 2; x <= X + 7; x++) if (m.g[y][x] === "k") { m.g[y][x] = rnd(box) < 0.2 ? "," : "."; m.o[y][x] = " "; }
      for (const [x, y] of [[X + 2, Y + 1], [X + 7, Y + 1], [X + 2, Y + 5]]) if (m.g[y][x] !== "a") m.o[y][x] = "T";
      for (const [x, y] of [[cx, cy - 1], [cx + 1, cy - 1], [cx, cy], [cx + 1, cy]]) if (m.g[y][x] !== "a" && m.g[y][x] !== "m") { m.g[y][x] = "w"; m.o[y][x] = " "; }
      m.o[cy - 1][cx + 1] = m.g[cy - 1][cx + 1] === "w" ? "e" : m.o[cy - 1][cx + 1];
      special.push([cx - 1, cy]);
    } else if (k === "camp") {
      clear(m, cx - 2, cy - 1, cx + 2, cy + 2);
      m.o[cy - 1][cx - 2] = "n"; m.o[cy - 1][cx + 2] = "D";
      FIRES[cfg.id].push([cx, cy]);
      special.push([cx, cy + 1]);
    } else if (k === "vault") {
      // a back lot behind dumpsters and crates, with a chest
      for (const [x, y, o] of [[cx - 2, cy - 1, "D"], [cx + 2, cy - 1, "n"], [cx - 2, cy + 1, "n"], [cx + 2, cy + 1, "x"]]) if (freeK(x, y)) m.o[y][x] = o;
      m.spawns.push({ k: cfg.chest, n: 1, r: [cx, cy, cx, cy] });
      m.spawns.push({ k: G.mobFor(c), n: 3, r: inner });
      special.push([cx, cy]);
    } else if (k === "ruin") {
      // a paved square with lamps at its corners, and a crowd of machines
      for (let y = Y + 1; y <= Y + 5; y++) for (let x = X + 2; x <= X + 7; x++) if (m.g[y][x] === "k") m.g[y][x] = "o";
      for (const [x, y] of [[X + 2, Y + 1], [X + 7, Y + 1], [X + 2, Y + 5], [X + 7, Y + 5]]) if (m.o[y][x] === " " && m.g[y][x] === "o") m.o[y][x] = "L";
      m.spawns.push({ k: G.mobFor(c), n: cfg.n + 3, r: inner });
    } else {
      m.spawns.push({ k: k === "gate" ? cfg.mobs[0] : G.mobFor(c), n: k === "gate" ? 2 : cfg.n + (c % 2), r: inner });
    }
    // street furniture: lamps where pavement meets asphalt, clutter against the walls
    for (let y = Y; y < Y + CR; y++) for (let x = X; x < X + CS; x++) {
      if (!freeK(x, y)) continue;
      const road = m.g[y + 1][x] === "a" || m.g[y - 1][x] === "a", r = rnd(box);
      if (road && (x + y * 3) % 7 === 0) m.o[y][x] = "L";
      else if (r < 0.012) m.o[y][x] = "y";
      else if (r < 0.026) m.o[y][x] = "x";
      else if (r < 0.036) m.o[y][x] = "n";
      else if (r < 0.042) m.o[y][x] = "D";
    }
  }
  // parked cars along the kerb (a car is two tiles long: block the tile beside it as well)
  for (let y = 3; y < m.h - 3; y++) for (let x = 3; x < m.w - 4; x++) {
    if (m.g[y][x] !== "a" || m.g[y][x + 1] !== "a" || m.o[y][x] !== " " || m.o[y][x + 1] !== " ") continue;
    if (m.g[y - 1][x] === "a" && m.g[y + 1][x] === "a") continue;         // keep the middle of the street clear
    let door = false;
    for (const [, d] of doors) if (Math.abs(d[0] - x) < 5 && Math.abs(d[1] - y) < 4) { door = true; break; }
    if (!door && rnd(box) < 0.06) { m.o[y][x] = "c"; m.o[y][x + 1] = "h"; }
  }
  m.gates = G.gates;
  m.entry = G.gates[cfg.gates[0][0]].a[0];
  const pts = [];
  for (let c = 0; c < P.n; c++) pts.push(spot(m, ...mid(c)));
  for (const p of special) pts.push(spot(m, p[0], p[1]));
  for (const name of Object.keys(G.gates)) for (const a of G.gates[name].a) { m.o[a[1]][a[0]] = " "; pts.push(a); }
  connectAll(m, pts, "k");
  return m;
}

/**
 * The cave is a dungeon cut out of solid rock: rooms scattered at random, joined
 * by a spanning tree of corridors plus a few loops, small vaults hung off the
 * side, and the boss's arena at the far end behind a single antechamber.
 */
function dungeon(seed) {
  const box = { seed };
  const m = blank("cave", "수정 동굴", 66, 50, "W");
  m.bgm = "cave";
  const rooms = [];
  const boss = { x0: 49, y0: 5, x1: 61, y1: 17 }, ante = { x0: 38, y0: 8, x1: 45, y1: 14 }, start = { x0: 3, y0: 40, x1: 10, y1: 46 };
  const hit = (a, b, pad) => a.x0 - pad <= b.x1 && a.x1 + pad >= b.x0 && a.y0 - pad <= b.y1 && a.y1 + pad >= b.y0;
  rooms.push(start, ante);
  for (let n = 0; n < 220 && rooms.length < 14; n++) {
    const w = ri(box, 6, 11), h = ri(box, 5, 8), x = ri(box, 3, m.w - 4 - w), y = ri(box, 3, m.h - 4 - h);
    const r = { x0: x, y0: y, x1: x + w - 1, y1: y + h - 1 };
    if (hit(r, boss, 3) || rooms.some((o) => hit(r, o, 2))) continue;
    rooms.push(r);
  }
  const cx = (r) => Math.floor((r.x0 + r.x1) / 2), cy = (r) => Math.floor((r.y0 + r.y1) / 2);
  const floor = new Set(), hall = new Set();
  const dig = (x, y, set) => { if (x > 1 && y > 1 && x < m.w - 2 && y < m.h - 2) { m.g[y][x] = "c"; if (set) set.add(y * m.w + x); } };
  for (const r of rooms.concat([boss])) {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) dig(x, y);
    // ragged edges so the rooms don't look like boxes
    if (r !== boss) {
      for (let x = r.x0; x <= r.x1; x++) { if (rnd(box) < 0.35) dig(x, r.y0 - 1); if (rnd(box) < 0.35) dig(x, r.y1 + 1); }
      for (let y = r.y0; y <= r.y1; y++) { if (rnd(box) < 0.35) dig(r.x0 - 1, y); if (rnd(box) < 0.35) dig(r.x1 + 1, y); }
    }
  }
  /** A corridor two tiles wide between two points, bending once; it goes round the boss's arena, never through. */
  const corridor = (ax, ay, bx, by) => {
    const crosses = (x0, y0, x1, y1) => hit({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1) + 1, y1: Math.max(y0, y1) + 1 }, boss, 2);
    const hFirst = !(crosses(ax, ay, bx, ay) || crosses(bx, ay, bx, by)) && (rnd(box) < 0.5 || crosses(ax, ay, ax, by) || crosses(ax, by, bx, by));
    const leg = (x0, y0, x1, y1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { dig(x, y, hall); dig(x + 1, y, hall); dig(x, y + 1, hall); dig(x + 1, y + 1, hall); } };
    if (hFirst) { leg(ax, ay, bx, ay); leg(bx, ay, bx, by); } else { leg(ax, ay, ax, by); leg(ax, by, bx, by); }
  };
  // a spanning tree over the rooms (nearest first), then a few extra corridors for loops
  const joined = [0], links = [];
  while (joined.length < rooms.length) {
    let best = null, bd = 1e9;
    for (const a of joined) for (let b = 0; b < rooms.length; b++) {
      if (joined.includes(b)) continue;
      const d = Math.abs(cx(rooms[a]) - cx(rooms[b])) + Math.abs(cy(rooms[a]) - cy(rooms[b]));
      if (d < bd) { bd = d; best = [a, b]; }
    }
    links.push(best); joined.push(best[1]);
  }
  for (let n = 0; n < 3; n++) { const a = ri(box, 0, rooms.length - 1), b = ri(box, 0, rooms.length - 1); if (a !== b && a !== 1 && b !== 1) links.push([a, b]); }
  for (const [a, b] of links) corridor(cx(rooms[a]), cy(rooms[a]), cx(rooms[b]), cy(rooms[b]));
  // the only way into the arena: a short neck from the antechamber
  for (let x = ante.x1; x <= boss.x0; x++) { dig(x, 11, hall); dig(x, 12, hall); }
  // vaults: small chambers off to the side, each with one way in
  const vaults = [];
  for (let n = 0; n < 400 && vaults.length < 4; n++) {
    const x = ri(box, 4, m.w - 8), y = ri(box, 4, m.h - 8), v = { x0: x, y0: y, x1: x + 3, y1: y + 2 };
    if (hit(v, boss, 3) || rooms.some((o) => hit(v, o, 1)) || vaults.some((o) => hit(v, o, 4))) continue;
    let rock = true;
    for (let yy = v.y0 - 1; yy <= v.y1 + 1 && rock; yy++) for (let xx = v.x0 - 1; xx <= v.x1 + 1; xx++) if (m.g[yy][xx] !== "W") { rock = false; break; }
    if (!rock) continue;
    // it must sit close to a room, so the passage to it is short
    let near = null, nd = 12;
    for (const r of rooms) { const d = Math.abs(cx(r) - (x + 1)) + Math.abs(cy(r) - (y + 1)) - (r.x1 - r.x0 + r.y1 - r.y0) / 2; if (r !== ante && d < nd) { nd = d; near = r; } }
    if (!near) continue;
    for (let yy = v.y0; yy <= v.y1; yy++) for (let xx = v.x0; xx <= v.x1; xx++) dig(xx, yy);
    corridor(x + 1, y + 1, cx(near), cy(near));
    vaults.push(v);
  }
  // furnishings: crystals and stalagmites against the walls, carts and crates in the rooms, a pool to fish in
  const order = rooms.slice(2).sort((a, b) => (cx(a) + (m.h - cy(a))) - (cx(b) + (m.h - cy(b))));
  const wallish = (x, y) => m.g[y - 1][x] === "W" || m.g[y][x - 1] === "W" || m.g[y][x + 1] === "W";
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
    if (m.g[y][x] !== "c") continue;
    const r = rnd(box);
    if (r < 0.12) m.g[y][x] = "d";
    if (hall.has(y * m.w + x) || hit({ x0: x, y0: y, x1: x, y1: y }, boss, 0)) continue;
    const r2 = rnd(box);
    if (wallish(x, y)) { if (r2 < 0.1) m.o[y][x] = "K"; else if (r2 < 0.17) m.o[y][x] = "S"; }
    else if (r2 < 0.012) m.o[y][x] = "M"; else if (r2 < 0.026) m.o[y][x] = "n"; else if (r2 < 0.034) m.o[y][x] = "S";
  }
  const pool = order[Math.floor(order.length / 2)] || start;
  for (let y = pool.y0; y <= pool.y0 + 1; y++) for (let x = pool.x0; x <= pool.x0 + 2; x++) { m.g[y][x] = "w"; m.o[y][x] = " "; }
  clear(m, start.x0, start.y0, start.x1, start.y1);
  clear(m, ante.x0 + 1, ante.y0 + 1, ante.x1 - 1, ante.y1 - 1);
  // who lives where: the further from the way in, the worse
  FIRES.cave.push([start.x0 + 4, start.y0 + 2]);
  const camp = order[Math.floor(order.length / 2) + 1];
  order.forEach((r, i) => {
    const inner = [r.x0 + 1, r.y0 + 1, r.x1 - 1, r.y1 - 1], t = i / Math.max(1, order.length - 1);
    if (r === camp) { clear(m, cx(r) - 2, cy(r) - 1, cx(r) + 2, cy(r) + 2); m.o[cy(r) - 1][cx(r) - 2] = "E"; FIRES.cave.push([cx(r), cy(r)]); return; }
    m.spawns.push({ k: t < 0.4 ? "candle" : t < 0.75 ? "prism" : "geode", n: t < 0.4 ? 6 : 5, r: inner });
    if (t >= 0.3) m.spawns.push({ k: t < 0.7 ? "candle" : "prism", n: 2, r: inner });
  });
  m.spawns.push({ k: "geode", n: 4, r: [ante.x0 + 1, ante.y0 + 1, ante.x1 - 1, ante.y1 - 1] });
  m.spawns.push({ k: "boss", n: 1, r: [cx(boss), cy(boss) - 1, cx(boss) + 1, cy(boss)] });
  for (const v of vaults) { m.o[v.y0][v.x0] = "K"; m.o[v.y0][v.x1] = "K"; m.spawns.push({ k: "chest_cave", n: 1, r: [v.x0 + 1, v.y0 + 1, v.x0 + 2, v.y0 + 1] }); }
  m.gates = { west: { t: [[start.x0, start.y0 + 3], [start.x0, start.y0 + 4]], a: [[start.x0 + 3, start.y0 + 3], [start.x0 + 3, start.y0 + 4]] } };
  m.entry = m.gates.west.a[0];
  const pts = [m.gates.west.a[1], [cx(boss), cy(boss) + 3], [cx(ante), cy(ante)]];
  for (const r of rooms) pts.push(spot(m, cx(r), cy(r)));
  for (const v of vaults) pts.push([v.x0 + 1, v.y0 + 1], [v.x0 + 2, v.y0 + 1]);
  connectAll(m, pts, "c");
  return m;
}

function buildTown() {
  const box = { seed: 1101 };
  const m = blank("town", "넥서스 광장", 40, 30, ".");
  m.safe = true;
  m.bgm = "town";
  m.entry = [20, 18];
  scatter(m, box, m.g, ",", 0.14, ".");
  scatter(m, box, m.g, '"', 0.04, ".");
  border(m, "T", 2);
  rect(m.g, 14, 10, 25, 19, "o");
  road(m, 26, 14, 39, 14, "p");
  road(m, 0, 14, 13, 14, "p");
  road(m, 19, 4, 19, 9, "p");
  road(m, 19, 20, 19, 25, "p");
  road(m, 9, 9, 9, 14, "p");
  road(m, 29, 8, 29, 14, "p");
  road(m, 9, 14, 9, 20, "p");
  house(m, 8, 5, 0);
  house(m, 27, 4, 1);
  house(m, 7, 21, 5);
  house(m, 28, 20, 3);
  house(m, 17, 2, 2);
  rect(m.o, 19, 14, 20, 15, "a");
  m.big.push({ t: "fountain", x: 19, y: 14 });
  for (const [x, y] of [[14, 10], [25, 10], [14, 19], [25, 19]]) m.o[y][x] = "L";
  for (let x = 4; x <= 12; x++) if (x !== 9 && x !== 10) m.o[26][x] = "F";
  for (const [x, y] of [[5, 12], [33, 9], [5, 17], [23, 24], [13, 5], [24, 6]]) m.o[y][x] = "B";
  for (const [x, y] of [[32, 13], [6, 13]]) m.o[y][x] = "G";
  // the market corner by the supply shop: stacked goods and a stall's awning
  for (const [x, y] of [[12, 8], [13, 8], [12, 10], [7, 9], [6, 10]]) m.o[y][x] = "B";
  m.o[10][13] = "E";
  // a pond to fish in, with a plank dock out over the water and reeds along the far bank
  for (let y = 16; y <= 21; y++) for (let x = 31; x <= 38; x++) {
    const d = ((x - 35) / 3.2) ** 2 + ((y - 18.5) / 2) ** 2;
    if (d < 1) { m.g[y][x] = "w"; m.o[y][x] = " "; } else if (d < 1.9 && x < 38 && m.o[y][x] !== "h") { m.g[y][x] = "s"; if (m.o[y][x] !== "T") m.o[y][x] = " "; }
  }
  for (let x = 31; x <= 34; x++) { m.g[18][x] = "b"; m.o[18][x] = " "; }
  for (const [x, y] of [[36, 17], [37, 19], [35, 20]]) if (m.g[y][x] === "w") m.o[y][x] = "e";
  // hedges framing the plaza's south side
  for (const x of [15, 16, 17, 22, 23, 24]) m.o[20][x] = "H";
  m.npcs.push(
    { id: "shop", name: "보급상 리나", role: "shop", x: 10, y: 9, look: [4, 0, 1, "#8a4a6a"] },
    { id: "smith", name: "대장장이 볼칸", role: "smith", x: 30, y: 8, look: [0, 1, 0, "#6a4a38"] },
    { id: "elder", name: "관리자 엘더윈", role: "elder", x: 19, y: 11, look: [5, 0, 0, "#3f5a9a"] },
    { id: "train", name: "수련관 카이", role: "train", x: 23, y: 12, look: [1, 2, 0, "#7a2e2e"] },
    { id: "guard", name: "경비병 토비", role: "talk", x: 35, y: 13, look: [1, 0, 0, "#5e6470"],
      say: "동쪽 문은 바람초원, 서쪽 문은 네온 시티로 이어져. 길은 갈라지고 막히기도 하니 샛길을 살펴봐 — 막다른 곳엔 보물 상자나 쉬어 갈 모닥불이 있거든. 네온 시티는 레벨 13은 되어야 버틸 만해!" },
  );
  m.gates = { east: { t: [[38, 14], [38, 15]], a: [[36, 14], [36, 15]] }, west: { t: [[1, 14], [1, 15]], a: [[3, 14], [3, 15]] } };
  FIRES.town.push([22, 22]);
  return m;
}

const PLACES = ["vault", "camp", "pond", "vault", "ruin", "grove", "vault", "pond"];
function buildMaps() {
  for (const id of ["town", "meadow", "forest", "cave", "city"]) FIRES[id] = [];
  const town = buildTown();
  const meadow = wild({
    id: "meadow", name: "바람초원", seed: 22021, min: 7, cw: 7, ch: 5, entry: 14, exit: 20, loops: 0.14, merge: 0.3, river: 4,
    ground: ".", tufts: ",", edge: "T", treeCh: "T", tree: 0.022, road: "p", shore: "s",
    walls: [["cliff", 0.5], ["hedge", 0.22], ["trees", 0.28]], places: PLACES, mobs: ["acorn", "potcrab", "puff"], pondMob: "puff", chest: "chest_meadow", n: 4,
    gates: [["west", "w", 14], ["east", "e", 20]],
  });
  const forest = wild({
    id: "forest", name: "속삭임 숲", seed: 33053, min: 7, bgm: "forest", cw: 7, ch: 5, entry: 14, exit: 6, loops: 0.1, merge: 0.18, river: 3,
    ground: ":", tufts: ";", edge: "P", treeCh: "P", tree: 0.05, road: "p", shore: null,
    walls: [["trees", 0.55], ["cliff", 0.33], ["ruin", 0.12]], places: PLACES, mobs: ["capfrog", "stump", "yarn", "lantern"], pondMob: null, chest: "chest_forest", n: 4,
    gates: [["west", "w", 14], ["north", "n", 6]],
  });
  const cave = dungeon(44093);
  const town2 = city({
    id: "city", name: "네온 시티", seed: 55071, bgm: "city", cw: 7, ch: 5, entry: 20, exit: 14, loops: 0.2, merge: 0.3,
    ground: "k", road: "a", roadW: 3, places: ["vault", "camp", "pond", "vault", "ruin", "vault", "ruin"], min: 6,
    mobs: ["eyecam", "signbot", "tvhead", "vend"], chest: "chest_city", n: 4,
    gates: [["east", "e", 20]],
  });
  // doors between the worlds: stepping on a gate tile puts you on the matching arrival tile next door
  const join = (a, ga, b, gb) => {
    for (let k = 0; k < 2; k++) {
      portal(a, a.gates[ga].t[k][0], a.gates[ga].t[k][1], b.id, b.gates[gb].a[k][0], b.gates[gb].a[k][1]);
      portal(b, b.gates[gb].t[k][0], b.gates[gb].t[k][1], a.id, a.gates[ga].a[k][0], a.gates[ga].a[k][1]);
    }
  };
  join(town, "east", meadow, "west");
  join(town, "west", town2, "east");
  join(meadow, "east", forest, "west");
  join(forest, "north", cave, "west");
  const out = {};
  for (const m of [town, meadow, forest, cave, town2]) out[m.id] = finalize(m);
  return out;
}
const MAPS = buildMaps();
const START = { map: "town", x: 20 * T + 8, y: 18 * T + 8 };

function solidAt(m, px, py) {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.solid[ty * m.w + tx] === 1;
}
/** Feet box: 8 wide, 6 tall, anchored at the bottom centre of the sprite. */
function canStand(m, x, y) {
  return !(solidAt(m, x - 4, y - 5) || solidAt(m, x + 4, y - 5) || solidAt(m, x - 4, y) || solidAt(m, x + 4, y));
}
function canFly(m, x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (tx < 2 || ty < 2 || tx >= m.w - 2 || ty >= m.h - 2) return false;
  return m.g[ty][tx] !== "W";
}

function mapPayload(m) {
  return {
    id: m.id, name: m.name, w: m.w, h: m.h, g: m.g, o: m.o, big: m.big, safe: m.safe, bgm: m.bgm,
    portals: m.portals.map((p) => ({ x: p.x, y: p.y, to: MAPS[p.to].name })),
    npcs: m.npcs,
  };
}

// ───────────────────────────── characters ─────────────────────────────

const NAME_RE = /^[가-힣A-Za-z0-9]{2,10}$/;
export function validName(name) {
  return typeof name === "string" && NAME_RE.test(name);
}
/** Where gear is worn. Two rings; everything else one of a kind. */
const SLOTS = ["weapon", "helm", "armor", "gloves", "boots", "ring1", "ring2", "amulet"];
const GEAR_TYPES = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"];
const isGear = (id) => GEAR_TYPES.includes(ITEMS[id].type);
const isJewel = (id) => ITEMS[id].type === "ring" || ITEMS[id].type === "amulet";
const slotsFor = (type) => (type === "ring" ? ["ring1", "ring2"] : [type]);
const plain = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });

/** The highest choice allowed for each part of a character's look. */
const LOOK_MAX = [5, 5, 4, 9, 3, 3, 5];
/** A brand-new character sheet — this is exactly what gets persisted. */
export function newChar(name, cls, look) {
  const c = CLASSES[cls] ? cls : "warrior";
  const lk = Array.isArray(look) ? look : [];
  return {
    v: 3, name, cls: c,
    // ear, eyes, nose, colour, blush, markings, tunic
    look: LOOK_MAX.map((m, i) => clamp(lk[i] | 0, 0, m)),
    lvl: 1, xp: 0, gold: 50,
    inv: [{ id: "hp_s", n: 5 }, { id: "mp_s", n: 3 }],
    eq: { weapon: plain(`w_${c}_1`), helm: null, armor: plain("a_1"), gloves: null, boots: null, ring1: null, ring2: null, amulet: null },
    tr: { str: 0, vit: 0, int: 0, grd: 0 },
    q: { i: 0, n: 0, st: 0 },
    bq: null, bn: 0, mk: {}, guild: "", gm: 0, fish: 0,
    map: START.map, x: START.x, y: START.y, hp: -1, mp: -1, kills: 0,
  };
}

/** Ids that no longer exist, and what they became. */
const OLD_ID = { c_1: "r_2", c_2: "n_3", c_3: "r_4" };
/** Bring a sheet saved by an older version up to the current shape. */
function migrate(ch) {
  if (ch.cls === "ranger" || ch.cls === "archer") ch.cls = "lancer";
  if (!CLASSES[ch.cls]) ch.cls = "warrior";
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
    eq[k] = g && slotsFor(ITEMS[g.id].type).includes(k) ? g : null;
  }
  // the single accessory slot of old sheets becomes a ring or an amulet
  const acc = fix(old.acc);
  if (acc) {
    const k = slotsFor(ITEMS[acc.id].type)[0];
    if (!eq[k]) eq[k] = acc;
    else if (ch.inv.length < INV) ch.inv.push(acc);
  }
  if (eq.weapon && ITEMS[eq.weapon.id].cls !== ch.cls) eq.weapon = plain(`w_${ch.cls}_1`);
  ch.eq = eq;
  const tr = isObj(ch.tr) ? ch.tr : {};
  ch.tr = { str: tr.str | 0, vit: tr.vit | 0, int: tr.int | 0, grd: tr.grd | 0 };
  if (!isObj(ch.q)) ch.q = { i: 0, n: 0, st: 0 };
  ch.bq = isObj(ch.bq) && MOBS[ch.bq.k] ? { k: ch.bq.k, n: ch.bq.n | 0, need: BOUNTY_N } : null;
  ch.bn = ch.bn | 0;
  const mk = {};
  if (isObj(ch.mk)) for (const k of Object.keys(ch.mk)) if (MOBS[k]) mk[k] = ch.mk[k] | 0;
  ch.mk = mk;
  ch.guild = typeof ch.guild === "string" && NAME_RE.test(ch.guild) ? ch.guild : "";
  ch.gm = ch.guild && ch.gm ? 1 : 0;
  ch.fish = ch.fish | 0;
  ch.v = 3;
  return ch;
}

function runeword(g) {
  if (!g.sk || g.ru.length !== g.sk) return null;
  for (const rw of RUNEWORDS) {
    if (rw.seq.length === g.sk && rw.seq.every((r, i) => g.ru[i] === r)) return rw;
  }
  return null;
}
/** How a character's basic attack lands: the equipped weapon's kind, or the class's first. */
function armOf(ch) {
  const w = ch.eq.weapon;
  return WKIND[(w && ITEMS[w.id].wk) || CLASSES[ch.cls].wk[0]];
}
const weaponKind = (ch) => (ch.eq.weapon && ITEMS[ch.eq.weapon.id].wk) || CLASSES[ch.cls].wk[0];
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
    if (!g) continue;
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
  if (lg.greed) b.gold += 60;
  b.lg = lg;
  return b;
}

function stats(p) {
  let c = p.stc;
  if (!c) {
    const ch = p.ch, cl = CLASSES[ch.cls], lv = ch.lvl, b = gearBonus(ch), w = ch.eq.weapon, arm = armOf(ch);
    c = p.stc = {
      mhp: Math.round(cl.hp[0] + cl.hp[1] * lv + b.hp + ch.tr.vit * TRAIN.vit.gain),
      mmp: Math.round(cl.mp[0] + cl.mp[1] * lv + b.mp + ch.tr.int * TRAIN.int.gain),
      atk0: (cl.atk[0] + cl.atk[1] * lv + b.atk + ch.tr.str * TRAIN.str.gain) * (1 + b.atkp / 100),
      def: Math.round(cl.def[0] + cl.def[1] * lv + b.def + ch.tr.grd * TRAIN.grd.gain),
      crit: Math.min(75, cl.crit + (w ? w.enh : 0) + b.crit),
      critd: 1.6 + b.critd / 100, ls: Math.min(15, b.ls), spd0: BASE_SPD * (1 + Math.min(40, b.spd) / 100), xp: b.xp, mf: b.mf, gold: b.gold,
      lg: b.lg, arm, acd: Math.round(arm.cd * (b.lg.haste ? 0.85 : 1)),
    };
  }
  const now = p.S.now;
  const food = p.food && p.food.until > now ? p.food : null;
  return {
    mhp: c.mhp, mmp: c.mmp, def: c.def, crit: c.crit, critd: c.critd, ls: c.ls, mf: c.mf,
    xp: c.xp + (food ? food.xp : 0) + (p.warm > now ? p.warmPct : 0), gold: c.gold, lg: c.lg, arm: c.arm, acd: c.acd,
    atk: Math.round(c.atk0 * (p.atkBuff > now ? 1.25 : 1) * (food ? 1 + food.atk / 100 : 1)),
    spd: c.spd0 * (p.spdBuff > now ? 1.4 : 1), spd0: c.spd0,
  };
}

export function exportChar(S, pid) {
  const p = S.players[pid];
  if (!p) return null;
  const ch = p.ch;
  ch.map = p.map; ch.x = Math.round(p.x); ch.y = Math.round(p.y);
  ch.hp = p.dead ? 0 : Math.round(p.hp); ch.mp = Math.round(p.mp);
  return ch;
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

function newMob(S, k, r) {
  return { id: S.nextId++, k, r, x: 0, y: 0, hx: 0, hy: 0, hp: 0, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 0, wx: 0, wy: 0, by: {}, dead: false, respAt: 0, slow: 0, stun: 0, dot: null, castAt: 0, el: 0, temp: false };
}
export function setup() {
  const S = { seed: 20251111, now: 0, last: 0, nextId: 1, players: {}, maps: {}, parties: {}, chat: [], n: 0 };
  for (const id of Object.keys(MAPS)) {
    const rt = { id, mobs: [], drops: [], ev: [], tele: [], zones: [], fires: [], who: false, n: 0, kc: 0, fb: 0 };
    for (const [fx, fy] of FIRES[id] || []) {
      const at = freeTile(MAPS[id], fx, fy);
      if (at) rt.fires.push({ id: S.nextId++, x: at[0] * T + 8, y: at[1] * T + 10, until: 0 });
    }
    for (const sp of MAPS[id].spawns) {
      for (let i = 0; i < sp.n; i++) {
        const mob = newMob(S, sp.k, sp.r);
        placeMob(S, MAPS[id], mob);
        rt.mobs.push(mob);
      }
    }
    S.maps[id] = rt;
  }
  return S;
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
  // now and then an elite spawns: far tougher, far more rewarding — party prey
  mob.el = !MOBS[mob.k].boss && !MOBS[mob.k].chest && rnd(S) < 0.08 ? 1 : 0;
  mob.hp = mobMax(mob);
  mob.dead = false; mob.tgt = null; mob.by = {}; mob.st = 0; mob.slow = 0; mob.stun = 0; mob.dot = null;
  mob.wx = mob.x; mob.wy = mob.y;
  mob.castAt = S.now + 3000 + rnd(S) * 3000;
}
/** A hunting ground's field boss walks in where the kill that summoned it was made. */
function spawnFieldBoss(S, rt, x, y) {
  const m = MAPS[rt.id];
  const mob = newMob(S, FIELD_BOSS[rt.id], [0, 0, 0, 0]);
  mob.el = 2; mob.temp = true;
  mob.x = mob.hx = mob.wx = x; mob.y = mob.hy = mob.wy = y;
  mob.hp = mobMax(mob);
  mob.castAt = S.now + 4000;
  rt.mobs.push(mob);
  rt.fb = mob.id;
  rt.kc = 0;
  rt.ev.push(["r", mob.id]);
  sys(S, `${m.name}에 우두머리 [${MOBS[mob.k].name}]이(가) 나타났습니다!`);
}

export function playerCount(S) {
  return S.n;
}

/** Put a loaded character into the world. Returns the player's public entity id. */
export function addPlayer(S, pid, ch) {
  if (S.players[pid]) removePlayer(S, pid);
  migrate(ch);
  if (!MAPS[ch.map]) ch.map = START.map;
  const p = {
    S, pid, eid: S.nextId++, ch, map: ch.map, x: ch.x, y: ch.y, dir: 0, hp: 1, mp: 0, dead: false, stc: null,
    cds: [0, 0, 0, 0], atkAt: 0, combo: 0, streak: 0, streakAt: 0, potAt: 0, hitAt: 0, mvAt: S.now, chatAt: 0, fullAt: 0, regenAt: S.now,
    sit: false, fish: null, food: null, warm: 0, warmPct: 0, warmT: 0, emoAt: 0, ginv: null,
    atkBuff: 0, spdBuff: 0, dirty: true, sendMap: true, fix: true, gain: [], toast: [], party: 0, pinv: null,
  };
  if (!canStand(MAPS[p.map], p.x, p.y)) { p.map = START.map; p.x = START.x; p.y = START.y; }
  const st = stats(p);
  p.hp = ch.hp > 0 ? Math.min(ch.hp, st.mhp) : st.mhp;
  p.mp = ch.mp >= 0 ? Math.min(ch.mp, st.mmp) : st.mmp;
  if (ch.hp === 0) { p.map = START.map; p.x = START.x; p.y = START.y; }
  S.players[pid] = p;
  S.n++;
  S.maps[p.map].n++;
  S.maps[p.map].who = true;
  sys(S, `${ch.name}님이 접속했습니다.`);
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
  S.maps[to].n++;
  S.maps[to].who = true;
  p.sendMap = true; p.fix = true;
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

// ───────────────────────────── inventory & loot ─────────────────────────────

function resolveItem(key, cls) {
  if (key[0] === "W" && key.length === 2) return `w_${cls}_${key[1]}`;
  return key;
}
function countItem(ch, id) {
  let n = 0;
  for (const s of ch.inv) if (s.id === id) n += s.n || 1;
  return n;
}
function canAdd(ch, id, n) {
  if (isGear(id)) return ch.inv.length + n <= INV;
  let room = (INV - ch.inv.length) * STACK;
  for (const s of ch.inv) if (s.id === id) room += STACK - s.n;
  return room >= n;
}
function addItem(ch, id, n) {
  if (!canAdd(ch, id, n)) return false;
  if (isGear(id)) {
    for (let i = 0; i < n; i++) ch.inv.push(plain(id));
    return true;
  }
  for (const s of ch.inv) {
    if (s.id !== id || n <= 0) continue;
    const put = Math.min(n, STACK - s.n);
    s.n += put; n -= put;
  }
  while (n > 0) {
    const put = Math.min(n, STACK);
    ch.inv.push({ id, n: put });
    n -= put;
  }
  return true;
}
function takeItem(ch, id, n) {
  for (let i = ch.inv.length - 1; i >= 0 && n > 0; i--) {
    const s = ch.inv[i];
    if (s.id !== id) continue;
    const take = Math.min(n, s.n);
    s.n -= take; n -= take;
    if (s.n <= 0) ch.inv.splice(i, 1);
  }
}
function gearName(g) {
  const word = g.lg ? `${LEGEND[g.lg][0]} ` : g.set ? `${SETS[g.set].name} ` : "";
  return (g.enh > 0 ? `+${g.enh} ` : "") + word + ITEMS[g.id].name;
}
function sellPrice(s) {
  const it = ITEMS[s.id];
  if (!isGear(s.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.25 * (1 + 0.8 * (s.q | 0)) * (1 + 0.3 * (s.enh | 0)));
}
/** The set a base item can belong to, if any. */
function setFor(it) {
  for (const id of Object.keys(SETS)) {
    if (SETS[id].types.includes(it.type) && SETS[id].tiers.includes(it.tier)) return id;
  }
  return null;
}

/** Roll one piece of gear: rarity decides how many affixes, item level how big. */
function rollGear(S, id, q, ilvl) {
  const it = ITEMS[id];
  if (q === 4 && !setFor(it)) q = 3;
  const g = plain(id);
  g.q = q;
  const [lo, hi] = RARITY_AFFIX[q];
  const pool = AFFIX.slice();
  for (let n = ri(S, lo, hi); n > 0 && pool.length; n--) {
    const [key, , , min, max, grow] = pool.splice(ri(S, 0, pool.length - 1), 1)[0];
    g.af.push([key, Math.max(1, Math.round((min + rnd(S) * (max - min) + grow * ilvl) * (q >= 3 ? 1.3 : 1)))]);
  }
  if (q === 3) { const keys = Object.keys(LEGEND); g.lg = keys[ri(S, 0, keys.length - 1)]; }
  if (q === 4) g.set = setFor(it);
  if (!isJewel(id)) {
    const r = rnd(S);
    const most = it.type === "gloves" || it.type === "boots" ? 1 : 3;
    g.sk = Math.min(most, (r < 0.12 ? 2 : r < 0.45 ? 1 : 0) + (q >= 3 ? 1 : 0));
  }
  return g;
}
/** `rank`: 0 for ordinary monsters, 1 elite, 2 field boss or boss. */
function rollRarity(S, rank, mf) {
  const k = 1 + mf / 100;
  const r = rnd(S);
  const top = [0.012, 0.07, 0.2][rank] * k;       // legendary or set
  const rare = [0.09, 0.3, 0.55][rank] * k;
  const magic = 0.36 * k;
  if (r < top) return rnd(S) < 0.4 ? 4 : 3;
  return r < top + rare ? 2 : r < top + rare + magic ? 1 : 0;
}
function tierFor(lv) {
  return lv < 8 ? 1 : lv < 16 ? 2 : lv < 26 ? 3 : lv < 38 ? 4 : 5;
}
/** Which kind of piece drops: weapons most often, jewellery least. */
const DROP_TYPES = [["weapon", 24], ["helm", 13], ["armor", 15], ["gloves", 13], ["boots", 13], ["ring", 13], ["amulet", 9]];

/** What one looter finds on one corpse. Everyone in the party rolls their own. */
function lootFor(S, rt, mob, p) {
  const d = MOBS[mob.k];
  const st = stats(p);
  const out = [];
  const share = allies(S, p).length;
  const rank = d.boss ? 2 : d.chest ? 1 : mob.el;
  const gold = ri(S, d.gold[0], d.gold[1]) * [1, 3, 12][mob.el] * (1 + st.gold / 100);
  out.push({ it: "gold", n: Math.max(1, Math.round(gold / share)) });
  const tries = d.boss ? 4 : mob.el === 2 ? 3 : 1;
  for (let i = 0; i < tries; i++) {
    if (rnd(S) >= (rank === 2 || d.chest ? 1 : rank === 1 ? 0.6 : d.gear) * (1 + st.mf / 100)) continue;
    let tier = tierFor(d.lv);
    if (rank && rnd(S) < 0.25) tier = Math.min(5, tier + 1);
    let roll = rnd(S) * 100, type = "weapon";
    for (const [t, w] of DROP_TYPES) { if (roll < w) { type = t; break; } roll -= w; }
    let id;
    if (type === "weapon") {
      // weapons always fit the looter's class; a mage finds staves and books alike
      const kinds = CLASSES[p.ch.cls].wk;
      id = `w_${WK_ID[kinds[ri(S, 0, kinds.length - 1)]]}_${tier}`;
    } else id = `${GEAR[type].pre}_${tier}`;
    let q = rollRarity(S, rank, st.mf);
    if (isJewel(id) && q === 0) q = 1;
    out.push({ g: rollGear(S, id, q, d.lv) });
  }
  if (rnd(S) < (rank === 2 ? 1 : rank === 1 ? 0.25 : 0.02 + d.lv * 0.001)) out.push({ it: `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`, n: 1 });
  if (rnd(S) < (rank === 2 ? 1 : rank === 1 ? 0.5 : 0.05)) out.push({ it: "stone", n: rank === 2 ? ri(S, 3, 6) : 1 });
  if (rnd(S) < 0.1) out.push({ it: d.lv < 8 ? "hp_s" : "hp_m", n: 1 });
  if (rnd(S) < 0.07) out.push({ it: d.lv < 8 ? "mp_s" : "mp_m", n: 1 });
  for (const o of out) {
    rt.drops.push({
      id: S.nextId++, it: o.g ? o.g.id : o.it, g: o.g || null, n: o.n || 1, q: o.g ? o.g.q : 0,
      x: mob.x + ri(S, -14, 14), y: mob.y + ri(S, -8, 10), own: p.pid, freeAt: S.now + 20000, dieAt: S.now + 60000,
    });
  }
}

// ───────────────────────────── combat ─────────────────────────────

function gainXp(S, p, n) {
  const ch = p.ch;
  n = Math.max(1, Math.round(n * (1 + stats(p).xp / 100)));
  ch.xp += n;
  p.gain.push(["xp", n]);
  while (ch.lvl < MAXLV && ch.xp >= xpNeed(ch.lvl)) {
    ch.xp -= xpNeed(ch.lvl);
    ch.lvl++;
    p.stc = null;
    const st = stats(p);
    p.hp = st.mhp; p.mp = st.mmp;
    p.gain.push(["lvl", ch.lvl]);
    S.maps[p.map].ev.push(["l", p.eid]);
    S.maps[p.map].who = true;
    for (const sk of SKILLS[ch.cls]) if (sk.lv === ch.lvl) toast(p, `새 스킬 [${sk.name}]을(를) 배웠습니다!`);
    if (ch.lvl % 10 === 0) sys(S, `${ch.name}님이 레벨 ${ch.lvl}을(를) 달성했습니다!`);
    if (ch.lvl === MAXLV) toast(p, "최고 레벨 달성! 이제 경험치는 수련에 쓰입니다.");
  }
  p.dirty = true;
}

/** Take `dmg` off a monster on behalf of `p`; true if that killed it. */
function dealMob(S, rt, mob, p, dmg, crit) {
  if (mob.dead) return false;
  mob.hp -= dmg;
  mob.by[p.pid] = (mob.by[p.pid] || 0) + dmg;
  if (!mob.tgt) mob.tgt = p.pid;
  rt.ev.push(["h", mob.id, dmg, crit ? 1 : 0, 0]);
  if (mob.hp > 0) return false;
  killMob(S, rt, mob);
  return true;
}

function hurtMob(S, rt, mob, p, mult, sure) {
  if (mob.dead) return;
  const st = stats(p);
  const d = MOBS[mob.k];
  const crit = sure || rnd(S) * 100 < st.crit;
  let dmg = st.atk * mult * (0.85 + rnd(S) * 0.3) * (crit ? st.critd : 1) - d.def * 0.5;
  dmg *= 1 + 0.03 * masteryRank(p.ch, mob.k);
  if (st.lg.giant && (mob.el || d.boss)) dmg *= 1.3;
  dmg = Math.max(1, Math.round(dmg));
  if (st.ls > 0 && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + Math.max(1, Math.round((dmg * st.ls) / 100)));
  const x = mob.x, y = mob.y;
  // whatever is hit flinches for a moment; the biggest things shrug it off
  if (!d.boss && mob.el < 2) mob.stun = Math.max(mob.stun, S.now + (mob.el ? 80 : 120));
  if (!dealMob(S, rt, mob, p, dmg, crit)) return;
  // legendary powers that answer a kill
  if (st.lg.feast && !p.dead) p.hp = Math.min(st.mhp, p.hp + st.mhp * 0.04);
  if (st.lg.nova && !p.chainKill) {
    p.chainKill = true;
    rt.ev.push(["b", Math.round(x), Math.round(y), 34, 1]);
    for (const o of mobsWithin(rt, x, y, 34)) hurtMob(S, rt, o, p, 0.8);
    p.chainKill = false;
  }
}

function killMob(S, rt, mob) {
  const d = MOBS[mob.k];
  const el = mob.el;
  mob.dead = true;
  mob.respAt = S.now + d.resp;
  mob.tgt = null;
  mob.dot = null;
  rt.ev.push(["k", mob.id]);
  // everyone who hit it, plus their party members standing nearby, shares the kill
  const looters = new Set();
  let top = null, topDmg = 0;
  for (const pid of Object.keys(mob.by)) {
    const p = S.players[pid];
    if (!p || p.map !== rt.id) continue;
    if (mob.by[pid] > topDmg) { top = p; topDmg = mob.by[pid]; }
    for (const o of allies(S, p)) if (!o.dead) looters.add(o);
  }
  mob.by = {};
  const xp = d.xp * ELITE[el].xp;
  for (const p of looters) {
    const ch = p.ch;
    // a chest is opened, not hunted: it pays out its loot and nothing else
    if (d.chest) { p.dirty = true; lootFor(S, rt, mob, p); continue; }
    const n = Math.min(PARTY_MAX, allies(S, p).length);
    // a kill soon after the last one keeps the streak alive
    p.streak = S.now - p.streakAt < STREAK_MS ? p.streak + 1 : 1;
    p.streakAt = S.now;
    const rank = masteryRank(ch, mob.k);
    gainXp(S, p, xp * PARTY_SHARE[n - 1] * (1 + Math.min(STREAK_MAX, p.streak - 1) * 0.02 + rank * 0.02 + guildNear(S, p) * GUILD_XP));
    ch.kills = (ch.kills || 0) + 1;
    ch.mk[mob.k] = (ch.mk[mob.k] || 0) + 1;
    const now = masteryRank(ch, mob.k);
    if (now > rank) {
      toast(p, `토벌 숙련 [${d.name}] ${now}단계 — 피해 +${now * 3}%, 경험치 +${now * 2}%`);
      rt.ev.push(["u", p.eid, 2]);
    }
    const q = ch.q;
    const quest = QUESTS[q.i];
    if (q.st === 1 && quest && quest.mob === mob.k && q.n < quest.n) {
      q.n++;
      if (q.n >= quest.n) toast(p, `의뢰 [${quest.title}] 달성! 관리자에게 돌아가세요.`);
    }
    const bq = ch.bq;
    if (bq && bq.k === mob.k && bq.n < bq.need) {
      bq.n++;
      if (bq.n >= bq.need) toast(p, `반복 의뢰 [${d.name} ${bq.need}마리] 달성! 관리자에게 보고하세요.`);
    }
    p.dirty = true;
    lootFor(S, rt, mob, p);
  }
  if (d.boss && top) sys(S, `${top.ch.name}님의 일행이 ${d.name}을(를) 쓰러뜨렸습니다!`);
  if (el === 2) {
    rt.fb = 0;
    if (top) sys(S, `${top.ch.name}님의 일행이 ${MAPS[rt.id].name}의 우두머리 [${d.name}]을(를) 쓰러뜨렸습니다!`);
  }
  // some monsters go off where they fall
  if (d.burst) {
    rt.tele.push({ x: mob.x, y: mob.y, r: d.burst, at: S.now + 900, dmg: d.atk * 1.3 });
    rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), d.burst, 900]);
  }
  // enough kills in one hunting ground call out its field boss
  if (!d.boss && !d.chest && el < 2 && FIELD_BOSS[rt.id] && looters.size) {
    rt.kc++;
    if (rt.kc >= FB_KILLS && !rt.fb) spawnFieldBoss(S, rt, mob.x, mob.y);
  }
}
function hurtPlayer(S, rt, p, raw, mob) {
  if (p.dead) return;
  const st = stats(p);
  const dmg = Math.max(1, Math.round(raw * (0.85 + rnd(S) * 0.3) - st.def * 0.6));
  p.hp -= dmg;
  p.hitAt = S.now;
  rouse(S, p);
  rt.ev.push(["h", p.eid, dmg, 0, 1]);
  if (mob && st.lg.thorn) dealMob(S, rt, mob, p, Math.max(1, Math.round(dmg * 0.4)), 0);
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    p.streak = 0;
    dropAggro(S, p);
    rt.ev.push(["pd", p.eid]);
    toast(p, "쓰러졌습니다...");
  }
}

const big = (mob) => (MOBS[mob.k].boss ? 12 : mob.el === 2 ? 8 : 0);
function nearestMob(rt, x, y, range) {
  let best = null, bd = range;
  for (const mob of rt.mobs) {
    if (mob.dead) continue;
    const d = dist(x, y, mob.x, mob.y) - big(mob);
    if (d <= bd) { bd = d; best = mob; }
  }
  return best;
}
function mobsWithin(rt, x, y, r) {
  return rt.mobs.filter((mob) => !mob.dead && dist(x, y, mob.x, mob.y) - big(mob) <= r);
}
/** Monsters standing in a strip `len` long from (x, y) along the unit vector (ux, uy). */
function mobsInLine(rt, x, y, ux, uy, len, half) {
  return rt.mobs.filter((o) => {
    if (o.dead) return false;
    const rx = o.x - x, ry = o.y - y;
    const along = rx * ux + ry * uy;
    return along > -4 && along < len && Math.abs(rx * uy - ry * ux) < half + big(o);
  });
}
/** Shove a monster `far` along (ux, uy), stopping at anything solid. */
function knock(m, mob, ux, uy, far) {
  if (MOBS[mob.k].boss || MOBS[mob.k].still || mob.el === 2) return;
  const ok = MOBS[mob.k].fly ? canFly : canStand;
  for (let k = far; k > 3; k -= 4) {
    if (ok(m, mob.x + ux * k, mob.y + uy * k)) { mob.x += ux * k; mob.y += uy * k; return; }
  }
}
function face(p, mob) {
  p.dir = dirOf(mob.x - p.x, mob.y - p.y);
}
const DX = [0, -1, 1, 0], DY = [1, 0, 0, -1];
/** The unit vector from a player toward a monster, or the way the player faces. */
function aimVec(p, mob) {
  if (!mob) return [DX[p.dir], DY[p.dir]];
  const d = dist(p.x, p.y, mob.x, mob.y) || 1;
  return [(mob.x - p.x) / d, (mob.y - p.y) / d];
}

function basicAttack(S, p) {
  rouse(S, p);
  const st = stats(p);
  const c = st.arm;
  const rt = S.maps[p.map];
  // one, two, three: the third blow of an unbroken run is the finisher
  p.combo = S.now - p.atkAt < st.acd + COMBO_MS ? (p.combo + 1) % 3 : 0;
  const fin = p.combo === 2;
  p.atkAt = S.now;
  const mob = nearestMob(rt, p.x, p.y, c.range);
  if (!mob) {
    const reach = c.range < 60 ? 14 : c.range * 0.7;
    rt.ev.push(["a", p.eid, c.fx, Math.round(p.x + DX[p.dir] * reach), Math.round(p.y - 6 + DY[p.dir] * reach), p.dir, p.combo]);
    return;
  }
  face(p, mob);
  rt.ev.push(["a", p.eid, c.fx, Math.round(mob.x), Math.round(mob.y - 6), p.dir, p.combo]);
  const mult = (c.mult || 1) * (fin ? FINISH.mult : 1);
  // a greatsword's arc catches what stands beside the target, a spear runs through
  // what stands behind it, and a spellbook's burst splashes around it
  let extra = [];
  if (c.cleave) extra = mobsWithin(rt, mob.x, mob.y, fin ? 34 : 26).slice(0, c.cleave + (fin ? 1 : 0));
  else if (c.line) { const [ux, uy] = aimVec(p, mob); extra = mobsInLine(rt, p.x, p.y, ux, uy, c.range + 10, fin ? 16 : 11).slice(0, c.line + (fin ? 1 : 0)); }
  else if (c.splash) extra = mobsWithin(rt, mob.x, mob.y, c.splash + (fin ? 8 : 0)).slice(0, 4);
  const zx = mob.x, zy = mob.y;
  // the blow lands with weight: whatever it hits is shoved back and reels, the
  // finisher most of all. Elites only reel; bosses and field bosses stand firm.
  const shove = (o, k) => {
    if (MOBS[o.k].boss || o.el === 2) return;
    if (!o.el) { const [ux, uy] = aimVec(p, o); knock(MAPS[p.map], o, ux, uy, c.kb * k * (fin ? FINISH.kb : 1)); }
    o.stun = Math.max(o.stun, S.now + (fin ? FINISH.stun : 150) * (o.el ? 0.6 : 1));
  };
  shove(mob, 1);
  hurtMob(S, rt, mob, p, mult);
  for (const o of extra) if (o !== mob) { shove(o, 0.6); hurtMob(S, rt, o, p, mult * 0.6); }
  if (st.lg.chain && rnd(S) < 0.25) {
    for (const o of mobsWithin(rt, zx, zy, 70).filter((o) => o !== mob).slice(0, 2)) {
      rt.ev.push(["z", Math.round(zx), Math.round(zy - 6), Math.round(o.x), Math.round(o.y - 6), 0]);
      hurtMob(S, rt, o, p, 0.6);
    }
  }
}

function castSkill(S, p, i) {
  const sk = SKILLS[p.ch.cls][i];
  const st = stats(p);
  const c = st.arm;
  const rt = S.maps[p.map];
  const m = MAPS[p.map];
  rouse(S, p);
  p.mp -= sk.mp;
  p.cds[i] = S.now + sk.cd;
  if (st.lg.echo && rnd(S) < 0.2) { p.cds[i] = S.now + 400; toast(p, `메아리! [${sk.name}] 재사용 대기 초기화`); }
  p.atkAt = S.now;
  p.dirty = true;
  const ev = (kind, x, y) => rt.ev.push(["a", p.eid, kind, Math.round(x), Math.round(y), p.dir]);
  const aimAt = (range) => {
    const mob = nearestMob(rt, p.x, p.y, range);
    if (mob) face(p, mob);
    return mob;
  };
  /** Jump next to a monster (behind it if `behind`), leaving a trail. */
  const jumpTo = (mob, behind) => {
    const [ux, uy] = aimVec(p, mob);
    const ox = p.x, oy = p.y;
    for (const k of behind ? [14, -14] : [-14, 14]) {
      const nx = mob.x + ux * k, ny = mob.y + uy * k;
      if (canStand(m, nx, ny)) { p.x = nx; p.y = ny; break; }
    }
    p.fix = true;
    p.mvAt = S.now;
    face(p, mob);
    rt.ev.push(["d", p.eid, Math.round(ox), Math.round(oy - 8), Math.round(p.x), Math.round(p.y - 8)]);
  };
  /** Damage that keeps landing on one spot: `n` bursts, `every` ms apart. */
  const zone = (x, y) => {
    rt.zones.push({ x, y, r: sk.r, next: S.now + 350, every: sk.every, left: sk.n, mult: sk.mult, pid: p.pid, kind: sk.id === "meteor" ? 2 : 3 });
    rt.ev.push(["t", Math.round(x), Math.round(y), sk.r, 350 + sk.every * (sk.n - 1), 1]);
  };
  switch (sk.id) {
    case "strike": case "vital": {
      const mob = aimAt(c.range + 8);
      const kind = sk.id === "strike" ? 10 : 18;
      if (mob) {
        ev(kind, mob.x, mob.y - 6);
        if (sk.stun) mob.stun = S.now + sk.stun;
        hurtMob(S, rt, mob, p, sk.mult, sk.id === "vital");
      } else ev(kind, p.x + DX[p.dir] * 14, p.y - 6 + DY[p.dir] * 14);
      break;
    }
    case "spin": case "sweep":
      ev(11, p.x, p.y - 6);
      for (const mob of mobsWithin(rt, p.x, p.y, sk.r)) {
        if (sk.knock) { const [ux, uy] = aimVec(p, mob); knock(m, mob, ux, uy, sk.knock); }
        hurtMob(S, rt, mob, p, sk.mult);
      }
      break;
    case "shout":
      ev(12, p.x, p.y - 6);
      for (const o of members(S, p)) {
        if (o !== p && (o.map !== p.map || o.dead || dist(o.x, o.y, p.x, p.y) > sk.r)) continue;
        o.atkBuff = S.now + sk.dur;
        o.dirty = true;
        if (o !== p) rt.ev.push(["u", o.eid, 2]);
      }
      break;
    case "pierce": case "quake": {
      const [ux, uy] = aimVec(p, aimAt(sk.len));
      ev(sk.id === "quake" ? 23 : 13, p.x + ux * sk.len, p.y - 6 + uy * sk.len);
      for (const o of mobsInLine(rt, p.x, p.y, ux, uy, sk.len, sk.id === "quake" ? 18 : 13)) {
        if (sk.knock) knock(m, o, ux, uy, sk.knock);
        hurtMob(S, rt, o, p, sk.mult);
      }
      break;
    }
    case "dash": {
      const mob = aimAt(sk.len);
      if (!mob) { ev(19, p.x, p.y - 6); break; }
      jumpTo(mob, true);
      ev(18, mob.x, mob.y - 6);
      hurtMob(S, rt, mob, p, sk.mult);
      break;
    }
    case "vault": {
      const mob = aimAt(sk.len);
      if (!mob) { ev(19, p.x, p.y - 6); break; }
      jumpTo(mob, false);
      ev(21, mob.x, mob.y - 6);
      for (const o of mobsWithin(rt, mob.x, mob.y, sk.r)) { o.slow = S.now + 3000; hurtMob(S, rt, o, p, sk.mult); }
      break;
    }
    case "smoke":
      dropAggro(S, p);
      p.spdBuff = S.now + sk.dur;
      ev(20, p.x, p.y - 6);
      break;
    case "fan": {
      const list = mobsWithin(rt, p.x, p.y, sk.r)
        .sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y)).slice(0, sk.n);
      if (list.length) face(p, list[0]);
      ev(24, p.x + DX[p.dir] * 20, p.y - 6 + DY[p.dir] * 20);
      for (const mob of list) {
        rt.ev.push(["z", Math.round(p.x), Math.round(p.y - 8), Math.round(mob.x), Math.round(mob.y - 6), 1]);
        mob.dot = { until: S.now + 4000, next: S.now + 1000, dmg: Math.max(1, Math.round(st.atk * sk.dot)), pid: p.pid };
        hurtMob(S, rt, mob, p, sk.mult);
      }
      break;
    }
    case "fireball": {
      const mob = aimAt(c.range + 10);
      const tx = mob ? mob.x : p.x + DX[p.dir] * 70, ty = mob ? mob.y : p.y + DY[p.dir] * 70;
      ev(15, tx, ty - 6);
      for (const o of mobsWithin(rt, tx, ty, sk.r)) hurtMob(S, rt, o, p, sk.mult);
      break;
    }
    case "rain": case "meteor": {
      const mob = aimAt(110);
      ev(24, mob ? mob.x : p.x + DX[p.dir] * 60, (mob ? mob.y : p.y + DY[p.dir] * 60) - 6);
      zone(mob ? mob.x : p.x + DX[p.dir] * 60, mob ? mob.y : p.y + DY[p.dir] * 60);
      break;
    }
    case "nova":
      ev(16, p.x, p.y - 6);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) { o.slow = S.now + 3000; hurtMob(S, rt, o, p, sk.mult); }
      break;
    case "heal":
      ev(17, p.x, p.y - 6);
      for (const pid of Object.keys(S.players)) {
        const o = S.players[pid];
        if (o.map !== p.map || o.dead || dist(p.x, p.y, o.x, o.y) > sk.r) continue;
        const so = stats(o);
        const amt = Math.round(so.mhp * 0.35);
        o.hp = Math.min(so.mhp, o.hp + amt);
        rt.ev.push(["h", o.eid, -amt, 0, 1]);
      }
      break;
  }
}

// ───────────────────────────── actions ─────────────────────────────

function npcNear(p, role) {
  for (const n of MAPS[p.map].npcs) {
    if (n.role === role && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < 56) return true;
  }
  return false;
}
const bad = (error) => ({ ok: false, error });
const OK = { ok: true };
function enhCost(g) {
  const tier = ITEMS[g.id].tier;
  return { gold: 60 * tier * (g.enh + 1), stone: g.enh < 3 ? 1 : g.enh < 6 ? 2 : 3 };
}
function trainTotal(have, n) {
  let c = 0;
  for (let i = 0; i < n; i++) c += trainCost(have + i);
  return c;
}
function byEid(S, eid) {
  for (const pid of Object.keys(S.players)) if (S.players[pid].eid === eid) return S.players[pid];
  return null;
}

/**
 * The only gate between an untrusted browser and the world. Everything a client
 * could lie about — position, cooldowns, gold, where it is standing — is checked
 * here, before `applyAction` touches anything.
 */
export function validateAction(S, pid, a) {
  const p = S.players[pid];
  if (!p) return bad("캐릭터가 없습니다");
  if (!isObj(a) || typeof a.t !== "string") return bad("잘못된 요청입니다");
  const ch = p.ch;
  const now = S.now;
  switch (a.t) {
    case "respawn": return p.dead ? OK : bad("살아 있습니다");
    case "chat":
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      return OK;
    case "pinv": {
      const o = byEid(S, a.e);
      if (!o || o === p) return bad("대상을 찾을 수 없습니다");
      const party = S.parties[p.party];
      if (party && party.m.length >= PARTY_MAX) return bad("파티가 가득 찼습니다");
      if (o.party) return bad("이미 다른 파티에 속해 있습니다");
      if (o.pinv && now - o.pinv.at < 15000) return bad("상대가 다른 초대에 응답 중입니다");
      return OK;
    }
    case "pacc": {
      const inv = p.pinv;
      const from = inv && now - inv.at < 30000 ? S.players[inv.from] : null;
      if (!from) return bad("유효한 초대가 없습니다");
      if (p.party) return bad("이미 파티에 속해 있습니다");
      const party = S.parties[from.party];
      if (party && party.m.length >= PARTY_MAX) return bad("파티가 가득 찼습니다");
      return OK;
    }
    case "pdec": return OK;
    case "pleave": return p.party ? OK : bad("파티에 속해 있지 않습니다");
    case "gcreate":
      if (ch.guild) return bad("이미 길드에 속해 있습니다");
      if (!validName(a.name)) return bad("길드 이름은 한글·영문·숫자 2~10자로 지어 주세요");
      if (ch.gold < GUILD_COST) return bad(`길드 창설에는 ${GUILD_COST}G가 필요합니다`);
      return OK;
    case "ginv": {
      const o = byEid(S, a.e);
      if (!ch.guild) return bad("길드에 속해 있지 않습니다");
      if (!o || o === p) return bad("대상을 찾을 수 없습니다");
      if (o.ch.guild) return bad("이미 길드에 속해 있습니다");
      if (o.ginv && now - o.ginv.at < 15000) return bad("상대가 다른 초대에 응답 중입니다");
      return OK;
    }
    case "gacc":
      if (ch.guild) return bad("이미 길드에 속해 있습니다");
      return p.ginv && now - p.ginv.at < 30000 ? OK : bad("유효한 초대가 없습니다");
    case "gdec": case "glist": return OK;
    case "gleave": return ch.guild ? OK : bad("길드에 속해 있지 않습니다");
    case "gchat":
      if (!ch.guild) return bad("길드에 속해 있지 않습니다");
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      return OK;
    case "emo":
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= EMOTES) return bad("없는 감정표현");
      return now - p.emoAt < 600 ? bad("잠시 후에") : OK;
  }
  if (p.dead) return bad("쓰러진 상태입니다");
  switch (a.t) {
    case "mv":
      if (!num(a.x) || !num(a.y)) return bad("잘못된 좌표");
      return OK;
    case "atk":
      if (now - p.atkAt < stats(p).acd - 60) return bad("아직 공격할 수 없습니다");
      return OK;
    case "sk": {
      const sk = SKILLS[ch.cls][a.i];
      if (!sk) return bad("없는 스킬");
      if (ch.lvl < sk.lv) return bad(`레벨 ${sk.lv}에 배울 수 있습니다`);
      if (now < p.cds[a.i]) return bad("재사용 대기 중입니다");
      if (p.mp < sk.mp) return bad("MP가 부족합니다");
      return OK;
    }
    case "use": {
      const it = ITEMS[a.id];
      if (!it || !["pot", "food", "camp"].includes(it.type)) return bad("사용할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (it.type === "camp") {
        const rt = S.maps[p.map];
        if (rt.fires.some((f) => dist(f.x, f.y, p.x, p.y) < 40)) return bad("바로 곁에 모닥불이 있습니다");
        if (rt.fires.filter((f) => f.until).length >= FIRE_MAX) return bad("이 지역에는 모닥불이 너무 많습니다");
        return OK;
      }
      if (now < p.potAt) return bad("재사용 대기 중입니다");
      return OK;
    }
    case "eq": {
      const s = ch.inv[a.s];
      if (!s || !isGear(s.id)) return bad("장착할 수 없습니다");
      const it = ITEMS[s.id];
      if (it.cls && it.cls !== ch.cls) return bad("다른 직업의 장비입니다");
      if (ch.lvl < it.req) return bad(`레벨 ${it.req}부터 착용할 수 있습니다`);
      if (a.k !== undefined && !slotsFor(it.type).includes(a.k)) return bad("그 부위에는 착용할 수 없습니다");
      return OK;
    }
    case "uneq":
      if (!SLOTS.includes(a.k)) return bad("잘못된 부위");
      if (!ch.eq[a.k]) return bad("장착한 장비가 없습니다");
      if (ch.inv.length >= INV) return bad("가방이 가득 찼습니다");
      return OK;
    case "rune": {
      const s = ch.inv[a.s];
      if (!s || ITEMS[s.id].type !== "rune") return bad("룬이 아닙니다");
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= g.sk) return bad("빈 홈이 없습니다");
      return OK;
    }
    case "train": {
      if (!TRAIN[a.k]) return bad("잘못된 능력치");
      const n = a.n | 0;
      if (n !== 1 && n !== 10) return bad("잘못된 횟수");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (ch.xp < trainTotal(ch.tr[a.k], n)) return bad("경험치가 부족합니다");
      return OK;
    }
    case "buy": {
      if (!SHOP.includes(a.id)) return bad("팔지 않는 물건입니다");
      const n = a.n | 0;
      if (n < 1 || n > STACK) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      const id = resolveItem(a.id, ch.cls);
      if (ITEMS[id].cls && ITEMS[id].cls !== ch.cls) return bad("다른 직업의 장비입니다");
      if (ch.gold < ITEMS[id].price * n) return bad("골드가 부족합니다");
      if (!canAdd(ch, id, n)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "sell": {
      const s = ch.inv[a.s];
      if (!s) return bad("아이템이 없습니다");
      const n = a.n | 0;
      if (n < 1 || n > (s.n || 1)) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      return OK;
    }
    case "enh": {
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (isJewel(g.id)) return bad("장신구는 강화할 수 없습니다");
      if (g.enh >= 10) return bad("최대 강화 단계입니다");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      const c = enhCost(g);
      if (ch.gold < c.gold) return bad("골드가 부족합니다");
      if (countItem(ch, "stone") < c.stone) return bad("강화석이 부족합니다");
      return OK;
    }
    case "sit": return OK;
    case "fish":
      if (p.fish) return bad("이미 낚시 중입니다");
      if (now - p.hitAt < 3000) return bad("싸우는 중에는 낚시할 수 없습니다");
      if (!waterNear(MAPS[p.map], p)) return bad("물가에서만 낚시할 수 있습니다");
      if (!canAdd(ch, "fish_s", 1)) return bad("가방이 가득 찼습니다");
      return OK;
    case "hook": return p.fish && p.fish.bite && !p.fish.hook ? OK : bad("아직 입질이 없습니다");
    case "reel": return p.fish ? OK : bad("낚시 중이 아닙니다");
    case "cook": {
      const it = ITEMS[a.id];
      if (!it || it.type !== "fish") return bad("요리할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (!fireNear(S.maps[p.map], p)) return bad("모닥불 곁에서만 요리할 수 있습니다");
      if (!canAdd(ch, it.cook, 2) || !canAdd(ch, "burnt", 1)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "salv": {
      const s = ch.inv[a.s];
      if (!s || !isGear(s.id)) return bad("분해할 수 없는 아이템");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      if (!canAdd(ch, "stone", 12)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "bq": {
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      if (a.a === "take") {
        const d = MOBS[a.k];
        if (typeof a.k !== "string" || !d || d.boss || d.chest) return bad("그런 의뢰는 없습니다");
        if (d.lv > ch.lvl + 4) return bad("아직 감당하기 어려운 상대입니다");
        return OK;
      }
      if (a.a === "done") return ch.bq && ch.bq.n >= ch.bq.need ? OK : bad("아직 의뢰를 마치지 못했습니다");
      return bad("잘못된 요청입니다");
    }
    case "quest": {
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      const quest = QUESTS[ch.q.i];
      if (!quest) return bad("모든 의뢰를 마쳤습니다");
      if (a.a === "accept") return ch.q.st === 0 ? OK : bad("이미 진행 중입니다");
      if (a.a === "done") {
        if (ch.q.st !== 1 || ch.q.n < quest.n) return bad("아직 의뢰를 마치지 못했습니다");
        for (const [id, n] of quest.items) if (!canAdd(ch, id, n)) return bad("가방을 비우고 다시 오세요");
        return OK;
      }
      return bad("잘못된 요청입니다");
    }
    default:
      return bad("알 수 없는 행동");
  }
}

export function applyAction(S, pid, a) {
  const p = S.players[pid];
  const ch = p.ch;
  const now = S.now;
  const m = MAPS[p.map];
  switch (a.t) {
    case "mv": {
      const dt = clamp(now - p.mvAt, 0, 600);
      p.mvAt = now;
      const max = (stats(p).spd * dt) / 1000 * 1.6 + 8;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d > max || !canStand(m, a.x, a.y)) { p.fix = true; break; }
      if (d > 1.5) rouse(S, p);
      p.x = a.x; p.y = a.y;
      if (a.d >= 0 && a.d <= 3) p.dir = a.d | 0;
      // stepping anywhere on a gate tile (or brushing its edge) takes you through
      for (const pt of m.portals) {
        if (dist(p.x, p.y - 3, pt.x * T + 8, pt.y * T + 8) < 12) { changeMap(S, p, pt.to, pt.tx * T + 8, pt.ty * T + 10); break; }
      }
      break;
    }
    case "atk": basicAttack(S, p); break;
    case "sk": castSkill(S, p, a.i); break;
    case "use": {
      const it = ITEMS[a.id];
      const st = stats(p);
      takeItem(ch, a.id, 1);
      if (it.type === "camp") {
        S.maps[p.map].fires.push({ id: S.nextId++, x: Math.round(p.x), y: Math.round(p.y) - 14, until: now + FIRE_MS });
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, "모닥불을 피웠습니다. 앉아서(X) 쉬어 가세요.");
        p.dirty = true;
        break;
      }
      if (it.type === "food") {
        p.food = { id: a.id, until: now + it.buff.min * 60000, xp: it.buff.xp, atk: it.buff.atk };
        toast(p, `${it.name}을(를) 먹었습니다. ${it.desc}`);
      }
      p.potAt = now + 900;
      if (it.heal) { p.hp = Math.min(st.mhp, p.hp + it.heal); S.maps[p.map].ev.push(["h", p.eid, -it.heal, 0, 1]); }
      if (it.mana) p.mp = Math.min(st.mmp, p.mp + it.mana);
      S.maps[p.map].ev.push(["u", p.eid, it.heal ? 0 : 1]);
      p.dirty = true;
      break;
    }
    case "eq": {
      const s = ch.inv[a.s];
      // a ring goes where asked, else on the first bare finger
      const fits = slotsFor(ITEMS[s.id].type);
      const k = fits.includes(a.k) ? a.k : fits.find((o) => !ch.eq[o]) || fits[0];
      const old = ch.eq[k];
      ch.eq[k] = s;
      if (old) ch.inv[a.s] = old;
      else ch.inv.splice(a.s, 1);
      afterGear(S, p);
      break;
    }
    case "uneq":
      ch.inv.push(ch.eq[a.k]);
      ch.eq[a.k] = null;
      afterGear(S, p);
      break;
    case "rune": {
      const g = ch.eq[a.k];
      const key = ITEMS[ch.inv[a.s].id].rune;
      takeItem(ch, `ru_${key}`, 1);
      while (g.ru.length < g.sk) g.ru.push(null);
      g.ru[a.i] = key;
      const rw = runeword(g);
      toast(p, rw ? `룬어 [${rw.name}] 완성!` : `${RUNES[key][0]} 룬을 끼웠습니다.`);
      if (rw) sys(S, `${ch.name}님이 룬어 [${rw.name}]을(를) 완성했습니다!`);
      S.maps[p.map].ev.push(["e", p.eid, 1]);
      afterGear(S, p);
      break;
    }
    case "train": {
      const n = a.n | 0;
      ch.xp -= trainTotal(ch.tr[a.k], n);
      ch.tr[a.k] += n;
      p.stc = null;
      p.dirty = true;
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `${TRAIN[a.k].name} +${n} (누적 ${ch.tr[a.k]})`);
      break;
    }
    case "buy": {
      const id = resolveItem(a.id, ch.cls);
      const n = a.n | 0;
      ch.gold -= ITEMS[id].price * n;
      addItem(ch, id, n);
      p.gain.push(["item", id, n, 0]);
      p.dirty = true;
      break;
    }
    case "sell": {
      const s = ch.inv[a.s];
      const n = a.n | 0;
      const each = sellPrice(s);
      ch.gold += each * n;
      if (isGear(s.id) || s.n <= n) ch.inv.splice(a.s, 1);
      else s.n -= n;
      p.gain.push(["gold", each * n]);
      p.dirty = true;
      break;
    }
    case "enh": {
      const g = ch.eq[a.k];
      const c = enhCost(g);
      ch.gold -= c.gold;
      takeItem(ch, "stone", c.stone);
      const win = rnd(S) * 100 < ENH_RATE[g.enh];
      if (win) {
        g.enh++;
        toast(p, `강화 성공! ${gearName(g)}`);
        if (g.enh >= 7) sys(S, `${ch.name}님이 ${gearName(g)} 강화에 성공했습니다!`);
      } else if (g.enh >= 5) {
        g.enh--;
        toast(p, `강화 실패... ${gearName(g)}(으)로 단계가 내려갔습니다.`);
      } else {
        toast(p, "강화 실패... 장비는 무사합니다.");
      }
      S.maps[p.map].ev.push(["e", p.eid, win ? 1 : 0]);
      afterGear(S, p);
      break;
    }
    case "sit":
      if (p.sit) p.sit = false;
      else { rouse(S, p); p.sit = true; p.warmT = 0; }
      break;
    case "fish": {
      rouse(S, p);
      const [wx, wy] = waterNear(m, p);
      p.fish = { at: now + 2500 + rnd(S) * 4500, bite: 0 };
      p.dir = dirOf(wx - p.x, wy - p.y);
      S.maps[p.map].ev.push(["f", p.eid, 1, wx, wy]);
      break;
    }
    case "hook":
      // the fish is on: the angler now plays it in, and reports how well that went
      p.fish.hook = now;
      S.maps[p.map].ev.push(["f", p.eid, 3]);
      break;
    case "reel": {
      const { bite, hook } = p.fish;
      p.fish = null;
      S.maps[p.map].ev.push(["f", p.eid, 0]);
      if (!bite) { toast(p, "너무 일찍 당겼습니다…"); break; }
      // how well the fish was played (0–100) decides what comes out of the water;
      // a fight that ended implausibly fast counts for little
      let score = hook ? clamp(a.s | 0, 0, 100) : 30;
      if (hook && now - hook < 2500) score = Math.min(score, 40);
      if (score < 30) { toast(p, "물고기가 줄을 끊고 달아났습니다."); break; }
      const k = score / 100, r = rnd(S);
      const gold = 0.01 + 0.07 * k * k, trout = 0.1 + 0.3 * k;
      const id = r < gold ? "fish_l" : r < gold + trout ? "fish_m" : r < gold + trout + 0.04 ? "stone" : "fish_s";
      if (score >= 95) toast(p, "완벽한 낚시!");
      if (addItem(ch, id, 1)) p.gain.push(["item", id, 1, id === "fish_l" ? 3 : id === "fish_m" ? 1 : 0]);
      ch.fish++;
      if (id === "fish_l") sys(S, `${ch.name}님이 [황금 잉어]를 낚았습니다!`);
      p.dirty = true;
      break;
    }
    case "cook": {
      const it = ITEMS[a.id];
      takeItem(ch, a.id, 1);
      // how neatly the pan was packed (0–100): a mess burns, a perfect fit feeds two
      const score = clamp(a.s | 0, 0, 100);
      const out = score < 35 ? "burnt" : it.cook, n = score >= 85 ? 2 : 1;
      addItem(ch, out, n);
      p.gain.push(["item", out, n, 0]);
      toast(p, score < 35 ? "태워 버렸습니다…" : score >= 85 ? `완벽한 요리! ${ITEMS[out].name} 2개` : `${ITEMS[out].name} 완성`);
      S.maps[p.map].ev.push(["u", p.eid, 0]);
      p.dirty = true;
      break;
    }
    case "salv": {
      const s = ch.inv[a.s];
      ch.inv.splice(a.s, 1);
      // better pieces break down into more stones; enhancement gives some back
      const n = [rnd(S) < 0.35 ? 1 : 0, 1, 2, 5, 5][s.q | 0] + Math.floor((s.enh | 0) / 2);
      if (n > 0) { addItem(ch, "stone", n); p.gain.push(["item", "stone", n, 0]); }
      toast(p, n > 0 ? `${gearName(s)} 분해 — 강화석 ${n}개` : `${gearName(s)} 분해 — 건진 것이 없습니다`);
      p.dirty = true;
      break;
    }
    case "bq": {
      if (a.a === "take") {
        ch.bq = { k: a.k, n: 0, need: BOUNTY_N };
        toast(p, `반복 의뢰 수락: ${MOBS[a.k].name} ${BOUNTY_N}마리`);
      } else {
        const d = MOBS[ch.bq.k];
        const gold = Math.round(((d.gold[0] + d.gold[1]) / 2) * ch.bq.need * 0.8);
        ch.gold += gold;
        p.gain.push(["gold", gold]);
        ch.bn++;
        // every third report earns a stone, every tenth a rune
        if (ch.bn % 3 === 0 && addItem(ch, "stone", 1)) p.gain.push(["item", "stone", 1, 0]);
        if (ch.bn % 10 === 0) {
          const id = `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`;
          if (addItem(ch, id, 1)) p.gain.push(["item", id, 1, 0]);
        }
        toast(p, `반복 의뢰 완료 (${ch.bn}회째) — 같은 의뢰가 다시 시작됩니다.`);
        const xp = Math.round(d.xp * ch.bq.need * 0.5);
        ch.bq = { k: ch.bq.k, n: 0, need: BOUNTY_N };
        gainXp(S, p, xp);
      }
      p.dirty = true;
      break;
    }
    case "quest": {
      const quest = QUESTS[ch.q.i];
      if (a.a === "accept") {
        ch.q.st = 1; ch.q.n = 0;
        toast(p, `의뢰 수락: ${quest.title}`);
      } else {
        ch.gold += quest.gold;
        p.gain.push(["gold", quest.gold]);
        for (const [id, n] of quest.items) { addItem(ch, id, n); p.gain.push(["item", id, n, 0]); }
        ch.q = { i: ch.q.i + 1, n: 0, st: 0 };
        toast(p, `의뢰 완료: ${quest.title}`);
        gainXp(S, p, quest.xp);
      }
      p.dirty = true;
      break;
    }
    case "respawn": {
      const lost = Math.floor(Math.min(ch.xp, xpNeed(ch.lvl)) * 0.03);
      ch.xp -= lost;
      p.dead = false;
      changeMap(S, p, START.map, START.x, START.y);
      const st = stats(p);
      p.hp = st.mhp; p.mp = st.mmp;
      p.dirty = true;
      toast(p, lost > 0 ? `광장에서 깨어났습니다. (경험치 -${lost})` : "광장에서 깨어났습니다.");
      break;
    }
    case "chat": {
      const text = a.m.trim().slice(0, 80);
      p.chatAt = now;
      S.chat.push({ n: ch.name, m: text });
      S.maps[p.map].ev.push(["s", p.eid, text]);
      break;
    }
    case "pinv": {
      const o = byEid(S, a.e);
      o.pinv = { from: pid, at: now };
      toast(p, `${o.ch.name}님을 파티에 초대했습니다.`);
      break;
    }
    case "pacc": {
      const from = S.players[p.pinv.from];
      p.pinv = null;
      let party = S.parties[from.party];
      if (!party) {
        party = { id: S.nextId++, m: [from.pid] };
        S.parties[party.id] = party;
        from.party = party.id;
      }
      party.m.push(pid);
      p.party = party.id;
      for (const o of members(S, p)) { toast(o, `${ch.name}님이 파티에 참가했습니다.`); S.maps[o.map].who = true; }
      break;
    }
    case "pdec": p.pinv = null; break;
    case "gcreate":
      ch.gold -= GUILD_COST;
      ch.guild = a.name; ch.gm = 1;
      sys(S, `${ch.name}님이 길드 [${a.name}]을(를) 세웠습니다!`);
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "ginv": {
      const o = byEid(S, a.e);
      o.ginv = { from: pid, g: ch.guild, at: now };
      toast(p, `${o.ch.name}님을 길드에 초대했습니다.`);
      break;
    }
    case "gacc": {
      ch.guild = p.ginv.g; ch.gm = 0;
      p.ginv = null;
      for (const oid of Object.keys(S.players)) {
        const o = S.players[oid];
        if (o.ch.guild === ch.guild) { toast(o, `${ch.name}님이 길드 [${ch.guild}]에 들어왔습니다.`); o.dirty = true; }
      }
      S.maps[p.map].who = true;
      break;
    }
    case "gdec": p.ginv = null; break;
    case "glist": p.dirty = true; break;
    case "gleave":
      toast(p, `길드 [${ch.guild}]을(를) 떠났습니다.`);
      ch.guild = ""; ch.gm = 0;
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "gchat":
      p.chatAt = now;
      S.chat.push({ n: ch.name, m: a.m.trim().slice(0, 80), g: ch.guild });
      break;
    case "emo":
      p.emoAt = now;
      S.maps[p.map].ev.push(["o", p.eid, a.i]);
      break;
    case "pleave":
      leaveParty(S, p);
      toast(p, "파티를 떠났습니다.");
      break;
  }
  return S;
}

function afterGear(S, p) {
  p.stc = null;
  const st = stats(p);
  p.hp = Math.min(p.hp, st.mhp);
  p.mp = Math.min(p.mp, st.mmp);
  p.dirty = true;
  S.maps[p.map].who = true;
}

// ───────────────────────────── simulation ─────────────────────────────

function stepMob(m, mob, tx, ty, speed, dt, fly) {
  const d = dist(mob.x, mob.y, tx, ty);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = mob.x + ((tx - mob.x) / d) * step;
  const ny = mob.y + ((ty - mob.y) / d) * step;
  const ok = fly ? canFly : canStand;
  if (ok(m, nx, ny)) { mob.x = nx; mob.y = ny; }
  else if (ok(m, nx, mob.y)) mob.x = nx;
  else if (ok(m, mob.x, ny)) mob.y = ny;
  else return true;
  if (Math.abs(tx - mob.x) > 2) mob.dir = tx < mob.x ? 1 : 2;
  return d - step < 1;
}

function tickMob(S, m, rt, mob, dt) {
  const d = MOBS[mob.k];
  const now = S.now;
  if (mob.dead) {
    if (!mob.temp && now >= mob.respAt) { placeMob(S, m, mob); rt.ev.push(["r", mob.id]); }
    return;
  }
  if (mob.dot) {
    // poison keeps biting once a second
    const dot = mob.dot;
    if (now >= dot.until) mob.dot = null;
    else if (now >= dot.next) {
      dot.next = now + 1000;
      const o = S.players[dot.pid];
      if (o && o.map === m.id && dealMob(S, rt, mob, o, dot.dmg, 0)) return;
    }
  }
  if (mob.stun > now || d.still) return;
  const speed = d.spd * (mob.slow > now ? 0.5 : 1);
  const atk = d.atk * ELITE[mob.el].atk;
  let tgt = mob.tgt ? S.players[mob.tgt] : null;
  const leash = Math.max(150, d.aggro * 2.4);
  if (tgt && (tgt.map !== m.id || tgt.dead || dist(mob.x, mob.y, mob.hx, mob.hy) > leash + 60 || dist(mob.x, mob.y, tgt.x, tgt.y) > leash)) {
    tgt = null; mob.tgt = null; mob.st = 2; mob.by = {};
  }
  if (!tgt && d.aggro > 0 && mob.st !== 2) {
    let bd = d.aggro;
    for (const pid of Object.keys(S.players)) {
      const p = S.players[pid];
      if (p.map !== m.id || p.dead) continue;
      const dd = dist(mob.x, mob.y, p.x, p.y);
      if (dd < bd) { bd = dd; tgt = p; }
    }
    if (tgt) mob.tgt = tgt.pid;
  }
  if (tgt) {
    const dd = dist(mob.x, mob.y, tgt.x, tgt.y);
    if (d.leap && now >= mob.castAt && dd > d.range + 16 && dd < d.leap) {
      // pounce: land beside the target in one bound
      mob.castAt = now + 4500;
      const nx = tgt.x - ((tgt.x - mob.x) / dd) * 14, ny = tgt.y - ((tgt.y - mob.y) / dd) * 14;
      if (canStand(m, nx, ny)) { mob.x = nx; mob.y = ny; mob.atkAt = Math.max(mob.atkAt, now + 350); }
    }
    if (d.slam && mob.el < 2 && now >= mob.castAt && dd < 70) {
      // pound the ground: a ring to step out of
      mob.castAt = now + 6000;
      rt.tele.push({ x: mob.x, y: mob.y, r: d.slam, at: now + 1100, dmg: atk * 1.5 });
      rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), d.slam, 1100]);
    }
    if ((d.boss || mob.el === 2) && now >= mob.castAt) {
      mob.castAt = now + 6500;
      // one blast on every player in the fight: stand still and the whole party pays
      for (const pid of Object.keys(S.players)) {
        const o = S.players[pid];
        if (o.map !== m.id || o.dead || dist(mob.x, mob.y, o.x, o.y) > 220) continue;
        const r = d.boss ? 40 : 32;
        rt.tele.push({ x: o.x, y: o.y, r, at: now + 1300, dmg: atk * (d.boss ? 1.7 : 1.3) });
        rt.ev.push(["t", Math.round(o.x), Math.round(o.y), r, 1300]);
      }
    }
    if (dd <= d.range) {
      if (now >= mob.atkAt) {
        mob.atkAt = now + d.cd;
        mob.dir = tgt.x < mob.x ? 1 : 2;
        rt.ev.push(d.shot ? ["m", mob.id, Math.round(tgt.x), Math.round(tgt.y - 8)] : ["m", mob.id]);
        hurtPlayer(S, rt, tgt, atk, mob);
      }
    } else stepMob(m, mob, tgt.x, tgt.y, speed, dt, d.fly);
    return;
  }
  if (mob.st === 2) {
    const max = mobMax(mob);
    mob.hp = Math.min(max, mob.hp + max * 0.2 * dt);
    if (stepMob(m, mob, mob.hx, mob.hy, speed * 1.4, dt, d.fly)) { mob.st = 0; mob.hp = max; }
    return;
  }
  if (now >= mob.mvAt) {
    mob.mvAt = now + 1500 + rnd(S) * 3500;
    mob.wx = mob.hx + (rnd(S) - 0.5) * 70;
    mob.wy = mob.hy + (rnd(S) - 0.5) * 70;
  }
  stepMob(m, mob, mob.wx, mob.wy, speed * 0.5, dt, d.fly);
}

/** Advance the world to `now`. Maps nobody is standing in are frozen. */
export function tick(S, now) {
  const dt = clamp(now - (S.last || now), 0, 300) / 1000;
  S.last = now;
  S.now = now;
  const pids = Object.keys(S.players);
  for (const id of Object.keys(MAPS)) {
    const rt = S.maps[id];
    if (rt.n <= 0) continue;
    const m = MAPS[id];
    for (const mob of rt.mobs) tickMob(S, m, rt, mob, dt);
    for (let i = rt.mobs.length - 1; i >= 0; i--) if (rt.mobs[i].temp && rt.mobs[i].dead) rt.mobs.splice(i, 1);
    for (let i = rt.zones.length - 1; i >= 0; i--) {
      const z = rt.zones[i];
      if (now < z.next) continue;
      const p = S.players[z.pid];
      if (!p || p.map !== id) { rt.zones.splice(i, 1); continue; }
      z.next = now + z.every;
      rt.ev.push(["b", Math.round(z.x), Math.round(z.y), z.r, z.kind]);
      for (const o of mobsWithin(rt, z.x, z.y, z.r)) hurtMob(S, rt, o, p, z.mult);
      if (--z.left <= 0) rt.zones.splice(i, 1);
    }
    for (let i = rt.tele.length - 1; i >= 0; i--) {
      const t = rt.tele[i];
      if (now < t.at) continue;
      rt.tele.splice(i, 1);
      rt.ev.push(["b", Math.round(t.x), Math.round(t.y), t.r]);
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map === id && !p.dead && dist(p.x, p.y, t.x, t.y) <= t.r) hurtPlayer(S, rt, p, t.dmg);
      }
    }
    for (let i = rt.fires.length - 1; i >= 0; i--) if (rt.fires[i].until && now >= rt.fires[i].until) rt.fires.splice(i, 1);
    for (let i = rt.drops.length - 1; i >= 0; i--) {
      const dr = rt.drops[i];
      if (now >= dr.dieAt) { rt.drops.splice(i, 1); continue; }
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead) continue;
        if (dr.own !== pid && now < dr.freeAt) continue;
        if (dist(p.x, p.y, dr.x, dr.y) > 15) continue;
        if (dr.it === "gold") {
          p.ch.gold += dr.n;
          p.gain.push(["gold", dr.n]);
        } else if (dr.g) {
          if (p.ch.inv.length >= INV) { if (now > p.fullAt) { p.fullAt = now + 3000; toast(p, "가방이 가득 찼습니다."); } continue; }
          p.ch.inv.push(dr.g);
          p.gain.push(["item", dr.it, 1, dr.q]);
          if (dr.q >= 3) sys(S, `${p.ch.name}님이 ${RARITY[dr.q]} 장비 [${gearName(dr.g)}]을(를) 획득했습니다!`);
        } else if (addItem(p.ch, dr.it, dr.n)) {
          p.gain.push(["item", dr.it, dr.n, 0]);
        } else {
          if (now > p.fullAt) { p.fullAt = now + 3000; toast(p, "가방이 가득 찼습니다."); }
          continue;
        }
        p.dirty = true;
        rt.drops.splice(i, 1);
        break;
      }
    }
  }
  for (const pid of pids) {
    const p = S.players[pid];
    if (p.pinv && now - p.pinv.at > 30000) p.pinv = null;
    if (p.ginv && now - p.ginv.at > 30000) p.ginv = null;
    if (p.fish) {
      // a bite, then a short moment to reel it in
      const rt = S.maps[p.map];
      if (!p.fish.bite && now >= p.fish.at) { p.fish.bite = now; rt.ev.push(["f", p.eid, 2]); }
      else if ((p.fish.bite && !p.fish.hook && now > p.fish.bite + 1800) || (p.fish.hook && now > p.fish.hook + 25000)) { p.fish = null; rt.ev.push(["f", p.eid, 0]); toast(p, "물고기가 달아났습니다."); }
    }
    if (p.dead || now - p.regenAt < 1000) continue;
    p.regenAt = now;
    const st = stats(p);
    const calm = now - p.hitAt > 5000;
    // a campfire is a place to catch your breath; sitting by it is better still
    const fire = calm ? fireNear(S.maps[p.map], p) : null;
    const rest = fire ? (p.sit ? 0.12 : 0.06) : MAPS[p.map].safe ? 0.08 : 0.02;
    if (calm && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + st.mhp * rest + 1);
    if (p.mp < st.mmp) p.mp = Math.min(st.mmp, p.mp + st.mmp * (fire ? rest : 0.03) + 1);
    if (fire && p.sit) {
      if (++p.warmT >= WARM_SEC) {
        let friends = 0;
        for (const oid of pids) { const o = S.players[oid]; if (o !== p && o.map === p.map && o.sit && dist(o.x, o.y, fire.x, fire.y) <= FIRE_R) friends++; }
        const pct = Math.min(20, 10 + friends * 2);
        const had = p.warm > now ? p.warmPct : 0;
        if (pct > had) toast(p, `모닥불의 온기 — 10분간 경험치 +${pct}%${friends ? ` (함께 쉬는 동료 ${friends}명)` : ""}`);
        p.warm = now + WARM_MS; p.warmPct = Math.max(had, pct);
        p.warmT = 0;
        p.dirty = true;
      }
    } else p.warmT = 0;
  }
  return S;
}

/** Call once every player's view for this tick has been taken. */
export function endTick(S) {
  for (const id of Object.keys(S.maps)) {
    const rt = S.maps[id];
    rt.ev.length = 0;
    rt.who = false;
  }
  S.chat.length = 0;
}

export function isGameOver() {
  return { over: false };
}

function selfPayload(p) {
  const ch = p.ch;
  const st = stats(p);
  const now = p.S.now;
  const trc = {};
  for (const k of Object.keys(TRAIN)) trc[k] = [trainCost(ch.tr[k]), trainTotal(ch.tr[k], 10)];
  const enh = {};
  for (const k of SLOTS) enh[k] = ch.eq[k] && !isJewel(ch.eq[k].id) ? enhCost(ch.eq[k]) : null;
  return {
    name: ch.name, cls: ch.cls, lvl: ch.lvl, xp: ch.xp, need: ch.lvl >= MAXLV ? 0 : xpNeed(ch.lvl), gold: ch.gold,
    mhp: st.mhp, mmp: st.mmp, atk: st.atk, def: st.def, crit: st.crit, critd: Math.round(st.critd * 100), ls: st.ls, xpb: st.xp, mf: st.mf, spd: st.spd0,
    goldb: st.gold, lg: Object.keys(st.lg), wk: weaponKind(ch), acd: st.acd, range: st.arm.range,
    inv: ch.inv, eq: ch.eq, q: ch.q, kills: ch.kills || 0, tr: ch.tr, trc, enh,
    bq: ch.bq, bn: ch.bn, mk: ch.mk, streak: [p.streak, Math.max(0, STREAK_MS - (now - p.streakAt))],
    cds: p.cds.map((t) => Math.max(0, t - now)),
    buffs: [Math.max(0, p.atkBuff - now), Math.max(0, p.spdBuff - now), Math.max(0, p.warm - now), p.food ? Math.max(0, p.food.until - now) : 0],
    warm: p.warmPct, food: p.food ? p.food.id : null, guild: ch.guild, gm: ch.gm, fishN: ch.fish,
    gmates: ch.guild ? Object.keys(p.S.players).map((id) => p.S.players[id]).filter((o) => o.ch.guild === ch.guild).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, MAPS[o.map].name, o.ch.gm]) : [],
  };
}

/**
 * One player's slice of the world for this tick: only their map, only what is
 * near them, and their own sheet only when it changed.
 */
export function viewFor(S, pid) {
  const p = S.players[pid];
  if (!p) return null;
  const rt = S.maps[p.map];
  const near = (o) => Math.abs(o.x - p.x) < VIEW_X && Math.abs(o.y - p.y) < VIEW_Y;
  const out = {
    type: "snap",
    me: [Math.round(p.x), Math.round(p.y), Math.round(p.hp), Math.round(p.mp), p.dead ? 1 : 0, p.fix ? 1 : 0, p.dir, p.sit ? 1 : 0],
    P: [], M: [], D: [], F: [],
  };
  for (const oid of Object.keys(S.players)) {
    const o = S.players[oid];
    if (o === p || o.map !== p.map || !near(o)) continue;
    out.P.push([o.eid, Math.round(o.x), Math.round(o.y), o.dir, o.dead ? 1 : 0, Math.round(o.hp), stats(o).mhp, o.sit ? 1 : 0]);
  }
  for (const mob of rt.mobs) {
    if (mob.dead || !near(mob)) continue;
    out.M.push([mob.id, mob.k, Math.round(mob.x), Math.round(mob.y), mob.dir, Math.ceil(mob.hp), mob.el]);
  }
  for (const dr of rt.drops) {
    if (near(dr) && (dr.own === pid || S.now >= dr.freeAt)) out.D.push([dr.id, dr.it, Math.round(dr.x), Math.round(dr.y), dr.q]);
  }
  for (const f of rt.fires) if (near(f)) out.F.push([f.id, f.x, f.y]);
  if (rt.ev.length) out.ev = rt.ev;
  // guild chat reaches only the guild
  if (S.chat.length) { const chat = S.chat.filter((c) => !c.g || c.g === p.ch.guild); if (chat.length) out.chat = chat; }
  if (p.sendMap) out.map = mapPayload(MAPS[p.map]);
  if (p.sendMap || rt.who) {
    out.who = [];
    for (const oid of Object.keys(S.players)) {
      const o = S.players[oid];
      if (o.map !== p.map) continue;
      // what everyone can see of this player: look, party, and the weapon in hand
      // (its tier, rarity, enhancement and kind)
      const ar = o.ch.eq.armor, wp = o.ch.eq.weapon;
      out.who.push([o.eid, o.ch.name, o.ch.cls, o.ch.lvl, o.ch.look, ar ? ITEMS[ar.id].tier : 0, wp ? ITEMS[wp.id].tier : 0, o.party,
        wp ? wp.q : 0, wp ? wp.enh : 0, 0, weaponKind(o.ch), o.ch.guild]);
    }
  }
  if (p.party) {
    out.party = members(S, p).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, Math.round(o.hp), stats(o).mhp, o.map === p.map ? "" : MAPS[o.map].name]);
  }
  if (p.pinv) {
    const from = S.players[p.pinv.from];
    if (from) out.pinv = from.ch.name;
  }
  if (p.ginv) {
    const from = S.players[p.ginv.from];
    if (from) out.ginv = [from.ch.name, p.ginv.g];
  }
  if (p.dirty) out.self = selfPayload(p);
  if (p.gain.length) out.gain = p.gain;
  if (p.toast.length) out.toast = p.toast;
  p.sendMap = false; p.fix = false; p.dirty = false; p.gain = []; p.toast = [];
  return out;
}

/** Static tables the browser needs to draw windows and tooltips. Sent once. */
export function defs() {
  const mobs = {};
  for (const k of Object.keys(MOBS)) {
    const d = MOBS[k];
    mobs[k] = { name: d.name, sp: d.sp, lv: d.lv, hp: d.hp, boss: d.boss ? 1 : 0, chest: d.chest ? 1 : 0, xp: d.xp };
  }
  const classes = {};
  for (const k of Object.keys(CLASSES)) {
    const arm = WKIND[CLASSES[k].wk[0]];
    classes[k] = { name: CLASSES[k].name, arm: CLASSES[k].arm, wk: CLASSES[k].wk, cd: arm.cd, range: arm.range };
  }
  const affix = {};
  for (const [k, label, prefix] of AFFIX) affix[k] = [label, prefix];
  return {
    items: ITEMS, mobs, classes, skills: SKILLS, shop: SHOP, quests: QUESTS, enh: ENH_RATE, inv: INV, maxLv: MAXLV,
    affix, runes: RUNES, runewords: RUNEWORDS, rarity: RARITY, train: TRAIN, eliteHp: ELITE.map((e) => e.hp), partyMax: PARTY_MAX,
    slots: SLOTS, wkinds: WKIND, legend: LEGEND, sets: SETS, mastery: MASTERY, bounty: BOUNTY_N, fbKills: FB_KILLS,
    streak: [STREAK_MS, STREAK_MAX], guildCost: GUILD_COST, guildXp: GUILD_XP, fireR: FIRE_R, emotes: EMOTES, maps: Object.keys(MAPS).map((id) => ({ id, name: MAPS[id].name, mobs: [...new Set(MAPS[id].spawns.map((sp) => sp.k))] })),
  };
}
