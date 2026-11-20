// Headless test of the helm-utility and phase-2 prefix powers (docs/design/prefix-effects.md §3.3 and the `단` = 2 rows; src/logic/54-prefix-util.js):
// trace sage mercy homing clever treasure tame hearth · bleed bile (DOT2) · carap bastion (ABS) · halo pack (AURA) · hellfire blizzard (ZN).
// Each power: the doc's row and numbers, fires / does not, ICD, caps, party range, zones expire, shields are capped, a dot does not stack with itself;
// then a perf + determinism smoke with eight of them on four heroes.   node tests/prefix-util.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { LEGEND, PFX, PFX_FN, PX, MOBS, SKILL, plain, stats, deriveStats, newMob, hurtMob, hurtPlayer, lootFor, deathLoss, skMp, migrate, pfxPc, pfxReset, pfxLoot, pfxNum, pfxSkill, pfxMiti, aimIdx, elementResist, elementActive, elementOutgoing };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

// ── worlds: n heroes (one party when n > 1) on the meadow, 40 px apart, no live monsters; `mob` makes a stunned one (it stands and hits nothing)
function world(name, n = 1) {
  const S = L.setup();
  let now = 2_000_000;
  S.now = now; S.last = now;
  const W = {
    S, ps: [],
    get now() { return now; },
    get p() { return W.ps[0]; },
    get rt() { return S.maps.meadow; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, W.p.pid))); L.endTick(S); return v; },
    run(ms) { for (let t = 0; t < ms; t += 100) W.step(100); },
    skip(ms) { now += ms; S.now = now; },   // time passes with no tick (a timer check)
    self() { W.p.dirty = true; return W.step().self; },
    act(a, p = W.p) { S.now = now; const v = L.validateAction(S, p.pid, a); if (v.ok) L.applyAction(S, p.pid, a); return v; },
    mob(k, x, y, o = {}) { const m = Object.assign(X.newMob(S, k, [0, 0, 0, 0]), { x, y, hp: 1e6, stun: 1e15 }, o); W.rt.mobs.push(m); return m; },
    wear(slot, id, lg, il = 100, p = W.p) { p.ch.eq[slot] = { ...X.plain(id), q: 3, il, lg }; p.stc = null; },   // (lg undefined = the same piece without its power)
    go(p, map) { L.runtime(S, p.map).n--; p.map = map; L.runtime(S, map).n++; },
  };
  for (let i = 0; i < n; i++) {
    const pid = `pid-${name}-${i}`;
    L.addPlayer(S, pid, L.hero(`${name}${i}`, { wk: "sword", lvl: 157, migrate: true }));
    const p = S.players[pid];
    W.go(p, "meadow"); p.sendMap = true;
    W.ps.push(p);
  }
  W.step();
  W.ps.forEach((p, i) => { p.x = 200 + i * 40; p.y = 200; p.mvAt = now; p.hp = 1e6; p.mp = 1e6; p.stag = 0; p.dead = false; p.ch.eq = { weapon: p.ch.eq.weapon }; p.stc = null; });
  for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  if (n > 1) { const party = { id: S.nextId++, m: W.ps.map((p) => p.pid) }; S.parties[party.id] = party; W.ps.forEach((p) => { p.party = party.id; }); }
  return W;
}
/** The HP a blow of `frac` × max HP takes p (a fixed seed unless given; `mob` the striker, null a marked area). */
function hurtBy(W, p, frac = 0.5, mob = null, seed = 4242) {
  const st = X.stats(p);
  W.S.now = W.now; p.hp = st.mhp; W.S.seed = seed;
  X.hurtPlayer(W.S, W.rt, p, Math.round(st.mhp * frac + st.def), mob);
  return st.mhp - p.hp;
}
/** Keep the elemental affixes and disable only the old % mitigation or shield hook for the comparison. */
function hurtWithoutMitigation(W, p, frac) {
  const hooks = X.deriveStats(p).pfx, restore = hooks.miti;
  hooks.miti = [];
  try { return hurtBy(W, p, frac); }
  finally { hooks.miti = restore; }
}
/** p kills a fresh monster (a killing blow, no more); its xp gain is left in p.gain. */
function kill(W, p, k, o = {}) {
  W.S.now = W.now; const m = W.mob(k, p.x + 30, p.y, { hp: 1, stun: 0, ...o });
  p.gain.length = 0; p.streakAt = 0; X.hurtMob(W.S, W.rt, m, p, 80, true);
  assert.ok(m.dead, "the test blow kills"); return m;
}
const xpGain = (p) => p.gain.find((g) => g[0] === "xp")[1];
const FAT = Object.keys(X.MOBS).filter((k) => !X.MOBS[k].chest && !X.MOBS[k].boss && !X.MOBS[k].still).sort((a, b) => X.MOBS[b].xp - X.MOBS[a].xp)[0];   // (the most xp: rounding stays small)
const BOSS = Object.keys(X.MOBS).find((k) => X.MOBS[k].boss && !X.MOBS[k].still), CHEST = Object.keys(X.MOBS).find((k) => X.MOBS[k].chest);

