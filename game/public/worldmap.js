import { terrainIcon } from "./worldmap_art.js";
import { paintLandscape, terrainTrail, ATLAS_WIDTH, ATLAS_SOUTH } from "./worldmap_land.js";

const CELL_W = 142, CELL_H = 84;
const names = { town: "마을", field: "사냥터", dun: "던전", in: "실내" };
const palette = { ink: "#473226", road: "#786a53", track: "#ffe8a0", selected: "#215758" };
const room = n => n.d.kind === "in";

/** Directed traversal; the chart separately draws each physical pair once. */
export function shortestRoute(graph, start, end, allowed = () => true) {
  if (!graph.has(start) || !graph.has(end)) return [];
  const parents = new Map([[start, null]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    if (from === end) {
      const path = [];
      for (let id = end; id !== null; id = parents.get(id)) path.push(id);
      return path.reverse();
    }
    for (const to of graph.get(from)) if (!parents.has(to) && allowed(to)) {
      parents.set(to, from);
      queue.push(to);
    }
  }
  return [];
}

export function mapChart(maps) {
  const nodes = new Map(maps.map(d => [d.id, { d }]));
  const graph = new Map(maps.map(d => [d.id, (d.to || []).filter(id => id !== d.id && nodes.has(id))]));
  const pairKey = (a, b) => JSON.stringify(a < b ? [a, b] : [b, a]);
  const edges = new Map(), adjacent = new Map(maps.map(d => [d.id, new Set()]));
  for (const [a, list] of graph) for (const b of list) {
    adjacent.get(a).add(b); adjacent.get(b).add(a);
    const key = pairKey(a, b);
    if (edges.has(key)) continue;
    edges.set(key, { a, b, oneWay: !graph.get(b).includes(a) });
  }
  const outdoor = [...nodes.values()].filter(n => !room(n));
  for (const n of outdoor) if (n.d.pos) [n.x, n.y] = n.d.pos;
  if (outdoor.length && !outdoor.some(n => n.x !== undefined)) {
    outdoor[0].x = CELL_W;
    outdoor[0].y = CELL_H;
  }
  const fits = (x, y) => x >= 66 && y >= 52 && !outdoor.some(n => Math.abs(n.x - x) < CELL_W && Math.abs(n.y - y) < CELL_H);
  const free = (x, y) => {
    for (let ring = 1; ; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const p = [x + dx * CELL_W, y + dy * CELL_H];
      if (fits(...p)) return p;
    }
  };
  const pending = outdoor.filter(n => n.x === undefined);
  while (pending.length) {
    const linked = n => [...adjacent.get(n.d.id)].map(id => nodes.get(id)).find(a => a.x !== undefined);
    const i = pending.findIndex(linked), n = pending.splice(Math.max(i, 0), 1)[0];
    const a = linked(n) || outdoor[0];
    [n.x, n.y] = free(a.x ?? CELL_W, a.y ?? CELL_H);
  }
  const width = Math.max(ATLAS_WIDTH, ...outdoor.map(n => n.x + 78));
  const south = Math.max(ATLAS_SOUTH, ...outdoor.map(n => n.y + 54));
  const queue = outdoor.map(({ d }) => d.id);
  const anchors = new Map(queue.map(id => [id, id]));
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    for (const id of adjacent.get(from)) if (!anchors.has(id)) {
      anchors.set(id, anchors.get(from));
      queue.push(id);
    }
  }
  return { nodes, graph, edges: [...edges.values()], outdoor, anchors, width, height: south + 26 };
}

