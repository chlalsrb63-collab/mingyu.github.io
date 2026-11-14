// Headless test of hit feel on the server: hitstun (a struck monster neither moves nor strikes for
// a moment and its cooldowns pause), the micro-knockback that comes with it (never into a wall),
// and the big things that shrug it off.   node tests/feel.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// the rules, with a back door to hurtMob for the killing-blow check
const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { hurtMob };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

const D = L.defs();
const T = 16;

function world(name, cls = "warrior") {
  const S = L.setup();
  let now = 2_000_000;
  S.now = now;
  const PID = "pid-" + name;
  const ch = L.newChar(name, cls, []);
  ch.lvl = 30;
  L.addPlayer(S, PID, ch);
  const W = {
    S,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
  };
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  W.map = W.step().map;
  for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  W.ready = () => { p.hp = 1e6; p.mp = 9999; p.atkAt = 0; };
  W.free = (tx, ty) => W.map.o[ty] && W.map.o[ty][tx] === " " && !"wW".includes(W.map.g[ty][tx]);
  /** One plain walking monster at (x, y), hunting the player, its attack ready in `cd` ms. */
  W.mob = (x, y, cd = 0, extra = {}) => {
    const m = W.rt.mobs.find((o) => o.dead && !D.mobs[o.k].chest && !D.mobs[o.k].boss && !D.mobs[o.k].fly && !D.mobs[o.k].still && !D.mobs[o.k].shot && !D.mobs[o.k].volley);
    Object.assign(m, { dead: false, el: 0, tr: [], hp: 1e6, x, y, hx: x, hy: y, by: {}, stun: 0, slow: 0, mk: 0, dec: null, vuln: 0, tgt: W.p.pid, st: 0, act: null, castAt: now + 1e9, atkAt: now + cd }, extra);
    return m;
  };
  return W;
}
/** An open patch of meadow: (tx, ty) with `w` free tiles either way. */
function openSpot(W, w = 3) {
  for (let y = 5; y < W.map.h - 5; y++) for (let x = 5; x < W.map.w - 5; x++) {
    let ok = true;
    for (let dy = -w; dy <= w && ok; dy++) for (let dx = -w; dx <= w && ok; dx++) if (!W.free(x + dx, y + dy)) ok = false;
    if (ok) return [x, y];
  }
  throw new Error("no open ground");
}
const mobEv = (v, id) => (v.ev || []).filter((e) => e[0] === "m" && e[1] === id);

// ── a blow staggers: no step and no strike for a moment, and the cooldown left over is paused, not spent
{
  const W = world("비틀");
  const [tx, ty] = openSpot(W);
  const p = W.p;
  p.x = tx * T + 8; p.y = ty * T + 8; p.aim = 0;
  W.ready();
  const m = W.mob(p.x + 18, p.y, 60);              // its bite is 60 ms away
  const left = m.atkAt - W.now;
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  assert.ok(m.stun > W.now, "struck: it reels");
  const held = m.stun - W.now;
  assert.ok(held >= 100 && held <= 400, `stagger lasts a beat (${held} ms)`);
  assert.ok(m.atkAt - m.stun >= left - 1, "the bite it was about to make waits until the stagger is over, then the rest of its cooldown");
  const x0 = m.x, y0 = m.y;
  const v = W.step(100);
  assert.equal(mobEv(v, m.id).length, 0, "a staggered monster does not strike");
  assert.ok(Math.abs(m.x - x0) < 0.01 && Math.abs(m.y - y0) < 0.01, "nor does it move");
  // once it is over it fights again
  let bit = false;
  for (let i = 0; i < 20 && !bit; i++) { const vv = W.step(100); bit = mobEv(vv, m.id).length > 0; }
  assert.ok(bit, "when the stagger ends it strikes again");
}

// ── a skill's blow (hurtMob alone) staggers too, and nudges it straight back from the striker
{
  const W = world("밀림", "mage");
  const [tx, ty] = openSpot(W);
  const p = W.p;
  p.x = tx * T + 8; p.y = ty * T + 8; p.aim = 0;
  W.ready();
  const m = W.mob(p.x + 30, p.y, 1e9);
  // any skill that hurts a monster in front will do; walk the kit until one lands, in small steps
  // so the step it lands in shows the shove (it walks back toward the caster once it recovers)
  let hit = null;
  for (let i = 0; i < D.skills.mage.length && !hit; i++) {
    if (D.skills.mage[i].lv > 30) continue;
    W.ready(); for (let j = 0; j < 6; j++) p.cds[j] = 0;
    const hp0 = m.hp, xb = m.x;
    W.act({ t: "sk", i, a: 0 });
    for (let s = 0; s < 40 && !hit; s++) { const x0 = m.x, y0 = m.y; W.step(20); if (m.hp < hp0) hit = [m.x - (m.hp < hp0 && s === 0 ? xb : x0), m.y - y0]; }
  }
  assert.ok(hit, "a mage skill lands");
  assert.ok(hit[0] > 1, `knocked away from the caster (${hit[0].toFixed(2)} px)`);
  assert.ok(Math.abs(hit[1]) < 1, "along the line from the striker");
}

