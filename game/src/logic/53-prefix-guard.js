// ───────────────────────────── 접두사 고유 효과: defense, phase 1 (docs/design/prefix-effects.md §3.2) ─────────────────────────────
// 33 powers of the armor / boots / amulet / helm pools that need no phase-2 hook (thorn and feast are in 51-prefix.js). Three lines each, as
// 51-prefix.js teaches: the numbers (PFX), the tooltip row (LEGEND), the code (PFX_FN). Numbers are the design's first pass; a balance pass edits them here.
// Held back (no `on`): after, relax, chase, panic, slick: their move-speed half changes stats(p).spd, which the server only uses to check a walk; the client
// walks at its own speed (public/update.js), so until it reads the faster pace they would only promise what the player cannot feel.
// One shared edit: `p.hitHow` ("blow" "shot" "charge" "tele" "mv", "" outside mobHit) is set by 80-simulation.js mobHit around its hurtPlayer call, so a
// power can tell a melee blow (rime) or a marked area (foresee) apart.

const pgPct = (v) => +(v * 100).toFixed(1);
/** A timed buff of p (pfxPc(p).t[key]) is running. */
const pgOn = (p, key) => (pfxPc(p).t[key] || 0) > p.S.now;
/** The key's internal cooldown is over (it does not start it: pfxIcd does, once the power really fires). */
const pgReady = (S, p, key) => S.now >= (pfxPc(p).cd[key] || 0);
/** The blow that hurt p came from a red marked area: a ring, a line, a cone (not a melee blow, not a volley). */
const pgMarked = (p) => p.hitHow === "tele" || p.hitHow === "mv" || p.hitHow === "charge";
/** A monster no status of a prefix power moves: a boss, a 수문장 / 우두머리, a chest, a standing one. */
const pgFirm = (mob) => { const d = MOBS[mob.k]; return d.boss || d.still || d.chest || mob.el === 2; };

// ── mitigation: a blow after armour (MITI) ──────────────────────────────────────────────────────────────────────────────────────────────

// 껍질의: the proc uses the flat absorb budget so large hits still matter.
Object.assign(PFX, { bark: { on: 1, p: 0.15, k: 0.4 } });
Object.assign(LEGEND, { bark: ["껍질의", pfxText("bark", "피격 시 {p:%}% 확률로 그 피해를 {k:-%}% 줄인다"), "AH", "D", "M", "mit"] });
Object.assign(PFX_FN, { bark: { miti(S, rt, p, st, mob, dmg, raw, r) { if (pfxChance(S, st, PFX.bark.p)) r.abs += Math.round(dmg * (1 - PFX.bark.k)); } } });

// 포근한
Object.assign(PFX, { fur: { on: 1, hp: 0.9, k: 0.85 } });
Object.assign(LEGEND, { fur: ["포근한", pfxText("fur", "HP가 {hp:%}% 이상이면 받는 피해 -{k:-%}%"), "AN", "D", "S", "mit"] });
Object.assign(PFX_FN, { fur: { miti(S, rt, p, st, mob, dmg, raw, r) { if (p.hp >= st.mhp * PFX.fur.hp) r.f *= PFX.fur.k; } } });

// 불굴의
Object.assign(PFX, { last: { on: 1, hp: 0.3, k: 0.75 } });
Object.assign(LEGEND, { last: ["불굴의", pfxText("last", "HP {hp:%}% 이하일 때 받는 피해 -{k:-%}%"), "ABH", "D", "M", "mit"] });
Object.assign(PFX_FN, { last: { miti(S, rt, p, st, mob, dmg, raw, r) { if (p.hp <= st.mhp * PFX.last.hp) r.f *= PFX.last.k; } } });

// 굳건한
Object.assign(PFX, { gran: { on: 1, k: 0.85 } });   // (balance 2026-11-20: 0.88 → 0.85)
Object.assign(LEGEND, { gran: ["굳건한", pfxText("gran", "정예와 우두머리에게 받는 피해 -{k:-%}%"), "AB", "D", "M", "mit"] });
Object.assign(PFX_FN, { gran: { miti(S, rt, p, st, mob, dmg, raw, r) { if (mob && (mob.el || MOBS[mob.k].boss)) r.f *= PFX.gran.k; } } });

