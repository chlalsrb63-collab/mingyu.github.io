// ───────────────────────────── 접두사 고유 효과: rune-inspired legendary enchant powers (19) ─────────────────────────────
// Inspired by Mabinogi Mobile's rune archetypes and adapted to Tales Tales' prefix hooks & caps (51-prefix.js):
//   Offense (O, WRG):  thrill 전율의 · venom 극독의 · wonder 경이의 · gale 질풍의 · plague 역병의 · brawl 격전의
//                      wrath 격노의 · frostbite 혹한의 · dazzling 현란한 · ruthless 냉혹한
//   Defense (D, ABNH): steel 강철의 · steady 안정의 · snipe 저격의 · surge 발진의 · scarcity 결핍의 · scrum 난투의 · tenacity 끈기의
//   Utility (U, H):    wisdom 지혜로운 · steadfast 부동의

Object.assign(PFX, {
  // Offense (10)
  thrill: { on: 1, p: 0.25, n: 4, r: 64, k: 0.45, icd: 1000 },
  venom: { on: 1, p: 0.30, ms: 5000, k: 0.18, icd: 4000 },
  wonder: { on: 1, k: 0.06, icd: 1000 },
  gale: { on: 1, hits: 3, r: 42, k: 0.75, icd: 1000 },
  plague: { on: 1, mark: 5000, r: 48, ms: 4000, k: 0.20 },
  brawl: { on: 1, r: 70, k: 0.03, max: 0.15 },
  wrath: { on: 1, every: 10000, ms: 3000, k: 1.25 },
  frostbite: { on: 1, k: 0.40, slow: 3000, icd: 3000 },
  dazzling: { on: 1, crit: 8, k: 1.20 },
  ruthless: { on: 1, crit: 10, max: 5 },
  // Defense (7)
  steel: { on: 1, k: 1.20 },
  steady: { on: 1, hp: 0.75, k: 1.09 },
  snipe: { on: 1, ms: 3000, k: 1.12 },
  surge: { on: 1, ms: 7000, k: 1.09 },
  scarcity: { on: 1, mp: 0.50, k: 1.10 },
  scrum: { on: 1, r: 70, k: 0.03, max: 0.12 },
  tenacity: { on: 1, hp: 0.50, ms: 10000, k: 0.76, icd: 30000 },
  // Utility (2)
  wisdom: { on: 1, k: 0.85 },
  steadfast: { on: 1, every: 10000, k: 0.02, max: 5 },
});