/** Resolve regional building destinations against the actual live entrance tiles. */
export function buildingDoors(map, maps) {
  const here = maps.find(d => d.id === map.id);
  if (!map.safe || here?.kind !== "town") return [];
  const interiors = maps.filter(d => d.kind === "in" && here.to.includes(d.id));
  const named = new Map((here.doors || []).map(([x, y, to]) => [`${x},${y}`, to]));
  const buildings = new Map();
  for (const p of map.portals || []) {
    if (!p.door) continue;
    const to = named.get(`${p.x},${p.y}`);
    const d = interiors.find(d => to ? d.id === to : p.to === d.name || p.to === d.gateLabel);
    if (!d) continue;
    if (!buildings.has(d.id)) buildings.set(d.id, { id: d.id, name: d.name, tiles: [] });
    buildings.get(d.id).tiles.push([p.x, p.y]);
  }
  return [...buildings.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export function questMaps(defs, self, nodes, anchor = id => id) {
  const quests = new Map();
  const add = (id, title) => {
    id = anchor(id);
    if (!nodes.has(id)) return;
    if (!quests.has(id)) quests.set(id, []);
    if (!quests.get(id).includes(title)) quests.get(id).push(title);
  };
  const hunt = (k, title) => { for (const [id, { d }] of nodes) if (d.mobs?.includes(k) || d.bosses?.includes(k)) add(id, title); };
  const main = self?.q, q = main && defs.quests?.[main.i];
  if (q && main.st === 1) {
    if (main.n >= q.n) add(defs.questTurnIn?.map, q.title);
    else hunt(q.mob, q.title);
  }
  const bounty = self?.bq;
  if (bounty?.k) {
    if (bounty.n >= bounty.need) add(defs.questTurnIn?.map, "반복 토벌");
    else hunt(bounty.k, "반복 토벌");
  }
  const sides = new Map((defs.side || []).map(s => [s.id, s]));
  quests.avail = new Map();   // map id -> count of side quests that can be taken there now (drawn as a blue "!")
  for (const [id, state] of self?.sq || []) {
    const side = sides.get(id);
    if (!side) continue;
    if (state === 1 && !side.mainChapter) { const a = anchor(side.giverMapId); if (nodes.has(a)) quests.avail.set(a, (quests.avail.get(a) || 0) + 1); }
    if (side.mainChapter && state === 1) add(side.giverMapId, side.title);
    if (state === 3) add(side.giverMapId, side.title);
    else if (state === 2 && side.mainChapter && side.targetMap) add(side.targetMap, side.title);
    else if (state === 2 && side.goal.type === "kill") hunt(side.goal.mob, side.title);
    else if (state === 2) add(side.targetMap, side.title);
  }
  return quests;
}

const band = d => d.minLv ? `Lv.${d.minLv} ${d.unlockQuest ? "이상" : "전용"}` : d.band ? `Lv.${d.band[0]}–${d.band[1]}` : d.safe ? "안전 지대" : names[d.kind];
export const unlockState = (d, self) => d.unlockQuest ? self?.sq?.find(([id]) => id === d.unlockQuest)?.[1] || 0 : 4;
export function wokeStones(d, self, woke) {
  if (unlockState(d, self) !== 4) return [];
  return Array.from({ length: d.wpn || 0 }, (_, i) => i).filter(i => woke(self, d.id, i));
}

/** Compute regional exploration progress % and breakdown (WLD-06). */
export function exploreInfo(d, defs, self, woke = () => false, seenSet = null) {
  const seen = seenSet ? seenSet.has(d.id) : !!(self?.seen || []).includes(d.id);
  let got = seen ? 1 : 0, total = 1;
  const parts = [];
  if (d.wpn) {
    const open = wokeStones(d, self, woke).length;
    got += open; total += d.wpn;
    parts.push(`이동의 돌 ${open}/${d.wpn}`);
  }
  const colMobs = defs?.collection?.[d.id]?.mobs || [];
  if (colMobs.length) {
    const need = defs.colNeed || 30, mk = self?.mk || {};
    const reg = colMobs.filter(k => (mk[k] || 0) >= need).length;
    got += reg; total += colMobs.length;
    parts.push(`도감 ${reg}/${colMobs.length}`);
  }
  const bosses = d.bosses || [];
  if (bosses.length) {
    const tro = self?.tro || [], mk = self?.mk || {};
    const killed = bosses.filter(k => tro.includes(k) || (mk[k] || 0) > 0).length;
    got += killed; total += bosses.length;
    parts.push(`보스 ${killed}/${bosses.length}`);
  }
  const pct = total > 0 ? Math.min(100, Math.round((got / total) * 100)) : 0;
  return { pct, got, total, summary: parts.join(" · ") || (seen ? "방문 완료" : "미방문") };
}

/** Current-map portal labels are supplied by the same rules as the map definitions. */
export function nextGate(portals, target, px, py) {
  let best = null, score = Infinity;
  for (const p of portals) {
    if (!p.mapIds?.includes(target.id) && p.to !== target.name && p.to !== target.gateLabel) continue;
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < score) { best = p; score = d; }
  }
  return best;
}

const pixel = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/** Square brush so diagonal trails stay pixel-art at fractional map zoom. */
function edge(g, points, col, size, dash = false) {
  let travel = 0;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1], [xx, yy] = points[i], n = Math.max(Math.abs(xx - x), Math.abs(yy - y));
    if (!n) continue;
    for (let j = 0; j <= n; j++) {
      if (dash && (travel + j) % 13 >= 7) continue;
      pixel(g, x + (xx - x) * j / n - size / 2, y + (yy - y) * j / n - size / 2, size, size, col);
    }
    travel += n;
  }
}

