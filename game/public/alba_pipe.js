// 일일 아르바이트 · 배관 수리 client (rules: logic 67-alba-pipe.js; contract: public/alba.js). One canvas: the 12×12 site on the left (the water comes in at the
// left edge and must leave at the right edge), the hand piece, the next three, the site clock, [버리기] and [건너뛰기] on the right.
// View from the server: [site n, inlet row, outlet row, 144-char board, hand + next three (hex), ms to open, ms to end, trashed, last site's end].
// Tap an empty cell to put the hand piece there (drawn at once, the server's next state corrects it). Pieces are 4-bit masks: N 1 · E 2 · S 4 · W 8.
const CS = 26, BX = 14, BY = 2, PX = 340, CW = 450, CH = 316;   // cell, board origin, panel x, canvas size (logical pixels, scaled by CSS without smoothing)
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const COL = {
  bg: "#171a22", ol: "#10131a", f1: "#272c38", f2: "#2c3240", f3: "#1f232d",
  dry: ["#5b6372", "#8a93a4", "#c3cbd8"], wet: ["#1f63b0", "#3a8fe6", "#9cd4ff"], rock: ["#3b3f4a", "#5a5f6c", "#7b8190", "#9aa1b0"],
  ok: "#7be08a", bad: "#ff6a5a", txt: "#f0f2f8", dim: "#9aa3b6", btn: "#465069", btnHi: "#7a88a6", btnLo: "#262c3c",
};
const FONT = (px, bold = true) => `${bold ? "bold " : ""}${px}px Galmuri11, "Malgun Gothic", sans-serif`;
const MSG = { 1: ["수리 완료!", COL.ok], 2: ["누수! 막다른 길", COL.bad], 3: ["시간 초과", COL.bad], 4: ["건너뜀", COL.dim] };

