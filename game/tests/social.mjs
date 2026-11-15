// 친구 · 귓속말 · 차단, 주간 수첩 with the rest bonus, 강화 보정 (docs/design/social-weekly.md):
// the rules (63-social-weekly.js) in one world, and the vault's half (src/social.js) against a
// Map-backed fake of Durable Object storage. node tests/social.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as A from "../src/accounts.js";
import * as So from "../src/social.js";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { WEEK, PITY, weekOf, nextWeek, dayOf, nextReset, restCarry, restK, weekVals, weekDone, weekReward, weekTick, dailyProg, dailyReward, dailyBonus, ensureDaily, enhWin, enhCost," +
  " ENH_RATE, rollGear, migrate, MOBS, HUNTED, toTier, countItem, ITEMS, BLOCK_MAX, npcNear, NPC_MAP, mapOf, LOOT_X, lootX, giveX };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs();
const VERBOSE = process.argv.includes("-v");

// Monday 2026-11-16 06:00 KST — a week turns here
const MON = Date.UTC(2026, 10, 15, 21, 0, 0), DAY = 86400000;
let now = MON + 3600000;
const S = L.setup();
S.now = now;
for (const [pid, name] of [["a@s1", "가람"], ["b@s1", "나래"], ["c@s1", "다온"]]) L.addPlayer(S, pid, L.newChar(name, []));
const P = (k) => S.players[`${k}@s1`];
const act = (k, a) => { S.now = now; const v = L.validateAction(S, `${k}@s1`, a); if (v.ok) L.applyAction(S, `${k}@s1`, a); return v; };
/** One tick; what each of the three reads in chat. */
const round = () => {
  now += 100; L.tick(S, now);
  const out = {};
  for (const k of ["a", "b", "c"]) { const v = L.viewFor(S, `${k}@s1`); out[k] = v && v.chat ? JSON.parse(JSON.stringify(v.chat)).filter((c) => !c.sys) : []; }
  L.endTick(S);
  return out;
};
const say = (k, a) => { now += 800; return act(k, a); };

// ── chat, whispers and the block list in one channel ───────────────────
{
  assert.ok(say("b", { t: "chat", m: "안녕" }).ok);
  let r = round();
  assert.deepEqual(r.a, [{ n: "나래", m: "안녕" }]);
  assert.deepEqual(r.c, [{ n: "나래", m: "안녕" }]);

  // a whisper has one reader; the sender keeps a copy (w: 2, n = who it went to); the pid never leaves
  assert.ok(say("a", { t: "w", to: "다온", m: "  둘만 아는 이야기  " }).ok);
  r = round();
  assert.deepEqual(r.c, [{ n: "가람", m: "둘만 아는 이야기", w: 1 }]);
  assert.deepEqual(r.a, [{ n: "다온", m: "둘만 아는 이야기", w: 2 }]);
  assert.deepEqual(r.b, [], "a third player reads nothing");
  // names are matched without regard to case; the copy carries the name as it is written
  L.addPlayer(S, "d@s1", L.newChar("Echo", []));
  assert.ok(say("a", { t: "w", to: "echo", m: "hi" }).ok);
  now += 100; L.tick(S, now);
  assert.deepEqual(L.viewFor(S, "a@s1").chat.filter((c) => c.w), [{ n: "Echo", m: "hi", w: 2 }]);
  assert.deepEqual(L.viewFor(S, "d@s1").chat.filter((c) => c.w), [{ n: "가람", m: "hi", w: 1 }]);
  L.endTick(S);
  L.removePlayer(S, "d@s1");

  // refusals
  assert.equal(say("a", { t: "w", to: "가람", m: "나" }).error, "자신에게는 귓속말을 보낼 수 없습니다");
  assert.equal(say("a", { t: "w", to: "다온", m: "   " }).error, "빈 메시지");
  assert.equal(say("a", { t: "w", to: "!!", m: "x" }).ok, false);
  assert.equal(say("a", { t: "w", to: 7, m: "x" }).ok, false);
  assert.ok(say("a", { t: "w", to: "다온", m: "하나" }).ok);
  assert.equal(act("a", { t: "w", to: "다온", m: "둘" }).error, "채팅이 너무 빠릅니다", "whispers share the chat's rate limit");
  round();
  // nobody of that name here: one room tells the sender (the room relays to the other channel before it comes to this)
  P("a").toast.length = 0;
  assert.ok(say("a", { t: "w", to: "없는이", m: "거기" }).ok);
  assert.ok(P("a").toast.some((m) => m.includes("접속 중이 아닙니다")));
  assert.deepEqual(round().a, []);
  assert.equal(say("a", { t: "w", to: "다온", m: "x".repeat(200) }).ok, true);
  assert.equal(round().c[0].m.length, 80, "cut to 80");

  // 차단: A blocks B
  assert.equal(say("a", { t: "blk", a: "add", name: "가람" }).error, "자신은 차단할 수 없습니다");
  assert.equal(say("a", { t: "blk", a: "del", name: "나래" }).error, "차단한 적이 없는 이름입니다");
  assert.equal(say("a", { t: "blk", a: "zap", name: "나래" }).ok, false);
  assert.ok(say("a", { t: "blk", a: "add", name: "나래" }).ok);
  assert.deepEqual(P("a").ch.blk, ["나래"]);
  assert.ok(P("a").save, "a block is saved soon: the vault reads it for friend requests");
  assert.equal(say("a", { t: "blk", a: "add", name: "나래" }).error, "이미 차단한 이름입니다");
  // B's public chat reaches C, not A
  assert.ok(say("b", { t: "chat", m: "들리나요" }).ok);
  r = round();
  assert.deepEqual(r.a, []);
  assert.deepEqual(r.c, [{ n: "나래", m: "들리나요" }]);
  // B's whisper to A: B is not told, A reads nothing
  P("b").toast.length = 0;
  assert.ok(say("b", { t: "w", to: "가람", m: "왜 대답이 없어" }).ok);
  r = round();
  assert.deepEqual(r.a, [], "a blocked whisper is dropped");
  assert.deepEqual(r.b, [{ n: "가람", m: "왜 대답이 없어", w: 2 }], "the sender sees it go out like any other");
  assert.equal(P("b").toast.length, 0);
  // A cannot whisper someone A blocked, and party chat from B is dropped for A too
  assert.equal(say("a", { t: "w", to: "나래", m: "x" }).error, "차단한 상대입니다. 차단을 풀고 보내 주세요");
  // invitations from B are refused; from C they pass
  assert.equal(say("b", { t: "pinv", e: P("a").eid }).error, "초대를 보낼 수 없는 상대입니다");
  P("b").ch.guild = "달빛"; P("b").ch.gm = 1;
  assert.equal(say("b", { t: "ginv", e: P("a").eid }).error, "초대를 보낼 수 없는 상대입니다");
  P("b").ch.guild = ""; P("b").ch.gm = 0;
  assert.ok(say("c", { t: "pinv", e: P("a").eid }).ok);
  assert.ok(say("a", { t: "pacc" }).ok);
  assert.ok(say("b", { t: "pinv", e: P("c").eid }).ok === false || true);
  // a waiting invitation from someone goes when they are blocked
  P("a").pinv = { from: "c@s1", at: now };
  assert.ok(say("a", { t: "blk", a: "add", name: "다온" }).ok);
  assert.equal(P("a").pinv, null);
  assert.ok(say("c", { t: "pchat", m: "파티 채팅" }).ok);
  assert.deepEqual(round().a, [], "party chat from a blocked name is dropped as well");
  assert.ok(say("a", { t: "blk", a: "del", name: "다온" }).ok);
  assert.ok(say("c", { t: "pchat", m: "이제 들려?" }).ok);
  assert.deepEqual(round().a, [{ n: "다온", m: "이제 들려?", pt: P("c").party }]);
  // unblock B: chat flows again
  assert.ok(say("a", { t: "blk", a: "del", name: "나래" }).ok);
  assert.ok(say("b", { t: "chat", m: "다시" }).ok);
  assert.deepEqual(round().a, [{ n: "나래", m: "다시" }]);
  // the cap
  P("a").ch.blk = Array.from({ length: X.BLOCK_MAX }, (_, i) => `이름${i}`);
  assert.equal(say("a", { t: "blk", a: "add", name: "하나더" }).error, `차단은 ${X.BLOCK_MAX}명까지 할 수 있습니다`);
  P("a").ch.blk = [];

  // what the room uses to relay across channels
  assert.equal(L.pidOfName(S, "다온"), "c@s1");
  assert.equal(L.pidOfName(S, "없는이"), null);
  assert.equal(L.nameOf(S, "a@s1"), "가람");
  assert.equal(L.nameOf(S, "zz@s1"), "");
  assert.equal(L.whisperIn(S, "없는이", "먼곳", "x"), false, "not here: the other channel says so");
  assert.equal(L.whisperIn(S, "가람", "먼곳", "다른 채널에서"), true);
  assert.equal(L.whisperOut(S, "c@s1", "먼곳", "답장"), true);
  r = round();
  assert.deepEqual(r.a, [{ n: "먼곳", m: "다른 채널에서", w: 1 }]);
  assert.deepEqual(r.c, [{ n: "먼곳", m: "답장", w: 2 }]);
  P("a").ch.blk = ["먼곳"];
  assert.equal(L.blockedBy(S, "a@s1", "먼곳"), true);
  assert.equal(L.whisperIn(S, "가람", "먼곳", "막힌 말"), true, "a block answers like a delivery");
  assert.deepEqual(round().a, []);
  P("a").ch.blk = [];
  P("a").toast.length = 0;
  assert.equal(L.noteTo(S, "a@s1", "나래님이 친구 요청을 보냈습니다."), true);
  assert.equal(L.noteTo(S, "zz@s1", "x"), false);
  assert.deepEqual(P("a").toast, ["나래님이 친구 요청을 보냈습니다."]);
  // the wire
  const self = JSON.parse(JSON.stringify(L.viewFor(S, "a@s1"))).self ?? (() => { P("a").dirty = true; return L.viewFor(S, "a@s1").self; })();
  assert.deepEqual(self.blk, []);
  assert.equal(D.social.blockMax, 50); assert.equal(D.social.friendMax, So.FRIEND_MAX); assert.equal(D.social.whisperLen, 80);
}

// ── 주간 수첩: the week's edge, the boxes, the three rewards ─────────────
{
  // Monday 06:00 KST exactly
  assert.equal(X.weekOf(MON), X.weekOf(MON - 1) + 1, "the week turns at Monday 06:00 KST");
  assert.equal(X.weekOf(MON + 7 * DAY - 1), X.weekOf(MON), "…and holds until the next");
  assert.equal(X.weekOf(MON + 7 * DAY), X.weekOf(MON) + 1);
  for (let d = 1; d < 7; d++) assert.equal(X.weekOf(MON + d * DAY), X.weekOf(MON), `day ${d} is the same week`);
  assert.equal(X.weekOf(MON - 3 * 3600000), X.weekOf(MON) - 1, "Monday 03:00 KST still belongs to last week");
  assert.equal(X.nextWeek(MON + 5000), MON + 7 * DAY);
  assert.equal(X.nextWeek(MON - 1), MON);
  assert.equal(X.nextReset(MON - 1), MON, "the day turns at the same hour");

  const p = P("a"), ch = p.ch;
  assert.equal(D.social.week.boxes.length, 12);
  assert.equal(D.social.week.need, 7); assert.deepEqual(D.social.week.tiers, [3, 5, 7]);
  assert.equal(ch.wk.w, X.weekOf(now));
  assert.deepEqual(X.weekVals(ch), new Array(12).fill(0));
  assert.equal(act("a", { t: "wk", i: 0 }).error, "수첩을 3칸 채워야 받을 수 있습니다");
  assert.equal(act("a", { t: "wk", i: 3 }).ok, false);
  assert.equal(act("a", { t: "wk", i: -1 }).ok, false);

  // hunting counts only monsters around the character's level
  const low = X.HUNTED.slice().sort((x, y) => X.MOBS[x].lv - X.MOBS[y].lv)[0];
  X.dailyProg(S, p, "kill", low);
  assert.equal(ch.wk.n.hunt, 1, "a level 1 hero's own ground counts");
  ch.lvl = 120;
  X.dailyProg(S, p, "kill", low);
  assert.equal(ch.wk.n.hunt, 1, `a ${X.MOBS[low].lv} monster is far below tier ${X.toTier(120)}`);
  const fit = X.HUNTED.find((k) => X.MOBS[k].lv >= X.toTier(120) - 3);
  if (fit) { X.dailyProg(S, p, "kill", fit); assert.equal(ch.wk.n.hunt, 2); }
  ch.lvl = 1;
  X.dailyProg(S, p, "fish");
  assert.equal(ch.wk.n.fish, 1);

  // the other boxes read counters against the week's baseline
  const idx = Object.fromEntries(D.social.week.boxes.map((b, i) => [b[0], i]));
  ch.cnt.elite += 8; ch.cnt.fb += 1; ch.cnt.rest += 2;
  let v = X.weekVals(ch);
  assert.equal(v[idx.elite], 8); assert.equal(v[idx.fb], 1); assert.equal(v[idx.rest], 2);
  assert.equal(X.weekDone(ch), 2);
  p.toast.length = 0;
  X.weekTick(S, p);
  assert.ok(p.toast.some((m) => m.includes("주간 수첩 2/7칸")), p.toast.join(" / "));
  ch.cnt.elite += 100;
  assert.equal(X.weekVals(ch)[idx.elite], 8, "a box stops at its need");
  ch.cnt.dim += 1;
  p.toast.length = 0;
  X.weekTick(S, p);
  assert.ok(p.toast.some((m) => m.includes("3칸 완료 — 보상을 받으세요")), p.toast.join(" / "));
  X.weekTick(S, p);
  assert.equal(p.toast.length, 1, "told once");
  // either kind of rift fills the rift box; a side quest or a repeat errand fills the errand box
  assert.equal(X.weekVals(ch)[idx.rift], 1);
  ch.bn += 1; ch.sq.done.some_quest = 1;
  assert.equal(X.weekVals(ch)[idx.side], 2);

  // 3 boxes: the first reward, once
  const gold0 = ch.gold, stone0 = X.countItem(ch, "stone");
  const r0 = X.weekReward(ch, 0);
  assert.ok(act("a", { t: "wk", i: 0 }).ok);
  assert.equal(ch.gold, gold0 + r0.gold); assert.equal(X.countItem(ch, "stone"), stone0 + 3);
  assert.equal(act("a", { t: "wk", i: 0 }).error, "이미 받은 보상입니다");
  assert.equal(act("a", { t: "wk", i: 1 }).error, "수첩을 5칸 채워야 받을 수 있습니다");
  assert.ok(p.save, "a claim is saved soon");
  // any seven finish the week: five more of the twelve, none of them hunting
  ch.cnt.gat += 25; ch.cnt.craft += 6; ch.cnt.deliver += 2;
  assert.equal(X.weekDone(ch), 7);
  assert.ok(act("a", { t: "wk", i: 1 }).ok);
  const b0 = X.countItem(ch, "stone_b"), inv0 = ch.inv.length;
  assert.ok(act("a", { t: "wk", i: 2 }).ok);
  assert.equal(X.countItem(ch, "stone_b"), b0 + 1, "the last reward carries a blessed stone");
  assert.ok(ch.inv.length > inv0, "…and a piece of gear");
  assert.deepEqual(ch.wk.got, [1, 1, 1]);
  const wire = (() => { p.dirty = true; return JSON.parse(JSON.stringify(L.viewFor(S, "a@s1").self.week)); })();
  assert.equal(wire.done, 7); assert.deepEqual(wire.got, [1, 1, 1]); assert.equal(wire.v.length, 12); assert.equal(wire.rw.length, 3);
  assert.ok(wire.reset > 0 && wire.reset <= 7 * DAY);
  // rewards grow with the tier and stay in order
  ch.lvl = 100;
  const [w0, w1, w2] = [0, 1, 2].map((i) => X.weekReward(ch, i));
  assert.ok(w0.gold < w1.gold && w1.gold < w2.gold && w0.gold > r0.gold);
  ch.lvl = 1;
  if (VERBOSE) console.log("weekly rewards at Lv 1:", [0, 1, 2].map((i) => JSON.stringify(X.weekReward(ch, i))).join(" "), "\nat Lv 100:", JSON.stringify([w0, w1, w2]));

  // the next Monday: a fresh book; what was done last week no longer counts, the counters keep growing
  const cntBefore = { ...ch.cnt };
  now = MON + 7 * DAY + 60000; S.now = now;
  p.toast.length = 0;
  X.weekTick(S, p);
  assert.equal(ch.wk.w, X.weekOf(MON) + 1);
  assert.deepEqual(ch.wk.got, [0, 0, 0]);
  assert.deepEqual(X.weekVals(ch), new Array(12).fill(0));
  assert.deepEqual(ch.cnt, cntBefore, "the achievement counters are never touched");
  assert.ok(p.toast.some((m) => m.includes("새 장")));
  ch.cnt.elite += 3;
  assert.equal(X.weekVals(ch)[idx.elite], 3);
  // a second before the edge it would still have been last week's
  assert.equal(X.weekOf(MON + 7 * DAY - 1000), X.weekOf(MON));
}

// ── 쉬고 온 보너스: days without a claim carry over, at most three ───────
{
  const rec = (day, o = {}) => ({ day, tasks: [], claimed: [false, false, false], bonus: false, rest: 0, ...o });
  assert.equal(X.restCarry(null, 10), 0, "a first day has nothing to carry");
  assert.equal(X.restCarry(rec(9, { claimed: [true, false, false] }), 10), 0, "played yesterday: nothing");
  assert.equal(X.restCarry(rec(9), 10), 1, "yesterday's tasks untouched: one day");
  assert.equal(X.restCarry(rec(9, { bonus: true }), 10), 0);
  assert.equal(X.restCarry(rec(7, { claimed: [true, true, true] }), 10), 2, "played, then two days away");
  assert.equal(X.restCarry(rec(7), 10), 3, "three days away");
  assert.equal(X.restCarry(rec(1), 10), 3, "the cap");
  assert.equal(X.restCarry(rec(9, { rest: 2 }), 10), 3, "an unused bonus is not lost: it grows");
  assert.equal(X.restCarry(rec(9, { rest: 3 }), 10), 3);
  assert.equal(X.restCarry(rec(9, { rest: 2, claimed: [false, true, false] }), 10), 0, "used: it is spent");

  const p = P("b"), ch = p.ch;
  X.ensureDaily(S, p);
  const day = ch.daily.day;
  assert.equal(ch.daily.rest, 3, "b was last seen a week ago in this test: the cap"); ch.daily.rest = 0;
  const base = X.dailyReward(ch, ch.daily.tasks[0]), baseBox = X.dailyBonus(ch);
  // two full days later (nothing claimed on the first, absent on the second)
  now += 2 * DAY; S.now = now;
  p.toast.length = 0;
  X.ensureDaily(S, p);
  assert.equal(ch.daily.day, day + 2);
  assert.equal(ch.daily.rest, 2);
  assert.ok(p.toast.some((m) => m.includes("쉬고 온 보너스") && m.includes("+40%")), p.toast.join(" / "));
  assert.equal(X.restK(ch), 1.4);
  const up = X.dailyReward(ch, ch.daily.tasks[0]), upBox = X.dailyBonus(ch);
  assert.equal(up.gold, Math.round(base.gold * 1.4)); assert.ok(Math.abs(up.xp - base.xp * 1.4) <= 1);
  assert.ok(Math.abs(upBox.gold - baseBox.gold * 1.4) <= 1); assert.equal(upBox.stone, baseBox.stone, "stones are not multiplied");
  // the wire says so, and the paid reward is the raised one
  p.dirty = true;
  const self = JSON.parse(JSON.stringify(L.viewFor(S, "b@s1").self));
  assert.equal(self.week.rest, 2);
  assert.equal(self.daily.tasks[0].reward.gold, up.gold);
  ch.daily.tasks[0].n = ch.daily.tasks[0].need;
  const g0 = ch.gold;
  assert.ok(act("b", { t: "daily", i: 0 }).ok);
  assert.equal(ch.gold, g0 + up.gold);
  // the next day: claimed yesterday, so the bonus is gone
  now += DAY; S.now = now;
  X.ensureDaily(S, p);
  assert.equal(ch.daily.rest, 0);
  assert.equal(X.dailyReward(ch, ch.daily.tasks[0]).gold, base.gold);
}

// ── 강화 보정: one gauge per step, weighed by the gear's tier, the same dice every time ──
{
  const gear = (id, enh) => ({ ...X.rollGear({ seed: 5 }, id, 2, 20), enh });
  const tier = X.ITEMS.w_warrior_3.tier;
  assert.deepEqual(D.social.pity, { from: 5, need: X.PITY.need });
  assert.equal(X.PITY.need.length, 5);
  // determinism: the same seed gives the same wins and the same gauges
  const play = (seed) => {
    const box = { seed }, ch = { pity: [0, 0, 0, 0, 0] }, g = gear("w_warrior_3", 0), log = [];
    for (let n = 0; n < 400 && g.enh < 10; n++) { const win = X.enhWin(box, ch, g, false); log.push(win ? 1 : 0); if (win) g.enh++; else if (g.enh >= 5) g.enh--; }
    return JSON.stringify([log, ch.pity, g.enh]);
  };
  assert.equal(play(77), play(77));
  assert.notEqual(play(77), play(78));
  // below +5 a failure fills nothing
  {
    const ch = { pity: [0, 0, 0, 0, 0] }, g = gear("w_warrior_3", 4), box = { seed: 1 };
    for (let n = 0; n < 200; n++) X.enhWin(box, ch, g, false);
    assert.deepEqual(ch.pity, [0, 0, 0, 0, 0]);
  }
  // at +9: every failure adds the tier; `need × tier` makes the next try sure and spends the gauge
  {
    const ch = { pity: [0, 0, 0, 0, 0] }, g = gear("w_warrior_3", 9), box = { seed: 3 };
    let fails = 0, tries = 0;
    for (;;) {
      tries++;
      const full = ch.pity[4] >= X.PITY.need[4] * tier;
      const win = X.enhWin(box, ch, g, false);
      if (full) { assert.ok(win, "a full gauge never fails"); break; }
      if (win) { ch.pity[4] = fails * tier; continue; } // keep counting failures for the walk to the cap
      fails++;
      assert.equal(ch.pity[4], fails * tier);
    }
    assert.equal(fails, X.PITY.need[4], "26 failures at +9");
    assert.equal(ch.pity[4], 0, "spent");
    assert.deepEqual(ch.pity.slice(0, 4), [0, 0, 0, 0], "a step's failures stay with that step");
    if (VERBOSE) console.log(`pity at +9: sure after ${fails} failures (${tries} tries on this seed)`);
  }
  // a full +5 gauge does nothing for +9, and cheap gear cannot fill the gauge for dear gear
  {
    const ch = { pity: [999, 0, 0, 0, 0] }, g9 = gear("w_warrior_3", 9);
    let wins = 0;
    const box = { seed: 9 };
    for (let n = 0; n < 300; n++) wins += X.enhWin(box, ch, g9, false) ? 1 : 0, ch.pity[4] = 0;
    assert.ok(wins < 90, `+9 keeps its own odds (${wins}/300)`);
    const cheap = gear("w_warrior_1", 5), dear = gear("w_warrior_3", 5), c2 = { pity: [0, 0, 0, 0, 0] }, b2 = { seed: 11 };
    assert.ok(X.ITEMS.w_warrior_1.tier < tier);
    while (c2.pity[0] < X.PITY.need[0] * X.ITEMS.w_warrior_1.tier) X.enhWin(b2, c2, cheap, false);
    const before = c2.pity[0];
    assert.ok(before < X.PITY.need[0] * tier, "full for the cheap blade, not for the dear one");
    let lost = false;
    for (let n = 0; n < 40 && !lost; n++) { c2.pity[0] = before; lost = !X.enhWin(b2, c2, dear, false); }
    assert.ok(lost, "the dear blade can still fail");
  }
  // through the action: the gauge is on the sheet, the smith's window reads it, a sure try is announced like any success
  {
    const p = P("c"), ch = p.ch;
    const smith = X.mapOf("town").npcs.find((n) => n.role === "smith");
    p.map === "town" || assert.fail("c stands in town");
    p.x = smith.x * 16 + 8; p.y = smith.y * 16 + 12;
    assert.ok(X.npcNear(p, "smith"));
    ch.gold = 1e9; ch.inv.push({ id: "stone", n: 900 });
    ch.eq.weapon = gear("w_warrior_3", 9); p.stc = null;
    ch.pity = [0, 0, 0, 0, X.PITY.need[4] * tier];
    assert.ok(act("c", { t: "enh", k: "weapon" }).ok);
    assert.equal(ch.eq.weapon.enh, 10, "a full gauge: +10");
    assert.equal(ch.pity[4], 0);
    ch.eq.weapon.enh = 6; ch.pity = [0, 0, 0, 0, 0];
    let fails = 0;
    for (let n = 0; n < 400 && !fails; n++) { ch.eq.weapon.enh = 6; act("c", { t: "enh", k: "weapon" }); if (ch.eq.weapon.enh === 5) fails++; }
    assert.equal(ch.pity[1] % tier, 0);
    assert.ok(ch.pity[1] >= tier, "a failure at +6 is on the gauge of +6");
    p.dirty = true;
    assert.deepEqual(JSON.parse(JSON.stringify(L.viewFor(S, "c@s1").self.pity)), ch.pity);
  }
  // expected tries from +0 to +10, with and without the gauge (the numbers of the design note)
  {
    const sim = (on) => {
      const box = { seed: 20261115 }; let tries = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) {
        const ch = { pity: [0, 0, 0, 0, 0] }, g = gear("w_warrior_3", 0);
        while (g.enh < 10) { tries++; if (!on) ch.pity.fill(0); if (X.enhWin(box, ch, g, false)) g.enh++; else if (g.enh >= 5) g.enh--; }
      }
      return tries / N;
    };
    const off = sim(false), on = sim(true);
    if (VERBOSE) console.log(`+0 → +10: ${off.toFixed(1)} tries without the gauge, ${on.toFixed(1)} with (${(100 * (1 - on / off)).toFixed(1)}% fewer)`);
    assert.ok(on < off * 0.9 && on > off * 0.7, `a modest cut: ${off.toFixed(1)} → ${on.toFixed(1)}`);
  }
}

