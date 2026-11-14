// The balance probe against the pre-jobs baseline (docs/design/jobs-and-stats.md F.3).
// node tests/balance.mjs
//
// BASE was measured with scripts/balance-probe.mjs on the rules just before J1 (origin/main e14fb5e:
// four classes, levels 1–50, old level = the tier probed). J1 only reports the new numbers next to it;
// J2 turns the comparison into asserts (within ±25 % kills/min per weapon kind, bow −25 %/+10 %).
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
    assert.ok(r.kpm > 0, `${wk} T${t} kills something`);
    rows.push(`${wk.padEnd(6)} T${String(t).padEnd(2)} ${String(r.kpm).padStart(5)} k/m (base ${base.toFixed(1)}, ×${(r.kpm / base).toFixed(2)})  ${String(r.dtpm).padStart(5)} dmg/m  ${r.deaths} deaths`);
  }
  console.log(rows.join("\n"));
  console.log("balance ok — probe reported (J2 asserts the ranges)");
}