// 둔중한: what is beyond a share of max HP in one blow is cut
Object.assign(PFX, { stone: { on: 1, hp: 0.25, k: 0.5 } });
Object.assign(LEGEND, { stone: ["둔중한", pfxText("stone", "한 번에 최대 HP의 {hp:%}%를 넘는 피해는 초과분이 {k:-%}% 줄어든다"), "A", "D", "M", "mit"] });
Object.assign(PFX_FN, {
  stone: {
    miti(S, rt, p, st, mob, dmg, raw, r) {
      const c = PFX.stone, cap = st.mhp * c.hp;
      if (dmg > cap) r.f *= (cap + (dmg - cap) * c.k) / dmg;
    },
  },
});

// 수호의: the first blow after the wait is stopped (it shows as a dodge)
Object.assign(PFX, { ward: { on: 1, ms: 12000 } });
Object.assign(LEGEND, { ward: ["수호의", pfxText("ward", "{ms:s}초마다 한 번, 받는 첫 피해를 막아 낸다"), "ABNH", "D", "M", "mit"] });
Object.assign(PFX_FN, { ward: { miti(S, rt, p, st, mob, dmg, raw, r) { if (pfxIcd(S, p, "ward", PFX.ward.ms)) r.block = 1; } } });

// 연막의: a hit may leave p untouchable for a moment (a rare proc: the toast is fine)
Object.assign(PFX, { smoke: { on: 1, p: 0.08, ms: 1200, icd: 10000 } });
Object.assign(LEGEND, { smoke: ["연막의", pfxText("smoke", "피격 시 {p:%}% 확률로 {ms:s}초간 무적이 된다 ({icd:s}초 간격)"), "BN", "D", "M", "mit"] });
Object.assign(PFX_FN, {
  smoke: {
    hurt(S, rt, p, st) {
      const c = PFX.smoke;
      if (p.hp <= 0 || !pgReady(S, p, "smoke") || !pfxChance(S, st, c.p)) return;
      pfxIcd(S, p, "smoke", c.icd);
      p.ghost = Math.max(p.ghost || 0, S.now + c.ms);
      toast(p, "연막! 잠시 무적이 됩니다.");
    },
  },
});

// 예지의: a red marked area (see p.hitHow above)
Object.assign(PFX, { foresee: { on: 1, k: 0.7 } });
Object.assign(LEGEND, { foresee: ["예지의", pfxText("foresee", "붉은 예고 범위 공격에서 받는 피해 -{k:-%}%"), "ABH", "D", "M", "mit"] });
Object.assign(PFX_FN, { foresee: { miti(S, rt, p, st, mob, dmg, raw, r) { if (pgMarked(p)) r.f *= PFX.foresee.k; } } });

// 마나방벽의: MP takes a share of the blow while there is MP (the MP is paid in `hurt`, once the blow is known to land: a later 수호의 may still stop it)
Object.assign(PFX, { manawall: { on: 1, k: 0.25 } });
Object.assign(LEGEND, { manawall: ["마나방벽의", pfxText("manawall", "받는 피해의 {k:%}%를 MP가 대신 받는다 (MP가 있는 동안)"), "AN", "D", "M", "mit"] });
Object.assign(PFX_FN, {
  manawall: {
    miti(S, rt, p, st, mob, dmg, raw, r) {
      const v = pfxPc(p).v, take = r.block ? 0 : Math.min(p.mp, dmg * PFX.manawall.k);
      v.mw = take;
      if (take > 0) r.f *= 1 - take / dmg;
    },
    hurt(S, rt, p, st, mob, dmg) {
      const v = pfxPc(p).v;
      if (dmg > 0 && v.mw > 0) p.mp = Math.max(0, p.mp - v.mw);
      v.mw = 0;
    },
  },
});

// 뿌리내린: standing still
Object.assign(PFX, { root: { on: 1, ms: 1500, k: 0.85 } });
Object.assign(LEGEND, { root: ["뿌리내린", pfxText("root", "{ms:s}초 이상 멈춰 서 있으면 받는 피해 -{k:-%}%"), "BH", "D", "S", "mit"] });
Object.assign(PFX_FN, { root: { miti(S, rt, p, st, mob, dmg, raw, r) { if (S.now - p.mvAt >= PFX.root.ms) r.f *= PFX.root.k; } } });

// 올빼미의
Object.assign(PFX, { owl: { on: 1, k: 0.8 } });
Object.assign(LEGEND, { owl: ["올빼미의", pfxText("owl", "밤에 받는 피해 -{k:-%}%"), "NH", "D", "S", "mit"] });
Object.assign(PFX_FN, { owl: { miti(S, rt, p, st, mob, dmg, raw, r) { if (isNight(S.now)) r.f *= PFX.owl.k; } } });

