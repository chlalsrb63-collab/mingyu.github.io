/**
 * 루멘테일 온라인 — the whole game world, as plain rules.
 *
 * A party-hunting RPG set where worlds overlap: a fantasy meadow, a neon city
 * and a crystal rift all hang off one hub. Three ideas drive the rules:
 *   - loot is rolled, not listed: every piece of gear gets a rarity, random
 *     affixes and sockets, and runes socketed in the right order form runewords;
 *   - experience never stops mattering: it levels you up, and it can also be
 *     spent, without limit, on permanent training of your base stats;
 *   - hunting together pays: a party shares kills, quest credit and a bonus.
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
const BASE_SPD = 72;
const PARTY_MAX = 4;
const PARTY_RANGE = 340;
/** Share of a kill's experience each member gets, by how many are in range. */
const PARTY_SHARE = [1, 0.8, 0.7, 0.65];

// ───────────────────────────── tables ─────────────────────────────

const CLASSES = {
  warrior: { name: "전사", arm: "양손검", hp: [130, 24], mp: [30, 4], atk: [10, 2.6], def: [3, 0.9], crit: 8, cd: 700, range: 34, fx: 0, cleave: 3 },
  rogue: { name: "도적", arm: "단검", hp: [92, 16], mp: [40, 6], atk: [7, 1.9], def: [1, 0.5], crit: 22, cd: 380, range: 26, fx: 3, cleave: 1 },
  ranger: { name: "레인저", arm: "총", hp: [86, 15], mp: [40, 6], atk: [8, 2.1], def: [1, 0.5], crit: 12, cd: 600, range: 118, fx: 1, cleave: 1 },
  mage: { name: "마도사", arm: "지팡이", hp: [76, 13], mp: [60, 10], atk: [9, 2.4], def: [1, 0.4], crit: 10, cd: 800, range: 100, fx: 2, cleave: 1 },
};

const SKILLS = {
  warrior: [
    { id: "strike", name: "강타", lv: 3, mp: 6, cd: 4000, mult: 2.2, desc: "가까운 적 하나에게 강력한 일격 (220%)" },
    { id: "spin", name: "회전베기", lv: 7, mp: 12, cd: 8000, mult: 1.6, r: 48, desc: "주변의 모든 적을 벤다 (160%)" },
    { id: "shout", name: "전투함성", lv: 12, mp: 15, cd: 30000, dur: 12000, r: 110, desc: "12초간 자신과 주변 파티원의 공격력 25% 증가" },
  ],
  rogue: [
    { id: "vital", name: "급소 찌르기", lv: 3, mp: 6, cd: 3500, mult: 2.0, desc: "반드시 치명타로 들어가는 일격 (200%)" },
    { id: "dash", name: "그림자 도약", lv: 7, mp: 10, cd: 7000, mult: 1.9, len: 120, desc: "적의 등 뒤로 순간이동해 벤다 (190%)" },
    { id: "smoke", name: "연막", lv: 12, mp: 14, cd: 22000, dur: 6000, desc: "적의 시선을 끊고 6초간 이동속도 40% 증가" },
  ],
  ranger: [
    { id: "multi", name: "연사", lv: 3, mp: 7, cd: 4500, mult: 1.0, desc: "가까운 적 최대 3명에게 사격 (100%)" },
    { id: "pierce", name: "관통탄", lv: 7, mp: 12, cd: 8000, mult: 2.0, len: 170, desc: "일직선의 적을 모두 꿰뚫는다 (200%)" },
    { id: "nade", name: "수류탄", lv: 12, mp: 16, cd: 10000, mult: 2.3, r: 42, desc: "폭발 범위의 적 모두에게 피해 (230%)" },
  ],
  mage: [
    { id: "fireball", name: "화염구", lv: 3, mp: 10, cd: 4500, mult: 1.9, r: 34, desc: "폭발하는 불덩이 (범위 190%)" },
    { id: "nova", name: "빙결 파동", lv: 7, mp: 16, cd: 9000, mult: 1.4, r: 58, desc: "주변 적에게 피해를 주고 느리게 한다" },
    { id: "heal", name: "치유의 빛", lv: 12, mp: 22, cd: 12000, r: 90, desc: "자신과 주변 아군의 HP 35% 회복" },
  ],
};

const WEAPON_NAMES = {
  warrior: ["녹슨 대검", "강철 양손검", "기사단 클레이모어", "고주파 대검", "차원 절단기"],
  rogue: ["낡은 단검", "암살자의 비수", "쌍독니", "카본 나이프", "균열의 송곳니"],
  ranger: ["구식 권총", "리볼버", "자동소총", "레일 피스톨", "특이점 캐논"],
  mage: ["견습 지팡이", "룬 지팡이", "현자의 지팡이", "플라즈마 로드", "공허의 홀"],
};
const ARMOR_NAMES = ["여행자 옷", "가죽 갑옷", "사슬 갑옷", "전술 방탄복", "차원 외골격"];
const ACC_NAMES = ["구리 반지", "은 목걸이", "차원 인장"];
const W_ATK = [6, 14, 26, 42, 64];
const A_DEF = [2, 6, 11, 18, 28];
const A_HP = [0, 30, 70, 130, 220];
const G_REQ = [1, 8, 16, 26, 38];
const G_PRICE = [80, 600, 2200, 7000, 20000];

