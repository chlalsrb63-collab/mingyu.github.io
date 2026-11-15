// Headless test of 보스전리품 and the solo story fight (src/logic/67-trophies.js, docs/design/boss-trophies.md): the field
// boss at its fixed spot and back ten minutes after it falls, trophy effects in the numbers, the story arena only for the
// quest's holder (alone), the weaker copy soloable by a bot at the quest's level, the trophy once, a duplicate → gold,
// the field kill's chance, an old sheet's quest index.
// node tests/trophies.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { TROPHIES, TROPHY_CAP, TROPHY_GOLD, STORY, QUESTS, FIELD_BOSS, FB_RESP, MOBS, ITEMS, ELITE, changeMap, dealMob, mobMax, stats, deriveStats, aimIdx, migrate, grantTrophy, fbTrophy, fbHome, rollGear, tierFor, GEAR, WK_ID, mapOfS, shownLv, BASE_SPD, HERO_SPD_K };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16;

let now = 5_000_000;
const S = L.setup();
S.now = now; S.last = now;
const step = (n = 1) => { for (let i = 0; i < n; i++) { now += 100; L.tick(S, now); L.endTick(S); } };
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const px = ([x, y]) => [x * T + 8, y * T + 10];
/** A hero at what is the quest's level for a boss of world tier `lv`, with that tier's gear and potions. */
function hero(pid, lv, map, x, y) {
  const ch = L.hero("봇" + pid, { wk: "sword", lvl: Math.min(197, 4 * lv - 3), migrate: true });
  const tier = X.tierFor(lv);
  ch.eq.weapon = X.rollGear(S, `w_${X.WK_ID.sword}_${tier}`, 1, lv);
  for (const t of ["helm", "armor", "gloves", "boots"]) ch.eq[t] = X.rollGear(S, `${X.GEAR[t].pre}_${tier}`, 1, lv);
  ch.inv.push({ id: lv < 26 ? "hp_m" : "hp_l", n: 60 });
  L.addPlayer(S, pid, ch);
  const p = S.players[pid];
  X.changeMap(S, p, map, x, y);
  return p;
}

// ── the table: every field boss has a trophy with fixed, capped effects
for (const k of new Set(Object.values(X.FIELD_BOSS))) assert.ok(X.TROPHIES[k], "a trophy for " + k);
for (const [k, t] of Object.entries(X.TROPHIES)) for (const [e, v] of Object.entries(t.fx)) assert.ok(X.TROPHY_CAP[e] && v > 0 && v <= 6, `${k}.${e}`);
assert.equal(L.defs().trophies.list.lambmaw.name, X.TROPHIES.lambmaw.name, "the table goes out in defs");

// ── the meadow's field boss: there from the start at its fixed spot, back FB_RESP after it falls
const rt = L.runtime(S, "meadow"), home = X.fbHome(S, rt), [hx, hy] = px(home);
assert.deepEqual(X.fbHome(S, { id: "meadow" }), home, "the spot is the same every boot");
const W = L.atlas().waypoints.meadow, a = hero("a", X.MOBS.lambmaw.lv, "meadow", W.ax * T + 8, W.ay * T + 10);
step(2);
let boss = rt.mobs.find((m) => m.id === rt.fb);
assert.ok(boss && boss.k === "lambmaw" && boss.el === 2, "the field boss stands there");
assert.deepEqual([boss.x, boss.y], [hx, hy], "on its spot");
X.dealMob(S, rt, boss, a, 1e9, 0);
step(1);
assert.equal(rt.fb, 0);
const back = rt.fbAt;
assert.equal(back, S.now - 100 + X.FB_RESP, "back ten minutes after it fell");
for (const m of rt.mobs) if (m.el !== 2) { m.dead = true; m.respAt = 1e15; }
now = back - 1000; step(1);
assert.equal(rt.fb, 0, "not before");
now = back; step(1);
boss = rt.mobs.find((m) => m.id === rt.fb);
assert.ok(boss && boss.k === "lambmaw" && boss.x === hx && boss.y === hy, "then at the same spot again");