// ── 1. the rows and the numbers of the design doc (every power of this part, exactly)
const ROWS = {   // key: [word, slots, cat, rating, fam, PFX numbers, a piece of its tooltip]
  trace: ["추적자의", "H", "U", "S", "xp", { xp: 15 }, "+15%"], sage: ["현자의", "H", "U", "S", "xp", { xp: 12 }, "+12%"], mercy: ["자비로운", "H", "U", "S", "util", { k: 0.5 }, "50%"],
  homing: ["귀소의", "H", "U", "S", "util", { k: 0.5 }, "50%"], clever: ["영리한", "H", "U", "M", "util", { k: 0.85 }, "-15%"], treasure: ["보물눈의", "H", "U", "S", "eco", { mf: 50 }, "+50%"],
  tame: ["길들이는", "H", "U", "S", "util", { sp: 2 }, "2배"], hearth: ["화덕의", "H", "U", "S", "util", { k: 0.5 }, "+50%"],
  bleed: ["출혈의", "WGR", "O", "M", "crit", { ms: 4000, k: 0.15 }, "4초간 출혈 (매초 공격력의 15%)"], bile: ["담즙의", "AB", "D", "M", "mit", { p: 0.2, ms: 5000, k: 0.1 }, "20% 확률"],
  carap: ["갑각의", "AN", "D", "M", "sus", { k: 0.03, max: 0.15, ms: 10000 }, "3% 보호막"], bastion: ["방벽의", "ANH", "D", "M", "mit", { calm: 5000, k: 0.12, ms: 8000, icd: 25000 }, "12% 보호막이 8초간"],
  halo: ["후광의", "NH", "D", "S", "mit", { r: 150, k: 0.9 }, "-10%"], pack: ["무리의", "RG", "O", "M", "pass", { r: 200, k: 0.04, max: 0.12 }, "+4%"],
  hellfire: ["지옥불의", "WR", "O", "M", "kill", { p: 0.2, ms: 3000, every: 500, k: 0.25, r: 30 }, "공격력의 25%"], blizzard: ["눈보라의", "WR", "O", "M", "skill", { ms: 2500, every: 500, k: 0.2, r: 40 }, "공격력의 20%"],
};
for (const [k, [word, slots, cat, rating, fam, nums, tip]] of Object.entries(ROWS)) {
  const row = X.LEGEND[k];
  assert.deepEqual([row[0], row[2], row[3], row[4], row[5]], [word, slots, cat, rating, fam], `${k}: the doc's row`);
  for (const [f, v] of Object.entries(nums)) assert.equal(X.PFX[k][f], v, `${k}.${f}`);
  assert.equal(X.PFX[k].on, 1, `${k} is live`); assert.ok(row[1].includes(tip), `${k}: the tooltip names its numbers: ${row[1]}`);
  for (const [h, f] of Object.entries(X.PFX_FN[k])) assert.ok(typeof f === "function", `${k}.${h}`);
}
assert.equal(Object.keys(ROWS).length, 16);

