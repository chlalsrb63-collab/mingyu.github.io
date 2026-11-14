/**
 * Shared bits of the editor page: DOM helpers, the server API, toasts and dialogs, the
 * loaded tables (palette, defs, map list) and small pictures drawn by the game's own art
 * modules (monster icons from mobart.js, item icons from art.js, NPC faces from sprites.js).
 */
import * as MA from "/public/mobart.js";
import * as SP from "/public/sprites.js";
import * as Art from "/public/art.js";
import * as UI from "/public/uiicons.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
/** el("div.cls", {title, onclick, …}, children…) */
export function el(tag, props, ...kids) {
  const [t, ...cls] = tag.split(".");
  const e = document.createElement(t || "div");
  if (cls.length) e.className = cls.join(" ");
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "style") e.style.cssText = v;
    else if (k in e && k !== "list") { try { e[k] = v; } catch { e.setAttribute(k, v); } }
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
export const icon = (name, color) => UI.iconImg(name, color);

// ───────────────────────────── server ─────────────────────────────
export async function api(path, opts = {}) {
  const init = { method: opts.method || "GET", headers: {} };
  if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers["content-type"] = "application/json"; }
  let r;
  try { r = await fetch(path, init); } catch { throw Object.assign(new Error("에디터 서버에 연결할 수 없어요. EDITOR.bat 창이 켜져 있는지 보세요."), { offline: true }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `요청 실패 (${r.status})`), { data: j, status: r.status });
  return j;
}

// ───────────────────────────── toasts and dialogs ─────────────────────────────
export function toast(msg, kind = "") {
  const t = el("div.toast" + (kind ? "." + kind : ""), null, msg);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), kind === "bad" ? 5200 : 2600);
}
/** A modal; resolves with the value of the button pressed (Esc / outside = null). */
export function dialog(title, body, buttons = [["확인", true, "gold"]], opts = {}) {
  return new Promise((done) => {
    const m = $("#modal");
    m.classList.toggle("wide", !!opts.wide);
    $("#dlg-title").textContent = title;
    const b = $("#dlg-body");
    b.textContent = "";
    if (typeof body === "string") b.append(el("p", null, body)); else b.append(body);
    const btns = $("#dlg-btns");
    btns.textContent = "";
    const close = (v) => { m.hidden = true; document.removeEventListener("keydown", key, true); done(v); };
    const key = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(null); }
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); e.stopPropagation(); close(typeof opts.enter === "function" ? opts.enter() : buttons[0][1]); }
    };
    for (const [label, val, cls] of buttons) btns.append(el("button.btn" + (cls ? "." + cls : ""), { type: "button", onclick: () => close(typeof val === "function" ? val() : val) }, label));
    m.onclick = (e) => { if (e.target === m) close(null); };
    document.addEventListener("keydown", key, true);
    m.hidden = false;
    const f = b.querySelector("input, select, textarea") || btns.querySelector("button");
    if (f) setTimeout(() => f.focus(), 0);
  });
}
export const confirmBox = (title, msg, yes = "예", danger = false) => dialog(title, msg, [[yes, true, danger ? "red" : "gold"], ["아니오", false]]).then((v) => v === true);
/** Ask for one line of text. */
export async function ask(title, label, value = "", hint = "") {
  const inp = el("input.inp", { type: "text", value, style: "width:100%" });
  const body = el("div", null, el("p", null, label), inp, hint ? el("p.hint", null, hint) : null);
  const v = await dialog(title, body, [["확인", () => inp.value, "gold"], ["취소", null]], { enter: () => inp.value });
  return v == null ? null : String(v).trim();
}

