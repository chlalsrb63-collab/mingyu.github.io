// ───────────────────────────── weapon skills ─────────────────────────────
// docs/design/jobs-and-stats.md C (tables in 03-skills.js). A skill belongs to a weapon: it is usable
// while that weapon is in hand and its mastery has reached the skill's `need`; a job signature needs the
// job (and its weapon in hand), a hybrid's either weapon of its pair. The passives (관성, 급소, 창끝, 공명,
// 낙인, 매의 시야) hook into basicAttack, hurtMob and the arrows; whatever lingers (a vortex, a beast, rain,
// traps, a sanctuary, a rune circle…) stands in `rt.props` and is stepped by skillProps every tick.

/** The weapon kind actually in hand ("" bare-handed: skills need a weapon). */
const inHand = (ch) => (ch.eq.weapon ? ITEMS[ch.eq.weapon.id].wk : "");
/** The weapon kinds a skill can be used with. */
const skWks = (sk) => (sk.kind === "h" ? JOBS[sk.job].wk : [sk.wk]);
/** Has this character learned the skill (mastery for a weapon skill, the job for a signature)? */
const skLearned = (ch, sk) => (sk.job ? ch.job === sk.job && (ch.jp?.lv || 0) >= sk.jobNeed : ch.wm[sk.wk].lv >= sk.need);
/** Skills that count as a staff's (resonance) or a book's (the brand): the weapon's own and its jobs' signatures. */
const skOf = (sk, wk) => (sk.job ? JOBS[sk.job].wk.includes(wk) : sk.wk === wk);
/** Every skill a character has learned, in SKILL_ORDER (the wire's list). */
const skillsFor = (ch) => SKILL_ORDER.filter((id) => skLearned(ch, SKILL[id]));
/** Why `ch` cannot use skill `sk` with what is in hand ("" when it can; cooldown and MP are checked elsewhere). */
function skWhy(ch, sk) {
  const wk = skWks(sk)[0];
  if (sk.job && ch.job !== sk.job) return `[${JOBS[sk.job].name}]의 스킬입니다`;
  if (sk.job && !skLearned(ch, sk)) return `[${JOBS[sk.job].name}] 직업 Lv.${sk.jobNeed}에 배웁니다`;
  if (!sk.job && ch.wm[sk.wk].lv < sk.need) return `[${WK_NAME[sk.wk]}] 숙련 ${sk.need}에 배웁니다`;
  if (!skWks(sk).includes(inHand(ch))) return `[${WK_NAME[wk]}]${pp(WK_NAME[wk], "을를")} 들어야 쓸 수 있습니다`;
  return "";
}
/**
 * Is weapon passive `id` working now? Its weapon is in hand with the mastery for it; a hybrid keeps
 * both of its weapons' passives on whichever of the two it holds.
 */
function pasNative(ch, id, load, hand = inHand(ch)) {
  const sk = SKILL[id];
  if (!hand || ch.wm[sk.wk].lv < sk.need) return false;
  const j = JOBS[ch.job];
  if (hand !== sk.wk && !(j && j.kind === "hybrid" && j.wk.includes(sk.wk) && j.wk.includes(hand))) return false;
  // the loadout last: building one is the dear part (pasOn runs on every snapshot)
  return (load || loOf(ch)).p.includes(id);
}
const pasOn = (p, id) => pasNative(p.ch, id);
/** Skill power from mastery past the skill's need (a hybrid signature: the lower of its two weapons). */
function skGrow(ch, sk) {
  const m = Math.min(...skWks(sk).map((k) => ch.wm[k].lv));
  const rank = Math.max(0, (ch.jp?.lv || 0) - (sk.jobNeed || 0));
  return (1 + SK_GROW * Math.max(0, m - sk.need)) * (sk.job ? 1 + rank * SK_GROW : 1) * skeMul(ch, sk);
}
/** Resonance full: the next staff skill is free and hits harder. */
const resoReady = (p, sk) => skOf(sk, "staff") && (p.reso | 0) >= SKILL.reso.n && pasOn(p, "reso");
const skJobBonus = (p, sk) => sk.job === p.ch.job ? JOB_SKILL_RANKS[jobSkillRank(p.ch.jp?.lv || 0)] : null;
/** What a skill costs right now. */
const skMp = (p, sk) => resoReady(p, sk) ? 0 : Math.max(0, Math.ceil(pfxNum(p, "mp", sk.mp * (100 - (skJobBonus(p, sk)?.mp || 0)) / 100)));
const skCooldown = (p, sk) => Math.round(sk.cd * (1 - stats(p).cdr) * (100 - (skJobBonus(p, sk)?.cd || 0)) / 100);
function skillHpCost(p, sk) {
  if (!sk.hpPct) return 0;
  const discount = sk.wk === "hammer" && pasOn(p, "hammer_breath") ? SKILL.hammer_breath.discount : 0;
  return Math.ceil(stats(p).mhp * Math.max(0.01, sk.hpPct - discount));
}
/** Inertia stacks still held (they fall away 2.5 s after the last sword hit). */
const inertOf = (p) => (p.inert && p.S.now - p.inertAt <= SKILL.inertia.ms ? p.inert : 0);

const marksOf = (S, mob) => (mob.mkAt > S.now ? mob.mk | 0 : 0);
function addMarks(S, mob, n) {
  if (mob.dead) return;
  mob.mk = Math.min(MARK_MAX, marksOf(S, mob) + n);
  mob.mkAt = S.now + MARK_MS;
}
// ── combo hooks (docs/design/skill-combos.md): states one skill leaves on a monster and another spends for a bonus.
// They live on the monster (runtime only), so anyone's skill can cash them in.
const STG_MS = 2500, DRAG_MS = 2000, BRN_MS = 6000, BRN_MAX = 3;
const brnOf = (S, o) => (o.brnAt > S.now ? o.brn | 0 : 0);
/** One more stack of 화상 (fire skills; 점화 폭발 spends them). */
function addBrn(S, o) {
  if (o.dead) return;
  o.brn = Math.min(BRN_MAX, brnOf(S, o) + 1);
  o.brnAt = S.now + BRN_MS;
}
/** Knock a monster off its feet for `ms`: airborne and helpless (bosses and champions stay put, elites half as long). */
function launch(S, rt, o, ms) {
  if (o.dead || MOBS[o.k].boss || MOBS[o.k].still || o.el === 2) return;
  const t = S.now + ms * (o.el ? 0.5 : 1);
  o.air = t;
  o.stun = Math.max(o.stun, t);
  rt.ev.push(["cb", o.id, 9]);
}
/** Each state: [the "cb" code the client shows, how much of it the monster carries now, spend it]. */
const COMBO = {
  stg: [1, (S, o) => !(o.air > S.now) && !(o.frz > S.now) && (o.stg > S.now || o.stun > S.now), (S, o) => { o.stg = 0; }],
  frz: [2, (S, o) => o.frz > S.now, (S, o) => { o.frz = 0; o.stun = Math.min(o.stun, S.now); }],
  air: [3, (S, o) => o.air > S.now, (S, o) => { o.air = 0; o.stun = Math.min(o.stun, S.now); }],
  mk: [4, (S, o) => marksOf(S, o), (S, o) => { o.mk = 0; }],
  brand: [5, (S, o) => o.brand > S.now, (S, o) => { o.brand = 0; }],
  brn: [6, brnOf, (S, o) => { o.brn = 0; }],
  drag: [7, (S, o) => o.drag > S.now, (S, o) => { o.drag = 0; }],
};
/** A consumer's hit (`eat` = {state: bonus per unit}): the multiplier it earns, the states spent. */
function comboK(S, rt, o, eat) {
  if (!eat || o.dead) return 1;
  let k = 1;
  for (const key in eat) {
    const [code, has, spend] = COMBO[key], n = +has(S, o);
    if (!n) continue;
    k += eat[key] * n;
    spend(S, o);
    rt.ev.push(["cb", o.id, code]);
  }
  return k;
}
/** The first `n` monsters along a strip, nearest first. */
function lineFirst(rt, x, y, ux, uy, len, half, n) {
  const along = (o) => (o.x - x) * ux + (o.y - y) * uy;
  return mobsInLine(rt, x, y, ux, uy, len, half).sort((a, b) => along(a) - along(b)).slice(0, n);
}

/** Take a share `f` off a scripted boss's stagger gauge while it gathers its marked cast (56-boss-script.js). */
function gaugeHit(S, rt, o, f) {
  if (o.cast && !o.dead) bsDealt(S, rt, o, o.cast.need * f);
}

// ── E1 누르고 떼기 (skill-ideas.md §0): a held skill (sk.tiers) gathers in tiers until the key comes up ({t:"skr"}),
// the same skill is pressed again, or it is held too long (it then lands a tier short: the over-charge).
/** The tier a held charge has reached now: 0 … sk.tiers.length (past sk.holdMs, one short of the top). */
function holdTier(p, now) {
  const sk = SKILL[p.hold.id], held = now - p.hold.at;
  if (held > sk.holdMs) return sk.tiers.length - 1;
  let t = 0;
  for (const at of sk.tiers) if (held >= at) t++;
  return t;
}
/** Let a held charge go: it lands at the tier it reached. */
function holdGo(S, p) {
  const h = p.hold;
  if (!h) return;
  p.holdT = holdTier(p, S.now);
  p.hold = null;
  p.dirty = true;
  skStrike(S, p, h.id, h.k, h.cost);
}

