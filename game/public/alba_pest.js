/**
 * 일일 아르바이트 · 해충 방제 board (logic 67-alba-pest.js, contract in alba.js): a Galaga-style shooter in a 240 × 300 field, drawn at whole-pixel
 * coordinates and scaled up without smoothing. The server owns everything; this draws the last state it sent, moved on with the velocities it sent
 * (bugs, sprays, webs) and sends intents: the ship's target x (mouse, finger drag, ← → / A D) and whether to spray (auto, or while Space / a button is held).
 * view = [wave, ms to the next wave, [ship x, vx per step, stun ms, web ms, invulnerable ms, firing], formation | 0 = [ox, oy, vx, vy, cols, "row kinds", [row masks]],
 *         dives [kind, x, y, vx, vy, flags 1 spins a web · 2 flying back …], sprays [x, y, dx …], webs [x, y …], rescue [x, y, vx] | 0, queen [x, y, hp, max] | 0,
 *         events [[seq, type, x, y, points]…], bugs left]
 * Geometry mirrored from the rules for DRAWING only (slot spacing, spray and web speed per 50 ms step); no rule is decided here.
 */
const W = 240, H = 300, SY = 282, STEP = 50, FX = 120, FY = 54, SX = 13, SPY = 20, SPD = 4, BSP = 8, WSP = 4;
const FONT = "Galmuri11, Galmuri9, sans-serif";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ── sprites: the left half of each row is drawn, the right half is its mirror ('.' is clear)
const PAL = {
  o: "#1c120c", b: "#8a5628", l: "#b8803e", h: "#e0a868",   // cockroach
  g: "#7f9a78", G: "#b4d0a8", w: "#d4ecff", k: "#34343c", e: "#ff5a4a",   // mosquito
  m: "#7a5a9a", M: "#b090d0", p: "#ecdcf8", f: "#4a3458", v: "#2c2038",   // moth
  y: "#e8b838", Y: "#fbe27a", r: "#c83a3a", n: "#3a3e46", s: "#d6dce2", S: "#8e96a0", a: "#6ab04a", A: "#9ae06a", t: "#ffffff", d: "#1a1a22",
};
const HALF = {
  roach: [["..o...", "...o..", "....oo", "...obb", "..obll", "..obhl", "..obll", "..obbb", ".o.obb", "o...o."], ["..o...", "...o..", "....oo", "...obb", "..obll", "..obhl", "..obll", "..obbb", "o..obb", ".o.o.."]],
  mosq: [["ww....", ".www..", "..wwo.", "...wog", "....oe", ".o..oG", "..o.og", "...oog", ".....g", ".....k", ".....k", ".....k"], ["w.....", "ww....", ".wwwo.", "..wwoe", "....og", "..o.oG", ".o..og", "...oog", ".....g", ".....k", ".....k", ".....k"]],
  moth: [["..o....", "...o...", "....oof", "ooolllf", "obllplf", "obllllf", ".oblmmf", "..obmmf", "...oooo"], ["..o....", "...o...", "....oof", "..ommlf", ".obllpf", ".oblllf", ".obmmlf", "..obmmf", "...oooo"]],
  queen: [["..........YY", "......o..oYY", ".....oYooYYy", ".....oYYYyyy", "....ooyyyyyy", ".ooooyyyyvvv", "owwwoyoeoyyy", "owwwwoyyyyyy", ".owwwoyvyvyv", "..ooooyyyyyy", ".....ovyvyvy", ".....oyyyyyy", "......oyvyvy", ".......ooooo"], ["..........YY", "......o..oYY", ".....oYooYYy", ".....oYYYyyy", "....ooyyyyyy", ".owwoyyyyvvv", "owwwwoyoeoyy", ".owwwoyyyyyy", "..ooooyvyvyv", ".....oyyyyyy", ".....ovyvyvy", ".....oyyyyyy", "......oyvyvy", ".......ooooo"]],
  ship: [["......n", "......n", ".....on", ".....on", "...ooss", "..osSSS", "..osAAA", "..osagt", "..osaaa", "..osSSS", "..osSSS", "...ooss", "....ooo"]],
  rescue: [["..ww.y", ".wwwyy", ".wwyyy", "..yyYt", "..yyyy", "...yyy", "..o.o."], ["...w.y", ".wwwyy", "wwwyyy", "..yyYt", "..yyyy", "...yyy", ".o...o"]],
  puff: [[".t.", "tAt", "AAA", ".A.", ".a.", ".a."]],
};
const MIR = { puff: 0 };   // sprites that stay one column wide
const SPR_MAPS = Object.fromEntries(Object.entries(HALF).map(([k, frames]) => [k, frames.map((rows) => rows.map((r) => (k in MIR ? r : r + [...r].reverse().join(""))))]));
const WEB = ["....w.w.w....", "..w..w.w..w..", ".w.w.wwwww.w.", "w..w.w.w.w..w", "wwwwwwwwwwwww", "w..w.w.w.w..w", ".w.w.wwwww.w.", "..w..w.w..w..", "....w.w.w...."];

