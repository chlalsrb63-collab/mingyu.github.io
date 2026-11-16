/**
 * Client-only preferences of the 설정 window (localStorage, nothing on the server):
 * - 단축키 설정: ONE table action → physical key (`e.code`, so a Korean 2-set layout needs no duplicate
 *   letters). `actionOf(e)` is what the keydown switch in input.js reads; `label(id)` / `K(id)` is what every
 *   on-screen hint reads (`data-key="<id>"` in index.html is refreshed by `apply()`).
 *   shortcut: labels assume a QWERTY key cap; on other layouts the cap and the label can differ.
 * - 글자 크기: body[data-ts="s|m|l"] swaps the --t10/--t11/--t12 integer font sizes of hud.css.
 * - HUD 투명도: --hud-a on :root (100/90/80/70 %, default 90): hud.css fades the floating windows, frames.js and hud.css the panel faces.
 * - HUD 색상: body[data-hud=<theme>] picks a colour theme block of hud.css; frames.js redraws the 9-slices.
 */
import { $ } from "./state.js";
import { installFrames } from "./frames.js";

// [id, Korean name, default (Shift+)code, group]
const A = [
  ["up", "위로 이동", "KeyW", "이동"], ["down", "아래로 이동", "KeyS", "이동"], ["left", "왼쪽으로 이동", "KeyA", "이동"], ["right", "오른쪽으로 이동", "KeyD", "이동"],
  ["attack", "공격 (누르고 있기)", "KeyX", "전투"], ["dash", "대시", "Space", "전투"], ["auto", "자동사냥", "KeyR", "전투"], ["hp", "HP 물약", "KeyQ", "전투"], ["mp", "MP 물약", "KeyE", "전투"],
  ["swap", "무기 바꾸기 (Ⅰ/Ⅱ)", "Tab", "전투"], ["interact", "말 걸기 · 상호작용", "KeyF", "전투"],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ["slot" + n, `단축칸 ${n}`, "Digit" + n, "단축칸"]),
  ["inv", "가방", "KeyI", "창"], ["char", "캐릭터", "KeyC", "창"], ["skill", "스킬", "KeyK", "창"], ["quest", "의뢰", "KeyL", "창"],
  ["daily", "일일 토벌", "KeyU", "창"], ["achieve", "업적 · 칭호", "KeyY", "창"], ["collect", "몬스터 도감", "KeyJ", "창"], ["dex", "아이템도감 (접두사)", "Shift+KeyI", "창"],
  ["life", "생활 기술", "Shift+KeyL", "창"], ["alba", "아르바이트", "Shift+KeyJ", "창"], ["week", "주간 수첩", "Shift+KeyU", "창"], ["charm", "참 보드", "Shift+KeyC", "창"], ["trophy", "보스 전리품", "Shift+KeyT", "창"], ["party", "파티", "KeyP", "창"], ["guild", "길드", "KeyG", "창"], ["rank", "랭킹", "KeyN", "창"],
  ["map", "지도", "KeyM", "창"], ["settings", "설정", "KeyO", "창"], ["help", "도움말", "KeyH", "창"], ["phone", "스마트폰 (메뉴)", "Backquote", "창"],
  ["sit", "앉기 · 일어서기 (사냥터: 모닥불)", "KeyZ", "기타"], ["emote", "감정표현", "KeyT", "기타"], ["jamB", "연주 (앉은 채)", "KeyB", "기타"], ["jamZ", "건배 (앉은 채)", "Shift+KeyB", "기타"],
  ["sound", "소리 켜기/끄기", "Shift+KeyM", "기타"], ["crt", "CRT 효과", "KeyV", "기타"], ["chat", "채팅 입력", "Enter", "기타"],
  ["track", "추적 (목표로 자동 이동)", "Shift+KeyG", "기타"], ["reply", "귓속말 답장 (마지막 보낸 이에게)", "Shift+KeyR", "기타"],
  // only while a talk window is open: their keys may be the same as the game's (F, C) — see TALK
  ["talkNext", "대화 다음 · 확인", "KeyF", "대화"], ["talkEnd", "대화 끝내기", "KeyC", "대화"],
];
/** Actions that only count while a dialogue is open: their own namespace, so they can share keys with the game's. */
const TALK = new Set(["talkNext", "talkEnd"]);
const space = (id) => (TALK.has(id) ? 1 : 0);
const DEF = Object.fromEntries(A.map(([id, , d]) => [id, d]));
const NAME = Object.fromEntries(A.map(([id, n]) => [id, n]));
const LS = "lumentale:keys", LS_TS = "lumentale:ts", LS_HUD = "lumentale:hud", LS_HA = "lumentale:huda";
const HUD_ALPHAS = [100, 90, 80, 70];   // 설정 → HUD 투명도 (index.html #opt-hud-a); the minimap, tooltips, minigames and the death panel never fade
const HUD_THEMES = ["brass", "linen", "sand", "olive", "mocha", "contrast"];   // hud.css "HUD colour themes", index.html #opt-hud
let bind = { ...DEF };
const rev = (t = 0) => Object.fromEntries(Object.entries(bind).filter(([id]) => space(id) === t).map(([id, c]) => [c, id]));
let byCode = rev(), byTalk = rev(1);