// ── 2. helm utility
{
  // 추적자의 / 현자의: a kill's xp, and the shared +15 % cap (a fresh world per run: the same state both ways)
  const xp = (lg, { party = false, mob = {} } = {}) => { const W = world("xp", party ? 2 : 1); W.wear("helm", "h_3", lg); kill(W, W.p, FAT, mob); return xpGain(W.p); };
  const base = xp(undefined), elite = xp(undefined, { mob: { el: 1 } });
  assert.ok(Math.abs(xp("trace", { mob: { el: 1 } }) / elite - 1.15) < 0.01, "trace on an elite: +15 %, the shared xp cap");
  assert.equal(xp("trace"), base, "trace: a plain monster gives nothing extra");
  assert.ok(Math.abs(xp("sage", { party: true }) / xp(undefined, { party: true }) - 1.12) < 0.01, "sage: +12 % in a party"); assert.equal(xp("sage"), base, "sage alone: nothing");
  const W = world("xp0", 2), [p, q] = W.ps, S = W.S;
  const bossMob = W.mob(BOSS, 230, 200), tr = (m, kind = "xp") => X.pfxLoot(S, W.rt, p, m, kind);
  W.wear("helm", "h_3", "trace");
  assert.equal(tr(bossMob).xp, 15, "trace on a boss (capped)"); assert.equal(tr(bossMob, "drop").xp, 0, "trace is xp only");
  assert.equal(tr(W.mob("twinhare", 230, 200)).xp, 0); assert.equal(tr(W.mob("twinhare", 230, 200, { el: 2 })).xp, 15);
  W.wear("helm", "h_3", "sage");
  const sg = () => X.pfxLoot(S, W.rt, p, W.mob("twinhare", 230, 200), "xp").xp;
  assert.equal(sg(), 12, "sage in a party");
  q.x = 200 + 500; assert.equal(sg(), 0, "a mate out of range"); q.x = 240; q.map = "forest"; assert.equal(sg(), 0, "a mate elsewhere"); q.map = "meadow";
  q.dead = true; assert.equal(sg(), 0, "a fallen mate"); q.dead = false; const pid = p.party; p.party = 0; assert.equal(sg(), 0, "alone"); p.party = pid; assert.equal(sg(), 12);
  W.wear("helm", "h_3", "trace"); W.wear("amulet", "n_4", "sage");
  assert.equal(X.pfxLoot(S, W.rt, p, W.mob("twinhare", 230, 200, { el: 1 }), "xp").xp, 15, "trace + sage: +15 %, not +33 %");
}
{
  // 자비로운: the xp lost at a fall (a real respawn takes what deathLoss says)
  const lost = (lg) => {
    const W = world("mercy"), p = W.p; W.wear("helm", "h_3", lg); p.ch.xp = 1e8;
    const n = X.deathLoss(p.ch, p); p.dead = true; p.hp = 0; W.act({ t: "respawn" }); assert.equal(1e8 - p.ch.xp, n, "the respawn takes what deathLoss says"); return n;
  };
  const n0 = lost(undefined), n1 = lost("mercy");
  assert.ok(n0 > 0 && n1 === Math.floor(n0 * 0.5), `lost xp ${n0} → ${n1}`);
  const W = world("mercy2"); assert.equal(X.deathLoss(W.p.ch), X.deathLoss(W.p.ch, W.p), "without a power, or without p, as before");
}
{
  // 귀소의 / 영리한 / 길들이는 / 화덕의: named numbers, each only its own
  const W = world("nums"), p = W.p;
  const row = W.self().sk.filter((r) => r[3] && r[1] > 0 && r[2] === 0).sort((a, b) => b[1] - a[1])[0], id = row[0], sk = X.SKILL[id];   // (the dearest skill: the rounding stays small)
  const recall = () => { p.ch.inv.push({ id: "recall", n: 2 }); p.recall = null; W.act({ t: "use", id: "recall" }); return p.recall.at - W.now; };
  W.wear("helm", "h_3", undefined);
  const r0 = recall(), m0 = X.skMp(p, sk), pet0 = X.pfxNum(p, "pet", 300), rest0 = X.pfxNum(p, "rest", 0.06);
  assert.deepEqual([r0, pet0, rest0], [2000, 300, 0.06]); assert.ok(m0 > 0);
  W.wear("helm", "h_3", "homing"); assert.equal(recall(), 1000, "귀소의: the cast halves"); assert.deepEqual([X.pfxNum(p, "pet", 300), X.skMp(p, sk)], [pet0, m0]);
  W.wear("helm", "h_3", "clever"); assert.ok(Math.abs(X.skMp(p, sk) - m0 * 0.85) <= 1 && X.skMp(p, sk) < m0, `영리한: MP ${m0} → ${X.skMp(p, sk)}`); assert.equal(recall(), 2000);
  p.mp = 1e6; p.cds = {}; const mp0 = p.mp, cast = W.act({ t: "sk", id, a: X.aimIdx(1, 0) });
  assert.ok(cast.ok, "a real cast"); assert.equal(mp0 - p.mp, X.skMp(p, sk), "the cast costs the reduced MP");
  W.wear("helm", "h_3", "tame"); assert.equal(X.pfxNum(p, "pet", 300), 150, "길들이는: twice as fast"); assert.equal(X.pfxNum(p, "rest", 0.06), rest0);
  W.wear("helm", "h_3", "hearth"); assert.ok(Math.abs(X.pfxNum(p, "rest", 0.06) - 0.09) < 1e-9 && Math.abs(X.pfxNum(p, "rest", 0.12) - 0.18) < 1e-9, "화덕의: +50 %"); assert.equal(X.pfxNum(p, "pet", 300), 300);
}
{
  // 보물눈의: a chest's find only
  const W = world("tre"), p = W.p, chest = W.mob(CHEST, 230, 200), plain = W.mob("twinhare", 230, 200);
  const mf = (m, kind = "drop") => X.pfxLoot(W.S, W.rt, p, m, kind).mf;
  W.wear("helm", "h_3", undefined); assert.equal(mf(chest), 0);
  const quality = (lg) => { W.wear("helm", "h_3", lg); let sum = 0; for (let i = 0; i < 300; i++) { W.rt.drops.length = 0; W.S.seed = 900 + i; X.lootFor(W.S, W.rt, chest, p); sum += W.rt.drops.reduce((s, d) => s + d.q, 0); } return sum; };
  const without = quality(undefined), withIt = quality("treasure");
  assert.equal(mf(chest), 50); assert.equal(mf(plain), 0, "a plain monster: nothing"); assert.equal(mf(chest, "xp"), 0); assert.ok(withIt > without, `a chest drops better with it: ${without} → ${withIt}`);
}

