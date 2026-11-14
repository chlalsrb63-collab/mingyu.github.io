/**
 * Input (split from client.js): keys and hotkeys (the keydown switch: Korean 2-set keys too),
 * `moveVector`, click-to-walk `pathTo`, pointer aim and attack, the touch stick and buttons,
 * settings toggles (`setCrt setAimArrow toggleSound soundUi`) and `toggleAuto`.
 */

import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as Mini from "./minigames.js";
import * as QS from "./quickslots.js";
import * as Housing from "./housing.js";
import { G, $, dist, T, clamp, world, now, resize } from "./state.js";
import { act } from "./net.js";
import { usePotion, interact, stoneNear, aimAtPoint, attack } from "./actions.js";
import { autoSt } from "./update.js";
import { toggleWin, closeTop, openWin, toast } from "./windows.js";
import { openEmotes } from "./win_social.js";

// ───────────────────────────── input ─────────────────────────────

export const keys = new Set();
export const held = { atk: false };
const joy = { on: false, x: 0, y: 0, id: null };
export const typing = () => document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

/**
 * Which way to walk on the ground: keys, the stick, or the next step of a clicked route.
 * Keys and stick speak in screen directions, and the view looks at the ground from
 * the diagonal: screen-up is north-west and north-east together, screen-right is
 * east and north, and a screen diagonal runs straight along the tile edges.
 */
export function moveVector() {
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
export function pathTo(wx, wy) {
  const m = G.map, n = m.w * m.h;
  const sx = Math.floor(G.me.x / T), sy = Math.floor((G.me.y - 2) / T);
  const gx = clamp(Math.floor(wx / T), 0, m.w - 1), gy = clamp(Math.floor(wy / T), 0, m.h - 1);
  // a walk goes round doors and gates it is not heading for (a house door sits right on the street)
  const doors = new Set(m.portals.filter((p) => Math.abs(p.x - gx) + Math.abs(p.y - gy) > 1).map((p) => p.y * m.w + p.x));
  const free = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && !"wW".includes(m.g[y][x]) && !doors.has(y * m.w + x);
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
const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ""; } };

function press(btn, down, up) {
  const d = (e) => { e.preventDefault(); btn.classList.add("down"); down(); };
  const u = () => { btn.classList.remove("down"); up && up(); };
  btn.addEventListener("pointerdown", d);
  btn.addEventListener("pointerup", u); btn.addEventListener("pointerleave", u); btn.addEventListener("pointercancel", u);
}

