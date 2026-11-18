/**
 * 일일 아르바이트 · 철거 알바 board (logic 67-alba-wall.js, contract in alba.js): an Arkanoid-style brick breaker in a 240 × 240 field, drawn at whole-pixel
 * coordinates and scaled up without smoothing. The server owns the balls and bricks; this draws the last state it sent, moved on with the velocities it sent,
 * and sends intents: the paddle's target x (mouse, finger drag, ← →) and "go" (click / tap / Space / button) which lets the waiting ball fly.
 * view = [wall, [paddle x, vx per step, half width], 108 chars (12 × 9 bricks: '.' none · 1-3 hits left · b bomb · w m p s bonus box by item),
 *         balls [x, y, vx, vy (¼ px per step), held …], items [x, y, kind …], [wide ms, piercing ms, slow ms, serve ms], events [[seq, type, x, y, value]…], bricks left, big ball 0|1]
 * Geometry mirrored from the rules for DRAWING only (brick size and origin, the paddle's row, the items' fall speed); no rule is decided here.
 * Look: a sunny building site (sky, clouds, a skyline, a dirt yard); bricks shade from terracotta to riveted steel by hits left, actors keep the dark plum outline.
 */
const W = 240, H = 240, BW = 20, BH = 8, COLS = 12, Y0 = 28, PY = 222, FALL = 3, STEP = 50, PSPD = 10;
const OL = "#3a2a38", FONT9 = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif", FONT11 = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ITEMS = ["넓은 발판", "공 3개", "관통 철구", "느린 공"], ITEM_COL = ["#6ab0ff", "#ff8ac0", "#ff9a3a", "#8ae05a"];
const GLYPH = [[".....", ".X.X.", "XXXXX", ".X.X.", "....."], ["X.X.X", ".....", "X.X.X", ".....", "X.X.X"], ["..X..", ".XXX.", "..X..", "..X..", "..X.."], ["XXXXX", ".XXX.", "..X..", ".XXX.", "XXXXX"]];
const PLAIN = [null, ["#f08a5a", "#ffb68c", "#b8583a"], ["#b4c2d8", "#e2eaf6", "#7a8cac"], ["#5a68a0", "#8e9ccc", "#363f70"]];   // by hits left: body, light, shade
const ITEM_LETTER = { w: 0, m: 1, p: 2, s: 3 };

let host = null, api = null, cv = null, g = null, fit = 2, kk = 1, sig = "", st = null, seen = -1, phase = "brief", wrap = null, bgc = null, boardEl = null, boardWas = "";
let target = 120, px = 120, lastX = -1, lastSend = 0, parts = [], pops = [], trail = [], lastT = 0, killFx = 0, rushShown = false, goAt = 0, bombFx = 0, shake = 0, flash = null, padHit = -1e9, sfxAt = {};

/** A sound, but never twice within `gap` ms (a shower of bricks must not machine-gun). */
function sfx(name, gap = 70) {
  const t = api.now();
  if (t - (sfxAt[name] || -1e9) < gap) return;
  sfxAt[name] = t; api.sfx(name);
}
function layout() {
  const box = host.closest(".ap-box"), bd = host.parentElement, chrome = box && bd ? box.offsetHeight - bd.offsetHeight : 260;
  const hw = Math.max(240, host.clientWidth - 8), ah = Math.max(280, innerHeight * 0.96 - chrome - 8 - 62);
  const f = clamp(Math.min(hw / W, ah / H), 0.7, 3.2), k = Math.max(1, Math.ceil(f - 0.001));   // draw at the next whole scale up: the pixel font is rasterised at 9·k px (crisp), the page scales the canvas down to `f`
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
function go() {
  goAt = performance.now();
  if (phase === "run" && st && st.B.length && st.B[4]) sfx("alba_swish", 150);   // a waiting ball is let go
}
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
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: ((i * 37) % 11 - 5) * 0.2 * sp, vy: ((i * 53) % 9 - 7) * 0.2 * sp, life: 16 + (i % 6), col: cols[i % cols.length], big: i % 3 === 0 });
}
function pop(text, x, y, col) { pops.push({ text, x, y, life: 32, col }); }
function hit(type, x, y, v) {
  if (type === 1) { burst(x, y, ["#ffb68c", "#f08a5a", "#fff2dc", "#e2eaf6"], 8); if (v) pop(`+${v}`, x, y - 4, "#fff"); sfx("alba_crunch", 45); if (++killFx % 4 === 0) api.fx("good"); }
  else if (type === 2) { burst(x, y, ["#e2eaf6", "#fff"], 4, 0.7); sfx("alba_clang", 60); }
  else if (type === 3) { burst(x, y, ["#ff9a3a", "#ffd84a", "#fff", "#ff5a3a"], 16, 1.6); shake = api.now(); flash = { at: shake, col: "#fff2a8" }; sfx("alba_thud", 120); if (!bombFx++) { api.fx("big", "폭탄! 연쇄!"); if (v) pop(`+${v}`, x, y - 6, "#ffe27a"); } }
  else if (type === 4) { burst(x, y, [ITEM_COL[v], "#fff"], 12); pop(ITEMS[v], x, y - 12, ITEM_COL[v]); sfx("alba_chime", 100); api.fx("big", `${ITEMS[v]}! +30`); }
  else if (type === 5) { burst(x, y, ["#ff6a5a", "#fff"], 12, 1.2); shake = api.now(); flash = { at: shake, col: "#ff4a3a" }; sfx("alba_buzz", 200); api.fx("bad", "공을 놓쳤다! -50"); }
  else if (type === 6) { pop(`현장 완파! +${v}`, W / 2, 130, "#b8f070"); burst(W / 2, 100, ["#ffd84a", "#fff", "#9ae06a"], 24, 2); sfx("alba_ding", 300); api.fx("big", `현장 완파! +${v}`); }
  else if (type === 7) { padHit = api.now(); burst(x, y, ["#ffffff", "#e8c88a"], 3, 0.6); sfx("alba_snap", 60); }
  else if (type === 8) { burst(x, y, ["#ffd84a", "#fff"], 5, 0.6); sfx("alba_pop", 80); }
}

