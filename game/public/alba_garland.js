/**
 * 일일 아르바이트 · 화환 엮기 client (rules: src/logic/67-alba-garland.js, contract: public/alba.js): a 16×16 flower garden of 12-px cells on a 192×208 pixel board
 * (drawn at a whole-number scale, no smoothing). The server moves the chain one cell per step and only takes turns; this draws the state it sends and slides the
 * chain between steps (the head toward where it will go, held back before a wall / thorn / its own body), and sends turns: arrows / WASD, swipes, the four buttons → {d: 0 up · 1 right · 2 down · 3 left}.
 * view = [chain cells (y*16+x, head last), dir, ms to the next step, step ms, flower cells, [gold cell, ms left] | 0, thorn cells, garlands done, queued turns, ev [seq, flags (1 flower · 2 gold · 4 garland · 8 crash), cell]]
 * Look: a sunny lawn inside a clipped hedge, pink blossoms bobbing, a pastel chain with a rose head, butterflies; a plank strip below holds the 12 beads and the count.
 * Sound: a turn snips (swish), a flower pops, a gold flower chimes, a finished garland rings, a crash buzzes.
 */
const N = 16, C = 12, W = N * C, H = 208, FULL = 12;
const OL = "#26301e", FONT9 = "9px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif", FONT11 = "bold 11px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const LINK = [["#ff9ac8", "#ffd8ec"], ["#fff2f8", "#ffffff"], ["#c8a4ff", "#e8d8ff"]];

let kk = 1, host = null, api = null, cv = null, g = null, bg = null, scale = 0, fitKey = "", boardEl = null, boardWas = "";
let st = null, recvAt = 0, lq = [], lastSeq = -1, first = true, floats = [], parts = [], shake = 0, lastScore = 0, phase = "brief", outbox = [], lastSend = -1e9, lastPos = [0, 0], swipe = null, feverFx = false, sfxAt = {};

