/**
 * The wardrobe in the browser: the costume shop's window (의상실), the 외형 tab of
 * the character window (what is worn, everything owned, and what is still to be
 * found and where), the try-on preview, and turning the wire's outfit codes into
 * what sprites.js and weapons.js draw. The rules live on the server (logic.js,
 * cos_buy / cos_eq / cos_off); this only asks.
 *
 * client.js calls `init` once, `refresh` from its UI refresh, and `wireGear` when
 * it reads the who list. The markup is built here, at import time, so the
 * window is in place before client.js wires up its windows.
 */
import * as SP from "./sprites.js";
import * as WR from "./wardrobe.js";
import * as WPN from "./weapons.js";
import { RARITY_COL } from "./art.js";
import { Sound } from "./audio.js";

const $ = (s) => document.querySelector(s);
let C = null;

// ───────────────────────────── markup ─────────────────────────────

const css = document.createElement("style");
css.textContent = `
#w-costume { width: 470px; }
.wr-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.wr-tabs button { flex: 1; padding: 4px 0; font-size: 12px; font-weight: 700; color: var(--muted, #aaa); background: rgba(255,255,255,.04); border: 1px solid #000; border-radius: 3px; cursor: pointer; }
.wr-tabs button.on { color: var(--gold, #e2c486); box-shadow: inset 0 0 0 1px var(--line-hi, #8a7a5a); background: rgba(255,255,255,.09); }
.wr-slots { display: flex; gap: 4px; flex-wrap: wrap; }
.wr-slots button { padding: 2px 7px; font-size: 11px; color: var(--muted, #aaa); background: rgba(255,255,255,.04); border: 1px solid #000; border-radius: 3px; cursor: pointer; }
.wr-slots button.on { color: var(--gold, #e2c486); box-shadow: inset 0 0 0 1px var(--line-hi, #8a7a5a); }
.wr-top { display: flex; gap: 10px; align-items: flex-start; }
.wr-pv { width: 150px; height: 150px; flex: none; image-rendering: pixelated; border: 1px solid #000; border-radius: 3px; background: #5e8a50; cursor: pointer; }
.wr-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.wr-worn { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.wr-worn .ws { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; color: var(--muted, #aaa); cursor: pointer; }
.wr-worn .ws canvas, .wr-grid canvas, #w-costume .list canvas { width: 32px; height: 32px; image-rendering: pixelated; background: var(--well, #1a1820); border: 1px solid #000; border-radius: 3px; }
.wr-worn .ws.empty canvas { opacity: .35; }
.wr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 4px; margin-top: 6px; max-height: 190px; overflow-y: auto; padding-right: 2px; }
.wr-grid .c { position: relative; display: flex; justify-content: center; cursor: pointer; }
.wr-grid .c canvas { border-width: 2px; }
.wr-grid .c.lock canvas { filter: grayscale(1) brightness(.45); }
.wr-grid .c.on::after { content: ""; position: absolute; right: 1px; bottom: 1px; width: 8px; height: 8px; background: var(--gold, #e2c486); border: 1px solid #000; border-radius: 2px; }
.wr-grid .c.try canvas { box-shadow: 0 0 0 1px #fff; }
.wr-count { font-size: 11px; color: var(--muted, #aaa); }
.wr-hint { font-size: 11px; color: var(--muted, #aaa); line-height: 1.4; }
#w-costume .list { max-height: 300px; overflow-y: auto; margin-top: 6px; }
#w-costume .list .it.try { box-shadow: inset 0 0 0 1px var(--line-hi, #8a7a5a); }
#w-costume .list .it .own { font-size: 11px; color: #7ad08a; font-weight: 700; padding: 0 4px; }
.wr-tip .src { margin-top: 3px; color: #e2c486; font-size: 11px; }
`;
document.head.append(css);

const shopWin = document.createElement("section");
shopWin.className = "window";
shopWin.id = "w-costume";
shopWin.hidden = true;
shopWin.innerHTML = `<header><span class="t">의상실 주인 루루</span><button class="x" title="닫기 (Esc)"></button></header>
<div class="body">
  <p class="say">어서 와요! 모자, 옷, 망토, 안경, 무기 외형까지 — 능력치는 그대로, 모습만 바뀌어요. 눌러서 입어 보고 마음에 들면 사세요.</p>
  <div class="wr-top"><canvas class="wr-pv" id="wr-shop-pv" width="150" height="150" title="눌러서 돌려 보기"></canvas>
    <div class="wr-side"><div class="wr-slots" id="wr-shop-slots"></div><div class="wr-hint" id="wr-shop-hint"></div></div></div>
  <div class="list" id="wr-shop-list"></div>
</div>`;
(document.getElementById("windows") || document.body).append(shopWin);

