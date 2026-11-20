// Headless test of the skill combo hooks (docs/design/skill-combos.md): the states skills leave on a monster,
// the skills that spend them for a bonus, how long they last, wind-up and channel, and the five-slot bar.   node tests/combos.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs(), SK = D.skills, T = 16;
const STATES = ["stg", "frz", "air", "mk", "brand", "brn", "drag"];
const CB = { stg: 1, frz: 2, air: 3, mk: 4, brand: 5, brn: 6, drag: 7 };
const NEW = { cleave: "sword", rupture: "dagger", hook: "spear", ignite: "staff", drain: "book", snipe: "bow" };

/** A hero alone on open meadow ground (as tests/skills.mjs), the aim east. */
function world(name, o) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, L.hero(name, { lvl: 157, ...o }));
  const W = {
    S, get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
  };
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  const mp = W.step().map;
  S.seed = 31337;   // the dice start from the same place whatever the meadow spawned (these numbers are measured over a few hundred rolls)
  const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  let spot = null;
  for (let y = 4; y < mp.h - 4 && !spot; y++) for (let x = 6; x < mp.w - 16 && !spot; x++) {
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -5; dx <= 15 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
    if (ok) spot = [x, y];
  }
  assert.ok(spot, "open ground");
  const home = [spot[0] * T + 8, spot[1] * T + 10];
  W.ready = () => {
    Object.assign(p, { x: home[0], y: home[1], mvAt: now, fix: false, dir: 2, aim: 0, mp: 9999, hp: 1e6, atkAt: 0, stag: 0, combo: 0, dance: null, ghost: 0, cds: {}, charge: null, chan: 0, reso: 0, weave: null, inert: 0 });
    for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
    W.rt.props = []; W.rt.zones = []; W.rt.decoys = []; W.rt.shots = [];
  };
  W.mobs = (offs) => {
    const pool = W.rt.mobs.filter((q) => !D.mobs[q.k].chest && !D.mobs[q.k].boss && !D.mobs[q.k].fly);
    return offs.map(([dx, dy], j) => Object.assign(pool[j], { slot: null, dead: false, el: 0, tr: [], hp: 50000, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, wx: p.x + dx, wy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, brand: 0, dot: null, tgt: null, st: 0, act: null, castAt: now + 1e12, atkAt: now + 1e12, mvAt: now + 1e12, hw: 0, hu: 0, stg: 0, frz: 0, air: 0, brn: 0, brnAt: 0, drag: 0 }));
  };
  W.ready();
  return W;
}
const run = (W, n, ms = 100) => { const vs = []; for (let i = 0; i < n; i++) vs.push(W.step(ms)); return vs; };
const cbs = (vs, id) => vs.flatMap((v) => (v.ev || []).filter((e) => e[0] === "cb" && e[1] === id).map((e) => e[2]));
const heroOf = (wk, name) => world(name, { wk, wm: { [wk]: 30 } });
/** Put a state on a monster as its own skill would. */
function prime(m, key, now) {
  if (key === "mk") { m.mk = 3; m.mkAt = now + 10000; }
  else if (key === "brn") { m.brn = 3; m.brnAt = now + 6000; }
  else if (key === "brand") m.brand = now + 6000;
  else { m[key] = now + 2000; if (key === "frz" || key === "air") m.stun = now + 2000; }
}

// ═════════ the table: every consumer spends known states; the new actives have their roles
for (const [id, s] of Object.entries(SK)) if (s.eat) for (const k of Object.keys(s.eat)) assert.ok(STATES.includes(k) && s.eat[k] > 0, `${id} eats ${k}`);
for (const [id, wk] of Object.entries(NEW)) {
  const s = SK[id];
  assert.ok(s && s.kind === "a" && s.wk === wk && s.need === 25, id + " is a mastery-25 " + wk + " active");
  assert.ok(s.fx >= 140 && s.fx <= 145, id + " fx");
}
for (const id of ["slash", "spiral", "rupture", "fireball", "soulbolt"]) assert.ok(SK[id].cd <= 4000, id + " is a short spam skill");
for (const id of ["cleave", "ignite", "drain", "snipe"]) assert.ok(SK[id].cd >= 14000, id + " is a long big skill");
assert.ok(SK.cleave.wind && SK.ignite.wind && SK.snipe.wind, "charge-ups");
assert.ok(SK.drain.n > 1 && SK.drain.every > 0, "a channel");

