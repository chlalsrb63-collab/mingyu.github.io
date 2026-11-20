// The offense powers for the weapon, ring and gloves (src/logic/53-prefix-strike.js), the reworked 가시의, and the three rune sets of the
// balance patch 2026-11-20 (쇠뿌리 2, 매사냥꾼 3, 밀물노래 4: 52-rune-sets.js).   node tests/prefix-strike.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { LEGEND, PFX, PFX_FN, PFX_W, RUNE_POWER, RUNE_SETS, plain, stats, deriveStats, newMob, mobMax, pfxPc, pfxMul, pfxPre, pfxHit, pfxKill, pfxHurt, pfxSkill, pfxPick };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b} ± ${eps}`);

// ── the table: offense, rolling only on W R G, live, with code
const NEW = ["first", "exec", "fury", "focus", "combo", "rush"];
for (const k of NEW) {
  const row = X.LEGEND[k];
  assert.ok(row && /^[WRG]+$/.test(row[2]) && row[3] === "O", `${k}: an offense row on W R G`);
  assert.ok(X.PFX[k].on && X.PFX_FN[k], `${k}: live and coded`);
}
for (const L of "WRG") assert.ok(Object.keys(X.LEGEND).filter((k) => X.PFX[k]?.on && X.LEGEND[k][2].includes(L)).length >= 11, `${L}: at least 11 powers to roll`);
assert.equal(X.LEGEND.first[1], "HP가 가득한 적에게 주는 피해 +30%");
assert.equal(X.LEGEND.thorn[1], "피격 시 받은 피해의 30%와 공격력의 40%를 공격한 적에게 되돌려 준다 (1초 간격)");
{ const seen = new Set(); for (let i = 1; i <= 3000; i++) seen.add(X.pfxPick({ seed: i }, "ring")); for (const k of ["exec", "fury", "focus", "rush"]) assert.ok(seen.has(k), `${k} rolls on a ring`); }

// ── a world with one hero
const S = L.setup();
S.now = S.last = 2_000_000;
L.addPlayer(S, "pid", L.hero("일격", { wk: "sword", lvl: 157, migrate: true }));
const p = S.players.pid, rt = L.runtime(S, p.map);
p.hp = 1e6; p.mp = 0;
const mob = (k, o = {}) => { const m = Object.assign(X.newMob(S, k, [0, 0, 0, 0]), { x: p.x + 20, y: p.y, respAt: 1e15 }, o); m.hp = X.mobMax(m); rt.mobs.push(m); return m; };
const wear = (slot, id, lg) => { p.ch.eq[slot] = { ...X.plain(id), q: 3, il: 160, lg }; p.stc = null; p.pc = null; };
const bare = () => { p.ch.eq = { weapon: p.ch.eq.weapon }; p.stc = null; p.pc = null; };
const st = () => X.stats(p);

bare(); wear("gloves", "g_8", "first");
{ const m = mob("twinhare"); assert.equal(X.pfxMul(S, p, st(), m, {}, {}, false), X.PFX.first.k, "선공의: a full-HP target"); m.hp -= 1; assert.equal(X.pfxMul(S, p, st(), m, {}, {}, false), 1, "and not once it is hurt"); }

bare(); wear("ring1", "r_8", "exec");
{ const m = mob("twinhare"); assert.equal(X.pfxMul(S, p, st(), m, {}, {}, false), 1); m.hp = Math.floor(X.mobMax(m) * 0.35); assert.equal(X.pfxMul(S, p, st(), m, {}, {}, false), X.PFX.exec.k, "처단의 at 35 %"); }

bare(); wear("ring1", "r_8", "fury");
{ p.hp = st().mhp; const a0 = st().atk; p.hp = st().mhp * 0.5; near(st().atk / a0, X.PFX.fury.k, 0.01, "분노의 at half HP"); p.hp = 1e6; }

bare(); wear("weapon", "w_warrior_8", "focus");
{ const m = mob("twinhare"), e = mob("twinhare", { el: 1 });
  assert.equal(X.pfxPre(S, p, st(), m, { }, {}).crit, 0, "집중의: nothing on an ordinary one"); assert.equal(X.pfxPre(S, p, st(), e, {}, {}).crit, X.PFX.focus.crit, "+10 %p on an elite"); }

