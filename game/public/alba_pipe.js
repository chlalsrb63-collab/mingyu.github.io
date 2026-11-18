// 일일 아르바이트 · 배관 수리 client (rules: logic 67-alba-pipe.js; contract: public/alba.js). One canvas: the 12×12 site on the left (the water comes in at the
// left edge and must leave at the right edge), the hand piece, the next three, the site clock, [버리기] and [건너뛰기] on the right.
// View from the server: [site n, inlet row, outlet row, 144-char board, hand + next three (hex), ms to open, ms to end, trashed, last site's end].
// Tap an empty cell to put the hand piece there (drawn at once, the server's next state corrects it). Pieces are 4-bit masks: N 1 · E 2 · S 4 · W 8.
// Look: a sunny boiler room — teal tile floor, copper (dry) pipes that turn blue when the water reaches them, a cream control panel. Sounds: snap on place, splash on flow.
const CS = 26, BX = 14, BY = 2, PX = 340, CW = 450, CH = 316;   // cell, board origin, panel x, canvas size (logical pixels, scaled by CSS without smoothing)
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const COL = {
  bg: "#4f8590", ol: "#1f2e3a", f1: "#9dc2b8", f2: "#93b9af", f3: "#7aa299", f4: "#b8dad0",
  dry: ["#a24d2a", "#dd8c4a", "#ffd096"], wet: ["#2466c8", "#48a6ff", "#c4eaff"], rock: ["#5e5a6e", "#868298", "#aaa6bc", "#d2cee2"],
  ok: "#3fae62", bad: "#e8554a", gold: "#f0b82a", txt: "#3b2d1f", dim: "#6b5a3e", white: "#fffdf4",
  panel: "#efe3c2", panelLo: "#cdbb90", hole: "#b9cfc6", btn: "#e2b04a", btnHi: "#ffe08a", btnLo: "#a8741e",
};
const FONT = (px, bold = true) => `${bold ? "bold " : ""}${px}px Galmuri11, "Malgun Gothic", sans-serif`;
const MSG = { 1: ["수리 완료!", COL.ok], 2: ["누수! 막다른 길", COL.bad], 3: ["시간 초과", COL.bad], 4: ["건너뜀", COL.dim] };

let host = null, api = null, cv = null, g = null;
let S = null, wet = null, prev = null, hover = -1, skipArmed = 0, tiles = null, flash = 0;
let pop = new Map(), fxp = [], shakeAt = 0, lastT = 0, lastWet = 0, lastS = {}, tickSec = -1;
const BTN = { trash: [PX + 4, 176, 102, 34], skip: [PX + 4, 218, 102, 32] };

/** A sound, throttled so a held key or a fast tapper never spams it. */
function snd(n, gap = 70) { const t = performance.now(); if (api && t - (lastS[n] || 0) >= gap) { lastS[n] = t; api.sfx(n); } }
function burst(x, y, n, cols, spd = 50, up = 40) {
  for (let i = 0; i < n; i++) fxp.push({ x, y, vx: (Math.random() - 0.5) * spd * 2, vy: -Math.random() * up - 8, life: 0.35 + Math.random() * 0.3, col: cols[i % cols.length] });
  if (fxp.length > 120) fxp.splice(0, fxp.length - 120);
}

// ── the water: where it has got to (a copy of the rule's trace that also lists the wet cells)
function trace(b, ir, or) {
  const cells = [];
  let x = 0, y = ir, from = 3;
  for (let k = 0; k < 300; k++) {
    if (x < 0 || y < 0 || x > 11 || y > 11) return { r: x === 12 && y === or ? 1 : 2, cells, x, y, from };
    const m = b[y * 12 + x];
    if (m === 0) return { r: 0, cells, x, y, from };
    if (m === 255 || !(m & (1 << from))) return { r: 2, cells, x, y, from };
    cells.push(y * 12 + x);
    const out = m === 15 ? (from + 2) & 3 : 31 - Math.clz32(m & ~(1 << from));
    x += DX[out]; y += DY[out]; from = (out + 2) & 3;
  }
  return { r: 2, cells, x, y, from };
}

