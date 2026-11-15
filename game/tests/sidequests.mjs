// Side-quest engine (P1, docs/design/content-audit-2026-11-15.md §3): make, deliver (timed), elite of one kind,
// choice with branches and per-pick rewards, quest items, keepsakes (기념품), quest titles, old sheets, data:check.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as L from "../src/logic.js";
import { checkData, DATA_DIR } from "../scripts/editor-lib.mjs";

const T = 16;
const BASE = Date.UTC(2026, 10, 15, 1, 0, 0);
function world(name = "심부름꾼", sheet = null) {
  const S = L.setup();
  let now = BASE;
  S.now = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, sheet || L.newChar(name, "warrior", []));
  const W = {
    S, PID, toasts: [],
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); if (v.toast) W.toasts.push(...v.toast); L.endTick(S); return v; },
    wait(ms) { now += ms; S.now = now; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    ok(a) { const r = W.act(a); assert.ok(r.ok, `${JSON.stringify(a)}: ${r.error}`); },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    to(id, tx, ty) { const p = W.p; L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
    meet(id) { for (const mid of Object.keys(L.atlas().maps)) { const n = L.atlas().maps[mid].npcs.find((o) => o.id === id); if (n) { W.to(mid, n.x, n.y + 1); W.p.y -= 4; return; } } assert.fail(`no NPC ${id}`); },
    kill(k, el = 0) {
      const p = W.p, rt = L.runtime(S, p.map);
      const find = () => rt.mobs.find((x) => x.k === k && !x.dead && !x.evt) || rt.mobs.find((x) => x.k === k && !x.evt);
      if (!find()) W.step();
      const m = find();
      assert.ok(m, `a ${k} lives in ${p.map}`);
      m.dead = false; m.el = el; m.tr = [];
      if (el) m.temp = el === 2; m.hp = 1; m.x = p.x + 12; m.y = p.y; m.by = {};
      for (const o of rt.mobs) if (o !== m && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 90) { o.x += 4000; o.hx = o.x; }
      p.atkAt = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
      W.ok({ t: "atk" });
      assert.ok(m.dead);
      W.step(20);
    },
  };
  return W;
}
const sqOf = (self, id) => { const r = self.sq.find((x) => x[0] === id); return r && { st: r[1], n: r[2], need: r[3], t: r[4] }; };
const bag = (W, id) => W.ch.inv.filter((s) => s.id === id).reduce((n, s) => n + (s.n || 1), 0);
const D = L.defs();

