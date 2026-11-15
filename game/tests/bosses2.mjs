// Headless test of bosses-2's two scripted bosses (docs/design/bosses-2.md §2–3, §7): 망치 갯가재 walks in as the coast's
// field boss, 혈루 왕도마뱀 stands in its mesa lair; each runs every pattern of its script, goes through its phases (adds,
// forced marked casts, pools), its cast can be broken, it falls and leaves its own finds; the lair boss rises fresh.
// node tests/bosses2.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { MOBS, ITEMS, FIELD_BOSS, TROPHIES, ELITE, mobMax, dealMob, killMob, bsHit, SETS, DIM_CHAL, CHAL_KEYS, DIM_TOWN, T, SKILL, SKILL_ORDER, stats, atkRange, aimIdx, tierFor, rollGear, GEAR, WK_ID, checkAch, dmgBoard };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

const S = L.setup();
let now = 1_000_000;
S.now = now;
L.addPlayer(S, "p1", L.hero("시험", { wk: "sword", lvl: 160, migrate: true }));
const p = S.players.p1;
const go = (id) => { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.sendMap = true; };
let evs = [];
const step = (rt, mob, n = 1) => {
  for (let i = 0; i < n; i++) {
    // a hero who never falls, standing by the boss's home
    p.dead = false; p.hp = 1e7; p.x = mob.hx + 26; p.y = mob.hy; p.mvAt = now;
    now += 100; L.tick(S, now); for (const e of rt.ev) evs.push(e); L.endTick(S);
  }
};
const turns = (mob) => evs.filter((e) => e[0] === "bc" && e[1] === mob.id).map((e) => e[2]);
/** Fight until every pattern of the current phase has been cast (or the time runs out). */
const allPats = (rt, mob, n, what) => {
  const t0 = now;
  while (new Set(turns(mob).filter((i) => i < n)).size < n) { step(rt, mob); assert.ok(now - t0 < 240000, what + ": every pattern comes round"); }
};

// ── 망치 갯가재: the coast's field boss
assert.equal(X.FIELD_BOSS.coast, "clubshrimp");
assert.ok(X.TROPHIES.clubshrimp && X.TROPHIES.coralturtle, "its trophy, and the old one still known");
go("coast");
let rt = L.runtime(S, "coast");
for (let i = 0; i < 5 && !rt.fb; i++) { now += 100; L.tick(S, now); L.endTick(S); }
let mob = rt.mobs.find((o) => o.id === rt.fb);
assert.ok(mob && mob.k === "clubshrimp" && mob.el === 2, "it walks in as the field boss");
assert.equal(X.mobMax(mob), Math.round(4400 * X.ELITE[2].hp), "its health: the row × 14");
for (const o of rt.mobs) if (o !== mob) { o.dead = true; o.respAt = now + 1e12; }
evs = [];
const P1 = X.MOBS.clubshrimp.script.pats.length;
allPats(rt, mob, P1, "clubshrimp P1");
assert.ok(turns(mob).includes(9), "its marked cast came");
const bt = new Set(evs.filter((e) => e[0] === "bt").map((e) => e[1]));
assert.ok(bt.has(0) && bt.has(2), "the donut and the marks are drawn");
assert.ok(evs.some((e) => e[0] === "t"), "punch and blast rings");
// under half health: 갑각 균열
mob.hp = Math.floor(X.mobMax(mob) * 0.49); evs = [];
step(rt, mob, 2);
assert.equal(mob.bs.ph, 2, "phase 2 under half");
allPats(rt, mob, X.MOBS.clubshrimp.script.phases[0].pats.length, "clubshrimp P2");
// its cast broken: 4 % of its health dealt while it gathers
while (!mob.cast) step(rt, mob);
evs = [];
X.dealMob(S, rt, mob, p, Math.ceil(mob.cast.need) + 1, 0);
assert.ok(rt.ev.some((e) => e[0] === "bc" && e[1] === mob.id && e[2] === 8) && mob.stag > now && !mob.cast, "the cast broke");
// it falls: the field boss's count, its claw for the looter, back in FB_RESP
const fb0 = p.ch.cnt.fb;
mob.hp = 10;
assert.ok(X.dealMob(S, rt, mob, p, 1e6, 0), "it falls");
assert.equal(p.ch.cnt.fb, fb0 + 1, "counted as a field boss");
assert.equal(rt.fb, 0);
const claw = rt.drops.find((d) => d.it === "mat_clubclaw" && d.own === "p1");
assert.ok(claw && claw.n >= 1 && claw.n <= 3, "its claw drops, 1–3");

