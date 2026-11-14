// Headless test of the long game — waypoints and the return scroll, daily tasks, achievements and
// titles, the monster collection, the half-hourly world event, first steps, and old sheets brought
// up to date: node tests/content.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const HOUR = 3600000, DAY = 24 * HOUR;
// 2026-11-12 23:00 UTC = 2026-11-13 08:00 KST: well past the morning reset
const BASE = Date.UTC(2026, 10, 12, 23, 0, 0);

function world(name = "모험가", t0 = BASE) {
  const S = L.setup();
  let now = t0;
  S.now = now;
  const PID = "pid-" + name;
  const W = {
    S, PID,
    get now() { return now; },
    set now(v) { now = v; },
    log: [],
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); W.log.push(...S.chat.map((c) => c.m)); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    to(id, tx, ty) { const p = W.p; L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
    kill(k, el = 0) {
      const p = W.p, rt = L.runtime(S, p.map);
      const m = rt.mobs.find((x) => x.k === k && !x.dead && !x.evt) || rt.mobs.find((x) => x.k === k && !x.evt);
      assert.ok(m, `a ${k} lives in ${p.map}`);
      m.dead = false; m.el = el; m.tr = []; m.hp = 1; m.x = p.x + 12; m.y = p.y; m.by = {};
      // a duel: anything else standing within reach of the swing is moved off first
      for (const o of rt.mobs) if (o !== m && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 90) { o.x += 4000; o.hx = o.x; }
      p.atkAt = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
      assert.ok(W.act({ t: "atk" }).ok);
      assert.ok(m.dead, `the ${k} falls`);
      W.step(20);
    },
  };
  return W;
}
const evts = (v, tag) => (v.ev || []).filter((e) => e[0] === tag);
const chatHas = (W, word) => W.log.some((m) => m.includes(word));

// ── definitions: every hunting ground and the town has a waypoint, a level band, a collection
// (maps from the world map editor, data/maps, may add their own stones)
for (const id of ["abyss", "cave", "city", "crypt", "forest", "meadow", "sewer", "town"]) assert.ok(D.waypoints.some((w) => w.id === id), id + " has a waypoint");
const BANDS = { meadow: [1, 7], forest: [8, 13], crypt: [12, 17], city: [14, 21], sewer: [22, 27], cave: [24, 32], abyss: [32, 40] };
for (const [id, band] of Object.entries(BANDS)) {
  const m = D.maps.find((o) => o.id === id);
  // the world keeps its tiers; players see them as levels 4·tier − 3
  assert.deepEqual(m.band, band.map((t) => 4 * t - 3), id + " keeps its level band");
  for (const k of m.mobs) {
    const lv = D.mobs[k].tier;
    assert.equal(D.mobs[k].lv, 4 * lv - 3);
    if (!D.mobs[k].chest) assert.ok(lv >= band[0] - 1 && lv <= band[1], `${k} (Lv.${lv}) fits ${id}'s band`);
  }
  assert.ok(D.collection[id].mobs.length >= 2, id + " has a collection");
  assert.ok(D.collection[id].bonus.length >= 1, id + " grants a region bonus");
}
assert.ok(D.achievements.length >= 30, "about thirty achievements");
assert.ok(D.achievements.filter((a) => a.title).length >= 10, "a good many of them grant titles");
assert.ok(new Set(D.achievements.map((a) => a.id)).size === D.achievements.length, "achievement ids are unique");
assert.ok(D.shop.includes("recall"), "the shop sells the return scroll");
assert.equal(D.items.recall.type, "scroll");
assert.equal(D.event.every, 30 * 60000); assert.equal(D.event.len, 8 * 60000); assert.equal(D.event.warn, 2 * 60000);
assert.equal(D.daily.resetKST, 6);
assert.equal(D.tutorial.length, 8);
assert.equal(D.tutorial[7].id, "level", "the stat-point step is appended (indices are persisted)");

