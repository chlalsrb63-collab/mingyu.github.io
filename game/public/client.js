/**
 * 루멘테일 온라인 — the browser side.
 *
 * The server is authoritative: this file sends intents ({type:"action"}) and
 * draws the snapshots that come back ten times a second. The one thing it does
 * on its own is move your character immediately (the server checks every step
 * and corrects it if it disagrees), so walking never waits on the network.
 *
 * Tables (items, monsters, skills, quests) and maps all arrive from the server;
 * nothing about the rules is duplicated here.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as Mini from "./minigames.js";
import { skillIconUrl } from "./skillicons.js";
import { icon, iconImg, MENU_ICON, BUFF_ICON, TRAIT } from "./uiicons.js";
import * as Emo from "./emoticons.js";

const T = Art.TILE;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // textContent only — server strings are never markup
  return e;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const now = () => performance.now();

// ───────────────────────────── connection ─────────────────────────────

/** Played from anywhere else (e.g. a static mirror), the game still talks to its live server. */
const LIVE_HOST = "lumentale-online.higgsfield.app";
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const HOST = local || location.hostname.endsWith("higgsfield.app") ? location.host : LIVE_HOST;
const PROTO = location.protocol === "http:" && local ? "ws:" : "wss:";

/** Your claim to your character. Kept in this browser; never shown to other players. */
function playerId() {
  const key = "lumentale:pid";
  let id = localStorage.getItem(key);
  if (!id || id.length < 16) {
    const b = crypto.getRandomValues(new Uint8Array(18));
    id = [...b].map((v) => v.toString(36).padStart(2, "0")).join("").slice(0, 32);
    localStorage.setItem(key, id);
  }
  return id;
}

let ws = null;
let retry = 0;
let wantOnline = false;
let channel = new URLSearchParams(location.search).get("ch") || localStorage.getItem("lumentale:ch") || "ch1";
if (!/^ch[1-3]$/.test(channel)) channel = "ch1";

function connect() {
  wantOnline = true;
  ws = new WebSocket(`${PROTO}//${HOST}/ws/${channel}`);
  ws.addEventListener("open", () => {
    retry = 0;
    ws.send(JSON.stringify({ type: "join", playerId: playerId() }));
  });
  ws.addEventListener("message", (ev) => {
    if (ev.data === "__pong") return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    onMessage(msg);
  });
  ws.addEventListener("close", () => {
    if (!wantOnline) return;
    retry = Math.min(retry + 1, 6);
    const wait = 400 * 2 ** (retry - 1);
    if (G.playing) addChat("서버와의 연결이 끊겼습니다. 다시 연결하는 중…", "err");
    else $("#title-msg").textContent = "서버에 연결하는 중…";
    setTimeout(() => wantOnline && connect(), wait);
  });
}
function act(action) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
}
setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send("__ping"); }, 30000);

// ───────────────────────────── state ─────────────────────────────

const G = {
  playing: false, you: 0, defs: null, icons: null, self: null, map: null,
  me: { x: 0, y: 0, dir: 0, hp: 1, mp: 0, dead: false, walk: 0, moving: false, atkT: -1e9, hurtT: -1e9 },
  who: new Map(), players: new Map(), mobs: new Map(), gone: new Map(), drops: new Map(), fires: new Map(), bobs: new Map(), ginv: null,
  fx: [], parts: [], texts: [], bubbles: new Map(), statics: [],
  cdEnd: [0, 0, 0], buffEnd: [0, 0], potAt: 0, lastAtk: 0, lastSkill: 0,
  auto: false, sel: -1, shake: 0, flash: 0, near: null, party: [], pinv: null, path: null, mark: null,
};
let mini = null;
let dpr = 1;

const world = $("#world");
const text = $("#text"), tg = text.getContext("2d");

function resize() {
  const W = innerWidth, H = innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  text.width = Math.round(W * dpr); text.height = Math.round(H * dpr);
  text.style.width = W + "px"; text.style.height = H + "px";
  S3.resize();
}
addEventListener("resize", resize);
S3.init(world);
resize();
S3.showcase();

// ───────────────────────────── messages ─────────────────────────────

function onMessage(msg) {
  switch (msg.type) {
    case "need_char":
      $("#title").hidden = true;
      $("#create").hidden = false;
      S3.showcase(draftLook());
      $("#c-name").focus();
      break;
    case "welcome":
      G.you = msg.you;
      if (!G.defs) {
        G.defs = msg.defs;
        G.icons = Art.buildIcons(G.defs.items);
      }
      G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear(); G.who.clear();
      $("#title").hidden = true; $("#create").hidden = true; $("#hud").hidden = false;
      if (!G.playing) {
        G.playing = true;
        addChat(`루멘테일 온라인에 오신 것을 환영합니다! (${channelName()})`, "sys");
        addChat("관리자 엘더윈에게 말을 걸어 첫 의뢰를 받아 보세요. [?] 버튼에 조작법이 있습니다.", "sys");
      }
      break;
    case "snap": onSnap(msg); break;
    case "rank": renderRank(msg.list); break;
    case "error":
      if (msg.fatal) {
        wantOnline = false;
        G.playing = false;
        try { ws.close(); } catch { /* already closed */ }
        $("#hud").hidden = true; $("#create").hidden = true; $("#title").hidden = false;
        tg.clearRect(0, 0, text.width, text.height);
        S3.showcase();
        $("#title-msg").textContent = msg.error;
      } else if (!$("#create").hidden) {
        $("#create-msg").textContent = msg.error;
      } else {
        toast(msg.error);
        Sound.play("no");
      }
      break;
  }
}
const channelName = () => `채널 ${channel.slice(2)}`;

function loadMap(m) {
  G.map = m;
  G.path = null;
  S3.leaveStage();
  S3.loadMap(m);
  mini = Art.renderMini(m);
  const cv = $("#mini-cv");
  cv.width = mini.width; cv.height = mini.height;
  G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear();
  G.texts.length = 0;
  G.snapCam = true;
  $("#mini-name").textContent = m.band ? `${m.name} Lv.${m.band[0]}–${m.band[1]}` : m.name;
  Sound.bgm(m.bgm);
  banner(m.name, true);
  closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train");
}

function onSnap(s) {
  const t = now();
  const me = G.me;
  if (s.map) loadMap(s.map);
  if (s.map || s.me[5]) { me.x = s.me[0]; me.y = s.me[1]; me.dir = s.me[6]; }
  me.hp = s.me[2]; me.mp = s.me[3]; me.sit = !!s.me[7];
  const dead = !!s.me[4];
  if (dead !== me.dead) { me.dead = dead; $("#dead").hidden = !dead; if (dead) { G.auto = false; Sound.play("die"); } }

  if (s.who) {
    G.who.clear();
    for (const [eid, name, cls, lvl, look, at, wt, party, wq, we, , wk, guild] of s.who) {
      G.who.set(eid, { name, cls, lvl, look, gear: { at, wt, wq, we, wk }, party, guild });
    }
    if (isOpen("party")) renderParty();
    if (isOpen("guild")) renderGuild();
  }
  sync(G.players, s.P, (e, r) => { e.tx = r[1]; e.ty = r[2]; e.dir = r[3]; e.dead = !!r[4]; e.hp = r[5]; e.mhp = r[6]; e.sit = !!r[7]; }, t);
  sync(G.fires, s.F || [], (e, r) => { e.tx = r[1]; e.ty = r[2]; e.x = r[1]; e.y = r[2]; }, t);
  sync(G.mobs, s.M, (e, r) => { e.k = r[1]; e.tx = r[2]; e.ty = r[3]; e.dir = r[4]; e.hp = r[5]; e.el = r[6]; e.tr = r[7] || []; }, t, G.gone);
  sync(G.drops, s.D, (e, r) => { e.it = r[1]; e.tx = r[2]; e.ty = r[3]; e.q = r[4]; }, t);

  if (s.self) {
    G.self = s.self;
    for (let i = 0; i < 4; i++) G.cdEnd[i] = t + s.self.cds[i];
    G.streak = { n: s.self.streak[0], end: t + s.self.streak[1] };
    G.buffEnd = s.self.buffs.map((ms) => t + ms);
    refreshUi();
    if (isOpen("guild")) renderGuild();
  }
  if (s.ev) for (const e of s.ev) {
    const wait = G.impactAt - t;
    if (wait > 8 && ((e[0] === "h" && !e[4] && e[2] > 0) || e[0] === "k")) setTimeout(() => onEvent(e, now()), wait);
    else onEvent(e, t);
  }
  for (const [id, m] of G.gone) if (t - m.goneT > 1500) G.gone.delete(id);
  if (s.chat) for (const c of s.chat) c.sys ? addChat(c.m, "sys") : c.g ? addChat(c.m, "guild", `[길드] ${c.n}`) : addChat(c.m, "", c.n);
  if (s.gain) for (const gn of s.gain) onGain(gn);
  if (s.toast) for (const m of s.toast) toast(m);
  const pk = JSON.stringify(s.party || []);
  if (pk !== G.partyKey) { G.partyKey = pk; G.party = s.party || []; renderPartyHud(); if (isOpen("party")) renderParty(); }
  const gi = s.ginv ? s.ginv.join("|") : null;
  if ((s.pinv || null) !== G.pinv || gi !== G.ginv) { G.pinv = s.pinv || null; G.ginv = gi; renderInvite(); }
  hudBars();
}

/** Bring a Map of entities in line with a snapshot list (first field is the id). */
function sync(map, rows, apply, t, gone) {
  const seen = new Set();
  for (const r of rows) {
    seen.add(r[0]);
    let e = map.get(r[0]);
    const fresh = !e;
    if (!e) { e = { id: r[0], x: 0, y: 0, walk: 0, atkT: -1e9, hurtT: -1e9, born: t }; map.set(r[0], e); }
    apply(e, r);
    if (fresh) { e.x = e.tx; e.y = e.ty; }
  }
  for (const [id, e] of map) if (!seen.has(id)) { if (gone) { e.goneT = t; gone.set(id, e); } map.delete(id); }
}

function entityPos(id) {
  if (id === G.you) return G.me;
  return G.players.get(id) || G.mobs.get(id) || G.gone.get(id) || null;
}

