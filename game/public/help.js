/**
 * 도움말 window `#w-help` (menu 도움말, key `help`): a readable guide. A topic list (a column on the left when the window is wide, a row of
 * chips over the text in the docked side panel and on a phone), short sections of a few bullet lines, and a search box that matches the
 * topic names, the section headings and every line. The words are helptext.js — functions of `G.defs`, so no number is typed twice.
 * A `{key}` mark in a line becomes a <kbd data-key> chip: keymap.js `apply()` keeps it current when a key is rebound, so a rebinding shows
 * here without a redraw. The skeleton is built once; draw() in hud.js calls render() whenever key() changes (the topic or the search).
 */
import { G, $, el } from "./state.js";
import { Sound } from "./audio.js";
import { K } from "./keymap.js";
import { refreshUi } from "./hudkit.js";
import { topics } from "./helptext.js";

const F = { t: "start", q: "" };
let ui = null;
export const key = () => [F, G.defs && G.defs.jobs ? 1 : 0];
const norm = (s) => s.toLowerCase().replace(/\s+/g, "");
const MARK = /\{([ybgp])\|([^}]*)\}|\*\*([^*]+)\*\*|\{(\w+)\}/g;
/** A line's plain words (a key as its name now, marks gone): what the search reads. */
const plain = (s) => s.replace(MARK, (_, c, w, b, k) => (k ? K(k) : w || b));
/** A line as a <p>: bold words, colour words ({y|…} yellow · {b|…} blue · {g|…} green · {p|…} purple) and key chips. */
function line(s) {
  const p = el("p", "hp-l");
  let at = 0, m;
  MARK.lastIndex = 0;
  while ((m = MARK.exec(s))) {
    if (m.index > at) p.append(s.slice(at, m.index));
    if (m[1]) p.append(el("b", "hp-" + m[1], m[2]));
    else if (m[3]) p.append(el("b", "", m[3]));
    else { const k = el("kbd", "hp-k", K(m[4])); k.dataset.key = m[4]; p.append(k); }
    at = m.index + m[0].length;
  }
  if (at < s.length) p.append(s.slice(at));
  return p;
}
function section(h, lines, tag, hit) {
  const s = el("section", "hp-s"), hd = el("h4", "", h);
  if (tag) hd.prepend(el("small", "", tag));
  s.append(hd);
  for (const l of lines) { const p = line(l); if (hit && hit(l)) p.classList.add("hit"); s.append(p); }
  return s;
}
/** The skeleton, once: the search box, the topic list and the text. */
function build(box) {
  box.textContent = "";
  const q = el("input", "dx-q");
  q.type = "text"; q.placeholder = "찾을 말 (예: 협동, 초기화, 전직)"; q.maxLength = 20; q.autocomplete = "off"; q.spellcheck = false;
  q.addEventListener("input", () => { F.q = q.value; refreshUi(); });
  const nav = el("div", "hp-nav"), text = el("div", "hp-text");
  const main = el("div", "hp-main");
  main.append(nav, text);
  box.append(q, main);
  ui = { q, nav, text, btns: new Map() };
}
/** The 도움말 window opened at one topic (a window's "?" button: windows.js HELP). */
export function showTopic(id) { F.t = id; F.q = ""; if (ui) ui.q.value = ""; }
export function render() {
  const box = $("#help-body"), d = G.defs;
  if (!d || !d.jobs) { box.textContent = "불러오는 중…"; ui = null; return; }
  if (!ui || !box.contains(ui.q)) build(box);
  const all = topics(d), q = norm(F.q);
  if (!ui.btns.size) for (const t of all) {
    const b = el("button", "dx-chip hp-t", t.name);
    b.type = "button";
    b.addEventListener("click", () => { F.t = t.id; F.q = ""; ui.q.value = ""; Sound.play("tab"); refreshUi(); box.scrollTop = 0; });
    ui.btns.set(t.id, b); ui.nav.append(b);
  }
  for (const [id, b] of ui.btns) b.classList.toggle("on", !q && id === F.t);
  const out = ui.text;
  out.textContent = "";
  if (!q) {
    const t = all.find((x) => x.id === F.t) || all[0];
    out.append(el("h3", "", t.name));
    for (const s of t.secs) out.append(section(s.h, s.l));
    return;
  }
  const has = (s) => norm(plain(s)).includes(q);
  let n = 0;
  for (const t of all) for (const s of t.secs) {
    if (!(has(t.name) || has(s.h) || s.l.some(has))) continue;
    out.append(section(s.h, s.l, t.name, has)); n++;
  }
  out.prepend(el("h3", "", n ? `'${F.q.trim()}' — ${n}곳에서 찾았어요` : `'${F.q.trim()}' — 찾는 내용이 없어요. 다른 낱말로 찾아 보세요.`));
}