/**
 * A monster's blow about to land on `p` (mobHit): E3 the parry window, then what is left of the blow —
 * a whiffed parry's opening, the smoke against volleys, a held charge's braced shoulder. 0: nothing lands.
 */
function skGuard(S, rt, p, raw, mob, how) {
  const now = S.now;
  if (p.parry && mob && now < p.parry.until && (mob.x - p.x) * p.parry.u[0] + (mob.y - p.y) * p.parry.u[1] >= 0) { parryOk(S, rt, p, mob); return 0; }
  let k = p.exposed > now ? 1 + SKILL.parry.exposed : 1;
  if (how === "shot" && p.smokeAt > now) k *= 1 - SKILL.smoke.shot;
  if (p.hold && !p.hold.braced && holdTier(p, now) >= 1) {
    // 어깨 버티기: half the blow, no reeling, and the charge jumps a tier
    const sk = SKILL[p.hold.id], t = holdTier(p, now);
    if (t < sk.tiers.length) p.hold.at = now - sk.tiers[t];
    p.hold.braced = true;
    p.braceAt = now;
    k *= sk.brace;
  }
  return raw * k;
}
/** 칼등 받아치기 caught a blow: the attacker reels, the blade answers in front, inertia and a shorter wait. */
function parryOk(S, rt, p, mob) {
  const sk = SKILL.parry, now = S.now, k = p.parry.k;
  p.parry = null;
  rt.ev.push(["a", p.eid, sk.fx, Math.round(p.x), Math.round(p.y) - 6, p.dir, 2, 1]);
  if (mob.cast) gaugeHit(S, rt, mob, sk.gauge);
  else if (!MOBS[mob.k].boss && mob.el !== 2) { mob.stun = Math.max(mob.stun, now + sk.stg * (mob.el ? 0.5 : 1)); mob.stg = now + STG_MS; }
  for (const o of mobsWithin(rt, p.x, p.y, sk.r)) if (inArc(p, o, sk.arc)) hurtMob(S, rt, o, p, sk.mult * k, false, { sk });
  if (pasOn(p, "inertia")) { p.inert = Math.min(SKILL.inertia.max, inertOf(p) + sk.inert); p.inertAt = now; }
  if (p.cds.parry > now) p.cds.parry = now + Math.round((p.cds.parry - now) * sk.cdCut);
  p.dirty = true;
}

/** Drag a monster toward (tx, ty), as far as the ground lets it. */
function pullTo(m, mob, tx, ty) {
  if (MOBS[mob.k].boss || MOBS[mob.k].still || mob.el === 2) return false;
  const ok = MOBS[mob.k].fly ? canFly : canStand;
  const d = dist(mob.x, mob.y, tx, ty);
  if (d < 1) return true;
  const ux = (tx - mob.x) / d, uy = (ty - mob.y) / d;
  let far = 0;
  for (let k = 4; k <= d; k += 4) { if (!ok(m, mob.x + ux * k, mob.y + uy * k)) break; far = k; }
  if (far >= d - 4 && ok(m, tx, ty)) { mob.x = tx; mob.y = ty; } else { mob.x += ux * far; mob.y += uy * far; }
  return true;
}
/** Pull a monster up to `n` px toward (x, y). */
function tug(m, mob, x, y, n) {
  const d = dist(mob.x, mob.y, x, y);
  if (d < 2) return;
  pullTo(m, mob, mob.x + ((x - mob.x) / d) * Math.min(n, d), mob.y + ((y - mob.y) / d) * Math.min(n, d));
}
/** How far along (ux, uy) from (x, y) something can fly before the ground stops it. */
function reach(m, x, y, ux, uy, len, step = 6) {
  let far = 0;
  for (let k = step; k <= len; k += step) { if (solidAt(m, x + ux * k, y + uy * k - 3)) break; far = k; }
  return far;
}
/** How far along (ux, uy) a body can step (every step on standable ground). */
function stepTo(m, x, y, ux, uy, len) {
  let far = 0;
  for (let d = 6; d <= len; d += 6) { if (!canStand(m, x + ux * d, y + uy * d)) break; far = d; }
  return far;
}
/** Two elements meeting at (x, y): the reaction `key` (REACT) goes off there. */
function react(S, rt, p, key, x, y, k) {
  const rx = REACT[key], now = S.now, m = mapOfS(S, p.map);
  rt.ev.push(["rx", rx.id === "steam" ? 1 : rx.id === "super" ? 2 : 3, Math.round(x), Math.round(y), rx.r]);
  for (const o of mobsWithin(rt, x, y, rx.r)) {
    if (rx.vuln) { o.vuln = now + rx.vuln; rt.ev.push(["vu", o.id, rx.vuln]); }
    if (rx.knock) { const d = dist(x, y, o.x, o.y) || 1; knock(m, o, (o.x - x) / d, (o.y - y) / d, rx.knock); }
    hurtMob(S, rt, o, p, rx.mult * k * (1 + stats(p).burst) * (pasHas(p, "staff_chant30") ? 1 + SKILL.staff_chant30.k : 1), false, { mag: 1 });
  }
  return rx;
}
/** A spell of element `e` landing at (x, y): if another element is still held the two react there; else `e` is held next. */
function weave(S, rt, p, e, x, y, k) {
  const now = S.now, held = p.weave && p.weave.until > now ? p.weave.e : "";
  if (held && held !== e) { p.weave = null; return react(S, rt, p, pairKey(e, held), x, y, k); }
  p.weave = { e, until: now + WEAVE_MS };
  return null;
}

/** A rogue's puppet (or a tracker's lure) goes off: it marks and hurts whatever crowded round it. */
function popDecoy(S, rt, dc) {
  if (dc.gone) return;
  dc.gone = true;
  rt.ev.push(["dx", dc.id, Math.round(dc.x), Math.round(dc.y), dc.r]);
  for (const o of rt.mobs) if (o.dec === dc) o.dec = null;
  const p = S.players[dc.pid];
  if (!p || p.map !== rt.id) return;
  for (const o of mobsWithin(rt, dc.x, dc.y, dc.r)) { hurtMob(S, rt, o, p, dc.mult); addMarks(S, o, 2); }
}
/** Damage dealt by `fn()` to the monsters' tallies of `p` (for drains and heals). */
function dealt(p, mobs, fn) {
  let before = 0;
  for (const o of mobs) before += o.by[p.pid] || 0;
  fn();
  let after = 0;
  for (const o of mobs) after += o.by[p.pid] || 0;
  return after - before;
}
/** Give `p` back `n` HP (a heal number over them). */
function healP(rt, p, n, cue) {
  if (p.dead) return 0;
  const amt = Math.min(stats(p).mhp - p.hp, Math.round(n));
  if (amt < 1) return 0;
  p.hp += amt;
  const event = ["h", p.eid, -amt, 0, 1];
  if (cue) event.push(0, cue);
  rt.ev.push(event);
  return amt;
}

/** A healed ally's next nearby kill can share job XP with the caster. */
function healSupport(rt, healer, ally, amount, cue, creditMs) {
  const restored = healP(rt, ally, amount, cue);
  if (restored && ally !== healer && healer.party && healer.party === ally.party) {
    const now = healer.S.now;
    let support = healer.healCredit;
    if (!support || support.map !== healer.map || support.party !== healer.party) {
      support = healer.healCredit = { map: healer.map, party: healer.party, targets: new Map() };
    }
    for (const [pid, expires] of support.targets) if (expires <= now) support.targets.delete(pid);
    support.targets.set(ally.pid, now + creditMs);
  }
  return restored;
}

