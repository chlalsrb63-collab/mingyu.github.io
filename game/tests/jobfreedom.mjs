// Headless test of 직업 자유 (docs/design/job-freedom.md): hybrids past mastery 15, job reset with per-job
// progress, level reset, the 5 + 4 skill loadout (town or campfire only), two cross-weapon passives,
// and a v17 sheet's migration.   node tests/jobfreedom.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
let pidN = 0;
function world(o = {}) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-jf" + pidN++;
  L.addPlayer(S, PID, o.ch || L.hero("자유" + pidN, o));
  const W = {
    S, PID,
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    npc(role) { W.go("town"); const n = W.map.npcs.find((x) => x.role === role); W.p.x = n.x * T + 8; W.p.y = n.y * T + 30; W.p.mvAt = now; },
    go(id) { const p = W.p; if (p.map !== id) { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.sendMap = true; W.map = W.step().map; } },
  };
  W.map = W.step().map;
  return W;
}
const give = (ch, id, n = 1) => ch.inv.push({ id, n });
const has = (ch, id) => ch.inv.filter((s) => s.id === id).reduce((a, s) => a + (s.n || 1), 0);

// ── 1. no cap on hybrids: masteries far past 15 still open the two-weapon job
{
  const W = world({ wk: "sword", wk2: "staff", wm: { sword: 40, staff: 35 } });
  W.ch.gold = 10000;
  W.npc("job");
  assert.ok(W.act({ t: "job_change", j: "spellblade" }).ok, "sword 40 + staff 35 → 마검사");
  assert.equal(W.ch.job, "spellblade");
}

// ── 2. job reset keeps every job's progress; going back resumes it, free
{
  const W = world({ wk: "sword", lvl: 60, wm: { sword: 25, dagger: 22 } });
  const ch = W.ch;
  ch.gold = 50000;
  W.npc("job");
  assert.ok(W.act({ t: "job_change", j: "swordsman" }).ok);
  assert.equal(ch.jobs.swordsman, ch.jp, "the current job's record is ch.jp");
  ch.jp.lv = 12; ch.jp.xp = 7;
  assert.match(W.act({ t: "job_reset" }).error, /전직 초기화 주문서/, "the scroll is needed");
  give(ch, "scr_job");
  ch.eq.weapon2 = { id: "w_rogue_1", q: 0, enh: 0, af: [], sk: 0, ru: [] };
  const g = ch.gold, cost = D.jf.cost.job[0] + D.jf.cost.job[1] * ch.lvl;
  assert.ok(W.act({ t: "job_reset" }).ok);
  assert.equal(ch.job, "adventurer"); assert.equal(ch.jp, null);
  assert.equal(ch.eq.weapon2.id, "w_rogue_1", "§9: the second weapon stays on");
  assert.equal(ch.gold, g - cost, "gold scales with the level"); assert.equal(has(ch, "scr_job"), 0, "scroll used");
  assert.deepEqual(ch.jobs.swordsman, { lv: 12, xp: 7 }, "job level kept");
  assert.equal(W.act({ t: "job_reset" }).error, "모험가는 초기화할 직업이 없습니다");
  assert.ok(W.act({ t: "job_change", j: "thief" }).ok, "another job");
  assert.deepEqual(ch.jp, { lv: 1, xp: 0 });
  give(ch, "scr_job");
  assert.ok(W.act({ t: "job_reset" }).ok);
  const g2 = ch.gold;
  assert.ok(W.act({ t: "job_change", j: "swordsman" }).ok, "back to the first job");
  assert.equal(ch.gold, g2, "a job walked before is free");
  assert.deepEqual(ch.jp, { lv: 12, xp: 7 }, "resumes at job Lv.12");
  assert.deepEqual(W.self().jobs.map((r) => r[0]).sort(), ["swordsman", "thief"], "self.jobs lists every job walked");
  // persisted and loaded again
  const back = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID)));
  const W2 = world({ ch: back });
  assert.equal(W2.ch.jobs.swordsman, W2.ch.jp); assert.deepEqual(W2.ch.jobs.thief, { lv: 1, xp: 0 });
}

