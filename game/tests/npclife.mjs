import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import { RESIDENTS } from "../public/townfolk.js";
import { loadLogic } from "../scripts/editor-lib.mjs";
import { readData } from "../scripts/build-logic.mjs";

const defs = L.defs(), H = defs.sky.dayMs / 24, DAY = H * 24;
const at = (h, day = 0) => day * DAY + h * H;
const adventurers = {
  adv_yeoul: ["town", "spear"], adv_sandeul: ["town", "sword"], adv_fullip: ["town", "bow"], adv_iseul: ["town", "staff"],
  adv_maru: ["willow", "hammer"], adv_daon: ["willow", "dagger"], adv_cheongsol: ["willow", "bow"], adv_janbyeol: ["willow", "book"],
};
const beach = [
  "beach_guide_naru", "beach_shell_dana", "beach_fisher_sori", "beach_boat_yul",
  "beach_gardener_onn", "beach_sketch_haru", "beach_hearth_bori", "beach_traveler_arin",
  "beach_dock_bada", "beach_peddler_milu", "beach_elder_haemi", "beach_child_sae",
];
const blossom = [
  "blossom_guard_yeon", "blossom_basket_bina", "blossom_bee_honey", "blossom_sketch_dodam", "blossom_walk_garam", "blossom_petals_nabi",
  "blossom_tea_maram", "blossom_courier_woon", "blossom_elder_chae", "blossom_musician_ara",
];
const cast = [
  "smith", "bank", "juju", "forge_tong", "r_peng", "story", "town_charm_juana",
  "elder", "hall_bori", "daily", "warp", "shop", "costume", "train", "town_job_arsen", "dimkeeper", "collector",
  "r_dotori", "r_kongal", "r_bodeul", "r_neogul", "r_gaegul", "r_saessak", "r_daenamu", "r_meongdae",
  "r_kkamang", "r_yeoreum", "r_jjik", "r_ggul", "r_riri", "r_noeul", "r_bawi2", "popo", "cafe_moka", ...Object.keys(adventurers), ...beach, ...blossom,
];
assert.deepEqual(L.lifeCheck(), []);
assert.deepEqual(defs.npclife.cast.map((row) => row[0]), cast);
assert.ok(Buffer.byteLength(JSON.stringify(defs.npclife)) < 32_000);
for (const [map, residents] of [["sunset_beach", beach], ["blossom_trail", blossom]]) {
  for (const id of residents) {
    const a = L.npcAt(id, at(17)), b = L.npcAt(id, at(17) + 1000);
    assert.deepEqual([a.map, a.act, a.moving], [map, "stroll", true]);
    assert.notDeepEqual([a.x, a.y], [b.x, b.y], `${id} walks around ${map}`);
    assert.ok(defs.npclife.lines[id].stroll.length);
  }
}
for (const resident of RESIDENTS) {
  const row = defs.npclife.cast.find(([id]) => id === resident.id);
  assert.deepEqual([row[1], row[2], row[3], row[10]], [resident.name, resident.look, resident.cos || [], resident.kid || 0]);
}
assert.equal(L.npcAt("missing", at(11)), null);
assert.equal(L.npcAt("smith", at(10)).map, "kangkang_forge", "the smith works inside the forge");
assert.equal(L.npcAt("smith", at(21)).map, "juju_diner");
assert.equal(L.npcAt("smith", at(21)).with, "bank");
assert.equal(L.npcAt("bank", at(21)).with, "smith");
assert.equal(L.npcAt("smith", at(25)).hidden, true);
assert.equal(L.npcAt("smith", at(21, 3)).place, "diner_bar");
assert.ok(L.npcsOn("juju_diner", at(21)).includes("smith"));
assert.equal(L.npcPlan("smith", at(21)).next.place, "forge_back");

for (const [first, second, map, place, h, day] of [
  ["elder", "hall_bori", "tales_cafe", "cafe_t3", 14, 1],
  ["shop", "costume", "tales_cafe", "cafe_t1", 21, 2],
  ["train", "town_job_arsen", "juju_diner", "diner_t2", 21, 0],
  ["town_job_arsen", "collector", "owl_library", "lib_table", 21, 3],
]) {
  const a = L.npcAt(first, at(h, day)), b = L.npcAt(second, at(h, day));
  assert.deepEqual([a.map, a.place, a.with, a.moving], [map, place, second, false]);
  assert.deepEqual([b.map, b.place, b.with, b.moving], [map, place, first, false]);
  const distance = Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
  assert.ok(distance > 0 && distance <= 2, `${first} and ${second} occupy neighbouring seats`);
}
assert.equal(L.npcAt("elder", at(14, 0)).onPost, true, "tea only happens on the paired days");
assert.equal(L.npcAt("train", at(21, 1)).map, "starlight_inn", "Kai eats at the inn on alternate days");

