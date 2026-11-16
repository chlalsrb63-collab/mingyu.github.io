// ───────────────────────────── NPC routines ─────────────────────────────
//
// World time picks a block and a leg. Paths are shared by worlds, while each
// occupied map tracks which rows its players have already been sent.

const NPC_ACTS = ["work", "walk", "eat", "drink", "rest", "sleep", "stroll", "chat", "shop", "fish", "train", "read", "play", "perform", "tend", "watch"];
const NPC_REL_KINDS = ["friend", "family", "mentor", "rival", "crush", "avoid"];
const NPC_CYCLE = 4, NPC_HOUR = SKY_DAY_MS / 24, NPC_EPOCH = 4 * NPC_HOUR;
const NPC_TPS = BASE_SPD / T;
const npcDay = (now) => Math.floor((now - NPC_EPOCH) / SKY_DAY_MS);
const npcDayStart = (day) => NPC_EPOCH + day * SKY_DAY_MS;
const npcMod = (n, mod) => ((n % mod) + mod) % mod;
const npcSec = (ms, now) => Math.ceil((ms - npcDayStart(npcDay(now))) / 1000);
const npcIdRx = /^[a-z][a-z0-9_]{1,31}$/;
const npcDirection = { s: 0, w: 1, e: 2, n: 3 };
const npcHours = (v) => Number.isFinite(v) && v >= 4 && v < 28 && Number.isInteger(v * NPC_HOUR / 1000);
const npcDays = (days) => Array.isArray(days) ? days : [0, 1, 2, 3];
const npcErrors = [];
const npcProblem = (path, msg) => npcErrors.push({ path, msg });
const npcPlaces = new Map(), npcCast = new Map(), npcMapIds = new Set(), npcRels = [];
const npcPaths = new Map(), npcTransit = new Map();
let npcFrame = null;

function npcOpen(map, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && inMap(map, x, y) && !!map.reach[y * map.w + x];
}

/** The tiles a body walks to: a seat may be joined by one final move from a free side. */
function npcSpot(map, row, hidden) {
  if (!Array.isArray(row) || !Number.isInteger(row[0]) || !Number.isInteger(row[1]) || !inMap(map, row[0], row[1])) return null;
  const [x, y, rawDir, pose] = row, here = [x, y];
  if (rawDir !== undefined && !Object.hasOwn(npcDirection, rawDir) && ![0, 1, 2, 3].includes(rawDir)) return null;
  if (pose !== undefined && pose !== "sit") return null;
  let entry = here;
  if (!npcOpen(map, x, y)) {
    if (pose !== "sit" || !["k", "s"].includes(map.o[y][x])) return null;
    entry = D4.map(([dx, dy]) => [x + dx, y + dy]).find(([xx, yy]) => npcOpen(map, xx, yy));
    if (!entry) return null;
  }
  return { map: map.id, x, y, dir: npcDirection[rawDir] ?? rawDir ?? 0, pose, hidden, entry };
}

function npcBlocks(actor, plan) {
  if (!Array.isArray(plan) || !plan.length) { npcProblem(actor.id, "하루 일과가 비어 있습니다"); return; }
  const days = Array.from({ length: NPC_CYCLE }, () => new Map());
  for (const b of plan) {
    if (!b || !npcHours(b.h) || !NPC_ACTS.includes(b.act) || (b.at === "post" ? !actor.post : !npcPlaces.has(b.at))) {
      npcProblem(actor.id, "시간, 장소 또는 행동이 올바르지 않습니다"); continue;
    }
    if (b.pose !== undefined && !NPC_POSES.includes(b.pose)) npcProblem(actor.id, "등록되지 않은 동작입니다");
    if (b.lag !== undefined && (!Number.isInteger(b.lag) || b.lag < 0)) npcProblem(actor.id, "순찰 간격은 0 이상의 정수입니다");
    if (b.days !== undefined && (!Array.isArray(b.days) || !b.days.length || new Set(b.days).size !== b.days.length ||
      b.days.some((day) => ![0, 1, 2, 3].includes(day)))) { npcProblem(actor.id, "일과 주기는 0~3일입니다"); continue; }
    const rain = b.rain ?? actor.shelter;
    if (rain !== undefined && !npcPlaces.has(rain)) npcProblem(actor.id, "비를 피할 장소를 찾을 수 없습니다");
    for (const day of npcDays(b.days)) {
      const current = days[day].get(b.h);
      if (current && current.override === !!b.days) { npcProblem(actor.id, day + "일차 같은 시간에 일과가 겹칩니다"); continue; }
      if (current?.override) continue;
      days[day].set(b.h, { ...b, override: !!b.days, rain: npcPlaces.has(rain) ? rain : null, spot: null, rainSpot: null });
    }
  }
  if (days.some((day) => !day.size)) { npcProblem(actor.id, "4일차까지 매일 순환할 일과가 필요합니다"); return; }
  actor.days = days.map((day) => [...day.values()].sort((a, b) => a.h - b.h));
}