let host = null, api = null, cv = null, g = null;
let S = null, wet = null, prev = null, hover = -1, skipArmed = 0, tiles = null, flash = 0;
const BTN = { trash: [PX + 4, 176, 102, 34], skip: [PX + 4, 218, 102, 26] };

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
  tiles.floor = [COL.f1, COL.f2].map((c) => mkTile((q) => { q.fillStyle = c; q.fillRect(0, 0, CS, CS); q.fillStyle = COL.f3; q.fillRect(0, CS - 1, CS, 1); q.fillRect(CS - 1, 0, 1, CS); }));
  tiles.rock = mkTile((q) => {
    const [a, b, c, d] = COL.rock;
    q.fillStyle = a; q.fillRect(4, 9, 18, 14); q.fillRect(6, 6, 14, 3); q.fillRect(2, 13, 22, 7);
    q.fillStyle = b; q.fillRect(5, 10, 16, 12); q.fillRect(7, 7, 12, 3); q.fillRect(3, 14, 20, 5);
    q.fillStyle = c; q.fillRect(7, 8, 8, 3); q.fillRect(5, 12, 5, 4);
    q.fillStyle = d; q.fillRect(8, 8, 4, 2); q.fillRect(6, 12, 2, 2);
    q.fillStyle = a; q.fillRect(14, 15, 2, 6); q.fillRect(16, 19, 4, 2);
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
  api.act({ c });
}
function trash() {
  if (!S || performance.now() < S.goAt || !S.q.length) return;
  S.q.shift(); flash = performance.now();
  api.act({ tr: 1 });
}
function skip() {
  if (!S) return;
  const t = performance.now();
  if (t < skipArmed) { skipArmed = 0; api.act({ sk: 1 }); return; }
  skipArmed = t + 2000;
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
  g.fillStyle = armed ? "#a04a3a" : COL.btn; g.fillRect(x, y, w, h);
  g.fillStyle = COL.btnHi; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, h);
  g.fillStyle = COL.btnLo; g.fillRect(x, y + h - 2, w, 2); g.fillRect(x + w - 2, y, 2, h);
  text(label, x + w / 2, y + (sub ? 15 : h / 2 + 4), COL.txt, 12, "center");
  if (sub) text(sub, x + w / 2, y + 28, COL.dim, 10, "center", false);
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

function drawBoard(d, t, live) {
  const T = getTiles(), w = trace(d.b, d.ir, d.or), wetSet = new Set(w.cells);
  for (let c = 0; c < 144; c++) {
    const [x, y] = boardAt(c), m = d.b[c];
    g.drawImage(T.floor[((c % 12) + ((c / 12) | 0)) & 1], x, y);
    if (m === 255) g.drawImage(T.rock, x, y);
    else if (m) g.drawImage(wetSet.has(c) ? T.wet[m] : T.dry[m], x, y);
  }
  // the inlet and the outlet: a pipe stub out of the board, wet at the inlet
  const iy = BY + d.ir * CS, oy = BY + d.or * CS;
  g.drawImage(T.wet[10], 0, 0, 14, CS, 0, iy, 14, CS);
  g.drawImage(w.r === 1 ? T.wet[10] : T.dry[10], 12, 0, 14, CS, BX + 12 * CS, oy, 14, CS);
  arrow(11, iy + 13, 1, 0, COL.wet[2]); arrow(BX + 12 * CS + 11, oy + 13, 1, 0, w.r === 1 ? COL.wet[2] : COL.dim);
  // the water's flow: a light wave along the wet pipe
  for (let k = 0; k < w.cells.length; k++) {
    const [x, y] = boardAt(w.cells[k]), a = 0.5 + 0.5 * Math.sin(t / 120 - k * 0.9);
    g.globalAlpha = 0.35 + 0.5 * a; g.fillStyle = COL.wet[2]; g.fillRect(x + 11, y + 11, 4, 4);
  }
  g.globalAlpha = 1;
  if (live && w.r === 0) {   // where the water waits
    const [x, y] = boardAt(w.y * 12 + w.x), pulse = 0.5 + 0.5 * Math.sin(t / 160);
    g.globalAlpha = 0.45 + 0.5 * pulse; g.strokeStyle = COL.wet[2]; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, CS - 2, CS - 2);
    g.fillStyle = COL.wet[2]; g.globalAlpha = 0.18 + 0.2 * pulse; g.fillRect(x + 2, y + 2, CS - 4, CS - 4); g.globalAlpha = 1;
    const inward = (w.from + 2) & 3;   // the water comes in through side `from`: the arrow lies near that side and points to the middle
    arrow(x + 13 - DX[inward] * 2, y + 13 - DY[inward] * 2, DX[inward], DY[inward], COL.wet[2]);
  }
  if (!live && w.r === 2) {   // a leak: drops where the water got out
    const px = w.cells.length ? boardAt(w.cells[w.cells.length - 1]) : [BX, iy];
    for (let i = 0; i < 5; i++) { g.globalAlpha = 0.8; g.fillStyle = COL.wet[2]; g.fillRect(px[0] + 6 + ((i * 7 + Math.floor(t / 90)) % 14), px[1] + 4 + ((i * 5 + Math.floor(t / 70)) % 18), 3, 3); }
    g.globalAlpha = 1;
  }
}

