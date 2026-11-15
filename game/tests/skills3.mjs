// Headless test of the first wave of new weapon skills (docs/design/skill-ideas.md §9) and the engine pieces they
// brought: E1 held charge tiers (incl. over-charge), E3 parry (success, whiff), E5 smoke daze, the post-dash window,
// the carry's crowd stun, orbiting blades, chain lightning, the snare's root as stagger, the launching stomp.   node tests/skills3.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { mobHit, skGuard, MOBS, DASH };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs(), SK = D.skills, T = 16;
const WAVE = { stomp: "hammer", mortar: "bow", dragonpierce: "bow", rollshot: "bow", chainbolt: "staff", shoulder: "sword", snare: "bow", bladevortex: "dagger", smoke: "dagger", parry: "sword", mountain: "sword" };

/** A hero alone on open meadow ground (as tests/combos.mjs), the aim east, the skill under test on the bar. */
function world(name, wk, wm = 45) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, L.hero(name, { lvl: 157, wk, wm: { [wk]: wm } }));
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
  const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  let spot = null;
  for (let y = 4; y < mp.h - 4 && !spot; y++) for (let x = 8; x < mp.w - 17 && !spot; x++) {
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -6; dx <= 16 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
    if (ok) spot = [x, y];
  }
  assert.ok(spot, "open ground");
  const home = [spot[0] * T + 8, spot[1] * T + 10];
  W.ready = () => {
    Object.assign(p, { x: home[0], y: home[1], mvAt: now, fix: false, dir: 2, aim: 0, mp: 9999, hp: 1e6, atkAt: 0, stag: 0, combo: 0, dance: null, ghost: 0, cds: {}, charge: null, chan: 0, reso: 0, weave: null, inert: 0, hold: null, parry: null, exposed: 0, smokeAt: 0, dashAt: 0, dodge: 0 });
    for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
    W.rt.props = []; W.rt.zones = []; W.rt.decoys = []; W.rt.shots = [];
  };
  W.mobs = (offs) => {
    const pool = W.rt.mobs.filter((q) => !D.mobs[q.k].chest && !D.mobs[q.k].boss && !D.mobs[q.k].fly && !D.mobs[q.k].still);
    return offs.map(([dx, dy], j) => Object.assign(pool[j], { slot: null, dead: false, el: 0, tr: [], hp: 50000, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, wx: p.x + dx, wy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, brand: 0, dot: null, tgt: null, st: 0, act: null, castAt: now + 1e12, atkAt: now + 1e12, mvAt: now + 1e12, hw: 0, hu: 0, stg: 0, frz: 0, air: 0, brn: 0, brnAt: 0, drag: 0, daze: 0, cast: null }));
  };
  /** Only these skills on the bar (and the weapon's first passive, inertia for the sword). */
  W.bar = (...ids) => { p.ch.lo[p.ch.job] = { a: ids, p: wk === "sword" ? ["inertia"] : [], x: "", y: "" }; };
  W.ready();
  return W;
}
const run = (W, n, ms = 100) => { const vs = []; for (let i = 0; i < n; i++) vs.push(W.step(ms)); return vs; };
const evs = (vs, tag) => vs.flatMap((v) => (v.ev || []).filter((e) => e[0] === tag));
const fxOf = (vs, code) => evs(vs, "a").filter((e) => e[2] === code);
const hurt = (m) => m.hp < 50000;

// ═════════ the table: mastery slots, cooldown bands, fx codes, and a skill that is learned is castable
for (const [id, wk] of Object.entries(WAVE)) {
  const s = SK[id];
  assert.ok(s && s.kind === "a" && s.wk === wk, id + " is a " + wk + " active");
  assert.ok([5, 15, 30, 40, 45].includes(s.need), id + " takes a new mastery slot");
  assert.ok(s.fx >= 148 && s.fx <= 159, id + " fx");
  assert.ok(s.desc && /[가-힣]/.test(s.desc), id + " is described in Korean");
}
for (const id of ["stomp", "rollshot", "chainbolt", "bladevortex"]) assert.ok(SK[id].cd <= 4000, id + " is short");
for (const id of ["mortar", "shoulder", "snare", "smoke"]) assert.ok(SK[id].cd >= 6000 && SK[id].cd <= 12000, id + " is mid");
for (const id of ["dragonpierce", "mountain"]) assert.ok(SK[id].cd >= 14000, id + " is long");