// ───────────────────────────── tables from the server ─────────────────────────────
export const DB = { palette: null, pg: {}, po: {}, defs: null, maps: [], status: null };
export async function loadTables() {
  const [palette, defs, maps, status] = await Promise.all([api("/api/palette"), api("/api/defs"), api("/api/maps"), api("/api/status").catch(() => null)]);
  DB.palette = palette; DB.defs = defs; DB.maps = maps; DB.status = status;
  DB.pg = Object.fromEntries(palette.ground.map((p) => [p.ch, p]));
  DB.po = Object.fromEntries(palette.objects.map((p) => [p.ch, p]));
}
export async function reloadMaps() { DB.maps = await api("/api/maps"); return DB.maps; }
export const mapName = (id) => { const m = DB.maps.find((x) => x.id === id); return m ? m.name : id; };
export const mobName = (k) => (DB.defs.mobs[k] ? DB.defs.mobs[k].name : k);
export const itemName = (k) => (DB.defs.items[k] ? DB.defs.items[k].name : k);
/** Monsters a player meets in the field (no chests), sorted by level. */
export const fieldMobs = () => Object.entries(DB.defs.mobs).filter(([, m]) => !m.chest).sort((a, b) => a[1].lv - b[1].lv || a[0].localeCompare(b[0]));
export const ROLE_KO = { talk: "대화", quest: "퀘스트 의뢰", shop: "상점", smith: "대장장이", train: "수련관", bank: "창고", warp: "이동술사", daily: "일일 과제", collector: "도감 학자", achieve: "업적 기록관", costume: "의상실", elder: "관리자", guard: "경비" };
export const THEME_KO = { interior: "실내 (건물 안)", town: "마을", meadow: "초원", forest: "숲", crypt: "지하묘지", city: "도시", sewer: "하수도", cave: "동굴", abyss: "심연" };
export const BGM_KO = { town: "마을", field: "들판", meadow: "초원", forest: "숲", city: "도시", cave: "동굴", crypt: "지하묘지", sewer: "하수도", abyss: "심연", boss: "보스", rift: "균열", title: "타이틀" };

/** The (ground) context used by validate.js. */
export function checkCtx(extraMaps = {}) {
  const maps = {};
  for (const m of DB.maps) {
    maps[m.id] = { w: m.w, h: m.h, builtin: m.builtin };
    if (m.file && m.file !== m.id) maps[m.file] = maps[m.id];   // a replacement file's own id is an alias
  }
  Object.assign(maps, extraMaps);
  return { palette: DB.palette, defs: DB.defs, maps, builtin: DB.maps.filter((m) => m.builtin).map((m) => m.id) };
}

// ───────────────────────────── pictures ─────────────────────────────
const mobUrl = new Map();
/** A monster's portrait as a data URL (null if the art has none). */
export function mobIcon(k) {
  if (mobUrl.has(k)) return mobUrl.get(k);
  const d = DB.defs.mobs[k] || {};
  let url = null;
  try {
    const kind = d.sp || k;
    if (MA.has(kind)) url = MA.icon(kind, d.tint || undefined).toDataURL();
    else { const s = SP.monsterSheet(kind, d.tint); const f = s && (s.front ? s.front[0] : s[0]); if (f && f.toDataURL) url = f.toDataURL(); }
  } catch { url = null; }
  mobUrl.set(k, url);
  return url;
}
export function mobImg(k, size = 32) {
  const u = mobIcon(k);
  if (u) return el("img", { src: u, alt: "", width: size, height: size, style: `width:${size}px;height:${size}px;object-fit:contain` });
  return el("span.sw", { style: `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;background:#5a2a34` }, "?");
}
let itemIcons = null;
/** Item icon data URL (built by art.js buildIcons from the defs; missing fields → a plain chip). */
export function itemIcon(id) {
  if (!itemIcons) {
    itemIcons = {};
    const items = {};
    for (const [k, it] of Object.entries(DB.defs.items)) {
      const gear = ["weapon", "armor", "helm", "gloves", "boots", "ring", "amulet"].includes(it.type);
      if (gear && it.tier == null) continue;
      if (it.type === "weapon" && !it.wk) continue;
      if (it.type === "rune" && !it.rune) continue;
      items[k] = it;
    }
    try { itemIcons = Art.buildIcons(items).url; } catch (e) { console.warn("item icons", e); }
  }
  return itemIcons[id] || null;
}
export function itemImg(id, size = 24) {
  const u = itemIcon(id);
  if (u) return el("img", { src: u, alt: "", style: `width:${size}px;height:${size}px` });
  const t = (DB.defs.items[id] || {}).type || "?";
  return el("span.sw", { title: t, style: `width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;background:#3a4a6a;font-size:10px` }, t.slice(0, 2));
}
/** Is this a full player look (species.js) rather than the old 4-value NPC look? */
export const fullLook = (look) => Array.isArray(look) && look.length >= 7 && look.every((v) => Number.isInteger(v));
/** A canvas of an NPC standing, as the game draws it. */
export function npcCanvas(n, scale = 2) {
  const c = document.createElement("canvas");
  c.width = c.height = 32 * scale;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  try {
    const o = fullLook(n.look) ? SP.playerLook("warrior", n.look) : SP.npcLook(n.look, n.role);
    const f = SP.personSheet(o).front[0];
    g.drawImage(f, 0, 0, 32 * scale, 32 * scale);
  } catch (e) { g.fillStyle = "#c88"; g.fillRect(8 * scale, 8 * scale, 16 * scale, 20 * scale); }
  return c;
}
const npcUrl = new Map();
export function npcIcon(n) {
  const key = JSON.stringify([n.look, n.role]);
  if (!npcUrl.has(key)) npcUrl.set(key, npcCanvas(n, 1).toDataURL());
  return npcUrl.get(key);
}

