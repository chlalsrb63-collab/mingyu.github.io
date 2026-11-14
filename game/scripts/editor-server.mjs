#!/usr/bin/env node
// 테일즈테일즈 월드맵에디터 — the local editor server (docs/editor/SCHEMA.md, docs/editor/README.md).
//
//   node scripts/editor-server.mjs        (npm run editor; EDITOR.bat at the repo root)
//   → http://localhost:5190   (listens on 127.0.0.1 only)
//   EDITOR_DATA=<dir> edits another data folder (tests, experiments); EDITOR_PORT=<n> another port.
//
// Serves game/editor/ (the app), game/public/ read-only at /public/ (the game's own renderer
// for previews) and asset/ read-only at /asset/, and implements the /api routes of SCHEMA.md.
// Writes only inside game/data/** (atomic temp+rename, timestamped backups in
// game/data/.backup/, last 20 per file kept) and, through import-art.mjs, asset/ installs.
//
// The game knowledge (palette, generated maps, tables, the full data check) comes from
// scripts/editor-lib.mjs. It evaluates the rules once per data set and node never frees an
// imported module, so the lib runs in a child process (this same file with EDITOR_LIB_WORKER=1)
// that is recycled when it grows. Pure node, no dependencies; works the same on Windows and POSIX.
import http from "node:http";
import { readFile, writeFile, rename, mkdir, readdir, stat, unlink, copyFile } from "node:fs/promises";
import { existsSync, readFileSync, createReadStream } from "node:fs";
import { join, dirname, resolve, sep, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync, fork } from "node:child_process";
import { checkMap, checkLinks, checkNpcs, checkQuests, ID_RE } from "../editor/validate.js";

const SELF = fileURLToPath(import.meta.url);
const GAME = join(dirname(SELF), "..");
const REPO = join(GAME, "..");
const EDITOR = join(GAME, "editor");
const PUBLIC = join(GAME, "public");
const ASSET = join(REPO, "asset");
const DATA = process.env.EDITOR_DATA ? resolve(process.env.EDITOR_DATA) : join(GAME, "data");
const MAPS_DIR = join(DATA, "maps");
const BACKUP = join(DATA, ".backup");
const PORT = +(process.env.EDITOR_PORT || 5190);
const HOST = "127.0.0.1";
const GAME_PORT = 8787;
const MAX_BODY = 4 << 20;
const KEEP_BACKUPS = 20;
const WIN = process.platform === "win32";

// ───────────────────────────── the lib worker (child process) ─────────────────────────────
if (process.env.EDITOR_LIB_WORKER === "1") {
  const L = await import("./editor-lib.mjs");
  const { EMPTY_DATA } = await import("./build-logic.mjs");
  const fns = {
    palette: () => L.palette(),
    defs: (dir) => L.defsForEditor(dir),
    listMaps: (dir) => L.listMaps(dir),
    mapToEditor: (id) => L.mapToEditor(id),
    checkData: (dir) => L.checkData(dir),
    /** What the pickers' pictures need beyond defsForEditor (sprite body, tint, gear tier). */
    art: async () => {
      const { E } = await L.loadLogic({ data: EMPTY_DATA() });
      const mobs = {}, items = {};
      for (const [k, m] of Object.entries(E.MOBS)) mobs[k] = { sp: m.sp || k, tint: m.tint || null };
      for (const [k, it] of Object.entries(E.ITEMS)) if (it.tier != null || it.wk || it.rune) items[k] = { tier: it.tier, wk: it.wk, rune: it.rune };
      return { mobs, items };
    },
  };
  process.on("message", async ({ id, fn, args }) => {
    try { process.send({ id, ok: true, v: await fns[fn](...(args || [])), rss: process.memoryUsage().rss }); }
    catch (e) { process.send({ id, ok: false, err: e.message, rss: process.memoryUsage().rss }); }
  });
  process.send({ ready: true });
} else {
  await server();
}

