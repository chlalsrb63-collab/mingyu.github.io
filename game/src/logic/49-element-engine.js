// Damage components and temporary ailments shared by players and monsters.
const ELEMENT_STATUS = [
  { id: "shatter", name: "방어구 파쇄", type: "physical", icon: "파" },
  { id: "bleed", name: "출혈", type: "bleed", icon: "혈" },
  { id: "burn", name: "화상", type: "fire", icon: "화" },
  { id: "chill", name: "오한", type: "cold", icon: "한" },
  { id: "freeze", name: "빙결", type: "cold", icon: "빙" },
  { id: "stagger", name: "경직", type: "lightning", icon: "경" },
  { id: "shock", name: "감전", type: "lightning", icon: "감" },
  { id: "poison", name: "중독", type: "poison", icon: "독" },
  { id: "curse", name: "저주", type: "dark", icon: "저" },
  { id: "blind", name: "실명", type: "light", icon: "실" },
  { id: "ward", name: "신성 보호막", type: "light", icon: "호" },
];

const ELEMENT_RULE = {
  physical: { chance: 1, duration: 2800 },
  bleed: { chance: 0.42, duration: 4200, dot: 0.24, cap: 5 },
  fire: { chance: 0.42, duration: 3600, dot: 0.34 },
  cold: { chance: 1, duration: 2600 },
  lightning: { chance: 1, duration: 2400 },
  poison: { chance: 1, duration: 6300, dot: 0.14 },
  dark: { chance: 0.38, duration: 4000 },
  light: { chance: 0.42, duration: 2800 },
};
const ELEMENT_DOTS = [["bleed", "bleed"], ["burn", "fire"], ["poison", "poison"]];
const NO_ELEMENT_ROWS = Object.freeze([]);
const ELEMENT_EXPIRY_BUCKET_MS = 250;

function elementRoll(S) {
  S.elementRng ||= { seed: S.seed ^ 0x58c8f3d1 };
  return rnd(S.elementRng);
}

const elementActive = (S, actor, id) => (actor?.ail?.[id]?.until || 0) > S.now || !!elementMarked(S, actor, id);
const elementMob = (actor) => !!actor?.k;
const elementGear = (actor, supplied) => supplied || (!elementMob(actor) && actor?.ch ? deriveStats(actor).element : null);
const elementFirm = (actor) => elementMob(actor) && (actor.el === 2 || MOBS[actor.k]?.boss || MOBS[actor.k]?.still || MOBS[actor.k]?.chest);
const elementMaxHp = (actor) => elementMob(actor) ? mobMax(actor) : deriveStats(actor).mhp;

/** Resistance and penetration use percentage points. Penetration can remove resistance down to 0%. */
function elementResist(S, target, type, penetration = 0) {
  const res = elementMob(target) ? monsterElement(target.k).res : elementGear(target)?.res;
  let n = res?.[type] || 0;
  if (n > 0) n = Math.max(0, n - Math.max(0, penetration));
  if (elementActive(S, target, "curse")) n -= 15;
  return 1 - clamp(n, -65, 90) / 100;
}

/** Resolve single-hit components before final damage multipliers. Raw damage still includes physical armor. */
function elementDamage(S, source, target, raw, armor, options = {}) {
  const { type = "physical", secondaryType, enchant, typedOnly, pure, crit, armorPenPct = 0, extraScale = 1 } = options;
  if (pure) return [[type, Math.max(0, raw)]];
  const profile = elementGear(source, options.element);
  const bonus = profile?.damage;
  const converted = type !== "physical" ? (enchant === type ? 0.36 : 0.25) : 0;
  const secondary = secondaryType && secondaryType !== type && secondaryType !== "physical" ? (type === "physical" ? 0.25 : 0.15) : 0;
  const enchanted = enchant && enchant !== "physical" && enchant !== type ? 0.12 : 0;
  const armourRate = (1 - clamp(armorPenPct, 0, 100) / 100) * (crit ? 0.88 : 1) * (elementActive(S, target, "shatter") ? 0.90 : 1);
  const parts = [];
  for (const key of DAMAGE_TYPES) {
    let value = typedOnly ? (key === type ? raw : 0) : (bonus?.[key] || 0) * Math.max(0, extraScale);
    if (!typedOnly) {
      if (key === "physical") value += raw * (1 - converted - secondary - enchanted);
      else {
        if (key === type) value += raw * converted;
        if (key === secondaryType) value += raw * secondary;
        if (key === enchant) value += raw * enchanted;
      }
    }
    if (value <= 0) continue;
    if (key === "physical") value -= armor * armourRate;
    if (value <= 0) continue;
    if (key === "lightning" && !typedOnly) value *= 0.54 + 0.98 * elementRoll(S);
    if (key === "fire" && !typedOnly) value *= 1.12;
    if (key === "light" && elementMob(target) && monsterElement(target.k).holyWeak) value *= 1.35;
    value *= elementResist(S, target, key, profile?.pen?.[key]);
    if (value > 0) parts.push([key, value]);
  }
  return parts;
}

