/**
 * Small games played over the world: reeling a fish in to a rhythm, packing a
 * pan like a tangram, and (L2b stations) hammering on a heat bar and stirring a
 * brew. Each ends by reporting a score from 0 to 100 (`null`: walked away);
 * the server decides what that score is worth.
 */
import { Sound } from "./audio.js";
import * as Keymap from "./keymap.js";

let root = null, closer = null;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function mount(host) { root = host; }
export const active = () => !!closer;
/** Shut whatever is open without reporting a score (the fish got away, the fire went out). */
export function close() { if (closer) closer(); }

function open(title, hint) {
  root.textContent = "";
  root.hidden = false;
  const box = el("div", "mg win");
  box.append(el("header", "", title), el("p", "mg-hint", hint));
  root.append(box);
  return box;
}
function shut(cleanup) {
  closer = () => { cleanup(); root.hidden = true; root.textContent = ""; closer = null; };
}

// ───────────────────────────── fishing: a rhythm ─────────────────────────────
// Ripples drift toward the float; tap as each one reaches it. Good timing keeps
// the line taut, and the average of every beat is the score.

const BEAT = 430, LEAD = 1500;          // ms per beat; how long a ripple takes to arrive
const PATTERNS = [
  [1, 1, 1, 2, 1, 1, 2, 0.5, 0.5, 1, 2],
  [1, 2, 1, 1, 0.5, 0.5, 1, 2, 1, 1, 1],
  [2, 1, 1, 0.5, 0.5, 1, 1, 2, 1, 0.5, 0.5, 1],
  [1, 1, 2, 0.5, 0.5, 0.5, 0.5, 2, 1, 1, 2],
];

