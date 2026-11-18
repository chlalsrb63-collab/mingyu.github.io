/**
 * The loaded map (split from scene2d.js): its state (`map ground statics npcs theme waterTiles camps
 * falls lights signs …`, assigned only by `loadMap`; `setMap` for the title stage), standing things
 * up (`toIso stand standBig slice`, raised blocks `blockStyle blockSprite`), `loadMap`, signposts and
 * labels (`signWay labels wpLit`), and the ambient life (`amb respawn drawAmbient drawWater`).
 */

import * as SP from "./sprites.js";
import * as DC from "./decor.js";
import * as IT from "./isotiles.js";
import * as Art from "./art.js";
import * as Camp from "./camp.js";
import { HUE, hueAt } from "./autumn.js";
import * as IN from "./iso_interior.js";
import * as DimArt from "./dimart.js";
import { icon as uiIcon } from "./uiicons.js";
import * as TF from "./townfolk.js";
import * as HA from "./hallart.js";
import { sheet, K, FLAT, tI, tone, dk, hash, INK, T, sqI, iso, cam, G, vw, vh, Z, g } from "./scene_view.js";
import { scenery, WALL, NEON } from "./scene_props.js";
import { UG, themeOf, paintGround, paintExtras, setLazyLeft } from "./scene_ground.js";
import { ents } from "./scene_people.js";
import { fx } from "./scene_fx.js";

export let map = null, ground = null, statics = [], npcs = [];
/** The map's setter for the title stage (`showcase` clears it). */
export function setMap(m) { map = m; }

export let theme = "meadow", waterTiles = [], smokers = [];
const WATER_CELL = 128;
const waterBins = new Map();
const waterKey = (x, y) => y * 65536 + x;
const BLOSSOM_MAP = "blossom_trail";
/** The fires that always burn on this map, on screen, with their stumps (camp.js art; sky.js fireflies). */
export let camps = [];
/** Level art from decor.js: falling water, a layer that breathes, little emitters, lantern strings, critters, signs. */
export let falls = [], pulseCv = null, pulseParts = null, emit = [], strings = [], critters = [], signs = [], lights = [];
/** An interior's lamps, fire and window light (iso_interior.js roomLight). */
export let roomL = { glows: [], wins: [], motes: [] };
/** Whether the ground came from isotiles.js (its water animates itself). */
export let artGround = false;

