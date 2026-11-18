/**
 * The window system (split from client.js): `WIN` ids (`section.window#w-<id>` in index.html),
 * `openWin closeWin toggleWin closeAll closeTop isOpen`, placement in the safe zone (`zone homeOf
 * placeWin keepIn front`, fold to tabs `fold unfold layTabs`, saved spots), the phone drawer,
 * toasts and banners, the chat log (`addChat`), and tooltips (`showTip hideTip hoverTip`).
 * The side panel (`PANEL dockPanel panelWin setDock`): on a desktop the small-info windows (bag, character, quests,
 * party, guild, daily, week) open one at a time in the side column under the minimap (the quest tracker when none
 * is open); the ones that need room (skills, life, dex, collection, achievements, ranking, settings, help …) float
 * over the world by default. Each has a 분리 / 붙이기 button in its title bar that switches it (remembered per
 * window in `lumentale:dock:<id>`); on a phone they all float as before.
 * The smartphone menu (phone.js, the default on a desktop; 설정 → 화면 → 메뉴 방식 turns the side panel back on) is the same
 * machinery with no side column: every DOCKABLE window is a PANEL one, `#panel` moves into the phone's screen, and opening
 * one pulls the phone out (`phoneHook`); Esc closes the app, then the phone.
 */

import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as Emo from "./emoticons.js";
import { gaugeTip } from "./weapongauge.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import * as Lobby from "./lobby.js";
import * as Dim from "./dimrift.js";
import * as Radar from "./radar.js";
import * as Track from "./track.js";
import * as Housing from "./housing.js";
import { $, VP, G, clamp, $$, el, setLayoutHook } from "./state.js";
import { act, channelName } from "./net.js";
import { wpWoke } from "./overlay.js";
import { refreshUi } from "./hud.js";
import { tutTry } from "./win_world.js";
import { K } from "./keymap.js";
import { resetHints } from "./hints.js";
import { itemName, itemTip, itemRarity } from "./items.js";
import { RARITY_COL } from "./art.js";
import * as Info from "./infocard.js";
import { renderParty, renderGuild } from "./win_social.js";

// (the radar and the map window live in radar.js)

// ───────────────────────────── HUD & windows ─────────────────────────────

export const touch = () => document.body.classList.contains("touch");
const WIN = ["inv", "char", "skill", "shop", "smith", "quest", "rank", "talk", "help", "settings", "train", "party", "buddy", "guild", "warp", "daily", "achieve", "collect", "dex", "bank", "costume", "dim", "rc", "map", "house", "deco", "hstore", "life", "job", "craft", "board", "charm", "juana", "week", "trophy", "alba", "trade", "fairmkt"];
export const winEl = (id) => $(`#w-${id}`);
/** On a phone the bag lives in the drawer, so it always counts as open; on a desktop it opens in the side panel. */
export const isOpen = (id) => (id === "inv" && compact()) || !winEl(id).hidden;
const compact = () => VP.lay !== "full";

/**
 * The side panel (desktop, 바람의나라-style): these windows open in the side column under the minimap, one at
 * a time — a hotkey or menu button shows that window there in place of the quest tracker, the same key again
 * (or Esc) brings the tracker back. dockPanel() (run after every layout pass) moves them into #panel and marks
 * them `.docked`; on a phone they go back to #windows and float (the bag stays in the drawer). Shops, the smith,
 * the stations and the house chest put the bag in the panel when they open (selling needs it)
 * and take it away again when they close, if they were what brought it.
 */
