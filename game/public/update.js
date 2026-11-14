/**
 * The per-frame update (split from client.js): `update(dt, t)` — your predicted walking and the
 * `mv` intent, auto-hunt (`autoSt autoOk`), held attack, easing everyone else; footstep and
 * ambient sound (`soundscape`).
 */

import { Sound } from "./audio.js";
import * as Mini from "./minigames.js";
import * as Growth from "./growth.js";
import * as QS from "./quickslots.js";
import * as Sky from "./sky.js";
import { G, T, dist, $, el } from "./state.js";
import { act } from "./net.js";
import { moveVector, typing, keys, held, pathTo } from "./input.js";
import { aimAtPoint, castSkill, usePotion, aimIdx, canStand, attack, nearestNpc, fireNear } from "./actions.js";
import * as Gather from "./gather.js";
import * as Board from "./board.js";
import { toast, closeWin, isOpen, shown } from "./windows.js";
import { refreshUi } from "./hud.js";

// ───────────────────────────── update ─────────────────────────────

let lastSend = 0, sent = { x: 0, y: 0, d: 0, a: 16 };
export const autoSt = { stuck: 0, side: 0, sign: 1, lastSkill: 0, target: null, routed: 0, skip: new Map(), home: null, homing: false };
/** How far from where it was switched on auto-hunt will go looking (px): it should not wander into a harder band. */
const AUTO_LEASH = 220;
/**
 * Whether auto-hunt should pick this monster: never a boss or field boss, nor an elite
 * three or more levels above you — unless it is already fighting you, then you answer.
 */
function autoOk(m, s, t, d) {
  const md = G.defs.mobs[m.k];
  if (!md) return false;
  if (t - (m.atkT || -1e9) < 2500 && d < 70) return true;
  if (md.boss || m.el === 2) return false;
  return !(m.el && md.lv >= s.lvl + 12);   // (shown levels: 12 = three old levels)
}

/** What the ground under a tile sounds like underfoot. */
const STEP_KIND = { ".": "grass", ",": "grass", '"': "grass", ":": "grass", ";": "grass", "%": "grass", p: "dirt", s: "dirt", b: "wood", w: "water", j: "water" };
/** Indoors: boards creak, rugs and the door mat muffle (iso_interior.js floors). */
const STEP_ROOM = { f: "wood", l: "wood", q: "grass", u: "grass", y: "grass", e: "dirt", x: "stone" };
/**
 * In the drains and the abyss only wet ground squelches: sewer sludge ("d") and sumps ("g"), and
 * floor at the edge of a channel or of the blood ("w"). Walkways, bridges and bone stay dry.
 */
function wetUnderfoot(g, tx, ty, theme) {
  const ch = g[ty] && g[ty][tx];
  if (ch === "g" || (theme === "sewer" && ch === "d")) return true;
  if (ch !== "c") return false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[ty + dy] && g[ty + dy][tx + dx] === "w") return true;
  return false;
}
export const snd = { foot: 0, look: 0, bossT: 0 };
/** Footsteps, a nearby fire's crackle, an elite turning up, and boss / rift music over the map's own. */
function soundscape(t) {
  const me = G.me;
  const f = Math.floor(me.walk);
  if (me.moving && f !== snd.foot && f % 2 === 0) {
    const tx = Math.floor(me.x / T), ty = Math.floor(me.y / T), th = G.map.theme;
    const row = G.map.g[ty];
    const ch = row && row[tx];
    const wet = (th === "sewer" || th === "abyss") && wetUnderfoot(G.map.g, tx, ty, th);
    Sound.step((th === "interior" ? STEP_ROOM[ch] : wet ? "water" : STEP_KIND[ch]) || "stone");
  }
  snd.foot = f;
  if (t - snd.look < 250) return;
  snd.look = t;
  let fire = 0;
  for (const fr of G.fires.values()) fire = Math.max(fire, 1 - dist(me.x, me.y, fr.x, fr.y) / 200);
  Sound.ambient(fire);
  // the hour and the weather outdoors: night music, birds, crickets, owls, rain and wind
  const out = Sky.weather() >= 0 && !G.map.indoor && ["town", "meadow", "forest", "city"].includes(G.map.theme || G.map.id);
  Sound.scene({ out, ph: Sky.phase(), wx: out ? Sky.weather() : -1 });
  Sound.setNight(out && Sky.nightK() > 0.6);
  // a boss or field boss close by and fighting keeps the boss theme up for a while
  for (const m of G.mobs.values()) {
    const d = dist(me.x, me.y, m.x, m.y);
    if (m.el && !m.heard && d < 260 && !G.defs.mobs[m.k]?.chest) { m.heard = 1; Sound.play(m.el === 2 ? "announce" : "elite"); }
    if ((G.defs.mobs[m.k]?.boss || m.el === 2) && d < 280 && t - Math.max(m.hurtT || 0, m.atkT || 0) < 8000) snd.bossT = t + 6000;
  }
  const e = G.evt, rift = e && (e.phase === "on" || e.phase === "boss") && e.map === G.map.id;
  Sound.setTheme(t < snd.bossT && !me.dead ? "boss" : rift ? "rift" : null);
}