// ── the stagger (the sheet) and the statuses ─────────────────────────────────────────────────────────────────────────────────────────────

// 버티는: the stagger and the shove both get shorter by `k` (what is left of them × k)
Object.assign(PFX, { heavy: { on: 1, k: 0.5 } });
Object.assign(LEGEND, { heavy: ["버티는", pfxText("heavy", "피격 경직 -{k:-%}%, 밀려나는 거리 -{k:-%}%"), "ABH", "D", "S", "mit"] });
Object.assign(PFX_FN, {
  heavy: {
    sheet(p, c) {
      c.poise = 1 - (1 - c.poise) * PFX.heavy.k;
      c.kbr = 1 - (1 - c.kbr) * PFX.heavy.k;
    },
  },
});

// 정화의: burn, poison and slow run shorter and bite softer
Object.assign(PFX, { purge: { on: 1, k: 0.5 } });
Object.assign(LEGEND, { purge: ["정화의", pfxText("purge", "독·화상·둔화의 지속시간과 피해가 {k:-%}% 줄어든다"), "ABNH", "D", "S", "mit"] });
Object.assign(PFX_FN, { purge: { status(S, p, st, kind, r) { r.f *= PFX.purge.k; } } });

// 맑은: a status is washed off after `ms` (the next second's tick) and then cannot be caught again for `imm`; `icd` between two cleanses
Object.assign(PFX, { cure: { on: 1, ms: 3000, imm: 8000, icd: 30000 } });
Object.assign(LEGEND, { cure: ["맑은", pfxText("cure", "독·화상·둔화에 걸리면 {ms:s}초 뒤 풀리고 {imm:s}초간 다시 걸리지 않는다 ({icd:s}초 간격)"), "BNH", "D", "S", "mit"] });
Object.assign(PFX_FN, {
  cure: {
    status(S, p, st, kind, r) {
      const c = PFX.cure, pc = pfxPc(p);
      if ((pc.t.cure || 0) > S.now) { r.f = 0; return; }   // the quiet after a cleanse
      if (pc.v.cure || !pgReady(S, p, "cure")) return;      // already counting down, or waiting out the interval
      pfxIcd(S, p, "cure", c.icd);
      pc.v.cure = S.now + c.ms;
    },
    tick(S, rt, p, st, now) {
      const pc = pfxPc(p);
      if (!pc.v.cure || now < pc.v.cure) return;
      pc.v.cure = 0;
      pc.t.cure = now + PFX.cure.imm;
      p.burn = null; p.poison = null; p.slowed = 0; p.dirty = true;
      elementClear(p, "poison", "burn", "chill", "freeze");
      toast(p, "몸이 맑아졌습니다. 독·화상·둔화가 씻겨 나갔습니다.");
    },
  },
});

// 미끄러운 (held): no slow at all, and a quicker step on getting up from a stagger (p.stag is when it ends; the window follows it)
Object.assign(PFX, { slick: { on: 1, ms: 1000, spd: 1.3 } });
Object.assign(LEGEND, { slick: ["미끄러운", pfxText("slick", "둔화에 걸리지 않고, 경직에서 일어나면 {ms:s}초간 이동속도 +{spd:+%}%"), "B", "D", "S", "mob"] });
Object.assign(PFX_FN, {
  slick: {
    status(S, p, st, kind, r) { if (kind === "slow") r.f = 0; },
    stat(p, st) { const n = p.S.now, g = p.stag || 0; if (g && n >= g && n < g + PFX.slick.ms) st.spd *= PFX.slick.spd; },
  },
});

// ── answering a blow (HURT) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

// 서리갑옷의: a melee attacker is slowed (not a shooter, a boss or a 우두머리; one at a time: icd)
Object.assign(PFX, { rime: { on: 1, p: 0.3, ms: 2000, icd: 1000 } });
Object.assign(LEGEND, { rime: ["서리갑옷의", pfxText("rime", "근접 피격 시 {p:%}% 확률로 공격한 적을 {ms:s}초간 둔화시킨다"), "AB", "D", "S", "mit"] });
Object.assign(PFX_FN, {
  rime: {
    hurt(S, rt, p, st, mob) {
      const c = PFX.rime;
      if (!mob || mob.dead || p.hp <= 0 || p.hitHow !== "blow" || pgFirm(mob)) return;
      const d = MOBS[mob.k];
      if (d.shot || d.volley || !pgReady(S, p, "rime") || !pfxChance(S, st, c.p)) return;
      pfxIcd(S, p, "rime", c.icd);
      mob.slow = Math.max(mob.slow || 0, S.now + c.ms);
    },
  },
});

