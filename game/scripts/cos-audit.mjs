#!/usr/bin/env node
// Contact sheets of the cosmetics (외형) on every species, drawn in node (no browser):
// the same sprites.js / species.js / wardrobe.js code the game runs, on a tiny canvas
// (scripts/pixcanvas.mjs), written as PNGs to game/shots_cos/ (gitignored).
//
//   node scripts/cos-audit.mjs                       every slot × view (stand frame) + fur variants
//   node scripts/cos-audit.mjs --slot hat --view side --frame 2 --fur 15
//   node scripts/cos-audit.mjs --item hat_wizard     one item: 15 species × 3 views × 6 frames
//   node scripts/cos-audit.mjs --items a,b --sp 7    some items on one species, every view and frame
//   node scripts/cos-audit.mjs --giant hat_crown     the warrior's giant form (1.6×) as the game scales it
//   --out <dir> (default shots_cos) · --tag <prefix> · --z <zoom, 3>
//
// Rows/columns are numbered with a tiny pixel font; the console prints the legend.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installCanvas, PixCanvas } from "./pixcanvas.mjs";
import { args, writePng, GAME } from "./artkit.mjs";

installCanvas();
const SP = await import("../public/sprites.js");
const SPC = await import("../public/species.js");
const WR = await import("../public/wardrobe.js");

const opt = args();
const OUT = join(GAME, String(opt.out || "shots_cos"));
mkdirSync(OUT, { recursive: true });
const TAG = opt.tag ? String(opt.tag) + "-" : "";
const Z = Number(opt.z || 3);
const VIEWS = ["front", "side", "back"];
const FURS = { white: 0, dark: 15, orange: 10, brown: 12 };

/** A species' default look (its ears, nose, tail, markings) in fur `fur` (index into FUR). */
export const lookFor = (sp, fur = 0) => { const lk = SPC.withSpecies(SPC.cleanLook([]), sp); lk[SPC.LI.fur] = fur; return lk; };
const frameOf = (lk, cos, view, f) => SP.personSheet(SP.playerLook("warrior", lk, { cos }))[view][f];

