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
import * as FairMkt from "./fairmkt.js";
import * as Chores from "./chores.js";
import * as Rest from "./rest.js";
import * as Charms from "./charms.js";
import * as NPC from "./npclife.js";
import * as Sky from "./sky.js";
import { G, T, now, dist, $, el } from "./state.js";
import { act } from "./wire.js";
import { toast, openWin, closeWin, addChat, shown } from "./windows.js";
import { K } from "./keymap.js";
import { portrait } from "./talkui.js";
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
  if (!s || G.me.dead || G.elementSpeed === 0) return false;
  const sk = G.defs.skills[id];
  if (!sk || sk.kind === "p") return false;
  const t = now();
  if (carryNo()) return false;
  const why = QS.skillWhy(id);
  if (why) { if (!G.auto) { toast(why); Sound.play("no"); } return false; }
  const mpc = QS.skillMp(id);          // a full resonance makes a staff skill free
  const hpc = QS.skillHp(id);
  if (hpc && G.me.hp <= hpc) { if (!G.auto) toast("HP가 부족합니다"); return false; }
  if (t < (G.cdEnd[id] || 0) || G.me.mp < mpc) { if (G.me.mp < mpc && !G.auto) toast("MP가 부족합니다"); return false; }
  act({ t: "sk", id, a: G.me.aimI });
  G.cdEnd[id] = t + (G.skw?.get(id)?.[5] ?? sk.cd * (1 - (s.dv ? s.dv[3] : 0) / 100));
  G.lastSkill = t; G.comboWeapon = null;
  if (sk.support) return true;
  G.me.atkT = t; G.me.atkN = 2; G.lastAtk = t;
  if (sk.wk === "hammer") { G.me.hammerWind = sk.wind; G.me.atkN = 0; preHammerAim(); }
  else preAim(aimCone());
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
  if (missing <= 0) { if (!G.auto) toast(kind === "hp" ? "HP가 가득 차 있습니다" : "MP가 가득 차 있습니다"); return; }   // a key press always answers
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
/** Holding a parcel or a crate (me.carry): no attack or skill until it is handed over or the 알바 is dropped. */
function carryNo() {
  if (!G.me.carry) return false;
  if (!G.auto && now() - (G.carryWarn || 0) > 1500) { G.carryWarn = now(); toast("배달 중에는 공격할 수 없어요 — 알바를 그만두면 상자를 내려놓아요"); Sound.play("no"); }
  return true;
}
export function attack() {
  const t = now();
  if (G.elementSpeed === 0) return;
  if (carryNo()) return;
  if (t - G.lastAtk < G.self.acd) return;
  // Predict the next beat using the same weapon and window as the server.
  const kind = G.self.wk, wk = G.defs.wkinds?.[kind];
  const chained = t - G.lastAtk < G.self.acd + 700;
  G.combo = kind === "hammer" ? 0 : kind === "sword" ? (chained && G.comboWeapon === kind ? 1 - (G.combo | 0) : 0) :
    chained && G.comboWeapon !== "sword" ? ((G.combo | 0) + 1) % 3 : 0;
  G.comboWeapon = kind;
  G.me.atkN = G.combo;
  G.lastAtk = t; G.me.atkT = t;
  G.impactAt = t + S3.impactMs(G.self.wk, G.combo);
  if (kind === "hammer") { G.me.hammerWind = wk.wind; preHammerAim(); }
  else preAim((wk && wk.arc) || aimCone());
  G.aimFlash = t;
  act({ t: "atk", a: G.me.aimI });
}
/**
 * Space: the dash (59-dash.js) the way the aim points. Only the clock lives here: the server moves the hero
 * and snaps the position (me[5]); the trail is drawn from its "ds" event (skillfx.js). me[11] keeps the clock true.
 */
