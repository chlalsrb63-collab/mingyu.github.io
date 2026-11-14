/**
 * Creatures (split from scene2d.js): people and monsters (`makePerson personState drawPerson`),
 * movement life (`stepLife`: bob, lean, stop squash; terrain footsteps `footKind footstep`,
 * afterimage `drawTrail`), `tintWhite`, pets (`petFetch petsNow drawPet`), NPC lines `npcOut`,
 * and the campfire jam (`drawJam seatOf`).
 */

import * as SP from "./sprites.js";
import * as Sw from "./swing.js";
import * as DC from "./decor.js";
import * as Sky from "./sky.js";
import * as Camp from "./camp.js";
import { sAng, DXW, DYW, g, DEG, clamp, P, sheet, G, iso } from "./scene_view.js";
import { UG } from "./scene_ground.js";
import { map, theme, OUTDOOR, camps } from "./scene_map.js";
import { qiBurst, bowSnap, QI_COL, parts, fxCustom, fx } from "./scene_fx.js";

// ───────────────────────────── creatures ─────────────────────────────

export const ents = new Map();
/** Per-entity presentation state: which way it faces, its stride, its weapon's angle. */
export function state(id, key, make) {
  let s = ents.get(id);
  if (!s || s.key !== key) { s = { key, face: 1, walk: 0, ang: null, ...make() }; ents.set(id, s); }
  s.seen = true;
  return s;
}
/** Everything needed to draw one person: their sheet, and the weapon their gear (or class) calls for. */
export function makePerson(look) {
  const wk = SP.weaponKind(look.cls, look.gear);
  return { cls: look.cls, wk, sheet: SP.personSheet(SP.playerLook(look.cls, look.look, look.gear)), weapon: SP.weaponSprite(wk, look.gear), gear: look.gear || {}, h: 0.62 };
}
export function personState(id, look) {
  return state(id, JSON.stringify(look), () => makePerson(look));
}
/** Glow by rarity: none, magic, rare, legendary, set. */
export const RARITY = [null, "#6aa8ff", "#ffd84a", "#ff8a30", "#5fd47a"];

/**
 * Draw a person and the weapon in their hand. Attacks are not frames: the
 * weapon sprite is turned about its grip — swept through an arc, thrust, or
 * levelled and kicked back.
 */
