/**
 * Player to player, the windows (rules: src/logic/69-social-play.js; the snapshot's `sx`, sent when it changes):
 * - `#sx-ask`: a request for me (`sx.q = [name, kind, kindName]`) — 수락 / 거절 (`sx yes / no`).
 * - `#w-trade` (WIN `trade`): both offers side by side; my bag below — a click puts a whole stack up (Shift: one),
 *   a click on my offer takes it back; gold; 확정 (lock, any change unlocks both) → 교환 (both) → the server swaps.
 *   Closing the window cancels the trade.
 * - `#rps`: 가위바위보 — three seconds to pick (buttons or keys 1 2 3), the other side's hand hidden until the
 *   reveal; then both hands, 승리 / 패배 / 무승부, [다시 하기] (asks again) and [닫기].
 * Hands are drawn here in code (rects, a one-tone shadow and a dark outline).
 */
import { Sound } from "./audio.js";
import { G, $, el, now } from "./state.js";
import { act } from "./wire.js";
import { openWin, closeWin, isOpen, onClose, winEl, ask } from "./windows.js";
import { itemSlot, itemName } from "./items.js";

const HAND = ["가위", "바위", "보"];
const gStr = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
let shut = false;                 // the window closing because the server ended the trade (no cancel sent)
let rps = null;                   // the 가위바위보 on screen: { g (last view), end (local ms), done (ended at) }

export function reset() { G.sx = null; render(); }

export function onSnap(s) {
  if ("sx" in s) { G.sx = s.sx || null; render(); }
  else if (s.self && G.sx && G.sx.t && isOpen("trade")) renderTrade();   // the bag changed under the window
}

function render() {
  const v = G.sx || {};
  // a request for me
  const ask = $("#sx-ask");
  ask.hidden = !v.q;
  if (v.q) { const c = v.q[2].charCodeAt(v.q[2].length - 1) - 0xac00; $("#sx-ask-text").textContent = `${v.q[0]}님이 ${v.q[2]}${c >= 0 && c <= 11171 && c % 28 ? "을" : "를"} 신청했습니다.`; }
  // the trade
  if (v.t) { if (!isOpen("trade")) openWin("trade"); renderTrade(); }
  else if (isOpen("trade")) { shut = true; closeWin("trade"); shut = false; }
  // the mini-game
  if (v.g) showGame(v.g);
  else if (rps && !rps.done) { rps.done = now(); drawGame(); }
}

// ───────────────────────────── trade ─────────────────────────────

const tradable = (s) => s && s.id !== "charm" && s.id !== "charm_nail" && G.defs.items[s.id] && G.defs.items[s.id].type !== "quest";
function side(title, rows, gold, lock, go, mine) {
  const col = el("div", "tr-side" + (lock ? " locked" : ""));
  col.append(el("div", "tr-name", title));
  const grid = el("div", "grid tr-grid");
  rows.forEach(([entry, n], i) => {
    if (!entry) return;
    grid.append(itemSlot({ ...entry, n }, mine ? { onClick: () => act({ t: "sx", a: "take", i }), hint: "눌러서 내리기" } : {}));
  });
  for (let i = rows.length; i < G.defs.sx.rows; i++) grid.append(el("div", "slot empty"));
  col.append(grid);
  const g = el("div", "tr-gold");
  if (mine) {
    const inp = el("input");
    inp.type = "number"; inp.min = "0"; inp.max = String(G.self.gold); inp.value = String(gold);
    inp.addEventListener("change", () => { const n = Math.max(0, Math.min(G.self.gold, Math.floor(+inp.value) || 0)); if (n !== gold) act({ t: "sx", a: "gold", n }); });
    g.append(inp, el("span", "", "G"));
  } else g.append(el("b", "", `${gStr(gold)} G`));
  col.append(g, el("div", "tr-st", go ? "교환 대기" : lock ? "확정" : "조정 중"));
  return col;
}
function renderTrade() {
  const t = G.sx && G.sx.t, s = G.self;
  if (!t || !s) return;
  winEl("trade").querySelector("header .t").textContent = `거래 · ${t.n}`;
  const body = $("#trade-body");
  body.textContent = "";
  const sides = el("div", "tr-sides");
  sides.append(side("나", t.m.map(([i, n]) => [s.inv[i], n]), t.mg, t.ml, t.mo, true), side(t.n, t.o, t.og, t.ol, t.oo, false));
  body.append(sides);
  // my bag: what is not up yet
  const up = new Set(t.m.map(([i]) => i));
  body.append(el("p", "hint", "가방 — 눌러서 올리기 (묶음은 개수를 묻습니다 · Shift+클릭: 1개) · 장착 · 퀘스트 · 참은 거래할 수 없습니다"));
  const bag = el("div", "grid tr-bag");
  s.inv.forEach((entry, i) => {
    if (up.has(i)) return;
    const ok = tradable(entry);
    const d = itemSlot(entry, { hint: ok ? "눌러서 올리기" : "거래할 수 없는 아이템", onClick: (e) => {
      if (!ok) return;
      const n = entry.n || 1;
      if (e.shiftKey || n < 2 || entry.uid) act({ t: "sx", a: "put", s: i, n: e.shiftKey && !entry.uid ? 1 : n });
      else ask(`몇 개 올릴까요? (가진 수 ${n}개)\n「${itemName(entry)}」`, "올리기", (k) => act({ t: "sx", a: "put", s: i, n: k }), "", { max: n });
    } });
    if (!ok) d.classList.add("off");
    bag.append(d);
  });
  body.append(bag);
  const btns = el("div", "btns");
  const lock = el("button", "btn" + (t.ml ? "" : " gold"), t.ml ? "확정 해제" : "확정");
  lock.addEventListener("click", () => { act({ t: "sx", a: "lock", v: t.ml ? 0 : 1 }); Sound.play("ui"); });
  const go = el("button", "btn gold", t.mo ? "상대를 기다리는 중…" : "교환");
  go.disabled = !(t.ml && t.ol) || !!t.mo;
  go.title = t.ml && t.ol ? "두 사람 모두 교환을 누르면 바뀝니다" : "두 사람 모두 확정해야 합니다";
  go.addEventListener("click", () => { act({ t: "sx", a: "go" }); Sound.play("coin"); });
  const x = el("button", "btn", "취소");
  x.addEventListener("click", () => closeWin("trade"));
  btns.append(lock, go, x);
  body.append(btns);
}

