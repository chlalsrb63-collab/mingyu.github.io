/**
 * The title and creation stage (split from scene2d.js): `showcase leaveStage renderStage`, and
 * `figure drawFigure` — one person drawn on another canvas (title diorama, creation preview).
 */

import { playerLook, g, setCtx, cv, vw, vh, hash, Z } from "./scene_view.js";
import { scenery } from "./scene_props.js";
import { setMap } from "./scene_map.js";
import { makePerson, drawPerson } from "./scene_people.js";

// ───────────────────────────── title and creation ─────────────────────────────

let stage = null;
export function showcase(draft) {
  const cast = draft ? [draft] : [playerLook("warrior", [1, 0, 0, 0, 0, 0, 1, 3, 5, 0, 0], { wt: 3 }), playerLook("mage", [11, 6, 8, 15, 0, 7, 4, 8, 10, 1, 0], { wt: 3 }), playerLook("lancer", [3, 1, 6, 10, 2, 3, 3, 5, 4, 1, 4], { wt: 3 }), playerLook("rogue", [0, 2, 10, 10, 2, 2, 0, 1, 3, 2, 4], { wt: 2 })];
  stage = { draft: !!draft, cast: cast.map((look, i) => ({ s: { key: "", face: 1, walk: 0, ang: null, ...makePerson(look) }, i })) };
  setMap(null);
}
export function leaveStage() { stage = null; }
/**
 * One person with their weapon, drawn on another canvas (the title diorama and the
 * creation preview, lobby.js): `figure(look)` makes the scratch state, `drawFigure`
 * draws it with the same strokes as in the world. `e` speaks in screen directions.
 */
export function figure(look) { return { key: "", face: 1, walk: 0, ang: null, ...makePerson(look) }; }
export function drawFigure(ctx, s, e, t, dt, x, y) {
  const keep = g;
  setCtx(ctx);
  try { drawPerson(s, { scr: true, x: 0, y: 0, dir: 2, moving: false, atkT: -1e9, dead: false, aim: null, ...e }, t, dt, x, y); } finally { setCtx(keep); }
}
export function renderStage(dt, t) {
  if (!cv || !stage) return;
  const S = scenery();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#6cbf5e"; g.fillRect(0, 0, vw, vh);
  // a strip of meadow scrolling past
  const scroll = stage.draft ? 0 : (t / 28) % 64;
  for (let x = -64; x < vw + 64; x += 32) for (let y = 0; y < vh; y += 32) {
    const hx = Math.floor((x + scroll) / 32) + (stage.draft ? 0 : Math.floor(t / 28 / 64) * 2), h = hash(hx, y, 1);
    g.fillStyle = "#57a850"; const px = x - (stage.draft ? 0 : scroll % 32);
    g.fillRect(px + 4 + h * 20, y + 6 + hash(hx, y, 2) * 18, 2, 4); g.fillRect(px + 7 + h * 20, y + 7 + hash(hx, y, 2) * 18, 2, 3);
  }
  const gy = Math.round(vh * 0.62);
  g.fillStyle = "#d9ab6c"; g.fillRect(0, gy - 6, vw, 30); g.fillStyle = "#8f6238"; g.fillRect(0, gy - 6, vw, 1); g.fillRect(0, gy + 23, vw, 1); g.fillStyle = "#bd8c54"; g.fillRect(0, gy - 5, vw, 2); g.fillRect(0, gy + 21, vw, 2);
  if (!stage.draft) for (let i = 0; i < Math.ceil(vw / 150) + 2; i++) { const x = ((i * 150 - (t / 28) % 150) + 150) % (vw + 150) - 60, sp = i % 2 ? S.T[i % 4] : S.P[0]; g.drawImage(sp, Math.round(x), gy - 20 - sp.height); g.drawImage(S.B[i % 3], Math.round(x + 70), gy + 40); }
  const cx = Math.round(vw / 2);
  stage.cast.forEach(({ s, i }) => {
    if (stage.draft) {
      const k = (t % 3200) / 1000, dir = [0, 2, 3, 1][Math.floor(t / 3200) % 4], z = Math.max(3, Math.round(15 / Z));
      g.save(); g.translate(cx + Math.min(120, vw * 0.18), gy + 34); g.scale(z, z);
      drawPerson(s, { scr: true, x: 0, y: 0, dir, moving: k > 1 && k < 2.2, atkT: k > 2.5 ? t - (k - 2.5) * 1000 : -1e9, dead: false, aim: k > 2.5 ? [dir === 1 ? -40 : 40, 6] : null }, t, dt, 0, 0);
      g.restore();
    } else drawPerson(s, { scr: true, x: 0, y: 0, dir: 2, moving: true, atkT: -1e9, dead: false, aim: null }, t, dt, cx - 66 + i * 44, gy + 12);
  });
}