/** A sound, but never twice within `gap` ms. */
function sfx(name, gap = 70) {
  const t = api.now();
  if (t - (sfxAt[name] || -1e9) < gap) return;
  sfxAt[name] = t; api.sfx(name);
}
function fit(w) {
  const key = `${w}|${innerHeight}`;
  if (key === fitKey) return;
  fitKey = key;
  const box = host.closest(".ap-box"), fixed = box ? box.offsetHeight - host.parentElement.offsetHeight : 260;
  const sc = Math.min(w / W, (innerHeight * 0.96 - fixed - 70) / H), s2 = sc >= 2 ? Math.floor(sc) : Math.max(0.5, sc);
  scale = s2; cv.style.width = `${Math.round(W * s2)}px`; cv.style.height = `${Math.round(H * s2)}px`;
  const k = Math.max(1, Math.ceil(s2 - 0.001));   // the canvas itself holds `k` pixels per art pixel, so the pixel font is rasterised at 9·k px and stays crisp
  if (k !== kk || cv.width !== W * k) { kk = k; cv.width = W * k; cv.height = H * k; g.imageSmoothingEnabled = false; }
}
const px = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const dark = (c) => { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return (((n >> 16) * 3 + ((n >> 8) & 255) * 6 + (n & 255)) / 10) < 130; };   // dark text sits on a light plate: no outline
function text(s, x, y, col, font = FONT9, align = "center") {
  g.font = font; g.textAlign = "left"; g.textBaseline = "top";
  { const w = g.measureText(s).width; x = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y); }   // whole-pixel origin: a pixel font stays crisp
  if (!dark(col)) { g.fillStyle = OL; g.fillText(s, x + 1, y); g.fillText(s, x - 1, y); g.fillText(s, x, y + 1); g.fillText(s, x, y - 1); g.fillText(s, x + 1, y + 1); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function plate(x, y, w, h) {
  px(OL, x, y + 1, w, h - 2); px(OL, x + 1, y, w - 2, h);
  px("#d9a43a", x + 1, y + 1, w - 2, h - 2); px("#fff4d4", x + 2, y + 2, w - 4, h - 4); px("#ffe8b0", x + 2, y + h - 5, w - 4, 3);
}
const cx = (c) => (c % N) * C + C / 2, cy = (c) => ((c / N) | 0) * C + C / 2;

// ── the pixel art, all from rectangles
/** A round blossom of odd size `s` (7 or 9) centred on (x, y): outlined, petals `p`, a light spot `hi`, a centre `mid`. */
function blossom(x, y, s, p, hi, mid, midHi) {
  x = Math.round(x) - (s >> 1); y = Math.round(y) - (s >> 1);
  const a = s === 9 ? 3 : 2, k = s - 2 * a;   // the flat sides are k wide
  px(OL, x + a, y, k, s); px(OL, x + 1, y + 1, s - 2, s - 2); px(OL, x, y + a, s, k);
  px(p, x + a, y + 1, k, s - 2); px(p, x + 2, y + 2, s - 4, s - 4); px(p, x + 1, y + a, s - 2, k);
  px(hi, x + a, y + 1, 2, 1); px(hi, x + a - 1, y + 2, 1, 1);
  const m = s === 9 ? 3 : 1;
  px(mid, x + ((s - m) >> 1), y + ((s - m) >> 1), m, m); px(midHi, x + ((s - m) >> 1), y + ((s - m) >> 1), 1, 1);
}
function drawFlower(c, t, golden) {
  const x = cx(c), y = cy(c) + (Math.floor(t / 400) % 2 ? 0 : -1);
  px(OL, x - 2, y + 4, 5, 3); px("#4ab048", x - 1, y + 4, 3, 2);   // a leaf under it
  if (golden) blossom(x, y, 9, "#ffd84a", "#fff2a8", "#ff9a2a", "#ffd070");
  else blossom(x, y, 9, "#ff7ab8", "#ffd0e6", "#ffe05a", "#fff6b0");
  if (golden) { const s = Math.floor(t / 110) % 4, o = [[-6, -6], [6, -5], [5, 6], [-6, 5]][s]; px("#ffffff", x + o[0], y + o[1], 1, 1); px("#ffe27a", x + o[0] - 1, y + o[1], 3, 1); px("#ffe27a", x + o[0], y + o[1] - 1, 1, 3); }
}
function drawThorn(c, t) {
  const x = cx(c), y = cy(c), sway = Math.floor(t / 500) % 2;
  px(OL, x - 5, y - 5, 11, 11); px("#2e8a3a", x - 4, y - 4, 9, 9); px("#1e6a2c", x - 4, y + 1 + sway, 9, 4); px("#5ac04a", x - 4, y - 4, 4, 1);
  for (const [dx, dy] of [[-1, -7], [-1, 6], [-7, -1], [6, -1]]) { px(OL, x + dx - 1, y + dy - 1, 4, 4); px("#ff5a4a", x + dx, y + dy, 2, 2); }   // the four red thorns
  px("#ff5a4a", x - 5, y - 5, 1, 1); px("#ff5a4a", x + 5, y - 5, 1, 1); px("#ff5a4a", x - 5, y + 5, 1, 1); px("#ff5a4a", x + 5, y + 5, 1, 1);
  px("#14401e", x - 2, y - 1, 5, 1); px("#14401e", x, y - 3, 1, 5);   // the knot of the vine
}
function makeBg() {
  const b = document.createElement("canvas"); b.width = W; b.height = H;
  const q = b.getContext("2d"), r = (c, x, y, w, h) => { q.fillStyle = c; q.fillRect(x, y, w, h); };
  r("#d8a868", 0, 0, W, H);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    r((x + y) % 2 ? "#72c254" : "#86d466", x * C, y * C, C, C);
    const h = (x * 73856093 ^ y * 19349663) >>> 0;
    if (h % 5 === 0) { const gx = x * C + 2 + (h >> 3) % 7, gy = y * C + 3 + (h >> 6) % 6; r("#5eae48", gx, gy, 1, 3); r("#5eae48", gx + 2, gy + 1, 1, 2); r("#a4ee84", gx + 1, gy - 1, 1, 2); }
    if (h % 11 === 3) r("#b4f494", x * C + 3 + (h >> 4) % 6, y * C + 4 + (h >> 8) % 5, 1, 1);
  }
  // the clipped hedge around the lawn: the wall
  r("#2e7a3a", 0, 0, W, 3); r("#2e7a3a", 0, W - 3, W, 3); r("#2e7a3a", 0, 0, 3, W); r("#2e7a3a", W - 3, 0, 3, W);
  for (let i = 0; i < W; i += 4) { r("#58b058", i, 0, 2, 1); r("#58b058", i + 2, W - 2, 2, 1); r("#58b058", 0, i + 2, 1, 2); r("#58b058", W - 1, i, 1, 2); }
  r("#1e5a2a", 0, 3, W, 1); r("#1e5a2a", 0, W - 4, W, 1); r("#1e5a2a", 3, 0, 1, W); r("#1e5a2a", W - 4, 0, 1, W);
  // the plank strip below
  r("#d8a868", 0, W, W, H - W); r("#f4d060", 0, W, W, 1); r("#a8802a", 0, W + 1, W, 1);
  for (let y = W + 3; y < H; y += 6) { r("#e8c088", 0, y, W, 1); r("#b88850", 0, y + 4, W, 1); }
  return b;
}

