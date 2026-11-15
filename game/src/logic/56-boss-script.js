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
// opens the phase with the marked cast. Pattern kinds: fan2 fan3 rings pools charge2 leapslam dive.
// State `mob.bs` (bsNew; a challenge's boss shares it with `dim.chal`). Events `["dc", id, i]` pattern i, 9 cast, 8 broken, 7 failed.

/** The defaults every script may override. `reach`: how near a hero must stand to be in a field boss's fight. */
const BOSS_SCRIPT = {
  every: 4, castMs: 6000, stunMs: 5000, stag: 0.03, blast: 2.4, fury: 0.15, gap: 5200, vuln: 0.3,
  enrage: 240000, enrageStep: 10000, enrageK: 0.12, hard: 0, hardEvery: 3000, hardK: 3, reach: 320, diveMs: 1800, diveR: 70,
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
    rt.ev.push(["dc", mob.id, 9, B.castMs]);
    for (const o of folk) toast(o, `${d.name}${pp(d.name, "이가")} [${B.cast}]${pp(B.cast, "을를")} 준비합니다! 몰아쳐서 무력화하세요!`);
    return;
  }
  const i = c.pi++ % pats.length;
  let dur = 1500;
  switch (pats[i][1]) {
    case "fan2":      // two volleys, the second through the gaps of the first
      bsVolley(S, rt, mob, tgt, atk, 5, 0); q.push({ at: now + 900, f: "fan", off: 0.21 }); dur = 900 + VOLLEY_MS; break;
    case "fan3":      // three sweeping volleys and a puddle under the target
      bsVolley(S, rt, mob, tgt, atk, 5, 0); q.push({ at: now + 800, f: "fan", off: 0.28 }, { at: now + 1600, f: "fan", off: -0.28 }, { at: now + 400, f: "pool" });
      dur = 1600 + VOLLEY_MS; break;
    case "rings":     // a ring round itself, then four rings round that: in, then out
      bsRing(S, rt, mob, mob.x, mob.y, 58, 1200, atk * 1.6);
      for (const [dx, dy] of [[84, 0], [-84, 0], [0, 58], [0, -58]]) bsRing(S, rt, mob, mob.x + dx, mob.y + dy, 44, 2100, atk * 1.4);
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
      bsRing(S, rt, mob, x, y, B.diveR, B.diveMs, atk * 2);
      q.push({ at: now + B.diveMs - 50, f: "land", x, y });
      mob.stun = now + B.diveMs; dur = B.diveMs + 600; break;
    }
  }
  if (P && P.steps) for (const st of P.steps) q.push({ ...st, at: now + (st.dt || 0) });
  q.sort((a, b) => a.at - b.at);
  mob.castAt = now + dur + gap;
  rt.ev.push(["dc", mob.id, i]);
}

/** Every tick of a scripted fight: the phase, the marked cast running out, queued steps, the enrage (soft, then hard). */
function bsTick(S, m, rt, mob, folk, alive) {
  const c = mob.bs, B = bsDef(mob), d = MOBS[mob.k], now = S.now;
  if (!c || !c.engAt) return;
  const ph = bsPhaseAt(B, mob);
  if (ph > c.ph) {
    c.ph = ph;
    if (B.phases[ph - 2].cast && !mob.cast) { c.force = 1; mob.castAt = Math.min(mob.castAt, now); }
    for (const o of folk) toast(o, `${d.name}${pp(d.name, "이가")} 더욱 사나워집니다! (${ph}단계)`);
  }
  if (mob.cast) {
    if (now < mob.cast.until) mob.stun = Math.max(mob.stun, mob.cast.until);
    else {
      // nobody broke it: everyone standing pays, and it comes back angrier
      mob.cast = null; c.fury++;
      rt.ev.push(["dc", mob.id, 7]);
      for (const o of alive) mobHit(S, rt, o, d.atk * B.blast, mob, "tele");
      for (const o of folk) toast(o, `[${B.cast}]${pp(B.cast, "을를")} 막지 못했습니다! 보스가 더 사나워집니다.`);
    }
  }
  while (c.q.length && c.q[0].at <= now) {
    const st = c.q.shift(), tgt = S.players[mob.tgt];
    // a dive always comes down, whatever happened meanwhile
    if (st.f === "land") { if (canStand(m, st.x, st.y)) { mob.x = st.x; mob.y = st.y; rt.ev.push(["m", mob.id]); } mob.dive = 0; continue; }
    if (mob.cast || !tgt || tgt.dead) continue;
    if (st.f === "fan") bsVolley(S, rt, mob, tgt, d.atk, 5, st.off || 0);
    else if (st.f === "pool") bsPool(S, rt, mob, tgt, d.atk);
    else if (st.f === "charge" && !mob.act) bsCharge(S, rt, mob, bsFarthest(mob, alive, tgt));
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
    rt.ev.push(["dc", mob.id, 7]);
    for (const o of alive) mobHit(S, rt, o, d.atk * B.hardK, mob, "tele");
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
  rt.ev.push(["dc", mob.id, 8, B.stunMs]);
  for (const o of bsFolk(S, rt, mob, B)) toast(o, "무력화 성공! 보스가 비틀거립니다 — 지금 몰아치세요!");
}