const MOB_COL = { twinhare: "#a83848", gutfrog: "#7a9a4a", eyecrow: "#5c3c6c", splitboar: "#a83848", ribdeer: "#e0d8c8", hydrasnake: "#5a8a4a", mothface: "#b8a890", ratking: "#c87a8a", bonehound: "#a83848", batcluster: "#5c3c6c", pigeonmass: "#7a8aa0", doghead: "#7a5a48", catsplit: "#a83848", fishwalker: "#8ab0c0", leechmaw: "#b4cc3c", gatorhalf: "#5a7a4a", eelknot: "#4a5a6a", spiderhand: "#e0d8c8", bearmaw: "#a83848", owlstare: "#7a5a48", twingoat: "#e0d8c8", horsehalf: "#a83848", serpentwing: "#b4cc3c", boss: "#e050b8", abyssboss: "#b4cc3c", chest_meadow: "#f0c040", chest_forest: "#f0c040", chest_city: "#f0c040", chest_cave: "#f0c040", chest_crypt: "#f0c040", chest_sewer: "#f0c040", chest_abyss: "#f0c040" , lambmaw: "#a83848", foxtwine: "#c8643c", toadbrood: "#7a8a4a", squidrat: "#8a6a7a", crabskull: "#c85a3a", moleworm: "#5a566a", lionhand: "#b8905a", sowseer: "#d8a0a8", twinhare_bone: "#e0d8c8", gutfrog_poison: "#8ad84a", ratking_bile: "#b4cc3c", splitboar_frost: "#8ad8ff", hydrasnake_steel: "#a8b4c8", bonehound_ash: "#5a5a66", batcluster_blood: "#b02838", doghead_fire: "#ff8a3a" };
const mobMax = (m) => Math.round(G.defs.mobs[m.k].hp * G.defs.eliteHp[m.el | 0]);
const RANK_NAME = ["", "정예 ", "우두머리 "];
Mini.mount($("#minigame"));
// the menu wears glyphs: beside the words where there is room, instead of them where there is not
for (const b of $$("#menu button[data-win]")) { const g = MENU_ICON[b.dataset.win]; if (!g) continue; if (b.dataset.win === "help") b.textContent = ""; b.prepend(iconImg(g)); }
$("#b-sit").prepend(iconImg(MENU_ICON.sit));
$("#b-emo").textContent = ""; $("#b-emo").append(iconImg(MENU_ICON.emo));
$("#btn-sound").textContent = ""; $("#btn-sound").append(iconImg(MENU_ICON.sound));

const heightOf = (e) => e.h3 || 1.3;

function onEvent(e, t) {
  switch (e[0]) {
    case "a": {
      const [, eid, kind, tx, ty] = e;
      const src = entityPos(eid);
      if (!src) break;
      // which blow of the combo this is; a skill swings like a finisher
      const beat = kind >= 10 ? 2 : e[6] | 0;
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; src.atkN = beat; }
      else { G.me.dir = e[5]; G.me.atkN = beat; if (kind < 10) G.combo = beat; }
      src.aim = [tx, ty + 6];
      G.hitFrom = [src.x, src.y];
      attackFx(kind, src, tx, ty + 6, e[5], beat);
      break;
    }
    case "h": {
      const [, id, dmg, crit, isPlayer] = e;
      const tgt = entityPos(id);
      if (!tgt) break;
      const h = heightOf(tgt);
      if (dmg < 0) floatText(`+${-dmg}`, tgt.x, tgt.y, h + 0.3, "#8cff8c");
      else {
        floatText(crit ? `${dmg}!` : String(dmg), tgt.x + (Math.random() * 8 - 4), tgt.y, h + 0.25, isPlayer ? "#ff7a7a" : crit ? "#ffd84a" : "#ffffff", crit);
        tgt.hurtT = t;
        // recoil away from whoever struck last
        if (!isPlayer && G.hitFrom) {
          tgt.hurtA = Math.atan2(tgt.y - G.hitFrom[1], tgt.x - G.hitFrom[0]);
          // was this my own blow landing? then it gets the full treatment: a held frame, a kick, a burst
          const mine = t - G.lastAtk < 420, fin = mine && G.me.atkN === 2, heavy = crit || fin;
          tgt.hurtP = heavy ? 1.6 : 1;
          S3.fx.spark(tgt.x, tgt.y, crit ? "#ffe04a" : "#ffffff", heavy ? 1.7 : 1.1);
          S3.fx.ring(tgt.x, tgt.y - 4, heavy ? 20 : 11, crit ? "#ffe04a" : "#ffffff", heavy ? 220 : 150);
          if (mine) {
            if (!G.me.hs || t > G.me.hs.at + G.me.hs.dur) G.me.hs = { at: t, dur: heavy ? 110 : 55 };
            S3.shake(heavy ? 5 : 2);
            if (heavy) { G.punch = 1; Sound.play("crit"); }
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
      if (m) { G.gone.delete(e[1]); S3.fx.burst(m.x, m.y, heightOf(m) * 0.5, MOB_COL[m.k] || "#fff", G.defs.mobs[m.k]?.boss ? 70 : 16, 2.2); Sound.play("die"); G.mobs.delete(e[1]); }
      break;
    }
    case "m": {
      const m = G.mobs.get(e[1]);
      if (m) {
        m.atkT = t;
        if (e.length > 2) { S3.fx.proj(m.x, m.y, heightOf(m) * 0.75, e[2], e[3] + 8, 0.7, "#ff5a4a", 0.05, 34); Sound.play("shoot"); }
      }
      break;
    }
    case "d": S3.fx.beam(e[2], e[3] + 8, e[4], e[5] + 8, "#8a78c8", 0.6); S3.fx.burst(e[2], e[3] + 8, 0.6, "#4a4468", 10, 1); break;
    case "t": if (e[5]) { S3.fx.ring(e[1], e[2], e[3], "#ffe08a", e[4]); break; } S3.fx.tele(e[1], e[2], e[3], e[4]); Sound.play("warn"); break;
    case "b": {
      // a blast on the ground: a monster's (pink, it hurts) or a player's skill landing
      const col = [null, "#ffb04a", "#ff8a3a", "#cfe4ff"][e[4] | 0];
      if (col) { S3.fx.ring(e[1], e[2], e[3], col, 300, true); S3.fx.burst(e[1], e[2], 0.4, col, 18, 2.4); S3.shake(2); Sound.play("boom"); }
      else { S3.fx.ring(e[1], e[2], e[3], "#ff6ad0", 350, true); S3.fx.burst(e[1], e[2], 0.4, "#ff6ad0", 34, 3); S3.shake(6); Sound.play("boom"); }
      break;
    }
    case "c": S3.fx.lane(e[2], e[3], e[4], e[5], e[6]); Sound.play("warn"); break;      // a charge is coming down this line
    case "v": {
      // a spread of shots, each landing where its mark is
      const m = G.mobs.get(e[1]);
      if (!m) break;
      const pts = [];
      for (let i = 3; i + 1 < e.length; i += 2) pts.push([e[i], e[i + 1]]);
      m.atkT = t;
      S3.fx.volley(m.x, m.y, pts, e[2]);
      Sound.play("shoot");
      break;
    }
    case "q": S3.fx.pop(e[1], e[2], e[3]); break;
    case "g": {
      // spat out, it lands and stays: poison, fire or a slowing mire
      const m = G.mobs.get(e[1]);
      if (m) { m.atkT = t; S3.fx.spit(m.x, m.y, e[2], e[3], e[4], e[5], e[6], e[7]); Sound.play("magic"); }
      break;
    }
    case "z":
      // something flying from one point to another: a legendary's lightning, or a thrown knife
      if (e[5]) S3.fx.proj(e[1], e[2] + 8, 0.6, e[3], e[4] + 8, 0.5, "#b8f060", 0.05, 30);
      else { S3.fx.beam(e[1], e[2] + 8, e[3], e[4] + 8, "#fff48a", 0.45); S3.fx.burst(e[3], e[4] + 8, 0.5, "#fff48a", 8, 1.6); Sound.play("magic"); }
      break;
    case "l": {
      const p = entityPos(e[1]);
      if (p) { S3.fx.pillar(p.x, p.y); if (e[1] !== G.you) floatText("LEVEL UP", p.x, p.y, heightOf(p) + 0.5, "#ffd84a", true); }
      break;
    }
    case "pd": { const p = entityPos(e[1]); if (p) S3.fx.burst(p.x, p.y, 0.6, "#c8c8d8", 12, 1.4); break; }
    // what someone says floats over their head for a while, longer for longer lines
    case "s": G.bubbles.set(e[1], { text: e[2], t0: t, until: t + 3500 + Math.min(4000, e[2].length * 90) }); break;
    case "o": G.bubbles.set(e[1], { emo: e[2] | 0, t0: t, until: t + 2800 }); break;
    case "f": {
      // 1: a line goes out · 2: a bite · 0: it comes back in
      if (e[2] === 1) G.bobs.set(e[1], { id: e[1], eid: e[1], x: e[3], y: e[4], bite: false });
      else if (e[2] === 2) {
        const b = G.bobs.get(e[1]);
        if (b) { b.bite = true; S3.fx.ring(b.x, b.y, 12, "#ffffff", 300); }
        if (e[1] === G.you) { Sound.play("ok"); banner("입질! F", true); }
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
      if (e[1] === G.you) Sound.play(e[2] ? "ok" : "fail");
      break;
    }
  }
}

function onGain([kind, a, b, q]) {
  const me = G.me, h = heightOf(me);
  if (kind === "xp") floatText(`+${a} EXP`, me.x, me.y, h + 0.55, "#fff08a");
  else if (kind === "gold") { addChat(`골드 +${a}`, "loot"); Sound.play("coin"); }
  else if (kind === "item") {
    const p = addChat(`획득: ${q ? `[${G.defs.rarity[q]}] ` : ""}${G.defs.items[a].name}${b > 1 ? ` ×${b}` : ""}`, "loot");
    if (q) p.style.color = Art.RARITY_COL[q];
    Sound.play(q >= 2 ? "ok" : "item");
    if (q >= 3) banner(q === 4 ? "세트 획득!" : "전설 획득!", true);
  } else if (kind === "lvl") { banner("LEVEL UP!"); floatText(`Lv.${a}`, me.x, me.y, h + 0.9, "#ffd84a", true); Sound.play("level"); addChat(`레벨 ${a}이(가) 되었습니다!`, "sys"); }
}

// ───────────────────────────── effects ─────────────────────────────
// Effects live in the 3D scene; floating text is drawn over it and follows its point in the world.

function floatText(str, x, y, h, col, big) {
  G.texts.push({ str, x, y, h, col, big: !!big, t0: now() });
}
/** `src` is the attacker, (tx, ty) the point of impact on the ground. */
function attackFx(kind, src, tx, ty, dir, beat = 0) {
  const fin = beat === 2;
  const f = S3.fx;
  // the blade's crescent opens toward the target (or the way the attacker faces)
  const ang = Math.hypot(tx - src.x, ty - src.y) > 2 ? Math.atan2(ty - src.y, tx - src.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][dir] || 0;
  switch (kind) {
    case 0: f.slash(src.x, src.y, ang, "#cfe0ff", fin ? 1.9 : 1.4, beat === 1); if (fin) S3.shake(3); Sound.play("swing"); break;
    case 1: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, "#fff0c0", 0.04, 42); f.burst(src.x + (tx - src.x) * 0.15, src.y + (ty - src.y) * 0.15, 0.75, "#ffd84a", 4, 0.8); Sound.play("shoot"); break;
    case 2: f.proj(src.x, src.y, 1.1, tx, ty, 0.5, "#b08aff", fin ? 0.15 : 0.09, 15, fin ? () => f.ring(tx, ty, 18, "#b08aff", 220, true) : undefined); Sound.play("magic"); break;
    case 3: f.slash(src.x, src.y, ang, "#e0d0f0", fin ? 1.15 : 0.8, beat === 1); Sound.play("swing"); break;
    case 4: if (beat === 1) f.slash(src.x, src.y, ang, "#d0f0e8", 1.7, true); else { f.beam(src.x, src.y, src.x + Math.cos(ang) * (fin ? 74 : 54), src.y + Math.sin(ang) * (fin ? 74 : 54), "#eef4ff", fin ? 0.9 : 0.5); if (fin) S3.shake(2); } Sound.play("swing"); break;
    case 5: f.proj(src.x, src.y, 0.9, tx, ty, 0.5, "#c8a0ff", 0.07, 20, () => { f.ring(tx, ty, fin ? 34 : 26, "#c8a0ff", 220, true); }); Sound.play("magic"); break;
    case 23: f.beam(src.x, src.y, tx, ty, "#e0b070", 1.1); f.burst(tx, ty, 0.4, "#e0b070", 20, 2.4); S3.shake(5); Sound.play("boom"); break;
    case 24: f.sparkle(src.x, src.y, 0.8, "#ffe9a0", 12); Sound.play("magic"); break;
    case 10: f.slash(src.x, src.y, ang, "#ffd84a", 1.05); S3.shake(2); Sound.play("crit"); break;
    case 11: f.ring(src.x, src.y, 48, "#ffffff", 260); f.ring(src.x, src.y, 34, "#ffd84a", 240, false, 60); Sound.play("swing"); break;
    case 12: f.ring(src.x, src.y, 60, "#ff7a5a", 500); f.sparkle(src.x, src.y, 0.9, "#ff7a5a", 16); Sound.play("buff"); break;
    case 13: f.beam(src.x, src.y, tx, ty, "#9fe8ff", 0.7); Sound.play("shoot"); break;
    case 14: f.sparkle(src.x, src.y, 0.4, "#b8ffd0", 18); f.ring(src.x, src.y, 22, "#b8ffd0", 400); Sound.play("buff"); break;
    case 15: f.proj(src.x, src.y, 1.1, tx, ty, 0.4, "#ff8a3a", 0.14, 13, () => { f.ring(tx, ty, 34, "#ff8a3a", 300, true); f.burst(tx, ty, 0.4, "#ffd84a", 22, 2.6); S3.shake(3); Sound.play("boom"); }); Sound.play("magic"); break;
    case 16: f.ring(src.x, src.y, 58, "#9fe8ff", 420, true); f.sparkle(src.x, src.y, 0.6, "#d0f4ff", 22); Sound.play("ice"); break;
    case 17: f.ring(src.x, src.y, 90, "#8cff8c", 500); f.sparkle(src.x, src.y, 0.6, "#8cff8c", 22); Sound.play("heal"); break;
    case 18: f.slash(src.x, src.y, ang, "#e04860", 0.7); f.burst(tx, ty, 0.6, "#e04860", 10, 1.8); Sound.play("crit"); break;
    case 19: f.burst(src.x, src.y, 0.6, "#4a4468", 10, 1); break;
    case 20: f.burst(src.x, src.y, 0.5, "#8a8a98", 40, 1.2); Sound.play("buff"); break;
    case 21: f.proj(src.x, src.y, 1, tx, ty, 0.2, "#6a7a5a", 0.1, 11, () => { f.ring(tx, ty, 42, "#ffb04a", 320, true); f.burst(tx, ty, 0.4, "#ffd84a", 28, 3); S3.shake(4); Sound.play("boom"); }); Sound.play("swing"); break;
  }
}

// ───────────────────────────── input ─────────────────────────────

const keys = new Set();
const held = { atk: false };
const joy = { on: false, x: 0, y: 0, id: null };
const typing = () => document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

addEventListener("keydown", (e) => {
  Sound.unlock();
  if (!G.playing) return;
  if (typing()) { if (e.key === "Escape") document.activeElement.blur(); return; }
  if (Mini.active()) return;               // a mini-game has the keyboard
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  switch (k) {
    case "1": case "2": case "3": case "4": castSkill(Number(k) - 1); break;
    case "q": case "ㅂ": usePotion("hp"); break;
    case "e": case "ㄷ": usePotion("mp"); break;
    case "f": case "ㄹ": interact(); break;
    case "x": case "ㅌ": act({ t: "sit" }); break;
    case "g": case "ㅎ": toggleWin("guild"); break;
    case "t": case "ㅅ": openEmotes("emote"); break;
    case "i": case "ㅑ": toggleWin("inv"); break;
    case "c": case "ㅊ": toggleWin("char"); break;
    case "l": case "ㅣ": toggleWin("quest"); break;
    case "r": case "ㄱ": toggleAuto(); break;
    case "p": case "ㅔ": toggleWin("party"); break;
    case "m": case "ㅡ": toggleSound(); break;
    case "v": case "ㅍ": setCrt(!document.body.classList.contains("crt")); break;
    case "Enter": e.preventDefault(); $("#chat-in").focus(); break;
    case "Escape": closeAll(); break;
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => { keys.clear(); held.atk = false; });

/** Which way to walk: keys, the stick, or the next step of a clicked route. */
function moveVector() {
  let x = 0, y = 0;
  if (Mini.active()) { keys.clear(); G.path = null; return [0, 0]; }
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("ㅁ")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("ㅇ")) x += 1;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("ㅈ")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("ㄴ")) y += 1;
  if (joy.on) { x = joy.x; y = joy.y; }
  if (x || y) G.path = null;
  else if (G.path) {
    while (G.path.length && dist(G.me.x, G.me.y, G.path[0][0], G.path[0][1]) < 2.5) G.path.shift();
    if (!G.path.length) G.path = null;
    else { x = G.path[0][0] - G.me.x; y = G.path[0][1] - G.me.y; }
  }
  const l = Math.hypot(x, y);
  return l > 0.2 ? [x / l, y / l] : [0, 0];
}

/**
 * Click or tap the ground to walk there. A shortest-path search over the tile
 * grid in which a diagonal step costs √2, so routes run straight where they can.
 * If the spot cannot be reached, the route ends at the nearest tile that can.
 */
function pathTo(wx, wy) {
  const m = G.map, n = m.w * m.h;
  const free = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && !"wW".includes(m.g[y][x]);
  const sx = Math.floor(G.me.x / T), sy = Math.floor((G.me.y - 2) / T);
  const gx = clamp(Math.floor(wx / T), 0, m.w - 1), gy = clamp(Math.floor(wy / T), 0, m.h - 1);
  const cost = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const start = sy * m.w + sx, goal = gy * m.w + gx;
  cost[start] = 0;
  const open = [start];
  let best = start, bestD = Math.hypot(sx - gx, sy - gy);
  while (open.length) {
    let k = 0;
    for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[k]]) k = i;
    const cur = open[k];
    open[k] = open[open.length - 1]; open.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = cur % m.w, cy = (cur - cx) / m.w;
    const d = Math.hypot(cx - gx, cy - gy);
    if (d < bestD) { bestD = d; best = cur; }
    if (cur === goal) break;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy, ni = ny * m.w + nx;
      if (!free(nx, ny) || done[ni]) continue;
      if (dx && dy && !(free(cx + dx, cy) && free(cx, cy + dy))) continue; // no cutting corners
      const c = cost[cur] + (dx && dy ? 1.4142 : 1);
      if (c < cost[ni]) { cost[ni] = c; prev[ni] = cur; open.push(ni); }
    }
  }
  const path = [];
  for (let cur = best; cur !== start && cur !== -1; cur = prev[cur]) path.unshift([(cur % m.w) * T + 8, Math.floor(cur / m.w) * T + 10]);
  return path.length ? path : null;
}
world.addEventListener("pointerdown", (e) => {
  if (!G.playing || !G.map || G.me.dead) return;
  const hit = S3.pick(e.clientX, e.clientY);
  if (!hit) return;
  G.path = pathTo(hit[0], hit[1]);
  if (G.path) G.mark = { at: now(), pos: G.path[G.path.length - 1] }
});