// the character window gets two tabs: gear (as before) and the wardrobe
const charBody = document.querySelector("#w-char .body");
const tabs = document.createElement("div");
tabs.className = "wr-tabs";
tabs.innerHTML = `<button data-t="gear" class="on">장비</button><button data-t="cos">외형</button>`;
const tabBox = document.createElement("div");
tabBox.id = "char-wardrobe";
tabBox.hidden = true;
tabBox.innerHTML = `<div class="wr-top"><canvas class="wr-pv" id="wr-tab-pv" width="150" height="150" title="눌러서 돌려 보기"></canvas>
  <div class="wr-side"><div class="wr-worn" id="wr-worn"></div><div class="wr-hint">입은 칸을 누르면 벗고, 아래에서 고르면 입습니다. 외형은 능력치를 바꾸지 않습니다.</div></div></div>
  <div class="wr-slots" id="wr-tab-slots" style="margin-top:8px"></div><div class="wr-count" id="wr-count"></div><div class="wr-grid" id="wr-grid"></div>`;
if (charBody) { charBody.prepend(tabs); charBody.append(tabBox); }
let tab = "gear";
tabs.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  tab = b.dataset.t;
  for (const x of tabs.children) x.classList.toggle("on", x === b);
  for (const n of charBody.children) if (n !== tabs && n !== tabBox && n.id !== "char-skills") n.hidden = tab === "cos";
  tabBox.hidden = tab !== "cos";
  tried = null;
  key.tab = "";
  Sound.play("ui");
  if (C) refresh(C.G.self);
});

// ───────────────────────────── the wire ─────────────────────────────

/** What a who row's outfit codes and weapon key become in a person's gear: cos ids, a weapon-skin motif, the legendary/set key. */
export function wireGear(defs, codes, wl) {
  const ids = (Array.isArray(codes) ? codes : []).map((n) => (n && defs.cosN ? defs.cosN[n] : null)).filter(Boolean);
  const skin = ids.find((id) => WR.skinMotif(id));
  return { cos: ids.filter((id) => !WR.skinMotif(id)), ws: skin ? WR.skinMotif(skin) : "", wl: wl || "" };
}

// ───────────────────────────── helpers ─────────────────────────────

const SLOTS = WR.SLOTS;
const plainLook = () => SP.playerLook("warrior", [], {});
const iconCache = new Map();
/** A cosmetic's icon: worn by a plain white figure, or (a weapon skin) on a sword. */
function iconOf(id) {
  if (!iconCache.has(id)) {
    const m = WR.skinMotif(id);
    iconCache.set(id, m ? WPN.weaponIcon("sword", 3, { ws: m }) : WR.cosIcon(id, SP.personSheet, plainLook));
  }
  return iconCache.get(id);
}
function iconCanvas(id) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (id) g.drawImage(iconOf(id), 0, 0);
  return c;
}
function srcText(d) {
  const ach = d.src === "ach" && C.G.defs.achievements.find((a) => a.id === d.ach);
  return {
    shop: `의상실에서 ${d.price.toLocaleString()}G`, chest: "보물 상자를 열면 가끔", boss: "사냥터 우두머리·던전 수문장이 가끔",
    daily: "일일 과제 보상 상자", rift: "균열 침공 1위 (3위 안이면 가끔)", ach: `업적 「${ach ? ach.name : d.ach}」 달성`,
  }[d.src] || "";
}
function tipFor(id, host, extra) {
  const D = C.G.defs, d = D.cos[id], s = C.G.self, own = s.cos.own.includes(id);
  host.classList.add("wr-tip");
  const nm = C.el("div", "nm", d.name);
  nm.style.color = RARITY_COL[d.q];
  host.append(nm, C.el("div", "rar", `${D.rarity[d.q]} 외형 · ${D.cosSlotName[d.slot]}`), C.el("div", "ds", d.desc));
  host.append(C.el("div", "src", own ? (s.cos.on[d.slot] === id ? "입고 있음" : "보유 중") : `얻는 곳: ${srcText(d)}`));
  if (extra) host.append(C.el("div", "hint", extra));
}

