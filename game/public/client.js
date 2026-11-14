/**
 * 테일즈테일즈 (Tales Tales) — the browser side.
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
import { icon, iconImg, iconUrl, MENU_ICON, CLASS_ICON, BUFF_ICON, TRAIT } from "./uiicons.js";
import * as SP from "./sprites.js";
import * as MobArt from "./mobart.js";
import * as Emo from "./emoticons.js";
import * as Growth from "./growth.js";
import * as Wardrobe from "./wardrobe_ui.js";
import { entryIconUrl } from "./weapons.js";
import * as Looks from "./looks.js";
import * as QS from "./quickslots.js";
import * as NpcTalk from "./npctalk.js";
import * as SkillFx from "./skillfx.js";
import { drawClassGauge, gaugeTip } from "./classgauge.js";
import { installFrames } from "./frames.js";
import * as Lobby from "./lobby.js";
import * as Assets from "./assetlib.js";

// approved external images (public/assets/manifest.json) before anything is drawn; an
// empty or missing manifest leaves every look code-drawn
await Assets.ready();
installFrames();

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
// (our own Cloudflare deploy on *.workers.dev serves itself too — keep in step with account.js)
const HOST = local || location.hostname.endsWith("higgsfield.app") || location.hostname.endsWith(".workers.dev") ? location.host : LIVE_HOST;
const PROTO = location.protocol === "http:" && local ? "ws:" : "wss:";

/**
 * The channel: one of the two of a server ("s1-ch2"), chosen in the lobby
 * (lobby.js). The socket joins with the account's session token (account.js).
 */
let ws = null;
let retry = 0;
let wantOnline = false;
let channel = Lobby.lastChannel();
let connT = 0;

/** Open (or reopen) the socket to channel `ch`, after `delay` ms. */
function connect(ch = channel, delay = 0) {
  clearTimeout(connT);
  if (ws) { const old = ws; ws = null; wantOnline = false; try { old.close(); } catch { /* already closed */ } }
  channel = ch;
  wantOnline = true;
  if (delay) { connT = setTimeout(open, delay); return; }
  open();
}
function open() {
  const sock = (ws = new WebSocket(`${PROTO}//${HOST}/ws/${channel}`));
  sock.addEventListener("open", () => {
    retry = 0;
    sock.send(JSON.stringify(Lobby.joinMsg()));
  });
  sock.addEventListener("message", (ev) => {
    if (ev.data === "__pong" || sock !== ws) return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    onMessage(msg);
  });
  sock.addEventListener("close", () => {
    if (!wantOnline || sock !== ws) return;
    retry = Math.min(retry + 1, 6);
    const wait = 400 * 2 ** (retry - 1);
    // one line per outage, not one per retry; the welcome that follows says it is back
    if (G.playing && retry === 1) addChat("서버와의 연결이 끊겼습니다. 다시 연결하는 중…", "err");
    else Lobby.connecting();
    connT = setTimeout(() => wantOnline && sock === ws && open(), wait);
  });
}
function disconnect() {
  clearTimeout(connT);
  wantOnline = false;
  if (ws) { const old = ws; ws = null; try { old.close(); } catch { /* already closed */ } }
}
function act(action) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
}
setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send("__ping"); }, 30000);

// ───────────────────────────── state ─────────────────────────────

const G = {
  playing: false, you: 0, defs: null, icons: null, self: null, map: null,
  me: { x: 0, y: 0, dir: 0, aimI: 16, hp: 1, mp: 0, dead: false, walk: 0, moving: false, atkT: -1e9, hurtT: -1e9 },
  who: new Map(), players: new Map(), mobs: new Map(), gone: new Map(), drops: new Map(), fires: new Map(), bobs: new Map(), ginv: null,
  fx: [], parts: [], texts: [], bubbles: new Map(), statics: [],
  cdEnd: [0, 0, 0, 0, 0, 0], buffEnd: [0, 0], potAt: 0, lastAtk: 0, lastSkill: 0,
  auto: false, sel: -1, shake: 0, flash: 0, near: null, party: [], pinv: null, path: null, mark: null,
};
let mini = null;
let dpr = 1;

const world = $("#world");
const text = $("#text"), tg = text.getContext("2d");

/**
 * The screen layout. On a desktop the world plays in the top-left viewport,
 * framed by the side column (right) and the dock (bottom); a phone upright
 * gets the world on top and a control deck below; a phone on its side keeps
 * the world full screen with the controls floating over it. The title and
 * character creation always use the whole window.
 */
const SIDE = 288, DOCK = 184;
const VP = { w: innerWidth, h: innerHeight, lay: "full" };
function layout() {
  const W = innerWidth, H = innerHeight, b = document.body;
  // a finger-driven screen gets the touch controls from the start, before the first tap
  if (matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches) b.classList.add("touch");
  const compact = b.classList.contains("touch") || W < 900 || H < 540;
  VP.lay = !compact ? "full" : H > W ? "port" : "land";
  const deck = Math.round(clamp(H * 0.4, 290, 360));
  if (!G.playing) { VP.w = W; VP.h = H; }
  else if (VP.lay === "full") { VP.w = W - SIDE; VP.h = H - DOCK; }
  else if (VP.lay === "port") { VP.w = W; VP.h = H - deck; }
  else { VP.w = W; VP.h = H; }
  b.dataset.lay = VP.lay;
  b.classList.toggle("playing", !!G.playing);
  const r = document.documentElement.style;
  r.setProperty("--vpw", VP.w + "px"); r.setProperty("--vph", VP.h + "px");
  r.setProperty("--dock", (VP.lay === "port" ? deck : DOCK) + "px");
  if (VP.lay === "full") b.classList.remove("drawer");
}
function resize() {
  layout();
  const W = VP.w, H = VP.h;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  text.width = Math.round(W * dpr); text.height = Math.round(H * dpr);
  text.style.width = W + "px"; text.style.height = H + "px";
  S3.resize(W, H);
}
addEventListener("resize", resize);
S3.init(world);
resize();

// ───────────────────────────── messages ─────────────────────────────

function onMessage(msg) {
  switch (msg.type) {
    case "need_char":
      Lobby.needChar();
      break;
    case "welcome":
      G.you = msg.you;
      if (!G.defs) {
        G.defs = msg.defs;
        G.icons = Growth.icons(Art.buildIcons(G.defs.items));
        Growth.init({ G, act, el, iconImg, itemSlot, section, countItem, usePotion, isGear: (id) => isGear(id), sellPrice: (e) => sellPrice(e) });
        Wardrobe.init({ G, act, el, hoverTip });
        QS.init({ G, act, el, toast, castSkill, useSlot, countItem, showTip, hideTip, touch, addChat });
      }
      G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear(); G.who.clear();
      $("#hud").hidden = false;
      if (Lobby.welcome(msg) === "switch" && G.playing) {
        addChat(`${channelName()}(으)로 이동했습니다.`, "sys");
      }
      if (!G.playing) {
        G.playing = true;
        resize();
        addChat(`테일즈테일즈에 오신 것을 환영합니다! (${channelName()})`, "sys");
        addChat("관리자 엘더윈에게 말을 걸어 첫 의뢰를 받아 보세요. 조작법은 H (도움말)에 있습니다.", "sys");
      }
      break;
    case "snap": onSnap(msg); break;
    case "rank": renderRank(msg.list); break;
    case "error":
      if (msg.fatal) {
        disconnect();
        Lobby.fatal(msg);
      } else if (Lobby.createError(msg.error)) {
        /* shown on the creation page */
      } else {
        toast(msg.error);
        Sound.play("no");
      }
      break;
  }
}
const channelName = () => Lobby.label(channel);
/** Out of the world, back to the lobby (the socket is already closed or closing). */
function stopGame() {
  G.playing = false;
  G.auto = false;
  $("#hud").hidden = true; $("#dead").hidden = true; G.me.dead = false; $("#tip").hidden = true;
  for (const w of $$("#windows .window")) if (!w.hidden) closeWin(w.id.slice(2));
  resize();
  tg.clearRect(0, 0, text.width, text.height);
}

function loadMap(m) {
  G.map = m;
  G.path = null;
  S3.leaveStage();
  S3.loadMap(m);
  mini = isoMini(m);
  const cv = $("#mini-cv");
  cv.width = mini.width; cv.height = mini.height;
  G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear();
  G.texts.length = 0;
  G.snapCam = true;
  $("#mini-name").textContent = m.band ? `${m.name} · Lv.${m.band[0]}–${m.band[1]}` : m.name;
  $("#mini-name").title = $("#mini-name").textContent;
  Sound.bgm(m.id, m.bgm); Sound.setTheme(null); snd.bossT = 0;
  banner(m.name, true);
  // walking into a band above you: say so once, at the door
  const lv = G.self && G.self.lvl;
  if (m.band && lv && lv < m.band[0]) toast(`권장 레벨 Lv.${m.band[0]}–${m.band[1]} — 지금(Lv.${lv})은 위험합니다. 파티를 맺거나 입구 근처에서만 사냥하세요.`);
  closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train");
}

