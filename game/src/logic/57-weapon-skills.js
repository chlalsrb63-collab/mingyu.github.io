// ───────────────────────────── weapon skills ─────────────────────────────
// docs/design/jobs-and-stats.md C (tables in 03-skills.js). A skill belongs to a weapon: it is usable
// while that weapon is in hand and its mastery has reached the skill's `need`; a job signature needs the
// job (and its weapon in hand), a hybrid's either weapon of its pair. The passives (관성, 급소, 창끝, 공명,
// 낙인, 매의 시야) hook into basicAttack, hurtMob and the arrows; whatever lingers (a vortex, a beast, rain,
// traps, a sanctuary…) stands in `rt.props` and is stepped by skillProps every tick.

/** The weapon kind actually in hand ("" bare-handed: skills need a weapon). */
const inHand = (ch) => (ch.eq.weapon ? ITEMS[ch.eq.weapon.id].wk : "");
/** The weapon kinds a skill can be used with. */
const skWks = (sk) => (sk.kind === "h" ? JOBS[sk.job].wk : [sk.wk]);
/** Has this character learned the skill (mastery for a weapon skill, the job for a signature)? */
const skLearned = (ch, sk) => (sk.job ? ch.job === sk.job : ch.wm[sk.wk].lv >= sk.need);
/** Skills that count as a staff's (resonance) or a book's (the brand): the weapon's own and its jobs' signatures. */
const skOf = (sk, wk) => (sk.job ? JOBS[sk.job].wk.includes(wk) : sk.wk === wk);
/** Every skill a character has learned, in SKILL_ORDER (the wire's list). */
const skillsFor = (ch) => SKILL_ORDER.filter((id) => skLearned(ch, SKILL[id]));
/** Why `ch` cannot use skill `sk` with what is in hand ("" when it can; cooldown and MP are checked elsewhere). */
function skWhy(ch, sk) {
  const wk = skWks(sk)[0];
  if (sk.job && ch.job !== sk.job) return `[${JOBS[sk.job].name}]의 스킬입니다`;
  if (!sk.job && ch.wm[sk.wk].lv < sk.need) return `[${WK_NAME[sk.wk]}] 숙련 ${sk.need}에 배웁니다`;
  if (!skWks(sk).includes(inHand(ch))) return `[${WK_NAME[wk]}]${pp(WK_NAME[wk], "을를")} 들어야 쓸 수 있습니다`;
  return "";
}
/**
 * Is weapon passive `id` working now? Its weapon is in hand with the mastery for it; a hybrid keeps
 * both of its weapons' passives on whichever of the two it holds.
 */
function pasOn(p, id) {
  const sk = SKILL[id], ch = p.ch, hand = inHand(ch);
  if (!hand || ch.wm[sk.wk].lv < sk.need) return false;
  if (hand === sk.wk) return true;
  const j = JOBS[ch.job];
  return !!j && j.kind === "hybrid" && j.wk.includes(sk.wk) && j.wk.includes(hand);
}
/** Skill power from mastery past the skill's need (a hybrid signature: the lower of its two weapons). */
function skGrow(ch, sk) {
  const m = Math.min(...skWks(sk).map((k) => ch.wm[k].lv));
  return 1 + SK_GROW * Math.max(0, m - sk.need);
}
/** Resonance full: the next staff skill is free and hits harder. */
const resoReady = (p, sk) => skOf(sk, "staff") && (p.reso | 0) >= SKILL.reso.n && pasOn(p, "reso");
/** What a skill costs right now. */
const skMp = (p, sk) => (resoReady(p, sk) ? 0 : sk.mp);
/** Inertia stacks still held (they fall away 2.5 s after the last sword hit). */
const inertOf = (p) => (p.inert && p.S.now - p.inertAt <= SKILL.inertia.ms ? p.inert : 0);