// ───────────────────────────── preview ─────────────────────────────

let tried = null;      // an id being tried on
let spin = 0, spinAt = 0;
/** Draw the player in `cos` (ids) into a preview canvas: turning, walking, the weapon beside. */
function drawPreview(cv, t) {
  const G = C.G, w = G.who.get(G.you), s = G.self;
  if (!w || !s || !cv || cv.offsetParent === null) return;
  const worn = SLOTS.map((k) => s.cos.on[k]).filter(Boolean);
  if (tried) { const sl = G.defs.cos[tried].slot; for (let i = worn.length - 1; i >= 0; i--) if (G.defs.cos[worn[i]].slot === sl) worn.splice(i, 1); worn.push(tried); }
  const gear = { ...(w.gear || {}), ...wireGear(G.defs, worn.map((id) => G.defs.cos[id].n), w.gear && w.gear.wl) };
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#5e8a50"; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#6c9a5c"; for (let i = 0; i < 7; i++) g.fillRect((i * 37 + 11) % 150, (i * 53 + 20) % 110, 6, 3);
  g.fillStyle = "rgba(20,24,50,.28)"; g.beginPath(); g.ellipse(75, 128, 26, 7, 0, 0, 7); g.fill();
  const views = ["front", "side", "back", "side"], v = views[spin % 4];
  const sheet = SP.personSheet(SP.playerLook(w.cls, w.look, gear));
  const F = SP.FRAME, fr = [F.stepA, F.stretch, F.stepB, F.stretch][Math.floor(t / 180) % 4];
  g.save();
  if (spin % 4 === 3) { g.translate(150, 0); g.scale(-1, 1); }
  g.drawImage(sheet[v][fr], 4, 4, 24, 26, 15, 0, 120, 130);
  g.restore();
  // the weapon in hand, as it is slung, with its skin
  const wk = SP.weaponKind(w.cls, gear), ws = SP.weaponSprite(wk, gear);
  g.save();
  g.translate(118, 104);
  g.rotate(-1.15);
  g.drawImage(ws, -SP.GRIP[0] * 2, -SP.GRIP[1] * 2, ws.width * 2, ws.height * 2);
  g.restore();
}
function loop(t) {
  if (C && C.G.self && C.G.self.cos) {
    if (t - spinAt > 1400) { spin++; spinAt = t; }
    if (!shopWin.hidden) drawPreview($("#wr-shop-pv"), t);
    if (!tabBox.hidden && !$("#w-char").hidden) drawPreview($("#wr-tab-pv"), t);
  }
  requestAnimationFrame(loop);
}
for (const id of ["#wr-shop-pv", "#wr-tab-pv"]) $(id).addEventListener("click", () => { spin++; spinAt = performance.now(); });

// ───────────────────────────── rendering ─────────────────────────────