// ── waypoints: the town's is awake from the start; walking past one wakes it for good
{
  const W = world("길손");
  L.addPlayer(W.S, W.PID, L.newChar("길손", "warrior", []));
  let v = W.step();
  const town = v.map;
  for (const role of ["warp", "collector", "achieve", "daily"]) assert.ok(town.npcs.some((n) => n.role === role), "the town has a " + role + " NPC");
  const wpTown = town.marks.find((k) => k.kind === "waypoint");
  assert.ok(wpTown, "the town marks its waypoint");
  assert.equal(town.o[wpTown.y][wpTown.x], "Q", "the waypoint stone is the Q object");
  assert.ok(town.marks.filter((k) => k.kind === "sign").every((k) => k.label && k.to), "town signposts name where they lead");
  for (const k of town.marks.filter((k) => k.kind === "sign")) assert.equal(town.o[k.y][k.x], "G", "signposts stand on sign props");
  assert.deepEqual(v.self.wp, { town: 1 });

  // every hunting ground's waypoint stands by a walkable tile, with signposts toward the way on
  const maps = {};
  for (const id of Object.keys(BANDS)) {
    W.to(id, 3, 3);
    const m = W.step().map;
    maps[id] = m;
    const w = m.marks.find((k) => k.kind === "waypoint");
    assert.ok(w, id + " has a waypoint");
    assert.equal(m.o[w.y][w.x], "Q");
    assert.ok(m.marks.filter((k) => k.kind === "sign").length >= 2, id + " has signposts");
    for (const k of m.marks.filter((k) => k.kind === "sign")) { assert.equal(m.o[k.y][k.x], "G"); assert.ok(k.label.length > 2); }
  }
  // the stone sits on the critical path, a short walk in from the entrance
  for (const id of Object.keys(BANDS)) {
    const m = maps[id], w = m.marks.find((k) => k.kind === "waypoint");
    const door = m.portals[0];
    assert.ok(Math.abs(door.x - w.x) + Math.abs(door.y - w.y) < 70, id + ": the waypoint is near the way in");
  }

  // warp is refused away from a stone, to a sleeping stone, and in combat
  const p = W.p;
  W.to("town", 30, 18); W.step();
  assert.equal(W.act({ t: "warp", to: "meadow" }).error, "이동의 돌 곁에서만 이동할 수 있습니다");
  W.to("town", wpTown.x + 1, wpTown.y); W.step();
  assert.equal(W.act({ t: "warp", to: "meadow" }).error, "아직 깨우지 않은 이동의 돌입니다");
  assert.equal(W.act({ t: "warp", to: "nowhere" }).error, "그곳에는 이동의 돌이 없습니다");
  assert.equal(W.act({ t: "warp", to: "town" }).error, "이미 이곳에 있습니다");

  // walk past the meadow stone: it wakes
  const mw = maps.meadow.marks.find((k) => k.kind === "waypoint");
  W.to("meadow", mw.x + 1, mw.y);
  v = W.step(1100);
  assert.equal(v.self.wp.meadow, 1, "the meadow stone wakes when walked past");
  assert.ok(evts(v, "wp").some((e) => e[1] === p.eid && e[2] === 2), "waking is announced with an event");
  assert.ok(v.self.seen.includes("meadow"));
  // hurt a moment ago: no warping
  p.hitAt = W.now - 500;
  assert.equal(W.act({ t: "warp", to: "town" }).error, "전투 중에는 이동할 수 없습니다");
  p.hitAt = W.now - 5000;
  assert.ok(W.act({ t: "warp", to: "town" }).ok);
  v = W.step();
  assert.equal(W.p.map, "town");
  const tw = D.waypoints.find((o) => o.id === "town");
  assert.ok(tw);
  assert.ok(Math.abs(p.x - (wpTown.x + 1) * T - 8) <= 16 && Math.abs(p.y - wpTown.y * T - 10) <= 16, "and arrives beside the town stone");
  assert.ok(evts(v, "wp").some((e) => e[1] === p.eid && e[2] === 1), "arrival is an event on the new map");
  assert.ok(W.act({ t: "warp", to: "meadow" }).ok, "and back again");
  assert.equal(W.step().map.id, "meadow");

  // ── the return scroll: two seconds of reading, then home
  p.ch.inv.push({ id: "recall", n: 2 });
  p.hitAt = 0;
  for (const m of L.runtime(W.S, "forest").mobs) { m.dead = true; m.respAt = W.now + 1e9; }
  W.to("forest", 10, 10); W.step();
  assert.ok(W.act({ t: "use", id: "recall" }).ok);
  v = W.step();
  assert.ok(evts(v, "rc").some((e) => e[1] === p.eid && e[2] === 2000), "the channel is announced with its length");
  assert.ok(v.self.recall > 0);
  assert.equal(W.act({ t: "use", id: "recall" }).error, "이미 귀환을 준비하고 있습니다");
  for (let i = 0; i < 10; i++) v = W.step(100);
  assert.equal(W.p.map, "forest", "still reading after one second");
  for (let i = 0; i < 12; i++) v = W.step(100);
  assert.equal(W.p.map, "town", "home after two");
  assert.equal(p.ch.inv.find((s) => s.id === "recall").n, 1, "the scroll is used up");
  assert.equal(W.act({ t: "use", id: "recall" }).error, "이미 마을에 있습니다");

  // a blow breaks the reading, and so does walking off
  for (const m of L.runtime(W.S, "meadow").mobs) { m.dead = true; m.respAt = W.now + 1e9; }
  const M = maps.meadow, free = (x, y) => M.o[y][x] === " " && !"wW".includes(M.g[y][x]);
  let spot = null;
  for (let y = 15; y < M.h - 3 && !spot; y++) for (let x = 15; x < M.w - 3 && !spot; x++) {
    if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [1, 1]].every(([dx, dy]) => free(x + dx, y + dy))) spot = [x, y];
  }
  W.to("meadow", spot[0], spot[1]); W.step();
  p.hp = 1e6;
  assert.ok(W.act({ t: "use", id: "recall" }).ok);
  W.step();
  const hare = L.runtime(W.S, "meadow").mobs.find((m) => m.k === "twinhare");
  hare.dead = false; hare.hp = 999; hare.x = hare.hx = hare.wx = p.x + 10; hare.y = hare.hy = hare.wy = p.y; hare.tgt = W.PID; hare.atkAt = 0; hare.st = 1; hare.castAt = 0;
  let broke = false;
  for (let i = 0; i < 25 && !broke; i++) { v = W.step(100); if (evts(v, "rc").some((e) => e[1] === p.eid && e[2] === 0)) broke = true; }
  assert.ok(broke, "being hit cancels the recall");
  assert.equal(p.recall, null);
  assert.equal(W.p.map, "meadow");
  hare.dead = true; hare.respAt = W.now + 1e9;
  p.hitAt = 0;
  assert.ok(W.act({ t: "use", id: "recall" }).ok);
  W.step();
  const x0 = p.x, y0 = p.y;
  for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
    W.act({ t: "mv", x: x0 + dx, y: y0 + dy, d: 2 });
    if (p.x !== x0 || p.y !== y0) break;
  }
  assert.ok(p.x !== x0 || p.y !== y0, "a step is taken");
  assert.equal(p.recall, null, "walking off cancels it");
  for (let i = 0; i < 25; i++) v = W.step(100);
  assert.equal(W.p.map, "meadow");
  assert.equal(p.ch.inv.find((s) => s.id === "recall").n, 1, "a broken reading keeps the scroll");
}

