// Regional weekly boss roster and its weekly reset (the tables). The challenge entry itself is gone: the bosses are raids now (tests/raids.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { CHAL_KEYS, CHAL_ROTATION, DIM_CHAL, DIM_TOWN, chalOfWeek, chalRewardBit, dealMob, weekOf };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const { CHAL_KEYS, CHAL_ROTATION, DIM_CHAL, DIM_TOWN, chalOfWeek, chalRewardBit, dealMob, weekOf } = L.__t;
const FIXED = ["boss", "abyssboss", "cloakbat", "bloomwhale"];
const ROTATION_BIT = 16;
const ROTATION = ["wickregent", "knotwidow", "knellkeeper", "loomcolossus", "sluiceleviathan", "prismcantor"];
const MONDAY = Date.UTC(2026, 10, 15, 21); // Monday November 16 at 06:00 KST
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

assert.deepEqual(CHAL_KEYS, [...FIXED, ...ROTATION]);
assert.deepEqual(CHAL_ROTATION, ROTATION);
assert.deepEqual(CHAL_KEYS.map(chalRewardBit), [1, 2, 4, 8, ...ROTATION.map(() => ROTATION_BIT)]);
const bosses = L.defs().dim.chal.bosses;
assert.deepEqual(bosses.map((row) => [row[0], row[6], row[7]]), CHAL_KEYS.map(k => [k, chalRewardBit(k), FIXED.includes(k) ? 0 : 1]));
assert.equal(weekOf(MONDAY), weekOf(MONDAY - 1) + 1);
const activeBefore = chalOfWeek(MONDAY - 1);
const activeAfter = chalOfWeek(MONDAY);
assert.equal(activeAfter, ROTATION[(ROTATION.indexOf(activeBefore) + 1) % ROTATION.length]);
const upcoming = ROTATION.map((_, i) => {
  const monday = MONDAY + WEEK_MS * i;
  const key = chalOfWeek(monday);
  assert.equal(chalOfWeek(monday + WEEK_MS - 1), key, "one boss for the entire week");
  return key;
});
assert.deepEqual([...upcoming].sort(), [...ROTATION].sort());
assert.equal(chalOfWeek(MONDAY + WEEK_MS * ROTATION.length), activeAfter);

function world(now) {
  const S = L.setup();
  S.now = S.last = now;
  return S;
}

function hero(S, id = "leader") {
  const ch = L.hero(id === "leader" ? "등불" : "심지", { wk: "sword", lvl: 200, migrate: true });
  const [x, y] = DIM_TOWN.keeper;
  ch.map = "town";
  ch.x = x * 16 + 8;
  ch.y = (y - 1) * 16 + 10;
  L.addPlayer(S, id, ch);
  return S.players[id];
}
{
  const S = world(MONDAY), p = hero(S);
  L.tick(S, S.now);
  const v = L.validateAction(S, p.pid, { t: "dim_open", boss: CHAL_KEYS[0] });
  assert.ok(!v.ok && /레이드/.test(v.error), "the old challenge entry points to the raids");
}

console.log("regional bosses ok — roster, weekly reset, the old entry refused");
