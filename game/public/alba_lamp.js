/**
 * 일일 아르바이트 · 가로등 점등 board (logic 67-alba-lamp.js, contract in alba.js): a 15 × 15 night alley on a 150 × 160 art canvas (10 art pixels a tile) scaled by a whole number.
 * view = [level, walls (15 hex words of 4: a bit per column), bulbs left (same), [[x, y] big bulbs], courier, [shadow ×4], ms of fright, ms of start pause, bulbs waiting for pay, bulbs left, ev]
 *   courier = [x, y, tx, ty, pr (0..120 of the tile it is crossing), sp (units a 50 ms step), dir] · shadow = [x, y, tx, ty, pr, sp, 0 normal · 1 frightened · 2 hidden]
 *   ev = [seq, 1 big bulb · 2 caught · 3 alley cleared · 4 shadow eaten, points]
 * Everything moves at the frame rate from those numbers (progress = pr + sp·Δt/50 along the tile, then straight on until the next view says otherwise); a tile that has lost its bulb is
 * lit. The server decides every turn; a reversal is also shown at once here. Input: ← ↑ ↓ → / WASD, swipes, the four buttons: a turn is queued for the next junction.
 */
const N = 15, AU = 10, CW = N * AU, CH = N * AU + 10, UNIT = 120, STEP = 50;
const OL = "#14101e", FONT = "Galmuri9, Galmuri11, sans-serif";
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const EYE = ["#ff6a6a", "#ff9ad0", "#ffa83a", "#6ae4ff"];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let host = null, api = null, cv = null, g = null, u = 1, sig = "", wrap = null, stops = [], wsrc = "";
let st = null, W = new Array(N * N).fill(1), evSeq = -1, lv = -1, phase = "brief", lastSend = 0, flash = null, shake = 0, floats = [], pops = [];

function layout() {
  const hw = Math.max(200, host.clientWidth - 4), ah = Math.max(240, innerHeight * 0.96 - 290) - 60;
  const s = clamp(Math.floor(Math.min(hw / CW, ah / CH)), 1, 4);
  if (s === u && g) return;
  u = s; cv.width = CW * u; cv.height = CH * u;
  cv.style.width = `${cv.width}px`; cv.style.height = `${cv.height}px`;
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
}
const open = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !W[y * N + x];

// ── state from the server
const ent = (a, t) => ({ x: a[0], y: a[1], tx: a[2], ty: a[3], pr: a[4], sp: a[5], at: t });
function setState(v, t) {
  const first = !st;
  if (v[1] !== wsrc) { wsrc = v[1]; W = new Array(N * N); v[1].match(/.{4}/g).forEach((h, y) => { const r = parseInt(h, 16); for (let x = 0; x < N; x++) W[y * N + x] = (r >> x) & 1; }); }
  const P = new Array(N * N);
  v[2].match(/.{4}/g).forEach((h, y) => { const r = parseInt(h, 16); for (let x = 0; x < N; x++) P[y * N + x] = (r >> x) & 1; });
  st = { lv: v[0], pel: P, big: v[3], pl: { ...ent(v[4], t), dir: v[4][6] }, sh: v[5].map((s) => ({ ...ent(s, t), state: s[6] })), fr: v[6], frz: v[7], pend: v[8], left: v[9], at: t };
  const ev = v[10];
  if (!first && ev[0] !== evSeq) event(ev, t);
  evSeq = ev[0];
  if (lv !== v[0]) { if (lv >= 0) pops.push({ at: t, txt: `골목 ${v[0] + 1}` }); lv = v[0]; }
}
function event(ev, t) {
  const [, kind, pts] = ev, [px, py] = where(st.pl, t);
  if (kind === 1) { api.fx("good", "큰 전구! 그림자가 도망쳐요"); flash = { at: t, col: "#ffd060" }; }
  else if (kind === 2) { api.fx("bad", "그림자에게 잡혔다! -30"); flash = { at: t, col: "#ff4a3a" }; shake = t; }
  else if (kind === 3) { api.fx("big", `골목 완료! +${pts}`); flash = { at: t, col: "#fff2a8" }; }
  else if (kind === 4) { api.fx("big", `그림자 잡기 +${pts}`); floats.push({ x: px * AU + 5, y: py * AU, at: t, txt: `+${pts}` }); }
}

// ── positions: along the tile, then straight on until the next view
function where(e, t) {
  const pr = e.pr + (e.sp * (t - e.at)) / STEP;
  if (e.tx === e.x && e.ty === e.y) return [e.x, e.y];
  if (pr <= UNIT) return [e.x + ((e.tx - e.x) * pr) / UNIT, e.y + ((e.ty - e.y) * pr) / UNIT];
  const dx = e.tx - e.x, dy = e.ty - e.y, f = Math.min(1, (pr - UNIT) / UNIT);
  return open(e.tx + dx, e.ty + dy) ? [e.tx + dx * f, e.ty + dy * f] : [e.tx, e.ty];
}