// virtual joystick + touch buttons
const joyEl = $("#joy"), knob = $("#joy-knob");
function joyMove(t) {
  const r = joyEl.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy), max = r.width / 2;
  if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
  joy.x = dx / max; joy.y = dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
joyEl.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.changedTouches[0]; joy.on = true; joy.id = t.identifier; joyMove(t); }, { passive: false });
joyEl.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joy.id) joyMove(t); }, { passive: false });
const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ""; } };
joyEl.addEventListener("touchend", joyEnd); joyEl.addEventListener("touchcancel", joyEnd);
addEventListener("touchstart", () => { document.body.classList.add("touch"); Sound.unlock(); }, { once: true, passive: true });
addEventListener("pointerdown", () => Sound.unlock(), { once: true });

function press(btn, down, up) {
  const d = (e) => { e.preventDefault(); btn.classList.add("down"); down(); };
  const u = () => { btn.classList.remove("down"); up && up(); };
  btn.addEventListener("pointerdown", d);
  btn.addEventListener("pointerup", u); btn.addEventListener("pointerleave", u); btn.addEventListener("pointercancel", u);
}
press($("#b-atk"), () => { held.atk = true; }, () => { held.atk = false; });
for (let i = 0; i < 4; i++) press($(`#b-s${i}`), () => castSkill(i));
press($("#b-hp"), () => usePotion("hp"));
press($("#b-mp"), () => usePotion("mp"));
press($("#b-auto"), () => toggleAuto());
$("#prompt").addEventListener("click", () => interact());
$("#b-respawn").addEventListener("click", () => act({ t: "respawn" }));
$("#btn-sound").addEventListener("click", toggleSound);

/** The CRT look is on unless the player turned it off. */
function setCrt(on) {
  document.body.classList.toggle("crt", on);
  $("#btn-crt").classList.toggle("off", !on);
  localStorage.setItem("lumentale:crt", on ? "1" : "0");
}
setCrt(localStorage.getItem("lumentale:crt") !== "0");
$("#btn-crt").addEventListener("click", () => { setCrt(!document.body.classList.contains("crt")); Sound.play("ui"); });
function toggleSound() {
  const on = !(Sound.sfxOn && Sound.bgmOn);
  Sound.sfxOn = Sound.bgmOn = on;
  if (Sound.music) Sound.music.gain.value = on ? 0.32 : 0;
  $("#btn-sound").classList.toggle("off", !on);
}
function toggleAuto() {
  G.auto = !G.auto;
  $("#b-auto").classList.toggle("on", G.auto);
  toast(G.auto ? "자동사냥 시작" : "자동사냥 종료");
  Sound.play("ui");
}