function onSnap(s) {
  const t = now();
  const me = G.me;
  if (s.map) loadMap(s.map);
  if (s.map || s.me[5]) { me.x = s.me[0]; me.y = s.me[1]; me.dir = s.me[6]; if (s.me[10] !== undefined) me.aimI = s.me[10]; }
  me.hp = s.me[2]; me.mp = s.me[3]; me.sit = !!s.me[7];
  const dead = !!s.me[4];
  if (dead !== me.dead) { me.dead = dead; $("#dead").hidden = !dead; Sound.play(dead ? "death" : "revive"); if (dead) G.auto = false; }

  if (s.who) {
    G.who.clear();
    for (const [eid, name, cls, lvl, look, at, wt, party, wq, we, pet, wk, guild, title, cos, wl] of s.who) {
      // the outfit (cosmetic codes) and the weapon's legendary/set key ride along in `gear`
      G.who.set(eid, { name, cls, lvl, look, gear: { at, wt, wq, we, wk, ...Wardrobe.wireGear(G.defs, cos, wl) }, party, guild, title, pet: pet || null });
    }
    if (isOpen("party")) renderParty();
    if (isOpen("guild")) renderGuild();
  }
  sync(G.players, s.P, (e, r) => { e.tx = r[1]; e.ty = r[2]; e.dir = r[3]; e.dead = !!r[4]; e.hp = r[5]; e.mhp = r[6]; e.sit = !!r[7]; }, t);
  sync(G.fires, s.F || [], (e, r) => { e.tx = r[1]; e.ty = r[2]; e.x = r[1]; e.y = r[2]; }, t);
  sync(G.mobs, s.M, (e, r) => { e.k = r[1]; e.tx = r[2]; e.ty = r[3]; e.dir = r[4]; e.hp = r[5]; e.el = r[6]; e.tr = r[7] || []; }, t, G.gone);
  sync(G.drops, s.D, (e, r) => { e.it = r[1]; e.tx = r[2]; e.ty = r[3]; e.q = r[4]; }, t);
  SkillFx.onSnap(s, G, t);

  if (s.self) {
    G.self = s.self;
    for (let i = 0; i < s.self.cds.length; i++) G.cdEnd[i] = t + s.self.cds[i];
    G.streak = { n: s.self.streak[0], end: t + s.self.streak[1] };
    G.buffEnd = s.self.buffs.map((ms) => t + ms);
    if (s.self.evt) { G.evt = s.self.evt; G.evtNext = t + s.self.evt.next; G.evtIn = t + (s.self.evt.in || 0); G.evtLeft = t + (s.self.evt.left || 0); }
    if (s.self.daily) G.dailyReset = t + s.self.daily.reset;
    if (s.self.recall > 0 && !G.cast) G.cast = { start: t - (G.defs.recallMs - s.self.recall), end: t + s.self.recall };
    refreshUi();
    Growth.onSelf(s.self);
    if (isOpen("guild")) renderGuild();
  }
  if (s.ev) for (const e of s.ev) {
    const wait = G.impactAt - t;
    if (wait > 8 && ((e[0] === "h" && !e[4] && e[2] > 0) || e[0] === "k")) setTimeout(() => onEvent(e, now()), wait);
    else onEvent(e, t);
  }
  for (const [id, m] of G.gone) if (t - m.goneT > 1500) G.gone.delete(id);
  if (s.chat) for (const c of s.chat) c.sys ? addChat(c.m, "sys") : c.g ? addChat(c.m, "guild", `[길드] ${c.n}`) : c.pt ? addChat(c.m, "party", `[파티] ${c.n}`) : addChat(c.m, "", c.n);
  // a field boss called out, or a wave of the rift breaking in
  if (s.chat) for (const c of s.chat) if (c.sys && /나타났습니다/.test(c.m)) Sound.play(/균열/.test(c.m) ? "elite" : "announce");
  if (s.gain) for (const gn of s.gain) onGain(gn);
  if (s.toast) for (const m of s.toast) toast(m);
  const pk = JSON.stringify(s.party || []);
  if (pk !== G.partyKey) { if (G.partyKey !== undefined && (s.party || []).length > (G.party || []).length) Sound.play("party"); G.partyKey = pk; G.party = s.party || []; renderPartyHud(); if (isOpen("party")) renderParty(); }
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
// a dungeon's chosen guard is its 수문장; out in the open a summoned field boss is a 우두머리 (as the server calls them)
const DUNGEONS = new Set(["crypt", "sewer", "abyss"]);
Mini.mount($("#minigame"));
// every menu button wears its glyph above its word; the auto-hunt button wears one too
for (const b of $$("#menu button")) { const g = MENU_ICON[b.dataset.win || b.id.slice(2)]; if (g) b.prepend(iconImg(g)); }
$("#b-auto").prepend(iconImg(MENU_ICON.auto));

const heightOf = (e) => e.h3 || 1.3;

function onEvent(e, t) {
  if (SkillFx.skillEvent(e, { G, S3, Sound, entityPos, heightOf, t })) return;
  MobArt.onEvent(e, G, S3, t);              // wind-ups, strikes and the bodies monsters leave
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
      if ((e[4] | 0) >= 4) Growth.zoneFx(e, S3);       // the blade storm, the blizzard, the dragon's spear
      else if (col) { S3.fx.ring(e[1], e[2], e[3], col, 300, true); S3.fx.burst(e[1], e[2], 0.4, col, 18, 2.4); S3.shake(2); Sound.play("boom"); }
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
      if (e[5] >= 2) Growth.lineFx(e, S3);              // chain lightning, a phantom's dash
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

function onGain([kind, a, b, q]) {
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
    const p = addChat(`획득: ${q ? `[${G.defs.rarity[q]}] ` : ""}${G.defs.items[a].name}${b > 1 ? ` ×${b}` : ""}`, "loot");
    if (q) p.style.color = Art.RARITY_COL[q];
    Sound.play("loot", q | 0);
    if (q >= 3) banner(q === 4 ? "세트 획득!" : "전설 획득!", true);
  } else if (kind === "cos") { const d = G.defs.cos[a]; const p = addChat(`외형 획득: ${d ? d.name : a}`, "loot"); if (d) p.style.color = Art.RARITY_COL[d.q]; Sound.play("loot", d ? d.q : 1);
  } else if (kind === "lvl") { banner("LEVEL UP!"); floatText(`Lv.${a}`, me.x, me.y, h + 0.9, "#ffd84a", true); Sound.play("level"); addChat(`레벨 ${a} 달성!`, "sys"); }
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
    case 0: f.slash(src.x, src.y, ang, "#cfe0ff", fin ? 1.9 : 1.4, beat === 1); if (fin) S3.shake(3); Sound.play("swing_sword", fin); break;
    case 1: f.proj(src.x, src.y, 0.75, tx, ty, 0.5, "#fff0c0", 0.04, 42); f.burst(src.x + (tx - src.x) * 0.15, src.y + (ty - src.y) * 0.15, 0.75, "#ffd84a", 4, 0.8); Sound.play("shoot"); break;
    case 2: f.proj(src.x, src.y, 1.1, tx, ty, 0.5, "#b08aff", fin ? 0.15 : 0.09, 15, fin ? () => f.ring(tx, ty, 18, "#b08aff", 220, true) : undefined); Sound.play("swing_staff"); break;
    case 3: f.slash(src.x, src.y, ang, "#e0d0f0", fin ? 1.15 : 0.8, beat === 1); Sound.play("swing_dagger"); break;
    case 4: if (beat === 1) f.slash(src.x, src.y, ang, "#d0f0e8", 1.7, true); else { f.beam(src.x, src.y, src.x + Math.cos(ang) * (fin ? 74 : 54), src.y + Math.sin(ang) * (fin ? 74 : 54), "#eef4ff", fin ? 0.9 : 0.5); if (fin) S3.shake(2); } Sound.play("swing_spear", fin); break;
    case 5: f.proj(src.x, src.y, 0.9, tx, ty, 0.5, "#c8a0ff", 0.07, 20, () => { f.ring(tx, ty, fin ? 34 : 26, "#c8a0ff", 220, true); }); Sound.play("swing_book"); break;
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
    default: Growth.skillFx(kind, src, tx, ty, ang, S3);     // 25–32: the second-tier skills and the ultimates
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
    case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9": QS.press(Number(k) - 1); break;
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
    case "k": case "ㅏ": toggleWin("skill"); break;
    case "n": case "ㅜ": toggleWin("rank"); break;
    case "u": case "ㅕ": toggleWin("daily"); break;
    case "y": case "ㅛ": toggleWin("achieve"); break;
    case "j": case "ㅓ": toggleWin("collect"); break;
    case "h": case "ㅗ": toggleWin("help"); break;
    case "o": case "ㅐ": toggleWin("settings"); break;
    case "m": case "ㅡ": toggleSound(); break;
    case "v": case "ㅍ": setCrt(!document.body.classList.contains("crt")); break;
    case "Enter": e.preventDefault(); $("#chat-in").focus(); break;
    case "Escape": closeTop(); break;
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => { keys.clear(); held.atk = false; });

/**
 * Which way to walk on the ground: keys, the stick, or the next step of a clicked route.
 * Keys and stick speak in screen directions, and the view looks at the ground from
 * the diagonal: screen-up is north-west and north-east together, screen-right is
 * east and north, and a screen diagonal runs straight along the tile edges.
 */
function moveVector() {
  let x = 0, y = 0;
  if (Mini.active()) { keys.clear(); G.path = null; return [0, 0]; }
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("ㅁ")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("ㅇ")) x += 1;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("ㅈ")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("ㄴ")) y += 1;
  if (joy.on) { x = joy.x; y = joy.y; }
  if (x || y) { G.path = null; [x, y] = [x + y, y - x]; }
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
  const stone = (G.map.marks || []).find((m) => m.kind === "waypoint" && Math.floor(hit[0] / T) === m.x && Math.floor(hit[1] / T) === m.y);
  if (stone) {
    if (stoneNear()) { openWin("warp"); return; }
    hit[1] = (stone.y + 1) * T + 8;                 // the tile in front of it
  }
  // a monster clicked: aim at it, and strike at once if it is within reach
  const mob = [...G.mobs.values()].find((m) => Math.abs(m.x - hit[0]) < 1 && Math.abs(m.y - hit[1]) < 1);
  if (mob && G.self && !G.map.safe) {
    aimAtPoint(mob.x, mob.y);
    if (dist(G.me.x, G.me.y, mob.x, mob.y) < G.self.range) { G.path = null; attack(); return; }
  }
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
addEventListener("touchstart", () => { document.body.classList.add("touch"); Sound.unlock(); resize(); }, { once: true, passive: true });
addEventListener("pointerdown", () => Sound.unlock(), { once: true });

function press(btn, down, up) {
  const d = (e) => { e.preventDefault(); btn.classList.add("down"); down(); };
  const u = () => { btn.classList.remove("down"); up && up(); };
  btn.addEventListener("pointerdown", d);
  btn.addEventListener("pointerup", u); btn.addEventListener("pointerleave", u); btn.addEventListener("pointercancel", u);
}
press($("#b-atk"), () => { held.atk = true; }, () => { held.atk = false; });
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
  $("#btn-crt").textContent = on ? "켜짐" : "꺼짐";
  localStorage.setItem("lumentale:crt", on ? "1" : "0");
}
setCrt(localStorage.getItem("lumentale:crt") !== "0");
$("#btn-crt").addEventListener("click", () => { setCrt(!document.body.classList.contains("crt")); Sound.play("ui"); });
/** The small arrow at your feet that shows where your blows and skills go; on unless turned off. */
function setAimArrow(on) {
  G.aimArrow = on;
  $("#btn-aim").classList.toggle("off", !on);
  $("#btn-aim").textContent = on ? "켜짐" : "꺼짐";
  localStorage.setItem("lumentale:aim", on ? "1" : "0");
}
setAimArrow(localStorage.getItem("lumentale:aim") !== "0");
$("#btn-aim").addEventListener("click", () => { setAimArrow(!G.aimArrow); Sound.play("ui"); });
function toggleSound() {
  Sound.setMute(!Sound.vol.mute);
  soundUi();
  Sound.play("ui");
}
/** The settings window's sound controls show what Sound holds. */
function soundUi() {
  const on = !Sound.vol.mute;
  $("#btn-sound").classList.toggle("off", !on);
  $("#btn-sound").textContent = on ? "켜짐" : "꺼짐";
  $("#vol-bgm").value = String(Math.round(Sound.vol.music * 100));
  $("#vol-sfx").value = String(Math.round(Sound.vol.sfx * 100));
}
Sound.load();
soundUi();
$("#vol-bgm").addEventListener("input", (ev) => { Sound.unlock(); Sound.setMusic(ev.target.value / 100); });
$("#vol-sfx").addEventListener("input", (ev) => { Sound.unlock(); Sound.setSfx(ev.target.value / 100); });
$("#vol-sfx").addEventListener("change", () => Sound.play("coin"));
function toggleAuto() {
  G.auto = !G.auto;
  autoSt.home = null;
  $("#b-auto").classList.toggle("on", G.auto);
  toast(G.auto ? "자동사냥 시작 (이 근처만 · 우두머리·강한 정예는 피함)" : "자동사냥 종료");
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
  const mpc = s.skm ? s.skm[i] : sk.mp;          // a thrown sword comes back for nothing; a surge casts for nothing
  if (t < G.cdEnd[i] || G.me.mp < mpc) { if (G.me.mp < mpc && !G.auto) toast("MP가 부족합니다"); return false; }
  act({ t: "sk", i, a: G.me.aimI });
  G.cdEnd[i] = t + sk.cd;
  G.me.atkT = t; G.me.atkN = 2; G.lastAtk = t; G.lastSkill = t;
  preAim(aimCone());
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
  const missing = kind === "hp" ? s.mhp - G.me.hp : s.mmp - G.me.mp;
  if (missing <= 0) return;
  // the smallest potion that covers most of what is missing (small, big, concentrated)
  const id = Growth.pickPotion(kind, missing);
  if (!id) {
    if (!G.auto) toast(kind === "hp" ? "HP 물약이 없습니다" : "MP 물약이 없습니다");
    // auto-hunt used to drink in silence until there was nothing left: say so, now and then
    else if (kind === "hp" && t - (G.potWarn || 0) > 30000) { G.potWarn = t; toast("빨간 물약이 다 떨어졌습니다! 마을(보급상 리나)에서 채우지 않으면 위험합니다."); Sound.play("no"); }
    return;
  }
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
  const wk = G.defs.wkinds && G.defs.wkinds[G.self.wk];
  preAim((wk && wk.arc) || aimCone());
  G.aimFlash = t;
  act({ t: "atk", a: G.me.aimI });
}
// ── aim: the server counts AIM_N steps round the compass on the ground (0 = +x, a quarter = +y)
const aimN = () => (G.defs && G.defs.aim ? G.defs.aim[0] : 64);
const aimCone = () => (G.defs && G.defs.aim ? G.defs.aim[1] : 40);
/** The aim step nearest the ground direction (dx, dy). */
function aimIdx(dx, dy) { const n = aimN(); return ((Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * n) % n) + n) % n; }
/** The unit vector of aim step `i`. */
function aimVec(i) { const a = (i / aimN()) * 2 * Math.PI; return [Math.cos(a), Math.sin(a)]; }
/** Aim at a point on the ground (a monster clicked, the auto-hunt's quarry). */
function aimAtPoint(x, y) { if (Math.hypot(x - G.me.x, y - G.me.y) > 1) G.me.aimI = aimIdx(x - G.me.x, y - G.me.y); }
/** Turn toward the nearest monster within reach inside the arc of the aim the moment the swing
 *  starts, as the server will; with none there the swing goes straight ahead. The server's own
 *  word on the target arrives a moment later and only corrects this. */
function preAim(arcDeg) {
  const me = G.me, reach = (G.self.range || 40) + 24, [ax, ay] = aimVec(me.aimI), half = (arcDeg * Math.PI) / 180 + 0.2;
  let best = null, bd = reach;
  for (const m of G.mobs.values()) {
    const dx = m.x - me.x, dy = m.y - me.y, d = Math.hypot(dx, dy);
    if (d < bd && (d < 4 || Math.acos(Math.max(-1, Math.min(1, (dx * ax + dy * ay) / d))) <= half)) { bd = d; best = m; }
  }
  if (best) me.aim = [best.x, best.y + 6];
  else me.aim = [me.x + ax * 30, me.y + ay * 30 + 6];
}

function nearestNpc() {
  let best = null, bd = 40;
  for (const n of G.map.npcs) {
    const d = dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12);
    if (d < bd) { bd = d; best = n; }
  }
  for (const m of G.map.marks || []) {
    if (m.kind !== "waypoint") continue;
    const d = dist(G.me.x, G.me.y, m.x * T + 8, m.y * T + 8);
    if (d < bd) { bd = d; best = STONE; }
  }
  return best;
}
/** The waypoint stone, as something the player can talk to. */
const STONE = { role: "stone", name: "이동의 돌" };
const stoneNear = () => (G.map.marks || []).some((m) => m.kind === "waypoint" && dist(G.me.x, G.me.y, m.x * T + 8, m.y * T + 8) < 40);
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

