// ───────────────────────────── simulation ─────────────────────────────

function stepMob(m, mob, tx, ty, speed, dt, fly, now) {
  const d = dist(mob.x, mob.y, tx, ty);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = mob.x + ((tx - mob.x) / d) * step;
  const ny = mob.y + ((ty - mob.y) / d) * step;
  const ok = fly ? canFly : canStand;
  if (ok(m, nx, ny)) { mob.x = nx; mob.y = ny; }
  else if (ok(m, nx, mob.y)) mob.x = nx;
  else if (ok(m, mob.x, ny)) mob.y = ny;
  else return true;
  if (step > 0.5) mob.elementRunAt = now;
  if (Math.abs(tx - mob.x) > 2) mob.dir = tx < mob.x ? 1 : 2;
  return d - step < 1;
}

const has = (mob, t) => !!mob.tr && mob.tr.includes(t);
/** Pick `n` different traits for an elite (one) or a guardian / field boss (two). Treasure goblin only rolls on regular field elites. */
function rollTraits(S, n, allowGoblin = false) {
  const pool = TRAIT_KEYS.filter((k) => (k !== "goblin" || allowGoblin) && (k !== "split" || n <= 1)), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(ri(S, 0, pool.length - 1), 1)[0]);
  return out;
}
/** The existing guaranteed trait or ground-hazard ailment, using its established timing. */
function afflict(S, p, kind, atk) {
  const f = pfxStatus(S, p, kind);                    // a prefix power may shorten it, or refuse it (0)
  if (!(f > 0)) return;
  const now = S.now, k = (1 - deriveStats(p).res) * f;     // WIL shortens it and dulls its bite
  if (kind === "slow") p.slowed = Math.max(p.slowed || 0, now + Math.round(SLOW_MS * k));
  else if (kind === "burn") p.burn = { until: now + Math.round(4000 * k), next: (p.burn && p.burn.next) || now + 1000, dmg: Math.max(1, Math.round(atk * 0.14 * k)) };
  else p.poison = { until: now + Math.round(6000 * k), next: (p.poison && p.poison.next) || now + 1000, dmg: Math.max(1, Math.round(atk * 0.09 * k)) };
  p.dirty = true;
}
/**
 * A monster's blow landing on a player, and whatever its traits add to that. `how`: "blow" (a direct
 * blow) and "shot" (a volley) can be evaded (DEX); "charge" and "tele" (a leap, slam or fan landing) —
 * or any blow of an elite or a boss — shove the player back and make them reel (45-jobs.js).
 */
function mobHit(S, rt, p, raw, mob, how = "blow") {
  if (p.dead || dodged(S, rt, p)) return;
  if (mob && elementMiss(S, mob)) { damageEvent(rt, p.eid, 0, 3, 1); return; }
  if ((how === "blow" || how === "shot") && evadeBlow(S, rt, p)) return;
  const before = p.hp;
  const src = mob && !mob.dead ? mob : null;
  // a rift's master hits softer than its wild kin (64-dim.js)
  if (mob && mob.ak) raw *= mob.ak;
  // a parry, a braced charge, the smoke (57-weapon-skills.js skGuard)
  raw = skGuard(S, rt, p, raw, src, how);
  if (!raw) return;
  p.hitHow = how;   // the kind of blow, for the prefix powers that tell a melee blow or a marked area apart (53-prefix-guard.js)
  const dmg = hurtPlayer(S, rt, p, raw, src, mob && !src ? monsterElement(mob.k).type : undefined);
  p.hitHow = "";
  // a telegraphed trick ("mv", special) only makes a player reel who has not just reeled: no chain of them stun-locks
  const reel = how === "mv" ? !(p.stag > S.now - MV_GRACE) : how === "charge" || (how === "tele" && mob) || (src && (src.el >= 1 || MOBS[src.k].boss));
  if (!p.dead && reel && p.braceAt !== S.now) staggerPlayer(S, rt, p, mob);
  if (!src || src.dead || !src.tr || !src.tr.length) return;
  const atk = MOBS[src.k].atk * ELITE[src.el].atk;
  if (!p.dead && dmg > 0) {
    if (has(src, "fire")) afflict(S, p, "burn", atk);
    if (has(src, "poison")) afflict(S, p, "poison", atk);
    if (has(src, "frost")) afflict(S, p, "slow", atk);
  }
  if (has(src, "vamp")) {
    // it drinks what it spills
    // (a rift monster made tougher heals by the same measure: 64-dim.js dimHk)
    const heal = Math.min(mobMax(src) - src.hp, (Math.max(0, before - p.hp) * 3 * elementHealFactor(S, src)) / (src.hk || 1));
    if (heal >= 1) { src.hp += heal; rt.ev.push(["h", src.id, -Math.round(heal), 0, 0]); }
  }
  if (!p.dead && dmg > 0 && has(src, "siphon")) {
    // 마력흡수 (CBT-06): drains 6% max MP from the hero and restores 3% max HP
    const drain = Math.min(p.mp, Math.max(2, Math.round(stats(p).mmp * 0.06)));
    if (drain > 0) { p.mp -= drain; p.dirty = true; }
    const heal = Math.min(mobMax(src) - src.hp, Math.round(mobMax(src) * 0.03 * elementHealFactor(S, src)));
    if (heal >= 1) { src.hp += heal; rt.ev.push(["h", src.id, -heal, 0, 0]); }
  }
}

