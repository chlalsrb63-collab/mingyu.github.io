// Socket limits, rune variants and deterministic drops. A variant has fixed lines so identical runes stack.
const SOCK_CAPS = { weapon: 2, armor: 2, helm: 1, gloves: 1, boots: 1, ring: 1, amulet: 1 };
const SOCK_COST = [1200, 3500];
const SOCK_ITEM = "punch"; // Retain the id of the old socket tool in bags, storage and trade.
const SOCK_DROP = [0.0001, 0.0008, 0.004]; // Normal, elite, boss or guardian, per eligible looter.
ITEMS[SOCK_ITEM] = {
  name: "룬 천공석", type: "tool", q: 3, price: 4000,
  desc: "대장장이 볼칸에게 골드와 함께 건네면 장착한 장비의 룬 소켓 하나를 엽니다. 볼칸의 의뢰 보상과 희귀 사냥 전리품으로 얻으며 거래할 수 있습니다.",
};
const sockCap = (g) => SOCK_CAPS[ITEMS[g.id].type];
const RUNE_RARITY = { 1: "고급", 2: "희귀", 3: "전설", 4: "세트" };
const RUNE_PRICE = { 1: 500, 2: 900, 3: 1650, 4: 850 };
const RUNES = {};
const RUNE_KEYS = [];
const RUNE_POOLS = { 1: [], 2: [], 3: [], 4: { 2: [], 3: [], 4: [] } };
// Runes complement the host item. Keep low-level bonuses and bring endgame lines to 65% of face value.
const RUNE_SCALE = Array.from({ length: 200 }, (_, i) => 18 + Math.floor(i * 47 / 199));
// Combat limits apply only to the sum of socket lines; base gear, prefixes and set powers have their own rules.
const RUNE_STAT_CAP = { atk: 32, atkp: 6, def: 20, hp: 220, mp: 100, crit: 6, critd: 16, ls: 3, spd: 8, dmg: 8, pen: 8, res: 12, dur: 10, proc: 8 };
const runeStatCap = (key) => RUNE_STAT_CAP[key] ?? RUNE_STAT_CAP[key.split("_", 1)[0]] ?? Infinity;
const runeIl = (il) => Number.isInteger(il) ? clamp(il, 1, RUNE_SCALE.length) : 1;
const runeReq = (il) => Math.max(1, runeIl(il) - IL_GAP);
const runeSocketId = (socket) => Array.isArray(socket) ? socket[0] : socket;
const runeSocketLevel = (socket) => runeIl(Array.isArray(socket) ? socket[1] : undefined);
const runeStat = (n, il) => Math.max(1, Math.round(n * RUNE_SCALE[il - 1] / 100));
const stackMatches = (slot, id, il) => slot.id === id && (!RUNES[id] || runeIl(slot.il) === runeIl(il));
const stackItem = (id, n, il) => RUNES[id] ? { id, n, il: runeIl(il) } : { id, n };

function addRune(id, q, name, af, set) {
  RUNES[id] = set ? { name, q, af, set } : { name, q, af };
  RUNE_KEYS.push(id);
  ITEMS[id] = { name, type: "rune", rune: id, price: RUNE_PRICE[q], desc: "장착한 장비의 홈에 끼울 수 있다." };
  (set ? RUNE_POOLS[4][RUNE_SETS[set].need] : RUNE_POOLS[q]).push(id);
}

// The first nine ids keep the stats of runes that were already in shops, quest rewards and player bags.
const MAGIC_RUNES = [
  ["ign", "이그", "atkp", 5], ["aeg", "에기", "def", 4], ["vit", "비타", "hp", 35],
  ["men", "멘", "mp", 25], ["cel", "셀", "spd", 4], ["acu", "아쿠", "crit", 3],
  ["san", "산", "ls", 2], ["lum", "룸", "xp", 6], ["fos", "포스", "mf", 10],
  ["doran", "도란", "atk", 7], ["nem", "넴", "critd", 10], ["mel", "멜", "gold", 10],
];
for (const [id, name, stat, n] of MAGIC_RUNES) addRune(`ru_${id}`, 1, `${name} 룬`, [[stat, n]]);

const RARE_RUNES = [
  ["micasalt", "운모소금", [["atkp", 5], ["crit", 3]]],
  ["cedar", "삼나무껍질", [["hp", 65], ["def", 6]]],
  ["silkpath", "비단길", [["spd", 4], ["mp", 30]]],
  ["pearlchip", "진주톱밥", [["gold", 12], ["mf", 10]]],
  ["cutamber", "깎은 호박", [["atk", 12], ["ls", 2]]],
  ["moonink", "달먹물", [["mp", 35], ["critd", 12]]],
  ["cedarseed", "솔방울", [["def", 5], ["xp", 7]]],
  ["quarry", "석공", [["hp", 55], ["atkp", 5]]],
];
for (const [id, name, af] of RARE_RUNES) addRune(`ru_${id}`, 2, `${name} 룬`, af);

const LEGEND_RUNES = [
  ["firstsun", "여명의 유리", [["atkp", 7], ["crit", 4], ["critd", 16]]],
  ["rootiron", "천년 뿌리", [["hp", 115], ["def", 8], ["ls", 2]]],
  ["fallstar", "별이 내린 자리", [["mp", 55], ["atkp", 7], ["critd", 14]]],
  ["oathroad", "순례자의 길", [["spd", 5], ["hp", 100], ["xp", 9]]],
  ["lostmint", "잊힌 주화", [["mf", 14], ["gold", 17], ["atk", 18]]],
  ["bonesong", "백골의 노래", [["ls", 3], ["atk", 18], ["crit", 4]]],
  ["cloudwood", "구름목", [["spd", 5], ["mp", 50], ["def", 8]]],
  ["westglass", "서녘의 화톳불", [["hp", 90], ["atkp", 7], ["mf", 13]]],
];
for (const [id, name, af] of LEGEND_RUNES) addRune(`ru_${id}`, 3, `${name} 룬`, af);

/** Each element has a fixed stackable rune variant at every ordinary rarity. */
function registerElementRunes() {
  const stones = ["철심", "혈석", "잿불", "빙정", "뇌광", "독수정", "흑요", "광휘"];
  const magicStat = ["dmg", "pen", "dmg", "res", "dmg", "res", "pen", "res"];
  const points = { dmg: [6, 10, 16], pen: [5, 6, 8], res: [8, 10, 13] };
  for (let i = 0; i < DAMAGE_TYPES.length; i++) {
    const type = DAMAGE_TYPES[i], first = magicStat[i], middle = first === "dmg" ? "pen" : first === "pen" ? "res" : "dmg";
    const line = (stat, q) => [`${stat}_${type}`, points[stat][q - 1]];
    addRune(`ru_e_${type}_1`, 1, `${stones[i]} 가루의 룬`, [line(first, 1)]);
    addRune(`ru_e_${type}_2`, 2, `${stones[i]} 파편의 룬`, [line(first, 2), line(middle, 2)]);
    addRune(`ru_e_${type}_3`, 3, `${stones[i]} 결계의 룬`, [line("dmg", 3), line("pen", 3), line("res", 3)]);
  }
}
