// Headless test of active-area spawning (docs/design/scale-and-rift.md B.4d): a map's monsters
// live in 16 × 16-tile cells that wake around the living and sleep far from them. Monsters come
// alive out of sight; the same moves give the same monsters; a farmed cell is not reset by walking
// away; chests and guardians stay put; a party finds a thicker crowd; never more than the cap.
// A plain 160 × 112 field (the size of a 4× hunting ground) is run as an instance: node tests/cells.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { registerDim, changeMap, killMob, blank, border, finalize, buildCells, FIRES, MOBS, CELL, WAKE_R, SLEEP_R, SPAWN_MIN_D, CELL_RESPAWN_MS, WAKE_MAX_MOBS, DENSITY_MAX, WAVE_MS, CELL_PASS_MS };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16;

/** An open field, `per` hares in a box inside every cell, a chest and a guardian in the far corner. */
function field(id, per) {
  const m = X.blank(id, "시험 들판", 160, 112, ".");
  X.border(m, "T", 2);
  m.entry = [4, 4];
  for (let cy = 0; cy < 7; cy++) for (let cx = 0; cx < 10; cx++) {
    const x0 = Math.max(2, cx * 16 + 2), y0 = Math.max(2, cy * 16 + 2);
    m.spawns.push({ k: "twinhare", n: per, r: [x0, y0, Math.min(157, cx * 16 + 13), Math.min(109, cy * 16 + 13)] });
  }
  m.spawns.push({ k: "chest_meadow", n: 1, r: [150, 100, 150, 100] }, { k: "lambmaw", n: 1, r: [148, 102, 148, 102], el: 2 });
  X.FIRES[id] = [];
  X.finalize(m);
  X.buildCells(m);
  return m;
}
/** A world with `n` players on a fresh field instance, standing at tile (tx, ty). */
function world(per, n = 1, tx = 40, ty = 40) {
  const S = L.setup();
  S.now = 1000;
  const m = field("dim:1", per);
  const dim = X.registerDim(S, { id: "dim:1", map: m, expire: 1e12 });
  const ps = [];
  for (let i = 0; i < n; i++) {
    L.addPlayer(S, "pid-c" + i, L.newChar("세포" + i, "warrior", []));
    const p = S.players["pid-c" + i];
    X.changeMap(S, p, "dim:1", tx * T + 8 + i * 4, ty * T + 10);
    p.hp = 1e9;
    ps.push(p);
  }
  let now = 1000;
  const W = { S, m, rt: dim.rt, ps, get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); L.endTick(S); },
    run(ms) { for (let t = 0; t < ms; t += 100) W.step(); },
    put(p, tx2, ty2) { p.x = tx2 * T + 8; p.y = ty2 * T + 10; p.mvAt = now; },
    cellOf: (o) => Math.floor(o.y / T / X.CELL) * m.cells.cw + Math.floor(o.x / T / X.CELL),
    cellMobs: (c) => dim.rt.mobs.filter((o) => o.slot && o.slot.c === c && !o.dead) };
  return W;
}
const cheb = (m, a, b) => Math.max(Math.abs((a % m.cells.cw) - (b % m.cells.cw)), Math.abs(Math.floor(a / m.cells.cw) - Math.floor(b / m.cells.cw)));

// ── the cells: a 160 × 112 map is 10 × 7 of them, the old spawn boxes shared out, chests and guardians apart
{
  const m = field("dim:x", 6);
  assert.deepEqual([m.cells.cw, m.cells.ch], [10, 7]);
  assert.equal(m.cells.spawns.flat().reduce((n, q) => n + q.n, 0), 70 * 6, "every monster of the old boxes has a cell");
  assert.deepEqual(m.cells.fixed.map((sp) => sp.k), ["chest_meadow", "lambmaw"], "chests and guardians are not in cells");
}

// ── fixed spawns are there from the start, before anyone wakes a cell, and never sleep
{
  const S = L.setup();
  const dim = X.registerDim(S, { id: "dim:1", map: field("dim:1", 6), expire: 1e12 });
  assert.deepEqual(dim.rt.mobs.map((o) => o.k).sort(), ["chest_meadow", "lambmaw"], "only the chest and the guardian stand in an unvisited map");
}