// ── art (each tile is drawn once into its own small canvas)
function mkTile(draw, s = CS) {
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const q = c.getContext("2d");
  q.imageSmoothingEnabled = false;
  draw(q);
  return c;
}
function drawPipe(q, m, pal) {
  const [dk, mid, lt] = pal, arms = [[8, 0, 10, 18], [8, 8, 18, 10], [8, 8, 10, 18], [0, 8, 18, 10]];   // N E S W as x y w h
  q.fillStyle = COL.ol;
  arms.forEach(([x, y, w, h], i) => { if (m & (1 << i)) q.fillRect(Math.max(0, x - 1), Math.max(0, y - 1), Math.min(CS, x + w + 1) - Math.max(0, x - 1), Math.min(CS, y + h + 1) - Math.max(0, y - 1)); });
  arms.forEach(([x, y, w, h], i) => {
    if (!(m & (1 << i))) return;
    q.fillStyle = mid; q.fillRect(x, y, w, h);
    q.fillStyle = lt; if (i & 1) q.fillRect(x, y + 1, w, 2); else q.fillRect(x + 1, y, 2, h);
    q.fillStyle = dk; if (i & 1) q.fillRect(x, y + h - 2, w, 2); else q.fillRect(x + w - 2, y, 2, h);
  });
  q.fillStyle = mid; q.fillRect(8, 8, 10, 10);
  if (m !== 10 && m !== 5) { q.fillStyle = lt; q.fillRect(9, 9, 3, 3); q.fillStyle = dk; q.fillRect(15, 15, 3, 3); }
  if (m === 15) { q.fillStyle = COL.ol; q.fillRect(12, 12, 2, 2); }
  const rings = [[6, 0, 14, 3, 7, 0, 12, 2], [23, 6, 3, 14, 24, 7, 2, 12], [6, 23, 14, 3, 7, 24, 12, 2], [0, 6, 3, 14, 0, 7, 2, 12]];   // the coupling ring at each open end
  rings.forEach((r, i) => {
    if (!(m & (1 << i))) return;
    q.fillStyle = COL.ol; q.fillRect(r[0], r[1], r[2], r[3]);
    q.fillStyle = lt; q.fillRect(r[4], r[5], r[6], r[7]);
  });
}
function getTiles() {
  if (tiles) return tiles;
  tiles = { dry: [], wet: [], floor: [], rock: null };
  for (let m = 1; m < 16; m++) { tiles.dry[m] = mkTile((q) => drawPipe(q, m, COL.dry)); tiles.wet[m] = mkTile((q) => drawPipe(q, m, COL.wet)); }
  tiles.floor = [COL.f1, COL.f2].map((c, i) => mkTile((q) => {
    q.fillStyle = c; q.fillRect(0, 0, CS, CS); q.fillStyle = COL.f3; q.fillRect(0, CS - 1, CS, 1); q.fillRect(CS - 1, 0, 1, CS);
    q.fillStyle = COL.f4; q.fillRect(1, 1, 3, 1); q.fillRect(1, 2, 1, 2);   // a corner glint, so the tiles read as tiles
    q.fillStyle = COL.f3; q.fillRect(i ? 18 : 6, i ? 19 : 14, 2, 1);
  }));
  tiles.rock = mkTile((q) => {
    const [a, b, c, d] = COL.rock;
    q.fillStyle = COL.ol; q.fillRect(3, 8, 20, 16); q.fillRect(5, 5, 16, 4); q.fillRect(1, 12, 24, 9);
    q.fillStyle = a; q.fillRect(4, 9, 18, 14); q.fillRect(6, 6, 14, 3); q.fillRect(2, 13, 22, 7);
    q.fillStyle = b; q.fillRect(5, 10, 16, 12); q.fillRect(7, 7, 12, 3); q.fillRect(3, 14, 20, 5);
    q.fillStyle = c; q.fillRect(7, 8, 8, 3); q.fillRect(5, 12, 5, 4);
    q.fillStyle = d; q.fillRect(8, 8, 4, 2); q.fillRect(6, 12, 2, 2);
    q.fillStyle = a; q.fillRect(14, 15, 2, 6); q.fillRect(16, 19, 4, 2);
    q.fillStyle = "#6fb85e"; q.fillRect(16, 6, 4, 2); q.fillRect(17, 5, 2, 1);   // a little moss
  });
  return tiles;
}

