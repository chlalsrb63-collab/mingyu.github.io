/**
 * The 알바 board, delivery and trust (L2c; docs/design/life-and-coop.md H2, H5).
 * - Board window `#w-board` (WIN id `board`): F at 알바 중개인 포포 (role `jobs`) or the 생활 window's button opens
 *   it. It lists today's offers from `self.jb = [day, offers, doneIds, active]` (offers `[id, kind, npcName, text,
 *   gold, skIdx]`), the job in hand and today's finished ones. 맡기 → `jb {a:"take", id}` (only beside 포포; the
 *   board can be read anywhere), 그만두기 → `jb {a:"drop"}`.
 * - Hand-ins: beside the job's NPC (a delivery: the sender to pick up, the recipient to hand over) F sends
 *   `jb {a:"pick"}` / `jb {a:"give"}` — the prompt names it (`promptFor`), and a talk window shows an 알바 card
 *   with the same button (`renderTalk`). Items are counted in the bag + 재료 주머니, as the server does.
 * - A parcel in hand (`active[1] === 1`): the `#dl` countdown bar (from `secsLeft`, counted down locally) and a
 *   the box in the carrier's hands (the snapshot's carry code: scene_people.js + carry.js, for everyone).
 * - Trust: `self.rep = [[npcId, n]…]`, tiers `defs.life.rep`; `repBadge` (talk window, shop header),
 *   `renderLife` (the 생활 window's 알바 card and 신뢰 list). `trackRows` puts the job in the quest tracker.
 * Where an NPC lives is not in defs: `HOME` below (npc id → map id; map names come from defs.maps).
 */

import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import { G, $, el, dist, T, now, clamp } from "./state.js";
import { act, entityPos } from "./wire.js";
import { openWin, isOpen, toggleWin } from "./windows.js";
import { countItem } from "./actions.js";
import { iconImg } from "./uiicons.js";
import * as Info from "./infocard.js";
import { floatText } from "./events.js";
import * as Track from "./track.js";
import * as Keymap from "./keymap.js";
import * as Mini from "./minigames.js";
import * as Sky from "./sky.js";

/** The map each 알바 NPC stands on (static NPCs of the town, its interiors and 버드나무 마을). */
const HOME = {
  popo: "town_hall", hall_bori: "town_hall", smith: "town", bank: "town", bogle: "bogle_lab", dongdong: "dongdong_apt",
  store_dari: "general_store", juju: "juju_diner", diner_piri: "juju_diner", forge_musoe: "kangkang_forge",
  kangkang: "kangkang_forge", merc_grey: "merc_office", lib_borum: "owl_library", inn_maru: "starlight_inn",
  cafe_moka: "tales_cafe", willow_elder: "willow", willow_fisher: "willow", willow_florist: "willow",
  // board v2
  guard: "town", story: "town", diner_reg1: "juju_diner", diner_reg2: "juju_diner", store_kong: "general_store",
  inn_toto: "starlight_inn", inn_lira: "starlight_inn", hall_pipi: "owl_library", cafe_lumi: "tales_cafe", cafe_somi: "tales_cafe",
  merc_mimi: "merc_office", willow_bard: "willow", forge_tong: "kangkang_forge",
  willow_repair: "willow", willow_kitchen: "willow",
  // 버드나무 마을's chore givers (H10)
  willow_dairy: "willow", willow_granny: "willow", willow_flyer: "willow", willow_sweeper: "willow", willow_farmer: "willow",
  // 버드나무 장날 (P12): 장꾼 다래 by the market stalls
  willow_fair: "willow",
};
const KIND = { bring: ["가져오기", "#9be05a"], make: ["만들기", "#c8c8d8"], fish: ["낚시", "#8ad8ff"], deliver: ["배달", "#e2c486"], hunt: ["토벌", "#ff8a7a"], scout: ["정찰", "#b9a2ff"], chore: ["마을 알바", "#7ad8a0"] };
/** Board v2 grade tags: 쉬움 · 보통 · 어려움 (names from defs.life.jbGrade). */
const GRADE_BG = ["#9be05a", "#ffd36a", "#ff8a6a"];
const WHEN = { night: "밤 한정", rain: "비 오는 날" };
const GLYPH = ["fish", "fire", "life", "anvil", "drop", "bag"];

const st = { until: 0, full: 0, urgUntil: 0, ref: null, sent: 0 };
window.__board = st;

const D = () => G.defs && G.defs.life;
const J = (id) => (D() && D().jb[id]) || null;
/**
 * The job in hand: { id, prog, n (graded need), secs (parcel, timed chore), urg (긴급 secs, -1 missed), got (hunt kills /
 * scout 0-1 / chore acts), spots (a chore's [[x, y, done]…]), fill (acts carried), t } or null.
 */
