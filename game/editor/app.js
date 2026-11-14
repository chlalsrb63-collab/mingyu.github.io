/**
 * 테일즈테일즈 월드맵에디터 — the page: tabs, keys, the save-state badge, the
 * "처음 사용하기" help, and the guard against leaving with unsaved work.
 * Tabs: mapedit.js (맵), quests.js (퀘스트), npcs.js (NPC·대사), assets.js (에셋), build.js (빌드·테스트).
 */
import { installFrames } from "/public/frames.js";
import { $, $$, el, toast, dialog, loadTables, DB, icon } from "./ui.js";
import * as ME from "./mapedit.js";
import * as QS from "./quests.js";
import * as NP from "./npcs.js";
import * as AS from "./assets.js";
import * as BD from "./build.js";

installFrames();
let tab = "map";

function updateState() {
  const d = ME.dirty(), q = QS.dirty(), n = NP.dirty();
  const parts = [];
  if (d.any) parts.push("맵");
  if (q) parts.push("퀘스트");
  if (n) parts.push("NPC");
  const s = $("#state");
  s.textContent = parts.length ? `● 저장 안 됨: ${parts.join(", ")}` : DB.status && DB.status.lib === "fallback" ? "모두 저장됨 · 임시 팔레트" : "모두 저장됨";
  s.title = DB.status && DB.status.lib === "fallback" ? "게임 쪽 editor-lib.mjs가 아직 없어서 에디터의 임시 팔레트를 쓰고 있어요." : "저장 상태";
  s.classList.toggle("dirty", parts.length > 0);
}
async function showTab(t) {
  if (t === tab) return;
  tab = t;
  for (const b of $$("#tabs button")) b.classList.toggle("on", b.dataset.tab === t);
  for (const s of $$(".tab")) s.hidden = s.id !== "tab-" + t;
  try {
    if (t === "quest") await QS.load();
    if (t === "npc") await NP.load();
    if (t === "asset") await AS.load();
    if (t === "map") ME.draw();
  } catch (e) { toast(e.message, "bad"); }
}
/** Open a map in the map tab, optionally focusing an NPC or a tile. */
async function goMap(id, focus, addNpc) {
  await showTab("map");
  if (ME.current().id !== id) {
    if (!(await ME.guard())) return;
    await ME.openMap(id);
    ME.renderMapList();
  }
  if (addNpc) { ME.setLayer("npcs"); toast("NPC를 놓을 칸을 누르세요.", "ok"); return; }
  if (focus && focus.x != null) {
    if (focus.id) ME.setLayer("npcs");
    ME.jumpTo(focus.x, focus.y);
  }
}

function helpBody() {
  return el("div", null,
    el("p", null, "테일즈테일즈의 맵·NPC·퀘스트를 직접 만드는 도구예요. 고친 것은 ", el("b", null, "game/data"), " 폴더에 저장되고, ", el("b", null, "빌드"), "하면 게임에 들어가요."),
    el("ol", null,
      el("li", null, el("b", null, "맵 탭 → [새 맵]"), ": 이름·아이디·테마를 정해요."),
      el("li", null, el("b", null, "바닥(1)·물체(2)"), "를 고르고 오른쪽 팔레트에서 골라 붓으로 칠해요. 마우스 휠로 확대, 오른쪽 버튼(또는 Space)을 누른 채 끌면 화면 이동."),
      el("li", null, el("b", null, "몬스터 구역(3)"), ": 맵을 끌어 네모를 만들고 오른쪽에서 몬스터·마리 수를 골라요."),
      el("li", null, el("b", null, "NPC(4)"), ": 칸을 눌러 놓고 이름·모습·대사를 적어요. 퀘스트를 줄 NPC는 역할을 '퀘스트 의뢰'로."),
      el("li", null, el("b", null, "문(5)"), ": 칸을 눌러 문을 놓고 갈 맵과 도착 위치(작은 지도를 클릭)를 골라요. 광장 같은 기본 맵에도 문을 놓을 수 있어요."),
      el("li", null, el("b", null, "입구(8)"), "와 ", el("b", null, "이동의 돌(7)"), " 자리를 정하고, 오른쪽 아래 ", el("b", null, "검사"), " 목록에 빨간 ✗가 없는지 봐요 (누르면 그곳으로 가요)."),
      el("li", null, el("b", null, "저장"), "(Ctrl+S) → ", el("b", null, "게임에서 테스트"), "를 누르면 게임이 켜지고 그 맵에서 시작해요."),
      el("li", null, el("b", null, "빌드·테스트 탭 → [빌드]"), ": 다 만들었으면 게임에 반영하고 빠른 테스트를 돌려요.")),
    el("p", null, "단축키: ", el("kbd", null, "Ctrl+Z"), " 되돌리기 · ", el("kbd", null, "Ctrl+Y"), " 다시 · ", el("kbd", null, "1~9"), " 층 · ", el("kbd", null, "B R K E I S"), " 도구 · ", el("kbd", null, "G"), " 칸 선 · ", el("kbd", null, "F"), " 전체 보기 · ", el("kbd", null, "Delete"), " 지우기"),
    el("p.muted", null, "실수해도 괜찮아요: 저장할 때마다 이전 파일이 game/data/.backup에 남고, 저장 안 한 작업은 이 브라우저에 자동으로 보관돼요. 자세한 안내: docs/editor/README.md"));
}
const help = () => dialog("처음 사용하기", helpBody(), [["시작하기", true, "gold"]], { wide: true });

async function boot() {
  for (const b of $$("#tabs button")) { if (b.dataset.ic) b.prepend(icon(b.dataset.ic)); b.onclick = () => showTab(b.dataset.tab); }
  $("#help-btn").onclick = help;
  try { await loadTables(); } catch (e) {
    document.body.append(el("div", { style: "position:fixed;inset:60px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#ffb0b0" }, "에디터 서버와 연결하지 못했어요: " + e.message));
    return;
  }
  ME.init({ onDirty: updateState, openMapUI: (id) => goMap(id) });
  QS.init({ onDirty: updateState });
  NP.init({ goMap });
  AS.init();
  BD.init({ goMap });
  ME.renderMapList();
  const last = localStorage.getItem("tt-editor-last");
  const first = DB.maps.find((m) => m.id === last) || DB.maps.find((m) => !m.builtin) || DB.maps[0];
  if (first) { await ME.openMap(first.id).catch((e) => toast(e.message, "bad")); ME.renderMapList(); }
  updateState();
  setInterval(updateState, 1500);
  if (!localStorage.getItem("tt-editor-helped")) { localStorage.setItem("tt-editor-helped", "1"); help(); }
}
addEventListener("keydown", (e) => {
  if (!$("#modal").hidden) return;
  let done = false;
  if (tab === "map") done = ME.key(e);
  else if (tab === "quest") done = QS.key(e);
  else if (tab === "npc") done = NP.key(e);
  if (!done && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") done = true;   // never the browser's "save page"
  if (done) e.preventDefault();
});
addEventListener("beforeunload", (e) => {
  ME.saveDraft();
  if (ME.dirty().any || QS.dirty() || NP.dirty()) { e.preventDefault(); e.returnValue = ""; }
});
boot();