/** Every window that may sit in the side panel; which of them do right now is `PANEL` (below). */
const DOCKABLE = ["inv", "char", "skill", "quest", "party", "buddy", "guild", "life", "daily", "week", "achieve", "collect", "dex", "rank", "settings", "help", "charm", "trophy", "alba"];
/** Float over the world by default (they need room); the rest of DOCKABLE opens in the panel. The player's choice wins (`lumentale:dock:<id>`: "1" panel, "0" float). */
const FLOATS = ["skill", "life", "alba", "charm", "trophy", "rank", "achieve", "collect", "dex", "settings", "help"];
const DOCK_KEY = (id) => `lumentale:dock:${id}`;
const dockWant = (id) => {
  if (id === "inv") return true;   // the bag is the panel's own window (shops put it there)
  let v = null; try { v = localStorage.getItem(DOCK_KEY(id)); } catch { /* private mode */ }
  return v === "1" || (v !== "0" && !FLOATS.includes(id));
};
/** The windows in the side panel right now: none on a phone, else DOCKABLE as the defaults and the title-bar buttons say. Refilled in place. */
export const PANEL = new Set();
const syncPanel = () => { PANEL.clear(); if (VP.lay === "full") for (const id of DOCKABLE) if (VP.phone || dockWant(id)) PANEL.add(id); };
/** phone.js plugs in here (it imports this file, not the other way round): pull the phone out / put it away, is it out, the app on its screen, where the player stands. */
export const phoneHook = { open() {}, close() {}, out: () => false, app() {}, edge: () => null };
let autoPhone = false;   // a shop pulled the phone out for the bag: it goes back in with the bag
const BAG_WITH = ["shop", "smith", "craft", "hstore"];
const panelBox = $("#panel"), winBox = $("#windows");
let panelId = null, autoBag = false, wasDocked = null;
const trackBox = $("#quest-track"), sideBox = $("#side"), menuBox = $("#menu");
/** Where #panel sits: on the phone's screen (the app area) in phone mode, else in the side column under the minimap with the quest tracker as its first child. */
function homePanel(inPhone) {
  if (inPhone) { $("#ph-app").append(panelBox); sideBox.insertBefore(trackBox, menuBox); }
  else { sideBox.insertBefore(panelBox, menuBox); panelBox.prepend(trackBox); }
}
/** Is this window docked (in the side panel, or the bag in the phone drawer)? Docked windows are never placed, dragged or folded. */
const paned = (id) => winEl(id).classList.contains("docked");
/** The window shown in the side panel, or null (the quest tracker). */
export const panelWin = () => panelId;
function setPanel(id) { panelId = id; panelBox.classList.toggle("on", !!id); phoneHook.app(id); }
/** The title bar's 분리 / 붙이기 button shows what a press does. */
function popBtn(id) {
  const b = winEl(id).querySelector(".pop");
  if (!b) return;
  b.dataset.dock = paned(id) ? "1" : "0";
  b.title = paned(id) ? "별도 창으로 띄우기" : "패널에 붙이기";
  b.setAttribute("aria-label", b.title);
}
/** Put one window where PANEL says: into the side panel (taking the panel's place) or out over the world, open or not; the node is moved, not rebuilt, so its state stays. */
function seat(id) {
  const w = winEl(id), want = PANEL.has(id);
  if (want === paned(id)) return;
  const bd = w.querySelector(".body"), top = bd.scrollTop;
  if (want) {
    if (!w.hidden) { if (panelId && panelId !== id) closeWin(panelId); autoBag = false; setPanel(id); }
    w.classList.remove("mini", "top"); w.title = ""; w.style.zIndex = "";
    panelBox.append(w); w.classList.add("docked");
    layTabs();
  } else {
    if (panelId === id) setPanel(null);
    w.classList.remove("docked"); winBox.append(w);
    if (!w.hidden) { placeWin(id); front(id); }
  }
  bd.scrollTop = top;
  popBtn(id);
  syncMenu();
}
/** The title-bar button: this window into the panel (on) or out over the world (off), remembered. */
function setDock(id, on) {
  try { localStorage.setItem(DOCK_KEY(id), on ? "1" : "0"); } catch { /* private mode */ }
  syncPanel();
  seat(id);
}
function dockPanel() {
  const full = VP.lay === "full", mode = full ? (VP.phone ? "phone" : "panel") : "float";
  if (mode === wasDocked) return;
  const from = wasDocked;   // null on the first pass: nothing is open yet
  wasDocked = mode;
  homePanel(mode === "phone");
  syncPanel();
  const inv = winEl("inv");
  if (full) {
    // the top open window that belongs in the panel keeps its place there, the other panel ones close; the floating ones stay over the world
    const open = [...PANEL].filter((id) => id !== "inv" && !winEl(id).hidden)
      .sort((a, b) => (+winEl(b).style.zIndex || 0) - (+winEl(a).style.zIndex || 0));
    for (const id of DOCKABLE) {
      if (id === "inv") continue;
      const w = winEl(id);
      if (PANEL.has(id)) {
        w.classList.remove("mini", "top"); w.title = ""; w.style.zIndex = "";
        panelBox.append(w); w.classList.add("docked");
        if (open.indexOf(id) > 0) w.hidden = true;
      } else {
        w.classList.remove("docked");
        if (w.parentNode !== winBox) winBox.append(w);
        if (from && !w.hidden) { placeWin(id); front(id); }   // it left the phone / the panel (the 메뉴 방식 changed): float where it belongs
      }
      popBtn(id);
    }
    inv.hidden = true;   // the bag opens with I (or a shop) on a desktop
    setPanel(open[0] || null);
    layTabs();
    if (mode === "phone" && open[0] && from) phoneHook.open();   // changed live with a window open: the phone comes out with it
    if (mode !== "phone") phoneHook.close();
  } else {
    const keep = panelId && panelId !== "inv" ? panelId : null;
    for (const id of DOCKABLE) {
      if (id === "inv") continue;
      const w = winEl(id);
      w.classList.remove("docked"); winBox.append(w);
      popBtn(id);
    }
    inv.hidden = false;
    setPanel(null);
    if (keep) { placeWin(keep); front(keep); }
    phoneHook.close();
  }
  syncMenu();
}
const drawerOpen = () => document.body.classList.contains("drawer");
function setDrawer(on) {
  if (on === drawerOpen()) return;
  document.body.classList.toggle("drawer", on);
  Sound.play(on ? "open" : "close");
  if (!on && G.sel >= 0) { G.sel = -1; refreshUi(); }
}
/** Per window, the key of what it last drew: a window is rebuilt only when what it shows has changed. */
export const shown = {};
let zTop = 20;
const WIN_KEY = (id) => `lumentale:win2:${id}`;
const roomy = () => VP.lay === "full";
/** Where windows may sit: over the viewport on a desktop, anywhere on a phone. */
const winArea = () => (VP.lay === "land" ? [Math.max(320, innerWidth - 300), innerHeight] : [VP.zw, VP.h]);
/**
 * Window placement. Windows live in a safe zone: the world viewport (never over the side column or the
 * dock), 4 px in from its edges, less a strip along the bottom while folded windows sit there. CSS caps
 * their size to it (--zone-w / --zone-h / --tabs-h, hud.css); this code keeps their position in it.
 * Two or more windows: a new one goes where it belongs (or where the player last dragged it); if that
 * covers another window it tries beside each open window, then one row of all of them; when they do not
 * fit side by side, the newest stays open and the windows it would cover fold into title tabs along the
 * bottom-right of the zone (click a tab, or press its hotkey, to unfold it — that folds what it covers).
 */
