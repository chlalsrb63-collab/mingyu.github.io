#!/usr/bin/env node
// ONE targeted screenshot — the cheap way to check visual work.
//
// Preview mode (default, no server needed): serves public/ itself, regenerates
// public/_maps.json, opens a dev preview page (public/_<page>.html) and saves one PNG.
//   node scripts/shot.mjs --map meadow --out shots/meadow.png
//   node scripts/shot.mjs --page scene --map crypt --x 30 --y 22 --q "mobs=ratking,bonehound&el=1"
//   node scripts/shot.mjs --page mobs --q "k=twinhare,lambmaw&z=4"
//   node scripts/shot.mjs --page world --map forest            (whole map, real renderer)
//   pages: scene world iso over mobs sheet species wardrobe swing bow title icons uicons emo mini
//
// Live mode: the real game against a running dev server (npm run dev:local first).
// Logs in with a throwaway account (cached in shots/.shot-account.json), creates
// a character if needed, enters 1서버 채널 1 (the town) and shoots.
//   node scripts/shot.mjs --live --out shots/town.png
//   node scripts/shot.mjs --live --keys i --out shots/bag.png          (press keys first: I = bag)
//   node scripts/shot.mjs --live --eval "__game.go(400, 300)" --wait 3000
//   node scripts/shot.mjs --live --url http://localhost:8851 --path "/?dev=1&map=willow&x=18&y=14"   (map editor playtest)
//
// Serve only: node scripts/shot.mjs --serve [port]   (npm run preview) — open the preview
// pages in your own browser at http://127.0.0.1:5178/_scene.html?map=meadow (no Playwright).
//
// Common: --size 960x600 (viewport) · --wait <ms> extra settle time · --full (whole page)
//         --channel msedge|chrome (use an installed browser instead of Playwright's Chromium)
// Prints page errors and console errors, so a broken page is visible without the image.
//
// Needs the `playwright` dev dependency (npm install) and a browser: either
// `npx playwright install chromium` once, or an installed Edge/Chrome (tried automatically).
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { launch as _launch, serve as _serve, GAME as ROOT, PUBLIC } from "./artkit.mjs";