function panel(t, info) {
  g.fillStyle = "#1e222c"; g.fillRect(PX - 2, 0, CW - PX + 2, CH);
  g.fillStyle = COL.ol; g.fillRect(PX - 3, 0, 1, CH);
  if (!S) return;
  text(`현장 ${S.n}`, PX + 55, 16, COL.txt, 13, "center");
  // the site clock
  const left = Math.max(0, S.te - t), frac = Math.min(1, left / S.span), c = frac > 0.4 ? COL.ok : frac > 0.2 ? "#ffd84a" : COL.bad;
  g.fillStyle = COL.ol; g.fillRect(PX + 3, 24, 104, 12);
  g.fillStyle = "#313746"; g.fillRect(PX + 4, 25, 102, 10);
  if (frac > 0.2 || Math.floor(t / 250) % 2) { g.fillStyle = c; g.fillRect(PX + 4, 25, Math.round(102 * frac), 10); }
  text(`${Math.ceil(left / 1000)}초`, PX + 55, 50, COL.txt, 11, "center");
  // the hand and the queue
  text("손패", PX + 55, 66, COL.dim, 10, "center", false);
  const T = getTiles();
  g.fillStyle = COL.ol; g.fillRect(PX + 26, 70, 56, 56);
  g.fillStyle = "#2a3040"; g.fillRect(PX + 27, 71, 54, 54);
  if (S.q.length) g.drawImage(T.dry[S.q[0]], 0, 0, CS, CS, PX + 28, 72, 52, 52);
  text("다음", PX + 55, 140, COL.dim, 10, "center", false);
  for (let i = 1; i < 4 && i < S.q.length; i++) g.drawImage(T.dry[S.q[i]], PX + 4 + (i - 1) * 35, 146, 26, 26);
  g.globalAlpha = 1;
  const hot = performance.now() - flash < 250;
  button(BTN.trash, "버리기 [T]", "−3초 · 보너스 없음", hot);
  button(BTN.skip, t < skipArmed ? "정말 건너뛸까요?" : "건너뛰기", "", t < skipArmed);
  text("물이 멈춘 빈 칸에 맞는", PX + 55, 262, COL.dim, 9, "center", false);
  text("조각을 이어 놓으세요", PX + 55, 274, COL.dim, 9, "center", false);
  text("안 맞는 조각은 구석에", PX + 55, 290, COL.dim, 9, "center", false);
  text("두거나 버리세요", PX + 55, 302, COL.dim, 9, "center", false);
}

export default {
  mount(h, a) {
    host = h; api = a;
    host.textContent = "";
    cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    cv.style.cssText = "display:block;width:100%;max-width:900px;height:auto;margin:0 auto;image-rendering:pixelated;touch-action:none;cursor:pointer";
    g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    host.append(cv);
    S = null; wet = null; prev = null; hover = -1; skipArmed = 0;
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
      if (n.lr !== 4) api.fx(n.lr === 1 ? (S.tr ? "good" : "big") : "bad", (MSG[n.lr] || [""])[0], 190, 36);
    }
    if (S && n.n === S.n) n.span = S.span;   // a trash shortens the clock, not the bar's scale
    S = n;
    skipArmed = 0;
    refresh();
  },
  frame(t, info) {
    if (!g) return;
    g.fillStyle = COL.bg; g.fillRect(0, 0, CW, CH);
    if (!S) return;
    const showPrev = prev && t < prev.until;
    drawBoard(showPrev ? prev : S, t, !showPrev && info.phase === "run" && t >= S.goAt);
    if (!showPrev && info.phase === "run" && hover >= 0 && S.b[hover] === 0 && S.q.length && t >= S.goAt) {   // where the hand piece would go
      const [x, y] = boardAt(hover);
      g.globalAlpha = 0.6; g.drawImage(getTiles().dry[S.q[0]], x, y); g.globalAlpha = 1;
      g.strokeStyle = COL.txt; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, CS - 1, CS - 1);
    }
    panel(t, info);
    // banners over the board
    let head = "", sub = "", col = COL.txt;
    if (info.phase === "brief") { head = "곧 시작합니다"; sub = "왼쪽 급수구에서 오른쪽 배수구까지 길을 이으세요"; }
    else if (showPrev) { [head, col] = MSG[S.lr] || ["", COL.txt]; sub = `현장 ${S.n}`; }
    else if (info.phase === "end") { head = "수고하셨어요"; sub = ""; }
    else if (t < S.goAt) { head = `현장 ${S.n}`; }
    if (head) {
      g.globalAlpha = 0.72; g.fillStyle = "#0b0d12"; g.fillRect(BX, BY + 108, 12 * CS, sub ? 64 : 46); g.globalAlpha = 1;
      text(head, BX + 6 * CS, BY + 140, col, 20, "center");
      if (sub) text(sub, BX + 6 * CS, BY + 162, COL.dim, 11, "center", false);
    }
  },
  key(e) {
    if (e.key === "t" || e.key === "T" || e.key === "ㅅ") { trash(); return true; }
    return false;
  },
  unmount() {
    if (host) host.textContent = "";
    host = api = cv = g = S = wet = prev = null;
  },
};
