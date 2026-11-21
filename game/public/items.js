/**
 * Items as the windows show them (split from client.js): names and descriptions (`itemName itemDesc
 * statText reqLv`), tooltips `itemTip` (the item card + the worn piece beside it), the slot widget `itemSlot` and `useSlot`,
 * `sellPrice`, the bag's order and `QS_USE`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as Mini from "./minigames.js";
import { entryIconUrl } from "./weapons.js";
import { G, el, $ } from "./state.js";
import { act } from "./wire.js";
import { fireNear } from "./actions.js";
import { hoverTip, hideTip, closeDrawer, openWin, toast } from "./windows.js";
import { refreshUi } from "./hudkit.js";
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
export const reqLv = (entry) => entry.il > 0 ? Math.max(1, entry.il - 10) : G.defs.items[entry.id].req || 1;
/** The rarity's name; 유니크 (q5) comes from the rules table once it lists it. */
const rarName = (q) => G.defs.rarity[q || 0] || (q === 5 ? "유니크" : "일반");
/** A legendary or 유니크 power: [name word, what it does], or null while `defs.legend` lacks it. */
const legendOf = (k) => (k && G.defs.legend && G.defs.legend[k]) || null;
const runeOf = (id) => G.defs.runes?.[id];
export const runeSocketId = (socket) => Array.isArray(socket) ? socket[0] : socket;
export const runeSocketLevel = (socket) => (Array.isArray(socket) ? socket[1] : 1) || 1;
const runeLines = (rune, il) => rune.af.map(([k, n]) => [k, Math.max(1, Math.round(n * (G.defs.runeScale?.[(il || 1) - 1] ?? 100) / 100))]);
const runeStatCap = (key) => G.defs.runeStatCaps?.[key] ?? G.defs.runeStatCaps?.[key.split("_", 1)[0]] ?? Infinity;
const elementPowerLines = (entry) => G.defs.elementPrefixes?.[entry.lg] || [];
export const itemRarity = (entry) => runeOf(entry.id)?.q || entry.q || G.defs.items[entry.id]?.q || 0;
export const rarityLabel = (id, q) => runeOf(id) ? G.defs.runeRarity[q] : rarName(q);
export const socketCap = (entry) => G.defs.sockCaps?.[G.defs.items[entry.id].type] || 0;
export const runeSetMax = () => G.defs.runeSetMax ?? 2;
export function runeSetStatus(s, id) {
  const set = G.defs.runeSets[id], count = s?.runeCounts?.[id] || 0;
  const active = s?.runeSets?.includes(id);
  return { ...set, count, active, status: active ? "활성" : count >= set.need ? "조건 충족 · 발동 한도" : "미달성" };
}
/** "공격력 +12", "치명타 +3%" — one stat in words. */
export function statText(k, v) {
  const label = G.defs.affix[k][0];
  return `${label.replace(" %", "")} +${v}${label.includes("%") ? "%" : ""}`;
}
/** "+3 뇌명의 강철 양손검" — only a 전설 or 유니크 power lends its prefix to the gear. */
export function itemName(entry) {
  if (Charms.isCharm(entry)) return Charms.charmName(entry);       // a charm's name comes from its wire, not ITEMS (charms.js)
  const it = G.defs.items[entry.id], lg = legendOf(entry.lg);
  const word = lg ? lg[0] : "";
  return (entry.cu === 1 ? "저주받은 " : "") + (entry.enh > 0 ? `+${entry.enh} ` : "") + (word ? word + " " : "") + it.name;
}
/** The piece's own stats with the server's level and enhancement curves. */
function baseStats(entry) {
  const it = G.defs.items[entry.id], e = entry.enh || 0;
  const i = ilOf(entry) - 1, level = (G.defs.gearBaseScale?.[i] ?? 1000) / 1000;
  // armour defence has its own curve (10-tables.js DEF_BASE_SCALE)
  const defLevel = (G.defs.defBaseScale?.[i] ?? G.defs.gearBaseScale?.[i] ?? 1000) / 1000;
  const enhancement = 1 + (G.defs.enhPct ? G.defs.enhPct[e] : 10 * e) / 100;
  return Object.entries(it.base || {}).map(([k, value]) => [k, k === "spd" || k === "crit" ? value : Math.round(value * (k === "def" ? defLevel : level) * enhancement)]);
}
export function itemDesc(entry) {
  const it = G.defs.items[entry.id];
  if (it.base) {
    const base = baseStats(entry).map(([k, v]) => statText(k, v));
    if (it.cls) base.push(`${G.defs.wkinds[it.wk].name} · ${G.defs.classes[it.cls].name} 전용`);
    base.push(`Lv.${reqLv(entry)}`);
    return base.join(" · ");
  }
  if (it.type === "rune") return [`아이템 레벨 ${entry.il || 1}`, ...runeLines(runeOf(entry.id), entry.il).map(([k, v]) => statText(k, v))].join(" · ");
  if (it.type === "quest") return `[퀘스트 아이템] ${it.desc || ""} — 팔거나 맡길 수 없습니다.`;
  return it.desc || "";
}
/** One stat as a row of a tooltip card: the name on the left, the value on the right. */
function statRow(k, v, cls) {
  const label = G.defs.affix[k][0], d = el("div", `tc-row ${cls}`);
  d.append(el("span", "", label.replace(" %", "")), el("b", "", `+${v}${label.includes("%") ? "%" : ""}`));
  return d;
}
/** A piece's item level as the rules count it (50-loot-combat.js gearIl): its `il`, or for an old piece its base's req + the gap. */
const ilOf = (e) => (e.il > 0 ? e.il : G.defs.items[e.id].req > 1 ? G.defs.items[e.id].req + (G.defs.ilGap ?? 10) : 1);
/**
 * Does this piece's 고유 효과 not count? The same power on two worn pieces counts once (higher item level, a tie to the earlier slot):
 * a worn piece is dead when its slot is in `self.lgOff`; one in the bag when a worn piece with the same power has an item level ≥ its own.
 */