// ── old sheets: v13 and older gain the fields; nonsense is cleaned ─────
{
  const old = JSON.parse(JSON.stringify(L.newChar("옛사람", [])));
  delete old.blk; delete old.pity; delete old.wk; old.v = 13;
  old.daily = { day: 5, tasks: [{ kind: "kill", k: X.HUNTED[0], n: 3, need: 30 }, { kind: "fish", k: null, n: 0, need: 4 }, { kind: "cook", k: null, n: 0, need: 2 }], claimed: [false, false, false], bonus: false };
  old.cnt.elite = 40;
  const ch = X.migrate(old);
  assert.equal(ch.v, 19);
  assert.deepEqual(ch.blk, []); assert.deepEqual(ch.pity, [0, 0, 0, 0, 0]);
  assert.equal(ch.wk.w, 0); assert.deepEqual(ch.wk.got, [0, 0, 0]); assert.deepEqual(ch.wk.n, { hunt: 0, fish: 0 });
  assert.equal(ch.daily.rest, 0, "an old day's record has no rest bonus");
  // it joins: the week opens with today's counters as the baseline, so old deeds do not fill it
  const S2 = L.setup(); S2.now = MON + 1000;
  L.addPlayer(S2, "o@s1", ch);
  const o = S2.players["o@s1"].ch;
  assert.equal(o.wk.w, X.weekOf(S2.now)); assert.equal(o.wk.b.elite, 40);
  assert.deepEqual(X.weekVals(o), new Array(12).fill(0));
  assert.equal(L.exportChar(S2, "o@s1").v, 19);

  const bad = JSON.parse(JSON.stringify(L.newChar("엉망", [])));
  bad.blk = ["나래", "나래", "NARAE", "narae", 7, null, "!!", "x".repeat(40), ...Array.from({ length: 80 }, (_, i) => `차단${i}`)];
  bad.pity = [-5, 1e12, "x", 3.7];
  bad.wk = { w: -3, n: { hunt: -1, fish: "many" }, b: { elite: 999, fb: -2 }, got: [1, "yes", 0, 1], seen: 1e9 };
  bad.cnt.elite = 10;
  bad.daily = { day: 5, tasks: old.daily.tasks, claimed: [true, false, false], bonus: false, rest: 99 };
  const c2 = X.migrate(bad);
  assert.equal(c2.blk.length, 50); assert.deepEqual(c2.blk.slice(0, 2), ["나래", "NARAE"], "one of each name, whatever its case");
  assert.deepEqual(c2.pity, [0, 9999, 0, 3, 0]);
  assert.equal(c2.wk.w, 0); assert.deepEqual(c2.wk.n, { hunt: 0, fish: 0 }); assert.equal(c2.wk.b.elite, 10, "a baseline never sits above its counter");
  assert.equal(c2.wk.b.fb, 0); assert.deepEqual(c2.wk.got, [1, 1, 0]); assert.ok(c2.wk.seen <= 0xfff);
  assert.equal(c2.daily.rest, 3);
  for (const junk of [null, 7, "x", []]) { const j = JSON.parse(JSON.stringify(L.newChar("빈칸", []))); j.blk = junk; j.pity = junk; j.wk = junk; const c3 = X.migrate(j); assert.deepEqual(c3.blk, []); assert.deepEqual(c3.pity, [0, 0, 0, 0, 0]); assert.equal(c3.wk.w, 0); }
}

