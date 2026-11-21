/**
 * 아이템도감 window `#w-dex` (WIN `dex`, Shift+I): every 접두사 (the 고유 효과 of a 전설 or 유니크) as a card — the word, its
 * 분류 (공격형 / 방어형 / 유틸), 위력 S · M · L, the effect, the slots it can roll on and a sample name — with filters on the
 * 분류, the 부위, the 위력 and a text search. Fully data-driven from `defs.legend` rows [word, effect, slots, cat, rating, fam]:
 * a prefix a later logic part adds shows up by itself. Only the keys of `defs.pfxOn` (live) are lit; the rest sit greyed at the
 * end as 준비 중. A card says 착용 중 when a worn piece carries it, and 중복 적용되지 않음 when a second worn piece does too
 * (`self.lgOff` names the dead one). Read-only; the skeleton is built once, a filter change repaints the list (draw() in hud.js
 * calls render() only when `key()` changes: the filters or what is worn).
 */
import { G, $, el } from "./state.js";
import { Sound } from "./audio.js";
import { refreshUi } from "./hudkit.js";

const CAT = { O: "공격형", D: "방어형", U: "유틸" };
const CAT_TABS = [["", "전체"], ["O", "공격형"], ["D", "방어형"], ["U", "유틸"]];
/** slot letter (the `slots` of a legend row) → [Korean name, item type]. */
const SLOT = { W: ["무기", "weapon"], R: ["반지", "ring"], G: ["장갑", "gloves"], A: ["상의(갑옷)", "armor"], B: ["하의(신발)", "boots"], N: ["목걸이", "amulet"], H: ["투구", "helm"] };
const RATE = { S: "작은 효과", M: "표준 효과", L: "강력한 효과" };
const ORDER = "ODU";
const LS_NOTE = "lumentale:dexnote", LS_FILT = "lumentale:dexfilt";   // "show" = the 3-line note is open (folded by default: the docked panel is short); "1" = slot/rating chips open
const F = { cat: "", slot: "", rate: "", q: "", hide: localStorage.getItem(LS_NOTE) !== "show", more: localStorage.getItem(LS_FILT) === "1" };
let ui = null;   // the built skeleton: { note, help, tabs, slots, rates, q, count, reset, list }

const norm = (t) => t.toLowerCase().replace(/\s+/g, "");
const slotNames = (slots) => [...slots].map((l) => (SLOT[l] ? SLOT[l][0] : "")).join(" ");
const match = (r) => (!F.cat || r[3] === F.cat) && (!F.slot || r[2].includes(F.slot)) && (!F.rate || r[4] === F.rate)
  && (!F.q || norm(`${r[0]} ${r[1]} ${slotNames(r[2])}`).includes(F.q));

/** key → { on: worn pieces whose power counts, dead: worn pieces with it that do not (their slot is in `self.lgOff`) }. */
function wornMap(s) {
  const m = {};
  for (const slot of G.defs.slots) {
    const e = slot !== "weapon2" && s.eq[slot];
    if (!e || !e.lg) continue;
    const w = m[e.lg] || (m[e.lg] = { on: 0, dead: 0 });
    if ((s.lgOff || []).includes(slot)) w.dead++; else w.on++;
  }
  return m;
}
export const key = () => [F, G.self && wornMap(G.self), G.defs.legend && Object.keys(G.defs.legend).length, G.defs.pfxOn && G.defs.pfxOn.length];

