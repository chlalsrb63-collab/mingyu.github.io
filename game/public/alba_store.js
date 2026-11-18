// 일일 아르바이트 · 편의점 아르바이트 client (rules: logic 67-alba-store.js; contract: public/alba.js). One canvas, four lane cards side by side (the fourth opens for the
// last 30 s rush). In a card: the customer (face, kind, patience), the money she handed over and the total of what is scanned, her items (tap = scan, any order),
// the tray of change, and a pad of coins and bills (100 · 500 · 1000 · 5000 won). Change = 받은 돈 − 합계; the tray empties itself when it goes over.
// View from the server: [lane ×4]; a lane is 0 or [customer id, kind (0 plain · 1 진상 · 2 단체 · 3 VIP), item prices (hundreds of won), scanned bitmask, paid, tray, ms until she leaves, patience ms, changed-her-mind].
// Look: a mint shop, cream counter cards, round little customers. Sounds: ding (scan, a customer walks in), coin (change), chime (all scanned), buzz (wrong), swish (clear).
const LW = 120, CW = LW * 4, CH = 312, PAD = [1, 5, 10, 50];
const COL = {
  bg: "#8fd4c0", bg2: "#9fdccb", card: "#fff6e0", cardLo: "#d8e8dc", belt: "#f2e0b4", edge: "#4a3a3a", lock: "#c6d8cc", txt: "#3a2e3a", dim: "#7a6a62", gold: "#c88a10", goldHi: "#ffd84a",
  ok: "#3fae62", bad: "#e8554a", blue: "#5aa8f0", paper: "#fffef6",
  btn: "#ffd98a", btnHi: "#fff2c4", btnLo: "#d9a850", scan: "#a8dca8", scanHi: "#d4f2d4", scanLo: "#78b078",
};
const KIND = ["손님", "진상", "단체", "VIP"], KCOL = ["#4a7aa8", "#d8453a", "#3a78c8", "#b8800a"], KBG = ["#d4eaf8", "#ffd4c4", "#dcecff", "#fff0b4"];
const SKIN = ["#f6d4b0", "#e8b88c", "#d9a27c", "#fbe0c4"], HAIR = ["#6a4630", "#3a3040", "#e8a040", "#d8607a", "#5a7ac8"];
const FONT = (px, bold = true) => `${bold ? "bold " : ""}${px}px Galmuri11, "Malgun Gothic", sans-serif`;
const won = (h) => `${(h * 100).toLocaleString()}원`;
const COIN = [["100", "#d8dce4", 0], ["500", "#ffe27a", 0], ["1천", "#8ac0f0", 1], ["5천", "#f0b070", 1]];   // label, colour, 1 = a bill

let host = null, api = null, cv = null, g = null;
let lanes = [null, null, null, null], prevScore = 0, ended = [], slipAt = [0, 0, 0, 0], clearAt = [0, 0, 0, 0], bump = [0, 0, 0, 0], lastInfo = null;
let fxp = [], lastT = 0, lastS = {};

/** A sound, throttled so a fast tapper never spams it. */
function snd(n, gap = 60) { const t = performance.now(); if (api && t - (lastS[n] || 0) >= gap) { lastS[n] = t; api.sfx(n); } }
function burst(x, y, n, cols, spd = 40, up = 50) {
  for (let i = 0; i < n; i++) fxp.push({ x, y, vx: (Math.random() - 0.5) * spd * 2, vy: -Math.random() * up - 14, life: 0.4 + Math.random() * 0.35, col: cols[i % cols.length] });
  if (fxp.length > 100) fxp.splice(0, fxp.length - 100);
}

// ── input geometry (one card = x0 .. x0 + LW)
const ITEM = { x: 4, y: 82, w: 36, h: 22, dx: 38, dy: 24, cols: 3 };
const PADBOX = { x: 3, y: 212, w: 56, h: 26, dx: 58, dy: 30 };
const CLEAR = { x: 4, y: 272, w: 112, h: 19 };
const hit = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

