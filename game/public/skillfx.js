/**
 * The weapon skills as the player sees them (docs/design/jobs-and-stats.md C.5, H.4): what each skill looks and
 * sounds like (fx codes 70–102 and the nine later hybrids' 120–128 on an "a" event), the passives' little
 * flashes (110–115), the things skills leave standing (a vortex, a phantom beast, a rain of arrows, traps, a
 * storm, a blood sanctuary, a rune circle, a support pennant: "pr" placed, "pp" a beat, "pe" gone), the tracker's lure, the bow's
 * arrows ("ar"/"ae": plain, piercing, and the element and ink arrows of kinds 4–7), and the signs drawn over
 * creatures — a dagger's marks, a book's brand, a frozen monster, a superconducted one.
 *
 * client.js hands every snapshot event here first (`skillEvent`: true = handled) and calls `onSnap` after each
 * snapshot so the flags and marks on the rows get read. Everything is drawn in code, in the game's flat pixel
 * style, through the scaled-up effect set (scene2d `big`): sparks, rings with shockwaves, a core flash, a shake
 * along the skill's aim.
 *
 * This file is the dispatcher (`onSnap skillEvent`); the drawing lives by area in skillfx_kit (shared helpers, the
 * palette), skillfx_melee, skillfx_spell, skillfx_props (placed things, per-frame signs), skillfx_boss, skillfx_bow and
 * skillfx_cast (each fx code), re-exported below so importers keep using skillfx.js.
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { HAMMER_IMPACT } from "./swing.js";
import { comboEvent } from "./skillfx_combo.js";
import { fxPal, jobPal } from "./jobpal.js";
import { castPfx, bossPfx } from "./skillpfx.js";
import { live, setPal, setLastLn, at, px, INK, now, text, later, along, rim, shards, sign, skillNear, dist2, lineOf, qi, fan, ELEM_COL, BANNER_COLOR } from "./skillfx_kit.js";
import { hammerImpact, oathSeal, streakWake, shadowAfterimage, shadowDart } from "./skillfx_melee.js";
import { bindingFolio, fireBurnPatch, chainLightningArc, leapShotArc } from "./skillfx_spell.js";
import { overlay, placeProp, propBeat, propEnd, lure } from "./skillfx_props.js";
import { recentTele, bossNear, elOf, bossTele, bloomwhaleDive, bloodhornJet } from "./skillfx_boss.js";
import { MISSILE_LOOK, missile, bowShots, ARROW_LOOK, ARROW_RANGE, arrowFrom, dressArrow, missiles, missileEnd } from "./skillfx_bow.js";
import { triggerSkillMotion, passive, cast, procFx } from "./skillfx_cast.js";

export { live } from "./skillfx_kit.js";
export { meleeSpearThrust, meleeSwordArc, hammerWindup, hammerImpact, meleeHammerSlam } from "./skillfx_melee.js";
export { supportMend, fireballOrb, frostNovaRing, chainLightningArc, gravityWell, crimsonArcWave, pierceMuzzle, leapShotArc } from "./skillfx_spell.js";
export { bloomwhaleDive, bloodhornJet } from "./skillfx_boss.js";
export { missile, missileEnd, bowFire } from "./skillfx_bow.js";
export { triggerSkillMotion } from "./skillfx_cast.js";

/** Which job's palette a line ("ln" kind) or a placed thing ("pr" kind) is drawn in. */
const LN_JOB = { 2: "lancer", 3: "lancer", 4: "wizard", 5: "thief", 6: "thief", 7: "trickster", 8: "archer", 9: "swordsman", 10: "warlock" };
/** After every snapshot: flags and the gauge number on the rows, marks and brands on monsters. */
export function onSnap(s, G, t) {
  live.G = G;
  G.me.fl = s.me[8] | 0;
  G.me.cv = s.me[9] | 0;
  if (s.jt !== undefined) G.me.jt = s.jt | 0;
  else if (s.self && !s.self.jt) G.me.jt = 0;
  if (s.self) G.selfAt = t;
  for (const r of s.P) { const e = G.players.get(r[0]); if (e) e.fl = r[8] | 0; }
  for (const r of s.M) { const e = G.mobs.get(r[0]); if (e) { e.mk = r[8] | 0; e.br = r[9] | 0; } }
  if (!hooked) { S3.hooks.push(overlay); hooked = true; }
}
let hooked = false;