const marksOf = (S, mob) => (mob.mkAt > S.now ? mob.mk | 0 : 0);
function addMarks(S, mob, n) {
  if (mob.dead) return;
  mob.mk = Math.min(MARK_MAX, marksOf(S, mob) + n);
  mob.mkAt = S.now + MARK_MS;
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
    hurtMob(S, rt, o, p, rx.mult * k * (1 + stats(p).burst), false, { mag: 1 });
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
function healP(rt, p, n) {
  if (p.dead) return;
  const amt = Math.min(stats(p).mhp - p.hp, Math.round(n));
  if (amt < 1) return;
  p.hp += amt;
  rt.ev.push(["h", p.eid, -amt, 0, 1]);
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
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) { tug(m, mob, o.x, o.y, o.pull); hit(mob, o.mult); }
      return false;
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
      for (const mob of hitNow) hit(mob, o.mult);
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
      for (const q of mobsWithin(rt, o.x, o.y, o.r + 10)) if (!MOBS[q.k].boss && q.el !== 2) q.stun = Math.max(q.stun, now + o.root * (q.el ? 0.5 : 1));
      for (let j = 0; j < 3; j++) hit(mob, o.stab);
      for (let j = 0; j < 2; j++) hit(mob, o.shot);
      return true;
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
    case "sanct": {
      // blood sanctuary: the party inside is warded, the monsters inside bleed into the most hurt of them
      o.x = p.x; o.y = p.y;
      const inside = allies(S, p).filter((q) => !q.dead && dist(q.x, q.y, o.x, o.y) <= o.r);
      for (const q of inside) q.sanctAt = now + o.every + 150;
      const list = mobsWithin(rt, o.x, o.y, o.r);
      const got = list.length ? dealt(p, list, () => { for (const mob of list) hit(mob, o.mult); }) : 0;
      const low = inside.sort((a, b) => a.hp / stats(a).mhp - b.hp / stats(b).mhp)[0];
      if (low && got > 0) healP(rt, low, got * 0.5);
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
  if (p.dance) danceStep(S, p, now);
  if (p.hide && now >= p.hide) p.hide = 0;
  if (p.inert && now - p.inertAt > SKILL.inertia.ms) { p.inert = 0; p.dirty = true; }
  if (p.weave && now >= p.weave.until) p.weave = null;
}
/** Whatever a hand had going that does not survive a fall or a change of map. */
function weaponReset(p, death) {
  p.dance = null; p.hide = 0; p.inert = 0; p.weave = null;
  if (death) { p.reso = 0; p.sanctAt = 0; }
}
/** The bits other players see: 4 untouchable in the air, 16 dancing, 32 resonance full, 64 hidden. */
function flagsOf(p, now) {
  return (p.ghost > now ? 4 : 0) | (p.dance ? 16 : 0) | ((p.reso | 0) >= SKILL.reso.n && inHand(p.ch) === "staff" ? 32 : 0) | (p.hide > now ? 64 : 0);
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
/** The wire's skill list: [id, MP it costs now, cooldown left ms, usable with what is in hand (1/0)]. */
function skWire(p, now) {
  return skillsFor(p.ch).map((id) => {
    const sk = SKILL[id];
    if (sk.kind === "p") return [id, 0, 0, pasOn(p, id) ? 1 : 0];
    return [id, skMp(p, sk), Math.max(0, (p.cds[id] || 0) - now), skWhy(p.ch, sk) ? 0 : 1];
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
  let k = skGrow(p.ch, sk);
  const cost = skMp(p, sk);
  if (skOf(sk, "staff") && pasOn(p, "reso")) {
    if ((p.reso | 0) >= SKILL.reso.n) { p.reso = 0; k *= 1 + SKILL.reso.k; }
    else if ((p.reso = (p.reso | 0) + 1) >= SKILL.reso.n) ev(113, p.x, p.y - 6);
  }
  p.mp -= cost;
  if (sk.hpCost) { const c = Math.min(p.hp - 1, Math.round(p.hp * sk.hpCost)); if (c > 0) { p.hp -= c; rt.ev.push(["h", p.eid, c, 0, 1]); } }
  // WIS shortens every wait; an echo (legendary) may give it straight back
  p.cds[id] = now + Math.round(sk.cd * (1 - st.cdr));
  if (st.lg.echo && rnd(S) < 0.2 * st.proc) { p.cds[id] = now + 400; toast(p, `메아리! [${sk.name}] 재사용 대기 초기화`); }
  p.atkAt = now;
  p.dirty = true;
  const opt = { mag: sk.mag, sk };
  const hit = (mob, mult, more) => hurtMob(S, rt, mob, p, mult * k, !!(more && more.sure), more ? { ...opt, ...more } : opt);
  const [aimX, aimY] = AIM_V[p.aim | 0];
  const ahead = (n) => [p.x + aimX * n, p.y + aimY * n];
  const prop = (o) => addProp(S, rt, p, { sk, mag: sk.mag, k, ...o });
  switch (id) {
    // ── 대검
    case "slash": {
      ev(80, ...ahead(sk.r * 0.6), sk.r);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        if (!inArc(p, o, sk.arc)) continue;
        if (!MOBS[o.k].boss && o.el !== 2) { const [ux, uy] = aimVec(p, o); knock(m, o, ux, uy, sk.knock * (o.el ? 0.5 : 1)); holdMob(S, o, o.el ? sk.stag[1] : sk.stag[0]); }
        hit(o, sk.mult);
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
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) hit(o, sk.mult);
      const wl = Math.max(18, reach(m, p.x, p.y, aimX, aimY, sk.len));
      ev(82, p.x + aimX * wl, p.y + aimY * wl - 6, wl);
      for (const o of mobsInLine(rt, p.x, p.y, aimX, aimY, wl, sk.half)) { if (!MOBS[o.k].boss && o.el !== 2) holdMob(S, o, 300); hit(o, sk.wave); }
      break;
    }
    case "verdict": {
      // the more you have bled, the harder it falls
      const miss = clamp(1 - p.hp / st.mhp, 0, sk.miss);
      ev(83, p.x, p.y - 6, sk.r);
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), sk.r, 2]);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) { const [ux, uy] = aimVec(p, o); knock(m, o, ux, uy, sk.knock); hit(o, sk.mult * (1 + miss)); }
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
        hit(o, sk.mult * (tip ? SKILL.tip.mult : 1), tip ? { ign: SKILL.tip.ign } : null);
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
        pullTo(m, o, p.x + aimX * 14 - aimY * ((j % 3) - 1) * 10, p.y + aimY * 14 + aimX * ((j % 3) - 1) * 10);
        if (!MOBS[o.k].boss && o.el !== 2) o.stun = Math.max(o.stun, now + sk.stun);
        hit(o, sk.mult);
      });
      break;
    }
    case "dragon": {
      const [x, y] = aimPoint(rt, m, p, sk.at);
      for (const o of mobsWithin(rt, x, y, sk.r)) tug(m, o, x, y, sk.pull);
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
      for (const o of mobsWithin(rt, tx, ty, sk.r)) hit(o, sk.mult);
      rt.zones.push({ x: tx, y: ty, r: sk.r, next: now + 500, every: 500, left: 6, mult: sk.burn * k, pid: p.pid, kind: 10 });
      weave(S, rt, p, "f", tx, ty, k);
      break;
    }
    case "frostring": {
      ev(71, p.x, p.y - 6, sk.r);
      let first = null;
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        if (o.slow > now && !MOBS[o.k].boss) { o.stun = Math.max(o.stun, now + sk.freeze); rt.ev.push(["fz", o.id, sk.freeze]); }
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
      if (mob) prop({ kind: "bolt", x: tx, y: ty, tgt: mob.id, next: now + ms, until: now + ms + 1000, every: 1000, mult: sk.mult * k, heal: sk.heal });
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
      fireArrow(S, rt, p, mob, sk.mult * k, 99, 2, { spd: sk.spd, len: sk.len, r: sk.r });
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
      prop({ kind: "field", wire: 1, x: p.x, y: p.y, r: sk.field, every: sk.every, next: now + sk.every, until: now + sk.ms, mult: sk.drain * k, heal: sk.heal });
      break;
    }
    case "bloodburst": {
      ev(100, p.x, p.y - 6, sk.r);
      const list = mobsWithin(rt, p.x, p.y, sk.r);
      for (const o of list) if (!MOBS[o.k].boss && o.el !== 2) o.stun = Math.max(o.stun, now + sk.root * (o.el ? 0.5 : 1));
      prop({ kind: "burst", wire: 1, x: p.x, y: p.y, r: sk.r, ids: list.map((o) => o.id), every: 1000, next: now + sk.root, until: now + sk.root + 500, base: sk.base, bleed: sk.bleed, mark: sk.mark, brandK: sk.brand });
      break;
    }
    case "thunder": {
      const far = Math.max(16, reach(m, p.x, p.y, aimX, aimY, sk.len));
      const ex = p.x + aimX * far, ey = p.y + aimY * far;
      rt.ev.push(["ln", 2, Math.round(p.x), Math.round(p.y), Math.round(ex), Math.round(ey)]);
      ev(101, ex, ey - 6, far);
      mobsInLine(rt, p.x, p.y, aimX, aimY, far + 6, sk.half).forEach((o, j) => {
        pullTo(m, o, ex - aimX * 10 - aimY * ((j % 3) - 1) * 10, ey - aimY * 10 + aimX * ((j % 3) - 1) * 10);
        hit(o, sk.mult);
      });
      weave(S, rt, p, "l", ex, ey, k);
      prop({ kind: "storm", wire: 1, x: ex, y: ey, r: sk.r, every: sk.every, next: now + sk.every, until: now + sk.ms, mult: sk.storm * k });
      break;
    }
    case "sanctuary": {
      ev(102, p.x, p.y - 6, sk.r);
      prop({ kind: "sanct", wire: 1, x: p.x, y: p.y, r: sk.r, every: sk.every, next: now + 100, until: now + sk.ms, mult: sk.mult * k });
      break;
    }
  }
}
