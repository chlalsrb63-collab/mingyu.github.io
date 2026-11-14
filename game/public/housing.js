/**
 * The bag's size and a house of one's own, in the browser (logic 46-bag.js, 64-housing.js).
 * The server decides everything; this draws and asks:
 *   - the bag's [+5칸 가방 확장] bar under the bag grid (bagBar)
 *   - the 하우징 안내인's window (#w-house): buy and enlarge the house, buy furniture, visit a party member's
 *   - inside a house: the top bar (#house-hud), the [집 꾸미기] window (#w-deco) with a ghost of the piece
 *     on the hovered tile (green: it fits, red: why not), and the [집 보관함] window (#w-hstore)
 *   - F next to a chest opens the storage, next to a bed or hearth rests (안락한 휴식)
 *   - the "ho" events: place 0 · pick 1 · turn 2 · storage 3 · style 4 · in 5 · rest 6 (sounds, sparkles)
 * Wire: self.house = [tier, floor, wall, storage cap, storage used, rest cooldown ms, where (0 out ·
 *   1 home · 2 guest), furniture [[uid, id, x, y, dir]…] | 0, storage slots | 0] (both only at home);
 *   map.home / map.fd / map.hf on a house's map; defs.house, defs.bag, defs.inv, defs.invMax.
 */
import { roomPiece } from "./iso_interior.js";

const $ = (s) => document.querySelector(s);
const T = 16;
let A = null;   // { G, S3, Sound, act, el, iconImg, itemSlot, openWin, closeWin, isOpen, draw, hoverTip, toast }
/** The decorating state: the piece in hand (item id), its turn, the hovered tile, the placed piece picked. */
const st = { sel: null, dir: 0, hover: null, pick: 0, ghost: null, prompt: null, mapId: null };

export function init(api) { A = api; window.__house = st; }
const G = () => A.G;
const D = () => G().defs.house;
const H = () => (G().self && G().self.house) || [0, 0, 0, 0, 0, 0, 0, 0, 0];
/** Standing in a house (anyone's), and in one's own. */
export const inHouse = () => !!(G().map && G().map.home);
export const atHome = () => inHouse() && H()[6] === 1;
const gstr = (n) => Math.floor(n).toLocaleString("ko-KR");
const DIRS = ["북", "서", "남", "동"];
const furnList = () => (Array.isArray(H()[7]) ? H()[7] : []);
const fdef = (id) => D().furn[id];
const itemName = (id) => (G().defs.items[id] ? G().defs.items[id].name : id);
const pieceAt = (x, y, floor = false) => furnList().find((f) => f[2] === x && f[3] === y && !fdef(f[1]).floor === !floor);
const near = (x, y, r = 30) => Math.hypot(G().me.x - (x * T + 8), G().me.y - 4 - (y * T + 8)) <= r;

// ───────────────────────────── snapshots and events ─────────────────────────────

export function onSnap(s) {
  if (s.map) {
    if (st.mapId !== s.map.id) { st.sel = null; st.pick = 0; st.hover = null; }
    st.mapId = s.map.id;
    if (!s.map.home) { A.closeWin("deco"); A.closeWin("hstore"); }
    st.ghost = null;
  }
  if (s.map || s.self) hud();
  if (!atHome() && (A.isOpen("deco") || A.isOpen("hstore"))) { A.closeWin("deco"); A.closeWin("hstore"); }
  syncProps();
}
export function onEvent(e) {
  if (e[0] !== "ho") return false;
  const [, eid, k, x, y] = e, mine = eid === G().you, S3 = A.S3;
  if (k === 0) { A.Sound.play("furn_place"); if (x) S3.fx.sparkle(x, y, 0.3, "#f4e4b0", 8); }
  else if (k === 1) { A.Sound.play("furn_pick"); if (x) S3.fx.sparkle(x, y, 0.4, "#e8d8b8", 6); }
  else if (k === 2) A.Sound.play("furn_turn");
  else if (k === 3 && mine) A.Sound.play("item");
  else if (k === 4) A.Sound.play("tab");
  else if (k === 5 && mine) A.Sound.play("open");
  else if (k === 6) { if (mine) A.Sound.play("cozy"); if (x) S3.fx.sparkle(x, y, 0.6, "#ffb0c8", 14); }
  return true;
}