/** The sheet NPCs read their lines from, plus whether the main quest is ready to hand in. */
function talkSheet() {
  const s = G.self, q = s && s.q, quest = q && G.defs.quests[q.i];
  return s && { ...s, qDone: !!(q && q.st === 1 && quest && q.n >= quest.n) };
}
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
  else if (n.role === "elder") { openWin("quest"); tutTry("talk"); }
  else if (n.role === "stone" || n.role === "warp") openWin("warp");
  else if (n.role === "daily") openWin("daily");
  else if (n.role === "collector") openWin("collect");
  else if (n.role === "achieve") openWin("achieve");
  else if (n.role === "train") openWin("train");
  else if (n.role === "bank") openWin("bank");
  else if (n.role === "costume") openWin("costume");
  else { talkTo(n); return; }
  // the townsfolk have a word to say as they serve you (npctalk.js)
  const line = n.role !== "stone" && NpcTalk.lineFor(n, talkSheet());
  if (line) addChat(line, "npc", n.name);
}
/** The talk window: the NPC's greeting, then more on "다음 이야기", round and round. */
const talk = { npc: null, lines: [], i: 0 };
function talkTo(n) {
  talk.npc = n; talk.lines = NpcTalk.allLines(n, talkSheet()); talk.i = 0;
  if (!talk.lines.length) talk.lines = ["…"];
  $("#talk-name").textContent = n.name;
  talkShow();
  openWin("talk");
}
function talkShow() {
  $("#talk-text").textContent = talk.lines[talk.i % talk.lines.length];
  let more = $("#talk-more");
  if (!more) {
    more = el("button", "btn small", "");
    more.id = "talk-more";
    more.addEventListener("click", () => { talk.i++; talkShow(); Sound.play("blip"); });
    $("#talk-text").after(more);
  }
  more.hidden = talk.lines.length < 2;
  more.textContent = `다음 이야기 (${(talk.i % talk.lines.length) + 1}/${talk.lines.length})`;
}

// ───────────────────────────── update ─────────────────────────────

let lastSend = 0, sent = { x: 0, y: 0, d: 0, a: 16 };
const autoSt = { stuck: 0, side: 0, sign: 1, lastSkill: 0, target: null, routed: 0, skip: new Map(), home: null, homing: false };
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
  return !(m.el && md.lv >= s.lvl + 3);
}

/** What the ground under a tile sounds like underfoot. */
const STEP_KIND = { ".": "grass", ",": "grass", '"': "grass", ":": "grass", ";": "grass", p: "dirt", s: "dirt", b: "wood", w: "dirt" };
const snd = { foot: 0, look: 0, bossT: 0 };
/** Footsteps, a nearby fire's crackle, an elite turning up, and boss / rift music over the map's own. */
function soundscape(t) {
  const me = G.me;
  const f = Math.floor(me.walk);
  if (me.moving && f !== snd.foot && f % 2 === 0) {
    const row = G.map.g[Math.floor(me.y / T)];
    Sound.step(STEP_KIND[row && row[Math.floor(me.x / T)]] || "stone");
  }
  snd.foot = f;
  if (t - snd.look < 250) return;
  snd.look = t;
  let fire = 0;
  for (const fr of G.fires.values()) fire = Math.max(fire, 1 - dist(me.x, me.y, fr.x, fr.y) / 200);
  Sound.ambient(fire);
  // a boss or field boss close by and fighting keeps the boss theme up for a while
  for (const m of G.mobs.values()) {
    const d = dist(me.x, me.y, m.x, m.y);
    if (m.el && !m.heard && d < 260 && !G.defs.mobs[m.k]?.chest) { m.heard = 1; Sound.play(m.el === 2 ? "announce" : "elite"); }
    if ((G.defs.mobs[m.k]?.boss || m.el === 2) && d < 280 && t - Math.max(m.hurtT || 0, m.atkT || 0) < 8000) snd.bossT = t + 6000;
  }
  const e = G.evt, rift = e && (e.phase === "on" || e.phase === "boss") && e.map === G.map.id;
  Sound.setTheme(t < snd.bossT && !me.dead ? "boss" : rift ? "rift" : null);
}

function update(dt, t) {
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
      if (md && !md.chest && d < td && md.lv > s.lvl && (md.boss || m.el === 2 || (m.el && md.lv >= s.lvl + 3))) { threat = m; td = d; }
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
          for (const i of QS.autoSkills()) {
            const sk = G.defs.skills[s.cls][i];
            if (!sk) continue;
            if (s.lvl >= sk.lv && t >= G.cdEnd[i] && me.mp >= (s.skm ? s.skm[i] : sk.mp) + 4) { if (castSkill(i)) { autoSt.lastSkill = t; break; } }
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
  if (near !== G.near) {
    G.near = near;
    const p = $("#prompt");
    p.hidden = !near;
    if (near) { p.textContent = ""; p.append(el("b", "", document.body.classList.contains("touch") ? "▶ " : "F  "), near.name); }
    else { closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train"); if (isOpen("warp")) delete shown.warp; }
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
    label(`Lv.${d.lv} ${mob.el === 2 && DUNGEONS.has(G.map.id) ? "수문장 " : RANK_NAME[mob.el | 0]}${tn}${d.name}`, x, y, d.boss ? "#ff9ae0" : mob.el === 2 ? "#ff8a4a" : mob.el ? "#ffbe3c" : "#ece0e0");
    if (mob.hp < max) bar(x, y + 4, d.boss ? 90 : mob.el === 2 ? 70 : 42, mob.hp / max, mob.el === 2 ? "#ff8a4a" : mob.el ? "#ffbe3c" : "#d8404c");
  }
  for (const d of G.drops.values()) {
    // the loot filter decides whose names are shown: everything, magic and up, or rare and up
    if (!Growth.showDrop(d)) continue;
    const [x, y] = at(d.x, d.y, 0.6);
    label(Growth.dropName(d), x, y, d.it === "gold" ? "#ffd84a" : Art.RARITY_COL[d.q | 0]);
  }
  const mine = G.who.get(G.you);
  for (const [eid, p] of G.players) {
    const w = G.who.get(eid);
    if (!w) continue;
    const [x, y] = at(p.x, p.y, (p.h3 || 1.32) + 0.22);
    label(`Lv.${w.lvl} ${w.name}`, x, y, p.dead ? "#9a9aa8" : w.party && w.party === myParty ? "#8cff8c" : "#dce6f2");
    if (w.guild) label(`‹${w.guild}›`, x, y - 13, mine && w.guild === mine.guild ? "#9af0ae" : "#c8b8e8", 11);
    if (w.title) label(`「${w.title}」`, x, y - (w.guild ? 26 : 13), "#ffcf6a", 11);
    if (p.hp < p.mhp && !p.dead) bar(x, y + 4, 40, p.hp / p.mhp, "#58c070");
  }
  // your own name lifts while the aim arrow points up over your head
  if (mine) { const [x, y] = at(me.x, me.y, (me.h3 || 1.32) + 0.22 + (G.aimArrow === false ? 0 : 0.3 * (G.aimUpK || 0))); label(`Lv.${mine.lvl} ${mine.name}`, x, y, "#f4e4b0"); if (mine.guild) label(`‹${mine.guild}›`, x, y - 13, "#9af0ae", 11); if (mine.title) label(`「${mine.title}」`, x, y - (mine.guild ? 26 : 13), "#ffcf6a", 11); }
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
    const [x, y] = at(f.x, f.y, f.h + k * 0.55);
    const pop = f.big && k < 0.15 ? -6 * Math.sin((k / 0.15) * Math.PI) : 0;
    label(f.str, x, y + pop, f.col, f.big ? 17 : 13);
  }
  tg.globalAlpha = 1;
  if (G.flash > 0) { tg.fillStyle = `rgba(255,40,60,${G.flash * 0.22})`; tg.fillRect(0, 0, text.width, text.height); }
  // the white blink of a heavy hit
  if (G.punch > 0) { tg.fillStyle = `rgba(255,255,255,${G.punch * 0.16})`; tg.fillRect(0, 0, text.width, text.height); G.punch = Math.max(0, G.punch - 0.25); }
}

/** The minimap as a diamond, turned the way the world is seen: screen-up on the map is screen-up in the world. */
function isoMini(m) {
  const sq = Art.renderMini(m, 4);
  const c = document.createElement("canvas");
  c.width = (m.w + m.h) * 2; c.height = m.w + m.h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.setTransform(0.5, 0.25, -0.5, 0.25, m.h * 2, 0);
  g.drawImage(sq, 0, 0);
  return c;
}
let miniAt = 0;
function renderMini(t) {
  if (!mini || t - miniAt < 200) return;
  miniAt = t;
  const cv = $("#mini-cv"), g = cv.getContext("2d");
  const m = G.map;
  g.imageSmoothingEnabled = false;
  g.drawImage(mini, 0, 0);
  // the map turned to match the view: tile (x, y) is a 4×2 diamond, the map's west corner at the left edge
  const dot = (x, y, col, r = 2) => { const tx = x / T, ty = y / T; g.fillStyle = col; g.fillRect(Math.round((tx - ty) * 2 + m.h * 2 - r / 2), Math.round(tx + ty - r / 2), r, r); };
  for (const p of m.portals) dot(p.x * T + 8, p.y * T + 8, "#e080ff", 3);
  for (const n of m.npcs) dot(n.x * T + 8, n.y * T + 8, "#ffd84a", 3);
  for (const mob of G.mobs.values()) dot(mob.x, mob.y, mob.el ? "#ffbe3c" : "#ff5050");
  for (const p of G.players.values()) dot(p.x, p.y, "#7ad8ff", 3);
  dot(G.me.x, G.me.y, Math.floor(t / 300) % 2 ? "#ffffff" : "#08090c", 3);
  const info = `${channelName()} · ${G.map.safe ? "안전 지대" : "사냥터"} · ${G.who.size}명`;
  if ($("#mini-info").textContent !== info) $("#mini-info").textContent = info;
}

// ───────────────────────────── HUD & windows ─────────────────────────────

const touch = () => document.body.classList.contains("touch");
const WIN = ["inv", "char", "skill", "shop", "smith", "quest", "rank", "talk", "help", "settings", "train", "party", "guild", "warp", "daily", "achieve", "collect", "bank", "costume"];
const winEl = (id) => $(`#w-${id}`);
/** The bag is docked in the side column, so it always counts as open (on a phone it lives in the drawer). */
const isOpen = (id) => id === "inv" || !winEl(id).hidden;
const compact = () => VP.lay !== "full";
const drawerOpen = () => document.body.classList.contains("drawer");
function setDrawer(on) {
  if (on === drawerOpen()) return;
  document.body.classList.toggle("drawer", on);
  Sound.play(on ? "open" : "close");
  if (!on && G.sel >= 0) { G.sel = -1; refreshUi(); }
}
/** Point the player at the docked bag: on a phone open the drawer, on a desktop make it blink. */
function showBag() {
  if (compact()) { setDrawer(true); return; }
  const b = winEl("inv");
  b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash");
}
/** Per window, the key of what it last drew: a window is rebuilt only when what it shows has changed. */
const shown = {};
let zTop = 20;
const WIN_KEY = (id) => `lumentale:win2:${id}`;
const roomy = () => VP.lay === "full";
/** Where windows may sit: over the viewport on a desktop, anywhere on a phone. */
const winArea = () => (VP.lay === "land" ? [Math.max(320, innerWidth - 300), innerHeight] : [VP.w, VP.h]);

/** Where a window first opens, before the player moves it: inside the viewport, the shop and smith on the right next to the bag. */
function homeOf(id, w, h) {
  const [W, H] = winArea(), top = 8;
  const right = W - w - 8, mid = (W - w) / 2;
  switch (id) {
    case "char": case "shop": case "smith": case "train": case "bank": return [right, top];
    case "skill": case "party": case "guild": case "rank": case "daily": case "achieve": case "collect": return [8, top + 32];
    case "talk": return [mid, H - h - 56];
    default: return [mid, Math.max(top, (H - h) / 2 - 30)];
  }
}
function keepIn(id, x, y) {
  if (id === "inv") return;
  const w = winEl(id), [W, H] = winArea();
  const ww = w.offsetWidth, wh = w.offsetHeight;
  x = x ?? (parseFloat(w.style.left) || 0); y = y ?? (parseFloat(w.style.top) || 0);
  w.style.left = `${Math.round(clamp(x, 4, Math.max(4, W - ww - 4)))}px`;
  w.style.top = `${Math.round(clamp(y, 4, Math.max(4, H - wh - 4)))}px`;
}
function placeWin(id) {
  const w = winEl(id);
  let pos = null;
  if (roomy()) { try { pos = JSON.parse(localStorage.getItem(WIN_KEY(id))); } catch { pos = null; } }
  if (!Array.isArray(pos)) pos = roomy() ? homeOf(id, w.offsetWidth, w.offsetHeight) : [(winArea()[0] - w.offsetWidth) / 2, 8];
  keepIn(id, pos[0], pos[1]);
}
function front(id) {
  if (id === "inv") return;
  const w = winEl(id);
  if (+w.style.zIndex !== zTop) w.style.zIndex = ++zTop;
  for (const o of WIN) if (o !== "inv") winEl(o).classList.toggle("top", o === id);
}
function syncMenu() { for (const b of $$("#menu button[data-win]")) b.classList.toggle("on", b.dataset.win === "inv" ? drawerOpen() : isOpen(b.dataset.win)); }
function openWin(id) {
  if (id === "inv") { showBag(); tutTry("bag"); refreshUi(); syncMenu(); return; }
  const w = winEl(id), was = !w.hidden;
  w.hidden = false;
  delete shown[id];
  if (id === "rank") { $("#rank-list").textContent = "불러오는 중…"; act({ t: "rank" }); }
  if (id === "settings") Lobby.refreshSettings();
  if (id === "party") renderParty();
  if (id === "guild") { act({ t: "glist" }); renderGuild(); }
  refreshUi();
  if (!was) placeWin(id);
  front(id);
  syncMenu();
}
function closeWin(id) {
  if (id === "inv") {
    if (tip.from && winEl("inv").contains(tip.from)) hideTip();
    if (G.sel >= 0) { G.sel = -1; refreshUi(); }
    if (compact()) setDrawer(false);
    syncMenu();
    return;
  }
  const w = winEl(id);
  if (w.hidden) return;
  w.hidden = true;
  if (tip.from && w.contains(tip.from)) hideTip();
  syncMenu();
}
function toggleWin(id) {
  if (id === "inv") { if (compact() && drawerOpen()) closeWin("inv"); else { Sound.play("open"); openWin("inv"); } return; }
  Sound.play(isOpen(id) ? "close" : "open"); isOpen(id) ? closeWin(id) : openWin(id);
}
function closeAll() { for (const id of WIN) closeWin(id); }
/** Esc: the emote picker first, then whichever window is on top, then the drawer, then the bag's pick. */
function closeTop() {
  if (!$("#emotes").hidden) { $("#emotes").hidden = true; return; }
  let best = null, bz = -1;
  for (const id of WIN) if (id !== "inv" && isOpen(id)) { const z = +winEl(id).style.zIndex || 0; if (z > bz) { bz = z; best = id; } }
  if (best) { closeWin(best); Sound.play("close"); }
  else if (drawerOpen() || G.sel >= 0) closeWin("inv");
}
for (const id of WIN) {
  if (id === "inv") continue;
  const w = winEl(id), head = w.querySelector("header");
  w.addEventListener("pointerdown", () => front(id), true);
  w.querySelector(".x").addEventListener("click", () => { closeWin(id); Sound.play("close"); });
  // dragged by the title bar, kept on the screen, remembered
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".x") || e.button !== 0) return;
    e.preventDefault();
    const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const move = (ev) => keepIn(id, ev.clientX - ox, ev.clientY - oy);
    const up = () => {
      head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up);
      if (roomy()) localStorage.setItem(WIN_KEY(id), JSON.stringify([parseFloat(w.style.left), parseFloat(w.style.top)]));
    };
    head.addEventListener("pointermove", move); head.addEventListener("pointerup", up); head.addEventListener("pointercancel", up);
  });
}
$("#b-drawer").addEventListener("click", () => { setDrawer(!drawerOpen()); syncMenu(); });
$("#chat-fold").addEventListener("click", () => document.body.classList.toggle("chat-folded"));
// the class gauge's own tooltip
$("#cg-box").addEventListener("mouseenter", () => { $("#cg-box").title = G.self ? gaugeTip(G.self) || "" : ""; });
addEventListener("resize", () => { for (const id of WIN) if (isOpen(id)) keepIn(id); });
for (const b of $$("#menu button[data-win]")) b.addEventListener("click", () => toggleWin(b.dataset.win));
$("#btn-winreset").addEventListener("click", () => {
  for (const id of WIN) localStorage.removeItem(WIN_KEY(id));
  for (const id of WIN) if (isOpen(id)) placeWin(id);
  Sound.play("ui");
  toast("창을 처음 자리로 옮겼습니다");
});

