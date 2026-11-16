// ───────────────────────────── 접두사 고유 효과: helm utility (8) + phase-2 powers (8) ─────────────────────────────
// docs/design/prefix-effects.md §3.3 and the `단` = 2 rows of §3; the recipe and hook signatures are in the header of 51-prefix.js.
//   helm utility   trace 추적자의 · sage 현자의 · mercy 자비로운 · homing 귀소의 · clever 영리한 · treasure 보물눈의 · tame 길들이는 · hearth 화덕의
//   phase 2        DOT2 bleed 출혈의 · bile 담즙의   ABS carap 갑각의 · bastion 방벽의   AURA halo 후광의 · pack 무리의   ZN hellfire 지옥불의 · blizzard 눈보라의
// How the phase-2 pieces work:
//  · DOT2: a second damage-over-time slot that never touches the dagger's `mob.dot`. The wearer keeps its victims in `pfxPc(p).v[key]` (≤ DOT_MAX, a monster once)
//    and pays them in its own 1 s `tick`, using the existing bleed/poison status display and typed damage. It stops when p falls or leaves the map.
//  · ABS: a shield kept in `pfxPc(p).v[key]` until `pfxPc(p).t[key]`, offered through `miti`'s `r.abs` (shieldOffer: never past the blow, never past the
//    20 % cap the dispatcher enforces, and it shrinks by what it took).
//  · AURA: 후광의 lays `p.pc.aura = { f, until }` on every party member in range from its tick (pfxMiti reads it: the one edit in 51-prefix.js);
//    무리의 only counts the party about it once a second (`v.pack`) and its `stat` hook reads the count.
//  · ZN: a zone `rt.zones.push({ …, px: 1, pfx: key })`, one per player and key (a new one replaces the old). 눈보라의's slow is not the zone's `slow` flag
//    (that one slows bosses too): it is laid at the cast and kept up by the tick, and skips bosses, guardians and rooted things (design §5).

Object.assign(PFX, {
  trace: { on: 1, xp: 15 },   // the shared prefix xp cap is +15 (prefix-effects §5): 25 only promised more than it gave
  sage: { on: 1, xp: 8 },
  mercy: { on: 1, k: 0.5 },
  homing: { on: 1, k: 0.5 },
  clever: { on: 1, k: 0.85 },
  treasure: { on: 1, mf: 50 },
  tame: { on: 1, sp: 2 },
  hearth: { on: 1, k: 0.5 },
  bleed: { on: 1, ms: 4000, k: 0.15 },
  bile: { on: 1, p: 0.2, ms: 5000, k: 0.1, icd: 1000 },
  carap: { on: 1, k: 0.03, max: 0.15, ms: 10000 },
  bastion: { on: 1, calm: 5000, k: 0.12, ms: 8000, icd: 25000 },
  halo: { on: 1, r: 150, k: 0.94, ms: 2000 },
  pack: { on: 1, r: 200, k: 0.04, max: 0.12 },
  hellfire: { on: 1, p: 0.2, ms: 3000, every: 500, k: 0.25, r: 30 },
  blizzard: { on: 1, ms: 2500, every: 500, k: 0.2, r: 40, slow: 1500 },
});

