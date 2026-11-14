// Headless test of the weapon skills (docs/design/jobs-and-stats.md C): every skill castable or active with its
// fx code, the gating, the six passives, the job and hybrid signatures, the bar, the wire.   node tests/skills.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const SK = D.skills;
const JOB = { sword: "swordsman", dagger: "thief", spear: "lancer", staff: "wizard", book: "warlock", bow: "archer" };

/** A hero (L.hero options) alone on open meadow ground, every monster put away until a test calls one up. */
function world(name, o) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, L.hero(name, { lvl: 157, ...o }));
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    get rt() { return S.maps[S.players[PID].map]; },
  };
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  const mp = W.step().map;
  const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  let spot = null;
  for (let y = 4; y < mp.h - 4 && !spot; y++) for (let x = 6; x < mp.w - 10 && !spot; x++) {
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -5; dx <= 9 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
    if (ok) spot = [x, y];
  }
  assert.ok(spot, "open ground");
  const home = [spot[0] * T + 8, spot[1] * T + 10];
  /** Back to the spot, rested, every cooldown spent, the monsters gone. */
  W.ready = () => {
    p.x = home[0]; p.y = home[1]; p.mvAt = now; p.fix = false; p.dir = 2; p.aim = 0;
    p.mp = 9999; p.hp = 1e6; p.atkAt = 0; p.stag = 0; p.combo = 0; p.dance = null; p.ghost = 0; p.cds = {};
    for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
    W.rt.props = []; W.rt.zones = []; W.rt.decoys = []; W.rt.shots = [];
  };
  /** Call up plain monsters at offsets from the player. */
  W.mobs = (offs, hp = 50000, more = {}) => {
    const pool = W.rt.mobs.filter((q) => !D.mobs[q.k].chest && !D.mobs[q.k].boss && !D.mobs[q.k].fly);
    return offs.map(([dx, dy], j) => {
      const m = pool[j];
      m.slot = null;
      Object.assign(m, { dead: false, el: 0, tr: [], hp, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, wx: p.x + dx, wy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, brand: 0, dot: null, tgt: null, st: 0, act: null, castAt: now + 1e12, atkAt: now + 1e12, mvAt: now + 1e12, hw: 0, hu: 0 }, more);
      return m;
    });
  };
  W.ready();
  return W;
}
const evts = (v, tag) => (v.ev || []).filter((e) => e[0] === tag);
const fx = (vs, eid) => vs.flatMap((v) => evts(v, "a")).filter((e) => e[1] === eid).map((e) => e[2]);
const hurt = (m, hp = 50000) => m.hp < hp;
const run = (W, n = 40, ms = 100) => { const vs = []; for (let i = 0; i < n; i++) vs.push(W.step(ms)); return vs; };

// ═════════ the tables
{
  assert.equal(D.skillOrder.length, 30, "per weapon L1, L10 and a passive (18), six single and six hybrid signatures");
  assert.deepEqual(Object.keys(SK), D.skillOrder);
  const kinds = D.skillOrder.map((id) => SK[id].kind).join("");
  assert.equal(kinds, "aap".repeat(6) + "j".repeat(6) + "h".repeat(6));
  for (const id of D.skillOrder) {
    const s = SK[id];
    assert.equal(s.id, id);
    assert.ok(s.name && s.desc && s.desc.length > 20, id + " is named and described in Korean");
    if (s.kind !== "p") assert.ok(s.mp > 0 && s.cd >= 3500 && s.fx >= 70 && s.fx <= 102, id + " costs, waits and has an fx code");
    if (s.kind === "j") { assert.equal(D.jobs[s.job].kind, "single"); assert.equal(D.jobs[s.job].wk[0], s.wk); assert.equal(s.need, 20); }
    if (s.kind === "h") assert.equal(D.jobs[s.job].kind, "hybrid");
  }
  for (const j of Object.keys(D.jobs)) if (D.jobs[j].kind !== "none") assert.equal(D.skillOrder.filter((id) => SK[id].job === j).length, 1, j + " has one signature");
  const codes = D.skillOrder.filter((id) => SK[id].kind !== "p").map((id) => SK[id].fx);
  assert.equal(new Set(codes).size, codes.length, "one fx code each");
}

