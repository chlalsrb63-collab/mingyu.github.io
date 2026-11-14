// Job emblems (public/jobicons.js): every job of the rules has a mark, every mark is a 14×14 grid,
// and no two look alike — by silhouette and by colour pair — so a job reads at a glance at 1×.
// node tests/jobicons.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as L from "../src/logic.js";
import * as J from "../public/jobicons.js";

const jobs = L.defs().jobs, ids = Object.keys(jobs);
assert.ok(ids.length >= 22, "the rules' job list");
for (const id of ids) assert.ok(J.ART[id], `no emblem for the job ${id} (${jobs[id].name})`);
for (const id of J.ALL) assert.ok(jobs[id], `an emblem for a job the rules do not have: ${id}`);
assert.deepEqual(J.badRows(), [], "emblem rows are 14×14 of . # o - = *");

// a mark is built from its job's own weapons, in the rules' order, and says what it shows
for (const id of ids) {
  const [a, b, , note] = J.ART[id], wk = jobs[id].wk;
  assert.equal(a || undefined, wk[0], `${id}: first weapon`);
  assert.equal(b || undefined, wk[1], `${id}: second weapon`);
  assert.ok(note && /[가-힣]/.test(note), `${id}: a Korean note for the detail card`);
  const cells = J.mask(id).join("").split("1").length - 1;
  assert.ok(cells >= 30 && cells <= 150, `${id}: ${cells} filled cells (a readable mass, not a blob)`);
}
// old class names and unknown ids fall back, never throw
assert.equal(J.jobId("warrior"), "swordsman");
assert.equal(J.jobId("nope"), "adventurer");

// pairwise distinct: colour pairs unique, silhouettes far apart (a mirror image does not count as different)
const pair = new Map();
for (const id of ids) {
  const k = J.colorsOf(id).join();
  assert.ok(!pair.has(k), `${id} and ${pair.get(k)} wear the same colours`);
  pair.set(k, id);
}
let worst = [999, "", ""];
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const A = J.mask(ids[i]).join(""), B = J.mask(ids[j]).join("");
  const Bm = J.mask(ids[j]).map((r) => [...r].reverse().join("")).join("");
  let d = 0, mirror = 0;
  for (let n = 0; n < A.length; n++) { if (A[n] !== B[n]) d++; if (A[n] !== Bm[n]) mirror++; }
  const m = Math.min(d, mirror);
  if (m < worst[0]) worst = [m, ids[i], ids[j]];
  assert.ok(m >= 24, `${ids[i]} and ${ids[j]} have nearly the same silhouette (${m} cells differ)`);
}

// the preview page names every job as the rules do
const page = readFileSync(new URL("../public/_jobs.html", import.meta.url), "utf8");
for (const id of ids) assert.ok(page.includes(`${id}: "${jobs[id].name}"`), `_jobs.html: the name of ${id}`);

console.log(`jobicons ok — ${ids.length} emblems, closest pair ${worst[1]}/${worst[2]} (${worst[0]} cells)`);