// ── the server's state
function decode(v, recvAt) {
  const [n, ir, or, bs, q, goMs, endMs, tr, lr] = v;
  return { n, ir, or, b: [...bs].map((c) => (c === "#" ? 255 : parseInt(c, 16))), q: [...q].map((c) => parseInt(c, 16)), goAt: recvAt + goMs, te: recvAt + endMs, span: Math.max(1, endMs - goMs), tr, lr };
}
function refresh() { wet = S ? trace(S.b, S.ir, S.or) : null; }

function place(c) {
  if (!S || S.b[c] !== 0 || performance.now() < S.goAt || !S.q.length) return;
  S.b[c] = S.q.shift();   // drawn at once; the server's next state replaces this
  refresh();
  const [x, y] = boardAt(c);
  pop.set(c, performance.now());
  burst(x + 13, y + 22, 5, ["#fffdf4", "#d8ece4", "#ffd096"], 36, 22);
  snd("alba_snap", 40);
  api.act({ c });
}
function trash() {
  if (!S || performance.now() < S.goAt || !S.q.length) return;
  S.q.shift(); flash = performance.now();
  burst(PX + 55, 98, 8, ["#dd8c4a", "#a24d2a", "#aaa6bc"], 50, 40);
  snd("alba_crunch", 120);
  api.act({ tr: 1 });
}
function skip() {
  if (!S) return;
  const t = performance.now();
  if (t < skipArmed) { skipArmed = 0; snd("alba_swish", 200); api.act({ sk: 1 }); return; }
  skipArmed = t + 2000; snd("alba_tick", 100);
}

// ── input
const at = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * CW) / r.width, ((e.clientY - r.top) * CH) / r.height]; };
const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;
function cellAt(x, y) {
  const cx = Math.floor((x - BX) / CS), cy = Math.floor((y - BY) / CS);
  return cx >= 0 && cy >= 0 && cx < 12 && cy < 12 ? cy * 12 + cx : -1;
}

// ── drawing
function text(s, x, y, color, px, align = "left", bold = true) { g.font = FONT(px, bold); g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(s, x, y); }
function button(r, label, sub, armed) {
  const [x, y, w, h] = r;
  g.fillStyle = COL.ol; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = armed ? "#e8735a" : COL.btn; g.fillRect(x, y, w, h);
  g.fillStyle = armed ? "#ffa890" : COL.btnHi; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
  g.fillStyle = armed ? "#a8402e" : COL.btnLo; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  text(label, x + w / 2, y + (sub ? 15 : h / 2 + 4), armed ? COL.white : COL.txt, 12, "center");
  if (sub) text(sub, x + w / 2, y + 28, armed ? COL.white : COL.dim, 10, "center", false);
}
function arrow(tx, ty, dx, dy, color) {   // a four-step pixel arrowhead: tip (tx, ty), pointing (dx, dy)
  g.fillStyle = color;
  for (let k = 0; k < 4; k++) {
    const cx = tx - dx * k * 2, cy = ty - dy * k * 2;   // row k lies 2k px behind the tip and is 2k+1 px across
    if (dx) g.fillRect(dx > 0 ? cx - 1 : cx, cy - k, 2, 2 * k + 1);
    else g.fillRect(cx - k, dy > 0 ? cy - 1 : cy, 2 * k + 1, 2);
  }
}
function boardAt(c) { return [BX + (c % 12) * CS, BY + ((c / 12) | 0) * CS]; }
function plaque(head, sub, col, y) {   // a cream label over the board
  const w = 12 * CS - 24, h = sub ? 50 : 34, x = BX + 12, yy = y;
  g.fillStyle = COL.ol; g.fillRect(x - 2, yy - 2, w + 4, h + 4);
  g.fillStyle = COL.panel; g.fillRect(x, yy, w, h); g.fillStyle = COL.white; g.fillRect(x, yy, w, 2); g.fillStyle = COL.panelLo; g.fillRect(x, yy + h - 2, w, 2);
  text(head, BX + 6 * CS, yy + 23, col, 18, "center");
  if (sub) text(sub, BX + 6 * CS, yy + 42, COL.dim, 11, "center", false);
}

