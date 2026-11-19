// ───────────────────────────── 접두사 고유 효과: the machinery (docs/design/prefix-effects.md) ─────────────────────────────
// A 전설 / 유니크 carries one power `lg`. This part holds what runs it: the hook dispatchers the combat code calls, the caps of
// design §5, the per-player state `p.pc`, the roll (pfxPick), the winner rule's helpers, and the code of today's eight powers.
// The tables (PFX numbers, LEGEND rows, PFX_W, SLOT_L, pfxText) are in 10-tables.js.
//
// ADDING POWERS (never edit a shared file): put them in a NEW part, a name with a two-digit prefix of 52 or more
// (52-prefix-blow.js, 53-prefix-guard.js …: the build loads parts in name order, so this part's tables exist when yours runs), and write
//   Object.assign(PFX, { frost: { p: 0.15, ms: 1200, elite: 0.5 } });     // its numbers; add `on: 1` when code and test are done (until then it never drops)
//   Object.assign(LEGEND, { frost: ["빙결의", pfxText("frost", "공격 시 {p:%}% 확률로 적을 {ms:s}초 얼린다"), "WG", "O", "M", "blow"] });
//   Object.assign(PFX_FN, { frost: { blow(S, rt, p, st, mob, x, y, fin, skip) { … } } });   // its code: only the hooks it needs
// (a statement in a part runs at load, so these three lines are all the registration there is; PFX first, pfxText reads it.)
//
// HOOKS (a PFX_FN[key] member; PFX_HOOKS lists them). `st` is stats(p), `rt` the map runtime, `o` the hurtMob options of the blow, `mob`/`d` the monster and
// MOBS[mob.k]. A hook runs only while its power counts (the winning piece of the key, 51 gearBonus) and only for the hooks it defines.
//   pre(S, p, st, mob, d, o, r)             before a blow rolls; r.ign (share of armour ignored, 0–1), r.crit (+% crit chance), r.sure (1 = a sure crit)
//   mul(S, p, st, mob, d, o, crit)          → a damage factor > 0; all factors multiply up to PFX_CAP.dmg
//   hit(S, rt, p, st, mob, dmg, crit, killed, o)   a blow of any kind landed (skills too); NOT for a `px` blow. crit(…same) too, only on a crit
//   kill(S, rt, p, st, mob, x, y, o)        the blow killed mob (it stood at x, y); also for a `px` blow (heals and resources still count)
//   blow(S, rt, p, st, mob, x, y, fin, skip)  a BASIC blow landed (melee, missile, orb, plain arrow, hammer); fin = combo finisher; skip = mobs it already struck, or undefined
//   skill(S, rt, p, st, sk, id, cost)       a skill was cast (MP paid, p.cds[id] set)
//   miti(S, rt, p, st, mob, dmg, raw, r)    an incoming blow (dmg after armour; mob null = a marked area): r.f *= x, r.abs += n, r.block = 1; limits in PFX_CAP
//   hurt(S, rt, p, st, mob, dmg, raw)       after the HP was taken (also when p is about to fall)
//   lethal(S, rt, p, st, mob, dmg)          p.hp <= 0: return true if you kept p alive (p.hp is raised to 1 if you left it ≤ 0)
//   dash(S, rt, p, st, x0, y0, x, y)        a dash went; evade(S, rt, p, st, how)   a blow was dodged, how "eva" (DEX) or "dash" (i-frames)
//   tick(S, rt, p, st, now, calm)           once a second while p lives; calm = no hit for 5 s
//   status(S, p, st, kind, r)               a burn / poison / slow is put on p: r.f *= x shortens it and its bite; r.f = 0 refuses it
//   pot(S, p, st, amt) → amt                a healing potion's heal; loot(S, rt, p, st, mob, r, kind) kind "xp" | "drop": r.xp / r.gold / r.mf (+%), r.gx (extra multiples of the kill's gold), r.stone (+1)
//   stat(p, st, r)                          every stats(p) call (the moment's numbers: change fields of st; r.iv *= x quickens the attack, floor ×0.8 and 45 % of the weapon's wait). Cheap; never call stats(p) here
//   sheet(p, c, b)                          deriveStats (cached with the gear): change fields of c (poise, kbr, res …); b = gearBonus
//   num(p, name, v) → v                     a named number: "loss" (xp lost at death) "recall" (ms) "pet" (ms) "mp" (a skill's MP) "dashCd" (ms) "rest" (campfire regen a second)
// STATE: pfxPc(p) = { cd, n, t, v, heal, aura? }, in memory only: cd {key: ready-at} (pfxIcd), n {key: count} (pfxStack), t {key: until} (a timed buff), v {key: anything};
// n, t, v, heal reset when p changes map or falls, cd does not (a 6-minute cheat death cannot be reset by walking through a gate). Relogging resets all.
// RULES: chances are rnd(S) < base × min(st.proc, 1.5) (pfxChance); a power that can fire more than once a second takes an ICD ≥ 1 s (pfxIcd); damage a power
// deals goes through hurtMob(S, rt, mob, p, mult, false, PX) (a `px` blow never starts another power); heals go through pfxHeal;
// statuses skip bosses and elite=2 and honour holdMob; write determinism-clean code (rnd(S), S.now).

