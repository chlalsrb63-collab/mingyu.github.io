/**
 * 마을 주민 — the townsfolk of 넥서스 광장 going about their day (docs/design/town.md H).
 *
 * Client-only and wire-free: every client works out each resident's place from the synced sky
 * clock (sky.js hour) and the resident's own plan, so two players see the same baker at the same
 * stall without a byte on the wire. Residents never block anyone, give no services and are no
 * quest targets (those are real NPCs); come within a tile and a half and one turns to you and says
 * a line in a speech bubble, at most once every 20 s.
 *
 * A plan has one anchor per sky phase (새벽 아침 낮 노을 밤): `null` (indoors: not drawn),
 * `[x, y, pose]` (idle there), or `{ loop: [[x, y]…], pose, lag }` (walking a round, `lag` tiles
 * behind its start). For the first quarter game-hour of a phase they walk the breadth-first path
 * from the last phase's anchor (a game hour is two real minutes; walking speed is the players' 3
 * tiles a second). Poses are iso_interior.js drawPose's (an unknown one draws nothing).
 *
 *   init(deps)              deps: { hour(), sheet(look, cos), dayMs() }
 *   load(map)               the town only (anything else clears them); paths are made on first use
 *   update(dt, me, now)     who turns to you and talks
 *   drawables(now)          [{ id, x, y, sheet, dir, frame, pose, seed }] in world pixels (≤ 16)
 *   bubbles(now)            [{ x, y, b }] speech bubbles to letter (client.js renderText)
 *   RESIDENTS, PHASE_AT     the plans (tests read them: every anchor must be reachable)
 */

/** The hour each phase begins (sky.js PHASES). */
export const PHASE_AT = [4.5, 7, 11, 17, 19.5];
/** Walking speed, tiles a second (BASE_SPD 48 px/s). */
const SPEED = 3;
/** How long a move between anchors may take, game hours. */
const MOVE_H = 0.25;
/** The fountain's chase round, the mail round, the forge errand, the north watch. */
const FOUNTAIN = [[47, 38], [52, 38], [53, 42], [47, 42]];
const MAIL = [[10, 35], [50, 26], [65, 38], [72, 50]];
const ERRAND = [[33, 38], [78, 36]];
const WATCH = [[30, 11], [70, 11]];

/**
 * The residents: id, name, look (species.js order: ear eye nose fur blush pat cloth sp tail acc eyeC),
 * cosmetics worn, the five anchors, their line (Korean, final: town.md H).
 */