/** Project a square world-pixel canvas of the whole map onto the diamond grid. */
export function toIso(m, src, smooth = false) {
  const [c, x] = sheet((m.w + m.h) * 16 * K, (m.w + m.h) * 8 * K);
  x.imageSmoothingEnabled = smooth;
  x.setTransform(FLAT[0], FLAT[1], FLAT[2], FLAT[3], m.h * 16 * K, 0);
  x.drawImage(src, 0, 0);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

/** Stand a sprite on tile (tx, ty): its foot a little in front of the tile's middle, sorted at the middle. */
function stand(st, tx, ty, nudge = 0) {
  const [X, Y] = tI(tx + 0.5, ty + 0.5);
  st.x = X + nudge; st.y = Y + 4;
  st.dx = Math.round(st.x - st.sp.width / 2); st.dy = Math.round(st.y - st.sp.height + 2 - (st.lift || 0));
  st.d = Y + (st.lift ? 1 : 0);
  return st;
}
/** Does the pew at (x, y) run along x? With its row-mates if it has any, else across the nearest runner. */
function pewAlongX(m, x, y) {
  const o = (i, j) => (m.o[j] && m.o[j][i]) || null, g = (i, j) => (m.g[j] && m.g[j][i]) || null;
  if (o(x - 1, y) === "I" || o(x + 1, y) === "I") return true;
  if (o(x, y - 1) === "I" || o(x, y + 1) === "I") return false;
  for (let d = 1; d < 8; d++) { if (g(x - d, y) === "n" || g(x + d, y) === "n") return true; if (g(x, y - d) === "n" || g(x, y + d) === "n") return false; }
  return true;
}
/** Stand a big sprite over a footprint of fw×fh tiles at (fx, fy), painted in upright strips. */
function standBig(st, fx, fy, fw, fh, down = 0) {
  const [X, Y] = tI(fx + fw / 2, fy + fh / 2);
  st.x = X; st.y = Y + (fw + fh) * 2 + down;
  st.dx = Math.round(st.x - st.sp.width / 2); st.dy = Math.round(st.y - st.sp.height + 2 - (st.lift || 0));
  st.d = Y;
  slice(st, fx, fy, fw, fh);
  return st;
}
/**
 * Cut a wide sprite into strips 16 pixels across, each sorted by the front edge of
 * the footprint under it, so someone standing before one face of a building is
 * painted over it while someone behind it is hidden.
 */
function slice(st, fx, fy, fw, fh) {
  const [Lx, Ly] = tI(fx, fy + fh), [Bx, By] = tI(fx + fw, fy + fh), [Rx, Ry] = tI(fx + fw, fy);
  const front = (X) => (X <= Lx ? Ly : X >= Rx ? Ry : X < Bx ? Ly + ((X - Lx) * (By - Ly)) / (Bx - Lx) : By + ((X - Bx) * (Ry - By)) / (Rx - Bx));
  st.slices = [];
  const w = st.sp.width;
  for (let sx = 0; sx < w; sx += 16) {
    const sw = Math.min(16, w - sx), X0 = st.dx + sx;
    st.slices.push({ sx, w: sw, d: Math.min(front(X0), front(X0 + sw)) - 3 });
  }
  st.foot = [fx, fy, fw, fh];
}

// ── raised blocks: cliffs, hedges, walls, the city's panels and underground rock, one per tile
/** [height, top, lit rim, dark rim, south face, east face, seam]. */
function blockStyle(kind) {
  if (kind === "W") {
    const U = UG[theme];
    if (U) return { h: 30, top: tone(U.rock, U.face[3], 0.55), rim: U.face[1], low: tone(U.rock, U.face[0], 0.5), s: U.face[0], e: dk(U.face[0], 0.72), seam: U.face[3], cap: U.face[1], kind };
    return { h: 30, top: "#1b2644", rim: "#4a6a98", low: "#141c34", s: "#2e4468", e: "#223450", seam: "#141c34", cap: "#3a5680", kind };
  }
  return {
    C: { h: 20, top: "#b4aa8c", rim: "#d2c8a8", low: "#8c8168", s: "#a1967a", e: "#776c56", seam: "#8c8168", cap: "#c6bc9c", kind },
    H: { h: 14, top: "#4aa552", rim: "#84d474", low: "#256a32", s: "#33863f", e: "#256a32", seam: "#2a7036", cap: "#6ac060", kind },
    U: { h: 16, top: "#cbc6b6", rim: "#e2decf", low: "#8c8678", s: "#9c9686", e: "#726c5e", seam: "#827c6e", cap: "#bcb6a6", kind },
    Z: { h: 34, top: "#5a6278", rim: "#848ca2", low: "#2e3240", s: "#4a5064", e: "#343846", seam: "#3c4254", cap: "#6a7288", kind },
  }[kind];
}
const blockCache = new Map();
/**
 * One raised tile: a lit top diamond and the two faces that look at the camera.
 * `mask` says which neighbours are blocks too (1 north, 2 east, 4 south, 8 west)
 * so joined pieces read as one mass. The image's top-left sits at the tile's top
 * corner + (−16, −h), as isotiles.js pieces do.
 */
function blockSprite(kind, mask, v, topOnly) {
  const key = theme + kind + mask + v + (topOnly ? "t" : "");
  let c = blockCache.get(key);
  if (c) return c;
  const B = blockStyle(kind), H = B.h;
  let x;
  [c, x] = sheet(32, 16 + H);
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const top = (cl) => (cl < 16 ? 7 - (cl >> 1) : (cl - 16) >> 1), bot = (cl) => (cl < 16 ? 8 + (cl >> 1) : 15 - ((cl - 16) >> 1));
  const h = (s) => hash(mask, v, s);
  // the faces, where nothing of the same stands in front of them
  if (!topOnly) for (let cl = 0; cl < 32; cl++) {
    const south = cl < 16;
    if (south ? mask & 4 : mask & 2) continue;
    const y0 = bot(cl) + 1, col = south ? B.s : B.e;
    r(cl, y0, 1, H, col);
    // courses of stone (or strata, or leaves) running along the face
    if (B.kind === "H") { for (let k = 3; k < H; k += 4) if (hash(cl, k, v) < 0.5) r(cl, y0 + k, 1, 1, south ? B.cap : B.seam); }
    else if (B.kind === "Z") { if (cl % 8 === 3) r(cl, y0, 1, H, B.seam); r(cl, y0 + 3, 1, 1, B.seam); }
    else for (let k = 5; k < H - 1; k += B.kind === "C" ? 6 : 5) {
      r(cl, y0 + k, 1, 1, B.seam);
      const joint = ((cl + (((k / 5) | 0) % 2) * 4 + v * 3) % 8) === 0;
      if (joint && B.kind !== "C") r(cl, y0 + k - 4, 1, 4, B.seam);
    }
    if (B.kind === "C" && hash(cl, v, 7) < 0.12) r(cl, y0 + 3 + Math.floor(hash(cl, v, 8) * (H - 8)), 1, 3, B.seam);
    r(cl, y0 + H - 1, 1, 1, INK);                                     // where it meets the ground
  }
  // the top: flat, lit along the edges that face the light, dark along the others
  for (let cl = 0; cl < 32; cl++) r(cl, top(cl), 1, bot(cl) - top(cl) + 1, B.top);
  for (let i = 0; i < 3; i++) {
    const a = 6 + Math.floor(h(i) * 20), b = Math.max(top(a) + 2, Math.min(bot(a) - 2, 4 + Math.floor(h(i + 5) * 8)));
    if (B.kind === "C") { r(a, b, 3, 1, i ? "#6cbf5e" : B.seam); if (!i) r(a + 1, b - 1, 1, 1, "#8ad070"); }
    else if (B.kind === "H") { r(a, b, 2, 1, i % 2 ? B.cap : B.low); }
    else if (B.kind === "W") { if (i < 2) r(a, b, 2, 1, B.low); }
    else r(a, b, 2, 1, B.seam);
  }
  for (let cl = 0; cl < 32; cl++) {
    if (cl < 16 ? !(mask & 8) : !(mask & 1)) { r(cl, top(cl), 1, 1, B.rim); if (B.kind !== "W") r(cl, top(cl) + 1, 1, 1, B.cap); }
    if (cl < 16 ? !(mask & 4) : !(mask & 2)) r(cl, bot(cl), 1, 1, B.low);
  }
  // an outline where the mass ends
  if (!topOnly) {
    if (!(mask & 8) && !(mask & 4)) r(0, 7, 1, H + 2, INK);
    if (!(mask & 1) && !(mask & 2)) r(31, 7, 1, H + 2, INK);
  }
  c.H = H;
  blockCache.set(key, c);
  return c;
}

/** The iso house, city block and car sprites from art.js, used until isotiles.js has its own. */
let ARTSC = null;
const artSc = () => ARTSC || (ARTSC = Art.buildScenery());

/** What the last loadMap cost, ms: the ground, the sprite sets, the landmarks' plan, the per-tile pass, the rest (tools). */
export let loadCost = null;
export function loadMap(m) {
  const lt = [performance.now()];
  map = m;
  theme = m.theme || themeOf(m);
  // the ground: isotiles.js bakes it — a big map in chunks, as they come on screen (?chunks=1 forces that) —
  // or, failing that, it is painted flat on the square grid and laid onto diamonds
  // (indoors there is no flat fallback: iso_interior.js bakes the floor)
  ground = null; artGround = false;
  if (IT.ready) {
    const force = !!globalThis.__chunks || (typeof location !== "undefined" && /[?&]chunks=1/.test(location.search));
    if (IT.chunked(m, theme, force)) { ground = IT.groundChunks(m, theme); artGround = true; }
    else {
      const b = IT.bakeGround(m, theme);
      if (b && b.frames && b.frames.length) { ground = b; artGround = true; }
    }
  }
  if (!ground) {
    const flat = theme === "interior" ? sheet(m.w * T, m.h * T)[0] : paintGround(m, theme);
    if (theme !== "interior") { DC.decals(m, theme, flat.getContext("2d")); paintExtras(m, flat); }
    ground = { frames: [toIso(m, flat)], ox: m.h * 16 * K, oy: 0 };
  }
  lt.push(performance.now());
  const S = scenery(), D = DC.sprites(), lazyWalls = IT.ready && !!ground.chunked;
  lt.push(performance.now());
  statics = []; waterTiles = []; waterBins.clear(); smokers = []; signs = []; lights = [];
  // landmarks that stand on one solid tile (the spirit tree, the rift obelisk): nothing else is drawn there
  const spiritAt = new Set(m.big.filter((b) => b.t === "spirit" || b.t === "obelisk").map((b) => b.x + "," + b.y));
  roomL = { glows: [], wins: [], motes: [] };
  const lay = DC.plan(m, theme), mkt = theme === "town" ? DC.town(m) : { statics: [], swap: new Set(), strings: [] };
  // the brick halls: arched doorways and wall torches (hallart.js); a torch replaces its alcove's candle stand
  const halls = HA.hallProps(m, theme);
  // the glowing layer of the deep places: one canvas, or for a chunked map pieces made as they come on screen
  pulseCv = null; pulseParts = ground.chunked && ["cave", "abyss", "sewer", "crypt"].includes(theme) ? new Map() : null;
  if (!pulseParts) { const pc = DC.pulse(m, theme); pulseCv = pc ? toIso(m, pc) : null; }
  // falling water runs down the face of a ledge, which now runs along the diagonal
  falls = lay.falls.concat(DC.riverFalls(m, theme)).map((f) => {
    const [X0, Y0] = sqI(f.x, f.edge), [X1] = sqI(f.x + f.w, f.edge), R = f.ring ? sqI(f.ring[0], f.ring[1]) : null;
    return { ...f, X0, Y0, len: X1 - X0, H: f.H || (f.pool ? 22 : 30), RX: R ? R[0] : undefined, RY: R ? R[1] : undefined };
  });
  emit = DC.emitters(m, theme).map((e) => { const [X, Y] = sqI(e.x, e.y); return { ...e, x: X, y: Y - (e.k === "drip" ? 26 : e.k === "eyes" ? 12 : 0) }; });
  strings = mkt.strings.map((s) => {
    const lamp = (x, y) => { const [X, Y] = tI((x - 16) / T + 0.5, (y + 20) / T + 0.5); return [X, Y - 44]; };
    const [ax, ay] = lamp(s.ax, s.ay), [bx, by] = lamp(s.bx, s.by);
    return { ax, ay, bx, by };
  });
  critters = [];
  lt.push(performance.now());
  const marks = new Map((m.marks || []).map((k) => [k.x + "," + k.y, k]));
  const edge = (x, y) => x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2;
  // the pieces isotiles.js stands up, by tile; a house it draws is not drawn again here
  const art = new Map(), artHouse = new Set();
  const houseAt = (x, y) => m.big.find((b) => (b.t === "house" || b.t === "bld") && x >= b.x && x < b.x + (b.w || 4) && y >= b.y && y < b.y + (b.h || 3));
  const isRock = (x, y) => { const r = m.g[y]; return theme !== "interior" && !!r && r[x] === "W" && m.o[y][x] === " "; };
  const blockKind = (x, y) => { const r = m.o[y]; if (!r || x < 0 || x >= m.w) return null; const ch = r[x]; return ch === " " ? (isRock(x, y) ? "W" : null) : WALL[ch] || ch === "Z" ? ch : null; };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.g[y][x] === "❋" && m.o[y][x] === " " && hash(x, y, 40) < 0.50) {
      const variant = Math.floor(hash(x, y, 41) * S.rapeseed.length);
      statics.push(stand({ sp: S.rapeseed[variant], glow: null, glint: -1 }, x, y, Math.round((hash(x, y, 42) - 0.5) * 10)));
    }
    if (m.g[y][x] === "w") {
      const sh = (dx, dy) => { const r = m.g[y + dy], ch = r && r[x + dx]; return ch !== undefined && ch !== "w" && ch !== "b" ? 1 : 0; };
      const [X, Y] = tI(x, y);
      const tile = { X, Y, x: x * T, y: y * T, h: hash(x, y, 5), n: sh(0, -1), s: sh(0, 1), w: sh(-1, 0), e: sh(1, 0) };
      waterTiles.push(tile);
      const key = waterKey(Math.floor(X / WATER_CELL), Math.floor(Y / WATER_CELL));
      const bin = waterBins.get(key);
      if (bin) bin.push(tile); else waterBins.set(key, [tile]);
    }
    const ch = m.o[y][x], key = x + "," + y;
    // a landmark stands where it stands: nothing else is drawn on the tiles it covers
    if (lay.covered.has(key) || spiritAt.has(key)) continue;
    // on a big (chunked) map the walls, cliffs, hedges and rock stand up when they first come near the
    // screen (render: lazyTall); what isotiles.js draws for them, or nothing, is decided then
    if (lazyWalls && (isRock(x, y) || "CHUZW".includes(ch))) {
      const [X, Y] = tI(x, y);
      statics.push({ lazy: [x, y], sp: null, dx: X, dy: Y, x: X, y: Y + 16, d: Y + 8, glow: null, glint: -1, art: true, tx: X, ty: Y });
      continue;
    }
    if (IT.ready && (ch !== " " || isRock(x, y))) {
      const pc2 = IT.tallAt(m, x, y, theme);
      if (pc2 && pc2.img) {
        const [X, Y] = tI(x, y), st = { sp: pc2.img, dx: X + pc2.dx, dy: Y + pc2.dy, x: X, y: Y + 16, d: Y + 8, glow: null, glint: -1, art: true, tx: X, ty: Y };
        // a wall tall enough to hide someone can be cut down to a stump when they stand behind it
        if (ch !== "h" && "low" in pc2) st.cut = pc2;
        if (ch === "h") { const hb = houseAt(x, y); if (hb) { artHouse.add(hb); st.depthBuilding = true; slice(st, hb.x, hb.y, hb.w || 4, hb.h || 3); } }
        // indoors: a fire, steam, a sleeping cat; lamps and windows light the room (iso_interior.js)
        if (pc2.anim) st.anim = pc2.anim;
        if (pc2.glow) { roomL.glows.push({ ...pc2.glow, X: X + pc2.glow.x, Y: Y + pc2.glow.y }); if (theme !== "interior") st.nightGlow = "#ffd890"; }
        if (pc2.win) roomL.wins.push(IN.windowPatch(pc2.win, x, y, tI));
        art.set(key, st);
        statics.push(st);
        continue;
      }
      // the art draws the deep rock between walls into the ground itself
      if (isRock(x, y) || "CHUZW".includes(ch)) continue;
    }
    if (ch === "Q") { statics.push(stand({ sp: D.waypoint, glow: null, glint: -1, wp: true, ph: hash(x, y, 6) * 9 }, x, y)); continue; }
    if (ch === "G" && marks.has(key)) {
      const k = marks.get(key), way = signWay(m, x, y, k);
      const st = stand({ sp: D.sign[way + 1], glow: null, glint: -1, label: k && k.label ? k.label : null }, x, y);
      statics.push(st); if (st.label) signs.push(st);
      continue;
    }
    if (mkt.swap.has(key) || (ch === "3" && halls.torchAt.has(key))) continue;
    const bk = blockKind(x, y);
    if (bk) {
      // underground rock deep inside the mass shows only its top
      const same = (dx, dy) => (blockKind(x + dx, y + dy) ? 1 : 0);
      const mask = same(0, -1) | (same(1, 0) << 1) | (same(0, 1) << 2) | (same(-1, 0) << 3);
      const sp = blockSprite(bk, mask, hash(x, y, 4) < 0.5 ? 0 : 1, (mask & 6) === 6);
      const [X, Y] = tI(x, y);
      statics.push({ sp, dx: X - 16 * K, dy: Y - sp.H, x: X, y: Y + 16, d: Y + 8, glow: null, glint: -1, block: true });
      continue;
    }
    // (maps-batch2: the cloud temple's trees stand in the old kingdom's reds and golds; the mesa's rock pillars are red)
    const au = theme === "autumn" || theme === "mist";
    let sp = (au && S.AU[ch]) || (theme === "mesa" && ch === "Θ" && S["RΘ"]) || S[ch];
    if (!sp || ch === "c") continue;
    const h = hash(x, y, 3);
    if (au && ch === "T") { const hu = hueAt(m, x, y); sp = sp[hu][hu === 0 ? (h < 0.65 ? 1 : 0) : h < 0.25 ? 1 : 0]; }
    else if (au && ch === "Y") sp = h < 0.55 ? S.AU.toad : S.Y[Math.floor(h * 2)];
    else if (au && ch === "B") {
      // roses grow by the graves and the fences round them, and wherever the blight is
      const grave = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].some(([dx, dy]) => "JF".includes((m.o[y + dy] || [])[x + dx] || "."));
      sp = sp[grave || m.g[y][x] === "&" || hash(x, y, 5) < 0.08 ? 3 : Math.min(2, hueAt(m, x, y))];
    }
    else if (ch === "l" && theme === "coast") sp = S.DW[h < 0.5 ? 0 : 1];
    else if (theme === "town" && S.TT[ch]) sp = S.TT[ch][Math.floor(hash(x, y, 11) * S.TT[ch].length)];   // town tree kinds
    else if (ch === "T" && theme === "jungle") sp = S.JT[h < 0.45 ? 0 : h < 0.85 ? 1 : 2];   // broad dark leaves (maps-v2 M3 art)
    else if (ch === "T") sp = sp[edge(x, y) ? (h < 0.7 ? 0 : 2) : h < 0.5 ? 0 : h < 0.72 ? 2 : h < 0.88 ? 1 : 3];
    else if (ch === "B") sp = theme === "town" ? S.TB[Math.floor(h * 3)] : sp[Math.floor(h * 3)];
    else if (ch === "L") sp = theme === "city" ? S.L2 : S.L;
    else if (ch === "K") sp = hash(x, y, 7) > 0.6 ? S.K2 : S.K;
    else if (ch === "Y") sp = (theme === "cave" ? S.Y2 : S.Y)[Math.floor(h * 2)];
    else if (ch === "I") sp = sp[pewAlongX(m, x, y) ? 0 : 1];
    else if (Array.isArray(sp)) sp = sp[Math.floor(h * sp.length)];
    statics.push(stand({
      sp, glow: ch === "L" ? "#ffe690" : ch === "K" ? "#72e6f4" : ch === "3" || ch === "9" ? "#ffd070" : ch === "0" || ch === "X" ? "#ff6a7a" : ch === "Y" && theme === "cave" ? "#5ae4d0" : ch === "/" ? "#9affc8" : null, glint: ch === "K" ? hash(x, y, 9) * 6 : -1,
      depthFoliage: ch === "T" || ch === "P" || ch === "B" || ch === "桜",
    }, x, y, ch === "T" || ch === "P" ? Math.round((hash(x, y, 8) - 0.5) * 6) : 0));
  }
  for (const st of halls.statics) statics.push(st);
  // cars stand across two tiles; houses and city blocks over four by three
  const A = artSc();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.o[y][x] !== "c" || art.has(x + "," + y)) continue;
    const car = A.c[Math.floor(hash(x, y, 3) * A.c.length)], [X, Y] = tI(x, y);
    const st = { sp: car.cv, dx: X - car.ax, dy: Y - car.ay, x: X + 8, y: Y + 16, d: Y + 12, glow: null, glint: -1 };
    slice(st, x, y, 2, 1);
    statics.push(st);
  }
  const TP = theme === "town" || theme === "meadow" || theme === "mist" ? DC.townProps() : null;
  for (const b of m.big) {
    if (b.t === "bld") {
      // a named building (iso_tall.js models it): its sign beside the door, its windows lit after dark,
      // smoke from the chimney, the forge's sparks, the diner's steam, the alchemist's coloured puffs
      const info = IT.ready && IT.bldInfo ? IT.bldInfo(m, b, theme) : null;
      if (!info) continue;
      const [X0, Y0] = tI(b.x, b.y), off = ([sx, sy]) => [X0 + sx, Y0 + sy];
      if (info.sign) {
        const [sx, sy] = off(info.sign), sp = DC.signPlank(uiIcon(b.icon, "#4a2e1a"), info.signTrim);
        const st = { sp, dx: Math.round(sx - 10), dy: Math.round(sy - 3), x: sx, y: sy + 30, d: sy + 25, glow: null, glint: -1, label: b.name, near: 9, sign: true };
        statics.push(st); signs.push(st);
      }
      const [cx, cy] = tI(b.x + b.w / 2, b.y + b.h / 2);
      // (a pool of light for a few of the windows, spread along the faces: the panes themselves are painted lit)
      const step = Math.max(1, Math.ceil(info.wins.length / 2));
      lights.push({ x: cx, y: cy, wins: info.wins.filter((_, i) => i % step === step >> 1).map(off), lamps: info.lamps.slice(0, 1).map(off), ph: hash(b.x, b.y, 2) * 9 });
      for (const s of info.smoke) { const [x, y] = off(s); if (b.k !== "smithy") smokers.push({ x, y }); }
      for (const s of info.glow) { const [x, y] = off(s); emit.push({ k: "spark", x, y, ph: 0 }); }
      if (info.steam) { const [x, y] = off(info.steam); emit.push({ k: "steam", x, y, ph: 0 }); }
      if (info.puff) { const [x, y] = off(info.puff); emit.push({ k: "puff", x, y, ph: 0 }); }
      continue;
    }
    if (b.t === "prop") {
      const sp = TP && TP[b.k];
      if (!sp) continue;
      const st = { sp: Array.isArray(sp) ? sp[0] : sp, prop: b.k };
      if (b.k === "laundry" || b.k === "waterwheel") st.frames = sp;
      if (b.k === "waterwheel") st.frameMs = 90;
      if (b.k === "stall") st.sp = sp[hash(b.x, b.y, 5) * 3 | 0];
      if (b.k === "stall") st.nightGlow = "#ffd890";
      if (b.k === "watch") st.nightGlow = "#ffd870";
      statics.push(standBig(st, b.x, b.y, b.w, b.h, (b.w + b.h) * 2 - 3));
      continue;
    }
    if (b.t === "house") {
      if (artHouse.has(b)) {
        // the art's cottage keeps its chimney smoking and its windows lit too
        const [X, Y] = tI(b.x, b.y);
        if (theme === "town") { smokers.push({ x: X + 32, y: Y - 34 }); lights.push({ x: X + 8, y: Y + 30, wins: [[X - 22, Y + 12], [X + 18, Y + 32]], lamps: [], ph: hash(b.x, b.y, 2) * 9 }); }
        continue;
      }
      const city = b.v >= 4, hs = A.house[b.v % 8], [X, Y] = tI(b.x, b.y);
      const s = { sp: hs.cv, dx: X - hs.ax, dy: Y - hs.ay, x: tI(b.x + 2, b.y + 1.5)[0], y: tI(b.x + 4, b.y + 3)[1], glow: city ? NEON[b.v % 4] : null, big: true, neon: city ? NEON[b.v % 4] : null, ph: hash(b.x, b.y, 2) * 9, house: !city };
      s.depthBuilding = true;
      slice(s, b.x, b.y, 4, 3);
      statics.push(s);
      if (!city) smokers.push({ x: s.x + 6, y: s.dy + 10 });
    } else if (b.t === "spirit") statics.push(stand({ sp: Camp.spiritTree(), glow: "#5ab8ff", land: "spirit", spirit: true, ph: 1.3, glint: -1 }, b.x, b.y));
    else if (b.t === "obelisk") {
      // 차원의 오벨리스크 (dimart.js): its seam pulses and two shards circle it
      const st = stand({ sp: DimArt.obelisk(), glow: "#b07aff", land: "obelisk", ph: 0.4, glint: -1 }, b.x, b.y);
      st.anim = (g2, t2) => DimArt.obeliskAnim(g2, t2, st.dx, st.dy);
      statics.push(st);
    }
    else statics.push(standBig({ sp: S.fountain, water: true }, b.x, b.y, 2, 2, -4));
  }
  // every fire that always burns: a ring of stones, stumps to sit on; in town a tripod, a pot and a bedroll
  lt.push(performance.now());
  camps = (m.camps || []).map((c) => {
    const [X, Y] = iso(c.x, c.y), flat = (sp, cx, cy, d) => statics.push({ sp, dx: Math.round(X + cx), dy: Math.round(Y + cy), x: X, y: Y, d, glow: null, glint: -1 });
    flat(Camp.ring(), -17, -10, Y - 30);
    for (const [sx, sy] of c.seats) { const [SX, SY] = iso(sx, sy); statics.push({ sp: Camp.stump(), dx: Math.round(SX - 9), dy: Math.round(SY - 9), x: SX, y: SY, d: SY - 0.5, glow: null, glint: -1, stump: true }); }
    if (m.safe) {
      const [BX, BY] = iso(c.x + 23, c.y + 29);
      statics.push({ sp: Camp.bedroll(), dx: Math.round(BX - 13), dy: Math.round(BY - 8), x: BX, y: BY, d: BY - 4, glow: null, glint: -1 });
      const [PX, PY] = m.id === "sunset_beach" ? iso(c.x + 12, c.y - 23) : [X, Y];
      statics.push({ sp: Camp.tripod(0), sp1: Camp.tripod(1), dx: Math.round(PX - 17), dy: Math.round(PY - 31), x: PX, y: PY, d: PY + 0.5, glow: null, glint: -1, pot: true });
    }
    return { x: X, y: Y, wx: c.x, wy: c.y, seats: c.seats, pot: !!m.safe };
  });
  const fromDC = (st) => {
    if (st.lip) return null;
    if (st.foot) { const [x, y, w, h] = st.foot; return standBig(st, x, y, w, h); }
    if (st.tile) return stand(st, st.tile[0], st.tile[1]);
    return stand(st, (st.x - 16) / T, (st.y + 3) / T - 1);
  };
  for (const st of lay.statics) { const s = fromDC(st); if (s) statics.push(s); }
  for (const st of mkt.statics) { const s = fromDC(st); if (s) statics.push(s); }
  // what lights up after dark: lamps, windows, landmarks, runes
  for (const st of statics) if (st.glow || st.wp || st.nightGlow || st.house || st.pot) lights.push(st);
  setLazyLeft(statics.filter((st) => st.lazy).length);
  // (an interactive object, `thing` (town.md E), is the furniture it stands on: no figure of its own)
  npcs = m.npcs.filter((n) => !n.thing).map((n) => { const [x, y] = iso(n.x * 16 + 8, n.y * 16 + 12); return { n, x, y, sheet: SP.npcSheet(n) }; });
  TF.load(m);
  ents.clear();
  fx.clear();
  amb.length = 0;
  lt.push(performance.now());
  loadCost = { ground: lt[1] - lt[0], sprites: lt[2] - lt[1], plan: lt[3] - lt[2], tiles: lt[4] - lt[3], rest: lt[5] - lt[4] };
  for (const k of Object.keys(loadCost)) loadCost[k] = Math.round(loadCost[k]);
}

