/**
 * World events (split from client.js): `onEvent` (the snapshot's `ev` list: hits, kills, spawns,
 * warps, fishing, tales…, after skillfx/dimrift/housing/mobart had their turn), `onGain`, floating
 * text `floatText`, your own swing's `attackFx`; monster colours and ranks (`MOB_COL mobMax RANK_NAME
 * JOB_ALIAS DUNGEONS`).
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as Mini from "./minigames.js";
import * as MobArt from "./mobart.js";
import * as Growth from "./growth.js";
import * as SkillFx from "./skillfx.js";
import { jobSkillFx } from "./job-skill-fx.js";
import { skillFinisherFx } from "./skill-finisher-fx.js";
import { HAMMER_IMPACT, MELEE_FEEL, MELEE_FX_WEAPON } from "./swing.js";
import * as Dim from "./dimrift.js";
import * as Housing from "./housing.js";
import * as Life from "./life.js";
import * as Gather from "./gather.js";
import * as Station from "./station.js";
import * as Board from "./board.js";
import * as Chores from "./chores.js";
import * as Rest from "./rest.js";
import * as Coop from "./coop.js";
import * as Charms from "./charms.js";
import { G, dist, T, now, $, el } from "./state.js";
import { entityPos } from "./wire.js";
import { addChat, banner, chatLog } from "./windows.js";
import { fadeIn } from "./win_world.js";
import { rarityLabel } from "./items.js";
import { damageColor, elementInfo } from "./elements.js";

const HIT_CUE = { oath: 1, sanctuary: 2, hammer: 3, banner: 4, binding: 5 }; // h[6], on selected impacts or healing spells

const MOB_COL = { twinhare: "#a83848", gutfrog: "#7a9a4a", eyecrow: "#5c3c6c", splitboar: "#a83848", ribdeer: "#e0d8c8", hydrasnake: "#5a8a4a", mothface: "#b8a890", ratking: "#c87a8a", bonehound: "#a83848", batcluster: "#5c3c6c", pigeonmass: "#7a8aa0", doghead: "#7a5a48", catsplit: "#a83848", fishwalker: "#8ab0c0", leechmaw: "#b4cc3c", gatorhalf: "#5a7a4a", eelknot: "#4a5a6a", spiderhand: "#e0d8c8", bearmaw: "#a83848", owlstare: "#7a5a48", twingoat: "#e0d8c8", horsehalf: "#a83848", serpentwing: "#b4cc3c", boss: "#e050b8", abyssboss: "#b4cc3c", chest_meadow: "#f0c040", chest_forest: "#f0c040", chest_city: "#f0c040", chest_cave: "#f0c040", chest_crypt: "#f0c040", chest_sewer: "#f0c040", chest_abyss: "#f0c040" , lambmaw: "#a83848", foxtwine: "#c8643c", toadbrood: "#7a8a4a", squidrat: "#8a6a7a", crabskull: "#c85a3a", moleworm: "#5a566a", lionhand: "#b8905a", sowseer: "#d8a0a8", twinhare_bone: "#e0d8c8", gutfrog_poison: "#8ad84a", ratking_bile: "#b4cc3c", splitboar_frost: "#8ad8ff", hydrasnake_steel: "#a8b4c8", bonehound_ash: "#5a5a66", batcluster_blood: "#b02838", doghead_fire: "#ff8a3a" };
export const mobMax = (m) => Math.round(G.defs.mobs[m.k].hp * G.defs.eliteHp[m.el | 0]);
export const RANK_NAME = ["", "정예 ", "우두머리 "];
/** The old four classes and the jobs they became (rows saved before jobs still name a class). */
export const JOB_ALIAS = { warrior: "swordsman", rogue: "thief", mage: "wizard", ranger: "lancer" };
// a dungeon's chosen guard is its 수문장; out in the open a summoned field boss is a 우두머리 (as the server calls them)
export const DUNGEONS = new Set(["crypt", "sewer", "abyss"]);

