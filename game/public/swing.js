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
 * The blow lands at k = 0.23 for every weapon (scene2d's impactMs): the pose
 * keyed there is the one crossing or touching the target. The order is the one
 * the pixel-art rules ask for: a short wind-up the other way (player attacks
 * keep it ≤ ~80 ms), a fast accelerating strike, a decelerating follow-through,
 * a beat's hold (~0.1 s) and an unhurried settle. Poses are 3-D, so a level
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

// easing: in (accelerating into the blow), out (slowing after it), both
const eIn = (u) => u * u * u;
const eOut = (u) => 1 - (1 - u) ** 3;
const eIO = (u) => u * u * (3 - 2 * u);
const lin = (u) => u;

/** Key poses: [k, yaw°, pitch°, reach px, lean px, frame, ease into this key]. */
const K = (k, yaw, pitch, reach, lean, fr, ease) => ({ k, yaw: yaw * D, pitch: pitch * D, reach, lean, fr: fr || "", ease: ease || lin });
const STROKES = {
  // the greatsword: heavy level sweeps, one way then back, then an overhead chop with a step in
  sword: [
    [K(0.10, -128, 34, 1, -2, "crouch", eOut), K(0.23, 0, 2, 7, 3, "stretch", eIn), K(0.31, 72, -10, 7, 3, "", lin), K(0.55, 126, -20, 4, 2, "", eOut), K(0.68, 130, -21, 4, 2, "", lin), K(1, 112, -8, 3, 0, "", eIO)],
    null, // the second beat is the first, mirrored
    [K(0.10, -18, 118, 0, -3, "crouch", eOut), K(0.23, 0, 6, 9, 7, "stretch", eIn), K(0.29, 0, -34, 8, 8, "crouch", lin), K(0.55, 4, -42, 7, 7, "", eOut), K(0.68, 4, -42, 7, 7, "", lin), K(1, 10, -22, 4, 3, "", eIO)],
  ],
  // the dagger: quick stabs, a backhand cut across, a lunge
  dagger: [
    [K(0.10, -14, 10, -3, -1, "crouch", eOut), K(0.23, 0, 0, 14, 3, "stretch", eIn), K(0.34, 2, -2, 12, 3, "", lin), K(0.55, 12, 6, 4, 1, "", eOut), K(0.68, 14, 8, 4, 1, "", lin), K(1, 24, 14, 2, 0, "", eIO)],
    [K(0.10, -84, 16, 4, -1, "crouch", eOut), K(0.23, 0, 0, 8, 2, "stretch", eIn), K(0.34, 66, -10, 7, 2, "", lin), K(0.55, 96, -14, 4, 1, "", eOut), K(0.68, 98, -14, 4, 1, "", lin), K(1, 70, 0, 3, 0, "", eIO)],
    [K(0.10, -10, 14, -5, -2, "crouch", eOut), K(0.23, 0, -2, 18, 8, "stretch", eIn), K(0.36, 0, -4, 16, 8, "", lin), K(0.58, 8, 4, 6, 5, "", eOut), K(0.70, 8, 4, 6, 5, "", lin), K(1, 18, 10, 3, 2, "", eIO)],
  ],
  // the spear: thrusts that use its reach, a sweep of the shaft, a long lunge
  spear: [
    [K(0.10, -6, 6, -6, -2, "crouch", eOut), K(0.23, 0, -3, 18, 4, "stretch", eIn), K(0.36, 0, -4, 17, 4, "", lin), K(0.58, 4, 2, 6, 2, "", eOut), K(0.70, 4, 2, 6, 2, "", lin), K(1, 10, 8, 4, 0, "", eIO)],
    [K(0.10, -112, 12, 4, -1, "crouch", eOut), K(0.23, 0, 0, 7, 2, "stretch", eIn), K(0.34, 70, -8, 7, 2, "", lin), K(0.56, 104, -12, 5, 1, "", eOut), K(0.70, 106, -12, 5, 1, "", lin), K(1, 80, 0, 4, 0, "", eIO)],
    [K(0.10, -8, 12, -8, -3, "crouch", eOut), K(0.23, 0, -4, 25, 9, "stretch", eIn), K(0.38, 0, -5, 23, 9, "", lin), K(0.60, 4, 2, 8, 5, "", eOut), K(0.72, 4, 2, 8, 5, "", lin), K(1, 10, 8, 4, 2, "", eIO)],
  ],
  // the staff: raised, then brought down to point at the target as the spell leaves; the finisher twirls it first
  staff: [
    [K(0.10, -40, 76, 0, -2, "crouch", eOut), K(0.23, 0, 14, 7, 2, "stretch", eIn), K(0.34, 4, 0, 7, 2, "", lin), K(0.56, 8, -8, 6, 1, "", eOut), K(0.70, 8, -8, 6, 1, "", lin), K(1, 14, 6, 4, 0, "", eIO)],
    null,
    [K(0.06, -100, 34, 2, -1, "crouch", eOut), K(0.23, 0, 12, 8, 4, "stretch", eIO), K(0.34, 0, 0, 9, 4, "", lin), K(0.56, 6, -10, 7, 2, "", eOut), K(0.70, 6, -10, 7, 2, "", lin), K(1, 12, 4, 4, 0, "", eIO)],
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

/** The book: how far it darts out (–: pulled back to the chest) and how much it swells, at k. */
export function bookPose(beat, k) {
  const fin = beat === 2;
  let o;
  if (k < 0.1) o = -0.2 * eOut(k / 0.1);
  else if (k < 0.23) o = -0.2 + 1.2 * eIn((k - 0.1) / 0.13);
  else if (k < 0.55) o = 1 - 0.75 * eOut((k - 0.23) / 0.32);
  else if (k < 0.68) o = 0.25;
  else o = 0.25 * (1 - eIO((k - 0.68) / 0.32));
  const big = k < 0.1 ? 1 - 0.1 * eOut(k / 0.1) : k < 0.4 ? 1 + Math.sin(((k - 0.1) / 0.3) * Math.PI) * (fin ? 0.7 : 0.35) : 1;
  // drawn up over the shoulder on the wind-up rather than back into the reader
  const lift = k < 0.1 ? 4 * eOut(k / 0.1) : k < 0.23 ? 4 * (1 - eIn((k - 0.1) / 0.13)) : 0;
  return { out: o * (fin ? 2.2 : 1) * (beat === 1 ? -0.6 : 1), big, lift, lean: k < 0.1 ? -1.5 * eOut(k / 0.1) : k < 0.23 ? -1.5 + 4 * eIn((k - 0.1) / 0.13) : k < 0.6 ? 2.5 * (1 - eOut((k - 0.23) / 0.37)) : 0, fr: k < 0.1 ? "crouch" : k < 0.3 ? "stretch" : "" };
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
export { eOut };
