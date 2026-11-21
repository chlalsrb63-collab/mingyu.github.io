/**
 * The connection and the messages (split from client.js): the socket to a channel (`connect open
 * disconnect`; the handle `ws channel`, `act` and `entityPos` live in wire.js), `onMessage` (welcome,
 * errors, ranks), `stopGame`, `loadMap`, the 10 Hz snapshot decoder `onSnap` (field order in
 * docs/systems/wire-and-client.md), entity reconciling `sync`.
 */

import * as Art from "./art.js";
import { API } from "./account.js";
import { Sound } from "./audio.js";
import { MELEE_FX_WEAPON, MELEE_FEEL } from "./swing.js";
import * as S3 from "./scene2d.js";
import { iconImg, CLASS_ICON } from "./uiicons.js";
import * as Growth from "./growth.js";
import * as Wardrobe from "./wardrobe_ui.js";
import * as FairMkt from "./fairmkt.js";
import * as Intro from "./intro.js";
import * as QS from "./quickslots.js";
import * as SideQ from "./sidequests.js";
import * as SkillFx from "./skillfx.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import * as Lobby from "./lobby.js";
import * as Sky from "./sky.js";
import * as NpcLife from "./npclife.js";
import * as Dim from "./dimrift.js";
import * as Gather from "./gather.js";
import * as Radar from "./radar.js";
import * as Housing from "./housing.js";
import * as Coop from "./coop.js";
import { hideBriefing, renderBriefing } from "./coop-briefing.js";
import * as Alba from "./alba.js";
import * as SX from "./sxwin.js";
import { setJobDefs } from "./jobpal.js";
import { G, el, $, resize, $$, tg, text, now } from "./state.js";
import { ws, channel, setSocket, setChannel, act, channelName, entityPos } from "./wire.js";
import { JOB_ALIAS, onEvent, onGain } from "./events.js";
import { countItem, usePotion, castSkill } from "./actions.js";
import { snd } from "./update.js";
import { addChat, chatTo, chatHint, hoverTip, toast, showTip, hideTip, touch, closeWin, banner, isOpen, saveOpen, restoreOpen, phoneShut } from "./windows.js";
import { itemSlot, isGear, sellPrice, useSlot } from "./items.js";
import { refreshUi, resetPurse, hudBars } from "./hud.js";
import { section } from "./hudkit.js";
import { openStats, openTree } from "./win_char.js";
import { doorFade } from "./win_world.js";
import * as Charms from "./charms.js";
import { renderRank, renderParty, renderGuild, renderPartyHud, renderInvite, partyDisplayKey } from "./win_social.js";
import * as Buddy from "./buddy.js";

// ───────────────────────────── connection ─────────────────────────────

// Use the same server that issued the account session, including on a home LAN.
const WS_BASE = API || location.origin;

// the socket handle and the channel live in wire.js (a leaf, so windows can send without importing this file)
export { ws, channel, act, channelName, entityPos } from "./wire.js";
let retry = 0;
let wantOnline = false;
let connT = 0;