function toast(m) {
  const box = $("#toasts");
  const p = el("p", "", m);
  box.append(p);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => p.remove(), 3300);
  // party and guild news also goes in the log, under its own tab
  if (/파티/.test(m)) addChat(m, "sys party");
  else if (/길드/.test(m)) addChat(m, "sys guild");
}
function banner(str, small) {
  const b = $("#banner");
  b.hidden = true;
  void b.offsetWidth; // restart the animation
  b.textContent = str;
  b.style.fontSize = small ? "22px" : "";
  b.hidden = false;
}

// ── chat ──
const chatLog = $("#chat-log");
function addChat(m, cls, name) {
  const stick = chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 12;
  const p = el("p", cls || "");
  if (name) p.append(el("span", "who", `${name}: `));
  if (typeof m === "string") {
    for (const seg of Emo.parse(m)) {
      if (seg.e === undefined) { p.append(seg.s); continue; }
      const im = el("img", "emo"); im.alt = Emo.token(seg.e); im.src = Emo.emoUrl(seg.e); p.append(im);
    }
  } else p.append(m);
  chatLog.append(p);
  while (chatLog.children.length > 150) chatLog.firstChild.remove();
  if (stick) chatLog.scrollTop = chatLog.scrollHeight;
  return p;
}
const CHAT_HINT = { all: "Enter 로 채팅 · /p 파티 · /g 길드", party: "Enter 로 파티 채팅", guild: "Enter 로 길드 채팅", sys: "Enter 로 채팅" };
/** Which channel a line goes to: /p or /g in front, else the open tab (파티 · 길드), else everyone nearby. */
function chatAction(m) {
  const g = /^\/(g|길드|ㅎ)\s+(.+)/.exec(m), pt = /^\/(p|파티|ㅔ)\s+(.+)/.exec(m);
  if (g) return { t: "gchat", m: g[2] };
  if (pt) return { t: "pchat", m: pt[2] };
  if (chatLog.dataset.tab === "guild") return { t: "gchat", m };
  if (chatLog.dataset.tab === "party") return { t: "pchat", m };
  return { t: "chat", m };
}
for (const b of $$("#chat-tabs button")) {
  b.addEventListener("click", () => {
    for (const o of $$("#chat-tabs button")) o.classList.toggle("on", o === b);
    chatLog.dataset.tab = b.dataset.tab;
    $("#chat-in").placeholder = CHAT_HINT[b.dataset.tab];
    chatLog.scrollTop = chatLog.scrollHeight;
    Sound.play("ui");
  });
}
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-in");
  const m = input.value.trim();
  if (m) act(chatAction(m));
  input.value = "";
  input.blur();
});
chatLog.addEventListener("click", () => {
  if (!touch()) return;
  const m = prompt(chatLog.dataset.tab === "guild" ? "길드 채팅" : chatLog.dataset.tab === "party" ? "파티 채팅" : "채팅");
  if (m && m.trim()) act(chatAction(m.trim().slice(0, 80)));
});

// ── the tooltip ──
const tipBox = $("#tip");
const tip = { from: null };
function showTip(anchor, fill) {
  tipBox.textContent = "";
  fill(tipBox);
  tipBox.hidden = false;
  tip.from = anchor;
  // beside the window the item sits in, so it never covers the grid it describes
  const r = anchor.getBoundingClientRect(), side = (anchor.closest(".window") || anchor).getBoundingClientRect();
  const w = tipBox.offsetWidth, h = tipBox.offsetHeight;
  let x = side.right + 6;
  if (x + w > innerWidth - 4) x = side.left - w - 6;
  if (x < 4) x = r.right + 8;
  tipBox.style.left = `${Math.round(clamp(x, 4, innerWidth - w - 4))}px`;
  tipBox.style.top = `${Math.round(clamp(r.top, 4, innerHeight - h - 4))}px`;
}
function hideTip() { tipBox.hidden = true; tip.from = null; }
/** Hovering shows the tooltip; on a touch screen the window shows the same thing in its own pane instead. */
function hoverTip(node, fill) {
  node.addEventListener("mouseenter", () => { if (!touch()) showTip(node, fill); });
  node.addEventListener("mouseleave", () => { if (tip.from === node) hideTip(); });
}

// ── items ──
/** The glyph beside each line of the character sheet. */
const GEAR = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"];
const TYPE_NAME = { weapon: "무기", helm: "투구", armor: "갑옷", gloves: "장갑", boots: "신발", ring: "반지", amulet: "목걸이" };
const SLOT_NAME = { weapon: "무기", helm: "투구", armor: "갑옷", gloves: "장갑", boots: "신발", ring1: "반지 1", ring2: "반지 2", amulet: "목걸이" };
const SLOT_GLYPH = { weapon: "sword", helm: "person", armor: "shield", gloves: "fang", boots: "chevron", ring1: "gem", ring2: "gem", amulet: "gem" };
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
/** The full description: base line, rolled affixes, legendary power, set bonuses, sockets, runeword. */
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
  return Math.floor(it.price * 0.05 * (1 + 0.8 * (entry.q || 0)) * (1 + 0.3 * (entry.enh || 0)));
}
/** A tooltip's content: the item, a line on what clicking does, then whatever it would replace. */
function itemTip(entry, host, o = {}) {
  describe(entry, host);
  const s = G.self, d = G.defs.items[entry.id];
  if (!o.worn && isGear(entry.id)) {
    if (d.cls && d.cls !== s.cls) host.append(el("div", "err-line", `${G.defs.classes[d.cls].name}만 쓸 수 있습니다`));
    else if (s.lvl < d.req) host.append(el("div", "err-line", `레벨 ${d.req}부터 쓸 수 있습니다`));
  }
  if (o.price) host.append(el("div", "gold-line", o.price));
  if (o.hint) host.append(el("div", "hint", o.hint));
  if (!o.worn && isGear(entry.id)) {
    for (const k of slotsFor(d.type)) {
      if (!s.eq[k]) continue;
      host.append(el("div", "cmp", `착용 중 — ${SLOT_NAME[k]}`));
      describe(s.eq[k], host);
    }
  }
}
function itemSlot(entry, o = {}) {
  const d = el("div", "slot");
  if (!entry) { d.classList.add("empty"); return d; }
  const it = G.defs.items[entry.id];
  if (entry.q) d.classList.add(`q${entry.q}`);
  if (o.selected) d.classList.add("sel");
  const img = el("img");
  img.src = entryIconUrl(entry, it) || G.icons.url[entry.id];
  img.alt = it.name;
  d.append(img);
  if (entry.sk) { const pips = el("span", "sk"); for (let i = 0; i < entry.sk; i++) pips.append(el("i", entry.ru && entry.ru[i] ? "on" : "")); d.append(pips); }
  if (entry.n > 1) d.append(el("span", "n", entry.n));
  if (entry.enh > 0) d.append(el("span", "e", `+${entry.enh}`));
  if (o.onClick) d.addEventListener("click", o.onClick);
  if (o.onUse) {
    d.addEventListener("dblclick", (e) => { e.preventDefault(); o.onUse(); });
    d.addEventListener("contextmenu", (e) => { e.preventDefault(); o.onUse(); });
  }
  hoverTip(d, (h) => itemTip(entry, h, o));
  return d;
}
/** Double-click or right-click in the bag: drink, eat, light, cook or put on. */
function useSlot(i) {
  const s = G.self, entry = s.inv[i];
  if (!entry) return;
  const d = G.defs.items[entry.id];
  hideTip();
  if (d.type === "pot" || d.type === "food" || d.type === "scroll" || d.type === "buff" || d.type === "pet") act({ t: "use", id: entry.id });
  else if (d.type === "camp") { act({ t: "use", id: entry.id }); closeWin("inv"); }
  else if (d.type === "fish") {
    if (!fireNear()) { toast("모닥불 곁에서 구울 수 있습니다"); return; }
    closeWin("inv"); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id: entry.id, s: score }));
  } else if (isGear(entry.id)) {
    if (d.cls && d.cls !== s.cls) { toast(`${G.defs.classes[d.cls].name} 전용 장비입니다`); Sound.play("no"); return; }
    if (s.lvl < d.req) { toast(`레벨 ${d.req}부터 장착할 수 있습니다`); Sound.play("no"); return; }
    act({ t: "eq", s: i }); G.sel = -1;
  } else if (d.type === "rune") { G.sel = i; toast("끼울 홈을 가방 아래에서 고르세요"); refreshUi(); return; }
  else return;
  Sound.play("ui");
}

/** The tidy button asks the server to sort the bag for real: by kind, best first, stacks merged. */
const invOrder = (inv) => inv.map((_, i) => i);
$("#inv-sort").addEventListener("click", () => {
  if (!G.self || G.self.inv.length < 2) return;
  act({ t: "sort" });
  G.sel = -1;
  hideTip();
  Sound.play("ui");
});
/** Usable things can go in a quick slot. */
const QS_USE = ["pot", "food", "camp", "scroll", "buff", "pet"];

