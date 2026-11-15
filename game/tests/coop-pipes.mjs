// Town hall pipe shifts: server actions, deterministic boards, teamwork, rewards and the compact board wire.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __pipeTest = { COOP, COOP_T, mapOf, dayOf };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const { COOP, COOP_T, mapOf, dayOf } = L.__pipeTest;
const W = 32, T = 16, SIZE = W * W, PIPE = 2, HAMMER = 8;
const RESET = Date.UTC(2026, 10, 15, 21), START = RESET - 4 * 60_000; // 06:00 KST on the next day
const ZONE = i => Number(i % W >= W / 2);
const adjacent = (i, j) => Math.abs(i % W - j % W) + Math.abs(Math.floor(i / W) - Math.floor(j / W)) === 1;
const J = COOP.pipe;
assert.ok(J, "pipe shift registered");
assert.equal(J.lobby, "town_hall");
assert.equal(J.npc, "popo");
assert.equal(J.mins, 5);
assert.equal(dayOf(RESET), dayOf(RESET - 1) + 1);

function place(S, p, id, x, y) {
  L.runtime(S, p.map).n--;
  L.runtime(S, id).n++;
  Object.assign(p, { map: id, x, y, sendMap: true });
}

function addWorker(w, pid, saved) {
  L.addPlayer(w.S, pid, saved || L.newChar("배관공" + pid, []));
  const p = w.S.players[pid];
  standByBroker(w, p);
  return p;
}

function standByBroker(w, p) {
  const n = mapOf(J.lobby).npcs.find(npc => npc.id === J.npc);
  place(w.S, p, J.lobby, n.x * T + 8, n.y * T + 28);
}

function action(w, pid, a) {
  w.S.now = w.now;
  const result = L.validateAction(w.S, pid, a);
  if (result.ok) L.applyAction(w.S, pid, a);
  return result;
}

function world(n, seed = 240901, sheets = {}) {
  const S = L.setup();
  S.seed = seed;
  S.now = START;
  const w = { S, now: START, pids: Array.from({ length: n }, (_, i) => `p${i}`) };
  for (const pid of w.pids) addWorker(w, pid, sheets[pid]);
  for (const pid of w.pids.slice(1)) {
    assert.ok(action(w, "p0", { t: "pinv", e: S.players[pid].eid }).ok, "invite");
    assert.ok(action(w, pid, { t: "pacc" }).ok, "party joins");
  }
  return w;
}

function advance(w, now) {
  assert.ok(now >= w.now);
  w.now = now;
  L.tick(w.S, now);
  L.endTick(w.S);
}

function open(w) {
  const started = action(w, "p0", { t: "coop_start", k: "pipe" });
  assert.ok(started.ok, started.error);
  const dim = Object.values(w.S.dims).find(d => d.coop?.k === "pipe");
  assert.ok(dim?.coop.pipe);
  return dim;
}

const view = (w, pid) => L.viewFor(w.S, pid);
const cp = (w, pid) => view(w, pid).cp;
const inputs = (pipe, pid, i, extra) => ({ t: "coop_act", i, handRev: pipe.seats[pid].handRev, ...extra });
const task = (w, dim, pid, i, extra) => action(w, pid, inputs(dim.coop.pipe, pid, i, extra));

/** Pipe mask for the monotonic path: W+E, N+S, W+S or N+E. */
function required(path) {
  const out = new Map();
  for (let j = 1; j + 1 < path.length; j++) {
    const prev = path[j - 1], i = path[j], next = path[j + 1];
    assert.ok(adjacent(prev, i) && adjacent(i, next));
    assert.ok([1, W].includes(i - prev) && [1, W].includes(next - i));
    out.set(i, i - prev === 1 ? (next - i === 1 ? 3 : 4) : (next - i === 1 ? 5 : 2));
  }
  return out;
}

