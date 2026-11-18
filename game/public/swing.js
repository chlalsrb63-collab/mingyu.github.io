/**
 * How a held weapon moves through a stroke — the basic attack chain and
 * the cast that a skill swings like a finisher — in the quarter view.
 *
 * A stroke is a handful of key poses on a 0 → 1 clock (k = time / stroke time).
 * Each pose says where the blade points on the ground (yaw, relative to the
 * target, mirrored by the beat's side), how far it is raised (pitch), how far
 * the hand is pushed out along the blade (reach), how far the body leans or
 * steps toward the target (lean), how high the grip sits (lift), and which body frame shows the weight
 * (crouch on the wind-up and the landing, stretch at full reach).
 *
 * The blow lands at k = IMPACT (0.2) for these normalized strokes (scene2d's impactMs): the
 * pose keyed there is the one crossing or touching the target. The timing of the
 * wind-up and recovery varies by weapon. The poses are three-dimensional so a
 * level sweep follows the ellipse of the projected ground.
 */

const D = Math.PI / 180;
/** World direction (yaw on the ground, pitch up) → [screen angle, depth toward the camera]. */
export function project(yaw, pitch) {
  const cp = Math.cos(pitch), vx = cp * Math.cos(yaw), vy = cp * Math.sin(yaw), vz = Math.sin(pitch);
  const X = (vx - vy) * Math.SQRT1_2, Y = ((vx + vy) * Math.SQRT1_2) / 2 - vz;
  return [Math.atan2(Y, X), vx + vy];
}
/** A screen direction back onto the ground: its yaw (for the title stage, which speaks in screen terms). */
export function groundYaw(sx, sy) {
  return Math.atan2(2 * sy - sx, sx + 2 * sy);
}

// easing: in (accelerating into the blow), out (slowing after it), both; and the snap's two
// curves: out-expo (most of a sweep happens in its first tenth, then it brakes hard) and
// out-back (the settle overshoots a hair and springs home)
const eIn = (u) => u * u * u;
const eOut = (u) => 1 - (1 - u) ** 3;
const eIO = (u) => u * u * (3 - 2 * u);
const lin = (u) => u;
const oExpo = (u) => (u >= 1 ? 1 : 1 - 2 ** (-10 * u));
const oBack = (u) => { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };

/**
 * Nominal breakpoints on the 0–1 stroke clock. The contact point at IMPACT drives
 * scene2d's impactMs, the sword-qi burst and confirmed hit feedback.
 */
export const WIND = 0.15, IMPACT = 0.2, SNAP = 0.5;

// Body compression, local hitstop and directional camera kick for a confirmed basic hit.
export const MELEE_FEEL = {
  sword: { squash: 0.12, stop: 34, heavyStop: 52, kick: 2.1, heavyKick: 3.6 },
  dagger: { squash: 0.07, stop: 19, heavyStop: 32, kick: 0.7, heavyKick: 1.7 },
  spear: { squash: 0.09, stop: 28, heavyStop: 44, kick: 1.4, heavyKick: 2.8 },
  hammer: { squash: 0.15, stop: 42, heavyStop: 58 },
};
export const MELEE_FX_WEAPON = { 0: "sword", 3: "dagger", 4: "spear", 7: "hammer" };

export const HAMMER_IMPACT = 200, HAMMER_RECOVER = 240;
/** One overhead stroke for every beat, with the head planted at the server's impact time. */
export function hammerPose(ms, impact = HAMMER_IMPACT) {
  const fallMs = Math.min(54, impact * 0.42), plantMs = 76;
  const fallAt = impact - fallMs;
  const rise = eIO(Math.max(0, Math.min(1, ms / Math.max(1, fallAt - 26))));
  const fall = eIn(Math.max(0, Math.min(1, (ms - fallAt) / fallMs)));
  const held = 1 - eIO(Math.max(0, Math.min(1, (ms - impact - plantMs) / (HAMMER_RECOVER - plantMs))));
  const raised = rise * (1 - fall), planted = fall * held;
  const brace = eOut(Math.max(0, Math.min(1, (ms - impact) / 30))) * held;
  return {
    yaw: 0,
    // owner (2026-11-15): raised well over the head before the slam (was pitch 112°, lift 9 px; now 120°, 21 px — the head now rides ~35 % higher)
    pitch: (20 + 100 * raised - 53 * planted) * D,
    reach: -3.5 * raised + 5 * planted,
    lift: 21 * raised - 2 * planted,
    lean: -4.5 * raised + 5 * planted,
    fr: ms >= impact && ms < impact + 112 ? "crouch" : raised > 0.65 ? "stretch" : "",
    squash: brace * MELEE_FEEL.hammer.squash - raised * 0.035,
    strike: false,
  };
}