// ── daily tasks: three a day, the same for the same name and day, renewed at 06:00 KST
{
  const W = world("하루");
  const ch = L.hero("하루", { lvl: 13 });   // tier 4
  L.addPlayer(W.S, W.PID, ch);
  let me = W.step().self;
  assert.ok(me.daily && me.daily.tasks.length === 3, "three tasks");
  assert.equal(me.daily.tasks[0].kind, "kill");
  assert.ok(D.mobs[me.daily.tasks[0].k].tier <= 6, "the hunt matches the level (tier 4 + 2)");
  assert.equal(new Set(me.daily.tasks.map((t) => t.kind)).size, 3, "three different kinds");
  for (const t of me.daily.tasks) assert.ok(t.text && t.reward.gold > 0 && t.need >= 1);
  const first = JSON.stringify(me.daily.tasks.map((t) => [t.kind, t.k, t.need]));

  // the same character on another server the same day gets the same tasks
  const W2 = world("하루", BASE + 3 * HOUR);
  const ch2 = L.hero("하루", { lvl: 13 });
  L.addPlayer(W2.S, W2.PID, ch2);
  assert.equal(JSON.stringify(W2.step().self.daily.tasks.map((t) => [t.kind, t.k, t.need])), first, "rolled deterministically from day and name");

  // the reset clock: from 08:00 KST it is 22 hours to the next 06:00
  assert.ok(Math.abs(me.daily.reset - 22 * HOUR) < 1000, "next reset is 06:00 KST");

  // progress: hunting the named monster counts, others don't
  const kt = W.p.ch.daily.tasks[0];
  const home = D.maps.find((m) => m.mobs.includes(kt.k));
  W.to(home.id, 10, 10); W.step();
  W.kill(kt.k);
  assert.equal(W.self().daily.tasks[0].n, 1, "a kill of the named monster counts");
  const other = home.mobs.find((k) => k !== kt.k && !D.mobs[k].chest && !D.mobs[k].boss);
  if (other) { W.kill(other); assert.equal(W.self().daily.tasks[0].n, 1, "another monster does not"); }
  // an elite counts for an elite task if there is one
  const et = W.p.ch.daily.tasks.find((t) => t.kind === "elite");
  if (et) { W.kill(kt.k, 1); assert.equal(et.n, 1, "an elite kill counts toward the elite task"); }

  assert.equal(W.act({ t: "daily", i: 0 }).error, "아직 과제를 마치지 못했습니다");
  assert.equal(W.act({ t: "daily", i: 5 }).error, "없는 과제입니다");
  assert.equal(W.act({ t: "daily", i: "bonus" }).error, "세 과제의 보상을 모두 받아야 합니다");
  kt.n = kt.need - 1;
  W.kill(kt.k);
  assert.ok(W.p.toast.some((s) => s.includes("일일 과제 완료")) || kt.n === kt.need, "finishing is called out");
  let g0 = W.p.ch.gold;
  assert.ok(W.act({ t: "daily", i: 0 }).ok);
  assert.ok(W.p.ch.gold > g0, "a task pays gold");
  assert.equal(W.act({ t: "daily", i: 0 }).error, "이미 보상을 받았습니다");
  for (const t of W.p.ch.daily.tasks) t.n = t.need;
  assert.ok(W.act({ t: "daily", i: 1 }).ok && W.act({ t: "daily", i: 2 }).ok);
  g0 = W.p.ch.gold;
  const inv0 = W.p.ch.inv.length;
  assert.ok(W.act({ t: "daily", i: "bonus" }).ok, "all three done: the completion chest opens");
  assert.ok(W.p.ch.gold > g0 && W.p.ch.inv.length > inv0, "with gold and a piece of gear");
  assert.equal(W.act({ t: "daily", i: "bonus" }).error, "이미 보상을 받았습니다");
  me = W.self();
  assert.ok(me.ach.includes("daily1"), "the first chest is an achievement");
  assert.equal(me.cnt.daily, 1);

  // 05:59 KST next day: still today's; 06:00: new tasks
  const day0 = me.daily.day;
  W.now = BASE + 22 * HOUR - 60000 - 100;
  me = W.self();
  assert.equal(me.daily.day, day0, "05:59 KST is still the same day");
  assert.ok(me.daily.bonus, "and the chest stays opened");
  W.now = BASE + 22 * HOUR + 1000;
  for (let i = 0; i < 12; i++) me = W.step(100).self;
  me = W.self();
  assert.equal(me.daily.day, day0 + 1, "06:00 KST rolls a new day");
  assert.ok(!me.daily.bonus && me.daily.tasks.every((t) => t.n === 0 && !t.claimed), "with fresh tasks");
}

// ── achievements and titles
{
  const W = world("칭호");
  const ch = L.hero("칭호", { lvl: 200 });
  ch.kills = 999;
  L.addPlayer(W.S, W.PID, ch);
  let v = W.step();
  assert.ok(v.self.ach.includes("hunt100") && v.self.ach.includes("lv50"), "achievements already earned unlock on joining");
  assert.ok(!v.self.ach.includes("hunt1000"));
  W.to("meadow", 10, 10); W.step();
  W.kill("twinhare");
  v = W.step();
  assert.ok(W.p.ch.ach.includes("hunt1000"), "the thousandth kill unlocks 숙련된 사냥꾼");
  assert.ok(W.self().pts >= 5 + 10 + 40, "points add up");
  assert.equal(W.act({ t: "title", id: "hunt10000" }).error, "아직 얻지 않은 칭호입니다");
  assert.equal(W.act({ t: "title", id: "hunt100" }).error, "없는 칭호입니다");
  assert.equal(W.act({ t: "title", id: "nope" }).error, "없는 칭호입니다");
  const hp0 = W.self().mhp;
  assert.ok(W.act({ t: "title", id: "lv50" }).ok);
  v = W.step();
  assert.equal(v.self.title, "lv50");
  assert.equal(W.self().mhp - hp0, 80, "a rarer title carries a small bonus");
  const row = v.who.find((r) => r[0] === W.p.eid) || v.who[0];
  assert.equal(row[13], "전설의 모험가", "the worn title shows on the who row (index 13; the outfit follows it)");
  assert.ok(W.act({ t: "title", id: "" }).ok);
  assert.equal(W.self().title, "");
  assert.equal(W.self().mhp, hp0, "taking it off takes the bonus away");
}

