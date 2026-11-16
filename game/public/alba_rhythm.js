/**
 * 일일 아르바이트 · 여관 공연 client (rules: src/logic/67-alba-rhythm.js, contract: public/alba.js): four lanes of falling notes on a 176×208 pixel stage (drawn at a
 * whole-number scale, no smoothing). The server rolls the song and judges every press against the note's own time; this scrolls the notes smoothly from the times in
 * the view and sends the presses: D F J K / ← ↓ ↑ → / touching a lane → {m: lane bits} (a chord shares one message), a key coming up → {m, up: 1} (the tail of a hold).
 * view = [[id, lane, ms from receipt (note time), hold ms, held 0|1 …], [seq, lane, kind (0 miss · 1 good · 2 perfect · 3 hold done · 4 hold broken) …], bpm, [perfect, good, miss]]
 * A press hides its nearest note at once (optimistic); the judgement text and the score only ever come from the server.
 * The shell (alba.js) never forwards key-ups to a game, so a hidden read-only input inside the board takes the keyboard focus: its key-downs / key-ups reach this file directly.
 */
const W = 176, H = 208, LX = 16, LW = 36, LINE = 168, SPEED = 0.085;   // lane area, the hit line, px per ms
const OL = "#14101a", FONT9 = "9px Galmuri9, Galmuri11, monospace", FONT11 = "11px Galmuri11, Galmuri9, monospace";
const COL = [["#ff6a8a", "#ffb4c4", "#b83a5a"], ["#ffc84a", "#ffe69a", "#b88a1a"], ["#6adf8a", "#b8f4c8", "#2a9a4a"], ["#6ab0ff", "#b8dcff", "#2a70c0"]];
const LABEL = ["D", "F", "J", "K"];
const CODES = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const JUDGE = [["놓쳤어요", "#ff7a6a"], ["좋아요", "#9ae8a0"], ["완벽!", "#ffe27a"], ["유지!", "#b8dcff"], ["끊김", "#ff7a6a"]];

let host = null, api = null, cv = null, g = null, inp = null, bg = null, scale = 0, fitKey = "";
let notes = new Map(), recvAt = 0, bpm = 100, cnt = [0, 0, 0], lastSeq = -1, first = true;
let down = [0, 0, 0, 0], lit = [0, 0, 0, 0], parts = [], texts = [], outbox = [], lastSend = -1e9, pend = 0, phase = "brief", feverFx = false;
let touches = new Map(), offs = [];

/** Size the canvas to the stage: a whole-number scale when it is 2× or more, else the largest that fits (measured only when the window changes). */
function fit(w) {
  const key = `${w}|${innerHeight}`;
  if (key === fitKey) return;
  fitKey = key;
  const box = host.closest(".ap-box"), fixed = box ? box.offsetHeight - host.parentElement.offsetHeight : 260;
  const sc = Math.min(w / W, (innerHeight * 0.96 - fixed - 12) / H), s2 = sc >= 2 ? Math.floor(sc) : Math.max(0.5, sc);
  scale = s2; cv.style.width = `${Math.round(W * s2)}px`; cv.style.height = `${Math.round(H * s2)}px`;
}
const px = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function text(s, x, y, col, font = FONT9, align = "center") {
  g.font = font; g.textAlign = align; g.textBaseline = "top";
  g.fillStyle = OL; g.fillText(s, x + 1, y + 1); g.fillText(s, x - 1, y + 1); g.fillStyle = col; g.fillText(s, x, y);
}

// ── the backdrop: a dark stage, the lanes, the hit line (drawn once)
function makeBg() {
  const b = document.createElement("canvas"); b.width = W; b.height = H;
  const q = b.getContext("2d"), r = (c, x, y, w, h) => { q.fillStyle = c; q.fillRect(x, y, w, h); };
  r("#14121c", 0, 0, W, H);
  for (let i = 0; i < 40; i++) r(i % 3 ? "#2a2640" : "#3a3458", (i * 37 + 11) % W, (i * 53 + 7) % 150, 1, 1);   // a few stage stars
  for (let l = 0; l < 4; l++) { r(l % 2 ? "#1c1926" : "#211d2e", LX + l * LW, 0, LW, LINE + 16); r("#2e2a3e", LX + l * LW, 0, 1, LINE + 16); }
  r("#2e2a3e", LX + 4 * LW, 0, 1, LINE + 16);
  r("#8a7448", LX - 3, 0, 3, LINE + 16); r("#8a7448", LX + 4 * LW + 1, 0, 3, LINE + 16);   // the stage edge
  r("#2a2438", 0, LINE + 16, W, H - LINE - 16);
  r("#8a7448", 0, LINE + 16, W, 1);
  return b;
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
  texts.push({ x: LX + l * LW + LW / 2, y: LINE - 26, at: t, txt, col });
  if (kind === 0 || kind === 4) { api.fx("bad"); return; }
  burst(l, kind === 2 ? 8 : 5);
  if (kind === 2) lit[l] = t;
  api.fx("good");
}
function burst(l, n) {
  const t = api.now(), cx = LX + l * LW + LW / 2;
  for (let i = 0; i < n; i++) parts.push({ x: cx + (i % 2 ? 4 : -4), y: LINE, vx: (i - n / 2) * 9 + (i % 2 ? 6 : -6), vy: -50 - (i * 17) % 40, at: t, c: i % 3 ? COL[l][1] : "#ffffff" });
  if (parts.length > 90) parts.splice(0, parts.length - 90);
}