// ── out of sight, and only near the living
{
  const W = world(6);
  W.step();
  const p = W.ps[0], pc = W.cellOf(p);
  const live = W.rt.mobs.filter((o) => o.slot);
  assert.ok(live.length > 100, `the cells around fill (${live.length})`);
  for (const o of live) {
    assert.ok(Math.hypot(o.x - p.x, o.y - p.y) / T >= X.SPAWN_MIN_D - 1, "a monster comes alive out of sight");
    assert.ok(cheb(W.m, o.slot.c, pc) <= X.WAKE_R, "only in a cell near a player");
  }
  for (let c = 0; c < W.rt.cells.length; c++) assert.equal(!!W.rt.cells[c], cheb(W.m, c, pc) <= X.WAKE_R, `cell ${c} awake iff within ${X.WAKE_R}`);
  assert.equal(W.rt.mobs.filter((o) => o.k === "chest_meadow" || o.k === "lambmaw").length, 2, "and the far chest and guardian are still there");
}

// ── determinism: the same moves give the same monsters, id for id and tile for tile
{
  const trace = () => {
    const W = world(5);
    const out = [];
    for (let i = 0; i < 60; i++) {
      W.put(W.ps[0], 40 + i * 2, 40 + (i % 7));
      W.step(250);
      if (i % 10 === 9) out.push(W.rt.mobs.filter((o) => !o.dead).map((o) => [o.id, o.k, Math.round(o.x), Math.round(o.y), o.el]));
    }
    return JSON.stringify(out);
  };
  assert.equal(trace(), trace(), "a replay of the same path yields the same monsters");
}

// ── a farmed cell is not reset by walking away
{
  const W = world(6, 1, 8, 8);
  W.step();
  const p = W.ps[0];
  // stand off the cell (out of its own monsters' sight rule) and clear it
  const c = 2 * W.m.cells.cw + 3; // cell (3, 2), 3 cells from the hunter
  assert.ok(W.rt.cells[c], "the cell is awake");
  const prey = W.cellMobs(c);
  assert.ok(prey.length >= 4, `it holds its monsters (${prey.length})`);
  for (const o of prey) { o.by[p.pid] = 1; X.killMob(W.S, W.rt, o); }
  const killedAt = W.now;
  W.step();
  assert.equal(W.cellMobs(c).length, 0, "cleared");
  // walk far away: it sleeps; come straight back: nothing yet
  W.put(p, 150, 100);
  W.run(2000);
  assert.ok(!W.rt.cells[c], "far from everyone it sleeps");
  W.put(p, 8, 8);
  W.run(3000);
  assert.ok(W.rt.cells[c], "back near it, it wakes");
  assert.ok(W.now < killedAt + X.CELL_RESPAWN_MS);
  assert.equal(W.cellMobs(c).length, 0, "but what was killed there is not back before its time");
  W.run(killedAt + X.CELL_RESPAWN_MS + 1000 - W.now);
  assert.ok(W.cellMobs(c).length >= prey.length, "after it, the cell is full again");
  // calm monsters of a sleeping cell leave the world; the cell keeps their places
  const c2 = 3 * W.m.cells.cw + 2, held = W.cellMobs(c2).length;
  assert.ok(held > 0);
  W.put(p, 150, 100);
  W.run(2000);
  assert.equal(W.cellMobs(c2).length, 0, "a sleeping cell holds nobody");
  assert.equal(W.rt.slots[c2].length, W.rt.base[c2], "its places are kept");
  W.put(p, 8, 8);
  W.run(1000);
  assert.equal(W.cellMobs(c2).length, held, "and they come back at once (nobody was killed there)");
}

// ── a party finds a thicker crowd: x1.5 for four (x1 alone), filled out of their sight
{
  const solo = world(2, 1), party = world(2, 4);
  solo.step(); party.step();
  const c = solo.cellOf(solo.ps[0]) + 2;
  assert.equal(solo.rt.slots[c].length, solo.rt.base[c], "alone: the cell's own crowd");
  assert.equal(party.rt.slots[c].length, Math.round(party.rt.base[c] * X.DENSITY_MAX), "four: half as many again");
  const count = (W) => W.rt.mobs.filter((o) => o.slot).length;
  assert.ok(count(party) > count(solo) * 1.3, `more monsters about a party (${count(solo)} → ${count(party)})`);
  // the extra places go again when the party breaks up (empty ones at once, the rest when they fall)
  for (const p of party.ps.slice(1)) L.removePlayer(party.S, p.pid);
  party.run(1000);
  assert.ok(party.rt.slots[c].length <= Math.round(party.rt.base[c] * X.DENSITY_MAX) && party.rt.slots[c].every((s, i) => i < party.rt.base[c] || s.mob), "no empty extra place is kept");
}

