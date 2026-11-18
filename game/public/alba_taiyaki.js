// 일일 아르바이트 · 붕어빵 노점 client (rules: src/logic/67-alba-taiyaki.js, contract: public/alba.js). A 240×198 pixel board at a whole-number scale, no smoothing:
// customer tickets on top, the mould (4×2 slots, the last two open at 2:00), the filling picker, the tray. Tap a slot to take its next step, tap a ticket to serve it.
// view = [open slots, [[stage, filling, quality, ms since the stage began (≤ 0), side ms, z0, z1, z2, z3]…8], [[id, n0, n1, n2, ms patience left, patience ms, group]…], [[filling, quality]…], ms to slot 8]
// Gauges are animated here from those relative times (the server only resends on a change); the green/yellow windows come from the server too.
// Look: a warm street stall — peach wall, wooden counter, slate mould plates, steam. Sounds: pop (batter / filling), snap (cover), sizzle (bake), swish (flip), ding (ready / perfect), coin (served), buzz (wrong).
import { hiRes } from "./alba_stage.js";
const W = 240, H = 198, OL = "#3a2418", CREAM = "#fff4d6", INK = "#5a3a28";
const FILL = ["#a83a4a", "#fff0a0", "#ffa030"], FNAME = ["팥", "슈크림", "치즈"];
const CELL = { x0: 8, y0: 44, w: 56, h: 54 }, BTN = { y: 156, w: 72, h: 18 }, TICKET = { w: 38, h: 38 };
const ROWS = [[[8, 17]], [[0, 2], [6, 20]], [[0, 3], [5, 22]], [[1, 3], [4, 23]], [[2, 3], [4, 24]], [[2, 3], [4, 24]], [[2, 3], [4, 24]], [[2, 3], [4, 24]], [[1, 3], [4, 23]], [[0, 3], [5, 22]], [[0, 2], [6, 20]], [[8, 17]]];
const RING = (() => { const r = []; for (let i = 0; i < 72; i++) { const a = -Math.PI / 2 + (i / 72) * Math.PI * 2; r.push([Math.round(Math.cos(a) * 19), Math.round(Math.sin(a) * 19)]); } return r; })();
let host = null, api = null, cv = null, g = null, scale = 0, recvAt = 0;
let n = 6, slots = [], cust = [], tray = [], exAt = 0, sel = 0, shakes = [], floats = [], last = null, lastScore = 0, running = false, sentAt = 0;
let fxp = [], lastT = 0, lastS = {}, cue = [];

/** A sound, throttled so a fast tapper never spams it. */
function snd(nm, gap = 70) { const t = performance.now(); if (api && t - (lastS[nm] || 0) >= gap) { lastS[nm] = t; api.sfx(nm); } }
function burst(x, y, k, cols, spd = 26, up = 30) {
  for (let i = 0; i < k; i++) fxp.push({ x, y, vx: (Math.random() - 0.5) * spd * 2, vy: -Math.random() * up - 8, life: 0.3 + Math.random() * 0.3, col: cols[i % cols.length] });
  if (fxp.length > 90) fxp.splice(0, fxp.length - 90);
}

/** Size the canvas to the board: a whole-number scale when it is 2× or more, else the largest that fits the width and the height the window leaves (re-measured only when those change). */
let fitKey = "";
function fit(w) {
  const key = `${w}|${innerHeight}`;
  if (key === fitKey) return;
  fitKey = key;
  const box = host.closest(".ap-box"), fixed = box ? box.offsetHeight - host.parentElement.offsetHeight : 260;
  const sc = Math.min(w / W, (innerHeight * 0.96 - fixed - 14) / H), s2 = sc >= 2 ? Math.floor(sc) : Math.max(0.5, sc);
  scale = s2; cv.style.width = `${Math.round(W * s2)}px`; cv.style.height = `${Math.round(H * s2)}px`;
}
const px = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const mix = (a, b, f) => { const q = (s, i) => parseInt(s.slice(i, i + 2), 16); return `rgb(${[1, 3, 5].map((i) => Math.round(q(a, i) + (q(b, i) - q(a, i)) * f)).join(",")})`; };
const BAKE = [[0, "#f6e2a4"], [40, "#ecb858"], [75, "#cc8430"], [100, "#6a3a18"]];
function bakeCol(gp) { for (let i = 1; i < BAKE.length; i++) if (gp <= BAKE[i][0]) return mix(BAKE[i - 1][1], BAKE[i][1], (gp - BAKE[i - 1][0]) / (BAKE[i][0] - BAKE[i - 1][0])); return BAKE[3][1]; }
const cellXY = (i) => [CELL.x0 + (i % 4) * CELL.w, CELL.y0 + Math.floor(i / 4) * CELL.h];
const gaugeOf = (s, t) => ((t - s.at) / s.d) * 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** The window the player should hit in this stage, [from, to] in gauge %, or null. */
const windowOf = (s) => (s.s === 3 ? [s.z[0], s.z[1]] : s.s === 4 ? [s.z[2], s.z[3]] : null);

