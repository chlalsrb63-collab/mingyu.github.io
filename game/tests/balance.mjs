// The balance probe against the pre-jobs baseline (docs/design/jobs-and-stats.md F.3).
// node tests/balance.mjs
//
// BASE was measured with scripts/balance-probe.mjs on the rules just before J1 (origin/main e14fb5e:
// four classes, levels 1–50, old level = the tier probed, in the first open square of the old meadow). The new rules are
// probed in a fixed flat arena (balance-probe.mjs ARENA), so map changes never move them. With weapon skills (J2) every weapon kind must land
// within ±25 % of its old class's kills/min at every tier probed (the bow, against the average of all four: −25 %…+10 %).
// Every hybrid, probed holding each of its two weapons, lands in the band of its pair at T13 (both masteries 15), T25
// and T40 (below). Tune the skill table (03-skills.js), not these ranges.   node tests/balance.mjs [-v] [hybrid ids…]
import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import { probe, ARENA, PROBE } from "../scripts/balance-probe.mjs";

/** kills/min, damage taken/min, deaths in 120 s — old class at old level = tier. */
export const BASE = {
  warrior: { 5: [37, 586, 4], 13: [37.5, 2063, 7], 25: [22.5, 5975, 12], 40: [15.5, 5076, 6] },
  rogue: { 5: [49.5, 565, 6], 13: [38.5, 2735, 14], 25: [22.5, 7007, 20], 40: [19, 6980, 10] },
  lancer: { 5: [41.5, 480, 4], 13: [40, 1570, 6], 25: [20, 5183, 12], 40: [12.5, 4316, 5] },
  mage: { 5: [35.5, 758, 8], 13: [33.5, 2399, 13], 25: [20, 6214, 18], 40: [17, 5168, 8] },
};
/** Which old class each weapon kind is compared with (the bow with the average of all four). */
const VS = { sword: ["warrior"], dagger: ["rogue"], spear: ["lancer"], staff: ["mage"], book: ["mage"], bow: ["warrior", "rogue", "lancer", "mage"] };

// Plain weapons in the preceding socket-stone build (e6ae3f0), before adding resistance and ailments.
// Each entry is the mean of the three arena seeds used below. Include hammer in the modern control.
const ELEMENT_BASE = {
  sword: [38.67, 37.17, 20.00, 18.00], dagger: [36.33, 39.67, 22.67, 23.67],
  spear: [36.83, 31.67, 16.67, 11.83], staff: [35.17, 36.67, 23.00, 21.50],
  book: [40.50, 37.50, 24.00, 19.33], bow: [33.67, 32.83, 18.83, 18.00],
  hammer: [39.33, 37.50, 21.33, 15.00],
};

/** A borderline single run can change when the loot stream takes different draws. On a miss,
 * check whether five fixed trials put the full 95% interval outside the original band. */
function withinBand(wk, tier, first, min, max) {
  if (first >= min && first <= max) return true;
  const samples = [first, ...[1, 2, 3, 4].map((offset) => probe(L, wk, tier, PROBE.secs, { seed: ARENA.seed + offset }).kpm)];
  const mean = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  const variance = samples.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (samples.length - 1);
  const margin = 2.776 * Math.sqrt(variance / samples.length); // t critical value, 4 degrees of freedom
  return mean + margin >= min && mean - margin <= max;
}