const elementTaken = (S, target) => elementActive(S, target, "shock") ? 1.10 : 1;
const elementOutgoing = (S, source) => (elementActive(S, source, "poison") || source?.poison?.until > S.now) ? 0.90 : 1;
const elementHealFactor = (S, target) => (elementActive(S, target, "burn") || target?.burn?.until > S.now) ? 0.63 : 1;
const elementFrozen = (S, target) => elementActive(S, target, "freeze") || elementActive(S, target, "stagger");
const elementChill = (S, target) => elementActive(S, target, "chill") ? target.ail.chill.stacks : 0;
const elementMoveFactor = (S, target) => 1 - 0.11 * elementChill(S, target);
const elementAttackFactor = (S, target) => 1 / (1 - 0.10 * elementChill(S, target));

function elementMiss(S, source) {
  const miss = (elementActive(S, source, "curse") ? 0.13 : 0) + (elementActive(S, source, "blind") ? 0.28 : 0);
  return miss > 0 && elementRoll(S) < miss;
}

function elementShield(S, target, damage) {
  if (!elementActive(S, target, "ward") || damage <= 0) return damage;
  const ward = target.ail.ward, absorbed = Math.min(ward.amount, damage);
  ward.amount -= absorbed;
  if (ward.amount === 0) delete target.ail.ward;
  return damage - absorbed;
}

function elementClear(target, ...ids) {
  if (target.ch && target.ail?.chill && (!ids.length || ids.includes("chill"))) target.dirty = true;
  if (!ids.length) {
    target.ail = null;
    target.ailMarks = null;
    target.ailMotion = null;
    target.elementFreezeAt = target.elementStaggerAt = 0;
    return;
  }
  if (target.ail) for (const id of ids) delete target.ail[id];
  if (target.ailMarks) for (const id of ids) delete target.ailMarks[id];
}

function elementTimed(S, target, id, duration, stacks = 1) {
  const ail = (target.ail ||= {}), until = S.now + duration;
  const timers = ail[id];
  const effect = { until: Math.max(timers?.until || 0, until), stacks };
  ail[id] = effect;
  return effect;
}

/** Expose an ailment supplied by an existing periodic effect without scheduling another damage tick. */
function elementMark(S, target, id, duration, source, key, entry) {
  const marks = target.ailMarks ||= {};
  const pending = marks[id] ||= new Map();
  pending.set(source?.pid || "", { until: S.now + duration, map: source?.map, key, entry });
}

function elementMarked(S, target, id) {
  const pending = target?.ailMarks?.[id];
  if (!pending) return null;
  let until = 0, stacks = 0;
  for (const [pid, mark] of pending) {
    const p = S.players?.[pid];
    if (mark.until <= S.now || (mark.entry && (!p || p.dead || p.map !== mark.map || !p.pc?.v?.[mark.key]?.includes(mark.entry)))) {
      pending.delete(pid);
      continue;
    }
    until = Math.max(until, mark.until);
    stacks++;
  }
  if (!stacks) {
    delete target.ailMarks[id];
    if (!Object.keys(target.ailMarks).length) target.ailMarks = null;
    return null;
  }
  return { until, stacks };
}

/** Only voluntary motion amplifies bleed. Exact-position fixtures can sample coordinates directly. */
function elementMoving(S, target) {
  if (target.elementRunAt !== undefined) return target.elementRunAt > Math.max(0, S.now - 250);
  const motion = (target.ailMotion ||= { x: target.x, y: target.y, at: -Infinity });
  if (Math.abs((target.x || 0) - (motion.x || 0)) + Math.abs((target.y || 0) - (motion.y || 0)) > 0.5) {
    motion.x = target.x;
    motion.y = target.y;
    motion.at = S.now;
  }
  return motion.at > S.now - 250;
}

