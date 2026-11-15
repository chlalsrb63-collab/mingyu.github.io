/**
 * The radar (the minimap at the top of the side column) and the map window (#w-map, M).
 *
 * The radar is centred on me: my tile always sits at the exact centre and only a radius around me
 * is drawn (ZOOMS, ± on its bar, remembered), the ground scrolling with every step. It samples one
 * cached texture per map (Art.renderMini, a texel per tile, its colours) through the world's own
 * 2:1 quarter-view turn — tile (x, y) → screen ((x − y)·u, (x + y)·u/2) — so screen-up on the radar
 * is screen-up in the world, and only the window of texels around me is blitted each frame.
 * Over the ground: big outlined glyphs (uiicons.js) for gates, house doors, waypoint stones (woken
 * or not), service NPCs by role, campfires, the rift obelisk, wind shrines and a field boss; small
 * dots for monsters and passers-by; party members as numbered discs (pinned to the rim with an
 * arrow toward them when out of range); me as a gold-and-white arrow along my aim, with a pulse.
 *
 * The map window has a regional map (fit to the window; wheel or ± to zoom, drag
 * to pan; party members live with names, gates with where they lead, stones clickable to warp
 * when the warp rules allow) and the world route map, every region from defs.maps joined by its
 * doors (defs.maps[].to), plus a resident directory from the server's NPC schedules.
 *
 * The client lends what it owns through init(): G, act, openWin/toggleWin/isOpen, wpWoke, npcOut,
 * miniDots (차원 균열 marks), canWarp, channel info.
 */
import * as Art from "./art.js";
import * as NPC from "./npclife.js";
import { icon } from "./uiicons.js";
import { spent as nodeSpent } from "./gather.js";
import { mapChart, buildingDoors, shortestRoute, questMaps, nextGate, chartBase, paintChart, mapDetail, unlockState } from "./worldmap.js";

const T = 16;
const INK = "#120e18";
const $ = (s) => document.querySelector(s);
/** Radar zoom levels, closest first, as the % the bar shows (100 % = 28 tiles from me to the rim, the old default) and
 *  the tiles to the rim at that %. The default is 150 % (owner, 2026-11-15: a closer minimap by default). */
const ZOOM_PCT = [200, 150, 120, 100, 75, 50];
export const ZOOMS = ZOOM_PCT.map((p) => Math.round(2800 / p));
const ZKEY = "lumentale:radar-zoom2";   // (new key: the old one held an index into the old 5-step list)
let zi = (() => {
  try { const v = localStorage.getItem(ZKEY); const n = v === null ? NaN : Number(v); return Number.isInteger(n) && n >= 0 && n < ZOOMS.length ? n : 1; } catch { return 1; }
})();

let D = null;   // what the client lends (init)
let M = null;   // the current map, cached: { m, tex, stones, portals, shrines, obelisk }
/** Draw timing of the radar (ms), for the report and for tuning: the last and a running average. */
export const perf = { last: 0, avg: 0, n: 0 };

// ───────────────────────────── glyphs ─────────────────────────────

/** NPC role → glyph and colour (the radar and the map window). */
const ROLE = {
  shop: ["coin", "#ffd84a", "상점"], smith: ["anvil", "#cfd6e2", "대장간"], train: ["sword", "#ff9a7a", "수련관"], bank: ["bag", "#e0b070", "창고"],
  warp: ["stone", "#8ad8ff", "이동술사"], elder: ["excl", "#ffe060", "의뢰"], quest: ["excl", "#ffe060", "의뢰"], daily: ["cal", "#b0e070", "일일 의뢰"],
  achieve: ["trophy", "#f0c050", "업적"], collector: ["paw", "#e8b888", "도감"], costume: ["shirt", "#ff9ad0", "의상실"], dim: ["rift", "#c890ff", "균열 지기"],
  talk: ["talk", "#e8e0c8", "주민"],
};
const roleOf = (n) => ROLE[n.role] || ROLE.talk;
const PARTY_COL = ["#4ad0ff", "#3fe08c", "#8ac4ff", "#9af0c8"];
/** Roofs on the radar and the map window, a shade under the buildings' own (iso_tall.js BSTYLE). */
const ROOF = { hall: "#4e7a40", library: "#4a5a86", dojo: "#8e4a2a", store: "#a8643a", smithy: "#444c5c", merc: "#4a3a30", lab: "#3e8474", diner: "#a83c34", cafe: "#348686", inn: "#3456a0", boutique: "#c06a8c", pet: "#5a9040", apt: "#7a5034", home: "#b85444", barn: "#6a3a2e" };
/** Gathering nodes by kind (약초 · 광맥 · 통나무 · 작물), gatherart.js KIND_COL. */
const NODE_COL = ["#8fd060", "#d07a3a", "#c8a070", "#a8784a"];
const COL = { gate: "#d890ff", door: "#e0a868", stone: "#8ad8ff", stoneOff: "#7a7468", fire: "#ff9a3a", obelisk: "#c890ff", wind: "#5ae4a0", boss: "#ff4a4a", me: "#ffd84a", resident: "#f0c7ef", track: "#ffbfe6" };

