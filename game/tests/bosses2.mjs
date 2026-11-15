// Headless test of bosses-2's two scripted bosses (docs/design/bosses-2.md §2–3, §7): 망치 갯가재 walks in as the coast's
// field boss, 혈루 왕도마뱀 stands in its mesa lair; each runs every pattern of its script, goes through its phases (adds,
// forced marked casts, pools), its cast can be broken, it falls and leaves its own finds; the lair boss rises fresh.
// node tests/bosses2.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { MOBS, ITEMS, FIELD_BOSS, TROPHIES, ELITE, mobMax, dealMob };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

const S = L.setup();
let now = 1_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("시험", { wk: "sword", lvl: 160, migrate: true }));
const p = S.players.p1;
const go = (id) => { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.sendMap = true; };
let evs = [];
const step = (rt, mob, n = 1) => {
  for (let i = 0; i < n; i++) {
    // a hero who never falls, standing by the boss's home
    p.dead = false; p.hp = 1e7; p.x = mob.hx + 26; p.y = mob.hy; p.mvAt = now;
    now += 100; L.tick(S, now); for (const e of rt.ev) evs.push(e); L.endTick(S);
  }
};
const turns = (mob) => evs.filter((e) => e[0] === "bc" && e[1] === mob.id).map((e) => e[2]);
/** Fight until every pattern of the current phase has been cast (or the time runs out). */
const allPats = (rt, mob, n, what) => {
  const t0 = now;
  while (new Set(turns(mob).filter((i) => i < n)).size < n) { step(rt, mob); assert.ok(now - t0 < 240000, what + ": every pattern comes round"); }
};

// ── 망치 갯가재: the coast's field boss
assert.equal(X.FIELD_BOSS.coast, "clubshrimp");
assert.ok(X.TROPHIES.clubshrimp && X.TROPHIES.coralturtle, "its trophy, and the old one still known");
go("coast");
let rt = L.runtime(S, "coast");
for (let i = 0; i < 5 && !rt.fb; i++) { now += 100; L.tick(S, now); L.endTick(S); }
let mob = rt.mobs.find((o) => o.id === rt.fb);
assert.ok(mob && mob.k === "clubshrimp" && mob.el === 2, "it walks in as the field boss");
assert.equal(X.mobMax(mob), Math.round(4400 * X.ELITE[2].hp), "its health: the row × 14");
for (const o of rt.mobs) if (o !== mob) { o.dead = true; o.respAt = now + 1e12; }
evs = [];
const P1 = X.MOBS.clubshrimp.script.pats.length;
allPats(rt, mob, P1, "clubshrimp P1");
assert.ok(turns(mob).includes(9), "its marked cast came");
const bt = new Set(evs.filter((e) => e[0] === "bt").map((e) => e[1]));
assert.ok(bt.has(0) && bt.has(2), "the donut and the marks are drawn");
assert.ok(evs.some((e) => e[0] === "t"), "punch and blast rings");
// under half health: 갑각 균열
mob.hp = Math.floor(X.mobMax(mob) * 0.49); evs = [];
step(rt, mob, 2);
assert.equal(mob.bs.ph, 2, "phase 2 under half");
allPats(rt, mob, X.MOBS.clubshrimp.script.phases[0].pats.length, "clubshrimp P2");
// its cast broken: 4 % of its health dealt while it gathers
while (!mob.cast) step(rt, mob);
evs = [];
X.dealMob(S, rt, mob, p, Math.ceil(mob.cast.need) + 1, 0);
assert.ok(rt.ev.some((e) => e[0] === "bc" && e[1] === mob.id && e[2] === 8) && mob.stag > now && !mob.cast, "the cast broke");
// it falls: the field boss's count, its claw for the looter, back in FB_RESP
const fb0 = p.ch.cnt.fb;
mob.hp = 10;
assert.ok(X.dealMob(S, rt, mob, p, 1e6, 0), "it falls");
assert.equal(p.ch.cnt.fb, fb0 + 1, "counted as a field boss");
assert.equal(rt.fb, 0);
const claw = rt.drops.find((d) => d.it === "mat_clubclaw" && d.own === "p1");
assert.ok(claw && claw.n >= 1 && claw.n <= 3, "its claw drops, 1–3");

