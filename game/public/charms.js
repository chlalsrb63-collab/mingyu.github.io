/**
 * 주아나의 참 공방 — the client side of the charm system (C2; docs/design/charms.md, "C1 as built" is the wire).
 * The server decides everything; this file draws `self.charms`, the charm rows of `self.inv` and `defs.charms`, and asks.
 * - Words: `charmName gradeText optText describe` (appraisal reveals the grade, shape, engravings and options).
 * - Bag: the 전체 · 참 tabs (`bagTabs`), the 참 list (`renderBagList`), a charm's detail pane (`bagDetail`: 보드에 놓기,
 *   부수기 with a second click → `charm_destroy {uid, ok:1}`). win_char.js `renderInv` and items.js call these.
 * - 참 보드 `#w-charm` (WIN `charm`, Shift+C, docked in the side panel): the 5×5 grid (locked / open / the next cell),
 *   placed charms in their shapes (`defs.charms.shapes[id].rot[r]`), the tray of appraised charms in the bag. Drag a
 *   charm from the tray or the board (the cells under it show a ✓ / ✕ ghost), or click it and click a cell; 회전 (R)
 *   turns it, 빼기 takes it out. A request shows as a pale piece until `self` confirms it; a refusal (net.js `onError`)
 *   drops it back and prints the server's words. Totals with their caps, the legendary at work and why it is idle.
 * - 주아나 `#w-juana` (WIN `juana`, F at role `charm`): her quest card (`charm_quest`), appraisal with a cost confirm
 *   (`charm_id`) and the reveal card with her line, the box (`charm_claim`), the next cell (`charm_expand {k}`).
 * - `sync(s)` (every refreshUi) notices what the server confirmed and plays its sound; `onEvent` draws `cm`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as SP from "./sprites.js";
import { G, $, el, now } from "./state.js";
import { act, entityPos } from "./wire.js";
import { openWin, isOpen, hoverTip, hideTip } from "./windows.js";
import { iconImg } from "./uiicons.js";
import { refreshUi } from "./hudkit.js";
import { floatText } from "./events.js";
import * as Track from "./track.js";

const ST_NAME = { str: "힘", wil: "의지", dex: "민첩", int: "지능", wis: "지혜", luk: "행운" };
const ST_KEYS = ["str", "wil", "dex", "int", "wis", "luk"];
const SHAPE_NAME = {
  pin: "1칸", bar2: "막대 2칸", bar3: "막대 3칸", elbow: "ㄴ자 3칸", tile2: "정사각 4칸",
  bar4: "막대 4칸", pole4: "막대 4칸", tee4: "ㅗ자 4칸",
  hook4: "ㄴ자 4칸", hook4m: "ㄴ자 4칸", step4: "계단 4칸", step4m: "계단 4칸",
};
/** Grade colours (0 sealed) and the one-letter mark printed beside them: a grade is never told by colour alone. */
export const GRADE_COL = ["#b8b0c4", ...Art.RARITY_COL.slice(1, 4)];
const GRADE_MARK = ["봉", "매", "레", "전"];

const st = { tab: "all", pick: null, hover: null, drag: null, wait: null, msg: "", msgT: 0, ask: 0, sent: 0, reveal: null, kill: 0, openN: -1, placed: "", cells: [] };
window.__charm = st;

const D = () => G.defs && G.defs.charms;
export const isCharm = (e) => !!e && e.id === "charm";
const gradeOf = (c) => (c.rev ? c.g || 1 : 0);
const gradeEl = (node, grade) => { node.style.setProperty("--cm-grade", GRADE_COL[grade]); return node; };
export function charmName(c) {
  const d = D();
  if (!c.rev) return "미감정 참";
  return c.lg && d.legend[c.lg] ? d.legend[c.lg].name : `${d.grades[c.g]} 참`;
}
export const gradeText = (c) => (c.rev ? D().grades[c.g] : "미감정");
const TILE_PX = 8;
const BLOCK_PX = 32;
const RUNE_TONES = [
  null,
  { face: "#466eb0", shadow: "#294475", cut: "#192e54", lip: "#9cbcff" },
  { face: "#ac8638", shadow: "#685022", cut: "#453514", lip: "#ffe580" },
  { face: "#b46132", shadow: "#783d28", cut: "#48221e", lip: "#ffaf71" },
];
// Stable ids sent by charmWire. Add marks at the end so old engravings keep their ids.
const RUNE_MARKS = [
  [".#.", "##.", ".##", ".#."], [".#.", "#.#", "###", ".#."],
  ["#.#", "###", ".#.", "###"], ["#..", "##.", "..#", "##."],
  ["#.#", "###", "#.#", "###"], [".#.", "#.#", ".#.", ".##"],
  ["###", "#..", "##.", "#.."], ["#.#", "#.#", ".#.", ".#."],
  [".##", ".#.", ".#.", "##."], ["##.", "#.#", "##.", "#.."],
  ["..#", ".#.", "#.#", ".#."], ["###", ".#.", "##.", ".#."],
  [".#.", ".##", ".#.", "###"], ["#..", "#.#", ".##", "..#"],
  ["###", "..#", ".#.", "#.."], ["#.#", ".#.", "#.#", "#.#"],
  [".#.", "#.#", "##.", "..#"], ["##.", "..#", "..#", "##."],
  ["#..", ".#.", "..#", "###"], [".#.", "###", "#.#", "#.#"],
];
const tileCache = new Map(), blockCache = new Map();
const engravings = (c, r) => D().shapes[c.sh].order[r & 3].map((i) => c.runes?.[i] ?? i);