export const RESIDENTS = [
  { id: "r_dotori", name: "도토리", look: [12, 2, 11, 10, 2, 7, 1, 14, 8, 2, 0], kid: 1,
    a: [null, [24, 52, "wave"], { loop: FOUNTAIN }, [48, 42, null], null], line: "술래잡기 할래? 나 엄청 빠르다!" },
  { id: "r_kongal", name: "콩알", look: [7, 3, 11, 20, 0, 7, 5, 6, 2, 1, 0], kid: 1,
    a: [null, [25, 52, null], { loop: FOUNTAIN, lag: 3 }, [51, 42, null], null], line: "도토리 잡았다! …아니 놓쳤다!" },
  { id: "r_bodeul", name: "보들 할머니", look: [9, 4, 2, 3, 4, 0, 9, 9, 5, 2, 0],
    a: [null, [44, 47, "knit"], [44, 47, "knit"], [36, 24, "read"], null], line: "털실이 남으면 목도리 떠 줄게." },
  { id: "r_neogul", name: "너굴 아저씨", look: [2, 13, 0, 14, 3, 5, 8, 11, 9, 9, 4], cos: ["back_pack"],
    a: [[33, 38, "carry"], [65, 39, "wave"], [65, 39, null], [74, 54, "sip"], [74, 53, "doze"]], line: "숲 너머 소식? 한 냥만 주면… 농담이야!" },
  { id: "r_gaegul", name: "개굴", look: [11, 6, 13, 19, 3, 7, 5, 7, 1, 2, 0], cos: ["hat_straw"],
    a: [[25, 56, "fish"], [25, 56, "fish"], [12, 51, "fish"], [29, 62, "sip"], null], line: "비 오는 날엔 큰 놈이 문다니까." },
  { id: "r_peng", name: "펭", look: [11, 6, 8, 15, 0, 7, 2, 8, 10, 1, 0], cos: ["hat_cap_blue"],
    a: [null, { loop: MAIL, pose: "carry" }, { loop: MAIL, pose: "carry", lag: 40 }, [50, 27, null], null], line: "편지 왔어요! …아, 당신 건 아니네요." },
  { id: "r_saessak", name: "새싹", look: [8, 9, 3, 11, 0, 4, 4, 12, 2, 2, 1], cos: ["hat_wreath_sun"],
    a: [[14, 28, "water"], [40, 27, "water"], [14, 28, "water"], [12, 40, null], null], line: "꽃이 피면 어둠도 조금 물러나는 것 같아요." },
  { id: "r_daenamu", name: "대나무", look: [2, 12, 7, 0, 3, 12, 7, 13, 2, 9, 0],
    a: [null, [50, 11, "hammer"], [50, 11, "hammer", 12, 13], [55, 42, null], null], line: "울타리 한 칸이면 모두가 한 밤 더 편히 자." },
  { id: "r_meongdae", name: "멍멍 대장", look: [3, 8, 3, 11, 2, 7, 2, 2, 6, 1, 0], cos: ["hat_helm"],
    a: [[41, 12, null], [41, 12, null], { loop: WATCH }, [41, 12, "wave"], [41, 12, null]], line: "북쪽 숲은 내가 지킨다! …무서운 건 아니고." },
  { id: "r_kkamang", name: "까망", look: [0, 13, 1, 15, 0, 7, 9, 1, 3, 1, 4],
    a: [[65, 12, null], [56, 14, "doze"], [56, 14, "doze"], [65, 12, null], [65, 12, null]], line: "밤엔 눈이 더 잘 보여. 어둠도 잘 보이지." },
  { id: "r_yeoreum", name: "여름", look: [3, 1, 6, 10, 2, 3, 6, 5, 4, 1, 4], cos: ["face_glasses"],
    a: [null, [38, 24, "read"], [52, 27, "write"], [38, 24, "read"], null], line: "도서관 3층에는 아무도 안 가 봤대. 3층이 없거든." },
  { id: "r_jjik", name: "찍찍", look: [5, 2, 9, 8, 0, 0, 3, 10, 7, 10, 0],
    a: [[78, 37, "carry"], { loop: ERRAND, pose: "carry" }, [78, 37, "hammer"], [72, 52, "sip"], null], line: "볼칸 아저씨 망치 소리 들으면 잠이 와요." },
  { id: "r_ggul", name: "꿀단지", look: [2, 3, 7, 9, 2, 0, 0, 4, 2, 2, 0], cos: ["hat_chef"],
    a: [[34, 38, "carry"], [71, 51, "stir"], [73, 52, "sweep"], [71, 51, "stir"], null], line: "오늘 국물은 엄마 손맛이야. 우리 엄마 손맛!" },
  { id: "r_riri", name: "리리", look: [1, 2, 1, 0, 0, 0, 4, 3, 5, 0, 6], cos: ["hat_bow_pink"],
    a: [[6, 42, "carry"], [6, 42, "water"], [13, 41, "knit"], [6, 42, "carry"], null], line: "빨래가 바람에 춤추면 비가 안 온대요." },
  { id: "r_noeul", name: "노을", look: [8, 4, 3, 12, 0, 4, 8, 12, 2, 2, 1], cos: ["hat_beret"],
    a: [null, null, [76, 53, null], [60, 48, "wave"], [60, 48, "wave"]], line: "모닥불엔 노래가 어울리지. 들어 볼래?" },
  { id: "r_bawi2", name: "반들", look: [4, 0, 3, 5, 0, 0, 7, 0, 0, 0, 0], cos: ["hat_cap_red"],
    a: [[24, 41, "wave"], [24, 41, null], [24, 41, null], [24, 46, null], null], line: "다리 건너면 살림 마을이에요. 발밑 조심!" },
];

let deps = null, map = null;
const paths = new Map();
const state = new Map();
export function init(d) { deps = d; }
export function load(m) {
  paths.clear(); state.clear();
  map = m && m.id === "town" ? m : null;
}