export function chartBase(chart, makeCanvas) {
  const canvas = makeCanvas(chart.width, chart.height), g = canvas.getContext("2d");
  paintLandscape(g, chart);
  for (const { a, b, oneWay } of chart.edges) {
    const A = chart.nodes.get(a), B = chart.nodes.get(b), inner = room(A) || room(B);
    if (inner) continue;
    const path = terrainTrail(A, B);
    const tunnel = A.d.kind === "dun" && A.d.id !== "frostkeep" || B.d.kind === "dun" && B.d.id !== "frostkeep";
    edge(g, path, palette.road, tunnel ? 4 : 6, tunnel);
    edge(g, path, tunnel ? "#dec99f" : "#ecdaa7", tunnel ? 2 : 3, tunnel);
    if (oneWay) {
      const i = path.length >> 1, [x, y] = path[i - 1], [xx, yy] = path[i];
      if (x === xx && y === yy) continue;
      const ax = (x + xx) / 2, ay = (y + yy) / 2, angle = Math.atan2(yy - y, xx - x);
      for (const offset of [-0.75, 0.75]) edge(g, [[ax - 8 * Math.cos(angle + offset), ay - 8 * Math.sin(angle + offset)], [ax, ay]], palette.ink, 3);
    }
  }
  return canvas;
}