export function drawPerson(s, e, t, dt, x, y) {
  // a brisk, bouncy stride; the feet kick up whatever they walk on (stepLife, below)
  if (e.moving) s.walk += dt * 8;
  const life = e.scr || e.dead ? null : stepLife(s, e, t, dt, x, y);
  // a blow that connects freezes for a beat (`e.hs`), then carries on from where it stopped
  const hs = e.hs && e.atkT <= e.hs.at ? e.hs : null;
  const te = !hs || t < hs.at ? t : t < hs.at + hs.dur ? hs.at : t - hs.dur;
  const atk = (te - e.atkT) / 1000;
  // a whole stroke and the beat it is held after: the time the attacker keeps facing the target
  const strokeT = (SP.HOLD[s.wk] || SP.HOLD.sword).time * ((e.atkN | 0) === 2 ? 1.15 : 1);
  const engaged = !!e.aim && atk > -0.2 && atk < strokeT + 0.35;
  // which way they face on screen: the way they last moved, or the way the server says they turned
  let view;
  if (e.scr) {
    // the title stage still speaks in screen directions: 0 front, 1 left, 2 right, 3 back
    view = e.dir === 3 ? "back" : e.dir === 0 ? "front" : "side";
    if (e.dir === 1) s.face = -1; else if (e.dir === 2) s.face = 1;
    if (engaged) s.face = e.aim[0] < e.x ? -1 : 1;
  } else {
    if (s.lx !== undefined && Math.hypot(e.x - s.lx, e.y - s.ly) > 0.05) { s.fa = sAng(e.x - s.lx, e.y - s.ly); s.ldir = e.dir; }
    else if (s.fa === undefined || e.dir !== s.ldir) { s.fa = sAng(DXW[e.dir | 0], DYW[e.dir | 0]); s.ldir = e.dir; }
    s.lx = e.x; s.ly = e.y;
    let fa = s.fa;
    if (e.sit && e.seatFa !== undefined) fa = e.seatFa;       // on a stump, turned to the fire
    if (engaged && (!e.moving || atk < 0.5) && Math.hypot(e.aim[0] - e.x, e.aim[1] - e.y) > 2) fa = sAng(e.aim[0] - e.x, e.aim[1] - e.y);
    // eight ways on screen: straight down shows the face, the three ways up show the back,
    // and everything else is the three-quarter turn, mirrored for the left
    const sec = ((Math.round(fa / (Math.PI / 4)) % 8) + 8) % 8;
    view = sec === 2 ? "front" : sec >= 5 ? "back" : "side";
    if (sec === 0 || sec === 1 || sec === 7) s.face = 1; else if (sec >= 3 && sec <= 5) s.face = -1;
  }
  const back = view === "back";
  const ang = (dx, dy) => (e.scr ? Math.atan2(dy, dx) : sAng(dx, dy));
  // walking steps foot to foot; standing still breathes, and blinks now and then
  if (s.ph === undefined) s.ph = Math.random() * 4000;
  const F = SP.FRAME;
  let frame = e.dead ? F.stand
    : e.sit ? F.breathe
    : e.moving ? [F.stepA, F.stretch, F.stepB, F.stretch][Math.floor(s.walk) % 4]
    : (t + s.ph) % 3600 < 140 ? F.blink
    : Math.floor((t + s.ph) / 560) % 2 ? F.breathe : F.stand;
  const sg = s.face;
  // the stroke being made, if any (swing.js): poses keyed on a 0–1 clock, the blow landing at Sw.IMPACT
  const hold = SP.HOLD[s.wk] || SP.HOLD.sword;
  const beat = e.atkN | 0, fin = beat === 2, stroke = strokeT;
  const k = atk / stroke, resting = k >= 1, live = !!e.aim && atk >= 0 && !resting && !e.dead;
  const aimS = e.aim ? ang(e.aim[0] - e.x, e.aim[1] - e.y) : sg > 0 ? 0.25 : Math.PI - 0.25;
  const aimYaw = e.aim ? (e.scr ? Sw.groundYaw(e.aim[0] - e.x, e.aim[1] - e.y) : Math.atan2(e.aim[1] - e.y, e.aim[0] - e.x)) : 0;
  const sk = Sw.has(s.wk) ? s.wk : hold.style === "sweep" ? "sword" : hold.style === "stab" ? "spear" : "staff";
  const side = (beat === 1 ? -1 : 1) * sg;             // the second stroke comes back the other way
  const bowy = hold.style === "bow";
  const P = !live ? null : hold.style === "float" ? Sw.bookPose(beat, k) : bowy ? Sw.bowPose(beat, k, side, e.bowUp) : Sw.pose(sk, beat, k, side);
  if (s.t0 !== e.atkT) { s.t0 = e.atkT; s.from = s.ang; s.fromLen = s.len ?? 1; s.fromPush = s.push || 0; s.fromLean = s.lean || 0; }
  // the body rocks back on the wind-up, leans (or steps) into the blow, and settles back after
  if (P) s.lean = P.pre !== undefined ? s.fromLean + (P.lean - s.fromLean) * Sw.eOut(P.pre) : P.lean;
  else s.lean = (s.lean || 0) * Math.max(0, 1 - dt * 7);
  if (s.lean) { x += Math.cos(aimS) * s.lean; y += Math.sin(aimS) * s.lean * 0.75; }
  // the weight shows in the body: crouched on the wind-up and the landing, stretched at full reach
  if (P && P.fr && !e.moving && !e.sit) frame = P.fr === "crouch" ? F.breathe : F.stretch;
  // facing the camera shows the full face; walking sideways turns it three-quarters
  const img = s.sheet[view][frame];
  s.img = img;
  g.fillStyle = "rgba(20,24,50,.26)";
  g.beginPath(); g.ellipse(x, y, 5, 2, 0, 0, 7); g.fill();
  const fl = e.fl | 0;
  // walking: a 1-px hop on the stretched steps; a short squash when they stop or turn
  const hop = life && e.moving && !e.sit && frame === F.stretch ? 1 : 0;
  const body = () => {
    if (life) drawTrail(s, t);
    g.save();
    g.translate(Math.round(x), Math.round(y - hop));
    if (e.dead) { g.rotate(sg * 1.45); g.globalAlpha = 0.6; }
    else if (fl & 64) g.globalAlpha = 0.4;             // slipped away behind a puppet
    else if (fl & 16) g.globalAlpha = 0.55 + 0.25 * Math.sin(t / 40);   // a shadow, blinking about
    const sq = life ? life.sq : 0;
    g.scale(sg * (1 + sq * 0.9), (e.sit && !e.dead ? 0.8 : 1) * (1 - sq));       // sitting: tucked down a little
    // leaning one pixel into the walk: the upper body drawn a pixel ahead of the legs
    const ln = life ? life.lean * sg : 0, cut = SP.FOOT[1] - 6;
    if (ln) { g.drawImage(img, 0, 0, img.width, cut, -SP.FOOT[0] + ln, -SP.FOOT[1], img.width, cut); g.drawImage(img, 0, cut, img.width, img.height - cut, -SP.FOOT[0], -SP.FOOT[1] + cut, img.width, img.height - cut); }
    else g.drawImage(img, -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  };
  if (!s.weapon || e.dead || (fl & 2)) return body();    // (the greatsword is off stuck in the ground)
  const bob = (frame === F.stretch ? -1 : frame === F.breathe ? 1 : 0) - hop;
  const glow = RARITY[s.gear.wq | 0] || (s.gear.we >= 7 ? "#ffffff" : null);
  if (hold.style === "float") {
    // a spellbook hovers open beside its reader, is drawn back to the chest, and darts out to cast
    const out = P ? P.out * hold.push : 0, big = P ? P.big : 1;
    const bx = x + sg * 9 + Math.cos(aimS) * out, by = y - 8 + Math.sin(t / 380 + s.ph) * 1.2 + Math.sin(aimS) * out + bob - (P ? P.lift : 0);
    const book = () => {
      g.save();
      if (P && k > Sw.WIND * 0.8 && k < 0.4) { g.shadowColor = "#fff2b0"; g.shadowBlur = 10; } else if (glow) { g.shadowColor = glow; g.shadowBlur = 5; }
      g.translate(Math.round(bx), Math.round(by)); g.scale(big, big);
      g.drawImage(s.weapon, -16, -16);
      g.restore();
    };
    if (back) { book(); body(); } else { body(); book(); }
    if (live && k >= Sw.IMPACT && k < Sw.IMPACT + 0.2 && s.qiT !== e.atkT) { s.qiT = e.atkT; qiBurst("book", beat, bx, by, aimS, side, 12, glow); }
    return;
  }
  const rest = sg > 0 ? -hold.rest * DEG : Math.PI + hold.rest * DEG;
  if (s.ang === null) { s.ang = rest; s.len = 1; }
  const turn = (a, b, u) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * u; };
  const held = resting && atk < stroke + 0.6;           // poised at the end of the stroke, ready for the next
  let push = 0, len = 1, depth = 0, grow = 0;
  /** A pose → [screen angle, foreshortened length, depth, hand push]. */
  const place = (p) => { const [a, l, d] = Sw.project(aimYaw + p.yaw, p.pitch); return [a, l, d, p.reach]; };
  if (P) {
    let [pa, pl, pd, pp] = place(P);
    // the wind-up starts from wherever the weapon was: at rest, or where the last stroke ended
    // (a bow is not wound up from where it hung: it comes straight onto the aim, raised by s.bw)
    if (P.pre !== undefined && !bowy) { const u = Sw.eOut(P.pre); pa = turn(s.from ?? pa, pa, u); pl = (s.fromLen ?? 1) + (pl - (s.fromLen ?? 1)) * u; pp = s.fromPush + (pp - s.fromPush) * u; }
    s.ang = pa; len = pl; depth = pd; push = pp;
    // through the strike the weapon swells toward the eye
    if (P.strike) grow = Math.sin(clamp((k - Sw.WIND + 0.02) / 0.16, 0, 1) * Math.PI) * hold.grow * (fin ? 1.4 : 1);
    s.endAng = s.ang; s.endLen = len; s.endPush = push; s.endDepth = depth;
  } else if (held) {
    s.ang = s.endAng ?? s.ang; len = s.endLen ?? 1; push = s.endPush ?? 0; depth = s.endDepth ?? 0;
  } else {
    // the run is over: the weapon comes down and is slung again, unhurried
    s.ang = turn(s.ang, rest, Math.min(1, dt * 5));
    len = (s.len ?? 1) + (1 - (s.len ?? 1)) * Math.min(1, dt * 6);
    push = (s.push || 0) * Math.max(0, 1 - dt * 6);
  }
  s.push = push; s.len = len;
  // a greatsword is slung across the back between fights, and comes off it to fight
  s.sl = (s.sl ?? 1) + ((hold.style === "sweep" && resting && !held ? 1 : 0) - (s.sl ?? 1)) * Math.min(1, dt * 8);
  // with no arms, the weapon simply floats at the body's side; a bow's pivot is the drawing hand:
  // at the cheek while shooting (the riser out ahead of it), dropped to the hip at rest
  // (raised at once — a shot has no wind-up to spare — and lowered unhurried)
  if (bowy) s.bw = P ? 1 : (s.bw ?? 0) + ((held ? 1 : 0) - (s.bw ?? 0)) * Math.min(1, dt * 8);
  const hx0 = bowy ? x - sg * 1.5 * (1 - s.bw) + Math.cos(aimS) * 3 * s.bw : x + sg * (7 - 4 * s.sl);
  const hy0 = bowy ? y - 5 - 2 * s.bw + Math.sin(aimS) * 1.5 * s.bw + bob : y - (3 + 2 * s.sl) + bob;
  const hx = hx0 + Math.cos(s.ang) * push * len, hy = hy0 + Math.sin(s.ang) * push * len;
  const long = Sw.bladeLen(s.weapon, SP.GRIP);
  // the bow at this moment of its shot: the string's pull and whether an arrow is on it
  const bs = bowy ? P || (held ? Sw.BOW_READY : null) : null;
  const wimg = bowy ? SP.bowSprite(s.gear, bs ? bs.pull : 0, bs ? bs.arrow : false) : s.weapon;
  const weapon = () => {
    // the smear: the band the blade's outer half swept through in the last few hundredths of a
    // second, sampled along the stroke itself so it bends with the arc as the view shows it
    if (P && P.strike && grow > 0.05) {
      const pts = [], inner = [], span = 0.07 / stroke;
      for (let j = 0; j <= 6; j++) {
        const kk = Math.max(Sw.WIND, k - (span * j) / 6);
        const q = Sw.pose(sk, beat, kk, side);
        if (!q) continue;
        const [a, l, , r] = place(q), L = long * Math.max(0.45, l) * (1 + grow);
        const ox = hx0 + Math.cos(a) * r * l, oy = hy0 + Math.sin(a) * r * l;
        pts.push([ox + Math.cos(a) * L, oy + Math.sin(a) * L]);
        inner.push([ox + Math.cos(a) * L * 0.62, oy + Math.sin(a) * L * 0.62]);
      }
      if (pts.length > 2) {
        g.save();
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i][0], inner[i][1]);
        g.closePath();
        g.globalAlpha = 0.4; g.fillStyle = glow || "#dfe8ff"; g.fill();   // faint: the burst of qi at the snap carries the stroke
        g.globalAlpha = 0.9; g.strokeStyle = "#ffffff"; g.lineWidth = 1;
        g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
        g.restore();
      }
    }
    g.save();
    g.translate(Math.round(hx), Math.round(hy));
    g.rotate(s.ang);
    if (Math.cos(s.ang) < 0) g.scale(1, -1);
    // turned toward or away from the camera, the blade is seen end-on and looks shorter
    g.scale((1 + grow) * Math.max(0.45, len), 1 + grow);
    if (glow) { g.shadowColor = glow; g.shadowBlur = s.gear.we >= 7 ? 9 : 5; }
    g.drawImage(wimg, -SP.GRIP[0], -SP.GRIP[1]);
    g.restore();
    // the finisher's overdraw: the arrowhead catches the light, a four-point glint blinking at full draw
    if (bs && bs.glint && Math.floor(t / 45) % 2 === 0) {
      const tl = (13 + push) * Math.max(0.45, len), gx = Math.round(hx0 + Math.cos(s.ang) * tl), gy = Math.round(hy0 + Math.sin(s.ang) * tl);
      g.fillStyle = "#fff6c0"; g.fillRect(gx - 2, gy, 5, 1); g.fillRect(gx, gy - 2, 1, 5);
      g.fillStyle = "#ffffff"; g.fillRect(gx, gy, 1, 1);
    }
  };
  // a slung greatsword sits behind the body; in a stroke, a blade pointing away from the camera does too
  const behind = resting && !held ? (hold.style === "sweep") !== back : depth < -0.35 || (Math.sin(s.ang) < -0.45 && depth < 0.2);
  if (behind) { weapon(); body(); } else { body(); weapon(); }
  // the blow lands: a burst of sword-qi as big as the weapon, at the snap (once per stroke)
  // (a bow throws no qi: the string snaps, and the arrow is the blow — fx.arrow, from the server's shot)
  if (live && bowy && k >= Sw.IMPACT && k < Sw.IMPACT + 0.2 && s.qiT !== e.atkT) {
    s.qiT = e.atkT;
    bowSnap(hx0 + Math.cos(s.ang) * (7 + push) * len, hy0 + Math.sin(s.ang) * (7 + push) * len, s.ang, fin || !!e.bowUp, glow);
  } else if (live && !bowy && k >= Sw.IMPACT && k < Sw.IMPACT + 0.2 && s.qiT !== e.atkT) {
    s.qiT = e.atkT;
    const [ia, il, , ir] = place(Sw.pose(sk, beat, Sw.IMPACT, side));
    const tipX = hx0 + Math.cos(ia) * (ir * il + long * Math.max(0.45, il)), tipY = hy0 + Math.sin(ia) * (ir * il + long * Math.max(0.45, il));
    qiBurst(s.wk in QI_COL ? s.wk : sk, beat, hold.style === "sweep" || (beat === 1 && hold.style === "stab") ? hx0 : tipX, hold.style === "sweep" || (beat === 1 && hold.style === "stab") ? hy0 : tipY, aimS, side, long + 6, glow);
  }
}