// ═════════ each hook: the state is spent with a "cb" event, and the hit is clearly harder for it
const HOOKS = [
  ["sword", "cleave", "stg"], ["sword", "cleave", "air"], ["sword", "cleave", "frz"], ["sword", "slash", "drag"],
  ["dagger", "rupture", "mk"], ["dagger", "rupture", "brand"], ["dagger", "ambush", "air"],
  ["spear", "spiral", "frz"], ["staff", "ignite", "brn"], ["staff", "ignite", "frz"], ["staff", "frostring", "drag"],
  ["bow", "snipe", "stg"], ["bow", "snipe", "air"], ["bow", "snipe", "frz"],
];
for (const [wk, id, key] of HOOKS) {
  const W = heroOf(wk, "조합" + id + key);
  let plain = 0, primed = 0;
  for (let i = 0; i < 8; i++) for (const on of [false, true]) {
    W.ready();
    const [m] = W.mobs([[24, 0]]);
    if (on) prime(m, key, W.now);
    const r = W.act({ t: "sk", id, a: 0 });
    assert.ok(r.ok, `${id} casts: ${r.error}`);
    const vs = run(W, 9);
    const got = cbs(vs, m.id);
    if (on) {
      assert.ok(got.includes(CB[key]), `${id} spends ${key} (cb ${got})`);
      if (key === "mk") assert.equal(m.mk, 0, "marks spent");
      else if (key === "brn") assert.equal(m.brn, 0, "burn spent");
      else if (key !== "brand") assert.ok(!(m[key] > W.now), `${key} spent`);
      primed += 50000 - m.hp;
    } else {
      assert.ok(!got.includes(CB[key]), `${id} finds no ${key} on a fresh monster`);
      plain += 50000 - m.hp;
    }
  }
  const need = 1 + SK[id].eat[key] * (key === "mk" || key === "brn" ? 3 : 1) * 0.5;
  assert.ok(primed > plain * need, `${id} on ${key}: ${Math.round(primed)} vs ${Math.round(plain)} (want ×${need.toFixed(2)})`);
}

// ═════════ the appliers leave their states; the states run out
{
  const W = heroOf("sword", "경직");
  let [m] = W.mobs([[24, 0]]);
  assert.ok(W.act({ t: "sk", id: "slash", a: 0 }).ok);
  W.step();
  assert.ok(m.stg > W.now, "파워 슬래쉬 staggers (경직)");
  run(W, 30);
  assert.ok(!(m.stg > W.now) && !(m.stun > W.now), "경직 runs out");
  W.ready();
  [m] = W.mobs([[60, 0]]);
  assert.ok(W.act({ t: "sk", id: "rend", a: 0 }).ok);
  const vs = [W.step()];
  assert.ok(m.air > W.now && cbs(vs, m.id).includes(9), "대지 가르기 launches (공중, cb 9)");
  run(W, 10);
  assert.ok(!(m.air > W.now), "공중 runs out");
  // an expired state is not spent
  W.ready();
  [m] = W.mobs([[24, 0]]);
  m.stg = W.now + 100;
  run(W, 5);
  assert.ok(W.act({ t: "sk", id: "cleave", a: 0 }).ok);
  assert.ok(!cbs(run(W, 9), m.id).includes(1), "an old stagger is gone");
}
{
  const W = heroOf("staff", "화상");
  const [m] = W.mobs([[30, 0]]);
  for (let i = 0; i < 4; i++) { W.p.cds = {}; assert.ok(W.act({ t: "sk", id: "fireball", a: 0 }).ok); W.step(); }
  assert.equal(m.brn, 3, "파이어볼 stacks 화상 to three");
  W.p.cds = {};
  m.slow = W.now + 3000;
  assert.ok(W.act({ t: "sk", id: "frostring", a: 0 }).ok);
  W.step();
  assert.ok(m.frz > W.now, "서리 고리 freezes the slowed (빙결)");
  run(W, 65);
  assert.ok(!(m.brn > 0 && m.brnAt > W.now), "화상 runs out");
}
{
  const W = heroOf("spear", "갈고리");
  const [m] = W.mobs([[100, 0]]);
  const x0 = m.x;
  assert.ok(W.act({ t: "sk", id: "hook", a: 0 }).ok);
  W.step();
  assert.ok(m.x < x0 - 50, `갈고리 창 pulls (${Math.round(x0 - m.x)} px)`);
  assert.ok(m.drag > W.now && m.stg > W.now, "pulled (끌림) and staggered (경직)");
  run(W, 25);
  assert.ok(!(m.drag > W.now), "끌림 runs out");
}
{
  const W = heroOf("dagger", "표식");
  const [m] = W.mobs([[30, 0]]);
  assert.ok(W.act({ t: "sk", id: "shade", a: 0 }).ok);
  W.step();
  assert.ok(m.mk >= 1, "그림자 칼날 marks");
}

