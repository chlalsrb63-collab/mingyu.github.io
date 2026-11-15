/**
 * The client's shared state (split from client.js): small helpers (`$ $$ el clamp dist now T`),
 * the game state `G` (one object, mutated in place by every module), the world and text canvases,
 * and the screen layout (`VP`, docks `sideW dockH`, `layout`, `resize` → `--vpw --vph --zone-w --zone-h`).
 */

import * as Art from "./art.js";
import * as S3 from "./scene2d.js";

export const T = Art.TILE;
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // textContent only — server strings are never markup
  return e;
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const now = () => performance.now();

// ───────────────────────────── state ─────────────────────────────

export const G = {
  playing: false, you: 0, defs: null, icons: null, self: null, map: null, friends: null, lastWhisper: "",
  me: { x: 0, y: 0, dir: 0, aimI: 16, hp: 1, mp: 0, dead: false, walk: 0, moving: false, atkT: -1e9, hurtT: -1e9 },
  who: new Map(), players: new Map(), mobs: new Map(), gone: new Map(), drops: new Map(), fires: new Map(), bobs: new Map(), ginv: null,
  texts: [], bubbles: new Map(),
  cdEnd: {}, buffEnd: [0, 0], potAt: 0, lastAtk: 0, lastSkill: 0,
  auto: false, sel: -1, flash: 0, near: null, party: [], pinv: null, path: null, mark: null,
};
export let dpr = 1;

export const world = $("#world");
export const text = $("#text"), tg = text.getContext("2d");

/**
 * The screen layout. On a desktop the world plays in the top-left viewport,
 * framed by the side column (right) and the dock (bottom); a phone upright
 * gets the world on top and a control deck below; a phone on its side keeps
 * the world full screen with the controls floating over it. The title and
 * character creation always use the whole window.
 */
const SIDE = 288, DOCK = 184;
/** The side column narrows on small desktops (≤ 1100 wide: 256 px, menu glyphs only; hud.css matches the breakpoint). */
const sideW = (W) => (W <= 1100 ? 256 : SIDE);
/** The dock grows a little on tall screens (more chat lines): 184 px up to 920 high, 216 at 1080; 160 on short screens (≤ 640). */
const dockH = (H) => (H <= 640 ? 160 : Math.round(clamp(H * 0.2, DOCK, 224)));
export const VP = { w: innerWidth, h: innerHeight, lay: "full" };
function layout() {
  const W = innerWidth, H = innerHeight, b = document.body;
  // a finger-driven screen gets the touch controls from the start, before the first tap
  if (matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches) b.classList.add("touch");
  const compact = b.classList.contains("touch") || W < 900 || H < 540;
  VP.lay = !compact ? "full" : H > W ? "port" : "land";
  const deck = Math.round(clamp(H * 0.4, 290, 360));
  if (!G.playing) { VP.w = W; VP.h = H; }
  else if (VP.lay === "full") { VP.w = W - sideW(W); VP.h = H - dockH(H); }
  else if (VP.lay === "port") { VP.w = W; VP.h = H - deck; }
  else { VP.w = W; VP.h = H; }
  b.dataset.lay = VP.lay;
  b.classList.toggle("playing", !!G.playing);
  const r = document.documentElement.style;
  r.setProperty("--vpw", VP.w + "px"); r.setProperty("--vph", VP.h + "px");
  r.setProperty("--dock", (VP.lay === "port" ? deck : dockH(H)) + "px");
  if (VP.lay === "full") r.setProperty("--side", sideW(W) + "px"); else r.removeProperty("--side");
  // the safe zone windows live in (client placeWin/keepIn, hud.css caps their size to it)
  const zw = VP.lay === "land" ? Math.max(320, W - 300) : VP.w, zh = VP.lay === "land" ? H : VP.h;
  r.setProperty("--zone-w", zw + "px"); r.setProperty("--zone-h", zh + "px");
  if (VP.lay === "full") b.classList.remove("drawer");
  // the potions sit beside the HP/MP bars on a desktop, on the thumb pad on a phone
  const pots = $("#st-pots"), hpB = $("#b-hp"), mpB = $("#b-mp");
  if (VP.lay === "full" && hpB.parentNode !== pots) pots.append(hpB, mpB);
  else if (VP.lay !== "full" && hpB.parentNode === pots) $("#actions").prepend(hpB, mpB);
  // the buffs: under the party frames over the world (the dock and the floating unit frame have no height to
  // spare); in the unit frame only on an upright phone, whose control deck has room
  const buffs = $("#st-buffs"), tl = $("#topleft"), upright = VP.lay === "port";
  if (!upright && buffs.parentNode !== tl) tl.append(buffs);
  else if (upright && buffs.parentNode === tl) $(".st-side").append(buffs);
  // the side panel (windows.js dockPanel): desktop windows move into the side column, back to #windows on a phone
  if (onLayout) onLayout();
}
let onLayout = null;
/** windows.js hooks the side panel in here: run after every layout pass. */
export function setLayoutHook(f) { onLayout = f; }
export function resize() {
  layout();
  const W = VP.w, H = VP.h;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  text.width = Math.round(W * dpr); text.height = Math.round(H * dpr);
  text.style.width = W + "px"; text.style.height = H + "px";
  S3.resize(W, H);
}