Object.assign(LEGEND, {
  // Offense
  thrill: ["전율의", pfxText("thrill", "공격 적중 시 {p:%}% 확률로 주변 최대 {n}명에게 공격력의 {k:%}% 감전 피해 ({icd:s}초 간격)"), "WG", "O", "M", "blow"],
  venom: ["극독의", pfxText("venom", "공격 적중 시 {p:%}% 확률로 {ms:s}초간 매초 공격력의 {k:%}% 독 피해 ({icd:s}초 간격)"), "WGR", "O", "M", "blow"],
  wonder: ["경이의", pfxText("wonder", "기본 공격 적중 시 모든 스킬의 남은 재사용 대기시간 -{k:%}% ({icd:s}초 간격)"), "WG", "O", "L", "skill"],
  gale: ["질풍의", pfxText("gale", "같은 적을 {hits}회 공격할 때마다 충격파가 일어 반경 {r}의 적에게 공격력의 {k:%}% 피해 ({icd:s}초 간격)"), "WG", "O", "M", "blow"],
  plague: ["역병의", pfxText("plague", "공격 시 {mark:s}초간 부패를 부여하며, 부패한 적이 쓰러지면 반경 {r}의 적들에게 {ms:s}초간 매초 공격력의 {k:%}% 독 피해"), "WR", "O", "M", "kill"],
  brawl: ["격전의", pfxText("brawl", "주변(반경 {r}) 적 1명마다 주는 피해 +{k:%}% (최대 +{max:%}%)"), "WG", "O", "M", "pass"],
  wrath: ["격노의", pfxText("wrath", "전투 중 {every:s}초마다 {ms:s}초간 공격력 +{k:+%}%"), "WR", "O", "L", "pass"],
  frostbite: ["혹한의", pfxText("frostbite", "스킬 또는 마무리 일격 적중 시 공격력의 {k:%}% 냉기 피해를 주고 {slow:s}초간 둔화시킨다 ({icd:s}초 간격)"), "WG", "O", "M", "blow"],
  dazzling: ["현란한", pfxText("dazzling", "치명타 확률 +{crit}%, 치명타 피해 +{k:+%}%"), "WRG", "O", "L", "crit"],
  ruthless: ["냉혹한", pfxText("ruthless", "치명타가 발동하지 않을 때마다 치명타 확률 +{crit}% 누적 (최대 {max}중첩, 치명타 시 초기화)"), "WRG", "O", "L", "crit"],
  // Defense
  steel: ["강철의", pfxText("steel", "방어력 +{k:+%}%"), "AH", "D", "M", "mit"],
  steady: ["안정의", pfxText("steady", "HP가 {hp:%}% 이상일 때 공격력 +{k:+%}%"), "AN", "D", "S", "pass"],
  snipe: ["저격의", pfxText("snipe", "{ms:s}초 이상 이동하지 않으면 공격력 +{k:+%}%"), "BH", "D", "M", "pass"],
  surge: ["발진의", pfxText("surge", "대시 사용 시 {ms:s}초간 공격력 +{k:+%}%"), "BN", "D", "S", "mob"],
  scarcity: ["결핍의", pfxText("scarcity", "MP가 {mp:%}% 미만일 때 공격력 +{k:+%}%"), "NH", "D", "S", "pass"],
  scrum: ["난투의", pfxText("scrum", "주변(반경 {r}) 적 1명마다 받는 피해 -{k:%}% (최대 -{max:%}%)"), "AB", "D", "M", "mit"],
  tenacity: ["끈기의", pfxText("tenacity", "피격으로 HP가 {hp:%}% 이하가 되면 {ms:s}초간 받는 피해 -{k:-%}% ({icd:s}초 간격)"), "ABNH", "D", "M", "mit"],
  // Utility
  wisdom: ["지혜로운", pfxText("wisdom", "스킬 사용 시 해당 스킬의 재사용 대기시간 -{k:-%}%"), "H", "U", "L", "util"],
  steadfast: ["부동의", pfxText("steadfast", "전투 중 {every:s}초마다 공격력과 방어력 +{k:%}% (최대 {max}중첩, 비전투 시 초기화)"), "H", "U", "L", "pass"],
});

/** Count live non-chest monsters within `r` pixels of `p`. */
function runeNearMobs(rt, p, r) {
  let n = 0;
  for (const m of mobsWithin(rt, p.x, p.y, r)) if (!m.dead && !MOBS[m.k].chest) n++;
  return n;
}

/** Shared frostbite proc (skill hit or combo finisher). */
function frostbiteProc(S, rt, p, st, mob) {
  if (!mob || mob.dead || MOBS[mob.k].chest) return;
  const c = PFX.frostbite;
  if (!pfxIcd(S, p, "frostbite", c.icd)) return;
  const dmg = Math.max(1, Math.round(st.atk * c.k));
  if (dealTypedMob(S, rt, mob, p, dmg, "cold")) pfxKill(S, rt, p, st, mob, mob.x, mob.y, PX);
  if (!mob.dead && !pgFirm(mob)) {
    mob.slow = Math.max(mob.slow || 0, S.now + c.slow);
    elementInflict(S, rt, p, mob, "cold", 1, { duration: c.slow });
  }
}

