/**
 * Small HUD pieces the windows share (split from hud.js so windows need not import hud.js, which
 * imports them): `look section setOnce`, the paper-doll portrait (`drawPortrait resetDoll`) and
 * `refreshUi`, a call to hud.js's window refresh that hud.js installs when it loads (`setRefreshUi`).
 */
import * as SP from "./sprites.js";
import { iconImg } from "./uiicons.js";
import { G, $, el } from "./state.js";

/** Redraw the HUD and every open window whose key changed (hud.js refreshUi; a no-op until hud.js has loaded). */
export let refreshUi = () => {};
export function setRefreshUi(fn) { refreshUi = fn; }

export const look = () => G.who.get(G.you);

/** The paper-doll's figure: the player's own sprite, large, breathing and now and then blinking. */
let dollAt = 0, dollFrame = -1;
/** Draw the portrait afresh next frame (the character window changed). */
export function resetDoll() { dollFrame = -1; }
export function drawPortrait(t) {
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
  SP.drawPersonCrop(g, fr, 4, 2, 24, 28, 6, 10, 120, 140);
}

export function setOnce(node, key, fill) {
  if (node.dataset.k === key) return;
  node.dataset.k = key;
  node.textContent = "";
  fill(node);
}

export function section(text, glyph) {
  const h = el("div", "section");
  if (glyph) h.append(iconImg(glyph, "#e2c486"));
  h.append(text);
  return h;
}