// ── drawing
const r1 = Math.round;
const P = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(r1(x), r1(y), w, h); };
const dark = (c) => { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return (((n >> 16) * 3 + ((n >> 8) & 255) * 6 + (n & 255)) / 10) < 130; };   // dark text sits on a light plate: no outline
function text(s, x, y, col, size = 9, align = "left", ol = OL) {
  g.font = `${size >= 11 ? "bold " : ""}${size}px ${size >= 11 ? FONT11 : FONT9}`; g.textAlign = "left"; g.textBaseline = "top";
  { const w = g.measureText(s).width; x = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y); }   // whole-pixel origin: a pixel font stays crisp
  x = r1(x); y = r1(y);
  if (ol && !dark(col)) { g.fillStyle = ol; g.fillText(s, x + 1, y); g.fillText(s, x - 1, y); g.fillText(s, x, y + 1); g.fillText(s, x, y - 1); g.fillText(s, x + 1, y + 1); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function plate(x, y, w, h) {
  P(OL, x, y + 1, w, h - 2); P(OL, x + 1, y, w - 2, h);
  P("#d9a43a", x + 1, y + 1, w - 2, h - 2); P("#fff4d4", x + 2, y + 2, w - 4, h - 4); P("#ffe8b0", x + 2, y + h - 5, w - 4, 3);
}
function glyph(k, x, y, col) {
  g.fillStyle = col;
  GLYPH[k].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "X") g.fillRect(x + i, y + j, 1, 1); }));
}
function brick(ch, x, y, t) {
  P(OL, x, y, BW, BH);
  if (ch === "b") {   // a bomb: a round black casing, a red mark, a lit fuse
    P("#4a4a5a", x + 1, y + 1, BW - 2, BH - 2); P("#6a6a7c", x + 1, y + 1, BW - 2, 1);
    P("#22222c", x + 5, y + 2, 10, 5); P("#22222c", x + 6, y + 1, 8, 1); P("#6a6a7c", x + 6, y + 2, 2, 1);
    P("#ff4a3a", x + 9, y + 3, 2, 2);
    P(Math.floor(t / 90) % 2 ? "#ffe27a" : "#ff9a3a", x + 13, y - 1, 3, 3); P("#fff", x + 14, y, 1, 1);
    return;
  }
  const letter = ITEM_LETTER[ch];
  if (letter !== undefined) {   // a bonus box: gold crate with the item's sign
    P("#f0b830", x + 1, y + 1, BW - 2, BH - 2); P("#ffe27a", x + 1, y + 1, BW - 2, 1);
    P("#b8801a", x + 1, y + BH - 2, BW - 2, 1); P("#b8801a", x + 3, y + 1, 1, BH - 2); P("#b8801a", x + BW - 4, y + 1, 1, BH - 2);
    P(ITEM_COL[letter], x + 7, y + 1, 6, BH - 2);
    glyph(letter, x + 7, y + 1, "#2a2030");
    return;
  }
  const hp = +ch, c = PLAIN[hp];
  P(c[0], x + 1, y + 1, BW - 2, BH - 2); P(c[1], x + 1, y + 1, BW - 2, 1); P(c[1], x + 1, y + 2, 1, BH - 4);
  P(c[2], x + 1, y + BH - 2, BW - 2, 1);
  if (hp === 1) { P(c[2], x + 9, y + 2, 1, 3); P(c[1], x + 14, y + 2, 2, 1); }   // a mortar line
  else if (hp === 2) { P(c[2], x + 4, y + 2, 5, 1); P(c[2], x + 9, y + 3, 3, 1); P(c[2], x + 12, y + 4, 4, 1); }   // a crack
  else { P(c[1], x + 3, y + 3, 2, 2); P(c[1], x + BW - 5, y + 3, 2, 2); P(c[2], x + 8, y + 2, 4, 1); P(c[2], x + 3, y + 5, 2, 1); P(c[2], x + BW - 5, y + 5, 2, 1); }   // rivets
}
function disc(x, y, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(r * r + 0.5 - dy * dy)); g.fillRect(x - h, y + dy, 2 * h + 1, 1); }
}
function ball(x, y, big, t) {
  const r = big ? 5 : 3;
  if (big) disc(x, y, r + 2, "rgba(255,150,40,.4)");
  disc(x, y, r, OL); disc(x, y, r - 1, big ? "#ff9a3a" : "#dfe6f0");
  P(big ? "#ffe8a0" : "#ffffff", x - r + 2, y - r + 2, 2, 2);
  if (!big) P("#8a96ac", x, y + 1, 1, 1);
  if (big && Math.floor(t / 80) % 2) P("#ffd84a", x - 1, y - r - 2, 2, 2);
}
// ── the building site, drawn once (the clouds drift on top of it each frame)
function makeBack() {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const q = c.getContext("2d"), r = (col, x, y, w, h) => { q.fillStyle = col; q.fillRect(x, y, w, h); };
  [["#74c4ee", 0], ["#88cef2", 40], ["#9cd8f4", 80], ["#b4e2f6", 120], ["#cdecf8", 160]].forEach(([col, y]) => r(col, 0, y, W, 40 + (y === 160 ? 80 : 0)));   // sky bands
  const bld = (x, w, h, col, win) => {   // a far building with window dots
    r(col, x, PY - h, w, h + 9); r(win, x, PY - h, w, 2);
    for (let wy = PY - h + 6; wy < PY - 2; wy += 8) for (let wx = x + 3; wx < x + w - 3; wx += 7) r(win, wx, wy, 3, 3);
  };
  bld(2, 30, 56, "#9cc4e0", "#c4e0f2"); bld(36, 22, 38, "#a8cce6", "#cce4f4"); bld(62, 34, 70, "#94bcdc", "#bcdaf0"); bld(104, 26, 44, "#a8cce6", "#cce4f4");
  bld(134, 36, 60, "#9cc4e0", "#c4e0f2"); bld(174, 24, 36, "#a8cce6", "#cce4f4"); bld(202, 36, 66, "#94bcdc", "#bcdaf0");
  r("#e8603a", 118, PY - 90, 3, 90); r("#e8603a", 118, PY - 92, 44, 3); r("#ffd84a", 150, PY - 89, 2, 14); r("#c8482a", 117, PY - 94, 5, 3);   // a crane
  r("#d4a870", 0, PY + 9, W, H - PY - 9); r("#e8c288", 0, PY + 9, W, 2); r("#b88a54", 0, PY + 9 + 2, W, 1);   // the dirt yard
  for (let i = 0; i < 26; i++) r(i % 3 ? "#c29660" : "#e8c288", (i * 41 + 7) % W, PY + 14 + ((i * 17) % 4) * 4, 3, 1);
  for (let x = 6; x < W; x += 30) { r("#4aa04a", x, PY + 7, 2, 3); r("#6ac860", x + 1, PY + 6, 2, 3); r("#4aa04a", x + 3, PY + 8, 2, 2); }   // grass tufts
  return c;
}
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  if (!bgc) bgc = makeBack();
  phase = info.phase;
  g.setTransform(kk, 0, 0, kk, 0, 0); g.imageSmoothingEnabled = false;
  if (t - shake < 240) g.translate(Math.round(Math.sin(t / 22) * 2), 0);
  g.drawImage(bgc, 0, 0);
  for (const [cx0, cy, sp] of [[20, 120, 0.008], [150, 150, 0.005], [90, 60, 0.011]]) {   // three clouds drifting right
    const x = ((cx0 + t * sp) % (W + 60)) - 40;
    P("#ffffff", x + 4, cy, 24, 6); P("#ffffff", x + 9, cy - 4, 12, 5); P("#ffffff", x + 1, cy + 3, 30, 4); P("#dff2fc", x + 3, cy + 6, 26, 1);
  }
  const dtf = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  if (!st) { text("벽을 찾는 중…", W / 2, H / 2, "#fff4d4", 11, "center"); return; }
  const ds = Math.min(3, (t - st.at) / STEP), blink = Math.floor(t / 250) % 2;
  const [padX, padVx, hw] = st.pad, fx = st.fx.map((m) => Math.max(0, m - (t - st.at)));
  const sx = clamp(padX + padVx * ds, hw, W - hw);
  px += clamp(target - px, -PSPD * dtf * 20, PSPD * dtf * 20); px += (sx - px) * 0.15;
  px = clamp(px, hw, W - hw);
  if (phase === "run") sendNow(t);
  // the wall
  for (let i = 0; i < st.bricks.length; i++) { const ch = st.bricks[i]; if (ch !== ".") brick(ch, (i % COLS) * BW, Y0 + ((i / COLS) | 0) * BH, t); }
  // items falling (a little spin of the sign)
  for (let i = 0; i < st.I.length; i += 3) {
    const x = st.I[i], y = r1(st.I[i + 1] + FALL * ds), k = st.I[i + 2], wob = Math.round(Math.sin(t / 120 + i));
    P(OL, x - 7 + wob, y - 5, 14, 10); P(ITEM_COL[k], x - 6 + wob, y - 4, 12, 8); P("rgba(255,255,255,.5)", x - 6 + wob, y - 4, 12, 1); P("rgba(40,30,56,.3)", x - 6 + wob, y + 3, 12, 1);
    glyph(k, x - 2 + wob, y - 2, "#2a2030");
  }
  // the paddle: a plank with iron caps, pressed down a pixel when the ball bounced on it
  const press = t - padHit < 110 ? 1 : 0, pl = r1(px - hw), pw = hw * 2, py = PY + press;
  P("rgba(110,74,40,.35)", pl + 2, PY + 8, pw - 2, 2);
  P(OL, pl, py, pw, 7);
  P("#e8aa56", pl + 1, py + 1, pw - 2, 5); P("#ffd488", pl + 1, py + 1, pw - 2, 1); P("#b07434", pl + 1, py + 5, pw - 2, 1);
  for (let x = pl + 9; x < pl + pw - 9; x += 8) P("#c88a42", x, py + 2, 4, 1);
  P("#a4aeba", pl + 1, py + 1, 4, 5); P("#dfe6f0", pl + 1, py + 1, 4, 1); P("#a4aeba", pl + pw - 5, py + 1, 4, 5); P("#dfe6f0", pl + pw - 5, py + 1, 4, 1);
  if (press) { P("#ffffff", pl + 1, py + 1, pw - 2, 1); }
  // the balls (a short trail behind each)
  const bs = [];
  for (let i = 0; i < st.B.length; i += 5) {
    const held = st.B[i + 4];
    bs.push(held ? [px, PY - 4, 1] : [clamp(st.B[i] + (st.B[i + 2] / 4) * ds, 3, W - 3), st.B[i + 1] + (st.B[i + 3] / 4) * ds, 0]);
  }
  trail.push(bs.filter((b) => !b[2]).map((b) => [b[0], b[1]]));
  if (trail.length > 4) trail.shift();
  trail.forEach((fr, n) => { g.globalAlpha = 0.14 * (n + 1); for (const [x, y] of fr) disc(r1(x), r1(y), st.big ? 4 : 2, st.big ? "#ff9a3a" : "#ffffff"); });
  g.globalAlpha = 1;
  for (const [x, y] of bs) ball(r1(x), r1(Math.min(y, H + 6)), st.big, t);
  const waiting = st.B.length && st.B[4] && fx[3] <= 0;
  if (phase === "run" && waiting) {
    plate(48, PY - 40, 144, 20);
    text(blink ? "클릭 · 스페이스로 발사!" : "↑ 클릭 · 스페이스로 발사!", W / 2, PY - 35, "#c8462a", 9, "center");
  }
  // sparks and numbers
  parts = parts.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of parts) { p.x += p.vx * dtf * 60; p.y += p.vy * dtf * 60; p.vy += 0.06 * dtf * 60; P(OL, p.x - 1, p.y - 1, p.big ? 4 : 3, p.big ? 4 : 3); P(p.col, p.x, p.y, p.big ? 2 : 1, p.big ? 2 : 1); }
  pops = pops.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of pops) { g.globalAlpha = clamp(p.life / 14, 0, 1); text(p.text, p.x, p.y - (32 - p.life) * 0.5, p.col, 9, "center"); g.globalAlpha = 1; }
  if (flash && t - flash.at < 240) { g.globalAlpha = clamp(0.4 - (t - flash.at) / 600, 0, 0.4); P(flash.col, 0, 0, W, H); g.globalAlpha = 1; }
  // the strip: a yellow site sign with hazard stripes: wall, bricks left; and the power-ups running on the dirt below
  P(OL, 0, 0, W, 17); P("#f2c230", 0, 0, W, 16); P("#ffe27a", 0, 0, W, 1);
  for (let x = 0; x < W; x += 8) { P("#3a2a38", x, 14, 4, 2); }
  text(`현장 ${st.wall}`, 5, 3, "#3a2a38", 9, "left", null);
  text(`벽돌 ${st.left}`, W - 5, 3, "#3a2a38", 9, "right", null);
  if (info.fever > 0) text("대형 철구!", W / 2, 3, Math.floor(t / 100) % 2 ? "#c8301a" : "#3a2a38", 9, "center", null);
  if (info.rush && !rushShown && phase === "run") { rushShown = true; pop("막판 러시! 벽이 내려와요", W / 2, 150, "#ffb04a"); }
  let cx = 4;   // the power-ups running: little bars in the free band between the sign and the wall
  [["넓음", 0], ["관통", 1], ["느림", 2]].forEach(([name, i]) => {
    if (fx[i] <= 0) return;
    P(OL, cx, 18, 42, 10); P("#6a4a5a", cx + 1, 19, 40, 8); P(ITEM_COL[[0, 2, 3][i]], cx + 1, 19, Math.round((40 * Math.min(fx[i], 12000)) / 12000), 8);
    text(name, cx + 5, 19, "#ffffff", 8); cx += 46;
  });
  if (info.phase !== "run") {
    P("rgba(58,42,56,.34)", 0, 17, W, H - 17);
    plate(30, 82, 180, 78);
    if (info.phase === "brief") {
      text(info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!", W / 2, 92, "#c8462a", 22, "center");
      text("마우스·터치로 발판 이동", W / 2, 126, "#6a4424", 9, "center");
      text("클릭 · 스페이스로 공 발사", W / 2, 140, "#8a6a44", 9, "center");
    } else text("수고하셨어요!", W / 2, 110, "#c8462a", 11, "center");
  }
}