// ── movement life: the stride's bounce, a lean into the walk, a squash when stopping or
// turning, footsteps that kick up the ground underfoot, and an afterimage when running fast

/** What the ground under (wx, wy) gives a footstep: grass, leaf, dirt, stone, water, wet, mud, soft (indoors). */
function footKind(wx, wy) {
  if (!map || !map.g) return "dirt";
  if (theme === "interior") return "soft";
  const row = map.g[Math.floor(wy / 16)], c = row ? row[Math.floor(wx / 16)] : null;   // 16 server units a tile
  if (c === "w" || c === "b") return "water";
  if (c === "j") return "mud";
  if (theme === "sewer" || theme === "abyss") return "wet";
  if (theme === "autumn" && (c === "%" || c === ";" || c === ":" || c === "." || c === ",")) return "leaf";
  if (c === "." || c === "," || c === '"' || c === "t" || c === ":" || c === ";") return UG[theme] ? "stone" : "grass";
  if (c === "p" || c === "s") return "dirt";
  return "stone";
}
const LEAF = ["#e0602a", "#f0a030", "#c83a2a", "#e8c040"];
const WET = { sewer: ["#9ac860", "#cfe8a0"], abyss: ["#e06070", "#ffb0b8"] };
/** One footfall (the sound of your own is client.js soundscape's) at iso pixel (x, y): a puff and bits of whatever the ground is made of. */
function footstep(kind, x, y, fast, wx, wy) {
  const R = Math.random, f = fast ? 1.3 : 1, x0 = wx * P, y0 = wy * P;   // flat effects speak in world pixels
  const puff = (col, n) => { for (let i = 0; i < n; i++) parts.push({ x: x + (R() - 0.5) * 6, y: y - 1, vx: (R() - 0.5) * 20 * f, vy: -6 - R() * 7, life: 0.26 + R() * 0.14, color: col, g: 12, s: i ? 2 : 3 }); };
  const bits = (cols, n, vy, grav, s = 1) => { for (let i = 0; i < n; i++) parts.push({ x: x + (R() - 0.5) * 6, y: y - 1, vx: (R() - 0.5) * 26 * f, vy: -vy * (0.7 + R() * 0.5), life: 0.28 + R() * 0.14, color: cols[(R() * cols.length) | 0], g: grav, s }); };
  const ripple = (col) => fxCustom((q, k) => { q.globalAlpha = 1 - k; q.strokeStyle = col; q.lineWidth = 1.5; q.beginPath(); q.ellipse(x0, y0, 3 + k * 9, 3 + k * 9, 0, 0, 7); q.stroke(); }, 420, true);
  if (kind === "grass") { puff("#e8e0c0", 1 + (R() < 0.5)); bits(["#2f7a34", "#b8f080", "#8ad86a"], 2, 30, 170); }
  else if (kind === "leaf") { puff("#d8b888", 1); bits(LEAF, 2, 26, 90, R() < 0.5 ? 2 : 1); }
  else if (kind === "dirt") puff(R() < 0.5 ? "#d8c08a" : "#c8ac78", 2);
  else if (kind === "stone") puff(UG[theme] ? "#a8a4b0" : "#d0ccc4", 2);
  else if (kind === "water" || kind === "wet" || kind === "mud") {
    const cols = kind === "mud" ? ["#8a6a48", "#b0906a"] : WET[theme] || ["#cfeaff", "#9fd0f0", "#ffffff"];
    bits(cols, 3, 40, 260);
    ripple(kind === "mud" ? "rgba(120,90,60,.7)" : kind === "wet" && WET[theme] ? WET[theme][1] : "rgba(225,245,255,.85)");
  } else if (kind === "soft" && R() < 0.5) parts.push({ x, y: y - 1, vx: (R() - 0.5) * 8, vy: -5, life: 0.25, color: "#c8b8a0", g: 0, s: 1 });
}
/** Per frame, for anyone standing in the world: how they lean and squash, and their footfalls. */
function stepLife(s, e, t, dt, x, y) {
  const out = { lean: 0, sq: 0 };
  if (s.mx !== undefined && dt > 0) {
    const dx = e.x - s.mx, dy = e.y - s.my, v = Math.hypot(dx, dy) / dt;
    if (v < 900) s.v = (s.v || 0) * 0.75 + v * 0.25;          // (a warp is not a run)
    const sdx = dx - dy;                                       // across the screen
    if (e.moving && Math.abs(sdx) > 0.05) {
      const d = sdx > 0 ? 1 : -1;
      if (s.sdir && s.sdir !== d) s.landT = t;                 // turned round: a quick squash
      s.sdir = d;
    }
    if (s.wasMv && !e.moving) s.landT = t;                     // stopped: the weight lands
  }
  s.mx = e.x; s.my = e.y; s.wasMv = e.moving;
  if (e.sit) return out;
  const fast = (s.v || 0) > 62;                                // hasted (×1.4), or dashing
  if (e.moving) {
    out.lean = s.sdir || 0;
    const st = Math.floor(s.walk * (fast ? 2 : 1));
    if (st !== s.step) {
      if (s.step !== undefined && st % 2 === 0) {
        footstep(footKind(e.x, e.y), x + (st % 4 ? 2 : -2), y, fast, e.x, e.y);
      }
      s.step = st;
    }
  }
  const q = (t - (s.landT || -1e9)) / 120;
  if (q >= 0 && q < 1) out.sq = 0.12 * (1 - q) * (1 - q);
  // running fast leaves a faint afterimage behind
  if (fast && e.moving && s.img && t - (s.trailT || 0) > 45) {
    s.trailT = t;
    (s.trail ||= []).push({ img: s.img, x: Math.round(x), y: Math.round(y), face: s.face, t0: t });
  }
  return out;
}
/** The afterimages, fading over 180 ms, drawn just before the body. */
function drawTrail(s, t) {
  if (!s.trail || !s.trail.length) return;
  s.trail = s.trail.filter((a) => t - a.t0 < 180);
  for (const a of s.trail) {
    g.save();
    g.globalAlpha = 0.28 * (1 - (t - a.t0) / 180);
    g.translate(a.x, a.y); g.scale(a.face, 1);
    g.drawImage(tintWhite(a.img, "#bfe0ff"), -SP.FOOT[0], -SP.FOOT[1]);
    g.restore();
  }
}
/** A one-colour silhouette of a sprite (afterimages, hit flashes), cached per sprite and colour. */
const silCache = new WeakMap();
export function tintWhite(img, col = "#ffffff") {
  let m = silCache.get(img);
  if (!m) { m = new Map(); silCache.set(img, m); }
  let c = m.get(col);
  if (c) return c;
  let x;
  [c, x] = sheet(img.width, img.height);
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = col; x.fillRect(0, 0, img.width, img.height);
  m.set(col, c);
  return c;
}

