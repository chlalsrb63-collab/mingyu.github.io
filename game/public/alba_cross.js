/**
 * 일일 아르바이트 · 횡단 배달 board (logic 67-alba-cross.js, contract in alba.js): a 13 × 11 street seen from above, drawn on a 156 × 143 art canvas (a 11-px header over the
 * 132-px street) scaled by a whole number.
 * view = [x ×100, row, ms to the next hop, drop-off row, delivery no., delivered, [[row, v, sp, len, kind (0 cart · 1 walker · 2 log), phase ×100]…], [[row, log | -1, cell]…],
 *         ev [seq, 1 delivered · 2 clean · 3 hit · 4 water · 5 gift, pts], ms until the lanes run, hops taken, ms since the delivery began]
 * The lanes are never sent moving: every object is `phase + v·t + j·sp` on a ring (the same closed form as the server's), so the street flows at the frame rate; the courier's own
 * hop is predicted here (and reconciled with the server's hop counter), the log that carries him is extrapolated. Scores, hits and drowning are the server's.
 * Keys: ← ↑ ↓ → / WASD (by key position, so a Korean IME still plays) · touch: the four buttons.
 * Look: a sunny village street (sand road, green median, a blue river, a wooden porch with an awning); a cat-eared courier with a red-ribbon parcel.
 */
const W = 13, H = 11, AU = 12, CW = W * AU, SH = H * AU, HEAD = 11, CH = SH + HEAD;
const OL = "#3a2830", FONT = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif", FONT11 = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BUDGET = [12000, 26000], COLORS = ["#e8604a", "#5a9af0", "#f0c040", "#6ac060", "#c080e0"];
const CLOTH = [["#fff0d0", "#e8604a"], ["#fff0d0", "#5a9af0"], ["#fff0d0", "#6ac060"], ["#fff0d0", "#c080e0"]];

let host = null, api = null, cv = null, g = null, u = 1, sig = "", wrap = null, stops = [], boardEl = null, boardWas = "";
let st = null, me = { x: 6, y: 10, t0: 0 }, cs = 0, lastSend = 0, cdUntil = 0, evSeq = -1, phase = "brief", face = 0, hopAt = -1e9, fx = [], flash = null, shake = 0, runAt = 0, sfxAt = {};

/** A sound, but never twice within `gap` ms (a held arrow must not machine-gun). */
function sfx(name, gap = 70) {
  const t = api.now();
  if (t - (sfxAt[name] || -1e9) < gap) return;
  sfxAt[name] = t; api.sfx(name);
}
function layout() {
  const box = host.closest(".ap-box"), bd = host.parentElement, chrome = box && bd ? box.offsetHeight - bd.offsetHeight : 250;
  const hw = Math.max(200, host.clientWidth - 12), ah = Math.max(240, innerHeight * 0.96 - chrome - 8 - 70);
  const s = clamp(Math.floor(Math.min(hw / CW, ah / CH)), 1, 5);
  if (s === u && g) return;
  u = s; cv.width = CW * u; cv.height = CH * u;
  cv.style.width = `${cv.width}px`; cv.style.height = `${cv.height}px`;
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
}

// ── the street's numbers (the server's closed form)
const ringN = (l) => Math.ceil((W + l.len) / l.sp);
/** Left edge (cells) of object `j` of lane `l` at client time `t` (ms). */
function pos(l, j, t) {
  const C = l.sp * ringN(l), tm = Math.max(0, t - runAt) / 1000, v = (l.off / 100 + (l.v / 10) * tm + j * l.sp) % C;
  return (v < 0 ? v + C : v) - l.len;
}
const laneAt = (y) => (st ? st.lanes.find((l) => l.y === y) : null);
function courierX(t) {
  const l = laneAt(me.y);
  return l && l.k === 2 ? me.x + (l.v / 10) * ((Math.max(0, t - runAt) - Math.max(0, me.t0 - runAt)) / 1000) : me.x;
}