/** A square stone, lit from above-left. The offset lip makes the glyph read as an engraving. */
function runeTile(grade, rune) {
  const key = `${grade}:${rune}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const [tile, g] = Art.canvas(TILE_PX, TILE_PX);
  const { face, shadow, cut, lip } = RUNE_TONES[grade];
  g.fillStyle = "#2b2233"; g.fillRect(0, 0, 8, 8);
  g.fillStyle = shadow; g.fillRect(1, 1, 6, 6);
  g.fillStyle = GRADE_COL[grade]; g.fillRect(1, 1, 6, 1); g.fillRect(1, 2, 1, 5);
  g.fillStyle = face; g.fillRect(2, 2, 4, 4);
  const glyph = RUNE_MARKS[rune] || RUNE_MARKS[0];
  for (const [color, offset] of [[lip, 1], [cut, 0]]) {
    g.fillStyle = color;
    for (let y = 0; y < glyph.length; y++) for (let x = 0; x < glyph[y].length; x++) {
      if (glyph[y][x] === "#") g.fillRect(2 + x + offset, 2 + y + offset, 1, 1);
    }
  }
  const art = { tile, url: tile.toDataURL() };
  tileCache.set(key, art);
  return art;
}

function blockUrl(c, r, square) {
  const cells = D().shapes[c.sh].rot[r & 3], marks = engravings(c, r), grade = gradeOf(c);
  const key = `${grade}:${c.sh}:${r & 3}:${+square}:${marks.join(",")}`;
  if (blockCache.has(key)) return blockCache.get(key);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const cell = TILE_PX * (square && Math.max(width, height) < 3 ? 2 : 1);
  const [cv, g] = Art.canvas(square ? BLOCK_PX : width * cell, square ? BLOCK_PX : height * cell);
  const left = (cv.width - width * cell) / 2, top = (cv.height - height * cell) / 2;
  cells.forEach(([x, y], i) => g.drawImage(runeTile(grade, marks[i]).tile, left + x * cell, top + y * cell, cell, cell));
  const url = cv.toDataURL();
  if (blockCache.size >= 256) blockCache.delete(blockCache.keys().next().value);
  blockCache.set(key, url);
  return url;
}

/** The bag, appraisal and dragged icon all use the server's footprint. */
export function iconUrl(c, r = 0) {
  return c.rev && D()?.shapes?.[c.sh] ? blockUrl(c, r, true) : Art.charmIconUrl("sealed");
}
const skillName = (id) => { const k = G.defs.skills && G.defs.skills[id]; return k ? k.name : id; };
export function optText([kind, v, arg]) {
  if (kind === "st") return `${ST_NAME[arg] || arg} +${v}`;
  if (kind === "skd") return `[${skillName(arg)}] 피해 +${v}%`;
  if (kind === "skh") return `[${skillName(arg)}] 회복량 +${v}%`;
  return `${D().opts[kind] ? D().opts[kind].name : kind} +${v}`;
}
const idCost = (c, s = G.self) => (s.charms && s.charms.free ? 0 : c.cost | 0);
const levelWhy = (s, c) => s && s.lvl < c.req ? `Lv.${c.req}부터 장착할 수 있는 참입니다` : "";
const levelLine = (c) => el("div", `cm-level${levelWhy(G.self, c) ? " low" : ""}`, `아이템 Lv.${c.il} · 장착 Lv.${c.req}`);
const charmsIn = (s) => s.inv.filter(isCharm);
const invKey = (s) => charmsIn(s).map((c) => `${c.uid}:${c.rev}`).join(",");
const nearJuana = () => !!(G.near && G.near.role === "charm");
/** May the board be changed here? Only on a safe (town) map; a map the table does not know is left to the server. */
function safeHere() {
  const m = G.map && (G.defs.maps || []).find((x) => x.id === G.map.id);
  return !m || !!m.safe;
}
function say(text) { st.msg = text; st.msgT = now(); refreshUi(); }

/** A miniature of the same piece used on the board. */
function shapeFig(c, r = 0) {
  const fig = el("img", "cm-fig");
  fig.src = blockUrl(c, r, false);
  fig.alt = "";
  return fig;
}
/** The grade tag carries the grade name alongside its color. */
function gradeTag(c) {
  const g = gradeOf(c);
  return gradeEl(el("span", "cm-tag", `${GRADE_MARK[g]} ${gradeText(c)}`), g);
}
/** Everything a charm may say about itself (tooltip, bag detail, reveal card). */
export function describe(c, host, o = {}) {
  const d = D(), g = gradeOf(c);
  const nm = el("div", "nm", charmName(c));
  nm.style.color = GRADE_COL[g];
  host.append(nm, levelLine(c));
  if (!c.rev) {
    host.append(el("div", "rar", `미감정 · 획득처: ${d.src[c.src] || "?"}`));
    host.append(el("div", "ds", "주아나에게 감정받으면 등급과 모양, 효과가 드러납니다."));
    host.append(el("div", "gold-line", idCost(c) ? `감정 비용 ${idCost(c).toLocaleString()}G` : "감정 비용 무료 (첫 감정)"));
  } else {
    const row = el("div", "rar cm-line");
    row.append(gradeTag(c), SHAPE_NAME[c.sh], shapeFig(c, o.r));
    host.append(row);
    for (const op of c.op || []) host.append(el("div", "af", optText(op)));
    if (c.lg && d.legend[c.lg]) host.append(el("div", "lg", `◆ ${d.legend[c.lg].desc}`));
    host.append(el("div", "ds", `획득처: ${d.src[c.src] || "?"}`));
  }
  if (o.hint) host.append(el("div", "hint", o.hint));
}

// ── the bag: tabs, the 참 list, a charm's detail ──
export const bagTab = () => st.tab;
export const bagKey = (s) => [st.tab, st.kill, s.charms && s.charms.un, s.charms && s.charms.free];
/** The 전체 · 참 tab row over the bag. */
export function bagTabs(s, host) {
  host.textContent = "";
  const n = charmsIn(s).length;
  if (!D()) { host.hidden = true; st.tab = "all"; return; }
  host.hidden = false;
  for (const [id, label] of [["all", "전체"], ["charm", `참 ${n}`]]) {
    const b = el("button", st.tab === id ? "on" : "", label);
    b.addEventListener("click", () => { if (st.tab === id) return; st.tab = id; G.sel = -1; st.kill = 0; Sound.play("tab"); hideTip(); refreshUi(); });
    host.append(b);
  }
}
/** The 참 tab: every charm in the bag as a card (sealed: icon and source only). */
export function renderBagList(s, host) {
  host.textContent = "";
  const list = s.inv.map((c, i) => [c, i]).filter(([c]) => isCharm(c));
  if (!list.length) {
    host.append(el("p", "hint", s.charms && s.charms.un ? "가방에 참이 없습니다. 내 수준의 사냥터와 레이드던전 상자에서 미감정 참이 나옵니다."
      : `참은 Lv.${D().lv}부터 버드나무광장의 참감정사 주아나에게 의뢰를 받아 시작합니다.`));
    return;
  }
  for (const [c, i] of list) {
    const g = gradeOf(c), card = gradeEl(el("div", `cm-card${i === G.sel ? " sel" : ""}`), g);
    const img = el("img", "ic"); img.src = iconUrl(c); img.alt = "";
    const tx = el("div", "tx"), hd = el("div", "hd");
    const nm = el("b", "", charmName(c)); nm.style.color = GRADE_COL[g];
    hd.append(nm, gradeTag(c));
    tx.append(hd, levelLine(c));
    if (c.rev) {
      const row = el("div", "cm-line"); row.append(shapeFig(c), SHAPE_NAME[c.sh] || c.sh);
      tx.append(row);
      for (const op of c.op || []) tx.append(el("div", "af", optText(op)));
      if (c.lg && D().legend[c.lg]) tx.append(el("div", "lg", "◆ 전설 효과"));
    } else tx.append(el("div", "ds", `획득처: ${D().src[c.src] || "?"}`));
    card.append(img, tx);
    card.addEventListener("click", () => { G.sel = G.sel === i ? -1 : i; st.kill = 0; Sound.play("ui"); refreshUi(); });
    hoverTip(card, (h) => describe(c, h));
    host.append(card);
  }
}
/** The detail pane for a charm chosen in the bag (either tab): what it is, 보드에 놓기, 부수기 (asked twice). */
export function bagDetail(s, c, det) {
  describe(c, det);
  const btns = el("div", "btns");
  const add = (label, fn, cls = "btn small", off = false) => { const b = el("button", cls, label); b.disabled = off; b.addEventListener("click", () => { hideTip(); fn(); }); btns.append(b); return b; };
  if (c.rev) add("보드에 놓기", () => { pickFromBag(c.uid); openWin("charm"); Sound.play("ui"); }, "btn gold small", !s.charms?.un || !!levelWhy(s, c));
  else btns.append(el("span", "ds", "감정은 주아나 곁에서"));
  if (st.kill === c.uid) {
    add("정말 부수기", () => { act({ t: "charm_destroy", uid: c.uid, ok: 1 }); st.kill = 0; G.sel = -1; Sound.play("salvage"); }, "btn small danger");
    add("취소", () => { st.kill = 0; refreshUi(); });
    det.append(el("div", "err-line", "부순 참은 되돌릴 수 없습니다."));
  } else add("부수기", () => { st.kill = c.uid; Sound.play("ui"); refreshUi(); });
  det.append(btns);
}

// ── the board ──
const open = (cs) => new Set((cs.open || []).map(([x, y]) => `${x},${y}`));
const cellsAt = (sh, r, x, y) => D().shapes[sh].rot[r & 3].map(([cx, cy]) => [x + cx, y + cy]);
const pieceAt = (cs, x, y) => cs.placed.find((e) => cellsAt(e.c.sh, e.r, e.x, e.y).some((c) => c[0] === x && c[1] === y)) || null;
const findCharm = (s, uid) => { const p = s.charms.placed.find((e) => e.c.uid === uid); return p ? p.c : charmsIn(s).find((c) => c.uid === uid) || null; };
/** Would charm `uid` fit at (x, y) turned `r`? "" when it would, else the server's own words for why not. */
function whyNot(s, uid, sh, r, x, y) {
  const cs = s.charms, op = open(cs), n = D().size;
  for (const [cx, cy] of cellsAt(sh, r, x, y)) {
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return "보드 밖입니다";
    if (!op.has(`${cx},${cy}`)) return "잠긴 칸입니다";
    const e = pieceAt(cs, cx, cy);
    if (e && e.c.uid !== uid) return "다른 참이 놓인 칸입니다";
  }
  return "";
}
function pickFromBag(uid) {
  const s = G.self, c = s && charmsIn(s).find((x) => x.uid === uid);
  if (!c || !c.rev) return false;
  const why = levelWhy(s, c);
  if (why) { say(why); Sound.play("no"); return false; }
  const r = st.pick && st.pick.uid === uid ? st.pick.r : 0, g = D().shapes[c.sh].rot[r][0];
  st.pick = { uid, r, from: "bag", gx: g[0], gy: g[1] };
  st.msg = "";
  return true;
}
function dropPick() { st.pick = null; st.hover = null; st.drag = null; dragChip(null); }
/** Where the charm in hand would lie with the pointer on cell (hx, hy). */
function ghost(s) {
  const p = st.pick, h = st.hover, c = p && findCharm(s, p.uid);
  if (!p || !h || !c) return null;
  const x = h[0] - p.gx, y = h[1] - p.gy;
  return { piece: c, x, y, cells: cellsAt(c.sh, p.r, x, y), why: levelWhy(s, c) || whyNot(s, p.uid, c.sh, p.r, x, y) };
}
/** Paint the ghost on the cells already drawn (no rebuild: the pointer moves every frame). */
function paintGhost() {
  const s = G.self, gh = s && s.charms ? ghost(s) : null;
  for (const c of st.cells) c.el.classList.remove("gh", "ok", "bad");
  if (!gh) return;
  const marks = engravings(gh.piece, st.pick.r), grade = gradeOf(gh.piece);
  for (const cell of st.cells) {
    const i = gh.cells.findIndex(([x, y]) => cell.x === x && cell.y === y);
    if (i < 0) continue;
    cell.el.style.setProperty("--cm-ghost", `url("${runeTile(grade, marks[i]).url}")`);
    cell.el.classList.add("gh", gh.why ? "bad" : "ok");
  }
}
function rotate() {
  const s = G.self, p = st.pick, c = p && findCharm(s, p.uid);
  if (!c) return;
  const blocked = levelWhy(s, c);
  if (blocked) { say(blocked); Sound.play("no"); return; }
  const r = (p.r + 1) & 3;
  const on = s.charms.placed.find((e) => e.c.uid === p.uid);
  // a charm lying on the board (and not being dragged) turns where it lies; one in hand turns its ghost
  if (on && !st.drag) {
    const why = !safeHere() ? "참 보드는 마을에서만 바꿀 수 있습니다" : whyNot(s, p.uid, c.sh, r, on.x, on.y);
    if (why) { say(why === "다른 참이 놓인 칸입니다" || why === "잠긴 칸입니다" || why === "보드 밖입니다" ? `돌릴 자리가 없습니다 — ${why}` : why); Sound.play("no"); return; }
    send({ t: "charm_move", uid: p.uid, x: on.x, y: on.y, r });
    return;
  }
  const g = D().shapes[c.sh].rot[r][0];
  p.r = r; p.gx = g[0]; p.gy = g[1];
  if (chip && !chip.hidden) chip.src = iconUrl(c, r);
  Sound.play("tab");
  paintGhost(); refreshUi();
}
function send(a) {
  st.wait = { uid: a.uid, x: a.x, y: a.y, r: a.r, t: now(), rm: a.t === "charm_remove" };
  st.msg = "";
  act(a);
  refreshUi();
}
/** Let go of the charm in hand over cell (hx, hy). */
function dropAt(hx, hy) {
  const s = G.self, p = st.pick, c = p && findCharm(s, p.uid);
  if (!c) return;
  st.hover = [hx, hy];
  const gh = ghost(s), on = s.charms.placed.find((e) => e.c.uid === p.uid);
  if (on && on.x === gh.x && on.y === gh.y && on.r === p.r) return;      // where it already lies
  const why = !safeHere() ? "참 보드는 마을에서만 바꿀 수 있습니다" : gh.why;
  if (why) { say(why); Sound.play("no"); return; }
  send({ t: on ? "charm_move" : "charm_place", uid: p.uid, x: gh.x, y: gh.y, r: p.r });
}
function takeOut(uid) {
  if (!safeHere()) { say("참 보드는 마을에서만 바꿀 수 있습니다"); Sound.play("no"); return; }
  send({ t: "charm_remove", uid });
}
let chip = null;
function dragChip(e, c) {
  if (!e) { if (chip) chip.hidden = true; return; }
  if (!chip) { chip = el("img", "cm-drag"); chip.alt = ""; document.body.append(chip); }
  if (c) chip.src = iconUrl(c, st.pick?.r);
  chip.hidden = false;
  chip.style.left = `${e.clientX + 6}px`; chip.style.top = `${e.clientY + 6}px`;
}
const cellUnder = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY), c = t && t.closest && t.closest("#charm-grid .cc"); return c ? [Number(c.dataset.x), Number(c.dataset.y)] : null; };
function onDown(e, from, uid, cell) {
  const s = G.self;
  if (!s || !s.charms || !s.charms.un || e.button > 0) return;
  e.preventDefault();
  let fresh = false;
  if (from === "bag") {
    fresh = !st.pick || st.pick.uid !== uid;
    if (!pickFromBag(uid)) return;
  }
  else {
    const hit = pieceAt(s.charms, cell[0], cell[1]);
    // a charm in hand goes down on an empty cell or over itself; another charm's cell picks that one up instead
    if (hit && (!st.pick || st.pick.uid !== hit.c.uid) && !(st.pick && !ghostWhyAt(s, cell))) {
      st.pick = { uid: hit.c.uid, r: hit.r, from: "board", gx: cell[0] - hit.x, gy: cell[1] - hit.y };
      st.msg = ""; fresh = true;
    } else if (!st.pick) return;
    st.hover = cell;
  }
  st.drag = { x0: e.clientX, y0: e.clientY, moved: false, fresh };
  refreshUi(); paintGhost();
}
function ghostWhyAt(s, cell) { const keep = st.hover; st.hover = cell; const gh = ghost(s); st.hover = keep; return gh ? gh.why : "x"; }
function onMove(e) {
  if (!isOpen("charm") || !st.pick) return;
  const d = st.drag;
  if (d && !d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 5) d.moved = true;
  const cell = cellUnder(e);
  if (String(cell) !== String(st.hover)) { st.hover = cell; paintGhost(); }
  if (d && d.moved) dragChip(e, findCharm(G.self, st.pick.uid)); else dragChip(null);
}
function onUp(e) {
  const d = st.drag;
  if (!d) return;
  st.drag = null; dragChip(null);
  const p = st.pick, cell = cellUnder(e);
  if (!p) return;
  if (cell) { if (d.moved || !d.fresh) dropAt(cell[0], cell[1]); }
  else if (d.moved && p.from === "board") {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (t && t.closest && t.closest("#charm-tray")) takeOut(p.uid);
  }
  paintGhost();
}
/** R turns the charm in hand, Esc lets go of it (input.js asks before its own keys). */
export function onKey(k) {
  if (!st.pick || !isOpen("charm")) return false;
  if (k === "r" || k === "ㄱ") { rotate(); return true; }
  if (k === "Escape") { dropPick(); refreshUi(); return true; }
  return false;
}
export function setup() {
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", () => { st.drag = null; dragChip(null); });
}
/** A refusal from the server while a board request is out: the pale piece goes back, the words stay on the board. */
export function onError(text) {
  if (!st.wait && !st.sent) return;
  if (st.wait) { st.wait = null; st.msg = text; st.msgT = now(); const g = $("#charm-grid"); if (g) { g.classList.remove("shake"); void g.offsetWidth; g.classList.add("shake"); } }
  st.sent = 0;
  refreshUi();
}
/** What the server has confirmed since the last look: a charm set down or taken out, a cell opened, a seal broken. */
export function sync(s) {
  const cs = s.charms;
  if (!cs || !D()) return;
  const placed = cs.placed.map((e) => `${e.c.uid}@${e.x},${e.y},${e.r}`).join(" ");
  if (st.placed !== placed) {
    const was = st.placed.split(" ").filter(Boolean).length;
    if (st.openN >= 0) Sound.play(cs.placed.length < was ? "charm_remove" : "charm_place");
    st.placed = placed;
    if (st.wait) { if (st.wait.rm || !cs.placed.some((e) => e.c.uid === st.wait.uid)) st.pick = null; st.wait = null; }
    if (st.pick) { const on = cs.placed.find((e) => e.c.uid === st.pick.uid); if (on) { st.pick.from = "board"; st.pick.r = on.r; } else if (!charmsIn(s).some((c) => c.uid === st.pick.uid)) st.pick = null; }
  }
  if (st.wait && now() - st.wait.t > 2500) st.wait = null;
  if (st.openN >= 0 && cs.openN > st.openN) Sound.play("charm_expand");
  st.openN = cs.openN;
  if (st.sent) {
    const c = charmsIn(s).find((x) => x.uid === st.sent);
    if (c && c.rev) { st.reveal = { c, t: now() }; st.sent = 0; st.ask = 0; Sound.play("charm_id", c.g); }
    else if (!c) st.sent = 0;
  }
  if (st.msg && now() - st.msgT > 6000) st.msg = "";
}
export const boardKey = () => { const s = G.self; return [s.charms, invKey(s), st.pick && [st.pick.uid, st.pick.r, st.pick.from], st.wait, st.msg, safeHere(), s.lvl]; };
export function renderBoard(s) {
  const box = $("#charm-body"), d = D(), cs = s.charms;
  box.textContent = "";
  st.cells = [];
  if (!d || !cs) { box.append(el("p", "hint", "불러오는 중…")); return; }
  if (!cs.un) {
    box.append(el("p", "say", `참 보드는 버드나무광장의 참감정사 주아나의 의뢰 〈${d.quests[0].title}〉를 마치면 열립니다. (Lv.${d.lv}부터)`));
    return;
  }
  const safe = safeHere();
  if (!safe) box.append(el("div", "cm-note", "마을에서만 변경 — 참 보드는 마을에서만 바꿀 수 있습니다"));
  // ITM-09: 참 보드 3슬롯 프리셋 저장/불러오기
  const pBar = el("div", "cm-bar");
  const preN = d.presetN || 3, preMeta = cs.presets || [];
  for (let i = 0; i < preN; i++) {
    const saved = preMeta[i] >= 0;
    const lb = el("button", "btn small", `프리셋${i + 1}${saved ? `(${preMeta[i]})` : ""}`);
    lb.disabled = !safe || !saved;
    lb.title = saved ? `프리셋 ${i + 1} 불러오기` : "저장된 프리셋 없음";
    lb.addEventListener("click", () => { act({ t: "charm_preset", a: "load", i }); Sound.play("tab"); });
    const sb = el("button", "btn small", "저장");
    sb.disabled = !safe;
    sb.title = `현재 보드 배치를 프리셋 ${i + 1}에 저장`;
    sb.addEventListener("click", () => { act({ t: "charm_preset", a: "save", i }); Sound.play("ui"); });
    pBar.append(lb, sb);
  }
  box.append(pBar);
  const grid = el("div", "cm-grid"); grid.id = "charm-grid";
  grid.style.gridTemplateColumns = `repeat(${d.size}, var(--cc))`;
  const op = open(cs), wait = st.wait && !st.wait.rm ? st.wait : null, wc = wait && findCharm(s, wait.uid);
  const pend = wc ? cellsAt(wc.sh, wait.r, wait.x, wait.y) : [];
  for (let y = 0; y < d.size; y++) for (let x = 0; x < d.size; x++) {
    const c = el("div", "cc"), e = pieceAt(cs, x, y);
    c.dataset.x = x; c.dataset.y = y;
    if (!op.has(`${x},${y}`)) {
      c.classList.add("lock");
      if (cs.next && cs.next.cell[0] === x && cs.next.cell[1] === y) { c.classList.add("next"); c.title = `다음에 열 칸 — ${cs.next.cost.toLocaleString()}G + 참틀 확장못 1개 (주아나)`; }
      else c.title = "잠긴 칸";
    } else if (e) {
      const g = gradeOf(e.c), cells = cellsAt(e.c.sh, e.r, e.x, e.y), has = (dx, dy) => cells.some((q) => q[0] === x + dx && q[1] === y + dy);
      c.classList.add("on");
      gradeEl(c, g);
      if (levelWhy(s, e.c)) c.classList.add("low");
      if (!has(0, -1)) c.classList.add("et"); if (!has(1, 0)) c.classList.add("er"); if (!has(0, 1)) c.classList.add("eb"); if (!has(-1, 0)) c.classList.add("el");
      if (st.pick && st.pick.uid === e.c.uid) c.classList.add("sel");
      if (wait && wait.uid === e.c.uid) c.classList.add("away");
      const img = el("img", "cm-tile");
      const i = cells.findIndex(([cx, cy]) => cx === x && cy === y);
      img.src = runeTile(g, engravings(e.c, e.r)[i]).url; img.alt = "";
      c.append(img);
      if (i === 0) c.append(el("span", "mk", GRADE_MARK[g]));
      hoverTip(c, (h) => describe(e.c, h, { r: e.r, hint: safe ? "끌어서 옮기기 · 클릭 후 회전/빼기" : "" }));
    }
    if (pend.some((q) => q[0] === x && q[1] === y)) c.classList.add("pend");
    c.addEventListener("pointerdown", (ev) => onDown(ev, "board", 0, [x, y]));
    st.cells.push({ x, y, el: c });
    grid.append(c);
  }
  box.append(grid);
  // the charm in hand: what it is, turn it, take it out, let go
  const bar = el("div", "cm-bar"), p = st.pick, pc = p && findCharm(s, p.uid);
  const btn = (label, fn, off, title) => { const b = el("button", "btn small", label); b.disabled = !!off; if (title) b.title = title; b.addEventListener("click", () => { hideTip(); fn(); }); bar.append(b); };
  const blocked = pc && levelWhy(s, pc);
  btn("회전 (R)", rotate, !pc || !safe || blocked, blocked || "고른 참을 90° 돌립니다");
  btn("빼기", () => takeOut(p.uid), !pc || p.from !== "board" || !safe, "보드에서 가방으로");
  btn("놓기 취소", () => { dropPick(); refreshUi(); }, !pc);
  box.append(bar);
  const line = el("div", "cm-msg" + (st.msg ? " err" : ""));
  if (st.msg) line.textContent = `✕ ${st.msg}`;
  else if (blocked) { line.classList.add("err"); line.textContent = blocked; }
  else if (pc) { line.append(`${charmName(pc)} `, shapeFig(pc, p.r), p.from === "bag" ? " — 놓을 칸을 누르세요" : " — 옮길 칸을 누르거나 끌어 옮기세요"); }
  else line.textContent = safe ? "참을 끌어다 놓거나, 고른 뒤 칸을 누르세요." : "";
  box.append(line);
  // the tray: appraised charms waiting in the bag
  box.append(el("div", "section", "가방의 참"));
  const tray = el("div", "cm-tray"); tray.id = "charm-tray";
  const ready = charmsIn(s).filter((c) => c.rev), sealed = charmsIn(s).length - ready.length;
  for (const c of ready) {
    const g = gradeOf(c), t = gradeEl(el("div", "cm-chip"), g);
    t.classList.toggle("sel", p?.uid === c.uid);
    t.classList.toggle("away", wait?.uid === c.uid);
    t.classList.toggle("low", !!levelWhy(s, c));
    const img = el("img"); img.src = iconUrl(c, p && p.uid === c.uid ? p.r : 0); img.alt = "";
    t.append(img, el("span", "mk", GRADE_MARK[g]));
    t.addEventListener("pointerdown", (ev) => onDown(ev, "bag", c.uid));
    hoverTip(t, (h) => describe(c, h, { hint: "끌어서 보드에 놓기 · 클릭 후 칸 선택" }));
    tray.append(t);
  }
  if (!ready.length) tray.append(el("small", "hint", sealed ? `미감정 참 ${sealed}개 — 주아나에게 감정받으세요.` : "감정한 참이 없습니다."));
  else if (sealed) tray.append(el("small", "hint", `미감정 ${sealed}개`));
  box.append(tray);
  // applied bonuses from the board
  box.append(el("div", "section", "효과 합계"));
  const sum = cs.sum, tot = el("div", "cm-sum");
  const row = (label, v, pct = false) => {
    const r = el("div", "r" + (v ? "" : " zero") + (pct ? " wide" : ""));
    r.append(el("span", "", label), el("b", "", `+${v}${pct ? "%" : ""}`));
    tot.append(r);
  };
  row("HP", sum.hp); row("MP", sum.mp); row("공격력", sum.atk);
  ST_KEYS.forEach((k, i) => { if (sum.st[i]) row(ST_NAME[k], sum.st[i]); });
  for (const [id, value] of Object.entries(sum.skd || {})) row(`[${skillName(id)}] 피해`, value, true);
  for (const [id, value] of Object.entries(sum.skh || {})) row(`[${skillName(id)}] 회복량`, value, true);
  box.append(tot);
  // the legendary at work
  if (cs.lgN) {
    box.append(el("div", "section", "전설 효과"));
    const legendary = cs.placed.find((e) => cs.lg && e.c.lg === cs.lg && !levelWhy(s, e.c))
      || cs.placed.find((e) => e.c.lg && !levelWhy(s, e.c)) || cs.placed.find((e) => e.c.lg);
    const l = legendary && d.legend[legendary.c.lg];
    const card = gradeEl(el("div", "cm-lg" + (cs.lgWhy ? " off" : "")), 3);
    if (l) {
      const hd = el("div", "hd"), img = el("img"); img.src = iconUrl(legendary.c, legendary.r); img.alt = "";
      hd.append(img, el("b", "", l.name), el("span", `cm-state${cs.lgWhy ? " off" : ""}`, cs.lgWhy ? "✕ 비활성" : "✓ 활성"));
      card.append(hd, el("div", "ds", l.desc));
      if (cs.lgWhy) card.append(el("div", "err-line", `비활성 사유: ${cs.lgWhy}`));
    }
    if (cs.lgN > 1) card.append(el("div", "hint", `전설 참 ${cs.lgN}개 · 장착 레벨을 충족한 참의 일반 옵션이 적용되며 고유 효과는 한 가지만 발동합니다.`));
    box.append(card);
  }
  if (cs.next) box.append(el("div", "hint", `열린 칸 ${cs.open.length}/${d.size * d.size} · 다음 칸 ${cs.next.cost.toLocaleString()}G + 확장못 1개 (주아나)`));
  else box.append(el("div", "hint", "보드를 모두 열었습니다."));
  paintGhost();
}

// ── 주아나 ──
export function openJuana() { st.ask = 0; openWin("juana"); }
export const juanaKey = () => { const s = G.self; return [s.charms, invKey(s), s.gold, s.lvl, nearJuana(), st.ask, st.reveal && st.reveal.c.uid, st.sent]; };
let face = null;
function portrait() {
  if (!face) {
    const frame = SP.juanaSheet().front[0];
    face = document.createElement("canvas"); face.width = face.height = 16 * frame.width / SP.SIZE;
    const g = face.getContext("2d"); g.imageSmoothingEnabled = false;
    SP.drawPersonCrop(g, frame, 8, 13, 16, 16, 0, 0, face.width, face.height);
  }
  const img = el("img", "cm-face"); img.src = face.toDataURL(); img.alt = "주아나";
  return img;
}
export function renderJuana(s) {
  const box = $("#juana-body"), d = D(), cs = s.charms, near = nearJuana();
  box.textContent = "";
  if (!d || !cs) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const far = near ? "" : "주아나 곁에서만 할 수 있습니다";
  const button = (host, label, fn, why, gold = true) => {
    const b = el("button", gold ? "btn gold small" : "btn small", label);
    b.disabled = !!why; if (why) b.title = why;
    b.addEventListener("click", () => { hideTip(); fn(); });
    host.append(b);
    return b;
  };
  const top = el("div", "cm-top");
  top.append(portrait(), el("p", "say", st.reveal ? d.say.appraise : cs.un ? "사냥터에서 빛나는 조각을 주우면 가져오세요. 감정해서 참 보드에 놓으면 힘이 된답니다." : d.say.accept));
  box.append(top);
  // the reveal: what the seal held
  if (st.reveal) {
    const c = st.reveal.c, g = gradeOf(c), card = gradeEl(el("div", `cm-reveal g${g}`), g);
    const img = el("img", "big"); img.src = iconUrl(c); img.alt = "";
    const tx = el("div", "tx");
    describe(c, tx);
    card.append(el("div", "ray"), img, tx);
    const btns = el("div", "btns");
    button(btns, "보드에 놓기", () => { st.reveal = null; pickFromBag(c.uid); openWin("charm"); }, levelWhy(s, c));
    button(btns, "확인", () => { st.reveal = null; refreshUi(); }, "", false);
    card.append(btns);
    box.append(card);
  }
  // her commissions
  const q = cs.quest;
  box.append(el("div", "section", "주아나의 의뢰"));
  if (!q) box.append(el("p", "hint", "주아나의 의뢰를 모두 마쳤습니다."));
  else {
    const def = d.quests[q.i], card = el("div", "dcard cm-quest");
    const hd = el("div", "dh"); hd.append(el("b", "", `〈${def.title}〉`), el("span", "", `Lv.${def.lv}`));
    card.append(hd, el("p", "say", def.text), el("small", "pay", `보상: ${def.reward}`));
    const btns = el("div", "btns");
    if (q.st === 0) {
      const why = far || (q.ok ? "" : `Lv.${def.lv}부터 받을 수 있는 의뢰입니다`);
      button(btns, "의뢰 수락", () => { act({ t: "charm_quest", a: "accept" }); Sound.play("ui"); }, why);
      if (why) btns.append(el("small", "why", why));
    } else {
      const done = q.n >= q.need, bar = el("div", "bar"), fill = el("i");
      fill.style.width = `${Math.min(100, (q.n / q.need) * 100)}%`;
      bar.append(fill, el("b", "", `${Math.min(q.n, q.need)} / ${q.need}`));
      card.append(bar);
      button(btns, "보고하기", () => { act({ t: "charm_quest", a: "done" }); Sound.play("ui"); }, far || (done ? "" : "아직 사냥이 남았습니다"));
      if (!done) btns.append(el("small", "", "내 수준에 맞는 사냥터의 몬스터만 셉니다"));
      else if (far) btns.append(el("small", "why", far));
    }
    const go = Track.button("charm", def.title);   // the hunt: a ground for my level (track.js)
    if (go) btns.append(go);
    card.append(btns);
    box.append(card);
  }
  if (!cs.un) return;
  // appraisal
  box.append(el("div", "section", "감정"));
  const sealed = charmsIn(s).filter((c) => !c.rev);
  if (!sealed.length) box.append(el("p", "hint", "가방에 미감정 참이 없습니다."));
  if (cs.free && sealed.length) box.append(el("small", "ok", "첫 감정은 무료입니다."));
  for (const c of sealed) {
    const cost = idCost(c, s), row = el("div", "cm-row"), img = el("img"); img.src = iconUrl(c); img.alt = "";
    const tx = el("div", "tx"); tx.append(el("b", "", "미감정 참"), levelLine(c), el("small", "", `획득처: ${d.src[c.src] || "?"}`));
    row.append(img, tx);
    if (st.ask === c.uid) {
      const ask = el("div", "cm-ask");
      ask.append(el("span", "", cost ? `이 참을 ${cost.toLocaleString()}G에 감정할까요?` : "이 참을 무료로 감정할까요? (첫 감정)"));
      button(ask, "감정하기", () => { st.sent = c.uid; st.reveal = null; act({ t: "charm_id", uid: c.uid }); refreshUi(); }, far || (s.gold < cost ? `골드가 부족합니다 (${cost.toLocaleString()}G 필요)` : "") || (st.sent ? "감정하는 중…" : ""));
      button(ask, "취소", () => { st.ask = 0; refreshUi(); }, "", false);
      row.append(ask);
    } else {
      row.append(el("span", "cost", cost ? `${cost.toLocaleString()}G` : "무료"));
      button(row, "감정", () => { st.ask = c.uid; Sound.play("ui"); refreshUi(); }, far, false);
    }
    box.append(row);
  }
  // the box: a rift chest's charm that did not fit, and charms recovered from a damaged board
  const kept = (cs.pending ? 1 : 0) + (cs.rec ? cs.rec.length : 0);
  if (kept) {
    box.append(el("div", "section", "맡아 둔 참"));
    const row = el("div", "cm-row"), img = el("img"); img.src = Art.charmIconUrl("sealed"); img.alt = "";
    const tx = el("div", "tx");
    tx.append(el("b", "", `참 ${kept}개`), el("small", "", [cs.pending ? "레이드던전 상자 보류 1개" : "", cs.rec && cs.rec.length ? `복구 대기 ${cs.rec.length}개` : ""].filter(Boolean).join(" · ")));
    row.append(img, tx);
    const cap = s.bagCap || G.defs.inv;
    button(row, "받기", () => { act({ t: "charm_claim" }); Sound.play("ui"); }, far || (s.inv.length >= cap ? "가방이 가득 찼습니다" : ""));
    box.append(row);
  }
  // ITM-09: 참 3개 합성 → 상위 등급 랜덤 획득
  box.append(el("div", "section", "참 합성 (동일 등급 3개 → 상위 등급 랜덤)"));
  const fuseCost = d.fuseCost || [0, 1500, 5000];
  const revBag = charmsIn(s).filter((c) => c.rev);
  const fRow = el("div", "btns");
  for (const [g, label] of [[1, "매직 3→레어 랜덤"], [2, "레어 3→전설 랜덤"]]) {
    const cnt = revBag.filter((c) => c.g === g).length, cost = fuseCost[g];
    const why = far || (cnt < 3 ? `감정된 ${d.grades[g]} 참 3개 필요 (${cnt}/3)` : s.gold < cost ? `골드 부족 (${cost.toLocaleString()}G)` : "");
    button(fRow, `${label} (${cnt}/3 · ${cost.toLocaleString()}G)`, () => { act({ t: "charm_fuse", g }); Sound.play("quest"); }, why);
  }
  box.append(fRow);
  // the next cell
  box.append(el("div", "section", "보드 확장"));
  const nx = cs.next;
  if (!nx) box.append(el("p", "hint", `참 보드를 모두 열었습니다 (${d.size}×${d.size}).`));
  else {
    const row = el("div", "cm-row cm-exp"), mini = el("div", "cm-mini"), op = open(cs);
    mini.style.gridTemplateColumns = `repeat(${d.size}, 7px)`;
    for (let y = 0; y < d.size; y++) for (let x = 0; x < d.size; x++) mini.append(el("i", nx.cell[0] === x && nx.cell[1] === y ? "nx" : op.has(`${x},${y}`) ? "on" : ""));
    const tx = el("div", "tx"), need = el("small", "");
    const nail = el("img"); nail.src = Art.charmIconUrl("nail"); nail.alt = "";
    need.append(nail, `참틀 확장못 ${nx.nail}/1 · ${nx.cost.toLocaleString()}G`);
    tx.append(el("b", "", `다음 칸 (${nx.cell[0] + 1}, ${nx.cell[1] + 1}) — ${nx.k + 1}/${d.expand.length}번째`), need);
    row.append(mini, tx);
    const why = far || (nx.nail < 1 ? "참틀 확장못이 없습니다" : s.gold < nx.cost ? `골드가 부족합니다 (${nx.cost.toLocaleString()}G 필요)` : "");
    button(row, "확장", () => { act({ t: "charm_expand", k: nx.k }); }, why);
    box.append(row);
    if (why && why !== far) box.append(el("small", "why", why));
  }
  const foot = el("div", "btns");
  button(foot, "참 보드 열기", () => { openWin("charm"); Sound.play("ui"); }, "", false);
  if (far) foot.append(el("small", "why", far));
  box.append(foot);
}

// ── map events: the legendaries at work ──
/** `["cm", eid, kind, x, y, mobId?]`: 0 메아리's second blow, 1 렌즈's mark set on a monster, 2 the mark spent. */
export function onEvent(e) {
  if (e[0] !== "cm") return false;
  const [, eid, kind, x, y, mob] = e, mine = eid === G.you, f = S3.fx;
  const at = (mob && entityPos(mob)) || { x, y };
  if (kind === 0) { f.ring(at.x, at.y, 16, "#ffe9a8", 320); f.ring(at.x, at.y, 26, "#d89a28", 420, false, 90); f.sparkle(at.x, at.y, 0.6, "#ffe070", 8); if (mine) floatText("메아리", at.x, at.y, 1.5, "#ffe070"); }
  else if (kind === 1) { f.ring(at.x, at.y, 12, "#8adcff", 500); f.ring(at.x, at.y, 5, "#ffffff", 500, true); f.sparkle(at.x, at.y, 0.9, "#8adcff", 6); if (mine) floatText("표식", at.x, at.y, 1.5, "#8adcff"); }
  else { f.ring(at.x, at.y, 18, "#ffffff", 240); f.sparkle(at.x, at.y, 0.7, "#8adcff", 12); }
  if (mine) Sound.play("charm_proc", kind);
  return true;
}