export function dash() {
  const me = G.me, t = now();
  if (me.dead || !G.self || G.elementSpeed === 0 || t < (G.dashEnd || 0)) return;
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
function preHammerAim() {
  const me = G.me, [x, y] = aimVec(me.aimI);
  me.hammerYaw = (me.aimI / aimN()) * 2 * Math.PI;
  me.aim = [me.x + x * 24, me.y + y * 24];
}
/** Aim at a point on the ground (a monster clicked, the auto-hunt's quarry). */
export function aimAtPoint(x, y) { if (Math.hypot(x - G.me.x, y - G.me.y) > 1) G.me.aimI = aimIdx(x - G.me.x, y - G.me.y); }
/** Turn toward the nearest monster within reach inside the arc of the aim the moment the swing
 *  starts, as the server will; with none there the swing goes straight ahead. The server's own
 *  word on the target arrives a moment later and only corrects this. */
function preAim(arcDeg) {
  const me = G.me, reach = (G.self.range || 40) + 24, [ax, ay] = aimVec(me.aimI), half = (arcDeg * Math.PI) / 180 + 0.2;
  let best = null, bd = reach;
  for (const m of G.mobs.values()) {
    if (m.bst === 2) continue;   // dived out of reach: the server will not aim at it either
    const dx = m.x - me.x, dy = m.y - me.y, d = Math.hypot(dx, dy);
    if (d < bd && (d < 4 || Math.acos(Math.max(-1, Math.min(1, (dx * ax + dy * ay) / d))) <= half)) { bd = d; best = m; }
  }
  if (best) me.aim = [best.x, best.y + 6];
  else me.aim = [me.x + ax * 30, me.y + ay * 30 + 6];
}

const visiting = new Map();
export function nearestNpc() {
  let best = null, bd = 40;
  const server = Sky.serverNow();
  for (const n of G.map.npcs) {
    const actor = NPC.cast(n.id);
    if (actor ? !S3.npcService(n) && !NPC.at(n.id, server)?.onPost : !S3.npcOut(n)) continue;
    // a keeper behind a counter (the cafe, the inn) is served across it: a little further, still in the server's reach (56)
    // so is a life station (쥬쥬의 화덕 sits right beside 쥬쥬's counter: step to its side to reach it)
    const d = dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12) - (n.goods || STATION_ROLE.has(n.role) ? 14 : 0);
    if (d < bd) { bd = d; best = n; }
  }
  for (const body of NPC.list(server)) {
    if (body.onPost || body.fade < 0.5) continue;
    const d = dist(G.me.x, G.me.y, body.x, body.y);
    if (d >= bd) continue;
    if (!visiting.has(body.id)) visiting.set(body.id, { id: body.id, role: "talk", offDuty: true });
    const n = visiting.get(body.id);
    Object.assign(n, { name: body.name, originRole: body.role, x: (body.x - 8) / T, y: (body.y - 12) / T });
    bd = d; best = n;
  }
  for (const m of G.map.marks || []) {
    if (m.kind !== "waypoint") continue;
    const d = dist(G.me.x, G.me.y, m.x * T + 8, m.y * T + 8);
    if (d < bd) { bd = d; best = STONE; }
  }
  return best;
}
const STATION_ROLE = new Set(["craft", "alch", "cook"]);
const SERVICE_WINDOWS = {
  shop: "shop", smith: "smith", elder: "quest", stone: "warp", warp: "warp", daily: "daily",
  collector: "collect", achieve: "achieve", train: "train", job: "job", bank: "bank", costume: "costume",
  dim: "dim", house: "house", craft: "craft", alch: "craft", cook: "craft", charm: "juana", jobs: "board", fairmkt: "fairmkt",
};
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
  if (Chores.interact()) return;                   // a village chore's spot in reach, or the can to fill (chores.js)
  if (Rest.interact()) return;                     // a resting spot in reach: sit down (rest.js)
  // with nobody to talk to: a gathering node in reach (gather.js), else water is for fishing
  // with nobody to talk to: a node, then a campfire's 요리 window (station.js), then water
  if (!n) {
    if (Gather.interact()) return;
    if (fireNear() && Station.open("fire")) { Sound.play("ui"); return; }
    if (waterNear()) { act({ t: "fish" }); Sound.play("ui"); }
    return;
  }
  if (n.role === "alba") {
    Sound.play("ui");
    act({ t: "ab_start", k: n.alba, npc: n.id });
    return;
  }
  if (Board.interact(n)) return;                   // the 알바 in hand: pick up / hand in here (board.js)
  Sound.play("ui");
  SideQ.onTalk(n, G.self);
  const panel = SERVICE_WINDOWS[n.role];
  if (!panel) { talkTo(n); return; }
  if (n.role === "shop" || n.role === "smith") { openWin(panel); openWin("inv"); }
  else if (n.role === "elder") {
    if (G.self && G.self.q && G.self.q.i === 0 && G.self.q.st === 0) { talkTo(n); return; }
    openWin(panel); tutTry("talk");
  }
  else if (n.role === "dim") Dim.openKeeper();
  else if (n.role === "house") { Housing.openAgent(); openWin("inv"); }
  else if (STATION_ROLE.has(n.role)) Station.open(n.role, n.thing ? n.name : "");
  else if (n.role === "charm") Charms.openJuana();
  else if (n.role === "jobs") openWin("alba");   // 포포: the 일일 아르바이트 list (alba.js)
  else if (n.role === "fairmkt") FairMkt.open(n);
  else openWin(panel);
  setServiceTalk(panel, n);
  // the townsfolk have a word to say as they serve you (npctalk.js)
  const away = NPC.cast(n.id) && !NPC.at(n.id)?.onPost;
  const line = away ? serviceNotice(n) : n.role !== "stone" && NpcTalk.lineFor(n, talkSheet());
  if (line) addChat(line, "npc", n.name);
}
/** The service window still opens at a post. Its story button uses the same quest cards as a conversation. */
function setServiceTalk(panel, n) {
  const header = $(`#w-${panel} > header`);
  if (!header) return;
  let chip = header.querySelector(".service-talk");
  if (!n.id || n.thing) { if (chip) chip.hidden = true; return; }
  if (!chip) {
    chip = el("button", "btn small service-talk", "");
    chip.addEventListener("pointerdown", (e) => e.stopPropagation());
    header.insertBefore(chip, header.querySelector(".x"));
  }
  const mark = SideQ.mark(n, G.self);
  chip.hidden = false;
  chip.textContent = mark ? `이야기 ${mark}` : "이야기";
  chip.title = NPC.cast(n.id) && !NPC.at(n.id)?.onPost ? serviceNotice(n) : `${n.name}의 이야기`;
  chip.onclick = () => {
    const post = G.map?.npcs.find((q) => q.id === n.id);
    if (G.me.dead || !post || dist(G.me.x, G.me.y, post.x * T + 8, post.y * T + 12) >= 56) { toast("안내판 가까이에서 이야기를 확인할 수 있습니다."); return; }
    SideQ.onTalk(post, G.self);
    talkTo(post);
  };
}
function serviceNotice(n) {
  const person = NPC.cast(n.id);
  const place = NPC.locations().find((p) => p.id === n.id);
  const present = NPC.at(n.id);
  const at = place?.place ? `${place.place}에서 ${NPC.actName(place.act)}` : present ? NPC.actName(present.act) : "자리 비움";
  const cover = person?.cover && NPC.cast(person.cover);
  const service = cover ? `${cover.name}에게 맡기거나 안내판을 이용하세요.` : "안내판에서 업무를 이용할 수 있습니다.";
  return `${at}. ${service}`;
}
/**
 * The talk window: the NPC's greeting and a menu (mode "home": 잡담하기 · 퀘스트 · 닫기); 잡담하기 ("chat") goes through the
 * NPC's lines on "다음 이야기", 퀘스트 ("quest") shows the quest and 알바 cards. #w-talk[data-mode] hides the rest (hud.css).
 */