/** The top bar inside a house: whose it is, and (at home) the decorating and storage buttons. */
function hud() {
  const box = $("#house-hud");
  if (!box) return;
  const on = inHouse();
  document.body.classList.toggle("in-house", on);
  box.hidden = !on;
  if (!on) return;
  const key = [G().map.name, atHome()].join("|");
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  box.textContent = "";
  const { el } = A;
  box.append(el("b", "", G().map.name));
  const btn = (label, fn, cls = "btn small") => { const b = el("button", cls, label); b.addEventListener("click", () => { fn(); A.Sound.play("ui"); }); box.append(b); };
  if (atHome()) {
    btn("집 꾸미기", () => (A.isOpen("deco") ? A.closeWin("deco") : A.openWin("deco")), "btn small gold");
    btn("보관함", () => { if (!storeNear()) { A.toast("보관함 곁에서 열 수 있습니다. 보관함 옆으로 가 F를 누르세요."); return; } openStore(); });
  }
  btn("나가기", () => A.act({ t: "house_leave" }));
}

// ───────────────────────────── F: chests and beds ─────────────────────────────

const storeNear = () => atHome() && furnList().some((f) => fdef(f[1]).kind === "store" && near(f[2], f[3]));
/** The rest piece within reach, in whosever house this is (its tile from the map: everyone inside sees the beds). */
function restNear() {
  const m = G().map;
  if (!inHouse()) return null;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if ((m.o[y][x] === "p" || m.o[y][x] === "#") && near(x, y)) return [x, y];
  }
  return null;
}
function openStore() { A.Sound.play("chest_open"); A.openWin("hstore"); A.openWin("inv"); }
/** F (or the prompt): a chest opens the storage, a bed or a hearth gives a rest. True when it did something. */
export function interact() {
  if (!inHouse() || G().near) return false;
  if (storeNear()) { openStore(); return true; }
  const r = restNear();
  if (r) {
    // the server knows each piece by uid: at home from the list, as a guest by asking with the tile
    const f = furnList().find((q) => q[2] === r[0] && q[3] === r[1]);
    A.act({ t: "h_rest", u: f ? f[0] : -1, x: r[0], y: r[1] });
    return true;
  }
  return false;
}
/** Each frame: the "F" prompt for a chest or a bed when no townsperson is near. */
export function tick() {
  const want = !inHouse() || G().near || G().me.dead ? null : storeNear() ? "집 보관함 열기" : restNear() ? "안락한 휴식" : null;
  if (want === st.prompt) return;
  const p = $("#prompt");
  if (st.prompt && !G().near) p.hidden = true;
  st.prompt = want;
  if (want) { p.textContent = ""; p.append(A.el("b", "", document.body.classList.contains("touch") ? "▶ " : "F  "), want); p.hidden = false; }
}

// ───────────────────────────── decorating: the hovered tile and the ghost ─────────────────────────────

