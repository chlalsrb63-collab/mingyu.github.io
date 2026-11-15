/**
 * 추적 — walk to an objective by itself (the quest tracker, the quest window, the 알바 board, the daily and weekly
 * windows, 주아나's card and the first steps each carry a [추적] button; the `track` key, Shift+G by default, tracks
 * the selected / first objective and, pressed again, cancels).
 * - An objective is a getter returning a target, read again at every leg (the job in hand moves on as it goes):
 *   { k: "npc", id } · { k: "mob", id } (a hunting ground that has it, its edge) · { k: "map", id } · { k: "fit" }
 *   (a hunting ground for my level) · { k: "spot", map, x, y } (tiles) · { k: "fire" } (a campfire).
 * - Where: an NPC's map from the life schedule (NPC.locations) or defs.npcMap, its tile from this map's npcs, a
 *   walking villager's body from NPC.at; a monster's map by fewest doors over defs.maps[].mobs/bosses.
 * - How: only normal walking (`G.path`, the server checks every step). Another map: the door toward it on the
 *   shortest route of the world map (radar.js gateToward), stepped onto, then on from the next map.
 * - Stops: arrived (toast, the target marked), a move key / click / attack / dash / auto, death, no way found.
 */
import { G, $, T, dist, now } from "./state.js";
import * as NPC from "./npclife.js";
import * as Radar from "./radar.js";
import * as Board from "./board.js";
import { mapChart, shortestRoute } from "./worldmap.js";
import { pathTo, walkToDoor, toggleAuto } from "./input.js";
import { toast } from "./windows.js";
import { K } from "./keymap.js";

/** The trip under way: { get, label, path, end, on (map id the leg was planned on), at (map since), tries, moved, pos, re } */
let tr = null;
let chart = null, chartDefs = null;
const maps = () => G.defs.maps || [];
const mapName = (id) => (maps().find((m) => m.id === id) || { name: id }).name;
const mobName = (k) => (G.defs.mobs[k] || { name: k }).name;
const lvl = () => (G.self && G.self.lvl) || 1;
function graph() {
  if (chartDefs !== G.defs) { chartDefs = G.defs; chart = mapChart(maps()); }
  return chart;
}
const allowed = (id) => lvl() >= (graph().nodes.get(id)?.d.minLv || 1);
const hops = (a, b) => (a === b ? 1 : shortestRoute(graph().graph, a, b, allowed).length || Infinity);
/** Of `ids`, the map fewest doors away from here (here itself first). */
function nearest(ids) {
  const here = G.map && G.map.id;
  let best = null, n = Infinity;
  for (const id of ids) { const h = hops(here, id); if (h < n) { n = h; best = id; } }
  return best;
}

// ───────────────────────────── targets ─────────────────────────────