// ───────────────────────────── pets ─────────────────────────────
// A pet trots a little behind its owner, on the side away from where they face,
// and darts out to whatever it fetches (메이플 펫처럼 따라다니며 줍는다).
const pets = new Map();
/** The pet of `eid` runs to (wx, wy) and back: called when the server says it picked something up. */
export function petFetch(eid, wx, wy) {
  const pt = pets.get(eid);
  if (pt) { pt.go = { x: wx, y: wy, t0: performance.now() }; }
  fx.sparkle(wx, wy, 0.3, "#fff0a0", 6);
}
export function petsNow(dt, t) {
  const out = [];
  const owners = [[G.you, G.me]];
  for (const [eid, p] of G.players) owners.push([eid, p]);
  const live = new Set();
  for (const [eid, p] of owners) {
    const w = G.who.get(eid);
    if (!w || !w.pet || p.dead) continue;
    live.add(eid);
    let pt = pets.get(eid);
    const face = p.dir === 1 ? -1 : p.dir === 2 ? 1 : 0, back = p.dir === 3 ? 1 : p.dir === 0 ? -1 : 0;
    const hx = p.x - face * 13 + (face ? 0 : 10), hy = p.y + 2 - back * 8;
    if (!pt || pt.kind !== w.pet) { pt = { kind: w.pet, x: hx, y: hy, face: 1, px: hx, id: eid }; pets.set(eid, pt); }
    let tx = hx, ty = hy, k = 4;
    if (pt.go) {
      const a = (t - pt.go.t0) / 1000;
      if (a < 0.16) { tx = pt.go.x; ty = pt.go.y; k = 18; } else if (a > 0.5) pt.go = null;
    }
    pt.x += (tx - pt.x) * Math.min(1, dt * k);
    pt.y += (ty - pt.y) * Math.min(1, dt * k);
    const sdx = (pt.x - pt.px) - (pt.y - (pt.py ?? pt.y));
    if (sdx > 0.05) pt.face = 1; else if (sdx < -0.05) pt.face = -1;
    pt.moving = Math.abs(pt.x - pt.px) + Math.abs(pt.y - pt.py || 0) > 0.03;
    pt.px = pt.x; pt.py = pt.y;
    out.push(pt);
  }
  for (const id of pets.keys()) if (!live.has(id)) pets.delete(id);
  return out;
}
export function drawPet(pt, t) {
  const frames = SP.petSheet(pt.kind), hover = SP.PET_HOVER[pt.kind] || 0;
  const [ix, iy] = iso(pt.x, pt.y), x = Math.round(ix), y = Math.round(iy);
  // walkers hop when they move, flyers flap and bob all the time
  const fr = hover ? Math.floor(t / 140 + pt.id) % 2 : pt.moving ? Math.floor(t / 120) % 2 : Math.floor(t / 900) % 6 === 0 ? 1 : 0;
  const lift = hover ? hover + Math.round(Math.sin(t / 260 + pt.id) * 2) : 0;
  g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(x, y, hover ? 5 : 6, 2, 0, 0, 7); g.fill();
  if (pt.kind === "pet_wisp") { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.35; g.drawImage(DC.glow("#5ad0ff", 20), x - 20, y - lift - 30); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; if (Math.random() < 0.15) parts.push({ x: x - 3 + Math.random() * 6, y: y - lift - 16, vx: 0, vy: -16, life: 0.5, color: "#bfeaff", g: 0, s: 1 }); }
  g.save();
  g.translate(x, y - lift);
  g.scale(pt.face, 1);
  g.drawImage(frames[fr], -SP.FOOT[0], -SP.FOOT[1]);
  g.restore();
}

