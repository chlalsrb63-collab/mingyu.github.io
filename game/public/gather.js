/**
 * Gathering in the browser (L2a; logic 58-life.js, docs/design/life-and-coop.md B.4, B.10, H2). The server decides
 * everything; this draws and asks.
 * - Nodes: `map.nodes = [[kind 0 약초 · 1 광맥 · 2 통나무, grade, tx, ty]…]` (index = id) stand in the world as
 *   scene props (gatherart.js), each drawn spent while it is in this player's `ng` (snapshot) list.
 * - F (or a click on a node) by a node: `act({t:"gat", i})`; events `gs` (pose + channel bar), `gt` (반짝! — tap
 *   now with F / Space / a click on the prompt: `gat_tap`), `ga` (0 done, 1 대성공, −1 broken). Others' `gs`/`ga`
 *   show their pose and a small bar over their head.
 * - The 재료 주머니: `self.pouch = {itemId: n}` → `renderPouch(box, s)` (the bag window and the 생활 window).
 */
import * as GA from "./gatherart.js";
import { K } from "./keymap.js";

const T = 16;
const now = () => performance.now();
let A = null;   // { G, S3, Sound, act, el, iconImg, itemSlot, toast, floatText, stopAuto }
const st = { nodes: [], spent: new Set(), keys: [], near: -1, mine: null, others: new Map(), pend: 0, goal: -1, tapEl: null };

export function init(api) { A = api; window.__gather = st; }   // st exposed for automation (like window.__game)
const G = () => A.G;
const ND = () => (G().defs && G().defs.life && G().defs.life.nodes) || { kinds: ["h", "o", "w"], names: ["약초", "광맥", "통나무"], cd: 300000, ch: 2400, range: 24, tap: 700 };
const spot = (n) => [n[2] * T + 8, n[3] * T + 10];
/** 채집 Lv a node needs: its grade's unlock level (defs.life.grades), a crop its own (defs.life.nodes.crop). */
const needLv = (n) => { const L = G().defs.life, gr = n[0] === 3 ? L && L.nodes.crop : L && L.grades; return (gr && gr[n[1] - 1]) || 1; };
/** A node's name in prompts: the kind, or the crop itself (감자). */
const nodeName = (n) => (n[0] === 3 && (G().defs.items[`m_c${n[1]}`] || {}).name) || ND().names[n[0]];
const myLv = () => { const s = G().self, L = G().defs.life; const i = L ? L.keys.indexOf("gather") : 2; return (s && s.life && s.life[i] && s.life[i][0]) || 1; };
const VERB = ["채집", "채굴", "벌목", "수확"];
export const busy = () => !!(st.mine && now() < st.mine.end + 300);
/** Is node `i` of this map spent for me (the radar dims it)? */
export const spent = (i) => st.spent.has(i);

// ───────────────────────────── the map's nodes ─────────────────────────────

