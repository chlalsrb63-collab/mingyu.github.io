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
const L = await import("../src/logic.js");

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
  if (slot === "top" && typeof TOP[design] !== "function") for (const v of VIEWS) {
    const rows = TOP[design][v];
    assert.ok(Array.isArray(rows) && rows.length >= 3 && rows.length <= 4, `${id}: a ${v} template of 3 or 4 rows`);
    for (const r of rows) assert.equal(r.length, 8, `${id}: ${v} rows are 8 wide`);
  }
}

// Every new outfit combines boutique pieces with an achievement or rare boss reward.
const D = L.defs();
const collections = [
  ["willowpatrol", ["shop", "shop", "ach", "shop"], "wp3"],
  ["coraltrade", ["shop", "shop", "ach", "shop"], "deliver20"],
  ["brasssurvey", ["shop", "shop", "ach", "shop"], "dim1"],
  ["moonarchive", ["token", "token", "rareBoss", "shop"]],
  ["mapleramblers", ["shop", "token", "rareBoss", "token"]],
];
for (const [set, sources, ach] of collections) {
  const pieces = Object.entries(D.cos).filter(([, c]) => c.set === set);
  assert.deepEqual(pieces.map(([, c]) => c.slot), ["hat", "top", "back", "face"], `${set}: all four outfit slots`);
  assert.deepEqual(pieces.map(([, c]) => c.src), sources, `${set}: acquisition sources`);
  const [prize, reward] = pieces[2];
  assert.equal(reward.ach, ach || "");
  assert.ok(pieces.every(([id, c]) => WR.ART[id]?.[0] === c.slot && D.cosN[c.n] === id), `${set}: every wire code resolves to an asset`);

  const S = L.setup();
  const ch = L.newChar("외형검수", [], "sword");
  ch.gold = 10000;
  ch.cos.tokens = 40;
  if (ach) ch.ach.push(ach);
  else ch.cos.own.push(prize);  // equip the boss drop after it is in the collection
  assert.ok(L.devPlace(ch, "boutique", 11, 4), "stand by the boutique's tailor");
  L.addPlayer(S, "review", ch);
  const p = S.players.review;
  if (ach) assert.ok(p.ch.cos.own.includes(prize), `${set}: an existing achievement still awards the new item`);
  for (const [id, c] of pieces) {
    const a = { t: c.src === "shop" || c.src === "token" ? "cos_buy" : "cos_eq", id };
    assert.ok(L.validateAction(S, p.pid, a).ok, `${id}: can ${a.t} through the rules`);
    L.applyAction(S, p.pid, a);
  }
  const total = (src) => pieces.filter(([, c]) => c.src === src).reduce((sum, [, c]) => sum + c.price, 0);
  assert.equal(p.ch.gold, 10000 - total("shop"), `${set}: gold prices were charged`);
  assert.equal(p.ch.cos.tokens, 40 - total("token"), `${set}: token prices were charged`);
  const worn = Object.fromEntries(pieces.map(([id, c]) => [c.slot, id]));
  assert.deepEqual(p.ch.cos.on, worn, `${set}: all pieces are worn together`);
  const loaded = L.setup();
  L.addPlayer(loaded, "reload", L.exportChar(S, p.pid));
  assert.deepEqual(loaded.players.reload.ch.cos.on, worn, `${set}: equipped pieces persist after reload`);
  assert.deepEqual(L.viewFor(S, p.pid).self.cos.on, worn, `${set}: equipped IDs reach the client`);
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
  const plain = SP.personSheet(o, 1);
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
  const lines = [...fails].map(([k, v]) => `  ${k}: ${v.length} (e.g. ${v.slice(0, process.env.WHY ? 400 : 3).join("; ")})`);
  assert.fail(`cosmetic art problems:\n${lines.join("\n")}`);
}
console.log(`cosmetics: ${ids.length} items × ${looks.length} looks × 3 views × 6 frames = ${frames} frames clean (${(ms / 1000).toFixed(1)} s)`);

// Hanbok and career-uniform sets: eight shop pieces each, new wire codes, art present.
for (const set of ["hanbok", "career"]) {
  const pieces = Object.entries(D.cos).filter(([, c]) => c.set === set);
  assert.equal(pieces.length, 8, `${set}: eight pieces`);
  assert.ok(pieces.every(([id, c]) => c.n > 182 && c.src === "shop" && WR.ART[id]?.[0] === c.slot && D.cosN[c.n] === id), `${set}: codes, shop and assets`);
}
