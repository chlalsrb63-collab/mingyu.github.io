#!/usr/bin/env node
// 테일즈테일즈 월드맵에디터 — the local editor server (docs/editor/SCHEMA.md, docs/editor/README.md).
//
//   node scripts/editor-server.mjs        (npm run editor; EDITOR.bat at the repo root)
//   → http://localhost:5190   (listens on 127.0.0.1 only)
//
// Serves game/editor/ (the app), game/public/ read-only at /public/ (the game's own renderer
// for previews) and asset/ read-only at /asset/, and implements the /api routes of SCHEMA.md.
// Writes only inside game/data/** (atomic temp+rename, timestamped backups in
// game/data/.backup/, last 20 per file kept) and, through import-art.mjs, asset/ installs.
// Pure node, no dependencies; works the same on Windows and POSIX.
import http from "node:http";
import { readFile, writeFile, rename, mkdir, readdir, stat, unlink, copyFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync, createReadStream } from "node:fs";
import { join, dirname, resolve, sep, extname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { checkMap, checkLinks, checkNpcs, checkQuests, ID_RE } from "../editor/validate.js";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(GAME, "..");
const EDITOR = join(GAME, "editor");
const PUBLIC = join(GAME, "public");
const ASSET = join(REPO, "asset");
// EDITOR_DATA=<dir> points the editor at another data folder (tests, experiments)
const DATA = process.env.EDITOR_DATA ? resolve(process.env.EDITOR_DATA) : join(GAME, "data");
const MAPS_DIR = join(DATA, "maps");
const BACKUP = join(DATA, ".backup");
const PORT = +(process.env.EDITOR_PORT || 5190);
const HOST = "127.0.0.1";
const GAME_PORT = 8787;
const MAX_BODY = 4 << 20;
const KEEP_BACKUPS = 20;
const WIN = process.platform === "win32";

// ───────────────────────────── the game-side library ─────────────────────────────
// scripts/editor-lib.mjs (written by the game side) knows the palette, converts generated maps
// and checks game/data. Until it exists, the fallback below stands in for it.
let LIB = null;
async function lib() {
  if (LIB) return LIB;
  const p = join(GAME, "scripts", "editor-lib.mjs");
  if (existsSync(p)) {
    try { LIB = await import(pathToFileURL(p).href); LIB.__real = true; return LIB; } catch (e) { console.error("editor-lib.mjs failed to load, using the fallback:", e.message); }
  }
  LIB = FALLBACK;
  return LIB;
}

// ── FALLBACK (temporary; remove once scripts/editor-lib.mjs is on main) ──────────────
// Evaluates the generated logic.js with one extra export, the way dump-maps.mjs does.
let LOGIC = null, LOGIC_MTIME = 0;
async function logic() {
  const f = join(GAME, "src", "logic.js");
  const mt = statSync(f).mtimeMs;
  if (LOGIC && mt === LOGIC_MTIME) return LOGIC;
  const src = readFileSync(f, "utf8") +
    "\nexport const __ed = { MAPS, MOBS, ITEMS, QUESTS, FIRES: typeof FIRES !== 'undefined' ? FIRES : {}, WP: typeof WP !== 'undefined' ? WP : {}, FIELD_BOSS: typeof FIELD_BOSS !== 'undefined' ? FIELD_BOSS : {} };\n";
  LOGIC = (await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"))).__ed;
  LOGIC_MTIME = mt;
  return LOGIC;
}
const ALL_THEMES = ["town", "meadow", "forest", "crypt", "city", "sewer", "cave", "abyss"];
const FB_GROUND = [
  [".", "풀밭", "#6cbf5e", 0], [",", "풀밭 2", "#62b556", 0], ['"', "꽃밭", "#8fd07a", 0], ["t", "긴 풀", "#4f9f48", 0],
  [":", "짙은 풀", "#3f8a5c", 0], [";", "이끼", "#377d52", 0], ["p", "흙길", "#d9ab6c", 0], ["o", "광장 돌바닥", "#b4b9c6", 0],
  ["r", "폐허 돌바닥", "#a8a89a", 0], ["s", "모래", "#ecd9a2", 0], ["w", "물", "#4aa2e2", 1], ["b", "다리", "#8a5a30", 0],
  ["j", "진흙", "#5a5a3a", 0], ["v", "계단", "#c8b890", 0], ["a", "아스팔트", "#474b5a", 0], ["m", "아스팔트 2", "#6a6e7c", 0],
  ["k", "보도블록", "#9aa0ae", 0], ["c", "바닥 타일", "#486a8a", 0], ["d", "바닥 타일 2", "#527696", 0], ["g", "어두운 바닥", "#3a4a3a", 0],
  ["n", "핏빛 바닥", "#7a2a3a", 0], ["i", "뼈 바닥", "#a49e90", 0], ["W", "바위·낭떠러지", "#131a32", 1],
];
const FB_OBJECTS = [
  ["T", "나무", "#2a6a34"], ["P", "소나무", "#1d4a30"], ["R", "바위", "#7a7e8c"], ["B", "덤불", "#3f8a44"], ["C", "돌벽", "#6a6258"],
  ["H", "울타리 덤불", "#2f7a3a"], ["U", "낮은 돌담", "#8a8478"], ["l", "쓰러진 통나무", "#7a5230"], ["u", "그루터기", "#8a6238"],
  ["e", "갈대", "#9ac86a"], ["q", "부서진 기둥", "#b8b4a8"], ["n", "상자 더미", "#c89a5e"], ["M", "광산 수레", "#8a5a34"],
  ["D", "쓰레기통", "#3a6a5a"], ["E", "천막", "#e0c090"], ["F", "나무 울타리", "#b88a52"], ["L", "가로등", "#ffe690"],
  ["G", "표지판", "#e0b87a"], ["K", "수정", "#72e6f4"], ["S", "파이프", "#5a7896"], ["Z", "콘크리트 벽", "#343846"],
  ["c", "자동차", "#c84a50"], ["y", "소화전", "#d84c4c"], ["x", "쓰레기 더미", "#5c6474"], ["h", "집 (4×3)", "#7c665a"],
  ["a", "분수", "#6a9ac8"], ["O", "선돌", "#d0d0e0"], ["A", "죽은 나무", "#6a5040"], ["Y", "버섯", "#e05a6a"], ["X", "피의 제단", "#ff2040"],
  ["Q", "이동의 돌", "#5ae4d0"], ["1", "석관", "#9a9488"], ["2", "세워 둔 관", "#7a5a42"], ["3", "촛대", "#ffd070"], ["4", "뼈 무더기", "#d8d0b8"],
  ["5", "해골 기둥", "#c8c0a8"], ["6", "하수관", "#6a7a6a"], ["7", "밸브", "#8a7a5a"], ["8", "살덩이 기둥", "#a04a5a"],
  ["9", "황금 장식", "#c8a050"], ["0", "핏빛 눈", "#ff6a7a"], ["I", "교회 의자", "#6a4226"],
];
const FB_ROLES = ["talk", "quest", "elder", "shop", "smith", "train", "bank", "warp", "daily", "collector", "achieve", "costume"];
const FB_BGM = ["town", "field", "meadow", "forest", "city", "cave", "crypt", "sewer", "abyss", "boss", "rift"];
const FALLBACK = {
  async palette() {
    return {
      ground: FB_GROUND.map(([ch, name, color, solid]) => ({ ch, name, color, solid: !!solid, themes: ALL_THEMES })),
      objects: FB_OBJECTS.map(([ch, name, color]) => ({ ch, name, color, solid: true })),
    };
  },
  async defsForEditor() {
    const L = await logic();
    const mobs = {};
    for (const [k, m] of Object.entries(L.MOBS)) mobs[k] = { name: m.name, lv: m.lv, boss: !!m.boss, chest: !!m.chest, sp: m.sp || k, tint: m.tint || null };
    const items = {};
    for (const [k, it] of Object.entries(L.ITEMS)) items[k] = { name: it.name, type: it.type, tier: it.tier, wk: it.wk, rune: it.rune };
    return { mobs, items, roles: FB_ROLES, themes: ALL_THEMES, bgm: FB_BGM, quests: L.QUESTS };
  },
  async mapToEditor(id) {
    const L = await logic(), m = L.MAPS[id];
    if (!m) return null;
    const boss = L.FIELD_BOSS[id], bs = boss && m.spawns.find((s) => s.k === boss);
    return {
      v: 1, id, replaces: null, name: m.name, theme: m.theme || (id === "town" ? "town" : "meadow"), bgm: m.bgm || "field",
      safe: !!m.safe, band: m.band || null, w: m.w, h: m.h, ground: m.g.slice(), objects: m.o.slice(), entry: m.entry.slice(),
      spawns: m.spawns.filter((s) => !(L.MOBS[s.k] && (L.MOBS[s.k].chest || L.MOBS[s.k].boss))).map((s) => ({ k: s.k, n: s.n, r: s.r.slice(), elite: s.elite || 0 })),
      npcs: m.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, x: n.x, y: n.y, look: n.look, lines: n.say ? [n.say] : [] })),
      portals: m.portals.map((p) => ({ x: p.x, y: p.y, to: p.to, tx: p.tx, ty: p.ty })),
      fires: (L.FIRES[id] || []).map((f) => [f[0], f[1]]), waypoint: L.WP[id] ? [L.WP[id].x, L.WP[id].y] : null, fishing: true,
      boss: boss ? { k: boss, x: bs ? bs.r[0] : m.entry[0], y: bs ? bs.r[1] : m.entry[1] } : null,
    };
  },
  async checkData(dir) {
    const ctx = await checkContext(dir);
    const errors = [], warnings = [];
    const put = (file, list) => { for (const p of list) (p.level === "warn" ? warnings : errors).push({ file, path: p.path, msg: p.msg, x: p.x, y: p.y }); };
    for (const [id, m] of Object.entries(ctx.custom)) put(`maps/${id}.json`, checkMap(m, ctx, { deep: true }));
    put("links.json", checkLinks(await readData("links.json", dir), ctx));
    put("npcs.json", checkNpcs(await readData("npcs.json", dir), ctx));
    put("quests.json", checkQuests(await readData("quests.json", dir), ctx));
    return { ok: !errors.length, errors, warnings };
  },
};
// ── end FALLBACK ─────────────────────────────────────────────────────────────────

