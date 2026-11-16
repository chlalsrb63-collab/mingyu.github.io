// Hammer impacts are locked to the place and direction shown at the start of the stroke.
function hammerLine(m, x, y, ux, uy, len) {
  let far = 0;
  while (far < len) {
    const next = Math.min(len, far + 2);
    if (solidAt(m, x + ux * next, y + uy * next)) break;
    far = next;
  }
  return far;
}

function startHammer(S, p, move, skill = null, power = 1, hpSpent = 0) {
  const m = mapOfS(S, p.map), [ux, uy] = AIM_V[p.aim | 0];
  const far = hammerLine(m, p.x, p.y, ux, uy, move.center);
  const x = p.x + ux * far, y = p.y + uy * far;
  p.hammer = { move, skill, power, hpSpent, x, y, ox: p.x, oy: p.y, ux, uy,
    map: p.map, hand: p.ch.eq.weapon, at: S.now + move.wind };
  S.maps[p.map].ev.push(["a", p.eid, move.fx, Math.round(x), Math.round(y), p.dir, 0, move.wind, p.aim | 0]);
}

function hammerBracing(p, now) {
  if (!p.hammer || now >= p.hammer.at) return 0;
  return Math.max(p.hammer.move.brace || 0, pasOn(p, "hammer_brace") ? SKILL.hammer_brace.brace : 0);
}

function hammerTick(S, p, now) {
  const cracks = p.hammerCracks;
  if (cracks) for (const [mob, mark] of cracks) if (mark.until <= now || mob.dead) cracks.delete(mob);
  const cast = p.hammer;
  if (!cast || now < cast.at) return;
  p.hammer = null;
  if (p.dead || p.map !== cast.map || p.ch.eq.weapon !== cast.hand || inHand(p.ch) !== "hammer") return;

  const { move, skill, power, hpSpent, x, y, ox, oy, ux, uy } = cast;
  const m = mapOfS(S, p.map), rt = S.maps[p.map], st = stats(p);
  const distance = (mob) => dist(x, y, mob.x, mob.y);
  const targets = rt.mobs.filter(mob => {
    if (mob.dead || mob.dive || distance(mob) > move.r || (mob.x - ox) * ux + (mob.y - oy) * uy < 0) return false;
    const d = dist(ox, oy, mob.x, mob.y);
    return d === 0 || hammerLine(m, ox, oy, (mob.x - ox) / d, (mob.y - oy) / d, d) >= d;
  }).sort((a, b) => distance(a) - distance(b) || a.id - b.id).slice(0, 3);
  const primary = targets[0];
  let critical = false;
  if (primary) {
    const hitOpts = { sk: skill, cue: HIT_CUE.hammer };
    let mult = move.mult;
    const mark = cracks?.get(primary);
    const rupture = move.crackMult && mark?.n === SKILL.hammer_crack.max;
    if (rupture) {
      cracks.delete(primary);
      mult *= move.crackMult * (pasOn(p, "hammer_heart") ? SKILL.hammer_heart.bonus : 1);
    }
    const primaryOpts = rupture && move.shatter ? { ...hitOpts, forceAilment: "physical" } : hitOpts;
    critical = hurtMob(S, rt, primary, p, mult * power, false, primaryOpts) === true;
    if (rupture && move.hpRefund) healP(rt, p, Math.floor(hpSpent * move.hpRefund));
    if (!skill && !primary.dead && !MOBS[primary.k].chest && pasOn(p, "hammer_crack")) {
      const ms = pasOn(p, "hammer_hold") ? SKILL.hammer_hold.ms : SKILL.hammer_crack.ms;
      (p.hammerCracks ||= new Map()).set(primary, { n: Math.min(SKILL.hammer_crack.max, (mark?.n || 0) + 1), until: now + ms });
    }
    for (const target of targets.slice(1)) {
      hurtMob(S, rt, target, p, (move.splashMult ?? move.mult * 0.45) * power, false, hitOpts);
    }
    for (const target of targets) if (move.stun && !target.dead && !MOBS[target.k].boss && !MOBS[target.k].still && target.el !== 2) {
      holdMob(S, target, move.stun * (target.el ? STAGGER.elite : 1));
    }
    if (!skill) pfxBlow(S, rt, p, st, primary, x, y, false, targets);   // a basic hammer blow answers like any basic blow (what it struck is skipped)
  }
  rt.ev.push(["hm", p.eid, Math.round(x), Math.round(y), move.r, +!!primary, +critical, move.fx]);
}

/** 땅울림 발구르기 (no wind-up): the ground round the bearer jumps — the small go up, elites reel, a boss in its marked cast loses gauge. */
function hammerStomp(S, p, sk, k) {
  const rt = S.maps[p.map], now = S.now;
  rt.ev.push(["a", p.eid, sk.fx, Math.round(p.x), Math.round(p.y) - 6, p.dir, 2, sk.r]);
  for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
    hurtMob(S, rt, o, p, sk.mult * k, false, { sk, cue: HIT_CUE.hammer });
    if (o.dead) continue;
    if (o.cast) gaugeHit(S, rt, o, sk.gauge);
    else if (MOBS[o.k].boss) continue;
    else if (o.el) { holdMob(S, o, sk.stg); o.stg = now + STG_MS; }
    else launch(S, rt, o, sk.air);
  }
}
