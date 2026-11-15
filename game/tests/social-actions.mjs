// Player to player (69-social-play.js): requests, the two-party trade (happy path, every cancel and refusal,
// dupe attempts mid-trade) and 가위바위보 (timing, hidden picks, the lot for a missing pick, results).
// node tests/social-actions.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { ITEMS, plain, countItem, SX_ASK_MS, SX_ASK_CD, SX_TRADE_KEEP, RPS_PICK, RPS_SHOW, MINIGAMES, T };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;
const VERBOSE = process.argv.includes("-v");
const log = (...a) => { if (VERBOSE) console.log(...a); };

let now = 1_800_000_000_000;
const S = L.setup();
S.now = now;
for (const [pid, name] of [["a@s1", "가람"], ["b@s1", "나래"], ["c@s1", "다온"]]) L.addPlayer(S, pid, L.newChar(name, []));
const P = (k) => S.players[`${k}@s1`];
const act = (k, a) => { S.now = now; const v = L.validateAction(S, `${k}@s1`, a); if (v.ok) L.applyAction(S, `${k}@s1`, a); return v; };
const ok = (k, a) => { const v = act(k, a); assert.ok(v.ok, `${k} ${JSON.stringify(a)}: ${v.error}`); };
const err = (k, a) => { const v = act(k, a); assert.equal(v.ok, false, `${k} ${JSON.stringify(a)} should be refused`); return v.error; };
const tick = (ms = 100) => { now += ms; L.tick(S, now); };
const view = (k) => { const v = L.viewFor(S, `${k}@s1`); return v; };
const wait = (ms) => { for (let t = 0; t < ms; t += 100) tick(100); };
/** Read every snapshot once (toasts are capped until read). */
const drain = () => { for (const k of ["a", "b", "c"]) if (P(k)) L.viewFor(S, `${k}@s1`); };
const later = () => { now += X.SX_ASK_CD; };
const sx = (k) => L.viewFor(S, `${k}@s1`).sx;

// ── requests ──
{
  assert.match(err("a", { t: "sx", a: "ask", k: "duel", e: P("b").eid }), /없는 요청/);
  assert.match(err("a", { t: "sx", a: "ask", k: "trade", e: P("a").eid }), /대상/);
  assert.match(err("a", { t: "sx", a: "ask", k: "trade", e: 99999 }), /대상/);
  P("b").x += 6 * X.T;
  assert.match(err("a", { t: "sx", a: "ask", k: "trade", e: P("b").eid }), /너무 멉니다/);
  P("b").x -= 6 * X.T;
  ok("a", { t: "sx", a: "ask", k: "trade", e: P("b").eid });
  assert.deepEqual(sx("b").q, ["가람", "trade", "거래"]);
  // rate limit, and the target is waiting on one request already
  assert.match(err("a", { t: "sx", a: "ask", k: "rps", e: P("c").eid }), /잠시 후/);
  later();
  assert.match(err("c", { t: "sx", a: "ask", k: "rps", e: P("b").eid }), /바쁩니다/);
  // declining tells the asker; a request runs out on its own
  ok("b", { t: "sx", a: "no" });
  assert.equal(P("b").req, null);
  assert.ok(P("a").toast.some((m) => /거절/.test(m)));
  later();
  ok("a", { t: "sx", a: "ask", k: "trade", e: P("b").eid });
  wait(X.SX_ASK_MS + 100);
  assert.equal(P("b").req, null);
  assert.match(err("b", { t: "sx", a: "yes" }), /유효한 요청/);
  // a blocked name cannot ask
  P("b").ch.blk.push("다온");
  later();
  assert.match(err("c", { t: "sx", a: "ask", k: "trade", e: P("b").eid }), /보낼 수 없는/);
  P("b").ch.blk.length = 0;
  log("requests ok");
}

/** Open a trade between a and b. */
function openTrade() {
  drain();
  later();
  ok("a", { t: "sx", a: "ask", k: "trade", e: P("b").eid });
  ok("b", { t: "sx", a: "yes" });
  assert.ok(P("a").trade && P("a").trade === P("b").trade);
}
const slotOf = (k, id) => P(k).ch.inv.findIndex((s) => s.id === id);

