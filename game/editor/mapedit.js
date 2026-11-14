/**
 * The 맵 tab: map list, top-down tile canvas, tools, layers, side panels, undo/redo,
 * live validation, the quarter-view preview, save and playtest.
 *
 * The map being edited is `E.m` in the SCHEMA.md editor format, except that `ground` and
 * `objects` are held as arrays of char arrays while editing (`E.g`, `E.o`). A built-in map
 * that has not been replaced is "locked": its tiles come from the generator, so only NPCs
 * (npcs.json) and doors (links.json) can be added to it until the owner makes a replacement.
 */
import { $, $$, el, api, toast, dialog, confirmBox, ask, DB, reloadMaps, mapName, mobName, mobImg, mobIcon, fieldMobs,
  checkCtx, npcCanvas, npcIcon, fullLook, pickFrom, mobEntries, ROLE_KO, THEME_KO, BGM_KO, icon } from "./ui.js";
import { checkMap, checkLinks, checkNpcs, standable, ID_RE, MIN_SIZE, MAX_SIZE } from "./validate.js";
import * as LK from "/public/looks.js";
import * as SPC from "/public/species.js";
import * as UIC from "/public/uiicons.js";

const LAYERS = [
  ["ground", "바닥", "바닥을 칠해요 (풀·길·물…)", "1"],
  ["objects", "물체", "나무·바위·벽 같은 물체를 놓아요 (물체는 지나갈 수 없어요)", "2"],
  ["spawns", "몬스터 구역", "끌어서 몬스터가 나오는 네모 구역을 만들어요", "3"],
  ["npcs", "NPC", "눌러서 NPC를 놓고, 오른쪽에서 이름·모습·대사를 고쳐요", "4"],
  ["portals", "문", "눌러서 다른 맵으로 가는 문을 놓아요", "5"],
  ["fires", "모닥불", "눌러서 모닥불을 놓거나 치워요 (쉬기·요리하는 곳)", "6"],
  ["waypoint", "이동의 돌", "눌러서 이동의 돌 자리를 정해요 (순간이동 지점)", "7"],
  ["entry", "입구", "눌러서 이 맵에 처음 도착하는 자리를 정해요", "8"],
  ["boss", "필드 보스", "눌러서 필드 보스가 나타날 자리를 정해요", "9"],
];
const TOOLS = [
  ["brush", "붓", "누르고 끌면서 칠해요 (B)", "b"],
  ["rect", "사각형", "끌어서 네모로 칠해요. Shift를 누르면 테두리만 (R)", "r"],
  ["fill", "채우기", "같은 것이 이어진 곳을 한 번에 칠해요 (K)", "k"],
  ["erase", "지우개", "지워요: 물체는 빈칸, 바닥은 기본 바닥 (E)", "e"],
  ["pick", "스포이트", "맵에서 눌러 그 칸의 바닥/물체를 골라요 (I)", "i"],
  ["select", "선택", "끌어서 영역을 골라요. Ctrl+C 복사, Ctrl+V 붙여넣기, T 회전, Delete 지우기 (S)", "s"],
];
const BASE = { town: ".", meadow: ".", forest: ".", crypt: "c", city: "k", sewer: "c", cave: "g", abyss: "n" };
const UNDO_MAX = 200;
const LOCKED_LAYERS = new Set(["npcs", "portals"]);

const E = {
  id: null, m: null, g: null, o: null, locked: false, isNew: false,
  links: { v: 1, links: [] }, npcsFile: { v: 1, npcs: [] },
  saved: { map: "", links: "", npcs: "" },
  layer: "ground", tool: "brush", size: 1, cur: { ground: ".", objects: "T" },
  zoom: 4, ox: 20, oy: 20, grid: true, hover: null,
  sel: null, clip: null, pasting: false, drag: null,
  undo: [], redo: [], focus: null, problems: [], flash: null,
  version: 0, pvVersion: -1, lastMob: null,
};
let cv, ctx, wrap, onDirty = () => {};
const ts = () => 4 * E.zoom;

// ───────────────────────────── map data helpers ─────────────────────────────
const rowsToGrid = (rows) => rows.map((r) => [...r]);
function serialize() {
  if (!E.m) return null;
  const m = { ...E.m, ground: E.g.map((r) => r.join("")), objects: E.o.map((r) => r.join("")) };
  // houses and fountains drawn as one big sprite follow the "h"/"a" blocks under them;
  // signpost texts follow their "G" objects (both only when the file has them)
  if (Array.isArray(m.big)) m.big = bigOf(m.objects, m.big, m.theme);
  if (Array.isArray(m.marks)) m.marks = m.marks.filter((k) => k.kind !== "sign" || (m.objects[k.y] && m.objects[k.y][k.x] === "G"));
  return m;
}
/** The big pieces over a set of object rows: the ones in `keep` still standing, plus one per new 4×3 "h" / 2×2 "a" block. */
export function bigOf(o, keep = [], th = "town") {
  const block = (x, y, w, h, ch) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!o[y + j] || o[y + j][x + i] !== ch) return false; return true; };
  const out = keep.filter((b) => (b.t === "house" ? block(b.x, b.y, 4, 3, "h") : b.t === "fountain" ? block(b.x, b.y, 2, 2, "a") : true)).map((b) => ({ ...b }));
  const seen = new Set();
  for (const b of out) { const [w, h] = b.t === "house" ? [4, 3] : [2, 2]; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add(b.x + i + "," + (b.y + j)); }
  for (let y = 0; y < o.length; y++) for (let x = 0; x < o[y].length; x++) {
    const ch = o[y][x];
    if ((ch !== "h" && ch !== "a") || seen.has(x + "," + y)) continue;
    const [w, h] = ch === "h" ? [4, 3] : [2, 2];
    if (!block(x, y, w, h, ch)) continue;
    let free = true;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (seen.has(x + i + "," + (y + j))) free = false;
    if (!free) continue;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add(x + i + "," + (y + j));
    out.push(ch === "h" ? { t: "house", x, y, v: (th === "city" ? 4 : 0) + ((x * 7 + y * 3) % 4) } : { t: "fountain", x, y });
  }
  return out;
}
const mapJson = () => (E.m && !E.locked ? JSON.stringify(serialize()) : "");
const linksJson = () => JSON.stringify(E.links);
const npcsJson = () => JSON.stringify(E.npcsFile);
export function dirty() {
  if (!E.m) return { map: false, links: false, npcs: false, any: false };
  const d = { map: E.isNew || mapJson() !== E.saved.map, links: linksJson() !== E.saved.links, npcs: npcsJson() !== E.saved.npcs };
  d.any = d.map || d.links || d.npcs;
  return d;
}
const theme = () => (E.m && E.m.theme) || "meadow";
/** A ground tile's colour as the minimap draws it in this theme. */
const gCol = (ch, th = theme()) => { const p = DB.pg[ch]; return p ? (p.themeColors && p.themeColors[th]) || p.color : "#ff00ff"; };
const oCol = (ch) => (DB.po[ch] && DB.po[ch].color) || "#ff00ff";
/** Is this map id (a map's own id or its file alias) the one open? */
const here = (id) => !!E.m && (id === E.id || id === E.m.id);
const baseGround = () => (DB.pg[BASE[theme()]] ? BASE[theme()] : DB.palette.ground[0].ch);
const solidG = () => new Set(DB.palette.ground.filter((p) => p.solid).map((p) => p.ch));
const inside = (x, y) => E.m && x >= 0 && y >= 0 && x < E.m.w && y < E.m.h;
const canStand = (x, y) => inside(x, y) && E.o[y][x] === " " && !solidG().has(E.g[y][x]);

/** NPCs shown on this map: [{ src: "map" | "file" | "builtin", n }]. */
function npcItems() {
  if (!E.m) return [];
  const out = E.m.npcs.map((n) => ({ src: E.locked ? "builtin" : "map", n }));
  const builtinish = E.locked || E.m.replaces || DB.maps.some((m) => m.id === E.id && m.builtin);
  if (builtinish) for (const n of E.npcsFile.npcs) if (here(n.map)) out.push({ src: "file", n });
  return out;
}
/** Doors on this map: own portals and links.json entries. */
function doorItems() {
  if (!E.m) return [];
  const out = E.m.portals.map((d) => ({ src: E.locked ? "builtin" : "map", d }));
  for (const l of E.links.links) if (here(l.map)) out.push({ src: "links", d: l });
  return out;
}
const editable = (it) => it && it.src !== "builtin";

// ───────────────────────────── undo ─────────────────────────────
function snap() { return JSON.stringify({ m: serialize(), links: E.links, npcs: E.npcsFile }); }
function restore(s) {
  const j = JSON.parse(s);
  E.m = j.m; E.g = rowsToGrid(j.m.ground); E.o = rowsToGrid(j.m.objects); E.links = j.links; E.npcsFile = j.npcs;
  E.focus = null;
}
/** Call before a change. */
function push() {
  E.undo.push(snap());
  if (E.undo.length > UNDO_MAX) E.undo.shift();
  E.redo.length = 0;
}
function changed(panel = false) {
  E.version++;
  if (panel) renderSide();
  scheduleCheck();
  onDirty();
  draw();
}
export function undo() { if (!E.undo.length) return toast("더 되돌릴 게 없어요."); E.redo.push(snap()); restore(E.undo.pop()); afterRestore(); }
export function redo() { if (!E.redo.length) return toast("다시 할 게 없어요."); E.undo.push(snap()); restore(E.redo.pop()); afterRestore(); }
function afterRestore() { renderProps(); changed(true); }

// ───────────────────────────── painting ─────────────────────────────
function layerGrid() { return E.layer === "objects" ? E.o : E.g; }
function eraseChar() { return E.layer === "objects" ? " " : baseGround(); }
function paintChar() { return E.tool === "erase" ? eraseChar() : E.cur[E.layer]; }
function setTile(L, x, y, ch) {
  if (!inside(x, y)) return;
  if (ch === "h" && L === E.o) return;    // houses are stamped whole (see stampHouse)
  L[y][x] = ch;
}
function dab(x, y) {
  const L = layerGrid(), ch = paintChar(), r = E.size - 1, a = -Math.floor(r / 2);
  if (ch === "h" && E.layer === "objects" && E.tool !== "erase") return stampHouse(x, y);
  if (E.layer === "objects" && E.tool === "erase") for (let dy = 0; dy <= r; dy++) for (let dx = 0; dx <= r; dx++) clearHouseAt(x + a + dx, y + a + dy);
  for (let dy = 0; dy <= r; dy++) for (let dx = 0; dx <= r; dx++) setTile(L, x + a + dx, y + a + dy, ch);
}
/** A house is always 4×3 tiles of "h"; place it with its top-left at (x, y). */
function stampHouse(x, y) {
  if (x < 0 || y < 0 || x + 3 >= E.m.w || y + 2 >= E.m.h) return;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) E.o[y + j][x + i] = "h";
}
/** Erasing one tile of a house removes the whole block (a broken house cannot be drawn). */
function clearHouseAt(x, y) {
  if (!inside(x, y) || E.o[y][x] !== "h") return;
  const st = [[x, y]];
  while (st.length) {
    const [a, b] = st.pop();
    if (!inside(a, b) || E.o[b][a] !== "h") continue;
    E.o[b][a] = " ";
    st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
}
function line(x0, y0, x1, y1, f) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    f(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function fillRect(r, outline) {
  const L = layerGrid(), ch = paintChar();
  if (ch === "h" && E.layer === "objects") {
    for (let y = r.y0; y + 2 <= r.y1; y += 3) for (let x = r.x0; x + 3 <= r.x1; x += 4) stampHouse(x, y);
    return;
  }
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    if (outline && x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) continue;
    if (E.layer === "objects" && E.tool === "erase") clearHouseAt(x, y);
    setTile(L, x, y, ch);
  }
}
function flood(x, y) {
  const L = layerGrid(), ch = paintChar(), from = L[y][x];
  if (from === ch || ch === "h") return;
  const st = [[x, y]];
  let n = 0;
  while (st.length && n < 40000) {
    const [a, b] = st.pop();
    if (!inside(a, b) || L[b][a] !== from) continue;
    L[b][a] = ch; n++;
    st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
  }
}
const normRect = (a, b) => ({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) });

