// The hunting route remains playable when a roster or generator is changed.
import assert from "node:assert/strict";
import { atlas, defs } from "../src/logic.js";

const D = defs();
const { maps, fires } = atlas();
const route = ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss", "maple", "frostkeep"];
const coastal = ["city", "jungle", "coast", "oasis"];
const lake = ["mesa", "inklake", "maple"];
const legs = (ids) => ids.slice(1).map((id, i) => [maps[ids[i]], maps[id]]);
for (const [a, b] of [...legs(route), ...legs(coastal), ...legs(lake)]) {
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
// 먹빛 호수 (maps-batch2 §6): the second top-band ground, quiet and harder going north to the pagoda isle
increasing(maps.inklake, ["leechmaw_ash", "fishwalker_ash", "spiderhand_blood", "gravrose_blood"]);
assert.ok(maps.inklake.spawns.some((sp) => sp.k === "foxtwine_frost"), "the ink lake's rare fox keeps its pagoda court");
for (const id of ["jungle", "coast", "dunesea", "cloudtemple", "mesa", "inklake"]) {
  const m = maps[id], n = m.npcs.find((o) => o.id === "camp_" + id);
  assert.ok(n && m.reach[n.y * m.w + n.x], `${id}: a keeper stands at the camp`);
  assert.ok(n.role === "shop" && n.goods.length && n.goods.every((g) => D.items[g] && D.items[g].price > 0), `${id}: the keeper sells field goods`);
  assert.equal(D.npcMap[n.id], id, `${id}: the keeper is in the NPC registry`);
}
// camp folk: each resident stands on reachable ground right beside an extra campfire; each lore side-quest giver exists (34-maps-world.js CAMP_FOLK)
const folk = { meadow: ["meadow_shepherd", "meadow_florist"], forest: ["forest_woodcutter", "forest_herbalist"], cave: ["cave_miner"], jungle: ["jungle_mechanic", "jungle_botanist"], coast: ["coast_diver", "coast_lighthouse"], oasis: ["oasis_well", "oasis_trader"],
  city: ["city_conductor", "city_gardener"], dunesea: ["dunesea_surveyor", "dunesea_tinker"], cloudtemple: ["cloud_monk", "cloud_novice"], mesa: ["mesa_prospector", "mesa_potter"], inklake: ["inklake_scribe", "inklake_fisher"], maple: ["maple_forester", "maple_gatherer"] };
for (const [id, ids] of Object.entries(folk)) for (const nid of ids) {
  const n = maps[id].npcs.find((o) => o.id === nid);
  assert.ok(n && maps[id].reach[n.y * maps[id].w + n.x], `${id}: ${nid} stands on reachable ground`);
  assert.ok(fires[id].some(([x, y]) => Math.abs(x - n.x) + Math.abs(y - n.y) <= 2), `${id}: ${nid} stands beside a fire`);
  assert.equal(D.npcMap[nid], id, `${nid} is in the NPC registry`);
}
for (const q of D.side.filter((q) => /^sq_(meadow|forest|cave|jungle|coast|oasis|city|dunesea|cloudtemple|mesa|inklake|maple)_/.test(q.id))) assert.ok(D.npcMap[q.giver], `${q.id}: giver ${q.giver} exists`);
// audit of every side chain (a chain = quests linked by req.quest): giver exists, levels ascend, kill/elite monsters live in the field, titles are unique
{
  const byId = Object.fromEntries(D.side.map((q) => [q.id, q])), titles = new Map();
  for (const q of D.side) {
    assert.ok(D.npcMap[q.giver], `${q.id}: giver ${q.giver} exists`);
    const pre = q.req && q.req.quest && byId[q.req.quest];
    if (q.req && q.req.quest) assert.ok(pre, `${q.id}: prerequisite exists`);
    if (pre) assert.ok(q.req.lv >= pre.req.lv, `${q.id}: level does not drop below its prerequisite`);
    const t = q.reward && q.reward.title;
    if (t) { assert.ok(!titles.has(t), `${q.id}: title "${t}" is unique (also ${titles.get(t)})`); titles.set(t, q.id); }
    const g = q.goal || {}, home = D.npcMap[q.giver], m = /^sq_(city|dunesea|cloudtemple|mesa|inklake|maple|meadow|forest|cave|jungle|coast|oasis|crypt|sewer|abyss)_/.exec(q.id);
    if (m && (g.type === "kill" || g.type === "elite")) assert.ok(maps[m[1]].spawns.some((sp) => sp.k === g.mob), `${q.id}: ${g.mob} lives in ${m[1]}`);
    if (m && g.type === "elite") assert.equal(g.map, m[1], `${q.id}: elite goal on its own field`);
    if (m) assert.equal(home, m[1], `${q.id}: giver stands in ${m[1]}`);
  }
}
console.log("hunt routes: safe arrivals, adjacent bands, starter and late progression, capped arena");
// the packed dungeons' campfires are quiet ground: no pack is laid on a place to sit (33-maps-zones.js FIRE_QUIET)
for (const id of ["crypt", "sewer", "abyss"]) for (const [x, y] of fires[id]) assert.equal(maps[id].zone[y * maps[id].w + x], 0, `${id}: the campfire at ${x},${y} is safe ground`);
// the wide grounds have one more campfire, on safe ground far from the others (FIRE_EXTRA)
for (const [id, n] of [["dunesea", 4], ["city", 3], ["maple", 3], ["inklake", 3], ["meadow", 4], ["forest", 4], ["cave", 4], ["jungle", 4], ["coast", 4], ["oasis", 4], ["cloudtemple", 3], ["mesa", 3]]) {
  assert.equal(fires[id].length, n, `${id}: ${n} campfires`);
  assert.ok(fires[id].some(([x, y]) => maps[id].zone[y * maps[id].w + x] === 0 && maps[id].reach[y * maps[id].w + x] === 1), `${id}: a fire on quiet, reachable ground`);
}
