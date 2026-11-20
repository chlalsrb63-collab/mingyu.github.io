/**
 * Social windows (split from client.js): the party frames over the world `renderPartyHud`, party
 * `renderParty` and invites (with the friend list and the block list: `friendBox`), guild `renderGuild`, emoticons `openEmotes`, rankings `renderRank`.
 */

import { Sound } from "./audio.js";
import { iconImg } from "./uiicons.js";
import * as Info from "./infocard.js";
import * as Emo from "./emoticons.js";
import { el, clamp, $, G, T } from "./state.js";
import { act } from "./net.js";
import { isOpen, keepIn, chatTo, ask } from "./windows.js";
import { section, look } from "./hud.js";

// ── party ──
function hpBar(hp, mhp) {
  const bar = el("div", "bar hp"), f = el("i");
  f.style.width = `${clamp((hp / mhp) * 100, 0, 100)}%`;
  bar.append(f);
  return bar;
}
/** A player's job, as its emblem (hover: the job's name, click: its card). */
function classMark(cls) { const c = el("span", "cg"); c.append(Info.jobMark(cls)); return c; }
/** The party position is advisory here; the server checks the actual attacker and monster on a kill. */
function partyWhere(member, radius) {
  const [eid, , , , , , mapName, x, y] = member;
  if (mapName || !radius || eid === G.you || !Number.isFinite(x) || !Number.isFinite(y)) return mapName;
  return Math.hypot(G.me.x - x, G.me.y - y) > radius ? "공유 거리 밖" : "";
}
function partyHuntRadius() {
  return G.defs?.maps?.some((map) => map.id === G.map?.id && !map.safe) ? (G.defs.fieldParty?.tiles || 0) * T : 0;
}
export function partyDisplayKey(members) {
  const radius = partyHuntRadius();
  return JSON.stringify(members.map((member) => [...member.slice(0, 6), partyWhere(member, radius)]));
}
export function renderPartyHud() {
  const box = $("#party-hud");
  box.textContent = "";
  const radius = partyHuntRadius();
  G.party.forEach((member, i) => {
    const [eid, name, cls, lvl, hp, mhp] = member, where = partyWhere(member, radius);
    if (eid === G.you) return;
    const row = el("div", "pm frame" + (i === 0 ? " lead" : "") + (where ? " away" : ""));
    const nm = el("span", "nm", name);
    nm.append(el("small", "", where ? `Lv.${lvl} · ${where}` : `Lv.${lvl}`));
    row.append(Info.jobMark(cls), nm, hpBar(hp, mhp));
    row.title = `${name} · Lv.${lvl} ${G.defs.classes[cls].name}${where ? ` · ${where}` : ""}`;
    box.append(row);
  });
}
function memberRow(eid, name, cls, sub, lead, bar) {
  const row = el("div", "pframe" + (eid === G.you ? " me" : ""));
  row.append(classMark(cls), el("b", lead ? "lead" : "", name), el("small", "", sub));
  if (bar) row.append(bar);
  return row;
}
export function renderParty() {
  const box = $("#party-body");
  // a name half typed into the friend box survives the redraw
  const typing = box.querySelector(".friend-add input");
  keep = typing ? [typing.value, document.activeElement === typing] : ["", false];
  box.textContent = "";
  if (!G.defs || !G.self) return;
  const s = G.self, mine = G.party.length > 0;
  box.append(section(mine ? `파티원 ${G.party.length} / ${G.defs.partyMax}` : "파티 없음", "party"));
  if (mine) {
    const radius = partyHuntRadius();
    G.party.forEach((member, i) => {
      const [eid, name, cls, lvl, hp, mhp] = member, where = partyWhere(member, radius);
      box.append(memberRow(eid, name, cls, `Lv.${lvl}${where ? ` · ${where}` : ""}`, i === 0, hpBar(hp, mhp)));
    });
    const hunt = G.defs.fieldParty;
    if (hunt) {
      const shares = hunt.share.map((fraction, i) => `${i + 1}인 ${Math.round(fraction * 100)}%`).join(" · ");
      box.append(el("p", "hint", `필드 사냥은 공격한 파티원과 처치 지점에서 각각 ${hunt.tiles}칸 이내인 생존 파티원과 공유합니다.`));
      box.append(el("p", "hint", `한 마리당 1인 기본 경험치 ${shares}`));
    }
  } else {
    box.append(memberRow(G.you, s.name, s.cls, `Lv.${s.lvl}`, false, hpBar(G.me.hp, s.mhp)));
    box.append(el("p", "hint", "주변의 모험가를 초대해 보세요. 강한 적과 정예 몬스터는 파티로 잡는 것이 훨씬 빠릅니다."));
  }
  box.append(section("주변 모험가", "person"));
  const inParty = new Set(G.party.map((m) => m[0]));
  const list = el("div", "list");
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || w.buddy || inParty.has(eid)) continue;
    near++;
    const row = el("div", "it");
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `Lv.${w.lvl}${w.guild ? ` · ‹${w.guild}›` : ""}`));
    row.append(classMark(w.cls), tx);
    const b = el("button", "", w.party ? "다른 파티" : "초대");
    b.disabled = !!w.party || G.party.length >= G.defs.partyMax;
    b.addEventListener("click", () => { act({ t: "pinv", e: eid }); Sound.play("invite_send"); });
    row.append(b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  friendBox(box, s);
  if (mine || look()?.party) {
    const btns = el("div", "btns");
    const b = el("button", "btn", "파티 탈퇴");
    b.addEventListener("click", () => act({ t: "pleave" }));
    btns.append(b);
    box.append(btns);
  }
  if (isOpen("party")) keepIn("party");
}
let keep = ["", false];
/** "s1-ch2" → "2채널" (a friend's channel; "" = offline). */
const chName = (room) => { const m = /ch(\d+)$/.exec(room || ""); return m ? `${m[1]}채널` : room; };
function smallBtn(text, fn, cls = "") {
  const b = el("button", cls, text);
  b.addEventListener("click", () => { fn(); Sound.play("ui"); });
  return b;
}
/**
 * 친구 (the vault's list, `G.friends` from the room's "fr" message) and 차단 (the sheet's `blk`): rows with
 * an online mark, 귓속말 (fills the chat box), 삭제; requests either way; a name box to ask someone.
 */
