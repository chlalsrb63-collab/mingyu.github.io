/**
 * 일일 아르바이트 · 해충 방제 board (logic 67-alba-pest.js, contract in alba.js): a Galaga-style shooter in a 240 × 300 field, drawn at whole-pixel
 * coordinates and scaled up without smoothing. The server owns everything; this draws the last state it sent, moved on with the velocities it sent
 * (bugs, sprays, webs) and sends intents: the ship's target x (mouse, finger drag, ← → / A D) and whether to spray (auto, or while Space / a button is held).
 * view = [wave, ms to the next wave, [ship x, vx per step, stun ms, web ms, invulnerable ms, firing], formation | 0 = [ox, oy, vx, vy, cols, "row kinds", [row masks]],
 *         dives [kind, x, y, vx, vy, flags 1 spins a web · 2 flying back …], sprays [x, y, dx …], webs [x, y …], rescue [x, y, vx] | 0, queen [x, y, hp, max] | 0,
 *         events [[seq, type, x, y, points]…], bugs left]
 * Geometry mirrored from the rules for DRAWING only (slot spacing, spray and web speed per 50 ms step); no rule is decided here.
 * Look: a sunny mint pantry (wall paper, wooden shelves with jars and boxes, a tiled floor); actors carry the dark outline, props stay soft so the bugs read first.
 */
const W = 240, H = 300, SY = 282, STEP = 50, FX = 120, FY = 54, SX = 13, SPY = 20, SPD = 4, BSP = 8, WSP = 4;
const OL = "#3a2418", FONT9 = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif", FONT11 = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ── sprites: the left half of each row is drawn, the right half is its mirror ('.' is clear)
const PAL = {
  o: "#2a1810", b: "#9a5c2a", l: "#c88844", h: "#f0b878",   // cockroach
  g: "#6a9a7a", G: "#b4dcc0", w: "#f4faff", k: "#3c3c48", e: "#ff5a4a",   // mosquito
  m: "#8a5cb0", M: "#b090d0", p: "#f8e8ff", f: "#5a3c70", v: "#3a2850",   // moth
  y: "#f0b830", Y: "#fff08a", r: "#d83a3a", n: "#3a3e4c", s: "#e4ecf2", S: "#98a4b4", a: "#58b43a", A: "#a8ee62", t: "#ffffff", d: "#1a1a22",
};
const HALF = {
  roach: [["..o...", "...o..", "....oo", "...obb", "..obll", "..obhl", "..obll", "..obbb", ".o.obb", "o...o."], ["..o...", "...o..", "....oo", "...obb", "..obll", "..obhl", "..obll", "..obbb", "o..obb", ".o.o.."]],
  mosq: [["ww....", ".www..", "..wwo.", "...wog", "....oe", ".o..oG", "..o.og", "...oog", ".....g", ".....k", ".....k", ".....k"], ["w.....", "ww....", ".wwwo.", "..wwoe", "....og", "..o.oG", ".o..og", "...oog", ".....g", ".....k", ".....k", ".....k"]],
  moth: [["..o....", "...o...", "....oof", "ooolllf", "obllplf", "obllllf", ".oblmmf", "..obmmf", "...oooo"], ["..o....", "...o...", "....oof", "..ommlf", ".obllpf", ".oblllf", ".obmmlf", "..obmmf", "...oooo"]],
  queen: [["..........YY", "......o..oYY", ".....oYooYYy", ".....oYYYyyy", "....ooyyyyyy", ".ooooyyyyvvv", "owwwoyoeoyyy", "owwwwoyyyyyy", ".owwwoyvyvyv", "..ooooyyyyyy", ".....ovyvyvy", ".....oyyyyyy", "......oyvyvy", ".......ooooo"], ["..........YY", "......o..oYY", ".....oYooYYy", ".....oYYYyyy", "....ooyyyyyy", ".owwoyyyyvvv", "owwwwoyoeoyy", ".owwwoyyyyyy", "..ooooyvyvyv", ".....oyyyyyy", ".....ovyvyvy", ".....oyyyyyy", "......oyvyvy", ".......ooooo"]],
  ship: [["......n", "......n", ".....on", ".....on", "...ooss", "..osSSS", "..osAAA", "..osagt", "..osaaa", "..osSSS", "..osSSS", "...ooss", "....ooo"]],
  rescue: [["..ww.y", ".wwwyy", ".wwyyy", "..yyYt", "..yyyy", "...yyy", "..o.o."], ["...w.y", ".wwwyy", "wwwyyy", "..yyYt", "..yyyy", "...yyy", ".o...o"]],
  puff: [[".ooo.", "oAtAo", "oAAAo", "oaAao", ".oaao", "..oo."]],
};
const MIR = { puff: 0 };   // sprites that stay one column wide
const SPR_MAPS = Object.fromEntries(Object.entries(HALF).map(([k, frames]) => [k, frames.map((rows) => rows.map((r) => (k in MIR ? r : r + [...r].reverse().join(""))))]));
const WEB = ["....w.w.w....", "..w..w.w..w..", ".w.w.wwwww.w.", "w..w.w.w.w..w", "wwwwwwwwwwwww", "w..w.w.w.w..w", ".w.w.wwwww.w.", "..w..w.w..w..", "....w.w.w...."];

