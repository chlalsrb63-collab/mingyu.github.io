/**
 * Shop, smith and quest windows (split from client.js): `renderShop renderSmith renderQuest`.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";
import * as Growth from "./growth.js";
import * as SideQ from "./sidequests.js";
import * as Board from "./board.js";
import * as NPC from "./npclife.js";
import { G, $, el, clamp } from "./state.js";
import { act } from "./net.js";
import { countItem } from "./actions.js";
import { hoverTip, ask } from "./windows.js";
import * as Info from "./infocard.js";
import { itemDesc, itemTip, itemName, SLOT_NAME, socketCap, isGear, sellPrice } from "./items.js";
import { refreshUi } from "./hud.js";
import * as Track from "./track.js";

// 잡템 일괄 판매: the same pick as the rules' junkSlots (46-bag.js), counted here only to ask "몇 개, 얼마"
document.getElementById("shop-junk")?.addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-junk]");
  if (!b || !G.self) return;
  const q = +b.dataset.junk, it = G.defs.items;
  const junk = G.self.inv.filter((g) => g && isGear(g.id) && g.id !== "charm" && (g.q | 0) <= q && !(g.enh > 0) && !g.lg && !(g.ru || []).some(Boolean));
  if (!junk.length) { b.textContent = "팔 만한 장비가 없어요"; setTimeout(() => { b.textContent = q ? "고급 이하 일괄 판매" : "일반 장비 일괄 판매"; }, 1400); return; }
  const gold = junk.reduce((n, g) => n + sellPrice(g), 0);
  ask(`${q ? "일반·고급" : "일반"} 등급 장비 ${junk.length}개를 모두 팔까요?
(강화했거나 룬·접두사가 있는 장비는 남깁니다) · ${gold.toLocaleString()}G`, "판매", () => act({ t: "sell", junk: q }), "sell");
});

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
    // the keeper is out on their day (npclife.js): the sign at the counter serves instead
    const cast = keeper && NPC.cast(keeper.id), away = cast && !NPC.at(keeper.id)?.onPost;
    if (say) say.textContent = away ? `[${cast.away || "안내판"}] 주인이 잠시 자리를 비웠어요. 값은 그대로니 골라 가세요. 가방에서 물건을 고르면 팔 수도 있어요.`
      : keeper && keeper.goods && keeper.lines ? keeper.lines[0] : "어서 와요! 필요한 건 다 있답니다. 가방에서 물건을 고르면 팔 수도 있어요.";
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
    if (off < 1) { pr.append(el("s", "", d.price.toLocaleString()), " "); pr.append(Info.coin(cost(d, 1), "deal")); }
    else pr.append(Info.coin(d.price));
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
  const list = $("#smith-list");
  list.textContent = "";
  const stones = countItem("stone"), scrolls = countItem("uncurse");
  const drillItem = G.defs.sockItem, drillName = G.defs.items[drillItem]?.name;
  const drillStones = drillItem ? countItem(drillItem) : 0;
  const chiselN = countItem("rune_chisel"), hammerN = countItem("enc_hammer");
  const encAtk = countItem("enc_atk"), encDef = countItem("enc_def"), encUtil = countItem("enc_util");
  const encCfg = G.defs.enc || { cost: { scroll: 1500, imprint: 2500, extract: 3000, craft: 2000 }, runeFuse: [0, 1000, 3000, 8000], runeExtract: 1000 };
  const storedEnc = Array.isArray(s.enc) ? s.enc : [];
  const stock = $("#smith-socket-stock");
  stock.hidden = !drillName;
  if (drillName) stock.textContent = `${drillName} ${drillStones} · 해체석 ${chiselN} · 추출망치 ${hammerN} · 주문서(적${encAtk}/녹${encDef}/청${encUtil})`;
  let any = false;
  for (const k of G.defs.slots) {
    const g = s.eq[k];
    if (!g) continue;
    const c = s.enh[k], cap = socketCap(g), drilled = g.sk || 0;
    if (!c && !cap) continue;
    any = true;
    const row = el("div", "it");
    const img = el("img"); img.src = G.icons.url[g.id]; img.alt = "";
    const tx = el("div", "tx", itemName(g));
    tx.style.color = Art.RARITY_COL[g.q || 0];
    tx.append(el("small", "", SLOT_NAME[k]));
    const actions = el("div", "smith-actions");
    row.append(img, tx, actions);
    if (c && g.enh >= 10) tx.append(el("small", "", "최대 강화 단계"));
    else if (c && g.cu === 1) {
      // a failed try cursed it (rules 75 "enh"): only a 저주 해제 주문서 opens it again
      const fee = (G.defs.uncurseFee || 400) * ((G.defs.items[g.id] || {}).tier || 1);
      const cl = el("small", "", `저주받음 · 저주 해제 주문서 1장 + 수수료 ${fee.toLocaleString()}G로 풀 수 있습니다 (주문서 보유 ${scrolls})`);
      cl.style.color = "var(--tx-bad, #ff9a8a)"; tx.append(cl);
      const b = el("button", "", "저주 해제");
      b.disabled = scrolls < 1 || s.gold < fee;
      b.addEventListener("click", () => act({ t: "uncurse", k }));
      actions.append(b);
    } else if (c) {
      tx.append(el("small", "", `성공률 ${Math.min(100, G.defs.enh[g.enh] + (g.cu === 2 ? G.defs.enhUc || 10 : 0))}%${g.cu === 2 ? " (저주 해제 보너스)" : ""} · ${c.gold.toLocaleString()}G · 강화석 ${c.stone}개 (보유 ${stones})`));
      const pv = pityLine(s, g);
      if (pv) tx.append(pv);
      const b = el("button", "", "강화");
      b.disabled = s.gold < c.gold || stones < c.stone;
      b.addEventListener("click", () => act({ t: "enh", k }));
      actions.append(b);
    }
    if (cap && drillName) {
      const cost = G.defs.sockCost[drilled];
      const full = drilled >= cap;
      const blocked = full ? "소켓 최대" : s.dead ? "쓰러진 상태" : !drillStones ? `${drillName} 부족` : s.gold < cost ? "골드 부족" : "";
      tx.append(el("small", "smith-socket", `소켓 ${drilled}/${cap}${full ? " · 최대" : ` · ${drillName} 1개 + ${cost.toLocaleString()}G`}`));
      if (blocked && !full) tx.append(el("small", "smith-socket", blocked));
      const b = el("button", "", "소켓 +1");
      b.disabled = !!blocked;
      b.title = blocked || "소켓을 1개 엽니다";
      b.addEventListener("click", () => act({ t: "socket", k }));
      actions.append(b);
    }
    // ITM-08: safe rune extraction with 룬 해체석
    if (Array.isArray(g.ru)) g.ru.forEach((sock, idx) => {
      if (!sock) return;
      const rid = Array.isArray(sock) ? sock[0] : sock;
      const rname = G.defs.items[rid]?.name || rid;
      const b = el("button", "", `룬 회수(${idx + 1})`);
      b.disabled = s.dead || chiselN < 1 || s.gold < encCfg.runeExtract;
      b.title = `${rname} 회수 · 룬 해체석 1개 + ${encCfg.runeExtract.toLocaleString()}G`;
      b.addEventListener("click", () => act({ t: "rune_extract", k, i: idx }));
      actions.append(b);
    });
    // ITM-02: prefix enchant scrolls & stored prefix imprint
    if ((g.q | 0) >= 2 && g.cu !== 1) {
      const tier = (G.defs.items[g.id] || {}).tier || 1;
      const scCost = encCfg.cost.scroll * tier;
      for (const [sid, lbl, cnt] of [["enc_atk", "공격 인챈트", encAtk], ["enc_def", "방어 인챈트", encDef], ["enc_util", "유틸 인챈트", encUtil]]) {
        if (cnt <= 0) continue;
        const b = el("button", "", lbl);
        b.disabled = s.dead || s.gold < scCost;
        b.title = `${G.defs.items[sid]?.name} 1장 + ${scCost.toLocaleString()}G`;
        b.addEventListener("click", () => act({ t: "enc_apply", k, src: "scroll", id: sid }));
        actions.append(b);
      }
      if (storedEnc.length) {
        const slotL = { weapon: "W", ring1: "R", ring2: "R", ring: "R", gloves: "G", armor: "A", boots: "B", amulet: "N", helm: "H" }[G.defs.items[g.id]?.type] || "";
        const impCost = encCfg.cost.imprint * tier;
        const idx = storedEnc.findIndex((lg) => !slotL || (G.defs.legend?.[lg]?.[2] || "").includes(slotL));
        if (idx >= 0) {
          const lg = storedEnc[idx], b = el("button", "", `이식:${G.defs.legend?.[lg]?.[0] || lg}`);
          b.disabled = s.dead || s.gold < impCost;
          b.title = `보관 접두사 [${G.defs.legend?.[lg]?.[0]}] 이식 · ${impCost.toLocaleString()}G`;
          b.addEventListener("click", () => act({ t: "enc_apply", k, src: "imprint", i: idx }));
          actions.append(b);
        }
      }
    }
    hoverTip(img, (h) => itemTip(g, h, { worn: true }));
    list.append(row);
  }
  if (!any) list.append(el("div", "ds", "장비를 착용하면 강화하거나 소켓을 열 수 있습니다."));

  // ITM-08: 룬 3개 합성 → 상위 등급 랜덤 획득
  const runeCounts = [0, 0, 0, 0];
  for (const sl of s.inv || []) {
    const rq = G.defs.runes?.[sl.id]?.q;
    if (rq >= 1 && rq <= 3) runeCounts[rq] += sl.n || 1;
  }
  list.append(el("div", "section", "룬 합성 (동일 등급 3개 → 상위 등급 랜덤)"));
  const fuseRow = el("div", "btns");
  for (const [q, label] of [[1, "고급 3→희귀"], [2, "희귀 3→전설"], [3, "전설 3→세트"]]) {
    const cost = encCfg.runeFuse[q], cnt = runeCounts[q];
    const b = el("button", "btn small", `${label} (${cnt}/3 · ${cost.toLocaleString()}G)`);
    b.disabled = s.dead || cnt < 3 || s.gold < cost;
    b.addEventListener("click", () => { act({ t: "rune_fuse", q }); Sound.play("quest"); });
    fuseRow.append(b);
  }
  list.append(fuseRow);

  // ITM-02: 추출의 마법망치 · 보관 접두사
  list.append(el("div", "section", `접두사 추출 · 보관함 (${storedEnc.length}/${encCfg.max || 20})`));
  if (storedEnc.length) {
    list.append(el("div", "ds", `보관 중: ${storedEnc.map((lg) => G.defs.legend?.[lg]?.[0] || lg).join(", ")}`));
  }
  const extractable = (s.inv || []).map((g, idx) => [g, idx]).filter(([g]) => g && isGear(g.id) && (g.q | 0) >= 3 && g.lg && g.cu !== 1);
  if (extractable.length) {
    for (const [g, idx] of extractable.slice(0, 6)) {
      const tier = (G.defs.items[g.id] || {}).tier || 1, cost = encCfg.cost.extract * tier;
      const row = el("div", "it");
      const img = el("img"); img.src = G.icons.url[g.id]; img.alt = "";
      const tx = el("div", "tx", itemName(g));
      tx.style.color = Art.RARITY_COL[g.q || 0];
      tx.append(el("small", "", `추출 시 [${G.defs.legend?.[g.lg]?.[0] || g.lg}] 보관 (장비 소멸 · 망치 1개 + ${cost.toLocaleString()}G)`));
      const b = el("button", "", "추출");
      b.disabled = s.dead || hammerN < 1 || s.gold < cost || storedEnc.length >= (encCfg.max || 20);
      b.addEventListener("click", () => ask(`[${itemName(g)}]에서 접두사 [${G.defs.legend?.[g.lg]?.[0] || g.lg}]를 추출할까요?\n(장비는 사라집니다 · ${cost.toLocaleString()}G)`, "추출", () => act({ t: "enc_extract", s: idx })));
      row.append(img, tx, b);
      list.append(row);
    }
  } else {
    list.append(el("div", "ds", "가방에 접두사를 추출할 전설·유니크 장비가 없습니다."));
  }
}
/**
 * The pity gauge of the step this piece is on (63-social-weekly.js PITY): from +5 each failure adds the
 * gear's tier, and `need × tier` makes the next try at that step certain. Null below +5.
 */