// ── 혈루 왕도마뱀: mesa's lair boss
go("mesa");
rt = L.runtime(S, "mesa");
now += 100; L.tick(S, now); L.endTick(S);
mob = rt.mobs.find((o) => o.k === "bloodhorn");
assert.ok(mob && !mob.temp && X.MOBS.bloodhorn.boss, "it stands in its lair");
assert.equal(X.mobMax(mob), 67200);
assert.equal(X.FIELD_BOSS.mesa, "crownpeacock", "mesa keeps its own field boss");
for (const o of rt.mobs) if (o !== mob) { o.dead = true; o.respAt = now + 1e12; }
evs = [];
allPats(rt, mob, X.MOBS.bloodhorn.script.pats.length, "bloodhorn P1");
assert.ok(evs.some((e) => e[0] === "bt" && e[1] === 1), "the tail sweep is a cone");
assert.ok(rt.pools.length || evs.some((e) => e[0] === "g"), "the blood jet leaves burn pools");
// under 60 %: phase 2 opens with the marked cast, then crystals sprout
mob.hp = Math.floor(X.mobMax(mob) * 0.59); mob.cast = null; evs = [];
step(rt, mob, 2);
assert.equal(mob.bs.ph, 2);
while (!turns(mob).includes(9)) step(rt, mob);
assert.ok(mob.cast, "phase 2 opens with 혈루 대분출");
// not broken: everyone in the fight pays and it grows angrier
const fury = mob.bs.fury;
while (mob.cast) step(rt, mob);
assert.ok(turns(mob).includes(7) && mob.bs.fury === fury + 1, "the cast went off");
allPats(rt, mob, X.MOBS.bloodhorn.script.phases[0].pats.length, "bloodhorn P2");
const adds = rt.mobs.filter((o) => o.add === mob.id && !o.dead);
assert.ok(adds.length >= 1 && adds.length <= 3 && adds.every((o) => o.k === "bloodshard"), "its crystals sprout, three at most");
// under 25 %: 혈루 폭주 — a burn pool after every pattern
mob.hp = Math.floor(X.mobMax(mob) * 0.24); evs = [];
step(rt, mob, 2);
assert.equal(mob.bs.ph, 3);
while (mob.cast) X.dealMob(S, rt, mob, p, Math.ceil(mob.cast.need) + 1, 0);
const g0 = evs.filter((e) => e[0] === "g").length, n0 = turns(mob).filter((i) => i < 7).length;
while (turns(mob).filter((i) => i < 7).length < n0 + 3) step(rt, mob);
step(rt, mob, 6);
assert.ok(evs.filter((e) => e[0] === "g").length >= g0 + 3, "every pattern leaves a pool");
// it falls: its tears for the looter; it rises again fresh after `resp`
mob.hp = 10; mob.cast = null;
assert.ok(X.dealMob(S, rt, mob, p, 1e6, 0), "it falls");
const tear = rt.drops.find((d) => d.it === "mat_bloodtear" && d.own === "p1");
assert.ok(tear && tear.n >= 1 && tear.n <= 3, "피눈물 결정 drops, 1–3");
assert.ok(rt.drops.filter((d) => d.own === "p1" && d.g).length >= 1, "and boss gear");
now = mob.respAt + 100; p.x = mob.hx + 600; L.tick(S, now); L.endTick(S);
assert.ok(!mob.dead && !mob.bs && !mob.cast, "risen again, its last fight forgotten");

// the unique weapons are top-tier, and a forced roll makes them legendary
for (const [k, id, wk] of [["bloodhorn", "w_bloodcrown", "spear"], ["clubshrimp", "w_cavhammer", "hammer"]]) {
  const it = X.ITEMS[id];
  assert.ok(it.type === "weapon" && it.wk === wk && it.tier === 5, id);
  assert.ok(X.MOBS[k].drops.some(([d, c]) => d === id && c === 0.03), k + ": its weapon at 3 %");
}
console.log("bosses2: 망치 갯가재 (coast field boss) and 혈루 왕도마뱀 (mesa lair) — patterns, phases, cast, adds, drops ok");
