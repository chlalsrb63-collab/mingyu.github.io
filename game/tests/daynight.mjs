// Headless test of the turning day, the weather and the night campfire: node tests/daynight.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs(), SKY = D.sky;
const DAY = SKY.dayMs, HOUR = DAY / 24;
const BASE = 1763000000000 - (1763000000000 % DAY);   // a real-looking clock at midnight outdoors
const at = (h, day = 0) => BASE + day * DAY + h * HOUR;

// ── the day: one 48-minute cycle, five phases, the same for every caller and every map
assert.equal(DAY, 48 * 60000, "one day outdoors is 48 real minutes");
const want = [[0, "밤"], [3, "밤"], [5, "새벽"], [8, "아침"], [12, "낮"], [16.9, "낮"], [18, "노을"], [19.6, "밤"], [23.9, "밤"]];
for (const [h, name] of want) {
  const s = L.skyAt("town", at(h));
  assert.equal(s.name, name, `${h}:00 is ${name}, got ${s.name}`);
  assert.ok(Math.abs(s.hour - h) < 1e-6);
  assert.equal(s.night, name === "밤");
  // the client's copy of the clock (defs) gives the same answer
  const hh = ((at(h) % DAY) / DAY) * 24;
  let ph = SKY.phases.length - 1;
  for (let i = SKY.phases.length - 1; i >= 0; i--) if (hh >= SKY.phases[i][1]) { ph = i; break; }
  assert.equal(SKY.phases[ph][0], name, "the client clock agrees at " + h);
  assert.deepEqual(L.skyAt("meadow", at(h)).phase, s.phase, "every map shares the hour");
  assert.deepEqual(L.skyAt("town", at(h, 3)).name, name, "and every day repeats it");
}

// ── the weather: a pure function of map and time, steady within a slot, varied across them
const outdoorMaps = ["town", "meadow", "forest", "city", "maple"];   // maple: theme autumn
for (const id of outdoorMaps) {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const t = BASE + i * SKY.wxMs + 1234;
    const w = L.skyAt(id, t).wx;
    assert.ok(w >= 0 && w < SKY.weather.length, `${id}: a weather from the table`);
    assert.equal(L.skyAt(id, t).wx, w, "asked twice, the same answer");
    // the same slot gives the same weather from start to end (fog may burn off at noon)
    const end = L.skyAt(id, t + SKY.wxMs - 2000).wx;
    if (w !== 3 && end !== 3) assert.equal(end, w, `${id}: one weather per slot`);
    if (L.skyAt(id, t).name === "낮") assert.notEqual(w, 3, "no fog at midday");
    seen.add(w);
  }
  assert.ok(seen.has(0) && seen.has(1) && seen.has(2), `${id} sees clear, cloud and rain: ${[...seen]}`);
  if (id === "city" || id === "town") assert.ok(!seen.has(5), "no snow in the plaza or the city");
}
for (const id of ["cave", "crypt", "sewer", "abyss"]) assert.equal(L.skyAt(id, at(12)).wx, -1, `${id} has no sky`);
// two worlds (two channels) agree on the weather
const S1 = L.setup(), S2 = L.setup();
const nowWx = at(13, 2);
L.tick(S1, nowWx); L.tick(S2, nowWx + 50);
for (const id of outdoorMaps) assert.equal(L.runtime(S1, id).wx, L.runtime(S2, id).wx, "every channel shares the sky");

// ── the weather on the wire: on arrival, when it turns, and once a minute
{
  const S = L.setup();
  let now = BASE + 7 * SKY.wxMs;
  const view = (pid) => JSON.parse(JSON.stringify(L.viewFor(S, pid)));
  L.addPlayer(S, "p-a", L.newChar("하늘이", "warrior", []));
  L.addPlayer(S, "p-b", L.newChar("구름이", "mage", []));
  L.tick(S, now);
  const va = view("p-a"), vb = view("p-b");
  L.endTick(S);
  assert.ok(Array.isArray(va.dn) && va.dn.length === 2, "the sky comes with the map");
  assert.deepEqual(va.dn, vb.dn, "both players see the same sky");
  assert.equal(va.dn[0], L.skyAt("town", now).wx);
  assert.equal(va.dn[1], Math.floor(now / 1000), "with the server clock in seconds");
  now += 100; L.tick(S, now);
  assert.equal(view("p-a").dn, undefined, "not every tick");
  L.endTick(S);
  // find the next slot where the town's weather turns
  let t = now;
  while (L.skyAt("town", t).wx === L.skyAt("town", now).wx) t += SKY.wxMs;
  L.tick(S, t);
  assert.equal(view("p-a").dn[0], L.skyAt("town", t).wx, "a change is sent at once");
  L.endTick(S);
}