function drawBoard(d, t, live) {
  const T = getTiles(), w = trace(d.b, d.ir, d.or), wetSet = new Set(w.cells);
  for (let c = 0; c < 144; c++) { const [x, y] = boardAt(c); g.drawImage(T.floor[((c % 12) + ((c / 12) | 0)) & 1], x, y); }
  for (let c = 0; c < 144; c++) {
    const [x, y] = boardAt(c), m = d.b[c];
    if (!m) continue;
    const age = t - (pop.get(c) || -1e9), oy = age < 160 ? -Math.round(7 * (1 - age / 160) * (1 - age / 160)) : 0;   // a placed piece drops in
    if (m === 255) g.drawImage(T.rock, x, y);
    else g.drawImage(wetSet.has(c) ? T.wet[m] : T.dry[m], x, y + oy);
  }
  // the inlet and the outlet: a pipe stub out of the board, wet at the inlet
  const iy = BY + d.ir * CS, oy = BY + d.or * CS;
  g.drawImage(T.wet[10], 0, 0, 14, CS, 0, iy, 14, CS);
  arrow(11, iy + 13, 1, 0, COL.wet[2]);
  const drip = Math.floor(t / 300) % 4;   // the tap drips while the line is idle
  g.fillStyle = COL.wet[1]; g.fillRect(3, iy + CS - 6 + drip * 2, 2, 2);
  // the water's flow: a light wave along the wet pipe
  for (let k = 0; k < w.cells.length; k++) {
    const [x, y] = boardAt(w.cells[k]), a = 0.5 + 0.5 * Math.sin(t / 120 - k * 0.9);
    g.globalAlpha = 0.35 + 0.55 * a; g.fillStyle = COL.wet[2]; g.fillRect(x + 11, y + 11, 4, 4);
  }
  g.globalAlpha = 1;
  if (live && w.r === 0) {   // where the water waits
    const [x, y] = boardAt(w.y * 12 + w.x), pulse = 0.5 + 0.5 * Math.sin(t / 160);
    g.globalAlpha = 0.55 + 0.45 * pulse; g.strokeStyle = COL.wet[1]; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, CS - 2, CS - 2);
    g.fillStyle = COL.wet[2]; g.globalAlpha = 0.25 + 0.25 * pulse; g.fillRect(x + 2, y + 2, CS - 4, CS - 4); g.globalAlpha = 1;
    const inward = (w.from + 2) & 3;   // the water comes in through side `from`: the arrow lies near that side and points to the middle
    arrow(x + 13 - DX[inward] * 2, y + 13 - DY[inward] * 2, DX[inward], DY[inward], COL.wet[0]);
  }
  if (!live && w.r === 2) {   // a leak: drops where the water got out
    const px = w.cells.length ? boardAt(w.cells[w.cells.length - 1]) : [BX, iy];
    for (let i = 0; i < 6; i++) { g.globalAlpha = 0.9; g.fillStyle = i % 2 ? COL.wet[2] : COL.wet[1]; g.fillRect(px[0] + 6 + ((i * 7 + Math.floor(t / 90)) % 14), px[1] + 4 + ((i * 5 + Math.floor(t / 70)) % 18), 3, 3); }
    g.globalAlpha = 1;
  }
}