export function active(s = G.self) {
  const a = s && s.jb && s.jb[3];
  if (!a || !J(a[0])) return null;
  return { id: a[0], prog: a[1], n: a[2], secs: a[3], urg: a[4] || 0, got: a[5] || 0, spots: a[6] || null, fill: a[7] || 0, t: J(a[0]) };
}
const chOf = (a) => (a && a.t.kind === "chore" && D().chores[a.t.job]) || null;
/** A timed chore on its clock (the milk): the countdown bar, like a parcel. */
const onClock = (a) => !!(chOf(a) && chOf(a).timed && a.fill > 0 && a.secs > 0);
const mobName = (k) => ((G.defs.mobs || {})[k] || { name: k }).name;
const mapName = (id) => ((G.defs.maps || []).find((x) => x.id === id) || { name: id }).name;
/** The offer row's grade for a job in hand (the grade lives in the day's offers). */
const gradeOf = (s, id) => { const o = s.jb && s.jb[1].find((r) => r[0] === id); return o ? o[6] || 0 : 0; };
const delivering = (a) => a && a.t.kind === "deliver" && a.prog === 1;
export const repOf = (s, id) => { const r = s && s.rep; if (!r) return 0; if (Array.isArray(r)) { const e = r.find((x) => x[0] === id); return e ? e[1] : 0; } return r[id] || 0; };
/** Trust tier 0 (none) … 3 (가족). */
/** Jobs done today that count toward perDay (장날 rows do not, 63-festival.js). */
const doneN = (done) => done.filter((id) => !J(id)?.fair).length;
const tierOf = (n) => D().rep.tier.filter((x) => n >= x).length;
const have = (s, id) => countItem(id) + ((s.pouch || {})[id] || 0);
const itemName = (id) => (G.defs.items[id] || { name: id }).name;
const npcLabel = (id) => { const j = D() && Object.values(D().jb).find((t) => t.npc === id || t.to === id); return j ? (j.npc === id ? j.npcName : j.toName) : id; };
/** "보글연금공방" — and "(여기)" when the NPC stands on this map. */
function placeOf(id) {
  const m = HOME[id], here = G.map && G.map.npcs.some((n) => n.id === id);
  const name = m ? ((G.defs.maps || []).find((x) => x.id === m) || { name: m }).name : "";
  return here ? `${name || "이곳"} (여기)` : name;
}
/** Who the job in hand wants next, and what for. */
function nextStep(a) {
  if (a.t.kind === "deliver") return a.prog === 1 ? { npc: a.t.to, verb: "꾸러미 전하기" } : { npc: a.t.npc, verb: "꾸러미 받기" };
  if (a.t.kind === "hunt") return { npc: a.t.npc, verb: "토벌 보고하기" };
  if (a.t.kind === "scout") return { npc: a.t.npc, verb: "정찰 보고하기" };
  if (a.t.kind === "chore") {
    if (a.got >= a.n) return { npc: a.t.npc, verb: "알바 보고하기" };
    // still spots to do: the giver only when the chore starts from them (the milk crate, the leash), else the spots themselves
    return chOf(a).src === "npc" && !a.fill ? { npc: a.t.npc, verb: `${chOf(a).name} 시작하기` } : { npc: "", verb: `${chOf(a).name} ${a.got}/${a.n}` };
  }
  return { npc: a.t.npc, verb: `${itemName(a.t.item)} 전하기` };
}
/** Hand-in progress of the job in hand: [label, have, need] (null for deliveries). */
function progOf(s, a) {
  if (a.t.kind === "deliver") return null;
  if (a.t.kind === "hunt") return [mobName(a.t.mob), a.got, a.n];
  if (a.t.kind === "scout") return [`${mapName(a.t.map[Math.min(gradeOf(s, a.id), a.t.map.length - 1)])} 다녀오기`, a.got, 1];
  if (a.t.kind === "chore") return [chOf(a).name, a.got, a.n];
  return [itemName(a.t.item), have(s, a.t.item), a.n];
}
/** What F does beside NPC `n` for the job in hand: { a, label } or null. */
function ready(s, n) {
  const a = active(s);
  if (!a || !n || !n.id) return null;
  const nx = nextStep(a);
  if (n.id !== nx.npc) return null;
  if (a.t.kind === "deliver") return a.prog === 1 ? { a: "give", label: "꾸러미 전하기" } : { a: "pick", label: "꾸러미 받기" };
  if (a.t.kind === "chore" && a.got < a.n && chOf(a).src === "npc" && !a.fill) return { a: "pick", label: nx.verb };
  const pr = progOf(s, a);
  if (pr[1] < pr[2]) return null;
  return { a: "give", label: a.t.item ? `${itemName(a.t.item)} ×${a.n} 전하기` : nx.verb };
}
/** The 알바 mark over NPC `n` (overlay.js, green): "?" when F there does the job's next step, "!" over a 알바 board
 *  (role jobs) while today's offers are still open and no job is in hand, else "". */
