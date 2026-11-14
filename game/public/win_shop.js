/**
 * Shop, smith and quest windows (split from client.js): `renderShop renderSmith renderQuest`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as Growth from "./growth.js";
import * as SideQ from "./sidequests.js";
import * as Board from "./board.js";
import { G, $, el, clamp } from "./state.js";
import { act } from "./net.js";
import { countItem } from "./actions.js";
import { hoverTip } from "./windows.js";
import { itemDesc, itemTip, itemName, SLOT_NAME } from "./items.js";
import { refreshUi } from "./hud.js";

// ── shop, smith (수련관 카이 and 전직관 아르센: statwin.js, jobtree.js) ──
export function renderShop(s) {
  const it = G.defs.items, list = $("#shop-list");
  list.textContent = "";
  Growth.shopTop(list, s);
  // a shopkeeper with their own counter (the cafe, the inn) sells their own goods, under their own name
  const keeper = G.near && G.near.role === "shop" ? G.near : null, goods = (keeper && keeper.goods) || G.defs.shop;
  const win = $("#w-shop");
  if (win) {
    win.querySelector("header .t").textContent = keeper ? keeper.name : "보급상 리나";
    const say = win.querySelector(".say");
    if (say) say.textContent = keeper && keeper.goods && keeper.lines ? keeper.lines[0] : "어서 와요! 필요한 건 다 있답니다. 가방에서 물건을 고르면 팔 수도 있어요.";
    // the keeper's trust (board.js): a 단골 pays 5 % less here, as the server counts it
    let rep = win.querySelector("#shop-rep");
    if (!rep) { rep = el("div", "shop-rep"); rep.id = "shop-rep"; list.before(rep); }
    rep.textContent = "";
    const badge = keeper && Board.repBadge(s, keeper.id);
    if (badge) rep.append(badge);
  }
  const R = G.defs.life && G.defs.life.rep, off = keeper && R && Board.repOf(s, keeper.id) >= R.tier[0] ? R.disc : 1;
  const cost = (d, n) => (off < 1 ? Math.floor(d.price * n * off) : d.price * n);
  for (const key of goods) {
    const id = key[0] === "W" && key.length === 2 ? `w_${s.cls}_${key[1]}` : key;
    const d = it[id];
    if (d.cls && d.cls !== s.cls) continue;
    const row = el("div", "it");
    const img = el("img"); img.src = G.icons.url[id]; img.alt = "";
    const tx = el("div", "tx", d.name);
    const pr = el("small", "");
    if (off < 1) { pr.append(el("s", "", `${d.price.toLocaleString()}G`), " "); pr.append(el("b", "deal", `${cost(d, 1).toLocaleString()}G`)); }
    else pr.append(`${d.price.toLocaleString()}G`);
    pr.append(` · ${itemDesc({ id })}`);
    tx.append(pr);
    row.append(img, tx);
    const buy = (n) => { const b = el("button", "", n > 1 ? `×${n}` : "구매"); b.disabled = s.gold < cost(d, n); if (off < 1) b.title = `${cost(d, n).toLocaleString()}G (${R.name[0]} 할인)`; b.addEventListener("click", () => act({ t: "buy", id: key, n })); row.append(b); };
    buy(1);
    if (d.type === "pot") buy(10);
    hoverTip(img, (h) => itemTip({ id }, h, { price: `${cost(d, 1).toLocaleString()}G` }));
    list.append(row);
  }
}
export function renderSmith(s) {
  const it = G.defs.items, list = $("#smith-list");
  list.textContent = "";
  const stones = countItem("stone");
  let any = false;
  for (const k of G.defs.slots) {
    const g = s.eq[k];
    if (!g || !s.enh[k]) continue;
    any = true;
    const row = el("div", "it");
    const img = el("img"); img.src = G.icons.url[g.id]; img.alt = "";
    const tx = el("div", "tx", itemName(g));
    tx.style.color = Art.RARITY_COL[g.q || 0];
    row.append(img, tx);
    if (g.enh >= 10) tx.append(el("small", "", "최대 강화 단계입니다"));
    else {
      const c = s.enh[k];
      tx.append(el("small", "", `${SLOT_NAME[k]} · 성공률 ${G.defs.enh[g.enh]}% · ${c.gold.toLocaleString()}G · 강화석 ${c.stone}개 (보유 ${stones})`));
      const b = el("button", "", "강화");
      b.disabled = s.gold < c.gold || stones < c.stone;
      b.addEventListener("click", () => act({ t: "enh", k }));
      row.append(b);
    }
    hoverTip(img, (h) => itemTip(g, h, { worn: true }));
    list.append(row);
  }
  if (!any) list.append(el("div", "ds", "강화할 수 있는 장비를 착용하고 있지 않습니다."));
  void it;
}
// ── quests: a log on the left, the chosen entry on the right ──
export function renderQuest(s) {
  const qs = G.defs.quests, mobs = G.defs.mobs, it = G.defs.items;
  const atElder = G.near && G.near.role === "elder";
  const body = $("#quest-body");
  body.textContent = "";
  const wrap = el("div", "qwin"), list = el("div", "qlist well"), det = el("div", "qdetail");
  wrap.append(list, det);
  body.append(wrap);
  const cur = Math.min(s.q.i, qs.length);
  // a main quest just handed in: show the next one rather than the finished page
  if (G.qCur !== undefined && G.qCur !== cur && G.qsel === `main:${G.qCur}`) G.qsel = `main:${cur}`;
  G.qCur = cur;
  const picks = Object.keys(mobs).filter((k) => !mobs[k].boss && !mobs[k].chest && mobs[k].tier <= (s.lvl + 3) / 4 + 4 && (!s.bq || s.bq.k !== k)).sort((a, b) => mobs[b].lv - mobs[a].lv).slice(0, 4);
  const keys = [];
  const entry = (key, label, sub, cls) => {
    keys.push(key);
    const b = el("button", cls || "");
    b.dataset.k = key;
    b.append(el("span", "", label));
    if (sub) b.append(el("small", "", sub));
    b.addEventListener("click", () => { G.qsel = key; Sound.play("tab"); refreshUi(); });
    list.append(b);
  };
  list.append(el("div", "grp", "주요 의뢰"));
  if (qs[cur]) {
    const q = qs[cur];
    entry(`main:${cur}`, `${cur + 1}. ${q.title}`, s.q.st === 0 ? "새 의뢰" : s.q.n >= q.n ? "완료!" : `${s.q.n}/${q.n}`, s.q.st === 1 && s.q.n >= q.n ? "done" : "");
  }
  for (let i = cur - 1; i >= 0; i--) entry(`main:${i}`, `${i + 1}. ${qs[i].title}`, "완료", "past");
  SideQ.listEntries(s, entry, (t) => list.append(el("div", "grp", t)));
  list.append(el("div", "grp", "반복 의뢰"));
  if (s.bq) entry("bq", `${mobs[s.bq.k].name} 토벌`, s.bq.n >= s.bq.need ? "완료!" : `${Math.min(s.bq.n, s.bq.need)}/${s.bq.need}`, s.bq.n >= s.bq.need ? "done" : "");
  for (const k of picks) entry(`bq:${k}`, `${mobs[k].name}`, `Lv.${mobs[k].lv}`, "offer");
  list.append(el("div", "grp", "토벌 숙련"));
  const known = Object.keys(mobs).filter((k) => s.mk[k] && !mobs[k].chest).sort((a, b) => mobs[a].lv - mobs[b].lv);
  entry("mk", "숙련 기록", `${known.length}종`);
  if (!keys.includes(G.qsel)) G.qsel = qs[cur] ? `main:${cur}` : s.bq ? "bq" : "mk";
  for (const b of list.querySelectorAll("button")) b.classList.toggle("on", b.dataset.k === G.qsel);

  const goal = (label, n, need) => {
    const row = el("div", "q-goal"), bar = el("div", "bar"), f = el("i");
    f.style.width = `${clamp((n / need) * 100, 0, 100)}%`;
    bar.append(f);
    row.append(el("span", "", label), bar, el("b", "", `${Math.min(n, need)} / ${need}`));
    return row;
  };
  const button = (label, fn, ok) => {
    const btns = el("div", "btns");
    const b = el("button", "btn gold", label);
    b.disabled = !ok || !atElder;
    b.addEventListener("click", () => { fn(); Sound.play("quest"); });
    btns.append(b);
    if (!atElder) btns.append(el("span", "ds", "관리자 엘더윈 곁에서만 할 수 있습니다"));
    det.append(btns);
  };
  const [kind, arg] = G.qsel.split(":");
  if (kind === "main") {
    const i = +arg, q = qs[i], mob = mobs[q.mob];
    det.append(el("div", "q-title", `${i + 1}. ${q.title}`), el("p", "say", q.text));
    if (i < cur) { det.append(el("div", "q-reward", "완료한 의뢰입니다.")); return; }
    if (s.q.st === 1) det.append(goal(`Lv.${mob.lv} ${mob.name}`, s.q.n, q.n));
    else det.append(el("div", "q-goal", `목표: Lv.${mob.lv} ${mob.name} ${q.n}마리`));
    det.append(el("div", "q-reward", `보상: EXP ${q.xp.toLocaleString()} · ${q.gold.toLocaleString()}G · ${q.items.map(([id, n]) => `${it[id].name} ×${n}`).join(", ")}`));
    if (s.q.st === 0) button("의뢰 수락", () => act({ t: "quest", a: "accept" }), true);
    else button("의뢰 완료", () => act({ t: "quest", a: "done" }), s.q.n >= q.n);
  } else if (kind === "sq") {
    SideQ.detail(det, arg, s);
  } else if (kind === "bq" && !arg) {
    const d = mobs[s.bq.k];
    det.append(el("div", "q-title", `반복 의뢰 — ${d.name} 토벌`));
    det.append(el("p", "say", `같은 몬스터 ${G.defs.bounty}마리를 잡을 때마다 보상을 받고, 곧바로 다시 시작됩니다. 지금까지 ${s.bn}회 완료 — 3회마다 강화석, 10회마다 룬이 붙습니다.`));
    det.append(goal(`Lv.${d.lv} ${d.name}`, s.bq.n, s.bq.need));
    det.append(el("div", "q-reward", `보상: EXP ${Math.round(d.xp * s.bq.need * 0.5).toLocaleString()} + 골드`));
    button("보고", () => act({ t: "bq", a: "done" }), s.bq.n >= s.bq.need);
  } else if (kind === "bq") {
    const d = mobs[arg];
    det.append(el("div", "q-title", `Lv.${d.lv} ${d.name} 토벌`));
    det.append(el("p", "say", `${d.name} ${G.defs.bounty}마리를 잡아 오면 보상을 주지. 다 잡으면 곧바로 같은 의뢰가 다시 시작된다네.${s.bq ? " (지금 받은 반복 의뢰와 바뀝니다)" : ""}`));
    det.append(el("div", "q-reward", `보상: EXP ${Math.round(d.xp * G.defs.bounty * 0.5).toLocaleString()} + 골드`));
    button(s.bq ? "이 의뢰로 바꾸기" : "의뢰 받기", () => act({ t: "bq", a: "take", k: arg }), true);
  } else {
    det.append(el("div", "q-title", "토벌 숙련"));
    det.append(el("p", "ds", "같은 몬스터를 많이 잡을수록 그 몬스터에게 주는 피해(단계당 +3%)와 얻는 경험치(+2%)가 늘어납니다."));
    const steps = G.defs.mastery;
    if (!known.length) det.append(el("p", "ds", "아직 기록이 없습니다."));
    for (const k of known) {
      const n = s.mk[k];
      let r = 0;
      while (r < steps.length && n >= steps[r]) r++;
      const row = el("div", "mk");
      row.append(el("span", "", mobs[k].name), el("b", "", "★".repeat(r) + "☆".repeat(steps.length - r)), el("small", "", r < steps.length ? `${n.toLocaleString()} / ${steps[r].toLocaleString()}` : `${n.toLocaleString()} · 최고 단계`));
      det.append(row);
    }
  }
}
