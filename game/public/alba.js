/**
 * 일일 아르바이트 in the browser (logic 66-alba.js, plan docs/design/daily-alba-minigames-2026-11-16.md). The server runs the shift;
 * this opens its own window while `snap.ab` is present and draws two halves: the TOP stage (the hero in the job's outfit, working)
 * and the BOTTOM board (the game's own module `alba_<k>.js`). The 알바 window (#w-alba) lists the games and starts them.
 *
 * snap.ab = [k, ended, ms to start, ms to end, score, combo, fever ms left, game state | 0 (unchanged), result | 0, rev]
 * A game module (public/alba_<k>.js) has a default export:
 *   mount(host, api)      once, `host` is an empty div (the board); build DOM / a canvas in it
 *   setState(g, recvAt)   the server's view(): the full state, only when it changed (times in it are ms FROM THE MOMENT OF RECEIPT, recvAt = performance.now() then)
 *   frame(t, info)        every animation frame while the window is open; `info` = { phase: "brief"|"run"|"end", left, toStart, score, combo, fever, rush }
 *   key(e)  (optional)    a keydown: return true if the game used it (the world never sees keys while a shift is open)
 *   unmount()             the window closed
 * api = { act(obj) → sends {t:"ab_act", ...obj}, fx(kind, text?, x?, y?) → the stage reacts ("good" | "bad" | "big" | "fever"), sfx(name), now() }
 * Sounds the games may use: alba_ok alba_big alba_bad alba_fever alba_tick (audio.js), anything else is silent.
 */
import { Sound } from "./audio.js";
import * as SP from "./sprites.js";
import { G, $, el, clamp } from "./state.js";
import { act } from "./net.js";
import { ask } from "./windows.js";

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
  sfx: (name) => { try { Sound.play(name); } catch { /* a missing sound is silent */ } },
  now: () => performance.now(),
};
const opened = () => !!st.k;

