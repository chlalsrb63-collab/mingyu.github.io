// Regional weekly boss roster, entry validation, and rewards at the weekly reset.
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
assert.deepEqual(bosses.map((row) => [row[0], row[5], row[6]]), CHAL_KEYS.map(k => [k, chalRewardBit(k), FIXED.includes(k) ? 0 : 1]));
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

const open = (boss) => ({ t: "dim_open", boss });

function act(S, p, action) {
  const result = L.validateAction(S, p.pid, action);
  if (result.ok) L.applyAction(S, p.pid, action);
  return result;
}

function snap(S, p, now) {
  L.tick(S, now);
  const view = L.viewFor(S, p.pid);
  L.endTick(S);
  return view;
}

function enter(S, p, key) {
  const result = act(S, p, open(key));
  assert.ok(result.ok, result.error);
  const dim = S.dims[p.map];
  assert.equal(dim?.chal.k, key);
  assert.equal(dim.map.dim.bossK, key);
  return dim;
}

function defeat(S, p, dim, big) {
  const boss = dim.rt.mobs.find((m) => m.id === dim.boss);
  assert.equal(boss?.k, dim.chal.k);
  // Use the damage path and the regular chest tick; no synthetic carry or reward flags.
  p.x = boss.x;
  p.y = boss.y;
  assert.ok(dealMob(S, dim.rt, boss, p, Math.ceil(boss.hp * boss.hk), 0));
  assert.equal(dim.state, "clear");
  const { dr } = snap(S, p, S.now + 100);
  assert.deepEqual(dr.slice(0, 2), [1, CHAL_KEYS.indexOf(boss.k)]);
  assert.equal(dr[3] & 8, big ? 8 : 0);
  const def = DIM_CHAL.bosses[boss.k];
  const reward = big ? (def.rotation ? DIM_CHAL.rotationBig : def.big || DIM_CHAL.big) : DIM_CHAL.small;
  assert.equal(dr[4], reward.gold * dim.lv);
  assert.equal(act(S, p, { t: "dim_leave" }).ok, true);
}

{
  const S = world(MONDAY - 60_000), p = hero(S);
  assert.equal(snap(S, p, S.now + 10).self.dimr[6], CHAL_KEYS.indexOf(activeBefore));
  for (const key of FIXED) assert.ok(L.validateAction(S, p.pid, open(key)).ok, `${key} stays available`);
  for (const key of ROTATION.filter((key) => key !== activeBefore)) {
    assert.equal(act(S, p, open(key)).ok, false, `${key} is outside this week's rotation`);
  }
  assert.equal(Object.keys(S.dims).length, 0);
  defeat(S, p, enter(S, p, FIXED[0]), true);
  assert.equal(p.ch.dim.bw, 1);
  defeat(S, p, enter(S, p, activeBefore), true);
  assert.equal(p.ch.dim.bw, 1 | ROTATION_BIT, "regional clear leaves the original boss flag intact");
  defeat(S, p, enter(S, p, activeBefore), false);
  assert.equal(p.ch.dim.bw, 1 | ROTATION_BIT, "a regional repeat earns only the small chest");
}

{
  const S = world(MONDAY - 1000), p = hero(S);
  const dim = enter(S, p, activeBefore);
  assert.equal(snap(S, p, S.now + 10).self.dimr[6], CHAL_KEYS.indexOf(activeBefore));
  assert.deepEqual(snap(S, p, MONDAY).self.dimr.slice(4), [0, 0, CHAL_KEYS.indexOf(activeAfter)]);
  assert.equal(S.dims[p.map]?.chal.k, activeBefore, "an existing arena survives the rotation");
  defeat(S, p, dim, false);
  assert.equal(p.ch.dim.bw, 0, "the previous week's arena cannot spend the new week's allowance");
  assert.equal(act(S, p, open(activeBefore)).ok, false, "new entries use the new selection");
  defeat(S, p, enter(S, p, activeAfter), true);
  assert.equal(p.ch.dim.bw, ROTATION_BIT);
}

{
  const S = world(MONDAY - 1000), p = hero(S), other = hero(S, "member");
  assert.ok(act(S, p, { t: "pinv", e: other.eid }).ok);
  assert.ok(act(S, other, { t: "pacc" }).ok);
  assert.ok(act(S, p, open(activeBefore)).ok);
  const pending = S.parties[p.party].rc;
  assert.ok(pending);
  snap(S, p, MONDAY);
  assert.equal(act(S, other, { t: "dim_ready", id: pending.id, ok: 1 }).ok, false);
  assert.equal(p.map, "town");
  assert.equal(other.map, "town");
  assert.equal(Object.keys(S.dims).length, 0, "an unanswered old invitation cannot open an arena after reset");
}

console.log("regional bosses ok — roster, weekly reset, entry and chest eligibility");
