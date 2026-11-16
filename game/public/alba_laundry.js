/**
 * 일일 아르바이트 · 세탁소 board (logic 67-alba-laundry.js, contract in alba.js): a Puyo-style washer, 6 columns × 12 rows.
 * The server owns the falling pair and every wash; this draws the washer and the pair (sliding between the server's drops), a ghost where it would land,
 * a glow around groups of three (one more and they are washed), the next pair, pops and the chain counter, and sends inputs:
 * ← → move · ↑ / X turn · Z turn back · ↓ one row · Space drop · the same as touch buttons.
 * view = [board 72 chars (. empty · 1-6 colour · s stain), cur [x,y,v, x,y,v] (pivot first; a detergent has one), next [a,b], ms to drop, drop ms, chain steps, ev [seq, chain, washed cells (cell*8+colour), flags 1 = emptied]]
 */
const W = 6, H = 12;
const COL = { 1: ["#e5534b", "#ff9a8e", "#9c2a26"], 2: ["#4a8fe0", "#8cc0ff", "#25508f"], 3: ["#58c26a", "#98eca6", "#2a7a3a"], 4: ["#f0c83c", "#ffe88a", "#a8841a"], 5: ["#a56ae0", "#cfa0ff", "#64349c"], 6: ["#ee7ab8", "#ffb0dc", "#a83a7c"] };
const ICON = {   // a little symbol per colour, so colour is never the only clue: sock, shirt, towel, diamond, plus, heart
  1: ["X....", "X....", "X....", "XXXX.", "....."], 2: ["XXXXX", "..X..", "..X..", "..X..", "....."], 3: ["XXXXX", ".....", "XXXXX", ".....", "XXXXX"],
  4: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."], 5: ["..X..", "..X..", "XXXXX", "..X..", "..X.."], 6: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FONT = "Galmuri11, Galmuri9, sans-serif";

let host = null, api = null, cv = null, g = null, c = 24, sig = "", stops = [], st = null, shift = 0, shiftAt = 0, evSeq = -1, parts = [], flashes = [], lastSend = 0, phase = "brief", lastT = 0, chainShow = null;

function layout() {
  const hw = Math.max(240, host.clientWidth - 4), ah = Math.max(280, innerHeight * 0.96 - 330) - 60;
  const s = clamp(Math.floor(Math.min(hw / 10, ah / H)), 12, 34);
  if (s === c && cv.width) return;
  c = s;
  cv.width = 10 * c; cv.height = H * c;
  cv.style.width = `${cv.width}px`; cv.style.height = `${cv.height}px`;
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
}

// ── inputs
function send(o) {
  const t = api.now();
  if (t - lastSend < 40) return;
  lastSend = t;
  api.act(o);
}
const free = (x, y) => x >= 0 && x < W && y >= 0 && y < H && st.b[y * W + x] === ".";
const cellsNow = () => { const o = []; if (st) for (let i = 0; i < st.cur.length; i += 3) o.push([st.cur[i] + shift, st.cur[i + 1], st.cur[i + 2]]); return o; };
function move(dx) {
  if (phase !== "run" || !st || !st.cur.length) return;
  if (cellsNow().every(([x, y]) => free(x + dx, y))) { shift += dx; shiftAt = api.now(); }   // shown at once; the server's view corrects it
  send({ mv: dx });
}
const turn = (d) => phase === "run" && st && st.cur.length && send({ rot: d });
const soft = () => phase === "run" && st && st.cur.length && send({ drop: 1 });
const hard = () => phase === "run" && st && st.cur.length && send({ drop: 2 });
const KEYS = { ArrowLeft: () => move(-1), a: () => move(-1), ArrowRight: () => move(1), d: () => move(1), ArrowUp: () => turn(1), w: () => turn(1), x: () => turn(1), z: () => turn(-1), ArrowDown: soft, s: soft, " ": hard };
const REPEAT = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "a", "d", "s"]);