// ── 3. level reset: level and stats back to 1; everything else kept; gear above level 1 to the bag
{
  const W = world({ wk: "sword", lvl: 120, wm: { sword: 30, bow: 12 }, job: "swordsman" });
  const ch = W.ch;
  ch.jp = { lv: 9, xp: 0 };
  ch.jobs = { swordsman: ch.jp, thief: { lv: 4, xp: 2 } };
  ch.gold = 100000; ch.xp = 777; ch.tro = ["hogking"].filter((k) => k in (D.trophies || {})); ch.sq.done.sq_willow_letter = 1;
  ch.eq.armor = { ...ch.eq.armor, id: "a_3" };
  const lvl = ch.lvl, wm = JSON.stringify(ch.wm), tro = JSON.stringify(ch.tro), cos = JSON.stringify(ch.cos);
  W.npc("job");
  assert.match(W.act({ t: "lv_reset" }).error, /레벨 초기화 주문서/);
  give(ch, "scr_lvl");
  assert.ok(W.act({ t: "lv_reset" }).ok);
  assert.equal(ch.lvl, 1); assert.ok(Object.values(ch.st).every((v) => v === 5), "stats back to 5"); assert.equal(ch.xpt, 0);
  assert.equal(ch.xp, 777, "unspent experience stays, spent is not given back");
  assert.equal(ch.gold, 100000 - (D.jf.cost.lvl[0] + D.jf.cost.lvl[1] * lvl)); assert.equal(has(ch, "scr_lvl"), 0);
  assert.equal(JSON.stringify(ch.wm), wm, "masteries kept"); assert.equal(JSON.stringify(ch.tro), tro); assert.equal(JSON.stringify(ch.cos), cos);
  assert.equal(ch.job, "swordsman"); assert.deepEqual(ch.jobs.thief, { lv: 4, xp: 2 }); assert.equal(ch.jp.lv, 9, "job levels kept");
  assert.equal(ch.sq.done.sq_willow_letter, 1, "quests kept");
  assert.equal(ch.eq.armor, null, "Lv.61 armour comes off");
  const s = ch.inv.findIndex((x) => x.id === "a_3");
  assert.ok(s >= 0, "into the bag");
  assert.equal(W.act({ t: "eq", s }).error, "레벨 61부터 착용할 수 있습니다", "and cannot be worn until the level is back");
  assert.equal(W.act({ t: "lv_reset" }).error, "이미 레벨 1입니다");
}

// ── 4–5. the loadout: 5 actives + 4 passives, town or campfire only; only what is in it works
{
  const W = world({ wk: "sword", wk2: "staff", lvl: 40, wm: { sword: 15, staff: 15, spear: 10 }, job: "spellblade" });
  const ch = W.ch;
  ch.jp = { lv: 5, xp: 0 }; ch.jobs = { spellblade: ch.jp };
  const lo0 = W.self().lo;
  assert.deepEqual(lo0[0].sort(), ["crimson", "fireball", "frostring", "rend", "slash"], "default: the five the hybrid uses");
  assert.deepEqual(lo0[1].sort(), ["inertia", "reso", "tip"], "every passive learned (three fit in four)"); assert.equal(lo0[3], 0, "not set yet");
  assert.equal(D.jf.lo[0], 5); assert.equal(D.jf.lo[1], 4);
  W.go("meadow");
  assert.equal(W.act({ t: "lo", a: ["slash"], p: [] }).error, "스킬 칸은 마을이나 모닥불 곁에서만 바꿀 수 있습니다");
  const rt = W.S.maps.meadow;
  rt.fires.push({ id: W.S.nextId++, x: Math.round(W.p.x), y: Math.round(W.p.y) - 14, until: W.S.now + 600000 });
  assert.ok(W.act({ t: "lo", a: ["slash"], p: [] }).ok, "beside a campfire");
  rt.fires.pop();
  W.npc("job");
  assert.equal(W.act({ t: "lo", a: ["slash", "rend", "fireball", "frostring", "crimson", "spiral"], p: [] }).error, "액티브 5개, 패시브 4개까지 넣을 수 있습니다");
  assert.equal(W.act({ t: "lo", a: ["inertia"], p: [] }).error, "액티브와 패시브 칸이 맞지 않습니다");
  assert.equal(W.act({ t: "lo", a: ["verdict"], p: [] }).error, "배우지 않은 스킬입니다");
  assert.equal(W.act({ t: "lo", a: ["slash", "slash"], p: [] }).error, "잘못된 스킬입니다");
  assert.ok(W.act({ t: "lo", a: ["slash"], p: ["reso"] }).ok, "in town");
  const v = W.self();
  assert.deepEqual(v.lo.slice(0, 4), [["slash"], ["reso"], "", 1]);
  const row = (id) => v.sk.find((r) => r[0] === id);
  assert.equal(row("rend")[3], 0, "out of the loadout: not usable"); assert.equal(row("inertia")[3], 0, "passive off");
  assert.equal(row("reso")[3], 1, "a hybrid keeps its pair's passive in the loadout");
  W.p.mp = 9999;
  assert.equal(W.act({ t: "sk", id: "rend", a: 0 }).error, "스킬 칸에 넣지 않은 스킬입니다 — 마을이나 모닥불 곁에서 바꿀 수 있습니다");
  assert.notEqual(W.act({ t: "sk", id: "slash", a: 0 }).error, "스킬 칸에 넣지 않은 스킬입니다 — 마을이나 모닥불 곁에서 바꿀 수 있습니다");
  assert.deepEqual(ch.lo.spellblade, { a: ["slash"], p: ["reso"], x: "", y: "" }, "saved for this job");
}

