#!/usr/bin/env node
// The skill probe (docs/design/skills-v2.md "Measurements"): every job, at a tier, in band-tier plain gear,
// fights pinned training dummies in the balance probe's flat arena and reports
//   st   single-target damage/s (one dummy of the band's first monster kind, 60 s)
//   aoe  damage/s summed over a pack of six dummies (60 s)
//   b5   burst: damage dealt to the single dummy in the first 5 s
//   heal HP healed/min (pack run) · mp MP spent/min (single run) · boss seconds to kill the tier's boss dummy
// Dummies never move or strike (pinned every tick), so knockback and pulls change nothing: only damage counts.
// A hybrid is probed holding each of its two weapons; its row is the mean.
//   node scripts/skill-probe.mjs [tier…] [job…]      (default tiers 25 40; all jobs)
//   import { skillProbe } from "./skill-probe.mjs"
//   env SKP_NOSK=all (or ids) skips skills, SKP_LOG=1 prints the single-dummy hits
import { fileURLToPath } from "node:url";
import { PROBE, ARENA } from "./balance-probe.mjs";

const T = 16, LOG = [];
const WID = { sword: "warrior", dagger: "rogue", spear: "lancer", staff: "mage", book: "book", bow: "bow", hammer: "h" };
const BOSS = { 13: "wickregent", 25: "knellkeeper", 40: "abyssboss" };
const tierFor = (lv) => (lv < 8 ? 1 : lv < 16 ? 2 : lv < 26 ? 3 : lv < 38 ? 4 : 5);
const plain = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });
const BUILD = {
  sword: { str: 0.45, wil: 0.35, dex: 0.05, wis: 0.05, luk: 0.1 },
  dagger: { dex: 0.45, luk: 0.3, wil: 0.15, str: 0.05, wis: 0.05 },
  spear: { str: 0.4, wis: 0.25, wil: 0.25, dex: 0.1 },
  staff: { int: 0.45, wis: 0.3, wil: 0.2, luk: 0.05 },
  book: { int: 0.45, wil: 0.3, wis: 0.2, luk: 0.05 },
  bow: { dex: 0.45, luk: 0.3, wil: 0.15, str: 0.05, wis: 0.05 },
  hammer: { str: 0.45, wil: 0.35, dex: 0.05, wis: 0.05, luk: 0.1 },
};