// ── 혈루 왕도마뱀: mesa's lair boss
go("mesa");
rt = L.runtime(S, "mesa");
now += 100; L.tick(S, now); L.endTick(S);
mob = rt.mobs.find((o) => o.k === "bloodhorn");
assert.ok(mob && !mob.temp && X.MOBS.bloodhorn.boss, "it stands in its lair");
assert.equal(X.mobMax(mob), 67200);
assert.equal(X.FIELD_BOSS.mesa, "crownpeacock", "mesa keeps its own field boss");
for (const o of rt.mobs) if (o !== mob) { o.dead = true; o.respAt = now + 1e12; }
evs = [];
allPats(rt, mob, X.MOBS.bloodhorn.script.pats.length, "bloodhorn P1");
assert.ok(evs.some((e) => e[0] === "bt" && e[1] === 1), "the tail sweep is a cone");
assert.ok(rt.pools.length || evs.some((e) => e[0] === "g"), "the blood jet leaves burn pools");
// under 60 %: phase 2 opens with the marked cast, then crystals sprout
mob.hp = Math.floor(X.mobMax(mob) * 0.59); mob.cast = null; evs = [];
step(rt, mob, 2);
assert.equal(mob.bs.ph, 2);
while (!turns(mob).includes(9)) step(rt, mob);
assert.ok(mob.cast, "phase 2 opens with 혈루 대분출");
// not broken: everyone in the fight pays and it grows angrier
const fury = mob.bs.fury;
while (mob.cast) step(rt, mob);
assert.ok(turns(mob).includes(7) && mob.bs.fury === fury + 1, "the cast went off");
allPats(rt, mob, X.MOBS.bloodhorn.script.phases[0].pats.length, "bloodhorn P2");
const adds = rt.mobs.filter((o) => o.add === mob.id && !o.dead);
assert.ok(adds.length >= 1 && adds.length <= 3 && adds.every((o) => o.k === "bloodshard"), "its crystals sprout, three at most");
// under 25 %: 혈루 폭주 — a burn pool after every pattern
mob.hp = Math.floor(X.mobMax(mob) * 0.24); evs = [];
step(rt, mob, 2);
assert.equal(mob.bs.ph, 3);
while (mob.cast) X.dealMob(S, rt, mob, p, Math.ceil(mob.cast.need) + 1, 0);
const g0 = evs.filter((e) => e[0] === "g").length, n0 = turns(mob).filter((i) => i < 7).length;
while (turns(mob).filter((i) => i < 7).length < n0 + 3) step(rt, mob);
step(rt, mob, 6);
assert.ok(evs.filter((e) => e[0] === "g").length >= g0 + 3, "every pattern leaves a pool");
// it falls: its tears for the looter; it rises again fresh after `resp`
mob.hp = 10; mob.cast = null;
assert.ok(X.dealMob(S, rt, mob, p, 1e6, 0), "it falls");
const tear = rt.drops.find((d) => d.it === "mat_bloodtear" && d.own === "p1");
assert.ok(tear && tear.n >= 1 && tear.n <= 3, "피눈물 결정 drops, 1–3");
assert.ok(rt.drops.filter((d) => d.own === "p1" && d.g).length >= 1, "and boss gear");
now = mob.respAt + 100; p.x = mob.hx + 600; L.tick(S, now); L.endTick(S);
assert.ok(!mob.dead && !mob.bs && !mob.cast, "risen again, its last fight forgotten");

