/**
 * 일일 아르바이트 · 철거 알바 board (logic 67-alba-wall.js, contract in alba.js): an Arkanoid-style brick breaker in a 240 × 240 field, drawn at whole-pixel
 * coordinates and scaled up without smoothing. The server owns the balls and bricks; this draws the last state it sent, moved on with the velocities it sent,
 * and sends intents: the paddle's target x (mouse, finger drag, ← →) and "go" (click / tap / Space / button) which lets the waiting ball fly.
 * view = [wall, [paddle x, vx per step, half width], 108 chars (12 × 9 bricks: '.' none · 1-3 hits left · b bomb · w m p s bonus box by item),
 *         balls [x, y, vx, vy (¼ px per step), held …], items [x, y, kind …], [wide ms, piercing ms, slow ms, serve ms], events [[seq, type, x, y, value]…], bricks left, big ball 0|1]
 * Geometry mirrored from the rules for DRAWING only (brick size and origin, the paddle's row, the items' fall speed); no rule is decided here.
 */
const W = 240, H = 240, BW = 20, BH = 8, COLS = 12, Y0 = 28, PY = 222, FALL = 3, STEP = 50, PSPD = 10;
const FONT = "Galmuri11, Galmuri9, sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ITEMS = ["넓은 발판", "공 3개", "관통 철구", "느린 공"], ITEM_COL = ["#6ab0ff", "#ff8ac0", "#ff9a3a", "#9ae06a"];
const GLYPH = [[".....", ".X.X.", "XXXXX", ".X.X.", "....."], ["X.X.X", ".....", "X.X.X", ".....", "X.X.X"], ["..X..", ".XXX.", "..X..", "..X..", "..X.."], ["XXXXX", ".XXX.", "..X..", ".XXX.", "XXXXX"]];
const PLAIN = [null, ["#c4684a", "#e48a68", "#8e4630"], ["#8794a6", "#b2bfd0", "#5c6878"], ["#4e5666", "#7a8496", "#2c323e"]];   // by hits left: body, light, shade
const ITEM_LETTER = { w: 0, m: 1, p: 2, s: 3 };

let host = null, api = null, cv = null, g = null, fit = 2, kk = 1, sig = "", st = null, seen = -1, phase = "brief", wrap = null;
let target = 120, px = 120, lastX = -1, lastSend = 0, parts = [], pops = [], trail = [], lastT = 0, killFx = 0, rushShown = false, goAt = 0, bombFx = 0;

function layout() {
  const hw = Math.max(240, host.clientWidth - 4), ah = Math.max(280, innerHeight * 0.96 - 330) - 50;
  const f = clamp(Math.min(hw / W, ah / H), 0.7, 3.2), k = Math.max(1, Math.floor(f));
  if (f === fit && k === kk && cv.width) return;
  fit = f; kk = k;
  cv.width = W * k; cv.height = H * k;
  cv.style.width = `${Math.round(W * f)}px`; cv.style.height = `${Math.round(H * f)}px`;
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
}

// ── inputs
function pointer(e) {
  const r = cv.getBoundingClientRect();
  target = clamp(Math.round(((e.clientX - r.left) / r.width) * W), 0, W);
}
function go() { goAt = performance.now(); }
function sendNow(t) {
  if (!api || phase !== "run") return;
  const x = Math.round(clamp(target, 0, W)), wantGo = goAt > lastSend;
  if (!wantGo && (x !== lastX ? t - lastSend < 55 : t - lastSend < 500)) return;   // a change at once (≤ 18/s), a keep-alive twice a second
  lastX = x; lastSend = t;
  api.act(wantGo ? { x, go: 1 } : { x });
}
// keys: the shift window hands this board key-downs only, so a held key steps the target (never more than 40 ahead of the paddle); Space / Enter serve
function key(e) {
  const n = e.key.length > 1 || e.key === " " ? e.key : /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
  if (n === "ArrowLeft" || n === "a") target = Math.max(0, px - 40, Math.min(target, px) - 8);
  else if (n === "ArrowRight" || n === "d") target = Math.min(W, px + 40, Math.max(target, px) + 8);
  else if (n === " " || n === "Enter") go();
  else return false;
  return true;
}

