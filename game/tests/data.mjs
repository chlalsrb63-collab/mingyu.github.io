// Headless test of the world map editor's data (data/**, docs/editor/SCHEMA.md): the sample
// map 버드나무 마을 is walkable and joined to the town both ways, a built-in map exported for
// the editor comes back tile for tile, side quests of every kind run from taking to hand-in,
// bad data is refused in Korean, old sheets gain the side-quest record, and the playtest
// spot lands on open ground: node tests/data.mjs
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as L from "../src/logic.js";
import { loadLogic, mapToEditor, checkData, palette, defsForEditor, listMaps } from "../scripts/editor-lib.mjs";
import { EMPTY_DATA } from "../scripts/build-logic.mjs";

const T = 16;
const BASE = Date.UTC(2026, 10, 12, 23, 0, 0);
const hangul = /[가-힣]/;
const blocked = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.o[y][x] !== " " || "wW".includes(m.g[y][x]);
function flood(m, sx, sy) {
  const d = new Uint8Array(m.w * m.h), q = [[sx, sy]];
  d[sy * m.w + sx] = 1;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (blocked(m, nx, ny) || d[ny * m.w + nx]) continue;
      d[ny * m.w + nx] = 1; q.push([nx, ny]);
    }
  }
  return d;
}
/** A world of one player driven tick by tick (`Lx` is a rules module: the committed one or one built with other data). */
function world(Lx, name = "모험가") {
  const S = Lx.setup();
  let now = BASE;
  S.now = now;
  const PID = "pid-" + name;
  Lx.addPlayer(S, PID, Lx.newChar(name, "warrior", []));
  const W = {
    S, PID, toasts: [],
    step(ms = 100) { now += ms; Lx.tick(S, now); const v = JSON.parse(JSON.stringify(Lx.viewFor(S, PID))); if (v.toast) W.toasts.push(...v.toast); Lx.endTick(S); return v; },
    act(a) { S.now = now; const v = Lx.validateAction(S, PID, a); if (v.ok) Lx.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    /** Stand on tile (tx, ty) of map `id` (a teleport for the test's sake). */
    to(id, tx, ty) { const p = W.p; Lx.runtime(S, p.map).n--; p.map = id; Lx.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
    /** Walk straight onto tile (tx, ty) in small steps (doors take you through). */
    walk(tx, ty) {
      const p = W.p, gx = tx * T + 8, gy = ty * T + 10;
      for (let i = 0; i < 200 && Math.hypot(p.x - gx, p.y - gy) > 1; i++) {
        const d = Math.hypot(gx - p.x, gy - p.y), k = Math.min(1, 6 / d);
        now += 60; S.now = now;
        const r = W.act({ t: "mv", x: p.x + (gx - p.x) * k, y: p.y + (gy - p.y) * k, d: 0 });
        assert.ok(r.ok, r.error);
        if (W.p.map !== W.from) return;
      }
    },
    npc(id) { for (const mid of Object.keys(Lx.atlas().maps)) { const n = Lx.atlas().maps[mid].npcs.find((o) => o.id === id); if (n) return { map: mid, n }; } return null; },
    /** Stand right below an NPC. */
    meet(id) { const { map, n } = W.npc(id); W.to(map, n.x, n.y + 1); W.p.y -= 4; },
    kill(k) {
      const p = W.p, rt = Lx.runtime(S, p.map);
      const find = () => rt.mobs.find((x) => x.k === k && !x.dead && !x.evt) || rt.mobs.find((x) => x.k === k && !x.evt);
      if (!find()) W.step(); // the cells around wake and fill
      const m = find();
      assert.ok(m, `a ${k} lives in ${p.map}`);
      m.dead = false; m.el = 0; m.tr = []; m.hp = 1; m.x = p.x + 12; m.y = p.y; m.by = {};
      for (const o of rt.mobs) if (o !== m && !o.dead && Math.hypot(o.x - p.x, o.y - p.y) < 90) { o.x += 4000; o.hx = o.x; }
      p.atkAt = 0; p.dir = 2; p.aim = 0; p.hp = 1e6;
      assert.ok(W.act({ t: "atk" }).ok);
      assert.ok(m.dead, `the ${k} falls`);
      W.step(20);
    },
  };
  return W;
}
const sqOf = (self, id) => { const r = self.sq.find((x) => x[0] === id); return r && { st: r[1], n: r[2], need: r[3] }; };

// ── the sample map: 버드나무 마을, a safe village south of the town
{
  const { maps, fires, waypoints } = L.atlas();
  const m = maps.willow;
  assert.ok(m, "willow is built from data/maps/willow.json");
  assert.equal(m.name, "버드나무 마을");
  assert.ok(m.safe && m.spawns.length === 0, "a safe village: no monsters");
  assert.equal(m.g.length, m.h); assert.equal(m.o[0].length, m.w);
  const d = flood(m, m.entry[0], m.entry[1]);
  const at = (x, y) => d[y * m.w + x] === 1;
  const near = (x, y) => at(x, y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy));
  for (const p of m.portals) assert.ok(at(p.x, p.y), `willow: the door to ${p.to} can be walked to`);
  for (const n of m.npcs) assert.ok(near(n.x, n.y), `willow: ${n.name} can be walked to`);
  for (const [x, y] of fires.willow) assert.ok(near(x, y), "willow: the campfire can be reached");
  assert.ok(waypoints.willow && at(waypoints.willow.ax, waypoints.willow.ay), "willow: the waypoint stone can be reached");
  assert.ok(m.npcs.some((n) => n.role === "quest") && m.npcs.filter((n) => n.role === "talk").length >= 3, "three to talk to and one with errands");
  assert.ok(m.big.filter((b) => b.t === "house").length >= 4, "houses are found in the h blocks");
  // links.json: a door out of town into the village, and the village's own door back
  const toW = maps.town.portals.filter((p) => p.to === "willow"), back = m.portals.filter((p) => p.to === "town");
  assert.ok(toW.length && back.length, "town ↔ willow both ways");
  const td = flood(maps.town, maps.town.entry[0], maps.town.entry[1]);
  for (const p of toW) assert.ok(td[p.y * maps.town.w + p.x], "the town's door to willow can be walked to");
  for (const p of [...toW, ...back]) assert.ok(!blocked(maps[p.to], p.tx, p.ty), `the door to ${p.to} lands on open ground`);
  // npcs.json: an NPC added to the town; NPC lines reach the client with the map
  assert.ok(maps.town.npcs.some((n) => n.id === "town_willow_guide" && n.lines.length === 2));
  const D = L.defs();
  assert.ok(D.waypoints.some((w) => w.id === "willow") && D.maps.some((x) => x.id === "willow"));
  assert.ok(!D.event.maps.includes("willow") && !D.collection.willow, "no rift or collection in a safe village");
  assert.equal(D.side.length, 2);

  // walk it: down the town's south road into the village, and back out through its north door
  const W = world(L, "나그네");
  W.to("town", 20, 24);
  W.step();
  W.from = "town"; W.walk(20, 27);
  assert.equal(W.p.map, "willow", "the town's south door leads to willow");
  const v = W.step();
  assert.equal(v.map.id, "willow");
  assert.ok(v.map.portals.some((p) => p.to === "넥서스 광장"), "the client sees where the door goes");
  assert.ok(v.map.npcs.find((n) => n.id === "willow_fisher").lines.length >= 2);
  W.from = "willow"; W.walk(W.p.x / T | 0, 1);
  assert.equal(W.p.map, "town", "and the village's north door leads home");
}

// ── side quests from data/quests.json: a talk errand, then a hunt it unlocks
{
  const W = world(L, "심부름꾼");
  let s = W.self();
  assert.equal(sqOf(s, "sq_willow_letter").st, 1, "the letter can be taken");
  assert.equal(sqOf(s, "sq_willow_frogs").st, 0, "the frogs wait for the letter and level 5");
  W.to("town", 20, 18);
  assert.match(W.act({ t: "sq", a: "take", id: "sq_willow_letter" }).error, hangul, "only beside the giver (in Korean)");
  W.meet("willow_elder");
  assert.ok(W.act({ t: "sq", a: "take", id: "sq_willow_letter" }).ok);
  assert.ok(!W.act({ t: "sq", a: "take", id: "sq_willow_letter" }).ok, "not twice");
  assert.ok(!W.act({ t: "sq", a: "done", id: "sq_willow_letter" }).ok, "not done yet");
  assert.ok(!W.act({ t: "sq", a: "talk", npc: "shop" }).ok, "the shopkeeper is far away");
  W.meet("shop");
  assert.ok(W.act({ t: "sq", a: "talk", npc: "shop" }).ok);
  s = W.self();
  assert.equal(sqOf(s, "sq_willow_letter").st, 3, "delivered: ready to hand in");
  assert.ok(W.toasts.some((t) => t.includes("촌장 버들에게 돌아가세요")));
  W.meet("willow_elder");
  const gold = W.p.ch.gold, xp = W.p.ch.xp;
  assert.ok(W.act({ t: "sq", a: "done", id: "sq_willow_letter" }).ok);
  assert.equal(W.p.ch.gold, gold + 80);
  assert.ok(W.p.ch.xp > xp || W.p.ch.lvl > 1, "experience paid");
  s = W.self();
  assert.equal(sqOf(s, "sq_willow_letter").st, 4, "done for good");
  if (W.p.ch.lvl < 5) W.p.ch.lvl = 5;   // levels went 1–200 with jobs: the old Lv.2 is 5
  s = W.self();
  assert.equal(sqOf(s, "sq_willow_frogs").st, 1, "the hunt opens");
  assert.ok(W.act({ t: "sq", a: "take", id: "sq_willow_frogs" }).ok);
  W.to("meadow", ...L.atlas().maps.meadow.entry);
  for (let i = 0; i < 6; i++) W.kill("gutfrog");
  s = W.self();
  assert.deepEqual(sqOf(s, "sq_willow_frogs"), { st: 3, n: 6, need: 6 });
  W.meet("willow_elder");
  assert.ok(W.act({ t: "sq", a: "done", id: "sq_willow_frogs" }).ok);
  assert.equal(W.p.ch.sq.done.sq_willow_frogs, 1);
  assert.deepEqual(W.p.ch.sq.on, {});
}

// ── every kind of goal, repeatable quests, dropping one, and the main chain replaced — with other data
const cloneData = () => JSON.parse(JSON.stringify(EMPTY_DATA()));
{
  const data = cloneData();
  data.npcs = [{ map: "town", id: "town_cook", name: "요리사 미미", role: "quest", x: 21, y: 24, look: [0, 0, 0, "#c88a3a"], lines: ["배고프지?"] },
    { map: "town", id: "town_poet", name: "시인 하늘", role: "talk", x: 18, y: 24, lines: ["바람이 분다."] }];
  data.quests.side = [
    { id: "sq_fish", giver: "town_cook", title: "생선 두 마리", text: "생선 두 마리만 구해 주렴.", done: "고마워!", goal: { type: "collect", item: "fish_s", n: 2 }, req: { lv: 1 }, reward: { xp: 10, gold: 5, items: [["hp_s", 1]] }, repeat: true },
    { id: "sq_forest", giver: "town_cook", title: "숲 구경", text: "속삭임 숲에 다녀오렴.", goal: { type: "visit", map: "forest" }, reward: { gold: 7 } },
    { id: "sq_poem", giver: "town_cook", title: "시 한 편", text: "시인에게 안부를.", goal: { type: "talk", npc: "town_poet" }, req: { quest: "sq_forest" }, reward: { xp: 5 } },
    { id: "sq_hare", giver: "town_cook", title: "토끼", text: "토끼 둘.", goal: { type: "kill", mob: "twinhare", n: 2 }, reward: { gold: 1 } },
  ];
  data.quests.main = [{ mob: "twinhare", n: 1, title: "새 첫 의뢰", text: "토끼 한 마리.", xp: 10, gold: 10, items: [["hp_s", 1]] }];
  const X = (await loadLogic({ data })).L;
  assert.equal(X.defs().quests.length, 1, "quests.json main replaces the chain");
  assert.equal(X.defs().quests[0].title, "새 첫 의뢰");
  const W = world(X, "요리왕");
  W.meet("town_cook");
  for (const id of ["sq_fish", "sq_forest", "sq_hare"]) assert.ok(W.act({ t: "sq", a: "take", id }).ok, id);
  assert.ok(!W.act({ t: "sq", a: "take", id: "sq_poem" }).ok, "the poem waits for the forest");
  // collect: what is in the bag counts, and is taken on hand-in
  W.p.ch.inv.push({ id: "fish_s", n: 3 });
  let s = W.self();
  assert.equal(sqOf(s, "sq_fish").st, 3);
  assert.ok(W.act({ t: "sq", a: "done", id: "sq_fish" }).ok);
  assert.equal(W.p.ch.inv.find((x) => x.id === "fish_s").n, 1, "two fish handed over");
  s = W.self();
  assert.equal(sqOf(s, "sq_fish").st, 1, "a repeatable quest can be taken again");
  // visit: walking through a door into the forest
  W.to("meadow", ...L.atlas().maps.meadow.entry);
  const door = X.atlas().maps.meadow.portals.find((p) => p.to === "forest");
  W.to("meadow", door.x - 1, door.y);
  W.from = "meadow"; W.walk(door.x, door.y);
  assert.equal(W.p.map, "forest");
  s = W.self();
  assert.equal(sqOf(s, "sq_forest").st, 3, "visiting counts on arrival");
  W.meet("town_cook");
  assert.ok(W.act({ t: "sq", a: "done", id: "sq_forest" }).ok);
  // talk: to someone else
  assert.ok(W.act({ t: "sq", a: "take", id: "sq_poem" }).ok);
  W.meet("town_poet");
  assert.ok(W.act({ t: "sq", a: "talk", npc: "town_poet" }).ok);
  W.meet("town_cook");
  assert.ok(W.act({ t: "sq", a: "done", id: "sq_poem" }).ok);
  // kill — and dropping a quest under way
  W.to("meadow", ...L.atlas().maps.meadow.entry);
  W.kill("twinhare");
  assert.equal(W.p.ch.sq.on.sq_hare, 1);
  assert.ok(W.act({ t: "sq", a: "drop", id: "sq_hare" }).ok);
  assert.ok(!("sq_hare" in W.p.ch.sq.on), "dropped");
  // the quest NPC carries its lines and role to the client
  assert.equal(X.atlas().maps.town.npcs.find((n) => n.id === "town_cook").role, "quest");
}

// ── round trip: a generated map exported for the editor and loaded back as a replacement is the same map
{
  const meadow = await mapToEditor("meadow");
  assert.equal(meadow.replaces, "meadow");
  const data = cloneData();
  data.maps = [JSON.parse(JSON.stringify(meadow))];
  const R = await loadLogic({ data });
  const same = (v) => JSON.parse(JSON.stringify(v));
  const a = same(L.atlas().maps.meadow), b = same(R.E.MAPS.meadow);
  assert.ok(R.E.MAPS.meadow.custom, "the meadow now comes from the data file");
  assert.deepEqual(b.g, a.g, "same ground, tile for tile");
  assert.deepEqual(b.o, a.o, "same objects, tile for tile");
  // (a generated ground's spawns name the zone they live in; an editor map has no zones)
  const unzoned = (l) => l.map(({ zone, ...sp }) => sp);
  assert.deepEqual(unzoned(b.spawns), unzoned(a.spawns), "same spawns");
  assert.deepEqual(R.E.MAPS.meadow.stones, L.atlas().maps.meadow.stones, "same waypoint stones, all three");
  assert.deepEqual(R.E.MAPS.meadow.shrines, L.atlas().maps.meadow.shrines, "same wind shrines");
  // (a generated door names the gate it leads to; the editor's names the tile: both arrive on the same one)
  const doors = (m) => m.portals.map(({ x, y, to, tx, ty }) => ({ x, y, to, tx, ty }));
  assert.deepEqual(doors(R.E.MAPS.meadow), doors(L.atlas().maps.meadow), "same doors");
  assert.deepEqual(R.E.WP.meadow, L.atlas().waypoints.meadow, "same waypoint stone");
  assert.deepEqual(R.E.FIRES.meadow, L.atlas().fires.meadow, "same camps");
  assert.deepEqual(b.marks, a.marks, "same signposts");
  assert.ok(R.E.MAPS.town.portals.some((p) => p.to === "meadow"), "the town's door into it still works");
  // and it plays: monsters, a rift, a collection
  const D = R.L.defs();
  assert.ok(D.event.maps.includes("meadow") && D.collection.meadow);
  const S = R.L.setup();
  const crowd = R.E.MAPS.meadow.cells.spawns.flat().reduce((n, q) => n + q.n, 0) + R.E.MAPS.meadow.cells.fixed.length;
  assert.ok(crowd >= 100, "its monsters live in its cells: " + crowd);
  assert.ok(R.L.runtime(S, "meadow"), "and it comes alive");
  // every generated map converts and comes back the same
  for (const id of ["town", "crypt", "city", "abyss"]) {
    const d2 = cloneData();
    d2.maps = [await mapToEditor(id)];
    const R2 = await loadLogic({ data: d2 });
    assert.deepEqual([R2.E.MAPS[id].g, R2.E.MAPS[id].o], [L.atlas().maps[id].g, L.atlas().maps[id].o], id + " round-trips");
  }
  // and every generated map, saved as it was exported, passes the full check (the editor opens and saves them)
  const dir = mkdtempSync(join(tmpdir(), "tt-all-"));
  try {
    mkdirSync(join(dir, "maps"));
    for (const id of ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"]) writeFileSync(join(dir, "maps", id + ".json"), JSON.stringify(await mapToEditor(id)));
    const r = await checkData(dir);
    assert.ok(r.ok, "exported built-in maps pass data:check: " + JSON.stringify(r.errors.slice(0, 5)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── the editor's view of the game: palette, tables, map list
{
  const pal = await palette();
  assert.ok(pal.ground.find((p) => p.ch === "w").solid && !pal.ground.find((p) => p.ch === ".").solid);
  assert.ok(pal.ground.every((p) => hangul.test(p.name) && p.color));
  assert.ok(pal.objects.find((p) => p.ch === "T").solid && pal.objects.find((p) => p.ch === "h").name.includes("집"));
  const used = new Set();
  for (const m of Object.values(L.atlas().maps)) for (const k of ["g", "o"]) for (const r of m[k]) for (const c of r) used.add(k + c);
  for (const u of used) assert.ok((u[0] === "g" ? pal.ground : pal.objects).some((p) => p.ch === u[1]), `the palette knows ${u}`);
  const D = await defsForEditor();
  assert.ok(D.mobs.gutfrog.name && D.items.hp_s.name && D.roles.includes("quest") && D.themes.includes("cave") && D.bgm.includes("town"));
  const list = await listMaps();
  assert.ok(list.find((x) => x.id === "willow").custom && list.find((x) => x.id === "meadow").builtin);
}

// ── the sample data passes; bad data is refused in Korean with a file and a path
{
  const ok = await checkData();
  assert.ok(ok.ok, "data/ passes: " + JSON.stringify(ok.errors));
  const dir = mkdtempSync(join(tmpdir(), "tt-data-"));
  try {
    mkdirSync(join(dir, "maps"));
    const town = await mapToEditor("town");
    const bad = { ...JSON.parse(JSON.stringify(town)), id: "badmap", replaces: null, name: "나쁜 지도" };
    bad.ground[5] = "?" + bad.ground[5].slice(1);
    bad.entry = [0, 0];                                                   // a tree
    bad.spawns = [{ k: "nosuchmob", n: 3, r: [3, 3, 6, 6] }];
    bad.portals = [{ x: 20, y: 18, to: "nowhere", tx: 1, ty: 1 }];
    bad.npcs = [{ id: "twin", name: "쌍둥이", role: "talk", x: 20, y: 18, lines: ["…"] }, { id: "twin", name: "쌍둥이", role: "talk", x: 21, y: 18, lines: ["…"] }];
    writeFileSync(join(dir, "maps", "badmap.json"), JSON.stringify(bad));
    // a replaced town whose east road is walled off: the meadow's door into it lands in a tree
    const town2 = JSON.parse(JSON.stringify(town));
    town2.objects = town2.objects.map((r) => "T".repeat(4) + r.slice(4));
    writeFileSync(join(dir, "maps", "town.json"), JSON.stringify(town2));
    writeFileSync(join(dir, "links.json"), JSON.stringify({ v: 1, links: [{ map: "town", x: 0, y: 0, to: "willow", tx: 5, ty: 5 }] }));
    writeFileSync(join(dir, "quests.json"), JSON.stringify({ v: 1, main: [{ mob: "ghost", n: 1, title: "x", items: [["nope", 1]] }],
      side: [{ id: "sq_x", giver: "nobody", title: "", text: "t", goal: { type: "kill", mob: "ghost", n: 0 }, req: { quest: "sq_missing" }, reward: { items: [["nope", 1]] } }] }));
    writeFileSync(join(dir, "npcs.json"), "{ not json");
    const r = await checkData(dir);
    assert.ok(!r.ok);
    for (const e of r.errors) { assert.match(e.msg, hangul, "Korean: " + e.msg); assert.ok(e.file, "a file for " + e.msg); }
    const has = (file, path, word) => assert.ok(r.errors.some((e) => e.file.endsWith(file) && (path === null || e.path === path) && e.msg.includes(word)), `${file} ${path} "${word}" in ${JSON.stringify(r.errors, null, 1)}`);
    has("badmap.json", "ground[5]", "알 수 없는 바닥 글자");
    has("badmap.json", "entry", "막힌 칸");
    has("badmap.json", "spawns[0].k", "nosuchmob");
    has("badmap.json", "portals[0].to", "nowhere");
    has("badmap.json", "npcs[1].id", "중복");
    has("town.json", "", "대체한 지도");
    has("links.json", "links[0].to", "willow");
    has("quests.json", "main[0].mob", "ghost");
    has("quests.json", "main[0].items[0]", "nope");
    has("quests.json", "side[0].giver", "nobody");
    has("quests.json", "side[0].title", "비어");
    has("quests.json", "side[0].req.quest", "sq_missing");
    has("npcs.json", null, "JSON");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── old sheets: a v7 sheet gains an empty side-quest record; a messy one is cleaned
{
  const old = L.newChar("옛사람", "mage", []);
  delete old.sq; old.v = 7;
  const S = L.setup();
  L.addPlayer(S, "old", old);
  assert.deepEqual(S.players.old.ch.sq, { on: {}, done: {} });
  assert.equal(S.players.old.ch.v, 12);
  const messy = L.newChar("엉망", "rogue", []);
  messy.sq = { on: { sq_willow_letter: 99, sq_gone: 3, "Bad Id": 1 }, done: { sq_willow_frogs: 2, sq_retired: 1, "x y": 1 } };
  L.addPlayer(S, "messy", messy);
  assert.deepEqual(S.players.messy.ch.sq.on, { sq_willow_letter: 1 }, "progress clamped, unknown quests dropped");
  assert.deepEqual(S.players.messy.ch.sq.done, { sq_willow_frogs: 2, sq_retired: 1 }, "finished quests remembered");
  assert.equal(L.newChar("새내기", "warrior", []).v, 12);
}

// ── the playtest spot (room.ts, local dev only) lands on ground a player can stand on
{
  const ch = L.newChar("시험", "warrior", []);
  assert.ok(L.devPlace(ch, "willow", 24, 30));
  assert.equal(ch.map, "willow");
  const S = L.setup();
  L.addPlayer(S, "t", ch);
  assert.equal(S.players.t.map, "willow", "the character stays where it was put");
  const ch2 = L.newChar("벽속", "warrior", []);
  assert.ok(L.devPlace(ch2, "town", 0, 0), "a tile in the trees moves to open ground");
  L.addPlayer(S, "t2", ch2);
  assert.equal(S.players.t2.map, "town");
  assert.ok(!L.devPlace(L.newChar("없음", "warrior", []), "nowhere", 1, 1));
}
console.log("data ok — willow, links, npcs, side quests (kill/collect/talk/visit), round trip, data:check, old sheets, playtest");