// ── inputs
function turn(d) {
  const t = api.now();
  if (phase !== "run" || !st || t - lastSend < 40) return;
  lastSend = t;
  const p = st.pl, moving = p.tx !== p.x || p.ty !== p.y;
  if (moving && p.dir >= 0 && d === ((p.dir + 2) & 3)) {   // a reversal is taken at once: show it at once
    const pr = clamp(p.pr + (p.sp * (t - p.at)) / STEP, 1, UNIT - 1);
    Object.assign(p, { x: p.tx, y: p.ty, tx: p.x, ty: p.y, pr: UNIT - pr, at: t, dir: d });
  }
  api.act({ d });
}
const KEYS = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
function key(e) {
  const n = e.key.length > 1 ? e.key : /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
  if (!(n in KEYS)) return false;
  if (!e.repeat) turn(KEYS[n]);
  return true;
}

// ── pixel art
const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
function text(s, x, y, col, align = "center", size = 9) {
  g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "top";
  g.fillStyle = OL; g.fillText(s, Math.round(x) + 1, Math.round(y) + 1); g.fillStyle = col; g.fillText(s, Math.round(x), Math.round(y));
}
function drawWall(x, y) {
  const px = x * AU, py = y * AU;
  let near = false;
  for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) { near = true; break; }
  if (!near) { R("#161a2e", px, py, AU, AU); return; }
  R("#2c3558", px, py, AU, AU); R("#4a5688", px, py, AU, 1); R("#1e2440", px, py + AU - 1, AU, 1); R("#38426c", px, py + 1, 1, AU - 2);
  if ((x * 7 + y * 13) % 5 === 0) { R("#1e2440", px + 3, py + 3, 4, 4); R("#e8c060", px + 4, py + 4, 2, 2); }   // a lit window in the alley's houses
}
function drawFloor(x, y, lit, t) {
  const px = x * AU, py = y * AU;
  if (lit) { R("#7a6640", px, py, AU, AU); R("#8e7a4c", px + 1, py + 1, AU - 2, AU - 2); R("#a08c58", px + 3, py + 3, 4, 4); if ((x + y) % 2) R("#6a5836", px + 1, py + 1, 2, 2); }
  else { R((x + y) % 2 ? "#2a2c3c" : "#30323f", px, py, AU, AU); }
}
function drawBulb(x, y) { const px = x * AU + 4, py = y * AU + 4; R("#fff2b8", px, py, 2, 2); R("#d8c070", px + 1, py + 1, 1, 1); }
function drawBig(x, y, t) {
  const px = x * AU, py = y * AU, pulse = Math.floor(t / 200) % 2;
  R(OL, px + 1, py + 1, 8, 8); R("#e87a20", px + 2, py + 2, 6, 6); R(pulse ? "#ffe27a" : "#ffc04a", px + 3, py + 3, 4, 4); R("#fff8d0", px + 3, py + 3, 2, 2);
}
function drawCourier(x, y, dir, t, moving) {
  const px = Math.round(x * AU), py = Math.round(y * AU), bob = moving ? Math.floor(t / 110) % 2 : 0, d = dir < 0 ? 1 : dir;
  R("rgba(0,0,0,.35)", px + 1, py + 8, 8, 2);
  R(OL, px + 1, py + 2, 8, 7); R("#3a5a8a", px + 2, py + 5, 6, 3); R("#f0d0a0", px + 2, py + 2, 6, 3);
  R("#c88a3a", px + 1, py + 1 - bob, 8, 2); R("#e8aa5a", px + 2, py + 1 - bob, 6, 1);
  const ex = d === 3 ? 2 : d === 1 ? 5 : 3;
  if (d !== 0) { R("#231a14", px + ex, py + 3, 1, 1); R("#231a14", px + ex + 2, py + 3, 1, 1); }
  // the lighting pole and its flame, held on the leading side
  const hx = d === 3 ? px - 1 : px + 9;
  R("#7a5a3a", hx, py + 3, 1, 6); R(Math.floor(t / 120) % 2 ? "#ffd84a" : "#ffa83a", hx - 1, py, 3, 3); R("#fff4a0", hx, py + 1, 1, 1);
}
function drawShadow(x, y, i, s, fr, t, dir) {
  const px = Math.round(x * AU), py = Math.round(y * AU), flick = fr && st.fr < 2200 && Math.floor(t / 150) % 2, wave = Math.floor(t / 140) % 2;
  const body = fr ? (flick ? "#e8e8f8" : "#3a58c8") : "#3c2c60", edge = fr ? (flick ? "#9a9ac0" : "#2a3a90") : "#241a40";
  R(OL, px, py + 1, 10, 9); R(OL, px + 1, py, 8, 1); R(body, px + 1, py + 1, 8, 8); R(body, px + 2, py, 6, 1); R(edge, px + 1, py + 7, 8, 2);
  for (const bx of [1, 4, 7]) R(OL, px + bx + wave, py + 9, 2, 1);
  if (fr) { R("#fff", px + 3, py + 3, 1, 2); R("#fff", px + 6, py + 3, 1, 2); R("#fff", px + 2, py + 7, 6, 1); R(OL, px + 3, py + 6, 1, 1); R(OL, px + 6, py + 6, 1, 1); }
  else {
    const o = dir < 0 ? 0 : DIR[dir][0];
    R("#fff", px + 2 + (o > 0 ? 1 : 0), py + 3, 3, 3); R("#fff", px + 5 + (o > 0 ? 1 : 0), py + 3, 3, 3);
    R(EYE[i], px + 3 + o + (o > 0 ? 1 : 0), py + 4, 1, 2); R(EYE[i], px + 6 + o + (o > 0 ? 1 : 0), py + 4, 1, 2);
  }
}