// ── the monster collection: registered at the first mastery star, a full region pays for good
{
  const W = world("도감");
  L.addPlayer(W.S, W.PID, L.newChar("도감", "warrior", []));
  W.step();
  const kinds = D.collection.meadow.mobs;
  for (const k of kinds) W.p.ch.mk[k] = D.colNeed;
  W.p.ch.mk[kinds[0]] = D.colNeed - 1;
  W.p.stc = null;
  const hp0 = W.self().mhp;
  assert.deepEqual(W.self().col, []);
  W.to("meadow", 10, 10); W.step();
  W.kill(kinds[0]);
  const me = W.self();
  assert.deepEqual(me.col, ["meadow"], "the last meadow kind registered finishes the region");
  assert.equal(me.mhp - hp0, 20, "and the meadow's bonus is +20 HP");
  assert.ok(me.ach.includes("col1"));
  assert.ok(chatHas(W, "몬스터 도감을 완성"), "announced to the server");
}

// ── the world event: called out two minutes ahead, three waves of elites, a boss, rewards by share
{
  const slot = Math.ceil(BASE / D.event.every) + 1;
  const start = slot * D.event.every;
  const W = world("수호자", start - D.event.warn - 5000);
  const W2name = "조력자";
  L.addPlayer(W.S, W.PID, L.newChar("수호자", "warrior", []));
  const ch2 = L.newChar(W2name, "warrior", []);
  L.addPlayer(W.S, "pid-" + W2name, ch2);
  let v = W.step();
  assert.equal(v.self.evt.phase, "idle");
  assert.ok(Math.abs(v.self.evt.next - (start - W.now)) < 1000, "the countdown points at the next :00 or :30");
  const evMap = v.self.evt.nextMap;
  assert.ok(D.event.maps.includes(evMap));
  W.now = start - D.event.warn + 100;
  v = W.step();
  assert.equal(v.self.evt.phase, "warn", "two minutes ahead it is called out");
  assert.equal(v.self.evt.map, evMap, "on the map the countdown named");
  assert.ok(chatHas(W, "2분 뒤"));
  W.now = start;
  v = W.step();
  assert.equal(v.self.evt.phase, "on");
  assert.equal(v.self.evt.waves, 1);
  const rt = L.runtime(W.S, evMap);
  const wave1 = rt.mobs.filter((m) => m.evt && !m.dead);
  assert.ok(wave1.length >= 5 && wave1.every((m) => m.el === 1 && m.temp), "the first wave is elites");
  // both players fight; the hero does most of the work
  const p = W.p, p2 = W.S.players["pid-" + W2name];
  const wp = L.runtime(W.S, evMap) && D.waypoints.find((o) => o.id === evMap);
  assert.ok(wp);
  for (const q of [p, p2]) { L.runtime(W.S, q.map).n--; q.map = evMap; L.runtime(W.S, evMap).n++; q.x = wave1[0].x - 12; q.y = wave1[0].y; q.sendMap = true; q.ch.lvl = 157; q.stc = null; }
  const hitAll = (who, list) => {
    for (const m of list) {
      if (m.dead) continue;
      m.x = who.x + 12; m.y = who.y; m.hp = Math.min(m.hp, 50); who.atkAt = 0; who.stag = 0; who.dir = 2; who.aim = 0; who.hp = 1e6;
      W.S.now = W.now;
      const a = { t: "atk" };
      if (L.validateAction(W.S, who.pid, a).ok) L.applyAction(W.S, who.pid, a);
      W.step(10);
    }
  };
  hitAll(p, wave1.slice(1));
  hitAll(p2, wave1.slice(0, 1));
  assert.ok(W.S.evt.dmg[p.pid] > W.S.evt.dmg[p2.pid] && W.S.evt.dmg[p2.pid] > 0, "damage is tallied per player");
  W.now = start + D.event.waves[1];
  v = W.step();
  assert.equal(v.self.evt.waves, 2, "the second wave at 2:30");
  W.now = start + D.event.waves[2];
  v = W.step();
  assert.equal(v.self.evt.waves, 3, "the third at 5:00");
  W.now = start + D.event.boss;
  v = W.step();
  assert.equal(v.self.evt.phase, "boss", "the boss at 6:00");
  const boss = rt.mobs.find((m) => m.evt && m.el === 2 && !m.dead);
  assert.ok(boss, "an event boss stands by the waypoint");
  assert.ok(chatHas(W, "균열 침공의 우두머리"));
  const g1 = p.ch.gold, g2 = p2.ch.gold;
  // (the map's own monsters that wandered over step back, so the blow finds the boss)
  for (const m of rt.mobs) if (m !== boss && !m.dead && Math.abs(m.x - p.x) < 80 && Math.abs(m.y - p.y) < 80) m.dead = true;
  boss.hp = 1; boss.x = p.x + 12; boss.y = p.y; p.atkAt = 0; p.stag = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
  W.S.now = W.now;
  assert.ok(L.validateAction(W.S, W.PID, { t: "atk" }).ok);
  L.applyAction(W.S, W.PID, { t: "atk" });
  v = W.step();
  assert.equal(v.self.evt.phase, "done", "killing the boss ends the event early");
  assert.ok(rt.mobs.every((m) => !m.evt || m.dead), "what is left of the waves goes");
  assert.ok(p.ch.gold - g1 > p2.ch.gold - g2 && p2.ch.gold > g2, "everyone who fought is paid, more for more");
  assert.equal(p.ch.cnt.evt, 1); assert.equal(p.ch.cnt.evb, 1);
  assert.ok(p.ch.ach.includes("evt1") && p2.ch.ach.includes("evt1"));
  assert.ok(Array.isArray(v.self.evt.top) && v.self.evt.top[0][0] === "수호자", "the board shows the top three");
  assert.ok(chatHas(W, "1위 수호자"));
  // and the next one: called out before :00/:30 again, on the map the schedule names
  W.now = start + D.event.every - D.event.warn + 10;
  v = W.step();
  assert.equal(v.self.evt.phase, "warn");
  // the schedule is a pure function of the clock: another server picks the same map
  const W3 = world("다른서버", start + D.event.every - D.event.warn + 10);
  L.addPlayer(W3.S, W3.PID, L.newChar("다른서버", "warrior", []));
  assert.equal(W3.step().self.evt.nextMap, v.self.evt.map);
  // a server that wakes mid-event joins it
  const W4 = world("늦잠", start + 60000);
  L.addPlayer(W4.S, W4.PID, L.newChar("늦잠", "warrior", []));
  assert.equal(W4.step().self.evt.phase, "on");
}