// ── 6. A job opens both cross-weapon slots; mastery is the only requirement for another weapon.
{
  const W = world({ wk: "dagger", wk2: "sword", lvl: 150, wm: { dagger: 20, sword: 20, bow: 10 }, job: "thief" });
  const ch = W.ch;
  W.npc("job");
  const load = { t: "lo", a: [], p: ["vitals"] };
  assert.ok(W.act(load).ok);
  const baseline = W.p.stc.atk0, speed = W.p.stc.spd0;
  assert.deepEqual(W.self().lo.slice(4), [1, "", 50], "first job opens the slots at 50%");
  assert.match(W.act({ ...load, x: "vitals" }).error, /두 번/);
  assert.match(W.act({ ...load, p: [], x: "vitals" }).error, /현재 직업의 무기군 외/);
  assert.match(W.act({ ...load, x: "inertia", y: "inertia" }).error, /두 번/);
  assert.match(W.act({ ...load, y: "bow_quill50" }).error, /배운 패시브/);
  assert.ok(W.act({ ...load, p: ["vitals", "dagger_shade20"], x: "inertia", y: "hawk" }).ok);
  assert.ok(Math.abs(W.p.stc.atk0 / baseline - 1.04) < 1e-9, "two attack perks at half their 4% values");
  assert.ok(Math.abs(W.p.stc.spd0 / speed - 1.10) < 1e-9, "native dagger passive adds its full bonus (10%)");
  const v = W.self();
  assert.deepEqual([v.lo[2], v.lo[5]], ["inertia", "hawk"]);
  for (const id of ["inertia", "hawk", "vitals", "dagger_shade20"]) assert.equal(v.sk.find((r) => r[0] === id)[3], 1);
  assert.ok(W.act({ ...load, x: "inertia" }).ok, "legacy loadout action with no y remains valid");
  assert.equal(W.self().lo[5], "hawk", "legacy action preserves the second slot");
  assert.ok(W.act({ t: "wsw" }).ok, "gear swap");
  const s = W.self();
  assert.equal(s.sk.find((r) => r[0] === "inertia")[3], 1, "off-job passive survives the swap");
  assert.equal(s.sk.find((r) => r[0] === "vitals")[3], 0, "the native dagger passive stops");
  W.step(1000);
  assert.ok(W.act({ t: "wsw" }).ok);

  assert.ok(W.act({ t: "sq", a: "take", id: D.jf.quest }).ok, "taken at the 전직관");
  ch.sq.on[D.jf.quest] = 30;
  assert.ok(W.act({ t: "sq", a: "done", id: D.jf.quest }).ok, "handed in");
  assert.equal(W.self().lo[6], 60, "the quest improves both borrowed bonuses");
  assert.ok(Math.abs(W.p.stc.atk0 / baseline - 1.048) < 1e-9, "the quest invalidates the cached stats immediately");
  const old = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID)));
  old.v = 20; delete old.lo.thief.y;
  const migrated = world({ ch: old });
  assert.deepEqual(migrated.ch.lo.thief, { a: [], p: ["vitals"], x: "inertia", y: "" });
  assert.equal(migrated.self().lo[6], 60, "earned legacy quest credit is retained");
  assert.ok(W.act({ ...load, x: "", y: "hawk" }).ok);
  const saved = world({ ch: JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID))) });
  assert.deepEqual([saved.self().lo[2], saved.self().lo[5]], ["", "hawk"], "slot placement survives reconnect");
  const W2 = world({ wk: "dagger", lvl: 140 });
  W2.npc("job");
  assert.equal(W2.act({ t: "lo", a: [], p: [], y: "hawk" }).error, "전직하면 교차 패시브 칸이 열립니다");
  assert.equal(W2.act({ t: "sq", a: "take", id: D.jf.quest }).error, "레벨 150 이상이어야 합니다");
}