export function markFor(n, s = G.self) {
  if (!s || !s.jb || !D() || !n) return "";
  if (ready(s, n)) return "?";
  const [, offers, done] = s.jb;
  return n.role === "jobs" && !active(s) && offers.some((o) => !done.includes(o[0]) && (J(o[0])?.fair || doneN(done) < D().jbPay.perDay)) ? "!" : "";
}
/** The F prompt's text at NPC `n` when it would do a job step, else "". */
export function promptFor(n) {
  const r = G.self && ready(G.self, n);
  return r ? `${n.name} — 알바: ${r.label}` : "";
}
/** F beside an NPC: the job step if there is one (true), else nothing (false: the NPC's usual window). */
export function interact(n) {
  const r = G.self && ready(G.self, n);
  // 장꾼 다래 (role `fair`): her stall is the 장날 card on top of this window
  if (!r && n.role === "fair") { Sound.play("ui"); return open(); }
  if (!r) return false;
  if (now() - st.sent < 900) return true;
  st.sent = now();
  act({ t: "jb", a: r.a });
  Sound.play("ui");
  return true;
}
const nearPopo = () => !!(G.map && G.me && G.map.npcs.some((n) => n.role === "jobs" && dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12) < 52));
const hallCrew = () => (G.party || []).filter((p) => p[9] === G.map?.id).length;
const partyLead = () => G.party?.[0]?.[0] === G.you;

// ───────────────────────────── the board window ─────────────────────────────