// ── 3. DOT2: 출혈의 / 담즙의
{
  const W = world("bleed"), S = W.S, p = W.p, rt = W.rt;
  W.wear("weapon", "w_warrior_3", "bleed");
  const st = X.stats(p), per = Math.max(1, Math.round(st.atk * 0.15)), list = () => (p.pc && p.pc.v.bleed) || [], tick = () => { p.regenAt = W.now; W.run(1000); };
  const mob = W.mob("twinhare", 230, 200);
  // a crit opens it, nothing else does; a px blow starts none
  let crits = 0, plains = 0;
  for (let i = 0; i < 600 && (crits < 3 || plains < 3); i++) {
    if (p.pc) p.pc.v.bleed = [];
    S.now = W.now; S.seed = 500 + i;
    const r = X.hurtMob(S, rt, mob, p, 1, false);
    assert.equal(list().length, r === true ? 1 : 0, "a bleed on a crit, none otherwise"); if (r === true) crits++; else plains++;
  }
  assert.ok(crits >= 3 && plains >= 3, `both kinds of blow were seen (${crits}/${plains})`);
  p.pc.v.bleed = []; X.hurtMob(S, rt, mob, p, 1, true, X.PX); assert.equal(list().length, 0, "a px blow starts none");
  // the entry: 4 hits of attack × 15 % a second, once per monster (a second crit neither stacks nor restarts it)
  const m1 = W.mob("twinhare", 230, 210); X.hurtMob(S, rt, m1, p, 1, true);
  assert.equal(list().length, 1); assert.deepEqual([list()[0].m === m1, list()[0].left, list()[0].dmg], [true, 4, per]);
  assert.ok(X.elementActive(S, m1, "bleed"), "legacy bleed appears on the elemental status display");
  const resolved = Math.max(1, Math.round(per * X.elementResist(S, m1, "bleed", st.element?.pen?.bleed || 0)));
  const hp0 = m1.hp; tick(); assert.equal(hp0 - m1.hp, resolved, "one resisted hit a second"); assert.equal(list()[0].left, 3);
  S.now = W.now; X.hurtMob(S, rt, m1, p, 1, true); assert.equal(list().length, 1, "no second bleed on the same monster"); assert.equal(list()[0].left, 3, "and the first does not restart");
  const hp1 = m1.hp; W.run(3000); assert.equal(hp1 - m1.hp, 3 * resolved, "…until it has run its four hits"); assert.equal(list().length, 0);
  // the dagger's dot (mob.dot) is left alone
  const m2 = W.mob("twinhare", 230, 220), dot = { until: W.now + 9e6, next: W.now + 9e6, dmg: 5, pid: p.pid }; m2.dot = dot;
  S.now = W.now; X.hurtMob(S, rt, m2, p, 1, true); assert.equal(m2.dot, dot, "mob.dot untouched"); assert.equal(list().length, 1);
  // a killing crit leaves nothing to bleed; the bleed itself can kill (xp is p's), and the entry goes
  p.pc.v.bleed = []; const fresh = W.mob("twinhare", 230, 230, { hp: 1 }); X.hurtMob(S, rt, fresh, p, 50, true); assert.equal(list().length, 0, "a killing crit does not bleed the corpse");
  const dying = W.mob("twinhare", 230, 240); X.hurtMob(S, rt, dying, p, 1, true); dying.hp = resolved; const xp0 = p.ch.xp; tick();
  assert.ok(dying.dead && list().length === 0 && p.ch.xp > xp0, "the bleed kills, and its kill counts for p");
  // at most DOT_MAX victims; a monster that died leaves the list; a fall clears it
  p.pc.v.bleed = []; for (let i = 0; i < 12; i++) X.hurtMob(S, rt, W.mob("twinhare", 230, 250 + i), p, 1, true); assert.equal(list().length, 8);
  const e = list()[0]; e.m.dead = true; e.m.respAt = W.now + 1e12; tick(); assert.ok(!list().includes(e), "a dead monster leaves the list");
  const left = list()[0].m;
  X.pfxReset(p); assert.equal(list().length, 0, "a fall or a map change clears it");
  assert.ok(!X.elementActive(S, left, "bleed"), "a removed prefix record leaves no ghost icon");
  // a plain weapon: none (the same blows)
  W.wear("weapon", "w_warrior_3", undefined); X.hurtMob(S, rt, W.mob("twinhare", 230, 270), p, 1, true); assert.equal(list().length, 0, "not worn");
}
{
  const W = world("bile"), S = W.S, p = W.p;
  W.wear("armor", "a_3", "bile");
  const st = X.stats(p), per = Math.max(1, Math.round(st.atk * 0.1)), list = () => (p.pc && p.pc.v.bile) || [];
  const striker = (y) => W.mob("twinhare", 230, y);
  X.PFX.bile.p = 1e3;   // (always: the rule first, the rate below)
  const a = striker(200);
  hurtBy(W, p, 0.1, a); assert.deepEqual([list().length, list()[0].m === a, list()[0].left, list()[0].dmg], [1, true, 5, per]);
  hurtBy(W, p, 0.1, a); assert.equal(list().length, 1, "no stacking on the same monster");
  const b = striker(210); hurtBy(W, p, 0.1, b); assert.equal(list().length, 1, "ICD: one a second");
  W.skip(1100); hurtBy(W, p, 0.1, b); assert.equal(list().length, 2, "…then the next");
  W.skip(1100); hurtBy(W, p, 0.1, null); assert.equal(list().length, 2, "a marked area has no striker to poison");
  X.PFX.bile.p = 0.2;
  let n = 0; const N = 900;
  for (let i = 0; i < N; i++) { W.skip(1100); p.pc.v.bile = []; hurtBy(W, p, 0.05, striker(220), (i * 2654435761) | 0); if (list().length) n++; }
  const want = 0.2 * Math.min(st.proc, 1.5), sd = Math.sqrt((want * (1 - want)) / N);
  assert.ok(Math.abs(n / N - want) < 5 * sd + 0.01, `20 % × LUK: ${n / N} vs ${want}`);
  // the poison: five hits that no armour turns
  p.pc.v.bile = []; X.PFX.bile.p = 1e3; const c = striker(230); W.skip(1100); hurtBy(W, p, 0.1, c); X.PFX.bile.p = 0.2; assert.equal(list().length, 1);
  assert.ok(X.elementActive(S, c, "poison") && X.elementOutgoing(S, c) < 1, "legacy poison also weakens the target");
  const resolved = Math.max(1, Math.round(per * X.elementResist(S, c, "poison", st.element?.pen?.poison || 0)));
  const hp0 = c.hp; p.regenAt = W.now; W.run(5000); assert.equal(hp0 - c.hp, 5 * resolved, "five resisted poison hits"); assert.equal(list().length, 0);
  assert.ok(!X.elementActive(S, c, "poison"));
  W.wear("armor", "a_3", undefined); X.PFX.bile.p = 1e3; hurtBy(W, p, 0.1, striker(240)); X.PFX.bile.p = 0.2; assert.equal(list().length, 0, "not worn");
}