export function update(dt, t) {
  const me = G.me, s = G.self;
  if (!G.map || !s) return;
  let [mx, my] = me.dead ? [0, 0] : moveVector();
  let wantAtk = !me.dead && !typing() && !Mini.active() && (keys.has(" ") || held.atk);

  // auto-hunt: walk at the nearest monster, hit it, drink when low
  // a route taken to get round a wall ends as soon as its monster is within reach
  if (G.auto && G.path && autoSt.routed) {
    const m = G.mobs.get(autoSt.routed);
    if (!m || dist(me.x, me.y, m.x, m.y) < s.range * 0.8) { G.path = null; autoSt.routed = 0; }
  }
  // the player steering (keys, stick or a click to walk) moves the spot auto-hunt keeps to
  if (!G.path) autoSt.homing = false;
  if (G.auto && (mx || my || (G.path && !autoSt.routed && !autoSt.homing))) autoSt.home = null;
  if (G.auto && !me.dead && mx === 0 && my === 0 && !G.path && !G.map.safe) {
    if (!autoSt.home || autoSt.home.map !== G.map.id) autoSt.home = { map: G.map.id, x: me.x, y: me.y };
    const home = autoSt.home;
    // something far too strong close by (a field boss turning up mid-hunt, a big elite): back off
    let threat = null, td = 110;
    for (const m of G.mobs.values()) {
      const md = G.defs.mobs[m.k], d = dist(me.x, me.y, m.x, m.y);
      if (md && !md.chest && d < td && md.lv > s.lvl && (md.boss || m.el === 2 || (m.el && md.lv >= s.lvl + 12))) { threat = m; td = d; }   // shown levels: 12 = three old ones
    }
    if (threat) {
      autoSt.home = null;                            // hunt again wherever the retreat ends
      // run along a real path back toward the way in (the waypoint stone, else the first door) —
      // open ground and weaker monsters; straight away from it only if there is no path
      const wp = (G.map.marks || []).find((k) => k.kind === "waypoint"), door = G.map.portals[0];
      const goal = wp ? [wp.x * T + 8, (wp.y + 2) * T + 8] : door ? [door.x * T + 8, door.y * T + 8] : null;
      const route = goal && dist(me.x, me.y, goal[0], goal[1]) > 64 ? pathTo(goal[0], goal[1]) : null;
      if (route && route.length > 1) { G.path = route; autoSt.homing = true; }
      else { mx = (me.x - threat.x) / (td || 1); my = (me.y - threat.y) / (td || 1); }
      if (t - (autoSt.fleeT || 0) > 10000) { autoSt.fleeT = t; toast(`${G.defs.mobs[threat.k].name} — 너무 강한 상대입니다. 자동사냥이 물러납니다.`); }
    }
    let best = null, bd = 1e9;
    if (!threat) for (const m of G.mobs.values()) {
      if ((autoSt.skip.get(m.id) || 0) > t) continue;
      const d = dist(me.x, me.y, m.x, m.y);
      if (!autoOk(m, s, t, d) || (dist(home.x, home.y, m.x, m.y) > AUTO_LEASH && d > s.range * 1.5)) continue;
      if (d < bd) { bd = d; best = m; }
    }
    autoSt.target = best;
    // nothing to hunt nearby: drift back to the spot and wait for the next to turn up
    if (!threat && !best && dist(me.x, me.y, home.x, home.y) > 48) { const route = pathTo(home.x, home.y); if (route) { G.path = route; autoSt.homing = true; } }
    if (best) {
      const range = s.range * 0.8;
      if (bd > range) {
        const ux = (best.x - me.x) / bd, uy = (best.y - me.y) / bd;
        if (autoSt.side > 0) { mx = -uy * autoSt.sign; my = ux * autoSt.sign; autoSt.side -= dt; }
        else { mx = ux; my = uy; }
      } else {
        wantAtk = true;
        aimAtPoint(best.x, best.y);            // face the quarry before the blow or the spell
        if (t - autoSt.lastSkill > 500) {
          // only what the player put in the quick slots, in slot order
          // (usable with the weapon in hand, not kept from auto-hunt, MP to spare; never swaps weapons)
          for (const id of QS.autoSkills()) {
            const sk = G.defs.skills[id];
            if (!sk || QS.skillWhy(id) || sk.noAuto || (sk.autoHp && me.hp < s.mhp * sk.autoHp)) continue;
            if (t >= (G.cdEnd[id] || 0) && me.mp >= QS.skillMp(id) + 4) { if (castSkill(id)) { autoSt.lastSkill = t; break; } }
          }
        }
      }
    }
    if (me.hp < s.mhp * 0.45) usePotion("hp");
    if (me.mp < s.mmp * 0.25) usePotion("mp");
  }
  Growth.autoPotion();

  // walk — applied immediately, checked by the server afterwards
  const speed = s.spd * (t < G.buffEnd[1] ? 1.4 : 1) * (t < (G.buffEnd[4] || 0) ? G.defs.slow || 0.65 : 1);    // hasted, or slowed by frost
  const ox = me.x, oy = me.y;
  // the aim follows the way you walk; Shift held turns you on the spot without a step
  if (mx || my) me.aimI = aimIdx(mx, my);
  if (keys.has("Shift") && !G.path && !G.auto) { if (mx || my) me.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : my < 0 ? 3 : 0; mx = my = 0; }
  if (mx || my) {
    const nx = me.x + mx * speed * dt, ny = me.y + my * speed * dt;
    if (canStand(nx, me.y)) me.x = nx;
    if (canStand(me.x, ny)) me.y = ny;
    if (t - me.atkT > 250) me.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : my < 0 ? 3 : 0;
  }
  const moved = dist(ox, oy, me.x, me.y);
  me.moving = moved > 0.01;
  if (me.moving) me.walk += dt * 6;
  soundscape(t);
  if (G.auto && (mx || my)) {
    if (moved < speed * dt * 0.3) {
      autoSt.stuck += dt;
      if (autoSt.stuck > 0.25) {
        // walled off: find the way round, or give this one up for a while if there is none
        autoSt.stuck = 0;
        const m = autoSt.target, route = m ? pathTo(m.x, m.y) : null;
        if (route && route.length < 60) { G.path = route; autoSt.routed = m.id; }
        else if (m) autoSt.skip.set(m.id, t + 8000);
        else { autoSt.side = 0.5 + Math.random() * 0.4; autoSt.sign = Math.random() < 0.5 ? -1 : 1; }
      }
    }
    else autoSt.stuck = 0;
  }
  if (t - lastSend > 90 && (Math.abs(me.x - sent.x) > 0.3 || Math.abs(me.y - sent.y) > 0.3 || me.dir !== sent.d || me.aimI !== sent.a)) {
    lastSend = t;
    sent = { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, d: me.dir, a: me.aimI };
    act({ t: "mv", x: sent.x, y: sent.y, d: sent.d, a: sent.a });
  }
  if (wantAtk) attack();

  // everyone else eases toward their latest server position
  const k = Math.min(1, dt * 14);
  for (const map of [G.players, G.mobs, G.drops]) {
    for (const e of map.values()) {
      const d = dist(e.x, e.y, e.tx, e.ty);
      e.moving = d > 0.7;
      if (d > 60) { e.x = e.tx; e.y = e.ty; } else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
      if (e.moving) e.walk += dt * 6;
    }
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt;
    if (p.life <= 0) { G.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
  }
  G.shake = Math.max(0, G.shake - dt * 18);
  G.flash = Math.max(0, G.flash - dt * 4);

  const near = me.dead ? null : nearestNpc();
  // with no NPC by you, a gathering node in reach names itself on the prompt (gather.js)
  const gat = near ? "" : Gather.label();
  // the 알바 in hand names its step at the right NPC (board.js)
  const jb = near ? Board.promptFor(near) : "";
  if (near !== G.near || gat !== G.gatLabel || jb !== G.jbLabel) {
    const moved = near !== G.near;
    G.near = near; G.gatLabel = gat; G.jbLabel = jb;
    const p = $("#prompt");
    p.hidden = !near && !gat;
    p.classList.toggle("jb", !!jb);
    if (near || gat) { p.textContent = ""; p.append(el("b", "", document.body.classList.contains("touch") ? "▶ " : "F  "), near ? jb || near.name : gat); }
    if (moved && !near) { closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train"); closeWin("job"); if (isOpen("warp")) delete shown.warp; }
    // the stat tab and the job card say what can be done where you stand
    if (moved && (isOpen("char") || isOpen("skill"))) refreshUi();
  }
  // stepping into (or out of) a campfire's warmth turns the stat tab's buttons on or off
  const warm = !!G.self && fireNear();
  if (warm !== G.warmWas) { G.warmWas = warm; if (isOpen("char")) refreshUi(); }
}