/** A new map: its nodes become props (the old map's go). Called after scene2d's loadMap. */
export function loadMap(m) {
  for (const k of st.keys) A.S3.props.delete(k);
  st.keys = []; st.spent = new Set(); st.near = -1; st.goal = -1; st.others.clear();
  if (st.mine) endMine();
  if (G().cast && G().cast.gat) G().cast = null;      // a channel never crosses a door
  st.nodes = Array.isArray(m.nodes) ? m.nodes : [];
  st.nodes.forEach((n, i) => {
    const [x, y] = spot(n), key = "gn" + i;
    st.keys.push(key);
    A.S3.props.set(key, { x, y, until: Infinity, draw(g, t, sx, sy) { drawNode(g, t, sx, sy, i); } });
  });
}
function drawNode(g, t, sx, sy, i) {
  const n = st.nodes[i], spent = st.spent.has(i), img = GA.nodeSprite(n[0], n[1], spent);
  sx = Math.round(sx); sy = Math.round(sy);
  if (!spent && i === st.near && !busy()) GA.drawReach(g, t, sx, sy);
  // the contact shadow, in the people's tone
  g.fillStyle = "rgba(20,24,50,.26)";
  if (n[0] !== 3) { g.beginPath(); g.ellipse(sx, sy, spent ? 7 : 11, spent ? 3 : 4, 0, 0, 7); g.fill(); }   // (a crop's ridge is its own ground)
  g.drawImage(img, sx - GA.FOOT[0], sy - GA.FOOT[1]);
  const mine = st.mine && st.mine.i === i ? st.mine : null;
  if (mine && mine.tapAt && t < mine.tapEnd) GA.drawGlint(g, sx + 1, sy - 22, true);
  else if (!spent && !mine && (t + i * 977) % 3100 < 150) GA.drawGlint(g, sx - 3 + (i % 3) * 3, sy - 12, false);
  // someone else at this node: a small bar over their head
  for (const [eid, o] of st.others) {
    if (o.i !== i || t > o.end) continue;
    const e = A.entityPos(eid);
    if (!e) continue;
    const [ex, ey] = A.S3.iso(e.x, e.y), [nx, ny] = A.S3.iso(n[2] * T + 8, n[3] * T + 10);
    GA.drawBar(g, sx + ex - nx, sy + ey - ny - 34, (t - o.t0) / (o.end - o.t0), GA.KIND_COL[n[0]]);
  }
}
/** The node in reach for you (ready or not), or −1. */
function nearest() {
  const me = G().me, R = ND().range - 2;
  let best = -1, bd = R;
  st.nodes.forEach((n, i) => { const [x, y] = spot(n), d = Math.hypot(me.x - x, me.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}
/** The node a screen point is on (its sprite or its spot), or −1. */
function nodeAtScreen(cx, cy) {
  const z = Math.max(1, A.S3.project(1, 0)[0] - A.S3.project(0, 0)[0]);   // screen px per iso px (the zoom)
  let best = -1, bd = 1e9;
  st.nodes.forEach((n, i) => {
    const [x, y] = spot(n), [sx, sy] = A.S3.project(x, y);
    if (Math.abs(cx - sx) < 12 * z && cy > sy - 20 * z && cy < sy + 6 * z) { const d = Math.abs(cx - sx) + Math.abs(cy - sy); if (d < bd) { bd = d; best = i; } }
  });
  return best;
}

// ───────────────────────────── the wire ─────────────────────────────

export function onSnap(s) {
  if ("ng" in s) st.spent = new Set(s.ng || []);
}

/** gs / gt / ga; true when the event was ours. */
export function onEvent(e) {
  const k = e[0];
  if (k !== "gs" && k !== "gt" && k !== "ga") return false;
  const eid = e[1], mine = eid === G().you, t = now(), ent = A.entityPos(eid);
  if (k === "gs") {
    const [, , kind, ms] = e;
    const i = ent ? nodeOf(ent, kind) : -1;
    if (ent) ent.gat = { k: kind, t0: t, end: t + ms, fa: faceTo(ent, i) };
    if (mine) {
      st.pend = 0; st.goal = -1;
      G().path = null;
      st.mine = { i, k: kind, t0: t, end: t + ms, tapAt: 0, tapEnd: 0, tapped: false };
      G().cast = { start: t, end: t + ms, name: `${st.nodes[i] ? nodeName(st.nodes[i]) : ND().names[kind]} ${VERB[kind]}`, gat: true };
      A.Sound.play("gat_start", kind);
    } else st.others.set(eid, { i, t0: t, end: t + ms });
    return true;
  }
  if (k === "gt") {
    if (mine && st.mine) { st.mine.tapAt = t; st.mine.tapEnd = t + (e[2] || ND().tap); A.Sound.play("gat_tap"); showTap(true); }
    return true;
  }
  // ga: the channel is over — r 1 대성공, 0 done, −1 broken
  const r = e[3];
  if (ent) ent.gat = null;
  st.others.delete(eid);
  if (mine) {
    const m = st.mine;
    endMine();
    if (r >= 0 && m) {
      if (G().cast && G().cast.gat) G().cast.end = Math.min(G().cast.end, t);
      if (m.i >= 0) { const [x, y] = spot(st.nodes[m.i]); A.S3.fx.burst(x, y, 0.4, GA.KIND_COL[m.k], r ? 12 : 6, 1); }
    } else if (G().cast && G().cast.gat) G().cast = null;
    if (r === 1) { A.floatText("대성공!", G().me.x, G().me.y, 1.9, "#ffe08a", true); A.Sound.play("gat_great"); }
    else if (r === -1) A.Sound.play("gat_break");
  } else if (r === 1 && ent) A.S3.fx.sparkle(ent.x, ent.y, 1, "#ffe08a", 8);
  return true;
}
function endMine() { st.mine = null; showTap(false); }
/** The node a gatherer is working (nearest of that kind within reach). */
function nodeOf(ent, kind) {
  let best = -1, bd = ND().range + 8;
  st.nodes.forEach((n, i) => { if (n[0] !== kind) return; const [x, y] = spot(n), d = Math.hypot(ent.x - x, ent.y - y); if (d < bd) { bd = d; best = i; } });
  return best;
}
function faceTo(ent, i) {
  if (i < 0) return undefined;
  const [x, y] = spot(st.nodes[i]);
  return Math.hypot(x - ent.x, y - ent.y) > 1 ? A.S3.sAng(x - ent.x, y - ent.y) : undefined;
}

// ───────────────────────────── asking ─────────────────────────────

/** Start gathering node i (or say why not, as the server would). */
function start(i) {
  const t = now(), n = st.nodes[i];
  if (!n || busy() || t - st.pend < 600) return false;
  if (st.spent.has(i)) { A.toast("아직 다시 자라지 않았습니다"); return true; }
  const need = needLv(n);
  if (myLv() < need) { A.toast(`채집 레벨이 부족합니다 (Lv.${need} 필요)`); return true; }
  A.stopAuto();
  G().path = null;
  st.pend = t;
  A.act({ t: "gat", i });
  return true;
}
/** One tap while the channel runs (only the first counts on the server, so an early one is a miss). */
function tap() {
  const m = st.mine;
  if (!m || m.tapped) return;
  if (now() - m.t0 < 250) return;          // the press that started it, bouncing
  m.tapped = true;
  A.act({ t: "gat_tap" });
  const hit = m.tapAt && now() <= m.tapEnd + 150;
  A.Sound.play(hit ? "gat_hit" : "ui");
  showTap(false, hit);
}
/** F: while gathering, the tap; otherwise false (actions.js goes on). */
export function interactBusy() { if (!busy()) return false; tap(); return true; }
/** F with nobody to talk to: the node in reach, if any. */
export function interact() { return st.near >= 0 ? start(st.near) : false; }
/** Space (and F) while gathering is the tap, not an attack. */
export function onKey(k) { if (!busy() || (k !== " " && k !== "f" && k !== "ㄹ")) return false; tap(); return true; }
/** A click in the world: on a node, walk to it (and gather on arrival) or gather at once. */
export function onWorldDown(e) {
  if (busy()) { tap(); return true; }
  const i = nodeAtScreen(e.clientX, e.clientY);
  if (i < 0) return false;
  const [x, y] = spot(st.nodes[i]), me = G().me;
  if (Math.hypot(me.x - x, me.y - y) < ND().range - 2) { start(i); return true; }
  const path = A.pathTo(x, y);
  if (!path) return false;
  G().path = path; G().mark = { at: now(), pos: path[path.length - 1] };
  st.goal = i;
  return true;
}
/** The F prompt's text for the node in reach, or "" (update.js shows it when no NPC is near). */
export function label() {
  const i = st.near;
  if (i < 0) return "";
  const n = st.nodes[i], name = nodeName(n);
  if (busy()) return "";                    // the channel bar and the "반짝!" prompt say it
  if (st.spent.has(i)) return `${name} (다시 자라는 중)`;
  const need = needLv(n);
  return myLv() < need ? `${name} (채집 Lv.${need} 필요)` : `${name} ${VERB[n[0]]}`;
}

// ───────────────────────────── each frame ─────────────────────────────

export function tick(t) {
  if (!G().map || !G().playing) return;
  st.near = G().me.dead ? -1 : nearest();
  // walked to a clicked node: start once there
  if (st.goal >= 0 && !G().path) {
    const [x, y] = spot(st.nodes[st.goal] || [0, 0, -99, -99]), me = G().me;
    if (Math.hypot(me.x - x, me.y - y) < ND().range - 2) start(st.goal);
    st.goal = -1;
  }
  const m = st.mine;
  if (m) {
    if (t > m.end + 1500) endMine();      // the server never said: let go
    else if (m.tapAt && t > m.tapEnd + 150 && st.tapEl && !st.tapEl.hidden) showTap(false);
    // the work's rhythm: a chip, a spark or a leaf every beat, and its sound
    const beat = Math.floor((t - m.t0) / 480);
    if (beat !== m.beat && m.i >= 0) {
      m.beat = beat;
      const [x, y] = spot(st.nodes[m.i]);
      A.S3.fx.burst(x, y, 0.35, GA.KIND_COL[m.k], 3, 0.7);
      if (beat > 0) A.Sound.play("gat_work", m.k);
    }
  }
  for (const [eid, o] of st.others) if (t > o.end + 1500) { st.others.delete(eid); const e = A.entityPos(eid); if (e) e.gat = null; }
}
/** The "반짝!" prompt over the channel bar (also a button for touch screens). */
function showTap(on, hit) {
  if (!st.tapEl) {
    const b = document.createElement("button");
    b.id = "gat-tap"; b.hidden = true;
    b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); tap(); });
    (document.querySelector("#hud") || document.body).append(b);
    st.tapEl = b;
  }
  const b = st.tapEl, touch = document.body.classList.contains("touch");
  if (on) { b.textContent = touch ? "반짝! ▶ 누르기" : `반짝!  ${K("interact")} / ${K("dash")}`; b.className = "frame"; b.hidden = false; }
  else if (hit) { b.textContent = "좋아요!"; b.className = "frame good"; setTimeout(() => { if (b.classList.contains("good")) b.hidden = true; }, 500); }
  else b.hidden = true;
}