// ── a page to paste frames on
function page(w, h, bg = [106, 154, 90]) {
  const c = new PixCanvas(w, h), g = c.getContext("2d");
  g.fillStyle = `rgb(${bg.join(",")})`; g.fillRect(0, 0, w, h);
  return c;
}
const DIG = { 0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111" };
function num(c, n, x, y, s = 2, col = "#ffffff") {
  const g = c.getContext("2d"); g.fillStyle = col;
  String(n).split("").forEach((ch, k) => { const p = DIG[ch]; if (!p) return; for (let i = 0; i < 15; i++) if (p[i] === "1") g.fillRect(x + k * 4 * s + (i % 3) * s, y + Math.floor(i / 3) * s, s, s); });
}
/** Paste a 32×32 frame, cropped to its middle `crop` pixels, at zoom Z; `flip` mirrors (the side view walking left). */
function paste(c, fr, x, y, crop = 26, flip = false, z = Z) {
  const g = c.getContext("2d"), o = (32 - crop) >> 1, oy = opt.cy !== undefined ? Number(opt.cy) : 32 - crop - 1;
  const d = fr.getContext("2d").getImageData(0, 0, 32, 32).data;
  for (let v = 0; v < crop; v++) for (let u = 0; u < crop; u++) {
    const sx = flip ? 31 - (o + u) : o + u, i = ((oy + v) * 32 + sx) * 4;
    if (!d[i + 3]) continue;
    g.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`; g.fillRect(x + u * z, y + v * z, z, z);
  }
}
function save(c, name) {
  const p = join(OUT, TAG + name + ".png");
  writeFileSync(p, writePng({ w: c.width, h: c.height, data: Buffer.from(c._data.buffer.slice(0)) }));
  console.log("wrote", p);
}
// --crop n: the middle n×n pixels of each frame (from row --cy, default: down to the feet)
const NSP = SPC.SPECIES.length, CROP = Number(opt.crop || 26), CELL = CROP * Z + 2, LAB = 22;

/** Items (rows) × species (columns), one view and frame. */
function slotSheet(slot, view, f, fur, name) {
  let ids = Object.keys(WR.ART).filter((id) => WR.ART[id][0] === slot);
  if (opt.rows) { const [a, b] = String(opt.rows).split("-").map(Number); ids = ids.slice(a, (b ?? a) + 1); }
  const sps = opt.sp !== undefined ? String(opt.sp).split(",").map(Number) : [...Array(NSP).keys()];
  const c = page(LAB + sps.length * CELL, LAB + ids.length * CELL);
  sps.forEach((s, k) => num(c, s, LAB + k * CELL + 4, 4));
  ids.forEach((id, r) => {
    num(c, r, 2, LAB + r * CELL + 8);
    sps.forEach((s, k) => paste(c, frameOf(lookFor(s, fur), [id], view, f), LAB + k * CELL, LAB + r * CELL, CROP, view === "side" && opt.flip));
  });
  console.log(`${name}: rows ${ids.map((id, i) => i + "=" + id).join(" ")}`);
  save(c, name);
}
/** One item (or outfit): species (rows) × views × frames (columns). `each`: one row per item × species instead. */
function itemSheet(cos, name, fur = 0, sps = [...Array(NSP).keys()], each = false) {
  const R = each ? cos.flatMap((id) => sps.map((s) => [[id], s])) : sps.map((s) => [cos, s]);
  const c = page(LAB + 18 * CELL + 2 * 8, LAB + R.length * CELL);
  R.forEach(([ids, s], r) => {
    num(c, s, 2, LAB + r * CELL + 8);
    VIEWS.forEach((v, vi) => { for (let f = 0; f < 6; f++) paste(c, frameOf(lookFor(s, fur), ids, v, f), LAB + (vi * 6 + f) * CELL + vi * 8, LAB + r * CELL, CROP); });
  });
  for (let k = 0; k < 18; k++) num(c, k % 6, LAB + k * CELL + Math.floor(k / 6) * 8 + 30, 4);
  save(c, name);
}
/** The giant form as scene2d draws it: the frame scaled 1.6× with smoothing off (nearest neighbour). */
function giantSheet(cos, name) {
  const gz = 1.6, N = Math.round(32 * gz), z = 2, W = N * z + 4;
  const sps = [0, 3, 7, 8, 12, 13];
  const c = page(sps.length * 3 * W + 8, 2 * W + 8);
  sps.forEach((s, i) => VIEWS.forEach((v, vi) => [0, 2].forEach((f, fi) => {
    const fr = frameOf(lookFor(s), cos, v, f), big = new PixCanvas(N, N);
    big.getContext("2d").drawImage(fr, 0, 0, N, N);
    const g = c.getContext("2d"), d = big._data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = (y * N + x) * 4; if (!d[k + 3]) continue; g.fillStyle = `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`; g.fillRect(4 + (i * 3 + vi) * W + x * z, 4 + fi * W + y * z, z, z); }
  })));
  save(c, name);
}

if (opt.item || opt.items) {
  const cos = String(opt.item || opt.items).split(",");
  const sps = opt.sp !== undefined ? String(opt.sp).split(",").map(Number) : undefined;
  itemSheet(cos, (opt.each ? "each-" : "item-") + cos.join("+") + (opt.fur ? "-f" + opt.fur : ""), Number(opt.fur || 0), sps, !!opt.each);
} else if (opt.giant) {
  giantSheet(String(opt.giant).split(","), "giant-" + String(opt.giant).replace(/,/g, "+"));
} else if (opt.slot) {
  const v = String(opt.view || "front"), f = Number(opt.frame || 0), fur = Number(opt.fur || 0);
  slotSheet(String(opt.slot), v, f, fur, `${opt.slot}-${v}-f${f}-fur${fur}` + (opt.rows ? "-r" + opt.rows : ""));
} else {
  for (const slot of ["hat", "top", "back", "face"]) for (const v of VIEWS) slotSheet(slot, v, 0, 0, `${slot}-${v}`);
  for (const [fn, fi] of Object.entries(FURS)) if (fi) for (const slot of ["hat", "face", "top"]) slotSheet(slot, "front", 0, fi, `${slot}-front-${fn}`);
  for (const slot of ["hat", "back"]) slotSheet(slot, "side", 2, 0, `${slot}-side-stepA`);
}