function checkBoard(pipe, n) {
  assert.equal(pipe.board.length, SIZE);
  assert.equal(pipe.board.filter(code => code === 1).length, Math.round(SIZE * 0.55));
  assert.equal(pipe.src % W, 0);
  assert.equal(pipe.dst % W, W - 1);
  assert.ok(Math.floor(pipe.src / W) < Math.floor(pipe.dst / W), "outlet is below inlet");
  assert.equal(pipe.solution[0], pipe.src);
  assert.equal(pipe.solution.at(-1), pipe.dst);
  assert.equal(pipe.board[pipe.src], 6);
  assert.equal(pipe.board[pipe.dst], 7);
  assert.equal(new Set(pipe.solution).size, pipe.solution.length, "solution has no loop");
  assert.deepEqual([0, 1].map(z => Object.values(pipe.seats).filter(s => s.zone === z).length), [Math.ceil(n / 2), Math.floor(n / 2)]);
  for (const s of Object.values(pipe.seats)) assert.ok(s.tool >= PIPE && s.tool <= 5, "first hand always a pipe");
  const path = required(pipe.solution);
  for (const i of path.keys()) assert.equal(pipe.board[i], 0, "no rock to break along the solution path");
  for (let z = 0; z < 2; z++) {
    const need = [...path].filter(([i]) => ZONE(i) === z).map(([, code]) => code);
    const deck = [...pipe.packs[z]];
    for (const code of need) {
      const i = deck.indexOf(code);
      assert.notEqual(i, -1, "deck contains the pipes needed by its own zone");
      deck.splice(i, 1);
    }
    assert.ok(deck.every(k => k >= PIPE && k <= 5), "the shared deck contains pipes, never hammers");
    assert.ok(deck.length <= 8, "at most eight surplus pipes per role");
    const extras = pipe.board.filter((code, i) => code === 0 && ZONE(i) === z && !path.has(i)).length;
    assert.ok(extras >= deck.length, "enough spare ground to place every surplus pipe");
  }
}

function spare(pipe, zone, code) {
  const path = pipe.solution;
  return pipe.board.findIndex((v, i) => v === code && ZONE(i) === zone && !path.includes(i) && !path.some(j => adjacent(i, j)));
}

/** Play the actual decks. A rolled hammer is spent only on a rock irrelevant to the solution. */
function connect(w, dim, active = w.pids, beforeLast = null) {
  const c = dim.coop, pipe = c.pipe, need = [...required(pipe.solution)];
  let actions = 0;
  while (c.state !== "end") {
    let progress = false;
    for (const pid of active) {
      const { tool, zone } = pipe.seats[pid];
      const left = need.filter(([i]) => ZONE(i) === zone && pipe.board[i] === 0);
      if (!left.length) continue;
      const match = left.find(([, code]) => code === tool);
      const i = match ? match[0] : spare(pipe, zone, tool === HAMMER ? 1 : 0);
      assert.ok(i >= 0, `${pid} can use the held tool ${tool} without blocking the natural route`);
      if (beforeLast && match && need.every(([cell]) => cell === i || pipe.board[cell] !== 0)) beforeLast();
      const cursor = pipe.cursor[zone];
      if (tool === HAMMER) assert.equal(task(w, dim, pid, spare(pipe, zone, 0)).ok, false, "hammer cannot use an empty slot");
      const result = task(w, dim, pid, i);
      assert.ok(result.ok, result.error);
      assert.equal(pipe.board[i], tool === HAMMER ? 0 : tool);
      if (tool === HAMMER) {
        assert.ok(!pipe.solution.includes(i), "no hammer used on the guaranteed route");
        assert.ok(pipe.cursor[zone] <= cursor + 1, "hammer use draws at most one pipe");
        assert.notEqual(pipe.seats[pid].tool, HAMMER, "no back-to-back hammer");
      }
      progress = true;
      actions++;
      if (c.state === "end") break;
      advance(w, w.now + COOP_T.actMs + 1);
    }
    if (!progress) break;
    assert.ok(actions < SIZE, "puzzle stays solvable within the supply budget");
  }
  return actions;
}