// ═════════ 땅울림 발구르기: no wind-up; the small go up, elites reel
{
  const W = world("발구르기", "hammer"); W.bar("stomp");
  const [a, b, far] = W.mobs([[20, 0], [-30, 10], [90, 0]]);
  b.el = 1;
  assert.equal(W.act({ t: "sk", id: "stomp", a: 0 }).error, undefined);
  assert.ok(!W.p.hammer && hurt(a) && hurt(b) && !hurt(far), "lands at once round the bearer (r52), not beyond");
  assert.ok(a.air > W.now, "a normal monster is launched (공중)");
  assert.ok(!(b.air > W.now) && b.stg > W.now, "an elite only reels (경직)");
  assert.ok(W.p.cds.stomp - W.now === SK.stomp.cd || W.p.cds.stomp > W.now, "on cooldown");
  // a scripted boss in its marked cast: the gauge drops by a tenth
  W.ready(); W.p.cds = {};
  const [boss] = W.mobs([[20, 0]]);
  boss.k = "clubshrimp"; boss.cast = { got: 0, need: 100000 };
  assert.ok(W.act({ t: "sk", id: "stomp", a: 0 }).ok);
  assert.ok(boss.cast.got >= 100000 * SK.stomp.gauge, "a boss's stagger gauge −10%");
}

// ═════════ 곡사 폭약 화살: lands half a second later, two marks each
{
  const W = world("곡사", "bow"); W.bar("mortar");
  const [a, b] = W.mobs([[80, 0], [96, 10]]);
  assert.ok(W.act({ t: "sk", id: "mortar", a: 0 }).ok);
  W.step(300);
  assert.ok(!hurt(a), "still in the air");
  const vs = run(W, 4);
  assert.ok(hurt(a) && hurt(b) && a.mk === 2 && b.mk === 2, "the blast marks all it caught (+2)");
  assert.ok(fxOf(vs, SK.mortar.fx).some((e) => e[7] === 2), "the landing has its event");
}

// ═════════ 용뼈 관통 사격: wind-up, the whole line, marks spent for more, recoil
{
  const W = world("용뼈", "bow"); W.bar("dragonpierce");
  let plain = 0, primed = 0;
  for (const on of [false, true]) for (let i = 0; i < 6; i++) {
    W.ready();
    const ms = W.mobs([[30, 0], [80, 0], [150, 0]]);
    if (on) for (const m of ms) { m.mk = 2; m.mkAt = W.now + 10000; }
    const x0 = W.p.x;
    assert.ok(W.act({ t: "sk", id: "dragonpierce", a: 0 }).ok);
    assert.ok(W.p.charge, "drawn first");
    W.step(400);
    assert.ok(!hurt(ms[0]), "not yet");
    run(W, 6);
    assert.ok(ms.every(hurt), "pierces everyone along the line");
    assert.ok(W.p.x < x0, "the recoil slides the archer back");
    if (on) { assert.ok(ms.every((m) => m.mk === 0), "marks burst"); primed += ms.reduce((s, m) => s + 50000 - m.hp, 0); }
    else plain += ms.reduce((s, m) => s + 50000 - m.hp, 0);
  }
  assert.ok(primed > plain * 1.35, `two marks each ≈ +50% (${Math.round(primed)} vs ${Math.round(plain)})`);
}