// ── inputs: the outbox keeps 40 ms between messages (the shell allows one per 35 ms); the local queue mirrors the server's (≤ 2 turns, no reversal)
function turn(d) {
  if (phase !== "run" || !st) return;
  const last = lq.length ? lq[lq.length - 1] : st.dir;
  if (d === last || d === (last ^ 2) || lq.length >= 2) return;
  lq.push(d);
  outbox.push(d);
  sfx("alba_swish", 80);   // a snip of the shears
  flush();
}
function flush() {
  const t = api.now();
  if (!outbox.length || t - lastSend < 40) return;
  lastSend = t;
  api.act({ d: outbox.shift() });
}
const KEYS = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
function key(e) {
  const n = e.key.length > 1 ? e.key : /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();   // letters by position: a Korean IME still plays
  const d = KEYS[n];
  if (d === undefined) return false;
  if (!e.repeat) turn(d);
  return true;
}

// ── state from the server
function setState(v, at) {
  const t = api.now();
  st = { c: v[0], dir: v[1], at: at + v[2], ms: Math.max(60, v[3]), f: v[4], gold: v[5] ? { c: v[5][0], end: at + v[5][1] } : null, th: new Set(v[6]), done: v[7] };
  lq = v[8].slice();
  recvAt = at;
  const [seq, flags, c] = v[9];
  if (first) { first = false; lastSeq = seq; return; }
  if (seq === lastSeq) return;
  lastSeq = seq;
  const x = cx(c), y = cy(c);
  if (flags & 8) { api.fx("bad"); sfx("alba_buzz", 200); shake = t; floats.push({ x: W / 2, y: 60, txt: "끊어졌어요!", col: "#ff8a7a", at: t, big: true }); spark(x, y, "#ff7a6a", 8); }
  if (flags & 1) { sfx("alba_pop", 50); spark(x, y, "#ffd0e6", 6); }
  if (flags & 2) { api.fx("big", "금빛 꽃!"); sfx("alba_chime", 100); spark(x, y, "#ffe27a", 10); }
  if (flags & 4) { api.fx("big", "화환 완성!"); sfx("alba_ding", 200); sfx("alba_chime", 200); floats.push({ x: W / 2, y: 70, txt: "화환 완성!", col: "#ffe27a", at: t, big: true }); spark(x, y, "#ffffff", 14); }
}
function spark(x, y, col, n) {
  const t = api.now();
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; parts.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, at: t, col }); }
  if (parts.length > 80) parts.splice(0, parts.length - 80);
}