// ── every animation frame
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  phase = info.phase;
  g.setTransform(u, 0, 0, u, 0, 0); g.imageSmoothingEnabled = false;
  if (t - shake < 240) g.translate(Math.round(Math.sin(t / 22) * 1), 0);
  R(OL, 0, 0, CW, CH);
  if (!st) { text("골목을 밝히는 중…", CW / 2, CH / 2 - 4, "#f3ead2"); g.setTransform(1, 0, 0, 1, 0, 0); return; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (W[i]) drawWall(x, y); else drawFloor(x, y, !st.pel[i], t);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (st.pel[y * N + x]) drawBulb(x, y);
  for (const [x, y] of st.big) drawBig(x, y, t);
  // the shadows under the courier
  st.sh.forEach((s, i) => {
    if (s.state === 2) return;
    const [x, y] = where(s, t), dx = s.tx - s.x, dy = s.ty - s.y;
    drawShadow(x, y, i, s, s.state === 1, t, dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : dy < 0 ? 0 : -1);
  });
  const p = st.pl, [cx, cy] = where(p, t);
  drawCourier(cx, cy, p.dir, t, p.tx !== p.x || p.ty !== p.y);
  // floating points, banners
  floats = floats.filter((f) => t - f.at < 900);
  for (const f of floats) text(f.txt, f.x, f.y - (t - f.at) / 40, "#fff2a8");
  pops = pops.filter((q) => t - q.at < 1800);
  for (const q of pops) text(q.txt, CW / 2, 60 - Math.min(20, (t - q.at) / 60), "#ffe27a", "center", 11);
  if (flash && t - flash.at < 260) { g.globalAlpha = clamp(0.4 - (t - flash.at) / 650, 0, 0.4); R(flash.col, 0, 0, CW, CH); g.globalAlpha = 1; }
  // the status line under the alley
  R("#1d1a26", 0, N * AU, CW, 10);
  text(`남은 전구 ${st.left}`, 3, N * AU + 1, "#f3ead2", "left");
  text(st.fr > 0 ? `그림자 도망 ${Math.ceil((st.fr - (t - st.at)) / 1000)}초` : `골목 ${st.lv + 1}`, CW - 3, N * AU + 1, st.fr > 0 ? "#8ab4ff" : "#e2c486", "right");
  if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; R(c, 0, 0, CW, 2); R(c, 0, 0, 2, N * AU); R(c, CW - 2, 0, 2, N * AU); }
  if (phase === "run" && st.frz - (t - st.at) > 0) text("준비!", CW / 2, CH / 2 - 10, "#fff", "center", 11);
  if (phase !== "run") {
    R("rgba(10,8,16,.6)", 0, 0, CW, N * AU);
    text(phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "출발!") : "수고하셨어요!", CW / 2, 56, "#fff", "center", 11);
    if (phase === "brief") { text("전구를 모두 켜세요", CW / 2, 74, "#f3ead2"); text("노란 큰 전구 = 그림자 사냥!", CW / 2, 88, "#ffc04a"); }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ── mount: the alley, swipes and the touch pad
function mount(h, a) {
  host = h; api = a; st = null; wsrc = ""; evSeq = -1; lv = -1; flash = null; floats = []; pops = []; sig = ""; phase = "brief"; stops = [];
  host.textContent = "";
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.style.cssText = "image-rendering:pixelated;touch-action:none;";
  let sx = 0, sy = 0, down = false;
  cv.addEventListener("pointerdown", (e) => { down = true; sx = e.clientX; sy = e.clientY; });
  cv.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
    sx = e.clientX; sy = e.clientY;
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) cv.addEventListener(ev, () => { down = false; });
  wrap.append(cv);
  const pad = document.createElement("div");
  pad.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:min(100%,420px);";
  for (const [label, d] of [["◀", 3], ["▲", 0], ["▼", 2], ["▶", 1]]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "min-height:44px;font-size:14px;touch-action:none;user-select:none;";
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); turn(d); });
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.append(b);
  }
  wrap.append(pad); host.append(wrap);
  layout();
}
function unmount() {
  if (host) host.textContent = "";
  host = api = cv = g = st = wrap = null;
}

export default { mount, setState, frame, key, unmount };