// ── mount: the board and its buttons
function mount(h, a) {
  host = h; api = a; st = null; seen = -1; sig = ""; phase = "brief"; parts = []; pops = []; trail = []; target = 120; px = 120; lastX = -1; lastSend = 0; killFx = 0; lastT = 0; rushShown = false; goAt = 0; bombFx = 0; shake = 0; flash = null; padHit = -1e9; sfxAt = {}; bgc = null;
  host.textContent = "";
  boardEl = host.closest(".ap-board");
  if (boardEl) { boardWas = boardEl.style.background; boardEl.style.background = "#7cc0e6"; }   // the frame around the canvas is sky, not night
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas");
  cv.style.cssText = "image-rendering:pixelated;touch-action:none;cursor:crosshair;outline:3px solid #3a2a38;box-shadow:0 3px 0 #2a1e2a;";
  cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) pointer(e); });
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* a plain click still works */ } pointer(e); go(); });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  wrap.append(cv);
  const pad = document.createElement("div");
  pad.style.cssText = "display:flex;gap:6px;width:min(100%,460px);";
  const add = (label, fn, up, flex = 1) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn"; b.textContent = label;
    b.style.cssText = `flex:${flex};min-height:52px;font-size:18px;touch-action:none;user-select:none;`;
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); fn(); });
    if (up) for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, up);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    pad.append(b);
  };
  add("◀", () => { target = 0; }, () => { target = Math.round(px); });
  add("발사 ⤒", go, null, 2);
  add("▶", () => { target = W; }, () => { target = Math.round(px); });
  wrap.append(pad);
  host.append(wrap);
  layout();
}
function unmount() {
  if (boardEl) boardEl.style.background = boardWas;
  if (host) host.textContent = "";
  host = null; api = null; cv = null; g = null; st = null; wrap = null; bgc = null; boardEl = null;
}

export default { mount, setState, frame, key, unmount };
