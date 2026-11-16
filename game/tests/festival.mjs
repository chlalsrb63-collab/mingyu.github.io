// Headless test of 버드나무 장날 and the seasons (P12, 63-festival.js): season boundaries (and the year's wrap),
// the Tuesday and Saturday 19–21 KST window (and its heads-up), the festival 알바 rows offered only then (outside perDay, paid
// in tokens), the daily token cap, the cooking contest, 장꾼 다래's stall, the `dn` sky field and an old sheet's migration.
// (The merchants of those two hours: tests/fairmkt.mjs.) node tests/festival.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { JB_RETIRED, SEASON, FAIR, FAIR_JOBS, FAIR_SHOP, seasonOf, fairOpen, fairGain, fairPan, fairClean, kstDay, JB, JB_PAY, dayOf, mapOf, jbOffersOf, jbRoll, jbNeed };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, H = 3600000;
X.JB_RETIRED.clear();   // the legacy board engine stays under test (its rows are retired in the real game, 58-life.js)
/** A moment in KST: kst("2026-11-15T10:00") */
const kst = (s) => Date.parse(s + ":00+09:00");

// ── seasons: 91-day blocks from 2026-03-01 KST, the cycle 364 days
assert.equal(X.kstDay(kst("2026-03-01T00:00")), X.SEASON.epoch, "the epoch is 2026-03-01 KST");
assert.equal(X.seasonOf(kst("2026-11-16T12:00")), 2, "2026-11-16 is 가을");
assert.equal(X.seasonOf(kst("2026-03-01T00:00")), 0, "봄 starts at the epoch's midnight");
assert.equal(X.seasonOf(kst("2026-02-28T23:59") + 59999), 3, "the last ms before is 겨울");
assert.equal(X.seasonOf(kst("2026-05-30T23:59") + 59999), 0, "day 90 is still 봄");
assert.equal(X.seasonOf(kst("2026-05-31T00:00")), 1, "day 91 is 여름");
assert.equal(X.seasonOf(kst("2026-08-30T00:00")), 2, "day 182 is 가을");
assert.equal(X.seasonOf(kst("2026-11-29T00:00")), 3, "day 273 is 겨울");
// the year wraps: day 364 is 봄 again (a day earlier on the calendar each year), and long before the epoch too
assert.equal(X.seasonOf(kst("2027-02-27T23:59")), 3, "day 363 is the last of 겨울");
assert.equal(X.seasonOf(kst("2027-02-28T00:00")), 0, "day 364: 봄 again");
assert.equal(X.seasonOf(kst("2025-03-02T00:00")), 0, "364 days before the epoch is 봄 too");
assert.equal(X.seasonOf(kst("2025-12-01T00:00")), 3, "a day before the epoch's year: 겨울");
for (let d = -800; d < 800; d += 7) { const s = X.seasonOf(kst("2026-03-01T12:00") + d * 24 * H); assert.ok(s >= 0 && s <= 3); }

// ── the market: Tuesday and Saturday 19:00–21:00 KST (2026-11-15 is a Sunday: 11-17 a Tuesday, 11-21 a Saturday)
assert.deepEqual([X.FAIR.days, X.FAIR.open, X.FAIR.close], [[2, 6], 19, 21], "the one schedule table");
for (const day of ["2026-11-17", "2026-11-21"]) {
  assert.equal(X.fairOpen(kst(`${day}T18:59`) + 59999), false, `${day}: not before 19`);
  assert.equal(X.fairOpen(kst(`${day}T19:00`)), true, `${day}: opens at 19`);
  assert.equal(X.fairOpen(kst(`${day}T20:59`) + 59999), true, `${day}: open till the last ms before 21`);
  assert.equal(X.fairOpen(kst(`${day}T21:00`)), false, `${day}: closed at 21`);
  assert.equal(X.fairOpen(kst(`${day}T10:00`)), false, `${day}: the old Sunday-style morning is closed`);
}
for (const day of ["2026-11-15", "2026-11-16", "2026-11-18", "2026-11-19", "2026-11-20"]) assert.equal(X.fairOpen(kst(`${day}T20:00`)), false, `${day}: no market`);
assert.equal(X.fairOpen(kst("2026-11-24T20:00")), true, "next Tuesday");
// every evening of three years against the calendar's own weekday (the KST day count across year wraps and leap days)
for (let d = 0; d < 1100; d++) {
  const dt = new Date(Date.UTC(2026, 0, 1 + d)), day = dt.toISOString().slice(0, 10), dow = dt.getUTCDay();
  assert.equal(X.fairOpen(kst(`${day}T19:30`)), dow === 2 || dow === 6, `${day} (weekday ${dow})`);
  assert.equal(X.fairOpen(kst(`${day}T21:30`)), false, `${day}: closed at 21:30`);
}
assert.equal(X.FAIR_JOBS.length, 4, "four festival rows");

