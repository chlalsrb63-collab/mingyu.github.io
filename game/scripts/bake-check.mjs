// The chunked ground bake checked against the whole-map bake in a headless browser: every pixel
// of both water frames must match. Prints, per map, the whole bake's time and canvas memory and
// the chunks' (public/_chunks.html does the work; public/_maps.json comes from dump-maps.mjs).
//
//   node scripts/bake-check.mjs [--maps meadow,forest] [--src other.json] [--whole]
// Exit code 1 when any pixel differs.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { args, launch, serve, PUBLIC, GAME } from "./artkit.mjs";

const opt = args();
if (!opt.src && !existsSync(join(PUBLIC, "_maps.json"))) execFileSync(process.execPath, [join(GAME, "scripts", "dump-maps.mjs")], { stdio: "inherit" });
const srv = await serve(PUBLIC);
const browser = await launch(opt.channel);
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const q = new URLSearchParams();
if (opt.maps) q.set("maps", opt.maps);
if (opt.src) q.set("src", opt.src);
if (opt.whole) q.set("whole", "1");
await page.goto(`http://127.0.0.1:${srv.address().port}/_chunks.html?${q}`);
const res = await page.waitForFunction(() => window.__result, null, { timeout: 600000 }).then((h) => h.jsonValue()).catch((e) => { errors.push(String(e)); return null; });
await browser.close();
srv.close();
for (const e of errors) console.error("page error:", e);
if (!res) process.exit(2);
let bad = 0;
for (const [id, r] of Object.entries(res)) {
  if (r.diffPx || r.pulseDiff) bad++;
  console.log(`${id.padEnd(8)} ${r.w}x${r.h}  whole ${r.wholeMs} ms (tiles ${r.parts[0]}, details ${r.parts[1]}, glints ${r.parts[2]}, canvas ${r.parts[3]}) ${(r.wholePx / 1e6).toFixed(1)} Mpx = ${r.wholeMB} MB`
    + (r.chunks ? ` | ${r.chunks} chunks: first ${r.firstChunkMs} ms, max ${r.chunkMsMax} ms, all ${r.chunkMsTotal} ms, ${r.chunkMB} MB each | ${r.diffPx ? `${r.diffPx} px DIFFER (first ${r.firstDiff})` : "pixel-identical"}${r.pulseDiff !== undefined ? `, glow layer ${r.pulseDiff ? r.pulseDiff + " channel values differ" : "identical"}` : ""}` : ""));
}
process.exit(bad || errors.length ? 1 : 0);