// ═════════ wind-up: paid at once, nothing else meanwhile, the blow lands when it is due
{
  const W = heroOf("sword", "준비");
  const [m] = W.mobs([[24, 0]]);
  const mp0 = W.p.mp;
  assert.ok(W.act({ t: "sk", id: "cleave", a: 0 }).ok);
  assert.ok(W.p.mp < mp0, "paid when it begins");
  assert.equal(W.act({ t: "sk", id: "slash", a: 0 }).error, "기술을 모으는 중입니다");
  W.step(100); W.step(100);
  assert.equal(m.hp, 50000, "not yet");
  run(W, 5);
  assert.ok(m.hp < 50000 && !W.p.charge, "the blow lands after the wind-up");
  assert.ok(W.act({ t: "sk", id: "slash", a: 0 }).ok, "free again");
}

// ═════════ channel: pulses, drains, and another skill cuts it
{
  const W = heroOf("book", "착취");
  const [m] = W.mobs([[40, 0]]);
  W.p.hp = 1000;
  assert.ok(W.act({ t: "sk", id: "drain", a: 0 }).ok);
  let vs = run(W, 30);
  const beats = vs.flatMap((v) => (v.ev || []).filter((e) => e[0] === "a" && e[2] === 144 && e[7] > 0));
  assert.equal(beats.length, SK.drain.n, "six beats");
  assert.equal(beats[beats.length - 1][7], 2, "the last beat is the finisher");
  assert.ok(cbs(vs, m.id).includes(5), "the finisher spends the brand");
  assert.ok(W.p.hp > 1000 && m.hp < 50000, "it drains");
  W.ready();
  W.mobs([[40, 0]]);
  assert.ok(W.act({ t: "sk", id: "drain", a: 0 }).ok);
  W.step(); W.step(400);
  assert.ok(W.act({ t: "sk", id: "soulbolt", a: 0 }).ok);
  vs = run(W, 30);
  assert.equal(vs.flatMap((v) => (v.ev || []).filter((e) => e[0] === "a" && e[2] === 144)).length, 0, "another skill cuts the channel");
}

