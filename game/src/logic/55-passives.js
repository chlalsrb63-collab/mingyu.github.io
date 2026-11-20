// ───────────────────────────── felt passives (docs/design/skills-v2.md) ─────────────────────────────
// The weapon passives at mastery 30/40/50 (and a few at 20) that used to add 3–8 % to a stat now each change
// how a fight goes: a low-HP rally, a finisher shockwave, an execute, cooldown refunds on kills, a sure first
// crit, a tip-crit spear, amplified reactions, a standing-still focus, a full-mana bonus, spreading brands,
// a brand drain, a double arrow, an exposed target; and since 2026-11-21 one passive per job (job Lv.10).
// Their data is SKILL[id] (03-skills.js, `ps` = the proc code the client draws in the ["ps", eid, code, x, y] event).
// Every learned passive is always on while its weapon is in hand (no passive slots, no borrowed copies).

/** The triggered weapon passives (they carry a proc code `ps`). */
const PAS_TRIG = SKILL_ORDER.filter((id) => SKILL[id].kind === "p" && SKILL[id].ps);
/** The triggered passives working for `p` now; cached against the derived stats (rebuilt with the sheet or the hand). */
function pasSet(p) {
  const st = deriveStats(p);
  if (p.psK !== st) {
    p.psK = st;
    p.psC = new Set(PAS_TRIG.filter((id) => pasNative(p.ch, id)));
  }
  return p.psC;
}
const pasHas = (p, id) => pasSet(p).has(id);
/** A passive went off: the client draws proc `SKILL[id].ps` over (x, y). */
const pasFx = (rt, p, id, x, y) => rt.ev.push(["ps", p.eid, SKILL[id].ps, Math.round(x), Math.round(y - 6)]);
/** 벼랑 끝 투지: is the sword's low-HP rally on? */
const pasLow = (p, ps) => ps.has("sword_fortify30") && p.hp < stats(p).mhp * SKILL.sword_fortify30.below;
/** 정신 집중: stood still long enough for the focused next skill. */
const pasFocus = (p, ps, now) => ps.has("staff_spark40") && now - Math.max(p.mvAt || 0, p.focusAt || 0) >= SKILL.staff_spark40.ms;

/** Damage multiplier from the passives and job identity trait on one blow of `p` on `mob`. */
function pasHurtK(S, p, mob, st, opt) {
  const ps = pasSet(p);
  let k = jobTraitHurtK(S, p, mob, opt);
  if (diceOn(p, 5)) k *= 1 + SKILL.luckydice.dmg;
  if (!ps.size) return k;
  if (ps.has("spellblade_resonance") && opt?.sk && (elementActive(S, mob, "burn") || elementActive(S, mob, "shock"))) k *= 1 + SKILL.spellblade_resonance.k;
  if (ps.has("thief_biggame") && (mob.el || MOBS[mob.k].boss)) k *= 1 + SKILL.thief_biggame.k;
  if (ps.has("spellspear_frostbite") && (mob.frz > S.now || elementActive(S, mob, "freeze") || elementActive(S, mob, "chill"))) k *= 1 + SKILL.spellspear_frostbite.k;
  if (ps.has("tracker_venom") && elementActive(S, mob, "poison")) k *= 1 + SKILL.tracker_venom.k;
  if (ps.has("destroyer_crusher") && elementActive(S, mob, "shatter")) k *= 1 + SKILL.destroyer_crusher.k;
  if (ps.has("sword_edge50") && mob.hp < mobMax(mob) * SKILL.sword_edge50.below) k *= 1 + SKILL.sword_edge50.k;
  if (ps.has("staff_flood50") && p.mp >= st.mmp * SKILL.staff_flood50.at) k *= 1 + SKILL.staff_flood50.k;
  if (ps.has("bow_quill50") && mob.expAt > S.now && mob.expBy === p.pid) k *= 1 + SKILL.bow_quill50.k;
  return k;
}
/** 빈틈을 읽는 눈: the first blow `p` ever lands on `mob` is a sure crit. */
const pasFirst = (p, mob) => !mob.by[p.pid] && pasHas(p, "dagger_edge40");