// ── state from the server
function setState(v, t) {
  const first = !st, lanes = v[6].map(([y, vv, sp, len, k, off]) => ({ y, v: vv, sp, len, k, off }));
  st = { lanes, gifts: v[7], goal: v[3], d: v[4], n: v[5], age: v[11], at: t };
  runAt = t + v[9];
  const ev = v[8], acc = v[10];
  if (first || ev[0] !== evSeq || acc >= cs || t - lastSend > 700) { me = { x: v[0] / 100, y: v[1], t0: t }; cs = acc; cdUntil = t + v[2]; }
  if (!first && ev[0] !== evSeq) event(ev, t);
  evSeq = ev[0];
}
function event(ev, t) {
  const [, kind, pts] = ev;
  if (kind === 1 || kind === 2) {
    api.fx(kind === 2 ? "big" : "good", `${kind === 2 ? "무피격 " : ""}배달 +${pts}`); flash = { at: t, col: "#fff2a8" };
    sfx("alba_coin", 150); if (kind === 2) sfx("alba_ding", 150);
    for (let i = 0; i < 16; i++) fx.push({ k: "star", x: 6.5 * AU, y: 1.5 * AU, vx: (i - 8) * 5, vy: -22 - (i % 3) * 8, at: t, col: COLORS[i % 5] });
    fx.push({ k: "txt", x: 6.5 * AU, y: 2 * AU, at: t, txt: `+${pts}`, col: "#fff2a8" });
  } else if (kind === 3) { api.fx("bad", "마차에 치였다! -20"); flash = { at: t, col: "#ff4a3a" }; shake = t; sfx("alba_thud", 150); sfx("alba_buzz", 150); fx.push({ k: "txt", x: courierX(t) * AU + 6, y: me.y * AU - 4, at: t, txt: "-20", col: "#ff8a7a" }); }
  else if (kind === 4) { api.fx("bad", "풍덩! -20"); flash = { at: t, col: "#6ab0ff" }; sfx("alba_splash", 150); for (let i = 0; i < 3; i++) fx.push({ k: "ring", x: me.x * AU + 6, y: me.y * AU + 6, at: t + i * 90 }); fx.push({ k: "txt", x: me.x * AU + 6, y: me.y * AU - 4, at: t, txt: "-20", col: "#ff8a7a" }); }
  else if (kind === 5) { api.fx("good", `선물 +${pts}`); sfx("alba_chime", 100); for (let i = 0; i < 8; i++) fx.push({ k: "star", x: courierX(t) * AU + 6, y: me.y * AU + 4, vx: (i - 4) * 8, vy: -18, at: t, col: "#ffd84a" }); fx.push({ k: "txt", x: courierX(t) * AU + 6, y: me.y * AU - 4, at: t, txt: `+${pts}`, col: "#fff2a8" }); }
}

// ── inputs
let fever = 0;
function hop(d) {
  const t = api.now();
  if (phase !== "run" || !st || t < cdUntil) return;
  const x0 = courierX(t);
  let x = x0, y = me.y;
  if (d === 0) y--; else if (d === 2) y++; else x += d === 1 ? 1 : -1;
  if (y < st.goal || y > H - 1) return;
  const l = laneAt(y), river = l && l.k === 2;
  x = river ? (d & 1 ? clamp(x, -0.3, W - 0.7) : x) : clamp(Math.round(x), 0, W - 1);
  if (x === x0 && y === me.y) return;
  me = { x, y, t0: t }; cs++; lastSend = t; cdUntil = t + (fever > 0 ? 170 : 330); face = d; hopAt = t;
  sfx("alba_step", 90);
  api.act({ d });
}
const KEYS = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
function key(e) {
  const n = e.key.length > 1 ? e.key : /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
  if (!(n in KEYS)) return false;
  if (!e.repeat || phase === "run") hop(KEYS[n]);
  return true;
}

