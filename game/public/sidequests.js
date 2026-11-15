/**
 * Side quests from the world map editor (data/quests.json "side"): the quest part of the
 * talk window, the side-quest entries in the quest window (L), and the "!"/"?" over the
 * heads of the NPCs who give them (or take a delivery). The server decides everything; this
 * only draws `self.sq` ([id, state, have, need, deadline?] — state 0 locked · 1 can take ·
 * 2 under way · 3 ready to hand in · 4 finished) against `defs.side`, and asks with {t:"sq"}.
 * A quest that ends on a choice shows its answers as buttons (F = the first, 1–3 pick one).
 */
import * as Track from "./track.js";
import { serverNow } from "./sky.js";

let C = null;
/** ctx: { G, act, el, Sound } */
export function init(ctx) { C = ctx; }

const side = () => (C && C.G.defs && C.G.defs.side) || [];
const byId = (id) => side().find((o) => o.id === id);
// built once per self.sq (a snapshot replaces the array, never edits it): mark() asks for every NPC every frame
let stSq, stMap;
const states = (s) => {
  const sq = (s && s.sq) || null;
  if (sq !== stSq || !stMap) { stSq = sq; stMap = new Map((sq || []).map(([id, st, n, need, t]) => [id, { st, n, need, t }])); }
  return stMap;
};
const turnIn = (q) => q.turnIn || q.giver;