// ── 4. ABS: 갑각의 / 방벽의 (offered through miti, spent as it takes, at most 20 % of max HP in one blow)
{
  const W = world("carap"), S = W.S, p = W.p, rt = W.rt;
  W.wear("armor", "a_3", "carap");
  const mhp = X.stats(p).mhp, c3 = Math.round(mhp * 0.03), v = () => (p.pc && p.pc.v.carap) || 0;
  const plain = hurtBy(W, p, 0.5), small = hurtBy(W, p, 0.05);
  assert.ok(plain > c3 * 3 && small < c3 * 3 && small > 0);
  kill(W, p, "twinhare"); assert.equal(v(), c3, "a kill: 3 % of max HP");
  assert.equal(plain - hurtBy(W, p, 0.5), c3, "the blow is lighter by the shield"); assert.equal(v(), 0, "and the shield is spent");
  assert.equal(hurtBy(W, p, 0.5), plain);
  for (let i = 0; i < 3; i++) kill(W, p, "twinhare"); assert.equal(v(), c3 * 3, "kills add up");
  assert.equal(hurtBy(W, p, 0.05), 0, "a small blow is stopped outright"); assert.equal(v(), c3 * 3 - small, "…and only that much of the shield goes");
  for (let i = 0; i < 10; i++) kill(W, p, "twinhare"); assert.equal(v(), Math.round(mhp * 0.15), "at most 15 % of max HP");
  p.pc.v.carap = 0; W.S.now = W.now; X.hurtMob(S, rt, W.mob("twinhare", 230, 200, { hp: 1, stun: 0 }), p, 80, true, X.PX); assert.equal(v(), c3, "a px kill counts too");
  W.skip(10001); assert.equal(hurtBy(W, p, 0.5), plain, "10 s after the last kill it is gone"); assert.equal(v(), 0);
  kill(W, p, "twinhare"); X.pfxReset(p); assert.equal(hurtBy(W, p, 0.5), plain, "a fall or a map change takes it");
  W.wear("armor", "a_3", undefined); kill(W, p, "twinhare"); assert.equal(v(), 0, "not worn: no shield");
}
{
  const W = world("bast"), p = W.p;
  W.wear("helm", "h_3", "bastion");
  const mhp = X.stats(p).mhp, sh = Math.round(mhp * 0.12), v = () => (p.pc && p.pc.v.bastion) || 0, plain = hurtWithoutMitigation(W, p, 0.5);
  p.pc = null; p.hitAt = 0;
  assert.equal(plain - hurtBy(W, p, 0.5), sh, "the first blow after a calm spell raises a 12 % shield and is lighter by it"); assert.equal(v(), 0);
  W.skip(2000); assert.equal(hurtBy(W, p, 0.5), plain, "a blow within 5 s of the last raises none");
  W.skip(6000); p.hitAt = 0; assert.equal(hurtBy(W, p, 0.5), plain, "calm again, but the 25 s interval has not run out");
  W.skip(25000); p.hitAt = 0; W.rt.ev.length = 0;
  assert.equal(hurtBy(W, p, 0.04), 0, "after the interval a small blow is stopped outright"); assert.ok(W.rt.ev.some((e) => e[0] === "h" && e[1] === p.eid && e[2] === 0 && e[3] === 3), "(the 막음 cue)");
  assert.ok(v() > 0 && v() < sh, "the rest of the shield stays");
  W.skip(8001); assert.equal(hurtBy(W, p, 0.5), plain, "unused, it ends after 8 s");
  // With both shields, the dispatcher still limits the total absorbed by one blow.
  W.skip(26000); p.hitAt = 0; W.wear("armor", "a_3", "carap"); for (let i = 0; i < 6; i++) kill(W, p, "twinhare");
  const mhpA = X.stats(p).mhp; assert.equal(p.pc.v.carap, Math.round(mhpA * 0.15)); assert.equal(v(), 0);
  const shielded = hurtBy(W, p, 0.6);   // (bastion raises its own on this blow, the shield 갑각의 holds is already there)
  const unshielded = hurtWithoutMitigation(W, p, 0.6);
  W.wear("helm", "h_3", undefined); W.wear("armor", "a_3", undefined); assert.equal(X.stats(p).mhp, mhpA, "(the same pieces, no powers)");
  assert.equal(unshielded - shielded, Math.floor(mhpA * 0.14), "absorb ≤ 14 % of max HP");
}

