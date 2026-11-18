/**
 * 일일 아르바이트 · 여관 공연 client (rules: src/logic/67-alba-rhythm.js, contract: public/alba.js): four lanes of falling notes on a 176×208 pixel stage (drawn at a
 * whole-number scale, no smoothing). The server rolls the song and judges every press against the note's own time; this scrolls the notes smoothly from the times in
 * the view and sends the presses: D F J K / ← ↓ ↑ → / touching a lane → {m: lane bits} (a chord shares one message), a key coming up → {m, up: 1} (the tail of a hold).
 * view = [[id, lane, ms from receipt (note time), hold ms, held 0|1 …], [seq, lane, kind (0 miss · 1 good · 2 perfect · 3 hold done · 4 hold broken) …], bpm, [perfect, good, miss]]
 * A press hides its nearest note at once (optimistic); the judgement text and the score only ever come from the server.
 * The shell (alba.js) never forwards key-ups to a game, so a hidden read-only input inside the board takes the keyboard focus: its key-downs / key-ups reach this file directly.
 * Look: a warm inn stage: red velvet curtains with a scalloped valance, plum lanes under candy-coloured notes, drum-pad receptors, golden footlights and a plank floor.
 * Sound: every lane hit plays its own note (alba_n0..n3, so the song is the player's), a miss buzzes, a finished hold chimes, every 10th combo rings.
 */
const W = 176, H = 208, LX = 16, LW = 36, LINE = 168, SPEED = 0.085;   // lane area, the hit line, px per ms
const OL = "#2a1630", FONT9 = "9px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif", FONT11 = "bold 11px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const COL = [["#ff6a8a", "#ffc0cf", "#c03a5e"], ["#ffc84a", "#fff0a8", "#c8901a"], ["#6adf8a", "#c0f8d0", "#2a9a4a"], ["#6ab4ff", "#c0e0ff", "#2a70c8"]];
const LABEL = ["D", "F", "J", "K"];
const CODES = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const JUDGE = [["놓쳤어요", "#ff8a7a"], ["좋아요", "#b8f08a"], ["완벽!", "#ffe27a"], ["유지!", "#c0e0ff"], ["끊김", "#ff8a7a"]];

let kk = 1, host = null, api = null, cv = null, g = null, inp = null, bg = null, top = null, scale = 0, fitKey = "", boardEl = null, boardWas = "";
let notes = new Map(), recvAt = 0, bpm = 100, cnt = [0, 0, 0], lastSeq = -1, first = true, lastCombo = 0, sfxAt = {};
let down = [0, 0, 0, 0], lit = [0, 0, 0, 0], parts = [], texts = [], outbox = [], lastSend = -1e9, pend = 0, phase = "brief", feverFx = false;
let touches = new Map(), offs = [];

/** A sound, but never twice within `gap` ms (the lane notes get a short gap per lane, the judgement sounds a longer one). */
function sfx(name, gap = 70) {
  const t = api.now();
  if (t - (sfxAt[name] || -1e9) < gap) return;
  sfxAt[name] = t; api.sfx(name);
}
/** The stage's own reaction (it plays a sound too), kept rare so it never covers the notes. */
function fx(kind, text, gap = 450) {
  const t = api.now();
  if (t - (sfxAt["fx" + kind] || -1e9) < gap) return;
  sfxAt["fx" + kind] = t; api.fx(kind, text);
}

/** Size the canvas to the stage: a whole-number scale when it is 2× or more, else the largest that fits (measured only when the window changes). */
function fit(w) {
  const key = `${w}|${innerHeight}`;
  if (key === fitKey) return;
  fitKey = key;
  const box = host.closest(".ap-box"), fixed = box ? box.offsetHeight - host.parentElement.offsetHeight : 260;
  const sc = Math.min(w / W, (innerHeight * 0.96 - fixed - 12) / H), s2 = sc >= 2 ? Math.floor(sc) : Math.max(0.5, sc);
  scale = s2; cv.style.width = `${Math.round(W * s2)}px`; cv.style.height = `${Math.round(H * s2)}px`;
  const k = Math.max(1, Math.ceil(s2 - 0.001));   // the canvas itself holds `k` pixels per art pixel, so the pixel font is rasterised at 9·k px and stays crisp
  if (k !== kk || cv.width !== W * k) { kk = k; cv.width = W * k; cv.height = H * k; g.imageSmoothingEnabled = false; }
}
const px = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const dark = (c) => { const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16); return (((n >> 16) * 3 + ((n >> 8) & 255) * 6 + (n & 255)) / 10) < 130; };   // dark text sits on a light plate: no outline
function text(s, x, y, col, font = FONT9, align = "center", ol = OL) {
  g.font = font; g.textAlign = "left"; g.textBaseline = "top";
  { const w = g.measureText(s).width; x = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x); y = Math.round(y); }   // whole-pixel origin: a pixel font stays crisp
  if (ol && !dark(col)) { g.fillStyle = ol; g.fillText(s, x + 1, y); g.fillText(s, x - 1, y); g.fillText(s, x, y + 1); g.fillText(s, x, y - 1); g.fillText(s, x + 1, y + 1); }
  g.fillStyle = col; g.fillText(s, x, y);
}
function plate(x, y, w, h) {
  px(OL, x, y + 1, w, h - 2); px(OL, x + 1, y, w - 2, h);
  px("#d9a43a", x + 1, y + 1, w - 2, h - 2); px("#fff4d4", x + 2, y + 2, w - 4, h - 4); px("#ffe8b0", x + 2, y + h - 5, w - 4, 3);
}