function outlet(d) {   // drawn after the panel: the drain pipe runs into its edge
  const T = getTiles(), w = trace(d.b, d.ir, d.or), oy = BY + d.or * CS;
  g.drawImage(w.r === 1 ? T.wet[10] : T.dry[10], 12, 0, 14, CS, BX + 12 * CS, oy, 14, CS);
  arrow(BX + 12 * CS + 11, oy + 13, 1, 0, w.r === 1 ? COL.wet[2] : COL.panel);
}

function panel(t) {
  g.fillStyle = COL.ol; g.fillRect(PX - 4, 0, CW - PX + 4, CH);
  g.fillStyle = COL.panel; g.fillRect(PX - 2, 2, CW - PX, CH - 4);
  g.fillStyle = COL.white; g.fillRect(PX - 2, 2, CW - PX, 2); g.fillStyle = COL.panelLo; g.fillRect(PX - 2, CH - 4, CW - PX, 2);
  if (!S) return;
  text(`현장 ${S.n}`, PX + 55, 20, COL.txt, 14, "center");
  // the site clock
  const left = Math.max(0, S.te - t), frac = Math.min(1, left / S.span), c = frac > 0.4 ? COL.ok : frac > 0.2 ? COL.gold : COL.bad;
  g.fillStyle = COL.ol; g.fillRect(PX + 3, 26, 104, 14);
  g.fillStyle = COL.panelLo; g.fillRect(PX + 4, 27, 102, 12);
  if (frac > 0.2 || Math.floor(t / 250) % 2) { g.fillStyle = c; g.fillRect(PX + 4, 27, Math.round(102 * frac), 12); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(PX + 4, 27, Math.round(102 * frac), 2); }
  text(`${Math.ceil(left / 1000)}초`, PX + 55, 54, frac > 0.2 ? COL.txt : COL.bad, 12, "center");
  // the hand and the queue
  text("손패", PX + 55, 68, COL.dim, 10, "center", false);
  const T = getTiles(), bob = Math.round(Math.sin(t / 260) * 1.5);
  g.fillStyle = COL.ol; g.fillRect(PX + 25, 72, 58, 58);
  g.fillStyle = COL.hole; g.fillRect(PX + 26, 73, 56, 56);
  g.fillStyle = COL.f4; g.fillRect(PX + 26, 73, 56, 2);
  if (S.q.length) g.drawImage(T.dry[S.q[0]], 0, 0, CS, CS, PX + 28, 75 + bob, 52, 52);
  text("다음", PX + 55, 144, COL.dim, 10, "center", false);
  for (let i = 1; i < 4 && i < S.q.length; i++) {
    const x = PX + 4 + (i - 1) * 35;
    g.fillStyle = COL.ol; g.fillRect(x - 1, 147, 30, 30); g.fillStyle = COL.hole; g.fillRect(x, 148, 28, 28);
    g.drawImage(T.dry[S.q[i]], x + 1, 149);
  }
  g.globalAlpha = 1;
  const hot = performance.now() - flash < 250;
  button(BTN.trash, "버리기 [T]", "−3초 · 보너스 없음", hot);
  button(BTN.skip, t < skipArmed ? "정말 건너뛸까요?" : "건너뛰기", "", t < skipArmed);
  text("물이 멈춘 빈 칸에 맞는", PX + 55, 270, COL.dim, 9, "center", false);
  text("조각을 이어 놓으세요", PX + 55, 282, COL.dim, 9, "center", false);
  text("안 맞는 조각은 구석에", PX + 55, 296, COL.dim, 9, "center", false);
  text("두거나 버리세요", PX + 55, 308, COL.dim, 9, "center", false);
}

