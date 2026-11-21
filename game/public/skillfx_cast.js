/**
 * Each skill by its fx code (split from skillfx.js): the hero's body motion (`triggerSkillMotion`, read by
 * scene_people.js as `e.skMot`), what an active looks like at the caster and where it lands (`cast`), the passives'
 * flashes (`passive`), the job's note under every skill, and the passive procs ("ps", `procFx`).
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { procPfx } from "./skillpfx.js";
import { fxPal, fxSkill, skillDef, skillOwner, skillPal } from "./jobpal.js";
import { setPal, at, px, INK, now, text, later, along, shards, rim, skillNear, lineOf, qi, fan, ELEM_COL } from "./skillfx_kit.js";
import { swordCrescent, rendSlam, rendWave, verdictSpin, ambushCuts, flurrySlash, shadowAfterimage, spiralThrust, cometCharge, abyssDive, crossCutFx, streakWake } from "./skillfx_melee.js";
import { fireballOrb, frostNovaRing, soulTrail, pierceMuzzle, crimsonArcWave, iceSpire, chainLightningArc } from "./skillfx_spell.js";
import { bowFire } from "./skillfx_bow.js";

const DIR_W = [[0, 1], [-1, 0], [1, 0], [0, -1]];

/**
 * Character body & weapon skill motions rendered by scene_people.js (`e.skMot`).
 * Maps every active skill FX code (70–159) to a distinct kinetic motion:
 * 8-way spins, semi-transparent dash-and-return blinks, parabolic leap slams,
 * backflip shots, forward lunges, elevated raise-casts, heavy chops, stomps, and recoils.
 */