export function goalText(q) {
  const g = q.goal;
  return g.type === "kill" || g.type === "elite" || g.type === "fb" ? `${q.target} ${g.n}마리 처치` : g.type === "collect" ? `${q.target} ${g.n}개 모아 오기`
    : g.type === "make" ? `${q.target} ${g.n}개 만들기` : g.type === "deliver" ? `${q.target}${g.n > 1 ? ` ${g.n}개` : ""} → ${q.turnInName}에게 전하기`
      : g.type === "talk" ? `${q.target}에게 말 걸기` : g.type === "choice" ? `${q.target}에게 대답하기` : `[${q.target}]에 가 보기`;
}
function rewardText(r) {
  const items = C.G.defs.items, out = [];
  if (r.xp) out.push(`EXP ${r.xp.toLocaleString()}`);
  if (r.gold) out.push(`${r.gold.toLocaleString()}G`);
  for (const [id, n] of r.items) out.push(`${items[id] ? items[id].name : id} ×${n}`);
  if (r.keep) out.push(`기념품 「${items[r.keep]?.name || r.keep}」`);
  if (r.title) out.push(`칭호 「${r.title}」`);
  return out.length ? `보상: ${out.join(" · ")}` : "보상 없음";
}
// a choice may pay differently: say so instead of guessing which
const rewardOf = (q) => (q.choice && q.choice.some((o) => o.reward) ? "보상: 대답에 따라 달라집니다" : rewardText(q.reward));
// a timed delivery's clock (kept fresh by the ticker below)
function clock(t) {
  const left = t - serverNow();
  return left <= 0 ? "제한 시간 초과 — 포기하고 다시 받으세요" : `남은 시간 ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
}
setInterval(() => { for (const e of document.querySelectorAll(".sq-time[data-t]")) e.textContent = clock(+e.dataset.t); }, 1000);
function goalRow(q, st) {
  const { el } = C;
  const row = el("div", "q-goal"), bar = el("div", "bar"), f = el("i");
  f.style.width = `${Math.min(100, (st.n / st.need) * 100)}%`;
  bar.append(f);
  row.append(el("span", "", goalText(q)), bar, el("b", "", `${Math.min(st.n, st.need)} / ${st.need}`));
  return row;
}
/** What else the card says while a quest is under way: the parcel in the bag, the clock, the hint. */
function extras(box, q, v) {
  const { el } = C;
  if (q.goal.type === "deliver" && v.st >= 2) box.append(el("p", "sq-qitem", `퀘스트 아이템: ${q.target}${v.n >= v.need ? " (가방에 있음)" : " (가방에 없음 — 포기 후 다시 받으세요)"}`));
  if (v.t) { const t = el("p", "sq-time", clock(v.t)); t.dataset.t = v.t; box.append(t); }
  if (q.hint && v.st >= 1 && v.st <= 3) box.append(el("p", "ds", `도움말: ${q.hint}`));
}
/** The steps of the story this quest belongs to (quests chained by req.quest / req.flag), when there is more than one. */
function steps(det, q, st) {
  const { el } = C;
  const chain = [q];
  for (let o = q, i = 0; i < 20; i++) { o = byId(o.req.quest || (o.req.flag && o.req.flag[0])); if (!o) break; chain.unshift(o); }
  if (chain.length < 2) return;
  const ol = el("ol", "sq-steps");
  for (const o of chain) {
    const v = st.get(o.id);
    ol.append(el("li", o === q ? "now" : v && v.st === 4 ? "past" : "", `${o === q ? "▶ " : v && v.st === 4 ? "✓ " : ""}${o.title}`));
  }
  det.append(el("div", "section", "이야기 순서"), ol);
}

/** "?" when a quest is ready to hand in to this NPC, "!" when one can be taken, else "". */
export function mark(npc, s) {
  if (!s) return "";
  const st = states(s);
  let m = "";
  for (const q of side()) {
    if (q.giver !== npc.id && turnIn(q) !== npc.id) continue;
    const v = st.get(q.id);
    if (!v) continue;
    if (v.st === 3 && turnIn(q) === npc.id) return "?";
    if (v.st === 1 && q.giver === npc.id) m = "!";
  }
  return m;
}

/** Talking to someone counts for every quest under way that asks you to talk to them. */
export function onTalk(npc, s) {
  if (!s || !npc || !npc.id) return;
  const st = states(s);
  if (side().some((q) => q.goal.type === "talk" && q.goal.npc === npc.id && st.get(q.id) && st.get(q.id).st === 2)) C.act({ t: "sq", a: "talk", npc: npc.id });
}

/** Does this NPC have side quests to show (to open the talk window for a service NPC too)? */
export const gives = (npc) => side().some((q) => q.giver === npc.id || turnIn(q) === npc.id);

// 1–3 answer a choice while the talk window shows one (input.js has the number keys for the quick slots)
addEventListener("keydown", (e) => {
  const i = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
  const w = document.getElementById("w-talk");
  if (i < 0 || e.repeat || !w || w.hidden) return;
  const b = w.querySelectorAll(".sq-choice .btn")[i];
  if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  b.click();
}, true);

/** The talk window's quest cards for `npc`: what can be taken, what is under way, what is done, what is brought here. */
export function renderTalk(box, npc, s, say) {
  const { el, act, Sound } = C;
  if (!box) return;   // the talk window opened without a conversation (no quest box yet)
  box.textContent = "";
  if (!npc || !s) return;
  const st = states(s);
  // a delivery shows at its recipient only once it is under way
  const mine = side().filter((q) => q.giver === npc.id || (turnIn(q) === npc.id && (st.get(q.id)?.st | 0) >= 2 && (st.get(q.id)?.st | 0) <= 3));
  if (!mine.length) return;
  box.append(el("div", "section", mine.some((q) => q.mainChapter) ? "주요 의뢰" : "퀘스트"));
  let shown = 0;
  for (const q of mine) {
    const v = st.get(q.id);
    if (!v) continue;
    if (v.st === 0 && q.req.flag) continue;   // a branch stays a surprise until its answer is given
    if (v.st === 0) {
      const pre = byId(q.req.quest || (q.req.flag && q.req.flag[0]));
      box.append(el("p", "ds", `잠김 · ${q.title} — ${s.lvl < q.req.lv ? `레벨 ${q.req.lv} 이상` : q.req.main ? "앞선 주요 의뢰 완료 후" : `[${pre ? pre.title : "?"}] 완료 후`}`));
      continue;
    }
    shown++;
    const here = turnIn(q) === npc.id, away = !here && v.st >= 2;   // handed in somewhere else
    const card = el("div", `sq-card st${v.st}`);
    card.append(el("div", "q-title", `${q.title}${q.repeat ? " (반복)" : ""}`));
    if (v.st === 4) { card.append(el("p", "ds", "완료한 퀘스트입니다.")); box.append(card); continue; }
    card.append(el("p", "say", here && v.st === 3 && q.giver !== npc.id ? `${q.giverName}의 부탁으로 왔다.` : q.text));
    if (v.st === 1) card.append(el("div", "q-goal", `목표: ${goalText(q)}`));
    else card.append(goalRow(q, v));
    extras(card, q, v);
    card.append(el("div", "q-reward", rewardOf(q)));
    const btns = el("div", "btns");
    if (v.st === 3 && here && q.choice) {
      // the answers: each its own gold button, the first is what F presses
      const pick = el("div", "sq-choice");
      q.choice.forEach((o, i) => {
        const b = el("button", "btn gold", `${i + 1}. ${o.label}`);
        if (o.reward) b.title = rewardText(o.reward);
        b.addEventListener("click", () => { act({ t: "sq", a: "done", id: q.id, pick: i }); if (say && (o.done || q.done)) say(o.done || q.done); Sound.play("quest"); });
        pick.append(b);
      });
      card.append(pick);
    } else if (!away) {
      const b = el("button", "btn gold", v.st === 1 ? "수락" : "완료");
      b.disabled = v.st === 2;
      b.addEventListener("click", () => {
        act({ t: "sq", a: v.st === 1 ? "take" : "done", id: q.id });
        if (v.st === 3 && q.done && say) say(q.done);
        Sound.play("quest");
      });
      btns.append(b);
    }
    if (v.st === 2 || away) btns.append(el("span", "ds", away ? `${q.turnInName}에게 가져가세요` : "진행 중"));
    const go = (v.st === 2 || away) && Track.button(`sq:${q.id}`, q.title);   // under way: walk to its goal (track.js)
    if (go) btns.append(go);
    card.append(btns);
    box.append(card);
  }
  if (!shown && !box.querySelector(".ds")) box.append(el("p", "ds", "지금은 부탁할 일이 없다네."));
}

/** Entries for the quest window's list: the side quests under way (and ready to hand in). */
export function listEntries(s, entry, group, chapters = false) {
  const st = states(s);
  const on = side().filter((q) => {
    const state = st.get(q.id)?.st || 0;
    return chapters ? q.mainChapter && state >= 1 : !q.mainChapter && (state === 2 || state === 3);
  });
  if (!on.length) return;
  if (!chapters) group("사이드 퀘스트");
  for (const q of on) {
    const v = st.get(q.id);
    const sub = v.st === 1 ? "새 의뢰" : v.st === 3 ? (q.goal.type === "deliver" ? "전하러 가기" : q.choice ? "대답하기" : "완료!") : v.st === 4 ? "완료" : `${Math.min(v.n, v.need)}/${v.need}`;
    entry(`sq:${q.id}`, q.title, sub, v.st === 3 ? "done" : v.st === 4 ? "past" : "");
  }
}
/** The quest window's detail for a side quest. */
export function detail(det, id, s) {
  const { el, act, Sound } = C;
  const q = byId(id), st = states(s), v = st.get(id);
  if (!q || !v) return;
  if (q.mainChapter && v.st === 4) {
    det.append(el("div", "q-title", q.title), el("p", "say", q.done), el("p", "ds", "완료한 주요 의뢰입니다."));
    return;
  }
  det.append(el("div", "q-title", q.title), el("p", "say", q.text), goalRow(q, v));
  extras(det, q, v);
  det.append(el("div", "q-reward", rewardOf(q)));
  steps(det, q, st);
  det.append(el("p", "ds", v.st === 3 ? `${q.turnInMap}의 ${q.turnInName}에게 ${turnIn(q) === q.giver ? "돌아가 " : "가서 "}${q.choice ? "대답하세요" : "완료하세요"}.`
    : q.mainChapter && q.goal.type === "kill" && v.st === 2 ? `${q.giverMap}에서 승선장을 찾아 구조에 나서세요.`
    : `의뢰인: ${q.giverName} (${q.giverMap})`));
  const action = q.mainChapter && v.st === 1 ? "take" : q.mainChapter && v.st === 3 ? "done" : "drop";
  const btns = el("div", "btns"), b = el("button", action === "drop" ? "btn" : "btn gold", { take: "수락", done: "완료", drop: "포기" }[action]);
  if (action !== "drop") b.disabled = C.G.near?.id !== q.giver;
  b.addEventListener("click", () => { act({ t: "sq", a: action, id }); Sound.play("ui"); });
  btns.append(b);
  det.append(btns);
}

/** The 도감's 기념품 tab: every keepsake kept, with the story it came from. */
export function renderKeeps(box, s) {
  const { el } = C;
  const items = C.G.defs.items, keep = (s && s.keep) || [];
  const all = Object.keys(items).filter((id) => items[id].type === "keep");
  box.append(el("p", "hint", `기념품 ${keep.length} / ${all.length} · 이야기를 마치면 받는 물건입니다. 능력치는 없고, 언젠가 루루 의상실에서 옷으로 지을 수 있습니다.`));
  const list = el("div", "keep-list");
  for (const id of all) {
    const d = items[id], got = keep.includes(id);
    const row = el("div", "keep-row" + (got ? " ok" : ""));
    const url = got && C.G.icons?.url[id];
    if (url) { const img = el("img", "ic"); img.src = url; img.alt = ""; row.append(img); }
    row.append(el("b", "", got ? d.name : "???"), el("small", "", d.arc ? `「${d.arc}」` : ""), el("p", "col-lore", got ? d.desc : "아직 만나지 못한 이야기."));
    list.append(row);
  }
  box.append(list);
}
