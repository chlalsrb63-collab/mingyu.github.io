// The felt passives and the job palettes (docs/design/skills-v2.md, 55-passives.js, 04-job-palettes.js).
//   node tests/passives.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;

// ── palettes: every job has [main, light, dark, accent], distinct mains; every skill names a job with one
{
  const hex = /^#[0-9a-f]{6}$/;
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  for (const j of Object.keys(D.jobs)) {
    const pal = D.jobPal[j];
    assert.ok(pal && pal.name && pal.c.length === 4 && pal.c.every((c) => hex.test(c)), j + " has a palette");
    const [main, light, dark] = pal.c.map(lum);
    assert.ok(light > main && main > dark, j + ": light > main > dark");
    assert.ok(main > 70, j + ": the main colour reads on the dark HUD");
  }
  const mains = Object.values(D.jobPal).map((p) => p.c[0]);
  assert.equal(new Set(mains).size, mains.length, "every job's main colour is its own");
  for (const id of D.skillOrder) assert.ok(D.jobPal[D.skillJob[id]], id + " is drawn in a job's palette");
  assert.equal(D.skillJob.slash, "swordsman");
  assert.equal(D.skillJob.crimson, "spellblade");
}

// ── every passive is felt: no stat passive under 6 %, every triggered one has a proc code
for (const id of D.skillOrder) {
  const sk = D.skills[id];
  if (sk.kind !== "p" || sk.wk === "hammer") continue;
  if (sk.perk) assert.ok(sk.perk[1] >= 6, `${id}: ${sk.perk[1]}% is too small to feel`);
  if (sk.ps) assert.ok(sk.ps >= 140, id + " proc code");
}

function world(o) {
  const S = L.setup();
  let now = 2_000_000;
  S.now = now;
  const PID = "pid-pas";
  const ch = L.hero("패시브", { lvl: 157, ...o });
  if (o.pas) ch.lo[ch.job] = { a: o.act || [], p: o.pas, x: "", y: "" };
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
  // an open patch of meadow to stand in
  const free = (x, y) => W.map.o[y] && W.map.o[y][x] === " " && !"wW".includes(W.map.g[y][x]);
  find: for (let y = 6; y < W.map.h - 6; y++) for (let x = 6; x < W.map.w - 6; x++) {
    let ok = true;
    for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4 && ok; dx++) if (!free(x + dx, y + dy)) ok = false;
    if (ok) { p.x = x * T + 8; p.y = y * T + 8; break find; }
  }
  p.aim = 0; p.hp = 1e6; p.mp = 9999; p.stc = null;
  /** A pinned, harmless monster of the meadow's first tier at (dx, dy) from the hero. */
  W.mob = (dx, dy, hp = 1e6) => {
    const m = W.rt.mobs.find((q) => q.dead && !D.mobs[q.k].boss && !D.mobs[q.k].chest && !D.mobs[q.k].still && !D.mobs[q.k].fly);
    Object.assign(m, { dead: false, el: 0, tr: [], hp, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, brand: 0, tgt: p.pid, st: 0, act: null, castAt: now + 1e9, atkAt: now + 1e9 });
    return m;
  };
  W.ready = () => { p.atkAt = 0; p.hp = Math.max(p.hp, 1); p.mp = 9999; };
  return W;
}
const ps = (v, code) => (v.ev || []).some((e) => e[0] === "ps" && e[2] === code);

// ── 날에 실은 무게: the third blow of a sword combo shakes the ground round its target
{
  const W = world({ wk: "sword", wm: { sword: 40 }, job: "swordsman", pas: ["inertia", "sword_weight40"] });
  const a = W.mob(24, 0), b = W.mob(40, 10);
  let quake = false;
  W.ready();
  for (let i = 0; i < 3; i++) {
    assert.ok(W.act({ t: "atk", a: 0 }).ok, "blow " + i);
    const view = W.step(100);
    const meleeHits = view.ev.filter((event) => event[0] === "h" && event[8]?.[0] === W.p.eid);
    assert.ok(meleeHits.length, "the basic swing reports its attacker");
    for (const hit of meleeHits) assert.deepEqual(hit[8], [W.p.eid, D.wkinds.sword.fx, +(i === 2)]);
    if (ps(view, 141)) quake = true;
    if (i < 2) { assert.ok(!quake, "only the finisher"); for (let k = 0; k < 8; k++) W.step(100); }
  }
  assert.ok(quake && b.by[W.p.pid] > 0, "the finisher's shockwave reached the second monster");
}