function assertWon(w, dim) {
  const { coop: c } = dim;
  assert.equal(c.state, "end", "connection ends the shift immediately");
  assert.ok(c.pipe.wonAt >= c.runAt && c.pipe.wonAt < c.endAt);
  assert.deepEqual(c.pipe.finished, c.pipe.solution, "the planned natural path was the connected path");
  const owners = c.pipe.finished.slice(1, -1).map(i => c.pipe.owners[i]);
  assert.ok(new Set(owners).size >= 2);
  for (let i = 1; i + 1 < c.pipe.finished.length; i++) {
    const cell = c.pipe.finished[i];
    assert.equal(c.pipe.seats[c.pipe.owners[cell]].zone, ZONE(cell));
  }
  assert.ok(w.now < c.endAt, "early success rather than waiting for timeout");
}

// Three party sizes, multiple seeds, both halves of the natural route and all starting deck budgets.
const crossings = new Set(), boards = new Set();
for (const n of [2, 3, 4]) for (const seed of [11, 93, 613, 240901]) {
  const w = world(n, seed), dim = open(w), c = dim.coop, pipe = c.pipe;
  checkBoard(pipe, n);
  boards.add(Array.from(pipe.board).join(""));
  crossings.add(pipe.solution.find(i => i % W === W / 2));
  advance(w, c.runAt);
  const supply = w.pids.filter(pid => pipe.seats[pid].zone === 0);
  assert.ok(connect(w, dim, supply));
  assert.equal(c.state, "run", "the whole supply half alone never clears");
  assert.equal(pipe.wonAt, null);
  assert.ok(connect(w, dim));
  assertWon(w, dim);
}
assert.equal(boards.size, 12);
assert.ok(crossings.size >= 3, "the crossing row changes across seeds");

// Each party size also has a fixed full run where every action places a pipe.
for (const [n, seed] of [[2, 3], [3, 3], [4, 2]]) {
  const w = world(n, seed), dim = open(w), { coop: c } = dim, { pipe } = c;
  const rocks = [...pipe.rocks];
  advance(w, c.runAt);
  const placements = connect(w, dim);
  assertWon(w, dim);
  assert.equal(pipe.broken.filter(Boolean).length, 0, `${n} players use no hammer`);
  assert.equal(pipe.owners.filter(Boolean).length, placements, "every action placed a pipe");
  assert.deepEqual(pipe.rocks, rocks, "all rocks remain on the board");
}

