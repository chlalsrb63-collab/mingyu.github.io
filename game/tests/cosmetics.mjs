// Headless guard for the cosmetics' art (public/wardrobe.js): every hat, top, back piece and
// face piece is drawn on every species (its own ears, tail and markings; light and dark fur)
// in every view and frame, with the game's own drawing code on a tiny node canvas
// (scripts/pixcanvas.mjs), and each composed frame must:
//   - stay inside the 32×32 sheet with a pixel to spare (nothing cut off),
//   - keep a closed outline: every pixel touching the background is ink (no colour bleeding
//     into the grass), and no lone pixel floats on its own,
//   - leave every eye pixel as it was (pieces made to cover an eye — shades, a patch — excepted),
//   - draw something in each view it claims (front, side, back),
//   - stay in its place: a top on the body, a back piece behind the head from the back and
//     only its clasp or straps in front, a hat above the nose, a face piece on the head.
// node tests/cosmetics.mjs   (WHY=1 prints the first failures in detail)
import assert from "node:assert/strict";
import { installCanvas } from "../scripts/pixcanvas.mjs";

installCanvas();
const SP = await import("../public/sprites.js");
const SPC = await import("../public/species.js");
const WR = await import("../public/wardrobe.js");

const t0 = Date.now();
const SZ = 32, VIEWS = ["front", "side", "back"], FRAMES = [0, 1, 2, 3, 4, 5];
const { HAT, TOP, BACK, FACE } = WR._test;
const ids = Object.keys(WR.ART).filter((id) => WR.ART[id][0] !== "wskin");

// ── every item's design exists, and the templates are well formed
for (const id of ids) {
  const [slot, design] = WR.ART[id];
  const table = { hat: HAT, top: TOP, back: BACK, face: FACE }[slot];
  assert.ok(table && table[design], `${id}: no ${slot} design "${design}"`);
  if (slot === "hat") assert.ok(["through", "behind", undefined].includes(HAT[design].ears), `${id}: ears is "through" or "behind"`);
  if (slot === "top") for (const v of VIEWS) {
    const rows = TOP[design][v];
    assert.ok(Array.isArray(rows) && rows.length >= 3 && rows.length <= 4, `${id}: a ${v} template of 3 or 4 rows`);
    for (const r of rows) assert.equal(r.length, 8, `${id}: ${v} rows are 8 wide`);
  }
}

const INKS = new Set(["#2b2233", ...Object.values(HAT).map((h) => h.ink).filter(Boolean)]);
const hexAt = (d, i) => "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
const fails = new Map();
const fail = (kind, msg) => { if (!fails.has(kind)) fails.set(kind, []); fails.get(kind).push(msg); };

const looks = [];
for (let sp = 0; sp < SPC.SPECIES.length; sp++) for (const fur of [0, 15]) {
  const lk = SPC.withSpecies(SPC.cleanLook([]), sp);
  lk[SPC.LI.fur] = fur;
  looks.push([`sp${sp}/fur${fur}`, lk]);
}
// a few presets for their eyes, markings and tails
for (const [n, lk] of SPC.PRESETS.filter((_, i) => i % 3 === 0)) looks.push([n, lk]);

let frames = 0;
for (const [name, lk] of looks) {
  const o = SP.playerLook("warrior", lk, {});
  const plain = SP.personSheet(o);
  for (const id of ids) {
    const slot = WR.ART[id][0], ow = { ...o, cos: [id] }, seen = WR.seenFrom(id);
    for (const view of VIEWS) {
      let drew = false;
      for (const f of FRAMES) {
        const base = plain[view][f], fr = WR.dress(base, ow, view, f);
        const A = WR.anchors(base, ow, view, f);
        const b = base.getContext("2d").getImageData(0, 0, SZ, SZ).data;
        const d = fr.getContext("2d").getImageData(0, 0, SZ, SZ).data;
        const at = `${id} on ${name} ${view} f${f}`;
        frames++;
        const solid = (x, y) => x >= 0 && y >= 0 && x < SZ && y < SZ && d[(y * SZ + x) * 4 + 3] > 0;
        for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
          const i = (y * SZ + x) * 4;
          if (!d[i + 3] && !b[i + 3]) continue;
          if (d[i + 3] !== b[i + 3] || d[i] !== b[i] || d[i + 1] !== b[i + 1] || d[i + 2] !== b[i + 2]) {
            drew = true;
            // where a change may be
            if (b[i + 3]) {
              if (slot === "top" && (y < A.bt - 1 || y > A.foot)) fail("top off the body", `${at} (${x},${y})`);
              if (slot === "back" && A.back && y < A.bt) fail("back piece over the head", `${at} (${x},${y})`);
              if (slot === "back" && !A.back && (y < A.bt - 1 || x < 12 || x > 19)) fail("back piece in front of the figure", `${at} (${x},${y})`);
              if (slot === "hat" && y >= A.ny) fail("hat over the nose", `${at} (${x},${y})`);
            }
            if (slot === "face" && !b[i + 3]) fail("face piece off the head", `${at} (${x},${y})`);
          }
          if (!d[i + 3]) continue;
          if (x === 0 || y === 0 || x === SZ - 1 || y === SZ - 1) fail("cut off at the sheet's edge", `${at} (${x},${y})`);
          const n = solid(x - 1, y) + solid(x + 1, y) + solid(x, y - 1) + solid(x, y + 1);
          if (!n) fail("a lone pixel", `${at} (${x},${y})`);
          if (n < 4 && !INKS.has(hexAt(d, i))) fail("outline broken (colour against the background)", `${at} (${x},${y}) ${hexAt(d, i)}`);
        }
        // the eyes
        if (!A.back && !WR.coversEyes(id)) for (const [x0, y0, x1, y1] of WR.eyeBoxes(A)) for (let y = y0; y <= y1; y++) {
          const h = A.halfAt(y);
          for (let x = Math.max(x0, 16 - h); x <= Math.min(x1, 15 + h); x++) {
            const i = (y * SZ + x) * 4;
            if (!b[i + 3] || !WR.isEyePix(b[i], b[i + 1], b[i + 2])) continue;
            if (d[i] !== b[i] || d[i + 1] !== b[i + 1] || d[i + 2] !== b[i + 2]) fail("covers an eye", `${at} (${x},${y})`);
          }
        }
      }
      if (seen.includes(view) && !drew) fail("no art in a view", `${id} on ${name} ${view}`);
    }
  }
}

const ms = Date.now() - t0;
if (fails.size) {
  const lines = [...fails].map(([k, v]) => `  ${k}: ${v.length} (e.g. ${v.slice(0, process.env.WHY ? 12 : 3).join("; ")})`);
  assert.fail(`cosmetic art problems:\n${lines.join("\n")}`);
}
console.log(`cosmetics: ${ids.length} items × ${looks.length} looks × 3 views × 6 frames = ${frames} frames clean (${(ms / 1000).toFixed(1)} s)`);