// ── 빈틈을 읽는 눈 / 그림자 회수 / 피를 머금은 날: a sure first crit; a kill trims dagger waits, heals and hastens
{
  const W = world({ wk: "dagger", wm: { dagger: 50 }, job: "thief", pas: ["dagger_snap30", "dagger_edge40", "dagger_fang50"] });
  for (let i = 0; i < 5; i++) {
    const m = W.mob(14, 0);
    W.ready();
    assert.ok(W.act({ t: "atk", a: 0 }).ok);
    assert.ok(W.rt.ev.some((e) => e[0] === "h" && e[1] === m.id && e[3] === 1), "the first stab on a fresh monster is a crit");
    W.step(100);
    m.dead = true; m.respAt = W.now + 1e12;
  }
  const m = W.mob(14, 0, 1);
  W.p.cds.ambush = W.now + 5000;
  W.p.hp = 100;
  W.p.dirty = true;
  const acd0 = W.step().self.acd, cd0 = W.p.cds.ambush - W.now;
  W.ready(); W.p.hp = 100;
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  assert.ok(m.dead, "a one-HP monster falls");
  assert.ok(W.p.cds.ambush - W.now <= Math.round(cd0 * 0.7) + 1, "the kill took 30% off 암습's wait");
  assert.ok(W.p.hp > 100, "and healed");
  assert.ok(W.p.fangAt > W.now, "and hastened");
  const v = W.step();

  assert.ok(v.self && v.self.acd < acd0, "the faster blows reach the client");
}

// ── 창끝 반동 / 하나로 모인 힘: a tip blow is a sure crit and trims the spear waits
{
  const W = world({ wk: "spear", wm: { spear: 50 }, job: "lancer", pas: ["tip", "spear_advance30", "spear_edge50"] });
  let crits = 0;
  for (let i = 0; i < 6; i++) {
    const m = W.mob(46, 0);
    W.p.cds.spiral = W.now + 4000;
    W.ready();
    assert.ok(W.act({ t: "atk", a: 0 }).ok);
    if (W.rt.ev.some((e) => e[0] === "h" && e[1] === m.id && e[3] === 1)) crits++;
    assert.ok(W.p.cds.spiral - W.now <= 3500, "a tip blow takes 0.5 s off 나선 찌르기");
    W.step(100);
    m.dead = true; m.respAt = W.now + 1e12;
  }
  assert.ok(crits >= 5, `tip blows crit (${crits}/6; a graze is the only miss)`);
}

// ── 정신 집중: 1.5 s still and the next skill is focused (flag 128 on the hero), then spent
{
  const W = world({ wk: "staff", wm: { staff: 40 }, job: "wizard", pas: ["reso", "staff_spark40"], act: ["fireball"] });
  W.mob(60, 0);
  W.p.mvAt = W.now;
  let v = W.step(500);
  const me = (vv) => [0, 0, 0, 0, 0, 0, 0, 0, vv.me[8]];
  assert.ok(!(me(v)[8] & 128), "not yet");
  for (let i = 0; i < 12; i++) v = W.step(100);
  assert.ok(me(v)[8] & 128, "focused after standing still");
  W.ready();
  assert.ok(W.act({ t: "sk", id: "fireball", a: 0 }).ok);
  v = W.step(100);
  assert.ok(ps(v, 149), "the focused cast shows");
  assert.ok(!(me(v)[8] & 128), "and the focus is spent");
}

// ── 낙인 전염: a branded monster's fall passes the brand on to two near it
{
  const W = world({ wk: "book", wm: { book: 40 }, job: "warlock", pas: ["brand", "book_clause30"] });
  const a = W.mob(20, 0, 1), b = W.mob(36, 8), c = W.mob(36, -8), d = W.mob(-200, 0);
  a.brand = W.now + 5000;
  W.ready();
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  for (let i = 0; i < 10 && !a.dead; i++) W.step(100);
  assert.ok(a.dead, "the branded one fell");
  assert.ok(b.brand > W.now && c.brand > W.now && !(d.brand > W.now), "its brand moved on to the two beside it, not far away");
}

// ── 연속 사격: every fifth arrow brings a second one
{
  const W = world({ wk: "bow", wm: { bow: 40 }, job: "archer", pas: ["hawk", "bow_string30"] });
  W.mob(90, 0);
  let n = 0;
  for (let i = 0; i < 10; i++) { W.ready(); assert.ok(W.act({ t: "atk", a: 0 }).ok); if (ps(W.step(100), 153)) n++; }
  assert.equal(n, 2, "two double shots in ten arrows");
}

// ── 벼랑 끝 투지: below 40% HP the sword swings faster and blows land lighter
{
  const W = world({ wk: "sword", wm: { sword: 40 }, job: "swordsman", pas: ["inertia", "sword_fortify30"] });
  W.p.hp = 1e9; W.step(); W.p.dirty = true;
  const full = W.step().self.acd;
  W.p.hp = 10;
  const low = W.step().self.acd;
  assert.ok(low < full * 0.85, `faster when low (${full} → ${low} ms)`);
}

// ── 단죄의 일격 spends the inertia it was built on
{
  const W = world({ wk: "sword", wm: { sword: 40 }, job: "swordsman", pas: ["inertia"], act: ["verdict"] });
  W.ch.jp = { lv: 20, xp: 0 }; W.p.stc = null;
  W.mob(20, 0);
  W.p.inert = 5; W.p.inertAt = W.now;
  W.ready();
  assert.ok(W.act({ t: "sk", id: "verdict", a: 0 }).ok);
  assert.ok(!W.p.inert || W.p.inert <= 1, "the stacks were spent");
}
console.log("passives ok — palettes, felt passives and the inertia finisher");