const ITEMS = {
  hp_s: { name: "빨간 물약", type: "pot", heal: 60, price: 20, desc: "HP를 60 회복한다." },
  hp_m: { name: "큰 빨간 물약", type: "pot", heal: 220, price: 70, desc: "HP를 220 회복한다." },
  mp_s: { name: "파란 물약", type: "pot", mana: 40, price: 25, desc: "MP를 40 회복한다." },
  mp_m: { name: "큰 파란 물약", type: "pot", mana: 140, price: 80, desc: "MP를 140 회복한다." },
  stone: { name: "강화석", type: "mat", price: 150, desc: "대장장이에게 가져가면 장비를 강화할 수 있다." },
};
for (const cls of Object.keys(WEAPON_NAMES)) {
  for (let t = 1; t <= 5; t++) {
    ITEMS[`w_${cls}_${t}`] = { name: WEAPON_NAMES[cls][t - 1], type: "weapon", cls, tier: t, atk: W_ATK[t - 1], req: G_REQ[t - 1], price: G_PRICE[t - 1] };
  }
}
for (let t = 1; t <= 5; t++) {
  ITEMS[`a_${t}`] = { name: ARMOR_NAMES[t - 1], type: "armor", tier: t, def: A_DEF[t - 1], hp: A_HP[t - 1], req: G_REQ[t - 1], price: G_PRICE[t - 1] };
}
for (let t = 1; t <= 3; t++) {
  ITEMS[`c_${t}`] = { name: ACC_NAMES[t - 1], type: "acc", tier: t + 1, req: [5, 15, 28][t - 1], price: [400, 1800, 6000][t - 1] };
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
  ["xp", "경험치 %", "깨달음의", 3, 8, 0], ["mf", "아이템 발견 %", "행운의", 5, 15, 0],
];
const RARITY = ["일반", "마법", "희귀", "전설"];
/** How many affixes each rarity rolls: [min, max]. */
const RARITY_AFFIX = [[0, 0], [1, 2], [3, 4], [5, 5]];

/** Training: experience spent on a permanent stat point. Never capped. */
const TRAIN = {
  str: { name: "힘", gain: 1, stat: "atk", desc: "공격력 +1" },
  vit: { name: "체력", gain: 14, stat: "hp", desc: "최대 HP +14" },
  int: { name: "지력", gain: 9, stat: "mp", desc: "최대 MP +9" },
  grd: { name: "수호", gain: 1, stat: "def", desc: "방어력 +1" },
};
const trainCost = (n) => 120 + 40 * n;

const SHOP = ["hp_s", "hp_m", "mp_s", "mp_m", "stone", "W1", "a_1"];
const ENH_RATE = [100, 95, 90, 80, 70, 55, 45, 35, 25, 15];

const MOBS = {
  slime: { name: "초원 슬라임", sp: "slime", lv: 1, hp: 30, atk: 5, def: 0, spd: 22, xp: 9, gold: [2, 6], aggro: 0, range: 16, cd: 1300, resp: 7000, gear: 0.05 },
  bslime: { name: "부식 슬라임", sp: "bslime", lv: 3, hp: 62, atk: 9, def: 0, spd: 26, xp: 18, gold: [4, 10], aggro: 0, range: 16, cd: 1300, resp: 8000, gear: 0.06 },
  shroom: { name: "포자괴", sp: "shroom", lv: 5, hp: 100, atk: 14, def: 1, spd: 30, xp: 32, gold: [6, 14], aggro: 60, range: 17, cd: 1200, resp: 9000, gear: 0.07 },
  boar: { name: "흑갈기 멧돼지", sp: "boar", lv: 8, hp: 190, atk: 24, def: 3, spd: 48, xp: 62, gold: [10, 22], aggro: 76, range: 18, cd: 1100, resp: 10000, gear: 0.08 },
  bat: { name: "흡혈박쥐", sp: "bat", lv: 11, hp: 180, atk: 31, def: 2, spd: 60, xp: 88, gold: [12, 26], aggro: 90, range: 16, cd: 1000, resp: 10000, fly: true, gear: 0.08 },
  drone: { name: "감시 드론", sp: "drone", lv: 14, hp: 300, atk: 40, def: 5, spd: 56, xp: 140, gold: [18, 36], aggro: 100, range: 70, cd: 1300, resp: 11000, fly: true, shot: true, gear: 0.09 },
  thug: { name: "뒷골목 무법자", sp: "thug", lv: 17, hp: 460, atk: 52, def: 8, spd: 46, xp: 200, gold: [26, 50], aggro: 84, range: 19, cd: 1000, resp: 12000, gear: 0.1 },
  robot: { name: "경비 로봇 MK-2", sp: "robot", lv: 20, hp: 720, atk: 64, def: 16, spd: 30, xp: 300, gold: [34, 64], aggro: 80, range: 22, cd: 1500, resp: 14000, gear: 0.11 },
  skel: { name: "망령 병사", sp: "skel", lv: 23, hp: 900, atk: 78, def: 14, spd: 42, xp: 400, gold: [40, 76], aggro: 88, range: 19, cd: 1100, resp: 13000, gear: 0.11 },
  golem: { name: "수정 골렘", sp: "golem", lv: 26, hp: 1500, atk: 96, def: 26, spd: 27, xp: 620, gold: [56, 100], aggro: 76, range: 21, cd: 1500, resp: 15000, gear: 0.13 },
  boss: { name: "균열의 군주 크리온", sp: "boss", lv: 30, hp: 22000, atk: 140, def: 30, spd: 34, xp: 9000, gold: [1500, 2500], aggro: 130, range: 30, cd: 1400, resp: 180000, boss: true, gear: 1 },
};

