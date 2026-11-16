// Headless test of the defense prefix powers of phase 1 (docs/design/prefix-effects.md §3.2, src/logic/53-prefix-guard.js): the table (slots, rating,
// numbers as the design has them), each power on its own (fires when it should, not otherwise, its numbers are PFX's, its cooldown holds), the caps they run
// into, the roll pools, and a soak of real monsters hitting a player twice for determinism.   node tests/prefix-guard.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { LEGEND, PFX, PFX_FN, PFX_CAP, ITEMS, MOBS, plain, rollGear, stats, deriveStats, newMob, hurtMob, hurtPlayer, wound, afflict, mobHit, staggerPlayer, pfxPc, pfxMiti, pfxHurt, pfxTick, pfxDash, pfxEvade, pfxStatus, pfxHeal, rnd, isNight, dashLeft };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

// ── 1. the table: what the design says, key by key  [slots, rating, fam, numbers (PFX without `on`), live?]
const DOC = {
  bark: ["AH", "M", "mit", { p: 0.15, k: 0.4 }, 1], fur: ["AN", "S", "mit", { hp: 0.9, k: 0.85 }, 1], last: ["ABH", "M", "mit", { hp: 0.3, k: 0.75 }, 1],
  gran: ["AB", "M", "mit", { k: 0.88 }, 1], stone: ["A", "M", "mit", { hp: 0.25, k: 0.5 }, 1], ward: ["ABNH", "M", "mit", { ms: 12000 }, 1],
  smoke: ["BN", "M", "mit", { p: 0.08, ms: 1200, icd: 10000 }, 1], foresee: ["ABH", "M", "mit", { k: 0.7 }, 1], manawall: ["AN", "M", "mit", { k: 0.25 }, 1],
  root: ["BH", "S", "mit", { ms: 1500, k: 0.85 }, 1], heavy: ["ABH", "S", "mit", { k: 0.5 }, 1], purge: ["ABNH", "S", "mit", { k: 0.5 }, 1],
  cure: ["BNH", "S", "mit", { ms: 3000, imm: 8000, icd: 30000 }, 1], rime: ["AB", "S", "mit", { p: 0.3, ms: 2000, icd: 1000 }, 1],
  counter: ["AB", "M", "mit", { p: 0.15, k: 1.5, icd: 2000 }, 1], fate: ["AN", "L", "mit", { ms: 3000, icd: 360000 }, 1],
  panic: ["AB", "M", "mob", { hp: 0.35, ms: 5000, spd: 1.3, k: 0.85, icd: 60000 }, 0], wisp: ["B", "M", "mob", { k: 0.75 }, 1],
  dust: ["B", "S", "mob", { r: 40, ms: 600, icd: 6000, n: 4 }, 1], after: ["B", "S", "mob", { ms: 1500, spd: 1.25 }, 0], nimble: ["BN", "S", "sus", { k: 0.02, icd: 1000 }, 1],
  reflex: ["B", "S", "mob", { ms: 2000, k: 1.15 }, 1], relax: ["B", "S", "mob", { ms: 5000, spd: 1.15 }, 0], chase: ["B", "S", "mob", { ms: 3000, spd: 1.2 }, 0],
  slick: ["B", "S", "mob", { ms: 1000, spd: 1.3 }, 0], share: ["NH", "S", "sus", { r: 160, k: 0.03 }, 1], spring: ["AN", "M", "sus", { hp: 0.5, k: 0.012 }, 1],
  pot: ["NH", "M", "sus", { k: 1.35 }, 1], elixir: ["N", "S", "sus", { ms: 6000, k: 0.01 }, 1], med: ["NH", "S", "sus", { ms: 2000, k: 0.02 }, 1],
  moss: ["AN", "S", "sus", { k: 0.015 }, 1], emerg: ["ABNH", "M", "sus", { hp: 0.3, k: 0.2, icd: 90000 }, 1], owl: ["NH", "S", "mit", { k: 0.9 }, 1],
};
const KEYS = Object.keys(DOC);
assert.equal(KEYS.length, 33, "33 defense powers of phase 1 beyond thorn and feast");
for (const k of KEYS) {
  const [slots, rating, fam, nums, live] = DOC[k], row = X.LEGEND[k];
  assert.ok(row, `${k}: a LEGEND row`); assert.equal(row[2], slots, `${k}: slots`); assert.equal(row[3], "D", `${k}: defense`); assert.equal(row[4], rating, `${k}: rating`); assert.equal(row[5], fam, `${k}: fam`);
  const { on, ...have } = X.PFX[k]; assert.deepEqual(have, nums, `${k}: the design's numbers`); assert.equal(on || 0, live, `${k}: on`);
  assert.ok(X.PFX_FN[k] && typeof X.PFX_FN[k] === "object", `${k}: code`);
}
assert.ok(!X.PFX.thorn.off && X.PFX.thorn.on && X.PFX.feast.on, "the two old ones are untouched");
// a few tooltips as written (the number comes from PFX)
assert.equal(X.LEGEND.bark[1], "피격 시 15% 확률로 그 피해를 60% 줄인다");
assert.equal(X.LEGEND.fate[1], "치명상을 입으면 HP 1로 버티고 3초간 무적이 된다 (6분 간격)");
assert.equal(X.LEGEND.spring[1], "HP 50% 이하면 매초 최대 HP의 1.2% 회복"); assert.equal(X.LEGEND.moss[1], "5초 넘게 피격이 없으면 매초 HP 1.5% 추가 회복");
assert.equal(X.LEGEND.heavy[1], "피격 경직 -50%, 밀려나는 거리 -50%"); assert.equal(X.LEGEND.stone[1], "한 번에 최대 HP의 25%를 넘는 피해는 초과분이 50% 줄어든다");