// Non-leaders, invalid indices, no rotation, stale presses, occupied tiles and two players racing for one cell.
{
  const alone = world(1);
  assert.equal(action(alone, "p0", { t: "coop_start", k: "pipe" }).ok, false);
  const w = world(3), outsider = addWorker(w, "visitor");
  assert.equal(action(w, "p1", { t: "coop_start", k: "pipe" }).ok, false);
  const dim = open(w), c = dim.coop, pipe = c.pipe;
  const [p, buddy] = w.pids.filter(pid => pipe.seats[pid].zone === 0);
  const receiver = w.pids.find(pid => pipe.seats[pid].zone === 1);
  const i = spare(pipe, 0, 0), other = spare(pipe, 1, 0);
  assert.equal(task(w, dim, p, i).ok, false, "no input during the briefing");
  advance(w, c.runAt);
  place(w.S, outsider, dim.id, w.S.players[p].x, w.S.players[p].y);
  const initial = cp(w, p);
  assert.deepEqual(initial.slice(0, 2), [pipe.rev, 0]);
  assert.match(initial[2], /^[0-7]{1024}$/);
  assert.deepEqual(initial.slice(3, 5), [pipe.src, pipe.dst]);
  assert.equal(initial.length, 6, "no hidden solution or deck in the payload");
  assert.equal(initial[5].length, 3, "the outsider has no seat");
  assert.ok(initial[5].every(row => row.length === 4));
  assert.deepEqual(cp(w, receiver), initial, "both roles receive the same full board");
  assert.equal(cp(w, p), undefined, "unchanged board is not resent");
  const before = pipe.rev, held = [...pipe.cursor];
  for (const invalid of [-1, SIZE, "40", 4.5, null, undefined, other, pipe.src]) assert.equal(task(w, dim, p, invalid).ok, false);
  assert.equal(task(w, dim, p, spare(pipe, 0, 1)).ok, false, "pipe cannot replace a rock");
  assert.equal(task(w, dim, p, i, { handRev: undefined }).ok, false);
  assert.equal(task(w, dim, p, i, { handRev: pipe.seats[p].handRev + 1 }).ok, false);
  assert.equal(task(w, dim, p, i, { d: 1 }).ok, false);
  assert.equal(action(w, p, { t: "pipe_discard" }).ok, false);
  assert.equal(action(w, "visitor", inputs(pipe, p, i)).ok, false);
  assert.equal(pipe.rev, before);
  assert.deepEqual(pipe.cursor, held, "rejected events draw nothing");
  const command = inputs(pipe, p, i), code = pipe.seats[p].tool;
  assert.ok(action(w, p, command).ok);
  assert.equal(task(w, dim, buddy, i).ok, false, "second player cannot overwrite the simultaneous placement");
  assert.equal(action(w, p, command).ok, false, "duplicate click cannot draw twice");
  const nextCode = pipe.seats[p].tool;
  assert.equal(task(w, dim, p, spare(pipe, 0, nextCode === HAMMER ? 1 : 0)).ok, false, "cooldown rejects a brand new valid placement");
  assert.equal(pipe.rev, before + 1);
  const update = cp(w, p);
  assert.deepEqual(update.slice(0, 3), [before + 1, 1, [[i, code]]]);
  assert.deepEqual(cp(w, receiver), update, "both roles receive the same cell and hand update");
  const late = cp(w, buddy);
  assert.deepEqual(late.slice(0, 3), [before + 1, 0, Array.from(pipe.board).join("")]);
  assert.equal(cp(w, buddy), undefined);

  const departed = L.removePlayer(w.S, p);
  assert.ok(departed, "disconnect removed player");
  advance(w, w.now + COOP_T.actMs + 1);
  assert.equal(pipe.seats[buddy].zone, 0, "same role survives disconnect");
  assert.equal(task(w, dim, buddy, other).ok, false, "no role inheritance or crossing after disconnect");
  const tool = pipe.seats[buddy].tool;
  assert.ok(task(w, dim, buddy, spare(pipe, 0, tool === HAMMER ? 1 : 0)).ok, "remaining worker can continue");
}

// A real accepted pipe with closed ports breaks the route. Off-route pieces must never count as success.
{
  const w = world(2, 4097), dim = open(w), c = dim.coop, pipe = c.pipe;
  advance(w, c.runAt);
  const p = w.pids.find(pid => pipe.seats[pid].zone === 0), tool = pipe.seats[p].tool;
  const wrongEntry = [...required(pipe.solution)].find(([i, code]) => ZONE(i) === 0 && code !== tool);
  assert.ok(wrongEntry, "seed offers a left-side cell incompatible with the starting tool");
  const [wrong] = wrongEntry;
  assert.ok(task(w, dim, p, wrong).ok);
  advance(w, w.now + COOP_T.actMs + 1);
  assert.ok(connect(w, dim));
  assert.ok(pipe.solution.every(i => pipe.board[i] > 1), "all route cells filled, with incompatible ports at one cell");
  assert.equal(c.state, "run");
  assert.equal(pipe.wonAt, null);
  assert.ok(w.pids.every(pid => w.S.players[pid].ch.cos.tokens === 0));
  w.now = c.endAt;
  const seat = pipe.seats[p];
  assert.equal(task(w, dim, p, spare(pipe, seat.zone, seat.tool === HAMMER ? 1 : 0)).ok, false, "no valid placements at the deadline");
  advance(w, c.endAt);
  assert.equal(c.state, "end");
  for (const pid of w.pids) {
    assert.equal(view(w, pid).cr[0], 0, "timeout gives a failing grade");
    assert.equal(w.S.players[pid].ch.cos.tokens, 0);
    assert.ok(!w.S.players[pid].ch.coopDone.includes("pipe"));
  }
}

