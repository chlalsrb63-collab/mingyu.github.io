/**
 * 일일 아르바이트 in the browser (logic 66-alba.js, plan docs/design/daily-alba-minigames-2026-11-16.md). The server runs the shift;
 * this opens its own window while `snap.ab` is present and draws two halves: the TOP stage (the hero in the job's outfit, working)
 * and the BOTTOM board (the game's own module `alba_<k>.js`). The 알바 window (#w-alba) lists the games and starts them.
 *
 * snap.ab = [k, ended, ms to start, ms to end, score, combo, fever ms left, game state | 0 (unchanged), result | 0, rev, strikes, lives]
 * A game module (public/alba_<k>.js) has a default export:
 *   mount(host, api)      once, `host` is an empty div (the board); build DOM / a canvas in it
 *   setState(g, recvAt)   the server's view(): the full state, only when it changed (times in it are ms FROM THE MOMENT OF RECEIPT, recvAt = performance.now() then)
 *   frame(t, info)        every animation frame while the window is open; `info` = { phase: "brief"|"run"|"end", left, toStart, score, combo, fever, rush }
 *   key(e)  (optional)    a keydown: return true if the game used it (the world never sees keys while a shift is open)
 *   keyup(e) (optional)   a keyup (for hold notes and the like)
 *   unmount()             the window closed
 * api = { act(obj) → sends {t:"ab_act", ...obj}, fx(kind, text?, x?, y?) → the stage reacts ("good" | "bad" | "big" | "fever"), sfx(name), now() }
 * Sounds the games may use: alba_ok alba_big alba_bad alba_fever alba_tick and the alba_* foley (audio.js), anything else is silent.
 * The shell itself shows every score change as a big +N / −N (scorePop, sound alba_gain) and jolts the window on a lost heart (alba_hurt).
 */
import { Sound } from "./audio.js";
import * as SP from "./sprites.js";
import { G, $, el, clamp } from "./state.js";
import { act, ws } from "./net.js";
import * as Board from "./board.js";
import * as Stage from "./alba_stage.js";

const GAMES = {};   // k → module, loaded on first use
const LOADERS = {
  pipe: () => import("./alba_pipe.js"), fly: () => import("./alba_fly.js"), store: () => import("./alba_store.js"),
  parcel: () => import("./alba_parcel.js"), laundry: () => import("./alba_laundry.js"), taiyaki: () => import("./alba_taiyaki.js"),
  pest: () => import("./alba_pest.js"), wall: () => import("./alba_wall.js"), cross: () => import("./alba_cross.js"),
  lamp: () => import("./alba_lamp.js"), rhythm: () => import("./alba_rhythm.js"), garland: () => import("./alba_garland.js"),
};
const THEME = {   // stage colours by tool: [wall, floor, accent]
  wrench: ["#3a4a5c", "#5c5c64", "#6ab0ff"], swatter: ["#5a4a3a", "#3a3a32", "#9ae06a"], scanner: ["#3c5a46", "#d8d4c0", "#ff6a5a"],
  box: ["#5a4a36", "#6a5a46", "#e2c486"], basket: ["#3a5a7a", "#9ab6d0", "#ffffff"], spatula: ["#7a4a2a", "#4a3022", "#ffd070"],
  sprayer: ["#2a4a3a", "#3a4a44", "#b4f04a"], chain: ["#4a3a3a", "#5a4a40", "#ff8a4a"], parcelbag: ["#4a5a3a", "#6a6a4a", "#ffd070"], torch: ["#1f2438", "#2c3248", "#ffc84a"],
  lute: ["#4a2a4a", "#5a3a3a", "#ff8ac0"], shears: ["#3a5a3a", "#6a8a4a", "#ff9ad0"],
};
const st = { ab: null, k: null, mod: null, recv: 0, toStart: 0, toEnd: 0, fever: 0, host: null, stageAt: 0, react: null, parts: [], dom: null, shown: "", result: null, loading: false, last: { t: "", s: -1, c: -1 } };