/** The fish (25×12), `flip` mirrors it (the other side up); outline by four shifted copies, then the fill. */
function fish(x, y, col, flip, edge = OL) {
  const seg = (dx, dy, c) => { g.fillStyle = c; for (let r = 0; r < 12; r++) for (const [a, b] of ROWS[r]) g.fillRect(x + (flip ? 24 - b : a) + dx, y + r + dy, b - a + 1, 1); };
  seg(-1, 0, edge); seg(1, 0, edge); seg(0, -1, edge); seg(0, 1, edge); seg(0, 0, col);
  const ex = flip ? 3 : 20, d = flip ? 1 : -1;
  px(OL, x + ex, y + 4, 2, 2); px("#ffffff", x + ex, y + 4, 1, 1);                // the eye
  g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(x + (flip ? 8 : 16), y + 3, 1, 5);   // the gill
  g.fillStyle = "rgba(255,255,255,.34)"; g.fillRect(x + 11, y + 3, 2, 1); g.fillRect(x + 14, y + 6, 2, 1); g.fillRect(x + 9 + d, y + 8, 2, 1);   // scales
}
function ring(cx, cy, s, t) {
  const gp = clamp(gaugeOf(s, t), 0, 100), a = s.s === 3 ? [s.z[0], s.z[1], "#3f9a4a", "#7dff7d"] : [s.z[2], s.z[3], "#b89a2a", "#ffe14a"];
  for (let i = 0; i < 72; i++) {
    const f = (i / 72) * 100, inZone = f >= a[0] && f <= a[1], ok = s.s === 4 && f >= 50 && !inZone, done = f <= gp;
    px(inZone ? (done ? a[3] : a[2]) : ok ? (done ? "#d8c070" : "#9a8a4a") : done ? "#f4f0fa" : "#5e6880", cx + RING[i][0], cy + RING[i][1], 2, 2);
  }
  const m = RING[Math.min(71, Math.floor((gp / 100) * 72))]; px(OL, m[0] + cx - 1, m[1] + cy - 1, 4, 4); px("#ffffff", cx + m[0], cy + m[1], 2, 2);
}

