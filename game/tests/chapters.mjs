// Main-story chapters (P6, docs/design/arcs.md "P6 as built"): the chain's chapter headers, the story beat each chapter
// asks for before its first step (a mainChapter side quest, QUESTS `sq`), the new 산호 해안 and 붉은바위 황금궁 steps walked
// through, rewards on the curve, and old sheets keeping their place past the inserted rows (sheet v24).
// node tests/chapters.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { QUESTS, SQ_MAIN, SQ_BY, FIELD_BOSS, changeMap };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, D = L.defs(), Q = D.quests, T = 16;

function world(sheet, lvl = sheet.lvl) {
  const S = L.setup();
  let now = Date.UTC(2026, 10, 16, 1, 0, 0);
  S.now = now;
  const PID = "pid-장";
  L.addPlayer(S, PID, sheet);
  S.players[PID].ch.lvl = lvl;   // the level as such (migrate reads it from the XP)
  const W = {
    S,
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    ok(a) { const r = W.act(a); assert.ok(r.ok, `${JSON.stringify(a)}: ${r.error}`); },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    to(id, tx, ty) { const p = W.p; L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.sendMap = true; },
    meet(id) { for (const mid of Object.keys(L.atlas().maps)) { const n = L.atlas().maps[mid].npcs.find((o) => o.id === id); if (n) { W.to(mid, n.x, n.y + 1); W.p.y -= 4; return; } } assert.fail(`no NPC ${id}`); },
    kill(k) {
      const p = W.p, rt = L.runtime(S, p.map);
      const find = () => rt.mobs.find((x) => x.k === k && !x.dead && !x.evt) || rt.mobs.find((x) => x.k === k && !x.evt);
      if (!find()) W.step();
      const m = find();
      assert.ok(m, `a ${k} lives in ${p.map}`);
      m.dead = false; m.el = 0; m.tr = []; m.hp = 1; m.x = p.x + 12; m.y = p.y; m.by = {};
      for (const o of rt.mobs) if (o !== m && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 90) { o.x += 4000; o.hx = o.x; }
      p.atkAt = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
      W.ok({ t: "atk" });
      assert.ok(m.dead);
      W.step(20);
    },
  };
  return W;
}
const at = (i, lvl) => { const ch = L.newChar("장", []); ch.lvl = lvl; ch.q = { i, n: 0, st: 0 }; return ch; };
const sqSt = (W, id) => { W.p.dirty = true; const r = W.step().self.sq.find((x) => x[0] === id); return r ? r[1] : undefined; };
const idx = (mob, fb = 0) => Q.findIndex((q) => q.mob === mob && !!q.fb === !!fb);

// ── the chain: eight chapters in order, the two new bands, each beat a mainChapter quest given by 엘더윈
assert.equal(Q.length, 43);
const chaps = Q.map((q, i) => [i, q.chap]).filter(([, c]) => c);
assert.equal(chaps.length, 8);
chaps.forEach(([i, c], k) => { assert.ok(c.startsWith(`제${k + 1}장 「`), c); assert.ok(Q[i].intro.length > 30, `${c} has an intro`); });
assert.equal(chaps[0][0], 0, "the first step opens chapter 1");
const v24 = Q.filter((q) => q.v24).map((q) => q.mob);
assert.deepEqual(v24, ["eyegull", "coralturtle", "twingoat_blood", "crownpeacock"]);
const spawns = (map) => new Set(L.atlas().maps[map].spawns.map((s) => s.k));
assert.ok(spawns("coast").has("eyegull") && spawns("coast").has("coralturtle"), "the coast steps hunt the coast");
assert.ok(spawns("mesa").has("twingoat_blood") && X.FIELD_BOSS.mesa === "crownpeacock", "the mesa steps hunt the mesa and its field boss");
assert.ok(idx("eyegull") === idx("loggator", 1) + 1 && idx("twingoat_blood") === idx("abyssboss") + 1, "after the jungle boss, after the 어미");
const beats = Q.map((q, i) => [i, q.sq]).filter(([, id]) => id);
assert.equal(beats.length, 6);
const goals = new Set();
for (const [i, id] of beats) {
  const b = D.side.find((o) => o.id === id);
  assert.ok(b && b.mainChapter && b.giver === "elder" && X.SQ_MAIN[id] === i, `${id} is row ${i}'s beat`);
  goals.add(b.goal.type);
  assert.equal(b.reward.xp, Math.round(D.lvt[b.req.lv - 1] * 0.15), `${id}: 15 % of a level`);
  assert.equal(b.reward.gold, 30 * b.req.lv);
  const lvRow = D.mobs[Q[i - 1].mob].lv;
  assert.ok(b.req.lv <= lvRow, `${id} is open by the time row ${i - 1} is done (Lv.${b.req.lv} ≤ ${lvRow})`);
}
assert.deepEqual([...goals].sort(), ["deliver", "talk", "visit"], "beats are not kill quests");
// rewards on the curve: the new rows pay like their neighbours (XP over a level's worth, kill rows 1.1–1.5, boss rows 1.4–1.9)
for (const q of Q.filter((o) => o.v24)) {
  const r = q.xp / D.lvt[D.mobs[q.mob].lv - 1];
  assert.ok(q.fb ? r > 1.4 && r < 1.9 : r > 1.1 && r < 1.5, `${q.title}: ${r.toFixed(2)} of a level`);
}

