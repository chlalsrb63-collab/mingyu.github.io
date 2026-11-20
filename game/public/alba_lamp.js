/**
 * 일일 아르바이트 · 가로등 점등 board (logic 67-alba-lamp.js, contract in alba.js): a 15 × 15 dusk alley on a 150 × 164 art canvas (10 art pixels a tile) scaled by a whole number.
 * view = [level, walls (15 hex words of 4: a bit per column), bulbs left (same), [[x, y] big bulbs], courier, [shadow ×4], ms of fright, ms of start pause, bulbs waiting for pay, bulbs left, ev]
 *   courier = [x, y, tx, ty, pr (0..120 of the tile it is crossing), sp (units a 50 ms step), dir] · shadow = [x, y, tx, ty, pr, sp, 0 normal · 1 frightened · 2 hidden]
 *   ev = [seq, 1 big bulb · 2 caught · 3 alley cleared · 4 shadow eaten, points]
 * Everything moves at the frame rate from those numbers (progress = pr + sp·Δt/50 along the tile, then straight on until the next view says otherwise); a tile that has lost its bulb is
 * lit. The server decides every turn; a reversal is also shown at once here. Input: ← ↑ ↓ → / WASD, swipes, the four buttons: a turn is queued for the next junction.
 * Look: dusk, not black: blue-violet cobbles, lavender houses with lit windows, bulbs as bright sparks, lit tiles turn golden and a soft lamp-pool follows the courier.
 */
const N = 15, AU = 10, CW = N * AU, CH = N * AU + 14, UNIT = 120, STEP = 50;
const OL = "#1e1838", FONT = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif", FONT11 = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const EYE = ["#ff4a4a", "#ff7ac0", "#ff9a2a", "#3ad4ff"];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

let host = null, api = null, cv = null, g = null, u = 1, sig = "", wrap = null, stops = [], wsrc = "", bg = null, boardEl = null, boardWas = "";
let st = null, W = new Array(N * N).fill(1), evSeq = -1, lv = -1, phase = "brief", lastSend = 0, flash = null, shake = 0, floats = [], pops = [], sfxAt = {}, lastLeft = -1;

/** A sound, but never twice within `gap` ms. */
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
const open = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !W[y * N + x];

