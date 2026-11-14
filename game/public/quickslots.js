/**
 * The quick slots under keys 1–9.
 *
 * Nothing is put there for the player: each slot is empty until a skill is
 * dragged in from the skill window (K) or a usable item from the bag (potions,
 * food, scrolls, the camp kit, a pet). The server keeps the nine slots with
 * the character (`self.qs`: null | ["s", skill id] | ["i", item id]) and
 * checks every change ({ t: "qs", i, v } to set, { t: "qs", i, j } to swap).
 *
 *   - drag onto a slot to set it, between slots to swap, off the bar to clear;
 *   - right-click a slot (or hold it, on a touch screen) to clear it;
 *   - without a mouse: tap "단축칸" on a skill or an item, then tap a slot;
 *   - 1–9, a click or a tap uses what the slot holds.
 *
 * client.js calls `init` once, `render` whenever the sheet changes, `tick` every
 * frame, `press` for the number keys and `autoSkills` for auto-hunt.
 */
import { Sound } from "./audio.js";
import { skillIconUrl } from "./skillicons.js";

export const N = 9;
/** What client.js lends us. */
let C = null;
const $ = (s) => document.querySelector(s);
const btns = [];
/** A thing picked up with a tap, waiting for the slot it goes in. */
let picked = null;
/** The drag in progress, if any. */
let drag = null;
/** A drag just ended: the click that follows it is not a press. */
let swallowClick = 0;

export function init(ctx) {
  C = ctx;
  const box = $("#qslots");
  box.textContent = "";
  for (let i = 0; i < N; i++) {
    const b = document.createElement("button");
    b.className = "act qs empty";
    b.id = `q${i}`;
    b.dataset.i = String(i);
    b.innerHTML = `<img class="ic" alt="" /><i class="cd"></i><em class="cdt"></em><small class="mp"></small><span class="n"></span><kbd>${i + 1}</kbd>`;
    box.append(b);
    btns.push(b);
    hook(b, i);
  }
  const hint = document.createElement("div");
  hint.id = "qs-hint";
  hint.hidden = true;
  hint.textContent = "스킬(K)·아이템(가방)을 끌어다 놓으세요";
  $("#actions").append(hint);
  addEventListener("click", (e) => { if (swallowClick && performance.now() - swallowClick < 400) { e.stopPropagation(); e.preventDefault(); } swallowClick = 0; }, true);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && picked) { setPicked(null); } }, true);
  // the browser's own image dragging would steal the pointer from ours
  addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(".qs-src, .act.qs")) e.preventDefault(); }, true);
}

/** The slots as the server last sent them. */
const slots = () => (C.G.self && C.G.self.qs) || Array(N).fill(null);
/** The weapon skills (defs.skills, by id) and this character's wire row of one: [id, MP now, cooldown left, usable 1/0]. */
const skills = () => C.G.defs.skills;
const row = (id) => (C.G.skw && C.G.skw.get(id)) || null;
const PP = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? a : b; };
/**
 * Why skill `id` cannot be used now with what is in hand ("" when it can): the same words the server
 * gives (57-weapon-skills.js skWhy), so a press on a dim slot answers at once.
 */
export function skillWhy(id) {
  const G = C.G, s = G.self, sk = G.defs.skills[id];
  if (!s || !sk) return "없는 스킬";
  const r = row(id);
  if (r && r[3]) return "";
  if (sk.job && s.job !== sk.job) return `[${G.defs.jobs[sk.job].name}]의 스킬입니다`;
  const wk = sk.wk || (G.defs.jobs[sk.job] ? G.defs.jobs[sk.job].wk[0] : "");
  if (!sk.job && !r) return `[${G.defs.wkName[sk.wk]}] 숙련 ${sk.need}에 배웁니다`;
  const name = G.defs.wkName[wk] || "무기";
  return `[${name}]${PP(name, "을", "를")} 들어야 쓸 수 있습니다`;
}
/** What skill `id` costs right now (a full resonance makes a staff skill free). */
export const skillMp = (id) => { const r = row(id); return r ? r[1] : (C.G.defs.skills[id] || {}).mp || 0; };
const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
/** Where (if anywhere) a skill or item sits: "1", "1·4" … */
export function keysOf(v) {
  return slots().map((s, i) => (same(s, v) ? i + 1 : 0)).filter(Boolean).join("·");
}