// ── arguments
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const k = a.slice(2), v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) opt[k] = true;
  else { opt[k] = v; i++; }
}
if (opt.help || opt.h) {
  const head = (await readFile(fileURLToPath(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).slice(0, 30);
  console.log(head.map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const live = !!opt.live;
const page = String(opt.page || "scene").replace(/^_/, "").replace(/\.html$/, "");
const [vw, vh] = String(opt.size || "960x600").split("x").map(Number);
const out = resolve(ROOT, String(opt.out || `shots/${live ? "live" : page}${opt.map ? "-" + opt.map : ""}.png`));
const extraWait = Number(opt.wait || (live ? 1500 : 250));

// ── playwright and a browser, a tiny static server for public/ (artkit.mjs)
const launch = () => _launch(opt.channel);
const serve = (port = 0) => _serve(PUBLIC, port);

function dumpMaps() {
  const d = spawnSync(process.execPath, [join(ROOT, "scripts", "dump-maps.mjs")], { cwd: ROOT, encoding: "utf8" });
  if (d.status !== 0) throw new Error("dump-maps failed:\n" + d.stderr);
}

// ── --serve: just keep the static server up, to open the preview pages in your own browser
if (opt.serve) {
  dumpMaps();
  const port = opt.serve === true ? 5178 : Number(opt.serve);
  await serve(port);
  console.log(`dev preview pages (Ctrl+C to stop; re-run after changing the maps):`);
  for (const p of ["scene?map=town", "scene?map=meadow&mobs=twinhare,lambmaw", "world?map=forest", "over?map=cave", "iso?map=town", "mobs", "sheet", "species", "wardrobe", "swing", "title", "icons", "uicons", "emo", "mini"]) {
    const [name, q] = p.split("?");
    console.log(`  http://127.0.0.1:${port}/_${name}.html${q ? "?" + q : ""}`);
  }
  await new Promise(() => {});
}

// ── live mode helpers: a throwaway account against the dev server
const BASE = String(opt.url || "http://localhost:8787").replace(/\/+$/, "");
async function api(op, body) {
  const r = await fetch(`${BASE}/api/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function account() {
  const file = join(ROOT, "shots", ".shot-account.json");
  let acc = null;
  try { acc = JSON.parse(await readFile(file, "utf8")); } catch { /* first run */ }
  if (acc && acc.base === BASE) {
    const r = await api("login", { id: acc.id, pw: acc.pw });
    if (r.ok) return { id: r.id, token: r.token };
  }
  const rand = () => Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "a");
  acc = { base: BASE, id: "shot" + rand(), pw: "pw-" + rand() + rand() };
  const r = await api("signup", { id: acc.id, pw: acc.pw });
  if (!r.ok) throw new Error("signup failed: " + (r.error || JSON.stringify(r)));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(acc));
  return { id: r.id, token: r.token };
}

// ── go
const errors = [];
let srv = null;
const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  if (!live) {
    dumpMaps();
    srv = await serve();
    const q = new URLSearchParams(String(opt.q || ""));
    if (opt.map) q.set("map", String(opt.map));
    if (page === "scene" && opt.map && !q.has("x")) {
      // stand by the map's waypoint stone (open ground) unless told where
      const maps = JSON.parse(await readFile(join(PUBLIC, "_maps.json"), "utf8"));
      const m = maps[String(opt.map)];
      if (!m) throw new Error(`no map "${opt.map}" — maps: ${Object.keys(maps).join(" ")}`);
      const wp = (m.marks || []).find((k) => k.kind === "waypoint");
      q.set("x", String(wp ? wp.x : Math.floor(m.w / 2)));
      q.set("y", String(wp ? wp.y + 2 : Math.floor(m.h / 2)));
    }
    if (opt.x) q.set("x", String(opt.x));
    if (opt.y) q.set("y", String(opt.y));
    const qs = q.toString();
    const url = `http://127.0.0.1:${srv.address().port}/_${page}.html${qs ? "?" + qs : ""}`;
    console.log("open " + url);
    const res = await pg.goto(url);
    if (!res || !res.ok()) throw new Error(`no such preview page: public/_${page}.html`);
    // most preview pages say when they have drawn (document.title or window.__done);
    // the animated ones (iso, title) never do, so they just get a moment
    if (["iso", "title"].includes(page)) await pg.waitForTimeout(1500);
    else await pg.waitForFunction(() => window.__done || /^(ready|ok|bad|monsters|score)/.test(document.title), null, { timeout: 15000 })
      .catch(() => errors.push("the page never said it was ready: it may have thrown (see above)"));
  } else {
    const s = await account();
    await ctx.addInitScript(([sess]) => {
      if (!localStorage.getItem("lumentale:sess")) localStorage.setItem("lumentale:sess", sess);
      localStorage.setItem("tales:last", "s1-ch1");
      localStorage.setItem("lumentale:tuthide", "99");
    }, [JSON.stringify(s)]);
    console.log(`open ${BASE} as ${s.id}`);
    await pg.goto(BASE + String(opt.path || ""));
    await pg.click("#t-press");
    await pg.waitForSelector("#sv-list .sv-ch:not([disabled])", { timeout: 15000 });
    await pg.click("#sv-list .sv-ch >> nth=0");
    await pg.waitForFunction(() => (window.__game && window.__game.G.playing) || !document.querySelector("#create").hidden, null, { timeout: 15000 });
    if (await pg.evaluate(() => !document.querySelector("#create").hidden)) {
      await pg.fill("#c-name", "샷" + String(Date.now() % 10000));
      await pg.click("#b-create");
    }
    await pg.waitForFunction(() => window.__game && window.__game.G.playing, null, { timeout: 15000 });
    if (opt.map && opt.map !== "town") console.log("note: live mode starts in town; walk with --eval \"__game.go(wx, wy)\" or use preview mode for other maps");
    await pg.waitForTimeout(800);
    // e.g. --keys i  or  --keys "k,Escape"  (Playwright key names)
    if (opt.keys) for (const k of String(opt.keys).split(",")) { await pg.keyboard.press(k.trim()); await pg.waitForTimeout(150); }
  }
  if (opt.eval) await pg.evaluate((code) => (0, eval)(code), String(opt.eval));
  await pg.waitForTimeout(extraWait);
  await mkdir(dirname(out), { recursive: true });
  await pg.screenshot({ path: out, fullPage: !!opt.full });
  console.log("saved " + out);
} catch (e) {
  errors.push("shot failed: " + e.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (srv) srv.close();
}
if (errors.length) console.log("page problems:\n  " + errors.slice(0, 20).join("\n  "));
