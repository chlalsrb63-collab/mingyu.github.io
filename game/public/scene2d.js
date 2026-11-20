/**
 * The world, seen from the diagonal (a 2:1 quarter view) in chunky pixels.
 *
 * Ground, scenery, creatures and effects are all painted here in one style:
 * flat colours, one shadow tone, and a thick dark outline around everything
 * that stands up. People and monsters come from sprites.js; a weapon is a
 * separate sprite that is rotated around the hand, so an attack is the weapon
 * itself being swung.
 *
 * Units: the server speaks in sixteenths of a tile, on a square grid. The
 * ground is laid out in that square grid first ("world pixels", one tile = 32,
 * one server unit = 2) and then projected onto diamonds: a server point
 * (wx, wy) lands at iso pixel (wx − wy, (wx + wy) / 2), so one tile is a
 * 32×16 diamond and a character (32 px) is about a tile wide. Everything that
 * stands up is drawn upright at its projected foot and painted back to front
 * by wx + wy. The view is scaled by a whole number so every pixel stays square.
 *
 * This file is the renderer's public face (every other module imports `scene2d.js`
 * and nothing else) and the frame itself: lighting after dark, `render`, `impactMs`,
 * the townsfolk hook-up. The rest lives beside it, each part re-exported below:
 *   scene_view.js    projection, canvas/zoom, camera, client state G (`sync`), drawing tools, `project pick`
 *   scene_props.js   scenery sprites (`scenery`, `autumnScenery`), wall pieces
 *   scene_ground.js  ground materials and bake, per-frame ground (chunks, pulses, lazy walls), skirt
 *   scene_map.js     the loaded map's state and `loadMap`, blocks, signs/labels, ambient life
 *   scene_people.js  people, monsters, movement life, footsteps, pets, the fire's jam
 *   scene_fx.js      particles, effects `fx` `big` `shake`, sword-qi, bow arrows, `drawFx`, the aim arrow
 *   scene_stage.js   the title/creation stage and `figure`/`drawFigure`
 * Shared state is plain live bindings: each `let` is assigned only in the module that declares
 * it (others call its setter: `setCtx setMap setShake setFxClock setLazyLeft`).
 */

// (all of the renderer's outside imports, first and in their old order: the order modules first run)
import * as SP from "./sprites.js";
import * as Sw from "./swing.js";
import * as DC from "./decor.js";
import * as IT from "./isotiles.js";
import * as Art from "./art.js";
import * as MA from "./mobart.js";
import * as Sky from "./sky.js";
import * as Camp from "./camp.js";
import { HUE, hueAt } from "./autumn.js";
import * as IN from "./iso_interior.js";
import * as DimArt from "./dimart.js";
import { icon as uiIcon } from "./uiicons.js";
import * as TF from "./townfolk.js";
import * as NPC from "./npclife.js";
import { g, vw, vh, G, iso, tI, K, clamp, cam, FLAT, T, playerLook, sAng, P, sheet, setWorldTransform } from "./scene_view.js";
import { drawSkirt, drawGround, drawLayer, drawPulseParts, lazyLeft, lazyTall } from "./scene_ground.js";
import { wpLit, lights, map, ground, theme, artGround, drawWater, drawSunsetSea, pulseCv, pulseParts, falls, smokers, statics, npcs, OUTDOOR, emit, strings, critters, roomL, drawAmbient, camps } from "./scene_map.js";
import { npcOut, npcService, petsNow, ents, RARITY, state, tintWhite, brightOf, glowOf, drawPet, personState, makePerson, seatOf, drawPerson, drawJam } from "./scene_people.js";
import { parts, setShake, shakeAmt, kick, setFxClock, drawFx, fxFade, drawAimArrow, props, TRAIT_TINT, hooks, glows, drawEyeGlint, drawTraitAura, drawDropFx } from "./scene_fx.js";
import { drawDepthGround, depthSprite } from "./scene_depth.js";
import { frame as postFx } from "./postfx.js";

// ───────────────────────────── the frame ─────────────────────────────

let depthEffects = true;
export function setDepthEffects(on) { depthEffects = !!on; }

/** A waypoint's rune: lit and breathing once touched, dark until then. */
function drawRune(st, dx, dy, t) {
  if (!wpLit()) return;
  const D = DC.sprites(), k = 0.5 + 0.5 * Math.sin(t / 520 + st.ph);
  g.fillStyle = k > 0.7 ? "#e8fbff" : "#7ae0ff";
  for (const [x, y] of D.RUNE) g.fillRect(dx + 2 + x, dy + 2 + y, 1, 1);
  g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.25 + k * 0.3;
  g.drawImage(DC.glow("#5ad0ff", 26), dx + 11 - 26, dy + 18 - 26);
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  if (Math.random() < 0.06) parts.push({ x: st.x - 5 + Math.random() * 10, y: st.y - 20 - Math.random() * 16, vx: (Math.random() - 0.5) * 4, vy: -14, life: 1.1, color: Math.random() < 0.5 ? "#9af0ff" : "#ffffff", g: 0, s: 1 });
}
/**
 * What gives light after dark, on screen: pools on the ground under lamps, in front of lit
 * windows, around runes, landmarks, gates and the spirit tree, and the warm round of every fire.
 */
function fireScale(fire) {
  const main = camps[0];
  return map.id === Sky.SUNSET_BEACH && main?.wx === fire.x && main.wy === fire.y ? 2 : 1;
}