// ── changing the slots ──
function set(i, v) {
  const cur = slots();
  // the same thing in two slots is allowed, but dropping it where it already is changes nothing
  if (same(cur[i], v)) return;
  C.act({ t: "qs", i, v });
  if (C.G.self) C.G.self.qs = cur.map((s, k) => (k === i ? v : s));     // show it at once; the server's copy follows
  Sound.play("ui");
  render();
}
function swap(i, j) {
  if (i === j) return;
  const cur = slots().slice();
  C.act({ t: "qs", i, j });
  [cur[i], cur[j]] = [cur[j], cur[i]];
  if (C.G.self) C.G.self.qs = cur;
  Sound.play("ui");
  render();
}
function clear(i) {
  if (!slots()[i]) return;
  set(i, null);
}
function setPicked(v) {
  picked = v;
  document.body.classList.toggle("qs-pick", !!v);
  if (v) C.toast(C.touch() ? "놓을 단축칸을 누르세요 · 같은 버튼을 다시 누르면 취소" : "놓을 단축칸(1~9)을 누르세요 · Esc 취소");
}
/** "단축칸" buttons in the skill window and the bag: pick this up and tap a slot. */
export function pick(v) { setPicked(same(picked, v) ? null : v); Sound.play("ui"); }

// ── using a slot ──
export function press(i) {
  const v = slots()[i];
  if (picked) { set(i, picked); setPicked(null); return; }
  if (!v) { emptyHint(); return; }
  if (v[0] === "s") C.castSkill(v[1]);
  else useItem(v[1]);
}
let emptyAt = 0;
function emptyHint() {
  const t = performance.now();
  if (t - emptyAt < 4000) return;
  emptyAt = t;
  C.toast("빈 단축칸입니다 — 스킬 창(K)이나 가방에서 끌어다 놓으세요");
}
function useItem(id) {
  const G = C.G, it = G.defs.items[id], t = performance.now();
  if (!it || !G.self || G.me.dead) return;
  const i = G.self.inv.findIndex((s) => s.id === id);
  if (i < 0) { C.toast(`${it.name}이(가) 가방에 없습니다`); Sound.play("no"); return; }
  if (it.type === "pot") {
    if (t < G.potAt) return;
    G.potAt = t + 950;
  }
  C.useSlot(i);
}

/** Auto-hunt casts what the player put in the slots, in slot order, and nothing else. */
export function autoSkills() {
  return slots().filter((v) => v && v[0] === "s").map((v) => v[1]);
}