// ── 5. AURA: 후광의 / 무리의
{
  const W = world("halo", 3), S = W.S, [p, q, r] = W.ps;
  for (const o of W.ps) W.wear("helm", "h_3", undefined, 100, o);
  const plainP = hurtBy(W, p, 0.5), plainQ = hurtBy(W, q, 0.5), plainR = hurtBy(W, r, 0.5);
  S.parties[p.party].m = [p.pid, q.pid]; r.party = 0;   // r stands near but is no party member
  W.wear("helm", "h_3", "halo", 100, p); p.regenAt = W.now; q.regenAt = W.now; W.run(1000);
  assert.equal(hurtBy(W, q, 0.5), Math.round(plainQ * 0.9), "a party mate in range takes 10 % less"); assert.equal(hurtBy(W, p, 0.5), Math.round(plainP * 0.9), "so does the wearer");
  assert.equal(hurtBy(W, r, 0.5), plainR, "a stranger in range does not");
  W.wear("helm", "h_3", "halo", 100, q); W.run(1000); assert.equal(hurtBy(W, q, 0.5), Math.round(plainQ * 0.9), "two halos: still 10 % (no stacking)");
  W.wear("helm", "h_3", undefined, 100, q); q.x = 800; W.run(2200); assert.equal(hurtBy(W, q, 0.5), plainQ, "out of range, the aura runs out");
  q.x = 240; W.run(1000); assert.equal(hurtBy(W, q, 0.5), Math.round(plainQ * 0.9), "back in range");
  // with another mitigation: the factors multiply and floor at ×0.6 (a ×0.1 stub must not take it lower)
  const st = X.stats(q), at = (f) => { const orig = st.pfx.miti; st.pfx.miti = [(S2, rt, p2, st2, mob, dmg, raw, rr) => { rr.f *= f; }]; const out = X.pfxMiti(S, W.rt, q, st, null, 1000, 1000); st.pfx.miti = orig; return out; };
  assert.equal(at(0.1), 680, "all prefix factors floor at ×0.68, the aura's included"); assert.equal(at(1), 900, "the aura alone: ×0.9");
  W.skip(2100); assert.equal(hurtBy(W, q, 0.5), plainQ, "the aura ends 2 s after the wearer's last tick");
  q.dead = true; W.run(1100); assert.ok(!q.pc.aura || S.now >= q.pc.aura.until, "a fallen mate gets none"); q.dead = false;
  W.wear("helm", "h_3", undefined, 100, p); W.run(2100); assert.equal(hurtBy(W, p, 0.5), plainP, "not worn");
}
{
  const W = world("pack", 4), [p, a, b, c] = W.ps;
  W.wear("gloves", "g_3", undefined, 100, p); const atk0 = X.stats(p).atk;
  W.wear("gloves", "g_3", "pack", 100, p);
  assert.equal(X.stats(p).atk, atk0, "no count yet (it is taken once a second)");
  const atkAfter = () => { p.regenAt = W.now; W.run(1000); return X.stats(p).atk; };
  assert.equal(atkAfter(), Math.round(atk0 * 1.12), "three mates in range: +12 %");
  c.x = 200 + 500; assert.equal(atkAfter(), Math.round(atk0 * 1.08), "one out of range"); c.x = 320;
  W.go(b, "forest"); assert.equal(atkAfter(), Math.round(atk0 * 1.08), "one elsewhere (two left)"); W.go(b, "meadow");
  a.dead = true; assert.equal(atkAfter(), Math.round(atk0 * 1.08), "one fallen"); a.dead = false;
  X.PFX.pack.k = 0.1; assert.equal(atkAfter(), Math.round(atk0 * 1.12), "capped at +12 %"); X.PFX.pack.k = 0.04;
  const party = p.party; p.party = 0; assert.equal(atkAfter(), atk0, "alone: nothing"); p.party = party; assert.equal(atkAfter(), Math.round(atk0 * 1.12));
  // it is attack: a real blow lands harder, and not without the piece
  const mob = W.mob("twinhare", 230, 200), dm = () => { const h = mob.hp; W.S.now = W.now; W.S.seed = 31; X.hurtMob(W.S, W.rt, mob, p, 30, true); return h - mob.hp; };
  const strong = dm(); W.wear("gloves", "g_3", undefined, 100, p); assert.equal(X.stats(p).atk, atk0, "not worn"); assert.ok(strong > dm(), "a real blow hits harder with it");
}