// ── worlds
function world(name, wk = "sword") {
  const S = L.setup();
  let now = 2_000_000;
  S.now = now; S.last = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, L.hero(name, { wk, lvl: 157, migrate: true }));
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
    mob(k, x, y, o = {}) { const m = Object.assign(X.newMob(S, k, [0, 0, 0, 0]), { x, y, hp: 1e6, respAt: 1e15 }, o); W.rt.mobs.push(m); return m; },
    wear(slot, id, lg, il = 100) { W.p.ch.eq[slot] = { ...X.plain(id), q: 3, il, lg }; W.p.stc = null; },
  };
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  W.step();
  p.x = 200; p.y = 200; p.mvAt = now; p.hp = 1e6; p.mp = 1e6; p.stag = 0; p.dead = false;
  for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  W.p.ch.eq = { weapon: W.p.ch.eq.weapon };
  return W;
}
const SLOT_OF = { A: ["armor", "a_3"], B: ["boots", "b_3"], N: ["amulet", "n_4"], H: ["helm", "h_3"] };
const W = world("guard"), S = W.S, p = W.p, rt = W.rt;
const mob = W.mob("twinhare", 230, 200);
const BOSS = Object.keys(X.MOBS).find((k) => X.MOBS[k].boss && !X.MOBS[k].still), SHOOTER = Object.keys(X.MOBS).find((k) => X.MOBS[k].shot && !X.MOBS[k].boss);
assert.ok(BOSS && SHOOTER, "a boss and a shooter exist");
assert.ok(!X.MOBS.twinhare.shot && !X.MOBS.twinhare.volley, "the test's attacker is a melee one");
/** Clean state with `keys` worn (each on the first free slot of its pool); every timer, buff and status off, "just moved, just hit". */
function fresh(...keys) {
  p.ch.eq = { weapon: p.ch.eq.weapon }; p.pc = null; p.stc = null;
  const used = new Set();
  for (const k of keys) {
    const l = [...X.LEGEND[k][2]].find((c) => !used.has(c)); used.add(l);
    W.wear(SLOT_OF[l][0], SLOT_OF[l][1], k);
  }
  const st = X.stats(p);
  X.deriveStats(p).eva = 0;   // (a monster's blow is never dodged by chance here)
  S.now = W.now; S.seed = 1;
  p.hp = st.mhp; p.mp = st.mmp; p.ghost = 0; p.dead = false; p.burn = null; p.poison = null; p.slowed = 0; p.stag = 0; p.dodge = 0; p.hitHow = ""; p.potAt = 0; p.dashAt = 0;
  p.hitAt = S.now; p.mvAt = S.now; p.x = 200; p.y = 200; p.toast.length = 0; rt.ev.length = 0;
  for (const o of rt.mobs) if (o !== mob) o.dead = true;
  Object.assign(mob, { hp: 1e6, dead: false, slow: 0, stun: 0, el: 0, hw: 0, hu: 0, x: 230, y: 200, k: "twinhare" });
  return X.stats(p);
}
/** The same gear without its powers (an armor piece has defence of its own: a fair baseline keeps the pieces). */
function strip() {
  for (const k of Object.keys(p.ch.eq)) if (p.ch.eq[k]) delete p.ch.eq[k].lg;
  p.stc = null; X.deriveStats(p).eva = 0;
  return X.stats(p);
}
const force = (key, field, v, f) => { const o = X.PFX[key][field]; X.PFX[key][field] = v; try { return f(); } finally { X.PFX[key][field] = o; } };
/** What a blow of `dmg` (after armour) is lowered to by the worn powers' MITI (the dispatcher: factors floor at ×0.6). */
const mit = (dmg = 1000, seed = 1, m = mob) => { S.seed = seed; return X.pfxMiti(S, rt, p, X.stats(p), m, dmg, dmg); };
/** A tiny blow (1 damage whatever the armour) through the real hurtPlayer: the way to leave HP where a test wants it. */
const poke = (hp, how = "blow", m = mob, seed = 1) => { p.hp = hp; p.hitHow = how; S.seed = seed; X.hurtPlayer(S, rt, p, 1, m); p.hitHow = ""; };
const rate = (n, f) => { let c = 0; for (let i = 1; i <= n; i++) if (f(i)) c++; return c / n; };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const T = (n) => (S.now += n);
const NIGHT = 2_880_000 * 100 + 2_640_000, DAY = 2_880_000 * 100 + 1_440_000;   // 22:00 and 12:00 outdoors