// ═════════ every active and signature casts, shows its fx code and lands
const HYB = { spellblade: ["sword", "staff"], tracker: ["dagger", "bow"], dragoon: ["spear", "book"], hexblade: ["dagger", "book"], stormrider: ["spear", "bow"], darkknight: ["sword", "book"] };
for (const id of D.skillOrder) {
  const s = SK[id];
  if (s.kind === "p") continue;
  const wk = s.kind === "h" ? HYB[s.job][0] : s.wk;
  const W = world("시전" + id, { wk, wm: { [wk]: 30, ...(s.kind === "h" ? { [HYB[s.job][1]]: 30 } : {}) }, job: s.job || undefined });
  const p = W.p;
  // a crowd in front (the aim is east), spread a little: something is in reach of every skill
  const ms = W.mobs([[24, 0], [40, 6], [56, -6], [72, 0], [90, 4], [110, -4]]);
  // the tracker's traps need something to walk into them: one stands on a trap's ring
  if (id === "traps") { ms[0].x = p.x + 32; ms[0].y = p.y + 32; }
  const r = W.act({ t: "sk", id, a: 0 });
  assert.ok(r.ok, `${id} casts: ${r.error}`);
  assert.ok(p.cds[id] > W.now, id + " goes on cooldown");
  p.dirty = true;
  const vs = [W.step(50), ...run(W, 50)];
  // the wire said it was on cooldown, usable in hand
  const row = vs[0].self.sk.find((x) => x[0] === id);
  assert.ok(row && row[2] > 0 && row[3] === 1, id + " is on the wire, cooling down, usable in hand");
  assert.ok(fx(vs, p.eid).includes(s.fx), `${id} shows fx ${s.fx} (${[...new Set(fx(vs, p.eid))]})`);
  assert.ok(ms.some((m) => hurt(m)), id + " lands");
}

