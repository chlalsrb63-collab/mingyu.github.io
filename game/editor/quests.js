/**
 * The 퀘스트 tab: quests.json — the main chain ("기본 퀘스트 사용" or a replacement table)
 * and side quests (giver NPC, goal kill/collect/talk/visit, requirements, rewards, repeat).
 */
import { $, el, api, toast, dialog, confirmBox, DB, mobName, itemName, mobImg, itemImg, pickFrom, mobEntries, itemEntries, checkCtx, npcIcon, ROLE_KO } from "./ui.js";
import { checkQuests } from "./validate.js";

const Q = { f: null, saved: "", sel: -1, npcs: [], loaded: false };
let onDirty = () => {};
const DRAFT = "tt-editor-draft:quests";
export const dirty = () => Q.loaded && JSON.stringify(Q.f) !== Q.saved;

export async function load(force = false) {
  if (Q.loaded && !force) { Q.npcs = await api("/api/npcs/all").catch(() => Q.npcs); render(); return; }
  [Q.f, Q.npcs] = await Promise.all([api("/api/quests"), api("/api/npcs/all")]);
  Q.saved = JSON.stringify(Q.f);
  Q.loaded = true;
  Q.sel = Q.f.side.length ? 0 : -1;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DRAFT) || "null"); } catch { /* none */ }
  if (d && d.f && JSON.stringify(d.f) !== Q.saved) {
    if (await confirmBox("저장 안 된 퀘스트", `저장하지 않은 퀘스트 작업이 남아 있어요 (${new Date(d.t).toLocaleString("ko-KR")}). 불러올까요?`, "불러오기")) { Q.f = d.f; toast("불러왔어요. 잊지 말고 저장하세요!", "ok"); }
    else localStorage.removeItem(DRAFT);
  }
  render();
}
const change = () => { onDirty(); check(); try { localStorage.setItem(DRAFT, JSON.stringify({ t: Date.now(), f: Q.f })); } catch { /* full */ } };

function check() {
  const c = checkCtx();
  c.npcIds = Q.npcs.map((n) => n.id);
  c.mapIds = DB.maps.map((m) => m.id);
  const P = checkQuests(Q.f, c);
  const ul = $("#q-val");
  ul.textContent = "";
  const errs = P.filter((p) => p.level !== "warn").length;
  const b = $("#q-count");
  b.textContent = errs ? `오류 ${errs}` : P.length ? `주의 ${P.length}` : "좋아요";
  b.className = "badge " + (errs ? "bad" : P.length ? "mid" : "ok");
  if (!P.length) ul.append(el("li.okline", null, "문제 없어요!"));
  for (const p of P) ul.append(el("li." + (p.level === "warn" ? "warn" : "err"), { onclick: () => jump(p.path) }, p.msg));
  return P;
}
function jump(path) {
  const m = /^side\[(\d+)\]/.exec(path || "");
  if (m) { Q.sel = +m[1]; render(); }
  else if (/^main/.test(path || "")) mainTable();
}

function render() {
  if (!Q.f) return;
  const ul = $("#sq-list");
  ul.textContent = "";
  Q.f.side.forEach((q, i) => ul.append(el("li" + (i === Q.sel ? ".on" : ""), { onclick: () => { Q.sel = i; render(); } },
    el("span", null, q.title || "(제목 없음)"), q.repeat ? el("span.tag", null, "반복") : null, el("span.id", null, q.id))));
  if (!Q.f.side.length) ul.append(el("li.okline", null, "아직 사이드 퀘스트가 없어요"));
  for (const r of document.querySelectorAll("input[name=mainmode]")) r.checked = (r.value === "custom") === Array.isArray(Q.f.main);
  $("#main-edit").disabled = !Array.isArray(Q.f.main);
  form();
  check();
}

const npcLabel = (id) => { const n = Q.npcs.find((x) => x.id === id); return n ? `${n.name} (${n.mapName})` : id ? `${id} (없음!)` : "고르기…"; };
const npcPickerEntries = () => Q.npcs.map((n) => ({ key: n.id, label: n.name, sub: `${n.mapName} · ${ROLE_KO[n.role] || n.role}`, img: () => el("img", { src: npcIcon(n), style: "width:32px;height:32px" }) }));
const f2 = (label, input, tip) => [el("span", { title: tip || "" }, label), input];
const intIn = (v, min, max, on, tip) => el("input", { type: "number", value: v ?? "", min, max, title: tip || "", onchange: (e) => { const raw = e.target.value.trim(); const n = raw === "" ? null : Math.max(min, Math.min(max, Math.round(+raw))); e.target.value = n ?? ""; on(n); change(); } });