export function triggerSkillMotion(src, kind, tx, ty, t, extra = 0, wind = 0) {
  if (!src || src.dead) return;
  const clk = t || now();
  const dx = tx - src.x, dy = ty - src.y;
  const d = Math.hypot(dx, dy);
  const [wdx, wdy] = d > 2 ? [dx, dy] : DIR_W[src.dir | 0] || [0, 1];
  const sa = S3.sAng(wdx, wdy);
  const set = (m) => { src.skMot = { t0: clk, sa, ...m, until: clk + m.dur }; };

  switch (kind) {
    // ── 8-direction continuous spins (hero + weapon whirl together)
    case 146: // 바바리안 돌개바람
    case 147: { // 창술사 무쌍난무
      const rate = kind === 146 ? 13.5 : 16.5;
      const keep = extra === 2 ? 190 : kind === 146 ? 410 : 310;
      if (src.skMot && src.skMot.type === "spin" && src.skMot.kind === kind && clk < src.skMot.until + 80) {
        src.skMot.until = clk + keep;
        src.skMot.dur = Math.max(src.skMot.dur, src.skMot.until - src.skMot.t0);
      } else {
        src.skMot = { type: "spin", kind, t0: clk, dur: keep, until: clk + keep, sa, rate };
      }
      return;
    }
    case 155: // 단검 칼날 소용돌이
      if (!extra) return;
      if (src.skMot && src.skMot.type === "spin" && src.skMot.kind === 155 && clk < src.skMot.until + 60) {
        src.skMot.until = clk + 260;
      } else {
        set({ type: "spin", kind: 155, dur: 300, rate: 20 });
      }
      return;

    // ── Semi-transparent dash toward target & snap back with ghost afterimages
    case 86: // 도적 무영난무
      set({ type: "blink_dash", dur: 220, dist: 22, alpha: 0.36, ghosts: 2 });
      return;
    case 84: // 단검 암습
      set({ type: "blink_dash", dur: 270, dist: 20, alpha: 0.40, ghosts: 2 });
      return;
    case 120: // 블레이드댄서 십자 난도
      set({ type: "blink_dash", dur: 340, dist: 22, alpha: 0.48, ghosts: 2, cross: true });
      return;
    case 141: // 단검 표식 파열
      if (!extra) return;
      set({ type: "blink_dash", dur: 230, dist: 15, alpha: 0.56, ghosts: 1 });
      return;

    // ── Parabolic jump up into the air & overhead slam down
    case 99: // 마창사 빙결 강림 (0.8s aerial rise + frost-lance plunge)
      set({ type: "leap_slam", dur: 840, h: 40, dist: 10, apex: 0.72, wep: "plunge" });
      return;
    case 81: // 대검 대지 가르기
      set({ type: "leap_slam", dur: 420, h: 22, dist: 9, apex: 0.56, wep: "slam" });
      return;
    case 132: // 파괴자 파성추 (wind-up leap -> crushing impact)
      set({ type: "leap_slam", dur: Math.max(420, (wind || 400) + 150), h: 27, dist: 6, apex: 0.68, wep: "slam" });
      return;
    case 133: // 파괴자 철쇄 돌진
      set({ type: "leap_slam", dur: 360, h: 16, dist: 14, apex: 0.50, wep: "slam" });
      return;
    case 134: // 성기사 성문 서약
      set({ type: "leap_slam", dur: 400, h: 19, dist: 4, apex: 0.54, wep: "slam" });
      return;

    // ── Nimble backflip / evasive shadow hop
    case 95: // 활 도약 사격
      set({ type: "backflip", dur: 340, h: 15, dist: -14, tilt: 0.35 });
      return;
    case 151: // 활 구르며 쏘기
      if (!extra) return;
      set({ type: "backflip", dur: 310, h: 12, dist: -12, roll: true });
      return;
    case 98: // 추적자 사방의 그림자 덫
      set({ type: "backflip", dur: 380, h: 15, dist: -11, alpha: 0.42, ghosts: 2 });
      return;
    case 157: // 단검 연막탄
      if (!extra) return;
      set({ type: "backflip", dur: 300, h: 12, dist: -10, alpha: 0.48, ghosts: 1 });
      return;

    // ── Explosive forward lunges & thrusts
    case 87: // 창 나선 찌르기
      set({ type: "lunge", dur: 300, dist: 18, ghosts: 1, wep: "thrust" });
      return;
    case 88: // 창 유성창
      set({ type: "lunge", dur: 320, dist: 19, h: 4, ghosts: 2, wep: "thrust" });
      return;
    case 125: // 마창사 빙결창
      set({ type: "lunge", dur: 290, dist: 16, ghosts: 1, wep: "thrust" });
      return;
    case 85: // 단검 그림자 칼날
      set({ type: "lunge", dur: 250, dist: 12, alpha: 0.65, ghosts: 1 });
      return;
    case 153: // 어깨 돌파
      if (!extra) return;
      set({ type: "lunge", dur: 290, dist: 19, h: 4, ghosts: 1 });
      return;
    case 142: // 창 갈고리 끌어당기기
      if (!extra) return;
      set({ type: "lunge", dur: 320, dist: 11, yank: true, wep: "thrust" });
      return;
    case 156: // 단검 칼날 흩뿌리기
      if (!extra) return;
      set({ type: "lunge", dur: 250, dist: 11 });
      return;

    // ── Heavy overhead cleaves & wind-up charges
    case 83: // 바바리안 단죄의 일격
      set({ type: "heavy_overhead", dur: 370, h: 12, dist: 7, wep: "slam" });
      return;
    case 97: // 스펠블레이드 홍련참
      set({ type: "heavy_overhead", dur: 350, h: 11, dist: 9, wep: "slam" });
      return;
    case 80: // 대검 파워 슬래쉬
      set({ type: "heavy_overhead", dur: 270, h: 6, dist: 7 });
      return;
    case 130: // 해머 쐐기찍기
      set({ type: "heavy_overhead", dur: Math.max(300, (wind || 200) + 130), h: 10, dist: 4, wep: "slam" });
      return;
    case 131: // 해머 금맥 벌리기
      set({ type: "heavy_overhead", dur: Math.max(320, (wind || 200) + 140), h: 13, dist: 5, wep: "slam" });
      return;
    case 140: // 대검 처형 내려베기
      if (!extra) set({ type: "brace", dur: 420, crouch: 0.16, tremble: true });
      else set({ type: "heavy_overhead", dur: 350, h: 13, dist: 8, wep: "slam" });
      return;
    case 159: // 대검 산 가르기
      if (!extra) set({ type: "brace", dur: 520, crouch: 0.2, tremble: true });
      else set({ type: "heavy_overhead", dur: 380, h: 15, dist: 9, wep: "slam" });
      return;
    case 158: // 대검 칼등 받아치기
      if (!extra) set({ type: "brace", dur: 520, crouch: 0.14 });
      else set({ type: "lunge", dur: 260, dist: 11, h: 5 });
      return;

    // ── Snappy stomp hops
    case 148: // 해머 땅울림 발구르기
      if (!extra) return;
      set({ type: "stomp_hop", dur: 340, h: 12, sq: 0.30 });
      return;
    case 100: // 블레이드댄서 혈흔 폭발
      set({ type: "stomp_hop", dur: 350, h: 11, sq: 0.24, alpha: 0.72 });
      return;

    // ── Elevated raise-casts (hover / raise staff, book, spear, hammer skyward)
    case 71: // 서리 고리
      set({ type: "raise_cast", dur: 340, h: 7, wep: "raise" });
      return;
    case 89: // 창술사 뇌룡승천
      set({ type: "raise_cast", dur: 430, h: 11, wep: "raise" });
      return;
    case 90: // 마법사 메테오 스톰
      set({ type: "raise_cast", dur: 480, h: 12, wep: "raise" });
      return;
    case 91: // 마도서 영혼 화살
      set({ type: "raise_cast", dur: 270, h: 5, dist: -4, wep: "raise" });
      return;
    case 92: // 마도서 중력 왜곡진
    case 93: // 마도사 심연의 계약
      set({ type: "raise_cast", dur: 420, h: 10, wep: "raise" });
      return;
    case 102: // 성기사 성광의 성역
      set({ type: "raise_cast", dur: 440, h: 11, wep: "raise" });
      return;
    case 126: // 룬브레이커 메아리 법진
      set({ type: "raise_cast", dur: 420, h: 10, wep: "raise" });
      return;
    case 128: // 룬브레이커 룬 파쇄탄
      set({ type: "raise_cast", dur: 320, h: 6, dist: -5, wep: "raise" });
      return;
    case 135: // 창 전열 구호기
    case 136: // 마도서 되살림 제본
      set({ type: "raise_cast", dur: 380, h: 9, wep: "raise" });
      return;
    case 143: // 스태프 점화 폭발
      if (!extra) set({ type: "raise_cast", dur: 380, h: 5, wep: "raise" });
      else set({ type: "raise_cast", dur: 340, h: 9, wep: "raise" });
      return;
    case 144: // 마도서 영혼 흡수
      set({ type: "raise_cast", dur: 280, h: 5, wep: "raise" });
      return;
    case 152: // 스태프 연쇄 번개
      if (!extra) return;
      set({ type: "raise_cast", dur: 270, h: 6, wep: "raise" });
      return;

    // ── Recoil & skyward volley shots
    case 70: // 스태프 파이어볼
      set({ type: "recoil_shot", dur: 240, dist: -6, h: 3 });
      return;
    case 94: // 활 관통 화살
      set({ type: "recoil_shot", dur: 270, dist: -8 });
      return;
    case 96: // 헌터 화살비 (aim skyward!)
      set({ type: "recoil_shot", dur: 380, dist: -4, h: 6, wep: "sky" });
      return;
    case 124: // 트릭스터 원소 환영탄
      set({ type: "recoil_shot", dur: 290, dist: -7, h: 5 });
      return;
    case 145: // 활 저격
      if (!extra) set({ type: "brace", dur: 460, crouch: 0.14 });
      else set({ type: "recoil_shot", dur: 310, dist: -11 });
      return;
    case 149: // 활 곡사 폭약 화살
      if (extra === 1) set({ type: "recoil_shot", dur: 300, dist: -5, h: 4, wep: "sky" });
      return;
    case 150: // 활 용뼈 관통 사격
      if (!extra) return;
      set({ type: "recoil_shot", dur: 340, dist: -13, h: 3 });
      return;
    case 154: // 활 올무 화살
      if (!extra) return;
      set({ type: "recoil_shot", dur: 250, dist: -6 });
      return;

    // ── JOB-01: remaining 7 Lv.30 job signatures
    case 160: // 스펠블레이드 성광 마검: 유성낙하 (도약 수직 강타)
      set({ type: "leap_slam", dur: 520, h: 32, dist: 12, apex: 0.62, wep: "slam" });
      return;
    case 161: // 도적 칠흑의 사형선고 (반투명 고속 암살 돌진 + X자 잔상)
      set({ type: "blink_dash", dur: 320, dist: 24, alpha: 0.34, ghosts: 3, cross: true });
      return;
    case 162: // 마법사 삼원소 대격변 (공중 부양 대마법 영창)
      set({ type: "elevated_cast", dur: 560, h: 16, wep: "raise" });
      return;
    case 163: // 트릭스터 환영 만화경 (반투명 후방 공중제비 + 잔상)
      set({ type: "backflip", dur: 380, h: 16, dist: -13, alpha: 0.38, ghosts: 3 });
      return;
    case 164: // 마도사 금서 해방: 영혼 수확 (부유 후 암흑 낫 휩쓸기)
      set({ type: "heavy_overhead", dur: 440, h: 14, dist: 6, wep: "raise" });
      return;
    case 165: // 헌터 질풍 연사: 천궁의 화살 (연속 강사 반동)
      set({ type: "recoil_shot", dur: extra === 2 ? 340 : 240, dist: extra === 2 ? -11 : -6, h: extra === 2 ? 4 : 1 });
      return;
    case 166: // 추적자 맹독 혈우: 사냥감 낙인 (천공 독화살 발사)
      set({ type: "sky_bow", dur: 400, h: 8, wep: "sky" });
      return;

    // ── JOB-02: 14 more job actives (fx 170–183)
    case 170: set({ type: "heavy_overhead", dur: 460, h: 10, dist: 4, wep: "raise" }); return;
    case 171: set({ type: "leap_slam", dur: 480, h: 22, dist: 6, apex: 0.6, wep: "slam" }); return;
    case 172: set({ type: "blink_dash", dur: 260, dist: 20, alpha: 0.34, ghosts: 3 }); return;
    case 173: set({ type: "blink_dash", dur: 300, dist: Math.min(30, extra || 24), alpha: 0.4, ghosts: 3, cross: true }); return;
    case 174: set({ type: "heavy_overhead", dur: 420, h: 6, dist: 8, wep: "raise" }); return;
    case 175: set({ type: "blink_dash", dur: 240, dist: 14, alpha: 0.5, ghosts: 2 }); return;
    case 176: set({ type: "backflip", dur: 360, h: 14, dist: -12, alpha: 0.4, ghosts: 3 }); return;
    case 177: set({ type: "backflip", dur: 340, h: 12, dist: -6 }); return;
    case 178: if (extra) return; set({ type: "elevated_cast", dur: 520, h: 14, wep: "raise" }); return;
    case 179: set({ type: "elevated_cast", dur: 480, h: 10, wep: "raise" }); return;
    case 180: set({ type: "recoil_shot", dur: 200, dist: -5, h: 1 }); return;
    case 181: set({ type: "sky_bow", dur: 380, h: 6, wep: "sky" }); return;
    case 182: if (extra > 40) return; set({ type: "leap_slam", dur: 500, h: 18, dist: 4, apex: 0.6, wep: "slam" }); return;
    case 183: set({ type: "elevated_cast", dur: 520, h: 12, wep: "raise" }); return;
  }
}

