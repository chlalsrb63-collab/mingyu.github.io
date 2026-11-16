/**
 * Items as the windows show them (split from client.js): names and descriptions (`itemName itemDesc
 * statText runewordOf reqLv`), tooltips `itemTip` (the item card + the worn piece beside it), the slot widget `itemSlot` and `useSlot`,
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
export function emptyEquipSlot(it, s, entry) {
  if (!GEAR.includes(it.type) || s.lvl < (entry ? reqLv(entry) : it.req) || (it.cls && it.cls !== s.cls)) return null;
  return slotsFor(it.type).find(k => !s.eq[k]) || null;
}
/** The level a piece needs: a rolled piece's item level − 10 (min 1), else its base item's `req`. */
export const reqLv = (entry) => (entry.il > 0 ? Math.max(1, entry.il - 10) : G.defs.items[entry.id].req);
/** The rarity's name; 유니크 (q5) comes from the rules table once it lists it. */
const rarName = (q) => G.defs.rarity[q || 0] || (q === 5 ? "유니크" : "일반");
/** A 유니크's prefix and suffix words (`un` = [prefix index, suffix index] into `defs.uniq`); "" while the rules do not send them. */
function uniqWords(entry) {
  const u = G.defs.uniq, un = entry.q === 5 && entry.un;
  const w = (list, i) => { const x = list && list[i]; return (Array.isArray(x) ? x[0] : x) || ""; };
  return u && un ? [w(u.pre, un[0]), w(u.suf, un[1])] : ["", ""];
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
/** "+3 뇌명의 강철 양손검" — a legendary's power, a set's name, or the first affix lends the prefix; a 유니크 is "[접두사] 이름 [접미사]". */
export function itemName(entry) {
  if (Charms.isCharm(entry)) return Charms.charmName(entry);       // a charm's name comes from its wire, not ITEMS (charms.js)
  const it = G.defs.items[entry.id], [pre, suf] = uniqWords(entry);
  const word = pre || (entry.lg ? G.defs.legend[entry.lg][0] : entry.set ? G.defs.sets[entry.set].name : entry.af && entry.af.length ? G.defs.affix[entry.af[0][0]][1] : "");
  return (entry.cu === 1 ? "저주받은 " : "") + (entry.enh > 0 ? `+${entry.enh} ` : "") + (word ? word + " " : "") + it.name + (suf ? ` ${suf}` : "");
}
/** The piece's own stats, enhancement included: [[key, value]…] (speed and crit do not scale). */
function baseStats(entry) {
  const it = G.defs.items[entry.id], e = entry.enh || 0;
  return Object.keys(it.base || {}).map((k) => [k, k === "spd" || k === "crit" ? it.base[k] : Math.round(it.base[k] * (1 + (G.defs.enhPct ? G.defs.enhPct[e] : 10 * e) / 100))]);
}
export function itemDesc(entry) {
  const it = G.defs.items[entry.id];
  if (it.base) {
    const base = baseStats(entry).map(([k, v]) => statText(k, v));
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
/** One stat as a row of a tooltip card: the name on the left, the value on the right; `tag` is a small badge after the name. */
function statRow(k, v, cls, tag) {
  const label = G.defs.affix[k][0], d = el("div", `tc-row ${cls}`), l = el("span", "", label.replace(" %", ""));
  if (tag) l.append(el("i", "tc-tag", tag));
  d.append(l, el("b", "", `+${v}${label.includes("%") ? "%" : ""}`));
  return d;
}
/**
 * One tooltip card (hud.css "item tooltip"): a rarity-coloured frame, then sections split by divider lines —
 * name · rarity and item level, the base stats, the affixes (a 유니크's first two are its own, tagged 고유),
 * the legendary power / set / sockets / runeword, and last the level it needs. `o.eq` marks the piece being
 * worn in that slot (the [장착 중] banner).
 */
function card(entry, o = {}) {
  const it = G.defs.items[entry.id], s = G.self, q = entry.q || 0, gear = isGear(entry.id), un = q === 5;
  const c = el("div", `tcard q${q}`);
  c.style.setProperty("--rc", Art.RARITY_COL[q] || Art.RARITY_COL[0]);
  const sec = (cls) => c.appendChild(el("div", `tc-sec ${cls || ""}`));
  if (o.eq) { const b = el("div", "tc-eq", "[장착 중]"); b.append(el("small", "", SLOT_NAME[o.eq])); c.prepend(b); }
  const head = sec("head");
  head.append(el("div", "tc-nm", itemName(entry)));
  if (gear) {
    const r = el("div", "tc-sub");
    r.append(el("span", "", `${rarName(q)} ${TYPE_NAME[it.type]}`));
    if (entry.il > 0) r.append(el("span", "tc-il", `아이템 레벨 ${entry.il}`));
    head.append(r);
  }
  if (it.base) {
    const base = sec();
    for (const [k, v] of baseStats(entry)) base.append(statRow(k, v, "base"));
    if (it.cls) base.append(el("div", "tc-note", `${G.defs.wkinds[it.wk].name} · ${G.defs.classes[it.cls].name} 전용`));
  } else head.append(el("div", "tc-ds", itemDesc(entry)));
  if (entry.af && entry.af.length) {
    const af = sec();
    entry.af.forEach(([k, v], i) => af.append(statRow(k, v, un && i < 2 ? "af un" : "af", un && i < 2 ? "고유" : "")));
  }
  const pw = [];
  if (entry.lg) pw.push(el("div", "tc-lg", `◆ ${G.defs.legend[entry.lg][1]}`));
  if (entry.set) {
    const set = G.defs.sets[entry.set], worn = setWorn(entry.set);
    pw.push(el("div", "tc-st", `${set.name} 세트 (${worn}개 착용)`));
    for (const [n, list] of set.bonus) pw.push(el("div", worn >= n ? "tc-st on" : "tc-st off", `${n}세트: ${list.map(([k, v]) => statText(k, v)).join(", ")}`));
  }
  if (entry.sk) {
    const names = [];
    for (let i = 0; i < entry.sk; i++) { const r = entry.ru && entry.ru[i]; names.push(r ? G.defs.runes[r][0] : "빈 홈"); }
    pw.push(el("div", "tc-so", `홈 ${entry.sk}개 [ ${names.join(" · ")} ]`));
    for (const r of entry.ru || []) if (r) pw.push(statRow(G.defs.runes[r][1], G.defs.runes[r][2], "af"));
    const rw = runewordOf(entry);
    if (rw) pw.push(el("div", "tc-rw", `룬어 「${rw.name}」 ${rw.add.map(([k, v]) => statText(k, v)).join(", ")}`));
  }
  if (pw.length) sec().append(...pw);
  const foot = sec();
  if (gear) foot.append(el("div", s && s.lvl < reqLv(entry) ? "tc-req bad" : "tc-req", `착용 레벨 ${reqLv(entry)}`));
  if (gear && !o.worn && !o.eq && it.cls && it.cls !== s.cls) foot.append(el("div", "tc-err", `${G.defs.classes[it.cls].name}만 쓸 수 있습니다`));
  if (o.price) foot.append(el("div", "tc-gold", o.price));
  if (o.hint) foot.append(el("div", "tc-hint", o.hint));
  if (!foot.firstChild) foot.remove();
  return c;
}
export function sellPrice(entry) {
  const it = G.defs.items[entry.id];
  if (!isGear(entry.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.05 * (1 + 0.8 * (entry.q || 0)) * (1 + 0.3 * (entry.enh || 0)));
}
/**
 * A tooltip's content: the item's card, and for a gear piece the card of whatever it would replace beside it
 * (a ring: both rings) under a [장착 중] banner; the new card ends with the ▲ gained / ▼ lost summary
 * (shape and sign, not colour alone). A worn piece shows no comparison.
 */
export function itemTip(entry, host, o = {}) {
  // a charm has no gear fields, no price and nothing to compare with (charms.js)
  if (Charms.isCharm(entry)) { Charms.describe(entry, host, { hint: o.hint }); return; }
  const s = G.self, d = G.defs.items[entry.id], wrap = el("div", "tcards"), main = card(entry, o);
  wrap.append(main);
  host.append(wrap);
  if (o.worn || !isGear(entry.id)) return;
  const mine = statsOf(entry);
  for (const k of slotsFor(d.type)) {
    const w = s.eq[k];
    if (!w) continue;
    const cmp = el("div", "tc-sec");
    cmp.append(el("div", "tc-cmp", `장착 중 ${SLOT_NAME[k]} 대비`));
    const dls = el("div", "tc-dls"), was = statsOf(w);
    for (const key of Object.keys(G.defs.affix)) {
      const dv = (mine[key] || 0) - (was[key] || 0);
      if (!dv) continue;
      const label = G.defs.affix[key][0], pct = label.includes("%") ? "%" : "";
      dls.append(el("span", dv > 0 ? "tc-d up" : "tc-d dn", `${dv > 0 ? "▲" : "▼"} ${label.replace(" %", "")} ${dv > 0 ? "+" : "−"}${Math.abs(dv)}${pct}`));
    }
    if (!dls.firstChild) dls.append(el("span", "tc-d", "능력치 차이 없음"));
    cmp.append(dls);
    if (w.lg && w.lg !== entry.lg) cmp.append(el("div", "tc-d dn", `◆ 잃는 힘: ${G.defs.legend[w.lg][1]}`));
    if (w.set && w.set !== entry.set && setWorn(w.set) > 1) cmp.append(el("div", "tc-d dn", `${G.defs.sets[w.set].name} 세트가 ${setWorn(w.set) - 1}개로 줄어듭니다`));
    main.append(cmp);
    wrap.append(card(w, { eq: k }));
  }
}
/** Every number a piece gives: base (with its enhancement), affixes, runes and a runeword. */
function statsOf(entry) {
  const out = {};
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  for (const [k, v] of baseStats(entry)) add(k, v);
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
    if (s.lvl < reqLv(entry)) { toast(`레벨 ${reqLv(entry)}부터 장착할 수 있습니다`); Sound.play("no"); return; }
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
    if (G.invNew) G.invNew.clear();
    G.sel = -1;
    hideTip();
    Sound.play("ui");
  });
}