// a sample name for "예: 뇌명의 강철 양손검": a tier 2–3 plain piece of a slot the prefix rolls on (picked by the key, so it is stable)
let pools = null, poolsOf = null;
function pool(type) {
  if (poolsOf !== G.defs.items) { pools = {}; poolsOf = G.defs.items; }
  return pools[type] || (pools[type] = Object.values(G.defs.items).filter((it) => it.type === type && it.tier >= 2 && it.tier <= 3).map((it) => it.name));
}
const hash = (k) => { let h = 7; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function sample(k, word, slots) {
  const l = F.slot && slots.includes(F.slot) ? F.slot : slots[hash(k) % slots.length], p = SLOT[l] ? pool(SLOT[l][1]) : [];
  return p.length ? `예: ${word} ${p[hash(l + k) % p.length]}` : "";
}

function card(k, r, live, w) {
  const [word, desc, slots, cat, rate] = r;
  const c = el("div", `dx-card ${cat}${live ? "" : " off"}${live && w && w.on ? " worn" : ""}`);
  const top = el("div", "dx-top");
  const rb = el("span", `dx-rate r${rate}`, rate);
  rb.title = `위력 ${rate} — ${RATE[rate] || ""}`;
  top.append(el("b", "dx-nm", word), el("span", "dx-cat", CAT[cat] || cat), rb);
  if (!live) top.append(el("span", "dx-tag off", "준비 중"));
  else if (w && w.on) top.append(el("span", "dx-tag on", "착용 중"));
  c.append(top, el("p", "dx-ds", desc));
  if (live && w && w.dead) c.append(el("div", "dx-dead", "중복 적용되지 않음"));
  const foot = el("div", "dx-foot");
  for (const l of slots) if (SLOT[l]) foot.append(el("span", "dx-slot", SLOT[l][0]));
  const ex = sample(k, word, slots);
  if (ex) foot.append(el("span", "dx-ex", ex));
  c.append(foot);
  return c;
}

function chip(label, v, on, cls = "dx-chip") {
  const b = el("button", cls, label);
  b.type = "button"; b.dataset.v = v;
  b.addEventListener("click", () => on(v, b));
  return b;
}
/** The skeleton, once: the 3-line note, then the filters (a left column when the window is wide) and the list. */
function build(box) {
  box.textContent = "";
  const note = el("div", "dx-note");
  for (const t of ["전설 · 유니크 장비만 접두사를 가집니다", "같은 접두사는 중복 적용되지 않습니다 (아이템 레벨이 가장 높은 장비 하나만)", "유니크는 전설의 고유 효과 + 더 강한 보조 옵션"]) note.append(el("p", "", t));
  const set = (f) => (v) => { F[f] = F[f] === v ? "" : v; Sound.play("tab"); refreshUi(); };
  const tabs = el("div", "tabs dx-tabs"), slots = el("div", "dx-chips"), rates = el("div", "dx-chips");
  const tabBtns = CAT_TABS.map(([v, name]) => chip(name, v, (x) => { F.cat = x; Sound.play("tab"); refreshUi(); }, ""));
  tabs.append(...tabBtns);
  const slotBtns = Object.entries(SLOT).map(([l, [name]]) => chip(name, l, set("slot")));
  slots.append(...slotBtns);
  const rateBtns = ["S", "M", "L"].map((v) => { const b = chip(v, v, set("rate")); b.title = `위력 ${v} — ${RATE[v]}`; return b; });
  const q = el("input", "dx-q");
  q.type = "text"; q.placeholder = "이름 · 효과 · 부위 검색"; q.maxLength = 20; q.autocomplete = "off"; q.spellcheck = false;
  q.addEventListener("input", () => { F.q = norm(q.value); refreshUi(); });
  rates.append(el("span", "dx-lb", "위력"), ...rateBtns);
  const count = el("span", "dx-n"), reset = el("button", "dx-chip", "초기화");
  reset.type = "button";
  reset.addEventListener("click", () => { Object.assign(F, { cat: "", slot: "", rate: "", q: "" }); q.value = ""; Sound.play("tab"); refreshUi(); });
  const bar = el("div", "dx-bar");
  const help = chip("설명", "", () => { F.hide = !F.hide; localStorage.setItem(LS_NOTE, F.hide ? "" : "show"); Sound.play("tab"); refreshUi(); });
  const filt = chip("필터", "", () => { F.more = !F.more; localStorage.setItem(LS_FILT, F.more ? "1" : ""); Sound.play("tab"); refreshUi(); });
  const more = el("div", "dx-more");
  more.append(slots, rates);
  bar.append(count, filt, help, reset);
  const side = el("div", "dx-side");
  side.append(tabs, q, more, bar);
  const list = el("div", "dx-list"), main = el("div", "dx-main");
  main.append(side, list);
  box.append(note, main);
  ui = { note, help, filt, more, tabs: tabBtns, slots: slotBtns, rates: rateBtns, q, count, reset, list };
}

export function render(s) {
  const box = $("#dex-body"), d = G.defs;
  if (!d.legend) { box.textContent = "불러오는 중…"; ui = null; return; }
  if (!ui || !box.contains(ui.list)) build(box);
  const live = new Set(d.pfxOn || Object.keys(d.legend)), worn = wornMap(s);
  for (const b of ui.tabs) b.classList.toggle("on", b.dataset.v === F.cat);
  for (const b of ui.slots) b.classList.toggle("on", b.dataset.v === F.slot);
  for (const b of ui.rates) b.classList.toggle("on", b.dataset.v === F.rate);
  const rows = Object.entries(d.legend).map(([k, r], i) => ({ k, r, i, on: live.has(k) }));
  const hit = rows.filter((x) => match(x.r)).sort((a, b) => b.on - a.on || ORDER.indexOf(a.r[3]) - ORDER.indexOf(b.r[3]) || a.i - b.i);
  const nOn = hit.filter((x) => x.on).length, nSoon = hit.length - nOn;
  ui.count.textContent = `${nOn} / ${rows.filter((x) => x.on).length} 종`;
  ui.reset.hidden = !(F.cat || F.slot || F.rate || F.q);
  ui.note.hidden = F.hide;
  ui.help.classList.toggle("on", !F.hide);
  ui.more.hidden = !F.more;
  ui.filt.classList.toggle("on", F.more || !!(F.slot || F.rate));
  ui.list.textContent = "";
  if (!hit.length) ui.list.append(el("p", "dx-none", "조건에 맞는 접두사가 없습니다"));
  let sep = false;
  for (const x of hit) {
    if (!x.on && !sep) { sep = true; ui.list.append(el("div", "dx-sep", `준비 중 ${nSoon}종 — 아직 드랍되지 않습니다`)); }
    ui.list.append(card(x.k, x.r, x.on, worn[x.k]));
  }
}