export const talk = { npc: null, lines: [], i: 0, at: 0, mode: "home" };
/** Does the talk window hold a quest or 알바 card (sidequests.js renderTalk, board.js renderTalk)? */
const talkHasQuest = () => !!$("#w-talk .talk-sq > *, #w-talk .talk-jb > *");
/** Switch the talk window's page. */
function talkMode(m) { talk.mode = m; if (m === "chat") talk.i = talk.lines.length > 1 ? 1 : 0; talkShow(); }
/** Keep the menu's 퀘스트 button in step with the cards (hud.js redraws them after the window opens). */
export function talkMenuSync() {
  const q = $("#talk-q"), mq = $("#talk-mainq");
  if (!q || !talk.npc) return;
  const isElder = talk.npc.role === "elder";
  const mainQ = isElder && G.self && G.defs?.quests?.[G.self.q?.i];
  const mainReady = !!mainQ && (G.self.q.st === 0 || G.self.q.n >= mainQ.n);
  if (mq) {
    mq.hidden = !mainQ;
    const mk = !mainQ ? "" : G.self.q.st === 0 ? " !" : G.self.q.n >= mainQ.n ? " ?" : "";
    mq.textContent = `[${K("talkNext")}] 주요 의뢰${mk}`;
    mq.classList.toggle("gold", mainReady);
  }
  const has = talkHasQuest(), mark = SideQ.mark(talk.npc, G.self);
  q.hidden = !has;
  q.textContent = `${mainReady ? "" : `[${K("talkNext")}] `}퀘스트${mark ? " " + mark : ""}`;
  q.classList.toggle("gold", !!mark);
  $("#talk-chat").textContent = has || mainReady ? "잡담하기" : `[${K("talkNext")}] 잡담하기`;
  // the quest page with nothing left on it (the last card handed in) goes back to the menu
  if (talk.mode === "quest" && !has) talkMode("home");
}
/**
 * The dialogue keys while the talk window is open (input.js): "talkNext" shows the next line, and on the last
 * one presses the window's gold button (accept / hand in, as a click would) or closes it; "talkEnd" closes it.
 */