// ── drawing
const free = (c) => c >= 0 && c < N * N && !st.th.has(c) && !st.c.includes(c);
function drawChain(t, info) {
  const c = st.c, n = c.length, eff = lq.length ? lq[0] : st.dir, hd = c[n - 1], nx = (hd % N) + DX[eff], ny = ((hd / N) | 0) + DY[eff], nc = ny * N + nx;
  const inb = nx >= 0 && ny >= 0 && nx < N && ny < N, grow = inb && (st.f.includes(nc) || (st.gold && st.gold.c === nc));
  const open = inb && !st.th.has(nc) && (!c.includes(nc) || nc === c[0]);
  let f = info.phase === "run" ? Math.max(0, Math.min(1, 1 - (st.at - t) / st.ms)) : 0;
  const pausing = st.at - t > st.ms * 1.8 && info.phase === "run";
  if (pausing) f = 0;
  if (!open && f > 0.4) f = 0.4; // held back: the wall / a thorn / itself is right ahead
  const pos = c.map((cell, i) => {
    const x0 = cx(cell), y0 = cy(cell);
    if (i === n - 1) return [x0 + DX[eff] * C * f, y0 + DY[eff] * C * f];
    if (i === 0 && grow) return [x0, y0];
    const nxt = c[i + 1];
    return [x0 + (cx(nxt) - x0) * f, y0 + (cy(nxt) - y0) * f];
  });
  lastPos = pos[n - 1];
  const blink = pausing && Math.floor(t / 130) % 2;
  if (blink) return;
  for (let i = 1; i < n; i++) {   // the vine between the links
    const [ax, ay] = pos[i - 1], [bx, by] = pos[i], k = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let s = 0; s <= k; s += 2) { const x = Math.round(ax + ((bx - ax) * s) / k), y = Math.round(ay + ((by - ay) * s) / k); px(OL, x - 2, y - 2, 4, 4); }
    for (let s = 0; s <= k; s += 2) { const x = Math.round(ax + ((bx - ax) * s) / k), y = Math.round(ay + ((by - ay) * s) / k); px("#4ab048", x - 1, y - 1, 2, 2); }
  }
  for (let i = 0; i < n - 1; i++) { const L = LINK[(n - 1 - i) % 3]; blossom(pos[i][0], pos[i][1], 7, L[0], L[1], "#ffe05a", "#fff6b0"); }
  // the head: a bigger rose blossom with dot eyes looking where it goes
  const [hx, hy] = pos[n - 1];
  blossom(hx, hy, 9, "#ff5a8c", "#ffb0c8", "#ffe05a", "#fff6b0");
  const ex = DX[eff], ey = DY[eff], X = Math.round(hx), Y = Math.round(hy);
  const eye = (a, b) => { px(OL, X + a, Y + b, 2, 2); };
  if (ex) { eye(ex * 2 - 1 + (ex > 0 ? 1 : 0), -3); eye(ex * 2 - 1 + (ex > 0 ? 1 : 0), 1); }
  else { eye(-3, ey * 2 - 1 + (ey > 0 ? 1 : 0)); eye(1, ey * 2 - 1 + (ey > 0 ? 1 : 0)); }
}
function butterfly(i, t) {   // an idle flutterer over the lawn (blue-white, so it never reads as a flower)
  const x = Math.round(W / 2 + Math.sin(t / 2300 + i * 2.4) * 78 + Math.sin(t / 700 + i) * 4), y = Math.round(88 + Math.cos(t / 1900 + i * 1.7) * 66), fl = Math.floor(t / 110 + i) % 2;
  px("#ffffff", x - 3, y - 1 - fl, 3, 2 + fl); px("#ffffff", x + 1, y - 1 - fl, 3, 2 + fl); px("#8ac4ff", x - 3, y + 1, 2, 1); px("#8ac4ff", x + 2, y + 1, 2, 1); px(OL, x, y - 1, 1, 3);
}
function frame(t, info) {
  fit(host.clientWidth || W);
  const prev = phase;
  phase = info.phase;
  if (prev !== "run" && phase === "run") { lq = []; outbox = []; }
  if (info.fever > 0 && !feverFx) { feverFx = true; api.fx("fever"); } else if (info.fever <= 0) feverFx = false;
  flush();
  g.setTransform(kk, 0, 0, kk, 0, 0);
  px(OL, 0, 0, W, H);
  if (t - shake < 260) g.translate(Math.round(Math.sin(t / 22) * 2), 0);
  g.drawImage(bg, 0, 0);
  if (info.score !== lastScore) {   // the real score change, floating at the head
    const d = info.score - lastScore;
    if (lastScore || d > 0) floats.push({ x: Math.round(lastPos[0]), y: Math.round(lastPos[1]) - 12, txt: d > 0 ? `+${d}` : `${d}`, col: d > 0 ? "#fff2a8" : "#ff8a7a", at: t });
    lastScore = info.score;
  }
  if (st) {
    butterfly(0, t); butterfly(1, t);
    for (const c of st.th) drawThorn(c, t);
    for (const c of st.f) drawFlower(c, t, false);
    if (st.gold && st.gold.end > t) { const left = st.gold.end - t; if (left > 1500 || Math.floor(t / 120) % 2) drawFlower(st.gold.c, t, true); }
    drawChain(t, info);
  } else text("꽃밭을 가꾸는 중…", W / 2, 90, "#fff4d4", FONT9);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], a = (t - p.at) / 1000;
    if (a > 0.45) { parts.splice(i, 1); continue; }
    const x = Math.round(p.x + p.vx * a), y = Math.round(p.y + p.vy * a + 60 * a * a);
    px(OL, x - 1, y - 1, 4, 4); px(p.col, x, y, 2, 2);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], a = t - f.at;
    if (a > 800) { floats.splice(i, 1); continue; }
    text(f.txt, Math.round(f.x), Math.round(f.y - a / 40), f.col, FONT11);
  }
  if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ffb4d8" : "#fff2a8"; px(c, 0, 0, W, 2); px(c, 0, W - 2, W, 2); px(c, 0, 0, 2, W); px(c, W - 2, 0, 2, W); }
  g.setTransform(kk, 0, 0, kk, 0, 0);
  // the strip: the garland being woven (12 beads) and the garlands finished
  const n = st ? st.c.length : 3;
  for (let i = 0; i < FULL; i++) { const on = i < n, L = LINK[i % 3]; px(OL, 5 + i * 11, W + 3, 10, 10); px(on ? L[0] : "#a07040", 6 + i * 11, W + 4, 8, 8); if (on) px(L[1], 6 + i * 11, W + 4, 3, 1); }
  if (st) { text(`화환 ${st.done}`, W - 4, W + 3, "#fff4d4", FONT9, "right"); }
  if (info.phase === "brief") {
    px("rgba(38,48,30,.34)", 0, 0, W, W);
    plate(14, 46, W - 28, 100);
    text(info.toStart > 0 ? `${Math.ceil(info.toStart / 1000)}` : "시작!", W / 2, 54, "#c8462a", FONT11);
    text("방향키 · WASD · 스와이프", W / 2, 80, "#6a4424", FONT9);
    text("꽃을 먹으면 줄이 길어져요", W / 2, 96, "#d03a7a", FONT9);
    text("12송이면 화환 완성!", W / 2, 112, "#c8641a", FONT9);
    text("가시와 벽, 내 몸은 피하세요", W / 2, 126, "#8a6a44", FONT9);
  }
  if (info.phase === "run" && st && st.at - t > st.ms * 1.8 && t - shake < 1500) { plate(52, 78, 88, 18); text("다시 엮는 중…", W / 2, 83, "#6a4424", FONT9); }
  if (info.phase === "end") { px("rgba(38,48,30,.34)", 0, 0, W, W); plate(36, 76, W - 72, 34); text("수고하셨어요!", W / 2, 88, "#c8462a", FONT11); }
}