const sprites = {};
/** A 12×12 glyph in `col` with a one-pixel dark outline all round (14×14). */
function spr(name, col) {
  const key = name + col;
  if (sprites[key]) return sprites[key];
  const src = icon(name, col), c = document.createElement("canvas");
  c.width = c.height = 14;
  const g = c.getContext("2d"), a = src.getContext("2d").getImageData(0, 0, 12, 12).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12 && a[(y * 12 + x) * 4 + 3] > 0;
  g.fillStyle = INK;
  for (let y = -1; y < 13; y++) for (let x = -1; x < 13; x++) {
    if (on(x, y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (on(x + dx, y + dy)) { near = true; break; }
    if (near) g.fillRect(x + 1, y + 1, 1, 1);
  }
  g.drawImage(src, 1, 1);
  return (sprites[key] = c);
}

const inPoly = (px, py, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** A polygon rasterised at pixel centres (no smoothing), filled, an optional inner polygon lit, outlined in ink. */
function rasterSprite(n, pts, col, inner, hi) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d"), mask = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inPoly(x + 0.5, y + 0.5, pts)) mask[y * n + x] = 1;
  const at = (x, y) => x >= 0 && y >= 0 && x < n && y < n && mask[y * n + x];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (mask[y * n + x]) { g.fillStyle = inner && inPoly(x + 0.5, y + 0.5, inner) ? hi : col; g.fillRect(x, y, 1, 1); continue; }
    if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)) { g.fillStyle = INK; g.fillRect(x, y, 1, 1); }
  }
  return c;
}
const turn = (cx, cy, a, pts) => pts.map(([f, s]) => [cx + f * Math.cos(a) - s * Math.sin(a), cy + f * Math.sin(a) + s * Math.cos(a)]);
/** My arrow along screen angle `a` (cached in 64 steps), scale 1 or 2. */
function meArrow(a, big = 1) {
  const k = ((Math.round((a / (2 * Math.PI)) * 64) % 64) + 64) % 64, key = "me" + k + "_" + big;
  if (sprites[key]) return sprites[key];
  const n = 23 * big, c = n / 2, q = (k / 64) * 2 * Math.PI, s = big;
  const body = turn(c, c, q, [[9.5 * s, 0], [-7 * s, -7 * s], [-2.5 * s, 0], [-7 * s, 7 * s]]);
  const lit = turn(c, c, q, [[7.5 * s, 0], [-4 * s, -3 * s], [-1.5 * s, 0], [-4 * s, 3 * s]]);
  return (sprites[key] = rasterSprite(n, body, COL.me, lit, "#fffbe8"));
}
/** A small arrow for a party member or a boss pinned to the radar's rim, pointing toward them. */
function rimArrow(a, col) {
  const k = ((Math.round((a / (2 * Math.PI)) * 32) % 32) + 32) % 32, key = "rim" + k + col;
  if (sprites[key]) return sprites[key];
  const q = (k / 32) * 2 * Math.PI;
  return (sprites[key] = rasterSprite(13, turn(6.5, 6.5, q, [[5.5, 0], [-3.5, -4.5], [-1.5, 0], [-3.5, 4.5]]), col));
}
const DIGIT = { 1: ["010", "110", "010", "010", "111"], 2: ["110", "001", "010", "100", "111"], 3: ["110", "001", "010", "001", "110"], 4: ["101", "101", "111", "001", "001"] };
/** A party member: a disc in their colour with their party number. */
function disc(col, num) {
  const key = "disc" + col + num;
  if (sprites[key]) return sprites[key];
  const n = 13, c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d");
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2);
    if (d <= 5.2) { g.fillStyle = d > 4.3 ? "#ffffff" : col; g.fillRect(x, y, 1, 1); }
    else if (d <= 6.4) { g.fillStyle = INK; g.fillRect(x, y, 1, 1); }
  }
  const rows = DIGIT[num];
  if (rows) { g.fillStyle = INK; rows.forEach((r, y) => { for (let x = 0; x < 3; x++) if (r[x] === "1") g.fillRect(5 + x, 4 + y, 1, 1); }); }
  return (sprites[key] = c);
}
/** A one-pixel ring flattened 2:1 like the ground (my pulse). */
function ring(g, cx, cy, r, col) {
  g.fillStyle = col;
  const n = Math.max(12, Math.ceil(2 * Math.PI * r));
  let lx = NaN, ly = NaN;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI, x = Math.round(cx + r * Math.cos(a)), y = Math.round(cy + (r / 2) * Math.sin(a));
    if (x !== lx || y !== ly) g.fillRect(x, y, 1, 1);
    lx = x; ly = y;
  }
}
const blit = (g, c, x, y) => g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
/** A dot with a dark rim (monsters, passers-by, the rift's own marks). */
function dotAt(g, x, y, col, r) {
  x = Math.round(x - r / 2); y = Math.round(y - r / 2);
  g.fillStyle = INK; g.fillRect(x - 1, y - 1, r + 2, r + 2);
  g.fillStyle = col; g.fillRect(x, y, r, r);
}
/** Text with a dark outline (the map window's labels). */
function label(g, text, x, y, col, size = 11) {
  g.font = `${size}px Galmuri11, Galmuri9, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = INK;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) g.fillText(text, x + dx, y + dy);
  g.fillStyle = col; g.fillText(text, x, y);
  return g.measureText(text).width;
}
/** The aim step's direction on the screen (the ground turned like the world). */
function aimScreen(G) {
  const n = (G.defs && G.defs.aim && G.defs.aim[0]) || 64, a = ((G.me.aimI || 0) / n) * 2 * Math.PI;
  const gx = Math.cos(a), gy = Math.sin(a);
  return Math.atan2((gx + gy) / 2, gx - gy);
}

// ───────────────────────────── the map ─────────────────────────────

/** A new map: its radar texture and the marks that never move. */
export function loadMap(m) {
  const tex = Art.renderMini(m, 1);
  const stones = [];
  for (const k of m.marks || []) if (k.kind === "waypoint") stones.push({ x: k.x, y: k.y, i: stones.length });
  // a gate is two tiles wide: one mark per door
  const portals = [], labelled = D?.G.defs.maps?.find(d => d.id === m.id)?.doors || [];
  for (const p of m.portals || []) {
    const q = portals.find((o) => o.to === p.to && Math.abs(o.x0 - p.x) <= 2 && Math.abs(o.y0 - p.y) <= 2);
    const target = labelled.find(([x, y]) => x === p.x && y === p.y)?.[2];
    if (q) { q.sx += p.x; q.sy += p.y; q.n++; q.tiles.push([p.x, p.y]); if (target) q.mapIds.push(target); }
    else portals.push({ x0: p.x, y0: p.y, sx: p.x, sy: p.y, n: 1, to: p.to, door: !!p.door, mapIds: target ? [target] : [], tiles: [[p.x, p.y]] });
  }
  for (const p of portals) { p.x = p.sx / p.n; p.y = p.sy / p.n; }
  const shrines = [];
  for (let y = 0; y < m.h; y++) { const row = m.o[y]; for (let x = 0; x < m.w; x++) if (row[x] === "/") shrines.push([x, y]); }
  const ob = (m.big || []).find((b) => b.t === "obelisk");
  const buildings = buildingDoors(m, D?.G.defs.maps || []);
  const byTile = new Map(buildings.flatMap(b => b.tiles.map(([x, y]) => [`${x},${y}`, b])));
  // the town's buildings: roofs in a muted roof colour, the sign's glyph at the door (town.md G)
  const blds = [];
  const tg = tex.getContext("2d");
  for (const b of m.big || []) {
    if (b.t !== "bld" && b.t !== "house") continue;
    const w = b.w || 4, h = b.h || 3;
    tg.fillStyle = b.t === "bld" ? ROOF[b.k] || "#8a5a4a" : b.v >= 4 ? "#3a3e4a" : "#9a5a4a";
    tg.fillRect(b.x, b.y, w, h);
    tg.fillStyle = "rgba(255,255,255,.18)"; tg.fillRect(b.x, b.y, w, 1);
    if (b.t !== "bld") continue;
    const at = b.door === "e" ? [b.x + w, b.y + b.dx + 0.5] : b.door === "s" ? [b.x + b.dx + 0.5, b.y + h] : [b.x + w / 2 - 0.5, b.y + h];
    blds.push({ x: at[0], y: at[1], icon: b.icon, name: b.name });
  }
  for (const p of portals) {
    p.building = byTile.get(`${p.x0},${p.y0}`);
    const b = blds.find(q => Math.abs(q.x - p.x) < 1.6 && Math.abs(q.y - p.y) < 1.6);
    p.bld = !!b;
    if (b && p.building) b.building = p.building;
  }
  M = { m, tex, stones, portals, shrines, blds, buildings, obelisk: ob ? [ob.x, ob.y] : null };
  if (D) updateBuildings(true);
  view.reset = true;
  view.dirty = true;
}

function walkToBuilding(building) {
  if (!D.walkToDoor(building.tiles)) {
    D.toast("지금은 건물 입구까지 갈 수 없습니다");
    return;
  }
  D.closeMap();
  D.toast(`${building.name} 입구로 이동합니다`);
  D.play("ui");
}

/** 월드맵 → 걸어서 이동: the quest tracker's auto-walk to a whole map (track.js); a locked or unreachable region only says so. */
function walkToMap(id) {
  const G = D.G, chart = currentChart(), d = chart.nodes.get(id)?.d;
  if (!d) return;
  const lvl = G.self?.lvl || 1;
  if (id === G.map?.id) { D.toast("지금 이 지역에 있습니다"); return; }
  if (unlockState(d, G.self) !== 4) { D.toast(`아직 열리지 않은 지역입니다 · ${d.name}`); return; }
  if (d.minLv && lvl < d.minLv) { D.toast(`Lv.${d.minLv}부터 갈 수 있습니다 · ${d.name}`); return; }
  if (!shortestRoute(chart.graph, G.map?.id, id, (m) => lvl >= (chart.nodes.get(m).d.minLv || 1)).length) {
    D.toast(`${d.name}(으)로 가는 길을 찾지 못했습니다`);
    return;
  }
  D.closeMap();
  D.track(id, d.name);
  D.play("ui");
}

function updateBuildings(rebuild = false) {
  const buildings = M?.buildings || [], panel = $("#map-buildings");
  panel.hidden = view.tab !== "here" || !buildings.length;
  $("#w-map").classList.toggle("map-has-buildings", !panel.hidden);
  if (!rebuild) return;
  $("#map-building-list").replaceChildren(...buildings.map(building => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn small";
    button.textContent = building.name;
    button.title = `${building.name} 입구까지 길찾기`;
    button.addEventListener("click", () => walkToBuilding(building));
    return button;
  }));
}

/** Stone `i` of the current map: its name (defs.waypoints) and whether the sheet has woken it. */
function stoneInfo(st) {
  const G = D.G, id = G.map.id, w = (G.defs.waypoints || []).find((o) => o.id === id);
  const name = w ? ((w.n || 1) > 1 ? `${w.name} · ${(w.names && w.names[st.i]) || st.i + 1}` : w.name) : "이동의 돌";
  return { name, open: D.wpWoke(G.self, id, st.i) };
}

// ───────────────────────────── the radar ─────────────────────────────

let xyText = "", infoText = "";
/** Draw the radar: every frame, my tile at the centre. */
export function draw(t) {
  if (!M || !D || !D.G.map) return;
  const resident = residentTarget();
  if (resident) refreshResidents();
  const cv = $("#mini-cv"), box = cv.parentElement;
  // in the phone drawer the radar is only drawn while the drawer is out
  if (document.body.dataset.lay !== "full" && !document.body.classList.contains("drawer")) return;
  const W = box.clientWidth | 0, H = box.clientHeight | 0;
  if (W < 8 || H < 8) return;
  const t0 = performance.now();
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext("2d"), G = D.G, me = G.me, m = M.m;
  // (a small map — the town, a house — never shrinks below a quarter of its own span: it stays big)
  const R = Math.min(ZOOMS[zi], Math.max(12, Math.round((m.w + m.h) / 4))), u = Math.min(W / (2 * Math.SQRT2 * R), H / (Math.SQRT2 * R));
  const mx = me.x / T, my = me.y / T;
  const ox = Math.round(W / 2 - u * (mx - my)), oy = Math.round(H / 2 - (u / 2) * (mx + my));
  const P = (wx, wy) => { const tx = wx / T, ty = wy / T; return [ox + u * (tx - ty), oy + (u / 2) * (tx + ty)]; };
  const Pt = (tx, ty) => P(tx * T + 8, ty * T + 8);
  const inView = (x, y, pad = 8) => x > -pad && y > -pad && x < W + pad && y < H + pad;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#07060c";
  g.fillRect(0, 0, W, H);
  // only the texels the radar can see: the screen's corners back on the ground
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [sx, sy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const a = (sx - ox) / u, b = (2 * (sy - oy)) / u, tx = (a + b) / 2, ty = (b - a) / 2;
    x0 = Math.min(x0, tx); x1 = Math.max(x1, tx); y0 = Math.min(y0, ty); y1 = Math.max(y1, ty);
  }
  x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1);
  x1 = Math.min(m.w, Math.ceil(x1) + 1); y1 = Math.min(m.h, Math.ceil(y1) + 1);
  if (x1 > x0 && y1 > y0) {
    g.setTransform(u, u / 2, -u, u / 2, ox, oy);
    g.drawImage(M.tex, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  // monsters and fires the server lets me see
  const mobs = G.defs.mobs || {};
  // gathering nodes, in their kind's colour (dim once spent here)
  if (!hide.has("gather")) (m.nodes || []).forEach((n, i) => { const [x, y] = Pt(n[2], n[3]); if (inView(x, y)) dotAt(g, x, y, nodeSpent(i) ? "#5a5650" : NODE_COL[n[0]] || NODE_COL[0], 2); });
  if (!hide.has("mob")) for (const mob of G.mobs.values()) {
    const [x, y] = P(mob.x, mob.y);
    if (!inView(x, y)) continue;
    const d = mobs[mob.k] || {};
    if (d.boss) blit(g, spr("skull", COL.boss), x, y);
    else if (d.chest) dotAt(g, x, y, "#ffe08a", 3);
    else dotAt(g, x, y, mob.el ? "#ffbe3c" : "#ff5050", mob.el ? 3 : 2);
  }
  for (const f of G.fires.values()) { const [x, y] = P(f.x, f.y); if (inView(x, y)) blit(g, spr("fire", "#ffb050"), x, y); }
  // the marks that never move
  for (const c of m.camps || []) { const [x, y] = P(c.x, c.y); if (inView(x, y)) blit(g, spr("fire", COL.fire), x, y); }
  for (const [sx, sy] of M.shrines) { const [x, y] = Pt(sx, sy); if (inView(x, y)) blit(g, spr("wind", COL.wind), x, y - 2); }
  for (const n of m.npcs || []) {
    if (n.thing || (NPC.cast(n.id) ? !servicePost(n) : !D.npcOut(n)) || (n.role === "dim" && M.obelisk)) continue;
    if (hide.has(questNpc(n) ? "quest" : "npc")) continue;
    const [x, y] = Pt(n.x, n.y);
    if (!inView(x, y)) continue;
    const [gl, col] = roleOf(n);
    if (n.role === "talk") dotAt(g, x, y, "#ffe08a", 3); else blit(g, spr(gl, col), x, y - 3);
  }
  if (!hide.has("npc")) for (const n of NPC.list()) {
    if (n.onPost && n.post && servicePost(n.post)) continue;
    const [x, y] = P(n.x, n.y);
    if (inView(x, y)) dotAt(g, x, y, COL.resident, 3);
  }
  if (M.obelisk) { const [x, y] = Pt(...M.obelisk); if (inView(x, y)) blit(g, spr("rift", COL.obelisk), x, y - 3); }
  for (const st of M.stones) {
    const [x, y] = Pt(st.x, st.y);
    if (inView(x, y)) blit(g, spr("stone", D.wpWoke(G.self, m.id, st.i) ? COL.stone : COL.stoneOff), x, y - 3);
  }
  for (const p of M.portals) { if (p.bld) continue; const [x, y] = Pt(p.x, p.y); if (inView(x, y)) blit(g, spr(p.door ? "door" : "gate", p.door ? COL.door : COL.gate), x, y - 3); }
  for (const b of M.blds) { const [x, y] = Pt(b.x, b.y); if (inView(x, y)) blit(g, spr(b.icon, "#f0d8a8"), x, y - 3); }
  // inside a rift: its own marks (dimrift.js speaks in dots)
  D.miniDots((wx, wy, col, r = 2) => { const [x, y] = P(wx, wy); if (inView(x, y)) dotAt(g, x, y, col, Math.max(3, r)); }, t);
  // passers-by (the party is drawn below, bigger)
  const party = partyHere();
  for (const [eid, p] of G.players) {
    if (party.some((q) => q.eid === eid)) continue;
    const [x, y] = P(p.x, p.y);
    if (inView(x, y)) dotAt(g, x, y, "#dce6f2", 3);
  }
  // a field boss: wherever it stands, pinned to the rim when out of range
  // (the rim keeps clear of the sky's clock in the top-left corner)
  const sky = $("#sky"), top = sky && !sky.hidden ? Math.min(H / 2 - 4, sky.offsetTop + sky.offsetHeight + 6) : 9;
  const pin = (x, y, col, what) => {
    const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
    const k = Math.max(dx > 0 ? dx / (W - 9 - cx) : -dx / (cx - 9), dy > 0 ? dy / (H - 9 - cy) : -dy / (cy - top));
    if (k <= 1) { blit(g, what, x, y); return; }
    const px = cx + dx / k, py = cy + dy / k, ang = Math.atan2(dy, dx);
    blit(g, rimArrow(ang, col), px + Math.cos(ang) * 2, py + Math.sin(ang) * 2);
    blit(g, what, px - Math.cos(ang) * 8, py - Math.sin(ang) * 8);
  };
  if (G.fb && !hide.has("mob")) for (const [bx, by] of G.fb) { const [x, y] = P(bx, by); if (Math.floor(t / 350) % 3) pin(x, y, COL.boss, spr("skull", COL.boss)); }
  if (!hide.has("party")) for (const q of party) { const [x, y] = P(q.x, q.y); pin(x, y, q.col, disc(q.col, q.n)); }
  const tracked = !hide.has("quest") && residentPoint(resident);
  if (tracked) {
    const [x, y] = P(tracked.x, tracked.y);
    if (Math.floor(t / 280) % 3) pin(x, y, COL.track, spr("talk", COL.track));
  } else if (world.selected) {
    const chart = currentChart(), route = guidePath(chart);
    if (route.length > 1) {
      const gate = nextGate(M.portals, chart.nodes.get(route[1]).d, mx, my);
      if (gate) { const [x, y] = Pt(gate.x, gate.y); pin(x, y, "#ffe56b", rimArrow(Math.atan2(y - H / 2, x - W / 2), "#ffe56b")); }
    }
  }
  // me: a pulse on the ground, then the arrow along my aim
  const [cx, cy] = P(me.x, me.y), ph = (t % 1400) / 1400;
  ring(g, cx, cy + 1, 5 + ph * 14, `rgba(255,244,200,${(0.85 * (1 - ph)).toFixed(2)})`);
  blit(g, meArrow(aimScreen(G)), cx, cy);
  // the bar under the radar: where I stand, and the head count
  const xy = `X ${Math.floor(me.x / T)} · Y ${Math.floor(me.y / T)}`;
  if (xy !== xyText) { xyText = xy; $("#mini-xy").textContent = xy; }
  const info = D.info();
  if (info !== infoText) { infoText = info; $("#mini-info").textContent = info; }
  const ms = performance.now() - t0;
  perf.last = ms; perf.n++; perf.avg += (ms - perf.avg) / Math.min(perf.n, 120);
}

/** Party members on this map but me: { eid, n (party number), col, name, x, y } — live positions when the server shows them. */
function partyHere() {
  const G = D.G, out = [];
  (G.party || []).forEach((r, i) => {
    const [eid, name, , , , , where] = r;
    if (eid === G.you || where || r[7] === undefined) return;
    const p = G.players.get(eid);
    out.push({ eid, n: i + 1, col: PARTY_COL[i % PARTY_COL.length], name, x: p ? p.x : r[7], y: p ? p.y : r[8] });
  });
  return out;
}

/** The radar's mark filters: [key, chip name, swatch]. Me, doors, stones, fires and buildings always show. */
const FILTERS = [["npc", "NPC", "#f0d8a8"], ["quest", "의뢰", "#ffe060"], ["gather", "채집", "#8fd060"], ["party", "파티", "#4ad0ff"], ["mob", "몬스터", "#ff5050"]];
const HKEY = "lumentale:radar-hide";
const hide = new Set((() => { try { const v = JSON.parse(localStorage.getItem(HKEY) || "[]"); return Array.isArray(v) ? v.filter((k) => FILTERS.some((f) => f[0] === k)) : []; } catch { return []; } })());
function setHide() {
  try { localStorage.setItem(HKEY, JSON.stringify([...hide])); } catch { /* private mode */ }
  for (const b of document.querySelectorAll("#mini-fl button")) {
    const off = hide.has(b.dataset.f);
    b.classList.toggle("off", off);
    b.setAttribute("aria-pressed", String(!off));
    b.title = `${b.textContent} ${off ? "숨김 — 눌러서 보이기" : "보임 — 눌러서 숨기기"}`;
  }
  $("#mini-fb").title = hide.size ? `미니맵에 보일 것 고르기 (${hide.size}개 숨김)` : "미니맵에 보일 것 고르기";
  $("#mini-fb").classList.toggle("some", hide.size > 0);
}
/** Quest givers' marks (의뢰 · 일일 의뢰 · the side-quest givers) are the 의뢰 filter's; every other NPC the NPC filter's. */
const questNpc = (n) => n.role === "elder" || n.role === "quest" || n.role === "daily" || !!D.G.defs.side?.some((q) => q.giver === n.id);
function setZoom(i) {
  zi = Math.max(0, Math.min(ZOOMS.length - 1, i));
  try { localStorage.setItem(ZKEY, String(zi)); } catch { /* private mode */ }
  $("#mini-zi").disabled = zi === 0;
  $("#mini-zo").disabled = zi === ZOOMS.length - 1;
  $("#mini-cv").title = `지도 열기 (M) · 반경 ${ZOOMS[zi]}칸`;
  $("#mini-pct").textContent = `${ZOOM_PCT[zi]}%`;
}

// ───────────────────────────── the map window ─────────────────────────────

const view = { tab: "here", z: 1, cx: 0, cy: 0, reset: true, dirty: true, at: 0, hits: [], hover: null, drag: null, u: 1, ox: 0, oy: 0 };
const bandOf = (b) => (b ? `Lv.${b[0]}–${b[1]}` : "안전 지대");
const residentsPanel = { filter: "all", rows: null, display: "", map: null, route: null };
const servicePost = (n) => n.role && n.role !== "talk" && n.role !== "quest";

function residentTarget() {
  const picked = NPC.tracked();
  if (picked) return picked;
  const { defs, self } = D.G;
  const main = self?.q, quest = main && defs.quests?.[main.i];
  const elder = defs.questTurnIn?.npc;
  if (quest && main.st === 1 && main.n >= quest.n && NPC.cast(elder)) return elder;
  for (const [id, stage] of self?.sq || []) {
    const q = defs.side?.find((s) => s.id === id);
    const npc = stage === 3 ? q?.giver : stage === 2 && q?.goal.type === "talk" ? q.goal.npc : null;
    if (npc && NPC.cast(npc)) return npc;
  }
  return null;
}

function refreshResidents() {
  if (!NPC.needsWhere()) return;
  NPC.markWhereAsked();
  D.act({ t: "nw" });
}

/** The door group of this map (its `tiles`) on the shortest level-allowed route toward map `target`, or null (track.js). */
export function gateToward(target) {
  if (!M || !D || !D.G.map || M.m.id !== D.G.map.id) return null;
  const chart = currentChart(), level = D.G.self?.lvl || 1, me = D.G.me;
  const route = shortestRoute(chart.graph, M.m.id, target, (id) => level >= (chart.nodes.get(id).d.minLv || 1));
  const next = route.length > 1 && chart.nodes.get(route[1])?.d;
  return next ? nextGate(M.portals, next, me.x / T, me.y / T) : null;
}

function residentPoint(id) {
  if (!id) return null;
  const body = NPC.at(id);
  if (body) return body;
  const target = NPC.locations().find((n) => n.id === id)?.map;
  const me = D.G.me, here = M.m.id, level = D.G.self?.lvl || 1;
  if (!target || target === here) return null;
  const chart = currentChart(), key = `${here}:${target}:${level}`;
  if (residentsPanel.route?.key !== key || residentsPanel.route.chart !== chart) {
    const route = shortestRoute(chart.graph, here, target, (id) => level >= (chart.nodes.get(id).d.minLv || 1));
    residentsPanel.route = { key, chart, next: chart.nodes.get(route[1])?.d };
  }
  const next = residentsPanel.route.next;
  if (!next) return null;
  const gate = nextGate(M.portals, next, me.x / T, me.y / T);
  return gate ? { x: gate.x * T + 8, y: gate.y * T + 8, gate: true } : null;
}

function drawResidents() {
  refreshResidents();
  const rows = NPC.locations(), picked = NPC.tracked(), mode = residentsPanel.filter, here = M?.m.id;
  const display = `${mode}:${picked || ""}`;
  if (rows === residentsPanel.rows && display === residentsPanel.display && here === residentsPanel.map) return;
  Object.assign(residentsPanel, { rows, display, map: here });
  const box = $("#map-resident-list"), oldScroll = box.scrollTop;
  box.replaceChildren();
  const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
  if (!rows.length) { box.append(el("p", "주민 위치를 불러오는 중…")); return; }
  const { defs } = D.G, isQuest = new Set((defs.side || []).map((q) => q.giver));
  if (defs.questTurnIn?.npc) isQuest.add(defs.questTurnIn.npc);
  const groups = new Map();
  for (const n of rows) {
    if (mode === "service" && !servicePost(n)) continue;
    if (mode === "quest" && n.role !== "quest" && !isQuest.has(n.id)) continue;
    if (mode === "resident" && servicePost(n)) continue;
    if (!groups.has(n.map)) groups.set(n.map, []);
    groups.get(n.map).push(n);
  }
  const names = new Map((defs.maps || []).map((d) => [d.id, d.name]));
  for (const [map, residents] of [...groups].sort(([a], [b]) => Number(b === here) - Number(a === here))) {
    box.append(el("h4", names.get(map) || "이동 중"));
    for (const n of residents) {
      const row = el("div", "");
      row.className = "res-row";
      const text = el("div", ""), act = NPC.actName(n.act);
      const next = n.nextPlace && n.nextPlace !== n.place ? ` · 다음 ${n.nextPlace}` : "";
      text.append(el("b", n.name), el("small", [n.place && n.place !== names.get(map) ? n.place : null, act].filter(Boolean).join(" · ") + next));
      const go = el("button", picked === n.id ? "추적 해제" : "추적");
      go.className = `btn small${picked === n.id ? " gold" : ""}`;
      go.setAttribute("aria-label", `${n.name} ${go.textContent}`);
      go.setAttribute("aria-pressed", String(picked === n.id));
      go.addEventListener("click", () => {
        NPC.track(NPC.tracked() === n.id ? null : n.id);
        drawResidents();
        box.querySelector(`button[data-npc="${CSS.escape(n.id)}"]`)?.focus({ preventScroll: true });
        D.play("ui");
      });
      go.dataset.npc = n.id;
      row.append(text, go);
      box.append(row);
    }
  }
  if (!groups.size) box.append(el("p", "이 분류에 표시할 주민이 없습니다."));
  box.scrollTop = oldScroll;
}

/** The map window, drawn while it is open (15 times a second: the blink, the party). */
export function drawWin(t) {
  if (!M || !D || !D.isOpen("map")) return;
  if (view.tab === "residents") { drawResidents(); return; }
  if (!view.dirty && t - view.at < 66) return;
  view.at = t; view.dirty = false;
  const cv = $("#map-cv"), box = cv.parentElement;
  const W = box.clientWidth | 0, H = box.clientHeight | 0;
  if (W < 8 || H < 8) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#07060c";
  g.fillRect(0, 0, W, H);
  view.hits = [];
  if (view.tab === "here") drawHere(g, W, H, t); else drawWorld(g, W, H, t);
  showHover();
}

function drawHere(g, W, H, t) {
  const G = D.G, m = M.m, S = m.w + m.h;
  const fit = Math.min((W - 24) / S, (2 * (H - 24)) / S);
  const u = fit * view.z;
  if (view.reset) { view.cx = m.w / 2; view.cy = m.h / 2; view.reset = false; }
  const ox = Math.round(W / 2 - u * (view.cx - view.cy)), oy = Math.round(H / 2 - (u / 2) * (view.cx + view.cy));
  Object.assign(view, { u, ox, oy });
  const P = (wx, wy) => { const tx = wx / T, ty = wy / T; return [ox + u * (tx - ty), oy + (u / 2) * (tx + ty)]; };
  const Pt = (tx, ty) => P(tx * T + 8, ty * T + 8);
  g.setTransform(u, u / 2, -u, u / 2, ox, oy);
  g.drawImage(M.tex, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // labels wait until every mark is down, then go in order of importance (0 first), never on each other
  const labels = [];
  const tag = (text, x, y, col, size = 11, pri = 5) => labels.push({ text, x, y, col, size, pri, i: labels.length });
  const hit = (x, y, r, tip, click) => view.hits.push({ x, y, r, tip, click });
  const names = u >= 4.5;
  // gates first: where each leads
  // the town's buildings: the sign's glyph at the door and the name (their doors need no mark of their own)
  for (const b of M.blds) {
    const [x, y] = Pt(b.x, b.y);
    blit(g, spr(b.icon, "#f0d8a8"), x, y - 3);
    tag(b.name, x, y - 15, "#f0d8a8", 10, 2);
    hit(x, y, 9, b.building ? `${b.name} · 입구까지 길찾기` : b.name, b.building && (() => walkToBuilding(b.building)));
  }
  for (const p of M.portals) {
    if (p.bld) continue;
    const [x, y] = Pt(p.x, p.y);
    blit(g, spr(p.door ? "door" : "gate", p.door ? COL.door : COL.gate), x, y - 3);
    tag(p.to, x, y - 15, p.door ? "#f0c890" : "#f0c8ff", 11, 2);
    hit(x, y, 9, p.building ? `${p.building.name} · 입구까지 길찾기` : `${p.door ? "문" : "관문"} → ${p.to}`,
      p.building && (() => walkToBuilding(p.building)));
  }
  // waypoint stones: clickable to warp when woken and the rules allow
  const can = D.canWarp(), here = M.stones.findIndex((st) => Math.hypot(G.me.x - (st.x * T + 8), G.me.y - (st.y * T + 8)) < 40);
  for (const st of M.stones) {
    const [x, y] = Pt(st.x, st.y), { name, open } = stoneInfo(st), cur = here === st.i;
    blit(g, spr("stone", open ? COL.stone : COL.stoneOff), x, y - 3);
    tag(open ? name : `${name} · 미개방`, x, y + 12, open ? "#bfeaff" : "#a8a090", 10, 3);
    const ok = open && can && !cur;
    hit(x, y, 9, cur ? `${name} — 지금 여기` : !open ? `${name} — 미개방 (돌에 다가가면 깨어납니다)` : ok ? `${name} — 클릭하면 이동합니다` : `${name} — 이동의 돌 곁에서만 이동할 수 있습니다`,
      ok ? () => { D.act(st.i ? { t: "warp", to: G.map.id, i: st.i } : { t: "warp", to: G.map.id }); D.play("ui"); } : null);
  }
  for (const c of m.camps || []) { const [x, y] = P(c.x, c.y); blit(g, spr("fire", COL.fire), x, y); hit(x, y, 8, "모닥불 — 앉아서(Z) 쉬면 온기를 얻습니다"); }
  for (const f of G.fires.values()) { const [x, y] = P(f.x, f.y); blit(g, spr("fire", "#ffb050"), x, y); }
  for (const [sx, sy] of M.shrines) { const [x, y] = Pt(sx, sy); blit(g, spr("wind", COL.wind), x, y - 2); hit(x, y, 8, "질주의 바람 — 바람 신단"); }
  if (M.obelisk) { const [x, y] = Pt(...M.obelisk); blit(g, spr("rift", COL.obelisk), x, y - 3); tag("차원의 오벨리스크", x, y - 15, "#e0c8ff", 10, 4); hit(x, y, 9, "차원의 오벨리스크 — 균열 지기에게 말을 걸어 차원 균열을 엽니다"); }
  for (const n of m.npcs || []) {
    if (n.thing || (NPC.cast(n.id) ? !servicePost(n) : !D.npcOut(n))) continue;
    const [x, y] = Pt(n.x, n.y), [gl, col, what] = roleOf(n);
    blit(g, spr(gl, col), x, y - 3);
    if (names && n.role !== "talk") tag(n.name, x, y + 11, "#f4ecd0", 10);
    hit(x, y, 8, `${n.name} · ${what}${NPC.cast(n.id) && !NPC.at(n.id)?.onPost ? " · 업무 자리" : ""}`);
  }
  const track = residentTarget();
  for (const n of NPC.list()) {
    const pinned = n.id === track;
    if (!pinned && n.onPost && n.post && servicePost(n.post)) continue;
    const [x, y] = P(n.x, n.y);
    dotAt(g, x, y, pinned ? COL.track : COL.resident, pinned ? 5 : 3);
    if (pinned || names) tag(n.name, x, y - 13, COL.track, 10, pinned ? 1 : 5);
    hit(x, y, 7, `${n.name} · ${NPC.actName(n.act)}`, () => { NPC.track(NPC.tracked() === n.id ? null : n.id); D.play("ui"); });
  }
  const guidance = residentPoint(track);
  if (guidance?.gate) {
    const [x, y] = P(guidance.x, guidance.y);
    blit(g, spr("talk", COL.track), x, y);
    tag(`${NPC.cast(track).name}에게 가는 문`, x, y - 16, COL.track, 10, 1);
  }
  for (const mob of G.mobs.values()) {
    const d = (G.defs.mobs || {})[mob.k] || {}, [x, y] = P(mob.x, mob.y);
    if (d.boss) blit(g, spr("skull", COL.boss), x, y); else dotAt(g, x, y, mob.el ? "#ffbe3c" : "#ff5050", mob.el ? 3 : 2);
  }
  if (G.fb) for (const [bx, by] of G.fb) { const [x, y] = P(bx, by); blit(g, spr("skull", COL.boss), x, y); tag("우두머리", x, y - 13, "#ff9a8a", 10, 1); hit(x, y, 9, "사냥터 우두머리"); }
  D.miniDots((wx, wy, col, r = 2) => { const [x, y] = P(wx, wy); dotAt(g, x, y, col, Math.max(3, r)); }, t);
  // the party, live, with names
  for (const q of partyHere()) {
    const [x, y] = P(q.x, q.y);
    blit(g, disc(q.col, q.n), x, y);
    tag(q.name, x, y - 13, q.col, 11, 1);
    hit(x, y, 8, `파티원 ${q.n} · ${q.name} (X ${Math.floor(q.x / T)}, Y ${Math.floor(q.y / T)})`);
  }
  // me, blinking, big
  const [cx, cy] = P(G.me.x, G.me.y), ph = (t % 1000) / 1000;
  ring(g, cx, cy + 1, 7 + ph * 18, `rgba(255,244,200,${(0.9 * (1 - ph)).toFixed(2)})`);
  if (Math.floor(t / 400) % 2 === 0) blit(g, meArrow(aimScreen(G), 2), cx, cy);
  else blit(g, meArrow(aimScreen(G)), cx, cy);
  tag("나", cx, cy - 26, "#fff2a0", 11, 0);
  const placed = [[cx - 13, cy - 16, cx + 13, cy + 14]];   // nothing written over my marker
  labels.sort((a, b) => a.pri - b.pri || a.i - b.i);
  for (const l of labels) {
    g.font = `${l.size}px Galmuri11, Galmuri9, sans-serif`;
    const w = g.measureText(l.text).width + 4, h = l.size + 3, r = [l.x - w / 2, l.y - h / 2, l.x + w / 2, l.y + h / 2];
    if (l.pri > 0 && placed.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) continue;
    placed.push(r);
    label(g, l.text, l.x, l.y, l.col, l.size);
  }
}

// ── the world chart ──
const world = { defs: null, chart: null, base: null, selected: null, z: 1, x: 0, y: 0, frame: null, detailKey: null, routeKey: null, route: [] };

function currentChart() {
  const defs = D.G.defs;
  if (world.defs !== defs) {
    world.defs = defs;
    world.chart = mapChart(defs.maps || []);
    world.base = null;
    world.routeKey = null;
    world.detailKey = null;
    const picker = $("#map-region");
    picker.length = 1;
    for (const { d } of world.chart.outdoor) picker.add(new Option(d.name, d.id));
    if (world.chart.anchors.get(world.selected) !== world.selected) world.selected = null;
    picker.value = world.selected || "";
  }
  return world.chart;
}
function guidePath(chart) {
  const G = D.G, level = G.self?.lvl || 1, start = G.map?.id;
  const key = JSON.stringify([start, world.selected, level]);
  if (key !== world.routeKey) {
    world.routeKey = key;
    world.route = shortestRoute(chart.graph, start, world.selected, id => level >= (chart.nodes.get(id).d.minLv || 1));
  }
  return world.route;
}
function selectWorld(id, focus = false) {
  const chart = currentChart(), n = chart.anchors.get(id) === id && chart.nodes.get(id);
  world.selected = n ? id : null;
  $("#w-map").classList.toggle("map-has-detail", !!n);
  if (focus && n) world.focus = id;
  $("#map-region").value = world.selected || "";
  view.dirty = true;
  D.play("ui");
}
function clampWorld(chart, W, H, scale) {
  const x = Math.max(0, (chart.width * scale - W) / 2), y = Math.max(0, (chart.height * scale - H) / 2);
  world.x = Math.max(-x, Math.min(x, world.x));
  world.y = Math.max(-y, Math.min(y, world.y));
}
function worldZoom(f, x, y) {
  if (!world.frame) return;
  const { centerX, centerY, fit } = world.frame;
  const z = Math.max(0.65, Math.min(4.5, world.z * f));
  const k = z / world.z;
  world.x = (world.x - x + centerX) * k + x - centerX;
  world.y = (world.y - y + centerY) * k + y - centerY;
  world.z = z;
  clampWorld(world.chart, centerX * 2, centerY * 2, fit * z);
  view.dirty = true;
}
function drawWorld(g, W, H, t) {
  const G = D.G, chart = currentChart();
  world.base ||= chartBase(chart, (width, height) => Object.assign(document.createElement("canvas"), { width, height }));
  // Phones begin in a readable crop. The fit button can show the entire chart.
  const fit = Math.min(W / chart.width, H / chart.height);
  if (!world.frame && W < 480) world.z = Math.min(3.5, Math.max(1, 0.68 / fit));
  world.z = world.focus ? Math.max(world.z, 1.25, Math.min(3.5, 0.72 / fit)) : world.z;
  const scale = fit * world.z;
  const current = chart.anchors.get(G.map?.id);
  if (world.focus || (!world.frame && W < 480)) {
    const n = chart.nodes.get(world.focus || current);
    world.focus = null;
    if (n) { world.x = (chart.width / 2 - n.x) * scale; world.y = (chart.height / 2 - n.y) * scale; }
  }
  clampWorld(chart, W, H, scale);
  world.frame = { centerX: W / 2, centerY: H / 2, fit };
  const camp = { scale, ox: (W - chart.width * scale) / 2 + world.x, oy: (H - chart.height * scale) / 2 + world.y };
  const party = new Map();
  (G.party || []).forEach((r, i) => {
    const id = chart.anchors.get(r[9]);
    if (r[0] === G.you || !id) return;
    if (!party.has(id)) party.set(id, []);
    party.get(id).push({ n: i + 1, col: PARTY_COL[i % PARTY_COL.length], name: r[1] });
  });
  const state = { t, selected: world.selected, current, route: guidePath(chart), seen: new Set(G.self?.seen),
    quests: questMaps(G.defs, G.self, chart.nodes, id => chart.anchors.get(id)), party, self: G.self, woke: D.wpWoke };
  view.hits = paintChart(g, chart, world.base, camp, state).map(h => ({ ...h, click: () => selectWorld(h.id) }));
  if (view.hover) view.hover = view.hits.find(h => h.id === view.hover.id) || null;
  const detail = $("#map-detail"), d = chart.nodes.get(world.selected)?.d;
  detail.hidden = !d;
  if (!d) { world.detailKey = null; return; }
  const canWarp = !!D.canWarp(), key = JSON.stringify([d.id, state.current, state.route, state.quests.get(d.id), G.self?.wp?.[d.id], G.self?.lvl, canWarp, state.seen.has(d.id), unlockState(d, G.self)]);
  if (key === world.detailKey) return;
  world.detailKey = key;
  mapDetail(detail, d, { defs: G.defs, chart, state, canWarp, select: selectWorld, walk: walkToMap, travel: (to, i) => {
    D.act({ t: "warp", to, i }); D.play("ui");
  } });
}

function showHover() {
  const h = view.hover, el = $("#map-info");
  const txt = h ? h.tip : view.tab === "here" ? `${D.G.map.name}${D.G.map.band ? " · " + bandOf(D.G.map.band) : ""} · 휠/±로 확대, 끌어서 이동 · 깨운 돌을 누르면 순간이동` : "지도 조각을 누르거나 지역을 골라 경로를 확인하세요";
  if (el.textContent !== txt) el.textContent = txt;
  $("#map-cv").style.cursor = h && h.click ? "pointer" : view.drag ? "grabbing" : "grab";
}
function hitAt(x, y) {
  let best = null, bd = Infinity;
  for (const h of view.hits) {
    if (h.rect) { const [rx, ry, rw, rh] = h.rect; if (x >= rx && y >= ry && x <= rx + rw && y <= ry + rh) return h; continue; }
    const d = Math.hypot(x - h.x, y - h.y);
    if (d <= h.r && d < bd) { bd = d; best = h; }
  }
  return best;
}
/** Zoom the current-region view by `f` about the canvas point (x, y). */
function zoomAt(f, x, y) {
  if (view.tab === "world") { worldZoom(f, x, y); return; }
  const z = Math.max(1, Math.min(8, view.z * f));
  if (z === view.z) return;
  const { u, ox, oy } = view;
  const a = (x - ox) / u, b = (2 * (y - oy)) / u, tx = (a + b) / 2, ty = (b - a) / 2;   // the tile under the pointer
  const k = view.z / z;
  view.cx = tx + (view.cx - tx) * k; view.cy = ty + (view.cy - ty) * k;
  view.z = z;
  if (z === 1) view.reset = true;
  clampView();
  view.dirty = true;
}
function clampView() { const m = M && M.m; if (!m) return; view.cx = Math.max(0, Math.min(m.w, view.cx)); view.cy = Math.max(0, Math.min(m.h, view.cy)); }
function setTab(tab) {
  view.tab = tab; view.hover = null; view.dirty = true;
  for (const b of document.querySelectorAll("#map-tabs button[data-tab]")) {
    b.classList.toggle("on", b.dataset.tab === tab);
    b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
  }
  $("#w-map").classList.toggle("world-chart", tab === "world");
  $("#w-map").classList.toggle("map-has-detail", tab === "world" && !!world.selected);
  $("#map-region-bar").hidden = tab !== "world";
  if (tab === "world") $("#map-world-name").textContent = D.G.defs?.worldName || "";
  $("#map-detail").hidden = tab !== "world" || !world.selected;
  $("#map-zoom").hidden = $("#map-box").hidden = $("#map-info").hidden = $("#map-legend").hidden = tab === "residents";
  $("#map-residents").hidden = tab !== "residents";
  updateBuildings();
  if (tab === "residents") drawResidents();
  if (tab === "world") currentChart();
  legend();
}
/** The legend under the map: what each mark means (per tab). */
function legend() {
  const box = $("#map-legend");
  box.textContent = "";
  const chip = (c, text) => { const s = document.createElement("span"); const im = document.createElement("img"); im.src = c.toDataURL(); im.alt = ""; s.append(im, text); box.append(s); };
  const sw = (col) => { const c = document.createElement("canvas"); c.width = c.height = 10; const g = c.getContext("2d"); g.fillStyle = INK; g.fillRect(0, 0, 10, 10); g.fillStyle = col; g.fillRect(2, 2, 6, 6); return c; };
  if (view.tab === "here") {
    chip(rimArrow(0, COL.me), "나"); chip(disc(PARTY_COL[1], 2), "파티원"); chip(spr("gate", COL.gate), "관문"); chip(spr("door", COL.door), "건물 문");
    chip(spr("stone", COL.stone), "이동의 돌"); chip(spr("stone", COL.stoneOff), "미개방"); chip(spr("coin", ROLE.shop[1]), "상점"); chip(spr("anvil", ROLE.smith[1]), "대장간");
    chip(spr("sword", ROLE.train[1]), "수련관"); chip(spr("bag", ROLE.bank[1]), "창고"); chip(spr("excl", ROLE.elder[1]), "의뢰"); chip(spr("fire", COL.fire), "모닥불");
    chip(spr("rift", COL.obelisk), "오벨리스크"); chip(spr("wind", COL.wind), "바람 신단"); chip(spr("skull", COL.boss), "우두머리"); chip(sw("#ff5050"), "몬스터");
  } else {
    chip(sw("#ffd84a"), "현재 위치"); chip(disc(PARTY_COL[0], 1), "파티원");
    chip(spr("excl", ROLE.elder[1]), "의뢰"); chip(sw("#1b6258"), "안내 경로");
  }
}

/** The window was opened: start where I stand. */
export function opened() {
  const residents = !!D?.G?.defs?.npclife?.cast?.length;
  $("#map-residents-tab").hidden = !residents;
  if (!residents && view.tab === "residents") setTab("here");
  if (view.z > 1 && M) { view.cx = D.G.me.x / T; view.cy = D.G.me.y / T; clampView(); }
  view.dirty = true;
  legend();
}

// ───────────────────────────── wiring ─────────────────────────────

export function init(deps) {
  D = deps;
  setZoom(zi);
  $("#mini-zi").addEventListener("click", (e) => { e.stopPropagation(); setZoom(zi - 1); D.play("ui"); });
  $("#mini-zo").addEventListener("click", (e) => { e.stopPropagation(); setZoom(zi + 1); D.play("ui"); });
  $("#mini-map").addEventListener("click", () => D.toggleWin("map"));
  $("#mini-cv").addEventListener("click", () => D.toggleWin("map"));
  // 표시: a row of chips under the bar, one per kind of mark (FF/LA minimap filters), remembered
  const fl = $("#mini-fl");
  for (const [k, name, col] of FILTERS) {
    const b = document.createElement("button"), sw = document.createElement("i");
    b.type = "button"; b.dataset.f = k; sw.style.background = col;
    b.append(sw, name);
    b.addEventListener("click", (e) => { e.stopPropagation(); if (hide.has(k)) hide.delete(k); else hide.add(k); setHide(); D.play("ui"); });
    fl.append(b);
  }
  $("#mini-fb").addEventListener("click", (e) => { e.stopPropagation(); fl.hidden = !fl.hidden; $("#mini-fb").classList.toggle("on", !fl.hidden); D.play("ui"); });
  setHide();
  for (const b of document.querySelectorAll("#map-tabs button[data-tab]")) b.addEventListener("click", () => { setTab(b.dataset.tab); D.play("ui"); });
  for (const b of document.querySelectorAll(".res-filters button")) b.addEventListener("click", () => {
    residentsPanel.filter = b.dataset.filter;
    for (const chip of b.parentElement.children) {
      chip.classList.toggle("gold", chip === b);
      chip.setAttribute("aria-pressed", String(chip === b));
    }
    drawResidents();
  });
  const cv = $("#map-cv");
  const local = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height]; };
  $("#map-zi").addEventListener("click", () => { zoomAt(1.5, cv.width / 2, cv.height / 2); });
  $("#map-zo").addEventListener("click", () => { zoomAt(1 / 1.5, cv.width / 2, cv.height / 2); });
  $("#map-region").addEventListener("change", e => selectWorld(e.target.value, true));
  $("#map-fit").addEventListener("click", () => {
    if (view.tab === "world") { world.z = Math.min(1, 1 / (world.frame?.fit || 1)); world.x = world.y = 0; }
    else { view.z = 1; view.reset = true; }
    view.dirty = true;
  });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, x, y); }, { passive: false });
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const [x, y] = local(e);
    view.drag = { x, y, cx: view.cx, cy: view.cy, wx: world.x, wy: world.y, moved: false, id: e.pointerId };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = local(e), d = view.drag;
    if (d) {
      const dx = x - d.x, dy = y - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
      if (d.moved) {
        if (view.tab === "world") {
          world.x = d.wx + dx; world.y = d.wy + dy;
        } else {
          const a = dx / view.u, b = (2 * dy) / view.u;
          view.cx = d.cx - (a + b) / 2; view.cy = d.cy - (b - a) / 2;
          clampView();
        }
        view.dirty = true;
        return;
      }
    }
    const h = hitAt(x, y);
    if (h !== view.hover) { view.hover = h; showHover(); }
  });
  const end = (e) => {
    const d = view.drag;
    view.drag = null;
    if (!d || d.moved || e.type === "pointercancel") return;
    const [x, y] = local(e), h = hitAt(x, y);
    if (h && h.click) h.click();
  };
  cv.addEventListener("pointerup", end);
  // a double click on a region of the world chart walks there, like the detail's [걸어서 이동]
  cv.addEventListener("dblclick", (e) => { if (view.tab !== "world") return; const [x, y] = local(e), h = hitAt(x, y); if (h && h.id) walkToMap(h.id); });
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("pointerleave", () => { if (!view.drag && view.hover) { view.hover = null; showHover(); } });
}