/** Each rare spawn rolls its own enchant without touching combat or loot randomness. */
function assignElementEnchant(S, mob) {
  const d = MOBS[mob.k];
  mob.enchant = (mob.el > 0 || d.boss) && !d.chest
    ? DAMAGE_TYPES[ri({ seed: (S.seed ^ Math.imul(mob.id, 0x9e3779b9)) >>> 0 }, 1, DAMAGE_TYPES.length - 1)] : "";
}
/** Three (or more) shots fanned out around the line to the target; each lands where it was aimed, a beat later. */
function volley(S, rt, mob, tgt, dmg, n) {
  const dx = tgt.x - mob.x, dy = tgt.y - mob.y, base = Math.atan2(dy, dx), far = Math.max(30, Math.hypot(dx, dy));
  const ev = ["v", mob.id, VOLLEY_MS];
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.42;
    const x = mob.x + Math.cos(a) * far, y = mob.y + Math.sin(a) * far;
    rt.tele.push({ x, y, r: 13, at: S.now + VOLLEY_MS, dmg, by: mob, ev: "q" });
    ev.push(Math.round(x), Math.round(y));
  }
  rt.ev.push(ev);
}
/** A puddle or a mist takes after its maker's element unless the row names a kind (0 poison, 1 fire, 2 frost). */
const POOL_OF = { poison: 0, fire: 1, cold: 2 };
/** One of a monster's tricks, if the moment suits it. True when it was used. Elites use every trick more often (TRICK_EL). */
function special(S, m, rt, mob, tgt, dd, atk, k) {
  const d = MOBS[mob.k], now = S.now;
  if (k === "charge") {
    // lower the head along a marked line, then run it through
    if (dd < 34 || dd > d.charge) return false;
    const ux = (tgt.x - mob.x) / dd, uy = (tgt.y - mob.y) / dd, len = Math.min(dd + 36, d.charge + 20);
    mob.act = { at: now + CHARGE_MS, ux, uy, len };
    mob.dir = ux < 0 ? 1 : 2;
    rt.ev.push(["c", mob.id, Math.round(mob.x), Math.round(mob.y), Math.round(mob.x + ux * len), Math.round(mob.y + uy * len), CHARGE_MS]);
    mob.castAt = now + 5500 * TRICK_EL[mob.el || 0];
    return true;
  }
  if (k === "leap") {
    // pounce: land beside the target in one bound
    if (dd <= d.range + 16 || dd >= d.leap) return false;
    mob.castAt = now + 4500 * TRICK_EL[mob.el || 0];
    const nx = tgt.x - ((tgt.x - mob.x) / dd) * 14, ny = tgt.y - ((tgt.y - mob.y) / dd) * 14;
    if (canStand(m, nx, ny)) { mob.x = nx; mob.y = ny; mob.atkAt = Math.max(mob.atkAt, now + 350); rt.ev.push(["m", mob.id]); }   // the client lunges it: a bound is seen, not a blink
    return true;
  }
  if (k === "slam") {
    // pound the ground: a ring to step out of
    if (dd >= 70) return false;
    mob.castAt = now + 6000 * TRICK_EL[mob.el || 0];
    rt.tele.push({ x: mob.x, y: mob.y, r: d.slam, at: now + 1100, dmg: atk * 1.5, by: mob });
    rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), d.slam, 1100]);
    return true;
  }
  if (k === "pool") {
    // spit a puddle under the target's feet; it lies there for a while
    if (dd >= 110) return false;
    mob.castAt = now + 6500 * TRICK_EL[mob.el || 0];
    const kind = d.poolKind ?? POOL_OF[monsterElement(mob.k).type] ?? 0;
    rt.pools.push({ x: tgt.x, y: tgt.y, r: d.pool, next: now + POOL_FLY, until: now + POOL_FLY + POOL_MS, dmg: atk * 0.4, atk, kind });
    rt.ev.push(["g", mob.id, Math.round(tgt.x), Math.round(tgt.y), d.pool, POOL_FLY, POOL_MS, kind]);
    return true;
  }
  if (k === "fan") {
    if (dd < 24 || dd >= d.fan) return false;
    mob.castAt = now + 5000 * TRICK_EL[mob.el || 0];
    volley(S, rt, mob, tgt, atk, d.boss ? 5 : 3);
    return true;
  }
  // the telegraphed tricks (TRICKS): each warns for A.ms where it will land; it hits "mv" (no chained reeling)
  const A = TRICKS[k], at = now + A.ms, tx = Math.round(tgt.x), ty = Math.round(tgt.y);
  if (k === "breath") {
    // a cone of breath the way it faces: it stands and gathers, then everyone in the cone is caught
    if (dd > d.breath) return false;
    const ang = Math.atan2(tgt.y - mob.y, tgt.x - mob.x);
    mob.act = { at, f: k, h: { x: mob.x, y: mob.y, r: d.breath, r0: 0, ang, half: A.half } };
    rt.ev.push(["bt", 1, Math.round(mob.x), Math.round(mob.y), d.breath, A.ms, Math.round(ang * 1000), Math.round(A.half * 1000)]);
  } else if (k === "pounce" || k === "burrow") {
    // a ring where the target stands; it comes down there (a burrower underground meanwhile: not hit, not shown)
    if (dd <= d.range + 16 || dd > d[k]) return false;
    mob.act = { at, f: k, x: tgt.x, y: tgt.y };
    rt.tele.push({ x: tgt.x, y: tgt.y, r: A.r, at, dmg: atk * A.k, by: mob, how: "mv" });
    if (k === "burrow") { mob.dive = 2; rt.ev.push(["b", Math.round(mob.x), Math.round(mob.y), 10, 1]); }
    rt.ev.push(["t", tx, ty, A.r, A.ms]);
  } else if (k === "spit") {
    // one lobbed glob, landing on the spot it was aimed at
    if (dd < 40 || dd > d.spit) return false;
    rt.tele.push({ x: tgt.x, y: tgt.y, r: A.r, at, dmg: atk * A.k, by: mob, ev: "q", how: "mv" });
    rt.ev.push(["m", mob.id], ["v", mob.id, A.ms, tx, ty]);
    mob.atkAt = Math.max(mob.atkAt, now + 500);
  } else if (k === "howl") {
    // a rallying cry: its kin near (and itself) bite harder and run faster for a while
    const pack = rt.mobs.filter((o) => o !== mob && !o.dead && !o.dive && !MOBS[o.k].still && !(o.rage > now) && dist(o.x, o.y, mob.x, mob.y) <= d.howl);
    if (!pack.length) return false;
    for (const o of pack.concat(mob)) o.rage = now + A.dur;
    rt.ev.push(["m", mob.id], ["t", Math.round(mob.x), Math.round(mob.y), d.howl, A.ms, 1]);
  } else if (k === "cloud") {
    // a mist round itself that lingers (kind as its pool's; slowing unless it says otherwise)
    if (dd > 60) return false;
    const kind = d.poolKind ?? POOL_OF[monsterElement(mob.k).type] ?? 2;
    rt.pools.push({ x: mob.x, y: mob.y, r: d.cloud, next: at, until: at + A.dur, dmg: atk * A.k, atk, kind });
    rt.ev.push(["g", mob.id, Math.round(mob.x), Math.round(mob.y), d.cloud, A.ms, A.dur, kind]);
  } else if (k === "mend") {
    // 주술 치유형 (CBT-05): heals up to 2 injured nearby non-boss allies
    const alliesInj = rt.mobs.filter((o) => o !== mob && !o.dead && !o.dive && !MOBS[o.k].boss && !MOBS[o.k].chest && !MOBS[o.k].still
      && o.hp < mobMax(o) * 0.85 && dist(o.x, o.y, mob.x, mob.y) <= d.mend)
      .sort((a, b) => a.hp / mobMax(a) - b.hp / mobMax(b)).slice(0, A.cap);
    if (!alliesInj.length) return false;
    for (const o of alliesInj) {
      const heal = Math.min(mobMax(o) - o.hp, Math.max(1, Math.round(mobMax(o) * A.k * elementHealFactor(S, o))));
      if (heal >= 1) { o.hp += heal; rt.ev.push(["h", o.id, -heal, 0, 0]); }
    }
    rt.ev.push(["m", mob.id], ["t", Math.round(mob.x), Math.round(mob.y), d.mend, A.ms, 1]);
  } else if (k === "summon") {
    // 소환형 (CBT-05): calls 1 frail brood minion (never chained, capped at 2 active per summoner)
    if (mob.noSummon || dd > d.summon) return false;
    const active = rt.mobs.filter((o) => o.summonOf === mob.id && !o.dead).length;
    if (active >= A.cap) return false;
    const ang = rnd(S) * Math.PI * 2, sx = mob.x + Math.cos(ang) * 18, sy = mob.y + Math.sin(ang) * 18;
    const ok = d.fly ? canFly : canStand;
    const [mx, my] = ok(m, sx, sy) ? [sx, sy] : [mob.x, mob.y];
    const min = newMob(S, mob.k, null, { elite: 0 });
    min.x = min.hx = min.wx = mx; min.y = min.hy = min.wy = my;
    min.temp = true; min.noDrop = true; min.noSummon = true; min.noSplit = true; min.summonOf = mob.id;
    min.hk = (mob.hk || 1) * 0.32; min.ak = (mob.ak || 1) * 0.55;
    min.hp = mobMax(min); min.tgt = mob.tgt; min.tr = []; min.castAt = now + 2000;
    rt.mobs.push(min);
    rt.ev.push(["m", mob.id], ["r", min.id]);
  } else return false;
  mob.dir = tgt.x < mob.x ? 1 : 2;
  mob.castAt = now + A.cd * TRICK_EL[mob.el || 0];
  return true;
}
/** A telegraphed trick going off (mob.act.f): the breath catches its cone; a pounce or a burrow comes down on its mark. */
function landMove(S, m, rt, mob, atk) {
  const a = mob.act;
  mob.act = null;
  if (a.f === "breath") {
    for (const pid of Object.keys(S.players)) {
      const o = S.players[pid];
      if (o.map === m.id && !o.dead && bsInside(a.h, o.x, o.y)) mobHit(S, rt, o, atk * TRICKS.breath.k, mob, "mv");
    }
  } else {
    mob.dive = 0;
    if ((MOBS[mob.k].fly ? canFly : canStand)(m, a.x, a.y)) { mob.x = a.x; mob.y = a.y; }
  }
  rt.ev.push(["m", mob.id]);
  mob.atkAt = Math.max(mob.atkAt, S.now + 500);
}
/** The run at the end of a charge: as far along the line as the ground allows, through whoever is on it. */
function dash(S, m, rt, mob, atk) {
  const a = mob.act;
  mob.act = null;
  const ok = MOBS[mob.k].fly ? canFly : canStand;
  const x0 = mob.x, y0 = mob.y;
  let far = 0;
  for (let k = 4; k <= a.len; k += 4) { if (!ok(m, x0 + a.ux * k, y0 + a.uy * k)) break; far = k; }
  mob.x = x0 + a.ux * far; mob.y = y0 + a.uy * far;
  if (far > 0) mob.elementRunAt = S.now;
  rt.ev.push(["m", mob.id]);
  for (const pid of Object.keys(S.players)) {
    const p = S.players[pid];
    if (p.map !== m.id || p.dead) continue;
    const rx = p.x - x0, ry = p.y - y0, along = rx * a.ux + ry * a.uy;
    if (along > -6 && along < far + 10 && Math.abs(rx * a.uy - ry * a.ux) < 13) mobHit(S, rt, p, atk * 1.7, mob, "charge");
  }
  mob.atkAt = Math.max(mob.atkAt, S.now + 600);
}