function elementRestore(S, rt, actor, amount) {
  if (!actor || actor.dead || !(actor.hp > 0)) return;
  const heal = Math.min(elementMaxHp(actor) - actor.hp, Math.round(amount * elementHealFactor(S, actor)));
  if (heal < 1) return;
  actor.hp += heal;
  rt.ev.push(["h", actor.eid ?? actor.id, -heal, 0, elementMob(actor) ? 0 : 1]);
}

function elementStatusScale(S, target, type) {
  if (elementMob(target) || !target.ch) return 1;
  const legacy = type === "fire" ? "burn" : type === "cold" ? "slow" : type;
  return (1 - (deriveStats(target).res || 0)) * pfxStatus(S, target, legacy);
}

/** Bucket expirations per source, so poison can stack freely without storing one row per hit. */
function elementDot(S, target, source, id, duration, damage) {
  if (!(damage > 0)) return;
  const ail = (target.ail ||= {}), end = Math.ceil((S.now + duration) / ELEMENT_EXPIRY_BUCKET_MS) * ELEMENT_EXPIRY_BUCKET_MS;
  const dot = ail[id] && ail[id].until > S.now ? ail[id] : { until: end, next: S.now + 1000, stacks: 0, sources: new Map() };
  ail[id] = dot;
  const pid = source?.pid || "";
  if (id === "burn") {
    const active = dot.burn;
    if (active?.until > S.now && active.damage > damage) return;
    dot.burn = { pid, damage, until: end };
    dot.until = end;
    dot.stacks = 1;
    return;
  }
  if (id === "bleed") {
    elementMoving(S, target);
    if (dot.stacks >= ELEMENT_RULE.bleed.cap) return;
  }
  let byEnd = dot.sources.get(pid);
  if (!byEnd) dot.sources.set(pid, (byEnd = new Map()));
  const bucket = byEnd.get(end);
  if (bucket) { bucket.damage += damage; bucket.stacks++; }
  else byEnd.set(end, { damage, stacks: 1 });
  dot.stacks++;
  dot.until = Math.max(dot.until, end);
}

function elementCold(S, target, duration, statusScale, crit) {
  const stacks = Math.min(3, elementChill(S, target) + 1);
  elementTimed(S, target, "chill", duration, stacks);
  if (target.ch) target.dirty = true;
  if (elementFirm(target) || elementActive(S, target, "freeze") || (target.elementFreezeAt || 0) > S.now) return;
  if (stacks >= 3 || crit) {
    const stop = Math.max(100, Math.round((elementMob(target) ? 1050 : 720) * statusScale));
    elementTimed(S, target, "freeze", stop, stacks);
    target.elementFreezeAt = S.now + stop + 2100;
    delete target.ail.chill;
  }
}

function elementLight(S, rt, source, target, duration) {
  if (elementRoll(S) < 0.5 && !target.dead) {
    elementTimed(S, target, "blind", duration);
    return;
  }
  if (!source || source.dead || !(source.hp > 0)) return;
  const max = elementMaxHp(source);
  if (source.hp < max * 0.72) {
    elementRestore(S, rt, source, max * 0.035);
    return;
  }
  elementWard(S, source, max * 0.06, 2800);
}

function elementWard(S, actor, amount, duration) {
  const ward = actor.ail?.ward;
  const current = ward?.until > S.now ? ward : null;
  const next = Math.max(current?.amount || 0, 1, Math.round(amount));
  if (current && current.amount > Math.round(amount)) return;
  elementTimed(S, actor, "ward", duration).amount = next;
}

