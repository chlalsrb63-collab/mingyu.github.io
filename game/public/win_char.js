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
import { K } from "./keymap.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import * as Housing from "./housing.js";
import { G, $, el, now, $$ } from "./state.js";
import * as Gather from "./gather.js";
import { act } from "./net.js";
import { fireNear } from "./actions.js";
import { isOpen, touch, hideTip, closeDrawer, openWin, hoverTip, ask, chatLink } from "./windows.js";
import { invOrder, itemSlot, QS_USE, useSlot, openSocketSmith, isGear, emptyEquipSlot, reqLv, sellPrice, itemTip, itemName, itemRarity, SLOT_NAME, SLOT_GLYPH, runeSetStatus, runeSetMax, runeSocketId, runeSocketLevel } from "./items.js";
import { refreshUi, section, resetDoll, drawPortrait } from "./hud.js";
import * as Charms from "./charms.js";
import * as Loadout from "./loadout.js";
import { elementInfo, skillArmorPenetration, skillElements } from "./elements.js";

// ── the bag ──
/** A bag entry's identity without its stack count (a bigger stack of potions is not a new item). */
const invSig = (e) => JSON.stringify(e, (k, v) => (k === "n" ? undefined : v));
/** Every sheet (refreshUi): entries not in the bag before go in `G.invNew`; the first sheet only learns the bag. */
export function trackNew(s) {
  if (s.inv === trackNew.inv) return;
  trackNew.inv = s.inv;
  const now = s.inv.map(invSig);
  if (G.invKnown) for (const k of now) if (!G.invKnown.has(k)) G.invNew.add(k);
  G.invKnown = new Set(now);
  G.invNew = new Set(now.filter((k) => G.invNew && G.invNew.has(k)));
}
export function renderInv(s) {
  const it = G.defs.items;
  $("#inv-gold").textContent = "";
  $("#inv-gold").append(iconImg("coin", "#e2c486"), s.gold.toLocaleString());
  const cap = s.bagCap || G.defs.inv;
  $("#inv-count").textContent = "";
  $("#inv-count").append(iconImg("bag", "#b8ac90"), `${s.inv.length}/${cap}`);
  $("#inv-count").classList.toggle("full", s.inv.length >= cap);
  if (!$("#inv-gold").dataset.info) {
    Info.bind($("#inv-gold"), "보유 골드", () => Info.coinCard());
    Info.bind($("#inv-count"), "가방 칸", () => Info.bagCard());
  }
  $("#inv-count").title = `가방 칸 ${s.inv.length} / ${cap}`;
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
  for (let n = 0; n < Math.max(cap, order.length); n++) {
    const i = order[n];
    if (i === undefined) { grid.append(itemSlot(null)); continue; }
    const entry = s.inv[i], item = it[entry.id];
    const free = emptyEquipSlot(item, s, entry);
    const usable = QS_USE.includes(item.type), at = usable ? QS.keysOf(["i", entry.id]) : "";
    const hint = Charms.isCharm(entry) ? `참 탭에서 살펴보고, 참 보드(${K("charm")})에 놓으면 효과를 냅니다`
      : isOpen("shop") ? "클릭해서 고른 뒤 아래 버튼으로 판매"
      : isOpen("smith") && isGear(entry.id) ? "클릭해서 고른 뒤 아래 버튼으로 분해"
      : usable ? `아래 단축칸(1~9)에 끌어다 놓을 수 있습니다${at ? ` · 지금 ${at}번` : ""}` : "";
    const node = itemSlot(entry, {
      selected: i === G.sel,
      onClick: (ev) => {
        if (ev.shiftKey && !touch()) { chatLink(i, entry); return; }   // Shift+click: a link to it in the chat box (windows.js)
        G.sel = G.sel === i ? -1 : i; Sound.play("ui"); refreshUi();
      },
      onUse: () => useSlot(i),
      hint: [free && `▲ 빈 슬롯에 낄 수 있음 · ${SLOT_NAME[free]}`, hint].filter(Boolean).join(" · "),
      price: isOpen("shop") && !Charms.isCharm(entry) ? `판매가 ${(sellPrice(entry) * (entry.n || 1)).toLocaleString()}G${entry.n > 1 ? ` (개당 ${sellPrice(entry)}G)` : ""}` : "",
    });
    // a usable thing can be dragged onto the quick slots; the slot it sits in shows in the corner
    // with the warehouse open, anything can be dragged into it (a whole stack, like a click on its 가방 pane)
    const bank = isOpen("bank") ? (hit) => { if (hit && hit.closest("#w-bank")) { act({ t: "wh", a: "put", s: i, n: entry.n || 1 }); Sound.play("bank_move"); } } : null;
    if (usable || bank) QS.dragSource(node, ["i", entry.id], { qs: usable, drop: bank });
    if (at) node.append(el("span", "qk", at));
    if (free) node.append(el("span", "qk equip-ready", "▲"));
    // 새로 얻음: glows with a NEW badge until hovered (or tapped), sorted, or the bag is closed
    const k = invSig(entry);
    if (G.invNew && G.invNew.has(k)) {
      node.classList.add("new");
      node.append(el("span", "nw", "NEW"));
      node.addEventListener("pointerenter", () => { G.invNew.delete(k); node.classList.remove("new"); node.querySelector(".nw")?.remove(); }, { once: true });
    }
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
  else { const nm = el("div", "nm", itemName(entry)); nm.style.color = Art.RARITY_COL[itemRarity(entry)]; det.append(nm); }
  const btns = el("div", "btns");
  const add = (label, fn, off, gold) => { const b = el("button", gold ? "btn gold small" : "btn small", label); b.disabled = !!off; b.addEventListener("click", () => { hideTip(); fn(); }); btns.append(b); };
  if (d.type === "pot") add("사용", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "scroll" || d.type === "buff") add("읽기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "pet") add(s.pet === entry.id ? "돌려보내기" : "데리고 다니기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "food") add("먹기", () => act({ t: "use", id: entry.id }), false, true);
  if (d.type === "camp") add("모닥불 피우기", () => { act({ t: "use", id: entry.id }); closeDrawer(); }, false, true);
  if (entry.id === G.defs.sockItem) {
    if (G.near?.role === "smith") add("소켓 천공", openSocketSmith, false, true);
    else if (!touch()) det.append(el("div", "ds", "대장장이 볼칸에게 가져가면 장착 장비에 소켓을 열 수 있습니다."));
  }
  if (QS_USE.includes(d.type)) add("단축칸", () => QS.pick(["i", entry.id]));
  if (d.type === "fish") {
    add("굽기", () => { const id = entry.id; closeDrawer(); Mini.cooking(G.defs.items[d.cook].name, (score) => act({ t: "cook", id, s: score })); }, !fireNear(), true);
    if (!fireNear()) btns.append(el("span", "ds", "모닥불 곁에서 구울 수 있습니다"));
  }
  if (isGear(entry.id)) {
    const free = emptyEquipSlot(d, s, entry);
    if (free) det.append(el("div", "equip-ready", `▲ 빈 슬롯에 낄 수 있음 · ${SLOT_NAME[free]}`));
    const off = (d.cls && d.cls !== s.cls) || s.lvl < reqLv(entry);
    if (d.type === "ring" && s.eq.ring1 && s.eq.ring2) {
      for (const k of ["ring1", "ring2"]) add(`${SLOT_NAME[k]}에 장착`, () => { act({ t: "eq", s: G.sel, k }); G.sel = -1; }, off, true);
    } else add("장착", () => { act({ t: "eq", s: G.sel }); G.sel = -1; }, off, true);
    // anyone carries a second weapon (Tab swaps; a hybrid's must be one of its pair — the server says so)
    if (d.type === "weapon") add("Ⅱ에 장착", () => { act({ t: "eq", s: G.sel, k: "weapon2" }); G.sel = -1; }, off);
    if (isOpen("smith")) add("분해", () => {
      const i = G.sel, go = () => { act({ t: "salv", s: i }); G.sel = -1; Sound.play("salvage"); };
      if (precious(entry)) ask(`분해하면 되돌릴 수 없습니다.\n「${itemName(entry)}」`, "분해", go, "salv");
      else go();
    });
  }
  if (d.type === "rune") {
    const targets = [];
    const need = reqLv(entry), allowed = s.lvl >= need;
    for (const k of allowed ? G.defs.slots : []) {
      const g = s.eq[k];
      for (let i = 0; g && i < g.sk; i++) {
        const cur = g.ru && g.ru[i];
        targets.push({ k, i, cur });
      }
    }
    targets.sort((a, b) => Number(!!a.cur) - Number(!!b.cur));
    const hint = targets.length ? "룬을 끼울 소켓을 고르세요." : "소켓이 열린 장비를 장착하면 룬을 끼울 수 있습니다.";
    det.append(el("div", "ds", allowed ? hint : `레벨 ${need}부터 이 룬을 사용할 수 있습니다.`));
    for (const { k, i, cur } of targets) {
      const target = `${SLOT_NAME[k]} ${i + 1}번`;
      add(`${target} · ${cur ? "교체" : "빈 소켓"}`, () => {
        const s = G.sel;
        if (!cur) { act({ t: "rune", s, k, i }); return; }
        ask(`${target}의 「${G.defs.runes[runeSocketId(cur)].name}」이 사라집니다.\n「${itemName(entry)}」으로 교체할까요?`, "교체", () => {
          const next = G.self?.inv[s], current = G.self?.eq[k]?.ru?.[i];
          if (next?.id === entry.id && next.il === entry.il && runeSocketId(current) === runeSocketId(cur) &&
              runeSocketLevel(current) === runeSocketLevel(cur)) act({ t: "rune", s, k, i, r: 1 });
        });
      }, false, !cur);
    }
  }
  if (isOpen("shop")) {
    const each = sellPrice(entry);
    add(`판매 ${each.toLocaleString()}G`, () => {
      const i = G.sel, go = () => act({ t: "sell", s: i, n: 1 });
      if (precious(entry)) ask(`판매할까요? 상점에 판 장비는 되찾을 수 없습니다.\n「${itemName(entry)}」 · ${each.toLocaleString()}G`, "판매", go, "sell");
      else go();
    });
    if (entry.n > 1) {
      // how many: a box with −/+/최대 and the total, all of the stack to start with
      add("여러 개 판매…", () => {
        const i = G.sel;
        ask(`몇 개 판매할까요? (가진 수 ${entry.n}개)\n「${itemName(entry)}」 개당 ${each.toLocaleString()}G`, "판매", (n) => act({ t: "sell", s: i, n }), "", { max: entry.n, note: (n) => `${(each * n).toLocaleString()}G` });
      });
      add(`전부 판매 ${(each * entry.n).toLocaleString()}G`, () => act({ t: "sell", s: G.sel, n: entry.n }));
    }
  }
  if (btns.children.length) det.append(btns);
}

/** Gear worth a second thought before it is sold or salvaged: rare and up, enhanced, or carrying runes. */
const precious = (entry) => isGear(entry.id) && ((entry.q || 0) >= 2 || (entry.enh || 0) > 0 || (entry.ru || []).some(Boolean));

// ── the character sheet ──
/** The sheet: grouped [section name, css class, rows of [infocard key, value]]. Each row shows icon + Korean label + value; click opens detail card. */
const STAT_GROUPS = [
  ["기본 능력치", "six", [["str", (s) => s.st.str], ["wil", (s) => s.st.wil], ["dex", (s) => s.st.dex], ["int", (s) => s.st.int], ["wis", (s) => s.st.wis], ["luk", (s) => s.st.luk]]],
  ["공격 · 전투", "combat", [["atk", (s) => s.atk.toLocaleString()], ["acd", (s) => `${(s.acd / 1000).toFixed(2)}초`], ["crit", (s) => `${s.crit}%`], ["critd", (s) => `${s.critd}%`], ["aspd", (s) => `+${s.dv[2]}%`], ["ls", (s) => `${s.ls}%`]]],
  ["방어 · 생존", "defense", [["def", (s) => s.def.toLocaleString()], ["mhp", (s) => s.mhp.toLocaleString()], ["mmp", (s) => s.mmp.toLocaleString()], ["eva", (s) => `${s.dv[1]}%`], ["cdr", (s) => `${s.dv[3]}%`], ["wm", (s) => `Lv.${s.skLv}`]]],
  ["파밍 · 기록", "util", [["xpb", (s) => `${s.xpb}%`], ["mf", (s) => `${s.mf}%`], ["goldb", (s) => `+${s.goldb}%`], ["kills", (s) => s.kills.toLocaleString()]]],
];
export function renderChar(s) {
  // three tabs (the row is wardrobe_ui.js's): 장비 (the paper-doll and the sheet), 능력치 (statwin.js: buying points), 외형.
  const tab = G.charTab || "gear";
  charTabBtn.classList.toggle("ready", s.ap > 0);
  $("#char-gear").hidden = tab !== "gear";
  $("#char-stat").hidden = tab !== "stat";
  if (tab === "cos") return;
  if (tab === "stat") { StatWin.render($("#char-stat"), s); return; }
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
    // the swap weapon has no slot of its own (owner): it lives behind the Ⅱ button
    if (!host || k === "weapon2") continue;
    const g = s.eq[k];
    const slot = itemSlot(g, g ? { worn: true, onClick: () => { hideTip(); act({ t: "uneq", k }); Sound.play("gear_unequip"); }, hint: `${SLOT_NAME[k]} · 클릭하면 벗습니다` } : {});
    slot.id = `eq-${k}`;
    if (!g) {
      // an empty slot: the silhouette of what goes there and a tiny caption with the slot's name
      const ph = el("span", "ph"); ph.append(iconImg(SLOT_GLYPH[k]));
      slot.append(ph, el("span", "cap", SLOT_NAME[k]));
      slot.title = `${SLOT_NAME[k]} — 비어 있음`;
    }
    host.replaceWith(slot);
  }
  // Ⅰ / Ⅱ above the weapon (§9): Ⅰ is the one in hand (lit), Ⅱ swaps it with the second weapon
  let wsw = $("#eq-wsw");
  if (!wsw) { wsw = el("div", ""); wsw.id = "eq-wsw"; wsw.style.cssText = "display:flex;gap:2px;justify-content:center"; }
  wsw.textContent = "";
  const one = el("button", "btn small gold", "Ⅰ"), two = el("button", "btn small", "Ⅱ");
  one.title = "Ⅰ 손에 든 무기";
  two.title = s.eq.weapon2 ? `Ⅱ ${itemName(s.eq.weapon2)} — 눌러서 바꿔 듭니다 (${K("swap")})` : "Ⅱ 비어 있음 — 가방에서 무기를 골라 [Ⅱ에 장착]";
  two.disabled = !s.eq.weapon2;
  two.onclick = () => { act({ t: "wsw" }); Sound.play("weapon_swap"); };
  for (const b of [one, two]) b.style.cssText = "padding:0 4px;min-width:0;line-height:1.2";
  wsw.append(one, two);
  $("#eq-weapon").before(wsw);
  resetDoll();
  drawPortrait(now());
}
/** The equipment sheet shows legendary powers and the server's current rune set status. */
function renderSheet(s) {
  const st = $("#char-stats");
  st.textContent = "";
  if (s.ap > 0) {
    const apBar = el("button", "char-ap-banner", `★ 미투자 능력치 포인트 +${s.ap} · 클릭해 투자하기`);
    apBar.type = "button";
    apBar.addEventListener("click", () => openStats());
    st.append(apBar);
  }
  for (const [name, cls, rows] of STAT_GROUPS) {
    const grp = el("div", `grp ${cls}`);
    grp.append(el("h4", "", name));
    for (const [key, val] of rows) grp.append(Info.statChip(key, val(s)));
    st.append(grp);
  }
  const pw = $("#char-powers");
  pw.textContent = "";
  renderElementStats(pw, s.element);
  const sets = Object.keys(s.runeCounts || {});
  if (s.lg.length) pw.append(section("장비 고유 효과", "gem"));
  for (const k of s.lg) pw.append(el("div", "lg", `◆ ${G.defs.legend[k][0].replace(/의$/, "")} — ${G.defs.legend[k][1]}`));
  if (sets.length) {
    pw.append(section(`세트 룬 · 활성 ${s.runeSets?.length || 0}/${runeSetMax()}`, "gem"));
    for (const id of sets) {
      const set = runeSetStatus(s, id);
      pw.append(el("div", set.active ? "st on" : "st", `${set.name} · ${set.count}/${set.need} · ${set.status}`));
      pw.append(el("div", "ds", set.desc));
    }
  }
}