function tap(lane, x, y, info) {
  const c = lanes[lane];
  if (!c || info.phase !== "run") return;
  const ox = lane * LW;
  for (let i = 0; i < c.it.length; i++) {
    const r = { x: ITEM.x + (i % ITEM.cols) * ITEM.dx, y: ITEM.y + Math.floor(i / ITEM.cols) * ITEM.dy, w: ITEM.w, h: ITEM.h };
    if (hit(x, y, r)) {
      if (c.sc & (1 << i)) return;
      const all = (1 << c.it.length) - 1;
      c.sc = info.fever > 0 ? all : c.sc | (1 << i);   // drawn at once; the server's next state corrects it
      bump[lane] = performance.now();
      burst(ox + r.x + r.w / 2, r.y + 6, 5, ["#ffffff", "#fff2a8", "#a8dca8"], 28, 30);
      snd("alba_ding", 40);
      if (c.sc === all) snd("alba_chime", 120);   // everything is scanned: the pad wakes up
      api.act({ s: lane, i });
      return;
    }
  }
  for (let v = 0; v < 4; v++) {
    const r = { x: PADBOX.x + (v % 2) * PADBOX.dx, y: PADBOX.y + Math.floor(v / 2) * PADBOX.dy, w: PADBOX.w, h: PADBOX.h };
    if (hit(x, y, r)) {
      if (c.sc !== (1 << c.it.length) - 1) { bump[lane] = -performance.now(); snd("alba_buzz", 200); return; }   // not scanned yet: shake the pad
      if (!(c.kind === 1 && !c.ch)) c.tray += PAD[v];
      bump[lane] = performance.now();
      burst(ox + r.x + r.w / 2, r.y + 4, 4, [COIN[v][1], "#ffffff", "#ffd84a"], 24, 34);
      snd("alba_coin", 50);
      api.act({ p: lane, v });
      return;
    }
  }
  if (hit(x, y, CLEAR) && c.tray) { c.tray = 0; clearAt[lane] = performance.now(); snd("alba_swish", 120); api.act({ cl: lane }); }
}