/** Assign one spot across each block, including its rain option. */
function npcAssignSpots() {
  for (let day = 0; day < NPC_CYCLE; day++) {
    const uses = new Map(), occupiedTiles = new Map();
    const claims = [...npcCast.values()].flatMap((actor) => actor.days[day].flatMap((b, i) => {
      const [after] = actor.days[(day + 1) % NPC_CYCLE];
      const end = actor.days[day][i + 1]?.h ?? (after.h + 24);
      if (end - b.h < 1) npcProblem(actor.id, b.h + "시 일과에 한 시간 이상 필요합니다");
      const place = npcPlaces.get(b.at);
      const keys = [[b.at, "spot"]];
      if (b.rain && b.rain !== b.at && place && !mapOf(place.map).indoor) keys.push([b.rain, "rainSpot"]);
      return keys.map(([key, slot]) => ({ key, slot, b, end, actor }));
    })).sort((a, b) => a.b.h - b.b.h || a.actor.i - b.actor.i);
    for (const claim of claims) {
      const { key, slot, b, end, actor } = claim;
      const place = npcPlaces.get(key);
      if (place?.hidden || place?.round) { b[slot] = place.spots[0]; continue; }
      const candidates = key === "post" ? [actor.post] : place.spots;
      const reserved = uses.get(key) || [];
      const tileKey = (s) => s.map + ":" + s.x + "," + s.y;
      const occupied = (s) => (occupiedTiles.get(tileKey(s)) || []).some((r) =>
        r.actor !== actor && r.h < end && b.h < r.end);
      const friend = b.with && reserved.find((r) => r.actor.id === b.with && r.h === b.h);
      let spot = candidates.find((s) => !occupied(s) &&
        (!friend || Math.abs(s.x - friend.spot.x) + Math.abs(s.y - friend.spot.y) <= 2));
      if (!spot) {
        npcProblem(key, day + "일차 " + b.h + "시의 자리가 부족합니다 (" + actor.id + ")");
        const [first] = candidates, map = mapOf(first.map);
        const choices = D4.map(([dx, dy]) => npcSpot(map, [first.x + dx, first.y + dy, first.dir], false));
        spot = choices.find((s) => s && !occupied(s)) || first;
      }
      b[slot] = spot;
      const reservation = { spot, h: b.h, end, actor };
      reserved.push(reservation);
      uses.set(key, reserved);
      const tile = tileKey(spot), there = occupiedTiles.get(tile) || [];
      there.push(reservation);
      occupiedTiles.set(tile, there);
    }
  }
}