// ── first steps
{
  const W = world("새내기");
  L.addPlayer(W.S, W.PID, L.newChar("새내기", "warrior", []));
  const v0 = W.step();
  let me = v0.self;
  assert.equal(me.tut.i, 0);
  const town = v0.map;
  const elder = town.npcs.find((n) => n.role === "elder");
  const shop = town.npcs.find((n) => n.role === "shop");
  assert.equal(W.act({ t: "tut", s: "bag" }).error, "지금 할 단계가 아닙니다");
  W.p.x = elder.x * T + 8; W.p.y = elder.y * T + 30;
  assert.ok(W.act({ t: "quest", a: "accept" }).ok, "accepting the first quest is talking to the elder");
  me = W.self();
  // the old dagger in hand does not count: a 모험가 picks a weapon at 수련관 카이 and puts it on
  assert.equal(D.tutorial[me.tut.i].id, "equip", "talk → equip");
  const kai = town.npcs.find((n) => n.role === "train");
  assert.equal(W.act({ t: "starter", wk: "sword" }).ok, false, "the trainer is too far");
  W.p.x = kai.x * T + 8; W.p.y = kai.y * T + 30;
  assert.equal(W.act({ t: "starter", wk: "gun" }).ok, false);
  assert.ok(W.act({ t: "starter", wk: "sword" }).ok, "one free weapon");
  assert.equal(W.act({ t: "starter", wk: "bow" }).error, "이미 무기를 받았습니다", "only one");
  assert.ok(W.p.toast.some((s) => s.includes("[녹슨 대검]을 받았습니다")));
  assert.ok(W.act({ t: "eq", s: W.p.ch.inv.findIndex((s) => s.id === "w_warrior_1") }).ok);
  me = W.self();
  assert.equal(me.wk, "sword");
  assert.ok(me.inv.some((s) => s.id === "w_rogue_1"), "the old dagger goes back to the bag");
  assert.equal(D.tutorial[me.tut.i].id, "bag", "equip → bag");
  assert.ok(W.act({ t: "tut", s: "bag" }).ok);
  me = W.self();
  assert.equal(D.tutorial[me.tut.i].id, "buy");
  W.p.x = shop.x * T + 8; W.p.y = shop.y * T + 30;
  W.p.ch.gold = 500;
  assert.ok(W.act({ t: "buy", id: "hp_s", n: 1 }).ok);
  me = W.self();
  assert.equal(D.tutorial[me.tut.i].id, "hunt");
  W.to("meadow", 10, 10); W.step();
  for (let i = 0; i < 3; i++) W.kill("twinhare");
  me = W.self();
  assert.equal(D.tutorial[me.tut.i].id, "rest", "three hares");
  // sitting by the fire until its warmth settles in
  const f = L.runtime(W.S, "meadow").fires[0];
  W.p.x = f.x + 10; W.p.y = f.y + 12; W.p.mvAt = W.now; W.p.hitAt = -1e9; W.p.warm = 0;
  assert.ok(W.act({ t: "sit" }).ok);
  for (let i = 0; i < 400 && D.tutorial[W.p.ch.tut.i].id === "rest"; i++) { W.p.hitAt = -1e9; W.step(100); }
  assert.equal(D.tutorial[W.p.ch.tut.i].id, "skill", "a rest by the fire");
  // weapon skills come with mastery: the sword's second at 10, its first from the start
  assert.equal(W.act({ t: "sk", id: "rend" }).error, "[대검] 숙련 10에 배웁니다");
  W.p.mp = 999; W.p.stc = null;
  const items0 = JSON.stringify(W.p.ch.inv);
  W.p.skAt = {};
  const r = W.act({ t: "sk", id: "slash" });
  assert.ok(r.ok, "casting: " + r.error);
  me = W.self();
  assert.equal(D.tutorial[me.tut.i].id, "level", "skill → the appended last step");
  assert.notEqual(JSON.stringify(W.p.ch.inv), items0, "the skill step pays a campfire kit and return scrolls");
  // the last step: a stat point by the fire
  W.p.ch.xp = 1000;
  assert.ok(W.act({ t: "train", a: [1, 0, 0, 0, 0, 0] }).ok, "a point by the meadow's fire");
  me = W.self();
  assert.equal(me.tut.i, D.tutorial.length, "all first steps done");
  assert.equal(me.lvl, 2);
}

/** A sheet as the four-class days saved it (v9): a class, levels 1–50, stat training, skill levels, counters in `st`. */
function oldSheet(name, cls, lvl = 1, extra = {}) {
  const ch = L.newChar(name, []);
  for (const k of ["job", "xpt", "st", "wm", "rs", "sw", "cnt"]) delete ch[k];
  delete ch.eq.weapon2;
  const id = { warrior: "w_warrior_1", rogue: "w_rogue_1", lancer: "w_lancer_1", ranger: "w_lancer_1", mage: "w_mage_1" }[cls];
  Object.assign(ch, { v: 9, cls, lvl, tr: { str: 0, vit: 0, int: 0, grd: 0 }, skl: [1, 1, 1, 1, 1, 1], st: { elite: 0 } }, extra);
  if (!extra.eq) ch.eq.weapon = { id, q: 0, enh: 0, af: [], sk: 0, ru: [] };
  return ch;
}

