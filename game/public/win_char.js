/**
 * Bag, character and skill windows (split from client.js): `renderInv`, `renderChar` (tabs 장비 ·
 * 능력치 · 외형; the stat tab is statwin.js), `renderSkills`/`skillRows` (무기 · 스킬 · 전직의 길;
 * jobtree.js), the tab buttons, `openStats openTree`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as Mini from "./minigames.js";
import { skillIconUrl } from "./skillicons.js";
import { iconImg, iconUrl } from "./uiicons.js";
import * as Info from "./infocard.js";
import * as QS from "./quickslots.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import * as Housing from "./housing.js";
import { G, $, el, now, $$ } from "./state.js";
import * as Gather from "./gather.js";
import { act } from "./net.js";
import { fireNear } from "./actions.js";
import { isOpen, touch, hideTip, closeDrawer, openWin } from "./windows.js";
import { invOrder, itemSlot, QS_USE, useSlot, isGear, sellPrice, itemTip, itemName, SLOT_NAME, SLOT_GLYPH, setWorn, statText } from "./items.js";
import { refreshUi, section, resetDoll, drawPortrait } from "./hud.js";
import * as Charms from "./charms.js";

// ── the bag ──
export function renderInv(s) {
  const it = G.defs.items;
  $("#inv-gold").textContent = "";
  $("#inv-gold").append(iconImg("coin", "#e2c486"), s.gold.toLocaleString());
  const cap = s.bagCap || G.defs.inv;
  $("#inv-count").textContent = "";
  $("#inv-count").append(iconImg("bag", "#b8ac90"), `${s.inv.length}/${cap}`);
  $("#inv-count").classList.toggle("full", s.inv.length >= cap);
  const sort = $("#inv-sort");
  sort.textContent = "";
  sort.append(iconImg("sort"), "정리");
  sort.title = "가방 정리: 종류별로, 좋은 것부터, 같은 것은 한 묶음으로";
  const grid = $("#inv-grid");
  grid.textContent = "";
  // 전체 · 참: the 참 tab lists the charms as cards in place of the grid (charms.js)
  Charms.bagTabs(s, $("#inv-tabs"));
  const charmTab = Charms.bagTab() === "charm";
  grid.hidden = charmTab;
  $("#inv-charms").hidden = !charmTab;
  if (charmTab) Charms.renderBagList(s, $("#inv-charms"));
  if (G.sel >= s.inv.length) G.sel = -1;
  const order = invOrder(s.inv);
  for (let n = 0; n < cap; n++) {
    const i = order[n];
    if (i === undefined) { grid.append(itemSlot(null)); continue; }
    const entry = s.inv[i];
    const usable = QS_USE.includes(it[entry.id].type), at = usable ? QS.keysOf(["i", entry.id]) : "";
    const node = itemSlot(entry, {
      selected: i === G.sel,
      onClick: () => { G.sel = G.sel === i ? -1 : i; Sound.play("ui"); refreshUi(); },
      onUse: () => useSlot(i),
      hint: Charms.isCharm(entry) ? "참 탭에서 살펴보고, 참 보드(Shift+C)에 놓으면 효과를 냅니다" : isOpen("shop") ? "클릭해서 고른 뒤 아래 버튼으로 판매" : isOpen("smith") && isGear(entry.id) ? "클릭해서 고른 뒤 아래 버튼으로 분해" : usable ? `아래 단축칸(1~9)에 끌어다 놓을 수 있습니다${at ? ` · 지금 ${at}번` : ""}` : "",
      price: isOpen("shop") && !Charms.isCharm(entry) ? `판매가 ${(sellPrice(entry) * (entry.n || 1)).toLocaleString()}G${entry.n > 1 ? ` (개당 ${sellPrice(entry)}G)` : ""}` : "",
    });
    // a usable thing can be dragged onto the quick slots; the slot it sits in shows in the corner
    if (usable) { QS.dragSource(node, ["i", entry.id]); if (at) node.append(el("span", "qk", at)); }
    grid.append(node);
  }
  Housing.bagBar(s, $("#inv-grow"));
  // the 재료 주머니 under the bag (gather.js); at a shop a click sells from it
  Gather.renderPouch($("#inv-pouch"), s, { where: "inv", sell: isOpen("shop") ? (id, n) => act({ t: "sell", pid: id, n }) : null, price: (id) => sellPrice({ id }) });
  const det = $("#inv-detail");
  det.textContent = "";
  const entry = s.inv[G.sel];
  if (!entry) return;
  // a charm is not gear: it is not sold, salvaged or put in a quick slot — it goes on the board or is broken (charms.js)
  if (Charms.isCharm(entry)) { Charms.bagDetail(s, entry, det); return; }
  const d = it[entry.id];
  // on a touch screen there is no hovering, so the pane says everything the tooltip would
  if (touch()) itemTip(entry, det);
  else { const nm = el("div", "nm", itemName(entry)); nm.style.color = Art.RARITY_COL[entry.q || 0]; det.append(nm); }
  const btns = el("div", "btns");
  const add = (label, fn, off, gold) => { const b = el("button", gold ? "btn gold small" : "btn small", label); b.disabled = !!off; b.addEventListener("click", () => { hideTip(); fn(); }); btns.append(b); };
  if (d.type === "pot") add("사용", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "scroll" || d.type === "buff") add("읽기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "pet") add(s.pet === entry.id ? "돌려보내기" : "데리고 다니기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "food") add("먹기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "camp") add("모닥불 피우기", () => { act({ t: "use", id: entry.id }); closeDrawer(); }, false, true);
  if (QS_USE.includes(d.type)) add("단축칸", () => QS.pick(["i", entry.id]));
  if (d.type === "fish") {
    add("굽기", () => { const id = entry.id; closeDrawer(); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id, s: score })); }, !fireNear(), true);
    if (!fireNear()) btns.append(el("span", "ds", "모닥불 곁에서 구울 수 있습니다"));
  }
  if (isGear(entry.id)) {
    const off = (d.cls && d.cls !== s.cls) || s.lvl < d.req;
    if (d.type === "ring" && s.eq.ring1 && s.eq.ring2) {
      for (const k of ["ring1", "ring2"]) add(`${SLOT_NAME[k]}에 장착`, () => { act({ t: "eq", s: G.sel, k }); G.sel = -1; }, off, true);
    } else add("장착", () => { act({ t: "eq", s: G.sel }); G.sel = -1; }, off, true);
    // a hybrid job carries a second weapon of its pair (Tab swaps)
    const job = G.defs.jobs[s.job];
    if (d.type === "weapon" && job && job.kind === "hybrid" && job.wk.includes(d.wk)) add("보조 무기로", () => { act({ t: "eq", s: G.sel, k: "weapon2" }); G.sel = -1; }, off, true);
    if (isOpen("smith")) add("분해", () => { act({ t: "salv", s: G.sel }); G.sel = -1; Sound.play("salvage"); });
  }
  if (d.type === "rune") {
    let any = false;
    for (const k of G.defs.slots) {
      const g = s.eq[k];
      for (let i = 0; g && i < g.sk; i++) {
        any = true;
        const cur = g.ru && g.ru[i];
        add(`${SLOT_NAME[k]} 홈 ${i + 1}${cur ? ` (${G.defs.runes[cur][0]} 교체)` : ""}`, () => { act({ t: "rune", s: G.sel, k, i }); });
      }
    }
    if (!any) btns.append(el("span", "ds", "홈이 있는 장비를 장착해야 끼울 수 있습니다."));
  }
  if (isOpen("shop")) {
    const each = sellPrice(entry);
    add(`판매 ${each.toLocaleString()}G`, () => act({ t: "sell", s: G.sel, n: 1 }));
    if (entry.n > 1) add(`전부 판매 ${(each * entry.n).toLocaleString()}G`, () => act({ t: "sell", s: G.sel, n: entry.n }));
  }
  if (btns.children.length) det.append(btns);
}

// ── the character sheet ──
/** The sheet: groups of [infocard key, value]. Each is a glyph and its number; the name is the tooltip, a click opens the card. */
const STAT_GROUPS = [
  ["공격", [["atk", (s) => s.atk], ["crit", (s) => `${s.crit}%`], ["critd", (s) => `${s.critd}%`], ["acd", (s) => `${(s.acd / 1000).toFixed(2)}초`], ["ls", (s) => `${s.ls}%`]]],
  ["방어", [["def", (s) => s.def], ["mhp", (s) => s.mhp], ["mmp", (s) => s.mmp]]],
  ["유틸", [["xpb", (s) => `${s.xpb}%`], ["mf", (s) => `${s.mf}%`], ["goldb", (s) => `+${s.goldb}%`], ["kills", (s) => s.kills.toLocaleString()]]],
  ["능력치", [["str", (s) => s.st.str], ["wil", (s) => s.st.wil], ["dex", (s) => s.st.dex], ["int", (s) => s.st.int], ["wis", (s) => s.st.wis], ["luk", (s) => s.st.luk]]],
  ["숙련", [["eva", (s) => `${s.dv[1]}%`], ["aspd", (s) => `+${s.dv[2]}%`], ["cdr", (s) => `${s.dv[3]}%`], ["wm", (s) => `${s.skLv}`]]],
];
export function renderChar(s) {
  // three tabs (the row is wardrobe_ui.js's): 장비 (the paper-doll and the sheet), 능력치 (statwin.js: buying points), 외형.
  const tab = G.charTab || "gear";
  charTabBtn.classList.toggle("ready", s.lvl < G.defs.maxLv && s.xp >= StatWin.cheapest(s));
  $("#char-gear").hidden = tab !== "gear";
  $("#char-stat").hidden = tab !== "stat";
  const role = G.near && G.near.role;
  if (tab === "cos") return;
  if (tab === "stat") { StatWin.render($("#char-stat"), s, { here: fireNear() || role === "train", atTrainer: role === "train" }); return; }
  renderDoll(s);
  renderSheet(s);
}
/** The paper-doll: the name line, the gear slots (click one to take it off) and the portrait (the C window's 장비 tab). */
export function renderDoll(s) {
  const title = $("#char-title");
  title.textContent = "";
  title.append(Info.jobMark(s.job), s.name, el("small", "", `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`));
  for (const k of G.defs.slots) {
    const host = $(`#eq-${k}`);
    if (!host) continue;
    const g = s.eq[k];
    const slot = itemSlot(g, g ? { worn: true, onClick: () => { hideTip(); act({ t: "uneq", k }); Sound.play("ui"); }, hint: `${SLOT_NAME[k]} · 클릭하면 벗습니다` } : {});
    slot.id = `eq-${k}`;
    if (!g) {
      // an empty slot: the silhouette of what goes there and a tiny caption with the slot's name
      const ph = el("span", "ph"); ph.append(iconImg(SLOT_GLYPH[k]));
      slot.append(ph, el("span", "cap", k === "weapon2" ? "보조" : SLOT_NAME[k]));
      slot.title = `${SLOT_NAME[k]} — 비어 있음`;
    }
    if (k === "weapon2") slot.hidden = !g && !(G.defs.jobs[s.job] && G.defs.jobs[s.job].kind === "hybrid");
    host.replaceWith(slot);
  }
  resetDoll();
  drawPortrait(now());
}
/** The 장비 / 상세 tab's sheet: stat groups, legendary powers, sets. */
function renderSheet(s) {
  const st = $("#char-stats");
  st.textContent = "";
  for (const [name, rows] of STAT_GROUPS) {
    const grp = el("div", "grp");
    grp.append(el("h4", "", name));
    for (const [key, val] of rows) grp.append(Info.statChip(key, val(s)));
    st.append(grp);
  }
  const pw = $("#char-sets");
  pw.textContent = "";
  const sets = Object.keys(G.defs.sets).filter((id) => setWorn(id));
  if (s.lg.length || sets.length) pw.append(section("고유 능력 · 세트", "gem"));
  for (const k of s.lg) pw.append(el("div", "lg", `◆ ${G.defs.legend[k][0].replace(/의$/, "")} — ${G.defs.legend[k][1]}`));
  for (const id of sets) {
    const worn = setWorn(id), set = G.defs.sets[id];
    pw.append(el("div", "st", `${set.name} 세트 ${worn}개`));
    for (const [n, list] of set.bonus) pw.append(el("div", worn >= n ? "st on" : "st off", `${n}세트: ${list.map(([a, v]) => statText(a, v)).join(", ")}`));
  }
}