function skyLights(t, ox, oy) {
  const out = [];
  for (const st of lights) {
    const sx = st.x - ox, sy = st.y - oy;
    if (sx < -200 || sx > vw + 200 || sy < -60 || sy > vh + 300) continue;
    if (st.wins) {
      // a building's windows, warm behind the panes, and the lamp over its door
      const f = 0.86 + 0.14 * Math.sin(t / 340 + st.ph * 4);
      for (const [x, y] of st.wins) out.push({ x: x - ox, y: y - oy + 4, r: 20, col: "#ffb860", k: 0.6 * f, bloom: 7, by: y - oy });
      for (const [x, y] of st.lamps) out.push({ x: x - ox, y: y - oy + 14, r: 34, col: "#ffd890", k: 0.75, bloom: 9, by: y - oy });
      continue;
    }
    if (st.house) {
      const f = 0.85 + 0.15 * Math.sin(t / 300 + st.ph * 4);
      out.push({ x: sx - 24, y: sy - 4, r: 34, col: "#ffb860", k: 0.75 * f, bloom: 14, by: sy - 34 }, { x: sx + 22, y: sy - 6, r: 30, col: "#ffb860", k: 0.65 * f, bloom: 12, by: sy - 36 });
    } else if (st.spirit) {
      const b = 0.85 + 0.15 * Math.sin(t / 1300);
      out.push({ x: sx, y: sy - 6, r: 104, col: "#4aa8ff", k: 0.85 * b, flat: 1.8 }, { x: sx, y: sy - 70, r: 64, col: "#3a78d8", k: 0.5 * b, flat: 1.3, bloom: 52, by: sy - 76 });
    } else if (st.wp) out.push({ x: sx, y: sy - 4, r: 40, col: "#7ae0ff", k: wpLit() ? 0.9 : 0.35, bloom: 12, by: sy - 22 });
    else if (st.land) out.push({ x: sx, y: sy - 10, r: 70, col: st.glow || "#ffe690", k: 0.7, flat: 1.7 });
    else if (st.neon) out.push({ x: sx, y: sy - 10, r: 64, col: st.neon, k: 0.75 });
    else if (st.glow === "#ffe690") out.push({ x: sx, y: sy - 2, r: 46, col: "#ffd890", k: 0.8, bloom: 14, by: sy - st.sp.height + 10 });
    else if (st.nightGlow) out.push({ x: sx, y: sy - 4, r: 34, col: st.nightGlow, k: 0.7, bloom: 10, by: sy - 30 });
    else if (st.glow) out.push({ x: sx, y: sy - 6, r: 40, col: st.glow, k: 0.7, bloom: 10, by: sy - st.sp.height + 10 });
  }
  for (const f of G.fires ? G.fires.values() : []) {
    const [X, Y] = iso(f.x, f.y), k = 0.9 + 0.1 * Math.sin(t / 70 + f.id) * Math.sin(t / 130);
    const scale = fireScale(f);
    out.push({ x: X - ox, y: Y - oy, r: 108 * scale, col: "#e85a10", k },
      { x: X - ox, y: Y - oy - 2, r: 56 * scale, col: "#ff9a40", k: k * 0.9, bloom: 26 * scale, by: Y - oy - 14 * scale });
  }
  for (const p of map.portals) { const [px, py] = tI(p.x + 0.5, p.y + 0.5); out.push({ x: px - ox, y: py - oy, r: 48, col: "#c8a0ff", k: 0.7 }); }
  // your own feet keep a faint halo, so you never lose yourself in the dark
  if (G.me) { const [mx, my] = iso(G.me.x, G.me.y); out.push({ x: mx - ox, y: my - oy - 4, r: 30, col: "#8a96c8", k: 0.4 }); }
  return out;
}

/** What shines by its own light at night is laid on again over the grade: the spirit tree's crown, the flames. */
function glowAfterDark(n, t, ox, oy) {
  g.save();
  setWorldTransform(1, 0, 0, 1, -ox, -oy);
  g.globalCompositeOperation = "screen";
  for (const st of lights) {
    if (!st.spirit || st.dx - ox > vw || st.dx + st.sp.width - ox < 0) continue;
    g.globalAlpha = n * (0.42 + 0.08 * Math.sin(t / 1300));
    g.drawImage(st.sp, st.dx, st.dy);
  }
  for (const f of G.fires ? G.fires.values() : []) {
    const [X, Y] = iso(f.x, f.y), fr = SP.campfire()[Math.floor(t / 140 + f.id) % 3];
    g.globalAlpha = n * 0.75;
    g.drawImage(fr, Math.round(X - SP.FOOT[0]), Math.round(Y - SP.FOOT[1] + 2));
  }
  for (const fn of glows) fn(g);
  // the pot still hangs in front of the flame, lit by it
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  for (const st of lights) if (st.pot) g.drawImage(Math.floor(t / 380) % 3 === 0 ? st.sp1 : st.sp, st.dx, st.dy);
  g.restore();
}