// ── state from the server
function setState(v, t) {
  const prev = st;
  st = { wall: v[0], pad: v[1], bricks: v[2], B: v[3], I: v[4], fx: v[5], ev: v[6], left: v[7], big: v[8], at: t };
  if (!prev) { px = st.pad[0]; target = px; }
  const first = seen < 0;
  let top = seen;
  bombFx = 0;
  for (const e of st.ev) {
    if (e[0] <= seen) continue;
    top = Math.max(top, e[0]);
    if (!first) hit(e[1], e[2], e[3], e[4]);
  }
  seen = top;
}
function burst(x, y, cols, n, sp = 1) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: ((i * 37) % 11 - 5) * 0.2 * sp, vy: ((i * 53) % 9 - 7) * 0.2 * sp, life: 16 + (i % 6), col: cols[i % cols.length] });
}
function pop(text, x, y, col) { pops.push({ text, x, y, life: 30, col }); }
function hit(type, x, y, v) {
  if (type === 1) { burst(x, y, ["#e48a68", "#c4684a", "#d8d2c4"], 7); if (v) pop(`+${v}`, x, y - 4, "#fff"); if (++killFx % 4 === 0) api.fx("good"); }
  else if (type === 2) { burst(x, y, ["#b2bfd0", "#fff"], 3, 0.7); api.sfx("alba_tick"); }
  else if (type === 3) { burst(x, y, ["#ff9a3a", "#ffd84a", "#fff", "#ff5a3a"], 14, 1.6); if (!bombFx++) { api.fx("big", "폭탄! 연쇄!"); if (v) pop(`+${v}`, x, y - 6, "#ffd84a"); } }
  else if (type === 4) { burst(x, y, [ITEM_COL[v], "#fff"], 12); pop(ITEMS[v], x, y - 12, ITEM_COL[v]); api.fx("big", `${ITEMS[v]}! +30`); }
  else if (type === 5) { burst(x, y, ["#ff6a5a", "#fff"], 12, 1.2); api.fx("bad", "공을 놓쳤다! -50"); }
  else if (type === 6) { pop(`현장 완파! +${v}`, W / 2, 130, "#9ae06a"); burst(W / 2, 100, ["#ffd84a", "#fff", "#9ae06a"], 24, 2); api.fx("big", `현장 완파! +${v}`); }
  else if (type === 7) burst(x, y, ["#e8eef6", "#b2bfd0"], 3, 0.6);
  else if (type === 8) burst(x, y, ["#ffd84a", "#fff"], 5, 0.6);
}