// ── each beat: locked before its row, open on it; the row refuses to start until it is done; then it starts
for (const [i, id] of beats) {
  const b = X.SQ_BY[id];
  const before = world(at(i - 1, b.req.lv));
  assert.equal(sqSt(before, id), 0, `${id} locked before row ${i}`);
  before.meet("elder");
  assert.match(before.act({ t: "sq", a: "take", id }).error, /주요 의뢰를 더 진행/);
  const W = world(at(i, b.req.lv));
  assert.equal(sqSt(W, id), 1, `${id} open on row ${i}`);
  W.meet("elder");
  assert.match(W.act({ t: "quest", a: "accept" }).error, new RegExp(`먼저 \\[${b.title}\\]`));
  W.ok({ t: "sq", a: "take", id });
  if (b.goal.type === "talk") { W.meet(b.goal.npc); W.ok({ t: "sq", a: "talk", npc: b.goal.npc }); W.meet("elder"); }
  if (b.goal.type === "visit") { X.changeMap(W.S, W.p, b.goal.map, 40 * T, 40 * T); W.meet("elder"); }
  if (b.goal.type === "deliver") { assert.equal(W.ch.inv.filter((s) => s.id === b.goal.item).length, 1, "the letter in the bag"); W.meet(b.goal.npc); }
  assert.equal(sqSt(W, id), 3, `${id} ready`);
  const xp0 = W.ch.xp, g0 = W.ch.gold;
  W.ok({ t: "sq", a: "done", id });
  assert.ok(W.ch.sq.done[id] && W.ch.gold === g0 + b.reward.gold && (W.ch.xp !== xp0 || W.ch.lvl > b.req.lv), `${id} paid`);
  if (b.goal.type === "deliver") assert.ok(!W.ch.inv.some((s) => s.id === b.goal.item), "the letter handed over");
  W.meet("elder");
  W.ok({ t: "quest", a: "accept" });
  assert.equal(W.ch.q.st, 1);
}
// a sheet already past a row may still hear its beat; it never blocks a step already under way
{
  const W = world(at(idx("catsplit") + 3, 90));
  assert.equal(sqSt(W, "sq_mc_fall"), 1, "a missed beat stays open");
  const U = world({ ...at(idx("eyegull"), 110), q: { i: idx("eyegull"), n: 4, st: 1 } });
  assert.equal(U.ch.q.n, 4);
}

// ── the coast and mesa steps walked: hunt, hand in at 엘더윈, the next row
{
  const W = world(at(idx("eyegull"), 115));
  W.ch.sq.done.sq_mc_coast = 1;
  for (const [mob, map] of [["eyegull", "coast"], ["coralturtle", "coast"], ["twingoat_blood", "mesa"]]) {
    const i = idx(mob), q = Q[i];
    W.ch.q = { i, n: 0, st: 0 };
    if (q.sq) W.ch.sq.done[q.sq] = 1;
    W.meet("elder"); W.ok({ t: "quest", a: "accept" });
    W.to(map, ...L.atlas().maps[map].spawns.find((s) => s.k === mob).r.slice(0, 2));
    for (let k = 0; k < q.n; k++) W.kill(mob);
    assert.equal(W.ch.q.n, q.n, `${q.title}: ${q.n} down`);
    const g0 = W.ch.gold;
    W.meet("elder"); W.ok({ t: "quest", a: "done" });
    assert.ok(W.ch.q.i === i + 1 && W.ch.gold === g0 + q.gold, `${q.title} handed in`);
  }
  assert.equal(Q[W.ch.q.i].mob, "crownpeacock");
  W.ok({ t: "quest", a: "accept" });
  assert.ok(Q[W.ch.q.i].fb && W.ch.q.st === 1, "the 금관 공작 is a story fight");
}

// ── old sheets (v20–v23): the same errand after the four new rows; v24 sheets are left alone; a finished chain stays finished
{
  const old = Q.map((q, j) => (q.v24 ? -1 : j)).filter((j) => j >= 0);   // the v23 chain, as indexes now
  assert.equal(old.length, 39);
  for (const k of [0, 5, 22, 23, 24, 30, 31, 38, 39]) {
    const ch = { ...L.newChar("옛장", []), v: 23, lvl: 150, q: { i: k, n: 3, st: 1 } };
    const W = world(ch);
    assert.equal(W.ch.q.i, k < old.length ? old[k] : Q.length, `old step ${k}`);
    if (k < old.length) assert.equal(Q[W.ch.q.i].title, [...Q].filter((q) => !q.v24)[k].title);
    assert.deepEqual([W.ch.q.n, W.ch.q.st, W.ch.v], [3, 1, 24], "progress kept");
  }
  const fresh = world({ ...L.newChar("새장", []), q: { i: 24, n: 2, st: 1 } });
  assert.equal(fresh.ch.q.i, 24, "a v24 sheet keeps its index");
}
console.log("chapters: ok");