const api = {
  act: (o) => act({ t: "ab_act", ...o }),
  fx: (kind, text, x, y) => react(kind, text, x, y),
  sfx: (name, arg) => { try { Sound.play(name, arg); } catch { /* a missing sound is silent */ } },
  now: () => performance.now(),
};
/** A shift's window is open: input.js stands the hero still and takes no world keys. */
export const active = () => !!st.k;

// ── the window (built once)
function build() {
  if (st.dom) return st.dom;
  const root = el("div", "");
  root.id = "alba-play"; root.hidden = true;
  const box = el("div", "ap-box"), head = el("div", "ap-head");
  const title = el("b", "ap-title"), time = el("span", "ap-time"), score = el("span", "ap-score"), combo = el("span", "ap-combo");
  const quit = el("button", "btn small", "그만두기"); quit.type = "button";
  // two presses to give up: the page's confirm box (windows.js ask) sits under this window, so the button asks for itself
  quit.addEventListener("click", () => {
    if (st.ab && st.ab[1]) { act({ t: "ab_close" }); return; }
    if (quit.dataset.sure) { act({ t: "ab_leave" }); return; }
    quit.dataset.sure = "1"; quit.textContent = "정말 그만두기? (보수 없음)";
    clearTimeout(st.sureT);
    st.sureT = setTimeout(() => { delete quit.dataset.sure; if (!(st.ab && st.ab[1])) quit.textContent = "그만두기"; }, 3000);
  });
  head.append(title, time, score, combo, quit);
  const stage = document.createElement("canvas"); stage.className = "ap-stage"; stage.width = 480; stage.height = 120;
  const bar = el("div", "ap-bar"), fill = el("i", "ap-fill"); bar.append(fill);
  const marks = ["C", "B", "A", "S"].map((l) => { const m = el("span", "ap-mark", l); bar.append(m); return m; });
  const board = el("div", "ap-board"), res = el("div", "ap-res"); res.hidden = true;
  const hint = el("div", "ap-hint"), pops = el("div", "ap-pops");
  box.append(head, stage, bar, hint, board, res, pops);
  root.append(box);
  document.body.append(root);
  st.dom = { root, box, pops, title, time, score, combo, stage, g: stage.getContext("2d"), bar, fill, marks, board, res, hint, quit };
  st.dom.g.imageSmoothingEnabled = false;
  return st.dom;
}

// ── opening and closing
async function open(k) {
  if (st.loading) return;
  st.loading = true;
  try {
    const mod = GAMES[k] || (GAMES[k] = (await LOADERS[k]()).default);
    if (!st.ab || st.ab[0] !== k) return;   // the shift ended while the module loaded
    const d = build(), row = G.defs.alba.rows[k];
    st.k = k; st.mod = mod; st.prevPhase = ""; st.act = 0; st.ph = 0; st.sAt = 0; st.parts.length = 0; st.react = null; st.result = null; st.shown = ""; st.disp = 0; st.last = { t: "", s: -1, c: -1 }; st.wasFever = false; st.wasRush = false; d.pops.textContent = "";
    d.title.textContent = row.name; d.hint.textContent = row.hint; d.res.hidden = true; d.res.textContent = "";
    d.board.textContent = ""; d.root.hidden = false; d.quit.textContent = "그만두기"; delete d.quit.dataset.sure;
    const th = THEME[row.tool] || THEME.box; d.box.style.setProperty("--ap-acc", th[2]);
    d.marks.forEach((m, i) => { m.style.left = `${(G.defs.alba.cuts[i] / 1.1) * 100}%`; });
    st.host = el("div", "ap-host"); d.board.append(st.host);
    mod.mount(st.host, api);
    document.body.classList.add("alba-open");
    if (st.pending) { mod.setState(st.pending, st.recv); st.pending = null; }
  } finally { st.loading = false; }
}
function close() {
  if (!st.k) return;
  try { st.mod.unmount(); } catch { /* the board was already gone */ }
  st.k = null; st.mod = null; st.pending = null;
  if (st.dom) st.dom.root.hidden = true;
  document.body.classList.remove("alba-open");
  dispatchEvent(new Event("blur"));   // input.js forgets the keys held (their keyup went to the window, not to the world)
}

