/**
 * The combo skills' effects (docs/design/skill-combos.md): the "cb" event (a combo state spent on a monster,
 * or 9 = launched), the six combo actives' "a" codes 140–145, the spins 146–147 and the new skills 148–159. skillfx.js skillEvent hands them here first.
 * The actives draw in their job's palette (jobpal.js); each cashed-in state has its own payoff.
 *   ["cb", mobId, code]  1 경직 2 빙결(파쇄) 3 공중(추가타) 4 표식(폭발) 5 낙인 6 화상(점화) 7 끌림(결집) 9 띄우기
 *   ["a", eid, kind, x, y, dir, 2, extra]  extra 0 = wind-up/start; drain beats 1, finisher 2; else the strike
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { fxPal, fxSkill, skillOwner } from "./jobpal.js";
import { castPfx } from "./skillpfx.js";

const now = () => performance.now();
const text = (G, str, x, y, h, col) => G.texts.push({ str, x, y, h, col, big: true, t0: now() });
/** code → [word, colour]. */
const CB = {
  1: ["경직 강타!", "#ffd86a"], 2: ["파쇄!", "#bfe8ff"], 3: ["추가타!", "#fff2a8"], 4: ["표식 폭발!", "#ff7ad0"],
  5: ["낙인 폭발!", "#c890ff"], 6: ["점화!", "#ff9a3a"], 7: ["결집!", "#9fe0c0"], 9: ["띄우기", "#e8f0ff"],
};