async function server() {
let worker = null, seq = 0, recycle = false;
const pending = new Map();
const RSS_LIMIT = 700 << 20;
function startWorker() {
  worker = fork(SELF, [], { env: { ...process.env, EDITOR_LIB_WORKER: "1" }, stdio: ["ignore", "inherit", "inherit", "ipc"] });
  const w = worker;
  w.on("message", (msg) => {
    if (msg.ready) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.ok(msg.v); else p.bad(httpError(500, "게임 정보를 읽지 못했어요: " + msg.err));
    if (msg.rss > RSS_LIMIT) recycle = true;
    if (recycle && !pending.size && worker === w) { recycle = false; worker = null; w.kill(); }
  });
  w.on("exit", () => {
    if (worker === w) worker = null;
    for (const [id, p] of pending) if (p.w === w) { pending.delete(id); clearTimeout(p.timer); p.bad(httpError(500, "게임 정보 작업이 멈췄어요. 다시 해 보세요.")); }
  });
}
/** Call an editor-lib function in the worker. */
function call(fn, ...args) {
  if (!worker) startWorker();
  const id = ++seq, w = worker;
  return new Promise((ok, bad) => {
    const timer = setTimeout(() => { pending.delete(id); bad(httpError(500, "게임 정보를 읽는 데 너무 오래 걸려요.")); }, 180000);
    pending.set(id, { ok, bad, timer, w });
    w.send({ id, fn, args });
  });
}
// data-dependent answers are cached until the next write
let dataVersion = 0;
const memo = new Map();
const cached = (key, f) => {
  const k = key + "@" + dataVersion;
  if (!memo.has(k)) { memo.set(k, f().catch((e) => { memo.delete(k); throw e; })); for (const old of memo.keys()) if (!old.endsWith("@" + dataVersion)) memo.delete(old); }
  return memo.get(k);
};
let palCache = null, artCache = null;
const palette = () => palCache || (palCache = call("palette").catch((e) => { palCache = null; throw e; }));
const art = () => artCache || (artCache = call("art").catch((e) => { artCache = null; throw e; }));
const listMaps = () => cached("maps", () => call("listMaps", DATA));
const checkData = () => cached("check", () => call("checkData", DATA));
/** The built-in main quest chain exactly as written (10-tables.js), xp before the game's level scaling. */
function rawMainQuests() {
  const src = readFileSync(join(GAME, "src", "logic", "10-tables.js"), "utf8");
  // `const QUESTS = <data replacement> ? … : [ …built-in chain… ];` — take the literal list
  const at = src.indexOf("const QUESTS =");
  const m = at < 0 ? null : /(\[\n[\s\S]*?\n\]);/.exec(src.slice(at));
  try { return m ? Function(`"use strict"; return (${m[1]});`)() : []; } catch { return []; }
}
const defs = () => cached("defs", async () => {
  const [d, a] = await Promise.all([call("defs", DATA), art()]);
  // additive: picture fields for the pickers, the built-in chain in full for "기본 퀘스트를 복사"
  for (const [k, m] of Object.entries(d.mobs)) Object.assign(m, a.mobs[k] || {});
  for (const [k, it] of Object.entries(d.items)) Object.assign(it, a.items[k] || {});
  d.mainQuests = rawMainQuests();
  return d;
});

// ───────────────────────────── data files ─────────────────────────────
const DEFAULTS = {
  "links.json": () => ({ v: 1, links: [] }),
  "npcs.json": () => ({ v: 1, npcs: [] }),
  "quests.json": () => ({ v: 1, main: null, side: [] }),
};
async function readJson(p) { return JSON.parse((await readFile(p, "utf8")).replace(/^﻿/, "")); }
async function readData(name) {
  const p = join(DATA, name);
  if (!existsSync(p)) return DEFAULTS[name]();
  return readJson(p);
}
/** The hand-made map files: { fileId: json } (a broken file → { __broken }). */
async function mapFiles() {
  const out = {};
  if (!existsSync(MAPS_DIR)) return out;
  for (const f of await readdir(MAPS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try { out[f.slice(0, -5)] = await readJson(join(MAPS_DIR, f)); } catch (e) { out[f.slice(0, -5)] = { __broken: e.message }; }
  }
  return out;
}
/** The file holding map `id` (its own id, or the built-in id it replaces), or null. */
async function fileFor(id) {
  const files = await mapFiles();
  if (files[id]) return id;
  for (const [f, m] of Object.entries(files)) if (m.replaces === id) return f;
  return null;
}
/** Everything the validators need: palette, defs, map sizes (aliases too), NPC ids. */
async function checkContext() {
  const [pal, d, list, extra] = await Promise.all([palette(), defs(), listMaps(), readData("npcs.json").catch(() => ({ npcs: [] }))]);
  const maps = {};
  for (const m of list) {
    maps[m.id] = { w: m.w, h: m.h, builtin: m.builtin };
    if (m.file && m.file !== m.id) maps[m.file] = maps[m.id];
  }
  const npcIds = new Set(d.npcs.map((n) => n.id));
  for (const n of extra.npcs || []) npcIds.add(n.id);
  return { palette: pal, defs: d, maps, builtin: list.filter((m) => m.builtin).map((m) => m.id), npcIds: [...npcIds], mapIds: Object.keys(maps) };
}

/** Atomic write inside the data folder with a timestamped backup of what was there. */
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
  dataVersion++;
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
    out(`\n$ ${[cmd === process.execPath ? "node" : cmd, ...args.map((a) => a.startsWith(GAME) ? relative(GAME, a) : a)].join(" ")}\n`);
    const ch = spawn(cmd, args, { cwd: GAME, env: { ...process.env, FORCE_COLOR: "0" }, ...opts });
    ch.stdout.on("data", (d) => out(d.toString()));
    ch.stderr.on("data", (d) => out(d.toString()));
    ch.on("error", (e) => { out(`✗ ${e.message}\n`); ok(1); });
    ch.on("close", (code) => ok(code ?? 1));
  });
}
const node = (script, args, out) => run(process.execPath, [join(GAME, "scripts", script), ...args], out);
const dataArgs = () => (process.env.EDITOR_DATA ? [DATA] : []);