/** `here`: the players standing on this map when its turn began (in S.players order; each is checked again). */
function tickMob(S, m, rt, mob, dt, here) {
  const d = MOBS[mob.k];
  const now = S.now;
  if (mob.dead) {
    // (a cell's monster is gone for good: its cell sends another in its place, cellPass)
    if (!mob.temp && !mob.cellGone && now >= mob.respAt) { placeMob(S, m, mob); rt.ev.push(["r", mob.id]); }
    return;
  }
  if (mob.enchant === undefined) assignElementEnchant(S, mob);
  if (elementTick(S, rt, mob)) return;
  if (mob.dot) {
    // poison keeps biting once a second
    const dot = mob.dot;
    const moving = elementMoving(S, mob);
    if (now >= dot.until) mob.dot = null;
    else if (now >= dot.next) {
      dot.next = now + 1000;
      const o = S.players[dot.pid];
      if (o && o.map === m.id && dealTypedMob(S, rt, mob, o, dot.dmg * (moving ? 2 : 1), "bleed")) return;
    }
  }
  // a scripted field boss: its phases, the marked cast, the enrage (a challenge's boss: chalTick, 64-dim.js)
  if (d.script && !mob.chal) bsField(S, m, rt, mob);
  if (d.still) return;
  if (elementFrozen(S, mob)) return;
  // (a howl's rally: TRICKS.howl; berserk elite below 30% HP: CBT-06)
  const rage = mob.rage > now;
  const berserk = has(mob, "berserk") && mob.hp <= mobMax(mob) * 0.30;
  if (berserk && !mob.berserkOn) { mob.berserkOn = true; rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), 38, 600, 1]); }
  const atk = d.atk * ELITE[mob.el].atk * (rage ? TRICKS.howl.k : 1) * (berserk ? 1.32 : 1);
  // a charge already wound up goes off whatever is done to the charger in the meantime
  if (mob.act) {
    if (now >= mob.act.at) (mob.act.f ? landMove : dash)(S, m, rt, mob, atk);
    return;
  }
  // (a burrower whose trick was cut short, by a rift's reset say, comes back up)
  if (mob.dive === 2) mob.dive = 0;
  if (mob.stun > now) return;
  const swift = has(mob, "swift");
  const attackInterval = d.cd * elementAttackFactor(S, mob) * (berserk ? 0.80 : 1);
  const speed = d.spd * Math.min(mob.slow > now ? 0.5 : 1, elementMoveFactor(S, mob)) * (swift ? 1.35 : 1) * (rage ? 1.15 : 1) * (berserk ? 1.25 : 1);
  if (mob.dec) {
    // a rogue's puppet: walk up to it and strike it, which sets it off
    const dc = mob.dec;
    if (dc.gone || now >= dc.until) mob.dec = null;
    else {
      if (dist(mob.x, mob.y, dc.x, dc.y) <= d.range + 4) { if (now >= mob.atkAt) { mob.atkAt = now + attackInterval; rt.ev.push(["m", mob.id]); popDecoy(S, rt, dc); } }
      else stepMob(m, mob, dc.x, dc.y, speed, dt, d.fly, now);
      return;
    }
  }
  let tgt = mob.tgt ? S.players[mob.tgt] : null;
  const leash = Math.max(150, d.aggro * 2.4);
  if (tgt && (tgt.map !== m.id || tgt.dead || dist(mob.x, mob.y, mob.hx, mob.hy) > leash + 60 || dist(mob.x, mob.y, tgt.x, tgt.y) > leash)) {
    tgt = null; mob.tgt = null; mob.st = 2; mob.by = {};
  }
  const seesShade = d.boss || mob.el === 2;
  if (tgt && !seesShade && runeHidden(tgt, now)) return;
  if (!tgt && d.aggro > 0 && mob.st !== 2 && !(mob.daze > now)) {
    // fog: monsters see a little less far
    let bd = d.aggro * (rt.wx === WX.fog ? WX_FOG_AGGRO : 1);
    for (const p of here) {
      if (p.map !== m.id || p.dead || (p.foes || 0) >= AGGRO_CAP || p.hide > now || (!seesShade && runeHidden(p, now))) continue;
      const dd = dist(mob.x, mob.y, p.x, p.y);
      if (dd < bd) { bd = dd; tgt = p; }
    }
    if (tgt) { mob.tgt = tgt.pid; tgt.foes = (tgt.foes || 0) + 1; }
  }
  if (tgt) {
    const dd = dist(mob.x, mob.y, tgt.x, tgt.y);
    // reflect trait (CBT-06): raises a 2.4s golden reflect barrier every 8s while fighting
    if (has(mob, "reflect") && now >= (mob.refCd || 0)) {
      mob.refUntil = now + 2400;
      mob.refCd = now + 8000;
      rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), 24, 600, 1]);
    }
    // gravity trait (CBT-06): pulls nearby heroes inward every 6.5s
    if (has(mob, "gravity") && now >= (mob.gravCd || 0) && dd <= 120) {
      mob.gravCd = now + 6500;
      rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), 115, 500, 1]);
      for (const o of here) {
        if (o.map !== m.id || o.dead) continue;
        const od = dist(mob.x, mob.y, o.x, o.y);
        if (od <= 22 || od > 115) continue;
        const ux = (mob.x - o.x) / od, uy = (mob.y - o.y) / od;
        let go = 0;
        for (let k = 2; k <= 22; k += 2) { if (!canStand(m, o.x + ux * k, o.y + uy * k)) break; go = k; }
        if (go > 0) { o.x += ux * go; o.y += uy * go; o.fix = true; o.mvAt = now; }
      }
    }
    // treasure goblin trait (CBT-06): flees away from the attacker instead of fighting
    if (has(mob, "goblin")) {
      const ux = dd > 1 ? (mob.x - tgt.x) / dd : 1, uy = dd > 1 ? (mob.y - tgt.y) / dd : 0;
      const fx = mob.x + ux * 64, fy = mob.y + uy * 64;
      if (dist(fx, fy, mob.hx, mob.hy) <= leash + 40) stepMob(m, mob, fx, fy, speed * 1.15, dt, d.fly, now);
      else stepMob(m, mob, mob.hx - uy * 50, mob.hy + ux * 50, speed * 1.15, dt, d.fly, now);
      return;
    }
    // a scripted boss (a challenge's, or MOBS[k].script) takes its turns from its script (56-boss-script.js)
    if (now >= mob.castAt && bsDef(mob)) { bsCast(S, rt, mob, tgt); return; }
    if (now >= mob.castAt) {
      const big = d.boss || mob.el === 2;
      // each kind has its own tricks: it tries them in turn and uses the first that suits the moment.
      // Bosses, guardians and field bosses alternate those with a blast on everyone in the fight.
      let used = false;
      mob.cn = (mob.cn || 0) + 1;
      if (!big || mob.cn % 2) {
        for (let i = 0; i < d.moves.length && !used; i++) {
          const k = d.moves[((mob.mv || 0) + i) % d.moves.length];
          if (special(S, m, rt, mob, tgt, dd, atk, k)) { used = true; mob.mv = ((mob.mv || 0) + i + 1) % d.moves.length; }
        }
      }
      if (!used && big) {
        mob.castAt = now + 6500;
        // one blast on every player in the fight: stand still and the whole party pays
        for (const o of here) {
          if (o.map !== m.id || o.dead || dist(mob.x, mob.y, o.x, o.y) > 220) continue;
          const r = d.boss ? 40 : 32;
          rt.tele.push({ x: o.x, y: o.y, r, at: now + 1300, dmg: atk * (d.boss ? 1.7 : 1.3), by: mob });
          rt.ev.push(["t", Math.round(o.x), Math.round(o.y), r, 1300]);
        }
      } else if (!used) mob.castAt = now + 800;        // nothing suited: look again shortly
      if (mob.act) return;
    }
    if (dd <= d.range) {
      if (now >= mob.atkAt) {
        mob.atkAt = now + attackInterval * (swift ? 0.74 : 1);
        mob.dir = tgt.x < mob.x ? 1 : 2;
        if (d.volley) { rt.ev.push(["m", mob.id]); volley(S, rt, mob, tgt, atk * 0.85, 3); }
        else {
          rt.ev.push(d.shot ? ["m", mob.id, Math.round(tgt.x), Math.round(tgt.y - 8)] : ["m", mob.id]);
          if (d.shot && tgt.wheel > now) rt.ev.push(["bl", tgt.eid]);
          else mobHit(S, rt, tgt, atk, mob);
        }
      } else if (d.ai === "kite" && dd < d.range * 0.55 && dd > 8) {
        // ranged kiting archetype (CBT-05): steps back to maintain spacing while waiting on attack cooldown
        const ux = (mob.x - tgt.x) / dd, uy = (mob.y - tgt.y) / dd;
        const bx = mob.x + ux * 28, by = mob.y + uy * 28;
        if (dist(bx, by, mob.hx, mob.hy) <= leash + 40) stepMob(m, mob, bx, by, speed * 0.65, dt, d.fly, now);
      }
    } else stepMob(m, mob, tgt.x, tgt.y, speed, dt, d.fly, now);
    return;
  }
  if (mob.st === 2) {
    const max = mobMax(mob);
    mob.hp = Math.min(max, mob.hp + max * 0.2 * dt * elementHealFactor(S, mob));
    if (stepMob(m, mob, mob.hx, mob.hy, speed * 1.4, dt, d.fly, now)) { mob.st = 0; mob.hp = max; }
    return;
  }
  if (now >= mob.mvAt) {
    mob.mvAt = now + 1500 + rnd(S) * 3500;
    mob.wx = mob.hx + (rnd(S) - 0.5) * 70;
    mob.wy = mob.hy + (rnd(S) - 0.5) * 70;
  }
  stepMob(m, mob, mob.wx, mob.wy, speed * 0.5, dt, d.fly, now);
}

