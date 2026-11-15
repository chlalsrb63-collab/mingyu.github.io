/**
 * The connection and the messages (split from client.js): the socket to a channel (`connect open
 * disconnect act`, `ws channel`), `onMessage` (welcome, errors, ranks), `stopGame`, `loadMap`,
 * the 10 Hz snapshot decoder `onSnap` (field order in docs/systems/wire-and-client.md), entity
 * reconciling `sync` and `entityPos`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import { iconImg, CLASS_ICON } from "./uiicons.js";
import * as Growth from "./growth.js";
import * as Wardrobe from "./wardrobe_ui.js";
import * as QS from "./quickslots.js";
import * as SideQ from "./sidequests.js";
import * as SkillFx from "./skillfx.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import * as Lobby from "./lobby.js";
import * as Sky from "./sky.js";
import * as Dim from "./dimrift.js";
import * as Gather from "./gather.js";
import * as Radar from "./radar.js";
import * as Housing from "./housing.js";
import * as Coop from "./coop.js";
import { G, el, $, resize, $$, tg, text, now, T } from "./state.js";
import { JOB_ALIAS, onEvent, onGain } from "./events.js";
import { countItem, usePotion, castSkill } from "./actions.js";
import { snd } from "./update.js";
import { addChat, chatTo, hoverTip, toast, showTip, hideTip, touch, closeWin, banner, isOpen } from "./windows.js";
import { itemSlot, isGear, sellPrice, useSlot } from "./items.js";
import { section, refreshUi, resetPurse, hudBars } from "./hud.js";
import { openStats, openTree } from "./win_char.js";
import { doorFade } from "./win_world.js";
import * as Charms from "./charms.js";
import { renderRank, renderParty, renderGuild, renderPartyHud, renderInvite } from "./win_social.js";

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
export let ws = null;
let retry = 0;
let wantOnline = false;
export let channel = Lobby.lastChannel();
let connT = 0;

/** Open (or reopen) the socket to channel `ch`, after `delay` ms. */
export function connect(ch = channel, delay = 0) {
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
export function disconnect() {
  clearTimeout(connT);
  wantOnline = false;
  if (ws) { const old = ws; ws = null; try { old.close(); } catch { /* already closed */ } }
}
export function act(action) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
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
        G.icons = Growth.icons(Art.buildIcons(G.defs.items));
        Growth.init({ G, act, el, iconImg, itemSlot, section, countItem, usePotion, isGear: (id) => isGear(id), sellPrice: (e) => sellPrice(e) });
        Wardrobe.init({ G, act, el, hoverTip });
        QS.init({ G, act, el, toast, castSkill, useSlot, countItem, showTip, hideTip, touch, addChat });
        SideQ.init({ G, act, el, Sound });
        // jobs and stats (J3): the C window's 능력치 tab and 카이's window; K's 무기 · 스킬 / 전직의 길 and 아르센's window
        StatWin.init({ G, act, el, section, Sound, redraw: refreshUi, openStats });
        JobTree.init({ G, act, el, section, Sound, hoverTip, redraw: refreshUi, openTree });
      }
      G.players.clear(); G.mobs.clear(); G.drops.clear(); G.fires.clear(); G.bobs.clear(); G.who.clear();
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
export const channelName = () => Lobby.label(channel);
/** Out of the world, back to the lobby (the socket is already closed or closing). */
export function stopGame() {
  G.playing = false;
  G.auto = false;
  resetPurse(); // the next character's purse starts without a +N
  $("#hud").hidden = true; $("#dead").hidden = true; G.me.dead = false; $("#tip").hidden = true;
  for (const w of $$("#windows .window, #panel .window")) if (!w.hidden) closeWin(w.id.slice(2));
  resize();
  tg.clearRect(0, 0, text.width, text.height);
}

