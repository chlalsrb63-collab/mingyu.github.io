/**
 * 일일 아르바이트 · 횡단 배달 board (logic 67-alba-cross.js, contract in alba.js): a 13 × 11 street seen from above, drawn on a 156 × 132 art canvas scaled by a whole number.
 * view = [x ×100, row, ms to the next hop, drop-off row, delivery no., delivered, [[row, v, sp, len, kind (0 cart · 1 walker · 2 log), phase ×100]…], [[row, log | -1, cell]…],
 *         ev [seq, 1 delivered · 2 clean · 3 hit · 4 water · 5 gift, pts], ms until the lanes run, hops taken, ms since the delivery began]
 * The lanes are never sent moving: every object is `phase + v·t + j·sp` on a ring (the same closed form as the server's), so the street flows at the frame rate; the courier's own
 * hop is predicted here (and reconciled with the server's hop counter), the log that carries him is extrapolated. Scores, hits and drowning are the server's.
 * Keys: ← ↑ ↓ → / WASD (by key position, so a Korean IME still plays) · touch: the four buttons.
 */
const W = 13, H = 11, AU = 12, CW = W * AU, CH = H * AU;
const OL = "#1e1620", FONT = "Galmuri9, Galmuri11, sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BUDGET = [12000, 26000], COLORS = ["#d8604a", "#5a8ad8", "#e0b84a", "#6ab060", "#b070d0"];

let host = null, api = null, cv = null, g = null, u = 1, sig = "", wrap = null, stops = [];
let st = null, me = { x: 6, y: 10, t0: 0 }, cs = 0, lastSend = 0, cdUntil = 0, evSeq = -1, phase = "brief", face = 0, hopAt = -1e9, fx = [], flash = null, shake = 0, runAt = 0;