export default {
  mount(h, a) {
    host = h; api = a;
    host.textContent = ""; Object.assign(host.style, { alignSelf: "stretch", background: "#4f8590" });
    cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    cv.style.cssText = "display:block;width:100%;max-width:900px;height:auto;margin:0 auto;image-rendering:pixelated;touch-action:none;cursor:pointer";
    g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    host.append(cv);
    S = null; wet = null; prev = null; hover = -1; skipArmed = 0; pop = new Map(); fxp = []; shakeAt = 0; lastT = 0; lastWet = 0; lastS = {}; tickSec = -1;
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const [x, y] = at(e), c = cellAt(x, y);
      if (c >= 0) place(c);
      else if (inRect(x, y, BTN.trash)) trash();
      else if (inRect(x, y, BTN.skip)) skip();
    });
    cv.addEventListener("pointermove", (e) => { const [x, y] = at(e); hover = cellAt(x, y); });
    cv.addEventListener("pointerleave", () => { hover = -1; });
  },
  setState(v, recvAt) {
    const n = decode(v, recvAt);
    if (S && n.n > S.n) {   // a site ended: show its last board and how it ended while the next one is opening
      prev = { ...S, b: S.b.slice(), until: n.goAt };
      const t = performance.now();
      if (n.lr !== 4) api.fx(n.lr === 1 ? (S.tr ? "good" : "big") : "bad", (MSG[n.lr] || [""])[0], 190, 36);
      if (n.lr === 1) { snd("alba_splash", 200); burst(BX + 12 * CS + 6, BY + S.or * CS + 13, 18, [COL.wet[1], COL.wet[2], "#ffffff"], 70, 70); }
      else if (n.lr === 4) snd("alba_swish", 200);
      else { snd("alba_buzz", 200); shakeAt = t; }
    }
    if (S && n.n === S.n) n.span = S.span;   // a trash shortens the clock, not the bar's scale
    const same = S && n.n === S.n;
    S = n;
    skipArmed = 0;
    refresh();
    if (same && wet.cells.length - lastWet >= 2) snd("alba_splash", 300);   // the water ran on through several pieces
    lastWet = wet.cells.length;
  },
  frame(t, info) {
    if (!g) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COL.bg; g.fillRect(0, 0, CW, CH);
    if (!S) return;
    if (t - shakeAt < 260) g.translate(Math.round(Math.sin(t / 18) * 3), 0);
    const showPrev = prev && t < prev.until;
    drawBoard(showPrev ? prev : S, t, !showPrev && info.phase === "run" && t >= S.goAt);
    if (!showPrev && info.phase === "run" && hover >= 0 && S.b[hover] === 0 && S.q.length && t >= S.goAt) {   // where the hand piece would go
      const [x, y] = boardAt(hover);
      g.globalAlpha = 0.6; g.drawImage(getTiles().dry[S.q[0]], x, y); g.globalAlpha = 1;
      g.strokeStyle = COL.white; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, CS - 1, CS - 1);
    }
    // sparks, dust and water drops
    for (let i = fxp.length - 1; i >= 0; i--) {
      const p = fxp[i]; p.life -= dt;
      if (p.life <= 0) { fxp.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 190 * dt;
      g.globalAlpha = Math.min(1, p.life * 3); g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    g.globalAlpha = 1;
    panel(t);
    outlet(showPrev ? prev : S);
    // the last seconds of a site tick
    if (info.phase === "run" && t >= S.goAt) { const sec = Math.ceil((S.te - t) / 1000); if (sec !== tickSec) { tickSec = sec; if (sec > 0 && sec <= 3) snd("alba_tick", 400); } }
    // banners over the board
    let head = "", sub = "", col = COL.txt;
    if (info.phase === "brief") { head = "곧 시작합니다"; sub = "왼쪽 급수구에서 오른쪽 배수구까지 길을 이으세요"; }
    else if (showPrev) { [head, col] = MSG[S.lr] || ["", COL.txt]; sub = `현장 ${S.n}`; }
    else if (info.phase === "end") { head = "수고하셨어요"; sub = ""; }
    else if (t < S.goAt) { head = `현장 ${S.n}`; }
    if (head) plaque(head, sub, col, BY + 118);
  },
  key(e) {
    if (e.key === "t" || e.key === "T" || e.key === "ㅅ") { trash(); return true; }
    return false;
  },
  unmount() {
    if (host) host.textContent = "";
    host = api = cv = g = S = wet = prev = null; fxp = []; pop = new Map();
  },
};
