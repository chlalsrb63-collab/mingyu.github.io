#!/usr/bin/env node
// The balance probe (docs/design/jobs-and-stats.md F.3): a template hero in band-tier plain gear
// fights a steady trickle of its band's monsters for 120 simulated seconds, casting whatever skills it can.
// New rules: in a fixed, flat, walled arena laid over the meadow for the run (ARENA), so regenerating a map never
// moves balance numbers. Old rules: the first open square of the meadow, where BASE (tests/balance.mjs) was measured.
// Reports kills/min, damage taken/min and deaths.
//
//   node scripts/balance-probe.mjs            print the table for the built src/logic.js
//   import { probe, PROBE } from "./balance-probe.mjs"   (tests/balance.mjs)
//
// Works on both rule sets: before J1 (classes, `newChar(name, cls)`, levels 1–50) and after
// (`hero(name, {wk, lvl, ...})`, levels 1–200, the tier is `(lvl + 3) / 4`). Fully deterministic.
import { fileURLToPath } from "node:url";

/** The tiers probed and the monsters each fights (fixed lists, so old and new runs meet the same beasts). */
export const PROBE = {
  secs: 120,
  tiers: [5, 13, 25, 40],
  /** hybrids are probed from the first tier one can be had (both weapons at mastery 15) */
  hybTiers: [13, 25, 40],
  mobs: {
    5: ["gutfrog", "lambmaw", "eyecrow"],
    13: ["ratking", "foxtwine", "twinhare_bone"],
    25: ["crabskull", "splitboar_frost", "spiderhand"],
    40: ["blightsquirrel", "doghead_fire", "stumpmaw"],
  },
  /** old class → the weapon kind its template hero carries after J1 (mage probes both staff and book) */
  kinds: { warrior: "sword", rogue: "dagger", lancer: "spear", mage: "staff" },
};
/**
 * The arena (new rules): a square of open grass `r + pad` tiles each way round tile (x, y) of the meadow, walled
 * beyond. The hero holds the middle (`r` sets the ring the monsters come from, as the old open-square search did).
 */
export const ARENA = { x: 40, y: 40, r: 6, pad: 14 };
/** Lay the arena over map `m` (its ground, objects, solid and reach); returns the function that puts the map back. */
function flatArena(m, A) {
  const keep = { g: m.g, o: m.o, solid: m.solid, reach: m.reach };
  const W = m.w, n = A.r + A.pad, solid = m.solid.slice(), reach = m.reach.slice();
  const g = m.g.map((r) => r.split("")), o = m.o.map((r) => r.split(""));
  for (let dy = -n - 1; dy <= n + 1; dy++) for (let dx = -n - 1; dx <= n + 1; dx++) {
    const x = A.x + dx, y = A.y + dy, i = y * W + x, wall = Math.max(Math.abs(dx), Math.abs(dy)) > n;
    g[y][x] = "."; o[y][x] = wall ? "t" : " "; solid[i] = wall ? 1 : 0; reach[i] = wall ? 0 : 1;
  }
  Object.assign(m, { g: g.map((r) => r.join("")), o: o.map((r) => r.join("")), solid, reach });
  return () => Object.assign(m, keep);
}
const tierFor = (lv) => (lv < 8 ? 1 : lv < 16 ? 2 : lv < 26 ? 3 : lv < 38 ? 4 : 5);
const WID = { sword: "warrior", dagger: "rogue", spear: "lancer", staff: "mage", book: "book", bow: "bow", hammer: "h" };
const plain = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });
/** The template stat shares of each weapon kind (mirrors logic BUILD), for a hybrid's half-and-half build. */
const BUILD = {
  sword: { str: 0.45, wil: 0.35, dex: 0.05, wis: 0.05, luk: 0.1 },
  dagger: { dex: 0.45, luk: 0.3, wil: 0.15, str: 0.05, wis: 0.05 },
  spear: { str: 0.4, wis: 0.25, wil: 0.25, dex: 0.1 },
  staff: { int: 0.45, wis: 0.3, wil: 0.2, luk: 0.05 },
  book: { int: 0.45, wil: 0.3, wis: 0.2, luk: 0.05 },
  bow: { dex: 0.45, luk: 0.3, wil: 0.15, str: 0.05, wis: 0.05 },
  hammer: { str: 0.45, wil: 0.35, dex: 0.05, wis: 0.05, luk: 0.1 },
};
/** hero() options for a hybrid probe: the job, the other weapon on the back, both masteries, a mixed build. */
function hybridHero(D, job, wk, tier) {
  const [a, b] = D.jobs[job].wk, m = Math.max(D.hybWm || 20, tier), build = {};
  for (const k of [a, b]) for (const [s, v] of Object.entries(BUILD[k])) build[s] = (build[s] || 0) + v / 2;
  return { job, wk2: wk === a ? b : a, wm: { [a]: m, [b]: m }, build };
}

