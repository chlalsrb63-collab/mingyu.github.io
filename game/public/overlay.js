/**
 * Drawing a frame (split from client.js): `render(t, dt)` hands the world to scene2d, then the
 * lettered overlay on the text canvas (`renderText`: names, labels, chat bubbles, HP bars, floating
 * numbers; `bubble bubbleFrame bar label`), the forge's hammer, `wpWoke`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import { icon, TRAIT } from "./uiicons.js";
import { jobIcon } from "./jobicons.js";
import * as Emo from "./emoticons.js";
import * as Growth from "./growth.js";
import * as SideQ from "./sidequests.js";
import * as Board from "./board.js";
import * as Sky from "./sky.js";
import * as NPC from "./npclife.js";
import * as Dim from "./dimrift.js";
import * as Housing from "./housing.js";
import { G, T, dpr, tg, text } from "./state.js";
import { entityPos } from "./net.js";
import { mobMax, DUNGEONS, RANK_NAME } from "./events.js";
/** Quest marks over NPCs (owner): the main chain in yellow, side quests in blue; "!" to take, "?" to hand in (a lighter tint). */
const MAIN_MARK = "#ffd84a", MAIN_DONE = "#fff0a0", SIDE_MARK = "#5aaaff", SIDE_DONE = "#a8d8ff", JOB_MARK = "#5ee07a", JOB_DONE = "#b4f5c0";   // 알바 in green

// ───────────────────────────── render ─────────────────────────────
// The world is drawn by the 3D scene; names, numbers and speech are drawn over
// it on a 2D canvas, each pinned to its point in the world.

export function render(t, dt) {
  if (!G.map) return;
  S3.sync(G, dt, t);
  S3.render(G.me.x, G.me.y, dt, t, G.snapCam);
  G.snapCam = false;
  Dim.tick();
  Housing.tick();
  forgeHammer(t);
  renderText(t);
}
/** Near 캉캉대장간's open forge yard by day, the outdoor anvil rings now and then (town.md H). */
let hammerAt = 0;
function forgeHammer(t) {
  if (G.map.id !== "town" || t < hammerAt) return;
  hammerAt = t + 1900 + Math.random() * 900;
  const anvil = G.map.big && G.map.big.find((b) => b.t === "prop" && b.k === "anvil"), h = Sky.hour();
  if (anvil && h > 7 && h < 19 && Math.hypot(G.me.x - anvil.x * T - 8, G.me.y - anvil.y * T - 8) < 5 * T) Sound.play("clang");
}

/** A player's name line: the job's emblem (whole pixels, never smoothed), then the level and the name. */
function nameLabel(w, sx, sy, col) {
  const str = `Lv.${w.lvl} ${w.name}`, k = Math.max(1, Math.round(dpr)), px = 16 * k;
  tg.font = `600 ${Math.round(12 * dpr)}px Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  const half = tg.measureText(str).width / 2, shift = (px + 2 * dpr) / 2 / dpr;
  tg.imageSmoothingEnabled = false;
  tg.drawImage(jobIcon(w.cls), Math.round((sx + shift) * dpr - half - px - 2 * dpr), Math.round(sy * dpr - px + 3 * dpr), px, px);
  label(str, sx + shift, sy, col);
}
function label(str, sx, sy, col, size = 12, bg = false) {
  const x = Math.round(sx * dpr), y = Math.round(sy * dpr);
  const px = Math.round(size * dpr);
  tg.font = `${size >= 15 ? 700 : 600} ${px}px Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  if (bg) {
    const w = tg.measureText(str).width + 14 * dpr, h = px + 9 * dpr;
    tg.fillStyle = "rgba(250,247,240,.96)";
    tg.beginPath(); tg.roundRect(x - w / 2, y - px - 3 * dpr, w, h, 6 * dpr); tg.fill();
    tg.beginPath(); tg.moveTo(x - 4 * dpr, y + 6 * dpr - 1); tg.lineTo(x, y + 11 * dpr); tg.lineTo(x + 4 * dpr, y + 6 * dpr - 1); tg.fill();
    tg.fillStyle = "#1c1a22";
    tg.fillText(str, x, y);
    return;
  }
  tg.lineJoin = "round";
  tg.lineWidth = 3.2 * dpr;
  tg.strokeStyle = "rgba(16,14,22,.9)";
  tg.strokeText(str, x, y);
  tg.fillStyle = col;
  tg.fillText(str, x, y);
}
/**
 * A speech bubble whose tail points down at (sx, sy): white, rounded, outlined,
 * wrapped to a few lines, with emoticons drawn in among the words. An emote is
 * a bubble holding one large emoticon that pops in.
 */