/** Open (or reopen) the socket to channel `ch`, after `delay` ms. */
export function connect(ch = channel, delay = 0) {
  clearTimeout(connT);
  if (ws) { const old = ws; setSocket(null); wantOnline = false; try { old.close(); } catch { /* already closed */ } }
  setChannel(ch);
  wantOnline = true;
  if (delay) { connT = setTimeout(open, delay); return; }
  open();
}
function open() {
  const url = new URL(`/ws/${channel}`, WS_BASE);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  const sock = new WebSocket(url);
  setSocket(sock);
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
export function disconnect() {
  clearTimeout(connT);
  wantOnline = false;
  if (ws) { const old = ws; setSocket(null); try { old.close(); } catch { /* already closed */ } }
}

// ───────────────────────────── messages ─────────────────────────────

function onMessage(msg) {
  switch (msg.type) {
    case "need_char":
      Lobby.needChar(msg.starters);
      break;
    case "welcome":
      G.you = msg.you;
      if (!G.defs) {
        G.defs = msg.defs;
        // jobs: everyone's `cls` (who, party, guild, rank) is a job id now; the old class ids still
        // reach us from rows saved before, so both name the job
        G.defs.classes = {};
        for (const id of Object.keys(G.defs.jobs)) G.defs.classes[id] = { name: G.defs.jobs[id].name, wk: G.defs.jobs[id].wk };
        for (const [old, id] of Object.entries(JOB_ALIAS)) if (!G.defs.classes[old]) G.defs.classes[old] = G.defs.classes[id];
        for (const id of Object.keys(G.defs.jobs)) { const k = G.defs.jobs[id].wk[0] || "dagger"; CLASS_ICON[id] = k === "book" ? "book" : k; }
        Sky.configure(G.defs.sky);
        setJobDefs(G.defs);
        G.icons = Growth.icons(Art.buildIcons(G.defs.items, G.defs.runes));
        Growth.init({ G, act, el, iconImg, itemSlot, section, countItem, usePotion, isGear: (id) => isGear(id), sellPrice: (e) => sellPrice(e) });
        Wardrobe.init({ G, act, el, hoverTip });
        QS.init({ G, act, el, toast, castSkill, useSlot, countItem, showTip, hideTip, touch, addChat });
        SideQ.init({ G, act, el, Sound });
        // jobs and stats (J3): the C window's 능력치 tab and 카이's window; K's 무기 · 스킬 / 전직의 길 and 아르센's window
        StatWin.init({ G, act, el, section, Sound, redraw: refreshUi, openStats });
        JobTree.init({ G, act, el, section, Sound, hoverTip, redraw: refreshUi, openTree });
      }
      G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear(); G.who.clear();
      SX.reset();                                // a fresh world: no request, trade or game carried over (sxwin.js)
      $("#hud").hidden = false;
      if (Lobby.welcome(msg) === "switch" && G.playing) {
        addChat(`${channelName()}(으)로 이동했습니다.`, "sys");
      }
      // the friend list is not in the snapshot: ask for it once per channel
      act({ t: "fr", a: "list" });
      if (!G.playing) {
        G.playing = true;
        resize();
        addChat(`테일즈테일즈에 오신 것을 환영합니다! (${channelName()})`, "sys");
        addChat("관리자 엘더윈에게 말을 걸어 첫 의뢰를 받아 보세요. 조작법은 H (도움말)에 있습니다.", "sys");
      }
      break;
    case "snap": onSnap(msg); break;
    case "rank": renderRank(msg.list); break;
    // the friend list (the vault's, relayed by the room: room.ts friends): f rows, i asked me, o I asked
    case "fr":
      G.friends = { f: msg.f || [], i: msg.i || [], o: msg.o || [] };
      if (msg.msg) toast(msg.msg);
      if (isOpen("party")) renderParty();
      break;
    case "error":
      if (msg.fatal) {
        disconnect();
        Lobby.fatal(msg);
      } else if (msg.error === "stag" || msg.error === "wsw") {
        /* quiet refusals: reeling from a blow, a swap too soon */
      } else if (Lobby.createError(msg.error)) {
        /* shown on the creation page */
      } else {
        Charms.onError(msg.error);       // a refused board request goes back where it was (charms.js)
        toast(msg.error);
        Sound.play("no");
      }
      break;
  }
}
/** Out of the world, back to the lobby (the socket is already closed or closing). */
export function stopGame() {
  G.playing = false;
  G.impactAt = 0;
  G.auto = false;
  Coop.onSnap({ cj: 0 });
  Buddy.reset();
  hideBriefing();
  NpcLife.load(null, null);
  resetPurse(); // the next character's purse starts without a +N
  $("#hud").hidden = true; $("#dead").hidden = true; G.me.dead = false; $("#tip").hidden = true;
  saveOpen(true);   // which windows were open, before they close (windows.js)
  for (const w of $$("#windows .window, #panel .window")) if (!w.hidden) closeWin(w.id.slice(2));
  phoneShut();
  Alba.reset();   // a shift's window would stay over the lobby (alba.js)
  resize();
  tg.clearRect(0, 0, text.width, text.height);
}

/**
 * The scene's copy of a map: on the 장날 map outside market hours its stalls stand closed (decor.js stallShut) and the
 * merchants (NPCs flagged `fair`, 64-fair-market.js) are not there: `m.npcs` is the list for now, `m.all` the whole one.
 * Map data and collision stay as the server sent them; only the drawn prop changes.
 */
function sceneMap(m) {
  G.stallsOpen = Sky.fairOn();
  if (!G.defs?.fair || m.id !== G.defs.fair.map) return m;
  m.all ||= m.npcs;
  m.npcs = G.stallsOpen ? m.all : m.all.filter((n) => !n.fair);
  if (G.stallsOpen) return m;
  return { ...m, big: m.big.map((b) => (b.t === "prop" && b.k === "stall" ? { ...b, k: "stallShut" } : b)) };
}
function loadMap(m) {
  // through a house door (into or out of an interior): a warm fade and the door's latch and bell
  if (G.map && G.map.id !== m.id && (G.map.theme === "interior" || m.theme === "interior")) { doorFade(); Sound.play("door"); }
  G.map = m;
  G.impactAt = 0;
  G.path = null;
  G.comboWeapon = null;
  NpcLife.load(m, G.defs);
  S3.loadMap(sceneMap(m));
  Radar.loadMap(m);
  Gather.loadMap(m);                           // its gathering nodes stand up as scene props (gather.js)
  G.fb = null;
  G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear();
  G.texts.length = 0;
  G.snapCam = true;
  $("#mini-name").textContent = m.band ? `${m.name} · Lv.${m.band[0]}–${m.band[1]}` : m.name;
  $("#mini-name").title = $("#mini-name").textContent;
  Sound.bgm(m.id, m.bgm, m.theme); Sound.setTheme(null); snd.bossT = 0;
  banner(m.name, true);
  // walking into a band above you: say so once, at the door
  const lv = G.self && G.self.lvl;
  if (m.band && lv && lv < m.band[0]) toast(`권장 레벨 Lv.${m.band[0]}–${m.band[1]} — 지금(Lv.${lv})은 위험합니다. 파티를 맺거나 입구 근처에서만 사냥하세요.`);
  closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train"); closeWin("job");
}

/** A whisper line (63-social-weekly.js chatFor): w 1 = from `n`, w 2 = my own copy, sent to `n`; a click answers. */
function whisperLine(c) {
  const p = addChat(c.m, "whisper", c.w === 1 ? `[귓속말] ${c.n}` : `[귓속말 → ${c.n}]`, c.it);
  p.addEventListener("click", () => chatTo(`/w ${c.n} `));
  if (c.w === 1) { G.lastWhisper = c.n; Sound.play("whisper_in"); chatHint(); }
}
function onSnap(s) {
  const t = now();
  const me = G.me;
  if (s.dn) Sky.setSky(s.dn, !!s.map);
  if (s.map) loadMap(s.map);
  else if (s.dn && G.map && G.stallsOpen !== Sky.fairOn() && G.map.id === G.defs?.fair?.map) S3.loadMap(sceneMap(G.map));   // 장날 opens or closes here
  me.serverX = s.me[0]; me.serverY = s.me[1];
  if (s.nl) NpcLife.onLegs(s.nl);
  if (s.nw) NpcLife.onWhere(s.nw);
  if (s.mov) Radar.onOverview(s.mov);           // 월드맵 → 전체 지도: another map's layout, once on request (mapov)
  if (s.map || s.me[5]) { me.x = s.me[0]; me.y = s.me[1]; me.dir = s.me[6]; if (s.me[10] !== undefined) me.aimI = s.me[10]; }
  me.hp = s.me[2]; me.mp = s.me[3]; me.sit = !!s.me[7]; me.carry = s.me[12] | 0;   // [12]: what is held instead of the weapon (carry.js)
  // me[11]: ms left on the dash (Space) cooldown; a 0 just after pressing may predate the press reaching the server
  if (s.me[11] > 0) G.dashEnd = t + s.me[11]; else if (s.me[11] === 0 && t - (G.dashSent || 0) > 500) G.dashEnd = 0;
  const dead = !!s.me[4];
  if (dead !== me.dead) { me.dead = dead; $("#dead").hidden = !dead; Sound.play(dead ? "death" : "revive"); if (dead) G.auto = false; }

  if (s.who) {
    G.who.clear();
    for (const [eid, name, cls, lvl, look, at, wt, party, wq, we, pet, wk, guild, title, cos, wl, , buddy] of s.who) {
      // the outfit (cosmetic codes) and the weapon's legendary/set key ride along in `gear`
      G.who.set(eid, { name, cls, lvl, look, gear: { at, wt, wq, we, wk, ...Wardrobe.wireGear(G.defs, cos, wl) }, party, guild, title, pet: pet || null, buddy: !!buddy });
    }
    if (isOpen("party")) renderParty();
    if (isOpen("guild")) renderGuild();
  }
  sync(G.players, s.P, (e, r) => { e.tx = r[1]; e.ty = r[2]; e.dir = r[3]; e.dead = !!r[4]; e.hp = r[5]; e.mhp = r[6]; e.sit = !!r[7]; e.carry = r[9] | 0; }, t);
  sync(G.fires, s.F || [], (e, r) => { e.tx = r[1]; e.ty = r[2]; e.x = r[1]; e.y = r[2]; }, t);
  sync(G.mobs, s.M, (e, r) => { e.k = r[1]; e.tx = r[2]; e.ty = r[3]; e.dir = r[4]; e.hp = r[5]; e.hk = (s.HK && s.HK[r[0]]) || 1; e.el = r[6]; e.tr = r[7] || []; e.bph = r[10] | 0; e.bst = r[11] | 0; e.stg = r[12] | 0; e.enchant = G.defs.elements?.types[s.enc?.[r[0]]]; e.cb = s.cb?.[r[0]] | 0; }, t, G.gone);   // [10, 11]: a scripted boss's phase and state, [12]: its stagger gauge left %
  sync(G.drops, s.D, (e, r) => { e.it = r[1]; e.tx = r[2]; e.ty = r[3]; e.q = r[4]; }, t);
  G.ailments.clear();
  for (const [id, rows] of s.ail || []) G.ailments.set(id, rows.map(([kind, left, stacks]) => [kind, t + left * 100, stacks]));
  G.elementSpeed = s.elspd ?? 1;
  G.prefixSpeed = s.pspd ?? 1;   // a prefix power speeding the walk right now (53-prefix-guard.js)
  SkillFx.onSnap(s, G, t);

  if (s.self) {
    // the block list sits in the party window (win_social.js friendBox)
    const bk = JSON.stringify(s.self.blk || []);
    if (bk !== G.blkKey) { G.blkKey = bk; if (isOpen("party")) setTimeout(renderParty, 0); }
    G.self = s.self;
    // jobs: `cls` names the job (the class names below read defs.classes, rebuilt from defs.jobs); `skLv` the
    // mastery of the weapon in hand; weapon skills (J2): `sk` = [[id, MP now, cooldown left ms, usable 1/0]…]
    s.self.cls = s.self.job;
    s.self.skLv = s.self.wm ? s.self.wm[Math.max(0, G.defs.wkOrder.indexOf(s.self.wk))][0] : 1;
    G.skw = new Map((s.self.sk || []).map((r) => [r[0], r]));
    for (const r of s.self.sk || []) G.cdEnd[r[0]] = t + r[2];
    G.streak = { n: s.self.streak[0], end: t + s.self.streak[1] };
    G.buffEnd = s.self.buffs.map((ms) => t + ms);
    if (s.self.daily) G.dailyReset = t + s.self.daily.reset;
    if (s.self.recall > 0 && !G.cast) G.cast = { start: t - (G.defs.recallMs - s.self.recall), end: t + s.self.recall };
    refreshUi();
    restoreOpen();                               // the windows open when this character last left (once per game, windows.js)
    Growth.onSelf(s.self);
    Intro.maybeStart(s.self);
    if (isOpen("guild")) renderGuild();
  }
  if (s.fm) FairMkt.onFm(s.fm);              // a 장날 merchant's list, when asked for or after a purchase (fairmkt.js)
  if (s.ev) {
    const wait = G.impactAt - t;
    const delayedHits = wait > 8 ? new Set() : null;
    const map = G.map, socket = ws;
    for (const e of s.ev) {
      const swing = e[0] === "h" ? e[8] : null;
      const localSwing = swing && swing[0] === G.you && MELEE_FX_WEAPON[swing[1]] === G.comboWeapon && swing[1] !== 7;
      const hit = e[0] === "h" && !e[4] && e[2] > 0 && (swing ? localSwing : !MELEE_FEEL[G.comboWeapon]);
      if (delayedHits && (hit || (e[0] === "k" && delayedHits.has(e[1])))) {
        if (hit) delayedHits.add(e[1]);
        setTimeout(() => {
          if (G.playing && G.map === map && ws === socket) onEvent(e, now());
        }, wait);
      } else onEvent(e, t);
    }
  }
  for (const [id, m] of G.gone) if (t - m.goneT > 1500) G.gone.delete(id);
  if (s.chat) for (const c of s.chat) c.w ? whisperLine(c) : c.sys ? addChat(c.m, "sys") : c.g ? addChat(c.m, "guild", `[길드] ${c.n}`, c.it) : c.pt ? addChat(c.m, "party", `[파티] ${c.n}`, c.it) : addChat(c.m, "", c.n, c.it);   // it: linked items (windows.js chatLink)
  // a field boss called out
  if (s.chat) for (const c of s.chat) if (c.sys && /나타났습니다/.test(c.m)) Sound.play("announce");
  if (s.gain) for (const gn of s.gain) onGain(gn);
  if (s.toast) for (const m of s.toast) toast(m);
  // Keep live positions for the map. Only visible party fields redraw the cards.
  G.fb = s.fb || null;
  const oldPartySize = G.party.length;
  G.party = s.party || [];
  const pk = partyDisplayKey(G.party), partyChanged = pk !== G.partyKey;
  if (partyChanged) {
    if (G.partyKey !== undefined && G.party.length > oldPartySize) Sound.play("party");
    G.partyKey = pk;
    renderPartyHud();
  }
  if ((partyChanged || s.who) && isOpen("party")) renderParty();
  const gi = s.ginv ? s.ginv.join("|") : null;
  if ((s.pinv || null) !== G.pinv || gi !== G.ginv) { G.pinv = s.pinv || null; G.ginv = gi; renderInvite(); }
  Gather.onSnap(s);                            // `ng`: the nodes you have spent here (gather.js)
  Dim.onSnap(s);                               // 레이드던전: HUD, ready check, shrines and orbs (dimrift.js)
  Housing.onSnap(s);                           // a house of one's own: its bar, the ghost, the windows (housing.js)
  Coop.onSnap(s);                              // 협동 아르바이트: cj C cr (coop.js)
  renderBriefing(s, G.defs?.coop, G.you);
  Alba.onSnap(s);                              // 일일 아르바이트: ab (alba.js)
  Buddy.onSnap(s, t);
  SX.onSnap(s);                                // sx: a request for me, the trade window, 가위바위보 (sxwin.js)
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

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupNet() {
  Buddy.setup();
  setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send("__ping"); }, 30000);
}
