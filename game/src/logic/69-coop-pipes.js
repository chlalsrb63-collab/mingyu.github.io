// ───────────────────────────── town hall pipe repair ─────────────────────────────

const PIPE_N = 32, PIPE_CELLS = PIPE_N * PIPE_N;
const PIPE_ROCK = 1, PIPE_FIRST = 2, PIPE_LAST = 5, PIPE_IN = 6, PIPE_OUT = 7, PIPE_HAMMER = 8;
const PIPE_PORTS = [0, 0, 5, 10, 12, 3, 2, 8];   // masks: N=1, E=2, S=4, W=8
const PIPE_CHANGES = 64;
const pipeZone = (index) => index % PIPE_N < PIPE_N / 2 ? 0 : 1;
const pipeIndex = (x, y) => y * PIPE_N + x;

/** Shuffle the candidate positions and pieces deterministically with a shift's seed box. */
function pipeShuffle(a, box) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(box, 0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** East and south only; each descent starts after entering from the west and ends by exiting east. */
function pipeSolution(box) {
  const startRow = ri(box, 2, 15), fall = ri(box, 5, Math.min(13, 29 - startRow));
  const columns = pipeShuffle(Array.from({ length: PIPE_N - 2 }, (_, i) => i + 1), box)
    .slice(0, ri(box, 2, Math.min(5, fall))).sort((a, b) => a - b);
  const drops = new Array(columns.length);
  let left = fall, row = startRow;
  for (let i = 0; i < columns.length; i++) {
    drops[i] = i === columns.length - 1 ? left : ri(box, 1, left - (columns.length - i - 1));
    left -= drops[i];
  }
  const route = [pipeIndex(0, row)];
  let at = 0;
  for (let x = 1; x < PIPE_N; x++) {
    route.push(pipeIndex(x, row));
    if (x === columns[at]) {
      for (let k = 0; k < drops[at]; k++) route.push(pipeIndex(x, ++row));
      at++;
    }
  }
  return route;
}

/** Read a route's required four pipe types from its two neighbors. */
function pipeNeed(path, i) {
  const prev = path[i] - path[i - 1], next = path[i + 1] - path[i];
  if (prev === 1 && next === 1) return 3;
  if (prev === PIPE_N && next === PIPE_N) return 2;
  return prev === 1 ? 4 : 5;
}

function pipeLandscape(box, solution) {
  const board = new Uint8Array(PIPE_CELLS), path = new Set(solution);
  const src = solution[0], dst = solution[solution.length - 1];
  board[src] = PIPE_IN;
  board[dst] = PIPE_OUT;
  const rocks = [0, 0], half = Math.round(PIPE_CELLS * 0.55) / 2;
  const limit = [Math.ceil(half), Math.floor(half)];
  const place = (x, y) => {
    if (x < 0 || y < 0 || x >= PIPE_N || y >= PIPE_N) return;
    const i = pipeIndex(x, y), z = pipeZone(i);
    if (board[i] || path.has(i) || rocks[z] >= limit[z]) return;
    board[i] = PIPE_ROCK; rocks[z]++;
  };
  for (let k = 0; k < 30; k++) {
    const x = ri(box, 0, PIPE_N - 1), y = ri(box, 0, PIPE_N - 1), r = ri(box, 1, 2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= r + 1) place(x + dx, y + dy);
    }
  }
  const rest = [];
  for (let i = 0; i < PIPE_CELLS; i++) if (!board[i] && !path.has(i)) rest.push(i);
  for (const i of pipeShuffle(rest, box)) place(i % PIPE_N, Math.floor(i / PIPE_N));
  return { board, rocks, src, dst };
}

