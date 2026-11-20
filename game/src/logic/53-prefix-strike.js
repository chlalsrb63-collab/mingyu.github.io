// ───────────────────────────── 접두사 고유 효과: offense for the weapon, ring and gloves (balance 2026-11-20) ─────────────────────────────
// The W, R and G pools had eight powers each against ~20 for every armour slot; these six give a damage build choices that are not
// "always on" (질주의 is): a target's HP, the wearer's HP, a kill streak, one target struck again and again. Recipe: 51-prefix.js header.
//   first 선공의 · exec 처단의 · fury 분노의 · focus 집중의 · combo 연격의 · rush 기세의

Object.assign(PFX, {
  first: { on: 1, k: 1.30 },                       // ×1.3 on a monster still at full HP
  exec: { on: 1, hp: 0.35, k: 1.22 },              // ×1.22 on one at 35 % HP or less
  fury: { on: 1, hp: 0.5, k: 1.16 },               // attack ×1.16 while the wearer is at half HP or less
  focus: { on: 1, crit: 10 },                      // +10 %p crit chance on elites and bosses
  combo: { on: 1, k: 0.04, max: 5 },               // +4 % a hit on the same target, up to 5 (a new target starts over)
  rush: { on: 1, ms: 4000, k: 1.12 },              // attack ×1.12 for 4 s after a kill
});

Object.assign(LEGEND, {
  first: ["선공의", pfxText("first", "HP가 가득한 적에게 주는 피해 +{k:+%}%"), "WG", "O", "M", "blow"],
  exec: ["처단의", pfxText("exec", "HP {hp:%}% 이하인 적에게 주는 피해 +{k:+%}%"), "WR", "O", "M", "kill"],
  fury: ["분노의", pfxText("fury", "HP가 {hp:%}% 이하일 때 공격력 +{k:+%}%"), "RG", "O", "M", "pass"],
  focus: ["집중의", pfxText("focus", "정예와 우두머리에게 치명타 확률 +{crit}%"), "WR", "O", "S", "crit"],
  combo: ["연격의", pfxText("combo", "같은 적을 연달아 맞힐 때마다 그 적에게 주는 피해 +{k:%}% (최대 {max}중첩, 대상을 바꾸면 초기화)"), "WG", "O", "M", "blow"],
  rush: ["기세의", pfxText("rush", "적을 처치하면 {ms:s}초간 공격력 +{k:+%}%"), "RG", "O", "M", "kill"],
});

Object.assign(PFX_FN, {
  first: { mul(S, p, st, mob) { return mob.hp >= mobMax(mob) ? PFX.first.k : 1; } },
  exec: { mul(S, p, st, mob) { return mob.hp <= mobMax(mob) * PFX.exec.hp ? PFX.exec.k : 1; } },
  fury: { stat(p, st) { if (p.hp <= st.mhp * PFX.fury.hp) st.atk = Math.round(st.atk * PFX.fury.k); } },
  focus: { pre(S, p, st, mob, d, o, r) { if (mob.el || d.boss) r.crit += PFX.focus.crit; } },
  combo: {
    mul(S, p, st, mob) { const pc = pfxPc(p); return pc.v.combo === mob.id ? 1 + PFX.combo.k * (pc.n.combo || 0) : 1; },
    hit(S, rt, p, st, mob, dmg, crit, killed) {
      const pc = pfxPc(p);
      if (killed) { pc.v.combo = 0; pc.n.combo = 0; return; }
      if (pc.v.combo !== mob.id) { pc.v.combo = mob.id; pc.n.combo = 0; }
      pfxStack(p, "combo", 1, PFX.combo.max);
    },
  },
  rush: {
    kill(S, rt, p) { pfxPc(p).t.rush = S.now + PFX.rush.ms; },
    stat(p, st) { if ((p.pc?.t.rush || 0) > p.S.now) st.atk = Math.round(st.atk * PFX.rush.k); },
  },
});
