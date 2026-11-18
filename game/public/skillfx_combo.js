/**
 * The combo skills' effects (docs/design/skill-combos.md): the "cb" event (a combo state spent on a monster,
 * or 9 = launched) and the six combo actives' "a" codes 140–145. skillfx.js skillEvent hands them here first.
 * The actives draw in their job's palette (jobpal.js); each cashed-in state has its own payoff.
 *   ["cb", mobId, code]  1 경직 2 빙결(파쇄) 3 공중(추가타) 4 표식(폭발) 5 낙인 6 화상(점화) 7 끌림(결집) 9 띄우기
 *   ["a", eid, kind, x, y, dir, 2, extra]  extra 0 = wind-up/start; drain beats 1, finisher 2; else the strike
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { fxPal, fxSkill, skillOwner } from "./jobpal.js";

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
        else if (kind === 145) Sound.play("snipe_wind");
        else if (kind === 144) Sound.play("soul_drain");
      }
    }
    return true;
  }
  if (eid !== G.you) { src.atkT = t; src.dir = dir; src.atkN = 2; } else { G.me.dir = dir; G.me.atkN = 2; }
  src.aim = [tx, ty];
  switch (kind) {
    case 140: f.burst(tx, ty, 0.3, col, 22, 2.4); f.wave(tx, ty, 26, p.l, 300); f.crack(tx, ty, 24, p.l, 480); B.shake(mine ? 6 : 3); if (near) Sound.play("cleave_hit"); break;
    case 141: f.burst(tx, ty, 0.6, col, 10 + extra * 4, 2); f.sparkle(tx, ty, 0.6, p.a, 4 + extra * 2); if (extra >= 3) f.ring(tx, ty, 32, p.a, 300, true); if (near) Sound.play("rupture", extra); break;
    case 142: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, p.l, 0.04, 60); f.spark(tx, ty, p.a, 1); if (near) Sound.play("hook_chain"); break;
    case 143: f.ring(tx, ty, extra, col, 360, true); f.burst(tx, ty, 0.4, col, 26, 2.6); f.burst(tx, ty, 0.8, p.l, 12, 2); f.sparkle(tx, ty, 0.6, p.a, 10); B.shake(mine ? 5 : 3); if (near) Sound.play("ignite_burst"); break;
    case 144: f.proj(tx, ty, 0.6, src.x, src.y, 0.8, col, 0.04, extra === 2 ? 30 : 50); if (extra === 2) { f.burst(tx, ty, 0.6, p.l, 16, 2); f.ring(src.x, src.y, 18, p.a, 300); } if (near) Sound.play(extra === 2 ? "soul_drain_fin" : "soul_drain"); break;
    case 145: f.flash(src.x, src.y, 8); f.proj(src.x, src.y, 0.75, tx, ty, 0.5, p.l, 0.03, 20); f.spark(tx, ty, p.a, 1.3); if (near) Sound.play("snipe_shot"); break;
    // 돌개바람 / 무쌍난무: a spinning ring at the caster every beat
    case 146: case 147: f.ring(src.x, src.y, kind === 146 ? 46 : 52, col, 220, extra === 2); f.burst(src.x, src.y, 0.3, p.l, 6, 1.6); if (near) Sound.play(kind === 146 ? "whirl_slash" : "musou_thrust", extra === 2); break;
  }
  const skId = fxSkill(kind);
  const playJobNote = (kind !== 144 && kind < 146) || extra === 2;
  if (near && skId && playJobNote) Sound.play("job_note", { job: skillOwner(skId), sig: kind >= 146 });
  return true;
}
/** A combo state cashed in on monster `m` (skill-combos.md §7): each its own payoff, a shake when it is near. */
function payoff(G, B, f, m, code, col) {
  const x = m.x, y = m.y, near = !!G.me && Math.hypot(x - G.me.x, y - G.me.y) < 220;
  switch (code) {
    case 2: f.flash(x, y, 8); f.burst(x, y, 1, "#ffffff", 10, 2.8); f.burst(x, y, 0.7, col, 22, 2.4); f.ring(x, y, 22, "#e8f8ff", 280, true); if (near) Sound.play("cb_shatter"); break; // 파쇄
    case 3: f.fall(x, y, col, 80); f.flash(x, y, 8); f.burst(x, y, 0.8, col, 14, 2.2); if (near) Sound.play("cb_aerial"); break;               // 추가타
    case 6: f.flash(x, y, 10); f.burst(x, y, 0.5, "#ff5a26", 24, 2.6); f.burst(x, y, 1, "#ffe852", 12, 2); f.wave(x, y, 28, col, 320); if (near) Sound.play("ignite_burst"); break; // 점화
    case 7: f.wave(x, y, 30, col, 260); f.ring(x, y, 14, "#ffffff", 200); f.burst(x, y, 0.3, col, 14, 1.6); if (near) Sound.play("cb_gather"); break; // 결집
    case 9: f.burst(x, y, 0.2, col, 10, 1.6); S3.fx.sparkle(x, y, 1.2, "#ffffff", 6); if (near) Sound.play("cb_launch"); return;               // 띄우기
    default:
      f.burst(x, y, 0.6, col, 16, 2.2); f.ring(x, y, 18, col, 260);
      if (code === 1) { f.crack(x, y, 18, col, 420); if (near) Sound.play("cb_stagger"); }
      else if (code === 4 && near) Sound.play("cb_mark");
      else if (code === 5 && near) Sound.play("cb_brand");
  }
  if (near) B.shake(code === 2 || code === 6 ? 5 : 3);
}