// ── the unit frame and the bars ──
const look = () => G.who.get(G.you);
let faceKey = "";
function drawFace() {
  const w = look(), s = G.self;
  if (!w || !s) return;
  const key = JSON.stringify([s.cls, w.look, w.gear && w.gear.cos]);
  if (key === faceKey) return;
  faceKey = key;
  const fr = SP.personSheet(SP.playerLook(s.cls, w.look, w.gear)).front[0];
  const g = $("#st-face").getContext("2d");
  g.clearRect(0, 0, 40, 40);
  g.imageSmoothingEnabled = false;
  g.drawImage(fr, 6, 8, 20, 20, 0, 0, 40, 40);
}
/** The paper-doll's figure: the player's own sprite, large, breathing and now and then blinking. */
let dollAt = 0, dollFrame = -1;
function drawPortrait(t) {
  const w = look(), s = G.self;
  if (!w || !s) return;
  const f = t % 4200 < 160 ? 5 : Math.floor(t / 650) % 2;
  if (f === dollFrame && t - dollAt < 2000) return;
  dollFrame = f; dollAt = t;
  const cv = $("#char-cv"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = false;
  g.fillStyle = "rgba(0,0,0,.4)";
  g.beginPath(); g.ellipse(66, 147, 30, 6, 0, 0, Math.PI * 2); g.fill();
  const fr = SP.personSheet(SP.playerLook(s.cls, w.look, w.gear)).front[f];
  g.drawImage(fr, 4, 2, 24, 28, 6, 10, 120, 140);
}
function hudBars() {
  const s = G.self, me = G.me;
  if (!s) return;
  const hp = `${clamp((me.hp / s.mhp) * 100, 0, 100)}%`;
  $("#st-hp").style.width = hp;
  $("#st-hp-trail").style.width = hp;
  $("#st-mp").style.width = `${clamp((me.mp / s.mmp) * 100, 0, 100)}%`;
  $("#st-hpt").textContent = `${me.hp} / ${s.mhp}`;
  $("#st-mpt").textContent = `${me.mp} / ${s.mmp}`;
}
function setOnce(node, key, fill) {
  if (node.dataset.k === key) return;
  node.dataset.k = key;
  node.textContent = "";
  fill(node);
}
function hudFrame(s) {
  $("#st-name").textContent = s.name;
  setOnce($("#st-lv"), `${s.lvl}:${s.cls}`, (n) => n.append(iconImg(CLASS_ICON[s.cls] || "sword", "#e2c486"), `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`));
  drawFace();
  const maxed = s.lvl >= G.defs.maxLv;
  $("#exp-fill").style.width = maxed ? "100%" : `${Math.min(100, (s.xp / s.need) * 100)}%`;
  $("#exp-text").textContent = maxed ? `수련 경험치 ${s.xp.toLocaleString()}` : `EXP ${s.xp.toLocaleString()} / ${s.need.toLocaleString()}  (${((s.xp / s.need) * 100).toFixed(2)}%)`;
  hudBars();
}
function setSrc(img, src) { if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; } }
function hotbar(s) {
  for (const [btn, kind] of [["#b-hp", "hp"], ["#b-mp", "mp"]]) {
    const [n, show] = Growth.potionCount(kind);
    setSrc($(`${btn} img`), G.icons.url[show]);
    $(`${btn} .n`).textContent = n;
    $(btn).style.opacity = n ? 1 : 0.45;
  }
  QS.render();                                      // the quick slots 1–9 (quickslots.js)
  // the attack button carries the weapon in hand
  const wpn = s.eq.weapon;
  setSrc($("#b-atk img"), wpn ? G.icons.url[wpn.id] : iconUrl("sword"));
  $("#b-atk").title = `공격 (Space) — ${G.defs.wkinds[s.wk]?.name || ""} · 세 번째 타격은 마무리 일격`;
}
function tracker(s) {
  const quest = G.defs.quests[s.q.i], mobs = G.defs.mobs;
  const dl = s.daily && s.daily.tasks.filter((d) => !d.claimed);
  const key = JSON.stringify([s.q, s.bq, dl]);
  setOnce($("#quest-track"), key, (qt) => {
    if (!quest && !s.bq && !(dl && dl.length)) return;
    const head = el("div", "qh"); head.append(iconImg("scroll", "#e2c486"), "의뢰");
    qt.append(head);
    const goal = (label, n, need, doneText) => {
      const done = n >= need, row = el("div", "qp");
      if (done) row.append(el("span", "done", doneText));
      else {
        const bar = el("div", "bar"), f = el("i");
        f.style.width = `${clamp((n / need) * 100, 0, 100)}%`;
        bar.append(f);
        row.append(el("span", "", label), bar, el("span", "", `${n}/${need}`));
      }
      return row;
    };
    if (quest && s.q.st === 1) {
      const t = el("div", "qt"); t.append(el("small", "", "주요"), quest.title);
      qt.append(t, goal(G.defs.mobs[quest.mob].name, s.q.n, quest.n, "완료! 엘더윈에게 돌아가세요"));
    } else if (quest) {
      const t = el("div", "qt"); t.append(el("small", "", "주요"), "엘더윈에게 새 의뢰가 있습니다");
      qt.append(t);
    }
    if (s.bq) {
      const t = el("div", "qt"); t.append(el("small", "", "반복"), `${mobs[s.bq.k].name} 토벌`);
      qt.append(t, goal(mobs[s.bq.k].name, s.bq.n, s.bq.need, "완료! 엘더윈에게 보고하세요"));
    }
    if (dl && dl.length) {
      const t = el("div", "qt"); t.append(el("small", "", "일일"), `오늘의 과제 ${3 - dl.length}/3`);
      qt.append(t);
      for (const d of dl) qt.append(goal(d.text, d.n, d.need, `${d.text} — 완료! (U)`));
    }
  });
}
$("#quest-track").addEventListener("click", () => toggleWin("quest"));
// a clicked button lets go of the focus, so Space and Enter go back to the game
addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("button"); if (b && document.activeElement === b) b.blur(); });

function draw(id, keyOf, fn) {
  if (!isOpen(id)) return;
  const k = JSON.stringify(keyOf());
  if (shown[id] === k) return;
  shown[id] = k;
  if (tip.from && winEl(id).contains(tip.from)) hideTip();
  fn(G.self);
  keepIn(id);
}
function refreshUi() {
  const s = G.self;
  if (!s) return;
  hudFrame(s);
  hotbar(s);
  tracker(s);
  const near = G.near && G.near.role;
  draw("inv", () => [s.inv, s.gold, s.eq, s.lvl, G.sel, near, isOpen("shop"), isOpen("smith"), fireNear(), touch(), s.pet, s.qs], renderInv);
  draw("char", () => [s.eq, s.atk, s.def, s.mhp, s.mmp, s.crit, s.critd, s.ls, s.xpb, s.mf, s.goldb, s.acd, s.kills, s.tr, s.lg, s.lvl, s.name, s.guild], renderChar);
  draw("skill", () => [s.lvl, s.cls, s.wk, s.acd, s.range, s.eq.weapon && s.eq.weapon.id, s.skl, s.qs], renderSkills);
  draw("shop", () => [s.gold, s.cls, s.lvl, s.inv], renderShop);
  draw("smith", () => [s.eq, s.enh, s.gold, countItem("stone")], renderSmith);
  draw("train", () => [s.xp, s.tr, s.trc, s.skl, s.skc, s.gold, s.lvl], renderTrain);
  draw("bank", () => [s.inv, s.wh, s.gold], Growth.renderBank);
  draw("quest", () => [s.q, s.bq, s.bn, s.mk, s.lvl, near, G.qsel], renderQuest);
  draw("warp", () => [s.wp, G.map && G.map.id, stoneNear(), near, G.warpPick], renderWarp);
  draw("daily", () => [s.daily && s.daily.day, s.daily && s.daily.tasks, s.daily && s.daily.bonus, s.inv.length], renderDaily);
  draw("achieve", () => [s.ach, s.title, s.pts, G.achTab], renderAchieve);
  draw("collect", () => [s.mk, s.col, G.colTab], renderCollect);
  Wardrobe.refresh(s);
  tutCard(s);
}
function section(text, glyph) {
  const h = el("div", "section");
  if (glyph) h.append(iconImg(glyph, "#e2c486"));
  h.append(text);
  return h;
}

// ── the bag ──
function renderInv(s) {
  const it = G.defs.items;
  $("#inv-gold").textContent = "";
  $("#inv-gold").append(iconImg("coin", "#e2c486"), `${s.gold.toLocaleString()} G`);
  $("#inv-count").textContent = `${s.inv.length} / ${G.defs.inv}`;
  const sort = $("#inv-sort");
  sort.textContent = "";
  sort.append(iconImg("sort"), "정리");
  sort.title = "가방 정리: 종류별로, 좋은 것부터, 같은 것은 한 묶음으로";
  const grid = $("#inv-grid");
  grid.textContent = "";
  if (G.sel >= s.inv.length) G.sel = -1;
  const order = invOrder(s.inv);
  for (let n = 0; n < G.defs.inv; n++) {
    const i = order[n];
    if (i === undefined) { grid.append(itemSlot(null)); continue; }
    const entry = s.inv[i];
    const usable = QS_USE.includes(it[entry.id].type), at = usable ? QS.keysOf(["i", entry.id]) : "";
    const node = itemSlot(entry, {
      selected: i === G.sel,
      onClick: () => { G.sel = G.sel === i ? -1 : i; Sound.play("ui"); refreshUi(); },
      onUse: () => useSlot(i),
      hint: isOpen("shop") ? "클릭해서 고른 뒤 아래 버튼으로 판매" : isOpen("smith") && isGear(entry.id) ? "클릭해서 고른 뒤 아래 버튼으로 분해" : usable ? `아래 단축칸(1~9)에 끌어다 놓을 수 있습니다${at ? ` · 지금 ${at}번` : ""}` : "",
      price: isOpen("shop") ? `판매가 ${(sellPrice(entry) * (entry.n || 1)).toLocaleString()}G${entry.n > 1 ? ` (개당 ${sellPrice(entry)}G)` : ""}` : "",
    });
    // a usable thing can be dragged onto the quick slots; the slot it sits in shows in the corner
    if (usable) { QS.dragSource(node, ["i", entry.id]); if (at) node.append(el("span", "qk", at)); }
    grid.append(node);
  }
  const det = $("#inv-detail");
  det.textContent = "";
  const entry = s.inv[G.sel];
  if (!entry) return;
  const d = it[entry.id];
  // on a touch screen there is no hovering, so the pane says everything the tooltip would
  if (touch()) itemTip(entry, det);
  else { const nm = el("div", "nm", itemName(entry)); nm.style.color = Art.RARITY_COL[entry.q || 0]; det.append(nm); }
  const btns = el("div", "btns");
  const add = (label, fn, off, gold) => { const b = el("button", gold ? "btn gold small" : "btn small", label); b.disabled = !!off; b.addEventListener("click", () => { hideTip(); fn(); }); btns.append(b); };
  if (d.type === "pot") add("사용", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "scroll" || d.type === "buff") add("읽기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "pet") add(s.pet === entry.id ? "돌려보내기" : "데리고 다니기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "food") add("먹기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "camp") add("모닥불 피우기", () => { act({ t: "use", id: entry.id }); closeWin("inv"); }, false, true);
  if (QS_USE.includes(d.type)) add("단축칸", () => QS.pick(["i", entry.id]));
  if (d.type === "fish") {
    add("굽기", () => { const id = entry.id; closeWin("inv"); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id, s: score })); }, !fireNear(), true);
    if (!fireNear()) btns.append(el("span", "ds", "모닥불 곁에서 구울 수 있습니다"));
  }
  if (isGear(entry.id)) {
    const off = (d.cls && d.cls !== s.cls) || s.lvl < d.req;
    if (d.type === "ring" && s.eq.ring1 && s.eq.ring2) {
      for (const k of ["ring1", "ring2"]) add(`${SLOT_NAME[k]}에 장착`, () => { act({ t: "eq", s: G.sel, k }); G.sel = -1; }, off, true);
    } else add("장착", () => { act({ t: "eq", s: G.sel }); G.sel = -1; }, off, true);
    if (isOpen("smith")) add("분해", () => { act({ t: "salv", s: G.sel }); G.sel = -1; Sound.play("salvage"); });
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
    add(`판매 ${each}G`, () => act({ t: "sell", s: G.sel, n: 1 }));
    if (entry.n > 1) add(`전부 판매 ${(each * entry.n).toLocaleString()}G`, () => act({ t: "sell", s: G.sel, n: entry.n }));
  }
  if (btns.children.length) det.append(btns);
}

// ── the character sheet ──
const STAT_GROUPS = [
  ["공격", [["공격력", "sword", (s) => s.atk], ["치명타", "target", (s) => `${s.crit}%`], ["치명 피해", "burst", (s) => `${s.critd}%`], ["공격 간격", "clock", (s) => `${(s.acd / 1000).toFixed(2)}초`], ["흡혈", "fang", (s) => `${s.ls}%`]]],
  ["방어", [["방어력", "shield", (s) => s.def], ["최대 HP", "heart", (s) => s.mhp], ["최대 MP", "drop", (s) => s.mmp]]],
  ["유틸", [["경험치 추가", "up", (s) => `${s.xpb}%`], ["아이템 발견", "gem", (s) => `${s.mf}%`], ["골드 획득", "coin", (s) => `+${s.goldb}%`], ["처치 수", "skull", (s) => s.kills.toLocaleString()]]],
  ["수련", [["힘", "sword", (s) => s.tr.str], ["체력", "heart", (s) => s.tr.vit], ["지력", "drop", (s) => s.tr.int], ["수호", "shield", (s) => s.tr.grd]]],
];
function renderChar(s) {
  const title = $("#char-title");
  title.textContent = "";
  title.append(iconImg(CLASS_ICON[s.cls] || "sword", "#e2c486"), s.name, el("small", "", `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`));
  for (const k of G.defs.slots) {
    const host = $(`#eq-${k}`);
    const g = s.eq[k];
    const slot = itemSlot(g, g ? { worn: true, onClick: () => { hideTip(); act({ t: "uneq", k }); Sound.play("ui"); }, hint: `${SLOT_NAME[k]} · 클릭하면 벗습니다` } : {});
    slot.id = `eq-${k}`;
    if (!g) { const ph = el("span", "ph"); ph.append(iconImg(SLOT_GLYPH[k])); slot.append(ph); slot.title = `${SLOT_NAME[k]} — 비어 있음`; }
    host.replaceWith(slot);
  }
  const st = $("#char-stats");
  st.textContent = "";
  for (const [name, rows] of STAT_GROUPS) {
    const grp = el("div", "grp");
    grp.append(el("h4", "", name));
    for (const [label, glyph, val] of rows) {
      const sp = el("span", "", label);
      sp.prepend(iconImg(glyph));
      sp.append(el("b", "", val(s)));
      grp.append(sp);
    }
    st.append(grp);
  }
  const pw = $("#char-sets");
  pw.textContent = "";
  const sets = Object.keys(G.defs.sets).filter((id) => setWorn(id));
  if (s.lg.length || sets.length) pw.append(section("고유 능력 · 세트", "gem"));
  for (const k of s.lg) pw.append(el("div", "lg", `◆ ${G.defs.legend[k][0].replace(/의$/, "")} — ${G.defs.legend[k][1]}`));
  for (const id of sets) {
    const worn = setWorn(id), set = G.defs.sets[id];
    pw.append(el("div", "st", `${set.name} 세트 ${worn}개`));
    for (const [n, list] of set.bonus) pw.append(el("div", worn >= n ? "st on" : "st off", `${n}세트: ${list.map(([a, v]) => statText(a, v)).join(", ")}`));
  }
  dollFrame = -1;
  drawPortrait(now());
}