// ── K: 무기 · 스킬 and 전직의 길 (jobtree.js draws the weapon rows and the tree; the skill rows are here, with the quick-slot drag) ──
export function renderSkills(s) {
  const tab = G.skTab === "tree" ? "tree" : "wpn";
  for (const b of $$("#skill-tabs button")) b.classList.toggle("on", b.dataset.tab === tab);
  const box = $("#skill-body");
  if (tab === "tree") JobTree.renderTree(box, s, { atJob: G.near && G.near.role === "job" });
  else JobTree.renderWeapons(box, s, { skills: (host, k) => skillRows(host, s, k) });
}
/** Weapon `k`'s skills (L1, L10, the passive), then the job signatures it carries; the hand's basic attack first. */
function skillRows(box, s, k) {
  const SK = G.defs.skills, jobs = G.defs.jobs;
  if (k === s.wk && s.eq.weapon) {
    const wk = G.defs.wkinds[s.wk] || {};
    const basic = el("div", "skill basic");
    const bi = el("img", "ic"); bi.alt = ""; bi.src = G.icons.url[s.eq.weapon.id] || iconUrl("sword");
    const bh = el("div", "hd");
    bh.append(el("b", "", `기본 공격 · ${wk.name || "공격"}`), el("kbd", "", "Space"), el("small", "", `간격 ${(s.acd / 1000).toFixed(2)}초 · 사거리 ${Math.round(s.range)}`));
    basic.append(bi, bh, el("p", "", "가장 가까운 적을 겨냥합니다. 이어 치면 세 번째 타격이 마무리 일격이 됩니다."));
    box.append(basic);
  }
  // the single job of this weapon, and a two-weapon job that carries it once it is yours
  const ids = G.defs.skillOrder.filter((id) => {
    const sk = SK[id];
    if (!sk.job) return sk.wk === k;
    const j = jobs[sk.job];
    return j.kind === "single" ? j.wk[0] === k : sk.job === s.job && j.wk.includes(k);
  });
  for (const id of ids) {
    const sk = SK[id], w = G.skw && G.skw.get(id), pas = sk.kind === "p";
    const why = pas ? (w ? (w[3] ? "" : "이 무기를 들면 켜집니다") : `숙련 ${sk.need}에 배웁니다`) : sk.job && s.job !== sk.job ? `[${jobs[sk.job].name}] 전직 기술` : QS.skillWhy(id);
    const row = el("div", "skill" + (why ? " locked" : "") + (sk.job ? " ult" : ""));
    const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id);
    const hd = el("div", "hd");
    const at = pas ? "" : QS.keysOf(["s", id]);
    hd.append(el("b", "", sk.name), at ? el("kbd", "", at) : "");
    if (pas) hd.append(el("small", "", "패시브"));
    else hd.append(el("small", "mp", `MP ${w ? w[1] : sk.mp}`), el("small", "", `재사용 ${sk.cd / 1000}초`));
    hd.append(el("small", "", why || (sk.job ? "전직 기술" : `숙련 ${sk.need} 습득`)));
    row.append(ic, hd, el("p", "", sk.desc));
    if (!pas) {
      // drag the icon (or the whole row) onto the quick slots; or tap the button, then a slot
      const put = el("button", "btn small qs-put", "단축칸");
      put.title = "누른 뒤 아래 단축칸(1~9)을 누르면 거기에 놓입니다";
      put.addEventListener("click", () => QS.pick(["s", id]));
      row.append(put);
      QS.dragSource(row, ["s", id]);
    }
    box.append(row);
  }
  box.append(el("p", "hint", "스킬을 끌어다 아래 단축칸(1~9)에 놓으면 그 숫자 키로 씁니다(우클릭·바깥에 놓으면 비움). 들고 있지 않은 무기의 스킬은 흐리게 보입니다. 자동사냥은 단축칸의 스킬을 칸 순서대로 씁니다."));
}
// the C window's tab row is the wardrobe's (장비 · 외형, wardrobe_ui.js shows and hides its parts); 능력치 joins it
const charTabs = $("#w-char .wr-tabs"), charTabBtn = el("button", "", "능력치");
/** The C window on its 능력치 tab (the HUD's EXP bar, 카이, a campfire hint). */
export function openStats() { openCharTab("stat"); }
/** The C window on tab `t` (gear · stat · cos), through the tab row so the wardrobe's own state follows. */
export function openCharTab(t) {
  if (!isOpen("char")) Sound.play("open");
  openWin("char");
  if ((G.charTab || "gear") !== t) { const b = [...charTabs.children].find((x) => x.dataset.t === t); if (b) b.click(); }
}
/** K on its 전직의 길 tab (the mastery strip, 아르센). */
export function openTree() { G.skTab = "tree"; if (!isOpen("skill")) Sound.play("open"); openWin("skill"); }

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupWinChar() {
  charTabBtn.dataset.t = "stat";
  charTabs.children[0].after(charTabBtn);
  charTabs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { G.charTab = b.dataset.t; refreshUi(); } });
  for (const b of $$("#skill-tabs button")) b.addEventListener("click", () => { G.skTab = b.dataset.tab; Sound.play("tab"); refreshUi(); });
}
