// 일일 아르바이트 · 편의점 아르바이트 client (rules: logic 67-alba-store.js; contract: public/alba.js). One canvas, four lane cards side by side (the fourth opens for the
// last 30 s rush). In a card: the customer (face, kind, patience), the money she handed over and the total of what is scanned, her items (tap = scan, any order),
// the tray of change, and a pad of coins and bills (100 · 500 · 1000 · 5000 won). Change = 받은 돈 − 합계; the tray empties itself when it goes over.
// View from the server: [lane ×4]; a lane is 0 or [customer id, kind (0 plain · 1 진상 · 2 단체 · 3 VIP), item prices (hundreds of won), scanned bitmask, paid, tray, ms until she leaves, patience ms, changed-her-mind].
const LW = 120, CW = LW * 4, CH = 312, PAD = [1, 5, 10, 50];
const COL = {
  bg: "#151921", card: "#242b38", cardLo: "#1b2029", edge: "#10131a", lock: "#1a1e26", txt: "#f0f2f8", dim: "#8f99ad", gold: "#ffd84a", ok: "#7be08a", bad: "#ff6a5a", blue: "#7cc4ff",
  btn: "#465069", btnHi: "#7a88a6", btnLo: "#262c3c", scan: "#2f5a3e",
};
const KIND = ["손님", "진상", "단체", "VIP"], KCOL = ["#b8c4d8", "#ff8a6a", "#9ad0ff", "#ffd84a"];
const FONT = (px, bold = true) => `${bold ? "bold " : ""}${px}px Galmuri11, "Malgun Gothic", sans-serif`;
const won = (h) => `${(h * 100).toLocaleString()}원`;
const COIN = [["100", "#c9ced8", 0], ["500", "#f0e6a0", 0], ["1천", "#6aa0e0", 1], ["5천", "#e0a060", 1]];   // label, colour, 1 = a bill

let host = null, api = null, cv = null, g = null;
let lanes = [null, null, null, null], prevScore = 0, ended = [], slipAt = [0, 0, 0, 0], clearAt = [0, 0, 0, 0], bump = [0, 0, 0, 0], lastInfo = null;

// ── input geometry (one card = x0 .. x0 + LW)
const ITEM = { x: 4, y: 82, w: 36, h: 22, dx: 38, dy: 24, cols: 3 };
const PADBOX = { x: 3, y: 212, w: 56, h: 26, dx: 58, dy: 30 };
const CLEAR = { x: 4, y: 274, w: 112, h: 16 };
const hit = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

function tap(lane, x, y, info) {
  const c = lanes[lane];
  if (!c || info.phase !== "run") return;
  for (let i = 0; i < c.it.length; i++) {
    const r = { x: ITEM.x + (i % ITEM.cols) * ITEM.dx, y: ITEM.y + Math.floor(i / ITEM.cols) * ITEM.dy, w: ITEM.w, h: ITEM.h };
    if (hit(x, y, r)) {
      if (c.sc & (1 << i)) return;
      c.sc = info.fever > 0 ? (1 << c.it.length) - 1 : c.sc | (1 << i);   // drawn at once; the server's next state corrects it
      bump[lane] = performance.now();
      api.act({ s: lane, i });
      return;
    }
  }
  for (let v = 0; v < 4; v++) {
    if (hit(x, y, { x: PADBOX.x + (v % 2) * PADBOX.dx, y: PADBOX.y + Math.floor(v / 2) * PADBOX.dy, w: PADBOX.w, h: PADBOX.h })) {
      if (c.sc !== (1 << c.it.length) - 1) { bump[lane] = -performance.now(); return; }   // not scanned yet: shake the pad
      if (!(c.kind === 1 && !c.ch)) c.tray += PAD[v];
      bump[lane] = performance.now();
      api.act({ p: lane, v });
      return;
    }
  }
  if (hit(x, y, CLEAR) && c.tray) { c.tray = 0; clearAt[lane] = performance.now(); api.act({ cl: lane }); }
}

