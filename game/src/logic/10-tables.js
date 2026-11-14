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
  // red potions heal a fixed amount plus a share of the drinker's health, so they keep their worth as monsters hit harder
  hp_s: { name: "빨간 물약", type: "pot", heal: 60, pct: 0.1, price: 20, desc: "HP를 60 + 최대 HP의 10% 회복한다." },
  hp_m: { name: "큰 빨간 물약", type: "pot", heal: 220, pct: 0.18, price: 70, desc: "HP를 220 + 최대 HP의 18% 회복한다." },
  hp_l: { name: "농축 빨간 물약", type: "pot", heal: 480, pct: 0.24, price: 150, desc: "HP를 480 + 최대 HP의 24% 회복한다." },
  mp_s: { name: "파란 물약", type: "pot", mana: 40, price: 25, desc: "MP를 40 회복한다." },
  mp_m: { name: "큰 파란 물약", type: "pot", mana: 140, price: 80, desc: "MP를 140 회복한다." },
  mp_l: { name: "농축 파란 물약", type: "pot", mana: 340, price: 170, desc: "MP를 340 회복한다." },
  stone: { name: "강화석", type: "mat", price: 150, desc: "대장장이에게 가져가면 장비를 강화할 수 있다." },
  recall: { name: "귀환 주문서", type: "scroll", price: 60, desc: "2초 동안 읽으면 넥서스 광장으로 돌아간다. 움직이거나 피해를 입으면 취소된다." },
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
/**
 * Skill growth, as at a 바람의나라 수련장 or with a 메이플 마스터리북: every skill
 * is raised from 1 to 10 at the trainer for gold and experience. Each level adds
 * SK_STEP to what it does; at 5 and at 10 its cooldown shortens.
 */
const SK_MAX = 10, SK_STEP = 0.08;
const skillCost = (sk, L) => ({ gold: Math.round((50 + sk.lv * 25) * L * (L + 1) / 2), xp: Math.round(xpNeed(sk.lv) * 0.12 * L), lvl: sk.lv + L });
const skillCd = (L) => (L >= 10 ? 0.85 : L >= 5 ? 0.92 : 1);
/** A skill as a character of their skill level casts it. */
function levelled(ch, i) {
  const sk = SKILLS[ch.cls][i], L = (ch.skl && ch.skl[i]) || 1;
  if (L <= 1) return sk;
  const o = { ...sk };
  if (sk.mult) o.mult = sk.mult * (1 + SK_STEP * (L - 1));
  if (sk.ret) o.ret = sk.ret * (1 + SK_STEP * (L - 1));
  if (sk.pct) o.pct = sk.pct + 0.015 * (L - 1);
  if (sk.durUp) o.dur = sk.dur + sk.durUp * (L - 1);
  o.cd = Math.round(sk.cd * skillCd(L));
  return o;
}
/** A warehouse (창고) holds this many slots per character, besides gold. */
const WH = 60;
/** The loot filter: the least rarity of gear a label is shown for and a pet fetches. */
const FILTER_Q = [0, 1, 2];
/** How often a pet runs for something. */
const PET_MS = 300;

