// The game side of the world map editor (docs/editor/SCHEMA.md), as plain importable node:
// what the editor server needs to know about the game's maps, palette and tables, and the
// full check of game/data/**. Pure node, no dependencies; works on Windows.
//
//   import { palette, mapToEditor, defsForEditor, checkData, listMaps } from "./editor-lib.mjs";
//   await palette()                    → { ground: [{ch, name, color, solid, themes}], objects: [...] }
//   await mapToEditor(id, opts?)       → editor JSON of a map (default: the GENERATED map, ignoring data/;
//                                        opts.withData: the map as the game builds it with data/)
//   await defsForEditor()              → { mobs, items, roles, themes, bgm, maps, npcs, quests }
//   await listMaps(dataDir?)           → [{ id, name, builtin, custom, replaces, w, h, theme }]
//   await checkData(dataDir?)          → { ok, errors: [{file, path, msg}], warnings: [...] }
//   await loadLogic({ dataDir?, data? }) → the rules module built with that data, plus `__editor`
//                                        (MAPS MAP_META FIRES WP FIELD_BOSS MOBS ITEMS QUESTS ...)
//
// All of them are async (the rules are evaluated from text so any data set can be tried
// without touching src/logic.js). Signatures are stable: the editor server imports them.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { buildLogic, readData, EMPTY_DATA, ROOT, DATA_DIR } from "./build-logic.mjs";

export { DATA_DIR, ROOT };

// (MAPS: every map built — the rules build the generated ones only on first use)
const EXTRA = "\nexport const __editor = { get MAPS() { return allMaps(); }, MAP_META, FIRES, WP, FIELD_BOSS, MOBS, ITEMS, QUESTS, SOLID_G, THEMES, NPC_ROLES, BUILTIN_MAPS, NPC_MAP, DATA, COL_MOBS, SIDE: typeof SIDE === 'undefined' ? [] : SIDE, mapPayload };\n";
const cache = new Map();

/** The rules evaluated with a data set (default: data/**); cached by content. */
export async function loadLogic(opts = {}) {
  const { text, problems } = buildLogic(opts.data ? { data: opts.data } : { dataDir: opts.dataDir || DATA_DIR });
  const src = text + EXTRA;
  const key = createHash("sha1").update(src).digest("hex");
  if (!cache.has(key)) {
    if (cache.size > 8) cache.clear();
    cache.set(key, import("data:text/javascript;base64," + Buffer.from(src).toString("base64")));
  }
  const L = await cache.get(key);
  return Object.assign(Object.create(L), { L, problems, E: L.__editor });
}
/** The rules with no editor data at all: the generated world. */
const pure = () => loadLogic({ data: EMPTY_DATA() });

// ───────────────────────────── palette ─────────────────────────────