const EDGE = 4, GAP = 8, TAB_H = 30;
const folded = (id) => winEl(id).classList.contains("mini");
const floated = () => WIN.filter((id) => !paned(id) && !winEl(id).hidden);
const tabsOut = () => floated().filter(folded);
function zone() {
  const [W, H] = winArea();
  let x0 = EDGE, x1 = W - EDGE;
  // the smartphone out beside the player: windows keep to the other side of it
  const ph = VP.phone && phoneHook.edge();
  if (ph) { if (ph[0] + ph[1] > VP.w) x1 = Math.max(x0 + 160, Math.min(x1, ph[0] - GAP)); else x0 = Math.min(x1 - 160, Math.max(x0, ph[1] + GAP)); }
  return [x0, EDGE, x1, H - EDGE - (tabsOut().length ? TAB_H : 0)];
}
const boxOf = (id) => { const w = winEl(id); return [parseFloat(w.style.left) || 0, parseFloat(w.style.top) || 0, w.offsetWidth, w.offsetHeight]; };
const hits = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** Where a window first opens, before the player moves it: inside the viewport, the shop and smith on the right next to the bag. */
function homeOf(id, w, h) {
  const [x0, y0, x1, y1] = zone(), top = y0 + 4;
  // the phone out on the right of the player: the right-hand windows (shops …) take the left side instead, never the player's own spot
  const ph = VP.phone && phoneHook.edge(), right = ph && ph[0] + ph[1] > VP.w ? x0 + 4 : x1 - w - 4, mid = (x0 + x1 - w) / 2;
  switch (id) {
    case "char": case "shop": case "smith": case "train": case "job": case "bank": case "house": case "hstore": case "juana": case "fairmkt": return [right, top];
    case "deco": return [x0 + 4, top + 32];
    case "skill": case "party": case "guild": case "daily": case "week": return [x0 + 4, top + 32];
    case "talk": return [mid, y1 - h - 52];
    default: return [mid, Math.max(top, (y0 + y1 - h) / 2 - 30)];
  }
}
function clampPos(x, y, w, h) {
  const [x0, y0, x1, y1] = zone();
  return [Math.round(clamp(x, x0, Math.max(x0, x1 - w))), Math.round(clamp(y, y0, Math.max(y0, y1 - h)))];
}
/** Keep a window inside the safe zone (after a drag, a resize, or its content changing size). */
export function keepIn(id, x, y) {
  if (paned(id)) return;
  const w = winEl(id);
  if (w.hidden) return;
  if (folded(id)) { layTabs(); return; }
  [x, y] = clampPos(x ?? (parseFloat(w.style.left) || 0), y ?? (parseFloat(w.style.top) || 0), w.offsetWidth, w.offsetHeight);
  w.style.left = `${x}px`;
  w.style.top = `${y}px`;
}
/** The folded windows: title tabs in a row along the bottom-right of the zone, the latest folded rightmost. */
function layTabs() {
  const tabs = tabsOut().sort((a, b) => (+winEl(b).dataset.fold || 0) - (+winEl(a).dataset.fold || 0));
  document.documentElement.style.setProperty("--tabs-h", tabs.length ? TAB_H + "px" : "0px");
  const [W, H] = winArea();
  let x = W - EDGE - (VP.lay === "port" ? 52 : 0);
  for (const id of tabs) {
    const w = winEl(id);
    x -= w.offsetWidth;
    w.style.left = `${Math.max(EDGE, x)}px`;
    w.style.top = `${H - EDGE - w.offsetHeight}px`;
    x -= 4;
  }
  for (const id of floated()) if (!folded(id)) keepIn(id);
}
let foldN = 0;
function fold(id) {
  const w = winEl(id);
  if (folded(id)) return;
  w.classList.add("mini");
  w.dataset.fold = ++foldN;
  w.title = "눌러서 다시 펼치기";
  if (tip.from && w.contains(tip.from)) hideTip();
  layTabs();
}
function unfold(id) {
  const w = winEl(id);
  if (!folded(id)) return;
  w.classList.remove("mini");
  w.title = "";
  layTabs();
  placeWin(id);
  front(id);
}
function savedPos(id) {
  if (!roomy()) return null;
  try { const p = JSON.parse(localStorage.getItem(WIN_KEY(id))); return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) ? p : null; } catch { return null; }
}
function placeWin(id) {
  const w = winEl(id), ww = w.offsetWidth, wh = w.offsetHeight, [x0, y0, x1, y1] = zone();
  const want = savedPos(id) || (roomy() ? homeOf(id, ww, wh) : [(x0 + x1 - ww) / 2, y0 + 4]);
  let pos = clampPos(want[0], want[1], ww, wh);
  const others = floated().filter((o) => o !== id && !folded(o));
  const free = (p) => others.every((o) => !hits([p[0], p[1], ww, wh], boxOf(o)));
  if (!free(pos)) {
    // beside one of the open windows (level with it, or at the top), the nearest such place to where it wanted to be
    const fits = (p) => p[0] >= x0 && p[0] + ww <= x1 && p[1] >= y0 && p[1] + wh <= y1;
    const cands = [];
    for (const o of others) {
      const [ox, oy, ow] = boxOf(o);
      for (const y of [oy, y0 + 4]) cands.push([ox + ow + GAP, y], [ox - ww - GAP, y]);
    }
    const ok = cands.filter((p) => fits(p) && free(p));
    const d = (p) => Math.hypot(p[0] - pos[0], p[1] - pos[1]);
    if (ok.length) pos = ok.reduce((a, b) => (d(b) < d(a) ? b : a));
    else {
      // all of them in one row, left to right as they stand, the new one on the side it opens on
      const row = others.slice().sort((a, b) => boxOf(a)[0] - boxOf(b)[0]);
      const right = pos[0] + ww / 2 > (x0 + x1) / 2;
      if (right) row.push(id); else row.unshift(id);
      const size = (o) => (o === id ? [ww, wh] : boxOf(o).slice(2));
      const total = row.reduce((a, o) => a + size(o)[0], 0) + GAP * (row.length - 1);
      if (total <= x1 - x0 && row.every((o) => size(o)[1] <= y1 - y0)) {
        let x = right ? x1 - total : x0;
        for (const o of row) {
          const [ow, oh] = size(o), y = Math.round(clamp(o === id ? pos[1] : boxOf(o)[1], y0, y1 - oh));
          if (o === id) pos = [Math.round(x), y];
          else { winEl(o).style.left = `${Math.round(x)}px`; winEl(o).style.top = `${y}px`; }
          x += ow + GAP;
        }
      } else {
        // no room side by side: the newest stays, what it would cover folds into a tab
        for (const o of others) if (hits([pos[0], pos[1], ww, wh], boxOf(o))) fold(o);
        pos = clampPos(want[0], want[1], ww, wh);
      }
    }
  }
  keepIn(id, pos[0], pos[1]);
}
function front(id) {
  if (paned(id)) return;
  const w = winEl(id);
  if (+w.style.zIndex !== zTop) w.style.zIndex = ++zTop;
  // windows live in z 21–35: past that, re-stack them in their order, so they never climb over the
  // HUD cues (36), the minigame (40), the drag ghost (60) or the tooltip (80)
  if (zTop > 34) {
    const open = WIN.filter((o) => !paned(o) && winEl(o).style.zIndex).sort((a, b) => winEl(a).style.zIndex - winEl(b).style.zIndex);
    zTop = 20;
    for (const o of open) winEl(o).style.zIndex = ++zTop;
  }
  for (const o of WIN) if (!paned(o)) winEl(o).classList.toggle("top", o === id);
}
function syncMenu() { for (const b of $$("#menu button[data-win]")) b.classList.toggle("on", b.dataset.win === "inv" && compact() ? drawerOpen() : isOpen(b.dataset.win)); }
export function openWin(id) {
  if (id === "inv" && compact()) { setDrawer(true); tutTry("bag"); refreshUi(); syncMenu(); return; }
  const w = winEl(id), was = !w.hidden;
  if (paned(id) && panelId !== id) {
    // the side panel shows one window: this one takes the place of whatever was there
    if (panelId) closeWin(panelId);
    autoBag = false; autoPhone = false;
    setPanel(id);
    const bd = w.querySelector(".body"); if (bd) bd.scrollTop = 0;
  }
  if (VP.phone && paned(id)) phoneHook.open();   // an app of the smartphone: it comes out (if it is not already) and shows it
  w.hidden = false;
  delete shown[id];
  if (id === "inv") tutTry("bag");
  if (id === "rank") { $("#rank-list").textContent = "불러오는 중…"; act({ t: "rank" }); }
  if (id === "settings") Lobby.refreshSettings();
  if (id === "party") renderParty();
  if (id === "guild") { act({ t: "glist" }); renderGuild(); }
  if (id === "map") Radar.opened();
  refreshUi();
  // a shop, the smith, a station or the house chest: the bag goes in the panel (to sell, salvage, craft from, store); first,
  // so a phone it pulls out is there before the window is placed (the window then keeps to the other side of the player)
  if (BAG_WITH.includes(id) && !compact() && panelId !== "inv") { const had = phoneHook.out(); openWin("inv"); autoBag = true; autoPhone = VP.phone && !had; }
  if (!paned(id)) {
    if (was && folded(id)) unfold(id);
    else if (!was) placeWin(id);
    front(id);
  }
  syncMenu();
}
/** Hooks a module sets for its own window being closed (the trade window cancels the trade: sxwin.js). */
export const onClose = {};
export function closeWin(id) {
  if (id === "inv" && G.invNew) G.invNew.clear();   // the 새 tags last until the bag is put away
  if (id === "inv" && compact()) {
    if (tip.from && winEl("inv").contains(tip.from)) hideTip();
    if (G.sel >= 0) { G.sel = -1; refreshUi(); }
    setDrawer(false);
    syncMenu();
    return;
  }
  const w = winEl(id);
  if (w.hidden) return;
  w.hidden = true;
  if (panelId === id) { setPanel(null); autoBag = false; }
  if (id === "inv" && G.sel >= 0) { G.sel = -1; refreshUi(); }
  if (folded(id)) { w.classList.remove("mini"); w.title = ""; layTabs(); }
  Housing.onWinClose(id);
  if (onClose[id]) onClose[id]();
  if (id === "train") StatWin.reset();
  if (id === "job" || id === "skill") JobTree.reset();
  if (tip.from && w.contains(tip.from)) hideTip();
  // the bag a shop brought in goes away with the last such window
  if (BAG_WITH.includes(id) && autoBag && panelId === "inv" && !BAG_WITH.some((o) => isOpen(o))) closeWin("inv");
  if (autoPhone && !panelId) { autoPhone = false; phoneHook.close(); }   // the phone the shop pulled out goes back with the bag
  syncMenu();
}
/** Put the phone away (leaving the game). */
export const phoneShut = () => phoneHook.close();
/** The phone came out or went in (the safe zone changed): every open floating window is kept inside it again. */
export const keepAll = () => layTabs();
/** Out of the way for a mini-game or a campfire: the phone drawer closes; the desktop side panel stays. */
export function closeDrawer() { if (compact()) closeWin("inv"); }
export function toggleWin(id) {
  if (id === "inv" && compact()) { if (drawerOpen()) closeWin("inv"); else { Sound.play("open"); openWin("inv"); } return; }
  if (isOpen(id) && !paned(id) && folded(id)) { Sound.play("open"); unfold(id); syncMenu(); return; }
  // its key again while it is the app on the phone's screen: the app and the phone go away together
  if (VP.phone && paned(id) && isOpen(id)) { closeWin(id); phoneHook.close(); Sound.play("close"); return; }
  Sound.play(isOpen(id) ? "close" : "open"); isOpen(id) ? closeWin(id) : openWin(id);
}
export function closeAll() { for (const id of WIN) closeWin(id); }
/** Esc: the emote picker first, then whichever floating window is on top (open ones before tabs), then the side panel's window, then the drawer, then the bag's pick. */
export function closeTop() {
  if (!$("#emotes").hidden) { $("#emotes").hidden = true; return; }
  let best = null, bz = -1;
  for (const id of WIN) if (!paned(id) && isOpen(id)) { const z = (+winEl(id).style.zIndex || 0) + (folded(id) ? 0 : 1e6); if (z > bz) { bz = z; best = id; } }
  if (best) { closeWin(best); Sound.play("close"); }
  else if (panelId) { closeWin(panelId); Sound.play("close"); }
  else if (phoneHook.out()) { phoneHook.close(); Sound.play("close"); }   // the app first (above), then the phone itself
  else if (drawerOpen() || G.sel >= 0) closeWin("inv");
}
/**
 * Which windows were open (W2): per character, saved when the page goes away (or the game is left), opened again
 * at the first snapshot, bottom-most first, where they stood (folded ones fold again). Only the player's own
 * windows: an NPC's (a shop, the smith, a talk, the warehouse…) needs the NPC beside you.
 */