const heightOf = (e) => e.h3 || 1.3;
/** A monster's shot takes its element's colour (a plain one stays red: it is a threat, not a spark). */
const shotColor = (k) => { const ty = G.defs.mobs[k]?.element; return ty && ty !== "physical" ? elementInfo(ty)?.color || "#ff5a4a" : "#ff5a4a"; };
const FEATHER_MOBS = /^(eyecrow|eyegull|pigeonmass|owlstare|hollowowl|wingcrane|ribvulture|gorgecrane|ironowl|crownpeacock)/;
const BONE_MOBS = /^(bonehound|cactushog|spoolsnipe|crabskull|stonegoat|cliffmonkey|ribdeer|twinhare_bone|serpentwing_bone)/;
const NEEDLE_MOBS = /^(hydrasnake|mothface|dartbrood|eelknot|serpentwing|sanctummoth|gravrose|spiderhand|toadbrood|gutfrog|sanctumfrog)/;
const BITE_MOBS = /^(lambmaw|gutfrog|toadbrood|leechmaw|gatorhalf|bearmaw|sandmaw|loggator|doghead|bonehound|moleworm|passbear|horsehalf|gigglehyena|sanctumfrog)/;
const SMASH_MOBS = /^(meadowram|splitboar|ribdeer|fishwalker|crabskull|twingoat|shroomboar|coralturtle|rootwarden|rimewalrus|passboar|stonegoat|sanctumturtle|sanctumcrown|sanctumwarden|sanctumstag|rotstag)/;
const mobShotStyle = (k) => { const sp = G.defs.mobs[k]?.sp || k; return FEATHER_MOBS.test(k) || FEATHER_MOBS.test(sp) ? "feather" : BONE_MOBS.test(k) || BONE_MOBS.test(sp) ? "bone" : NEEDLE_MOBS.test(k) || NEEDLE_MOBS.test(sp) ? "needle" : "orb"; };
const mobMeleeStyle = (k) => { const sp = G.defs.mobs[k]?.sp || k; return BITE_MOBS.test(k) || BITE_MOBS.test(sp) ? "bite" : SMASH_MOBS.test(k) || SMASH_MOBS.test(sp) ? "smash" : "claw"; };
/** What a monster is made of, for the layer under a blow and its death cry (audio.js mob_body, die_*.<body>); the rest is flesh. First match wins. */
const BODY_MOBS = [
  ["wood", /^(crowscare|stumpmaw|rootwarden|gravrose|inkrose|shroomboar|bogcrown|loomcolossus|sanctumwarden)/],
  ["bone", /^(bonehound|twinhare_bone|serpentwing_bone|crabskull|hermitskull|mummycamel|knellkeeper|ribvulture|ribdeer)/],
  ["shell", /^(dunescarab|coralturtle|sanctumturtle|barnacleseal|clubshrimp|prismmole|prismcantor|bloodshard|airship_|hydrasnake_steel|sluiceeel)/],
  ["goo", /^(slugtongue|leechmaw|gutfrog|toadbrood|sanctumfrog|brainjelly|moleworm|eelknot|squidrat|fishwalker|inkleech|inkfish|bloomwhale|hagfishhead|sluiceleviathan)/],
  ["bug", /^(gravecricket|knotwidow|spiderhand|plumspider|mothface|inkmoth|frostmoth|sanctummoth|orchidmantis|dartbrood|spinescorp)/],
  ["small", /^(wickhare|twinhare|rimehare|ratking|blightsquirrel|batcluster|cloakbat|nightbat|smoggecko|bellnewt|beadmonkey|vinemonkey|eyecrow|eyegull|pigeonmass|owlstare|hollowowl)/],
];
const mobBody = (k) => { const sp = G.defs.mobs[k]?.sp || k; return BODY_MOBS.find(([, re]) => re.test(k) || re.test(sp))?.[0] || "flesh"; };
function nearestPlayerTo(m) {
  let best = null, bd = 85 * 85;
  const check = (p) => { if (!p || p.dead) return; const d = (p.x - m.x) ** 2 + (p.y - m.y) ** 2; if (d < bd) { bd = d; best = p; } };
  check(G.me);
  for (const p of G.players.values()) check(p);
  return best;
}

const hitVisualAt = new WeakMap();
function drawDamageImpact(tgt, t, height, damage, parts, critical, heavy, grazing) {
  if (document.hidden || !G.me || dist(G.me.x, G.me.y, tgt.x, tgt.y) > 245 || t - (hitVisualAt.get(tgt) ?? -Infinity) < 75) return;
  const types = G.defs?.elements?.types;
  let element = "physical", peak = damage * 0.24;
  if (types && !grazing) for (const [index, amount] of parts || []) {
    const type = types[index];
    if (!type || type === "physical" || amount < peak) continue;
    element = type;
    peak = amount;
  }
  hitVisualAt.set(tgt, t);
  const color = element === "physical" ? (critical ? "#ffe075" : "#c6deef") : elementInfo(element)?.color || "#c6deef";
  const d = tgt.k && G.defs?.mobs?.[tgt.k], bigHit = heavy || !!d?.boss || (tgt.el | 0) >= 2;
  S3.fx.hitImpact(tgt.x, tgt.y, height * 0.55, element, color, bigHit, grazing);
  if (!grazing && (d?.boss || (tgt.el | 0) >= 1)) {
    S3.fx.burst(tgt.x, tgt.y, height * 0.5, color, d?.boss ? 10 : 6, bigHit ? 1.8 : 1.4);
  }
}