// ── drawing ──
function setSrc(img, src) { if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; } }
export function render() {
  const G = C.G, s = G.self;
  if (!s || !btns.length) return;
  const list = skills(), cur = slots();
  let any = false;
  const wkn = C.G.defs.wkName;
  cur.forEach((v, i) => {
    const b = btns[i], img = b.querySelector("img.ic");
    const kind = v ? v[0] : "";
    any = any || !!v;
    b.classList.toggle("empty", !v);
    b.classList.toggle("sk", kind === "s");
    b.classList.toggle("it", kind === "i");
    let ult = false, locked = false, none = false, mp = "", n = "", title = `${i + 1}번 단축칸 — 비어 있음\n스킬 창(K)이나 가방에서 끌어다 놓으세요`;
    if (kind === "s") {
      const sk = list[v[1]];
      if (sk) {
        setSrc(img, skillIconUrl(sk.id));
        ult = !!sk.job;
        const why = skillWhy(sk.id);
        locked = !!why;
        mp = String(skillMp(sk.id));
        // a dim slot names what it waits for: the weapon (or the job) it needs, or the mastery
        b.dataset.lv = !row(sk.id) && !sk.job ? `숙련${sk.need}` : sk.job && C.G.self.job !== sk.job ? "전직" : wkn[sk.wk || (C.G.defs.jobs[sk.job] || { wk: [""] }).wk[0]] || "";
        title = `${sk.name} (${i + 1}) — MP ${sk.mp} · ${sk.cd / 1000}초${why ? ` · ${why}` : ""}\n${sk.desc}`;
      }
    } else if (kind === "i") {
      const it = G.defs.items[v[1]];
      setSrc(img, G.icons.url[v[1]]);
      const c = C.countItem(v[1]);
      none = c < 1;
      n = String(c);
      title = `${it.name} (${i + 1}) — ${c}개\n${it.desc || ""}`;
    }
    if (!v) img.removeAttribute("src"), (img.dataset.src = "");
    img.hidden = !v;
    b.classList.toggle("ult", ult);
    b.classList.toggle("locked", locked);
    b.classList.toggle("none", none);
    b.querySelector(".mp").textContent = mp;
    b.querySelector(".n").textContent = n;
    if (!C.touch()) b.title = title;
    else b.removeAttribute("title");
  });
  // a skill just learned: the server put it on the bar if there was room (and its toast says
  // which key); the log keeps a line, and says where to find it when the bar was full
  // (the skills learned, against the last sheet: a new active gets a line in the log)
  const have = new Set((s.sk || []).map((r) => r[0]));
  if (render.have && render.who === s.name) {
    for (const id of have) {
      const sk = list[id];
      if (render.have.has(id) || !sk || sk.kind === "p") continue;
      const k = keysOf(["s", id]);
      C.addChat(k ? `새 스킬 [${sk.name}] — 단축칸 ${k} 키로 씁니다.` : `새 스킬 [${sk.name}] — 단축칸이 가득 찼습니다. 스킬 창(K)에서 빈 칸으로 끌어다 놓으세요.`, "sys");
    }
  }
  render.have = have; render.who = s.name;
  // a gentle pointer at the empty bar until something is put in it
  const hint = $("#qs-hint");
  if (hint) { hint.hidden = any; hint.textContent = C.touch() ? "스킬(K)·가방의 [단축칸] → 칸 누르기" : "스킬(K)·아이템(가방)을 끌어다 놓으세요"; }
  // (only once there is a skill to put there: a new Lv.1 has enough to read)
  if (!any && !render.told && have.size) {
    render.told = true;
    C.addChat("단축칸 1~9는 비어 있습니다. 스킬 창(K)의 스킬이나 가방의 물약·음식·주문서를 아래 단축칸에 끌어다 놓으면 그 숫자 키로 씁니다. (터치: 스킬·아이템의 [단축칸] 버튼 → 칸 누르기)", "sys");
  }
}

/** Cooldown sweeps and the "not enough MP" grey, every frame. */
export function tick(t) {
  const G = C.G, s = G.self;
  if (!s || !btns.length) return;
  const list = skills(), cur = slots();
  for (let i = 0; i < N; i++) {
    const v = cur[i], b = btns[i];
    let left = 0, full = 1, nomp = false;
    if (v && v[0] === "s" && list[v[1]]) {
      const sk = list[v[1]];
      left = (G.cdEnd[v[1]] || 0) - t; full = sk.cd;
      nomp = G.me.mp < skillMp(v[1]) && !skillWhy(v[1]);
    } else if (v && v[0] === "i" && G.defs.items[v[1]] && G.defs.items[v[1]].type === "pot") {
      left = G.potAt - t; full = 950;
    }
    const cd = left > 0 ? Math.min(1, left / full).toFixed(3) : "0";
    if (b.dataset.cd !== cd) { b.dataset.cd = cd; b.style.setProperty("--cd", cd); }
    const txt = left > 0 && full > 1000 ? (left >= 10000 ? String(Math.ceil(left / 1000)) : (left / 1000).toFixed(left < 3000 ? 1 : 0)) : "";
    const cdt = b.querySelector(".cdt");
    if (cdt.textContent !== txt) cdt.textContent = txt;
    b.classList.toggle("nomp", nomp);
  }
}