// ── skills ──
function renderSkills(s) {
  const box = $("#skill-body");
  box.textContent = "";
  const wk = G.defs.wkinds[s.wk] || {};
  box.append(section("기본 공격", "sword"));
  const basic = el("div", "skill basic");
  const bi = el("img", "ic"); bi.alt = ""; bi.src = s.eq.weapon ? G.icons.url[s.eq.weapon.id] : iconUrl("sword");
  const bh = el("div", "hd");
  bh.append(el("b", "", `${wk.name || "공격"}`), el("kbd", "", "Space"), el("small", "", `간격 ${(s.acd / 1000).toFixed(2)}초 · 사거리 ${Math.round(s.range)}`));
  basic.append(bi, bh, el("p", "", "가장 가까운 적을 알아서 겨냥합니다. 끊지 않고 이어 치면 세 번째 타격이 강한 마무리 일격이 됩니다."));
  box.append(basic);
  box.append(section(`${G.defs.classes[s.cls].name} 스킬`, "book"));
  G.defs.skills[s.cls].forEach((sk, i) => {
    const locked = s.lvl < sk.lv;
    const row = el("div", "skill" + (locked ? " locked" : ""));
    const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(sk.id);
    const hd = el("div", "hd");
    const at = QS.keysOf(["s", i]);
    hd.append(el("b", "", sk.name), at ? el("kbd", "", at) : "", el("small", "mp", `MP ${sk.mp}`), el("small", "", `재사용 ${sk.cd / 1000}초`), el("small", "", locked ? `레벨 ${sk.lv}에 배웁니다` : `Lv.${sk.lv} 습득`), Growth.levelTag(s, i));
    if (i === G.defs.skills[s.cls].length - 1) row.classList.add("ult");
    // drag the icon (or the whole row) onto the quick slots; or tap the button, then a slot
    const put = el("button", "btn small qs-put", "단축칸");
    put.title = "누른 뒤 아래 단축칸(1~9)을 누르면 거기에 놓입니다";
    put.addEventListener("click", () => QS.pick(["s", i]));
    row.append(ic, hd, el("p", "", sk.desc), put);
    QS.dragSource(row, ["s", i]);
    box.append(row);
  });
  box.append(el("p", "hint", "스킬을 끌어다 아래 단축칸(1~9)에 놓으면 그 숫자 키로 씁니다. 칸끼리 끌어 바꾸고, 바깥에 놓거나 우클릭하면 비웁니다. 마지막 스킬은 궁극기입니다. 수련관에게서 스킬 레벨을 올리면 위력이 오르고 5·10레벨에 재사용 대기시간이 줄어듭니다. 자동사냥은 단축칸에 놓인 스킬을 칸 순서대로 씁니다."));
}

// ── waypoints ──
const bandText = (b) => (b ? `Lv.${b[0]}–${b[1]}` : "안전 지대");
function renderWarp(s) {
  const box = $("#warp-body");
  box.textContent = "";
  const here = G.map && G.map.id, can = stoneNear() || (G.near && G.near.role === "warp");
  box.append(el("p", "say", can ? "깨운 이동의 돌끼리는 한순간에 오갈 수 있다네. 어디로 가겠나?" : "이동의 돌 곁에서만 다른 돌로 건너갈 수 있습니다. 돌에 다가가 F를 누르세요."));
  const list = el("div", "list");
  for (const w of G.defs.waypoints || []) {
    const open = (s.wp || []).includes(w.id), cur = w.id === here;
    const row = el("div", "it wp" + (open ? "" : " locked") + (cur ? " cur" : "") + (G.warpPick === w.id ? " pick" : ""));
    const ic = el("span", "wpi"); ic.append(iconImg("stone", open ? "#8ad8ff" : "#6a6658"));
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `${bandText(w.band)} · ${cur ? "현재 위치" : open ? "이동 가능" : "아직 깨우지 않음"}`));
    row.append(ic, tx);
    if (!cur) {
      const b = el("button", open ? "btn gold small" : "btn small", "이동");
      b.disabled = !open || !can;
      b.addEventListener("click", () => { act({ t: "warp", to: w.id }); Sound.play("ui"); G.warpPick = null; });
      row.append(b);
    }
    list.append(row);
  }
  box.append(list);
  box.append(el("p", "hint", "새 맵의 이동의 돌에 다가가면 깨어납니다. 싸우는 중(3초 안에 맞음)에는 이동할 수 없습니다."));
}

// ── daily tasks ──
const rewardText = (r) => [r.gold ? `${r.gold.toLocaleString()}G` : "", r.xp ? `EXP ${r.xp.toLocaleString()}` : "", r.stone ? `강화석 ${r.stone}` : "", r.gear ? "희귀 이상 장비" : ""].filter(Boolean).join(" · ");
const clock = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000); return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; };
function renderDaily(s) {
  const box = $("#daily-body");
  box.textContent = "";
  const d = s.daily;
  if (!d) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const top = el("div", "daily-top");
  top.append(iconImg("cal", "#e2c486"), el("span", "", "매일 아침 6시에 새 과제"), el("b", "", ""));
  top.lastChild.id = "daily-clock";
  box.append(top);
  d.tasks.forEach((tk, i) => {
    const card = el("div", "dcard" + (tk.claimed ? " claimed" : tk.done ? " done" : ""));
    const hd = el("div", "dh");
    hd.append(el("b", "", tk.text), el("span", "", `${Math.min(tk.n, tk.need)} / ${tk.need}`));
    const bar = el("div", "bar"), f = el("i"); f.style.width = `${clamp((tk.n / tk.need) * 100, 0, 100)}%`; bar.append(f);
    const ft = el("div", "df");
    ft.append(el("small", "", rewardText(tk.reward)));
    const b = el("button", tk.done && !tk.claimed ? "btn gold small" : "btn small", tk.claimed ? "받음" : "받기");
    b.disabled = !tk.done || tk.claimed;
    b.addEventListener("click", () => { act({ t: "daily", i }); Sound.play("daily"); });
    ft.append(b);
    card.append(hd, bar, ft);
    box.append(card);
  });
  const all = d.tasks.every((tk) => tk.claimed);
  const chest = el("div", "dcard bonus" + (d.bonus ? " claimed" : all ? " done" : ""));
  const hd = el("div", "dh"); hd.append(el("b", "", "오늘의 보너스 상자"), el("span", "", d.bonus ? "받음" : all ? "열 수 있음" : "세 과제를 모두 마치면"));
  const ft = el("div", "df"); ft.append(el("small", "", rewardText(d.bonusReward || {})));
  const b = el("button", all && !d.bonus ? "btn gold small" : "btn small", d.bonus ? "받음" : "열기");
  b.disabled = !all || d.bonus;
  b.addEventListener("click", () => { act({ t: "daily", i: "bonus" }); Sound.play("daily"); });
  ft.append(b);
  chest.append(hd, ft);
  box.append(chest);
  box.append(el("p", "hint", "과제는 어디서든 받을 수 있습니다. 광장의 일일 의뢰 게시판 담당자에게서도 열 수 있습니다."));
  tickDaily(now());
}
function tickDaily(t) {
  const c = $("#daily-clock");
  if (c && G.dailyReset) { const v = `초기화까지 ${clock(G.dailyReset - t)}`; if (c.textContent !== v) c.textContent = v; }
}

// ── achievements and titles ──
function renderAchieve(s) {
  const box = $("#achieve-body");
  box.textContent = "";
  const all = G.defs.achievements || [], got = new Set(s.ach || []);
  const cats = [...new Set(all.map((a) => a.cat))];
  if (!G.achTab || (G.achTab !== "칭호" && !cats.includes(G.achTab))) G.achTab = cats[0];
  const head = el("div", "ach-top");
  head.append(iconImg("trophy", "#e2c486"), el("span", "", `업적 점수 ${s.pts || 0}`), el("small", "", `${got.size} / ${all.length}`));
  box.append(head);
  const tabs = el("div", "tabs");
  for (const c of [...cats, "칭호"]) {
    const n = c === "칭호" ? all.filter((a) => a.title && got.has(a.id)).length : all.filter((a) => a.cat === c && got.has(a.id)).length;
    const of = c === "칭호" ? all.filter((a) => a.title).length : all.filter((a) => a.cat === c).length;
    const b = el("button", G.achTab === c ? "on" : "", `${c} ${n}/${of}`);
    b.addEventListener("click", () => { G.achTab = c; Sound.play("tab"); refreshUi(); });
    tabs.append(b);
  }
  box.append(tabs);
  const list = el("div", "list");
  if (G.achTab === "칭호") {
    const worn = s.title;
    list.append(el("p", "hint", worn ? `지금 단 칭호: 「${(all.find((a) => a.id === worn) || {}).title}」` : "칭호를 달면 이름 위에 보이고, 희귀한 칭호는 능력치도 조금 올려 줍니다."));
    for (const a of all.filter((x) => x.title)) {
      const have = got.has(a.id), on = s.title === a.id;
      const row = el("div", "it ach" + (have ? " got" : " locked") + (on ? " on" : ""));
      const tx = el("div", "tx", `「${a.title}」`);
      tx.append(el("small", "", `${a.name} — ${a.desc}${a.bonus ? ` · ${a.bonus.map(([k, v]) => statText(k, v)).join(", ")}` : ""}`));
      row.append(tx);
      const b = el("button", on ? "btn small" : "btn gold small", on ? "떼기" : "달기");
      b.disabled = !have;
      b.addEventListener("click", () => { act({ t: "title", id: on ? "" : a.id }); Sound.play("ui"); });
      row.append(b);
      list.append(row);
    }
  } else {
    for (const a of all.filter((x) => x.cat === G.achTab)) {
      const have = got.has(a.id);
      const row = el("div", "it ach" + (have ? " got" : " locked"));
      const ic = el("span", "achi"); ic.append(iconImg(have ? "trophy" : "trophy", have ? "#ffd84a" : "#55524a"));
      const tx = el("div", "tx", a.name);
      tx.append(el("small", "", `${a.desc}${a.title ? ` · 칭호 「${a.title}」` : ""}${a.bonus ? ` (${a.bonus.map(([k, v]) => statText(k, v)).join(", ")})` : ""}`));
      row.append(ic, tx, el("em", "pts", `${a.pts}점`));
      list.append(row);
    }
  }
  box.append(list);
}

// ── the monster collection ──
const thumbs = new Map();
/** A monster's first frame shrunk into a 36-pixel square; unregistered ones are a dark silhouette. */
function mobThumb(k, lit) {
  const key = k + (lit ? "" : ":dark");
  if (thumbs.has(key)) return thumbs.get(key);
  const d = G.defs.mobs[k], c = document.createElement("canvas");
  c.width = c.height = 36;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  try {
    const img = SP.monsterSheet(d.sp || k, d.tint)[0];
    const s = Math.min(36 / img.width, 36 / img.height) * (img.width > 40 ? 1.1 : 1.15);
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, (36 - w) / 2, 36 - h + (img.width > 40 ? 2 : 3), w, h);
    if (!lit) { g.globalCompositeOperation = "source-in"; g.fillStyle = "#3a3846"; g.fillRect(0, 0, 36, 36); }
  } catch { /* an unknown sprite simply stays blank */ }
  const url = c.toDataURL();
  thumbs.set(key, url);
  return url;
}
function renderCollect(s) {
  const box = $("#collect-body");
  box.textContent = "";
  const col = G.defs.collection || {}, need = G.defs.colNeed || 30, maps = Object.fromEntries((G.defs.maps || []).map((m) => [m.id, m]));
  const regions = Object.keys(col);
  if (!G.colTab || !col[G.colTab]) G.colTab = regions[0];
  let total = 0, have = 0;
  for (const id of regions) for (const k of col[id].mobs) { total++; if ((s.mk[k] || 0) >= need) have++; }
  const head = el("div", "ach-top");
  head.append(iconImg("paw", "#e2c486"), el("span", "", `등록 ${have} / ${total}`), el("small", "", `완성 지역 ${(s.col || []).length} / ${regions.length}`));
  box.append(head);
  const tabs = el("div", "tabs");
  for (const id of regions) {
    const done = (s.col || []).includes(id);
    const b = el("button", (G.colTab === id ? "on" : "") + (done ? " done" : ""), maps[id] ? maps[id].name : id);
    b.addEventListener("click", () => { G.colTab = id; Sound.play("tab"); refreshUi(); });
    tabs.append(b);
  }
  box.append(tabs);
  const reg = col[G.colTab], done = (s.col || []).includes(G.colTab);
  const bonus = el("div", "col-bonus" + (done ? " done" : ""));
  bonus.append(el("b", "", done ? "지역 완성 보너스 적용 중" : "지역을 모두 채우면"), el("span", "", reg.bonus.map(([k, v]) => statText(k, v)).join(", ")));
  box.append(bonus);
  const grid = el("div", "col-grid");
  for (const k of reg.mobs) {
    const d = G.defs.mobs[k], n = s.mk[k] || 0, ok = n >= need;
    const cell = el("div", "col-cell" + (ok ? " ok" : ""));
    const im = el("img"); im.alt = ""; im.src = mobThumb(k, ok);
    const bar = el("div", "bar"), f = el("i"); f.style.width = `${clamp((n / need) * 100, 0, 100)}%`; bar.append(f);
    cell.append(im, el("b", "", ok ? d.name : n ? d.name : "???"), el("small", "", ok ? `Lv.${d.lv} · 등록됨` : `${n} / ${need}`), bar);
    cell.title = `${d.name} — ${ok ? "등록됨" : `${need}마리를 잡으면 등록됩니다`} (처치 ${n})`;
    grid.append(cell);
  }
  box.append(grid);
  box.append(el("p", "hint", `같은 몬스터를 ${need}마리 잡으면 도감에 등록됩니다. 광장의 수집가에게서도 열 수 있습니다.`));
}

