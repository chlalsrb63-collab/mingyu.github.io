// 쉼표 수첩 (69-rest.js): the resting spots stand on walkable tiles, sitting by one stamps it once a day (more at 노을),
// 여유 grows with the stamps and ends, the book fills once; the stroll finds are the same all day, picked once, in reach only;
// hostile input, the wire, an old sheet. node tests/rest.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { REST_T, REST_SPOTS, REST_MAPS, REST_NAME, restFinds, restPct, restClean, mapOf, freeTile, stats, T, FIRES, dayOf };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, R = X.REST_T, T = X.T, D = L.defs();
const DAY = D.sky.dayMs, HOUR = DAY / 24, BASE = 1763000000000 - (1763000000000 % DAY);

// ── the table: twelve spots, three a map, each on a tile one can walk to and away from the campfire stumps
assert.equal(X.REST_SPOTS.length, 12);
for (const map of X.REST_MAPS) assert.equal(X.REST_SPOTS.filter((s) => s[0] === map).length, 3, `${map}: three spots`);
for (const [map, x, y, name] of X.REST_SPOTS) {
  const m = X.mapOf(map);
  assert.ok(m.safe, `${name}: a safe map`);
  assert.deepEqual(X.freeTile(m, x, y), [x, y], `${name}: one can stand there`);
  assert.ok(m.reach[y * m.w + x], `${name}: reachable`);
  for (const n of m.npcs || []) assert.ok(Math.hypot(n.x - x, n.y - y) >= 4, `${name}: F is free here (${n.name} stands apart)`);
  for (const [fx, fy] of X.FIRES[map] || []) assert.ok(Math.hypot(fx - x, fy - y) * T > 60 + R.reach, `${name}: clear of the fire's stumps`);
}
assert.deepEqual(D.rest.spots[0], ["town", 49, 42, "광장 분수 앞"]);
assert.equal(D.rest.finds, R.finds);
for (const map of X.REST_MAPS) assert.equal(X.REST_NAME[map], X.mapOf(map).name, `${map}: the name the map gives itself`);

// ── a world with two players
const S = L.setup();
let now = BASE + 12 * HOUR;   // noon
S.now = now;
L.addPlayer(S, "r-1", L.newChar("쉼표", "warrior", []));
L.addPlayer(S, "r-2", L.newChar("산책", "mage", []));
const p = S.players["r-1"], q = S.players["r-2"];
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const secs = (n) => { for (let i = 0; i < n; i++) { now += 1000; L.tick(S, now); L.endTick(S); } };
const go = (pl, map, tx, ty, dx = 0) => {
  if (pl.map !== map) { L.runtime(S, pl.map).n--; pl.map = map; L.runtime(S, map).n++; pl.sendMap = true; }
  pl.x = tx * T + 8 + dx; pl.y = ty * T + 8; pl.sit = false; pl.restT = 0;
};
const spot = (i) => X.REST_SPOTS[i];
const sitAt = (pl, i, dx = 0) => { go(pl, spot(i)[0], spot(i)[1], spot(i)[2], dx); assert.ok(act(pl.pid, { t: "sit" }).ok); assert.ok(pl.sit); };
assert.equal(p.ch.rest.s, 0, "a new sheet has the book");
secs(1);

// ── 쉬어가기: eight seconds sitting by the fountain
let gold = p.ch.gold;
const xp0 = X.stats(p).xp;
sitAt(p, 0, 20);
secs(R.sitSec - 1);
assert.equal(p.ch.rest.s, 0, "not yet");
secs(1);
assert.equal(p.ch.rest.s, 1, "stamped");
assert.equal(p.ch.rest.book, 1);
assert.equal(p.ch.gold, gold + R.gold, "noon pays the plain gold");
assert.equal(X.restPct(p.ch, now), R.pct);
assert.equal(X.stats(p).xp, xp0 + R.pct, "여유 is an experience bonus");
assert.equal(p.ch.rest.until, now + R.ms);
// the same spot again today: nothing more
gold = p.ch.gold; secs(R.sitSec * 2);
assert.equal(p.ch.gold, gold, "one stamp a day a spot");
// standing by a spot, or sitting away from one: nothing
go(p, "town", spot(1)[1], spot(1)[2]); secs(R.sitSec + 2);
assert.equal(p.ch.rest.s, 1, "standing does not count");
go(p, "town", spot(1)[1] - 6, spot(1)[2]); act("r-1", { t: "sit" }); secs(R.sitSec + 2);
assert.equal(p.ch.rest.s, 1, "too far to count");
// getting up half way starts over
sitAt(p, 1); secs(R.sitSec - 2); act("r-1", { t: "sit" }); assert.ok(!p.sit); secs(1); act("r-1", { t: "sit" }); secs(R.sitSec - 1);
assert.equal(p.ch.rest.s, 1, "the count starts over");
secs(1);
assert.equal(p.ch.rest.s, 3);
assert.equal(X.restPct(p.ch, now), R.pct * 2);

