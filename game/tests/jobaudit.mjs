// The 알바 board audit (docs/design/life-and-coop.md, "알바 audit"): every JB row must be completable with the
// life content that exists — a `bring` item gathered (nodes, 텃밭 crops) or bought at the row's level, a `make`
// item from a recipe of the row's skill and level at a station some reachable map has (its inputs sourced too),
// a `fish` grade biting at that level on a reachable map with water, a `deliver` route between two placed NPCs
// walkable inside its limit at hero speed with the parcel's speed, a `hunt` monster living on a map open to that
// character level, `scout` maps that exist and are reachable, chores with enough spots, all reachable from the
// giver. A new dead row fails here. -v prints the material sources by grade (the coverage table).
// node tests/jobaudit.mjs [-v]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { JB, JB_WILLOW, CHORES, CHORE_MAP, chorePool, ITEMS, RECIPES, MAP_META, mapOf, lifeNodes, nodeMat, nodeLv, gradeOfMap," +
  " GRADE_LV, lifeGrade, FISH_G, FISH_MAP, lifePostAt, jbRoute, jbLimit, jbNeed, JB_GRADE, parcelSpd, BASE_SPD, HERO_SPD_K, MOBS, FIRES, START, legTiles, SHOP, SIDE };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16, VERBOSE = process.argv.includes("-v");

// ── the world a player can walk to: every map behind a door from the town
const reach = new Map();
for (const todo = [X.START.map]; todo.length;) {
  const id = todo.pop();
  if (reach.has(id) || !Object.hasOwn(X.MAP_META, id)) continue;
  const m = X.mapOf(id);
  if (!m) continue;
  reach.set(id, m);
  for (const pt of m.portals) if (typeof pt.to === "string") todo.push(pt.to);
}
const minLv = (id) => X.MAP_META[id].minLv | 0;

// ── where each thing comes from: src[item] = [{ how, lv (the skill level it needs), sk, map, cl (character level) }]
const srcs = {};
const add = (id, s) => (srcs[id] ||= []).push(s);
for (const [id, m] of reach) {
  for (const n of X.lifeNodes(m)) add(X.nodeMat(n), { how: n[0] === 3 ? "텃밭" : "node", sk: "gather", lv: X.nodeLv(n), map: id, cl: minLv(id) });
  if (!X.MAP_META[id].safe && (X.MAP_META[id].kinds || []).length) {
    const g = X.gradeOfMap(m);
    for (const k of ["h", "o", "w"]) add(`m_${k}${g}`, { how: "hunt", sk: null, lv: 0, map: id, cl: minLv(id) });
  }
  if (m.g.some((row) => row.includes("w"))) {
    const g = X.gradeOfMap(m);
    for (let k = 1; k <= g; k++) add(X.FISH_G[k - 1], { how: "fish", sk: "fish", lv: X.GRADE_LV[k - 1], map: id, cl: minLv(id) });
    add("fish_l", { how: "fish(carp)", sk: "fish", lv: 1, map: id, cl: minLv(id) });
    // this water's own fish (P8), from its grade's level
    if (Object.hasOwn(X.FISH_MAP, id) && X.ITEMS[X.FISH_MAP[id]].grade <= g) add(X.FISH_MAP[id], { how: "fish(local)", sk: "fish", lv: X.GRADE_LV[X.ITEMS[X.FISH_MAP[id]].grade - 1], map: id, cl: minLv(id) });
  }
  for (const n of m.npcs) if (n.role === "shop") for (const g of n.goods || X.SHOP) add(g, { how: "shop", sk: null, lv: 0, map: id, cl: minLv(id) });
}
const roles = new Set([...reach.values()].flatMap((m) => m.npcs.map((n) => n.role)));
const fires = [...reach.keys()].some((id) => (X.FIRES[id] || []).length) || roles.has("cook");
const stationOk = (at) => (at === "fire" ? fires : roles.has(at));
// recipe outputs, to a fixed point (an input made by another recipe counts once that one is sourced)
for (let more = true; more;) {
  more = false;
  for (const [k, r] of Object.entries(X.RECIPES)) {
    const out = r.out[0];
    if (out === "rune*" || (srcs[out] || []).some((s) => s.how === `recipe:${k}`)) continue;
    if (!stationOk(r.at) || !r.in.every(([id]) => id === "rune*" || srcs[id])) continue;
    add(out, { how: `recipe:${k}`, sk: r.sk, lv: r.lv, rep: r.rep, map: null, cl: 0 });
    more = true;
  }
}