export function onEvent(e, t) {
  jobSkillFx(e, G, S3, entityPos);
  skillFinisherFx(e, G, S3, entityPos);
  if (e[0] === "a" && (e[2] === 7 || (e[2] >= 130 && e[2] <= 132))) {
    const [, eid, , x, y, dir, , wind = HAMMER_IMPACT, aim] = e;
    const src = entityPos(eid);
    if (!src) return;
    // Keep the local button prediction. Other players start when their attack reaches us.
    if (eid !== G.you || t - src.atkT > wind) src.atkT = t;
    src.dir = dir; src.atkN = 0; src.hammerWind = wind;
    src.aim = [x, y];
    if (Number.isInteger(aim)) src.hammerYaw = (aim / (G.defs.aim?.[0] || 64)) * Math.PI * 2;
    else if (eid !== G.you || src.hammerYaw === undefined) src.hammerYaw = Math.atan2(y - src.y, x - src.x);
    G.hitFrom = [src.x, src.y];
    const hRad = e[2] === 132 ? 36 : e[2] === 131 ? 31 : e[2] === 130 ? 28 : 24;
    SkillFx.hammerWindup?.(x, y, hRad, wind, src.hammerYaw);
    if (e[2] >= 130 && e[2] <= 132) SkillFx.triggerSkillMotion?.(src, e[2], x, y, t, 0, wind);
    if (eid === G.you || dist(G.me.x, G.me.y, x, y) < 180) Sound.play("swing_hammer");
    return;
  }
  if (e[0] === "bw" && e[4] === 9 && (G.defs.skills.dive.damageType === "cold" || G.defs.skills.dive.damageType === "lightning")) {
    const [, x, y, radius] = e;
    const frost = elementInfo("cold").color, bolt = elementInfo("lightning").color;
    S3.fx.zap(x, y, bolt, 240);
    S3.fx.wave(x, y, radius, frost, 400);
    S3.fx.crack(x, y, radius * 0.72, frost, 460);
    S3.fx.burst(x, y, 0.3, "#e4f8ff", 22, 2.8);
    if (G.me && dist(G.me.x, G.me.y, x, y) < 180) Sound.play("thunder");
    return;
  }
  // a scripted boss's new phase (56-boss-script.js ["bc", id, 10, phase]): a roar, a shake and flash, a banner
  if (e[0] === "bc" && e[2] === 10) {
    const m = G.mobs.get(e[1]), d = m && G.defs.mobs[m.k];
    if (m && d && G.me && dist(G.me.x, G.me.y, m.x, m.y) < 420) {
      S3.fx.ring(m.x, m.y, 110, "#ff3a2a", 520, true); S3.fx.burst(m.x, m.y, 0.8, "#ffd0a0", 24, 2.4); S3.shake(9);
      Sound.play("boss_enrage"); banner(`${d.name} ${e[3]}단계 — 더욱 사나워집니다!`, true);
    }
    return;
  }
  if (SkillFx.skillEvent(e, { G, S3, Sound, entityPos, heightOf, t })) return;
  if (Dim.onEvent(e)) return;
  if (Housing.onEvent(e)) return;
  if (Life.onEvent(e)) return;                // a life skill's level (life.js)
  if (Gather.onEvent(e)) return;              // gathering: gs gt ga (gather.js)
  if (Station.onEvent(e)) return;             // the life stations: mk mo (station.js)
  if (Board.onEvent(e)) return;               // delivery: dl (board.js)
  if (Rest.onEvent(e)) return;                // 쉼표 수첩: a stamp landed: rs (rest.js)
  if (Chores.onEvent(e)) return;              // a village chore's spot done: co (chores.js)
  if (Charms.onEvent(e)) return;              // a legendary charm at work: cm (charms.js)
  if (Coop.onEvent(e)) return;                // 협동 아르바이트: cj (coop.js)
  MobArt.onEvent(e, G, S3, t);              // wind-ups, strikes and the bodies monsters leave
  switch (e[0]) {
    // the storyteller by the town's fire tells a tale: a bubble over her, and a line in the chat for those close by
    case "tl": {
      const tale = G.defs.sky && G.defs.sky.tales[e[1]], n = G.map.npcs.find((q) => q.night);
      if (!tale || !n || dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12) > 260) break;
      G.bubbles.set("npc:" + n.id, { text: tale, t0: t, until: t + 9000 });
      addChat(tale, "", n.name);
      Sound.play("tale");
      break;
    }
    // a song on the lute, or a cup raised by the fire
    case "j": {
      if (!G.jams) G.jams = new Map();
      G.jams.set(e[1], { k: e[2], t0: t });
      const p = entityPos(e[1]);
      if (p && dist(G.me.x, G.me.y, p.x, p.y) < 320) Sound.play(e[2] === 0 ? "strum" : "cheers", 1 - dist(G.me.x, G.me.y, p.x, p.y) / 320);
      break;
    }
    case "a": {
      const [, eid, kind, tx, ty] = e;
      const src = entityPos(eid);
      if (!src) break;
      // which blow of the combo this is; a skill swings like a finisher
      const beat = kind >= 10 ? 2 : e[6] | 0;
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; src.atkN = beat; }
      else { G.me.dir = e[5]; G.me.atkN = beat; if (kind < 10 && G.defs.wkinds?.[G.comboWeapon]?.fx === kind) G.combo = beat; }
      src.aim = [tx, ty + 6];
      G.hitFrom = [src.x, src.y];
      attackFx(kind, src, tx, ty + 6, beat);
      break;
    }
    case "h": {
      const [, id, dmg, crit, isPlayer, cost, cue, parts, swing] = e;
      const tgt = entityPos(id);
      if (!tgt) break;
      const h = heightOf(tgt);
      if (cost) { floatText(`−${dmg}`, tgt.x, tgt.y, h + 0.25, "#e89970"); break; }
      if (dmg < 0) {
        floatText(`+${-dmg}`, tgt.x, tgt.y, h + 0.3, "#8cff8c");
        if (cue === HIT_CUE.oath || cue === HIT_CUE.sanctuary) {
          const oath = cue === HIT_CUE.oath, color = oath ? "#a8f6cd" : "#ffe888";
          S3.fx.wave(tgt.x, tgt.y, oath ? 15 : 10, color, 350);
          S3.fx.burst(tgt.x, tgt.y, 0.3, color, oath ? 7 : 4, 1.1);
          if (id === G.you) Sound.play(oath ? "oath_heal" : "heal");
        } else if (cue === HIT_CUE.banner || cue === HIT_CUE.binding) {
          SkillFx.supportMend(tgt, cue);
          if (id === G.you) Sound.play(cue === HIT_CUE.banner ? "rally_mend" : "revive_mend");
        }
      } else {
        const hammer = cue === HIT_CUE.hammer; // the accompanying hm event plays the one landing cue
        const critical = crit === 1, grazing = crit === 2;
        floatDamage(dmg, parts, tgt, h, critical);
        tgt.hurtT = t; tgt.hsMs = 0;
        let wk, fin = false, heavy = critical;
        if (!isPlayer && dmg > 0) {
          const source = swing && entityPos(swing[0]);
          const from = source ? [source.x, source.y] : G.hitFrom;
          if (from) tgt.hurtA = Math.atan2(tgt.y - from[1], tgt.x - from[0]);
          const weapon = swing && MELEE_FX_WEAPON[swing[1]];
          const mine = swing ? swing[0] === G.you : !MELEE_FEEL[G.comboWeapon] && t - G.lastAtk < 420;
          if ((mine || t - G.lastSkill < 700) && G.mobs.has(id)) { G.tgt = id; G.tgtT = t; }   // the target frame follows my last blow (hud.js)
          fin = !grazing && (swing ? !!swing[2] : mine && G.me.atkN === 2);
          heavy = critical || fin;
          tgt.hurtP = grazing ? 0.6 : heavy ? 1.6 : 1;
          wk = weapon || (mine ? G.self?.wk : undefined);
          if (mine || weapon) {
            const feel = MELEE_FEEL[weapon];
            const stop = grazing ? 10 : heavy ? feel?.heavyStop ?? 60 : feel?.stop ?? 18;
            tgt.hsMs = stop;
            const current = !swing || (weapon === G.comboWeapon && Math.abs(t - G.impactAt) < 84);
            if (mine && current && (!G.me.hs || G.me.hs.at < G.me.atkT)) {
              G.me.hs = { at: t, dur: stop };
              if (!hammer && !grazing) S3.shake(heavy ? feel?.heavyKick ?? 5 : feel?.kick ?? 1.5, tgt.hurtA);
              if (heavy) {
                G.punch = 1;
                if (feel) Sound.duckImpact();
              }
            }
          }
        }
        if (isPlayer) S3.fx.burst(tgt.x, tgt.y, h * 0.55, "#ff7a7a", critical ? 14 : 8, critical ? 2.6 : 2);
        else if (!hammer && dmg > 0) drawDamageImpact(tgt, t, h, dmg, parts, critical, heavy, grazing);
        if (id === G.you && dmg > 0) { G.flash = 1; S3.shake(3); Sound.play("hurt"); }
        // Play one damage cue; hammer, healing and swing cues have their own events.
        else if (!isPlayer && dmg > 0 && G.me && dist(G.me.x, G.me.y, tgt.x, tgt.y) < 230) {
          if (!hammer) Sound.play(critical ? "crit" : grazing ? "graze" : fin ? "finisher" : "hit", wk);
          if (tgt.k) Sound.play("mob_body", mobBody(tgt.k));   // what it is made of, under every blow (hammers too)
        }
      }
      break;
    }
    case "k": {
      const m = G.mobs.get(e[1]) || G.gone.get(e[1]);
      if (m) {
        G.gone.delete(e[1]);
        const d = G.defs.mobs[m.k], col = MOB_COL[m.k] || MOB_COL[d?.sp] || "#fff";
        S3.fx.mobDeath(m.x, m.y, heightOf(m), col, m.el | 0, !!d?.boss);
        // a boss's killing blow: the scene holds still ~100 ms (client.js frame) and shakes; 설정 → 보스 연출 turns it off
        if (d?.boss && G.bossFx && G.me && dist(G.me.x, G.me.y, m.x, m.y) < 420) { G.stopAt = t; G.stopUntil = t + 100; S3.shake(10); }
        Sound.play(d?.boss ? "die_boss" : m.el ? "die_big" : "die_small", mobBody(m.k));
        G.mobs.delete(e[1]);
      }
      break;
    }
    case "m": {
      const m = G.mobs.get(e[1]);
      if (m) {
        m.atkT = t;
        const col = shotColor(m.k), near = !G.me || dist(G.me.x, G.me.y, m.x, m.y) < 230;
        if (e.length > 2) {
          S3.fx.mobShot(m.x, m.y, heightOf(m) * 0.75, e[2], e[3] + 8, 0.7, mobShotStyle(m.k), col);
          if (near) Sound.play("mob_shot");
        } else if (near) {
          const tgt = nearestPlayerTo(m), d = G.defs.mobs[m.k];
          if (tgt) { S3.fx.mobMelee(m.x, m.y, tgt.x, tgt.y, mobMeleeStyle(m.k), col, d?.boss ? 1.45 : m.el === 2 ? 1.3 : m.el ? 1.15 : 1); Sound.play("mob_melee", mobMeleeStyle(m.k)); }
        }
      }
      break;
    }
    case "d": S3.fx.beam(e[2], e[3] + 8, e[4], e[5] + 8, "#8a78c8", 0.6); S3.fx.burst(e[2], e[3] + 8, 0.6, "#4a4468", 10, 1); Sound.play("dark_beam"); break;
    case "t": if (e[5]) { S3.fx.ring(e[1], e[2], e[3], "#ffe08a", e[4]); Sound.play("mob_howl"); break; } S3.fx.tele(e[1], e[2], e[3], e[4]); Sound.play("warn"); break;
    case "b": {
      // a blast on the ground: a monster's (pink, it hurts) or a player's skill landing
      const col = [null, "#ffb04a", "#ff8a3a", "#cfe4ff"][e[4] | 0];
      if (col) { const B = S3.big(); B.fx.ring(e[1], e[2], e[3], col, 300, true); B.fx.burst(e[1], e[2], 0.4, col, 18, 2.4); B.shake(2); Sound.play("boom"); }
      else { S3.fx.ring(e[1], e[2], e[3], "#ff6ad0", 350, true); S3.fx.burst(e[1], e[2], 0.4, "#ff6ad0", 34, 3); S3.shake(6); Sound.play("slam"); }
      break;
    }
    case "wp": {
      // 0 leaving by a waypoint, 1 arriving at one, 2 a stone woken
      const p = entityPos(e[1]);
      if (p) { S3.fx.ring(p.x, p.y, e[2] === 2 ? 34 : 24, "#8ad8ff", 520, true); S3.fx.sparkle(p.x, p.y, 0.8, "#bfeaff", e[2] === 2 ? 22 : 14); }
      if (e[1] === G.you) {
        if (e[2] === 2) { banner("이동의 돌을 깨웠습니다", true); Sound.play("wp_wake"); }   // the server's toast says the rest
        else if (e[2] === 1) { fadeIn(); Sound.play("warp"); }
        else Sound.play("warp_out");
      }
      break;
    }
    case "wd": {
      // 질주의 바람: a wind shrine pushes someone on (e: [_, eid, shrine x, shrine y])
      const p = entityPos(e[1]);
      S3.fx.ring(e[2], e[3], 26, "#9affc8", 520, true);
      if (p) S3.fx.sparkle(p.x, p.y, 0.7, "#c8ffe0", 16);
      if (e[1] === G.you) Sound.play("wind_shrine");
      break;
    }
    case "rc": {
      // reading the return scroll: a cast bar for me, a ring round anyone reading
      const p = entityPos(e[1]);
      if (e[2] > 0) {
        if (p) S3.fx.ring(p.x, p.y, 20, "#ffe08a", e[2], false);
        if (e[1] === G.you) { G.cast = { start: t, end: t + e[2] }; Sound.play("recall"); }
      } else {
        if (e[1] === G.you) { G.cast = null; Sound.play(e[2] === 0 ? "fail" : "warp"); }
        if (p && e[2] < 0) S3.fx.sparkle(p.x, p.y, 0.8, "#ffe08a", 16);
      }
      break;
    }
    case "ac": {
      const a = (G.defs.achievements || []).find((x) => x.id === e[2]);
      if (!a) break;
      if (e[1] === G.you) { banner(`업적 달성 · ${a.name}`, true); Sound.play("achieve"); addChat(`업적 [${a.name}] 달성! (+${a.pts}점${a.title ? ` · 칭호 「${a.title}」` : ""})`, "sys"); }
      else { const w = G.who.get(e[1]); if (w) addChat(`${w.name}님 업적 달성: [${a.name}]`, "sys"); }
      const p = entityPos(e[1]);
      if (p) S3.fx.pillar(p.x, p.y, "achieve");
      break;
    }
    case "c": S3.fx.lane(e[2], e[3], e[4], e[5], e[6]); Sound.play("charge"); break;      // a charge is coming down this line
    case "v": {
      // a spread of shots, each landing where its mark is
      const m = G.mobs.get(e[1]);
      if (!m) break;
      const pts = [];
      for (let i = 3; i + 1 < e.length; i += 2) pts.push([e[i], e[i + 1]]);
      m.atkT = t;
      S3.fx.volley(m.x, m.y, pts, e[2]);
      Sound.play("volley");
      break;
    }
    case "q": S3.fx.pop(e[1], e[2], e[3]); Sound.play("pop"); break;
    case "g": {
      // spat out, it lands and stays: poison, fire or a slowing mire
      const m = G.mobs.get(e[1]);
      if (m) { m.atkT = t; S3.fx.spit(m.x, m.y, e[2], e[3], e[4], e[5], e[6], e[7]); Sound.play("spit"); }
      break;
    }
    case "z":
      // something flying from one point to another: a legendary's lightning, or a thrown knife
      if (e[5] >= 2) Growth.lineFx(e, S3.big());              // chain lightning, a phantom's dash
      else if (e[5]) { S3.fx.proj(e[1], e[2] + 8, 0.6, e[3], e[4] + 8, 0.5, "#b8f060", 0.05, 30); Sound.play("knife_throw"); }
      else { S3.fx.beam(e[1], e[2] + 8, e[3], e[4] + 8, "#fff48a", 0.45); S3.fx.burst(e[3], e[4] + 8, 0.5, "#fff48a", 8, 1.6); Sound.play("magic"); }
      break;
    case "pk": S3.petFetch(e[1], e[2], e[3]); if (e[1] === G.you) Sound.play("pet_fetch"); break;     // a pet fetched something
    case "l": {
      const p = entityPos(e[1]);
      if (p) { S3.fx.pillar(p.x, p.y); if (e[1] !== G.you) floatText("LEVEL UP", p.x, p.y, heightOf(p) + 0.5, "#ffd84a", true); }
      break;
    }
    case "pd": { const p = entityPos(e[1]); if (p) { S3.fx.burst(p.x, p.y, 0.6, "#c8c8d8", 12, 1.4); if (e[1] === G.you) Sound.play("pet_poof"); } break; }
    case "jc": {
      // a job change: light, a burst of brass, and for me a banner and a fanfare
      const p = entityPos(e[1]);
      if (p) { S3.fx.pillar(p.x, p.y); S3.fx.burst(p.x, p.y, 1, "#f4d27a", 24, 2.2); floatText("전직!", p.x, p.y, heightOf(p) + 0.6, "#f4d27a", true); }
      if (e[1] === G.you) { Sound.play("job_change"); const j = G.self && G.defs.jobs[G.self.job]; banner(j && j.kind !== "none" ? `${j.name}의 길` : "전직!"); }
      break;
    }
    case "jl": {
      const p = entityPos(e[1]);
      if (p) { S3.fx.pillar(p.x, p.y); floatText(`직업 Lv.${e[2]}`, p.x, p.y, heightOf(p) + 0.6, "#f4d27a", true); }
      if (e[1] === G.you) Sound.play("level");
      break;
    }
    // what someone says floats over their head for a while, longer for longer lines
    case "s": G.bubbles.set(e[1], { text: e[2], t0: t, until: t + 3500 + Math.min(4000, e[2].length * 90) }); Sound.play("blip"); break;
    case "o": G.bubbles.set(e[1], { emo: e[2] | 0, t0: t, until: t + 2800 }); Sound.play("emote"); break;
    case "f": {
      // 1: a line goes out · 2: a bite · 0: it comes back in
      if (e[2] === 1) { G.bobs.set(e[1], { id: e[1], eid: e[1], x: e[3], y: e[4], bite: false }); if (e[1] === G.you) Sound.play("cast"); }
      else if (e[2] === 2) {
        const b = G.bobs.get(e[1]);
        if (b) { b.bite = true; S3.fx.ring(b.x, b.y, 12, "#ffffff", 300); }
        if (e[1] === G.you) { Sound.play("bite"); banner("입질! F", true); }
      } else if (e[2] === 0) {
        G.bobs.delete(e[1]);
        if (e[1] === G.you) Mini.close();                    // it got away, or the catch is in
      }
      break;
    }
    case "u": {
      const p = entityPos(e[1]);
      if (p) S3.fx.sparkle(p.x, p.y, 0.8, e[2] === 2 ? "#ffd84a" : e[2] ? "#7ab4ff" : "#ff8a8a", e[2] === 2 ? 16 : 10);
      if (e[1] === G.you) Sound.play(e[2] === 2 ? "buff" : "potion");
      break;
    }
    case "e": {
      const p = entityPos(e[1]);
      if (p) S3.fx.enhanceFx(p.x, p.y, e[2] | 0, e[3] | 0, !!e[4]);
      if (e[1] === G.you) Sound.play(e[2] === 2 ? "warp" : e[2] ? "enh_ok" : "enh_fail");
      break;
    }
  }
}

