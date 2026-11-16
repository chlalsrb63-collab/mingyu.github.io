/**
 * The wardrobe in the browser: the costume shop's window (의상실), the 외형 tab of
 * the character window (what is worn, everything owned, and what is still to be
 * found and where), the try-on preview, and turning the wire's outfit codes into
 * what sprites.js and weapons.js draw. The rules live on the server (logic.js,
 * cos_buy / cos_eq / cos_off, and at 루루's cos_dye / cos_sew); this only asks.
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
.wr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 4px; margin-top: 6px; max-height: 230px; overflow-y: auto; padding-right: 2px; }
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
.wr-tip .set { color: #9ad0c0; font-size: 11px; }
.wr-set { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin: 6px 0 2px; padding: 1px 4px; font-size: 11px; font-weight: 700; color: var(--gold, #e2c486); border-bottom: 1px solid rgba(255,255,255,.12); }
.wr-set:first-child { margin-top: 0; }
.wr-set small { font-weight: 400; color: var(--muted, #aaa); }
.wr-set.full small { color: #7ad08a; }
.wr-dye { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; padding: 5px 6px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 3px; }
.wr-dye .row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.wr-dye .lb { font-size: 11px; font-weight: 700; color: var(--gold, #e2c486); margin-right: 2px; }
.wr-dye .sw { width: 18px; height: 18px; padding: 0; border: 1px solid #000; border-radius: 2px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); }
.wr-dye .sw.off { opacity: .3; cursor: default; }
.wr-dye .sw.on { outline: 1px solid var(--gold, #e2c486); outline-offset: 1px; }
.wr-dye .sw.sel { outline: 2px solid #fff; outline-offset: 1px; }
.wr-dye button.tx { padding: 1px 6px; font-size: 11px; color: var(--muted, #aaa); background: rgba(255,255,255,.04); border: 1px solid #000; border-radius: 3px; cursor: pointer; }
.wr-dye button.tx.on { color: var(--gold, #e2c486); box-shadow: inset 0 0 0 1px var(--line-hi, #8a7a5a); }
.wr-dye button.tx:disabled { opacity: .4; cursor: default; }
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
  <div class="wr-dye" id="wr-dye"></div>
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

/**
 * What a who row's outfit codes and weapon key become in a person's gear: cos ids, a weapon-skin motif, the
 * legendary/set key, and `dye` { id: 1–6 } only when a worn piece is dyed (a code ≥ defs.cosDyeK carries its dye).
 */