let host = null, api = null, cv = null, g = null, fit = 2, kk = 1, sig = "", st = null, seen = -1, phase = "brief", spr = null, wrap = null, btnAuto = null, bgc = null, boardEl = null, boardWas = "";
let target = FX, px = FX, lastX = -1, lastFire = -1, lastSend = 0, auto = true, ptrDown = false, kl = 0, kr = 0, fireUntil = 0, parts = [], pops = [], lastT = 0, killFx = 0, shake = 0, flash = null, sfxAt = {};

/** A sound, but never twice within `gap` ms (a held spray or a swarm of kills must not machine-gun). */
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
function build() {
  const mk = (rows) => {
    const c = document.createElement("canvas"), h = rows.length, w = rows[0].length;
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== ".") { x.fillStyle = PAL[ch] || "#f0f"; x.fillRect(i, y, 1, 1); } }));
    return c;
  };
  spr = Object.fromEntries(Object.entries(SPR_MAPS).map(([k, fr]) => [k, fr.map(mk)]));
  const wc = document.createElement("canvas"); wc.width = 13; wc.height = 9;
  const wx = wc.getContext("2d"); WEB.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== ".") { wx.fillStyle = (i + y) % 3 ? "#ffffff" : "#8a9cb4"; wx.fillRect(i, y, 1, 1); } }));
  spr.web = [wc];
  bgc = makeBack();
}

// ── the pantry, drawn once: wall paper, shelves with jars / boxes / cans, a tiled floor
function makeBack() {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const q = c.getContext("2d"), r = (col, x, y, w, h) => { q.fillStyle = col; q.fillRect(x, y, w, h); };
  r("#8ccab2", 0, 0, W, H);
  for (let x = 0; x < W; x += 20) { r("#80c0a8", x, 0, 10, H); r("#98d4bc", x + 4, 0, 2, H); }   // wall paper stripes
  for (let y = 16; y < H; y += 8) for (let x = (y / 8) % 2 ? 4 : 14; x < W; x += 20) r("#a4dcc6", x, y, 2, 2);   // little dots
  const shelf = (y) => {
    for (let x = 0; x < W; x += 1) if ((x + y) % 13 === 0) r("#a07040", x, y + 2, 1, 1);
    r("#6aa690", 0, y + 5, W, 3);   // the one shadow tone under the plank
    r("#dca46a", 0, y, W, 5); r("#f0c488", 0, y, W, 1); r("#b4804a", 0, y + 4, W, 1);
  };
  const jar = (x, y, col) => { r("#4a8a76", x, y - 12, 12, 12); r("#e8f8f2", x + 1, y - 11, 10, 10); r(col, x + 2, y - 8, 8, 7); r("#b8863c", x + 1, y - 13, 10, 3); r("#fff", x + 3, y - 10, 1, 4); };
  const box = (x, y, col, hi) => { r("#4a8a76", x, y - 14, 18, 14); r(col, x + 1, y - 13, 16, 12); r(hi, x + 1, y - 13, 16, 2); r("#fff4d0", x + 6, y - 13, 6, 12); r(col, x + 7, y - 7, 4, 3); };
  const can = (x, y, col) => { r("#4a8a76", x, y - 11, 10, 11); r(col, x + 1, y - 10, 8, 9); r("#fff", x + 1, y - 7, 8, 3); r("#4a8a76", x + 4, y - 6, 2, 1); r("#fff", x + 2, y - 10, 1, 8); };
  [64, 124, 184, 244].forEach((y, i) => {
    shelf(y);
    for (let j = 0; j < 4; j++) {   // the upper shelves cross the formation: props only at the far edges there, muted so the bugs read first
      const x = 10 + j * 58 + ((i * 17 + j * 11) % 20), v = (i + j) % 3;
      if (i < 2 && j % 3 !== 0) continue;
      const px0 = i < 2 ? (j === 0 ? 6 : W - 26) : x;
      if (v === 0) jar(px0, y, ["#ecc88c", "#e8a8a0", "#a8d090", "#b8a8e0"][(i + j) % 4]);
      else if (v === 1) box(px0, y, ["#dcc496", "#cdb488", "#e2cfa0"][(i + j) % 3], "#eee0bc");
      else { can(px0, y, ["#e8a098", "#98b8e8", "#e8d888"][(i + j) % 3]); can(px0 + 12, y, ["#a0c890", "#e8b090"][j % 2]); }
    }
  });
  for (let y = SY + 9; y < H; y += 5) for (let x = (y / 5) % 2 ? 0 : 10; x < W; x += 20) { r("#f4e8c4", x, y, 10, 5); r("#e4d4a8", x + 10, y, 10, 5); }   // tiled floor
  r("#c8b488", 0, SY + 9, W, 1); r("#8a6a44", 0, SY + 8, W, 1); r("#6aa690", 0, SY + 5, W, 3);   // skirting and its shadow
  return c;
}

