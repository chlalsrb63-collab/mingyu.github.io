// Refresh the offline development dashboard after rebuilding the local game rules.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { atlas, defs, newChar } from "../src/logic.js";
import { LOOK_N, LI } from "../public/species.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const paths = ["game/src", "game/public", "game/data"];
const build = git("log", "-1", "--format=%h", "--", ...paths);
const date = git("show", "-s", "--format=%cs", build);
const branch = git("branch", "--show-current") || "detached HEAD";
const dirty = !!git("status", "--porcelain", "--", ...paths);
const d = defs(), { maps } = atlas();
const count = (object) => Object.keys(object).length;
const named = (id) => d.mobs[id]?.name || id;

const snapshot = {
  build, date, branch, dirty, sheet: newChar("대시보드", null).v, recallMs: d.recallMs,
  metrics: {
    maps: d.maps.length, jobs: Object.values(d.jobs).filter(j => j.kind !== "none").length,
    skills: count(d.skills), mobs: Object.values(d.mobs).filter(m => !m.chest).length,
    bosses: Object.values(d.mobs).filter(m => m.boss).length, items: count(d.items),
    gear: Object.values(d.items).filter(i => Object.hasOwn(d.sockCaps, i.type)).length,
    coop: d.coop.kinds.length, alba: d.alba.order.length, cos: count(d.cos),
    species: LOOK_N[LI.sp], tails: LOOK_N[LI.tail], cast: d.npclife.cast.length,
    main: d.quests.length, side: d.side.length, recipes: count(d.life.recipes),
    waypoints: d.waypoints.length, pfx: d.pfxOn.length, runes: count(d.runes),
    runeSets: count(d.runeSets), achievements: d.achievements.length, maxLv: d.maxLv,
  },
  tests: readFileSync(new URL("../tests/LIST", import.meta.url), "utf8").split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#")).length,
  jobs: Object.values(d.jobs).filter(j => j.kind !== "none").map(j => j.name),
  elements: d.elements.types.map(k => d.elements.info[k].name),
  life: d.life.names,
  alba: d.alba.order.map(k => d.alba.rows[k].name),
  maps: d.maps.map(({ id, name, kind, w, h, band, bosses, mobs, wpn, to }) => {
    const map = maps[id];
    const editorSource = `game/data/maps/${id}.json`;
    return {
      id, name, kind, w, h, band, wpn,
      mobs: mobs.filter(k => !d.mobs[k]?.chest).map(named), bosses: bosses.map(named),
      npc: (map.npcs || []).filter(n => !n.thing).map(n => n.name),
      buildings: (map.big || []).filter(b => b.t === "bld" && b.name).map(b => b.name),
      to: to.map(k => maps[k]?.name || k),
      source: existsSync(new URL(`../../${editorSource}`, import.meta.url)) ? editorSource : "game/src/logic/34-maps-world.js",
    };
  }),
};

const file = new URL("../../docs/development-status.html", import.meta.url);
const current = readFileSync(file, "utf8");
const start = '<script id="snapshot" type="application/json">';
const from = current.indexOf(start);
const to = current.indexOf("</script>", from);
if (from < 0 || to < 0) throw new Error("Dashboard snapshot block is missing");
const json = JSON.stringify(snapshot).replace(/</g, "\\u003c");
const updated = current.slice(0, from + start.length) + "\n" + json + "\n" + current.slice(to);
if (process.argv.includes("--check")) {
  if (updated !== current) throw new Error("Dashboard snapshot is stale. Run node scripts/dev-status.mjs after building logic");
} else if (updated !== current) {
  writeFileSync(file, updated);
}
console.log(`Development dashboard: ${build}, ${snapshot.metrics.maps} maps, ${snapshot.tests} suites${dirty ? " (working changes)" : ""}`);
