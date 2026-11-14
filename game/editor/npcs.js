/**
 * The NPC·대사 tab: every NPC in one list (hand-made maps, npcs.json, generated maps),
 * edit name / role / look / lines and save back to where it lives, jump to it on the map.
 */
import { $, el, api, toast, dialog, confirmBox, DB, npcIcon, checkCtx } from "./ui.js";
import { checkNpcs } from "./validate.js";
import * as ME from "./mapedit.js";

const N = { list: [], sel: null, work: null, orig: "", srcMap: null };
let goMap = async () => {};
export const dirty = () => !!N.work && JSON.stringify(N.work) !== N.orig;
const keyOf = (n) => `${n.source}:${n.map}:${n.id}`;

export async function load() {
  N.list = await api("/api/npcs/all");
  if (N.sel && !N.list.some((n) => keyOf(n) === N.sel)) { N.sel = null; N.work = null; }
  renderList();
  renderForm();
}
function renderList() {
  const ul = $("#npc-list"), q = $("#npc-search").value.trim().toLowerCase();
  ul.textContent = "";
  for (const n of N.list) {
    if (q && !`${n.name} ${n.mapName} ${n.id} ${(n.lines || []).join(" ")}`.toLowerCase().includes(q)) continue;
    const tag = n.source === "builtin" ? el("span.tag.base", { title: "게임에 원래 있는 NPC (볼 수만 있어요)" }, "기본") : n.source === "npcs.json" ? el("span.tag", { title: "기본 맵에 더한 NPC (npcs.json)" }, "추가") : el("span.tag.own", { title: "직접 만든 맵의 NPC" }, "맵");
    ul.append(el("li" + (keyOf(n) === N.sel ? ".on" : ""), { title: `${n.name} — ${n.mapName} (${n.x}, ${n.y})`, onclick: () => select(n) },
      el("img", { src: npcIcon(n) }), el("span", null, n.name), tag, el("span.id", null, n.mapName)));
  }
  if (!ul.children.length) ul.append(el("li.okline", null, "NPC가 없어요"));
}
async function select(n) {
  if (dirty() && !(await confirmBox("저장하지 않은 대사", `"${N.work.name}"의 변경을 버리고 다른 NPC를 볼까요?`, "버리기", true))) return;
  N.sel = keyOf(n);
  N.work = JSON.parse(JSON.stringify({ id: n.id, name: n.name, role: n.role, x: n.x, y: n.y, look: n.look, lines: n.lines || [] }));
  N.orig = JSON.stringify(N.work);
  renderList();
  renderForm();
}
function current() { return N.list.find((n) => keyOf(n) === N.sel); }
function renderForm() {
  const box = $("#npc-form");
  box.textContent = "";
  const n = current();
  if (!n || !N.work) {
    box.append(el("h3.ttl", null, "NPC·대사"), el("p.muted", null, "왼쪽에서 NPC를 고르세요. 대사를 고치고 [저장]을 누르면 바로 파일에 들어가요."),
      el("div.card", null, el("b", null, "NPC가 사는 곳"), el("ul", null,
        el("li", null, el("b", null, "맵"), " — 직접 만든 맵의 NPC (data/maps/<맵>.json)"),
        el("li", null, el("b", null, "추가"), " — 원래 있는 맵(광장 등)에 더한 NPC (data/npcs.json)"),
        el("li", null, el("b", null, "기본"), " — 게임에 처음부터 있는 NPC. 볼 수만 있어요."))));
    return;
  }
  const ro = n.source === "builtin";
  const where = el("div.row", null, el("span.lab", null, `${n.mapName} (${n.map}) · ${n.x}, ${n.y}`), el("button.btn", { title: "맵 탭에서 이 NPC가 있는 곳을 보여 줘요", onclick: () => goMap(n.map, n) }, "맵에서 보기"));
  box.append(el("h3.ttl", null, `${n.name}`), ME.npcForm(N.work, ro, () => { const b = $("#npc-save"); if (b) b.disabled = !dirty(); }, ro ? null : () => removeNpc(n), { nameId: "npc-tab-name", where }));
  if (ro) box.append(el("p.hint", null, "기본 NPC는 여기서 바꿀 수 없어요. 맵 탭에서 그 맵을 [이 맵 직접 고치기]로 바꾸면 고칠 수 있어요."));
  else box.append(el("div.row", null, el("button#npc-save.btn.gold", { disabled: !dirty(), onclick: () => save(), title: "이 NPC를 저장해요 (Ctrl+S)" }, "저장")));
}
/** Write the edited NPC back into its file. */
export async function save() {
  const n = current();
  if (!n || !dirty()) return true;
  const w = N.work;
  try {
    if (n.source === "npcs.json") {
      const f = await api("/api/npcs");
      const i = f.npcs.findIndex((x) => x.id === n.id && x.map === n.map);
      if (i < 0) throw new Error("npcs.json에서 이 NPC를 찾지 못했어요.");
      f.npcs[i] = { map: n.map, ...w };
      const P = checkNpcs(f, checkCtx()).filter((p) => p.level !== "warn");
      if (P.length) throw new Error(P[0].msg);
      await api("/api/npcs", { method: "PUT", body: f });
    } else {
      const open = ME.current();
      if (open.id === n.map && ME.dirty().any) throw new Error(`맵 탭에서 "${open.m.name}"을(를) 고치는 중이에요. 그쪽을 먼저 저장하세요.`);
      const m = await api("/api/map/" + n.map);
      const i = m.npcs.findIndex((x) => x.id === n.id);
      if (i < 0) throw new Error("맵 파일에서 이 NPC를 찾지 못했어요.");
      m.npcs[i] = w;
      await api("/api/map/" + n.map, { method: "PUT", body: m });
      ME.forgetMap(n.map);
      if (open.id === n.map) await ME.openMap(n.map, { skipDraft: true });
    }
    N.orig = JSON.stringify(w);
    toast("저장했어요!", "ok");
    N.sel = `${n.source}:${n.map}:${w.id}`;
    await load();
    return true;
  } catch (e) { toast(e.message, "bad"); return false; }
}
async function removeNpc(n) {
  try {
    if (n.source === "npcs.json") {
      const f = await api("/api/npcs");
      f.npcs = f.npcs.filter((x) => !(x.id === n.id && x.map === n.map));
      await api("/api/npcs", { method: "PUT", body: f });
    } else {
      const open = ME.current();
      if (open.id === n.map && ME.dirty().any) throw new Error("맵 탭에서 그 맵을 먼저 저장하세요.");
      const m = await api("/api/map/" + n.map);
      m.npcs = m.npcs.filter((x) => x.id !== n.id);
      await api("/api/map/" + n.map, { method: "PUT", body: m });
      if (open.id === n.map) await ME.openMap(n.map, { skipDraft: true });
    }
    N.sel = null; N.work = null;
    toast("지웠어요.", "ok");
    await load();
  } catch (e) { toast(e.message, "bad"); }
}
export async function guard() {
  if (!dirty()) return true;
  if (await confirmBox("저장하지 않은 대사", `"${N.work.name}"을(를) 저장할까요?`, "저장")) return save();
  N.work = JSON.parse(N.orig); renderForm();
  return true;
}
export function init(opts) {
  goMap = opts.goMap;
  $("#npc-search").addEventListener("input", renderList);
  $("#npc-add").onclick = async () => {
    const built = DB.maps.filter((m) => m.builtin && !m.custom);
    if (!built.length) return toast("기본 맵이 없어요.");
    const sel = el("select.inp", null, ...built.map((m) => el("option", { value: m.id }, `${m.name} (${m.id})`)));
    const v = await dialog("기본 맵에 NPC 추가", el("div", null, el("p", null, "어느 맵에 놓을까요? 맵 탭이 열리면 NPC를 놓을 칸을 누르세요."), sel), [["맵 열기", () => sel.value, "gold"], ["취소", null]]);
    if (v) goMap(v, null, true);
  };
}
export const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { save(); return true; } return false; };