// ── bosses, guardians / field bosses and rooted things shrug it off (they only flinch on screen)
{
  const W = world("거목");
  const [tx, ty] = openSpot(W);
  const p = W.p;
  p.x = tx * T + 8; p.y = ty * T + 8; p.aim = 0;
  for (const [what, extra] of [["boss", { k: "boss" }], ["field boss / guardian", { el: 2 }]]) {
    W.ready();
    const m = W.mob(p.x + 18, p.y, 500, extra);
    const atk0 = m.atkAt, x0 = m.x, y0 = m.y;
    assert.ok(W.act({ t: "atk", a: 0 }).ok);
    assert.ok(m.hp < 1e6, what + " is hit");
    assert.equal(m.stun, 0, what + " is not staggered");
    assert.equal(m.atkAt, atk0, what + "'s cooldown runs on");
    assert.ok(m.x === x0 && m.y === y0, what + " is not knocked back");
    m.dead = true; m.respAt = W.now + 1e12;
    W.step(1000);
  }
}

// ── knockback stops at walls: hammered toward something solid, a monster never ends up inside it
{
  const W = world("벽쿵");
  const p = W.p;
  // a free tile with a free tile west of it (for the striker) and a solid one east of it
  let spot = null;
  for (let y = 3; y < W.map.h - 3 && !spot; y++) for (let x = 4; x < W.map.w - 3 && !spot; x++) {
    if (W.free(x, y) && W.free(x - 1, y) && W.free(x - 2, y) && W.free(x - 3, y) && !W.free(x + 1, y)) spot = [x, y];
  }
  assert.ok(spot, "a wall to push against");
  const [tx, ty] = spot;
  p.x = (tx - 2) * T + 8; p.y = ty * T + 8; p.aim = 0;
  const m = W.mob(tx * T + 10, ty * T + 8, 1e9);
  for (let i = 0; i < 14; i++) {
    W.ready();
    W.act({ t: "atk", a: 0 });
    const mx = Math.floor(m.x / T), my = Math.floor(m.y / T);
    assert.ok(W.free(mx, my), `blow ${i + 1}: the monster stands on open ground (${m.x.toFixed(1)}, ${m.y.toFixed(1)})`);
    assert.ok(m.x < (tx + 1) * T, `blow ${i + 1}: not shoved through the wall`);
    W.step(1100);
  }
}

// ── no stun-lock: hammered every 100 ms for 5 s (a party's worth), a monster still strikes nearly as
// often as one left alone (at least 85%), and a killing blow does not shove or stagger the body
{
  const strikes = (hit) => {
    const W = world("난타");
    const [tx, ty] = openSpot(W, 4);
    const p = W.p;
    p.x = tx * T + 8; p.y = ty * T + 8; p.aim = 0;
    W.ready();
    const m = W.mob(p.x + 14, p.y, 0);
    let n = 0;
    for (let t = 0; t < 5000; t += 100) {
      if (hit) { W.ready(); p.x = m.x - 14; p.y = m.y; W.act({ t: "atk", a: 0 }); m.hp = 1e6; }
      n += mobEv(W.step(100), m.id).length;
    }
    return { n, m };
  };
  const calm = strikes(false).n, { n: hammered, m } = strikes(true);
  assert.ok(calm >= 3, `a monster left alone strikes (${calm} in 5 s)`);
  assert.ok(hammered >= Math.floor(calm * 0.85), `hammered every 100 ms it still strikes ${hammered} of ${calm} times`);
  assert.ok(m.hw > 0 && m.hu <= 340, "its hold budget is spent and capped");

  const W = world("막타");
  const [tx, ty] = openSpot(W);
  const p = W.p;
  p.x = tx * T + 8; p.y = ty * T + 8;
  const k = W.mob(p.x + 18, p.y, 1e9, { hp: 1 });
  const x0 = k.x, y0 = k.y, a0 = k.atkAt;
  W.S.now = W.now;
  L.__t.hurtMob(W.S, W.rt, k, p, 1);
  assert.ok(k.dead, "the blow kills it");
  assert.equal(k.stun, 0, "the slain are not staggered");
  assert.equal(k.atkAt, a0, "nor their cooldowns held");
  assert.ok(k.x === x0 && k.y === y0, "nor shoved");
}

// ── the same blows give the same stagger and the same shove (the rules are deterministic)
{
  const run = () => {
    const W = world("같음");
    const [tx, ty] = openSpot(W);
    const p = W.p;
    p.x = tx * T + 8; p.y = ty * T + 8; p.aim = 2;
    const m = W.mob(p.x + 14, p.y + 9, 300);
    const out = [];
    for (let i = 0; i < 6; i++) { W.ready(); W.act({ t: "atk", a: 2 }); out.push([m.x.toFixed(3), m.y.toFixed(3), m.stun - W.now, m.atkAt - W.now]); W.step(400); }
    return JSON.stringify(out);
  };
  assert.equal(run(), run(), "deterministic");
}

console.log("feel ok");