const onMap = (id) => G.map && G.map.npcs.find((n) => n.id === id);
/** The map target `t` lies on, or null when nobody knows. */
function goalMap(t) {
  const here = G.map && G.map.id;
  if (t.k === "npc") return (NPC.at(t.id) || onMap(t.id)) ? here : NPC.locations().find((n) => n.id === t.id)?.map || (G.defs.npcMap || {})[t.id] || null;
  if (t.k === "mob") return nearest(maps().filter((m) => m.mobs.includes(t.id) || (m.bosses || []).includes(t.id)).map((m) => m.id));
  if (t.k === "fit") {
    // the hunting ground whose band starts closest under my level (주아나's "내 수준에 맞는 사냥터", 정예 과제)
    const fit = maps().filter((m) => m.kind !== "town" && m.kind !== "in" && m.band && m.band[0] <= lvl() && lvl() >= (m.minLv || 0));
    const top = Math.max(...fit.map((m) => m.band[0]));
    return nearest(fit.filter((m) => m.band[0] === top).map((m) => m.id));
  }
  if (t.k === "fire") return G.map && (G.map.camps || []).length ? here : "town";
  return t.map || t.id || null;
}
/** Where on this map to walk to: { x, y (world px), r (close enough), moving } or null (the map itself is the goal). */
function goalPoint(t) {
  const m = G.map;
  if (t.k === "npc") {
    const b = NPC.at(t.id);
    if (b) return { x: b.x, y: b.y, r: 34, moving: true };
    const n = onMap(t.id);
    return n ? { x: n.x * T + 8, y: n.y * T + 12, r: 34 } : null;
  }
  if (t.k === "mob") {
    // the edge of the pack: stop a few tiles short of the nearest one seen (a field boss: its radar mark)
    let best = null, bd = Infinity;
    const seen = [...G.mobs.values()].filter((e) => e.k === t.id && e.hp > 0).map((e) => [e.x, e.y]);
    if (G.defs.mobs[t.id]?.boss && G.fb) seen.push(...G.fb);
    for (const [x, y] of seen) { const d = dist(G.me.x, G.me.y, x, y); if (d < bd) { bd = d; best = { x, y }; } }
    return best && { ...best, r: 6 * T, moving: true };
  }
  if (t.k === "fire") {
    let best = null, bd = Infinity;
    for (const c of m.camps || []) { const d = dist(G.me.x, G.me.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best && { x: best.x, y: best.y, r: 28 };
  }
  if (t.k === "spot") return { x: t.x * T + 8, y: t.y * T + 8, r: 18 };
  return null;
}
function targetName(t) {
  if (t.k === "npc") return t.name || NPC.cast(t.id)?.name || onMap(t.id)?.name || t.id;
  if (t.k === "mob") return mobName(t.id);
  if (t.k === "fire") return "모닥불";
  if (t.k === "spot") return t.name || "목표 지점";
  return mapName(goalMap(t));
}

// ───────────────────────────── the trip ─────────────────────────────

function show() {
  const box = $("#track-ind");
  if (!box) return;
  box.hidden = !tr;
  if (tr) $("#track-name").textContent = `추적 중 · ${tr.label}`;
}
export const active = () => !!tr;
/** Stop the trip (a toast when `why` is given). */
export function stop(why) {
  if (!tr) return;
  if (G.path === tr.path) G.path = null;
  tr = null;
  show();
  if (why) toast(why);
}
/** Start tracking: `get()` returns the target (see the header), `label` names the objective. */
export function start(get, label) {
  if (!G.playing || !G.map || G.me.dead) return;
  const t = get && get();
  if (!t) { toast("추적할 목표가 없습니다"); return; }
  if (G.auto) toggleAuto();
  tr = { get, label: label || targetName(t), path: null, end: null, on: null, at: now(), tries: 0, pos: [G.me.x, G.me.y], moved: now(), re: 0 };
  show();
  toast(`추적을 시작합니다 · ${targetName(t)} (${K("track")}: 취소)`);
  plan();
}
function arrive(t, p) {
  const name = targetName(t);
  if (p) G.mark = { at: now(), pos: [p.x, p.y] };
  stop(t.k === "mob" && !p ? `도착했습니다 · ${mapName(G.map.id)} — 이곳에서 ${name}을(를) 찾으세요` : `도착했습니다 · ${name}`);
}
function go(path) {
  G.path = path;
  G.mark = { at: now(), pos: path.at(-1) };
  tr.path = path;
  tr.end = path.at(-1);
}
function plan() {
  const t = tr.get();
  if (!t) { stop("목표를 마쳤습니다"); return; }
  const here = G.map.id, want = goalMap(t);
  tr.on = here; tr.re = now();
  if (!want) { stop(`${targetName(t)}의 위치를 알 수 없습니다`); return; }
  if (want !== here) {
    const gate = Radar.gateToward(want);
    if (!gate) { stop(`${mapName(want)}(으)로 가는 길을 찾지 못했습니다`); return; }
    // standing on the door already: the map change is on its way (the stuck check tries again)
    const tx = Math.floor(G.me.x / T), ty = Math.floor((G.me.y - 2) / T);
    if (gate.tiles.some(([x, y]) => Math.abs(x - tx) + Math.abs(y - ty) === 0)) { tr.path = G.path = null; tr.end = null; return; }
    if (!walkToDoor(gate.tiles)) { stop("길이 막혀 문까지 갈 수 없습니다"); return; }
    tr.path = G.path; tr.end = G.path.at(-1);
    return;
  }
  const p = goalPoint(t);
  if (!p || dist(G.me.x, G.me.y, p.x, p.y) <= p.r) { arrive(t, p); return; }
  const path = pathTo(p.x, p.y);
  // walk only until close enough (a pack of monsters: its edge)
  const cut = path && path.findIndex(([x, y]) => dist(x, y, p.x, p.y) <= p.r);
  const trip = path && (cut >= 0 ? path.slice(0, cut + 1) : path);
  if (!trip || !trip.length) { stop("길이 막혀 더 갈 수 없습니다"); return; }
  go(trip);
}
/** Each frame (hud.js hudTick): follow the trip, next leg after a door, stop when it is broken off. */
export function tick() {
  if (!tr) return;
  if (!G.playing || !G.map || G.me.dead) { stop(G.me.dead ? "쓰러져서 추적을 멈췄습니다" : null); return; }
  const t = now();
  if (G.map.id !== tr.on) {
    // through a door: the new map's position settles first
    if (tr.on !== "wait") { tr.on = "wait"; tr.at = t; }
    if (t - tr.at > 400) plan();
    return;
  }
  if (G.path !== tr.path) {
    const end = tr.end;
    // the route walked to its end (moveVector drops it): the next leg; anything else (a key, a click) breaks it off
    if (!G.path && end && dist(G.me.x, G.me.y, end[0], end[1]) < 20) plan();
    else stop("추적을 취소했습니다");
    return;
  }
  if (dist(G.me.x, G.me.y, tr.pos[0], tr.pos[1]) > 4) { tr.pos = [G.me.x, G.me.y]; tr.moved = t; }
  else if (t - tr.moved > 3000) {
    // not getting anywhere: plan again, twice, then give up
    tr.moved = t;
    if (++tr.tries > 2) { stop("길이 막혀 더 갈 수 없습니다"); return; }
    plan();
    return;
  }
  // a walking villager or a moving pack: aim again now and then
  if (t - tr.re > 1500) { const g = tr.get(); const p = g && goalMap(g) === G.map.id && goalPoint(g); if (p && p.moving) plan(); else tr.re = t; }
}

// ───────────────────────────── objectives ─────────────────────────────

const npc = (id, name) => id && { k: "npc", id, name };
const elder = () => npc((G.defs.questTurnIn && G.defs.questTurnIn.npc) || "elder");
/** The main quest's target now (elder to take or hand in, else its monster). */
function mainTarget(s) {
  const q = G.defs.quests[s.q.i];
  if (!q) return null;
  return s.q.st === 1 && s.q.n < q.n ? { k: "mob", id: q.mob } : elder();
}
function sideTarget(s, id) {
  const q = (G.defs.side || []).find((o) => o.id === id), v = s.sq && s.sq.find((r) => r[0] === id);
  if (!q || !v || v[1] === 0 || v[1] === 4) return null;
  if (v[1] !== 2) return npc(q.turnIn || q.giver, q.turnInName || q.giverName);   // ready: whoever takes it (a delivery's recipient)
  const g = q.goal;
  if (g.type === "talk") return npc(g.npc, q.target);
  if (g.type === "deliver") return npc(q.giver, q.giverName);                       // the parcel went missing: its giver hands out another
  if (g.type === "make") return q.station === "fire" ? { k: "fire" } : npc(q.station || q.giver);   // the recipe's station
  if (g.type === "elite" && g.mob && (!g.map || G.map?.id === g.map)) return { k: "mob", id: g.mob };
  if (q.targetMap) return { k: "map", id: q.targetMap };
  if (g.type === "kill") return { k: "mob", id: g.mob };
  if (g.type === "visit") return { k: "map", id: g.map };
  return g.mob ? { k: "mob", id: g.mob } : npc(q.giver, q.giverName);   // collect: the giver (where to find it is in the text)
}
const TUT = { talk: () => elder(), equip: () => npc("train"), buy: () => npc("shop"), hunt: () => ({ k: "mob", id: "twinhare" }),
  skill: () => ({ k: "mob", id: "twinhare" }), rest: () => ({ k: "fire" }), level: () => npc("train") };
function charmTarget(s) {
  const q = s.charms && s.charms.quest, d = G.defs.charms;
  if (!q || !d) return null;
  return q.st === 1 && q.n < q.need ? { k: "fit" } : npc(d.npc);
}
function dailyTarget(d) {
  if (!d || d.claimed || d.n >= d.need) return null;
  return d.kind === "kill" && d.k ? { k: "mob", id: d.k } : d.kind === "elite" ? { k: "fit" } : null;
}
/** A getter for objective `key` (G.qsel keys "main:i" "sq:id" "bq" "bq:k", and "job" "tut" "charm" "daily:i" "week" "coop:k" "popo"), or null. */
export function getter(key) {
  const [kind, arg] = key.split(":"), S = () => G.self;
  if (kind === "main") return () => S() && +arg === S().q.i ? mainTarget(S()) : null;
  if (kind === "sq") return () => S() && sideTarget(S(), arg);
  if (kind === "bq" && arg) return () => ({ k: "mob", id: arg });
  if (kind === "bq") return () => S() && S().bq && (S().bq.n < S().bq.need ? { k: "mob", id: S().bq.k } : elder());
  if (kind === "job") return () => S() && Board.trackTarget(S());
  if (kind === "tut") return () => { const s = S(), st = s && s.tut && (G.defs.tutorial || [])[s.tut.i]; return st && TUT[st.id] ? TUT[st.id]() : null; };
  if (kind === "charm") return () => S() && charmTarget(S());
  if (kind === "daily") return () => S() && S().daily && dailyTarget(S().daily.tasks[+arg]);
  if (kind === "week") return () => npc("dimkeeper");
  if (kind === "popo") return () => npc("popo");
  if (kind === "coop") return () => { const j = G.defs.coop && G.defs.coop.jobs[arg]; return j && npc(j[4]); };
  return null;
}
/** Does objective `key` have somewhere to go right now? */
export const can = (key) => { const g = getter(key), t = g && G.self && G.map && g(); return !!(t && goalMap(t)); };
/** The tracker's objectives in its order (the 알바 first): the key the hotkey takes when nothing is selected. */
function firstKey(s) {
  const keys = ["job"];
  const ch = (G.defs.side || []).find((q) => q.mainChapter && s.sq && s.sq.some(([id, v]) => id === q.id && v === 2));
  if (ch) keys.push(`sq:${ch.id}`);
  keys.push(`main:${s.q.i}`, "bq", "tut", "charm");
  if (s.daily) s.daily.tasks.forEach((_, i) => keys.push(`daily:${i}`));
  for (const [id, v] of s.sq || []) if (v === 2 || v === 3) keys.push(`sq:${id}`);
  return keys.find(can);
}
/** The hotkey: cancel the trip, else track the quest window's selected entry, else the first objective. */
export function toggle(selected) {
  if (tr) { stop("추적을 취소했습니다"); return; }
  const s = G.self;
  if (!s) return;
  const key = selected && can(selected) ? selected : firstKey(s);
  if (!key) { toast("추적할 목표가 없습니다"); return; }
  start(getter(key));
}
/** A small [추적] button for objective `key` (null when it has nowhere to go). */
export function button(key, label) {
  if (!can(key)) return null;
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn small trk"; b.textContent = "추적";
  b.title = `${label ? label + " — " : ""}목표까지 자동 이동 (${K("track")})`;
  b.addEventListener("pointerdown", (e) => e.stopPropagation());
  b.addEventListener("click", (e) => { e.stopPropagation(); start(getter(key), label); });
  return b;
}
/** Start-up wiring (client.js): the indicator's [취소]. */
export function setup() {
  const x = $("#track-x");
  if (x) x.addEventListener("click", () => stop("추적을 취소했습니다"));
}