// ── 2. each power on its own
const CASES = {
  bark() {
    const st = fresh("bark"), c = X.PFX.bark, d = Math.round(st.mhp * 0.1);
    force("bark", "p", 1e3, () => { assert.equal(mit(d), d - Math.round(d * (1 - c.k)), "forced: the blow is ×0.4"); near(mit(st.mhp), st.mhp * (1 - X.PFX_CAP.abs), 1e-6, "a huge blow: the absorb cap (20 % of max HP)"); });
    force("bark", "p", 0, () => assert.equal(mit(d), d, "never at 0"));
    const r = rate(4000, (i) => mit(d, i) < d), want = c.p * Math.min(st.proc, 1.5);
    near(r, want, 0.025, "the chance is p × LUK's proc (≤ ×1.5)");
  },
  fur() {
    const st = fresh("fur"), c = X.PFX.fur;
    p.hp = st.mhp; assert.equal(mit(), Math.round(1000 * c.k)); p.hp = st.mhp * c.hp; assert.equal(mit(), Math.round(1000 * c.k), "90 % exactly counts");
    p.hp = st.mhp * c.hp - 1; assert.equal(mit(), 1000, "below 90 %: nothing");
  },
  last() {
    const st = fresh("last"), c = X.PFX.last;
    p.hp = st.mhp * c.hp; assert.equal(mit(), Math.round(1000 * c.k)); p.hp = st.mhp * c.hp + 1; assert.equal(mit(), 1000);
  },
  gran() {
    fresh("gran"); const c = X.PFX.gran;
    assert.equal(mit(), 1000, "a plain monster"); mob.el = 1; assert.equal(mit(), Math.round(1000 * c.k), "an elite"); mob.el = 2; assert.equal(mit(), Math.round(1000 * c.k));
    mob.el = 0; const b = W.mob(BOSS, 240, 200); assert.equal(mit(1000, 1, b), Math.round(1000 * c.k), "a boss"); b.dead = true;
    assert.equal(mit(1000, 1, null), 1000, "no monster (a marked area): nothing");
  },
  stone() {
    const st = fresh("stone"), c = X.PFX.stone, cap = st.mhp * c.hp;
    assert.equal(mit(Math.round(cap)), Math.round(cap), "at the line: nothing");
    const big = Math.round(st.mhp * 0.5); near(mit(big), cap + (big - cap) * c.k, 1, "the part beyond 25 % of max HP is halved");
    const huge = Math.round(st.mhp * 4); assert.equal(mit(huge), Math.round(huge * X.PFX_CAP.miti), "never below the ×0.6 floor");
  },
  ward() {
    fresh("ward"); const c = X.PFX.ward;
    assert.equal(mit(), 0, "the first blow is stopped"); assert.equal(mit(), 1000, "the next one is not");
    T(c.ms - 1); assert.equal(mit(), 1000, "not before the wait is over"); T(1); assert.equal(mit(), 0, "ready again after 12 s"); assert.equal(mit(), 1000);
    // it shows as the dodge cue and costs the player nothing
    fresh("ward"); rt.ev.length = 0; const hp = p.hp; X.hurtPlayer(S, rt, p, 500, mob); assert.equal(p.hp, hp); assert.ok(rt.ev.some((e) => e[0] === "h" && e[2] === 0 && e[3] === 3));
  },
  smoke() {
    const st = fresh("smoke"), c = X.PFX.smoke;
    force("smoke", "p", 1e3, () => {
      poke(st.mhp); assert.equal(p.ghost, S.now + c.ms, "untouchable for 1.2 s"); const hp = p.hp; X.hurtPlayer(S, rt, p, 99999, mob); assert.equal(p.hp, hp, "and nothing lands meanwhile");
      T(c.ms + 100); poke(st.mhp); assert.ok(p.ghost <= S.now, "10 s apart: no second one yet"); T(c.icd);
      poke(st.mhp); assert.ok(p.ghost > S.now, "the wait is over");
    });
    fresh("smoke"); force("smoke", "p", 0, () => { poke(st.mhp); assert.ok(p.ghost <= S.now, "never at 0"); });
    // the real chance (the wait is cleared each time so only the roll counts); a blow that kills proves nothing
    fresh("smoke"); const stt = X.stats(p);
    const r = rate(4000, (i) => { p.ghost = 0; X.pfxPc(p).cd = {}; S.seed = i; X.pfxHurt(S, rt, p, stt, mob, 1, 1); return p.ghost > S.now; });
    near(r, c.p * Math.min(stt.proc, 1.5), 0.02, "the chance");
    fresh("smoke"); p.hp = 0; X.pfxPc(p).cd = {}; force("smoke", "p", 1e3, () => { X.pfxHurt(S, rt, p, X.stats(p), mob, 1, 1); assert.ok(p.ghost <= S.now, "not for one who is falling"); });
  },
  foresee() {
    fresh("foresee"); const c = X.PFX.foresee;
    for (const how of ["tele", "mv", "charge"]) { p.hitHow = how; assert.equal(mit(), Math.round(1000 * c.k), how); }
    for (const how of ["blow", "shot", ""]) { p.hitHow = how; assert.equal(mit(), 1000, `"${how}" is no marked area`); }
    // through the real monster blow: mobHit tells hurtPlayer what kind it is, and clears it again
    const dmg = (how) => { p.hp = X.stats(p).mhp; S.seed = 5; p.x = 200; p.y = 200; X.mobHit(S, rt, p, 800, mob, how); assert.equal(p.hitHow, "", "cleared after the blow"); return X.stats(p).mhp - p.hp; };
    const withIt = dmg("tele"), plain = dmg("blow"); strip(); const without = dmg("tele");
    assert.equal(withIt, Math.round(without * c.k), "a marked blow is ×0.7"); assert.equal(plain, without, "a melee blow is not");
  },
  manawall() {
    const st = fresh("manawall"), c = X.PFX.manawall, d = Math.round(st.mmp * 2);   // (a quarter of d is half the MP pool)
    // the blow as hurtPlayer sees it: MITI, then HURT with what was taken
    const hit = (dmg) => { const r = mit(dmg); X.pfxHurt(S, rt, p, X.stats(p), mob, r, dmg); return r; };
    p.mp = st.mmp; assert.equal(hit(d), Math.round(d * (1 - c.k))); near(p.mp, st.mmp - d * c.k, 1e-6, "MP paid the quarter");
    const left = Math.round(d * 0.1); p.mp = left; near(hit(d), d - left, 1, "only the MP there is"); assert.equal(p.mp, 0); assert.equal(hit(d), d, "no MP: nothing");
    fresh("manawall", "ward"); p.mp = st.mmp; assert.equal(hit(d), 0, "a stopped blow costs no MP, whichever piece is first"); assert.equal(p.mp, st.mmp);
    assert.equal(hit(d), Math.round(d * (1 - c.k)), "the ward is spent: the mana wall works"); near(p.mp, st.mmp - d * c.k, 1e-6);
    fresh("manawall"); p.mp = st.mmp; const hp0 = p.hp; X.hurtPlayer(S, rt, p, d * 3, mob); assert.ok(p.mp < st.mmp && hp0 - p.hp > 0, "through the real hurtPlayer");
  },
  root() {
    fresh("root"); const c = X.PFX.root;
    p.mvAt = S.now - c.ms + 1; assert.equal(mit(), 1000); p.mvAt = S.now - c.ms; assert.equal(mit(), Math.round(1000 * c.k), "1.5 s of standing still");
  },
  owl() {
    fresh("owl"); const c = X.PFX.owl;
    S.now = NIGHT; assert.ok(X.isNight(S.now)); assert.equal(mit(), Math.round(1000 * c.k), "at night"); S.now = DAY; assert.ok(!X.isNight(S.now)); assert.equal(mit(), 1000, "by day");
  },
  heavy() {
    fresh("heavy"); const c = X.deriveStats(p), h = X.PFX.heavy.k, sg = () => { p.stag = 0; X.staggerPlayer(S, rt, p, null); return p.stag - S.now; };
    const withIt = sg(); strip(); const b = X.deriveStats(p), plain = sg();
    near(c.poise, 1 - (1 - b.poise) * h, 1e-9, "poise"); near(c.kbr, 1 - (1 - b.kbr) * h, 1e-9, "knock-back resistance");
    fresh("heavy"); assert.equal(X.stats(p).poise, c.poise, "stats(p) carries it"); near(withIt / plain, h, 0.02, "the stagger is half as long");
  },
  purge() {
    const k = X.PFX.purge.k, got = () => { const o = {}; for (const kind of ["burn", "poison", "slow"]) { p.burn = p.poison = null; p.slowed = 0; X.afflict(S, p, kind, 100); o[kind] = kind === "slow" ? [p.slowed - S.now] : [p[kind].until - S.now, p[kind].dmg]; } return o; };
    fresh("purge"); const withIt = got(); strip(); const base = got();
    for (const kind of ["burn", "poison", "slow"]) {
      near(withIt[kind][0] / base[kind][0], k, 0.01, `${kind} is shorter`); if (withIt[kind][1]) near(withIt[kind][1], Math.max(1, base[kind][1] * k), 1, `${kind} bites softer`);
    }
  },
  cure() {
    fresh("cure"); const c = X.PFX.cure, t0 = S.now, tick = (dt) => { S.now = t0 + dt; X.pfxTick(S, rt, p, X.stats(p), S.now, true); };
    X.afflict(S, p, "burn", 100); X.afflict(S, p, "slow", 100); assert.ok(p.burn && p.slowed > S.now, "caught as usual");
    tick(c.ms - 1); assert.ok(p.burn && p.slowed > 0, "not before 3 s"); tick(c.ms); assert.ok(!p.burn && !p.poison && p.slowed === 0, "washed off");
    S.now = t0 + c.ms + 500; X.afflict(S, p, "burn", 100); X.afflict(S, p, "poison", 100); X.afflict(S, p, "slow", 100); assert.ok(!p.burn && !p.poison && !(p.slowed > S.now), "8 s of quiet");
    S.now = t0 + c.ms + c.imm + 1; X.afflict(S, p, "burn", 100); assert.ok(p.burn, "caught again after the quiet"); tick(c.ms + c.imm + 1 + 4000); assert.ok(p.burn, "but the 30 s are not over: no cleanse");
    S.now = t0 + c.icd + 1; p.burn = null; X.afflict(S, p, "poison", 100); assert.ok(p.poison); tick(c.icd + 1 + c.ms); assert.ok(!p.poison, "a new cleanse after 30 s");
  },
  slick() {
    const c = X.PFX.slick, base = fresh("slick").spd;
    X.afflict(S, p, "slow", 100); assert.ok(!(p.slowed > S.now), "no slow at all"); X.afflict(S, p, "burn", 100); assert.ok(p.burn, "the others still catch");
    p.stag = S.now - 500; near(X.stats(p).spd / base, c.spd, 1e-9, "quicker just after the stagger"); p.stag = S.now - c.ms; assert.equal(X.stats(p).spd, base, "the 1 s is over");
    p.stag = S.now + 300; assert.equal(X.stats(p).spd, base, "not while staggered");
  },
  rime() {
    const st = fresh("rime"), c = X.PFX.rime;
    force("rime", "p", 1e3, () => {
      poke(st.mhp); assert.equal(mob.slow, S.now + c.ms, "slowed for 2 s"); mob.slow = 0; poke(st.mhp); assert.equal(mob.slow, 0, "1 s apart: not twice"); T(c.icd);
      poke(st.mhp); assert.ok(mob.slow > S.now, "the wait is over"); mob.slow = 0; T(c.icd);
      for (const how of ["tele", "shot", "charge", "mv", ""]) { poke(st.mhp, how); assert.equal(mob.slow, 0, `"${how}" is not a melee blow`); }
      const s = W.mob(SHOOTER, 240, 200); poke(st.mhp, "blow", s); assert.equal(s.slow, 0, "a shooter"); s.dead = true;
      const b = W.mob(BOSS, 240, 200); poke(st.mhp, "blow", b); assert.equal(b.slow, 0, "a boss"); b.dead = true;
      mob.el = 2; poke(st.mhp); assert.equal(mob.slow, 0, "a 우두머리"); mob.el = 1; poke(st.mhp); assert.ok(mob.slow > S.now, "an elite is slowed"); mob.el = 0; mob.slow = 0;
      poke(st.mhp, "blow", null);
    });
    fresh("rime"); const s2 = X.stats(p);
    near(rate(4000, (i) => { mob.slow = 0; X.pfxPc(p).cd = {}; p.hitHow = "blow"; S.seed = i; X.pfxHurt(S, rt, p, s2, mob, 1, 1); return mob.slow > S.now; }), c.p * Math.min(s2.proc, 1.5), 0.025, "the chance");
    // through the real monster blow
    fresh("rime"); force("rime", "p", 1e3, () => { p.hp = X.stats(p).mhp; X.mobHit(S, rt, p, 50, mob, "blow"); assert.ok(mob.slow > S.now, "mobHit says it is a melee blow"); mob.slow = 0; T(2000); p.x = 200; p.y = 200; X.mobHit(S, rt, p, 50, mob, "tele"); assert.equal(mob.slow, 0); });
  },
  counter() {
    const st = fresh("counter"), c = X.PFX.counter;
    // the same seed, the same two rolls burned, the same blow: what the counter deals is a hurtMob of 1.5 × attack
    const lost = (f) => { const hp = mob.hp; f(); return hp - mob.hp; };
    force("counter", "p", 1e3, () => {
      const got = lost(() => poke(st.mhp, "blow", mob, 9)), want = lost(() => { S.seed = 9; X.rnd(S); X.rnd(S); X.hurtMob(S, rt, mob, p, c.k, false, { px: 1 }); });
      assert.ok(got > 0 && got === want, `a counter of ${c.k * 100} % of attack: ${got} vs ${want}`);
      assert.equal(lost(() => poke(st.mhp, "blow", mob, 9)), 0, "2 s apart: not twice"); T(c.icd - 1); assert.equal(lost(() => poke(st.mhp, "blow", mob, 9)), 0); T(1);
      assert.ok(lost(() => poke(st.mhp, "blow", mob, 9)) > 0, "the wait is over"); T(c.icd); poke(st.mhp, "blow", null);
    });
    fresh("counter"); force("counter", "p", 0, () => assert.equal(lost(() => poke(st.mhp)), 0, "never at 0"));
    fresh("counter"); const s2 = X.stats(p);
    near(rate(4000, (i) => { X.pfxPc(p).cd = {}; mob.hp = 1e6; S.seed = i; X.pfxHurt(S, rt, p, s2, mob, 1, 1); return mob.hp < 1e6; }), c.p * Math.min(s2.proc, 1.5), 0.025, "the chance");
  },
  fate() {
    const st = fresh("fate"), c = X.PFX.fate;
    p.hp = 5; X.hurtPlayer(S, rt, p, 1e7, mob); assert.ok(!p.dead && p.hp === 1, "held at 1 HP"); assert.equal(p.ghost, S.now + c.ms, "untouchable 3 s");
    const stamp = X.pfxPc(p).cd.fate; assert.equal(stamp, S.now + c.icd, "6 minutes");
    T(c.ms + 1); p.hp = 5; X.hurtPlayer(S, rt, p, 1e7, mob); assert.ok(p.dead, "once in 6 minutes: the second one falls"); assert.equal(X.pfxPc(p).cd.fate, stamp, "and a fall does not reset the wait");
    fresh("fate"); p.hp = 5; X.wound(S, rt, p, 1e6); assert.ok(!p.dead && p.hp === 1, "burn and poison too"); const w1 = X.pfxPc(p).cd.fate;
    S.now = w1 - 1; p.ghost = 0; p.hp = 5; X.wound(S, rt, p, 1e6); assert.ok(p.dead, "not before 6 minutes");
    fresh("fate"); p.hp = 5; X.wound(S, rt, p, 1e6); const w2 = X.pfxPc(p).cd.fate; p.ghost = 0; S.now = w2; p.hp = 5; X.wound(S, rt, p, 1e6); assert.ok(!p.dead, "ready again at 6 minutes");
  },
  panic() {
    const st = fresh("panic"), c = X.PFX.panic, spd0 = st.spd;
    poke(st.mhp * 0.5); assert.ok(!(X.pfxPc(p).t.panic > 0), "HP above 35 %: not yet");
    poke(st.mhp * c.hp); assert.equal(X.pfxPc(p).t.panic, S.now + c.ms, "HP down to 35 %");
    near(X.stats(p).spd / spd0, c.spd, 1e-9, "+30 % speed"); assert.equal(mit(), Math.round(1000 * c.k), "-15 % damage");
    T(c.ms); assert.equal(X.stats(p).spd, spd0, "5 s later it is over"); assert.equal(mit(), 1000);
    poke(st.mhp * 0.2); assert.ok(!(X.pfxPc(p).t.panic > S.now), "60 s apart"); T(c.icd - c.ms); poke(st.mhp * 0.2); assert.ok(X.pfxPc(p).t.panic > S.now, "the wait is over");
    fresh("panic"); p.hp = 1; X.hurtPlayer(S, rt, p, 1e6, mob); assert.ok(p.dead && !(X.pfxPc(p).t.panic > 0), "a fall starts nothing");
  },
  emerg() {
    const st = fresh("emerg"), c = X.PFX.emerg;
    poke(st.mhp * 0.5); near(p.hp, st.mhp * 0.5 - 1, 1e-6, "above 30 %: no heal");
    poke(st.mhp * c.hp - 1); near(p.hp, st.mhp * c.hp - 2 + st.mhp * c.k, 1e-6, "an instant 20 % of max HP"); assert.ok(p.toast.length);
    poke(st.mhp * 0.1); near(p.hp, st.mhp * 0.1 - 1, 1e-6, "90 s apart"); T(c.icd - 1); poke(st.mhp * 0.1); near(p.hp, st.mhp * 0.1 - 1, 1e-6); T(1);
    poke(st.mhp * 0.1); near(p.hp, st.mhp * 0.1 - 1 + st.mhp * c.k, 1e-6, "the wait is over");
    fresh("emerg"); p.hp = 1; X.hurtPlayer(S, rt, p, 1e6, mob); assert.ok(p.dead, "it does not stop a fall (불사의 does)");
  },
  wisp() {
    const c = X.PFX.wisp, last = (v) => v.me[v.me.length - 1];
    assert.equal(Math.round(4000 * c.k), 3000, "4 s becomes 3 s");
    fresh(); assert.ok(W.act({ t: "dash", a: 0 }).ok); const plain = last(W.step());
    fresh("wisp"); assert.ok(W.act({ t: "dash", a: 0 }).ok); const left = last(W.step());
    assert.ok(plain > 3000 && plain <= 4000, `without it: 4 s (${plain})`); assert.ok(left > 2000 && left <= 3000, `with it: ≤ 3 s on the wire (${left})`);
  },
  dust() {
    const st = fresh("dust"), c = X.PFX.dust, x = 300, y = 300;
    const mk = (k, dx, o = {}) => W.mob(k, x + dx, y, { hp: 1e6, ...o }), go = () => X.pfxDash(S, rt, p, x - 30, y, x, y);
    go(); assert.ok(!(X.pfxPc(p).cd.dust > 0), "nobody there: the wait does not start");
    const a = mk("twinhare", 10), far = mk("twinhare", c.r + 20), boss = mk(BOSS, 12), guard = mk("twinhare", 14, { el: 2 }), elite = mk("twinhare", 16, { el: 1 });
    go(); assert.ok(a.stun > S.now && elite.stun > S.now, "the near ones are held"); assert.ok(far.stun === 0 && boss.stun === 0 && guard.stun === 0, "far, boss and 우두머리 are not");
    assert.ok(a.stun - S.now <= c.ms, "no longer than 0.6 s (the hold budget may cut it)"); assert.ok(X.pfxPc(p).cd.dust === S.now + c.icd);
    a.stun = 0; go(); assert.equal(a.stun, 0, "6 s apart"); T(c.icd); go(); assert.ok(a.stun > S.now, "the wait is over");
    for (const m of [a, far, boss, guard, elite]) m.dead = true;
    fresh("dust"); const six = Array.from({ length: 6 }, (_, i) => mk("twinhare", i)); go(); assert.equal(six.filter((m) => m.stun > S.now).length, c.n, "at most 4"); for (const m of six) m.dead = true;
  },
  after() {
    const st = fresh("after"), c = X.PFX.after, spd0 = st.spd;
    assert.equal(X.stats(p).spd, spd0, "not before a dash"); X.pfxDash(S, rt, p, 0, 0, 1, 1); near(X.stats(p).spd / spd0, c.spd, 1e-9, "+25 % after a dash");
    T(c.ms - 1); near(X.stats(p).spd / spd0, c.spd, 1e-9); T(1); assert.equal(X.stats(p).spd, spd0, "1.5 s later it is over");
    fresh("after"); assert.ok(W.act({ t: "dash", a: 0 }).ok); assert.ok(X.pfxPc(p).t.after > S.now, "a real dash starts it");
  },
  nimble() {
    const st = fresh("nimble"), c = X.PFX.nimble;
    p.hp = st.mhp * 0.5; X.pfxEvade(S, rt, p, "eva"); near(p.hp, st.mhp * (0.5 + c.k), 1e-6, "2 % of max HP"); X.pfxEvade(S, rt, p, "dash"); near(p.hp, st.mhp * (0.5 + c.k), 1e-6, "1 s apart");
    T(c.icd); X.pfxEvade(S, rt, p, "dash"); near(p.hp, st.mhp * (0.5 + 2 * c.k), 1e-6, "a dash dodge counts too");
    fresh("nimble"); p.hp = st.mhp; X.pfxEvade(S, rt, p, "eva"); assert.equal(p.hp, st.mhp, "never above max HP");
  },
  reflex() {
    const st = fresh("reflex"), c = X.PFX.reflex, atk0 = st.atk;
    assert.equal(X.stats(p).atk, atk0); X.pfxEvade(S, rt, p, "eva"); near(X.stats(p).atk / atk0, c.k, 1e-3, "+15 % attack");
    T(c.ms - 1); near(X.stats(p).atk / atk0, c.k, 1e-3); T(1); assert.equal(X.stats(p).atk, atk0, "2 s later it is over");
    X.pfxEvade(S, rt, p, "dash"); T(1500); X.pfxEvade(S, rt, p, "dash"); T(1500); near(X.stats(p).atk / atk0, c.k, 1e-3, "a new dodge refreshes it (no stacking)");
  },
  relax() {
    const st = fresh("relax"), c = X.PFX.relax, spd0 = st.spd;
    p.hitAt = S.now - c.ms; assert.equal(X.stats(p).spd, spd0, "exactly 5 s is not over 5 s"); p.hitAt = S.now - c.ms - 1; near(X.stats(p).spd / spd0, c.spd, 1e-9, "+15 %");
    poke(st.mhp); assert.equal(X.stats(p).spd, spd0, "a hit ends it");
  },
  chase() {
    const st = fresh("chase"), c = X.PFX.chase, spd0 = st.spd;
    const m = W.mob("twinhare", 250, 210, { hp: 1 }); X.hurtMob(S, rt, m, p, 50, true); assert.ok(m.dead, "killed"); near(X.stats(p).spd / spd0, c.spd, 1e-9, "+20 % after a kill");
    T(c.ms - 1); near(X.stats(p).spd / spd0, c.spd, 1e-9); T(1); assert.equal(X.stats(p).spd, spd0, "3 s later it is over");
    const n = W.mob("twinhare", 250, 210, { hp: 1e6 }); X.hurtMob(S, rt, n, p, 1, true); assert.ok(!(X.pfxPc(p).t.chase > S.now), "a blow that does not kill starts nothing"); n.dead = true;
  },
  share() {
    const st = fresh("share"), c = X.PFX.share;
    const B = "pid-mate"; L.addPlayer(S, B, L.hero("동료", { wk: "sword", lvl: 157, migrate: true })); const o = S.players[B];
    L.runtime(S, o.map).n--; o.map = "meadow"; L.runtime(S, "meadow").n++; o.x = 250; o.y = 200; o.dead = false; o.stc = null;
    S.parties[9] = { id: 9, m: [W.PID, B] }; p.party = 9; o.party = 9;
    const so = X.stats(o), kill = () => { const m = W.mob("twinhare", 260, 210, { hp: 1 }); X.hurtMob(S, rt, m, p, 50, true); assert.ok(m.dead); };
    o.hp = so.mhp * 0.5; p.hp = st.mhp * 0.5; kill(); near(o.hp, so.mhp * (0.5 + c.k), 1e-6, "the mate heals 3 % of their max HP"); assert.equal(p.hp, st.mhp * 0.5, "the wearer does not (포식자의 does)");
    o.x = p.x + c.r; X.pfxPc(o).heal = [0, 0]; o.hp = so.mhp * 0.5; kill(); near(o.hp, so.mhp * (0.5 + c.k), 1e-6, "exactly 160 from the killer still counts");
    o.x = p.x + c.r + 30; o.hp = so.mhp * 0.5; kill(); assert.equal(o.hp, so.mhp * 0.5, "too far: nothing");
    o.x = 250; o.dead = true; o.hp = 0; kill(); assert.equal(o.hp, 0, "not the fallen"); o.dead = false; o.hp = so.mhp; kill(); assert.equal(o.hp, so.mhp, "never above max HP");
    delete S.parties[9]; p.party = 0; o.party = 0; L.removePlayer(S, B);
    fresh("share"); p.hp = st.mhp * 0.5; kill(); assert.equal(p.hp, st.mhp * 0.5, "alone: nothing");
  },
  spring() {
    const st = fresh("spring"), c = X.PFX.spring, tick = () => X.pfxTick(S, rt, p, X.stats(p), S.now, true);
    p.hp = st.mhp * c.hp; tick(); near(p.hp, st.mhp * (c.hp + c.k), 1e-6, "1.2 % of max HP at 50 %"); p.hp = st.mhp * c.hp + 1; T(1000); tick(); near(p.hp, st.mhp * c.hp + 1, 1e-6, "above 50 %: nothing");
    // the real once-a-second loop heals it more than plain regen does
    const run = () => { mob.dead = true; W.p.hp = X.stats(p).mhp * 0.4; p.hitAt = 0; p.regenAt = 0; S.now = W.now; const hp = p.hp; W.step(); return p.hp - hp; };
    fresh("spring"); const withIt = run(); strip(); const plain = run(); near(withIt - plain, st.mhp * c.k, 2, "through the real tick");
  },
  pot() {
    const st = fresh("pot"), c = X.PFX.pot, it = X.ITEMS.hp_s;
    p.ch.inv.push({ id: "hp_s", n: 9 }); p.hp = 1; assert.ok(W.act({ t: "use", id: "hp_s" }).ok);
    assert.equal(p.hp - 1, Math.round((it.heal + st.mhp * it.pct) * c.k), "a potion heals +35 %");
    strip(); p.hp = 1; p.potAt = 0; W.act({ t: "use", id: "hp_s" }); assert.equal(p.hp - 1, Math.round(it.heal + st.mhp * it.pct), "without it: as before");
  },
  elixir() {
    const st = fresh("elixir"), c = X.PFX.elixir, it = X.ITEMS.hp_s;
    p.ch.inv.push({ id: "hp_s", n: 9 }); p.hp = 1; assert.ok(W.act({ t: "use", id: "hp_s" }).ok); assert.equal(X.pfxPc(p).n.elixir, 6, "six seconds of it");
    const hp0 = p.hp, step = (n) => { for (let i = 0; i < n; i++) { T(1000); X.pfxTick(S, rt, p, X.stats(p), S.now, false); } };
    step(6); near(p.hp - hp0, 6 * st.mhp * c.k, 1e-6, "1 % of max HP a second for 6 s"); const hp1 = p.hp; step(2); assert.equal(p.hp, hp1, "then it stops");
    fresh("elixir"); p.hp = 1; X.pfxTick(S, rt, p, X.stats(p), S.now, false); assert.equal(p.hp, 1, "no potion, no healing");
    fresh("elixir"); p.ch.inv.push({ id: "mp_s", n: 9 }); p.mp = 1; W.act({ t: "use", id: "mp_s" }); assert.ok(!(X.pfxPc(p).n.elixir > 0), "a mana potion does not start it");
  },
  med() {
    const st = fresh("med"), c = X.PFX.med, tick = () => X.pfxTick(S, rt, p, X.stats(p), S.now, true);
    p.mp = st.mmp * 0.5; p.mvAt = S.now - c.ms; tick(); assert.equal(p.mp, st.mmp * 0.5, "2 s exactly is not over 2 s"); p.mvAt = S.now - c.ms - 1; tick(); near(p.mp, st.mmp * (0.5 + c.k), 1e-6, "2 % of max MP");
    p.mp = st.mmp - 1; tick(); assert.equal(p.mp, st.mmp, "never above max MP");
  },
  moss() {
    const st = fresh("moss"), c = X.PFX.moss;
    p.hp = st.mhp * 0.5; X.pfxTick(S, rt, p, X.stats(p), S.now, false); assert.equal(p.hp, st.mhp * 0.5, "a recent hit: nothing"); X.pfxTick(S, rt, p, X.stats(p), S.now, true); near(p.hp, st.mhp * (0.5 + c.k), 1e-6, "1.5 % of max HP when calm");
  },
};
for (const k of KEYS) assert.equal(typeof CASES[k], "function", `${k}: a test`);
for (const k of KEYS) { const t0 = performance.now(); CASES[k](); if (process.env.PFX_VERBOSE) console.log(k, (performance.now() - t0).toFixed(0), "ms"); }

