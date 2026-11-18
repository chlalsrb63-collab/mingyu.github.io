/**
 * 일일 아르바이트 · 택배 상하차 board (logic 67-alba-parcel.js, contract in alba.js): boxes on a truck bed, 8 wide × 10 high.
 * The server owns the falling box; this draws the board and the box (sliding smoothly between the server's drops), a ghost where it would land,
 * the next box, and sends inputs: ← → move · ↑ / X turn · Z turn back · ↓ one row · Space drop · the same as touch buttons.
 * view = [board 80 chars (. empty · 1-7 box · f fragile), cur cells [x,y,…], cur kind, cur fragile, next cells, next kind, next fragile, ms to drop, drop ms, rows shipped, ev [seq, flags, rowMask]]
 * Look: a steel-blue truck bed (so the cardboard pops), cream side card. Sounds: step (move), snap (turn), swish (drop), thud (a box lands), coin/chime (rows), crunch (fragile), buzz (truck swap).
 */
const W = 8, H = 10;
const BODY = [["#dcae6e", "#f2cc94", "#a87c42"], ["#e6c286", "#f8dcaa", "#b48a56"], ["#c98f58", "#e4ac78", "#8f6032"], ["#d6bc82", "#eed8a2", "#a28a54"],
  ["#bd8546", "#d8a068", "#8a5a2a"], ["#e6a062", "#f8c08a", "#b07034"], ["#c8b07a", "#e0cc9a", "#968050"]];
const FRAG = ["#f2ece0", "#ffffff", "#c4b8a4"];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FONT = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const INK = "#4a3420", EDGE = "#3a2616";

let host = null, api = null, cv = null, g = null, c = 24, sig = "", stops = [], st = null, shift = 0, shiftAt = 0, evSeq = -1, flashes = [], lastSend = 0, phase = "brief", wrap = null;
let fxp = [], landAt = new Map(), shakeAt = 0, lastT = 0, lastS = {};

/** A sound, throttled so a held key never spams it. */
function snd(n, gap = 70) { const t = performance.now(); if (api && t - (lastS[n] || 0) >= gap) { lastS[n] = t; api.sfx(n); } }
function burst(x, y, n, cols, spd = 40, up = 40) {
  for (let i = 0; i < n; i++) fxp.push({ x, y, vx: (Math.random() - 0.5) * spd * 2, vy: -Math.random() * up - 10, life: 0.35 + Math.random() * 0.3, col: cols[i % cols.length] });
  if (fxp.length > 140) fxp.splice(0, fxp.length - 140);
}

function layout() {
  const hw = Math.max(240, host.clientWidth - 4), ah = Math.max(280, innerHeight * 0.96 - 330) - 60;
  const s = clamp(Math.floor(Math.min(hw / 13, ah / H)), 12, 34);
  if (g && s === c) return;
  c = s;
  cv.width = 13 * c; cv.height = H * c;
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
function cellsNow() {
  const o = [];
  if (st) for (let i = 0; i < st.cells.length; i += 2) o.push([st.cells[i] + shift, st.cells[i + 1]]);
  return o;
}
function move(dx) {
  if (phase !== "run" || !st || !st.cells.length) return;
  if (cellsNow().every(([x, y]) => free(x + dx, y))) { shift += dx; shiftAt = api.now(); snd("alba_step", 70); }   // shown at once; the server's view corrects it
  send({ mv: dx });
}
const turn = (d) => { if (phase === "run" && st && st.cells.length) { snd("alba_snap", 80); send({ rot: d }); } };
const soft = () => { if (phase === "run" && st && st.cells.length) { snd("alba_step", 80); send({ drop: 1 }); } };
const hard = () => { if (phase === "run" && st && st.cells.length) { snd("alba_swish", 150); send({ drop: 2 }); } };
const KEYS = { ArrowLeft: () => move(-1), a: () => move(-1), ArrowRight: () => move(1), d: () => move(1), ArrowUp: () => turn(1), w: () => turn(1), x: () => turn(1), z: () => turn(-1), ArrowDown: soft, s: soft, " ": hard };
const REPEAT = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "a", "d", "s"]);