/** Draw from the common zone packet. A hammer interrupts the draw without changing its cursor. */
function pipeHand(c, seat, canHammer) {
  const state = c.pipe, z = seat.zone;
  if (canHammer && state.rocks[z] > 0 && rnd(c.box) < 0.05) seat.tool = PIPE_HAMMER;
  else {
    const pack = state.packs[z];
    // A side that consumes its planned packet can keep trying, while it still has empty cells.
    seat.tool = state.cursor[z] < pack.length ? pack[state.cursor[z]++] : ri(c.box, PIPE_FIRST, PIPE_LAST);
  }
  seat.handRev++;
}

function pipeInit(S, dim, c) {
  const solution = pipeSolution(c.box), map = pipeLandscape(c.box, solution);
  const packs = [[], []], spare = [PIPE_CELLS / 2 - map.rocks[0], PIPE_CELLS / 2 - map.rocks[1]];
  spare[pipeZone(map.src)]--; spare[pipeZone(map.dst)]--;
  for (let i = 1; i < solution.length - 1; i++) packs[pipeZone(solution[i])].push(pipeNeed(solution, i));
  for (const z of [0, 1]) {
    const extra = Math.min(spare[z] - packs[z].length, ri(c.box, 4, 8));
    for (let i = 0; i < extra; i++) packs[z].push(ri(c.box, PIPE_FIRST, PIPE_LAST));
    pipeShuffle(packs[z], c.box);
  }
  c.pipe = {
    ...map, id: dim.id, solution, packs, cursor: [0, 0], seats: {},
    owners: new Array(PIPE_CELLS), broken: new Array(PIPE_CELLS), changes: [],
    rev: 1, wonAt: null, finished: null,
  };
  Object.keys(c.pl).forEach((pid, i) => {
    const seat = c.pipe.seats[pid] = { zone: i % 2, eid: S.players[pid].eid, tool: 0, handRev: 0, acted: false };
    pipeHand(c, seat, false);
  });
}

/** Follow reciprocal ports, skipping the arrival port. A player's drawing order doesn't matter. */
function pipeTrace(state) {
  const { board, src, dst } = state, seen = new Set([src]), path = [src];
  let cell = src, from = 0;
  while (cell !== dst) {
    const mask = PIPE_PORTS[board[cell]] & ~from;
    let next = -1, into = 0;
    if (mask === 1 && cell >= PIPE_N) { next = cell - PIPE_N; into = 4; }
    if (mask === 2 && cell % PIPE_N < PIPE_N - 1) { next = cell + 1; into = 8; }
    if (mask === 4 && cell < PIPE_CELLS - PIPE_N) { next = cell + PIPE_N; into = 1; }
    if (mask === 8 && cell % PIPE_N > 0) { next = cell - 1; into = 2; }
    if (next < 0 || seen.has(next) || !(PIPE_PORTS[board[next]] & into)) return null;
    path.push(next); seen.add(next); cell = next; from = into;
  }
  return path;
}

function pipeValidate(S, p, c, a) {
  const state = c && c.pipe, seat = state && state.seats[p.pid], member = c && c.pl[p.pid];
  if (!seat || !member || p.map !== state.id || p.dead) return bad("배관 근무 좌석에 참여하고 있지 않습니다");
  if (c.state === "brief" || S.now < c.runAt) return bad("곧 배관 근무가 시작됩니다!");
  if ((c.state !== "run" && c.state !== "fever") || S.now >= c.endAt || state.wonAt !== null) return bad("배관 근무가 끝났습니다");
  if (a.t !== "coop_act" || Object.keys(a).some((k) => k !== "t" && k !== "i" && k !== "handRev")) return bad("손에 든 도구를 칸에 사용해 주세요");
  if (!Number.isInteger(a.i) || a.i < 0 || a.i >= PIPE_CELLS) return bad("배관 칸을 골라 주세요");
  if (pipeZone(a.i) !== seat.zone) return bad("담당 구역에서만 작업할 수 있습니다");
  if (a.handRev !== seat.handRev) return bad("손에 든 도구가 바뀌었습니다");
  const cell = state.board[a.i];
  if (seat.tool === PIPE_HAMMER && cell !== PIPE_ROCK) return bad("망치로는 바위만 깰 수 있습니다");
  if (seat.tool !== PIPE_HAMMER && cell !== 0) return bad("빈 칸에만 배관을 놓을 수 있습니다");
  return S.now - member.actAt < COOP_T.actMs ? bad("조금 천천히 작업해 주세요") : OK;
}

