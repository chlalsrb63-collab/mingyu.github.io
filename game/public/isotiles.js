/**
 * Quarter-view (2:1 isometric) environment art: ground diamonds, raised walls and
 * cliffs, buildings, fences and props seen from the diagonal. scene2d.js uses these
 * when `ready` is true and falls back to its own projected art otherwise.
 *
 *   bakeGround(m, theme) → null | { frames: [canvas, canvas], ox, oy }
 *       the whole map's ground (two frames, for water); tile (x, y)'s TOP corner
 *       sits at (ox + (x − y)·TW/2, oy + (x + y)·TH/2) in those canvases.
 *   tallAt(m, x, y, theme) → null | { img, dx, dy }
 *       an upright piece for tile (x, y), drawn with its top-left at the tile's
 *       top-corner screen position + (dx, dy), depth-sorted at x + y + 1.
 *       Blocks taller than a few pixels (rock walls, cliffs, hedges, ruins, the
 *       city's concrete) also carry `low`: the same block cut down to a 6 px
 *       stump, made on first use — swap it in for walls that stand in front of
 *       the player if they hide too much (a Diablo-style cutaway). Optional.
 *       Houses come back as strips, one per tile along the two front edges
 *       (the other tiles of a footprint return null); fences, one per tile.
 *       Every other object char returns null and stays the renderer's own.
 *
 * The art itself lives in iso_px.js (pixels and the projection), iso_ground.js
 * (the baked ground) and iso_tall.js (what stands up).
 */
import { bake } from "./iso_ground.js";
import { tall } from "./iso_tall.js";
import { bakeRoom, roomPiece, OBJECTS as ROOM_OBJ } from "./iso_interior.js";

export const TW = 32, TH = 16;
export const ready = true;
/** Interiors (theme "interior", iso_interior.js) have their own floors; their furniture stands in any theme. */
export function bakeGround(m, theme) { return theme === "interior" ? bakeRoom(m) : bake(m, theme); }
export function tallAt(m, x, y, theme) { return ROOM_OBJ.includes(m.o[y][x]) ? roomPiece(m, x, y) : tall(m, x, y, theme); }