// ── 3. the caps they run into
{
  const wearAll = (pairs) => { fresh(); for (const [slot, id, k] of pairs) W.wear(slot, id, k); return X.stats(p); };
  // mitigation: every prefix factor multiplies into one, floored at ×0.6 (design §5): an elite, standing still, a marked area, night
  wearAll([["armor", "a_3", "gran"], ["boots", "b_3", "root"], ["helm", "h_3", "foresee"], ["amulet", "n_4", "owl"]]);
  S.now = NIGHT; mob.el = 1; p.mvAt = S.now - 5000; p.hitHow = "tele";
  const f = X.PFX.gran.k * X.PFX.root.k * X.PFX.foresee.k * X.PFX.owl.k;
  assert.ok(f < X.PFX_CAP.miti, "the four factors alone would be below the floor"); assert.equal(mit(), Math.round(1000 * X.PFX_CAP.miti), "so the floor holds: never more than -40 %"); p.hitHow = "";
  // a ward stops even a huge blow (it is a block, not a factor)
  fresh("stone", "ward"); assert.equal(mit(Math.round(X.stats(p).mhp * 3)), 0, "a ward stops even a huge blow");
  // heals: the sustain powers share the per-second prefix budget (≤ 8 % of max HP); the three together are under it, and a big number is cut to it
  const s2 = wearAll([["armor", "a_3", "spring"], ["amulet", "n_4", "elixir"], ["helm", "h_3", "moss"]]); p.hp = s2.mhp * 0.3; X.pfxPc(p).n.elixir = 3; const hp0 = p.hp;
  X.pfxTick(S, rt, p, X.stats(p), S.now, true);
  near(p.hp - hp0, s2.mhp * (X.PFX.spring.k + X.PFX.moss.k + X.PFX.elixir.k), 1e-6, "spring + moss + elixir are all paid (3.7 % ≤ 8 %)");
  fresh("spring"); const s3 = X.stats(p); p.hp = s3.mhp * 0.3; X.PFX.spring.k = 0.5; const h1 = p.hp; X.pfxTick(S, rt, p, X.stats(p), S.now, true); X.PFX.spring.k = 0.012;
  near(p.hp - h1, s3.mhp * X.PFX_CAP.heal, 1e-6, "a big number is cut to 8 % a second");
}