// ── inputs: where the ship should stand, and whether it sprays
function pointer(e) {
  const r = cv.getBoundingClientRect();
  target = clamp(Math.round(((e.clientX - r.left) / r.width) * W), 0, W);
}
const want = (t) => (auto || ptrDown || t < fireUntil ? 1 : 0);
function sendNow(t) {
  if (!api || phase !== "run") return;
  const x = Math.round(clamp(target, 0, W)), f = want(t);
  if ((x !== lastX || f !== lastFire) ? t - lastSend < 55 : t - lastSend < 500) return;   // a change at once (≤ 18/s), a keep-alive twice a second
  lastX = x; lastFire = f; lastSend = t;
  api.act({ x, fire: f });
}
// keys: the shift window hands this board key-downs only, so a held key steps the target (never more than 24 ahead of the ship) and Space sprays for a moment
function key(e) {
  const n = e.key.length > 1 || e.key === " " ? e.key : /^Key/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
  if (n === "ArrowLeft" || n === "a") target = Math.max(8, px - 24, Math.min(target, px) - 6);
  else if (n === "ArrowRight" || n === "d") target = Math.min(W - 8, px + 24, Math.max(target, px) + 6);
  else if (n === " ") fireUntil = api.now() + 350;
  else return false;
  return true;
}

// ── state from the server
function setState(v, t) {
  const prev = st;
  st = { wave: v[0], rest: v[1], sh: v[2], fm: v[3], D: v[4], B: v[5], Wb: v[6], rs: v[7], q: v[8], ev: v[9], left: v[10], at: t };
  if (!prev) { px = st.sh[0]; target = px; }
  if (prev && prev.sh[2] > 0 && st.sh[2] === 0) lastX = -1;   // the stun is over: say again where to stand
  const first = seen < 0;
  let top = seen;
  for (const e of st.ev) {
    if (e[0] <= seen) continue;
    top = Math.max(top, e[0]);
    if (!first) hit(e[1], e[2], e[3], e[4]);
  }
  seen = top;
}
function burst(x, y, cols, n, sp = 1) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: ((i * 37) % 11 - 5) * 0.2 * sp, vy: ((i * 53) % 9 - 7) * 0.2 * sp, life: 16 + (i % 5), col: cols[i % cols.length], big: i % 3 === 0 });
}
function pop(text, x, y, col) { pops.push({ text, x, y, life: 32, col }); }
function hit(type, x, y, pts) {
  if (type === 1 || type === 2) {
    burst(x, y, type === 2 ? ["#ffd84a", "#fff", "#ff9a3a"] : ["#a8ee62", "#fff", "#c88844"], type === 2 ? 12 : 8);
    pop(`+${pts}`, x, y - 6, type === 2 ? "#ffe27a" : "#fff");
    sfx("alba_crunch", 55);
    if (type === 2) { api.fx("big", `급강하 격추! +${pts}`); } else if (++killFx % 4 === 0) api.fx("good");
  } else if (type === 3) { burst(x, y, ["#ff6a5a", "#fff", "#ffd84a"], 14, 1.4); shake = api.now(); flash = { at: shake, col: "#ff4a3a" }; sfx("alba_buzz", 200); api.fx("bad", "기절! 2초"); }
  else if (type === 4) { burst(x, y, ["#ffffff", "#aab4c0"], 10); shake = api.now(); sfx("alba_swish", 150); api.fx("bad", "거미줄! 구출 파리를 쏘세요"); }
  else if (type === 5) { burst(x, y, ["#ffd84a", "#fff"], 14); pop(`구출 +${pts}`, x, y - 8, "#ffe27a"); sfx("alba_chime", 150); api.fx("big", `구출! +${pts}`); }
  else if (type === 6) { pop(`웨이브 완파 +${pts}`, W / 2, 140, "#b8f070"); sfx("alba_ding", 300); api.fx("big", `웨이브 완파! +${pts}`); }
  else if (type === 7) { burst(x, y, ["#ffd84a", "#fff"], 3, 0.7); sfx("alba_clang", 90); }
  else if (type === 8) { burst(x, y, ["#ffd84a", "#fff", "#c83a3a"], 24, 1.6); pop(`여왕 격파 +${pts}`, x, y - 10, "#ffe27a"); sfx("alba_crunch", 60); api.fx("big", `여왕 격파! +${pts}`); }
  else if (type === 9) sfx("alba_swish", 200);
}