// ── trophy effects: gold, experience, move speed, attack speed, HP, crit, magic find — additive, capped
{
  const p = a, s0 = { ...X.deriveStats(p) };
  p.ch.tro = ["lambmaw", "ribdeer", "crabskull", "doghead", "toadbrood"]; p.stc = null;
  const s1 = X.deriveStats(p);
  assert.equal(s1.xp, s0.xp + 2); assert.equal(s1.gold, s0.gold + 3);
  assert.ok(Math.abs(s1.spd0 - s0.spd0 - X.BASE_SPD * X.HERO_SPD_K * 0.02) < 1e-9, "move +2% (of the base speed)");
  assert.ok(s1.acd <= Math.round(s0.acd * 0.98) + 1 && s1.acd < s0.acd, "attack speed +2%");
  assert.ok(Math.abs(s1.mhp - Math.round(s0.mhp * 1.02)) <= 1, "HP +2%");
  p.ch.tro = Object.keys(X.TROPHIES); p.stc = null;
  const s2 = X.deriveStats(p);
  assert.equal(s2.xp - s0.xp, X.TROPHY_CAP.xp, "capped"); assert.equal(s2.gold - s0.gold, X.TROPHY_CAP.gold);
  assert.ok(Math.abs(s2.mf - s0.mf - X.TROPHY_CAP.drop) < 1e-9);
  p.ch.tro = []; p.stc = null;
}

// ── the story fight: only the quest's holder, alone, stepping near the spot
const qi = X.QUESTS.findIndex((q) => q.fb && q.mob === "lambmaw");
assert.ok(qi > 0 && X.QUESTS[qi].n === 1, "the chain asks for the meadow's boss");
assert.ok(X.QUESTS.filter((q) => q.fb).length >= 8, "a boss quest for each ground of the chain");
const b = hero("b", X.MOBS.lambmaw.lv, "meadow", hx - 2 * T, hy);   // the company, without the quest
a.ch.q = { i: qi, n: 0, st: 0 };
X.changeMap(S, a, "meadow", hx - 2 * T, hy);
step(2);
assert.equal(a.map, "meadow", "not without the quest in hand");
a.ch.q.st = 1;
step(1);
assert.ok(a.map.startsWith("dim:"), "in the story arena");
assert.equal(b.map, "meadow", "a companion stays outside");
const dim = S.dims[a.map], copy = dim.rt.mobs.find((m) => m.id === dim.boss);
assert.ok(dim.story && copy.k === "lambmaw" && copy.el === 2 && copy.story, "the boss's copy");
assert.equal(copy.hk, X.STORY.hp); assert.equal(copy.ak, X.STORY.atk); assert.deepEqual(copy.tr, []);
assert.equal(dim.map.theme, X.mapOfS(S, "meadow").theme, "with the ground's theme");
// the HUD line: time left, not won, the boss kind — once, then 0 on leaving
{ const v = L.viewFor(S, "a").sty; assert.ok(v && v[0] > 590 && v[0] <= X.STORY.limit / 1000 && v[1] === 0 && v[2] === "lambmaw", JSON.stringify(v)); }
assert.ok(!("sty" in L.viewFor(S, "a")), "sent once");
// [떠나기]: back where they stepped in; the arena is gone
assert.ok(act("a", { t: "dim_leave" }).ok);
assert.equal(a.map, "meadow"); assert.ok(!S.dims[dim.id], "closed");
assert.equal(L.viewFor(S, "a").sty, 0, "the HUD line cleared");
assert.equal(a.ch.q.i, qi, "the quest still to do");

/** A bot alone in its story arena: walks up to the boss and strikes, drinks under 45%. Returns { won, ms }. */
function fight(p) {
  const id = p.map, t0 = now;
  for (let i = 0; i < 3000 && p.map === id; i++) {
    const d = S.dims[id], mob = d && d.rt.mobs.find((m) => m.id === d.boss && !m.dead);
    if (!p.dead && mob) {
      const st = X.stats(p);
      if (p.hp < st.mhp * 0.45) { const pot = p.ch.inv.find((s) => X.ITEMS[s.id] && X.ITEMS[s.id].heal); if (pot) act(p.pid, { t: "use", id: pot.id }); }
      const dx = mob.x - p.x, dy = mob.y - p.y, dd = Math.hypot(dx, dy), aim = X.aimIdx(dx, dy);
      if (dd > 18) { const k = Math.min(1, (st.spd * 0.1) / dd); act(p.pid, { t: "mv", x: p.x + dx * k, y: p.y + dy * k, a: aim }); }
      else act(p.pid, { t: "atk", a: aim });
    }
    step(1);
    if (d && d.story.won) return { won: true, ms: now - t0 };
  }
  return { won: false, ms: now - t0 };
}
// back in, and win it at the quest's level
a.x = hx - 8 * T; step(1); a.x = hx - 2 * T; step(1);
assert.ok(a.map.startsWith("dim:"));
let rot = 0;
const gold0 = a.ch.gold, got = fight(a);
assert.ok(got.won, "a lone bot at the quest's level beats the copy");
assert.ok(got.ms > 8000, `but not in a blink (${got.ms} ms)`);
assert.deepEqual(a.ch.tro, ["lambmaw"], "the trophy, for sure");
assert.equal(a.ch.q.i, qi + 1, "the quest done");
assert.ok(a.ch.gold >= gold0 + X.QUESTS[qi].gold, "its gold paid");
assert.deepEqual(L.viewFor(S, "a").self.tro, ["lambmaw"], "self carries the trophies");
step(X.STORY.endMs / 100 + 2);
assert.equal(a.map, "meadow", "back on the meadow");
assert.ok(Math.hypot(a.x - hx, a.y - hy) <= X.STORY.r * T, "where they stepped in");
// a duplicate is gold
const g1 = a.ch.gold;
X.grantTrophy(S, a, "lambmaw");
assert.deepEqual(a.ch.tro, ["lambmaw"]); assert.equal(a.ch.gold, g1 + X.TROPHY_GOLD * X.MOBS.lambmaw.lv, "a duplicate turns to gold");