function friendBox(box, s) {
  const fr = G.friends || { f: [], i: [], o: [] }, max = (G.defs.social && G.defs.social.friendMax) || 50;
  box.append(section(`친구 ${fr.f.length} / ${max}`, "person"));
  const list = el("div", "list friends");
  for (const name of fr.i) {
    const row = el("div", "it");
    const tx = el("div", "tx", name); tx.append(el("small", "", "친구 신청이 왔습니다"));
    row.append(tx, smallBtn("수락", () => act({ t: "fr", a: "ok", name })), smallBtn("거절", () => act({ t: "fr", a: "no", name })));
    list.append(row);
  }
  const rows = [...fr.f].sort((a, b) => (b[3] ? 1 : 0) - (a[3] ? 1 : 0) || a[0].localeCompare(b[0]));
  for (const [name, lvl, job, room] of rows) {
    const row = el("div", "it" + (room ? "" : " off"));
    const dot = el("span", "online" + (room ? " on" : ""), room ? "●" : "○");
    dot.title = room ? "접속 중" : "접속 안 함";
    const tx = el("div", "tx", name);
    tx.append(el("small", "", `Lv.${lvl}${room ? ` · ${chName(room)}` : " · 접속 안 함"}`));
    row.append(dot, classMark(job), tx);
    const w = smallBtn("귓속말", () => chatTo(`/w ${name} `));
    w.disabled = !room;
    row.append(w, smallBtn("삭제", () => { ask(`${name}님을 친구에서 지울까요?`, "삭제", () => act({ t: "fr", a: "del", name })); }));
    list.append(row);
  }
  for (const name of fr.o) {
    const row = el("div", "it off");
    const tx = el("div", "tx", name); tx.append(el("small", "", "신청을 보냈습니다 · 답을 기다리는 중"));
    row.append(tx, smallBtn("취소", () => act({ t: "fr", a: "del", name })));
    list.append(row);
  }
  if (!fr.f.length && !fr.i.length && !fr.o.length) list.append(el("div", "ds", "아직 친구가 없습니다. 이름을 넣어 친구 신청을 보내 보세요."));
  box.append(list);
  const add = el("form", "friend-add"), inp = el("input");
  inp.placeholder = "이름"; inp.maxLength = 12; inp.value = keep[0];
  add.append(inp, el("button", "btn small", "신청"));
  if (keep[1]) setTimeout(() => inp.focus(), 0);
  add.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = inp.value.trim();
    if (name) { act({ t: "fr", a: "add", name }); Sound.play("invite_send"); }
    inp.value = "";
  });
  box.append(add);
  const blk = s.blk || [];
  if (blk.length) {
    box.append(section(`차단 ${blk.length}`, "lock"));
    const bl = el("div", "list");
    for (const name of blk) {
      const row = el("div", "it off");
      row.append(el("div", "tx", name), smallBtn("차단 해제", () => act({ t: "blk", a: "del", name })));
      bl.append(row);
    }
    box.append(bl);
  }
  box.append(el("p", "hint", "/w 이름 메시지 귓속말 · /r 답장 · /차단 이름 · /차단해제 이름 · 차단한 사람의 채팅 · 귓속말 · 초대는 오지 않습니다."));
}
export function renderInvite() {
  const box = $("#invite");
  box.hidden = !G.pinv && !G.ginv;
  if (box.hidden) return;
  if (G.pinv) $("#invite-text").textContent = `${G.pinv}님이 파티에 초대했습니다.`;
  else { const [from, g] = G.ginv.split("|"); $("#invite-text").textContent = `${from}님이 길드 [${g}]에 초대했습니다.`; }
  Sound.play("ok");
}

