// Headless checks for the monster art (public/mobart*.js): every creature the server
// can send has a model, every model builds in every pose with finite numbers, and in
// every facing and pose it stays inside its canvas (so nothing is cut off at the edge).
// node tests/mobart.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";
import * as MA from "../public/mobart.js";

const { Model, pose, BEASTS, CANVAS, PAD, GK, NFR } = MA._test;
const D = L.defs();

// every kind on the wire (and every recoloured one's body) has a model
for (const [k, d] of Object.entries(D.mobs)) assert.ok(MA.has(d.sp || k), `no model for ${k} (${d.sp})`);
for (const [k, d] of Object.entries(D.mobs)) if (d.tint) assert.ok(MA.MOB_TINTS.includes(d.tint), `unknown tint ${d.tint} on ${k}`);

const E = Math.PI / 6, CE = Math.cos(E), SE = Math.sin(E);
let prims = 0;
const out = new Map();
for (const [kind, def] of Object.entries(BEASTS)) {
  assert.ok(CANVAS[def.size], `${kind}: size class ${def.size}`);
  const N = Math.ceil((def.n || CANVAS[def.size]) * GK / 2) * 2, k = GK * (def.k || 1);
  for (let fr = 0; fr < NFR; fr++) {
    const p = pose(fr), M = new Model();
    def.draw(M, p);
    assert.ok(M.P.length >= 4, `${kind} frame ${fr}: too few shapes`);
    prims += M.P.length;
    for (const q of [...M.P, ...M.D]) {
      for (const v of q.c) assert.ok(Number.isFinite(v), `${kind} frame ${fr}: a shape at ${q.c}`);
      const r = typeof q.r === "number" && q.k !== "slit" ? q.r : Array.isArray(q.r) ? Math.max(...q.r) : 0;
      assert.ok(Number.isFinite(r) && r >= 0, `${kind} frame ${fr}: radius ${q.r}`);
      if (p.dead) continue;                     // a fallen body is laid flat by the renderer
      // in each of the four facings, the shape's projection stays on the canvas
      for (const yaw of [135, 45, 225, 315]) {
        const a = (yaw * Math.PI) / 180, F = [Math.cos(a), Math.sin(a)], R = [-F[1], F[0]];
        const x = (q.c[0] * F[0] + q.c[2] * R[0]) * k, z = (q.c[0] * F[1] + q.c[2] * R[1]) * k, y = q.c[1] * k;
        const sx = N / 2 + x, sy = N - Math.round(Math.max(PAD, N * 0.14)) - y * CE + z * SE, rr = r * k;
        // one pixel of margin for the outline
        const over = Math.max(1 - (sx - rr), sx + rr - (N - 1), 1 - (sy - rr), sy + rr - (N - 1));
        if (over > 0) { out.set(kind, Math.max(out.get(kind) || 0, over)); if (process.env.WHY) console.log(kind, fr, yaw, sx.toFixed(1), sy.toFixed(1), rr.toFixed(1), N); }
      }
    }
  }
}
assert.equal(out.size, 0, `cut off at the canvas edge (pixels over): ${[...out].map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ')}`);
console.log(`mobart: ${Object.keys(BEASTS).length} creatures × ${NFR} poses, ${prims} shapes, all inside their canvases`);