// the unique weapons are top-tier, and a forced roll makes them legendary
for (const [k, id, wk] of [["bloodhorn", "w_bloodcrown", "spear"], ["clubshrimp", "w_cavhammer", "hammer"]]) {
  const it = X.ITEMS[id];
  assert.ok(it.type === "weapon" && it.wk === wk && it.tier === 5, id);
  assert.ok(X.MOBS[k].drops.some(([d, c]) => d === id && c === 0.03), k + ": its weapon at 3 %");
}
console.log("bosses2: 망치 갯가재 (coast field boss) and 혈루 왕도마뱀 (mesa lair) — patterns, phases, cast, adds, drops ok");

// ── the weekly raids (§4–5, §7): 밤장막 박쥐군주 (tier 25) and 꽃무덤 고래 (tier 50) in the boss challenge
const [OBX, OBY] = [X.DIM_TOWN.keeper[0] * X.T + 8, (X.DIM_TOWN.keeper[1] - 1) * X.T + 10];
const WKS = ["spear", "staff", "sword", "dagger"];
/** A fresh world with `n` heroes of world tier `t` (its gear, or none) in one party, by the obelisk. */
function raidParty(t, gear = true, n = 4) {
  const W = L.setup(); W.now = W.last = 5_000_000;
  const pids = WKS.slice(0, n).map((_, i) => "r" + i);
  pids.forEach((pid, i) => {
    const ch = L.hero("공대" + i, { wk: WKS[i], lvl: Math.min(197, 4 * t - 3), migrate: true });
    if (gear) {
      const tier = X.tierFor(t);
      ch.eq.weapon = X.rollGear(W, `w_${X.WK_ID[WKS[i]]}_${tier}`, 1, t);
      for (const s of ["helm", "armor", "gloves", "boots"]) ch.eq[s] = X.rollGear(W, `${X.GEAR[s].pre}_${tier}`, 1, t);
      ch.inv.push({ id: "hp_l", n: 80 }, { id: "mp_l", n: 50 });
    }
    ch.map = "town"; ch.x = OBX; ch.y = OBY;
    L.addPlayer(W, pid, ch);
  });
  const ps = pids.map((pid) => W.players[pid]);
  const act = (pid, a) => { const v = L.validateAction(W, pid, a); if (v.ok) L.applyAction(W, pid, a); return v; };
  for (const pid of pids.slice(1)) { assert.ok(act(pids[0], { t: "pinv", e: W.players[pid].eid }).ok); assert.ok(act(pid, { t: "pacc" }).ok); }
  return { W, ps, pids, act };
}
function raidOpen(R, k) {
  const { W, ps, pids, act } = R, v = act(pids[0], { t: "dim_open", boss: k });
  assert.ok(v.ok, v.error);
  if (ps.length > 1) { const rc = W.parties[ps[0].party].rc; for (const pid of pids.slice(1)) act(pid, { t: "dim_ready", id: rc.id, ok: 1 }); }
  const dim = W.dims[ps[0].map];
  assert.ok(dim && dim.chal && dim.chal.k === k && dim.state === "boss", k + ": the challenge opens on it");
  return dim;
}