export function open() { if (!D() || !D().jb) return false; openWin("board"); return true; }
export function key() {
  const s = G.self, a = active(s);
  return [s.fair, Sky.fairOn(), Sky.seasonName(), nearFair(), s.cos && s.cos.own.length, s.jb && [s.jb[0], s.jb[1], s.jb[2], s.jb[3] && [...s.jb[3].slice(0, 3), Math.sign(s.jb[3][4] || 0), s.jb[3][5], s.jb[3][7]]], s.rep, nearPopo(), a && a.t.item ? have(s, a.t.item) : 0, G.map && G.map.id, hallCrew(), partyLead(), s.coop];
}
/** The 알바 board (#board-body): life work only. With `into`, the day's hunting jobs instead, as cards in that box (the 토벌 의뢰 window). */
export function render(s, into) {
  const hunt = !!into, box = into || $("#board-body");
  if (!hunt) box.textContent = "";
  if (hunt && (!s.jb || !D())) return;
  if (!s.jb || !D()) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const [, offers, done] = s.jb, per = D().jbPay.perDay, a = active(s), near = nearPopo(), nDone = doneN(done);
  const top = el("div", "daily-top");
  top.append(iconImg("note", "#e2c486"), el("span", "", `오늘의 알바 ${nDone}/${per}`), Info.coin(s.gold, "purse"));
  if (!hunt) box.append(top);
  if (!hunt && G.defs.fair && (Sky.fairOn() || G.map?.id === G.defs.fair.map)) fairCard(box, s);
  const pipe = G.defs.coop?.jobs?.pipe, atPipe = !hunt && pipe && near && pipe[5] === G.map?.id;
  if (atPipe) {
    const card = el("div", "dcard jb-card cp-offer"), buttons = el("div", "btns");
    const paid = s.coop?.includes("pipe");
    const start = el("button", "btn gold", paid ? "협동 배관 수리 다시 하기" : "협동 배관 수리");
    start.id = "coop-pipe-start"; start.type = "button"; start.disabled = !partyLead() || hallCrew() < 2;
    start.addEventListener("click", () => act({ t: "coop_start", k: "pipe" }));
    card.append(el("b", "", pipe[0]), el("p", "hint", "회관에 모인 2~4명이 급수구와 배수구를 5분 안에 연결합니다."));
    if (start.disabled) card.append(el("p", "hint", hallCrew() < 2 ? "파티원과 함께 포포에게 와 주세요." : "파티장이 시작할 수 있습니다."));
    card.append(el("p", "hint", paid
      ? "오늘 보수 수령 완료 · 보수 없이 다시 참여할 수 있어요. 조건을 충족한 미수령 팀원은 보수를 받아요."
      : "오늘 보수 수령 가능 · 배관 연결에 기여하면 보수를 받아요."));
    buttons.append(start); card.append(buttons); box.append(card);
  }
  if (a && hunt === (J(a.id)?.kind === "hunt")) box.append(jobCard(s, a, true));
  if (!hunt) box.append(el("div", "section", "오늘의 의뢰"));
  if (!hunt && !offers.length) box.append(el("p", "hint", "오늘은 맡을 수 있는 알바가 없습니다. 생활 기술을 키우면 일이 늘어납니다."));
  const inWillow = ([id]) => HOME[J(id)?.npc] === "willow";
  const listed = G.map?.id === "willow" ? [...offers].sort((x, y) => Number(inWillow(y)) - Number(inWillow(x))) : offers;
  const rows = listed.filter((o) => hunt === (o[1] === "hunt"));   // hunting is 토벌 의뢰's, the rest is the board's
  if (hunt && !rows.length) box.append(el("p", "hint", "오늘은 마을에서 들어온 토벌 의뢰가 없습니다."));
  for (const o of rows) {
    const [id, kind, who, text, gold, si, g = 0, need = 0, rush = 0] = o, t = J(id), fin = done.includes(id), mine = a && a.id === id;
    const card = el("div", "dcard jb-card" + (fin ? " done" : mine ? " on" : ""));
    const hd = el("div", "dh");
    const nm = el("b", "");
    nm.append(iconImg(kind === "hunt" ? "sword" : GLYPH[si] || "bag", KIND[kind] ? KIND[kind][1] : "#e2c486"), document.createTextNode(` ${who}`));
    const tags = el("span", "");
    const tag = (txt, bg) => { const x = el("span", "tag", txt); if (bg) x.style.background = bg; x.style.marginLeft = "3px"; tags.append(x); };
    if (t && t.when) tag(WHEN[t.when], "#8aa8ff");
    if (t && t.fair) tag("장날", "#ffb04a");
    if (t && t.rep) tag(`${D().rep.name[D().rep.tier.indexOf(t.rep)] || "단골"} 전용`, "#e6a0d8");
    if (rush) tag(`긴급 ${rush}분`, "#ff6a5a");
    tag((D().jbGrade || { name: ["쉬움"] }).name[g], GRADE_BG[g]);
    tag((KIND[kind] || [kind])[0]);
    hd.append(nm, tags);
    card.append(hd, el("p", "say", t ? sayN(text, t.n, need) : text));
    // what this grade asks: more items / monsters, a further map, a tighter clock
    const ask = kind === "deliver" ? (g ? `제한 시간 ×${D().jbGrade.lim[g]}` : "")
      : kind === "scout" && t ? `목적지: ${mapName(t.map[Math.min(g, t.map.length - 1)])}`
      : kind === "hunt" && t ? `${mobName(t.mob)} ${need}마리` : kind === "chore" && t ? `${D().chores[t.job].spot} ${need}곳 · 버드나무 마을` : t && t.item ? `${itemName(t.item)} ×${need}` : "";
    if (ask || rush) card.append(el("small", "where", [ask, rush ? `${rush}분 안에 끝내면 보수 ×${D().jbRush.bonus} (늦어도 기본 보수)` : ""].filter(Boolean).join(" · ")));
    const ft = el("div", "df");
    const pay = el("small", "pay");
    if (t && t.fair) pay.append(`장날 토큰 ${G.defs.fair.job[g]}개`);
    else pay.append(Info.coin(gold), kind === "deliver" ? ` + 팁 최대 ${Math.round(D().jbPay.tip * 100)}%` : rush ? ` (긴급 ${Math.round(gold * D().jbRush.bonus)})` : "", g ? ` · 보상 ×${D().jbGrade.pay[g]}` : "");
    const lvName = kind === "hunt" ? "레벨" : D().names[si];
    const lvl = t ? el("small", "", `${lvName} Lv.${t.lv}+ · ${kind === "deliver" ? `${placeOf(t.npc)} → ${placeOf(t.to)}` : placeOf(t.npc)}`) : el("small", "");
    ft.append(pay, lvl);
    card.append(ft);
    if (fin) card.append(el("small", "ok", hunt ? "오늘 끝낸 토벌입니다" : "오늘 끝낸 알바입니다"));
    else if (mine) card.append(el("small", "ok", hunt ? "맡은 토벌입니다" : "맡은 알바입니다"));
    else {
      const why = a ? "이미 맡은 알바가 있습니다" : !(t && t.fair) && nDone >= per ? `알바는 하루에 ${per}개까지입니다` : !near ? "버드나무 마을 알바 게시판 곁에서 맡을 수 있습니다" : "";
      const btns = el("div", "btns"), b = el("button", "btn gold", "수락");
      b.disabled = !!why;
      if (why) b.title = why;
      b.addEventListener("click", () => { act({ t: "jb", a: "take", id }); Sound.play("board_take"); });
      btns.append(b);
      if (why) btns.append(el("small", "why", why));
      // away from the board: [추적] walks to 포포 to take it (track.js)
      const go = !near && !a && Track.button("popo", "알바 중개인 포포");
      if (go) btns.append(go);
      card.append(btns);
    }
    box.append(card);
  }
  if (hunt) return;
  // the co-op shifts: each owner's lobby, with a [추적] to it (coop.js runs the shift itself)
  const coop = Object.entries((G.defs.coop && G.defs.coop.jobs) || {});
  if (coop.length) {
    box.append(el("div", "section", "협동 알바"));
    for (const [k, j] of coop) {
      if (k === "pipe" && atPipe) continue;
      const row = el("div", "trk-row");
      row.append(el("small", "", `${j[0]} · ${npcLabel(j[4]) === j[4] ? "" : npcLabel(j[4]) + " · "}${placeOf(j[4]) || mapName(j[5])}`));
      const b = Track.button(`coop:${k}`, j[0]);
      if (b) row.append(b);
      box.append(row);
    }
  }
  const extra = done.filter((id) => !offers.some((o) => o[0] === id));
  if (extra.length) {
    box.append(el("div", "section", "오늘 끝낸 알바"));
    for (const id of extra) { const t = J(id); box.append(el("p", "ds", `✓ ${t ? t.text : id}`)); }
  }
  box.append(el("p", "hint", `하루에 ${per}개까지 · 매일 아침 6시에 새 의뢰 · 끝낸 알바마다 그 주민의 신뢰가 쌓입니다 (${D().rep.name[0]}: 가게 5% 할인, 보수 +10%).`));
}
// ───────────────────────────── 버드나무 장날 (P12, 63-festival.js) ─────────────────────────────