// ── first steps ──
function tutTry(id) {
  const s = G.self, step = s && s.tut && G.defs.tutorial && G.defs.tutorial[s.tut.i];
  if (step && step.id === id) act({ t: "tut", s: id });
}
/** The first steps told for fingers: the server's hints name keyboard keys a phone does not have. */
const TUT_TOUCH = {
  talk: "광장 분수 앞의 관리자 엘더윈에게 걸어가, 아래에 뜨는 [▶ 관리자 엘더윈]을 누르세요.",
  equip: "메뉴 → 캐릭터에서 무기를 장착하세요.",
  bag: "메뉴 → 가방을 열어 보세요.",
  buy: "보급상 리나에게 다가가 [▶ 보급상 리나]를 누르고 빨간 물약을 사 보세요.",
  hunt: "동쪽 문으로 나가 바람초원에서 쌍두 토끼를 잡으세요. [공격] 버튼으로 치고, [자동]을 켜면 알아서 사냥합니다.",
  rest: "모닥불 곁에서 메뉴 → 앉기를 눌러 잠시 쉬면 체력이 빨리 차고 경험치 보너스를 얻습니다.",
  skill: "레벨 3이 되면 첫 스킬이 아래 빈 단축칸에 저절로 올라갑니다. 몬스터 곁에서 그 칸을 눌러 써 보세요.",
};
function tutCard(s) {
  const card = $("#tut"), steps = G.defs.tutorial || [], i = s.tut ? s.tut.i : steps.length, step = steps[i];
  const hide = !step || +localStorage.getItem("lumentale:tuthide") === i + 1;
  // on a wide screen the bag sits open in the side column from the start: nothing to press, so the step is done
  if (step && step.id === "bag" && !$("#w-inv").hidden && tutCard.bag !== i) { tutCard.bag = i; tutTry("bag"); }
  if (card.hidden !== hide) card.hidden = hide;
  if (hide) return;
  setOnce($("#tut-title"), `${i}`, (n) => n.append(step.title));
  $("#tut-n").textContent = `첫걸음 ${i + 1}/${steps.length}${step.need > 1 ? ` · ${s.tut.n}/${step.need}` : ""}`;
  const hint = (touch() && TUT_TOUCH[step.id]) || step.hint;
  if ($("#tut-hint").textContent !== hint) $("#tut-hint").textContent = hint;
  if (card.dataset.i !== String(i)) { card.dataset.i = String(i); card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop"); if (i > 0) Sound.play("ok"); }
}
$("#tut-x").addEventListener("click", () => { const s = G.self; if (s && s.tut) localStorage.setItem("lumentale:tuthide", String(s.tut.i + 1)); $("#tut").hidden = true; Sound.play("ui"); });

// ── the world event, the return scroll's cast bar, the arrival fade ──
function eventWidget(t) {
  const e = G.evt, box = $("#evt");
  if (!e || !G.defs.maps) { box.hidden = true; return; }
  const name = (id) => (G.defs.maps.find((m) => m.id === id) || {}).name || id;
  const live = e.phase === "on" || e.phase === "boss";
  let html;
  if (live) {
    html = [`<b>균열 침공 진행 중</b> · ${name(e.map)}`, `남은 ${clock(G.evtLeft - t)} · ${e.phase === "boss" ? "우두머리 출현!" : `웨이브 ${e.waves}/${(G.defs.event && G.defs.event.waves.length) || 3}`}`, e.mine ? `내 피해 ${e.mine.toLocaleString()}` : "피해를 주면 보상을 받습니다"];
  } else if (e.phase === "warn") html = [`<b>균열 침공 예고</b> · ${name(e.map)}`, `시작까지 ${clock(G.evtIn - t)}`];
  else html = [`다음 균열 침공 ${clock(G.evtNext - t)}`, name(e.nextMap)];
  if (e.top && e.top.length && (live || e.phase === "done")) html.push(e.top.map(([n, d], i) => `${i + 1}. ${n} ${d.toLocaleString()}`).join("  "));
  const v = html.map((h) => `<span>${h}</span>`).join("");
  if (box.dataset.v !== v) { box.dataset.v = v; box.innerHTML = v; }
  box.className = "frame" + (live ? " live" : e.phase === "warn" ? " warn" : "");
  box.hidden = false;
  document.body.classList.toggle("evt-live", live);
  if (G.evtPhase !== e.phase) {
    if (G.evtPhase !== undefined) {
      if (e.phase === "warn") { banner(`균열 침공 예고 · ${name(e.map)}`, true); Sound.play("rift_warn"); }
      else if (e.phase === "on") { banner(`균열 침공 시작! · ${name(e.map)}`, true); Sound.play("rift_start"); }
      else if (e.phase === "boss") { banner("균열의 우두머리 출현!", true); Sound.play("rift_boss"); }
      else if (e.phase === "done") banner("균열 침공 종료", true);
    }
    G.evtPhase = e.phase;
  }
}
$("#evt").addEventListener("click", () => {
  const e = G.evt, s = G.self;
  if (!e || !s) return;
  const target = e.phase === "idle" || e.phase === "done" ? e.nextMap : e.map;
  if ((s.wp || []).includes(target)) { G.warpPick = target; openWin("warp"); toast("이동의 돌 곁에서 균열 침공 지역으로 이동할 수 있습니다"); }
  else toast("그 지역의 이동의 돌을 아직 깨우지 않았습니다");
  Sound.play("ui");
});
function castBar(t) {
  const c = G.cast, box = $("#cast");
  if (!c || t > c.end + 200) { if (!box.hidden) box.hidden = true; if (c && t > c.end + 200) G.cast = null; return; }
  if (box.hidden) { box.hidden = false; $("#cast-name").textContent = "귀환 주문서"; }
  $("#cast-fill").style.width = `${clamp(((t - c.start) / (c.end - c.start)) * 100, 0, 100)}%`;
}
function fadeIn() {
  const f = $("#fade");
  f.hidden = true; void f.offsetWidth; f.hidden = false;
  setTimeout(() => { f.hidden = true; }, 700);
}

// ── shop, smith, trainer ──
function renderShop(s) {
  const it = G.defs.items, list = $("#shop-list");
  list.textContent = "";
  Growth.shopTop(list, s);
  for (const key of G.defs.shop) {
    const id = key[0] === "W" && key.length === 2 ? `w_${s.cls}_${key[1]}` : key;
    const d = it[id];
    if (d.cls && d.cls !== s.cls) continue;
    const row = el("div", "it");
    const img = el("img"); img.src = G.icons.url[id]; img.alt = "";
    const tx = el("div", "tx", d.name);
    tx.append(el("small", "", `${d.price.toLocaleString()}G · ${itemDesc({ id })}`));
    row.append(img, tx);
    const buy = (n) => { const b = el("button", "", n > 1 ? `×${n}` : "구매"); b.disabled = s.gold < d.price * n; b.addEventListener("click", () => act({ t: "buy", id: key, n })); row.append(b); };
    buy(1);
    if (d.type === "pot") buy(10);
    hoverTip(img, (h) => itemTip({ id }, h, { price: `${d.price.toLocaleString()}G` }));
    list.append(row);
  }
}
function renderSmith(s) {
  const it = G.defs.items, list = $("#smith-list");
  list.textContent = "";
  const stones = countItem("stone");
  let any = false;
  for (const k of G.defs.slots) {
    const g = s.eq[k];
    if (!g || !s.enh[k]) continue;
    any = true;
    const row = el("div", "it");
    const img = el("img"); img.src = G.icons.url[g.id]; img.alt = "";
    const tx = el("div", "tx", itemName(g));
    tx.style.color = Art.RARITY_COL[g.q || 0];
    row.append(img, tx);
    if (g.enh >= 10) tx.append(el("small", "", "최대 강화 단계입니다"));
    else {
      const c = s.enh[k];
      tx.append(el("small", "", `${SLOT_NAME[k]} · 성공률 ${G.defs.enh[g.enh]}% · ${c.gold.toLocaleString()}G · 강화석 ${c.stone}개 (보유 ${stones})`));
      const b = el("button", "", "강화");
      b.disabled = s.gold < c.gold || stones < c.stone;
      b.addEventListener("click", () => act({ t: "enh", k }));
      row.append(b);
    }
    hoverTip(img, (h) => itemTip(g, h, { worn: true }));
    list.append(row);
  }
  if (!any) list.append(el("div", "ds", "강화할 수 있는 장비를 착용하고 있지 않습니다."));
  void it;
}
function renderTrain(s) {
  const list = $("#train-list");
  list.textContent = "";
  $("#train-xp").textContent = `보유 경험치 ${s.xp.toLocaleString()} · 골드 ${s.gold.toLocaleString()}G`;
  list.append(section("능력치 수련", "person"));
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
  Growth.trainSkills(list, s);
}

// ── quests: a log on the left, the chosen entry on the right ──
function renderQuest(s) {
  const qs = G.defs.quests, mobs = G.defs.mobs, it = G.defs.items;
  const atElder = G.near && G.near.role === "elder";
  const body = $("#quest-body");
  body.textContent = "";
  const wrap = el("div", "qwin"), list = el("div", "qlist well"), det = el("div", "qdetail");
  wrap.append(list, det);
  body.append(wrap);
  const cur = Math.min(s.q.i, qs.length);
  // a main quest just handed in: show the next one rather than the finished page
  if (G.qCur !== undefined && G.qCur !== cur && G.qsel === `main:${G.qCur}`) G.qsel = `main:${cur}`;
  G.qCur = cur;
  const picks = Object.keys(mobs).filter((k) => !mobs[k].boss && !mobs[k].chest && mobs[k].lv <= s.lvl + 4 && (!s.bq || s.bq.k !== k)).sort((a, b) => mobs[b].lv - mobs[a].lv).slice(0, 4);
  const keys = [];
  const entry = (key, label, sub, cls) => {
    keys.push(key);
    const b = el("button", cls || "");
    b.dataset.k = key;
    b.append(el("span", "", label));
    if (sub) b.append(el("small", "", sub));
    b.addEventListener("click", () => { G.qsel = key; Sound.play("tab"); refreshUi(); });
    list.append(b);
  };
  list.append(el("div", "grp", "주요 의뢰"));
  if (qs[cur]) {
    const q = qs[cur];
    entry(`main:${cur}`, `${cur + 1}. ${q.title}`, s.q.st === 0 ? "새 의뢰" : s.q.n >= q.n ? "완료!" : `${s.q.n}/${q.n}`, s.q.st === 1 && s.q.n >= q.n ? "done" : "");
  }
  for (let i = cur - 1; i >= 0; i--) entry(`main:${i}`, `${i + 1}. ${qs[i].title}`, "완료", "past");
  list.append(el("div", "grp", "반복 의뢰"));
  if (s.bq) entry("bq", `${mobs[s.bq.k].name} 토벌`, s.bq.n >= s.bq.need ? "완료!" : `${Math.min(s.bq.n, s.bq.need)}/${s.bq.need}`, s.bq.n >= s.bq.need ? "done" : "");
  for (const k of picks) entry(`bq:${k}`, `${mobs[k].name}`, `Lv.${mobs[k].lv}`, "offer");
  list.append(el("div", "grp", "토벌 숙련"));
  const known = Object.keys(mobs).filter((k) => s.mk[k] && !mobs[k].chest).sort((a, b) => mobs[a].lv - mobs[b].lv);
  entry("mk", "숙련 기록", `${known.length}종`);
  if (!keys.includes(G.qsel)) G.qsel = qs[cur] ? `main:${cur}` : s.bq ? "bq" : "mk";
  for (const b of list.querySelectorAll("button")) b.classList.toggle("on", b.dataset.k === G.qsel);

  const goal = (label, n, need) => {
    const row = el("div", "q-goal"), bar = el("div", "bar"), f = el("i");
    f.style.width = `${clamp((n / need) * 100, 0, 100)}%`;
    bar.append(f);
    row.append(el("span", "", label), bar, el("b", "", `${Math.min(n, need)} / ${need}`));
    return row;
  };
  const button = (label, fn, ok) => {
    const btns = el("div", "btns");
    const b = el("button", "btn gold", label);
    b.disabled = !ok || !atElder;
    b.addEventListener("click", () => { fn(); Sound.play("quest"); });
    btns.append(b);
    if (!atElder) btns.append(el("span", "ds", "관리자 엘더윈 곁에서만 할 수 있습니다"));
    det.append(btns);
  };
  const [kind, arg] = G.qsel.split(":");
  if (kind === "main") {
    const i = +arg, q = qs[i], mob = mobs[q.mob];
    det.append(el("div", "q-title", `${i + 1}. ${q.title}`), el("p", "say", q.text));
    if (i < cur) { det.append(el("div", "q-reward", "완료한 의뢰입니다.")); return; }
    if (s.q.st === 1) det.append(goal(`Lv.${mob.lv} ${mob.name}`, s.q.n, q.n));
    else det.append(el("div", "q-goal", `목표: Lv.${mob.lv} ${mob.name} ${q.n}마리`));
    det.append(el("div", "q-reward", `보상: EXP ${q.xp.toLocaleString()} · ${q.gold.toLocaleString()}G · ${q.items.map(([id, n]) => `${it[id].name} ×${n}`).join(", ")}`));
    if (s.q.st === 0) button("의뢰 수락", () => act({ t: "quest", a: "accept" }), true);
    else button("의뢰 완료", () => act({ t: "quest", a: "done" }), s.q.n >= q.n);
  } else if (kind === "bq" && !arg) {
    const d = mobs[s.bq.k];
    det.append(el("div", "q-title", `반복 의뢰 — ${d.name} 토벌`));
    det.append(el("p", "say", `같은 몬스터 ${G.defs.bounty}마리를 잡을 때마다 보상을 받고, 곧바로 다시 시작됩니다. 지금까지 ${s.bn}회 완료 — 3회마다 강화석, 10회마다 룬이 붙습니다.`));
    det.append(goal(`Lv.${d.lv} ${d.name}`, s.bq.n, s.bq.need));
    det.append(el("div", "q-reward", `보상: EXP ${Math.round(d.xp * s.bq.need * 0.5).toLocaleString()} + 골드`));
    button("보고", () => act({ t: "bq", a: "done" }), s.bq.n >= s.bq.need);
  } else if (kind === "bq") {
    const d = mobs[arg];
    det.append(el("div", "q-title", `Lv.${d.lv} ${d.name} 토벌`));
    det.append(el("p", "say", `${d.name} ${G.defs.bounty}마리를 잡아 오면 보상을 주지. 다 잡으면 곧바로 같은 의뢰가 다시 시작된다네.${s.bq ? " (지금 받은 반복 의뢰와 바뀝니다)" : ""}`));
    det.append(el("div", "q-reward", `보상: EXP ${Math.round(d.xp * G.defs.bounty * 0.5).toLocaleString()} + 골드`));
    button(s.bq ? "이 의뢰로 바꾸기" : "의뢰 받기", () => act({ t: "bq", a: "take", k: arg }), true);
  } else {
    det.append(el("div", "q-title", "토벌 숙련"));
    det.append(el("p", "ds", "같은 몬스터를 많이 잡을수록 그 몬스터에게 주는 피해(단계당 +3%)와 얻는 경험치(+2%)가 늘어납니다."));
    const steps = G.defs.mastery;
    if (!known.length) det.append(el("p", "ds", "아직 기록이 없습니다."));
    for (const k of known) {
      const n = s.mk[k];
      let r = 0;
      while (r < steps.length && n >= steps[r]) r++;
      const row = el("div", "mk");
      row.append(el("span", "", mobs[k].name), el("b", "", "★".repeat(r) + "☆".repeat(steps.length - r)), el("small", "", r < steps.length ? `${n.toLocaleString()} / ${steps[r].toLocaleString()}` : `${n.toLocaleString()} · 최고 단계`));
      det.append(row);
    }
  }
}

// ── party ──
function hpBar(hp, mhp) {
  const bar = el("div", "bar hp"), f = el("i");
  f.style.width = `${clamp((hp / mhp) * 100, 0, 100)}%`;
  bar.append(f);
  return bar;
}
function classMark(cls) { const c = el("span", "cg"); c.append(iconImg(CLASS_ICON[cls] || "sword", "#e2c486")); return c; }
function renderPartyHud() {
  const box = $("#party-hud");
  box.textContent = "";
  G.party.forEach(([eid, name, cls, lvl, hp, mhp, where], i) => {
    if (eid === G.you) return;
    const row = el("div", "pm frame" + (i === 0 ? " lead" : "") + (where ? " away" : ""));
    const nm = el("span", "nm", name);
    nm.append(el("small", "", where ? `Lv.${lvl} · ${where}` : `Lv.${lvl}`));
    row.append(iconImg(CLASS_ICON[cls] || "sword", "#e2c486"), nm, hpBar(hp, mhp));
    row.title = `${name} · Lv.${lvl} ${G.defs.classes[cls].name}${where ? ` · ${where}` : ""}`;
    box.append(row);
  });
}
function memberRow(eid, name, cls, sub, lead, bar) {
  const row = el("div", "pframe" + (eid === G.you ? " me" : ""));
  row.append(classMark(cls), el("b", lead ? "lead" : "", name), el("small", "", sub));
  if (bar) row.append(bar);
  return row;
}
function renderParty() {
  const box = $("#party-body");
  box.textContent = "";
  if (!G.defs || !G.self) return;
  const s = G.self, mine = G.party.length > 0;
  box.append(section(mine ? `파티원 ${G.party.length} / ${G.defs.partyMax}` : "파티 없음", "party"));
  if (mine) {
    G.party.forEach(([eid, name, cls, lvl, hp, mhp, where], i) => {
      box.append(memberRow(eid, name, cls, `Lv.${lvl} ${G.defs.classes[cls].name}${where ? ` · ${where}` : ""}`, i === 0, hpBar(hp, mhp)));
    });
    box.append(el("p", "hint", "★ 파티를 처음 만든 사람 · 함께 잡으면 모두가 경험치와 전리품을 얻고, 인원이 많을수록 총 경험치가 늘어납니다."));
  } else {
    box.append(memberRow(G.you, s.name, s.cls, `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`, false, hpBar(G.me.hp, s.mhp)));
    box.append(el("p", "hint", "주변의 모험가를 초대해 보세요. 강한 적과 정예 몬스터는 파티로 잡는 것이 훨씬 빠릅니다."));
  }
  box.append(section("주변 모험가", "person"));
  const inParty = new Set(G.party.map((m) => m[0]));
  const list = el("div", "list");
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || inParty.has(eid)) continue;
    near++;
    const row = el("div", "it");
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `Lv.${w.lvl} ${G.defs.classes[w.cls].name}${w.guild ? ` · ‹${w.guild}›` : ""}`));
    row.append(classMark(w.cls), tx);
    const b = el("button", "", w.party ? "다른 파티" : "초대");
    b.disabled = !!w.party || G.party.length >= G.defs.partyMax;
    b.addEventListener("click", () => { act({ t: "pinv", e: eid }); Sound.play("ui"); });
    row.append(b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  if (mine || look()?.party) {
    const btns = el("div", "btns");
    const b = el("button", "btn", "파티 탈퇴");
    b.addEventListener("click", () => act({ t: "pleave" }));
    btns.append(b);
    box.append(btns);
  }
  if (isOpen("party")) keepIn("party");
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
  const key = JSON.stringify([s.guild, s.gm, s.gmates, s.gold, [...G.who].map(([e, w]) => [e, w.name, w.lvl, w.guild])]);
  if (box.dataset.k === key && box.childElementCount) return;
  box.dataset.k = key;
  const typed = box.querySelector("input")?.value || "";
  box.textContent = "";
  if (!s.guild) {
    box.append(section("길드 창설", "banner"));
    box.append(el("p", "say", `길드를 세우면 이름 위에 길드명이 걸리고, 길드원끼리만 보이는 채팅을 쓸 수 있습니다. 같은 길드원 곁에서 사냥하면 한 명당 경험치 +${Math.round(G.defs.guildXp * 100)}% (최대 3명).`));
    const row = el("div", "btns");
    const input = el("input"); input.maxLength = 10; input.placeholder = "길드 이름 (2~10자)"; input.autocomplete = "off"; input.value = typed;
    const b = el("button", "btn gold", `창설 ${G.defs.guildCost.toLocaleString()}G`);
    b.disabled = s.gold < G.defs.guildCost;
    b.addEventListener("click", () => { if (input.value.trim()) act({ t: "gcreate", name: input.value.trim() }); Sound.play("ui"); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") b.click(); });
    row.append(input, b);
    box.append(row, el("p", "hint", "다른 길드에 들어가려면 그 길드원에게 초대를 받으세요."));
    if (isOpen("guild")) keepIn("guild");
    return;
  }
  box.append(el("div", "q-title", `‹${s.guild}›`));
  box.append(section(`접속 중인 길드원 ${s.gmates.length}명`, "banner"));
  for (const [eid, name, cls, lvl, where, gm] of s.gmates) box.append(memberRow(eid, name, cls, `Lv.${lvl} ${G.defs.classes[cls].name} · ${where}`, gm));
  box.append(el("p", "hint", "★ 길드장 · 채팅창의 길드 탭에서 쓰거나 /g 메시지로 길드 채팅"));
  box.append(section("주변 모험가", "person"));
  const list = el("div", "list");
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || w.guild) continue;
    near++;
    const row = el("div", "it");
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `Lv.${w.lvl} ${G.defs.classes[w.cls].name}`));
    const b = el("button", "", "초대");
    b.addEventListener("click", () => { act({ t: "ginv", e: eid }); Sound.play("ui"); });
    row.append(classMark(w.cls), tx, b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  const btns = el("div", "btns");
  const b = el("button", "btn", "길드 탈퇴");
  b.addEventListener("click", () => act({ t: "gleave" }));
  btns.append(b);
  box.append(btns);
  if (isOpen("guild")) keepIn("guild");
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
    if (G.defs.classes[r.cls]) row.prepend(iconImg(CLASS_ICON[r.cls] || "sword", "#e2c486"));
    box.append(row);
  });
  if (isOpen("rank")) keepIn("rank");
}