// ── 6. ZN: 지옥불의 / 눈보라의
const zoneOf = (W, key) => W.rt.zones.filter((z) => z.pfx === key && z.pid === W.p.pid);
{
  const W = world("hell"), S = W.S, p = W.p, rt = W.rt, p0 = X.PFX.hellfire.p;
  W.wear("weapon", "w_warrior_3", "hellfire");
  X.PFX.hellfire.p = 1e3;   // (always: the rule first, the rate below)
  const foe = W.mob("twinhare", 245, 210), far = W.mob("twinhare", 330, 210);
  kill(W, p, "twinhare", { x: 240, y: 210 });
  let zs = zoneOf(W, "hellfire"); assert.equal(zs.length, 1);
  assert.deepEqual([zs[0].x, zs[0].y, zs[0].r, zs[0].left, zs[0].every, zs[0].mult, zs[0].px, zs[0].kind], [240, 210, 30, 6, 500, 0.25, 1, 2], "where it fell: 3 s of 0.5 s hits");
  let ticks = 0, farTicks = 0, last = foe.hp, lastFar = far.hp;
  for (let t = 0; t < 36; t++) { W.step(); if (foe.hp < last) ticks++; last = foe.hp; if (far.hp < lastFar) farTicks++; lastFar = far.hp; }
  assert.equal(ticks, 6, "six hits in 3 s"); assert.equal(farTicks, 0, "out of its radius nothing burns"); assert.equal(zoneOf(W, "hellfire").length, 0, "the fire dies out");
  // one at a time (a new fire replaces the old); a power's own kill leaves none
  kill(W, p, "twinhare"); const first = zoneOf(W, "hellfire")[0]; kill(W, p, "twinhare", { x: 300, y: 300 });
  zs = zoneOf(W, "hellfire"); assert.equal(zs.length, 1, "at most one at a time"); assert.ok(zs[0] !== first && zs[0].x === 300);
  rt.zones.length = 0; S.now = W.now; X.hurtMob(S, rt, W.mob("twinhare", 260, 200, { hp: 1, stun: 0 }), p, 80, true, X.PX); assert.equal(zoneOf(W, "hellfire").length, 0, "a px kill leaves no fire");
  // the rate: 20 % × LUK
  X.PFX.hellfire.p = p0; let n = 0; const N = 500; S.seed = 5;
  for (let i = 0; i < N; i++) { rt.zones.length = 0; kill(W, p, "twinhare"); if (zoneOf(W, "hellfire").length) n++; }
  const want = 0.2 * Math.min(X.stats(p).proc, 1.5), sd = Math.sqrt((want * (1 - want)) / N); assert.ok(Math.abs(n / N - want) < 5 * sd + 0.01, `20 % × LUK: ${n / N} vs ${want}`);
  // a bleed's kill is a px kill too: no fire from it
  W.wear("ring1", "r_3", "bleed"); X.PFX.hellfire.p = 1e3; rt.zones.length = 0;
  const bl = W.mob("twinhare", 270, 200, { stun: 0 }); S.now = W.now; X.hurtMob(S, rt, bl, p, 1, true); bl.hp = 1; p.regenAt = W.now; W.run(1000);
  assert.ok(bl.dead && zoneOf(W, "hellfire").length === 0, "a bleed's kill leaves no fire");
  W.wear("weapon", "w_warrior_3", undefined); rt.zones.length = 0; kill(W, p, "twinhare"); assert.equal(zoneOf(W, "hellfire").length, 0, "not worn: none"); X.PFX.hellfire.p = p0;
}
{
  const W = world("blz"), S = W.S, p = W.p, rt = W.rt;
  W.wear("weapon", "w_warrior_3", "blizzard");
  const id = W.self().sk.find((r) => r[3] && r[1] > 0 && r[2] === 0)[0], cast = () => { p.cds = {}; p.mp = 1e6; p.atkAt = 0; return W.act({ t: "sk", id, a: X.aimIdx(1, 0) }); };
  const px = p.x, py = p.y;
  assert.ok(cast().ok, "a real cast"); let zs = zoneOf(W, "blizzard"); assert.equal(zs.length, 1);
  const z = zs[0]; assert.deepEqual([z.x, z.y, z.r, z.left, z.every, z.mult, z.px, z.kind, z.slow], [px, py, 40, 5, 500, 0.2, 1, 3, undefined], "where it was cast; no zone `slow` flag (that one slows bosses)");
  W.run(1000); assert.ok(cast().ok); assert.equal(zoneOf(W, "blizzard").length, 1, "one at a time");
  // the slow: what stands in it; not a boss, a guardian or a rooted thing
  rt.zones.length = 0; p.x = 200; p.y = 200;
  const near = W.mob("twinhare", 215, 200), out = W.mob("twinhare", 290, 200), el2 = W.mob("twinhare", 210, 205, { el: 2 }), boss = W.mob(BOSS, 205, 205), rooted = W.mob(CHEST, 205, 195), late = W.mob("twinhare", 290, 205);
  for (const m of [near, out, el2, boss, rooted, late]) m.slow = 0;
  S.now = W.now; X.pfxSkill(S, rt, p, X.stats(p), X.SKILL[id], id, 0);
  assert.ok(near.slow >= W.now + 1500, "slowed"); assert.equal(out.slow, 0, "out of its radius"); assert.equal(el2.slow, 0, "a guardian"); assert.equal(boss.slow, 0, "a boss"); assert.equal(rooted.slow, 0, "a rooted thing");
  for (const m of [el2, boss, rooted]) rt.mobs.splice(rt.mobs.indexOf(m), 1);
  // five hits of 0.5 s; a monster that walks in later is caught by the wearer's tick; the storm ends
  p.regenAt = W.now; let hits = 0, last = near.hp;
  for (let t = 0; t < 30; t++) { if (t === 5) late.x = 205; W.step(); if (near.hp < last) hits++; last = near.hp; }
  assert.equal(hits, 5, "five hits in 2.5 s"); assert.equal(zoneOf(W, "blizzard").length, 0, "the storm ends"); assert.ok(late.slow > 0, "a monster that walked in was slowed by the tick");
  W.wear("weapon", "w_warrior_3", undefined); rt.zones.length = 0; assert.ok(cast().ok); assert.equal(zoneOf(W, "blizzard").length, 0, "not worn: none");
}