const QUESTS = [
  { mob: "slime", n: 5, title: "첫 발걸음", text: "차원이 겹친 뒤로 초원에 슬라임이 들끓는다네. 초원 슬라임 5마리만 정리해 주겠나?", xp: 90, gold: 60, items: [["hp_s", 5]] },
  { mob: "bslime", n: 6, title: "부식의 흔적", text: "남쪽의 부식 슬라임이 길을 녹이고 있어. 6마리를 처치해 주게.", xp: 220, gold: 120, items: [["mp_s", 5]] },
  { mob: "shroom", n: 8, title: "포자 주의보", text: "연못가에 포자괴가 번지고 있네. 8마리를 뽑아 주면 강화석을 주지.", xp: 520, gold: 200, items: [["stone", 2]] },
  { mob: "boar", n: 10, title: "숲의 난폭자", text: "속삭임 숲의 흑갈기 멧돼지 10마리를 사냥해 주게. 혼자선 벅찰 테니 동료를 구해 보게.", xp: 1300, gold: 450, items: [["hp_m", 5], ["ru_vit", 1]] },
  { mob: "bat", n: 10, title: "밤의 날갯짓", text: "숲 동쪽의 흡혈박쥐 10마리를 쫓아내 주게.", xp: 2200, gold: 600, items: [["stone", 3]] },
  { mob: "drone", n: 10, title: "다른 세계의 눈", text: "서쪽 문 너머는 '네온 시티'라는 다른 세계일세. 우리를 감시하는 드론 10기를 떨어뜨려 주게.", xp: 4200, gold: 900, items: [["ru_ign", 1]] },
  { mob: "thug", n: 12, title: "뒷골목 청소", text: "네온 시티의 무법자들이 차원문을 넘보고 있어. 12명을 제압해 주게.", xp: 6500, gold: 1300, items: [["mp_m", 5]] },
  { mob: "robot", n: 10, title: "강철의 순찰대", text: "경비 로봇 MK-2 10기를 멈춰 세워 주게. 방어가 단단하니 파티가 필요할 걸세.", xp: 9500, gold: 1800, items: [["stone", 5]] },
  { mob: "golem", n: 8, title: "움직이는 수정", text: "숲 끝의 수정 동굴은 균열의 중심일세. 수정 골렘 8마리를 부숴 주게.", xp: 15000, gold: 2600, items: [["ru_acu", 1], ["ru_san", 1]] },
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
  for (const [x, y] of [[5, 12], [33, 9], [34, 24], [5, 17], [23, 24], [13, 5], [24, 6]]) m.o[y][x] = "B";
  for (const [x, y] of [[32, 13], [6, 13]]) m.o[y][x] = "G";
  portal(m, 38, 14, "meadow", 4, 22);
  portal(m, 38, 15, "meadow", 4, 23);
  portal(m, 1, 14, "city", 51, 19);
  portal(m, 1, 15, "city", 51, 20);
  m.npcs.push(
    { id: "shop", name: "보급상 리나", role: "shop", x: 10, y: 9, look: [4, 0, 1, "#8a4a6a"] },
    { id: "smith", name: "대장장이 볼칸", role: "smith", x: 30, y: 8, look: [0, 1, 0, "#6a4a38"] },
    { id: "elder", name: "관리자 엘더윈", role: "elder", x: 19, y: 11, look: [5, 0, 0, "#3f5a9a"] },
    { id: "train", name: "수련관 카이", role: "train", x: 23, y: 12, look: [1, 2, 0, "#7a2e2e"] },
    { id: "guard", name: "경비병 토비", role: "talk", x: 35, y: 13, look: [1, 0, 0, "#5e6470"],
      say: "동쪽 문은 바람초원, 서쪽 문은 네온 시티로 이어져. 네온 시티는 레벨 13은 되어야 버틸 만해. 혼자 가지 말고 파티를 구해!" },
  );
  return finalize(m);
}

function buildCity() {
  const box = { seed: 5505 };
  const m = blank("city", "네온 시티", 56, 40, "k");
  m.entry = [51, 19];
  m.bgm = "city";
  rect(m.g, 0, 18, 55, 21, "a");
  rect(m.g, 26, 0, 29, 39, "a");
  for (let x = 2; x < 54; x += 3) if (x < 25 || x > 30) m.g[20][x] = "m";
  for (const [x, y, v] of [[5, 4, 4], [12, 4, 6], [19, 5, 7], [33, 4, 6], [41, 5, 4], [47, 4, 7], [5, 11, 7], [13, 12, 4], [34, 11, 7], [44, 12, 6],
    [5, 25, 6], [13, 26, 7], [20, 25, 4], [33, 25, 4], [41, 26, 6], [47, 25, 7], [6, 32, 4], [15, 33, 6], [35, 32, 7], [45, 33, 4]]) house(m, x, y, v);
  scatter(m, box, m.o, "c", 0.03, "a");
  // a parked car is two tiles long: block the tile beside it as well
  for (let y = 0; y < m.h; y++) for (let x = m.w - 2; x >= 0; x--) {
    if (m.o[y][x] !== "c") continue;
    if (m.o[y][x + 1] === " " && "am".includes(m.g[y][x + 1])) m.o[y][x + 1] = "h";
    else m.o[y][x] = " ";
  }
  scatter(m, box, m.o, "y", 0.012, "k");
  scatter(m, box, m.o, "x", 0.014, "k");
  for (let x = 4; x < 54; x += 7) if (x < 24 || x > 31) { m.o[17][x] = "L"; m.o[22][x + 2] = "L"; }
  border(m, "Z", 2);
  rect(m.o, 44, 18, 53, 21, " ");
  portal(m, 53, 19, "town", 3, 14);
  portal(m, 53, 20, "town", 3, 15);
  m.spawns.push(
    { k: "drone", n: 9, r: [3, 3, 25, 16] },
    { k: "thug", n: 8, r: [30, 3, 52, 16] },
    { k: "thug", n: 5, r: [3, 23, 25, 36] },
    { k: "robot", n: 8, r: [30, 23, 52, 36] },
  );
  return finalize(m);
}

function buildMeadow() {
  const box = { seed: 2202 };
  const m = blank("meadow", "바람초원", 60, 46, ".");
  m.entry = [4, 22];
  scatter(m, box, m.g, ",", 0.16, ".");
  scatter(m, box, m.g, '"', 0.07, ".");
  // pond with a sandy shore
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const d = Math.pow((x - 41) / 8, 2) + Math.pow((y - 11) / 5, 2);
    if (d < 1) m.g[y][x] = "w";
    else if (d < 1.5) m.g[y][x] = "s";
  }
  scatter(m, box, m.o, "T", 0.032, ".,\"");
  scatter(m, box, m.o, "B", 0.02, ".,\"");
  scatter(m, box, m.o, "R", 0.012, ".,\"s");
  border(m, "T", 2);
  road(m, 0, 22, 14, 22, "p");
  road(m, 14, 22, 28, 27, "p");
  road(m, 28, 27, 44, 24, "p");
  road(m, 44, 24, 59, 22, "p");
  portal(m, 1, 22, "town", 36, 14);
  portal(m, 1, 23, "town", 36, 15);
  portal(m, 58, 22, "forest", 4, 22);
  portal(m, 58, 23, "forest", 4, 23);
  m.spawns.push(
    { k: "slime", n: 11, r: [4, 4, 30, 42] },
    { k: "bslime", n: 7, r: [24, 28, 56, 42] },
    { k: "shroom", n: 7, r: [30, 3, 56, 20] },
  );
  return finalize(m);
}