// ───────────────────────────── player actions ─────────────────────────────

function solid(px, py) {
  const m = G.map;
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.o[ty][tx] !== " " || "wW".includes(m.g[ty][tx]);
}
const canStand = (x, y) => !(solid(x - 4, y - 5) || solid(x + 4, y - 5) || solid(x - 4, y) || solid(x + 4, y));

function castSkill(i) {
  const s = G.self;
  if (!s || G.me.dead) return;
  const sk = G.defs.skills[s.cls][i];
  const t = now();
  if (s.lvl < sk.lv) { toast(`[${sk.name}] 레벨 ${sk.lv}에 배웁니다`); return false; }
  if (t < G.cdEnd[i] || G.me.mp < sk.mp) { if (G.me.mp < sk.mp && !G.auto) toast("MP가 부족합니다"); return false; }
  act({ t: "sk", i });
  G.cdEnd[i] = t + sk.cd;
  G.me.atkT = t; G.me.atkN = 2; G.lastAtk = t; G.lastSkill = t;
  return true;
}
function countItem(id) {
  let n = 0;
  if (G.self) for (const s of G.self.inv) if (s.id === id) n += s.n || 1;
  return n;
}
function usePotion(kind) {
  const s = G.self, t = now();
  if (!s || G.me.dead || t < G.potAt) return;
  const [small, big] = kind === "hp" ? ["hp_s", "hp_m"] : ["mp_s", "mp_m"];
  const missing = kind === "hp" ? s.mhp - G.me.hp : s.mmp - G.me.mp;
  if (missing <= 0) return;
  const need = kind === "hp" ? G.defs.items[small].heal : G.defs.items[small].mana;
  let id = countItem(small) ? small : countItem(big) ? big : null;
  if (id === small && missing > need * 1.8 && countItem(big)) id = big;
  if (!id) { if (!G.auto) toast(kind === "hp" ? "HP 물약이 없습니다" : "MP 물약이 없습니다"); return; }
  act({ t: "use", id });
  G.potAt = t + 950;
}
function attack() {
  const t = now();
  if (t - G.lastAtk < G.self.acd) return;
  // the same count the server keeps, so the swing starts on the right foot
  G.combo = t - G.lastAtk < G.self.acd + 700 ? ((G.combo | 0) + 1) % 3 : 0;
  G.me.atkN = G.combo;
  G.lastAtk = t; G.me.atkT = t;
  G.impactAt = t + S3.impactMs(G.self.wk, G.combo);
  act({ t: "atk" });
}

function nearestNpc() {
  let best = null, bd = 40;
  for (const n of G.map.npcs) {
    const d = dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
/** Is there water close enough to cast into? */
function waterNear() {
  const m = G.map, tx = Math.floor(G.me.x / T), ty = Math.floor(G.me.y / T);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const row = m.g[ty + dy];
    if (row && row[tx + dx] === "w" && dist(G.me.x, G.me.y, (tx + dx) * T + 8, (ty + dy) * T + 8) < 34) return true;
  }
  return false;
}
const fireNear = () => { for (const f of G.fires.values()) if (dist(G.me.x, G.me.y, f.x, f.y) <= G.defs.fireR) return true; return false; };

function interact() {
  const n = G.near;
  if (G.me.dead) return;
  // a line already out is reeled in; with nobody to talk to, water is for fishing
  const bob = G.bobs.get(G.you);
  if (bob) {
    if (!bob.bite) { act({ t: "reel" }); return; }           // too early: the line comes back empty
    if (bob.hooked) return;
    bob.hooked = true;
    act({ t: "hook" });
    Mini.fishing((score) => act({ t: "reel", s: score }));
    return;
  }
  if (!n) { if (waterNear()) { act({ t: "fish" }); Sound.play("ui"); } return; }
  Sound.play("ui");
  if (n.role === "shop") { openWin("shop"); openWin("inv"); }
  else if (n.role === "smith") { openWin("smith"); openWin("inv"); }
  else if (n.role === "elder") openWin("quest");
  else if (n.role === "train") openWin("train");
  else { $("#talk-name").textContent = n.name; $("#talk-text").textContent = n.say || "…"; openWin("talk"); }
}

// ───────────────────────────── update ─────────────────────────────

let lastSend = 0, sent = { x: 0, y: 0, d: 0 };
const autoSt = { stuck: 0, side: 0, sign: 1, lastSkill: 0, target: null, routed: 0, skip: new Map() };

function update(dt, t) {
  const me = G.me, s = G.self;
  if (!G.map || !s) return;
  let [mx, my] = me.dead ? [0, 0] : moveVector();
  let wantAtk = !me.dead && !typing() && !Mini.active() && (keys.has(" ") || keys.has("j") || held.atk);

  // auto-hunt: walk at the nearest monster, hit it, drink when low
  // a route taken to get round a wall ends as soon as its monster is within reach
  if (G.auto && G.path && autoSt.routed) {
    const m = G.mobs.get(autoSt.routed);
    if (!m || dist(me.x, me.y, m.x, m.y) < s.range * 0.8) { G.path = null; autoSt.routed = 0; }
  }
  if (G.auto && !me.dead && mx === 0 && my === 0 && !G.path && !G.map.safe) {
    let best = null, bd = 1e9;
    for (const m of G.mobs.values()) { if ((autoSt.skip.get(m.id) || 0) > t) continue; const d = dist(me.x, me.y, m.x, m.y); if (d < bd) { bd = d; best = m; } }
    autoSt.target = best;
    if (best) {
      const range = s.range * 0.8;
      if (bd > range) {
        const ux = (best.x - me.x) / bd, uy = (best.y - me.y) / bd;
        if (autoSt.side > 0) { mx = -uy * autoSt.sign; my = ux * autoSt.sign; autoSt.side -= dt; }
        else { mx = ux; my = uy; }
      } else {
        wantAtk = true;
        if (t - autoSt.lastSkill > 500) {
          for (let i = 0; i < 4; i++) {
            const sk = G.defs.skills[s.cls][i];
            if (s.lvl >= sk.lv && t >= G.cdEnd[i] && me.mp >= sk.mp + 4) { if (castSkill(i)) { autoSt.lastSkill = t; break; } }
          }
        }
      }
    }
    if (me.hp < s.mhp * 0.45) usePotion("hp");
    if (me.mp < s.mmp * 0.25) usePotion("mp");
  }

  // walk — applied immediately, checked by the server afterwards
  const speed = s.spd * (t < G.buffEnd[1] ? 1.4 : 1) * (t < (G.buffEnd[4] || 0) ? G.defs.slow || 0.65 : 1);    // hasted, or slowed by frost
  const ox = me.x, oy = me.y;
  if (mx || my) {
    const nx = me.x + mx * speed * dt, ny = me.y + my * speed * dt;
    if (canStand(nx, me.y)) me.x = nx;
    if (canStand(me.x, ny)) me.y = ny;
    if (t - me.atkT > 250) me.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : my < 0 ? 3 : 0;
  }
  const moved = dist(ox, oy, me.x, me.y);
  me.moving = moved > 0.01;
  if (me.moving) me.walk += dt * 6;
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
  if (t - lastSend > 90 && (Math.abs(me.x - sent.x) > 0.3 || Math.abs(me.y - sent.y) > 0.3 || me.dir !== sent.d)) {
    lastSend = t;
    sent = { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, d: me.dir };
    act({ t: "mv", x: sent.x, y: sent.y, d: sent.d });
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
  if (near !== G.near) {
    G.near = near;
    const p = $("#prompt");
    p.hidden = !near;
    if (near) { p.textContent = ""; p.append(el("b", "", document.body.classList.contains("touch") ? "▶ " : "F  "), near.name); }
    else { closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train"); }
  }
}

// ───────────────────────────── render ─────────────────────────────
// The world is drawn by the 3D scene; names, numbers and speech are drawn over
// it on a 2D canvas, each pinned to its point in the world.

function render(t, dt) {
  if (!G.map) return;
  S3.sync(G, dt, t);
  S3.render(G.me.x, G.me.y, dt, t, G.snapCam);
  G.snapCam = false;
  renderText(t);
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

  if (G.path && G.mark) {
    const [x, y] = at(G.mark.pos[0], G.mark.pos[1], 0.02), k = ((t - G.mark.at) / 500) % 1;
    tg.strokeStyle = `rgba(250,236,190,${1 - k * 0.7})`; tg.lineWidth = 2 * dpr;
    tg.beginPath(); tg.ellipse(x * dpr, y * dpr, (8 + k * 10) * dpr, (4 + k * 5) * dpr, 0, 0, Math.PI * 2); tg.stroke();
  }
  for (const p of m.portals) {
    if (p !== m.portals.find((q) => q.to === p.to)) continue;
    const [x, y] = at(p.x * T + 8, p.y * T + 8, 2.1);
    label(`▸ ${p.to}`, x, y, "#e0c8ff");
  }
  for (const n of m.npcs) {
    const [x, y] = at(n.x * T + 8, n.y * T + 12, 1.55);
    label(n.name, x, y, "#f0d48a");
    if (n.role === "elder" && G.self) {
      const q = G.self.q, quest = G.defs.quests[q.i];
      const mark = !quest ? "" : q.st === 0 ? "!" : q.n >= quest.n ? "?" : "";
      if (mark) label(mark, x, y - 18 + Math.sin(t / 200) * 3, mark === "!" ? "#ffd84a" : "#8cff8c", 18);
    }
  }
  for (const mob of G.mobs.values()) {
    const d = G.defs.mobs[mob.k], max = mobMax(mob);
    if (!(d.boss || mob.el || mob.hp < max)) continue;
    const [x, y] = at(mob.x, mob.y, (mob.h3 || 1) + 0.28);
    // in a dungeon the rank-2 monster is its guardian; out in the open it is the field boss
    // an elite wears its traits: named in its title, and stamped as glyphs above it
    const tr = mob.tr || [], traits = G.defs.traits || {};
    const tn = tr.length && traits[tr[0]] ? `${traits[tr[0]][0]} ` : "";
    if (tr.length) {
      tg.imageSmoothingEnabled = false;
      tr.forEach((k, i) => { const tk = TRAIT[k]; if (tk) tg.drawImage(icon(tk[0], tk[1]), Math.round(x - tr.length * 9 + i * 18 + 1), Math.round(y - 29), 16, 16); });
    }
    label(`Lv.${d.lv} ${mob.el === 2 && G.map.theme ? "수문장 " : RANK_NAME[mob.el | 0]}${tn}${d.name}`, x, y, d.boss ? "#ff9ae0" : mob.el === 2 ? "#ff8a4a" : mob.el ? "#ffbe3c" : "#ece0e0");
    if (mob.hp < max) bar(x, y + 4, d.boss ? 90 : mob.el === 2 ? 70 : 42, mob.hp / max, mob.el === 2 ? "#ff8a4a" : mob.el ? "#ffbe3c" : "#d8404c");
  }
  for (const d of G.drops.values()) {
    if (!d.q) continue;
    const [x, y] = at(d.x, d.y, 0.6);
    label(G.defs.items[d.it].name, x, y, Art.RARITY_COL[d.q]);
  }
  const mine = G.who.get(G.you);
  for (const [eid, p] of G.players) {
    const w = G.who.get(eid);
    if (!w) continue;
    const [x, y] = at(p.x, p.y, (p.h3 || 1.32) + 0.22);
    label(`Lv.${w.lvl} ${w.name}`, x, y, p.dead ? "#9a9aa8" : w.party && w.party === myParty ? "#8cff8c" : "#dce6f2");
    if (w.guild) label(`‹${w.guild}›`, x, y - 13, mine && w.guild === mine.guild ? "#9af0ae" : "#c8b8e8", 11);
    if (p.hp < p.mhp && !p.dead) bar(x, y + 4, 40, p.hp / p.mhp, "#58c070");
  }
  if (mine) { const [x, y] = at(me.x, me.y, (me.h3 || 1.32) + 0.22); label(`Lv.${mine.lvl} ${mine.name}`, x, y, "#f4e4b0"); if (mine.guild) label(`‹${mine.guild}›`, x, y - 13, "#9af0ae", 11); }
  for (const b of G.bobs.values()) if (b.bite) { const [x, y] = at(b.x, b.y, 0.9); label("!", x, y + Math.sin(t / 60) * 2, "#ffe04a", 20); }
  for (const [eid, b] of G.bubbles) {
    if (t > b.until) { G.bubbles.delete(eid); continue; }
    const p = entityPos(eid);
    if (!p) continue;
    const [x, y] = at(p.x, p.y, (p.h3 || 1.32) + 0.5);
    bubble(b, x, y - 14, t);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const f = G.texts[i];
    const k = (t - f.t0) / 900;
    if (k >= 1) { G.texts.splice(i, 1); continue; }
    tg.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    const [x, y] = at(f.x, f.y, f.h + k * 0.55);
    const pop = f.big && k < 0.15 ? -6 * Math.sin((k / 0.15) * Math.PI) : 0;
    label(f.str, x, y + pop, f.col, f.big ? 17 : 13);
  }
  tg.globalAlpha = 1;
  if (G.flash > 0) { tg.fillStyle = `rgba(255,40,60,${G.flash * 0.22})`; tg.fillRect(0, 0, text.width, text.height); }
  // the white blink of a heavy hit
  if (G.punch > 0) { tg.fillStyle = `rgba(255,255,255,${G.punch * 0.16})`; tg.fillRect(0, 0, text.width, text.height); G.punch = Math.max(0, G.punch - 0.25); }
}

let miniAt = 0;
function renderMini(t) {
  if (!mini || t - miniAt < 200) return;
  miniAt = t;
  const cv = $("#mini-cv"), g = cv.getContext("2d");
  const m = G.map;
  g.imageSmoothingEnabled = false;
  g.drawImage(mini, 0, 0);
  const k = mini.width / m.w / T;
  const dot = (x, y, col, r = 2) => { g.fillStyle = col; g.fillRect(Math.round(x * k - r / 2), Math.round(y * k - r / 2), r, r); };
  for (const p of m.portals) dot(p.x * T + 8, p.y * T + 8, "#e080ff", 3);
  for (const n of m.npcs) dot(n.x * T + 8, n.y * T + 8, "#ffd84a", 3);
  for (const mob of G.mobs.values()) dot(mob.x, mob.y, mob.el ? "#ffbe3c" : "#ff5050");
  for (const p of G.players.values()) dot(p.x, p.y, "#7ad8ff", 3);
  dot(G.me.x, G.me.y, Math.floor(t / 300) % 2 ? "#ffffff" : "#08090c", 3);
  $("#mini-info").textContent = `${channelName()} · ${G.who.size}명`;
}

// ───────────────────────────── HUD & windows ─────────────────────────────

const WIN = ["inv", "char", "shop", "smith", "quest", "rank", "talk", "help", "train", "party", "guild"];
const isOpen = (id) => !$(`#w-${id}`).hidden;
function openWin(id) {
  $(`#w-${id}`).hidden = false;
  if (id === "rank") { $("#rank-list").textContent = "불러오는 중…"; act({ t: "rank" }); }
  if (id === "party") renderParty();
  if (id === "guild") { act({ t: "glist" }); renderGuild(); }
  refreshUi();
}
function closeWin(id) { $(`#w-${id}`).hidden = true; }
function toggleWin(id) { Sound.play("ui"); isOpen(id) ? closeWin(id) : openWin(id); }
function closeAll() { for (const id of WIN) closeWin(id); }
for (const b of $$("#menu button[data-win]")) b.addEventListener("click", () => toggleWin(b.dataset.win));
for (const b of $$(".window .x")) b.addEventListener("click", () => { b.closest(".window").hidden = true; });

function toast(m) {
  const box = $("#toasts");
  const p = el("p", "", m);
  box.append(p);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => p.remove(), 3300);
}
function banner(str, small) {
  const b = $("#banner");
  b.hidden = true;
  void b.offsetWidth; // restart the animation
  b.textContent = str;
  b.style.fontSize = small ? "22px" : "";
  b.hidden = false;
}
function addChat(m, cls, name) {
  const log = $("#chat-log");
  const p = el("p", cls || "");
  if (name) p.append(el("span", "who", `${name}: `));
  if (typeof m === "string") {
    for (const seg of Emo.parse(m)) {
      if (seg.e === undefined) { p.append(seg.s); continue; }
      const im = el("img", "emo"); im.alt = Emo.token(seg.e); im.src = Emo.emoUrl(seg.e); p.append(im);
    }
  } else p.append(m);
  log.append(p);
  while (log.children.length > 40) log.firstChild.remove();
  return p;
}
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-in");
  const m = input.value.trim();
  const g = /^\/(g|길드|ㅎ)\s+(.+)/.exec(m);
  if (g) act({ t: "gchat", m: g[2] });
  else if (m) act({ t: "chat", m });
  input.value = "";
  input.blur();
});
$("#chat-log").addEventListener("click", () => {
  if (!document.body.classList.contains("touch")) return;
  const m = prompt("채팅");
  if (m && m.trim()) act({ t: "chat", m: m.trim().slice(0, 80) });
});

