// Raid difficulty steps (31-raids-field.js RAID_DIF, 64-dim.js dimDifMob): 보통 / 어려움 / 악몽 keep the raid's level and
// harden its monsters; 헬 wants Lv.200, ignores the field window and scales every monster to the top tier. node tests/raiddif.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { RAID_DIF, HELL_TIER, DIM_TOWN, dimHell, dimReward, MOBS };\n";
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
const base = run(40, "forest", 0), hard = run(40, "forest", 1), night = run(40, "forest", 2);
for (const r of [base, hard, night]) assert.ok(r.dim && r.mobs.length, r.err);
assert.equal(hard.dim.lv, base.dim.lv, "the step keeps the raid's level");
assert.deepEqual(hard.mobs.map((m) => m.k), base.mobs.map((m) => m.k), "same seed, same monsters");
const hk = (r) => mean(r.mobs, (m) => m.hk), ak = (r) => mean(r.mobs, (m) => m.ak);
assert.ok(Math.abs(hk(hard) / hk(base) - X.RAID_DIF[1].hp) < 1e-6 && Math.abs(ak(night) / ak(base) - X.RAID_DIF[2].atk) < 1e-6, "hp / atk × the step");
assert.equal(hard.view.dim.at(-1), 1, "the wire carries the step after the raid key");
assert.equal(hard.view.dim.at(-2), "forest");

// 헬: Lv.200 only, any raid (no field window), scaled to the top tier
assert.match(run(199, "forest", 3).err, /Lv\.200/);
assert.match(run(200, "forest", 0).err, /Lv\.37~60/, "보통 keeps the window");
const hell = run(200, "forest", 3);
assert.ok(hell.dim, hell.err);
assert.equal(hell.dim.lv, X.HELL_TIER);
assert.ok(hell.mobs.every((m) => m.ecoLv === X.HELL_TIER), "drops and kill pay at the top tier");
const low = X.dimHell(base.mobs[0].k);
assert.ok(low.hp > 3 && low.atk > 2, `a Lv.40 raid monster is raised to the top tier (hp ×${low.hp.toFixed(1)}, atk ×${low.atk.toFixed(1)})`);
assert.ok(hk(hell) > hk(night) && ak(hell) > ak(night), "헬 in the forest is harder than its 악몽");
const top = Object.keys(X.MOBS).find((k) => !X.MOBS[k].boss && !X.MOBS[k].chest && X.MOBS[k].lv === X.HELL_TIER + 1);
if (top) assert.equal(X.dimHell(top).hp, 1, "a top-tier monster is never lowered");
assert.ok(run(200, "under", 3).dim, "헬 opens on the underground raid too");
console.log("raiddif: ok");