/** The loot feed at the play view's lower right: one line per kind, repeats add up (`들꽃잎 ×3`), each fades after 4 s. */
const feed = new Map();
/** Rarity as a shape too: 마법 ◇ · 희귀 ◆ · 전설 ★ · 세트 룬 ◈ · 유니크 ▣. */
const RARITY_MARK = ["", "◇ ", "◆ ", "★ ", "◈ ", "▣ "];
function lootLine(key, text, col, n) {
  const box = $("#loot");
  if (!box) return;
  let f = feed.get(key);
  if (f && f.p.isConnected) f.n += n;
  else {
    f = { p: el("p"), n };
    feed.set(key, f);
    box.append(f.p);
    while (box.children.length > 5) box.firstChild.remove();
  }
  f.p.textContent = text(f.n);
  f.p.style.color = col;
  f.p.style.animation = "none"; void f.p.offsetWidth; f.p.style.animation = "";
  clearTimeout(f.tm);
  f.tm = setTimeout(() => { f.p.remove(); feed.delete(key); }, 4000);
}
export function onGain([kind, a, b, q]) {
  const me = G.me, h = heightOf(me);
  if (kind === "xp") floatText(`+${a} EXP`, me.x, me.y, h + 0.55, "#fff08a");
  else if (kind === "gold") {
    lootLine("gold", (n) => `골드 +${n.toLocaleString()}`, "#ffd84a", a);
    // coins picked up one after another add up on one line instead of flooding the log
    const t = now(), gl = G.goldLine;
    if (gl && gl.p === chatLog.lastElementChild && t - gl.t < 5000) { gl.n += a; gl.t = t; gl.p.textContent = `골드 +${gl.n.toLocaleString()}`; }
    else G.goldLine = { p: addChat(`골드 +${a}`, "loot"), n: a, t };
    Sound.play("coin");
  }
  else if (kind === "item") {
    // a material for the 재료 주머니 rises over the head too (gathering's reward, gather.js)
    const d = G.defs.items[a];
    if (d && (d.type === "lmat" || a === "staple" || a === "flask")) floatText(`+${d.name}${b > 1 ? ` ×${b}` : ""}`, me.x, me.y, h + 0.55, "#b8f07a");
    const rarity = q ? `[${rarityLabel(a, q)}] ` : "";
    const p = addChat(`획득: ${rarity}${d.name}${b > 1 ? ` ×${b}` : ""}`, "loot");
    if (q) p.style.color = Art.RARITY_COL[q];
    lootLine(`i:${a}:${q | 0}`, (n) => `${RARITY_MARK[q | 0]}${rarity}${d.name}${n > 1 ? ` ×${n}` : ""}`, q ? Art.RARITY_COL[q] : "#f0e6d0", b || 1);
    Sound.play("loot", q | 0);
    if (q >= 3) banner(`${d.q ? d.name : `${rarityLabel(a, q)}${d.type === "rune" ? " 룬" : ""}`} 획득!`, true);
  } else if (kind === "cos") { const d = G.defs.cos[a]; const p = addChat(`외형 획득: ${d ? d.name : a}`, "loot"); if (d) p.style.color = Art.RARITY_COL[d.q]; lootLine(`c:${a}`, () => `외형 · ${d ? d.name : a}`, d ? Art.RARITY_COL[d.q] : "#f0e6d0", 1); Sound.play("loot", d ? d.q : 1);
  } else if (kind === "lvl") { banner("LEVEL UP!"); floatText(`Lv.${a}`, me.x, me.y, h + 0.9, "#ffd84a", true); Sound.play("level"); addChat(`레벨 ${a} 달성!`, "sys"); }
}