/** An item list editor: [[id, n], …]. */
function itemsEditor(list, onSet) {
  const box = el("div.items-ed");
  const draw = () => {
    box.textContent = "";
    list.forEach((it, i) => box.append(el("div.it", null, itemImg(it[0]), el("button.btn", { title: "아이템 바꾸기", onclick: async (e) => { const k = await pickFrom(e.currentTarget, "아이템 고르기", itemEntries(), it[0]); if (k) { it[0] = k; change(); draw(); } } }, itemName(it[0])),
      "×", intIn(it[1], 1, 999, (v) => { it[1] = v || 1; }, "개수"), el("button.btn.tiny.red", { title: "빼기", onclick: () => { list.splice(i, 1); onSet(list); change(); draw(); } }, "×"))));
    box.append(el("button.btn", { title: "보상 아이템 더하기", onclick: async (e) => { const k = await pickFrom(e.currentTarget, "아이템 고르기", itemEntries()); if (k) { list.push([k, 1]); onSet(list); change(); draw(); } } }, "+ 아이템"));
  };
  draw();
  return box;
}

function form() {
  const box = $("#q-form");
  box.textContent = "";
  const q = Q.f.side[Q.sel];
  if (!q) { box.append(el("h3.ttl", null, "사이드 퀘스트"), el("p.muted", null, "왼쪽에서 퀘스트를 고르거나 [새 퀘스트]를 누르세요."), help()); return; }
  q.goal = q.goal || { type: "kill", mob: null, n: 5 };
  q.req = q.req || { lv: 1, quest: null };
  q.reward = q.reward || { xp: 0, gold: 0, items: [] };
  q.reward.items = q.reward.items || [];
  const set = (f) => (e) => { f(e.target.value); change(); render(); };
  const giver = el("button.btn", { title: "이 퀘스트를 주는 NPC", onclick: async (e) => { const k = await pickFrom(e.currentTarget, "의뢰인 NPC 고르기", await npcPickerEntries(), q.giver); if (k) { q.giver = k; const n = Q.npcs.find((x) => x.id === k); if (n && n.role !== "quest") toast(`${n.name}의 역할이 '퀘스트 의뢰'가 아니에요. 맵/NPC 탭에서 역할을 바꿔야 퀘스트를 줘요.`, "bad"); change(); render(); } } }, npcLabel(q.giver));
  // goal
  const g = q.goal;
  const gType = el("select", { title: "무엇을 하면 끝나는지", onchange: (e) => { const t = e.target.value; q.goal = t === "kill" ? { type: t, mob: g.mob || null, n: g.n || 5 } : t === "collect" ? { type: t, item: g.item || null, n: g.n || 3 } : t === "talk" ? { type: t, npc: g.npc || null } : { type: t, map: g.map || null }; change(); render(); } },
    ...[["kill", "몬스터 잡기"], ["collect", "아이템 모으기"], ["talk", "NPC와 대화"], ["visit", "장소 찾아가기"]].map(([v, l]) => el("option", { value: v, selected: v === g.type }, l)));
  let goalIn;
  if (g.type === "kill") goalIn = el("span.row", { style: "margin:0" }, el("button.btn", { onclick: async (e) => { const k = await pickFrom(e.currentTarget, "몬스터 고르기", mobEntries(true), g.mob); if (k) { g.mob = k; change(); render(); } } }, g.mob ? mobImg(g.mob, 24) : null, " ", g.mob ? mobName(g.mob) : "몬스터 고르기…"), "×", intIn(g.n, 1, 999, (v) => { g.n = v || 1; }, "몇 마리"));
  else if (g.type === "collect") goalIn = el("span.row", { style: "margin:0" }, el("button.btn", { onclick: async (e) => { const k = await pickFrom(e.currentTarget, "아이템 고르기", itemEntries(), g.item); if (k) { g.item = k; change(); render(); } } }, g.item ? itemImg(g.item) : null, " ", g.item ? itemName(g.item) : "아이템 고르기…"), "×", intIn(g.n, 1, 999, (v) => { g.n = v || 1; }, "몇 개 (끝낼 때 가져가요)"));
  else if (g.type === "talk") goalIn = el("button.btn", { onclick: async (e) => { const k = await pickFrom(e.currentTarget, "말 걸 NPC 고르기", await npcPickerEntries(), g.npc); if (k) { g.npc = k; change(); render(); } } }, npcLabel(g.npc));
  else goalIn = el("select", { onchange: set((v) => { g.map = v; }) }, el("option", { value: "" }, "맵 고르기…"), ...DB.maps.map((m) => el("option", { value: m.id, selected: m.id === g.map }, `${m.name} (${m.id})`)));
  const others = Q.f.side.filter((x) => x !== q);
  box.append(el("h3.ttl", null, `사이드 퀘스트 — ${q.title || "(제목 없음)"}`), el("div.qgrid", null,
    ...f2("아이디", el("input", { type: "text", value: q.id, maxLength: 32, title: "영어 소문자·숫자·_ (자동으로 만들어져요)", onchange: set((v) => { q.id = v.trim(); }) })),
    ...f2("의뢰인 NPC", giver, "퀘스트를 주는 NPC (역할이 '퀘스트 의뢰'여야 해요)"),
    ...f2("제목", el("input", { type: "text", value: q.title || "", maxLength: 40, oninput: (e) => { q.title = e.target.value; change(); $("#sq-list li.on span").textContent = q.title || "(제목 없음)"; } })),
    ...f2("본문", el("textarea", { value: q.text || "", maxLength: 600, title: "NPC가 부탁하는 말", oninput: (e) => { q.text = e.target.value; change(); } })),
    ...f2("완료 대사", el("textarea", { value: q.done || "", maxLength: 400, title: "다 하고 돌아왔을 때 NPC가 하는 말", oninput: (e) => { q.done = e.target.value; change(); } })),
    el("h4.full", null, "목표"),
    ...f2("종류", gType), ...f2("내용", goalIn),
    el("h4.full", null, "조건"),
    ...f2("필요 레벨", intIn(q.req.lv, 1, 99, (v) => { q.req.lv = v; }, "이 레벨 이상이어야 받을 수 있어요")),
    ...f2("선행 퀘스트", el("select", { title: "이 퀘스트를 먼저 끝내야 받을 수 있어요", onchange: set((v) => { q.req.quest = v || null; }) }, el("option", { value: "" }, "없음"), ...others.map((o) => el("option", { value: o.id, selected: o.id === q.req.quest }, `${o.title} (${o.id})`)))),
    el("h4.full", null, "보상"),
    ...f2("경험치", intIn(q.reward.xp, 0, 10000000, (v) => { q.reward.xp = v || 0; })),
    ...f2("골드", intIn(q.reward.gold, 0, 10000000, (v) => { q.reward.gold = v || 0; })),
    ...f2("아이템", itemsEditor(q.reward.items, (l) => { q.reward.items = l; })),
    ...f2("반복", el("label.chk", { title: "끝낸 뒤 다시 받을 수 있어요" }, el("input", { type: "checkbox", checked: !!q.repeat, onchange: (e) => { q.repeat = e.target.checked; change(); render(); } }), "여러 번 할 수 있는 퀘스트"))));
}
function help() {
  return el("div.card", null, el("b", null, "사이드 퀘스트 만드는 순서"), el("ol", null,
    el("li", null, "맵 탭에서 NPC를 놓고 역할을 '퀘스트 의뢰'로 정해요 (저장!)."),
    el("li", null, "여기서 [새 퀘스트] → 의뢰인으로 그 NPC를 골라요."),
    el("li", null, "제목·본문·목표·보상을 적고 [퀘스트 저장]."),
    el("li", null, "빌드·테스트 탭에서 [빌드]하면 게임에 들어가요.")));
}