const decorating = () => atHome() && A.isOpen("deco");
const tileOf = (hit) => [Math.floor(hit[0] / T), Math.floor(hit[1] / T)];
/** Why the piece in hand cannot go on (x, y), or null: the server's rules, so the ghost tells the truth. */
function why(id, x, y) {
  const h = H(), tier = D().tiers[h[0]], d = fdef(id), list = furnList();
  if (!tier) return "집이 없습니다";
  if (x < 1 || y < 1 || x > tier.w - 2 || y > tier.h - 2) return "방 안의 바닥에만 놓을 수 있습니다";
  const rugs = list.filter((f) => fdef(f[1]).floor).length, pieces = list.length - rugs;
  if (d.floor && rugs >= tier.rugs) return `카펫은 ${tier.rugs}장까지 깔 수 있습니다`;
  if (!d.floor && pieces >= tier.furn) return `가구는 ${tier.furn}개까지 놓을 수 있습니다`;
  if (d.kind === "store" && list.filter((f) => fdef(f[1]).kind === "store").length >= tier.store) return `보관 가구는 ${tier.store}개까지 놓을 수 있습니다`;
  if (pieceAt(x, y, !!d.floor)) return d.floor ? "이미 카펫이 깔려 있습니다" : "이미 가구가 있습니다";
  if (d.floor) return null;
  if (d.wall && x !== 1 && y !== 1) return "뒷벽에 붙여 놓아야 합니다";
  const ex = tier.w >> 1, ey = tier.h - 2;
  if (x === ex && y === ey) return "문 앞은 비워 두어야 합니다";
  const me = G().me;
  if (me.x + 4 >= x * T && me.x - 4 < x * T + T && me.y >= y * T && me.y - 5 < y * T + T) return "그 자리에 서 있습니다";
  for (const p of G().players.values()) if (p.x + 4 >= x * T && p.x - 4 < x * T + T && p.y >= y * T && p.y - 5 < y * T + T) return "그 자리에 누군가 서 있습니다";
  // never wall anyone in
  const W = tier.w, Hh = tier.h, solid = new Uint8Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) if (i < 1 || j < 1 || i > W - 2 || j > Hh - 2) solid[j * W + i] = 1;
  for (const f of list) if (!fdef(f[1]).floor) solid[f[3] * W + f[2]] = 1;
  solid[y * W + x] = 1;
  const seen = new Uint8Array(W * Hh), stack = [ey * W + ex];
  let n = 0, open = 0;
  while (stack.length) { const i = stack.pop(); if (seen[i] || solid[i]) continue; seen[i] = 1; n++; stack.push(i + 1, i - 1, i + W, i - W); }
  for (let i = 0; i < W * Hh; i++) if (!solid[i]) open++;
  return n === open ? null : "그 자리에 놓으면 길이 막힙니다";
}
/** The pointer over the world while decorating: the ghost follows it. */
export function onWorldMove(e) {
  if (!decorating() || !st.sel) return;
  const t = tileOf(A.S3.pick(e.clientX, e.clientY));
  if (!st.hover || st.hover[0] !== t[0] || st.hover[1] !== t[1]) { st.hover = t; st.ghost = null; syncProps(); renderWhy(); }
}
/** A click on the world while decorating: place the piece in hand (on a touch screen: first show it), or pick a placed one. */
export function onWorldDown(e) {
  if (!decorating()) return false;
  const t = tileOf(A.S3.pick(e.clientX, e.clientY));
  if (st.sel) {
    if (e.pointerType === "touch" && (!st.hover || st.hover[0] !== t[0] || st.hover[1] !== t[1])) { st.hover = t; st.ghost = null; syncProps(); renderWhy(); return true; }
    st.hover = t;
    const no = why(st.sel, t[0], t[1]);
    if (no) { A.toast(no); A.Sound.play("no"); renderWhy(); return true; }
    A.act({ t: "furn_place", id: st.sel, x: t[0], y: t[1], d: st.dir });
    // the last of that piece in the bag: the hand empties
    if (countOf(st.sel) <= 1) { st.sel = null; st.hover = null; }
    st.ghost = null;
    setTimeout(syncProps, 0);
    refreshDeco();
    return true;
  }
  // a click lands on the ground behind a tall piece: look at the tile and the ones in front of it
  for (const [dx, dy] of [[0, 0], [1, 1], [1, 0], [0, 1], [2, 2]]) {
    const f = pieceAt(t[0] + dx, t[1] + dy) || pieceAt(t[0] + dx, t[1] + dy, true);
    if (f) { st.pick = st.pick === f[0] ? 0 : f[0]; A.Sound.play("ui"); syncProps(); refreshDeco(); return true; }
  }
  if (st.pick) { st.pick = 0; syncProps(); refreshDeco(); }
  return false;
}
/** Keys while decorating: R turns, Esc lets go, Delete picks up. True when the key was used. */
export function onKey(k) {
  if (!decorating()) return false;
  if ((k === "r" || k === "ㄱ") && (st.sel || st.pick)) { turn(); return true; }
  if (k === "Escape" && (st.sel || st.pick)) { st.sel = null; st.pick = 0; st.ghost = null; syncProps(); refreshDeco(); return true; }
  if ((k === "Delete" || k === "Backspace") && st.pick) { A.act({ t: "furn_pick", u: st.pick }); st.pick = 0; syncProps(); return true; }
  return false;
}
function turn() {
  if (st.sel) { st.dir = (st.dir + 1) & 3; st.ghost = null; syncProps(); refreshDeco(); A.Sound.play("tab"); return; }
  if (st.pick) A.act({ t: "furn_rot", u: st.pick });
}
const countOf = (id) => (G().self ? G().self.inv.reduce((n, s) => n + (s.id === id ? s.n || 1 : 0), 0) : 0);

