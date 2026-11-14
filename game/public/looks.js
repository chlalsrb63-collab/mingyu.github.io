/**
 * The look editor: the tabbed part picker on the creation screen, and the mirror
 * (거울) that changes a character's look later, in town, for gold.
 *
 * Every choice is shown as a small picture of the face it makes, not a word, so
 * the player sees what they get. Parts and drawing live in species.js; the server
 * checks every look (logic.js LOOK_MAX).
 */
import * as SP from "./sprites.js";
import * as SPC from "./species.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

const CSS = `
#c-parts .lk { grid-column: 1 / -1; }
.lk { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.lk-tabs { display: flex; gap: 2px; flex-wrap: wrap; }
.lk-tabs button { flex: 1; padding: 3px 2px !important; font: 12px/1.2 var(--pix) !important; border-radius: 0; color: var(--cream, #f3e8cc); background: #3a3146; border: 2px solid var(--ink); box-shadow: inset 2px 2px 0 #5b4d6c, inset -2px -2px 0 #1f1a28; cursor: pointer; }
.lk-tabs button.on { color: #2a1806; background: var(--b-mid, #cf9f55); box-shadow: inset 2px 2px 0 var(--b-hi, #f4dfa4), inset -2px -2px 0 var(--b-lo, #7c5326); }
.lk-page { max-height: 248px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; padding-right: 2px; }
.lk-lab { font: 12px var(--pix); color: var(--b-hi, #f4dfa4); display: flex; justify-content: space-between; }
.lk-lab b { color: var(--cream, #f3e8cc); font-weight: 400; }
.lk-grid { display: flex; flex-wrap: wrap; gap: 3px; }
.lk-thumb { width: 44px; height: 38px; padding: 0 !important; border: 2px solid var(--ink); border-radius: 0; background: #5a8a50; cursor: pointer; image-rendering: pixelated; }
.lk-thumb canvas { display: block; width: 40px; height: 34px; image-rendering: pixelated; }
.lk-thumb.on { outline: 2px solid var(--b-hi, #f4dfa4); outline-offset: 0; background: #7ab06a; }
.lk-thumb.wide { width: 58px; height: 52px; }
.lk-thumb.wide canvas { width: 40px; height: 34px; margin: 0 auto; }
.lk-thumb small { display: block; font: 9px/1.1 var(--pix9, sans-serif); color: #f3e8cc; text-shadow: 0 1px 0 #000; white-space: nowrap; overflow: hidden; }
.lk-sw { display: flex; flex-wrap: wrap; gap: 4px; }
.lk-sw button { width: 20px; height: 20px; padding: 0 !important; border: 2px solid var(--ink); border-radius: 0; cursor: pointer; }
.lk-sw button.on { outline: 2px solid var(--b-hi, #f4dfa4); outline-offset: 1px; }
.lk-sw button.none { background: linear-gradient(135deg, transparent 44%, #c66 45%, #c66 55%, transparent 56%), rgba(255, 255, 255, .08); }
#mirror { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(8, 6, 14, .55); }
#mirror .frame { width: min(420px, calc(100vw - 20px)); padding: 6px 10px 10px; font: 12px var(--pix); color: var(--cream, #f3e8cc); background: none; border: 14px solid transparent; border-image: var(--fr-brass) 14 fill / 14px / 0 stretch; image-rendering: pixelated; }
#mirror h2 { font: 700 12px/1.4 var(--pix); color: var(--b-hi, #f4dfa4); margin: 0 0 6px; text-align: center; }
#mirror .mr-row { display: flex; gap: 8px; align-items: flex-start; }
#mirror .mr-stage { flex: none; width: 96px; height: 120px; background: #6cbf5e; border: 2px solid var(--ink); image-rendering: pixelated; }
#mirror .mr-btns { display: flex; gap: 6px; justify-content: center; margin-top: 8px; }
#mirror .mr-btns button, .lk-small { font: 12px/1.2 var(--pix) !important; border-radius: 0; color: var(--cream, #f3e8cc); background: #3a3146; border: 2px solid var(--ink); box-shadow: inset 2px 2px 0 #5b4d6c, inset -2px -2px 0 #1f1a28; padding: 4px 12px; cursor: pointer; }
#mirror .mr-btns button.gold { color: #2a1806; background: var(--b-mid, #cf9f55); box-shadow: inset 2px 2px 0 var(--b-hi, #f4dfa4), inset -2px -2px 0 var(--b-lo, #7c5326); }
#mirror .mr-msg { min-height: 1.4em; text-align: center; color: #ffb0b0; margin-top: 4px; }
.lk-mirror-btn { position: absolute; right: 6px; top: 6px; font: 11px/1.1 var(--pix) !important; padding: 2px 6px !important; z-index: 1; }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.append(s);
}

// ───────────────────────────── thumbnails ─────────────────────────────

const thumbCache = new Map();
/** A small picture of a look: the head (and, for tails, the side view with the body). */
function thumb(look, view = "front", whole = false) {
  const key = look.join(".") + view + whole;
  let c = thumbCache.get(key);
  if (c) return copy(c);
  c = el("canvas");
  const fr = SP.personSheet(SP.playerLook("warrior", look))[view][0];
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (whole) { c.width = 27; c.height = 17; g.drawImage(fr, 3, 12, 27, 17, 0, 0, 27, 17); }
  else { c.width = 20; c.height = 17; g.drawImage(fr, 6, 9, 20, 17, 0, 0, 20, 17); }
  thumbCache.set(key, c);
  if (thumbCache.size > 600) thumbCache.delete(thumbCache.keys().next().value);
  return copy(c);
}
/** A fresh canvas with the same picture (one element can only sit in one place). */
function copy(src) { const c = el("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d").drawImage(src, 0, 0); return c; }

/** A pleasing random look: an animal with its own parts, a colour, now and then an accent. */
export function randomLook() {
  const R = (n) => Math.floor(Math.random() * n);
  if (Math.random() < 0.35) return SPC.PRESETS[R(SPC.PRESETS.length)][1].slice();
  const lk = SPC.withSpecies([], 1 + R(SPC.SPECIES.length - 1));
  lk[SPC.LI.fur] = R(SPC.LOOK_N[SPC.LI.fur]);
  lk[SPC.LI.eye] = [0, 0, 2, 2, 3, 5, 6, 6, 7, 9, 12, 13][R(12)];
  lk[SPC.LI.blush] = [0, 0, 0, 1, 2, 3, 4, 5][R(8)];
  lk[SPC.LI.cloth] = R(SPC.LOOK_N[SPC.LI.cloth]);
  if (Math.random() < 0.4) lk[SPC.LI.acc] = 1 + R(SPC.LOOK_N[SPC.LI.acc] - 1);
  if (Math.random() < 0.3) lk[SPC.LI.eyeC] = 1 + R(SPC.LOOK_N[SPC.LI.eyeC] - 1);
  if (!lk[SPC.LI.pat] && Math.random() < 0.4) lk[SPC.LI.pat] = [1, 2, 3, 4, 7, 8, 9][R(7)];
  return lk;
}

// ───────────────────────────── the editor ─────────────────────────────

/**
 * Build the tabbed editor into `box`. `get()` returns the look being edited (a full
 * list), `set(look)` takes a changed one. Returns { refresh, random }.
 */
export function editor(box, get, set, onSound) {
  style();
  box.textContent = "";
  const root = el("div", "lk");
  const tabs = el("div", "lk-tabs"), page = el("div", "lk-page");
  root.append(tabs, page);
  box.append(root);
  let tab = 0;
  const change = (look) => { set(SPC.cleanLook(look)); if (onSound) onSound(); render(); };
  SPC.TABS.forEach((name, i) => {
    const b = el("button", i === tab ? "on" : "", name);
    b.type = "button";
    b.addEventListener("click", () => { tab = i; for (const o of tabs.children) o.classList.toggle("on", o === b); if (onSound) onSound(); render(); });
    tabs.append(b);
  });
  /** One part as a grid of face pictures. */
  const grid = (key, view = "front", whole = false) => {
    const i = SPC.LI[key], p = SPC.PARTS[i], look = SPC.cleanLook(get());
    const wrap = el("div");
    const lab = el("div", "lk-lab"); lab.append(el("span", "", p.label), el("b", "", p.names[look[i]]));
    const gr = el("div", "lk-grid");
    for (let v = 0; v < p.names.length; v++) {
      const l = look.slice(); l[i] = v;
      const b = el("button", "lk-thumb" + (v === look[i] ? " on" : ""));
      b.type = "button"; b.title = p.names[v];
      b.append(thumb(l, view, whole));
      b.addEventListener("click", () => change(l));
      gr.append(b);
    }
    wrap.append(lab, gr);
    return wrap;
  };
  /** One part as colour swatches (the first may be "none" / "automatic"). */
  const swatches = (key, none) => {
    const i = SPC.LI[key], p = SPC.PARTS[i], look = SPC.cleanLook(get());
    const wrap = el("div");
    const lab = el("div", "lk-lab"); lab.append(el("span", "", p.label), el("b", "", p.colors[look[i]] ? "" : none));
    const sw = el("div", "lk-sw");
    p.colors.forEach((c, v) => {
      const b = el("button", (v === look[i] ? "on" : "") + (c ? "" : " none"));
      b.type = "button";
      if (c) b.style.background = c; else b.title = none;
      b.addEventListener("click", () => { const l = look.slice(); l[i] = v; change(l); });
      sw.append(b);
    });
    wrap.append(lab, sw);
    return wrap;
  };
  function render() {
    page.textContent = "";
    const look = SPC.cleanLook(get());
    if (tab === 0) {
      // the animals, each with its own ears, nose and tail; then ready-made looks
      const lab = el("div", "lk-lab"); lab.append(el("span", "", "동물"), el("b", "", SPC.SPECIES[look[SPC.LI.sp]].name));
      const gr = el("div", "lk-grid");
      SPC.SPECIES.forEach((s, v) => {
        const l = SPC.withSpecies(look, v);
        const b = el("button", "lk-thumb wide" + (v === look[SPC.LI.sp] ? " on" : ""));
        b.type = "button"; b.title = s.name;
        b.append(thumb(l), el("small", "", s.name));
        b.addEventListener("click", () => change(l));
        gr.append(b);
      });
      const lab2 = el("div", "lk-lab"); lab2.append(el("span", "", "추천 모습"));
      const pr = el("div", "lk-grid");
      for (const [name, l] of SPC.PRESETS) {
        const b = el("button", "lk-thumb wide" + (l.join() === look.join() ? " on" : ""));
        b.type = "button"; b.title = name;
        b.append(thumb(SPC.cleanLook(l)), el("small", "", name));
        b.addEventListener("click", () => change(l.slice()));
        pr.append(b);
      }
      page.append(lab, gr, lab2, pr);
    } else if (tab === 1) page.append(grid("eye"), swatches("eyeC", "기본"), grid("nose"), grid("blush"));
    else if (tab === 2) page.append(grid("ear"), grid("tail", "side", true));
    else if (tab === 3) page.append(swatches("fur"), swatches("acc", "자동"));
    else page.append(grid("pat"), swatches("cloth", "없음"));
  }
  render();
  return { refresh: render, random: () => change(randomLook()) };
}

// ───────────────────────────── the mirror ─────────────────────────────

/**
 * The mirror: a button under the portrait in the character window opens an editor
 * with its own little turning figure. `ctx`: { act, look() (current), gold(), town(), cost, toast, sound }.
 */
export function installMirror(ctx) {
  style();
  const portrait = document.querySelector("#w-char .portrait");
  if (!portrait || document.querySelector(".lk-mirror-btn")) return;
  if (getComputedStyle(portrait).position === "static") portrait.style.position = "relative";
  const btn = el("button", "lk-small lk-mirror-btn", "거울");
  btn.type = "button";
  btn.title = `외형 바꾸기 (마을, ${ctx.cost}G)`;
  btn.addEventListener("click", () => open(ctx));
  portrait.append(btn);
}
let mirrorRaf = 0;
function open(ctx) {
  if (document.getElementById("mirror")) return;
  if (ctx.sound) ctx.sound("open");
  let look = SPC.cleanLook(ctx.look());
  const wrap = el("div"); wrap.id = "mirror";
  const fr = el("div", "frame");
  fr.append(el("h2", "", `거울 — 새 모습 (${ctx.cost}G)`));
  const row = el("div", "mr-row");
  const stage = el("canvas", "mr-stage"); stage.width = 48; stage.height = 60;
  const box = el("div"); box.style.flex = "1"; box.style.minWidth = "0";
  row.append(stage, box);
  const msg = el("div", "mr-msg", ctx.town() ? "" : "마을에서만 바꿀 수 있습니다.");
  const btns = el("div", "mr-btns");
  const rnd = el("button", "", "무작위"), ok = el("button", "gold", `바꾸기 ${ctx.cost}G`), no = el("button", "", "닫기");
  btns.append(rnd, ok, no);
  fr.append(row, btns, msg);
  wrap.append(fr);
  document.body.append(wrap);
  const ed = editor(box, () => look, (l) => { look = l; }, () => ctx.sound && ctx.sound("ui"));
  rnd.addEventListener("click", () => ed.random());
  const close = () => { cancelAnimationFrame(mirrorRaf); wrap.remove(); };
  no.addEventListener("click", close);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  ok.addEventListener("click", () => {
    if (!ctx.town()) { msg.textContent = "마을에서만 바꿀 수 있습니다."; return; }
    if (ctx.gold() < ctx.cost) { msg.textContent = `골드가 부족합니다 (${ctx.cost}G)`; return; }
    ctx.act({ t: "look", look });
    close();
  });
  // the figure turns round, steps and breathes
  const g = stage.getContext("2d");
  g.imageSmoothingEnabled = false;
  const tick = (t) => {
    const views = ["front", "side", "back", "side"], k = Math.floor(t / 1200) % 4, v = views[k];
    const f = Math.floor(t / 300) % 4 === 1 ? 2 : Math.floor(t / 300) % 4 === 3 ? 4 : Math.floor(t / 600) % 2;
    const sheet = SP.personSheet(SP.playerLook("warrior", look))[v][f];
    g.clearRect(0, 0, 48, 60);
    g.fillStyle = "rgba(20,24,50,.25)"; g.beginPath(); g.ellipse(24, 54, 12, 3, 0, 0, 7); g.fill();
    g.save();
    if (k === 3) { g.translate(48, 0); g.scale(-1, 1); }
    g.drawImage(sheet, 4, 2, 24, 28, 0, 0, 48, 56);
    g.restore();
    mirrorRaf = requestAnimationFrame(tick);
  };
  mirrorRaf = requestAnimationFrame(tick);
}