export function wireGear(defs, codes, wl) {
  const K = defs.cosDyeK || 1000, ids = [], dye = {};
  for (const c of Array.isArray(codes) ? codes : []) {
    const id = c && defs.cosN ? defs.cosN[c % K] : null;
    if (!id) continue;
    ids.push(id);
    if (c >= K) dye[id] = Math.floor(c / K);
  }
  const skin = ids.find((id) => WR.skinMotif(id));
  const out = { cos: ids.filter((id) => !WR.skinMotif(id)), ws: skin ? WR.skinMotif(skin) : "", wl: wl || "" };
  if (Object.keys(dye).length) out.dye = dye;
  return out;
}
/** A worn piece's wire code with the player's own dye on it (the preview draws what others will see). */
const codeOf = (D, s, id) => D.cos[id].n + (D.cosDyeK || 1000) * ((s.cosDye && s.cosDye[id]) || 0);

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
export function iconCanvas(id) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  if (id) g.drawImage(iconOf(id), 0, 0);
  return c;
}
/** A sewn piece's source: the keepsake 루루 sews it from (defs.keepSew). */
function sewText(d) {
  const D = C.G.defs, k = Object.keys(D.keepSew || {}).find((k) => D.keepSew[k] && D.cos[D.keepSew[k]] === d);
  return k ? `이야기 기념품 [${D.items[k].name}] — 루루에게 재봉 맡기기` : "루루의 기념품 재봉";
}
/** A 장날 piece's source: the season whose stall sells it and its price (defs.fair.shop). */
function fairText(d) {
  const F = C.G.defs.fair, id = Object.keys(C.G.defs.cos).find((k) => C.G.defs.cos[k] === d);
  const s = F ? F.shop.findIndex((rows) => rows.some((r) => r[0] === id)) : -1;
  return s < 0 ? "버드나무 장날 장터" : `${F.season[s]} 장날 — 장꾼 다래에게 장날 토큰 ${F.shop[s].find((r) => r[0] === id)[1]}개 (철이 지나면 장날 저녁 옷 장수 나리에게서 골드로)`;
}
function srcText(d) {
  const ach = d.src === "ach" && C.G.defs.achievements.find((a) => a.id === d.ach);
  return {
    shop: `의상실에서 ${d.price.toLocaleString()}G`, chest: "보물 상자를 열면 가끔", boss: "사냥터 우두머리·던전 수문장이 가끔",
    token: `의상실에서 버드나무토큰 ${d.price.toLocaleString()}개`, rareBoss: "우두머리 토벌 시 매우 낮은 확률로 미보유 희귀 외형 한 점 획득",
    daily: "일일 과제 보상 상자", rift: "균열 침공 1위 (3위 안이면 가끔)",
    ach: ach ? `${ach.desc} (업적 「${ach.name}」)` : `업적 「${d.ach}」 달성`,
    quest: "의뢰·퀘스트를 마치면 가끔", weekly: "주간 보스 도전 큰 보상에서 가끔", sew: sewText(d), fair: fairText(d),
  }[d.src] || "";
}
/** The catalogue in groups: each themed set (in the catalogue's order), then everything that is in no set. */
function groups(ids) {
  const D = C.G.defs, sets = D.cosSets || {};
  const out = Object.keys(sets).map((k) => ({ k, name: sets[k], ids: ids.filter((id) => D.cos[id].set === k) }));
  out.push({ k: "", name: "낱개 외형", ids: ids.filter((id) => !sets[D.cos[id].set]) });
  return out.filter((g) => g.ids.length);
}
/** A group's heading: "세트 · 바닷가" and how much of the whole set is owned. */
function setHead(g, s) {
  const D = C.G.defs;
  if (!g.k) return C.el("div", "wr-set", g.name);
  const all = Object.keys(D.cos).filter((id) => D.cos[id].set === g.k), have = all.filter((id) => s.cos.own.includes(id)).length;
  const h = C.el("div", "wr-set" + (have === all.length ? " full" : ""), `세트 · ${g.name}`);
  h.append(C.el("small", "", `${have} / ${all.length}${have === all.length ? " 완성" : ""}`));
  return h;
}
function tipFor(id, host, extra) {
  const D = C.G.defs, d = D.cos[id], s = C.G.self, own = s.cos.own.includes(id);
  host.classList.add("wr-tip");
  const nm = C.el("div", "nm", d.name);
  nm.style.color = RARITY_COL[d.q];
  host.append(nm, C.el("div", "rar", `${d.q === 4 ? "세트" : D.rarity[d.q]} 외형 · ${D.cosSlotName[d.slot]}`), C.el("div", "ds", d.desc));
  if (d.set && D.cosSets && D.cosSets[d.set]) host.append(C.el("div", "set", `세트 · ${D.cosSets[d.set]}`));
  host.append(C.el("div", "src", own ? (s.cos.on[d.slot] === id ? "입고 있음" : "보유 중") : `얻는 곳: ${srcText(d)}`));
  if (extra) host.append(C.el("div", "hint", extra));
}

// ───────────────────────────── preview ─────────────────────────────