for (const [id, h, day, map, place, companion] of [
  ["r_dotori", 18, 0, "town", "fountain_play", "r_kongal"],
  ["r_kongal", 18, 0, "town", "fountain_play", "r_dotori"],
  ["r_meongdae", 21, 1, "town", "wall_pair", "r_kkamang"],
  ["r_kkamang", 21, 1, "town", "wall_pair", "r_meongdae"],
  ["r_bodeul", 18, 0, "town", "garden", "r_yeoreum"],
  ["r_yeoreum", 18, 0, "town", "garden", "r_bodeul"],
  ["r_jjik", 13, 0, "town", "forgeyard", "forge_tong"],
  ["r_ggul", 15, 0, "town", "terrace", "juju"],
  ["cafe_moka", 7, 0, "town", "flowers", "r_saessak"],
]) {
  const body = L.npcAt(id, at(h, day));
  assert.deepEqual([body.map, body.place, body.with, body.moving], [map, place, companion, false]);
  const peer = L.npcAt(companion, at(h, day));
  assert.equal(peer.place, place);
  const distance = Math.abs(body.tx - peer.tx) + Math.abs(body.ty - peer.ty);
  assert.ok(distance > 0 && distance <= 2, `${id} pairs with ${companion} on separate tiles`);
}
assert.equal(L.npcAt("r_meongdae", at(21)).place, "r_night");
assert.equal(L.npcAt("r_meongdae", at(21)).moving, true);
assert.equal(L.npcAt("r_yeoreum", at(21)).map, "owl_library");
assert.equal(L.npcAt("r_yeoreum", at(21, 1)).map, "town");
for (const id of ["willow_elder", "willow_fisher", "willow_florist", "willow_bard"]) {
  assert.equal(L.npcAt(id, at(10)), null, "Willow quest posts retain their stationary stage-one setup");
}

const world = L.setup(), other = L.setup();
L.addPlayer(world, "A", L.newChar("다람이"));
L.addPlayer(world, "B", L.newChar("다로미"));
L.addPlayer(other, "A", L.newChar("다롱이"));
const player = world.players.A;
L.tick(world, at(21));
L.tick(other, at(21));
assert.deepEqual(L.lifeWhere(world.now), L.lifeWhere(other.now));
assert.ok(L.lifeWhere(world.now).every(row => row.length === 5 && row.every(Number.isInteger)));
const snapshot = L.viewFor(world, "A");
assert.ok(snapshot.map && snapshot.nl.some(r => r[0] === 0 && r[1] === 2), "the smith's post remains while he eats");
assert.equal(snapshot.nw, undefined);
assert.ok(L.validateAction(world, "A", { t: "nw" }).ok);
L.applyAction(world, "A", { t: "nw" });
assert.deepEqual(L.viewFor(world, "A").nw, L.lifeWhere(world.now));
assert.equal(L.viewFor(world, "A").nw, undefined);
assert.equal(L.validateAction(world, "A", { t: "nw" }).ok, false, "one request every five seconds");
L.endTick(world);
assert.equal(L.viewFor(world, "A").nl, undefined, "steady snapshots carry no NPC rows");