// ── drawing
function drawNote(l, yc) {
  const x = LX + l * LW + 2, y = Math.round(yc) - 4, c = COL[l];
  px(OL, x, y, 32, 9); px(c[0], x + 1, y + 1, 30, 7); px(c[1], x + 1, y + 1, 30, 1); px(c[2], x + 1, y + 7, 30, 1); px("#ffffff", x + 3, y + 3, 2, 2);
}
function drawHold(l, yTail, yHead, on, t) {
  const x = LX + l * LW + 8, c = COL[l], top = Math.round(yTail), bot = Math.round(yHead), h = bot - top;
  if (h < 2) return;
  px(OL, x, top, 20, h + 1); px(c[2], x + 1, top + 1, 18, h - 1); px(on && Math.floor(t / 70) % 2 ? "#ffffff" : c[0], x + 3, top + 1, 14, h - 1); px(c[1], x + 3, top + 1, 2, h - 1);
  px(OL, x - 2, top - 1, 24, 5); px(c[1], x - 1, top, 22, 3);   // the tail cap
}
function frame(t, info) {
  fit(host.clientWidth || W);
  const prev = phase;
  phase = info.phase;
  if (phase === "run" && prev !== "run") { try { inp.focus({ preventScroll: true }); } catch { /* no focus, the shell's key hook still plays the taps */ } }
  if (info.fever > 0 && !feverFx) { feverFx = true; api.fx("fever"); } else if (info.fever <= 0) feverFx = false;
  flush();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(bg, 0, 0);
  // the lanes light up while a key is down
  for (let l = 0; l < 4; l++) if (down[l]) { g.globalAlpha = 0.16; px(COL[l][0], LX + l * LW + 1, 0, LW - 1, LINE + 16); g.globalAlpha = 1; }
  // the receptors
  for (let l = 0; l < 4; l++) {
    const x = LX + l * LW + 2, y = LINE - 8 + (down[l] ? 1 : 0), c = COL[l], flash = t - lit[l] < 120;
    px(OL, x, y, 32, 16); px(down[l] || flash ? c[0] : "#2a2438", x + 1, y + 1, 30, 14); px(c[2], x + 1, y + 14, 30, 1); px(c[1], x + 1, y + 1, 30, 1);
    text(LABEL[l], x + 16, y + 3, down[l] || flash ? OL : c[1], FONT9);
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
  // sparks and judgement words
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], a = (t - p.at) / 1000;
    if (a > 0.4) { parts.splice(i, 1); continue; }
    px(p.c, Math.round(p.x + p.vx * a), Math.round(p.y + p.vy * a + 120 * a * a), 2, 2);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const x = texts[i], a = t - x.at;
    if (a > 520) { texts.splice(i, 1); continue; }
    text(x.txt, Math.round(x.x), Math.round(x.y - a / 40), x.col, FONT9);
  }
  // the strip below: the tally, the keys
  text(`완벽 ${cnt[0]}  좋아요 ${cnt[1]}  놓침 ${cnt[2]}`, W / 2, LINE + 20, "#e2c486", FONT9);
  text(info.fever > 0 ? "앙코르!" : `♩ ${bpm}`, W / 2, LINE + 31, info.fever > 0 ? "#ff9a3a" : "#8a7e9a", FONT9);
  if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; px(c, 0, 0, W, 2); px(c, 0, H - 2, W, 2); px(c, 0, 0, 2, H); px(c, W - 2, 0, 2, H); }
  if (info.phase !== "run") {
    px("rgba(10,8,16,.62)", 0, 0, W, H);
    if (info.phase === "brief") {
      text(info.toStart > 0 ? `${Math.ceil(info.toStart / 1000)}` : "시작!", W / 2, 58, "#fff2a8", FONT11);
      text("D F J K  또는  ← ↓ ↑ →", W / 2, 84, "#ffffff", FONT9);
      text("레인을 터치해도 돼요", W / 2, 98, "#b8dcff", FONT9);
      text("긴 음표는 끝까지 누르기", W / 2, 112, "#ffc84a", FONT9);
    } else text("수고하셨어요!", W / 2, 80, "#fff2a8", FONT11);
  }
}

// ── mount: the stage, the keyboard catcher, the touch lanes
function mount(h, a) {
  host = h; api = a; notes = new Map(); parts = []; texts = []; outbox = []; down = [0, 0, 0, 0]; lit = [0, 0, 0, 0]; offs = [{}, {}, {}, {}]; touches = new Map();
  lastSeq = -1; first = true; phase = "brief"; scale = 0; fitKey = ""; cnt = [0, 0, 0]; bpm = 100; feverFx = false; lastSend = -1e9; pend = 0;
  host.textContent = "";
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;width:100%;padding:4px 0;";
  cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  cv.style.cssText = "touch-action:none;image-rendering:pixelated;user-select:none;-webkit-user-select:none;";
  g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  bg = makeBg();
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
  if (host) host.textContent = "";
  host = api = cv = g = inp = bg = null; notes = new Map(); outbox = []; touches = new Map();
}

export default { mount, setState, frame, key, unmount };