/** Key poses: [k, yaw°, pitch°, reach px, lean px, frame, ease into this key, grip lift px]. */
const K = (k, yaw, pitch, reach, lean, fr, ease, lift = 0) => ({ k, yaw: yaw * D, pitch: pitch * D, reach, lean, fr: fr || "", ease: ease || lin, lift });
// Each stroke winds up, accelerates through contact, follows through, and settles.
// Thrusts hold full reach for an extra key before the blade is drawn back.
const STROKES = {
  // A descending cut and a low return. Each follows through toward the next wind-up.
  sword: [
    [K(WIND, -108, 39, 0, -3, "crouch", eOut, 3),
      K(IMPACT, 0, 5, 6, 5, "stretch", eIn, 1),
      K(0.38, 112, -16, 4, 5, "crouch", oExpo, -1),
      K(0.57, 116, -14, 3, 3, "", lin, -1), K(1, 105, -8, 2, 0, "", eIO)],
    [K(WIND, -106, -12, 1, -2, "crouch", eOut, -2),
      K(IMPACT, 0, 0, 7, 5, "stretch", eIn),
      K(0.38, 114, 23, 5, 4, "stretch", oExpo, 2),
      K(0.57, 117, 27, 3, 3, "", lin, 2), K(1, 105, 30, 2, 0, "", eIO, 2)],
    [K(0.15, -18, 118, 0, -3, "crouch", eOut), K(0.2, 0, 6, 9, 7, "stretch", lin), K(0.5, 4, -42, 7, 7, "crouch", oExpo), K(0.6, 4, -42, 7, 7, "", lin), K(1, 10, -22, 4, 3, "", oBack)],
  ],
  // Dagger: tucked jab, high backhand across the chest, low finishing lunge.
  dagger: [
    [K(0.11, -26, 29, -3, -1, "crouch", eOut, 3),
      K(IMPACT, 0, 2, 8, 3, "stretch", eIn, 1),
      K(0.29, 3, 0, 7, 2.5, "stretch", eOut, 1),
      K(0.57, 18, 13, 0, -0.7, "crouch", eOut), K(1, 24, 22, 1, 0, "", eIO)],
    [K(0.11, -92, 30, 1, -1.5, "crouch", eOut, 4),
      K(IMPACT, 0, 3, 6, 2, "stretch", lin, 3),
      K(0.39, 88, -13, 5, 1.5, "", oExpo, -1),
      K(0.55, 64, -7, 1, 0.5, "", eOut, -1), K(1, 28, 13, 0, 0, "", eIO)],
    [K(0.11, -18, 19, -5, -2, "crouch", eOut, -1),
      K(IMPACT, 0, -4, 11, 7, "stretch", eIn),
      K(0.43, 1, -5, 10, 6, "stretch", eOut),
      K(0.72, 9, -16, 4, 1, "crouch", eIO, -2), K(1, 19, 11, 2, 0, "", oBack)],
  ],
  // Spear: level thrust from the hip, braced shaft sweep, extended finishing thrust.
  spear: [
    [K(0.12, -6, -11, -9, -3, "crouch", eOut, -2),
      K(IMPACT, 0, -2, 11, 5, "stretch", eIn, 1),
      K(0.39, 0, -2, 10, 5, "stretch", eOut, 1),
      K(0.7, 4, 12, 1, 1, "crouch", eIO, 1), K(1, 10, 16, 2, 0, "", eIO)],
    [K(0.1, -98, 15, 0, -1.5, "crouch", eOut, 2),
      K(IMPACT, 0, 1, 6, 2.5, "stretch", lin),
      K(0.46, 101, -9, 5, 2, "crouch", oExpo, -2),
      K(0.65, 101, -9, 5, 1, "", lin, -2), K(1, 70, 10, 2, 0, "", oBack)],
    [K(0.12, -9, 5, -10, -4, "crouch", eOut, -2),
      K(IMPACT, 0, -3, 14, 8, "stretch", eIn, 1),
      K(0.45, 0, -4, 13, 7, "stretch", eOut, 1),
      K(0.73, 5, 16, 6, 1, "", eIO, 2), K(1, 9, 12, 3, 0, "", oBack)],
  ],
  // Staff: lift the focus, flick it out, or lower it from an overhead flourish for a skill.
  staff: [
    [K(0.08, -30, 60, -1, -1.5, "stretch", eOut, 5),
      K(IMPACT, 0, 10, 5, 2, "stretch", eIn, 2),
      K(0.34, 1, 15, 4, 1, "stretch", eOut, 2),
      K(0.66, 5, 39, 2, 0, "", eIO, 1), K(1, 12, 50, 0, 0, "", oBack)],
    [K(0.08, -62, 37, 1, -1, "", eOut, 3),
      K(IMPACT, 0, 7, 6, 2, "stretch", lin, 1),
      K(0.32, 8, 17, 5, 1, "", eOut, 2),
      K(0.66, 7, 40, 2, 0, "", eIO, 1), K(1, 10, 50, 0, 0, "", oBack)],
    [K(0.07, -64, 82, 0, -2, "stretch", eOut, 7),
      K(IMPACT, 0, 13, 8, 4, "stretch", eIn, 2),
      K(0.39, 5, 19, 7, 2, "stretch", eOut, 3),
      K(0.7, 8, 42, 3, 0, "", eIO, 2), K(1, 14, 54, 0, 0, "", oBack)],
  ],
  // the bow: raised and drawn in one quick pull while the body rocks back to the anchor; the string
  // is let go at IMPACT (the arrow leaves then: scene2d fx.arrow's `delay`), the bow kicks forward
  // and tips up on the release, recoils a pixel and settles. The second shot swings onto the target
  // from a little off it; the finisher (and a skill) is an overdraw: deeper rock back, bigger kick.
  // bowPose adds the string's pull and the arrow on it.
  bow: [
    [K(0.15, 0, 3, -1, -1, "crouch", eOut), K(0.2, 0, 2, -1, -1, "crouch", lin), K(0.27, 0, 10, 2, 0.5, "stretch", oExpo), K(0.5, 0, 5, -1, 0, "", eOut), K(0.6, 0, 5, -1, 0, "", lin), K(1, 0, 3, 0, 0, "", oBack)],
    [K(0.15, -9, 5, -1, -1, "crouch", eOut), K(0.2, 0, 2, -1, -1, "crouch", eIO), K(0.27, 0, 10, 2, 0.5, "stretch", oExpo), K(0.5, 0, 5, -1, 0, "", eOut), K(0.6, 0, 5, -1, 0, "", lin), K(1, 0, 3, 0, 0, "", oBack)],
    [K(0.15, 0, 4, -2, -2.5, "crouch", eOut), K(0.2, 0, 2, -2, -2.5, "crouch", lin), K(0.27, 0, 15, 3, 1.5, "stretch", oExpo), K(0.5, 0, 6, -2, 0.5, "", eOut), K(0.6, 0, 6, -2, 0.5, "", lin), K(1, 0, 3, 0, 0, "", oBack)],
  ],
  // a skill shot into the sky (a rain of arrows): drawn steeply upward, released, brought down
  bowup: [
    [K(0.15, 0, 52, -1, -2, "crouch", eOut), K(0.2, 0, 50, -1, -2, "crouch", lin), K(0.27, 0, 62, 2, 0.5, "stretch", oExpo), K(0.5, 0, 54, -1, 0, "", eOut), K(0.6, 0, 54, -1, 0, "", lin), K(1, 0, 24, 0, 0, "", oBack)],
  ],
};
/**
 * The pose of a stroke at k (0–1), or null before it starts. `side` is ±1:
 * which way round the sweep goes (the second beat comes back the other way).
 */