// ── the night campfire: stumps, warmth that grows with company, songs and toasts
const S = L.setup();
let now = at(12);                         // noon: no night bonus
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const ids = ["c-1", "c-2", "c-3", "c-4", "c-5"];
ids.forEach((id, i) => L.addPlayer(S, id, L.newChar("불멍" + i, ["warrior", "rogue", "lancer", "mage", "warrior"][i], [])));
const P = ids.map((id) => S.players[id]);
L.tick(S, now); L.endTick(S);
const camp = L.skyAt("town", now).camps[0], fire = L.runtime(S, "town").fires[0];
assert.ok(camp, "the town's fire has a camp");
assert.equal(camp.x, fire.x); assert.equal(camp.y, fire.y);
assert.equal(camp.seats.length, 4, "four stumps around the town's fire");
for (const [x, y] of camp.seats) assert.ok(Math.hypot(x - fire.x, y - fire.y) <= D.fireR, "every stump is within the fire's warmth");
for (const id of ["meadow", "forest"]) for (const c of L.skyAt(id, now).camps) assert.ok(c.seats.length >= 1 && c.seats.length <= 3, `${id}: a wild camp seats one to three`);

// sit spots: standing near a stump and sitting puts you on it, facing the fire
const near = (p, x, y) => { p.x = x; p.y = y; p.mvAt = now; p.hitAt = -1e9; };
near(P[0], camp.seats[0][0] + 6, camp.seats[0][1] - 5);
assert.ok(act(ids[0], { t: "sit" }).ok);
assert.equal(P[0].sit, true);
assert.deepEqual([P[0].x, P[0].y], camp.seats[0], "sat down on the stump");
assert.equal(P[0].fix, true, "the client is told where it sits");
const dx = fire.x - P[0].x, dy = fire.y - P[0].y;
assert.equal(P[0].dir, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0, "facing the fire");
// a taken stump is not shared: the second sits where they stand
near(P[1], camp.seats[0][0] - 3, camp.seats[0][1] + 4);
const before = [P[1].x, P[1].y];
assert.ok(act(ids[1], { t: "sit" }).ok);
assert.deepEqual([P[1].x, P[1].y], before, "the stump was taken");
assert.ok(act(ids[1], { t: "sit" }).ok && !P[1].sit, "sitting again stands you up");
// far from every stump, you sit where you are
near(P[1], fire.x + 200, fire.y);
assert.ok(act(ids[1], { t: "sit" }).ok && P[1].sit && P[1].x === fire.x + 200);
act(ids[1], { t: "sit" });

// warmth by company: 1–4 sitters, the fifth adds nothing
let run = 0;
const warmAfter = (n, night) => {
  const T0 = night ? at(22, 5 + ++run) : at(12, 5 + ++run);
  now = T0;
  for (const p of P) { p.sit = false; p.warm = 0; p.warmPct = 0; p.warmN = 0; p.warmT = 0; }
  for (let i = 0; i < n; i++) {
    const seat = camp.seats[i] || [fire.x + 4, fire.y + 20];
    near(P[i], seat[0], seat[1]);
    assert.ok(act(ids[i], { t: "sit" }).ok);
  }
  for (let k = 0; k < 8; k++) { now += 1100; L.tick(S, now); L.endTick(S); }
  return P.slice(0, n).map((p) => [p.warmPct, p.warmN]);
};
const [, base, step, nightBonus, regen] = SKY.warm;
for (let n = 1; n <= 5; n++) {
  const k = Math.min(n, 4);
  for (const [pct, wn] of warmAfter(n, false)) { assert.equal(pct, base + step * (k - 1), `${n} sitting by day: +${base + step * (k - 1)}%`); assert.equal(wn, k); }
  for (const [pct] of warmAfter(n, true)) assert.equal(pct, base + step * (k - 1) + nightBonus, `${n} sitting by night`);
}
assert.equal(base + step * 3 + nightBonus, 20, "four at night tops out at +20%, the old cap");
assert.ok(regen * 4 <= 0.02, "warm regen stays at or under 2%/s");
// songs and toasts: only sitting; a toast only by a fire; never too fast
for (const p of P) { p.sit = false; p.emoAt = 0; }
near(P[2], fire.x + 200, fire.y);
assert.equal(act(ids[2], { t: "jam", k: 0 }).ok, false, "a song needs a seat");
act(ids[2], { t: "sit" });
assert.ok(act(ids[2], { t: "jam", k: 0 }).ok, "strumming while sitting anywhere");
assert.ok(L.runtime(S, "town").ev.some((e) => e[0] === "j" && e[1] === P[2].eid && e[2] === 0), "everyone around hears it");
assert.equal(act(ids[2], { t: "jam", k: 0 }).ok, false, "not again at once");
now += 2000;
assert.equal(act(ids[2], { t: "jam", k: 1 }).ok, false, "a toast is for the fireside");
near(P[3], camp.seats[1][0], camp.seats[1][1]); act(ids[3], { t: "sit" });
assert.ok(act(ids[3], { t: "jam", k: 1 }).ok, "cheers by the fire");
for (const bad of [2, -1, "0", null, 0.5]) assert.equal(act(ids[3], { t: "jam", k: bad }).ok, false, "no such gesture: " + bad);