/** Lingering skill things in a map: lures, vortices, beasts, storms, traps, a sanctuary. */
function skillProps(S, rt, m, now) {
  if (rt.decoys && rt.decoys.length) {
    for (let i = rt.decoys.length - 1; i >= 0; i--) {
      const dc = rt.decoys[i];
      if (!dc.gone && now >= dc.until) popDecoy(S, rt, dc);
      if (dc.gone) rt.decoys.splice(i, 1);
    }
  }
  if (!rt.props || !rt.props.length) return;
  for (let i = rt.props.length - 1; i >= 0; i--) {
    const o = rt.props[i], p = S.players[o.pid];
    // a caster who fell or left takes what they conjured with them
    if (!p || p.dead || p.map !== rt.id) { rt.props.splice(i, 1); if (o.wire) rt.ev.push(["pe", o.id, 0]); continue; }
    if (now >= o.until) { propEnd(S, rt, m, p, o); rt.props.splice(i, 1); continue; }
    if (now < o.next) continue;
    o.next = now + o.every;
    if (propPulse(S, rt, m, p, o, now)) rt.props.splice(i, 1);
  }
}
/** One beat of a prop. Returns true when it is used up. */
function propPulse(S, rt, m, p, o, now) {
  const opt = { mag: o.mag, sk: o.sk };
  const hit = (mob, mult) => hurtMob(S, rt, mob, p, mult, false, opt);
  switch (o.kind) {
    case "bolt": {
      // the soul bolt arrives: what it takes, it gives back
      const mob = rt.mobs.find((q) => q.id === o.tgt && !q.dead);
      if (mob && dist(mob.x, mob.y, o.x, o.y) < 90) healP(rt, p, dealt(p, [mob], () => hit(mob, o.mult)) * o.heal);
      return true;
    }
    case "grav": {
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y)]);
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) { tug(m, mob, o.x, o.y, o.pull); if (!MOBS[mob.k].boss) mob.drag = now + DRAG_MS; hit(mob, o.mult); }
      return false;
    }
    case "spin": {
      // 칼날 소용돌이: free blades round the caster, each cutting every beat (no channel, nothing paid)
      if (o.blades) {
        o.x = p.x; o.y = p.y;
        rt.ev.push(["a", p.eid, o.sk.fx, Math.round(p.x), Math.round(p.y) - 6, p.dir, 2, o.blades]);
        // only the nearest `cap` are cut: the 도적 stays a single-target job, not a pack clearer (balance-2026-11-15)
        const near = mobsWithin(rt, p.x, p.y, o.r).sort((u, v) => dist(p.x, p.y, u.x, u.y) - dist(p.x, p.y, v.x, v.y));
        for (const mob of near.slice(0, o.sk.cap || near.length)) hit(mob, o.mult * o.blades);
        return false;
      }
      // 돌개바람 / 무쌍난무: follows the caster; each beat pays MP (and HP) first, then cuts everything around
      if (p.chan !== o.id) return true;
      // the beat's price is a share of the pools, so regeneration never makes it free
      const st = stats(p), mpT = Math.ceil(st.mmp * o.mpT), hpT = o.hpT ? Math.ceil(st.mhp * o.hpT) : 0;
      if (p.mp < mpT || (hpT && p.hp <= hpT)) { p.chan = 0; toast(p, p.mp < mpT ? "마나가 모자라 회전이 멈췄습니다" : "HP가 모자라 회전이 멈췄습니다"); return true; }
      p.mp -= mpT; if (hpT) p.hp -= hpT;
      o.x = p.x; o.y = p.y;
      const last = --o.left <= 0, list = mobsWithin(rt, p.x, p.y, o.r);
      rt.ev.push(["a", p.eid, o.sk.fx, Math.round(p.x), Math.round(p.y) - 6, p.dir, 2, last ? 2 : 1]);
      dealt(p, list, () => { for (const mob of list) hit(mob, o.mult); });
      if (last) p.chan = 0;
      return last;
    }
    case "chan": {
      // a held beam along the caster's aim; any other skill cuts it (p.chan changes). The last pulse spends brands.
      if (p.chan !== o.id) return true;
      const [ux, uy] = AIM_V[p.aim | 0], last = --o.left <= 0;
      const far = Math.max(16, reach(m, p.x, p.y, ux, uy, o.len)), list = lineFirst(rt, p.x, p.y, ux, uy, far, o.half, 2), t = list[0];
      rt.ev.push(["a", p.eid, o.sk.fx, Math.round(t ? t.x : p.x + ux * far), Math.round((t ? t.y : p.y + uy * far) - 6), p.dir, 2, last ? 2 : 1]);
      const got = dealt(p, list, () => { for (const mob of list) hit(mob, last ? o.fin * comboK(S, rt, mob, o.sk.eat) : o.mult); });
      if (got > 0) healP(rt, p, got * o.heal);
      if (last) p.chan = 0;
      return last;
    }
    case "phantom": {
      // the beast leaps on the nearest monster near it and bites
      let best = null, bd = o.r;
      for (const mob of rt.mobs) { if (mob.dead) continue; const d = dist(mob.x, mob.y, o.x, o.y); if (d <= bd) { bd = d; best = mob; } }
      if (!best) return false;
      const d = bd || 1;
      if (d > 10) { o.x = best.x + ((o.x - best.x) / d) * 10; o.y = best.y + ((o.y - best.y) / d) * 10; }
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y), best.id]);
      hit(best, o.bite);
      return false;
    }
    case "rain":
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) { mob.slow = Math.max(mob.slow || 0, now + 1200); hit(mob, o.mult); }
      return false;
    case "storm":
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y)]);
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) { mob.slow = Math.max(mob.slow || 0, now + 1200); hit(mob, o.mult); }
      return false;
    case "field": {
      const list = mobsWithin(rt, o.x, o.y, o.r);
      if (list.length) healP(rt, p, dealt(p, list, () => { for (const mob of list) hit(mob, o.mult); }) * o.heal);
      return false;
    }
    case "pillar": {
      // three lashes of the thunder dragon, then the stroke that pins them
      const last = o.left <= 0, list = mobsWithin(rt, o.x, o.y, o.r);
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y), last ? 1 : 0]);
      for (const mob of list) {
        if (last && !MOBS[mob.k].boss && mob.el !== 2) mob.stun = Math.max(mob.stun, now + (mob.el ? o.stun[1] : o.stun[0]));
        hit(mob, last ? o.fin : o.mult);
      }
      if (last) { weave(S, rt, p, "l", o.x, o.y, o.k); return true; }
      o.left--;
      return false;
    }
    case "meteor": {
      // a stone out of the sky, on one of them if any are there; lightning leaps from it to one more
      const inside = mobsWithin(rt, o.x, o.y, o.r);
      let x, y;
      if (inside.length && rnd(S) < 0.7) { const t = inside[Math.floor(rnd(S) * inside.length)]; x = t.x; y = t.y; }
      else { const a = rnd(S) * Math.PI * 2, r = Math.sqrt(rnd(S)) * o.r * 0.8; x = o.x + Math.cos(a) * r; y = o.y + Math.sin(a) * r; }
      rt.ev.push(["pp", o.id, Math.round(x), Math.round(y)]);
      const hitNow = mobsWithin(rt, x, y, o.hr);
      for (const mob of hitNow) { hit(mob, o.mult); addBrn(S, mob); }
      weave(S, rt, p, "f", x, y, o.k);
      const next = rt.mobs.filter((q) => !q.dead && !hitNow.includes(q) && dist(q.x, q.y, x, y) <= 70).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
      if (next) {
        rt.ev.push(["ln", 4, Math.round(x), Math.round(y - 6), Math.round(next.x), Math.round(next.y - 6)]);
        hit(next, o.chain);
        weave(S, rt, p, "l", next.x, next.y, o.k);
      }
      return --o.left <= 0;
    }
    case "trap": {
      // something stepped on it: rooted where it stands, and a shadow of the tracker comes out of the ground at it
      const mob = rt.mobs.find((q) => !q.dead && dist(q.x, q.y, o.x, o.y) - big(q) <= o.r);
      if (!mob) return false;
      rt.ev.push(["pe", o.id, 1, mob.id]);
      if (o.snare) {
        // 올무 화살: the first one is rooted (a fifth as long on a boss) and counts as staggered; two near it are hauled in
        const sk = o.sk, root = sk.root[MOBS[mob.k].boss ? 2 : mob.el ? 1 : 0];
        mob.stun = Math.max(mob.stun, now + root);
        mob.stg = now + root;
        hit(mob, o.mult);
        for (const q of mobsWithin(rt, o.x, o.y, sk.pull).filter((q) => q !== mob).slice(0, 2)) if (pullTo(m, q, o.x, o.y)) q.drag = now + DRAG_MS;
        return true;
      }
      for (const q of mobsWithin(rt, o.x, o.y, o.r + 10)) if (!MOBS[q.k].boss && q.el !== 2) q.stun = Math.max(q.stun, now + o.root * (q.el ? 0.5 : 1));
      for (let j = 0; j < 3; j++) hit(mob, o.stab);
      for (let j = 0; j < 2; j++) hit(mob, o.shot);
      return true;
    }
    case "mortar": {
      // the arrow comes down: a blast, and powder quills (marks) in all it caught
      rt.ev.push(["a", p.eid, o.sk.fx, Math.round(o.x), Math.round(o.y) - 6, p.dir, 2, 2]);
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) { hit(mob, o.mult); addMarks(S, mob, o.sk.marks); }
      return true;
    }
    case "smoke": {
      // E5: a monster coming into the smoke forgets whom it was after and looks for no one while in it (a blow still
      // wakes it: hurtMob gives it a target again); the party in it is hard to shoot
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) if (!MOBS[mob.k].boss) { if (!(mob.daze > now)) mob.tgt = null; mob.daze = now + o.every + 600; }
      for (const q of allies(S, p)) if (dist(q.x, q.y, o.x, o.y) <= o.r) q.smokeAt = now + o.every + 150;
      return false;
    }
    case "burst": {
      // the blood they carry bursts: fixed dark damage, no armour turns it; marks, bleeding and brands are spent
      const atk = stats(p).atk;
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y)]);
      for (const mob of rt.mobs) {
        if (mob.dead || !o.ids.includes(mob.id)) continue;
        const bleed = mob.dot && mob.dot.until > now ? 1 : 0, br = mob.brand > now ? 1 : 0, mk = marksOf(S, mob);
        const dmg = Math.max(1, Math.round(atk * (o.base + o.bleed * bleed + o.mark * mk + o.brandK * br) * o.k));
        mob.mk = 0; mob.dot = null; mob.brand = 0;
        wmHit(S, p, mob);
        dealMob(S, rt, mob, p, dmg, 0);
      }
      return true;
    }
    case "rune": {
      // the circle beats: everything inside is struck (and branded, a book's skill); fire, ice and lightning
      // take turns in it, so every other beat the element it holds meets the new one and they react (the
      // circle keeps its own element: it does not feed the caster's weaving)
      const e = "fil"[o.i++ % 3];
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y), WEAVE_CODE[e]]);
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) hit(mob, o.mult);
      if (o.held && o.held !== e) { const key = pairKey(e, o.held); o.held = ""; react(S, rt, p, key, o.x, o.y, o.k * o.rxK); }
      else o.held = e;
      return false;
    }
    case "banner": {
      if (p.party !== o.party) { propEnd(S, rt, m, p, o); return true; }
      rt.ev.push(["pp", o.id, Math.round(o.x), Math.round(o.y), ++o.i]);
      for (const ally of members(S, p)) {
        if (ally.dead || ally.map !== p.map || dist(ally.x, ally.y, o.x, o.y) > o.r) continue;
        if (!(ally.rallyAt > now)) ally.dirty = true;
        ally.rallyAt = now + o.every + 150;
        if (ally.rallyMendAt > now) continue;
        const heal = (stats(ally).mhp * o.sk.heal + o.atk * o.sk.atkHeal) * o.k;
        if (healSupport(rt, p, ally, ally === p ? heal / 2 : heal, HIT_CUE.rally, o.sk.creditMs)) {
          ally.rallyMendAt = now + o.every - 100;
        }
      }
      return false;
    }
    case "sanct": {
      // blood sanctuary: the party inside is warded, the monsters inside bleed into the most hurt of them
      o.x = p.x; o.y = p.y;
      const inside = allies(S, p).filter((q) => !q.dead && dist(q.x, q.y, o.x, o.y) <= o.r);
      for (const q of inside) q.sanctAt = now + o.every + 150;
      const list = mobsWithin(rt, o.x, o.y, o.r);
      const got = list.length ? dealt(p, list, () => { for (const mob of list) hit(mob, o.mult); }) : 0;
      const low = inside.sort((a, b) => a.hp / stats(a).mhp - b.hp / stats(b).mhp)[0];
      if (low && got > 0) healP(rt, low, got * 0.5, HIT_CUE.sanctuary);
      return false;
    }
  }
  return true;
}
/** A prop's time is up. */
function propEnd(S, rt, m, p, o) {
  if (o.wire) rt.ev.push(["pe", o.id, 0]);
  if (o.kind === "phantom") {
    // the beast breaks into a curse that bursts over everything near it (more on the branded)
    rt.ev.push(["bw", Math.round(o.x), Math.round(o.y), o.r, 15]);
    for (const mob of mobsWithin(rt, o.x, o.y, o.r)) hurtMob(S, rt, mob, p, o.blast * (mob.brand > S.now ? 1 + o.brandK : 1), false, { mag: 1, sk: o.sk });
  }
}
/** Put a prop in the map (and tell the players when it is one they see standing). */
function addProp(S, rt, p, o) {
  if (!rt.props) rt.props = [];
  o.id = S.nextId++;
  o.pid = p.pid;
  rt.props.push(o);
  if (o.wire) rt.ev.push(["pr", o.id, o.kind, Math.round(o.x), Math.round(o.y), o.r, o.until - S.now, p.eid]);
  return o;
}