/** Apply one specified elemental ailment. `dotDamage` overrides the already-resisted damage per tick. */
function elementInflict(S, rt, source, target, type, damage, options = {}) {
  const rule = ELEMENT_RULE[type];
  if (!rule || !target || !(damage > 0) || MOBS[target.k]?.chest || (target.dead && type !== "light")) return false;
  const chance = clamp(options.chance ?? 1, 0, 1);
  if (chance <= 0 || (chance < 1 && elementRoll(S) >= chance)) return false;
  const scale = elementStatusScale(S, target, type);
  if (scale <= 0) return false;
  const stat = elementGear(source, options.element);
  const duration = clamp(Math.round((options.duration ?? rule.duration) * (1 + (stat?.dur?.[type] || 0) / 100) * scale), 100, 18000);
  switch (type) {
    case "physical": elementTimed(S, target, "shatter", duration); break;
    case "bleed":
    case "fire":
    case "poison": {
      const id = type === "fire" ? "burn" : type;
      elementDot(S, target, source, id, duration, Math.max(1, (options.dotDamage ?? damage * rule.dot) * scale));
      break;
    }
    case "cold": elementCold(S, target, duration, scale, options.crit); break;
    case "lightning":
      elementTimed(S, target, "shock", duration);
      if (!elementFirm(target) && (target.elementStaggerAt || 0) <= S.now) {
        elementTimed(S, target, "stagger", 130);
        target.elementStaggerAt = S.now + 980;
      }
      break;
    case "dark": elementTimed(S, target, "curse", duration); break;
    case "light": elementLight(S, rt, source, target, duration); break;
  }
  return true;
}

/** Trigger one of the 6 cross-elemental reactions when an incoming player hit collides with an existing ailment on a monster. */
function elementCrossReact(S, rt, source, target, parts, preAil) {
  if (!source?.ch || !elementMob(target) || target.dead || MOBS[target.k]?.chest || (target.elRxAt || 0) > S.now || !preAil.size) return null;
  const incoming = new Set();
  for (const [type, amount] of parts) if (amount > 0 && type !== "physical") incoming.add(type);
  if (!incoming.size) return null;
  const rx = ELEMENT_REACTIONS.find((r) =>
    (incoming.has(r.a) && r.ailsB.some((id) => preAil.has(id))) ||
    (incoming.has(r.b) && r.ailsA.some((id) => preAil.has(id))));
  if (!rx) return null;
  target.elRxAt = S.now + ELEMENT_RX_CD;
  const x = target.x, y = target.y, now = S.now, m = mapOfS(S, source.map);
  rt.ev.push(["rx", rx.code, Math.round(x), Math.round(y), rx.r]);
  const st = stats(source), amp = (1 + st.burst) * (pasHas(source, "staff_chant30") ? 1 + SKILL.staff_chant30.k : 1);
  for (const o of mobsWithin(rt, x, y, rx.r)) {
    if (rx.shatter) elementTimed(S, o, "shatter", rx.shatter);
    if (rx.vuln) { o.vuln = Math.max(o.vuln || 0, now + rx.vuln); rt.ev.push(["vu", o.id, rx.vuln]); }
    if (rx.chillAdd) elementCold(S, o, ELEMENT_RULE.cold.duration, 1, false);
    if (rx.pull && o !== target) tug(m, o, x, y, rx.pull);
    if (rx.extendMs && o.ail) {
      for (const dotId of ["bleed", "poison"]) {
        const dot = o.ail[dotId];
        if (!dot || dot.until <= now) continue;
        dot.until += rx.extendMs;
        if (dot.sources) for (const byEnd of dot.sources.values()) {
          const moved = [];
          for (const [end, bucket] of byEnd) moved.push([end + rx.extendMs, bucket]);
          byEnd.clear();
          for (const [end, bucket] of moved) byEnd.set(end, bucket);
        }
      }
    }
    hurtMob(S, rt, o, source, rx.mult * amp, false, { mag: 1, elem: rx.elem, secondaryType: null, px: 1, noRx: true });
  }
  if (rx.ward) {
    for (const q of allies(S, source)) if (!q.dead && dist(q.x, q.y, x, y) <= rx.r + 36) elementWard(S, q, stats(q).mhp * rx.ward, rx.wardMs);
  }
  if (rx.heal && !source.dead) elementRestore(S, rt, source, stats(source).mhp * rx.heal);
  if (source.ch.job === "wizard" || source.ch.job === "runearcher") jobTraitGain(S, rt, source, 1, false);
  return rx;
}