/**
 * One probe run. `who` is an old class id ("warrior"…) on the old rules, or a weapon kind
 * ("sword"… "bow") on the new ones. `tier` is the world tier (old level).
 * `o.job` (new rules): a hybrid job holding `who` with the pair's other weapon on its back, both weapons
 * at mastery max(HYB_WM, tier), stats laid out half and half by the two weapons' templates.
 */
export function probe(L, who, tier, secs = PROBE.secs, o = {}) {
  const D = L.defs();
  const T = 16;
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-probe";
  const tg = o.gt || tierFor(tier);              // o.gt: dress the hero in another gear tier (tier 5 vs 6 at Lv.181+)
  const fresh = !!L.hero;
  const wk = fresh ? who : null;
  const ch = fresh ? L.hero("탐침", { wk, lvl: Math.min(197, 4 * tier - 3), migrate: true, ...(o.job ? hybridHero(D, o.job, wk, tier) : {}) }) : L.newChar("탐침", who, []);
  if (!fresh) ch.lvl = tier;
  ch.eq.weapon = plain(`w_${fresh ? WID[wk] : who}_${tg}`);
  if (o.job) ch.eq.weapon2 = plain(`w_${WID[D.jobs[o.job].wk.find((k) => k !== wk)]}_${tg}`);
  Object.assign(ch.eq, { helm: plain(`h_${tg}`), armor: plain(`a_${tg}`), gloves: plain(`g_${tg}`), boots: plain(`b_${tg}`), ring1: plain(`r_${tg}`), amulet: plain(`n_${tg}`) });
  ch.inv = [];
  ch.tut = { i: 99, n: 0 };
  L.addPlayer(S, PID, ch);
  const p = S.players[PID];
  // open ground in the meadow, nothing else alive there
  const goMeadow = () => { L.runtime(S, p.map).n--; p.map = "meadow"; L.runtime(S, "meadow").n++; p.sendMap = true; };
  goMeadow();
  const rt = S.maps.meadow;
  rt.base = rt.base.map(() => 0);
  rt.fb = -1;                                    // no field boss walks in
  const mp = L.atlas(false, ["meadow"]).maps.meadow;
  let spot = null, restore = null;
  if (fresh) {
    // a fixed, flat arena laid over the meadow for this run (restored at the end), so a regenerated meadow
    // never moves the numbers: plain grass, nothing standing, a wall all round, no camp fire near
    spot = [ARENA.x, ARENA.y, ARENA.r];
    restore = flatArena(mp, ARENA);
    rt.fires = [];
  } else {
    // the old rules: the first open square of the meadow, exactly as BASE was measured
    const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
    for (const R of [6, 5, 4]) {
      for (let y = R + 2; y < mp.h - R - 2 && !spot; y++) for (let x = R + 2; x < mp.w - R - 2 && !spot; x++) {
        let ok = true;
        for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
        if (ok) spot = [x, y, R];
      }
      if (spot) break;
    }
  }
  try {
    const home = [spot[0] * T + 8, spot[1] * T + 10], ring = (spot[2] - 1) * T;
    let seed = 12345 + tier * 7 + who.length * 131;
    const rand = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
    const kinds = PROBE.mobs[tier];
    const arena = [];
    const place = (mob) => {
      const a = rand() * Math.PI * 2, r = ring * (0.65 + 0.35 * rand());
      const x = home[0] + Math.cos(a) * r, y = home[1] + Math.sin(a) * r;
      const d = D.mobs[mob.k];
      Object.assign(mob, { dead: false, el: 0, fix: 0, tr: [], hp: d.hp, x, y, hx: x, hy: y, wx: x, wy: y, by: {}, stun: 0, slow: 0, dot: null, mk: 0, mkAt: 0, dec: null, vuln: 0, tgt: PID, st: 0, act: null, mv: 0, cn: 0, castAt: now + 2500, atkAt: now + 600, mvAt: 0, respAt: 0 });
    };
    for (let i = 0; i < 3; i++) {
      const mob = { fix: 0, ep: 0, id: S.nextId++, k: kinds[i % kinds.length], r: [spot[0] - 3, spot[1] - 3, spot[0] + 3, spot[1] + 3], x: 0, y: 0, hx: 0, hy: 0, hp: 0, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 0, wx: 0, wy: 0, by: {}, dead: false, respAt: 0, slow: 0, stun: 0, dot: null, castAt: 0, el: 0, temp: false, tr: [], act: null, mv: 0, cn: 0, back: 0 };
      place(mob);
      rt.mobs.push(mob);
      arena.push(mob);
    }
    p.x = home[0]; p.y = home[1]; p.fix = false; p.mvAt = now;
    let kills = 0, taken = 0, deaths = 0, casts = 0;
    const ids = new Set(arena.map((m) => m.id));
    // the skills it tries, in order: weapon skills by id (J2: what auto-hunt puts on a fresh bar, in SKILL_ORDER), or the old six by index
    // (a guard or a cloud that deals no damage, `util`, is never cast by auto-hunt: it is left out here too)
    const sks = D.skillOrder ? D.skillOrder.filter((id) => D.skills[id].kind !== "p" && !D.skills[id].util).map((id) => ({ t: "sk", id })) : Array.from({ length: 6 }, (_, i) => ({ t: "sk", i }));
    const act = (a) => { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v.ok; };
    const AIM_N = D.aim[0];
    const ticks = Math.round((secs * 1000) / 100);
    for (let t = 0; t < ticks; t++) {
      // anything that is not ours (an invasion, a sleeper) is put away
      for (const o of rt.mobs) if (!ids.has(o.id) && !o.dead) { o.dead = true; o.respAt = 1e15; }
      for (const m of arena) if (m.dead && now >= m.back) { m.k = kinds[Math.floor(rand() * kinds.length)]; place(m); }
      if (p.dead) {
        deaths++;
        act({ t: "respawn" });
        if (p.map !== "meadow") goMeadow();
        p.x = home[0]; p.y = home[1]; p.fix = false; p.dead = false;
        const st = p.stc;
        p.hp = st ? st.mhp : 100; p.mp = st ? st.mmp : 50;
      } else {
        let tgt = null, bd = 1e9;
        for (const m of arena) { if (m.dead) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; tgt = m; } }
        // a skill that carried the hero out of the clearing (a backstep, a leap, a dash): walk back first
        const away = Math.hypot(p.x - home[0], p.y - home[1]);
        if (away > ring) { const k = Math.min(4.8, away) / away; p.x += (home[0] - p.x) * k; p.y += (home[1] - p.y) * k; p.mvAt = now; }
        else if (tgt) {
          const a = ((Math.round((Math.atan2(tgt.y - p.y, tgt.x - p.x) / (2 * Math.PI)) * AIM_N) % AIM_N) + AIM_N) % AIM_N;
          p.aim = a;
          const range = p.stc && p.stc.arm ? p.stc.arm.range : 30;
          if (bd > range * 0.85) {
            const k = Math.min(4.8, bd - range * 0.6) / bd;
            p.x += (tgt.x - p.x) * k; p.y += (tgt.y - p.y) * k; p.mvAt = now;
          } else {
            let cast = false;
            for (let i = 0; i < sks.length && !cast; i++) if (act({ ...sks[i], a })) { cast = true; casts++; }
            if (!cast) act({ t: "atk", a });
          }
        }
      }
      now += 100;
      L.tick(S, now);
      for (const e of rt.ev) {
        if (e[0] === "h" && e[1] === p.eid && e[4] === 1) taken += e[2];
        if (e[0] === "k" && ids.has(e[1])) { kills++; const m = arena.find((o) => o.id === e[1]); m.back = now + 1500; }
      }
      L.endTick(S);
    }
    const k = 60 / secs;
    return { kpm: +(kills * k).toFixed(2), dtpm: Math.round(taken * k), deaths, casts };
  } finally {
    if (restore) restore();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const L = await import("../src/logic.js");
  const fresh = !!L.hero;
  const who = fresh ? ["sword", "dagger", "spear", "staff", "book", "bow"] : ["warrior", "rogue", "lancer", "mage"];
  const out = {};
  for (const w of who) {
    out[w] = {};
    for (const tier of PROBE.tiers) out[w][tier] = probe(L, w, tier);
    console.log(w.padEnd(8), PROBE.tiers.map((t) => `T${t}: ${out[w][t].kpm} k/m ${out[w][t].dtpm} dmg/m ${out[w][t].deaths} d`).join(" | "));
  }
  if (fresh) {
    // every hybrid, holding each of its two weapons
    const D = L.defs();
    for (const j of Object.keys(D.jobs).filter((id) => D.jobs[id].kind === "hybrid")) for (const w of D.jobs[j].wk) {
      const key = `${j}/${w}`;
      out[key] = {};
      for (const tier of PROBE.hybTiers) out[key][tier] = probe(L, w, tier, PROBE.secs, { job: j });
      console.log(key.padEnd(20), PROBE.hybTiers.map((t) => `T${t}: ${out[key][t].kpm} k/m ${out[key][t].dtpm} dmg/m ${out[key][t].deaths} d`).join(" | "));
    }
  }
  console.log(JSON.stringify(out));
}
