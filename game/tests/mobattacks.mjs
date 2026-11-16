// Headless test of the monsters' telegraphed tricks (TRICKS, 10-tables.js; special/landMove, 80-simulation.js): each
// warns for at least 400 ms, hits a hero who stays in the mark and misses one who steps out, then cools down (an elite
// sooner); a burrower is out of reach and off the wire meanwhile; a howl rallies kin near, not far; chained tricks
// never stun-lock a hero (MV_GRACE).
// node tests/mobattacks.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { MOBS, TRICKS, TRICK_EL, MV_GRACE, newMob, mobMax, canStand, mapOfS, mobHit, mobsWithin };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

const S = L.setup();
let now = 1_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("시험", { wk: "sword", lvl: 1, migrate: true }));
const p = S.players.p1;
L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
const m = X.mapOfS(S, "meadow"), rt = L.runtime(S, "meadow");
let spot = null;
for (let y = 200; y < m.h * 16 - 200 && !spot; y += 16) for (let x = 200; x < m.w * 16 - 200 && !spot; x += 16) {
  let ok = true;
  for (let dy = -80; dy <= 80 && ok; dy += 8) for (let dx = -80; dx <= 80 && ok; dx += 8) ok = X.canStand(m, x + dx, y + dy);
  if (ok) spot = [x, y];
}
assert.ok(spot, "an open spot on the meadow");

const base = { ...X.MOBS.lambmaw, name: "시험 짐승", hp: 5000, atk: 20, spd: 0, aggro: 150, range: 18, cd: 1300, charge: 0 };
let mob = null, evs = [], view = null, stand = [0, 0];
const keep = new Set();
const place = (o, x, y) => { o.x = o.hx = o.wx = x; o.y = o.hy = o.wy = y; o.hp = X.mobMax(o); o.stun = 0; o.tr = []; o.temp = true; rt.mobs.push(o); keep.add(o); return o; };
function beast(kind, reach, el = 0, extra = {}) {
  for (const o of rt.mobs) if (!keep.has(o)) { o.dead = true; o.respAt = 1e15; }
  for (const o of keep) o.dead = true;
  keep.clear(); rt.tele.length = 0; rt.pools.length = 0;
  const k = "t_" + kind;
  X.MOBS[k] = { ...base, [kind]: reach, moves: [kind], ...extra };
  mob = place(X.newMob(S, k, [0, 0, 0, 0]), spot[0], spot[1]);
  mob.el = el; mob.castAt = now; mob.atkAt = now;
  return mob;
}
/** n ticks with the hero held at `stand`; the hp it lost. */
function step(n = 1) {
  let lost = 0;
  for (let i = 0; i < n; i++) {
    for (const o of rt.mobs) if (!keep.has(o) && !o.dead) { o.dead = true; o.respAt = 1e15; }
    p.dead = false; p.hp = 1e6; p.x = stand[0]; p.y = stand[1]; p.mvAt = now; p.stag = 0;
    now += 100; L.tick(S, now);
    lost += Math.max(0, 1e6 - p.hp);
    view = L.viewFor(S, "p1");
    for (const e of rt.ev) evs.push(e);
    L.endTick(S);
  }
  return lost;
}
/** The tick its telegraph shows; the warning's length (ms) from the event. */
const MS_AT = { bt: 5, t: 4, v: 2, g: 5 };
function untilTele(is) {
  evs = [];
  for (let i = 0; i < 40; i++) {
    const lost = step();
    assert.equal(lost, 0, "nothing lands before its warning");
    const e = evs.find(is);
    if (e) return e[MS_AT[e[0]]];
  }
  assert.fail("the trick never came");
}
const isBt = (e) => e[0] === "bt" && e[1] === 1, isRing = (e) => e[0] === "t" && !e[5], isSpit = (e) => e[0] === "v" && e[1] === mob.id,
  isCloud = (e) => e[0] === "g" && e[1] === mob.id;