/**
 * A signpost's board points at the gate it names, if the gate is clearly to one
 * side; otherwise it is a plain board. Returns -1 (left), 0 or 1 (right).
 */
function signWay(m, x, y, k) {
  if (!k) return 0;
  // the label may carry its own arrow
  const lab = String(k.label || "");
  if (/[←⇐◀↖↙]/.test(lab)) return -1;
  if (/[→⇒▶↗↘]/.test(lab)) return 1;
  if (/[↑↓]/.test(lab) || !k.to) return 0;
  const want = String(k.to);
  const gate = (m.portals || []).find((p) => p.to === want || p.id === want || p.map === want || (p.to && (p.to.startsWith(want) || want.startsWith(p.to.split(" Lv")[0]))));
  if (!gate) return 0;
  const dx = gate.x - x, dy = gate.y - y;
  return Math.abs(dx) < Math.abs(dy) * 0.5 ? 0 : Math.sign(dx);
}
/** Where each signpost's words go on screen (CSS pixels, the centre of a line just above the board), for the page to letter crisply. */
const labelOut = [];
export function labels() {
  labelOut.length = 0;
  const ox = cam.ox ?? cam.x, oy = cam.oy ?? cam.y;
  const [mx, my] = G && G.me ? iso(G.me.x, G.me.y) : [0, 0];
  for (const s of signs) {
    // a building's name plate shows only when you are near it (the map window shows them all)
    if (s.near && (Math.abs(s.x - mx) > s.near * 22 || Math.abs(s.y - 30 - my) > s.near * 12)) continue;
    const sx = s.x - ox, sy = s.y - 40 - oy;
    if (sx < -60 || sx > vw + 60 || sy < -20 || sy > vh + 40) continue;
    labelOut.push({ x: sx * Z, y: sy * Z, text: s.label });
  }
  return labelOut;
}
/** Whether the waypoint here has been touched: unknown counts as lit, so a stone never looks dead by mistake. */
export function wpLit() {
  const self = G && G.self;
  const got = self && self.wp;
  // (self.wp: { mapId: bitmask of its stones })
  return !got || typeof got !== "object" || (Array.isArray(got) ? got.includes(map.id) : !!(got[map.id] & 1));
}

