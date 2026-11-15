/**
 * The combo skills' effects (docs/design/skill-combos.md): the "cb" event (a combo state spent on a monster,
 * or 9 = launched) and the six combo actives' "a" codes 140–145. skillfx.js skillEvent hands them here first.
 * Plain first-pass looks: the art pass may replace any of them without touching the rules.
 *   ["cb", mobId, code]  1 경직 2 빙결(파쇄) 3 공중(추가타) 4 표식(폭발) 5 낙인 6 화상(점화) 7 끌림(결집) 9 띄우기
 *   ["a", eid, kind, x, y, dir, 2, extra]  extra 0 = wind-up/start; drain beats 1, finisher 2; else the strike
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";

const now = () => performance.now();
const text = (G, str, x, y, h, col) => G.texts.push({ str, x, y, h, col, big: true, t0: now() });
/** code → [word, colour]. */
const CB = {
  1: ["경직 강타!", "#ffd86a"], 2: ["파쇄!", "#bfe8ff"], 3: ["추가타!", "#fff2a8"], 4: ["표식 폭발!", "#ff7ad0"],
  5: ["낙인 폭발!", "#c890ff"], 6: ["점화!", "#ff9a3a"], 7: ["결집!", "#9fe0c0"], 9: ["띄우기", "#e8f0ff"],
};
const COL = { 140: "#ffe0a0", 141: "#ff7ad0", 142: "#c8fff0", 143: "#ff8a3a", 144: "#b08aff", 145: "#e8fff0" };

/** True when the event was one of ours (drawn). */
export function comboEvent(e, ctx) {
  const { G, entityPos, t } = ctx;
  const f = S3.big().fx;
  if (e[0] === "cb") {
    const m = G.mobs.get(e[1]), c = CB[e[2]];
    if (!m || !c) return true;
    text(G, c[0], m.x, m.y, (m.h3 || 1.3) + 0.5, c[1]);
    if (e[2] === 9) f.burst(m.x, m.y, 0.2, c[1], 10, 1.6);
    else { f.burst(m.x, m.y, 0.6, c[1], 16, 2.2); f.ring(m.x, m.y, 18, c[1], 260); }
    return true;
  }
  const [, eid, kind, tx, ty0, dir, , extra = 0] = e;
  const src = entityPos(eid), ty = ty0 + 6, col = COL[kind];
  if (!src) return true;
  if (!extra) {
    // the wind-up (or a channel opening): light gathering on the caster, or a warning ring on a ground spell's spot
    if (kind === 143) f.ring(tx, ty, 40, col, 400);
    else f.sparkle(src.x, src.y, 0.9, col, 10);
    return true;
  }
  if (eid !== G.you) { src.atkT = t; src.dir = dir; src.atkN = 2; } else { G.me.dir = dir; G.me.atkN = 2; }
  src.aim = [tx, ty];
  switch (kind) {
    case 140: f.burst(tx, ty, 0.3, col, 22, 2.4); f.wave(tx, ty, 26, col, 300); S3.big().shake(5); Sound.play("slam"); break;
    case 141: f.burst(tx, ty, 0.6, col, 10 + extra * 4, 2); if (extra >= 3) f.ring(tx, ty, 32, col, 300, true); Sound.play("tip"); break;
    case 142: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, col, 0.04, 60); Sound.play("shoot"); break;
    case 143: f.ring(tx, ty, extra, col, 360, true); f.burst(tx, ty, 0.4, col, 26, 2.6); S3.big().shake(4); Sound.play("boom"); break;
    case 144: f.proj(tx, ty, 0.6, src.x, src.y, 0.8, col, 0.04, extra === 2 ? 30 : 50); if (extra === 2) f.burst(tx, ty, 0.6, col, 16, 2); break;
    case 145: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, col, 0.03, 20); Sound.play("shoot"); break;
  }
  return true;
}