// ── guild ──
export function renderGuild() {
  const box = $("#guild-body"), s = G.self;
  if (!s) return;
  const key = JSON.stringify([s.guild, s.gm, s.gmates, s.gold, [...G.who].map(([e, w]) => [e, w.name, w.lvl, w.guild])]);
  if (box.dataset.k === key && box.childElementCount) return;
  box.dataset.k = key;
  const typed = box.querySelector("input")?.value || "";
  box.textContent = "";
  if (!s.guild) {
    box.append(section("길드 창설", "banner"));
    box.append(el("p", "say", `길드를 세우면 이름 위에 길드명이 걸리고, 길드원끼리만 보이는 채팅을 쓸 수 있습니다. 같은 길드원 곁에서 사냥하면 한 명당 경험치 +${Math.round(G.defs.guildXp * 100)}% (최대 3명).`));
    const row = el("div", "btns");
    const input = el("input"); input.maxLength = 10; input.placeholder = "길드 이름 (2~10자)"; input.autocomplete = "off"; input.value = typed;
    const b = el("button", "btn gold", `창설 ${G.defs.guildCost.toLocaleString()}G`);
    b.disabled = s.gold < G.defs.guildCost;
    b.addEventListener("click", () => { if (input.value.trim()) act({ t: "gcreate", name: input.value.trim() }); Sound.play("guild_found"); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") b.click(); });
    row.append(input, b);
    box.append(row, el("p", "hint", "다른 길드에 들어가려면 그 길드원에게 초대를 받으세요."));
    if (isOpen("guild")) keepIn("guild");
    return;
  }
  box.append(el("div", "q-title", `‹${s.guild}›`));
  box.append(section(`접속 중인 길드원 ${s.gmates.length}명`, "banner"));
  for (const [eid, name, cls, lvl, where, gm] of s.gmates) box.append(memberRow(eid, name, cls, `Lv.${lvl} · ${where}`, gm));
  box.append(el("p", "hint", "★ 길드장 · 채팅창의 길드 탭에서 쓰거나 /g 메시지로 길드 채팅"));
  box.append(section("주변 모험가", "person"));
  const list = el("div", "list");
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || w.buddy || w.guild) continue;
    near++;
    const row = el("div", "it");
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `Lv.${w.lvl}`));
    const b = el("button", "", "초대");
    b.addEventListener("click", () => { act({ t: "ginv", e: eid }); Sound.play("invite_send"); });
    row.append(classMark(w.cls), tx, b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  friendBox(box, s);
  const btns = el("div", "btns");
  const b = el("button", "btn", "길드 탈퇴");
  b.addEventListener("click", () => act({ t: "gleave" }));
  btns.append(b);
  box.append(btns);
  if (isOpen("guild")) keepIn("guild");
}
/** Open the picker either to send an emote or to put an emoticon in the chat line. */
export function openEmotes(mode) {
  const box = $("#emotes");
  if (!box.hidden && box.dataset.mode === mode) { box.hidden = true; return; }
  box.dataset.mode = mode;
  box.classList.toggle("at-chat", mode === "chat");
  box.hidden = false;
}

export function renderRank(list) {
  const box = $("#rank-list");
  box.textContent = "";
  if (!list.length) { box.textContent = "아직 기록이 없습니다."; return; }
  list.forEach((r, i) => {
    const row = el("div", "rk" + (G.self && r.name === G.self.name ? " me" : ""));
    row.append(el("i", "", i + 1), el("b", "", r.name), el("span", "", `Lv.${r.lvl}`));
    row.prepend(Info.jobMark(r.cls));
    box.append(row);
  });
  if (isOpen("rank")) keepIn("rank");
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupWinSocial() {
  $("#invite-yes").addEventListener("click", () => act({ t: G.pinv ? "pacc" : "gacc" }));
  $("#invite-no").addEventListener("click", () => act({ t: G.pinv ? "pdec" : "gdec" }));
  for (let i = 0; i < Emo.COUNT; i++) {
    const b = el("button");
    b.title = Emo.token(i);
    const im = el("img"); im.alt = Emo.token(i); im.src = Emo.emoUrl(i); b.append(im);
    b.addEventListener("click", () => {
      const box = $("#emotes");
      if (box.dataset.mode === "chat") {
        const input = $("#chat-in");
        input.value = (input.value + Emo.token(i)).slice(0, 80);
        input.focus();
      } else act({ t: "emo", i });
      box.hidden = true;
    });
    $("#emotes").append(b);
  }
  $("#chat-emo").addEventListener("pointerdown", (e) => e.preventDefault());     // keep the chat line focused
  $("#chat-emo").addEventListener("click", () => openEmotes("chat"));
  $("#b-sit").addEventListener("click", () => act({ t: "sit" }));
  for (const b of document.querySelectorAll("#jam button")) b.addEventListener("click", () => b.dataset.camp ? act({ t: "camp", a: b.dataset.camp }) : act({ t: "jam", k: +b.dataset.jam }));
  $("#b-emo").addEventListener("click", () => openEmotes("emote"));
}
