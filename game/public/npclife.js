import { serverNow } from "./sky.js";

// Static cast and locations come from welcome.defs. Leg updates describe only this map.
const DAY_MS = 48 * 60_000;
const FADE_MS = 300;
const ROUND_TPS = 3;
const WHERE_MS = 20_000;
const ACT_POSE = { eat: "sip", drink: "sip", sleep: "doze", chat: "wave", shop: "carry", fish: "fish", train: "hammer", read: "read", perform: "wave" };
const ACT_NAME = {
  work: "일하는 중", walk: "이동 중", eat: "식사 중", drink: "한잔하는 중",
  rest: "쉬는 중", sleep: "자는 중", stroll: "산책 중", chat: "수다 중",
  shop: "장 보는 중", fish: "낚시 중", train: "수련 중", read: "책 읽는 중",
  play: "노는 중", perform: "공연 중", tend: "가꾸는 중", watch: "망보는 중",
};
const clamp = (v) => Math.max(0, Math.min(1, v));

let defs, map, actors = [], places = [], acts = [], rels = [], dialogue = {};
let dayMs = DAY_MS, selected = null, whereAsked = -Infinity;
let where = [], nextChange = -Infinity;
const castById = new Map(), posts = new Map(), legs = new Map();

export function load(nextMap, nextDefs) {
  map = nextMap;
  posts.clear();
  legs.clear();
  if (!map) nextDefs = null;
  if (nextDefs !== defs) {
    defs = nextDefs;
    const life = defs?.npclife;
    dayMs = defs?.sky?.dayMs || DAY_MS;
    places = life?.places || [];
    acts = life?.acts || [];
    dialogue = life?.lines || {};
    selected = null;
    where = [];
    nextChange = -Infinity;
    whereAsked = -Infinity;
    castById.clear();
    actors = (life?.cast || []).map(([id, name, look, cos, postMap, traits, pose, home, cover, away, kid, role], index) => {
      const actor = { id, index, name, look, cos, postMap, traits, pose, home, cover, away, kid: !!kid, role, resident: !postMap };
      castById.set(id, actor);
      return actor;
    });
    const chat = new Map((life?.chat || []).map(([a, b, lines]) => [`${a}:${b}`, lines]));
    rels = (life?.rel || []).map(([a, b, kind]) => ({ a: actors[a].id, b: actors[b].id, kind, chat: chat.get(`${a}:${b}`) || [] }));
  }
  for (const post of map?.npcs || []) if (castById.has(post.id)) posts.set(post.id, post);
}

export const cast = (id) => castById.get(id) || null;
export const lines = (id) => Object.hasOwn(dialogue, id) ? dialogue[id] : null;
export const relationships = () => rels;
export const actName = (act) => ACT_NAME[act] || "";

// Life days start at 04:00. Anchor each packet once so a held pose survives a clock change.
function lifeStart(now, endSecond) {
  const epoch = dayMs / 6;
  const start = Math.floor((now - epoch) / dayMs) * dayMs + epoch;
  // dn is quantized to seconds. A packet for the new day can beat the estimated clock.
  return start + (start + endSecond * 1000 < now - dayMs / 2 ? dayMs : 0);
}

const direction = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);

export function onLegs(rows, now = serverNow()) {
  if (!map || !rows) return;
  for (const row of rows) {
    const [i, mode] = row;
    const actor = actors[i];
    if (!actor) continue;
    if (mode === 0) {
      const [, , x, y, dir, a, end, friend] = row;
      legs.set(actor.id, { x, y, dir, act: acts[a], until: lifeStart(now, end) + end * 1000, with: actors[friend]?.id || null });
    } else if (mode === 1) {
      const [, , start, end, a, flags, x, y] = row;
      const origin = lifeStart(now, end);
      const segments = [];
      let length = 0;
      for (let j = 8; j + 1 < row.length; j += 2) {
        const dx = row[j] - row[j - 2], dy = row[j + 1] - row[j - 1];
        const size = Math.abs(dx) + Math.abs(dy);
        if (!size) continue;
        length += size;
        segments.push({ x: row[j - 2], y: row[j - 1], dx, dy, size, end: length, dir: direction(dx, dy) });
      }
      legs.set(actor.id, { x, y, dir: 0, act: acts[a], start: origin + start * 1000, until: origin + end * 1000, flags, segments, length });
    } else if (mode === 2) {
      legs.set(actor.id, { gone: true });
    }
  }
}

function walk(leg, now) {
  const { start, until, flags, segments, length } = leg;
  const t = Math.max(start, Math.min(now, until));
  let fade = 1;
  if (flags & 1) fade = clamp((t - start) / FADE_MS);
  if (flags & 2) fade = Math.min(fade, clamp((until - t) / FADE_MS));
  if (!segments.length) return { x: leg.x, y: leg.y, dir: 0, moving: false, fade };
  const step = flags & 4 ? ((t - start) * ROUND_TPS / 1000) % length : clamp((t - start) / Math.max(1, until - start)) * length;
  const segment = segments.find((part) => step < part.end) || segments[segments.length - 1];
  const k = (step - segment.end + segment.size) / segment.size;
  return { x: segment.x + segment.dx * k, y: segment.y + segment.dy * k, dir: segment.dir, moving: now >= start && now < until, fade };
}

export function at(id, now = serverNow()) {
  const actor = cast(id), leg = legs.get(id), post = posts.get(id);
  if (!actor || leg?.gone || (!leg && !post)) return null;
  const point = leg?.segments ? walk(leg, now) : { ...(leg || post), moving: false, fade: 1 };
  if (point.fade === 0 && now >= leg?.until) return null;
  const act = leg?.act || "work";
  const onPost = !!post && act === "work" && !point.moving && point.x === post.x && point.y === post.y;
  const pose = act === "work" || act === "tend" ? actor.pose : ACT_POSE[act];
  return { ...actor, map: map.id, post: post || null, role: post?.role || actor.role, pose, act, x: point.x * 16 + 8, y: point.y * 16 + 12,
    dir: point.dir || 0, moving: point.moving, fade: point.fade, onPost, with: leg?.with || null, until: leg?.until };
}

export function list(now = serverNow()) {
  const bodies = [];
  for (const actor of actors) {
    const body = at(actor.id, now);
    if (body) bodies.push(body);
  }
  return bodies;
}

function location(index, actor) {
  return places[index] || [null, actor.postMap, defs?.maps?.find((m) => m.id === actor.postMap)?.name || null];
}

export function onWhere(rows, now = serverNow()) {
  if (!rows) return;
  where = [];
  nextChange = Infinity;
  for (const [i, index, a, next, nextIndex] of rows) {
    const actor = actors[i];
    if (!actor) continue;
    const [placeId, map, place] = location(index, actor);
    const [nextPlaceId, nextMap, nextPlace] = location(nextIndex, actor);
    const nextAt = lifeStart(now, next) + next * 1000;
    where.push({ ...actor, placeId, map, place, act: acts[a], nextAt, nextPlaceId, nextMap, nextPlace });
    nextChange = Math.min(nextChange, nextAt);
  }
}

export const locations = () => where;
export const tracked = () => selected;
export function track(id) { selected = castById.has(id) ? id : null; }
export function needsWhere(now = serverNow()) { return actors.length > 0 && now >= nextChange && now - whereAsked >= WHERE_MS; }
export function markWhereAsked(now = serverNow()) { whereAsked = now; }
