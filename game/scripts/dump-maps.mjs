#!/usr/bin/env node
// Writes public/_maps.json: every generated map exactly as the server sends it
// (logic.js mapPayload) plus its campfires, spawn boxes and walkable mask. The
// dev preview pages (public/_scene.html, _world.html, _iso.html, _over.html,
// _swing.html) read it, so map art can be checked without the server or a login.
//
//   node scripts/dump-maps.mjs            (npm run maps:dump; shot.mjs runs it for you)
//
// The file is generated and git-ignored. Pure node, no dependencies.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "_maps.json");

// logic.js keeps its maps / FIRES / mapPayload private; evaluate a copy with one extra export
// (allMaps() builds every map: the generated ones are otherwise only built on first use).
const src = readFileSync(join(ROOT, "src", "logic.js"), "utf8") +
  "\nconst __all = allMaps();\nexport const __dump = Object.fromEntries(Object.keys(__all).map((k) => [k, { ...mapPayload(__all[k]), fires: FIRES[k] || [], spawns: __all[k].spawns, reach: Array.from(__all[k].reach || []).join(''), zone: __all[k].zone ? Array.from(__all[k].zone).join('') : null }]));\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
writeFileSync(OUT, JSON.stringify(L.__dump));
console.log(`public/_maps.json: ${Object.keys(L.__dump).join(", ")}`);