/** The ghost (the piece in hand on the hovered tile) and the mark under a picked piece, as scene props. */
function syncProps() {
  const S3 = A.S3;
  if (!S3 || !S3.props) return;
  if (decorating() && st.sel && st.hover) {
    const [x, y] = st.hover, id = st.sel, ok = !why(id, x, y), d = fdef(id);
    if (!st.ghost) {
      const m = G().map;
      let img = null;
      if (!d.floor && m.o[y] && m.o[y][x] !== undefined) {
        const o = m.o.map((r, j) => (j === y ? r.slice(0, x) + d.ch + r.slice(x + 1) : r));
        img = roomPiece({ ...m, o, fd: { ...(m.fd || {}), [x + "," + y]: d.wall ? (y === 1 ? 0 : x === 1 ? 1 : 0) : st.dir } }, x, y);
      }
      st.ghost = img;
    }
    const pc = st.ghost;
    S3.props.set("h-ghost", { x: x * T, y: y * T, lift: -999, until: Infinity, draw(g, t, X, Y) {
      g.globalAlpha = 0.45 + 0.15 * Math.sin(t / 160);
      g.fillStyle = ok ? "#7affa0" : "#ff6a6a";
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + 16, Y + 8); g.lineTo(X, Y + 16); g.lineTo(X - 16, Y + 8); g.closePath(); g.fill();
      if (pc) { g.globalAlpha = ok ? 0.8 : 0.5; g.drawImage(pc.img, X + pc.dx, Y + pc.dy); }
      g.globalAlpha = 1;
    } });
  } else S3.props.delete("h-ghost");
  const f = decorating() && st.pick ? furnList().find((q) => q[0] === st.pick) : null;
  if (f) {
    S3.props.set("h-pick", { x: f[2] * T, y: f[3] * T, lift: 999, until: Infinity, draw(g, t, X, Y) {
      g.strokeStyle = "#ffe080"; g.lineWidth = 1; g.globalAlpha = 0.6 + 0.4 * Math.sin(t / 140);
      g.beginPath(); g.moveTo(X, Y - 1); g.lineTo(X + 17, Y + 8); g.lineTo(X, Y + 17); g.lineTo(X - 17, Y + 8); g.closePath(); g.stroke();
      g.globalAlpha = 1;
    } });
  } else S3.props.delete("h-pick");
}
export function onWinClose(id) { if (id === "deco") { st.sel = null; st.pick = 0; st.hover = null; syncProps(); } }

// ───────────────────────────── windows ─────────────────────────────

/** Called by the client's refreshUi: each window is rebuilt only when what it shows has changed. */
export function refresh(s) {
  A.draw("house", () => [s.gold, s.house, s.inv.length, s.bagCap, G().party], renderAgent);
  A.draw("deco", () => [s.house, s.inv, s.gold, st.sel, st.dir, st.pick], renderDeco);
  A.draw("hstore", () => [s.house, s.inv, s.bagCap], renderStore);
}
function refreshDeco() { if (G().self) { A.draw("deco", () => [Math.random()], renderDeco); } }
export function openAgent() { A.openWin("house"); }