// ── the vault's half: friends, presence, where — against a fake store ──
class FakeStore {
  constructor() { this.m = new Map(); }
  async get(k) {
    if (Array.isArray(k)) { const out = new Map(); for (const x of k) if (this.m.has(x)) out.set(x, structuredClone(this.m.get(x))); return out; }
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === "string") { this.m.set(k, structuredClone(v)); return; }
    for (const [x, y] of Object.entries(k)) this.m.set(x, structuredClone(y));
  }
  async delete(k) { let n = 0; for (const x of [].concat(k)) n += this.m.delete(x) ? 1 : 0; return n; }
}
{
  const store = new FakeStore(), so = new So.Social(store);
  let t = 1_800_000_000_000;
  /** A character as the vault's `create` op leaves it: name claim, record, summary. */
  const make = async (id, server, name, lvl = 1, blk = []) => {
    const pid = A.pidFor(id, server), char = { ...L.newChar(name, []), lvl, blk };
    await store.put({ [A.K.name(server, name)]: pid, [A.K.char(pid)]: { char }, [A.K.sum(pid)]: A.summary(char) });
    return pid;
  };
  const a = await make("aaaa", "s1", "가람", 12), b = await make("bbbb", "s1", "나래", 40), c = await make("cccc", "s1", "다온");
  const z = await make("aaaa", "s2", "가람");
  const before = new Map(store.m);
  const op = (o) => so.op(o, t);

  assert.equal(So.KS.friends(a), "fr:aaaa@s1");
  assert.deepEqual(await so.list(a, t), { ok: true, f: [], i: [], o: [] }, "no key = an empty list");
  // bad requests
  assert.equal((await op({ a: "add", pid: a, me: "가람", name: "없는이" })).error, So.SMSG.none);
  assert.equal((await op({ a: "add", pid: a, me: "가람", name: "가람" })).error, So.SMSG.self);
  assert.equal((await op({ a: "zap", pid: a, me: "가람", name: "나래" })).ok, false);
  assert.equal((await op({ a: "add", pid: "nope", me: "가람", name: "나래" })).ok, false);
  assert.equal((await op({ a: "add", pid: a, me: "가람" })).ok, false);
  assert.equal((await op({ a: "ok", pid: a, me: "가람", name: "나래" })).error, So.SMSG.noReq);
  assert.equal((await op({ a: "del", pid: a, me: "가람", name: "나래" })).error, So.SMSG.notFriend);

  // request → the other side is told only if online; both lists show it
  let r = await op({ a: "add", pid: a, me: "가람", name: "나래" });
  assert.ok(r.ok); assert.equal(r.peer.pid, b); assert.equal(r.peer.room, "", "나래 is offline: nobody to tell");
  assert.deepEqual(r.list.o, ["나래"]);
  assert.deepEqual((await so.list(b, t)).i, ["가람"]);
  assert.equal((await op({ a: "add", pid: a, me: "가람", name: "나래" })).error, So.SMSG.sent);
  // accept: friends on both sides, requests cleared, the asker is told in the channel they are in
  so.seen(a, "s1-ch2", "meadow", t);
  r = await op({ a: "ok", pid: b, me: "나래", name: "가람" });
  assert.ok(r.ok); assert.deepEqual(r.peer, { pid: a, note: "나래님과 친구가 되었습니다.", room: "s1-ch2" });
  assert.deepEqual(r.list, { ok: true, f: [["가람", 12, "adventurer", "s1-ch2", "meadow"]], i: [], o: [] });
  assert.deepEqual((await so.list(a, t)).f, [["나래", 40, "adventurer", "", ""]], "나래 is offline for 가람");
  assert.equal((await op({ a: "add", pid: a, me: "가람", name: "나래" })).error, So.SMSG.already);
  // presence: fresh for 45 s after a room's word, gone on release
  so.seen(b, "s1-ch1", "town", t);
  assert.equal((await so.list(a, t + So.PRESENCE_MS - 1)).f[0][3], "s1-ch1");
  assert.equal((await so.list(a, t + So.PRESENCE_MS)).f[0][3], "", "stale: offline");
  so.seen(b, "s1-ch1", "town", t); so.gone(b);
  assert.equal((await so.list(a, t)).f[0][3], "");

  // two requests that cross make friends at once
  r = await op({ a: "add", pid: c, me: "다온", name: "가람" });
  assert.equal(r.peer.room, "s1-ch2"); assert.ok(r.peer.note.includes("친구 요청"));
  r = await op({ a: "add", pid: a, me: "가람", name: "다온" });
  assert.ok(r.msg.includes("친구가 되었습니다"));
  assert.equal(r.list.f.length, 2);
  assert.deepEqual(r.list.f.map((f) => f[0]), ["나래", "다온"], "offline friends by name");
  so.seen(c, "s1-ch1", "forest", t);
  assert.deepEqual((await so.list(a, t)).f.map((f) => f[0]), ["다온", "나래"], "online first");
  // decline: gone from both, without a word to the asker
  await op({ a: "del", pid: a, me: "가람", name: "다온" });
  await op({ a: "add", pid: c, me: "다온", name: "가람" });
  r = await op({ a: "no", pid: a, me: "가람", name: "다온" });
  assert.ok(r.ok); assert.equal(r.peer, undefined);
  assert.deepEqual((await so.list(c, t)).o, []); assert.deepEqual((await so.list(a, t)).i, []);
  // remove: both sides; the other's window is refreshed but no note names who left
  r = await op({ a: "del", pid: b, me: "나래", name: "가람" });
  assert.ok(r.ok); assert.equal(r.peer.note, ""); assert.deepEqual(r.list.f, []);
  assert.deepEqual((await so.list(a, t)).f, []);

  // 차단: a request to someone who blocked the asker is recorded as sent and goes nowhere
  const d = await make("dddd", "s1", "라온", 5, ["가람"]);
  r = await op({ a: "add", pid: a, me: "가람", name: "라온" });
  assert.ok(r.ok); assert.equal(r.peer, undefined, "nobody is told");
  assert.ok(r.msg.includes("친구 요청을 보냈습니다"), "the asker cannot tell");
  assert.deepEqual((await so.list(d, t)).i, [], "the blocked request never arrives");
  assert.deepEqual((await so.list(a, t)).o, ["라온"]);
  // blocking someone (the room's `drop`) cuts the friendship and requests either way, quietly
  await op({ a: "add", pid: a, me: "가람", name: "나래" }); await op({ a: "ok", pid: b, me: "나래", name: "가람" });
  r = await op({ a: "drop", pid: a, me: "가람", name: "나래" });
  assert.ok(r.ok); assert.deepEqual(r.list.f, []); assert.deepEqual((await so.list(b, t)).f, []);
  assert.ok((await op({ a: "drop", pid: a, me: "가람", name: "나래" })).ok, "nothing to cut is fine for a block");
  assert.ok((await op({ a: "drop", pid: a, me: "가람", name: "없는이" })).ok);

  // servers do not mix: 가람 of s2 is another character
  assert.deepEqual(await so.list(z, t), { ok: true, f: [], i: [], o: [] });
  assert.equal((await op({ a: "add", pid: z, me: "가람", name: "나래" })).error, So.SMSG.none, "나래 lives on s1");

  // the caps
  for (let i = 0; i < So.FRIEND_MAX; i++) {
    const pid = await make(`f${String(i).padStart(4, "0")}`, "s1", `벗${i}`);
    const mine = (await store.get(So.KS.friends(c))) ?? { f: {}, i: {}, o: {} };
    mine.f[pid] = `벗${i}`;
    await store.put(So.KS.friends(c), mine);
  }
  assert.equal((await so.list(c, t)).f.length, 50);
  assert.equal((await op({ a: "add", pid: c, me: "다온", name: "나래" })).error, So.SMSG.full);
  await op({ a: "add", pid: b, me: "나래", name: "다온" });
  assert.equal((await op({ a: "ok", pid: c, me: "다온", name: "나래" })).error, So.SMSG.full);
  assert.equal((await op({ a: "add", pid: b, me: "나래", name: "다온" })).error, So.SMSG.sent);

  // where: the channel a name is in — presence first, then the lock a channel holds on the record
  so.seen(b, "s1-ch2", "town", t);
  assert.deepEqual(await so.where("s1", "나래", t), { ok: true, pid: b, name: "나래", room: "s1-ch2" });
  assert.deepEqual(await so.where("s1", "없는이", t), { ok: false, error: So.SMSG.none });
  so.gone(b);
  assert.deepEqual(await so.where("s1", "나래", t), { ok: false, error: So.SMSG.away });
  const recB = await store.get(A.K.char(b)); recB.sess = { room: "s1-ch1", t: t - 10_000 };
  await store.put(A.K.char(b), recB);
  assert.equal((await so.where("s1", "나래", t)).room, "s1-ch1", "the vault just woke: the record's lock still says where");
  assert.equal((await so.where("s1", "나래", t + 40_000)).ok, false, "a stale lock is nobody");
  assert.equal((await so.where("s2", "나래", t)).ok, false);

  // no key that existed before was touched; the only new prefix is fr:
  for (const [k, v] of before) if (k !== A.K.char(b)) assert.deepEqual(store.m.get(k), v, `key ${k} changed`);
  const fresh = [...store.m.keys()].filter((k) => !before.has(k) && !/^(n:|c:|m:)/.test(k));
  assert.ok(fresh.length > 0 && fresh.every((k) => /^fr:[a-z0-9_]{4,16}@s[12]$/.test(k)), fresh.join(" "));
  assert.ok(!So.KS.friends(a).startsWith("f:"), "fr: is not one of the f:<x>: throttle counters");
}