// 되받는: the attacker is struck back for k × attack (a prefix blow: it starts no other power)
Object.assign(PFX, { counter: { on: 1, p: 0.25, k: 1.5, icd: 2000 } });
Object.assign(LEGEND, { counter: ["되받는", pfxText("counter", "피격 시 {p:%}% 확률로 공격한 적에게 공격력의 {k:%}% 반격 ({icd:s}초 간격)"), "AB", "D", "M", "mit"] });
Object.assign(PFX_FN, {
  counter: {
    hurt(S, rt, p, st, mob) {
      const c = PFX.counter;
      if (!mob || mob.dead || p.hp <= 0 || !pgReady(S, p, "counter") || !pfxChance(S, st, c.p)) return;
      pfxIcd(S, p, "counter", c.icd);
      rt.ev.push(["z", Math.round(p.x), Math.round(p.y - 6), Math.round(mob.x), Math.round(mob.y - 6), 0]);
      hurtMob(S, rt, mob, p, c.k, false, PX);
    },
  },
});

// 불사의: the fall is stopped once in a long while (a rare proc: the toast is fine)
Object.assign(PFX, { fate: { on: 1, ms: 3000, icd: 360000 } });
Object.assign(LEGEND, { fate: ["불사의", `치명상을 입으면 HP 1로 버티고 ${PFX.fate.ms / 1000}초간 무적이 된다 (${PFX.fate.icd / 60000}분 간격)`, "AN", "D", "L", "mit"] });
Object.assign(PFX_FN, {
  fate: {
    lethal(S, rt, p) {
      if (!pgReady(S, p, "fate")) return false;
      pfxIcd(S, p, "fate", PFX.fate.icd);
      p.hp = 1;
      p.ghost = Math.max(p.ghost || 0, S.now + PFX.fate.ms);
      toast(p, "불사의 힘! HP 1로 버텨 냈습니다.");
      return true;
    },
  },
});

// 다급한 (held): low HP starts a short rush and a thinner blow
Object.assign(PFX, { panic: { on: 1, hp: 0.35, ms: 5000, spd: 1.3, k: 0.85, icd: 60000 } });
Object.assign(LEGEND, { panic: ["다급한", pfxText("panic", "HP가 {hp:%}% 이하로 떨어지면 {ms:s}초간 이동속도 +{spd:+%}%, 받는 피해 -{k:-%}% ({icd:s}초 간격)"), "AB", "D", "M", "mob"] });
Object.assign(PFX_FN, {
  panic: {
    hurt(S, rt, p, st) {
      const c = PFX.panic;
      if (p.hp <= 0 || p.hp > st.mhp * c.hp || !pgReady(S, p, "panic")) return;
      pfxIcd(S, p, "panic", c.icd);
      pfxPc(p).t.panic = S.now + c.ms;
      toast(p, "다급한 힘! 잠시 빨라지고 덜 아픕니다.");
    },
    miti(S, rt, p, st, mob, dmg, raw, r) { if (pgOn(p, "panic")) r.f *= PFX.panic.k; },
    stat(p, st) { if (pgOn(p, "panic")) st.spd *= PFX.panic.spd; },
  },
});

// 비상의: a one-shot heal outside the per-second budget, limited by its long internal cooldown.
Object.assign(PFX, { emerg: { on: 1, hp: 0.3, k: 0.2, icd: 90000 } });
Object.assign(LEGEND, { emerg: ["비상의", pfxText("emerg", "HP가 {hp:%}% 이하가 되면 즉시 최대 HP의 {k:%}% 회복 ({icd:s}초 간격)"), "ABNH", "D", "M", "sus"] });
Object.assign(PFX_FN, {
  emerg: {
    hurt(S, rt, p, st) {
      const c = PFX.emerg;
      if (p.hp <= 0 || p.hp > st.mhp * c.hp || !pgReady(S, p, "emerg")) return;
      pfxIcd(S, p, "emerg", c.icd);
      const n = Math.min(st.mhp - p.hp, st.mhp * c.k * elementHealFactor(S, p));
      p.hp += n;
      rt.ev.push(["h", p.eid, -Math.round(n), 0, 1]);
      toast(p, "비상! 체력이 크게 회복되었습니다.");
    },
  },
});

