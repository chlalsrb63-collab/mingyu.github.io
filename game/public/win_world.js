/**
 * Journey windows (split from client.js): waypoints `renderWarp`, dailies `renderDaily tickDaily`,
 * achievements `renderAchieve`, the monster collection `renderCollect` (`mobThumb`), the tutorial
 * card (`tutTry tutCard`), the rift event widget, the cast bar, and the door fade.
 */

import { Sound } from "./audio.js";
import { iconImg } from "./uiicons.js";
import * as SP from "./sprites.js";
import { $, G, el, dist, T, clamp, now } from "./state.js";
import { act } from "./net.js";
import { stoneNear } from "./actions.js";
import { wpWoke } from "./overlay.js";
import { placeToasts, touch, banner, openWin, toast } from "./windows.js";
import { statText } from "./items.js";
import { refreshUi, setOnce, section } from "./hud.js";
import { K } from "./keymap.js";
import * as Track from "./track.js";
import * as SideQ from "./sidequests.js";

// ── waypoints ──
const bandText = (b) => (b ? `Lv.${b[0]}–${b[1]}` : "안전 지대");
export function renderWarp(s) {
  const box = $("#warp-body");
  box.textContent = "";
  const here = G.map && G.map.id, can = stoneNear() || (G.near && G.near.role === "warp");
  box.append(el("p", "say", can ? "깨운 이동의 돌끼리는 한순간에 오갈 수 있다네. 어디로 가겠나?" : "이동의 돌 곁에서만 다른 돌로 건너갈 수 있습니다. 돌에 다가가 " + K("interact") + "를 누르세요."));
  const list = el("div", "list");
  // a big hunting ground has several stones (self.wp: { mapId: bitmask }, bit i = stone i); the one I stand by is "here"
  const stones = ((G.map && G.map.marks) || []).filter((k) => k.kind === "waypoint");
  const hereI = stones.findIndex((k) => dist(G.me.x, G.me.y, k.x * T + 8, k.y * T + 8) < 40);
  for (const w of G.defs.waypoints || []) for (let i = 0; i < (w.n || 1); i++) {
    const levelOk = !w.minLv || s.lvl >= w.minLv;
    const woke = wpWoke(s, w.id, i), open = levelOk && woke, cur = w.id === here && (hereI < 0 ? i === 0 : hereI === i);
    const row = el("div", "it wp" + (open ? "" : " locked") + (cur ? " cur" : "") + (G.warpPick === w.id && i === (G.warpPickI | 0) ? " pick" : ""));
    const ic = el("span", "wpi"); ic.append(iconImg("stone", open ? "#8ad8ff" : "#6a6658"));
    const tx = el("div", "tx", (w.n || 1) > 1 ? `${w.name} · ${(w.names && w.names[i]) || i + 1}` : w.name);
    const band = w.minLv ? `Lv.${w.minLv} 전용` : bandText(w.band);
    tx.append(el("small", "", `${band} · ${cur ? "현재 위치" : !levelOk ? "레벨 부족" : woke ? "이동 가능" : "아직 깨우지 않음"}`));
    row.append(ic, tx);
    if (!cur) {
      const b = el("button", open ? "btn gold small" : "btn small", "이동");
      b.disabled = !open || !can;
      b.addEventListener("click", () => { act(i ? { t: "warp", to: w.id, i } : { t: "warp", to: w.id }); Sound.play("ui"); G.warpPick = null; });
      row.append(b);
    }
    list.append(row);
  }
  box.append(list);
  box.append(el("p", "hint", "새 맵의 이동의 돌에 다가가면 깨어납니다. 싸우는 중(3초 안에 맞음)에는 이동할 수 없습니다."));
}