/** True when the event was one of ours (drawn). */
export function comboEvent(e, ctx) {
  const { G, entityPos, t } = ctx;
  const B = S3.big(), f = B.fx;
  if (e[0] === "cb") {
    const m = G.mobs.get(e[1]), c = CB[e[2]];
    if (!m || !c) return true;
    text(G, c[0], m.x, m.y, (m.h3 || 1.3) + 0.5, c[1]);
    payoff(G, B, f, m, e[2], c[1]);
    return true;
  }
  const [, eid, kind, tx, ty0, dir, , extra = 0] = e;
  const src = entityPos(eid), ty = ty0 + 6, p = fxPal(kind, G, eid), col = p.m, mine = eid === G.you;
  if (!src) return true;
  const near = mine || (G.me && Math.hypot(src.x - G.me.x, src.y - G.me.y) < 180) || (G.me && Math.hypot(tx - G.me.x, ty - G.me.y) < 180);
  if (!extra) {
    // the wind-up (or a channel opening): light gathering on the caster, or a warning ring on a ground spell's spot
    if (kind === 143) { f.ring(tx, ty, 40, col, 400); S3.fx.ring(tx, ty, 40, p.a, 400); if (near) Sound.play("ignite_wind"); }
    else {
      f.sparkle(src.x, src.y, 0.9, p.l, 10);
      if (near) {
        if (kind === 140) Sound.play("cleave_wind");
        else if (kind === 144) Sound.play("soul_drain");
        else if (kind === 145) Sound.play("snipe_wind");
        else if (kind === 158) Sound.play("parry_stance");
        else if (kind === 159) Sound.play("mountain_charge");
      }
    }
    castPfx(kind, src, tx, ty, 0, Math.atan2(ty - src.y, tx - src.x), p, "wind");
    return true;
  }
  if (eid !== G.you) { src.atkT = t; src.dir = dir; src.atkN = 2; } else { G.me.dir = dir; G.me.atkN = 2; }
  src.aim = [tx, ty];
  castPfx(kind, src, tx, ty, 0, Math.atan2(ty - src.y, tx - src.x), p);   // `extra` here is not a reach
  switch (kind) {
    case 140: f.burst(tx, ty, 0.3, col, 22, 2.4); f.wave(tx, ty, 26, p.l, 300); f.crack(tx, ty, 24, p.l, 480); B.shake(mine ? 6 : 3); if (near) Sound.play("cleave_hit"); break;
    case 141: f.burst(tx, ty, 0.6, col, 10 + extra * 4, 2); f.sparkle(tx, ty, 0.6, p.a, 4 + extra * 2); if (extra >= 3) f.ring(tx, ty, 32, p.a, 300, true); if (near) Sound.play("rupture", extra); break;
    case 142: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, p.l, 0.04, 60); f.spark(tx, ty, p.a, 1); if (near) Sound.play("hook_chain"); break;
    case 143: f.ring(tx, ty, extra, col, 360, true); f.burst(tx, ty, 0.4, col, 26, 2.6); f.burst(tx, ty, 0.8, p.l, 12, 2); f.sparkle(tx, ty, 0.6, p.a, 10); B.shake(mine ? 5 : 3); if (near) Sound.play("ignite_burst"); break;
    case 144: f.proj(tx, ty, 0.6, src.x, src.y, 0.8, col, 0.04, extra === 2 ? 30 : 50); if (extra === 2) { f.burst(tx, ty, 0.6, p.l, 16, 2); f.ring(src.x, src.y, 18, p.a, 300); } if (near) Sound.play(extra === 2 ? "soul_drain_fin" : "soul_drain"); break;
    case 145: f.flash(src.x, src.y, 8); f.proj(src.x, src.y, 0.75, tx, ty, 0.5, p.l, 0.03, 20); f.spark(tx, ty, p.a, 1.3); if (near) Sound.play("snipe_shot"); break;
    // 돌개바람 / 무쌍난무: a spinning ring at the caster every beat
    case 146: case 147: f.ring(src.x, src.y, kind === 146 ? 46 : 52, col, 220, extra === 2); f.burst(src.x, src.y, 0.3, p.l, 6, 1.6); if (near) Sound.play(kind === 146 ? "whirl_slash" : "musou_thrust", extra === 2); break;
    // the first wave of new skills (skill-ideas.md §9): dedicated SFX per skill
    case 148: f.ring(tx, ty, extra, col, 300, true); f.crack(tx, ty, 30, p.l, 400); B.shake(mine ? 4 : 2); if (near) Sound.play("earth_stomp"); break;      // 땅울림 발구르기
    case 149: if (extra === 2) { f.burst(tx, ty, 0.4, col, 18, 2.2); f.ring(tx, ty, 40, p.a, 300); if (near) Sound.play("mortar_blast"); } else { f.proj(src.x, src.y, 0.75, tx, ty, 0.5, p.l, 0.06, 30); if (near) Sound.play("mortar_launch"); } break; // 곡사 폭약 화살
    case 150: f.flash(src.x, src.y, 10); f.proj(src.x, src.y, 0.75, tx, ty, 0.5, col, 0.02, 20); f.spark(tx, ty, p.a, 1.6); B.shake(mine ? 5 : 3); if (near) Sound.play("dragonbone_shot"); break; // 용뼈 관통 사격
    case 151: if (extra === 2) { f.flash(src.x, src.y, 8); text(G, "회심!", src.x, src.y, 1.6, p.a); } if (near) Sound.play("roll_shot", extra === 2); break; // 구르며 쏘기
    case 152: f.spark(tx, ty, p.l, 1.4); f.burst(tx, ty, 0.5, col, 10, 1.8); if (near) Sound.play("chain_zap"); break;                                       // 연쇄 번개
    case 153: f.wave(tx, ty, 22, col, 260); f.burst(tx, ty, 0.3, p.l, 10 + extra * 3, 2); B.shake(mine ? 4 : 2); if (near) Sound.play("shoulder_bash"); break; // 어깨 돌파
    case 154: f.proj(src.x, src.y, 0.75, tx, ty, 0.3, p.l, 0.04, 30); f.ring(tx, ty, 10, p.a, 300); if (near) Sound.play("bolas_wrap"); break;               // 올무 화살
    case 155: f.ring(src.x, src.y, 36, col, 260, extra >= 5); f.sparkle(src.x, src.y, 0.7, p.l, extra * 2); if (near) Sound.play("blade_vortex", extra >= 5); break; // 칼날 소용돌이
    case 156: f.burst(tx, ty, 0.4, col, 16, 2.4); if (near) Sound.play("blade_fan"); break;                                                                  // 칼날 흩뿌리기
    case 157: f.ring(tx, ty, extra, "#b8b8c0", 600, true); f.burst(tx, ty, 0.2, "#d8d8e0", 30, 1.4); if (near) Sound.play("smoke_bomb"); break;              // 연막탄
    case 158: f.flash(src.x, src.y, 10); f.ring(src.x, src.y, 40, p.a, 280, true); f.spark(src.x, src.y, "#ffffff", 1.6); B.shake(mine ? 4 : 2); if (near) Sound.play("parry_clang"); break; // 칼등 받아치기 (막았다)
    case 159: f.burst(tx, ty, 0.3, col, 10 + extra * 6, 1.8 + extra * 0.3); f.crack(tx, ty, 12 + extra * 8, p.l, 480); B.shake(mine ? 2 + extra * 2 : 2); if (near) Sound.play("mountain_split", extra); break; // 산 가르기 (extra = 단계 + 1)
  }
  const skId = fxSkill(kind);
  const playJobNote = (kind !== 144 && kind !== 146 && kind !== 147 && kind !== 155) || extra === 2 || (kind === 155 && extra >= 5);
  if (near && skId && playJobNote) Sound.play("job_note", { job: skillOwner(skId), sig: kind >= 146 });
  return true;
}
/** A combo state cashed in on monster `m` (skill-combos.md §7, VFX-01): each its own pixel payoff, a shake when it is near. */
function payoff(G, B, f, m, code, col) {
  const x = m.x, y = m.y, near = !!G.me && Math.hypot(x - G.me.x, y - G.me.y) < 220;
  const [sx, sy0] = S3.iso(x, y), sy = sy0 - Math.round((m.h3 || 1.3) * 14);
  const px = (g, a, b, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(a), Math.round(b), w, h); };
  // Immediately update client combo bitmask so the overhead badge pops off as it detonates
  if (code === 1) m.cb = (m.cb | 0) & ~1;
  else if (code === 2) m.cb = (m.cb | 0) & ~2;
  else if (code === 3) m.cb = (m.cb | 0) & ~4;
  else if (code === 4) m.mk = 0;
  else if (code === 5) m.br = 0;
  else if (code === 6) m.cb = (m.cb | 0) & ~(3 << 3);
  else if (code === 7) m.cb = (m.cb | 0) & ~32;
  else if (code === 9) m.cb = (m.cb | 0) | 4;

  switch (code) {
    case 1: {
      // 경직 강타! — 8-point golden star-burst impact + ground crack + shockwave
      f.flash(x, y, 11);
      f.crack(x, y, 22, col, 460);
      f.wave(x, y, 26, "#fff6b0", 280);
      f.burst(x, y, 0.55, col, 18, 2.4);
      S3.fxCustom((g, k) => {
        const r = 6 + k * 20, w = k < 0.4 ? 3 : 2;
        g.globalAlpha = 1 - k;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, len = i % 2 ? r * 0.65 : r;
          for (let d = 3; d <= len; d += 2) px(g, sx + Math.cos(a) * d - 1, sy + Math.sin(a) * d * 0.7 - 1, w, w, d > len - 3 ? "#ffffff" : col);
        }
      }, 260);
      if (near) Sound.play("cb_stagger");
      break;
    }
    case 2: {
      // 파쇄! — flying pixel ice prism shards + twin frost rings + white-hot core flash
      f.flash(x, y, 12);
      f.burst(x, y, 1, "#ffffff", 12, 2.8);
      f.burst(x, y, 0.7, col, 24, 2.5);
      f.ring(x, y, 24, "#e8f8ff", 300, true);
      S3.fxCustom((g, k) => {
        g.globalAlpha = 1 - k * 0.85;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3, d = 4 + k * 26;
          const ix = Math.round(sx + Math.cos(a) * d), iy = Math.round(sy + Math.sin(a) * d * 0.65 - Math.sin(k * Math.PI) * 8);
          px(g, ix - 2, iy - 2, 5, 5, "#2b2233");
          px(g, ix - 1, iy - 1, 3, 3, "#7ad4ff");
          px(g, ix - 1, iy - 1, 2, 2, "#ffffff");
        }
      }, 320);
      if (near) Sound.play("cb_shatter");
      break;
    }
    case 3: {
      // 추가타! — downward sky-lance strikes + mid-air and ground sonic rings
      f.fall(x, y, col, 80);
      f.flash(x, y, 10);
      f.burst(x, y, 0.85, col, 18, 2.4);
      f.wave(x, y, 24, "#ffffff", 260);
      S3.fxCustom((g, k) => {
        g.globalAlpha = 1 - k;
        for (const dx of [-7, 0, 7]) {
          const topY = sy - 34 * (1 - k * 0.5), h = Math.max(4, Math.round(26 * (1 - k)));
          px(g, sx + dx - 1, topY, 3, h, col);
          px(g, sx + dx, topY, 1, h, "#ffffff");
        }
      }, 240);
      if (near) Sound.play("cb_aerial");
      break;
    }
    case 4: {
      // 표식 폭발! — assassin X-cross blade slash detonation + diamond burst
      f.flash(x, y, 10);
      f.burst(x, y, 0.6, col, 20, 2.5);
      f.ring(x, y, 22, "#ffd0ff", 280, true);
      S3.fxCustom((g, k) => {
        const L = Math.round(8 + k * 18);
        g.globalAlpha = 1 - k;
        for (let s = -L; s <= L; s += 2) {
          const c = Math.abs(s) < 5 || k < 0.3 ? "#ffffff" : col;
          px(g, sx + s - 1, sy + s * 0.65 - 1, 3, 3, "#2b2233");
          px(g, sx + s - 1, sy - s * 0.65 - 1, 3, 3, "#2b2233");
          px(g, sx + s, sy + s * 0.65, 2, 2, c);
          px(g, sx + s, sy - s * 0.65, 2, 2, c);
        }
      }, 250);
      if (near) Sound.play("cb_mark");
      break;
    }
    case 5: {
      // 낙인 폭발! — collapsing arcane rune seal + vertical violet light pillar
      f.flash(x, y, 10);
      f.burst(x, y, 0.65, col, 20, 2.3);
      f.ring(x, y, 24, col, 300, true);
      S3.fxCustom((g, k) => {
        const w = Math.max(2, Math.round(12 * (1 - k))), h = Math.round(32 + k * 18);
        g.globalAlpha = (1 - k) * 0.85;
        px(g, sx - w / 2, sy0 - h, w, h, col);
        px(g, sx - Math.max(1, w >> 2), sy0 - h, Math.max(1, w >> 1), h, "#ffffff");
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + k * 3, r = 18 * (1 - k * 0.6);
          px(g, sx + Math.cos(a) * r - 1, sy + Math.sin(a) * r * 0.5 - 1, 2, 2, "#ffd0ff");
        }
      }, 300);
      if (near) Sound.play("cb_brand");
      break;
    }
    case 6: {
      // 점화! — roaring pixel fire column + scorched ground crack + triple flame burst
      f.flash(x, y, 12);
      f.burst(x, y, 0.5, "#ff5a26", 26, 2.7);
      f.burst(x, y, 1, "#ffe852", 14, 2.2);
      f.crack(x, y, 20, "#ff7a2a", 450);
      f.wave(x, y, 30, col, 320);
      S3.fxCustom((g, k) => {
        g.globalAlpha = 1 - k * 0.9;
        for (let i = 0; i < 9; i++) {
          const u = i / 8, h = u * (38 + k * 16), r = Math.max(2, Math.round((1 - u * 0.7) * 10 * (1 - k * 0.5)));
          const wobble = Math.sin(k * 14 + i) * 3;
          px(g, sx + wobble - r, sy0 - h - r, r * 2, r + 2, i < 3 ? "#ffe852" : i < 6 ? "#ff7a26" : "#c82818");
          if (i < 4) px(g, sx + wobble - (r >> 1), sy0 - h - r + 1, Math.max(1, r), r, "#ffffff");
        }
      }, 320);
      if (near) Sound.play("ignite_burst");
      break;
    }
    case 7: {
      // 결집! — inward vacuum implosion rings + emerald core snap
      f.wave(x, y, 30, col, 260);
      f.ring(x, y, 16, "#ffffff", 220);
      f.burst(x, y, 0.4, col, 16, 1.8);
      S3.fxCustom((g, k) => {
        const r = Math.max(2, (1 - k) * 26);
        g.globalAlpha = 0.9 * (1 - k * 0.5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + k * 4;
          px(g, sx + Math.cos(a) * r - 1, sy + Math.sin(a) * r * 0.55 - 1, 3, 3, "#2b2233");
          px(g, sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.55, 2, 2, i % 2 ? "#ffffff" : col);
        }
      }, 240);
      if (near) Sound.play("cb_gather");
      break;
    }
    case 9: {
      // 띄우기 — rising spiral wind gust + upward white sparkles
      f.burst(x, y, 0.2, col, 12, 1.7);
      S3.fx.sparkle(x, y, 1.2, "#ffffff", 8);
      S3.fxCustom((g, k) => {
        g.globalAlpha = 1 - k;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 3 + k * 5, h = i * 2.5 + k * 16, r = 11 - i * 0.5;
          px(g, sx + Math.cos(a) * r, sy0 - h + Math.sin(a) * r * 0.4, 2, 2, i % 2 ? "#ffffff" : col);
        }
      }, 260);
      if (near) Sound.play("cb_launch");
      return;
    }
    default:
      f.burst(x, y, 0.6, col, 16, 2.2); f.ring(x, y, 18, col, 260);
  }
  if (near) B.shake(code === 2 || code === 6 ? 5 : 3);
}
