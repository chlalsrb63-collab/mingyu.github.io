// 일일 아르바이트 · 파리잡기 client (rules: src/logic/67-alba-fly.js, contract: public/alba.js). A 3×3 grid of trash cans on a 240×156 pixel board
// (drawn at a whole-number scale, no smoothing). The server view = [[[id, can, ms to spawn, life, kind]…], [[can, ms shut]…]] (times are ms from receipt):
// the flies buzz out of their can on their own clock here; a tap in a can's cell swats that can's fly → api.act({hit: id}). Swatting is optimistic
// (splat at once); the score/combo always come from the server (the floating numbers are the real score change).
// Look: a sunny brick alley, green bins on light slabs. Sounds: swish (a miss), crunch (a fly), coin (golden), buzz (bee / points lost), thud (poison / bomb).
import { hiRes } from "./alba_stage.js";
const W = 240, H = 156, CW = 80, CH = 52;
const OL = "#2a1c2c", FLY_COL = ["#6a6680", "#ffd84a", "#f2b92a", "#5ea83e", "#8a9a7a"];   // plain · golden · bee · poison · wounded poison
const LID = "#c4d0e0", CREAM = "#fff4d6", INK = "#4a3424";
let host = null, api = null, cv = null, g = null, bg = null, scale = 0;
let flies = new Map(), closed = [], recvAt = 0, now = 0;
let splats = [], floats = [], mouse = null, swat = 0, shake = 0, lastTap = null, lastScore = 0, bombAt = 0, bombSnd = 0, jig = [], fxp = [], lastT = 0, lastS = {};