// ═════════ 구르며 쏘기: the ace shot only inside the window after a dash
{
  const W = world("구르기", "bow"); W.bar("rollshot");
  const shot = () => W.rt.shots[W.rt.shots.length - 1];
  W.mobs([[100, 0]]);
  assert.ok(W.act({ t: "sk", id: "rollshot", a: 0 }).ok);
  const base = shot().mult;
  assert.equal(shot().pierce, 0, "a plain shot");
  // dash, then loose 0.2 s later: 회심
  W.ready(); W.mobs([[100, 0]]);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  W.step(200);
  const dashAt = W.p.dashAt;
  assert.ok(W.act({ t: "sk", id: "rollshot", a: 0 }).ok);
  assert.ok(Math.abs(shot().mult / base - SK.rollshot.ace) < 1e-6 && shot().pierce === 99, "the ace: ×2.2 and piercing");
  assert.equal(W.p.dashAt, dashAt - SK.rollshot.dashCut, "the dash comes back 2 s sooner");
  // too late: 0.7 s after the dash
  W.ready(); W.mobs([[100, 0]]);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  run(W, 7);
  assert.ok(W.act({ t: "sk", id: "rollshot", a: 0 }).ok);
  assert.equal(shot().pierce, 0, "outside the window it is a plain shot");
}

// ═════════ 연쇄 번개: five in a chain within 60 of each other; one reaction on a burning one
{
  const W = world("연쇄", "staff"); W.bar("chainbolt");
  const ms = W.mobs([[50, 0], [90, 0], [130, 10], [170, 0], [210, 0], [250, 0]]);
  ms[3].brn = 2; ms[3].brnAt = W.now + 6000;
  ms[4].frz = W.now + 2000;   // (only the first of the two reacts)
  assert.ok(W.act({ t: "sk", id: "chainbolt", a: 0 }).ok);
  const vs = run(W, 2);
  assert.ok(ms.slice(0, 5).every(hurt) && !hurt(ms[5]), "five struck, the sixth spared");
  assert.equal(evs(vs, "rx").length, 1, "one reaction, at the first burning or frozen one");
  W.ready(); W.p.cds = {};
  assert.ok(W.act({ t: "sk", id: "chainbolt", a: 0 }).ok, "no target: refunded");
  assert.ok(W.p.mp === 9999, "the MP comes back");
}

// ═════════ 어깨 돌파: carried along; two together are stunned, one alone is knocked on
{
  const W = world("어깨", "sword"); W.bar("shoulder");
  let [a] = W.mobs([[24, 0]]);
  assert.ok(W.act({ t: "sk", id: "shoulder", a: 0 }).ok);
  assert.ok(a.drag > W.now && hurt(a), "carried (끌림) and struck");
  assert.ok(!(a.stun > W.now + 500), "alone in the open: shoved, not stunned");
  W.ready();
  const two = W.mobs([[24, 0], [40, 4]]);
  assert.ok(W.act({ t: "sk", id: "shoulder", a: 0 }).ok);
  for (const m of two) assert.ok(m.stun >= W.now + SK.shoulder.stun - 1 && m.stg > W.now, "two tangled together: stunned and staggered");
}

// ═════════ 올무 화살: the first to step in is rooted (counts as 경직), two near it hauled in; two snares at most
{
  const W = world("올무", "bow"); W.bar("snare");
  const [a, b] = W.mobs([[60, 0], [80, 10]]);
  assert.ok(W.act({ t: "sk", id: "snare", a: 0 }).ok);
  const d0 = Math.hypot(b.x - a.x, b.y - a.y);
  run(W, 5);
  assert.ok(a.stun >= W.now + 1500 && a.stg > W.now && hurt(a), "rooted 2.5 s, staggered");
  assert.ok(b.drag > W.now && Math.hypot(b.x - a.x, b.y - a.y) < d0, "the one beside it hauled in");
  W.ready();
  for (let i = 0; i < 3; i++) { W.p.cds = {}; W.p.aim = 4; assert.ok(W.act({ t: "sk", id: "snare", a: 4 }).ok); W.step(); }
  assert.equal(W.rt.props.filter((o) => o.snare).length, SK.snare.max, "at most two in the ground");
}

