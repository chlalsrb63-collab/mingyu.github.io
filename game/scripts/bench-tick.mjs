#!/usr/bin/env node
// Headless load benchmark and golden check of the rules (not a test: not in tests/LIST).
// ~40 bots over the town, 버드나무 거리, six hunting grounds, three rift instances and a co-op shift,
// walking and fighting for N ticks, exactly as room.ts drives a channel: tick, viewFor per player, endTick.
//   node scripts/bench-tick.mjs [--ticks 3000]           ms per tick / viewFor (avg p95 max), bytes per snapshot, heap
//   node scripts/bench-tick.mjs --golden [--ticks 1500]  one hash of every snapshot, the world and every sheet
//   node --expose-gc --cpu-prof --cpu-prof-dir=shots scripts/bench-tick.mjs   a CPU profile
// The bots are deterministic (their own LCG, the world's fixed clock), so two runs of the same rules
// print the same golden hash: an optimisation that changes behaviour shows up as a different hash.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const GOLDEN = process.argv.includes("--golden");
const TICKS = +arg("ticks", GOLDEN ? 1500 : 3000);
const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { DIM_TOWN, COOP, mapOf, MOBS, SKILL, SKILL_ORDER, stats, atkRange, aimIdx, ITEMS };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t, T = 16;

let seed = 12345;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
let now = 5_000_000;
const S = L.setup();
S.now = now; S.last = now;
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const WK = ["sword", "dagger", "spear", "staff", "book", "bow"];
let n = 0;
/** A hero of level `lvl` placed on `map` at its entrance (or at x, y). */
function bot(map, lvl, kind, x = -1, y = -1) {
  const pid = "b" + n, ch = L.hero("봇" + n, { wk: WK[n % 6], lvl, migrate: true });
  n++;
  ch.map = map; ch.x = x; ch.y = y;
  ch.inv.push({ id: "hp_l", n: 99 }, { id: "mp_l", n: 99 });
  L.addPlayer(S, pid, ch);
  const p = S.players[pid];
  p.bot = { kind, seed: n };
  return p;
}
const party = (ps) => { for (const p of ps.slice(1)) { act(ps[0].pid, { t: "pinv", e: p.eid }); act(p.pid, { t: "pacc" }); } };

const ps = [];
for (let i = 0; i < 6; i++) ps.push(bot("town", 20 + i, "stroll"));
for (let i = 0; i < 4; i++) ps.push(bot("willow", 30 + i, "stroll"));
for (const [map, lv] of [["meadow", 8], ["forest", 20], ["crypt", 30], ["cave", 50], ["city", 60], ["sewer", 70]])
  for (let i = 0; i < 4; i++) ps.push(bot(map, lv + i, "hunt"));
// three rifts: a party of four, a party of two, one alone
const [OBX, OBY] = [X.DIM_TOWN.keeper[0] * T + 8, (X.DIM_TOWN.keeper[1] - 1) * T + 10];
for (const size of [4, 2, 1]) {
  const g = [];
  for (let i = 0; i < size; i++) g.push(bot("town", 80, "rift", OBX, OBY));
  if (size > 1) party(g);
  act(g[0].pid, { t: "dim_open" });
  if (size > 1) for (const p of g.slice(1)) act(p.pid, { t: "dim_ready", id: S.parties[g[0].party].rc.id, ok: 1 });
  ps.push(...g);
}
// a co-op shift for two at 동동아파트
{
  const J = X.COOP.apt, lob = X.mapOf(J.lobby), dd = lob.npcs.find((o) => o.id === "dongdong");
  const g = [0, 1].map((i) => bot(J.lobby, 30, "coop", dd.x * T + 8 + i * 4, dd.y * T + 28));
  party(g);
  act(g[0].pid, { t: "coop_start", k: "apt" });
  ps.push(...g);
}

