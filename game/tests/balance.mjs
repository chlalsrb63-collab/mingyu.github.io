// The balance probe against the pre-jobs baseline (docs/design/jobs-and-stats.md F.3).
// node tests/balance.mjs
//
// BASE was measured with scripts/balance-probe.mjs on the rules before J1 (four classes,
// levels 1–50, old level = the tier probed). J1 only reports the new numbers next to it;
// J2 turns the comparison into asserts (within ±25 % kills/min per weapon kind, bow −25 %/+10 %).
import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import { probe, PROBE } from "../scripts/balance-probe.mjs";

/** kills/min, damage taken/min, deaths in 120 s — old class at old level = tier. */
export const BASE = {
  warrior: { 5: [38.5, 546, 4], 13: [38, 1902, 7], 25: [23.5, 5067, 10], 40: [16, 4410, 5] },
  rogue: { 5: [48, 620, 6], 13: [39, 2521, 12], 25: [23, 6417, 18], 40: [18.5, 6754, 10] },
  lancer: { 5: [39.5, 521, 4], 13: [39.5, 1221, 5], 25: [20, 4487, 11], 40: [12.5, 3474, 4] },
  mage: { 5: [31.5, 470, 5], 13: [33, 2185, 12], 25: [20, 5105, 15], 40: [17, 4036, 6] },
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