// ── 7. a v17 sheet: its job level moves into the per-job map
{
  const W0 = world({ wk: "sword", wm: { sword: 20 }, job: "swordsman" });
  const old = JSON.parse(JSON.stringify(L.exportChar(W0.S, W0.PID)));
  delete old.jobs; delete old.lo; old.v = 17; old.jp = { lv: 9, xp: 3 };
  const W = world({ ch: old });
  assert.equal(W.ch.v, 23);
  assert.deepEqual(W.ch.jobs, { swordsman: { lv: 9, xp: 3 } }); assert.equal(W.ch.jobs.swordsman, W.ch.jp);
  assert.deepEqual(W.ch.lo, {});
  assert.deepEqual(L.newChar("새판", []).jobs, {});
}

// ── the scrolls exist, in Korean
assert.equal(D.items.scr_job.name, "전직 초기화 주문서"); assert.equal(D.items.scr_lvl.name, "레벨 초기화 주문서");
// ── 스킬 강화 (§7): +1..+3 sure, a failure eats only the stone, +2.5 % a step, town or campfire only
{
  const W = world({ wk: "sword" });
  const act = W.self().sk.find((r) => D.skills[r[0]].kind !== "p");
  assert.ok(act, "a sword hero knows an active");
  const id = act[0];
  W.npc("smith");
  assert.equal(W.act({ t: "ske", id }).ok, false, "needs the stone");
  W.ch.inv.push({ id: "ske_stone", n: 99 });
  const passive = Object.keys(D.skills).find((k) => D.skills[k].kind === "p");
  assert.equal(W.act({ t: "ske", id: passive }).ok, false, "passives can't be enhanced");
  for (let i = 0; i < 3; i++) assert.ok(W.act({ t: "ske", id }).ok);
  assert.equal(W.ch.ske[id], 3, "safe to +3");
  let fails = 0;
  for (let i = 0; i < 300 && W.ch.ske[id] < 10; i++) { const n = W.ch.ske[id]; W.act({ t: "ske", id }); if (W.ch.ske[id] === n) fails++; else assert.equal(W.ch.ske[id], n + 1); }
  assert.ok(fails > 0, "from +4 it can fail, and a failure keeps the level");
  assert.equal(W.ch.ske[id], 10);
  assert.equal(W.act({ t: "ske", id }).ok, false, "+10 is the top");
  assert.deepEqual(W.self().ske, { [id]: 10 });
  assert.equal(D.ske.rate.length, 10); assert.equal(D.ske.pct * 10, 25);
  // the field is no place for it; an old sheet gets an empty book, junk is cleaned
  W.go("meadow"); W.ch.ske[id] = 5;
  assert.equal(W.act({ t: "ske", id }).ok, false, "town or campfire only");
  const S2 = L.setup(), old = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID)));
  old.ske = { [id]: 99, [passive]: 3, nope: 2 };
  L.addPlayer(S2, "old@s1", old);
  assert.deepEqual(S2.players["old@s1"].ch.ske, { [id]: 10 });
  delete old.ske; L.addPlayer(S2, "older@s1", old);
  assert.deepEqual(S2.players["older@s1"].ch.ske, {});
}
// ── v20: four field-boss steps went into the main chain; a v19 sheet keeps its place on the same errand
{
  const Q = D.quests, W = world();
  const oldIdx = Q.map((q, j) => (q.v20 ? -1 : j)).filter((j) => j >= 0);
  const k = oldIdx.findIndex((j) => j > Q.findIndex((q) => q.v20));   // the first old step past an insertion
  assert.ok(Q.filter((q) => q.v20).length === 4 && k > 0);
  const old = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID)));
  old.v = 19; old.q = { ...old.q, i: k };
  const S2 = L.setup(); L.addPlayer(S2, "q19@s1", old);
  assert.equal(S2.players["q19@s1"].ch.q.i, oldIdx[k], "the same errand after the new steps");
  assert.equal(Q[S2.players["q19@s1"].ch.q.i].title, Q[oldIdx[k]].title);
  const fresh = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID))); fresh.q = { ...fresh.q, i: k };
  const S3 = L.setup(); L.addPlayer(S3, "q20@s1", fresh);
  assert.equal(S3.players["q20@s1"].ch.q.i, k, "a v20 sheet is left alone");
}
console.log("jobfreedom: ok");