const KEEP = [...DOCKABLE, "map"];
const OPEN_KEY = (name) => `lumentale:open:${name}`;
let restoredFor = null;
export function saveOpen(leaving) {
  const s = G.self;
  if (s && restoredFor === s.name) {
    const list = KEEP.filter((id) => !(id === "inv" && compact()) && !winEl(id).hidden)
      .sort((a, b) => (+winEl(a).style.zIndex || 0) - (+winEl(b).style.zIndex || 0))
      .map((id) => (paned(id) ? [id] : [id, parseFloat(winEl(id).style.left) || 0, parseFloat(winEl(id).style.top) || 0, folded(id) ? 1 : 0]));
    try { localStorage.setItem(OPEN_KEY(s.name), JSON.stringify(list)); } catch { /* private mode */ }
  }
  if (leaving) restoredFor = null;
}
/** Called with every self snapshot: does its work once per character per game. */
export function restoreOpen() {
  const s = G.self;
  if (!s || restoredFor === s.name) return;
  restoredFor = s.name;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(OPEN_KEY(s.name)) || "[]"); } catch { /* a damaged entry: open nothing */ }
  if (!Array.isArray(list)) return;
  for (const r of list) {
    const id = Array.isArray(r) ? r[0] : "";
    if (!KEEP.includes(id) || isOpen(id)) continue;
    if (VP.phone && PANEL.has(id)) continue;   // an app of the phone: the phone stays in the pocket at log-in
    openWin(id);
    if (paned(id)) continue;
    if (Number.isFinite(r[1]) && Number.isFinite(r[2])) keepIn(id, r[1], r[2]);
    if (r[3] === 1) fold(id);
  }
}
addEventListener("pagehide", () => saveOpen());