/** A passive showing itself where it happened: no swing, a sign and a small sound. */
export function passive(kind, src, eid, tx, ty, G) {
  const p = setPal(fxPal(kind, G, eid));
  const f = S3.fx, mine = eid === G.you;
  switch (kind) {
    case 110: f.ring(src.x, src.y, 22, p.m, 300); f.sparkle(src.x, src.y, 0.6, p.m, 10); if (mine) { text(G, "관성 최대", src.x, src.y, 1.9, p.m); Sound.play("inertia_full"); } break;
    case 111: f.burst(tx, ty, 0.5, p.m, 10, 1.6); f.spark(tx, ty, p.m, 0.9); if (mine) Sound.play("bleed"); break;
    case 113: f.ring(src.x, src.y, 20, p.l, 360); f.sparkle(src.x, src.y, 0.8, p.l, 14); if (mine) { text(G, "공명!", src.x, src.y, 1.9, p.l); Sound.play("reso_ready"); } break;
    case 114: f.spark(tx, ty, p.al, 1); f.ring(tx, ty, 12, p.m, 260); if (mine) Sound.play("brand"); break;
    case 115: f.spark(tx, ty, p.m, 1.1); if (mine) { text(G, "원거리!", tx, ty, 1.5, p.m); Sound.play("hawk_eye"); } break;
  }
}