/** The CRT look is on unless the player turned it off. */
function setCrt(on) {
  document.body.classList.toggle("crt", on);
  $("#btn-crt").classList.toggle("off", !on);
  $("#btn-crt").textContent = on ? "켜짐" : "꺼짐";
  localStorage.setItem("lumentale:crt", on ? "1" : "0");
}
/** The small arrow at your feet that shows where your blows and skills go; on unless turned off. */
function setAimArrow(on) {
  G.aimArrow = on;
  $("#btn-aim").classList.toggle("off", !on);
  $("#btn-aim").textContent = on ? "켜짐" : "꺼짐";
  localStorage.setItem("lumentale:aim", on ? "1" : "0");
}
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
function toggleAuto() {
  G.auto = !G.auto;
  autoSt.home = null;
  $("#b-auto").classList.toggle("on", G.auto);
  toast(G.auto ? "자동사냥 시작 (이 근처만 · 우두머리·강한 정예는 피함)" : "자동사냥 종료");
  Sound.play("ui");
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupInput() {

  addEventListener("keydown", (e) => {
    Sound.unlock();
    if (!G.playing) return;
    if (typing()) { if (e.key === "Escape") document.activeElement.blur(); return; }
    if (Mini.active()) return;               // a mini-game has the keyboard
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    // decorating a house: R turns the piece in hand, Esc lets go of it, Delete picks a piece up (housing.js)
    if (Housing.onKey(k)) { e.preventDefault(); return; }
    keys.add(k);
    switch (k) {
      case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9": QS.press(Number(k) - 1); break;
      case "q": case "ㅂ": usePotion("hp"); break;
      case "e": case "ㄷ": usePotion("mp"); break;
      case "f": case "ㄹ": interact(); break;
      case "x": case "ㅌ": act({ t: "sit" }); break;
      case "b": case "ㅠ": if (G.me.sit) act({ t: "jam", k: 0 }); break;
      case "z": case "ㅋ": if (G.me.sit) act({ t: "jam", k: 1 }); break;
      case "g": case "ㅎ": toggleWin("guild"); break;
      case "t": case "ㅅ": openEmotes("emote"); break;
      case "i": case "ㅑ": toggleWin("inv"); break;
      // a hybrid job swaps its two weapons
      case "Tab": { e.preventDefault(); const j = G.self && G.defs.jobs[G.self.job]; if (j && j.kind === "hybrid") { act({ t: "wsw" }); Sound.play("ui"); } break; }
      case "c": case "ㅊ": toggleWin("char"); break;
      // Shift+L: the 생활 window (life skills, life.js); L alone: quests
      case "l": case "ㅣ": toggleWin(e.shiftKey ? "life" : "quest"); break;
      case "r": case "ㄱ": toggleAuto(); break;
      case "p": case "ㅔ": toggleWin("party"); break;
      case "k": case "ㅏ": toggleWin("skill"); break;
      case "n": case "ㅜ": toggleWin("rank"); break;
      case "u": case "ㅕ": toggleWin("daily"); break;
      case "y": case "ㅛ": toggleWin("achieve"); break;
      case "j": case "ㅓ": toggleWin("collect"); break;
      case "h": case "ㅗ": toggleWin("help"); break;
      case "o": case "ㅐ": toggleWin("settings"); break;
      case "m": case "ㅡ": if (e.shiftKey) toggleSound(); else toggleWin("map"); break;
      case "v": case "ㅍ": setCrt(!document.body.classList.contains("crt")); break;
      case "Enter": e.preventDefault(); $("#chat-in").focus(); break;
      case "Escape": closeTop(); break;
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener("blur", () => { keys.clear(); held.atk = false; });
  world.addEventListener("pointerdown", (e) => {
    if (!G.playing || !G.map || G.me.dead) return;
    const hit = S3.pick(e.clientX, e.clientY);
    if (!hit) return;
    if (Housing.onWorldDown(e)) return;             // decorating a house: place or pick a piece
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

  // decorating a house: the ghost of the piece in hand follows the pointer (housing.js)
  world.addEventListener("pointermove", (e) => { if (G.playing && G.map) Housing.onWorldMove(e); });
  joyEl.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.changedTouches[0]; joy.on = true; joy.id = t.identifier; joyMove(t); }, { passive: false });
  joyEl.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joy.id) joyMove(t); }, { passive: false });
  joyEl.addEventListener("touchend", joyEnd);   joyEl.addEventListener("touchcancel", joyEnd);
  addEventListener("touchstart", () => { document.body.classList.add("touch"); Sound.unlock(); resize(); }, { once: true, passive: true });
  addEventListener("pointerdown", () => Sound.unlock(), { once: true });
  press($("#b-atk"), () => { held.atk = true; }, () => { held.atk = false; });
  press($("#b-hp"), () => usePotion("hp"));
  press($("#b-mp"), () => usePotion("mp"));
  press($("#b-auto"), () => toggleAuto());
  $("#prompt").addEventListener("click", () => interact());
  $("#b-respawn").addEventListener("click", () => act({ t: "respawn" }));
  $("#btn-sound").addEventListener("click", toggleSound);
  setCrt(localStorage.getItem("lumentale:crt") !== "0");
  $("#btn-crt").addEventListener("click", () => { setCrt(!document.body.classList.contains("crt")); Sound.play("ui"); });
  setAimArrow(localStorage.getItem("lumentale:aim") !== "0");
  $("#btn-aim").addEventListener("click", () => { setAimArrow(!G.aimArrow); Sound.play("ui"); });
  Sound.load();
  soundUi();
  $("#vol-bgm").addEventListener("input", (ev) => { Sound.unlock(); Sound.setMusic(ev.target.value / 100); });
  $("#vol-sfx").addEventListener("input", (ev) => { Sound.unlock(); Sound.setSfx(ev.target.value / 100); });
  $("#vol-sfx").addEventListener("change", () => Sound.play("coin"));
}