// ── 노을 pays more
now = BASE + 18 * HOUR; S.now = now;
gold = p.ch.gold; sitAt(p, 2); secs(R.sitSec);
assert.equal(p.ch.gold, gold + Math.round(R.gold * R.glow), "the glow bonus");

// ── every spot: 여유 is capped, the book pays once
gold = p.ch.gold;
for (let i = 3; i < 12; i++) { sitAt(p, i); secs(R.sitSec); assert.ok(p.ch.rest.s & (1 << i), `spot ${i} stamped`); }
assert.equal(p.ch.rest.book, 4095);
assert.equal(X.restPct(p.ch, now), R.pctMax, "capped");
assert.equal(p.ch.gold, gold + 9 * Math.round(R.gold * R.glow) + R.bookGold, "the full book's gift");
// 여유 runs out
assert.equal(X.restPct(p.ch, p.ch.rest.until + 1), 0);

// ── the next day: today's page is clean, the book stays, no second gift
now += 24 * 3600000; S.now = now; secs(1);
gold = p.ch.gold; sitAt(p, 0); secs(R.sitSec);
assert.equal(p.ch.rest.s, 1, "a new day");
assert.equal(p.ch.rest.book, 4095);
assert.ok(p.ch.gold - gold <= Math.round(R.gold * R.glow), "no second book gift");

// ── 산책 줍기
go(q, "sunset_beach", 20, 60);
const finds = X.restFinds(q, "sunset_beach"), beach = X.mapOf("sunset_beach");
assert.equal(finds.length, R.finds);
assert.deepEqual(X.restFinds(q, "sunset_beach"), finds, "the same all day");
for (const [x, y] of finds) assert.ok(beach.reach[y * beach.w + x], "a find lies where one can walk");
assert.notDeepEqual(X.restFinds(p, "sunset_beach"), finds, "another player has their own");
const mi = X.REST_MAPS.indexOf("sunset_beach");
go(q, "sunset_beach", finds[0][0] + 6, finds[0][1]);
assert.equal(act("r-2", { t: "rest", a: "pick", i: 0 }).ok, false, "out of reach");
go(q, "sunset_beach", finds[0][0], finds[0][1], 10);
gold = q.ch.gold; const lxp = q.ch.life.gather.xp + q.ch.life.gather.lv * 1e6;
assert.ok(act("r-2", { t: "rest", a: "pick", i: 0 }).ok);
assert.equal(q.ch.rest.k, 2 ** (mi * R.finds), "the find's own bit");
assert.equal(q.ch.rest.n, 1);
assert.equal(q.ch.gold, gold + R.findGold);
assert.ok(q.ch.life.gather.xp + q.ch.life.gather.lv * 1e6 > lxp, "a little gathering experience");
assert.equal(act("r-2", { t: "rest", a: "pick", i: 0 }).ok, false, "once a day");
gold = q.ch.gold;
for (let i = 1; i < R.finds; i++) { go(q, "sunset_beach", finds[i][0], finds[i][1]); if (!(q.ch.rest.k & 2 ** (mi * R.finds + i))) assert.ok(act("r-2", { t: "rest", a: "pick", i }).ok, `find ${i}`); }
assert.equal(q.ch.gold, gold + (R.finds - 1) * R.findGold + R.strollGold, "the whole stroll's bonus");
// hostile input
for (const a of [{ a: "pick", i: -1 }, { a: "pick", i: R.finds }, { a: "pick", i: 1.5 }, { a: "pick", i: "0" }, { a: "pick" }, { a: "x", i: 0 }, { i: 0 }])
  assert.equal(act("r-2", { t: "rest", ...a }).ok, false, JSON.stringify(a));
go(q, "meadow", 20, 20);
assert.equal(act("r-2", { t: "rest", a: "pick", i: 0 }).ok, false, "not in the wilds");
secs(1);

// ── the wire
go(q, "town", 49, 44); q.dirty = true; S.now = now;
const self = L.viewFor(S, "r-2").self;
assert.ok(Array.isArray(self.rest) && self.rest.length === 7);
assert.equal(self.rest[1], q.ch.rest.k);
assert.equal(self.rest[6].length, R.finds, "today's finds on this map");
assert.ok(JSON.stringify(self.rest).length < 160, "small on the wire");
go(q, "meadow", 20, 20); q.dirty = true;
assert.equal(L.viewFor(S, "r-2").self.rest[6], 0, "nothing to find outside the safe zones");

// ── an old sheet, and a broken one
{
  const old = L.newChar("옛날", "warrior", []); delete old.rest;
  L.addPlayer(S, "r-3", old);
  assert.deepEqual(S.players["r-3"].ch.rest, { day: 0, s: 0, k: 0, book: 0, n: 0, until: 0, pct: 0 });
  assert.deepEqual(X.restClean({ day: -3, s: 1e9, k: "x", book: 2 ** 40, n: 2.7, until: NaN, pct: 99 }), { day: 0, s: 1e9 & 4095, k: 0, book: 0, n: 2, until: 0, pct: R.pctMax });
  assert.deepEqual(X.restClean([1, 2]), { day: 0, s: 0, k: 0, book: 0, n: 0, until: 0, pct: 0 });
}
console.log("rest: ok");
