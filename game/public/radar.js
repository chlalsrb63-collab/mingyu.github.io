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
 * The map window has two tabs: the whole current map (fit to the window; wheel or ± to zoom, drag
 * to pan; party members live with names, gates with where they lead, stones clickable to warp
 * when the warp rules allow) and the world route map, every region from defs.maps joined by its
 * doors (defs.maps[].to), so maps made in the editor appear on it by themselves.
 *
 * The client lends what it owns through init(): G, act, openWin/toggleWin/isOpen, wpWoke, npcOut,
 * miniDots (차원 균열 marks), canWarp, channel info.
 */
import * as Art from "./art.js";
import { icon } from "./uiicons.js";

const T = 16;
const INK = "#120e18";
const $ = (s) => document.querySelector(s);
/** Radar zoom levels: how many tiles from me to the rim of the radar's ground circle. */
export const ZOOMS = [16, 22, 28, 36, 48];
const ZKEY = "lumentale:radar-zoom";
let zi = (() => {
  try { const v = localStorage.getItem(ZKEY); const n = v === null ? NaN : Number(v); return Number.isInteger(n) && n >= 0 && n < ZOOMS.length ? n : 2; } catch { return 2; }
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
const COL = { gate: "#d890ff", door: "#e0a868", stone: "#8ad8ff", stoneOff: "#7a7468", fire: "#ff9a3a", obelisk: "#c890ff", wind: "#5ae4a0", boss: "#ff4a4a", me: "#ffd84a" };

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
  const portals = [];
  for (const p of m.portals || []) {
    const q = portals.find((o) => o.to === p.to && Math.abs(o.x0 - p.x) <= 2 && Math.abs(o.y0 - p.y) <= 2);
    if (q) { q.sx += p.x; q.sy += p.y; q.n++; } else portals.push({ x0: p.x, y0: p.y, sx: p.x, sy: p.y, n: 1, to: p.to, door: !!p.door });
  }
  for (const p of portals) { p.x = p.sx / p.n; p.y = p.sy / p.n; }
  const shrines = [];
  for (let y = 0; y < m.h; y++) { const row = m.o[y]; for (let x = 0; x < m.w; x++) if (row[x] === "/") shrines.push([x, y]); }
  const ob = (m.big || []).find((b) => b.t === "obelisk");
  M = { m, tex, stones, portals, shrines, obelisk: ob ? [ob.x, ob.y] : null };
  view.reset = true;
  view.dirty = true;
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
  for (const mob of G.mobs.values()) {
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
    if (!D.npcOut(n) || (n.role === "dim" && M.obelisk)) continue;
    const [x, y] = Pt(n.x, n.y);
    if (!inView(x, y)) continue;
    const [gl, col] = roleOf(n);
    if (n.role === "talk") dotAt(g, x, y, "#ffe08a", 3); else blit(g, spr(gl, col), x, y - 3);
  }
  if (M.obelisk) { const [x, y] = Pt(...M.obelisk); if (inView(x, y)) blit(g, spr("rift", COL.obelisk), x, y - 3); }
  for (const st of M.stones) {
    const [x, y] = Pt(st.x, st.y);
    if (inView(x, y)) blit(g, spr("stone", D.wpWoke(G.self, m.id, st.i) ? COL.stone : COL.stoneOff), x, y - 3);
  }
  for (const p of M.portals) { const [x, y] = Pt(p.x, p.y); if (inView(x, y)) blit(g, spr(p.door ? "door" : "gate", p.door ? COL.door : COL.gate), x, y - 3); }
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
  if (G.fb) for (const [bx, by] of G.fb) { const [x, y] = P(bx, by); if (Math.floor(t / 350) % 3) pin(x, y, COL.boss, spr("skull", COL.boss)); }
  for (const q of party) { const [x, y] = P(q.x, q.y); pin(x, y, q.col, disc(q.col, q.n)); }
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

function setZoom(i) {
  zi = Math.max(0, Math.min(ZOOMS.length - 1, i));
  try { localStorage.setItem(ZKEY, String(zi)); } catch { /* private mode */ }
  $("#mini-zi").disabled = zi === 0;
  $("#mini-zo").disabled = zi === ZOOMS.length - 1;
  $("#mini-cv").title = `지도 열기 (M) · 반경 ${ZOOMS[zi]}칸`;
}

// ───────────────────────────── the map window ─────────────────────────────

const view = { tab: "here", z: 1, cx: 0, cy: 0, reset: true, dirty: true, at: 0, hits: [], hover: null, drag: null, u: 1, ox: 0, oy: 0 };
const KIND = {
  town: ["#e2c486", "마을"], field: ["#6ac86a", "사냥터"], dun: ["#e0506a", "던전"], in: ["#c89a6a", "실내"],
};
const kindOf = (d) => (d.theme === "interior" ? "in" : d.safe ? "town" : ["crypt", "sewer", "abyss"].includes(d.theme) ? "dun" : "field");
const bandOf = (b) => (b ? `Lv.${b[0]}–${b[1]}` : "안전 지대");

/** The map window, drawn while it is open (15 times a second: the blink, the party). */
export function drawWin(t) {
  if (!M || !D || !D.isOpen("map")) return;
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
  for (const p of M.portals) {
    const [x, y] = Pt(p.x, p.y);
    blit(g, spr(p.door ? "door" : "gate", p.door ? COL.door : COL.gate), x, y - 3);
    tag(p.to, x, y - 15, p.door ? "#f0c890" : "#f0c8ff", 11, 2);
    hit(x, y, 9, `${p.door ? "문" : "관문"} → ${p.to}`);
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
  for (const c of m.camps || []) { const [x, y] = P(c.x, c.y); blit(g, spr("fire", COL.fire), x, y); hit(x, y, 8, "모닥불 — 앉아서(X) 쉬면 온기를 얻습니다"); }
  for (const f of G.fires.values()) { const [x, y] = P(f.x, f.y); blit(g, spr("fire", "#ffb050"), x, y); }
  for (const [sx, sy] of M.shrines) { const [x, y] = Pt(sx, sy); blit(g, spr("wind", COL.wind), x, y - 2); hit(x, y, 8, "질주의 바람 — 바람 신단"); }
  if (M.obelisk) { const [x, y] = Pt(...M.obelisk); blit(g, spr("rift", COL.obelisk), x, y - 3); tag("차원의 오벨리스크", x, y - 15, "#e0c8ff", 10, 4); hit(x, y, 9, "차원의 오벨리스크 — 균열 지기에게 말을 걸어 차원 균열을 엽니다"); }
  for (const n of m.npcs || []) {
    if (!D.npcOut(n)) continue;
    const [x, y] = Pt(n.x, n.y), [gl, col, what] = roleOf(n);
    blit(g, spr(gl, col), x, y - 3);
    if (names && n.role !== "talk") tag(n.name, x, y + 11, "#f4ecd0", 10);
    hit(x, y, 8, `${n.name} · ${what}`);
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

// ── the world route map ──
let world = null;
/** Lay the regions out in columns by how many doors they are from the town (cached per size). */
function layoutWorld(W, H) {
  const maps = D.G.defs.maps || [], key = `${W}x${H}:${maps.length}`;
  if (world && world.key === key) return world;
  const by = new Map(maps.map((d) => [d.id, d])), adj = new Map(maps.map((d) => [d.id, new Set()]));
  for (const d of maps) for (const to of d.to || []) if (adj.has(to)) { adj.get(d.id).add(to); adj.get(to).add(d.id); }
  const root = by.has("town") ? "town" : maps[0] && maps[0].id, depth = new Map();
  if (root) { depth.set(root, 0); const q = [root]; while (q.length) { const a = q.shift(); for (const b of adj.get(a)) if (!depth.has(b)) { depth.set(b, depth.get(a) + 1); q.push(b); } } }
  let maxD = 0;
  for (const d of depth.values()) maxD = Math.max(maxD, d);
  for (const d of maps) if (!depth.has(d.id)) depth.set(d.id, maxD + 1);
  maxD = Math.max(...depth.values(), 0);
  const cols = [];
  for (const d of maps) (cols[depth.get(d.id)] ||= []).push(d);
  const row = new Map();
  cols.forEach((col, i) => {
    const bary = (d) => { const ps = [...adj.get(d.id)].filter((p) => depth.get(p) === i - 1); return ps.length ? ps.reduce((s, p) => s + row.get(p), 0) / ps.length : 0; };
    col.sort((a, b) => (kindOf(a) === "in") - (kindOf(b) === "in") || bary(a) - bary(b) || (a.band ? a.band[0] : 0) - (b.band ? b.band[0] : 0));
    col.forEach((d, j) => row.set(d.id, j));
  });
  const padX = 10, nw = Math.max(70, Math.min(132, Math.floor((W - padX * 2) / (maxD + 1)) - 22));
  const colW = maxD ? (W - padX * 2 - nw) / maxD : 0;
  const nodes = new Map();
  cols.forEach((col, i) => {
    const step = H / (col.length + 1), nh = Math.max(20, Math.min(34, step - 6));
    col.forEach((d, j) => {
      const k = kindOf(d), h = k === "in" ? Math.max(18, nh - 8) : nh;
      nodes.set(d.id, { d, k, x: Math.round(padX + i * colW), y: Math.round(step * (j + 1) - h / 2), w: k === "in" ? nw - 14 : nw, h, col: i });
    });
  });
  return (world = { key, nodes, adj });
}
function drawWorld(g, W, H, t) {
  const G = D.G, { nodes, adj } = layoutWorld(W, H), here = G.map && G.map.id;
  // the lines first, metro style: out of the right side, across, into the left side
  const done = new Set();
  for (const [a, set] of adj) for (const b of set) {
    const k = a < b ? a + "|" + b : b + "|" + a;
    if (done.has(k) || !nodes.has(a) || !nodes.has(b)) continue;
    done.add(k);
    let A = nodes.get(a), B = nodes.get(b);
    if (A.col > B.col) [A, B] = [B, A];
    const ay = A.y + A.h / 2, by = B.y + B.h / 2, inner = A.k === "in" || B.k === "in";
    const pts = [];
    if (A.col === B.col) { const x = Math.max(A.x + A.w, B.x + B.w) + 8; pts.push([A.x + A.w, ay], [x, ay], [x, by], [B.x + B.w, by]); }
    else { const mx = Math.round((A.x + A.w + B.x) / 2); pts.push([A.x + A.w, ay], [mx, ay], [mx, by], [B.x, by]); }
    const lit = a === here || b === here;
    for (const [w, col] of [[inner ? 4 : 6, INK], [inner ? 2 : 4, lit ? "#ffd84a" : inner ? "#8a6a4a" : "#a89068"]]) {
      g.fillStyle = col;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        g.fillRect(Math.round(Math.min(x0, x1) - w / 2), Math.round(Math.min(y0, y1) - w / 2), Math.round(Math.abs(x1 - x0) + w), Math.round(Math.abs(y1 - y0) + w));
      }
    }
  }
  // the regions
  const party = new Map();
  (G.party || []).forEach((r, i) => { if (r[0] !== G.you && r[9]) (party.get(r[9]) || party.set(r[9], []).get(r[9])).push({ n: i + 1, col: PARTY_COL[i % PARTY_COL.length], name: r[1] }); });
  for (const [id, n] of nodes) {
    const cur = id === here, [edge, kname] = KIND[n.k];
    g.fillStyle = INK; g.fillRect(n.x - 2, n.y - 2, n.w + 4, n.h + 4);
    g.fillStyle = cur ? (Math.floor(t / 500) % 2 ? "#ffd84a" : "#e8b84a") : edge; g.fillRect(n.x, n.y, n.w, n.h);
    g.fillStyle = cur ? "#3a2408" : "#1d1826"; g.fillRect(n.x + 2, n.y + 2, n.w - 4, n.h - 4);
    const big = n.h >= 28;
    // (a short box says its level band on the same line)
    const one = !big && n.d.band ? `${n.d.name} ${bandOf(n.d.band)}` : n.d.name;
    label(g, one, n.x + n.w / 2, n.y + (big ? n.h / 2 - 6 : n.h / 2), cur ? "#fff2a0" : "#f4ecd0", n.k === "in" || one !== n.d.name ? 10 : 11);
    if (big) label(g, n.k === "dun" ? `던전 ${bandOf(n.d.band)}` : n.k === "town" ? "안전 지대" : bandOf(n.d.band), n.x + n.w / 2, n.y + n.h / 2 + 7, cur ? "#ffe8a0" : edge, 10);
    if (cur) blit(g, meArrow(0), n.x - 4, n.y + n.h / 2);
    (party.get(id) || []).forEach((q, j) => blit(g, disc(q.col, q.n), n.x + n.w - 4 - j * 11, n.y - 1));
    const stones = n.d.wpn ? ` · 이동의 돌 ${n.d.wpn}개` : "";
    const who = (party.get(id) || []).map((q) => q.name).join(", ");
    view.hits.push({ x: n.x + n.w / 2, y: n.y + n.h / 2, rect: [n.x, n.y, n.w, n.h],
      tip: `${n.d.name} · ${kname} · ${n.k === "in" ? "실내" : bandOf(n.d.band)}${n.d.mobs && n.d.mobs.length ? ` · 몬스터 ${n.d.mobs.length}종` : ""}${stones}${cur ? " · 현재 위치" : ""}${who ? ` · 파티원: ${who}` : ""}` });
  }
}

function showHover() {
  const h = view.hover, el = $("#map-info");
  const txt = h ? h.tip : view.tab === "here" ? `${D.G.map.name}${D.G.map.band ? " · " + bandOf(D.G.map.band) : ""} · 휠/±로 확대, 끌어서 이동 · 깨운 돌을 누르면 순간이동` : "문으로 이어진 모든 지역 · 금색이 지금 있는 곳 · 숫자 원은 파티원";
  if (el.textContent !== txt) el.textContent = txt;
  $("#map-cv").style.cursor = h && h.click ? "pointer" : view.tab === "here" ? (view.drag ? "grabbing" : "grab") : "default";
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
  for (const b of document.querySelectorAll("#map-tabs button[data-tab]")) b.classList.toggle("on", b.dataset.tab === tab);
  $("#map-zoom").hidden = tab !== "here";
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
    for (const k of ["town", "field", "dun", "in"]) chip(sw(KIND[k][0]), KIND[k][1]);
    chip(sw("#ffd84a"), "현재 위치"); chip(disc(PARTY_COL[0], 1), "파티원");
  }
}

/** The window was opened: start where I stand. */
export function opened() {
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
  for (const b of document.querySelectorAll("#map-tabs button[data-tab]")) b.addEventListener("click", () => { setTab(b.dataset.tab); D.play("ui"); });
  const cv = $("#map-cv");
  const local = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height]; };
  $("#map-zi").addEventListener("click", () => { zoomAt(1.5, cv.width / 2, cv.height / 2); });
  $("#map-zo").addEventListener("click", () => { zoomAt(1 / 1.5, cv.width / 2, cv.height / 2); });
  $("#map-fit").addEventListener("click", () => { view.z = 1; view.reset = true; view.dirty = true; });
  cv.addEventListener("wheel", (e) => { if (view.tab !== "here") return; e.preventDefault(); const [x, y] = local(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, x, y); }, { passive: false });
  cv.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const [x, y] = local(e);
    view.drag = { x, y, cx: view.cx, cy: view.cy, moved: false, id: e.pointerId };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = local(e), d = view.drag;
    if (d && view.tab === "here") {
      const dx = x - d.x, dy = y - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
      if (d.moved) {
        const a = dx / view.u, b = (2 * dy) / view.u;
        view.cx = d.cx - (a + b) / 2; view.cy = d.cy - (b - a) / 2;
        clampView(); view.dirty = true;
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
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("pointerleave", () => { if (!view.drag && view.hover) { view.hover = null; showHover(); } });
}