// ───────────────────────────── active-area cells ─────────────────────────────
// docs/design/scale-and-rift.md B.4d: the monsters of a map live in its cells (m.cells, built
// with the map; rt.slots, one per monster a cell should hold). Cells near the living players
// wake and fill out of sight; far ones sleep and let their calm monsters go. Chests, bosses,
// guardians and event monsters are not in cells and never sleep.

/**
 * A tile in box r that is walkable and at least SPAWN_MIN_D tiles from every one of `pts` (tile
 * coordinates), or null. On a zoned map (33-maps-zones.js) only a tile of zone `z` will do.
 */
function placeAway(S, m, r, pts, z) {
  const [x0, y0, x1, y1] = r, d2 = SPAWN_MIN_D * SPAWN_MIN_D, zone = m.zone && z !== undefined ? m.zone : null;
  for (let i = 0; i < 24; i++) {
    const tx = ri(S, x0, x1), ty = ri(S, y0, y1);
    if (!m.reach[ty * m.w + tx] || (zone && zone[ty * m.w + tx] !== z)) continue;
    let ok = true;
    for (const [px, py] of pts) if ((tx + 0.5 - px) ** 2 + (ty + 0.5 - py) ** 2 < d2) { ok = false; break; }
    if (ok) return [tx, ty];
  }
  return null;
}
/**
 * A cell's crowd for `k` players near it: base × (0.75 + 0.25k), at most DENSITY_MAX; extra slots
 * come and (empty) go, but a wave's slots wait for their monster until their time (`exp`) is up.
 */