// ── art
function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function text(s, x, y, color, px, align = "left", bold = true) { g.font = FONT(px, bold); g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(s, x, y); }
function button(x, y, w, h, fill, pressed) {
  R(x - 1, y - 1, w + 2, h + 2, COL.edge); R(x, y, w, h, fill);
  R(x, y, w, 2, pressed ? COL.btnLo : COL.btnHi); R(x, y, 2, h, pressed ? COL.btnLo : COL.btnHi);
  R(x, y + h - 2, w, 2, pressed ? COL.btnHi : COL.btnLo); R(x + w - 2, y, 2, h, pressed ? COL.btnHi : COL.btnLo);
}
function itemIcon(x, y, kind, done) {   // 12×12: a can, a bottle, a loaf or a bag
  const a = done ? "#5d6a62" : ["#d8e0ea", "#7fb8e8", "#d9a15c", "#e86a6a"][kind], b = done ? "#46524a" : ["#8fa0b4", "#4c7fa8", "#a8763a", "#a84a4a"][kind];
  if (kind === 0) { R(x + 2, y + 1, 8, 10, COL.edge); R(x + 3, y + 2, 6, 8, a); R(x + 3, y + 4, 6, 2, b); R(x + 3, y + 2, 2, 8, "#ffffff55"); }
  else if (kind === 1) { R(x + 4, y, 4, 3, COL.edge); R(x + 3, y + 3, 6, 9, COL.edge); R(x + 4, y + 1, 2, 2, b); R(x + 4, y + 4, 4, 7, a); R(x + 4, y + 6, 4, 2, b); }
  else if (kind === 2) { R(x + 1, y + 3, 10, 8, COL.edge); R(x + 2, y + 4, 8, 6, a); R(x + 3, y + 3, 6, 2, b); R(x + 4, y + 6, 1, 2, b); R(x + 7, y + 6, 1, 2, b); }
  else { R(x + 2, y + 1, 8, 11, COL.edge); R(x + 3, y + 3, 6, 8, a); R(x + 3, y + 1, 1, 2, a); R(x + 5, y + 1, 1, 2, a); R(x + 7, y + 1, 1, 2, a); R(x + 8, y + 1, 1, 2, a); R(x + 4, y + 6, 4, 2, b); }
}
function face(x, y, kind, frac, t) {   // 28×28
  const skin = kind === 1 ? "#f0a090" : "#f2cfa8";
  R(x, y + 2, 28, 26, COL.edge); R(x + 1, y + 3, 26, 24, skin); R(x + 1, y + 3, 26, 3, "#ffffff40");
  const sad = frac < 0.25, mid = frac < 0.5;
  R(x + 7, y + 11, 3, 3, COL.edge); R(x + 18, y + 11, 3, 3, COL.edge);
  if (kind === 1) { R(x + 5, y + 8, 6, 2, COL.edge); R(x + 17, y + 8, 6, 2, COL.edge); R(x + 5, y + 14, 4, 2, "#e8604a"); R(x + 19, y + 14, 4, 2, "#e8604a"); }
  if (sad) { R(x + 9, y + 19, 10, 2, COL.edge); R(x + 8, y + 21, 2, 2, COL.edge); R(x + 18, y + 21, 2, 2, COL.edge); R(x + 22, y + 15 + (Math.floor(t / 200) % 2), 2, 3, COL.blue); }
  else if (mid) R(x + 9, y + 20, 10, 2, COL.edge);
  else { R(x + 9, y + 20, 10, 2, COL.edge); R(x + 8, y + 18, 2, 2, COL.edge); R(x + 18, y + 18, 2, 2, COL.edge); }
  if (kind === 3) { R(x + 4, y - 3, 20, 6, COL.edge); R(x + 5, y - 2, 18, 4, COL.gold); R(x + 5, y - 5, 3, 4, COL.gold); R(x + 12, y - 6, 4, 5, COL.gold); R(x + 20, y - 5, 3, 4, COL.gold); }
  if (kind === 2) { R(x - 5, y + 10, 8, 8, "#c9a888"); R(x + 25, y + 10, 8, 8, "#c9a888"); R(x - 3, y + 12, 2, 2, COL.edge); R(x + 29, y + 12, 2, 2, COL.edge); }
}
function coin(x, y, i) {
  const [label, col, bill] = COIN[i];
  if (bill) { R(x, y + 2, 22, 12, COL.edge); R(x + 1, y + 3, 20, 10, col); R(x + 3, y + 5, 6, 6, "#ffffff55"); R(x + 14, y + 4, 5, 2, "#ffffff55"); }
  else { const s = i === 0 ? 11 : 14, o = i === 0 ? 3 : 1; R(x + o + 2, y + o, s - 4, s, COL.edge); R(x + o, y + o + 2, s, s - 4, COL.edge); R(x + o + 2, y + o + 1, s - 4, s - 2, col); R(x + o + 1, y + o + 2, s - 2, s - 4, col); R(x + o + 3, y + o + 3, 3, 3, "#ffffff80"); }
  text(label, x + 25, y + 13, COL.txt, 12);
}