// ── pointer handling: press, drag, right-click, long-press ──
function hook(b, i) {
  let down = null, hold = 0;
  b.addEventListener("pointerdown", (e) => {
    if (e.button === 2) return;
    e.preventDefault();
    b.classList.add("down");
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    const v = slots()[i];
    if (v) startDrag(e, v, i);
    // held still on a touch screen: clear the slot
    clearTimeout(hold);
    if (e.pointerType === "touch" && v) hold = setTimeout(() => { if (drag && !drag.moved) { endDrag(null, true); clear(i); C.toast(`${i + 1}번 단축칸을 비웠습니다`); down = null; } }, 650);
  });
  const up = (e) => {
    b.classList.remove("down");
    clearTimeout(hold);
    if (!down) return;
    down = null;
    // a drag that just ended (a touch keeps sending its events to where it started) is not a press
    if (swallowClick && performance.now() - swallowClick < 300) return;
    if (drag && drag.moved) return;
    endDrag(null, true);
    press(i);
  };
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", () => { b.classList.remove("down"); clearTimeout(hold); down = null; });
  b.addEventListener("contextmenu", (e) => { e.preventDefault(); endDrag(null, true); if (picked) setPicked(null); else clear(i); });
  b.addEventListener("mouseenter", () => { if (!C.touch() && slots()[i]) C.showTip(b, (h) => slotTip(h, slots()[i])); });
  b.addEventListener("mouseleave", () => C.hideTip());
}
/** The tooltip: what the slot holds, in the same words the windows use. */
function slotTip(h, v) {
  const G = C.G, s = G.self;
  if (!v || !s) return;
  const el = C.el;
  if (v[0] === "s") {
    const sk = skills()[v[1]];
    if (!sk) return;
    h.append(el("div", "nm", sk.name));
    h.append(el("div", "ds", `MP ${skillMp(v[1])} · 재사용 ${sk.cd / 1000}초${sk.job ? " · 전직 기술" : ""}`));
    const why = skillWhy(v[1]);
    if (why) h.append(el("div", "err-line", why));
    h.append(el("div", "ds", sk.desc));
  } else {
    const it = G.defs.items[v[1]];
    h.append(el("div", "nm", it.name));
    h.append(el("div", "ds", it.desc || ""));
    h.append(el("div", C.countItem(v[1]) ? "gold-line" : "err-line", `가방에 ${C.countItem(v[1])}개`));
  }
  h.append(el("div", "hint", "끌어서 옮기기 · 바깥에 놓거나 우클릭하면 비우기"));
}

/** Make a skill row or a bag slot something that can be dragged onto the bar. */
export function dragSource(node, v) {
  node.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    startDrag(e, v, -1);
  });
  node.classList.add("qs-src");
}
function startDrag(e, v, from) {
  endDrag(null, true);
  drag = { v, from, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, id: e.pointerId };
  addEventListener("pointermove", onMove, true);
  addEventListener("pointerup", onUp, true);
  addEventListener("pointercancel", onCancel, true);
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
    drag.moved = true;
    C.hideTip();
    const g = document.createElement("img");
    g.id = "qs-ghost";
    g.src = drag.v[0] === "s" ? skillIconUrl(drag.v[1]) : C.G.icons.url[drag.v[1]];
    document.body.append(g);
    drag.ghost = g;
    document.body.classList.add("qs-drag");
  }
  drag.ghost.style.left = `${e.clientX - 16}px`;
  drag.ghost.style.top = `${e.clientY - 16}px`;
  const over = slotAt(e.clientX, e.clientY);
  for (const b of btns) b.classList.toggle("over", b === over);
}
function slotAt(x, y) {
  const hit = document.elementFromPoint(x, y);
  return hit && hit.closest ? hit.closest(".act.qs") : null;
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  endDrag(e, false);
}
function onCancel() { endDrag(null, true); }
function endDrag(e, quiet) {
  removeEventListener("pointermove", onMove, true);
  removeEventListener("pointerup", onUp, true);
  removeEventListener("pointercancel", onCancel, true);
  document.body.classList.remove("qs-drag");
  for (const b of btns) b.classList.remove("over");
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.ghost) d.ghost.remove();
  if (quiet || !d.moved || !e) return;
  swallowClick = performance.now();
  const over = slotAt(e.clientX, e.clientY);
  const to = over ? Number(over.dataset.i) : -1;
  if (to >= 0 && d.from >= 0) swap(d.from, to);
  else if (to >= 0) set(to, d.v);
  else if (d.from >= 0) { clear(d.from); C.toast(`${d.from + 1}번 단축칸을 비웠습니다`); }
}
