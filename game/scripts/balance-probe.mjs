#!/usr/bin/env node
// The balance probe (docs/design/jobs-and-stats.md F.3): a template hero in band-tier plain gear
// fights a steady trickle of its band's monsters on open meadow ground for 120 simulated seconds,
// casting whatever skills it can. Reports kills/min, damage taken/min and deaths.
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
  mobs: {
    5: ["gutfrog", "lambmaw", "eyecrow"],
    13: ["ratking", "foxtwine", "twinhare_bone"],
    25: ["crabskull", "splitboar_frost", "spiderhand"],
    40: ["blightsquirrel", "doghead_fire", "stumpmaw"],
  },
  /** old class → the weapon kind its template hero carries after J1 (mage probes both staff and book) */
  kinds: { warrior: "sword", rogue: "dagger", lancer: "spear", mage: "staff" },
};
const tierFor = (lv) => (lv < 8 ? 1 : lv < 16 ? 2 : lv < 26 ? 3 : lv < 38 ? 4 : 5);
const WID = { sword: "warrior", dagger: "rogue", spear: "lancer", staff: "mage", book: "book", bow: "bow" };
const plain = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });

/**
 * One probe run. `who` is an old class id ("warrior"…) on the old rules, or a weapon kind
 * ("sword"… "bow") on the new ones. `tier` is the world tier (old level).
 */
export function probe(L, who, tier, secs = PROBE.secs) {
  const D = L.defs();
  const T = 16;
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-probe";
  const tg = tierFor(tier);
  const fresh = !!L.hero;
  const wk = fresh ? who : null;
  const ch = fresh ? L.hero("탐침", { wk, lvl: Math.min(197, 4 * tier - 3), migrate: true }) : L.newChar("탐침", who, []);
  if (!fresh) ch.lvl = tier;
  ch.eq.weapon = plain(`w_${fresh ? WID[wk] : who}_${tg}`);
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
  const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  let spot = null;
  for (const R of [6, 5, 4]) {
    for (let y = R + 2; y < mp.h - R - 2 && !spot; y++) for (let x = R + 2; x < mp.w - R - 2 && !spot; x++) {
      let ok = true;
      for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
      if (ok) spot = [x, y, R];
    }
    if (spot) break;
  }
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
  const sks = D.skillOrder ? D.skillOrder.filter((id) => D.skills[id].kind !== "p").map((id) => ({ t: "sk", id })) : Array.from({ length: 6 }, (_, i) => ({ t: "sk", i }));
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
  console.log(JSON.stringify(out));
}