export function fishing(onDone) {
  const box = open("낚시 — 박자에 맞춰 당기기", `물결이 찌에 닿는 순간 ${Keymap.label("interact")} · ${Keymap.label("attack")} · 화면을 누르세요`);
  const cv = el("canvas", "mg-lane");
  cv.width = 340; cv.height = 96;
  const g = cv.getContext("2d");
  const info = el("div", "mg-info", "준비…");
  box.append(cv, info);

  const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  const t0 = performance.now() + 900;
  let at = 0;
  const notes = pattern.map((gap) => { at += gap * BEAT; return { t: t0 + at, hit: null }; });
  const HIT_X = 64, FAR_X = 330;
  let combo = 0, flash = 0, word = "", wordCol = "#fff", done = false, raf = 0;

  const judge = (now) => {
    // the closest ripple still waiting, within reach
    let best = null, bd = 190;
    for (const n of notes) { if (n.hit !== null) continue; const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } }
    if (!best) { combo = 0; word = "헛손질"; wordCol = "#9aa0b0"; Sound.play("slack"); return; }
    best.hit = bd <= 75 ? 100 : bd <= 150 ? 65 : 25;
    if (best.hit >= 65) combo++; else combo = 0;
    Sound.play(best.hit >= 65 ? "reel" : "slack", best.hit === 100 ? 2 : 1);
    word = best.hit === 100 ? "완벽!" : best.hit === 65 ? "좋아요" : "아슬아슬";
    wordCol = best.hit === 100 ? "#ffe04a" : best.hit === 65 ? "#9af0ae" : "#ffb070";
    flash = 1;
  };
  const press = (e) => {
    if (e.type === "keydown") {
      if (e.repeat) return;
      if (e.key === "Escape") { finish(true); return; }
      if (!(Keymap.is(e, "interact") || Keymap.is(e, "attack") || e.key === "Enter")) return;
      e.preventDefault();
    }
    if (!done) judge(performance.now());
  };
  const finish = (gaveUp) => {
    if (done) return;
    done = true;
    for (const n of notes) if (n.hit === null) n.hit = 0;
    const score = gaveUp ? 0 : Math.round(notes.reduce((s, n) => s + n.hit, 0) / notes.length);
    info.textContent = score >= 95 ? `완벽한 낚시! ${score}점` : score >= 30 ? `낚았다! ${score}점` : `줄이 끊어졌다… ${score}점`;
    Sound.play(gaveUp ? "fail" : score >= 30 ? "landed" : "snap");
    setTimeout(() => { if (closer) closer(); onDone(score); }, 650);
  };
  const draw = () => {
    const now = performance.now();
    g.clearRect(0, 0, cv.width, cv.height);
    // water
    g.fillStyle = "#3f7fd0"; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#5a98e0";
    for (let i = 0; i < 9; i++) g.fillRect(((i * 53 + now / 40) % (cv.width + 30)) - 30, 14 + (i % 4) * 22, 22, 2);
    // the float, and the ring to hit
    g.strokeStyle = flash > 0 ? wordCol : "rgba(255,255,255,.85)"; g.lineWidth = 3;
    g.beginPath(); g.arc(HIT_X, 48, 17 + flash * 4, 0, 7); g.stroke();
    g.fillStyle = "#2b2233"; g.fillRect(HIT_X - 5, 36, 10, 18); g.fillStyle = "#fff"; g.fillRect(HIT_X - 3, 38, 6, 5); g.fillStyle = "#e84a5a"; g.fillRect(HIT_X - 3, 43, 6, 9);
    flash = Math.max(0, flash - 0.08);
    let left = 0;
    for (const n of notes) {
      const k = (n.t - now) / LEAD;                      // 1 far away, 0 on the float
      if (n.hit === null && n.t - now < -150) { n.hit = 0; combo = 0; word = "놓침"; wordCol = "#ff7a7a"; Sound.play("slack"); }
      // each ripple drips as it reaches the float, so the beat can be heard as well as seen
      if (!n.dripped && n.t - now <= 0) { n.dripped = true; if (n.hit === null) Sound.play("drip"); }
      if (n.hit === null) left++;
      if (n.hit !== null || k > 1) continue;
      const x = HIT_X + (FAR_X - HIT_X) * k;
      g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, 48, 9, 13, 0, 0, 7); g.stroke();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(x, 48, 5, 8, 0, 0, 7); g.fill();
    }
    g.font = "bold 15px sans-serif"; g.textAlign = "center";
    if (word) { g.fillStyle = wordCol; g.fillText(word, HIT_X, 20); }
    if (combo >= 2) { g.fillStyle = "#fff"; g.textAlign = "right"; g.fillText(`${combo} 콤보`, cv.width - 10, 20); }
    if (!done) info.textContent = now < t0 ? "준비…" : `남은 물결 ${left}`;
    if (!left && now > notes[notes.length - 1].t + 200) finish(false);
    if (!done) raf = requestAnimationFrame(draw);
  };
  addEventListener("keydown", press, true);
  cv.addEventListener("pointerdown", press);
  shut(() => { done = true; cancelAnimationFrame(raf); removeEventListener("keydown", press, true); });
  raf = requestAnimationFrame(draw);
}

// ───────────────────────────── cooking: packing the pan ─────────────────────────────
// The pan is a 4×4 grid and the ingredients are odd-shaped pieces that fill it
// exactly. Pick a piece, turn it, set it down. A full pan, quickly, is a perfect dish.

const N = 4, TIME = 32000;
const COLORS = ["#f0a0b0", "#9ad070", "#f4d860", "#f0e8d8", "#e87060", "#b8a0e8"];

