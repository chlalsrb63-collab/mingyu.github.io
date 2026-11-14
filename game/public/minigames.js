/**
 * Two small games played over the world: reeling a fish in to a rhythm, and
 * packing a pan like a tangram. Each ends by reporting a score from 0 to 100;
 * the server decides what that score is worth.
 */
import { Sound } from "./audio.js";

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
  const box = open("낚시 — 박자에 맞춰 당기기", "물결이 찌에 닿는 순간 F · Space · 화면을 누르세요");
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
      if (!["f", "F", "ㄹ", " ", "Enter"].includes(e.key)) return;
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