function elementApplyHit(S, rt, source, target, parts, options = {}) {
  if (!target || MOBS[target.k]?.chest || (options.proc === false && !options.forceAilment)) return;
  const preAil = !options.noRx && source?.ch && elementMob(target)
    ? new Set(ELEMENT_STATUS.map((s) => s.id).filter((id) => elementActive(S, target, id) || (id === "burn" && target.brnAt > S.now) || (id === "bleed" && target.dot?.until > S.now)))
    : null;
  const gear = elementGear(source, options.element);
  // Multiple enemies often attack together. Their elemental precision is lower than a player's.
  const precision = elementMob(source) ? (source.el || MOBS[source.k]?.boss ? 0.65 : 0.40) : 1;
  for (const [type, amount] of parts) {
    const forced = type === options.forceAilment;
    if (options.proc === false && !forced) continue;
    const damage = amount * (options.scale ?? 1);
    if (!(damage > 0) || (type === "physical" && !options.crit && !forced)) continue;
    if (type === "dark" && !options.noDarkLeech && source?.hp > 0 && !source.dead) {
      elementRestore(S, rt, source, Math.min(damage * 0.17, elementMaxHp(source) * 0.04));
    }
    const chance = forced ? 1 : (ELEMENT_RULE[type].chance + (gear?.proc?.[type] || 0) / 100) * precision;
    elementInflict(S, rt, source, target, type, damage, { chance, crit: options.crit, element: gear });
  }
  if (preAil && preAil.size) elementCrossReact(S, rt, source, target, parts, preAil);
}

function elementDotHit(S, rt, target, type, pid, amount) {
  const dmg = Math.max(1, Math.round(amount));
  if (!elementMob(target)) {
    wound(S, rt, target, dmg, type);
    return target.dead;
  }
  const source = S.players[pid];
  if (!source || source.map !== rt.id) return false;
  return dealMob(S, rt, target, source, dmg, false, 0, [[type, dmg]]);
}

/** Tick at the simulation cadence. Expired buckets are cleared before damage and the next snapshot. */
function elementTick(S, rt, target) {
  if (!target.dead && (target.dot || target.ail?.bleed || elementMarked(S, target, "bleed"))) elementMoving(S, target);
  if (!target.ail || target.dead) return false;
  if (target.ail.chill?.until <= S.now) elementClear(target, "chill");
  for (const [id, type] of ELEMENT_DOTS) {
    const dot = target.ail[id];
    if (!dot) continue;
    if (dot.until <= S.now) { delete target.ail[id]; continue; }
    const moveK = id === "bleed" && elementMoving(S, target) ? 2 : 1;
    const due = dot.next <= S.now;
    if (due) dot.next = S.now + 1000;
    if (id === "burn") {
      if (due && elementDotHit(S, rt, target, type, dot.burn.pid, dot.burn.damage)) return true;
      continue;
    }
    let count = 0;
    for (const [pid, buckets] of dot.sources) {
      let amount = 0;
      for (const [until, hit] of buckets) {
        if (until <= S.now) { buckets.delete(until); continue; }
        count += hit.stacks;
        amount += hit.damage;
      }
      if (!buckets.size) dot.sources.delete(pid);
      if (due && amount > 0 && elementDotHit(S, rt, target, type, pid, amount * moveK)) return true;
    }
    dot.stacks = count;
  }
  return false;
}

/** Compact wire tuple: status index, remaining deciseconds, stack count. */
function elementStatusRows(S, target) {
  if (!target.ail && !target.ailMarks && !target.burn && !target.poison && !target.dot && !(target.slowed > S.now) && !(target.slow > S.now)) return NO_ELEMENT_ROWS;
  const rows = [];
  for (let i = 0; i < ELEMENT_STATUS.length; i++) {
    const id = ELEMENT_STATUS[i].id, status = target.ail?.[id];
    const oldUntil = id === "burn" ? target.burn?.until : id === "bleed" ? target.dot?.until : id === "poison" ? target.poison?.until
      : id === "chill" ? Math.max(target.slowed || 0, target.slow || 0) : 0;
    const marked = elementMarked(S, target, id);
    const until = Math.max(status?.until || 0, oldUntil || 0, marked?.until || 0);
    if (until <= S.now) continue;
    const stacks = status?.until > S.now ? status.stacks : 0;
    rows.push([i, Math.ceil((until - S.now) / 100), Math.max(1, stacks + (oldUntil > S.now ? 1 : 0) + (marked?.stacks || 0))]);
  }
  return rows.length ? rows : NO_ELEMENT_ROWS;
}