function npcInstall(data) {
  if (!data) return;
  if (data.v !== 1 || !isObj(data.places) || !isObj(data.cast) || !Array.isArray(data.rel)) {
    npcProblem("", "{v:1, places, cast, rel} 형식이어야 합니다"); return;
  }
  for (const [id, item] of Object.entries(data.places)) {
    const mapId = item && realId(item.map), map = mapId && MAP_META[mapId].safe ? mapOf(mapId) : null;
    if (!npcIdRx.test(id) || id === "post" || !map || typeof item.name !== "string" || !item.name.trim()) {
      npcProblem(id, "안전한 지도와 장소 이름이 필요합니다"); continue;
    }
    const isRound = item.round !== undefined, hidden = item.in === true;
    const rows = isRound ? item.round : item.spots;
    if (!Array.isArray(rows) || rows.length < (isRound ? 2 : 1) || (isRound && hidden)) {
      npcProblem(id, "자리 또는 순찰의 좌표가 필요합니다"); continue;
    }
    const spots = rows.map((row) => npcSpot(map, row, hidden));
    const keys = spots.map((s) => s && s.y * map.w + s.x);
    if (spots.some((s) => !s) || new Set(keys).size !== keys.length) {
      npcProblem(id, "자리가 중복되거나 입구에서 걸을 수 없습니다"); continue;
    }
    npcPlaces.set(id, { id, i: npcPlaces.size, map: mapId, name: item.name, hidden, spots,
      round: isRound ? spots.map((s) => s.entry) : null });
    npcMapIds.add(mapId);
  }
  for (const [id, desc] of Object.entries(data.cast)) {
    if (!npcIdRx.test(id) || !isObj(desc)) { npcProblem(id, "NPC 식별자 또는 형식이 잘못됐습니다"); continue; }
    const mapId = Object.hasOwn(NPC_MAP, id) ? NPC_MAP[id] : null;
    const map = mapId && MAP_META[mapId].safe ? mapOf(mapId) : null;
    const npc = map?.npcs.find((n) => n.id === id);
    if ((mapId && !npc) || npc?.thing) { npcProblem(id, "안전한 지도의 주민만 이동할 수 있습니다"); continue; }
    const home = npcPlaces.get(desc.home);
    if (desc.home !== undefined && !home) npcProblem(id, "주민의 집을 찾을 수 없습니다");
    if (!npc && (!home || typeof desc.name !== "string" || !desc.name.trim() ||
      !Array.isArray(desc.hero) || desc.hero.length !== LOOK_MAX.length || desc.hero.some((v, i) => !Number.isInteger(v) || v < 0 || v > LOOK_MAX[i]))) {
      npcProblem(id, "새 주민의 이름, 집, 외형이 필요합니다"); continue;
    }
    const post = npc && npcSpot(map, [npc.x, npc.y, 0, ["k", "s"].includes(map.o[npc.y]?.[npc.x]) ? "sit" : undefined], false);
    if (npc && !post && desc.plan?.some?.((b) => b?.at === "post")) {
      npcProblem(id, "일터의 위치에 갈 수 없습니다"); continue;
    }
    if (desc.lines !== undefined && (!isObj(desc.lines) || Object.values(desc.lines).some((lines) =>
      !Array.isArray(lines) || lines.some((line) => typeof line !== "string" || !line.trim() || line.length > 180)))) npcProblem(id, "대사는 180자 이내의 문장 목록입니다");
    if (desc.weapon !== undefined && (typeof desc.weapon !== "string" || !Object.hasOwn(WKIND, desc.weapon))) {
      npcProblem(id, "등록된 무기 종류가 필요합니다"); continue;
    }
    const actor = { ...desc, id, i: npcCast.size, npc, post, postMap: mapId, name: npc?.name || desc.name, moves: new Map() };
    npcBlocks(actor, desc.plan);
    if (actor.days) {
      npcCast.set(id, actor);
      if (mapId) npcMapIds.add(mapId);
      else noteNpc(home.map, id, actor.name);
    }
  }
  for (const row of data.rel) {
    const a = npcCast.get(row?.a), b = npcCast.get(row?.b);
    if (!a || !b || a === b || !NPC_REL_KINDS.includes(row.kind) ||
      npcRels.some((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a))) {
      npcProblem("rel", "주민 관계의 대상 또는 유형이 올바르지 않습니다"); continue;
    }
    if (row.chat !== undefined && (!Array.isArray(row.chat) || row.chat.some((line, i) =>
      typeof line !== "string" || !line.startsWith(i % 2 ? "b: " : "a: ")))) npcProblem("rel", "대화는 a:와 b:를 번갈아 적어야 합니다");
    npcRels.push({ ...row, a, b });
  }
  for (const a of npcCast.values()) {
    if (a.cover && !npcCast.has(a.cover) && !Object.hasOwn(NPC_MAP, a.cover)) npcProblem(a.id, "대리 NPC가 존재하지 않습니다");
    for (let d = 0; d < NPC_CYCLE; d++) for (const b of a.days[d]) {
      if (!b.with) continue;
      const friend = npcCast.get(b.with), peer = friend?.days[d].find((row) => row.h === b.h && row.at === b.at);
      const rel = npcRels.find((r) => (r.a === a && r.b === friend) || (r.a === friend && r.b === a));
      if (!peer || (peer.with && peer.with !== a.id) || !rel || ["crush", "avoid"].includes(rel.kind)) npcProblem(a.id, "동행 일과의 시간, 장소, 관계가 일치하지 않습니다");
    }
  }
  for (const r of npcRels.filter(r => r.kind === "avoid")) for (let d = 0; d < NPC_CYCLE; d++) {
    for (const a of r.a.days[d]) {
      if (a.at !== "post" && r.b.days[d].some((b) => a.h === b.h && (a.at === b.at || a.rain === b.at || b.rain === a.at || (a.rain && a.rain === b.rain))))
        npcProblem(a.at, "서로 피하는 두 주민이 같은 시간에 있습니다");
    }
  }
  npcAssignSpots();
  for (const id of npcMapIds) npcTransit.set(id, npcPlaces.size + npcTransit.size);
}
npcInstall(DATA.npclife);