function lgDead(entry, o) {
  const s = G.self;
  if (!s || !entry.lg) return false;
  const slot = o.eq || Object.keys(s.eq).find((k) => s.eq[k] === entry);
  if (slot) return (s.lgOff || []).includes(slot);
  return Object.keys(s.eq).some((k) => k !== "weapon2" && k !== o.replacing && s.eq[k] && s.eq[k].lg === entry.lg && ilOf(s.eq[k]) >= ilOf(entry));
}
/**
 * One tooltip card (hud.css "item tooltip"): a rarity-coloured frame, then sections split by divider lines —
 * name, rarity, base and affix stats, powers, sockets, and requirements. Runes show their current set progress.
 */
function card(entry, o = {}) {
  const it = G.defs.items[entry.id], s = G.self, q = itemRarity(entry), rune = runeOf(entry.id), gear = isGear(entry.id);
  const c = el("div", `tcard q${q}`);
  c.style.setProperty("--rc", Art.RARITY_COL[q] || Art.RARITY_COL[0]);
  const sec = (cls) => c.appendChild(el("div", `tc-sec ${cls || ""}`));
  if (o.eq) { const b = el("div", "tc-eq", "[장착 중]"); b.append(el("small", "", SLOT_NAME[o.eq])); c.prepend(b); }
  const head = sec("head");
  head.append(el("div", "tc-nm", itemName(entry)));
  if (gear || rune) {
    const r = el("div", "tc-sub");
    r.append(el("span", "", rune ? `${rarityLabel(entry.id, q)} 룬` : `${rarName(q)} ${TYPE_NAME[it.type]}`));
    r.append(el("span", "tc-il", `아이템 레벨 ${rune ? entry.il || 1 : ilOf(entry)}`));
    head.append(r);
  } else if (it.q) head.append(el("div", "tc-sub", `${rarityLabel(entry.id, q)} 소모품`));
  if (it.base) {
    const base = sec();
    for (const [k, v] of baseStats(entry)) base.append(statRow(k, v, "base"));
    if (it.cls) base.append(el("div", "tc-note", `${G.defs.wkinds[it.wk].name} · ${G.defs.classes[it.cls].name} 전용`));
  } else if (!rune) head.append(el("div", "tc-ds", itemDesc(entry)));
  const lines = rune ? runeLines(rune, entry.il) : [...(entry.af || []), ...(it.elementAf || [])];
  if (lines?.length) {
    const af = sec();
    for (const [k, v] of lines) af.append(statRow(k, v, "af"));
  }
  const lg = legendOf(entry.lg);
  if (lg) {
    // the one separate strong effect (a 전설's or 유니크's `lg`): a beige ◆ row tagged 고유 효과
    const l = el("div", "tc-lg");
    l.append(el("i", "tc-tag", "고유 효과"), `◆ ${lg[1]}`);
    const power = sec();
    power.append(l);
    if (lgDead(entry, o)) power.append(el("div", "tc-dead", "중복 적용되지 않음"));
    else for (const [k, v] of elementPowerLines(entry)) power.append(statRow(k, v, "af"));
  }
  const cap = socketCap(entry);
  if (cap) {
    const sockets = sec("tc-sockets");
    sockets.append(el("div", "tc-so", `룬 소켓 ${entry.sk || 0}/${cap}`));
    for (let i = 0; i < cap; i++) {
      const socket = entry.ru?.[i], runeId = runeSocketId(socket), il = runeSocketLevel(socket);
      const fitted = runeOf(runeId), opened = i < entry.sk;
      const row = el("div", opened ? "tc-socket" : "tc-socket locked");
      row.append(el("span", "tc-socket-mark", fitted ? "◆" : opened ? "◇" : "×"));
      const label = el("div", "tc-socket-label");
      const name = el("b", "", fitted ? `${fitted.name} · ${rarityLabel(runeId, fitted.q)} · 아이템 레벨 ${il}` : opened ? "빈 소켓" : "미개방");
      if (fitted) name.style.color = Art.RARITY_COL[fitted.q];
      label.append(name);
      if (fitted) {
        for (const [k, v] of runeLines(fitted, il)) label.append(statRow(k, v, "af"));
        const need = reqLv({ id: runeId, il });
        if (s && s.lvl < need) label.append(el("div", "tc-req bad", `레벨 ${need}부터 룬 효과 적용`));
      }
      row.append(label);
      sockets.append(row);
    }
  }
  if (rune?.set) {
    const set = runeSetStatus(s, rune.set), power = sec("tc-rune-set");
    power.append(el("div", "tc-st", `${set.name} · ${set.count}/${set.need} · ${set.status}`), el("div", "tc-ds", set.desc));
    const active = (s?.runeSets || []).map((id) => G.defs.runeSets[id].name);
    power.append(el("div", "tc-note", `활성 효과 ${active.length}/${runeSetMax()} · ${active.join(", ") || "없음"}`));
    power.append(el("div", "tc-note", `세트 효과는 최대 ${runeSetMax()}종까지 적용됩니다.`));
  }
  const foot = sec();
  if (gear || rune) foot.append(el("div", s && s.lvl < reqLv(entry) ? "tc-req bad" : "tc-req", `${rune ? "사용" : "착용"} 레벨 ${reqLv(entry)}`));
  if (rune) foot.append(el("div", "tc-note", "장착한 모든 룬의 전투 능력치 합계에는 적용 한도가 있습니다."));
  if (gear && !o.worn && !o.eq && it.cls && s && it.cls !== s.cls) foot.append(el("div", "tc-err", `${G.defs.classes[it.cls].name}만 쓸 수 있습니다`));
  if (o.price) foot.append(el("div", "tc-gold", o.price));
  if (o.hint) foot.append(el("div", "tc-hint", o.hint));
  if (!foot.firstChild) foot.remove();
  return c;
}
export function sellPrice(entry) {
  const it = G.defs.items[entry.id];
  if (!isGear(entry.id)) return Math.floor(it.price * 0.4);
  return Math.max(1, Math.floor(it.price * 0.01 * (1 + 0.35 * (entry.q || 0)) * (1 + 0.15 * (entry.enh || 0))));
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
  if (o.worn || !s || !isGear(entry.id)) return;
  for (const k of slotsFor(d.type)) {
    const w = s.eq[k];
    if (!w) continue;
    const cmp = el("div", "tc-sec");
    cmp.append(el("div", "tc-cmp", `장착 중 ${SLOT_NAME[k]} 대비`));
    const dls = el("div", "tc-dls"), mine = statsOf(entry, { replacing: k }), was = statsOf(w, { eq: k });
    for (const key of Object.keys(G.defs.affix)) {
      const dv = (mine[key] || 0) - (was[key] || 0);
      if (!dv) continue;
      const label = G.defs.affix[key][0], pct = label.includes("%") ? "%" : "";
      dls.append(el("span", dv > 0 ? "tc-d up" : "tc-d dn", `${dv > 0 ? "▲" : "▼"} ${label.replace(" %", "")} ${dv > 0 ? "+" : "−"}${Math.abs(dv)}${pct}`));
    }
    if (!dls.firstChild) dls.append(el("span", "tc-d", "능력치 차이 없음"));
    cmp.append(dls);
    if (legendOf(entry.lg) && entry.lg !== w.lg) cmp.append(el("div", "tc-d up", `◆ 얻는 힘: ${legendOf(entry.lg)[0].replace(/의$/, "")}`));
    if (legendOf(w.lg) && w.lg !== entry.lg) cmp.append(el("div", "tc-d dn", `◆ 잃는 힘: ${legendOf(w.lg)[1]}`));
    main.append(cmp);
    wrap.append(card(w, { eq: k }));
  }
}
function addFittedRunes(entry, totals) {
  for (const socket of (entry.ru || []).slice(0, Math.min(entry.sk, socketCap(entry)))) {
    const id = runeSocketId(socket), rune = runeOf(id), il = runeSocketLevel(socket);
    if (!rune || G.self.lvl < reqLv({ id, il })) continue;
    for (const [k, v] of runeLines(rune, il)) totals[k] = (totals[k] || 0) + v;
  }
}
/** Flat bonuses and this piece's applied share of socket bonuses alongside the rest of the loadout. */
function statsOf(entry, o) {
  const out = {};
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  for (const [k, v] of baseStats(entry)) add(k, v);
  for (const [k, v] of entry.af || []) add(k, v);
  for (const [k, v] of G.defs.items[entry.id].elementAf || []) add(k, v);
  if (!lgDead(entry, o)) for (const [k, v] of elementPowerLines(entry)) add(k, v);
  const rest = {}, own = {}, slot = o.eq || o.replacing;
  for (const [key, gear] of Object.entries(G.self.eq)) if (gear && key !== slot) addFittedRunes(gear, rest);
  addFittedRunes(entry, own);
  for (const [k, v] of Object.entries(own)) add(k, Math.min(v, Math.max(0, runeStatCap(k) - (rest[k] || 0))));
  return out;
}
export function itemSlot(entry, o = {}) {
  const d = el("div", "slot");
  if (!entry) { d.classList.add("empty"); return d; }
  const it = G.defs.items[entry.id];
  const q = itemRarity(entry);
  if (q) d.classList.add(`q${q}`);
  if (o.selected) d.classList.add("sel");
  const img = el("img");
  const charm = Charms.isCharm(entry);
  img.src = charm ? Charms.iconUrl(entry) : entryIconUrl(entry, it) || G.icons.url[entry.id];
  if (charm) {
    d.classList.add("charm");
    d.style.setProperty("--cm-grade", Charms.GRADE_COL[entry.rev ? entry.g || 1 : 0]);
  }
  img.alt = it.name;
  d.append(img);
  if (entry.sk) {
    const pips = el("span", "sk");
    for (let i = 0; i < entry.sk; i++) {
      const rune = runeOf(runeSocketId(entry.ru?.[i])), pip = el("i", rune ? "on" : "");
      if (rune) pip.style.background = Art.RARITY_COL[rune.q];
      pips.append(pip);
    }
    d.append(pips);
  }
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
/** Show the smith's gear list when close enough. The server validates and consumes the stone. */
export function openSocketSmith() {
  if (G.near?.role !== "smith") { toast("룬 천공석은 대장장이 볼칸에게서 사용하세요"); return; }
  openWin("smith");
}

/** Double-click or right-click in the bag: drink, eat, light, cook or put on. */
export function useSlot(i) {
  const s = G.self, entry = s.inv[i];
  if (!entry) return;
  const d = G.defs.items[entry.id];
  hideTip();
  if (entry.id === G.defs.sockItem) { openSocketSmith(); return; }
  if (d.type === "pot" || d.type === "food" || d.type === "scroll" || d.type === "buff" || d.type === "pet") act({ t: "use", id: entry.id });
  else if (d.type === "camp") { act({ t: "use", id: entry.id }); closeDrawer(); }
  else if (d.type === "fish") {
    if (!fireNear()) { toast("모닥불 곁에서 구울 수 있습니다"); return; }
    closeDrawer(); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id: entry.id, s: score }));
  } else if (isGear(entry.id)) {
    if (d.cls && d.cls !== s.cls) { toast(`${G.defs.classes[d.cls].name} 전용 장비입니다`); Sound.play("no"); return; }
    if (s.lvl < reqLv(entry)) { toast(`레벨 ${reqLv(entry)}부터 장착할 수 있습니다`); Sound.play("no"); return; }
    act({ t: "eq", s: i }); G.sel = -1;
  } else if (d.type === "rune") {
    G.sel = i;
    toast(s.lvl < reqLv(entry) ? `레벨 ${reqLv(entry)}부터 이 룬을 사용할 수 있습니다` : "가방 아래에서 룬을 끼울 소켓을 고르세요");
    refreshUi();
    return;
  }
  else return;
  const sfx = isGear(entry.id) ? "gear_equip"
    : d.type === "food" ? "food_eat"
    : d.type === "scroll" ? "scroll_read"
    : d.type === "camp" ? "camp_light"
    : d.type === "pet" ? "pet_call"
    : "ui";
  Sound.play(sfx);
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
    Sound.play("bag_sort");
  });
}