/** After a blow of `dmg` landed (`killed`: it fell; `brand`: its brand before the blow). */
function pasAfter(S, rt, p, mob, st, dmg, crit, killed, brand, opt) {
  if (p.dead) return;
  jobTraitHit(S, rt, p, mob, st, dmg, crit, killed, opt);
  const ps = pasSet(p);
  if (!ps.size) return;
  const now = S.now;
  if (crit && !killed && ps.has("bow_quill50")) {
    if (!(mob.expAt > now && mob.expBy === p.pid)) pasFx(rt, p, "bow_quill50", mob.x, mob.y);
    mob.expAt = now + SKILL.bow_quill50.ms; mob.expBy = p.pid;
  }
  if (brand > now && ps.has("book_return50") && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + Math.max(1, Math.round(dmg * SKILL.book_return50.k)) * elementHealFactor(S, p));
  if (crit && ps.has("trickster_sleight") && p.slAct !== p.actN) {
    p.slAct = p.actN;
    let cut = false;
    for (const id of Object.keys(p.cds)) if (SKILL[id] && skOf(SKILL[id], "staff") && p.cds[id] > now) { p.cds[id] = Math.max(now, p.cds[id] - SKILL.trickster_sleight.cut); cut = true; }
    if (cut) { p.dirty = true; pasFx(rt, p, "trickster_sleight", p.x, p.y); }
  }
  if (!killed) return;
  if (ps.has("swordsman_bloodlust")) {
    healP(rt, p, st.mhp * SKILL.swordsman_bloodlust.heal);
    jobTraitGain(S, rt, p, 1, false);
    pasFx(rt, p, "swordsman_bloodlust", p.x, p.y);
  }
  if (brand > now && ps.has("warlock_thirst") && p.mp < st.mmp) {
    p.mp = Math.min(st.mmp, p.mp + Math.round(st.mmp * SKILL.warlock_thirst.mp));
    pasFx(rt, p, "warlock_thirst", p.x, p.y);
  }
  if (ps.has("bladedancer_feast") && elementActive(S, mob, "bleed")) {
    const c = SKILL.bladedancer_feast, next = nearestMob(rt, mob.x, mob.y, c.r, [mob]);
    if (next) {
      addMarks(S, next, c.marks);
      elementInflict(S, rt, p, next, "bleed", dmg);
      pasFx(rt, p, "bladedancer_feast", next.x, next.y);
    }
  }
  if (ps.has("dagger_snap30")) {
    let cut = false;
    for (const id of Object.keys(p.cds)) {
      if (!SKILL[id] || !skOf(SKILL[id], "dagger") || !(p.cds[id] > now)) continue;
      p.cds[id] = now + Math.round((p.cds[id] - now) * (1 - SKILL.dagger_snap30.k));
      cut = true;
    }
    if (cut) { p.dirty = true; pasFx(rt, p, "dagger_snap30", p.x, p.y); }
  }
  if (ps.has("dagger_fang50")) {
    healP(rt, p, st.mhp * SKILL.dagger_fang50.heal);
    p.fangAt = now + SKILL.dagger_fang50.ms;
    pasFx(rt, p, "dagger_fang50", p.x, p.y);
  }
  if (brand > now && ps.has("book_clause30")) {
    const c = SKILL.book_clause30;
    const next = mobsWithin(rt, mob.x, mob.y, c.r).filter((o) => o !== mob && !(o.brand > now) && !MOBS[o.k].chest)
      .sort((a, b) => dist(a.x, a.y, mob.x, mob.y) - dist(b.x, b.y, mob.x, mob.y) || a.id - b.id).slice(0, c.n);
    for (const o of next) {
      o.brand = brand;
      rt.ev.push(["ln", 10, Math.round(mob.x), Math.round(mob.y - 6), Math.round(o.x), Math.round(o.y - 6)]);
    }
    if (next.length) pasFx(rt, p, "book_clause30", mob.x, mob.y);
  }
}
/** Attack-interval multiplier (the sword's low-HP rally, the dagger's kill rush, job identity gauges). */
function pasAspd(p) {
  let k = jobTraitAspd(p);
  if (p.cryAt > p.S.now) k *= 1 - SKILL.warcry.aspd;
  if (diceOn(p, 1, 2)) k *= 1 - SKILL.luckydice.aspd;
  const ps = pasSet(p);
  if (!ps.size) return k;
  if (pasLow(p, ps)) k *= 1 - SKILL.sword_fortify30.aspd;
  if (ps.has("dagger_fang50") && p.fangAt > p.S.now) k *= 1 - SKILL.dagger_fang50.aspd;
  return k;
}
/** Damage-taken multiplier (the sword's low-HP rally, barbarian rage / paladin vow, the job passives, 신의 방패). */
function pasGuard(p) {
  const ps = pasSet(p), now = p.S.now;
  let k = (pasLow(p, ps) ? 1 - SKILL.sword_fortify30.guard : 1) * jobTraitGuard(p);
  if (p.aegisAt > now) k *= 1 - SKILL.aegis.guard;
  if (!ps.size) return k;
  if (ps.has("lancer_bulwark")) k *= 1 - SKILL.lancer_bulwark.per * jobTraitVal(p, now);
  if (ps.has("wizard_manashield") && p.mp >= stats(p).mmp * SKILL.wizard_manashield.at) k *= 1 - SKILL.wizard_manashield.guard;
  if (ps.has("paladin_blessed")) k *= 1 - SKILL.paladin_blessed.guard - (jobTraitVal(p, now) >= JOB_TRAIT.paladin.max ? SKILL.paladin_blessed.full : 0);
  return k;
}
/** The job skills' moment numbers on the sheet: 광폭의 포효 lifesteal, 행운의 주사위 crit, 명사수 crit damage (stats()). */
function jobSkillStat(p, out) {
  const now = p.S.now;
  if (p.cryAt > now) out.ls = Math.min(20, out.ls + SKILL.warcry.ls);
  if (diceOn(p, 3, 4)) out.crit = Math.min(SFX.critCap, out.crit + SKILL.luckydice.crit);
  if (p.ch.job === "archer" && jobTraitVal(p, now) >= SKILL.archer_deadeye.at && pasHas(p, "archer_deadeye")) out.critd += SKILL.archer_deadeye.critd;
}
/** Every tick: a changed attack interval or expired job trait reaches the client. */
function pasTick(S, rt, p) {
  jobTraitTick(S, p);
  const ps = pasSet(p), as = pasAspd(p);
  if (ps.size) {
    const low = pasLow(p, ps);
    if (low && !p.psLow) pasFx(rt, p, "sword_fortify30", p.x, p.y);
    p.psLow = low;
    // 최후의 룬: the rune shield comes up by itself when HP falls low, once in a while
    const lw = SKILL.runearcher_lastward;
    if (ps.has("runearcher_lastward") && !p.dead && S.now >= (p.lwAt || 0) && p.hp < stats(p).mhp * lw.below) {
      p.lwAt = S.now + lw.every;
      elementWard(S, p, stats(p).mhp * lw.ward, lw.wardMs);
      pasFx(rt, p, "runearcher_lastward", p.x, p.y);
    }
  }
  if (as !== (p.psAs || 1)) { p.psAs = as; p.dirty = true; }
}
/** A spear's tip found its mark: 창끝 반동 trims the spear skills' waits; returns the tip blow's options (하나로 모인 힘: a sure crit). */
function pasTip(S, rt, p) {
  const ps = pasSet(p), now = S.now;
  if (ps.has("spear_advance30")) {
    for (const id of Object.keys(p.cds)) if (SKILL[id] && skOf(SKILL[id], "spear") && p.cds[id] > now) p.cds[id] = Math.max(now, p.cds[id] - SKILL.spear_advance30.cut);
    p.dirty = true;
  }
  return { ign: SKILL.tip.ign, crit: ps.has("spear_edge50") ? 100 : 0, tip: true };
}
/** 날에 실은 무게: a sword finisher's shockwave round (x, y), on all but the one it struck. */
function pasQuake(S, rt, p, mob, x, y) {
  const q = SKILL.sword_weight40;
  pasFx(rt, p, "sword_weight40", x, y);
  for (const o of mobsWithin(rt, x, y, q.r)) if (o !== mob) hurtMob(S, rt, o, p, q.mult);
}