// ── the window (built once)
function build() {
  if (st.dom) return st.dom;
  const root = el("div", "");
  root.id = "alba-play"; root.hidden = true;
  const box = el("div", "ap-box"), head = el("div", "ap-head");
  const title = el("b", "ap-title"), time = el("span", "ap-time"), score = el("span", "ap-score"), combo = el("span", "ap-combo");
  const quit = el("button", "btn small", "그만두기"); quit.type = "button";
  quit.addEventListener("click", () => {
    if (st.ab && st.ab[1]) { act({ t: "ab_close" }); return; }
    ask("아르바이트를 그만둘까요? 보수는 받을 수 없습니다.", "그만두기", () => act({ t: "ab_leave" }));
  });
  head.append(title, time, score, combo, quit);
  const stage = document.createElement("canvas"); stage.className = "ap-stage"; stage.width = 480; stage.height = 120;
  const bar = el("div", "ap-bar"), fill = el("i", "ap-fill"); bar.append(fill);
  const marks = ["C", "B", "A", "S"].map((l) => { const m = el("span", "ap-mark", l); bar.append(m); return m; });
  const board = el("div", "ap-board"), res = el("div", "ap-res"); res.hidden = true;
  const hint = el("div", "ap-hint");
  box.append(head, stage, bar, hint, board, res);
  root.append(box);
  document.body.append(root);
  st.dom = { root, box, title, time, score, combo, stage, g: stage.getContext("2d"), bar, fill, marks, board, res, hint, quit };
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
    st.k = k; st.mod = mod; st.parts.length = 0; st.react = null; st.result = null; st.shown = "";
    d.title.textContent = row.name; d.hint.textContent = row.hint; d.res.hidden = true; d.res.textContent = "";
    d.board.textContent = ""; d.root.hidden = false; d.quit.textContent = "그만두기";
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
}

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
addEventListener("keyup", (e) => { if (st.k && !(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) e.stopImmediatePropagation(); }, true);

// ── the result card
function showResult() {
  const d = st.dom, r = st.result, [g, score, par, best, code, maxc, cuts] = r;
  st.shown = "1";
  d.res.hidden = false; d.res.textContent = "";
  const stamp = el("div", `ap-stamp g${g}`, g ? "CBAS"[g - 1] : "－");
  const lines = [
    `점수 ${score.toLocaleString()} (기준 ${par.toLocaleString()})`, `최고 기록 ${best.toLocaleString()} · 최대 콤보 ${maxc}`,
    ["C 등급에 닿지 못했어요. 오늘 다시 도전할 수 있어요.", "오늘의 보수를 받았습니다!", "오늘 이 알바의 보수는 이미 받았어요 (연습 기록).", "오늘 받을 수 있는 보수 횟수를 모두 썼어요."][code],
    `다음 등급까지: ${g >= 4 ? "최고 등급!" : `${["C", "B", "A", "S"][g]} ${cuts[g].toLocaleString()}점`}`,
  ];
  const ok = el("button", "btn gold", "확인"); ok.type = "button"; ok.addEventListener("click", () => act({ t: "ab_close" }));
  d.res.append(stamp, ...lines.map((l) => el("p", "", l)), ok);
  d.quit.textContent = "닫기";
  api.sfx(g ? "alba_big" : "alba_bad");
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
function stage(t) {
  const d = st.dom, g = d.g, row = G.defs.alba.rows[st.k], th = THEME[row.tool] || THEME.box, W = 480, H = 120;
  g.fillStyle = th[0]; g.fillRect(0, 0, W, 78); g.fillStyle = th[1]; g.fillRect(0, 78, W, H - 78);
  g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 78, W, 2);
  // props: a few quiet blocks in the job's accent
  g.fillStyle = th[2]; g.globalAlpha = 0.25; for (let i = 0; i < 6; i++) g.fillRect(20 + i * 78, 18 + (i % 2) * 12, 40, 22); g.globalAlpha = 1;
  const r = st.react, since = r ? t - r.at : 1e9, hop = since < 220 ? Math.sin((since / 220) * Math.PI) * 8 : 0;
  const busy = since < 320, fevered = st.endAt && t < st.feverEnd, shake = r && r.kind === "bad" && since < 260 ? Math.sin(since / 18) * 3 : 0;
  const sheet = heroFrames();
  const bx = 150 + shake, by = 20 - hop + (fevered ? Math.sin(t / 60) * 2 : 0);
  if (sheet) {
    const fr = sheet.front, f = fr[busy ? 1 + (Math.floor(t / 90) % (fr.length - 1)) : 0] || fr[0];
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(bx + 44, 100, 30, 6, 0, 0, 7); g.fill();
    SP.drawPersonCrop(g, f, 5, 5, 22, 22, bx, by, 88, 88);
  }
  const swing = busy ? Math.sin((since / 320) * Math.PI) * 1.1 : Math.sin(t / 500) * 0.12;
  drawTool(g, row.tool, bx + 94, by + 52, -0.5 + swing * (r && r.kind === "bad" ? -0.5 : 1));
  if (fevered) { g.fillStyle = "rgba(255,150,40,.25)"; g.fillRect(0, 0, W, H); }
  // sparks and numbers
  const dt = 1 / 60;
  for (let i = st.parts.length - 1; i >= 0; i--) {
    const p = st.parts[i]; p.life -= dt; if (p.life <= 0) { st.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.txt ? 0 : 160) * dt;
    g.globalAlpha = clamp(p.life * 2, 0, 1); g.fillStyle = p.col;
    if (p.txt) { g.font = "bold 14px sans-serif"; g.fillText(p.txt, p.x, p.y); } else g.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
  }
  g.globalAlpha = 1;
  if (st.parts.length > 80) st.parts.splice(0, st.parts.length - 80);
}

// ── every animation frame
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export function tick(t) {
  if (!st.k || !st.dom || !st.ab) return;
  const d = st.dom, toStart = Math.max(0, st.startAt - t), left = Math.max(0, st.endAt - t), ended = !!st.ab[1];
  const phase = ended ? "end" : toStart > 0 ? "brief" : "run", fever = Math.max(0, st.feverEnd - t);
  const par = G.defs.alba.rows[st.k].par, score = st.ab[4], combo = st.ab[5];
  const txt = ended ? "종료" : phase === "brief" ? `준비 ${Math.ceil(toStart / 1000)}` : mmss(left);
  if (txt !== st.last.t) { d.time.textContent = txt; st.last.t = txt; if (phase === "run" && left < 10500 && left > 0) api.sfx("alba_tick"); }
  if (score !== st.last.s) { d.score.textContent = `${score.toLocaleString()}점`; st.last.s = score; d.fill.style.width = `${clamp(score / par / 1.1, 0, 1) * 100}%`; }
  const ck = `${combo}|${fever > 0}|${left < G.defs.alba.rushMs}`;
  if (ck !== st.last.c) {
    st.last.c = ck;
    d.combo.textContent = combo > 1 ? `콤보 ${combo}${fever > 0 ? " 🔥 피버!" : ""}${left < G.defs.alba.rushMs && !ended ? " · 막판 러시" : ""}` : (left < G.defs.alba.rushMs && !ended ? "막판 러시!" : "");
    d.root.classList.toggle("fever", fever > 0);
  }
  stage(t);
  if (st.mod) st.mod.frame(t, { phase, left, toStart, score, combo, fever, rush: left < G.defs.alba.rushMs });
}

// ── the 알바 window: the games, today's pay, best scores; [시작]
export const listKey = (s) => [s.alba, !!G.defs?.alba, s.lvl, G.map && G.map.id, !!s.ab];
export function renderList(s) {
  const box = $("#alba-body");
  box.textContent = "";
  const D = G.defs.alba;
  if (!D || !s.alba) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const [done, best, slots] = s.alba, inTown = !G.map || !D.field.includes(G.map.id);
  const top = el("div", "daily-top");
  top.append(el("span", "", `오늘의 알바 보수 ${D.perDay - slots}/${D.perDay}`), el("b", "", "매일 아침 6시에 새로 받을 수 있어요"));
  box.append(top);
  box.append(el("p", "hint", `한 번에 약 ${Math.round((D.runMs + D.briefMs) / 60000 * 10) / 10}분. 종류마다 하루 한 번 보수를 받고, 다시 하면 기록 연습이에요. 하루에 ${D.perDay}번까지 보수를 받을 수 있어요.`));
  for (const k of D.order) {
    const r = D.rows[k], g = done[k], card = el("div", "dcard jb-card" + (g ? " done" : ""));
    const hd = el("div", "dh"), nm = el("b", "", r.name), tags = el("span", "");
    const tag = (txt, bg) => { const x = el("span", "tag", txt); if (bg) x.style.background = bg; x.style.marginLeft = "3px"; tags.append(x); };
    if (g) tag(`오늘 ${"CBAS"[g - 1]} 보수 받음`, "#5ee07a"); else if (!slots) tag("오늘 보수 끝", "#999");
    if (best[k]) tag(`최고 ${best[k].toLocaleString()}점`);
    hd.append(nm, tags);
    card.append(hd, el("p", "say", r.hint), el("small", "where", `${r.place} · 기준 ${r.par.toLocaleString()}점`));
    const btns = el("div", "btns"), b = el("button", "btn gold", s.ab ? "진행 중" : "시작");
    b.type = "button"; b.disabled = !!s.ab || !inTown;
    if (!inTown) b.title = "마을에서 시작할 수 있어요";
    b.addEventListener("click", () => { Sound.play("ui"); act({ t: "ab_start", k }); });
    btns.append(b);
    if (!inTown) btns.append(el("small", "why", "마을에서 시작할 수 있어요"));
    card.append(btns);
    box.append(card);
  }
}