// ── art
function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function text(s, x, y, color, px, align = "left", bold = true) { g.font = FONT(px, bold); g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(s, x, y); }
function button(x, y, w, h, fill, hi, lo, pressed) {
  R(x - 1, y - 1, w + 2, h + 2, COL.edge); R(x, y, w, h, fill);
  R(x, y, w, 2, pressed ? lo : hi); R(x, y, 2, h, pressed ? lo : hi);
  R(x, y + h - 2, w, 2, pressed ? hi : lo); R(x + w - 2, y, 2, h, pressed ? hi : lo);
}
const ICON = [["#ee5a5a", "#b03a3a"], ["#7ab4f4", "#3a78c0"], ["#eaa850", "#b87830"], ["#f8d048", "#c89820"]];
function itemIcon(x, y, kind, done) {   // 12×12: a can, a bottle, a loaf or a bag
  const a = done ? "#c4d0c4" : ICON[kind][0], b = done ? "#a0b0a0" : ICON[kind][1], E = done ? "#8a9a8a" : COL.edge;
  if (kind === 0) { R(x + 2, y + 1, 8, 10, E); R(x + 3, y + 2, 6, 8, a); R(x + 3, y + 4, 6, 2, "#ffffff"); R(x + 3, y + 8, 6, 2, b); R(x + 3, y + 2, 1, 8, "#ffffff80"); }
  else if (kind === 1) { R(x + 4, y, 4, 3, E); R(x + 3, y + 3, 6, 9, E); R(x + 4, y + 1, 2, 2, "#ffffff"); R(x + 4, y + 4, 4, 7, a); R(x + 4, y + 6, 4, 2, "#ffffff"); R(x + 4, y + 9, 4, 2, b); }
  else if (kind === 2) { R(x + 1, y + 3, 10, 8, E); R(x + 2, y + 4, 8, 6, a); R(x + 3, y + 3, 6, 2, "#ffe0a0"); R(x + 4, y + 6, 1, 2, b); R(x + 7, y + 6, 1, 2, b); }
  else { R(x + 2, y + 1, 8, 11, E); R(x + 3, y + 3, 6, 8, a); R(x + 3, y + 1, 1, 2, a); R(x + 5, y + 1, 1, 2, a); R(x + 7, y + 1, 1, 2, a); R(x + 8, y + 1, 1, 2, a); R(x + 4, y + 6, 4, 2, "#ee5a5a"); }
  if (done) { R(x + 8, y - 2, 2, 5, COL.ok); R(x + 6, y + 2, 3, 2, COL.ok); R(x + 5, y + 3, 2, 1, COL.ok); }   // a check mark
}
function face(x, y, kind, frac, t, id) {   // 28×28 plus hair
  const skin = kind === 1 ? "#f6a090" : SKIN[id % 4], hair = HAIR[(id * 3 + 1) % 5], E = COL.edge;
  y += Math.round(Math.sin(t / 380 + id) * 1);
  if (kind === 2) for (const sx of [-6, 26]) { R(sx, y + 12, 8, 9, E); R(sx + 1, y + 13, 6, 7, SKIN[(id + 1) % 4]); R(sx + 2, y + 15, 1, 2, E); R(sx + 5, y + 15, 1, 2, E); }
  R(x, y + 2, 28, 26, E); R(x + 1, y + 3, 26, 24, skin); R(x + 1, y + 24, 26, 3, "#00000018");
  R(x + 1, y + 3, 26, 6, hair); R(x + 1, y + 9, 4, 4, hair); R(x + 23, y + 9, 4, 4, hair); R(x + 3, y + 4, 8, 2, "#ffffff50");
  if (id % 2) { R(x + 9, y + 9, 10, 2, hair); R(x + 12, y + 11, 4, 1, hair); }
  const blink = (t + id * 700) % 3300 < 110, sad = frac < 0.25, mid = frac < 0.5, ey = y + 13;
  R(x + 7, ey + (blink ? 1 : 0), 3, blink ? 1 : 3, E); R(x + 18, ey + (blink ? 1 : 0), 3, blink ? 1 : 3, E);
  if (!blink) { R(x + 7, ey, 1, 1, "#ffffff"); R(x + 18, ey, 1, 1, "#ffffff"); }
  R(x + 4, y + 18, 4, 2, "#ff9aa0"); R(x + 20, y + 18, 4, 2, "#ff9aa0");
  if (kind === 1) { R(x + 5, y + 9, 5, 2, E); R(x + 6, y + 11, 2, 1, E); R(x + 18, y + 9, 5, 2, E); R(x + 20, y + 11, 2, 1, E); if (Math.floor(t / 260) % 2) { R(x + 22, y - 1, 5, 1, COL.bad); R(x + 24, y - 3, 1, 5, COL.bad); } }
  if (sad) { R(x + 11, y + 21, 6, 1, E); R(x + 9, y + 22, 2, 1, E); R(x + 17, y + 22, 2, 1, E); R(x + 23, y + 15 + (Math.floor(t / 200) % 3), 2, 3, COL.blue); }
  else if (mid) R(x + 10, y + 21, 8, 1, E);
  else { R(x + 9, y + 20, 2, 1, E); R(x + 11, y + 21, 6, 1, E); R(x + 17, y + 20, 2, 1, E); }
  if (kind === 3) { R(x + 3, y - 3, 22, 7, E); R(x + 4, y - 2, 20, 5, COL.goldHi); R(x + 4, y - 6, 4, 5, E); R(x + 5, y - 5, 2, 4, COL.goldHi); R(x + 12, y - 7, 4, 6, E); R(x + 13, y - 6, 2, 5, COL.goldHi); R(x + 20, y - 6, 4, 5, E); R(x + 21, y - 5, 2, 4, COL.goldHi); R(x + 11, y - 1, 6, 2, COL.bad); }
}
function coin(x, y, i) {
  const [label, col, bill] = COIN[i], E = COL.edge;
  if (bill) { R(x, y + 2, 22, 12, E); R(x + 1, y + 3, 20, 10, col); R(x + 3, y + 5, 6, 6, "#ffffffa0"); R(x + 14, y + 4, 5, 2, "#ffffffa0"); R(x + 14, y + 10, 5, 2, "#00000020"); }
  else { const s = i === 0 ? 11 : 14, o = i === 0 ? 3 : 1; R(x + o + 2, y + o, s - 4, s, E); R(x + o, y + o + 2, s, s - 4, E); R(x + o + 2, y + o + 1, s - 4, s - 2, col); R(x + o + 1, y + o + 2, s - 2, s - 4, col); R(x + o + 3, y + o + 3, 3, 3, "#ffffffb0"); }
  text(label, x + 25, y + 13, COL.txt, 12);
}