export function lifeCheck() {
  return npcLifeProblems().map(({ path, msg }) => path ? path + ": " + msg : msg);
}

/** Stable delay in seconds. A companion leaves one second after the leader. */
function npcDepart(actor, day, block) {
  let seed = day | 0;
  const peer = npcCast.get(block.with);
  const leader = peer && peer.i < actor.i ? peer.id : actor.id;
  for (let i = 0; i < leader.length; i++) seed = Math.imul(seed, 31) + leader.charCodeAt(i);
  const offset = npcMod(Math.imul(seed, 31) + Math.round(block.h * 120), 31);
  return npcDayStart(day) + Math.round((block.h - 4) * NPC_HOUR) + (offset + (leader === actor.id ? 0 : 1)) * 1000;
}

function npcSpan(actor, now) {
  let day = npcDay(now), blocks = actor.days[npcMod(day, NPC_CYCLE)], i = blocks.length - 1;
  for (; i >= 0; i--) if (npcDepart(actor, day, blocks[i]) <= now) break;
  if (i < 0) { day--; blocks = actor.days[npcMod(day, NPC_CYCLE)]; i = blocks.length - 1; }
  const nextDay = i + 1 < blocks.length ? day : day + 1;
  const nextBlock = blocks[i + 1] || actor.days[npcMod(nextDay, NPC_CYCLE)][0];
  return { block: blocks[i], start: npcDepart(actor, day, blocks[i]), end: npcDepart(actor, nextDay, nextBlock), nextBlock };
}

function npcDestination(block, start) {
  if (block.rainSpot && weatherAt(block.spot.map, start) === WX.rain)
    return { place: npcPlaces.get(block.rain), spot: block.rainSpot };
  return { place: npcPlaces.get(block.at), spot: block.spot };
}

/** A four-way path with deterministic tie-breaking from the shared map search. */
function npcPath(mapId, from, to) {
  const key = mapId + ":" + from.join(",") + ">" + to.join(",");
  if (npcPaths.has(key)) return npcPaths.get(key);
  const map = mapOf(mapId), [tx, ty] = to;
  const indices = walk(map.w, map.h, from[1] * map.w + from[0], (i) => i === ty * map.w + tx,
    (i) => map.reach[i] ? 1 : Infinity, tx, ty);
  const path = indices && indices.map((i) => [i % map.w, Math.floor(i / map.w)]);
  if (npcPaths.size >= 400) npcPaths.delete(npcPaths.keys().next().value);
  npcPaths.set(key, path);
  return path;
}
const npcSameTile = (a, b) => a[0] === b[0] && a[1] === b[1];