// ── 7. a saved sheet with these powers, and the cost: four heroes × eight of them, sixty monsters, 600 ticks, twice
{
  const KEYS = Object.keys(ROWS), raw = (id, lg) => ({ id, q: 3, enh: 0, af: [], sk: 0, ru: [], il: 90, lg });
  const old = L.newChar("옛사람", []);
  old.eq.helm = raw("h_3", "trace"); old.eq.armor = raw("a_3", "carap"); old.eq.gloves = raw("g_3", "pack"); old.eq.ring1 = raw("r_3", "bleed");
  const ch = X.migrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(["helm", "armor", "gloves", "ring1"].map((s) => ch.eq[s].lg), ["trace", "carap", "pack", "bleed"], "a sheet with these powers loads as it is");
  const W = world("save"); for (const k of KEYS) { W.wear("helm", "h_3", k); X.deriveStats(W.p); }
  assert.ok(!JSON.stringify(L.exportChar(W.S, W.p.pid)).includes('"pc"'), "p.pc (shields, dots, auras) is never saved");

  const SL = ["weapon", "helm", "armor", "gloves", "boots", "ring1", "ring2", "amulet"], ID = { weapon: "w_warrior_3", helm: "h_3", armor: "a_3", gloves: "g_3", boots: "b_3", ring1: "r_3", ring2: "r_3", amulet: "n_4" };
  const SETS = [["blizzard", "trace", "carap", "pack", "bile", "bleed", "hellfire", "halo"], ["hellfire", "sage", "bile", "pack", "bile", "blizzard", "bleed", "bastion"],
    ["bleed", "clever", "bastion", "pack", "bile", "hellfire", "blizzard", "carap"], ["blizzard", "bastion", "carap", "pack", "bile", "bleed", "hellfire", "halo"]];
  const run = () => {
    const S = L.setup(); let now = 3_000_000; S.now = now; S.last = now;
    const ps = [];
    for (let i = 0; i < 4; i++) {
      const pid = "pu" + i; L.addPlayer(S, pid, L.hero("용사" + i, { wk: ["sword", "spear", "staff", "bow"][i], lvl: 157, migrate: true })); const p = S.players[pid];
      L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
      SL.forEach((sl, j) => { const lg = SETS[i][j]; if (sl === "weapon") p.ch.eq.weapon.lg = lg; else p.ch.eq[sl] = { ...X.plain(ID[sl]), q: 3, il: 80 + j, lg }; });
      p.stc = null; p.x = 300 + i * 30; p.y = 300; ps.push(p);
    }
    const party = { id: S.nextId++, m: ps.map((p) => p.pid) }; S.parties[party.id] = party; ps.forEach((p) => { p.party = party.id; });
    for (const p of ps) { p.dirty = true; const row = L.viewFor(S, p.pid).self.sk.find((r) => r[3] && r[1] >= 0); p.skId = row ? row[0] : null; }
    const rt = S.maps.meadow;
    for (const o of rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
    for (let i = 0; i < 60; i++) rt.mobs.push(Object.assign(X.newMob(S, "twinhare", [0, 0, 0, 0]), { x: 250 + (i % 10) * 20, y: 260 + Math.floor(i / 10) * 20, hp: 4000 }));
    let tickMs = 0, h = 0, maxZones = 0;
    for (let t = 0; t < 600; t++) {
      for (const p of ps) {
        if (p.dead) { S.now = now; L.applyAction(S, p.pid, { t: "respawn" }); continue; }
        p.hp = Math.max(p.hp, 1); S.now = now;
        const a = t % 7 === 0 && p.skId ? { t: "sk", id: p.skId, a: t % 8 } : { t: "atk", a: t % 8 };
        if (L.validateAction(S, p.pid, a).ok) L.applyAction(S, p.pid, a);
      }
      now += 100; const t0 = performance.now(); L.tick(S, now); tickMs += performance.now() - t0;
      maxZones = Math.max(maxZones, rt.zones.filter((z) => z.pfx).length);
      for (const p of ps) { const v = JSON.stringify(L.viewFor(S, p.pid), (k, x) => (k === "lgOff" ? undefined : x)); for (let i = 0; i < v.length; i += 7) h = (h * 31 + v.charCodeAt(i)) | 0; }
      L.endTick(S);
    }
    return { h, ms: tickMs / 600, dead: rt.mobs.filter((m) => m.dead).length, maxZones };
  };
  const a = run(), b = run();
  assert.equal(a.h, b.h, "the same world twice: the same snapshots"); assert.ok(a.dead > 0, "the fight happened"); assert.ok(a.maxZones <= 8, `our zones stay at one per player and power: ${a.maxZones}`);
  assert.ok(a.ms < 6 && b.ms < 6, `a tick stays cheap with these powers worn: ${a.ms.toFixed(2)} ms`);
}
console.log("prefix-util: ok");
