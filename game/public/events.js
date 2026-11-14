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
import * as Dim from "./dimrift.js";
import * as Housing from "./housing.js";
import * as Life from "./life.js";
import * as Gather from "./gather.js";
import * as Station from "./station.js";
import * as Board from "./board.js";
import { G, dist, T, now } from "./state.js";
import { entityPos } from "./net.js";
import { addChat, banner, chatLog } from "./windows.js";
import { fadeIn } from "./win_world.js";

const MOB_COL = { twinhare: "#a83848", gutfrog: "#7a9a4a", eyecrow: "#5c3c6c", splitboar: "#a83848", ribdeer: "#e0d8c8", hydrasnake: "#5a8a4a", mothface: "#b8a890", ratking: "#c87a8a", bonehound: "#a83848", batcluster: "#5c3c6c", pigeonmass: "#7a8aa0", doghead: "#7a5a48", catsplit: "#a83848", fishwalker: "#8ab0c0", leechmaw: "#b4cc3c", gatorhalf: "#5a7a4a", eelknot: "#4a5a6a", spiderhand: "#e0d8c8", bearmaw: "#a83848", owlstare: "#7a5a48", twingoat: "#e0d8c8", horsehalf: "#a83848", serpentwing: "#b4cc3c", boss: "#e050b8", abyssboss: "#b4cc3c", chest_meadow: "#f0c040", chest_forest: "#f0c040", chest_city: "#f0c040", chest_cave: "#f0c040", chest_crypt: "#f0c040", chest_sewer: "#f0c040", chest_abyss: "#f0c040" , lambmaw: "#a83848", foxtwine: "#c8643c", toadbrood: "#7a8a4a", squidrat: "#8a6a7a", crabskull: "#c85a3a", moleworm: "#5a566a", lionhand: "#b8905a", sowseer: "#d8a0a8", twinhare_bone: "#e0d8c8", gutfrog_poison: "#8ad84a", ratking_bile: "#b4cc3c", splitboar_frost: "#8ad8ff", hydrasnake_steel: "#a8b4c8", bonehound_ash: "#5a5a66", batcluster_blood: "#b02838", doghead_fire: "#ff8a3a" };
export const mobMax = (m) => Math.round(G.defs.mobs[m.k].hp * G.defs.eliteHp[m.el | 0]);
export const RANK_NAME = ["", "정예 ", "우두머리 "];
/** The old four classes and the jobs they became (rows saved before jobs still name a class). */
export const JOB_ALIAS = { warrior: "swordsman", rogue: "thief", mage: "wizard", ranger: "lancer" };
// a dungeon's chosen guard is its 수문장; out in the open a summoned field boss is a 우두머리 (as the server calls them)
export const DUNGEONS = new Set(["crypt", "sewer", "abyss"]);

const heightOf = (e) => e.h3 || 1.3;