/** Korean names for every ground character the game draws. */
const GROUND_NAME = {
  ".": "풀밭", ",": "짧은 풀", '"': "꽃밭", t: "긴 풀", ":": "숲 바닥", ";": "고사리 덤불 바닥", p: "흙길", o: "돌 광장", s: "모래·물가",
  w: "물 (못 건넘)", b: "나무 다리·부두", r: "자갈 바닥", v: "폐허 바닥·돌계단", j: "늪", c: "동굴·던전 바닥", d: "던전 바닥 (어수선)",
  n: "지하묘지 통로", i: "지하묘지 둥근 바닥", W: "암벽·낭떠러지 (못 건넘)", k: "보도", a: "아스팔트", m: "차선", g: "철판·배수 바닥",
  "=": "왕도 포석", "%": "낙엽 더미", "&": "병든 땅",
  // indoors (theme "interior", public/iso_interior.js)
  f: "실내 마루 (밝은 나무)", l: "실내 마루 (호두나무)", x: "벽난로 앞 돌바닥", q: "체크무늬 깔개", u: "둥근 깔개", y: "긴 카펫 (러너)", e: "현관 매트",
};
/** Korean names for every object character (any object blocks the tile). */
const OBJECT_NAME = {
  T: "활엽수", P: "침엽수", B: "덤불 (마을: 화분·통)", R: "바위", C: "낭떠러지 바위", H: "생울타리", F: "나무 울타리", U: "무너진 돌벽",
  h: "집 (4×3 칸)", L: "가로등", G: "표지판", Q: "이동의 돌", E: "천막", a: "분수", e: "갈대 (물 위)", l: "쓰러진 통나무", u: "그루터기",
  q: "부서진 기둥", O: "선돌", A: "죽은 나무", Y: "큰 버섯", K: "수정", S: "종유석", M: "광석 수레", n: "잡동사니 더미", D: "쓰레기통",
  x: "콘크리트 블록", y: "소화전", Z: "콘크리트 벽", c: "자동차", I: "예배당 의자", 0: "살덩이 눈자루", 1: "석관", 2: "세워 둔 관",
  3: "촛대", 4: "뼈 무더기", 5: "해골 기둥", 6: "배수관", 7: "녹슨 드럼통", 8: "솟은 갈비뼈", 9: "제단", X: "피의 제단",
  J: "기운 묘비", V: "썩은 왕국 깃발", z: "옛 왕의 석상", N: "무너진 예배당 (4×2 칸)", d: "초가 오두막 (3×2 칸)", i: "무너진 망루 (3×2 칸)", f: "쓰러진 왕도 성문 (4×2 칸)",
  // indoors: back walls (north row / west column), the cut-down front wall, furniture (any theme draws them)
  "=": "실내 벽", "+": "실내 벽 (창문)", "^": "실내 벽 (칠판 메뉴)", "~": "실내 벽 (그림·지도)", "@": "실내 벽 (벽시계)", "!": "실내 벽 (깃발)", _: "잘린 앞벽 (낮은 벽)",
  o: "둥근 탁자 (등불)", k: "의자 (탁자를 향함)", s: "안락의자", m: "카운터", j: "카운터 (커피 머신)", "$": "빵 진열장", b: "책장", r: "찬장 (병·시계)", t: "트로피 진열장",
  "#": "벽난로", g: "화분", "*": "등불 기둥", v: "게시판", "-": "긴 탁자", p: "침대", w: "나무통", "]": "나무 상자", "%": "잠자는 고양이 (방석)",
};
/** The colours the minimap uses (public/art.js renderMini), read from the client source so they never drift. */
function miniColours() {
  const src = readFileSync(join(ROOT, "public", "art.js"), "utf8");
  const grab = (name) => {
    const m = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`).exec(src);
    // the tables are plain object literals of strings: evaluate them alone
    return m ? Function(`"use strict"; return (${m[1]});`)() : {};
  };
  return { MINI: grab("MINI"), MINI_OBJ: grab("MINI_OBJ"), MINI_THEME: grab("MINI_THEME") };
}
/** audio.js TRACKS keys, plus its aliases. */
function bgmKeys() {
  const src = readFileSync(join(ROOT, "public", "audio.js"), "utf8");
  const start = src.indexOf("const TRACKS = {"), end = src.indexOf("const ALIAS", start);
  const keys = [...src.slice(start, end).matchAll(/^ {2}([a-z]\w*): \{/gm)].map((m) => m[1]);
  const alias = /const ALIAS = \{([^}]*)\}/.exec(src);
  if (alias) for (const m of alias[1].matchAll(/(\w+):/g)) keys.push(m[1]);
  return [...new Set(keys)];
}

/** Every ground/object character with its Korean name, minimap colour, solidity and the themes that use it. */
export async function palette() {
  const { E } = await pure();
  const { MINI, MINI_OBJ, MINI_THEME } = miniColours();
  const gThemes = {}, oThemes = {};
  for (const m of Object.values(E.MAPS)) {
    const th = m.theme || "town";
    for (const r of m.g) for (const c of r) (gThemes[c] || (gThemes[c] = new Set())).add(th);
    for (const r of m.o) for (const c of r) if (c !== " ") (oThemes[c] || (oThemes[c] = new Set())).add(th);
  }
  const ground = Object.keys(GROUND_NAME).map((ch) => ({
    ch, name: GROUND_NAME[ch], color: MINI[ch] || "#000000", solid: E.SOLID_G.includes(ch),
    themes: [...(gThemes[ch] || [])], themeColors: Object.fromEntries(Object.entries(MINI_THEME).filter(([, t]) => t[ch]).map(([k, t]) => [k, t[ch]])),
  }));
  const objects = [{ ch: " ", name: "비어 있음", color: null, solid: false, themes: [] }].concat(Object.keys(OBJECT_NAME).map((ch) => ({
    ch, name: OBJECT_NAME[ch], color: MINI_OBJ[ch] || "#000000", solid: true, themes: [...(oThemes[ch] || [])],
  })));
  return { ground, objects };
}

// ───────────────────────────── maps → editor JSON ─────────────────────────────

/** A map as the game holds it → editor JSON (SCHEMA.md), with the additive `big`, `marks` and spawn `el`. */
function toEditor(E, id) {
  const m = E.MAPS[id];
  if (!m) return null;
  const builtin = E.BUILTIN_MAPS.includes(id);
  const wp = E.WP[id];
  const rows = (layer) => layer.map((r) => (typeof r === "string" ? r : r.join("")));
  return {
    v: 1, id, replaces: builtin ? id : null, name: m.name, theme: m.theme || "town", bgm: m.bgm || "field", safe: !!m.safe,
    band: m.band || null, w: m.w, h: m.h, ground: rows(m.g), objects: rows(m.o), entry: [m.entry[0], m.entry[1]],
    spawns: m.spawns.map((sp) => {
      const o = { k: sp.k, n: sp.n, r: sp.r.slice() };
      if (sp.elite !== undefined) o.elite = sp.elite;
      if (sp.el) o.el = sp.el;
      return o;
    }),
    npcs: m.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, x: n.x, y: n.y, look: n.look, lines: n.lines || (n.say ? [n.say] : []) })),
    portals: m.portals.map((p) => ({ x: p.x, y: p.y, to: p.to, tx: p.tx, ty: p.ty })),
    fires: (E.FIRES[id] || []).map((f) => [f[0], f[1]]),
    waypoint: wp ? [wp.x, wp.y, wp.ax, wp.ay] : null,
    fishing: !m.nofish,
    boss: E.FIELD_BOSS[id] ? { k: E.FIELD_BOSS[id], x: wp ? wp.ax : m.entry[0], y: wp ? wp.ay : m.entry[1] } : null,
    big: m.big.map((b) => ({ ...b })),
    marks: (m.marks || []).filter((k) => k.kind === "sign").map((k) => (k.to ? { x: k.x, y: k.y, kind: "sign", label: k.label, to: k.to } : { x: k.x, y: k.y, kind: "sign", label: k.label })),
  };
}

/**
 * A map as editor JSON. By default the generated map (what the game has without data/), so a
 * built-in map can be opened, edited and saved as data/maps/<id>.json with "replaces": id.
 * With { withData: true } (or { dataDir }), the map as the game builds it with that data.
 */
export async function mapToEditor(id, opts = {}) {
  const { E } = opts.withData || opts.dataDir ? await loadLogic({ dataDir: opts.dataDir }) : await pure();
  return toEditor(E, id);
}

/** Every map the game would have with data/: built-in, custom, and which file replaces which. */
export async function listMaps(dataDir = DATA_DIR) {
  const { data } = readData(dataDir);
  const { E } = await loadLogic({ dataDir });
  const byId = {};
  for (const d of data.maps) byId[d.replaces || d.id] = d;
  return Object.keys(E.MAPS).map((id) => {
    const m = E.MAPS[id], d = byId[id];
    return { id, name: m.name, builtin: E.BUILTIN_MAPS.includes(id), custom: !!d, file: d ? d.id : null, replaces: d && d.replaces ? d.replaces : null, w: m.w, h: m.h, theme: m.theme || "town" };
  });
}

/** The tables the editor's pickers need (GET /api/defs). */
export async function defsForEditor(dataDir = DATA_DIR) {
  const { E } = await loadLogic({ dataDir });
  const mobs = {}, items = {};
  for (const k of Object.keys(E.MOBS)) { const d = E.MOBS[k]; mobs[k] = { name: d.name, lv: d.lv, boss: !!d.boss, chest: !!d.chest }; }
  for (const id of Object.keys(E.ITEMS)) items[id] = { name: E.ITEMS[id].name, type: E.ITEMS[id].type };
  const npcs = [];
  for (const id of Object.keys(E.MAPS)) for (const n of E.MAPS[id].npcs) npcs.push({ id: n.id, name: n.name, role: n.role, map: id, x: n.x, y: n.y });
  return {
    mobs, items, roles: E.NPC_ROLES.slice(), themes: E.THEMES.slice(), bgm: bgmKeys(),
    maps: Object.keys(E.MAPS).map((id) => ({ id, name: E.MAPS[id].name, builtin: E.BUILTIN_MAPS.includes(id), w: E.MAPS[id].w, h: E.MAPS[id].h })),
    npcs, quests: E.QUESTS.map((q) => ({ mob: q.mob, n: q.n, title: q.title })), goals: ["kill", "collect", "talk", "visit"],
  };
}

// ───────────────────────────── the full check ─────────────────────────────

const ID_RE = /^[a-z][a-z0-9_]{1,23}$/, NPC_ID_RE = /^[a-z][a-z0-9_]{1,31}$/, SQ_ID_RE = /^[a-z][a-z0-9_]{2,31}$/;
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = Number.isInteger;

/** Walkable tiles reached from (sx, sy): Uint8Array, 1 = reachable. `open(x, y)` decides what is walkable. */
function flood(w, h, open, sx, sy) {
  const seen = new Uint8Array(w * h);
  if (!open(sx, sy)) return seen;
  const q = [sy * w + sx];
  seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const x = q[i] % w, y = (q[i] - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || !open(nx, ny)) continue;
      seen[ny * w + nx] = 1;
      q.push(ny * w + nx);
    }
  }
  return seen;
}
/** Walkability of a map given as rows (editor JSON or the game's built map). */
function grid(m, solidG) {
  const g = m.ground || m.g, o = m.objects || m.o;
  const open = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && o[y][x] === " " && !solidG.includes(g[y][x]);
  return { open, g, o };
}
/** Reached itself, or (for a door or an NPC standing on its own tile) a side of it reached. */
const nearReach = (seen, w, h, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
  const nx = x + dx, ny = y + dy;
  return nx >= 0 && ny >= 0 && nx < w && ny < h && seen[ny * w + nx];
});

/**
 * Validate data/** completely. Korean messages; `file` is relative to game/, `path` a JSON
 * path inside it (e.g. "spawns[2].r"). ok = no errors (warnings are advice).
 */
export async function checkData(dataDir = DATA_DIR) {
  const errors = [], warnings = [];
  const err = (file, path, msg) => errors.push({ file, path, msg });
  const warn = (file, path, msg) => warnings.push({ file, path, msg });
  const { data, problems } = readData(dataDir);
  for (const p of problems) { const i = p.indexOf(": "); err(i > 0 ? p.slice(0, i).replace(/^.*?data[\\/]/, "data/") : "data", "", i > 0 ? p.slice(i + 2) : p); }
  const base = await pure();
  const G = base.E;
  const pal = await palette();
  const GCH = new Set(pal.ground.map((p) => p.ch)), OCH = new Set(pal.objects.map((p) => p.ch));
  const bgm = new Set(bgmKeys());
  const solidG = G.SOLID_G;
  const mob = (k) => typeof k === "string" && Object.hasOwn(G.MOBS, k);
  const item = (id) => typeof id === "string" && Object.hasOwn(G.ITEMS, id);

  // ── which ids exist once the data is in: built-in, replaced, new (and a file's own id as an alias)
  const fileOf = {}, alias = {}, custom = {};
  for (const d of data.maps) {
    const f = `data/maps/${d.id}.json`;
    fileOf[d.id] = f;
    if (d.replaces != null && d.replaces !== "") {
      if (typeof d.replaces !== "string" || !G.BUILTIN_MAPS.includes(d.replaces)) { err(f, "replaces", `"${d.replaces}"는 기본 지도 id가 아닙니다 (${G.BUILTIN_MAPS.join(", ")})`); continue; }
      if (custom[d.replaces]) { err(f, "replaces", `기본 지도 "${d.replaces}"를 두 파일이 대체합니다`); continue; }
      alias[d.id] = d.replaces; custom[d.replaces] = d;
    } else {
      if (G.BUILTIN_MAPS.includes(d.id)) { err(f, "id", `"${d.id}"는 기본 지도 id입니다. 대체하려면 "replaces": "${d.id}"를 쓰세요`); continue; }
      alias[d.id] = d.id; custom[d.id] = d;
    }
  }
  const real = (id) => (typeof id !== "string" ? null : custom[id] ? id : alias[id] ? alias[id] : G.MAPS[id] ? id : null);
  const mapIds = new Set([...Object.keys(G.MAPS), ...Object.keys(custom)]);
  // the walkable grid and reach of every map as it will be
  const shape = {};
  const shapeOf = (id) => {
    if (shape[id]) return shape[id];
    const d = custom[id];
    const m = d ? { w: d.w, h: d.h, ground: d.ground, objects: d.objects.map((r) => r.split("")), entry: d.entry } : { w: G.MAPS[id].w, h: G.MAPS[id].h, ground: G.MAPS[id].g, objects: G.MAPS[id].o.map((r) => r.split("")), entry: G.MAPS[id].entry };
    shape[id] = m;
    return m;
  };
  // doors from links.json clear the tile they stand on
  for (const l of data.links) { const id = real(l.map); if (id && isInt(l.x) && isInt(l.y)) { const m = shapeOf(id); if (m.objects[l.y] && l.x >= 0 && l.x < m.w) m.objects[l.y][l.x] = " "; } }
  for (const d of Object.values(custom)) if (Array.isArray(d.waypoint) && isInt(d.waypoint[0]) && isInt(d.waypoint[1])) { const m = shapeOf(d.replaces || d.id); if (m.objects[d.waypoint[1]]) m.objects[d.waypoint[1]][d.waypoint[0]] = "Q"; }
  const reachOf = (id) => {
    const m = shapeOf(id);
    if (!m.reach) {
      const { open } = grid(m, solidG);
      m.open = open;
      m.reach = Array.isArray(m.entry) && isInt(m.entry[0]) && isInt(m.entry[1]) ? flood(m.w, m.h, open, m.entry[0], m.entry[1]) : new Uint8Array(m.w * m.h);
    }
    return m;
  };
  const inside = (m, x, y) => isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < m.w && y < m.h;
  const doorsInto = {};
  const addDoor = (from, to, x, y, tx, ty) => (doorsInto[to] || (doorsInto[to] = [])).push({ from, x, y, tx, ty });
  // ── NPC ids are unique across the world
  const npcIds = new Map();
  for (const id of Object.keys(G.MAPS)) if (!custom[id]) for (const n of G.MAPS[id].npcs) npcIds.set(n.id, { map: id, role: n.role, builtin: true });
  const claimNpc = (f, path, n, map) => {
    if (typeof n.id !== "string" || !NPC_ID_RE.test(n.id)) { err(f, `${path}.id`, `NPC id "${n.id}"가 올바르지 않습니다 (영문 소문자로 시작, 2–32자)`); return; }
    if (npcIds.has(n.id)) { err(f, `${path}.id`, `NPC id "${n.id}"가 중복됩니다 (${npcIds.get(n.id).map})`); return; }
    npcIds.set(n.id, { map, role: n.role });
  };
  const checkNpc = (f, path, n, map) => {
    if (!isObj(n)) { err(f, path, "NPC는 객체여야 합니다"); return; }
    claimNpc(f, path, n, map);
    if (typeof n.name !== "string" || !n.name.trim()) err(f, `${path}.name`, "NPC 이름이 비어 있습니다");
    if (!G.NPC_ROLES.includes(n.role)) err(f, `${path}.role`, `알 수 없는 역할 "${n.role}" (${G.NPC_ROLES.join(", ")})`);
    if (n.lines !== undefined && (!Array.isArray(n.lines) || n.lines.some((l) => typeof l !== "string"))) err(f, `${path}.lines`, "lines는 문자열 배열이어야 합니다");
    if (n.role === "talk" && (!Array.isArray(n.lines) || !n.lines.length)) warn(f, `${path}.lines`, `${n.name || n.id}: 대화 NPC에게 할 말(lines)이 없습니다`);
    if (n.look !== undefined && !Array.isArray(n.look)) err(f, `${path}.look`, "look은 배열이어야 합니다");
    const m = reachOf(map);
    if (!inside(m, n.x, n.y)) { err(f, `${path}`, `NPC 위치 (${n.x},${n.y})가 지도 밖입니다`); return; }
    if (!m.open(n.x, n.y)) err(f, `${path}`, `NPC가 막힌 칸 (${n.x},${n.y})에 서 있습니다`);
    else if (!nearReach(m.reach, m.w, m.h, n.x, n.y)) warn(f, `${path}`, `NPC ${n.name || n.id}에게 입구에서 걸어갈 수 없습니다 (${n.x},${n.y})`);
  };

  // ── each map file
  for (const d of data.maps) {
    const f = fileOf[d.id], id = d.replaces || d.id;
    if (!custom[id] || custom[id] !== d) continue;
    if (d.v !== 1) warn(f, "v", '"v": 1 이 없습니다');
    if (typeof d.name !== "string" || !d.name.trim()) err(f, "name", "지도 이름이 비어 있습니다");
    if (!G.THEMES.includes(d.theme)) err(f, "theme", `알 수 없는 테마 "${d.theme}" (${G.THEMES.join(", ")})`);
    if (d.bgm !== undefined && !bgm.has(d.bgm)) warn(f, "bgm", `음악 "${d.bgm}"이 audio.js에 없습니다 (${[...bgm].join(", ")})`);
    if (d.band !== null && d.band !== undefined && !(Array.isArray(d.band) && d.band.length === 2 && d.band.every(isInt) && d.band[0] <= d.band[1])) err(f, "band", "band는 [최소, 최대] 레벨 또는 null이어야 합니다");
    for (const layer of ["ground", "objects"]) {
      const okCh = layer === "ground" ? GCH : OCH;
      d[layer].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (!okCh.has(row[x])) { err(f, `${layer}[${y}]`, `알 수 없는 ${layer === "ground" ? "바닥" : "물체"} 글자 "${row[x]}" (${x},${y})`); break; }
      });
    }
    const m = reachOf(id);
    if (!Array.isArray(d.entry) || !inside(m, d.entry[0], d.entry[1])) err(f, "entry", "입구(entry)가 지도 밖이거나 없습니다");
    else if (!m.open(d.entry[0], d.entry[1])) err(f, "entry", `입구 (${d.entry[0]},${d.entry[1]})가 막힌 칸입니다`);
    let walk = 0, reached = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.open(x, y)) { walk++; if (m.reach[y * m.w + x]) reached++; }
    if (walk && reached < walk * 0.6) warn(f, "", `걸을 수 있는 땅의 ${Math.round((100 * (walk - reached)) / walk)}%가 입구에서 닿지 않습니다`);
    (Array.isArray(d.spawns) ? d.spawns : []).forEach((sp, i) => {
      const p = `spawns[${i}]`;
      if (!isObj(sp)) { err(f, p, "스폰은 객체여야 합니다"); return; }
      if (!mob(sp.k)) err(f, `${p}.k`, `알 수 없는 몬스터 "${sp.k}"`);
      if (!isInt(sp.n) || sp.n < 1 || sp.n > 40) err(f, `${p}.n`, "마릿수 n은 1..40이어야 합니다");
      if (!Array.isArray(sp.r) || sp.r.length !== 4 || !sp.r.every(isInt) || !inside(m, sp.r[0], sp.r[1]) || !inside(m, sp.r[2], sp.r[3]) || sp.r[2] < sp.r[0] || sp.r[3] < sp.r[1]) { err(f, `${p}.r`, "구역 r은 지도 안의 [x0, y0, x1, y1]이어야 합니다"); return; }
      let ok = false;
      for (let y = sp.r[1]; y <= sp.r[3] && !ok; y++) for (let x = sp.r[0]; x <= sp.r[2] && !ok; x++) if (m.reach[y * m.w + x]) ok = true;
      if (!ok) err(f, `${p}.r`, `${G.MOBS[sp.k] ? G.MOBS[sp.k].name : sp.k} 스폰 구역에 입구에서 닿는 빈 칸이 없습니다`);
      if (sp.elite !== undefined && !(typeof sp.elite === "number" && sp.elite >= 0 && sp.elite <= 1)) err(f, `${p}.elite`, "elite는 0..1 사이 확률이어야 합니다");
    });
    if (d.safe && Array.isArray(d.spawns) && d.spawns.length) warn(f, "spawns", "안전 지역(safe)에는 몬스터가 나오지 않습니다 — 스폰이 무시됩니다");
    (Array.isArray(d.npcs) ? d.npcs : []).forEach((n, i) => checkNpc(f, `npcs[${i}]`, n, id));
    (Array.isArray(d.portals) ? d.portals : []).forEach((pt, i) => {
      const p = `portals[${i}]`;
      if (!isObj(pt)) { err(f, p, "문은 객체여야 합니다"); return; }
      if (!inside(m, pt.x, pt.y)) { err(f, p, `문 위치 (${pt.x},${pt.y})가 지도 밖입니다`); return; }
      if (!m.open(pt.x, pt.y)) err(f, p, `문 (${pt.x},${pt.y})이 막힌 칸에 있습니다`);
      else if (!m.reach[pt.y * m.w + pt.x]) err(f, p, `문 (${pt.x},${pt.y})에 입구에서 걸어갈 수 없습니다`);
      const to = real(pt.to);
      if (!to) { err(f, `${p}.to`, `알 수 없는 지도 "${pt.to}"`); return; }
      addDoor(id, to, pt.x, pt.y, pt.tx, pt.ty);
    });
    (Array.isArray(d.fires) ? d.fires : []).forEach((fp, i) => {
      if (!Array.isArray(fp) || !inside(m, fp[0], fp[1])) { err(f, `fires[${i}]`, "모닥불 위치가 지도 밖입니다"); return; }
      if (!nearReach(m.reach, m.w, m.h, fp[0], fp[1])) warn(f, `fires[${i}]`, `모닥불 (${fp[0]},${fp[1]})에 걸어갈 수 없습니다`);
    });
    if (d.waypoint != null) {
      const [x, y] = Array.isArray(d.waypoint) ? d.waypoint : [];
      if (!inside(m, x, y)) err(f, "waypoint", "이동의 돌 위치가 지도 밖입니다");
      else if (!nearReach(m.reach, m.w, m.h, x, y) && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(m, x + dx, y + dy) && m.reach[(y + dy) * m.w + x + dx])) err(f, "waypoint", `이동의 돌 (${x},${y}) 옆에 걸어갈 수 있는 칸이 없습니다`);
    }
    if (d.boss != null && (!isObj(d.boss) || !mob(d.boss.k))) err(f, "boss.k", `알 수 없는 몬스터 "${d.boss && d.boss.k}"`);
    if (Array.isArray(d.big)) d.big.forEach((b, i) => { if (!isObj(b) || !["house", "fountain", "spirit"].includes(b.t) || !inside(m, b.x, b.y)) err(f, `big[${i}]`, "big 항목은 지도 안의 {t: house|fountain|spirit, x, y}여야 합니다"); });
  }
  // generated maps keep their own doors
  for (const id of Object.keys(G.MAPS)) if (!custom[id]) for (const pt of G.MAPS[id].portals) addDoor(id, pt.to, pt.x, pt.y, pt.tx, pt.ty);

  // ── links.json
  data.links.forEach((l, i) => {
    const f = "data/links.json", p = `links[${i}]`;
    const from = real(l.map), to = real(l.to);
    if (!from) { err(f, `${p}.map`, `알 수 없는 지도 "${l.map}"`); return; }
    if (!to) { err(f, `${p}.to`, `알 수 없는 지도 "${l.to}"`); return; }
    const m = reachOf(from);
    if (!inside(m, l.x, l.y)) { err(f, p, `문 위치 (${l.x},${l.y})가 지도 밖입니다`); return; }
    if (!m.open(l.x, l.y)) err(f, p, `문 (${l.x},${l.y})이 막힌 바닥(물·암벽)에 있습니다`);
    else if (!nearReach(m.reach, m.w, m.h, l.x, l.y)) err(f, p, `${from}의 문 (${l.x},${l.y})에 입구에서 걸어갈 수 없습니다`);
    addDoor(from, to, l.x, l.y, l.tx, l.ty);
  });
  // ── every door lands on open ground that leads somewhere; one-way doors are pointed out
  for (const [to, list] of Object.entries(doorsInto)) {
    const t = reachOf(to);
    for (const dr of list) {
      const src = custom[dr.from] ? fileOf[custom[dr.from].id] : data.links.some((l) => real(l.map) === dr.from && l.x === dr.x && l.y === dr.y) ? "data/links.json" : `(기본 지도 ${dr.from})`;
      const here = `${dr.from} (${dr.x},${dr.y}) → ${to} (${dr.tx},${dr.ty})`;
      if (!inside(t, dr.tx, dr.ty)) { err(src, "", `문 ${here}: 도착 칸이 지도 밖입니다`); continue; }
      if (!t.open(dr.tx, dr.ty)) {
        const why = custom[to] && custom[to].replaces && !custom[dr.from] ? ` — 대체한 지도 ${fileOf[custom[to].id]}가 이 문의 도착 칸을 막았습니다` : "";
        err(custom[to] && custom[to].replaces && !custom[dr.from] ? fileOf[custom[to].id] : src, "", `문 ${here}: 도착 칸이 막혀 있습니다${why}`);
      } else if (!t.reach[dr.ty * t.w + dr.tx]) warn(src, "", `문 ${here}: 도착 칸에서 그 지도의 입구로 걸어갈 수 없습니다`);
      if (!(doorsInto[dr.from] || []).some((b) => b.from === to)) warn(src, "", `문 ${here}: 되돌아오는 문이 없습니다 (한쪽 방향)`);
    }
  }
  for (const id of Object.keys(custom)) if (!G.BUILTIN_MAPS.includes(id) && !doorsInto[id]) warn(fileOf[custom[id].id], "", `지도 "${id}"로 들어오는 문이 없습니다 (links.json에 추가하세요)`);

  // ── npcs.json
  data.npcs.forEach((n, i) => {
    const f = "data/npcs.json", p = `npcs[${i}]`;
    const map = real(n.map);
    if (!map) { err(f, `${p}.map`, `알 수 없는 지도 "${n.map}"`); return; }
    checkNpc(f, p, n, map);
  });

  // ── quests.json
  const qf = "data/quests.json";
  if (Array.isArray(data.quests.main)) data.quests.main.forEach((q, i) => {
    const p = `main[${i}]`;
    if (!mob(q.mob)) err(qf, `${p}.mob`, `알 수 없는 몬스터 "${q.mob}"`);
    if (!isInt(q.n) || q.n < 1) err(qf, `${p}.n`, "n은 1 이상이어야 합니다");
    if (typeof q.title !== "string" || !q.title) err(qf, `${p}.title`, "제목이 비어 있습니다");
    (Array.isArray(q.items) ? q.items : []).forEach((it, j) => { if (!Array.isArray(it) || !item(it[0])) err(qf, `${p}.items[${j}]`, `알 수 없는 아이템 "${Array.isArray(it) ? it[0] : it}"`); });
  });
  const sids = new Set();
  for (const q of data.quests.side) if (typeof q.id === "string") sids.add(q.id);
  const seenSq = new Set();
  data.quests.side.forEach((q, i) => {
    const p = `side[${i}]`;
    if (typeof q.id !== "string" || !SQ_ID_RE.test(q.id)) err(qf, `${p}.id`, `퀘스트 id "${q.id}"가 올바르지 않습니다 (영문 소문자로 시작, 3–32자)`);
    else if (seenSq.has(q.id)) err(qf, `${p}.id`, `퀘스트 id "${q.id}"가 중복됩니다`);
    seenSq.add(q.id);
    const giver = npcIds.get(q.giver);
    if (!giver) err(qf, `${p}.giver`, `퀘스트를 주는 NPC "${q.giver}"가 없습니다`);
    else if (giver.role !== "quest") warn(qf, `${p}.giver`, `NPC "${q.giver}"의 역할이 "quest"가 아닙니다 — 말을 걸어도 퀘스트 창이 열리지 않습니다`);
    for (const k of ["title", "text"]) if (typeof q[k] !== "string" || !q[k].trim()) err(qf, `${p}.${k}`, `${k === "title" ? "제목" : "내용"}이 비어 있습니다`);
    const g = q.goal;
    if (!isObj(g)) err(qf, `${p}.goal`, "목표(goal)가 없습니다");
    else if (g.type === "kill") { if (!mob(g.mob)) err(qf, `${p}.goal.mob`, `알 수 없는 몬스터 "${g.mob}"`); if (!isInt(g.n) || g.n < 1) err(qf, `${p}.goal.n`, "n은 1 이상이어야 합니다"); }
    else if (g.type === "collect") { if (!item(g.item)) err(qf, `${p}.goal.item`, `알 수 없는 아이템 "${g.item}"`); if (!isInt(g.n) || g.n < 1) err(qf, `${p}.goal.n`, "n은 1 이상이어야 합니다"); }
    else if (g.type === "talk") { if (!npcIds.has(g.npc)) err(qf, `${p}.goal.npc`, `알 수 없는 NPC "${g.npc}"`); }
    else if (g.type === "visit") { if (!real(g.map) && !mapIds.has(g.map)) err(qf, `${p}.goal.map`, `알 수 없는 지도 "${g.map}"`); }
    else err(qf, `${p}.goal.type`, `알 수 없는 목표 종류 "${g.type}" (kill, collect, talk, visit)`);
    const req = isObj(q.req) ? q.req : {};
    if (req.lv !== undefined && req.lv !== null && (!isInt(req.lv) || req.lv < 1)) err(qf, `${p}.req.lv`, "req.lv는 1 이상의 정수여야 합니다");
    if (req.quest != null && !sids.has(req.quest)) err(qf, `${p}.req.quest`, `선행 퀘스트 "${req.quest}"가 없습니다`);
    if (req.quest != null && req.quest === q.id) err(qf, `${p}.req.quest`, "자기 자신을 선행 퀘스트로 둘 수 없습니다");
    const rw = isObj(q.reward) ? q.reward : {};
    for (const k of ["xp", "gold"]) if (rw[k] !== undefined && (!isInt(rw[k]) || rw[k] < 0)) err(qf, `${p}.reward.${k}`, `${k}는 0 이상의 정수여야 합니다`);
    (Array.isArray(rw.items) ? rw.items : []).forEach((it, j) => { if (!Array.isArray(it) || !item(it[0])) err(qf, `${p}.reward.items[${j}]`, `알 수 없는 아이템 "${Array.isArray(it) ? it[0] : it}"`); });
  });

  // ── finally the rules themselves must load with this data
  if (!errors.length) {
    try {
      const { E } = await loadLogic({ dataDir });
      for (const id of Object.keys(custom)) if (!E.MAPS[id]) err(fileOf[custom[id].id], "", `지도 "${id}"를 게임이 만들지 못했습니다`);
    } catch (e) {
      err("src/logic.js", "", `데이터를 넣은 규칙을 불러오지 못했습니다: ${e.message}`);
    }
  }
  return { ok: !errors.length, errors, warnings };
}