let host = null, api = null, cv = null, g = null, fit = 2, kk = 1, sig = "", st = null, seen = -1, phase = "brief", spr = null, wrap = null, btnAuto = null;
let target = FX, px = FX, lastX = -1, lastFire = -1, lastSend = 0, auto = true, ptrDown = false, kl = 0, kr = 0, fireUntil = 0, parts = [], pops = [], lastT = 0, killFx = 0;

function layout() {
  const hw = Math.max(240, host.clientWidth - 4), ah = Math.max(280, innerHeight * 0.96 - 330) - 50;
  const f = clamp(Math.min(hw / W, ah / H), 0.7, 3.2), k = Math.max(1, Math.floor(f));
  if (g && f === fit && k === kk) return;
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
  const wx = wc.getContext("2d"); WEB.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== ".") { wx.fillStyle = (i + y) % 3 ? "#e8ecf0" : "#aab4c0"; wx.fillRect(i, y, 1, 1); } }));
  spr.web = [wc];
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
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: ((i * 37) % 11 - 5) * 0.18 * sp, vy: ((i * 53) % 9 - 6) * 0.2 * sp, life: 14 + (i % 5), col: cols[i % cols.length] });
}
function pop(text, x, y, col) { pops.push({ text, x, y, life: 28, col }); }
function hit(type, x, y, pts) {
  if (type === 1 || type === 2) {
    burst(x, y, type === 2 ? ["#ffd84a", "#fff", "#ff9a3a"] : ["#b4f04a", "#fff", "#7a4a22"], type === 2 ? 10 : 6);
    pop(`+${pts}`, x, y - 6, type === 2 ? "#ffd84a" : "#fff");
    if (type === 2) api.fx("big", `급강하 격추! +${pts}`); else if (++killFx % 4 === 0) api.fx("good");
  } else if (type === 3) { burst(x, y, ["#ff6a5a", "#fff", "#ffd84a"], 14, 1.4); api.fx("bad", "기절! 2초"); }
  else if (type === 4) { burst(x, y, ["#e8ecf0", "#aab4c0"], 10); api.fx("bad", "거미줄! 구출 파리를 쏘세요"); }
  else if (type === 5) { burst(x, y, ["#ffd84a", "#fff"], 14); pop(`구출 +${pts}`, x, y - 8, "#ffd84a"); api.fx("big", `구출! +${pts}`); }
  else if (type === 6) { pop(`웨이브 완파 +${pts}`, W / 2, 140, "#9ae06a"); api.fx("big", `웨이브 완파! +${pts}`); }
  else if (type === 7) burst(x, y, ["#ffd84a", "#fff"], 3, 0.7);
  else if (type === 8) { burst(x, y, ["#ffd84a", "#fff", "#c83a3a"], 24, 1.6); pop(`여왕 격파 +${pts}`, x, y - 10, "#ffd84a"); api.fx("big", `여왕 격파! +${pts}`); }
}