const nearFair = () => !!(G.map && G.me && G.map.npcs.some((n) => n.role === "fair" && dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12) < 52));
/** The market card: hours, the token purse (today's cap), the cooking contest, and 장꾼 다래's stall for this season. */
function fairCard(box, s) {
  const F = G.defs.fair, [tok = 0, today = 0, pan = 0, top = 0, who = ""] = s.fair || [], open = Sky.fairOn(), near = nearFair();
  const card = el("div", "dcard jb-card" + (open ? " on" : ""));
  const days = F.days.map((d) => "일월화수목금토"[d]), hd = el("div", "dh"), tags = el("span", ""), tg = el("span", "tag", open ? "열림" : days.join("·"));
  tg.style.background = open ? "#ffb04a" : "#8a8a9a";
  tags.append(tg);
  hd.append(el("b", "", "버드나무 장날"), tags);
  card.append(hd, el("p", "say", `매주 ${days.join("·")}요일 ${F.open}:00–${F.close}:00 · 떠돌이 상인들이 모이고, 장날 알바와 요리 대회로 장날 토큰을 모아 이 계절의 옷과 바꿔요.`));
  card.append(el("small", "where", `장날 토큰 ${tok}개 · 오늘 ${today}/${F.cap}`));
  card.append(el("small", "where", `요리 대회 (공동 부엌·모닥불) — 내 최고 ${pan}점 · 오늘 1등 ${top ? `${top}점 ${who}` : "아직 없음"} · ${F.pan.map(([at, k]) => `${at}점 +${k}`).join(", ")}`));
  const si = F.season.indexOf(Sky.seasonName()), rows = si >= 0 ? F.shop[si] : [];
  if (rows.length) card.append(el("div", "section", `장꾼 다래의 ${F.season[si]} 좌판`));
  for (const [id, price, onSale, name, slot] of rows) {
    const row = el("div", "trk-row"), own = s.cos && s.cos.own.includes(id);
    const lb = el("small", "", onSale ? `${name} (${slot}) · 토큰 ${price}` : `사계절 ${slot} · 토큰 ${price} · 곧 들어옵니다`);
    if (onSale && G.defs.cos?.[id]?.desc) lb.title = G.defs.cos[id].desc;   // what the piece looks like, before spending a season's tokens
    row.append(lb);
    const why = !onSale ? "곧 들어옵니다" : own ? "이미 가지고 있습니다" : !near ? "장꾼 다래 곁에서 살 수 있습니다" : tok < price ? "장날 토큰이 부족합니다" : "";
    const b = el("button", "btn gold small", !onSale ? "준비 중" : own ? "보유" : "사기");
    b.type = "button"; b.disabled = !!why;
    if (why) b.title = why;
    b.addEventListener("click", () => { act({ t: "fair_buy", id }); Sound.play("fair_buy"); });
    row.append(b);
    card.append(row);
  }
  box.append(card);
}

// ───────────────────────────── the 알바 window (Shift+J) ─────────────────────────────

