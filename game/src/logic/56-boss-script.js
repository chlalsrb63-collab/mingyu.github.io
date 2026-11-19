// ───────────────────────────── the boss-script runner ─────────────────────────────
// A scripted boss — any mob whose kind has `MOBS[k].script`, and a weekly challenge's boss (DIM_CHAL.bosses[k]) —
// takes its turns from its script instead of its own tricks (tickMob): its patterns in turn, every `every`-th turn
// the marked cast (stunned while it gathers; damage empties the stagger gauge, emptied in time it breaks: a stun and
// `vuln` more damage taken; not broken, `blast` × atk on everyone in the fight and fury), phases by health, a soft
// and a hard enrage, and dives out of reach (`mob.dive`: not hit, not aimed at, skipped by auto-hunt).
//   script = { cast: name, pats: [[name, kind]…], phases?: [{ at: hp fraction, pats?, gap?, steps?: [{ f, dt }…], cast?: 1 }…],
//              …any BOSS_SCRIPT number }
// Phases are listed from the top down (`at` falling); phase n+1 begins under phases[n−1].at and only ever goes up
// until the fight is forgotten. A phase's pats/gap fall back to the script's own. `steps` follow every pattern of
// that phase (queued like a pattern's own follow-ups: f "fan" {off} | "pool" | "charge" | "land" {x, y}); `cast: 1`
// opens the phase with the marked cast. Pattern kinds: charge fan fan2 fan3 rings pools charge2 leapslam dive blast jet punch,
// and the shaped ones donut cone mark adds (bosses-2 §8), written `[name, kind, { …BS_PAT[kind] overrides }]`.
// State `mob.bs` (bsNew; a challenge's boss shares it with `dim.chal`). Events `["bc", id, i]` pattern i, 9 cast, 8 broken,
// 7 failed ("bc", not "dc": that is the tracker's lure); `["bt", shape, x, y, r, ms, …]` a shaped telegraph (bsShape).
// Scripted rows: bloodhorn (mesa's lair boss) and clubshrimp (the coast's field boss), 10-tables.js; the weekly raids
// cloakbat and bloomwhale (DIM_CHAL.bosses, 31-maps-dim.js) — tests/bosses2.mjs. A phase may also carry `blast` (its cast's
// fail), `rim` {n, r} (slow pools round the arena's rim for the rest of the fight); each phase starts its pattern list from the top.

/** The defaults every script may override. `reach`: how near a hero must stand to be in a field boss's fight. */
const BOSS_SCRIPT = {
  every: 4, castMs: 6000, stunMs: 5000, stag: 0.03, blast: 2.4, fury: 0.15, gap: 5200, vuln: 0.3,
  enrage: 240000, enrageStep: 10000, enrageK: 0.12, hard: 0, hardEvery: 3000, hardK: 3, reach: 320, diveMs: 1800, diveR: 70, diveK: 2,
};
/** The shaped kinds' defaults: `ms` until it lands, reach `r` (a donut is safe inside `r0`), a cone's `half` angle (rad)
 *  and `back` (aimed away from its target; `both`: front and back at once), `k` × atk; `rings` after a donut: the in-then-out
 *  rings at once; a mark on `n` heroes (`share`: its burst split between everyone inside); adds: `n` of `kind` at `d` px,
 *  `cap` alive, `shield` (the boss takes half while any lives), `feed` ms (still alive then, it flies into the boss: + `heal`). */