// ═════════ 칼날 소용돌이: blades stack round the caster; at five the next cast scatters them as marking knives
{
  const W = world("소용돌이", "dagger"); W.bar("bladevortex");
  const [a] = W.mobs([[20, 0]]);
  const cast = () => { W.p.cds = {}; assert.ok(W.act({ t: "sk", id: "bladevortex", a: 0 }).ok); };
  cast();
  const vortex = () => W.rt.props.find((o) => o.blades);
  assert.equal(vortex().blades, 1);
  let vs = run(W, 20);
  assert.ok(hurt(a), "one blade cuts every beat");
  const one = (50000 - a.hp) / fxOf(vs, SK.bladevortex.fx).length;
  for (let i = 0; i < 4; i++) cast();
  assert.equal(vortex().blades, SK.bladevortex.max, "five at most");
  a.hp = 50000;
  vs = run(W, 20);
  const five = (50000 - a.hp) / fxOf(vs, SK.bladevortex.fx).length;
  assert.ok(five > one * 2, `five blades cut far harder than one, armour aside (${Math.round(five)} vs ${Math.round(one)} a beat)`);
  cast();
  assert.ok(!vortex() && a.mk >= 1, "the fan of knives ends it and marks");
}

// ═════════ 연막탄 (E5): monsters in the smoke forget their target and do not look for one; volleys land softer in it
{
  const W = world("연막", "dagger"); W.bar("smoke");
  const [a, out] = W.mobs([[60, 0], [-80, 0]]);
  a.tgt = out.tgt = W.p.pid;
  assert.ok(W.act({ t: "sk", id: "smoke", a: 0 }).ok);
  run(W, 2);
  assert.ok(a.tgt !== W.p.pid && a.daze > W.now, "the one inside lost its target, dazed");
  assert.equal(out.tgt, W.p.pid, "outside the smoke nothing changes");
  run(W, 5);
  assert.notEqual(a.tgt, W.p.pid, "it does not pick a target again while in the smoke");
  const cloud = W.rt.props.find((o) => o.kind === "smoke");
  W.p.x = cloud.x; W.p.y = cloud.y; run(W, 3);
  assert.ok(W.p.smokeAt > W.now, "the caster in the cloud is covered");
  assert.equal(X.skGuard(W.S, W.rt, W.p, 100, out, "shot"), 70, "volleys −30%");
  assert.equal(X.skGuard(W.S, W.rt, W.p, 100, out, "blow"), 100, "blows as ever");
}

// ═════════ 칼등 받아치기 (E3): a blow from in front negated, the attacker reels, a counter; behind or whiffed, it hurts
{
  const W = world("받아치기", "sword", 30); W.bar("parry");
  const [front, back] = W.mobs([[20, 0], [-20, 0]]);
  assert.ok(W.act({ t: "sk", id: "parry", a: 0 }).ok);
  const hp0 = W.p.hp, cd0 = W.p.cds.parry;
  X.mobHit(W.S, W.rt, W.p, 500, front, "blow");
  assert.equal(W.p.hp, hp0, "the blow is caught");
  assert.ok(front.stun > W.now + 1000 && front.stg > W.now && hurt(front), "the attacker reels (경직) and takes the counter");
  assert.ok(W.p.inert >= SK.parry.inert, "+2 inertia (" + W.p.inert + ")");
  assert.ok(W.p.cds.parry - W.now <= Math.ceil((cd0 - W.now) / 2), "the cooldown halves");
  assert.ok(!W.p.parry, "one blow per guard");
  // from behind: no parry
  W.ready(); W.mobs([[20, 0], [-20, 0]]);
  assert.ok(W.act({ t: "sk", id: "parry", a: 0 }).ok);
  X.mobHit(W.S, W.rt, W.p, 500, back, "blow");
  assert.ok(W.p.hp < 1e6 && W.p.parry, "a blow from behind is not caught");
  // whiff: the opening afterwards
  W.ready(); W.mobs([[20, 0]]);
  assert.ok(W.act({ t: "sk", id: "parry", a: 0 }).ok);
  run(W, 5);
  assert.ok(!W.p.parry && W.p.exposed > W.now, "a whiffed guard leaves an opening");
  assert.equal(X.skGuard(W.S, W.rt, W.p, 100, front, "blow"), 120, "+20% taken meanwhile");
  run(W, 5);
  assert.equal(X.skGuard(W.S, W.rt, W.p, 100, front, "blow"), 100, "and then it closes");
  // a scripted boss in its marked cast: a quarter off the gauge
  W.ready(); W.p.cds = {};
  const [boss] = W.mobs([[20, 0]]);
  boss.k = "clubshrimp"; boss.cast = { got: 0, need: 100000 };
  assert.ok(W.act({ t: "sk", id: "parry", a: 0 }).ok);
  X.mobHit(W.S, W.rt, W.p, 500, boss, "tele");
  assert.ok(boss.cast.got >= 100000 * SK.parry.gauge, "the boss's stagger gauge −25%");
}