function drawSlot(i, t) {
  const [x, y] = cellXY(i), cx = x + 28, cy = y + 22, s = slots[i] || { s: 0 };
  px(OL, x + 1, y + 1, CELL.w - 2, CELL.h - 2); px("#8a94aa", x + 2, y + 2, CELL.w - 4, CELL.h - 4); px("#b6c0d6", x + 2, y + 2, CELL.w - 4, 1); px("#6a748a", x + 2, y + CELL.h - 3, CELL.w - 4, 1);
  for (const [rx, ry] of [[4, 4], [CELL.w - 7, 4], [4, CELL.h - 7], [CELL.w - 7, CELL.h - 7]]) { px("#dde4f2", x + rx, y + ry, 2, 2); px("#6a748a", x + rx + 1, y + ry + 1, 1, 1); }   // rivets
  const sh = shakes[i] && t - shakes[i] < 220 ? Math.round(Math.sin(t / 18) * 2) : 0;
  g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "center";
  const label = (txt, c = CREAM) => { g.fillStyle = OL; g.fillText(txt, cx + 1, y + CELL.h - 2); g.fillStyle = c; g.fillText(txt, cx, y + CELL.h - 3); };
  if (i >= n) {   // locked: a padlock and the countdown
    px(OL, cx - 6, cy - 1, 12, 9); px("#f0c050", cx - 5, cy, 10, 7); px("#fff0a0", cx - 5, cy, 10, 1); px(OL, cx - 1, cy + 3, 2, 3); px(OL, cx - 4, cy - 6, 8, 6); px("#8a94aa", cx - 3, cy - 5, 6, 5);
    const left = Math.max(0, Math.ceil((exAt - t) / 1000)); label(exAt ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "잠김");
    return;
  }
  const fx = cx - 12 + sh, fy = cy - 6;
  if (s.s === 0) { fish(fx, fy, "#6a748a", false, "#4a5268"); label("반죽"); }
  else if (s.s === 1) { fish(fx, fy, "#f8eed4", false); label("맛 넣기"); }
  else if (s.s === 2) { fish(fx, fy, "#f8eed4", false); px(OL, fx + 8, fy + 3, 10, 6); px(FILL[s.f], fx + 9, fy + 4, 8, 4); label("덮기"); }
  else if (s.s === 5) {
    fish(fx, fy, "#3a2a22", false); label("버리기", "#ffb090");
    for (let k = 0; k < 3; k++) { const a = (t / 40 + k * 17) % 40; px("rgba(230,230,240,.8)", fx + 6 + k * 7 + Math.round(Math.sin(a / 4 + k) * 2), fy - 2 - Math.round(a / 3), 2, 2); }
  } else {
    const gp = gaugeOf(s, t), w = windowOf(s);
    fish(fx, fy, bakeCol(clamp(gp, 0, 100)), s.s === 4);
    ring(cx, cy, s, t);
    if (gp < 100 && Math.floor(t / 130 + i) % 3 === 0) px("rgba(255,244,190,.9)", fx + 5 + ((t / 90 + i * 5) % 14 | 0), fy + 2 + ((t / 70 + i * 3) % 8 | 0), 1, 1);   // sizzle
    if (gp < 100 && Math.floor(t / 520 + i * 2) % 2 === 0) { const a = (t / 14 + i * 9) % 26; px("rgba(255,255,255,.65)", fx + 8 + Math.round(Math.sin(a / 5 + i) * 3), fy - 3 - Math.round(a / 2), 2, 2); }   // steam
    const go = gp >= w[0] && gp <= w[1], late = gp > w[1] && s.s === 3;
    if (s.s === 3) label(gp < w[0] ? "굽는 중" : late ? "얼른!" : "뒤집기!", go ? "#9dff9d" : late ? "#ff9a7a" : CREAM);
    else label(gp < 50 ? "굽는 중" : go ? "꺼내기!" : gp < w[0] ? "곧…" : "꺼내요!", go ? "#ffe86a" : CREAM);
    px(OL, x + 4, y + 4, 7, 7); px(FILL[s.f], x + 5, y + 5, 5, 5);   // the order's filling
    if (go) { const pu = Math.floor(t / 140) % 2; px(s.s === 3 ? "#7dff7d" : "#ffe14a", x + 1, y + 1, CELL.w - 2, 1); px(s.s === 3 ? "#7dff7d" : "#ffe14a", x + 1, y + CELL.h - 2, CELL.w - 2, 1); if (pu) { px("#ffffff", x + 1, y + 1, 4, 1); px("#ffffff", x + CELL.w - 5, y + CELL.h - 2, 4, 1); } }   // ready: the plate's edge lights up
  }
}
function drawTicket(c, i, t, ready) {
  const x = 2 + i * 39, y = 2, left = clamp((c.until - t) / c.wait, 0, 1), bob = Math.round(Math.sin(t / 360 + c.id));
  px(c.grp ? "#ffd84a" : ready ? "#5ee05e" : OL, x, y, TICKET.w, TICKET.h); px(CREAM, x + 1, y + 1, TICKET.w - 2, TICKET.h - 2); px("#ffffff", x + 1, y + 1, TICKET.w - 2, 1);
  const hue = ["#c8944c", "#aab4c2", "#f0b8c0", "#a8d08a", "#b8a0e0", "#e8d070"][c.id % 6];   // the customer: a round head with two ears
  px(OL, x + 3, y + 4 + bob, 3, 3); px(OL, x + 12, y + 4 + bob, 3, 3); px(OL, x + 3, y + 6 + bob, 12, 11); px(hue, x + 4, y + 7 + bob, 10, 9); px(OL, x + 6, y + 10 + bob, 1, 2); px(OL, x + 11, y + 10 + bob, 1, 2); px(OL, x + 8, y + 13 + bob, 3, 1); px("#ff9aa0", x + 4, y + 12 + bob, 2, 1); px("#ff9aa0", x + 12, y + 12 + bob, 2, 1);
  const total = c.need[0] + c.need[1] + c.need[2];
  if (c.grp) { g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "left"; g.fillStyle = "#b8452a"; g.fillText("단체", x + 19, y + 11); }
  g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "left"; g.fillStyle = INK;
  if (c.grp) { for (let f = 0; f < 3; f++) { px(OL, x + 19 + f * 6, y + 14, 5, 5); px(FILL[f], x + 20 + f * 6, y + 15, 3, 3); } g.fillText(`${total}개`, x + 19, y + 28); }
  else { let k = 0; for (let f = 0; f < 3; f++) for (let m = 0; m < c.need[f]; m++, k++) { const ox = x + 19 + (k % 2) * 9, oy = y + 4 + Math.floor(k / 2) * 9; px(OL, ox, oy, 8, 8); px(FILL[f], ox + 1, oy + 1, 6, 6); } }
  px("#c8b898", x + 3, y + 30, 32, 5); px(left > 0.5 ? "#4cc85c" : left > 0.25 ? "#f0b82a" : (Math.floor(t / 150) % 2 ? "#ff5a4a" : "#d8382a"), x + 4, y + 31, Math.round(30 * left), 3);
}
const pieceAt = (i) => [8 + i * 30, 178];
function drawTray() {
  g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "left"; g.fillStyle = OL; g.fillText("진열", 3, 191); g.fillStyle = CREAM; g.fillText("진열", 2, 190);
  for (let i = 0; i < 6; i++) {
    const [x, y] = pieceAt(i); px("#a06a3c", x + 12, y, 26, 14); px("#8a5830", x + 12, y, 26, 1);
    const p = tray[i]; if (!p) continue;
    px(OL, x + 12, y + 1, 26, 12); px(p[1] === 2 ? "#ffd070" : "#e0a848", x + 13, y + 2, 24, 10); px(p[1] === 2 ? "#fff0b0" : "#f0c470", x + 13, y + 2, 24, 2); px(FILL[p[0]], x + 21, y + 5, 8, 4); px(OL, x + 12, y + 1, 1, 1);
    if (p[1] === 2) { px("#ffffff", x + 14, y + 3, 1, 1); px("#ffffff", x + 34, y + 9, 1, 1); }
  }
}
function drawButtons() {
  g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "center";
  for (let f = 0; f < 3; f++) {
    const x = 6 + f * 78;
    px(sel === f ? "#e8453a" : OL, x, BTN.y, BTN.w, BTN.h); px(sel === f ? "#ffffff" : "#e8c898", x + 1, BTN.y + 1, BTN.w - 2, BTN.h - 2); px(sel === f ? "#fff0c8" : "#f4dcb0", x + 1, BTN.y + 1, BTN.w - 2, 2);
    px(OL, x + 5, BTN.y + 5, 8, 8); px(FILL[f], x + 6, BTN.y + 6, 6, 6);
    g.fillStyle = INK; g.fillText(`${f + 1} ${FNAME[f]}`, x + 43, BTN.y + 13);
  }
}

