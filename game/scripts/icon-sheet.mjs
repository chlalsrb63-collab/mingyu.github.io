// The skill icon sheet in its jobs' colours: serves public/ plus `/_defs.json` (logic.defs()), opens _icons.html, saves a PNG.
//   node scripts/icon-sheet.mjs [--out shots/icons.png] [--ids slash,rend]
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { args, launch, serve, GAME, PUBLIC } from "./artkit.mjs";

const opt = args();
const out = join(GAME, String(opt.out || "shots/icons.png"));
const L = await import(pathToFileURL(join(GAME, "src/logic.js")).href);
const srv = await serve(PUBLIC, 0, { "/_defs.json": JSON.stringify(L.defs()) });
const browser = await launch();
try {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/_icons.html${opt.ids ? "?ids=" + opt.ids : ""}`);
  await pg.waitForFunction(() => document.title === "ready", null, { timeout: 15000 });
  const bad = (await pg.textContent("#o")).trim();
  if (bad || errs.length) console.log("problems:\n  " + [bad, ...errs].filter(Boolean).join("\n  "));
  await pg.locator("#c").screenshot({ path: out });
  console.log("saved " + out);
} finally {
  await browser.close();
  srv.close();
}