/** One run: job `job` holding `wk` at `tier` against `n` dummies of kind `kind` for `secs`. */
function run(L, job, wk, tier, n, kind, secs) {
  const D = L.defs(), S = L.setup(), PID = "pid-skill";
  let now = 1_000_000;
  S.now = now;
  const j = D.jobs[job], tg = tierFor(tier), m =Math.max(j.kind === "hybrid" ? 15 : 20, tier);
  const o = { wk, lvl: Math.min(197, 4 * tier - 3), wm: Object.fromEntries(j.wk.map((k) => [k, m])), job };
  if (j.kind === "hybrid") {
    o.wk2 = j.wk.find((k) => k !== wk);
    o.build = {};
    for (const k of j.wk) for (const [s, v] of Object.entries(BUILD[k])) o.build[s] = (o.build[s] || 0) + v / 2;
  }
  const ch = L.hero("탐침", o);
  ch.jp = { lv: tier >= 40 ? 35 : 20, xp: 0 };
  ch.eq.weapon = plain(`w_${WID[wk]}_${tg}`);
  if (o.wk2) ch.eq.weapon2 = plain(`w_${WID[o.wk2]}_${tg}`);
  Object.assign(ch.eq, { helm: plain(`h_${tg}`), armor: plain(`a_${tg}`), gloves: plain(`g_${tg}`), boots: plain(`b_${tg}`), ring1: plain(`r_${tg}`), amulet: plain(`n_${tg}`) });
  ch.inv = []; ch.tut = { i: 99, n: 0 };
  L.addPlayer(S, PID, ch);
  const p = S.players[PID];
  L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true;
  const rt = S.maps.meadow;
  rt.base = rt.base.map(() => 0); rt.fb = -1; rt.fires = [];
  const mp = L.atlas(false, ["meadow"]).maps.meadow, keep = { g: mp.g, o: mp.o, solid: mp.solid, reach: mp.reach };
  const W = mp.w, R = ARENA.r + ARENA.pad, solid = mp.solid.slice(), reach = mp.reach.slice();
  const g = mp.g.map((r) => r.split("")), ob = mp.o.map((r) => r.split(""));
  for (let dy = -R - 1; dy <= R + 1; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
    const x = ARENA.x + dx, y = ARENA.y + dy, i = y * W + x, wall = Math.max(Math.abs(dx), Math.abs(dy)) > R;
    g[y][x] = "."; ob[y][x] = wall ? "t" : " "; solid[i] = wall ? 1 : 0; reach[i] = wall ? 0 : 1;
  }
  Object.assign(mp, { g: g.map((r) => r.join("")), o: ob.map((r) => r.join("")), solid, reach });
  try {
    for (const q of rt.mobs) { q.dead = true; q.respAt = 1e15; }
    const home = [ARENA.x * T + 8, ARENA.y * T + 10], cx = home[0] + 44, cy = home[1];
    const dummies = [];
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n - 1)) * Math.PI * 2, rr = n > 1 ? 22 : 0;
      const x = cx + Math.cos(a) * rr * (i ? 1 : 0), y = cy + Math.sin(a) * rr * (i ? 1 : 0);
      const mob = { fix: 0, ep: 0, id: S.nextId++, k: kind, r: [0, 0, 0, 0], x, y, hx: x, hy: y, wx: x, wy: y, hp: 1e12, dir: 0, st: 0, tgt: null, atkAt: 1e15, mvAt: 1e15, by: {}, dead: false, respAt: 0, slow: 0, stun: 0, dot: null, castAt: 1e15, el: 0, temp: false, tr: [], act: null, mv: 0, cn: 0, mk: 0, mkAt: 0, vuln: 0, dec: null };
      rt.mobs.push(mob); dummies.push(mob);
    }
    p.x = home[0]; p.y = home[1]; p.fix = false; p.mvAt = now;
    const sks = D.skillOrder.filter((id) => D.skills[id].kind !== "p" && !(process.env.SKP_NOSK || "").split(",").includes(id) && process.env.SKP_NOSK !== "all").map((id) => ({ t: "sk", id }));
    const act = (a) => { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v.ok; };
    let healed = 0, mpUsed = 0, b5 = 0, lastMp = p.mp;
    const sum = () => dummies.reduce((s, d) => s + (d.by[PID] || 0), 0);
    for (let t = 0; t < (secs * 1000) / 100; t++) {
      for (const d of dummies) { d.x = d.hx; d.y = d.hy; d.hp = 1e12; d.atkAt = now + 1e9; d.castAt = now + 1e9; d.dead = false; d.tgt = PID; }
      const tgt = dummies[0], bd = Math.hypot(tgt.x - p.x, tgt.y - p.y);
      p.aim = ((Math.round((Math.atan2(tgt.y - p.y, tgt.x - p.x) / (2 * Math.PI)) * D.aim[0]) % D.aim[0]) + D.aim[0]) % D.aim[0];
      const range = p.stc && p.stc.arm ? p.stc.arm.range : 30;
      if (bd > range * 0.85) { const k = Math.min(4.8, bd - range * 0.6) / bd; p.x += (tgt.x - p.x) * k; p.y += (tgt.y - p.y) * k; p.mvAt = now; }
      else {
        let cast = false;
        for (let i = 0; i < sks.length && !cast; i++) if (act({ ...sks[i], a: p.aim })) cast = true;
        if (!cast) act({ t: "atk", a: p.aim });
      }
      if (p.mp < lastMp) mpUsed += lastMp - p.mp;
      now += 100;
      L.tick(S, now);
      for (const e of rt.ev) { if (e[0] === "h" && e[1] === p.eid && e[2] < 0) healed -= e[2]; if (process.env.SKP_LOG && e[0] === "h" && e[1] === dummies[0].id) LOG.push(e[2] + (e[3] ? "c" : "")); }
      L.endTick(S);
      lastMp = p.mp;
      if (t === 49) b5 = sum();
    }
    if (process.env.SKP_LOG && n === 1 && kind !== BOSS[tier]) { console.log(job, wk, LOG.length, "hits", LOG.slice(0, 40).join(" ")); LOG.length = 0; }
    return { dps: sum() / secs, b5, heal: (healed * 60) / secs, mp: (mpUsed * 60) / secs };
  } finally { Object.assign(mp, keep); }
}

/** A job's row at `tier` (a hybrid: the mean of its two hands). */
export function skillProbe(L, job, tier, secs = 60) {
  const D = L.defs(), j = D.jobs[job], kind = PROBE.mobs[tier][0], rows = [];
  for (const wk of j.wk) {
    const one = run(L, job, wk, tier, 1, kind, secs), pack = run(L, job, wk, tier, 6, kind, secs), boss = run(L, job, wk, tier, 1, BOSS[tier], 30);
    rows.push({ st: one.dps, aoe: pack.dps, b5: one.b5, heal: pack.heal, mp: one.mp, boss: D.mobs[BOSS[tier]].hp / Math.max(1, boss.dps) });
  }
  const mean = (k) => Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length);
  return { st: mean("st"), aoe: mean("aoe"), b5: mean("b5"), heal: mean("heal"), mp: mean("mp"), boss: mean("boss") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const L = await import("../src/logic.js"), D = L.defs();
  const args = process.argv.slice(2), tiers = args.filter((a) => /^\d+$/.test(a)).map(Number), only = args.filter((a) => !/^\d+$/.test(a));
  const jobs = Object.keys(D.jobs).filter((id) => id !== "adventurer" && (!only.length || only.includes(id)));
  for (const t of tiers.length ? tiers : [25, 40]) {
    const res = jobs.map((j) => [j, skillProbe(L, j, t)]), mean = res.reduce((s, [, r]) => s + r.st, 0) / res.length;
    console.log(`T${t}  job          st/s (×mean)   aoe/s  aoe/st  b5     heal/m  mp/m   boss s`);
    for (const [j, r] of res) console.log(`     ${j.padEnd(12)} ${String(r.st).padStart(5)} (×${(r.st / mean).toFixed(2)})  ${String(r.aoe).padStart(6)}  ${(r.aoe / r.st).toFixed(2).padStart(5)}  ${String(r.b5).padStart(5)}  ${String(r.heal).padStart(6)}  ${String(r.mp).padStart(5)}  ${String(r.boss).padStart(5)}`);
  }
}
