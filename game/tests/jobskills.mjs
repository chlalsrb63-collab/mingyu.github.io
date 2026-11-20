// The job skills of 2026-11-21 (owner): one more active (job Lv.20) and one passive (job Lv.10) for each of the
// 14 jobs (03-skills.js, 57-weapon-skills.js, 55-passives.js). Every passive is always on while its weapon is in hand.
//   node tests/jobskills.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs(), SK = D.skills;
const T = 16;
const JOB_WK = Object.fromEntries(Object.entries(D.jobs).filter(([, j]) => j.kind === "single").map(([id, j]) => [id, j.wk[0]]));

function world(job, jl, o = {}) {
  const S = L.setup();
  let now = 2_000_000;
  S.now = now;
  const PID = "pid-js";
  const ch = L.hero("직업기", { lvl: 120, wk: JOB_WK[job], wm: { [JOB_WK[job]]: 40 }, job, ...o });
  ch.jp = { lv: jl, xp: 0 }; ch.jobs = { [job]: ch.jp };
  L.addPlayer(S, PID, ch);
  const p = S.players[PID];
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  const W = {
    S, p, ch,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    get rt() { return S.maps[p.map]; },
  };
  W.map = W.step().map;
  for (const m of W.rt.mobs) { m.dead = true; m.respAt = now + 1e12; }
  const free = (x, y) => W.map.o[y] && W.map.o[y][x] === " " && !"wW".includes(W.map.g[y][x]);
  find: for (let y = 8; y < W.map.h - 8; y++) for (let x = 8; x < W.map.w - 8; x++) {
    let ok = true;
    for (let dy = -7; dy <= 7 && ok; dy++) for (let dx = -7; dx <= 7 && ok; dx++) if (!free(x + dx, y + dy)) ok = false;
    if (ok) { p.x = x * T + 8; p.y = y * T + 8; break find; }
  }
  p.aim = 0; p.hp = 1e6; p.mp = 9999; p.stc = null;
  W.mob = (dx, dy, hp = 1e6) => {
    const m = W.rt.mobs.find((q) => q.dead && !D.mobs[q.k].boss && !D.mobs[q.k].chest && !D.mobs[q.k].still && !D.mobs[q.k].fly);
    Object.assign(m, { dead: false, el: 0, tr: [], hp, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, brand: 0, tgt: p.pid, st: 0, act: null, castAt: now + 1e9, atkAt: now + 1e9 });
    return m;
  };
  W.cast = (id) => { p.atkAt = 0; p.mp = 9999; p.hp = Math.max(p.hp, 1e5); delete p.cds[id]; W.ch.lo[job] = { a: [id] }; const r = W.act({ t: "sk", id, a: 0 }); assert.ok(r.ok, `${id}: ${r.error}`); };
  W.self = () => { p.dirty = true; return W.step(1).self; };
  W.row = (id) => W.self().sk.find((r) => r[0] === id);
  return W;
}
const evs = (vs, tag) => vs.flatMap((v) => (v.ev || []).filter((e) => e[0] === tag));
const run = (W, n, ms = 100) => Array.from({ length: n }, () => W.step(ms));

// ── the table: every job's two new skills, at job Lv.20 and Lv.10, on that job's weapon
for (const [job, wk] of Object.entries(JOB_WK)) {
  const act = D.skillOrder.filter((id) => SK[id].job === job && SK[id].jl === 20), pas = D.skillOrder.filter((id) => SK[id].job === job && SK[id].jl === 10);
  assert.equal(act.length, 1, job + ": one Lv.20 active");
  assert.equal(pas.length, 1, job + ": one Lv.10 passive");
  assert.equal(SK[act[0]].wk, wk); assert.equal(SK[pas[0]].wk, wk); assert.equal(SK[pas[0]].kind, "p");
  // learned at its job level, on by itself from then on (no slot)
  const W = world(job, 9);
  assert.equal(W.row(pas[0]), undefined, pas[0] + " not yet at job Lv.9");
  W.ch.jp.lv = 10; W.p.stc = null;
  assert.equal(W.row(pas[0])[3], 1, pas[0] + " on at job Lv.10 with no slot set");
  assert.equal(W.act({ t: "sk", id: act[0], a: 0 }).error, `[${D.jobs[job].name}] 직업 Lv.20에 배웁니다`);
}
// a job passive is the job's own: another job with the same weapon never has it
{
  const W = world("bladedancer", 50);
  assert.equal(W.row("thief_biggame"), undefined);
  assert.equal(W.row("bladedancer_feast")[3], 1);
}