function drawLane(i, t, info) {
  const x0 = i * LW, c = lanes[i];
  g.save(); g.translate(x0, 0);
  R(1, 2, LW - 2, CH - 22, COL.edge); R(2, 3, LW - 4, CH - 24, c ? COL.card : COL.lock);
  if (i === 3 && !info.rush && !c) { text("점심 러시에", LW / 2, 140, COL.dim, 11, "center"); text("열려요", LW / 2, 156, COL.dim, 11, "center"); g.restore(); return; }
  if (!c) {
    text(info.phase === "run" ? "…" : "", LW / 2, 140, COL.dim, 16, "center");
    g.restore(); return;
  }
  const left = Math.max(0, c.leaveAt - t), frac = Math.min(1, left / c.pt), all = (1 << c.it.length) - 1, done = c.sc === all;
  const slide = Math.max(0, 1 - (t - c.born) / 250);   // arrives from the top
  if (slide > 0) g.translate(0, -Math.round(slide * 40));
  if (t - slipAt[i] < 300) { R(2, 3, LW - 4, CH - 24, "#ff6a5a30"); }
  // the customer
  face(8, 10, c.kind, frac, t);
  text(KIND[c.kind], 42, 22, KCOL[c.kind], 12);
  const bc = frac > 0.5 ? COL.ok : frac > 0.25 ? COL.gold : COL.bad;
  R(41, 28, 74, 10, COL.edge); R(42, 29, 72, 8, "#313a4a");
  if (frac > 0.25 || Math.floor(t / 220) % 2) R(42, 29, Math.round(72 * frac), 8, bc);
  text(`${Math.ceil(left / 1000)}초`, 114, 22, COL.dim, 10, "right", false);
  // money
  const sum = c.it.reduce((a, v, k) => a + ((c.sc >> k) & 1 ? v : 0), 0), flash = c.ch && t - c.chAt < 900;
  text("받은 돈", 6, 56, COL.dim, 10, "left", false); text(won(c.paid), 114, 56, flash && Math.floor(t / 120) % 2 ? COL.bad : COL.txt, 12, "right");
  text(done ? "합계" : "스캔 합계", 6, 70, COL.dim, 10, "left", false); text(won(sum), 114, 70, done ? COL.gold : COL.dim, 12, "right");
  // items
  for (let k = 0; k < c.it.length; k++) {
    const x = ITEM.x + (k % ITEM.cols) * ITEM.dx, y = ITEM.y + Math.floor(k / ITEM.cols) * ITEM.dy, sc = (c.sc >> k) & 1;
    button(x, y, ITEM.w, ITEM.h, sc ? COL.scan : COL.btn, sc);
    itemIcon(x + 2, y + 5, (c.id * 3 + k) % 4, sc);
    text(String(c.it[k] * 100), x + ITEM.w - 3, y + 15, sc ? "#8fb89a" : COL.txt, 9, "right");
  }
  // the change
  text("내준 돈", 6, 196, COL.dim, 10, "left", false); text(won(c.tray), 114, 196, c.tray ? COL.gold : COL.dim, 12, "right");
  const shake = bump[i] < 0 && t + bump[i] < 250 ? Math.sin(t / 25) * 2 : 0;
  for (let v = 0; v < 4; v++) {
    const x = PADBOX.x + (v % 2) * PADBOX.dx + shake, y = PADBOX.y + Math.floor(v / 2) * PADBOX.dy;
    g.globalAlpha = done ? 1 : 0.4;
    button(x, y, PADBOX.w, PADBOX.h, COL.btn, false);
    coin(x + 4, y + 2, v);
    g.globalAlpha = 1;
  }
  button(CLEAR.x, CLEAR.y, CLEAR.w, CLEAR.h, c.tray ? COL.btn : "#2a3040", false);
  text("비우기", LW / 2, CLEAR.y + 12, c.tray ? COL.txt : COL.dim, 10, "center");
  g.restore();
}