function npcRound(place, lag) {
  const ring = place.round;
  const path = ring.flatMap((p, i) => npcPath(place.map, p, ring[(i + 1) % ring.length])?.slice(0, -1) || []);
  if (!path.length) return null;
  const n = npcMod(-lag, path.length);
  const rotated = path.slice(n).concat(path.slice(0, n));
  return rotated.concat([rotated[0]]);
}

/** Rooms connect through the hub. An arrival tile is the same one players use. */
function npcTrip(from, to) {
  const legs = [];
  let map = from.map, at = from.entry, leavingSeat = !npcSameTile([from.x, from.y], from.entry);
  let entered = false;
  while (map !== to.map) {
    const via = map !== "town" && to.map !== "town" ? "town" : to.map;
    const door = mapOf(map).portals.find((p) => p.to === via && npcOpen(mapOf(map), p.x, p.y));
    if (!door) return null;
    const path = npcPath(map, at, [door.x, door.y]);
    if (!path) return null;
    legs.push({ map, path: leavingSeat ? [[from.x, from.y], ...path] : path, fl: (entered ? 1 : 0) | 2 });
    at = arrivalOf(null, door);
    map = via;
    leavingSeat = false; entered = true;
  }
  const path = npcPath(map, at, to.entry);
  if (!path) return null;
  const toTile = [to.x, to.y], start = [from.x, from.y];
  const route = (leavingSeat ? [start] : []).concat(path, npcSameTile(to.entry, toTile) ? [] : [toTile]);
  if (route.length > 1 || entered) legs.push({ map, path: route, fl: entered ? 1 : 0 });
  return legs;
}

const npcLegMs = (leg) => Math.max(1000, Math.ceil((leg.path.length - 1) / NPC_TPS) * 1000);
function npcMove(actor, span, depth = 0) {
  const cached = actor.moves.get(span.start);
  if (cached) return cached;
  const dest = npcDestination(span.block, span.start);
  const round = dest.place?.round && npcRound(dest.place, span.block.lag || 0);
  const target = round ? { ...dest.spot, x: round[0][0], y: round[0][1], entry: round[0] } : dest.spot;
  const before = npcSpan(actor, span.start - 1), previous = npcDestination(before.block, before.start);
  let start = previous.spot;
  if (previous.place?.round && depth < 8) {
    const run = npcMove(actor, before, depth + 1);
    if (run.round) {
      const [x, y] = run.round[npcMod(Math.floor((span.start - run.arrival) * NPC_TPS / 1000), run.round.length - 1)];
      start = { ...previous.spot, x, y, entry: [x, y] };
    }
  }
  let arrival = span.start;
  const legs = start.map === target.map && start.x === target.x && start.y === target.y ? [] : npcTrip(start, target) || [];
  for (const leg of legs) { leg.start = arrival; arrival += npcLegMs(leg); leg.end = arrival; }
  const move = { ...dest, legs, arrival, round };
  if (depth === 0) {
    if (actor.moves.size === 4) actor.moves.delete(actor.moves.keys().next().value);
    actor.moves.set(span.start, move);
  }
  return move;
}

function npcAlong(path, step) {
  const i = Math.min(path.length - 1, Math.max(0, Math.floor(step)));
  const [x, y] = path[i], [nx, ny] = path[i + 1] || path[i];
  const k = Math.max(0, Math.min(1, step - i));
  return [x + (nx - x) * k, y + (ny - y) * k, dirOf(nx - x, ny - y)];
}