export function onEvent(e, t) {
  if (SkillFx.skillEvent(e, { G, S3, Sound, entityPos, heightOf, t })) return;
  if (Dim.onEvent(e)) return;
  if (Housing.onEvent(e)) return;
  if (Life.onEvent(e)) return;                // a life skill's level (life.js)
  if (Gather.onEvent(e)) return;              // gathering: gs gt ga (gather.js)
  if (Station.onEvent(e)) return;             // the life stations: mk mo (station.js)
  if (Board.onEvent(e)) return;               // delivery: dl (board.js)
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
      const [, id, dmg, crit, isPlayer] = e;
      const tgt = entityPos(id);
      if (!tgt) break;
      const h = heightOf(tgt);
      if (dmg < 0) floatText(`+${-dmg}`, tgt.x, tgt.y, h + 0.3, "#8cff8c");
      else {
        floatText(crit ? `${dmg}!` : String(dmg), tgt.x + (Math.random() * 8 - 4), tgt.y, h + 0.25, isPlayer ? "#ff7a7a" : crit ? "#ffd84a" : "#ffffff", crit, true);
        tgt.hurtT = t; tgt.hsMs = 0;
        // recoil away from whoever struck last
        if (!isPlayer && G.hitFrom) {
          tgt.hurtA = Math.atan2(tgt.y - G.hitFrom[1], tgt.x - G.hitFrom[0]);
          // was this my own blow landing? then it gets the full treatment: a held frame, a kick, a burst
          const mine = t - G.lastAtk < 420, fin = mine && (G.me.atkN === 2 || (G.self?.wk === "sword" && G.me.atkN === 1)), heavy = crit || fin;
          tgt.hurtP = heavy ? 1.6 : 1;
          S3.fx.spark(tgt.x, tgt.y, crit ? "#ffe04a" : "#ffffff", heavy ? 1.7 : 1.1);
          S3.fx.ring(tgt.x, tgt.y - 4, heavy ? 20 : 11, crit ? "#ffe04a" : "#ffffff", heavy ? 220 : 150);
          if (mine) {
            // a local hitstop: the blow and what it struck hold still for a beat (2–3 frames on a
            // crit, a finisher or a skill; barely one on a plain hit, so the tempo stays high)
            const stop = heavy ? 45 : 18;
            if (!G.me.hs || t > G.me.hs.at + G.me.hs.dur) G.me.hs = { at: t, dur: stop };
            tgt.hsMs = stop;
            if (heavy) S3.shake(5, tgt.hurtA); else S3.shake(2.5);
            if (heavy) { G.punch = 1; Sound.play(fin ? "finisher" : "crit"); }
          }
        }
        if (id === G.you) { G.flash = 1; S3.shake(3); Sound.play("hurt"); }
        else if (!isPlayer) Sound.play(crit ? "crit" : "hit");
        S3.fx.burst(tgt.x, tgt.y, h * 0.55, isPlayer ? "#ff7a7a" : "#ffffff", crit ? 14 : 8, crit ? 2.6 : 2);
      }
      break;
    }
    case "k": {
      const m = G.mobs.get(e[1]) || G.gone.get(e[1]);
      if (m) { G.gone.delete(e[1]); S3.fx.burst(m.x, m.y, heightOf(m) * 0.5, MOB_COL[m.k] || "#fff", G.defs.mobs[m.k]?.boss ? 70 : 16, 2.2); Sound.play(G.defs.mobs[m.k]?.boss ? "die_boss" : m.el ? "die_big" : "die_small"); G.mobs.delete(e[1]); }
      break;
    }
    case "m": {
      const m = G.mobs.get(e[1]);
      if (m) {
        m.atkT = t;
        if (e.length > 2) { S3.fx.proj(m.x, m.y, heightOf(m) * 0.75, e[2], e[3] + 8, 0.7, "#ff5a4a", 0.05, 34); Sound.play("mob_shot"); }
      }
      break;
    }
    case "d": S3.fx.beam(e[2], e[3] + 8, e[4], e[5] + 8, "#8a78c8", 0.6); S3.fx.burst(e[2], e[3] + 8, 0.6, "#4a4468", 10, 1); break;
    case "t": if (e[5]) { S3.fx.ring(e[1], e[2], e[3], "#ffe08a", e[4]); break; } S3.fx.tele(e[1], e[2], e[3], e[4]); Sound.play("warn"); break;
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
      if (e[1] === G.you) Sound.play("wp_wake");
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
      if (p) S3.fx.sparkle(p.x, p.y, 0.9, "#ffd84a", 20);
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
      else if (e[5]) S3.fx.proj(e[1], e[2] + 8, 0.6, e[3], e[4] + 8, 0.5, "#b8f060", 0.05, 30);
      else { S3.fx.beam(e[1], e[2] + 8, e[3], e[4] + 8, "#fff48a", 0.45); S3.fx.burst(e[3], e[4] + 8, 0.5, "#fff48a", 8, 1.6); Sound.play("magic"); }
      break;
    case "pk": S3.petFetch(e[1], e[2], e[3]); break;     // a pet fetched something
    case "l": {
      const p = entityPos(e[1]);
      if (p) { S3.fx.pillar(p.x, p.y); if (e[1] !== G.you) floatText("LEVEL UP", p.x, p.y, heightOf(p) + 0.5, "#ffd84a", true); }
      break;
    }
    case "pd": { const p = entityPos(e[1]); if (p) S3.fx.burst(p.x, p.y, 0.6, "#c8c8d8", 12, 1.4); break; }
    case "jc": {
      // a job change: light, a burst of brass, and for me a banner and a fanfare
      const p = entityPos(e[1]);
      if (p) { S3.fx.pillar(p.x, p.y); S3.fx.burst(p.x, p.y, 1, "#f4d27a", 24, 2.2); floatText("전직!", p.x, p.y, heightOf(p) + 0.6, "#f4d27a", true); }
      if (e[1] === G.you) { Sound.play("achieve"); const j = G.self && G.defs.jobs[G.self.job]; banner(j && j.kind !== "none" ? `${j.name}의 길` : "전직!"); }
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
      if (p) { S3.fx.sparkle(p.x, p.y, 0.8, e[2] ? "#ffd84a" : "#8a8a9a", e[2] ? 28 : 10); if (e[2]) S3.fx.ring(p.x, p.y, 20, "#ffd84a", 400); }
      if (e[1] === G.you) Sound.play(e[2] ? "enh_ok" : "enh_fail");
      break;
    }
  }
}