// ── state from the server
function setState(v, t) {
  const first = !st, old = st, now = api.now();
  st = { b: v[0], cells: v[1], k: v[2], f: v[3], nx: v[4], nk: v[5], nf: v[6], d: v[7], dm: Math.max(100, v[8]), rows: v[9], at: t };
  shift = 0;
  if (old && !(v[10][0] !== evSeq && v[10][1] & 1)) {   // a box landed: the board has new cells (it squashes, dust, thud); a shipped row shifts cells, so skip then
    let n = 0;
    for (let i = 0; i < st.b.length; i++) if (old.b[i] === "." && st.b[i] !== ".") { n++; landAt.set(i, now); burst((i % W) * c + c / 2, ((i / W) | 0) * c + c, 2, ["#f2ece0", "#d8c8a8"], 24, 14); }
    if (n) snd("alba_thud", 90);
  }
  const ev = v[10];
  if (first) { evSeq = ev[0]; return; }
  if (ev[0] === evSeq) return;
  evSeq = ev[0];
  const flags = ev[1];
  if (flags & 1) {
    let n = 0;
    for (let m = ev[2]; m; m &= m - 1) n++;
    api.fx(n > 1 ? "big" : "good", n > 1 ? `${n}줄 출하!` : "출하!");
    flashes.push({ at: now, mask: ev[2], kind: 1 });
    snd(n > 1 ? "alba_chime" : "alba_coin", 100); if (n > 1) snd("alba_coin", 100);
    for (let y = 0; y < H; y++) if (ev[2] & (1 << y)) burst(c * W * 0.5, y * c + c / 2, 14, ["#ffffff", "#ffe27a", "#f2cc94", "#8fd0f0"], c * 4, c * 2);
  }
  if (flags & 4) { api.fx("bad", "파손! -30"); flashes.push({ at: now, mask: 0, kind: 3 }); snd("alba_crunch", 100); shakeAt = now; }
  if (flags & 2) { api.fx("bad", "트럭 교체! -100"); flashes.push({ at: now, mask: 0, kind: 2 }); snd("alba_buzz", 200); shakeAt = now; }
}