// ── never more than the cap standing on one map
{
  const W = world(12, 4);
  W.step();
  const standing = W.rt.mobs.filter((o) => !o.dead && !o.temp).length;
  assert.ok(standing <= X.WAKE_MAX_MOBS, `${standing} standing ≤ ${X.WAKE_MAX_MOBS}`);
  assert.ok(standing >= X.WAKE_MAX_MOBS - 5, "and the cap is reached when the cells ask for more");
  // the nearest cells are served first
  const pc = W.cellOf(W.ps[0]);
  for (const o of W.rt.mobs.filter((q) => q.slot)) assert.ok(cheb(W.m, o.slot.c, pc) <= 2, "the cap fills the nearest cells first");
}

// ── a wave: a hunter on the move finds more ahead of them
{
  const W = world(4, 1, 20, 50);
  W.step();
  const p = W.ps[0];
  W.run(X.WAVE_MS - 600);
  W.put(p, 40, 50); // 20 tiles east
  W.run(1000);
  const ahead = W.cellOf(p) + 2;
  assert.ok(W.rt.slots[ahead].length > W.rt.base[ahead], "the cell two ahead gets more places");
  assert.ok(W.rt.slots[ahead].length <= Math.floor(W.rt.base[ahead] * X.DENSITY_MAX), "never past the cap");
}

// ── a wave's places wait for their monsters: if they cannot come at once (here a fallen hunter
// lies in that cell, and nothing comes alive in anyone's sight) the places stay until they can
{
  const W = world(4, 2, 20, 50);
  const [p, body] = W.ps;
  body.hp = 0; body.dead = true; W.put(body, 72, 56);   // the middle of cell (4, 3), two cells ahead of where p goes
  W.step();
  W.run(X.WAVE_MS - 600);
  W.put(p, 40, 50);
  W.run(1000);
  const ahead = W.cellOf(p) + 2;
  assert.equal(ahead, W.cellOf(body), "the body lies in the cell ahead");
  const base = W.rt.base[ahead];
  assert.ok(W.rt.slots[ahead].length > base, "the wave adds places");
  assert.ok(W.cellMobs(ahead).length < W.rt.slots[ahead].length, "which cannot all be filled while the body lies there");
  W.run(3000);
  assert.ok(W.rt.slots[ahead].length > base, "the empty wave places are not trimmed on the next passes");
  L.removePlayer(W.S, body.pid);
  W.run(1000);
  assert.ok(W.cellMobs(ahead).length > base, `once nobody watches, the wave comes (${W.cellMobs(ahead).length} > ${base})`);
}

// ── dying never clears a crowd: the dead hold their ground (their cells stay awake), and only the living wake or fill cells
{
  const W = world(6);
  W.step();
  const p = W.ps[0], pc = W.cellOf(p);
  W.run(1000);
  const around = () => W.rt.mobs.filter((o) => o.slot && !o.dead && cheb(W.m, o.slot.c, pc) <= X.WAKE_R).length;
  const before = around();
  assert.ok(before > 50, `a crowd around the hunter (${before})`);
  p.hp = 0; p.dead = true;
  for (const o of W.rt.mobs) if (o.tgt === p.pid) o.tgt = null;
  W.run(5000);
  for (let c = 0; c < W.rt.cells.length; c++) if (cheb(W.m, c, pc) <= X.WAKE_R) assert.ok(W.rt.cells[c], `cell ${c} by the body stays awake`);
  assert.equal(around(), before, "and its monsters stay where they were");
  // walk the body far away (as a ghost would): now the cells sleep
  W.put(p, 150, 100);
  W.run(2000);
  assert.ok(!W.rt.cells[pc], "with nobody near, dead or alive, the cell sleeps");
  assert.equal(W.cellMobs(pc).length, 0, "and lets its calm monsters go");
}

console.log("cells ok");