// ── state from the server
const ent = (a, t) => ({ x: a[0], y: a[1], tx: a[2], ty: a[3], pr: a[4], sp: a[5], at: t });
function setState(v, t) {
  const first = !st;
  if (v[1] !== wsrc) { wsrc = v[1]; W = new Array(N * N); v[1].match(/.{4}/g).forEach((h, y) => { const r = parseInt(h, 16); for (let x = 0; x < N; x++) W[y * N + x] = (r >> x) & 1; }); bg = null; }
  const P = new Array(N * N);
  v[2].match(/.{4}/g).forEach((h, y) => { const r = parseInt(h, 16); for (let x = 0; x < N; x++) P[y * N + x] = (r >> x) & 1; });
  st = { lv: v[0], pel: P, big: v[3], pl: { ...ent(v[4], t), dir: v[4][6] }, sh: v[5].map((s) => ({ ...ent(s, t), state: s[6] })), fr: v[6], frz: v[7], pend: v[8], left: v[9], at: t };
  if (lastLeft >= 0 && v[9] < lastLeft && v[0] === lv) sfx("alba_pop", 40);   // a bulb lit
  lastLeft = v[9];
  const ev = v[10];
  if (!first && ev[0] !== evSeq) event(ev, t);
  evSeq = ev[0];
  if (lv !== v[0]) { if (lv >= 0) pops.push({ at: t, txt: `골목 ${v[0] + 1}` }); lv = v[0]; }
}
function event(ev, t) {
  const [, kind, pts] = ev, [px, py] = where(st.pl, t);
  if (kind === 1) { api.fx("good", "큰 전구! 그림자가 도망쳐요"); flash = { at: t, col: "#ffd060" }; sfx("alba_chime", 100); }
  else if (kind === 2) { api.fx("bad", "그림자에게 잡혔다! -30"); flash = { at: t, col: "#ff4a3a" }; shake = t; sfx("alba_thud", 150); sfx("alba_buzz", 150); }
  else if (kind === 3) { api.fx("big", `골목 완료! +${pts}`); flash = { at: t, col: "#fff2a8" }; sfx("alba_ding", 250); }
  else if (kind === 4) { api.fx("big", `그림자 잡기 +${pts}`); floats.push({ x: px * AU + 5, y: py * AU, at: t, txt: `+${pts}` }); sfx("alba_coin", 100); }
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
const dark = (c) => { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return (((n >> 16) * 3 + ((n >> 8) & 255) * 6 + (n & 255)) / 10) < 130; };   // dark text sits on a light plate: no outline
function text(s, x, y, col, align = "center", size = 9) {
  g.font = `${size >= 11 ? "bold " : ""}${size}px ${size >= 11 ? FONT11 : FONT}`; g.textAlign = "left"; g.textBaseline = "top";
  { const w = g.measureText(s).width; x = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y); }   // whole-pixel origin: a pixel font stays crisp
  x = Math.round(x); y = Math.round(y);
  if (!dark(col)) { g.fillStyle = OL; g.fillText(s, x + 1, y); g.fillText(s, x - 1, y); g.fillText(s, x, y + 1); g.fillText(s, x, y - 1); g.fillText(s, x + 1, y + 1); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function plate(x, y, w, h) {
  R(OL, x, y + 1, w, h - 2); R(OL, x + 1, y, w - 2, h);
  R("#d9a43a", x + 1, y + 1, w - 2, h - 2); R("#fff4d4", x + 2, y + 2, w - 4, h - 4); R("#ffe8b0", x + 2, y + h - 5, w - 4, 3);
}
/** A soft stepped disc (rows of rects: no smoothing, no blur). */
function disc(x, y, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(r * r + 0.5 - dy * dy)); g.fillRect(Math.round(x) - h, Math.round(y) + dy, 2 * h + 1, 1); }
}
function lampPool(x, y, r, a) { for (let i = 0; i < 3; i++) disc(x, y, Math.round(r * (1 - i * 0.32)), `rgba(255,232,150,${a})`); }