function pipeApply(S, dim, c, p, a) {
  if (!pipeValidate(S, p, c, a).ok) return false;
  const state = c.pipe, seat = state.seats[p.pid], i = a.i, z = seat.zone;
  const hammer = seat.tool === PIPE_HAMMER;
  state.board[i] = hammer ? 0 : seat.tool;
  if (hammer) {
    state.broken[i] = p.pid;
    state.rocks[z]--;
  } else state.owners[i] = p.pid;
  seat.acted = true;
  const member = c.pl[p.pid];
  member.actAt = member.idleAt = S.now;
  pipeHand(c, seat, !hammer);
  if (hammer && !state.rocks[z]) for (const q of Object.values(state.seats)) {
    if (q.zone === z && q.tool === PIPE_HAMMER) pipeHand(c, q, false);
  }
  state.changes.push([++state.rev, i, state.board[i]]);
  if (state.changes.length > PIPE_CHANGES) state.changes.shift();
  const path = !hammer && pipeTrace(state);
  if (!path) return true;

  const left = new Set(), right = new Set();
  for (const cell of path) {
    const owner = state.owners[cell], side = pipeZone(cell);
    if (state.seats[owner]?.zone === side) (side ? right : left).add(owner);
  }
  if (![...left].some((a) => [...right].some((b) => a !== b))) return true;

  state.finished = path;
  state.wonAt = S.now;
  c.score = Math.floor((c.endAt - S.now) / 1000);
  for (const cell of path) for (const pid of [state.owners[cell], state.broken[cell]]) {
    if (c.pl[pid]) c.pl[pid].pts++;
  }
  coopFinish(S, dim, dimInside(S, dim.id));
  return true;
}

function pipeGrade(c) {
  if (c.pipe?.wonAt == null || c.pipe.wonAt >= c.endAt) return 0;
  const left = c.endAt - c.pipe.wonAt;
  return COOP.pipe.gradeSec.filter((s) => left >= s * 1000).length;
}

/** Only a finished path is regular-pay credit; an active worker can earn the normal failure tip. */
function pipeEligible(c, pid) {
  if (c.pipe?.wonAt != null) return (c.pl[pid]?.pts || 0) > 0;
  return !!c.pipe?.seats[pid]?.acted;
}

/** cp: [revision, full|delta, board string|changed cells, inlet, outlet, visible seat rows]. */
function pipeView(S, p, out, c) {
  const state = c && c.pipe, seen = p.pipeSeen;
  if (!state || !state.seats[p.pid] || p.map !== state.id) {
    if (seen) { delete p.pipeSeen; out.cp = 0; }
    return;
  }
  const seats = Object.entries(state.seats).flatMap(([pid, q]) => {
    const o = S.players[pid];
    return o && o.map === state.id ? [[o.eid, q.zone, q.tool, q.handRev]] : [];
  });
  const seatsKey = seats.join(";");
  if (seen?.id === state.id && seen.rev === state.rev && seen.seatsKey === seatsKey) return;
  const first = state.changes[0]?.[0] ?? state.rev + 1;
  const full = !seen || seen.id !== state.id || seen.rev > state.rev || seen.rev < first - 1;
  const delta = new Map();
  if (!full) for (const [rev, index, value] of state.changes) if (rev > seen.rev) delta.set(index, value);
  out.cp = [state.rev, full ? 0 : 1, full ? state.board.join("") : [...delta], state.src, state.dst, seats];
  p.pipeSeen = { id: state.id, rev: state.rev, seatsKey };
}