/** The script, its phases and patterns, the stagger window, the adds, the enrage and the rewards, with heroes who never fall. */
function scripted(k, t) {
  const R = raidParty(t), { W, ps } = R, dim = raidOpen(R, k), rt = dim.rt, B = X.DIM_CHAL.bosses[k];
  const mob = rt.mobs.find((m) => m.id === dim.boss), max = X.mobMax(mob);
  assert.deepEqual([dim.map.w, dim.map.h], [B.w || X.DIM_CHAL.w, B.h || X.DIM_CHAL.h], k + ": its arena");
  ps.forEach((o, j) => { o.x = mob.x + 28 * Math.cos(j * 1.57); o.y = mob.y + 20 * Math.sin(j * 1.57); });
  let ev = [];
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { for (const o of ps) { o.dead = false; o.hp = 1e7; } W.now += 100; L.tick(W, W.now); ev.push(...rt.ev); L.endTick(W); } };
  const turns = () => ev.filter((e) => e[0] === "bc" && e[1] === mob.id).map((e) => e[2]);
  const allPats = (n, what) => { const t0 = W.now; while (new Set(turns().filter((i) => i < n)).size < n) { tick(); assert.ok(W.now - t0 < 300000, what + ": every pattern comes round"); } };
  const hit = (n) => { const hp = mob.hp; X.dealMob(W, rt, mob, ps[0], n * mob.hk, 0); return hp - mob.hp; };
  const breakCast = () => { while (!mob.cast) tick(); X.dealMob(W, rt, mob, ps[0], Math.ceil(mob.cast.need * mob.hk) + 10, 0); assert.ok(mob.stag > W.now && !mob.cast, k + ": the cast broke"); };
  allPats(B.pats.length, k + " P1");
  assert.ok(turns().includes(9), k + ": its marked cast");
  // broken: stunned, and +30 % damage taken while it reels
  breakCast();
  const vul = hit(1000); mob.stag = 0; const plain = hit(1000);
  assert.ok(Math.abs(vul - 1300) <= 2 && Math.abs(plain - 1000) <= 2, `${k}: vuln ${vul} / ${plain}`);
  return { W, ps, dim, rt, mob, max, B, tick, turns, allPats, hit, breakCast, ev: () => ev, clear: () => { ev = []; } };
}
function rewards(F, k, set, weapons) {
  const { W, ps, dim, rt, mob } = F, keep = X.MOBS[k].drops;
  X.MOBS[k].drops = keep.map(([id]) => [id, 1]);   // every find at once, to see each is what it says
  mob.by = Object.fromEntries(ps.map((o) => [o.pid, 1000]));
  for (const o of ps) { o.x = mob.x; o.y = mob.y; o.dead = false; }
  X.killMob(W, rt, mob);
  X.MOBS[k].drops = keep;
  const mine = rt.drops.filter((d) => d.own === "r0" && d.g);
  assert.equal(mine.filter((d) => d.g.set === set && d.g.q === 4).length, 4, k + ": its four set pieces, each of the set");
  for (const id of weapons) assert.ok(mine.some((d) => d.g.id === id && d.g.q === 3), k + ": " + id + " legendary");
  for (let i = 0; i < 5; i++) F.tick();
  const big = X.DIM_CHAL.bosses[k].big, bit = 1 << X.CHAL_KEYS.indexOf(k);
  assert.ok(ps[0].dimRes && ps[0].dimRes[4] === big.gold * dim.lv, k + ": its own weekly reward");
  assert.equal(ps[0].ch.dim.bw & bit, bit);
}