// ── a world in 버드나무 마을
const SUN = kst("2026-11-17T20:00"), MON = kst("2026-11-16T12:00");   // (SUN: now a fair evening, a Tuesday)
function world(t0) {
  const S = L.setup();
  S.now = t0;
  return { S, now: t0 };
}
function hero(w, pid, name, atNpc) {
  const ch = L.newChar(name, []);
  ch.map = "willow";
  L.addPlayer(w.S, pid, ch);
  const p = w.S.players[pid];
  place(w, pid, atNpc);
  return p;
}
function place(w, pid, npc) {
  const p = w.S.players[pid], n = X.mapOf("willow").npcs.find((o) => o.id === npc);
  p.x = n.x * T + 8; p.y = n.y * T + 12 + 14;
}
const act = (w, pid, a) => { w.S.now = w.now; const v = L.validateAction(w.S, pid, a); if (v.ok) L.applyAction(w.S, pid, a); return v; };
const toasts = (p) => p.toast.splice(0).join(" | ");

{
  const w = world(MON), p = hero(w, "a", "월요장꾼", "willow_board");
  const offers = X.jbOffersOf(w.S, p);
  for (const id of X.FAIR_JOBS) assert.ok(!offers.includes(id), `${id}: not offered on a Monday`);
  assert.match(act(w, "a", { t: "jb", a: "take", id: "jb_fair_potato" }).error, /오늘의 알바가 아닙니다/);
}
{
  const w = world(SUN), S = w.S, p = hero(w, "a", "일요장꾼", "willow_board");
  const offers = X.jbOffersOf(S, p);
  for (const id of X.FAIR_JOBS) assert.ok(offers.includes(id), `${id}: offered on a fair evening`);
  // the regular offers are drawn without them
  assert.ok(p.jbOff.ids.every((id) => !X.JB[id].fair), "the day's draw holds no festival row");
  for (const id of X.FAIR_JOBS) assert.equal(X.jbRoll(p.ch, p.ch.jobBoard.day, id).rush, 0, "never 긴급");
  // the day's four regular jobs done: festival rows can still be taken
  p.ch.jobBoard.done = p.jbOff.ids.slice(0, X.JB_PAY.perDay);
  assert.equal(p.ch.jobBoard.done.length, X.JB_PAY.perDay);
  assert.ok(act(w, "a", { t: "jb", a: "take", id: "jb_fair_potato" }).ok, "a festival row past perDay");
  const g = X.jbRoll(p.ch, p.ch.jobBoard.day, "jb_fair_potato").g, need = X.jbNeed(X.JB.jb_fair_potato, g);
  assert.equal(L.validateAction(S, "a", { t: "jb", a: "take", id: "jb_wood1" }).ok, false);
  // hand in the potatoes at 장꾼 다래: tokens, no gold
  p.ch.inv.push({ id: "m_c1", n: need });
  place(w, "a", "willow_fair");
  const gold = p.ch.gold;
  toasts(p);
  assert.ok(act(w, "a", { t: "jb", a: "give" }).ok, "hand in to 다래");
  assert.equal(p.ch.gold, gold, "no gold");
  assert.equal(p.ch.fair.t, X.FAIR.job[g], "tokens by grade");
  assert.equal(p.ch.cos.tokens, 0, "no Willow token either");
  assert.match(toasts(p), /장날 토큰 \+/);

  // ── the cap: never more than FAIR.cap a board day, the purse stays across days
  for (let i = 0; i < 10; i++) X.fairGain(S, p, 2);
  assert.equal(p.ch.fair.n, X.FAIR.cap, "today's cap");
  assert.equal(p.ch.fair.t, X.FAIR.cap, "the purse holds what was paid");
  assert.equal(X.fairGain(S, p, 1), 0, "nothing past the cap");
  S.now = SUN + 24 * H;   // Wednesday: a new board day
  assert.equal(X.fairGain(S, p, 3), 3, "a new day pays again");
  assert.deepEqual([p.ch.fair.n, p.ch.fair.t], [3, X.FAIR.cap + 3]);
  S.now = SUN;
}
{
  // ── the cooking contest: a pan score in the village on 장날; steps paid once a day; the channel's best
  const w = world(SUN), S = w.S, a = hero(w, "a", "부침개왕", "willow_kitchen"), b = hero(w, "b", "전집딸", "willow_kitchen");
  X.fairPan(S, a, 55);
  assert.deepEqual([a.ch.fair.pan, a.ch.fair.n], [55, 0], "below the first step: no token");
  X.fairPan(S, a, 70);
  assert.deepEqual([a.ch.fair.pan, a.ch.fair.n], [70, 1], "the 60 step");
  X.fairPan(S, a, 65);
  assert.equal(a.ch.fair.pan, 70, "a worse score keeps the best");
  X.fairPan(S, a, 95);
  assert.equal(a.ch.fair.n, 2, "the 90 step");
  X.fairPan(S, a, 100);
  assert.equal(a.ch.fair.n, 2, "each step once a day");
  toasts(b);
  X.fairPan(S, b, 80);
  assert.equal(S.fairTop.name, "부침개왕", "80 does not beat 100");
  X.fairPan(S, b, 100);
  assert.equal(S.fairTop.name, "부침개왕", "a tie keeps the first");
  assert.deepEqual(L.viewFor(S, "b").self.fair, [2, 2, 100, 100, "부침개왕"], "self.fair: purse, today, my best, the day's best and cook");
  // through the real action: a fish on the village campfire
  const c = hero(w, "c", "모닥불요리", "willow_kitchen"), [fx, fy] = X.mapOf("willow").fires ? [23, 44] : [23, 44];
  c.ch.inv.push({ id: "fish_s", n: 1 });
  c.x = fx * T + 8; c.y = (fy + 1) * T + 10;
  const v = act(w, "c", { t: "cook", id: "fish_s", s: 75 });
  assert.ok(v.ok, v.error);
  assert.equal(c.ch.fair.pan, 75, "the cook action enters the contest");
  // not in the village, or not on 장날: no entry
  const w2 = world(MON), d = hero(w2, "d", "월요요리", "willow_kitchen");
  X.fairPan(w2.S, d, 99);
  assert.equal(d.ch.fair.pan, 0, "Monday: no contest");
  d.map = "town";
  w2.S.now = SUN; X.fairPan(w2.S, d, 99);
  assert.equal(d.ch.fair.pan, 0, "outside the village: no contest");
}
{
  // ── 장꾼 다래's stall: this season's rows only; undrawn pieces wait; tokens spent, the piece worn
  const w = world(MON), S = w.S, p = hero(w, "a", "옷장꾼", "willow_fair");
  const [now] = X.FAIR_SHOP[2];
  assert.equal(now[0], "hat_straw_blue", "가을 sells the straw hat for now");
  assert.match(act(w, "a", { t: "fair_buy", id: now[0] }).error, /장날 토큰이 부족합니다/);
  p.ch.fair.t = 50;
  assert.match(act(w, "a", { t: "fair_buy", id: "hat_santa" }).error, /이번 계절/, "겨울's piece is not on sale in 가을");
  assert.match(act(w, "a", { t: "fair_buy", id: "hat_beanie_red" }).error, /이번 계절/);
  place(w, "a", "willow_farmer");
  assert.match(act(w, "a", { t: "fair_buy", id: now[0] }).error, /너무 멉니다/);
  place(w, "a", "willow_fair");
  assert.ok(act(w, "a", { t: "fair_buy", id: now[0] }).ok);
  assert.equal(p.ch.fair.t, 50 - now[1]);
  assert.ok(p.ch.cos.own.includes(now[0]) && p.ch.cos.on.hat === now[0], "owned and worn");
  assert.match(act(w, "a", { t: "fair_buy", id: now[0] }).error, /이미 가지고/);
  // the 사계절 pieces (P11) are on sale: 가을's maple wreath for 20, then the sweater is out of reach
  assert.ok(act(w, "a", { t: "fair_buy", id: "hat_ssn_maple" }).ok);
  assert.ok(p.ch.cos.on.hat === "hat_ssn_maple" && p.ch.fair.t === 50 - now[1] - 20, "bought and worn");
  assert.match(act(w, "a", { t: "fair_buy", id: "top_ssn_maple" }).error, /장날 토큰이 부족합니다/);
  for (const rows of X.FAIR_SHOP) for (const [, price] of rows) assert.ok(price >= 20 && price <= 30, "prices 20–30");
  for (const rows of X.FAIR_SHOP) assert.ok(rows.slice(1).reduce((n, r) => n + r[1], 0) <= 13 * X.FAIR.cap, "a season's set within half a season of fair days");
  const D = L.defs();
  assert.equal(D.fair.shop[2][0][2], 1, "defs: the straw hat is on sale");
  assert.deepEqual(D.fair.shop[2][1].slice(2), [1, "단풍잎 화관", "모자"], "defs: a 사계절 piece on sale, its slot named");
  assert.ok(D.fair.shop.every((rows) => rows.every((r) => r[2] === 1)), "defs: every row of every season is on sale");
  assert.deepEqual(D.sky.season, ["봄", "여름", "가을", "겨울"]);
}
{
  // ── the sky field: [weather, clock s, season, 장날 0/1], re-sent when the market opens
  const w = world(kst("2026-11-17T18:30")), S = w.S, p = hero(w, "a", "하늘보기", "willow_board");
  const step = (at) => { S.now = kst(at); w.now = S.now; L.tick(S, S.now); const v = L.viewFor(S, "a"); L.endTick(S); return v; };
  let v = step("2026-11-17T18:30");
  assert.ok(!(v.toast || []).some((t) => /장날/.test(t)), "no toast while closed and far from the opening");
  assert.deepEqual(v.dn.slice(2), [2, 0], "가을, closed");
  // the heads-up: ten minutes ahead, once
  v = step("2026-11-17T18:49");
  assert.ok(!(v.toast || []).some((t) => /곧 장날/.test(t)), "eleven minutes ahead: not yet");
  v = step("2026-11-17T18:51");
  assert.match((v.toast || []).join(" "), /곧 장날이 열립니다! 9분 뒤 19시부터/, "the heads-up");
  v = step("2026-11-17T18:55");
  assert.ok(!(v.toast || []).some((t) => /곧 장날/.test(t)), "said once");
  assert.ok(!v.dn || v.dn[3] === 0, "the sky flag stays 0");
  v = step("2026-11-17T19:00");
  assert.ok(v.dn, "sent when the market opens");
  assert.deepEqual(v.dn.slice(2), [2, 1], "open");
  assert.match((v.toast || []).join(" "), /버드나무 장날이 열렸습니다/, "a toast as it opens");
  assert.ok(v.self.jb[1].some((o) => o[0] === "jb_fair_cake"), "the board re-sent with the festival rows");
  assert.ok(v.chat.some((c) => c.sys && /\[장날\].*21시까지/.test(c.m)), "the opening in the chat");
  v = step("2026-11-17T21:00");
  assert.deepEqual(v.dn.slice(2), [2, 0], "closed again");
  assert.match((v.toast || []).join(" "), /다음 장날\(화·토 19–21시\)/, "the closing toast names the next ones");
  // no heads-up on a day without a market, even at 18:55
  v = step("2026-11-18T18:55");
  assert.ok(!(v.toast || []).some((t) => /곧 장날/.test(t)), "Wednesday: no heads-up");
}
{
  // ── an old sheet (v25, no `fair`) and a junk one
  const old = L.newChar("옛장꾼", []);
  delete old.fair; old.v = 25;
  const S = L.setup(); S.now = SUN;
  L.addPlayer(S, "o", old);
  assert.deepEqual(S.players.o.ch.fair, { t: 0, d: 0, n: 0, pan: 0 }, "an old sheet starts an empty purse");
  assert.equal(S.players.o.ch.v, 28);
  assert.deepEqual(X.fairClean({ t: 1e9, d: -3, n: 50, pan: "x" }), { t: X.FAIR.max, d: 0, n: X.FAIR.cap, pan: 0 }, "clamped");
  assert.deepEqual(X.fairClean(null), { t: 0, d: 0, n: 0, pan: 0 });
  const back = JSON.parse(JSON.stringify(L.exportChar(S, "o")));
  assert.deepEqual(back.fair, S.players.o.ch.fair, "saved with the sheet");
}
console.log("festival: ok");
