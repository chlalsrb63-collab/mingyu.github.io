/**
 * 일일 아르바이트 · 택배 상하차 board (logic 67-alba-parcel.js, contract in alba.js): boxes on a truck bed, 8 wide × 10 high.
 * The server owns the falling box; this draws the board and the box (sliding smoothly between the server's drops), a ghost where it would land,
 * the next box, and sends inputs: ← → move · ↑ / X turn · Z turn back · ↓ one row · Space drop · the same as touch buttons.
 * view = [board 80 chars (. empty · 1-7 box · f fragile), cur cells [x,y,…], cur kind, cur fragile, next cells, next kind, next fragile, ms to drop, drop ms, rows shipped, ev [seq, flags, rowMask]]
 */
const W = 8, H = 10;
const BODY = [["#d0a46a", "#e6c58c", "#a07840"], ["#dcb97c", "#f0d6a0", "#aa8650"], ["#b98550", "#d6a070", "#87592e"], ["#c9b27a", "#e2d09a", "#9a8450"],
  ["#a9763f", "#c69460", "#7a4e24"], ["#d8985a", "#f0b87c", "#a86a30"], ["#b8a070", "#d4c090", "#8c7648"]];
const FRAG = ["#ece4d4", "#fffaf0", "#b8ac98"];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FONT = "Galmuri11, Galmuri9, sans-serif";

let host = null, api = null, cv = null, g = null, c = 24, sig = "", stops = [], st = null, shift = 0, shiftAt = 0, evSeq = -1, flashes = [], lastSend = 0, phase = "brief", wrap = null;

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
  if (cellsNow().every(([x, y]) => free(x + dx, y))) { shift += dx; shiftAt = api.now(); }   // shown at once; the server's view corrects it
  send({ mv: dx });
}
const turn = (d) => phase === "run" && st && st.cells.length && send({ rot: d });
const soft = () => phase === "run" && st && st.cells.length && send({ drop: 1 });
const hard = () => phase === "run" && st && st.cells.length && send({ drop: 2 });
const KEYS = { ArrowLeft: () => move(-1), a: () => move(-1), ArrowRight: () => move(1), d: () => move(1), ArrowUp: () => turn(1), w: () => turn(1), x: () => turn(1), z: () => turn(-1), ArrowDown: soft, s: soft, " ": hard };
const REPEAT = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "a", "d", "s"]);

// ── state from the server
function setState(v, t) {
  const first = !st;
  st = { b: v[0], cells: v[1], k: v[2], f: v[3], nx: v[4], nk: v[5], nf: v[6], d: v[7], dm: Math.max(100, v[8]), rows: v[9], at: t };
  shift = 0;
  const ev = v[10];
  if (first) { evSeq = ev[0]; return; }
  if (ev[0] === evSeq) return;
  evSeq = ev[0];
  const flags = ev[1], now = api.now();
  if (flags & 1) {
    let n = 0;
    for (let m = ev[2]; m; m &= m - 1) n++;
    api.fx(n > 1 ? "big" : "good", n > 1 ? `${n}줄 출하!` : "출하!");
    flashes.push({ at: now, mask: ev[2], kind: 1 });
  }
  if (flags & 4) { api.fx("bad", "파손! -30"); flashes.push({ at: now, mask: 0, kind: 3 }); }
  if (flags & 2) { api.fx("bad", "트럭 교체! -100"); flashes.push({ at: now, mask: 0, kind: 2 }); }
}