// ───────────────────────────── ambient life ─────────────────────────────

/** Drifting motes: pollen in the open, fireflies and leaves under trees, rain in the city, dust underground. */
const amb = [];
const AMB_N = { town: 16, meadow: 24, forest: 26, city: 80, cave: 26, crypt: 18, sewer: 22, abyss: 36, autumn: 40, desert: 30, jungle: 22, mesa: 24, mist: 26 };
function respawn(p, ox, oy, fresh) {
  // (maps-v2 M3 art) sand blowing low across the desert; fireflies and falling leaves in the jungle as in the wood
  const k = map.id === BLOSSOM_MAP ? "petal" : theme === "desert" || theme === "mesa" ? "sand" : theme === "forest" || theme === "jungle" ? (Math.random() < 0.45 ? "fly" : "leaf") : theme === "autumn" || theme === "mist" ? (Math.random() < 0.12 ? "spore" : "leaf") : theme === "city" ? "rain" : theme === "cave" || UG[theme] ? "dust" : "pollen";
  p.k = k;
  p.x = ox - 20 + Math.random() * (vw + 40);
  p.y = k === "rain" && !fresh ? oy - 10 : oy - 10 + Math.random() * (vh + 20);
  p.max = k === "rain" ? 9 : 3 + Math.random() * 4;
  p.life = fresh ? Math.random() * p.max : p.max;
  p.ph = Math.random() * 6.28;
  p.vx = k === "rain" ? -46 : k === "pollen" ? 5 + Math.random() * 9 : k === "leaf" ? -6 - Math.random() * 8 : (Math.random() - 0.5) * 6;
  p.vy = k === "rain" ? 400 + Math.random() * 120 : k === "leaf" ? 9 + Math.random() * 6 : k === "dust" ? -3 - Math.random() * 4 : (Math.random() - 0.5) * 4;
  p.c = k === "leaf" ? (theme === "autumn" ? HUE[Math.random() < 0.9 ? Math.floor(Math.random() * 3) : 3].fall[Math.floor(Math.random() * 3)] : Math.random() < 0.5 ? "#d89a48" : "#7abf52") : null;
  if (k === "spore") { p.vx = (Math.random() - 0.5) * 5; p.vy = -4 - Math.random() * 4; }
  if (k === "sand") { p.vx = 70 + Math.random() * 60; p.vy = 14 + Math.random() * 10; p.max = 1.2 + Math.random() * 1.6; p.life = fresh ? Math.random() * p.max : p.max; }
  if (k === "petal") { p.vx = 9 + Math.random() * 10; p.vy = 6 + Math.random() * 7; }
}
export function drawAmbient(dt, t, ox, oy) {
  const want = map.id === BLOSSOM_MAP ? 30 : AMB_N[theme] || 20;
  while (amb.length < want) { const p = {}; respawn(p, ox, oy, true); amb.push(p); }
  for (const p of amb) {
    p.life -= dt;
    p.x += (p.vx + (p.k === "fly" ? Math.sin(t / 700 + p.ph) * 9 : p.k === "pollen" || p.k === "leaf" ? Math.sin(t / 900 + p.ph) * 5 : 0)) * dt;
    p.y += (p.vy + (p.k === "fly" ? Math.cos(t / 900 + p.ph) * 7 : 0)) * dt;
    const sx = Math.round(p.x - ox), sy = Math.round(p.y - oy);
    if (p.life <= 0 || sx < -30 || sx > vw + 30 || sy > vh + 20 || sy < -30) { respawn(p, ox, oy, false); continue; }
    const fade = Math.min(1, p.life, p.max - p.life) ;
    if (p.k === "rain") { g.globalAlpha = 0.3; g.fillStyle = "#a8c4ff"; g.fillRect(sx, sy, 1, 6); }
    else if (p.k === "fly") { const a = (0.45 + 0.55 * Math.sin(t / 260 + p.ph * 3)) * fade; g.globalAlpha = a * 0.28; g.fillStyle = "#e8ff8a"; g.fillRect(sx - 1, sy - 2, 3, 5); g.fillRect(sx - 2, sy - 1, 5, 3); g.globalAlpha = a; g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); g.fillStyle = "#ffffff"; g.fillRect(sx, sy, 1, 1); }
    else if (p.k === "leaf") { g.globalAlpha = fade * 0.9; g.fillStyle = p.c; g.fillRect(sx, sy, 2, 1); g.fillRect(sx + (Math.sin(t / 300 + p.ph) > 0 ? 1 : 0), sy + 1, 1, 1); }
    else if (p.k === "petal") {
      const sway = Math.round(Math.sin(t / 420 + p.ph) * 5);
      g.globalAlpha = fade * 0.86; g.fillStyle = p.ph < 3 ? "#ffd9df" : "#fff0e7";
      g.fillRect(sx + sway, sy, 2, 2);
      g.fillRect(sx + sway + 2, sy - 1, 1, 1);
    }
    else if (p.k === "sand") { g.globalAlpha = Math.min(1, fade * 3) * 0.7; g.fillStyle = p.ph > 3 ? "#fff0c8" : "#f4d9a0"; g.fillRect(sx, sy + Math.round(Math.sin(t / 180 + p.ph) * 1.5), p.ph > 4.5 ? 3 : 2, 1); }
    else if (p.k === "spore") { const a = (0.5 + 0.5 * Math.sin(t / 400 + p.ph * 3)) * fade; g.globalAlpha = a * 0.35; g.fillStyle = "#b06ad8"; g.fillRect(sx - 1, sy - 1, 3, 3); g.globalAlpha = a; g.fillStyle = "#e0b8ff"; g.fillRect(sx, sy, 1, 1); }
    else if (p.k === "dust") { g.globalAlpha = fade * (theme === "abyss" ? 0.8 : 0.55); g.fillStyle = UG[theme] ? UG[theme].mote : "#bfe8ff"; g.fillRect(sx, sy, 1, theme === "sewer" ? 2 : 1); }
    else { g.globalAlpha = fade * 0.8; g.fillStyle = "#fffbe0"; g.fillRect(sx, sy, 1, 1); if (p.ph > 4) g.fillRect(sx + 1, sy, 1, 1); }
  }
  g.globalAlpha = 1;
}
/** Water never sits still: glints slide across it and foam breathes along the shore. (Iso pixels.) */
function* visibleWater(ox, oy) {
  const left = ox - 20, right = ox + vw + 20, top = oy - 20, bottom = oy + vh;
  for (let y = Math.floor(top / WATER_CELL); y <= Math.floor(bottom / WATER_CELL); y++) {
    for (let x = Math.floor(left / WATER_CELL); x <= Math.floor(right / WATER_CELL); x++) {
      const bin = waterBins.get(waterKey(x, y));
      if (!bin) continue;
      for (const tile of bin) if (tile.X >= left && tile.X <= right && tile.Y >= top && tile.Y <= bottom) yield tile;
    }
  }
}