// ── the storyteller: by the town's fire at night only, a tale every hundred seconds
assert.equal(L.skyAt("town", at(12)).npc, null, "she sleeps by day");
assert.equal(L.skyAt("town", at(18)).npc, null, "and at sunset");
const teller = L.skyAt("town", at(21)).npc;
assert.ok(teller && teller.night === 1 && teller.name === SKY.teller, "she is out at night");
assert.equal(L.skyAt("meadow", at(21)).npc, null, "only in town");
assert.ok(L.atlas().maps.town.npcs.some((n) => n.id === teller.id && n.night), "the map lists her, marked for the night");
{
  const W = L.setup();
  L.addPlayer(W, "t-1", L.newChar("이야기", "mage", []));
  const tales = [];
  for (let t = at(12, 9); t < at(12, 10); t += 5000) {
    L.tick(W, t);
    const v = L.viewFor(W, "t-1");
    for (const e of v.ev || []) if (e[0] === "tl") tales.push([t, e[1]]);
    L.endTick(W);
  }
  assert.ok(tales.length >= 8, "a night is long enough for many tales: " + tales.length);
  for (const [t, i] of tales) {
    assert.ok(L.skyAt("town", t).night, "a tale is told only at night");
    assert.ok(i >= 0 && i < SKY.tales.length && typeof SKY.tales[i] === "string");
  }
  // nightfall starts the first tale at once; after that, one every hundred seconds
  for (let i = 2; i < tales.length; i++) assert.ok(tales[i][0] - tales[i - 1][0] >= 95000, "one tale every hundred seconds");
}

// ── weather flavour: rain brings the fish sooner, fog hides you a little
{
  let tr = BASE, tc = BASE;
  while (L.skyAt("town", tr).wx !== 2) tr += SKY.wxMs;
  while (L.skyAt("town", tc).wx !== 0) tc += SKY.wxMs;
  const W = L.setup();
  L.addPlayer(W, "f-1", L.newChar("낚시왕", "mage", []));
  const p = W.players["f-1"];
  p.x = 34 * 16 + 8; p.y = 18 * 16 + 8; p.hitAt = -1e9;
  const waits = (t0) => {
    let max = 0;
    for (let i = 0; i < 40; i++) {
      const t = t0 + 10 + i;
      L.tick(W, t); L.endTick(W); W.now = t; p.fish = null;
      const v = L.validateAction(W, "f-1", { t: "fish" });
      assert.ok(v.ok, "can fish from the dock: " + v.error);
      L.applyAction(W, "f-1", { t: "fish" });
      max = Math.max(max, p.fish.at - t);
    }
    return max;
  };
  const rain = waits(tr), clear = waits(tc);
  assert.ok(rain <= 7000 * 0.75 + 1, "in the rain a bite comes within 5.25 s: " + rain);
  assert.ok(clear > rain, "sooner than on a clear day");
}
{
  let tf = BASE + 3 * HOUR;
  while (L.skyAt("meadow", tf).wx !== 3 || !L.skyAt("meadow", tf).night) tf += SKY.wxMs;
  let tc = BASE;
  while (L.skyAt("meadow", tc).wx !== 0) tc += SKY.wxMs;
  const sees = (t) => {
    const W = L.setup();
    L.addPlayer(W, "g-1", L.newChar("안개", "rogue", []));
    const p = W.players["g-1"], rt = L.runtime(W, "meadow");
    L.runtime(W, "town").n = 0; p.map = "meadow"; rt.n = 1;
    p.x = 40 * 16 + 8; p.y = 25 * 16 + 10;
    L.tick(W, t - 100); L.endTick(W); // the meadow's cells wake around the hunter
    const mob = rt.mobs.find((m) => !m.dead && D.mobs[m.k].aggro > 0 && !D.mobs[m.k].chest);
    for (const m of rt.mobs) if (m !== mob) { m.dead = true; m.temp = false; m.respAt = Infinity; }
    p.x = mob.x + 0.95 * D.mobs[mob.k].aggro; p.y = mob.y; p.hitAt = -1e9;
    mob.st = 0; mob.tgt = null; mob.hx = mob.x; mob.hy = mob.y;
    L.tick(W, t);
    return !!mob.tgt;
  };
  assert.equal(sees(tc), true, "in clear weather a monster sees you at 95% of its range");
  assert.equal(sees(tf), false, "in fog it does not");
}

console.log("daynight ok");