// a window whose content grows or shrinks (a list arriving, a tab switched) is kept inside the zone
const winSize = typeof ResizeObserver === "function" ? new ResizeObserver((es) => { for (const e of es) keepIn(e.target.id.slice(2)); }) : null;

/** Toasts stack under the tutorial card while it shows, never over it (every layout). */
export function placeToasts() {
  const box = $("#toasts");
  box.style.top = "";
  // under whatever top-of-screen card shows (첫걸음, the co-op shift, the house, the rift): all position: fixed children
  // of #hud, so viewport coordinates are their own
  let below = 0;
  for (const id of ["#tut", "#coop-hud", "#house-hud", "#dim-hud"]) {
    const n = $(id), r = n && !n.hidden && n.getBoundingClientRect();
    if (r && r.height && r.top < 120) below = Math.max(below, Math.ceil(r.bottom) + 6);
  }
  const base = parseFloat(getComputedStyle(box).top) || 0;
  if (below > base) box.style.top = `${below}px`;
}
export function toast(m) {
  const box = $("#toasts");
  // the same notice again while it shows (a key mashed, a wall walked into): one line counts up instead of a stack
  const same = [...box.children].find((o) => o.dataset.m === m);
  if (same) {
    same.dataset.n = +same.dataset.n + 1;
    same.textContent = `${m} ×${same.dataset.n}`;
    same.style.animation = "none"; void same.offsetWidth; same.style.animation = "";
    clearTimeout(same.tm); same.tm = setTimeout(() => same.remove(), 3300);
    return;
  }
  const p = el("p", "", m);
  p.dataset.m = m; p.dataset.n = 1;
  if (!box.children.length) placeToasts();
  box.append(p);
  while (box.children.length > 4) box.firstChild.remove();
  p.tm = setTimeout(() => p.remove(), 3300);
  // party and guild news also goes in the log, under its own tab
  if (/파티/.test(m)) addChat(m, "sys party");
  else if (/길드/.test(m)) addChat(m, "sys guild");
}
export function banner(str, small) {
  const b = $("#banner");
  b.hidden = true;
  void b.offsetWidth; // restart the animation
  b.textContent = str;
  b.style.fontSize = small ? "22px" : "";
  b.hidden = false;
}

/**
 * The in-game yes/no box for a step that cannot be undone (selling a rare piece, salvaging, leaving a rift):
 * [취소] left, the gold action right; Enter = yes, Esc = no. With `key`, a "다시 묻지 않기" box remembers the
 * answer per kind (localStorage `lumentale:noask:<key>`), so a player who sells in bulk is asked once.
 */