export function drawWater(t, ox, oy) {
  const beat = Math.floor(t / 520);
  const wet = UG[theme] ? UG[theme].wet : null;
  for (const w of visibleWater(ox, oy)) {
    const ph = (beat + Math.floor(w.h * 8)) % 4, cx = w.X, cy = w.Y + 8;
    g.fillStyle = wet ? wet[2] : "#8accf6";
    g.fillRect(cx - 9 + ph * 3 + Math.floor(w.h * 4), cy - 3, 4, 1);
    g.fillRect(cx + 4 - ph * 2, cy + 2, 3, 1);
    if (ph === 0 && w.h > 0.6) { g.fillStyle = "#ffffff"; g.fillRect(cx - 1 + Math.floor(w.h * 6), cy, 2, 1); }
    if (w.n | w.s | w.w | w.e) {
      // foam along the diamond's open edges: north runs up-right from the top corner, west up-left, and so on
      g.fillStyle = wet ? wet[4] : "#e8f8ff";
      const o = ph % 2;
      const dash = (x0, y0, dx, dy) => { for (const f of [0.18 + o * 0.1, 0.6 - o * 0.08]) g.fillRect(Math.round(x0 + dx * f * 16), Math.round(y0 + dy * f * 8), 3, 1); };
      if (w.n) dash(cx + 1, w.Y + 1, 1, 1);
      if (w.w) dash(cx - 4, w.Y + 1, -1, 1);
      if (w.e) dash(cx + 13, w.Y + 9, -1, 1);
      if (w.s) dash(cx - 2, w.Y + 15, -1, -1);
    }
  }
}