/** The hook names a PFX_FN member may define. */
const PFX_HOOKS = ["pre", "mul", "hit", "crit", "kill", "blow", "skill", "miti", "hurt", "lethal", "dash", "evade", "tick", "status", "pot", "loot", "stat", "sheet", "num"];
/** The caps of design §5: dmg (all prefix damage factors), iv (their attack-interval factor) and acd (× the weapon's wait, the floor), miti (the damage-taken factor floor),
 * abs (absorb, × mhp), heal (× mhp a second), xp (+%), gold (+%, with the static gold of PFX[k].gold), proc (LUK's most). */
const PFX_CAP = { dmg: 1.36, iv: 0.8, acd: 0.45, miti: 0.68, abs: 0.14, heal: 0.05, xp: 15, gold: 100, proc: 1.5 };
/** The hurtMob options of a blow a power dealt: it starts no other power's chance, status or crit effect. */
const PX = Object.freeze({ px: 1 });

// ── what a player's gear gives (cached with the sheet in p.stc: deriveStats)
/** The active powers' code by hook: equipment powers in slot order, then eligible rune sets. */
function pfxBuild(lg, runeSets = []) {
  const h = {};
  for (const n of PFX_HOOKS) h[n] = [];
  for (const key in lg) {
    const f = Object.hasOwn(PFX_FN, key) ? PFX_FN[key] : null;
    if (!f || (PFX[key] && PFX[key].off)) continue;
    for (const n of PFX_HOOKS) if (typeof f[n] === "function") h[n].push(f[n]);
  }
  for (const key of runeSets) {
    const f = RUNE_SET_FN[key];
    for (const n of PFX_HOOKS) if (typeof f[n] === "function") {
      // Resolve a set's instant reset or full revive before trying the equipment fallback.
      if (n === "lethal" || n === "skill") h[n].unshift(f[n]);
      else h[n].push(f[n]);
    }
  }
  return h;
}
/** The attack-interval factor of the active powers that carry a static `iv` (질주의 0.85), read before the sheet's rounding. */
function pfxIv(lg) {
  let m = 1;
  for (const k in lg) if (PFX[k] && !PFX[k].off && PFX[k].iv) m *= PFX[k].iv;
  return m;
}
/** The gold % the active powers carry as a static `gold` (황금손의 60). */
function pfxGold(lg) {
  let g = 0;
  for (const k in lg) if (PFX[k] && !PFX[k].off && PFX[k].gold) g += PFX[k].gold;
  return g;
}
/** The `lg` a new 전설 / 유니크 of this item type rolls: the live powers (PFX.on) whose slots hold its letter, weighted by rating (PFX_W), one rnd(S). */
function pfxPick(S, type) {
  const L = SLOT_L[type], live = (k) => PFX[k] && PFX[k].on && !PFX[k].off;
  let pool = Object.keys(LEGEND).filter((k) => live(k) && (!L || LEGEND[k][2].includes(L)));
  if (!pool.length) pool = Object.keys(LEGEND).filter(live);
  const w = (k) => PFX_W[LEGEND[k][4]] || 1;
  let r = rnd(S) * pool.reduce((s, k) => s + w(k), 0);
  for (const k of pool) { r -= w(k); if (r < 0) return k; }
  return pool[pool.length - 1];
}