{
  // 밤장막 박쥐군주
  assert.deepEqual(X.CHAL_KEYS.slice(0, 4), ["boss", "abyssboss", "cloakbat", "bloomwhale"], "fixed challenges keep their weekly reward bits");
  const F = scripted("cloakbat", 25), { W, ps, rt, mob, max, B } = F;
  assert.ok(F.ev().some((e) => e[0] === "bt" && e[1] === 1 && e[7] === 1309), "장막 휘감기: a 150° cone");
  // 비행 under 70 %: the shared mark, bats that feed it
  mob.hp = Math.floor(max * 0.69); mob.cast = null; F.clear(); F.tick(2);
  assert.equal(mob.bs.ph, 2);
  F.allPats(B.phases[0].pats.length, "cloakbat P2");
  const bats = rt.mobs.filter((a) => a.add === mob.id && !a.dead);
  assert.ok(bats.length >= 1 && bats.length <= 4 && bats.every((a) => a.k === "nightbat"), "its bats, four at most");
  assert.ok(F.ev().some((e) => e[0] === "bt" && e[1] === 2), "the blood mark is drawn");
  const hp0 = mob.hp = Math.floor(max * 0.5); bats[0].feedAt = W.now;
  F.tick();
  assert.ok(bats[0].dead && mob.hp >= hp0 + Math.round(0.02 * max) - 1 && F.turns().includes(6), "a bat still alive after 20 s heals it 2 %");
  // the shared mark: split between everyone inside — stack on the marked hero
  const share = (n) => {
    ps.forEach((o, j) => { o.hp = X.stats(o).mhp; o.x = mob.x + (j < n ? 60 : -60 - 50 * j); o.y = mob.y; });
    const hp = ps[0].hp; X.bsHit(W, rt, mob, { h: { x: mob.x + 60, y: mob.y, r: 40, r0: 0, half: 0, share: 1 }, dmg: X.MOBS.cloakbat.atk * 5 }); return hp - ps[0].hp;
  };
  const alone = share(1), four = share(4);
  assert.ok(alone > 0 && four < alone * 0.5, `four share it: ${four} each, ${alone} alone`);
  // 장막 붕괴 under 35 %: pools round the rim for good, two cones at once
  mob.hp = Math.floor(max * 0.34); mob.cast = null; F.clear(); F.tick(2);
  assert.equal(mob.bs.ph, 3);
  assert.ok(rt.pools.filter((p) => p.until - W.now > 500000).length >= 8, "the rim's pools");
  F.allPats(B.phases[1].pats.length, "cloakbat P3");
  const cones = F.ev().filter((e) => e[0] === "bt" && e[1] === 1);
  assert.ok(cones.some((a) => cones.some((b) => b !== a && Math.abs(Math.abs(a[6] - b[6]) - 3142) <= 1 && a[2] === b[2])), "front and back cones together");
  // the hard enrage at 7:00
  F.dim.chal.engAt = W.now - B.hard; F.clear(); F.tick();
  assert.ok(F.dim.chal.hard > 0 && F.turns().includes(7), "영원한 밤");
  rewards(F, "cloakbat", "nightveil", ["w_ribbook"]);
}
{
  // 꽃무덤 고래
  const F = scripted("bloomwhale", 50), { rt, mob, max } = F;
  assert.ok(F.ev().some((e) => e[0] === "bt" && e[1] === 0 && e[4] === 110 && e[6] === 30), "심해의 노래: a donut r30–110");
  // its dive: out of reach until it lands
  F.clear(); while (!mob.dive) F.tick();
  assert.equal(F.hit(1000), 0, "not hit while it is up");
  while (mob.dive) F.tick();
  // the donut, then the in-and-out rings
  F.clear(); while (!F.ev().some((e) => e[0] === "bt" && e[1] === 0)) F.tick();
  const tr = F.ev().filter((e) => e[0] === "t").length; F.tick(17);
  assert.ok(F.ev().filter((e) => e[0] === "t").length >= tr + 5, "the rings follow the donut");
  // under 65 %: the song first, then the hagfish heads that shield it
  mob.hp = Math.floor(max * 0.64); mob.cast = null; F.clear(); F.tick(2);
  assert.equal(mob.bs.ph, 2);
  F.breakCast();
  while (!rt.mobs.some((a) => a.add === mob.id && !a.dead)) F.tick();
  const heads = rt.mobs.filter((a) => a.add === mob.id && !a.dead);
  assert.ok(heads.length >= 1 && heads.length <= 3 && heads.every((a) => a.k === "hagfishhead" && a.shield), "its heads");
  mob.stag = 0;
  assert.ok(Math.abs(F.hit(1000) - 500) <= 2, "half damage while a head lives");
  for (const a of heads) a.dead = true;
  assert.ok(Math.abs(F.hit(1000) - 1000) <= 2, "whole again with the heads down");
  // the last window at 10 %: it opens with the song
  mob.hp = Math.floor(max * 0.09); mob.cast = null; F.clear(); F.tick(2);
  assert.equal(mob.bs.ph, 5);
  while (!F.turns().includes(9)) F.tick();
  assert.ok(mob.cast, "the song at 10 %");
  mob.cast = null;
  rewards(F, "bloomwhale", "bloomgrave", ["w_whalebow", "w_bloomstaff"]);
}