const NOASK = (key) => `lumentale:noask:${key}`;
let asking = null;
export function ask(text, yes, onYes, key, qty) {
  if (key && !qty && localStorage.getItem(NOASK(key)) === "1") { onYes(); return; }
  if (asking) asking(false);
  const box = $("#ask"), num = $("#ask-qty input"), note = $("#ask-qty .note");
  $("#ask-text").textContent = text;
  $("#ask-yes").textContent = yes;
  $("#ask-yes").append(el("kbd", "", "Enter"));
  $("#ask-skip").hidden = !key || !!qty;
  $("#ask-skip input").checked = false;
  // with `qty` ({ max, n, note(n) }): how many, typed or stepped, the note (a total price) kept up to date
  $("#ask-qty").hidden = !qty;
  const count = () => clamp(Math.floor(+num.value) || 1, 1, qty.max);
  const show = () => { note.textContent = qty.note ? qty.note(count()) : ""; };
  if (qty) {
    num.max = qty.max; num.value = qty.n || qty.max;
    num.oninput = show;
    for (const b of $$("#ask-qty button")) b.onclick = () => { num.value = b.dataset.d === "max" ? qty.max : clamp(count() + +b.dataset.d, 1, qty.max); show(); };
    show();
  }
  box.hidden = false;
  Sound.play("open");
  const done = (ok) => {
    asking = null;
    box.hidden = true;
    removeEventListener("keydown", onKey, true);
    $("#ask-yes").onclick = $("#ask-no").onclick = null;
    if (!ok) { Sound.play("close"); return; }
    if (key && !qty && $("#ask-skip input").checked) localStorage.setItem(NOASK(key), "1");
    onYes(qty ? count() : undefined);
  };
  // the box answers Enter and Esc before the game's own keys see them (digits reach the number box: it has the focus)
  const onKey = (e) => {
    if (e.key === "Enter") done(true);
    else if (e.key === "Escape") done(false);
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  };
  addEventListener("keydown", onKey, true);
  $("#ask-yes").onclick = () => done(true);
  $("#ask-no").onclick = () => done(false);
  asking = done;
  if (qty) { num.focus(); num.select(); } else $("#ask-yes").focus();
}

// ── chat ──
export const chatLog = $("#chat-log");
export function addChat(m, cls, name, its) {
  const stick = chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 12;
  const p = el("p", cls || "");
  p.title = p.dataset.t = new Date().toTimeString().slice(0, 5);   // when it was said: hover, or shown in front with [시각]
  if (name) {
    const who = el("span", "who", `${name}: `);
    // the speaker's job, when they stand in this place (chat carries a name only)
    for (const w of G.who.values()) if (w.name === name) { who.prepend(Info.jobMark(w.cls)); break; }
    p.append(who);
  }
  const text = (s) => {
    for (const seg of Emo.parse(s)) {
      if (seg.e === undefined) { p.append(seg.s); continue; }
      const im = el("img", "emo"); im.alt = Emo.token(seg.e); im.src = Emo.emoUrl(seg.e); p.append(im);
    }
  };
  if (typeof m === "string") {
    // linked items (`its`, copies of the sender's bag entries): their [이름] in the line becomes the link, else it goes at the end
    let rest = m;
    const tail = [];
    for (const e of its || []) {
      if (!e || !G.defs.items[e.id]) continue;
      const a = el("span", "ilink", `[${itemName(e)}]`), at = rest.indexOf(a.textContent);
      a.style.color = RARITY_COL[itemRarity(e)] || "";
      // its tooltip above the link, so the rest of the line stays readable
      a.addEventListener("mouseenter", () => {
        if (touch()) return;
        showTip(a, (n) => itemTip(e, n));
        const r = a.getBoundingClientRect();
        tipBox.style.left = `${Math.round(clamp(r.left, 4, innerWidth - tipBox.offsetWidth - 4))}px`;
        tipBox.style.top = `${Math.round(Math.max(4, r.top - tipBox.offsetHeight - 6))}px`;
      });
      a.addEventListener("mouseleave", () => { if (tip.from === a) hideTip(); });
      if (at < 0) { tail.push(" ", a); continue; }
      text(rest.slice(0, at)); p.append(a); rest = rest.slice(at + a.textContent.length);
    }
    text(rest); p.append(...tail);
  } else p.append(m);
  chatLog.append(p);
  while (chatLog.children.length > 150) chatLog.firstChild.remove();
  if (stick) chatLog.scrollTop = chatLog.scrollHeight;
  return p;
}
const CHAT_HINT = { all: "Enter 채팅 · /p 파티 · /g 길드", party: "Enter 로 파티 채팅", guild: "Enter 로 길드 채팅", sys: "Enter 로 채팅" };
/** The chat box's grey hint: the open tab's, led by the 답장 key once someone has whispered to me. */
export function chatHint() {
  const input = $("#chat-in"), base = CHAT_HINT[chatLog.dataset.tab] || CHAT_HINT.all, who = G.lastWhisper;
  input.placeholder = who ? `${K("reply")} → ${who}에게 답장 · ${base}` : base;
  input.title = `Enter 로 채팅 · /p 파티 · /g 길드 · /w 이름 귓속말 · ${K("reply")} 마지막 귓속말에 답장 · Shift+클릭(가방) 아이템 링크`;
}
/**
 * Item links (WoW's Shift+click): a bag item's [이름] goes into the chat box; the line is sent with `it` =
 * [[bag slot, id]…] (≤ 2) for the links still in the text — the server checks they are still in the bag
 * (63-social-weekly.js chatLinks). The slot is looked up again at send time, in case the bag moved.
 */
let links = [];
export function chatLink(slot, entry) {
  const input = $("#chat-in"), tok = `[${itemName(entry)}]`, sep = input.value && !/\s$/.test(input.value) ? " " : "";
  links = links.filter((l) => input.value.includes(l.tok));
  if (links.length >= 2) { toast("아이템 링크는 한 줄에 두 개까지입니다"); input.focus(); return; }
  if (input.value.length + sep.length + tok.length > input.maxLength) { toast("채팅이 너무 길어 링크를 넣을 수 없습니다"); input.focus(); return; }
  links.push({ s: slot, id: entry.id, tok, sig: JSON.stringify(entry) });
  input.value += sep + tok;
  input.focus();
  Sound.play("ui");
}
function linkRefs(m) {
  const inv = (G.self && G.self.inv) || [];
  const it = links.filter((l) => m.includes(l.tok)).map((l) => {
    const i = inv.findIndex((e) => e && JSON.stringify(e) === l.sig);
    return [i >= 0 ? i : l.s, l.id];
  });
  links = [];
  return it;
}
/** The 답장 key (keymap `reply`, WoW's R): the chat box opens as `/w <who whispered last> `. */
export function replyWhisper() {
  if (!G.lastWhisper) { toast("답할 귓속말이 없습니다"); return; }
  chatTo(`/w ${G.lastWhisper} `);
}
/** Put a line in the chat box ready to finish (the friend list's 귓속말 button, a click on a whisper). */
export function chatTo(prefix) {
  const input = $("#chat-in");
  input.value = prefix;
  input.focus();
}
/**
 * Which channel a line goes to: /p or /g in front, else the open tab (파티 · 길드), else everyone nearby.
 * Social commands: /w 이름 메시지 (귓속말; /r 메시지 answers the last one), /차단 이름, /차단해제 이름, /친구 이름.
 * Null when the line is a command that needs nothing sent (a hint went to the chat instead).
 */
