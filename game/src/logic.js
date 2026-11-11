/**
 * 루멘테일 온라인 — the whole game world, as plain rules.
 *
 * This file is the single source of truth for the game: item / monster / skill
 * tables, the four maps, and the simulation (movement checks, combat, loot,
 * quests, enhancement). The room (`room.ts`) only moves bytes: it feeds player
 * actions and the clock in, and fans the per-player views out. The browser gets
 * every table it needs from `defs()` and every map from the server, so nothing
 * here is duplicated on the client.
 *
 * Real-time notes:
 *   - time is never read here; the room passes `now` in (`state.now`, `tick`).
 *   - randomness comes from a seed carried in the state.
 *   - the world lives in the room's memory and is advanced in place for speed;
 *     only characters are persisted (see `exportChar`).
 */

export const meta = { game: "루멘테일 온라인", minPlayers: 1, maxPlayers: 40 };

const T = 16;
const INV = 24;
const MAXLV = 30;
const STACK = 99;
const VIEW_X = 280;
const VIEW_Y = 200;
const BASE_SPD = 72;

// ───────────────────────────── tables ─────────────────────────────

const CLASSES = {
  warrior: { name: "전사", hp: [110, 22], mp: [30, 4], atk: [8, 2.2], def: [2, 0.8], cd: 550, range: 30, fx: 0 },
  archer: { name: "궁수", hp: [85, 15], mp: [40, 6], atk: [7, 2.0], def: [1, 0.5], cd: 650, range: 112, fx: 1 },
  mage: { name: "마법사", hp: [75, 13], mp: [60, 10], atk: [9, 2.4], def: [1, 0.4], cd: 800, range: 100, fx: 2 },
};

const SKILLS = {
  warrior: [
    { id: "strike", name: "강타", lv: 3, mp: 6, cd: 4000, mult: 2.1, desc: "가까운 적 하나에게 강력한 일격 (210%)" },
    { id: "spin", name: "회전베기", lv: 7, mp: 12, cd: 8000, mult: 1.5, r: 46, desc: "주변의 모든 적을 벤다 (150%)" },
    { id: "shout", name: "전투함성", lv: 12, mp: 15, cd: 30000, dur: 10000, desc: "10초간 공격력 30% 증가" },
  ],
  archer: [
    { id: "multi", name: "연속 사격", lv: 3, mp: 7, cd: 4500, mult: 1.0, desc: "가까운 적 최대 3명에게 화살 (100%)" },
    { id: "pierce", name: "관통 화살", lv: 7, mp: 12, cd: 8000, mult: 2.0, len: 160, desc: "일직선의 적을 모두 꿰뚫는다 (200%)" },
    { id: "haste", name: "바람걸음", lv: 12, mp: 14, cd: 25000, dur: 8000, desc: "8초간 이동속도 40% 증가" },
  ],
  mage: [
    { id: "fireball", name: "화염구", lv: 3, mp: 10, cd: 4500, mult: 1.9, r: 34, desc: "폭발하는 불덩이 (범위 190%)" },
    { id: "nova", name: "빙결 파동", lv: 7, mp: 16, cd: 9000, mult: 1.4, r: 58, desc: "주변 적에게 피해를 주고 느리게 한다" },
    { id: "heal", name: "치유의 빛", lv: 12, mp: 22, cd: 15000, r: 72, desc: "자신과 주변 아군의 HP 35% 회복" },
  ],
};

const WEAPON_NAMES = {
  warrior: ["낡은 검", "강철 검", "기사의 검", "수정 대검"],
  archer: ["사냥꾼의 활", "합성 활", "바람의 활", "수정 활"],
  mage: ["견습 지팡이", "마력 지팡이", "현자의 지팡이", "수정 지팡이"],
};
const ARMOR_NAMES = ["천 옷", "가죽 갑옷", "사슬 갑옷", "수정 갑옷"];
const W_ATK = [5, 12, 22, 36];
const A_DEF = [2, 5, 9, 15];
const A_HP = [0, 25, 60, 110];
const G_REQ = [1, 6, 11, 16];
const G_PRICE = [80, 700, 2500, 8000];