const BS_PAT = {
  donut: { ms: 1400, r0: 30, r: 90, k: 2, rings: 0 },
  cone: { ms: 1000, r: 56, half: 1.047, back: 0, both: 0, k: 1.5 },
  mark: { ms: 3000, r: 36, n: 4, k: 1.6, share: 0 },
  adds: { kind: "", n: 3, cap: 6, d: 40, shield: 0, feed: 0, heal: 0.02 },
  // bosses-2's F1/F2 vocabulary: a ring on every hero (the party blast), a lane of `n` rings over `len` px with burn pools on
  // every other one (혈루 사출), and a punch on `n` heroes: ring `r` after `ms`, then the bubble's ring `r2` `ms2` later (공동 펀치)
  blast: { ms: 1300, r: 32, k: 1.3 },
  jet: { ms: 900, r: 13, n: 5, len: 140, k: 1.6 },
  punch: { ms: 900, r: 22, k: 1.4, ms2: 600, r2: 40, k2: 1, n: 1 },
};
const BS_DEFS = {};
/** A mob's script with every number filled in, or null. A challenge's boss: DIM_CHAL's numbers, no vuln (as first tuned). */
function bsDef(mob) {
  const key = (mob.chal ? "c:" : "") + mob.k;
  if (Object.hasOwn(BS_DEFS, key)) return BS_DEFS[key];
  const C = DIM_CHAL, own = mob.chal ? C.bosses[mob.k] : MOBS[mob.k].script;
  const pick = mob.chal ? { every: C.every, castMs: C.castMs, stunMs: C.stunMs, stag: C.stag, blast: C.blast, fury: C.fury, gap: C.gap,
    enrage: C.enrage, enrageStep: C.enrageStep, enrageK: C.enrageK, vuln: 0 } : {};
  return (BS_DEFS[key] = own ? { ...BOSS_SCRIPT, ...pick, phases: [], ...own } : null);
}
/** A fight's state, fresh: turns taken, next pattern, follow-ups, fury, when it began, enrage steps, base blows, phase. */
const bsNew = (ak) => ({ n: 0, pi: 0, q: [], fury: 0, engAt: 0, rage: 0, ak, ph: 1, force: 0, hard: 0 });
/** The phase its health puts it in (1 = the first). */
const bsPhaseAt = (B, mob) => { const f = mob.hp / mobMax(mob); let ph = 1; for (const P of B.phases) if (f < P.at) ph++; return ph; };
/** Everyone in its fight: a challenge's whole arena, else the heroes on its map within `reach`. */
function bsFolk(S, rt, mob, B) {
  if (mob.chal) return dimInside(S, rt.id);
  const out = [];
  for (const pid of Object.keys(S.players)) { const o = S.players[pid]; if (o.map === rt.id && dist(mob.x, mob.y, o.x, o.y) <= B.reach) out.push(o); }
  return out;
}
/** The fight is over (a field boss walking home): it forgets its fury, its phase and its clock. */
function bsEnd(mob) {
  if (!mob.bs) return;
  mob.ak = mob.bs.ak; mob.bs = null; mob.cast = null; mob.dive = 0;
}

/** A volley of `n` turned `off` radians from the line to `tgt`. */
function bsVolley(S, rt, mob, tgt, dmg, n, off) {
  const dx = tgt.x - mob.x, dy = tgt.y - mob.y, c = Math.cos(off), s = Math.sin(off);
  volley(S, rt, mob, { x: mob.x + dx * c - dy * s, y: mob.y + dx * s + dy * c }, dmg, n);
}
/** A marked line toward `o`, then the run (tickMob's dash). */
function bsCharge(S, rt, mob, o) {
  const d = MOBS[mob.k], dd = Math.max(1, dist(mob.x, mob.y, o.x, o.y)), ux = (o.x - mob.x) / dd, uy = (o.y - mob.y) / dd, len = Math.min(dd + 36, (d.charge || 150) + 20);
  mob.act = { at: S.now + CHARGE_MS, ux, uy, len };
  mob.dir = ux < 0 ? 1 : 2;
  rt.ev.push(["c", mob.id, Math.round(mob.x), Math.round(mob.y), Math.round(mob.x + ux * len), Math.round(mob.y + uy * len), CHARGE_MS]);
}
const bsRing = (S, rt, mob, x, y, r, ms, dmg) => { rt.tele.push({ x, y, r, at: S.now + ms, dmg, by: mob }); rt.ev.push(["t", Math.round(x), Math.round(y), r, ms]); };
function bsPool(S, rt, mob, o, atk) {
  const d = MOBS[mob.k], now = S.now, kind = d.poolKind || 0, r = d.pool || 30;
  rt.pools.push({ x: o.x, y: o.y, r, next: now + POOL_FLY, until: now + POOL_FLY + POOL_MS, dmg: atk * 0.4, atk, kind });
  rt.ev.push(["g", mob.id, Math.round(o.x), Math.round(o.y), r, POOL_FLY, POOL_MS, kind]);
}
/** Whether (x, y) is inside a shaped telegraph `h` {x y r r0 ang half}: the shape the client draws (skillfx.js bossTele). */
function bsInside(h, x, y) {
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
  return d <= h.r && d >= h.r0 && (!h.half || dx * Math.cos(h.ang) + dy * Math.sin(h.ang) >= d * Math.cos(h.half));
}
/** A shaped telegraph: shown now, it lands after `ms` (bsTick → bsHit). Event `["bt", shape, x, y, r, ms, …extra]`. */
function bsShape(S, rt, mob, h, ms, dmg, shape, extra) {
  mob.bs.q.push({ at: S.now + ms, f: "hit", h, dmg });
  rt.ev.push(["bt", shape, Math.round(h.x), Math.round(h.y), h.r, ms, ...extra]);
}
/** It lands (a mark where its hero stands now): everyone on the map inside is hit (a shared mark: split between them);
 *  a dash's i-frames still save. */
