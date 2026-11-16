// Headless test of the prefix-power machinery (docs/design/prefix-effects.md, src/logic/51-prefix.js): the tables (table-driven: every
// row a later part adds is checked too), the roll pools and weights, the no-stack rule and `lgOff`, the hook dispatchers (a test-only power
// registered with Object.assign must fire from each), the caps, old sheets, determinism and the cost.   node tests/prefix.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { LEGEND, PFX, PFX_FN, PFX_W, SLOT_L, PFX_HOOKS, PFX_CAP, PX, SLOTS, ITEMS, MOBS, SKILL, plain, rollGear, gearBonus, gearIl, stats, deriveStats, newMob, hurtMob, hurtPlayer, wound, afflict, evadeBlow, dodged, chainBlow, lootFor, skMp, deathLoss, migrate, pfxPick, pfxPc, pfxIcd, pfxStack, pfxHeal, pfxChance, pfxReset, pfxMul, pfxMiti, pfxPre, pfxLoot, pfxNum, aimIdx, atkRange };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs();
const T = 16;

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
    self() { W.p.dirty = true; return W.step().self; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
    mob(k, x, y, o = {}) { const m = Object.assign(X.newMob(S, k, [0, 0, 0, 0]), { x, y, hp: 1e6 }, o); W.rt.mobs.push(m); return m; },
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

// ── 1. the tables, row by row (a part that adds powers later is checked by the same loop)
const OLD_DESC = {
  chain: "공격 시 25% 확률로 번개가 주변 적 2명에게 튄다 (60%)", nova: "적을 처치하면 폭발해 주변에 피해를 준다 (80%)", greed: "골드 획득 +60%", haste: "공격 속도 +15%",
  thorn: "받은 피해의 40%를 공격한 적에게 되돌려 준다", feast: "적을 처치할 때마다 최대 HP의 4% 회복", echo: "스킬 사용 시 20% 확률로 재사용 대기시간이 사라진다", giant: "정예와 우두머리에게 주는 피해 +30%",
};
const FAMS = ["blow", "kill", "pass", "crit", "skill", "mit", "sus", "mob", "eco", "xp", "util"], ALLOWED = { O: "WRG", D: "ABNH", U: "H" };
function checkTables() {
  const keys = Object.keys(X.LEGEND), words = new Set();
  for (const k of keys) {
    const row = X.LEGEND[k];
    assert.equal(row.length, 6, `${k}: [word, desc, slots, cat, rating, fam]`);
    const [word, desc, slots, cat, rating, fam] = row;
    assert.ok(/^[가-힣 ]+$/.test(word), `${k}: a Korean word`); assert.ok(!words.has(word), `${k}: the word ${word} is taken`); words.add(word);
    assert.ok(/[가-힣]/.test(desc) && /\d/.test(desc) && !/[{}]|undefined|NaN/.test(desc), `${k}: a Korean tooltip with a number: ${desc}`);
    assert.ok(/^[WRGABNH]+$/.test(slots) && new Set(slots).size === slots.length, `${k}: slots ${slots}`);
    assert.ok(ALLOWED[cat], `${k}: cat ${cat}`); assert.ok([...slots].every((c) => ALLOWED[cat].includes(c)), `${k}: cat ${cat} does not fit slots ${slots}`);
    if (cat === "U") assert.equal(slots, "H", `${k}: utility is helm only`);
    assert.ok(["S", "M", "L"].includes(rating), `${k}: rating`); assert.ok(FAMS.includes(fam), `${k}: fam ${fam}`);
    const n = X.PFX[k];
    assert.ok(n && typeof n === "object", `${k}: PFX numbers`);
    for (const [f, v] of Object.entries(n)) assert.ok(Number.isFinite(v), `${k}.${f} is a number`);
    if (n.on && !n.off) {
      const fn = X.PFX_FN[k];
      assert.ok(fn && typeof fn === "object", `${k}: a live power needs its PFX_FN entry`);
      for (const [h, f] of Object.entries(fn)) { assert.ok(X.PFX_HOOKS.includes(h), `${k}: hook ${h} is not one of PFX_HOOKS`); assert.equal(typeof f, "function"); }
    }
    assert.equal(D.legend[k] && D.legend[k].join("|"), row.join("|"), `${k}: defs.legend ships the whole row`);
  }
  for (const k of Object.keys(X.PFX)) assert.ok(X.LEGEND[k], `PFX.${k} has no LEGEND row`);
  for (const k of Object.keys(X.PFX_FN)) assert.ok(X.LEGEND[k], `PFX_FN.${k} has no LEGEND row`);
  if (keys.length >= 95) {   // the whole catalogue is in: its design counts (prefix-effects.md §3–4)
    for (const c of "WRGABNH") assert.ok(keys.filter((k) => X.LEGEND[k][2].includes(c)).length >= 20, `a pool of at least 20 for ${c}`);
    assert.deepEqual(["O", "D", "U"].map((c) => keys.filter((k) => X.LEGEND[k][3] === c).length), [48, 39, 8]);
  }
}
checkTables();
for (const [k, d] of Object.entries(OLD_DESC)) assert.equal(X.LEGEND[k][1], d, `${k}: the old tooltip, byte for byte`);
for (const k of Object.keys(OLD_DESC)) assert.equal(X.PFX[k].on, 1, `${k} is live`);
assert.deepEqual(X.PFX_W, { S: 1, M: 2, L: 1 }); assert.equal(X.SLOT_L.ring1, "R"); assert.equal(X.SLOT_L.ring2, "R"); assert.equal(X.SLOT_L.ring, "R");

// ── 2. rolling: a pool by item type, weights S 1 · M 2 · L 1, nothing for the other rarities
{
  const TYPES = { W: "w_warrior_3", R: "r_3", G: "g_3", A: "a_4", B: "b_3", N: "n_4", H: "h_2" };
  const live = (c) => Object.keys(X.LEGEND).filter((k) => X.PFX[k].on && !X.PFX[k].off && X.LEGEND[k][2].includes(c));
  const N = 6000;
  for (const [c, id] of Object.entries(TYPES)) {
    const pool = live(c), tot = pool.reduce((s, k) => s + X.PFX_W[X.LEGEND[k][4]], 0), seen = {}, box = { seed: 31337 + c.charCodeAt(0) };
    assert.ok(pool.length >= 1, `${c}: something can drop`);
    for (let i = 0; i < N; i++) { const g = X.rollGear(box, id, i % 2 ? 3 : 5, 30); assert.ok(pool.includes(g.lg), `${id} (${c}) rolled ${g.lg}, not in its pool`); seen[g.lg] = (seen[g.lg] || 0) + 1; }
    for (const k of pool) { const pr = X.PFX_W[X.LEGEND[k][4]] / tot, sd = Math.sqrt((pr * (1 - pr)) / N); assert.ok(Math.abs(seen[k] / N - pr) < 5 * sd + 0.005, `${c}/${k}: ${seen[k] / N} vs ${pr}`); }
  }
  // the other rarities carry none; a set piece (q4) no `lg`
  const box = { seed: 5 };
  for (const q of [0, 1, 2]) for (let i = 0; i < 200; i++) assert.equal(X.rollGear(box, "w_warrior_3", q, 30).lg, undefined);
  for (let i = 0; i < 200; i++) { const g = X.rollGear(box, "g_3", 4, 30); assert.equal(g.q, 4); assert.equal(g.lg, undefined); }
  // the same box seed gives the same piece
  assert.deepEqual(X.rollGear({ seed: 99 }, "h_2", 3, 30), X.rollGear({ seed: 99 }, "h_2", 3, 30));
  // a key that is not `on` never drops, a key that is, does, and the weights follow the rating (the amulet pool has room for the three)
  Object.assign(X.PFX, { zs: { on: 1 }, zm: { on: 1 }, zl: { on: 1 }, zh: {} });
  for (const [k, r] of [["zs", "S"], ["zm", "M"], ["zl", "L"], ["zh", "M"]]) X.LEGEND[k] = ["시험" + k.replace(/./g, "의"), "시험 1", "N", "D", r, "sus"];
  const seen = {}, bx = { seed: 8 };
  for (let i = 0; i < N * 2; i++) { const k = X.rollGear(bx, "n_4", 3, 30).lg; seen[k] = (seen[k] || 0) + 1; }
  assert.equal(seen.zh, undefined, "a power not yet `on` never drops");
  assert.ok(Math.abs(seen.zm / seen.zs - 2) < 0.25 && Math.abs(seen.zl / seen.zs - 1) < 0.2, `weights 1:2:1 — ${seen.zs} ${seen.zm} ${seen.zl}`);
  for (const k of ["zs", "zm", "zl", "zh"]) { delete X.PFX[k]; delete X.LEGEND[k]; }
  checkTables();
}

// ── 3. no-stack: one power counts once; the higher item level, then the earlier slot; the other piece's lines still count
{
  const ch = L.hero("쌍반지", { wk: "sword", lvl: 157, migrate: true });
  const piece = (id, lg, il, af = []) => ({ ...X.plain(id), q: 3, il, lg, af });
  const bonus = (eq) => X.gearBonus({ ...ch, eq });
  const none = bonus({ ring1: piece("r_3", undefined, 100), ring2: piece("r_3", undefined, 90) });
  // two greed rings: +60 gold once, the lower item level is off
  let b = bonus({ ring1: piece("r_3", "greed", 90), ring2: piece("r_3", "greed", 120) });
  assert.deepEqual(b.lg, { greed: 1 }); assert.deepEqual(b.lgOff, ["ring1"], "the 120 wins, the 90 is off"); assert.equal(b.gold - none.gold, 60, "60 once, not 120");
  b = bonus({ ring1: piece("r_3", "greed", 100), ring2: piece("r_3", "greed", 100) });
  assert.deepEqual(b.lgOff, ["ring2"], "a tie goes to the earlier slot");
  b = bonus({ weapon: piece("w_warrior_3", "chain", 90), gloves: piece("g_3", "chain", 90) });
  assert.deepEqual(b.lgOff, ["gloves"], "weapon before gloves"); b = bonus({ weapon: piece("w_warrior_3", "chain", 90), gloves: piece("g_3", "chain", 91) });
  assert.deepEqual(b.lgOff, ["weapon"], "item level first");
  // the off piece still gives its plain lines and base
  const lines = bonus({ ring1: piece("r_3", "greed", 90, [["atk", 7]]), ring2: piece("r_3", "greed", 120, [["atk", 5]]) });
  assert.equal(lines.atk - none.atk, 12, "both pieces' ordinary lines count");
  // different keys: both, in slot order; three of a kind: the two losers, listed in slot order
  b = bonus({ ring1: piece("r_3", "giant", 100), helm: piece("h_3", "nova", 100), weapon: piece("w_warrior_3", "chain", 100) });
  assert.deepEqual(Object.keys(b.lg), ["chain", "nova", "giant"], "powers run in slot order"); assert.deepEqual(b.lgOff, []);
  b = bonus({ weapon: piece("w_warrior_3", "chain", 80), helm: piece("h_3", "chain", 90), amulet: piece("n_4", "chain", 70) });
  assert.deepEqual(b.lg, { chain: 1 }); assert.deepEqual(b.lgOff, ["weapon", "amulet"]);
  // a piece without `il` counts as its base's req + 10 (gearIl), so it can win or lose by that
  const old = { ...X.plain("r_3"), q: 3, lg: "greed" }; delete old.il;
  b = bonus({ ring1: old, ring2: piece("r_3", "greed", X.gearIl(old) - 1) });
  assert.deepEqual(b.lgOff, ["ring2"], "an old piece counts at req + 10");
  // the wire: self.lgOff, and the live list names the power once
  const W = world("nostack");
  W.wear("ring1", "r_3", "greed", 90); W.wear("ring2", "r_3", "greed", 120);
  let me = W.self();
  assert.deepEqual(me.lgOff, ["ring1"]); assert.deepEqual(me.lg, ["greed"]); assert.equal(me.goldb, 60);
  W.wear("ring1", "r_3", "echo", 90);
  me = W.self();
  assert.deepEqual(me.lgOff, []); assert.deepEqual(me.lg.sort(), ["echo", "greed"]);
  assert.deepEqual(X.stats(W.p).lgOff, []);
}

// ── 4. every dispatcher reaches a power registered with Object.assign (a test-only key, worn on the weapon, behaviour set by `F`)
const calls = [], F = {};
const STUB = {
  pre(S, p, st, mob, d, o, r) { calls.push("pre"); if (F.sure) r.sure = 1; if (F.crit) r.crit += F.crit; if (F.ign) r.ign = F.ign; },
  mul() { calls.push("mul"); return F.mul || 1; },
  hit(S, rt, p, st, mob, dmg, crit, killed) { calls.push(["hit", !!crit, !!killed]); },
  crit() { calls.push("crit"); },
  kill(S, rt, p, st, mob, x, y, o) { calls.push(["kill", !!o.px, Math.round(x)]); },
  blow(S, rt, p, st, mob, x, y, fin, skip) { calls.push(["blow", !!fin, skip === undefined]); },
  skill(S, rt, p, st, sk, id, cost) { calls.push(["skill", id, cost]); },
  miti(S, rt, p, st, mob, dmg, raw, r) { calls.push(["miti", dmg]); if (F.f) r.f *= F.f; if (F.abs) r.abs += F.abs; if (F.block) r.block = 1; },
  hurt(S, rt, p, st, mob, dmg) { calls.push(["hurt", dmg]); },
  lethal(S, rt, p) { calls.push("lethal"); if (F.save) { p.hp = 7; return true; } return false; },
  dash(S, rt, p, st, x0, y0, x, y) { calls.push(["dash", Math.round(x - x0) !== 0 || Math.round(y - y0) !== 0]); },
  evade(S, rt, p, st, how) { calls.push(["evade", how]); },
  tick(S, rt, p, st, now, calm) { calls.push(["tick", calm]); },
  status(S, p, st, kind, r) { calls.push(["status", kind]); if (F.sf !== undefined) r.f *= F.sf; },
  pot(S, p, st, amt) { calls.push(["pot", amt]); return amt * (F.pot || 1); },
  loot(S, rt, p, st, mob, r, kind) { calls.push(["loot", kind]); r.xp += F.xp || 0; r.gold += F.gold || 0; r.stone += F.stone || 0; r.mf += F.mf || 0; },
  stat(p, st, r) { if (F.atk) st.atk *= F.atk; if (F.iv) r.iv *= F.iv; },
  sheet(p, c) { calls.push("sheet"); if (F.eva) c.eva = F.eva; },
  num(p, name, v) { return F.num && F.num[name] !== undefined ? v * F.num[name] : v; },
};
Object.assign(X.PFX, { zz: { on: 0, k: 3 } });
Object.assign(X.LEGEND, { zz: ["시험의", "시험용 효과 3", "WG", "O", "S", "pass"] });
Object.assign(X.PFX_FN, { zz: STUB });
checkTables();
assert.deepEqual(Object.keys(STUB).sort(), [...X.PFX_HOOKS].sort(), "the stub covers every hook");
const seenCalls = () => { const c = calls.splice(0); return c; };
{
  const W = world("stub"), S = W.S, p = W.p, rt = W.rt;
  W.wear("weapon", "w_warrior_3", "zz");
  W.step();
  assert.ok(calls.includes("sheet"), "sheet runs in deriveStats"); seenCalls();
  const mob = W.mob("twinhare", 230, 200);
  const dmgOf = (m, opt) => { const hp = m.hp; S.seed = 777; X.hurtMob(S, rt, m, p, 1, true, opt); return hp - m.hp; };
  // pre → hit → crit; mul and its cap; px blows take no hit/crit but still pre/mul
  seenCalls();
  const base = dmgOf(mob); let c = seenCalls();
  assert.deepEqual(c.filter((x) => x === "pre" || x === "mul" || x === "crit").concat(c.filter(Array.isArray)), ["pre", "mul", "crit", ["hit", true, false]], "pre, mul, then hit and (a sure blow is a crit) crit");
  F.mul = 5; const capped = dmgOf(mob); seenCalls();
  assert.ok(Math.abs(capped / base - X.PFX_CAP.dmg) < 0.02, `mul ×5 is capped at ×1.6: ${capped / base}`); F.mul = 0;
  const px = dmgOf(mob, X.PX); c = seenCalls();
  assert.deepEqual(c, ["pre", "mul"], "a px blow runs only the passive hooks"); assert.equal(px, base);
  const tank = W.mob(Object.keys(X.MOBS).filter((k) => !X.MOBS[k].chest && !X.MOBS[k].boss && !X.MOBS[k].still).sort((a, b) => X.MOBS[b].def - X.MOBS[a].def)[0], 240, 205);
  const hitTank = () => { const hp = tank.hp; S.seed = 777; X.hurtMob(S, rt, tank, p, 30, true); return hp - tank.hp; };
  const armoured = hitTank(); F.ign = 0.5; const ignored = hitTank(); F.ign = 0;
  assert.ok(ignored > armoured, `armour ignored raises the blow: ${armoured} → ${ignored}`); seenCalls();
  // pre: crit chance is added under SFX.critCap; sure forces a crit even for a non-sure blow
  F.sure = 1; S.seed = 1; let crits = 0;
  for (let i = 0; i < 40; i++) { if (X.hurtMob(S, rt, mob, p, 1, false) === true) crits++; }
  assert.equal(crits, 40, "r.sure: every blow crits"); F.sure = 0; seenCalls();
  assert.ok(X.pfxPre(S, p, X.stats(p), mob, X.MOBS[mob.k], {}) !== undefined);
  F.crit = 1000; const r1 = X.pfxPre(S, p, X.stats(p), mob, X.MOBS[mob.k], {}); assert.ok(r1.crit <= 75 - X.stats(p).crit + 1e-9, "the added crit keeps the total under the cap"); F.crit = 0; seenCalls();
  // kill (also for a px kill), x/y of where it stood
  const m2 = W.mob("twinhare", 250, 210, { hp: 1 }); X.hurtMob(S, rt, m2, p, 50, true); c = seenCalls();
  assert.deepEqual(c.filter((x) => x[0] === "kill"), [["kill", false, 250]]);
  const m3 = W.mob("twinhare", 260, 210, { hp: 1 }); X.hurtMob(S, rt, m3, p, 50, true, X.PX); c = seenCalls();
  assert.deepEqual(c.filter((x) => x[0] === "kill"), [["kill", true, 260]], "a px kill still runs `kill`"); assert.ok(!c.some((x) => x[0] === "hit"));
  // blow: chainBlow (basic blows) and a real basic attack both reach it; a skill's hurtMob does not
  X.chainBlow(S, rt, p, X.stats(p), mob, 230, 200, true); c = seenCalls();
  assert.deepEqual(c, [["blow", true, true]]);
  p.x = 200; p.y = 200; p.dir = 2; mob.x = 214; mob.y = 200; p.atkAt = 0; p.hp = 1e6;
  const atk = W.act({ t: "atk", a: X.aimIdx(1, 0) }); c = seenCalls();
  assert.ok(atk.ok && c.some((x) => x[0] === "blow" && x[1] === false), `a real basic attack reaches blow: ${JSON.stringify(c)}`);
  // skill: a real cast; its MP cost goes through num("mp")
  const sk = W.self().sk.find((r) => r[3] && r[1] > 0 && r[2] === 0); assert.ok(sk, "a usable skill");
  seenCalls(); p.cds = {}; p.mp = 1e6; mob.x = 214; mob.y = 200;
  const cast = W.act({ t: "sk", id: sk[0], a: X.aimIdx(1, 0) }); c = seenCalls();
  assert.ok(cast.ok && c.some((x) => x[0] === "skill" && x[1] === sk[0] && x[2] === sk[1]), `a real cast reaches skill with its cost: ${JSON.stringify(c)}`);
  F.num = { mp: 0.5 }; assert.equal(X.skMp(p, X.SKILL[sk[0]]), Math.ceil(sk[1] / 2), "num(mp) halves the cost"); F.num = null;
  // miti / hurt / lethal / wound: factor floor ×0.6, flat absorb ≤ 20 % mhp, block = 0 and the dodge cue, a save
  const st = X.stats(p), hurt = (raw = Math.round(st.mhp * 0.5 + st.def)) => { p.hp = st.mhp; S.seed = 4242; calls.length = 0; X.hurtPlayer(S, rt, p, raw, null); return st.mhp - p.hp; };
  const plain = hurt(); c = seenCalls();
  assert.deepEqual(c.map((x) => x[0]), ["miti", "hurt"]); assert.equal(c[0][1], plain, "miti sees the damage after armour"); assert.equal(c[1][1], plain);
  F.f = 0.1; assert.ok(Math.abs(hurt() / plain - X.PFX_CAP.miti) < 0.01, "factors floor at ×0.6"); F.f = 0;
  F.abs = 1e9; assert.equal(Math.round(plain - hurt()), Math.round(st.mhp * X.PFX_CAP.abs), "absorb is at most 20 % of max HP"); F.abs = 0;
  rt.ev.length = 0; F.block = 1; assert.equal(hurt(), 0); assert.ok(rt.ev.some((e) => e[0] === "h" && e[1] === p.eid && e[2] === 0 && e[3] === 3), "a blocked blow shows the dodge cue"); F.block = 0; seenCalls();
  p.hp = 5; F.save = 1; X.hurtPlayer(S, rt, p, 1e6, null); c = seenCalls();
  assert.ok(!p.dead && p.hp === 7 && c.some((x) => x === "lethal"), "lethal: kept alive"); F.save = 0;
  p.hp = 5; X.hurtPlayer(S, rt, p, 1e6, null); assert.ok(p.dead, "without it, it falls"); assert.ok(calls.includes("lethal")); seenCalls();
  p.dead = false; p.hp = 5; F.save = 1; X.wound(S, rt, p, 100); assert.ok(!p.dead && p.hp === 7, "wound asks lethal too"); F.save = 0; p.hp = 1e6; seenCalls();
  // dash / evade
  p.dashAt = 0; p.stag = 0; const dc = W.act({ t: "dash", a: 0 }); c = seenCalls();
  assert.ok(dc.ok && c.some((x) => x[0] === "dash"), "dash"); F.num = { dashCd: 0.25 };
  assert.ok(W.step().me[W.step().me.length - 1] >= 0, "the dash left is on the wire"); F.num = null;
  p.dodge = S.now + 5000; X.dodged(S, rt, p); c = seenCalls(); assert.deepEqual(c.filter((x) => x[0] === "evade"), [["evade", "dash"]]); p.dodge = 0;
  F.eva = 1e6; p.stc = null; X.deriveStats(p); seenCalls(); assert.ok(X.evadeBlow(S, rt, p)); c = seenCalls(); assert.deepEqual(c.filter((x) => x[0] === "evade"), [["evade", "eva"]]); F.eva = 0; p.stc = null;
  // tick: once a second, calm after 5 s
  for (const o of rt.mobs) { o.dead = true; o.respAt = W.now + 1e12; }   // (nothing hits back from here on)
  p.hitAt = 0; p.regenAt = 0; W.step(); c = seenCalls(); assert.ok(c.some((x) => x[0] === "tick" && x[1] === true), "a tick, calm");
  p.hitAt = W.now; p.regenAt = 0; W.step(); c = seenCalls(); assert.ok(c.some((x) => x[0] === "tick" && x[1] === false), "a tick, not calm");
  // status: refused, or shortened
  F.sf = 0; X.afflict(S, p, "burn", 100); assert.equal(p.burn, null, "refused"); F.sf = 1; X.afflict(S, p, "burn", 100); const full = p.burn.until - S.now; p.burn = null;
  F.sf = 0.5; X.afflict(S, p, "burn", 100); assert.ok(Math.abs((p.burn.until - S.now) / full - 0.5) < 0.02, "shortened"); F.sf = undefined; p.burn = null; seenCalls();
  // pot: a real potion
  p.ch.inv.push({ id: "hp_s", n: 9 }); p.hp = 1; F.pot = 3; calls.length = 0;
  const hp0 = p.hp; assert.ok(W.act({ t: "use", id: "hp_s" }).ok); c = seenCalls();
  const heal = p.hp - hp0, amt = c.find((x) => x[0] === "pot")[1]; assert.ok(Math.abs(heal - Math.min(3 * amt, X.stats(p).mhp - hp0)) <= 1, `the potion heals ×3: ${heal} vs ${amt}`); F.pot = 0; p.hp = 1e6;
  // num: the named numbers
  F.num = { loss: 0.5, recall: 0.5, pet: 0.5, rest: 2 };
  p.ch.xp = 1e9; assert.equal(X.deathLoss(p.ch, p), Math.floor(X.deathLoss(p.ch) * 0.5), "mercy-style halving of the xp lost"); assert.equal(X.deathLoss(p.ch), X.deathLoss(p.ch, null), "without p it is as before");
  p.ch.inv.push({ id: "recall", n: 2 }); p.recall = null; W.act({ t: "use", id: "recall" }); assert.equal(p.recall.at - W.now, 1000, "the recall cast halves"); p.recall = null; F.num = null;
  // stat and the attack-interval floor
  const s0 = X.stats(p); F.atk = 2; assert.equal(X.stats(p).atk, s0.atk * 2); F.atk = 0;
  F.iv = 0.1; const s1 = X.stats(p), want = Math.max(Math.round(s0.acd * X.PFX_CAP.iv), Math.min(s0.acd, Math.round(s0.arm.cd * X.PFX_CAP.acd))); assert.equal(s1.acd, want, "intervals floor at ×0.8 and 45 % of the weapon's"); F.iv = 0;
  // loot: the caps (xp +15, gold +100 less the static gold, one stone), and a real kill's xp
  const lootRun = () => X.pfxLoot(S, rt, p, mob, "drop");
  F.xp = 80; F.gold = 500; F.stone = 4; let r = X.pfxLoot(S, rt, p, mob, "xp");
  assert.equal(r.xp, 15); assert.equal(r.gold, 100); assert.equal(r.stone, 1);
  W.wear("ring1", "r_3", "greed", 100); r = lootRun(); assert.equal(r.gold, 40, "황금손의 60 + the rest = at most 100"); p.ch.eq.ring1 = null; p.stc = null;
  const fat = Object.keys(X.MOBS).filter((k) => !X.MOBS[k].chest && !X.MOBS[k].boss && !X.MOBS[k].still).sort((a, b) => X.MOBS[b].xp - X.MOBS[a].xp)[0];
  const kill = (xp) => { F.xp = xp; p.gain.length = 0; const m = W.mob(fat, 240, 220, { hp: 1 }); X.hurtMob(S, rt, m, p, 50, true); return p.gain.find((g) => g[0] === "xp")[1]; };
  const x0 = kill(0), x15 = kill(15); assert.ok(x15 > x0 && Math.abs(x15 / x0 - 1.15) < 0.05, `a kill's xp ×1.15: ${x0} → ${x15}`); F.xp = 0; F.gold = 0; F.stone = 0;
  // the heal budget, the ICD and the counters of p.pc, and what a map change / a fall resets
  p.hp = 1; const st2 = X.stats(p); S.now = 5_000_000;
  const h1 = X.pfxHeal(S, p, st2, 1e9); assert.equal(h1, st2.mhp * X.PFX_CAP.heal); assert.equal(X.pfxHeal(S, p, st2, 1e9), 0, "8 % a second, no more"); S.now += 1000; assert.ok(X.pfxHeal(S, p, st2, 1e9) > 0, "a new second"); p.hp = 1e6;
  assert.ok(X.pfxIcd(S, p, "zz", 1000)); assert.ok(!X.pfxIcd(S, p, "zz", 1000)); S.now += 1000; assert.ok(X.pfxIcd(S, p, "zz", 1000));
  assert.equal(X.pfxStack(p, "zz", 1, 3), 1); X.pfxStack(p, "zz", 5, 3); assert.equal(X.pfxStack(p, "zz", 0), 3, "stacks cap");
  X.pfxPc(p).t.zz = 9; X.pfxPc(p).v.zz = { a: 1 }; X.pfxReset(p);
  assert.deepEqual([X.pfxPc(p).n, X.pfxPc(p).t, X.pfxPc(p).v], [{}, {}, {}]); assert.ok(X.pfxPc(p).cd.zz > 0, "a cooldown stamp survives a reset (no cheating a 6-minute ICD through a gate)");
  assert.ok(!JSON.stringify(L.exportChar(S, W.PID)).includes('"pc"'), "p.pc is never saved");
  S.now = W.now;
  // chance helper caps LUK at ×1.5
  let n1 = 0; S.seed = 3; for (let i = 0; i < 4000; i++) if (X.pfxChance(S, { proc: 9 }, 0.2)) n1++; assert.ok(Math.abs(n1 / 4000 - 0.3) < 0.03, `proc ×1.5 at most: ${n1 / 4000}`);
}
// a retired power loads inert; a power with no PFX_FN entry is harmless; the table check passes with the stub in place
{
  const W = world("off"), p = W.p;
  W.wear("weapon", "w_warrior_3", "zz"); assert.ok(X.deriveStats(p).pfx.hit.length === 1);
  X.PFX.zz.off = 1; p.stc = null; assert.equal(X.deriveStats(p).pfx.hit.length, 0, "off: inert"); assert.equal(X.stats(p).lg.zz, 1, "(the piece still holds it)"); delete X.PFX.zz.off;
  W.wear("weapon", "w_warrior_3", "chain"); assert.equal(X.deriveStats(p).pfx.blow.length, 1);
}

// ── 5. old sheets: a power on a piece of any type stays; an unknown one is dropped; a unique is unchanged
{
  const raw = (id, o = {}) => ({ id, q: 3, enh: 0, af: [], sk: 0, ru: [], il: 90, ...o });
  const old = L.newChar("옛사람", []);
  old.eq.ring1 = raw("r_3", { lg: "giant" }); old.eq.helm = raw("h_3", { lg: "giant" }); old.eq.gloves = raw("g_3", { lg: "gone" }); old.eq.boots = raw("b_3", { q: 5, lg: "echo" });
  const ch = X.migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(ch.eq.ring1.lg, "giant"); assert.equal(ch.eq.helm.lg, "giant", "a 거인 사냥꾼의 helm is still valid (giant rolls on W R G only)"); assert.equal(ch.eq.gloves.lg, undefined, "an unknown power is dropped");
  assert.equal(ch.eq.boots.q, 5); assert.equal(ch.eq.boots.lg, "echo", "a unique keeps its power");
  const W = world("legacy"), p = W.p;
  p.ch.eq = { weapon: p.ch.eq.weapon, ring1: ch.eq.ring1, helm: ch.eq.helm, boots: ch.eq.boots }; p.stc = null;
  const st = X.stats(p);
  assert.deepEqual(Object.keys(st.lg), ["giant", "echo"], "slot order: helm, then boots");
  assert.deepEqual(st.lgOff, ["ring1"], "two giants: the helm is earlier at the same level"); assert.ok(st.pfx.mul.length === 1 && st.pfx.skill.length === 1, "and they work");
  const mob = W.mob("twinhare", 230, 200, { el: 1 });
  const dm = (opt) => { const hp = mob.hp; W.S.seed = 11; X.hurtMob(W.S, W.rt, mob, p, 40, true, opt); return hp - mob.hp; };
  const withGiant = dm(); delete p.ch.eq.helm.lg; delete p.ch.eq.ring1.lg; p.stc = null; const without = dm();
  assert.ok(Math.abs(withGiant / without - 1.3) < 0.01, `giant on an elite: +30 % (${withGiant / without})`);
}

// ── 6. determinism and cost: four players, eight powers each, sixty monsters, 600 ticks
{
  const run = () => {
    const S = L.setup(); let now = 3_000_000; S.now = now; S.last = now;
    const ps = [];
    for (let i = 0; i < 4; i++) {
      const pid = "pf" + i, ch = L.hero("용사" + i, { wk: ["sword", "spear", "staff", "bow"][i], lvl: 157, migrate: true });
      L.addPlayer(S, pid, ch); const p = S.players[pid];
      L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
      const KEYS = ["chain", "nova", "haste", "giant", "echo", "greed", "thorn", "feast"], SL = ["weapon", "helm", "armor", "gloves", "boots", "ring1", "ring2", "amulet"], ID = { helm: "h_3", armor: "a_3", gloves: "g_3", boots: "b_3", ring1: "r_3", ring2: "r_3", amulet: "n_4" };
      SL.forEach((sl, j) => { const lg = KEYS[(j + i) % 8]; if (sl === "weapon") p.ch.eq.weapon.lg = lg; else p.ch.eq[sl] = { ...X.plain(ID[sl]), q: 3, il: 80 + j, lg }; });
      p.stc = null; p.x = 300 + i * 30; p.y = 300; ps.push(p);
    }
    const rt = S.maps.meadow;
    for (const o of rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
    for (let i = 0; i < 60; i++) rt.mobs.push(Object.assign(X.newMob(S, "twinhare", [0, 0, 0, 0]), { x: 250 + (i % 10) * 20, y: 260 + Math.floor(i / 10) * 20, hp: 4000 }));
    let tickMs = 0, h = 0;
    for (let t = 0; t < 600; t++) {
      for (const p of ps) { if (p.dead) { S.now = now; L.applyAction(S, p.pid, { t: "respawn" }); continue; } p.hp = Math.max(p.hp, 1); S.now = now; const a = { t: "atk", a: t % 8 }; if (L.validateAction(S, p.pid, a).ok) L.applyAction(S, p.pid, a); }
      now += 100; const t0 = performance.now(); L.tick(S, now); tickMs += performance.now() - t0;
      for (const p of ps) { const v = JSON.stringify(L.viewFor(S, p.pid), (k, x) => (k === "lgOff" ? undefined : x)); for (let i = 0; i < v.length; i += 7) h = (h * 31 + v.charCodeAt(i)) | 0; }
      L.endTick(S);
    }
    return { h, ms: tickMs / 600, mobs: rt.mobs.filter((m) => m.dead).length };
  };
  const a = run(), b = run();
  assert.equal(a.h, b.h, "the same world twice: the same snapshots"); assert.ok(a.mobs > 0, "the fight happened");
  assert.ok(a.ms < 6 && b.ms < 6, `a tick stays cheap with 32 powers worn: ${a.ms.toFixed(2)} ms`);
}
console.log("prefix: ok");