/** Out of the world (the socket dropped): the window must not stay over the lobby. */
export function reset() { st.ab = null; st.pending = null; st.result = null; st.shown = ""; close(); }
/** Every snapshot: the shift in hand (or its absence = closed). */
export function onSnap(s) {
  const ab = s.ab;
  if (!ab) { st.ab = null; if (st.k) close(); return; }
  const t = performance.now();
  st.ab = ab; st.recv = t; st.toStart = ab[2]; st.toEnd = ab[3]; st.fever = ab[6];
  st.startAt = t + ab[2]; st.endAt = t + ab[3]; st.feverEnd = t + ab[6];
  if (ab[8]) st.result = ab[8];
  if (!st.k) { if (ab[7]) st.pending = ab[7]; open(ab[0]); }
  else if (ab[7] && st.mod) st.mod.setState(ab[7], t);
  if (ab[1] && st.dom && st.result && !st.shown) showResult();
}

// ── keys: while a shift is open the world gets none (the game may take them)
addEventListener("keydown", (e) => {
  if (!st.k) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") { e.preventDefault(); return; }
  if (st.mod && st.mod.key && st.mod.key(e)) e.preventDefault();
}, true);
addEventListener("keyup", (e) => {
  if (!st.k || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
  e.stopImmediatePropagation();
  if (st.mod && st.mod.keyup) st.mod.keyup(e);   // optional: a game that needs releases (holds)
}, true);

// ── the result card
function showResult() {
  const d = st.dom, r = st.result, [g, score, par, best, code, maxc, cuts, prev = 0, gold = 0, hot = 0, out = 0] = r, k = st.k;
  st.shown = "1";
  d.res.hidden = false; d.res.textContent = "";
  const stamp = el("div", `ap-stamp g${g}`, g ? "CBAS"[g - 1] : "－");
  const rec = score > prev && score > 0 ? (prev ? `신기록! (이전 ${prev.toLocaleString()}점)` : "첫 기록!") : "";
  const lines = [
    `점수 ${score.toLocaleString()} (기준 ${par.toLocaleString()})`, `최고 기록 ${best.toLocaleString()} · 최대 콤보 ${maxc}`,
    out && ["b", `큰 실수 ${G.defs.alba.rows[k].lives}번 — 근무가 일찍 끝났어요.`],
    rec && ["b", rec],
    code === 1 ? ["b", `보수 ${gold.toLocaleString()}G${hot ? " · 특근 보너스!" : ""}`] : "",
    ["C 등급에 닿지 못했어요. 오늘 다시 도전할 수 있어요.", "오늘의 보수를 받았습니다!", "오늘 이 알바의 보수는 이미 받았어요 (연습 기록).", "오늘 받을 수 있는 보수 횟수를 모두 썼어요."][code],
    `다음 등급까지: ${g >= 4 ? "최고 등급!" : `${["C", "B", "A", "S"][g]} ${cuts[g].toLocaleString()}점`}`,
  ].filter(Boolean);
  const btns = el("div", "ap-btns");
  const again = el("button", "btn", "한 번 더"), ok = el("button", "btn gold", "닫기");
  again.type = ok.type = "button";
  again.addEventListener("click", () => { act({ t: "ab_close" }); act({ t: "ab_start", k }); });   // the server takes them in order
  ok.addEventListener("click", () => act({ t: "ab_close" }));
  btns.append(again, ok);
  d.res.append(stamp, ...lines.map((l) => (Array.isArray(l) ? el("p", "ap-rec", l[1]) : el("p", "", l))), btns);
  d.quit.textContent = "닫기";
  api.sfx(g >= 3 ? "alba_win" : g ? "alba_big" : "alba_bad");
}

// ── the stage: the hero at work
let look = null, lookKey = "";
function heroFrames() {
  const w = G.who && G.who.get(G.you);
  if (!w) return null;
  const row = G.defs.alba.rows[st.k], mine = (w.gear && w.gear.cos) || [], slot = (id) => id.split("_")[0];
  const cos = mine.filter((id) => !row.outfit.some((o) => slot(o) === slot(id))).concat(row.outfit);
  const key = `${st.k}|${w.cls}|${JSON.stringify(w.look)}|${cos.join(",")}`;
  if (key !== lookKey) { lookKey = key; look = SP.personSheet(SP.playerLook(w.cls, w.look, { ...(w.gear || {}), cos })); }
  return look;
}
function react(kind, text, x, y) {
  const t = performance.now();
  st.react = { kind, at: t };
  st.act = kind === "bad" ? 0 : Math.min(1, (st.act || 0) + (kind === "good" ? 0.3 : 0.6));
  const col = kind === "bad" ? "#ff6a5a" : kind === "big" ? "#ffd84a" : kind === "fever" ? "#ff9a3a" : "#ffffff";
  const n = kind === "big" || kind === "fever" ? 12 : kind === "bad" ? 6 : 4;
  for (let i = 0; i < n; i++) st.parts.push({ x: 150 + Math.random() * 30, y: 70, vx: (Math.random() - 0.3) * 90, vy: -30 - Math.random() * 70, life: 0.7, col });
  if (text) st.parts.push({ x: x ?? 190, y: y ?? 40, vx: 0, vy: -26, life: 0.9, col, txt: text });
  api.sfx(kind === "bad" ? "alba_bad" : kind === "big" ? "alba_big" : kind === "fever" ? "alba_fever" : "alba_ok");
}
function drawTool(g, tool, x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const r = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(a, b, w, h); };
  if (tool === "swatter") { r("#7a5a3a", -1, -4, 3, 22); r("#9ae06a", -6, -18, 13, 14); r("#4a8a3a", -4, -16, 2, 10); r("#4a8a3a", 0, -16, 2, 10); r("#4a8a3a", 4, -16, 2, 10); }
  else if (tool === "scanner") { r("#cfd4da", -4, -2, 12, 14); r("#6a6e76", -2, 8, 8, 8); r("#ff3a3a", 8, 1, 6, 2); }
  else if (tool === "box") { r("#c8a06a", -9, -10, 22, 18); r("#a8803a", -9, -10, 22, 3); r("#f0e0b0", 0, -10, 4, 18); }
  else if (tool === "basket") { r("#4a78b8", -9, -2, 20, 12); r("#6a98d8", -9, -2, 20, 3); r("#ffffff", -6, -8, 8, 7); r("#ff8ac0", 2, -9, 7, 8); }
  else if (tool === "spatula") { r("#7a5a3a", -1, 2, 3, 18); r("#cfd4da", -6, -12, 13, 14); r("#aab0b8", -4, -10, 9, 10); }
  else if (tool === "sprayer") { r("#cfd4da", -3, -4, 8, 16); r("#6a9a4a", -2, -10, 6, 7); r("#3a3e44", 4, -2, 9, 3); r("#b4f04a", 14, -3, 3, 5); }
  else if (tool === "chain") { for (let i = 0; i < 5; i++) r("#8a8e96", -2 + i * 3, -4 + (i % 2) * 3, 4, 3); r("#4a4e56", 12, -6, 10, 10); }
  else if (tool === "parcelbag") { r("#a8803a", -8, -6, 18, 16); r("#c8a050", -8, -6, 18, 4); r("#e8d8b0", -1, -6, 3, 16); }
  else if (tool === "torch") { r("#7a5a3a", -1, -2, 3, 22); r("#ffc84a", -3, -12, 8, 10); r("#fff0a0", -1, -9, 4, 5); }
  else if (tool === "lute") { r("#8a5a2a", -7, 0, 14, 12); r("#6a3e1a", -5, 3, 10, 6); r("#7a5a3a", 6, -14, 3, 16); r("#e8d8a0", -1, 6, 2, 2); }
  else if (tool === "shears") { r("#9aa0aa", -6, -14, 3, 16); r("#9aa0aa", 3, -14, 3, 16); r("#c04a4a", -7, 2, 5, 8); r("#c04a4a", 3, 2, 5, 8); }
  else { r("#aab4c0", -2, -14, 4, 24); r("#d8e0ea", -7, -18, 14, 7); r("#6a7480", -3, -17, 6, 3); r("#7a4a2a", -1, 8, 3, 12); }   // wrench
  g.restore();
}
function stage(t, phase) {
  const d = st.dom, g = d.g, row = G.defs.alba.rows[st.k], W = 480, H = 120;
  Stage.hiRes(d.stage, g, W, H);
  const dt = Math.min(0.05, Math.max(0, (t - (st.sAt || t)) / 1000)); st.sAt = t;
  st.act = Math.max(0, (st.act || 0) - dt * 0.45);
  const fevered = !!st.endAt && t < st.feverEnd, run = phase === "run";
  st.ph = (st.ph || 0) + dt * (run ? 1.05 : 0.45) * (1 + 1.5 * st.act) * (fevered ? 1.25 : 1);
  const r = st.react, since = r ? t - r.at : 1e9, bad = r && r.kind === "bad" && since < 420;
  const a = { ph: st.ph, act: st.act, kind: r ? r.kind : "", since, fever: fevered, run, prog: clamp((st.ab[4] || 0) / (G.defs.alba.rows[st.k].par || 1), 0, 1) };
  Stage.back(g, st.k, t, a);
  const p = Stage.pose(st.k, a);
  const hop = since < 220 && !bad ? Math.sin((since / 220) * Math.PI) * 5 : 0, shake = bad ? Math.sin(since / 18) * 3 : 0;
  const bx = Math.round(150 + shake + p.dx), by = Math.round(20 - hop + p.dy + (fevered ? Math.sin(t / 60) * 2 : 0));
  p.hx = bx; p.hy = by;
  const sheet = heroFrames();
  if (sheet) {
    const fr = sheet.front, f = fr[p.walk ? Math.min(fr.length - 1, p.fr) : p.hit ? Math.min(1, fr.length - 1) : 0] || fr[0];
    g.fillStyle = "rgba(40,30,60,.32)"; g.fillRect(bx + 16, 99, 56, 5); g.fillRect(bx + 22, 97, 44, 2);
    SP.drawPersonCrop(g, f, 5, 5, 22, 22, bx, by, 88, 88);
  }
  drawTool(g, row.tool, bx + p.tx, by + p.ty, bad ? p.ta * -0.4 : p.ta);
  Stage.front(g, st.k, t, a, p);
  if (bad) { g.fillStyle = "#7ad0ff"; g.fillRect(bx + 62, by + 14 + Math.round(since / 40), 3, 5); g.fillStyle = "#ff6a5a"; g.fillRect(bx + 70, by + 2, 3, 8); g.fillRect(bx + 70, by + 12, 3, 3); }
  if (fevered) { g.fillStyle = "rgba(255,170,60,.18)"; g.fillRect(0, 0, W, H); }
  const dt2 = 1 / 60;
  for (let i = st.parts.length - 1; i >= 0; i--) {
    const q = st.parts[i]; q.life -= dt2; if (q.life <= 0) { st.parts.splice(i, 1); continue; }
    q.x += q.vx * dt2; q.y += q.vy * dt2; q.vy += (q.txt ? 0 : 160) * dt2;
    g.globalAlpha = clamp(q.life * 2, 0, 1); g.fillStyle = q.col;
    if (q.txt) { g.font = "900 18px Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"; g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = "#2a2236"; g.strokeText(q.txt, q.x, q.y); g.fillStyle = q.col; g.fillText(q.txt, q.x, q.y); } else g.fillRect(Math.round(q.x), Math.round(q.y), 3, 3);
  }
  g.globalAlpha = 1;
  if (st.parts.length > 80) st.parts.splice(0, st.parts.length - 80);
}