// ── a fall: back outside, on their feet, may retry
{
  const p = hero("c", X.MOBS.lambmaw.lv, "meadow", hx - 8 * T, hy);
  p.ch.q = { i: qi, n: 0, st: 1 };
  p.x = hx - 2 * T; step(1);
  assert.ok(p.map.startsWith("dim:"));
  p.dead = true; p.hp = 0;
  step(X.STORY.failMs / 100 + 2);
  assert.ok(p.map === "meadow" && !p.dead && p.hp > 0, "a fall puts them back outside, standing");
  assert.equal(p.ch.q.st, 1, "still holding the quest");
}

// ── the late chain's boss too: the copy of 썩은 관 사슴왕 is soloable at its quest's level
{
  const m = X.mapOfS(S, "maple"), r2 = L.runtime(S, "maple"), h2 = px(X.fbHome(S, r2));
  const p = hero("d", X.MOBS.rotstag.lv, "maple", h2[0] - 8 * T, h2[1]);
  void m;
  p.ch.q = { i: X.QUESTS.findIndex((q) => q.fb && q.mob === "rotstag"), n: 0, st: 1 };
  p.x = h2[0] - 2 * T; p.y = h2[1]; step(1);
  assert.ok(p.map.startsWith("dim:"), "into the maple's story arena");
  const r = fight(p);
  rot = r.ms; assert.ok(r.won, "a lone bot at Lv." + p.ch.lvl + " beats the rotstag copy");
  assert.ok(p.ch.tro.includes("rotstag"));
}

// ── a share of the real field boss's kill: TROPHY_P to whoever lacks it
{
  const p = S.players.b;
  let tries = 0;
  while (!p.ch.tro.includes("ribdeer") && tries < 2000) { X.fbTrophy(S, new Set([p]), "ribdeer"); tries++; }
  assert.ok(p.ch.tro.includes("ribdeer") && tries > 1, `found by chance after ${tries} kills`);
  const g = p.ch.gold;
  for (let i = 0; i < 200; i++) X.fbTrophy(S, new Set([p]), "ribdeer");
  assert.equal(p.ch.gold, g, "never a duplicate from the field");
}

// ── an old sheet (v16): the quest index points at the same errand, no trophies yet
{
  const old = L.hero("옛", { wk: "sword", lvl: 30, migrate: true });
  const plain = X.QUESTS.filter((q) => !q.fb);
  Object.assign(old, { v: 16, q: { i: 4, n: 3, st: 1 } });
  delete old.tro;
  X.migrate(old);
  assert.equal(old.v, 23);
  assert.equal(X.QUESTS[old.q.i], plain[4], "the same errand as before");
  assert.deepEqual([old.q.n, old.q.st], [3, 1]);
  assert.deepEqual(old.tro, []);
  const done = L.hero("끝", { wk: "sword", lvl: 30, migrate: true });
  Object.assign(done, { v: 16, q: { i: plain.length, n: 0, st: 0 }, tro: ["lambmaw", "nope", "lambmaw", 3] });
  X.migrate(done);
  assert.equal(done.q.i, X.QUESTS.length, "a finished chain stays finished");
  assert.deepEqual(done.tro, ["lambmaw"], "known kinds, once");
}
console.log(`trophies ok — solo story clears at the quest level: lambmaw ${Math.round(got.ms / 1000)} s, rotstag ${Math.round(rot / 1000)} s`);
