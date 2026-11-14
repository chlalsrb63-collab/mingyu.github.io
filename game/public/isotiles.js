/**
 * Quarter-view (2:1 isometric) environment art: ground diamonds, raised walls and
 * cliffs, buildings, fences and props seen from the diagonal. scene2d.js uses these
 * when `ready` is true and falls back to its own projected art otherwise.
 *
 *   bakeGround(m, theme) → null | { frames: [canvas, canvas], ox, oy }
 *       the whole map's ground (two frames, for water); tile (x, y)'s TOP corner
 *       sits at (ox + (x − y)·TW/2, oy + (x + y)·TH/2) in those canvases.
 *   groundChunks(m, theme) → { chunked, W, H, ox, oy, CW, CH, nx, ny, get(i, j), has(i, j), stats }
 *       the same ground cut into CW × CH rectangles of that canvas, each baked on
 *       first use (same pixels as the whole bake) and kept in an LRU of `keep`.
 *       For big maps (CHUNK_AREA); scene2d draws the visible ones.
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
import { bake, bakeChunk, groundSize } from "./iso_ground.js";
import { tall } from "./iso_tall.js";
import { bakeRoom, roomPiece, OBJECTS as ROOM_OBJ } from "./iso_interior.js";

export const TW = 32, TH = 16;
export const ready = true;
/** Interiors (theme "interior", iso_interior.js) have their own floors; their furniture stands in any theme. */
export function bakeGround(m, theme) { return theme === "interior" ? bakeRoom(m) : bake(m, theme); }
/** Maps of more tiles than this are baked in chunks (a 1× hunting ground is 76 × 51; 4× ones are ≈ 150 × 100). */
export const CHUNK_AREA = 80 * 60;
/** Whether a map's ground is baked in chunks (interiors never are); `force` for tests and previews. */
export const chunked = (m, theme, force = false) => theme !== "interior" && (force || m.w * m.h > CHUNK_AREA);
/**
 * The ground in CW × CH pieces, baked when first asked for and kept while among the last `keep`
 * used (a dropped one gives its memory back at once). `stats`: chunks baked, total and slowest ms.
 */
export function groundChunks(m, theme, CW = 1024, CH = 512, keep = 12) {
  const { W, H, ox, oy } = groundSize(m);
  const nx = Math.ceil(W / CW), ny = Math.ceil(H / CH), lru = new Map();
  const stats = { baked: 0, ms: 0, max: 0, kept: 0 };
  const get = (i, j) => {
    const key = j * nx + i;
    let c = lru.get(key);
    if (c) { lru.delete(key); lru.set(key, c); return c; }
    c = bakeChunk(m, theme, i * CW, j * CH, Math.min(CW, W - i * CW), Math.min(CH, H - j * CH));
    stats.baked++; stats.ms += c.ms; stats.max = Math.max(stats.max, c.ms);
    lru.set(key, c);
    while (lru.size > keep) {
      const [k0, old] = lru.entries().next().value;
      lru.delete(k0);
      for (const f of old.frames) f.width = f.height = 0;
    }
    stats.kept = lru.size;
    return c;
  };
  const has = (i, j) => lru.has(j * nx + i);
  return { chunked: true, W, H, ox, oy, CW, CH, nx, ny, get, has, stats };
}
export function tallAt(m, x, y, theme) { return ROOM_OBJ.includes(m.o[y][x]) ? roomPiece(m, x, y) : tall(m, x, y, theme); }
