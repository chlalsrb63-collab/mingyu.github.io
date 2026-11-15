// Side-quest engine (P1, docs/design/content-audit-2026-11-15.md §3): make, deliver (timed), elite of one kind,
// choice with branches and per-pick rewards, quest items, keepsakes (기념품), quest titles, old sheets, data:check;
// the story arcs A1–A6 (docs/design/arcs.md) walked start to end through every answer.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as L from "../src/logic.js";
import { checkData, DATA_DIR } from "../scripts/editor-lib.mjs";

const T = 16;
const BASE = Date.UTC(2026, 10, 15, 1, 0, 0);
function world(name = "심부름꾼", sheet = null, M = L) {
  const S = M.setup();
  let now = BASE;
  S.now = now;
  const PID = "pid-" + name;
  M.addPlayer(S, PID, sheet || M.newChar(name, "warrior", []));
  const W = {
    S, PID, toasts: [],
    step(ms = 100) { now += ms; M.tick(S, now); const v = JSON.parse(JSON.stringify(M.viewFor(S, PID))); if (v.toast) W.toasts.push(...v.toast); M.endTick(S); return v; },
    wait(ms) { now += ms; S.now = now; },
    act(a) { S.now = now; const v = M.validateAction(S, PID, a); if (v.ok) M.applyAction(S, PID, a); return v; },
    ok(a) { const r = W.act(a); assert.ok(r.ok, `${JSON.stringify(a)}: ${r.error}`); },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    to(id, tx, ty) { const p = W.p; M.runtime(S, p.map).n--; p.map = id; M.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
    meet(id) { for (const mid of Object.keys(M.atlas().maps)) { const n = M.atlas().maps[mid].npcs.find((o) => o.id === id); if (n) { W.to(mid, n.x, n.y + 1); W.p.y -= 4; return; } } assert.fail(`no NPC ${id}`); },
    kill(k, el = 0) {
      const p = W.p, rt = M.runtime(S, p.map);
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
  assert.equal(W2.ch.v, 26);
  assert.deepEqual(W2.ch.keep, {});
  assert.deepEqual(W2.ch.sq, { on: { sq_gamja_rice: 2 }, done: {}, flags: {}, t: {} });
  assert.equal(D.side.find((o) => o.id === "sq_gamja_rice").station, "fire", "추적 walks to a campfire");
}
// ── arc A1 「버드나무의 새 식구」 start to end, both answers of 콩알's choice
function arcA1(W, pick) {
  W.ch.lvl = 15; W.ch.sq.done.sq_willow_letter = 1;
  W.meet("willow_elder");
  W.ok({ t: "sq", a: "take", id: "sq_doran_blanket" });
  W.meet("willow_doran");
  W.ok({ t: "sq", a: "done", id: "sq_doran_blanket" });
  W.ok({ t: "sq", a: "take", id: "sq_doran_wood" });
  W.ch.inv.push({ id: "m_w1", n: 8 });
  W.ok({ t: "sq", a: "done", id: "sq_doran_wood" });
  assert.equal(bag(W, "m_w1"), 0, "the firewood is handed over");
  W.meet("willow_farmer");
  W.ok({ t: "sq", a: "take", id: "sq_gamja_kong" });
  W.ch.inv.push({ id: "fd_potato", n: 3 });
  assert.equal(sqOf(W.self(), "sq_gamja_kong").n, 0, "bought potatoes are not made");
  L.runtime(W.S, W.p.map).fires.push({ x: W.p.x, y: W.p.y, until: BASE + 864e5, by: "test" });
  W.ch.inv.push({ id: "m_c1", n: 12 });
  for (let i = 0; i < 9 && sqOf(W.self(), "sq_gamja_kong").st !== 3; i++) { W.ok({ t: "craft_open", r: "fd_potato" }); W.wait(13000); W.ok({ t: "craft", r: "fd_potato", s: 90 }); }
  assert.equal(sqOf(W.self(), "sq_gamja_kong").st, 3, "three baked at the fire");
  W.ok({ t: "sq", a: "done", id: "sq_gamja_kong" });
  W.meet("willow_kong");
  W.ok({ t: "sq", a: "take", id: "sq_kong_wait" });
  W.ok({ t: "sq", a: "done", id: "sq_kong_wait", pick });
  const s = W.self();
  assert.equal(sqOf(s, "sq_sol_lullaby")?.st, pick === 0 ? 1 : undefined, "the lullaby only after 「기다리자」");
  assert.equal(sqOf(s, "sq_kong_drawing")?.st, pick === 1 ? 1 : undefined, "the drawing only after 「찾아볼게」");
  if (pick === 0) {
    W.meet("willow_bard");
    W.ok({ t: "sq", a: "take", id: "sq_sol_lullaby" });
    W.meet("willow_kong");
    W.ok({ t: "sq", a: "talk", npc: "willow_kong" });
    W.meet("willow_bard");
    W.ok({ t: "sq", a: "done", id: "sq_sol_lullaby" });
  } else {
    W.ok({ t: "sq", a: "take", id: "sq_kong_drawing" });
    assert.equal(bag(W, "q_kong_drawing"), 1);
    W.meet("lamplighter_mori");
    W.ok({ t: "sq", a: "done", id: "sq_kong_drawing" });
  }
  // both answers finish the arc: 마루 at the meadow fence, then home to 도란
  W.meet("willow_doran");
  W.ok({ t: "sq", a: "take", id: "sq_doran_fence" });
  W.meet("trail_fence");
  W.ok({ t: "sq", a: "talk", npc: "trail_fence" });
  W.meet("willow_doran");
  W.ok({ t: "sq", a: "done", id: "sq_doran_fence" });
  assert.ok(W.ch.keep.kp_willow_key && W.ch.ach.includes("t_sq_doran_fence"), "the spare key and 「버드나무 이웃」");
}
for (const pick of [0, 1]) arcA1(world("콩알친구" + pick), pick);
// ── arc A2 「마지막 불빛」: 치치 → 도톨 (scrap, the named elite, the photo) → 도란's choice; each answer's own epilogue
function arcA2(pick) {
  const W = world("불빛" + pick);
  W.ch.lvl = 55; W.ch.sq.done.sq_doran_fence = 1;
  W.meet("trail_clock");
  W.ok({ t: "sq", a: "take", id: "sq_neon_bell" });
  W.meet("city_dotol");
  W.ok({ t: "sq", a: "talk", npc: "city_dotol" });
  W.meet("trail_clock");
  W.ok({ t: "sq", a: "done", id: "sq_neon_bell" });
  W.ch.lvl = 72;
  W.meet("city_dotol");
  W.ok({ t: "sq", a: "take", id: "sq_dotol_sign" });
  W.ch.inv.push({ id: "m_o3", n: 6 });
  W.ok({ t: "sq", a: "done", id: "sq_dotol_sign" });
  W.ok({ t: "sq", a: "take", id: "sq_dotol_hound" });
  assert.equal(D.side.find((o) => o.id === "sq_dotol_hound").target, "쇠사슬을 감은 철문 들개");
  W.kill("doghead", 0);
  assert.equal(sqOf(W.self(), "sq_dotol_hound").n, 0, "a plain hound is not the one");
  W.kill("doghead", 1);
  W.meet("city_dotol");
  W.ok({ t: "sq", a: "done", id: "sq_dotol_hound" });
  W.ok({ t: "sq", a: "take", id: "sq_dotol_photo" });
  W.meet("willow_doran");
  W.ok({ t: "sq", a: "done", id: "sq_dotol_photo" });
  W.ok({ t: "sq", a: "take", id: "sq_doran_light" });
  W.ok({ t: "sq", a: "done", id: "sq_doran_light", pick });
  assert.ok(W.ch.keep.kp_neon_lamp && W.ch.ach.includes("t_sq_doran_light"), "the lamp and 「불빛을 지킨 자」 on either answer");
  const s = W.self();
  assert.equal(sqOf(s, "sq_dotol_ember")?.st, pick === 0 ? 1 : undefined, "the ember goes to 모리 only if 도톨 comes home");
  if (pick === 0) {
    W.meet("city_dotol");
    W.ok({ t: "sq", a: "take", id: "sq_dotol_ember" });
    W.meet("lamplighter_mori");
    W.ok({ t: "sq", a: "done", id: "sq_dotol_ember" });
    assert.equal(bag(W, "q_neon_ember"), 0);
  }
  return W;
}
{
  // the supply contract for 도톨 appears on the board only after 「불빛을 지키게 둬요」
  const home = arcA2(0), stay = arcA2(1);
  for (const W of [home, stay]) W.ch.life.cook.lv = 10;
  const has = (W) => W.self().jb[1].some((r) => r[0] === "jb_neon_supply");
  assert.ok(!has(home) && has(stay), "jb_neon_supply follows the answer");
}
// ── retired kill quests (P3): an old sheet mid-way or done loads clean; the quests they gated open on their own
{
  const old = L.newChar("옛사냥꾼", "warrior", []);
  old.sq = { on: { sq_merc_hares: 4, sq_borum_frogs: 2, sq_willow_frogs: 6 }, done: { sq_willow_frogs: 1 } };
  const W = world("옛사냥꾼", old);
  W.ch.lvl = 150;
  assert.deepEqual(W.ch.sq.on, {}, "a retired quest under way is dropped (kill progress paid nothing yet)");
  assert.equal(W.ch.sq.done.sq_willow_frogs, 1, "a finished one stays remembered");
  const s = W.self();
  for (const id of ["sq_willow_frogs", "sq_merc_hares", "sq_borum_frogs"]) assert.equal(sqOf(s, id), undefined, `${id} is gone`);
  assert.equal(sqOf(s, "sq_merc_boar").st, 1, "용병단장's boar hunt no longer waits for the hares");
  assert.equal(sqOf(s, "sq_doran_blanket").st, 0, "the refugee arc still waits for the flower letter");
}
// ── arcs A3–A6 (P4/P5, docs/design/arcs.md): scripted start-to-end runs, every answer of every choice
const LX = await import("data:text/javascript;base64," + Buffer.from(readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { dimChest };").toString("base64"));
const take = (W, id, at) => { if (at) W.meet(at); W.ok({ t: "sq", a: "take", id }); };
const done = (W, id, at, pick) => { if (at) W.meet(at); W.ok({ t: "sq", a: "done", id, ...(pick === undefined ? {} : { pick }) }); };
const talk = (W, npc) => { W.meet(npc); W.ok({ t: "sq", a: "talk", npc }); };
/** Brew / cook / smelt at the recipe's station until the quest's make goal is met (only the player's own crafts count). */
function make(W, id, r, at, inputs, sk) {
  W.meet(at);
  W.ch.life[sk].lv = Math.max(W.ch.life[sk].lv, 30);
  W.ch.gold += 50000;
  for (const [it, n] of inputs) W.ch.inv.push({ id: it, n });
  for (let i = 0; i < 12 && sqOf(W.self(), id).st !== 3; i++) { W.ok({ t: "craft_open", r }); W.wait(13000); W.ok({ t: "craft", r, s: 90 }); }
  assert.equal(sqOf(W.self(), id).st, 3, `${id}: made`);
}
/** Kill `k` on its map until a quest-only drop has filled the collect goal (35 % a kill, only while the quest is on). */
function hunt(W, id, map, k) {
  W.to(map, ...L.atlas().maps[map].entry);
  for (let i = 0; i < 80 && sqOf(W.self(), id).st !== 3; i++) W.kill(k);
  assert.equal(sqOf(W.self(), id).st, 3, `${id}: the drops came`);
}
function arcA3(W, pick) {
  W.ch.lvl = 125; W.ch.sq.done.sq_airship_logbook = 1;
  assert.equal(D.side.find((q) => q.id === "sq_chomi_pages").goal.mob, "hermitskull", "추적 walks to the hermit crabs");
  W.to("coast", ...L.atlas().maps.coast.entry);
  for (let i = 0; i < 20; i++) W.kill("hermitskull");
  assert.equal(bag(W, "q_logpage"), 0, "no page drops before the quest is taken");
  take(W, "sq_chomi_pages", "airship_scout");
  hunt(W, "sq_chomi_pages", "coast", "hermitskull");
  for (let i = 0; i < 10; i++) W.kill("hermitskull");
  assert.equal(bag(W, "q_logpage"), 3, "no more than the quest needs");
  done(W, "sq_chomi_pages", "airship_scout");
  assert.equal(bag(W, "q_logpage"), 0);
  take(W, "sq_aru_tonic", "airship_captain");
  make(W, "sq_aru_tonic", "el_spd", "bogle", [["m_h4", 20], ["m_w4", 20], ["flask", 20]], "alch");
  done(W, "sq_aru_tonic", "airship_captain");
  take(W, "sq_noeul_stone", "airship_signal");
  talk(W, "camp_jungle");
  done(W, "sq_noeul_stone", "airship_signal");
  take(W, "sq_sora_light", "camp_coast");
  W.kill("coralturtle", 0);
  assert.equal(sqOf(W.self(), "sq_sora_light").n, 0, "a plain turtle is not the one");
  W.kill("coralturtle", 1);
  done(W, "sq_sora_light", "camp_coast");
  take(W, "sq_chomi_chart", "airship_scout");
  done(W, "sq_chomi_chart", null, pick);
  assert.ok(W.ch.keep.kp_compass && W.ch.ach.includes(`t_sq_chomi_chart_${pick}`), "the compass and this answer's title");
  assert.ok(!W.ch.ach.includes(`t_sq_chomi_chart_${1 - pick}`), "not the other answer's");
  const s = W.self();
  assert.equal(sqOf(s, "sq_elder_chart")?.st, pick === 0 ? 1 : undefined, "the copy goes to 엘더윈 only on 「보고하자」");
  if (pick === 0) { take(W, "sq_elder_chart"); assert.equal(bag(W, "q_chart"), 1); done(W, "sq_elder_chart", "elder"); }
}
function arcA4(W) {
  W.ch.lvl = 165;
  take(W, "sq_eunha_bear", "temple_eunha");
  W.to("cloudtemple", ...L.atlas().maps.cloudtemple.entry);
  W.kill("bearmaw_ash");
  done(W, "sq_eunha_bear", "temple_eunha");
  take(W, "sq_eunha_rubbing");
  done(W, "sq_eunha_rubbing", "camp_dunesea");
  take(W, "sq_samak_sieve");
  W.ch.inv.push({ id: "m_o4", n: 6 });
  done(W, "sq_samak_sieve");
  take(W, "sq_samak_ingot");
  make(W, "sq_samak_ingot", "ing_4", "kangkang", [["m_o4", 40]], "craft");
  done(W, "sq_samak_ingot", "camp_dunesea");
  take(W, "sq_samak_bell");
  done(W, "sq_samak_bell", "mesa_norang");
  take(W, "sq_norang_bell");
  assert.equal(bag(W, "q_bell"), 1, "노랑 hands the cleaned bell back");
  done(W, "sq_norang_bell", "temple_eunha");
  assert.ok(W.ch.keep.kp_bell && W.ch.ach.includes("t_sq_norang_bell") && bag(W, "q_bell") === 0, "the small bell and 「종을 되찾은 자」");
}
function arcA5(W, pick, a3) {
  W.ch.lvl = 190;
  take(W, "sq_galpi_records", "maple_galpi");
  hunt(W, "sq_galpi_records", "maple", "blightsquirrel");
  done(W, "sq_galpi_records", "maple_galpi");
  // A3's 「옛 지도는 우리만 알자」 opens a hint step here; 「보고하자」 closes it
  assert.equal(sqOf(W.self(), "sq_galpi_chart")?.st, a3 === 1 ? 1 : undefined, "the sky-road hint follows A3's answer");
  if (a3 === 1) { take(W, "sq_galpi_chart"); talk(W, "hermit"); done(W, "sq_galpi_chart", "maple_galpi"); }
  take(W, "sq_galpi_chapel");
  talk(W, "maple_altar");
  done(W, "sq_galpi_chapel", "maple_galpi");
  W.meet("bogle");
  assert.match(W.act({ t: "craft_open", r: "q_ink" }).error, /퀘스트/, "the preserving ink is brewed only for 보름's quest");
  take(W, "sq_borum_ink", "lib_borum");
  make(W, "sq_borum_ink", "q_ink", "bogle", [["m_h4", 30], ["flask", 15]], "alch");
  done(W, "sq_borum_ink", "lib_borum");
  assert.equal(bag(W, "q_ink"), 0, "the made ink goes to 보름");
  take(W, "sq_galpi_stag", "maple_galpi");
  W.to("maple", ...L.atlas().maps.maple.entry);
  W.kill("rotstag", 1);
  done(W, "sq_galpi_stag", "maple_galpi");
  take(W, "sq_galpi_end");
  done(W, "sq_galpi_end", null, pick);
  assert.ok(W.ch.keep.kp_quill && W.ch.ach.includes(`t_sq_galpi_end_${pick}`), "the quill and this answer's title");
  const s = W.self();
  assert.equal(sqOf(s, "sq_galpi_archive")?.st, pick === 0 ? 1 : undefined, "the records go to the library only on 「도서관에」");
  assert.equal(sqOf(s, "sq_galpi_rest")?.st, pick === 1 ? 1 : undefined, "바스's farewell only on 「묻어요」");
  if (pick === 0) { take(W, "sq_galpi_archive"); done(W, "sq_galpi_archive", "lib_borum"); }
  else { take(W, "sq_galpi_rest", "hermit"); talk(W, "maple_altar"); done(W, "sq_galpi_rest", "hermit"); }
}
for (const pick of [0, 1]) { const W = world("항해사" + pick); arcA3(W, pick); arcA4(W); arcA5(W, pick, pick); }
{
  // A6 「균열을 적는 자」: a rift sample from each cleared rift's chest (the real chest, 64-dim.js), the rubbing, the elixir, 크리온, the same hand
  const W = world("균열학자", null, LX);
  W.ch.lvl = 157; W.ch.sq.done.sq_kong_parcel = 1;
  take(W, "sq_bogle_shards", "bogle");
  const chest = () => LX.__t.dimChest(W.S, { lv: 30, got: {}, res: {}, carry: {}, opened: W.S.now - 6e5, clearAt: W.S.now, floor: 3, rt: LX.runtime(W.S, W.p.map), chest: { x: W.p.x, y: W.p.y } }, W.p);
  for (let i = 0; i < 4; i++) chest();
  assert.equal(bag(W, "q_shard"), 3, "one shard a rift, never more than three");
  done(W, "sq_bogle_shards", "bogle");
  take(W, "sq_borum_rubbing", "lib_borum");
  talk(W, "trail_crown");
  done(W, "sq_borum_rubbing", "lib_borum");
  take(W, "sq_bogle_essence", "bogle");
  make(W, "sq_bogle_essence", "el_xp", "bogle", [["m_h3", 30], ["m_o3", 15], ["flask", 15]], "alch");
  done(W, "sq_bogle_essence", "bogle");
  take(W, "sq_borum_krion", "lib_borum");
  W.to("cave", ...LX.atlas().maps.cave.entry);
  W.kill("boss");
  done(W, "sq_borum_krion", "lib_borum");
  take(W, "sq_bogle_hand", "bogle");
  talk(W, "lib_borum");
  done(W, "sq_bogle_hand", "bogle");
  assert.ok(W.ch.keep.kp_shardjar && W.ch.ach.includes("t_sq_bogle_hand"), "the shard jar and 「균열 기록관」");
}
// ── content-audit-2026-11-16 §3 packages: each chain in order, every step taken at its own level, givers where the players are
/** The chain `ids` is whole: in order (req.quest), levels inside [lo, hi] and rising, the giver on `maps[i]`, rewards on the audit scale. */
function chainShape(ids, lo, hi, maps, scaled = ids) {
  let prev = null;
  for (const [i, id] of ids.entries()) {
    const q = D.side.find((o) => o.id === id);
    assert.ok(q, `${id} is a valid side quest`);
    assert.ok(q.req.lv >= lo && q.req.lv <= hi, `${id}: Lv.${q.req.lv} in ${lo}–${hi}`);
    if (i) assert.ok(q.req.quest === ids[i - 1] && q.req.lv >= prev.req.lv, `${id} follows ${ids[i - 1]}`);
    assert.equal(q.giverMapId, maps[i], `${id}: the giver stands on ${maps[i]}`);
    assert.ok(L.atlas().maps[q.giverMapId].npcs.some((n) => n.id === q.giver), `${id}: ${q.giver} is really there`);
    const rws = [q.reward, ...(q.choice || []).map((o) => o.reward).filter(Boolean)], xp = Math.max(...rws.map((r) => r.xp)), cap = D.lvt[q.req.lv - 1];
    if (scaled.includes(id)) assert.ok(xp >= 0.12 * cap && xp <= 0.32 * cap && Math.max(...rws.map((r) => r.gold)) <= 60 * q.req.lv, `${id}: reward on the audit scale`);
    prev = q;
  }
}
{
  // Q2 「거꾸로 흐르는 물」: 토룩 → 울로 → 토룩 → 울로 → 노을, sewer to cave, into the airship arc at Lv.100
  chainShape(["sq_toruk_bottle", "sq_ullo_silt", "sq_toruk_wedge", "sq_ullo_sky"], 85, 99, ["sewer", "cave", "sewer", "cave"]);
  assert.deepEqual(["sq_bogle_essence", "sq_monggeul_bears"].map((id) => D.side.find((q) => q.id === id).req.lv), [96, 98], "two of the Lv.100 pile moved down");
  const W = world("물때지기");
  W.ch.lvl = 86;
  take(W, "sq_toruk_bottle", "trail_drain");
  assert.equal(bag(W, "q_upwater"), 1, "토룩 hands over the bottle");
  done(W, "sq_toruk_bottle", "trail_echo");
  W.ch.lvl = 89;
  assert.equal(sqOf(W.self(), "sq_ullo_silt").st, 0, "the silt waits for Lv.90");
  W.ch.lvl = 90;
  take(W, "sq_ullo_silt", "trail_echo");
  hunt(W, "sq_ullo_silt", "sewer", "leechmaw");
  done(W, "sq_ullo_silt", "trail_echo");
  W.ch.lvl = 94;
  W.meet("kangkang"); W.ch.life.craft.lv = 20;
  assert.match(W.act({ t: "craft_open", r: "q_wedge" }).error, /퀘스트/, "the wedge is cut only for 토룩's quest");
  take(W, "sq_toruk_wedge", "trail_drain");
  make(W, "sq_toruk_wedge", "q_wedge", "kangkang", [["m_o3", 30], ["m_w3", 30]], "craft");
  done(W, "sq_toruk_wedge", "trail_drain");
  assert.equal(bag(W, "q_wedge"), 0, "the wedge goes into the sluice");
  W.ch.lvl = 98;
  take(W, "sq_ullo_sky", "trail_echo");
  talk(W, "airship_signal");
  done(W, "sq_ullo_sky", "trail_echo");
  assert.equal(W.ch.sq.done.sq_ullo_sky, 1);
}
{
  // Q5 바스's arc as a story: the song to 솔 → the leaves → the old guard → charms singed on a campfire → the frost road (Lv.195)
  const BAS = ["sq_bas_roses", "sq_bas_leaves", "sq_bas_elites", "sq_bas_wardens", "sq_bas_frost"];
  chainShape(BAS, 168, 199, BAS.map(() => "maple"), ["sq_bas_frost"]);
  assert.ok(BAS.every((id) => D.side.find((q) => q.id === id).goal.type !== "kill"), "no kill step left in 바스's arc");
  const W = world("교대병");
  W.ch.lvl = 168;
  take(W, "sq_bas_roses", "hermit");
  assert.equal(bag(W, "q_thornsong"), 1, "바스 hands over the thorn");
  done(W, "sq_bas_roses", "willow_bard");
  W.ch.lvl = 170;
  take(W, "sq_bas_leaves", "hermit");
  W.ch.inv.push({ id: "m_h5", n: 8 });
  done(W, "sq_bas_leaves", "hermit");
  W.ch.lvl = 180;
  take(W, "sq_bas_elites", "hermit");
  W.to("maple", ...L.atlas().maps.maple.entry);
  for (let i = 0; i < 5; i++) W.kill("blightsquirrel", 1);
  done(W, "sq_bas_elites", "hermit");
  W.ch.lvl = 190;
  W.meet("hermit"); W.ch.life.cook.lv = 20;
  assert.match(W.act({ t: "craft_open", r: "q_mapcharm" }).error, /퀘스트/, "the charm is singed only for 바스's quest");
  take(W, "sq_bas_wardens", "hermit");
  make(W, "sq_bas_wardens", "q_mapcharm", "hermit", [["m_h5", 30]], "cook");
  done(W, "sq_bas_wardens", "hermit");
  assert.equal(bag(W, "q_mapcharm"), 0, "the charms go to the wardens");
  W.ch.lvl = 194;
  assert.equal(sqOf(W.self(), "sq_bas_frost").st, 0, "the frost road waits for Lv.195");
  W.ch.lvl = 195;
  take(W, "sq_bas_frost", "hermit");
  talk(W, "maple_frostgate");
  done(W, "sq_bas_frost", "hermit");
  assert.ok(W.ch.ach.includes("t_sq_bas_frost"), "「마지막 교대병」");
  // an old sheet mid-way through the retired kill steps loads clean: the thorn is handed over, the count fits the new goal
  const old = L.newChar("옛파수꾼", "warrior", []);
  old.sq = { on: { sq_bas_roses: 7, sq_bas_wardens: 5 }, done: { sq_bas_elites: 1 } };
  const O = world("옛파수꾼", old);
  assert.equal(bag(O, "q_thornsong"), 1, "the thorn for 솔 is in the bag");
  assert.ok(O.ch.sq.on.sq_bas_wardens <= 3, "the kill count is clamped to the charm count");
}
for (const pick of [0, 1]) {
  // Q1 「나루터의 먹물」: 사공 여울 at the 먹빛 호수 landing — 먹선, the lone pagoda, the clear oil, the lamp in the reeds, where to hang it
  const YEOUL = ["sq_yeoul_ferry", "sq_yeoul_tower", "sq_yeoul_oil", "sq_yeoul_lamp", "sq_yeoul_end"];
  chainShape(YEOUL, 157, 181, YEOUL.map(() => "inklake"));
  assert.ok(YEOUL.filter((id) => ["kill", "elite", "fb"].includes(D.side.find((q) => q.id === id).goal.type)).length <= 1, "at most one fight in five");
  const ink = L.atlas().maps.inklake, at = (id) => ink.npcs.find((n) => n.id === id);
  const stone = ink.stones[0];
  assert.ok(Math.hypot(at("ink_yeoul").x - stone.x, at("ink_yeoul").y - stone.y) <= 4, "여울 stands by the 나루터 stone");
  assert.ok(Math.hypot(at("ink_pagoda").x - ink.stones[2].x, at("ink_pagoda").y - ink.stones[2].y) <= 4, "the lamp hook is on the 외딴 탑 섬");
  const W = world("나룻손님" + pick);
  W.ch.lvl = 158;
  take(W, "sq_yeoul_ferry", "ink_yeoul");
  talk(W, "camp_inklake");
  done(W, "sq_yeoul_ferry", "ink_yeoul");
  W.ch.lvl = 163;
  take(W, "sq_yeoul_tower", "ink_yeoul");
  talk(W, "ink_pagoda");
  done(W, "sq_yeoul_tower", "ink_yeoul");
  W.ch.lvl = 168;
  W.meet("bogle"); W.ch.life.alch.lv = 30;
  assert.match(W.act({ t: "craft_open", r: "q_lampoil" }).error, /퀘스트/, "the lamp oil is brewed only for 여울's quest");
  take(W, "sq_yeoul_oil", "ink_yeoul");
  make(W, "sq_yeoul_oil", "q_lampoil", "bogle", [["m_h4", 15], ["m_h5", 15], ["flask", 15]], "alch");
  done(W, "sq_yeoul_oil", "ink_yeoul");
  assert.equal(bag(W, "q_lampoil"), 0, "the oil goes to 여울");
  W.ch.lvl = 174;
  take(W, "sq_yeoul_lamp", "ink_yeoul");
  W.to("inklake", ...ink.entry);
  W.kill("spiderhand_blood", 0);
  W.kill("gravrose_blood", 1);
  assert.equal(sqOf(W.self(), "sq_yeoul_lamp").n, 0, "a plain spider or another elite is not the one");
  W.kill("spiderhand_blood", 1);
  done(W, "sq_yeoul_lamp", "ink_yeoul");
  W.ch.lvl = 179;
  assert.equal(sqOf(W.self(), "sq_yeoul_end").st, 0, "the last answer waits for Lv.180");
  W.ch.lvl = 180;
  take(W, "sq_yeoul_end");
  done(W, "sq_yeoul_end", null, pick);
  assert.ok(W.ch.ach.includes(`t_sq_yeoul_end_${pick}`) && !W.ch.ach.includes(`t_sq_yeoul_end_${1 - pick}`), "this answer's title only");
}
// every new quest item is asked for by some quest (no orphans)
for (const id of ["q_upwater", "q_silt", "q_wedge", "q_thornsong", "q_mapcharm", "q_lampoil"]) assert.ok(D.side.some((q) => q.goal.item === id), `${id} is used`);
// every arc step is 추적-resolvable: a giver and hand-in NPC on a real map, a target the client can walk to
for (const q of D.side.filter((o) => /^sq_(chomi|aru|noeul_stone|sora|elder_chart|eunha|samak|norang|galpi|borum_ink|bogle_(shards|essence|hand)|borum_(rubbing|krion)|toruk_|ullo_|bas_|yeoul_)/.test(o.id))) {
  assert.ok(q.giverMapId && L.atlas().maps[q.giverMapId].npcs.some((n) => n.id === q.giver), `${q.id}: giver stands on ${q.giverMapId}`);
  assert.ok(q.turnInMap && q.target, `${q.id}: hand-in and target named`);
  if (q.goal.mob) assert.ok(D.maps.some((m) => m.mobs.includes(q.goal.mob)), `${q.id}: ${q.goal.mob} lives somewhere`);
}
// ── retired kill quests (P5): an old sheet mid-way or done loads clean
{
  const old = L.newChar("옛기록자", "warrior", []);
  old.sq = { on: { sq_borum_blight: 7, sq_bogle_crows: 3 }, done: { sq_bawi_deer: 1, sq_dongdong_pigeons: 2 } };
  const W = world("옛기록자", old);
  W.ch.lvl = 160;
  assert.deepEqual(W.ch.sq.on, {}, "a retired quest under way is dropped");
  assert.deepEqual([W.ch.sq.done.sq_bawi_deer, W.ch.sq.done.sq_dongdong_pigeons], [1, 2], "finished ones stay remembered");
  const s = W.self();
  for (const id of ["sq_borum_blight", "sq_bogle_crows", "sq_bawi_deer", "sq_dongdong_pigeons"]) assert.equal(sqOf(s, id), undefined, `${id} is gone`);
  assert.equal(sqOf(s, "sq_galpi_records").st, 1, "단풍 왕도's records are the blight quest's place now");
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