// ── daily tasks ──
const rewardText = (r) => [r.gold ? `${r.gold.toLocaleString()}G` : "", r.xp ? `EXP ${r.xp.toLocaleString()}` : "", r.stone ? `강화석 ${r.stone}` : "", r.gear ? "희귀 이상 장비" : ""].filter(Boolean).join(" · ");
const clock = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000); return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; };
export function renderDaily(s) {
  const box = $("#daily-body");
  box.textContent = "";
  const d = s.daily;
  if (!d) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const top = el("div", "daily-top");
  top.append(iconImg("cal", "#e2c486"), el("span", "", "매일 아침 6시에 새 과제"), el("b", "", ""));
  top.lastChild.id = "daily-clock";
  box.append(top);
  d.tasks.forEach((tk, i) => {
    const card = el("div", "dcard" + (tk.claimed ? " claimed" : tk.done ? " done" : ""));
    const hd = el("div", "dh");
    hd.append(el("b", "", tk.text), el("span", "", `${Math.min(tk.n, tk.need)} / ${tk.need}`));
    const bar = el("div", "bar"), f = el("i"); f.style.width = `${clamp((tk.n / tk.need) * 100, 0, 100)}%`; bar.append(f);
    const ft = el("div", "df");
    ft.append(el("small", "", rewardText(tk.reward)));
    const b = el("button", tk.done && !tk.claimed ? "btn gold small" : "btn small", tk.claimed ? "받음" : "받기");
    b.disabled = !tk.done || tk.claimed;
    b.addEventListener("click", () => { act({ t: "daily", i }); Sound.play("daily"); });
    const go = Track.button(`daily:${i}`, tk.text);   // a hunting task: walk to its ground (track.js)
    if (go) ft.append(go);
    ft.append(b);
    card.append(hd, bar, ft);
    if (i === 0 && !tk.done && !tk.claimed && (tk.kind === "party" || (tk.kind === "kill" && tk.n === 0))) {
      const party = tk.kind === "party";
      const pick = el("button", "btn small", party ? "일반 사냥으로 변경" : "파티 사냥으로 변경");
      pick.addEventListener("click", () => act({ t: "daily", i: party ? "solo" : "party" }));
      const guide = party
        ? (tk.n ? "가까운 파티원과 함께 처치하세요. 변경 시 파티 처치 기록이 초기화됩니다." : "가까운 파티원과 함께 처치하세요.")
        : "첫 처치 전에 사냥 과제를 바꿀 수 있습니다.";
      card.append(el("p", "hint", guide), pick);
    }
    box.append(card);
  });
  const all = d.tasks.every((tk) => tk.claimed);
  const chest = el("div", "dcard bonus" + (d.bonus ? " claimed" : all ? " done" : ""));
  const hd = el("div", "dh"); hd.append(el("b", "", "오늘의 보너스 상자"), el("span", "", d.bonus ? "받음" : all ? "열 수 있음" : "세 과제를 모두 마치면"));
  const ft = el("div", "df"); ft.append(el("small", "", rewardText(d.bonusReward || {})));
  const b = el("button", all && !d.bonus ? "btn gold small" : "btn small", d.bonus ? "받음" : "열기");
  b.disabled = !all || d.bonus;
  b.addEventListener("click", () => { act({ t: "daily", i: "bonus" }); Sound.play("daily"); });
  ft.append(b);
  chest.append(hd, ft);
  box.append(chest);
  box.append(el("p", "hint", "과제는 어디서든 받을 수 있습니다. 광장의 일일 의뢰 게시판 담당자에게서도 열 수 있습니다."));
  tickDaily(now());
}
export function tickDaily(t) {
  const c = $("#daily-clock");
  if (c && G.dailyReset) { const v = `초기화까지 ${clock(G.dailyReset - t)}`; if (c.textContent !== v) c.textContent = v; }
}