// ───────────────────────────── data files ─────────────────────────────
const DEFAULTS = {
  "links.json": () => ({ v: 1, links: [] }),
  "npcs.json": () => ({ v: 1, npcs: [] }),
  "quests.json": () => ({ v: 1, main: null, side: [] }),
};
async function readJson(p) { return JSON.parse((await readFile(p, "utf8")).replace(/^﻿/, "")); }
async function readData(name, dir = DATA) {
  const p = join(dir, name);
  if (!existsSync(p)) return DEFAULTS[name]();
  return readJson(p);
}
async function customMaps(dir = DATA) {
  const out = {};
  const d = join(dir, "maps");
  if (!existsSync(d)) return out;
  for (const f of await readdir(d)) {
    if (!f.endsWith(".json")) continue;
    try { const m = await readJson(join(d, f)); out[f.slice(0, -5)] = m; } catch (e) { out[f.slice(0, -5)] = { __broken: e.message }; }
  }
  return out;
}
/** Built-in maps: what logic.js generates, minus hand-made maps it may already carry. */
async function builtinMaps(custom) {
  const L = await logic();
  const out = {};
  for (const [id, m] of Object.entries(L.MAPS)) {
    const c = custom[id];
    if (c && !c.replaces) continue;
    out[id] = { id, name: m.name, w: m.w, h: m.h, theme: m.theme || (id === "town" ? "town" : null) };
  }
  return out;
}
/** Everything the validators need: palette, defs, map sizes, NPC ids. */
async function checkContext(dir = DATA) {
  const L = await lib();
  const [palette, defs, custom] = [await L.palette(), await L.defsForEditor(), await customMaps(dir)];
  const built = await builtinMaps(custom);
  const maps = {};
  for (const [id, b] of Object.entries(built)) maps[id] = { w: b.w, h: b.h, builtin: true };
  for (const [id, m] of Object.entries(custom)) if (!m.__broken) maps[id] = { w: m.w, h: m.h, builtin: !!m.replaces };
  const npcIds = [];
  const Lg = await logic();
  for (const [id, m] of Object.entries(Lg.MAPS)) if (!custom[id]) for (const n of m.npcs) npcIds.push(n.id);
  for (const m of Object.values(custom)) for (const n of m.npcs || []) npcIds.push(n.id);
  try { for (const n of (await readData("npcs.json", dir)).npcs) npcIds.push(n.id); } catch { /* broken file: reported by its own check */ }
  return { palette, defs, maps, builtin: Object.keys(built), custom, npcIds, mapIds: Object.keys(maps) };
}