// The final hand is played on both sides of each grade boundary.
for (const [left, grade] of [[135_000, 4], [134_999, 3], [90_000, 3], [89_999, 2], [45_000, 2], [44_999, 1], [1, 1]]) {
  const w = world(2, 93), dim = open(w), c = dim.coop;
  advance(w, c.runAt);
  connect(w, dim, w.pids, () => advance(w, c.endAt - left));
  assertWon(w, dim);
  assert.equal(view(w, "p0").cr[0], grade);
  assert.equal(c.endAt - c.pipe.wonAt, left, "grade uses precise remaining time");
}

// Off-route activity alone cannot earn regular pay on a successful shift.
{
  const w = world(3, 93), dim = open(w), c = dim.coop, pipe = c.pipe;
  advance(w, c.runAt);
  const helper = w.pids[2], zone = pipe.seats[helper].zone;
  assert.ok(task(w, dim, helper, spare(pipe, zone, 0)).ok);
  advance(w, w.now + COOP_T.actMs + 1);
  connect(w, dim, w.pids.slice(0, 2));
  assertWon(w, dim);
  const helperChar = w.S.players[helper].ch;
  assert.deepEqual(view(w, helper).cr[3][2].slice(1), [0, 0, 0]);
  assert.equal(helperChar.cos.tokens, 0);
  assert.ok(!helperChar.coopDone.includes("pipe"));
}

// Both collaborators are credited. The first win pays exactly two tokens, with no second pay on the same day.
{
  let w = world(2, 20261115);
  for (const [attempt, paid] of [2, 2, 4].entries()) {
    if (attempt === 1) {
      const now = w.now;
      const sheets = Object.fromEntries(w.pids.map(pid => [pid, JSON.parse(JSON.stringify(L.exportChar(w.S, pid)))]));
      w = world(2, 20261116, sheets);
      advance(w, now);
    }
    if (attempt === 2) advance(w, RESET);
    const dim = open(w), c = dim.coop;
    advance(w, c.runAt);
    connect(w, dim);
    assertWon(w, dim);
    for (const pid of w.pids) {
      const p = w.S.players[pid];
      const report = view(w, pid).cr;
      assert.equal(report[0], 4, "quick complete earns S");
      assert.ok(report[3].every(([, points, , eligible]) => points > 0 && eligible === 1));
      assert.equal(p.ch.cos.tokens, paid);
      assert.deepEqual(p.ch.coopDone, ["pipe"]);
      assert.equal(p.ch.coopDay, dayOf(w.now));
      assert.equal(view(w, pid).cr, undefined, "result only once per player");
      assert.equal(task(w, dim, pid, spare(c.pipe, c.pipe.seats[pid].zone, 0)).ok, false);
      assert.equal(p.ch.cos.tokens, paid, "post-result clicks don't pay again");
    }
    advance(w, c.doneAt + 1);
    for (const pid of w.pids) {
      const p = w.S.players[pid];
      assert.equal(p.map, J.lobby);
      assert.equal(cp(w, pid), 0, "leaving the shift clears the client board");
      assert.equal(cp(w, pid), undefined, "the board clear is sent once");
      standByBroker(w, p);
    }
  }
}

console.log("coop pipes: boards and decks, legal inputs, shared deltas, early success, timeout, contributor credit and daily rewards verified");