const BUBBLE_FONT = (px) => `600 ${px}px Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
function bubble(b, sx, sy, t) {
  const d = dpr, x = Math.round(sx * d), y = Math.round(sy * d);
  const pad = 6 * d, tail = 6 * d, r = 7 * d;
  const age = t - b.t0, fade = Math.max(0, Math.min(1, (b.until - t) / 350, age / 120));
  let w, h;
  if (b.emo !== undefined) {
    const pop = age < 160 ? 0.6 + 0.4 * Math.sin((age / 160) * Math.PI / 2) + 0.12 * Math.sin((age / 160) * Math.PI) : 1;
    const s = Math.round(28 * d * pop);
    w = s + pad * 2; h = s + pad * 2;
    bubbleFrame(x, y, w, h, tail, r, fade);
    tg.imageSmoothingEnabled = false;
    tg.globalAlpha = fade;
    tg.drawImage(Emo.emoCanvas(b.emo), Math.round(x - s / 2), Math.round(y - tail - h + pad + (28 * d - s) / 2), s, s);
    tg.globalAlpha = 1;
    return;
  }
  const px = Math.round(12 * d), ic = Math.round(15 * d), lh = Math.round(17 * d), maxW = 150 * d;
  tg.font = BUBBLE_FONT(px);
  if (!b.lines || b.d !== d) {
    // lay the words out once: break at spaces, and inside a word only when it will not fit
    const units = [];
    for (const seg of Emo.parse(b.text)) {
      if (seg.e !== undefined) units.push({ e: seg.e, w: ic + 2 * d });
      else for (const word of seg.s.split(/(\s+)/)) if (word) units.push({ s: word, w: tg.measureText(word).width });
    }
    const lines = [[]];
    let lw = 0;
    const push = (u) => {
      if (lw + u.w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; if (u.s && !u.s.trim()) return; }
      lines[lines.length - 1].push(u); lw += u.w;
    };
    for (const u of units) {
      if (u.s && u.w > maxW) { for (const ch of u.s) push({ s: ch, w: tg.measureText(ch).width }); }
      else push(u);
    }
    if (lines.length > 4) { lines.length = 4; lines[3].push({ s: "…", w: tg.measureText("…").width }); }
    b.lines = lines.map((l) => ({ units: l, w: l.reduce((a, u) => a + u.w, 0) }));
    b.d = d;
  }
  w = Math.max(...b.lines.map((l) => l.w)) + pad * 2;
  h = b.lines.length * lh + pad * 2 - 2 * d;
  bubbleFrame(x, y, w, h, tail, r, fade);
  tg.globalAlpha = fade;
  tg.textAlign = "left"; tg.textBaseline = "middle";
  tg.fillStyle = "#1c1a22";
  tg.imageSmoothingEnabled = false;
  b.lines.forEach((l, i) => {
    let cx = x - l.w / 2;
    const cy = y - tail - h + pad + lh * i + lh / 2 - 1 * d;
    for (const u of l.units) {
      if (u.e !== undefined) tg.drawImage(Emo.emoCanvas(u.e), Math.round(cx + 1 * d), Math.round(cy - ic / 2), ic, ic);
      else tg.fillText(u.s, cx, cy);
      cx += u.w;
    }
  });
  tg.textAlign = "center"; tg.textBaseline = "alphabetic";
  tg.globalAlpha = 1;
}
/** The bubble's body and tail. */
function bubbleFrame(x, y, w, h, tail, r, alpha) {
  const d = dpr, top = y - tail - h, left = Math.round(x - w / 2);
  tg.globalAlpha = alpha;
  tg.beginPath();
  tg.roundRect(left, top, w, h, r);
  tg.moveTo(x - 5 * d, top + h - 1); tg.lineTo(x, y); tg.lineTo(x + 5 * d, top + h - 1);
  tg.fillStyle = "rgba(252,250,244,.97)"; tg.fill();
  tg.lineWidth = 1.5 * d; tg.strokeStyle = "rgba(28,26,34,.85)"; tg.stroke();
  // cover the seam where the tail meets the body
  tg.fillStyle = "rgba(252,250,244,.97)"; tg.fillRect(x - 4 * d, top + h - 2 * d, 8 * d, 3 * d);
  tg.globalAlpha = 1;
}
function bar(sx, sy, w, k, col) {
  const x = Math.round((sx - w / 2) * dpr), y = Math.round(sy * dpr);
  tg.fillStyle = "rgba(10,10,16,.85)";
  tg.fillRect(x - dpr, y - dpr, w * dpr + 2 * dpr, 6 * dpr);
  tg.fillStyle = col;
  tg.fillRect(x, y, Math.max(dpr, w * dpr * k), 4 * dpr);
}

function renderText(t) {
  tg.clearRect(0, 0, text.width, text.height);
  tg.textAlign = "center";
  tg.textBaseline = "alphabetic";
  const m = G.map, me = G.me;
  const myParty = G.who.get(G.you)?.party;
  const at = (x, y, h) => S3.project(x, y, h);
  // a name pinned off the screen draws nothing: skip its text work (the margin outruns the widest label)
  const VW = text.width / dpr, VH = text.height / dpr;
  const off = (x, y) => x < -240 || x > VW + 240 || y < -160 || y > VH + 160;
  // signpost boards: a small dark plate with the destination over each visible post
  if (S3.labels) {
    tg.font = `700 ${Math.round(10 * dpr)}px Pretendard, "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
    tg.textBaseline = "middle";
    for (const l of S3.labels()) {
      const x = Math.round(l.x * dpr), y = Math.round(l.y * dpr), w = Math.round(tg.measureText(l.text).width + 12 * dpr), h = Math.round(16 * dpr);
      tg.fillStyle = "rgba(34,27,40,.82)";
      tg.beginPath(); tg.roundRect(x - w / 2, y - h / 2, w, h, 3 * dpr); tg.fill();
      tg.strokeStyle = "rgba(226,196,134,.45)"; tg.lineWidth = 1; tg.stroke();
      tg.fillStyle = "#ffe9b8";
      tg.fillText(l.text, x, y + 1);
    }
    tg.textBaseline = "alphabetic";
  }

  if (G.path && G.mark) {
    const [x, y] = at(G.mark.pos[0], G.mark.pos[1], 0.02), k = ((t - G.mark.at) / 500) % 1;
    tg.strokeStyle = `rgba(250,236,190,${1 - k * 0.7})`; tg.lineWidth = 2 * dpr;
    tg.beginPath(); tg.ellipse(x * dpr, y * dpr, (8 + k * 10) * dpr, (4 + k * 5) * dpr, 0, 0, Math.PI * 2); tg.stroke();
  }
  for (const p of m.portals) {
    if (p !== m.portals.find((q) => q.to === p.to)) continue;
    const [x, y] = at(p.x * T + 8, p.y * T + 8, 2.1);
    if (off(x, y)) continue;
    label(`▸ ${p.to}`, x, y, "#e0c8ff");
  }
  const server = Sky.serverNow();
  for (const n of m.npcs) {
    if (n.thing) {   // a thing's name shows on the F prompt only (town.md E); a 알바 board still wears its green mark
      const jm = Board.markFor(n);
      if (jm) { const [x, y] = at(n.x * T + 8, n.y * T + 12, 2.6); if (!off(x, y)) label(jm, x, y + Math.sin(t / 200) * 3, jm === "!" ? JOB_MARK : JOB_DONE, 18); }
      continue;
    }
    const actor = NPC.cast(n.id), away = actor && !NPC.at(n.id, server)?.onPost;
    if (actor ? away && !S3.npcService(n) : !S3.npcOut(n)) continue;
    const [x, y] = at(n.x * T + 8, n.y * T + 12, 1.55);
    if (off(x, y)) continue;
    label(away ? `${n.name} 안내판` : n.name, x, y, away ? "#d5bd99" : "#f0d48a");
    const sqm = SideQ.mark(n, G.self);
    if (sqm) label(sqm, x, y - 18 + Math.sin(t / 200) * 3, sqm === "!" ? SIDE_MARK : SIDE_DONE, 18);
    else { const jm = Board.markFor(n); if (jm) label(jm, x, y - 18 + Math.sin(t / 200) * 3, jm === "!" ? JOB_MARK : JOB_DONE, 18); }
    if (n.role === "elder" && G.self) {
      const q = G.self.q, quest = G.defs.quests[q.i];
      const mark = !quest ? "" : q.st === 0 ? "!" : q.n >= quest.n ? "?" : "";
      if (mark) label(mark, x, y - 18 + Math.sin(t / 200) * 3, mark === "!" ? MAIN_MARK : MAIN_DONE, 18);
    }
  }
  for (const n of NPC.list(server)) {
    if (n.onPost || n.fade < 0.5) continue;
    const [x, y] = at(n.x, n.y, 1.55);
    if (off(x, y)) continue;
    label(n.name, x, y, "#f0d48a");
    const mark = SideQ.mark(n, G.self);
    const jm = !mark && Board.markFor(n);
    if (mark) label(mark, x, y - 18 + Math.sin(t / 200) * 3, mark === "!" ? SIDE_MARK : SIDE_DONE, 18);
    else if (jm) label(jm, x, y - 18 + Math.sin(t / 200) * 3, jm === "!" ? JOB_MARK : JOB_DONE, 18);
  }
  // Residents talking together and ambient conversations close enough to hear.
  for (const b of S3.townBubbles(t)) { const [x, y] = at(b.x, b.y, 1.8); bubble(b.b, x, y, t); }
  for (const mob of G.mobs.values()) {
    const d = G.defs.mobs[mob.k], max = mobMax(mob);
    if (!(d.boss || mob.el || mob.hp < max)) continue;
    const [x, y] = at(mob.x, mob.y, (mob.h3 || 1) + 0.28);
    if (off(x, y)) continue;
    // in a dungeon the rank-2 monster is its guardian; out in the open it is the field boss
    // an elite wears its traits: named in its title, and stamped as glyphs above it
    const tr = mob.tr || [], traits = G.defs.traits || {};
    const tn = tr.length && traits[tr[0]] ? `${traits[tr[0]][0]} ` : "";
    if (tr.length) {
      tg.imageSmoothingEnabled = false;
      tr.forEach((k, i) => { const tk = TRAIT[k]; if (tk) tg.drawImage(icon(tk[0], tk[1]), Math.round(x - tr.length * 9 + i * 18 + 1), Math.round(y - 29), 16, 16); });
    }
    label(`Lv.${d.lv} ${mob.el === 2 && DUNGEONS.has(G.map.id) ? "수문장 " : RANK_NAME[mob.el | 0]}${tn}${d.name}`, x, y, d.boss ? "#ff9ae0" : mob.el === 2 ? "#ff8a4a" : mob.el ? "#ffbe3c" : "#ece0e0");
    if (mob.hp < max) bar(x, y + 4, d.boss ? 90 : mob.el === 2 ? 70 : 42, mob.hp / max, mob.el === 2 ? "#ff8a4a" : mob.el ? "#ffbe3c" : "#d8404c");
    // bosses and elites: the HP in numbers, a rift's party/level toughness included (hk, 64-dim.js — damage is divided by it)
    if (d.boss || mob.el) { const k = mob.hk || 1; label(`${Math.ceil(mob.hp * k).toLocaleString()} / ${Math.round(max * k).toLocaleString()}`, x, y + 14, "#f0e0e0", 10); }
    // a scripted boss's marked cast: the stagger gauge the party must break before it lands (net.js stg)
    if (mob.bst === 1 && mob.stg) { bar(x, y + 22, 90, mob.stg / 100, "#7ad4ff"); label(`무력화 ${mob.stg}%`, x, y + 32, "#bfeaff", 10); }
  }
  for (const d of G.drops.values()) {
    // the loot filter decides whose names are shown: everything, magic and up, or rare and up
    if (!Growth.showDrop(d)) continue;
    const [x, y] = at(d.x, d.y, 0.6);
    if (off(x, y)) continue;
    label(Growth.dropName(d), x, y, d.it === "gold" ? "#ffd84a" : Art.RARITY_COL[d.q | 0]);
  }
  const mine = G.who.get(G.you);
  for (const [eid, p] of G.players) {
    const w = G.who.get(eid);
    if (!w) continue;
    const [x, y] = at(p.x, p.y, (p.h3 || 1.32) + 0.22);
    if (off(x, y)) continue;
    nameLabel(w, x, y, p.dead ? "#9a9aa8" : w.party && w.party === myParty ? "#8cff8c" : "#dce6f2");
    if (w.guild) label(`‹${w.guild}›`, x, y - 13, mine && w.guild === mine.guild ? "#9af0ae" : "#c8b8e8", 11);
    if (w.title) label(`「${w.title}」`, x, y - (w.guild ? 26 : 13), "#ffcf6a", 11);
    if (p.hp < p.mhp && !p.dead) bar(x, y + 4, 40, p.hp / p.mhp, "#58c070");
  }
  // your own name lifts while the aim arrow points up over your head
  if (mine) { const [x, y] = at(me.x, me.y, (me.h3 || 1.32) + 0.22 + (G.aimArrow === false ? 0 : 0.3 * (G.aimUpK || 0))); nameLabel(mine, x, y, "#f4e4b0"); if (mine.guild) label(`‹${mine.guild}›`, x, y - 13, "#9af0ae", 11); if (mine.title) label(`「${mine.title}」`, x, y - (mine.guild ? 26 : 13), "#ffcf6a", 11); }
  for (const b of G.bobs.values()) if (b.bite) { const [x, y] = at(b.x, b.y, 0.9); label("!", x, y + Math.sin(t / 60) * 2, "#ffe04a", 20); }
  for (const [eid, b] of G.bubbles) {
    if (t > b.until) { G.bubbles.delete(eid); continue; }
    const p = entityPos(eid);
    if (!p) continue;
    const [x, y] = at(p.x, p.y, (p.h3 || 1.32) + 0.5);
    const w = G.who.get(eid), over = w ? (w.guild ? 1 : 0) + (w.title ? 1 : 0) : 0;
    bubble(b, x, y - 14 - Math.max(0, over - 1) * 13, t);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const f = G.texts[i];
    const k = (t - f.t0) / 900;
    if (k >= 1) { G.texts.splice(i, 1); continue; }
    tg.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    if (f.dmg) {
      // damage: punched out oversized and snapping to size on an elastic, hopping off to one side
      // and bouncing once where it lands; a crit hits bigger and wobbles longer
      const u = Math.min(1, k / (f.big ? 0.42 : 0.3)), el = u >= 1 ? 1 : 2 ** (-10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
      const s0 = f.big ? 2.3 : 1.7, scale = s0 + (1 - s0) * el;
      const [x, y] = at(f.x, f.y, f.h + 0.1);
      const hop = k < 0.45 ? -Math.sin((k / 0.45) * Math.PI) * (f.big ? 22 : 15) : k < 0.62 ? -Math.sin(((k - 0.45) / 0.17) * Math.PI) * (f.big ? 6 : 4) : 0;
      label(f.str, x + f.vx * Math.min(1, k / 0.6), y + hop - k * 10, f.col, (f.big ? 19 : 13) * scale);
      continue;
    }
    const [x, y] = at(f.x, f.y, f.h + k * 0.55);
    const pop = f.big && k < 0.15 ? -6 * Math.sin((k / 0.15) * Math.PI) : 0;
    label(f.str, x, y + pop, f.col, f.big ? 17 : 13);
  }
  tg.globalAlpha = 1;
  if (G.flash > 0) { tg.fillStyle = `rgba(255,40,60,${G.flash * 0.22})`; tg.fillRect(0, 0, text.width, text.height); }
  // the white blink of a heavy hit
  if (G.punch > 0) { tg.fillStyle = `rgba(255,255,255,${G.punch * 0.16})`; tg.fillRect(0, 0, text.width, text.height); G.punch = Math.max(0, G.punch - 0.25); }
}

/** Whether the sheet has woken map `id`'s waypoint stone `i` (self.wp: { mapId: bitmask of its stones }). */
export function wpWoke(s, id, i = 0) { return !!(s && s.wp && !Array.isArray(s.wp) && (s.wp[id] & (1 << i))); }