/** Atomic write inside game/data with a timestamped backup of what was there. */
async function writeData(rel, obj) {
  const p = safeJoin(DATA, rel);
  if (!p) throw httpError(400, "저장할 수 없는 경로예요.");
  const text = JSON.stringify(obj, null, 2) + "\n";
  if (text.length > MAX_BODY) throw httpError(400, "파일이 너무 커요 (4MB까지).");
  await mkdir(dirname(p), { recursive: true });
  await backup(rel);
  const tmp = p + ".tmp-" + process.pid + "-" + Date.now();
  await writeFile(tmp, text);
  await rename(tmp, p);
}
async function backup(rel) {
  const p = join(DATA, rel);
  if (!existsSync(p)) return;
  await mkdir(BACKUP, { recursive: true });
  const base = rel.replace(/[\\/]/g, "__").replace(/\.json$/, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await copyFile(p, join(BACKUP, `${base}.${stamp}.json`));
  const mine = (await readdir(BACKUP)).filter((f) => f.startsWith(base + ".")).sort();
  for (const f of mine.slice(0, Math.max(0, mine.length - KEEP_BACKUPS))) await unlink(join(BACKUP, f)).catch(() => {});
}

// ───────────────────────────── http plumbing ─────────────────────────────
function httpError(status, msg, extra) { const e = new Error(msg); e.status = status; e.extra = extra; return e; }
/** `root` + a request path, or null when it would step outside `root`. */
function safeJoin(root, rel) {
  let r;
  try { r = decodeURIComponent(rel); } catch { return null; }
  if (r.includes("\0")) return null;
  const p = resolve(root, "." + sep + r.replace(/^[\\/]+/, ""));
  return p === root || p.startsWith(root + sep) ? p : null;
}
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".gif": "image/gif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".bmp": "image/bmp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ico": "image/x-icon",
};
function send(res, status, body, type = "application/json; charset=utf-8") {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(data);
}
async function serveFile(res, root, rel) {
  let p = safeJoin(root, rel || "index.html");
  if (!p) return send(res, 403, { error: "금지된 경로" });
  try {
    let st = await stat(p);
    if (st.isDirectory()) { p = join(p, "index.html"); st = await stat(p); }
    res.writeHead(200, { "content-type": MIME[extname(p).toLowerCase()] || "application/octet-stream", "content-length": st.size, "cache-control": "no-store" });
    createReadStream(p).pipe(res);
  } catch { send(res, 404, { error: "없는 파일" }); }
}
function body(req) {
  return new Promise((ok, bad) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > MAX_BODY) { bad(httpError(413, "보낸 내용이 너무 커요 (4MB까지).")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      const s = Buffer.concat(chunks).toString("utf8");
      if (!s) return ok({});
      try { ok(JSON.parse(s)); } catch { bad(httpError(400, "JSON 형식이 틀렸어요.")); }
    });
    req.on("error", bad);
  });
}
/** Run a command, feeding its output to `out(text)`; resolves with the exit code. */
function run(cmd, args, out, opts = {}) {
  return new Promise((ok) => {
    out(`\n$ ${[cmd, ...args].join(" ")}\n`);
    const ch = spawn(cmd, args, { cwd: GAME, shell: WIN && /npx|npm/.test(cmd), env: { ...process.env, FORCE_COLOR: "0" }, ...opts });
    ch.stdout.on("data", (d) => out(d.toString()));
    ch.stderr.on("data", (d) => out(d.toString()));
    ch.on("error", (e) => { out(`✗ ${e.message}\n`); ok(1); });
    ch.on("close", (code) => ok(code ?? 1));
  });
}
const node = (script, args, out) => run(process.execPath, [join(GAME, "scripts", script), ...args], out);