/** How dark each world is, and the colour of its darkness. */
const DARK = { forest: ["#06242a", 0.1], city: ["#0a0e30", 0.18], cave: ["#060a22", 0.17], crypt: ["#0a0810", 0.2], sewer: ["#04100a", 0.17], abyss: ["#1e0208", 0.16] };
/** What lies beyond the edge of the map, and the earth its edge is cut from. */
const VOID = { interior: "#120c0a", cave: "#05060e", crypt: "#060508", sewer: "#040806", abyss: "#0c0204", city: "#07080e" };
let lightCv = null, lg = null;
// the townsfolk read the sky clock and wear heroes' looks; their bubbles are lettered by the page (client.js)
TF.init({ hour: () => Sky.hour(), dayMs: () => (G && G.defs && G.defs.sky && G.defs.sky.dayMs) || 48 * 60000, sheet: (look, cos) => SP.personSheet(SP.playerLook(null, look, cos ? { cos } : {})) });
export function townBubbles(t) {
  const bubbles = [];
  const server = Sky.serverNow(), turn = Math.floor(server / 5000), t0 = t - server % 5000;
  for (const { a, b, kind, chat } of NPC.relationships()) {
    const first = NPC.at(a, server), second = NPC.at(b, server);
    if (!first || !second || first.moving || second.moving || Math.hypot(first.x - second.x, first.y - second.y) > 33) continue;
    if (!chat.length && kind !== "crush") continue;
    const line = kind === "crush" ? "…" : chat[turn % chat.length];
    const speaker = line.startsWith("b:") ? second : first;
    if (Math.hypot(speaker.x - G.me.x, speaker.y - G.me.y) > 9 * 16 || t >= t0 + 4400) continue;
    bubbles.push({ x: speaker.x, y: speaker.y, b: { text: line.replace(/^[ab]:\s*/, ""), t0, until: t0 + 4400 } });
    if (bubbles.length >= 3) return bubbles;
  }
  return bubbles.concat(TF.bubbles(t).filter((b) => !NPC.cast(b.id)).slice(0, 3 - bubbles.length));
}

const NPC_DIR = ["front", "left", "right", "back"];
const NPC_STEP = [SP.FRAME.stepA, SP.FRAME.stretch, SP.FRAME.stepB, SP.FRAME.stretch];
const NPC_WORK_POSE = { smith: "hammer", craft: "hammer", cook: "stir", alch: "stir" };

/** A scheduled resident shares the same frames, feet and idle props as the town's static cast. */
function residentFrame(r, t, animate) {
  const dir = NPC_DIR[r.dir] || "front", role = r.post?.role || r.role;
  const s = state("res:" + r.id, r.id, () => {
    if (r.resident) return { sheet: SP.personSheet(SP.playerLook(null, r.look, { cos: r.cos })) };
    if (r.cos?.length && Array.isArray(r.look) && r.look.length >= 8 && r.id !== "town_charm_juana") {
      return { sheet: SP.personSheet(SP.playerLook(null, r.look, { cos: r.cos })) };
    }
    return { sheet: SP.npcSheet({ id: r.id, look: r.look, role }) };
  });
  const nt = t + r.index * 257;
  const pose = r.pose || (!r.moving && r.act === "work" && NPC_WORK_POSE[role]);
  const frame = !animate ? SP.FRAME.stand
    : r.moving ? NPC_STEP[Math.floor(nt / 100) % NPC_STEP.length]
    : pose === "doze" || nt % 3900 < 140 ? SP.FRAME.blink
    : Math.floor(nt / 620) % 2 ? SP.FRAME.breathe : SP.FRAME.stand;
  return { sheet: s.sheet, dir, pose: animate && pose, frame, seed: r.index, fade: r.fade };
}
/** Milliseconds from the start of a stroke to the moment its blade crosses the target. */
export function impactMs(wk, beat) {
  if (wk === "hammer") return Sw.HAMMER_IMPACT;
  const hold = SP.HOLD[wk] || SP.HOLD.sword;
  return hold.time * (beat === 2 ? 1.15 : 1) * 1000 * Sw.IMPACT;
}