// the walls and the unlit cobbles, drawn once per alley (lit tiles are painted over them each frame)
function makeBg() {
  const c = document.createElement("canvas"); c.width = CW; c.height = CH;
  const q = c.getContext("2d"), r = (col, x, y, w, h) => { q.fillStyle = col; q.fillRect(x, y, w, h); };
  r("#2c3466", 0, 0, CW, CH);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x * AU, py = y * AU;
    if (W[y * N + x]) {
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) { near = true; break; }
      if (!near) { r("#2c3466", px, py, AU, AU); for (let i = 0; i < AU; i += 5) r("#343e76", px, py + i, AU, 1); if ((x + y) % 2) r("#343e76", px + 4, py, 1, 5); continue; }
      r("#7a68b4", px, py, AU, AU); r("#a894dc", px, py, AU, 1); r("#a894dc", px, py + 1, 1, AU - 2); r("#4e4284", px, py + AU - 1, AU, 1); r("#4e4284", px + AU - 1, py + 1, 1, AU - 1);
      r("#6a58a4", px + 3, py + 4, 1, 1); r("#6a58a4", px + 7, py + 7, 1, 1);
      if ((x * 7 + y * 13) % 5 === 0) { r(OL, px + 2, py + 2, 6, 6); r("#ffd870", px + 3, py + 3, 4, 4); r("#fff2b0", px + 3, py + 3, 2, 2); r("#c89a30", px + 5, py + 5, 2, 2); r(OL, px + 5, py + 3, 1, 4); r(OL, px + 3, py + 5, 4, 1); }   // a lit window with a frame
    } else {
      r((x + y) % 2 ? "#34417a" : "#3b4a86", px, py, AU, AU);
      r("#2e3a6e", px, py + AU - 1, AU, 1); r("#2e3a6e", px + AU - 1, py, 1, AU);
      if ((x * 5 + y * 3) % 4 === 0) r("#4c5c9c", px + 2, py + 3, 2, 1);
    }
  }
  return c;
}
function drawLit(x, y) {
  const px = x * AU, py = y * AU;
  R("#e2b866", px, py, AU, AU); R("#f4d488", px + 1, py + 1, AU - 2, AU - 2); R("#fbe6a8", px + 1, py + 1, AU - 2, 1);
  R("#c89a48", px, py + AU - 1, AU, 1); R("#c89a48", px + AU - 1, py, 1, AU);
  if ((x + y) % 2) { R("#e2b866", px + 3, py + 4, 4, 2); } else { R("#fff0c0", px + 2, py + 2, 2, 1); }
}
function drawBulb(x, y, t) {
  const px = x * AU + 4, py = y * AU + 4, tw = (x * 3 + y + Math.floor(t / 260)) % 5 === 0;
  R("#ffe27a", px, py - 1, 2, 1); R("#ffe27a", px, py + 2, 2, 1); R("#ffe27a", px - 1, py, 1, 2); R("#ffe27a", px + 2, py, 1, 2);
  R("#ffffff", px, py, 2, 2);
  if (tw) { R("#ffffff", px - 2, py, 1, 2); R("#ffffff", px + 3, py, 1, 2); R("#ffffff", px, py - 2, 2, 1); R("#ffffff", px, py + 3, 2, 1); }
}
function drawBig(x, y, t) {
  const px = x * AU, py = y * AU, pulse = Math.floor(t / 200) % 2, bob = pulse ? 0 : 1;
  disc(px + 5, py + 5, 8, "rgba(255,200,90,.28)");
  R(OL, px + 1, py + 1 + bob, 8, 8); R("#ff8a30", px + 2, py + 2 + bob, 6, 6); R(pulse ? "#ffe27a" : "#ffc04a", px + 3, py + 3 + bob, 4, 4); R("#fffbe0", px + 3, py + 3 + bob, 2, 2);
  R("#ffe27a", px + 4, py - 1 + bob, 2, 1); R(OL, px + 3, py + 8 + bob, 4, 1);
  if (pulse) { R("#fff", px - 1, py + 4, 1, 2); R("#fff", px + 9, py + 4, 1, 2); }
}
function drawCourier(x, y, dir, t, moving) {
  const px = Math.round(x * AU), py = Math.round(y * AU), step = moving ? Math.floor(t / 110) % 2 : 0, d = dir < 0 ? 1 : dir;
  R("rgba(30,24,60,.4)", px + 1, py + 8, 8, 2);
  R(OL, px + 1, py + 2, 8, 7); R("#4a86e0", px + 2, py + 5, 6, 3); R("#7aaaf0", px + 2, py + 5, 6, 1); R("#ffd8a8", px + 2, py + 2, 6, 3);
  R(OL, px + 2, py + 8, 2, 1 + step); R(OL, px + 6, py + 8, 2, 2 - step);
  R(OL, px + 1, py + 1 - step, 8, 3); R("#e8884a", px + 2, py + 1 - step, 6, 1); R("#ffb070", px + 2, py - step + 1, 3, 1);
  R(OL, px + 2, py - 1 - step, 2, 2); R(OL, px + 6, py - 1 - step, 2, 2); R("#e8884a", px + 2, py - step, 1, 1); R("#e8884a", px + 7, py - step, 1, 1);   // the cat-ear cap
  const ex = d === 3 ? 2 : d === 1 ? 5 : 3;
  if (d !== 0) { R("#2a1820", px + ex, py + 3, 1, 2); R("#2a1820", px + ex + 2, py + 3, 1, 2) }
  // the lighting pole and its flame, held on the leading side
  const hx = d === 3 ? px - 1 : px + 9;
  R("#a8744a", hx, py + 3, 1, 6); R(OL, hx - 1, py - 1, 3, 4); R(Math.floor(t / 120) % 2 ? "#ffe27a" : "#ffa83a", hx - 1, py - 1, 3, 3); R("#fff8c0", hx, py, 1, 1);
}
function drawShadow(x, y, i, s, fr, t, dir) {
  const px = Math.round(x * AU), py = Math.round(y * AU), flick = fr && st.fr < 2200 && Math.floor(t / 150) % 2, wave = Math.floor(t / 140) % 2, bob = Math.floor(t / 260 + i) % 2 ? 0 : 1;
  const body = fr ? (flick ? "#f4f4ff" : "#4a98ff") : "#6a3aa8", edge = fr ? (flick ? "#a8a8d0" : "#2a62d0") : "#43236e", hi = fr ? "#9acaff" : "#8a5ac8";
  R(OL, px, py + 1 + bob, 10, 9 - bob); R(OL, px + 1, py + bob, 8, 1); R(body, px + 1, py + 1 + bob, 8, 8 - bob); R(body, px + 2, py + bob, 6, 1); R(edge, px + 1, py + 7, 8, 2); R(hi, px + 2, py + 1 + bob, 3, 1);
  for (const bx of [1, 4, 7]) R(OL, px + bx + wave, py + 9, 2, 1);
  if (fr) { R("#fff", px + 3, py + 3 + bob, 1, 2); R("#fff", px + 6, py + 3 + bob, 1, 2); R("#fff", px + 2, py + 7, 6, 1); R(OL, px + 3, py + 6, 1, 1); R(OL, px + 6, py + 6, 1, 1); }
  else {
    const o = dir < 0 ? 0 : DIR[dir][0];
    R("#fff", px + 2 + (o > 0 ? 1 : 0), py + 3 + bob, 3, 3); R("#fff", px + 5 + (o > 0 ? 1 : 0), py + 3 + bob, 3, 3);
    R(EYE[i], px + 3 + o + (o > 0 ? 1 : 0), py + 4 + bob, 1, 2); R(EYE[i], px + 6 + o + (o > 0 ? 1 : 0), py + 4 + bob, 1, 2);
  }
}