/** An actor's current pose, independent of visited maps and room uptime. */
function npcState(actor, now) {
  const span = npcSpan(actor, now), move = npcMove(actor, span);
  const leg = move.legs.find((part) => now < part.end);
  const walking = leg || (move.round && { map: move.spot.map, path: move.round, fl: 4, start: move.arrival, end: span.end });
  let x = move.spot.x, y = move.spot.y, dir = move.spot.dir;
  if (walking) {
    const stepped = walking.fl & 4 ? npcMod((now - walking.start) * NPC_TPS / 1000, walking.path.length - 1)
      : (now - walking.start) / (walking.end - walking.start) * (walking.path.length - 1);
    [x, y, dir] = npcAlong(walking.path, stepped);
  }
  return { id: actor.id, map: walking?.map || move.spot.map, x: x * T + 8, y: y * T + 12,
    tx: Math.floor(x), ty: Math.floor(y), dir, act: leg ? "walk" : span.block.act,
    place: move.place?.id || "post", with: span.block.with || null, moving: !!walking,
    hidden: !walking && !!move.spot.hidden, onPost: !walking && move.spot === actor.post,
    until: Math.min(walking?.end ?? span.end, span.end), start: walking?.start ?? move.arrival, path: walking?.path, fl: walking?.fl || 0 };
}

function npcStates(now) {
  if (npcFrame?.now === now) return npcFrame.states;
  const states = new Map();
  for (const actor of npcCast.values()) states.set(actor.id, npcState(actor, now));
  npcFrame = { now, states };
  return states;
}
export function npcAt(id, now) {
  const actor = npcCast.get(id);
  if (!actor || !Number.isFinite(now)) return null;
  const { start, path, fl, ...state } = npcFrame?.now === now ? npcFrame.states.get(id) : npcState(actor, now);
  return state;
}
function npcBlockPlan(actor, now) {
  const span = npcSpan(actor, now);
  const { place } = npcDestination(span.block, span.start);
  const next = npcDestination(span.nextBlock, span.end);
  return { place: place?.id || "post", act: span.block.act, until: span.end,
    next: { place: next.place?.id || "post", act: span.nextBlock.act, at: span.end } };
}
export function npcPlan(id, now) {
  const actor = npcCast.get(id);
  return actor && Number.isFinite(now) ? npcBlockPlan(actor, now) : null;
}
export function npcsOn(mapId, now) {
  if (!npcMapIds.has(mapId) || !Number.isFinite(now)) return [];
  return [...npcStates(now).values()].filter((s) => s.map === mapId).map((s) => s.id);
}

/** Corner tiles suffice to reconstruct a four-way walk. */
function npcCorners(path) {
  const out = [...path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], [cx, cy] = path[i + 1];
    if (bx - ax !== cx - bx || by - ay !== cy - by) out.push(bx, by);
  }
  if (path.length > 1) out.push(...path[path.length - 1]);
  return out;
}

function npcRows(map, now, states, prev, resend) {
  const rows = [];
  for (const [id, state] of states) {
    const actor = npcCast.get(id), act = NPC_ACTS.indexOf(state.act), end = npcSec(state.until, now);
    const previous = prev?.get(id);
    if (!resend && previous && previous.start === state.start && previous.until === state.until && previous.map === state.map) continue;
    if (state.map !== map || state.hidden) {
      if (actor.postMap === map || previous?.map === map) rows.push([actor.i, 2, end]);
      continue;
    }
    if (state.onPost && !prev && state.act === "work") continue;
    if (state.moving) {
      rows.push([actor.i, 1, npcSec(state.start, now), end, act, state.fl, ...npcCorners(state.path)]);
    } else {
      const row = [actor.i, 0, state.tx, state.ty, state.dir, act, end], other = npcCast.get(state.with);
      if (other) row.push(other.i);
      rows.push(row);
    }
  }
  return rows;
}
export function lifeLegs(map, now, since) {
  if (!npcMapIds.has(map) || !Number.isFinite(now)) return [];
  const previous = Number.isFinite(since) ? npcStates(since) : null;
  const resend = previous && npcDay(now) !== npcDay(since);
  return npcRows(map, now, npcStates(now), previous, resend);
}

export function lifeWhere(now) {
  if (!Number.isFinite(now)) return [];
  return [...npcStates(now)].map(([id, position]) => {
    const actor = npcCast.get(id), plan = npcBlockPlan(actor, now);
    // A travelling NPC belongs to the map it occupies until it passes through a door.
    const place = position.moving && !(position.fl & 4) ? npcTransit.get(position.map) : npcPlaces.get(plan.place)?.i;
    return [actor.i, place ?? -1, NPC_ACTS.indexOf(position.act), npcSec(plan.next.at, now), npcPlaces.get(plan.next.place)?.i ?? -1];
  });
}