// ───────────────────────────── 가위바위보 ─────────────────────────────

// 18×18 cells: [x, y, w, h] blocks of skin; `fold` cells get the shadow tone (folded fingers)
const SHAPES = [
  { r: [[5, 10, 8, 6], [5, 2, 2, 9], [8, 3, 2, 8], [3, 11, 3, 2]], fold: [[10, 11], [11, 11], [10, 12], [11, 12]] },                    // 가위
  { r: [[4, 7, 10, 7], [4, 5, 2, 2], [6, 4, 2, 3], [8, 4, 2, 3], [10, 4, 2, 3], [12, 5, 2, 2], [2, 9, 3, 3]], fold: [[6, 5], [6, 6], [8, 5], [8, 6], [10, 5], [10, 6], [12, 6], [5, 9], [5, 10], [6, 11]] },   // 바위
  { r: [[4, 9, 9, 6], [4, 4, 2, 6], [6, 2, 2, 8], [9, 2, 2, 8], [11, 3, 2, 7], [13, 9, 2, 2], [14, 7, 2, 3]], fold: [] },              // 보
];
const INK = "#2b2233", SKIN = "#ffd9a8", SHADE = "#e3a874";
function handCanvas(k, flip) {
  const c = document.createElement("canvas");
  c.width = c.height = 18;
  c.className = "rps-hand";
  if (k < 0 || k > 2) { const x = c.getContext("2d"); x.fillStyle = INK; x.fillRect(7, 5, 4, 2); x.fillRect(10, 6, 2, 3); x.fillRect(8, 9, 2, 3); x.fillRect(8, 13, 2, 2); return c; }   // "?"
  const on = Array.from({ length: 18 }, () => new Uint8Array(18));
  for (const [x0, y0, w, h] of SHAPES[k].r) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) on[y][x] = 1;
  const x = c.getContext("2d");
  const put = (px, py, col) => { x.fillStyle = col; x.fillRect(flip ? 17 - px : px, py, 1, 1); };
  for (let y = 0; y < 18; y++) for (let px = 0; px < 18; px++) {
    if (on[y][px]) {
      const edge = !(on[y + 1] && on[y + 1][px]) || !on[y][px + 1];
      put(px, y, edge ? SHADE : SKIN);
    } else if ((on[y - 1] && on[y - 1][px]) || (on[y + 1] && on[y + 1][px]) || on[y][px - 1] || on[y][px + 1]) put(px, y, INK);
  }
  for (const [px, py] of SHAPES[k].fold) put(px, py, SHADE);
  return c;
}
function showGame(g) {
  const fresh = !rps || rps.done || rps.g[0] !== g[0] || (rps.g[2] === 1 && g[2] === 0);
  if (fresh) { rps = { g, end: now() + g[3] * 1000, done: 0 }; Sound.play("open"); }
  const was = rps.g;
  rps.g = g;
  if (g[2] === 1 && was[2] !== 1 || (fresh && g[2] === 1)) Sound.play(g[6] > 0 ? "achieve" : g[6] < 0 ? "fail" : "blip");
  else if (g[2] === 0 && !fresh && g[3] !== was[3]) Sound.play("tick");
  drawGame();
}
/** [kind, their name, phase, secs, my hand, theirs (9 picked · -1 hidden), result, my lot, their lot] */
function drawGame() {
  const box = $("#rps");
  if (!rps) { box.hidden = true; return; }
  const [, name, ph, , me, them, res, myLot, thLot] = rps.g;
  box.textContent = "";
  box.hidden = false;
  box.append(el("div", "rps-h", `가위바위보 · ${name}`));
  if (ph === 0 && !rps.done) {
    const bar = el("i", "rps-bar"), fill = el("i");
    bar.append(fill);
    fill.style.width = `${Math.max(0, Math.min(100, ((rps.end - now()) / G.defs.sx.pickMs) * 100))}%`;
    box.append(bar);
  }
  const row = el("div", "rps-row");
  const mine = el("div", "rps-me"), theirs = el("div", "rps-them");
  mine.append(handCanvas(me, false), el("small", "", me >= 0 ? `나 · ${HAND[me]}${myLot ? " (자동)" : ""}` : "나 · ?"));
  theirs.append(handCanvas(ph === 1 ? them : -1, true), el("small", "", ph === 1 ? `${name} · ${HAND[them]}${thLot ? " (자동)" : ""}` : them === 9 ? `${name} · 골랐습니다` : `${name} · 고르는 중…`));
  row.append(mine, el("b", "rps-vs", "VS"), theirs);
  box.append(row);
  if (ph === 0 && !rps.done) {
    const pick = el("div", "rps-pick");
    HAND.forEach((h, i) => {
      const b = el("button", "btn" + (me === i ? " gold" : ""));
      b.append(handCanvas(i, false), el("span", "", `${h} `), el("kbd", "", String(i + 1)));
      b.addEventListener("click", () => choose(i));
      pick.append(b);
    });
    box.append(pick, el("p", "hint", "3초 안에 고르세요 — 고르지 않으면 무작위로 냅니다"));
  } else if (ph === 1) {
    box.append(el("div", "rps-res " + (res > 0 ? "win" : res < 0 ? "lose" : "draw"), res > 0 ? "승리!" : res < 0 ? "패배…" : "무승부"));
    const btns = el("div", "btns");
    const again = el("button", "btn gold", "다시 하기");
    again.addEventListener("click", () => {
      const eid = [...G.who].find(([, w]) => !w.buddy && w.name === name);
      if (eid) act({ t: "sx", a: "ask", k: rps.g[0], e: eid[0] });
      hideGame();
    });
    const x = el("button", "btn", "닫기");
    x.addEventListener("click", () => { if (G.sx && G.sx.g) act({ t: "sx", a: "x" }); hideGame(); });
    btns.append(again, x);
    box.append(btns);
  } else box.append(el("p", "hint", "미니게임이 끝났습니다."));
}
function hideGame() { rps = null; $("#rps").hidden = true; }
function choose(i) {
  if (!rps || rps.done || rps.g[2] !== 0) return;
  act({ t: "sx", a: "pick", v: i });
  Sound.play("ui");
}
/** Keys 1 2 3 pick while the window is open; Esc leaves. True when used. */
export function onKey(e) {
  if (!rps) return false;
  if (e.key === "Escape") { if (G.sx && G.sx.g) act({ t: "sx", a: "x" }); hideGame(); return true; }
  if (rps.g[2] === 0 && !rps.done && /^[123]$/.test(e.key)) { choose(+e.key - 1); return true; }
  return false;
}
/** Each frame: the countdown bar; a finished game's card goes after a few seconds. */
export function tick(t) {
  if (!rps) return;
  if (rps.done && t - rps.done > 6000) { hideGame(); return; }
  const fill = rps.g[2] === 0 && !rps.done && $("#rps .rps-bar i");
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, ((rps.end - t) / G.defs.sx.pickMs) * 100))}%`;
}

export function setup() {
  $("#sx-yes").addEventListener("click", () => { act({ t: "sx", a: "yes" }); Sound.play("ui"); });
  $("#sx-no").addEventListener("click", () => { act({ t: "sx", a: "no" }); Sound.play("ui"); });
  onClose.trade = () => { if (!shut && G.sx && G.sx.t) act({ t: "sx", a: "x" }); };
}