const cgauge = $("#cgauge");
function hudTick(t) {
  eventWidget(t);
  castBar(t);
  if (isOpen("daily")) tickDaily(t);
  const s = G.self;
  if (!s) return;
  // the class gauge (classgauge.js); a fault there must never stop the frame
  try { drawClassGauge(cgauge, s, G.defs, t); } catch (err) { if (!hudTick.warned) { hudTick.warned = true; console.warn("class gauge:", err); } }
  QS.tick(t);
  if (tip.from && (!tip.from.isConnected || tip.from.closest("[hidden]"))) hideTip();
  if (isOpen("char")) drawPortrait(t);
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
  const names = ["공격력 증가", "이동속도 증가", `모닥불의 온기: 경험치 +${s.warm}%`, s.food ? G.defs.items[s.food].name : "음식", "둔화: 이동속도 감소", "화상: 지속 피해", "중독: 지속 피해", "공격의 주문서: 공격력 +10%", "방어의 주문서: 받는 피해 -12%", "경험의 주문서: 경험치 +20%"];
  const bad = (i) => i >= 4 && i < 7;
  const left = (ms) => (ms > 90000 ? `${Math.ceil(ms / 60000)}분` : `${Math.ceil(ms / 1000)}`);
  const shownB = G.buffEnd.map((e, i) => (e > t ? [i, left(e - t)] : null)).filter(Boolean);
  const want = shownB.map(([i, l]) => `${i}:${l}`).join("|");
  if (buffs.dataset.v !== want) {
    buffs.dataset.v = want;
    buffs.textContent = "";
    for (const [i, l] of shownB) {
      const sp = el("span", bad(i) ? "bad" : i >= 7 ? "scr" : "", l);
      sp.title = names[i];
      sp.prepend(iconImg(BUFF_ICON[i], bad(i) ? "#ff9a8a" : i >= 7 ? "#9ad8ff" : "#e2c486"));
      buffs.append(sp);
    }
  }
}

// ───────────────────────────── title & creation ─────────────────────────────

// the mirror under the portrait: a new look later, in town, for gold
Looks.installMirror({
  act, toast, sound: (k) => Sound.play(k),
  look: () => { const w = G.who && G.who.get(G.you); return w ? w.look : []; },
  gold: () => (G.self ? G.self.gold : 0), town: () => !!(G.map && G.map.safe),
  get cost() { return (G.defs && G.defs.lookCost) || 500; },
});
// the title, log-in, server list and character creation live in lobby.js
Lobby.init({
  connect, disconnect, act, stopGame, toast,
  playing: () => G.playing, channel: () => channel,
  isOpen: () => !!ws && ws.readyState === WebSocket.OPEN,
});

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
  } else Lobby.frame(t, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for automated play-testing
window.__game = { G, act, S3, go: (wx, wy) => { G.path = pathTo(wx, wy); return !!G.path; } };