// ── an old sheet (v3) is brought up to date
{
  const W = world("고참");
  const old = oldSheet("고참", "warrior");
  for (const k of ["wp", "seen", "ach", "title", "st", "daily", "tut"]) delete old[k];
  old.v = 3; old.lvl = 20; old.kills = 500;
  old.title = "hunt10000"; // not earned
  L.addPlayer(W.S, W.PID, old);
  const me = W.step().self;
  assert.deepEqual(me.wp, { town: 1 });
  assert.equal(me.title, "", "an unearned title is dropped");
  assert.equal(me.tut.i, D.tutorial.length, "a seasoned character skips the first steps");
  assert.ok(me.ach.includes("hunt100") && me.ach.includes("lv10"), "what it already did counts");
  assert.ok(me.daily && me.daily.tasks.length === 3);
  const ex = L.exportChar(W.S, W.PID);
  assert.ok(ex.v >= 5, "the sheet is at the current version");
  // a damaged daily is rolled again, not trusted
  const bad = L.newChar("망가짐", "warrior", []);
  bad.daily = { day: 5, tasks: [{ kind: "kill", k: "nope", n: 1, need: 3 }], claimed: [], bonus: 0 };
  bad.wp = ["town", "nowhere"]; bad.ach = ["hunt100", "nope"];
  L.addPlayer(W.S, "pid-bad", bad);
  W.step();
  const bp = W.S.players["pid-bad"].ch;
  assert.deepEqual(bp.wp, { town: 1 });
  assert.ok(!bp.ach.includes("nope"));
  assert.equal(bp.daily.tasks.length, 3);
}

// ── a v8 sheet comes up to v9: its waypoint list becomes stone masks (each map's stone 0), and it gains
// the 차원 균열 daily count; a v9 sheet's masks are cleaned, not trusted
{
  const W = world("구판");
  const old = oldSheet("구판", "rogue");
  old.v = 8; old.wp = ["town", "meadow", "forest", "nowhere"]; delete old.dim;
  L.addPlayer(W.S, W.PID, old);
  const ch = W.S.players[W.PID].ch;
  assert.deepEqual(ch.wp, { town: 1, meadow: 1, forest: 1 }, "each map it had keeps its first stone");
  assert.deepEqual(ch.dim, { day: 0, n: 0 });
  assert.equal(ch.v, 12);
  assert.deepEqual(W.step().self.wp, { town: 1, meadow: 1, forest: 1 }, "the wire carries the masks");
  assert.equal(L.newChar("새판", "warrior", []).v, 12);
  assert.deepEqual(L.newChar("새판", "warrior", []).wp, { town: 1 });
  const odd = L.newChar("이상", "lancer", []);
  odd.wp = { meadow: 5, nowhere: 1, forest: 0, cave: "x", maple: 1 << 12 }; odd.dim = { day: -4, n: 1e6 };
  L.addPlayer(W.S, "pid-odd", odd);
  const oc = W.S.players["pid-odd"].ch;
  assert.deepEqual(oc.wp, { meadow: 5, town: 1 }, "unknown maps, empty and out-of-range masks go; the town's stone is always known");
  assert.deepEqual(oc.dim, { day: 0, n: 999 });
  // warping needs the destination's first stone
  W.S.players[W.PID].ch.wp = { town: 1 };
  assert.equal(L.validateAction(W.S, W.PID, { t: "warp", to: "meadow" }).ok, false);
}

