// The hunting route remains playable when a roster or generator is changed.
import assert from "node:assert/strict";
import { atlas, defs } from "../src/logic.js";

const D = defs();
const { maps, fires } = atlas();
const route = ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "maple", "frostkeep"];
const coastal = ["city", "jungle", "coast", "oasis"];
const legs = (ids) => ids.slice(1).map((id, i) => [maps[ids[i]], maps[id]]);
for (const [a, b] of [...legs(route), ...legs(coastal)]) {
  const doors = a.portals.filter((p) => p.to === b.id);
  assert.equal(doors.length, 2, `${a.id} to ${b.id} has a paired threshold`);
  for (const p of doors) {
    assert.equal(a.reach[p.y * a.w + p.x], 1, `${a.id} threshold is reachable`);
    assert.equal(b.reach[p.ty * b.w + p.tx], 1, `${b.id} arrival is walkable`);
    assert.equal(b.zone[p.ty * b.w + p.tx], 0, `${b.id} arrival is outside the hunting packs`);
  }
  if (a.band && b.band) assert.ok(b.band[0] - a.band[1] <= 1, `${a.id} and ${b.id} have adjacent bands`);
}

function stats(map, kind) {
  const { w, reach, zone, zdist, cells } = map;
  let total = 0, sum = 0, near = Infinity;
  for (const q of cells.spawns.flat().filter((q) => q.k === kind)) {
    let n = 0, d = 0;
    for (let y = q.r[1]; y <= q.r[3]; y++) for (let x = q.r[0]; x <= q.r[2]; x++) {
      const i = y * w + x;
      if (!reach[i] || zone[i] !== q.zone) continue;
      d += zdist[i];
      near = Math.min(near, zdist[i]);
      n++;
    }
    if (!n) continue;
    total += q.n;
    sum += q.n * d / n;
  }
  assert.ok(total >= 8, `${map.id} has repeatable packs of ${kind}`);
  return { mean: sum / total, near };
}

function increasing(map, kinds) {
  let mean = 0;
  for (const k of kinds) {
    const s = stats(map, k);
    assert.ok(s.mean > mean, `${map.id} fights get harder along the route at ${k}`);
    mean = s.mean;
  }
}
increasing(maps.meadow, ["twinhare", "gutfrog", "eyecrow", "lambmaw", "meadowram"]);
assert.ok(stats(maps.meadow, "meadowram").near > maps.meadow.zinfo.eliteD);
assert.ok(stats(maps.forest, "splitboar").near < 30, "the job-level hunt is close to the forest entrance");
increasing(maps.forest, ["splitboar", "ribdeer", "mothface"]);
increasing(maps.jungle, ["vinemonkey", "hydrasnake_poison", "loggator"]);
increasing(maps.coast, ["hermitskull", "eyegull", "coralturtle"]);
increasing(maps.oasis, ["foxtwine_gold", "ribvulture_bone", "mummycamel"]);
increasing(maps.maple, ["blightsquirrel", "gravrose", "bogcrown", "hollowowl", "rootwarden"]);
assert.deepEqual(D.quests.slice(-4).map((q) => q.mob), ["bogcrown", "hollowowl", "rootwarden", "crownstag"]);

const keep = maps.frostkeep;
const boss = keep.cells.fixed.find((sp) => sp.k === "crownstag");
assert.ok(boss, "there is a distinct permanent boss");
assert.equal(keep.reach[boss.r[1] * keep.w + boss.r[0]], 1);
assert.ok(keep.stones.length === 3 && fires.frostkeep.length > 0, "the keep has a camp and three standing stones");
assert.ok(stats(keep, "rimehare").mean < stats(keep, "frostmoth").mean, "the ranged packs start farther in");
assert.ok(maps.maple.portals.some((p) => p.to === keep.id), "the endgame threshold is in the old kingdom");

// ── level design 2026-11-15 (docs/design/maps-review-2026-11-15.md): the top band has a monster at every level step,
// the old kingdom's two frost kinds sit between their neighbours along the route, and every open ground has a camp keeper
const mapleKinds = new Set(maps.maple.spawns.map((sp) => sp.k));
for (let lv = 153; lv <= 197; lv += 4) assert.ok(Object.keys(D.mobs).some((k) => D.mobs[k].lv === lv && !D.mobs[k].boss && !D.mobs[k].chest && Object.values(maps).some((m) => !m.safe && m.spawns.some((sp) => sp.k === k))), `a ground holds a Lv.${lv} monster`);
assert.ok(mapleKinds.has("shroomboar_frost") && mapleKinds.has("crowscare_frost"), "the frost kinds live in the old kingdom");
increasing(maps.maple, ["gravrose", "shroomboar_frost", "bogcrown", "crowscare_frost", "rootwarden"]);
assert.equal(maps.maple.stones.length, 5, "the old kingdom has five stones");
for (const id of ["jungle", "coast", "dunesea", "cloudtemple", "mesa"]) {
  const m = maps[id], n = m.npcs.find((o) => o.id === "camp_" + id);
  assert.ok(n && m.reach[n.y * m.w + n.x], `${id}: a keeper stands at the camp`);
  assert.ok(n.role === "shop" && n.goods.length && n.goods.every((g) => D.items[g] && D.items[g].price > 0), `${id}: the keeper sells field goods`);
  assert.equal(D.npcMap[n.id], id, `${id}: the keeper is in the NPC registry`);
}
console.log("hunt routes: safe arrivals, adjacent bands, starter and late progression, capped arena");