function buildForest() {
  const box = { seed: 3303 };
  const m = blank("forest", "속삭임 숲", 60, 46, ":");
  m.entry = [4, 22];
  m.bgm = "forest";
  scatter(m, box, m.g, ";", 0.2, ":");
  scatter(m, box, m.g, '"', 0.02, ":");
  // a stream running north-south, crossed by a bridge on the road
  for (let y = 0; y < m.h; y++) {
    const cx = 30 + Math.round(Math.sin(y / 5) * 2);
    m.g[y][cx] = "w";
    m.g[y][cx + 1] = "w";
  }
  scatter(m, box, m.o, "P", 0.065, ":;");
  scatter(m, box, m.o, "B", 0.025, ":;");
  scatter(m, box, m.o, "R", 0.015, ":;");
  border(m, "P", 2);
  for (let y = 21; y <= 24; y++) for (let x = 26; x <= 35; x++) if (m.g[y][x] === "w") m.g[y][x] = "b";
  road(m, 0, 22, 26, 22, "p");
  for (let x = 26; x <= 35; x++) for (let y = 21; y <= 24; y++) m.o[y][x] = " ";
  road(m, 35, 22, 46, 16, "p");
  road(m, 46, 16, 55, 6, "p");
  road(m, 55, 6, 55, 2, "p");
  portal(m, 1, 22, "meadow", 55, 22);
  portal(m, 1, 23, "meadow", 55, 23);
  portal(m, 55, 1, "cave", 5, 34);
  portal(m, 56, 1, "cave", 5, 35);
  m.spawns.push(
    { k: "boar", n: 10, r: [4, 4, 27, 42] },
    { k: "shroom", n: 4, r: [8, 28, 27, 42] },
    { k: "bat", n: 9, r: [34, 4, 56, 42] },
  );
  return finalize(m);
}

function buildCave() {
  const box = { seed: 4404 };
  const m = blank("cave", "수정 동굴", 50, 40, "W");
  m.entry = [5, 34];
  m.bgm = "cave";
  const room = (x0, y0, x1, y1) => {
    rect(m.g, x0, y0, x1, y1, "c");
    // ragged edges so the rooms don't look like boxes
    for (let x = x0; x <= x1; x++) {
      if (rnd(box) < 0.35) m.g[y0 - 1][x] = "c";
      if (rnd(box) < 0.35) m.g[y1 + 1][x] = "c";
    }
    for (let y = y0; y <= y1; y++) {
      if (rnd(box) < 0.35) m.g[y][x0 - 1] = "c";
      if (rnd(box) < 0.35) m.g[y][x1 + 1] = "c";
    }
  };
  room(3, 31, 10, 37);
  room(14, 26, 27, 36);
  room(6, 10, 20, 20);
  room(26, 8, 36, 18);
  room(40, 4, 47, 21);
  rect(m.g, 10, 33, 14, 34, "c");
  rect(m.g, 16, 20, 17, 26, "c");
  rect(m.g, 20, 13, 26, 14, "c");
  rect(m.g, 36, 12, 40, 13, "c");
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (m.g[y][x] !== "c") continue;
    const r = rnd(box);
    if (r < 0.12) m.g[y][x] = "d";
    else if (r < 0.15) m.o[y][x] = "K";
    else if (r < 0.17) m.o[y][x] = "S";
  }
  // keep corridors and the boss arena clear
  rect(m.o, 10, 33, 14, 34, " ");
  rect(m.o, 16, 20, 17, 26, " ");
  rect(m.o, 20, 13, 26, 14, " ");
  rect(m.o, 36, 12, 40, 13, " ");
  rect(m.o, 41, 8, 46, 17, " ");
  rect(m.o, 3, 33, 7, 36, " ");
  portal(m, 3, 34, "forest", 55, 4);
  portal(m, 3, 35, "forest", 56, 4);
  m.spawns.push(
    { k: "skel", n: 8, r: [14, 26, 27, 36] },
    { k: "skel", n: 5, r: [6, 10, 20, 20] },
    { k: "golem", n: 3, r: [6, 10, 20, 20] },
    { k: "golem", n: 6, r: [26, 8, 36, 18] },
    { k: "boss", n: 1, r: [43, 11, 44, 13] },
  );
  return finalize(m);
}

const MAPS = { town: buildTown(), meadow: buildMeadow(), forest: buildForest(), cave: buildCave(), city: buildCity() };
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
const SLOTS = ["weapon", "armor", "acc"];
const isGear = (id) => SLOTS.includes(ITEMS[id].type);
const plain = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });

/** The highest choice allowed for each part of a character's look. */
const LOOK_MAX = [5, 5, 4, 9, 3, 3, 5];
/** A brand-new character sheet — this is exactly what gets persisted. */
export function newChar(name, cls, look) {
  const c = CLASSES[cls] ? cls : "warrior";
  const lk = Array.isArray(look) ? look : [];
  return {
    v: 2, name, cls: c,
    // ear, eyes, nose, colour, blush, markings, tunic
    look: LOOK_MAX.map((m, i) => clamp(lk[i] | 0, 0, m)),
    lvl: 1, xp: 0, gold: 50,
    inv: [{ id: "hp_s", n: 5 }, { id: "mp_s", n: 3 }],
    eq: { weapon: plain(`w_${c}_1`), armor: plain("a_1"), acc: null },
    tr: { str: 0, vit: 0, int: 0, grd: 0 },
    q: { i: 0, n: 0, st: 0 },
    map: START.map, x: START.x, y: START.y, hp: -1, mp: -1, kills: 0,
  };
}