// ── input
const spot = (i) => cellXY(i).map((v, k) => v + (k ? 18 : 28));
function tapSlot(i, t) {
  const s = slots[i];
  if (!running || t - sentAt < 60) return;
  if (!s || i >= n) { shakes[i] = t; snd("alba_buzz", 150); return; }
  last = spot(i);
  if (s.s === 3 || s.s === 4) {
    const gp = gaugeOf(s, t);
    if (gp < (s.s === 3 ? s.z[0] : 50) || (s.s === 4 && tray.length >= 6)) { shakes[i] = t; snd("alba_buzz", 150); return; }   // too early / no room on the tray: nothing is sent
    if (s.s === 4 && s.q === 2 && gp >= s.z[2] && gp <= s.z[3]) { api.fx("big"); floats.push({ x: last[0], y: last[1] - 6, txt: "완벽!", col: "#ffe14a", at: t }); snd("alba_ding", 60); burst(last[0], last[1], 10, ["#ffe14a", "#ffffff", "#fff0a0"], 40, 40); }
    else if (s.s === 4) { api.fx("good"); snd("alba_pop", 60); }
    else if (gp > s.z[1]) s.q = 1;
    if (s.s === 3) snd("alba_swish", 80);
  }
  sentAt = t; api.act({ slot: i, step: s.s, f: sel });
  if (s.s === 0) { s.s = 1; snd("alba_splash", 70); }   // the quiet steps are shown at once; the server's view confirms (or corrects) them
  else if (s.s === 1) { s.f = sel; s.s = 2; snd("alba_pop", 70); }
  else if (s.s === 2) { s.s = 3; s.at = t; s.q = 2; snd("alba_snap", 70); snd("alba_sizzle", 250); }
  else if (s.s === 3) { s.s = 4; s.at = t; snd("alba_sizzle", 250); }
  else { if (s.s === 5) snd("alba_thud", 80); s.s = 0; }
}
function tapTicket(c, t) {
  last = [8 + 39 * cust.indexOf(c), 30];
  if (!c.need.some((k, f) => k > 0 && tray.some((p) => p[0] === f))) { floats.push({ x: last[0] + 12, y: 46, txt: "맛이 없어요", col: "#ff7a6a", at: t }); snd("alba_buzz", 150); return; }
  sentAt = t; api.act({ c: c.id }); api.fx("good"); snd("alba_coin", 70); burst(last[0] + 12, 24, 6, ["#ffd84a", "#fff2a8"], 24, 24);
}
function press(e) {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H, t = performance.now();
  if (y >= BTN.y && y < BTN.y + BTN.h) { const f = Math.floor((x - 6) / 78); if (f >= 0 && f < 3) { if (sel !== f) snd("alba_pop", 60); sel = f; } return; }
  if (y < 42) { const c = cust[Math.floor((x - 2) / 39)]; if (c && running && t - sentAt >= 60) tapTicket(c, t); return; }
  if (y >= CELL.y0 && y < CELL.y0 + 2 * CELL.h && x >= CELL.x0 && x < CELL.x0 + 4 * CELL.w) tapSlot(Math.floor((y - CELL.y0) / CELL.h) * 4 + Math.floor((x - CELL.x0) / CELL.w), t);
}
const KEYS = { a: 0, s: 1, d: 2, f: 3, z: 4, x: 5, c: 6, v: 7 };