const T = 16;
const { maps } = L.atlas(false, ["town", "kangkang_forge", "juju_diner", "owl_library", "dongdong_apt", "town_hall", "tales_cafe"]);
const put = (map, x, y) => { player.map = map; player.x = x; player.y = y; };
const talk = (npc) => L.validateAction(world, "A", { t: "sq", a: "talk", npc }).ok;
for (const [id, [map, weapon]] of Object.entries(adventurers)) {
  const row = defs.npclife.cast.find(([key]) => key === id);
  assert.match(row[1], /^모험가 /);
  assert.equal(row[12], weapon, `${id} sends its held weapon with the cast`);
  assert.ok(defs.npclife.lines[id].stroll.length >= 2);
  for (const h of [5, 12, 20, 26]) {
    const now = at(h), body = L.npcAt(id, now), later = L.npcAt(id, now + 500);
    assert.deepEqual([body.map, body.act, body.moving], [map, "stroll", true]);
    assert.notDeepEqual([body.x, body.y], [later.x, later.y], `${id} moves through the map`);
    assert.ok(L.lifeLegs(map, now).some(([i, mode]) => cast[i] === id && mode === 1), `${id} sends a walk path`);
  }
  world.now = at(10);
  const body = L.npcAt(id, world.now);
  put(map, body.x, body.y);
  assert.ok(talk(id), `${id} can be greeted in reach`);
  put(map, body.x + 160, body.y);
  assert.equal(talk(id), false, `${id} can only be greeted from nearby`);
}
for (const h of [5, 8, 12, 16, 20, 23, 26]) {
  world.now = at(h);
  const n = maps.town.npcs.find(n => n.id === "smith");
  put("town", n.x * T + 8, n.y * T + 12);
  assert.ok(talk("smith"), "the service post remains reachable");
  assert.equal(L.validateAction(world, "A", { t: "enh", s: 0 }).error === "대장장이가 너무 멉니다", false);
}
for (const id of ["elder", "shop", "costume", "train", "town_job_arsen", "collector"]) {
  world.now = at(21);
  const post = maps.town.npcs.find((n) => n.id === id);
  put("town", post.x * T + 8, post.y * T + 12);
  assert.equal(L.npcAt(id, world.now).onPost, false, `${id} is off its service post in the evening`);
  assert.ok(talk(id), `${id}'s original service post is still reachable`);
}
world.now = at(21.75);
for (const [id, postMap, bodyMap] of [
  ["popo", "town_hall", "juju_diner"],
  ["cafe_moka", "tales_cafe", "dongdong_apt"],
]) {
  const post = maps[postMap].npcs.find((n) => n.id === id);
  put(postMap, post.x * T + 8, post.y * T + 12);
  assert.equal(L.npcAt(id, world.now).map, bodyMap);
  assert.ok(talk(id), `${id}'s original service post is reachable after hours`);
}
for (const id of ["daily", "warp", "dimkeeper"]) {
  const post = maps.town.npcs.find((n) => n.id === id);
  for (const h of [6, 10, 19.8, 21, 25]) {
    const body = L.npcAt(id, at(h));
    assert.equal(body.map, "town");
    assert.ok(Math.hypot(body.tx - post.x, body.ty - post.y) <= 8, `${id} stays near its post at ${h}h`);
  }
}
world.now = at(21);
const smith = L.npcAt("smith", world.now);
put(smith.map, smith.x, smith.y);
assert.ok(talk("smith"), "talk to the moving NPC at their destination");
put(smith.map, smith.x + 160, smith.y);
assert.equal(talk("smith"), false, "an action cannot talk across the room");
world.now = at(25);
const home = L.npcAt("smith", world.now);
put(home.map, home.x, home.y);
assert.ok(talk("smith"), "knock while the smith is indoors");

// The route walks to the forge's door, crosses town, then arrives through the diner door.
const flags = new Set();
let moving;
for (let t = at(19.5); t < at(20.5); t += 125) {
  const a = L.npcAt("smith", t);
  assert.deepEqual(a, L.npcAt("smith", t));
  if (!a.moving) continue;
  moving ||= a;
  const place = defs.npclife.places[L.lifeWhere(t)[0][1]];
  assert.equal(place[1], a.map, "the directory follows the body through doors");
  for (const row of L.lifeLegs(a.map, t)) if (row[0] === 0 && row[1] === 1) {
    assert.ok(row.every(Number.isInteger), "leg rows use compact integer tiles and time");
    flags.add(row[5]);
  }
}
assert.ok(moving && [...flags].some(f => f & 1) && [...flags].some(f => f & 2));
assert.ok(L.lifeLegs("town", at(21), at(20.9)).length === 0);

for (let t = at(4); t < at(4, 4); t += 3_000) {
  const visited = new Set();
  for (const id of cast) {
    const a = L.npcAt(id, t);
    if (a.hidden || a.moving) continue;
    const key = [a.map, a.tx, a.ty].join("/");
    assert.ok(!visited.has(key), "two stationary NPCs cannot occupy " + key);
    visited.add(key);
  }
}

const { data } = readData();
data.npclife.places.diner_t3.spots.pop();
const cramped = await loadLogic({ data });
assert.ok(cramped.L.lifeCheck().some(s => s.includes("diner_t3") && s.includes("자리가 부족")), "bad seating is reported by the editor rules");
data.npclife.cast.forge_tong.plan[1].at = "lost_place";
const badPlan = await loadLogic({ data });
assert.ok(badPlan.L.lifeCheck().some(s => s.includes("forge_tong") && s.includes("올바르지")), "an unknown place fails data checks");
console.log("npclife ok");