export function pose(wk, beat, k, side) {
  if (wk === "hammer") return hammerPose(k * (HAMMER_IMPACT + HAMMER_RECOVER));
  const set = STROKES[wk];
  if (!set) return null;
  const keys = set[beat] || set[0];
  const weight = MELEE_FEEL[wk]?.squash || 0;
  const shape = (p) => p.fr === "crouch" ? weight : p.fr === "stretch" ? weight * -0.5 : 0;
  if (k < keys[0].k) return { pre: k / keys[0].k, ...out(keys[0], side), squash: shape(keys[0]) * eOut(k / keys[0].k) };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (k <= b.k) {
      const u = b.ease((k - a.k) / (b.k - a.k));
      return {
        yaw: side * (a.yaw + (b.yaw - a.yaw) * u), pitch: a.pitch + (b.pitch - a.pitch) * u,
        reach: a.reach + (b.reach - a.reach) * u, lean: a.lean + (b.lean - a.lean) * u,
        lift: a.lift + (b.lift - a.lift) * u,
        fr: u < 0.5 ? a.fr : b.fr, strike: i === 1 || i === 2,
        squash: shape(a) + (shape(b) - shape(a)) * u,
      };
    }
  }
  return out(keys[keys.length - 1], side, 0);
}
const out = (p, side) => ({ yaw: side * p.yaw, pitch: p.pitch, reach: p.reach, lean: p.lean, lift: p.lift, fr: p.fr, strike: false });