// ═════════ the bar: a fresh five-slot loadout keeps the job signature; the new skills can be cast from it
{
  for (const [wk, id] of Object.entries({ sword: "cleave", spear: "hook", staff: "ignite", book: "drain", bow: "snipe", dagger: "rupture" })) {
    const J = world("직업" + wk, { wk, lvl: 157, migrate: true });
    J.mobs([[24, 0]]);
    const sig = Object.keys(SK).find((k) => SK[k].kind === "j" && SK[k].wk === wk);
    assert.ok(J.act({ t: "sk", id: sig, a: 0 }).ok, `${wk}: the signature ${sig} is still on a fresh bar`);
    J.ready(); J.mobs([[24, 0]]);
    assert.ok(J.act({ t: "sk", id, a: 0 }).ok, `${wk}: ${id} is on a fresh bar`);
  }
}
// ═════════ 돌개바람 / 무쌍난무 (owner): job Lv.30 spins that follow the caster and pay MP (and HP) every beat
for (const [id, job, wk, beats, hpCost] of [["whirl", "swordsman", "sword", 17, true], ["musou", "lancer", "spear", 15, false]]) {
  assert.equal(SK[id].kind, "j"); assert.equal(D.jobs[job].sig !== id, true, id + " is not the job's signature");
  const W = heroOf(wk, "회전" + id), ch = W.p.ch;
  ch.job = job; ch.jp = { lv: 29, xp: 0 }; ch.jobs = { [job]: ch.jp }; ch.lo = { [job]: { a: [id, "slash", "spiral"].filter((k) => SK[k].wk === wk || k === id), p: [], x: "" } };
  W.ready();
  assert.equal(W.act({ t: "sk", id, a: 0 }).ok, false, id + " needs job Lv.30");
  ch.jp.lv = 30;
  const ms = W.mobs([[20, 0], [-20, 0], [0, 18]]);
  const mp0 = (W.p.mp = 300), hp0 = W.p.hp;
  assert.ok(W.act({ t: "sk", id, a: 0 }).ok, id + " at job Lv.30");
  const vs = run(W, Math.ceil(SK[id].ms / 100) + 6);
  const ticks = vs.flatMap((v) => (v.ev || []).filter((e) => e[0] === "a" && e[2] === SK[id].fx && e[7] > 0));
  assert.equal(ticks.length, beats, id + " beats");
  for (const m of ms) assert.ok(m.hp < 50000, id + " cuts every side");
  assert.ok(W.p.mp < Math.min(mp0, 212) - SK[id].mp, id + " pays MP every beat (a share of the pool, more than regeneration)");
  assert.equal(W.p.hp < hp0, hpCost, id + (hpCost ? " pays HP" : " costs no HP"));
  assert.equal(W.p.chan, 0, "the spin ends");
  // out of mana: it stops early
  W.ready(); W.p.cds = {}; W.mobs([[20, 0]]);
  assert.ok(W.act({ t: "sk", id, a: 0 }).ok);
  W.p.mp = 0;
  const short = run(W, Math.ceil(SK[id].ms / 100) + 6).flatMap((v) => (v.ev || []).filter((e) => e[0] === "a" && e[2] === SK[id].fx && e[7] > 0));
  assert.ok(short.length <= 1 && W.p.chan === 0, id + " stops when the mana runs out");
  // another skill cuts it
  W.ready(); W.p.cds = {}; W.mobs([[20, 0]]);
  assert.ok(W.act({ t: "sk", id, a: 0 }).ok); run(W, 5);
  assert.ok(W.act({ t: "sk", id: wk === "sword" ? "slash" : "spiral", a: 0 }).ok);
  assert.equal(W.p.chan, 0, id + " is cut by another skill");
}

// ═════════ VFX-01: snapshot combo bitmask (out.cb) + M row mk/br carry all 7 combo states to the client
{
  const W = heroOf("sword", "표식비트");
  const [m] = W.mobs([[24, 0]]);
  prime(m, "stg", W.now);
  let v = W.step();
  assert.equal(v.cb?.[m.id] & 1, 1, "stagger bit (1) sent in snap.cb");
  m.stg = 0; prime(m, "frz", W.now);
  v = W.step();
  assert.equal(v.cb?.[m.id] & 2, 2, "freeze bit (2) sent in snap.cb");
  m.frz = 0; m.stun = 0; prime(m, "air", W.now);
  v = W.step();
  assert.equal(v.cb?.[m.id] & 4, 4, "airborne bit (4) sent in snap.cb");
  m.air = 0; m.stun = 0; prime(m, "brn", W.now);
  v = W.step();
  assert.equal((v.cb?.[m.id] >> 3) & 3, 3, "burn stacks (3) sent in snap.cb bits 3..4");
  m.brn = 0; prime(m, "drag", W.now);
  v = W.step();
  assert.equal(v.cb?.[m.id] & 32, 32, "drag bit (32) sent in snap.cb");
}
console.log("combos ok — every hook applies, spends for a bonus and runs out; wind-up, channel and the bar hold");