/** Bring a sheet saved by an older version up to the current shape. */
function migrate(ch) {
  if (!CLASSES[ch.cls]) ch.cls = ch.cls === "archer" ? "ranger" : "warrior";
  const fix = (g) => {
    if (!g || !ITEMS[g.id]) return null;
    if (!isGear(g.id)) return g;
    return { id: g.id, q: g.q | 0, enh: g.enh | 0, af: Array.isArray(g.af) ? g.af : [], sk: g.sk | 0, ru: Array.isArray(g.ru) ? g.ru : [] };
  };
  ch.inv = (Array.isArray(ch.inv) ? ch.inv : []).map(fix).filter(Boolean);
  const eq = isObj(ch.eq) ? ch.eq : {};
  ch.eq = { weapon: fix(eq.weapon), armor: fix(eq.armor), acc: fix(eq.acc) };
  if (ch.eq.weapon && ITEMS[ch.eq.weapon.id].cls !== ch.cls) ch.eq.weapon = plain(`w_${ch.cls}_1`);
  const tr = isObj(ch.tr) ? ch.tr : {};
  ch.tr = { str: tr.str | 0, vit: tr.vit | 0, int: tr.int | 0, grd: tr.grd | 0 };
  if (!isObj(ch.q)) ch.q = { i: 0, n: 0, st: 0 };
  ch.v = 2;
  return ch;
}

function runeword(g) {
  if (!g.sk || g.ru.length !== g.sk) return null;
  for (const rw of RUNEWORDS) {
    if (rw.seq.length === g.sk && rw.seq.every((r, i) => g.ru[i] === r)) return rw;
  }
  return null;
}

/** Everything gear, runes and runewords add up to. */
function gearBonus(ch) {
  const b = { atk: 0, atkp: 0, def: 0, hp: 0, mp: 0, crit: 0, critd: 0, ls: 0, spd: 0, xp: 0, mf: 0 };
  for (const k of SLOTS) {
    const g = ch.eq[k];
    if (!g) continue;
    for (const [s, v] of g.af) b[s] += v;
    for (const r of g.ru) if (r && RUNES[r]) b[RUNES[r][1]] += RUNES[r][2];
    const rw = runeword(g);
    if (rw) for (const [s, v] of rw.add) b[s] += v;
  }
  return b;
}