// ── every animation frame
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  phase = info.phase;
  g.setTransform(u, 0, 0, u, 0, 0); g.imageSmoothingEnabled = false;
  R("#2c3466", 0, 0, CW, CH);
  if (!st) { text("골목을 밝히는 중…", CW / 2, CH / 2 - 4, "#fff4d4"); g.setTransform(1, 0, 0, 1, 0, 0); return; }
  if (!bg) bg = makeBg();
  if (t - shake < 240) g.translate(Math.round(Math.sin(t / 22) * 1), 0);
  g.drawImage(bg, 0, 0);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!W[y * N + x] && !st.pel[y * N + x]) drawLit(x, y);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (st.pel[y * N + x]) drawBulb(x, y, t);
  for (const [x, y] of st.big) drawBig(x, y, t);
  const p = st.pl, [cx, cy] = where(p, t);
  lampPool(cx * AU + 5, cy * AU + 5, 34, 0.1);   // the lamp-pool follows the courier
  // the shadows under the courier
  st.sh.forEach((s, i) => {
    if (s.state === 2) return;
    const [x, y] = where(s, t), dx = s.tx - s.x, dy = s.ty - s.y;
    drawShadow(x, y, i, s, s.state === 1, t, dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 2 : dy < 0 ? 0 : -1);
  });
  drawCourier(cx, cy, p.dir, t, p.tx !== p.x || p.ty !== p.y);
  // floating points, banners
  floats = floats.filter((f) => t - f.at < 900);
  for (const f of floats) text(f.txt, f.x, f.y - (t - f.at) / 40, "#fff2a8", "center", 11);
  pops = pops.filter((q) => t - q.at < 1800);
  for (const q of pops) { const yy = 56 - Math.min(14, (t - q.at) / 60); plate(CW / 2 - 28, yy - 4, 56, 20); text(q.txt, CW / 2, yy, "#c8462a", "center", 11); }
  if (flash && t - flash.at < 260) { g.globalAlpha = clamp(0.4 - (t - flash.at) / 650, 0, 0.4); R(flash.col, 0, 0, CW, N * AU); g.globalAlpha = 1; }
  // the status line under the alley
  R(OL, 0, N * AU, CW, 14); R("#a8703c", 0, N * AU + 1, CW, 12); R("#d49a58", 0, N * AU + 1, CW, 1); R("#80502a", 0, N * AU + 12, CW, 1);
  R("#fff8c0", 4, N * AU + 5, 2, 2); R("#ffe27a", 3, N * AU + 5, 1, 2); R("#ffe27a", 6, N * AU + 5, 1, 2); R("#ffe27a", 4, N * AU + 4, 2, 1); R("#ffe27a", 4, N * AU + 7, 2, 1);   // a bulb icon
  text(`남은 전구 ${st.left}`, 11, N * AU + 2, "#fff0b8", "left");
  text(st.fr > 0 ? `그림자 도망 ${Math.ceil((st.fr - (t - st.at)) / 1000)}초` : `골목 ${st.lv + 1}`, CW - 4, N * AU + 2, st.fr > 0 ? "#bfdcff" : "#ffffff", "right");
  if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; R(c, 0, 0, CW, 2); R(c, 0, 0, 2, N * AU); R(c, CW - 2, 0, 2, N * AU); }
  if (phase === "run" && st.frz - (t - st.at) > 0) { plate(CW / 2 - 24, CH / 2 - 18, 48, 20); text("준비!", CW / 2, CH / 2 - 14, "#c8462a", "center", 11); }
  if (phase !== "run") {
    R("rgba(30,24,70,.4)", 0, 0, CW, N * AU);
    plate(12, 38, CW - 24, 70);
    if (phase === "brief") {
      text(info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "출발!", CW / 2, 44, "#c8462a", "center", 11);
      text("전구를 모두 켜세요", CW / 2, 64, "#6a4424"); text("큰 전구 = 그림자 사냥!", CW / 2, 78, "#c8641a"); text("방향키 · WASD · 스와이프", CW / 2, 92, "#8a6a44");
    } else text("수고하셨어요!", CW / 2, 66, "#c8462a", "center", 11);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ── mount: the alley, swipes and the touch pad
function mount(h, a) {
  host = h; api = a; st = null; wsrc = ""; evSeq = -1; lv = -1; flash = null; shake = 0; floats = []; pops = []; sig = ""; phase = "brief"; stops = []; sfxAt = {}; lastLeft = -1; bg = null;
  host.textContent = "";
  boardEl = host.closest(".ap-board");
  if (boardEl) { boardWas = boardEl.style.background; boardEl.style.background = "#3a4478"; }   // the frame around the alley is dusk blue, not black
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.style.cssText = "image-rendering:pixelated;touch-action:none;outline:3px solid #1e1838;box-shadow:0 3px 0 #141028;";
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
  pad.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:min(100%,460px);";
  for (const [label, d] of [["◀", 3], ["▲", 0], ["▼", 2], ["▶", 1]]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "min-height:52px;font-size:18px;touch-action:none;user-select:none;";
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); turn(d); });
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.append(b);
  }
  wrap.append(pad); host.append(wrap);
  layout();
}
function unmount() {
  if (boardEl) boardEl.style.background = boardWas;
  if (host) host.textContent = "";
  host = api = cv = g = st = wrap = bg = boardEl = null;
}

export default { mount, setState, frame, key, unmount };