/** Cut the grid into pieces of three to five cells, so a solution always exists. */
function cutPan() {
  const own = new Array(N * N).fill(-1);
  const parts = [];
  const free = () => own.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0);
  const near = (i) => { const x = i % N, y = (i - x) / N; return [x > 0 && i - 1, x < N - 1 && i + 1, y > 0 && i - N, y < N - 1 && i + N].filter((v) => v !== false); };
  while (free().length) {
    const pool = free();
    const cells = [pool[Math.floor(Math.random() * pool.length)]];
    own[cells[0]] = parts.length;
    const want = 3 + Math.floor(Math.random() * 3);
    while (cells.length < want) {
      const opts = [...new Set(cells.flatMap(near))].filter((i) => own[i] < 0);
      if (!opts.length) break;
      const c = opts[Math.floor(Math.random() * opts.length)];
      own[c] = parts.length; cells.push(c);
    }
    parts.push(cells);
  }
  // crumbs of one or two cells join a neighbouring piece
  for (let p = parts.length - 1; p >= 0; p--) {
    if (parts[p].length > 2 || parts.length === 1) continue;
    const to = [...new Set(parts[p].flatMap(near).map((i) => own[i]))].filter((o) => o !== p).sort((a, b) => parts[a].length - parts[b].length)[0];
    if (to === undefined) continue;
    for (const c of parts[p]) { own[c] = to; parts[to].push(c); }
    parts[p] = [];
  }
  return parts.filter((c) => c.length).map((cells) => norm(cells.map((i) => [i % N, Math.floor(i / N)])));
}
function norm(cells) {
  const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const turn = (cells) => norm(cells.map(([x, y]) => [-y, x]));

export function cooking(dish, onDone) {
  const box = open(`요리 — ${dish}`, "재료를 골라(다시 누르면 회전) 팬의 빈칸에 놓아 가득 채우세요");
  const pieces = cutPan().map((cells, i) => {
    let c = cells;
    for (let k = Math.floor(Math.random() * 4); k > 0; k--) c = turn(c);
    return { id: i, cells: c, color: COLORS[i % COLORS.length], at: null };
  });
  const grid = new Array(N * N).fill(-1);
  let sel = -1, done = false, raf = 0, hover = -1;
  const t0 = performance.now();

  const bar = el("div", "mg-time"); const fill = el("i"); bar.append(fill);
  const pan = el("div", "mg-pan");
  const tray = el("div", "mg-tray");
  const info = el("div", "mg-info", "");
  const btns = el("div", "btns");
  const give = el("button", "", "이대로 굽기");
  btns.append(give);
  box.append(bar, pan, tray, info, btns);

  const fits = (p, cx, cy) => p.cells.every(([x, y]) => cx + x < N && cy + y < N && grid[(cy + y) * N + cx + x] < 0);
  const filled = () => grid.filter((v) => v >= 0).length;
  // the pan's cells are made once and only repainted, so a hover never swaps the element under the pointer
  const cells = [];
  for (let i = 0; i < N * N; i++) {
    const c = el("div", "cell");
    c.addEventListener("pointerenter", () => { if (hover !== i) { hover = i; paint(); } });
    c.addEventListener("click", () => place(i));
    pan.append(c);
    cells.push(c);
  }
  pan.addEventListener("pointerleave", () => { hover = -1; paint(); });
  const paint = () => {
    const ghost = new Set();
    if (sel >= 0 && hover >= 0 && fits(pieces[sel], hover % N, Math.floor(hover / N))) for (const [x, y] of pieces[sel].cells) ghost.add((Math.floor(hover / N) + y) * N + (hover % N) + x);
    for (let i = 0; i < N * N; i++) {
      const c = cells[i];
      c.className = grid[i] >= 0 ? "cell on" : ghost.has(i) ? "cell ghost" : "cell";
      c.style.background = grid[i] >= 0 ? pieces[grid[i]].color : ghost.has(i) ? pieces[sel].color : "";
    }
  };
  const render = () => {
    paint();
    tray.textContent = "";
    for (const p of pieces) {
      if (p.at !== null) continue;
      const w = Math.max(...p.cells.map((c) => c[0])) + 1, h = Math.max(...p.cells.map((c) => c[1])) + 1;
      const b = el("div", "piece" + (p.id === sel ? " sel" : ""));
      b.style.gridTemplateColumns = `repeat(${w}, 14px)`;
      const on = new Set(p.cells.map(([x, y]) => y * w + x));
      for (let i = 0; i < w * h; i++) { const d = el("i"); if (on.has(i)) d.style.background = p.color; b.append(d); }
      b.addEventListener("click", () => { if (sel === p.id) p.cells = turn(p.cells); else sel = p.id; Sound.play("pan_turn"); render(); });
      tray.append(b);
    }
    info.textContent = sel >= 0 ? "팬의 칸을 눌러 놓기 · 재료를 다시 누르거나 R 키로 회전" : filled() ? "놓은 재료를 누르면 다시 집습니다" : "재료를 하나 고르세요";
  };
  const place = (i) => {
    if (done) return;
    if (grid[i] >= 0) {
      // pick a placed piece back up
      const id = grid[i];
      for (let k = 0; k < grid.length; k++) if (grid[k] === id) grid[k] = -1;
      pieces[id].at = null; sel = id;
      Sound.play("pan_turn"); render();
      return;
    }
    if (sel < 0) return;
    const p = pieces[sel], cx = i % N, cy = Math.floor(i / N);
    if (!fits(p, cx, cy)) { Sound.play("pan_bump"); return; }
    for (const [x, y] of p.cells) grid[(cy + y) * N + cx + x] = p.id;
    p.at = i; sel = -1;
    Sound.play("pan_place");
    render();
    if (filled() === N * N) finish();
  };
  const finish = () => {
    if (done) return;
    done = true;
    const left = Math.max(0, 1 - (performance.now() - t0) / TIME);
    const full = filled() === N * N;
    const score = full ? Math.round(70 + 30 * left) : Math.round((filled() / (N * N)) * 60);
    info.textContent = score >= 85 ? `완벽한 요리! ${score}점` : score >= 35 ? `먹을 만하다. ${score}점` : `타 버렸다… ${score}점`;
    Sound.play(score >= 35 ? "dish_done" : "dish_burnt");
    setTimeout(() => { if (closer) closer(); onDone(score); }, 700);
  };
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); finish(); return; }
    if ((e.key === "r" || e.key === "R" || e.key === "ㄱ") && sel >= 0) { e.preventDefault(); pieces[sel].cells = turn(pieces[sel].cells); Sound.play("pan_turn"); render(); }
  };
  let sizzleAt = 0;
  const tick = () => {
    const left = 1 - (performance.now() - t0) / TIME;
    // the pan keeps sizzling, hotter and quicker as the time runs out
    if (performance.now() > sizzleAt) { sizzleAt = performance.now() + 420 + Math.max(0, left) * 380; Sound.play("sizzle", 1 - Math.max(0, left)); }
    fill.style.width = `${Math.max(0, left) * 100}%`;
    fill.style.background = left > 0.5 ? "#9af0ae" : left > 0.2 ? "#ffd060" : "#ff7a7a";
    if (left <= 0) finish();
    if (!done) raf = requestAnimationFrame(tick);
  };
  give.addEventListener("click", finish);
  addEventListener("keydown", key, true);
  shut(() => { done = true; cancelAnimationFrame(raf); removeEventListener("keydown", key, true); });
  render();
  raf = requestAnimationFrame(tick);
}