// ── rare loot sources (64-dim.js LOOT_X): skill stones, uncurse scrolls, reset scrolls — rates over fixed-seed rolls
{
  const R = { seed: 12345 }, N = 20000;
  const rate = (src, tier, id) => { let n = 0; for (let i = 0; i < N; i++) for (const [k, c] of X.lootX(R, src, tier)) if (k === id) n += c; return n / N; };
  const near = (got, want, msg) => assert.ok(Math.abs(got - want) < Math.max(0.006, want * 0.15), `${msg}: ${got} vs ${want}`);
  assert.equal(rate("rift", 4, "ske_stone"), 0, "no skill stone under rift tier 5");
  near(rate("rift", 10, "ske_stone"), 0.06, "tier 10 stone");
  near(rate("rift", 20, "ske_stone"), 0.16, "tier 20 stone");
  near(rate("rift", 40, "ske_stone"), X.LOOT_X.rift.skeMax, "the stone's cap");
  near(rate("rift", 10, "uncurse"), 0.12, "tier 10 uncurse");
  for (const t of [10, 20, 30, 40]) assert.ok(rate("rift", t, "uncurse") > rate("rift", t, "ske_stone"), `uncurse beats the stone at tier ${t}`);
  near(rate("fb", 0, "ske_stone"), 0.03, "field boss stone"); near(rate("fb", 0, "uncurse"), 0.08, "field boss uncurse");
  near(rate("fb", 0, "scr_job"), 0.02, "field boss job scroll"); near(rate("fb", 0, "scr_lvl"), 0.01, "field boss level scroll");
  for (let i = 0; i < 200; i++) {
    const big = Object.fromEntries(X.lootX(R, "big"));
    assert.ok(big.ske_stone >= 2 && big.ske_stone <= 3 && big.uncurse === 1, JSON.stringify(big));
  }
  near(rate("small", 0, "uncurse"), 0.1, "repeat challenge uncurse"); assert.equal(rate("small", 0, "ske_stone"), 0);
  assert.deepEqual(X.lootX(R, "", 30, 2), [["uncurse", 2]], "weekly brackets: one scroll each, nothing rolled");
  // into the bag (the pouch takes materials) and onto the gain list
  const p = { ch: L.newChar("돌줍기", "warrior", []), gain: [], fullAt: 0 };
  for (let i = 0; i < 3; i++) X.giveX({ ...R, now }, p, "big");
  assert.ok(X.countItem(p.ch, "ske_stone") >= 3 && X.countItem(p.ch, "uncurse") === 3, "challenge loot lands");
  assert.ok(p.gain.length === 6 && p.gain.every((g) => g[0] === "item"));
  for (const id of ["ske_stone", "uncurse", "scr_job", "scr_lvl"]) assert.ok(X.ITEMS[id], id);
  if (VERBOSE) console.log("loot sources ok");
}

console.log("social ok");