const SPECIAL = { Space: "Space", Enter: "Enter", Tab: "Tab", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backspace: "Bksp", Delete: "Del", Insert: "Ins", Home: "Home", End: "End", PageUp: "PgUp", PageDown: "PgDn" };
/** A key's face text: "KeyI" → "I", "Shift+KeyL" → "Shift+L" (short: "S+L"). */
function face(b, short) {
  const sh = b.startsWith("Shift+"), c = sh ? b.slice(6) : b;
  const t = c.startsWith("Key") ? c.slice(3) : c.startsWith("Digit") ? c.slice(5) : c.startsWith("Numpad") ? "Num" + c.slice(6) : SPECIAL[c] || c;
  return sh ? (short ? "S+" : "Shift+") + t : short && t === "Space" ? "Spc" : t;
}
export const label = (id, short) => face(bind[id] || DEF[id] || "?", short);
/** For text: K("skill") → "K". */
export const K = label;

const MODS = /^(Shift|Control|Alt|Meta|OS|CapsLock|NumLock)/;
/** The action a keydown stands for (Shift+key first, then the bare key, as the old switch ignored Shift), or "". */
export function actionOf(e) {
  return (e.shiftKey && byCode["Shift+" + e.code]) || byCode[e.code] || "";
}
/** Is action `id` bound to this event's key? */
export const is = (e, id) => actionOf(e) === id;
/** The dialogue action a keydown stands for ("talkNext" / "talkEnd"), or "". */
export const talkActionOf = (e) => (e.shiftKey && byTalk["Shift+" + e.code]) || byTalk[e.code] || "";
/** Is the key of action `id` held (the arrows always walk too)? `keys` holds e.code values. */
export function held(keys, id) {
  const c = bind[id];
  return keys.has(c) || (id === "up" && keys.has("ArrowUp")) || (id === "down" && keys.has("ArrowDown")) || (id === "left" && keys.has("ArrowLeft")) || (id === "right" && keys.has("ArrowRight"));
}

function save() {
  const o = {};
  for (const id in DEF) if (bind[id] !== DEF[id]) o[id] = bind[id];
  if (Object.keys(o).length) localStorage.setItem(LS, JSON.stringify(o)); else localStorage.removeItem(LS);
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(LS) || "{}"), b = { ...DEF }, used = new Set();
    for (const id in o) if (id in DEF && typeof o[id] === "string" && /^(Shift\+)?[A-Za-z0-9]{1,16}$/.test(o[id]) && !MODS.test(o[id].replace("Shift+", ""))) b[id] = o[id];
    // a damaged or hand-edited list must not bind one key twice: later actions fall back to their default
    for (const [id] of A) { const k = space(id) + ":" + b[id]; if (used.has(k)) b[id] = DEF[id]; used.add(space(id) + ":" + b[id]); }
    bind = b;
  } catch { bind = { ...DEF }; }
  byCode = rev(); byTalk = rev(1);
}

/** Refresh every `data-key` hint: a <kbd>/<b>/<span> shows the key, and the title of its button swaps "(X)". */
export function apply(root = document) {
  for (const n of root.querySelectorAll("[data-key]")) {
    const id = n.dataset.key, own = ["KBD", "B", "SPAN"].includes(n.tagName);
    const t = label(id, own && !!n.closest("#menu, .act"));
    if (own) n.textContent = t;
    const host = own ? n.parentElement : n;
    if (host && host.title && /\([^()]*\)/.test(host.title)) host.title = host.title.replace(/\([^()]*\)/, `(${label(id)})`);
  }
  const list = $("#keys-list");
  if (list) for (const b of list.querySelectorAll("button[data-id]")) b.textContent = b.classList.contains("cap") ? "키를 누르세요" : label(b.dataset.id);
}