// ───────────────────────────── the 재료 주머니 ─────────────────────────────

/** Pouch goods in a steady order: herbs, ores, woods by grade, ingots, then the bought goods. */
function pouchOrder(p) {
  const rank = (id) => { const it = G().defs.items[id] || {}; const kind = { h: 0, o: 1, w: 2, c: 3, i: 4 }[it.mk]; return (kind ?? 4) * 10 + (it.grade || 0); };
  return Object.keys(p || {}).filter((id) => p[id] > 0 && G().defs.items[id]).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
}
/** The pouch as a grid of slots with counts, folded under a heading (the fold is remembered). */
export function renderPouch(box, s, opts = {}) {
  const el = A.el, p = s.pouch || {}, ids = pouchOrder(p), D = G().defs.life;
  box.textContent = "";
  const max = (D && D.pouch && D.pouch.max) || 999;
  const key = "lumentale:pouch:" + (opts.where || "inv"), open = localStorage.getItem(key) !== "0";
  const hd = el("button", "pouch-hd" + (open ? " open" : ""));
  hd.append(A.iconImg("bag", "#e2c486"), el("b", "", "재료 주머니"), el("span", "", ids.length ? `${ids.length}종` : "비어 있음"));
  hd.title = `사냥이나 텃밭 수확으로 모은 재료와 주괴, 식재료·빈 병이 가방 칸을 쓰지 않고 이곳에 모입니다 (종류마다 ${max}개까지)`;
  hd.addEventListener("click", () => { localStorage.setItem(key, open ? "0" : "1"); A.Sound.play("ui"); renderPouch(box, s, opts); });
  box.append(hd);
  if (!open) return;
  if (!ids.length) { box.append(el("p", "hint", `사냥터 몬스터에게서 얻은 제작 재료나 버드나무 마을 텃밭에서 수확한 작물이 여기에 쌓입니다.`)); return; }
  const grid = el("div", "grid pouch-grid");
  for (const id of ids) {
    // at a shop: a click sells one, Shift+click all of them (the server checks the counter and the count)
    const sell = opts.sell, each = sell && opts.price ? opts.price(id) : 0;
    const slot = A.itemSlot({ id, n: p[id] }, {
      hint: sell ? "클릭: 1개 판매 · Shift+클릭: 모두 판매" : p[id] >= max ? "가득 찼습니다" : "",
      price: sell ? `판매가 ${each.toLocaleString()}G${p[id] > 1 ? ` (모두 ${(each * p[id]).toLocaleString()}G)` : ""}` : "",
      onClick: sell ? (ev) => { sell(id, ev.shiftKey ? p[id] : 1); A.Sound.play("coin"); } : null,
    });
    if (p[id] >= max) slot.classList.add("full");
    if (p[id] > 99) { const n = slot.querySelector(".n"); if (n) n.textContent = p[id] > 999 ? "999+" : String(p[id]); }
    grid.append(slot);
  }
  box.append(grid);
}
/** What the pouch shows changes when: (for `draw` keys). */
export const pouchKey = (s) => JSON.stringify(s.pouch || {});
