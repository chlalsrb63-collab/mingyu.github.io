/** Draw a character and its held weapon on the title or character creation canvas. */
import { g, setCtx } from "./scene_view.js";
import { makePerson, drawPerson } from "./scene_people.js";

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
