/**
 * The 에셋 tab: browse the repo's asset/ folder (GET /api/assets → gallery.json), look at a
 * picture big next to its code-drawn twin, and install an approved one into the game
 * (POST /api/assets/install → import-art.mjs --install). Shows what the manifest holds.
 */
import { $, el, api, toast, dialog, confirmBox } from "./ui.js";

const A = { groups: [], manifest: { images: {}, audio: {} }, dir: null, sel: null, loaded: false };
const DIR_KO = { ".": "맨 위", incoming: "받은 팩 원본", reference: "참고용 (게임에 못 씀)", generated: "AI 원본", weapons: "무기 (승인)", gear: "장비 (승인)", items: "아이템 (승인)", monsters: "몬스터", characters: "캐릭터", tiles: "타일", ui: "UI", fx: "효과", sfx: "효과음", music: "음악", fonts: "폰트", _export: "지금 코드 그림", _preview: "정리 전/후 비교" };
const dirKo = (d) => { const top = d.split("/")[0]; return (DIR_KO[top] || top) + (d.includes("/") ? " / " + d.slice(top.length + 1) : ""); };
const blocked = (p) => /^(_export|_preview|reference|incoming)\//.test(p);

export async function load(force = false) {
  if (A.loaded && !force) return;
  $("#as-grid").textContent = "asset 폴더를 읽는 중…";
  try {
    const r = await api("/api/assets");
    A.groups = r.groups || []; A.manifest = r.manifest || { images: {}, audio: {} }; A.loaded = true;
  } catch (e) { $("#as-grid").textContent = "읽지 못했어요: " + e.message; return; }
  tree(); grid(); installed();
}
function tree() {
  const ul = $("#as-tree");
  ul.textContent = "";
  const all = A.groups.reduce((n, g) => n + g.files.length, 0);
  ul.append(el("li" + (A.dir == null ? ".on" : ""), { onclick: () => { A.dir = null; tree(); grid(); } }, el("span", null, "전부 보기"), el("span.id", null, String(all))));
  for (const g of A.groups) {
    const depth = g.dir === "." ? 0 : g.dir.split("/").length - 1;
    ul.append(el("li" + (A.dir === g.dir ? ".on" : ""), { style: `padding-left:${6 + depth * 12}px`, title: "asset/" + g.dir, onclick: () => { A.dir = g.dir; tree(); grid(); } },
      el("span", null, dirKo(g.dir)), el("span.id", null, String(g.files.length))));
  }
  if (!A.groups.length) ul.append(el("li.okline", null, "asset 폴더가 비어 있어요"));
}
function grid() {
  const box = $("#as-grid"), q = $("#as-search").value.trim().toLowerCase(), z = +$("#as-zoom").value, bg = $("#as-bg").value;
  box.textContent = "";
  let shown = 0;
  for (const g of A.groups) {
    if (A.dir != null && g.dir !== A.dir) continue;
    const files = g.files.filter((f) => !q || f.p.toLowerCase().includes(q) || (f.label || "").toLowerCase().includes(q));
    if (!files.length) continue;
    box.append(el("h4", null, dirKo(g.dir), el("span.lab", null, `  asset/${g.dir === "." ? "" : g.dir}`)));
    for (const f of files.slice(0, 400)) {
      shown++;
      const pic = f.kind === "image" ? el("img", { src: "/asset/" + encodeURI(f.p), alt: f.n, loading: "lazy", style: f.w ? `width:${Math.min(240, f.w * z)}px;height:auto` : `max-width:${48 * z}px` }) : el("span.lab", null, f.kind === "audio" ? "소리" : "파일");
      box.append(el("div.as-cell" + (A.sel === f.p ? ".on" : ""), { title: `${f.p}${f.w ? ` (${f.w}×${f.h})` : ""}${f.label ? " — " + f.label : ""}`, onclick: () => { A.sel = f.p; grid(); detail(f); } },
        el("div.as-img.bg-" + bg, null, pic), el("small", null, f.label || f.n)));
    }
  }
  if (!shown) box.append(el("p.muted", null, q ? "찾는 그림이 없어요." : "이 폴더에 파일이 없어요. ASSETS.bat을 실행하면 지금 코드 그림이 _export에 생겨요."));
}
/** asset/<path> → the key import-art.mjs would choose (see its header). */
export function guessKey(p) {
  const n = p.slice(p.lastIndexOf("/") + 1).replace(/\.[a-z0-9]+$/i, "");
  let m = /^weapons\/[a-z]+\/(icon_)?([a-z]+)_t(\d)$/.exec(p.replace(/\.[a-z0-9]+$/i, ""));
  if (m) return `${m[1] ? "icon." : ""}weapon.${m[2]}.t${m[3]}`;
  m = /^(icon_)?([a-z]+)_(lg|set|skin)_([a-z0-9]+)$/.exec(n);
  if (m && p.startsWith("weapons/")) return `${m[1] ? "icon." : ""}weapon.${m[2]}.${m[3]}.${m[4]}`;
  if (/^(gear|items)\//.test(p)) return "icon.item." + n;
  return "";
}
function detail(f) {
  const box = $("#as-detail"), bg = $("#as-bg").value;
  box.textContent = "";
  const big = el("div.big.bg-" + bg);
  const z = f.w ? Math.max(1, Math.min(8, Math.floor(260 / Math.max(f.w, f.h)))) : 1;
  if (f.kind === "image") big.append(el("figure", null, el("img", { src: "/asset/" + encodeURI(f.p), style: f.w ? `width:${f.w * z}px` : "max-width:260px" }), el("figcaption", null, `이 그림 (${z}×)`)));
  if (f.twin) big.append(el("figure", null, el("img", { src: "/asset/" + encodeURI(f.twin), style: f.w ? `width:${f.w * z}px` : "max-width:260px" }), el("figcaption", null, "지금 코드 그림")));
  if (f.kind === "audio") big.append(el("audio", { src: "/asset/" + encodeURI(f.p), controls: true }));
  const key = el("input.inp", { type: "text", value: guessKey(f.p), placeholder: "비우면 자동 (파일 이름 규칙)", style: "width:100%", title: "게임 키 (예: weapon.sword.t3, icon.item.hp_s)" });
  const inMan = Object.entries(A.manifest.images || {}).concat(Object.entries(A.manifest.audio || {})).filter(([, v]) => String(v).endsWith(f.n));
  box.append(el("h3.ttl", null, f.n), big,
    el("p.small", null, `asset/${f.p}`, el("br"), f.w ? `${f.w} × ${f.h} 픽셀 · ` : "", `${Math.round(f.bytes / 102.4) / 10} KB`, f.label ? el("span", null, el("br"), f.label) : null),
    inMan.length ? el("p.small", null, "게임에 들어가 있어요: ", el("b", null, inMan.map((e) => e[0]).join(", "))) : "");
  if (f.kind === "file") return;
  if (blocked(f.p)) { box.append(el("p.hint", null, "이 폴더의 파일은 게임에 넣을 수 없어요. 정리(import-art)해서 승인 폴더(weapons·gear·items…)에 저장한 것만 넣어요.")); return; }
  box.append(el("div.subhead", null, "게임에 넣기"), el("p.hint", null, "주인이 승인했고, asset/CREDITS.md에 출처가 적힌 그림만 넣으세요."), el("div.form", null, el("label.f", null, el("span", null, "게임 키"), key)),
    el("button.btn.gold.wide", { onclick: () => install(f, key.value.trim()) }, "이 그림을 게임에 넣기"));
}
async function install(f, key) {
  if (!(await confirmBox("게임에 넣기", `asset/${f.p} 을(를) 게임에 넣을까요?${key ? ` (키: ${key})` : ""}\n같은 키에 이미 다른 그림이 있으면 바뀌어요.`, "넣기"))) return;
  try {
    const r = await api("/api/assets/install", { method: "POST", body: { file: f.p, key: key || undefined } });
    toast("게임에 넣었어요! 게임을 새로고침하면 보여요.", "ok");
    await dialog("게임에 넣었어요", el("pre", null, r.log || "완료"), [["확인", true, "gold"]], { wide: true });
    A.loaded = false; await load(true); detail(f);
  } catch (e) {
    toast(e.message, "bad");
    if (e.data && e.data.log) dialog("넣지 못했어요", el("pre", null, e.data.log), [["확인", true]], { wide: true });
  }
}
function installed() {
  const ul = $("#as-installed");
  ul.textContent = "";
  const all = [...Object.entries(A.manifest.images || {}), ...Object.entries(A.manifest.audio || {})];
  for (const [k, v] of all) ul.append(el("li", { title: String(v) }, el("span", null, k), el("span.id", null, String(v).split("/").pop())));
  if (!all.length) ul.append(el("li.okline", null, "아직 없어요 — 전부 코드로 그려요"));
}
export function init() {
  $("#as-search").addEventListener("input", grid);
  $("#as-zoom").addEventListener("change", grid);
  $("#as-bg").addEventListener("change", () => { grid(); const f = A.groups.flatMap((g) => g.files).find((x) => x.p === A.sel); if (f) detail(f); });
  $("#as-reload").onclick = () => { A.loaded = false; load(true); };
  $("#as-readme").onclick = async () => {
    let t = "";
    try { t = await (await fetch("/asset/README.md")).text(); } catch { t = "asset/README.md를 읽지 못했어요."; }
    dialog("에셋 작업 순서 (asset/README.md)", el("pre", null, t), [["닫기", true, "gold"]], { wide: true });
  };
}