function bsHit(S, rt, mob, st) {
  const h = st.h, v = h.pid && S.players[h.pid];
  if (v && v.map === rt.id && !v.dead) { h.x = v.x; h.y = v.y; }
  const hit = Object.values(S.players).filter((o) => o.map === rt.id && !o.dead && bsInside(h, o.x, o.y));
  for (const o of hit) mobHit(S, rt, o, h.share ? st.dmg / hit.length : st.dmg, mob, "tele");
}
/** A ring round itself, then four rings round that: in, then out. */
function bsRings(S, rt, mob, atk) {
  bsRing(S, rt, mob, mob.x, mob.y, 58, 1200, atk * 1.6);
  for (const [dx, dy] of [[84, 0], [-84, 0], [0, 58], [0, -58]]) bsRing(S, rt, mob, mob.x + dx, mob.y + dy, 44, 2100, atk * 1.4);
}
/** The damage a scripted boss takes: more while stagger-stunned (vuln), half while one of its shielding adds lives. */
function bsTaken(S, rt, mob, dmg) {
  if (mob.stag > S.now) dmg = Math.round(dmg * (1 + bsDef(mob).vuln));
  if (rt.mobs.some((a) => a.add === mob.id && a.shield && !a.dead)) dmg = Math.round(dmg / 2);
  return dmg;
}
const bsFarthest = (mob, alive, tgt) => alive.reduce((a, b) => (dist(mob.x, mob.y, b.x, b.y) > dist(mob.x, mob.y, a.x, a.y) ? b : a), tgt);