// ───────────────────────────── effects ─────────────────────────────
// Effects live in the 3D scene; floating text is drawn over it and follows its point in the world.

function floatDamage(total, parts, tgt, h, crit) {
  const x = tgt.x + (Math.random() * 8 - 4);
  if (!parts?.length) {
    floatText(crit ? `${total}!` : String(total), x, tgt.y, h + 0.25, damageColor(0), crit, true);
    return;
  }
  const entries = parts;
  const move = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8);
  const stride = Math.max(30, 11 * (String(Math.max(...entries.map(([, n]) => n))).length + (crit ? 1 : 0)));
  for (let i = 0; i < entries.length; i++) {
    const [type, n] = entries[i];
    const group = Math.floor(i / 3), columns = Math.min(3, entries.length - group * 3);
    const dx = (i % 3 - (columns - 1) / 2) * stride, dy = -group * (crit ? 23 : 17);
    floatText(crit ? `${n}!` : String(n), x, tgt.y, h + 0.25, damageColor(type), crit, true, { dx, dy, move });
  }
}

/** The most floating texts alive at once: each is a stroked, resizing label every frame (overlay.js), the costliest thing a big fight draws. */
const TEXT_MAX = 70;
export function floatText(str, x, y, h, col, big, dmg = false, layout) {
  // a damage number bounces off to one side (dmg: true), the rest rise straight up
  if (document.hidden || G.texts.length >= TEXT_MAX) return;   // nobody is looking, or the screen is already full of numbers
  const vx = dmg ? layout?.move ?? (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8) : 0;
  G.texts.push({ str, x, y, h, col, big: !!big, t0: now(), dmg, vx, dx: layout?.dx || 0, dy: layout?.dy || 0 });
}
/** A spark of magic gathering at the staff's or the book's tip, a few px from `src` toward (tx, ty). */
function castFlash(f, src, tx, ty, col, fin) {
  const d = Math.hypot(tx - src.x, ty - src.y) || 1, x = src.x + ((tx - src.x) / d) * 9, y = src.y + ((ty - src.y) / d) * 9;
  f.burst(x, y, 0.75, "#ffffff", fin ? 4 : 2, 0.5);
  f.burst(x, y, 0.75, col, fin ? 6 : 3, 0.7);
}
/** `src` is the attacker, (tx, ty) the point of impact on the ground. */
function attackFx(kind, src, tx, ty, beat = 0) {
  const fin = beat === 2;
  const f = S3.fx;
  switch (kind) {
    // (the blades' crescents and thrust waves are thrown off by the stroke itself at its snap: scene2d qiBurst)
    case 0: Sound.play("swing_sword", beat === 1); break;
    case 1: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, "#fff0c0", 0.04, 42); f.burst(src.x + (tx - src.x) * 0.15, src.y + (ty - src.y) * 0.15, 0.75, "#ffd84a", 4, 0.8); Sound.play("shoot"); break;
    // the staff and the book: a flash at the tip as it casts; the missile comes as its own event ("ar" kinds 8, 9: skillfx.js)
    case 2: castFlash(f, src, tx, ty, "#b08aff", fin); Sound.play("swing_staff"); break;
    case 3: Sound.play("swing_dagger"); break;
    case 4: Sound.play("swing_spear", fin); break;
    case 5: castFlash(f, src, tx, ty, "#c8a0ff", fin); Sound.play("swing_book"); break;
    // the bow: drawn and loosed by the stroke itself; its arrow comes as its own event ("ar", skillfx.js)
    case 6: SkillFx.bowFire(G, src, beat); break;
    case 19: f.burst(src.x, src.y, 0.6, "#4a4468", 10, 1); break;
  }
}
