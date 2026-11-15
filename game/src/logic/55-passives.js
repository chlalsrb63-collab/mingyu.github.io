// ───────────────────────────── felt passives (docs/design/skills-v2.md) ─────────────────────────────
// The weapon passives at mastery 30/40/50 (and a few at 20) that used to add 3–8 % to a stat now each change
// how a fight goes: a low-HP rally, a finisher shockwave, an execute, cooldown refunds on kills, a sure first
// crit, a tip-crit spear, amplified reactions, a standing-still focus, a full-mana bonus, spreading brands,
// a brand drain, a double arrow, an exposed target. Their data is SKILL[id] (03-skills.js, `ps` = the proc
// code the client draws in the ["ps", eid, code, x, y] event); a borrowed copy still only gives `borrow`.

/** The triggered weapon passives (they carry a proc code `ps`). */
const PAS_TRIG = SKILL_ORDER.filter((id) => SKILL[id].kind === "p" && SKILL[id].ps);
/** The triggered passives working for `p` now; cached against the derived stats (rebuilt with the sheet, the hand or the loadout). */
function pasSet(p) {
  const st = deriveStats(p);
  if (p.psK !== st) {
    const lo = loOf(p.ch);
    p.psK = st;
    p.psC = new Set(PAS_TRIG.filter((id) => pasNative(p.ch, id, lo)));
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

/** Damage multiplier from the passives on one blow of `p` on `mob`. */
function pasHurtK(S, p, mob, st) {
  const ps = pasSet(p);
  if (!ps.size) return 1;
  let k = 1;
  if (ps.has("sword_edge50") && mob.hp < mobMax(mob) * SKILL.sword_edge50.below) k *= 1 + SKILL.sword_edge50.k;
  if (ps.has("staff_flood50") && p.mp >= st.mmp * SKILL.staff_flood50.at) k *= 1 + SKILL.staff_flood50.k;
  if (ps.has("bow_quill50") && mob.expAt > S.now && mob.expBy === p.pid) k *= 1 + SKILL.bow_quill50.k;
  return k;
}
/** 빈틈을 읽는 눈: the first blow `p` ever lands on `mob` is a sure crit. */
const pasFirst = (p, mob) => !mob.by[p.pid] && pasHas(p, "dagger_edge40");

/** After a blow of `dmg` landed (`killed`: it fell; `brand`: its brand before the blow). */
function pasAfter(S, rt, p, mob, st, dmg, crit, killed, brand) {
  const ps = pasSet(p);
  if (!ps.size || p.dead) return;
  const now = S.now;
  if (crit && !killed && ps.has("bow_quill50")) {
    if (!(mob.expAt > now && mob.expBy === p.pid)) pasFx(rt, p, "bow_quill50", mob.x, mob.y);
    mob.expAt = now + SKILL.bow_quill50.ms; mob.expBy = p.pid;
  }
  if (brand > now && ps.has("book_return50") && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + Math.max(1, Math.round(dmg * SKILL.book_return50.k)));
  if (!killed) return;
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
/** Attack-interval multiplier (the sword's low-HP rally, the dagger's kill rush). */
function pasAspd(p) {
  const ps = pasSet(p);
  if (!ps.size) return 1;
  let k = 1;
  if (pasLow(p, ps)) k *= 1 - SKILL.sword_fortify30.aspd;
  if (ps.has("dagger_fang50") && p.fangAt > p.S.now) k *= 1 - SKILL.dagger_fang50.aspd;
  return k;
}
/** Damage-taken multiplier (the sword's low-HP rally). */
const pasGuard = (p) => (pasLow(p, pasSet(p)) ? 1 - SKILL.sword_fortify30.guard : 1);
/** Every tick: a changed attack interval reaches the client (its bar paces the blows by `acd`). */
function pasTick(S, rt, p) {
  const ps = pasSet(p);
  if (!ps.size) return;
  const low = pasLow(p, ps), as = pasAspd(p);
  if (low && !p.psLow) pasFx(rt, p, "sword_fortify30", p.x, p.y);
  p.psLow = low;
  if (as !== (p.psAs || 1)) { p.psAs = as; p.dirty = true; }
}
/** A spear's tip found its mark: 창끝 반동 trims the spear skills' waits; returns the tip blow's options (하나로 모인 힘: a sure crit). */
function pasTip(S, rt, p) {
  const ps = pasSet(p), now = S.now;
  if (ps.has("spear_advance30")) {
    for (const id of Object.keys(p.cds)) if (SKILL[id] && skOf(SKILL[id], "spear") && p.cds[id] > now) p.cds[id] = Math.max(now, p.cds[id] - SKILL.spear_advance30.cut);
    p.dirty = true;
  }
  return { ign: SKILL.tip.ign, crit: ps.has("spear_edge50") ? 100 : 0 };
}
/** 날에 실은 무게: a sword finisher's shockwave round (x, y), on all but the one it struck. */
function pasQuake(S, rt, p, mob, x, y) {
  const q = SKILL.sword_weight40;
  pasFx(rt, p, "sword_weight40", x, y);
  for (const o of mobsWithin(rt, x, y, q.r)) if (o !== mob) hurtMob(S, rt, o, p, q.mult);
}