let tried = null;      // an id being tried on
let dyeSlot = "", dyeTry = null;   // at 루루's: the worn slot being dyed, and a dye (0–6) picked to try before paying
let spin = 0, spinAt = 0;
/** Draw the player in `cos` (ids) into a preview canvas: turning, walking, the weapon beside. */
function drawPreview(cv, t) {
  const G = C.G, w = G.who.get(G.you), s = G.self;
  if (!w || !s || !cv || cv.offsetParent === null) return;
  const worn = SLOTS.map((k) => s.cos.on[k]).filter(Boolean);
  if (tried) { const sl = G.defs.cos[tried].slot; for (let i = worn.length - 1; i >= 0; i--) if (G.defs.cos[worn[i]].slot === sl) worn.splice(i, 1); worn.push(tried); }
  // at 루루's a dye picked but not yet paid for shows on the piece it is for
  const trying = cv.id === "wr-shop-pv" && dyeTry !== null ? s.cos.on[dyeSlot] : null;
  const codes = worn.map((id) => (id === trying ? G.defs.cos[id].n + (G.defs.cosDyeK || 1000) * dyeTry : codeOf(G.defs, s, id)));
  const gear = { ...(w.gear || {}), dye: undefined, ...wireGear(G.defs, codes, w.gear && w.gear.wl) };
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
  SP.drawPersonCrop(g, sheet[v][fr], 4, 4, 24, 26, 15, 0, 120, 130);
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
const key = { shop: "", tab: "", dye: "" };
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
  const tokens = s.cos.tokens || 0;
  slotBar($("#wr-shop-slots"), shopSlot, (k) => { shopSlot = k; });
  $("#wr-shop-hint").textContent = `보유 골드 ${s.gold.toLocaleString()}G · 버드나무토큰 ${tokens.toLocaleString()}개. 토큰은 게시판 알바와 협동 근무로 얻습니다.`;
  list.textContent = "";
  for (const g of groups(Object.keys(D.cos).filter((id) => ["shop", "token"].includes(D.cos[id].src) && (shopSlot === "all" || D.cos[id].slot === shopSlot)))) {
   list.append(setHead(g, s));
   for (const id of g.ids) {
    const d = D.cos[id];
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
      const byToken = d.src === "token";
      const b = C.el("button", "", `${d.price.toLocaleString()}${byToken ? " 토큰" : "G"}`);
      b.disabled = (byToken ? tokens : s.gold) < d.price;
      b.addEventListener("click", (e) => { e.stopPropagation(); C.act({ t: "cos_buy", id }); Sound.play("coin"); tried = null; });
      row.append(b);
    }
    row.addEventListener("click", () => { tried = tried === id ? null : id; key.shop = ""; Sound.play("ui"); refresh(C.G.self); });
    C.hoverTip(ic, (h) => tipFor(id, h, own ? "" : "눌러서 입어 보기"));
    list.append(row);
   }
  }
}
/** How many of a bag item the player holds (dyes never go in the 재료 주머니). */
const held = (s, id) => (s.inv || []).reduce((n, x) => n + (x && x.id === id ? x.n || 1 : 0), 0);
/**
 * 루루's dye row (P9): pick a worn piece, pick a dye to see it on the preview, then pay one dye; 원래대로 is free.
 * Below it, keepsakes 루루 can sew into their outfit piece (the keepsake stays).
 */
