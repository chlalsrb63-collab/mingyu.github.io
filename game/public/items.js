/**
 * Items as the windows show them (split from client.js): names and descriptions (`itemName itemDesc
 * describe statText runewordOf`), tooltips `itemTip`, the slot widget `itemSlot` and `useSlot`,
 * `sellPrice`, the bag's order and `QS_USE`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as Mini from "./minigames.js";
import { entryIconUrl } from "./weapons.js";
import { G, el, $ } from "./state.js";
import { act } from "./net.js";
import { fireNear } from "./actions.js";
import { hoverTip, hideTip, closeDrawer, toast } from "./windows.js";
import { refreshUi } from "./hud.js";
import * as Charms from "./charms.js";

// ── items ──
/** The glyph beside each line of the character sheet. */
const GEAR = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"];
const TYPE_NAME = { weapon: "무기", helm: "투구", armor: "갑옷", gloves: "장갑", boots: "신발", ring: "반지", amulet: "목걸이" };
export const SLOT_NAME = { weapon: "무기", helm: "투구", armor: "갑옷", gloves: "장갑", boots: "신발", ring1: "반지 1", ring2: "반지 2", amulet: "목걸이", weapon2: "Ⅱ 무기" };
/** The silhouette an empty paper-doll slot shows (uiicons.js `eq_*`). */
export const SLOT_GLYPH = { weapon: "sword", helm: "eq_helm", armor: "eq_armor", gloves: "eq_gloves", boots: "eq_boots", ring1: "eq_ring", ring2: "eq_ring", amulet: "eq_amulet", weapon2: "eq_off" };
export const isGear = (id) => GEAR.includes(G.defs.items[id].type);
const slotsFor = (type) => (type === "ring" ? ["ring1", "ring2"] : [type]);
/** An empty slot filled by the item's default equip action. */
export function emptyEquipSlot(it, s) {
  if (!GEAR.includes(it.type) || s.lvl < it.req || (it.cls && it.cls !== s.cls)) return null;
  return slotsFor(it.type).find(k => !s.eq[k]) || null;
}
function runewordOf(g) {
  if (!g.sk || !g.ru || g.ru.length !== g.sk) return null;
  return G.defs.runewords.find((rw) => rw.seq.length === g.sk && rw.seq.every((r, i) => g.ru[i] === r)) || null;
}
/** "공격력 +12", "치명타 +3%" — one stat in words. */
export function statText(k, v) {
  const label = G.defs.affix[k][0];
  return `${label.replace(" %", "")} +${v}${label.includes("%") ? "%" : ""}`;
}
/** "+3 뇌명의 강철 양손검" — a legendary's power, a set's name, or the first affix lends the prefix. */
export function itemName(entry) {
  if (Charms.isCharm(entry)) return Charms.charmName(entry);       // a charm's name comes from its wire, not ITEMS (charms.js)
  const it = G.defs.items[entry.id];
  const word = entry.lg ? G.defs.legend[entry.lg][0] : entry.set ? G.defs.sets[entry.set].name : entry.af && entry.af.length ? G.defs.affix[entry.af[0][0]][1] : "";
  return (entry.cu === 1 ? "저주받은 " : "") + (entry.enh > 0 ? `+${entry.enh} ` : "") + (word ? word + " " : "") + it.name;
}
export function itemDesc(entry) {
  const it = G.defs.items[entry.id];
  const e = entry.enh || 0;
  if (it.base) {
    const base = Object.keys(it.base).map((k) => statText(k, k === "spd" || k === "crit" ? it.base[k] : Math.round(it.base[k] * (1 + (G.defs.enhPct ? G.defs.enhPct[e] : 10 * e) / 100))));
    if (it.cls) base.push(`${G.defs.wkinds[it.wk].name} · ${G.defs.classes[it.cls].name} 전용`);
    base.push(`Lv.${it.req}`);
    return base.join(" · ");
  }
  if (it.type === "rune") { const r = G.defs.runes[it.rune]; return `${statText(r[1], r[2])} — 장착한 장비의 홈에 끼웁니다.`; }
  if (it.type === "quest") return `[퀘스트 아이템] ${it.desc || ""} — 팔거나 맡길 수 없습니다.`;
  return it.desc || "";
}
/** How many pieces of a set are being worn right now. */
export function setWorn(id) {
  let n = 0;
  if (G.self) for (const k of G.defs.slots) if (G.self.eq[k] && G.self.eq[k].set === id) n++;
  return n;
}
/** The full description: base line, rolled affixes, legendary power, set bonuses, sockets, runeword. */
function describe(entry, host) {
  if (Charms.isCharm(entry)) { Charms.describe(entry, host); return; }
  const it = G.defs.items[entry.id];
  const nm = el("div", "nm", itemName(entry));
  nm.style.color = Art.RARITY_COL[entry.q || 0];
  host.append(nm);
  if (isGear(entry.id)) host.append(el("div", "rar", `${G.defs.rarity[entry.q || 0]} ${TYPE_NAME[it.type]}`));
  host.append(el("div", "ds", itemDesc(entry)));
  for (const [k, v] of entry.af || []) host.append(el("div", "af", statText(k, v)));
  if (entry.lg) host.append(el("div", "lg", `◆ ${G.defs.legend[entry.lg][1]}`));
  if (entry.set) {
    const set = G.defs.sets[entry.set], worn = setWorn(entry.set);
    host.append(el("div", "st", `${set.name} 세트 (${worn}개 착용)`));
    for (const [n, list] of set.bonus) host.append(el("div", worn >= n ? "st on" : "st off", `${n}세트: ${list.map(([k, v]) => statText(k, v)).join(", ")}`));
  }
  if (entry.sk) {
    const names = [];
    for (let i = 0; i < entry.sk; i++) { const r = entry.ru && entry.ru[i]; names.push(r ? G.defs.runes[r][0] : "빈 홈"); }
    host.append(el("div", "so", `홈 ${entry.sk}개 [ ${names.join(" · ")} ]`));
    for (const r of entry.ru || []) if (r) host.append(el("div", "af", statText(G.defs.runes[r][1], G.defs.runes[r][2])));
    const rw = runewordOf(entry);
    if (rw) host.append(el("div", "rw", `룬어 「${rw.name}」 ${rw.add.map(([k, v]) => statText(k, v)).join(", ")}`));
  }
}
export function sellPrice(entry) {
  const it = G.defs.items[entry.id];
  if (!isGear(entry.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.05 * (1 + 0.8 * (entry.q || 0)) * (1 + 0.3 * (entry.enh || 0)));
}
/** A tooltip's content: the item, a line on what clicking does, then whatever it would replace. */
export function itemTip(entry, host, o = {}) {
  // a charm has no gear fields, no price and nothing to compare with (charms.js)
  if (Charms.isCharm(entry)) { Charms.describe(entry, host, { hint: o.hint }); return; }
  describe(entry, host);
  const s = G.self, d = G.defs.items[entry.id];
  if (!o.worn && isGear(entry.id)) {
    if (d.cls && d.cls !== s.cls) host.append(el("div", "err-line", `${G.defs.classes[d.cls].name}만 쓸 수 있습니다`));
    else if (s.lvl < d.req) host.append(el("div", "err-line", `레벨 ${d.req}부터 쓸 수 있습니다`));
  }
  if (o.price) host.append(el("div", "gold-line", o.price));
  if (o.hint) host.append(el("div", "hint", o.hint));
  if (!o.worn && isGear(entry.id)) {
    // against what it would replace: the change in every number, ▲ gained / ▼ lost (shape and sign, not colour alone)
    const mine = statsOf(entry);
    for (const k of slotsFor(d.type)) {
      const w = s.eq[k];
      if (!w) continue;
      const head = el("div", "cmp", `착용 중(${SLOT_NAME[k]})과 비교 · `);
      const wn = el("b", "", itemName(w));
      wn.style.color = Art.RARITY_COL[w.q || 0];
      head.append(wn);
      host.append(head);
      const was = statsOf(w);
      let any = false;
      for (const key of Object.keys(G.defs.affix)) {
        const dv = (mine[key] || 0) - (was[key] || 0);
        if (!dv) continue;
        any = true;
        const label = G.defs.affix[key][0], pct = label.includes("%") ? "%" : "";
        host.append(el("div", dv > 0 ? "dl up" : "dl dn", `${dv > 0 ? "▲" : "▼"} ${label.replace(" %", "")} ${dv > 0 ? "+" : "−"}${Math.abs(dv)}${pct}`));
      }
      if (!any) host.append(el("div", "dl", "능력치 차이 없음"));
      if (w.lg && w.lg !== entry.lg) host.append(el("div", "dl dn", `◆ 잃는 힘: ${G.defs.legend[w.lg][1]}`));
      if (w.set && w.set !== entry.set && setWorn(w.set) > 1) host.append(el("div", "dl dn", `${G.defs.sets[w.set].name} 세트가 ${setWorn(w.set) - 1}개로 줄어듭니다`));
    }
  }
}
/** Every number a piece gives: base (with its enhancement), affixes, runes and a runeword. */
function statsOf(entry) {
  const it = G.defs.items[entry.id], e = entry.enh || 0, out = {};
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  for (const k of Object.keys(it.base || {})) add(k, k === "spd" || k === "crit" ? it.base[k] : Math.round(it.base[k] * (1 + (G.defs.enhPct ? G.defs.enhPct[e] : 10 * e) / 100)));
  for (const [k, v] of entry.af || []) add(k, v);
  for (const r of entry.ru || []) if (r) add(G.defs.runes[r][1], G.defs.runes[r][2]);
  const rw = runewordOf(entry);
  if (rw) for (const [k, v] of rw.add) add(k, v);
  return out;
}
export function itemSlot(entry, o = {}) {
  const d = el("div", "slot");
  if (!entry) { d.classList.add("empty"); return d; }
  const it = G.defs.items[entry.id];
  if (entry.q) d.classList.add(`q${entry.q}`);
  if (o.selected) d.classList.add("sel");
  const img = el("img");
  const charm = Charms.isCharm(entry);
  img.src = charm ? Charms.iconUrl(entry) : entryIconUrl(entry, it) || G.icons.url[entry.id];
  if (charm) d.classList.add("charm", `cg${entry.rev ? entry.g || 1 : 0}`);
  img.alt = it.name;
  d.append(img);
  if (entry.sk) { const pips = el("span", "sk"); for (let i = 0; i < entry.sk; i++) pips.append(el("i", entry.ru && entry.ru[i] ? "on" : "")); d.append(pips); }
  if (entry.n > 1) d.append(el("span", "n", entry.n));
  if (entry.enh > 0) d.append(el("span", "e", `+${entry.enh}`));
  if (o.onClick) d.addEventListener("click", o.onClick);
  if (o.onUse) {
    d.addEventListener("dblclick", (e) => { e.preventDefault(); o.onUse(); });
    d.addEventListener("contextmenu", (e) => { e.preventDefault(); o.onUse(); });
  }
  hoverTip(d, (h) => itemTip(entry, h, o));
  return d;
}
/** Double-click or right-click in the bag: drink, eat, light, cook or put on. */
export function useSlot(i) {
  const s = G.self, entry = s.inv[i];
  if (!entry) return;
  const d = G.defs.items[entry.id];
  hideTip();
  if (d.type === "pot" || d.type === "food" || d.type === "scroll" || d.type === "buff" || d.type === "pet") act({ t: "use", id: entry.id });
  else if (d.type === "camp") { act({ t: "use", id: entry.id }); closeDrawer(); }
  else if (d.type === "fish") {
    if (!fireNear()) { toast("모닥불 곁에서 구울 수 있습니다"); return; }
    closeDrawer(); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id: entry.id, s: score }));
  } else if (isGear(entry.id)) {
    if (d.cls && d.cls !== s.cls) { toast(`${G.defs.classes[d.cls].name} 전용 장비입니다`); Sound.play("no"); return; }
    if (s.lvl < d.req) { toast(`레벨 ${d.req}부터 장착할 수 있습니다`); Sound.play("no"); return; }
    act({ t: "eq", s: i }); G.sel = -1;
  } else if (d.type === "rune") { G.sel = i; toast("끼울 홈을 가방 아래에서 고르세요"); refreshUi(); return; }
  else return;
  Sound.play("ui");
}

/** The tidy button asks the server to sort the bag for real: by kind, best first, stacks merged. */
export const invOrder = (inv) => inv.map((_, i) => i);
/** Usable things can go in a quick slot. */
export const QS_USE = ["pot", "food", "camp", "scroll", "buff", "pet"];

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupItems() {
  $("#inv-sort").addEventListener("click", () => {
    if (!G.self || G.self.inv.length < 2) return;
    act({ t: "sort" });
    G.sel = -1;
    hideTip();
    Sound.play("ui");
  });
}
