/**
 * Player actions (split from client.js): walkability (`solid canStand`), skills, potions and the
 * basic attack, aiming (`aimIdx aimVec aimAtPoint preAim`), what is near (`nearestNpc stoneNear
 * waterNear fireNear`), `interact` (F) and talking to NPCs (`talkTo talkShow`).
 */

import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as Mini from "./minigames.js";
import * as Growth from "./growth.js";
import * as QS from "./quickslots.js";
import * as NpcTalk from "./npctalk.js";
import * as SideQ from "./sidequests.js";
import * as Dim from "./dimrift.js";
import * as Housing from "./housing.js";
import * as Gather from "./gather.js";
import * as Station from "./station.js";
import * as Board from "./board.js";
import * as Charms from "./charms.js";
import { G, T, now, dist, $, el } from "./state.js";
import { act } from "./net.js";
import { toast, openWin, addChat, shown } from "./windows.js";
import { tutTry } from "./win_world.js";

// ───────────────────────────── player actions ─────────────────────────────

function solid(px, py) {
  const m = G.map;
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.o[ty][tx] !== " " || "wW".includes(m.g[ty][tx]);
}
export const canStand = (x, y) => !(solid(x - 4, y - 5) || solid(x + 4, y - 5) || solid(x - 4, y) || solid(x + 4, y));

/** Cast weapon skill `id` (a quick slot, auto-hunt): refused here with the server's own words when it cannot be. */
export function castSkill(id) {
  const s = G.self;
  if (!s || G.me.dead) return false;
  const sk = G.defs.skills[id];
  if (!sk || sk.kind === "p") return false;
  const t = now();
  const why = QS.skillWhy(id);
  if (why) { if (!G.auto) { toast(why); Sound.play("no"); } return false; }
  const mpc = QS.skillMp(id);          // a full resonance makes a staff skill free
  if (t < (G.cdEnd[id] || 0) || G.me.mp < mpc) { if (G.me.mp < mpc && !G.auto) toast("MP가 부족합니다"); return false; }
  act({ t: "sk", id, a: G.me.aimI });
  G.cdEnd[id] = t + sk.cd * (1 - (s.dv ? s.dv[3] : 0) / 100);
  G.me.atkT = t; G.me.atkN = 2; G.lastAtk = t; G.lastSkill = t; G.comboWeapon = null;
  preAim(aimCone());
  return true;
}
export function countItem(id) {
  let n = 0;
  if (G.self) for (const s of G.self.inv) if (s.id === id) n += s.n || 1;
  return n;
}
export function usePotion(kind) {
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
export function attack() {
  const t = now();
  if (t - G.lastAtk < G.self.acd) return;
  // Predict the next beat using the same weapon and window as the server.
  const kind = G.self.wk, wk = G.defs.wkinds?.[kind];
  const chained = t - G.lastAtk < G.self.acd + 700;
  G.combo = kind === "sword" ? (chained && G.comboWeapon === kind ? 1 - (G.combo | 0) : 0) :
    chained && G.comboWeapon !== "sword" ? ((G.combo | 0) + 1) % 3 : 0;
  G.comboWeapon = kind;
  G.me.atkN = G.combo;
  G.lastAtk = t; G.me.atkT = t;
  G.impactAt = t + S3.impactMs(G.self.wk, G.combo);
  preAim((wk && wk.arc) || aimCone());
  G.aimFlash = t;
  act({ t: "atk", a: G.me.aimI });
}
/**
 * Space: the dash (59-dash.js) the way the aim points. Only the clock lives here: the server moves the hero
 * and snaps the position (me[5]); the trail is drawn from its "ds" event (skillfx.js). me[11] keeps the clock true.
 */
export function dash() {
  const me = G.me, t = now();
  if (me.dead || !G.self || t < (G.dashEnd || 0)) return;
  G.dashEnd = t + ((G.defs.dash && G.defs.dash[2]) || 4000); G.dashSent = t;
  G.path = null;
  act({ t: "dash", a: me.aimI });
}
// ── aim: the server counts AIM_N steps round the compass on the ground (0 = +x, a quarter = +y)
const aimN = () => (G.defs && G.defs.aim ? G.defs.aim[0] : 64);
const aimCone = () => (G.defs && G.defs.aim ? G.defs.aim[1] : 40);
/** The aim step nearest the ground direction (dx, dy). */
export function aimIdx(dx, dy) { const n = aimN(); return ((Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * n) % n) + n) % n; }
/** The unit vector of aim step `i`. */
function aimVec(i) { const a = (i / aimN()) * 2 * Math.PI; return [Math.cos(a), Math.sin(a)]; }
/** Aim at a point on the ground (a monster clicked, the auto-hunt's quarry). */
export function aimAtPoint(x, y) { if (Math.hypot(x - G.me.x, y - G.me.y) > 1) G.me.aimI = aimIdx(x - G.me.x, y - G.me.y); }
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