// ── the demo chain 「갈대의 송사리 도시락」: talk → make → deliver with a choice, a keepsake, a title, a branch
function chainTo(W, pick) {
  W.meet("willow_bard");
  W.ok({ t: "sq", a: "take", id: "sq_reed_quiet" });
  W.meet("willow_fisher");
  W.ok({ t: "sq", a: "talk", npc: "willow_fisher" });
  W.meet("willow_bard");
  W.ok({ t: "sq", a: "done", id: "sq_reed_quiet" });
  // make: only what the player cooks counts — two grilled fish bought or picked up would not
  W.meet("willow_fisher");
  W.ok({ t: "sq", a: "take", id: "sq_reed_grill" });
  const rt = L.runtime(W.S, W.p.map);
  rt.fires.push({ x: W.p.x, y: W.p.y, until: BASE + 864e5, by: "test" });
  W.ch.inv.push({ id: "food_s", n: 5 });
  assert.equal(sqOf(W.self(), "sq_reed_grill").n, 0, "carried dishes are not made");
  W.ch.inv.push({ id: "fish_s", n: 6 });
  for (let i = 0; i < 6 && sqOf(W.self(), "sq_reed_grill").st !== 3; i++) W.ok({ t: "cook", id: "fish_s", s: 100 });
  assert.equal(sqOf(W.self(), "sq_reed_grill").st, 3, "two grilled at the fire");
  W.ok({ t: "sq", a: "done", id: "sq_reed_grill" });
  // deliver: the lunch box is given on take, can't be sold or stored, and only 리나 takes it
  W.ok({ t: "sq", a: "take", id: "sq_reed_lunch" });
  assert.equal(bag(W, "q_reed_box"), 1);
  const row = sqOf(W.self(), "sq_reed_lunch");
  assert.equal(row.st, 3);
  assert.ok(row.t === W.ch.sq.t.sq_reed_lunch && row.t - W.S.now > 899e3, "a timed delivery sends its deadline");
  const slot = W.ch.inv.findIndex((s) => s.id === "q_reed_box");
  W.meet("shop");
  assert.match(W.act({ t: "sell", s: slot, n: 1 }).error, /퀘스트 아이템/);
  assert.match(W.act({ t: "sq", a: "done", id: "sq_reed_lunch" }).error, /골라/, "a choice needs a pick");
  assert.ok(!W.act({ t: "sq", a: "done", id: "sq_reed_lunch", pick: 2 }).ok, "only the options there are");
  W.ok({ t: "sq", a: "done", id: "sq_reed_lunch", pick });
  assert.equal(bag(W, "q_reed_box"), 0, "handed over");
  assert.equal(W.ch.sq.flags.sq_reed_lunch, pick);
  assert.deepEqual(W.ch.keep, { kp_reed_float: 1 });
  return W.self();
}
{
  const W = world("진심");
  W.meet("willow_bard");
  assert.equal(sqOf(W.self(), "sq_reed_quiet").st, 0, "level 3 first");
  W.ch.lvl = 3;
  let s = chainTo(W, 0);
  assert.deepEqual(s.keep, ["kp_reed_float"], "the keepsake reaches the client");
  assert.ok(W.ch.ach.includes("t_sq_reed_lunch_0"), "telling the truth earns the title");
  W.ok({ t: "title", id: "t_sq_reed_lunch_0" });
  assert.ok(D.achievements.some((a) => a.id === "t_sq_reed_lunch_0" && a.title === "부녀의 심부름꾼" && a.cat === "이야기"));
  // the branch: 리나's reply opens, carried back to 갈대
  assert.equal(sqOf(s, "sq_reed_reply").st, 1);
  W.ok({ t: "sq", a: "take", id: "sq_reed_reply" });
  // dropping a delivery takes the parcel back; taking it again gives it again
  W.ok({ t: "sq", a: "drop", id: "sq_reed_reply" });
  assert.equal(bag(W, "q_rina_reply"), 0);
  W.ok({ t: "sq", a: "take", id: "sq_reed_reply" });
  assert.equal(bag(W, "q_rina_reply"), 1);
  W.meet("willow_fisher");
  W.ok({ t: "sq", a: "done", id: "sq_reed_reply" });
  assert.equal(sqOf(W.self(), "sq_reed_reply").st, 4);
  // keepsakes persist through a save; unknown ones and stray quest items are cleaned out
  const saved = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID)));
  saved.keep.kp_nothing = 1;
  saved.inv.push({ id: "q_reed_box", n: 1 });
  const W2 = world("진심2", saved);
  assert.deepEqual(W2.ch.keep, { kp_reed_float: 1 });
  assert.equal(bag(W2, "q_reed_box"), 0, "a parcel no quest asks for is gone");
  assert.ok(W2.ch.ach.includes("t_sq_reed_lunch_0") && W2.ch.title === "t_sq_reed_lunch_0", "the quest title stays worn");
}
{
  const W = world("모른척");
  W.ch.lvl = 3;
  const s = chainTo(W, 1);
  assert.ok(!W.ch.ach.includes("t_sq_reed_lunch_0"), "no title on the other answer");
  assert.equal(sqOf(s, "sq_reed_reply"), undefined, "the other branch is hidden");
  W.meet("shop");
  assert.ok(!W.act({ t: "sq", a: "take", id: "sq_reed_reply" }).ok);
}
// ── a timed delivery that comes too late is refused (drop and take it again)
{
  const W = world("늦잠");
  W.ch.lvl = 3; W.ch.sq.done.sq_reed_grill = 1;
  W.meet("willow_fisher");
  W.ok({ t: "sq", a: "take", id: "sq_reed_lunch" });
  W.meet("shop");
  W.wait(901 * 1000);
  assert.match(W.act({ t: "sq", a: "done", id: "sq_reed_lunch", pick: 1 }).error, /제한 시간/);
  W.meet("willow_fisher");
  W.ok({ t: "sq", a: "drop", id: "sq_reed_lunch" });
  W.ok({ t: "sq", a: "take", id: "sq_reed_lunch" });
  W.meet("shop");
  W.ok({ t: "sq", a: "done", id: "sq_reed_lunch", pick: 1 });
}
// ── elite of one kind (sq_lumi_elites): another elite or a plain snake does not count
{
  const W = world("사서");
  W.ch.lvl = 40; W.ch.sq.done.sq_lumi_snakes = 1;
  W.meet("cafe_lumi");
  W.ok({ t: "sq", a: "take", id: "sq_lumi_elites" });
  const q = D.side.find((o) => o.id === "sq_lumi_elites");
  assert.equal(q.target, "빛나는 눈의 세머리 뱀");
  const sp = L.atlas().maps.forest.spawns.find((o) => o.k === "hydrasnake").r;
  W.to("forest", (sp[0] + sp[2]) >> 1, (sp[1] + sp[3]) >> 1);
  for (let i = 0; i < 5; i++) W.step();
  W.kill("splitboar", 1);
  W.kill("hydrasnake", 0);
  assert.equal(sqOf(W.self(), "sq_lumi_elites").n, 0);
  W.kill("hydrasnake", 1);
  assert.equal(sqOf(W.self(), "sq_lumi_elites").st, 3);
}
// ── quest items: no warehouse; an old sheet mid-way through a converted quest keeps working
{
  const W = world("창고");
  W.meet("willow_elder");
  W.ok({ t: "sq", a: "take", id: "sq_willow_letter" });
  W.meet("bank");
  const slot = W.ch.inv.findIndex((s) => s.id === "q_flower_letter");
  assert.match(W.act({ t: "wh", a: "put", s: slot, n: 1 }).error, /퀘스트 아이템/);
  assert.ok(!W.act({ t: "qs", i: 0, v: ["i", "q_flower_letter"] }).ok, "not on a quick slot");
  // a v22 sheet half-way through 새참은 주먹밥 (then a collect goal) keeps its progress clamped
  const old = L.newChar("옛농부", "warrior", []);
  old.v = 22; delete old.keep; old.sq = { on: { sq_gamja_rice: 2 }, done: {} };
  const W2 = world("옛농부", old);
  assert.equal(W2.ch.v, 23);
  assert.deepEqual(W2.ch.keep, {});
  assert.deepEqual(W2.ch.sq, { on: { sq_gamja_rice: 2 }, done: {}, flags: {}, t: {} });
  assert.equal(D.side.find((o) => o.id === "sq_gamja_rice").station, "fire", "추적 walks to a campfire");
}
// ── data:check rejects bad quest data (and accepts the shipped data)
{
  const dir = mkdtempSync(join(tmpdir(), "tt-sq-"));
  try {
    mkdirSync(join(dir, "maps"));
    for (const f of readdirSync(join(DATA_DIR, "maps"))) writeFileSync(join(dir, "maps", f), readFileSync(join(DATA_DIR, "maps", f)));
    for (const f of ["links.json", "npcs.json", "npclife.json"]) writeFileSync(join(dir, f), readFileSync(join(DATA_DIR, f)));
    const Q = JSON.parse(readFileSync(join(DATA_DIR, "quests.json"), "utf8"));
    const base = { giver: "willow_elder", title: "시험", text: "시험", req: { lv: 1, quest: null }, reward: { xp: 1, gold: 1, items: [] } };
    Q.side.push(
      { ...base, id: "sq_bad_make", goal: { type: "make", item: "pet_chick", n: 1 } },
      { ...base, id: "sq_bad_deliver", goal: { type: "deliver", npc: "shop", item: "hp_s", time: 5 } },
      { ...base, id: "sq_bad_choice", goal: { type: "choice" }, choice: [{ label: "하나" }] },
      { ...base, id: "sq_bad_flag", goal: { type: "talk", npc: "shop" }, req: { lv: 1, quest: null, flag: ["sq_reed_lunch", 5] } },
      { ...base, id: "sq_bad_keep", goal: { type: "talk", npc: "shop" }, reward: { xp: 1, keep: "hp_s", items: [["kp_reed_float", 1]] } },
      { ...base, id: "sq_bad_elite", goal: { type: "elite", mob: "nobody", n: 1 } },
    );
    writeFileSync(join(dir, "quests.json"), JSON.stringify(Q));
    const r = await checkData(dir);
    const at = (p) => r.errors.filter((e) => e.path.startsWith(p)).map((e) => e.path);
    const n = Q.side.length;
    assert.ok(!r.ok);
    assert.deepEqual(at(`side[${n - 6}]`), [`side[${n - 6}].goal.item`], "make needs a recipe output");
    assert.deepEqual(at(`side[${n - 5}]`).sort(), [`side[${n - 5}].goal.item`, `side[${n - 5}].goal.time`], "deliver needs a quest item and a sane time");
    assert.deepEqual(at(`side[${n - 4}]`), [`side[${n - 4}].choice`], "2–3 options");
    assert.deepEqual(at(`side[${n - 3}]`), [`side[${n - 3}].req.flag`], "a pick that exists");
    assert.deepEqual(at(`side[${n - 2}]`).sort(), [`side[${n - 2}].reward.items[0]`, `side[${n - 2}].reward.keep`], "keepsakes only in keep");
    assert.deepEqual(at(`side[${n - 1}]`), [`side[${n - 1}].goal.mob`]);
    assert.equal(r.errors.length, 8, JSON.stringify(r.errors));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.ok((await checkData()).ok, "the shipped data passes");
}
console.log("sidequests: ok");
