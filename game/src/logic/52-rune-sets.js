// ───────────────────────────── equipped rune sets ─────────────────────────────

const RUNE_SET_MAX = 2;
const RUNE_POWER = {
  willowwind: { move: 1.14, iv: 0.90, ms: 2800 },
  duskfang: { kill: 0.025, chance: 0.25, leech: 0.10, icd: 1200 },
  lantern: { shield: 0.12, ms: 5500, icd: 14000 },
  brassscale: { gold: 22, mf: 16, per: 180, atk: 0.07, ms: 30000 },
  azureknot: { cdr: 0.08, mp: 0.86 },
  ashbloom: { chance: 0.2, hit: 1, dot: 0.14, ms: 4000, radius: 64, targets: 5, icd: 5500 },
  silverlake: { slow: 1800, crit: 1.25 },
  stormsail: { chance: 0.18, first: 1.05, fall: 0.74, radius: 94, targets: 5, icd: 4400 },
  inkthorn: { dot: 0.045, vuln: 0.025, stacks: 4, ms: 6000, hitGap: 500 },
  lastbell: { hp: 0.3, hit: 1.25, execute: 0.05 },
  redanvil: { atk: 0.35, iv: 0.16, hp: 0.25, miti: 0.82 },
  astrolabe: { chance: 0.11, cap: 0.35, ratio: 2, ms: 20000, icd: 13000 },
  dawnpillar: { heal: 0.35, ms: 2400, icd: 360000 },
  moonveil: { ms: 1700, ign: 0.48, icd: 8500 },
  blackstar: { chance: 0.19, damage: 1.12, splash: 0.48, radius: 84, targets: 5, icd: 4500 },
};