function drive(p) {
  const b = p.bot;
  if (p.dead) { act(p.pid, { t: "respawn" }); return; }
  const st = X.stats(p);
  if (p.hp < st.mhp * 0.4) act(p.pid, { t: "use", id: "hp_l" });
  if (p.mp < st.mmp * 0.2) act(p.pid, { t: "use", id: "mp_l" });
  const walk = (dx, dy) => {
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, st.spd * 0.1 / d), x0 = p.x, y0 = p.y;
    act(p.pid, { t: "mv", x: p.x + dx * k, y: p.y + dy * k, a: X.aimIdx(dx, dy) });
    if (p.x === x0 && p.y === y0) b.ang = rnd() * Math.PI * 2;
  };
  if (b.kind === "coop") { if (rnd() < 0.3) act(p.pid, { t: "coop_act" }); }
  if (b.kind === "stroll" || b.kind === "coop") {
    if (b.ang === undefined || rnd() < 0.02) b.ang = rnd() * Math.PI * 2;
    if (rnd() < 0.7) walk(Math.cos(b.ang) * 20, Math.sin(b.ang) * 20);
    return;
  }
  // hunters and rift bots: the nearest monster within 400 px, or a wander
  const rt = S.maps[p.map];
  let tgt = null, bd = 400;
  for (const m of rt.mobs) {
    if (m.dead || X.MOBS[m.k].chest) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < bd) { bd = d; tgt = m; }
  }
  if (!tgt) { if (b.ang === undefined || rnd() < 0.03) b.ang = rnd() * Math.PI * 2; walk(Math.cos(b.ang) * 20, Math.sin(b.ang) * 20); return; }
  const aim = X.aimIdx(tgt.x - p.x, tgt.y - p.y);
  if (bd > X.atkRange(p) * 0.85) { walk(tgt.x - p.x, tgt.y - p.y); return; }
  for (let i = X.SKILL_ORDER.length - 1; i >= 0; i--) {
    const id = X.SKILL_ORDER[i], sk = X.SKILL[id];
    if (sk.kind === "p" || sk.noAuto) continue;
    if (act(p.pid, { t: "sk", id, a: aim }).ok) return;
  }
  act(p.pid, { t: "atk", a: aim });
}

const tickMs = [], viewMs = [], callMs = [];
let bytes = 0, snaps = 0;
const hash = createHash("sha256");
globalThis.gc?.();
const heap0 = process.memoryUsage().heapUsed;
for (let i = 0; i < TICKS; i++) {
  for (const p of ps) if (S.players[p.pid]) drive(p);
  now += 100;
  let t0 = performance.now();
  L.tick(S, now);
  tickMs.push(performance.now() - t0);
  let vsum = 0;
  for (const pid of Object.keys(S.players)) {
    t0 = performance.now();
    const v = L.viewFor(S, pid);
    const dt = performance.now() - t0;
    vsum += dt; callMs.push(dt);
    if (!v) continue;
    const s = JSON.stringify(v);
    bytes += s.length; snaps++;
    if (GOLDEN) hash.update(pid + s);
  }
  viewMs.push(vsum);
  L.endTick(S);
}
globalThis.gc?.();
const heap1 = process.memoryUsage().heapUsed;

const q = (a) => { const s = [...a].sort((x, y) => x - y), avg = a.reduce((x, y) => x + y, 0) / a.length; return `avg ${avg.toFixed(3)}  p95 ${s[Math.floor(s.length * 0.95)].toFixed(3)}  max ${s[s.length - 1].toFixed(3)}`; };
const where = {};
for (const p of Object.values(S.players)) where[p.map.startsWith("dim:") ? "dim" : p.map] = (where[p.map.startsWith("dim:") ? "dim" : p.map] || 0) + 1;
const rts = Object.values(S.maps), sum = (f) => rts.reduce((a, rt) => a + f(rt), 0);
console.log(`${Object.keys(S.players).length} players, ${TICKS} ticks, dims ${Object.keys(S.dims).length}, mobs ${sum((rt) => rt.mobs.length)}, drops ${sum((rt) => rt.drops.length)}:`, JSON.stringify(where));
console.log(`tick ms        ${q(tickMs)}`);
console.log(`viewFor ms/tick ${q(viewMs)}   per call ${q(callMs)}`);
console.log(`snapshot bytes avg ${(bytes / snaps).toFixed(0)}   heap ${(heap0 / 1048576).toFixed(1)} → ${(heap1 / 1048576).toFixed(1)} MB${globalThis.gc ? "" : " (run with --expose-gc for a fair number)"}`);
if (GOLDEN) {
  for (const pid of Object.keys(S.players).sort()) hash.update(JSON.stringify(L.exportChar(S, pid)));
  // the world itself (an object met a second time, p.S or mob.slot.mob, is written as a mark)
  const seen = new WeakSet();
  hash.update(JSON.stringify(S, (k, v) => {
    if (ArrayBuffer.isView(v)) return Array.from(v);
    if (v && typeof v === "object") { if (seen.has(v)) return "<ref>"; seen.add(v); }
    return v;
  }));
  console.log("golden", hash.digest("hex").slice(0, 16));
}