Object.assign(LEGEND, {
  trace: ["추적자의", pfxText("trace", "정예·우두머리 처치 경험치 +{xp}%"), "H", "U", "S", "xp"],
  sage: ["현자의", pfxText("sage", "파티 사냥 시 경험치 +{xp}%"), "H", "U", "S", "xp"],
  mercy: ["자비로운", pfxText("mercy", "쓰러져도 잃는 경험치가 {k:-%}% 줄어든다"), "H", "U", "S", "util"],
  homing: ["귀소의", pfxText("homing", "귀환 주문서 시전 시간이 {k:-%}% 줄어든다"), "H", "U", "S", "util"],
  clever: ["영리한", pfxText("clever", "스킬의 MP 소모 -{k:-%}%"), "H", "U", "M", "util"],
  treasure: ["보물눈의", pfxText("treasure", "상자 몬스터에게서 아이템 발견 +{mf}%"), "H", "U", "S", "eco"],
  tame: ["길들이는", pfxText("tame", "펫이 전리품을 줍는 속도가 {sp}배다"), "H", "U", "S", "util"],
  hearth: ["화덕의", pfxText("hearth", "모닥불 곁 휴식 회복 +{k:%}%"), "H", "U", "S", "util"],
  bleed: ["출혈의", pfxText("bleed", "치명타 시 {ms:s}초간 출혈 (매초 공격력의 {k:%}%). 대상이 이동하면 2배 피해"), "WGR", "O", "M", "crit"],
  bile: ["담즙의", pfxText("bile", "피격 시 {p:%}% 확률로 공격한 적이 {ms:s}초간 매초 공격력의 {k:%}% 독 피해를 입고 공격력이 낮아진다"), "AB", "D", "M", "mit"],
  carap: ["갑각의", pfxText("carap", "처치 시 최대 HP의 {k:%}% 보호막이 생긴다 (최대 {max:%}%, {ms:s}초 유지)"), "AN", "D", "M", "sus"],
  bastion: ["방벽의", pfxText("bastion", "{calm:s}초 넘게 피격이 없다가 맞으면 최대 HP의 {k:%}% 보호막이 {ms:s}초간 생긴다 ({icd:s}초 간격)"), "ANH", "D", "M", "mit"],
  halo: ["후광의", pfxText("halo", "근처(반경 {r}) 파티원이 받는 피해 -{k:-%}%"), "NH", "D", "S", "mit"],
  pack: ["무리의", pfxText("pack", "근처(반경 {r}) 파티원 1명마다 공격력 +{k:%}% (최대 +{max:%}%)"), "RG", "O", "M", "pass"],
  hellfire: ["지옥불의", pfxText("hellfire", "처치 시 {p:%}% 확률로 그 자리에 {ms:s}초간 불길이 남아 {every:s}초마다 공격력의 {k:%}% 화염 피해 (반경 {r}, 동시에 1개)"), "WR", "O", "M", "kill"],
  blizzard: ["눈보라의", pfxText("blizzard", "스킬 사용 시 시전 위치에 {ms:s}초간 눈보라가 일어 반경 {r}의 적을 둔화시키고 {every:s}초마다 공격력의 {k:%}% 냉기 피해 (동시에 1개)"), "WR", "O", "M", "skill"],
});