function crowdTo(rt, c, k, now) {
  const list = rt.slots[c], base = rt.base[c];
  const target = Math.round(base * Math.min(DENSITY_MAX, 0.75 + 0.25 * k));
  for (let i = list.length - 1; i >= base && list.length > target; i--) if (!list[i].mob && !(list[i].exp > now)) list.splice(i, 1);
  for (let i = list.length; i < target; i++) list.push({ q: list[i % base].q, c, mob: null, due: 0, extra: true });
}
/**
 * A cell falls asleep: its calm monsters leave (one still fighting stays until it calms, a later
 * pass), the ones killed there come back no sooner than CELL_RESPAWN_MS after its last kill, and
 * its extra slots go.
 */
function sleepCell(rt, c) {
  rt.cells[c] = 0;
  const list = rt.slots[c], since = rt.lastKill[c] + CELL_RESPAWN_MS;
  let gone = 0;
  for (const s of list) {
    const mob = s.mob;
    if (!mob) { s.due = Math.max(s.due, since); continue; }
    if (mob.tgt || mob.act) continue;
    mob.slot = null; mob.dead = true; mob.cellGone = true; s.mob = null; s.due = 0; gone++;
  }
  if (gone) for (let i = rt.mobs.length - 1; i >= 0; i--) if (rt.mobs[i].cellGone && rt.mobs[i].dead && !rt.mobs[i].slot) rt.mobs.splice(i, 1);
  for (let i = list.length - 1; i >= rt.base[c]; i--) if (!list[i].mob) list.splice(i, 1);
}
/**
 * Every CELL_PASS_MS on a map with players: wake the cells near the living, put to sleep the ones
 * nobody is near (the dead hold their ground too: dying never clears a crowd), send the waves, then
 * fill the empty slots of the awake cells near the living whose time has come, nearest cells first,
 * out of sight (of the dead too), never past WAKE_MAX_MOBS standing monsters.
 */