// ── the dash and the dodge (DASH / EVADE) ────────────────────────────────────────────────────────────────────────────────────────────────

// 스치는
Object.assign(PFX, { wisp: { on: 1, k: 0.75 } });
Object.assign(LEGEND, { wisp: ["스치는", pfxText("wisp", "대시 재사용 대기시간 -{k:-%}%"), "B", "D", "M", "mob"] });
Object.assign(PFX_FN, { wisp: { num(p, name, v) { return name === "dashCd" ? v * PFX.wisp.k : v; } } });

// 흙먼지의: where a dash ends, the ones near stagger (at most `n`; nobody firm; the wait starts only when something was caught)
Object.assign(PFX, { dust: { on: 1, r: 40, ms: 600, icd: 6000, n: 4 } });
Object.assign(LEGEND, { dust: ["흙먼지의", pfxText("dust", "대시 도착 지점 반경 {r}의 적이 {ms:s}초 경직 (우두머리 제외, {icd:s}초 간격)"), "B", "D", "S", "mob"] });
Object.assign(PFX_FN, {
  dust: {
    dash(S, rt, p, st, x0, y0, x, y) {
      const c = PFX.dust;
      if (!pgReady(S, p, "dust")) return;
      const hit = mobsWithin(rt, x, y, c.r).filter((o) => !pgFirm(o) && !steady(S, o)).slice(0, c.n);
      if (!hit.length) return;
      pfxIcd(S, p, "dust", c.icd);
      rt.ev.push(["b", Math.round(x), Math.round(y), c.r, 3]);
      for (const o of hit) holdMob(S, o, c.ms);
    },
  },
});

// 잔상의 (held)
Object.assign(PFX, { after: { on: 1, ms: 1500, spd: 1.25 } });
Object.assign(LEGEND, { after: ["잔상의", pfxText("after", "대시 직후 {ms:s}초간 이동속도 +{spd:+%}%"), "B", "D", "S", "mob"] });
Object.assign(PFX_FN, {
  after: {
    dash(S, rt, p) { pfxPc(p).t.after = S.now + PFX.after.ms; },
    stat(p, st) { if (pgOn(p, "after")) st.spd *= PFX.after.spd; },
  },
});

// 날렵한: a dodge (DEX or the dash's i-frames) heals a little
Object.assign(PFX, { nimble: { on: 1, k: 0.02, icd: 1000 } });
Object.assign(LEGEND, { nimble: ["날렵한", pfxText("nimble", "공격을 피하면 (회피·대시 무적) 최대 HP의 {k:%}% 회복 ({icd:s}초 간격)"), "BN", "D", "S", "sus"] });
Object.assign(PFX_FN, { nimble: { evade(S, rt, p, st) { if (pfxIcd(S, p, "nimble", PFX.nimble.icd)) pfxHeal(S, p, st, st.mhp * PFX.nimble.k); } } });

// 반사신경의: a dodge sharpens the next blows
Object.assign(PFX, { reflex: { on: 1, ms: 2000, k: 1.15 } });
Object.assign(LEGEND, { reflex: ["반사신경의", pfxText("reflex", "공격을 피하면 {ms:s}초간 공격력 +{k:+%}%"), "B", "D", "S", "mob"] });
Object.assign(PFX_FN, {
  reflex: {
    evade(S, rt, p) { pfxPc(p).t.reflex = S.now + PFX.reflex.ms; },
    stat(p, st) { if (pgOn(p, "reflex")) st.atk *= PFX.reflex.k; },
  },
});

// 한가로운 (held): no hit for `ms`
Object.assign(PFX, { relax: { on: 1, ms: 5000, spd: 1.15 } });
Object.assign(LEGEND, { relax: ["한가로운", pfxText("relax", "{ms:s}초 넘게 피격이 없으면 이동속도 +{spd:+%}%"), "B", "D", "S", "mob"] });
Object.assign(PFX_FN, { relax: { stat(p, st) { if (p.S.now - p.hitAt > PFX.relax.ms) st.spd *= PFX.relax.spd; } } });