export default {
  mount(h, a) {
    host = h; api = a; host.textContent = ""; Object.assign(host.style, { alignSelf: "stretch", background: "#f6dcb0" });   // the side margins of the whole-number scale are not black
    cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.touchAction = "none";
    host.append(cv); g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    cv.addEventListener("pointerdown", press);
    slots = []; cust = []; tray = []; floats = []; shakes = []; last = null; lastScore = 0; scale = 0; fitKey = ""; exAt = 0; running = false; fxp = []; lastT = 0; lastS = {}; cue = [];
  },
  setState(v, at) {
    recvAt = at; n = v[0];
    slots = v[1].map((r) => ({ s: r[0], f: r[1], q: r[2] || 2, at: at + (r[3] || 0), d: r[4] || 1, z: [r[5] || 0, r[6] || 0, r[7] || 0, r[8] || 0] }));
    cust = v[2].map((c) => ({ id: c[0], need: [c[1], c[2], c[3]], until: at + c[4], wait: c[5], grp: c[6] }));
    tray = v[3]; exAt = v[4] ? at + v[4] : 0;
  },
  frame(t, info) {
    fit(host.clientWidth || W);
    running = info.phase === "run";
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    if (info.score !== lastScore) {
      const d = info.score - lastScore, p0 = last || [W / 2, 30];
      if (lastScore || d > 0) floats.push({ x: p0[0], y: p0[1], txt: d > 0 ? `+${d}` : `${d}`, col: d > 0 ? "#fff2a8" : "#ff7a6a", at: t });
      if (d < 0) { api.fx("bad"); snd("alba_buzz", 200); }   // a burnt piece or a customer who left
      lastScore = info.score;
    }
    if (running) for (let i = 0; i < n && i < 8; i++) {   // a soft bell the moment a gauge enters its window
      const s = slots[i], w = s && windowOf(s), on = !!w && gaugeOf(s, t) >= w[0] && gaugeOf(s, t) <= w[1], key = s ? `${s.s}${on ? "+" : "-"}` : "";
      if (on && cue[i] !== key) snd("alba_ding", 120);
      cue[i] = key;
    }
    hiRes(cv, g, W, H);
    px("#f6dcb0", 0, 0, W, H); for (let y = 44; y < 154; y += 12) px("#f0d0a0", 0, y, W, 1);   // the wall behind the plates
    px("#e6a870", 0, 0, W, 42); px("#f4c898", 0, 0, W, 2); px("#c07c4c", 0, 41, W, 3);
    px(OL, 6, 42, 228, 113); px("#6a748a", 7, 43, 226, 111);   // the iron frame of the mould plate
    px("#c08050", 0, 155, W, 43); px("#e4a870", 0, 155, W, 2); px("#a46a3c", 0, 176, W, 1);
    cust.forEach((c, i) => { if (i < 6) drawTicket(c, i, t, c.need.some((k, f) => k > 0 && tray.some((p) => p[0] === f))); });
    for (let i = 0; i < 8; i++) drawSlot(i, t);
    drawButtons(); drawTray();
    for (let i = fxp.length - 1; i >= 0; i--) {
      const p = fxp[i]; p.life -= dt;
      if (p.life <= 0) { fxp.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt;
      g.globalAlpha = Math.min(1, p.life * 4); px(p.col, Math.round(p.x), Math.round(p.y), 2, 2);
    }
    g.globalAlpha = 1;
    g.font = "9px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "center";
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], a = t - f.at;
      if (a > 800) { floats.splice(i, 1); continue; }
      const y = Math.round(f.y - a / 36), x = Math.round(f.x);
      g.fillStyle = OL; g.fillText(f.txt, x + 1, y + 1); g.fillText(f.txt, x - 1, y + 1); g.fillStyle = f.col; g.fillText(f.txt, x, y);
    }
    if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; px(c, 0, 0, W, 2); px(c, 0, H - 2, W, 2); px(c, 0, 0, 2, H); px(c, W - 2, 0, 2, H); }
    if (info.phase !== "run") {   // a cream label over the board
      const sub = info.phase === "brief", ph = sub ? 66 : 28, py = (H - ph) / 2;
      px(OL, 14, py - 2, W - 28, ph + 4); px(CREAM, 16, py, W - 32, ph); px("#ffffff", 16, py, W - 32, 1); px("#e0c898", 16, py + ph - 2, W - 32, 2);
      g.textAlign = "center"; g.fillStyle = INK; g.font = "11px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif";
      if (sub) { g.fillText(`${Math.ceil(info.toStart / 1000)}`, W / 2, py + 16); g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.fillStyle = "#7a6044"; g.fillText("칸을 눌러 반죽 → 맛 → 덮기", W / 2, py + 32); g.fillText("초록·노랑 구간에 뒤집고 꺼내요", W / 2, py + 44); g.fillText("손님을 눌러 붕어빵을 건네요", W / 2, py + 56); }
      else g.fillText("수고했어요!", W / 2, py + 18);
    }
    g.textAlign = "left";
  },
  key(e) {
    const k = e.key.toLowerCase();
    if (k >= "1" && k <= "3") { if (sel !== +k - 1) snd("alba_pop", 60); sel = +k - 1; return true; }
    if (!(k in KEYS) || e.repeat) return false;
    tapSlot(KEYS[k], performance.now()); return true;
  },
  unmount() { if (host) host.textContent = ""; host = cv = g = api = null; fxp = []; },
};