// ── shared helpers of the phase-2 powers
/** DOT2 victims one wearer may carry per power (bounds the 1 s payout). */
const DOT_MAX = 8;
/** Put `mob` on p's DOT2 list `key` (a monster once: a bleed that runs does not stack with itself, nor restart); the hit is fixed now: attack × PFX[key].k. */
function dotAdd(S, p, st, key, mob) {
  const c = PFX[key], v = pfxPc(p).v, a = v[key] || (v[key] = []);
  if (mob.dead || MOBS[mob.k].chest || a.length >= DOT_MAX) return;
  for (let i = 0; i < a.length; i++) if (a[i].m === mob) return;
  const e = { m: mob, left: Math.max(1, Math.round(c.ms / 1000)), dmg: Math.max(1, Math.round(st.atk * c.k)), rs: mob.respAt };
  a.push(e);
  const type = key === "bleed" ? "bleed" : "poison";
  elementMark(S, mob, type, c.ms, p, key, e);
  if (type === "bleed") elementMoving(S, mob);
}
/** The 1 s payout of p's DOT2 list `key`: each victim takes its hit (a kill counts as p's: heals and resources run, px); gone, dead or respawned ones are dropped. */
function dotPay(S, rt, p, st, key) {
  const a = pfxPc(p).v[key];
  if (!a || !a.length) return;
  const type = key === "bleed" ? "bleed" : "poison";
  for (let i = a.length - 1; i >= 0; i--) {
    const e = a[i], m = e.m;
    if (m.dead || m.respAt !== e.rs) { a.splice(i, 1); continue; }
    const damage = e.dmg * (type === "bleed" && elementMoving(S, m) ? 2 : 1);
    if (dealTypedMob(S, rt, m, p, damage, type)) pfxKill(S, rt, p, st, m, m.x, m.y, PX);
    if (--e.left <= 0 || m.dead) a.splice(i, 1);
    else elementMark(S, m, type, e.left * 1000, p, key, e);
  }
}
/** ABS: offer p's shield `key` to a blow of `dmg` through r.abs; it never covers more than the blow still takes nor the dispatcher's 20 % cap, and shrinks by what it took. */
function shieldOffer(S, p, st, key, dmg, r) {
  const pc = pfxPc(p), have = pc.v[key];
  if (!(have > 0)) return;
  if (S.now >= (pc.t[key] || 0)) { pc.v[key] = 0; return; }
  const a = Math.floor(Math.min(have, dmg - r.abs, st.mhp * PFX_CAP.abs - r.abs));
  if (a <= 0) return;
  r.abs += a;
  pc.v[key] = have - a;
}
/** ZN: lay p's zone `key` (one per player and key: a new one replaces the old); it ticks every `every` ms, `left` times, as `px` blows of attack × mult. */
function pfxZone(S, rt, p, key, z) {
  for (let i = rt.zones.length - 1; i >= 0; i--) if (rt.zones[i].pfx === key && rt.zones[i].pid === p.pid) rt.zones.splice(i, 1);
  z.pfx = key; z.pid = p.pid; z.px = 1; z.next = S.now + z.every;
  rt.zones.push(z);
}
/** The party members of p (p itself aside) on its map, alive, within `r`. */
function pfxMates(S, p, r) {
  const out = [];
  for (const o of members(S, p)) if (o !== p && o.map === p.map && !o.dead && dist(o.x, o.y, p.x, p.y) <= r) out.push(o);
  return out;
}
/** 눈보라의: slow what stands in its zone (not a boss, guardian or rooted thing). */
function blizzChill(S, rt, z) {
  const until = S.now + PFX.blizzard.slow;
  const p = S.players[z.pid];
  for (const o of mobsWithin(rt, z.x, z.y, z.r)) {
    const d = MOBS[o.k];
    if (d.boss || d.still || o.el === 2) continue;
    o.slow = Math.max(o.slow || 0, until);
    elementInflict(S, rt, p, o, "cold", 1, { duration: PFX.blizzard.slow });
  }
}