function pityLine(s, g) {
  const P = G.defs.social && G.defs.social.pity, i = g.enh - (P ? P.from : 99);
  if (!P || i < 0 || i >= P.need.length || !s.pity) return null;
  const tier = (G.defs.items[g.id] && G.defs.items[g.id].tier) || 1, need = P.need[i] * tier, have = Math.min(s.pity[i] | 0, need);
  return el("small", "pity", have >= need ? `강화 보정 가득 · +${g.enh + 1} 강화는 반드시 성공` : `강화 보정 ${have} / ${need} · 실패할 때마다 +${tier}, 가득 차면 다음 강화 성공 보장`);
}
// ── quests: a log on the left, the chosen entry on the right ──
export function renderQuest(s) {
  questBody(s);
  // the chosen entry's [추적]: walk to its NPC or monster (track.js), beside its own buttons
  const det = $("#quest-body .qdetail"), trk = det && Track.button(G.qsel);
  if (trk) ([...det.querySelectorAll(".btns")].pop() || det).append(trk);
}
function questBody(s) {
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
  const picks = Object.keys(mobs).filter((k) => !mobs[k].boss && !mobs[k].chest && !mobs[k].questOnly && mobs[k].tier <= (s.lvl + 3) / 4 + 4 && (!s.bq || s.bq.k !== k)).sort((a, b) => mobs[b].lv - mobs[a].lv).slice(0, 4);
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
  // the chapter a main step belongs to: the nearest row at or before it that opens one (QUESTS chap/intro)
  const chapOf = (i) => { for (let j = Math.min(i, qs.length - 1); j >= 0; j--) if (qs[j].chap) return qs[j]; return null; };
  const curChap = chapOf(cur);
  list.append(el("div", "grp", curChap ? `주요 의뢰 · ${curChap.chap}` : "주요 의뢰"));
  if (qs[cur]) {
    const q = qs[cur];
    entry(`main:${cur}`, `${cur + 1}. ${q.title}`, s.q.st === 0 ? "새 의뢰" : s.q.n >= q.n ? "완료!" : `${s.q.n}/${q.n}`, s.q.st === 1 && s.q.n >= q.n ? "done" : "");
  }
  SideQ.listEntries(s, entry, null, true);
  for (let i = cur - 1; i >= 0; i--) entry(`main:${i}`, `${i + 1}. ${qs[i].title}`, "완료", "past");
  SideQ.listEntries(s, entry, (t) => list.append(el("div", "grp", t)));
  SideQ.listAvailable(s, entry, (t) => list.append(el("div", "grp", t)));
  list.append(el("div", "grp", "반복 토벌"));
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
    const c = chapOf(i);
    if (c) det.append(el("div", "section", c.chap), el("p", "ds", c.intro));
    det.append(el("div", "q-title", `${i + 1}. ${q.title}`), el("p", "say", q.text));
    if (i < cur) { det.append(el("div", "q-reward", "완료한 의뢰입니다.")); return; }
    // the chapter's story beat (a 주요 의뢰 side quest) comes before this step can be accepted
    const beat = s.q.st === 0 && q.sq && (G.defs.side || []).find((o) => o.id === q.sq);
    const beatOpen = !!beat && s.sq?.find(([id]) => id === q.sq)?.[1] !== 4;
    if (beatOpen) det.append(el("p", "ds", `먼저 주요 의뢰 [${beat.title}]부터 마쳐야 합니다 — ${beat.giverName} (${beat.giverMap})`));
    if (s.q.st === 1) det.append(goal(`Lv.${mob.lv} ${mob.name}`, s.q.n, q.n));
    else det.append(el("div", "q-goal", `목표: Lv.${mob.lv} ${mob.name} ${q.n}마리`));
    det.append(SideQ.rewardRow({ ...q, title: null }));   // a main row's title is its name; only its honor is a 칭호
    if (s.q.st === 0) button("의뢰 수락", () => act({ t: "quest", a: "accept" }), !beatOpen);
    else button("의뢰 완료", () => act({ t: "quest", a: "done" }), s.q.n >= q.n);
  } else if (kind === "sq") {
    SideQ.detail(det, arg, s);
  } else if (kind === "bq" && !arg) {
    const d = mobs[s.bq.k];
    det.append(el("div", "q-title", `반복 토벌 — ${d.name} 토벌`));
    det.append(el("p", "say", `같은 몬스터 ${G.defs.bounty}마리를 잡을 때마다 보상을 받고, 곧바로 다시 시작됩니다. 지금까지 ${s.bn}회 완료 — 3회마다 강화석, 10회마다 룬이 붙습니다.`));
    det.append(goal(`Lv.${d.lv} ${d.name}`, s.bq.n, s.bq.need));
    det.append(el("div", "q-reward", `보상: EXP ${Math.round(d.xp * s.bq.need * 0.5).toLocaleString()} + 골드`));
    button("보고", () => act({ t: "bq", a: "done" }), s.bq.n >= s.bq.need);
  } else if (kind === "bq") {
    const d = mobs[arg];
    det.append(el("div", "q-title", `Lv.${d.lv} ${d.name} 토벌`));
    det.append(el("p", "say", `${d.name} ${G.defs.bounty}마리를 잡아 오면 보상을 주지. 다 잡으면 곧바로 같은 의뢰가 다시 시작된다네.${s.bq ? " (지금 받은 반복 토벌와 바뀝니다)" : ""}`));
    det.append(el("div", "q-reward", `보상: EXP ${Math.round(d.xp * G.defs.bounty * 0.5).toLocaleString()} + 골드`));
    button(s.bq ? "이 의뢰로 바꾸기" : "의뢰 수락", () => act({ t: "bq", a: "take", k: arg }), true);
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