let cap = null;   // the row being rebound
function endCap() { if (!cap) return; cap.classList.remove("cap"); cap = null; apply(); }
function assign(id, code) {
  const old = bind[id], other = (TALK.has(id) ? byTalk : byCode)[code];
  if (other === id) return;
  bind[id] = code;
  if (other) { bind[other] = old; toast(`[${face(code)}] 키가 [${NAME[other]}]에서 [${NAME[id]}]로 옮겨져, 두 동작의 키를 맞바꿨습니다`); }
  else toast(`[${NAME[id]}] 키를 [${face(code)}]로 바꿨습니다`);
  byCode = rev(); byTalk = rev(1); save(); Sound.play("ui");
}

/** Apply a HUD colour theme (unknown names fall back to the default brass) and redraw the frames in its colours. */
export function hudTheme(v) {
  if (!HUD_THEMES.includes(v)) v = "brass";
  document.body.dataset.hud = v;
  installFrames();
  return v;
}
hudTheme(localStorage.getItem(LS_HUD));

/** Set the HUD panels' opacity (a step of HUD_ALPHAS, anything else → 90 %) on :root, redraw the see-through frames, mark the 설정 button. */
function hudAlpha(v) {
  v = HUD_ALPHAS.includes(+v) ? +v : 90;
  document.documentElement.style.setProperty("--hud-a", v / 100);
  installFrames();
  for (const b of document.querySelectorAll("#opt-hud-a button")) b.classList.toggle("on", +b.dataset.a === v);
  return v;
}
hudAlpha(localStorage.getItem(LS_HA));

/** Build the 단축키 list and the 글자 크기 buttons in the settings window (index.html #keys-list, #opt-ts). */
load();   // module-level hint strings elsewhere read the saved bindings at import time
let toast = () => {}, Sound = { play() {} };   // injected by setupKeymap: importing windows.js/audio.js here would make an import cycle
export function setupKeymap(api) {
  ({ toast, Sound } = api);
  // capture first: while a row waits for a key, the game's own keydown must not run
  addEventListener("keydown", (e) => {
    if (!cap) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === "Escape") { endCap(); return; }
    if (MODS.test(e.code) || !e.code) return;
    if (/^Arrow/.test(e.code)) { toast("방향키는 항상 이동에 쓰입니다 — 다른 키를 눌러 주세요"); return; }
    const id = cap.dataset.id;
    // Shift is only kept for the two actions that are a Shift pair by default
    assign(id, e.shiftKey && DEF[id].startsWith("Shift+") ? "Shift+" + e.code : e.code);
    endCap();
  }, true);
  const list = $("#keys-list");
  if (list) {
    let g = "";
    for (const [id, name, , grp] of A) {
      if (grp !== g) { g = grp; const h = document.createElement("div"); h.className = "kg"; h.textContent = grp; list.append(h); }
      const row = document.createElement("div"), b = document.createElement("button");
      row.className = "kr"; row.innerHTML = `<span></span>`; row.firstChild.textContent = name;
      b.type = "button"; b.className = "btn small"; b.dataset.id = id;
      b.addEventListener("click", () => { const was = cap === b; endCap(); if (was) return; cap = b; b.classList.add("cap"); b.textContent = "키를 누르세요"; b.blur(); });
      row.append(b); list.append(row);
    }
    $("#btn-keys-reset").addEventListener("click", () => { endCap(); bind = { ...DEF }; byCode = rev(); byTalk = rev(1); save(); apply(); toast("단축키를 기본값으로 되돌렸습니다"); Sound.play("ui"); });
  }
  apply();
  const ts = (v) => {
    if (!["s", "m", "l"].includes(v)) v = "m";
    document.body.dataset.ts = v;
    for (const b of document.querySelectorAll("#opt-ts button")) b.classList.toggle("on", b.dataset.ts === v);
    return v;
  };
  ts(localStorage.getItem(LS_TS));
  for (const b of document.querySelectorAll("#opt-ts button")) b.addEventListener("click", () => { localStorage.setItem(LS_TS, ts(b.dataset.ts)); Sound.play("ui"); });
  // the settings window is hovered while a step is picked, so for a moment every floating window shows its see-through look (body.hud-peek)
  let peek = 0;
  for (const b of document.querySelectorAll("#opt-hud-a button")) b.addEventListener("click", () => {
    localStorage.setItem(LS_HA, hudAlpha(b.dataset.a)); Sound.play("ui");
    document.body.classList.add("hud-peek"); clearTimeout(peek); peek = setTimeout(() => document.body.classList.remove("hud-peek"), 1500);
  });
  const sel = $("#opt-hud");
  if (sel) { sel.value = document.body.dataset.hud; sel.addEventListener("change", () => { localStorage.setItem(LS_HUD, hudTheme(sel.value)); Sound.play("ui"); }); }
}