/**
 * The bow's shot at k (the strokes' clock; side as in pose): the pose, plus `pull` (the string:
 * 0 rest … 1 full draw, below 0 snapped forward past rest), `arrow` (one on the string), `glint`
 * (the finisher's arrowhead catching the light at full draw) and `release` (the first frames after
 * the string is let go, at IMPACT). `up`: the skyward skill shot (bowup).
 *   nock 0 → 3% · draw 3 → 15% (out-cubic: fast, then easing into the anchor) · hold to IMPACT ·
 *   release: the string snaps past rest and rings out (a damped wobble to 42%) · re-nock from 72%
 *   (a fresh arrow, drawn a hair: the ready pose scene2d holds between shots, BOW_READY).
 */
export function bowPose(beat, k, side, up) {
  const p = pose(up ? "bowup" : "bow", up ? 0 : beat, k, side);
  if (!p) return null;
  const fin = beat === 2 || !!up;
  let pull, arrow = true;
  if (k < 0.03) pull = 0.15 * (k / 0.03);
  else if (k < 0.15) pull = 0.15 + 0.85 * eOut((k - 0.03) / 0.12);
  else if (k < IMPACT) pull = 1;
  else if (k < 0.42) { const u = (k - IMPACT) / (0.42 - IMPACT); pull = -0.25 * (1 - u) ** 2 * Math.cos(u * Math.PI * 4); arrow = false; }
  else if (k < 0.72) { pull = 0; arrow = false; }
  else pull = 0.12 * eOut((k - 0.72) / 0.28);
  return { ...p, pull, arrow, glint: fin && k >= 0.12 && k < IMPACT, release: k >= IMPACT && k < IMPACT + 0.08 };
}
/** The pull and arrow of a bow held ready between shots. */
export const BOW_READY = { pull: 0.12, arrow: true };

/** The book's travel, lift and recoil at k (the stroke's clock). */
export function bookPose(beat, k) {
  const fin = beat === 2, side = beat === 1 ? -1 : 1, wind = 0.085, hold = 0.37;
  const send = k < wind ? 0 : k < IMPACT ? eIn((k - wind) / (IMPACT - wind)) : 1;
  const charged = k < wind ? eOut(k / wind) : 1 - send;
  const released = k < IMPACT ? send : k < hold ? 1 - 0.24 * eOut((k - IMPACT) / (hold - IMPACT))
    : 0.76 * (1 - oBack((k - hold) / (1 - hold)));
  return {
    out: (fin ? 1.36 : 1) * released - 0.3 * charged,
    cross: side * (2 * released - 2.5 * charged),
    lift: (fin ? 7 : 5) * charged + 1.5 * released,
    roll: side * (0.12 * released - 0.22 * charged),
    lean: 2.5 * released - 1.5 * charged,
    fr: k < wind ? "crouch" : k >= IMPACT && k < hold ? "stretch" : "",
  };
}

/** How far the drawn weapon reaches from its grip, measured once from its own pixels. */
const reachCache = new WeakMap();
export function bladeLen(img, grip) {
  let n = reachCache.get(img);
  if (n !== undefined) return n;
  n = 14;
  try {
    const c = img.getContext ? img : null;
    const d = c && c.getContext("2d").getImageData(0, 0, img.width, img.height).data;
    if (d) {
      let far = 0;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (d[(y * img.width + x) * 4 + 3] > 0) far = Math.max(far, Math.hypot(x - grip[0], y - grip[1]));
      if (far > 4) n = far;
    }
  } catch { /* a tainted or odd image: keep the guess */ }
  reachCache.set(img, n);
  return n;
}

/** Does this weapon kind have strokes of its own? (A new kind borrows by style.) */
export const has = (wk) => wk === "hammer" || !!STROKES[wk];
export { eOut, oExpo, oBack };
