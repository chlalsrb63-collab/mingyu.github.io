// Every side quest can be finished: collect/make/deliver items have a source, visit targets exist.
import assert from "node:assert/strict";
import fs from "node:fs";
import { defs } from "../src/logic.js";

const D = defs();
const mapIds = new Set(D.maps.map((m) => m.id));
const sold = new Set(D.shop);
for (const f of fs.readdirSync(new URL("../data/maps/", import.meta.url)).filter((f) => f.endsWith(".json")))
  for (const n of JSON.parse(fs.readFileSync(new URL(`../data/maps/${f}`, import.meta.url))).npcs || []) for (const g of n.goods || []) sold.add(g);
const rules = fs.readdirSync(new URL("../src/logic/", import.meta.url)).map((f) => fs.readFileSync(new URL(`../src/logic/${f}`, import.meta.url), "utf8")).join("\n");
const dropped = (id) => new RegExp(`\["${id}",\s*[\d.]+`).test(rules);   // MOBS[k].drops rows
const made = (id) => D.life.recipes.some((r) => r.out[0] === id && !r.sq);
const byId = Object.fromEntries(D.side.map((q) => [q.id, q]));
const rewarded = (q, id, seen = new Set()) => { // an earlier step of the chain hands it out
  const p = q.req.quest && byId[q.req.quest];
  return !!p && !seen.has(p.id) && (p.reward.items.some((it) => it[0] === id) || rewarded(p, id, seen.add(p.id)));
};
const gathered = (id) => D.life.mats.includes(id) || D.items[id].type === "fish" || D.items[id].type === "lmat";

for (const q of D.side) {
  const g = q.goal, it = D.items[g.item];
  if (g.type === "visit") assert.ok(mapIds.has(g.map), `${q.id}: visit map ${g.map} exists`);
  if (g.type === "collect") {
    const ok = it.type === "quest" ? !!g.mob || !!g.rift : sold.has(g.item) || gathered(g.item) || dropped(g.item) || made(g.item) || rewarded(q, g.item);
    assert.ok(ok, `${q.id}: collect ${g.item} has a source`);
  }
  if (g.type === "make") assert.ok(D.life.recipes.some((r) => r.out[0] === g.item), `${q.id}: recipe for ${g.item}`);
  if (g.type === "deliver") assert.equal(it.type, "quest", `${q.id}: parcel ${g.item} is a quest item given on take`);
}
console.log("quest-items ok");