// ── trade: happy path ──
{
  const a = P("a").ch, b = P("b").ch;
  a.gold = 1000; b.gold = 200;
  a.inv.push(X.plain("w_warrior_2"));
  a.inv.push({ id: "stone", n: 7 });
  const sword = a.inv.find((s) => s.id === "w_warrior_2");
  sword.enh = 4;
  openTrade();
  // what may not be offered
  a.inv.push({ id: "q_flower_letter", n: 1 }, { id: "charm", uid: 7, n: 1 });
  assert.match(err("a", { t: "sx", a: "put", s: slotOf("a", "q_flower_letter"), n: 1 }), /거래할 수 없는/);
  assert.match(err("a", { t: "sx", a: "put", s: slotOf("a", "charm"), n: 1 }), /참은/);
  a.inv.splice(slotOf("a", "q_flower_letter"), 1); a.inv.splice(slotOf("a", "charm"), 1);
  assert.match(err("a", { t: "sx", a: "put", s: 99, n: 1 }), /없습니다/);
  assert.match(err("a", { t: "sx", a: "put", s: slotOf("a", "stone"), n: 8 }), /수량/);
  assert.match(err("a", { t: "sx", a: "gold", n: 1001 }), /골드/);
  assert.match(err("c", { t: "sx", a: "put", s: 0, n: 1 }), /거래 중이 아닙니다/);

  ok("a", { t: "sx", a: "put", s: slotOf("a", "w_warrior_2"), n: 1 });
  assert.match(err("a", { t: "sx", a: "put", s: slotOf("a", "w_warrior_2"), n: 1 }), /이미 올린/);
  ok("a", { t: "sx", a: "put", s: slotOf("a", "stone"), n: 3 });
  ok("a", { t: "sx", a: "gold", n: 500 });
  ok("b", { t: "sx", a: "put", s: slotOf("b", "hp_s"), n: 2 });
  // b sees a's offer (the slot itself, for its tooltip) but a's bag positions only go to a
  let vb = sx("b"), va = sx("a");
  assert.equal(vb.t.n, "가람");
  assert.equal(vb.t.o[0][0].id, "w_warrior_2"); assert.equal(vb.t.o[0][0].enh, 4);
  assert.deepEqual(vb.t.o[1], [{ id: "stone", n: 7 }, 3]);
  assert.equal(vb.t.og, 500);
  assert.deepEqual(va.t.m, [[slotOf("a", "w_warrior_2"), 1], [slotOf("a", "stone"), 3]]);
  // sent only when it changes
  assert.equal(view("a").sx, undefined);
  // 교환 needs both locks; a change unlocks both
  assert.match(err("a", { t: "sx", a: "go" }), /두 사람 모두/);
  ok("a", { t: "sx", a: "lock", v: 1 });
  ok("b", { t: "sx", a: "lock", v: 1 });
  ok("b", { t: "sx", a: "gold", n: 50 });
  assert.equal(P("a").trade.o["a@s1"].l, 0, "a change unlocks the other side too");
  ok("a", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "lock", v: 1 });
  ok("a", { t: "sx", a: "go" });
  assert.ok(P("a").trade, "one 교환 is not a swap");
  ok("b", { t: "sx", a: "go" });
  assert.equal(P("a").trade, null); assert.equal(P("b").trade, null);
  assert.equal(a.gold, 1000 - 500 + 50); assert.equal(b.gold, 200 - 50 + 500);
  assert.ok(b.inv.includes(sword), "the very sword (its enhancement too) changed hands");
  assert.ok(!a.inv.includes(sword));
  assert.equal(X.countItem(a, "stone"), 4); assert.equal(X.countItem(b, "stone"), 3);
  assert.equal(X.countItem(a, "hp_s"), 7); assert.equal(X.countItem(b, "hp_s"), 3);
  assert.ok(P("a").save && P("b").save, "both saved soon");
  tick();
  const chat = L.viewFor(S, "a@s1").chat || [];
  assert.ok(chat.some((c) => c.sys && /거래 완료/.test(c.m)), "a log line for a");
  assert.ok(!(L.viewFor(S, "c@s1").chat || []).some((c) => /거래 완료/.test(c.m)), "nobody else reads it");
  L.endTick(S);
  log("trade happy path ok");
}