/** A sound, throttled so a fast tapper never spams it. */
function snd(n, gap = 70) { const t = performance.now(); if (api && t - (lastS[n] || 0) >= gap) { lastS[n] = t; api.sfx(n); } }
function burst(x, y, n, cols, spd = 40, up = 30) {
  for (let i = 0; i < n; i++) fxp.push({ x, y, vx: (Math.random() - 0.5) * spd * 2, vy: -Math.random() * up - 6, life: 0.3 + Math.random() * 0.3, col: cols[i % cols.length] });
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
const cell = (c) => [(c % 3) * CW, Math.floor(c / 3) * CH];
const mouth = (c) => { const [x, y] = cell(c); return [x + CW / 2, y + 33]; };
const KEYCAP = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"];

// ── the pixel art: all drawn from rectangles
function makeBg() {
  const b = document.createElement("canvas"); b.width = W; b.height = H;
  const q = b.getContext("2d"), r = (c, x, y, w, h) => { q.fillStyle = c; q.fillRect(x, y, w, h); };
  r("#e6b888", 0, 0, W, H);   // a sunny brick wall
  for (let y = 0; y < H; y += 6) {
    r("#cf9c6a", 0, y, W, 1);
    for (let x = (y / 6) % 2 ? 0 : 6; x < W; x += 12) { r("#cf9c6a", x, y, 1, 6); if (((x * 7 + y * 13) >> 2) % 5 === 0) r("#f0c89a", x + 2, y + 2, 7, 3); else if (((x * 3 + y * 5) >> 1) % 7 === 0) r("#d8a574", x + 2, y + 2, 7, 3); }
  }
  r("#f4d29c", 0, 0, W, 2);
  // a poster, a window and a drain pipe (kept in the corners, away from the flies' paths)
  r(OL, 3, 3, 15, 19); r(CREAM, 4, 4, 13, 17); r("#e8604a", 6, 6, 9, 5); r("#4a8fe0", 6, 13, 9, 2); r("#4a8fe0", 6, 17, 6, 2);
  r(OL, 214, 3, 22, 15); r("#9fd8ef", 215, 4, 20, 13); r("#d8f2ff", 215, 4, 20, 3); r(OL, 224, 4, 1, 13); r(OL, 215, 10, 20, 1);
  r("#7a8aa0", W - 6, 18, 4, H - 18); r("#a8b8cc", W - 6, 18, 1, H - 18); r("#566580", W - 3, 18, 1, H - 18);
  for (let c = 0; c < 9; c++) {
    const [x, y] = cell(c);
    r("#a8a08c", x + 5, y + 47, CW - 10, 5);   // the pavement slab: a light top edge, a body, one shadow tone
    r("#ece6d4", x + 5, y + 45, CW - 10, 2); r("#d2ccb8", x + 5, y + 47, CW - 10, 2);
    r("#8a8270", x + CW / 2 - 15, y + 48, 30, 2);
    const lit = [["#7ec850", x + 10, y + 46, 3, 2], ["#fff4d6", x + 62, y + 46, 3, 2], ["#e8604a", x + 58, y + 49, 2, 2], ["#6a98d8", x + 14, y + 49, 3, 2]][c % 4];
    r(lit[0], lit[1], lit[2], lit[3], lit[4]);
  }
  return b;
}
function drawCan(c, shut, t) {
  const [x, y] = cell(c), j = jig[c] && t - jig[c] < 200 ? Math.round(Math.sin((t - jig[c]) / 22) * 2) : 0, cx = x + CW / 2 + j, top = y + 34;
  px(OL, cx - 11, top - 1, 22, 17); px("#3fa066", cx - 10, top, 20, 15); px("#86e0a2", cx - 10, top, 3, 15); px("#27704a", cx + 6, top, 4, 15);
  for (const rx of [-4, 1]) px("#2f8456", cx + rx, top + 2, 1, 11);
  px("#e8fff0", cx - 2, top + 5, 5, 1); px("#e8fff0", cx - 1, top + 4, 3, 1); px("#e8fff0", cx - 1, top + 6, 3, 1);   // a recycling blip
  px(OL, cx - 11, top + 15, 22, 1);
  if (shut) {   // the lid is down: a red band and a snoring z
    px(OL, cx - 13, top - 5, 26, 6); px(LID, cx - 12, top - 4, 24, 4); px("#eef4ff", cx - 12, top - 4, 24, 1); px("#e0555f", cx - 12, top - 2, 24, 1);
    px(OL, cx - 3, top - 8, 6, 3); px(LID, cx - 2, top - 7, 4, 1);
    if (Math.floor(t / 400) % 2) { px("#ffffff", cx + 9, top - 12, 3, 1); px("#ffffff", cx + 10, top - 11, 1, 1); px("#ffffff", cx + 9, top - 10, 3, 1); }
  } else {      // the lid leans open on one side, the dark mouth shows
    const sway = Math.round(Math.sin(t / 260 + c) * 1);
    px("#3a2236", cx - 10, top - 2, 20, 2); px(OL, cx - 12, top - 4, 24, 1);
    for (let i = 0; i < 12; i++) { const lx = cx + 7 + i, ly = top - 5 - Math.round(i * 0.7) + (i > 7 ? sway : 0); px(OL, lx, ly - 3, 1, 7); px(LID, lx, ly - 2, 1, 5); }   // the lid, hinged on the right and swung up
  }
  g.font = "7px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "left";   // the key that swats this can
  px(OL, x + 5, y + 43, 9, 9); px("#6a5470", x + 6, y + 44, 7, 7); g.fillStyle = "#ffffff"; g.fillText(KEYCAP[c], x + 7, y + 50);
}
/** A fly sprite centred on (x, y); `fr` is the wing beat, `k` the kind (0 plain · 1 golden · 2 bee · 3 poison · 4 wounded poison). */
function drawFly(x, y, k, fr, t) {
  x = Math.round(x); y = Math.round(y);
  const pois = k === 3 || k === 4, wc = pois ? "#e6ccff" : "#f4faff", wd = pois ? "#b48ae0" : "#a8d0f4";
  const wing = (a, b, big) => { const w = big ? 8 : 7, h = big ? 6 : 5; px(OL, x + a, y + b, w, h); px(wc, x + a + 1, y + b + 1, w - 2, h - 2); px(wd, x + a + 1, y + b + h - 2, w - 2, 1); };
  if (k === 2) {   // bee: big, round, striped, with a stinger
    wing(-11, fr ? -9 : -5, 1); wing(3, fr ? -9 : -5, 1);
    px(OL, x - 5, y - 4, 11, 9); px(OL, x - 4, y - 5, 9, 11); px("#f8c424", x - 4, y - 4, 9, 9);
    px(OL, x - 4, y - 1, 9, 2); px(OL, x - 4, y + 2, 9, 2); px("#fff0a0", x - 3, y - 4, 3, 2);
    px(OL, x - 1, y + 5, 3, 3); px("#ff5a4a", x, y + 6, 1, 2);   // the stinger
    px(OL, x - 3, y - 7, 1, 3); px(OL, x + 3, y - 7, 1, 3); px(OL, x - 4, y - 8, 2, 1); px(OL, x + 3, y - 8, 2, 1);   // antennae
    return;
  }
  wing(-10, fr ? -8 : -4); wing(3, fr ? -8 : -4);
  px(OL, x - 3, y - 4, 7, 9); px(FLY_COL[k], x - 2, y - 3, 5, 7);
  px(k === 1 ? "#fff2a8" : "#a8a4c4", x - 2, y - 3, 2, 1);   // a glint
  px(OL, x - 4, y - 5, 9, 3); px("#ff4a4a", x - 3, y - 4, 2, 2); px("#ff4a4a", x + 1, y - 4, 2, 2);   // the head with its red eyes
  px(OL, x - 5, y, 2, 1); px(OL, x + 4, y, 2, 1); px(OL, x - 5, y + 2, 2, 1); px(OL, x + 4, y + 2, 2, 1);   // legs
  if (k === 1) {       // golden: a sparkle blinking around it
    const s = Math.floor(t / 120) % 4, o = [[-9, -9], [9, -7], [8, 7], [-9, 6]][s];
    px("#ffffff", x + o[0], y + o[1], 1, 1); px("#fff0a0", x + o[0] - 1, y + o[1], 3, 1); px("#fff0a0", x + o[0], y + o[1] - 1, 1, 3);
  } else if (k === 3) { px("#2c6a2a", x - 1, y + 1, 3, 1); px("#c58cff", x - 2, y + 3, 1, 1); px("#c58cff", x + 2, y + 2, 1, 1); }   // purple spots
  else if (k === 4) { px("#ffffff", x - 2, y + 1, 5, 2); px("#d8505a", x, y, 1, 4); }   // a bandage
}
function drawSwatter(x, y, slam) {   // the pointer is the cross; the swatter rests down-right of it and slams onto it
  x = Math.round(x); y = Math.round(y);
  const hx = slam ? x - 8 : x + 4, hy = slam ? y - 8 : y + 4;
  if (!slam) { px(OL, hx + 6, hy + 15, 4, 12); px("#e0a860", hx + 7, hy + 15, 2, 11); }
  px(OL, hx, hy, 16, 16); px("#8fe070", hx + 1, hy + 1, 14, 14);
  for (let i = 0; i < 4; i++) { px("#3f8a3a", hx + 1, hy + 3 + i * 3, 14, 1); px("#3f8a3a", hx + 3 + i * 3, hy + 1, 1, 14); }
  px("#c8f8b0", hx + 1, hy + 1, 14, 1);
  px(OL, x - 3, y - 1, 7, 3); px(OL, x - 1, y - 3, 3, 7); px("#ffffff", x - 2, y, 5, 1); px("#ffffff", x, y - 2, 1, 5);
}
function plaque(head, sub) {   // a cream label in the middle of the board
  const w = 200, h = sub ? 46 : 28, x = (W - w) / 2, y = (H - h) / 2;
  px(OL, x - 2, y - 2, w + 4, h + 4); px(CREAM, x, y, w, h); px("#ffffff", x, y, w, 1); px("#e0c898", x, y + h - 2, w, 2);
  g.textAlign = "center"; g.font = "11px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.fillStyle = INK; g.fillText(head, W / 2, y + 17);
  if (sub) { g.font = "8px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.fillStyle = "#7a6044"; g.fillText(sub, W / 2, y + 35); }
}

// ── the flies' paths (the server only says when and where; the buzz is decoration)
const seedOf = (id) => ((id * 2654435761) >>> 0) / 4294967296;
function flyPos(f, tau) {
  const [mx, my] = mouth(f.c), a = seedOf(f.id) * 6.283, kk = f.k === 1 ? 2.1 : f.k === 2 ? 0.7 : 1;
  let ox, oy;
  if (f.k === 1) { const s = tau * 0.011 + a; ox = (Math.abs((s % 4) - 2) - 1) * 26; oy = -18 + (Math.abs(((s * 1.7) % 4) - 2) - 1) * 9; }   // golden: zigzag
  else { const s = tau * 0.0055 * kk + a; ox = Math.sin(s) * 25; oy = -17 + Math.sin(s * 1.7 + 1) * 10; }
  if (tau < 220) { const e = tau / 220; ox *= e; oy = oy * e - 1; }   // out of the can
  else if (tau > f.life - 170) oy -= ((tau - (f.life - 170)) / 170) * 20;   // away, up
  return [mx + ox, my + oy];
}
const aliveAt = (t, slack) => { const r = []; for (const f of flies.values()) if (!f.hit && t >= f.at - 60 && t <= f.at + f.life + slack) r.push(f); return r; };

function swatCan(c) {
  swat = now; lastTap = mouth(c); jig[c] = now;
  const f = aliveAt(now, 120).find((x) => x.c === c);
  if (!f) { snd("alba_swish", 90); burst(lastTap[0], lastTap[1] - 4, 4, ["#ece6d4", "#d2ccb8"], 22, 12); return; }   // a swing at nothing: nothing is sent
  api.act({ hit: f.id });
  const col = f.k === 2 ? "#ff5a4a" : "#ffffff";
  splats.push({ x: f.x, y: f.y, at: now, col });
  burst(f.x, f.y, 7, f.k === 1 ? ["#ffd84a", "#fff2a8", "#ffffff"] : f.k === 2 ? ["#f8c424", "#ff5a4a"] : f.k >= 3 ? ["#7ec850", "#c58cff"] : ["#8a86a4", "#f4faff", "#ffffff"], 34, 26);
  if (f.k === 2) { snd("alba_buzz", 120); api.fx("bad"); shake = now; f.hit = now; closed[c] = now + 1000; return; }
  if (f.k === 3) { f.k = 4; snd("alba_thud", 100); api.fx("good"); return; }
  snd(f.k === 1 ? "alba_coin" : "alba_crunch", 70);
  api.fx(f.k === 1 ? "big" : "good", f.k === 1 ? "금파리!" : undefined);
  f.hit = now; closed[c] = now + 1000;
}
function press(e) {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
  mouse = [x, y]; now = performance.now();
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  swatCan(Math.floor(y / CH) * 3 + Math.floor(x / CW));
}
const KEYS = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8, q: 0, w: 1, e: 2, a: 3, s: 4, d: 5, z: 6, x: 7, c: 8 };

export default {
  mount(h, a) {
    host = h; api = a; host.textContent = ""; Object.assign(host.style, { alignSelf: "stretch", background: "#e6b888" });   // the side margins of the whole-number scale are not black
    cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.touchAction = "none"; cv.style.cursor = "none";
    host.append(cv); g = cv.getContext("2d"); g.imageSmoothingEnabled = false; bg = makeBg();
    cv.addEventListener("pointerdown", press);
    cv.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mouse = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; });
    cv.addEventListener("pointerleave", () => { mouse = null; });
    flies = new Map(); closed = []; splats = []; floats = []; lastScore = 0; scale = 0; fitKey = ""; bombAt = 0; bombSnd = 0; lastTap = null; jig = []; fxp = []; lastT = 0; lastS = {};
  },
  setState(s, at) {
    recvAt = at; const nf = new Map(), ts = [];
    for (const [id, c, ms, life, k] of s[0]) {
      const old = flies.get(id), t0 = at + ms;
      nf.set(id, old && !old.hit && Math.abs(old.at - t0) < 150 ? Object.assign(old, { k, life }) : { id, c, at: t0, life, k, hit: old && old.hit && at - old.hit < 220 ? old.hit : 0, x: 0, y: 0 });
      ts.push(t0);
    }
    for (const [id, f] of flies) if (f.hit && at - f.hit < 160 && !nf.has(id)) nf.set(id, f);   // a swatted fly finishes its fade
    flies = nf; closed = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const [c, ms] of s[1]) closed[c] = at + ms;
    ts.sort((a, b) => a - b);
    for (let i = 0; i + 5 < ts.length; i++) if (ts[i + 5] - ts[i] < 700 && Math.abs(ts[i] - bombAt) > 3000) { bombAt = ts[i]; break; }
  },
  frame(t, info) {
    now = t;
    fit(host.clientWidth || W);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    if (info.score !== lastScore) {   // the real score change, floating where the last swat landed
      const d = info.score - lastScore, p0 = lastTap && t - swat < 900 ? lastTap : [W / 2, 20];
      if (lastScore || d > 0) floats.push({ x: p0[0], y: p0[1] - 12, txt: d > 0 ? `+${d}` : `${d}`, col: d > 0 ? "#fff2a8" : "#ff7a6a", at: t });
      if (d < 0) snd("alba_buzz", 300);   // points lost (a bee, or a fly that got away)
      lastScore = info.score;
    }
    cv.style.cursor = info.phase === "run" ? "none" : "default";
    hiRes(cv, g, W, H); px(OL, 0, 0, W, H);
    if (t - shake < 200) g.translate(Math.round(Math.sin(t / 22) * 2), 0);
    g.drawImage(bg, 0, 0);
    for (let c = 0; c < 9; c++) drawCan(c, closed[c] > t, t);
    const live = [];
    for (const f of flies.values()) {
      const tau = t - f.at;
      if (f.hit) { if (t - f.hit > 160) continue; }
      else if (tau < 0 || tau > f.life) continue;
      [f.x, f.y] = f.hit ? [f.x, f.y - (t - f.hit) * 0.02] : flyPos(f, tau);
      live.push(f);
    }
    live.sort((a, b) => a.y - b.y);
    for (const f of live) { if (f.hit) { if (Math.floor(t / 40) % 2) drawFly(f.x, f.y, f.k, 0, t); } else drawFly(f.x, f.y, f.k, Math.floor(t / 55) % 2, t); }
    for (let i = splats.length - 1; i >= 0; i--) {   // the swat burst: four short rays that fly apart
      const s = splats[i], a = t - s.at;
      if (a > 220) { splats.splice(i, 1); continue; }
      const d = 3 + a / 22; px(s.col, Math.round(s.x - d), Math.round(s.y), 3, 1); px(s.col, Math.round(s.x + d - 2), Math.round(s.y), 3, 1); px(s.col, Math.round(s.x), Math.round(s.y - d), 1, 3); px(s.col, Math.round(s.x), Math.round(s.y + d - 2), 1, 3);
    }
    for (let i = fxp.length - 1; i >= 0; i--) {
      const p = fxp[i]; p.life -= dt;
      if (p.life <= 0) { fxp.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
      g.globalAlpha = Math.min(1, p.life * 4); px(p.col, Math.round(p.x), Math.round(p.y), 2, 2);
    }
    g.globalAlpha = 1;
    g.font = "9px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.textAlign = "center";
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], a = t - f.at;
      if (a > 800) { floats.splice(i, 1); continue; }
      const y = Math.round(f.y - a / 40), x = Math.round(f.x);
      g.fillStyle = OL; g.fillText(f.txt, x + 1, y + 1); g.fillText(f.txt, x - 1, y + 1); g.fillStyle = f.col; g.fillText(f.txt, x, y);
    }
    if (t - bombAt < 2200 && t - bombAt > -500) {   // 쓰레기 폭탄 banner
      const on = Math.floor(t / 150) % 2;
      if (t - bombAt > 0 && bombSnd !== bombAt) { bombSnd = bombAt; snd("alba_thud", 500); }
      px(OL, W / 2 - 42, 3, 84, 14); px(on ? "#e8453a" : "#ff8a3a", W / 2 - 41, 4, 82, 12); px("#ffffff55", W / 2 - 41, 4, 82, 2);
      g.font = "10px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.fillStyle = OL; g.fillText("쓰레기 폭탄!", W / 2 + 1, 14); g.fillStyle = "#ffffff"; g.fillText("쓰레기 폭탄!", W / 2, 13);
    }
    if (info.fever > 0) { const c = Math.floor(t / 90) % 2 ? "#ff9a3a" : "#ffd84a"; px(c, 0, 0, W, 2); px(c, 0, H - 2, W, 2); px(c, 0, 0, 2, H); px(c, W - 2, 0, 2, H); }
    if (mouse && info.phase === "run") drawSwatter(mouse[0], mouse[1], t - swat < 110);
    if (info.phase === "brief") plaque(`${Math.ceil(info.toStart / 1000)}`, "쓰레기통에서 나오는 파리를 잡으세요");
    else if (info.phase === "end") plaque("수고했어요!", "");
    g.textAlign = "left"; g.setTransform(1, 0, 0, 1, 0, 0);
  },
  key(e) {
    const c = KEYS[e.key.toLowerCase()];
    if (c === undefined || e.repeat) return false;
    now = performance.now(); swatCan(c); return true;
  },
  unmount() { if (host) host.textContent = ""; host = cv = g = api = null; },
};
