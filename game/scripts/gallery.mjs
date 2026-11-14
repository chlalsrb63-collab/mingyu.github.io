#!/usr/bin/env node
// Index every file in the repo's asset/ folder for the gallery page (asset/index.html).
//
//   node scripts/gallery.mjs          (npm run art:gallery; ASSETS.bat runs export + this)
//
// Writes asset/gallery.json (the data) and asset/gallery.js (the same data as a script,
// because a page opened by double-click — file:// — may not fetch files but may load
// scripts). Both are gitignored. Images get their pixel size; an approved file with a
// code-drawn twin in asset/_export/ (same path) is linked to it for side-by-side viewing.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, extname, relative, sep } from "node:path";
import { ASSET, pngSize } from "./artkit.mjs";

const IMG = new Set([".png", ".gif", ".jpg", ".jpeg", ".webp", ".bmp"]);
const AUDIO = new Set([".ogg", ".mp3", ".wav", ".flac"]);
const SKIP = new Set(["index.html", "gallery.json", "gallery.js", ".gitkeep"]);

async function walk(dir, out = []) {
  let list;
  try { list = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of list) {
    if (e.name.startsWith(".") && e.name !== ".gitkeep") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (!SKIP.has(e.name)) out.push(p);
  }
  return out;
}

let labels = {};
try { labels = JSON.parse(await readFile(join(ASSET, "_export", "labels.json"), "utf8")); } catch { /* no export yet */ }

const files = await walk(ASSET);
const rel = (p) => relative(ASSET, p).split(sep).join("/");
const all = new Set(files.map(rel));
const groups = new Map();
for (const f of files) {
  const r = rel(f), ext = extname(f).toLowerCase();
  if (r === "_export/labels.json") continue;
  const dir = r.includes("/") ? r.slice(0, r.lastIndexOf("/")) : ".";
  const st = await stat(f);
  const e = { p: r, n: r.slice(r.lastIndexOf("/") + 1), bytes: st.size, kind: IMG.has(ext) ? "image" : AUDIO.has(ext) ? "audio" : "file" };
  if (ext === ".png") { const s = pngSize(await readFile(f)); if (s) { e.w = s.w; e.h = s.h; } }
  const label = labels[r] || labels["_export/" + r];
  if (label) e.label = label;
  if (!r.startsWith("_export/") && all.has("_export/" + r)) e.twin = "_export/" + r;
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(e);
}
const order = (d) => (d.startsWith("_export") ? "2" : d.startsWith("_preview") ? "3" : d === "." ? "0" : "1") + d;
const out = {
  generated: new Date().toISOString(),
  groups: [...groups.keys()].sort((a, b) => order(a).localeCompare(order(b))).map((dir) => ({
    dir, files: groups.get(dir).sort((a, b) => a.n.localeCompare(b.n, "en", { numeric: true })),
  })),
};
const json = JSON.stringify(out);
await writeFile(join(ASSET, "gallery.json"), json);
await writeFile(join(ASSET, "gallery.js"), "window.GALLERY = " + json + ";\n");
const n = out.groups.reduce((a, g) => a + g.files.length, 0);
console.log(`gallery: ${n} files in ${out.groups.length} folders → ${join(ASSET, "gallery.json")} (open asset/index.html)`);
