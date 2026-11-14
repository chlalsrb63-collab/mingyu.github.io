/**
 * How a held weapon moves through a stroke — the basic attack's three beats and
 * the cast that a skill swings like a finisher — in the quarter view.
 *
 * A stroke is a handful of key poses on a 0 → 1 clock (k = time / stroke time).
 * Each pose says where the blade points on the ground (yaw, relative to the
 * target, mirrored by the beat's side), how far it is raised (pitch), how far
 * the hand is pushed out along the blade (reach), how far the body leans or
 * steps toward the target (lean), and which body frame shows the weight
 * (crouch on the wind-up and the landing, stretch at full reach).
 *
 * The blow lands at k = IMPACT (0.2) for every weapon (scene2d's impactMs): the
 * pose keyed there is the one crossing or touching the target. The order is the
 * one the pixel-art rules ask for, at a high tempo: a very short wind-up the other
 * way (15% of the stroke, under ~85 ms), a snap (35%) that crosses the target in
 * its first hundredths and brakes on an out-expo curve, then a held beat and an
 * out-back settle (50%). Poses are 3-D, so a level
 * sweep draws a flat ellipse on the ground — foreshortened as the blade swings
 * toward or away from the camera — instead of a clock hand.
 */

const D = Math.PI / 180;
/** World direction (yaw on the ground, pitch up) → [screen angle, screen length 0–1, depth toward the camera]. */
export function project(yaw, pitch) {
  const cp = Math.cos(pitch), vx = cp * Math.cos(yaw), vy = cp * Math.sin(yaw), vz = Math.sin(pitch);
  const X = (vx - vy) * Math.SQRT1_2, Y = ((vx + vy) * Math.SQRT1_2) / 2 - vz;
  return [Math.atan2(Y, X), Math.hypot(X, Y), vx + vy];
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
 * Where every stroke is on its 0-1 clock (Sephiria-style tempo): a very short anticipation
 * (0 -> WIND, 15%), a snap (WIND -> SNAP, 35%) whose first hundredths carry the blade across
 * the target (the blow lands at IMPACT), and a follow-through that holds a beat and settles
 * (SNAP -> 1, 50%). scene2d's impactMs, the sword-qi burst and the hit events key off IMPACT.
 */
export const WIND = 0.15, IMPACT = 0.2, SNAP = 0.5;

/** Key poses: [k, yaw°, pitch°, reach px, lean px, frame, ease into this key]. */
const K = (k, yaw, pitch, reach, lean, fr, ease) => ({ k, yaw: yaw * D, pitch: pitch * D, reach, lean, fr: fr || "", ease: ease || lin });
// every stroke: wind-up (eOut) -> impact (linear: the blade at full speed) -> the rest of the
// snap (out-expo, so a sweep carries on as fast as it crossed and then brakes) -> a held beat
// -> the settle (out-back). Thrusts keep an extra key: still out at full reach, then drawn back.
const STROKES = {
  // the greatsword: heavy level sweeps, one way then back, then an overhead chop with a step in
  sword: [
    [K(0.15, -128, 34, 1, -2, "crouch", eOut), K(0.2, 0, 2, 7, 3, "stretch", lin), K(0.5, 126, -20, 4, 2, "", oExpo), K(0.6, 130, -21, 4, 2, "", lin), K(1, 112, -8, 3, 0, "", oBack)],
    null, // the second beat is the first, mirrored
    [K(0.15, -18, 118, 0, -3, "crouch", eOut), K(0.2, 0, 6, 9, 7, "stretch", lin), K(0.5, 4, -42, 7, 7, "crouch", oExpo), K(0.6, 4, -42, 7, 7, "", lin), K(1, 10, -22, 4, 3, "", oBack)],
  ],
  // the dagger: quick stabs, a backhand cut across, a lunge
  dagger: [
    [K(0.15, -14, 10, -3, -1, "crouch", eOut), K(0.2, 0, 0, 14, 3, "stretch", lin), K(0.32, 2, -2, 12, 3, "", oExpo), K(0.5, 12, 6, 4, 1, "", eOut), K(0.6, 14, 8, 4, 1, "", lin), K(1, 24, 14, 2, 0, "", oBack)],
    [K(0.15, -84, 16, 4, -1, "crouch", eOut), K(0.2, 0, 0, 8, 2, "stretch", lin), K(0.5, 96, -14, 4, 1, "", oExpo), K(0.6, 98, -14, 4, 1, "", lin), K(1, 70, 0, 3, 0, "", oBack)],
    [K(0.15, -10, 14, -5, -2, "crouch", eOut), K(0.2, 0, -2, 18, 8, "stretch", lin), K(0.34, 0, -4, 16, 8, "", oExpo), K(0.52, 8, 4, 6, 5, "", eOut), K(0.62, 8, 4, 6, 5, "", lin), K(1, 18, 10, 3, 2, "", oBack)],
  ],
  // the spear: thrusts that use its reach, a sweep of the shaft, a long lunge
  spear: [
    [K(0.15, -6, 6, -6, -2, "crouch", eOut), K(0.2, 0, -3, 18, 4, "stretch", lin), K(0.34, 0, -4, 17, 4, "", oExpo), K(0.52, 4, 2, 6, 2, "", eOut), K(0.62, 4, 2, 6, 2, "", lin), K(1, 10, 8, 4, 0, "", oBack)],
    [K(0.15, -112, 12, 4, -1, "crouch", eOut), K(0.2, 0, 0, 7, 2, "stretch", lin), K(0.5, 104, -12, 5, 1, "", oExpo), K(0.6, 106, -12, 5, 1, "", lin), K(1, 80, 0, 4, 0, "", oBack)],
    [K(0.15, -8, 12, -8, -3, "crouch", eOut), K(0.2, 0, -4, 25, 9, "stretch", lin), K(0.36, 0, -5, 23, 9, "", oExpo), K(0.54, 4, 2, 8, 5, "", eOut), K(0.64, 4, 2, 8, 5, "", lin), K(1, 10, 8, 4, 2, "", oBack)],
  ],
  // the staff: raised, then brought down to point at the target as the spell leaves; the finisher twirls it first
  staff: [
    [K(0.15, -40, 76, 0, -2, "crouch", eOut), K(0.2, 0, 14, 7, 2, "stretch", lin), K(0.34, 4, 0, 7, 2, "", oExpo), K(0.5, 8, -8, 6, 1, "", eOut), K(0.6, 8, -8, 6, 1, "", lin), K(1, 14, 6, 4, 0, "", oBack)],
    null,
    [K(0.08, -100, 34, 2, -1, "crouch", eOut), K(0.2, 0, 12, 8, 4, "stretch", eIO), K(0.34, 0, 0, 9, 4, "", oExpo), K(0.5, 6, -10, 7, 2, "", eOut), K(0.6, 6, -10, 7, 2, "", lin), K(1, 12, 4, 4, 0, "", oBack)],
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
/** Staff finisher: a whole extra turn between the wind-up and the release. */
const TWIRL = { staff: 360 * D };

/**
 * The pose of a stroke at k (0–1), or null before it starts. `side` is ±1:
 * which way round the sweep goes (the second beat comes back the other way).
 */
export function pose(wk, beat, k, side) {
  const set = STROKES[wk];
  if (!set) return null;
  const keys = set[beat] || set[0];
  if (k < keys[0].k) return { pre: k / keys[0].k, ...out(keys[0], side, 0) };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (k <= b.k) {
      const u = b.ease((k - a.k) / (b.k - a.k));
      const twirl = beat === 2 && i === 1 && TWIRL[wk] ? -TWIRL[wk] * (1 - u) : 0;
      return {
        yaw: side * (a.yaw + (b.yaw - a.yaw) * u + twirl), pitch: a.pitch + (b.pitch - a.pitch) * u,
        reach: a.reach + (b.reach - a.reach) * u, lean: a.lean + (b.lean - a.lean) * u,
        fr: u < 0.5 ? a.fr : b.fr, strike: i === 1 || i === 2,
      };
    }
  }
  return out(keys[keys.length - 1], side, 0);
}
const out = (p, side) => ({ yaw: side * p.yaw, pitch: p.pitch, reach: p.reach, lean: p.lean, fr: p.fr, strike: false });

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

/** The book: how far it darts out (-: pulled back to the chest) and how much it swells, at k (the strokes' clock). */
export function bookPose(beat, k) {
  const fin = beat === 2, W = WIND, I = IMPACT;
  let o;
  if (k < W) o = -0.2 * eOut(k / W);
  else if (k < I) o = -0.2 + 1.2 * eIn((k - W) / (I - W));
  else if (k < SNAP) o = 1 - 0.75 * oExpo((k - I) / (SNAP - I));
  else if (k < 0.6) o = 0.25;
  else o = 0.25 * (1 - oBack((k - 0.6) / 0.4));
  const big = k < W ? 1 - 0.1 * eOut(k / W) : k < 0.4 ? 1 + Math.sin(((k - W) / (0.4 - W)) * Math.PI) * (fin ? 0.7 : 0.35) : 1;
  // drawn up over the shoulder on the wind-up rather than back into the reader
  const lift = k < W ? 4 * eOut(k / W) : k < I ? 4 * (1 - eIn((k - W) / (I - W))) : 0;
  const lean = k < W ? -1.5 * eOut(k / W) : k < I ? -1.5 + 4 * eIn((k - W) / (I - W)) : k < 0.6 ? 2.5 * (1 - oExpo((k - I) / (0.6 - I))) : 0;
  return { out: o * (fin ? 2.2 : 1) * (beat === 1 ? -0.6 : 1), big, lift, lean, fr: k < W ? "crouch" : k < 0.3 ? "stretch" : "" };
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
export const has = (wk) => !!STROKES[wk];
export { eOut, oExpo, oBack };
