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
 *
 * This file is the entry: start-up and the main loop. The client lives beside it:
 *   state.js   G, helpers, screen layout        net.js      socket, onMessage, onSnap
 *   events.js  onEvent, floating text           input.js    keys, pointer, touch stick
 *   actions.js attack, skills, aim, interact     update.js   per-frame update, auto-hunt
 *   overlay.js render + the text overlay         windows.js  WIN, open/close/placement, toasts, chat, tips
 *   items.js   item text, tips, slots            hud.js      bars, hotbar, tracker, draw/refreshUi, hudTick
 *   win_char.js · win_world.js · win_shop.js · win_social.js   the windows' renderers
 * Each module's start-up wiring is its `setup<Name>()`, called below where that code
 * used to stand, so listeners and DOM tweaks happen in the same order as before.
 */

// (every outside import first and in its old order: the order modules first run)

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
import * as SideQ from "./sidequests.js";
import * as SkillFx from "./skillfx.js";
import { drawWeaponGauge, gaugeTip } from "./weapongauge.js";
import * as Mastery from "./mastery.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import { installFrames } from "./frames.js";
import * as Lobby from "./lobby.js";
import * as Assets from "./assetlib.js";
import * as Sky from "./sky.js";
import * as Dim from "./dimrift.js";
import * as Radar from "./radar.js";
import * as Housing from "./housing.js";
import * as Life from "./life.js";
import * as Gather from "./gather.js";
import * as Board from "./board.js";
import * as Coop from "./coop.js";
import * as Charms from "./charms.js";
import * as Info from "./infocard.js";
import { resize, world, $, G, el, $$, now } from "./state.js";
import { act, entityPos, connect, disconnect, stopGame, channel, ws, setupNet } from "./net.js";
import { pathTo, setupInput, toggleAuto, walkToDoor } from "./input.js";
import { update } from "./update.js";
import { render } from "./overlay.js";
import { floatText } from "./events.js";
import { openWin, closeWin, isOpen, hoverTip, toast, closeAll, setupWindows } from "./windows.js";
import { itemSlot, setupItems } from "./items.js";
import { draw, hudTick, setupHud } from "./hud.js";
import { setupWinChar, openTree, openStats } from "./win_char.js";
import { setupWinWorld } from "./win_world.js";
import { setupWinSocial } from "./win_social.js";

// approved external images (public/assets/manifest.json) before anything is drawn; an
// empty or missing manifest leaves every look code-drawn
await Assets.ready();
installFrames();
setupNet();
addEventListener("resize", resize);
S3.init(world);
resize();
Mini.mount($("#minigame"));
Dim.init({ G, S3, Sound, act, openWin, closeWin, isOpen: (id) => isOpen(id) });
Housing.init({ G, S3, Sound, act, el, iconImg, itemSlot: (e, o) => itemSlot(e, o), openWin, closeWin, isOpen: (id) => isOpen(id), draw: (id, k, fn) => draw(id, k, fn), hoverTip: (d, f) => hoverTip(d, f), toast: (m) => toast(m) });
Life.init({ G, S3, Sound, el, iconImg, entityPos: (id) => entityPos(id), draw: (id, k, fn) => draw(id, k, fn), renderPouch: (b, s, o) => Gather.renderPouch(b, s, o), pouchKey: (s) => Gather.pouchKey(s), renderJobs: (b, s) => Board.renderLife(b, s) });
// gathering nodes, the channel and its "반짝!", the 재료 주머니 (gather.js)
Gather.init({ G, S3, Sound, act, el, iconImg, itemSlot: (e, o) => itemSlot(e, o), toast: (m) => toast(m), entityPos: (id) => entityPos(id),
  floatText: (...a) => floatText(...a), pathTo: (x, y) => pathTo(x, y), stopAuto: () => { if (G.auto) toggleAuto(); } });
// 협동 아르바이트: the lobby card, the shift HUD, its props and the work key (coop.js)
Coop.init({ G, S3, Sound, act, toast: (m) => toast(m), entityPos: (id) => entityPos(id) });
Dim.bindUi();
// every menu button wears its glyph above its word; the auto-hunt button wears one too
for (const b of $$("#menu button")) { const g = MENU_ICON[b.dataset.win || b.id.slice(2)]; if (g) b.prepend(iconImg(g)); }
$("#b-auto").prepend(iconImg(MENU_ICON.auto));
setupInput();
setupWindows({ walkToDoor });
setupItems();
Charms.setup();
setupHud();
setupWinChar();
setupWinWorld();
setupWinSocial();
// detail cards (infocard.js): every glyph that stands for a word answers a click with what it is and how to use it
Info.setup({ openTree, openStats, openWin });

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
    Gather.tick(t);
    Coop.tick(t);
    render(t, dt);
    Radar.draw(t);
    Radar.drawWin(t);
    hudTick(t);
  } else Lobby.frame(t, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for automated play-testing
window.__game = { G, act, S3, go: (wx, wy) => { G.path = pathTo(wx, wy); return !!G.path; }, openWin, closeWin, closeAll };