// ── per-player state (in memory only; see STATE above)
const pfxPc = (p) => p.pc || (p.pc = { cd: {}, n: {}, t: {}, v: {}, heal: [0, 0] });
/** Stacks, timed buffs and the heal window go when p changes map or falls (cooldown stamps stay). */
function pfxReset(p) {
  const c = p.pc;
  if (c) { c.n = {}; c.t = {}; c.v = {}; c.heal = [0, 0]; }
}
/** True (and the key is on cooldown for `ms`) when its internal cooldown is over. */
function pfxIcd(S, p, key, ms) {
  const cd = pfxPc(p).cd;
  if (S.now < (cd[key] || 0)) return false;
  cd[key] = S.now + ms;
  return true;
}
/** A counter: add `add` (0 reads), never above `max`; returns it. Set pfxPc(p).n[key] = 0 to clear. */
function pfxStack(p, key, add = 1, max = Infinity) {
  const n = pfxPc(p).n;
  return (n[key] = Math.min(max, (n[key] || 0) + add));
}
/** A proc roll: `base` × LUK's proc factor (at most ×1.5), one rnd(S). */
const pfxChance = (S, st, base) => rnd(S) < base * Math.min(st.proc, PFX_CAP.proc);
/** Heal p by up to `amt` HP within the shared per-second prefix and rune budget; returns the amount healed. */
function pfxHeal(S, p, st, amt) {
  const w = pfxPc(p).heal;
  if (S.now - w[0] >= 1000) { w[0] = S.now; w[1] = 0; }
  const n = Math.max(0, Math.min(amt * elementHealFactor(S, p), st.mhp * PFX_CAP.heal - w[1], st.mhp - p.hp));
  p.hp += n; w[1] += n;
  return n;
}

// ── the dispatchers (a hook list is empty for most players: every one returns at once then)
const PFX_R0 = Object.freeze({ ign: 0, crit: 0, sure: 0, pure: 0, xp: 0, gold: 0, mf: 0, gx: 0, stone: 0 });
const pfxPreR = { ign: 0, crit: 0, sure: 0, pure: 0 }, pfxMiR = { f: 1, abs: 0, block: 0 }, pfxStR = { iv: 1, riv: 1 }, pfxStaR = { f: 1 };

