/**
 * 장날 상인의 창 (`#w-fairmkt`, WIN id `fairmkt`): F beside one of the 장날 merchants (NPC `fm_<vendor>`, role `fairmkt`,
 * 64-fair-market.js) asks the server for that vendor's list (`fair_open {v}`) and opens the window. The list arrives once as the
 * snapshot's `fm` = [vendor, KST day, closing time (epoch ms), rows, ids bought today], and again after each purchase; a row is
 * [id, price, 0, gear piece] · [id, price, 1, item id, n] · [id, price, 2, cosmetic id]. 구매 → `fair_shop {v, i, d}`.
 * The header counts down to the closing time on the server's clock (Sky.serverNow); the window closes when you walk off.
 */

import { Sound } from "./audio.js";
import * as Art from "./art.js";
import * as Info from "./infocard.js";
import * as Sky from "./sky.js";
import * as Wardrobe from "./wardrobe_ui.js";
import { entryIconUrl } from "./weapons.js";
import { G, $, el } from "./state.js";
import { act } from "./net.js";
import { openWin, closeWin, isOpen, hoverTip } from "./windows.js";
import { itemTip, itemName, itemDesc, itemRarity, reqLv } from "./items.js";
import { refreshUi } from "./hud.js";

const st = { v: "", name: "", fm: null, rev: 0 };
const nearVendor = () => !!G.near && G.near.role === "fairmkt" && G.near.id === `fm_${st.v}`;

/** F at a merchant: ask for its list and show the window (the list fills in when `fm` arrives). */
export function open(n) {
  st.v = n.id.slice(3); st.name = n.name; st.fm = null; st.rev++;
  act({ t: "fair_open", v: st.v });
  openWin("fairmkt");
}
/** The snapshot's `fm` (net.js). */
export function onFm(fm) {
  if (fm[0] !== st.v) return;
  st.fm = fm; st.rev++;
  refreshUi();   // (a list can arrive without a `self`)
}
export const key = () => { const s = G.self; return [st.rev, s.gold, s.inv.length, s.bagCap, s.cos && s.cos.own.length, Sky.fairOn()]; };

/** 1:05, or 1:00:05 past an hour. */
const mmss = (ms) => { const x = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = String(x % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`; };
const clockText = () => (st.fm && Sky.fairOn() ? `남은 시간 ${mmss(st.fm[2] - Sky.serverNow())}` : "장날이 끝났습니다");

export function render(s) {
  const box = $("#fairmkt-body"), fm = st.fm, on = Sky.fairOn();
  box.textContent = "";
  $("#w-fairmkt header .t").textContent = st.name || "장날 상인";
  const hd = el("p", "say fm-head"), clk = el("b", "fm-clock", clockText());
  clk.id = "fairmkt-clock";
  hd.append(el("b", "", "장날 한정 · 1인 1회"), " — 상품마다 한 사람이 한 번씩만 살 수 있어요. ", clk);
  box.append(hd);
  if (!fm) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const list = el("div", "list");
  if (!fm[3].length) list.append(el("p", "hint", "오늘은 가져온 물건이 없어요. 다음 장날에 다시 들러 주세요!"));
  fm[3].forEach(([pid, price, kind, a, n], i) => {
    const bought = fm[4].includes(pid), row = el("div", "it" + (bought ? " off bought" : "")), tx = el("div", "tx");
    let icon, why = "", name;
    if (kind === 2) {
      const c = G.defs.cos[a];
      icon = Wardrobe.iconCanvas(a);
      icon.title = c.desc;
      name = el("span", "nm", c.name);
      name.style.color = Art.RARITY_COL[c.q];
      tx.append(name, el("small", "", `${G.defs.cosSlotName[c.slot]} · ${c.desc}`));
      if (s.cos && s.cos.own.includes(a)) why = "이미 가지고 있는 외형입니다";
    } else {
      const entry = kind === 0 ? a : { id: a, n }, d = G.defs.items[entry.id];
      icon = el("img"); icon.src = entryIconUrl(entry, d) || G.icons.url[entry.id]; icon.alt = "";
      const quality = itemRarity(entry);
      if (quality) icon.style.borderColor = Art.RARITY_COL[quality];
      name = el("span", "nm", kind === 0 ? itemName(entry) : `${itemName(entry)} ×${n}`);
      if (quality) name.style.color = Art.RARITY_COL[quality];
      tx.append(name, el("small", "", kind === 0 ? `아이템 레벨 ${entry.il} · 착용 Lv.${reqLv(entry)}` : itemDesc(entry)));
      const lg = kind === 0 && G.defs.legend && G.defs.legend[entry.lg];
      if (lg) tx.append(el("small", "fm-lg", `◆ ${lg[1]}`));
      hoverTip(icon, (h) => itemTip(entry, h, { price: `${price.toLocaleString()}G` }));
      if (kind === 0 ? s.inv.length >= (s.bagCap || 30) : false) why = "가방이 가득 찼습니다";
    }
    const cost = el("small", "cost");
    cost.append(Info.coin(price));
    tx.append(cost);
    const b = el("button", "", bought ? "구매 완료" : "구매");
    if (!on) why = "장날이 끝났습니다";
    else if (!bought && !why && s.gold < price) why = "골드가 부족합니다";
    b.disabled = bought || !!why;
    if (!bought && why) b.title = why;
    b.addEventListener("click", () => { act({ t: "fair_shop", v: st.v, i, d: fm[1] }); Sound.play("fair_buy"); });
    row.append(icon, tx, b);
    list.append(row);
  });
  box.append(list);
}
/** Each frame (hud.js): the countdown line, and the window closes when you are no longer beside this merchant. */
export function tick() {
  if (!isOpen("fairmkt")) return;
  if (!nearVendor()) { closeWin("fairmkt"); return; }
  const c = $("#fairmkt-clock"), t = clockText();
  if (c && c.textContent !== t) c.textContent = t;
}