const ITEMS = {
  hp_s: { name: "빨간 물약", type: "pot", heal: 60, price: 20, desc: "HP를 60 회복한다." },
  hp_m: { name: "큰 빨간 물약", type: "pot", heal: 180, price: 70, desc: "HP를 180 회복한다." },
  mp_s: { name: "파란 물약", type: "pot", mana: 40, price: 25, desc: "MP를 40 회복한다." },
  mp_m: { name: "큰 파란 물약", type: "pot", mana: 120, price: 80, desc: "MP를 120 회복한다." },
  stone: { name: "강화석", type: "mat", price: 150, desc: "대장장이에게 가져가면 장비를 강화할 수 있다." },
};
for (const cls of Object.keys(WEAPON_NAMES)) {
  for (let t = 1; t <= 4; t++) {
    ITEMS[`w_${cls}_${t}`] = {
      name: WEAPON_NAMES[cls][t - 1], type: "weapon", cls, tier: t,
      atk: W_ATK[t - 1], req: G_REQ[t - 1], price: G_PRICE[t - 1],
    };
  }
}
for (let t = 1; t <= 4; t++) {
  ITEMS[`a_${t}`] = {
    name: ARMOR_NAMES[t - 1], type: "armor", tier: t,
    def: A_DEF[t - 1], hp: A_HP[t - 1], req: G_REQ[t - 1], price: G_PRICE[t - 1],
  };
}

/** What the general store sells. "W1"/"W2" resolve to the buyer's class weapon. */
const SHOP = ["hp_s", "hp_m", "mp_s", "mp_m", "stone", "W1", "W2", "a_1", "a_2"];

/** Success chance for going from +n to +n+1. A failure at +5 or above drops one level. */
const ENH_RATE = [100, 95, 90, 80, 70, 55, 45, 35, 25, 15];

const MOBS = {
  slime: { name: "초록 슬라임", sp: "slime", lv: 1, hp: 28, atk: 5, def: 0, spd: 22, xp: 9, gold: [2, 6], aggro: 0, range: 16, cd: 1300, resp: 7000,
    drops: [["hp_s", 0.12], ["stone", 0.02]] },
  bslime: { name: "파랑 슬라임", sp: "bslime", lv: 3, hp: 58, atk: 9, def: 0, spd: 26, xp: 18, gold: [4, 10], aggro: 0, range: 16, cd: 1300, resp: 8000,
    drops: [["hp_s", 0.12], ["mp_s", 0.12], ["stone", 0.03]] },
  shroom: { name: "독버섯", sp: "shroom", lv: 5, hp: 90, atk: 14, def: 1, spd: 30, xp: 30, gold: [6, 14], aggro: 60, range: 17, cd: 1200, resp: 9000,
    drops: [["hp_s", 0.15], ["stone", 0.05], ["A2", 0.01]] },
  boar: { name: "멧돼지", sp: "boar", lv: 8, hp: 165, atk: 23, def: 3, spd: 48, xp: 58, gold: [10, 22], aggro: 76, range: 18, cd: 1100, resp: 10000,
    drops: [["hp_m", 0.08], ["stone", 0.06], ["W2", 0.015], ["A2", 0.015]] },
  bat: { name: "밤박쥐", sp: "bat", lv: 10, hp: 140, atk: 29, def: 2, spd: 60, xp: 76, gold: [12, 26], aggro: 90, range: 16, cd: 1000, resp: 10000, fly: true,
    drops: [["mp_m", 0.08], ["stone", 0.07], ["W3", 0.006]] },
  skel: { name: "해골 병사", sp: "skel", lv: 13, hp: 280, atk: 40, def: 6, spd: 40, xp: 130, gold: [18, 40], aggro: 84, range: 19, cd: 1100, resp: 12000,
    drops: [["hp_m", 0.1], ["stone", 0.09], ["W3", 0.02], ["A3", 0.02]] },
  golem: { name: "수정 골렘", sp: "golem", lv: 16, hp: 520, atk: 54, def: 12, spd: 27, xp: 240, gold: [30, 60], aggro: 72, range: 21, cd: 1500, resp: 15000,
    drops: [["hp_m", 0.12], ["mp_m", 0.1], ["stone", 0.14], ["W3", 0.03], ["A3", 0.03], ["A4", 0.004]] },
  boss: { name: "수정 군주 크리온", sp: "boss", lv: 20, hp: 6500, atk: 82, def: 15, spd: 34, xp: 3200, gold: [900, 1500], aggro: 120, range: 30, cd: 1400, resp: 180000, boss: true,
    drops: [["W4", 0.35], ["A4", 0.35], ["stone", 1, 3, 6], ["hp_m", 1, 3, 5]] },
};

