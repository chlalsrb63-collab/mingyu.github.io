// Headless test of aiming: blows and skills go where the player aims, never behind.
// node tests/aim.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const [AIM_N, CONE] = D.aim;
const EAST = 0, SOUTH = AIM_N / 4, WEST = AIM_N / 2, NORTH = (AIM_N * 3) / 4;

/** The weapon each old class carried (until J2 it brings that class's skills); "bow" is itself. */
const WK = { warrior: "sword", rogue: "dagger", lancer: "spear", mage: "staff", book: "book", bow: "bow" };
function world(name, cls) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-" + name;
  const ch = L.hero(name, { wk: WK[cls], lvl: 157, migrate: true });
  L.addPlayer(S, PID, ch);
  const W = {
    S, PID,
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
  };
  // open ground in the meadow, every monster put away until a test calls one up
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  const mp = W.step().map;
  const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  let spot = null;
  for (let y = 8; y < mp.h - 8 && !spot; y++) for (let x = 8; x < mp.w - 8 && !spot; x++) {
    let ok = true;
    for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
    if (ok) spot = [x, y];
  }
  assert.ok(spot, "open ground");
  const home = [spot[0] * T + 8, spot[1] * T + 10];
  /** Back to the spot, rested, every cooldown spent, the monsters gone. */
  W.ready = () => {
    p.x = home[0]; p.y = home[1]; p.mvAt = now; p.fix = false;
    p.mp = 9999; p.hp = 1e6; p.atkAt = 0; p.stag = 0; p.combo = 0; p.sword = null; p.dance = null; p.coinFree = false;
    for (let i = 0; i < 6; i++) p.cds[i] = 0;
    for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  };
  /** Call up plain monsters at offsets from the player. */
  W.mobs = (offs, hp = 50000) => {
    const pool = W.rt.mobs.filter((o) => !D.mobs[o.k].chest && !D.mobs[o.k].boss && !D.mobs[o.k].fly);
    return offs.map(([dx, dy], j) => {
      const m = pool[j];
      Object.assign(m, { dead: false, el: 0, tr: [], hp, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, tgt: null, st: 0, act: null, castAt: now + 1e9, atkAt: now + 1e9, mvAt: now + 1e9 });
      return m;
    });
  };
  W.ready();
  return W;
}
const sk = (cls, id) => D.skills[cls].findIndex((s) => s.id === id);
const hurt = (m, hp = 50000) => m.hp < hp;

// ── the tables
assert.equal(AIM_N, 64);
assert.ok(CONE > 20 && CONE < 60);
for (const [k, w] of Object.entries(D.wkinds)) assert.ok(w.arc > 10 && w.arc < 90, k + " has an arc");
assert.ok(D.wkinds.sword.arc > D.wkinds.dagger.arc && D.wkinds.dagger.arc > D.wkinds.spear.arc, "a greatsword sweeps wide, a dagger less, a spear thrusts narrow");

// ── the aim field: whole steps round the compass only
{
  const W = world("조준값", "warrior");
  for (const a of [-1, AIM_N, 1.5, "3", null, true]) {
    assert.equal(W.act({ t: "atk", a }).ok, false, "atk refuses aim " + JSON.stringify(a));
    W.p.atkAt = 0;
    assert.equal(W.act({ t: "sk", i: 0, a }).ok, false, "sk refuses aim " + JSON.stringify(a));
    assert.equal(W.act({ t: "mv", x: W.p.x, y: W.p.y, d: 0, a }).ok, false, "mv refuses aim " + JSON.stringify(a));
  }
  assert.equal(W.p.aim, SOUTH, "a new arrival faces down");
  assert.ok(W.act({ t: "mv", x: W.p.x, y: W.p.y, d: 1, a: WEST }).ok);
  assert.equal(W.p.aim, WEST, "walking turns the aim");
  assert.equal(W.step().me[10], WEST, "and the snapshot carries it");
  assert.ok(W.act({ t: "mv", x: W.p.x, y: W.p.y, d: 1 }).ok, "an old client without the field still walks");
  assert.equal(W.p.aim, WEST, "and leaves the aim alone");
  assert.ok(W.act({ t: "atk", a: 9 }).ok);
  assert.equal(W.p.aim, 9, "an attack can carry its own aim");
  W.ready();
  assert.ok(W.act({ t: "sk", i: sk("warrior", "brace"), a: NORTH }).ok);
  assert.equal(W.p.aim, NORTH, "so can a skill");
  assert.equal(W.p.dir, 3, "and the body turns with it");
}