/** The bag's size under its grid: "40 / 100칸" and the [+5칸 가방 확장] button with its price. */
export function bagBar(s, box) {
  if (!box) return;
  const { el, iconImg } = A, cap = s.bagCap || G().defs.inv, max = G().defs.invMax || 100;
  const cost = cap >= max ? 0 : G().defs.bag.cost[Math.floor((cap - G().defs.inv) / G().defs.bag.step)];
  const key = [cap, cost, s.gold >= cost].join("|");
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  box.textContent = "";
  box.append(el("span", "cap", `가방 ${cap} / ${max}칸`));
  if (cap >= max) { box.append(el("span", "max", "최대 크기")); return; }
  const b = el("button", "btn small gold", "");
  b.append(`+${G().defs.bag.step}칸 가방 확장 (`, iconImg("coin", "#2a1806"), `${gstr(cost)} G)`);
  b.disabled = s.gold < cost;
  b.title = s.gold < cost ? `골드가 부족합니다 (${gstr(cost)}G 필요)` : `가방을 ${cap + G().defs.bag.step}칸으로 늘립니다`;
  b.addEventListener("click", () => { A.act({ t: "bag_expand" }); A.Sound.play("coin"); });
  box.append(b);
}

/** 하우징 안내인: buy or enlarge the house, the furniture shop, visits. */
function renderAgent(s) {
  const { el, iconImg } = A, box = $("#house-body"), h = s.house, D0 = D(), tiers = D0.tiers;
  box.textContent = "";
  const head = el("div", "house-top");
  if (!h[0]) {
    head.append(el("p", "say", `'내 집'을 마련해 보세요! [${tiers[1].name}]은 가구 ${tiers[1].furn}개와 보관함 ${tiers[1].store}개를 놓을 수 있어요. 입주 선물로 침대와 나무 보관함, 화분을 드려요.`));
    const b = el("button", "btn gold", "");
    b.append(`집 마련하기 (`, iconImg("coin", "#2a1806"), `${gstr(tiers[1].price)} G)`);
    b.disabled = s.gold < tiers[1].price;
    b.addEventListener("click", () => { A.act({ t: "house_buy" }); A.Sound.play("coin"); });
    head.append(b);
  } else {
    head.append(el("p", "say", `당신의 집: [${tiers[h[0]].name}] · 가구 ${tiers[h[0]].furn}개 · 카펫 ${tiers[h[0]].rugs}장 · 보관 가구 ${tiers[h[0]].store}개 · 보관함 ${h[3]}칸. 곁의 '내 집' 문으로 들어가세요.`));
    head.append(upgradeButton(s));
  }
  box.append(head);
  // party members at home right now: their map is named after their house
  const homes = (G().party || []).filter(([eid, , , , , , where]) => eid !== G().you && where && tiers.some((t) => t && where.endsWith("의 " + t.name)));
  if (homes.length) {
    const v = el("div", "house-visit");
    v.append(el("div", "section", "파티원의 집 방문"));
    for (const [eid, name] of homes) { const b = el("button", "btn small", `${name}님의 집으로`); b.addEventListener("click", () => A.act({ t: "house_visit", o: eid })); v.append(b); }
    box.append(v);
  }
  box.append(el("div", "section", "가구 상점"));
  const list = el("div", "furn-shop");
  for (const id of D0.shop) {
    const it = G().defs.items[id], d = fdef(id), row = el("div", "furn-row");
    const img = el("img"); img.src = G().icons.url[id]; img.alt = it.name;
    const tag = d.kind === "store" ? `보관 +${d.cap}칸` : d.kind === "rest" ? "휴식" : d.floor ? "카펫" : d.wall ? "벽에 붙임" : "장식";
    const name = el("span", "nm", it.name);
    name.append(el("em", d.kind, tag));
    const b = el("button", "btn small", `${gstr(it.price)} G`);
    b.disabled = s.gold < it.price;
    b.addEventListener("click", (e) => { A.act({ t: "furn_buy", id, n: e.shiftKey ? 5 : 1 }); A.Sound.play("coin"); });
    b.title = "클릭: 1개 · Shift+클릭: 5개";
    row.append(img, name, el("span", "have", countOf(id) ? `가방 ${countOf(id)}` : ""), b);
    A.hoverTip(row, (tip) => { tip.append(el("div", "nm", it.name), el("div", "ds", it.desc)); });
    list.append(row);
  }
  box.append(list);
}
function upgradeButton(s) {
  const { el, iconImg } = A, h = s.house, next = D().tiers[h[0] + 1];
  if (!next) return el("p", "hint", "가장 큰 집입니다.");
  const b = el("button", "btn gold", "");
  b.append(`[${next.name}]으로 넓히기 (`, iconImg("coin", "#2a1806"), `${gstr(next.price)} G)`);
  b.title = `${next.w - 2}×${next.h - 2}칸 · 가구 ${next.furn}개 · 카펫 ${next.rugs}장 · 보관 가구 ${next.store}개`;
  b.disabled = s.gold < next.price;
  b.addEventListener("click", () => { A.act({ t: "house_upgrade" }); A.Sound.play("coin"); });
  return b;
}

