/**
 * The window system (split from client.js): `WIN` ids (`section.window#w-<id>` in index.html),
 * `openWin closeWin toggleWin closeAll closeTop isOpen`, placement in the safe zone (`zone homeOf
 * placeWin keepIn front`, fold to tabs `fold unfold layTabs`, saved spots), the phone drawer,
 * toasts and banners, the chat log (`addChat`), and tooltips (`showTip hideTip hoverTip`).
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
import * as Housing from "./housing.js";
import { $, VP, G, clamp, $$, el } from "./state.js";
import { act, channelName } from "./net.js";
import { stoneNear } from "./actions.js";
import { wpWoke } from "./overlay.js";
import { refreshUi } from "./hud.js";
import { tutTry } from "./win_world.js";
import { renderParty, renderGuild } from "./win_social.js";

// (the radar and the map window live in radar.js)

// ───────────────────────────── HUD & windows ─────────────────────────────

export const touch = () => document.body.classList.contains("touch");
const WIN = ["inv", "char", "skill", "shop", "smith", "quest", "rank", "talk", "help", "settings", "train", "party", "guild", "warp", "daily", "achieve", "collect", "bank", "costume", "dim", "rc", "map", "house", "deco", "hstore", "life", "job", "craft", "board"];
export const winEl = (id) => $(`#w-${id}`);
/** The bag is docked in the side column, so it always counts as open (on a phone it lives in the drawer). */
export const isOpen = (id) => id === "inv" || !winEl(id).hidden;
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
export const shown = {};
let zTop = 20;
const WIN_KEY = (id) => `lumentale:win2:${id}`;
const roomy = () => VP.lay === "full";
/** Where windows may sit: over the viewport on a desktop, anywhere on a phone. */
const winArea = () => (VP.lay === "land" ? [Math.max(320, innerWidth - 300), innerHeight] : [VP.w, VP.h]);
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
const floated = () => WIN.filter((id) => id !== "inv" && !winEl(id).hidden);
const tabsOut = () => floated().filter(folded);
function zone() {
  const [W, H] = winArea();
  return [EDGE, EDGE, W - EDGE, H - EDGE - (tabsOut().length ? TAB_H : 0)];
}
const boxOf = (id) => { const w = winEl(id); return [parseFloat(w.style.left) || 0, parseFloat(w.style.top) || 0, w.offsetWidth, w.offsetHeight]; };
const hits = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** Where a window first opens, before the player moves it: inside the viewport, the shop and smith on the right next to the bag. */
function homeOf(id, w, h) {
  const [x0, y0, x1, y1] = zone(), top = y0 + 4;
  const right = x1 - w - 4, mid = (x0 + x1 - w) / 2;
  switch (id) {
    case "char": case "shop": case "smith": case "train": case "job": case "bank": case "house": case "hstore": return [right, top];
    case "deco": return [x0 + 4, top + 32];
    case "skill": case "party": case "guild": case "rank": case "daily": case "achieve": case "collect": case "life": return [x0 + 4, top + 32];
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
  if (id === "inv") return;
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
  if (id === "inv") return;
  const w = winEl(id);
  if (+w.style.zIndex !== zTop) w.style.zIndex = ++zTop;
  for (const o of WIN) if (o !== "inv") winEl(o).classList.toggle("top", o === id);
}
function syncMenu() { for (const b of $$("#menu button[data-win]")) b.classList.toggle("on", b.dataset.win === "inv" ? drawerOpen() : isOpen(b.dataset.win)); }
export function openWin(id) {
  if (id === "inv") { showBag(); tutTry("bag"); refreshUi(); syncMenu(); return; }
  const w = winEl(id), was = !w.hidden;
  w.hidden = false;
  delete shown[id];
  if (id === "rank") { $("#rank-list").textContent = "불러오는 중…"; act({ t: "rank" }); }
  if (id === "settings") Lobby.refreshSettings();
  if (id === "party") renderParty();
  if (id === "guild") { act({ t: "glist" }); renderGuild(); }
  if (id === "map") Radar.opened();
  refreshUi();
  if (was && folded(id)) unfold(id);
  else if (!was) placeWin(id);
  front(id);
  syncMenu();
}
export function closeWin(id) {
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
  if (folded(id)) { w.classList.remove("mini"); w.title = ""; layTabs(); }
  Housing.onWinClose(id);
  if (id === "train") StatWin.reset();
  if (id === "job" || id === "skill") JobTree.reset();
  if (tip.from && w.contains(tip.from)) hideTip();
  syncMenu();
}
export function toggleWin(id) {
  if (id === "inv") { if (compact() && drawerOpen()) closeWin("inv"); else { Sound.play("open"); openWin("inv"); } return; }
  if (isOpen(id) && folded(id)) { Sound.play("open"); unfold(id); syncMenu(); return; }
  Sound.play(isOpen(id) ? "close" : "open"); isOpen(id) ? closeWin(id) : openWin(id);
}
export function closeAll() { for (const id of WIN) closeWin(id); }
/** Esc: the emote picker first, then whichever window is on top (open ones before tabs), then the drawer, then the bag's pick. */
export function closeTop() {
  if (!$("#emotes").hidden) { $("#emotes").hidden = true; return; }
  let best = null, bz = -1;
  for (const id of WIN) if (id !== "inv" && isOpen(id)) { const z = (+winEl(id).style.zIndex || 0) + (folded(id) ? 0 : 1e6); if (z > bz) { bz = z; best = id; } }
  if (best) { closeWin(best); Sound.play("close"); }
  else if (drawerOpen() || G.sel >= 0) closeWin("inv");
}
// a window whose content grows or shrinks (a list arriving, a tab switched) is kept inside the zone
const winSize = typeof ResizeObserver === "function" ? new ResizeObserver((es) => { for (const e of es) keepIn(e.target.id.slice(2)); }) : null;

/** Toasts stack under the tutorial card while it shows, never over it (every layout). */
export function placeToasts() {
  const box = $("#toasts"), card = $("#tut");
  box.style.top = "";
  if (card.hidden) return;
  // both are position: fixed children of #hud, so viewport coordinates are their own
  const r = card.getBoundingClientRect();
  if (!r.height) return;
  const base = parseFloat(getComputedStyle(box).top) || 0, below = Math.ceil(r.bottom) + 6;
  if (below > base) box.style.top = `${below}px`;
}
export function toast(m) {
  const box = $("#toasts");
  const p = el("p", "", m);
  if (!box.children.length) placeToasts();
  box.append(p);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => p.remove(), 3300);
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

// ── chat ──
export const chatLog = $("#chat-log");
export function addChat(m, cls, name) {
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

// ── the tooltip ──
export const tipBox = $("#tip");
export const tip = { from: null };
export function showTip(anchor, fill) {
  tipBox.textContent = "";
  tipBox.classList.remove("wm-tip");
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
export function hideTip() { tipBox.hidden = true; tip.from = null; }
/** Hovering shows the tooltip; on a touch screen the window shows the same thing in its own pane instead. */
export function hoverTip(node, fill) {
  node.addEventListener("mouseenter", () => { if (!touch()) showTip(node, fill); });
  node.addEventListener("mouseleave", () => { if (tip.from === node) hideTip(); });
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupWindows() {
  for (const id of WIN) {
    if (id === "inv") continue;
    const w = winEl(id), head = w.querySelector("header");
    if (winSize) winSize.observe(w);
    w.addEventListener("pointerdown", () => front(id), true);
    w.querySelector(".x").addEventListener("click", () => { closeWin(id); Sound.play("close"); });
    // dragged by the title bar, kept in the safe zone, remembered; a folded window's tab unfolds on a press
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".x") || e.button !== 0) return;
      e.preventDefault();
      if (folded(id)) { Sound.play("open"); unfold(id); syncMenu(); return; }
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
  // the radar over the side column and the map window (radar.js)
  Radar.init({
    G, act, toggleWin, isOpen, wpWoke, npcOut: S3.npcOut, miniDots: Dim.miniDots, play: (n) => Sound.play(n),
    canWarp: () => stoneNear() || !!(G.near && G.near.role === "warp"),
    info: () => `${channelName()} · ${G.map.safe ? "안전 지대" : "사냥터"} · ${G.who.size}명`,
  });
  $("#chat-fold").addEventListener("click", () => document.body.classList.toggle("chat-folded"));
  // the class gauge's own tooltip
  $("#cg-box").addEventListener("mouseenter", () => { $("#cg-box").title = G.self ? gaugeTip(G.self) || "" : ""; });
  addEventListener("resize", () => { layTabs(); for (const id of WIN) if (isOpen(id)) keepIn(id); });
  for (const b of $$("#menu button[data-win]")) b.addEventListener("click", () => toggleWin(b.dataset.win));
  $("#btn-winreset").addEventListener("click", () => {
    for (const id of WIN) localStorage.removeItem(WIN_KEY(id));
    for (const id of WIN) if (isOpen(id) && !folded(id)) placeWin(id);
    Sound.play("ui");
    toast("창을 처음 자리로 옮겼습니다");
  });
  addEventListener("resize", placeToasts);
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
}
