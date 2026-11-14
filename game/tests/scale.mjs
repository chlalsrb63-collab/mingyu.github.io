// Headless test of the 4× hunting grounds in play (docs/design/scale-and-rift.md C.3–C.4): the
// stones along a big ground wake one by one and carry you between them (and between grounds),
// a wind shrine speeds you on once a minute, an old sheet standing where the ground has changed
// finds itself at that ground's entrance, the old waypoint list keeps its stones, and the cells of
// a big ground wake only round the hunter, never in the safe plaza: node tests/scale.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") + "\nexport const __t = { stats };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));

const T = 16;
const D = L.defs();
const { maps } = L.atlas();

function world(name) {
  const S = L.setup();
  let now = 1000;
  S.now = now;
  const PID = "pid-" + name;
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    to(id, tx, ty) { const p = W.p; L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; p.sendMap = true; },
  };
  return W;
}
const evts = (v, tag) => (v.ev || []).filter((e) => e[0] === tag);

// ── the waypoint list names how many stones each ground has, and what they are called
const wpm = D.waypoints.find((w) => w.id === "meadow");
assert.equal(wpm.n, 3);
assert.deepEqual(wpm.names, ["입구", "중턱", "안쪽"]);
assert.equal(D.waypoints.find((w) => w.id === "town").n, 1);

// ── stones wake one by one, and carry you between them
{
  const W = world("돌지기");
  L.addPlayer(W.S, W.PID, L.newChar("돌지기", "warrior", []));
  const p = W.p, st = maps.meadow.stones;
  W.to("meadow", st[0].ax, st[0].ay);
  let v = W.step(1100);
  assert.equal(v.self.wp.meadow, 1, "the first stone wakes; the others wait (ch.wp: a bitmask per map)");
  assert.equal(W.act({ t: "warp", to: "meadow", i: 1 }).error, "아직 깨우지 않은 이동의 돌입니다");
  assert.equal(W.act({ t: "warp", to: "meadow", i: 3 }).error, "그곳에는 이동의 돌이 없습니다");
  assert.equal(W.act({ t: "warp", to: "meadow", i: 1.5 }).error, "그곳에는 이동의 돌이 없습니다");
  assert.equal(W.act({ t: "warp", to: "meadow" }).error, "이미 이곳에 있습니다");
  // walk to the far stone: it wakes under its own key, with a toast naming it
  W.to("meadow", st[2].ax, st[2].ay);
  v = W.step(1100);
  assert.equal(v.self.wp.meadow, 0b101, "the far stone wakes as bit 2");
  assert.ok(evts(v, "wp").some((e) => e[1] === p.eid && e[2] === 2));
  assert.ok((v.toast || []).some((t) => t.includes("바람초원 · 안쪽")), "named in the toast: " + v.toast);
  // back to the first stone of the same ground: a step, the map is not sent again
  p.hitAt = -1e9;
  assert.ok(W.act({ t: "warp", to: "meadow", i: 0 }).ok);
  v = W.step();
  assert.equal(p.map, "meadow");
  assert.ok(!v.map, "a warp within the ground does not send the map again");
  assert.deepEqual([Math.floor(p.x / T), Math.floor(p.y / T)], [st[0].ax, st[0].ay], "beside the first stone");
  // and to the town and back to the far stone
  assert.ok(W.act({ t: "warp", to: "town" }).ok);
  W.step();
  assert.equal(p.map, "town");
  assert.ok(W.act({ t: "warp", to: "meadow", i: 2 }).ok);
  v = W.step();
  assert.equal(v.map.id, "meadow");
  assert.deepEqual([Math.floor(p.x / T), Math.floor(p.y / T)], [st[2].ax, st[2].ay], "beside the far stone");

  // ── 질주의 바람: brushing past the shrine past the middle stone speeds you on, once a minute
  const [sx, sy] = maps.meadow.shrines[0];
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => maps.meadow.reach[(sy + dy) * maps.meadow.w + sx + dx]);
  const spd0 = L.__t.stats(p).spd;
  W.to("meadow", sx + side[0], sy + side[1]);
  v = W.step();
  assert.ok(p.wind > W.now, "the wind takes hold");
  assert.ok(evts(v, "wd").some((e) => e[1] === p.eid), "with an event to show it");
  assert.ok(Math.abs(L.__t.stats(p).spd / spd0 - 1.3) < 1e-9, "30% quicker");
  assert.ok(W.self().buffs[10] > 19000, "shown as the eleventh buff");
  const until = p.wind;
  W.step(1000);
  assert.equal(p.wind, until, "standing there does not renew it");
  W.step(20000);
  assert.ok(Math.abs(L.__t.stats(p).spd / spd0 - 1) < 1e-9, "twenty seconds, then back to a walk");
  W.step(40000);
  assert.ok(p.wind > W.now, "a minute on it blows again");
}