/** 집 꾸미기: the furniture in the bag (pick one up to place it), the furniture placed, styles, a bigger house. */
function renderDeco(s) {
  const { el, itemSlot } = A, box = $("#deco-body"), h = s.house, tier = D().tiers[h[0]];
  box.textContent = "";
  if (!tier || h[6] !== 1) { box.append(el("p", "hint", "내 집 안에서 꾸밀 수 있습니다.")); return; }
  const list = furnList(), rugs = list.filter((f) => fdef(f[1]).floor).length, stores = list.filter((f) => fdef(f[1]).kind === "store").length;
  box.append(el("p", "deco-sum", `[${tier.name}] 가구 ${list.length - rugs}/${tier.furn} · 카펫 ${rugs}/${tier.rugs} · 보관 가구 ${stores}/${tier.store} · 보관함 ${h[3]}칸`));
  // in the bag
  box.append(A.el("div", "section", "가방 속 가구"));
  const have = {};
  for (const e of s.inv) if (G().defs.items[e.id] && G().defs.items[e.id].type === "furn") have[e.id] = (have[e.id] || 0) + (e.n || 1);
  const grid = el("div", "grid deco-grid");
  for (const id of D().shop) {
    if (!have[id]) continue;
    grid.append(itemSlot({ id, n: have[id] }, { selected: st.sel === id, hint: "클릭: 손에 들기 → 바닥을 클릭해 놓기", onClick: () => { st.sel = st.sel === id ? null : id; st.pick = 0; st.ghost = null; A.Sound.play("ui"); syncProps(); refreshDeco(); } }));
  }
  if (!grid.children.length) box.append(el("p", "hint", "가방에 가구가 없습니다. 마을의 하우징 안내인에게서 살 수 있어요."));
  else box.append(grid);
  const hand = el("div", "deco-hand");
  if (st.sel) {
    const d = fdef(st.sel);
    hand.append(el("span", "", `손에 든 가구: ${itemName(st.sel)}${d.floor || d.wall ? "" : ` · 방향 ${DIRS[st.dir]}`}`));
    if (!d.floor && !d.wall) { const b = el("button", "btn small", "돌리기 (R)"); b.addEventListener("click", turn); hand.append(b); }
    const c = el("button", "btn small", "내려놓기 (Esc)"); c.addEventListener("click", () => onKey("Escape")); hand.append(c);
    hand.append(el("p", "hint", d.wall ? "뒷벽에 붙은 칸을 클릭해 놓으세요." : "놓을 바닥 칸을 클릭하세요 (휴대폰: 한 번 눌러 보고, 한 번 더 눌러 놓기)."));
    hand.append(el("p", "why", ""));
  }
  box.append(hand);
  renderWhy();
  // placed
  box.append(el("div", "section", "놓인 가구"));
  const placed = el("div", "deco-placed");
  for (const [uid, id, x, y] of list) {
    const d = fdef(id), row = el("div", "furn-row" + (st.pick === uid ? " sel" : ""));
    const img = el("img"); img.src = G().icons.url[id];
    row.append(img, el("span", "nm", `${itemName(id)} (${x}, ${y})`));
    const rot = el("button", "btn small", "돌리기"); rot.disabled = !!(d.floor || d.wall);
    rot.addEventListener("click", (e) => { e.stopPropagation(); A.act({ t: "furn_rot", u: uid }); });
    const pick = el("button", "btn small", "치우기");
    pick.addEventListener("click", (e) => { e.stopPropagation(); A.act({ t: "furn_pick", u: uid }); if (st.pick === uid) st.pick = 0; });
    row.append(rot, pick);
    row.addEventListener("click", () => { st.pick = st.pick === uid ? 0 : uid; st.sel = null; syncProps(); refreshDeco(); });
    placed.append(row);
  }
  box.append(placed);
  // styles
  box.append(el("div", "section", "바닥 · 벽지"));
  const sty = (label, items, cur, key) => {
    const row = el("div", "deco-style");
    row.append(el("span", "lb", label));
    items.forEach(([, name], i) => {
      const b = el("button", "btn small" + (i === cur ? " on" : ""), name);
      b.disabled = i === cur;
      b.addEventListener("click", () => A.act({ t: "house_style", [key]: i }));
      row.append(b);
    });
    box.append(row);
  };
  sty("바닥", D().floors, h[1], "floor");
  sty("벽지", D().walls, h[2], "wall");
  box.append(el("div", "section", "집 넓히기"));
  box.append(upgradeButton(s));
}
/** The line under the piece in hand: why it cannot go on the hovered tile. */
function renderWhy() {
  const w = document.querySelector("#deco-body .why");
  if (!w) return;
  const no = st.sel && st.hover ? why(st.sel, st.hover[0], st.hover[1]) : null;
  w.textContent = no ? `✕ ${no}` : st.hover ? "✓ 여기에 놓을 수 있습니다" : "";
  w.classList.toggle("bad", !!no);
}