export function onGain([kind, a, b, q]) {
  const me = G.me, h = heightOf(me);
  if (kind === "xp") floatText(`+${a} EXP`, me.x, me.y, h + 0.55, "#fff08a");
  else if (kind === "gold") {
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
    const p = addChat(`획득: ${q ? `[${G.defs.rarity[q]}] ` : ""}${G.defs.items[a].name}${b > 1 ? ` ×${b}` : ""}`, "loot");
    if (q) p.style.color = Art.RARITY_COL[q];
    Sound.play("loot", q | 0);
    if (q >= 3) banner(q === 4 ? "세트 획득!" : "전설 획득!", true);
  } else if (kind === "cos") { const d = G.defs.cos[a]; const p = addChat(`외형 획득: ${d ? d.name : a}`, "loot"); if (d) p.style.color = Art.RARITY_COL[d.q]; Sound.play("loot", d ? d.q : 1);
  } else if (kind === "lvl") { banner("LEVEL UP!"); floatText(`Lv.${a}`, me.x, me.y, h + 0.9, "#ffd84a", true); Sound.play("level"); addChat(`레벨 ${a} 달성!`, "sys"); }
}

// ───────────────────────────── effects ─────────────────────────────
// Effects live in the 3D scene; floating text is drawn over it and follows its point in the world.

export function floatText(str, x, y, h, col, big, dmg = false) {
  // a damage number bounces off to one side (dmg: true), the rest rise straight up
  G.texts.push({ str, x, y, h, col, big: !!big, t0: now(), dmg, vx: dmg ? (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 8) : 0 });
}
/** `src` is the attacker, (tx, ty) the point of impact on the ground. */
function attackFx(kind, src, tx, ty, beat = 0) {
  const fin = beat === 2;
  const f = S3.fx;
  switch (kind) {
    // (the blades' crescents and thrust waves are thrown off by the stroke itself at its snap: scene2d qiBurst)
    case 0: Sound.play("swing_sword", beat === 1); break;
    case 1: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, "#fff0c0", 0.04, 42); f.burst(src.x + (tx - src.x) * 0.15, src.y + (ty - src.y) * 0.15, 0.75, "#ffd84a", 4, 0.8); Sound.play("shoot"); break;
    case 2: f.proj(src.x, src.y, 1.1, tx, ty, 0.5, "#b08aff", fin ? 0.15 : 0.09, 15, fin ? () => f.ring(tx, ty, 18, "#b08aff", 220, true) : undefined); Sound.play("swing_staff"); break;
    case 3: Sound.play("swing_dagger"); break;
    case 4: Sound.play("swing_spear", fin); break;
    case 5: f.proj(src.x, src.y, 0.9, tx, ty, 0.5, "#c8a0ff", 0.07, 20, () => { f.ring(tx, ty, fin ? 34 : 26, "#c8a0ff", 220, true); }); Sound.play("swing_book"); break;
    // the bow: drawn and loosed by the stroke itself; its arrow comes as its own event ("ar", skillfx.js)
    case 6: SkillFx.bowFire(G, src, beat); break;
    case 19: f.burst(src.x, src.y, 0.6, "#4a4468", 10, 1); break;
  }
}