// ── an old sheet: stones a map has stay woken, bits for stones it does not have go, and a place that is
// now inside a wall becomes the entrance of that same ground
{
  const W = world("옛길");
  const ch = L.newChar("옛길", "rogue", []);
  ch.wp = { town: 0b11, meadow: 0b10000101, forest: 1, nowhere: 1 };
  // a tile that is a wall now
  const m = maps.meadow;
  let wall = null;
  for (let y = 5; y < m.h - 5 && !wall; y++) for (let x = 5; x < m.w - 5 && !wall; x++) if (m.o[y][x] !== " ") wall = [x, y];
  ch.map = "meadow"; ch.x = wall[0] * T + 8; ch.y = wall[1] * T + 10;
  L.addPlayer(W.S, W.PID, ch);
  const p = W.p;
  assert.deepEqual(ch.wp, { town: 1, meadow: 0b101, forest: 1 }, "stones kept, stones that do not exist dropped");
  // (a v8 list still means the first stone of each map)
  const v8 = L.newChar("옛목록", "mage", []);
  v8.wp = ["town", "meadow", "nowhere"];
  const W8 = world("옛목록");
  L.addPlayer(W8.S, W8.PID, v8);
  assert.deepEqual(v8.wp, { town: 1, meadow: 1 });
  assert.equal(p.map, "meadow", "still on the same ground");
  assert.deepEqual([Math.floor(p.x / T), Math.floor(p.y / T)], m.entry, "at its entrance");
  assert.ok((W.step().toast || []).includes("지형이 넓어져 입구로 이동했습니다."), "and told why");
  // off the map altogether (the map shrank, or a broken save): clamped, then the same
  const c2 = L.newChar("먼길", "mage", []);
  c2.map = "crypt"; c2.x = 1e7; c2.y = -50;
  const W2 = world("먼길");
  L.addPlayer(W2.S, W2.PID, c2);
  assert.equal(W2.p.map, "crypt");
  assert.deepEqual([Math.floor(W2.p.x / T), Math.floor(W2.p.y / T)], maps.crypt.entry);
  // a place that is still open ground is left alone
  const c3 = L.newChar("제자리", "lancer", []);
  const s1 = maps.forest.stones[1];
  c3.map = "forest"; c3.x = s1.ax * T + 8; c3.y = s1.ay * T + 10;
  const W3 = world("제자리");
  L.addPlayer(W3.S, W3.PID, c3);
  assert.deepEqual([W3.p.x, W3.p.y], [s1.ax * T + 8, s1.ay * T + 10], "standing on open ground: stays");
}

// ── a big ground wakes round the hunter only, never in the plaza; walking in, the cells follow
{
  const W = world("사냥꾼");
  L.addPlayer(W.S, W.PID, L.newChar("사냥꾼", "warrior", []));
  const p = W.p, m = maps.forest;
  W.to("forest", m.entry[0], m.entry[1]);
  p.hp = 1e9;
  W.step(600);
  const rt = L.runtime(W.S, "forest");
  const at = (o) => m.zone[Math.floor(o.y / T) * m.w + Math.floor(o.x / T)];
  const live = () => rt.mobs.filter((o) => !o.dead && o.slot);
  assert.ok(live().length > 20, "monsters about the way in: " + live().length);
  assert.ok(live().every((o) => at(o) === 1 || at(o) === 2), "none in the plaza, none in a pocket");
  const total = rt.base.reduce((a, b) => a + b, 0);
  assert.ok(live().length < total / 2, `only the cells round the hunter: ${live().length} of ${total}`);
  // at the far stone, the deep cells wake and the ones by the door go to sleep
  const far = m.stones[2];
  W.to("forest", far.ax, far.ay);
  for (let i = 0; i < 6; i++) W.step(600);
  const deep = live();
  assert.ok(deep.length > 20, "monsters about the far stone: " + deep.length);
  assert.ok(deep.filter((o) => at(o) === 2).length > deep.length * 0.2, "many of them on the elite ground");
  // every cell more than five away from the hunter has gone to sleep (a monster still on the chase may linger)
  const cell = (x, y) => [Math.floor(x / T / 16), Math.floor(y / T / 16)], [pcx, pcy] = cell(p.x, p.y);
  const away = deep.filter((o) => { const [cx, cy] = cell(o.hx, o.hy); return Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) > 5 && !o.tgt; });
  assert.equal(away.length, 0, "far cells sleep");
  assert.ok(Math.max(Math.abs(cell(m.entry[0] * T, 0)[0] - pcx), Math.abs(cell(0, m.entry[1] * T)[1] - pcy)) <= 5 || rt.cells[cell(m.entry[0] * T, m.entry[1] * T)[1] * m.cells.cw + cell(m.entry[0] * T, m.entry[1] * T)[0]] === 0, "the way in sleeps when far");
  // the elite ground breeds elites
  const el = rt.mobs.filter((o) => !o.dead && o.slot && at(o) === 2);
  assert.ok(el.filter((o) => o.el === 1).length >= 1, "elites out there");
}

// ── the world event still gathers at a ground's first stone, in its safe plaza
for (const id of D.event.maps) {
  const s = maps[id].stones ? maps[id].stones[0] : null;
  if (s) assert.equal(maps[id].zone[s.ay * maps[id].w + s.ax], 0, id + ": the rift gathers at the first stone");
}
console.log("scale ok — stones " + Object.keys(maps).filter((id) => maps[id].stones).map((id) => `${id} ${maps[id].stones.length}`).join(", "));