// ── drawing
const r1 = Math.round;
function text(s, x, y, size, col, align = "left") {
  g.font = `bold ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "top";
  g.fillStyle = "#000"; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}
function glyph(k, x, y, col) {
  g.fillStyle = col;
  GLYPH[k].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "X") g.fillRect(x + i, y + j, 1, 1); }));
}
function brick(ch, x, y, t) {
  const o = "#15171e";
  g.fillStyle = o; g.fillRect(x, y, BW, BH);
  if (ch === "b") {   // a bomb: dark casing, a lit fuse
    g.fillStyle = "#2c2c34"; g.fillRect(x + 1, y + 1, BW - 2, BH - 2); g.fillStyle = "#4a4a56"; g.fillRect(x + 1, y + 1, BW - 2, 1);
    g.fillStyle = "#14141a"; g.fillRect(x + 6, y + 2, 8, 5); g.fillRect(x + 7, y + 1, 6, 1);
    g.fillStyle = "#c83a3a"; g.fillRect(x + 9, y + 3, 2, 2);
    g.fillStyle = Math.floor(t / 90) % 2 ? "#ffd84a" : "#ff8a3a"; g.fillRect(x + 12, y, 2, 2);
    return;
  }
  const letter = ITEM_LETTER[ch];
  if (letter !== undefined) {   // a bonus box: gold crate with the item's sign
    g.fillStyle = "#c8942e"; g.fillRect(x + 1, y + 1, BW - 2, BH - 2); g.fillStyle = "#f0c85a"; g.fillRect(x + 1, y + 1, BW - 2, 1);
    g.fillStyle = "#8a5e1a"; g.fillRect(x + 1, y + BH - 2, BW - 2, 1); g.fillRect(x + 3, y + 1, 1, BH - 2); g.fillRect(x + BW - 4, y + 1, 1, BH - 2);
    g.fillStyle = ITEM_COL[letter]; g.fillRect(x + 7, y + 1, 6, BH - 2);
    glyph(letter, x + 7, y + 1, "#1a1a22");
    return;
  }
  const hp = +ch, c = PLAIN[hp];
  g.fillStyle = c[0]; g.fillRect(x + 1, y + 1, BW - 2, BH - 2);
  g.fillStyle = c[1]; g.fillRect(x + 1, y + 1, BW - 2, 1);
  g.fillStyle = c[2]; g.fillRect(x + 1, y + BH - 2, BW - 2, 1);
  if (hp === 1) { g.fillStyle = c[2]; g.fillRect(x + 9, y + 2, 1, 3); }   // a mortar line
  else if (hp === 2) { g.fillStyle = c[2]; g.fillRect(x + 4, y + 2, 5, 1); g.fillRect(x + 9, y + 3, 3, 1); g.fillRect(x + 12, y + 4, 4, 1); }   // a crack
  else { g.fillStyle = c[1]; g.fillRect(x + 3, y + 3, 2, 2); g.fillRect(x + BW - 5, y + 3, 2, 2); g.fillStyle = c[2]; g.fillRect(x + 8, y + 2, 4, 1); }   // rivets
}
function disc(x, y, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(r * r + 0.5 - dy * dy)); g.fillRect(x - h, y + dy, 2 * h + 1, 1); }
}
function ball(x, y, big, t) {
  const r = big ? 5 : 3;
  if (big) { g.fillStyle = "rgba(255,150,40,.35)"; disc(x, y, r + 2, "rgba(255,150,40,.3)"); }
  disc(x, y, r, "#14161c"); disc(x, y, r - 1, big ? "#ff9a3a" : "#8a929e");
  g.fillStyle = big ? "#ffe08a" : "#e8eef6"; g.fillRect(x - r + 2, y - r + 2, 2, 2);
  if (big && Math.floor(t / 80) % 2) { g.fillStyle = "#ffd84a"; g.fillRect(x - 1, y - r - 2, 2, 2); }
}
function back() {
  g.fillStyle = "#1a1d27"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#212634";
  for (let y = 0; y < H; y += 12) { g.fillRect(0, y, W, 1); for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) g.fillRect(x, y, 1, 12); }   // an old wall behind
  g.fillStyle = "#12141b"; g.fillRect(0, PY + 9, W, H - PY - 9);
  g.fillStyle = "#2c3140"; g.fillRect(0, PY + 9, W, 1);
}
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  phase = info.phase;
  g.setTransform(kk, 0, 0, kk, 0, 0);
  back();
  const dtf = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  if (!st) { text("벽을 찾는 중…", W / 2, H / 2, 11, "#f3ead2", "center"); return; }
  const ds = Math.min(3, (t - st.at) / STEP), blink = Math.floor(t / 250) % 2;
  const [padX, padVx, hw] = st.pad, fx = st.fx.map((m) => Math.max(0, m - (t - st.at)));
  const sx = clamp(padX + padVx * ds, hw, W - hw);
  px += clamp(target - px, -PSPD * dtf * 20, PSPD * dtf * 20); px += (sx - px) * 0.15;
  px = clamp(px, hw, W - hw);
  if (phase === "run") sendNow(t);
  // the wall
  for (let i = 0; i < st.bricks.length; i++) { const ch = st.bricks[i]; if (ch !== ".") brick(ch, (i % COLS) * BW, Y0 + ((i / COLS) | 0) * BH, t); }
  // items falling
  for (let i = 0; i < st.I.length; i += 3) {
    const x = st.I[i], y = r1(st.I[i + 1] + FALL * ds), k = st.I[i + 2];
    g.fillStyle = "#15171e"; g.fillRect(x - 7, y - 5, 14, 10); g.fillStyle = ITEM_COL[k]; g.fillRect(x - 6, y - 4, 12, 8); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x - 6, y - 4, 12, 1);
    glyph(k, x - 2, y - 2, "#1a1a22");
  }
  // the paddle: a plank with iron caps
  const pl = r1(px - hw), pw = hw * 2;
  g.fillStyle = "#15171e"; g.fillRect(pl, PY, pw, 7);
  g.fillStyle = "#c8964a"; g.fillRect(pl + 1, PY + 1, pw - 2, 5); g.fillStyle = "#e8b868"; g.fillRect(pl + 1, PY + 1, pw - 2, 1); g.fillStyle = "#8a5e2a"; g.fillRect(pl + 1, PY + 5, pw - 2, 1);
  g.fillStyle = "#8a929e"; g.fillRect(pl + 1, PY + 1, 4, 5); g.fillRect(pl + pw - 5, PY + 1, 4, 5); g.fillStyle = "#c4ccd6"; g.fillRect(pl + 1, PY + 1, 4, 1); g.fillRect(pl + pw - 5, PY + 1, 4, 1);
  // the balls (a short trail behind each)
  const bs = [];
  for (let i = 0; i < st.B.length; i += 5) {
    const held = st.B[i + 4];
    bs.push(held ? [px, PY - 3, 1] : [clamp(st.B[i] + (st.B[i + 2] / 4) * ds, 3, W - 3), st.B[i + 1] + (st.B[i + 3] / 4) * ds, 0]);
  }
  trail.push(bs.filter((b) => !b[2]).map((b) => [b[0], b[1]]));
  if (trail.length > 4) trail.shift();
  trail.forEach((fr, n) => { g.globalAlpha = 0.12 * (n + 1); for (const [x, y] of fr) disc(r1(x), r1(y), st.big ? 4 : 2, st.big ? "#ff9a3a" : "#8a929e"); });
  g.globalAlpha = 1;
  for (const [x, y] of bs) ball(r1(x), r1(Math.min(y, H + 6)), st.big, t);
  const waiting = st.B.length && st.B[4] && fx[3] <= 0;
  if (phase === "run" && waiting) text(blink ? "클릭 · 스페이스 · 발사 버튼으로 발사!" : "", W / 2, PY - 30, 10, "#ffd84a", "center");
  // sparks and numbers
  parts = parts.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of parts) { p.x += p.vx * dtf * 60; p.y += p.vy * dtf * 60; p.vy += 0.06 * dtf * 60; g.fillStyle = p.col; g.fillRect(r1(p.x), r1(p.y), 2, 2); }
  pops = pops.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of pops) { g.globalAlpha = clamp(p.life / 14, 0, 1); text(p.text, p.x, p.y - (30 - p.life) * 0.5, 9, p.col, "center"); g.globalAlpha = 1; }
  // the strip: wall, bricks left; and the power-ups running
  g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(0, 0, W, 14);
  text(`현장 ${st.wall}`, 4, 2, 9, "#e2c486");
  text(`벽돌 ${st.left}`, W - 4, 2, 9, "#f3ead2", "right");
  if (info.fever > 0) text("대형 철구!", W / 2, 2, 9, "#ff9a3a", "center");
  if (info.rush && !rushShown && phase === "run") { rushShown = true; pop("막판 러시! 벽이 내려와요", W / 2, 150, "#ff9a3a"); }
  let cx = 4;
  [["넓음", 0], ["관통", 1], ["느림", 2]].forEach(([name, i]) => {
    if (fx[i] <= 0) return;
    g.fillStyle = "#15171e"; g.fillRect(cx, PY + 13, 40, 9); g.fillStyle = ITEM_COL[[0, 2, 3][i]]; g.fillRect(cx + 1, PY + 14, Math.round((38 * Math.min(fx[i], 12000)) / 12000), 7);
    text(name, cx + 3, PY + 13, 8, "#1a1a22"); cx += 44;
  });
  if (info.phase !== "run") {
    g.fillStyle = "rgba(10,8,16,.6)"; g.fillRect(0, 0, W, H);
    text(info.phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!") : "수고하셨어요!", W / 2, H / 2 - 10, 16, "#fff", "center");
    if (info.phase === "brief") text("마우스·터치로 발판 이동 · 클릭으로 발사", W / 2, H / 2 + 14, 9, "#e2c486", "center");
  }
}

// ── mount: the board and its buttons
function mount(h, a) {
  host = h; api = a; st = null; seen = -1; sig = ""; phase = "brief"; parts = []; pops = []; trail = []; target = 120; px = 120; lastX = -1; lastSend = 0; killFx = 0; lastT = 0; rushShown = false; goAt = 0; bombFx = 0;
  host.textContent = "";
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas");
  cv.style.cssText = "image-rendering:pixelated;touch-action:none;cursor:crosshair;border:2px solid #000;";
  cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) pointer(e); });
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* a plain click still works */ } pointer(e); go(); });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  wrap.append(cv);
  const pad = document.createElement("div");
  pad.style.cssText = "display:flex;gap:6px;width:min(100%,420px);";
  const add = (label, fn, up) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = "flex:1;min-height:40px;font-size:14px;touch-action:none;user-select:none;";
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); fn(); });
    if (up) for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.append(b);
  };
  add("◀", () => { target = 0; }, () => { target = Math.round(px); });
  add("발사 ⤒", go);
  add("▶", () => { target = W; }, () => { target = Math.round(px); });
  wrap.append(pad);
  host.append(wrap);
  layout();
}
function unmount() {
  if (host) host.textContent = "";
  host = null; api = null; cv = null; g = null; st = null; wrap = null;
}

export default { mount, setState, frame, key, unmount };