function cellPass(S, m, rt, pids) {
  const now = S.now;
  if (now < rt.cellAt || !m.cells) return;
  rt.cellAt = now + CELL_PASS_MS;
  const C = m.cells, cw = C.cw, ch = C.ch, nc = cw * ch;
  const folk = [], here = [];
  for (const pid of pids) { const p = S.players[pid]; if (p.map !== rt.id) continue; here.push(p); if (!p.dead) folk.push(p); }
  const cellX = (p) => clamp(Math.floor(p.x / T / CELL), 0, cw - 1), cellY = (p) => clamp(Math.floor(p.y / T / CELL), 0, ch - 1);
  // near: Chebyshev cells to the nearest living player; held: to the nearest player, dead or alive.
  // Only the cells within SLEEP_R of a player are looked at (the rest stay far).
  const near = new Int32Array(nc).fill(1 << 20), held = new Int32Array(nc).fill(1 << 20), crowd = new Uint8Array(nc);
  for (const p of here) {
    const px = cellX(p), py = cellY(p), live = !p.dead;
    for (let cy = Math.max(0, py - SLEEP_R); cy <= Math.min(ch - 1, py + SLEEP_R); cy++) for (let cx = Math.max(0, px - SLEEP_R); cx <= Math.min(cw - 1, px + SLEEP_R); cx++) {
      const d = Math.max(Math.abs(cx - px), Math.abs(cy - py)), c = cy * cw + cx;
      if (d < held[c]) held[c] = d;
      if (!live) continue;
      if (d < near[c]) near[c] = d;
      if (d <= WAKE_R) crowd[c]++;
    }
  }
  for (let c = 0; c < nc; c++) {
    if (!rt.base[c]) continue;
    if (held[c] > SLEEP_R) {
      if (rt.cells[c] || rt.slots[c].some((s) => s.mob)) sleepCell(rt, c);
      continue;
    }
    if (!rt.cells[c] && near[c] <= WAKE_R) rt.cells[c] = 1;
    if (rt.cells[c]) crowdTo(rt, c, crowd[c], now);
  }
  // waves: a hunter on the move finds more ahead of them
  for (const p of folk) {
    const w = p.wave;
    if (!w || w.map !== rt.id) { p.wave = { map: rt.id, at: now + WAVE_MS, x: p.x, y: p.y }; continue; }
    if (now < w.at) continue;
    const dx = (p.x - w.x) / T, dy = (p.y - w.y) / T, len = Math.hypot(dx, dy);
    w.at = now + WAVE_MS; w.x = p.x; w.y = p.y;
    if (len <= WAVE_MOVE) continue;
    const c = clamp(cellY(p) + Math.round((dy / len) * WAVE_AHEAD), 0, ch - 1) * cw + clamp(cellX(p) + Math.round((dx / len) * WAVE_AHEAD), 0, cw - 1);
    const base = rt.base[c], list = rt.slots[c];
    if (!rt.cells[c] || !base) continue;
    const add = Math.min(Math.ceil(base * WAVE_K), Math.floor(base * DENSITY_MAX) - list.length);
    for (let i = 0; i < add; i++) list.push({ q: list[i % base].q, c, mob: null, due: 0, extra: true, exp: now + WAVE_MS });
  }
  // fill
  let standing = 0;
  for (const mob of rt.mobs) if (!mob.dead && !mob.temp) standing++;
  if (standing >= WAKE_MAX_MOBS) return;
  const order = [];
  for (let c = 0; c < nc; c++) if (rt.cells[c] && rt.base[c] && near[c] <= SLEEP_R) order.push(c);
  order.sort((a, b) => near[a] - near[b] || a - b);
  const pts = here.map((p) => [p.x / T, p.y / T]);
  for (const c of order) for (const s of rt.slots[c]) {
    if (s.mob || now < s.due) continue;
    const at = placeAway(S, m, s.q.r, pts, s.q.zone);
    if (!at) continue;
    const mob = newMob(S, s.q.k, s.q.r, { elite: s.q.ep });
    mob.x = mob.hx = at[0] * T + 8; mob.y = mob.hy = at[1] * T + 10;
    readyMob(S, mob);
    mob.slot = s; s.mob = mob;
    rt.mobs.push(mob);
    if (++standing >= WAKE_MAX_MOBS) return;
  }
}