// ── 4. the roll: the live powers drop on their own slots, the held ones never
{
  const TYPES = { A: "a_4", B: "b_3", N: "n_4", H: "h_2" }, HELD = KEYS.filter((k) => !DOC[k][4]);
  assert.deepEqual(HELD.sort(), ["after", "chase", "panic", "relax", "slick"], "five move-speed powers wait for the client");
  for (const [c, id] of Object.entries(TYPES)) {
    const box = { seed: 4242 + c.charCodeAt(0) }, seen = new Set();
    for (let i = 0; i < 5000; i++) seen.add(X.rollGear(box, id, i % 2 ? 3 : 5, 30).lg);
    for (const k of KEYS.filter((q) => DOC[q][4] && X.LEGEND[q][2].includes(c))) assert.ok(seen.has(k), `${k} drops on ${id}`);
    for (const k of HELD) assert.ok(!seen.has(k), `${k} (held) never drops`);
  }
}

// ── 5. real monsters hit a player for 400 ticks, twice: the same world, the same result (the shared hitHow edit and every hook live)
{
  // [armor, helm, boots, amulet] per set
  const SETS = [["counter", "ward", "smoke", "manawall"], ["rime", "bark", "dust", "spring"], ["foresee", "heavy", "cure", "fate"], ["emerg", "pot", "nimble", "owl"]];
  const run = (keys) => {
    const w = world("soak"), q = w.p, s = w.S;
    q.ch.eq = { weapon: q.ch.eq.weapon };
    [["armor", "a_3"], ["helm", "h_3"], ["boots", "b_3"], ["amulet", "n_4"]].forEach(([slot, id], i) => w.wear(slot, id, keys[i]));
    const st = X.stats(q), at = (k, dx, dy) => w.mob(k, q.x + dx, q.y + dy, { hp: 1e7 });
    at("twinhare", 18, 0); at("lambmaw", -16, 8); at(SHOOTER, 60, 10);
    let h = 0, hurts = 0;
    for (let t = 0; t < 400; t++) {
      if (q.dead) { s.now = w.now; L.applyAction(s, w.PID, { t: "respawn" }); }
      q.hp = Math.max(1, Math.min(q.hp, st.mhp)); if (t % 25 === 0) q.hp = st.mhp * 0.4;
      const v = w.step(); hurts += v.me[2] < st.mhp ? 1 : 0;
      for (const n of [q.hp, q.mp, q.ghost, q.x, q.y, ...w.rt.mobs.map((m) => m.hp + m.slow + m.stun)]) h = (h * 31 + Math.round(n * 10)) | 0;
    }
    return { h, hurts };
  };
  for (const keys of SETS) { const a = run(keys), b = run(keys); assert.equal(a.h, b.h, `${keys}: the same world twice, the same hash`); assert.ok(a.hurts > 20, `${keys}: the monsters did hit (${a.hurts})`); }
}
console.log("prefix-guard: ok");
