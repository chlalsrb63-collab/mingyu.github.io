#!/usr/bin/env node
// Client performance probe: the real game in a headless browser against a running dev server (default http://localhost:8823,
// the `game-shots` preview). For each map it prints the frame time, the canvas draw calls per frame and the top functions
// by CPU self time (CDP profiler). Measures only; nothing here changes the game.
//   node scripts/client-prof.mjs town,forest 8        maps (comma list), seconds each
//   THROTTLE=6 node scripts/client-prof.mjs town 8    CPU slowed 6x (a weak laptop)
//   STRESS=4 node scripts/client-prof.mjs town 8      4 random skill effects every 100 ms (a raid casting)
// A non-town map is entered through the playtest door (?dev=1&map=…) and a level-1 hero may die there, so run `town,<map>`;
// the line says which map it really measured. Headless software rendering makes absolute numbers pessimistic; compare runs.
// Client profile: per map, CPU self-time by function (CDP Profiler) + frame stats. node prof.mjs <maps comma> [secs]
import { readFile } from "node:fs/promises";
import { launch } from "./artkit.mjs";

const BASE = "http://localhost:8823";
const maps = (process.argv[2] || "town").split(",");
const secs = Number(process.argv[3] || 8);
const acc = JSON.parse(await readFile(new URL("../shots/.shot-account.json", import.meta.url), "utf8").catch(() => "null"));
const api = async (op, body) => (await fetch(`${BASE}/api/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
let sess;
if (acc) { const r = await api("login", { id: acc.id, pw: acc.pw }); if (r.ok) sess = { id: r.id, token: r.token }; }
if (!sess) { const id = "prof" + Math.random().toString(36).slice(2, 8), pw = "pw-" + Math.random().toString(36).slice(2, 10); const r = await api("signup", { id, pw }); sess = { id: r.id, token: r.token }; }

const browser = await launch();
const errs = [];
for (const map of maps) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s]) => { localStorage.setItem("lumentale:sess", s); localStorage.setItem("tales:last", "s1-ch1"); localStorage.setItem("lumentale:tuthide", "99"); }, [JSON.stringify(sess)]);
  await ctx.addInitScript(() => { window.__cnt = {}; const P = CanvasRenderingContext2D.prototype; for (const k of ["drawImage","fillRect","fillText","strokeText","fill","stroke","putImageData","getImageData","createLinearGradient","createRadialGradient"]) { const o = P[k]; P[k] = function (...a) { window.__cnt[k] = (window.__cnt[k] || 0) + 1; return o.apply(this, a); }; } const oc = document.createElement.bind(document); document.createElement = (t, ...r) => { const e = oc(t, ...r); if (t === "canvas") window.__cnt.newCanvas = (window.__cnt.newCanvas || 0) + 1; return e; }; });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errs.push(map + " pageerror: " + e.message));
  const q = map === "town" ? "" : `/?dev=1&map=${map}&x=30&y=30`;
  await pg.goto(BASE + q);
  await pg.click("#t-press");
  await pg.waitForSelector("#sv-list .sv-ch:not([disabled])", { timeout: 15000 });
  await pg.click("#sv-list .sv-ch >> nth=0");
  await pg.waitForFunction(() => (window.__game && window.__game.G.playing) || !document.querySelector("#create").hidden, null, { timeout: 15000 });
  if (await pg.evaluate(() => !document.querySelector("#create").hidden)) { await pg.fill("#c-name", "프로" + (Date.now() % 10000)); await pg.click("#b-create"); }
  await pg.waitForFunction(() => window.__game && window.__game.G.playing, null, { timeout: 15000 });
  await pg.waitForTimeout(2500);
  const info = await pg.evaluate(() => ({ map: __game.G.map && __game.G.map.id, mobs: __game.G.mobs ? __game.G.mobs.size : -1, players: __game.G.who ? __game.G.who.size : -1 }));
  if (process.env.STRESS) {
    await pg.evaluate(async (rate) => {
      const FX = await import("/skillfx.js");
      const g = __game.G;
      const rnd = (a) => (Math.random() - 0.5) * a;
      const jobs = [
        () => FX.fireballOrb(g.me.x + rnd(300), g.me.y + rnd(200), g.me.x + rnd(300), g.me.y + rnd(200), 30),
        () => FX.frostNovaRing(g.me.x + rnd(300), g.me.y + rnd(200), 56),
        () => FX.chainLightningArc(g.me.x + rnd(300), g.me.y + rnd(200), g.me.x + rnd(300), g.me.y + rnd(200)),
        () => FX.crimsonArcWave(g.me.x + rnd(300), g.me.y + rnd(200), g.me.x + rnd(300), g.me.y + rnd(200), 20),
        () => FX.meleeSwordArc(g.me.x + rnd(300), g.me.y + rnd(200), Math.random() * 6.28),
        () => FX.hammerImpact(g.me.x + rnd(300), g.me.y + rnd(200), 28, true, false, 130, 0),
        () => FX.gravityWell(g.me.x + rnd(300), g.me.y + rnd(200), 60, 1500),
      ];
      window.__fxErr = 0;
      window.__fxTimer = setInterval(() => { for (let i = 0; i < rate; i++) { try { jobs[Math.floor(Math.random() * jobs.length)](); } catch (e) { window.__fxErr++; window.__fxLast = String(e); } } }, 100);
    }, Number(process.env.STRESS));
  }
  // frame timing: rAF deltas
  await pg.evaluate(() => { window.__cnt = {}; });
  await pg.evaluate((ms) => { window.__ft = []; let last = performance.now(); const end = last + ms; const f = (t) => { window.__ft.push(t - last); last = t; if (t < end) requestAnimationFrame(f); }; requestAnimationFrame(f); }, secs * 1000);
  const cdp = await ctx.newCDPSession(pg);
  if (process.env.THROTTLE) await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.THROTTLE) });
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); await cdp.send("Profiler.start");
  await pg.waitForTimeout(secs * 1000 + 300);
  const { profile } = await cdp.send("Profiler.stop");
  const ft = await pg.evaluate(() => window.__ft.slice(2));
  const cnt = await pg.evaluate(() => window.__cnt); const nf = ft.length || 1;
  ft.sort((a, b) => a - b);
  const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
  // self time per node
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map(); const dts = profile.timeDeltas; let total = 0;
  profile.samples.forEach((id, i) => { const n = byId.get(id), cf = n.callFrame; const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}`; const d = dts[i] || 0; self.set(key, (self.get(key) || 0) + d); total += d; });
  const top = [...self.entries()].filter(([k]) => !k.startsWith("(idle)") && !k.startsWith("(program)")).sort((a, b) => b[1] - a[1]).slice(0, 14);
  const prog = [...self.entries()].filter(([k]) => k.startsWith("(program)") || k.startsWith("(garbage")).map(([k, v]) => `${k.split(" ")[0]} ${(v / 1000 / secs).toFixed(0)}ms/s`).join(" ");
  console.log(`\n=== ${map}: map=${info.map} mobs=${info.mobs} players=${info.players} | frames ${ft.length} avg ${avg.toFixed(1)}ms p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)} max ${ft[ft.length - 1].toFixed(1)} | ${prog}`);
  console.log("  per frame:", Object.entries(cnt).map(([k, v]) => k + " " + Math.round(v / nf)).join(", "));
  for (const [k, v] of top) console.log(`  ${(v / 1000 / secs).toFixed(1).padStart(6)} ms/s  ${k}`);
  await pg.evaluate(() => __game.disconnect()); await new Promise((r) => setTimeout(r, 1500)); await ctx.close(); await new Promise((r) => setTimeout(r, 2500));
}
if (errs.length) console.log("ERRORS\n" + errs.join("\n"));
await browser.close();