// ── mount: the board, the swipe, the four buttons
function mount(h, a) {
  kk = 1; host = h; api = a; st = null; lq = []; outbox = []; parts = []; floats = []; lastSeq = -1; first = true; phase = "brief"; scale = 0; fitKey = ""; shake = 0; lastScore = 0; lastSend = -1e9; swipe = null; feverFx = false; sfxAt = {};
  host.textContent = "";
  boardEl = host.closest(".ap-board");
  if (boardEl) { boardWas = boardEl.style.background; boardEl.style.background = "#5aa04a"; }   // the frame around the garden is lawn green, not black
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  cv.style.cssText = "touch-action:none;image-rendering:pixelated;user-select:none;-webkit-user-select:none;outline:3px solid #26301e;box-shadow:0 3px 0 #18200f;";
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  bg = makeBg();
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } });
  cv.addEventListener("pointermove", (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    swipe.x = e.clientX; swipe.y = e.clientY;   // a long drag can turn again
  });
  for (const ev of ["pointerup", "pointercancel"]) cv.addEventListener(ev, () => { swipe = null; });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  const pad = document.createElement("div");
  pad.style.cssText = "display:flex;gap:6px;width:min(100%,420px);";
  for (const [label, d] of [["◀", 3], ["▲", 0], ["▼", 2], ["▶", 1]]) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "flex:1;min-height:44px;font-size:18px;touch-action:none;user-select:none;";
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); turn(d); });
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.append(b);
  }
  wrap.append(cv, pad);
  host.append(wrap);
}
function unmount() {
  if (boardEl) boardEl.style.background = boardWas;
  if (host) host.textContent = "";
  host = api = cv = g = bg = st = boardEl = null; outbox = []; lq = []; swipe = null;
}

export default { mount, setState, frame, key, unmount };