export function chatAction(m) {
  const w = /^\/(w|귓|귓속말|ㅈ)\s+(\S+)\s+(.+)/.exec(m), r = /^\/(r|답|ㄱ)\s+(.+)/.exec(m);
  if (w) return { t: "w", to: w[2], m: w[3] };
  if (r) {
    if (G.lastWhisper) return { t: "w", to: G.lastWhisper, m: r[2] };
    addChat("답할 귓속말이 없습니다.", "sys");
    return null;
  }
  // the owner's local test character (74-dev-test.js; the server refuses it outside the local build)
  const mt = /^\/mingyutest(?:\s+(\S+))?\s*$/.exec(m);
  if (mt) return mt[1] ? { t: "mingyutest", j: mt[1] } : { t: "mingyutest" };
  const bk = /^\/(차단해제|차단|unblock|block)\s+(\S+)/.exec(m);
  if (bk) return { t: "blk", a: /해제|un/.test(bk[1]) ? "del" : "add", name: bk[2] };
  const fr = /^\/(친구|friend)\s+(\S+)/.exec(m);
  if (fr) return { t: "fr", a: "add", name: fr[2] };
  if (/^\/(w|귓|귓속말|ㅈ|차단|차단해제|친구)(\s|$)/.test(m)) {
    addChat("사용법: /w 이름 메시지 · /r 메시지 · /차단 이름 · /차단해제 이름 · /친구 이름", "sys");
    return null;
  }
  const g = /^\/(g|길드|ㅎ)\s+(.+)/.exec(m), pt = /^\/(p|파티|ㅔ)\s+(.+)/.exec(m);
  if (g) return { t: "gchat", m: g[2] };
  if (pt) return { t: "pchat", m: pt[2] };
  if (chatLog.dataset.tab === "guild") return { t: "gchat", m };
  if (chatLog.dataset.tab === "party") return { t: "pchat", m };
  return { t: "chat", m };
}