// ── drawing
function box(x, y, s, kind, frag, a = 1) {
  const o = Math.max(1, (s / 12) | 0), body = frag ? FRAG : BODY[kind - 1];
  g.globalAlpha = a;
  g.fillStyle = "#2a1c10"; g.fillRect(x, y, s, s);
  g.fillStyle = body[0]; g.fillRect(x + o, y + o, s - 2 * o, s - 2 * o);
  g.fillStyle = body[1]; g.fillRect(x + o, y + o, s - 2 * o, o);
  g.fillStyle = body[2]; g.fillRect(x + o, y + s - 2 * o, s - 2 * o, o);
  if (frag) {   // a red band and a crack: "깨짐 주의"
    g.fillStyle = "#d23c3c"; g.fillRect(x + o, y + ((s * 0.4) | 0), s - 2 * o, Math.max(2, o * 2));
    g.fillStyle = "#fffaf0"; g.fillRect(x + (s >> 1) - o, y + ((s * 0.4) | 0), o * 2, Math.max(2, o * 2));
  } else { g.fillStyle = "#f4e6b8"; g.fillRect(x + (s >> 1) - o, y + o, o * 2, Math.max(2, s >> 2)); }
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
  if (shift && t - shiftAt > 350) shift = 0;
  const BW = W * c, BH = H * c;
  g.fillStyle = "#14121b"; g.fillRect(0, 0, cv.width, cv.height);
  // the truck bed
  for (let y = 0; y < H; y++) { g.fillStyle = y % 2 ? "#27232f" : "#2d2937"; g.fillRect(0, y * c, BW, c); }
  g.fillStyle = "#3c3749";
  for (let x = 1; x < W; x++) g.fillRect(x * c, 0, 1, BH);
  g.fillStyle = "#8a7448"; g.fillRect(BW, 0, 3, BH); g.fillRect(0, 0, 2, BH);
  if (!st) { text("상자를 기다리는 중…", BW >> 1, BH >> 1, 12, "#f3ead2", "center"); return; }
  // the stack
  for (let i = 0; i < st.b.length; i++) {
    const ch = st.b[i];
    if (ch !== ".") box((i % W) * c, ((i / W) | 0) * c, c, ch === "f" ? 1 : +ch, ch === "f");
  }
  // the falling box, its ghost
  const cells = cellsNow();
  if (cells.length) {
    let drop = 0;
    while (cells.every(([x, y]) => free(x, y + drop + 1))) drop++;
    if (drop) for (const [x, y] of cells) outline(x * c, (y + drop) * c, c, "rgba(243,234,210,.55)");
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
  // the side: the next box and the count
  const px = BW + (c >> 1) + 3, pw = 13 * c - px - 2;
  text("다음", px, 3, 12, "#e2c486");
  g.fillStyle = "#1d1a26"; g.fillRect(px, c, pw, pw); outline(px, c, pw, "#6b5a3a");
  if (st.nx.length) {
    const xs = [], ys = [];
    for (let i = 0; i < st.nx.length; i += 2) { xs.push(st.nx[i]); ys.push(st.nx[i + 1]); }
    const w = Math.max(...xs) + 1, h = Math.max(...ys) + 1, s = Math.min(c, (pw / 5) | 0), ox = px + ((pw - w * s) >> 1), oy = c + ((pw - h * s) >> 1);
    for (let i = 0; i < xs.length; i++) box(ox + xs[i] * s, oy + ys[i] * s, s, st.nk, st.nf);
  }
  text("출하", px, c + pw + (c >> 1), 12, "#e2c486");
  text(`${st.rows}줄`, px, c + pw + (c >> 1) + 16, 14, "#f3ead2");
  if (info.fever > 0) text("지게차!", px, c + pw + (c >> 1) + 40, 12, "#ff9a3a");
  if (info.phase !== "run") {
    g.fillStyle = "rgba(10,8,16,.6)"; g.fillRect(0, 0, BW, BH);
    text(info.phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!") : "수고하셨어요!", BW >> 1, (BH >> 1) - 8, 16, "#fff", "center");
  }
}

// ── mount: the board and the touch buttons
function mount(h, a) {
  host = h; api = a; st = null; shift = 0; evSeq = -1; flashes = []; sig = ""; phase = "brief";
  host.textContent = "";
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
  host = null; api = null; cv = null; g = null; st = null; wrap = null;
}

export default { mount, setState, frame, key, unmount };