const runePct = (n) => +(n * 100).toFixed(1);
const runeSec = (n) => n / 1000;
const RUNE_SETS = Object.fromEntries([
  ["willowwind", "버들바람", 2, (c) => `이동 속도 +${runePct(c.move - 1)}%. 회피 성공 시 ${runeSec(c.ms)}초간 기본 공격 간격 -${runePct(1 - c.iv)}%.`],
  ["duskfang", "저녁송곳니", 2, (c) => `적을 처치하면 최대 HP의 ${runePct(c.kill)}% 회복. 공격 적중 시 ${runePct(c.chance)}% 확률로 준 피해의 ${runePct(c.leech)}%만큼 회복 (${runeSec(c.icd)}초 간격).`],
  ["lantern", "등불파수", 2, (c) => `피격 시 ${runeSec(c.ms)}초간 최대 HP의 ${runePct(c.shield)}%만큼 피해를 흡수하는 보호막 생성 (${runeSec(c.icd)}초 간격).`],
  ["brassscale", "황동저울", 2, (c) => `전투 골드 획득 +${c.gold}%, 아이템 발견 +${c.mf}%. 떨어진 골드를 주울 때마다 ${c.per}골드당 공격력 1% 증가 (최대 ${runePct(c.atk)}%, ${runeSec(c.ms)}초).`],
  ["azureknot", "푸른매듭", 2, (c) => `스킬 재사용 대기시간과 MP 소모 각각 ${runePct(c.cdr)}%, ${runePct(1 - c.mp)}% 감소.`],
  ["ashbloom", "잿불꽃", 3, (c) => `공격 적중 시 ${runePct(c.chance)}% 확률로 적을 중심으로 최대 ${c.targets}명에게 공격력의 ${runePct(c.hit)}% 화염 피해. ${runeSec(c.ms)}초간 매초 공격력의 ${runePct(c.dot)}% 화상 피해 (${runeSec(c.icd)}초 간격).`],
  ["silverlake", "은설호", 3, (c) => `공격 적중 시 ${runeSec(c.slow)}초간 오한. 오한 또는 빙결 상태의 적에게 치명타 피해 +${runePct(c.crit - 1)}%.`],
  ["stormsail", "폭풍항해", 3, (c) => `공격 적중 시 ${runePct(c.chance)}% 확률로 처음 맞은 적부터 최대 ${c.targets}명에게 연쇄 번개. 첫 피해는 공격력의 ${runePct(c.first)}%, 튕길 때마다 ${runePct(1 - c.fall)}% 감소 (${runeSec(c.icd)}초 간격).`],
  ["inkthorn", "먹물가시", 3, (c) => `치명타 적중 시 ${runeSec(c.ms)}초간 중독 중첩. 중첩마다 매초 공격력의 ${runePct(c.dot)}% 피해를 주고, 맹독으로 대상이 받는 피해 +${runePct(c.vuln)}% (피해 증폭은 최대 ${c.stacks}중첩).`],
  ["lastbell", "마지막 종", 3, (c) => `HP ${runePct(c.hp)}% 이하인 적에게 주는 피해 +${runePct(c.hit - 1)}%. 공격 후 HP ${runePct(c.execute)}% 이하인 적 즉시 처형 (보스와 우두머리 제외).`],
  ["redanvil", "붉은모루", 4, (c) => `잃은 HP 비율의 제곱에 비례해 공격력이 최대 ${runePct(c.atk)}% 증가하고 기본 공격 간격이 최대 ${runePct(c.iv)}% 감소. HP ${runePct(c.hp)}% 이하에서는 받는 피해 -${runePct(1 - c.miti)}%.`],
  ["astrolabe", "별의 궤도", 4, (c) => `스킬 사용 시 ${runePct(c.chance)}% 확률로 해당 스킬의 재사용 대기 초기화 (${runeSec(c.icd)}초 간격). 사용한 MP가 많을수록 ${runeSec(c.ms)}초 내 다음 공격 스킬의 피해 증가 (최대 ${runePct(c.cap)}%).`],
  ["dawnpillar", "새벽기둥", 4, (c) => `치명상을 입으면 살아남아 최대 HP의 ${runePct(c.heal)}%를 회복하고 ${runeSec(c.ms)}초간 무적 (재발동 ${c.icd / 60000}분).`],
  ["moonveil", "달그늘", 4, (c) => `회피나 이동기 사용 시 ${runeSec(c.ms)}초간 은신 (${runeSec(c.icd)}초 간격). 은신 중 첫 공격은 확정 치명타, 방어력 ${runePct(c.ign)}% 관통. 보스와 우두머리는 은신한 대상을 추적합니다.`],
  ["blackstar", "검은별", 4, (c) => `공격 시 ${runePct(c.chance)}% 확률로 적의 방어력을 무시하고 공격 피해 +${runePct(c.damage - 1)}%. 방어력을 무시하는 충격파가 주변 최대 ${c.targets}명에게 공격력의 ${runePct(c.splash)}% 피해 (${runeSec(c.icd)}초 간격).`],
].map(([id, name, need, desc]) => [id, { name, need, desc: desc(RUNE_POWER[id]) }]));

// Higher requirements win. Equally sized sets keep their order in the table.
const RUNE_PRIORITY = Object.keys(RUNE_SETS).sort((a, b) => RUNE_SETS[b].need - RUNE_SETS[a].need);
function activeRuneSets(counts) {
  return RUNE_PRIORITY.filter((id) => (counts[id] || 0) >= RUNE_SETS[id].need).slice(0, RUNE_SET_MAX);
}

const runeOn = (p, id) => deriveStats(p).runeSets?.includes(id) === true;
const runeTimed = (p, id, now) => (p.pc?.t[id] || 0) > now;
const runeFirm = (mob) => MOBS[mob.k].boss || mob.el === 2 || MOBS[mob.k].chest || MOBS[mob.k].still;
const runeReady = (S, p, id) => S.now >= (p.pc?.cd[id] || 0);
const runeProc = (S, p, st, id) => {
  const c = RUNE_POWER[id];
  return runeReady(S, p, id) && pfxChance(S, st, c.chance) && pfxIcd(S, p, id, c.icd);
};

/** Changing which sets win drops their active states, without refreshing their cooldowns. */
function syncRuneActive(p, ids) {
  if (!p.pc) return;
  for (const id of Object.keys(p.pc.t)) if (Object.hasOwn(RUNE_SETS, id) && !ids.includes(id)) {
    delete p.pc.t[id];
    delete p.pc.v[id];
  }
}