// ── 주간 수첩 (the weekly book, 63-social-weekly.js: self.week, defs.social.week) ──
const weekText = (r) => [rewardText(r), r.rune ? "룬" : "", r.bless ? `축복 강화석 ${r.bless}` : "", r.cos ? "외형 하나" : ""].filter(Boolean).join(" · ");
const days = (ms) => { const h = Math.max(0, Math.floor(ms / 3600000)); return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`; };
export function renderWeek(s) {
  const box = $("#week-body");
  box.textContent = "";
  const wk = s.week, def = G.defs.social && G.defs.social.week;
  if (!wk || !def) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const top = el("div", "daily-top");
  top.append(iconImg("clock", "#e2c486"), el("span", "", `이번 주 ${wk.done} / ${def.boxes.length}칸 · ${def.need}칸이면 완성`), el("b", "", `초기화까지 ${days(wk.reset)}`));
  box.append(top);
  // the weekly boss challenge starts at the town's obelisk: its keeper, with a [추적] (track.js)
  const ob = el("div", "trk-row"), go = Track.button("week", "주간 보스 도전");
  ob.append(el("small", "", "주간 보스 도전 · 버드나무광장 오벨리스크의 균열 지기"));
  if (go) { ob.append(go); box.append(ob); }
  const grid = el("div", "week-boxes");
  def.boxes.forEach(([, text, need], i) => {
    const n = Math.min(wk.v[i] | 0, need), done = n >= need;
    const card = el("div", "dcard" + (done ? " done" : ""));
    const hd = el("div", "dh");
    hd.append(el("b", "", text), el("span", "", done ? "✓" : `${n} / ${need}`));
    const bar = el("div", "bar"), f = el("i"); f.style.width = `${clamp((n / need) * 100, 0, 100)}%`; bar.append(f);
    card.append(hd, bar);
    grid.append(card);
  });
  box.append(grid);
  box.append(section("수첩 보상", "scroll"));
  def.tiers.forEach((need, i) => {
    const got = !!wk.got[i], ready = wk.done >= need;
    const card = el("div", "dcard bonus" + (got ? " claimed" : ready ? " done" : ""));
    const hd = el("div", "dh"); hd.append(el("b", "", `${need}칸 보상`), el("span", "", got ? "받음" : ready ? "받을 수 있음" : `${need - wk.done}칸 남음`));
    const ft = el("div", "df"); ft.append(el("small", "", weekText(wk.rw[i] || {})));
    const b = el("button", ready && !got ? "btn gold small" : "btn small", got ? "받음" : "받기");
    b.disabled = got || !ready;
    b.addEventListener("click", () => { act({ t: "wk", i }); Sound.play("daily"); });
    ft.append(b);
    card.append(hd, ft);
    box.append(card);
  });
  const rest = clamp(wk.rest | 0, 0, def.restMax);
  box.append(section("쉬고 온 보너스", "fire"));
  box.append(el("p", rest ? "hint gold" : "hint", rest
    ? `오늘의 일일 의뢰 골드 · 경험치 +${rest * def.restPct}% (쉰 날 ${rest}일)`
    : `과제를 하나도 받지 않은 날마다 다음 날 일일 의뢰 보상이 +${def.restPct}%씩 늘어납니다 (최대 ${def.restMax}일).`));
  box.append(el("p", "hint", "매주 월요일 아침 6시에 새 수첩이 열립니다. 12칸 가운데 아무거나 7칸만 채우면 됩니다."));
}

// ── achievements and titles ──
export function renderAchieve(s) {
  const box = $("#achieve-body");
  box.textContent = "";
  const all = G.defs.achievements || [], got = new Set(s.ach || []);
  const cats = [...new Set(all.map((a) => a.cat))];
  if (!G.achTab || (G.achTab !== "칭호" && !cats.includes(G.achTab))) G.achTab = cats[0];
  const head = el("div", "ach-top");
  head.append(iconImg("trophy", "#e2c486"), el("span", "", `업적 점수 ${s.pts || 0}`), el("small", "", `${got.size} / ${all.length}`));
  box.append(head);
  const tabs = el("div", "tabs");
  for (const c of [...cats, "칭호"]) {
    const n = c === "칭호" ? all.filter((a) => a.title && got.has(a.id)).length : all.filter((a) => a.cat === c && got.has(a.id)).length;
    const of = c === "칭호" ? all.filter((a) => a.title).length : all.filter((a) => a.cat === c).length;
    const b = el("button", G.achTab === c ? "on" : "", `${c} ${n}/${of}`);
    b.addEventListener("click", () => { G.achTab = c; Sound.play("tab"); refreshUi(); });
    tabs.append(b);
  }
  box.append(tabs);
  const list = el("div", "list");
  if (G.achTab === "칭호") {
    const worn = s.title;
    list.append(el("p", "hint", worn ? `지금 단 칭호: 「${(all.find((a) => a.id === worn) || {}).title}」` : "칭호를 달면 이름 위에 보이고, 희귀한 칭호는 능력치도 조금 올려 줍니다."));
    for (const a of all.filter((x) => x.title)) {
      const have = got.has(a.id), on = s.title === a.id;
      const row = el("div", "it ach" + (have ? " got" : " locked") + (on ? " on" : ""));
      const tx = el("div", "tx", `「${a.title}」`);
      tx.append(el("small", "", `${a.name} — ${a.desc}${a.bonus ? ` · ${a.bonus.map(([k, v]) => statText(k, v)).join(", ")}` : ""}`));
      row.append(tx);
      const b = el("button", on ? "btn small" : "btn gold small", on ? "떼기" : "달기");
      b.disabled = !have;
      b.addEventListener("click", () => { act({ t: "title", id: on ? "" : a.id }); Sound.play("ui"); });
      row.append(b);
      list.append(row);
    }
  } else {
    for (const a of all.filter((x) => x.cat === G.achTab)) {
      const have = got.has(a.id);
      const row = el("div", "it ach" + (have ? " got" : " locked"));
      const ic = el("span", "achi"); ic.append(iconImg(have ? "trophy" : "trophy", have ? "#ffd84a" : "#55524a"));
      const tx = el("div", "tx", a.name);
      tx.append(el("small", "", `${a.desc}${a.title ? ` · 칭호 「${a.title}」` : ""}${a.bonus ? ` (${a.bonus.map(([k, v]) => statText(k, v)).join(", ")})` : ""}`));
      row.append(ic, tx, el("em", "pts", `${a.pts}점`));
      list.append(row);
    }
  }
  box.append(list);
}

// ── the monster collection ──
const thumbs = new Map();
/** A monster's first frame shrunk into a 36-pixel square; unregistered ones are a dark silhouette. */
function mobThumb(k, lit) {
  const key = k + (lit ? "" : ":dark");
  if (thumbs.has(key)) return thumbs.get(key);
  const d = G.defs.mobs[k], c = document.createElement("canvas");
  c.width = c.height = 36;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  try {
    const img = SP.monsterSheet(d.sp || k, d.tint)[0];
    const s = Math.min(36 / img.width, 36 / img.height) * (img.width > 40 ? 1.1 : 1.15);
    const w = img.width * s, h = img.height * s;
    g.drawImage(img, (36 - w) / 2, 36 - h + (img.width > 40 ? 2 : 3), w, h);
    if (!lit) { g.globalCompositeOperation = "source-in"; g.fillStyle = "#3a3846"; g.fillRect(0, 0, 36, 36); }
  } catch { /* an unknown sprite simply stays blank */ }
  const url = c.toDataURL();
  thumbs.set(key, url);
  return url;
}
export function renderCollect(s) {
  const box = $("#collect-body");
  box.textContent = "";
  // two shelves: the monsters, and the keepsakes (기념품) stories gave (sidequests.js)
  const tabs = el("div", "tabs");
  for (const [k, name] of [["mob", "몬스터"], ["keep", `기념품 ${(s.keep || []).length}`]]) {
    const b = el("button", (G.colView || "mob") === k ? "on" : "", name);
    b.addEventListener("click", () => { G.colView = k; Sound.play("tab"); refreshUi(); });
    tabs.append(b);
  }
  box.append(tabs);
  if (G.colView === "keep") { SideQ.renderKeeps(box, s); return; }
  const col = G.defs.collection || {}, need = G.defs.colNeed || 30, maps = Object.fromEntries((G.defs.maps || []).map((m) => [m.id, m]));
  const regions = Object.keys(col);
  if (!G.colTab || !col[G.colTab]) G.colTab = regions[0];
  let total = 0, have = 0;
  for (const id of regions) for (const k of col[id].mobs) { total++; if ((s.mk[k] || 0) >= need) have++; }
  const head = el("div", "ach-top");
  head.append(iconImg("paw", "#e2c486"), el("span", "", `등록 ${have} / ${total}`), el("small", "", `완성 지역 ${(s.col || []).length} / ${regions.length}`));
  box.append(head);
  const picker = el("label", "col-region", "지역");
  const select = el("select");
  for (const id of regions) {
    const name = maps[id]?.name || id;
    const option = el("option", "", (s.col || []).includes(id) ? `${name} · 완성` : name);
    option.value = id;
    select.append(option);
  }
  select.value = G.colTab;
  select.addEventListener("change", () => { G.colTab = select.value; Sound.play("tab"); refreshUi(); });
  picker.append(select);
  box.append(picker);
  const reg = col[G.colTab], done = (s.col || []).includes(G.colTab);
  const bonus = el("div", "col-bonus" + (done ? " done" : ""));
  bonus.append(el("b", "", done ? "지역 완성 보너스 적용 중" : "지역을 모두 채우면"), el("span", "", reg.bonus.map(([k, v]) => statText(k, v)).join(", ")));
  box.append(bonus);
  const grid = el("div", "col-grid");
  for (const k of reg.mobs) {
    const d = G.defs.mobs[k], n = s.mk[k] || 0, ok = n >= need;
    const name = n ? d.name : "???";
    const cell = el("div", "col-cell" + (ok ? " ok" : ""));
    const im = el("img"); im.alt = ""; im.src = mobThumb(k, ok);
    const bar = el("div", "bar"), f = el("i"); f.style.width = `${clamp((n / need) * 100, 0, 100)}%`; bar.append(f);
    const progress = ok ? `Lv.${d.lv} · 등록됨` : `${n} / ${need}`;
    cell.append(im, el("b", "", name), el("small", "", d.optional ? `${progress} · 선택` : progress), bar);
    if (ok && d.lore) cell.append(el("p", "col-lore", d.lore));
    cell.title = `${name} — ${ok ? "등록됨" : `${need}마리를 잡으면 등록됩니다`} (처치 ${n})`;
    grid.append(cell);
  }
  box.append(grid);
  box.append(el("p", "hint", `같은 몬스터를 ${need}마리 잡으면 도감에 등록됩니다. 광장의 수집가에게서도 열 수 있습니다.`));
}

// ── first steps ──
export function tutTry(id) {
  const s = G.self, step = s && s.tut && G.defs.tutorial && G.defs.tutorial[s.tut.i];
  if (!step || step.id !== id) return;
  // two callers (opening the bag, the card's poll) can both fire before the snapshot moves on: send once, or the second earns an error toast
  if (tutTry.i === s.tut.i && Date.now() - tutTry.t < 3000) return;
  tutTry.i = s.tut.i; tutTry.t = Date.now();
  act({ t: "tut", s: id });
}
/** The first steps told for fingers: the server's hints name keyboard keys a phone does not have. */
const TUT_TOUCH = {
  talk: "광장 분수 앞의 관리자 엘더윈에게 걸어가, 아래에 뜨는 [▶ 관리자 엘더윈]을 누르세요. 첫 의뢰를 맡겨 줍니다.",
  equip: "수련관 카이에게 다가가 [▶ 수련관 카이]를 누르고 무기를 하나 받으세요. 받은 무기를 바로 손에 듭니다.",
  bag: "메뉴 → 가방을 열어 보세요.",
  buy: "보급상 리나에게 다가가 [▶ 보급상 리나]를 누르고 빨간 물약을 사 보세요.",
  hunt: "동쪽 문으로 나가 바람초원에서 쌍두 토끼를 잡으세요. [공격] 버튼으로 치고, [자동]을 켜면 알아서 사냥합니다.",
  rest: "모닥불 곁에서 메뉴 → 앉기를 눌러 잠시 쉬면 체력이 빨리 차고 경험치 보너스를 얻습니다.",
  skill: "든 무기의 첫 스킬은 숙련 1부터 단축칸 1번에 있습니다. 몬스터 곁에서 1번 칸을 눌러 써 보세요.",
  level: "모닥불 곁이나 수련관 카이 앞에서 메뉴 → 캐릭터 → 능력치를 한 칸 올려 보세요. 한 칸이 1레벨입니다.",
};
export function tutCard(s) {
  const card = $("#tut"), steps = G.defs.tutorial || [], i = s.tut ? s.tut.i : steps.length, step = steps[i];
  const hide = !step || +localStorage.getItem("lumentale:tuthide") === i + 1;
  // the bag already showing (the phone drawer's, or the desktop side panel's): nothing to press, so the step is done
  if (step && step.id === "bag" && !$("#w-inv").hidden && tutCard.bag !== i) { tutCard.bag = i; tutTry("bag"); }
  if (card.hidden !== hide) { card.hidden = hide; placeToasts(); }
  if (hide) return;
  setOnce($("#tut-title"), `${i}`, (n) => { n.append(step.title); const go = Track.button("tut", step.title); if (go) n.append(go); });
  $("#tut-n").textContent = `첫걸음 ${i + 1}/${steps.length}${step.need > 1 ? ` · ${s.tut.n}/${step.need}` : ""}`;
  const hint = (touch() && TUT_TOUCH[step.id]) || step.hint;
  if ($("#tut-hint").textContent !== hint) { $("#tut-hint").textContent = hint; placeToasts(); }
  if (card.dataset.i !== String(i)) { card.dataset.i = String(i); card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop"); if (i > 0) Sound.play("ok"); }
}

// ── the world event, the return scroll's cast bar, the arrival fade ──
export function eventWidget(t) {
  const e = G.evt, box = $("#evt");
  if (!e || !G.defs.maps) { if (!box.hidden) box.hidden = true; return; }
  const name = (id) => (G.defs.maps.find((m) => m.id === id) || {}).name || id;
  const live = e.phase === "on" || e.phase === "boss";
  let html;
  if (live) {
    html = [`<b>균열 침공 진행 중</b> · ${name(e.map)}`, `남은 ${clock(G.evtLeft - t)} · ${e.phase === "boss" ? "우두머리 출현!" : `웨이브 ${e.waves}/${(G.defs.event && G.defs.event.waves.length) || 3}`}`, e.mine ? `내 피해 ${e.mine.toLocaleString()}` : "피해를 주면 보상을 받습니다"];
  } else if (e.phase === "warn") html = [`<b>균열 침공 예고</b> · ${name(e.map)}`, `시작까지 ${clock(G.evtIn - t)}`];
  else html = [`다음 균열 침공 ${clock(G.evtNext - t)}`, name(e.nextMap)];
  if (e.top && e.top.length && (live || e.phase === "done")) html.push(e.top.map(([n, d], i) => `${i + 1}. ${n} ${d.toLocaleString()}`).join("  "));
  // folded to its first line on a click of the corner mark (kept per browser); folded by default until the first steps are done
  const fold = evtFolded();
  if (fold) html = html.slice(0, 1);
  const v = `<i class="fold" title="${fold ? "펼치기" : "접기"}">${fold ? "▸" : "▾"}</i>` + html.map((h) => `<span>${h}</span>`).join("");
  if (box.dataset.v !== v) { box.dataset.v = v; box.innerHTML = v; }
  const cls = "frame" + (live ? " live" : e.phase === "warn" ? " warn" : "");
  if (box.className !== cls) box.className = cls;
  box.hidden = false;
  document.body.classList.toggle("evt-live", live);
  if (G.evtPhase !== e.phase) {
    if (G.evtPhase !== undefined) {
      if (e.phase === "warn") { banner(`균열 침공 예고 · ${name(e.map)}`, true); Sound.play("rift_warn"); }
      else if (e.phase === "on") { banner(`균열 침공 시작! · ${name(e.map)}`, true); Sound.play("rift_start"); }
      else if (e.phase === "boss") { banner("균열의 우두머리 출현!", true); Sound.play("rift_boss"); }
      else if (e.phase === "done") banner("균열 침공 종료", true);
    }
    G.evtPhase = e.phase;
  }
}
/** Is the rift banner folded? The player's choice, else folded while the first steps are unfinished. */
function evtFolded() {
  const v = localStorage.getItem("lumentale:evtfold");
  if (v !== null) return v === "1";
  const s = G.self, n = (G.defs.tutorial || []).length;
  return !!(s && s.tut && s.tut.i < n);
}
export function castBar(t) {
  const c = G.cast, box = $("#cast");
  if (!c || t > c.end + 200) { if (!box.hidden) box.hidden = true; if (c && t > c.end + 200) G.cast = null; return; }
  // the recall scroll's cast, or a gathering channel (gather.js sets `name`)
  const name = c.name || "귀환 주문서";
  if (box.hidden || $("#cast-name").textContent !== name) { box.hidden = false; $("#cast-name").textContent = name; }
  box.classList.toggle("gat", !!c.gat);
  $("#cast-fill").style.width = `${clamp(((t - c.start) / (c.end - c.start)) * 100, 0, 100)}%`;
}
export function doorFade() {
  const f = $("#fade");
  f.hidden = true; f.classList.add("door"); void f.offsetWidth; f.hidden = false;
  setTimeout(() => { f.hidden = true; f.classList.remove("door"); }, 900);
}
export function fadeIn() {
  const f = $("#fade");
  f.hidden = true; void f.offsetWidth; f.hidden = false;
  setTimeout(() => { f.hidden = true; }, 700);
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupWinWorld() {
  $("#tut-x").addEventListener("click", () => { const s = G.self; if (s && s.tut) localStorage.setItem("lumentale:tuthide", String(s.tut.i + 1)); $("#tut").hidden = true; placeToasts(); Sound.play("ui"); });
  $("#evt").addEventListener("click", (ev) => {
    if (ev.target.closest(".fold")) { localStorage.setItem("lumentale:evtfold", evtFolded() ? "0" : "1"); delete $("#evt").dataset.v; Sound.play("ui"); return; }
    const e = G.evt, s = G.self;
    if (!e || !s) return;
    // the event gathers at one stone of its ground (the middle one, 중턱, on a big ground)
    const next = e.phase === "idle" || e.phase === "done", target = next ? e.nextMap : e.map, st = (next ? e.nextSt : e.st) | 0;
    if (wpWoke(s, target, st)) { G.warpPick = target; G.warpPickI = st; openWin("warp"); toast("이동의 돌 곁에서 균열 침공 지역으로 이동할 수 있습니다"); }
    else if (wpWoke(s, target)) { G.warpPick = target; G.warpPickI = 0; openWin("warp"); toast("침공이 모이는 이동의 돌을 아직 깨우지 않았습니다 — 입구 돌로 건너가 걸어가세요"); }
    else toast("그 지역의 이동의 돌을 아직 깨우지 않았습니다");
    Sound.play("ui");
  });
}