function newId() { const used = new Set(Q.f.side.map((q) => q.id)); for (let i = 1; ; i++) if (!used.has("sq_" + i)) return "sq_" + i; }
async function addQuest() {
  const giver = Q.npcs.find((n) => n.role === "quest") || null;
  Q.f.side.push({ id: newId(), giver: giver ? giver.id : null, title: "새 퀘스트", text: "", done: "고마워!", goal: { type: "kill", mob: null, n: 5 }, req: { lv: 1, quest: null }, reward: { xp: 100, gold: 50, items: [] }, repeat: false });
  Q.sel = Q.f.side.length - 1;
  change(); render();
}
async function delQuest() {
  const q = Q.f.side[Q.sel];
  if (!q) return;
  if (!(await confirmBox("퀘스트 지우기", `"${q.title}"을(를) 지울까요?`, "지우기", true))) return;
  Q.f.side.splice(Q.sel, 1);
  for (const o of Q.f.side) if (o.req && o.req.quest === q.id) o.req.quest = null;
  Q.sel = Math.min(Q.sel, Q.f.side.length - 1);
  change(); render();
}
export async function save() {
  try {
    const r = await api("/api/quests", { method: "PUT", body: Q.f });
    Q.saved = JSON.stringify(Q.f);
    localStorage.removeItem(DRAFT);
    onDirty();
    toast(r.warnings && r.warnings.length ? `저장했어요 (주의 ${r.warnings.length}개)` : "퀘스트를 저장했어요!", "ok");
    return true;
  } catch (e) { toast(e.message, "bad"); return false; }
}
export async function guard() {
  if (!dirty()) return true;
  const v = await dialog("저장하지 않은 퀘스트", "퀘스트에 저장하지 않은 변경이 있어요.", [["저장하고 계속", "save", "gold"], ["저장 안 하고 계속", "drop", "red"], ["취소", null]]);
  if (v === "save") return save();
  if (v === "drop") { localStorage.removeItem(DRAFT); Q.f = JSON.parse(Q.saved); render(); onDirty(); return true; }
  return false;
}