const cases = [
  // [kind, reach, hero's distance, the telegraph's event]
  ["breath", 60, 40, isBt],
  ["pounce", 90, 55, isRing],
  ["spit", 100, 60, isSpit],
  ["burrow", 110, 60, isRing],
  ["cloud", 40, 30, isCloud],
];
for (const [kind, reach, far, is] of cases) {
  const A = X.TRICKS[kind];
  // stays in the mark: hit once it lands, not before
  beast(kind, reach);
  stand = [spot[0] + far, spot[1]];
  const ms = untilTele(is), at = now;
  assert.ok(ms >= 400 && ms === A.ms, `${kind}: warns ${A.ms} ms (≥ 400)`);
  assert.ok(mob.castAt - at >= A.cd - 100, `${kind}: it cools down for ${A.cd} ms`);
  if (kind === "burrow") {
    assert.ok(mob.dive, "a burrower is underground");
    assert.ok(!view.M.some((r) => r[0] === mob.id), "and off the wire");
    assert.ok(!X.mobsWithin(rt, mob.x, mob.y, 30).includes(mob), "and out of reach");
  }
  let early = step(Math.floor(ms / 100) - 1);
  assert.equal(early, 0, `${kind}: nothing before the warning ends`);
  const hit = step(kind === "cloud" ? 10 : 4);
  assert.ok(hit > 0, `${kind}: lands on a hero who stayed`);
  if (kind === "burrow") { assert.ok(!mob.dive, "it came up"); assert.ok(view.M.some((r) => r[0] === mob.id), "and is shown again"); }
  if (kind === "pounce" || kind === "burrow") assert.ok(Math.hypot(mob.x - stand[0], mob.y - stand[1]) < 2, `${kind}: it came down on its mark`);
  // the next one only after its cooldown
  evs = [];
  step(Math.floor((mob.castAt - now) / 100) - 2);
  assert.ok(!evs.some(is), `${kind}: not again before its cooldown`);

  // steps out of the mark: missed
  beast(kind, reach);
  stand = [spot[0] + far, spot[1]];
  untilTele(is);
  stand = [spot[0] - 70, spot[1] + 70];
  assert.equal(step(kind === "cloud" ? 30 : 15), 0, `${kind}: misses a hero who stepped out`);

  // an elite cools down sooner
  beast(kind, reach, 1);
  stand = [spot[0] + far, spot[1]];
  untilTele(is);
  const cd = mob.castAt - now;
  assert.ok(cd <= A.cd * X.TRICK_EL[1] + 1 && cd < A.cd, `${kind}: an elite's cooldown is shorter`);
}

// a howl rallies its kin near (they bite harder and run faster), not those far, and not with no kin about
beast("howl", 100);
stand = [spot[0] + 50, spot[1]];
X.MOBS.t_kin = { ...base };
const near = place(X.newMob(S, "t_kin", [0, 0, 0, 0]), spot[0] - 30, spot[1] + 20), away = place(X.newMob(S, "t_kin", [0, 0, 0, 0]), spot[0] - 75, spot[1] - 75);
near.castAt = away.castAt = now + 1e9;
evs = [];
step(3);
const cry = evs.find((e) => e[0] === "t" && e[5] === 1);
assert.ok(cry && cry[4] >= 400, "a howl shows its reach (a gold ring, no danger)");
assert.ok(near.rage > now && mob.rage > now && !(away.rage > now), "it rallies the near kin and itself, not the far");
assert.ok(mob.castAt - now >= X.TRICKS.howl.cd - 400, "and cools down");
near.dead = true;
beast("howl", 100);
evs = [];
step(5);
assert.ok(!evs.some((e) => e[0] === "t" && e[5] === 1) && !(mob.rage > now), "no kin near: no howl");

// chained tricks: a hero reels from the first, not again inside MV_GRACE, and again after it
const foe = beast("pounce", 90);
S.now = now;
p.stag = 0; p.dead = false; p.hp = 1e6;
X.mobHit(S, rt, p, 5, foe, "mv");
const first = p.stag;
assert.ok(first > now, "the first trick's blow makes the hero reel");
S.now = now + 500;
X.mobHit(S, rt, p, 5, foe, "mv");
assert.equal(p.stag, first, "a second inside the grace does not");
S.now = now + X.MV_GRACE + 600;
X.mobHit(S, rt, p, 5, foe, "mv");
assert.ok(p.stag > first, "one after the grace does");

// every row's trick has a reach the AI can use, and a recoloured kind inherits its body's
for (const [k, d] of Object.entries(X.MOBS)) for (const mv of Object.keys(X.TRICKS)) if (d[mv]) {
  assert.ok(d[mv] >= 24 && d[mv] <= 140, `${k}.${mv}: a sensible reach`);
  assert.ok(d.moves.includes(mv) || k.startsWith("t_"), `${k}: ${mv} is in its moves`);
}
assert.equal(X.MOBS.gutfrog_poison.pounce, X.MOBS.gutfrog.pounce, "a recoloured kind pounces like its body");
// the 2026-11-16 variety pass: no early kind is left with a bare bite, a bone hare burrows instead of pouncing
for (const k of ["twinhare", "lambmaw", "meadowram", "splitboar", "ribdeer", "hydrasnake", "gnawbadger", "ratking", "batcluster"]) assert.ok(X.MOBS[k].moves.length >= (["twinhare", "ratking", "batcluster", "hydrasnake"].includes(k) ? 1 : 2), `${k}: has a trick of its own`);
assert.deepEqual(X.MOBS.twinhare_bone.moves, ["burrow"], "the bone hare burrows (and does not inherit the pounce)");
assert.ok(src.includes("POOL_OF[monsterElement") && src.includes("5500 * TRICK_EL"),"puddles follow the maker's element; elites charge more often too");
console.log("mobattacks: ok");