/** One blink of 무영난무: on to the next monster near where it began (marked first), or home when done. */
function danceStep(S, p, now) {
  const dn = p.dance;
  if (now < dn.next) return;
  const rt = S.maps[p.map], m = mapOfS(p.S, p.map);
  const ox = p.x, oy = p.y;
  let mob = null;
  if (dn.i < dn.n) {
    const near = mobsWithin(rt, dn.ox, dn.oy, dn.r);
    near.sort((a, b) => marksOf(S, b) - marksOf(S, a) || (a.id === dn.last) - (b.id === dn.last) || dist(dn.ox, dn.oy, a.x, a.y) - dist(dn.ox, dn.oy, b.x, b.y));
    mob = near[0] || null;
  }
  if (!mob) {
    if (canStand(m, dn.ox, dn.oy)) { p.x = dn.ox; p.y = dn.oy; }
    p.fix = true; p.mvAt = now; p.dance = null; p.dirty = true;
    rt.ev.push(["ln", 5, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
    return;
  }
  dn.i++;
  dn.last = mob.id;
  dn.next = now + dn.every;
  const [ux, uy] = aimVec(p, mob);
  for (const k of [14, -14, 0]) { const nx = mob.x + ux * k, ny = mob.y + uy * k; if (canStand(m, nx, ny)) { p.x = nx; p.y = ny; break; } }
  p.fix = true; p.mvAt = now;
  face(p, mob);
  rt.ev.push(["ln", 5, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
  rt.ev.push(["a", p.eid, 86, Math.round(mob.x), Math.round(mob.y - 6), p.dir, 2, 1]);
  const n = marksOf(S, mob);
  mob.mk = 0;
  hurtMob(S, rt, mob, p, dn.mult + dn.per * n, false, { sk: SKILL.flurry });
}
/** What a hand keeps track of from moment to moment. */
function weaponTick(S, p, now) {
  if (p.hammer || p.hammerCracks?.size) hammerTick(S, p, now);
  if (p.dance) danceStep(S, p, now);
  // a wound-up skill strikes when it is due (it was paid for when it began)
  if (p.charge && now >= p.charge.at) { const c = p.charge; p.charge = null; skStrike(S, p, c.id, c.k, c.cost, c.tgt); }
  if (p.hold && now - p.hold.at > SKILL[p.hold.id].holdMs) holdGo(S, p);
  // a parry that caught nothing leaves an opening
  if (p.parry && now >= p.parry.until) { p.parry = null; p.exposed = now + SKILL.parry.whiff; }
  if (p.hide && now >= p.hide) p.hide = 0;
  if (p.inert && now - p.inertAt > SKILL.inertia.ms) { p.inert = 0; p.dirty = true; }
  if (p.weave && now >= p.weave.until) p.weave = null;
  pasTick(S, S.maps[p.map], p);
}
/** Whatever a hand had going that does not survive a fall or a change of map. */
function weaponReset(p, death) {
  p.dance = null; p.hide = 0; p.inert = 0; p.weave = null; p.charge = null; p.chan = 0; p.hold = null; p.parry = null;
  p.hammer = null; p.hammerCracks = null;
  if (death) { p.reso = 0; p.sanctAt = 0; }
}
/** The bits other players see: 4 untouchable in the air, 16 dancing, 32 resonance full, 64 hidden, 128 focused, 256 holding a charge (its tier × 512). */
function flagsOf(p, now) {
  return (p.hold ? 256 | (holdTier(p, now) << 9) : 0) | (p.ghost > now ? 4 : 0) | (p.dance ? 16 : 0) | ((p.reso | 0) >= SKILL.reso.n && inHand(p.ch) === "staff" ? 32 : 0) | (p.hide > now ? 64 : 0) | (pasFocus(p, pasSet(p), now) ? 128 : 0);
}
const WEAVE_CODE = { f: 1, i: 2, l: 3 };
/** The gauge's live number on every snapshot: inertia stacks, or resonance + 4 × the element held. */
function crValue(p, now) {
  const hand = inHand(p.ch);
  if (hand === "sword") return inertOf(p);
  if (hand === "staff" || (hand && pasOn(p, "reso"))) return (p.reso | 0) + 4 * (p.weave && p.weave.until > now ? WEAVE_CODE[p.weave.e] : 0);
  return 0;
}
/** The gauge of one weapon kind's passive (null while it is not learned). */
function crOf(p, wk, now) {
  const id = WK_PASSIVE[wk];
  if (!id || p.ch.wm[wk].lv < SKILL[id].need) return null;
  switch (wk) {
    case "sword": return { k: "inertia", v: inertOf(p), max: SKILL.inertia.max };
    case "dagger": return { k: "mark", max: MARK_MAX };
    case "spear": return { k: "tip", tip: Math.round(WKIND.spear.range * SKILL.tip.at) };
    case "staff": return { k: "reso", v: p.reso | 0, max: SKILL.reso.n, e: p.weave && p.weave.until > now ? WEAVE_CODE[p.weave.e] : 0 };
    case "book": return { k: "brand" };
    case "hammer": return null;
    default: return { k: "hawk", d0: SKILL.hawk.d0, span: SKILL.hawk.span };
  }
}
/** The gauge for the weapon in hand; a hybrid's other weapon rides along as `o`. */
function crView(p, now) {
  const hand = inHand(p.ch);
  if (!hand) return null;
  const cr = crOf(p, hand, now), j = JOBS[p.ch.job];
  if (!cr || !j || j.kind !== "hybrid" || !j.wk.includes(hand)) return cr;
  const o = crOf(p, j.wk.find((k) => k !== hand), now);
  return o ? { ...cr, o } : cr;
}
/** The skill list: [id, MP, cooldown left ms, usable, HP if relevant, full cooldown ms for signatures]. */
function skWire(p, now) {
  const ch = p.ch, lo = loOf(ch), hand = inHand(ch);
  return skillsFor(ch).map((id) => {
    const sk = SKILL[id];
    if (sk.kind === "p") return [id, 0, 0, pasNative(ch, id, lo, hand) || loOff(ch, id, lo) ? 1 : 0];
    const row = [id, skMp(p, sk), Math.max(0, (p.cds[id] || 0) - now), skWhy(ch, sk) || !lo.a.includes(id) ? 0 : 1];
    if (sk.hpPct || sk.job) row.push(skillHpCost(p, sk));
    if (sk.job) row.push(skCooldown(p, sk));
    return row;
  });
}
/** New skills from a mastery level or a job: onto the bar if there is room. Returns their names. */
function skLearnNew(p, ids) {
  return ids.map((id) => { const key = SKILL[id].kind === "p" ? 0 : qsLearn(p.ch, id); return `[${SKILL[id].name}]${key ? `(단축칸 ${key}번)` : ""}`; });
}

/** The ground point `n` ahead along the aim, short of walls; or the aimed monster within `n + 20`. */
function aimPoint(rt, m, p, n) {
  const mob = aimMob(rt, p, n + 20, AIM_CONE);
  if (mob) { face(p, mob); return [mob.x, mob.y]; }
  const [ux, uy] = AIM_V[p.aim | 0], far = reach(m, p.x, p.y, ux, uy, n);
  return [p.x + ux * far, p.y + uy * far];
}

function castSkill(S, p, id) {
  // the held skill pressed again lets it go
  if (p.hold) { if (p.hold.id === id) holdGo(S, p); return; }
  const sk = SKILL[id];
  const st = stats(p);
  const rt = S.maps[p.map];
  const m = mapOfS(p.S, p.map);
  const now = S.now;
  rouse(S, p);
  tutStep(S, p, "skill");
  newAct(p, true);
  const ev = (kind, x, y, extra) => rt.ev.push(extra === undefined ? ["a", p.eid, kind, Math.round(x), Math.round(y), p.dir] : ["a", p.eid, kind, Math.round(x), Math.round(y), p.dir, 2, extra]);
  // mastery grows a skill; a full resonance makes a staff skill free and 30% stronger
  let k = skGrow(p.ch, sk) * charmSkd(p, id);   // (and what the charm board adds to this skill, 66-charms.js)
  // 정신 집중 (55-passives.js): standing still, the next skill lands harder
  if (pasFocus(p, pasSet(p), now)) { k *= 1 + SKILL.staff_spark40.k; p.focusAt = now; pasFx(rt, p, "staff_spark40", p.x, p.y); }
  const cost = skMp(p, sk);
  if (skOf(sk, "staff") && pasOn(p, "reso")) {
    if ((p.reso | 0) >= SKILL.reso.n) { p.reso = 0; k *= 1 + SKILL.reso.k; }
    else if ((p.reso = (p.reso | 0) + 1) >= SKILL.reso.n) ev(113, p.x, p.y - 6);
  }
  p.mp -= cost;
  const hpSpent = skillHpCost(p, sk);
  if (hpSpent) { p.hp -= hpSpent; rt.ev.push(["h", p.eid, hpSpent, 0, 1, 1]); }
  if (sk.hpCost) { const c = Math.min(p.hp - 1, Math.round(p.hp * sk.hpCost)); if (c > 0) { p.hp -= c; rt.ev.push(["h", p.eid, c, 0, 1, 1]); } }
  // WIS shortens every wait; a prefix power (메아리의) may give it straight back
  p.cds[id] = now + skCooldown(p, sk);
  pfxSkill(S, rt, p, st, sk, id, cost);
  p.atkAt = now;
  p.swordBeat = null;
  p.dirty = true;
  p.chan = 0;   // any skill cuts a channel
  if (sk.wk === "hammer" && !sk.stomp) { startHammer(S, p, sk, sk, k, hpSpent); return; }
  if (sk.tiers) {
    // held (E1): full inertia starts it a tier up, and is spent
    const inert = pasOn(p, "inertia") && inertOf(p) >= SKILL.inertia.max;
    if (inert) { p.inert = 0; ev(110, p.x, p.y - 6); }
    p.hold = { id, at: now - (inert ? sk.tiers[0] : 0), k, cost, braced: false };
    ev(sk.fx, p.x, p.y - 6, 0);
    return;
  }
  if (sk.wind) {
    // wound up: paid now, struck when weaponTick finds it due (a ground spell keeps the spot it was aimed at)
    const tgt = sk.at ? aimPoint(rt, m, p, sk.at) : null;
    p.charge = { id, at: now + sk.wind, k, cost, tgt };
    ev(sk.fx, ...(tgt ? [tgt[0], tgt[1] - 6] : [p.x, p.y - 6]), 0);
    return;
  }
  skStrike(S, p, id, k, cost);
}
/** What a skill does when it lands (at once, or when its wind-up is over). `k` its power, `cost` the MP paid. */
function skStrike(S, p, id, k, cost, tgt) {
  const sk = SKILL[id], st = stats(p), rt = S.maps[p.map], m = mapOfS(p.S, p.map), now = S.now;
  const ev = (kind, x, y, extra) => rt.ev.push(extra === undefined ? ["a", p.eid, kind, Math.round(x), Math.round(y), p.dir] : ["a", p.eid, kind, Math.round(x), Math.round(y), p.dir, 2, extra]);
  const opt = { mag: sk.mag, sk };
  // a consumer (sk.eat) spends the combo states on its first hit of each monster
  const hit = (mob, mult, more) => hurtMob(S, rt, mob, p, mult * k * comboK(S, rt, mob, sk.eat), !!(more && more.sure), more ? { ...opt, ...more } : opt);
  const [aimX, aimY] = AIM_V[p.aim | 0];
  const ahead = (n) => [p.x + aimX * n, p.y + aimY * n];
  const prop = (o) => addProp(S, rt, p, { sk, mag: sk.mag, k, ...o });
  switch (id) {
    case "ironsiege": {
      const ox = p.x, oy = p.y, len = stepTo(m, ox, oy, aimX, aimY, sk.len);
      const passed = mobsInLine(rt, ox, oy, aimX, aimY, len, sk.half).slice(0, 4);
      p.x += aimX * len; p.y += aimY * len; p.fix = true; p.mvAt = now;
      const struck = mobsWithin(rt, p.x, p.y, sk.r).slice(0, 4);
      rt.ev.push(["ln", 9, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(sk.fx, p.x, p.y - 6, sk.r);
      for (const o of new Set([...struck, ...passed])) {
        const dx = o.x - ox, dy = o.y - oy, d = Math.hypot(dx, dy);
        if (d && hammerLine(m, ox, oy, dx / d, dy / d, d) < d) continue;
        hit(o, struck.includes(o) ? sk.mult : sk.sweep, { mag: 0 });
      }
      break;
    }
    case "oathward": {
      ev(sk.fx, p.x, p.y - 6, sk.r);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r).slice(0, 5)) {
        const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
        if (!d || hammerLine(m, p.x, p.y, dx / d, dy / d, d) >= d) hit(o, sk.mult, { mag: 1 });
      }
      for (const ally of members(S, p)) if (ally.map === p.map && dist(ally.x, ally.y, p.x, p.y) <= sk.healR) {
        healSupport(rt, p, ally, stats(ally).mhp * sk.heal + st.atk * sk.atkHeal, HIT_CUE.oath, sk.creditMs);
      }
      break;
    }
    case "rally_banner": {
      ev(sk.fx, p.x, p.y, sk.r);
      prop({ kind: "banner", x: p.x, y: p.y, r: sk.r, i: 0, party: p.party, atk: st.atk,
        every: sk.every, next: now + 500, until: now + sk.ms, wire: true });
      break;
    }
    case "revive_binding": {
      ev(sk.fx, p.x, p.y, sk.r);
      const injured = allies(S, p, sk.r).filter((ally) => ally !== p && ally.hp < stats(ally).mhp);
      injured.sort((a, b) => a.hp / stats(a).mhp - b.hp / stats(b).mhp || a.eid - b.eid);
      const mend = (ally, share) => healSupport(rt, p, ally, (stats(ally).mhp * sk.heal + st.atk * sk.atkHeal) * k * share, HIT_CUE.binding, sk.creditMs);
      if (injured.length) injured.slice(0, 2).forEach((ally, i) => mend(ally, i ? 0.5 : 1));
      else mend(p, 0.5);
      break;
    }
    // ── 대검
    case "slash": {
      ev(80, ...ahead(sk.r * 0.6), sk.r);
      // the one it was aimed at takes the flat of the blade full on
      const core = aimMob(rt, p, sk.r, sk.arc);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        if (!inArc(p, o, sk.arc)) continue;
        if (!MOBS[o.k].boss && o.el !== 2) { const [ux, uy] = aimVec(p, o); knock(m, o, ux, uy, sk.knock * (o.el ? 0.5 : 1)); holdMob(S, o, o.el ? sk.stag[1] : sk.stag[0]); o.stg = now + STG_MS; }
        hit(o, sk.mult * (o === core && sk.core ? sk.core : 1));
      }
      break;
    }
    case "rend": {
      // up and over (never over a wall), down on them, then the ground splits on ahead
      let far = reach(m, p.x, p.y, aimX, aimY, sk.leap);
      while (far > 0 && !canStand(m, p.x + aimX * far, p.y + aimY * far)) far -= 3;
      const ox = p.x, oy = p.y;
      p.x += aimX * Math.max(0, far); p.y += aimY * Math.max(0, far);
      p.fix = true; p.mvAt = now;
      rt.ev.push(["ln", 9, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(81, p.x, p.y - 6, sk.r);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) { hit(o, sk.mult); launch(S, rt, o, sk.air); }
      const wl = Math.max(18, reach(m, p.x, p.y, aimX, aimY, sk.len));
      ev(82, p.x + aimX * wl, p.y + aimY * wl - 6, wl);
      // (메아리 뿔참, 66-charms.js: the first monster in the wave's last 30% takes 18% of that hit again)
      const wave = mobsInLine(rt, p.x, p.y, aimX, aimY, wl, sk.half), echo = charmEchoPick(S, p, wave, aimX, aimY, wl);
      for (const o of wave) {
        if (!MOBS[o.k].boss && o.el !== 2) { holdMob(S, o, 300); o.stg = now + STG_MS; }
        if (o === echo) charmEchoHit(S, rt, p, o, dealt(p, [o], () => hit(o, sk.wave)));
        else hit(o, sk.wave);
      }
      break;
    }
    case "verdict": {
      // the more you have bled, the harder it falls
      // and it spends the inertia the blade has built: +10% a stack
      const miss = clamp(1 - p.hp / st.mhp, 0, sk.miss), inert = pasOn(p, "inertia") ? inertOf(p) : 0;
      if (inert) { p.inert = 0; ev(110, p.x, p.y - 6); }
      ev(83, p.x, p.y - 6, sk.r);
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), sk.r, 2]);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) { const [ux, uy] = aimVec(p, o); knock(m, o, ux, uy, sk.knock); hit(o, sk.mult * (1 + miss) * (1 + sk.inert * inert)); }
      break;
    }

    // ── 단검
    case "ambush": {
      const mob = aimMob(rt, p, sk.len, AIM_CONE);
      if (!mob) { ev(19, p.x, p.y - 6); p.mp += cost; p.cds[id] = now + 600; break; }
      // behind it as seen from where you stood: sure of a crit if it was not watching you
      const sure = mob.tgt !== p.pid, [ux, uy] = aimVec(p, mob), ox = p.x, oy = p.y;
      for (const d of [sk.behind, sk.behind / 2, 0, -sk.behind]) { const nx = mob.x + ux * d, ny = mob.y + uy * d; if (canStand(m, nx, ny)) { p.x = nx; p.y = ny; break; } }
      p.fix = true; p.mvAt = now;
      p.aim = aimIdx(mob.x - p.x, mob.y - p.y);
      face(p, mob);
      rt.ev.push(["ln", 6, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(84, mob.x, mob.y - 6);
      hit(mob, sk.mult, sure ? { sure: true } : { crit: sk.crit });
      break;
    }
    case "shade": {
      const a0 = Math.atan2(aimY, aimX);
      ev(85, ...ahead(40), sk.n);
      for (let j = 0; j < sk.n; j++) {
        const a = a0 + ((j - (sk.n - 1) / 2) * sk.spread * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
        const far = Math.max(12, reach(m, p.x, p.y, ux, uy, sk.len));
        rt.ev.push(["ln", 7, Math.round(p.x), Math.round(p.y), Math.round(p.x + ux * far), Math.round(p.y + uy * far)]);
        for (const o of mobsInLine(rt, p.x, p.y, ux, uy, far, sk.half)) { hit(o, sk.mult); addMarks(S, o, 1); }
      }
      break;
    }
    case "flurry": {
      ev(86, p.x, p.y - 6);
      p.ghost = Math.max(p.ghost || 0, now + sk.n * sk.every + 300);
      p.dance = { n: sk.n, i: 0, next: now + 120, ox: p.x, oy: p.y, mult: sk.mult * k, per: sk.per * k, every: sk.every, r: sk.r, last: 0 };
      break;
    }

    // ── 창
    case "spiral": {
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      const tipOn = pasOn(p, "tip");
      ev(87, ...ahead(far), far);
      for (const o of mobsInLine(rt, p.x, p.y, aimX, aimY, far + 6, sk.half)) {
        // the far end of the thrust is the spear's tip
        const tip = tipOn && (o.x - p.x) * aimX + (o.y - p.y) * aimY >= sk.len * sk.far;
        if (tip) rt.ev.push(["tip", o.id]);
        hit(o, sk.mult * (tip ? SKILL.tip.mult : 1), tip ? pasTip(S, rt, p) : null);
      }
      break;
    }
    case "comet": {
      const ox = p.x, oy = p.y, far = stepTo(m, ox, oy, aimX, aimY, sk.len);
      const line = mobsInLine(rt, ox, oy, aimX, aimY, far + 14, sk.half);
      p.x = ox + aimX * far; p.y = oy + aimY * far;
      p.fix = true; p.mvAt = now;
      p.ghost = Math.max(p.ghost || 0, now + 300);
      rt.ev.push(["ln", 3, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(88, p.x, p.y - 6);
      line.forEach((o, j) => {
        if (pullTo(m, o, p.x + aimX * 14 - aimY * ((j % 3) - 1) * 10, p.y + aimY * 14 + aimX * ((j % 3) - 1) * 10)) o.drag = now + DRAG_MS;
        if (!MOBS[o.k].boss && o.el !== 2) o.stun = Math.max(o.stun, now + sk.stun);
        hit(o, sk.mult);
      });
      break;
    }
    case "dragon": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      for (const o of mobsWithin(rt, x, y, sk.r)) { tug(m, o, x, y, sk.pull); if (!MOBS[o.k].boss) o.drag = now + DRAG_MS; }
      ev(89, x, y - 6, sk.r);
      prop({ kind: "pillar", wire: 1, x, y, r: sk.r, every: sk.every, next: now + sk.every, until: now + sk.every * (sk.n + 1) + 50, left: sk.n, mult: sk.mult * k, fin: sk.fin * k, stun: sk.stun });
      break;
    }

    // ── 스태프
    case "fireball": {
      const mob = aimMob(rt, p, st.arm.range + 10, AIM_CONE);
      if (mob) face(p, mob);
      const [tx, ty] = mob ? [mob.x, mob.y] : ahead(70);
      ev(70, tx, ty - 6);
      for (const o of mobsWithin(rt, tx, ty, sk.r)) { hit(o, sk.mult); addBrn(S, o); }
      rt.zones.push({ x: tx, y: ty, r: sk.r, next: now + 500, every: 500, left: 6, mult: sk.burn * k, pid: p.pid, kind: 10 });
      weave(S, rt, p, "f", tx, ty, k);
      break;
    }
    case "frostring": {
      ev(71, p.x, p.y - 6, sk.r);
      let first = null;
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        if (o.slow > now && !MOBS[o.k].boss) { o.stun = Math.max(o.stun, now + sk.freeze); o.frz = o.stun; rt.ev.push(["fz", o.id, sk.freeze]); }
        o.slow = now + 3000;
        const [ux, uy] = aimVec(p, o);
        knock(m, o, ux, uy, sk.push);
        hit(o, sk.mult);
        if (!first) first = o;
      }
      weave(S, rt, p, "i", first ? first.x : p.x, first ? first.y : p.y, k);
      break;
    }
    case "meteor": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      ev(90, x, y - 6, sk.r);
      prop({ kind: "meteor", wire: 1, x, y, r: sk.r, hr: sk.hr, every: sk.every, next: now + sk.every, until: now + sk.every * (sk.n + 1) + 50, left: sk.n, mult: sk.mult * k, chain: sk.chain * k });
      break;
    }

    // ── 마도서
    case "soulbolt": {
      const mob = aimMob(rt, p, sk.len, sk.arc);
      if (mob) face(p, mob);
      const [tx, ty] = mob ? [mob.x, mob.y] : ahead(sk.len * 0.6);
      const ms = Math.round((dist(p.x, p.y, tx, ty) / sk.spd) * 1000);
      ev(91, tx, ty - 6, ms);
      if (mob) prop({ kind: "bolt", x: tx, y: ty, tgt: mob.id, next: now + ms, until: now + ms + 1000, every: 1000, mult: sk.mult * k, heal: sk.heal * charmSkh(p, id) });
      break;
    }
    case "gravity": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      ev(92, x, y - 6, sk.r);
      prop({ kind: "grav", wire: 1, x, y, r: sk.r, pull: sk.pull, every: sk.every, next: now + 100, until: now + sk.ms, mult: sk.mult * k });
      break;
    }
    case "pact": {
      const [x, y] = aimPoint(rt, m, p, 60);
      ev(93, x, y - 6, sk.r);
      prop({ kind: "phantom", wire: 1, x, y, r: sk.r, every: sk.every, next: now + 300, until: now + sk.ms, bite: sk.bite * k, blast: sk.mult * k, brandK: sk.brandK });
      break;
    }

    // ── 활
    case "pierce": {
      const mob = aimMob(rt, p, sk.len, WKIND.bow.arc);
      if (mob) face(p, mob);
      ev(94, ...(mob ? [mob.x, mob.y] : ahead(80)));
      const shot = fireArrow(S, rt, p, mob, sk.mult * k, 99, 2, { spd: sk.spd, len: sk.len, r: sk.r });
      if (deriveStats(p).cm.lg === "lens") shot.cl = 1;   // 길별의 렌즈참 (66-charms.js)
      break;
    }
    case "leapshot": {
      // a hop back out of reach, and a fan of five loosed in the air
      const ox = p.x, oy = p.y, far = stepTo(m, ox, oy, -aimX, -aimY, sk.back);
      p.x = ox - aimX * far; p.y = oy - aimY * far;
      p.fix = true; p.mvAt = now;
      rt.ev.push(["ln", 8, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(95, ...ahead(60));
      const cap = { n: sk.per, h: {} }, a0 = Math.atan2(aimY, aimX);
      for (let j = 0; j < sk.n; j++) {
        const a = a0 + ((j - (sk.n - 1) / 2) * ((2 * sk.spread) / (sk.n - 1)) * Math.PI) / 180;
        fireArrow(S, rt, p, null, sk.mult * k, 0, 3, { len: sk.len, ux: Math.cos(a), uy: Math.sin(a), cap });
      }
      break;
    }
    case "rain": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      ev(96, x, y - 6, sk.r);
      prop({ kind: "rain", wire: 1, x, y, r: sk.r, every: sk.every, next: now + 400, until: now + 400 + sk.ms, mult: sk.mult * k });
      break;
    }

    // ── the combo actives (docs/design/skill-combos.md, fx 140–145)
    case "cleave": {
      // the blade brought down on what stands before you: the staggered, the launched and the frozen take it far harder
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      ev(sk.fx, ...ahead(far * 0.6), 1);
      for (const o of lineFirst(rt, p.x, p.y, aimX, aimY, far, sk.half, sk.n)) hit(o, sk.mult);
      break;
    }
    case "rupture": {
      // the marks (and a brand) in one monster burst at once; three or more blow up round it
      const mob = aimMob(rt, p, sk.len, AIM_CONE);
      if (!mob) { ev(19, p.x, p.y - 6); p.mp += cost; p.cds[id] = now + 600; break; }
      face(p, mob);
      const n = marksOf(S, mob);
      ev(sk.fx, mob.x, mob.y - 6, n);
      hit(mob, sk.mult);
      if (n >= sk.pop) for (const o of mobsWithin(rt, mob.x, mob.y, sk.r)) if (o !== mob) hurtMob(S, rt, o, p, sk.splash * k, false, opt);
      break;
    }
    case "hook": {
      // the hook goes out along the aim and drags the first few back to the spear's point, staggered
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      ev(sk.fx, ...ahead(far), far);
      lineFirst(rt, p.x, p.y, aimX, aimY, far, sk.half, sk.n).forEach((o, j) => {
        const side = ((j % 3) - 1) * 10;
        if (pullTo(m, o, p.x + aimX * sk.to - aimY * side, p.y + aimY * sk.to + aimX * side)) o.drag = now + DRAG_MS;
        if (!MOBS[o.k].boss && o.el !== 2) holdMob(S, o, sk.hold);
        o.stg = now + STG_MS;
        hit(o, sk.mult);
      });
      break;
    }
    case "ignite": {
      // the spot it was aimed at goes up: every stack of 화상 and any ice there feeds it
      const [x, y] = tgt || aimPoint(rt, m, p, sk.at);
      ev(sk.fx, x, y - 6, sk.r);
      for (const o of mobsWithin(rt, x, y, sk.r)) hit(o, sk.mult);
      weave(S, rt, p, "f", x, y, k);
      break;
    }
    case "drain": {
      ev(sk.fx, ...ahead(40), 0);
      p.chan = prop({ kind: "chan", x: p.x, y: p.y, len: sk.len, half: sk.half, left: sk.n, every: sk.every, next: now + sk.every,
        until: now + sk.every * (sk.n + 1) + 50, mult: sk.mult * k, fin: sk.fin * k, heal: sk.heal * charmSkh(p, id) }).id;
      break;
    }
    case "whirl": case "musou": {
      ev(sk.fx, p.x, p.y - 6, 0);
      const n = Math.round(sk.ms / sk.every);
      p.chan = prop({ kind: "spin", x: p.x, y: p.y, r: sk.r, left: n, every: sk.every, next: now + sk.every,
        until: now + sk.every * (n + 1) + 50, mult: sk.mult * k, mpT: sk.mpT, hpT: sk.hpT || 0 }).id;
      break;
    }
    case "snipe": {
      // one long shot, loosed when the draw is full: whatever is held still takes it hardest
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      ev(sk.fx, ...ahead(far), far);
      for (const o of lineFirst(rt, p.x, p.y, aimX, aimY, far, sk.half, sk.n)) hit(o, sk.mult);
      break;
    }

    // ── the first wave of new weapon skills (docs/design/skill-ideas.md §9, fx 148–159)
    case "stomp": hammerStomp(S, p, sk, k); break;
    case "mortar": {
      // lobbed: it lands where it was aimed half a second later (the bow is free meanwhile)
      const [x, y] = aimPoint(rt, m, p, sk.at);
      ev(sk.fx, x, y - 6, 1);
      prop({ kind: "mortar", x, y, r: sk.r, every: sk.delay, next: now + sk.delay, until: now + sk.delay + 200, mult: sk.mult * k });
      break;
    }
    case "dragonpierce": {
      // everyone along the line, marks and brands burst (sk.eat); the recoil shoves the archer back
      const ox = p.x, oy = p.y, far = Math.max(16, reach(m, ox, oy, aimX, aimY, sk.len));
      const hawk = pasOn(p, "hawk") ? 1 + SKILL.hawk.k : 1;
      ev(sk.fx, ...ahead(far), far);
      for (const o of mobsInLine(rt, ox, oy, aimX, aimY, far, sk.half)) hit(o, sk.mult * hawk);
      const back = stepTo(m, ox, oy, -aimX, -aimY, sk.back);
      if (back) { p.x = ox - aimX * back; p.y = oy - aimY * back; p.fix = true; p.mvAt = now; }
      break;
    }
    case "rollshot": {
      // loosed just after a dash ends: the ace shot (harder, piercing) and the dash comes back sooner
      const ace = p.dashAt > 0 && now >= p.dashAt && now - p.dashAt <= DASH.ms + sk.win;
      const ox = p.x, oy = p.y, far = stepTo(m, ox, oy, -aimX, -aimY, sk.back);
      p.x = ox - aimX * far; p.y = oy - aimY * far; p.fix = true; p.mvAt = now;
      rt.ev.push(["ln", 8, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      const mob = aimMob(rt, p, sk.len, WKIND.bow.arc);
      if (mob) face(p, mob);
      ev(sk.fx, ...(mob ? [mob.x, mob.y] : ahead(80)), ace ? 2 : 1);
      fireArrow(S, rt, p, mob, sk.mult * k * (ace ? sk.ace : 1), ace ? 99 : 0, 2, { len: sk.len });
      if (ace) { p.dashAt -= sk.dashCut; toast(p, "회심!"); }
      break;
    }
    case "chainbolt": {
      // from one to the next nearest unstruck within jr; the first burning or frozen one it passes reacts, once
      let cur = aimMob(rt, p, sk.at + 20, AIM_CONE);
      if (!cur) { ev(19, p.x, p.y - 6); p.mp += cost; p.cds[id] = now + 600; break; }
      face(p, cur);
      ev(sk.fx, cur.x, cur.y - 6, sk.n);
      const done = new Set();
      let fx0 = p.x, fy0 = p.y - 6, reacted = false;
      for (let j = 0; j < sk.n && cur; j++) {
        done.add(cur);
        const x = cur.x, y = cur.y, e = reacted ? "" : brnOf(S, cur) ? "f" : cur.frz > now ? "i" : "";
        rt.ev.push(["ln", 4, Math.round(fx0), Math.round(fy0), Math.round(x), Math.round(y - 6)]);
        hit(cur, sk.mult);
        if (e) { reacted = true; react(S, rt, p, pairKey("l", e), x, y, k * sk.rxK); }
        fx0 = x; fy0 = y - 6;
        cur = rt.mobs.filter((q) => !q.dead && !q.dive && !done.has(q) && dist(q.x, q.y, x, y) <= sk.jr).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y) || a.id - b.id)[0];
      }
      break;
    }
    case "shoulder": {
      // carried to the end of the charge; pinned against a wall, or two or more tangled together, they are stunned
      const ox = p.x, oy = p.y, far = stepTo(m, ox, oy, aimX, aimY, sk.len);
      const line = mobsInLine(rt, ox, oy, aimX, aimY, far + 14, sk.half);
      const carry = line.filter((o) => !MOBS[o.k].boss && !MOBS[o.k].still && o.el !== 2);
      p.x = ox + aimX * far; p.y = oy + aimY * far; p.fix = true; p.mvAt = now;
      rt.ev.push(["ln", 3, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(sk.fx, p.x, p.y - 6, carry.length);
      carry.forEach((o, j) => { if (pullTo(m, o, p.x + aimX * 14 - aimY * ((j % 3) - 1) * 8, p.y + aimY * 14 + aimX * ((j % 3) - 1) * 8)) o.drag = now + DRAG_MS; });
      for (const o of line) {
        if (carry.includes(o)) {
          if (carry.length >= 2 || stepTo(m, o.x, o.y, aimX, aimY, 12) < 12) { o.stun = Math.max(o.stun, now + sk.stun * (o.el ? 0.5 : 1)); o.stg = now + STG_MS; }
          else knock(m, o, aimX, aimY, sk.knock);
        }
        hit(o, sk.mult);
      }
      break;
    }
    case "snare": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      // at most `max` of one archer's snares in the ground: the oldest goes
      const mine = (rt.props || []).filter((o) => o.pid === p.pid && o.snare);
      if (mine.length >= sk.max) { rt.props.splice(rt.props.indexOf(mine[0]), 1); rt.ev.push(["pe", mine[0].id, 0]); }
      ev(sk.fx, x, y - 6, 1);
      prop({ kind: "trap", snare: 1, wire: 1, x, y, r: sk.trig, every: 100, next: now + 300, until: now + sk.ms, mult: sk.mult * k });
      break;
    }
    case "bladevortex": {
      // one more blade round you (and the vortex lasts afresh); cast at the full five, they fly out as a fan of knives
      const o = (rt.props || []).find((q) => q.pid === p.pid && q.blades);
      if (o && o.blades >= sk.max) {
        rt.props.splice(rt.props.indexOf(o), 1);
        const a0 = Math.atan2(aimY, aimX);
        ev(sk.fx2, ...ahead(40), sk.n);
        for (let j = 0; j < sk.n; j++) {
          const a = a0 + ((j - (sk.n - 1) / 2) * sk.spread * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
          const len = Math.max(12, reach(m, p.x, p.y, ux, uy, sk.len));
          rt.ev.push(["ln", 7, Math.round(p.x), Math.round(p.y), Math.round(p.x + ux * len), Math.round(p.y + uy * len)]);
          for (const q of mobsInLine(rt, p.x, p.y, ux, uy, len, sk.half)) { hit(q, sk.fan); addMarks(S, q, 1); }
        }
        break;
      }
      if (o) { o.blades++; o.until = now + sk.ms; }
      else prop({ kind: "spin", blades: 1, x: p.x, y: p.y, r: sk.r, every: sk.every, next: now + sk.every, until: now + sk.ms, mult: sk.per * k });
      ev(sk.fx, p.x, p.y - 6, o ? o.blades : 1);
      break;
    }
    case "smoke": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      ev(sk.fx, x, y - 6, sk.r);
      prop({ kind: "smoke", x, y, r: sk.r, every: sk.every, next: now, until: now + sk.ms });
      break;
    }
    case "parry": {
      // E3: the window opens toward the aim; skGuard (mobHit) catches what comes in it
      p.parry = { until: now + sk.ms, u: [aimX, aimY], k };
      ev(sk.fx, p.x, p.y - 6, 0);
      break;
    }
    case "mountain": {
      // the held charge lets go (holdGo): its tier picks the power, the top tier spends stagger and air
      const t = p.holdT | 0, far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      p.holdT = 0;
      ev(sk.fx, ...ahead(far * 0.6), 1 + t);
      for (const o of mobsInLine(rt, p.x, p.y, aimX, aimY, far, sk.half)) hit(o, sk.ks[t] * (t === sk.tiers.length ? comboK(S, rt, o, sk.eat3) : 1));
      break;
    }

    // ── hybrid signatures
    case "crimson": {
      // a blade of fire along the aim; lightning follows it into every one it cuts — overload
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      ev(97, ...ahead(far), far);
      for (const o of mobsInLine(rt, p.x, p.y, aimX, aimY, far, sk.half)) {
        const x = o.x, y = o.y;
        hit(o, sk.mult);
        react(S, rt, p, "fl", x, y, k);
      }
      break;
    }
    case "traps": {
      const ox = p.x, oy = p.y, a0 = Math.atan2(aimY, aimX);
      p.hide = now + sk.hide;
      p.spdBuff = Math.max(p.spdBuff, now + sk.hide);
      const far = stepTo(m, ox, oy, -aimX, -aimY, sk.back);
      p.x = ox - aimX * far; p.y = oy - aimY * far;
      p.fix = true; p.mvAt = now;
      rt.ev.push(["ln", 8, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(98, ox, oy - 6);
      // a lure where you stood: whatever was after you goes for it, into the traps
      if (!rt.decoys) rt.decoys = [];
      const dc = { id: S.nextId++, x: ox, y: oy, until: now + sk.hide, pid: p.pid, r: 30, mult: 0.6 * k };
      rt.decoys.push(dc);
      rt.ev.push(["dc", dc.id, p.eid, Math.round(ox), Math.round(oy), sk.hide]);
      for (const o of rt.mobs) if (!o.dead && (o.tgt === p.pid || dist(o.x, o.y, ox, oy) < 110) && !MOBS[o.k].boss) { o.dec = dc; if (o.tgt === p.pid) o.tgt = null; }
      for (let j = 0; j < sk.n; j++) {
        const a = a0 + Math.PI / 4 + (j * Math.PI * 2) / sk.n, ux = Math.cos(a), uy = Math.sin(a);
        const d = Math.max(12, stepTo(m, ox, oy, ux, uy, sk.ring));
        prop({ kind: "trap", wire: 1, x: ox + ux * d, y: oy + uy * d, r: sk.trig, every: 100, next: now + 200, until: now + sk.ms, stab: sk.stab * k, shot: sk.shot * k, root: sk.root });
      }
      break;
    }
    case "dive": {
      // up out of reach, and down on them from the sky
      const [tx, ty] = aimPoint(rt, m, p, sk.at), d = dist(p.x, p.y, tx, ty) || 1;
      const ux = (tx - p.x) / d, uy = (ty - p.y) / d;
      let far = Math.min(d, reach(m, p.x, p.y, ux, uy, sk.at));
      while (far > 0 && !canStand(m, p.x + ux * far, p.y + uy * far)) far -= 3;
      const ox = p.x, oy = p.y;
      p.x += ux * Math.max(0, far); p.y += uy * Math.max(0, far);
      p.fix = true; p.mvAt = now;
      p.ghost = Math.max(p.ghost || 0, now + sk.ghost);
      rt.ev.push(["ln", 9, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(99, p.x, p.y - 6, sk.r);
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), sk.r, 9]);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) { const [vx, vy] = aimVec(p, o); knock(m, o, vx, vy, 12); hit(o, sk.mult); }
      prop({ kind: "field", wire: 1, x: p.x, y: p.y, r: sk.field, every: sk.every, next: now + sk.every, until: now + sk.ms, mult: sk.drain * k, heal: sk.heal * charmSkh(p, id) });
      break;
    }
    case "bloodburst": {
      ev(100, p.x, p.y - 6, sk.r);
      const list = mobsWithin(rt, p.x, p.y, sk.r);
      for (const o of list) if (!MOBS[o.k].boss && o.el !== 2) o.stun = Math.max(o.stun, now + sk.root * (o.el ? 0.5 : 1));
      prop({ kind: "burst", wire: 1, x: p.x, y: p.y, r: sk.r, ids: list.map((o) => o.id), every: 1000, next: now + sk.root, until: now + sk.root + 500, base: sk.base, bleed: sk.bleed, mark: sk.mark, brandK: sk.brand });
      break;
    }
    case "sanctuary": {
      ev(102, p.x, p.y - 6, sk.r);
      prop({ kind: "sanct", wire: 1, x: p.x, y: p.y, r: sk.r, every: sk.every, next: now + 100, until: now + sk.ms, mult: sk.mult * k });
      break;
    }

    // ── the hybrid expansion (fx 120–128)
    case "crosscut": {
      // the great blade sweeps and marks; the dagger goes into every one it swept, cashing the marks in
      ev(120, ...ahead(sk.r * 0.5), sk.r);
      const list = mobsWithin(rt, p.x, p.y, sk.r).filter((o) => inArc(p, o, sk.arc));
      for (const o of list) { hit(o, sk.mult); addMarks(S, o, sk.marks); }
      for (const o of list) {
        if (o.dead) continue;
        const n = marksOf(S, o);
        o.mk = 0;
        hit(o, sk.stab + sk.per * n, o.tgt !== p.pid ? { sure: true } : { crit: sk.crit });
      }
      if (pasOn(p, "inertia")) { p.inert = SKILL.inertia.max; p.inertAt = now; ev(110, p.x, p.y - 6); }
      break;
    }
    case "elemfan": {
      // three blades, fire, ice and lightning: two elements in one monster go off there
      const a0 = Math.atan2(aimY, aimX), els = ["f", "i", "l"], got = new Map();
      ev(124, ...ahead(40), 3);
      els.forEach((e, j) => {
        const a = a0 + ((j - 1) * sk.spread * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
        const far = Math.max(12, reach(m, p.x, p.y, ux, uy, sk.len));
        rt.ev.push(["ln", 7, Math.round(p.x), Math.round(p.y), Math.round(p.x + ux * far), Math.round(p.y + uy * far)]);
        for (const o of mobsInLine(rt, p.x, p.y, ux, uy, far, sk.half)) {
          hit(o, sk.mult);
          addMarks(S, o, 1);
          if (e === "i") o.slow = Math.max(o.slow || 0, now + sk.slow);
          if (!got.has(o)) got.set(o, []);
          got.get(o).push(e);
        }
      });
      let n = 0;
      for (const [o, es] of got) if (es.length >= 2 && n < sk.rx) { n++; react(S, rt, p, pairKey(es[0], es[1]), o.x, o.y, k); }
      break;
    }
    case "frostspire": {
      // an ice-bound thrust: slows all it runs through, freezes what the tip finds, and ice bursts up at its end
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      const ex = p.x + aimX * far, ey = p.y + aimY * far;
      ev(125, ex, ey - 6, far);
      for (const o of mobsInLine(rt, p.x, p.y, aimX, aimY, far + 6, sk.half)) {
        const tip = (o.x - p.x) * aimX + (o.y - p.y) * aimY >= far * sk.far;
        if (tip) {
          rt.ev.push(["tip", o.id]);
          if (!MOBS[o.k].boss && o.el !== 2) { o.stun = Math.max(o.stun, now + sk.freeze * (o.el ? 0.5 : 1)); o.frz = o.stun; rt.ev.push(["fz", o.id, sk.freeze]); }
        }
        o.slow = Math.max(o.slow || 0, now + 3000);
        hit(o, sk.mult * (tip ? SKILL.tip.mult : 1), tip ? pasTip(S, rt, p) : null);
      }
      for (const o of mobsWithin(rt, ex, ey, sk.r)) hit(o, sk.burst);
      weave(S, rt, p, "i", ex, ey, k);
      break;
    }
    case "runecircle": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      ev(126, x, y - 6, sk.r);
      prop({ kind: "rune", wire: 1, x, y, r: sk.r, every: sk.every, next: now + 200, until: now + sk.ms, mult: sk.mult * k, rxK: sk.rxK, i: 0 });
      break;
    }
    case "inkshot": {
      // a fan of rune-inked arrows: each brands what it pierces, and a brand already there takes it harder
      ev(128, ...ahead(60));
      const cap = { n: sk.per, h: {} }, a0 = Math.atan2(aimY, aimX);
      for (let j = 0; j < sk.n; j++) {
        const a = a0 + ((j - (sk.n - 1) / 2) * ((2 * sk.spread) / (sk.n - 1)) * Math.PI) / 180;
        fireArrow(S, rt, p, null, sk.mult * k, 99, 7, { len: sk.len, r: sk.r, ux: Math.cos(a), uy: Math.sin(a), cap, opt, brandK: sk.brandK });
      }
      break;
    }
  }
}