// ───────────────────────────── forging: hammer on the heat (L2b) ─────────────────────────────
// The ingot's heat swings along a bar; strike when the glow sits in the bright band. Five blows,
// each judged by how close it lands; the band narrows and the swing quickens as the work goes on.
// `onDone(score)` with 0..100, or `onDone(null)` when the player steps back from the anvil (Esc).

const BLOWS = 5;
export function forge(title, onDone) {
  const box = open(`제작 — ${title}`, `달군 쇠의 빛이 노란 칸에 들 때 ${Keymap.label("interact")} · ${Keymap.label("attack")} · 화면을 눌러 두드리세요 (5번)`);
  const cv = el("canvas", "mg-lane");
  cv.width = 340; cv.height = 120;
  const g = cv.getContext("2d");
  const info = el("div", "mg-info", "준비…");
  box.append(cv, info);
  const blows = [];
  let phase = Math.random() * 6.28, last = performance.now(), zone = 0.55, word = "", wordCol = "#fff", swing = 0, sparks = [];
  let done = false, raf = 0, lock = 0;
  const t0 = performance.now() + 600;
  const width = () => 0.17 - 0.016 * blows.length;
  const heat = () => 0.5 - 0.5 * Math.cos(phase);
  const strike = (now) => {
    if (done || now < t0 || now < lock) return;
    const d = Math.abs(heat() - zone), w = width();
    const q = d <= w * 0.25 ? 100 : d <= w * 0.5 ? 75 : d <= w ? 40 : 5;
    blows.push(q);
    word = q === 100 ? "완벽!" : q >= 75 ? "좋아요" : q >= 40 ? "아슬아슬" : "빗나감";
    wordCol = q === 100 ? "#ffe04a" : q >= 75 ? "#9af0ae" : q >= 40 ? "#ffb070" : "#ff7a7a";
    Sound.play("forge_hit", q / 100);
    swing = 1; lock = now + 280;
    for (let i = 0; i < 4 + q / 15; i++) sparks.push({ x: 170, y: 54, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1, t: 1 });
    zone = 0.25 + Math.random() * 0.6;
    if (blows.length >= BLOWS) finish(false);
  };
  const press = (e) => {
    if (e.type === "keydown") {
      if (e.repeat) return;
      if (e.key === "Escape") { e.preventDefault(); finish(true); return; }
      if (!(Keymap.is(e, "interact") || Keymap.is(e, "attack") || e.key === "Enter")) return;
      e.preventDefault();
    }
    strike(performance.now());
  };
  const finish = (gaveUp) => {
    if (done) return;
    done = true;
    const score = gaveUp ? null : Math.round(blows.reduce((s, q) => s + q, 0) / BLOWS);
    info.textContent = gaveUp ? "모루에서 물러났습니다" : score >= 85 ? `훌륭한 담금질! ${score}점` : score >= 40 ? `쓸 만하게 두드렸다. ${score}점` : `쇠가 식어 버렸다… ${score}점`;
    Sound.play(gaveUp ? "close" : score >= 40 ? "forge_quench" : "fail");
    setTimeout(() => { if (closer) closer(); onDone(score); }, gaveUp ? 200 : 750);
  };
  const draw = () => {
    const now = performance.now(), dt = Math.min(50, now - last);
    last = now;
    if (now >= t0 && !done) phase += dt * (0.0042 + 0.00075 * blows.length);
    const h = heat();
    g.fillStyle = "#1c1620"; g.fillRect(0, 0, cv.width, cv.height);
    // the forge's glow behind
    g.fillStyle = "#3a2228"; g.fillRect(0, 0, cv.width, 76);
    g.fillStyle = "#552a26"; for (let i = 0; i < 6; i++) g.fillRect(14 + i * 56, 64 - (i % 2) * 4, 40, 12);
    // the anvil
    g.fillStyle = "#2b2233"; g.fillRect(112, 62, 116, 14); g.fillRect(140, 76, 60, 10); g.fillRect(126, 86, 88, 6);
    g.fillStyle = "#6c6a7c"; g.fillRect(114, 62, 112, 4); g.fillStyle = "#4a4858"; g.fillRect(114, 66, 112, 8);
    // the ingot: red → orange → yellow → white with the heat
    const col = h < 0.35 ? "#b8402e" : h < 0.6 ? "#e8742a" : h < 0.85 ? "#f8c440" : "#fff4c8";
    g.fillStyle = "#2b2233"; g.fillRect(146, 52, 48, 12);
    g.fillStyle = col; g.fillRect(148, 54, 44, 8);
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(148, 54, 44, 2);
    // the hammer: up, then down on a blow
    const hy = swing > 0.5 ? 30 : 12 + (1 - swing) * 4;
    g.fillStyle = "#2b2233"; g.fillRect(196, hy - 2, 8, 34); g.fillRect(180, hy - 8, 34, 14);
    g.fillStyle = "#8a6a4a"; g.fillRect(198, hy, 4, 30);
    g.fillStyle = "#9a98aa"; g.fillRect(182, hy - 6, 30, 10); g.fillStyle = "#c8c8d8"; g.fillRect(182, hy - 6, 30, 2);
    swing = Math.max(0, swing - dt / 180);
    // sparks
    for (const s of sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.25; s.t -= dt / 500; if (s.t > 0) { g.fillStyle = s.t > 0.5 ? "#fff4c8" : "#f8a040"; g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); } }
    sparks = sparks.filter((s) => s.t > 0);
    // the heat bar and its bright band (white core = 완벽)
    const BX = 20, BW = 300, BY = 98;
    g.fillStyle = "#2b2233"; g.fillRect(BX - 2, BY - 2, BW + 4, 14);
    const grd = g.createLinearGradient(BX, 0, BX + BW, 0);
    grd.addColorStop(0, "#5a1e1e"); grd.addColorStop(0.5, "#c0582a"); grd.addColorStop(1, "#fff0c0");
    g.fillStyle = grd; g.fillRect(BX, BY, BW, 10);
    const w = width();
    g.fillStyle = "rgba(255,236,90,.85)"; g.fillRect(BX + (zone - w) * BW, BY, 2 * w * BW, 10);
    g.fillStyle = "#fff"; g.fillRect(BX + (zone - w * 0.25) * BW, BY, 0.5 * w * BW, 10);
    const mx = BX + h * BW;
    g.fillStyle = "#2b2233"; g.fillRect(mx - 3, BY - 8, 6, 22);
    g.fillStyle = "#ffffff"; g.fillRect(mx - 1, BY - 6, 2, 18);
    g.font = "bold 15px sans-serif"; g.textAlign = "center";
    if (word) { g.fillStyle = wordCol; g.fillText(word, 64, 30); }
    g.textAlign = "right"; g.fillStyle = "#fff6dc"; g.fillText(`${blows.length}/${BLOWS}`, cv.width - 12, 24);
    if (!done) info.textContent = now < t0 ? "준비…" : `남은 망치질 ${BLOWS - blows.length}`;
    if (!done) raf = requestAnimationFrame(draw);
  };
  addEventListener("keydown", press, true);
  cv.addEventListener("pointerdown", press);
  shut(() => { done = true; cancelAnimationFrame(raf); removeEventListener("keydown", press, true); });
  raf = requestAnimationFrame(draw);
}