/** Whether tile (x, y) can be walked on (the map's own rule: no object, no water or rock). */
export function open(m, x, y) {
  return x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && m.g[y][x] !== "w" && m.g[y][x] !== "W";
}
/** The breadth-first path of tiles from a to b (both ends included), or null. */
export function path(m, ax, ay, bx, by) {
  const W = m.w, from = new Int32Array(W * m.h).fill(-1), s = ay * W + ax, e = by * W + bx, q = [s];
  from[s] = s;
  for (let h = 0; h < q.length && from[e] < 0; h++) {
    const i = q[h], x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const j = ny * W + nx;
      if (!open(m, nx, ny) || from[j] >= 0) continue;
      from[j] = i; q.push(j);
    }
  }
  if (from[e] < 0) return null;
  const out = [];
  for (let i = e; ; i = from[i]) { out.push([i % W, (i - (i % W)) / W]); if (i === s) break; }
  return out.reverse();
}
const pathOf = (a, b) => {
  const k = a[0] + "," + a[1] + ">" + b[0] + "," + b[1];
  if (!paths.has(k)) paths.set(k, path(map, a[0], a[1], b[0], b[1]) || [[a[0], a[1]], [b[0], b[1]]]);
  return paths.get(k);
};
/** A closed round through the loop's points, as one list of tiles. */
const roundOf = (loop) => {
  const k = "loop:" + loop.join(";");
  if (!paths.has(k)) {
    const out = [];
    for (let i = 0; i < loop.length; i++) { const p = pathOf(loop[i], loop[(i + 1) % loop.length]); out.push(...p.slice(0, -1)); }
    paths.set(k, out);
  }
  return paths.get(k);
};
/** Where along a list of tiles `d` tiles in: world pixels and which way it heads. */
function along(tiles, d) {
  const n = tiles.length;
  if (n < 2) return { x: tiles[0][0] * 16 + 8, y: tiles[0][1] * 16 + 10, dx: 0, dy: 1 };
  const i = Math.min(n - 2, Math.floor(d)), k = Math.min(1, d - i);
  const [x0, y0] = tiles[i], [x1, y1] = tiles[i + 1];
  return { x: (x0 + (x1 - x0) * k) * 16 + 8, y: (y0 + (y1 - y0) * k) * 16 + 10, dx: x1 - x0, dy: y1 - y0, walk: true };
}
/** The phase of hour h and the hours since it began. */
export function phaseAt(h) {
  for (let i = PHASE_AT.length - 1; i >= 0; i--) if (h >= PHASE_AT[i]) return [i, h - PHASE_AT[i]];
  return [PHASE_AT.length - 1, h + 24 - PHASE_AT[PHASE_AT.length - 1]];
}
const startOf = (a) => (!a ? null : Array.isArray(a) ? a : a.loop[0]);
/** Where resident r is at hour h: null (indoors) or { x, y, dx, dy, walk, pose }. */
export function placeAt(r, h, secPerHour = 120) {
  const [i, into] = phaseAt(h), A = r.a[i], P = r.a[(i + 4) % 5];
  if (!A) return null;
  const sec = into * secPerHour, from = startOf(P), to = startOf(A);
  // on the way from the last phase's place
  if (from && into < MOVE_H && (from[0] !== to[0] || from[1] !== to[1])) {
    const p = pathOf(from, to), d = sec * SPEED;
    if (d < p.length - 1) return { ...along(p, d), pose: null };
  }
  if (!Array.isArray(A)) {
    const round = roundOf(A.loop), lead = from && (from[0] !== to[0] || from[1] !== to[1]) ? pathOf(from, to).length - 1 : 0;
    const d = ((sec * SPEED * 0.6 - lead + (A.lag || 0)) % round.length + round.length) % round.length;
    return { ...along(round.concat([round[0]]), d), pose: A.pose || null };
  }
  // an idle spell (a dozing hour in the middle of the day's work)
  const doze = A.length > 4 && h >= A[3] && h < A[4];
  return { x: A[0] * 16 + 8, y: A[1] * 16 + 10, dx: 0, dy: 1, walk: false, pose: doze ? "doze" : A[2] || null };
}

const DIRS = { "1,0": "right", "-1,0": "left", "0,1": "front", "0,-1": "back" };
/** Who turns to you and what they say. */
export function update(dt, me, now = Date.now()) {
  if (!map || !deps || !me) return;
  const h = deps.hour();
  for (const r of RESIDENTS) {
    const s = state.get(r.id) || { said: -1e9, b: null };
    state.set(r.id, s);
    const at = placeAt(r, h, deps.dayMs() / 24000);
    s.at = at;
    if (!at) { s.b = null; continue; }
    const near = Math.hypot(at.x - me.x, at.y - me.y) < 24;
    s.face = near ? [Math.sign(Math.round((me.x - at.x) / 8)), Math.sign(Math.round((me.y - at.y) / 8))] : null;
    if (near && now - s.said > 20000) { s.said = now; s.b = { text: r.line, t0: now, until: now + 4200 }; }
    if (s.b && now > s.b.until) s.b = null;
  }
}
/** What to draw: residents out of doors right now, at most 16. */
export function drawables(now = Date.now()) {
  const out = [];
  if (!map || !deps) return out;
  for (const r of RESIDENTS) {
    const s = state.get(r.id);
    const at = s ? s.at : placeAt(r, deps.hour(), deps.dayMs() / 24000);
    if (!at || out.length >= 16) continue;
    let [fx, fy] = s && s.face && !at.walk ? s.face : [at.dx, at.dy];
    if (fx && fy) fy = 0;
    const dir = DIRS[fx + "," + fy] || "front";
    const step = at.walk ? (Math.floor(now / 170 + r.id.length) % 2 ? 2 : 4) : Math.floor(now / 700 + r.id.length) % 2;
    out.push({ id: r.id, x: at.x, y: at.y, sheet: deps.sheet(r.look, r.cos), dir, frame: step, pose: at.walk ? null : at.pose, seed: r.id.length * 13, kid: !!r.kid });
  }
  return out;
}
/** Speech bubbles showing now. */
export function bubbles(now = Date.now()) {
  const out = [];
  for (const r of RESIDENTS) { const s = state.get(r.id); if (s && s.b && s.at && now < s.b.until) out.push({ x: s.at.x, y: s.at.y, b: s.b }); }
  return out;
}
