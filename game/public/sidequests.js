/**
 * Side quests from the world map editor (data/quests.json "side"): the quest part of the
 * talk window, the side-quest entries in the quest window (L), and the "!"/"?" over the
 * heads of the NPCs who give them. The server decides everything; this only draws
 * `self.sq` ([id, state, have, need] — state 0 locked · 1 can take · 2 under way ·
 * 3 ready to hand in · 4 finished) against `defs.side`, and asks with {t:"sq"}.
 */
let C = null;
/** ctx: { G, act, el, Sound } */
export function init(ctx) { C = ctx; }

const side = () => (C && C.G.defs && C.G.defs.side) || [];
const states = (s) => new Map(((s && s.sq) || []).map(([id, st, n, need]) => [id, { st, n, need }]));

export function goalText(q) {
  const g = q.goal;
  return g.type === "kill" ? `${q.target} ${g.n}마리 처치` : g.type === "collect" ? `${q.target} ${g.n}개 모아 오기`
    : g.type === "talk" ? `${q.target}에게 말 걸기` : `[${q.target}]에 가 보기`;
}
function rewardText(q) {
  const items = C.G.defs.items, r = q.reward, out = [];
  if (r.xp) out.push(`EXP ${r.xp.toLocaleString()}`);
  if (r.gold) out.push(`${r.gold.toLocaleString()}G`);
  for (const [id, n] of r.items) out.push(`${items[id] ? items[id].name : id} ×${n}`);
  return out.length ? `보상: ${out.join(" · ")}` : "보상 없음";
}
function goalRow(q, st) {
  const { el } = C;
  const row = el("div", "q-goal"), bar = el("div", "bar"), f = el("i");
  f.style.width = `${Math.min(100, (st.n / st.need) * 100)}%`;
  bar.append(f);
  row.append(el("span", "", goalText(q)), bar, el("b", "", `${Math.min(st.n, st.need)} / ${st.need}`));
  return row;
}

/** "?" when a quest is ready to hand in to this NPC, "!" when one can be taken, else "". */
export function mark(npc, s) {
  if (!s) return "";
  const st = states(s);
  let m = "";
  for (const q of side()) {
    if (q.giver !== npc.id) continue;
    const v = st.get(q.id);
    if (!v) continue;
    if (v.st === 3) return "?";
    if (v.st === 1) m = "!";
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
export const gives = (npc) => side().some((q) => q.giver === npc.id);

/** The talk window's quest cards for `npc`: what can be taken, what is under way, what is done. */
export function renderTalk(box, npc, s, say) {
  const { el, act, Sound } = C;
  box.textContent = "";
  if (!npc || !s) return;
  const st = states(s);
  const mine = side().filter((q) => q.giver === npc.id);
  if (!mine.length) return;
  box.append(el("div", "section", "퀘스트"));
  let shown = 0;
  for (const q of mine) {
    const v = st.get(q.id);
    if (!v) continue;
    if (v.st === 0) {
      const lock = q.req.quest ? (side().find((o) => o.id === q.req.quest) || {}).title : null;
      box.append(el("p", "ds", `잠김 · ${q.title} — ${s.lvl < q.req.lv ? `레벨 ${q.req.lv} 이상` : `[${lock}] 완료 후`}`));
      continue;
    }
    shown++;
    const card = el("div", `sq-card st${v.st}`);
    card.append(el("div", "q-title", `${q.title}${q.repeat ? " (반복)" : ""}`));
    if (v.st === 4) { card.append(el("p", "ds", "완료한 퀘스트입니다.")); box.append(card); continue; }
    card.append(el("p", "say", q.text));
    if (v.st === 1) card.append(el("div", "q-goal", `목표: ${goalText(q)}`));
    else card.append(goalRow(q, v));
    card.append(el("div", "q-reward", rewardText(q)));
    const btns = el("div", "btns");
    const b = el("button", "btn gold", v.st === 1 ? "수락" : "완료");
    b.disabled = v.st === 2;
    b.addEventListener("click", () => {
      act({ t: "sq", a: v.st === 1 ? "take" : "done", id: q.id });
      if (v.st === 3 && q.done && say) say(q.done);
      Sound.play("quest");
    });
    btns.append(b);
    if (v.st === 2) btns.append(el("span", "ds", "진행 중"));
    card.append(btns);
    box.append(card);
  }
  if (!shown && !box.querySelector(".ds")) box.append(el("p", "ds", "지금은 부탁할 일이 없다네."));
}

/** Entries for the quest window's list: the side quests under way (and ready to hand in). */
export function listEntries(s, entry, group) {
  const st = states(s);
  const on = side().filter((q) => st.get(q.id) && st.get(q.id).st >= 2 && st.get(q.id).st <= 3);
  if (!on.length) return;
  group("사이드 퀘스트");
  for (const q of on) {
    const v = st.get(q.id);
    entry(`sq:${q.id}`, q.title, v.st === 3 ? "완료!" : `${Math.min(v.n, v.need)}/${v.need}`, v.st === 3 ? "done" : "");
  }
}
/** The quest window's detail for a side quest. */
export function detail(det, id, s) {
  const { el, act, Sound } = C;
  const q = side().find((o) => o.id === id), v = states(s).get(id);
  if (!q || !v) return;
  det.append(el("div", "q-title", q.title), el("p", "say", q.text), goalRow(q, v), el("div", "q-reward", rewardText(q)));
  det.append(el("p", "ds", v.st === 3 ? `${q.giverMap}의 ${q.giverName}에게 돌아가 완료하세요.` : `의뢰인: ${q.giverName} (${q.giverMap})`));
  const btns = el("div", "btns"), b = el("button", "btn", "포기");
  b.addEventListener("click", () => { act({ t: "sq", a: "drop", id }); Sound.play("ui"); });
  btns.append(b);
  det.append(btns);
}
