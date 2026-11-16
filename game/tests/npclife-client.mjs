import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import * as NPC from "../public/npclife.js";

const day = 48 * 60_000;
const dawn = day / 6;
const now = dawn + 25_000;
const plaza = { id: "town", npcs: [{ id: "smith", x: 4, y: 5, role: "smith" }, { id: "old", x: 7, y: 8 }] };
const diner = { id: "diner", npcs: [] };
const defs = {
  sky: { dayMs: day }, maps: [{ id: "town", name: "버드나무광장" }],
  npclife: {
    cast: [
      ["smith", "볼칸", [0], [], "town", [], "hammer", null, null, null, 0, "smith"],
      ["resident", "주민", [1, 2], [], null, [], null],
    ],
    places: [["table", "diner", "쥬쥬식당"], ["map:town", "town", "버드나무광장"]],
    acts: ["work", "walk", "eat", "stroll"], rel: [[0, 1, "friend"]],
    chat: [[0, 1, ["어서 오게.", "반가워요."]]], lines: { smith: { eat: ["밥부터 먹세."] } },
  },
};
const point = (body) => [body.x, body.y, body.dir];

NPC.load(plaza, defs);
assert.deepEqual(NPC.list(now).map((body) => body.id), ["smith"]);
assert.deepEqual(point(NPC.at("smith", now)), [72, 92, 0]);
assert.ok(NPC.at("smith", now).onPost);
assert.equal(NPC.cast("old"), null, "legacy posts are outside the schedule model");
assert.equal(NPC.cast("resident").resident, true);
assert.equal(NPC.at("smith", now).pose, "hammer");
assert.equal(NPC.lines("smith").eat[0], "밥부터 먹세.");
assert.deepEqual(NPC.relationships(), [{ a: "smith", b: "resident", kind: "friend", chat: ["어서 오게.", "반가워요."] }]);

NPC.onLegs([[0, 1, 25, 29, 1, 3, 1, 2, 3, 2, 3, 4]], now);
assert.equal(NPC.at("smith", now).fade, 0);
assert.equal(NPC.at("smith", now + 150).fade, 0.5);
assert.deepEqual(point(NPC.at("smith", now + 1000)), [40, 44, 2]);
assert.deepEqual(point(NPC.at("smith", now + 2000)), [56, 44, 0]);
assert.equal(NPC.at("smith", now + 3850).fade, 0.5);
assert.equal(NPC.at("smith", now + 4000), null);
NPC.onLegs([[99, 2, 33], [0, 2, 33]], now + 4000);
NPC.onLegs(undefined, now + 6000);
assert.equal(NPC.at("smith", now + day), null, "an away post stays empty without a fresh row");
NPC.onLegs([[0, 0, 4, 5, 2, 0, 44]], now + 7000);
assert.deepEqual(point(NPC.at("smith", now + 7000)), [72, 92, 2]);

NPC.track("smith");
assert.ok(NPC.needsWhere(now));
NPC.markWhereAsked(now);
assert.equal(NPC.needsWhere(now + 19_999), false);
NPC.onWhere([[0, -1, 0, 47, 0], [1, 1, 1, 65, 0]], now);
assert.equal(NPC.locations()[0].place, "버드나무광장");
assert.equal(NPC.locations()[0].map, "town");
assert.equal(NPC.locations()[0].nextPlaceId, "table");
assert.equal(NPC.locations()[1].placeId, "map:town");
assert.equal(NPC.locations()[1].act, "walk");
assert.equal(NPC.needsWhere(now + 20_000), false, "the location is still current");
assert.equal(NPC.needsWhere(now + 22_000), true);

NPC.load(diner, defs);
assert.equal(NPC.tracked(), "smith");
assert.equal(NPC.locations()[0].nextPlaceId, "table", "worldwide locations survive a door transition");
assert.equal(NPC.at("smith", now), null);
NPC.onLegs([[0, 0, 2, 3, 1, 2, 47, 1], [1, 0, 3, 3, 3, 2, 47, 0]], now);
assert.equal(NPC.at("smith", now).with, "resident");
assert.equal(NPC.at("smith", now).pose, "sip");
assert.equal(NPC.at("smith", now).post, null);
assert.equal(NPC.at("smith", now).role, "smith");
assert.equal(NPC.at("smith", now).onPost, false);