const SHOP = ["hp_s", "hp_m", "hp_l", "mp_s", "mp_m", "mp_l", "recall", "camp", "stone", "feather", "sc_atk", "sc_def", "sc_xp", "pet_chick", "pet_bat", "pet_wisp", "W1", "w_book_1", "h_1", "a_1", "g_1", "b_1"];
const ENH_RATE = [100, 95, 90, 80, 70, 55, 45, 35, 25, 15];

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
/** After this many kills in a hunting ground, its field boss appears. */
const FB_KILLS = 60;
/** The monster a hunting ground's kills call out, by map. */
const FIELD_BOSS = { meadow: "lambmaw", forest: "ribdeer", crypt: "toadbrood", city: "doghead", sewer: "crabskull", cave: "moleworm", abyss: "lionhand", maple: "rotstag" };

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
const MOVES = ["charge", "leap", "slam", "pool", "fan"];
/** Hunting grounds hold this many times the monsters their layout asks for; each one drops gear this much less often and hits this much harder. */
/** Walkable tiles per monster on each hunting ground: open fields roomy, dungeon halls packed. */
const DENSITY = { meadow: 12.6, forest: 12.2, crypt: 5.6, city: 10.6, sewer: 6.2, cave: 9.5, abyss: 7, maple: 11.8 };
const CROWD_MAX = 228, GEAR_CUT = 0.3, MOB_ATK = 1.27;
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
  // 바람초원
  twinhare: { name: "쌍두 토끼", lv: 1, hp: 28, atk: 5, def: 0, spd: 26, xp: 9, gold: [2, 6], aggro: 0, range: 16, cd: 1300 },
  gutfrog: { name: "창자 개구리", lv: 3, hp: 60, atk: 9, def: 1, spd: 24, xp: 18, gold: [4, 10], aggro: 0, range: 16, cd: 1300, leap: 80 },
  eyecrow: { name: "눈알 까마귀", lv: 5, hp: 82, atk: 13, def: 0, spd: 34, xp: 30, gold: [6, 14], aggro: 0, range: 17, cd: 1200, fly: true },   // circles the pond and minds its own business, so the shore stays a fishing spot
  lambmaw: { name: "뒤집힌 양", lv: 6, hp: 110, atk: 15, def: 1, spd: 38, xp: 38, gold: [7, 16], aggro: 72, range: 18, cd: 1300, charge: 110 },
  // 속삭임 숲
  splitboar: { name: "반쪽 멧돼지", lv: 8, hp: 170, atk: 23, def: 2, spd: 44, xp: 60, gold: [10, 22], aggro: 80, range: 18, cd: 1100, charge: 104 },
  ribdeer: { name: "갈비뼈 사슴", lv: 10, hp: 330, atk: 26, def: 8, spd: 26, xp: 92, gold: [12, 26], aggro: 64, range: 18, cd: 1400, slam: 34 },
  hydrasnake: { name: "세 머리 뱀", lv: 11, hp: 200, atk: 29, def: 2, spd: 36, xp: 96, gold: [12, 26], aggro: 92, range: 64, cd: 1700, volley: true },
  foxtwine: { name: "꼬인 여우", lv: 12, hp: 230, atk: 28, def: 3, spd: 62, xp: 108, gold: [13, 28], aggro: 96, range: 17, cd: 800, leap: 90 },
  mothface: { name: "인면 나방", lv: 13, hp: 210, atk: 34, def: 2, spd: 44, xp: 118, gold: [14, 30], aggro: 96, range: 72, cd: 1400, fly: true, shot: true, pool: 22 },
  // 뼈의 지하묘지
  ratking: { name: "쥐 왕", lv: 12, hp: 260, atk: 29, def: 4, spd: 46, xp: 108, gold: [14, 28], aggro: 86, range: 17, cd: 850 },
  twinhare_bone: { name: "해골 쌍두 토끼", sp: "twinhare", tint: "bone", lv: 13, hp: 240, atk: 33, def: 3, spd: 56, xp: 112, gold: [13, 28], aggro: 90, range: 16, cd: 900 },
  bonehound: { name: "가죽 벗겨진 사냥개", lv: 14, hp: 300, atk: 40, def: 5, spd: 58, xp: 140, gold: [18, 36], aggro: 100, range: 18, cd: 1000, leap: 100 },
  toadbrood: { name: "알 밴 두꺼비", lv: 15, hp: 420, atk: 42, def: 8, spd: 28, xp: 160, gold: [20, 40], aggro: 86, range: 20, cd: 1500, pool: 26 },
  batcluster: { name: "박쥐 덩어리", lv: 16, hp: 360, atk: 46, def: 4, spd: 52, xp: 178, gold: [22, 44], aggro: 96, range: 17, cd: 1100, fly: true, burst: 32 },
  // 네온 시티
  pigeonmass: { name: "비둘기 떼살", lv: 14, hp: 290, atk: 40, def: 5, spd: 56, xp: 140, gold: [18, 36], aggro: 100, range: 70, cd: 1300, fly: true, shot: true },
  gutfrog_poison: { name: "맹독 창자 개구리", sp: "gutfrog", tint: "poison", lv: 16, hp: 400, atk: 46, def: 5, spd: 32, xp: 180, gold: [22, 44], aggro: 84, range: 17, cd: 1200, leap: 84, pool: 22 },
  doghead: { name: "세 머리 들개", lv: 17, hp: 460, atk: 52, def: 8, spd: 46, xp: 200, gold: [26, 50], aggro: 84, range: 19, cd: 1000, charge: 110 },
  squidrat: { name: "촉수 쥐", lv: 18, hp: 430, atk: 54, def: 6, spd: 54, xp: 225, gold: [26, 52], aggro: 92, range: 18, cd: 1000, pool: 22, poolKind: 2 },
  catsplit: { name: "갈라진 고양이", lv: 19, hp: 500, atk: 60, def: 6, spd: 54, xp: 250, gold: [28, 54], aggro: 92, range: 18, cd: 1000, leap: 100 },
  fishwalker: { name: "다리 달린 생선", lv: 21, hp: 820, atk: 68, def: 18, spd: 30, xp: 330, gold: [40, 80], aggro: 72, range: 22, cd: 1500, slam: 34 },
  // 하수도
  leechmaw: { name: "거머리 아가리", lv: 22, hp: 800, atk: 73, def: 10, spd: 40, xp: 365, gold: [38, 72], aggro: 84, range: 19, cd: 1100, leap: 84 },
  ratking_bile: { name: "썩은 쥐 왕", sp: "ratking", tint: "bile", lv: 23, hp: 780, atk: 74, def: 10, spd: 50, xp: 400, gold: [40, 76], aggro: 90, range: 17, cd: 850, pool: 24 },
  gatorhalf: { name: "반쪽 악어", lv: 24, hp: 1200, atk: 82, def: 22, spd: 30, xp: 450, gold: [44, 82], aggro: 76, range: 21, cd: 1500, slam: 38 },
  crabskull: { name: "두개골 게", lv: 25, hp: 1300, atk: 86, def: 24, spd: 34, xp: 490, gold: [48, 88], aggro: 80, range: 20, cd: 1400, charge: 120 },
  eelknot: { name: "뱀장어 매듭", lv: 26, hp: 950, atk: 90, def: 10, spd: 38, xp: 520, gold: [50, 92], aggro: 96, range: 74, cd: 1800, volley: true },
  // 수정 동굴
  spiderhand: { name: "손가락 거미", lv: 24, hp: 900, atk: 82, def: 10, spd: 56, xp: 440, gold: [42, 80], aggro: 92, range: 18, cd: 1000, leap: 96 },
  splitboar_frost: { name: "서리 반쪽 멧돼지", sp: "splitboar", tint: "frost", lv: 25, hp: 1000, atk: 88, def: 12, spd: 48, xp: 480, gold: [46, 86], aggro: 92, range: 19, cd: 1100, charge: 112 },
  moleworm: { name: "눈먼 두더지", lv: 26, hp: 1100, atk: 92, def: 14, spd: 44, xp: 520, gold: [50, 92], aggro: 90, range: 19, cd: 1200, leap: 100, slam: 36 },
  bearmaw: { name: "아가리 곰", lv: 27, hp: 1600, atk: 98, def: 26, spd: 27, xp: 640, gold: [56, 100], aggro: 76, range: 21, cd: 1500, slam: 40 },
  hydrasnake_steel: { name: "강철 비늘 뱀", sp: "hydrasnake", tint: "steel", lv: 28, hp: 1250, atk: 100, def: 28, spd: 36, xp: 680, gold: [58, 104], aggro: 96, range: 70, cd: 1800, volley: true },
  owlstare: { name: "목 꺾인 올빼미", lv: 29, hp: 1150, atk: 106, def: 12, spd: 40, xp: 720, gold: [60, 108], aggro: 96, range: 76, cd: 1500, fly: true, shot: true },
  boss: { name: "균열의 군주 크리온", lv: 32, hp: 24000, atk: 150, def: 32, spd: 34, xp: 10000, gold: [1500, 2500], aggro: 130, range: 30, cd: 1400, resp: 180000, boss: true, gear: 1, fan: 150, pool: 30, poolKind: 1 },
  // 피의 심연 — they bite about a fifth softer than they used to: a plainly geared Lv.32 could not stand at the door (probe: 9–34 deaths in two minutes)
  twingoat: { name: "쌍두 염소", lv: 32, hp: 1900, atk: 96, def: 24, spd: 44, xp: 900, gold: [70, 124], aggro: 88, range: 20, cd: 1100, charge: 110 },
  bonehound_ash: { name: "잿빛 사냥개", sp: "bonehound", tint: "ash", lv: 33, hp: 2000, atk: 100, def: 20, spd: 62, xp: 980, gold: [74, 130], aggro: 104, range: 19, cd: 950, leap: 110 },
  horsehalf: { name: "반쪽 말", lv: 34, hp: 2200, atk: 104, def: 22, spd: 60, xp: 1050, gold: [78, 136], aggro: 100, range: 20, cd: 1000, leap: 110 },
  batcluster_blood: { name: "피 박쥐 덩어리", sp: "batcluster", tint: "blood", lv: 35, hp: 2100, atk: 106, def: 18, spd: 54, xp: 1120, gold: [80, 140], aggro: 100, range: 18, cd: 1100, fly: true, burst: 36 },
  lionhand: { name: "손갈기 사자", lv: 35, hp: 2600, atk: 108, def: 26, spd: 50, xp: 1140, gold: [82, 144], aggro: 100, range: 21, cd: 1100, slam: 40, fan: 100 },
  serpentwing: { name: "날개 구렁이", lv: 36, hp: 2000, atk: 110, def: 18, spd: 44, xp: 1220, gold: [86, 150], aggro: 100, range: 78, cd: 1800, fly: true, volley: true },
  sowseer: { name: "눈 달린 암퇘지", lv: 37, hp: 3000, atk: 112, def: 30, spd: 30, xp: 1300, gold: [90, 158], aggro: 88, range: 22, cd: 1500, pool: 30, poolKind: 2 },
  doghead_fire: { name: "불타는 세 머리 들개", sp: "doghead", tint: "fire", lv: 38, hp: 2900, atk: 116, def: 26, spd: 52, xp: 1400, gold: [94, 164], aggro: 100, range: 20, cd: 1000, charge: 116, pool: 24, poolKind: 1 },
  abyssboss: { name: "심연의 어미", lv: 40, hp: 48000, atk: 200, def: 40, spd: 34, xp: 30000, gold: [4000, 6000], aggro: 140, range: 30, cd: 1400, resp: 240000, boss: true, gear: 1, fan: 160, pool: 34, poolKind: 2, charge: 150 },
  // 단풍 왕도 — the fallen kingdom's forest above the chasm, where the blight came up through the roots:
  // beasts and plants alike sprouting violet rot and eyes
  blightsquirrel: { name: "한 꼬리 다람쥐떼", lv: 40, hp: 2400, atk: 114, def: 16, spd: 64, xp: 1500, gold: [96, 168], aggro: 104, range: 18, cd: 850, leap: 100 },
  stumpmaw: { name: "아가리 그루터기", lv: 41, hp: 3600, atk: 118, def: 34, spd: 24, xp: 1560, gold: [98, 170], aggro: 80, range: 22, cd: 1500, slam: 40 },
  crowscare: { name: "까마귀 허수아비", lv: 42, hp: 2600, atk: 120, def: 18, spd: 30, xp: 1620, gold: [100, 174], aggro: 100, range: 78, cd: 1600, shot: true, fan: 96 },
  shroomboar: { name: "버섯등 멧돼지", lv: 43, hp: 3300, atk: 124, def: 28, spd: 48, xp: 1700, gold: [104, 180], aggro: 92, range: 20, cd: 1100, charge: 116, pool: 26 },
  gravrose: { name: "묘지 장미", lv: 44, hp: 3000, atk: 128, def: 22, spd: 22, xp: 1780, gold: [108, 186], aggro: 96, range: 72, cd: 1600, volley: true, pool: 28, poolKind: 2 },
  rotstag: { name: "썩은 관 사슴왕", lv: 46, hp: 5200, atk: 136, def: 32, spd: 42, xp: 2200, gold: [120, 204], aggro: 92, range: 22, cd: 1300, charge: 124, slam: 42, fan: 100 },
};
// Treasure chests are "monsters" that never move or fight: break one open for a sure piece of gear.
for (const [id, lv, hp, gold] of [["meadow", 4, 40, [30, 60]], ["forest", 11, 160, [80, 150]], ["crypt", 15, 300, [130, 240]], ["city", 18, 420, [180, 320]],
  ["sewer", 24, 760, [280, 480]], ["cave", 27, 900, [320, 560]], ["abyss", 35, 1500, [520, 900]], ["maple", 43, 1800, [600, 1000]]]) {
  MOBS[`chest_${id}`] = { name: "보물 상자", sp: "chest", lv, hp, atk: 0, def: 0, spd: 0, xp: 0, gold, aggro: 0, range: 0, cd: 1e9, resp: 300000, chest: true, still: true, gear: 1 };
}
for (const k of Object.keys(MOBS)) {
  const d = MOBS[k];
  if (!d.sp) d.sp = k;
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
  items: (Array.isArray(q.items) ? q.items : []).filter((it) => Array.isArray(it) && typeof it[0] === "string" && Object.hasOwn(ITEMS, it[0])).map(([id, n]) => [id, Math.max(1, n | 0)]),
})).filter((q) => Object.hasOwn(MOBS, q.mob)) : [
  { mob: "twinhare", n: 5, title: "첫 발걸음", text: "차원이 겹친 뒤로 초원의 짐승들이 뒤틀려 돌아왔다네. 머리 둘 달린 토끼 5마리만 정리해 주겠나?", xp: 90, gold: 60, items: [["hp_s", 5]] },
  { mob: "gutfrog", n: 6, title: "뒤집힌 개구리", text: "속이 밖으로 나온 개구리가 길목에서 뛰어든다네. 창자 개구리 6마리를 잡아 주게.", xp: 220, gold: 120, items: [["mp_s", 5]] },
  { mob: "eyecrow", n: 8, title: "지켜보는 것들", text: "연못 위를 도는 눈알 까마귀 8마리를 떨어뜨려 주게. 먼저 덤비진 않지만, 보고 있는 게 영 꺼림칙해.", xp: 520, gold: 200, items: [["stone", 2]] },
  { mob: "lambmaw", n: 8, title: "뒤집힌 것", text: "초원 가장 깊은 곳에 안팎이 뒤집힌 양이 돌아다닌다네. 8마리를 잡아 주게. 고개를 숙이면 곧장 달려드니, 그 줄에서 비켜서게.", xp: 800, gold: 300, items: [["hp_s", 8]] },
  { mob: "splitboar", n: 10, title: "숲의 반쪽", text: "속삭임 숲에는 몸이 반만 남은 멧돼지가 돌아다닌다네. 10마리를 사냥해 주게. 멀리서도 뛰어드니 동료를 구해 보게.", xp: 1300, gold: 450, items: [["hp_m", 5], ["ru_vit", 1]] },
  { mob: "hydrasnake", n: 10, title: "세 갈래 혀", text: "숲 깊은 곳의 세 머리 뱀 10마리를 베어 주게. 독을 뱉으니 서 있지 말고 움직이게.", xp: 2200, gold: 600, items: [["stone", 3]] },
  { mob: "ratking", n: 12, title: "무덤 아래", text: "숲의 막다른 폐허에 지하묘지로 내려가는 계단이 있다네. 꼬리가 엉킨 쥐 왕 12마리를 정리해 주게.", xp: 3000, gold: 750, items: [["hp_m", 5]] },
  { mob: "toadbrood", n: 10, title: "등에 밴 것", text: "지하묘지의 알 밴 두꺼비 10마리를 잡아 주게. 뱉어 놓은 웅덩이는 한참 남으니, 밟고 서 있지 말게.", xp: 3500, gold: 820, items: [["mp_m", 4]] },
  { mob: "batcluster", n: 10, title: "터지는 것", text: "지하묘지 깊은 곳의 박쥐 덩어리 10마리를 터뜨려 주게. 죽으면서 터지니, 쓰러뜨리고 물러서게.", xp: 4000, gold: 900, items: [["ru_ign", 1]] },
  { mob: "pigeonmass", n: 10, title: "다른 세계의 하늘", text: "서쪽 문 너머는 '네온 시티'라는 다른 세계일세. 한 덩어리로 뭉친 비둘기 떼살 10마리를 떨어뜨려 주게.", xp: 4600, gold: 1000, items: [["mp_m", 5]] },
  { mob: "catsplit", n: 12, title: "뒷골목의 울음", text: "네온 시티 골목의 갈라진 고양이 12마리를 잡아 주게. 소리 없이 뛰어든다네.", xp: 6500, gold: 1300, items: [["stone", 4]] },
  { mob: "fishwalker", n: 10, title: "뭍에 오른 것", text: "다리 달린 생선 10마리를 쓰러뜨려 주게. 단단하니 파티가 필요할 걸세.", xp: 9500, gold: 1800, items: [["stone", 5]] },
  { mob: "leechmaw", n: 12, title: "도시의 밑바닥", text: "네온 시티 뒷마당에 하수도로 내려가는 구멍이 있다네. 거머리 아가리 12마리를 떼어 내 주게.", xp: 12000, gold: 2200, items: [["hp_m", 8]] },
  { mob: "crabskull", n: 10, title: "남의 머리", text: "하수도에는 남의 두개골을 뒤집어쓴 게가 있다네. 두개골 게 10마리를 부숴 주게. 단단하고, 돌진이 매섭네.", xp: 13500, gold: 2400, items: [["stone", 4]] },
  { mob: "eelknot", n: 10, title: "매듭", text: "하수도 끝의 뱀장어 매듭 10마리를 풀어 주게. 멀리서 전기를 쏜다네.", xp: 15000, gold: 2600, items: [["ru_acu", 1]] },
  { mob: "bearmaw", n: 8, title: "배에 난 입", text: "숲 끝의 수정 동굴은 균열의 중심일세. 아가리 곰 8마리를 쓰러뜨려 주게. 땅을 내리칠 땐 물러서게.", xp: 19000, gold: 3200, items: [["ru_san", 1], ["stone", 5]] },
  { mob: "boss", n: 1, title: "균열의 군주", text: "모든 세계를 뒤섞은 장본인, 균열의 군주 크리온을 쓰러뜨려 주게. 반드시 파티를 꾸려서 가게.", xp: 45000, gold: 8000, items: [["stone", 10], ["ru_lum", 1]] },
  { mob: "horsehalf", n: 12, title: "군주의 뒤편", text: "군주가 쓰러진 자리 뒤에 더 깊은 균열이 열렸네. 피의 심연의 반쪽 말 12마리를 쓰러뜨려 주게.", xp: 30000, gold: 5000, items: [["hp_m", 10], ["ru_fos", 1]] },
  { mob: "lionhand", n: 10, title: "손으로 된 갈기", text: "심연 깊은 곳의 손갈기 사자 10마리를 쓰러뜨려 주게. 땅을 치고, 멀리서는 무언가를 던진다네.", xp: 38000, gold: 6000, items: [["stone", 8]] },
  { mob: "abyssboss", n: 1, title: "심연의 어미", text: "뒤틀린 것들은 전부 한곳에서 태어났네. 심연의 어미를 쓰러뜨려, 이 일을 끝내 주게.", xp: 120000, gold: 20000, items: [["stone", 20], ["ru_lum", 2]] },
  { mob: "blightsquirrel", n: 12, title: "단풍 아래의 병", text: "어미는 쓰러졌지만, 그 병은 뿌리를 타고 지상으로 번졌다네. 속삭임 숲 동쪽, 단풍에 묻힌 옛 왕도로 가서 한 꼬리 다람쥐떼 12마리를 정리해 주게.", xp: 40000, gold: 6500, items: [["hp_m", 10]] },
  { mob: "shroomboar", n: 12, title: "포자 무덤", text: "왕도의 멧돼지들은 등에 버섯을 키운다네. 버섯등 멧돼지 12마리를 잡아 주게. 뱉어 낸 포자 웅덩이는 독이니 밟지 말게.", xp: 46000, gold: 7200, items: [["stone", 8], ["mp_m", 6]] },
  { mob: "rotstag", n: 4, title: "썩은 왕관", text: "무너진 예배당엔 왕관을 쓴 사슴이 산다네. 옛 왕의 사냥감이었다지. 썩은 관 사슴왕 4마리를 쓰러뜨려, 왕도의 병을 끊어 주게.", xp: 60000, gold: 9000, items: [["stone", 12], ["ru_lum", 1]] },
];

