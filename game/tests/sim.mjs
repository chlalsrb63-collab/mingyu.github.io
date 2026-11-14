// Headless smoke test of the rules: node tests/sim.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const S = L.setup();
let now = 1000;
S.now = now;
assert.ok(L.validName("모험가1") && !L.validName("a") && !L.validName("<b>xx"));
const eid = L.addPlayer(S, "pid-aaaaaaaa", L.newChar("테스터", "warrior", { hair: 2 }));
assert.ok(eid > 0);
const step = (ms = 100) => { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, "pid-aaaaaaaa"))); L.endTick(S); return v; };
const act = (a) => { S.now = now; const v = L.validateAction(S, "pid-aaaaaaaa", a); if (v.ok) L.applyAction(S, "pid-aaaaaaaa", a); return v; };

let v = step();
assert.equal(v.map.id, "town");
assert.ok(v.self && v.who.length === 1);

// teleporting is refused and corrected
assert.ok(act({ t: "mv", x: 9999, y: 9999 }).ok);
v = step();
assert.equal(v.me[5], 1, "server should flag a position fix");
assert.equal(v.me[0], 20 * 16 + 8);

// buying far from the merchant is refused
assert.equal(act({ t: "buy", id: "hp_s", n: 1 }).ok, false);
assert.equal(act({ t: "sk", i: 0 }).ok, false, "skill is level-locked");

// walk around the fountain, east along the road, through the gate, into the meadow
let x = v.me[0];
const y = 14 * 16 + 10, sideX = 23 * 16 + 8;
for (let i = 0; i < 400 && v.map?.id !== "meadow"; i++) {
  const [cx, cy] = [v.me[0], v.me[1]];
  let nx = cx, ny = cy;
  if (cy !== y && cx < sideX) nx = Math.min(sideX, cx + 6);
  else if (cy !== y) ny = Math.max(y, cy - 6);
  else nx = cx + 6;
  act({ t: "mv", x: nx, y: ny, d: 2 });
  v = step();
  x = v.me[0];
}
assert.equal(v.map?.id, "meadow", "should have crossed the portal, stuck at x=" + x);

// hunt: walk at the nearest monster and hit it until something dies. Monsters come alive out of
// sight (at least SPAWN_MIN_D tiles away), so the walk goes round trees and walls: a breadth-first
// path over the meadow's walkable tiles, one tile centre at a time.
const MM = L.atlas().maps.meadow;
const tileOf = (px, py) => [Math.floor(px / 16), Math.floor(py / 16)];
const towards = (sx, sy, tx, ty) => {
  const W = MM.w, d = new Int32Array(W * MM.h).fill(-1), q = [ty * W + tx];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const j = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= MM.h || !MM.reach[j] || d[j] >= 0) continue;
      d[j] = d[i] + 1; q.push(j);
    }
  }
  let best = null, bd = d[sy * W + sx] < 0 ? 1e9 : d[sy * W + sx];
  for (const [nx, ny] of [[sx + 1, sy], [sx - 1, sy], [sx, sy + 1], [sx, sy - 1]]) {
    const j = ny * W + nx;
    if (nx >= 0 && ny >= 0 && nx < W && ny < MM.h && d[j] >= 0 && d[j] < bd) { bd = d[j]; best = [nx, ny]; }
  }
  return best;
};
let kills = 0, gained = false;
for (let i = 0; i < 3000 && kills < 3; i++) {
  const mobs = v.M.slice().sort((a, b) => Math.hypot(a[2] - v.me[0], a[3] - v.me[1]) - Math.hypot(b[2] - v.me[0], b[3] - v.me[1]));
  if (v.me[4]) { act({ t: "respawn" }); v = step(); continue; }
  if (mobs.length) {
    const [mx, my] = [mobs[0][2], mobs[0][3]];
    const d = Math.hypot(mx - v.me[0], my - v.me[1]);
    if (d > 20) {
      const [sx, sy] = tileOf(v.me[0], v.me[1]), [tx, ty] = tileOf(mx, my);
      const nt = towards(sx, sy, tx, ty);
      const [gx, gy] = nt ? [nt[0] * 16 + 8, nt[1] * 16 + 10] : [mx, my];
      const gd = Math.hypot(gx - v.me[0], gy - v.me[1]) || 1, k = Math.min(6, gd);
      act({ t: "mv", x: v.me[0] + ((gx - v.me[0]) / gd) * k, y: v.me[1] + ((gy - v.me[1]) / gd) * k });
    }
    else act({ t: "atk" });
  } else act({ t: "mv", x: v.me[0] + 6, y: v.me[1] });
  v = step();
  for (const e of v.ev ?? []) if (e[0] === "k") kills++;
  if (v.gain) gained = true;
}
if (!kills) console.log("DEBUG", v.me, v.M.slice(0,3), v.self);
assert.ok(kills >= 1, "expected to kill something, got " + kills);
assert.ok(gained, "expected xp / loot");
const ch = L.removePlayer(S, "pid-aaaaaaaa");
assert.ok(ch.xp > 0 || ch.lvl > 1);
assert.equal(L.playerCount(S), 0);
JSON.stringify(ch);
console.log("sim ok — kills", kills, "lvl", ch.lvl, "xp", ch.xp, "gold", ch.gold, "inv", JSON.stringify(ch.inv));