// ── every weapon (the bow's arrow flies a tick or two first): a monster behind is never hit, one in front is
for (const cls of Object.keys(WK)) {
  const W = world("뒤" + cls.slice(0, 2), cls);
  const reach = Math.min(20, D.wkinds[WK[cls]].range - 6);
  const [back] = W.mobs([[-reach, 0]]);
  for (let i = 0; i < 3; i++) { W.p.atkAt = 0; assert.ok(W.act({ t: "atk", a: EAST }).ok); W.step(50); }
  for (let i = 0; i < 4; i++) W.step(100);
  assert.ok(!hurt(back), `${cls}: a monster behind is not hit by a blow aimed forward`);
  W.ready();
  const [front] = W.mobs([[reach, 0]]);
  assert.ok(W.act({ t: "atk", a: EAST }).ok);
  W.step(100); W.step(100);
  assert.ok(hurt(front), `${cls}: a monster in front is`);
  W.ready();
  const [side] = W.mobs([[0, reach]]);
  assert.ok(W.act({ t: "atk", a: EAST }).ok);
  W.step(100); W.step(100);
  assert.ok(!hurt(side), `${cls}: nor one standing square to the side`);
  // the swing still goes off, forward, and simply misses
  W.ready();
  W.mobs([[-reach, 0]]);
  W.act({ t: "atk", a: EAST });
  const sw = W.step().ev.find((e) => e[0] === "a" && e[1] === W.p.eid);
  if (sw) assert.ok(sw[3] > W.p.x, `${cls}: the empty swing lands in front`);
}

// ── the sword's sweep catches what is beside the target in front, never what is behind you
{
  const W = world("휩쓸기", "warrior");
  const [front, wing, back] = W.mobs([[22, 0], [16, 14], [-12, 0]]);
  assert.ok(W.act({ t: "atk", a: EAST }).ok);
  assert.ok(hurt(front) && hurt(wing), "the arc catches the target and its neighbour");
  assert.ok(!hurt(back), "but not the one at your back");
}

// ── aim assist: the nearest monster inside the cone, not the nearest overall
{
  const W = world("보정", "rogue");
  // one 30 degrees off the aim, a nearer one behind
  const off = (30 * Math.PI) / 180;
  const [cone, behind] = W.mobs([[Math.cos(off) * 22, Math.sin(off) * 22], [-10, 0]]);
  assert.ok(W.act({ t: "atk", a: EAST }).ok);
  assert.ok(hurt(cone), "a blow bends a little toward a monster near the aim");
  assert.ok(!hurt(behind), "and ignores the nearer one behind");
  W.ready();
  const [near, far] = W.mobs([[12, 3], [22, -3]]);
  assert.ok(W.act({ t: "atk", a: EAST }).ok);
  assert.ok(hurt(near) && !hurt(far), "of two in front, the nearer is struck");
  // a skill that picks its target looks in the cone: a coin flipped east lands on the east one
  W.ready();
  const [east, west] = W.mobs([[50, 0], [-20, 0]]);
  assert.ok(W.act({ t: "sk", i: sk("rogue", "coin"), a: EAST }).ok);
  assert.ok(hurt(east) && !hurt(west), "the coin goes where you aim, past a nearer monster behind");
  W.ready();
  const [w2, e2] = W.mobs([[-50, 0], [20, 0]]);
  assert.ok(W.act({ t: "sk", i: sk("rogue", "swap"), a: WEST }).ok);
  assert.ok(hurt(w2) && !hurt(e2), "the swap takes the one you aim at");
}

// ── lines, throws and dashes go straight along the aim
{
  const W = world("투창", "lancer");
  const [south, east] = W.mobs([[0, 40], [30, 0]]);
  assert.ok(W.act({ t: "sk", i: sk("lancer", "javelin"), a: SOUTH }).ok);
  assert.ok(hurt(south) && !hurt(east), "a javelin thrown south flies south, past a nearer monster to the east");
  W.ready();
  const [e3, n3] = W.mobs([[40, 0], [0, -30]]);
  assert.ok(W.act({ t: "sk", i: sk("lancer", "hook"), a: EAST }).ok);
  assert.ok(hurt(e3) && !hurt(n3), "the hook reaches along the aim");
  W.ready();
  const y0 = W.p.y, x0 = W.p.x;
  W.mobs([[40, 0]]);
  assert.ok(W.act({ t: "sk", i: sk("lancer", "hundred"), a: NORTH }).ok);
  assert.ok(W.p.y < y0 - 6 && Math.abs(W.p.x - x0) < 1, "the charge runs north, the way you aim, not at the monster");

  const V = world("검던지기", "warrior");
  V.mobs([[30, 0]]);
  assert.ok(V.act({ t: "sk", i: sk("warrior", "toss"), a: SOUTH }).ok);
  assert.ok(V.p.sword && V.p.sword.y > V.p.y + 10 && Math.abs(V.p.sword.x - V.p.x) < 1, "a thrown sword flies along the aim");
}

console.log("aim ok");