const SUN_WATER = ["#b97960", "#e9aa74", "#ffe8b1"];
let sailboat = null;
function skiff() {
  if (sailboat) return sailboat;
  const [cv, cc] = sheet(66, 56);
  const poly = (color, points) => {
    cc.fillStyle = color;
    cc.beginPath();
    cc.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) cc.lineTo(points[i], points[i + 1]);
    cc.closePath(); cc.fill();
  };
  poly("#395068", [3,45, 15,42, 57,45, 64,49, 48,52, 12,50]);
  poly("#3e2b35", [7,38, 58,38, 50,47, 20,49, 13,45]);
  poly("#ad684e", [13,39, 52,40, 47,44, 22,46, 16,43]);
  poly("#f5c48a", [10,37, 56,38, 54,40, 13,40]);
  cc.fillStyle = "#654143";
  cc.fillRect(34, 4, 2, 35);
  poly("#423b56", [34,4, 33,36, 10,36, 18,27]);
  poly("#e9bc9a", [32,8, 31,34, 14,34, 20,26]);
  poly("#ffddab", [31,11, 28,32, 15,33, 22,23]);
  poly("#59475a", [37,11, 55,35, 37,36]);
  poly("#d39688", [38,16, 52,34, 38,34]);
  cc.fillStyle = "#a94f52";
  cc.fillRect(36, 5, 9, 2);
  sailboat = cv;
  return cv;
}