bare(); wear("gloves", "g_8", "combo");
{ const a = mob("twinhare"), b = mob("twinhare"), s = st();
  for (let i = 0; i < 8; i++) X.pfxHit(S, rt, p, s, a, 1, false, false, {});
  near(X.pfxMul(S, p, s, a, {}, {}, false), 1 + X.PFX.combo.k * X.PFX.combo.max, 1e-9, "연격의 stacks to its cap on one target");
  assert.equal(X.pfxMul(S, p, s, b, {}, {}, false), 1, "another target gets nothing");
  X.pfxHit(S, rt, p, s, b, 1, false, false, {}); near(X.pfxMul(S, p, s, b, {}, {}, false), 1 + X.PFX.combo.k, 1e-9, "switching starts over"); assert.equal(X.pfxMul(S, p, s, a, {}, {}, false), 1); }

bare(); wear("ring1", "r_8", "rush");
{ const a0 = st().atk, m = mob("twinhare"); X.pfxKill(S, rt, p, st(), m, m.x, m.y, {}); near(st().atk / a0, X.PFX.rush.k, 0.01, "기세의 after a kill");
  S.now += X.PFX.rush.ms + 1; near(st().atk / a0, 1, 0.001, "and it fades"); }

// ── 가시의: a share of the blow plus a share of attack, once a second
bare(); wear("armor", "a_8", "thorn");
{ const m = mob("twinhare"), s = st(); m.hp = 1e6; const hp0 = m.hp;
  X.pfxHurt(S, rt, p, s, m, 100, 200);
  near(hp0 - m.hp, 100 * X.PFX.thorn.k + s.atk * X.PFX.thorn.a, 2, "thorn returns 30 % of the blow and 40 % of attack");
  const hp1 = m.hp; X.pfxHurt(S, rt, p, s, m, 100, 200); assert.equal(m.hp, hp1, "not twice within a second");
  S.now += 1000; X.pfxHurt(S, rt, p, s, m, 100, 200); assert.ok(m.hp < hp1, "again after a second"); }

// ── the new rune sets, socketed for real
const sock = (slot, id, runes) => { p.ch.eq[slot] = { ...X.plain(id), il: 160, sk: runes.length, ru: runes.map((r) => [r, 150]) }; p.stc = null; p.pc = null; };
bare(); const def0 = X.deriveStats(p).def, poise0 = X.deriveStats(p).poise;
sock("armor", "a_8", ["ru_ironroot_1", "ru_ironroot_2"]);
{ const c = X.deriveStats(p); assert.ok(c.runeSets.includes("ironroot"), "쇠뿌리 counts at 2");
  const plainDef = (() => { const keep = p.ch.eq.armor; p.ch.eq.armor = { ...keep, sk: 0, ru: [] }; p.stc = null; const d = X.deriveStats(p).def; p.ch.eq.armor = keep; p.stc = null; return d; })();
  near(X.deriveStats(p).def / plainDef, X.RUNE_POWER.ironroot.def, 0.03, "쇠뿌리: defence ×1.12"); assert.ok(X.deriveStats(p).poise > poise0 || poise0 >= 0.85, `and steadier (${poise0} → ${X.deriveStats(p).poise})`); }
bare(); sock("weapon", "w_warrior_8", ["ru_falconer_1", "ru_falconer_2"]); sock("helm", "h_8", ["ru_falconer_3"]);
{ const s = st(); assert.ok(s.pfx.mul.length, "매사냥꾼 counts at 3"); assert.equal(X.pfxMul(S, p, s, mob("twinhare", { el: 1 }), { }, {}, false), X.RUNE_POWER.falconer.hit); assert.equal(X.pfxMul(S, p, s, mob("twinhare"), {}, {}, false), 1); }
bare(); p.ch.eq.weapon = { ...X.plain("w_warrior_8"), il: 160, sk: 2, ru: [["ru_tidesong_1", 150], ["ru_tidesong_2", 150]] };
p.ch.eq.armor = { ...X.plain("a_8"), il: 160, sk: 2, ru: [["ru_tidesong_3", 150], ["ru_tidesong_4", 150]] }; p.stc = null; p.pc = null;
{ const s = st(); assert.ok(X.deriveStats(p).runeSets.includes("tidesong"), "밀물노래 counts at 4");
  p.mp = 0; const a0 = st().atk; X.pfxSkill(S, rt, p, st(), {}, "x", 0); near(p.mp, st().mmp * X.RUNE_POWER.tidesong.mp, 1, "a skill gives back 5 % MP");
  X.pfxSkill(S, rt, p, st(), {}, "x", 0); near(p.mp, st().mmp * X.RUNE_POWER.tidesong.mp, 1, "not within 3 s");
  p.mp = st().mmp; near(st().atk / a0, X.RUNE_POWER.tidesong.atk, 0.01, "full MP: attack ×1.1"); }
console.log("prefix-strike: 6 offense powers, thorn and 3 rune sets passed");