function hudBars() {
  const s = G.self, me = G.me;
  if (!s) return;
  $("#st-hp").style.width = `${clamp((me.hp / s.mhp) * 100, 0, 100)}%`;
  $("#st-mp").style.width = `${clamp((me.mp / s.mmp) * 100, 0, 100)}%`;
  $("#st-hpt").textContent = `${me.hp} / ${s.mhp}`;
  $("#st-mpt").textContent = `${me.mp} / ${s.mmp}`;
}

function itemSlot(entry, onClick, selected) {
  const d = el("div", "slot");
  if (!entry) return d;
  const it = G.defs.items[entry.id];
  if (entry.q) d.classList.add(`q${entry.q}`);
  if (entry.sk) { const pips = el("span", "sk"); for (let i = 0; i < entry.sk; i++) pips.append(el("i", entry.ru && entry.ru[i] ? "on" : "")); d.append(pips); }
  if (selected) d.classList.add("sel");
  const img = el("img");
  img.src = G.icons.url[entry.id];
  img.alt = it.name;
  d.append(img);
  if (entry.n > 1) d.append(el("span", "n", entry.n));
  if (entry.enh > 0) d.append(el("span", "e", `+${entry.enh}`));
  if (onClick) d.addEventListener("click", onClick);
  return d;
}
/** The glyph beside each line of the character sheet. */
const STAT_GLYPH = { "공격력": "sword", "방어력": "shield", "최대 HP": "heart", "최대 MP": "drop", "치명타": "target", "치명 피해": "burst", "흡혈": "fang", "경험치 추가": "up", "아이템 발견": "gem", "골드 획득": "coin", "공격 간격": "clock", "처치 수": "skull", "수련 · 힘": "sword", "수련 · 체력": "heart", "수련 · 지력": "drop", "수련 · 수호": "shield" };
const GEAR = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"];
const TYPE_NAME = { weapon: "무기", helm: "투구", armor: "갑옷", gloves: "장갑", boots: "신발", ring: "반지", amulet: "목걸이" };
const SLOT_NAME = { weapon: "무기", helm: "투구", armor: "갑옷", gloves: "장갑", boots: "신발", ring1: "반지 1", ring2: "반지 2", amulet: "목걸이" };
const isGear = (id) => GEAR.includes(G.defs.items[id].type);
const slotsFor = (type) => (type === "ring" ? ["ring1", "ring2"] : [type]);
function runewordOf(g) {
  if (!g.sk || !g.ru || g.ru.length !== g.sk) return null;
  return G.defs.runewords.find((rw) => rw.seq.length === g.sk && rw.seq.every((r, i) => g.ru[i] === r)) || null;
}
/** "공격력 +12", "치명타 +3%" — one stat in words. */
function statText(k, v) {
  const label = G.defs.affix[k][0];
  return `${label.replace(" %", "")} +${v}${label.includes("%") ? "%" : ""}`;
}
/** "+3 뇌명의 강철 양손검" — a legendary's power, a set's name, or the first affix lends the prefix. */
function itemName(entry) {
  const it = G.defs.items[entry.id];
  const word = entry.lg ? G.defs.legend[entry.lg][0] : entry.set ? G.defs.sets[entry.set].name : entry.af && entry.af.length ? G.defs.affix[entry.af[0][0]][1] : "";
  return (entry.enh > 0 ? `+${entry.enh} ` : "") + (word ? word + " " : "") + it.name;
}
function itemDesc(entry) {
  const it = G.defs.items[entry.id];
  const e = entry.enh || 0;
  if (it.base) {
    const base = Object.keys(it.base).map((k) => statText(k, k === "spd" || k === "crit" ? it.base[k] : Math.round(it.base[k] * (1 + 0.1 * e))));
    if (it.cls) base.push(`${G.defs.wkinds[it.wk].name} · ${G.defs.classes[it.cls].name} 전용`);
    base.push(`Lv.${it.req}`);
    return base.join(" · ");
  }
  if (it.type === "rune") { const r = G.defs.runes[it.rune]; return `${statText(r[1], r[2])} — 장착한 장비의 홈에 끼웁니다.`; }
  return it.desc || "";
}
/** How many pieces of a set are being worn right now. */
function setWorn(id) {
  let n = 0;
  if (G.self) for (const k of G.defs.slots) if (G.self.eq[k] && G.self.eq[k].set === id) n++;
  return n;
}
/** The full tooltip: base line, rolled affixes, legendary power, set bonuses, sockets, runeword. */
function describe(entry, host) {
  const it = G.defs.items[entry.id];
  const nm = el("div", "nm", itemName(entry));
  nm.style.color = Art.RARITY_COL[entry.q || 0];
  host.append(nm);
  if (isGear(entry.id)) host.append(el("div", "rar", `${G.defs.rarity[entry.q || 0]} ${TYPE_NAME[it.type]}`));
  host.append(el("div", "ds", itemDesc(entry)));
  for (const [k, v] of entry.af || []) host.append(el("div", "af", statText(k, v)));
  if (entry.lg) host.append(el("div", "lg", `◆ ${G.defs.legend[entry.lg][1]}`));
  if (entry.set) {
    const set = G.defs.sets[entry.set], worn = setWorn(entry.set);
    host.append(el("div", "st", `${set.name} 세트 (${worn}개 착용)`));
    for (const [n, list] of set.bonus) host.append(el("div", worn >= n ? "st on" : "st off", `${n}세트: ${list.map(([k, v]) => statText(k, v)).join(", ")}`));
  }
  if (entry.sk) {
    const names = [];
    for (let i = 0; i < entry.sk; i++) { const r = entry.ru && entry.ru[i]; names.push(r ? G.defs.runes[r][0] : "빈 홈"); }
    host.append(el("div", "so", `홈 ${entry.sk}개 [ ${names.join(" · ")} ]`));
    for (const r of entry.ru || []) if (r) host.append(el("div", "af", statText(G.defs.runes[r][1], G.defs.runes[r][2])));
    const rw = runewordOf(entry);
    if (rw) host.append(el("div", "rw", `룬어 「${rw.name}」 ${rw.add.map(([k, v]) => statText(k, v)).join(", ")}`));
  }
}
function sellPrice(entry) {
  const it = G.defs.items[entry.id];
  if (!isGear(entry.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.25 * (1 + 0.8 * (entry.q || 0)) * (1 + 0.3 * (entry.enh || 0)));
}

function refreshUi() {
  const s = G.self;
  if (!s) return;
  const it = G.defs.items;
  $("#st-name").textContent = s.name;
  $("#st-lv").textContent = `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`;
  const maxed = s.lvl >= G.defs.maxLv;
  $("#exp-fill").style.width = maxed ? "100%" : `${Math.min(100, (s.xp / s.need) * 100)}%`;
  $("#exp-text").textContent = maxed ? `수련 경험치 ${s.xp.toLocaleString()}` : `EXP ${s.xp.toLocaleString()} / ${s.need.toLocaleString()} (${((s.xp / s.need) * 100).toFixed(1)}%)`;
  hudBars();

  // quick slots
  for (const [btn, ids] of [["#b-hp", ["hp_s", "hp_m"]], ["#b-mp", ["mp_s", "mp_m"]]]) {
    const n = countItem(ids[0]) + countItem(ids[1]);
    $(`${btn} img`).src = G.icons.url[countItem(ids[0]) || !countItem(ids[1]) ? ids[0] : ids[1]];
    $(`${btn} .n`).textContent = n;
    $(btn).style.opacity = n ? 1 : 0.45;
  }
  G.defs.skills[s.cls].forEach((sk, i) => {
    const b = $(`#b-s${i}`);
    b.querySelector(".nm").textContent = sk.name;
    let ic = b.querySelector("img.ic");
    if (!ic) { ic = el("img", "ic"); ic.alt = ""; b.prepend(ic); }
    if (ic.dataset.id !== sk.id) { ic.dataset.id = sk.id; ic.src = skillIconUrl(sk.id); }
    b.classList.toggle("locked", s.lvl < sk.lv);
    b.title = `${sk.name} (MP ${sk.mp}) — ${sk.desc}`;
  });

  // quest tracker
  const qt = $("#quest-track");
  qt.textContent = "";
  const quest = G.defs.quests[s.q.i];
  if (quest && s.q.st === 1) {
    const done = s.q.n >= quest.n;
    qt.append(el("b", "", `[의뢰] ${quest.title}`), el("br"), el("span", done ? "done" : "", done ? "완료! 관리자에게 돌아가세요" : `${G.defs.mobs[quest.mob].name} ${s.q.n} / ${quest.n}`));
  } else if (quest) {
    qt.append(el("b", "", "[의뢰]"), " 관리자 엘더윈에게 새 의뢰가 있습니다");
  }
  if (s.bq) {
    const done = s.bq.n >= s.bq.need;
    qt.append(el("br"), el("b", "", "[반복] "), el("span", done ? "done" : "", done ? "완료! 관리자에게 보고하세요" : `${G.defs.mobs[s.bq.k].name} ${s.bq.n} / ${s.bq.need}`));
  }

  if (isOpen("inv")) {
    $("#inv-gold").textContent = s.gold.toLocaleString();
    const grid = $("#inv-grid");
    grid.textContent = "";
    if (G.sel >= s.inv.length) G.sel = -1;
    for (let i = 0; i < G.defs.inv; i++) {
      grid.append(itemSlot(s.inv[i], () => { G.sel = G.sel === i ? -1 : i; Sound.play("ui"); refreshUi(); }, i === G.sel));
    }
    const det = $("#inv-detail");
    det.textContent = "";
    const entry = s.inv[G.sel];
    if (!entry) det.append(el("div", "ds", "아이템을 고르면 설명이 나옵니다."));
    else {
      const d = it[entry.id];
      describe(entry, det);
      const btns = el("div", "btns");
      const add = (label, fn, off) => { const b = el("button", "", label); b.disabled = !!off; b.addEventListener("click", fn); btns.append(b); };
      if (d.type === "pot") add("사용", () => act({ t: "use", id: entry.id }));
      if (d.type === "food") add("먹기", () => act({ t: "use", id: entry.id }));
      if (d.type === "camp") add("모닥불 피우기", () => { act({ t: "use", id: entry.id }); closeWin("inv"); });
      if (d.type === "fish") {
        add("굽기", () => { const id = entry.id; closeWin("inv"); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id, s: score })); }, !fireNear());
        if (!fireNear()) btns.append(el("span", "ds", " 모닥불 곁에서 구울 수 있습니다"));
      }
      if (isGear(entry.id)) {
        const off = (d.cls && d.cls !== s.cls) || s.lvl < d.req;
        if (d.type === "ring" && s.eq.ring1 && s.eq.ring2) {
          for (const k of ["ring1", "ring2"]) add(`${SLOT_NAME[k]}에 장착`, () => { act({ t: "eq", s: G.sel, k }); G.sel = -1; }, off);
        } else add("장착", () => { act({ t: "eq", s: G.sel }); G.sel = -1; }, off);
        if (isOpen("smith")) add("분해", () => { act({ t: "salv", s: G.sel }); G.sel = -1; });
      }
      if (d.type === "rune") {
        let any = false;
        for (const k of G.defs.slots) {
          const g = s.eq[k];
          for (let i = 0; g && i < g.sk; i++) {
            any = true;
            const cur = g.ru && g.ru[i];
            add(`${SLOT_NAME[k]} 홈 ${i + 1}${cur ? ` (${G.defs.runes[cur][0]} 교체)` : ""}`, () => { act({ t: "rune", s: G.sel, k, i }); });
          }
        }
        if (!any) btns.append(el("span", "ds", "홈이 있는 장비를 장착해야 끼울 수 있습니다."));
      }
      if (isOpen("shop")) {
        const each = sellPrice(entry);
        add(`판매 (${each}G)`, () => act({ t: "sell", s: G.sel, n: 1 }));
        if (entry.n > 1) add(`전부 판매 (${each * entry.n}G)`, () => act({ t: "sell", s: G.sel, n: entry.n }));
      }
      det.append(btns);
      // what it would replace, for comparison
      if (isGear(entry.id)) {
        for (const k of slotsFor(d.type)) {
          if (!s.eq[k]) continue;
          det.append(el("div", "cmp", `착용 중 — ${SLOT_NAME[k]}`));
          describe(s.eq[k], det);
        }
      }
    }
  }

  if (isOpen("char")) {
    $("#char-title").textContent = `${s.name} · Lv.${s.lvl} ${G.defs.classes[s.cls].name}`;
    for (const k of G.defs.slots) {
      const host = $(`#eq-${k}`);
      const slot = itemSlot(s.eq[k], s.eq[k] ? () => act({ t: "uneq", k }) : null);
      slot.id = `eq-${k}`;
      slot.title = s.eq[k] ? `${itemName(s.eq[k])} (눌러서 해제)` : `${SLOT_NAME[k]} 없음`;
      if (!s.eq[k]) slot.append(el("span", "ph", SLOT_NAME[k]));
      host.replaceWith(slot);
    }
    const st = $("#char-stats");
    st.textContent = "";
    for (const [k, v] of [["공격력", s.atk], ["방어력", s.def], ["최대 HP", s.mhp], ["최대 MP", s.mmp], ["치명타", `${s.crit}%`], ["치명 피해", `${s.critd}%`], ["흡혈", `${s.ls}%`], ["경험치 추가", `${s.xpb}%`], ["아이템 발견", `${s.mf}%`], ["골드 획득", `+${s.goldb}%`], ["공격 간격", `${(s.acd / 1000).toFixed(2)}초`], ["처치 수", s.kills],
      ["수련 · 힘", s.tr.str], ["수련 · 체력", s.tr.vit], ["수련 · 지력", s.tr.int], ["수련 · 수호", s.tr.grd]]) {
      const sp = el("span", "", k);
      sp.prepend(iconImg(STAT_GLYPH[k] || "up"));
      sp.append(el("b", "", v));
      st.append(sp);
    }
    const pw = $("#char-sets");
    pw.textContent = "";
    for (const k of s.lg) pw.append(el("div", "lg", `◆ ${G.defs.legend[k][0].replace(/의$/, "")} — ${G.defs.legend[k][1]}`));
    for (const id of Object.keys(G.defs.sets)) {
      const worn = setWorn(id);
      if (!worn) continue;
      const set = G.defs.sets[id];
      pw.append(el("div", "st", `${set.name} 세트 ${worn}개`));
      for (const [n, list] of set.bonus) pw.append(el("div", worn >= n ? "st on" : "st off", `${n}세트: ${list.map(([a, v]) => statText(a, v)).join(", ")}`));
    }
    const sk = $("#char-skills");
    sk.textContent = "";
    for (const d of G.defs.skills[s.cls]) {
      const p = el("p", s.lvl < d.lv ? "locked" : "");
      const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(d.id);
      p.append(ic, el("b", "", `${d.name} `), `Lv.${d.lv} · MP ${d.mp} · ${d.cd / 1000}초 — ${d.desc}`);
      sk.append(p);
    }
  }

  if (isOpen("shop")) {
    const list = $("#shop-list");
    list.textContent = "";
    for (const key of G.defs.shop) {
      const id = key[0] === "W" && key.length === 2 ? `w_${s.cls}_${key[1]}` : key;
      const d = it[id];
      if (d.cls && d.cls !== s.cls) continue;
      const row = el("div", "it");
      const img = el("img"); img.src = G.icons.url[id]; img.alt = "";
      const tx = el("div", "tx", d.name);
      tx.append(el("small", "", `${d.price}G · ${itemDesc({ id })}`));
      row.append(img, tx);
      const buy = (n) => { const b = el("button", "", n > 1 ? `×${n}` : "구매"); b.disabled = s.gold < d.price * n; b.addEventListener("click", () => act({ t: "buy", id: key, n })); row.append(b); };
      buy(1);
      if (d.type === "pot") buy(10);
      list.append(row);
    }
  }

  if (isOpen("smith")) {
    const list = $("#smith-list");
    list.textContent = "";
    const stones = countItem("stone");
    for (const k of G.defs.slots) {
      const g = s.eq[k];
      if (!g || !s.enh[k]) continue;
      const row = el("div", "it");
      const d = it[g.id];
      const img = el("img"); img.src = G.icons.url[g.id]; img.alt = "";
      const tx = el("div", "tx", itemName(g));
      tx.style.color = Art.RARITY_COL[g.q || 0];
      row.append(img, tx);
      if (g.enh >= 10) tx.append(el("small", "", "최대 강화 단계입니다"));
      else {
        const c = s.enh[k];
        tx.append(el("small", "", `성공률 ${G.defs.enh[g.enh]}% · ${c.gold}G · 강화석 ${c.stone}개 (보유 ${stones})`));
        const b = el("button", "", "강화");
        b.disabled = s.gold < c.gold || stones < c.stone;
        b.addEventListener("click", () => act({ t: "enh", k }));
        row.append(b);
      }
      list.append(row);
    }
  }

  if (isOpen("train")) {
    const list = $("#train-list");
    list.textContent = "";
    $("#train-xp").textContent = `보유 경험치 ${s.xp.toLocaleString()}`;
    for (const k of Object.keys(G.defs.train)) {
      const d = G.defs.train[k];
      const row = el("div", "it");
      const tx = el("div", "tx", `${d.name}  ${s.tr[k]}`);
      tx.append(el("small", "", `${d.desc} · 1회 ${s.trc[k][0].toLocaleString()} EXP`));
      row.append(tx);
      for (const [n, cost] of [[1, s.trc[k][0]], [10, s.trc[k][1]]]) {
        const b = el("button", "", `+${n}`);
        b.disabled = s.xp < cost;
        b.title = `${cost.toLocaleString()} EXP`;
        b.addEventListener("click", () => act({ t: "train", k, n }));
        row.append(b);
      }
      list.append(row);
    }
  }

  if (isOpen("quest")) {
    const body = $("#quest-body");
    body.textContent = "";
    const atElder = G.near && G.near.role === "elder";
    if (!quest) body.append(el("p", "say", "심연의 어미까지 쓰러뜨리다니… 자네 덕분에 균열이 잠잠해졌네. 모든 의뢰를 완료했다네! 이제 반복 의뢰와 수문장 사냥으로 더 강한 장비를 노려 보게."));
    else {
      body.append(el("div", "q-title", `${s.q.i + 1}. ${quest.title}`), el("p", "say", quest.text));
      const mob = G.defs.mobs[quest.mob];
      body.append(el("div", "", `목표: Lv.${mob.lv} ${mob.name} ${s.q.st === 1 ? `${Math.min(s.q.n, quest.n)} / ` : ""}${quest.n}마리`));
      body.append(el("div", "q-reward", `보상: EXP ${quest.xp} · ${quest.gold}G · ${quest.items.map(([id, n]) => `${it[id].name} ×${n}`).join(", ")}`));
      const btns = el("div", "btns");
      const b = el("button");
      if (s.q.st === 0) { b.textContent = "의뢰 수락"; b.addEventListener("click", () => { act({ t: "quest", a: "accept" }); Sound.play("ok"); }); }
      else { b.textContent = "의뢰 완료"; b.disabled = s.q.n < quest.n; b.addEventListener("click", () => { act({ t: "quest", a: "done" }); Sound.play("ok"); }); }
      if (!atElder) { b.disabled = true; btns.append(b, el("span", "ds", " 관리자 엘더윈 근처에서만 가능합니다")); }
      else btns.append(b);
      body.append(btns);
    }

    // a bounty that starts over each time it is paid out
    const mobs = G.defs.mobs;
    body.append(el("div", "q-title sub", "반복 의뢰"));
    body.append(el("p", "ds", `같은 몬스터 ${G.defs.bounty}마리를 잡을 때마다 보상을 받고, 곧바로 다시 시작됩니다. (완료 ${s.bn}회 — 3회마다 강화석, 10회마다 룬)`));
    const bl = el("div", "list");
    body.append(bl);
    if (s.bq) {
      const d = mobs[s.bq.k], done = s.bq.n >= s.bq.need;
      const row = el("div", "it");
      const tx = el("div", "tx", `Lv.${d.lv} ${d.name}  ${Math.min(s.bq.n, s.bq.need)} / ${s.bq.need}`);
      tx.append(el("small", "", `보상: EXP ${Math.round(d.xp * s.bq.need * 0.5).toLocaleString()} + 골드`));
      const b = el("button", "", "보고");
      b.disabled = !done || !atElder;
      b.addEventListener("click", () => { act({ t: "bq", a: "done" }); Sound.play("ok"); });
      row.append(tx, b);
      bl.append(row);
    }
    const picks = Object.keys(mobs).filter((k) => !mobs[k].boss && !mobs[k].chest && mobs[k].lv <= s.lvl + 4 && (!s.bq || s.bq.k !== k)).sort((a, b) => mobs[b].lv - mobs[a].lv).slice(0, 4);
    for (const k of picks) {
      const d = mobs[k];
      const row = el("div", "it");
      const tx = el("div", "tx", `Lv.${d.lv} ${d.name}`);
      tx.append(el("small", "", `EXP ${Math.round(d.xp * G.defs.bounty * 0.5).toLocaleString()} + 골드`));
      const b = el("button", "", s.bq ? "바꾸기" : "받기");
      b.disabled = !atElder;
      b.addEventListener("click", () => { act({ t: "bq", a: "take", k }); Sound.play("ok"); });
      row.append(tx, b);
      bl.append(row);
    }

    // mastery: every kind of monster keeps its own count
    body.append(el("div", "q-title sub", "토벌 숙련"));
    body.append(el("p", "ds", "같은 몬스터를 많이 잡을수록 그 몬스터에게 주는 피해(단계당 +3%)와 얻는 경험치(+2%)가 늘어납니다."));
    const steps = G.defs.mastery;
    const known = Object.keys(mobs).filter((k) => s.mk[k] && !mobs[k].chest).sort((a, b) => mobs[a].lv - mobs[b].lv);
    if (!known.length) body.append(el("p", "ds", "아직 기록이 없습니다."));
    for (const k of known) {
      const n = s.mk[k];
      let r = 0;
      while (r < steps.length && n >= steps[r]) r++;
      const row = el("div", "mk");
      row.append(el("span", "", mobs[k].name), el("b", "", "★".repeat(r) + "☆".repeat(steps.length - r)), el("small", "", r < steps.length ? `${n.toLocaleString()} / ${steps[r].toLocaleString()}` : `${n.toLocaleString()} · 최고 단계`));
      body.append(row);
    }
  }
}

