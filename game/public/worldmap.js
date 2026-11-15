import { terrainIcon } from "./worldmap_art.js";
import { paintLandscape, terrainTrail, ATLAS_WIDTH, ATLAS_SOUTH } from "./worldmap_land.js";

const CELL_W = 142, CELL_H = 84, INSET_GAP = 86;
const names = { town: "마을", field: "사냥터", dun: "던전", in: "실내" };
const palette = { ink: "#473226", road: "#786a53", track: "#ffe8a0", selected: "#215758" };

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
  const outdoor = [...nodes.values()].filter(n => n.d.kind !== "in");
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
  const inner = [...nodes.values()].filter(n => n.d.kind === "in").sort((a, b) => a.d.name.localeCompare(b.d.name, "ko"));
  const width = Math.max(ATLAS_WIDTH, ...outdoor.map(n => n.x + 78));
  const south = Math.max(ATLAS_SOUTH, ...outdoor.map(n => n.y + 54));
  const cols = Math.max(1, Math.floor((width - 38) / CELL_W));
  inner.forEach((n, i) => {
    n.x = Math.round((i % cols + 0.5) * width / cols);
    n.y = south + INSET_GAP + Math.floor(i / cols) * 50;
  });
  const height = inner.length ? inner[inner.length - 1].y + 40 : south + 26;
  return { nodes, graph, edges: [...edges.values()], width, height, inset: inner.length ? south + 43 : null };
}