function loadMap(m) {
  // through a house door (into or out of an interior): a warm fade and the door's latch and bell
  if (G.map && G.map.id !== m.id && (G.map.theme === "interior" || m.theme === "interior")) { doorFade(); Sound.play("door"); }
  G.map = m;
  G.path = null;
  G.comboWeapon = null;
  S3.loadMap(m);
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
  const p = addChat(c.m, "whisper", c.w === 1 ? `[귓속말] ${c.n}` : `[귓속말 → ${c.n}]`);
  p.addEventListener("click", () => chatTo(`/w ${c.n} `));
  if (c.w === 1) { G.lastWhisper = c.n; Sound.play("ui"); }
}
function onSnap(s) {
  const t = now();
  const me = G.me;
  if (s.map) loadMap(s.map);
  if (s.dn) Sky.setSky(s.dn, !!s.map);
  if (s.map || s.me[5]) { me.x = s.me[0]; me.y = s.me[1]; me.dir = s.me[6]; if (s.me[10] !== undefined) me.aimI = s.me[10]; }
  me.hp = s.me[2]; me.mp = s.me[3]; me.sit = !!s.me[7];
  // me[11]: ms left on the dash (Space) cooldown; a 0 just after pressing may predate the press reaching the server
  if (s.me[11] > 0) G.dashEnd = t + s.me[11]; else if (s.me[11] === 0 && t - (G.dashSent || 0) > 500) G.dashEnd = 0;
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
  sync(G.mobs, s.M, (e, r) => { e.k = r[1]; e.tx = r[2]; e.ty = r[3]; e.dir = r[4]; e.hp = r[5]; e.el = r[6]; e.tr = r[7] || []; e.bph = r[10] | 0; e.bst = r[11] | 0; }, t, G.gone);   // [10, 11]: a scripted boss's phase and state (mobart.js artKind)
  sync(G.drops, s.D, (e, r) => { e.it = r[1]; e.tx = r[2]; e.ty = r[3]; e.q = r[4]; }, t);
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
  // a rift on another map (c.ev) is news for the 시스템 tab only, not the 전체 log
  const far = (c) => c.ev && G.map && c.ev !== G.map.id;
  if (s.chat) for (const c of s.chat) c.w ? whisperLine(c) : c.sys ? addChat(c.m, far(c) ? "sys far" : "sys") : c.g ? addChat(c.m, "guild", `[길드] ${c.n}`) : c.pt ? addChat(c.m, "party", `[파티] ${c.n}`) : addChat(c.m, "", c.n);
  // a field boss called out, or a wave of the rift breaking in
  if (s.chat) for (const c of s.chat) if (c.sys && !far(c) && /나타났습니다/.test(c.m)) Sound.play(/균열/.test(c.m) ? "elite" : "announce");
  if (s.gain) for (const gn of s.gain) onGain(gn);
  if (s.toast) for (const m of s.toast) toast(m);
  // (a member's place, [7…], changes every step: only who they are and how they fare redraw the party)
  G.fb = s.fb || null;
  const pk = JSON.stringify((s.party || []).map((r) => r.slice(0, 7)));
  if (pk !== G.partyKey) { if (G.partyKey !== undefined && (s.party || []).length > (G.party || []).length) Sound.play("party"); G.partyKey = pk; G.party = s.party || []; renderPartyHud(); if (isOpen("party")) renderParty(); }
  const gi = s.ginv ? s.ginv.join("|") : null;
  if ((s.pinv || null) !== G.pinv || gi !== G.ginv) { G.pinv = s.pinv || null; G.ginv = gi; renderInvite(); }
  Gather.onSnap(s);                            // `ng`: the nodes you have spent here (gather.js)
  Dim.onSnap(s);                               // 차원 균열: HUD, ready check, shrines and orbs (dimrift.js)
  Housing.onSnap(s);                           // a house of one's own: its bar, the ghost, the windows (housing.js)
  Coop.onSnap(s);                              // 협동 아르바이트: cj C cr (coop.js)
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

export function entityPos(id) {
  if (id === G.you) return G.me;
  if (typeof id === "string" && id.startsWith("npc:")) { const n = G.map && G.map.npcs.find((q) => "npc:" + q.id === id); return n ? { x: n.x * T + 8, y: n.y * T + 12, h3: 1.32 } : null; }
  return G.players.get(id) || G.mobs.get(id) || G.gone.get(id) || null;
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupNet() {
  setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send("__ping"); }, 30000);
}