// ── 그림자 암살: one target only, from behind it; the thief stays a single-target job
{
  const W = world("thief", 20), p = W.p;
  const a = W.mob(40, 0), b = W.mob(48, 6), c = W.mob(-40, 0);
  const x0 = p.x;
  W.cast("assassinate");
  run(W, 3);
  assert.ok(a.hp < 1e6, "the aimed one is struck");
  assert.ok(b.hp === 1e6 && c.hp === 1e6, "nothing else is touched");
  assert.ok(p.x > a.x - 1 && p.x > x0, `the thief stands behind it (${x0} → ${p.x}, target ${a.x})`);
  assert.ok(p.hide > W.now, "hidden after the stab");
}

// ── 지각 붕괴: three rings, one a beat, each monster struck once
{
  const W = world("destroyer", 20), p = W.p;
  const near = W.mob(20, 0), mid = W.mob(50, 0), far = W.mob(80, 0);
  W.cast("aftershock");
  const vs = run(W, 9);
  const rings = evs(vs, "a").filter((e) => e[1] === p.eid && e[2] === SK.aftershock.fx).map((e) => e[7]);
  assert.deepEqual(rings, SK.aftershock.rings, "the three rings in order");
  for (const m of [near, mid, far]) assert.ok(m.hp < 1e6, "every ring finds its band");
  const once = 1e6 - near.hp;
  run(W, 4);
  assert.equal(1e6 - near.hp, once, "the inner one is not struck again by the outer rings");
}

// ── 봉인의 룬: the sealed take more from everyone for a while
{
  const W = world("runearcher", 20);
  const m = W.mob(60, 0);
  W.cast("sealrune");
  W.step();
  assert.ok(m.vuln > W.now + 4000, "sealed for five seconds");
  assert.ok(m.stun > W.now, "and held");
}

// ── 행운의 주사위: a face 1–6 from the world's dice (deterministic), its numbers on the sheet
{
  const faces = new Set();
  for (let i = 0; i < 12; i++) {
    const W = world("trickster", 20);
    W.S.seed = (W.S.seed | 0) + i * 7919;   // a different point in the world's dice stream
    W.cast("luckydice");
    const f = W.p.dice.f;
    faces.add(f);
    assert.ok(f >= 1 && f <= 6);
    const v = W.step();
    assert.ok(evs([v], "a").some((e) => e[2] === SK.luckydice.fx && e[7] === f), "the face goes to the client");
  }
  assert.ok(faces.size >= 2, "the dice really roll: " + [...faces]);
}

// ── 광폭의 포효: rage full at once, a faster swing and lifesteal for six seconds
{
  const W = world("swordsman", 20), p = W.p;
  W.mob(30, 0);
  const ls0 = W.self().ls ?? null;
  W.cast("warcry");
  const v = { self: W.self() };
  assert.equal(v.self.jt?.v ?? D.jobTraits.swordsman.max, D.jobTraits.swordsman.max, "rage full");
  assert.ok(p.cryAt > W.now, "the roar lasts");
  if (ls0 !== null) assert.ok(v.self.ls > ls0, "lifesteal up");
}

// ── 최후의 룬: low HP raises the rune shield by itself, once in 30 s
{
  const W = world("runearcher", 10), p = W.p;
  const v0 = { self: W.self() };
  const mhp = v0.self.mhp;
  p.hp = Math.floor(mhp * 0.2);
  const vs = run(W, 2);
  assert.ok(evs(vs, "ps").some((e) => e[1] === p.eid && e[2] === SK.runearcher_lastward.ps), "the proc shows");
  assert.ok(p.ail?.ward?.amount >= Math.round(mhp * 0.15) - 1, "a 15% shield");
  p.ail.ward.until = 0;
  run(W, 5);
  assert.ok(!(p.ail.ward.until > W.now), "not again so soon");
}

// ── 피의 갈증: a kill gives HP back and a rage stack
{
  const W = world("swordsman", 10), p = W.p;
  const m = W.mob(24, 0, 1);
  p.hp = 1000;
  p.atkAt = 0;
  W.act({ t: "atk", a: 0 });
  const vs = run(W, 6);
  assert.ok(m.dead, "the weak one falls");
  assert.ok(evs(vs, "ps").some((e) => e[1] === p.eid && e[2] === SK.swordsman_bloodlust.ps), "the proc shows");
  assert.ok(p.hp > 1000, "HP back");
}

// ── an old v32 sheet: its loadout's passive and cross slots are gone, the actives stay
{
  const ch = L.hero("옛시트", { lvl: 60, wk: "dagger", wm: { dagger: 30 }, job: "thief" });
  const old = JSON.parse(JSON.stringify(ch));
  old.v = 32; old.lo = { thief: { a: ["ambush", "shade"], p: ["vitals", "dagger_shade20"], x: "inertia", y: "hawk" } };
  const S = L.setup();
  L.addPlayer(S, "pid-old", old);
  assert.deepEqual(S.players["pid-old"].ch.lo.thief, { a: ["ambush", "shade"] });
}
console.log("jobskills ok — 14 actives and 14 passives, single-target 암살, rings, seal, dice, roar, last rune, bloodlust, v32 sheet");