// ── party ──
function renderPartyHud() {
  const box = $("#party-hud");
  box.textContent = "";
  for (const [eid, name, cls, lvl, hp, mhp, where] of G.party) {
    if (eid === G.you) continue;
    const row = el("div", "pm");
    row.append(el("span", "", `Lv.${lvl} ${name}${where ? ` · ${where}` : ""}`));
    const bar = el("div", "bar hp"), fill = el("i");
    fill.style.width = `${clamp((hp / mhp) * 100, 0, 100)}%`;
    bar.append(fill);
    row.append(bar);
    box.append(row);
  }
}
function renderParty() {
  const box = $("#party-body");
  box.textContent = "";
  const mine = G.party.length > 0;
  box.append(el("p", "say", mine ? `파티원 ${G.party.length} / ${G.defs.partyMax} — 함께 잡으면 모두가 경험치와 전리품을 얻고, 인원이 많을수록 총 경험치가 늘어납니다.` : "파티에 속해 있지 않습니다. 주변의 모험가를 초대해 보세요. 강한 적과 정예 몬스터는 파티로 잡는 것이 훨씬 빠릅니다."));
  const list = el("div", "list");
  for (const [eid, name, cls, lvl, hp, mhp, where] of G.party) {
    const row = el("div", "rk" + (eid === G.you ? " me" : ""));
    row.append(el("b", "", name), el("span", "", `Lv.${lvl} ${G.defs.classes[cls].name}${where ? ` · ${where}` : ` · HP ${hp}/${mhp}`}`));
    list.append(row);
  }
  const inParty = new Set(G.party.map((m) => m[0]));
  const myParty = G.who.get(G.you)?.party;
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || inParty.has(eid)) continue;
    near++;
    const row = el("div", "it");
    row.append(el("div", "tx", `Lv.${w.lvl} ${w.name} · ${G.defs.classes[w.cls].name}`));
    const b = el("button", "", w.party ? "다른 파티" : "초대");
    b.disabled = !!w.party || G.party.length >= G.defs.partyMax;
    b.addEventListener("click", () => { act({ t: "pinv", e: eid }); Sound.play("ui"); });
    row.append(b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  if (mine || myParty) {
    const btns = el("div", "btns");
    const b = el("button", "", "파티 탈퇴");
    b.addEventListener("click", () => act({ t: "pleave" }));
    btns.append(b);
    box.append(btns);
  }
}
function renderInvite() {
  const box = $("#invite");
  box.hidden = !G.pinv && !G.ginv;
  if (box.hidden) return;
  if (G.pinv) $("#invite-text").textContent = `${G.pinv}님이 파티에 초대했습니다.`;
  else { const [from, g] = G.ginv.split("|"); $("#invite-text").textContent = `${from}님이 길드 ‹${g}›에 초대했습니다.`; }
  Sound.play("ok");
}
$("#invite-yes").addEventListener("click", () => act({ t: G.pinv ? "pacc" : "gacc" }));
$("#invite-no").addEventListener("click", () => act({ t: G.pinv ? "pdec" : "gdec" }));