// ── trade: dupe attempts — the offered item leaves the bag mid-trade ──
{
  const a = P("a").ch;
  a.gold = 300;
  a.inv.push(X.plain("w_warrior_3"));
  openTrade();
  ok("a", { t: "sx", a: "put", s: slotOf("a", "w_warrior_3"), n: 1 });
  ok("a", { t: "sx", a: "gold", n: 300 });
  ok("a", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "lock", v: 1 });
  ok("b", { t: "sx", a: "go" });
  // a sells the sword in the same tick, then presses 교환: refused, nothing moves
  const gone = a.inv.splice(slotOf("a", "w_warrior_3"), 1)[0];
  assert.match(err("a", { t: "sx", a: "go" }), /가방에 없습니다/);
  assert.ok(!P("b").ch.inv.includes(gone));
  // the next tick drops the row and unlocks both
  tick();
  assert.equal(P("a").trade.o["a@s1"].it.length, 0);
  assert.equal(P("a").trade.o["b@s1"].l, 0);
  // gold spent elsewhere: clamped, unlocked
  ok("a", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "lock", v: 1 });
  a.gold = 100;
  tick();
  assert.equal(P("a").trade.o["a@s1"].g, 100);
  assert.equal(P("a").trade.o["a@s1"].l, 0);
  // a stack partly used up below the offer
  a.inv.push({ id: "stat_seal", n: 5 });
  ok("a", { t: "sx", a: "put", s: slotOf("a", "stat_seal"), n: 5 });
  a.inv[slotOf("a", "stat_seal")].n = 2;
  ok("a", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "go" });
  assert.match(err("a", { t: "sx", a: "go" }), /가방에 없습니다/);
  ok("a", { t: "sx", a: "x" });
  assert.equal(P("b").trade, null);
  assert.ok(P("b").toast.some((m) => /취소/.test(m)));
  log("trade dupe attempts ok");
}

// ── trade: a full bag refuses the whole swap ──
{
  const a = P("a").ch, b = P("b").ch;
  a.inv.push(X.plain("w_warrior_4"));
  const keep = b.inv.length;
  while (b.inv.length < 40) b.inv.push(X.plain("w_warrior_1"));
  b.bagCap = 40;
  openTrade();
  ok("a", { t: "sx", a: "put", s: slotOf("a", "w_warrior_4"), n: 1 });
  ok("a", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "lock", v: 1 }); ok("a", { t: "sx", a: "go" });
  const before = JSON.stringify([a.inv, b.inv, a.gold, b.gold]);
  assert.match(err("b", { t: "sx", a: "go" }), /가방이 가득/);
  assert.equal(JSON.stringify([a.inv, b.inv, a.gold, b.gold]), before, "nothing moved");
  // b offers a sword too: one out, one in — it fits now
  ok("b", { t: "sx", a: "put", s: slotOf("b", "w_warrior_1"), n: 1 });
  ok("a", { t: "sx", a: "lock", v: 1 }); ok("b", { t: "sx", a: "lock", v: 1 }); ok("a", { t: "sx", a: "go" }); ok("b", { t: "sx", a: "go" });
  assert.equal(b.inv.length, 40);
  assert.ok(b.inv.some((s) => s.id === "w_warrior_4"));
  b.inv.length = keep;
  log("trade full bag ok");
}