export function questMaps(defs, self, nodes) {
  const quests = new Map();
  const add = (id, title) => {
    if (!nodes.has(id)) return;
    if (!quests.has(id)) quests.set(id, []);
    quests.get(id).push(title);
  };
  const hunt = (k, title) => { for (const [id, { d }] of nodes) if (d.mobs?.includes(k) || d.bosses?.includes(k)) add(id, title); };
  const main = self?.q, q = main && defs.quests?.[main.i];
  if (q && main.st === 1) {
    if (main.n >= q.n) add(defs.questTurnIn?.map, q.title);
    else hunt(q.mob, q.title);
  }
  const bounty = self?.bq;
  if (bounty?.k) {
    if (bounty.n >= bounty.need) add(defs.questTurnIn?.map, "반복 의뢰");
    else hunt(bounty.k, "반복 의뢰");
  }
  const sides = new Map((defs.side || []).map(s => [s.id, s]));
  for (const [id, state] of self?.sq || []) {
    const side = sides.get(id);
    if (!side) continue;
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
const room = n => n.d.kind === "in";
export function wokeStones(d, self, woke) {
  if (unlockState(d, self) !== 4) return [];
  return Array.from({ length: d.wpn || 0 }, (_, i) => i).filter(i => woke(self, d.id, i));
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

const edgePath = (a, b, chart) => {
  if (room(a) !== room(b) && chart.inset !== null) {
    const middle = chart.inset - 8;
    const outer = room(a) ? b : a, inner = room(a) ? a : b;
    const rail = Math.max(35, Math.min(...[...chart.nodes.values()].filter(n => !room(n)).map(n => n.x)) - 78);
    const path = [[outer.x, outer.y], [rail, outer.y + 64], [rail, middle], [inner.x, middle], [inner.x, inner.y]];
    return room(a) ? path.reverse() : path;
  }
  return terrainTrail(a, b);
};

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
  if (chart.inset !== null) {
    pixel(g, 10, chart.inset - 2, chart.width - 20, chart.height - chart.inset - 7, "#796447");
    pixel(g, 14, chart.inset + 2, chart.width - 28, chart.height - chart.inset - 14, "#dfc794");
    pixel(g, 19, chart.inset + 5, chart.width - 38, 2, "#efdaad");
  }
  for (const { a, b, oneWay } of chart.edges) {
    const A = chart.nodes.get(a), B = chart.nodes.get(b), inner = room(A) || room(B);
    if (inner) continue;
    const path = edgePath(A, B, chart);
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
  if (chart.inset !== null) {
    g.font = "bold 11px Galmuri11, sans-serif"; g.fillStyle = palette.ink; g.textAlign = "start"; g.textBaseline = "alphabetic";
    g.fillText("건물과 실내", ox + 26 * scale, oy + (chart.inset + 18) * scale);
  }
  for (let i = 1; i < route.length; i++) {
    const path = edgePath(chart.nodes.get(route[i - 1]), chart.nodes.get(route[i]), chart).map(p => screen({ x: p[0], y: p[1] }));
    edge(g, path, palette.selected, 6);
    edge(g, path, palette.track, 2);
  }
  const hits = [];
  const text = (s, x, y, width, color, size, bold = false) => {
    g.font = `${bold ? "bold " : ""}${size}px Galmuri11, sans-serif`;
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "top";
    g.fillText(s, x, y, width);
  };
  for (const [id, n] of chart.nodes) {
    const { d } = n, [x, y] = screen(n), inside = room(n), hitW = Math.min(146, CELL_W * scale - 3);
    const cur = current === id, known = cur || seen.has(id), sel = selected === id;
    const locked = unlockState(d, self) !== 4;
    const stoneCount = wokeStones(d, self, woke).length;
    const members = party.get(id) || [], todo = quests.get(id) || [];
    const art = terrainIcon(d.art || d.theme, d.kind);
    const drawW = Math.round((inside ? 35 : 68) * scale), drawH = Math.round(drawW * art.height / art.width);
    const labelY = inside ? y + 1 : y + Math.round(13 * scale);
    const top = inside ? y - 20 * scale : y - 39 * scale;
    const low = labelY + (inside ? 13 : 26);
    const sub = `${band(d)}${locked ? " · 구조 대기" : d.wpn ? ` · ◆${stoneCount}/${d.wpn}` : ""}`;
    g.font = `bold ${inside ? 10 : 12}px Galmuri11, sans-serif`;
    const nameWidth = g.measureText(d.name).width;
    g.font = "10px Galmuri11, sans-serif";
    const labelW = Math.min(hitW - 4, Math.max(drawW + 10, nameWidth + 10, inside ? 0 : g.measureText(sub).width + 10));
    const left = x - labelW / 2;
    if (!inside) {
      const edge = sel ? palette.selected : cur ? "#8f5d36" : "#9a865f";
      const cloth = sel ? "#fbebc8" : known ? "#f1dfb3" : "#e6d6b4";
      pixel(g, left - 1, labelY - 2, labelW + 2, low - labelY + 2, edge);
      pixel(g, left + 1, labelY - 3, labelW - 2, low - labelY + 4, edge);
      pixel(g, left + 1, labelY - 1, labelW - 2, low - labelY + 1, cloth);
      if (sel || cur) {
        pixel(g, left - 3, labelY + 5, 3, 5, edge);
        pixel(g, left + labelW, labelY + 5, 3, 5, edge);
      }
    } else if (sel || cur) {
      pixel(g, left, labelY - 2, labelW, low - labelY + 2, "#f3e2b5");
    }
    g.globalAlpha = known ? 1 : 0.88;
    g.drawImage(art, Math.round(x - drawW / 2), Math.round(labelY - drawH - 1), drawW, drawH);
    g.globalAlpha = 1;
    text(d.name, x, labelY, Math.max(1, labelW - 6), known ? palette.ink : "#725a45", inside ? 10 : 12, true);
    if (!inside) text(sub, x, labelY + 14, Math.max(1, labelW - 5), stoneCount ? "#245a55" : "#6a5038", 10);
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
    members.forEach(({ n: i, col }, j) => {
      const xx = x - drawW / 2 + 12 * j;
      pixel(g, xx - 6, markerY + 4, 11, 12, palette.ink);
      pixel(g, xx - 5, markerY + 5, 9, 10, col);
      text(String(i), xx, markerY + 6, 8, "#20152a", 9, true);
    });
    const tip = [d.name, names[d.kind], band(d), !known && "미방문", d.wpn && `이동의 돌 ${stoneCount}/${d.wpn}`,
      members.length && `파티원 ${members.map(p => p.name).join(", ")}`, todo.length && `의뢰 ${todo.join(", ")}`].filter(Boolean).join(" · ");
    hits.push({ id, rect: [x - hitW / 2, top, hitW, low - top], tip });
  }
  g.textAlign = "start";
  return hits;
}

export function mapDetail(host, d, ctx) {
  const { defs, chart, state, canWarp, travel, select } = ctx;
  const { current, route, quests, self, woke, seen } = state;
  const E = (tag, text, cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
  const nameOf = id => chart.nodes.get(id)?.d.name || "";
  const addRow = (root, key, value) => { if (value) root.append(E("div", key, "map-detail-key"), E("div", value)); };
  const head = E("div", "", "map-detail-head");
  head.append(E("strong", d.name), E("span", [names[d.kind], band(d), d.id === current ? "현재 위치" : !seen.has(d.id) ? "미방문" : ""].filter(Boolean).join(" · ")));
  const unlock = unlockState(d, self), chapter = defs.side?.find(q => q.id === d.unlockQuest);
  const path = route.length > 1 ? route.map(nameOf).join(" → ") : d.id === current ? "지금 이 지역에 있습니다" : "현재 갈 수 있는 문 경로가 없습니다";
  const guide = E("p", path, "map-guide");
  const open = wokeStones(d, self, woke), ways = defs.waypoints?.find(w => w.id === d.id);
  const stones = E("div", "", "map-detail-buttons map-fast-travel");
  if (d.wpn) {
    const levelLocked = d.minLv && (self?.lvl || 0) < d.minLv;
    stones.append(E("strong", `빠른 이동 ${open.length}/${d.wpn}`));
    if (!open.length) stones.append(E("span", "이동의 돌에 다가가면 해금됩니다"));
    else for (const i of open) {
      const button = E("button", `${ways?.names?.[i] || `이동의 돌 ${i + 1}`} 이동`);
      button.type = "button"; button.disabled = !!levelLocked || !canWarp;
      button.title = levelLocked ? `Lv.${d.minLv}에 이용할 수 있습니다` : canWarp ? "" : "이동의 돌 곁에서 이용할 수 있습니다";
      button.addEventListener("click", () => travel(d.id, i)); stones.append(button);
    }
    if (open.length && (!canWarp || levelLocked)) stones.append(E("span", levelLocked ? `Lv.${d.minLv} 필요` : "이동의 돌 곁에서 사용 가능"));
  }
  const body = E("div", "", "map-detail-grid");
  if (chapter) addRow(body, "승선", unlock === 4 ? "해방된 갑판 · 무기 상점과 선원 의뢰"
    : unlock >= 2 ? `${chapter.giverMap} 승선장에서 구조에 나서세요`
    : `${chapter.giverMap}의 ${chapter.giverName}에게서 [${chapter.title}] 수락`);
  const mobName = id => defs.mobs?.[id]?.name || "";
  addRow(body, "몬스터", (d.mobs || []).filter(id => !defs.mobs?.[id]?.boss && !defs.mobs?.[id]?.chest).map(mobName).filter(Boolean).join(", "));
  addRow(body, "보스", (d.bosses || []).map(mobName).filter(Boolean).join(", "));
  const grade = defs.life?.mapGrade?.[d.id];
  if (grade && d.kind !== "in") addRow(body, "채집", `${grade}등급`);
  addRow(body, "의뢰", quests.get(d.id)?.join(", "));
  const doors = E("div", "", "map-detail-buttons");
  for (const id of chart.graph.get(d.id)) {
    const button = E("button", nameOf(id)); button.addEventListener("click", () => select(id, true)); doors.append(button);
  }
  if (doors.childElementCount) body.append(E("div", "연결", "map-detail-key"), doors);
  host.replaceChildren(head, guide, ...(d.wpn ? [stones] : []), body);
}