/** Before a blow rolls → { ign, crit, sure } (read them at once: the object is reused). The crit it adds keeps the total under SFX.critCap. */
function pfxPre(S, p, st, mob, d, o) {
  const a = st.pfx.pre;
  if (!a.length) return PFX_R0;
  const r = pfxPreR;
  r.ign = 0; r.crit = 0; r.sure = 0; r.pure = 0;
  for (let i = 0; i < a.length; i++) a[i](S, p, st, mob, d, o, r);
  r.crit = Math.max(0, Math.min(r.crit, SFX.critCap - st.crit));
  return r;
}
/** The damage factor of the active powers: one product, capped. */
function pfxMul(S, p, st, mob, d, o, crit) {
  const a = st.pfx.mul;
  if (!a.length) return 1;
  let m = 1;
  for (let i = 0; i < a.length; i++) { const v = a[i](S, p, st, mob, d, o, crit); if (v > 0) m *= v; }
  return Math.min(m, PFX_CAP.dmg);
}
/** A blow landed (hurtMob, not for a `px` blow): `hit`, and `crit` on a crit. */
function pfxHit(S, rt, p, st, mob, dmg, crit, killed, o) {
  const a = st.pfx.hit;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, mob, dmg, crit, killed, o);
  if (!crit) return;
  const c = st.pfx.crit;
  for (let i = 0; i < c.length; i++) c[i](S, rt, p, st, mob, dmg, crit, killed, o);
}
function pfxKill(S, rt, p, st, mob, x, y, o) {
  const a = st.pfx.kill;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, mob, x, y, o);
}
function pfxBlow(S, rt, p, st, mob, x, y, fin, skip) {
  const a = st.pfx.blow;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, mob, x, y, fin, skip);
}
function pfxSkill(S, rt, p, st, sk, id, cost) {
  const a = st.pfx.skill;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, sk, id, cost);
}
/** An incoming blow of `dmg` (after armour) → what p takes after the shared mitigation and flat absorb limits; 0 = stopped. */
function pfxMiti(S, rt, p, st, mob, dmg, raw) {
  const a = st.pfx.miti, au = p.pc && p.pc.aura;   // (au: a party member's 후광의 lays { f, until } on p.pc.aura from its tick, 54-prefix-util.js)
  if (!a.length && !au) return dmg;
  const r = pfxMiR;
  r.f = 1; r.abs = 0; r.block = 0;
  if (au && S.now < au.until) r.f *= au.f;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, mob, dmg, raw, r);
  if (r.block) return 0;
  return Math.max(0, Math.round(dmg * Math.min(1, Math.max(PFX_CAP.miti, r.f))) - Math.min(r.abs, st.mhp * PFX_CAP.abs));
}
function pfxHurt(S, rt, p, st, mob, dmg, raw) {
  const a = st.pfx.hurt;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, mob, dmg, raw);
}
/** Is p's fall stopped? (the first power that says so wins; its HP is at least 1) */
function pfxLethal(S, rt, p, st, mob, dmg) {
  const a = st.pfx.lethal;
  for (let i = 0; i < a.length; i++) if (a[i](S, rt, p, st, mob, dmg)) { if (p.hp < 1) p.hp = 1; return true; }
  return false;
}
function pfxDash(S, rt, p, x0, y0, x, y) {
  const a = deriveStats(p).pfx.dash;
  if (!a.length) return;
  const st = stats(p);
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, x0, y0, x, y);
}
function pfxEvade(S, rt, p, how) {
  const a = deriveStats(p).pfx.evade;
  if (!a.length) return;
  const st = stats(p);
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, how);
}
function pfxTick(S, rt, p, st, now, calm) {
  const a = st.pfx.tick;
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, now, calm);
}
/** The factor on a status's length and bite (1 = as is, 0 = refused). */
function pfxStatus(S, p, kind) {
  const a = deriveStats(p).pfx.status;
  if (!a.length) return 1;
  const st = stats(p), r = pfxStaR;
  r.f = 1;
  for (let i = 0; i < a.length; i++) a[i](S, p, st, kind, r);
  return Math.max(0, r.f);
}
/** A potion's heal after the powers that raise it. */
function pfxPot(S, p, st, amt) {
  const a = st.pfx.pot;
  for (let i = 0; i < a.length; i++) { const v = a[i](S, p, st, amt); if (v >= 0) amt = v; }
  return amt;
}
/** What the powers add to a kill's loot for p (`kind` "xp" | "drop") → { xp, gold, mf, gx, stone }, capped (xp +15 %, gold +100 % with the static gold, 1 stone). */
function pfxLoot(S, rt, p, mob, kind) {
  const a = deriveStats(p).pfx.loot;
  if (!a.length) return PFX_R0;
  const st = stats(p), r = { ign: 0, crit: 0, sure: 0, xp: 0, gold: 0, mf: 0, gx: 0, stone: 0 };
  for (let i = 0; i < a.length; i++) a[i](S, rt, p, st, mob, r, kind);
  r.xp = Math.min(r.xp, PFX_CAP.xp);
  r.gold = Math.min(r.gold, Math.max(0, PFX_CAP.gold - pfxGold(st.lg)));
  r.stone = Math.min(r.stone, 1);
  return r;
}
/** The moment's stats after the powers that change them (called by stats(p) when there are any). */
function pfxStat(p, st) {
  const a = st.pfx.stat, acd0 = st.acd, r = pfxStR;
  r.iv = 1;
  r.riv = 1;
  for (let i = 0; i < a.length; i++) a[i](p, st, r);
  if (r.iv < 1 || r.riv < 1) st.acd = Math.max(Math.round(st.acd * Math.max(PFX_CAP.iv, r.iv) * r.riv), Math.min(acd0, Math.round(st.arm.cd * PFX_CAP.acd)));
}
/** A named number after the powers that change it (see `num` above). */
function pfxNum(p, name, v) {
  const a = deriveStats(p).pfx.num;
  for (let i = 0; i < a.length; i++) { const r = a[i](p, name, v); if (Number.isFinite(r)) v = r; }
  return v;
}