// ───────────────────────────── job identity gauges (JOB-03) ─────────────────────────────
const jobTraitOf = (p) => (p?.ch?.job ? JOB_TRAIT[p.ch.job] || null : null);
function jobTraitVal(p, now = p?.S?.now || 0) {
  const t = jobTraitOf(p);
  return t && (p.jt | 0) > 0 && now - (p.jtAt || 0) <= t.ms ? Math.min(t.max, p.jt | 0) : 0;
}
function jobTraitView(p, now) {
  const t = jobTraitOf(p);
  return t ? { job: p.ch.job, id: t.id, v: jobTraitVal(p, now), max: t.max } : null;
}
function jobTraitGain(S, rt, p, n = 1, dedup = true) {
  const t = jobTraitOf(p);
  if (!t || p.dead || !(n > 0)) return 0;
  if (dedup && (!p.actN || p.jtAct === p.actN)) return jobTraitVal(p, S.now);
  if (dedup) p.jtAct = p.actN;
  const prev = jobTraitVal(p, S.now);
  p.jt = Math.min(t.max, prev + n);
  p.jtAt = S.now;
  if (p.jt !== prev) {
    p.dirty = true;
    if (p.jt >= t.max && prev < t.max && rt) rt.ev.push(["jt", p.eid, 1]);
  }
  return p.jt;
}
function jobTraitTick(S, p) {
  const t = jobTraitOf(p);
  if (p.jt > 0 && (!t || S.now - (p.jtAt || 0) > t.ms)) { p.jt = 0; p.dirty = true; }
}
function jobTraitStat(p, out) {
  const t = jobTraitOf(p), v = jobTraitVal(p, p.S.now);
  if (!t || !v) return;
  switch (p.ch.job) {
    case "thief": out.critd += 0.025 * v; break;
    case "bladedancer": out.spd *= 1 + 0.02 * v; out.pspd = (out.pspd || 1) * (1 + 0.02 * v); break;
    case "trickster": out.crit = Math.min(SFX.critCap, out.crit + 2.5 * v); out.eva = Math.min(35, out.eva + 2 * v); break;
    case "warlock": out.ls = Math.min(20, out.ls + 0.6 * v); break;
    case "runearcher": out.cdr = Math.min(0.55, out.cdr + 0.02 * v); break;
    case "tracker": out.crit = Math.min(SFX.critCap, out.crit + 2 * v); out.spd *= 1 + 0.02 * v; out.pspd = (out.pspd || 1) * (1 + 0.02 * v); break;
    case "destroyer": out.poise = Math.min(0.92, out.poise + 0.04 * v); break;
  }
}
function jobTraitHurtK(S, p, mob, opt) {
  const v = jobTraitVal(p, S.now);
  if (!v) return 1;
  switch (p.ch.job) {
    case "swordsman": return 1 + 0.01 * v;
    case "spellblade": return opt?.sk || (opt?.elem && opt.elem !== "physical") ? 1 + 0.015 * v : 1;
    case "spellspear": return 1 + 0.015 * v;
    case "wizard": return opt?.sk ? 1 + 0.015 * v : 1;
    case "warlock": return 1 + 0.015 * v;
    case "archer": return 1 + 0.015 * v;
    case "destroyer": return 1 + 0.02 * v;
    default: return 1;
  }
}
function jobTraitArmorPen(S, p) {
  return p?.ch?.job === "lancer" ? 3 * jobTraitVal(p, S.now) : 0;
}
function jobTraitAspd(p) {
  const v = jobTraitVal(p, p.S.now);
  if (!v) return 1;
  if (p.ch.job === "bladedancer") return 1 - 0.015 * v;
  if (p.ch.job === "archer") return 1 - 0.02 * v;
  return 1;
}
function jobTraitGuard(p) {
  const v = jobTraitVal(p, p.S.now);
  if (!v) return 1;
  if (p.ch.job === "swordsman") return v >= JOB_TRAIT.swordsman.max ? 0.90 : 1;
  if (p.ch.job === "paladin") return 1 - 0.025 * v;
  return 1;
}
function jobTraitHit(S, rt, p, mob, st, dmg, crit, killed, opt) {
  const job = p.ch.job;
  if (!JOB_TRAIT[job] || opt?.px) return;
  switch (job) {
    case "swordsman": case "spellblade": case "paladin":
      jobTraitGain(S, rt, p, 1, true); break;
    case "thief":
      if (crit || mob.tgt !== p.pid) jobTraitGain(S, rt, p, 1, true); break;
    case "bladedancer":
      if (jobTraitVal(p, S.now) >= JOB_TRAIT.bladedancer.max && p.bdHealAct !== p.actN && p.hp < st.mhp) {
        p.bdHealAct = p.actN;
        healP(rt, p, st.mhp * 0.015);
      }
      if (opt?.sk || marksOf(S, mob) > 0 || elementActive(S, mob, "bleed") || mob.dot?.until > S.now) jobTraitGain(S, rt, p, 1, true);
      break;
    case "lancer":
      if (opt?.tip || opt?.sk) jobTraitGain(S, rt, p, 1, true); break;
    case "spellspear":
      if (opt?.sk || opt?.elem === "cold" || opt?.elem === "lightning") jobTraitGain(S, rt, p, 1, true); break;
    case "trickster":
      if (crit || opt?.sk) jobTraitGain(S, rt, p, 1, true); break;
    case "warlock":
      if (killed || mob.brand > S.now) jobTraitGain(S, rt, p, 1, true); break;
    case "archer":
      if (opt?.sk || dist(p.x, p.y, mob.x, mob.y) >= 35) jobTraitGain(S, rt, p, 1, true); break;
    case "tracker":
      if (opt?.sk || marksOf(S, mob) > 0 || elementActive(S, mob, "poison")) jobTraitGain(S, rt, p, 1, true); break;
    case "destroyer":
      if (opt?.sk || st.wk === "hammer") jobTraitGain(S, rt, p, 1, true); break;
  }
}
/** Consume a maxed job identity gauge when casting a skill; returns bonus options applied to that cast. */
function jobTraitSpend(S, rt, p, st, sk, id, cost) {
  const t = jobTraitOf(p);
  if (!t || p.ch.job === "bladedancer") return null;
  const v = jobTraitVal(p, S.now);
  if (v < t.max) {
    if (p.ch.job === "wizard" || p.ch.job === "runearcher") jobTraitGain(S, rt, p, 1, true);
    return null;
  }
  p.jt = 0; p.jtAt = 0; p.jtAct = p.actN; p.dirty = true;
  rt.ev.push(["jt", p.eid, 2]);
  switch (p.ch.job) {
    case "swordsman": return { mult: 1.15 };
    case "spellblade":
      if (cost > 0) p.mp = Math.min(st.mmp, p.mp + Math.round(cost * 0.30));
      return { mult: 1.16, forceAilment: "light" };
    case "thief": return { mult: 1.16, sure: true };
    case "lancer":
      if (p.cds[id] > S.now) p.cds[id] = Math.max(S.now, p.cds[id] - 1500);
      return { mult: 1.16 };
    case "spellspear": {
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), 64, 9]);
      for (const o of mobsWithin(rt, p.x, p.y, 64)) hurtMob(S, rt, o, p, 0.45, false, { mag: 1, elem: "cold", secondaryType: "lightning", px: 1, noRx: true });
      return { mult: 1.15 };
    }
    case "wizard":
      p.mp = Math.min(st.mmp, p.mp + Math.round(st.mmp * 0.25));
      return { mult: 1.18 };
    case "trickster":
      if (p.cds[id] > S.now) p.cds[id] = S.now + Math.round((p.cds[id] - S.now) * 0.75);
      return { mult: 1.15 };
    case "warlock":
      healP(rt, p, st.mhp * 0.08);
      return { mult: 1.16 };
    case "runearcher":
      elementWard(S, p, st.mhp * 0.08, 3600);
      return { mult: 1.16 };
    case "archer": return { mult: 1.18, armorPenPct: 20 };
    case "tracker": return { mult: 1.18, forceAilment: "poison" };
    case "destroyer": return { mult: 1.20, forceAilment: "physical" };
    case "paladin":
      for (const ally of members(S, p)) if (!ally.dead && ally.map === p.map && dist(ally.x, ally.y, p.x, p.y) <= 90) {
        const mhp = stats(ally).mhp;
        elementWard(S, ally, mhp * 0.05, 3500);
        healP(rt, ally, mhp * 0.05, HIT_CUE.oath);
      }
      return { mult: 1.10 };
    default: return null;
  }
}
