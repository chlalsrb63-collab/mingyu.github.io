// ───────────────────────────── the dash (Space) ─────────────────────────────
// A short dash the way you aim, for getting about and for slipping a monster's heavy blow. The server moves
// you and sends the end point as a position fix (the client only draws the trail); for as long as it lasts, and
// a breath longer, nothing a monster throws lands. Others see it as `["ds", eid, x0, y0, x1, y1]`; a blow slipped is `["dg", eid]` ("회피!").

/** `px` far in `ms`, once every `cd`; `inv` more ms of safety after it ends; swept `step` px at a time. */
// owner (2026-11-15): the dodge went too far — 72 → 36 px (same time and invulnerable window)
const DASH = { px: 36, ms: 180, cd: 4000, inv: 60, step: 4 };
const DASH_CD = DASH.cd;
/** The wait between two dashes of `p` now (a prefix power may shorten it: 51-prefix.js). */
const dashCd = (p) => Math.round(pfxNum(p, "dashCd", DASH_CD));

/** Would a walker standing here be taken through a gate, or the "내 집" door? A dash stops short of those. */
function gateAt(p, m, x, y) {
  for (const pt of m.portals) if (dist(x, y - 3, pt.x * T + 8, pt.y * T + 8) < 12) return true;
  return p.map === HOUSE_TOWN.map && HOUSE_TOWN.door.some(([dx, dy]) => dist(x, y - 3, dx * T + 8, dy * T + 8) < 12);
}
/**
 * Where a dash from the player's feet along (ux, uy) ends: swept a few px at a time with the walker's own
 * collision, so it never passes a wall, water, a cliff or the map's edge; it slides along what it grazes
 * (as walking does) and stops dead at what it meets head-on.
 */
function dashEnd(p, m, ux, uy) {
  let x = p.x, y = p.y;
  const free = (nx, ny) => canStand(m, nx, ny) && !gateAt(p, m, nx, ny);
  const slant = Math.abs(ux) > 0.01 && Math.abs(uy) > 0.01;
  for (let k = DASH.step; k <= DASH.px; k += DASH.step) {
    const nx = x + ux * DASH.step, ny = y + uy * DASH.step;
    if (free(nx, ny)) { x = nx; y = ny; }
    else if (slant && free(nx, y)) x = nx;
    else if (slant && free(x, ny)) y = ny;
    else break;
  }
  return [x, y];
}
/** Why a dash is refused now, or "" — quiet codes, never a toast (the client keeps its own clock). */
function dashWhy(S, p) {
  if (p.dead || p.dance) return "dash";
  if (S.now < (p.stag || 0) || elementFrozen(S, p)) return "stag";
  return S.now < (p.dashAt || 0) + dashCd(p) - 60 ? "dash" : "";
}
/** The dash itself: stands you up, drops the line, the gathering and a recall, and moves you. */
function dashGo(S, p, m, a) {
  const now = S.now, rt = S.maps[p.map];
  if (validAim(a)) setAim(p, a);
  rouse(S, p);
  if (p.gat) gatStop(S, p, "채집이 끊겼습니다.");
  const [ux, uy] = AIM_V[p.aim | 0], x0 = p.x, y0 = p.y;
  const [x, y] = dashEnd(p, m, ux, uy);
  p.x = x; p.y = y; p.mvAt = now; p.fix = true;
  if (x !== x0 || y !== y0) p.elementRunAt = now;
  p.dashAt = now;
  p.dodge = now + DASH.ms + DASH.inv;
  rt.ev.push(["ds", p.eid, Math.round(x0), Math.round(y0), Math.round(x), Math.round(y)]);
  pfxDash(S, rt, p, x0, y0, x, y);
}
/** Mid-dash nothing a monster throws lands — a blow, a charge, a slam, a volley, a puddle: true, and "회피!". */
function dodged(S, rt, p) {
  if (S.now >= (p.dodge || 0)) return false;
  if (p.dgAt !== S.now) { p.dgAt = S.now; rt.ev.push(["dg", p.eid]); pfxEvade(S, rt, p, "dash"); }
  return true;
}
/** Ms until the next dash may go (the last `me` field, rounded to 100 ms): 0 when ready. */
function dashLeft(S, p) {
  return p.dashAt ? Math.max(0, Math.ceil((p.dashAt + dashCd(p) - S.now) / 100) * 100) : 0;
}