// ── the code of the powers that were there first (numbers: PFX in 10-tables.js)
const PFX_FN = {
  // 뇌명의: a basic blow now and then leaps on to two more near it (the hammer skips what it struck)
  chain: {
    blow(S, rt, p, st, mob, x, y, fin, skip) {
      const c = PFX.chain;
      if (!(rnd(S) < c.p * st.proc)) return;
      const opt = { ...PX, elem: "lightning", typedOnly: true };
      for (const o of mobsWithin(rt, x, y, c.r).filter((o) => o !== mob && !(skip && skip.includes(o))).slice(0, c.n)) {
        rt.ev.push(["z", Math.round(x), Math.round(y - 6), Math.round(o.x), Math.round(o.y - 6), 0]);
        hurtMob(S, rt, o, p, c.k, false, opt);
      }
    },
  },
  // 폭렬의: a kill bursts and hurts what stands near (a burst's own kills do not burst again)
  nova: {
    kill(S, rt, p, st, mob, x, y) {
      const c = PFX.nova, opt = { ...PX, elem: "fire", typedOnly: true };
      if (p.chainKill || S.now < (p.pc?.cd.nova || 0)) return;
      const targets = mobsWithin(rt, x, y, c.r)
        .sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y) || a.id - b.id)
        .slice(0, c.n);
      if (!targets.length || !pfxIcd(S, p, "nova", c.icd)) return;
      p.chainKill = true;
      rt.ev.push(["b", Math.round(x), Math.round(y), c.r, 1]);
      for (const o of targets) if (!o.dead) hurtMob(S, rt, o, p, c.k, false, opt);
      p.chainKill = false;
    },
  },
  // 질주의 (PFX.haste.iv) and 황금손의 (PFX.greed.gold) are plain numbers read by deriveStats and gearBonus
  haste: {},
  greed: {},
  // 거인 사냥꾼의
  giant: { mul(S, p, st, mob, d) { return mob.el || d.boss ? PFX.giant.k : 1; } },
  // 메아리의: a skill's wait may vanish
  echo: {
    skill(S, rt, p, st, sk, id) {
      const c = PFX.echo, reset = S.now + c.ms;
      if (!(p.cds[id] > reset) || S.now < (p.pc?.cd.echo || 0) || !pfxChance(S, st, c.p)) return;
      if (!pfxIcd(S, p, "echo", c.icd)) return;
      p.cds[id] = reset;
      toast(p, `메아리! [${sk.name}] 재사용 대기시간 감소`);
    },
  },
  // 가시의: part of what p takes goes back to the one who struck
  thorn: { hurt(S, rt, p, st, mob, dmg) { if (mob) dealMob(S, rt, mob, p, Math.max(1, Math.round(dmg * PFX.thorn.k)), 0); } },
  // 포식자의 shares the sustain budget with the other repeatable kill and hit heals.
  feast: { kill(S, rt, p, st) { if (!p.dead) pfxHeal(S, p, st, st.mhp * PFX.feast.k); } },
};