// ── the stage, drawn once: curtains, lane beds, the plank floor; and the valance that hangs over the notes' entrance
function makeBg() {
  const b = document.createElement("canvas"); b.width = W; b.height = H;
  const q = b.getContext("2d"), r = (c, x, y, w, h) => { q.fillStyle = c; q.fillRect(x, y, w, h); };
  r("#5a3c78", 0, 0, W, H);
  for (let l = 0; l < 4; l++) {
    r(l % 2 ? "#6a4a8c" : "#74529a", LX + l * LW, 0, LW, LINE + 16);
    q.globalAlpha = 0.12; r(COL[l][0], LX + l * LW, 0, LW, LINE + 16); q.globalAlpha = 1;
    r("#4e3268", LX + l * LW, 0, 1, LINE + 16); r("#8a68b0", LX + l * LW + 1, 0, 1, LINE + 16);
    for (let y = 6; y < LINE; y += 16) r("#80609e", LX + l * LW + 16, y, 4, 1);   // faint lane dashes
  }
  r("#4e3268", LX + 4 * LW, 0, 1, LINE + 16);
  for (const x0 of [0, LX + 4 * LW + 3]) {   // the curtains: velvet folds
    for (let x = 0; x < 13; x++) r(x % 4 < 2 ? "#c8485c" : "#aa3a4e", x0 + x, 0, 1, LINE + 16);
    for (let x = 0; x < 13; x += 4) r("#e66a7c", x0 + x, 0, 1, LINE + 16);
  }
  r("#a8802a", LX - 3, 0, 3, LINE + 16); r("#f4d060", LX - 2, 0, 1, LINE + 16); r("#a8802a", LX + 4 * LW + 1, 0, 3, LINE + 16); r("#f4d060", LX + 4 * LW + 2, 0, 1, LINE + 16);   // gold stage edges
  // the plank floor under the receptors
  const fy = LINE + 16;
  r("#d8a868", 0, fy, W, H - fy);
  for (let y = fy + 1; y < H; y += 6) { r("#e8c088", 0, y, W, 1); r("#b88850", 0, y + 4, W, 1); }
  for (let y = fy, i = 0; y < H; y += 6, i++) for (let x = (i % 2) * 20; x < W; x += 40) r("#b88850", x, y + 1, 1, 5);
  r("#f4d060", 0, fy, W, 1); r("#a8802a", 0, fy + 1, W, 1);
  const t = document.createElement("canvas"); t.width = W; t.height = 18;   // the valance
  const v = t.getContext("2d"), vr = (c, x, y, w, h) => { v.fillStyle = c; v.fillRect(x, y, w, h); };
  vr("#c8485c", 0, 0, W, 8); vr("#e66a7c", 0, 0, W, 1); vr("#f4d060", 0, 7, W, 1);
  for (let x = 0; x < W; x += 16) { vr("#b83a50", x, 8, 16, 2); vr("#aa3a4e", x + 1, 10, 14, 2); vr("#aa3a4e", x + 3, 12, 10, 2); vr("#9a3044", x + 5, 14, 6, 1); vr("#f4d060", x + 7, 15, 2, 3); vr("#ffe88a", x + 7, 15, 1, 1); }
  return [b, t];
}