// ───────────────────────────── brewing: keep the needle in the green (L2b) ─────────────────────────────
// Hold to stir (the needle climbs), let go and it sinks; the green band wanders. The share of the time
// the needle spends inside the band is the score. It runs at least `ms` (+1.2 s). `onDone(null)` on Esc.

export function brew(title, ms, onDone) {
  const box = open(`연금 — ${title}`, `${Keymap.label("interact")} · ${Keymap.label("attack")} · 화면을 누르고 있으면 바늘이 오르고, 떼면 내려갑니다. 초록 칸 안에 머물게 하세요`);
  const cv = el("canvas", "mg-lane");
  cv.width = 340; cv.height = 120;
  const g = cv.getContext("2d");
  const bar = el("div", "mg-time"); const fill = el("i"); bar.append(fill);
  const info = el("div", "mg-info", "준비…");
  box.append(bar, cv, info);
  const DUR = Math.max(5000, ms + 1200), t0 = performance.now() + 700, W = 0.22;
  let x = 0.3, v = 0, c = 0.5, aim = 0.5, nextAim = 0, hold = false, inside = 0, last = performance.now();
  let done = false, raf = 0, bubbleAt = 0, bubbles = [];
  const isTap = (e) => Keymap.is(e, "interact") || Keymap.is(e, "attack") || e.key === "Enter";
  const down = (e) => {
    if (e.type === "keydown") {
      if (e.repeat) { if (isTap(e)) e.preventDefault(); return; }
      if (e.key === "Escape") { e.preventDefault(); finish(true); return; }
      if (!isTap(e)) return;
      e.preventDefault();
    }
    if (!hold) Sound.play("brew_stir");
    hold = true;
  };
  const up = (e) => { if (e.type === "keyup" && !isTap(e)) return; hold = false; };
  const share = () => Math.round(Math.min(1, inside / (DUR * 0.92)) * 100);
  const finish = (gaveUp) => {
    if (done) return;
    done = true;
    const score = gaveUp ? null : share();
    info.textContent = gaveUp ? "가마에서 물러났습니다" : score >= 85 ? `맑게 우러났다! ${score}점` : score >= 40 ? `그럭저럭 달였다. ${score}점` : `탁해져 버렸다… ${score}점`;
    Sound.play(gaveUp ? "close" : score >= 40 ? "brew_done" : "fail");
    setTimeout(() => { if (closer) closer(); onDone(score); }, gaveUp ? 200 : 750);
  };
  const draw = () => {
    const now = performance.now(), dt = Math.min(50, now - last);
    last = now;
    if (now >= t0 && !done) {
      v += (hold ? 0.0000034 : -0.000003) * dt;
      v *= Math.pow(0.96, dt / 16);
      x += v * dt;
      if (x < 0) { x = 0; v = 0; }
      if (x > 1) { x = 1; v = 0; }
      if (now > nextAim) { aim = 0.15 + Math.random() * 0.7; nextAim = now + 700 + Math.random() * 900; }
      c += Math.sign(aim - c) * Math.min(Math.abs(aim - c), 0.00016 * dt);
      if (Math.abs(x - c) <= W / 2) {
        inside += dt;
        if (now > bubbleAt) { bubbleAt = now + 280; Sound.play("brew_bubble"); }
      }
      if (now - t0 >= DUR) finish(false);
    }
    const inn = Math.abs(x - c) <= W / 2;
    if (Math.random() < (inn ? 0.5 : 0.15)) bubbles.push({ x: 132 + Math.random() * 76, y: 64, t: 1, r: 1 + Math.round(Math.random() * 2) });
    g.fillStyle = "#1a1c24"; g.fillRect(0, 0, cv.width, cv.height);
    // the cauldron: the brew runs clear inside the band and clouds outside it
    g.fillStyle = "#2b2233"; g.beginPath(); g.ellipse(170, 70, 58, 26, 0, 0, 7); g.fill();
    g.fillStyle = inn ? "#7ee07a" : "#7a8a5a"; g.beginPath(); g.ellipse(170, 64, 50, 10, 0, 0, 7); g.fill();
    g.fillStyle = inn ? "#b8ffb0" : "#9aa878"; g.fillRect(140, 60, 30, 2);
    g.fillStyle = "#4a4858"; g.fillRect(118, 72, 104, 4);
    g.fillStyle = "#e8742a"; for (let i = 0; i < 5; i++) g.fillRect(132 + i * 18, 92 - ((now / 90 + i * 3) % 4), 8, 4);
    for (const b of bubbles) { b.y -= dt / 30; b.t -= dt / 700; if (b.t > 0) { g.fillStyle = inn ? "#d8ffd0" : "#c0c8a0"; g.fillRect(Math.round(b.x), Math.round(b.y), b.r, b.r); } }
    bubbles = bubbles.filter((b) => b.t > 0).slice(-40);
    // the paddle leans with the needle
    g.strokeStyle = "#8a6a4a"; g.lineWidth = 4; g.beginPath(); g.moveTo(170 + (x - 0.5) * 30, 62); g.lineTo(190 + (x - 0.5) * 70, 16); g.stroke();
    // the gauge
    const BX = 20, BW = 300, BY = 100;
    g.fillStyle = "#2b2233"; g.fillRect(BX - 2, BY - 2, BW + 4, 14);
    g.fillStyle = "#3a3448"; g.fillRect(BX, BY, BW, 10);
    g.fillStyle = inn ? "#9af07a" : "#5aa04a"; g.fillRect(BX + (c - W / 2) * BW, BY, W * BW, 10);
    const nx = BX + x * BW;
    g.fillStyle = "#2b2233"; g.fillRect(nx - 3, BY - 8, 6, 22);
    g.fillStyle = "#ffe08a"; g.fillRect(nx - 1, BY - 6, 2, 18);
    fill.style.width = `${Math.max(0, 1 - Math.max(0, now - t0) / DUR) * 100}%`;
    fill.style.background = "#9af0ae";
    if (!done) info.textContent = now < t0 ? "준비…" : `잘 젓는 중 ${share()}%`;
    if (!done) raf = requestAnimationFrame(draw);
  };
  addEventListener("keydown", down, true);
  addEventListener("keyup", up, true);
  cv.addEventListener("pointerdown", down);
  addEventListener("pointerup", up);
  shut(() => { done = true; cancelAnimationFrame(raf); removeEventListener("keydown", down, true); removeEventListener("keyup", up, true); removeEventListener("pointerup", up); });
  raf = requestAnimationFrame(draw);
}