/** 집 보관함: the bag on the left, the storage on the right (click to move; Shift+click: one). */
function renderStore(s) {
  const { el, itemSlot } = A, box = $("#hstore-body"), h = s.house;
  box.textContent = "";
  const items = Array.isArray(h[8]) ? h[8] : [];
  const top = el("div", "bank-top");
  top.append(el("span", "", `보관함 ${items.length} / ${h[3]}칸`));
  const sort = el("button", "btn small", "정리");
  sort.title = "종류별로, 좋은 것부터, 같은 것은 한 묶음으로";
  sort.addEventListener("click", () => { A.act({ t: "h_sort" }); A.Sound.play("ui"); });
  top.append(sort);
  box.append(top);
  const panes = el("div", "bank-panes");
  const pane = (title, list, size, t) => {
    const p = el("div", "pane");
    p.append(el("div", "pt", `${title}  ${list.length} / ${size}`));
    const grid = el("div", "grid bank-grid");
    for (let i = 0; i < size; i++) {
      const e = list[i];
      grid.append(e ? itemSlot(e, { onClick: (ev) => A.act({ t, s: i, n: ev.shiftKey ? 1 : e.n || 1 }), hint: t === "h_dep" ? "클릭: 넣기 (Shift+클릭: 1개)" : "클릭: 꺼내기 (Shift+클릭: 1개)" }) : itemSlot(null));
    }
    p.append(grid);
    return p;
  };
  panes.append(pane("가방", s.inv, s.bagCap || G().defs.inv, "h_dep"), pane("집 보관함", items, Math.max(h[3], items.length), "h_wd"));
  box.append(panes);
  box.append(el("p", "hint", storeNear() ? "같은 물건은 한 칸에 모입니다 (최대 99개). 보관함을 더 놓으면 칸이 늘어납니다." : "보관함 곁에서만 넣고 꺼낼 수 있습니다."));
}