Object.assign(PFX_FN, {
  // 전율의: 25% on hit → shock up to 4 nearby enemies (1s ICD)
  thrill: {
    hit(S, rt, p, st, mob) {
      const c = PFX.thrill;
      if (!mob || MOBS[mob.k].chest || !pfxChance(S, st, c.p) || !pfxIcd(S, p, "thrill", c.icd)) return;
      const dmg = Math.max(1, Math.round(st.atk * c.k));
      let hitN = 0;
      for (const m of mobsWithin(rt, mob.x, mob.y, c.r)) {
        if (m.dead || MOBS[m.k].chest) continue;
        if (dealTypedMob(S, rt, m, p, dmg, "shock")) pfxKill(S, rt, p, st, m, m.x, m.y, PX);
        if (!m.dead) elementInflict(S, rt, p, m, "shock", 1, { duration: 2500 });
        if (++hitN >= c.n) break;
      }
      if (hitN) rt.ev.push(["a", p.eid, 108, Math.round(mob.x), Math.round(mob.y - 6), p.dir]);
    },
  },
  // 극독의: 30% on hit → 5s poison DoT (4s ICD)
  venom: {
    hit(S, rt, p, st, mob, dmg, crit, killed) {
      const c = PFX.venom;
      if (killed || !mob || mob.dead || MOBS[mob.k].chest) return;
      if (!pfxChance(S, st, c.p) || !pfxIcd(S, p, "venom", c.icd)) return;
      dotAdd(S, p, st, "venom", mob);
    },
    tick(S, rt, p, st) { dotPay(S, rt, p, st, "venom"); },
  },
  // 경이의: basic blow trims 6% off all active skill cooldowns (1s ICD)
  wonder: {
    blow(S, rt, p) {
      const c = PFX.wonder;
      if (!pfxIcd(S, p, "wonder", c.icd)) return;
      for (const id in p.cds) {
        const rem = p.cds[id] - S.now;
        if (rem > 200) p.cds[id] = Math.max(S.now, Math.round(S.now + rem * (1 - c.k)));
      }
    },
  },
  // 질풍의: every 3rd hit on the same target unleashes an AoE shockwave (1s ICD)
  gale: {
    hit(S, rt, p, st, mob, dmg, crit, killed) {
      const c = PFX.gale, pc = pfxPc(p);
      if (pc.v.gale !== mob.id) { pc.v.gale = mob.id; pc.n.gale = 0; }
      const cnt = pfxStack(p, "gale", 1, c.hits);
      if (killed) { pc.v.gale = 0; pc.n.gale = 0; }
      if (cnt < c.hits) return;
      pc.n.gale = 0;
      if (!pfxIcd(S, p, "gale", c.icd)) return;
      for (const m of mobsWithin(rt, mob.x, mob.y, c.r)) {
        if (m.dead || MOBS[m.k].chest) continue;
        hurtMob(S, rt, m, p, c.k, false, PX);
      }
      rt.ev.push(["a", p.eid, 105, Math.round(mob.x), Math.round(mob.y - 6), p.dir]);
    },
  },
  // 역병의: hits mark rot for 5s; killing a rotted foe spreads poison DoT to nearby foes
  plague: {
    hit(S, rt, p, st, mob, dmg, crit, killed) {
      if (!mob || MOBS[mob.k].chest) return;
      mob._plague = S.now + PFX.plague.mark;
    },
    kill(S, rt, p, st, mob, x, y) {
      if (!mob || !(mob._plague >= S.now)) return;
      mob._plague = 0;
      for (const m of mobsWithin(rt, x, y, PFX.plague.r)) {
        if (m !== mob && !m.dead && !MOBS[m.k].chest) dotAdd(S, p, st, "plague", m);
      }
    },
    tick(S, rt, p, st) { dotPay(S, rt, p, st, "plague"); },
  },
  // 격전의: damage rises with nearby enemies (+3% each, up to +15%)
  brawl: {
    tick(S, rt, p) { pfxPc(p).v.brawl = runeNearMobs(rt, p, PFX.brawl.r); },
    mul(S, p) {
      const n = p.pc && p.pc.v.brawl, c = PFX.brawl;
      return n > 0 ? 1 + Math.min(c.max, n * c.k) : 1;
    },
  },
  // 격노의: every 10s in combat, +25% ATK for 3s
  wrath: {
    tick(S, rt, p, st, now, calm) {
      const c = PFX.wrath;
      if (!calm && pfxIcd(S, p, "wrath", c.every)) pfxPc(p).t.wrath = now + c.ms;
    },
    stat(p, st) { if (pgOn(p, "wrath")) st.atk = Math.round(st.atk * PFX.wrath.k); },
  },
  // 혹한의: skill hit or combo finisher deals cold damage & slows (3s ICD)
  frostbite: {
    hit(S, rt, p, st, mob, dmg, crit, killed, o) { if (o && o.sk) frostbiteProc(S, rt, p, st, mob); },
    blow(S, rt, p, st, mob, x, y, fin) { if (fin) frostbiteProc(S, rt, p, st, mob); },
  },
  // 현란한: +8% crit chance, +20% crit damage
  dazzling: {
    pre(S, p, st, mob, d, o, r) { r.crit += PFX.dazzling.crit; },
    mul(S, p, st, mob, d, o, crit) { return crit ? PFX.dazzling.k : 1; },
  },
  // 냉혹한: each non-crit stacks +10% crit chance (up to 5), resets on crit
  ruthless: {
    pre(S, p, st, mob, d, o, r) {
      const n = p.pc && p.pc.n.ruthless;
      if (n > 0) r.crit += n * PFX.ruthless.crit;
    },
    hit(S, rt, p, st, mob, dmg, crit) {
      if (crit) pfxPc(p).n.ruthless = 0;
      else pfxStack(p, "ruthless", 1, PFX.ruthless.max);
    },
  },
  // 강철의: +20% DEF
  steel: {
    stat(p, st) { st.def = Math.round(st.def * PFX.steel.k); },
  },
  // 안정의: HP >= 75% → +9% ATK
  steady: {
    stat(p, st) { if (p.hp >= st.mhp * PFX.steady.hp) st.atk = Math.round(st.atk * PFX.steady.k); },
  },
  // 저격의: standing still >= 3s → +12% ATK
  snipe: {
    stat(p, st) { if (p.S.now - p.mvAt >= PFX.snipe.ms) st.atk = Math.round(st.atk * PFX.snipe.k); },
  },
  // 발진의: after dash, +9% ATK for 7s
  surge: {
    dash(S, rt, p) { pfxPc(p).t.surge = S.now + PFX.surge.ms; },
    stat(p, st) { if (pgOn(p, "surge")) st.atk = Math.round(st.atk * PFX.surge.k); },
  },
  // 결핍의: MP < 50% → +10% ATK
  scarcity: {
    stat(p, st) { if (p.mp < st.mmp * PFX.scarcity.mp) st.atk = Math.round(st.atk * PFX.scarcity.k); },
  },
  // 난투의: incoming damage drops by 3% per nearby enemy (up to -12%)
  scrum: {
    tick(S, rt, p) { pfxPc(p).v.scrum = runeNearMobs(rt, p, PFX.scrum.r); },
    miti(S, rt, p, st, mob, dmg, raw, r) {
      const n = p.pc && p.pc.v.scrum, c = PFX.scrum;
      if (n > 0) r.f *= 1 - Math.min(c.max, n * c.k);
    },
  },
  // 끈기의: taking a hit down to <= 50% HP grants -24% damage taken for 10s (30s ICD)
  tenacity: {
    hurt(S, rt, p, st, mob, dmg) {
      const c = PFX.tenacity;
      if (dmg > 0 && p.hp > 0 && p.hp <= st.mhp * c.hp && pfxIcd(S, p, "tenacity", c.icd)) {
        pfxPc(p).t.tenacity = S.now + c.ms;
      }
    },
    miti(S, rt, p, st, mob, dmg, raw, r) { if (pgOn(p, "tenacity")) r.f *= PFX.tenacity.k; },
  },
  // 지혜로운: trims 15% off a cast skill's cooldown
  wisdom: {
    skill(S, rt, p, st, sk, id) {
      const rem = (p.cds[id] || 0) - S.now;
      if (rem > 200) p.cds[id] = Math.max(S.now, Math.round(S.now + rem * PFX.wisdom.k));
    },
  },
  // 부동의: every 10s in combat +2% ATK & DEF (up to 5 stacks), resets when calm
  steadfast: {
    tick(S, rt, p, st, now, calm) {
      const c = PFX.steadfast, pc = pfxPc(p);
      if (calm) { pc.n.steadfast = 0; pc.v.steadfastAt = 0; return; }
      if (!pc.v.steadfastAt) { pc.v.steadfastAt = now; return; }
      if (now - pc.v.steadfastAt >= c.every) {
        pc.v.steadfastAt = now;
        pfxStack(p, "steadfast", 1, c.max);
      }
    },
    stat(p, st) {
      const n = p.pc && p.pc.n.steadfast;
      if (n > 0) {
        const f = 1 + n * PFX.steadfast.k;
        st.atk = Math.round(st.atk * f);
        st.def = Math.round(st.def * f);
      }
    },
  },
});