// ── drawing
function box(x, y, s, kind, frag, a = 1) {
  const o = Math.max(1, (s / 12) | 0), body = frag ? FRAG : BODY[kind - 1];
  g.globalAlpha = a;
  g.fillStyle = EDGE; g.fillRect(x, y, s, s);
  g.fillStyle = body[0]; g.fillRect(x + o, y + o, s - 2 * o, s - 2 * o);
  g.fillStyle = body[1]; g.fillRect(x + o, y + o, s - 2 * o, o); g.fillRect(x + o, y + o, o, s - 2 * o);
  g.fillStyle = body[2]; g.fillRect(x + o, y + s - 2 * o, s - 2 * o, o); g.fillRect(x + s - 2 * o, y + o, o, s - 2 * o);
  if (frag) {   // a red band and a crack: "깨짐 주의"
    g.fillStyle = "#e0453a"; g.fillRect(x + o, y + ((s * 0.4) | 0), s - 2 * o, Math.max(2, o * 2));
    g.fillStyle = "#fffaf0"; g.fillRect(x + (s >> 1) - o, y + ((s * 0.4) | 0), o * 2, Math.max(2, o * 2));
    g.fillStyle = "#9ac8e8"; g.fillRect(x + o * 2, y + s - o * 5, o * 2, o * 3); g.fillRect(x + s - o * 4, y + s - o * 5, o * 2, o * 3);   // a glass on the side
  } else {
    g.fillStyle = "#fff0c4"; g.fillRect(x + (s >> 1) - o, y + o, o * 2, Math.max(2, s >> 2));   // the tape
    g.fillStyle = "#fffaf0"; g.fillRect(x + o * 2, y + s - o * 5, o * 3, o * 2); g.fillStyle = "#c8a070"; g.fillRect(x + o * 2, y + s - o * 3, o * 3, o);   // a label
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
function plaque(x, y, w, h, head, sub, fs) {
  g.fillStyle = EDGE; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = "#fff4d6"; g.fillRect(x, y, w, h); g.fillStyle = "#ffffff"; g.fillRect(x, y, w, 2); g.fillStyle = "#e0c898"; g.fillRect(x, y + h - 2, w, 2);
  text(head, x + w / 2, y + (sub ? h * 0.18 : (h - fs) / 2), fs, INK, "center");
  if (sub) text(sub, x + w / 2, y + h * 0.62, Math.max(10, fs * 0.6), "#7a6044", "center");
}

function frame(t, info) {
  const key = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key !== sig) { sig = key; layout(); }
  phase = info.phase;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  if (shift && t - shiftAt > 350) shift = 0;
  const BW = W * c, BH = H * c, fs = clamp(Math.round(c * 0.42), 11, 15);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#dceaf2"; g.fillRect(0, 0, cv.width, cv.height);   // the card the side stuff sits on
  if (t - shakeAt < 260) g.translate(Math.round(Math.sin(t / 18) * 3), 0);
  // the truck bed: steel plates, rails with rivets
  for (let y = 0; y < H; y++) { g.fillStyle = y % 2 ? "#86a0ba" : "#8fa9c2"; g.fillRect(0, y * c, BW, c); }
  g.fillStyle = "#a8c0d6"; for (let y = 0; y < H; y++) g.fillRect(0, y * c, BW, 1);
  g.fillStyle = "#6e88a4"; for (let x = 1; x < W; x++) g.fillRect(x * c, 0, 1, BH);
  const rw = Math.max(3, (c / 8) | 0) + 1;
  g.fillStyle = EDGE; g.fillRect(BW, 0, rw + 1, BH); g.fillRect(-1, 0, rw + 1, BH);
  g.fillStyle = "#f0b838"; g.fillRect(BW + 1, 0, rw - 1, BH); g.fillRect(0, 0, rw - 1, BH);
  g.fillStyle = "#a86a10"; for (let y = 0; y < BH; y += c) { g.fillRect(BW + 1, y + c - 3, rw - 1, 3); g.fillRect(0, y + c - 3, rw - 1, 3); }
  if (!st) { text("상자를 기다리는 중…", BW >> 1, BH >> 1, fs, "#ffffff", "center", EDGE); return; }
  // the stack
  for (let i = 0; i < st.b.length; i++) {
    const ch = st.b[i];
    if (ch === ".") continue;
    const age = t - (landAt.get(i) || -1e9), x = (i % W) * c, y = ((i / W) | 0) * c;
    box(x, y + (age < 110 ? Math.round(c * 0.08 * (1 - age / 110)) : 0), c, ch === "f" ? 1 : +ch, ch === "f");
    if (age < 140) { g.globalAlpha = 0.5 * (1 - age / 140); g.fillStyle = "#ffffff"; g.fillRect(x, y, c, c); g.globalAlpha = 1; }
  }
  // the falling box, its ghost
  const cells = cellsNow();
  if (cells.length) {
    let drop = 0;
    while (cells.every(([x, y]) => free(x, y + drop + 1))) drop++;
    if (drop) for (const [x, y] of cells) outline(x * c, (y + drop) * c, c, "rgba(255,255,255,.75)");
    const rest = !cells.every(([x, y]) => free(x, y + 1)), toDrop = st.d - (t - st.at);
    const frac = rest || info.phase !== "run" ? 0 : clamp(1 - toDrop / st.dm, 0, 1), oy = Math.round(frac * c);
    for (const [x, y] of cells) box(x * c, y * c + oy, c, st.k, st.f);
  }
  // the effects
  flashes = flashes.filter((f) => t - f.at < 380);
  for (const f of flashes) {
    const age = t - f.at;
    if (f.kind === 1) { g.globalAlpha = clamp(1 - age / 260, 0, 1); g.fillStyle = "#fff"; for (let y = 0; y < H; y++) if (f.mask & (1 << y)) g.fillRect(0, y * c, BW, c); }
    else { g.globalAlpha = clamp(0.5 - age / 760, 0, 0.5); g.fillStyle = f.kind === 2 ? "#ff3a2a" : "#ffb04a"; g.fillRect(0, 0, BW, BH); }
    g.globalAlpha = 1;
  }
  for (let i = fxp.length - 1; i >= 0; i--) {
    const p = fxp[i]; p.life -= dt;
    if (p.life <= 0) { fxp.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += c * 12 * dt;
    g.globalAlpha = clamp(p.life * 3, 0, 1); g.fillStyle = p.col; const q = Math.max(2, (c / 8) | 0); g.fillRect(Math.round(p.x), Math.round(p.y), q, q);
  }
  g.globalAlpha = 1;
  // the side: the next box and the count, on a cream card
  const px = BW + rw + 4, pw = 13 * c - px - 3;
  g.fillStyle = "#fff4d6"; g.fillRect(px - 2, 0, pw + 4, BH); g.fillStyle = "#e0c898"; g.fillRect(px - 2, 0, 2, BH);
  text("다음", px + (pw >> 1), 4, fs, INK, "center");
  g.fillStyle = EDGE; g.fillRect(px, c, pw, pw); g.fillStyle = "#b8d0e0"; g.fillRect(px + 2, c + 2, pw - 4, pw - 4);
  if (st.nx.length) {
    const xs = [], ys = [];
    for (let i = 0; i < st.nx.length; i += 2) { xs.push(st.nx[i]); ys.push(st.nx[i + 1]); }
    const w = Math.max(...xs) + 1, h = Math.max(...ys) + 1, s = Math.min(c, (pw / 5) | 0), ox = px + ((pw - w * s) >> 1), oy = c + ((pw - h * s) >> 1);
    for (let i = 0; i < xs.length; i++) box(ox + xs[i] * s, oy + ys[i] * s, s, st.nk, st.nf);
  }
  text("출하", px + (pw >> 1), c + pw + (c >> 1), fs, "#8a6a30", "center");
  text(`${st.rows}줄`, px + (pw >> 1), c + pw + (c >> 1) + fs + 4, fs + 4, INK, "center");
  if (info.fever > 0) text("지게차!", px + (pw >> 1), c + pw + (c >> 1) + fs * 2 + 14, fs, Math.floor(t / 150) % 2 ? "#e8602a" : "#f0a020", "center");
  if (info.phase !== "run") {
    g.fillStyle = "rgba(60,90,120,.35)"; g.fillRect(0, 0, BW, BH);
    plaque(c * 0.8, BH / 2 - c * 0.9, BW - c * 1.6, c * 1.8, info.phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!") : "수고하셨어요!", info.phase === "brief" ? "상자를 빈틈없이 쌓아요" : "", fs + 4);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

// ── mount: the board and the touch buttons
function mount(h, a) {
  host = h; api = a; st = null; shift = 0; evSeq = -1; flashes = []; sig = ""; phase = "brief"; fxp = []; landAt = new Map(); shakeAt = 0; lastT = 0; lastS = {};
  host.textContent = ""; Object.assign(host.style, { alignSelf: "stretch", background: "#dceaf2" });
  wrap = document.createElement("div");
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
  host = null; api = null; cv = null; g = null; st = null; wrap = null; fxp = [];
}

export default { mount, setState, frame, key, unmount };