/** A bot party fights it out: dodges rings and shaped telegraphs, drinks, hits adds first, else the boss. */
function botRaid(k, t, gear, n = 4) {
  const R = raidParty(t, gear, n), { W, ps, act } = R, dim = raidOpen(R, k), rt = dim.rt, t0 = W.now;
  let deaths = 0;
  const away = (p, x, y) => { const d = Math.hypot(p.x - x, p.y - y) || 1, s = X.stats(p).spd * 0.1; act(p.pid, { t: "mv", x: p.x + ((p.x - x) / d) * s, y: p.y + ((p.y - y) / d) * s }); };
  for (let i = 0; i < 7000 && dim.state === "boss"; i++) {
    const boss = rt.mobs.find((m) => m.id === dim.boss), shapes = ((boss && boss.bs && boss.bs.q) || []).filter((s) => s.f === "hit" && !s.h.pid);
    for (const p of ps) {
      if (p.map !== dim.id) continue;
      if (p.dead) { act(p.pid, { t: "respawn" }); continue; }
      const st = X.stats(p);
      if (p.hp < st.mhp * 0.45) { const pot = p.ch.inv.find((s) => X.ITEMS[s.id] && X.ITEMS[s.id].heal); if (pot) act(p.pid, { t: "use", id: pot.id }); }
      if (p.mp < st.mmp * 0.2) { const pot = p.ch.inv.find((s) => X.ITEMS[s.id] && X.ITEMS[s.id].mp); if (pot) act(p.pid, { t: "use", id: pot.id }); }
      const ring = rt.tele.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + 10);
      if (ring) { away(p, ring.x, ring.y); continue; }
      // a shared mark: everyone onto the marked hero; a spread mark: away from the nearest friend
      const marks = ((boss && boss.bs && boss.bs.q) || []).filter((s) => s.f === "hit" && s.h.pid), mk = marks.find((s) => s.h.share), on = marks.find((s) => !s.h.share && s.h.pid === p.pid);
      const mv = mk && W.players[mk.h.pid];
      if (mv && mv !== p && !mv.dead && Math.hypot(mv.x - p.x, mv.y - p.y) > 16) { const d = Math.hypot(mv.x - p.x, mv.y - p.y), s = X.stats(p).spd * 0.1; act(p.pid, { t: "mv", x: p.x + ((mv.x - p.x) / d) * s, y: p.y + ((mv.y - p.y) / d) * s }); continue; }
      const near = on && ps.find((o) => o !== p && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 2 * on.h.r + 6);
      if (near) { away(p, near.x, near.y); continue; }
      const sh = shapes.find((s) => Math.hypot(s.h.x - p.x, s.h.y - p.y) < s.h.r + 10);
      if (sh) { away(p, sh.h.x, sh.h.y); continue; }
      let tgt = null, bd = Infinity;
      for (const m of rt.mobs) { if (m.dead || m.dive) continue; const ds = Math.hypot(m.x - p.x, m.y - p.y) - (m.add ? 200 : 0); if (ds < bd) { bd = ds; tgt = m; } }
      if (!tgt) continue;
      const dd = Math.hypot(tgt.x - p.x, tgt.y - p.y), aim = X.aimIdx(tgt.x - p.x, tgt.y - p.y);
      if (dd > X.atkRange(p) * 0.85) { const s = st.spd * 0.1; act(p.pid, { t: "mv", x: p.x + ((tgt.x - p.x) / dd) * s, y: p.y + ((tgt.y - p.y) / dd) * s, a: aim }); continue; }
      let cast = false;
      for (let j = X.SKILL_ORDER.length - 1; j >= 0 && !cast; j--) { const id = X.SKILL_ORDER[j]; if (X.SKILL[id].kind !== "p" && act(p.pid, { t: "sk", id, a: aim }).ok) cast = true; }
      if (!cast) act(p.pid, { t: "atk", a: aim });
    }
    W.now += 100; L.tick(W, W.now); L.endTick(W);
    if (process.env.TRACE && i % +process.env.TRACE === 0 && boss) console.log(`   ${k} t=${(i / 600).toFixed(1)}m hp ${(boss.hp / X.mobMax(boss) * 100).toFixed(0)}% ph ${boss.bs ? boss.bs.ph : 0} n ${boss.bs ? boss.bs.n : 0} alive ${ps.filter((p) => !p.dead).length} hp ${ps.map((p) => Math.round(p.hp)).join(",")} adds ${rt.mobs.filter((m) => m.add && !m.dead).length}`);
    for (const p of ps) { if (p.dead && !p.wasDead) deaths++; p.wasDead = p.dead; }
  }
  const boss = rt.mobs.find((m) => m.id === dim.boss);
  return { state: dim.state, min: (W.now - t0) / 60000, tries: dim.chal.tries, deaths, fury: dim.chal.fury, left: boss && !boss.dead ? boss.hp / X.mobMax(boss) : 0 };
}
for (const [k, t] of [["cloakbat", 25], ["bloomwhale", 50]]) {
  const win = botRaid(k, t, true), lose = botRaid(k, t, false, 2);
  console.log(`  ${k}: 4 geared bots ${win.state} in ${win.min.toFixed(1)} min (${win.tries} tries, ${win.deaths} deaths, fury ${win.fury}, ${(win.left * 100).toFixed(0)} % left); 2 bare bots ${lose.state} (${(lose.left * 100).toFixed(0)} % left, ${lose.tries} tries)`);
  if (process.env.NOCLEAR) continue;
  assert.ok(win.state === "clear" && win.min >= 2.5, `${k}: four geared heroes win, not in a blink (${win.min.toFixed(1)} min)`);
  assert.ok(lose.state !== "clear", `${k}: two bare heroes lose`);
}
// server-first kills: a first personal kill queues [name, kind] once for room.ts; the confirmed notice reaches the chat
{ const p = S.players.p1; L.takeFirsts(S); p.ch.mk.cloakbat = Math.max(1, p.ch.mk.cloakbat | 0); p.ch.ach = p.ch.ach.filter((a) => a !== "cloakbat"); X.checkAch(S, p);
  assert.deepEqual(L.takeFirsts(S), [[p.ch.name, "cloakbat"]], "queued once"); X.checkAch(S, p); assert.deepEqual(L.takeFirsts(S), [], "not again");
  const n = S.chat.length; assert.ok(L.firstNotice(S, p.ch.name, "cloakbat") && S.chat.length === n + 1 && /서버 최초/.test(S.chat[n].m), "announced");
  assert.equal(L.firstNotice(S, "x", "slime"), false, "only the listed bosses"); }
// the damage ranking after a boss falls to two or more
{ L.addPlayer(S, "p2", L.hero("둘째", { wk: "bow", lvl: 160, migrate: true })); const p1 = S.players.p1, p2 = S.players.p2; p2.map = p1.map; p1.toast = []; p2.toast = [];
  X.dmgBoard(S, S.maps[p1.map], { p1: 300, p2: 100 }); assert.equal(p1.ch.cnt.mvp, 1, "the top hitter counted");
  assert.ok(p2.toast.some((m) => m.includes("피해 기여도 — 1. 시험 75% · 2. 둘째 25%")), JSON.stringify(p2.toast));
  p1.toast = []; X.dmgBoard(S, S.maps[p1.map], { p1: 300 }); assert.equal(p1.toast.length, 0, "alone: no board"); L.removePlayer(S, "p2"); }
console.log("bosses2: 밤장막 박쥐군주 and 꽃무덤 고래 (weekly raids) — phases, shapes, shared mark, feeding bats, shielding heads, enrage, rewards, bot win/lose ok");
