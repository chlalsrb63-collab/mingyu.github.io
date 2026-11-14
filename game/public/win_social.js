/**
 * Social windows (split from client.js): the party frames over the world `renderPartyHud`, party
 * `renderParty` and invites, guild `renderGuild`, emoticons `openEmotes`, rankings `renderRank`.
 */

import { Sound } from "./audio.js";
import { iconImg, CLASS_ICON } from "./uiicons.js";
import * as Emo from "./emoticons.js";
import { el, clamp, $, G } from "./state.js";
import { act } from "./net.js";
import { isOpen, keepIn } from "./windows.js";
import { section, look } from "./hud.js";

// ── party ──
function hpBar(hp, mhp) {
  const bar = el("div", "bar hp"), f = el("i");
  f.style.width = `${clamp((hp / mhp) * 100, 0, 100)}%`;
  bar.append(f);
  return bar;
}
function classMark(cls) { const c = el("span", "cg"); c.append(iconImg(CLASS_ICON[cls] || "sword", "#e2c486")); return c; }
export function renderPartyHud() {
  const box = $("#party-hud");
  box.textContent = "";
  G.party.forEach(([eid, name, cls, lvl, hp, mhp, where], i) => {
    if (eid === G.you) return;
    const row = el("div", "pm frame" + (i === 0 ? " lead" : "") + (where ? " away" : ""));
    const nm = el("span", "nm", name);
    nm.append(el("small", "", where ? `Lv.${lvl} · ${where}` : `Lv.${lvl}`));
    row.append(iconImg(CLASS_ICON[cls] || "sword", "#e2c486"), nm, hpBar(hp, mhp));
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
  box.textContent = "";
  if (!G.defs || !G.self) return;
  const s = G.self, mine = G.party.length > 0;
  box.append(section(mine ? `파티원 ${G.party.length} / ${G.defs.partyMax}` : "파티 없음", "party"));
  if (mine) {
    G.party.forEach(([eid, name, cls, lvl, hp, mhp, where], i) => {
      box.append(memberRow(eid, name, cls, `Lv.${lvl} ${G.defs.classes[cls].name}${where ? ` · ${where}` : ""}`, i === 0, hpBar(hp, mhp)));
    });
    box.append(el("p", "hint", "★ 파티를 처음 만든 사람 · 함께 잡으면 모두가 경험치와 전리품을 얻고, 인원이 많을수록 총 경험치가 늘어납니다."));
  } else {
    box.append(memberRow(G.you, s.name, s.cls, `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`, false, hpBar(G.me.hp, s.mhp)));
    box.append(el("p", "hint", "주변의 모험가를 초대해 보세요. 강한 적과 정예 몬스터는 파티로 잡는 것이 훨씬 빠릅니다."));
  }
  box.append(section("주변 모험가", "person"));
  const inParty = new Set(G.party.map((m) => m[0]));
  const list = el("div", "list");
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || inParty.has(eid)) continue;
    near++;
    const row = el("div", "it");
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `Lv.${w.lvl} ${G.defs.classes[w.cls].name}${w.guild ? ` · ‹${w.guild}›` : ""}`));
    row.append(classMark(w.cls), tx);
    const b = el("button", "", w.party ? "다른 파티" : "초대");
    b.disabled = !!w.party || G.party.length >= G.defs.partyMax;
    b.addEventListener("click", () => { act({ t: "pinv", e: eid }); Sound.play("ui"); });
    row.append(b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  if (mine || look()?.party) {
    const btns = el("div", "btns");
    const b = el("button", "btn", "파티 탈퇴");
    b.addEventListener("click", () => act({ t: "pleave" }));
    btns.append(b);
    box.append(btns);
  }
  if (isOpen("party")) keepIn("party");
}
export function renderInvite() {
  const box = $("#invite");
  box.hidden = !G.pinv && !G.ginv;
  if (box.hidden) return;
  if (G.pinv) $("#invite-text").textContent = `${G.pinv}님이 파티에 초대했습니다.`;
  else { const [from, g] = G.ginv.split("|"); $("#invite-text").textContent = `${from}님이 길드 ‹${g}›에 초대했습니다.`; }
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
    b.addEventListener("click", () => { if (input.value.trim()) act({ t: "gcreate", name: input.value.trim() }); Sound.play("ui"); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") b.click(); });
    row.append(input, b);
    box.append(row, el("p", "hint", "다른 길드에 들어가려면 그 길드원에게 초대를 받으세요."));
    if (isOpen("guild")) keepIn("guild");
    return;
  }
  box.append(el("div", "q-title", `‹${s.guild}›`));
  box.append(section(`접속 중인 길드원 ${s.gmates.length}명`, "banner"));
  for (const [eid, name, cls, lvl, where, gm] of s.gmates) box.append(memberRow(eid, name, cls, `Lv.${lvl} ${G.defs.classes[cls].name} · ${where}`, gm));
  box.append(el("p", "hint", "★ 길드장 · 채팅창의 길드 탭에서 쓰거나 /g 메시지로 길드 채팅"));
  box.append(section("주변 모험가", "person"));
  const list = el("div", "list");
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || w.guild) continue;
    near++;
    const row = el("div", "it");
    const tx = el("div", "tx", w.name);
    tx.append(el("small", "", `Lv.${w.lvl} ${G.defs.classes[w.cls].name}`));
    const b = el("button", "", "초대");
    b.addEventListener("click", () => { act({ t: "ginv", e: eid }); Sound.play("ui"); });
    row.append(classMark(w.cls), tx, b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
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
    row.append(el("i", "", i + 1), el("b", "", r.name), el("span", "", `Lv.${r.lvl} ${G.defs.classes[r.cls]?.name ?? ""}`));
    if (G.defs.classes[r.cls]) row.prepend(iconImg(CLASS_ICON[r.cls] || "sword", "#e2c486"));
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
  for (const b of document.querySelectorAll("#jam button")) b.addEventListener("click", () => act({ t: "jam", k: +b.dataset.jam }));
  $("#b-emo").addEventListener("click", () => openEmotes("emote"));
}