// ───────────────────────────── the local game server (playtest) ─────────────────────────────
let wrangler = null;
const wlog = [];
const wout = (s) => { wlog.push(s); if (wlog.length > 400) wlog.splice(0, wlog.length - 400); };
function ping(port) {
  return new Promise((ok) => {
    const r = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1500 }, (res) => { res.resume(); ok(true); });
    r.on("error", () => ok(false));
    r.on("timeout", () => { r.destroy(); ok(false); });
  });
}
async function ensureGame() {
  if (await ping(GAME_PORT)) return false;
  if (!wrangler) {
    wout("게임 서버를 켭니다 (npx wrangler dev)…\n");
    wrangler = spawn(WIN ? "npx.cmd" : "npx", ["wrangler", "dev", "-c", "wrangler.local.jsonc", "--port", String(GAME_PORT)], { cwd: GAME, shell: WIN, env: { ...process.env, FORCE_COLOR: "0" } });
    wrangler.stdout.on("data", (d) => wout(d.toString()));
    wrangler.stderr.on("data", (d) => wout(d.toString()));
    wrangler.on("close", (c) => { wout(`게임 서버가 꺼졌어요 (code ${c}).\n`); wrangler = null; });
  }
  for (let i = 0; i < 120; i++) {
    if (await ping(GAME_PORT)) return true;
    if (!wrangler) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw httpError(500, "게임 서버를 켜지 못했어요. 빌드·테스트 탭의 기록을 보세요.", { log: wlog.join("").slice(-4000) });
}
function stopGame() { if (wrangler) { try { wrangler.kill(); } catch { /* gone */ } wrangler = null; } }
process.on("SIGINT", () => { stopGame(); process.exit(0); });
process.on("SIGTERM", () => { stopGame(); process.exit(0); });
process.on("exit", stopGame);

// ───────────────────────────── routes ─────────────────────────────
async function mapList() {
  const custom = await customMaps();
  const built = await builtinMaps(custom);
  const out = [];
  for (const b of Object.values(built)) {
    const c = custom[b.id];
    out.push({ id: b.id, name: c && !c.__broken ? c.name : b.name, builtin: true, custom: !!c, replaces: c ? c.replaces || null : null, w: c && !c.__broken ? c.w : b.w, h: c && !c.__broken ? c.h : b.h, theme: c && !c.__broken ? c.theme : b.theme });
  }
  for (const [id, c] of Object.entries(custom)) {
    if (built[id]) continue;
    out.push(c.__broken ? { id, name: id + " (읽기 실패)", builtin: false, custom: true, replaces: null, w: 0, h: 0, theme: null, broken: c.__broken }
      : { id, name: c.name, builtin: false, custom: true, replaces: c.replaces || null, w: c.w, h: c.h, theme: c.theme });
  }
  return out;
}
async function getMap(id) {
  if (!ID_RE.test(id)) throw httpError(400, "맵 아이디 형식이 틀렸어요.");
  const p = join(MAPS_DIR, id + ".json");
  if (existsSync(p)) return readJson(p);
  const m = await (await lib()).mapToEditor(id);
  if (!m) throw httpError(404, `맵 "${id}"이(가) 없어요.`);
  return m;
}
/** Problems of one kind of file, split into errors (refuse) and warnings (save anyway). */
function split(list, file) {
  const errors = [], warnings = [];
  for (const p of list) (p.level === "warn" ? warnings : errors).push({ file, path: p.path, msg: p.msg, x: p.x, y: p.y });
  return { errors, warnings };
}
/** Every NPC in the world: hand-made maps, npcs.json and the generated maps. */
async function allNpcs() {
  const custom = await customMaps(), L = await logic(), out = [];
  for (const [id, m] of Object.entries(L.MAPS)) {
    if (custom[id]) continue;
    for (const n of m.npcs) out.push({ map: id, mapName: m.name, id: n.id, name: n.name, role: n.role, x: n.x, y: n.y, look: n.look, lines: n.say ? [n.say] : [], source: "builtin" });
  }
  for (const [id, m] of Object.entries(custom)) for (const n of m.npcs || []) out.push({ ...n, map: id, mapName: m.name, source: "map" });
  const extra = await readData("npcs.json");
  for (const n of extra.npcs || []) out.push({ ...n, mapName: (L.MAPS[n.map] || custom[n.map] || {}).name || n.map, source: "npcs.json" });
  return out;
}

const SIDE_FILES = { links: ["links.json", checkLinks], npcs: ["npcs.json", checkNpcs], quests: ["quests.json", checkQuests] };

async function api(req, res, path) {
  const M = req.method;
  const L = await lib();
  if (path === "/api/palette" && M === "GET") return send(res, 200, await L.palette());
  if (path === "/api/defs" && M === "GET") {
    const d = await L.defsForEditor();
    if (!d.quests) d.quests = (await logic()).QUESTS;      // additive: the built-in main chain, for "기본에서 시작"
    return send(res, 200, d);
  }
  if (path === "/api/maps" && M === "GET") return send(res, 200, await mapList());
  if (path === "/api/status" && M === "GET") {
    return send(res, 200, { lib: L.__real ? "editor-lib" : "fallback", game: await ping(GAME_PORT), gamePort: GAME_PORT, data: relative(REPO, DATA) });
  }
  let m = path.match(/^\/api\/map\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!ID_RE.test(id)) throw httpError(400, "맵 아이디는 영어 소문자로 시작하고 소문자·숫자·_ 만 2~24글자여야 해요.");
    if (M === "GET") return send(res, 200, await getMap(id));
    if (M === "PUT") {
      const map = await body(req);
      if (map.id !== id) throw httpError(400, "주소의 맵 아이디와 파일 안의 아이디가 달라요.");
      const ctx = await checkContext();
      // the map being saved counts as existing (doors may point at itself)
      ctx.maps[id] = { w: map.w, h: map.h, builtin: !!map.replaces };
      const { errors, warnings } = split(checkMap(map, ctx, { deep: true }), `maps/${id}.json`);
      if (errors.length) return send(res, 400, { ok: false, error: "저장하지 못했어요: " + errors[0].msg, errors, warnings });
      await writeData(`maps/${id}.json`, map);
      return send(res, 200, { ok: true, warnings });
    }
    if (M === "DELETE") {
      const p = join(MAPS_DIR, id + ".json");
      if (!existsSync(p)) throw httpError(404, "지울 수 있는 직접 만든 맵이 아니에요 (기본 맵은 지울 수 없어요).");
      await backup(`maps/${id}.json`);
      await unlink(p);
      return send(res, 200, { ok: true });
    }
  }
  m = path.match(/^\/api\/(links|npcs|quests)$/);
  if (m) {
    const [file, check] = SIDE_FILES[m[1]];
    if (M === "GET") return send(res, 200, await readData(file));
    if (M === "PUT") {
      const f = await body(req);
      const ctx = await checkContext();
      if (m[1] === "npcs") { // the NPCs being saved are the ones that count
        const old = new Set((await readData("npcs.json")).npcs.map((n) => n.id));
        ctx.npcIds = ctx.npcIds.filter((i) => !old.has(i));
      }
      const { errors, warnings } = split(check(f, ctx), file);
      if (errors.length) return send(res, 400, { ok: false, error: "저장하지 못했어요: " + errors[0].msg, errors, warnings });
      await writeData(file, f);
      return send(res, 200, { ok: true, warnings });
    }
  }
  if (path === "/api/npcs/all" && M === "GET") return send(res, 200, await allNpcs());
  if (path === "/api/check" && M === "POST") return send(res, 200, await L.checkData(DATA));
  if (path === "/api/build" && M === "POST") return build(req, res);
  if (path === "/api/assets" && M === "GET") {
    const log = [];
    await node("gallery.mjs", [], (s) => log.push(s));
    let g = { groups: [] };
    try { g = await readJson(join(ASSET, "gallery.json")); } catch { /* no gallery */ }
    let manifest = { images: {}, audio: {} };
    try { manifest = await readJson(join(PUBLIC, "assets", "manifest.json")); } catch { /* none */ }
    return send(res, 200, { ...g, manifest });   // additive: what is installed
  }
  if (path === "/api/assets/install" && M === "POST") {
    const b = await body(req);
    const rel = String(b.file || "").replace(/^asset[\\/]/, "");
    const p = safeJoin(ASSET, rel);
    if (!p || !existsSync(p) || !/\.(png|gif|ogg|mp3|wav)$/i.test(p)) throw httpError(400, "asset 폴더 안의 그림(PNG)이나 소리 파일만 넣을 수 있어요.");
    if (/^(_export|_preview|reference|incoming)[\\/]/.test(rel)) throw httpError(400, "승인된 폴더의 파일만 게임에 넣을 수 있어요 (_export·_preview·reference·incoming 은 안 돼요).");
    const args = ["--install", p];
    if (b.key) {
      if (!/^[a-z0-9_.-]{2,80}$/.test(b.key)) throw httpError(400, "게임 키는 영어 소문자·숫자·점(.)으로 적어 주세요 (예: icon.item.hp_s).");
      args.push("--key", b.key);
    }
    const log = [];
    const code = await node("import-art.mjs", args, (s) => log.push(s));
    return send(res, code === 0 ? 200 : 400, { ok: code === 0, log: log.join(""), error: code === 0 ? undefined : "게임에 넣지 못했어요. 기록을 보세요." });
  }
  if (path === "/api/playtest" && M === "POST") {
    const b = await body(req);
    const map = String(b.map || "town");
    if (!ID_RE.test(map)) throw httpError(400, "맵 아이디 형식이 틀렸어요.");
    const x = Number.isInteger(b.x) ? b.x : null, y = Number.isInteger(b.y) ? b.y : null;
    const log = [];
    const code = await node("build-logic.mjs", [], (s) => log.push(s));
    if (code !== 0) throw httpError(400, "게임 규칙을 만들지 못했어요 (빌드 실패).", { log: log.join("") });
    const started = await ensureGame();
    const q = new URLSearchParams({ playtest: map });
    if (x != null && y != null) { q.set("x", x); q.set("y", y); }
    return send(res, 200, { ok: true, started, url: `http://localhost:${GAME_PORT}/?${q}` });
  }
  if (path === "/api/playtest/log" && M === "GET") return send(res, 200, { running: !!wrangler || (await ping(GAME_PORT)), log: wlog.join("").slice(-20000) });
  throw httpError(404, "없는 API예요.");
}