// ── guild ──
function renderGuild() {
  const box = $("#guild-body"), s = G.self;
  if (!s) return;
  box.textContent = "";
  if (!s.guild) {
    box.append(el("p", "say", `길드를 세우면 이름 위에 길드명이 걸리고, 길드원끼리만 보이는 채팅(/g 메시지)을 쓸 수 있습니다. 같은 길드원 곁에서 사냥하면 한 명당 경험치 +${Math.round(G.defs.guildXp * 100)}% (최대 3명).`));
    const row = el("div", "btns");
    const input = el("input"); input.maxLength = 10; input.placeholder = "길드 이름 (2~10자)"; input.autocomplete = "off";
    const b = el("button", "", `창설 (${G.defs.guildCost.toLocaleString()}G)`);
    b.disabled = s.gold < G.defs.guildCost;
    b.addEventListener("click", () => { if (input.value.trim()) act({ t: "gcreate", name: input.value.trim() }); Sound.play("ui"); });
    row.append(input, b);
    box.append(row, el("p", "ds", "다른 길드에 들어가려면 그 길드원에게 초대를 받으세요."));
    return;
  }
  box.append(el("div", "q-title", `‹${s.guild}›`), el("p", "ds", `이 채널에 접속 중인 길드원 ${s.gmates.length}명 · 길드 채팅은 채팅창에 /g 메시지`));
  const list = el("div", "list");
  for (const [eid, name, cls, lvl, where, gm] of s.gmates) {
    const row = el("div", "rk" + (eid === G.you ? " me" : ""));
    row.append(el("b", "", `${gm ? "★ " : ""}${name}`), el("span", "", `Lv.${lvl} ${G.defs.classes[cls].name} · ${where}`));
    list.append(row);
  }
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || w.guild) continue;
    near++;
    const row = el("div", "it");
    row.append(el("div", "tx", `Lv.${w.lvl} ${w.name} · ${G.defs.classes[w.cls].name}`));
    const b = el("button", "", "초대");
    b.addEventListener("click", () => { act({ t: "ginv", e: eid }); Sound.play("ui"); });
    row.append(b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  const btns = el("div", "btns");
  const b = el("button", "", "길드 탈퇴");
  b.addEventListener("click", () => act({ t: "gleave" }));
  btns.append(b);
  box.append(btns);
}
for (let i = 0; i < Emo.COUNT; i++) {
  const b = el("button");
  b.title = Emo.token(i);
  const im = el("img"); im.alt = Emo.token(i); im.src = Emo.emoUrl(i); b.append(im);
  b.addEventListener("click", () => {
    const box = $("#emotes");
    if (box.dataset.mode === "chat") {
      const input = $("#chat-in");
      input.value = (input.value + Emo.token(i)).slice(0, 80);
      input.focus();
    } else act({ t: "emo", i });
    box.hidden = true;
  });
  $("#emotes").append(b);
}
/** Open the picker either to send an emote or to put an emoticon in the chat line. */
function openEmotes(mode) {
  const box = $("#emotes");
  if (!box.hidden && box.dataset.mode === mode) { box.hidden = true; return; }
  box.dataset.mode = mode;
  box.classList.toggle("at-chat", mode === "chat");
  box.hidden = false;
}
$("#chat-emo").addEventListener("pointerdown", (e) => e.preventDefault());   // keep the chat line focused
$("#chat-emo").addEventListener("click", () => openEmotes("chat"));
$("#b-sit").addEventListener("click", () => act({ t: "sit" }));
$("#b-emo").addEventListener("click", () => openEmotes("emote"));