// ── inputs: the outbox keeps 40 ms between messages (the shell allows one per 35 ms) and merges presses made together
function queue(l, up) {
  outbox.push({ l, up });
  if (!pend) pend = setTimeout(() => { pend = 0; flush(); }, 0);
}
function flush() {
  const t = api.now();
  if (!outbox.length || t - lastSend < 40) return;
  const up = outbox[0].up;
  let m = 0;
  while (outbox.length && outbox[0].up === up) m |= 1 << outbox.shift().l;
  lastSend = t;
  api.act(up ? { m, up: 1 } : { m });
}
function press(l, src) {
  if (down[l] && src in (offs[l] || {})) return;
  (offs[l] = offs[l] || {})[src] = 1;
  if (down[l]++) return;
  lit[l] = api.now();
  if (phase !== "end") sfx("alba_n" + l, 30);   // the lane's own note: the song is yours
  if (phase !== "run") return;
  queue(l, 0);
  const t = api.now();
  let best = null;   // the nearest waiting note of this lane that a press could still hit: hide it at once, the server judges
  for (const n of notes.values()) if (n.l === l && !n.hit && Math.abs(n.at - t) < 150 && (!best || Math.abs(n.at - t) < Math.abs(best.at - t))) best = n;
  if (!best) return;
  if (best.h) best.held = true; else best.hit = t;
  burst(l, 4);
}
function release(l, src) {
  if (!offs[l] || !offs[l][src]) return;
  delete offs[l][src];
  if (--down[l] > 0) return;
  down[l] = 0;
  if (phase === "run") queue(l, 1);
  for (const n of notes.values()) if (n.l === l && n.held) n.held = false;
}
function releaseAll() { for (let l = 0; l < 4; l++) { if (down[l] && phase === "run") queue(l, 1); down[l] = 0; offs[l] = {}; } }
const laneOf = (e) => (e.code in CODES ? CODES[e.code] : -1);
function keyDown(e) { const l = laneOf(e); if (l < 0) return false; e.preventDefault(); if (!e.repeat) press(l, "k" + e.code); return true; }
function keyUp(e) { const l = laneOf(e); if (l < 0) return; e.preventDefault(); release(l, "k" + e.code); }
function pointerLane(e) {
  const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W;
  return Math.max(0, Math.min(3, Math.floor((x - LX) / LW)));
}

// ── state from the server
function setState(v, at) {
  recvAt = at; bpm = v[2]; cnt = v[3];
  const next = new Map(), f = v[0], t = api.now();
  for (let i = 0; i < f.length; i += 5) {
    const id = f[i], old = notes.get(id), n = { id, l: f[i + 1], at: at + f[i + 2], h: f[i + 3], held: !!f[i + 4] || !!(old && old.held && down[f[i + 1]]), hit: old && t - old.hit < 350 ? old.hit : 0 };
    next.set(id, n);
  }
  notes = next;
  const ev = v[1];
  for (let i = 0; i < ev.length; i += 3) {
    const seq = ev[i];
    if (seq <= lastSeq) continue;
    lastSeq = seq;
    if (first) continue;
    judged(ev[i + 1], ev[i + 2], t);
  }
  first = false;
}
function judged(l, kind, t) {
  const [txt, col] = JUDGE[kind];
  texts.push({ x: LX + l * LW + LW / 2, y: LINE - 26, at: t, txt, col, ttl: 520, big: txt.length <= 3 });
  if (kind === 0 || kind === 4) { sfx("alba_buzz", 140); fx("bad", undefined, 700); return; }
  burst(l, kind === 2 ? 8 : 5);
  if (kind === 2) lit[l] = t;
  if (kind === 3) { sfx("alba_chime", 120); burst(l, 8); }
  fx("good", undefined, 600);
}
function burst(l, n) {
  const t = api.now(), cx = LX + l * LW + LW / 2;
  for (let i = 0; i < n; i++) parts.push({ x: cx + (i % 2 ? 4 : -4), y: LINE, vx: (i - n / 2) * 9 + (i % 2 ? 6 : -6), vy: -50 - (i * 17) % 40, at: t, c: i % 3 ? COL[l][1] : "#ffffff" });
  if (parts.length > 90) parts.splice(0, parts.length - 90);
}