// ── trade: cancels — distance, map change, death, logout ──
{
  openTrade();
  P("b").x += X.SX_TRADE_KEEP + 4;
  tick();
  assert.equal(P("a").trade, null);
  assert.ok(P("a").toast.some((m) => /멀어져/.test(m)));
  P("b").x -= X.SX_TRADE_KEEP + 4;
  openTrade();
  L.runtime(S, "meadow");   // (the map b steps onto runs, whichever ground the world event happened to pick)
  P("b").map = "meadow";
  tick();
  assert.equal(P("b").trade, null);
  P("b").map = "town";
  openTrade();
  P("a").dead = true;
  tick();
  assert.equal(P("b").trade, null);
  P("a").dead = false;
  openTrade();
  assert.match(err("c", { t: "sx", a: "ask", k: "rps", e: P("a").eid }), /바쁩니다/);
  L.removePlayer(S, "b@s1");
  assert.equal(P("a").trade, null);
  assert.ok(P("a").toast.some((m) => /떠나/.test(m)));
  L.addPlayer(S, "b@s1", L.newChar("나래", []));
  log("trade cancels ok");
}

// ── 가위바위보 ──
function openGame() {
  drain();
  later();
  ok("a", { t: "sx", a: "ask", k: "rps", e: P("b").eid });
  ok("b", { t: "sx", a: "yes" });
  assert.ok(P("a").game && P("a").game === P("b").game);
}
{
  assert.deepEqual(L.defs().sx.games, [["rps", "가위바위보"]]);
  openGame();
  // the pick window: 3 s, picks hidden from the other side (9 = "has picked", never which)
  let va = sx("a");
  assert.deepEqual(va.g.slice(0, 2), ["rps", "나래"]);
  assert.equal(va.g[2], 0); assert.equal(va.g[3], 3);
  assert.match(err("a", { t: "sx", a: "pick", v: 3 }), /고르세요/);
  ok("a", { t: "sx", a: "pick", v: 1 });           // 바위
  ok("a", { t: "sx", a: "pick", v: 0 });           // changed its mind: 가위
  assert.deepEqual(sx("b").g.slice(2), [0, 3, -1, 9, 0, 0, 0]);
  assert.equal(sx("b"), undefined, "nothing new for b: sent only on change");
  ok("b", { t: "sx", a: "pick", v: 1 });           // 바위 beats 가위
  wait(X.RPS_PICK - 200);
  assert.equal(P("a").game.ph, 0, "not shown before 3 s");
  wait(300);
  assert.equal(P("a").game.ph, 1);
  assert.deepEqual(sx("a").g.slice(2), [1, 4, 0, 1, -1, 0, 0]);
  assert.deepEqual(sx("b").g.slice(2), [1, 4, 1, 0, 1, 0, 0]);
  assert.match(err("a", { t: "sx", a: "pick", v: 2 }), /공개/);
  wait(X.RPS_SHOW + 100);
  assert.equal(P("a").game, null); assert.equal(P("b").game, null);
  assert.equal(sx("a"), 0, "cleared on the wire");
  // nobody picks: both get a hand by lot (deterministic for the world's seed), marked as such
  openGame();
  wait(X.RPS_PICK + 100);
  const g = P("a").game;
  assert.ok(g.pk["a@s1"] >= 0 && g.pk["b@s1"] >= 0 && g.au["a@s1"] === 1 && g.au["b@s1"] === 1);
  const ra = sx("a").g, rb = sx("b").g;
  assert.equal(ra[7], 1); assert.equal(ra[8], 1);
  assert.equal(ra[6] + rb[6], 0, "one wins what the other loses (or both draw)");
  // results over every pair
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) {
    wait(X.RPS_SHOW + 100);
    openGame();
    ok("a", { t: "sx", a: "pick", v: x }); ok("b", { t: "sx", a: "pick", v: y });
    wait(X.RPS_PICK + 100);
    const want = x === y ? 0 : (x - y + 3) % 3 === 1 ? 1 : -1;
    assert.equal(sx("a").g[6], want, `${x} vs ${y}`);
  }
  // leaving ends it for both; a game in progress blocks trades
  wait(X.RPS_SHOW + 100);
  openGame();
  later();
  assert.match(err("a", { t: "sx", a: "ask", k: "trade", e: P("b").eid }), /이미/);
  ok("b", { t: "sx", a: "x" });
  assert.equal(P("a").game, null);
  assert.ok(P("a").toast.some((m) => /나갔습니다/.test(m)));
  log("rps ok");
}

console.log("social-actions: requests, trade (happy, dupes, full bag, cancels), 가위바위보 — ok");