Object.assign(PFX_FN, {
  // 추적자의 / 현자의: a kill's experience (the dispatcher keeps all prefix xp ≤ +15 %)
  trace: { loot(S, rt, p, st, mob, r, kind) { if (kind === "xp" && (mob.el || MOBS[mob.k].boss)) r.xp += PFX.trace.xp; } },
  sage: { loot(S, rt, p, st, mob, r, kind) { if (kind === "xp" && allies(S, p).length > 1) r.xp += PFX.sage.xp; } },
  // 자비로운 · 귀소의 · 영리한 · 길들이는 · 화덕의: a named number (51-prefix.js pfxNum: xp lost, recall cast, skill MP, pet interval, campfire rest)
  mercy: { num(p, name, v) { return name === "loss" ? v * PFX.mercy.k : v; } },
  homing: { num(p, name, v) { return name === "recall" ? v * PFX.homing.k : v; } },
  clever: { num(p, name, v) { return name === "mp" ? v * PFX.clever.k : v; } },
  tame: { num(p, name, v) { return name === "pet" ? v / PFX.tame.sp : v; } },
  hearth: { num(p, name, v) { return name === "rest" ? v * (1 + PFX.hearth.k) : v; } },
  // 보물눈의: a chest's loot is rarer
  treasure: { loot(S, rt, p, st, mob, r, kind) { if (kind === "drop" && MOBS[mob.k].chest) r.mf += PFX.treasure.mf; } },
  // 출혈의: a crit that does not kill opens a bleed; 담즙의: a blow taken may poison its giver (at most once a second)
  bleed: {
    crit(S, rt, p, st, mob, dmg, crit, killed) { if (!killed) dotAdd(S, p, st, "bleed", mob); },
    tick(S, rt, p, st) { dotPay(S, rt, p, st, "bleed"); },
  },
  bile: {
    hurt(S, rt, p, st, mob, dmg) { if (mob && dmg > 0 && !mob.dead && pfxChance(S, st, PFX.bile.p) && pfxIcd(S, p, "bile", PFX.bile.icd)) dotAdd(S, p, st, "bile", mob); },
    tick(S, rt, p, st) { dotPay(S, rt, p, st, "bile"); },
  },
  // 갑각의: every kill (a px kill too) adds to a shield that lasts after the last one; 방벽의: the first blow after a calm spell raises one
  carap: {
    kill(S, rt, p, st) {
      if (p.dead) return;
      const c = PFX.carap, pc = pfxPc(p), live = S.now < (pc.t.carap || 0) ? pc.v.carap || 0 : 0;
      pc.v.carap = Math.min(Math.round(st.mhp * c.max), live + Math.round(st.mhp * c.k));
      pc.t.carap = S.now + c.ms;
    },
    miti(S, rt, p, st, mob, dmg, raw, r) { shieldOffer(S, p, st, "carap", dmg, r); },
  },
  bastion: {
    miti(S, rt, p, st, mob, dmg, raw, r) {
      const c = PFX.bastion;
      // (p.hitAt still holds the last blow here: hurtPlayer stamps it after this hook)
      if (S.now - p.hitAt > c.calm && pfxIcd(S, p, "bastion", c.icd)) { const pc = pfxPc(p); pc.v.bastion = Math.round(st.mhp * c.k); pc.t.bastion = S.now + c.ms; }
      shieldOffer(S, p, st, "bastion", dmg, r);
    },
  },
  // 후광의: every second, the party in range (the wearer too) takes less for 2 s
  halo: {
    tick(S, rt, p, st, now) {
      const c = PFX.halo;
      for (const o of [p, ...pfxMates(S, p, c.r)]) {
        const pc = pfxPc(o), au = pc.aura || (pc.aura = { f: 1, until: 0 });
        au.f = c.k; au.until = now + c.ms;
      }
    },
  },
  // 무리의: the party about counted once a second, attack up for each
  pack: {
    tick(S, rt, p) { pfxPc(p).v.pack = pfxMates(S, p, PFX.pack.r).length; },
    stat(p, st) {
      const n = p.pc && p.pc.v.pack, c = PFX.pack;
      if (n) st.atk = Math.round(st.atk * (1 + Math.min(c.max, n * c.k)));
    },
  },
  // 지옥불의: a kill (not a power's own px kill) may leave a fire that burns for 3 s
  hellfire: {
    kill(S, rt, p, st, mob, x, y, o) {
      const c = PFX.hellfire;
      if ((o && o.px) || p.dead || !pfxChance(S, st, c.p)) return;
      pfxZone(S, rt, p, "hellfire", { x, y, r: c.r, every: c.every, left: Math.round(c.ms / c.every), mult: c.k, kind: 2, elem: "fire" });
    },
  },
  // 눈보라의: a skill raises a snowstorm where it was cast
  blizzard: {
    skill(S, rt, p) {
      const c = PFX.blizzard, z = { x: p.x, y: p.y, r: c.r, every: c.every, left: Math.round(c.ms / c.every), mult: c.k, kind: 3, elem: "cold" };
      pfxZone(S, rt, p, "blizzard", z);
      blizzChill(S, rt, z);
    },
    tick(S, rt, p) { for (const z of rt.zones) if (z.pfx === "blizzard" && z.pid === p.pid) blizzChill(S, rt, z); },
  },
});