// ───────────────────────────── the local game server (playtest) ─────────────────────────────
let wrangler = null;
const wlog = [];
const wout = (s) => { wlog.push(s.replace(/\x1b\[[0-9;]*m/g, "")); if (wlog.length > 400) wlog.splice(0, wlog.length - 400); };
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
    wout("게임 서버를 켭니다 (wrangler dev -c wrangler.local.jsonc)…\n");
    // node + wrangler's own script (no npx, no shell): one process tree we can stop again
    const bin = join(GAME, "node_modules", "wrangler", "bin", "wrangler.js");
    if (!existsSync(bin)) throw httpError(500, "wrangler가 설치되어 있지 않아요. game 폴더에서 npm install을 한 번 해 주세요.");
    wrangler = spawn(process.execPath, [bin, "dev", "-c", "wrangler.local.jsonc", "--port", String(GAME_PORT)], { cwd: GAME, detached: !WIN, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
    wrangler.stdout.on("data", (d) => wout(d.toString()));
    wrangler.stderr.on("data", (d) => wout(d.toString()));
    wrangler.on("close", (c) => { wout(`게임 서버가 꺼졌어요 (code ${c}).\n`); wrangler = null; });
  }
  for (let i = 0; i < 120; i++) {
    if (await ping(GAME_PORT)) return true;
    if (!wrangler) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw httpError(500, "게임 서버를 켜지 못했어요. 빌드·테스트 탭의 '게임 서버 기록'을 보세요.", { log: wlog.join("").slice(-4000) });
}
function stopAll() {
  if (wrangler) {
    // the whole tree (wrangler starts workerd): a process group on POSIX, taskkill /T on Windows
    try { if (WIN) spawnSync("taskkill", ["/pid", String(wrangler.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(-wrangler.pid, "SIGTERM"); } catch { try { wrangler.kill(); } catch { /* gone */ } }
    wrangler = null;
  }
  if (worker) { try { worker.kill(); } catch { /* gone */ } worker = null; }
}
process.on("SIGINT", () => { stopAll(); process.exit(0); });
process.on("SIGTERM", () => { stopAll(); process.exit(0); });
process.on("exit", stopAll);

// ───────────────────────────── routes ─────────────────────────────
async function getMap(id) {
  const f = await fileFor(id);
  if (f) return readJson(join(MAPS_DIR, f + ".json"));
  const m = await call("mapToEditor", id);
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
  const [list, files, extra] = await Promise.all([listMaps(), mapFiles(), readData("npcs.json")]);
  const name = Object.fromEntries(list.map((m) => [m.id, m.name]));
  for (const m of list) if (m.file) name[m.file] = m.name;
  const out = [];
  for (const m of list) {
    if (m.custom) continue;
    const g = await call("mapToEditor", m.id);
    for (const n of (g && g.npcs) || []) out.push({ ...n, map: m.id, mapName: m.name, source: "builtin" });
  }
  for (const [fid, m] of Object.entries(files)) {
    if (m.__broken) continue;
    const id = m.replaces || fid;
    for (const n of m.npcs || []) out.push({ ...n, map: id, mapName: name[id] || m.name, source: "map", file: fid });
  }
  for (const n of extra.npcs || []) out.push({ ...n, mapName: name[n.map] || n.map, source: "npcs.json" });
  return out;
}

const SIDE_FILES = { links: ["links.json", checkLinks], npcs: ["npcs.json", checkNpcs], quests: ["quests.json", checkQuests] };

async function api(req, res, path) {
  const M = req.method;
  if (path === "/api/palette" && M === "GET") return send(res, 200, await palette());
  if (path === "/api/defs" && M === "GET") return send(res, 200, await defs());
  if (path === "/api/maps" && M === "GET") return send(res, 200, await listMaps());
  if (path === "/api/status" && M === "GET") return send(res, 200, { game: await ping(GAME_PORT), gamePort: GAME_PORT, data: relative(REPO, DATA) || DATA });
  let m = path.match(/^\/api\/map\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!ID_RE.test(id)) throw httpError(400, "맵 아이디는 영어 소문자로 시작하고 소문자·숫자·_ 만 2~24글자여야 해요.");
    if (M === "GET") return send(res, 200, await getMap(id));
    if (M === "PUT") {
      const map = await body(req);
      if (map.id !== id && map.replaces !== id) throw httpError(400, "주소의 맵 아이디와 파일 안의 아이디가 달라요.");
      if (!ID_RE.test(String(map.id))) throw httpError(400, "맵 아이디 형식이 틀렸어요.");
      const files = await mapFiles();
      for (const [f, other] of Object.entries(files)) {
        if (f === map.id) continue;
        if (map.replaces && other.replaces === map.replaces) throw httpError(400, `기본 맵 "${map.replaces}"은(는) 이미 maps/${f}.json이 대신하고 있어요.`);
      }
      const ctx = await checkContext();
      // the map being saved counts as existing (doors may point at itself)
      ctx.maps[id] = ctx.maps[map.id] = { w: map.w, h: map.h, builtin: !!map.replaces };
      const { errors, warnings } = split(checkMap(map, ctx, { deep: true }), `maps/${map.id}.json`);
      if (errors.length) return send(res, 400, { ok: false, error: "저장하지 못했어요: " + errors[0].msg, errors, warnings });
      await writeData(`maps/${map.id}.json`, map);
      return send(res, 200, { ok: true, file: `maps/${map.id}.json`, warnings });
    }
    if (M === "DELETE") {
      const f = await fileFor(id);
      if (!f) throw httpError(404, "지울 수 있는 직접 만든 맵이 아니에요 (기본 맵은 지울 수 없어요).");
      await backup(`maps/${f}.json`);
      await unlink(join(MAPS_DIR, f + ".json"));
      dataVersion++;
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
        const old = new Set(((await readData("npcs.json")).npcs || []).map((n) => n.id));
        ctx.npcIds = ctx.npcIds.filter((i) => !old.has(i)).concat((f.npcs || []).map((n) => n && n.id));
      }
      const { errors, warnings } = split(check(f, ctx), file);
      if (errors.length) return send(res, 400, { ok: false, error: "저장하지 못했어요: " + errors[0].msg, errors, warnings });
      await writeData(file, f);
      return send(res, 200, { ok: true, warnings });
    }
  }
  if (path === "/api/npcs/all" && M === "GET") return send(res, 200, await allNpcs());
  if (path === "/api/check" && M === "POST") return send(res, 200, await checkData());
  if (path === "/api/build" && M === "POST") return build(req, res);
  if (path === "/api/assets" && M === "GET") {
    await node("gallery.mjs", [], () => {});
    let g = { groups: [] };
    try { g = await readJson(join(ASSET, "gallery.json")); } catch { /* no gallery */ }
    let manifest = { images: {}, audio: {} };
    try { manifest = await readJson(join(PUBLIC, "assets", "manifest.json")); } catch { /* none */ }
    return send(res, 200, { ...g, manifest });   // additive: what is installed
  }
  if (path === "/api/assets/install" && M === "POST") {
    const b = await body(req);
    const rel = String(b.file || "").replace(/\\/g, "/").replace(/^asset\//, "");
    const p = safeJoin(ASSET, rel);
    if (!p || !existsSync(p) || !/\.(png|gif|ogg|mp3|wav)$/i.test(p)) throw httpError(400, "asset 폴더 안의 그림(PNG)이나 소리 파일만 넣을 수 있어요.");
    if (/^(_export|_preview|reference|incoming)\//.test(rel)) throw httpError(400, "승인된 폴더의 파일만 게임에 넣을 수 있어요 (_export·_preview·reference·incoming 은 안 돼요).");
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
    if (process.env.EDITOR_DATA) throw httpError(400, "다른 데이터 폴더(EDITOR_DATA)를 고치는 중에는 게임 테스트를 할 수 없어요.");
    const log = [];
    const code = await node("build-logic.mjs", [], (s) => log.push(s));
    if (code !== 0) throw httpError(400, "게임 규칙을 만들지 못했어요 (빌드 실패). 빌드·테스트 탭에서 검사해 보세요.", { log: log.join("") });
    const started = await ensureGame();
    const q = new URLSearchParams({ dev: "1", map });
    if (x != null && y != null) { q.set("x", x); q.set("y", y); }
    return send(res, 200, { ok: true, started, url: `http://localhost:${GAME_PORT}/?${q}` });
  }
  if (path === "/api/playtest/log" && M === "GET") return send(res, 200, { running: !!wrangler || (await ping(GAME_PORT)), log: wlog.join("").slice(-20000) });
  throw httpError(404, "없는 API예요.");
}

/** POST /api/build: logic build with the data, data check, fast tests. ?stream=1 streams the log as text. */
async function build(req, res) {
  const stream = new URL(req.url, "http://x").searchParams.get("stream") === "1";
  let log = "";
  const out = (s) => { log += s; if (stream) res.write(s); };
  if (stream) res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  const steps = [];
  let code = 0;
  if (process.env.EDITOR_DATA) out("(EDITOR_DATA: 다른 데이터 폴더라 게임 규칙 파일은 만들지 않고 검사만 해요)\n");
  else {
    out("▶ 1/3 게임 규칙 만들기 (build-logic: src/logic + data)\n");
    code = await node("build-logic.mjs", [], out);
    steps.push({ step: "build", ok: code === 0 });
  }
  if (code === 0) {
    out("\n▶ 2/3 데이터 검사 (data-check)\n");
    code = await node("data-check.mjs", dataArgs(), out);
    steps.push({ step: "check", ok: code === 0 });
  }
  if (code === 0 && !process.env.EDITOR_DATA) {
    out("\n▶ 3/3 빠른 테스트 (sim world data)\n");
    code = await node("test-all.mjs", ["--no-build", "sim", "world", "data"], out);
    steps.push({ step: "tests", ok: code === 0 });
  }
  const ok = code === 0;
  out(ok ? "\n✔ 빌드 성공! 게임에 반영됐어요.\n" : "\n✗ 빌드 실패 — 위의 기록을 보세요.\n");
  if (stream) { res.end("\n__RESULT__" + JSON.stringify({ ok, steps })); return; }
  send(res, 200, { ok, steps, log });
}

const srv = http.createServer(async (req, res) => {
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
srv.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`포트 ${PORT}을(를) 이미 쓰고 있어요. 에디터가 이미 켜져 있나요? http://localhost:${PORT}`);
  else console.error(e);
  process.exit(1);
});
srv.listen(PORT, HOST, () => {
  console.log(`테일즈테일즈 월드맵에디터 → http://localhost:${PORT}   (끄려면 이 창을 닫거나 Ctrl+C)`);
  console.log(`데이터 폴더: ${DATA}`);
  palette().catch((e) => console.error("palette:", e.message));   // warm the worker up
});
}