// ── pixel art (art pixels, whole numbers only)
const P = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const dark = (c) => { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return (((n >> 16) * 3 + ((n >> 8) & 255) * 6 + (n & 255)) / 10) < 130; };   // dark text sits on a light plate: no outline
function text(s, x, y, col, align = "center", size = 9) {
  g.font = `${size >= 11 ? "bold " : ""}${size}px ${size >= 11 ? FONT11 : FONT}`; g.textAlign = "left"; g.textBaseline = "top";
  { const w = g.measureText(s).width; x = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y); }   // whole-pixel origin: a pixel font stays crisp
  x = Math.round(x); y = Math.round(y);
  if (!dark(col)) { g.fillStyle = OL; g.fillText(s, x + 1, y); g.fillText(s, x - 1, y); g.fillText(s, x, y + 1); g.fillText(s, x, y - 1); g.fillText(s, x + 1, y + 1); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function plate(x, y, w, h) {
  P(OL, x, y + 1, w, h - 2); P(OL, x + 1, y, w - 2, h);
  P("#d9a43a", x + 1, y + 1, w - 2, h - 2); P("#fff4d4", x + 2, y + 2, w - 4, h - 4); P("#ffe8b0", x + 2, y + h - 5, w - 4, 3);
}
function drawGround(t) {
  for (let y = 0; y < H; y++) {
    const oy = y * AU, l = laneAt(y);
    if (y === 0) {   // the drop-off: the inn's porch under a striped awning
      P("#e0b070", 0, oy, CW, AU); P("#f4cc8c", 0, oy + 3, CW, 1);
      for (let x = 0; x < CW; x += 12) { P("#b8824a", x, oy + 4, 1, 8); P("#c89458", x + 6, oy + 6, 1, 6); }
      for (let x = 0; x < CW; x += 6) { P(x % 12 ? "#fff6e0" : "#e8604a", x, oy, 6, 3); }   // the awning's stripes
      P("#b8483a", 0, oy + 3, CW, 1);
      continue;
    }
    if (y === 5 || y === 10) {   // the median / the start: grass with flowers, a cobbled path
      const gr = y === 5;
      P(gr ? "#72c45c" : "#dccaa2", 0, oy, CW, AU);
      for (let x = 0; x < CW; x += 12) {
        P(gr ? "#8ad870" : "#ece0bc", x + ((y + x) % 24 ? 2 : 6), oy + 3, 3, 1); P(gr ? "#58a846" : "#b8a67e", x + 7, oy + 8, 3, 1);
        if (gr && (x / 12) % 3 === 1) { P("#ff8ac0", x + 3, oy + 5, 2, 2); P("#fff2a8", x + 3, oy + 5, 1, 1); }
        if (gr && (x / 12) % 4 === 2) { P("#fff6e0", x + 9, oy + 4, 2, 2); P("#ffd84a", x + 9, oy + 4, 1, 1); }
      }
      P(gr ? "#58a846" : "#b8a67e", 0, oy + 11, CW, 1);
      continue;
    }
    if (l && l.k === 2) {   // the river: two blues, foam on the banks and wave dashes that drift with the current
      P("#3a98e0", 0, oy, CW, AU); P("#58b4f0", 0, oy + 6, CW, 6); P("#d8f2ff", 0, oy, CW, 1); P("#2a78c0", 0, oy + 11, CW, 1);
      const dr = Math.floor((t / 160) * Math.sign(l.v)) % 24;
      for (let x = -24; x < CW + 24; x += 24) { P("#e8f8ff", x + dr + 3, oy + 3, 5, 1); P("#e8f8ff", x + dr + 15, oy + 9, 5, 1); P("#b8e4ff", x + dr + 9, oy + 6, 3, 1); }
    } else {   // the road: warm sand in two tones, with little stones and lane lines
      const a = y % 2;
      P(a ? "#cfc2a6" : "#c4b698", 0, oy, CW, AU); P(a ? "#bcae90" : "#b2a486", 0, oy + 11, CW, 1);
      for (let x = 0; x < CW; x += 12) { P("#e0d4ba", x + ((y * 5 + x / 12) % 3) * 3 + 1, oy + 2, 2, 1); P("#a89a7c", x + 6, oy + 7, 2, 1); }
      for (let x = 0; x < CW; x += 24) P("#e8dcc0", x + 4, oy + 5, 8, 1);
    }
  }
  // the drop-off door, its sign and a bouncing arrow over the goal
  P(OL, 5 * AU + 1, 3, 22, 9); P("#8a4a2a", 5 * AU + 2, 4, 20, 8); P("#b8683a", 5 * AU + 3, 5, 8, 7); P("#b8683a", 5 * AU + 13, 5, 8, 7); P("#ffe27a", 5 * AU + 10, 8, 2, 2); P("#ffe27a", 5 * AU + 14, 8, 2, 2);
  if (st) {   // two bouncing arrows flank the goal row
    const ay = Math.round(Math.sin(t / 150) * 2), gy = st.goal * AU + 1;
    for (const gx of [30, 126]) {
      P(OL, gx - 5, gy + ay - 1, 10, 5); P(OL, gx - 3, gy + ay + 3, 6, 3); P(OL, gx - 1, gy + ay + 5, 2, 2);
      P("#ffe27a", gx - 4, gy + ay, 8, 3); P("#ffe27a", gx - 2, gy + ay + 3, 4, 2); P("#ffffff", gx - 4, gy + ay, 8, 1);
    }
    if (st.goal === 5) P("#fff2a8", 0, 5 * AU + 11, CW, 1);
  }
}
function drawLog(x, y, len, t) {
  const w = len * AU;
  P(OL, x, y + 1, w, 10); P("#c48a4a", x + 1, y + 2, w - 2, 8); P("#e6b068", x + 1, y + 2, w - 2, 2); P("#8e5a2c", x + 1, y + 8, w - 2, 2);
  for (let i = 5; i < w - 5; i += 9) P("#8e5a2c", x + i, y + 4 + ((i / 9) % 2) * 2, 4, 1);
  for (const ex of [x, x + w - 3]) { P(OL, ex, y + 1, 3, 10); P("#f4d49c", ex + (ex === x ? 0 : 1), y + 3, 2, 6); P("#c48a4a", ex + (ex === x ? 1 : 1), y + 5, 1, 2); }
  P("#d8f2ff", x + 2, y + 11, w - 4, 1);   // a ripple under the log
}
function drawCart(x, y, dir, t, lane) {   // 24 × 12, facing right; mirrored for the other way
  const m = (a, w) => (dir > 0 ? x + a : x + 24 - a - w), cl = CLOTH[lane & 3], bump = Math.floor(t / 140 + lane) % 2;
  P(OL, m(1, 15), y + 1, 15, 9); P("#b87c44", m(2, 13), y + 6, 13, 3); P(cl[0], m(2, 13), y + 2, 13, 5); P(cl[1], m(2, 13), y + 2, 13, 2); P(cl[1], m(8, 3), y + 4, 3, 3); P("#8e5a2c", m(2, 13), y + 8, 13, 1);   // the wagon and its striped cover
  P(OL, m(16, 8), y + 3 + bump, 8, 7); P("#d89a5a", m(17, 6), y + 4 + bump, 6, 5); P("#8e5a2c", m(17, 6), y + 4 + bump, 3, 2); P(OL, m(20, 4), y + 1 + bump, 4, 4); P("#d89a5a", m(21, 2), y + 2 + bump, 2, 2); P("#fff", m(22, 1), y + 3 + bump, 1, 1);   // the horse
  P(OL, m(17 + (bump ? 0 : 3), 2), y + 10, 2, 2); P(OL, m(21 - (bump ? 0 : 3), 2), y + 10, 2, 2);
  for (const wx of [3, 11]) { P(OL, m(wx, 4), y + 8, 4, 4); P("#ffe0a0", m(wx + 1, 2), y + 9, 2, 2); P(OL, m(wx + (bump ? 1 : 2), 1), y + 9 + bump, 1, 1); }
}
function drawWalker(x, y, i, t) {
  const c = COLORS[i % 5], step = Math.floor(t / 180) % 2, sk = ["#ffd8a8", "#f0c090", "#ffe0b8"][i % 3];
  P("rgba(58,40,48,.25)", x + 2, y + 10, 8, 2);
  P(OL, x + 3, y + 1, 6, 5); P(sk, x + 4, y + 2, 4, 3); P(c, x + 3, y + 0, 6, 2); P(OL, x + 5, y + 3, 1, 1); P(OL, x + 7, y + 3, 1, 1); P("#ff9a8a", x + 4, y + 4, 1, 1);
  P(OL, x + 2, y + 5, 8, 5); P(c, x + 3, y + 6, 6, 3); P("rgba(255,255,255,.35)", x + 3, y + 6, 6, 1); P(OL, x + 3, y + 9, 2, 2 + step); P(OL, x + 7, y + 9, 2, 3 - step);
}
function drawGift(x, y, t) {
  const b = Math.round(Math.sin(t / 220) * 1);
  P("rgba(58,40,48,.25)", x + 2, y + 10, 8, 2);
  P(OL, x + 2, y + 3 + b, 8, 7); P("#fff0fa", x + 3, y + 4 + b, 6, 5); P("#ff5a8a", x + 5, y + 4 + b, 2, 5); P("#ff5a8a", x + 3, y + 6 + b, 6, 1); P("#fff", x + 3, y + 4 + b, 1, 1);
  P(OL, x + 4, y + 1 + b, 4, 2); P("#ff5a8a", x + 5, y + 2 + b, 2, 1);
  if (Math.floor(t / 200) % 2) P("#fff", x + 10, y + 2, 1, 1);
}
function drawCourier(x, y, t, back) {
  const hopT = t - hopAt, up = hopT < 140 ? Math.round(Math.sin((hopT / 140) * Math.PI) * 3) : 0, by = y - up;
  P("rgba(58,40,48,.32)", x + 2, y + 10, 8, 2);
  P(OL, x + 3, by + 10, 2, 2); P(OL, x + 7, by + 10, 2, 2);
  P(OL, x + 2, by + 5, 8, 6); P("#4a86e0", x + 3, by + 6, 6, 4); P("#7aaaf0", x + 3, by + 6, 6, 1);
  if (back) { P("#d8a050", x + 3, by + 7, 6, 3); P("#f4cc88", x + 3, by + 7, 6, 1); P("#e84a4a", x + 5, by + 7, 2, 3); P("#e84a4a", x + 3, by + 8, 6, 1); }
  else { P("#e84a4a", x + 3, by + 5, 6, 2); P("#ffd8a8", x + 5, by + 8, 2, 1); P(OL, x + 4, by + 9, 4, 1); }
  P(OL, x + 2, by + 1, 8, 5); P("#ffd8a8", x + 3, by + 2, 6, 3);
  if (!back) { P("#3a2830", x + 4, by + 3, 1, 2); P("#3a2830", x + 7, by + 3, 1, 2); P("#ff9a8a", x + 3, by + 4, 1, 1); P("#ff9a8a", x + 8, by + 4, 1, 1); }
  P(OL, x + 1, by, 10, 3); P("#e8884a", x + 2, by + 1, 8, 1); P("#ffb070", x + 2, by, 8, 1);   // the cap
  P(OL, x + 2, by - 2, 3, 3); P("#e8884a", x + 3, by - 1, 1, 1); P(OL, x + 7, by - 2, 3, 3); P("#e8884a", x + 8, by - 1, 1, 1);   // cat ears on the cap
}

// ── every animation frame
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  phase = info.phase; fever = info.fever;
  g.setTransform(u, 0, 0, u, 0, 0); g.imageSmoothingEnabled = false;
  P(OL, 0, 0, CW, CH);
  if (!st) { text("배달 준비 중…", CW / 2, CH / 2 - 4, "#fff4d4"); return; }
  const run = phase === "run";
  // the header: the delivery number and what is left of its time bonus
  const budget = BUDGET[st.d ? 1 : 0], age = st.age + (run ? t - st.at : 0), left = clamp(1 - age / budget, 0, 1);
  P("#a8703c", 0, 0, CW, HEAD - 1); P("#d49a58", 0, 0, CW, 1); P("#80502a", 0, HEAD - 2, CW, 1);
  text(`배달 ${st.n + 1}`, 4, 1, "#fff0b8", "left");
  const bx = 44, bw = CW - bx - 4;
  P(OL, bx - 1, 2, bw + 2, 7); P("#fff4d4", bx, 3, bw, 5);
  P(left > 0.35 ? "#6ac84a" : left > 0.12 ? "#f0c030" : "#e8483a", bx, 3, Math.round(bw * left), 5); P("rgba(255,255,255,.45)", bx, 3, Math.round(bw * left), 1);
  g.translate(0, HEAD);
  if (t - shake < 220) g.translate(Math.round(Math.sin(t / 25) * 1), 0);
  drawGround(t);
  // the gifts, the lanes' objects
  for (const f of st.gifts) {
    const [y, j, a] = f;
    let gx = a * AU;
    if (j >= 0) { const l = laneAt(y); if (l) gx = (pos(l, j, t) + a) * AU; }
    if (gx > -AU && gx < CW) drawGift(Math.round(gx), y * AU, t);
  }
  for (const l of st.lanes) {
    const n = ringN(l), oy = l.y * AU;
    for (let j = 0; j < n; j++) {
      const px = pos(l, j, t), len = l.len;
      if (px + len < 0 || px > W) continue;
      const x = Math.round(px * AU);
      if (l.k === 2) drawLog(x, oy, len, t);
      else if (l.k === 0) drawCart(x, oy, Math.sign(l.v), t, l.y + j);
      else drawWalker(x, oy, (j + l.y) | 0, t);
    }
  }
  // the courier
  const cx = Math.round(clamp(courierX(t), -0.5, W - 0.5) * AU), cy = me.y * AU;
  drawCourier(cx, cy, t, face === 0);
  // effects
  fx = fx.filter((e) => t - e.at < 900);
  for (const e of fx) {
    const a = (t - e.at) / 1000;
    if (a < 0) continue;
    if (e.k === "star") { P(OL, e.x + e.vx * a - 1, e.y + e.vy * a + 40 * a * a - 1, 4, 4); P(e.col, e.x + e.vx * a, e.y + e.vy * a + 40 * a * a, 2, 2); }
    else if (e.k === "txt") { g.globalAlpha = clamp(1.2 - a * 1.3, 0, 1); text(e.txt, e.x, e.y - a * 22, e.col, "center"); g.globalAlpha = 1; }
    else { const r = Math.round(a * 22); P("#e8f8ff", e.x - r, e.y, 2, 1); P("#e8f8ff", e.x + r, e.y, 2, 1); P("#e8f8ff", e.x, e.y - (r >> 1), 1, 2); P("#e8f8ff", e.x, e.y + (r >> 1), 1, 2); }
  }
  if (flash && t - flash.at < 260) { g.globalAlpha = clamp(0.45 - (t - flash.at) / 600, 0, 0.45); P(flash.col, 0, 0, CW, SH); g.globalAlpha = 1; }
  if (fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; P(c, 0, SH - 2, CW, 2); P(c, 0, 0, 2, SH); P(c, CW - 2, 0, 2, SH); }
  if (phase !== "run") {
    P("rgba(58,40,48,.36)", 0, 0, CW, SH);
    plate(6, 36, CW - 12, 67);
    if (phase === "brief") {
      text(info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "출발!", CW / 2, 42, "#c8462a", "center", 11);
      text("마차와 행인을 피해 건너고,", CW / 2, 61, "#6a4424"); text("강에서는 통나무에 올라타세요", CW / 2, 73, "#6a4424"); text("← ↑ ↓ → / WASD", CW / 2, 85, "#8a6a44");
    } else text("수고하셨어요!", CW / 2, 61, "#c8462a", "center", 11);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ── mount: the street and the touch pad
function mount(h, a) {
  host = h; api = a; st = null; me = { x: 6, y: 10, t0: 0 }; cs = 0; cdUntil = 0; evSeq = -1; fx = []; flash = null; shake = 0; sig = ""; phase = "brief"; face = 0; stops = []; sfxAt = {};
  host.textContent = "";
  boardEl = host.closest(".ap-board");
  if (boardEl) { boardWas = boardEl.style.background; boardEl.style.background = "#6ab85a"; }   // the frame around the street is the village green
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.style.cssText = "image-rendering:pixelated;touch-action:none;outline:3px solid #3a2830;box-shadow:0 3px 0 #2a1c24;";
  wrap.append(cv);
  const pad = document.createElement("div");
  pad.style.cssText = "display:grid;grid-template-columns:1fr 2fr 1fr 1fr;gap:6px;width:min(100%,460px);";
  for (const [label, d] of [["◀", 3], ["▲ 앞으로", 0], ["▼", 2], ["▶", 1]]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "min-height:52px;font-size:18px;touch-action:none;user-select:none;";
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); stop(); hop(d); t1 = setTimeout(() => { t2 = setInterval(() => hop(d), 120); }, 300); });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    stops.push(stop); pad.append(b);
  }
  wrap.append(pad); host.append(wrap);
  layout();
}
function unmount() {
  for (const s of stops) s();
  stops = [];
  if (boardEl) boardEl.style.background = boardWas;
  if (host) host.textContent = "";
  host = api = cv = g = st = wrap = boardEl = null;
}

export default { mount, setState, frame, key, unmount };