// ───────────────────────────── a popup picker ─────────────────────────────
/**
 * A floating grid of choices next to `anchor`; resolves with the chosen key or null.
 * entries: [{ key, label, sub, img: () => Node }]
 */
export function pickFrom(anchor, title, entries, current) {
  return new Promise((done) => {
    document.querySelectorAll(".picker-pop").forEach((p) => p.remove());
    const box = el("div.picker-pop.gba");
    const search = el("input.inp", { placeholder: "찾기", style: "margin-bottom:4px" });
    const grid = el("div.mobpick");
    const close = (v) => { box.remove(); document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", esc, true); done(v); };
    const out = (e) => { if (!box.contains(e.target)) close(null); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } };
    const draw = () => {
      grid.textContent = "";
      const q = search.value.trim().toLowerCase();
      for (const en of entries) {
        if (q && !(en.label + " " + en.key + " " + (en.sub || "")).toLowerCase().includes(q)) continue;
        grid.append(el("button" + (en.key === current ? ".on" : ""), { type: "button", title: `${en.label} (${en.key})`, onclick: () => close(en.key) }, en.img ? en.img() : null, el("span", null, en.label), en.sub ? el("small", null, en.sub) : null));
      }
    };
    search.addEventListener("input", draw);
    box.append(el("h3.ttl", null, title), search, grid);
    document.body.append(box);
    const r = anchor.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(innerWidth - 440, r.left - 100)) + "px";
    box.style.top = Math.max(50, Math.min(innerHeight - box.offsetHeight - 8, r.bottom + 4)) + "px";
    draw();
    setTimeout(() => { document.addEventListener("mousedown", out, true); document.addEventListener("keydown", esc, true); search.focus(); }, 0);
  });
}
export const mobEntries = (all = false) => (all ? Object.entries(DB.defs.mobs).sort((a, b) => a[1].lv - b[1].lv) : fieldMobs())
  .map(([k, m]) => ({ key: k, label: m.name, sub: `Lv.${m.lv}${m.boss ? " 보스" : ""}`, img: () => mobImg(k) }));
export const itemEntries = () => Object.entries(DB.defs.items).map(([k, it]) => ({ key: k, label: it.name, sub: it.type, img: () => itemImg(k, 32) }));

/** Markdown-ish text → a small block (headings, lists, code), for README help. */
export function textBlock(md) { return el("pre", null, md); }