export function paintChart(g, chart, base, cam, state) {
  const { scale, ox, oy } = cam, { selected, current, seen, quests, party, route, woke, self, t } = state;
  const screen = n => [Math.round(ox + n.x * scale), Math.round(oy + n.y * scale)];
  g.drawImage(base, Math.round(ox), Math.round(oy), Math.round(chart.width * scale), Math.round(chart.height * scale));
  for (let i = 1; i < route.length; i++) {
    const a = chart.nodes.get(route[i - 1]), b = chart.nodes.get(route[i]);
    if (room(a) || room(b)) continue;
    const path = terrainTrail(a, b).map(([x, y]) => screen({ x, y }));
    edge(g, path, palette.selected, 6);
    edge(g, path, palette.track, 2);
  }
  const hits = [];
  const text = (s, x, y, width, color, size, bold = false) => {
    g.font = `${bold ? "bold " : ""}${size}px Galmuri11, sans-serif`;
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "top";
    g.fillText(s, x, y, width);
  };
  for (const n of chart.outdoor) {
    const { d } = n, { id } = d, [x, y] = screen(n), hitW = Math.min(146, CELL_W * scale - 3);
    const cur = current === id, known = cur || seen.has(id), sel = selected === id;
    const locked = unlockState(d, self) !== 4;
    const stoneCount = wokeStones(d, self, woke).length;
    const members = party.get(id) || [], todo = quests.get(id) || [];
    const art = terrainIcon(d.art || d.theme, d.kind);
    const drawW = Math.round(68 * scale), drawH = Math.round(drawW * art.height / art.width);
    const labelY = y + Math.round(13 * scale), top = y - 39 * scale, low = labelY + 26;
    const sub = `${band(d)}${locked ? " · 구조 대기" : d.wpn ? ` · ◆${stoneCount}/${d.wpn}` : ""}`;
    g.font = "bold 12px Galmuri11, sans-serif";
    const nameWidth = g.measureText(d.name).width;
    g.font = "10px Galmuri11, sans-serif";
    const labelW = Math.min(hitW - 4, Math.max(drawW + 10, nameWidth + 10, g.measureText(sub).width + 10));
    const left = x - labelW / 2;
    const border = sel ? palette.selected : cur ? "#8f5d36" : "#9a865f";
    const cloth = sel ? "#fbebc8" : known ? "#f1dfb3" : "#e6d6b4";
    pixel(g, left - 1, labelY - 2, labelW + 2, low - labelY + 2, border);
    pixel(g, left + 1, labelY - 3, labelW - 2, low - labelY + 4, border);
    pixel(g, left + 1, labelY - 1, labelW - 2, low - labelY + 1, cloth);
    if (sel || cur) {
      pixel(g, left - 3, labelY + 5, 3, 5, border);
      pixel(g, left + labelW, labelY + 5, 3, 5, border);
    }
    g.globalAlpha = known ? 1 : 0.88;
    g.drawImage(art, Math.round(x - drawW / 2), Math.round(labelY - drawH - 1), drawW, drawH);
    g.globalAlpha = 1;
    text(d.name, x, labelY, Math.max(1, labelW - 6), known ? palette.ink : "#725a45", 12, true);
    text(sub, x, labelY + 14, Math.max(1, labelW - 5), stoneCount ? "#245a55" : "#6a5038", 10);
    const markerY = Math.round(labelY - Math.max(5, drawH - 4));
    if (cur) {
      const p = Math.floor(t / 440) % 2;
      pixel(g, x - 5, markerY - 9 - p, 10, 10, palette.ink);
      pixel(g, x - 3, markerY - 7 - p, 6, 6, "#ffdf69");
    }
    if (todo.length) {
      pixel(g, x + drawW / 2 - 4, markerY, 10, 13, "#5b392d");
      text("!", x + drawW / 2 + 1, markerY + 1, 8, "#ffdf69", 10, true);
    }
    const avail = quests.avail?.get(id) || 0;
    if (avail) {
      const bw = avail > 9 ? 20 : 14;   // two-digit counts need a wider badge
      pixel(g, x - drawW / 2 - 6, markerY - 14, bw, 13, "#1c2f5a");
      text(`!${avail}`, x - drawW / 2 - 6 + bw / 2, markerY - 13, bw - 2, "#8ccfff", 10, true);
    }
    members.forEach(({ n: i, col }, j) => {
      const xx = x - drawW / 2 + 12 * j;
      pixel(g, xx - 6, markerY + 4, 11, 12, palette.ink);
      pixel(g, xx - 5, markerY + 5, 9, 10, col);
      text(String(i), xx, markerY + 6, 8, "#20152a", 9, true);
    });
    const exp = state.defs ? exploreInfo(d, state.defs, self, woke, seen) : null;
    const tip = [d.name, names[d.kind], band(d), !known ? "미방문" : exp ? `탐험 ${exp.pct}%` : "", d.wpn && `이동의 돌 ${stoneCount}/${d.wpn}`,
      members.length && `파티원 ${members.map(p => p.name).join(", ")}`, todo.length && `의뢰 ${todo.join(", ")}`].filter(Boolean).join(" · ");
    hits.push({ id, rect: [x - hitW / 2, top, hitW, low - top], tip });
  }
  g.textAlign = "start";
  return hits;
}

function formatRespawn(sec) {
  if (!sec || sec <= 0) return "출현 중";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `재출현 ${m}분 ${s}초` : `재출현 ${s}초`;
}