function stats(p) {
  let c = p.stc;
  if (!c) {
    const ch = p.ch, cl = CLASSES[ch.cls], lv = ch.lvl, b = gearBonus(ch);
    const w = ch.eq.weapon, a = ch.eq.armor;
    const wAtk = w ? ITEMS[w.id].atk * (1 + 0.1 * w.enh) : 0;
    const aDef = a ? ITEMS[a.id].def * (1 + 0.1 * a.enh) : 0;
    const aHp = a ? ITEMS[a.id].hp + a.enh * 10 : 0;
    c = p.stc = {
      mhp: Math.round(cl.hp[0] + cl.hp[1] * lv + aHp + b.hp + ch.tr.vit * TRAIN.vit.gain),
      mmp: Math.round(cl.mp[0] + cl.mp[1] * lv + b.mp + ch.tr.int * TRAIN.int.gain),
      atk0: (cl.atk[0] + cl.atk[1] * lv + wAtk + b.atk + ch.tr.str * TRAIN.str.gain) * (1 + b.atkp / 100),
      def: Math.round(cl.def[0] + cl.def[1] * lv + aDef + b.def + ch.tr.grd * TRAIN.grd.gain),
      crit: Math.min(75, cl.crit + (w ? w.enh : 0) + b.crit),
      critd: 1.6 + b.critd / 100, ls: Math.min(15, b.ls), spd0: BASE_SPD * (1 + Math.min(40, b.spd) / 100), xp: b.xp, mf: b.mf,
    };
  }
  const now = p.S.now;
  return {
    mhp: c.mhp, mmp: c.mmp, def: c.def, crit: c.crit, critd: c.critd, ls: c.ls, xp: c.xp, mf: c.mf,
    atk: Math.round(c.atk0 * (p.atkBuff > now ? 1.25 : 1)),
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

export function setup() {
  const S = { seed: 20251111, now: 0, last: 0, nextId: 1, players: {}, maps: {}, parties: {}, chat: [], n: 0 };
  for (const id of Object.keys(MAPS)) {
    const rt = { id, mobs: [], drops: [], ev: [], tele: [], who: false, n: 0 };
    for (const sp of MAPS[id].spawns) {
      for (let i = 0; i < sp.n; i++) {
        const mob = { id: S.nextId++, k: sp.k, r: sp.r, x: 0, y: 0, hx: 0, hy: 0, hp: 0, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 0, wx: 0, wy: 0, by: {}, dead: false, respAt: 0, slow: 0, castAt: 0, el: false };
        placeMob(S, MAPS[id], mob);
        rt.mobs.push(mob);
      }
    }
    S.maps[id] = rt;
  }
  return S;
}

const ELITE = { hp: 3.5, atk: 1.4, xp: 4 };
const mobMax = (mob) => Math.round(MOBS[mob.k].hp * (mob.el ? ELITE.hp : 1));

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
  // now and then a champion spawns: far tougher, far more rewarding — party prey
  mob.el = !MOBS[mob.k].boss && rnd(S) < 0.08;
  mob.hp = mobMax(mob);
  mob.dead = false; mob.tgt = null; mob.by = {}; mob.st = 0; mob.slow = 0;
  mob.wx = mob.x; mob.wy = mob.y;
  mob.castAt = S.now + 5000;
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
    cds: [0, 0, 0], atkAt: 0, potAt: 0, hitAt: 0, mvAt: S.now, chatAt: 0, fullAt: 0, regenAt: S.now,
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
  return (g.enh > 0 ? `+${g.enh} ` : "") + ITEMS[g.id].name;
}
function sellPrice(s) {
  const it = ITEMS[s.id];
  if (!isGear(s.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.25 * (1 + 0.8 * (s.q | 0)) * (1 + 0.3 * (s.enh | 0)));
}

/** Roll one piece of gear: rarity decides how many affixes, item level how big. */
function rollGear(S, id, q, ilvl) {
  const g = plain(id);
  g.q = q;
  const [lo, hi] = RARITY_AFFIX[q];
  const pool = AFFIX.slice();
  for (let n = ri(S, lo, hi); n > 0 && pool.length; n--) {
    const [key, , , min, max, grow] = pool.splice(ri(S, 0, pool.length - 1), 1)[0];
    g.af.push([key, Math.max(1, Math.round((min + rnd(S) * (max - min) + grow * ilvl) * (q === 3 ? 1.3 : 1)))]);
  }
  if (ITEMS[id].type !== "acc") {
    const r = rnd(S);
    g.sk = (r < 0.12 ? 2 : r < 0.45 ? 1 : 0) + (q === 3 ? 1 : 0);
  }
  return g;
}
function rollRarity(S, d, el, mf) {
  const k = 1 + mf / 100;
  const r = rnd(S);
  const legend = (d.boss ? 0.15 : el ? 0.06 : 0.015) * k;
  const rare = (d.boss ? 0.5 : el ? 0.3 : 0.1) * k;
  const magic = 0.38 * k;
  return r < legend ? 3 : r < legend + rare ? 2 : r < legend + rare + magic ? 1 : 0;
}
function tierFor(lv) {
  return lv < 8 ? 1 : lv < 16 ? 2 : lv < 26 ? 3 : lv < 38 ? 4 : 5;
}

/** What one looter finds on one corpse. Everyone in the party rolls their own. */
function lootFor(S, rt, mob, p) {
  const d = MOBS[mob.k];
  const st = stats(p);
  const out = [];
  const share = allies(S, p).length;
  out.push({ it: "gold", n: Math.max(1, Math.round((ri(S, d.gold[0], d.gold[1]) * (mob.el ? 3 : 1)) / share)) });
  const tries = d.boss ? 3 : 1;
  for (let i = 0; i < tries; i++) {
    if (rnd(S) >= (mob.el ? 0.6 : d.gear) * (1 + st.mf / 100)) continue;
    let tier = tierFor(d.lv);
    if ((mob.el || d.boss) && rnd(S) < 0.25) tier = Math.min(5, tier + 1);
    const r = rnd(S);
    let id = r < 0.4 ? `w_${p.ch.cls}_${tier}` : r < 0.8 ? `a_${tier}` : `c_${clamp(tier - 1, 1, 3)}`;
    let q = rollRarity(S, d, mob.el, st.mf);
    if (ITEMS[id].type === "acc" && q === 0) q = 1;
    out.push({ g: rollGear(S, id, q, d.lv) });
  }
  if (rnd(S) < (d.boss ? 1 : mob.el ? 0.25 : 0.02 + d.lv * 0.001)) out.push({ it: `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`, n: 1 });
  if (rnd(S) < (d.boss ? 1 : mob.el ? 0.5 : 0.05)) out.push({ it: "stone", n: d.boss ? ri(S, 3, 6) : 1 });
  if (rnd(S) < 0.12) out.push({ it: d.lv < 8 ? "hp_s" : "hp_m", n: 1 });
  if (rnd(S) < 0.08) out.push({ it: d.lv < 8 ? "mp_s" : "mp_m", n: 1 });
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

function hurtMob(S, rt, mob, p, mult, sure) {
  if (mob.dead) return;
  const st = stats(p);
  const d = MOBS[mob.k];
  const crit = sure || rnd(S) * 100 < st.crit;
  let dmg = st.atk * mult * (0.85 + rnd(S) * 0.3) * (crit ? st.critd : 1) - d.def * 0.5;
  dmg = Math.max(1, Math.round(dmg));
  mob.hp -= dmg;
  mob.by[p.pid] = (mob.by[p.pid] || 0) + dmg;
  if (!mob.tgt) mob.tgt = p.pid;
  rt.ev.push(["h", mob.id, dmg, crit ? 1 : 0, 0]);
  if (st.ls > 0 && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + Math.max(1, Math.round((dmg * st.ls) / 100)));
  if (mob.hp <= 0) killMob(S, rt, mob);
}

function killMob(S, rt, mob) {
  const d = MOBS[mob.k];
  mob.dead = true;
  mob.respAt = S.now + d.resp;
  mob.tgt = null;
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
  const xp = d.xp * (mob.el ? ELITE.xp : 1);
  for (const p of looters) {
    const n = Math.min(PARTY_MAX, allies(S, p).length);
    gainXp(S, p, xp * PARTY_SHARE[n - 1]);
    p.ch.kills = (p.ch.kills || 0) + 1;
    const q = p.ch.q;
    const quest = QUESTS[q.i];
    if (q.st === 1 && quest && quest.mob === mob.k && q.n < quest.n) {
      q.n++;
      p.dirty = true;
      if (q.n >= quest.n) toast(p, `의뢰 [${quest.title}] 달성! 관리자에게 돌아가세요.`);
    }
    lootFor(S, rt, mob, p);
  }
  if (d.boss && top) sys(S, `${top.ch.name}님의 일행이 ${d.name}을(를) 쓰러뜨렸습니다!`);
}
function hurtPlayer(S, rt, p, raw) {
  if (p.dead) return;
  const st = stats(p);
  const dmg = Math.max(1, Math.round(raw * (0.85 + rnd(S) * 0.3) - st.def * 0.6));
  p.hp -= dmg;
  p.hitAt = S.now;
  rt.ev.push(["h", p.eid, dmg, 0, 1]);
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    dropAggro(S, p);
    rt.ev.push(["pd", p.eid]);
    toast(p, "쓰러졌습니다...");
  }
}

const big = (mob) => (MOBS[mob.k].boss ? 12 : 0);
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
function face(p, mob) {
  p.dir = dirOf(mob.x - p.x, mob.y - p.y);
}
const DX = [0, -1, 1, 0], DY = [1, 0, 0, -1];

function basicAttack(S, p) {
  const c = CLASSES[p.ch.cls];
  const rt = S.maps[p.map];
  p.atkAt = S.now;
  const mob = nearestMob(rt, p.x, p.y, c.range);
  if (mob) {
    face(p, mob);
    rt.ev.push(["a", p.eid, c.fx, Math.round(mob.x), Math.round(mob.y - 6), p.dir]);
    // a greatsword's arc catches whatever stands next to the target
    const extra = c.cleave > 1 ? mobsWithin(rt, mob.x, mob.y, 26).filter((o) => o !== mob).slice(0, c.cleave - 1) : [];
    hurtMob(S, rt, mob, p, 1);
    for (const o of extra) hurtMob(S, rt, o, p, 0.6);
  } else {
    const reach = c.range < 40 ? 14 : c.range * 0.7;
    rt.ev.push(["a", p.eid, c.fx, Math.round(p.x + DX[p.dir] * reach), Math.round(p.y - 6 + DY[p.dir] * reach), p.dir]);
  }
}

function castSkill(S, p, i) {
  const sk = SKILLS[p.ch.cls][i];
  const c = CLASSES[p.ch.cls];
  const rt = S.maps[p.map];
  const m = MAPS[p.map];
  p.mp -= sk.mp;
  p.cds[i] = S.now + sk.cd;
  p.atkAt = S.now;
  p.dirty = true;
  const ev = (kind, x, y) => rt.ev.push(["a", p.eid, kind, Math.round(x), Math.round(y), p.dir]);
  const aimAt = (range) => {
    const mob = nearestMob(rt, p.x, p.y, range);
    if (mob) face(p, mob);
    return mob;
  };
  switch (sk.id) {
    case "strike": case "vital": {
      const mob = aimAt(c.range + 8);
      const kind = sk.id === "strike" ? 10 : 18;
      if (mob) { ev(kind, mob.x, mob.y - 6); hurtMob(S, rt, mob, p, sk.mult, sk.id === "vital"); }
      else ev(kind, p.x + DX[p.dir] * 14, p.y - 6 + DY[p.dir] * 14);
      break;
    }
    case "spin":
      ev(11, p.x, p.y - 6);
      for (const mob of mobsWithin(rt, p.x, p.y, sk.r)) hurtMob(S, rt, mob, p, sk.mult);
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
    case "dash": {
      const mob = aimAt(sk.len);
      if (!mob) { ev(19, p.x, p.y - 6); break; }
      const d = dist(p.x, p.y, mob.x, mob.y) || 1;
      const ux = (mob.x - p.x) / d, uy = (mob.y - p.y) / d;
      const ox = p.x, oy = p.y;
      // land behind the target if there is room, otherwise right in front of it
      for (const k of [14, -14]) {
        const nx = mob.x + ux * k, ny = mob.y + uy * k;
        if (canStand(m, nx, ny)) { p.x = nx; p.y = ny; break; }
      }
      p.fix = true;
      p.mvAt = S.now;
      face(p, mob);
      rt.ev.push(["d", p.eid, Math.round(ox), Math.round(oy - 8), Math.round(p.x), Math.round(p.y - 8)]);
      ev(18, mob.x, mob.y - 6);
      hurtMob(S, rt, mob, p, sk.mult);
      break;
    }
    case "smoke":
      dropAggro(S, p);
      p.spdBuff = S.now + sk.dur;
      ev(20, p.x, p.y - 6);
      break;
    case "multi": {
      const list = mobsWithin(rt, p.x, p.y, c.range + 10)
        .sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y)).slice(0, 3);
      if (list.length) face(p, list[0]);
      else ev(1, p.x + DX[p.dir] * 70, p.y - 6 + DY[p.dir] * 70);
      for (const mob of list) { ev(1, mob.x, mob.y - 6); hurtMob(S, rt, mob, p, sk.mult); }
      break;
    }
    case "pierce": {
      const mob = aimAt(sk.len);
      let ux = DX[p.dir], uy = DY[p.dir];
      if (mob) {
        const d = dist(p.x, p.y, mob.x, mob.y) || 1;
        ux = (mob.x - p.x) / d; uy = (mob.y - p.y) / d;
      }
      ev(13, p.x + ux * sk.len, p.y - 6 + uy * sk.len);
      for (const o of rt.mobs) {
        if (o.dead) continue;
        const rx = o.x - p.x, ry = o.y - p.y;
        const along = rx * ux + ry * uy;
        const off = Math.abs(rx * uy - ry * ux);
        if (along > -4 && along < sk.len && off < (MOBS[o.k].boss ? 24 : 13)) hurtMob(S, rt, o, p, sk.mult);
      }
      break;
    }
    case "fireball": case "nade": {
      const mob = aimAt(c.range + 10);
      const tx = mob ? mob.x : p.x + DX[p.dir] * 70, ty = mob ? mob.y : p.y + DY[p.dir] * 70;
      ev(sk.id === "nade" ? 21 : 15, tx, ty - 6);
      for (const o of mobsWithin(rt, tx, ty, sk.r)) hurtMob(S, rt, o, p, sk.mult);
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
        const st = stats(o);
        const amt = Math.round(st.mhp * 0.35);
        o.hp = Math.min(st.mhp, o.hp + amt);
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
  }
  if (p.dead) return bad("쓰러진 상태입니다");
  switch (a.t) {
    case "mv":
      if (!num(a.x) || !num(a.y)) return bad("잘못된 좌표");
      return OK;
    case "atk":
      if (now - p.atkAt < CLASSES[ch.cls].cd - 60) return bad("아직 공격할 수 없습니다");
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
      if (!it || it.type !== "pot") return bad("사용할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (now < p.potAt) return bad("물약 재사용 대기 중입니다");
      return OK;
    }
    case "eq": {
      const s = ch.inv[a.s];
      if (!s || !isGear(s.id)) return bad("장착할 수 없습니다");
      const it = ITEMS[s.id];
      if (it.cls && it.cls !== ch.cls) return bad("다른 직업의 장비입니다");
      if (ch.lvl < it.req) return bad(`레벨 ${it.req}부터 착용할 수 있습니다`);
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
      if (a.k !== "weapon" && a.k !== "armor") return bad("강화할 수 없는 부위");
      const g = ch.eq[a.k];
      if (!g) return bad("장착한 장비가 없습니다");
      if (g.enh >= 10) return bad("최대 강화 단계입니다");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      const c = enhCost(g);
      if (ch.gold < c.gold) return bad("골드가 부족합니다");
      if (countItem(ch, "stone") < c.stone) return bad("강화석이 부족합니다");
      return OK;
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
      p.potAt = now + 900;
      if (it.heal) { p.hp = Math.min(st.mhp, p.hp + it.heal); S.maps[p.map].ev.push(["h", p.eid, -it.heal, 0, 1]); }
      if (it.mana) p.mp = Math.min(st.mmp, p.mp + it.mana);
      S.maps[p.map].ev.push(["u", p.eid, it.heal ? 0 : 1]);
      p.dirty = true;
      break;
    }
    case "eq": {
      const s = ch.inv[a.s];
      const k = ITEMS[s.id].type;
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
    if (now >= mob.respAt) { placeMob(S, m, mob); rt.ev.push(["r", mob.id]); }
    return;
  }
  const speed = d.spd * (mob.slow > now ? 0.5 : 1);
  const atk = d.atk * (mob.el ? ELITE.atk : 1);
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
    if (d.boss && now >= mob.castAt) {
      mob.castAt = now + 6500;
      // one blast on every player in the fight: stand still and the whole party pays
      for (const pid of Object.keys(S.players)) {
        const o = S.players[pid];
        if (o.map !== m.id || o.dead || dist(mob.x, mob.y, o.x, o.y) > 220) continue;
        rt.tele.push({ x: o.x, y: o.y, r: 40, at: now + 1300, dmg: atk * 1.7 });
        rt.ev.push(["t", Math.round(o.x), Math.round(o.y), 40, 1300]);
      }
    }
    if (dd <= d.range) {
      if (now >= mob.atkAt) {
        mob.atkAt = now + d.cd;
        mob.dir = tgt.x < mob.x ? 1 : 2;
        rt.ev.push(d.shot ? ["m", mob.id, Math.round(tgt.x), Math.round(tgt.y - 8)] : ["m", mob.id]);
        hurtPlayer(S, rt, tgt, atk);
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
          if (dr.q === 3) sys(S, `${p.ch.name}님이 전설 장비 [${ITEMS[dr.it].name}]을(를) 획득했습니다!`);
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
    if (p.dead || now - p.regenAt < 1000) continue;
    p.regenAt = now;
    const st = stats(p);
    const calm = now - p.hitAt > 5000;
    if (calm && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + (MAPS[p.map].safe ? st.mhp * 0.08 : st.mhp * 0.02) + 1);
    if (p.mp < st.mmp) p.mp = Math.min(st.mmp, p.mp + st.mmp * 0.03 + 1);
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
  return {
    name: ch.name, cls: ch.cls, lvl: ch.lvl, xp: ch.xp, need: ch.lvl >= MAXLV ? 0 : xpNeed(ch.lvl), gold: ch.gold,
    mhp: st.mhp, mmp: st.mmp, atk: st.atk, def: st.def, crit: st.crit, critd: Math.round(st.critd * 100), ls: st.ls, xpb: st.xp, mf: st.mf, spd: st.spd0,
    inv: ch.inv, eq: ch.eq, q: ch.q, kills: ch.kills || 0, tr: ch.tr, trc,
    enh: { weapon: ch.eq.weapon ? enhCost(ch.eq.weapon) : null, armor: ch.eq.armor ? enhCost(ch.eq.armor) : null },
    cds: p.cds.map((t) => Math.max(0, t - now)),
    buffs: [Math.max(0, p.atkBuff - now), Math.max(0, p.spdBuff - now)],
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
    me: [Math.round(p.x), Math.round(p.y), Math.round(p.hp), Math.round(p.mp), p.dead ? 1 : 0, p.fix ? 1 : 0, p.dir],
    P: [], M: [], D: [],
  };
  for (const oid of Object.keys(S.players)) {
    const o = S.players[oid];
    if (o === p || o.map !== p.map || !near(o)) continue;
    out.P.push([o.eid, Math.round(o.x), Math.round(o.y), o.dir, o.dead ? 1 : 0, Math.round(o.hp), stats(o).mhp]);
  }
  for (const mob of rt.mobs) {
    if (mob.dead || !near(mob)) continue;
    out.M.push([mob.id, mob.k, Math.round(mob.x), Math.round(mob.y), mob.dir, Math.ceil(mob.hp), mob.el ? 1 : 0]);
  }
  for (const dr of rt.drops) {
    if (near(dr) && (dr.own === pid || S.now >= dr.freeAt)) out.D.push([dr.id, dr.it, Math.round(dr.x), Math.round(dr.y), dr.q]);
  }
  if (rt.ev.length) out.ev = rt.ev;
  if (S.chat.length) out.chat = S.chat;
  if (p.sendMap) out.map = mapPayload(MAPS[p.map]);
  if (p.sendMap || rt.who) {
    out.who = [];
    for (const oid of Object.keys(S.players)) {
      const o = S.players[oid];
      if (o.map !== p.map) continue;
      // what everyone can see of this player, gear included: armour tier, weapon
      // tier, party, weapon rarity and enhancement, accessory tier
      const ar = o.ch.eq.armor, wp = o.ch.eq.weapon, ac = o.ch.eq.acc;
      out.who.push([o.eid, o.ch.name, o.ch.cls, o.ch.lvl, o.ch.look, ar ? ITEMS[ar.id].tier : 0, wp ? ITEMS[wp.id].tier : 0, o.party,
        wp ? wp.q : 0, wp ? wp.enh : 0, ac ? ITEMS[ac.id].tier : 0]);
    }
  }
  if (p.party) {
    out.party = members(S, p).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, Math.round(o.hp), stats(o).mhp, o.map === p.map ? "" : MAPS[o.map].name]);
  }
  if (p.pinv) {
    const from = S.players[p.pinv.from];
    if (from) out.pinv = from.ch.name;
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
    mobs[k] = { name: d.name, sp: d.sp, lv: d.lv, hp: d.hp, boss: d.boss ? 1 : 0 };
  }
  const classes = {};
  for (const k of Object.keys(CLASSES)) classes[k] = { name: CLASSES[k].name, arm: CLASSES[k].arm, cd: CLASSES[k].cd, range: CLASSES[k].range };
  const affix = {};
  for (const [k, label, prefix] of AFFIX) affix[k] = [label, prefix];
  return {
    items: ITEMS, mobs, classes, skills: SKILLS, shop: SHOP, quests: QUESTS, enh: ENH_RATE, inv: INV, maxLv: MAXLV,
    affix, runes: RUNES, runewords: RUNEWORDS, rarity: RARITY, train: TRAIN, eliteHp: ELITE.hp, partyMax: PARTY_MAX,
  };
}
