// Raid difficulty steps (31-raids-field.js RAID_DIF, 64-dim.js dimDifMob): 보통 / 어려움 / 악몽 keep the raid's level and
// harden its monsters; 헬 wants Lv.200, ignores the raid's window and scales every monster to the top tier. node tests/raiddif.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { RAID_DIF, HELL_TIER, DIM_TOWN, dimHell, dimReward, MOBS, IL_ANCIENT, MAXLV, rewardGear, gearBaseValue, gearName, gearReq, migrate, plain };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16;
const [OBX, OBY] = [X.DIM_TOWN.keeper[0] * T + 8, (X.DIM_TOWN.keeper[1] - 1) * T + 10];
let now = 2_281_000;
const world = () => { const S = L.setup(); S.now = now; S.last = now; return S; };
const hero = (S, pid, name, lvl) => { const ch = L.hero(name, { wk: "sword", lvl, migrate: true }); ch.map = "town"; ch.x = OBX; ch.y = OBY; L.addPlayer(S, pid, ch); return S.players[pid]; };
const act = (S, pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
/** Open `raid` at `dif` alone; the run's floor-1 monsters (not chests) and the run. */
function run(lvl, raid, dif) {
  const S = world(); const p = hero(S, "pa", "가장", lvl);
  L.tick(S, now);
  const v = act(S, "pa", { t: "dim_open", raid, dif });
  if (!v.ok) return { err: v.error };
  const dim = S.dims[p.map];
  return { dim, mobs: dim.rt.mobs.filter((m) => !X.MOBS[m.k].chest), view: L.viewFor(S, "pa") };
}
const mean = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;

assert.equal(X.RAID_DIF.length, 4);
assert.deepEqual(L.defs().dim.difs.map((d) => d[0]), ["보통", "어려움", "악몽", "헬"]);
assert.match(act(world(), "x", { t: "dim_open", dif: 9 }).error || "", /난이도|캐릭터|없/);

// 어려움 / 악몽: the same monsters at the raid's level, tougher by the step
const base = run(40, "knotwidow", 0), hard = run(40, "knotwidow", 1), night = run(40, "knotwidow", 2);
for (const r of [base, hard, night]) assert.ok(r.dim && r.mobs.length, r.err);
assert.equal(hard.dim.lv, base.dim.lv, "the step keeps the raid's level");
assert.deepEqual(hard.mobs.map((m) => m.k), base.mobs.map((m) => m.k), "same seed, same monsters");
const hk = (r) => mean(r.mobs, (m) => m.hk), ak = (r) => mean(r.mobs, (m) => m.ak);
assert.ok(Math.abs(hk(hard) / hk(base) - X.RAID_DIF[1].hp) < 1e-6 && Math.abs(ak(night) / ak(base) - X.RAID_DIF[2].atk) < 1e-6, "hp / atk × the step");
assert.equal(hard.view.dim.at(-1), 1, "the wire carries the step after the raid key");
assert.equal(hard.view.dim.at(-2), "knotwidow");

// 헬: Lv.200 only, any raid (no field window), scaled to the top tier
assert.match(run(199, "knotwidow", 3).err, /Lv\.200/);
assert.equal(run(200, "knotwidow", 0).dim.lv, Math.floor((60 + 3) / 4), "보통 keeps the window: a Lv.200 hero gets its ceiling");
assert.match(run(39, "knotwidow", 0).err, /Lv[.]40/, "and its floor");
const hell = run(200, "knotwidow", 3);
assert.ok(hell.dim, hell.err);
assert.equal(hell.dim.lv, X.HELL_TIER);
assert.ok(hell.mobs.every((m) => m.ecoLv === X.HELL_TIER), "drops and kill pay at the top tier");
const low = X.dimHell(base.mobs[0].k);
assert.ok(low.hp > 3 && low.atk > 2, `a Lv.40 raid monster is raised to the top tier (hp ×${low.hp.toFixed(1)}, atk ×${low.atk.toFixed(1)})`);
assert.ok(mean(hell.mobs, (m) => m.hp) > mean(night.mobs, (m) => m.hp) * 3, "헬 in the forest is far tougher than its 악몽 (hk is relative to each pool, so compare the health)");
const top = Object.keys(X.MOBS).find((k) => !X.MOBS[k].boss && !X.MOBS[k].chest && X.MOBS[k].lv === X.HELL_TIER + 1);
if (top) assert.equal(X.dimHell(top).hp, 1, "a top-tier monster is never lowered");
assert.ok(run(200, "wickregent", 3).dim, "헬 opens on the underground raid too");

// 헬: one entry a day per raid (owner 2026-11-21); the day turns at 06:00 KST
{
  const S = world(), p = hero(S, "pa", "하루", 200);
  L.tick(S, now);
  assert.ok(act(S, "pa", { t: "dim_open", raid: "knotwidow", dif: 3 }).ok);
  // the entry is on the sheet: a fresh world (a reconnect, a reboot) still bars it today
  const again = (at) => { const S2 = world(); S2.now = at; const ch = JSON.parse(JSON.stringify(p.ch)); ch.map = "town"; ch.x = OBX; ch.y = OBY; L.addPlayer(S2, "pb", ch); return S2; };
  const keep = now, S2 = again(now);
  assert.match(act(S2, "pb", { t: "dim_open", raid: "knotwidow", dif: 3 }).error || "", /오늘은 이 레이드의 헬/);
  assert.ok(act(again(now), "pb", { t: "dim_open", raid: "wickregent", dif: 3 }).ok, "another raid's 헬 is its own entry");
  assert.ok(act(again(now), "pb", { t: "dim_open", raid: "wickregent", dif: 2 }).ok, "악몽 has no daily limit");
  now += 86_400_000;
  const v = act(again(now), "pb", { t: "dim_open", raid: "knotwidow", dif: 3 });
  assert.ok(v.ok, v.error);
  now = keep;
}
// 헬's rare 고대 piece: a top-tier base at item level 210, worn from Lv.200, stronger than a 200 piece
assert.ok(X.RAID_DIF[3].ancient > 0 && X.RAID_DIF[3].ancient < 0.1 && !X.RAID_DIF[2].ancient);
{
  const S = world(), p = hero(S, "pa", "고대", 200);
  X.rewardGear(S, p, 0, 2, X.IL_ANCIENT);
  const g = p.ch.inv.at(-1);
  assert.equal(g.il, 210); assert.ok(g.q >= 2); assert.match(g.id, /_10$/);
  assert.equal(X.gearReq(g), 200);
  assert.match(X.gearName(g), /^<고대> /);
  const old = { ...X.plain(g.id), il: 200 }, stat = Object.keys(X.MOBS && L.defs().items[g.id].base)[0];
  assert.ok(X.gearBaseValue(g, stat) > X.gearBaseValue(old, stat), "210 beats 200");
  const ch = L.hero("저장", { lvl: 200 }); ch.inv = [g];
  const S2 = L.setup(); L.addPlayer(S2, "s", JSON.parse(JSON.stringify(ch)));
  assert.equal(S2.players.s.ch.inv[0].il, 210, "a saved 고대 piece keeps its level");
}
console.log("raiddif: ok");