export default {
  mount(h, a) {
    host = h; api = a;
    host.textContent = "";
    cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    cv.style.cssText = "display:block;width:100%;max-width:960px;height:auto;margin:0 auto;image-rendering:pixelated;touch-action:none;cursor:pointer";
    g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    host.append(cv);
    lanes = [null, null, null, null]; prevScore = 0; ended = []; lastInfo = null;
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!lastInfo) return;
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * CW) / r.width, y = ((e.clientY - r.top) * CH) / r.height, lane = Math.floor(x / LW);
      if (lane >= 0 && lane < 4) tap(lane, x - lane * LW, y, lastInfo);
    });
  },
  setState(v, recvAt) {
    const prev = lanes;
    lanes = v.map((c, i) => {
      if (!c) return null;
      const [id, kind, it, sc, paid, tray, leaveMs, pt, ch] = c, old = prev[i] && prev[i].id === id ? prev[i] : null;
      if (old && old.tray > 0 && tray === 0 && ch === old.ch && recvAt - clearAt[i] > 700) slipAt[i] = performance.now();   // the change went over: the tray was emptied
      return { id, kind, it, sc, paid, tray, leaveAt: recvAt + leaveMs, pt, ch, born: old ? old.born : performance.now(), chAt: old && old.ch === ch ? old.chAt : ch ? performance.now() : 0 };
    });
    for (let i = 0; i < 4; i++) if (prev[i] && (!lanes[i] || lanes[i].id !== prev[i].id)) ended.push([i, prev[i].kind]);   // judged at the next frame, when the score is known
    if (lanes.some((c, i) => c && prev[i] && c.id === prev[i].id && c.ch && !prev[i].ch)) api.fx("bad", "진상 손님이 마음을 바꿨어요!", 190, 40);
  },
  frame(t, info) {
    if (!g) return;
    lastInfo = info;
    if (ended.length) {
      const d = info.score - prevScore;
      for (const [i, kind] of ended) api.fx(d > 0 ? (kind === 2 || kind === 3 ? "big" : "good") : "bad", d > 0 ? `+${d}` : "손님이 떠났어요", 60 + i * 100, 40);
      ended = [];
    }
    prevScore = info.score;
    g.fillStyle = COL.bg; g.fillRect(0, 0, CW, CH);
    for (let i = 0; i < 4; i++) drawLane(i, t, info);
    text("받은 돈 − 합계 = 거스름돈 · 맞게 내주면 손님이 떠나요 · 넘치면 비워져요", CW / 2, CH - 6, COL.dim, 9, "center", false);
    if (info.phase === "brief") {
      g.globalAlpha = 0.78; g.fillStyle = "#0b0d12"; g.fillRect(40, 100, CW - 80, 80); g.globalAlpha = 1;
      text("곧 시작합니다", CW / 2, 134, COL.txt, 20, "center");
      text("① 물건을 눌러 스캔  ② 받은 돈 − 합계 만큼 돈을 눌러 거스름돈", CW / 2, 158, COL.dim, 11, "center", false);
      text("가장 급한(막대가 짧은) 손님부터!", CW / 2, 172, COL.dim, 11, "center", false);
    }
  },
  unmount() {
    if (host) host.textContent = "";
    host = api = cv = g = lastInfo = null;
    lanes = [null, null, null, null];
  },
};
