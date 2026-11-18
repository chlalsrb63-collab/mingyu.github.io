// Native actor frames use half-pixel art while preserving the old world size and foot anchor.
import assert from "node:assert/strict";
import { installCanvas } from "../scripts/pixcanvas.mjs";
import { atlas } from "../src/logic.js";

installCanvas();
const SP = await import("../public/sprites.js");
const SPC = await import("../public/species.js");
const WR = await import("../public/wardrobe.js");
const views = ["front", "side", "back"], frames = Object.values(SP.FRAME);
const nativeSize = 64, logicalSize = 32;
assert.equal(SP.SIZE, logicalSize);
assert.equal(SP.PERSON_SIZE, nativeSize);
assert.deepEqual(SP.FOOT, [16, 29]);

function inspect(frame, size, label) {
  assert.equal(frame.width, size, label);
  assert.equal(frame.height, size, label);
  const data = frame.getContext("2d").getImageData(0, 0, size, size).data;
  const bounds = [size, size, -1, -1];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const alpha = data[(y * size + x) * 4 + 3];
    if (!alpha) continue;
    if (alpha !== 255) assert.fail(`${label}: blended pixel at ${x},${y}`);
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  }
  assert.ok(bounds[2] >= bounds[0] && bounds[3] >= bounds[1], label + ": empty");
  assert.ok(bounds[0] > 0 && bounds[1] > 0 && bounds[2] < size - 1 && bounds[3] < size - 1, label + ": clipped");
  return { bounds, data };
}

const looks = new Map();
const add = (look) => looks.set(JSON.stringify(look), look);
const base = SPC.SPECIES.map((_, species) => SPC.withSpecies(SPC.cleanLook([]), species));
for (const look of base) add(look);
for (const [, look] of SPC.PRESETS) add(look);
for (const [i, part] of SPC.PARTS.entries()) {
  if (part.key === "sp") continue;
  for (let v = 0; v < SPC.LOOK_N[i]; v++) {
    const look = base[(v + i) % base.length].slice();
    look[i] = v;
    add(look);
  }
}

let subpixels = 0;
for (const look of looks.values()) {
  const o = SPC.lookOf(look);
  const regular = SP.personSheet(o), legacy = SP.personSheet(o, 1);
  // The native rear tail is independently drawn. Compare the body footprint with that layer hidden.
  const body = SPC.tailOf(o) === 1 ? null : SP.personSheet({ ...o, tail: 1 }).back;
  const legacyBody = body && SP.personSheet({ ...o, tail: 1 }, 1).back;
  for (const view of views) for (const f of frames) {
    const label = `look ${look.join("/")} ${view} ${f}`;
    const { bounds: lo, data: old } = inspect(legacy[view][f], logicalSize, label);
    const { bounds: hi, data } = inspect(regular[view][f], nativeSize, label);
    const directRearTail = view === "back" && body;
    const oldBody = directRearTail ? inspect(legacyBody[f], logicalSize, label).bounds : lo;
    const newBody = directRearTail ? inspect(body[f], nativeSize, label).bounds : hi;
    const doubled = oldBody.map((v, i) => 2 * v + Number(i >= 2));
    assert.ok(newBody.every((v, i) => Math.abs(v - doubled[i]) <= 1), label + ": body mass moved");
    for (let i = 0; i < old.length; i += 4) {
      const x = (i / 4) % logicalSize, y = Math.floor(i / (4 * logicalSize));
      const offset = (y * 2 * nativeSize + x * 2) * 4;
      if ([offset, offset + 4, offset + nativeSize * 4, offset + nativeSize * 4 + 4]
        .some(j => old[i + 3] !== data[j + 3] || (old[i + 3] && old[i] !== data[j]))) subpixels++;
    }
  }
}
assert.ok(subpixels > looks.size * 10, "native sprites contain deliberate refinements");

const npc = new Map(Object.values(atlas().maps).flatMap(m => (m.npcs || []).filter(n => !n.thing).map(n => [n.id, n])));
for (const n of npc.values()) {
  const sheet = SP.npcSheet(n);
  for (const view of views) for (const f of frames) inspect(sheet[view][f], nativeSize, `${n.id} ${view} ${f}`);
}
assert.equal(SP.juanaSheet().side[0].width, nativeSize);
assert.equal(SP.personSheet(SP.mobLook("thug")).front[0].width, logicalSize);

// Every wearable draws native art in all its visible views, across variants with very different anchors.
const cosmetics = Object.entries(WR.ART).filter(([, item]) => item[0] !== "wskin");
const fitting = [0, 3, 6, 7, 8, 12, 13].map(i => SPC.lookOf(base[i]));
for (const [i, [id, item]] of cosmetics.entries()) {
  const o = fitting[i % fitting.length], naked = SP.personSheet(o);
  const worn = SP.personSheet({ ...o, cos: [id] });
  const ink = WR.cosIcon(id, SP.personSheet, () => fitting[0]);
  assert.equal(ink.width, 16, id);
  assert.equal(ink.height, 16, id);
  for (const view of views) {
    let visible = false;
    for (const f of frames) {
      const frame = worn[view][f], label = `${item[0]} ${id} ${view} ${f}`;
      const { data } = inspect(frame, nativeSize, label);
      const other = naked[view][f].getContext("2d").getImageData(0, 0, nativeSize, nativeSize).data;
      if (!visible) visible = other.some((v, j) => v !== data[j]);
    }
    if (WR.seenFrom(id).includes(view)) assert.ok(visible, `${id} vanishes from ${view}`);
  }
}
console.log(`person64: ${looks.size} looks, ${npc.size} NPCs and ${cosmetics.length} wearables at 64px`);