function renderDye(s) {
  const D = C.G.defs, host = $("#wr-dye"), dyes = D.cosDyes || [], mine = s.cosDye || {};
  host.textContent = "";
  const slots = SLOTS.filter((k) => k !== "wskin" && s.cos.on[k]);
  if (!slots.includes(dyeSlot)) { dyeSlot = slots[0] || ""; dyeTry = null; }
  const top = C.el("div", "row");
  top.append(C.el("span", "lb", "염색"));
  host.append(top);
  if (!dyeSlot) { top.append(C.el("span", "wr-hint", "모자·상의·등·얼굴 외형을 입으면 장식 색을 물들일 수 있어요.")); }
  else {
    for (const k of slots) {
      const b = C.el("button", "tx" + (k === dyeSlot ? " on" : ""), D.cosSlotName[k]);
      b.title = D.cos[s.cos.on[k]].name;
      b.addEventListener("click", () => { dyeSlot = k; dyeTry = null; key.dye = ""; Sound.play("ui"); refresh(C.G.self); });
      top.append(b);
    }
    const id = s.cos.on[dyeSlot], now = mine[id] || 0, row = C.el("div", "row");
    dyes.forEach((did, i) => {
      const d = i + 1, n = held(s, did), it = D.items[did], r = D.life.recipes.find((x) => x.out[0] === did);
      const sw = C.el("button", "sw" + (n ? "" : " off") + (now === d ? " on" : "") + (dyeTry === d ? " sel" : ""));
      sw.style.background = WR.DYES[i];
      sw.setAttribute("aria-label", it.name);
      sw.setAttribute("aria-disabled", String(!n));
      sw.addEventListener("click", () => { if (!n || now === d) return; dyeTry = dyeTry === d ? null : d; key.dye = ""; Sound.play("ui"); refresh(C.G.self); });
      C.hoverTip(sw, (h) => {
        h.append(C.el("div", "nm", it.name), C.el("div", "ds", n ? `${n}개 가지고 있어요` : "가지고 있지 않아요"));
        h.append(C.el("div", "hint", now === d ? "지금 이 색이에요" : n ? "눌러서 미리 보기" : r ? `연금 Lv.${r.lv} · 보글의 가마솥에서 만들어요` : ""));
      });
      row.append(sw);
    });
    const reset = C.el("button", "tx", "원래대로");
    reset.disabled = !now;
    reset.title = now ? "원래 색으로 되돌립니다 (무료)" : "이미 원래 색이에요";
    reset.addEventListener("click", () => { C.act({ t: "cos_dye", id, d: 0 }); dyeTry = null; Sound.play("ui"); });
    const go = C.el("button", "tx", dyeTry ? `물들이기 (${D.items[dyes[dyeTry - 1]].name} 1개)` : "물들이기");
    go.disabled = !dyeTry;
    go.addEventListener("click", () => { if (!dyeTry) return; C.act({ t: "cos_dye", id, d: dyeTry }); dyeTry = null; Sound.play("coin"); });
    row.append(reset, go);
    host.append(row);
  }
  // 기념품 재봉: a keepsake with its piece drawn and not yet owned
  const keep = (s.keep || []).filter((k) => D.keepSew && Object.hasOwn(D.keepSew, k));
  const sewable = keep.filter((k) => D.keepSew[k] && !s.cos.own.includes(D.keepSew[k]));
  if (sewable.length) {
    const row = C.el("div", "row");
    row.append(C.el("span", "lb", "재봉"));
    for (const k of sewable) {
      const b = C.el("button", "tx", `${D.items[k].name} → ${D.cos[D.keepSew[k]].name}`);
      b.addEventListener("click", () => { C.act({ t: "cos_sew", k }); Sound.play("ui"); });
      row.append(b);
    }
    host.append(row);
  } else if (keep.some((k) => !D.keepSew[k])) host.append(C.el("div", "wr-hint", "기념품 재봉: 루루가 이야기 기념품의 옷본을 그리고 있어요. 조금만 기다려 주세요!"));
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
  $("#wr-count").textContent = `모은 외형 ${have.length} / ${ids.length} · 버드나무토큰 ${(s.cos.tokens || 0).toLocaleString()}개`;
  const grid = $("#wr-grid");
  grid.textContent = "";
  // set by set; inside each, owned first, then the rest by rarity: a collection to fill
  for (const g of groups(ids)) {
   grid.append(setHead(g, s));
   const order = [...g.ids.filter((id) => s.cos.own.includes(id)), ...g.ids.filter((id) => !s.cos.own.includes(id)).sort((a, b) => D.cos[a].q - D.cos[b].q)];
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
}

/** Called from client.js's UI refresh: redraws what is visible and has changed. */
export function refresh(s) {
  if (!C || !s || !s.cos) return;
  if (!shopWin.hidden) {
    const k = JSON.stringify([s.gold, s.cos, shopSlot, tried]);
    if (k !== key.shop) { key.shop = k; renderShop(s); }
    const dk = JSON.stringify([s.cos.on, s.cosDye, s.keep, s.cos.own.length, (C.G.defs.cosDyes || []).map((id) => held(s, id)), dyeSlot, dyeTry]);
    if (dk !== key.dye) { key.dye = dk; renderDye(s); }
  } else { key.shop = key.dye = ""; dyeTry = null; }
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