// ───────────────────────────── copy / paste ─────────────────────────────
export function copySel() {
  if (!E.sel) return toast("먼저 선택 도구로 영역을 고르세요.");
  const r = E.sel, w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
  E.clip = { w, h, g: [], o: [] };
  for (let y = 0; y < h; y++) { E.clip.g.push(E.g[r.y0 + y].slice(r.x0, r.x1 + 1)); E.clip.o.push(E.o[r.y0 + y].slice(r.x0, r.x1 + 1)); }
  toast(`${w}×${h} 칸을 복사했어요. Ctrl+V로 붙여넣기`);
}
export function pasteMode() {
  if (!E.clip) return toast("복사한 게 없어요. 선택 → Ctrl+C 먼저.");
  if (E.locked) return lockedToast();
  if (!["ground", "objects"].includes(E.layer)) setLayer("ground");
  setTool("select");
  E.pasting = true;
  hint("붙일 곳을 누르세요 · T 회전 · Esc 취소");
  draw();
}
export function rotateClip() {
  if (!E.clip) return;
  const { w, h, g, o } = E.clip;
  const rot = (L) => Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => L[h - 1 - x][y]));
  E.clip = { w: h, h: w, g: rot(g), o: rot(o) };
  // a house only reads as 4×3: turned on its side its tiles would not be a house any more
  for (const r of E.clip.o) for (let i = 0; i < r.length; i++) if (r[i] === "h") r[i] = " ";
  toast("90° 돌렸어요" + (E.clip.o.flat().length ? "" : ""));
  draw();
}
function pasteAt(x, y) {
  push();
  const { w, h, g, o } = E.clip;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!inside(x + i, y + j)) continue;
    E.g[y + j][x + i] = g[j][i];
    E.o[y + j][x + i] = o[j][i];
  }
  E.sel = { x0: x, y0: y, x1: Math.min(E.m.w - 1, x + w - 1), y1: Math.min(E.m.h - 1, y + h - 1) };
  changed();
}
export function deleteSel() {
  if (E.sel && ["ground", "objects"].includes(E.layer)) {
    if (E.locked) return lockedToast();
    push();
    const L = layerGrid(), ch = eraseChar();
    for (let y = E.sel.y0; y <= E.sel.y1; y++) for (let x = E.sel.x0; x <= E.sel.x1; x++) { if (E.layer === "objects") clearHouseAt(x, y); L[y][x] = ch; }
    changed();
    return;
  }
  removeFocus();
}

// ───────────────────────────── view ─────────────────────────────
function tileAt(ev) {
  const r = cv.getBoundingClientRect();
  return [Math.floor((ev.clientX - r.left - E.ox) / ts()), Math.floor((ev.clientY - r.top - E.oy) / ts())];
}
export function setZoom(z, cx, cy) {
  z = Math.max(1, Math.min(8, z));
  if (z === E.zoom) return;
  if (cx === undefined) { cx = cv.width / 2; cy = cv.height / 2; }
  const wx = (cx - E.ox) / ts(), wy = (cy - E.oy) / ts();
  E.zoom = z;
  E.ox = Math.round(cx - wx * ts()); E.oy = Math.round(cy - wy * ts());
  $("#zoom-lab").textContent = z + "×";
  draw();
}
export function fit() {
  if (!E.m) return;
  // the box, not the canvas: the canvas only takes the box's size at its next paint
  const W = wrap.clientWidth || cv.width, H = wrap.clientHeight || cv.height;
  const z = Math.max(1, Math.min(8, Math.floor(Math.min((W - 20) / (E.m.w * 4), (H - 20) / (E.m.h * 4)))));
  E.zoom = z;
  $("#zoom-lab").textContent = z + "×";
  E.ox = Math.round((W - E.m.w * ts()) / 2); E.oy = Math.round((H - E.m.h * ts()) / 2);
  draw();
}
/** Centre the view on a tile and blink it. */
export function jumpTo(x, y) {
  if (!E.m || x == null) return;
  if (E.zoom < 4) E.zoom = 4, $("#zoom-lab").textContent = "4×";
  E.ox = Math.round(cv.width / 2 - (x + 0.5) * ts()); E.oy = Math.round(cv.height / 2 - (y + 0.5) * ts());
  E.flash = { x, y, t: performance.now() };
  draw();
  const tick = () => { draw(); if (E.flash && performance.now() - E.flash.t < 1600) requestAnimationFrame(tick); else { E.flash = null; draw(); } };
  requestAnimationFrame(tick);
}
const viewCentre = () => [Math.max(0, Math.min(E.m.w - 1, Math.floor((cv.width / 2 - E.ox) / ts()))), Math.max(0, Math.min(E.m.h - 1, Math.floor((cv.height / 2 - E.oy) / ts())))];