/** Its turn (tickMob, in place of a monster's own tricks): the marked cast every `every`-th turn, else its phase's next pattern. */
function bsCast(S, rt, mob, tgt) {
  const B = bsDef(mob), d = MOBS[mob.k], now = S.now, atk = d.atk;
  const c = mob.bs || (mob.bs = Object.assign(bsNew(mob.ak || 1), { engAt: now }));
  const P = c.ph > 1 ? B.phases[c.ph - 2] : null, pats = (P && P.pats) || B.pats, gap = (P && P.gap) || B.gap, q = c.q;
  const folk = bsFolk(S, rt, mob, B), alive = folk.filter((o) => !o.dead);
  c.n++;
  if (c.force || c.n % B.every === 0) {
    // the marked cast: it stands still and gathers; the party breaks it with damage, or pays
    if (c.force) { c.force = 0; c.n = 0; }
    mob.cast = { until: now + B.castMs, need: Math.max(1, B.stag * mobMax(mob)), got: 0 };
    mob.stun = now + B.castMs; mob.castAt = now + B.castMs + gap / 2;
    rt.ev.push(["bc", mob.id, 9, B.castMs]);
    for (const o of folk) toast(o, `${d.name}${pp(d.name, "이가")} [${B.cast}]${pp(B.cast, "을를")} 준비합니다! 몰아쳐서 무력화하세요!`);
    return;
  }
  const i = c.pi++ % pats.length, o = { ...BS_PAT[pats[i][1]], ...pats[i][2] };
  let dur = 1500;
  switch (pats[i][1]) {
    case "charge":    // the plain run at its target
      bsCharge(S, rt, mob, tgt); dur = CHARGE_MS + 800; break;
    case "fan":       // one volley of five
      bsVolley(S, rt, mob, tgt, atk, 5, 0); dur = VOLLEY_MS + 300; break;
    case "blast":     // a ring under every one of the party: everyone walks a body-length
      for (const v of alive) bsRing(S, rt, mob, v.x, v.y, o.r, o.ms, atk * o.k);
      dur = o.ms + 300; break;
    case "jet": {     // a lane of rings toward its target, a burn pool left on every other one
      const dd = Math.max(1, dist(mob.x, mob.y, tgt.x, tgt.y)), ux = (tgt.x - mob.x) / dd, uy = (tgt.y - mob.y) / dd;
      for (let j = 1; j <= o.n; j++) {
        const x = mob.x + (ux * o.len * j) / o.n, y = mob.y + (uy * o.len * j) / o.n;
        bsRing(S, rt, mob, x, y, o.r, o.ms, atk * o.k);
        if (j % 2) bsPool(S, rt, mob, { x, y }, atk);
      }
      mob.dir = ux < 0 ? 1 : 2; mob.stun = now + o.ms; dur = o.ms + 300; break;
    }
    case "punch":     // a punch where each of `n` heroes stands, the bubble collapsing wider on the same spot a moment later
      for (let j = 0; j < Math.min(o.n, alive.length); j++) {
        const v = j ? alive[(c.pi + j) % alive.length] : tgt, at = j * 700;
        bsRing(S, rt, mob, v.x, v.y, o.r, o.ms + at, atk * o.k);
        bsRing(S, rt, mob, v.x, v.y, o.r2, o.ms + o.ms2 + at, atk * o.k2);
      }
      mob.stun = now + o.ms; dur = o.ms + o.ms2 + 300; break;
    case "fan2":     // two volleys, the second through the gaps of the first
      bsVolley(S, rt, mob, tgt, atk, 5, 0); q.push({ at: now + 900, f: "fan", off: 0.21 }); dur = 900 + VOLLEY_MS; break;
    case "fan3":      // three sweeping volleys and a puddle under the target
      bsVolley(S, rt, mob, tgt, atk, 5, 0); q.push({ at: now + 800, f: "fan", off: 0.28 }, { at: now + 1600, f: "fan", off: -0.28 }, { at: now + 400, f: "pool" });
      dur = 1600 + VOLLEY_MS; break;
    case "rings":     // a ring round itself, then four rings round that: in, then out
      bsRings(S, rt, mob, atk);
      mob.stun = now + 1200; dur = 2100; break;
    case "pools":     // a puddle under every one of the party: spread out, keep moving
      for (const o of alive) bsPool(S, rt, mob, o, atk);
      dur = POOL_FLY; break;
    case "charge2":   // a run at its target, then at whoever stands farthest
      bsCharge(S, rt, mob, tgt); q.push({ at: now + CHARGE_MS + 1000, f: "charge" }); dur = 2 * CHARGE_MS + 1600; break;
    case "leapslam": {  // a bound onto the farthest of the party: the ring shows where it lands
      const o = bsFarthest(mob, alive, tgt);
      bsRing(S, rt, mob, o.x, o.y, 54, 1300, atk * 1.8);
      q.push({ at: now + 1250, f: "land", x: o.x, y: o.y });
      mob.stun = now + 1250; dur = 1900; break;
    }
    case "dive": {    // out of reach (not hit, not aimed at), then down on the middle of the party: walk or dash out
      const n = Math.max(1, alive.length), x = alive.reduce((s, o) => s + o.x, 0) / n || tgt.x, y = alive.reduce((s, o) => s + o.y, 0) / n || tgt.y;
      mob.dive = 1;
      bsRing(S, rt, mob, x, y, B.diveR, B.diveMs, atk * B.diveK);
      q.push({ at: now + B.diveMs - 50, f: "land", x, y });
      mob.stun = now + B.diveMs; dur = B.diveMs + 600; break;
    }
    case "donut":     // a ring round itself, safe in the middle: step in, or out past its reach
    case "cone": {    // a wedge toward its target (or its back): step aside
      const h = { x: Math.round(mob.x), y: Math.round(mob.y), r: o.r, r0: 0, ang: 0, half: 0 };
      let extra = [o.r0];
      if (pats[i][1] === "donut") h.r0 = o.r0;
      else {
        // angles go on the wire in milliradians, and the hit test uses the same rounded numbers
        const am = Math.round((Math.atan2(tgt.y - mob.y, tgt.x - mob.x) + (o.back ? Math.PI : 0)) * 1000), hm = Math.round(o.half * 1000);
        h.ang = am / 1000; h.half = hm / 1000; extra = [am, hm];
        mob.dir = Math.cos(h.ang) < 0 ? 1 : 2;
      }
      bsShape(S, rt, mob, h, o.ms, atk * o.k, pats[i][1] === "donut" ? 0 : 1, extra);
      if (o.both) { const am = extra[0] + (extra[0] > 0 ? -3142 : 3142); bsShape(S, rt, mob, { ...h, ang: am / 1000 }, o.ms, atk * o.k, 1, [am, extra[1]]); }
      if (o.rings) q.push({ at: now + o.ms, f: "rings" });
      mob.stun = now + o.ms + (o.rings ? 1200 : 0); dur = o.ms + (o.rings ? 2100 : 300); break;
    }
    case "mark":      // heroes marked: after `ms` a burst where each then stands hits everyone inside — spread out
      for (let j = 0; j < Math.min(o.n, alive.length); j++) {
        const v = alive[(c.pi + j) % alive.length];
        bsShape(S, rt, mob, { x: v.x, y: v.y, r: o.r, r0: 0, half: 0, pid: v.pid, share: o.share }, o.ms, atk * o.k, 2, [v.eid]);
      }
      dur = o.ms; break;
    case "adds": {    // minions of `kind` round it, never more than `cap` of its own alive at once
      const m = mapOfS(S, rt.id), n = Math.min(o.n, o.cap - rt.mobs.filter((a) => a.add === mob.id && !a.dead).length);
      for (let j = 0; j < n && MOBS[o.kind]; j++) {
        const a = (j / o.n) * 2 * Math.PI, x = Math.round(mob.x + Math.cos(a) * o.d), y = Math.round(mob.y + Math.sin(a) * o.d);
        if (!canStand(m, x, y)) continue;
        const tx = Math.floor(x / T), ty = Math.floor(y / T), add = newMob(S, o.kind, [tx, ty, tx, ty], { elite: 0 });
        add.x = add.hx = x; add.y = add.hy = y; readyMob(S, add);
        add.temp = true; add.add = mob.id; add.shield = o.shield; add.feedAt = o.feed ? now + o.feed : 0; add.heal = o.heal;
        if (mob.dim) {
          const tier = MOBS[add.k].lv;
          add.hk = dimGearHp(tier) / MOB_HARD;
          add.ak = dimAtkK(tier);
        }
        rt.mobs.push(add); rt.ev.push(["r", add.id]);
      }
      dur = 800; break;
    }
  }
  if (P && P.steps) for (const st of P.steps) q.push({ ...st, at: now + (st.dt || 0) });
  q.sort((a, b) => a.at - b.at);
  mob.castAt = now + dur + gap;
  rt.ev.push(["bc", mob.id, i]);
}