function layout() {
  const hw = Math.max(200, host.clientWidth - 4), ah = Math.max(240, innerHeight * 0.96 - 300) - 60;
  const s = clamp(Math.floor(Math.min(hw / CW, ah / CH)), 1, 4);
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
  if (kind === 1 || kind === 2) { api.fx(kind === 2 ? "big" : "good", `${kind === 2 ? "무피격 " : ""}배달 +${pts}`); flash = { at: t, col: "#fff2a8" }; for (let i = 0; i < 14; i++) fx.push({ k: "star", x: 6.5 * AU, y: 1.5 * AU, vx: (i - 7) * 5, vy: -20 - (i % 3) * 8, at: t, col: COLORS[i % 5] }); }
  else if (kind === 3) { api.fx("bad", "마차에 치였다! -20"); flash = { at: t, col: "#ff4a3a" }; shake = t; }
  else if (kind === 4) { api.fx("bad", "풍덩! -20"); flash = { at: t, col: "#6ab0ff" }; for (let i = 0; i < 3; i++) fx.push({ k: "ring", x: me.x * AU + 6, y: me.y * AU + 6, at: t + i * 90 }); }
  else if (kind === 5) { api.fx("good", `선물 +${pts}`); for (let i = 0; i < 6; i++) fx.push({ k: "star", x: courierX(t) * AU + 6, y: me.y * AU + 4, vx: (i - 3) * 8, vy: -16, at: t, col: "#ffd84a" }); }
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
function text(s, x, y, col, align = "center", size = 9) {
  g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "top";
  g.fillStyle = OL; g.fillText(s, Math.round(x) + 1, Math.round(y) + 1); g.fillStyle = col; g.fillText(s, Math.round(x), Math.round(y));
}
function drawGround(t) {
  for (let y = 0; y < H; y++) {
    const oy = y * AU, l = laneAt(y);
    if (y === 0) {   // the drop-off: the inn's porch
      P("#a8825a", 0, oy, CW, AU); P("#c8a070", 0, oy, CW, 2); for (let x = 0; x < CW; x += 12) { P("#8a6a44", x, oy + 6, 1, 6); P("#8a6a44", x + 6, oy + 2, 1, 4); }
      continue;
    }
    if (y === 5 || y === 10) {   // the median / the start: grass and a cobbled path
      const gr = y === 5;
      P(gr ? "#4e8a44" : "#9a8a72", 0, oy, CW, AU);
      for (let x = 0; x < CW; x += 12) { P(gr ? "#5ea052" : "#b0a088", x + ((y + x) % 24 ? 2 : 6), oy + 3, 3, 1); P(gr ? "#3e7036" : "#82725c", x + 7, oy + 8, 3, 1); }
      continue;
    }
    if (l && l.k === 2) {   // the river: two blues and wave dashes that drift with the current
      P("#2c5f9e", 0, oy, CW, AU); P("#3674b8", 0, oy + 6, CW, 6);
      const dr = Math.floor((t / 160) * Math.sign(l.v)) % 24;
      for (let x = -24; x < CW + 24; x += 24) { P("#7ab4f0", x + dr + 3, oy + 3, 5, 1); P("#7ab4f0", x + dr + 15, oy + 9, 5, 1); }
    } else {   // the road: packed earth with wheel ruts
      P("#6a5e52", 0, oy, CW, AU); P("#58504a", 0, oy + 11, CW, 1);
      for (let x = 0; x < CW; x += 12) { P("#7a6e60", x + ((y * 5 + x / 12) % 3) * 3 + 1, oy + 2, 2, 1); P("#4e463e", x + 6, oy + 7, 2, 1); }
    }
  }
  // the drop-off door and its sign
  P(OL, 5 * AU + 2, 0, 20, 12); P("#6a3e22", 5 * AU + 3, 1, 18, 11); P("#e2c486", 5 * AU + 14, 6, 2, 2);
  if (st && st.goal === 5) P("#ffe27a", 0, 5 * AU, CW, 1);
}
function drawLog(x, y, len, t) {
  const w = len * AU;
  P(OL, x, y + 1, w, 10); P("#8a5a2e", x + 1, y + 2, w - 2, 8); P("#a8743c", x + 1, y + 2, w - 2, 2); P("#6a4220", x + 1, y + 8, w - 2, 2);
  for (let i = 5; i < w - 5; i += 9) P("#6a4220", x + i, y + 4 + ((i / 9) % 2) * 2, 4, 1);
  for (const ex of [x, x + w - 3]) { P(OL, ex, y + 1, 3, 10); P("#d8b078", ex + (ex === x ? 0 : 1), y + 3, 2, 6); }
}
function drawCart(x, y, dir) {   // 24 × 12, facing right; mirrored for the other way
  const m = (a, w) => (dir > 0 ? x + a : x + 24 - a - w);
  P(OL, m(1, 14), y + 1, 14, 9); P("#8a5e34", m(2, 12), y + 2, 12, 7); P("#d8d0a8", m(2, 12), y + 2, 12, 4); P("#b8b088", m(2, 12), y + 5, 12, 1);   // the wagon and its cloth
  P(OL, m(15, 8), y + 4, 8, 6); P("#a8744a", m(16, 6), y + 5, 6, 4); P(OL, m(20, 4), y + 2, 4, 4); P("#a8744a", m(21, 2), y + 3, 2, 2);   // the horse
  for (const wx of [3, 11]) { P(OL, m(wx, 4), y + 8, 4, 4); P("#c8a070", m(wx + 1, 2), y + 9, 2, 2); }
}
function drawWalker(x, y, i, t) {
  const c = ["#d8604a", "#5a8ad8", "#e0b84a", "#6ab060", "#b070d0"][i % 5], step = Math.floor(t / 180) % 2;
  P(OL, x + 3, y + 1, 6, 5); P("#f0d0a0", x + 4, y + 2, 4, 3); P(c, x + 3, y + 0, 6, 2); P("#231a14", x + 5, y + 3, 1, 1); P("#231a14", x + 7, y + 3, 1, 1);
  P(OL, x + 2, y + 5, 8, 5); P(c, x + 3, y + 6, 6, 3); P(OL, x + 3, y + 9, 2, 2 + step); P(OL, x + 7, y + 9, 2, 3 - step);
}
function drawGift(x, y, t) {
  const b = Math.round(Math.sin(t / 220) * 1);
  P(OL, x + 2, y + 3 + b, 8, 7); P("#e8c8f0", x + 3, y + 4 + b, 6, 5); P("#e04a6a", x + 5, y + 4 + b, 2, 5); P("#e04a6a", x + 3, y + 6 + b, 6, 1); P("#fff", x + 3, y + 4 + b, 1, 1);
}
function drawCourier(x, y, t, back) {
  const hopT = t - hopAt, up = hopT < 140 ? Math.round(Math.sin((hopT / 140) * Math.PI) * 3) : 0, by = y - up;
  P("rgba(0,0,0,.35)", x + 2, y + 10, 8, 2);
  P(OL, x + 3, by + 10, 2, 2); P(OL, x + 7, by + 10, 2, 2);
  P(OL, x + 2, by + 5, 8, 6); P("#3a5a8a", x + 3, by + 6, 6, 4); P("#5a7ab0", x + 3, by + 6, 6, 1);
  if (back) { P("#a07838", x + 3, by + 7, 6, 3); P("#d8b070", x + 3, by + 7, 6, 1); }
  else { P(OL, x + 3, by + 7, 6, 4); P("#d8b070", x + 4, by + 8, 4, 2); P("#e04a4a", x + 5, by + 7, 2, 4); }
  P(OL, x + 2, by + 1, 8, 5); P("#f0d0a0", x + 3, by + 2, 6, 3);
  if (!back) { P("#231a14", x + 4, by + 3, 1, 1); P("#231a14", x + 7, by + 3, 1, 1); }
  P(OL, x + 1, by, 10, 3); P("#b0703a", x + 2, by + 1, 8, 1); P("#d89a5a", x + 2, by, 8, 1);
}

// ── every animation frame
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  phase = info.phase; fever = info.fever;
  g.setTransform(u, 0, 0, u, 0, 0); g.imageSmoothingEnabled = false;
  if (t - shake < 220) g.translate(Math.round(Math.sin(t / 25) * 1), 0);
  P(OL, 0, 0, CW, CH);
  if (!st) { text("배달 준비 중…", CW / 2, CH / 2 - 4, "#f3ead2"); return; }
  const run = phase === "run";
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
      else if (l.k === 0) drawCart(x, oy, Math.sign(l.v));
      else drawWalker(x, oy, (j + l.y) | 0, t);
    }
  }
  // the courier
  const cx = Math.round(clamp(courierX(t), -0.5, W - 0.5) * AU), cy = me.y * AU;
  drawCourier(cx, cy, t, face === 0);
  // effects
  fx = fx.filter((e) => t - e.at < 800);
  for (const e of fx) {
    const a = (t - e.at) / 1000;
    if (a < 0) continue;
    if (e.k === "star") { P(e.col, e.x + e.vx * a, e.y + e.vy * a + 40 * a * a, 2, 2); }
    else { const r = Math.round(a * 22); P("#bfe4ff", e.x - r, e.y, 2, 1); P("#bfe4ff", e.x + r, e.y, 2, 1); P("#bfe4ff", e.x, e.y - (r >> 1), 1, 2); P("#bfe4ff", e.x, e.y + (r >> 1), 1, 2); }
  }
  if (flash && t - flash.at < 260) { g.globalAlpha = clamp(0.45 - (t - flash.at) / 600, 0, 0.45); P(flash.col, 0, 0, CW, CH); g.globalAlpha = 1; }
  // the head-up line: the delivery and what is left of its time bonus
  const budget = BUDGET[st.d ? 1 : 0], age = st.age + (run ? t - st.at : 0), left = clamp(1 - age / budget, 0, 1);
  P("rgba(20,14,24,.7)", 0, 0, CW, 6); P(left > 0.35 ? "#8ad86a" : left > 0.12 ? "#e8c84a" : "#e0604a", 1, 1, Math.round((CW - 2) * left), 4);
  text(`배달 ${st.n + 1}`, 3, 7, "#fff2d0", "left", 9);
  if (fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; P(c, 0, CH - 2, CW, 2); P(c, 0, 0, 2, CH); P(c, CW - 2, 0, 2, CH); }
  if (phase !== "run") {
    P("rgba(10,8,16,.6)", 0, 0, CW, CH);
    text(phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "출발!") : "수고하셨어요!", CW / 2, CH / 2 - 14, "#fff", "center", 11);
    if (phase === "brief") { text("마차와 행인을 피해 건너고,", CW / 2, CH / 2 + 2, "#f3ead2"); text("강에서는 통나무에 올라타세요", CW / 2, CH / 2 + 14, "#f3ead2"); }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ── mount: the street and the touch pad
function mount(h, a) {
  host = h; api = a; st = null; me = { x: 6, y: 10, t0: 0 }; cs = 0; cdUntil = 0; evSeq = -1; fx = []; flash = null; sig = ""; phase = "brief"; face = 0; stops = [];
  host.textContent = "";
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.style.cssText = "image-rendering:pixelated;touch-action:none;";
  wrap.append(cv);
  const pad = document.createElement("div");
  pad.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:min(100%,420px);";
  for (const [label, d] of [["◀", 3], ["▲ 앞으로", 0], ["▼", 2], ["▶", 1]]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "min-height:44px;font-size:14px;touch-action:none;user-select:none;";
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
  if (host) host.textContent = "";
  host = api = cv = g = st = wrap = null;
}

export default { mount, setState, frame, key, unmount };