// ═════════ gating: the weapon in hand, its mastery, the job; cooldown and MP
{
  const W = world("관문", { wk: "sword", wm: { sword: 9 } });
  const p = W.p;
  assert.equal(W.act({ t: "sk", id: "rend" }).error, "[대검] 숙련 10에 배웁니다");
  assert.equal(W.act({ t: "sk", id: "fireball" }).error, "[스태프]를 들어야 쓸 수 있습니다");
  assert.equal(W.act({ t: "sk", id: "pierce" }).error, "[활]을 들어야 쓸 수 있습니다");
  assert.equal(W.act({ t: "sk", id: "verdict" }).error, "[대검전사]의 스킬입니다");
  assert.equal(W.act({ t: "sk", id: "crimson" }).error, "[마검사]의 스킬입니다");
  assert.equal(W.act({ t: "sk", id: "inertia" }).ok, false, "a passive is not cast");
  assert.equal(W.act({ t: "sk", id: "nope" }).error, "없는 스킬");
  assert.equal(W.act({ t: "sk", i: 0 }).error, "없는 스킬", "the old index form is gone");
  assert.equal(W.act({ t: "sk", id: "__proto__" }).error, "없는 스킬");
  assert.ok(W.act({ t: "sk", id: "slash" }).ok);
  assert.equal(W.act({ t: "sk", id: "slash" }).error, "재사용 대기 중입니다");
  p.cds = {}; p.mp = 2;
  assert.equal(W.act({ t: "sk", id: "slash" }).error, "MP가 부족합니다");
  p.mp = 999; p.stag = W.now + 500;
  assert.equal(W.act({ t: "sk", id: "slash" }).error, "stag", "a stagger refuses quietly");
  // bare hands: no skills at all (the job's weapon is only borrowed for the basic blow)
  W.ready();
  W.ch.inv.push(W.ch.eq.weapon); W.ch.eq.weapon = null; p.stc = null;
  assert.equal(W.act({ t: "sk", id: "slash" }).error, "[대검]을 들어야 쓸 수 있습니다");
  // the signature: the job, and its weapon in hand
  const J = world("전직", { wk: "dagger", wm: { dagger: 20, sword: 5 }, job: "swordsman" });
  assert.equal(J.act({ t: "sk", id: "verdict" }).error, "[대검]을 들어야 쓸 수 있습니다", "the job without its weapon");
  J.ch.eq.weapon = { id: "w_warrior_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }; J.p.stc = null;
  assert.ok(J.act({ t: "sk", id: "verdict" }).ok, "the job with its weapon");
  // mastery grows a skill: +SK_GROW a level past its need
  const dmg = (lv) => {
    const G = world("성장" + lv, { wk: "sword", wm: { sword: lv } });
    let sum = 0;
    for (let i = 0; i < 40; i++) { G.ready(); const [m] = G.mobs([[24, 0]]); G.act({ t: "sk", id: "slash", a: 0 }); sum += 50000 - m.hp; }
    return sum;
  };
  const k = dmg(41) / dmg(1);
  assert.ok(k > 1 + 30 * D.skGrow && k < 1 + 50 * D.skGrow, `mastery 41 hits ×${k.toFixed(3)} of mastery 1`);
}

// ═════════ passives
// 거검의 관성: +1 a sword hit (once an action), 5 at most, gone 2.5 s after the last; reach and crit damage
{
  const W = world("관성", { wk: "sword", wm: { sword: 10 } });
  const p = W.p;
  const [m] = W.mobs([[20, 0], [24, 8]]);
  const range0 = W.self().range;
  for (let i = 0; i < 6; i++) { m.x = p.x + 20; m.y = p.y; p.atkAt = 0; assert.ok(W.act({ t: "atk", a: 0 }).ok); if (i === 0) assert.equal(p.inert, 1, "a cleave of two is one stack"); W.step(50); }
  assert.equal(p.inert, 5, "capped at five");
  const s = W.self();
  assert.equal(s.cr.k, "inertia"); assert.equal(W.step().me[9], 5, "the gauge rides on every snapshot");
  assert.ok(s.range > range0 * 1.25, `reach grows with it: ${range0} → ${s.range}`);
  run(W, 26);
  assert.equal(p.inert, 0, "gone 2.5 s after the last hit");
  assert.equal(W.step().me[9], 0);
  void m;
  const U = world("관성전", { wk: "sword", wm: { sword: 9 } });
  U.mobs([[20, 0]]);
  U.act({ t: "atk", a: 0 });
  assert.equal(U.p.inert | 0, 0, "not before mastery 10");
  assert.equal(U.self().cr, null, "and no gauge");
}
// 급소 도려내기: stabs mark; a marked monster bleeds and the stabber runs faster
{
  const W = world("급소", { wk: "dagger", wm: { dagger: 10 } });
  const p = W.p;
  const [m] = W.mobs([[16, 0]]);
  const spd0 = W.self().spd;
  p.atkAt = 0; W.act({ t: "atk", a: 0 });
  assert.equal(m.mk, 1, "a stab marks");
  assert.ok(!m.dot, "the first stab does not bleed it");
  W.step(600); p.atkAt = 0;
  W.act({ t: "atk", a: 0 });
  const v = W.step();
  assert.equal(m.mk, 2);
  assert.ok(m.dot && m.dot.until > W.now && m.dot.pid === W.PID, "a marked monster bleeds");
  assert.ok(fx([v], p.eid).includes(111), "with its fx");
  assert.ok(p.vitSpd > W.now, "and the stabber is quicker for a moment");
  const hp = m.hp;
  run(W, 12);
  assert.ok(m.hp < hp, "the bleeding bites on its own");
  assert.ok(v.M.find((r) => r[0] === m.id)[8] === 2, "the marks ride on the monster's row");
  void spd0;
  // marks add 3% crit chance each: many stabs on a 5-mark monster crit more than on a clean one
  const crits = (marks) => {
    const C = world("치명" + marks, { wk: "dagger", wm: { dagger: 10 }, st: { str: 5, wil: 5, dex: 5, int: 5, wis: 5, luk: 5 } });
    let n = 0;
    for (let i = 0; i < 300; i++) { C.ready(); const [q] = C.mobs([[16, 0]], 50000, { tgt: C.PID, mk: marks, mkAt: C.now + 9000 }); C.act({ t: "atk", a: 0 }); const h = C.rt.ev.find((e) => e[0] === "h" && e[1] === q.id); if (h && h[3] === 1) n++; L.endTick(C.S); }
    return n;
  };
  assert.ok(crits(4) > crits(0) + 15, "marks point to the gaps");
}
// 창끝의 거리: a blow at the far end of the reach hits ×1.5 and through 35% of the armour
{
  const hit = (dx, wm) => {
    const W = world("창끝" + dx + wm, { wk: "spear", wm: { spear: wm } });
    let sum = 0, tips = 0;
    for (let i = 0; i < 40; i++) { W.ready(); const [m] = W.mobs([[dx, 0]], 50000, { k: "crabskull" }); W.act({ t: "atk", a: 0 }); sum += 50000 - m.hp; tips += W.rt.ev.filter((e) => e[0] === "tip").length; L.endTick(W.S); }
    return { sum, tips };
  };
  const near = hit(20, 10), far = hit(48, 10), locked = hit(48, 9);
  assert.equal(near.tips, 0); assert.equal(far.tips, 40, "every far blow is a tip");
  assert.equal(locked.tips, 0, "not before mastery 10");
  assert.ok(far.sum > near.sum * 1.5, `the tip hits harder and through armour: ${near.sum} → ${far.sum}`);
  const W = world("창끝게이지", { wk: "spear", wm: { spear: 10 } });
  assert.deepEqual(W.self().cr, { k: "tip", tip: Math.round(D.wkinds.spear.range * D.mech.tip) });
}
// 마력 공명: every third staff skill makes the next free and 30% stronger; elements react
{
  const W = world("공명", { wk: "staff", wm: { staff: 10 } });
  const p = W.p;
  const cast = () => { p.cds = {}; const mp = p.mp; const [m] = W.mobs([[40, 0]]); const r = W.act({ t: "sk", id: "fireball", a: 0 }); assert.ok(r.ok, r.error); const cost = mp - p.mp; const v = W.step(); W.ready(); return { cost, v, m }; };
  W.ready();
  assert.equal(cast().cost, SK.fireball.mp);
  assert.equal(cast().cost, SK.fireball.mp);
  const third = cast();
  assert.ok(fx([third.v], p.eid).includes(113), "the third fills the resonance (fx 113)");
  assert.equal(p.reso, 3);
  assert.equal(W.self().sk.find((s) => s[0] === "fireball")[1], 0, "the wire shows it free");
  assert.ok(W.step().me[8] & 32, "and others see it glowing");
  const fourth = cast();
  assert.equal(fourth.cost, 0, "the fourth costs nothing");
  assert.equal(p.reso, 0, "and spends it");
  // fire on held ice: steam
  W.ready();
  W.mobs([[30, 0], [40, 6]]);
  p.weave = { e: "i", until: W.now + 4000 };
  W.act({ t: "sk", id: "fireball", a: 0 });
  assert.ok(evts(W.step(), "rx").some((e) => e[1] === 1), "fire meeting held ice explodes into steam");
  const N = world("공명전", { wk: "staff", wm: { staff: 9 } });
  for (let i = 0; i < 4; i++) { N.p.cds = {}; N.p.mp = 999; N.act({ t: "sk", id: "fireball", a: 0 }); }
  assert.equal(N.p.reso | 0, 0, "no resonance before mastery 10");
}
// 금서의 낙인: a book skill brands; a branded monster takes 15% more from anyone
{
  const W = world("낙인", { wk: "book", wm: { book: 10 } });
  const p = W.p;
  const [m] = W.mobs([[60, 0]]);
  W.act({ t: "sk", id: "soulbolt", a: 0 });
  const vs = run(W, 6);
  assert.ok(m.brand > W.now, "the soul bolt brands");
  assert.ok(fx(vs, p.eid).includes(114), "fx 114");
  assert.ok(vs[vs.length - 1].M.find((r) => r[0] === m.id)[9] === 1, "the brand rides on the monster's row");
  assert.equal(W.self().cr.k, "brand");
  const blows = (brand) => { let s = 0; for (let i = 0; i < 60; i++) { W.ready(); const [q] = W.mobs([[30, 0]], 50000, { brand: brand ? W.now + 5000 : 0 }); W.act({ t: "atk", a: 0 }); s += 50000 - q.hp; } return s; };
  const r = blows(true) / blows(false);
  assert.ok(r > 1.08 && r < 1.25, `branded takes more: ×${r.toFixed(3)}`);
  const B = world("낙인전", { wk: "book", wm: { book: 9 } });
  const [q] = B.mobs([[60, 0]]);
  B.act({ t: "sk", id: "soulbolt", a: 0 }); run(B, 6);
  assert.ok(!(q.brand > B.now), "not before mastery 10");
}
// 매의 시야: arrows hit harder the further they flew (+25% at most)
{
  const shots = (dx, wm) => {
    const W = world("매" + dx + wm, { wk: "bow", wm: { bow: wm }, st: { str: 5, wil: 5, dex: 5, int: 5, wis: 5, luk: 5 } });
    let s = 0, far = 0;
    for (let i = 0; i < 60; i++) { W.ready(); const [m] = W.mobs([[dx, 0]]); W.act({ t: "atk", a: 0 }); for (let k = 0; k < 6; k++) { const v = W.step(); far += fx([v], W.p.eid).filter((c) => c === 115).length; } s += 50000 - m.hp; }
    return { s, far };
  };
  const a = shots(140, 10), b = shots(140, 9), c = shots(30, 10);
  const k = a.s / b.s;
  assert.ok(k > 1 + SK.hawk.k * 0.6 && k < 1 + SK.hawk.k * 1.4, `a far shot with the hawk's eye: ×${k.toFixed(3)}`);
  assert.ok(a.far > 30 && c.far === 0, "the far-hit fx (115) only for far hits");
  assert.equal(world("매게이지", { wk: "bow", wm: { bow: 10 } }).self().cr.k, "hawk");
}

// ═════════ skills worth a closer look
// 대지 가르기 never leaps over a wall; 관통 화살 goes through everything in its line; 도약 사격 at most two a monster
{
  const W = world("관통", { wk: "bow", wm: { bow: 10 } });
  const ms = W.mobs([[30, 0], [60, 2], [90, -2], [120, 0]]);
  W.act({ t: "sk", id: "pierce", a: 0 });
  run(W, 6);
  assert.ok(ms.every((m) => hurt(m)), "the piercing arrow passes through all four");
  W.ready();
  const [one] = W.mobs([[50, 0]]);
  const x0 = W.p.x;
  W.act({ t: "sk", id: "leapshot", a: 0 });
  assert.ok(W.p.x < x0 - 30, "a hop back");
  const vs = run(W, 6);
  const hits = vs.flatMap((v) => evts(v, "h")).filter((e) => e[1] === one.id).length;
  assert.ok(hits >= 1 && hits <= 2, `five arrows, at most two in one monster (${hits})`);
}
// 무영난무: untouchable, seven blinks among the monsters near, marked first, then home
{
  const W = world("난무", { wk: "dagger", wm: { dagger: 20 }, job: "thief" });
  const p = W.p, x0 = p.x, y0 = p.y;
  const [a, b] = W.mobs([[40, 0], [-30, 20]]);
  b.mk = 4; b.mkAt = W.now + 9000;
  assert.ok(W.act({ t: "sk", id: "flurry", a: 0 }).ok);
  assert.ok(W.step(150).me[8] & 16, "others see the dance");
  assert.ok(Math.hypot(p.x - b.x, p.y - b.y) < 20, "the marked one first");
  assert.equal(b.mk, 0, "its marks are cashed in");
  assert.equal(W.act({ t: "sk", id: "ambush" }).error, "무영난무 중입니다");
  const vs = run(W, 25);
  assert.equal(fx(vs, p.eid).filter((c) => c === 86).length, 6, "seven blinks in all");
  assert.ok(!p.dance && Math.abs(p.x - x0) < 1 && Math.abs(p.y - y0) < 1, `and home again (${JSON.stringify(p.dance)} ${W.now} ${p.x - x0} ${p.y - y0})`);
  assert.ok(hurt(a) && hurt(b));
}
// 불멸의 성역: costs HP, wards the party inside, drains the monsters inside
{
  const W = world("성역", { wk: "sword", wm: { sword: 20, book: 20 }, job: "darkknight" });
  const p = W.p;
  W.mobs([[30, 0], [-30, 10]]);
  p.hp = 1000; p.mp = 999;
  assert.ok(W.act({ t: "sk", id: "sanctuary", a: 0 }).ok);
  assert.equal(p.hp, 800, "a fifth of the HP");
  W.step(200);
  assert.ok(p.sanctAt > W.now, "warded inside");
  assert.equal(SK.sanctuary.autoHp, 0.6, "auto-hunt keeps it for when HP is above 60%");
}

// ═════════ the hybrid: both passives on with either weapon; swapping keeps the gauges
{
  const W = world("마검", { wk: "sword", wk2: "staff", wm: { sword: 20, staff: 20 }, job: "spellblade" });
  const p = W.p;
  let s = W.self();
  const on = (sv, id) => sv.sk.find((x) => x[0] === id)[3];
  assert.ok(on(s, "inertia") && on(s, "reso"), "both passives with the sword");
  assert.equal(s.cr.k, "inertia"); assert.equal(s.cr.o.k, "reso", "the other weapon's gauge rides along");
  assert.equal(on(s, "fireball"), 0, "the staff's own skills need the staff");
  assert.equal(on(s, "crimson"), 1, "the fusion signature works with either");
  W.mobs([[20, 0]]);
  W.act({ t: "atk", a: 0 });
  assert.equal(p.inert, 1);
  assert.ok(W.act({ t: "wsw" }).ok);
  s = W.self();
  assert.equal(s.wk, "staff");
  assert.ok(on(s, "inertia") && on(s, "reso") && on(s, "fireball") && on(s, "crimson"), "both passives with the staff too");
  assert.equal(p.inert, 1, "a swap keeps the gauges");
  assert.equal(s.cr.k, "reso"); assert.equal(s.cr.o.k, "inertia");
  // a single job sees only its own weapon's passive on in hand
  const O = world("외길", { wk: "sword", wm: { sword: 20, staff: 20 }, job: "swordsman" });
  const so = O.self();
  assert.equal(on(so, "reso"), 0, "a single job does not carry the staff's passive in a sword hand");
}

// ═════════ the bar: a skill a mastery level opens goes on it; a job's signature too
{
  const W = world("단축", { wk: "spear", wm: { spear: 9 } });
  const p = W.p, ch = W.ch;
  assert.deepEqual(ch.qs.filter(Boolean), [["s", "spiral"]], "a hero's bar starts with what the hand can use");
  const [m] = W.mobs([[30, 0]], 1);
  ch.wm.spear.xp = 22 * 81 - 1;
  W.act({ t: "atk", a: 0 });
  const v = W.step();
  assert.equal(ch.wm.spear.lv, 10);
  assert.deepEqual(ch.qs[1], ["s", "comet"], "the new active takes the next slot");
  assert.ok(!ch.qs.some((x) => x && x[1] === "tip"), "a passive never goes on the bar");
  assert.ok((v.toast || []).some((t) => t.includes("[유성창]") && t.includes("[창끝의 거리]")), "the toast names both");
  void m;
  ch.wm.spear.lv = 20; ch.gold = 1e5;
  L.runtime(W.S, p.map).n--; p.map = "town"; L.runtime(W.S, "town").n++; p.sendMap = true;
  const arsen = W.step().map.npcs.find((n) => n.role === "job");
  p.x = arsen.x * T + 8; p.y = arsen.y * T + 30; p.mvAt = W.now;
  const r = W.act({ t: "job_change", j: "lancer" });
  assert.ok(r.ok, r.error);
  assert.ok(ch.qs.some((x) => x && x[1] === "dragon"), "the signature joins the bar on the job change");
}

// ═════════ the wire and defs
{
  const W = world("전선", { wk: "staff", wm: { staff: 20, book: 3 }, job: "wizard" });
  const s = W.self();
  assert.ok(!("skm" in s) && !("cds" in s) && !("lc" in s), "the old fields are gone");
  assert.deepEqual(s.sk.map((x) => x[0]), ["slash", "ambush", "spiral", "fireball", "frostring", "reso", "soulbolt", "pierce", "meteor"], "every skill learned, in order (every weapon's first, and other weapons' too)");
  for (const [id, mp, cd, use] of s.sk) {
    assert.ok(Number.isInteger(mp) && Number.isInteger(cd) && (use === 0 || use === 1), id);
    assert.equal(use, SK[id].wk === "staff" ? 1 : 0, id + " usable only with the staff in hand");
  }
  assert.ok(!("legacyCls" in D) && D.mech && !("grit" in D.mech), "no class kit left in defs");
}
console.log("skills ok — 30 skills, six passives, signatures, hybrids, the bar and the wire");