function renderElementStats(host, totals) {
  const types = G.defs.elements?.types;
  if (!types || !types.length) return;
  const table = el("div", "element-sheet");
  const extraCols = [["pen", "관통", "%"], ["proc", "발동", "%"], ["dur", "지속", "%"]];
  for (const type of types) {
    const dmg = totals?.damage?.[type] || 0;
    const res = totals?.res?.[type] || 0;
    const extras = extraCols.filter(([k]) => totals?.[k]?.[type]).map(([k, l, u]) => `${l} ${totals[k][type] > 0 ? "+" : ""}${totals[k][type]}${u}`);
    const meta = elementInfo(type);
    const cell = el("div", "el-cell");
    const name = el("b", "el-nm", meta.name);
    name.style.color = meta.color;
    const vals = el("span", "el-v", `공 ${dmg >= 0 ? "+" : ""}${dmg} · 저 ${res >= 0 ? "+" : ""}${res}%${extras.length ? ` · ${extras.join(" ")}` : ""}`);
    cell.append(name, vals);
    table.append(cell);
  }
  host.append(section("속성 공격력 · 저항", "burst"), table);
}

// ── K: 무기 · 스킬 and 전직의 길 (jobtree.js draws the weapon rows and the tree; the skill rows are here, with the quick-slot drag) ──
export function renderSkills(s) {
  const tab = G.skTab === "tree" || G.skTab === "lo" ? G.skTab : "wpn";
  for (const b of $$("#skill-tabs button")) b.classList.toggle("on", b.dataset.tab === tab);
  const box = $("#skill-body");
  if (tab === "lo") Loadout.renderLoadout(box, s);
  else if (tab === "tree") JobTree.renderTree(box, s, { atJob: G.near && G.near.role === "job" });
  else JobTree.renderWeapons(box, s, { skills: (host, k) => skillRows(host, s, k) });
}
/** Weapon `k`'s skills sorted by required mastery level (lowest first), compact key stats + "상세보기" toggle. */
function skillRows(box, s, k) {
  const SK = G.defs.skills, jobs = G.defs.jobs;
  if (k === s.wk && s.eq.weapon) {
    const wk = G.defs.wkinds[s.wk] || {};
    const basic = el("div", "skill basic");
    const bi = el("img", "ic"); bi.alt = ""; bi.src = G.icons.url[s.eq.weapon.id] || iconUrl("sword");
    const bh = el("div", "hd");
    const basicType = { damageType: G.defs.elements?.basic?.[s.wk] };
    bh.append(el("b", "", `기본 공격 · ${wk.name || "공격"}`), skillElements(basicType), el("kbd", "", K("attack")));
    const bMeta = el("div", "sk-meta");
    bMeta.append(el("span", "", `공격 간격 ${(s.acd / 1000).toFixed(2)}초`), el("span", "", `사거리 ${Math.round(s.range)}`));
    const description = {
      hammer: `해머를 머리 위로 들어 올려 앞쪽 ${wk.center}px 지점을 내려찍습니다. 반경 ${wk.r}px의 적을 최대 세 마리까지 맞힙니다.`,
      sword: "대검을 좌우로 번갈아 휘둘러 두 번 이어 벱니다.",
    }[s.wk] || "가장 가까운 적을 겨냥합니다. 이어 치면 세 번째 타격이 마무리 일격이 됩니다.";
    const bDesc = el("p", "sk-desc", description);
    const bFoot = el("div", "sk-foot");
    bFoot.append(JobTree.moreButton(`basic:${s.wk}`, bDesc));
    basic.append(bi, bh, bMeta, bDesc, bFoot);
    hoverTip(basic, (n) => { n.append(el("div", "nm", `기본 공격 · ${wk.name || "공격"}`), skillElements(basicType), el("div", "", description)); });
    box.append(basic);
  }
  // the single job of this weapon, and a two-weapon job that carries it once it is yours — sorted by mastery level ascending (lowest at top)
  const orderIdx = new Map(G.defs.skillOrder.map((id, i) => [id, i]));
  const ids = G.defs.skillOrder.filter((id) => {
    const sk = SK[id];
    if (!sk.job) return sk.wk === k;
    const j = jobs[sk.job];
    return j.kind === "single" ? j.wk[0] === k : sk.job === s.job && j.wk.includes(k);
  }).sort((a, b) => {
    const sa = SK[a], sb = SK[b];
    const na = sa.job ? (sa.need || 25) : (sa.need || 0);
    const nb = sb.job ? (sb.need || 25) : (sb.need || 0);
    if (na !== nb) return na - nb;
    return (orderIdx.get(a) ?? 0) - (orderIdx.get(b) ?? 0);
  });
  for (const id of ids) {
    const sk = SK[id], w = G.skw && G.skw.get(id), pas = sk.kind === "p";
    const enh = (s.ske && s.ske[id]) | 0;
    const rank = sk.job === s.job ? JobTree.signatureProgress(G.defs, s.jp?.[0]) : null;
    const why = pas ? (w ? (w[3] ? "" : "이 무기를 들면 켜집니다") : `숙련 ${sk.need}에 배웁니다`) : sk.job && s.job !== sk.job ? `[${jobs[sk.job].name}] 전직 기술` : QS.skillWhy(id);
    const row = el("div", "skill" + (why ? " locked" : "") + (sk.job ? " ult" : ""));
    const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id);
    const hd = el("div", "hd");
    const at = pas ? "" : QS.keysOf(["s", id]);
    const armorPen = skillArmorPenetration(sk);
    // Learned skills always display enhancement badge (+0, +1, +2 ...) beside the skill name
    const enhEl = w ? el("span", "sk-enh" + (enh > 0 ? " up" : ""), `+${enh}`) : "";
    hd.append(el("b", "", sk.name), enhEl, skillElements(sk), at ? el("kbd", "", at) : "");
    // at a glance: ⏲ cooldown · 위력 · cost and when it is learned; the rest behind 상세보기
    const meta = JobTree.skillStats(sk, w, enh);
    const detail = [rank?.current, why].filter(Boolean).join(" · ");
    meta.append(el("span", "sk-req", detail || (sk.job ? "전직 기술" : `숙련 ${sk.need}`)));
    if (!pas && w && w[3] === 0) { row.classList.add("off"); meta.append(el("span", "sk-req", "스킬 칸에 없음")); }
    const desc = el("div", "sk-desc");
    if (armorPen) desc.append(el("p", "skill-armor-pen", armorPen));
    desc.append(el("p", "", sk.desc));
    const foot = el("div", "sk-foot");
    foot.append(JobTree.moreButton(id, desc));
    if (!pas) {
      const put = el("button", "btn small qs-put", "단축칸");
      put.title = `누른 뒤 아래 단축칸(${K("slot1")}~${K("slot9")})을 누르면 거기에 놓입니다`;
      if (!w) { put.disabled = true; put.title = why; }
      put.addEventListener("click", (e) => { e.stopPropagation(); QS.pick(["s", id]); });
      foot.append(put);
      QS.dragSource(row, ["s", id]);
    }
    row.append(ic, hd, meta, desc, foot);
    hoverTip(row, (n) => {
      n.append(el("div", "nm", w ? `${sk.name} +${enh}` : sk.name), skillElements(sk));
      if (armorPen) n.append(el("div", "", `물리 피해를 계산할 때 대상의 물리 방어력 ${sk.armorPenPct}%를 무시합니다.`));
      n.append(el("div", "", sk.desc));
      if (rank?.current && rank.next) n.append(el("small", "", `다음 · ${rank.next}`));
      if (why) n.append(el("div", "hint", why));
    });
    box.append(row);
  }
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