// ───────────────────────────── night folk and the fire's company ─────────────────────────────

/** Townsfolk who come out only at night (the storyteller) are about only after dark. */
export const npcOut = (n) => !n.night || (map && OUTDOOR.has(theme) && Sky.nightK() > 0.5);
/** A song on the lute (strummed, notes rising) or a cup raised to the fire, over a seated figure. */
export function drawJam(j, s, t, x, y) {
  const k = (t - j.t0) / 2600, face = s.face || 1;
  if (j.k === 0) {
    const strum = Math.floor(t / 120) % 2;
    g.save(); g.translate(Math.round(x + face * 1), Math.round(y - 8 + strum * 0)); g.scale(face, 1);
    g.drawImage(Camp.lute(), -6, -4); g.restore();
    if (strum && Math.random() < 0.25) parts.push({ x: x + face * 4, y: y - 14, vx: face * 6, vy: -20, life: 1.1, color: ["#ffe08a", "#ffb8e0", "#b8e8ff"][Math.floor(Math.random() * 3)], g: 0, s: 2 });
  } else {
    const lift = k < 0.25 ? k / 0.25 : k > 0.8 ? (1 - k) / 0.2 : 1, cx = x + face * 6, cy = y - 10 - lift * 8;
    g.drawImage(Camp.cup(), Math.round(cx - 3), Math.round(cy - 3));
    if (Math.random() < 0.15) parts.push({ x: cx, y: cy - 4, vx: 0, vy: -10, life: 0.8, color: "#f4f0f8", g: 0, s: 1 });
    if (k > 0.3 && k < 0.36) parts.push({ x: cx, y: cy - 6, vx: 0, vy: -26, life: 0.4, color: "#fff4b0", g: 0, s: 2 });
  }
}
/** The stump someone sits on, if they sit on one: the camp it belongs to. */
export function seatOf(e) {
  if (!e.sit) return null;
  for (const c of camps) for (const [sx, sy] of c.seats) if (Math.abs(e.x - sx) < 2 && Math.abs(e.y - sy) < 2) return c;
  return null;
}