// ── drawing
function drawNote(l, yc) {
  const x = LX + l * LW + 2, y = Math.round(yc) - 4, c = COL[l];
  px(OL, x + 1, y, 30, 9); px(OL, x, y + 1, 32, 7); px(c[0], x + 1, y + 1, 30, 7); px(c[1], x + 2, y + 1, 28, 1); px(c[2], x + 1, y + 7, 30, 1); px("#ffffff", x + 3, y + 2, 3, 2); px(c[2], x + 14, y + 4, 4, 1);
}
function drawHold(l, yTail, yHead, on, t) {
  const x = LX + l * LW + 8, c = COL[l], top = Math.round(yTail), bot = Math.round(yHead), h = bot - top;
  if (h < 2) return;
  px(OL, x, top, 20, h + 1); px(c[2], x + 1, top + 1, 18, h - 1); px(on && Math.floor(t / 70) % 2 ? "#ffffff" : c[0], x + 3, top + 1, 14, h - 1); px(c[1], x + 3, top + 1, 2, h - 1);
  for (let y = top + 4; y < bot - 2; y += 6) px(c[2], x + 8, y, 4, 1);   // stitches
  px(OL, x - 2, top - 1, 24, 5); px(c[1], x - 1, top, 22, 3);   // the tail cap
}
function frame(t, info) {
  fit(host.clientWidth || W);
  const prev = phase;
  phase = info.phase;
  if (phase === "run" && prev !== "run") { try { inp.focus({ preventScroll: true }); } catch { /* no focus, the shell's key hook still plays the taps */ } }
  if (info.fever > 0 && !feverFx) { feverFx = true; api.fx("fever"); } else if (info.fever <= 0) feverFx = false;
  if (info.combo > lastCombo && info.combo % 10 === 0 && phase === "run") { sfx("alba_chime", 200); texts.push({ x: W / 2, y: 62, at: t, txt: `${info.combo} 콤보!`, col: "#ffe27a", ttl: 800, big: true }); }
  lastCombo = info.combo || 0;
  flush();
  g.setTransform(kk, 0, 0, kk, 0, 0);
  g.drawImage(bg, 0, 0);
  // the lanes light up while a key is down: a beam above the pad that fades upward
  for (let l = 0; l < 4; l++) if (down[l]) for (let i = 0; i < 6; i++) { g.globalAlpha = 0.28 * (1 - i / 6); px(COL[l][1], LX + l * LW + 2, LINE - 8 - (i + 1) * 12, LW - 3, 12); g.globalAlpha = 1; }
  // the receptors: drum pads
  for (let l = 0; l < 4; l++) {
    const x = LX + l * LW + 2, y = LINE - 8 + (down[l] ? 1 : 0), c = COL[l], flash = t - lit[l] < 120, on = down[l] || flash;
    px(OL, x + 1, y, 30, 16); px(OL, x, y + 1, 32, 14); px(on ? c[0] : c[2], x + 1, y + 1, 30, 14); px(on ? c[1] : c[0], x + 1, y + 1, 30, 1); px(on ? "#ffffff" : c[2], x + 2, y + 2, 28, 1);
    px(on ? c[2] : "#3a2058", x + 1, y + 14, 30, 1);
    text(LABEL[l], x + 16, y + 3, on ? OL : "#ffffff", FONT9);
  }
  // the notes, scrolling smoothly from their announced times
  const list = [...notes.values()].sort((a, b) => b.at - a.at);
  for (const n of list) {
    const yHead = n.held ? LINE : LINE - (n.at - t) * SPEED;
    if (n.hit) continue;
    if (n.h) {
      const yTail = LINE - (n.at + n.h - t) * SPEED;
      if (yTail > LINE + 12 || yHead < -8) continue;
      drawHold(n.l, yTail, Math.min(yHead, LINE + 8), n.held, t);
      if (!n.held) drawNote(n.l, yHead);
      else { px("#ffffff", LX + n.l * LW + 2, LINE - 5, 32, 2); if (Math.floor(t / 90) % 2) burst(n.l, 1); }
    } else if (yHead > -8 && yHead < LINE + 14) drawNote(n.l, yHead);
  }
  g.drawImage(top, 0, 0);   // the valance hangs over where the notes come from
  // sparks and judgement words
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], a = (t - p.at) / 1000;
    if (a > 0.4) { parts.splice(i, 1); continue; }
    const x = Math.round(p.x + p.vx * a), y = Math.round(p.y + p.vy * a + 120 * a * a);
    px(OL, x - 1, y - 1, 4, 4); px(p.c, x, y, 2, 2);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const x = texts[i], a = t - x.at;
    if (a > x.ttl) { texts.splice(i, 1); continue; }
    g.globalAlpha = a > x.ttl - 160 ? clamp01((x.ttl - a) / 160) : 1;
    text(x.txt, Math.round(x.x), Math.round(x.y - a / 40), x.col, x.big ? FONT11 : FONT9);
    g.globalAlpha = 1;
  }
  // footlights flash with the lane that was hit and pulse on the beat; the tally on the planks
  const beatMs = 60000 / Math.max(40, bpm), pulse = (t % beatMs) / beatMs < 0.16;
  for (let l = 0; l < 4; l++) {
    const x = LX + l * LW + LW / 2 - 2, on = t - lit[l] < 160;
    px(OL, x - 1, LINE + 17, 6, 5); px(on ? COL[l][1] : pulse ? "#fff2a8" : "#e8b848", x, LINE + 18, 4, 3); if (on) { px("#ffffff", x + 1, LINE + 18, 2, 1); g.globalAlpha = 0.3; px(COL[l][0], x - 4, LINE + 15, 12, 8); g.globalAlpha = 1; }
  }
  plate(8, LINE + 22, W - 16, 15);
  if (info.fever > 0) text("앙코르!", W / 2, LINE + 25, Math.floor(t / 100) % 2 ? "#d8481a" : "#8a6a44", FONT9, "center", null);
  else text(`완벽 ${cnt[0]}  좋아요 ${cnt[1]}  놓침 ${cnt[2]}`, W / 2, LINE + 25, "#6a4424", FONT9, "center", null);
  if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; px(c, 0, 0, W, 2); px(c, 0, H - 2, W, 2); px(c, 0, 0, 2, H); px(c, W - 2, 0, 2, H); }
  if (info.phase !== "run") {
    px("rgba(42,22,48,.38)", 0, 0, W, H);
    plate(14, 44, W - 28, 92);
    if (info.phase === "brief") {
      text(info.toStart > 0 ? `${Math.ceil(info.toStart / 1000)}` : "시작!", W / 2, 52, "#c8462a", FONT11);
      text("D F J K  또는  ← ↓ ↑ →", W / 2, 76, "#6a4424", FONT9);
      text("레인을 터치해도 돼요", W / 2, 90, "#2a70c8", FONT9);
      text("긴 음표는 끝까지 누르기", W / 2, 104, "#c8641a", FONT9);
      text("누를 때마다 음이 울려요", W / 2, 118, "#8a6a44", FONT9);
    } else text("수고하셨어요!", W / 2, 84, "#c8462a", FONT11);
  }
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── mount: the stage, the keyboard catcher, the touch lanes
function mount(h, a) {
  kk = 1; host = h; api = a; notes = new Map(); parts = []; texts = []; outbox = []; down = [0, 0, 0, 0]; lit = [0, 0, 0, 0]; offs = [{}, {}, {}, {}]; touches = new Map();
  lastSeq = -1; first = true; phase = "brief"; scale = 0; fitKey = ""; cnt = [0, 0, 0]; bpm = 100; feverFx = false; lastSend = -1e9; pend = 0; lastCombo = 0; sfxAt = {};
  host.textContent = "";
  boardEl = host.closest(".ap-board");
  if (boardEl) { boardWas = boardEl.style.background; boardEl.style.background = "#7a4a8c"; }   // the frame around the stage is plum, not black
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  cv.style.cssText = "touch-action:none;image-rendering:pixelated;user-select:none;-webkit-user-select:none;outline:3px solid #2a1630;box-shadow:0 3px 0 #1c0e22;";
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  [bg, top] = makeBg();
  inp = document.createElement("input"); inp.readOnly = true; inp.setAttribute("inputmode", "none"); inp.setAttribute("aria-label", "연주 키 입력");
  inp.style.cssText = "position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;";
  inp.addEventListener("keydown", keyDown); inp.addEventListener("keyup", keyUp); inp.addEventListener("blur", releaseAll);
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { inp.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); } catch { /* fine without */ }
    const l = pointerLane(e); touches.set(e.pointerId, l); press(l, "p" + e.pointerId);
  });
  const up = (e) => { const l = touches.get(e.pointerId); if (l === undefined) return; touches.delete(e.pointerId); release(l, "p" + e.pointerId); };
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) cv.addEventListener(ev, up);
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  wrap.append(cv, inp);
  host.append(wrap);
  try { inp.focus({ preventScroll: true }); } catch { /* ok */ }
}
/** Key-downs the shell hands over when the board has no focus: taps still play (a hold then ends by itself, never early). */
function key(e) {
  const l = laneOf(e);
  if (l < 0) return false;
  if (!e.repeat) { press(l, "k" + e.code); setTimeout(() => release(l, "k" + e.code), 90); }
  return true;
}
function unmount() {
  releaseAll();
  clearTimeout(pend);
  if (boardEl) boardEl.style.background = boardWas;
  if (host) host.textContent = "";
  host = api = cv = g = inp = bg = top = boardEl = null; notes = new Map(); outbox = []; touches = new Map();
}

export default { mount, setState, frame, key, unmount };