// ── jobs (v10): a four-class sheet becomes a 모험가-scale hero of level 4L−3, stats laid out like its class,
// its weapon's mastery at its old level, its class's job from old level 20, everything paid back, nothing lost
{
  const W = world("이주");
  let n = 0;
  const join = (ch) => { const pid = "pid-mig" + n++; L.addPlayer(W.S, pid, ch); return W.S.players[pid].ch; };
  const SH = { warrior: ["sword", "swordsman"], rogue: ["dagger", "thief"], lancer: ["spear", "lancer"], mage: ["staff", "wizard"] };
  const ST = ["str", "wil", "dex", "int", "wis", "luk"];
  for (const cls of Object.keys(SH)) for (const L0 of [1, 19, 20, 35, 50]) {
    const ch = join(oldSheet("이주" + n, cls, L0, { xp: 123, gold: 1000, st: { elite: 7, carp: 1 }, qs: [["s", 0], ["i", "hp_s"], null, null, null, null, null, null, null] }));
    const tag = `${cls} L${L0}`;
    assert.equal(ch.v, 12, tag);
    assert.equal(ch.lvl, Math.min(197, 4 * L0 - 3), tag + ": level 4L−3");
    assert.equal(ST.reduce((s, k) => s + ch.st[k] - 5, 0), ch.lvl - 1, tag + ": a level is a point");
    assert.equal(ch.job, L0 >= 20 ? SH[cls][1] : "adventurer", tag + ": the class's job from old level 20");
    assert.equal(ch.wm[SH[cls][0]].lv, L0, tag + ": the class weapon's mastery = the old level");
    assert.ok(ch.xp >= 123 && (ch.lvl === 1 ? ch.xpt === 0 : ch.xpt > 0), tag + ": progress kept, the path's cost recorded");
    assert.equal(ch.rs, 1, tag + ": one free reset"); assert.equal(ch.sw, 1, tag + ": no starter pick");
    assert.ok(!("cls" in ch) && !("tr" in ch) && !("skl" in ch), tag + ": old fields gone");
    assert.deepEqual([ch.cnt.elite, ch.cnt.carp], [7, 1], tag + ": achievement counters move to cnt");
    assert.equal(ch.eq.weapon.id, `w_${cls}_1`, tag + ": the weapon stays");
    assert.deepEqual(ch.qs[1], ["i", "hp_s"], tag + ": items stay on the bar");
    const sks = ch.qs.filter((v) => v && v[0] === "s").map((v) => v[1]);
    assert.equal(sks.length, [1, 10, 20].filter((lv) => lv <= L0).length, tag + ": the old kit's entries go, the weapon's skills the mastery holds (and the job's signature) come onto the bar");
    assert.ok(sks.every((id) => typeof id === "string" && D.skills[id]), tag + ": skills on the bar by id");
  }
  // the class's stat shape: a warrior leans on STR and WIL, a rogue on DEX and LUK, a mage on INT
  const w = join(oldSheet("전사50", "warrior", 50)).st, r = join(oldSheet("도적50", "rogue", 50)).st, m = join(oldSheet("법사50", "mage", 50)).st;
  assert.ok(w.str > w.wil && w.wil > w.luk && w.int === 5, "warrior: " + JSON.stringify(w));
  assert.ok(r.dex > r.luk && r.luk > r.wil && r.int === 5, "rogue: " + JSON.stringify(r));
  assert.ok(m.int > m.wis && m.wis > m.wil && m.str === 5, "mage: " + JSON.stringify(m));
  // a mage with a book in hand becomes a 마도사 and keeps the staff half-learned
  const bk = join(oldSheet("책법사", "mage", 30, { eq: { weapon: { id: "w_book_2", q: 0, enh: 0, af: [], sk: 0, ru: [] }, armor: null } }));
  assert.equal(bk.job, "warlock");
  assert.deepEqual([bk.wm.book.lv, bk.wm.staff.lv], [30, 18]);
  assert.ok(bk.st.wil > bk.st.wis, "a book mage leans on WIL before WIS");
  const sf = join(oldSheet("봉법사", "mage", 30));
  assert.equal(sf.job, "wizard");
  assert.deepEqual([sf.wm.staff.lv, sf.wm.book.lv], [30, 18]);
  // old ranger and archer sheets were lancers already; their guns became spears
  const rg = join(oldSheet("옛사수", "ranger", 25, { eq: { weapon: { id: "w_ranger_3", q: 2, enh: 4, af: [["atk", 3]], sk: 0, ru: [] } } }));
  assert.equal(rg.job, "lancer"); assert.equal(rg.wm.spear.lv, 25); assert.equal(rg.eq.weapon.id, "w_lancer_3"); assert.equal(rg.eq.weapon.enh, 4);
  // a weapon of another class is no longer swapped for a rusty one
  const mm = join(oldSheet("엉뚱", "warrior", 22, { eq: { weapon: { id: "w_mage_3", q: 3, enh: 7, af: [], sk: 1, ru: [], lg: "chain" } }, inv: [{ id: "w_rogue_2", q: 1, enh: 0, af: [], sk: 0, ru: [] }] }));
  assert.equal(mm.eq.weapon.id, "w_mage_3"); assert.equal(mm.eq.weapon.lg, "chain"); assert.equal(mm.eq.weapon.enh, 7);
  assert.deepEqual(mm.inv.map((s) => s.id), ["w_rogue_2"]);
  assert.equal(mm.job, "swordsman", "the job follows the class, whatever is in hand");
  // stat training and skill levels are paid back: 120 + 40n experience a point; every skill level's gold and experience
  const xpNeed = (lv) => Math.round((34 * Math.pow(lv, 1.85) + 20) * 6);      // the old curve (factor 6 below level 7)
  const tr = join(oldSheet("수련생", "warrior", 10, { xp: 0, gold: 0, tr: { str: 3, vit: 2, int: 0, grd: 1 } }));
  assert.equal(tr.xp, 120 + 160 + 200 + 120 + 160 + 120, "training refunded");
  const sl = join(oldSheet("숙련가", "warrior", 10, { xp: 0, gold: 0, skl: [3, 1, 1, 1, 1, 1] }));
  assert.equal(sl.gold, 125 + 375, "two levels of 대검 투척: gold back");
  assert.equal(sl.xp, Math.round(xpNeed(3) * 0.12) + Math.round(xpNeed(3) * 0.24), "and their experience");
  // migrating twice changes nothing; a v10 sheet is only cleaned
  const once = join(oldSheet("두번", "lancer", 33, { xp: 5000, tr: { str: 4, vit: 0, int: 0, grd: 0 } }));
  const twice = join(JSON.parse(JSON.stringify(once)));
  const strip = (c) => { const o = JSON.parse(JSON.stringify(c)); delete o.hp; delete o.mp; return o; };
  assert.deepEqual(strip(twice), strip(once), "idempotent");
  const forged = join({ ...JSON.parse(JSON.stringify(once)), st: { str: 400, wil: -3, dex: "x", int: 5, wis: 5, luk: 5 }, lvl: 999, job: "emperor", wm: { sword: { lv: 99, xp: -5 } }, xp: -1 });
  assert.equal(forged.st.str, 99); assert.equal(forged.st.wil, 5); assert.equal(forged.st.dex, 5);
  assert.equal(forged.lvl, 1 + 94, "the level is recomputed from the stats, never trusted");
  assert.equal(forged.job, "adventurer"); assert.equal(forged.wm.sword.lv, 50); assert.equal(forged.wm.bow.lv, 1); assert.equal(forged.xp, 0);
  // a single-job hero whose mastery is somehow below 20 keeps the job
  const keep = join({ ...JSON.parse(JSON.stringify(once)), wm: {} });
  assert.equal(keep.job, "lancer");
  // a v10 sheet (housing: a bigger bag and a house, still four classes) becomes a v11 hero and keeps both
  const h10 = oldSheet("집주인", "rogue", 30, { v: 10, bagCap: 60, house: { tier: 1, storage: [{ id: "hp_m", n: 7 }] } });
  h10.inv = Array.from({ length: 50 }, () => ({ id: "h_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }));
  const hj = join(h10);
  assert.equal(hj.v, 12); assert.equal(hj.job, "thief"); assert.equal(hj.lvl, 117); assert.equal(hj.wm.dagger.lv, 30);
  assert.equal(hj.bagCap, 60); assert.equal(hj.inv.length, 50, "nothing in the bigger bag is lost");
  assert.equal(hj.house.tier, 1); assert.deepEqual(hj.house.storage.map((s) => s.id), ["hp_m"]);
}

// ── life skills (v12): an older sheet's 낚시/요리 start from its counters (8 XP a fish, 10 a dish, at most Lv 20);
// the 알바 board, trust, co-op days and the 재료 주머니 come up empty; a v12 sheet is cleaned, never trusted
{
  const W = world("생활");
  L.addPlayer(W.S, W.PID, L.newChar("생활", []));
  let n = 0;
  const join = (ch) => { const pid = "pid-life" + n++; L.addPlayer(W.S, pid, ch); return W.S.players[pid].ch; };
  const bare = (ch) => { for (const k of ["life", "jobBoard", "rep", "coopDay", "coopDone", "pouch"]) delete ch[k]; return ch; };
  const need = D.life.need;
  // the level and leftover experience `xp` buys from Lv 1, never past `cap`
  const lvFor = (xp, cap = 20) => { let lv = 1; while (lv < cap && xp >= need[lv - 1]) { xp -= need[lv - 1]; lv++; } return { lv, xp: lv >= cap ? Math.min(xp, need[lv - 1] - 1) : xp }; };
  const fresh = { day: 0, done: [], active: null };
  // a four-class sheet (v9, counters still in `st`), a housing sheet (v10) and a jobs sheet (v11)
  const v9 = join(bare(oldSheet("구판낚시", "rogue", 12, { fish: 50, st: { elite: 1, cook: 30 } })));
  const v10 = join(bare(oldSheet("집낚시", "mage", 20, { v: 10, fish: 3, st: { cook: 0 }, bagCap: 60 })));
  const s11 = bare(L.newChar("직업낚시", []));
  Object.assign(s11, { v: 11, fish: 100000, cnt: { ...s11.cnt, cook: 7 } });
  const v11 = join(s11);
  for (const [ch, fish, cook, tag] of [[v9, 50, 30, "v9"], [v10, 3, 0, "v10"], [v11, 100000, 7, "v11"]]) {
    assert.equal(ch.v, 12, tag);
    assert.deepEqual(ch.life.fish, lvFor(fish * 8), tag + ": 낚시 from the fish caught");
    assert.deepEqual(ch.life.cook, lvFor(cook * 10), tag + ": 요리 from the dishes cooked");
    for (const k of ["gather", "craft", "alch", "deliver"]) assert.deepEqual(ch.life[k], { lv: 1, xp: 0 }, tag + " " + k);
    assert.deepEqual([ch.jobBoard, ch.rep, ch.coopDay, ch.coopDone, ch.pouch], [fresh, {}, 0, [], {}], tag + ": the rest starts empty");
  }
  assert.deepEqual(v9.life.fish, { lv: 4, xp: 140 }, "400 XP: 50 + 80 + 130 spent, 140 toward Lv 5");
  assert.deepEqual(v11.life.fish, { lv: 20, xp: need[19] - 1 }, "a lifetime of fishing stops at Lv 20");
  assert.equal(v10.bagCap, 60, "the v10 fields stay");
  // a new character starts every skill at Lv 1
  const nc = L.newChar("새내기낚시", []);
  assert.deepEqual(Object.keys(nc.life), D.life.keys);
  assert.ok(D.life.keys.every((k) => nc.life[k].lv === 1 && nc.life[k].xp === 0));
  assert.deepEqual([nc.jobBoard, nc.rep, nc.coopDay, nc.coopDone, nc.pouch], [fresh, {}, 0, [], {}]);
  // a messy v12 sheet: levels and experience clamped, unknown skills, NPCs, jobs, co-op kinds and items dropped
  const messy = L.newChar("엉망낚시", []);
  Object.assign(messy, {
    life: { fish: { lv: 99, xp: 5 }, cook: { lv: 10, xp: 1e9 }, gather: { lv: -3, xp: -5 }, craft: "x", sorcery: { lv: 5, xp: 0 } },
    jobBoard: { day: -2, done: ["nope", 5, "nope"], active: { id: "nope", npc: "x", prog: 1, expAt: 9 } },
    rep: { nope: 50, mocha: 0 }, coopDay: -9, coopDone: ["apt", "apt", "diner", "bowling"],
    pouch: { m_h1: 1500, m_o3: 2.7, hp_s: 5, nope: 3, m_w2: 0, m_w5: -1 },
  });
  const mc = join(messy);
  assert.deepEqual(mc.life.fish, { lv: 50, xp: 0 }); assert.deepEqual(mc.life.cook, { lv: 10, xp: need[9] - 1 });
  assert.deepEqual(mc.life.gather, { lv: 1, xp: 0 }); assert.deepEqual(mc.life.craft, { lv: 1, xp: 0 });
  assert.ok(!("sorcery" in mc.life));
  assert.deepEqual(mc.jobBoard, fresh); assert.deepEqual(mc.rep, {}); assert.equal(mc.coopDay, 0);
  assert.deepEqual(mc.coopDone, ["apt", "diner"]);
  assert.deepEqual(mc.pouch, { m_h1: 999, m_o3: 2 }, "only materials, 1..999 of each");
  // migrating twice changes nothing
  const twice = join(JSON.parse(JSON.stringify(v9)));
  const strip = (c) => { const o = JSON.parse(JSON.stringify(c)); delete o.hp; delete o.mp; return o; };
  assert.deepEqual(strip(twice), strip(v9), "idempotent");
  // the wire: [lv, xp, need] per skill
  const sv = W.self();
  assert.equal(sv.life.length, 6);
  assert.deepEqual(sv.life[0], [1, 0, 50]);
}

console.log("content ok — waypoints", D.waypoints.length, "achievements", D.achievements.length, "event every", D.event.every / 60000, "min");
