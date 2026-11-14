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
 */
export const TW = 32, TH = 16;
export const ready = false;
export function bakeGround(m, theme) { return null; }
export function tallAt(m, x, y, theme) { return null; }