function runeEarnGold(S, p, amount) {
  if (!runeOn(p, "brassscale")) return;
  const c = RUNE_POWER.brassscale, pc = pfxPc(p);
  const old = runeTimed(p, "brassscale", S.now) ? pc.v.brassscale : 0;
  pc.v.brassscale = Math.min(c.per * Math.round(c.atk * 100), old + amount);
  pc.t.brassscale = S.now + c.ms;
}

/** The killing player can heal regardless of whether a blow, trap or DoT took the last HP. */
function runeKillHeal(S, p, mob) {
  if (p.dead || MOBS[mob.k].chest || !runeOn(p, "duskfang")) return;
  const st = deriveStats(p);
  pfxHeal(S, p, st, st.mhp * RUNE_POWER.duskfang.kill);
}

const runeDetonate = (rt, x, y, radius, color) => rt.ev.push(["b", Math.round(x), Math.round(y), radius, color]);
const runeBolt = (rt, src, dst) => rt.ev.push(["z", Math.round(src.x), Math.round(src.y - 6), Math.round(dst.x), Math.round(dst.y - 6), 0]);

function runeNearest(rt, src, radius, seen) {
  let nearest = null, range = radius;
  for (const mob of mobsWithin(rt, src.x, src.y, radius)) {
    if (seen.has(mob) || MOBS[mob.k].chest) continue;
    const d = dist(src.x, src.y, mob.x, mob.y);
    if (d < range) { nearest = mob; range = d; }
  }
  return nearest;
}

function runeDotSource(S, dot) {
  const p = dot && S.players[dot.pid];
  return dot && dot.until >= S.now && p && !p.dead && p.map === dot.map && runeOn(p, "inkthorn") ? p : null;
}

function runePoisonFactor(S, mob) {
  return runeDotSource(S, mob.runePoison) ? 1 + RUNE_POWER.inkthorn.vuln * mob.runePoison.stacks : 1;
}

/** The previous cast charges the next damaging skill, including its delayed hits. */
function runeSkillDamage(S, p, st, sk) {
  if (!st.runeSets?.includes("astrolabe") || typeof sk.mult !== "number" || !runeTimed(p, "astrolabe", S.now)) return 1;
  const pc = pfxPc(p), bonus = pc.v.astrolabe || 0;
  delete pc.t.astrolabe;
  delete pc.v.astrolabe;
  return 1 + bonus;
}

function runeShade(S, p) {
  const c = RUNE_POWER.moonveil;
  if (pfxIcd(S, p, "moonveil", c.icd)) pfxPc(p).t.moonveil = S.now + c.ms;
}

function runeMoveSkill(S, p) {
  p.elementRunAt = S.now;
  if (runeOn(p, "moonveil")) runeShade(S, p);
}

const runeHidden = (p, now) => runeTimed(p, "moonveil", now) && runeOn(p, "moonveil");

/** The true-damage proc cannot recur on its own shockwave. */
function runeShock(S, rt, p, x, y, first) {
  const c = RUNE_POWER.blackstar, atk = stats(p).atk;
  runeDetonate(rt, x, y, c.radius, 3);
  const hit = mobsWithin(rt, x, y, c.radius).filter((mob) => mob !== first && !MOBS[mob.k].chest).slice(0, c.targets);
  for (const mob of hit) dealMob(S, rt, mob, p, Math.max(1, Math.round(atk * c.splash)), false);
}