// ── drawing
const px1 = (v) => Math.round(v);
const P = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(px1(x), px1(y), w, h); };
function sprite(name, f, x, y) {
  const c = spr[name][f % spr[name].length];
  g.drawImage(c, px1(x - c.width / 2), px1(y - c.height / 2));
}
const dark = (c) => { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return (((n >> 16) * 3 + ((n >> 8) & 255) * 6 + (n & 255)) / 10) < 130; };   // dark text sits on a light plate: no outline
function text(s, x, y, col, size = 9, align = "left") {
  g.font = `${size >= 11 ? "bold " : ""}${size}px ${size >= 11 ? FONT11 : FONT9}`; g.textAlign = "left"; g.textBaseline = "top";
  { const w = Math.min(g.measureText(s).width, W - 4); x = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y); }   // whole-pixel origin: a pixel font stays crisp
  x = px1(x); y = px1(y);
  if (!dark(col)) { g.fillStyle = OL; g.fillText(s, x + 1, y, W - 4); g.fillText(s, x - 1, y, W - 4); g.fillText(s, x, y + 1, W - 4); g.fillText(s, x, y - 1, W - 4); g.fillText(s, x + 1, y + 1, W - 4); }
  g.fillStyle = col; g.fillText(s, x, y, W - 4);
}
/** A cream plate with a brown rim (the toy-box look of the boards). */
function plate(x, y, w, h) {
  P(OL, x, y + 1, w, h - 2); P(OL, x + 1, y, w - 2, h);
  P("#c8924e", x + 1, y + 1, w - 2, h - 2); P("#fff4d4", x + 2, y + 2, w - 4, h - 4); P("#ffe8b0", x + 2, y + h - 5, w - 4, 3);
}
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  if (!spr) build();
  phase = info.phase;
  g.setTransform(kk, 0, 0, kk, 0, 0); g.imageSmoothingEnabled = false;
  if (t - shake < 260) g.translate(Math.round(Math.sin(t / 22) * 2), 0);
  g.drawImage(bgc, 0, 0);
  const dtf = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  if (!st) { text("해충을 찾는 중…", W / 2, H / 2, "#fff4d4", 11, "center"); return; }
  const ds = Math.min(3, (t - st.at) / STEP), blink = Math.floor(t / 120) % 2, fl = Math.floor(t / 160) % 2;
  const sh = st.sh, stunMs = Math.max(0, sh[2] - (t - st.at)), webMs = Math.max(0, sh[3] - (t - st.at)), invMs = Math.max(0, sh[4] - (t - st.at));
  // the ship: walks towards its target by itself at the server's speed, and is pulled to where the server has it
  const sx = clamp(sh[0] + sh[1] * ds, 8, W - 8);
  if (stunMs > 0 || webMs > 0) px = sx;
  else { px += clamp(target - px, -SPD * dtf * 20, SPD * dtf * 20); px += (sx - px) * 0.12; }
  if (phase === "run") sendNow(t);
  const firing = phase === "run" && sh[5] && stunMs <= 0;
  if (firing) sfx("alba_zap", 480);
  // the formation: every bug bobs on its own beat
  const bob = (i) => Math.round(Math.sin(t / 240 + i * 0.9));
  if (st.fm) {
    const [ox, oy, fvx, fvy, cols, kinds, masks] = st.fm;
    const cx = clamp(ox + fvx * ds, -20, 20), cy = oy < 0 ? Math.min(0, oy + fvy * ds) : oy;
    masks.forEach((m, r) => { for (let c = 0; c < cols; c++) if ((m >> c) & 1) sprite(["roach", "mosq", "moth"][+kinds[r]], fl + c, FX + (2 * c - cols + 1) * SX + cx, FY + r * SPY + cy + bob(c + r)); });
    if (st.q) {
      const q = st.q, qx = FX + cx, qy = FY - 26 + cy + bob(3);
      sprite("queen", fl, qx, qy);
      P(OL, qx - 14, qy + 9, 28, 5); P("#fff4d4", qx - 13, qy + 10, 26, 3); P("#e8483a", qx - 13, qy + 10, Math.round((26 * q[2]) / q[3]), 3); P("#ff9a8a", qx - 13, qy + 10, Math.round((26 * q[2]) / q[3]), 1);
    }
  }
  for (let i = 0; i < st.D.length; i += 6) {
    const k = st.D[i], x = clamp(st.D[i + 1] + st.D[i + 3] * ds, 6, W - 6), y = st.D[i + 2] + st.D[i + 4] * ds, f = st.D[i + 5];
    if (f === 1 && blink) { P("#ffffff", x - 1, y + 7, 2, 4); P(OL, x - 1, y + 11, 2, 1); }   // a mosquito about to spin a web
    if (f === 2) g.globalAlpha = 0.6;
    sprite(["roach", "mosq", "moth"][k], fl + i, x, y);
    g.globalAlpha = 1;
  }
  for (let i = 0; i < st.Wb.length; i += 2) sprite("web", 0, st.Wb[i], st.Wb[i + 1] + WSP * ds);
  if (st.rs) {
    const r = st.rs, rx = clamp(r[0] + r[2] * ds, 8, W - 8);
    g.globalAlpha = blink ? 1 : 0.7; sprite("rescue", fl, rx, r[1] + bob(2)); g.globalAlpha = 1;
    if (blink) text("!", rx - 2, r[1] - 18, "#ffe27a", 11);
  }
  for (let i = 0; i < st.B.length; i += 3) sprite("puff", 0, st.B[i] + st.B[i + 2] * ds, st.B[i + 1] - BSP * ds);
  // the ship, with its states
  {
    const wob = stunMs > 0 ? Math.round(Math.sin(t / 60) * 2) : 0, hov = stunMs > 0 ? 0 : Math.round(Math.sin(t / 260));
    P("rgba(58,36,24,.28)", px - 6, SY + 8, 12, 2);   // the ship's shadow on the tiles
    if (info.fever > 0) { P("rgba(255,214,90,.55)", px - 10, SY - 13, 20, 24); P("rgba(255,244,170,.6)", px - 7, SY - 10, 14, 18); }
    g.globalAlpha = invMs > 0 && stunMs <= 0 && blink ? 0.45 : 1;
    sprite("ship", 0, px + wob, SY + hov);
    g.globalAlpha = 1;
    if (firing && Math.floor(t / 70) % 2) { P("#ffffff", px - 1, SY - 10 + hov, 3, 2); P("#a8ee62", px - 2, SY - 11 + hov, 5, 1); }   // the spray leaving the nozzle
    if (webMs > 0) { sprite("web", 0, px, SY - 2); text("거미줄!", px, SY - 34, blink ? "#ffffff" : "#ffe27a", 9, "center"); }
    if (stunMs > 0) { for (let i = 0; i < 3; i++) { const a = t / 150 + i * 2.1; P("#ffe27a", px + Math.cos(a) * 9, SY - 14 + Math.sin(a) * 3, 3, 3); } text("기절!", px, SY - 30, "#ff9a8a", 9, "center"); }
  }
  // sparks and numbers
  parts = parts.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of parts) { p.x += p.vx * dtf * 60; p.y += p.vy * dtf * 60; p.vy += 0.05 * dtf * 60; P(OL, p.x - 1, p.y - 1, p.big ? 4 : 3, p.big ? 4 : 3); P(p.col, p.x, p.y, p.big ? 2 : 1, p.big ? 2 : 1); }
  pops = pops.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of pops) { g.globalAlpha = clamp(p.life / 14, 0, 1); text(p.text, p.x, p.y - (32 - p.life) * 0.5, p.col, 9, "center"); g.globalAlpha = 1; }
  if (flash && t - flash.at < 240) { g.globalAlpha = clamp(0.4 - (t - flash.at) / 600, 0, 0.4); P(flash.col, 0, 0, W, H); g.globalAlpha = 1; }
  // the strip: wave, bugs left, the fever
  P(OL, 0, 0, W, 17); P("#a8703c", 0, 0, W, 16); P("#d49a58", 0, 0, W, 1); P("#80502a", 0, 15, W, 1);
  text(`웨이브 ${st.wave}`, 5, 3, "#fff0b8");
  text(`남은 해충 ${st.left}`, W - 5, 3, "#ffffff", 9, "right");
  if (info.fever > 0) text("3연발 분사!", W / 2, 3, Math.floor(t / 100) % 2 ? "#ffe27a" : "#ffffff", 9, "center");
  if (st.rest > 0) {
    const s = Math.ceil(Math.max(0, st.rest - (t - st.at)) / 1000);
    plate(50, 100, 140, 44);
    text(`웨이브 ${st.wave} 완파!`, W / 2, 108, "#3e8a24", 11, "center"); text(`다음 웨이브까지 ${s}`, W / 2, 126, "#6a4424", 9, "center");
  }
  if (info.phase !== "run") {
    P("rgba(58,36,24,.38)", 0, 17, W, H - 17);
    plate(30, 104, 180, 78);
    if (info.phase === "brief") {
      text(info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!", W / 2, 114, "#c8462a", 22, "center");
      text("마우스·터치로 이동, 분사는 자동!", W / 2, 148, "#6a4424", 9, "center");
      text("← → / A D  ·  스페이스 = 분사", W / 2, 162, "#8a6a44", 9, "center");
    } else text("수고하셨어요!", W / 2, 132, "#c8462a", 11, "center");
  }
}