/** Advance the world to `now`. Maps nobody is standing in are frozen. */
export function tick(S, now) {
  const dt = clamp(now - (S.last || now), 0, 300) / 1000;
  S.last = now;
  S.now = now;
  fairWorld(S, now);   // 버드나무 장날 opening, said once in the chat (63-festival.js)
  skyTick(S, now);
  dimTick(S, now);
  storyTick(S, now);
  coopTick(S, now);     // 협동 아르바이트 shifts (68-coop.js)
  albaTick(S, now);     // 일일 아르바이트 shifts (66-alba.js)
  sxTick(S, now);       // trades and mini-games between players (69-social-play.js)
  homeTick(S, now);
  buddyTick(S, dt);
  const pids = Object.keys(S.players);
  for (const id of liveMapIds(S)) {
    const rt = S.maps[id];
    if (rt.n <= 0) continue;
    fbTick(S, rt, now);   // the field boss back at its spot, its quest's holder taken to the story fight (67-trophies.js)
    npcLifeTick(rt, now);
    const m = mapOfS(S, id);
    cellPass(S, m, rt, pids);
    // how many monsters are already after each player here
    const here = [];
    for (const pid of pids) if (S.players[pid].map === id) { S.players[pid].foes = 0; here.push(S.players[pid]); }
    for (const mob of rt.mobs) { const o = !mob.dead && mob.tgt ? S.players[mob.tgt] : null; if (o && o.map === id) o.foes++; }
    for (const mob of rt.mobs) tickMob(S, m, rt, mob, dt, here);
    shotTick(S, rt, dt);
    for (let i = rt.mobs.length - 1; i >= 0; i--) if ((rt.mobs[i].temp || rt.mobs[i].cellGone) && rt.mobs[i].dead) rt.mobs.splice(i, 1);
    for (let i = rt.zones.length - 1; i >= 0; i--) {
      const z = rt.zones[i];
      if (now < z.next) continue;
      const p = S.players[z.pid];
      if (!p || p.map !== id || (z.follow && p.dead)) { rt.zones.splice(i, 1); continue; }
      if (z.follow) { z.x = p.x; z.y = p.y; }
      z.next = now + z.every;
      rt.ev.push(["b", Math.round(z.x), Math.round(z.y), z.r, z.kind]);
      for (const o of mobsWithin(rt, z.x, z.y, z.r)) {
        if (z.slow) o.slow = now + 2500;
        if (z.knock) { const d = dist(z.x, z.y, o.x, o.y) || 1; knock(m, o, (o.x - z.x) / d, (o.y - z.y) / d, z.knock); }
        const before = o.hp;
        hurtMob(S, rt, o, p, z.mult, false, { px: z.px, elem: z.elem });
        if (!o.dead && o.hp < before && z.pfx === "hellfire") elementMark(S, o, "burn", z.every * 2);
      }
      if (--z.left <= 0) rt.zones.splice(i, 1);
    }
    skillProps(S, rt, m, now);
    for (let i = rt.tele.length - 1; i >= 0; i--) {
      const t = rt.tele[i];
      if (now < t.at) continue;
      rt.tele.splice(i, 1);
      rt.ev.push([t.ev || "b", Math.round(t.x), Math.round(t.y), t.r]);
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead || dist(p.x, p.y, t.x, t.y) > t.r) continue;
        mobHit(S, rt, p, t.dmg, t.by, t.how || (t.ev === "q" ? "shot" : "tele"));
      }
    }
    for (let i = rt.pools.length - 1; i >= 0; i--) {
      // a puddle bites whoever is standing in it, and leaves its mark on them
      const q = rt.pools[i];
      if (now >= q.until) { rt.pools.splice(i, 1); continue; }
      if (now < q.next) continue;
      q.next = now + 700;
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead || dist(p.x, p.y, q.x, q.y) > q.r) continue;
        // overlapping puddles do not add up: one bite at a time
        if (now < (p.poolAt || 0) + 600 || dodged(S, rt, p)) continue;
        p.poolAt = now;
        p.blame = { by: q.kind === 1 ? "불길" : q.kind === 2 ? "얼음 웅덩이" : "독 웅덩이", lv: 0, el: 0 };
        hurtPlayer(S, rt, p, q.dmg, null, q.kind === 1 ? "fire" : q.kind === 2 ? "cold" : "poison");
        if (!p.dead) afflict(S, p, q.kind === 1 ? "burn" : q.kind === 2 ? "slow" : "poison", q.atk);
      }
    }
    for (let i = rt.fires.length - 1; i >= 0; i--) if (rt.fires[i].until && now >= rt.fires[i].until) rt.fires.splice(i, 1);
    for (let i = rt.drops.length - 1; i >= 0; i--) {
      const dr = rt.drops[i];
      if (now >= dr.dieAt) { rt.drops.splice(i, 1); continue; }
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead) continue;
        if (dr.own !== pid && now < dr.freeAt) continue;
        if (dist(p.x, p.y, dr.x, dr.y) > 15) continue;
        if (!pickUp(S, p, dr)) continue;
        rt.drops.splice(i, 1);
        break;
      }
    }
    // a pet runs for its owner's own drops within its reach, one at a time, minding the
    // loot filter and the room in the bag (메이플 펫의 줍기)
    if (rt.drops.length) for (const pid of pids) {
      const p = S.players[pid];
      if (p.map !== id || p.dead || !p.ch.pet || now < (p.petAt || 0)) continue;
      const reach = ITEMS[p.ch.pet].radius;
      let best = -1, bd = reach;
      for (let i = 0; i < rt.drops.length; i++) {
        const dr = rt.drops[i];
        if (dr.own !== pid || !wanted(p.ch, dr) || !fits(p.ch, dr)) continue;
        const d = dist(p.x, p.y, dr.x, dr.y);
        if (d <= bd) { bd = d; best = i; }
      }
      if (best < 0) continue;
      p.petAt = now + pfxNum(p, "pet", PET_MS);
      const dr = rt.drops[best];
      if (pickUp(S, p, dr)) { rt.drops.splice(best, 1); rt.ev.push(["pk", p.eid, Math.round(dr.x), Math.round(dr.y)]); }
    }
  }
  for (const pid of pids) {
    const p = S.players[pid];
    if (p.pinv && now - p.pinv.at > 30000) p.pinv = null;
    if (p.ginv && now - p.ginv.at > 30000) p.ginv = null;
    if (p.fish) {
      // a bite, then a short moment to reel it in
      const rt = S.maps[p.map];
      if (!p.fish.bite && now >= p.fish.at) { p.fish.bite = now; rt.ev.push(["f", p.eid, 2]); }
      else if ((p.fish.bite && !p.fish.hook && now > p.fish.bite + 1800) || (p.fish.hook && now > p.fish.hook + 25000)) { p.fish = null; rt.ev.push(["f", p.eid, 0]); toast(p, "물고기가 달아났습니다."); }
    }
    if (!p.dead) {
      // fire and poison bite once a second until they run out
      for (const key of ["burn", "poison"]) {
        const s = p[key];
        if (!s) continue;
        if (now >= s.until) { p[key] = null; continue; }
        if (now >= s.next) {
          s.next = now + 1000;
          const type = key === "burn" ? "fire" : "poison";
          wound(S, S.maps[p.map], p, s.dmg * elementResist(S, p, type), type);
          if (p.dead) break;
        }
      }
      if (!p.dead) elementTick(S, S.maps[p.map], p);
    }
    if (p.recall && now >= p.recall.at && !p.dead) finishRecall(S, p);
    // life skills: gathering channels, parcels, node cooldowns, the 알바 board's day (58-life.js)
    lifeTick(S, p, now);
    windTouch(S, p, now);
    if (p.rallyAt && now >= p.rallyAt) { p.rallyAt = 0; p.dirty = true; }
    if (!p.dead && !elementFrozen(S, p)) weaponTick(S, p, now);
    if (p.dead || now - p.regenAt < 1000) continue;
    p.regenAt = now;
    ensureDaily(S, p);
    if (!S.dims[p.map]?.story?.airship) explore(S, p);
    const st = stats(p);
    const calm = now - p.hitAt > 5000;
    // a campfire is a place to catch your breath; sitting by it is better still
    const fire = calm ? fireNear(S.maps[p.map], p) : null;
    const rest = fire ? pfxNum(p, "rest", p.sit ? 0.12 : 0.06) : mapOfS(p.S, p.map).safe ? 0.08 : 0.02;
    // a fire's warmth carries on after you stand up, as long as you keep out of a fight
    const wr = calm ? warmRegen(p, now) : 0;
    if (calm && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + (st.mhp * (rest + wr) + 1) * elementHealFactor(S, p));
    if (p.mp < st.mmp) p.mp = Math.min(st.mmp, p.mp + st.mmp * ((fire ? rest : 0.03) + wr + st.mpReg) + 1);
    if (fire && p.sit) warmTick(S, p, fire, now);
    else p.warmT = 0;
    restTick(S, p, now);   // 쉼표 수첩: sitting by a resting spot (69-rest.js)
    pfxTick(S, S.maps[p.map], p, st, now, calm);   // the prefix powers that work once a second (regen, cleanse, resting)
  }
  return S;
}

/** Call once every player's view for this tick has been taken. */
export function endTick(S) {
  for (const id of Object.keys(S.maps)) {
    const rt = S.maps[id];
    rt.ev.length = 0;
    rt.who = false;
    if (rt.npcRows?.length) rt.npcRows = null;
    rt.mv = null;   // the monster rows viewFor shared this tick (90-views-api.js mobViews)
  }
  S.chat.length = 0;
}

export function isGameOver() {
  return { over: false };
}

/** Today's tasks as the player sees them: what, how far, what it pays, and when they renew. */