/** Warm ripple strokes are clipped to visible ocean tiles, with a moored sailboat in the inlet. */
export function drawSunsetSea(t, ox, oy) {
  const camp = camps[0], anchor = camp?.x || 0, y0 = camp?.y || 0;
  const frame = Math.floor(t / 240);
  for (const w of visibleWater(ox, oy)) {
    const distance = Math.abs(w.X - anchor + (w.Y - y0) * 0.21);
    const width = 35 + Math.min(170, Math.abs(w.Y - y0) * 0.36);
    if (distance > width || w.h < 0.29) continue;
    const step = (frame + Math.floor(w.h * 15)) % 5;
    const shade = distance < width * 0.4 && step > 1 ? 2 : step > 1 ? 1 : 0;
    g.fillStyle = SUN_WATER[shade];
    g.globalAlpha = (0.25 + w.h * 0.35) * (1 - distance / width);
    const length = 4 + Math.floor(w.h * 11);
    g.fillRect(Math.round(w.X - length / 2 + step - 2), w.Y + 7 + step % 3, length, 1);
    if (shade === 2) g.fillRect(w.X + 3, w.Y + 10, 3, 1);
  }
  g.globalAlpha = 1;
  const [bx, by] = tI(89.5, 79.5);
  if (bx >= ox - 48 && bx <= ox + vw + 48 && by >= oy && by <= oy + vh + 56) {
    g.drawImage(skiff(), Math.round(bx - 32), Math.round(by - 47 + Math.sin(t / 850)));
  }
}

/** The worlds under the open sky, where day turns to night. */
export const OUTDOOR = new Set(["town", "meadow", "forest", "city", "autumn", "jungle", "coast", "desert", "mesa", "mist"]);