// ── the tooltip ──
export const tipBox = $("#tip");
export const tip = { from: null };
export function showTip(anchor, fill, above) {
  tipBox.textContent = "";
  tipBox.classList.remove("wm-tip", "mn-tip");
  fill(tipBox);
  // an item's cards (items.js itemTip) carry their own frames: the box turns into a bare row of cards
  tipBox.classList.toggle("cards", !!tipBox.querySelector(".tcards"));
  tipBox.hidden = false;
  tip.from = anchor;
  const r = anchor.getBoundingClientRect(), w = tipBox.offsetWidth, h = tipBox.offsetHeight;
  if (above) {
    // over the button (the menu sits at the screen's bottom edge), under it when there is no room above
    tipBox.style.left = `${Math.round(clamp(r.left + r.width / 2 - w / 2, 4, innerWidth - w - 4))}px`;
    tipBox.style.top = `${Math.round(clamp(r.top - h - 6 < 4 ? r.bottom + 6 : r.top - h - 6, 4, innerHeight - h - 4))}px`;
    return;
  }
  // beside the window the item sits in, so it never covers the grid it describes
  const side = (anchor.closest("#phone") || anchor.closest(".window") || anchor).getBoundingClientRect();
  let x = side.right + 6;
  if (x + w > innerWidth - 4) x = side.left - w - 6;
  if (x < 4) x = r.right + 8;
  tipBox.style.left = `${Math.round(clamp(x, 4, innerWidth - w - 4))}px`;
  tipBox.style.top = `${Math.round(clamp(r.top, 4, innerHeight - h - 4))}px`;
}
export function hideTip() { tipBox.hidden = true; tip.from = null; }
/** Hovering shows the tooltip; on a touch screen the window shows the same thing in its own pane instead. */
export function hoverTip(node, fill, above) {
  node.addEventListener("mouseenter", () => { if (!touch()) showTip(node, fill, above); });
  node.addEventListener("mouseleave", () => { if (tip.from === node) hideTip(); });
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupWindows({ walkToDoor }) {
  for (const id of WIN) {
    const w = winEl(id), head = w.querySelector("header");
    if (winSize) winSize.observe(w);
    w.addEventListener("pointerdown", () => front(id), true);
    const x = w.querySelector(".x");
    x.addEventListener("click", () => { closeWin(id); Sound.play("close"); });
    if (DOCKABLE.includes(id) && id !== "inv") {
      // 분리 / 붙이기: this window in the side panel or floating over the world (a desktop only; hud.css hides it on a phone)
      const pop = el("button", "pop");
      pop.type = "button";
      pop.addEventListener("click", () => { setDock(id, !paned(id)); Sound.play("ui"); });
      x.before(pop);
      popBtn(id);
    }
    // dragged by the title bar, kept in the safe zone, remembered; a folded window's tab unfolds on a press
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".x, .pop") || e.button !== 0 || paned(id)) return;
      e.preventDefault();
      if (folded(id)) { Sound.play("open"); unfold(id); syncMenu(); return; }
      const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      head.setPointerCapture(e.pointerId); w.classList.add("drag");
      const move = (ev) => keepIn(id, ev.clientX - ox, ev.clientY - oy);
      const up = () => {
        w.classList.remove("drag");
        head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up);
        if (roomy()) localStorage.setItem(WIN_KEY(id), JSON.stringify([parseFloat(w.style.left), parseFloat(w.style.top)]));
      };
      head.addEventListener("pointermove", move); head.addEventListener("pointerup", up); head.addEventListener("pointercancel", up);
    });
  }
  $("#b-drawer").addEventListener("click", () => { setDrawer(!drawerOpen()); syncMenu(); });
  // the radar over the side column and the map window (radar.js)
  Radar.init({
    G, act, toggleWin, isOpen, wpWoke, npcOut: S3.npcOut, miniDots: Dim.miniDots, play: (n) => Sound.play(n),
    walkToDoor, closeMap: () => closeWin("map"), toast,
    track: (id, name) => Track.start(() => ({ k: "map", id }), name),
    canWarp: () => !(G.map && String(G.map.id).startsWith("dim:")),   // warps from anywhere outside an instance (owner 2026-11-18)
    info: () => `${channelName()} · ${G.map.safe ? "안전 지대" : "사냥터"} · ${G.who.size - [...G.who.values()].filter((w) => w.buddy).length}명`,
  });
  $("#chat-fold").addEventListener("click", () => document.body.classList.toggle("chat-folded"));
  // the class gauge's own tooltip
  $("#cg-box").addEventListener("mouseenter", () => { $("#cg-box").title = G.self ? gaugeTip(G.self) || "" : ""; });
  addEventListener("resize", () => { layTabs(); for (const id of WIN) if (isOpen(id)) keepIn(id); });
  for (const b of $$("#menu button[data-win]")) b.addEventListener("click", () => toggleWin(b.dataset.win));
  $("#btn-winreset").addEventListener("click", () => {
    for (const id of WIN) localStorage.removeItem(WIN_KEY(id));
    for (const id of WIN) if (isOpen(id) && !paned(id) && !folded(id)) placeWin(id);
    Sound.play("ui");
    toast("창을 처음 자리로 옮겼습니다");
  });
  addEventListener("resize", placeToasts);
  // the settings in four tabs (화면 · 소리 · 조작 · 게임), the last one remembered; no 조작 on a touch screen
  const setTab = (sec) => {
    if (!["view", "sound", "keys", "game"].includes(sec) || (sec === "keys" && touch())) sec = "view";
    for (const b of $$("#set-tabs button")) b.classList.toggle("on", b.dataset.sec === sec);
    for (const n of $$("#w-settings .body > [data-sec]")) n.hidden = n.dataset.sec !== sec;
    localStorage.setItem("lumentale:settab", sec);
  };
  for (const b of $$("#set-tabs button")) b.addEventListener("click", () => { setTab(b.dataset.sec); Sound.play("ui"); });
  setTab(localStorage.getItem("lumentale:settab"));
  // the 다시 묻지 않기 choices (ask) and the first-time cards (hints.js), back on
  $("#btn-noask").addEventListener("click", () => {
    const ks = Object.keys(localStorage).filter((k) => k.startsWith("lumentale:noask:"));
    for (const k of ks) localStorage.removeItem(k);
    toast(ks.length ? `꺼 두었던 확인 창 ${ks.length}가지를 다시 띄웁니다` : "꺼 둔 확인 창이 없습니다");
    Sound.play("ui");
  });
  $("#btn-hints").addEventListener("click", () => { resetHints(); toast("처음 안내 카드를 다시 보여 드립니다"); Sound.play("ui"); });
  // [시각]: every line's HH:MM in front (C3), remembered per browser
  const timeBtn = $("#chat-time"), showTimes = (on) => {
    chatLog.classList.toggle("times", on);
    timeBtn.classList.toggle("on", on);
    timeBtn.setAttribute("aria-pressed", String(on));
    timeBtn.title = on ? "채팅 시각 숨기기" : "채팅 줄마다 시각 보이기";
  };
  showTimes(localStorage.getItem("lumentale:chattime") === "1");
  timeBtn.addEventListener("click", () => {
    const on = !chatLog.classList.contains("times");
    localStorage.setItem("lumentale:chattime", on ? "1" : "0");
    showTimes(on);
    Sound.play("ui");
  });
  for (const b of $$("#chat-tabs button[data-tab]")) {
    b.addEventListener("click", () => {
      for (const o of $$("#chat-tabs button[data-tab]")) o.classList.toggle("on", o === b);
      chatLog.dataset.tab = b.dataset.tab;
      chatHint();
      chatLog.scrollTop = chatLog.scrollHeight;
      Sound.play("ui");
    });
  }
  $("#chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#chat-in");
    const m = input.value.trim();
    const a = m && chatAction(m);
    const it = a && ["chat", "pchat", "gchat", "w"].includes(a.t) ? linkRefs(a.m) : (links = [], []);
    if (it.length) a.it = it;
    if (a) act(a);
    if (m && sent[sent.length - 1] !== m) { sent.push(m); if (sent.length > 20) sent.shift(); }
    back = sent.length;
    input.value = "";
    input.blur();
  });
  chatHint();
  $("#chat-in").addEventListener("blur", chatHint);   // (a key rebound in the settings shows here next time)
  // ↑ / ↓ in the chat box: the last 20 lines sent (a /w 이름 or a long party call, again)
  const sent = [];
  let back = 0;
  $("#chat-in").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    back = clamp(back + (e.key === "ArrowUp" ? -1 : 1), 0, sent.length);
    e.target.value = sent[back] || "";
  });
  chatLog.addEventListener("click", () => {
    if (!touch()) return;
    const m = prompt(chatLog.dataset.tab === "guild" ? "길드 채팅" : chatLog.dataset.tab === "party" ? "파티 채팅" : "채팅");
    const a = m && m.trim() && chatAction(m.trim().slice(0, 80));
    if (a) act(a);
  });
}
setLayoutHook(dockPanel);