// ───────────────────────────── drawing ─────────────────────────────
const ROUND = new Set(["T", "P", "B", "H", "A", "Y", "u", "e"]);
const GLYPH = {};
const glyph = (name, color) => GLYPH[name + color] || (GLYPH[name + color] = UIC.icon(name, color));
const imgCache = new Map();
function img(url) {
  if (!url) return null;
  let i = imgCache.get(url);
  if (!i) { i = new Image(); i.src = url; i.onload = () => draw(); imgCache.set(url, i); }
  return i.complete && i.naturalWidth ? i : null;
}
let raf = 0;
export function draw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }
function paint() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0b0910"; ctx.fillRect(0, 0, W, H);
  $("#empty-hint").hidden = !!E.m;
  if (!E.m) return;
  const s = ts(), m = E.m;
  const x0 = Math.max(0, Math.floor(-E.ox / s)), y0 = Math.max(0, Math.floor(-E.oy / s));
  const x1 = Math.min(m.w - 1, Math.ceil((W - E.ox) / s)), y1 = Math.min(m.h - 1, Math.ceil((H - E.oy) / s));
  const X = (x) => E.ox + x * s, Y = (y) => E.oy + y * s;
  // the map's edge
  ctx.fillStyle = "#000"; ctx.fillRect(X(0) - 2, Y(0) - 2, m.w * s + 4, m.h * s + 4);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    ctx.fillStyle = gCol(E.g[y][x]);
    ctx.fillRect(X(x), Y(y), s, s);
  }
  // objects
  const pad = Math.max(1, Math.round(s / 8));
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${Math.max(8, Math.round(s * 0.55))}px Galmuri9, monospace`;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = E.o[y][x];
    if (ch === " ") continue;
    const col = oCol(ch);
    if (ch === "h") {
      // a house block: draw as one roofed rectangle
      ctx.fillStyle = "#4a3a30"; ctx.fillRect(X(x), Y(y), s, s);
      ctx.fillStyle = col; ctx.fillRect(X(x), Y(y), s, s - pad);
      if (E.o[y - 1] && E.o[y - 1][x] !== "h") { ctx.fillStyle = "#b84a3a"; ctx.fillRect(X(x), Y(y), s, Math.ceil(s / 2)); }
      continue;
    }
    ctx.fillStyle = "#0d0b12";
    if (ROUND.has(ch)) { ctx.beginPath(); ctx.arc(X(x) + s / 2, Y(y) + s / 2, s / 2 - pad + 1, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(x) + s / 2, Y(y) + s / 2, s / 2 - pad, 0, 7); ctx.fill(); }
    else { ctx.fillRect(X(x) + pad - 1, Y(y) + pad - 1, s - 2 * pad + 2, s - 2 * pad + 2); ctx.fillStyle = col; ctx.fillRect(X(x) + pad, Y(y) + pad, s - 2 * pad, s - 2 * pad); }
    if (s >= 16) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillText(ch, X(x) + s / 2 + 1, Y(y) + s / 2 + 1); ctx.fillStyle = "#fff"; ctx.fillText(ch, X(x) + s / 2, Y(y) + s / 2); }
  }
  // grid
  if (E.grid && s >= 8) {
    ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(X(x) + 0.5, Y(y0)); ctx.lineTo(X(x) + 0.5, Y(y1 + 1)); }
    for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(X(x0), Y(y) + 0.5); ctx.lineTo(X(x1 + 1), Y(y) + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath();
    for (let x = Math.ceil(x0 / 8) * 8; x <= x1 + 1; x += 8) { ctx.moveTo(X(x) + 0.5, Y(y0)); ctx.lineTo(X(x) + 0.5, Y(y1 + 1)); }
    for (let y = Math.ceil(y0 / 8) * 8; y <= y1 + 1; y += 8) { ctx.moveTo(X(x0), Y(y) + 0.5); ctx.lineTo(X(x1 + 1), Y(y) + 0.5); }
    ctx.stroke();
  }
  const dim = (L) => (E.layer === L ? 1 : 0.75);
  // spawn zones
  m.spawns.forEach((sp, i) => {
    const [a, b, c, d] = sp.r, on = E.focus && E.focus.kind === "spawn" && E.focus.i === i;
    ctx.globalAlpha = dim("spawns");
    ctx.fillStyle = on ? "rgba(255,210,90,.22)" : "rgba(230,60,70,.16)";
    ctx.fillRect(X(a), Y(b), (c - a + 1) * s, (d - b + 1) * s);
    ctx.strokeStyle = on ? "#ffd25a" : "#e83c46"; ctx.lineWidth = on ? 3 : 2;
    ctx.setLineDash(on ? [] : [6, 4]);
    ctx.strokeRect(X(a) + 1, Y(b) + 1, (c - a + 1) * s - 2, (d - b + 1) * s - 2);
    ctx.setLineDash([]);
    const im = img(mobIcon(sp.k)), z = Math.max(16, Math.min(40, s * 1.6));
    if (im) ctx.drawImage(im, X(a) + 3, Y(b) + 3, z, z);
    label(`${mobName(sp.k)} ×${sp.n}${sp.elite ? ` 정예${Math.round(sp.elite * 100)}%` : ""}`, X(a) + 4 + (im ? z : 0), Y(b) + 4, on ? "#ffd25a" : "#ffb0b0", "left");
    if (on && !E.locked) { ctx.fillStyle = "#ffd25a"; ctx.fillRect(X(c + 1) - 7, Y(d + 1) - 7, 7, 7); }
    ctx.globalAlpha = 1;
  });
  // fires, waypoint, entry, boss
  const mark = (x, y, name, color, text) => {
    if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) return;
    ctx.fillStyle = "rgba(13,11,18,.75)"; ctx.fillRect(X(x) + 1, Y(y) + 1, s - 2, s - 2);
    const z = Math.max(12, Math.floor(s / 12) * 12 || 12);
    ctx.drawImage(glyph(name, color), X(x) + (s - Math.min(z, s)) / 2, Y(y) + (s - Math.min(z, s)) / 2, Math.min(z, s), Math.min(z, s));
    if (text && s >= 12) label(text, X(x) + s / 2, Y(y) - 2, color, "center", true);
  };
  for (const f of m.fires) { ctx.globalAlpha = dim("fires"); mark(f[0], f[1], "fire", "#ff9a40", s >= 24 ? "모닥불" : ""); }
  ctx.globalAlpha = dim("waypoint");
  if (m.waypoint) mark(m.waypoint[0], m.waypoint[1], "stone", "#5ae4d0", "이동의 돌");
  ctx.globalAlpha = dim("entry");
  if (m.entry) mark(m.entry[0], m.entry[1], "person", "#7ad070", "입구");
  ctx.globalAlpha = dim("boss");
  if (m.boss) {
    mark(m.boss.x, m.boss.y, "skull", "#ff6070", "보스 " + mobName(m.boss.k));
    const im = img(mobIcon(m.boss.k));
    if (im && s >= 16) ctx.drawImage(im, X(m.boss.x) - s / 2, Y(m.boss.y) - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
  // doors
  doorItems().forEach((it, i) => {
    const d = it.d, on = E.focus && E.focus.kind === "door" && E.focus.d === d;
    ctx.globalAlpha = dim("portals");
    ctx.fillStyle = it.src === "links" ? "#c070ff" : "#8a5ae0";
    ctx.fillRect(X(d.x) + 1, Y(d.y) + 1, s - 2, s - 2);
    ctx.fillStyle = "#1a1030"; ctx.fillRect(X(d.x) + s * 0.3, Y(d.y) + s * 0.2, s * 0.4, s * 0.8 - 1);
    if (on) { ctx.strokeStyle = "#ffd25a"; ctx.lineWidth = 3; ctx.strokeRect(X(d.x) - 1, Y(d.y) - 1, s + 2, s + 2); }
    if (s >= 12 && (i === 0 || !doorItems()[i - 1] || doorItems()[i - 1].d.to !== d.to || Math.abs(doorItems()[i - 1].d.x - d.x) + Math.abs(doorItems()[i - 1].d.y - d.y) > 1))
      label("→ " + mapName(d.to), X(d.x) + s / 2, Y(d.y) - 2, "#e0c0ff", "center", true);
    ctx.globalAlpha = 1;
  });
  // NPCs
  for (const it of npcItems()) {
    const n = it.n, on = E.focus && E.focus.kind === "npc" && E.focus.n === n;
    if (n.x < x0 - 2 || n.x > x1 + 2 || n.y < y0 - 2 || n.y > y1 + 2) continue;
    ctx.globalAlpha = dim("npcs");
    const im = img(npcIcon(n)), z = Math.max(s * 1.5, 16);
    if (on) { ctx.strokeStyle = "#ffd25a"; ctx.lineWidth = 3; ctx.strokeRect(X(n.x) - 1, Y(n.y) - 1, s + 2, s + 2); }
    else { ctx.strokeStyle = it.src === "builtin" ? "#9a9ab0" : "#fff"; ctx.lineWidth = 1; ctx.strokeRect(X(n.x) + 0.5, Y(n.y) + 0.5, s - 1, s - 1); }
    if (im) ctx.drawImage(im, X(n.x) + s / 2 - z / 2, Y(n.y) + s - z * 0.92, z, z);
    if (s >= 12) label(n.name, X(n.x) + s / 2, Y(n.y) + s + 9, on ? "#ffd25a" : "#fff", "center", true);
    ctx.globalAlpha = 1;
  }
  // selection, rect preview, paste preview, hover
  if (E.sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(X(E.sel.x0) + 1, Y(E.sel.y0) + 1, (E.sel.x1 - E.sel.x0 + 1) * s - 2, (E.sel.y1 - E.sel.y0 + 1) * s - 2); ctx.setLineDash([]); }
  if (E.drag && E.drag.rect) {
    const r = E.drag.rect;
    ctx.fillStyle = E.layer === "spawns" ? "rgba(230,60,70,.25)" : "rgba(255,255,255,.18)";
    ctx.fillRect(X(r.x0), Y(r.y0), (r.x1 - r.x0 + 1) * s, (r.y1 - r.y0 + 1) * s);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(X(r.x0) + 1, Y(r.y0) + 1, (r.x1 - r.x0 + 1) * s - 2, (r.y1 - r.y0 + 1) * s - 2);
    label(`${r.x1 - r.x0 + 1}×${r.y1 - r.y0 + 1}`, X(r.x1 + 1) + 4, Y(r.y1 + 1) + 4, "#fff", "left");
  }
  if (E.pasting && E.clip && E.hover) {
    const [hx, hy] = E.hover;
    ctx.globalAlpha = 0.65;
    for (let j = 0; j < E.clip.h; j++) for (let i = 0; i < E.clip.w; i++) {
      if (!inside(hx + i, hy + j)) continue;
      const o = E.clip.o[j][i];
      ctx.fillStyle = gCol(E.clip.g[j][i]); ctx.fillRect(X(hx + i), Y(hy + j), s, s);
      if (o !== " ") { ctx.fillStyle = oCol(o); ctx.fillRect(X(hx + i) + pad, Y(hy + j) + pad, s - 2 * pad, s - 2 * pad); }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffd25a"; ctx.lineWidth = 2; ctx.strokeRect(X(hx), Y(hy), E.clip.w * s, E.clip.h * s);
  } else if (E.hover && inside(...E.hover)) {
    const [hx, hy] = E.hover;
    let w = 1, h = 1, ox = 0;
    if (["ground", "objects"].includes(E.layer) && ["brush", "erase"].includes(E.tool)) { w = h = E.size; ox = -Math.floor((E.size - 1) / 2); }
    if (E.layer === "objects" && E.tool === "brush" && E.cur.objects === "h") { w = 4; h = 3; ox = 0; }
    ctx.strokeStyle = "#ffe9b8"; ctx.lineWidth = 2;
    ctx.strokeRect(X(hx + ox) + 1, Y(hy + ox) + 1, w * s - 2, h * s - 2);
  }
  if (E.flash) {
    const k = (performance.now() - E.flash.t) / 1600, on = Math.floor(k * 8) % 2 === 0;
    if (on) { ctx.strokeStyle = "#ff3050"; ctx.lineWidth = 4; ctx.strokeRect(X(E.flash.x) - 6, Y(E.flash.y) - 6, s + 12, s + 12); }
  }
}
function label(text, x, y, color, align = "left", above = false) {
  ctx.font = "11px Galmuri9, sans-serif";
  ctx.textAlign = align; ctx.textBaseline = above ? "bottom" : "top";
  const w = ctx.measureText(text).width + 6, lx = align === "center" ? x - w / 2 : x - 3, ly = above ? y - 13 : y - 1;
  ctx.fillStyle = "rgba(13,11,18,.78)"; ctx.fillRect(Math.round(lx), Math.round(ly), Math.round(w), 14);
  ctx.fillStyle = color; ctx.fillText(text, Math.round(x), Math.round(above ? y : y));
}

// ───────────────────────────── mouse ─────────────────────────────
let space = false;
function lockedToast() { toast("기본 맵은 바닥·물체를 바로 고칠 수 없어요. 위 안내줄의 [이 맵 직접 고치기]를 누르세요.", "bad"); }
function hitSpawn(x, y) { for (let i = E.m.spawns.length - 1; i >= 0; i--) { const r = E.m.spawns[i].r; if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return i; } return -1; }
const hitNpc = (x, y) => npcItems().find((it) => it.n.x === x && it.n.y === y);
const hitDoor = (x, y) => doorItems().find((it) => it.d.x === x && it.d.y === y);

function onDown(ev) {
  if (!E.m) return;
  cv.setPointerCapture(ev.pointerId);
  if (ev.button === 1 || ev.button === 2 || space) {
    E.drag = { pan: true, sx: ev.clientX, sy: ev.clientY, ox: E.ox, oy: E.oy };
    cv.style.cursor = "grabbing";
    return;
  }
  if (ev.button !== 0) return;
  const [x, y] = tileAt(ev);
  const L = E.layer;
  if (E.locked && !LOCKED_LAYERS.has(L)) return lockedToast();
  if (E.pasting) { if (inside(x, y)) pasteAt(x, y); E.pasting = false; hint(""); return; }
  if (L === "ground" || L === "objects") {
    if (!inside(x, y) && E.tool !== "select") return;
    if (E.tool === "pick") {
      const ch = (L === "objects" ? E.o : E.g)[y][x];
      if (L === "objects" && ch === " ") { E.cur.ground = E.g[y][x]; setLayer("ground"); toast(`바닥 "${(DB.pg[E.g[y][x]] || {}).name || E.g[y][x]}"을(를) 골랐어요`); }
      else { E.cur[L] = ch; toast(`"${((L === "objects" ? DB.po : DB.pg)[ch] || {}).name || ch}"을(를) 골랐어요`); }
      setTool("brush");
      return;
    }
    if (E.tool === "fill") { push(); flood(x, y); changed(); return; }
    if (E.tool === "brush" || E.tool === "erase") { push(); dab(x, y); E.drag = { paint: true, last: [x, y] }; changed(); return; }
    if (E.tool === "rect" || E.tool === "select") {
      const c = [Math.max(0, Math.min(E.m.w - 1, x)), Math.max(0, Math.min(E.m.h - 1, y))];
      E.drag = { rect: normRect(c, c), a: c, kind: E.tool };
      if (E.tool === "select") E.sel = null;
      draw();
    }
    return;
  }
  if (!inside(x, y)) return;
  if (L === "spawns") {
    const i = hitSpawn(x, y);
    if (i >= 0) {
      const r = E.m.spawns[i].r;
      setFocus({ kind: "spawn", i });
      push();
      E.drag = x === r[2] && y === r[3] ? { resize: i, moved: false } : { move: i, at: [x, y], r0: r.slice(), moved: false };
      return;
    }
    E.drag = { rect: normRect([x, y], [x, y]), a: [x, y], kind: "spawn" };
    draw();
    return;
  }
  if (L === "npcs") {
    const it = hitNpc(x, y);
    if (it) { setFocus({ kind: "npc", n: it.n, src: it.src }); if (editable(it)) { push(); E.drag = { npc: it.n, moved: false }; } return; }
    addNpc(x, y);
    return;
  }
  if (L === "portals") {
    const it = hitDoor(x, y);
    if (it) { setFocus({ kind: "door", d: it.d, src: it.src }); if (editable(it)) { push(); E.drag = { door: it.d, moved: false }; } return; }
    addDoor(x, y);
    return;
  }
  if (L === "fires") {
    push();
    const i = E.m.fires.findIndex((f) => f[0] === x && f[1] === y);
    if (i >= 0) E.m.fires.splice(i, 1); else { E.m.fires.push([x, y]); if (!canStand(x, y)) toast("모닥불이 막힌 칸 위에 있어요.", "bad"); }
    changed(true);
    return;
  }
  if (L === "waypoint") {
    push();
    const old = E.m.waypoint;
    if (old && E.o[old[1]] && E.o[old[1]][old[0]] === "Q") E.o[old[1]][old[0]] = " ";
    E.m.waypoint = old && old[0] === x && old[1] === y ? null : [x, y];
    changed(true);
    return;
  }
  if (L === "entry") { push(); E.m.entry = [x, y]; if (!canStand(x, y)) toast("입구가 막힌 칸 위예요. 빈 땅을 고르세요.", "bad"); changed(true); return; }
  if (L === "boss") {
    push();
    if (!E.m.boss) { const b = bossDefault(); E.m.boss = { k: b, x, y }; }
    else { E.m.boss.x = x; E.m.boss.y = y; }
    changed(true);
  }
}
function onMove(ev) {
  if (!E.m) return;
  const [x, y] = tileAt(ev);
  const was = E.hover;
  E.hover = [x, y];
  status(x, y);
  const d = E.drag;
  if (d && d.pan) { E.ox = d.ox + ev.clientX - d.sx; E.oy = d.oy + ev.clientY - d.sy; draw(); return; }
  if (d && d.paint) { line(d.last[0], d.last[1], x, y, (a, b) => dab(a, b)); d.last = [x, y]; changed(); return; }
  const cx = Math.max(0, Math.min(E.m.w - 1, x)), cy = Math.max(0, Math.min(E.m.h - 1, y));
  if (d && d.rect) { d.rect = normRect(d.a, [cx, cy]); draw(); return; }
  if (d && d.move !== undefined) {
    const sp = E.m.spawns[d.move], dx = cx - d.at[0], dy = cy - d.at[1];
    const w = d.r0[2] - d.r0[0], h = d.r0[3] - d.r0[1];
    const nx = Math.max(0, Math.min(E.m.w - 1 - w, d.r0[0] + dx)), ny = Math.max(0, Math.min(E.m.h - 1 - h, d.r0[1] + dy));
    sp.r = [nx, ny, nx + w, ny + h]; d.moved = true; changed(); return;
  }
  if (d && d.resize !== undefined) { const r = E.m.spawns[d.resize].r; r[2] = Math.max(r[0], cx); r[3] = Math.max(r[1], cy); d.moved = true; changed(); return; }
  if (d && d.npc) { if (d.npc.x !== cx || d.npc.y !== cy) { d.npc.x = cx; d.npc.y = cy; d.moved = true; changed(); } return; }
  if (d && d.door) { if (d.door.x !== cx || d.door.y !== cy) { d.door.x = cx; d.door.y = cy; d.moved = true; changed(); } return; }
  if (!was || was[0] !== x || was[1] !== y) draw();
}
function onUp() {
  const d = E.drag;
  E.drag = null;
  cv.style.cursor = space ? "grab" : "crosshair";
  if (!d) return;
  if ((d.move !== undefined || d.resize !== undefined || d.npc || d.door) && !d.moved) E.undo.pop();   // a click, not a drag
  if (d.moved) renderSide();
  if (d.rect && d.kind === "rect") { push(); fillRect(d.rect, d.shift); changed(); }
  else if (d.rect && d.kind === "select") { E.sel = d.rect; hint(`${d.rect.x1 - d.rect.x0 + 1}×${d.rect.y1 - d.rect.y0 + 1} 선택됨 · Ctrl+C 복사 · Delete 지우기`); draw(); }
  else if (d.rect && d.kind === "spawn") addSpawn(d.rect);
  else draw();
}
function onWheel(ev) {
  if (!E.m) return;
  ev.preventDefault();
  const r = cv.getBoundingClientRect();
  setZoom(E.zoom + (ev.deltaY < 0 ? 1 : -1), ev.clientX - r.left, ev.clientY - r.top);
}
function status(x, y) {
  $("#st-xy").textContent = inside(x, y) ? `x ${x}, y ${y}` : "-";
  if (!inside(x, y)) { $("#st-tile").textContent = ""; return; }
  const g = DB.pg[E.g[y][x]], o = E.o[y][x], op = DB.po[o];
  let t = `바닥: ${g ? g.name : E.g[y][x]}` + (o !== " " ? ` · 물체: ${op ? op.name : o}` : "");
  const sp = hitSpawn(x, y);
  if (sp >= 0) t += ` · 몬스터: ${mobName(E.m.spawns[sp].k)}`;
  const n = hitNpc(x, y); if (n) t += ` · NPC: ${n.n.name}`;
  const dd = hitDoor(x, y); if (dd) t += ` · 문 → ${mapName(dd.d.to)}`;
  $("#st-tile").textContent = t;
}
export function hint(t) { $("#st-hint").textContent = t || LAYERS.find((l) => l[0] === E.layer)[2]; }

// ───────────────────────────── adding things ─────────────────────────────
function bossDefault() {
  const b = Object.entries(DB.defs.mobs).find(([, m]) => m.boss && !m.chest);
  return b ? b[0] : fieldMobs()[0][0];
}
function mobForBand() {
  if (E.lastMob && DB.defs.mobs[E.lastMob]) return E.lastMob;
  const lv = E.m.band ? E.m.band[0] : 1;
  const list = fieldMobs().filter(([, m]) => !m.boss);
  let best = list[0];
  for (const e of list) if (Math.abs(e[1].lv - lv) < Math.abs(best[1].lv - lv)) best = e;
  return best[0];
}
function addSpawn(r) {
  push();
  const area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  E.m.spawns.push({ k: mobForBand(), n: Math.max(1, Math.min(8, Math.round(area / 14))), r: [r.x0, r.y0, r.x1, r.y1], elite: 0.05 });
  E.focus = { kind: "spawn", i: E.m.spawns.length - 1 };
  changed(true);
  toast("몬스터 구역을 만들었어요. 오른쪽에서 몬스터를 고르세요.", "ok");
}
function uniqueNpcId() {
  // NPC ids are unique across the whole world
  const used = new Set([...npcItems().map((it) => it.n.id), ...E.npcsFile.npcs.map((n) => n.id), ...(DB.defs.npcs || []).map((n) => n.id)]);
  const base = (E.id + "_npc").slice(0, 28);
  for (let i = 1; ; i++) if (!used.has(base + i)) return base + i;
}
function addNpc(x, y) {
  push();
  const n = { id: uniqueNpcId(), name: "새 주민", role: "talk", x, y, look: SPC.PRESETS[Math.floor(Math.random() * SPC.PRESETS.length)][1].slice(), lines: ["안녕, 모험가!"] };
  if (E.locked) E.npcsFile.npcs.push({ map: E.id, ...n });
  else E.m.npcs.push(n);
  const added = E.locked ? E.npcsFile.npcs[E.npcsFile.npcs.length - 1] : n;
  E.focus = { kind: "npc", n: added, src: E.locked ? "file" : "map" };
  if (!canStand(x, y)) toast("NPC가 막힌 칸 위에 서 있어요.", "bad");
  changed(true);
  setTimeout(() => { const i = $("#npc-name"); if (i) { i.focus(); i.select(); } }, 30);
}
async function addDoor(x, y) {
  push();
  const to = DB.maps.find((m) => m.id !== E.id && m.id === "town") ? "town" : (DB.maps.find((m) => m.id !== E.id) || {}).id || E.id;
  const target = await mapCached(to).catch(() => null);
  const d = { x, y, to, tx: target ? target.entry[0] : 0, ty: target ? target.entry[1] : 0 };
  if (E.locked) E.links.links.push({ map: E.id, ...d, label: mapName(to) });
  else E.m.portals.push(d);
  const added = E.locked ? E.links.links[E.links.links.length - 1] : d;
  E.focus = { kind: "door", d: added, src: E.locked ? "links" : "map" };
  changed(true);
  toast("문을 놓았어요. 오른쪽에서 어디로 갈지 고르세요.", "ok");
}
function removeFocus() {
  const f = E.focus;
  if (!f) return;
  if (f.kind === "spawn") { if (E.locked) return lockedToast(); push(); E.m.spawns.splice(f.i, 1); }
  else if (f.kind === "npc") {
    if (f.src === "builtin") return toast("기본 NPC는 지울 수 없어요.", "bad");
    push();
    if (f.src === "file") E.npcsFile.npcs = E.npcsFile.npcs.filter((n) => n !== f.n); else E.m.npcs = E.m.npcs.filter((n) => n !== f.n);
  } else if (f.kind === "door") {
    if (f.src === "builtin") return toast("기본 문은 지울 수 없어요.", "bad");
    push();
    if (f.src === "links") E.links.links = E.links.links.filter((l) => l !== f.d); else E.m.portals = E.m.portals.filter((d) => d !== f.d);
  } else return;
  E.focus = null;
  changed(true);
}
function setFocus(f) { E.focus = f; renderSide(); draw(); }

// ───────────────────────────── other maps (door targets) ─────────────────────────────
const mapCache = new Map();
export function mapCached(id) {
  if (id === E.id && E.m) return Promise.resolve(serialize());
  if (!mapCache.has(id)) mapCache.set(id, api("/api/map/" + id).catch((e) => { mapCache.delete(id); throw e; }));
  return mapCache.get(id);
}
export function forgetMap(id) { mapCache.delete(id); }
/** A small top-down picture of a map (ground colours + dark objects). */
function miniCanvas(m, scale) {
  const c = document.createElement("canvas");
  c.width = m.w * scale; c.height = m.h * scale;
  const g = c.getContext("2d");
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const o = m.objects[y][x];
    g.fillStyle = o !== " " ? oCol(o) : gCol(m.ground[y][x], m.theme);
    if (o !== " ") g.globalAlpha = 1;
    g.fillRect(x * scale, y * scale, scale, scale);
  }
  return c;
}

// ───────────────────────────── side panels ─────────────────────────────
function field(label, input, tip) { return el("label.f", { title: tip || "" }, el("span", null, label), input); }
function num(value, min, max, on, tip) {
  return el("input", { type: "number", value, min, max, title: tip || "", onchange: (e) => { const v = Math.max(min, Math.min(max, Math.round(+e.target.value || 0))); e.target.value = v; on(v); } });
}
function renderSide() {
  const box = $("#side");
  box.textContent = "";
  if (!E.m) return;
  const L = E.layer;
  $("#side-title").textContent = LAYERS.find((l) => l[0] === L)[1];
  if (E.locked && !LOCKED_LAYERS.has(L)) box.append(el("p.hint", null, "기본 맵이라 이 층은 볼 수만 있어요. 위의 [이 맵 직접 고치기]를 누르면 고칠 수 있어요."));
  if (L === "ground" || L === "objects") return palettePanel(box);
  if (L === "spawns") return spawnPanel(box);
  if (L === "npcs") return npcPanel(box);
  if (L === "portals") return doorPanel(box);
  if (L === "fires") {
    box.append(el("p.hint", null, "맵을 누르면 모닥불이 생기고, 다시 누르면 없어져요. 모닥불에서는 쉬고 요리할 수 있어요."));
    const ul = el("ul.list.sunk.small");
    E.m.fires.forEach((f, i) => ul.append(el("li", { onclick: () => jumpTo(f[0], f[1]) }, el("span", null, `모닥불 ${i + 1}`), el("span.id", null, `${f[0]}, ${f[1]}`))));
    if (!E.m.fires.length) ul.append(el("li.okline", null, "아직 없어요"));
    box.append(ul);
    return;
  }
  if (L === "waypoint") {
    box.append(el("p.hint", null, "이동의 돌은 순간이동 지점이에요. 맵을 눌러 자리를 정하고, 같은 곳을 다시 누르면 없어져요."));
    box.append(el("div.cur", null, E.m.waypoint ? `자리: ${E.m.waypoint[0]}, ${E.m.waypoint[1]}` : "없음"));
    if (E.m.waypoint) box.append(el("button.btn", { onclick: () => jumpTo(...E.m.waypoint) }, "그곳 보기"), " ", el("button.btn.red", { onclick: () => { push(); E.m.waypoint = null; changed(true); } }, "없애기"));
    return;
  }
  if (L === "entry") {
    box.append(el("p.hint", null, "입구는 문이 따로 도착 위치를 정하지 않았을 때 처음 서는 곳이에요. 걸어 다닐 수 있는 칸이어야 해요."));
    box.append(el("div.cur", null, `자리: ${E.m.entry[0]}, ${E.m.entry[1]}`), el("button.btn", { onclick: () => jumpTo(...E.m.entry) }, "그곳 보기"));
    return;
  }
  if (L === "boss") {
    box.append(el("p.hint", null, "필드 보스가 가끔 나타나는 자리예요. 맵을 눌러 자리를 정하세요."));
    if (!E.m.boss) { box.append(el("div.cur", null, "필드 보스 없음")); return; }
    const b = E.m.boss;
    const pick = el("button.btn", { title: "보스로 나올 몬스터를 골라요", onclick: async (e) => { const k = await pickFrom(e.currentTarget, "필드 보스 고르기", mobEntries(true), b.k); if (k) { push(); b.k = k; changed(true); } } }, mobImg(b.k, 32), " ", mobName(b.k));
    box.append(el("div.form", null, field("몬스터", pick), el("div.cur", null, `자리: ${b.x}, ${b.y}`)),
      el("div.row", null, el("button.btn", { onclick: () => jumpTo(b.x, b.y) }, "그곳 보기"), el("button.btn.red", { onclick: () => { push(); E.m.boss = null; changed(true); } }, "보스 없애기")));
  }
}
function palettePanel(box) {
  const L = E.layer, list = L === "ground" ? DB.palette.ground : DB.palette.objects, th = theme();
  const curCh = E.cur[L], cp = (L === "ground" ? DB.pg : DB.po)[curCh];
  box.append(el("div.cur", null, el("span.sw", { style: `width:22px;height:22px;display:inline-block;background:${cp && cp.color ? (L === "ground" ? gCol(curCh) : cp.color) : "#000"}` }), el("span", null, "지금 고른 것: ", el("b", null, cp ? cp.name : curCh)),
    el("label.mini", { title: "붓·지우개 굵기" }, "굵기 ", el("select", { onchange: (e) => { E.size = +e.target.value; draw(); } }, ...[1, 2, 3, 5].map((v) => el("option", { value: v, selected: v === E.size }, v))))));
  // the theme's own pieces first; everything else stays at hand, below, a little dimmer
  const fits = (p) => p.ch === " " || !p.themes || !p.themes.length || p.themes.includes(th);
  const button = (p) => el("button.pal" + (p.ch === curCh ? ".on" : "") + (fits(p) ? "" : ".other"), { type: "button", title: `${p.name} ("${p.ch}")${p.solid ? " · 지나갈 수 없음" : ""}${fits(p) ? "" : " · 다른 테마에서 쓰는 것"}`, onclick: () => { E.cur[L] = p.ch; if (E.tool === "erase" || E.tool === "pick" || E.tool === "select") setTool("brush"); renderSide(); draw(); } },
    el("span.sw", { style: p.color ? `background:${L === "ground" ? gCol(p.ch) : p.color}` : "background:repeating-conic-gradient(#3a3446 0 25%,#2a2434 0 50%) 0 0/8px 8px" }, L === "objects" && p.ch !== " " ? p.ch : p.solid ? "×" : ""), el("span.nm", null, p.name), el("span.ch", null, p.ch === " " ? "␣" : p.ch));
  const mine = el("div.pal-grid", null, ...list.filter(fits).map(button));
  const rest = list.filter((p) => !fits(p));
  box.append(el("div.subhead", null, L === "ground" ? "바닥 팔레트" : "물체 팔레트", el("span.lab", null, `${THEME_KO[th] || th} 테마`)), mine);
  if (rest.length) box.append(el("div.subhead", null, "다른 테마에서 쓰는 것"), el("div.pal-grid", null, ...rest.map(button)));
  if (L === "objects") {
    box.append(el("p.hint", null, "물체가 있는 칸은 지나갈 수 없어요. 집(h)은 4×3칸이 한 번에 놓여요."));
    signPanel(box);
  }
}
/** The words on each signpost (object "G"), kept in the map's `marks`. */
function signPanel(box) {
  const signs = [];
  for (let y = 0; y < E.m.h; y++) for (let x = 0; x < E.m.w; x++) if (E.o[y][x] === "G") signs.push([x, y]);
  box.append(el("div.subhead", null, "표지판 글씨", el("span.lab", null, signs.length ? `${signs.length}개` : "")));
  if (!signs.length) { box.append(el("p.hint", null, "표지판(G)을 놓으면 여기서 글씨를 적을 수 있어요. 화살표(← → ↑ ↓)를 넣으면 그쪽을 가리켜요.")); return; }
  for (const [x, y] of signs) {
    const mk = (E.m.marks || []).find((k) => k.kind === "sign" && k.x === x && k.y === y);
    box.append(el("div.row", null, el("button.btn.tiny", { title: "그곳 보기", onclick: () => jumpTo(x, y) }, `${x},${y}`),
      el("input.grow", { type: "text", value: mk ? mk.label : "", placeholder: "표지판에 쓸 말 (예: ↑ 넥서스 광장)", maxLength: 30, disabled: E.locked,
        onchange: (e) => {
          push();
          const v = e.target.value.trim();
          E.m.marks = (E.m.marks || []).filter((k) => !(k.kind === "sign" && k.x === x && k.y === y));
          if (v) E.m.marks.push(mk && mk.to ? { x, y, kind: "sign", label: v, to: mk.to } : { x, y, kind: "sign", label: v });
          changed();
        } })));
  }
}
function spawnPanel(box) {
  box.append(el("p.hint", null, "빈 곳을 끌면 새 구역, 구역을 끌면 옮기기, 노란 오른쪽 아래 모서리를 끌면 크기 바꾸기."));
  const ul = el("ul.list.sunk");
  E.m.spawns.forEach((sp, i) => ul.append(el("li" + (E.focus && E.focus.kind === "spawn" && E.focus.i === i ? ".on" : ""), { onclick: () => { setFocus({ kind: "spawn", i }); jumpTo(sp.r[0], sp.r[1]); } },
    mobImg(sp.k, 24), el("span", null, `${mobName(sp.k)} ×${sp.n}`), el("span.id", null, `Lv.${(DB.defs.mobs[sp.k] || {}).lv || "?"}`))));
  if (!E.m.spawns.length) ul.append(el("li.okline", null, "아직 몬스터 구역이 없어요"));
  box.append(ul);
  const f = E.focus;
  if (!f || f.kind !== "spawn" || !E.m.spawns[f.i]) return;
  const sp = E.m.spawns[f.i], dis = E.locked;
  const pick = el("button.btn", { disabled: dis, title: "이 구역에 나올 몬스터를 골라요", onclick: async (e) => { const k = await pickFrom(e.currentTarget, "몬스터 고르기", mobEntries(), sp.k); if (k) { push(); sp.k = k; E.lastMob = k; changed(true); } } }, mobImg(sp.k, 32), " ", mobName(sp.k));
  box.append(el("div.subhead", null, `구역 ${f.i + 1}`), el("div.form", null,
    field("몬스터", pick),
    field("마리 수", num(sp.n, 1, 40, (v) => { push(); sp.n = v; changed(true); }), "이 구역에 동시에 있는 몬스터 수"),
    field("정예 %", num(Math.round((sp.elite || 0) * 100), 0, 100, (v) => { push(); sp.elite = v / 100; changed(true); }), "정예(강한 녀석)로 나올 확률"),
    field("등급", el("select", { disabled: dis, title: "모두 같은 등급으로 고정해요 (던전의 수호자처럼)", onchange: (e) => { push(); const v = +e.target.value; if (v) sp.el = v; else delete sp.el; changed(true); } },
      ...[[0, "섞어서 (정예 %대로)"], [1, "모두 정예"], [2, "모두 수호자"]].map(([v, l]) => el("option", { value: v, selected: (sp.el || 0) === v }, l)))),
    field("범위", el("span", null, `${sp.r[0]},${sp.r[1]} ~ ${sp.r[2]},${sp.r[3]} (${sp.r[2] - sp.r[0] + 1}×${sp.r[3] - sp.r[1] + 1})`)),
    el("div.row", null, el("button.btn.red", { disabled: dis, onclick: removeFocus, title: "이 구역을 지워요 (Delete)" }, "구역 지우기"))));
}
function npcPanel(box) {
  box.append(el("p.hint", null, E.locked ? "기본 맵에 놓은 NPC는 npcs.json에 저장돼요. 빈 칸을 눌러 새 NPC를 놓으세요." : "빈 칸을 누르면 새 NPC, NPC를 끌면 옮기기."));
  const ul = el("ul.list.sunk");
  for (const it of npcItems()) ul.append(el("li" + (E.focus && E.focus.n === it.n ? ".on" : ""), { onclick: () => { setFocus({ kind: "npc", n: it.n, src: it.src }); jumpTo(it.n.x, it.n.y); } },
    el("img", { src: npcIcon(it.n) }), el("span", null, it.n.name), it.src === "builtin" ? el("span.tag.base", null, "기본") : null, el("span.id", null, ROLE_KO[it.n.role] || it.n.role)));
  if (!npcItems().length) ul.append(el("li.okline", null, "아직 NPC가 없어요"));
  box.append(ul);
  const f = E.focus;
  if (f && f.kind === "npc") box.append(npcForm(f.n, f.src === "builtin", () => { E.version++; scheduleCheck(); onDirty(); draw(); }, () => removeFocus()));
}
/**
 * The NPC form (name, id, role, look, lines), shared with the NPC·대사 tab.
 * `onChange()` after every edit (the caller saved an undo step before, if it keeps one).
 */
export function npcForm(n, readOnly, onChange, onRemove, opts = {}) {
  const box = el("div.form");
  const upd = (f) => { if (opts.before) opts.before(); f(); onChange(); };
  const face = el("div.npc-thumb");
  const drawFace = () => { face.textContent = ""; const c = npcCanvas(n, 2); c.style.cssText = "width:60px;height:60px"; face.append(c); };
  drawFace();
  const role = el("select", { disabled: readOnly, title: "이 NPC가 하는 일", onchange: (e) => upd(() => { n.role = e.target.value; drawFace(); }) },
    ...DB.defs.roles.map((r) => el("option", { value: r, selected: r === n.role }, `${ROLE_KO[r] || r} (${r})`)));
  box.append(el("div.subhead", null, readOnly ? "기본 NPC (볼 수만 있어요)" : "NPC 고치기"),
    el("div.row", null, face, el("div.form.grow", null,
      field("이름", el("input", { id: opts.nameId || "npc-name", type: "text", value: n.name, disabled: readOnly, maxLength: 24, title: "게임에 보이는 이름", oninput: (e) => upd(() => { n.name = e.target.value; }) })),
      field("역할", role),
      el("button.btn", { disabled: readOnly, title: "동물·얼굴·색을 골라요", onclick: () => lookDialog(n, () => upd(() => drawFace())) }, "모습 고르기"))),
    field("아이디", el("input", { type: "text", value: n.id, disabled: readOnly, title: "영어 소문자·숫자·_ (퀘스트가 이 아이디로 NPC를 찾아요)", onchange: (e) => upd(() => { n.id = e.target.value.trim(); }) })));
  if (opts.where) box.append(opts.where);
  if (n.role === "quest") box.append(el("p.hint", null, "퀘스트 탭에서 이 NPC를 '의뢰인'으로 고르면 퀘스트를 줘요."));
  // lines
  const lines = el("div.lines");
  const drawLines = () => {
    lines.textContent = "";
    n.lines = n.lines || [];
    n.lines.forEach((l, i) => lines.append(el("div.ln", null,
      el("textarea", { value: l, disabled: readOnly, maxLength: 300, title: `대사 ${i + 1}: 말을 걸 때마다 차례로 보여요`, oninput: (e) => upd(() => { n.lines[i] = e.target.value; }) }),
      el("div", { style: "display:flex;flex-direction:column;gap:2px" },
        el("button.btn.tiny", { disabled: readOnly || i === 0, title: "위로", onclick: () => upd(() => { [n.lines[i - 1], n.lines[i]] = [n.lines[i], n.lines[i - 1]]; drawLines(); }) }, "▲"),
        el("button.btn.tiny", { disabled: readOnly || i === n.lines.length - 1, title: "아래로", onclick: () => upd(() => { [n.lines[i + 1], n.lines[i]] = [n.lines[i], n.lines[i + 1]]; drawLines(); }) }, "▼"),
        el("button.btn.tiny.red", { disabled: readOnly, title: "이 대사 지우기", onclick: () => upd(() => { n.lines.splice(i, 1); drawLines(); }) }, "×")))));
    if (!readOnly && n.lines.length < 12) lines.append(el("button.btn", { title: "대사 한 줄 더하기 (12줄까지, {n}은 플레이어 이름)", onclick: () => upd(() => { n.lines.push(""); drawLines(); const t = lines.querySelectorAll("textarea"); if (t.length) t[t.length - 1].focus(); }) }, "+ 대사 추가"));
  };
  drawLines();
  box.append(el("div.subhead", null, "대사"), lines);
  if (!readOnly && onRemove) box.append(el("div.row", null, el("button.btn.red", { onclick: async () => { if (await confirmBox("NPC 지우기", `"${n.name}"을(를) 지울까요?`, "지우기", true)) onRemove(); } }, "NPC 지우기")));
  return box;
}
/** The species look picker (public/looks.js), in a dialog. */
async function lookDialog(n, done) {
  let look = fullLook(n.look) ? SPC.cleanLook(n.look) : SPC.PRESETS[0][1].slice();
  const stage = el("div.npc-thumb", { style: "width:96px;height:96px" });
  const drawStage = () => { stage.textContent = ""; const c = npcCanvas({ look, role: n.role }, 3); c.style.cssText = "width:92px;height:92px"; stage.append(c); };
  const box = el("div", { style: "flex:1;min-width:0" });
  const body = el("div", null, el("div.row", { style: "align-items:flex-start" }, el("div", null, stage, el("button.btn.wide", { onclick: () => api_.random() }, "아무거나")), box));
  const api_ = LK.editor(box, () => look, (l) => { look = l; drawStage(); }, null);
  drawStage();
  const ok = await dialog("NPC 모습 고르기", body, [["이 모습으로", true, "gold"], ["취소", false]], { wide: true });
  if (ok) { n.look = look; done(); }
}
function doorPanel(box) {
  box.append(el("p.hint", null, E.locked ? "기본 맵에 놓은 문은 links.json에 저장돼요." : "빈 칸을 누르면 새 문, 문을 끌면 옮기기. 문 칸에는 물체가 없어야 해요."));
  const ul = el("ul.list.sunk");
  for (const it of doorItems()) ul.append(el("li" + (E.focus && E.focus.d === it.d ? ".on" : ""), { onclick: () => { setFocus({ kind: "door", d: it.d, src: it.src }); jumpTo(it.d.x, it.d.y); } },
    el("span", null, `→ ${mapName(it.d.to)}`), it.src === "builtin" ? el("span.tag.base", null, "기본") : it.src === "links" ? el("span.tag", null, "links") : null, el("span.id", null, `${it.d.x},${it.d.y}`)));
  if (!doorItems().length) ul.append(el("li.okline", null, "아직 문이 없어요"));
  box.append(ul);
  const f = E.focus;
  if (!f || f.kind !== "door") return;
  const d = f.d, ro = f.src === "builtin";
  const sel = el("select", { disabled: ro, title: "이 문으로 가는 맵", onchange: async (e) => { push(); d.to = e.target.value; const t = await mapCached(d.to).catch(() => null); if (t) { d.tx = t.entry[0]; d.ty = t.entry[1]; } if (f.src === "links" && (!d.label || DB.maps.some((m) => m.name === d.label))) d.label = mapName(d.to); changed(true); } },
    ...DB.maps.map((m) => el("option", { value: m.id, selected: m.id === d.to }, `${m.name} (${m.id})`)));
  const mini = el("div", null, el("p.hint", null, "도착 맵을 불러오는 중…"));
  box.append(el("div.subhead", null, ro ? "기본 문 (볼 수만 있어요)" : "문 고치기"), el("div.form", null,
    field("도착 맵", sel),
    field("도착 위치", el("span", null, `${d.tx}, ${d.ty}`), "아래 그림을 눌러 정해요"),
    f.src === "links" ? field("문 이름", el("input", { type: "text", value: d.label || "", title: "문 옆에 보이는 이름", oninput: (e) => { d.label = e.target.value; E.version++; onDirty(); } })) : null),
    mini);
  if (!ro) box.append(el("div.row", null, el("button.btn", { title: "도착 맵을 열어서 돌아오는 문을 만들어요", onclick: () => openMapUI(d.to) }, "도착 맵 열기"), el("button.btn.red", { onclick: removeFocus }, "문 지우기")));
  mapCached(d.to).then((t) => {
    mini.textContent = "";
    const sc = Math.max(1, Math.min(4, Math.floor(280 / Math.max(t.w, t.h))));
    const base = miniCanvas(t, sc), c = document.createElement("canvas");
    c.width = base.width; c.height = base.height; c.className = "minimap";
    const g = c.getContext("2d");
    const redraw = () => { g.drawImage(base, 0, 0); g.fillStyle = "#ffd25a"; g.fillRect(d.tx * sc - 2, d.ty * sc - 2, sc + 4, sc + 4); g.fillStyle = "#e83c46"; g.fillRect(d.tx * sc, d.ty * sc, sc, sc); };
    redraw();
    if (!ro) c.addEventListener("click", (e) => {
      const r = c.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * t.w), y = Math.floor((e.clientY - r.top) / r.height * t.h);
      const ok = t.objects[y] && t.objects[y][x] === " " && !solidG().has(t.ground[y][x]);
      if (!ok) return toast("거기는 막힌 칸이에요. 걸을 수 있는 곳을 누르세요.", "bad");
      push(); d.tx = x; d.ty = y; changed(true);
    });
    mini.append(el("p.hint", null, ro ? "도착 위치(빨간 점)" : "그림을 눌러 도착 위치를 고르세요 (빨간 점)"), c);
  }).catch((e) => { mini.textContent = "도착 맵을 불러오지 못했어요: " + e.message; });
}

// ───────────────────────────── map properties ─────────────────────────────
export function renderProps() {
  const box = $("#map-props");
  box.textContent = "";
  if (!E.m) return;
  const m = E.m, ro = E.locked;
  const on = (f) => { push(); f(); changed(true); onDirty(); };
  const band = m.band || [null, null];
  let nw = m.w, nh = m.h, anchor = 4;
  const anc = el("div.anchor", { title: "늘리거나 줄일 때 맵이 붙어 있을 쪽" }, ...Array.from({ length: 9 }, (_, i) => el("button" + (i === anchor ? ".on" : ""), { type: "button", onclick: (e) => { anchor = i; $$("button", anc).forEach((b, j) => b.classList.toggle("on", j === i)); } })));
  box.append(
    field("아이디", el("input", { type: "text", value: m.id, disabled: true, title: "파일 이름이 돼요 (만든 뒤에는 못 바꿔요)" })),
    field("이름", el("input", { type: "text", value: m.name, disabled: ro, maxLength: 24, title: "게임에 보이는 맵 이름", onchange: (e) => on(() => { m.name = e.target.value; }) })),
    field("테마", el("select", { disabled: ro, title: "땅과 벽의 그림, 팔레트가 바뀌어요", onchange: (e) => on(() => { m.theme = e.target.value; }) }, ...DB.defs.themes.map((t) => el("option", { value: t, selected: t === m.theme }, THEME_KO[t] || t)))),
    field("배경음악", el("select", { disabled: ro, title: "이 맵에서 나오는 음악", onchange: (e) => on(() => { m.bgm = e.target.value; }) }, ...DB.defs.bgm.map((t) => el("option", { value: t, selected: t === m.bgm }, BGM_KO[t] || t)))),
    field("레벨대", el("span", { style: "display:flex;gap:4px;align-items:center" },
      el("input", { type: "number", min: 1, max: 99, value: band[0] ?? "", disabled: ro, placeholder: "-", title: "문에 보이는 추천 레벨 (비우면 없음)", onchange: (e) => on(() => { const a = parseInt(e.target.value, 10); m.band = a ? [a, Math.max(a, (m.band && m.band[1]) || a)] : null; renderProps(); }) }), "~",
      el("input", { type: "number", min: 1, max: 99, value: band[1] ?? "", disabled: ro, placeholder: "-", onchange: (e) => on(() => { const b = parseInt(e.target.value, 10); if (!b) m.band = null; else m.band = [Math.min(b, (m.band && m.band[0]) || b), b]; renderProps(); }) }))),
    el("label.chk", { title: "켜면 몬스터가 안 나오고 다치지 않아요 (마을처럼)" }, el("input", { type: "checkbox", checked: m.safe, disabled: ro, onchange: (e) => on(() => { m.safe = e.target.checked; }) }), "안전지대 (몬스터 없음)"),
    el("label.chk", { title: "물가에서 낚시를 할 수 있어요" }, el("input", { type: "checkbox", checked: m.fishing, disabled: ro, onchange: (e) => on(() => { m.fishing = e.target.checked; }) }), "낚시 허용"),
    el("div.subhead", null, "크기"),
    el("div.row", null, el("input", { type: "number", min: MIN_SIZE, max: MAX_SIZE, value: m.w, disabled: ro, title: "가로 칸 수", onchange: (e) => { nw = +e.target.value; } }), "×",
      el("input", { type: "number", min: MIN_SIZE, max: MAX_SIZE, value: m.h, disabled: ro, title: "세로 칸 수", onchange: (e) => { nh = +e.target.value; } }), anc),
    el("button.btn", { disabled: ro, title: "맵 크기를 바꿔요 (줄이면 잘린 부분은 사라져요)", onclick: () => resize(nw, nh, anchor) }, "크기 바꾸기"));
}
async function resize(nw, nh, anchor) {
  nw = Math.round(nw); nh = Math.round(nh);
  if (!(nw >= MIN_SIZE && nh >= MIN_SIZE && nw <= MAX_SIZE && nh <= MAX_SIZE)) return toast(`크기는 ${MIN_SIZE}~${MAX_SIZE}칸이에요.`, "bad");
  const m = E.m;
  if (nw === m.w && nh === m.h) return;
  if ((nw < m.w || nh < m.h) && !(await confirmBox("크기 줄이기", "맵을 줄이면 잘리는 부분의 바닥·물체·몬스터 구역이 사라져요. 계속할까요?", "줄이기", true))) return;
  push();
  const ax = anchor % 3, ay = Math.floor(anchor / 3);
  const dx = Math.round(((nw - m.w) * ax) / 2), dy = Math.round(((nh - m.h) * ay) / 2);
  const fill = baseGround();
  const g = Array.from({ length: nh }, (_, y) => Array.from({ length: nw }, (_, x) => { const sx = x - dx, sy = y - dy; return sy >= 0 && sx >= 0 && sy < m.h && sx < m.w ? E.g[sy][sx] : fill; }));
  const o = Array.from({ length: nh }, (_, y) => Array.from({ length: nw }, (_, x) => { const sx = x - dx, sy = y - dy; return sy >= 0 && sx >= 0 && sy < m.h && sx < m.w ? E.o[sy][sx] : " "; }));
  const inb = (x, y) => x >= 0 && y >= 0 && x < nw && y < nh;
  const mv = (p) => [p[0] + dx, p[1] + dy];
  m.w = nw; m.h = nh; E.g = g; E.o = o;
  // fix up broken houses at the cut
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) if (o[y][x] === "h") { /* left as is: validate warns via unknown shapes */ }
  m.entry = mv(m.entry); if (!inb(...m.entry)) m.entry = [Math.floor(nw / 2), Math.floor(nh / 2)];
  m.spawns = m.spawns.map((s) => ({ ...s, r: [s.r[0] + dx, s.r[1] + dy, s.r[2] + dx, s.r[3] + dy] })).filter((s) => inb(s.r[0], s.r[1]) && inb(s.r[2], s.r[3]));
  m.npcs = m.npcs.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })).filter((n) => inb(n.x, n.y));
  m.portals = m.portals.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })).filter((p) => inb(p.x, p.y));
  for (const l of E.links.links) if (here(l.map)) { l.x += dx; l.y += dy; }
  E.links.links = E.links.links.filter((l) => !here(l.map) || inb(l.x, l.y));
  if (Array.isArray(m.big)) m.big = m.big.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy }));
  if (Array.isArray(m.marks)) m.marks = m.marks.map((k) => ({ ...k, x: k.x + dx, y: k.y + dy }));
  m.fires = m.fires.map(mv).filter((f) => inb(...f));
  if (m.waypoint) { m.waypoint = mv(m.waypoint); if (!inb(...m.waypoint)) m.waypoint = null; }
  if (m.boss) { m.boss.x += dx; m.boss.y += dy; if (!inb(m.boss.x, m.boss.y)) m.boss = null; }
  E.focus = null; E.sel = null;
  renderProps(); changed(true); fit();
  toast(`크기를 ${nw}×${nh}로 바꿨어요.`, "ok");
}

// ───────────────────────────── validation ─────────────────────────────
let checkT = 0;
function scheduleCheck() { clearTimeout(checkT); checkT = setTimeout(runCheck, 350); }
function runCheck() {
  if (!E.m) return;
  const extra = { [E.id]: { w: E.m.w, h: E.m.h, builtin: E.locked || !!E.m.replaces }, [E.m.id]: { w: E.m.w, h: E.m.h, builtin: E.locked || !!E.m.replaces } };
  const c = checkCtx(extra);
  let P = [];
  if (!E.locked) P = checkMap(serialize(), c, { deep: true });
  const mine = { v: 1, links: E.links.links.filter((l) => here(l.map)) };
  P = P.concat(checkLinks(mine, c).map((p) => ({ ...p, msg: "[links.json] " + p.msg })));
  const mineN = { v: 1, npcs: E.npcsFile.npcs.filter((n) => here(n.map)) };
  P = P.concat(checkNpcs(mineN, c).map((p) => ({ ...p, msg: "[npcs.json] " + p.msg })));
  E.problems = P;
  showProblems(P);
}
export function showProblems(P) {
  const ul = $("#val-list");
  ul.textContent = "";
  const errs = P.filter((p) => p.level !== "warn").length, warns = P.length - errs;
  const b = $("#val-count");
  b.textContent = errs ? `오류 ${errs}` : warns ? `주의 ${warns}` : "좋아요";
  b.className = "badge " + (errs ? "bad" : warns ? "mid" : "ok");
  if (!P.length) ul.append(el("li.okline", null, "문제 없어요!"));
  for (const p of P.sort((a, c) => (a.level === "warn") - (c.level === "warn"))) {
    ul.append(el("li." + (p.level === "warn" ? "warn" : "err"), { title: p.x != null ? "눌러서 그곳으로 가기" : "", onclick: () => { if (p.x != null) jumpTo(p.x, p.y); } }, p.msg, p.x != null ? el("span.id", null, `${p.x},${p.y}`) : null));
  }
}

// ───────────────────────────── preview ─────────────────────────────
let pvReady = false, pvBig = false;
export function previewPayload() {
  const m = serialize(), [cx, cy] = viewCentre();
  const o = m.objects.map((r) => r);
  const put = (x, y, ch) => { if (o[y] && o[y][x] === " ") o[y] = o[y].slice(0, x) + ch + o[y].slice(x + 1); };
  if (m.waypoint) put(m.waypoint[0], m.waypoint[1], "Q");
  // houses (4×3 of "h") and fountains (2×2 of "a") are drawn as one big piece
  const big = bigOf(o, m.big || [], m.theme);
  const npcs = npcItems().map((it) => ({ id: it.n.id, name: it.n.name, role: it.n.role, x: it.n.x, y: it.n.y, look: fullLook(it.n.look) ? [0, 0, 0, "#5e6a88"] : it.n.look }));
  const mobs = [], defs = {};
  for (const sp of m.spawns) {
    const d = DB.defs.mobs[sp.k] || {};
    defs[sp.k] = { sp: d.sp || sp.k, tint: d.tint || null, boss: d.boss };
    let mx = Math.round((sp.r[0] + sp.r[2]) / 2), my = Math.round((sp.r[1] + sp.r[3]) / 2);
    if (!canStand(mx, my)) for (let y = sp.r[1]; y <= sp.r[3]; y++) for (let x = sp.r[0]; x <= sp.r[2]; x++) if (canStand(x, y)) { mx = x; my = y; y = 1e9; break; }
    if (Math.abs(mx - cx) < 24 && Math.abs(my - cy) < 24) mobs.push({ k: sp.k, x: mx, y: my });
  }
  if (m.boss) { const d = DB.defs.mobs[m.boss.k] || {}; defs[m.boss.k] = { sp: d.sp || m.boss.k, tint: d.tint || null, boss: true }; mobs.push({ k: m.boss.k, x: m.boss.x, y: m.boss.y }); }
  return {
    type: "show", x: cx, y: cy, mobs, defs, fires: m.fires,
    map: { id: m.id, name: m.name, w: m.w, h: m.h, g: m.ground, o, big, safe: m.safe, bgm: m.bgm, theme: m.theme, band: m.band,
      marks: (m.marks || []).filter((k) => k.kind === "sign").concat(m.waypoint ? [{ x: m.waypoint[0], y: m.waypoint[1], kind: "waypoint" }] : []),
      portals: doorItems().map((it) => ({ x: it.d.x, y: it.d.y, to: mapName(it.d.to) })), npcs },
  };
}
export function refreshPreview(force) {
  if (!E.m || !pvReady) return;
  if (!force && E.pvVersion === E.version && E.pvAt === viewCentre().join()) return;
  E.pvVersion = E.version; E.pvAt = viewCentre().join();
  try { $("#pv").contentWindow.postMessage(previewPayload(), location.origin); } catch (e) { console.warn(e); }
}

// ───────────────────────────── toolbar ─────────────────────────────
export function setLayer(L) {
  E.layer = L; E.pasting = false;
  $$("#layers .btn").forEach((b) => b.classList.toggle("on", b.dataset.layer === L));
  $("#tools").style.visibility = L === "ground" || L === "objects" ? "visible" : "hidden";
  if (E.focus && !((L === "spawns" && E.focus.kind === "spawn") || (L === "npcs" && E.focus.kind === "npc") || (L === "portals" && E.focus.kind === "door"))) E.focus = null;
  hint(); renderSide(); draw();
}
export function setTool(t) {
  E.tool = t; E.pasting = false;
  $$("#tools .btn[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
  if (t !== "select") E.sel = null;
  draw();
}

// ───────────────────────────── open / new / save ─────────────────────────────
const DRAFT = (id) => "tt-editor-draft:" + id;
export function current() { return E; }
export function load(m, opts = {}) {
  E.id = opts.id || m.replaces || m.id; E.m = m; E.g = rowsToGrid(m.ground); E.o = rowsToGrid(m.objects);
  E.locked = !!opts.locked; E.isNew = !!opts.isNew;
  E.undo = []; E.redo = []; E.focus = null; E.sel = null; E.pasting = false; E.version++;
  E.saved.map = opts.isNew ? "" : mapJson();
  E.cur.ground = DB.pg[baseGround()] ? baseGround() : DB.palette.ground[0].ch;
  $("#banner").hidden = !E.locked;
  if (E.locked) {
    const b = $("#banner");
    b.textContent = "";
    b.append(el("span", null, "기본 맵이에요. NPC와 문은 바로 더할 수 있어요 (npcs.json · links.json). 바닥·물체·몬스터를 고치려면 → "),
      el("button.btn.gold", { title: "이 맵을 대신하는 파일을 만들어 직접 고쳐요 (언제든 삭제로 원래대로)", onclick: makeReplacement }, "이 맵 직접 고치기"),
      el("span", null, " 또는 "), el("button.btn", { onclick: () => duplicate() }, "복제해서 새 맵으로"));
  }
  renderProps(); setLayer(E.locked ? "npcs" : E.layer); fit(); scheduleCheck(); onDirty();
  setTimeout(() => refreshPreview(true), 50);
}
async function makeReplacement() {
  if (!(await confirmBox("기본 맵 직접 고치기", `"${E.m.name}"을(를) 대신하는 맵 파일(data/maps/${E.id}.json)을 만들어요. 그 뒤로는 자동으로 만들어지던 땅 대신 이 파일이 쓰여요. 마음에 안 들면 [삭제]로 언제든 원래대로 돌릴 수 있어요. 계속할까요?`, "직접 고치기"))) return;
  push();
  E.m.replaces = E.id; E.locked = false; E.isNew = true;
  $("#banner").hidden = true;
  renderProps(); changed(true); setLayer("ground");
  toast("이제 이 맵을 고칠 수 있어요. 다 고치면 저장하세요.", "ok");
}
export async function openMap(id, { skipDraft = false } = {}) {
  const m = await api("/api/map/" + id);
  const info = DB.maps.find((x) => x.id === id) || {};
  const [links, npcs] = await Promise.all([api("/api/links"), api("/api/npcs")]);
  E.links = links; E.npcsFile = npcs;
  E.saved.links = linksJson(); E.saved.npcs = npcsJson();
  load(m, { id, locked: info.builtin && !info.custom });
  forgetMap(id);
  if (!skipDraft) offerDraft(id);
  localStorage.setItem("tt-editor-last", id);
}
function offerDraft(id) {
  let d;
  try { d = JSON.parse(localStorage.getItem(DRAFT(id)) || "null"); } catch { d = null; }
  if (!d || !d.m) return;
  if (JSON.stringify(d.m) === mapJson() && JSON.stringify(d.links) === E.saved.links && JSON.stringify(d.npcs) === E.saved.npcs) { localStorage.removeItem(DRAFT(id)); return; }
  confirmBox("저장 안 된 작업", `"${d.m.name}"에 저장하지 않은 작업이 남아 있어요 (${new Date(d.t).toLocaleString("ko-KR")}). 불러올까요?`, "불러오기").then((yes) => {
    if (!yes) { localStorage.removeItem(DRAFT(id)); return; }
    push();
    E.m = d.m; E.g = rowsToGrid(d.m.ground); E.o = rowsToGrid(d.m.objects); E.links = d.links || E.links; E.npcsFile = d.npcs || E.npcsFile;
    if (d.unlocked) { E.locked = false; $("#banner").hidden = true; }
    renderProps(); changed(true);
    toast("저장 안 된 작업을 불러왔어요. 잊지 말고 저장하세요!", "ok");
  });
}
export function saveDraft() {
  if (!E.m || !dirty().any) return;
  try { localStorage.setItem(DRAFT(E.id), JSON.stringify({ t: Date.now(), m: serialize(), links: E.links, npcs: E.npcsFile, unlocked: !E.locked && !!E.m.replaces })); } catch { /* storage full */ }
}
export async function save() {
  if (!E.m) return false;
  const d = dirty();
  if (!d.any) { toast("바뀐 게 없어요."); return true; }
  try {
    const warns = [];
    if (d.map && !E.locked) { const r = await api("/api/map/" + E.id, { method: "PUT", body: serialize() }); warns.push(...(r.warnings || [])); E.saved.map = mapJson(); E.isNew = false; }
    if (d.links) { await api("/api/links", { method: "PUT", body: E.links }); E.saved.links = linksJson(); }
    if (d.npcs) { await api("/api/npcs", { method: "PUT", body: E.npcsFile }); E.saved.npcs = npcsJson(); }
    localStorage.removeItem(DRAFT(E.id));
    await reloadMaps();
    renderMapList();
    onDirty();
    toast(warns.length ? `저장했어요 (주의 ${warns.length}개는 검사 목록을 보세요)` : "저장했어요!", "ok");
    return true;
  } catch (e) {
    if (e.data && e.data.errors) showProblems(e.data.errors.map((p) => ({ ...p, level: "error" })).concat((e.data.warnings || []).map((p) => ({ ...p, level: "warn" }))));
    toast(e.message, "bad");
    return false;
  }
}
/** Ask before throwing away unsaved work. Resolves true when it is fine to go on. */
export async function guard() {
  if (!E.m || !dirty().any) return true;
  const v = await dialog("저장하지 않은 작업", `"${E.m.name}"에 저장하지 않은 변경이 있어요.`, [["저장하고 계속", "save", "gold"], ["저장 안 하고 계속", "drop", "red"], ["취소", null]]);
  if (v === "save") return save();
  if (v === "drop") { localStorage.removeItem(DRAFT(E.id)); return true; }
  return false;
}
function blankMap(id, name, th, w, h) {
  const base = BASE[th] && DB.pg[BASE[th]] ? BASE[th] : DB.palette.ground[0].ch;
  const tree = th === "city" ? "Z" : ["crypt", "sewer", "cave", "abyss"].includes(th) ? "C" : "T";
  const objects = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) && DB.po[tree] ? tree : " ").join(""));
  return { v: 1, id, replaces: null, name, theme: th, bgm: DB.defs.bgm.includes(th) ? th : th === "meadow" ? "field" : DB.defs.bgm[0], safe: th === "town", band: th === "town" ? null : [1, 5], w, h,
    ground: Array.from({ length: h }, () => base.repeat(w)), objects, entry: [Math.floor(w / 2), Math.floor(h / 2)],
    spawns: [], npcs: [], portals: [], fires: [], waypoint: null, fishing: true, boss: null };
}
function suggestId(prefix = "map") { for (let i = 1; ; i++) { const id = `${prefix}${i}`; if (!DB.maps.some((m) => m.id === id)) return id; } }
export async function newMap() {
  if (!(await guard())) return;
  const name = el("input.inp", { type: "text", value: "새 마을", maxLength: 24 });
  const id = el("input.inp", { type: "text", value: suggestId(), maxLength: 24 });
  const th = el("select.inp", null, ...DB.defs.themes.map((t) => el("option", { value: t, selected: t === "meadow" }, THEME_KO[t] || t)));
  const w = el("input.inp", { type: "number", value: 48, min: MIN_SIZE, max: MAX_SIZE }), h = el("input.inp", { type: "number", value: 36, min: MIN_SIZE, max: MAX_SIZE });
  const body = el("div.form", null, field("이름", name, "게임에 보이는 이름"), field("아이디", id, "영어 소문자·숫자·_ (파일 이름)"), field("테마", th), field("크기", el("span", null, w, " × ", h)),
    el("p.hint", null, "아이디는 영어 소문자로 시작하고 소문자·숫자·_ 만 쓸 수 있어요 (예: willow, cave2)."));
  for (;;) {
    const ok = await dialog("새 맵 만들기", body, [["만들기", true, "gold"], ["취소", false]]);
    if (!ok) return;
    const v = { id: id.value.trim(), name: name.value.trim(), w: +w.value, h: +h.value };
    if (!ID_RE.test(v.id)) { toast("아이디는 영어 소문자로 시작하고 소문자·숫자·_ 2~24글자예요.", "bad"); continue; }
    if (DB.maps.some((m) => m.id === v.id)) { toast(`"${v.id}" 아이디는 이미 있어요.`, "bad"); continue; }
    if (!v.name) { toast("이름을 적어 주세요.", "bad"); continue; }
    if (!(v.w >= MIN_SIZE && v.h >= MIN_SIZE && v.w <= MAX_SIZE && v.h <= MAX_SIZE)) { toast(`크기는 ${MIN_SIZE}~${MAX_SIZE}칸이에요.`, "bad"); continue; }
    const [links, npcs] = await Promise.all([api("/api/links"), api("/api/npcs")]);
    E.links = links; E.npcsFile = npcs; E.saved.links = linksJson(); E.saved.npcs = npcsJson();
    load(blankMap(v.id, v.name, th.value, v.w, v.h), { isNew: true });
    setLayer("ground");
    markList(v.id);
    toast("새 맵을 만들었어요. 다 그리면 꼭 저장하세요!", "ok");
    return;
  }
}
export async function duplicate() {
  if (!E.m) return toast("복제할 맵을 먼저 고르세요.");
  if (!(await guard())) return;
  const nid = await ask("복제해서 편집", "새 맵의 아이디 (영어 소문자·숫자·_):", suggestId(E.id.replace(/\d+$/, "").slice(0, 20)), "원래 맵은 그대로 두고, 같은 모습의 새 맵을 만들어요.");
  if (nid == null) return;
  if (!ID_RE.test(nid)) return toast("아이디는 영어 소문자로 시작하고 소문자·숫자·_ 2~24글자예요.", "bad");
  if (DB.maps.some((m) => m.id === nid)) return toast(`"${nid}" 아이디는 이미 있어요.`, "bad");
  const m = JSON.parse(JSON.stringify(serialize()));
  m.id = nid; m.replaces = null; m.name = (m.name + " 사본").slice(0, 24);
  m.npcs = m.npcs.map((n) => ({ ...n, id: `${nid}_${n.id}`.slice(0, 32), lines: n.lines || [] }));
  load(m, { isNew: true });
  setLayer("ground");
  markList(nid);
  toast(`"${m.name}"을(를) 만들었어요. 저장하면 파일이 생겨요.`, "ok");
}
export async function removeMap() {
  const info = DB.maps.find((m) => m.id === E.id);
  if (E.m && E.isNew && !info) {
    if (!(await confirmBox("맵 버리기", `아직 저장하지 않은 "${E.m.name}"을(를) 버릴까요?`, "버리기", true))) return;
    localStorage.removeItem(DRAFT(E.id));
    E.m = null; E.id = null;
    renderMapList(); renderProps(); renderSide(); draw(); onDirty();
    return;
  }
  if (!E.m || !info) return toast("지울 맵을 고르세요.");
  if (!info.custom) return toast("기본 맵은 지울 수 없어요.", "bad");
  const msg = info.builtin ? `"${info.name}"을(를) 원래 자동으로 만들어지던 기본 맵으로 되돌릴까요? 직접 고친 내용은 사라져요 (백업은 data/.backup에 남아요).` : `"${info.name}" 맵을 지울까요? 이 맵으로 가는 문은 검사에서 오류가 나요 (백업은 data/.backup에 남아요).`;
  if (!(await confirmBox(info.builtin ? "기본 맵으로 되돌리기" : "맵 지우기", msg, info.builtin ? "되돌리기" : "지우기", true))) return;
  try {
    await api("/api/map/" + E.id, { method: "DELETE" });
    localStorage.removeItem(DRAFT(E.id));
    toast(info.builtin ? "기본 맵으로 되돌렸어요." : "지웠어요.", "ok");
    await reloadMaps();
    const id = info.builtin ? E.id : null;
    E.m = null; E.id = null;
    renderMapList(); renderProps(); renderSide(); draw(); onDirty();
    if (id) openMap(id, { skipDraft: true });
  } catch (e) { toast(e.message, "bad"); }
}
export function renderMapList() {
  const ul = $("#map-list");
  ul.textContent = "";
  const list = DB.maps.slice();
  if (E.m && E.isNew && !list.some((m) => m.id === E.id)) list.push({ id: E.id, name: E.m.name + " (저장 안 됨)", builtin: false, custom: true });
  for (const m of list) {
    const tag = m.builtin ? (m.custom ? el("span.tag.rep", { title: "직접 고친 기본 맵" }, "고침") : el("span.tag.base", { title: "자동으로 만들어지는 기본 맵" }, "기본")) : el("span.tag.own", { title: "직접 만든 맵" }, "새 맵");
    ul.append(el("li" + (m.id === E.id ? ".on" : ""), { title: `${m.name} (${m.id}) ${m.w}×${m.h}`, onclick: async () => { if (m.id === E.id) return; if (!(await guard())) return; try { await openMap(m.id); renderMapList(); } catch (e) { toast(e.message, "bad"); } } },
      tag, el("span", null, m.name), el("span.id", null, m.id)));
  }
}
function markList(id) { renderMapList(); const li = $$("#map-list li").find((l) => l.textContent.includes(id)); if (li) li.scrollIntoView({ block: "nearest" }); }
let openMapUI = async (id) => { if (!(await guard())) return; await openMap(id); renderMapList(); };

export async function playtest() {
  if (!E.m) return toast("테스트할 맵을 먼저 고르세요.");
  if (dirty().any) {
    if (!(await confirmBox("게임에서 테스트", "테스트하려면 먼저 저장해야 해요. 저장할까요?", "저장하고 테스트"))) return;
    if (!(await save())) return;
  }
  const at = E.hover && inside(...E.hover) && canStand(...E.hover) ? E.hover : E.m.entry;
  const win = window.open("about:blank", "_blank");
  if (win) win.document.write("<body style='background:#120f18;color:#f3e8cc;font:16px sans-serif;padding:40px'>게임을 준비하고 있어요… (처음에는 30초쯤 걸려요)</body>");
  toast("게임을 준비하고 있어요…");
  try {
    const r = await api("/api/playtest", { method: "POST", body: { map: E.id, x: at[0], y: at[1] } });
    if (win) win.location.href = r.url; else window.open(r.url, "_blank");
    toast(r.started ? "게임 서버를 켰어요. 새 탭을 보세요!" : "새 탭에서 게임이 열려요.", "ok");
  } catch (e) {
    if (win) win.close();
    toast(e.message, "bad");
  }
}

// ───────────────────────────── boot ─────────────────────────────
export function init(opts) {
  onDirty = opts.onDirty || onDirty;
  if (opts.openMapUI) openMapUI = opts.openMapUI;
  globalThis.__E = E;   // for automation (Playwright drives the editor through it)
  cv = $("#map-canvas"); ctx = cv.getContext("2d"); wrap = $("#canvas-wrap");
  const lay = $("#layers");
  for (const [id, name, tip, key] of LAYERS) lay.append(el("button.btn", { type: "button", "data-layer": id, title: `${tip} (${key})`, onclick: () => setLayer(id) }, name));
  const tb = $("#tools");
  for (const [id, name, tip] of TOOLS) tb.append(el("button.btn", { type: "button", "data-tool": id, title: tip, onclick: () => setTool(id) }, name));
  tb.append(el("span.sep"),
    el("button.btn", { type: "button", title: "선택한 영역 복사 (Ctrl+C)", onclick: copySel }, "복사"),
    el("button.btn", { type: "button", title: "복사한 것을 붙여넣기 (Ctrl+V)", onclick: pasteMode }, "붙여넣기"),
    el("button.btn", { type: "button", title: "복사한 것을 90° 돌리기 (T)", onclick: rotateClip }, "회전"));
  setTool("brush");
  cv.addEventListener("pointerdown", (e) => { if (e.shiftKey && E.tool === "rect") E.shiftRect = true; onDown(e); if (E.drag && E.drag.rect) E.drag.shift = e.shiftKey; });
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerup", onUp);
  cv.addEventListener("pointercancel", onUp);
  cv.addEventListener("pointerleave", () => { E.hover = null; $("#st-xy").textContent = "-"; draw(); });
  cv.addEventListener("wheel", onWheel, { passive: false });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  new ResizeObserver(() => draw()).observe(wrap);
  $("#undo").onclick = undo; $("#redo").onclick = redo;
  $("#zoom-in").onclick = () => setZoom(E.zoom + 1); $("#zoom-out").onclick = () => setZoom(E.zoom - 1);
  $("#grid-btn").onclick = () => { E.grid = !E.grid; $("#grid-btn").classList.toggle("on", E.grid); draw(); };
  $("#grid-btn").classList.toggle("on", E.grid);
  $("#fit-btn").onclick = fit;
  $("#save-btn").onclick = save;
  $("#play-btn").onclick = playtest;
  $("#map-new").onclick = newMap;
  $("#map-dup").onclick = duplicate;
  $("#map-del").onclick = removeMap;
  $("#pv-refresh").onclick = () => refreshPreview(true);
  $("#pv-big").onclick = () => { pvBig = !pvBig; $("#pv-panel").classList.toggle("big", pvBig); $("#pv-big").textContent = pvBig ? "작게" : "크게"; setTimeout(() => refreshPreview(true), 60); };
  addEventListener("message", (e) => { if (e.origin === location.origin && e.data && e.data.type === "preview-ready") { pvReady = true; refreshPreview(true); } });
  // the preview page may have said "ready" before this listener existed: ask it again
  const pv = $("#pv"), ping = () => { try { pv.contentWindow.postMessage({ type: "ping" }, location.origin); } catch { /* not loaded */ } };
  pv.addEventListener("load", ping);
  ping();
  setInterval(() => { if ($("#pv-auto").checked && !$("#tab-map").hidden) refreshPreview(false); }, 3000);
  setInterval(saveDraft, 5000);
  addEventListener("keyup", (e) => { if (e.code === "Space") { space = false; if (cv) cv.style.cursor = "crosshair"; } });
}
/** Keys while the map tab is open. Returns true when handled. */
export function key(e) {
  const t = e.target;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === "s") { if (t && t.blur) t.blur(); save(); return true; }   // also while typing in a field (blur commits it)
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return false;
  if (ctrl && k === "z" && !e.shiftKey) { undo(); return true; }
  if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) { redo(); return true; }
  if (ctrl && k === "c") { copySel(); return true; }
  if (ctrl && k === "v") { pasteMode(); return true; }
  if (ctrl) return false;
  if (e.code === "Space") { space = true; cv.style.cursor = "grab"; return true; }
  if (k === "escape") { E.pasting = false; E.sel = null; E.drag = null; hint(); draw(); return true; }
  if (k === "delete" || k === "backspace") { deleteSel(); return true; }
  if (k === "g") { $("#grid-btn").click(); return true; }
  if (k === "f") { fit(); return true; }
  if (k === "t") { rotateClip(); return true; }
  if (k === "+" || k === "=") { setZoom(E.zoom + 1); return true; }
  if (k === "-") { setZoom(E.zoom - 1); return true; }
  const L = LAYERS.find((l) => l[3] === e.key);
  if (L) { setLayer(L[0]); return true; }
  const T = TOOLS.find((x) => x[3] === k);
  if (T && ["ground", "objects"].includes(E.layer)) { setTool(T[0]); return true; }
  const arrows = { arrowleft: [1, 0], arrowright: [-1, 0], arrowup: [0, 1], arrowdown: [0, -1] }[k];
  if (arrows) { E.ox += arrows[0] * ts() * 4; E.oy += arrows[1] * ts() * 4; draw(); return true; }
  return false;
}
