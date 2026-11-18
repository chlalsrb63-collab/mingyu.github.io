/**
 * 일일 아르바이트 · 세탁소 board (logic 67-alba-laundry.js, contract in alba.js): a Puyo-style washer, 6 columns × 12 rows.
 * The server owns the falling pair and every wash; this draws the washer and the pair (sliding between the server's drops), a ghost where it would land,
 * a glow around groups of three (one more and they are washed), the next pair, pops and the chain counter, and sends inputs:
 * ← → move · ↑ / X turn · Z turn back · ↓ one row · Space drop · the same as touch buttons.
 * view = [board 72 chars (. empty · 1-6 colour · s stain), cur [x,y,v, x,y,v] (pivot first; a detergent has one), next [a,b], ms to drop, drop ms, chain steps, ev [seq, chain, washed cells (cell*8+colour), flags 1 = emptied]]
 * Look: a pastel-aqua drum with drifting soap bubbles, white casing, pink side card. Sounds: step (move), snap (turn), swish (drop), thud (lands), splash + pop (a wash), chime (chains), buzz (emptied).
 */
const W = 6, H = 12;
const COL = { 1: ["#ef5a52", "#ffa098", "#a02e2a"], 2: ["#4a90e8", "#94c8ff", "#26529a"], 3: ["#52c868", "#9af0aa", "#2a7e3c"], 4: ["#f4cc3c", "#fff08e", "#b08a1a"], 5: ["#ac6ae8", "#d4a8ff", "#6a36a4"], 6: ["#f07cc0", "#ffb8e0", "#ac3a80"] };
const ICON = {   // a little symbol per colour, so colour is never the only clue: sock, shirt, towel, diamond, plus, heart
  1: ["X....", "X....", "X....", "XXXX.", "....."], 2: ["XXXXX", "..X..", "..X..", "..X..", "....."], 3: ["XXXXX", ".....", "XXXXX", ".....", "XXXXX"],
  4: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."], 5: ["..X..", "..X..", "XXXXX", "..X..", "..X.."], 6: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FONT = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const INK = "#2a4a6a", EDGE = "#2a3a58", F1 = "#d6ecf8", F2 = "#c8e4f4";

let host = null, api = null, cv = null, g = null, c = 24, sig = "", stops = [], st = null, shift = 0, shiftAt = 0, evSeq = -1, parts = [], flashes = [], lastSend = 0, phase = "brief", lastT = 0, chainShow = null;
let shakeAt = 0, landAt = new Map(), lastS = {};

/** A sound, throttled so a held key never spams it. */
function snd(n, gap = 70) { const t = performance.now(); if (api && t - (lastS[n] || 0) >= gap) { lastS[n] = t; api.sfx(n); } }

function layout() {
  const hw = Math.max(240, host.clientWidth - 4), ah = Math.max(280, innerHeight * 0.96 - 330) - 60;
  const s = clamp(Math.floor(Math.min(hw / 10, ah / H)), 12, 34);
  if (g && s === c) return;
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
  if (cellsNow().every(([x, y]) => free(x + dx, y))) { shift += dx; shiftAt = api.now(); snd("alba_step", 70); }   // shown at once; the server's view corrects it
  send({ mv: dx });
}
const turn = (d) => { if (phase === "run" && st && st.cur.length) { snd("alba_snap", 80); send({ rot: d }); } };
const soft = () => { if (phase === "run" && st && st.cur.length) { snd("alba_step", 80); send({ drop: 1 }); } };
const hard = () => { if (phase === "run" && st && st.cur.length) { snd("alba_swish", 150); send({ drop: 2 }); } };
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
  const first = !st, old = st, now = api.now(), ev = v[6], evNew = !first && ev[0] !== evSeq;
  st = { b: v[0], cur: v[1], nx: v[2], d: v[3], dm: Math.max(100, v[4]), washes: v[5], at: t, sz: groupSizes(v[0]) };
  shift = 0;
  if (old && !(evNew && ev[1])) {   // the pair settled: new cells on the board (a wash shifts cells, so not then)
    let n = 0;
    for (let i = 0; i < st.b.length; i++) if (old.b[i] === "." && st.b[i] !== ".") { n++; landAt.set(i, now); }
    if (n) snd("alba_thud", 90);
  }
  if (first) { evSeq = ev[0]; return; }
  if (ev[0] === evSeq) return;
  evSeq = ev[0];
  if (ev[3] & 1) { api.fx("bad", "세탁기 비우기! -100"); flashes.push({ at: now, kind: 2 }); snd("alba_buzz", 200); shakeAt = now; }
  if (ev[1]) {
    api.fx(ev[1] >= 2 ? "big" : "good", ev[1] > 1 ? `${ev[1]}연쇄!` : undefined);
    snd("alba_splash", 100); snd("alba_pop", 60);
    if (ev[1] > 1) { chainShow = { at: now, n: ev[1] }; snd("alba_chime", 100); if (ev[1] >= 4) snd("alba_coin", 100); }
    for (const q of ev[2]) {
      const idx = q >> 3, col = q & 7, x = (idx % W) * c + (c >> 1), y = ((idx / W) | 0) * c + (c >> 1), body = col === 7 ? "#8a7058" : COL[col][0];
      for (let i = 0; i < 6; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * c * 7, vy: -Math.random() * c * 5 - c, life: 0.55 + Math.random() * 0.25, col: i === 0 ? "#fff" : i === 1 ? COL[col === 7 ? 2 : col][1] : body, ring: i === 0 });
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
    round(x, y, s, "#2e2218"); round(x + o, y + o, s - 2 * o, "#7a6048");
    g.fillStyle = "#4e3a28"; g.fillRect(x + (s >> 2), y + (s >> 1), s >> 1, s >> 2); g.fillRect(x + (s >> 1), y + (s >> 2), s >> 2, s >> 1);
    g.fillStyle = "#a08868"; g.fillRect(x + o * 2, y + o * 2, o * 2, o * 2);
  } else if (v === 8) {   // detergent: a white bottle with a blue label and bubbles
    round(x, y, s, "#1c2a44"); round(x + o, y + o, s - 2 * o, "#f4f8ff");
    g.fillStyle = "#4a8fe0"; g.fillRect(x + 2 * o, y + (s >> 1) - o, s - 4 * o, s >> 2);
    g.fillStyle = "#9cc8ff"; g.fillRect(x + 2 * o, y + 2 * o, o * 2, o * 2); g.fillRect(x + s - 4 * o, y + s - 4 * o, o * 2, o * 2);
  } else {
    const k = COL[v];
    round(x, y, s, EDGE); round(x + o, y + o, s - 2 * o, k[2]); round(x + o, y + o, s - 3 * o, k[0]);
    g.fillStyle = k[1]; g.fillRect(x + 2 * o, y + o, s - 5 * o, o); g.fillRect(x + o, y + 2 * o, o, s - 5 * o);
    const u = Math.max(1, ((s - 4 * o) / 6) | 0), ox = x + ((s - 5 * u) >> 1), oy = y + ((s - 5 * u) >> 1);
    g.fillStyle = "#ffffff"; g.globalAlpha = a * 0.9;
    ICON[v].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === "X") g.fillRect(ox + i * u, oy + j * u, u, u); });
  }
  g.globalAlpha = 1;
}
function outline(x, y, s, col) {
  const o = Math.max(1, (s / 12) | 0);
  g.fillStyle = col;
  g.fillRect(x, y, s, o); g.fillRect(x, y + s - o, s, o); g.fillRect(x, y, o, s); g.fillRect(x + s - o, y, o, s);
}
function text(s, x, y, size, col, align = "left", shadow = "") {
  g.font = `bold ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "top";
  if (shadow) { g.fillStyle = shadow; g.fillText(s, x + 1, y + 1); }
  g.fillStyle = col; g.fillText(s, x, y);
}

function frame(t, info) {
  const key = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key !== sig) { sig = key; layout(); }
  phase = info.phase;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (shift && t - shiftAt > 350) shift = 0;
  const BW = W * c, BH = H * c, fs = clamp(Math.round(c * 0.42), 11, 15);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#fff0f6"; g.fillRect(0, 0, cv.width, cv.height);   // the side card
  if (t - shakeAt < 260) g.translate(Math.round(Math.sin(t / 18) * 3), 0);
  // the washer: a pastel drum with a tiled floor and soap bubbles drifting up
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = (x + y) % 2 ? F1 : F2; g.fillRect(x * c, y * c, c, c); }
  const bs = Math.max(3, (c / 6) | 0);
  for (let k = 0; k < 9; k++) {
    const bx = Math.round((((k * 37 + 11) % 97) / 97) * (BW - bs) + Math.sin(t / 700 + k) * 3), by = Math.round(BH - ((t / (22 + k * 3) + k * 41) % (BH + bs)));
    g.fillStyle = "#ffffff"; g.fillRect(bx, by, bs, bs); g.fillStyle = by % 2 ? F1 : F2; g.fillRect(bx + 1, by + 1, bs - 2, bs - 2); g.fillStyle = "#ffffff"; g.fillRect(bx + 1, by + 1, 1, 1);
  }
  g.fillStyle = EDGE; g.fillRect(BW, 0, 5, BH); g.fillRect(-1, 0, 4, BH);
  g.fillStyle = "#f4f8fc"; g.fillRect(BW + 1, 0, 3, BH); g.fillRect(0, 0, 2, BH);
  g.fillStyle = "#9ab4cc"; g.fillRect(BW + 3, 0, 1, BH);
  if (!st) { text("세탁물을 기다리는 중…", BW >> 1, BH >> 1, fs, INK, "center"); return; }
  // the pile, and a glow around groups of three
  const pulse = 0.55 + 0.4 * Math.sin(t / 140);
  for (let i = 0; i < st.b.length; i++) {
    const ch = st.b[i];
    if (ch === ".") continue;
    const age = t - (landAt.get(i) || -1e9), x = (i % W) * c, y = ((i / W) | 0) * c;
    piece(x, y + (age < 110 ? Math.round(c * 0.08 * (1 - age / 110)) : 0), c, ch === "s" ? 7 : +ch);
    if (st.sz[i] === 3) outline(x, y, c, `rgba(255,255,255,${pulse.toFixed(2)})`);
  }
  // the falling pair and its ghost
  const cells = cellsNow();
  if (cells.length) {
    let drop = 0;
    while (cells.every(([x, y]) => free(x, y + drop + 1))) drop++;
    if (drop) for (const [x, y, v] of cells) { piece(x * c, (y + drop) * c, c, v, 0.3); outline(x * c, (y + drop) * c, c, "rgba(42,58,88,.55)"); }
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
    text(`${chainShow.n}연쇄!`, BW >> 1, ((BH / 3) | 0) - Math.round(a / 40), Math.max(16, c), "#ffd84a", "center", EDGE);
    g.globalAlpha = 1;
  }
  // the side: the next pair and the count, on a pink card
  const px = BW + (c >> 1) + 3, pw = 10 * c - px - 3;
  g.fillStyle = "#ffd8e8"; g.fillRect(px - 3, 0, pw + 6, BH); g.fillStyle = "#f0b0cc"; g.fillRect(px - 3, 0, 2, BH);
  text("다음", px + (pw >> 1), 4, fs, INK, "center");
  g.fillStyle = EDGE; g.fillRect(px, c, pw, 3 * c); g.fillStyle = "#e4f2fa"; g.fillRect(px + 2, c + 2, pw - 4, 3 * c - 4);
  const nx = st.nx, s = Math.min(c, (pw / 1.4) | 0), ox = px + ((pw - s) >> 1);
  if (nx[1]) { piece(ox, c + ((3 * c - 2 * s) >> 1), s, nx[1]); piece(ox, c + ((3 * c - 2 * s) >> 1) + s, s, nx[0]); } else piece(ox, c + ((3 * c - s) >> 1), s, nx[0]);
  text("세탁", px + (pw >> 1), 4 * c + (c >> 1), fs, "#a84a78", "center");
  text(`${st.washes}번`, px + (pw >> 1), 4 * c + (c >> 1) + fs + 4, fs + 4, INK, "center");
  if (info.fever > 0) text("건조기!", px + (pw >> 1), 4 * c + (c >> 1) + fs * 2 + 14, fs, Math.floor(t / 150) % 2 ? "#e8602a" : "#f0a020", "center");
  if (info.phase !== "run") {
    g.fillStyle = "rgba(90,130,170,.3)"; g.fillRect(0, 0, BW, BH);
    const w = BW - c, h = c * 1.4, x = c / 2, y = (BH >> 1) - h / 2;
    g.fillStyle = EDGE; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = "#fffaf4"; g.fillRect(x, y, w, h); g.fillStyle = "#ffffff"; g.fillRect(x, y, w, 2);
    text(info.phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!") : "수고하셨어요!", x + w / 2, y + (h - fs - 4) / 2, fs + 4, INK, "center");
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ── mount: the washer and the touch buttons
function mount(h, a) {
  host = h; api = a; st = null; shift = 0; evSeq = -1; parts = []; flashes = []; chainShow = null; sig = ""; phase = "brief"; lastT = 0; shakeAt = 0; landAt = new Map(); lastS = {};
  host.textContent = ""; Object.assign(host.style, { alignSelf: "stretch", background: "#fff0f6" });
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
  host = null; api = null; cv = null; g = null; st = null; parts = [];
}

export default { mount, setState, frame, key, unmount };