/** A skill being used: what it looks like at the caster and where it lands. */
export function cast(kind, src, eid, tx, ty, extra, G) {
  const p = setPal(fxPal(kind, G, eid));
  const ang = Math.hypot(tx - src.x, ty - src.y) > 2 ? Math.atan2(ty - src.y, tx - src.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][src.dir] || 0;
  // scaled-up effects, and a shake that kicks along the skill's aim
  const B = S3.big(ang), f = B.fx, mine = eid === G.you;
  const near = mine || skillNear(G, src.x, src.y) || skillNear(G, tx, ty);
  const play = (key) => { if (near) Sound.play(key); };
  switch (kind) {
    // ── 스태프
    case 70: {
      const r = G.defs?.skills?.fireball?.r || 30;
      fireballOrb(src.x, src.y, tx, ty, r, near);
      play("fireball_cast"); break;
    }
    case 71: {
      const r = extra || 56;
      frostNovaRing(src.x, src.y, r);
      B.shake(4); play("frost"); break;
    }
    case 90: f.sparkle(src.x, src.y, 1.2, p.m, 18); f.ring(tx, ty, extra || 80, p.m, 500); if (mine) text(G, "메테오 스톰!", src.x, src.y, 2.2, p.m, true); play("meteor_cast"); break;
    // ── 대검
    case 80: {
      // a wide crescent of steel thrown off the swing, and everything in it reels
      const r = extra || 46;
      swordCrescent(src.x, src.y, ang, r);
      shards(tx, ty, r * 0.32, 5, 12, p.m, p.w, 240, 96);
      B.shake(6); play("power_slash");
      break;
    }
    case 81: {
      rendSlam(tx, ty, extra || 38);
      B.shake(8); play("slam");
      break;
    }
    case 82: {
      // the split running on ahead: full-width earth corridor (half = 14, len = 120) from the landing point
      const l = lineOf(9), wl = extra || 120;
      const ax = l && Math.hypot(tx - l.bx, ty - l.by) > 8 ? l.bx : Math.hypot(tx - src.x, ty - src.y) > wl + 15 ? tx - Math.cos(ang) * wl : src.x;
      const ay = l && Math.hypot(tx - l.bx, ty - l.by) > 8 ? l.by : Math.hypot(tx - src.x, ty - src.y) > wl + 15 ? ty - Math.sin(ang) * wl : src.y;
      rendWave(ax, ay, tx, ty, G.defs?.skills?.rend?.half || 14);
      play("quake");
      break;
    }
    case 83: {
      verdictSpin(src.x, src.y, ang, extra || 70);
      B.shake(12); play("verdict");
      if (mine) text(G, "단죄의 일격!", src.x, src.y, 2.3, p.m, true);
      break;
    }
    // ── 단검
    case 84: {
      // The blink is a separate line event; these cuts belong only to the struck target.
      ambushCuts(tx, ty, ang);
      S3.fx.arrowHit(tx, ty, ang, p.l, true, 12);
      if (near) B.shake(3.5);
      play("swap"); break;
    }
    case 85: {
      // The three blade lanes arrive immediately after this cast; keep the release local.
      S3.fx.arrowHit(src.x + Math.cos(ang) * 8, src.y + Math.sin(ang) * 8, ang, p.l, false, 14);
      S3.fx.burst(src.x, src.y, 0.55, p.m, 5, 1.1);
      play("shade"); break;
    }
    case 86:
      if (extra === 1) {
        flurrySlash(tx, ty, ang);
        B.shake(3.5); play("crit");
      } else {
        const r = G.defs?.skills?.flurry?.r || 90;
        rim(src.x, src.y, r, p.md, p.l, 420, 0.2);
        for (let i = 0; i < 4; i++) {
          const a = i * (Math.PI / 2) + 0.4;
          shadowAfterimage(src.x + Math.cos(a) * 18, src.y + Math.sin(a) * 18, 280);
        }
        f.burst(src.x, src.y, 0.6, p.d, 28, 1.8);
        play("dance");
        if (mine) text(G, "무영난무!", src.x, src.y, 2.2, p.l, true);
      }
      break;
    // ── 창
    case 87: {
      spiralThrust(src.x, src.y, tx, ty);
      if (near) B.shake(3.5);
      play("spiral");
      break;
    }
    case 88: {
      const line = lineOf(3);
      const a = line && Math.hypot(line.bx - tx, line.by - ty) < 6
        ? Math.atan2(line.by - line.ay, line.bx - line.ax) : ang;
      const ax = line ? line.ax : tx - Math.cos(a) * 96;
      const ay = line ? line.ay : ty - Math.sin(a) * 96;
      cometCharge(ax, ay, tx, ty, G.defs?.skills?.comet?.half || 20);
      if (near) B.shake(6, a);
      play("hundred");
      break;
    }
    case 89: {
      const r = extra || 64;
      S3.fx.zap(tx, ty, p.l, 240);
      rim(tx, ty, r, p.m, p.w, 500, 0.72);
      rim(tx, ty, r * 0.61, p.m, p.l, 340, 0.4);
      shards(tx, ty, r * 0.7, 8, 28, p.m, p.l, 325, 27);
      B.shake(6); play("dragon"); if (mine) text(G, "뇌룡승천!", src.x, src.y, 2.2, p.l, true); break;
    }
    // ── 마도서
    case 91: {
      // a dark bolt that takes its time (the server's queued hit lands when it arrives)
      const ms = extra || 300;
      soulTrail(src.x, src.y, tx, ty, ms);
      later(ms, () => {
        S3.fx.flash(tx, ty, 6);
        rim(tx, ty, 16, p.md, p.l, 260, 0.6);
        shards(tx, ty, 15, 6, 14, p.md, p.m, 240);
        play("soulbolt_end");
      });
      S3.fx.sparkle(src.x, src.y, 0.8, p.m, 6); play("soulbolt");
      break;
    }
    case 92: {
      const r = extra || 60;
      rim(tx, ty, r, p.md, p.l, 340, 0.45);
      B.shake(1.8); play("gravity");
      break;
    }
    case 93: f.sparkle(src.x, src.y, 1, p.m, 20); play("pact"); if (mine) text(G, "심연의 계약", src.x, src.y, 2.2, p.l, true); break;
    // ── 활 (the pose and the twang: bowFire; the arrows come as "ar")
    case 94: SkillFx_bow(G, src, false); pierceMuzzle(src.x, src.y, tx, ty); play("pierce"); break;
    case 95: {
      SkillFx_bow(G, src, false);
      for (let j = -2; j <= 2; j++) {
        const a = ang + j * 0.13;
        S3.fx.spark(src.x + Math.cos(a) * 10, src.y + Math.sin(a) * 10, j % 2 ? p.m : p.al, 0.9);
      }
      f.burst(src.x, src.y, 0.1, p.m, 10, 1.5);
      play("leapshot");
      break;
    }
    case 96: SkillFx_bow(G, src, true); f.sparkle(src.x, src.y, 1.4, p.w, 10); play("rain"); if (mine) text(G, "화살비!", src.x, src.y, 2.2, p.l, true); break;
    // ── hybrid signatures
    case 97: {
      // 원소 마검: 홍련참 — full-width (half=20) Fire + Lightning crescent wave
      crimsonArcWave(src.x, src.y, tx, ty, G.defs?.skills?.crimson?.half || 20);
      B.shake(8); play("crimson");
      if (mine) text(G, "홍련참!", src.x, src.y, 2.2, p.m, true);
      break;
    }
    case 98: f.burst(tx, ty, 0.6, p.d, 30, 1.6); f.ring(tx, ty, 45, p.m, 400); play("decoy"); break;
    case 99: {
      abyssDive(tx, ty, extra || 110);
      iceSpire(tx, ty);
      B.shake(10); play("dive");
      if (mine) text(G, "빙결 강림!", src.x, src.y, 2.3, p.l, true);
      break;
    }
    case 100: f.ring(src.x, src.y, extra || 100, p.m, 400); f.sparkle(src.x, src.y, 0.8, p.m, 16); play("blood_bind"); break;
    case 101: f.zap(tx, ty, p.l, 300); f.ring(tx, ty, 40, p.al, 360, true); B.shake(9); play("thunder"); if (mine) text(G, "천뢰!", src.x, src.y, 2.2, p.l, true); break;
    // ── the hybrid expansion (docs/design/jobs-and-stats.md H.4)
    case 120: {
      // 십자 난도: the great blade's crescent across everything ahead, then a dagger's X on each one it swept
      const r = extra || 64;
      crossCutFx(src.x, src.y, ang, r);
      B.shake(9); play("cross_cut");
      const swept = [...G.mobs.values()].filter((m) => !m.dead && Math.hypot(m.x - src.x, m.y - src.y) <= r + 8 && Math.cos(Math.atan2(m.y - src.y, m.x - src.x) - ang) > 0.5).slice(0, 8);
      later(170, () => {
        if (swept.length) {
          for (const m of swept) flurrySlash(m.x, m.y, ang);
          B.shake(4);
        } else {
          flurrySlash(src.x + Math.cos(ang) * r * 0.58, src.y + Math.sin(ang) * r * 0.58, ang);
        }
      });
      if (mine) text(G, "십자 난도!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 121: {
      // 파진돌격: the charge's streak is the "ln 3" before this; here the great blade comes down where it
      // stopped (the cracks and the ring are the "bw" after) and the spear's reach shows on the rim
      const r = extra || 56, l = lineOf(3), a = l ? Math.atan2(l.by - l.ay, l.bx - l.ax) : ang;
      if (l) { f.beam(l.ax, l.ay - 3, l.bx, l.by - 3, p.l, 0.5); for (const [x, y] of along(l.ax, l.ay, l.bx, l.by, 16)) f.burst(x, y, 0.05, p.m, 3, 1.4); }
      f.fall(tx, ty, p.al, 90);
      f.slash(tx, ty, a, p.m, 1.7); f.slash(tx, ty, a + Math.PI, p.al, 1.3, true);
      for (let i = 0; i < 10; i++) { const q = (i / 10) * 6.28; S3.fx.sparkle(tx + Math.cos(q) * r * 0.86, ty + Math.sin(q) * r * 0.86, 0.2, i % 2 ? p.a : p.al, 2); }
      S3.fx.ring(tx, ty, r * 0.86, p.a, 320, false, 60);
      B.shake(11, a); play("verdict");
      if (mine) text(G, "파진돌격!", tx, ty, 2.3, p.m, true);
      break;
    }
    case 122: {
      // 검기 화살: the bow looses a sword's edge — a white-gold crescent head on a long streak, to the line's end
      SkillFx_bow(G, src, false);
      const ax = src.x, ay = src.y, ms = Math.max(140, Math.hypot(tx - ax, ty - ay) * 1.5);
      const [sx0, sy0] = at(ax, ay, 11), [sx1, sy1] = at(tx, ty, 11), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl, sa = Math.atan2(uy, ux);
      S3.fxCustom((g, k) => {
        const x = sx0 + (sx1 - sx0) * k, y = sy0 + (sy1 - sy0) * k, back = Math.min(sl * k, 46);
        for (let q = 3; q < back; q++) { g.globalAlpha = 1 - q / 46; const w = q < 14 ? 3 : q < 28 ? 2 : 1; px(g, x - ux * q - (w >> 1), y - uy * q - (w >> 1), w, w, q < 10 ? "#ffffff" : q % 3 ? p.l : p.m); }
        g.globalAlpha = 1;
        // the head: a crescent bowed forward, inked gold round a white edge
        for (const [rr, c, w] of [[11, p.m, 3], [10, "#ffffff", 2]]) for (let i = -7; i <= 7; i++) { const q = sa + (i / 7) * 1.15; px(g, x + Math.cos(q) * rr - ux * 7 - 1, y + Math.sin(q) * rr * 0.85 - uy * 7 - 1, w, w, c); }
      }, ms);
      f.beam(ax, ay, tx, ty, p.l, 0.5);
      along(ax, ay, tx, ty, 24).forEach(([x, y], i, all) => later((i / all.length) * ms, () => S3.fx.sparkle(x, y, 0.5, i % 2 ? "#ffffff" : p.m, 2)));
      qi.at = now(); qi.ms = ms;
      f.flash(src.x, src.y, 12); B.shake(7); play("pierce"); play("power_slash");
      if (mine) text(G, "검기 화살!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 123: {
      // 그림자 관통: a spear of shadow thrown down the run (its streak is the "ln 6" before this), afterimages left on the way
      const l = lineOf(6), far = extra || 100;
      const a = l ? Math.atan2(l.by - l.ay, l.bx - l.ax) : ang, ax = l ? l.ax : tx - Math.cos(a) * far, ay = l ? l.ay : ty - Math.sin(a) * far;
      const [sx0, sy0] = at(ax, ay, 10), [sx1, sy1] = at(tx, ty, 10), sl = Math.hypot(sx1 - sx0, sy1 - sy0) || 1, ux = (sx1 - sx0) / sl, uy = (sy1 - sy0) / sl;
      S3.fxCustom((g, k) => {
        const u = Math.min(1, k / 0.3), hx = sx0 + (sx1 - sx0) * u + ux * 8, hy = sy0 + (sy1 - sy0) * u + uy * 8, L = Math.min(sl * u + 8, 60);
        if (k > 0.3) g.globalAlpha = Math.max(0, 1 - (k - 0.3) / 0.7);
        // an inked shaft, a violet core, a pale head with two barbs
        for (let q = 0; q < L; q++) px(g, hx - ux * q - 1, hy - uy * q - 1, 3, 3, INK);
        for (let q = 0; q < L; q++) px(g, hx - ux * q, hy - uy * q, 1, 1, q < 7 ? p.w : q % 4 === 3 ? p.md : p.m);
        for (const o of [-1, 1]) for (let q = 3; q < 7; q++) px(g, hx - ux * q - uy * o * (q - 2) * 0.7, hy - uy * q + ux * o * (q - 2) * 0.7, 1, 1, p.w);
      }, 420);
      along(ax, ay, tx, ty, 26).forEach(([x, y], i) => { f.burst(x, y, 0.5, i % 2 ? p.md : p.md, 4, 0.9); });
      f.burst(tx, ty, 0.5, p.m, 10, 1.8); S3.fx.spark(tx + Math.cos(a) * 10, ty + Math.sin(a) * 10, p.w, 1.2);
      B.shake(7, a); play("shade"); play("spiral");
      if (mine) text(G, "그림자 관통!", tx, ty, 2.2, p.l, true);
      break;
    }
    case 124: {
      // 원소 환영탄 (트릭스터 · 스태프): arcane cast ring + three elemental bolts ("ln 7")
      fan.n = 3; fan.at = now();
      S3.fx.ring(src.x, src.y, 18, p.l, 260, true);
      [1, 2, 3].forEach((el, j) => { const a = ang + (j - 1) * 0.32; S3.fx.spark(src.x + Math.cos(a) * 14, src.y + Math.sin(a) * 14, ELEM_COL[el], 1.0); });
      B.shake(5); play("element_dagger");
      if (mine) text(G, "원소 환영탄!", src.x, src.y, 2.2, p.w, true);
      break;
    }
    case 125: {
      // 빙결창: a line of frost down the thrust, and ice standing up out of the ground where the point stopped
      f.beam(src.x, src.y, tx, ty, "#ffffff", 0.55); f.beam(src.x, src.y + 2, tx, ty + 2, p.l, 0.5);
      along(src.x, src.y, tx, ty, 12).forEach(([x, y], i) => f.sparkle(x, y, 0.5, i % 2 ? p.w : p.l, 2));
      f.ring(tx, ty, 44, p.l, 380, true); f.burst(tx, ty, 0.3, p.w, 16, 2.6);
      iceSpire(tx, ty);
      B.shake(8); play("frost_lance");
      if (mine) text(G, "빙결창!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 126: f.sparkle(src.x, src.y, 1, p.l, 14); f.ring(tx, ty, extra || 64, p.l, 420, true); f.burst(tx, ty, 0.2, p.m, 16, 2); B.shake(4); play("rune_circle"); if (mine) text(G, "메아리 법진", src.x, src.y, 2.2, p.l, true); break;
    case 127: {
      // 삼원소 화살: the three arrows come as "ar" kinds 4–6; here the string's glow in all three
      SkillFx_bow(G, src, false);
      [1, 2, 3].forEach((el, j) => S3.fx.sparkle(src.x + Math.cos(ang + (j - 1) * 0.5) * 8, src.y + Math.sin(ang + (j - 1) * 0.5) * 8, 0.8, ELEM_COL[el], 5));
      f.flash(src.x, src.y, 12); B.shake(5); play("pierce"); play("ember");
      if (mine) text(G, "삼원소 화살!", src.x, src.y, 2.2, p.w, true);
      break;
    }
    case 128: {
      // 룬 파쇄탄 (룬브레이커 · 마도서): open-tome runic burst loosing five ink-rune bolts ("ar" kind 7)
      f.burst(src.x, src.y, 0.7, p.m, 16, 2.0); S3.fx.sparkle(src.x, src.y, 1.0, p.l, 10);
      S3.fx.ring(src.x, src.y, 22, p.l, 320, true);
      B.shake(5); play("inkshot");
      if (mine) text(G, "룬 파쇄탄!", src.x, src.y, 2.2, p.l, true);
      break;
    }
    case 102: f.ring(src.x, src.y, extra || 90, p.l, 520, true); f.sparkle(src.x, src.y, 1.1, p.a, 22); B.shake(5); play("sanctuary"); if (mine) text(G, "성광의 성역!", src.x, src.y, 2.2, p.l, true); break;
    // ── JOB-01: remaining 7 Lv.30 job signatures (fx 160–166)
    case 160: {
      // 성광 마검: 유성낙하 (스펠블레이드)
      const r = extra || 68;
      f.fall(tx, ty, "#ffe498", 110);
      f.ring(tx, ty, r, "#ffe498", 440, true);
      f.ring(tx, ty, r * 0.65, "#ff9246", 340);
      f.crack(tx, ty, r * 0.7, "#ffca6a", 620);
      f.burst(tx, ty, 0.35, "#ff9a46", 28, 3.2);
      f.sparkle(tx, ty, 0.8, "#fff8d8", 18);
      B.shake(10); play("crimson");
      if (mine) text(G, "유성낙하!", src.x, src.y, 2.3, "#ffe498", true);
      break;
    }
    case 161: {
      // 칠흑의 사형선고 (도적)
      flurrySlash(tx, ty, ang);
      flurrySlash(tx, ty, ang + Math.PI / 2);
      f.ring(tx, ty, 38, "#d4a0ff", 360, true);
      f.burst(tx, ty, 0.45, "#fb4b85", 22, 2.8);
      f.sparkle(tx, ty, 0.7, "#f0d4ff", 12);
      B.shake(8); play("cross_cut");
      if (mine) text(G, "사형선고!", src.x, src.y, 2.3, "#d4a0ff", true);
      break;
    }
    case 162: {
      // 삼원소 대격변 (마법사)
      const r = extra || 76;
      f.ring(tx, ty, r, "#ff9246", 440, true);
      f.ring(tx, ty, r * 0.6, "#87e4ff", 340);
      f.burst(tx, ty, 0.35, "#ff9246", 28, 3.0);
      f.sparkle(src.x, src.y, 1.2, "#fff07a", 16);
      B.shake(8); play("meteor_cast");
      if (mine) text(G, "삼원소 대격변!", src.x, src.y, 2.3, "#fff07a", true);
      break;
    }
    case 163: {
      // 환영 만화경 (트릭스터)
      f.ring(tx, ty, 44, "#d47aff", 380, true);
      f.ring(tx, ty, 24, "#fff07a", 300);
      f.burst(tx, ty, 0.5, "#c890ff", 24, 2.4);
      f.sparkle(tx, ty, 0.7, "#ffe47a", 14);
      B.shake(6); play("element_dagger");
      if (mine) text(G, "환영 만화경!", src.x, src.y, 2.2, "#e0b0ff", true);
      break;
    }
    case 164: {
      // 금서 해방: 영혼 수확 (마도사)
      const r = extra || 88;
      f.ring(src.x, src.y, r, "#9a66f0", 460, true);
      f.ring(src.x, src.y, r * 0.65, "#a5ef66", 340);
      f.burst(src.x, src.y, 0.4, "#4a2a78", 30, 3.0);
      f.sparkle(src.x, src.y, 0.9, "#d4ff9c", 18);
      B.shake(8); play("pact");
      if (mine) text(G, "영혼 수확!", src.x, src.y, 2.3, "#c8a0ff", true);
      break;
    }
    case 165: {
      // 질풍 연사: 천궁의 화살 (헌터)
      SkillFx_bow(G, src, extra === 2);
      f.flash(src.x, src.y, extra === 2 ? 12 : 8);
      f.sparkle(src.x, src.y, 0.8, extra === 2 ? "#87e4ff" : "#fff2a6", extra === 2 ? 12 : 6);
      B.shake(extra === 2 ? 6 : 2.5);
      play(extra === 2 ? "pierce" : "leapshot");
      if (mine && extra !== 1) text(G, "천궁의 일격!", src.x, src.y, 2.2, "#87e4ff", true);
      else if (mine) text(G, "질풍 연사!", src.x, src.y, 2.1, "#9ae062", true);
      break;
    }
    case 166: {
      // 맹독 혈우: 사냥감 낙인 (추적자)
      const r = extra || 66;
      SkillFx_bow(G, src, true);
      f.ring(tx, ty, r, "#8ef060", 420, true);
      f.ring(tx, ty, r * 0.62, "#fb4b85", 320);
      f.burst(tx, ty, 0.35, "#a5ef66", 24, 2.4);
      B.shake(6); play("rain");
      if (mine) text(G, "맹독 혈우!", src.x, src.y, 2.2, "#a5ef66", true);
      break;
    }
    // ── JOB-02: 14 more job actives (fx 170–183)
    case 170: // 광폭의 포효 (바바리안)
      f.ring(src.x, src.y, extra || 80, "#ff7a3a", 460, true); f.ring(src.x, src.y, (extra || 80) * 0.6, "#ff3a2a", 340);
      f.burst(src.x, src.y, 0.4, "#ff5a2a", 28, 3.2); f.crack(src.x, src.y, (extra || 80) * 0.6, "#ffb060", 520);
      B.shake(11); play("crimson");
      if (mine) text(G, "광폭의 포효!", src.x, src.y, 2.3, "#ff9a5a", true);
      break;
    case 171: // 원소 마검: 뇌화 폭쇄 (스펠블레이드)
      f.ring(src.x, src.y, extra || 64, "#ffe46a", 420, true); f.burst(src.x, src.y, 0.35, "#ff7a2a", 24, 3);
      for (let i = 0; i < 4; i++) { const a = ang + i * Math.PI / 2 + 0.4, r = (extra || 64) * 0.9; chainLightningArc(src.x, src.y, src.x + Math.cos(a) * r, src.y + Math.sin(a) * r * 0.6); }
      f.crack(src.x, src.y, 40, "#ffd070", 480); B.shake(8); play("bolt");
      if (mine) text(G, "뇌화 폭쇄!", src.x, src.y, 2.2, "#ffe46a", true);
      break;
    case 172: // 그림자 암살 (도적)
      flurrySlash(tx, ty, ang); f.burst(tx, ty, 0.4, "#6a2a9a", 14, 2.2); f.ring(tx, ty, 22, "#b070f0", 260, true);
      shadowAfterimage(tx, ty, 260); B.shake(5); play("cross_cut");
      if (mine) text(G, "그림자 암살!", src.x, src.y, 2.2, "#b070f0", true);
      break;
    case 173: // 칼날 왈츠 (블레이드댄서)
      streakWake(src.x, src.y, tx, ty, "#7a1030", "#ff4a6a", 3);
      for (const o of [-0.5, 0.5]) flurrySlash(tx, ty, ang + o);
      f.burst(tx, ty, 0.4, "#fb4b85", 18, 2.6); B.shake(6); play("cross_cut");
      if (mine) text(G, "칼날 왈츠!", src.x, src.y, 2.2, "#ff6a8a", true);
      break;
    case 174: // 천공 투창 (창술사)
      f.proj(src.x, src.y, 0.8, tx, ty, 0.4, "#fff2c0", 0.08, 60); f.beam(src.x, src.y, tx, ty, "#ffe8a0", 0.4);
      f.burst(tx, ty, 0.3, "#ffe498", 18, 2.8); f.ring(tx, ty, 30, "#ffe498", 320, true); f.sparkle(tx, ty, 0.6, "#ffffff", 8);
      B.shake(7); play("pierce");
      if (mine) text(G, "천공 투창!", src.x, src.y, 2.2, "#ffe498", true);
      break;
    case 175: // 뇌격 연쇄창 (마창사): hops are the server's "ln 4"
      f.spark(tx, ty, "#ffe46a", 1.4); f.ring(tx, ty, 20, "#9ad8ff", 260, true); f.burst(tx, ty, 0.3, "#ffe46a", 12, 2.2);
      B.shake(4); play("bolt");
      if (mine) text(G, "뇌격 연쇄창!", src.x, src.y, 2.1, "#9ad8ff", true);
      break;
    case 176: // 블링크: 서리 잔영 (마법사); (tx, ty) is where the caster left
      frostNovaRing(tx, ty, extra || 54); shadowAfterimage(tx, ty, 360); f.sparkle(src.x, src.y, 0.8, "#bfeaff", 10);
      B.shake(4); play("sanctuary");
      if (mine) text(G, "서리 잔영!", src.x, src.y, 2.1, "#87e4ff", true);
      break;
    case 177: { // 행운의 주사위 (트릭스터): extra = die face
      const big = extra === 6, c = big ? "#ffd84a" : "#d4a0ff";
      f.sparkle(src.x, src.y, 1, c, big ? 24 : 8 + extra * 2); f.ring(src.x, src.y, big ? 40 : 26, c, 320, true);
      if (big) f.burst(src.x, src.y, 0.5, "#fff07a", 20, 2.6);
      B.shake(big ? 5 : 2); play("dance");
      if (mine) text(G, big ? "주사위 6! 대박!" : `주사위 ${extra}!`, src.x, src.y, big ? 2.4 : 2.0, c, true);
      break;
    }
    case 178: // 망령 소환 (마도사): extra 0 = summon, 1 = one wraith bolt
      if (!extra) {
        f.burst(src.x, src.y, 0.5, "#8a5ac8", 22, 2.6); f.sparkle(src.x, src.y, 0.9, "#a5ef66", 14); f.ring(src.x, src.y, 34, "#9a66f0", 380, true);
        B.shake(5); play("pact"); if (mine) text(G, "망령 소환!", src.x, src.y, 2.2, "#c8a0ff", true);
      } else { f.proj(src.x, src.y, 0.7, tx, ty, 0.5, "#6a3aa8", 0.08, 50); f.burst(tx, ty, 0.3, "#a5ef66", 6, 1.4); B.shake(1); }
      break;
    case 179: // 봉인의 룬 (룬브레이커)
      f.ring(tx, ty, extra || 40, "#8ad8ff", 520, true); f.ring(tx, ty, (extra || 40) * 0.6, "#ffffff", 420);
      f.sparkle(tx, ty, 0.9, "#b0e8ff", 16); f.crack(tx, ty, (extra || 40) * 0.8, "#6ac0f0", 520); B.shake(5); play("inkshot");
      if (mine) text(G, "봉인!", tx, ty, 2.2, "#8ad8ff", true);
      break;
    case 180: { // 사냥꾼의 속사: one light arrow per event
      SkillFx_bow(G, src, false); f.beam(src.x, src.y, tx, ty, "#fff2a6", 0.25); f.spark(tx, ty, "#fff2a6", 0.8); play("leapshot");
      const last = rapidAt.get(eid) || -1e9; rapidAt.set(eid, now());
      if (mine && now() - last > 2000) text(G, "속사!", src.x, src.y, 2.0, "#9ae062", true);
      break;
    }
    case 181: // 독사의 관통 화살 (추적자)
      SkillFx_bow(G, src, true); streakWake(src.x, src.y, tx, ty, "#2a5a1a", "#8ef060", 2);
      f.proj(src.x, src.y, 0.8, tx, ty, 0.5, "#a5ef66", 0.09, 60); f.burst(tx, ty, 0.3, "#a5ef66", 18, 2.4); f.ring(tx, ty, 26, "#8ef060", 300, true);
      B.shake(6); play("pierce");
      if (mine) text(G, "관통 화살!", src.x, src.y, 2.1, "#a5ef66", true);
      break;
    case 182: // 지각 붕괴 (파괴자): one event per ring (extra = ring radius)
      f.ring(tx, ty, extra || 36, "#ffb060", 420, true); f.crack(tx, ty, (extra || 36) * 0.9, "#c88a4a", 560);
      f.burst(tx, ty, 0.2, "#b08050", 12 + (extra || 36) / 6, 2.4); B.shake(extra <= 40 ? 11 : 6); play("crimson");
      if (mine && extra <= 40) text(G, "지각 붕괴!", tx, ty, 2.3, "#ffb060", true);
      break;
    case 183: // 신의 방패 (성기사)
      f.flash(src.x, src.y, 16); f.ring(src.x, src.y, extra || 100, "#ffe498", 520, true); f.ring(src.x, src.y, (extra || 100) * 0.6, "#ffffff", 380);
      f.sparkle(src.x, src.y, 1.1, "#fff4c0", 22); B.shake(5); play("sanctuary");
      if (mine) text(G, "신의 방패!", src.x, src.y, 2.3, "#ffe498", true);
      break;
  }
  jobBeat(kind, src, tx, ty, p, near);
}
const rapidAt = new Map(); // eid → last 사냥꾼의 속사 arrow time (the word shows once per volley)
/** The job's own note under every skill (skills-v2.md §6): accent motes at the target, a signature's palette ring. */
function jobBeat(kind, src, tx, ty, p, near) {
  const id = fxSkill(kind), sig = /^[jh]$/.test(skillDef(id)?.kind || "");
  S3.fx.sparkle(tx, ty, 0.5, p.a, sig ? 8 : 4);
  if (sig) { S3.fx.ring(src.x, src.y, 20, p.l, 240); S3.fx.ring(src.x, src.y, 30, p.m, 320, true); }
  if (near && id) Sound.play("job_note", { job: skillOwner(id), sig });
}

// ───────────────────────────── passive procs ("ps", eid, code, x, y: skills-v2.md §4) ─────────────────────────────

/** code → [passive, the word popped over the one who has it]. */
const PS = {
  140: ["sword_fortify30", "벼랑 끝 투지!"], 141: ["sword_weight40", ""], 142: ["sword_edge50", ""], 143: ["dagger_snap30", "회수"],
  144: ["dagger_edge40", "빈틈!"], 145: ["dagger_fang50", "피의 갈증"], 146: ["spear_advance30", ""], 147: ["spear_edge50", "일점!"],
  148: ["staff_chant30", "증폭!"], 149: ["staff_spark40", "집중!"], 150: ["staff_flood50", ""], 151: ["book_clause30", "낙인 전염"],
  152: ["book_return50", ""], 153: ["bow_string30", ""], 154: ["bow_quill50", "약점 포착!"],
  155: ["swordsman_bloodlust", "피의 갈증"], 158: ["bladedancer_feast", ""], 162: ["trickster_sleight", ""],
  163: ["warlock_thirst", ""], 164: ["runearcher_lastward", "최후의 룬!"],
};
const PS_SOUND = {
  140: "inertia_full", 141: "quake", 142: "edge_cut", 143: "reso_ready",
  144: "tip", 145: "bleed", 146: "spear_cd", 147: "tip",
  148: "reso_ready", 149: "reso_ready", 150: "mana_surge", 151: "brand",
  152: "brand", 153: "double_nock", 154: "hawk_eye",
  155: "bleed", 158: "bleed", 162: "reso_ready", 163: "brand", 164: "sanctuary",
};
export function procFx(G, e) {
  const [, eid, code, x, y] = e, d = PS[code];
  if (!d) return;
  const p = skillPal(d[0], G.who?.get(eid)?.cls), f = S3.fx, mine = eid === G.you;
  const who = mine ? G.me : G.players.get(eid);
  switch (code) {
    case 140: if (who) { f.ring(who.x, who.y, 22, p.m, 360, true); f.burst(who.x, who.y, 0.4, p.l, 12, 1.8); } break;
    case 141: S3.big().fx.ring(x, y, 36, p.m, 300, true); f.crack(x, y, 22, p.l, 420); f.burst(x, y, 0.1, p.md, 10, 1.6); if (mine) S3.shake(2.5); break;
    case 142: f.spark(x, y, p.a, 0.8); break;
    case 143: if (who) { f.ring(who.x, who.y, 12, p.l, 220); f.sparkle(who.x, who.y, 0.6, p.a, 6); } break;
    case 144: case 147: f.spark(x, y, p.a, 1.3); f.ring(x, y, 10, p.l, 200); break;
    case 145: if (who) { f.sparkle(who.x, who.y, 0.9, p.a, 12); f.ring(who.x, who.y, 18, p.l, 300); } break;
    case 146: if (who) f.sparkle(who.x, who.y, 0.6, p.a, 3); break;
    case 148: f.ring(x, y, 24, p.a, 300, true); f.sparkle(x, y, 0.6, p.l, 8); break;
    case 149: if (who) { f.ring(who.x, who.y, 16, p.l, 240); f.sparkle(who.x, who.y, 1, p.a, 8); } break;
    case 150: if (who) f.sparkle(who.x, who.y, 0.8, p.a, 4); break;
    case 151: f.ring(x, y, 16, p.m, 280); f.burst(x, y, 0.5, p.a, 8, 1.6); break;
    case 152: if (who) f.proj(x, y, 0.6, who.x, who.y, 0.8, p.a, 0.04, 30); break;
    case 153: f.spark(x, y, p.l, 0.9); break;
    case 154: f.ring(x, y, 14, p.a, 280, true); f.spark(x, y, p.a, 1.2); break;
    case 155: if (who) { f.sparkle(who.x, who.y, 0.9, "#ff6a8a", 10); f.ring(who.x, who.y, 18, "#fb4b85", 300, true); } break;
    case 158: f.spark(x, y, "#fb4b85", 1.3); f.burst(x, y, 0.4, "#c0204a", 8, 1.8); break;
    case 162: if (who) { f.sparkle(who.x, who.y, 0.7, "#e0b0ff", 6); f.ring(who.x, who.y, 12, "#ffe47a", 220); } break;
    case 163: if (who) { f.sparkle(who.x, who.y, 0.8, "#8ab8ff", 8); f.ring(who.x, who.y, 14, "#9a66f0", 260); } break;
    case 164: if (who) { f.ring(who.x, who.y, 26, "#8ad8ff", 420, true); f.sparkle(who.x, who.y, 1, "#ffffff", 12); } break;
  }
  const word = d[1], at0 = code === 144 || code === 147 || code === 154 || code === 151 ? [x, y] : who ? [who.x, who.y] : [x, y];
  if (mine || skillNear(G, at0[0], at0[1])) procPfx(code, at0[0], at0[1], who ? Math.atan2(y - who.y, x - who.x) : 0, p);
  if (mine && word) text(G, word, at0[0], at0[1], 1.9, code === 154 || code === 144 ? p.a : p.l);
  if (mine && PS_SOUND[code]) Sound.play(PS_SOUND[code]);
}
/** The bow skills draw and loose like a finisher (or up at the sky). */
function SkillFx_bow(G, src, up) { bowFire(G, src, 2, up); }