// ═════════ 산 가르기 (E1): tiers by time held, over-charge drops a tier, the brace, inertia starts it high
{
  const W = world("산가르기", "sword", 30); W.bar("mountain", "slash");
  /** Hold for `ms` (0: let it go by itself) and return the tier it landed at. */
  const tierAt = (ms, how = "skr") => {
    W.ready(); W.mobs([[30, 0]]);
    assert.ok(W.act({ t: "sk", id: "mountain", a: 0 }).ok);
    const vs = [];
    if (ms) { for (let t = 0; t < ms; t += 100) vs.push(W.step()); assert.ok(W.act(how === "skr" ? { t: "skr" } : { t: "sk", id: "mountain", a: 0 }).ok); vs.push(W.step()); }
    else vs.push(...run(W, 22));
    const e = fxOf(vs, SK.mountain.fx).find((x) => x[7] > 0);
    assert.ok(e && !W.p.hold, "it landed");
    return e[7] - 1;
  };
  assert.equal(tierAt(200), 0, "let go at once: tier 0");
  assert.equal(tierAt(600), 1, "0.5 s: tier 1");
  assert.equal(tierAt(1100), 2, "1.0 s: tier 2");
  assert.equal(tierAt(1500, "sk"), 3, "1.4 s: tier 3 (pressing it again lets it go too)");
  assert.equal(tierAt(0), 2, "held past 1.8 s it lets go by itself a tier short (over-charge)");
  // while holding: other skills wait, the others see it
  W.ready(); W.mobs([[30, 0]]);
  assert.ok(W.act({ t: "sk", id: "mountain", a: 0 }).ok);
  assert.equal(W.act({ t: "sk", id: "slash", a: 0 }).error, "기술을 모으는 중입니다");
  const v = run(W, 6).pop();
  assert.equal(v.me[8] & 256, 256, "the hold flag is on the wire");
  assert.equal((v.me[8] >> 9) & 3, 1, "with its tier");
  // the brace: the first blow at tier ≥1 is halved, no reeling, and the charge jumps a tier
  const [m] = W.rt.mobs.filter((o) => !o.dead);
  assert.equal(X.skGuard(W.S, W.rt, W.p, 100, m, "blow"), 50, "half the blow");
  assert.ok(W.p.hold.braced && W.now - W.p.hold.at >= SK.mountain.tiers[1], "a tier up");
  assert.equal(X.skGuard(W.S, W.rt, W.p, 100, m, "blow"), 100, "only the first blow");
  // full inertia: it starts at tier 1, and the stacks are spent
  W.ready(); W.mobs([[30, 0]]);
  W.p.inert = 5; W.p.inertAt = W.now;
  assert.ok(W.act({ t: "sk", id: "mountain", a: 0 }).ok);
  assert.ok(W.p.inert === 0 && W.now - W.p.hold.at >= SK.mountain.tiers[0], "관성 5 → tier 1 from the start");
  // tier 3 spends stagger and air for more
  W.ready();
  const [s] = W.mobs([[30, 0]]);
  s.stg = W.now + 3000; s.stun = W.now + 3000;
  assert.ok(W.act({ t: "sk", id: "mountain", a: 0 }).ok);
  run(W, 15);
  assert.ok(W.act({ t: "skr" }).ok);
  const after = W.step();
  assert.ok(evs([after], "cb").some((e) => e[1] === s.id && e[2] === 1), "tier 3 spends 경직");
  assert.equal(W.act({ t: "skr" }).ok, false, "nothing held, nothing to let go");
}

console.log("skills3 ok — the eleven new skills cast, shape, time and spend as designed; hold tiers, parry, smoke and the dash window hold");