function renderRank(list) {
  const box = $("#rank-list");
  box.textContent = "";
  if (!list.length) { box.textContent = "아직 기록이 없습니다."; return; }
  list.forEach((r, i) => {
    const row = el("div", "rk" + (G.self && r.name === G.self.name ? " me" : ""));
    row.append(el("i", "", i + 1), el("b", "", r.name), el("span", "", `Lv.${r.lvl} ${G.defs.classes[r.cls]?.name ?? ""}`));
    box.append(row);
  });
}

function hudTick(t) {
  const s = G.self;
  if (!s) return;
  G.defs.skills[s.cls].forEach((sk, i) => {
    const left = G.cdEnd[i] - t;
    $(`#b-s${i} .cd`).style.height = left > 0 ? `${clamp(left / sk.cd, 0, 1) * 100}%` : "0";
  });
  // the kill streak: counts up while kills keep coming, drains between them
  const sb = $("#streak"), k = G.streak;
  const live = k && k.n >= 2 && t < k.end;
  if (sb.hidden === live) sb.hidden = !live;
  if (live) {
    const want = `${k.n}`;
    if (sb.dataset.v !== want) {
      sb.dataset.v = want;
      $("#streak-n").textContent = `연속 처치 ${k.n}`;
      $("#streak-b").textContent = `EXP +${Math.min(G.defs.streak[1], k.n - 1) * 2}%`;
      sb.classList.remove("pop"); void sb.offsetWidth; sb.classList.add("pop");
    }
    $("#streak-bar").style.width = `${clamp((k.end - t) / G.defs.streak[0], 0, 1) * 100}%`;
  }
  const buffs = $("#st-buffs");
  // each status is its glyph and the time left; the last three are things done to you
  const names = ["공격력 증가", "이동속도 증가", `모닥불의 온기: 경험치 +${s.warm}%`, s.food ? G.defs.items[s.food].name : "음식", "둔화: 이동속도 감소", "화상: 지속 피해", "중독: 지속 피해"];
  const left = (ms) => (ms > 90000 ? `${Math.ceil(ms / 60000)}분` : `${Math.ceil(ms / 1000)}`);
  const shown = G.buffEnd.map((e, i) => (e > t ? [i, left(e - t)] : null)).filter(Boolean);
  const want = shown.map(([i, l]) => `${i}:${l}`).join("|");
  if (buffs.dataset.v !== want) {
    buffs.dataset.v = want;
    buffs.textContent = "";
    for (const [i, l] of shown) {
      const sp = el("span", i >= 4 ? "bad" : "", l);
      sp.title = names[i];
      sp.prepend(iconImg(BUFF_ICON[i], i >= 4 ? "#ff9a8a" : undefined));
      buffs.append(sp);
    }
  }
}

// ───────────────────────────── title & creation ─────────────────────────────

const CLASS_DESC = {
  warrior: "전사 · 양손검 — 파티의 방패. 대검의 궤적이 주변 적까지 베고, 전투함성으로 파티 전체의 공격력을 올립니다.",
  rogue: "도적 · 단검 — 가장 빠른 공격과 높은 치명타. 그림자 도약으로 적의 등 뒤를 잡고 연막으로 빠져나옵니다.",
  lancer: "창술사 · 창 — 긴 창으로 일직선의 적을 한꺼번에 꿰뚫습니다. 적을 밀쳐 내고 뛰어들어 전열을 휘젓습니다.",
  mage: "마도사 · 마법지팡이 / 마법책 — 지팡이는 멀리서 강한 한 발, 마법책은 빠르게 번지는 폭발. 광역 마법과 치유로 파티를 책임집니다.",
};
const draft = { cls: "warrior", look: S3.PARTS.map(() => 0) };
for (const b of $$("#c-cls button")) {
  b.addEventListener("click", () => {
    for (const o of $$("#c-cls button")) o.classList.toggle("on", o === b);
    draft.cls = b.dataset.v;
    $("#c-desc").textContent = CLASS_DESC[draft.cls];
    Sound.unlock(); Sound.play("ui");
    stageDraft();
  });
}
/** One row per part: a stepper through named shapes, or a row of colour swatches. */
function buildParts() {
  const box = $("#c-parts");
  box.textContent = "";
  S3.PARTS.forEach((p, i) => {
    const n = (p.names || p.colors).length;
    const set = (v) => { draft.look[i] = (v + n) % n; Sound.unlock(); Sound.play("ui"); buildParts(); stageDraft(); };
    const row = el("div", p.colors ? "part sw" : "part");
    row.append(el("span", "lab", p.label));
    if (p.colors) {
      const sw = el("div", "pick sw");
      p.colors.forEach((c, v) => {
        const b = el("button", (v === draft.look[i] ? "on" : "") + (c ? "" : " none"));
        if (c) b.style.background = c;
        b.addEventListener("click", () => set(v));
        sw.append(b);
      });
      row.append(sw);
    } else {
      const prev = el("button", "step", "‹"), next = el("button", "step", "›");
      prev.addEventListener("click", () => set(draft.look[i] - 1));
      next.addEventListener("click", () => set(draft.look[i] + 1));
      row.append(prev, el("b", "", p.names[draft.look[i]]), next);
    }
    box.append(row);
  });
}
$("#c-rand").addEventListener("click", () => {
  draft.look = S3.PARTS.map((p) => Math.floor(Math.random() * (p.names || p.colors).length));
  Sound.unlock(); Sound.play("ui");
  buildParts(); stageDraft();
});
buildParts();
$("#c-desc").textContent = CLASS_DESC.warrior;

for (const b of $$("#ch-pick button")) {
  b.classList.toggle("on", b.dataset.ch === channel);
  b.addEventListener("click", () => {
    channel = b.dataset.ch;
    localStorage.setItem("lumentale:ch", channel);
    for (const o of $$("#ch-pick button")) o.classList.toggle("on", o === b);
  });
}
$("#b-start").addEventListener("click", () => {
  Sound.unlock();
  Sound.play("ok");
  $("#title-msg").textContent = "서버에 연결하는 중…";
  if (ws) { wantOnline = false; try { ws.close(); } catch { /* fine */ } }
  connect();
});
$("#b-create").addEventListener("click", () => {
  const name = $("#c-name").value.trim();
  if (!/^[가-힣A-Za-z0-9]{2,10}$/.test(name)) { $("#create-msg").textContent = "이름은 한글·영문·숫자 2~10자로 지어 주세요"; return; }
  $("#create-msg").textContent = "";
  act({ t: "create", name, cls: draft.cls, look: draft.look });
});
$("#c-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#b-create").click(); });

/** The look being designed on the creation screen, shown large beside the form. */
function draftLook() { return S3.playerLook(draft.cls, draft.look.slice(), {}); }
function stageDraft() { if (!$("#create").hidden) S3.showcase(draftLook()); }

// ───────────────────────────── main loop ─────────────────────────────

let last = now();
function frame() {
  const t = now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (G.playing) {
    update(dt, t);
    render(t, dt);
    renderMini(t);
    hudTick(t);
  } else S3.renderStage(dt, t, !$("#create").hidden);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for automated play-testing
window.__game = { G, act, S3, go: (wx, wy) => { G.path = pathTo(wx, wy); return !!G.path; } };