/** 1:05 or, past an hour, 9:01:05. */
const mmss = (ms) => { const x = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = String(x % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`; };
/** The clock of the job in hand, as the #dl bar counts it: { name, left ms } or null. */
function clockOf(t = now()) {
  const a = st.until > t && active();
  if (!a) return null;
  const name = delivering(a) ? `배달 — ${npcLabel(a.t.to)}에게` : onClock(a) ? chOf(a).name : a.urg > 0 ? `긴급 — ${npcLabel(a.t.npc)}` : "";
  return name ? { name, left: st.until - t } : null;
}
/** Each frame: the countdown lines of the 알바 window (#alba-clock, #alba-rush) and the tracker (#qt-jbclock); red under a minute. */
function clockLines(t) {
  const c = clockOf(t);
  for (const id of ["#qt-jbclock", "#alba-clock"]) {
    const n = $(id);
    if (!n) continue;
    const v = c ? `${c.name} · 남은 시간 ${mmss(c.left)}` : "";
    if (n.textContent !== v) n.textContent = v;
    if (n.hidden === !!c) n.hidden = !c;
    n.classList.toggle("late", !!c && c.left < 60000);
  }
  const r = $("#alba-rush");
  if (r) {
    const left = st.urgUntil - t, v = left > 0 ? `긴급 보너스 ×${D().jbRush.bonus} · ${mmss(left)} 남음` : "";
    if (r.textContent !== v) { r.textContent = v; r.hidden = !v; }
    r.classList.toggle("late", left > 0 && left < 60000);
  }
  const d = $("#alba-reset");
  if (d) { const v = `초기화까지 ${mmss(nextReset() - Date.now())}`; if (d.textContent !== v) d.textContent = v; }
}
/** The next 6 AM (KST) daily reset in wall-clock ms, as 60-content.js nextReset (the client may read the clock). */
function nextReset(t = Date.now()) {
  const DAY = 86400000, K = 9 * 3600000, R = 6 * 3600000;
  return (Math.floor((t + K - R) / DAY) + 1) * DAY - K + R;
}
/** The rest of the 알바 window (alba.js lists the solo games first): the co-op shifts with a way to each, then the trust with the 알바 residents. */
export function albaExtras(box, s) {
  const coop = Object.entries((G.defs.coop && G.defs.coop.jobs) || {});
  if (coop.length) {
    const paid = s.coop || [];
    box.append(el("div", "section", `협동 알바 · 오늘 보수 ${coop.filter(([k]) => paid.includes(k)).length}/${coop.length}`));
    for (const [k, j] of coop) {
      const row = el("div", "trk-row"), got = paid.includes(k);
      row.append(el("small", got ? "ok" : "", `${got ? "✓ " : ""}${j[0]} · ${placeOf(j[4]) || mapName(j[5])} · ${got ? "오늘 보수 수령 완료 · 보수 없이 재참여 가능" : "오늘 보수 수령 가능"}`));
      const tb = Track.button(`coop:${k}`, j[0]);
      if (tb) row.append(tb);
      box.append(row);
    }
  }
  box.append(el("div", "section", "알바 주민의 신뢰"));
  trustList(box, s);
}
/** Each trusted NPC's badge, most trusted first (the 생활 window and the 알바 window). */
function trustList(box, s) {
  const rows = (Array.isArray(s.rep) ? s.rep : Object.entries(s.rep || {})).slice().sort((x, y) => y[1] - x[1]);
  if (!rows.length) { box.append(el("p", "hint", "아직 신뢰를 쌓은 주민이 없습니다. 알바를 끝내면 그 주민과 가까워집니다.")); return; }
  const list = el("div", "rep-list");
  for (const [id] of rows) {
    const row = el("div", "rep-row");
    row.append(el("b", "", npcLabel(id)));
    const badge = repBadge(s, id);
    if (badge) row.append(badge);
    list.append(row);
  }
  box.append(list);
}
// the hotkey (Shift+J by default): input.js's key switch does not know this window, so it listens itself (as coop.js does)
addEventListener("keydown", (e) => {
  if (!G.playing || e.repeat || Mini.active() || !Keymap.is(e, "alba")) return;
  if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  toggleWin("alba");
});

/** A job's text with its written count (the 쉬움 amount, `base`) swapped for this grade's `need` ("[들꽃잎] 6장" → 9장 on 보통). */
function sayN(text, base, need) {
  return need && base && need !== base ? text.replace(new RegExp("(^|[^0-9])" + base + "(?![0-9])"), (m, pre) => pre + need) : text;
}
/** The job in hand: what, where, progress, and 그만두기. `full` adds the drop button. */
function jobCard(s, a, full) {
  const card = el("div", "dcard jb-card on");
  const hd = el("div", "dh");
  const nm = el("b", "");
  nm.append(iconImg(a.t.kind === "deliver" ? "bag" : GLYPH[D().keys.indexOf(a.t.sk)] || "bag", "#ffe08a"), document.createTextNode(" 맡은 알바"));
  hd.append(nm, el("span", "tag", (KIND[a.t.kind] || [a.t.kind])[0]));
  card.append(hd, el("p", "say", sayN(a.t.text, a.t.n, a.n)));
  const nx = nextStep(a), pr = progOf(s, a);
  // a chore's spots still to do have no NPC to name (the bar below says how many): no "에게 … ·" line
  if (nx.npc) card.append(el("small", "where", pr && a.t.kind === "scout" && !a.got ? `${pr[0]} → ${npcLabel(nx.npc)}에게 보고` : `${npcLabel(nx.npc)}에게 ${nx.verb} · ${placeOf(nx.npc)}`));
  if (pr) {
    const bar = el("div", "bar"), f = el("i");
    f.style.width = `${clamp((pr[1] / pr[2]) * 100, 0, 100)}%`;
    bar.append(f, el("b", "", a.t.kind === "scout" ? `${pr[0]} ${pr[1] ? "✓" : ""}` : `${pr[0]} ${Math.min(pr[1], pr[2])}/${pr[2]}`));
    card.append(bar);
    if (a.urg) card.append(el("small", "late", a.urg > 0 ? `긴급! 시간 안에 끝내면 보수 ×${D().jbRush.bonus}` : "긴급 시간이 지났습니다 — 마치면 기본 보수"));
  } else if (a.prog === 1) card.append(el("small", "late", "꾸러미를 들고 있습니다 — 시간 안에 전해 주세요!"));
  if (full) {
    const btns = el("div", "btns"), b = el("button", "btn", "그만두기");
    b.title = "맡은 알바를 내려놓습니다 (오늘 횟수에 들지 않습니다)";
    b.addEventListener("click", () => { act({ t: "jb", a: "drop" }); Sound.play("close"); });
    btns.append(b);
    const go = Track.button("job", "맡은 알바");
    if (go) btns.append(go);
    card.append(btns);
  }
  return card;
}

// ───────────────────────────── trust ─────────────────────────────

/** Can this NPC's trust grow at all (an 알바 names them)? */
const trusted = (id) => !!(D() && D().jb && Object.values(D().jb).some((t) => t.npc === id || t.to === id));
/** The tier badge and trust bar for an NPC, or null when no 알바 ever names them. */
export function repBadge(s, id) {
  if (!id || !trusted(id)) return null;
  const R = D().rep, n = repOf(s, id), k = tierOf(n);
  const box = el("div", "rep-badge t" + k);
  box.append(el("span", "tier", k ? R.name[k - 1] : "낯선 사이"));
  const bar = el("div", "bar"), f = el("i");
  f.style.width = `${n}%`;
  bar.append(f);
  for (const x of R.tier) { const m = el("u"); m.style.left = `${x}%`; bar.append(m); }
  box.append(bar, el("small", "", `신뢰 ${n}`));
  const perk = R.perk[id], next = R.tier[k];
  const lines = [`신뢰 ${n}/100 — 이 주민의 알바를 끝낼 때마다 쌓입니다.`];
  if (next !== undefined) lines.push(`${next}에서 ${R.name[k]}`);
  lines.push(`${R.name[0]}: 가게 5% 할인 · 알바 보수 +10%`);
  if (perk) lines.push(`${R.name[1]}: ${perk.recipe ? `비법 제작법 [${itemName(D().recipes.find((r) => r.id === perk.recipe)?.out[0] || perk.recipe)}]` : perk.elx ? `엘릭서 지속 +${perk.elx}분` : perk.great ? `화덕 요리 대성공 +${perk.great}%p` : ""}`);
  lines.push(`${R.name[2]}: 칭호${perk ? ` "${perk.title}"` : ""}`);
  box.title = lines.join("\n");
  return box;
}
/** The talk window: the trust badge under the name, and an 알바 card when the job in hand wants this NPC. */
export function renderTalk(npc, s) {
  const say = $("#talk-text");
  if (!say) return;
  let rep = $("#talk-rep"), jb = $("#talk-jb");
  if (!rep) { rep = el("div", "talk-rep"); rep.id = "talk-rep"; say.before(rep); }
  if (!jb) { jb = el("div", "talk-jb"); jb.id = "talk-jb"; say.parentNode.append(jb); }
  rep.textContent = ""; jb.textContent = "";
  if (!npc || !s) return;
  const b = repBadge(s, npc.id);
  if (b) rep.append(b);
  const a = active(s);
  if (!a || nextStep(a).npc !== npc.id) return;
  jb.append(el("div", "section", "알바"));
  const card = jobCard(s, a, false), r = ready(s, npc), btns = el("div", "btns");
  const go = el("button", "btn gold", r ? r.label : nextStep(a).verb);
  go.disabled = !r;
  const pr = progOf(s, a);
  if (!r) go.title = a.t.item ? "재료가 부족합니다" : "아직 덜 끝났습니다";
  go.addEventListener("click", () => interact(npc));
  btns.append(go);
  if (!r && pr) btns.append(el("small", "why", `${pr[0]} ${pr[1]}/${pr[2]}`));
  card.append(btns);
  jb.append(card);
}
export const talkKey = (s) => [s.jb && s.jb[3] && [...s.jb[3].slice(0, 3), s.jb[3][5]], s.rep, active(s) && active(s).t.item ? have(s, active(s).t.item) : 0];

/** The 생활 window: the job in hand (or a pointer to 포포) and the 신뢰 list. */
export function renderLife(box, s) {
  if (!D() || !D().jb) return;
  const a = active(s), done = s.jb ? s.jb[2].length : 0, per = D().jbPay.perDay;
  box.append(el("div", "section", `알바 · 오늘 ${done}/${per}`));
  if (a) box.append(jobCard(s, a, true));
  else box.append(el("p", "hint", `버드나무광장 회관의 알바 중개인 포포에게서 하루 ${per}개까지 맡을 수 있습니다.`));
  const btns = el("div", "btns"), b = el("button", "btn", "알바 게시판 보기");
  b.addEventListener("click", () => { open(); Sound.play("open"); });
  btns.append(b);
  box.append(btns);
  box.append(el("div", "section", "신뢰"));
  trustList(box, s);
}

// ───────────────────────────── the quest tracker ─────────────────────────────

export const trackKey = (s) => { const a = active(s); return a ? [a.id, a.prog, a.got, a.t.item ? have(s, a.t.item) : 0, G.map && G.map.id] : 0; };
/** Rows for the tracker (hud.js): `goal(label, n, need, doneText)` draws a bar. True when it added anything. */
export function trackRows(s, qt, goal) {
  const a = active(s);
  if (!a) return false;
  const t = el("div", "qt"); t.append(Info.questMark("job"), a.t.text.replace(/[.!].*$/, ""));
  const ck = el("div", "qp jb-clock"); ck.id = "qt-jbclock"; ck.hidden = true;   // the clock right under the title, filled each frame by clockLines
  qt.append(t, ck);
  const nx = nextStep(a);
  const pr = progOf(s, a);
  if (pr) qt.append(goal(pr[0], pr[1], pr[2], `${npcLabel(nx.npc)}에게 ${a.t.item ? "전하기" : "보고하기"}`));
  if (nx.npc) qt.append(el("div", "qp", `→ ${npcLabel(nx.npc)}${a.t.kind === "deliver" ? `에게 ${nx.verb}` : ""} · ${placeOf(nx.npc)}`));
  clockLines(now());
  return true;
}
/**
 * Where the job in hand wants me now (track.js targets): the hunt's monster or the scout's map until done, a chore's
 * well (an empty can) or nearest spot left, else the NPC of its next step (pick up, hand over, report).
 */
export function trackTarget(s) {
  const a = active(s);
  if (!a) return null;
  const nx = nextStep(a), who = { k: "npc", id: nx.npc, name: npcLabel(nx.npc) };
  if (a.t.kind === "hunt" && a.got < a.n) return { k: "mob", id: a.t.mob };
  if (a.t.kind === "scout" && a.got < 1) return { k: "map", id: a.t.map[Math.min(gradeOf(s, a.id), a.t.map.length - 1)] };
  const c = chOf(a);
  if (!c || a.got >= a.n || (c.src === "npc" && !a.fill)) return who;
  const m = D().chore.map, here = G.map && G.map.id === m;
  if (c.src === "water" && !a.fill && here) {
    const w = (G.map.big || []).filter((b) => b.t === "prop" && b.k === "well").sort((p, q) => dist(G.me.x, G.me.y, p.x * T, p.y * T) - dist(G.me.x, G.me.y, q.x * T, q.y * T))[0];
    if (w) return { k: "spot", map: m, x: w.x, y: w.y + 1, name: "우물" };
  }
  const left = (a.spots || []).filter((p) => !p[2]);
  if (here) left.sort((p, q) => dist(G.me.x, G.me.y, p[0] * T, p[1] * T) - dist(G.me.x, G.me.y, q[0] * T, q[1] * T));
  return left.length ? { k: "spot", map: m, x: left[0][0], y: left[0][1], name: c.spot } : who;
}

// ───────────────────────────── the parcel ─────────────────────────────

/** Each frame (hud.js hudTick): resync the clock from a new `self`, and draw the countdown bar. */
export function tick(t) {
  const s = G.self;
  if (!s) return;
  if (s.jb !== st.ref) {
    st.ref = s.jb;
    const a = active(s), secs = delivering(a) || onClock(a) ? a.secs : a && a.urg > 0 ? a.urg : 0;
    if (secs > 0) { if (st.id !== a.id) st.full = 0; st.id = a.id; st.until = t + secs * 1000; st.full = Math.max(st.full, secs * 1000); }
    else { st.until = 0; st.full = 0; }
    st.urgUntil = a && a.urg > 0 ? t + a.urg * 1000 : 0;
  }
  clockLines(t);
  // the same bar counts down a parcel or a 긴급 job
  const box = $("#dl"), a = st.until > t && active(s);
  if (!a || !(delivering(a) || onClock(a) || a.urg > 0)) { if (box && !box.hidden) box.hidden = true; return; }
  const left = st.until - t, secs = Math.ceil(left / 1000);
  const name = delivering(a) ? `배달 — ${npcLabel(a.t.to)}에게 · ${secs}초` : onClock(a) ? `${chOf(a).name} — ${chOf(a).spot} ${a.fill}곳 · ${secs}초` : `긴급 알바 — ${npcLabel(a.t.npc)} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  if (box.hidden) box.hidden = false;
  if ($("#dl-name").textContent !== name) $("#dl-name").textContent = name;
  box.classList.toggle("late", left < 10000);
  $("#dl-fill").style.width = `${clamp((left / (st.full || left)) * 100, 0, 100)}%`;
}
/** `["dl", eid, c]`: 1 picked, 2 handed in, 0 lost. True when handled. */
export function onEvent(e) {
  if (e[0] !== "dl") return false;
  const [, eid, c] = e, at = entityPos(eid), mine = eid === G.you;
  if (mine) {
    if (c === 1) { Sound.play("item"); floatText("꾸러미!", G.me.x, G.me.y, 1.8, "#f0c088"); }
    else if (c === 2) { Sound.play("quest"); floatText("알바 완료!", G.me.x, G.me.y, 1.9, "#ffe08a", true); st.until = 0; }
    else { Sound.play("fail"); floatText("배달 실패…", G.me.x, G.me.y, 1.7, "#ff9a8a"); st.until = 0; }
  }
  if (at && c === 2) S3.fx.sparkle(at.x, at.y, 1.1, "#ffe08a", 12);
  return true;
}