/** Every tick of a scripted fight: the phase, the marked cast running out, queued steps, the enrage (soft, then hard). */
function bsTick(S, m, rt, mob, folk, alive) {
  const c = mob.bs, B = bsDef(mob), d = MOBS[mob.k], now = S.now;
  if (!c || !c.engAt) return;
  const ph = bsPhaseAt(B, mob);
  if (ph > c.ph) {
    c.ph = ph; c.pi = 0;
    const P = B.phases[ph - 2];
    if (P.rim) bsRim(S, rt, mob, P.rim);
    if (P.cast && !mob.cast) { c.force = 1; mob.castAt = Math.min(mob.castAt, now); }
    for (const o of folk) toast(o, `${d.name}${pp(d.name, "이가")} 더욱 사나워집니다! (${ph}단계)`);
  }
  if (mob.cast) {
    if (now < mob.cast.until) mob.stun = Math.max(mob.stun, mob.cast.until);
    else {
      // nobody broke it: everyone standing pays, and it comes back angrier
      mob.cast = null; c.fury++;
      rt.ev.push(["bc", mob.id, 7]);
      const P = c.ph > 1 ? B.phases[c.ph - 2] : null;
      for (const o of alive) mobHit(S, rt, o, d.atk * ((P && P.blast) || B.blast), mob, "tele");
      for (const o of folk) toast(o, `[${B.cast}]${pp(B.cast, "을를")} 막지 못했습니다! 보스가 더 사나워집니다.`);
    }
  }
  while (c.q.length && c.q[0].at <= now) {
    const st = c.q.shift(), tgt = S.players[mob.tgt];
    // a dive always comes down, whatever happened meanwhile
    if (st.f === "hit") { bsHit(S, rt, mob, st); continue; }
    if (st.f === "rings") { bsRings(S, rt, mob, d.atk); continue; }
    if (st.f === "land") { if (canStand(m, st.x, st.y)) { mob.x = st.x; mob.y = st.y; rt.ev.push(["m", mob.id]); } mob.dive = 0; continue; }
    if (mob.cast || !tgt || tgt.dead) continue;
    if (st.f === "fan") bsVolley(S, rt, mob, tgt, d.atk, 5, st.off || 0);
    else if (st.f === "pool") bsPool(S, rt, mob, tgt, d.atk);
    else if (st.f === "charge" && !mob.act) bsCharge(S, rt, mob, bsFarthest(mob, alive, tgt));
  }
  // its feeding adds still alive after `feed` fly into it and heal it
  for (const a of rt.mobs) if (a.add === mob.id && a.feedAt && now >= a.feedAt && !a.dead) {
    a.dead = true; a.hp = 0; mob.hp = Math.min(mobMax(mob), mob.hp + Math.round(a.heal * mobMax(mob) * elementHealFactor(S, mob)));
    rt.ev.push(["bc", mob.id, 6]);
  }
  // the soft enrage: past `enrage` of a fight its blows grow every `enrageStep`
  const over = now - c.engAt - B.enrage, steps = B.enrage && over >= 0 ? 1 + Math.floor(over / B.enrageStep) : 0;
  if (steps && !c.rage) for (const o of folk) toast(o, `${d.name}${pp(d.name, "이가")} 광폭화합니다! 공격이 점점 거세집니다.`);
  c.rage = steps;
  mob.ak = c.ak * (1 + B.fury * c.fury) * (1 + B.enrageK * steps);
  // the hard enrage: past `hard`, `hardK` × atk on everyone in the fight every `hardEvery`
  if (B.hard && now - c.engAt >= B.hard && now >= c.hard) {
    if (!c.hard) for (const o of folk) toast(o, `${d.name}${pp(d.name, "이가")} 모든 것을 끝내려 합니다!`);
    c.hard = now + B.hardEvery;
    rt.ev.push(["bc", mob.id, 7]);
    for (const o of alive) mobHit(S, rt, o, d.atk * B.hardK, mob, "tele");
  }
}
/** `n` slow pools round the arena's rim (a challenge's oval; else `r` px round its home) that last the rest of the fight. */
function bsRim(S, rt, mob, rim) {
  const rm = mob.chal && mapOfS(S, rt.id).dim.rooms[0], now = S.now, r = rim.pr || 30;
  const rx = rm ? ((rm.x1 - rm.x0) / 2 - 1.5) * T : rim.r, ry = rm ? ((rm.y1 - rm.y0) / 2 - 1.5) * T : rim.r;
  for (let j = 0; j < rim.n; j++) {
    const a = (j / rim.n) * 2 * Math.PI, x = Math.round(mob.hx + Math.cos(a) * rx), y = Math.round(mob.hy + Math.sin(a) * ry);
    rt.pools.push({ x, y, r, next: now + POOL_FLY, until: now + 600000, dmg: MOBS[mob.k].atk * 0.4, atk: MOBS[mob.k].atk, kind: 2 });
    rt.ev.push(["g", mob.id, x, y, r, POOL_FLY, 600000, 2]);
  }
}
/** A field boss's tick (tickMob): its fight begins with a target and is forgotten when it gives up and walks home. */
function bsField(S, m, rt, mob) {
  if (mob.st === 2 && !mob.tgt) { bsEnd(mob); return; }
  if (!mob.bs) { if (!mob.tgt) return; mob.bs = Object.assign(bsNew(mob.ak || 1), { engAt: S.now }); }
  const folk = bsFolk(S, rt, mob, bsDef(mob));
  bsTick(S, m, rt, mob, folk, folk.filter((o) => !o.dead));
}
/** A blow during the marked cast (dealMob): `stag` of its health dealt in time breaks the cast and stuns it. */
function bsDealt(S, rt, mob, dmg) {
  const cast = mob.cast, B = bsDef(mob);
  if (!B) return;
  cast.got += dmg;
  if (cast.got < cast.need) return;
  mob.cast = null; mob.stag = mob.stun = S.now + B.stunMs; mob.castAt = S.now + B.stunMs + 1500;
  if (mob.bs) mob.bs.q = [];
  rt.ev.push(["bc", mob.id, 8, B.stunMs]);
  for (const o of bsFolk(S, rt, mob, B)) toast(o, "무력화 성공! 보스가 비틀거립니다 — 지금 몰아치세요!");
}