// ── mount: the board and its buttons
function mount(h, a) {
  host = h; api = a; st = null; seen = -1; sig = ""; phase = "brief"; parts = []; pops = []; target = FX; px = FX; lastX = -1; lastFire = -1; lastSend = 0; auto = true; ptrDown = false; kl = kr = 0; fireUntil = 0; killFx = 0; lastT = 0; shake = 0; flash = null; sfxAt = {}; bgc = null;
  host.textContent = "";
  boardEl = host.closest(".ap-board");
  if (boardEl) { boardWas = boardEl.style.background; boardEl.style.background = "#5a9c86"; }   // the frame around the canvas is the pantry's colour, not night
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas");
  cv.style.cssText = "image-rendering:pixelated;touch-action:none;cursor:crosshair;outline:3px solid #3a2418;box-shadow:0 3px 0 #2a1810;";
  cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || ptrDown) pointer(e); });
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); ptrDown = true; try { cv.setPointerCapture(e.pointerId); } catch { /* a plain click still works */ } pointer(e); });
  for (const ev of ["pointerup", "pointercancel"]) cv.addEventListener(ev, () => { ptrDown = false; });
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
    return b;
  };
  add("◀", () => { kl = 1; target = 8; }, () => { kl = 0; target = kr ? W - 8 : Math.round(px); });
  btnAuto = add("자동 사격: 켜짐", () => { auto = !auto; btnAuto.textContent = `자동 사격: ${auto ? "켜짐" : "꺼짐 (스페이스·누르는 동안)"}`; }, null, 2);
  btnAuto.style.fontSize = "13px";
  add("▶", () => { kr = 1; target = W - 8; }, () => { kr = 0; target = kl ? 8 : Math.round(px); });
  wrap.append(pad);
  host.append(wrap);
  layout();
}
function unmount() {
  if (boardEl) boardEl.style.background = boardWas;
  if (host) host.textContent = "";
  host = null; api = null; cv = null; g = null; st = null; wrap = null; btnAuto = null; bgc = null; boardEl = null;
}

export { SPR_MAPS };
export default { mount, setState, frame, key, unmount };