const QUESTS = [
  { mob: "slime", n: 5, title: "슬라임 소탕", text: "마을 밖 바람초원에 슬라임이 너무 불어났다네. 초록 슬라임 5마리만 정리해 주겠나?", xp: 90, gold: 60, items: [["hp_s", 5]] },
  { mob: "bslime", n: 6, title: "파란 말썽꾼", text: "초원 남쪽의 파랑 슬라임이 여행자들의 짐을 적시고 다닌다네. 6마리를 처치해 주게.", xp: 220, gold: 120, items: [["mp_s", 5]] },
  { mob: "shroom", n: 8, title: "독버섯 주의보", text: "연못 근처에 독버섯이 번지고 있어. 8마리를 뽑아 주면 강화석을 주겠네.", xp: 520, gold: 200, items: [["stone", 2]] },
  { mob: "boar", n: 10, title: "숲의 난폭자", text: "속삭임 숲의 멧돼지들이 나무꾼을 들이받고 있다네. 10마리를 혼내 주게.", xp: 1200, gold: 450, items: [["hp_m", 5]] },
  { mob: "bat", n: 10, title: "밤의 날갯짓", text: "숲 동쪽에서 밤박쥐 떼가 날뛰고 있어. 10마리를 쫓아내 주게.", xp: 2000, gold: 600, items: [["stone", 3]] },
  { mob: "skel", n: 12, title: "동굴의 망령", text: "수정 동굴에서 해골 병사가 걸어 나온다는 소문이야. 12마리를 잠재워 주게.", xp: 3600, gold: 900, items: [["mp_m", 5]] },
  { mob: "golem", n: 8, title: "움직이는 수정", text: "동굴 깊은 곳의 수정 골렘 8마리를 부숴 주게. 조심하게나, 단단한 녀석들이야.", xp: 5200, gold: 1400, items: [["stone", 5]] },
  { mob: "boss", n: 1, title: "수정 군주", text: "이 모든 소란의 근원, 수정 군주 크리온을 쓰러뜨려 주게. 동료들과 함께 가는 게 좋을 걸세.", xp: 12000, gold: 5000, items: [["stone", 10]] },
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
const xpNeed = (lv) => Math.round(30 * Math.pow(lv, 1.7) + 20);

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
  const m = blank("town", "별빛 마을", 40, 30, ".");
  m.safe = true;
  m.bgm = "town";
  m.entry = [20, 18];
  scatter(m, box, m.g, ",", 0.14, ".");
  scatter(m, box, m.g, '"', 0.05, ".");
  border(m, "T", 2);
  rect(m.g, 14, 10, 25, 19, "o");
  road(m, 26, 14, 39, 14, "p");
  road(m, 9, 14, 13, 14, "p");
  road(m, 19, 4, 19, 9, "p");
  road(m, 19, 20, 19, 25, "p");
  road(m, 9, 9, 9, 14, "p");
  road(m, 29, 8, 29, 14, "p");
  road(m, 9, 14, 9, 20, "p");
  house(m, 8, 5, 0);
  house(m, 27, 4, 1);
  house(m, 7, 21, 2);
  house(m, 28, 20, 3);
  house(m, 17, 2, 2);
  rect(m.o, 19, 14, 20, 15, "a");
  m.big.push({ t: "fountain", x: 19, y: 14 });
  for (const [x, y] of [[14, 10], [25, 10], [14, 19], [25, 19]]) m.o[y][x] = "L";
  for (let x = 4; x <= 12; x++) if (x !== 9 && x !== 10) m.o[26][x] = "F";
  for (const [x, y] of [[5, 12], [33, 9], [34, 24], [5, 17], [23, 24], [13, 5], [24, 6]]) m.o[y][x] = "B";
  for (const [x, y] of [[32, 13], [12, 12]]) m.o[y][x] = "G";
  rect(m.g, 30, 22, 36, 26, '"');
  portal(m, 38, 14, "meadow", 4, 22);
  portal(m, 38, 15, "meadow", 4, 23);
  m.npcs.push(
    { id: "shop", name: "잡화상 리나", role: "shop", x: 10, y: 9, look: [4, 0, 1, "#e06a9a"] },
    { id: "smith", name: "대장장이 볼칸", role: "smith", x: 30, y: 8, look: [0, 1, 0, "#7a5540"] },
    { id: "elder", name: "촌장 엘더윈", role: "elder", x: 19, y: 11, look: [5, 0, 0, "#5a7fd0"] },
    { id: "guard", name: "경비병 토비", role: "talk", x: 35, y: 13, look: [1, 0, 0, "#8a8f9c"],
      say: "동쪽 문 너머는 바람초원이야. 슬라임은 순하지만 독버섯은 먼저 덤벼드니 조심해!" },
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
  scatter(m, box, m.o, "T", 0.05, ".,\"");
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
  scatter(m, box, m.o, "P", 0.1, ":;");
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

const MAPS = { town: buildTown(), meadow: buildMeadow(), forest: buildForest(), cave: buildCave() };
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

/** A brand-new character sheet — this is exactly what gets persisted. */
export function newChar(name, cls, look) {
  const c = CLASSES[cls] ? cls : "warrior";
  const lk = isObj(look) ? look : {};
  return {
    v: 1, name, cls: c,
    look: [clamp(lk.hair | 0, 0, 5), clamp(lk.skin | 0, 0, 2), clamp(lk.style | 0, 0, 1)],
    lvl: 1, xp: 0, gold: 50,
    inv: [{ id: "hp_s", n: 5 }, { id: "mp_s", n: 3 }],
    eq: { weapon: { id: `w_${c}_1`, enh: 0 }, armor: { id: "a_1", enh: 0 } },
    q: { i: 0, n: 0, st: 0 },
    map: START.map, x: START.x, y: START.y, hp: -1, mp: -1, kills: 0,
  };
}

function stats(p) {
  const c = CLASSES[p.ch.cls];
  const lv = p.ch.lvl;
  const w = p.ch.eq.weapon, a = p.ch.eq.armor;
  const wi = w ? ITEMS[w.id] : null, ai = a ? ITEMS[a.id] : null;
  const wAtk = wi ? wi.atk * (1 + 0.1 * w.enh) : 0;
  const aDef = ai ? ai.def * (1 + 0.1 * a.enh) : 0;
  const aHp = ai ? ai.hp + a.enh * 8 : 0;
  let atk = c.atk[0] + c.atk[1] * lv + wAtk;
  if (p.atkBuff > p.S.now) atk *= 1.3;
  return {
    mhp: Math.round(c.hp[0] + c.hp[1] * lv + aHp),
    mmp: Math.round(c.mp[0] + c.mp[1] * lv),
    atk: Math.round(atk),
    def: Math.round(c.def[0] + c.def[1] * lv + aDef),
    crit: 10 + (w ? w.enh : 0),
    spd: BASE_SPD * (p.spdBuff > p.S.now ? 1.4 : 1),
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
  const S = { seed: 20251111, now: 0, last: 0, nextId: 1, players: {}, maps: {}, chat: [], n: 0 };
  for (const id of Object.keys(MAPS)) {
    const rt = { mobs: [], drops: [], ev: [], tele: [], who: false, n: 0 };
    for (const sp of MAPS[id].spawns) {
      for (let i = 0; i < sp.n; i++) {
        const mob = { id: S.nextId++, k: sp.k, r: sp.r, x: 0, y: 0, hx: 0, hy: 0, hp: 0, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 0, wx: 0, wy: 0, by: {}, dead: false, respAt: 0, slow: 0, castAt: 0 };
        placeMob(S, MAPS[id], mob);
        rt.mobs.push(mob);
      }
    }
    S.maps[id] = rt;
  }
  return S;
}

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
  mob.hp = MOBS[mob.k].hp;
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
  if (!MAPS[ch.map]) ch.map = START.map;
  const p = {
    S, pid, eid: S.nextId++, ch, map: ch.map, x: ch.x, y: ch.y, dir: 0, hp: 1, mp: 0, dead: false,
    cds: [0, 0, 0], atkAt: 0, potAt: 0, hitAt: 0, mvAt: S.now, chatAt: 0, fullAt: 0, regenAt: S.now,
    atkBuff: 0, spdBuff: 0, act: 0, dirty: true, sendMap: true, fix: true, gain: [], toast: [],
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

// ───────────────────────────── inventory ─────────────────────────────

function isGear(id) {
  const t = ITEMS[id].type;
  return t === "weapon" || t === "armor";
}
function resolveItem(key, cls) {
  if (key[0] === "W" && key.length === 2) return `w_${cls}_${key[1]}`;
  if (key[0] === "A" && key.length === 2) return `a_${key[1]}`;
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
    for (let i = 0; i < n; i++) ch.inv.push({ id, enh: 0 });
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

// ───────────────────────────── combat ─────────────────────────────

function gainXp(S, p, n) {
  const ch = p.ch;
  if (ch.lvl >= MAXLV) return;
  ch.xp += n;
  p.gain.push(["xp", n]);
  while (ch.lvl < MAXLV && ch.xp >= xpNeed(ch.lvl)) {
    ch.xp -= xpNeed(ch.lvl);
    ch.lvl++;
    const st = stats(p);
    p.hp = st.mhp; p.mp = st.mmp;
    p.gain.push(["lvl", ch.lvl]);
    S.maps[p.map].ev.push(["l", p.eid]);
    S.maps[p.map].who = true;
    for (const sk of SKILLS[ch.cls]) if (sk.lv === ch.lvl) toast(p, `새 스킬 [${sk.name}]을(를) 배웠습니다!`);
    if (ch.lvl % 10 === 0) sys(S, `${ch.name}님이 레벨 ${ch.lvl}을(를) 달성했습니다!`);
  }
  if (ch.lvl >= MAXLV) ch.xp = 0;
  p.dirty = true;
}

function hurtMob(S, rt, mob, p, mult) {
  if (mob.dead) return;
  const st = stats(p);
  const d = MOBS[mob.k];
  const crit = rnd(S) * 100 < st.crit;
  let dmg = st.atk * mult * (0.85 + rnd(S) * 0.3) * (crit ? 1.6 : 1) - d.def * 0.5;
  dmg = Math.max(1, Math.round(dmg));
  mob.hp -= dmg;
  mob.by[p.pid] = (mob.by[p.pid] || 0) + dmg;
  if (!mob.tgt) mob.tgt = p.pid;
  rt.ev.push(["h", mob.id, dmg, crit ? 1 : 0, 0]);
  if (mob.hp <= 0) killMob(S, rt, mob);
}

function killMob(S, rt, mob) {
  const d = MOBS[mob.k];
  mob.dead = true;
  mob.respAt = S.now + d.resp;
  mob.tgt = null;
  rt.ev.push(["k", mob.id]);
  let top = null, topDmg = 0;
  for (const pid of Object.keys(mob.by)) {
    const p = S.players[pid];
    if (!p || p.dead) continue;
    if (mob.by[pid] > topDmg) { top = p; topDmg = mob.by[pid]; }
    gainXp(S, p, d.xp);
    p.ch.kills = (p.ch.kills || 0) + 1;
    const q = p.ch.q;
    const quest = QUESTS[q.i];
    if (q.st === 1 && quest && quest.mob === mob.k && q.n < quest.n) {
      q.n++;
      p.dirty = true;
      if (q.n >= quest.n) toast(p, `의뢰 [${quest.title}] 달성! 촌장에게 돌아가세요.`);
    }
  }
  mob.by = {};
  if (!top) return;
  const drop = (it, n) => rt.drops.push({
    id: S.nextId++, it, n, x: mob.x + ri(S, -10, 10), y: mob.y + ri(S, -6, 8),
    own: top.pid, freeAt: S.now + 8000, dieAt: S.now + 45000,
  });
  drop("gold", ri(S, d.gold[0], d.gold[1]));
  for (const [key, chance, a, b] of d.drops) {
    if (rnd(S) < chance) drop(resolveItem(key, top.ch.cls), a ? ri(S, a, b) : 1);
  }
  if (d.boss) sys(S, `${top.ch.name}님의 일행이 ${d.name}을(를) 쓰러뜨렸습니다!`);
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

function nearestMob(rt, x, y, range) {
  let best = null, bd = range;
  for (const mob of rt.mobs) {
    if (mob.dead) continue;
    const d = dist(x, y, mob.x, mob.y) - (MOBS[mob.k].boss ? 12 : 0);
    if (d <= bd) { bd = d; best = mob; }
  }
  return best;
}
function mobsWithin(rt, x, y, r) {
  return rt.mobs.filter((mob) => !mob.dead && dist(x, y, mob.x, mob.y) - (MOBS[mob.k].boss ? 12 : 0) <= r);
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
    hurtMob(S, rt, mob, p, 1);
  } else {
    const reach = c.fx === 0 ? 14 : c.range * 0.7;
    rt.ev.push(["a", p.eid, c.fx, Math.round(p.x + DX[p.dir] * reach), Math.round(p.y - 6 + DY[p.dir] * reach), p.dir]);
  }
}

function castSkill(S, p, i) {
  const sk = SKILLS[p.ch.cls][i];
  const c = CLASSES[p.ch.cls];
  const rt = S.maps[p.map];
  p.mp -= sk.mp;
  p.cds[i] = S.now + sk.cd;
  p.atkAt = S.now;
  p.dirty = true;
  const ev = (kind, x, y) => rt.ev.push(["a", p.eid, kind, Math.round(x), Math.round(y), p.dir]);
  switch (sk.id) {
    case "strike": {
      const mob = nearestMob(rt, p.x, p.y, c.range + 8);
      if (mob) { face(p, mob); ev(10, mob.x, mob.y - 6); hurtMob(S, rt, mob, p, sk.mult); }
      else ev(10, p.x + DX[p.dir] * 14, p.y - 6 + DY[p.dir] * 14);
      break;
    }
    case "spin":
      ev(11, p.x, p.y - 6);
      for (const mob of mobsWithin(rt, p.x, p.y, sk.r)) hurtMob(S, rt, mob, p, sk.mult);
      break;
    case "shout":
      p.atkBuff = S.now + sk.dur;
      ev(12, p.x, p.y - 6);
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
      const mob = nearestMob(rt, p.x, p.y, sk.len);
      let ux = DX[p.dir], uy = DY[p.dir];
      if (mob) {
        face(p, mob);
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
    case "haste":
      p.spdBuff = S.now + sk.dur;
      ev(14, p.x, p.y - 6);
      break;
    case "fireball": {
      const mob = nearestMob(rt, p.x, p.y, c.range + 10);
      const tx = mob ? mob.x : p.x + DX[p.dir] * 70, ty = mob ? mob.y : p.y + DY[p.dir] * 70;
      if (mob) face(p, mob);
      ev(15, tx, ty - 6);
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
  const m = MAPS[p.map];
  for (const n of m.npcs) {
    if (n.role === role && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < 56) return true;
  }
  return false;
}
const bad = (error) => ({ ok: false, error });
const OK = { ok: true };

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
  if (a.t === "respawn") return p.dead ? OK : bad("살아 있습니다");
  if (a.t === "chat") {
    if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
    if (now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
    return OK;
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
      if (a.k !== "weapon" && a.k !== "armor") return bad("잘못된 부위");
      if (!ch.eq[a.k]) return bad("장착한 장비가 없습니다");
      if (ch.inv.length >= INV) return bad("가방이 가득 찼습니다");
      return OK;
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
      if (a.k !== "weapon" && a.k !== "armor") return bad("잘못된 부위");
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
      if (!npcNear(p, "elder")) return bad("촌장이 너무 멉니다");
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

function enhCost(g) {
  const tier = ITEMS[g.id].tier;
  return { gold: 60 * tier * (g.enh + 1), stone: g.enh < 3 ? 1 : g.enh < 6 ? 2 : 3 };
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
      const tx = Math.floor(p.x / T), ty = Math.floor((p.y - 2) / T);
      for (const pt of m.portals) {
        if (pt.x === tx && pt.y === ty) { changeMap(S, p, pt.to, pt.tx * T + 8, pt.ty * T + 10); break; }
      }
      break;
    }
    case "atk":
      basicAttack(S, p);
      break;
    case "sk":
      castSkill(S, p, a.i);
      break;
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
      ch.eq[k] = { id: s.id, enh: s.enh | 0 };
      if (old) ch.inv[a.s] = { id: old.id, enh: old.enh };
      else ch.inv.splice(a.s, 1);
      afterGear(S, p);
      break;
    }
    case "uneq":
      ch.inv.push({ id: ch.eq[a.k].id, enh: ch.eq[a.k].enh });
      ch.eq[a.k] = null;
      afterGear(S, p);
      break;
    case "buy": {
      const id = resolveItem(a.id, ch.cls);
      const n = a.n | 0;
      ch.gold -= ITEMS[id].price * n;
      addItem(ch, id, n);
      p.gain.push(["item", id, n]);
      p.dirty = true;
      break;
    }
    case "sell": {
      const s = ch.inv[a.s];
      const n = a.n | 0;
      const each = Math.floor(ITEMS[s.id].price * 0.4 * (1 + 0.5 * (s.enh | 0)));
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
        for (const [id, n] of quest.items) { addItem(ch, id, n); p.gain.push(["item", id, n]); }
        ch.q = { i: ch.q.i + 1, n: 0, st: 0 };
        toast(p, `의뢰 완료: ${quest.title}`);
        gainXp(S, p, quest.xp);
      }
      p.dirty = true;
      break;
    }
    case "respawn": {
      const lost = Math.floor(ch.xp * 0.05);
      ch.xp -= lost;
      p.dead = false;
      changeMap(S, p, START.map, START.x, START.y);
      const st = stats(p);
      p.hp = st.mhp; p.mp = st.mmp;
      p.dirty = true;
      toast(p, lost > 0 ? `마을에서 깨어났습니다. (경험치 -${lost})` : "마을에서 깨어났습니다.");
      break;
    }
    case "chat": {
      const text = a.m.trim().slice(0, 80);
      p.chatAt = now;
      S.chat.push({ n: ch.name, m: text });
      S.maps[p.map].ev.push(["s", p.eid, text]);
      break;
    }
  }
  return S;
}

function afterGear(S, p) {
  const st = stats(p);
  p.hp = Math.min(p.hp, st.mhp);
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
      rt.tele.push({ x: tgt.x, y: tgt.y, r: 46, at: now + 1200, dmg: d.atk * 1.7 });
      rt.ev.push(["t", Math.round(tgt.x), Math.round(tgt.y), 46, 1200]);
    }
    if (dd <= d.range) {
      if (now >= mob.atkAt) {
        mob.atkAt = now + d.cd;
        mob.dir = tgt.x < mob.x ? 1 : 2;
        rt.ev.push(["m", mob.id]);
        hurtPlayer(S, rt, tgt, d.atk);
      }
    } else stepMob(m, mob, tgt.x, tgt.y, speed, dt, d.fly);
    return;
  }
  if (mob.st === 2) {
    mob.hp = Math.min(d.hp, mob.hp + d.hp * 0.2 * dt);
    if (stepMob(m, mob, mob.hx, mob.hy, speed * 1.4, dt, d.fly)) { mob.st = 0; mob.hp = d.hp; }
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
        } else if (addItem(p.ch, dr.it, dr.n)) {
          p.gain.push(["item", dr.it, dr.n]);
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
  return {
    name: ch.name, cls: ch.cls, lvl: ch.lvl, xp: ch.xp, need: xpNeed(ch.lvl), gold: ch.gold,
    mhp: st.mhp, mmp: st.mmp, atk: st.atk, def: st.def, crit: st.crit, spd: BASE_SPD,
    enh: { weapon: ch.eq.weapon ? enhCost(ch.eq.weapon) : null, armor: ch.eq.armor ? enhCost(ch.eq.armor) : null },
    inv: ch.inv, eq: ch.eq, q: ch.q, kills: ch.kills || 0,
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
    out.M.push([mob.id, mob.k, Math.round(mob.x), Math.round(mob.y), mob.dir, Math.ceil(mob.hp)]);
  }
  for (const dr of rt.drops) if (near(dr)) out.D.push([dr.id, dr.it, Math.round(dr.x), Math.round(dr.y)]);
  if (rt.ev.length) out.ev = rt.ev;
  if (S.chat.length) out.chat = S.chat;
  if (p.sendMap) out.map = mapPayload(MAPS[p.map]);
  if (p.sendMap || rt.who) {
    out.who = [];
    for (const oid of Object.keys(S.players)) {
      const o = S.players[oid];
      if (o.map !== p.map) continue;
      const ar = o.ch.eq.armor;
      out.who.push([o.eid, o.ch.name, o.ch.cls, o.ch.lvl, o.ch.look, ar ? ITEMS[ar.id].tier : 0]);
    }
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
  for (const k of Object.keys(CLASSES)) classes[k] = { name: CLASSES[k].name, cd: CLASSES[k].cd, range: CLASSES[k].range };
  return { items: ITEMS, mobs, classes, skills: SKILLS, shop: SHOP, quests: QUESTS, enh: ENH_RATE, inv: INV, maxLv: MAXLV };
}