export function mapDetail(host, d, ctx) {
  const { defs, chart, state, canWarp, travel, select, walk, preview } = ctx;
  const { current, route, quests, self, woke, seen } = state;
  const E = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const nameOf = id => chart.nodes.get(id)?.d.name || "";
  const addRow = (root, key, value) => { if (value) root.append(E("div", key, "map-detail-key"), E("div", value)); };
  const exp = exploreInfo(d, defs, self, woke, seen);
  const head = E("div", "", "map-detail-head");
  head.append(E("strong", d.name), E("span", [names[d.kind], band(d), d.id === current ? "현재 위치" : !seen.has(d.id) ? "미방문" : `탐험 ${exp.pct}%`].filter(Boolean).join(" · ")));
  const unlock = unlockState(d, self), chapter = defs.side?.find(q => q.id === d.unlockQuest);
  const path = route.length > 1 ? route.map(nameOf).join(" → ") : d.id === current ? "지금 이 지역에 있습니다" : "현재 갈 수 있는 문 경로가 없습니다";
  const guide = E("p", path, "map-guide");
  if (walk && d.id !== current) {
    const go = E("button", "걸어서 이동", "btn gold small");
    go.type = "button"; go.title = "문을 따라 자동으로 걸어갑니다 (움직이면 취소) · 지역을 두 번 눌러도 됩니다";
    go.addEventListener("click", () => walk(d.id));
    guide.append(" ", go);
  }
  if (preview) {
    const look = E("button", "전체 지도", "btn small");
    look.type = "button"; look.title = "이 지역의 전체 모습과 이동의 돌·모닥불·NPC 위치를 봅니다";
    look.addEventListener("click", () => preview(d.id));
    guide.append(" ", look);
  }
  const open = wokeStones(d, self, woke), ways = defs.waypoints?.find(w => w.id === d.id);
  const stones = E("div", "", "map-detail-buttons map-fast-travel");
  if (d.wpn) {
    const levelLocked = d.minLv && (self?.lvl || 0) < d.minLv;
    stones.append(E("strong", `빠른 이동 ${open.length}/${d.wpn}`));
    if (!open.length) stones.append(E("span", "이동의 돌에 다가가면 해금됩니다"));
    else for (const i of open) {
      const label = d.wpn === 1 ? "순간이동" : `${ways?.names?.[i] || `이동의 돌 ${i + 1}`} 이동`;
      const button = E("button", label, "btn gold small");
      button.type = "button"; button.disabled = !!levelLocked || !canWarp;
      button.title = levelLocked ? `Lv.${d.minLv}에 이용할 수 있습니다` : canWarp ? "" : "레이드던전·협동 알바 중에는 이용할 수 없습니다";
      button.addEventListener("click", () => travel(d.id, i)); stones.append(button);
    }
    if (open.length && (!canWarp || levelLocked)) stones.append(E("span", levelLocked ? `Lv.${d.minLv} 필요` : "레이드던전·협동 알바 중 사용 불가"));
  }
  const body = E("div", "", "map-detail-grid");
  if (chapter) addRow(body, "승선", unlock === 4 ? "해방된 갑판 · 무기 상점과 선원 의뢰"
    : unlock >= 2 ? `${chapter.giverMap} 승선장에서 구조에 나서세요`
    : `${chapter.giverMap}의 ${chapter.giverName}에게서 [${chapter.title}] 수락`);
  addRow(body, "탐험률", `${exp.pct}% (${exp.summary})`);
  const mobName = id => defs.mobs?.[id]?.name || "";
  addRow(body, "몬스터", (d.mobs || []).filter(id => !defs.mobs?.[id]?.boss && !defs.mobs?.[id]?.chest).map(mobName).filter(Boolean).join(", "));
  if (d.bosses?.length) {
    const fbWait = self?.fbMap?.[d.id];
    const status = fbWait !== undefined ? ` (${formatRespawn(fbWait)})` : "";
    addRow(body, "보스", d.bosses.map(id => `${mobName(id)}${status}`).filter(Boolean).join(", "));
  }
  const grade = defs.life?.mapGrade?.[d.id];
  if (grade && d.kind !== "in") {
    const mats = Object.values(defs.items || {}).filter(it => it.type === "lmat" && it.grade === grade).map(it => it.name).slice(0, 4);
    addRow(body, "재료 드랍", mats.length ? `${grade}등급 (${mats.join(", ")})` : `${grade}등급`);
  }
  if (!d.safe && d.kind === "field") {
    addRow(body, "특수 생태", "밤: 달빛정령 탈루나 · 비: 비구름 도글란 (재료·룬 드랍↑)");
  }
  addRow(body, "의뢰", quests.get(d.id)?.join(", "));
  const doors = E("div", "", "map-detail-buttons");
  for (const id of chart.graph.get(d.id)) {
    if (room(chart.nodes.get(id))) continue;
    const button = E("button", nameOf(id)); button.addEventListener("click", () => select(id, true)); doors.append(button);
  }
  if (doors.childElementCount) body.append(E("div", "연결", "map-detail-key"), doors);
  host.replaceChildren(head, guide, ...(d.wpn ? [stones] : []), body);
}