// ── drawing
const px1 = (v) => Math.round(v);
function sprite(name, f, x, y) {
  const c = spr[name][f % spr[name].length];
  g.drawImage(c, px1(x - c.width / 2), px1(y - c.height / 2));
}
function text(s, x, y, size, col, align = "left") {
  g.font = `bold ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = "top";
  g.fillStyle = "#000"; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}
function back(t) {
  g.fillStyle = "#1c322a"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#254238";
  for (let i = 0; i < 6; i++) g.fillRect(i * 44 - 6, 0, 3, SY - 8);   // shelf posts
  g.fillStyle = "#2e5144";
  for (let y = 40; y < SY - 20; y += 60) g.fillRect(0, y, W, 3);
  g.fillStyle = "#3a5d4e";
  for (let i = 0; i < 9; i++) { const x = (i * 29 + 7) % (W - 18), y = 40 + ((i * 47) % 4) * 60 - 14; g.fillRect(x, y, 14, 14); g.fillStyle = "#4c7362"; g.fillRect(x, y, 14, 2); g.fillStyle = "#3a5d4e"; }   // crates on the shelves
  g.fillStyle = "#12251f"; g.fillRect(0, SY + 9, W, H - SY - 9);
  g.fillStyle = "#2c4c40"; g.fillRect(0, SY + 9, W, 2);
  void t;
}
function frame(t, info) {
  const key2 = `${innerWidth}x${innerHeight}x${host.clientWidth}`;
  if (key2 !== sig) { sig = key2; layout(); }
  if (!spr) build();
  phase = info.phase;
  g.setTransform(kk, 0, 0, kk, 0, 0);
  back(t);
  const dtf = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
  if (!st) { text("해충을 찾는 중…", W / 2, H / 2, 11, "#f3ead2", "center"); return; }
  const ds = Math.min(3, (t - st.at) / STEP), blink = Math.floor(t / 120) % 2, fl = Math.floor(t / 160) % 2;
  const sh = st.sh, stunMs = Math.max(0, sh[2] - (t - st.at)), webMs = Math.max(0, sh[3] - (t - st.at)), invMs = Math.max(0, sh[4] - (t - st.at));
  // the ship: walks towards its target by itself at the server's speed, and is pulled to where the server has it
  const sx = clamp(sh[0] + sh[1] * ds, 8, W - 8);
  if (stunMs > 0 || webMs > 0) px = sx;
  else { px += clamp(target - px, -SPD * dtf * 20, SPD * dtf * 20); px += (sx - px) * 0.12; }
  if (phase === "run") sendNow(t);
  // the formation
  if (st.fm) {
    const [ox, oy, fvx, fvy, cols, kinds, masks] = st.fm;
    const cx = clamp(ox + fvx * ds, -20, 20), cy = oy < 0 ? Math.min(0, oy + fvy * ds) : oy;
    masks.forEach((m, r) => { for (let c = 0; c < cols; c++) if ((m >> c) & 1) sprite(["roach", "mosq", "moth"][+kinds[r]], fl + c, FX + (2 * c - cols + 1) * SX + cx, FY + r * SPY + cy); });
    if (st.q) {
      const q = st.q, qx = FX + cx, qy = FY - 26 + cy;
      sprite("queen", fl, qx, qy);
      g.fillStyle = "#000"; g.fillRect(px1(qx) - 13, px1(qy) - 14, 26, 4); g.fillStyle = "#c83a3a"; g.fillRect(px1(qx) - 12, px1(qy) - 13, Math.round((24 * q[2]) / q[3]), 2);
    }
  }
  for (let i = 0; i < st.D.length; i += 6) {
    const k = st.D[i], x = clamp(st.D[i + 1] + st.D[i + 3] * ds, 6, W - 6), y = st.D[i + 2] + st.D[i + 4] * ds, f = st.D[i + 5];
    if (f === 1 && blink) { g.fillStyle = "#e8ecf0"; g.fillRect(px1(x) - 1, px1(y) + 7, 2, 4); }   // a mosquito about to spin a web
    if (f === 2) g.globalAlpha = 0.6;
    sprite(["roach", "mosq", "moth"][k], fl + i, x, y);
    g.globalAlpha = 1;
  }
  for (let i = 0; i < st.Wb.length; i += 2) sprite("web", 0, st.Wb[i], st.Wb[i + 1] + WSP * ds);
  if (st.rs) { const r = st.rs; g.globalAlpha = blink ? 1 : 0.55; sprite("rescue", fl, clamp(r[0] + r[2] * ds, 8, W - 8), r[1]); g.globalAlpha = 1; if (blink) text("!", clamp(r[0] + r[2] * ds, 8, W - 8) - 2, r[1] - 18, 11, "#ffd84a"); }
  for (let i = 0; i < st.B.length; i += 3) sprite("puff", 0, st.B[i] + st.B[i + 2] * ds, st.B[i + 1] - BSP * ds);
  // the ship, with its states
  {
    const bob = stunMs > 0 ? Math.round(Math.sin(t / 60) * 2) : 0;
    if (info.fever > 0) { g.fillStyle = "rgba(255,170,60,.35)"; g.fillRect(px1(px) - 9, SY - 12, 18, 22); }
    g.globalAlpha = invMs > 0 && stunMs <= 0 && blink ? 0.45 : 1;
    sprite("ship", 0, px + bob, SY);
    g.globalAlpha = 1;
    if (webMs > 0) { sprite("web", 0, px, SY - 2); text("거미줄!", px, SY - 34, 10, blink ? "#fff" : "#ffd84a", "center"); }
    if (stunMs > 0) { for (let i = 0; i < 3; i++) { const a = t / 150 + i * 2.1; g.fillStyle = "#ffd84a"; g.fillRect(px1(px + Math.cos(a) * 9), px1(SY - 14 + Math.sin(a) * 3), 2, 2); } text("기절!", px, SY - 30, 10, "#ff8a7a", "center"); }
  }
  // sparks and numbers
  parts = parts.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of parts) { p.x += p.vx * dtf * 60; p.y += p.vy * dtf * 60; p.vy += 0.05 * dtf * 60; g.fillStyle = p.col; g.fillRect(px1(p.x), px1(p.y), 2, 2); }
  pops = pops.filter((p) => (p.life -= dtf * 60) > 0);
  for (const p of pops) { g.globalAlpha = clamp(p.life / 14, 0, 1); text(p.text, p.x, p.y - (28 - p.life) * 0.5, 9, p.col, "center"); g.globalAlpha = 1; }
  // the strip: wave, bugs left, the fever
  g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, 0, W, 14);
  text(`웨이브 ${st.wave}`, 4, 2, 9, "#e2c486");
  text(`남은 해충 ${st.left}`, W - 4, 2, 9, "#f3ead2", "right");
  if (info.fever > 0) text("3연발 분사!", W / 2, 2, 9, "#ff9a3a", "center");
  if (st.rest > 0) { const s = Math.ceil(Math.max(0, st.rest - (t - st.at)) / 1000); text(`웨이브 ${st.wave} 완파!`, W / 2, 110, 14, "#9ae06a", "center"); text(`다음 웨이브까지 ${s}`, W / 2, 132, 10, "#f3ead2", "center"); }
  if (info.phase !== "run") {
    g.fillStyle = "rgba(10,8,16,.6)"; g.fillRect(0, 0, W, H);
    text(info.phase === "brief" ? (info.toStart > 0 ? `준비! ${Math.ceil(info.toStart / 1000)}` : "시작!") : "수고하셨어요!", W / 2, H / 2 - 10, 16, "#fff", "center");
    if (info.phase === "brief") text("마우스·터치로 이동, 분사는 자동!", W / 2, H / 2 + 14, 9, "#e2c486", "center");
  }
}

// ── mount: the board and its buttons
function mount(h, a) {
  host = h; api = a; st = null; seen = -1; sig = ""; phase = "brief"; parts = []; pops = []; target = FX; px = FX; lastX = -1; lastFire = -1; lastSend = 0; auto = true; ptrDown = false; kl = kr = 0; fireUntil = 0; killFx = 0; lastT = 0;
  host.textContent = "";
  wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:4px 0;";
  cv = document.createElement("canvas");
  cv.style.cssText = "image-rendering:pixelated;touch-action:none;cursor:crosshair;border:2px solid #000;";
  cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || ptrDown) pointer(e); });
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); ptrDown = true; try { cv.setPointerCapture(e.pointerId); } catch { /* a plain click still works */ } pointer(e); });
  for (const ev of ["pointerup", "pointercancel"]) cv.addEventListener(ev, () => { ptrDown = false; });
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
    return b;
  };
  add("◀", () => { kl = 1; target = 8; }, () => { kl = 0; target = kr ? W - 8 : Math.round(px); });
  btnAuto = add("자동 사격: 켜짐", () => { auto = !auto; btnAuto.textContent = `자동 사격: ${auto ? "켜짐" : "꺼짐 (스페이스·누르는 동안)"}`; });
  add("▶", () => { kr = 1; target = W - 8; }, () => { kr = 0; target = kl ? 8 : Math.round(px); });
  wrap.append(pad);
  host.append(wrap);
  layout();
}
function unmount() {
  if (host) host.textContent = "";
  host = null; api = null; cv = null; g = null; st = null; wrap = null; btnAuto = null;
}

export { SPR_MAPS };
export default { mount, setState, frame, key, unmount };