// ── state from the server
/** Size of the same-colour group each cell belongs to (0 for empty / stain). */
function groupSizes(b) {
  const sz = new Array(b.length).fill(0);
  for (let i = 0; i < b.length; i++) {
    if (sz[i] || b[i] < "1" || b[i] > "6") continue;
    const comp = [i], seen = new Set([i]);
    for (let k = 0; k < comp.length; k++) {
      const j = comp[k], x = j % W;
      for (const n of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) if (n >= 0 && n < b.length && !seen.has(n) && b[n] === b[i]) { seen.add(n); comp.push(n); }
    }
    for (const j of comp) sz[j] = comp.length;
  }
  return sz;
}
function setState(v, t) {
  const first = !st;
  st = { b: v[0], cur: v[1], nx: v[2], d: v[3], dm: Math.max(100, v[4]), washes: v[5], at: t, sz: groupSizes(v[0]) };
  shift = 0;
  const ev = v[6];
  if (first) { evSeq = ev[0]; return; }
  if (ev[0] === evSeq) return;
  evSeq = ev[0];
  const now = api.now();
  if (ev[3] & 1) { api.fx("bad", "세탁기 비우기! -100"); flashes.push({ at: now, kind: 2 }); }
  if (ev[1]) {
    api.fx(ev[1] >= 2 ? "big" : "good", ev[1] > 1 ? `${ev[1]}연쇄!` : undefined);
    if (ev[1] > 1) chainShow = { at: now, n: ev[1] };
    for (const q of ev[2]) {
      const idx = q >> 3, col = q & 7, x = (idx % W) * c + (c >> 1), y = ((idx / W) | 0) * c + (c >> 1), body = col === 7 ? "#8a7058" : COL[col][0];
      for (let i = 0; i < 5; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * c * 7, vy: -Math.random() * c * 5 - c, life: 0.55 + Math.random() * 0.25, col: i === 0 ? "#fff" : body, ring: i === 0 });
    }
    if (parts.length > 220) parts.splice(0, parts.length - 220);
  }
}