// ───────────────────────────── events ─────────────────────────────

const REACT_NAME = [
  null,
  ["증기 폭발!", "#ffffff"],
  ["초전도!", "#b8a0ff"],
  ["과부하!", "#ffb04a"],
  ["정화 작열!", "#ffe498"],
  ["동상 부식!", "#7cf0b8"],
  ["공허 파열!", "#c078ff"],
  ["일식 붕괴!", "#f0d8ff"],
  ["부패 출혈!", "#e86888"],
  ["혈염 소각!", "#ff6248"],
];
/** Passive flashes: no swing of the weapon, only a sign where it happened. */
const PASSIVE = new Set([110, 111, 113, 114, 115]);

export function skillEvent(e, ctx) {
  if (e[0] === "cb" || (e[0] === "a" && e[2] >= 140 && e[2] <= 159)) {
    if (e[0] === "a") triggerSkillMotion(ctx.entityPos(e[1]), e[2], e[3], e[4] + 6, ctx.t, e[7] || 0);
    return comboEvent(e, ctx);
  }
  const { G, entityPos } = ctx;
  // the skills' effects go through the scaled-up set (scene2d big): denser, bigger, a core flash, shockwaves
  const B = S3.big(), f = B.fx, t = ctx.t;
  live.G = G;
  switch (e[0]) {
    case "t": {
      if (!e[5]) {
        recentTele.push({ x: e[1], y: e[2], r: e[3], ms: e[4], at: now() });
        const boss = bossNear(G, e[1], e[2], 260);   // a boss's blast/jet/punch ring: the pixelfx blow lands with it
        if (boss && skillNear(G, e[1], e[2])) bossPfx("ring", e[1], e[2], e[3], elOf(G, boss), 0, e[4]);
        while (recentTele.length > 16 || (recentTele.length && now() - recentTele[0].at > 200)) recentTele.shift();
      }
      return false;
    }
    case "hm": {
      const [, eid, x, y, r, hit, crit, kind] = e;
      const src = entityPos(eid);
      const ang = src ? (src.hammerYaw ?? Math.atan2(y - src.y, x - src.x)) : 0;
      hammerImpact(x, y, r, hit, crit, kind, ang);
      if (eid === G.you || skillNear(G, x, y)) castPfx(kind, src || { x, y }, x, y, r, ang, fxPal(kind, G, eid));
      if (eid === G.you || skillNear(G, x, y)) Sound.play("hammer_land", { kind, hit, crit, final: kind === 132 });
      if (eid === G.you && hit) {
        const strength = kind === 132 ? 4.5 : crit ? 3.3 : kind === 131 ? 2.5 : kind === 130 ? 2 : 1.5;
        S3.shake(strength, Math.atan2(y - G.me.y, x - G.me.x));
      }
      return true;
    }
    case "a": {
      const kind = e[2];
      if (kind < 70) return false;
      const [, eid, , tx, ty] = e;
      const src = entityPos(eid);
      if (!src) return true;
      if (!PASSIVE.has(kind)) triggerSkillMotion(src, kind, tx, ty + 6, t, e[7] || 0);
      // the pixelfx layers (skillpfx.js), over the game's own marks below (combo skills 140–159 call it in skillfx_combo.js)
      if (eid === G.you || skillNear(G, src.x, src.y) || skillNear(G, tx, ty)) castPfx(kind, src, tx, ty + 6, e[7], Math.atan2(ty + 6 - src.y, tx - src.x), fxPal(kind, G, eid));
      if (kind === 135 || kind === 136) {
        const y = ty + 6, near = eid === G.you || skillNear(G, tx, y);
        if (kind === 135) {
          S3.fx.wave(tx, y, (e[7] || 76) * 0.52, BANNER_COLOR.light, 260);
          S3.fx.sparkle(tx, y, 0.25, BANNER_COLOR.shine, 6);
          if (near) Sound.play("rally_banner");
        } else {
          bindingFolio(tx, y, e[7] || 105);
          if (near) Sound.play("revive_binding");
        }
        return true;
      }
      if (kind === 133 || kind === 134) {
        const ward = kind === 134, color = ward ? "#ffe3a0" : "#9ce6d8", y = ty + 6, dir = e[5];
        const radius = e[7] || (ward ? 34 : 23), flat = S3.fx;
        const line = ward ? null : lineOf(9);
        const dash = line && Math.hypot(line.bx - tx, line.by - y) < 2 ? line : null;
        const aim = dash && (dash.ax !== dash.bx || dash.ay !== dash.by) ? Math.atan2(dash.by - dash.ay, dash.bx - dash.ax)
          : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][dir] || 0;
        const ux = Math.cos(aim), uy = Math.sin(aim);
        const wk = G.who?.get(eid)?.gear?.wk || (eid === G.you ? G.self?.wk : "");
        src.dir = dir; src.aim = [tx + 30 * ux, y + 30 * uy];
        src.atkN = wk === "hammer" ? 0 : 2;
        src.hammerWind = HAMMER_IMPACT; src.hammerYaw = aim;
        src.atkT = t - (wk ? S3.impactMs(wk, src.atkN) : HAMMER_IMPACT);
        G.hitFrom = dash ? [dash.ax, dash.ay] : [tx, y];
        const near = eid === G.you || skillNear(G, tx, y);
        flat.wave(tx, y, radius, color, 320);
        flat.flash(tx, y, 8, 0, 0.15);
        if (ward) {
          rim(tx, y, radius, "#bd9157", color, 330, 0.36);
          oathSeal(tx, y, G.defs?.skills?.oathward?.healR || 70);
          if (near) Sound.play("oath_cast");
        } else {
          if (dash) {
            const half = (G.defs?.skills?.ironsiege?.half || 11) * 0.76;
            for (const side of [-half, half]) flat.beam(dash.ax - uy * side, dash.ay + ux * side, tx - uy * side, y + ux * side, color, 0.24);
          }
          rim(tx, y, radius, "#46948d", color, 275);
          shards(tx, y, radius, 7, 20, "#458878", color, 295, 16);
          if (near) { S3.shake(eid === G.you ? 4 : 2, aim); Sound.play("merc_dash"); }
        }
        return true;
      }
      if (PASSIVE.has(kind)) { passive(kind, src, eid, tx, ty + 6, G); return true; }
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; src.atkN = 2; }
      else { G.me.dir = e[5]; G.me.atkN = 2; }
      if (kind === 84 || kind === 85 || kind === 87 || kind === 88) src.skillFxT = src.atkT;
      src.aim = [tx, ty + 6];
      G.hitFrom = [src.x, src.y];
      cast(kind, src, eid, tx, ty + 6, e[7], G);
      return true;
    }
    case "b": {
      if ((e[4] | 0) === 10) { setPal(jobPal("wizard")); fireBurnPatch(e[1], e[2], e[3] || 30); return true; }
      return false;
    }
    // ── the bow's arrows (docs/design/jobs-and-stats.md D.2): fired ["ar", id, x0, y0, ux·1000, uy·1000,
    // spd, kind, shooter?] — kind 0 a plain shot, 1 the finisher (pierces one), 2 관통 화살, 3 도약 사격's fan;
    // the optional 9th field names the shooter, else it is the bow drawn nearest the arrow's start —
    // and ended ["ae", id, x, y, how] (0 struck or ran out, 1 stuck in a wall, 2 ran out of range)
    case "ar": {
      const [, id, x0, y0, ux, uy, spd, kind, pid] = e, n = Math.hypot(ux, uy) || 1;
      // a staff's missile or a book's orb (kinds 8, 9; the 10th field the monster it homes on): no bow drawn for it
      if (MISSILE_LOOK[kind]) { missile(G, id, x0, y0, ux / n, uy / n, spd, kind, e[9]); return true; }
      let sh = null, best = 40;
      for (const s of bowShots) {
        if (t - s.t > 700 || (pid !== undefined && s.eid !== pid)) continue;
        const d = Math.hypot(s.x - x0, s.y - y0);
        if (d < best) { best = d; sh = s; }
      }
      // (a volley shares one draw of the string)
      const kd = kind | 0, look = ARROW_LOOK[kd];
      if (sh && kd !== 3 && !look) bowShots.splice(bowShots.indexOf(sh), 1);
      const range = ARROW_RANGE[kd] || (G.defs && G.defs.wkinds && G.defs.wkinds.bow && G.defs.wkinds.bow.range) || 150;
      arrowFrom.set(id, [x0, y0, range, kd]);
      if (arrowFrom.size > 64) arrowFrom.delete(arrowFrom.keys().next().value);
      const delay = sh ? Math.max(0, sh.at - t) : 0, o = { id, spd: spd || 420, delay, tier: look ? look.tier : sh ? sh.wt : 1, pierce: kd === 1 || kd === 2 || !!look };
      // an element or ink arrow wears its dress over the white-hot arrow: queued first, so drawn after it
      const hold = {};
      if (look) S3.fxCustom((g) => dressArrow(g, hold.f, look), (range / o.spd) * 1000 + delay + 400);
      hold.f = S3.fx.arrow(x0, y0, x0 + (ux / n) * range, y0 + (uy / n) * range, o);
      return true;
    }
    case "ae": {
      const [, id, x, y, how] = e, from = arrowFrom.get(id);
      if (missiles.has(id)) { missileEnd(f, id, x, y, how, e[5] | 0); return true; }
      arrowFrom.delete(id);
      // struck nothing and simply ran its whole range: it drops out of sight, no spark
      const spent = how === 2 || (!how && from && Math.hypot(x - from[0], y - from[1]) >= from[2] - 6);
      S3.fx.arrowEnd(id, x, y, how === 1 ? "stuck" : spent ? "fade" : "hit");
      if (how === 1) Sound.play("arrow_wall"); else if (!spent) Sound.play("arrow_hit");
      // an element or ink arrow leaves a puff of what it carried where it stops
      const look = from && ARROW_LOOK[from[3]];
      if (look && !spent) { S3.fx.burst(x, y, 0.4, look.tail[1], 6, 1.4); S3.fx.ring(x, y, 9, look.tail[2], 220); }
      return true;
    }
    case "pr": { const [, id, kind, x, y, r, ms, eid] = e; placeProp(G, B, f, id, kind, x, y, r, ms, eid); return true; }
    case "pp": propBeat(G, B, f, e); return true;
    case "pe": propEnd(G, B, f, e); return true;
    case "ps": procFx(G, e); return true;
    case "bw": {
      const [, x, y, r, kind] = e;
      // 검기 화살's crescent bursts when its arrow gets there, not when the string lets go
      if (kind === 2 && now() - qi.at < 80) { const ms = qi.ms; qi.at = 0; later(ms, () => skillEvent(e, ctx)); return true; }
      if (kind === 2) { f.ring(x, y, r, "#ff8a3a", 420, true); f.ring(x, y, r * 0.7, "#ffffff", 300); f.crack(x, y, r * 0.6, "#ff7a3a", 650); f.burst(x, y, 0.3, "#ffb04a", 20 + r / 2, 3.4); B.shake(Math.min(14, 4 + r / 8)); }
      else if (kind === 9) { f.crack(x, y, r * 0.6, "#c8a0ff", 700); f.ring(x, y, r, "#ffffff", 320, true); f.burst(x, y, 0.1, "#8a5ad8", 34, 3); B.shake(10); Sound.play("slam"); }
      else if (kind === 15) { f.ring(x, y, r, "#8a5ad8", 420, true); f.ring(x, y, r * 0.6, "#ff5a8a", 340); f.burst(x, y, 0.4, "#3a2a58", 40, 3.2); f.sparkle(x, y, 0.6, "#c8a0ff", 20); B.shake(8); Sound.play("pact_end"); }
      return true;
    }
    case "rx": {
      const [, id, x, y, r] = e;
      if (id === 1) { f.ring(x, y, r, "#ffffff", 420, true); for (let i = 0; i < 18; i++) f.sparkle(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.6, 0.2, "#eef4ff", 2); f.burst(x, y, 0.3, "#d8e8f0", 30, 2.4); B.shake(5); Sound.play("steam"); }
      else if (id === 2) { f.ring(x, y, r, "#b8a0ff", 360, true); f.ring(x, y, r * 0.6, "#9fe8ff", 300); for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28; f.bolt(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, "#c8b0ff", 260); } Sound.play("supercon"); }
      else if (id === 3) { f.ring(x, y, r, "#ffb04a", 340, true); f.ring(x, y, r * 1.2, "#ffe86a", 300); f.crack(x, y, r * 0.7, "#ffb04a", 500); f.burst(x, y, 0.4, "#ffd84a", 30, 3.6); B.shake(8); Sound.play("overload"); }
      else if (id === 4) { f.ring(x, y, r, "#ffe498", 380, true); f.ring(x, y, r * 0.65, "#ff9246", 300); f.sparkle(x, y, 0.7, "#fff8d8", 16); f.burst(x, y, 0.35, "#ffca6a", 24, 2.8); B.shake(6); Sound.play("overload"); }
      else if (id === 5) { f.ring(x, y, r, "#7cf0b8", 380, true); f.ring(x, y, r * 0.62, "#87e4ff", 300); f.burst(x, y, 0.3, "#96f070", 24, 2.4); f.sparkle(x, y, 0.5, "#bfe8ff", 14); B.shake(5); Sound.play("supercon"); }
      else if (id === 6) { f.ring(x, y, r, "#c078ff", 380, true); for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28 + 0.3; f.bolt(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, i % 2 ? "#fff07a" : "#c078ff", 260); } f.burst(x, y, 0.35, "#8a5ad8", 26, 2.8); B.shake(7); Sound.play("supercon"); }
      else if (id === 7) { f.ring(x, y, r, "#f0d8ff", 400, true); f.ring(x, y, r * 0.6, "#ffca83", 320); f.burst(x, y, 0.4, "#3a2a58", 22, 2.8); f.sparkle(x, y, 0.8, "#fff8d8", 16); B.shake(7); Sound.play("overload"); }
      else if (id === 8) { f.ring(x, y, r, "#e86888", 360, true); f.ring(x, y, r * 0.65, "#a5ef66", 280); f.burst(x, y, 0.3, "#fb4b85", 22, 2.5); B.shake(5); Sound.play("blood_burst"); }
      else { f.ring(x, y, r, "#ff6248", 380, true); f.crack(x, y, r * 0.6, "#fb4b85", 460); f.burst(x, y, 0.35, "#ff9246", 26, 3.0); B.shake(6); Sound.play("steam"); }
      const [s, c] = REACT_NAME[id] || REACT_NAME[3];
      text(G, s, x, y, 1.6, c, true);
      return true;
    }
    case "jt": {
      const [, eid, phase] = e, src = entityPos(eid);
      if (!src) return true;
      const mine = eid === G.you;
      const job = mine ? G.self?.job : G.who?.get(eid)?.cls;
      const tr = G.defs?.jobTraits?.[job];
      const col = tr?.color || "#ffe08a", col2 = tr?.color2 || "#ffffff";
      S3.fx.ring(src.x, src.y, phase === 2 ? 32 : 22, phase === 2 ? col : col2, phase === 2 ? 360 : 280, phase === 2);
      S3.fx.sparkle(src.x, src.y, 0.7, col2, phase === 2 ? 12 : 6);
      if (mine && tr) {
        text(G, phase === 2 ? `${tr.name} 해방!` : `${tr.short} 최대!`, src.x, src.y, 2.0, phase === 2 ? col : col2, phase === 2);
        Sound.play(phase === 2 ? "reso_ready" : "buff");
      }
      return true;
    }
    case "dc": lure(e[1], e[2], e[3], e[4], e[5]); f.burst(e[3], e[4], 0.6, "#3a2a58", 30, 1.4); return true;
    case "bt": bossTele(e, entityPos, G); return true;
    case "bc": {
      // a scripted boss's turn (56-boss-script.js): 8 its marked cast broken, 7 the cast (or the hard enrage) went off
      const m = (G.mobs && G.mobs.get(e[1])) || entityPos(e[1]), code = e[2], tNow = now();
      if (m?.k === "jaemaei") {
        if (e[4] || code === 9) {
          m.windT = tNow; m.windMs = e[3]; m.windAim = e[4] ? [e[5], e[6]] : null;
          if (e[4]) text(G, e[4], m.x, m.y, (m.h3 || 1.3) + 0.55, "#f2c7ec", true);
        } else if (code === 7 || code === 8) {
          m.windT = 0;
        }
      }
      if (m && m.k === "bloomwhale") {
        const diveTele = [...recentTele].reverse().find((o) => tNow - o.at < 120 && o.r >= 55);
        const ph = m.bph || 1;
        const isDive = !!diveTele || m.bst === 2 || (ph <= 1 && code === 0) || ((ph === 2 || ph === 3) && code === 6) || (ph >= 4 && (code === 2 || code === 5));
        if (isDive && code !== 7 && code !== 8 && code !== 9) {
          const tx = diveTele ? diveTele.x : G.me ? G.me.x : m.x;
          const ty = diveTele ? diveTele.y : G.me ? G.me.y : m.y;
          bloomwhaleDive(m.x, m.y, tx, ty, diveTele ? diveTele.r : 70, diveTele ? diveTele.ms : 1800);
          return true;
        }
      }
      if (m && m.k === "bloodhorn" && code === 0) {
        const rings = recentTele.filter((o) => tNow - o.at < 120 && o.r <= 18);
        let pts, r = 13, ms = 900;
        if (rings.length >= 2) {
          rings.sort((a, b) => (a.x - m.x) ** 2 + (a.y - m.y) ** 2 - ((b.x - m.x) ** 2 + (b.y - m.y) ** 2));
          pts = rings.slice(-5).map((o) => [o.x, o.y]);
          r = rings[0].r || 13; ms = rings[0].ms || 900;
        } else {
          const dx = G.me ? G.me.x - m.x : 1, dy = G.me ? G.me.y - m.y : 0, l = Math.hypot(dx, dy) || 1;
          pts = [1, 2, 3, 4, 5].map((j) => [m.x + (dx / l) * 28 * j, m.y + (dy / l) * 28 * j]);
        }
        bloodhornJet(m.x, m.y, pts, r, ms);
        return true;
      }
      const bd = m && G.defs.mobs[m.k];
      if (bd && bd.boss) bossPfx(code === 9 ? "cast" : code === 8 ? "broke" : code === 7 ? "off" : "", m.x, m.y, 0, bd.element);
      if (m && code === 9 && bd && bd.boss && skillNear(G, m.x, m.y)) Sound.play("boss_cast");
      if (m && code === 8) { f.burst(m.x, m.y, 0.8, "#ffe08a", 30, 2.6); B.shake(6); Sound.play("boss_break"); }
      else if (m && code === 7) { f.ring(m.x, m.y, 90, "#ff3a2a", 420, true); B.shake(8); Sound.play("boss_enrage"); }
      else if (m && code === 6) { f.burst(m.x, m.y, 0.6, "#ff4fd8", 18, 2); Sound.play("boss_absorb"); }   // an add flew into it and healed it
      return true;
    }
    case "dx": S3.props.delete("dc" + e[1]); f.ring(e[2], e[3], e[4], "#8a5ad8", 320, true); f.burst(e[2], e[3], 0.6, "#c890ff", 30, 3); B.shake(4); Sound.play("decoy_pop"); return true;
    case "fz": { sign(e[1], "fz", t + e[2]); const m = G.mobs.get(e[1]); if (m) { text(G, "빙결", m.x, m.y, (m.h3 || 1.3) + 0.4, "#bfe8ff"); f.sparkle(m.x, m.y, 0.6, "#e8f8ff", 10); if (skillNear(G, m.x, m.y)) Sound.play("freeze_lock"); } return true; }
    case "vu": { sign(e[1], "vu", t + e[2]); const m = G.mobs.get(e[1]); if (m && skillNear(G, m.x, m.y)) Sound.play("armor_break"); return true; }
    case "tip": {
      const m = G.mobs.get(e[1]);
      if (m) { text(G, "창끝!", m.x + 6, m.y, (m.h3 || 1.3) + 0.55, "#c8fff0"); f.spark(m.x, m.y, "#c8fff0", 1.2); }
      Sound.play("tip");
      return true;
    }
    case "ln": {
      const [, kind, ax, ay, bx, by] = e;
      const p = setPal(jobPal(LN_JOB[kind] || "adventurer"));
      setLastLn({ kind, ax, ay, bx, by, at: now() });
      if (kind === 2) {
        // the thunder javelin: a bolt of a spear down the line
        S3.fx.proj(ax, ay, 0.7, bx, by, 0.5, p.l, 0.07, 70);
        f.beam(ax, ay, bx, by, p.al, 0.6); f.bolt(ax, ay, bx, by, p.l, 240);
      } else if (kind === 3) {
        streakWake(ax, ay, bx, by, p.a, p.l, 10);
        S3.fx.burst(ax, ay, 0.1, p.m, 8, 1.6);
      } else if (kind === 4) { chainLightningArc(ax, ay, bx, by); Sound.play("bolt"); }
      else if (kind === 5) {
        shadowAfterimage(ax, ay, 240);
        streakWake(ax, ay, bx, by, p.md, p.l, 7);
        f.burst(ax, ay, 0.6, p.md, 8, 1.3);
        Sound.play("dance");
      }
      else if (kind === 6) {
        shadowAfterimage(ax, ay, 220);
        streakWake(ax, ay, bx, by, p.md, p.l, 7);
        S3.fx.burst(ax, ay, 0.45, p.m, 7, 1.3);
      }
      else if (kind === 7) {
        // 원소 비수 sends three blades coloured fire, ice and lightning after its cast.
        const el = fan.n > 0 && now() - fan.at < 80 ? 4 - fan.n-- : 0;
        if (!el) {
          shadowDart(ax, ay, bx, by);
          return true;
        }
        const col = ELEM_COL[el], far = Math.hypot(bx - ax, by - ay), ms = Math.max(120, far * 2.4);
        S3.fxCustom((g, k) => {
          const [x, y] = at(ax + (bx - ax) * k, ay + (by - ay) * k, 10);
          const a = k * 18;
          g.translate(Math.round(x), Math.round(y)); g.rotate(a);
          px(g, -5, -1, 10, 3, INK); px(g, -4, 0, 8, 1, col); px(g, 3, -1, 2, 1, "#ffffff");
        }, ms);
        // each leaves its element along the way and a puff of it at the end
        f.beam(ax, ay, bx, by, col, 0.45);
        along(ax, ay, bx, by, 26).forEach(([x, y], i, all) => later((i / all.length) * ms, () => S3.fx.sparkle(x, y, 0.4, col, 2)));
        later(ms, () => { S3.fx.ring(bx, by, 10, col, 240); S3.fx.burst(bx, by, 0.4, col, 6, 1.6); });
      } else if (kind === 10) {
        // 낙인 전염: the brand leaps from the fallen to its next host in a hopping arc, landing with a stamp
        S3.fxCustom((g, k) => {
          for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            if (u > k * 1.6) break;
            const [x, y] = at(ax + (bx - ax) * u, ay + (by - ay) * u, 14 + Math.sin(u * Math.PI) * 30);
            g.globalAlpha = Math.max(0, 1 - k);
            px(g, x - 2, y - 2, 4, 4, INK); px(g, x - 1, y - 1, 2, 2, i % 3 ? p.m : p.a);
          }
          g.globalAlpha = 1;
        }, 380);
        later(240, () => { S3.fx.ring(bx, by, 14, p.m, 260); S3.fx.spark(bx, by, p.a, 1); });
        Sound.play("brand");
      } else if (kind === 8) { leapShotArc(ax, ay, bx, by); f.burst(ax, ay, 0.1, p.m, 10, 1.6); }
      else if (kind === 9) {
        // up and over: an inked pixel leap arc and launch dust
        S3.fxCustom((g, k) => {
          for (let i = 0; i <= 14; i++) {
            const u = i / 14;
            if (u > k * 1.65) break;
            const [x, y] = at(ax + (bx - ax) * u, ay + (by - ay) * u, 10 + Math.sin(u * Math.PI) * 38);
            g.globalAlpha = Math.max(0, 1 - k * 1.05);
            px(g, x - 2, y - 2, 4, 4, INK);
            px(g, x - 1, y - 1, 2, 2, i > 9 ? p.l : p.l);
          }
          g.globalAlpha = 1;
        }, 420);
        f.burst(ax, ay, 0.1, p.m, 10, 1.6);
      }
      return true;
    }
    case "ds": {
      // the dash (59-dash.js, Space): ghosts of the body left down the run, wind streaks, dust kicked up at both
      // ends; the hero itself is put at the far end by the snapshot's position fix (never predicted here)
      const [, eid, x0, y0, x1, y1] = e, mine = eid === G.you;
      if (!mine && dist2(G.me, x1, y1) > 360 * 360) return true;
      const [sx0, sy0] = at(x0, y0), [sx1, sy1] = at(x1, y1), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl;
      S3.fxCustom((g, k) => {
        for (let i = 1; i <= 3; i++) {
          const q = i / 4, gx = sx0 + (sx1 - sx0) * q, gy = sy0 + (sy1 - sy0) * q;
          g.globalAlpha = Math.max(0, (0.2 + q * 0.35) * (1 - k * (1.6 - q)));
          px(g, gx - 4, gy - 13, 8, 12, INK); px(g, gx - 3, gy - 12, 6, 10, "#9ad0ff"); px(g, gx - 3, gy - 12, 6, 2, "#e8f6ff");
        }
        g.globalAlpha = Math.max(0, 1 - k * 1.5);
        const L = Math.min(sl, 34) * (1 - k * 0.6);
        for (const o of [-5, 0, 5]) for (let q = 0; q < L; q++) if (q % 7 < 4) px(g, sx1 - ux * (q + 7) - uy * o, sy1 - 6 - uy * (q + 7) + ux * o * 0.5, 1, 1, o ? "#9ad0ff" : "#ffffff");
        g.globalAlpha = 1;
      }, 340);
      f.burst(x0, y0, 0, "#c8b898", 7, 0.8); f.burst(x1, y1, 0, "#c8b898", 4, 0.6);
      Sound.play("dash");
      return true;
    }
    case "dg": {
      // a monster's blow slipped mid-dash
      const src = entityPos(e[1]);
      if (src) text(G, "회피!", src.x, src.y, 2, "#9ad0ff", e[1] === G.you);
      if (e[1] === G.you) Sound.play("dodge");
      return true;
    }
  }
  return false;
}