// ── the rows
const dead = [], soft = [];
const npcAt = (id) => { const at = X.lifePostAt(id); return at && reach.has(at.m.id) ? at : null; };
const walkMs = (tiles, lv) => ((tiles * T) / (X.BASE_SPD * X.HERO_SPD_K * X.parcelSpd({ life: { deliver: { lv } } }))) * 1000;
for (const [id, t] of Object.entries(X.JB)) {
  const why = (s) => dead.push(`${id} (${t.kind} Lv.${t.lv}): ${s}`);
  if (!npcAt(t.npc)) why(`giver ${t.npc} is not on a reachable map`);
  // trust comes from that NPC's other 알바 only; a story row needs its side quest's answer to exist
  if (t.rep && !Object.values(X.JB).some((o) => !o.rep && (o.npc === t.npc || o.to === t.npc))) why(`trust with ${t.npc} cannot be earned (no open row of theirs)`);
  if (t.flag && !X.SIDE.some((q) => q.id === t.flag[0] && (q.choice || []).length > t.flag[1])) why(`story flag ${t.flag.join(":")} has no such answer`);
  if (t.kind === "bring" || t.kind === "fish") {
    const ok = (srcs[t.item] || []).filter((s) => !s.sk || (s.sk === t.sk && s.lv <= t.lv));
    if (!ok.length) why(`${t.item} has no source at ${t.sk} Lv.${t.lv} (${(srcs[t.item] || []).map((s) => `${s.how}@${s.map} Lv.${s.lv}`).slice(0, 3).join(", ") || "none"})`);
    else if (ok.every((s) => s.cl > 0)) soft.push(`${id}: ${t.item} only on maps from character Lv.${Math.min(...ok.map((s) => s.cl))}`);
  } else if (t.kind === "make") {
    const ok = (srcs[t.item] || []).filter((s) => s.how.startsWith("recipe:") && s.sk === t.sk && s.lv <= t.lv);
    if (!ok.length) why(`${t.item} has no ${t.sk} recipe at Lv.${t.lv} with its station and inputs`);
  } else if (t.kind === "deliver") {
    const A = npcAt(t.npc), B = npcAt(t.to), tiles = X.jbRoute(id);
    if (!B) why(`recipient ${t.to} is not on a reachable map`);
    else if (!Number.isFinite(tiles)) why(`no walkable route ${t.npc} → ${t.to}`);
    else {
      const lim = X.jbLimit(id, 2), w = walkMs(tiles, t.lv);
      if (!(w < lim)) why(`${tiles} tiles take ${Math.round(w / 1000)} s, the hardest limit is ${Math.round(lim / 1000)} s`);
    }
  } else if (t.kind === "hunt") {
    const at = [...reach.keys()].filter((m) => (X.MAP_META[m].kinds || []).includes(t.mob));
    if (!X.MOBS[t.mob]) why(`monster ${t.mob} does not exist`);
    else if (!at.length) why(`${t.mob} lives on no reachable map`);
    else if (!at.some((m) => minLv(m) <= t.lv)) why(`${t.mob} only on maps from Lv.${Math.min(...at.map(minLv))}`);
  } else if (t.kind === "scout") {
    for (const m of t.map) if (!reach.has(m)) why(`scout map ${m} is not reachable`);
    else if (minLv(m) > 1) soft.push(`${id}: ${m} needs character Lv.${minLv(m)}`);
  } else if (t.kind === "chore") {
    const c = X.CHORES[t.job], pool = X.chorePool(t.job), need = X.jbNeed(t, 2), at = X.lifePostAt(t.npc), m = X.mapOf(X.CHORE_MAP);
    if (!c) why(`chore ${t.job} does not exist`);
    else if (!at || at.m.id !== X.CHORE_MAP) why(`giver ${t.npc} is not on ${X.CHORE_MAP}`);
    else {
      if (pool.length < need) why(`${pool.length} ${c.spot} spots, the hardest grade needs ${need}`);
      const lost = pool.filter(([x, y]) => !Number.isFinite(X.legTiles(m, at.x, at.y, x, y)));
      if (lost.length) why(`${lost.length} spots cannot be walked to from the giver (${lost.slice(0, 3).map((s) => s.join(",")).join(" ")})`);
      if (c.src === "water" && !(m.g.some((r) => r.includes("w")) || m.big.some((b) => b.k === "well"))) why("no well or water to fill from");
    }
  } else why(`unknown kind ${t.kind}`);
}

// ── coverage: which grade of each material can be had where (the -v table) and the gaps by level band
const KIND = { h: "약초", o: "광석", w: "목재", c: "작물" };
const gaps = [];
for (const k of ["h", "o", "w"]) for (let g = 1; g <= 5; g++) {
  const id = `m_${k}${g}`, s = (srcs[id] || []).filter((x) => x.how === "hunt");
  if (VERBOSE) console.log(`  ${KIND[k]} ${g}등급 ${id}: ${s.length ? [...new Set(s.map((x) => `${x.map}[${X.MAP_META[x.map].band || "-"}]${x.cl ? `(Lv.${x.cl}+)` : ""}`))].join(" ") : "—"}`);
  if (!s.length) gaps.push(`${KIND[k]} ${g}등급 (${id}): no hunting ground drop`);
}
for (const [g, id] of X.FISH_G.entries()) {
  const s = (srcs[id] || []).filter((x) => x.how === "fish");
  if (VERBOSE) console.log(`  물고기 ${g + 1}등급 ${id} (낚시 Lv.${X.GRADE_LV[g]}+): ${[...new Set(s.map((x) => x.map))].join(" ") || "—"}`);
  if (!s.length) gaps.push(`물고기 ${g + 1}등급 (${id}): no water on a map of that grade`);
}
for (let c = 1; c <= 6; c++) if (!(srcs[`m_c${c}`] || []).length) gaps.push(`작물 m_c${c}: no 텃밭 plot`);
if (VERBOSE || soft.length) for (const s of soft) console.log(`  note ${s}`);
for (const g of gaps) console.log(`  gap ${g}`);
assert.deepEqual(dead, [], `dead 알바 rows:\n  ${dead.join("\n  ")}`);
// every material a row or a recipe asks for has a source
const asked = new Set([...Object.values(X.JB).map((t) => t.item), ...Object.values(X.RECIPES).flatMap((r) => r.in.map(([id]) => id))].filter((id) => id && id !== "rune*"));
const unsourced = [...asked].filter((id) => !srcs[id] && !/^mat_|^ru_|^stone$|^w_|^[a-z]_\d/.test(id));
assert.deepEqual(unsourced, [], `asked for, never obtainable: ${unsourced.join(" ")}`);
console.log(`jobaudit: ok — ${Object.keys(X.JB).length} rows, ${reach.size} reachable maps, ${gaps.length} coverage gaps`);