function npcLifeTick(rt, now) {
  if (!npcMapIds.has(rt.id) || (now >= rt.npcAt && now < rt.npcNext)) return;
  const states = npcStates(now);
  const next = [...states.values()].reduce((end, s) => Math.min(end, s.until), npcDayStart(npcDay(now) + 1));
  rt.npcRows = lifeLegs(rt.id, now, rt.npcAt);
  rt.npcAt = now;
  rt.npcNext = Math.max(now + 1, next);
}

function npcLifeSnap(S, p, out) {
  const rows = p.sendMap ? lifeLegs(p.map, S.now) : S.maps[p.map].npcRows;
  if (rows?.length) out.nl = rows;
  if (p.npcWhere) { out.nw = lifeWhere(S.now); p.npcWhere = false; }
}

/** Body, service post, or the door of a hidden resident. */
export function npcReach(p, id) {
  for (const n of mapOfS(p.S, p.map)?.npcs || []) {
    if (n.id === id && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < 56) return true;
  }
  const body = npcAt(id, p.S.now);
  return !!body && body.map === p.map && dist(p.x, p.y, body.x, body.y) < (body.hidden ? 40 : body.moving ? 88 : 56);
}

function npcLifeDefs() {
  return {
    cast: [...npcCast.values()].map((a) => [a.id, a.name, a.npc?.look || a.hero, a.cos || [], a.postMap, a.traits || [],
      a.npc?.pose || null, a.home || null, a.cover || null, a.away || null, a.kid ? 1 : 0, a.npc?.role || null,
      ...(a.weapon ? [a.weapon] : [])]),
    places: [...[...npcPlaces.values()].map((p) => [p.id, p.map, p.name]), ...[...npcTransit.keys()].map((id) => ["map:" + id, id, MAP_META[id].name])],
    acts: NPC_ACTS, cycle: NPC_CYCLE,
    rel: npcRels.map((r) => [r.a.i, r.b.i, r.kind]),
    lines: Object.fromEntries([...npcCast.values()].filter((a) => isObj(a.lines)).map((a) => [a.id, a.lines])),
    chat: npcRels.filter((r) => r.chat?.length).map((r) => [r.a.i, r.b.i, r.chat]),
  };
}

function npcLifeProblems() {
  const result = npcErrors.slice();
  if (result.length) return result;
  const err = (path, msg) => result.push({ path, msg });
  // Check both destination variants without depending on the weather of a particular week.
  for (const actor of npcCast.values()) for (let day = 0; day < NPC_CYCLE; day++) {
    const all = actor.days[day];
    const prev = actor.days[(day + NPC_CYCLE - 1) % NPC_CYCLE].at(-1);
    for (let i = 0; i < all.length; i++) {
      const b = all[i], before = all[i - 1] || prev;
      if ((b.at === "post" && !actor.post) || !b.spot) continue;
      const place = npcPlaces.get(b.at);
      const options = [b.spot, b.rainSpot].filter(Boolean);
      if (place?.round && !npcRound(place, b.lag || 0)) err(actor.id, "순찰로가 이어져 있지 않습니다");
      for (const from of [before.spot, before.rainSpot].filter(Boolean)) for (const to of options) {
        const trip = npcTrip(from, to);
        if (!trip) { err(actor.id, before.at + "에서 " + b.at + "까지 길이 이어지지 않습니다"); continue; }
        const duration = trip.reduce((ms, leg) => ms + npcLegMs(leg), 0);
        const hours = (all[i + 1]?.h ?? actor.days[(day + 1) % NPC_CYCLE][0].h + 24) - b.h;
        if (duration > 60000 || duration + 61000 > hours * NPC_HOUR)
          err(actor.id, b.h + "시 " + b.at + "까지 이동이 너무 깁니다");
      }
    }
  }
  return result;
}