let shopSlot = "all", tabSlot = "all";
const key = { shop: "", tab: "" };
function slotBar(host, cur, set) {
  host.textContent = "";
  for (const k of ["all", ...SLOTS]) {
    const b = C.el("button", k === cur ? "on" : "", k === "all" ? "전체" : C.G.defs.cosSlotName[k]);
    b.addEventListener("click", () => { set(k); Sound.play("ui"); key.shop = key.tab = ""; refresh(C.G.self); });
    host.append(b);
  }
}
function renderShop(s) {
  const D = C.G.defs, list = $("#wr-shop-list");
  slotBar($("#wr-shop-slots"), shopSlot, (k) => { shopSlot = k; });
  $("#wr-shop-hint").textContent = `가진 골드 ${s.gold.toLocaleString()}G · 상점에 없는 외형은 보물 상자, 우두머리, 일일 과제, 균열 침공, 업적에서 얻습니다.`;
  list.textContent = "";
  for (const id of Object.keys(D.cos)) {
    const d = D.cos[id];
    if (d.src !== "shop" || (shopSlot !== "all" && d.slot !== shopSlot)) continue;
    const own = s.cos.own.includes(id);
    const row = C.el("div", "it" + (tried === id ? " try" : ""));
    const ic = iconCanvas(id);
    const tx = C.el("div", "tx", d.name);
    tx.style.color = RARITY_COL[d.q];
    tx.append(C.el("small", "", `${D.cosSlotName[d.slot]} · ${d.desc}`));
    row.append(ic, tx);
    if (own) {
      row.append(C.el("span", "own", "보유"));
      const b = C.el("button", "", s.cos.on[d.slot] === id ? "입는 중" : "입기");
      b.disabled = s.cos.on[d.slot] === id;
      b.addEventListener("click", (e) => { e.stopPropagation(); C.act({ t: "cos_eq", id }); Sound.play("ui"); });
      row.append(b);
    } else {
      const b = C.el("button", "", `${d.price.toLocaleString()}G`);
      b.disabled = s.gold < d.price;
      b.addEventListener("click", (e) => { e.stopPropagation(); C.act({ t: "cos_buy", id }); Sound.play("coin"); tried = null; });
      row.append(b);
    }
    row.addEventListener("click", () => { tried = tried === id ? null : id; key.shop = ""; Sound.play("ui"); refresh(C.G.self); });
    C.hoverTip(ic, (h) => tipFor(id, h, own ? "" : "눌러서 입어 보기"));
    list.append(row);
  }
}
function renderTab(s) {
  const D = C.G.defs;
  const worn = $("#wr-worn");
  worn.textContent = "";
  for (const k of SLOTS) {
    const id = s.cos.on[k];
    const box = C.el("div", "ws" + (id ? "" : " empty"));
    box.append(iconCanvas(id), C.el("span", "", D.cosSlotName[k]));
    if (id) {
      box.addEventListener("click", () => { C.act({ t: "cos_off", s: k }); Sound.play("ui"); });
      C.hoverTip(box, (h) => tipFor(id, h, "누르면 벗습니다"));
    } else box.title = `${D.cosSlotName[k]} — 비어 있음`;
    worn.append(box);
  }
  slotBar($("#wr-tab-slots"), tabSlot, (k) => { tabSlot = k; });
  const ids = Object.keys(D.cos).filter((id) => tabSlot === "all" || D.cos[id].slot === tabSlot);
  const have = ids.filter((id) => s.cos.own.includes(id));
  $("#wr-count").textContent = `모은 외형 ${have.length} / ${ids.length}`;
  const grid = $("#wr-grid");
  grid.textContent = "";
  // owned first, then the rest by rarity: a collection to fill
  const order = [...have, ...ids.filter((id) => !s.cos.own.includes(id)).sort((a, b) => D.cos[a].q - D.cos[b].q)];
  for (const id of order) {
    const d = D.cos[id], own = s.cos.own.includes(id), on = s.cos.on[d.slot] === id;
    const c = C.el("div", "c" + (own ? "" : " lock") + (on ? " on" : "") + (tried === id ? " try" : ""));
    const ic = iconCanvas(id);
    ic.style.borderColor = RARITY_COL[d.q];
    c.append(ic);
    c.addEventListener("click", () => {
      if (own) { C.act(on ? { t: "cos_off", s: d.slot } : { t: "cos_eq", id }); tried = null; }
      else { tried = tried === id ? null : id; key.tab = ""; refresh(C.G.self); }
      Sound.play("ui");
    });
    C.hoverTip(c, (h) => tipFor(id, h, own ? (on ? "누르면 벗습니다" : "누르면 입습니다") : "누르면 미리 입어 봅니다"));
    grid.append(c);
  }
}

/** Called from client.js's UI refresh: redraws what is visible and has changed. */
export function refresh(s) {
  if (!C || !s || !s.cos) return;
  if (!shopWin.hidden) {
    const k = JSON.stringify([s.gold, s.cos, shopSlot, tried]);
    if (k !== key.shop) { key.shop = k; renderShop(s); }
  } else key.shop = "";
  if (!tabBox.hidden && !$("#w-char").hidden) {
    const k = JSON.stringify([s.cos, tabSlot, tried]);
    if (k !== key.tab) { key.tab = k; renderTab(s); }
  } else key.tab = "";
  if (shopWin.hidden && tabBox.hidden && tried) tried = null;
}

/** `ctx`: { G, act, el, hoverTip }. */
export function init(ctx) {
  C = ctx;
  requestAnimationFrame(loop);
}
/** Open the wardrobe tab of the character window (after the window itself is open). */
export function showTab() { tabs.querySelector('[data-t="cos"]').click(); }