let lastRender = 0;
/** The most sparks alive at once (the oldest go first): a screen-wide fight with elemental hits used to grow this without bound. */
const PARTS_MAX = 1400;
export function render(focusX, focusY, dt, t, snap) {
  if (!map || !ground || !G) return;
  // back from a hidden tab: the sparks every hit pushed meanwhile (none lives 3 s) would all burst at once
  if (t - lastRender > 5000) parts.length = 0;
  else if (parts.length > PARTS_MAX) parts.splice(0, parts.length - PARTS_MAX);
  lastRender = t;
  const [fX, fY] = iso(focusX, focusY);
  const minX = -map.h * 16 * K, maxX = map.w * 16 * K, maxY = (map.w + map.h) * 8 * K;
  // the view follows you, but never wanders far past the corners of the map's diamond
  let tx = fX - vw / 2, ty = fY - 14 - vh / 2;
  tx = maxX - minX > vw ? clamp(tx, minX - 24, maxX - vw + 24) : (minX + maxX - vw) / 2;
  ty = maxY > vh ? clamp(ty, -60, maxY - vh + 40) : (maxY - vh) / 2;
  if (snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * Math.min(1, dt * 10); cam.y += (ty - cam.y) * Math.min(1, dt * 10); }
  setShake(Math.max(0, shakeAmt - dt * 18));
  // a directional kick (crits, big skills) swings along the blow and dies in a few swings
  kick.amt = Math.max(0, kick.amt - dt * 40);
  const kq = kick.amt * Math.cos(((t - kick.t0) / 1000) * 2 * Math.PI * 18);
  const ox = Math.round(cam.x + (Math.random() - 0.5) * shakeAmt + kick.x * kq), oy = Math.round(cam.y + (Math.random() - 0.5) * shakeAmt + kick.y * kq);
  setFxClock(t);
  const now = t;
  const sunset = map.id === Sky.SUNSET_BEACH;
  const hour = sunset ? Sky.SUNSET_HOUR : Sky.hour();
  const outdoor = sunset || (OUTDOOR.has(theme) && !map.indoor && Sky.weather() !== -1);
  const night = outdoor ? Sky.nightK(hour) : 0;
  const depth = depthEffects && !map.indoor && theme !== "interior";
  const lightSources = outdoor || depth ? skyLights(t, ox, oy) : null;

  // Cull scenery once. The same anchors cast onto the ground and sort the sprites above it.
  const list = [];
  const X0 = ox - 8, X1 = ox + vw + 8, Y0 = oy - 8, Y1 = oy + vh + 8;
  const on = (X, Y, up = 80) => X > X0 - 48 && X < X1 + 48 && Y > Y0 && Y - up < Y1;
  if (lazyLeft) lazyTall(X0, X1, Y0, Y1);
  for (const st of statics) {
    const sp = st.sp;
    if (!sp || st.dx > X1 || st.dx + sp.width < X0 || st.dy > Y1 || st.dy + sp.height < Y0) continue;
    if (st.slices) { for (const sl of st.slices) if (st.dx + sl.sx < X1 && st.dx + sl.sx + sl.w > X0) list.push({ y: sl.d, s: st, sl }); }
    else list.push({ y: st.d, s: st });
  }

  setWorldTransform();
  g.fillStyle = VOID[theme] || "#0b0d18";
  g.fillRect(0, 0, vw, vh);
  g.translate(-ox, -oy);
  drawSkirt();
  drawGround(artGround ? Math.floor(t / 650) % 2 : 0, ox, oy);
  if (!artGround) drawWater(t, ox, oy);
  if (sunset) drawSunsetSea(t, ox, oy);
  if (pulseCv || pulseParts) {
    const beat = theme === "abyss" ? Math.max(0, Math.sin(t / 260)) ** 3 * 0.6 + Math.max(0, Math.sin(t / 260 - 0.9)) ** 3 * 0.3 : 0.5 + 0.5 * Math.sin(t / 1100);
    g.globalAlpha = 0.25 + beat * 0.6;
    if (pulseCv) drawLayer(pulseCv, map.h * 16 * K, 0, ox, oy); else drawPulseParts(ox, oy);
    g.globalAlpha = 1;
  }
  if (depth) {
    setWorldTransform();
    drawDepthGround(g, {
      width: vw, height: vh, ox, oy, focusY: fY, theme, hour, night: outdoor ? night : DARK[theme] ? 0.8 : 0,
      bounds: [tI(0, 0), tI(map.w, 0), tI(map.w, map.h), tI(0, map.h)], statics: list, sources: lightSources,
    });
  }
  // gates and everything else that lies flat on the ground, drawn through the diamond matrix
  setWorldTransform(...FLAT, -ox, -oy);
  for (const p of map.portals) {
    const px = p.x * T + 16, py = p.y * T + 16;
    if (p.door) {
      // a house door: a mat on the step outside (indoors it is part of the floor) and a warm, breathing light
      if (theme !== "interior") { g.fillStyle = "#5a3a22"; g.fillRect(px - 13, py - 11, 26, 22); g.fillStyle = "#b8925a"; g.fillRect(px - 11, py - 9, 22, 18); g.fillStyle = "#a8824c"; for (let i = -9; i < 9; i += 4) g.fillRect(px - 11, py + i, 22, 2); }
      const k = 0.5 + 0.5 * Math.sin(t / 900 + p.x);
      g.fillStyle = theme === "interior" ? `rgba(255,246,214,${0.1 + k * 0.08})` : `rgba(255,200,120,${0.08 + k * 0.08})`;
      g.beginPath(); g.arc(px, py, 18 + k * 3, 0, 7); g.fill();
      continue;
    }
    for (let i = 0; i < 3; i++) { const ph = (t / 700 + i / 3) % 1; g.strokeStyle = `rgba(${i % 2 ? "170,225,255" : "205,160,255"},${1 - ph})`; g.lineWidth = 4; g.beginPath(); g.arc(px, py, 8 + ph * 20, 0, 7); g.stroke(); }
  }
  g.lineWidth = 1;
  drawFx(now, true);
  setWorldTransform(1, 0, 0, 1, -ox, -oy);
  drawAimArrow(t, dt, false);
  for (const p of map.portals) if (!p.door && Math.random() < 0.2) { const [px, py] = tI(p.x + 0.5, p.y + 0.5); parts.push({ x: px + Math.random() * 24 - 12, y: py + Math.random() * 8 - 4, vx: 0, vy: -40, life: 0.6, color: "#d6b8ff", g: 0 }); }
  DC.drawFalls(g, falls, t, ox, oy, vw, vh);
  for (const s of smokers) if (s.x > ox - 20 && s.x < ox + vw + 20 && s.y > oy - 60 && s.y < oy + vh && Math.random() < 0.07) parts.push({ x: s.x + Math.random() * 4, y: s.y, vx: 5 + Math.random() * 5, vy: -13, life: 1.3 + Math.random(), color: "#eef0f6", g: -5, s: 3 });

  // everything that stands up, painted back to front by how far down the diagonal it stands
  const server = Sky.serverNow();
  for (const n of npcs) {
    if (!on(n.x, n.y)) continue;
    if (NPC.cast(n.n.id)) {
      if (npcService(n.n) && !NPC.at(n.n.id, server)?.onPost) list.push({ y: n.y, X: n.x, Y: n.y, sign: DC.postSign(n.n.role) });
    } else if (npcOut(n.n)) list.push({ y: n.y, X: n.x, Y: n.y, n });
  }
  const add = (wx, wy, o, dy = 0) => { const [X, Y] = iso(wx, wy); if (!on(X, Y, 140)) return; o.X = X; o.Y = Y; o.y = Y + dy; list.push(o); };
  for (const d of G.drops.values()) add(d.x, d.y, { d }, -1);
  if (G.fires) for (const f of G.fires.values()) add(f.x, f.y, { f });
  if (G.bobs) for (const b of G.bobs.values()) add(b.x, b.y, { b }, -1);
  for (const m of G.mobs.values()) add(m.x, m.y, { m });
  for (const [eid, p] of G.players) add(p.x, p.y, { p, eid });
  add(G.me.x, G.me.y, { p: G.me, eid: G.you, me: true }, 0.01);
  for (const pt of petsNow(dt, t)) add(pt.x, pt.y, { pet: pt }, -1);
  // Ambient residents remain until they have server plans of their own.
  TF.update(dt, G.me, t);
  for (const r of TF.drawables(t)) if (!NPC.cast(r.id)) add(r.x, r.y, { r });
  const residents = NPC.list(server);
  if (residents.length > 24) residents.sort((a, b) => Math.hypot(a.x - focusX, a.y - focusY) - Math.hypot(b.x - focusX, b.y - focusY));
  residents.forEach((r, i) => add(r.x, r.y, { resident: r, animate: i < 24 }));
  for (const [id, pr] of props) { if (t >= pr.until) props.delete(id); else add(pr.x, pr.y, { pr }, -(pr.lift || 0)); }
  list.sort((a, b) => a.y - b.y);
  for (const s of ents.values()) s.seen = false;

  const [meX, meY] = iso(G.me.x, G.me.y);
  let hidden = false, meDrawn = false;
  for (const o of list) {
    if (o.s) {
      const st = o.s, sl = o.sl;
      let sp = st.sp, dx = st.dx, dy = st.dy;
      if (st.frames) { const n = st.frames.length; sp = st.frames[((Math.floor(t / (st.frameMs || 420) + st.x / 37) % n) + n) % n]; }
      if (st.pot) {
        if (Math.floor(t / 380) % 3 === 0) sp = st.sp1;
        if (Math.random() < 0.18) parts.push({ x: st.x - 3 + Math.random() * 6, y: st.dy + 9, vx: 3 + Math.random() * 4, vy: -12 - Math.random() * 6, life: 1 + Math.random() * 0.6, color: Math.random() < 0.5 ? "#f4f0f8" : "#d8d4e4", g: -4, s: 2 });
      }
      // walls just in front of you are cut down to their stumps, Diablo-style, so a corridor never swallows you
      if (st.cut && meDrawn) {
        const ex = (st.x - meX) / 72, ey = (st.d - meY) / 40;
        if (ey > 0 && ex * ex + ey * ey < 1) { const lo = st.cut.low; if (lo) { sp = lo.img; dx = st.tx + lo.dx; dy = st.ty + lo.dy; } }
      }
      // anything else in front of you that covers you turns see-through
      const ax = sl ? dx + sl.sx : dx, aw = sl ? sl.w : sp.width;
      if (meDrawn && !st.cut && sp.height > 20 && ax < meX + 8 && ax + aw > meX - 8 && dy < meY - 4 && dy + sp.height > meY - 26 && !G.me.dead) { g.globalAlpha = 0.48; hidden = true; }
      if (depth && g.globalAlpha === 1 && !st.cut && (st.depthFoliage || st.depthBuilding || st.house)) {
        sp = depthSprite(g, sp, st, { y: st.d ?? o.y, focusY: fY, height: vh, theme, night });
      }
      if (sl) g.drawImage(sp, sl.sx, 0, sl.w, sp.height, ax, dy, sl.w, sp.height);
      else g.drawImage(sp, dx, dy);
      g.globalAlpha = 1;
      if (sl && sl.sx !== 0) continue;           // what goes on a big sprite goes on once
      // a crystal that catches the light, a waypoint's rune, a landmark's glow, a fountain that splashes
      if (st.glint >= 0 && Math.sin(t / 420 + st.glint) > 0.86) { g.fillStyle = "#ffffff"; g.fillRect(dx + 16, dy + 6, 5, 1); g.fillRect(dx + 18, dy + 4, 1, 5); }
      if (st.wp) drawRune(st, dx, dy, t);
      if (st.anim) st.anim(g, t, st.tx, st.ty, parts);
      if (st.land && st.glow) {
        const beat = st.land === "heart" ? Math.max(0, Math.sin(t / 260)) ** 3 + Math.max(0, Math.sin(t / 260 - 0.9)) ** 3 * 0.5 : 0.5 + 0.5 * Math.sin(t / 900 + st.ph);
        const r = st.land === "heart" ? 70 : 44, gy = st.land === "heart" ? dy + 70 : st.land === "board" ? dy + 44 : st.land === "shrine" ? dy + 14 : st.land === "oak" ? dy + 94 : dy + sp.height * 0.45;
        g.globalCompositeOperation = "lighter"; g.globalAlpha = (0.12 + beat * 0.16) * (DARK[theme] ? 1.4 : 1);
        g.drawImage(DC.glow(st.glow, r), Math.round(st.x - r), Math.round(gy - r));
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
        if (st.land === "crystals" && Math.random() < 0.04) parts.push({ x: dx + 10 + Math.random() * (sp.width - 20), y: dy + 20 + Math.random() * 60, vx: 0, vy: -8, life: 1.2, color: "#cffaff", g: 0, s: 1 });
      }
      if (st.water && Math.random() < 0.45) parts.push({ x: st.x - 9 + Math.random() * 18, y: st.y - 50, vx: (Math.random() - 0.5) * 34, vy: -24 - Math.random() * 20, life: 0.55, color: "#dff4ff", g: 170, s: 2 });
    } else if (o.sign) {
      g.drawImage(o.sign, Math.round(o.X - o.sign.width / 2), Math.round(o.Y + 2 - o.sign.height));
    } else if (o.resident?.weapon) {
      const r = o.resident;
      const s = state("res:" + r.id, r.id, () => ({ ...makePerson(playerLook(null, r.look, { cos: r.cos, wk: r.weapon })), ph: r.index * 257 }));
      g.globalAlpha = r.fade;
      drawPerson(s, { ...r, atkT: -Infinity }, t, dt, o.X, o.Y);
      g.globalAlpha = 1;
    } else if (o.r || o.resident) {
      // a resident: a hero's figure walking or at their task (iso_interior.js poses)
      const r = o.r || residentFrame(o.resident, t, o.animate), X = Math.round(o.X), Y = Math.round(o.Y), side = r.dir === "left" || r.dir === "right";
      const fr = (side ? r.sheet.side : r.sheet[r.dir] || r.sheet.front)[r.pose === "doze" ? SP.FRAME.blink : r.frame];
      if (r.fade < 1) {
        g.fillStyle = "#ffd8a0";
        g.globalAlpha = (1 - r.fade) * 0.62;
        g.fillRect(X - 7, Y - 2, 14, 2);
        g.fillRect(X - 4, Y - 3, 8, 1);
      }
      g.globalAlpha = r.fade ?? 1;
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(X, Y, 6, 3, 0, 0, 7); g.fill();
      if (r.dir === "left") { g.save(); g.translate(X, 0); g.scale(-1, 1); g.drawImage(fr, -SP.FOOT[0], Y - SP.FOOT[1], SP.SIZE, SP.SIZE); g.restore(); }
      else g.drawImage(fr, X - SP.FOOT[0], Y - SP.FOOT[1], SP.SIZE, SP.SIZE);
      if (r.pose) IN.drawPose(g, r.pose, X, Y, t, parts, r.seed);
      g.globalAlpha = 1;
    } else if (o.n) {
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(o.n.x, o.n.y, 6, 3, 0, 0, 7); g.fill();
      const pose = o.n.n.pose, nt = t + o.n.x * 37;
      const nf = pose === "doze" || nt % 3900 < 140 ? SP.FRAME.blink : Math.floor(nt / (pose === "doze" ? 1400 : 620)) % 2 ? SP.FRAME.breathe : SP.FRAME.stand;
      g.drawImage(o.n.sheet.front[nf], Math.round(o.n.x - SP.FOOT[0]), Math.round(o.n.y - SP.FOOT[1]), SP.SIZE, SP.SIZE);
      if (pose) IN.drawPose(g, pose, o.n.x, o.n.y, t, parts, o.n.n.x * 7 + o.n.n.y);
    } else if (o.f && theme === "interior") {
      // indoors the fire burns in the fireplace (iso_interior.js), not on the floor
    } else if (o.f) {
      // a campfire: warm light on the ground, a flickering flame, sparks drifting up
      const x = o.X, y = o.Y, frame = Math.floor(t / 140 + o.f.id) % 3, scale = fireScale(o.f);
      g.fillStyle = "rgba(255,170,60,.15)"; g.beginPath(); g.ellipse(x, y - 2, 30 * scale, 15 * scale, 0, 0, 7); g.fill();
      if (scale > 1) g.drawImage(Camp.bonfire()[frame], Math.round(x - 30), Math.round(y - 60));
      else g.drawImage(SP.campfire()[frame], Math.round(x - SP.FOOT[0]), Math.round(y - SP.FOOT[1] + 2));
      if (Math.random() < 0.12 * scale) parts.push({ x: x + (Math.random() - 0.5) * 6 * scale, y: y - 16 * scale, vx: (Math.random() - 0.5) * 10 * scale, vy: -18 - Math.random() * 14, life: 0.7, color: Math.random() < 0.5 ? "#ffd070" : "#ff9040", g: -10, s: 1 });
    } else if (o.b) {
      // a fishing float riding the water, its line running back to the angler
      const bx = Math.round(o.X), by = Math.round(o.Y + Math.sin(t / 260) * 1.2 + (o.b.bite ? Math.sin(t / 40) * 2 : 0));
      const who = o.b.eid === G.you ? G.me : G.players.get(o.b.eid);
      g.lineWidth = 1;
      if (who) { const [wx2, wy2] = iso(who.x, who.y); g.strokeStyle = "rgba(240,240,255,.6)"; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(Math.round(wx2) + 4, Math.round(wy2) - 12); g.stroke(); }
      g.strokeStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(bx, by + 1, 4 + ((t / 200) % 3), 2, 0, 0, 7); g.stroke();
      g.fillStyle = "#2b2233"; g.fillRect(bx - 2, by - 4, 4, 5); g.fillStyle = "#ffffff"; g.fillRect(bx - 1, by - 3, 2, 1); g.fillStyle = "#e84a5a"; g.fillRect(bx - 1, by - 2, 2, 2);
    } else if (o.d) {
      const d = o.d, x = o.X, y = o.Y, ic = G.icons.cv[d.it];
      drawDropFx(g, d, x, y, t, parts, ic, RARITY);
    } else if (o.m) {
      const m = o.m, kind = G.defs.mobs[m.k].sp, x = o.X, y = o.Y, el = m.el | 0;
      // an elite wears the colour of its first trait; a recoloured kind wears its own
      const tint = (m.tr && TRAIT_TINT[m.tr[0]]) || G.defs.mobs[m.k].tint || null;
      // the quarter-view cast: four facings and a pose for every moment (mobart.js)
      if (MA.has(kind)) {
        const ms = state("m" + m.id, "q", () => ({})), md = G.defs.mobs[m.k];
        MA.draw(g, m, md, tint, ms, t, x, y, parts, G);
        const hPx = (m.h3 || 1.3) * 26, span = Math.max(10, hPx * 0.36);
        if (el && m.tr?.length) drawTraitAura(g, m, t, x, y, span, hPx, parts);
        const a = t - m.atkT, w = m.windT ? t - m.windT : 1e9, windMs = m.windMs || 0;
        if (!md.chest && (w < windMs || (a >= 0 && a < 160))) {
          drawEyeGlint(g, x, y, hPx, ms.fx ? 1 : -1, t, w < windMs ? w / Math.max(1, windMs) : a / 160);
        }
        continue;
      }
      const s = state("m" + m.id, kind + ":" + el + ":" + (tint || ""), () => { const z = SP.MOB_SIZE[kind] || [1, 0]; return { frames: SP.monsterSheet(kind, tint), size: z[0] * (el === 2 ? 2 : 1), hover: z[1] * (el === 2 ? 1.5 : 1), px: m.x, py: m.y }; });
      // sprites face left; they turn by which way they move across the screen
      const sdx = (m.x - s.px) - (m.y - (s.py ?? m.y));
      if (sdx > 0.05) s.face = -1; else if (sdx < -0.05) s.face = 1;
      s.px = m.x; s.py = m.y;
      const img = s.frames[Math.floor(t / (m.moving ? 180 : 360) + m.id) % 2], w = SP.SIZE * s.size;
      const a = t - m.atkT, lunge = a < 220 ? Math.sin((a / 220) * Math.PI) * 6 * -s.face : 0;
      g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, w * 0.26, w * 0.13, 0, 0, 7); g.fill();
      if (el) {
        const pulse = 0.55 + 0.3 * Math.sin(t / 160 + m.id);
        g.strokeStyle = el === 2 ? `rgba(255,110,214,${pulse})` : `rgba(255,196,64,${pulse})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x, y, w * 0.32, w * 0.16, 0, 0, 7); g.stroke();
        if (el === 2) { g.strokeStyle = `rgba(138,232,248,${pulse * 0.8})`; g.beginPath(); g.ellipse(x, y, w * 0.4 + Math.sin(t / 240) * 2, w * 0.2, 0, 0, 7); g.stroke(); }
        if (Math.random() < (el === 2 ? 0.3 : 0.1)) parts.push({ x: x + (Math.random() - 0.5) * w * 0.5, y: y - Math.random() * w * 0.4, vx: 0, vy: -22, life: 0.5, color: el === 2 ? "#ff8ae0" : "#ffe08a", g: 0, s: 1 });
        drawTraitAura(g, m, t, x, y, w * 0.26, w * 0.72, parts);
      }
      g.save();
      const hk = (t - m.hurtT) / 200, rec = hk < 1 ? (1 - hk) * (1 - hk) : 0;
      const pow = m.hurtP || 1;
      // knocked back along the blow, as the blow looks on screen
      const ha = m.hurtA || 0, hx = Math.cos(ha) - Math.sin(ha), hy = (Math.cos(ha) + Math.sin(ha)) / 2;
      const jx = rec ? hx * rec * 6 * pow + Math.sin(t / 14) * rec * 2 : 0, jy = rec ? hy * rec * 6 * pow : 0;
      g.translate(Math.round(x + lunge + jx), Math.round(y + jy - s.hover - (s.hover ? Math.sin(t / 320 + m.id) * 2 : 0)));
      g.scale(s.face * (1 + rec * 0.24), 1 - rec * 0.2);
      // struck: pure white for the first frames (and through a hitstop), then a bright blink
      const hw = t - m.hurtT, white = hw >= 0 && hw < 36 + (m.hsMs || 0);
      const top = -w * (SP.FOOT[1] / SP.SIZE);
      if (white) g.drawImage(tintWhite(img), -w / 2, top, w, w);
      else if (hw >= 0 && hw < 110) g.drawImage(brightOf(img), -w / 2, top, w, w);
      else if (el) {
        // an elite's glow, its blur kept the size it had on screen when it was a live shadow
        const sc = w / img.width, gi = glowOf(img, el === 2 ? "#ff5ad0" : "#ffc040", Math.max(1, Math.round((el === 2 ? 8 : 4) / sc))), p = gi.pad * sc;
        g.drawImage(gi, -w / 2 - p, top - p, w + p * 2, w + p * 2);
      } else g.drawImage(img, -w / 2, top, w, w);
      g.restore();
      m.h3 = (w * (G.defs.mobs[m.k].boss ? 0.92 : 0.72) + s.hover) / 26;
    } else if (o.pr) {
      g.save(); o.pr.draw(g, t, o.X, o.Y); g.restore();
    } else if (o.pet) {
      drawPet(o.pet, t);
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (!w) continue;
      const s = personState(o.eid, playerLook(w.cls, w.look, w.gear));
      const seat = seatOf(o.p);
      o.p.seatFa = seat ? sAng(seat.wx - o.p.x, seat.wy - o.p.y) : undefined;
      const px = o.X, py = o.Y - (seat ? 3 : 0);
      // a giant grows (and shrinks back) over a quarter of a second
      const gz = o.p.gz = (o.p.gz || 1) + (((o.p.fl | 0) & 1 ? 1.6 : 1) - (o.p.gz || 1)) * Math.min(1, dt * 8);
      if (gz > 1.01) { g.save(); g.translate(px, py); g.scale(gz, gz); g.translate(-px, -py); drawPerson(s, o.p, t, dt, px, py, o.eid); g.restore(); }
      else drawPerson(s, o.p, t, dt, px, py, o.eid);
      const jam = G.jams && G.jams.get(o.eid);
      if (jam && t - jam.t0 < 2600) drawJam(jam, s, t, px, py);
      o.p.h3 = s.h * gz;
      if (o.me) { meDrawn = true; ghost.s = s; ghost.gz = gz; }
    }
  }
  // seen through a wall: a pale ghost of you on top of whatever hides you
  if (hidden && ghost.s && ghost.s.img) {
    const s = ghost.s;
    g.save(); g.globalAlpha = 0.42; g.translate(Math.round(meX), Math.round(meY)); g.scale(s.face * ghost.gz, ghost.gz);
    g.drawImage(s.img, -SP.FOOT[0], -SP.FOOT[1], SP.SIZE, SP.SIZE);
    g.restore();
  }
  for (const [id, s] of ents) if (!s.seen) ents.delete(id);
  setWorldTransform(1, 0, 0, 1, -ox, -oy);
  drawAimArrow(t, dt, true);
  for (const h of hooks) { g.save(); h(g, t, P); g.restore(); }

  drawFx(now, false);
  fxFade(true);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }   // swap-pop: sparks have no order to keep, and splice from the front is O(n) each
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    const sz = p.s || 3;
    // a sleeper's "z", drifting up
    if (p.z) { g.globalAlpha = clamp(p.life, 0, 1); g.fillStyle = p.color; const zx = Math.round(p.x), zy = Math.round(p.y); g.fillRect(zx, zy, 3, 1); g.fillRect(zx + 1, zy + 1, 1, 1); g.fillRect(zx, zy + 2, 3, 1); continue; }
    g.globalAlpha = clamp(p.life * 3, 0, 1); g.fillStyle = p.color; g.fillRect(Math.round(p.x) - (sz >> 1), Math.round(p.y) - (sz >> 1), sz, sz);
  }
  fxFade(false);
  g.globalAlpha = 1;
  DC.drawEmitters(g, emit, t, ox, oy, vw, vh, parts);
  DC.drawStrings(g, strings, t, ox, oy, vw, vh, night);
  setWorldTransform();
  DC.drawCritters(g, critters, dt, t, ox, oy, vw, vh, theme);

  // darkness, with pools of light cut out of it: the same everywhere on screen, never darker at the edges
  const dark = DARK[theme];
  if (dark) {
    if (!lightCv) [lightCv, lg] = sheet(vw, vh);
    if (lightCv.width !== vw || lightCv.height !== vh) { lightCv.width = vw; lightCv.height = vh; }
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, vw, vh);
    lg.globalAlpha = dark[1]; lg.fillStyle = dark[0]; lg.fillRect(0, 0, vw, vh); lg.globalAlpha = 1;
    lg.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k = 1) => { const sx = x - ox, sy = y - oy; if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) return; const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = gr; lg.fillRect(sx - r, sy - r, r * 2, r * 2); };
    for (const o of list) {
      if (o.sl && o.sl.sx !== 0) continue;
      if (o.f) hole(o.X, o.Y - 8, 120, 0.95);
      else if (o.s && o.s.wp) hole(o.s.x, o.s.y - 22, 70, wpLit() ? 0.85 : 0.3);
      else if (o.s && o.s.glow) hole(o.s.x, o.s.y - (o.s.big ? 60 : o.s.sp.height - 12), o.s.big ? 120 : o.s.glow === "#ffe690" ? 110 : 60, 0.85);
      else if (o.d && o.d.q) hole(o.X, o.Y - 10, 36, 0.7);
      else if (o.m && SP.MOB_GLOW[G.defs.mobs[o.m.k].sp]) hole(o.X, o.Y - 14, o.m.el === 2 ? 90 : 48, 0.75);
    }
    for (const p of map.portals) { const [px, py] = tI(p.x + 0.5, p.y + 0.5); hole(px, py, 80, 0.8); }
    g.drawImage(lightCv, 0, 0);
  }
  // indoors: warm lamplight and the fire, sunlight through the windows by day (iso_interior.js)
  if (theme === "interior") { IN.roomLight(g, roomL, t, dt, ox, oy, vw, vh, Sky.nightK()); postFx(g, vw, vh, t, dt, fY - oy, ox, theme, Sky.nightK(), false); cam.ox = ox; cam.oy = oy; return; }
  // outdoors the day turns: the whole view graded by the hour and the weather (one even multiply,
  // never darker at the edges), with lamps, windows, runes and fires cut into the night as pools
  const L = outdoor ? Sky.grade(g, vw, vh, dt, t, lightSources, sunset ? null : Sky.cloudPainter(ox, oy, t), sunset ? hour : undefined) : null;
  if (L && L.night > 0.05) glowAfterDark(L.night, t, ox, oy);
  drawAmbient(dt, t, ox, oy);
  if (!sunset) Sky.drawWeather(g, vw, vh, dt, t, ox, oy, outdoor, theme, outdoor ? camps.map((c) => ({ x: c.x - ox, y: c.y - oy })) : [], L);
  postFx(g, vw, vh, t, dt, fY - oy, ox, theme, outdoor ? night : DARK[theme] ? 0.8 : 0, outdoor, lightSources); // HD-2D depth of field, bloom, shafts, grade (postfx.js)
  cam.ox = ox; cam.oy = oy;
}
/** The local player's last drawn look, for the ghost shown through walls. */
const ghost = { s: null, gz: 1 };

export { iso, sAng, PARTS, playerLook, init, resize, setZoomMul, sync, project, pick, pickPlayer, FIGURE_DENSITY } from "./scene_view.js";
export { loadMap, labels } from "./scene_map.js";
export { tintWhite, petFetch, npcOut, npcService } from "./scene_people.js";
export { props, hooks, personFrame, FOOT, fxCustom, glows, qiBurst, arrowSprite, fx, big, shake, setFxAlpha } from "./scene_fx.js";
export { pulseBoth, groundInfo } from "./scene_ground.js";
export { figure, drawFigure } from "./scene_stage.js";