/** POST /api/build: logic build, data check, fast tests. ?stream=1 streams the log as text. */
async function build(req, res) {
  const stream = new URL(req.url, "http://x").searchParams.get("stream") === "1";
  let log = "";
  const out = (s) => { log += s; if (stream) res.write(s); };
  if (stream) res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  const steps = [];
  out("▶ 1/3 게임 규칙 만들기 (build-logic)\n");
  let code = await node("build-logic.mjs", [], out);
  steps.push({ step: "build", ok: code === 0 });
  if (code === 0) {
    out("\n▶ 2/3 데이터 검사\n");
    if (existsSync(join(GAME, "scripts", "data-check.mjs"))) code = await node("data-check.mjs", [], out);
    else {
      const r = await (await lib()).checkData(DATA);
      for (const e of r.errors) out(`✗ ${e.file} ${e.path}: ${e.msg}\n`);
      for (const w of r.warnings) out(`△ ${w.file} ${w.path}: ${w.msg}\n`);
      out(r.ok ? "데이터 이상 없음.\n" : "");
      code = r.ok ? 0 : 1;
    }
    steps.push({ step: "check", ok: code === 0 });
  }
  if (code === 0) {
    out("\n▶ 3/3 빠른 테스트 (sim world maps)\n");
    code = await node("test-all.mjs", ["--no-build", "sim", "world", "maps"], out);
    steps.push({ step: "tests", ok: code === 0 });
  }
  const ok = code === 0 && steps.length === 3;
  out(ok ? "\n✔ 빌드 성공! 게임에 반영됐어요.\n" : "\n✗ 빌드 실패 — 위의 기록을 보세요.\n");
  if (stream) { res.end("\n__RESULT__" + JSON.stringify({ ok, steps })); return; }
  send(res, 200, { ok, steps, log });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  const path = url.pathname;
  // local only: refuse pages from other sites driving the API (DNS rebinding, cross-site posts)
  const host = (req.headers.host || "").replace(/:\d+$/, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return send(res, 403, { error: "local only" });
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(res, 403, { error: "local only" });
  try {
    if (path.startsWith("/api/")) return await api(req, res, path);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "읽기 전용" });
    if (path.startsWith("/public/")) return await serveFile(res, PUBLIC, path.slice(8));
    if (path.startsWith("/asset/")) return await serveFile(res, ASSET, path.slice(7));
    return await serveFile(res, EDITOR, path.slice(1));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (res.headersSent) { try { res.end(`\n✗ ${e.message}\n`); } catch { /* closed */ } return; }
    send(res, status, { ok: false, error: e.message, ...(e.extra || {}) });
  }
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`포트 ${PORT}을(를) 이미 쓰고 있어요. 에디터가 이미 켜져 있나요? http://localhost:${PORT}`);
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, HOST, async () => {
  const L = await lib();
  console.log(`테일즈테일즈 월드맵에디터 → http://localhost:${PORT}   (끄려면 Ctrl+C)`);
  console.log(`데이터: ${DATA}   ${L.__real ? "" : "(editor-lib.mjs 없음: 임시 팔레트 사용)"}`);
});