// 추격의 (held): a kill starts a short rush
Object.assign(PFX, { chase: { on: 1, ms: 3000, spd: 1.2 } });
Object.assign(LEGEND, { chase: ["추격의", pfxText("chase", "처치 후 {ms:s}초간 이동속도 +{spd:+%}%"), "B", "D", "S", "mob"] });
Object.assign(PFX_FN, {
  chase: {
    kill(S, rt, p) { pfxPc(p).t.chase = S.now + PFX.chase.ms; },
    stat(p, st) { if (pgOn(p, "chase")) st.spd *= PFX.chase.spd; },
  },
});

// ── sustain: kills, the second, potions (KILL / TICK / POT) ──────────────────────────────────────────────────────────────────────────────

// 나눔의: a kill heals the party near the killer (not the killer: 포식자의 does that), each by their own max HP, through their own heal budget
Object.assign(PFX, { share: { on: 1, r: 160, k: 0.03 } });
Object.assign(LEGEND, { share: ["나눔의", pfxText("share", "처치 시 근처(반경 {r}) 파티원의 HP를 최대 HP의 {k:%}% 회복"), "NH", "D", "S", "sus"] });
Object.assign(PFX_FN, {
  share: {
    kill(S, rt, p) {
      const c = PFX.share;
      for (const o of members(S, p)) {
        if (o === p || o.dead || o.map !== p.map || dist(o.x, o.y, p.x, p.y) > c.r) continue;
        const so = stats(o);
        pfxHeal(S, o, so, so.mhp * c.k);
      }
    },
  },
});

// 샘물의
Object.assign(PFX, { spring: { on: 1, hp: 0.5, k: 0.012 } });
Object.assign(LEGEND, { spring: ["샘물의", `HP ${pgPct(PFX.spring.hp)}% 이하면 매초 최대 HP의 ${pgPct(PFX.spring.k)}% 회복`, "AN", "D", "M", "sus"] });
Object.assign(PFX_FN, { spring: { tick(S, rt, p, st) { if (p.hp <= st.mhp * PFX.spring.hp) pfxHeal(S, p, st, st.mhp * PFX.spring.k); } } });

// 약사의
Object.assign(PFX, { pot: { on: 1, k: 1.35 } });
Object.assign(LEGEND, { pot: ["약사의", pfxText("pot", "물약 회복량 +{k:+%}%"), "NH", "D", "M", "sus"] });
Object.assign(PFX_FN, { pot: { pot(S, p, st, amt) { return amt * PFX.pot.k; } } });

// 달이는: a potion starts a few seconds of slow healing (pc.n.elixir counts the seconds left)
Object.assign(PFX, { elixir: { on: 1, ms: 6000, k: 0.015 } });   // (balance 2026-11-20: 6 % → 9 % a potion)
Object.assign(LEGEND, { elixir: ["달이는", pfxText("elixir", "물약 사용 후 {ms:s}초간 매초 최대 HP의 {k:%}% 회복"), "N", "D", "S", "sus"] });
Object.assign(PFX_FN, {
  elixir: {
    pot(S, p, st, amt) { pfxPc(p).n.elixir = Math.round(PFX.elixir.ms / 1000); return amt; },
    tick(S, rt, p, st) {
      const n = pfxPc(p).n;
      if (!(n.elixir > 0)) return;
      n.elixir--;
      pfxHeal(S, p, st, st.mhp * PFX.elixir.k);
    },
  },
});

// 명상의: MP while standing still
Object.assign(PFX, { med: { on: 1, ms: 2000, k: 0.02 } });
Object.assign(LEGEND, { med: ["명상의", pfxText("med", "{ms:s}초 넘게 멈춰 서 있으면 매초 MP {k:%}% 회복"), "NH", "D", "S", "sus"] });
Object.assign(PFX_FN, { med: { tick(S, rt, p, st, now) { if (now - p.mvAt > PFX.med.ms && p.mp < st.mmp) p.mp = Math.min(st.mmp, p.mp + st.mmp * PFX.med.k); } } });

// 이끼의: more regen while no one hits p (calm = 5 s without a hit)
Object.assign(PFX, { moss: { on: 1, k: 0.015 } });
Object.assign(LEGEND, { moss: ["이끼의", `5초 넘게 피격이 없으면 매초 HP ${pgPct(PFX.moss.k)}% 추가 회복`, "AN", "D", "S", "sus"] });
Object.assign(PFX_FN, { moss: { tick(S, rt, p, st, now, calm) { if (calm) pfxHeal(S, p, st, st.mhp * PFX.moss.k); } } });