function drawLane(i, t, info) {
  const x0 = i * LW, c = lanes[i], E = COL.edge;
  g.save(); g.translate(x0, 0);
  R(1, 2, LW - 2, CH - 22, E); R(2, 3, LW - 4, CH - 24, c ? COL.card : COL.lock);
  if (i === 3 && !info.rush && !c) {   // the shutter is down until the lunch rush
    for (let y = 6; y < CH - 26; y += 8) { R(4, y, LW - 8, 5, "#b0c4b8"); R(4, y, LW - 8, 1, "#d8e8de"); }
    R(14, 118, LW - 28, 50, E); R(16, 120, LW - 32, 46, COL.card);
    text("점심 러시에", LW / 2, 140, COL.txt, 11, "center"); text("열려요", LW / 2, 156, COL.txt, 11, "center"); g.restore(); return;
  }
  if (!c) {
    text(info.phase === "run" ? "…" : "", LW / 2, 140, COL.dim, 16, "center");
    g.restore(); return;
  }
  const left = Math.max(0, c.leaveAt - t), frac = Math.min(1, left / c.pt), all = (1 << c.it.length) - 1, done = c.sc === all;
  const slide = Math.max(0, 1 - (t - c.born) / 250);   // arrives from the top
  if (slide > 0) g.translate(0, -Math.round(slide * 40));
  R(2, 3, LW - 4, 41, KBG[c.kind]);   // the header tint tells the kind at a glance
  R(2, 44, LW - 4, 1, E);
  R(2, 78, LW - 4, 88, COL.belt); R(2, 78, LW - 4, 1, "#d8c088"); R(2, 166, LW - 4, 1, "#d8c088");
  if (t - slipAt[i] < 300) R(2, 3, LW - 4, CH - 24, "#ff6a5a55");
  // the customer
  face(8, 10, c.kind, frac, t, c.id);
  text(KIND[c.kind], 44, 21, KCOL[c.kind], 12);
  const bc = frac > 0.5 ? COL.ok : frac > 0.25 ? "#f0b82a" : COL.bad;
  R(43, 27, 72, 12, E); R(44, 28, 70, 10, "#e8dcc4");
  if (frac > 0.25 || Math.floor(t / 220) % 2) { R(44, 28, Math.round(70 * frac), 10, bc); R(44, 28, Math.round(70 * frac), 2, "#ffffff70"); }
  text(`${Math.ceil(left / 1000)}초`, 79, 37, frac > 0.25 ? COL.txt : "#ffffff", 10, "center");
  // money: a receipt
  R(3, 47, LW - 6, 29, E); R(4, 48, LW - 8, 27, COL.paper);
  for (let k = 0; k < LW - 8; k += 4) R(4 + k, 75, 2, 1, "#c8b890");
  const sum = c.it.reduce((a, v, k) => a + ((c.sc >> k) & 1 ? v : 0), 0), flash = c.ch && t - c.chAt < 900;
  text("받은 돈", 7, 60, COL.dim, 10, "left", false); text(won(c.paid), 113, 60, flash && Math.floor(t / 120) % 2 ? COL.bad : COL.txt, 12, "right");
  text(done ? "합계" : "스캔 합계", 7, 72, COL.dim, 10, "left", false); text(won(sum), 113, 72, done ? COL.gold : COL.dim, 12, "right");
  // items
  for (let k = 0; k < c.it.length; k++) {
    const x = ITEM.x + (k % ITEM.cols) * ITEM.dx, y = ITEM.y + Math.floor(k / ITEM.cols) * ITEM.dy, sc = (c.sc >> k) & 1;
    button(x, y, ITEM.w, ITEM.h, sc ? COL.scan : COL.btn, sc ? COL.scanHi : COL.btnHi, sc ? COL.scanLo : COL.btnLo, sc);
    itemIcon(x + 2, y + 5, (c.id * 3 + k) % 4, sc);
    text(String(c.it[k] * 100), x + ITEM.w - 3, y + 16, sc ? "#6a8a6a" : COL.txt, 10, "right");
  }
  // the change
  text("내준 돈", 6, 190, COL.dim, 10, "left", false); text(won(c.tray), 114, 190, c.tray ? COL.gold : COL.dim, 12, "right");
  const shake = bump[i] < 0 && t + bump[i] < 250 ? Math.sin(t / 25) * 2 : 0;
  for (let v = 0; v < 4; v++) {
    const x = PADBOX.x + (v % 2) * PADBOX.dx + shake, y = PADBOX.y + Math.floor(v / 2) * PADBOX.dy, down = bump[i] > 0 && t - bump[i] < 90 && c.tray > 0;
    g.globalAlpha = done ? 1 : 0.45;
    button(x, y, PADBOX.w, PADBOX.h, "#fffaf0", "#ffffff", "#cdbf9c", down && v === 0);
    coin(x + 4, y + 2, v);
    g.globalAlpha = 1;
  }
  const hot = c.tray > 0;
  button(CLEAR.x, CLEAR.y, CLEAR.w, CLEAR.h, hot ? "#f4a090" : "#d8dcd0", hot ? "#ffc8b8" : "#eef0e8", hot ? "#c8705a" : "#b0b4a8", t - clearAt[i] < 90);
  text("비우기", LW / 2, CLEAR.y + 14, hot ? COL.txt : COL.dim, 11, "center");
  g.restore();
}