const RUNE_SET_FN = {
  willowwind: {
    sheet(p, c) { c.spd0 *= RUNE_POWER.willowwind.move; },
    evade(S, rt, p) { pfxPc(p).t.willowwind = S.now + RUNE_POWER.willowwind.ms; },
    stat(p, st, r) { if (runeTimed(p, "willowwind", p.S.now)) r.riv *= RUNE_POWER.willowwind.iv; },
  },
  duskfang: {
    hit(S, rt, p, st, mob, dmg) {
      if (!p.dead && p.hp < st.mhp && !MOBS[mob.k].chest && runeProc(S, p, st, "duskfang")) pfxHeal(S, p, st, dmg * RUNE_POWER.duskfang.leech);
    },
  },
  lantern: {
    miti(S, rt, p, st, mob, dmg, raw, r) {
      const c = RUNE_POWER.lantern, pc = pfxPc(p), id = "lantern";
      if (r.block) return;
      if (pfxIcd(S, p, id, c.icd)) { pc.t[id] = S.now + c.ms; pc.v[id] = Math.round(st.mhp * c.shield); }
      if (!runeTimed(p, id, S.now) || !pc.v[id]) return;
      const taken = Math.round(dmg * clamp(r.f, PFX_CAP.miti, 1));
      const absorbed = Math.max(0, Math.min(pc.v[id], taken - r.abs, st.mhp * PFX_CAP.abs - r.abs));
      r.abs += absorbed;
      pc.v[id] -= absorbed;
    },
  },
  brassscale: {
    loot(S, rt, p, st, mob, r, kind) {
      if (kind !== "drop") return;
      r.gold += RUNE_POWER.brassscale.gold;
      r.mf += RUNE_POWER.brassscale.mf;
    },
    stat(p, st) {
      if (!runeTimed(p, "brassscale", p.S.now)) return;
      const c = RUNE_POWER.brassscale;
      const bonus = Math.min(c.atk, Math.floor(p.pc.v.brassscale / c.per) / 100);
      st.atk = Math.round(st.atk * (1 + bonus));
    },
  },
  azureknot: {
    sheet(p, c) { c.cdr = 1 - (1 - c.cdr) * (1 - RUNE_POWER.azureknot.cdr); },
    num(p, name, value) { if (name === "mp") return value * RUNE_POWER.azureknot.mp; },
  },
  ashbloom: {
    hit(S, rt, p, st, mob) {
      if (MOBS[mob.k].chest || !runeProc(S, p, st, "ashbloom")) return;
      const c = RUNE_POWER.ashbloom;
      const hit = mobsWithin(rt, mob.x, mob.y, c.radius).filter((other) => other !== mob && !MOBS[other.k].chest).slice(0, c.targets - 1);
      if (!mob.dead) hit.unshift(mob);
      runeDetonate(rt, mob.x, mob.y, c.radius, 2);
      for (const other of hit) {
        const before = other.hp;
        hurtMob(S, rt, other, p, c.hit, false, { ...PX, elem: "fire", typedOnly: true });
        if (!other.dead && other.hp < before) {
          const dotDamage = st.atk * c.dot * elementResist(S, other, "fire", st.element?.pen.fire || 0);
          elementInflict(S, rt, p, other, "fire", before - other.hp, { duration: c.ms, dotDamage });
        }
      }
    },
  },
  silverlake: {
    hit(S, rt, p, st, mob, dmg, crit, killed) {
      if (killed || mob.dead || MOBS[mob.k].chest) return;
      elementInflict(S, rt, p, mob, "cold", dmg, { duration: RUNE_POWER.silverlake.slow, crit });
    },
    mul(S, p, st, mob, d, o, crit) {
      return crit && !o.px && (mob.slow > S.now || elementActive(S, mob, "chill") || elementActive(S, mob, "freeze")) ? RUNE_POWER.silverlake.crit : 1;
    },
  },
  stormsail: {
    hit(S, rt, p, st, mob) {
      if (MOBS[mob.k].chest || !runeProc(S, p, st, "stormsail")) return;
      const c = RUNE_POWER.stormsail, seen = new Set();
      let next = mob, mult = c.first;
      for (let i = 0; i < c.targets && next; i++) {
        const prev = next;
        seen.add(prev);
        next = i < c.targets - 1 ? runeNearest(rt, prev, c.radius, seen) : null;
        if (!prev.dead) {
          const before = prev.hp;
          hurtMob(S, rt, prev, p, mult, false, { ...PX, elem: "lightning", typedOnly: true });
          if (!prev.dead && prev.hp < before) elementInflict(S, rt, p, prev, "lightning", before - prev.hp);
        }
        if (next) runeBolt(rt, prev, next);
        mult *= c.fall;
      }
    },
  },
  inkthorn: {
    crit(S, rt, p, st, mob, dmg, crit, killed) {
      if (killed || mob.dead || MOBS[mob.k].chest) return;
      const c = RUNE_POWER.inkthorn, recent = runeDotSource(S, mob.runePoison) ? mob.runePoison : null;
      if (recent && S.now < recent.addAt + c.hitGap) return;
      const dotDamage = st.atk * c.dot * elementResist(S, mob, "poison", st.element?.pen.poison || 0);
      elementInflict(S, rt, p, mob, "poison", dmg, { duration: c.ms, dotDamage });
      mob.runePoison = { pid: p.pid, map: p.map, until: S.now + c.ms, addAt: S.now, stacks: Math.min(c.stacks, (recent?.stacks || 0) + 1) };
    },
  },
  lastbell: {
    mul(S, p, st, mob) { return mob.hp <= mobMax(mob) * RUNE_POWER.lastbell.hp ? RUNE_POWER.lastbell.hit : 1; },
    hit(S, rt, p, st, mob, dmg, crit, killed, o) {
      if (killed || mob.dead || runeFirm(mob) || mob.hp > mobMax(mob) * RUNE_POWER.lastbell.execute) return;
      const { x, y } = mob;
      if (dealMob(S, rt, mob, p, Math.ceil(mob.hp * (mob.hk || 1)), true)) pfxKill(S, rt, p, st, mob, x, y, o);
    },
  },
  redanvil: {
    stat(p, st, r) {
      const c = RUNE_POWER.redanvil, lost = 1 - clamp(p.hp / st.mhp, 0, 1);
      st.atk = Math.round(st.atk * (1 + c.atk * lost * lost));
      r.riv *= 1 - c.iv * lost * lost;
    },
    miti(S, rt, p, st, mob, dmg, raw, r) { if (p.hp <= st.mhp * RUNE_POWER.redanvil.hp) r.f *= RUNE_POWER.redanvil.miti; },
  },
  astrolabe: {
    skill(S, rt, p, st, sk, id, cost) {
      const c = RUNE_POWER.astrolabe, pc = pfxPc(p);
      if (cost > 0) { pc.v.astrolabe = Math.min(c.cap, (cost / st.mmp) * c.ratio); pc.t.astrolabe = S.now + c.ms; }
      if (p.cds[id] <= S.now || !runeProc(S, p, st, "astrolabe")) return;
      p.cds[id] = S.now;
      toast(p, `별의 궤도 · [${sk.name}] 재사용 대기 초기화`);
    },
  },
  dawnpillar: {
    lethal(S, rt, p, st) {
      const c = RUNE_POWER.dawnpillar;
      if (S.now < (p.ch.runeWardAt || 0) || !runeReady(S, p, "fate")) return false;
      p.ch.runeWardAt = S.now + c.icd;
      pfxPc(p).cd.fate = p.ch.runeWardAt;
      p.hp = Math.max(1, Math.round(st.mhp * c.heal));
      p.ghost = Math.max(p.ghost || 0, S.now + c.ms);
      p.dirty = true;
      saveSoon(p);
      toast(p, "새벽기둥 · 쓰러지기 직전 되살아났습니다.");
      rt.ev.push(["h", p.eid, -p.hp, 0, 1]);
      return true;
    },
  },
  moonveil: {
    dash(S, rt, p) { runeShade(S, p); },
    evade(S, rt, p) { runeShade(S, p); },
    pre(S, p, st, mob, d, o, r) {
      if (o.px || d.chest || !runeTimed(p, "moonveil", S.now)) return;
      delete p.pc.t.moonveil;
      r.sure = 1;
      r.ign = Math.max(r.ign, RUNE_POWER.moonveil.ign);
    },
  },
  blackstar: {
    pre(S, p, st, mob, d, o, r) {
      if (!o.px && !d.chest && runeProc(S, p, st, "blackstar")) r.pure = 1;
    },
  },
};