export function talkKey(a) {
  if (a === "talkEnd") { if (talk.mode === "home") closeWin("talk"); else talkMode("home"); Sound.play("ui"); return; }
  if (now() - talk.at < 250) return;          // the F that opened the window must not skip its first line
  // the menu: F opens main quest at Elderwin when ready, else side quests, else chat
  if (talk.mode === "home") {
    const mq = $("#talk-mainq");
    if (mq && !mq.hidden && mq.classList.contains("gold")) { mq.click(); return; }
    talkMode(talkHasQuest() ? "quest" : "chat"); Sound.play("blip"); return;
  }
  if (talk.mode === "quest") {
    const go = $("#w-talk").querySelector(".talk-sq .btn.gold:not(:disabled), .talk-jb .btn.gold:not(:disabled)");
    if (go) go.click(); else talkMode("home");
    return;
  }
  if (talk.i % talk.lines.length < talk.lines.length - 1) { talk.i++; talkShow(); Sound.play("blip"); return; }
  talkMode("home"); Sound.play("ui");
}
function talkTo(n) {
  talk.npc = n; talk.i = 0; talk.at = now(); talk.mode = "home";
  const person = NPC.cast(n.id);
  const at = NPC.at(n.id);
  const spot = NPC.locations().find((p) => p.id === n.id);
  const actName = at?.act ?? spot?.act;
  const lines = NPC.lines(n.id);
  const special = lines && (at?.with && lines.with || Sky.weather() === Sky.WX.rain && lines.rain
    || Sky.nightK() > 0.5 && lines.night || lines[actName] || (!at?.onPost && lines.off));
  talk.lines = special?.length ? special : NpcTalk.allLines(n.originRole ? { ...n, role: n.originRole } : n, talkSheet());
  if (!talk.lines.length) talk.lines = ["…"];
  $("#talk-name").textContent = n.name;
  portrait(n);
  refreshNpcTalk();
  if (person && NPC.needsWhere()) { NPC.markWhereAsked(); act({ t: "nw" }); }
  talkShow();
  openWin("talk");
}
export function refreshNpcTalk() {
  const n = talk.npc;
  if (!n || !G.map) return;
  const person = NPC.cast(n.id), at = NPC.at(n.id), spot = NPC.locations().find((p) => p.id === n.id);
  const actName = at?.act ?? spot?.act;
  let where = $("#talk-where");
  if (!where) {
    where = el("p", "hint", "");
    where.id = "talk-where";
    $("#talk-text").before(where);
  }
  const actText = actName ? NPC.actName(actName) : "";
  where.hidden = !person || !actText;
  const place = at ? (spot?.map === G.map.id ? spot.place : G.map.name) : spot?.place;
  const friend = G.defs.life?.rep?.tier?.[1];
  const trust = G.self?.rep?.[n.id] || 0;
  where.textContent = actText ? `지금 ${actText}${place ? " · " + place : ""}${friend && trust >= friend && spot?.nextPlace ? " · 다음 " + spot.nextPlace : ""}` : "";
  // a keeper met off duty only chats: say where the shop (training, …) still works
  if (actText && n.offDuty && SERVICE_WINDOWS[n.originRole]) where.textContent += " · 업무는 안내판에서";
}
function talkShow() {
  const w = $("#w-talk"), chat = talk.mode === "chat";
  w.dataset.mode = talk.mode;
  $("#talk-text").textContent = talk.lines[chat ? talk.i % talk.lines.length : 0];
  // side quests from the map editor: what this NPC offers (sidequests.js)
  if (!$("#talk-sq")) { const box = el("div", "talk-sq"); box.id = "talk-sq"; $("#talk-text").parentNode.append(box); }
  shown.talk = null;
  // the menu: 잡담하기 · 퀘스트 (when there is one) · 닫기
  let menu = $("#talk-menu");
  if (!menu) {
    menu = el("div", "talk-menu"); menu.id = "talk-menu";
    const b = (id, cls, fn) => { const x = el("button", cls, ""); x.id = id; x.addEventListener("click", () => { fn(); Sound.play("blip"); }); menu.append(x); return x; };
    b("talk-chat", "btn", () => talkMode("chat"));
    b("talk-mainq", "btn", () => {
      const npc = talk.npc;
      closeWin("talk");
      tutTry("talk");
      openWin("quest");
      if (npc) setServiceTalk("quest", npc);
    });
    b("talk-q", "btn", () => talkMode("quest"));
    b("talk-bye", "btn", () => closeWin("talk")).textContent = `[${K("talkEnd")}] 닫기`;
    $("#talk-text").after(menu);
  }
  talkMenuSync();
  let more = $("#talk-more");
  if (!more) {
    more = el("button", "btn small", "");
    more.id = "talk-more";
    more.addEventListener("click", () => { talk.i++; talkShow(); Sound.play("blip"); });
    menu.after(more);
  }
  more.hidden = !chat || talk.lines.length < 2;
  // on the last line F closes (below), so this button no longer claims F: a click starts over
  const last = talk.i % talk.lines.length === talk.lines.length - 1;
  more.textContent = last ? `처음부터 (${talk.lines.length}/${talk.lines.length})` : `[${K("talkNext")}] 다음 이야기 (${(talk.i % talk.lines.length) + 1}/${talk.lines.length})`;
  let end = $("#talk-end");
  if (!end) {
    end = el("button", "btn small", "");
    end.id = "talk-end";
    end.addEventListener("click", () => { talkMode("home"); Sound.play("ui"); });
    more.after(end);
  }
  // chat and quest pages: C (and F on the last line) go back to the menu
  end.hidden = talk.mode === "home";
  end.textContent = `[${chat && last ? `${K("talkNext")}/` : ""}${K("talkEnd")}] 돌아가기`;
}