// ── score feedback: big +N / −N over the board, the multiplier, banners for fever and the last rush
/** The points multiplier as the rules apply it (66-alba.js albaMult), only to show it. */
const mult = (combo, fever, rush) => (1 + 0.1 * Math.min(combo, 10)) * (fever ? 2 : 1) * (rush ? 1.5 : 1);
/** Restart a one-shot CSS animation class on an element. */
function jolt(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function scorePop(dl, par, m) {
  const d = st.dom, share = Math.abs(dl) / Math.max(1, par);
  const tier = share >= 0.05 ? 3 : share >= 0.025 ? 2 : share >= 0.01 ? 1 : 0;
  const p = el("b", `ap-pop t${tier}${dl < 0 ? " neg" : ""}`, `${dl > 0 ? "+" : "−"}${Math.abs(Math.round(dl)).toLocaleString()}`);
  if (dl > 0 && m > 1.05) p.append(el("small", "", `×${m.toFixed(1)}`));
  // scattered a little so a burst of points does not stack on one spot
  p.style.left = `${50 + (Math.random() * 2 - 1) * 16}%`; p.style.top = `${48 + (Math.random() * 2 - 1) * 8}%`;
  d.pops.append(p); setTimeout(() => p.remove(), 1200);
  while (d.pops.querySelectorAll(".ap-pop").length > 7) d.pops.querySelector(".ap-pop").remove();
  jolt(d.score, dl > 0 ? "bump" : "drop");
  if (dl > 0) api.sfx("alba_gain", tier); else jolt(d.box, "shake");
}
function banner(text, cls) {
  const b = el("div", `ap-banner ${cls}`, text);
  st.dom.pops.append(b); setTimeout(() => b.remove(), 1700);
  api.sfx(cls === "fever" ? "alba_fever" : "alba_big");
}

// ── every animation frame
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export function tick(t) {
  if (!st.k || !st.dom || !st.ab) return;
  const d = st.dom, toStart = Math.max(0, st.startAt - t), left = Math.max(0, st.endAt - t), ended = !!st.ab[1];
  const phase = ended ? "end" : toStart > 0 ? "brief" : "run", fever = Math.max(0, st.feverEnd - t);
  const par = G.defs.alba.rows[st.k].par, score = st.ab[4], combo = st.ab[5];
  // the socket dropped (net.js retries by itself): say so over the frozen board; the shift will not survive a new connection
  const down = !(ws && ws.readyState === 1);
  if (down !== st.down) {
    st.down = down; d.root.classList.toggle("down", down);
    d.hint.textContent = down ? "서버와의 연결이 끊겼어요. 다시 연결하는 중… 진행하던 알바는 이어지지 않을 수 있어요." : G.defs.alba.rows[st.k].hint;
  }
  const lives = st.ab[11] || 0, hearts = lives ? " " + "♥".repeat(Math.max(0, lives - (st.ab[10] || 0))) + "♡".repeat(Math.min(lives, st.ab[10] || 0)) : "";
  const txt = (ended ? "종료" : phase === "brief" ? `준비 ${Math.ceil(toStart / 1000)}` : mmss(left)) + hearts;
  if (txt !== st.last.t) { d.time.textContent = txt; st.last.t = txt; if (phase === "run" && left < 10500 && left > 0) api.sfx("alba_tick"); if (st.last.h !== undefined && hearts.length && st.ab[10] > st.last.h) { api.sfx("alba_hurt"); jolt(d.box, "hurt"); jolt(d.time, "lost"); } st.last.h = st.ab[10] || 0; }
  const rush = left < G.defs.alba.rushMs && phase === "run";
  if (score !== st.last.s) {
    const dl = st.last.s >= 0 && phase !== "end" ? score - st.last.s : 0;
    st.last.s = score; d.fill.style.width = `${clamp(score / par / 1.1, 0, 1) * 100}%`;
    if (dl) scorePop(dl, par, mult(combo - 1, fever > 0, rush));   // the points were counted before the combo stepped up
    else st.disp = score;
  }
  // the score counts up to the server's number instead of jumping
  if (st.disp !== score) st.disp = Math.abs(score - st.disp) < 1.5 ? score : st.disp + (score - st.disp) * 0.22;
  const shown = `${Math.round(st.disp).toLocaleString()}점`;
  if (shown !== d.score.textContent) d.score.textContent = shown;
  if (fever > 0 && !st.wasFever && phase === "run") banner("피버! 점수 ×2", "fever");
  if (rush && !st.wasRush) banner("막판 러시! 점수 ×1.5", "rush");
  st.wasFever = fever > 0; st.wasRush = rush;
  const ck = `${combo}|${fever > 0}|${left < G.defs.alba.rushMs}`;
  if (ck !== st.last.c) {
    st.last.c = ck;
    const m = mult(combo, fever > 0, left < G.defs.alba.rushMs && !ended);
    d.combo.textContent = combo > 1 ? `콤보 ${combo}${fever > 0 ? " 🔥 피버!" : ""}${left < G.defs.alba.rushMs && !ended ? " · 막판 러시" : ""}` : (left < G.defs.alba.rushMs && !ended ? "막판 러시!" : "");
    if (m > 1.05) d.combo.append(el("b", "ap-mul", ` ×${m.toFixed(1)}`));
    if (combo > 1) jolt(d.combo, "bump");
    d.root.classList.toggle("fever", fever > 0);
  }
  if (phase !== st.prevPhase) { if (phase === "run" && st.prevPhase === "brief") api.sfx("alba_go"); if (phase === "end" && st.prevPhase === "run") api.sfx("alba_end"); st.prevPhase = phase; }
  stage(t, phase);
  if (st.mod) st.mod.frame(t, { phase, left, toStart, score, combo, fever, rush: left < G.defs.alba.rushMs });
}

// ── the 알바 window: the games, today's pay, best scores; [시작]
export const listKey = () => { const s = G.self || {}; return [s.alba, s.coop, s.rep, !!(G.defs && G.defs.alba), s.lvl, G.map && G.map.id]; };   // hud.js draw() calls it with no argument
export function renderList(s) {
  const box = $("#alba-body");
  box.textContent = "";
  const D = G.defs.alba;
  if (!D || !s.alba) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const [done, best, slots, hot = []] = s.alba, inTown = !G.map || !D.field.includes(G.map.id);
  const stampOf = (k) => { let g = 0; while (g < 4 && (best[k] || 0) >= Math.round(D.rows[k].par * D.cuts[g])) g++; return g; };
  const nS = D.order.filter((k) => stampOf(k) === 4).length;
  const top = el("div", "daily-top");
  top.append(el("span", "", `오늘의 알바 보수 ${D.perDay - slots}/${D.perDay}`), el("b", "", "매일 아침 6시에 새로 받을 수 있어요"));
  box.append(top);
  box.append(el("p", "hint", `S 도장 ${nS}/${D.order.length}${hot.length ? ` · 오늘의 특근: ${hot.map((k) => D.rows[k].name).join(", ")} (보수 +${Math.round((D.hot - 1) * 100)}%)` : ""}`));
  box.append(el("p", "hint", `한 번에 약 ${Math.round((D.runMs + D.briefMs) / 60000 * 10) / 10}분. 종류마다 하루 한 번 보수를 받고, 다시 하면 기록 연습이에요. 하루에 ${D.perDay}번까지 보수를 받을 수 있어요.`));
  for (const k of D.order) {
    const r = D.rows[k], g = done[k], card = el("div", "dcard jb-card" + (g ? " done" : ""));
    const hd = el("div", "dh"), nm = el("b", "", r.name), tags = el("span", "");
    const tag = (txt, bg) => { const x = el("span", "tag", txt); if (bg) x.style.background = bg; x.style.marginLeft = "3px"; tags.append(x); };
    if (hot.includes(k) && !g) tag(`특근 +${Math.round((D.hot - 1) * 100)}%`, "#ff9a3a");
    if (g) tag(`오늘 ${"CBAS"[g - 1]} 보수 받음`, "#5ee07a"); else if (!slots) tag("오늘 보수 끝", "#999");
    if (best[k]) tag(`최고 ${stampOf(k) ? "CBAS"[stampOf(k) - 1] + " · " : ""}${best[k].toLocaleString()}점`, stampOf(k) === 4 ? "#ffd84a" : "");
    hd.append(nm, tags);
    card.append(hd, el("p", "say", r.hint), el("small", "where", `${r.place} · 기준 ${r.par.toLocaleString()}점`));
    const btns = el("div", "btns"), b = el("button", "btn gold", "시작");
    b.type = "button"; b.disabled = !inTown;   // (a shift in hand covers this window; the server refuses a second one)
    if (!inTown) b.title = "마을에서 시작할 수 있어요";
    b.addEventListener("click", () => { Sound.play("ui"); act({ t: "ab_start", k }); });
    btns.append(b);
    if (!inTown) btns.append(el("small", "why", "마을에서 시작할 수 있어요"));
    card.append(btns);
    box.append(card);
  }
  Board.albaExtras(box, s);   // 협동 알바 (with a way to each) and the trust with the 알바 residents
}