if (!L.hero) {
  // the old rules: the probe must still reproduce the stored baseline exactly
  for (const cls of Object.keys(BASE)) for (const t of PROBE.tiers) {
    const r = probe(L, cls, t);
    assert.deepEqual([r.kpm, r.dtpm, r.deaths], BASE[cls][t], `${cls} T${t}`);
  }
  console.log("balance ok — baseline reproduced");
} else {
  const rows = [], D = L.defs(), modern = !!D.elements;
  const baseOfElement = (wk, t) => ELEMENT_BASE[wk][PROBE.tiers.indexOf(t)];
  for (const wk of Object.keys(modern ? ELEMENT_BASE : VS)) for (const t of PROBE.tiers) {
    if (modern) {
      const samples = [0, 1, 2].map((offset) => probe(L, wk, t, PROBE.secs, { seed: ARENA.seed + offset }).kpm);
      const average = samples.reduce((n, v) => n + v, 0) / samples.length;
      const base = baseOfElement(wk, t), ratio = average / base;
      assert.ok(ratio >= 0.85 && ratio <= 1.15, `${wk} T${t}: ${average.toFixed(2)} k/m, ×${ratio.toFixed(2)} of the socket-stone control ${base} (allowed ×0.85–×1.15)`);
      rows.push(`${wk.padEnd(6)} T${t}: ${average.toFixed(2)} k/m (control ${base}, ×${ratio.toFixed(2)})`);
      continue;
    }
    const r = probe(L, wk, t);
    const base = VS[wk].reduce((s, c) => s + BASE[c][t][0], 0) / VS[wk].length;
    const x = r.kpm / base, [lo, hi] = wk === "bow" ? [0.75, 1.1] : [0.75, 1.25];
    assert.ok(withinBand(wk, t, r.kpm, base * lo, base * hi), `${wk} T${t}: ${r.kpm} kills/min is ×${x.toFixed(2)} of the old ${base.toFixed(1)} (allowed ×${lo}–×${hi})`);
    rows.push(`${wk.padEnd(6)} T${String(t).padEnd(2)} ${String(r.kpm).padStart(5)} k/m (base ${base.toFixed(1)}, ×${(r.kpm / base).toFixed(2)})  ${String(r.dtpm).padStart(5)} dmg/m  ${r.deaths} deaths`);
  }
  // Hybrids (docs/design/jobs-and-stats.md "Hybrid expansion"): probe each of their weapons from
  // the first tier one can be had (both masteries 15 at T13). Its kills/min (the mean of its two hands) must land in the
  // band of its pair: against the mean of its two weapons' baselines, ×0.75 up to the mean of their upper bounds (×1.25 a
  // weapon, ×1.1 the bow); and neither hand may fall below ×0.7 of its own weapon's baseline.
  const bad = [], only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const hammerBase = new Map();
  const HI = (wk) => (wk === "bow" ? 1.1 : 1.25);
  // each hand's floor (the owner kept ×0.7 when hitstun grew and lifted runearcher's bow instead, 2026-11-15)
  const HAND_MIN = 0.7;
  function baseOf(wk, t) {
    if (modern) return baseOfElement(wk, t);
    if (wk === "hammer") {
      if (!hammerBase.has(t)) hammerBase.set(t, probe(L, wk, t).kpm);
      return hammerBase.get(t);
    }
    return VS[wk].reduce((s, c) => s + BASE[c][t][0], 0) / VS[wk].length;
  }
  for (const j of Object.keys(D.jobs).filter((id) => D.jobs[id].kind === "hybrid" && (!only.length || only.includes(id)))) for (const t of PROBE.hybTiers) {
    const [a, b] = D.jobs[j].wk;
    const run = (wk, offset) => probe(L, wk, t, PROBE.secs, { job: j, seed: ARENA.seed + offset });
    const base = (baseOf(a, t) + baseOf(b, t)) / 2, hi = (HI(a) + HI(b)) / 2;
    const ra = run(a, 0), rb = run(b, 0);
    let ak = ra.kpm, bk = rb.kpm;
    const pairRate = () => (ak + bk) / 2 / base;
    const handLow = (wk, kpm) => kpm / baseOf(wk, t) < HAND_MIN;
    if (modern && (pairRate() < 0.75 || pairRate() > hi || handLow(a, ak) || handLow(b, bk))) {
      // Use the same three seeds as the modern control for a single run at the boundary.
      ak = (ak + run(a, 1).kpm + run(a, 2).kpm) / 3;
      bk = (bk + run(b, 1).kpm + run(b, 2).kpm) / 3;
    }
    const x = pairRate();
    if (x < 0.75 || x > hi) bad.push(`${j} T${t}: ${((ak + bk) / 2).toFixed(2)} kills/min is ×${x.toFixed(2)} of the pair's ${base.toFixed(1)} (allowed ×0.75–×${hi.toFixed(3)})`);
    for (const [wk, kpm] of [[a, ak], [b, bk]]) if (handLow(wk, kpm)) bad.push(`${j}/${wk} T${t}: ${kpm.toFixed(2)} kills/min is ×${(kpm / baseOf(wk, t)).toFixed(2)} of the control ${baseOf(wk, t).toFixed(1)} (at least ×${HAND_MIN})`);
    rows.push(`${j.padEnd(12)} T${String(t).padEnd(2)} ×${x.toFixed(2)} of ${base.toFixed(1)} · ${a} ${ak.toFixed(2)} k/m (${ra.dtpm} dmg/m, ${ra.deaths} d) · ${b} ${bk.toFixed(2)} k/m (${rb.dtpm} dmg/m, ${rb.deaths} d)`);
  }
  if (process.argv.includes("-v")) console.log(rows.join("\n"));
  assert.deepEqual(bad, [], "every hybrid inside the band of its pair");
  console.log(`balance ok — every weapon kind and every hybrid within its range of the ${modern ? "socket-stone control" : "old classes"}`);
}