/** The main chain as a table (opened in a wide dialog). */
async function mainTable() {
  if (!Array.isArray(Q.f.main)) return;
  const rows = Q.f.main;
  const tb = el("tbody");
  const table = el("table.main", null, el("thead", null, el("tr", null, ...["#", "몬스터", "마리", "제목", "본문", "경험치", "골드", "아이템", ""].map((h) => el("th", null, h)))), tb);
  const draw = () => {
    tb.textContent = "";
    rows.forEach((q, i) => tb.append(el("tr", null,
      el("td", null, String(i + 1)),
      el("td", null, el("button.btn", { onclick: async (e) => { const k = await pickFrom(e.currentTarget, "몬스터 고르기", mobEntries(true), q.mob); if (k) { q.mob = k; change(); draw(); } } }, mobImg(q.mob, 24), " ", mobName(q.mob))),
      el("td", null, intIn(q.n, 1, 999, (v) => { q.n = v || 1; })),
      el("td", null, el("input", { type: "text", value: q.title, oninput: (e) => { q.title = e.target.value; change(); } })),
      el("td", { style: "min-width:220px" }, el("textarea", { value: q.text, oninput: (e) => { q.text = e.target.value; change(); } })),
      el("td", null, intIn(q.xp, 0, 1e7, (v) => { q.xp = v || 0; })),
      el("td", null, intIn(q.gold, 0, 1e7, (v) => { q.gold = v || 0; })),
      el("td", null, itemsEditor(q.items = q.items || [], (l) => { q.items = l; })),
      el("td", null, el("button.btn.tiny", { title: "위로", disabled: i === 0, onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; change(); draw(); } }, "▲"),
        el("button.btn.tiny.red", { title: "지우기", onclick: () => { rows.splice(i, 1); change(); draw(); } }, "×")))));
  };
  draw();
  const body = el("div", null, el("p.hint", null, "메인 퀘스트는 위에서부터 차례로 진행돼요. 각 줄: 어떤 몬스터를 몇 마리 잡는지와 보상."), el("div", { style: "max-height:62vh;overflow:auto" }, table),
    el("button.btn", { onclick: () => { rows.push({ mob: (mobEntries()[0] || {}).key, n: 5, title: "새 퀘스트", text: "", xp: 100, gold: 50, items: [] }); change(); draw(); } }, "+ 한 줄 더하기"));
  await dialog("메인 퀘스트 표", body, [["닫기", true, "gold"]], { wide: true });
  render();
}

export function init(opts) {
  onDirty = opts.onDirty || onDirty;
  $("#sq-new").onclick = addQuest;
  $("#sq-del").onclick = delQuest;
  $("#q-save").onclick = save;
  $("#main-edit").onclick = mainTable;
  for (const r of document.querySelectorAll("input[name=mainmode]")) r.onchange = async (e) => {
    if (e.target.value === "builtin") {
      if (Array.isArray(Q.f.main) && !(await confirmBox("기본 메인 퀘스트로", "직접 만든 메인 퀘스트 표를 버리고 게임에 원래 있는 메인 퀘스트를 쓸까요?", "기본으로", true))) { render(); return; }
      Q.f.main = null;
    } else {
      const v = await dialog("직접 만든 메인 퀘스트", "어디서 시작할까요?", [["기본 퀘스트를 복사해서", "copy", "gold"], ["빈 표에서", "empty"], ["취소", null]]);
      if (!v) { render(); return; }
      Q.f.main = v === "copy" ? JSON.parse(JSON.stringify(DB.defs.mainQuests || DB.defs.quests || [])).map((q) => ({ mob: q.mob, n: q.n, title: q.title, text: q.text, xp: q.xp, gold: q.gold, items: q.items || [] })) : [];
      if (v === "empty") Q.f.main.push({ mob: (mobEntries()[0] || {}).key, n: 5, title: "첫 퀘스트", text: "", xp: 100, gold: 50, items: [] });
    }
    change(); render();
    if (Array.isArray(Q.f.main)) mainTable();
  };
}
export const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { if (e.target && e.target.blur) e.target.blur(); save(); return true; } return false; };