export function nearestNpc() {
  let best = null, bd = 40;
  for (const n of G.map.npcs) {
    if (!S3.npcOut(n)) continue;
    // a keeper behind a counter (the cafe, the inn) is served across it: a little further, still in the server's reach (56)
    // so is a life station (쥬쥬의 화덕 sits right beside 쥬쥬's counter: step to its side to reach it)
    const d = dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12) - (n.goods || STATION_ROLE.has(n.role) ? 14 : 0);
    if (d < bd) { bd = d; best = n; }
  }
  for (const m of G.map.marks || []) {
    if (m.kind !== "waypoint") continue;
    const d = dist(G.me.x, G.me.y, m.x * T + 8, m.y * T + 8);
    if (d < bd) { bd = d; best = STONE; }
  }
  return best;
}
const STATION_ROLE = new Set(["craft", "alch", "cook"]);
/** The waypoint stone, as something the player can talk to. */
const STONE = { role: "stone", name: "이동의 돌" };
export const stoneNear = () => (G.map.marks || []).some((m) => m.kind === "waypoint" && dist(G.me.x, G.me.y, m.x * T + 8, m.y * T + 8) < 40);
/** Is there water close enough to cast into? */
function waterNear() {
  const m = G.map, tx = Math.floor(G.me.x / T), ty = Math.floor(G.me.y / T);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const row = m.g[ty + dy];
    if (row && row[tx + dx] === "w" && dist(G.me.x, G.me.y, (tx + dx) * T + 8, (ty + dy) * T + 8) < 34) return true;
  }
  return false;
}
export const fireNear = () => { for (const f of G.fires.values()) if (dist(G.me.x, G.me.y, f.x, f.y) <= G.defs.fireR) return true; return false; };

/** The sheet NPCs read their lines from, plus whether the main quest is ready to hand in. */
function talkSheet() {
  const s = G.self, q = s && s.q, quest = q && G.defs.quests[q.i];
  return s && { ...s, qDone: !!(q && q.st === 1 && quest && q.n >= quest.n) };
}
export function interact() {
  const n = G.near;
  if (G.me.dead) return;
  if (Gather.interactBusy()) return;               // gathering: F is the "반짝!" tap (gather.js)
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
  if (Housing.interact()) return;                  // at home: a chest opens the storage, a bed gives a rest
  // with nobody to talk to: a gathering node in reach (gather.js), else water is for fishing
  // with nobody to talk to: a node, then a campfire's 요리 window (station.js), then water
  if (!n) {
    if (Gather.interact()) return;
    if (fireNear() && Station.open("fire")) { Sound.play("ui"); return; }
    if (waterNear()) { act({ t: "fish" }); Sound.play("ui"); }
    return;
  }
  if (Board.interact(n)) return;                   // the 알바 in hand: pick up / hand in here (board.js)
  Sound.play("ui");
  SideQ.onTalk(n, G.self);
  if (n.role === "shop") { openWin("shop"); openWin("inv"); }
  else if (n.role === "smith") { openWin("smith"); openWin("inv"); }
  else if (n.role === "elder") { openWin("quest"); tutTry("talk"); }
  else if (n.role === "stone" || n.role === "warp") openWin("warp");
  else if (n.role === "daily") openWin("daily");
  else if (n.role === "collector") openWin("collect");
  else if (n.role === "achieve") openWin("achieve");
  else if (n.role === "train") openWin("train");          // 수련관 카이: the starter weapon, levels, 망각의 의식
  else if (n.role === "job") openWin("job");              // 전직관 아르센: the jobs
  else if (n.role === "bank") openWin("bank");
  else if (n.role === "costume") openWin("costume");
  else if (n.role === "dim") Dim.openKeeper();
  else if (n.role === "house") { Housing.openAgent(); openWin("inv"); }
  else if (n.role === "craft" || n.role === "alch" || n.role === "cook") Station.open(n.role);   // 캉캉 · 보글 · 쥬쥬의 화덕
  else if (n.role === "charm") Charms.openJuana();        // 참감정사 주아나: quest, appraisal, expansion (charms.js)
  else if (n.role === "jobs") Board.open();               // 알바 중개인 포포: the board
  else { talkTo(n); return; }
  if (SideQ.gives(n)) talkTo(n);
  // the townsfolk have a word to say as they serve you (npctalk.js)
  const line = n.role !== "stone" && NpcTalk.lineFor(n, talkSheet());
  if (line) addChat(line, "npc", n.name);
}
/** The talk window: the NPC's greeting, then more on "다음 이야기", round and round. */
export const talk = { npc: null, lines: [], i: 0 };
function talkTo(n) {
  talk.npc = n; talk.lines = NpcTalk.allLines(n, talkSheet()); talk.i = 0;
  if (!talk.lines.length) talk.lines = ["…"];
  $("#talk-name").textContent = n.name;
  talkShow();
  openWin("talk");
}
function talkShow() {
  $("#talk-text").textContent = talk.lines[talk.i % talk.lines.length];
  // side quests from the map editor: what this NPC offers (sidequests.js)
  if (!$("#talk-sq")) { const box = el("div", "talk-sq"); box.id = "talk-sq"; $("#talk-text").parentNode.append(box); }
  shown.talk = null;
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
