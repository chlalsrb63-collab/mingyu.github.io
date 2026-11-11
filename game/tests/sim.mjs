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

// hunt: walk at the nearest monster and hit it until something dies
let kills = 0, gained = false, side = 0;
for (let i = 0; i < 3000 && kills < 3; i++) {
  const mobs = v.M.slice().sort((a, b) => Math.hypot(a[2] - v.me[0], a[3] - v.me[1]) - Math.hypot(b[2] - v.me[0], b[3] - v.me[1]));
  if (v.me[4]) { act({ t: "respawn" }); v = step(); continue; }
  if (mobs.length) {
    const [mx, my] = [mobs[0][2], mobs[0][3]];
    const d = Math.hypot(mx - v.me[0], my - v.me[1]);
    if (d > 20) {
      // dumb steering: when the straight line is blocked by a tree, sidestep for a while
      if (v.me[5] && !side) side = 12;
      const ux = (mx - v.me[0]) / d, uy = (my - v.me[1]) / d;
      if (side > 0) { side--; act({ t: "mv", x: v.me[0] - uy * 6, y: v.me[1] + ux * 6 }); }
      else act({ t: "mv", x: v.me[0] + ux * 6, y: v.me[1] + uy * 6 });
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