// ── drawing
function round(x, y, s, col) { const o = Math.max(1, (s / 12) | 0); g.fillStyle = col; g.fillRect(x + o, y, s - 2 * o, s); g.fillRect(x, y + o, s, s - 2 * o); }
function piece(x, y, s, v, a = 1) {
  const o = Math.max(1, (s / 12) | 0);
  g.globalAlpha = a;
  if (v === 7) {   // a stain: a muddy blot
    round(x, y, s, "#2e2218"); round(x + o, y + o, s - 2 * o, "#6a5440");
    g.fillStyle = "#3e2e20"; g.fillRect(x + (s >> 2), y + (s >> 1), s >> 1, s >> 2); g.fillRect(x + (s >> 1), y + (s >> 2), s >> 2, s >> 1);
    g.fillStyle = "#8a7058"; g.fillRect(x + o * 2, y + o * 2, o * 2, o * 2);
  } else if (v === 8) {   // detergent: a white bottle with a blue label and bubbles
    round(x, y, s, "#1c2a44"); round(x + o, y + o, s - 2 * o, "#eaf2ff");
    g.fillStyle = "#4a8fe0"; g.fillRect(x + 2 * o, y + (s >> 1) - o, s - 4 * o, s >> 2);
    g.fillStyle = "#9cc8ff"; g.fillRect(x + 2 * o, y + 2 * o, o * 2, o * 2); g.fillRect(x + s - 4 * o, y + s - 4 * o, o * 2, o * 2);
  } else {
    const k = COL[v];
    round(x, y, s, k[2]); round(x + o, y + o, s - 2 * o, k[0]);
    g.fillStyle = k[1]; g.fillRect(x + 2 * o, y + o, s - 4 * o, o); g.fillRect(x + o, y + 2 * o, o, s - 4 * o);
    const u = Math.max(1, ((s - 4 * o) / 6) | 0), ox = x + ((s - 5 * u) >> 1), oy = y + ((s - 5 * u) >> 1);
    g.fillStyle = k[1]; g.globalAlpha = a * 0.85;
    ICON[v].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === "X") g.fillRect(ox + i * u, oy + j * u, u, u); });
  }
  g.globalAlpha = 1;
}
function outline(x, y, s, col) {
  const o = Math.max(1, (s / 12) | 0);
  g.fillStyle = col;
  g.fillRect(x, y, s, o); g.fillRect(x, y + s - o, s, o); g.fillRect(x, y, o, s); g.fillRect(x + s - o, y, o, s);
}
function text(s, x, y, size, col, align = "left") {
  g.font = `bold ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "top";
  g.fillStyle = "#000"; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}

function frame(t, info) {
  const key = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key !== sig) { sig = key; layout(); }
  phase = info.phase;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (shift && t - shiftAt > 350) shift = 0;
  const BW = W * c, BH = H * c;
  g.fillStyle = "#14121b"; g.fillRect(0, 0, cv.width, cv.height);
  // the washer: a drum with a soft tiled floor
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = (x + y) % 2 ? "#252c3d" : "#2a3246"; g.fillRect(x * c, y * c, c, c); }
  g.fillStyle = "#8fb2d0"; g.fillRect(BW, 0, 3, BH); g.fillRect(0, 0, 2, BH);
  if (!st) { text("세탁물을 기다리는 중…", BW >> 1, BH >> 1, 12, "#f3ead2", "center"); return; }
  // the pile, and a glow around groups of three
  const pulse = 0.45 + 0.35 * Math.sin(t / 140);
  for (let i = 0; i < st.b.length; i++) {
    const ch = st.b[i];
    if (ch === ".") continue;
    const x = (i % W) * c, y = ((i / W) | 0) * c;
    piece(x, y, c, ch === "s" ? 7 : +ch);
    if (st.sz[i] === 3) outline(x, y, c, `rgba(255,255,255,${pulse.toFixed(2)})`);
  }
  // the falling pair and its ghost
  const cells = cellsNow();
  if (cells.length) {
    let drop = 0;
    while (cells.every(([x, y]) => free(x, y + drop + 1))) drop++;
    if (drop) for (const [x, y, v] of cells) { piece(x * c, (y + drop) * c, c, v, 0.3); outline(x * c, (y + drop) * c, c, "rgba(243,234,210,.55)"); }
    const rest = !cells.every(([x, y]) => free(x, y + 1)), toDrop = st.d - (t - st.at);
    const frac = rest || info.phase !== "run" ? 0 : clamp(1 - toDrop / st.dm, 0, 1), oy = Math.round(frac * c);
    for (const [x, y, v] of cells) piece(x * c, y * c + oy, c, v);
  }
  // pops, flashes and the chain counter
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += c * 14 * dt;
    g.globalAlpha = clamp(p.life * 2.2, 0, 1); g.fillStyle = p.col;
    const s = Math.max(2, (c / 6) | 0);
    g.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  g.globalAlpha = 1;
  flashes = flashes.filter((f) => t - f.at < 400);
  for (const f of flashes) { g.globalAlpha = clamp(0.5 - (t - f.at) / 800, 0, 0.5); g.fillStyle = "#ff3a2a"; g.fillRect(0, 0, BW, BH); g.globalAlpha = 1; }
  if (chainShow && t - chainShow.at < 900) {
    const a = t - chainShow.at;
    g.globalAlpha = clamp(2 - a / 450, 0, 1);
    text(`${chainShow.n}연쇄!`, BW >> 1, ((BH / 3) | 0) - Math.round(a / 40), Math.max(16, c), "#ffd84a", "center");
    g.globalAlpha = 1;
  }
  // the side: the next pair and the count
  const px = BW + (c >> 1) + 3, pw = 10 * c - px - 2;
  text("다음", px, 3, 12, "#8fb2d0");
  g.fillStyle = "#1d2230"; g.fillRect(px, c, pw, 3 * c); outline(px, c, pw, "#8fb2d0");
  const nx = st.nx, s = Math.min(c, (pw / 1.4) | 0), ox = px + ((pw - s) >> 1);
  if (nx[1]) { piece(ox, c + ((3 * c - 2 * s) >> 1), s, nx[1]); piece(ox, c + ((3 * c - 2 * s) >> 1) + s, s, nx[0]); } else piece(ox, c + ((3 * c - s) >> 1), s, nx[0]);
  text("세탁", px, 4 * c + (c >> 1), 12, "#8fb2d0");
  text(`${st.washes}번`, px, 4 * c + (c >> 1) + 16, 14, "#f3ead2");
  if (info.fever > 0) text("건조기!", px, 4 * c + (c >> 1) + 40, 12, "#ff9a3a");
  if (info.phase !== "run") {
    g.fillStyle = "rgba(10,8,16,.6)"; g.fillRect(0, 0, BW, BH);
    text(info.phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!") : "수고하셨어요!", BW >> 1, (BH >> 1) - 8, 16, "#fff", "center");
  }
}

// ── mount: the washer and the touch buttons
function mount(h, a) {
  host = h; api = a; st = null; shift = 0; evSeq = -1; parts = []; flashes = []; chainShow = null; sig = ""; phase = "brief"; lastT = 0;
  host.textContent = "";
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas");
  wrap.append(cv);
  const pad = document.createElement("div");
  pad.style.cssText = "display:flex;gap:6px;width:min(100%,420px);";
  const add = (label, fn, rep) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "flex:1;min-height:44px;font-size:14px;touch-action:none;user-select:none;";
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); stop(); fn(); if (rep) t1 = setTimeout(() => { t2 = setInterval(fn, 90); }, 260); });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stop);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    stops.push(stop);
    pad.append(b);
  };
  add("◀", () => move(-1), true); add("↻ 회전", () => turn(1)); add("▶", () => move(1), true); add("▼", soft, true); add("바로 ⤓", hard);
  wrap.append(pad);
  host.append(wrap);
  layout();
}
function key(e) {
  const n = e.key.length > 1 || e.key === " " ? e.key : /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();   // letters by position: a Korean IME still plays
  const f = KEYS[n];
  if (!f) return false;
  if (!e.repeat || REPEAT.has(n)) f();
  return true;
}
function unmount() {
  for (const s of stops) s();
  stops = [];
  if (host) host.textContent = "";
  host = null; api = null; cv = null; g = null; st = null;
}

export default { mount, setState, frame, key, unmount };