NPC.onLegs([[1, 1, 25, 30, 3, 4, 0, 0, 2, 0, 2, 2, 0, 2, 0, 0]], now);
assert.deepEqual(point(NPC.at("resident", now + 1000)), [40, 28, 0]);
assert.deepEqual(point(NPC.at("resident", now + 3000)), [24, 12, 2]);
assert.deepEqual(NPC.at("resident", now + 5000), NPC.at("resident", now + 6000), "an expired round holds its last pose");
NPC.onLegs([[1, 1, 25, 29, 1, 0, 2, 3]], now);
assert.deepEqual(point(NPC.at("resident", now + 1000)), [40, 60, 0], "a one-point path stays finite");

const nextDawn = dawn + day;
NPC.onLegs([[0, 1, 2879, 2883, 1, 0, 1, 2, 5, 2]], nextDawn - 500);
assert.deepEqual(point(NPC.at("smith", nextDawn + 1000)), [56, 44, 2]);
NPC.onLegs([[0, 1, -1, 3, 1, 0, 1, 2, 5, 2]], nextDawn - 100);
assert.deepEqual(point(NPC.at("smith", nextDawn + 1000)), [56, 44, 2], "a new-day row may arrive before the displayed clock rolls over");
assert.equal(NPC.at("smith", nextDawn + 4000).moving, false);

const liveDefs = L.defs();
const evening = liveDefs.sky.dayMs * 21 / 24;
for (const map of ["town", "juju_diner"]) {
  NPC.load({ id: map, npcs: plaza.npcs }, liveDefs);
  NPC.onLegs(L.lifeLegs(map, evening), evening);
  const client = NPC.at("smith", evening);
  const live = L.npcAt("smith", evening);
  if (map === live.map) assert.deepEqual(point(client), [live.x, live.y, live.dir]);
  else assert.equal(client, null);
}
NPC.onWhere(L.lifeWhere(evening), evening);
const smithLocation = NPC.locations().find((entry) => entry.id === "smith");
const [placeId, mapId, placeName] = liveDefs.npclife.places.find(([id]) => id === L.npcPlan("smith", evening).place);
assert.deepEqual([smithLocation.placeId, smithLocation.map, smithLocation.place], [placeId, mapId, placeName]);

const willow = { id: "willow", npcs: [] };
NPC.load(willow, liveDefs);
NPC.onLegs(L.lifeLegs(willow.id, evening), evening);
const daon = NPC.at("adv_daon", evening), line = NPC.lines(daon.id).stroll[0];
assert.equal(daon.weapon, "dagger");
assert.ok(daon.moving);
const far = { x: daon.x, y: daon.y - 120 };
assert.equal(NPC.adventurerBubble(far, 0, evening), null, "adventurer greets only nearby players");
assert.equal(NPC.adventurerBubble(daon, 100, evening, false), null, "a dialogue window suppresses the greeting");
const greeting = NPC.adventurerBubble(daon, 200, evening);
assert.equal(greeting.b.text, line);
const next = NPC.at(daon.id, evening + 250);
const following = NPC.adventurerBubble(daon, 450, evening + 250);
assert.deepEqual([following.x, following.y], [next.x, next.y]);
assert.equal(following.b, greeting.b, "an advancing greeting follows its speaker without restarting");
assert.equal(NPC.adventurerBubble(daon, greeting.b.until + 1, evening), null, "staying nearby does not repeat the greeting");
NPC.adventurerBubble(far, 3900, evening);
assert.equal(NPC.adventurerBubble(daon, 4000, evening).b.t0, 4000, "leaving and coming back is a new greeting");

NPC.load(null, null);
assert.equal(NPC.tracked(), null);
assert.equal(NPC.needsWhere(now), false);
assert.deepEqual(NPC.list(now), []);
console.log("NPC life client: sparse legs, doors, rounds, clock rollover, and resident tracking");
