/**
 * Talk close-up (설정 → 화면 → 대화 연출): while the talk window is open the camera eases in on the midpoint between you and
 * the NPC; with a quest card in it (accept / progress / hand in) the zoom is closer, the HUD fades and letterbox bars slide in
 * (body.talkcam / body.talkq, hud.css). Every way the window closes (button, Esc, walking off, death, map change) ends it,
 * because this only watches `isOpen("talk")`. The zoom is stepped by scene_view.setZoomMul in whole device pixels.
 */
import * as S3 from "./scene2d.js";
import { G, $, T } from "./state.js";
import { isOpen } from "./windows.js";
import { talk } from "./actions.js";

export let enabled = true;
const MUL = [1, 1.5, 2];
let cur = 1, mode = 0;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setEnabled(on) { enabled = on; localStorage.setItem("lumentale:talkcam", on ? "1" : "0"); }
export function load() { enabled = localStorage.getItem("lumentale:talkcam") !== "0"; }

/** Run once a frame before the scene is drawn; returns the point the camera should follow. */
export function tick(dt) {
  const me = G.me, n = talk.npc;
  let m = 0;
  if (enabled && me && !me.dead && n && G.map && isOpen("talk")) m = $("#talk-sq .sq-card") ? 2 : 1;
  if (m !== mode) {
    mode = m;
    document.body.classList.toggle("talkcam", m > 0);
    document.body.classList.toggle("talkq", m === 2);
  }
  const goal = MUL[m];
  cur = calm() || Math.abs(goal - cur) < 0.01 ? goal : cur + (goal - cur) * Math.min(1, dt * 9);
  S3.setZoomMul(cur);
  if (cur === 1 || !n) return [me.x, me.y];
  const k = Math.min(1, (cur - 1) / 0.5) * 0.5;   // halfway to the NPC once the zoom is in
  return [me.x + (n.x * T + 8 - me.x) * k, me.y + (n.y * T + 12 - me.y) * k];
}