export default {
  mount(h, a) {
    host = h; api = a;
    host.textContent = ""; Object.assign(host.style, { alignSelf: "stretch", background: "#8fd4c0" });
    cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    cv.style.cssText = "display:block;width:100%;max-width:960px;height:auto;margin:0 auto;image-rendering:pixelated;touch-action:none;cursor:pointer";
    g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    host.append(cv);
    lanes = [null, null, null, null]; prevScore = 0; ended = []; lastInfo = null; fxp = []; lastT = 0; lastS = {};
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
      if (old && old.tray > 0 && tray === 0 && ch === old.ch && recvAt - clearAt[i] > 700) { slipAt[i] = performance.now(); snd("alba_buzz", 250); }   // the change went over: the tray was emptied
      if (!old && lastInfo && lastInfo.phase === "run") snd("alba_ding", 400);   // a new customer walks in
      return { id, kind, it, sc, paid, tray, leaveAt: recvAt + leaveMs, pt, ch, born: old ? old.born : performance.now(), chAt: old && old.ch === ch ? old.chAt : ch ? performance.now() : 0 };
    });
    for (let i = 0; i < 4; i++) if (prev[i] && (!lanes[i] || lanes[i].id !== prev[i].id)) ended.push([i, prev[i].kind]);   // judged at the next frame, when the score is known
    if (lanes.some((c, i) => c && prev[i] && c.id === prev[i].id && c.ch && !prev[i].ch)) { api.fx("bad", "진상 손님이 마음을 바꿨어요!", 190, 40); snd("alba_buzz", 250); }
  },
  frame(t, info) {
    if (!g) return;
    lastInfo = info;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    if (ended.length) {
      const d = info.score - prevScore;
      for (const [i, kind] of ended) {
        api.fx(d > 0 ? (kind === 2 || kind === 3 ? "big" : "good") : "bad", d > 0 ? `+${d}` : "손님이 떠났어요", 60 + i * 100, 40);
        if (d > 0) { snd("alba_coin", 80); burst(i * LW + 60, 60, 10, ["#ffd84a", "#fff2a8", "#ffffff"], 40, 60); } else { snd("alba_buzz", 200); burst(i * LW + 60, 60, 6, ["#8a9aa8", "#c4d0d8"], 20, 10); }
      }
      ended = [];
    }
    prevScore = info.score;
    g.setTransform(1, 0, 0, 1, 0, 0);
    R(0, 0, CW, CH, COL.bg);
    for (let x = 0; x < CW; x += 24) R(x, 0, 12, CH, COL.bg2);   // a soft striped wall behind the lanes
    for (let i = 0; i < 4; i++) drawLane(i, t, info);
    R(0, CH - 18, CW, 18, "#79c0ac"); R(0, CH - 18, CW, 1, "#5ea48f");
    text("받은 돈 − 합계 = 거스름돈 · 맞게 내주면 손님이 떠나요 · 넘치면 비워져요", CW / 2, CH - 5, "#24504a", 10, "center", false);
    for (let i = fxp.length - 1; i >= 0; i--) {
      const p = fxp[i]; p.life -= dt;
      if (p.life <= 0) { fxp.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
      g.globalAlpha = Math.min(1, p.life * 3); R(Math.round(p.x), Math.round(p.y), 3, 3, p.col);
    }
    g.globalAlpha = 1;
    if (info.phase === "brief") {
      R(36, 98, CW - 72, 88, COL.edge); R(38, 100, CW - 76, 84, COL.card); R(38, 100, CW - 76, 2, "#ffffff");
      text("곧 시작합니다", CW / 2, 132, COL.txt, 20, "center");
      text("① 물건을 눌러 스캔  ② 받은 돈 − 합계 만큼 돈을 눌러 거스름돈", CW / 2, 156, COL.dim, 11, "center", false);
      text("가장 급한(막대가 짧은) 손님부터!", CW / 2, 172, COL.dim, 11, "center", false);
    }
  },
  unmount() {
    if (host) host.textContent = "";
    host = api = cv = g = lastInfo = null;
    lanes = [null, null, null, null]; fxp = [];
  },
};
