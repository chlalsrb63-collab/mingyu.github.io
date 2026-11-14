#!/usr/bin/env node
// Render the CURRENT code-drawn art to PNG files in asset/_export/<category>/, to browse
// it in the asset gallery (asset/index.html) next to new or external art, and to compare.
//
//   node scripts/export-art.mjs            (npm run art:export; then npm run art:gallery)
//   node scripts/export-art.mjs --only weapons,monsters     (some categories)
//
// Categories: weapons (every kind × tier world sprite + 16×16 icon, legendary/set/skin
// looks, +7/+10 glow) · gear (helm armor gloves boots ring amulet icons) · items (potions,
// food, scrolls, materials, misc icons) · monsters (every monster's icon) · characters
// (species presets) · cosmetics (worn on a hero + their icon).
// Files are named like the approved art in asset/weapons/… (sword_t3.png, icon_sword_t3.png,
// sword_lg_chain.png …) so a replacement can be compared one to one. asset/_export/ is
// gitignored and wiped on every run. Writes asset/_export/labels.json (file → Korean name).
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { args, launch, serve, PUBLIC, GAME, ASSET, dataUrlBuffer } from "./artkit.mjs";

const opt = args();
const only = opt.only ? new Set(String(opt.only).split(",")) : null;
const OUT = join(ASSET, "_export");

const L = await import(pathToFileURL(join(GAME, "src", "logic.js")).href);
const defs = L.defs();
const data = { items: defs.items, mobs: defs.mobs, cos: defs.cos, legend: Object.keys(defs.legend), sets: Object.keys(defs.sets), only: only ? [...only] : null };

const PAGE = `<!doctype html><meta charset="utf-8"><title>export</title><body></body>`;
const srv = await serve(PUBLIC, 0, { "/__export.html": PAGE });
const browser = await launch(opt.channel);
const errors = [];
let files = [];
try {
  const pg = await browser.newPage();
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await pg.goto(`http://127.0.0.1:${srv.address().port}/__export.html`);
  files = await pg.evaluate(async (D) => {
    const want = (c) => !D.only || D.only.includes(c);
    const WP = await import("/weapons.js");
    const SP = await import("/sprites.js");
    const out = [];
    const put = (path, cv, label) => out.push({ path, url: cv.toDataURL("image/png"), label: label || "" });

    if (want("weapons")) {
      const names = {}; // w_<id>_<tier> item names by kind
      for (const it of Object.values(D.items)) if (it.type === "weapon") (names[it.wk] ||= [])[it.tier - 1] = it.name;
      for (const k of Object.keys(WP.DESIGNS)) {
        const dir = `weapons/${k}/`;
        for (let t = 1; t <= 5; t++) {
          const n = (names[k] || [])[t - 1] || "";
          put(`${dir}${k}_t${t}.png`, WP.weaponSprite(k, { wt: t }), n);
          put(`${dir}icon_${k}_t${t}.png`, WP.weaponIcon(k, t), n);
        }
        // a power, set or skin recolours the design of whatever tier it sits on: shown on tier 3
        for (const m of WP.MOTIFS) {
          const what = D.legend.includes(m) ? "lg" : D.sets.includes(m) ? "set" : "skin";
          const o = what === "skin" ? { ws: m } : { wl: m };
          put(`${dir}${k}_${what}_${m}.png`, WP.weaponSprite(k, { wt: 3, ...o }), WP.motifName(m));
          put(`${dir}icon_${k}_${what}_${m}.png`, WP.weaponIcon(k, 3, o), WP.motifName(m));
        }
        for (const e of [7, 10]) {
          put(`${dir}${k}_t5_e${e}.png`, WP.weaponSprite(k, { wt: 5, we: e, wq: 3 }), `+${e}`);
          put(`${dir}icon_${k}_t5_e${e}.png`, WP.weaponIcon(k, 5, { we: e }), `+${e}`);
        }
      }
    }

    if (want("gear") || want("items")) {
      const Art = await import("/art.js");
      const Growth = await import("/growth.js");
      const set = Growth.icons(Art.buildIcons(D.items));
      const GEAR = ["helm", "armor", "gloves", "boots", "ring", "amulet"];
      const ITEM_DIR = { pot: "potion", food: "food", fish: "food", scroll: "scroll", buff: "scroll", mat: "material", rune: "material" };
      for (const id of Object.keys(set.cv)) {
        const it = D.items[id];
        if (it && it.type === "weapon") continue; // in weapons/
        if (it && GEAR.includes(it.type)) { if (want("gear")) put(`gear/${it.type}/${id}.png`, set.cv[id], it.name); continue; }
        if (want("items")) put(`items/${(it && ITEM_DIR[it.type]) || "misc"}/${id}.png`, set.cv[id], it ? it.name : id);
      }
    }

    if (want("monsters")) {
      const MA = await import("/mobart.js");
      for (const [k, d] of Object.entries(D.mobs)) {
        const body = d.sp || k;
        if (!MA.has(body)) continue;
        put(`monsters/${k}.png`, MA.icon(body, d.tint || null), d.name);
      }
    }

    if (want("characters") || want("cosmetics")) {
      const SPC = await import("/species.js");
      if (want("characters")) {
        SPC.PRESETS.forEach(([name, look], i) => {
          const sh = SP.personSheet(SP.playerLook("warrior", look, {}));
          put(`characters/preset_${String(i + 1).padStart(2, "0")}.png`, sh.front[0], name);
          put(`characters/preset_${String(i + 1).padStart(2, "0")}_side.png`, sh.side[0], name);
        });
      }
      if (want("cosmetics")) {
        const WR = await import("/wardrobe.js");
        const look = SPC.PRESETS[0][1];
        const plain = () => SP.playerLook("warrior", [], {});
        for (const [id, c] of Object.entries(D.cos)) {
          const a = WR.ART[id];
          if (!a) continue;
          const slot = a[0];
          if (slot === "wskin") { put(`cosmetics/wskin/${id}.png`, WP.weaponSprite("sword", { wt: 3, ws: a[1] }), c.name); continue; }
          const sh = SP.personSheet({ ...SP.playerLook("warrior", look, {}), cos: [id] });
          put(`cosmetics/${slot}/${id}.png`, slot === "back" ? sh.back[0] : sh.front[0], c.name);
          put(`cosmetics/${slot}/icon_${id}.png`, WR.cosIcon(id, SP.personSheet, plain), c.name);
        }
      }
    }
    return out;
  }, data);
} finally {
  await browser.close();
  srv.close();
}

if (errors.length) console.log("page problems:\n  " + errors.slice(0, 20).join("\n  "));
if (!files.length) { console.error("nothing was rendered"); process.exit(1); }

// wipe what is being re-exported, then write
const cats = [...new Set(files.map((f) => f.path.split("/")[0]))];
if (!only) await rm(OUT, { recursive: true, force: true });
else for (const c of cats) await rm(join(OUT, c), { recursive: true, force: true });
const labels = {};
for (const f of files) {
  const p = join(OUT, ...f.path.split("/"));
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, dataUrlBuffer(f.url));
  if (f.label) labels["_export/" + f.path] = f.label;
}
let old = {};
if (only) { try { old = JSON.parse(await readFile(join(OUT, "labels.json"), "utf8")); } catch { /* first run */ } }
await writeFile(join(OUT, "labels.json"), JSON.stringify({ ...old, ...labels }, null, 1));
const by = {};
for (const f of files) { const c = f.path.split("/")[0]; by[c] = (by[c] || 0) + 1; }
console.log(`exported ${files.length} PNGs to ${OUT}: ` + Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", "));
