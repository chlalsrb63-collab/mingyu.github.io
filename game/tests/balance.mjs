// The balance probe against the pre-jobs baseline (docs/design/jobs-and-stats.md F.3).
// node tests/balance.mjs
//
// BASE was measured with scripts/balance-probe.mjs on the rules just before J1 (origin/main e14fb5e:
// four classes, levels 1–50, old level = the tier probed). With weapon skills (J2) every weapon kind must land
// within ±25 % of its old class's kills/min at every tier probed (the bow, against the average of all four: −25 %…+10 %).
// Every hybrid, probed holding each of its two weapons, lands in the band of its pair at T13 (both masteries 15), T25
// and T40 (below). Tune the skill table (03-skills.js), not these ranges.   node tests/balance.mjs [-v] [hybrid ids…]
import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import { probe, PROBE } from "../scripts/balance-probe.mjs";

/** kills/min, damage taken/min, deaths in 120 s — old class at old level = tier. */
export const BASE = {
  warrior: { 5: [37, 586, 4], 13: [37.5, 2063, 7], 25: [22.5, 5975, 12], 40: [15.5, 5076, 6] },
  rogue: { 5: [49.5, 565, 6], 13: [38.5, 2735, 14], 25: [22.5, 7007, 20], 40: [19, 6980, 10] },
  lancer: { 5: [41.5, 480, 4], 13: [40, 1570, 6], 25: [20, 5183, 12], 40: [12.5, 4316, 5] },
  mage: { 5: [35.5, 758, 8], 13: [33.5, 2399, 13], 25: [20, 6214, 18], 40: [17, 5168, 8] },
};
/** Which old class each weapon kind is compared with (the bow with the average of all four). */
const VS = { sword: ["warrior"], dagger: ["rogue"], spear: ["lancer"], staff: ["mage"], book: ["mage"], bow: ["warrior", "rogue", "lancer", "mage"] };

if (!L.hero) {
  // the old rules: the probe must still reproduce the stored baseline exactly
  for (const cls of Object.keys(BASE)) for (const t of PROBE.tiers) {
    const r = probe(L, cls, t);
    assert.deepEqual([r.kpm, r.dtpm, r.deaths], BASE[cls][t], `${cls} T${t}`);
  }
  console.log("balance ok — baseline reproduced");
} else {
  const rows = [];
  for (const wk of Object.keys(VS)) for (const t of PROBE.tiers) {
    const r = probe(L, wk, t);
    const base = VS[wk].reduce((s, c) => s + BASE[c][t][0], 0) / VS[wk].length;
    const x = r.kpm / base, [lo, hi] = wk === "bow" ? [0.75, 1.1] : [0.75, 1.25];
    assert.ok(x >= lo && x <= hi, `${wk} T${t}: ${r.kpm} kills/min is ×${x.toFixed(2)} of the old ${base.toFixed(1)} (allowed ×${lo}–×${hi})`);
    rows.push(`${wk.padEnd(6)} T${String(t).padEnd(2)} ${String(r.kpm).padStart(5)} k/m (base ${base.toFixed(1)}, ×${(r.kpm / base).toFixed(2)})  ${String(r.dtpm).padStart(5)} dmg/m  ${r.deaths} deaths`);
  }
  // hybrids (docs/design/jobs-and-stats.md "Hybrid expansion"): each of the 15 is probed holding either of its weapons, from
  // the first tier one can be had (both masteries 15 at T13). Its kills/min (the mean of its two hands) must land in the
  // band of its pair: against the mean of its two weapons' baselines, ×0.75 up to the mean of their upper bounds (×1.25 a
  // weapon, ×1.1 the bow); and neither hand may fall below ×0.7 of its own weapon's baseline.
  const D = L.defs(), bad = [], only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const HI = (wk) => (wk === "bow" ? 1.1 : 1.25), baseOf = (wk, t) => VS[wk].reduce((s, c) => s + BASE[c][t][0], 0) / VS[wk].length;
  for (const j of Object.keys(D.jobs).filter((id) => D.jobs[id].kind === "hybrid" && (!only.length || only.includes(id)))) for (const t of PROBE.hybTiers) {
    const [a, b] = D.jobs[j].wk, ra = probe(L, a, t, PROBE.secs, { job: j }), rb = probe(L, b, t, PROBE.secs, { job: j });
    const base = (baseOf(a, t) + baseOf(b, t)) / 2, x = (ra.kpm + rb.kpm) / 2 / base, hi = (HI(a) + HI(b)) / 2;
    if (x < 0.75 || x > hi) bad.push(`${j} T${t}: ${(ra.kpm + rb.kpm) / 2} kills/min is ×${x.toFixed(2)} of the pair's ${base.toFixed(1)} (allowed ×0.75–×${hi.toFixed(3)})`);
    for (const [wk, r] of [[a, ra], [b, rb]]) if (r.kpm / baseOf(wk, t) < 0.7) bad.push(`${j}/${wk} T${t}: ${r.kpm} kills/min is ×${(r.kpm / baseOf(wk, t)).toFixed(2)} of the old ${baseOf(wk, t).toFixed(1)} (at least ×0.7)`);
    rows.push(`${j.padEnd(12)} T${String(t).padEnd(2)} ×${x.toFixed(2)} of ${base.toFixed(1)} · ${a} ${ra.kpm} k/m (×${(ra.kpm / baseOf(a, t)).toFixed(2)}, ${ra.dtpm} dmg/m, ${ra.deaths} d) · ${b} ${rb.kpm} k/m (×${(rb.kpm / baseOf(b, t)).toFixed(2)}, ${rb.dtpm} dmg/m, ${rb.deaths} d)`);
  }
  if (process.argv.includes("-v")) console.log(rows.join("\n"));
  assert.deepEqual(bad, [], "every hybrid inside the band of its pair");
  console.log("balance ok — every weapon kind and every hybrid within its range of the old classes");
}
