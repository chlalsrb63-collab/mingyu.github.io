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
const raidSeed = Number(process.env.TT_HANOK_SEED || 2719) | 0;

// logic.js keeps its maps / FIRES / mapPayload private; evaluate a copy with one extra export
// (allMaps() builds every map: the generated ones are otherwise only built on first use).
const src = readFileSync(join(ROOT, "src", "logic.js"), "utf8") +
  `
const __all = allMaps();
for (let floor = 1; floor <= HANOK_FLOORS.length; floor++) {
  const seed = Math.imul(${raidSeed}, floor), theme = dimTheme(seed >>> 0, floor);
  const id = "hanok-preview-" + floor;
  __all[id] = dimension({ id, seed, theme, lv: 20, floor, hanok: true });
}
// the field raids (maps ?map=raid-forest-1 … raid-maple-3): one preview per floor, at the middle of each window
for (const raid of Object.keys(RAID)) if (RAID[raid].field) for (let floor = 1; floor <= DIM.floors; floor++) {
  const seed = Math.imul(${raidSeed}, floor), theme = dimTheme(seed >>> 0, floor, raid), id = "raid-" + raid + "-" + floor;
  __all[id] = dimension({ id, seed, theme, lv: Math.floor(toTier((RAID[raid].minLv + RAID[raid].maxLv) / 2)), floor, raid });
}
export const __dump = Object.fromEntries(Object.entries(__all).map(([id, m]) => [id, {
  ...mapPayload(m), fires: FIRES[id] || [], spawns: m.spawns, reach: Array.from(m.reach || []).join(""),
  zone: m.zone ? Array.from(m.zone).join("") : null,
  ...(m.dim ? { previewEntry: m.dim.start, previewHall: m.dim.boss } : {}),
}]));
`;
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
writeFileSync(OUT, JSON.stringify(L.__dump));
console.log(`public/_maps.json: ${Object.keys(L.__dump).join(", ")}`);
