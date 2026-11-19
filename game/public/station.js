/**
 * Life stations (L2b; docs/design/life-and-coop.md H2): the station window `#w-craft` at 캉캉 (role `craft`,
 * 제작), 보글 (`alch`, 연금), 쥬쥬의 화덕 (`cook`, 요리: stove and campfire recipes) and any campfire (`fire`).
 * It lists that station's recipes from `defs.life.recipes` by grade band: output, inputs with have/need (bag +
 * 재료 주머니), fee, odds; rows not known yet are greyed with the server's own reason (level, trust 30).
 * 만들기 → `craft_open {r}`; the server's `["mk", eid, r]` starts the recipe's mini-game (`mg`: pan = the L1
 * cooking pan, forge, brew; minigames.js), and its score goes back as `craft {r, s}` no sooner than
 * `ms × lifeTime(L)` after `mk`. 일괄 n개 (life Lv ≥ recipe + batchD, not gear, not an L1 fish dish) sends
 * `craft {r, n}` with no mini-game. `["mo", eid, r, best]` → sound and a float (the toast comes from the server).
 * hud.js draws it (`draw("craft", key, render)`), actions.js `interact` opens it, events.js passes `mk`/`mo`.
 */

import { Sound } from "./audio.js";
import * as Mini from "./minigames.js";
import * as Gather from "./gather.js";
import * as S3 from "./scene2d.js";
import { G, $, el, dist, T } from "./state.js";
import { act, entityPos } from "./net.js";
import { openWin, closeWin, isOpen, hoverTip, toast } from "./windows.js";
import { countItem, fireNear } from "./actions.js";
import { itemTip } from "./items.js";
import { iconImg } from "./uiicons.js";
import * as Info from "./infocard.js";
import { floatText } from "./events.js";

/** Station kinds: the window's title, the skill's glyph and colour, and which recipe `at`s it serves. */
const KIND = {
  craft: { t: "캉캉대장간 — 제작", g: "anvil", c: "#c8c8d8", at: ["craft"], mg: "모루" },
  alch: { t: "보글연금공방 — 연금", g: "drop", c: "#d88ae8", at: ["alch"], mg: "가마" },
  cook: { t: "쥬쥬의 화덕 — 요리", g: "fire", c: "#ffb04a", at: ["cook", "fire"], mg: "화덕" },
  fire: { t: "모닥불 — 요리", g: "fire", c: "#ffb04a", at: ["fire"], mg: "모닥불" },
};
/** st.kind the open station · name the named fixture · sel the picked recipe · n the batch count. */
const st = { kind: "", name: "", sel: "", n: 1, pend: null, run: null };
window.__station = st;

const D = () => G.defs.life;
const R = (id) => D().recipes.find((r) => r.id === id);
const lvOf = (s, sk) => ((s.life || [])[D().keys.indexOf(sk)] || [1])[0];
const repOf = (s, id) => { const r = s.rep; if (!r) return 0; if (Array.isArray(r)) { const e = r.find((x) => x[0] === id); return e ? e[1] : 0; } return r[id] || 0; };
const isRune = (id) => /^ru_/.test(id);
/** How many of an input you have: bag + pouch ("rune*" = every rune). */
function have(s, id) {
  const p = s.pouch || {};
  if (id === "rune*") {
    let n = 0;
    for (const e of s.inv) if (isRune(e.id)) n += e.n || 1;
    for (const k of Object.keys(p)) if (isRune(k)) n += p[k];
    return n;
  }
  return countItem(id) + (p[id] || 0);
}
const nameOf = (id) => (id === "rune*" ? "무작위 룬" : (G.defs.items[id] || { name: id }).name);
function iconOf(id) {
  const k = id === "rune*" ? Object.keys(G.defs.items).find(isRune) : id;
  return (G.icons && G.icons.url[k]) || "";
}
/** Why the recipe is not known yet (the server's words: 58-life recipeWhy), or "". */
function lockWhy(s, r) {
  if (!r.any && lvOf(s, r.sk) < r.lv) return `${D().names[D().keys.indexOf(r.sk)]} 레벨이 부족합니다 (Lv.${r.lv} 필요)`;
  if (r.rep && repOf(s, r.rep) < D().rep.tier[1]) {
    const who = D().rep.perk[r.rep].who, last = who.charCodeAt(who.length - 1) - 0xac00;
    return `${who}${last >= 0 && last % 28 ? "과" : "와"} 친구가 되어야 배울 수 있습니다`;
  }
  if (r.sq && !(s.sq || []).some((row) => row[0] === r.sq && (row[1] === 2 || row[1] === 3))) return "퀘스트를 받아야 만들 수 있습니다";
  return "";
}
/** Why `k` crafts cannot start here and now (inputs, fee), or "". */
function lackWhy(s, r, k = 1) {
  if (r.in.some(([id, n]) => have(s, id) < n * k)) return "재료가 부족합니다";
  if (s.gold < r.fee * k) return `골드가 부족합니다 (${(r.fee * k).toLocaleString()}G 필요)`;
  return "";
}
/** [success %, 대성공 %] at a score of 50 (58-life lifeOdds). */
function odds(L, r) {
  const Q = D().roll, d = Math.max(0, L - r.lv), r1 = (v) => Math.round(v * 10) / 10;
  return [r1(Math.min(Q.ok[2], Q.ok[0] + Q.ok[1] * d)), r1(Math.min(Q.great[2], Q.great[0] + Q.great[1] * d))];
}
const minMs = (s, r) => r.ms * (1 - D().roll.time * Math.min(D().max, Math.max(1, lvOf(s, r.sk))));
const canBatch = (s, r) => !r.gear && !r.any && lvOf(s, r.sk) >= r.lv + D().craft.batchD;
/** The station's recipes, in level order; another class's weapons are left out (as at the shop). */
function list(s) {
  const at = KIND[st.kind].at, it = G.defs.items;
  return D().recipes.filter((r) => at.includes(r.at) && !(r.gear && it[r.out[0]] && it[r.out[0]].cls && it[r.out[0]].cls !== s.cls))
    .sort((a, b) => (b.any ? 1 : 0) - (a.any ? 1 : 0) || a.lv - b.lv || at.indexOf(a.at) - at.indexOf(b.at));
}

/** Is the player still at the station (a little looser than the server's reach, so the window does not flicker)? */
function atStation() {
  if (!G.map || !G.me) return false;
  const roleNear = (role, r) => G.map.npcs.some((n) => n.role === role && dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12) < r);
  if (st.kind === "fire") return fireNear() || roleNear("cook", 64);
  return roleNear(st.kind, 72);
}

/** Open the window for a station kind (`craft` `alch` `cook` `fire`). */
export function open(kind, name = "") {
  if (!KIND[kind] || !D() || !D().recipes) return false;
  if (st.kind !== kind) { st.sel = ""; st.n = 1; $("#craft-body").textContent = ""; }
  st.kind = kind;
  st.name = name;
  const sk = kind === "fire" ? "cook" : kind;
  const w = $("#w-craft");
  w.querySelector("header .t").textContent = name ? `${name} — ${D().names[D().keys.indexOf(sk)]}` : KIND[kind].t;
  openWin("craft");
  return true;
}
/** What the window shows changes when (hud.js `draw`); also closes it once you walk away. */
export function key() {
  const s = G.self;
  if (st.kind && isOpen("craft") && !atStation()) closeWin("craft");
  return [st.kind, st.sel, st.n, !!st.pend, !!st.run, s.inv, s.gold, s.life, s.rep, Gather.pouchKey(s), s.cls];
}

export function render(s) {
  const box = $("#craft-body"), old = box.querySelector(".st-list"), keep = old ? old.scrollTop : -1;
  box.textContent = "";
  if (!st.kind || !D() || !D().recipes) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const K = KIND[st.kind], rows = list(s);
  if (!rows.find((r) => r.id === st.sel)) st.sel = (rows.find((r) => !lockWhy(s, r) && !lackWhy(s, r)) || rows.find((r) => !lockWhy(s, r)) || rows[0] || {}).id || "";
  const sk = rows[0] ? rows[0].sk : "craft", L = lvOf(s, sk), si = D().keys.indexOf(sk);
  const top = el("div", "daily-top st-top");
  top.append(iconImg(K.g, K.c), el("span", "", `${D().names[si]} Lv.${L}`), Info.coin(s.gold, "purse"));
  box.append(top);
  const lst = el("div", "st-list");
  const G5 = D().grades;
  let band = -1;
  for (const r of rows) {
    const b = Math.max(0, G5.filter((u) => r.lv >= u).length - 1);
    if (r.any) { if (band !== -2) { band = -2; lst.append(el("div", "st-band", "생선 구이 — 어떤 레벨이든")); } }
    else if (b !== band) { band = b; lst.append(el("div", "st-band", `${D().gradeName[b]} · Lv.${G5[b]}+`)); }
    const lock = lockWhy(s, r), lack = !lock && lackWhy(s, r);
    const row = el("div", "st-row" + (r.id === st.sel ? " sel" : "") + (lock ? " lock" : lack ? " lack" : ""));
    const img = el("img"); img.src = iconOf(r.out[0]); img.alt = "";
    if (r.out[0] !== "rune*") hoverTip(img, (h) => itemTip({ id: r.out[0] }, h));
    const tx = el("div", "tx");
    const nm = el("div", "nm");
    nm.append(el("b", "", nameOf(r.out[0]) + (r.out[1] > 1 ? ` ×${r.out[1]}` : "")));
    if (!r.any) nm.append(el("span", "lv", `Lv.${r.lv}`));
    if (r.gear) nm.append(el("span", "tag", "장비"));
    if (r.rep) nm.append(el("span", "tag", "비법"));
    tx.append(nm);
    const ins = el("div", "ins");
    for (const [id, n] of r.in) {
      const h = have(s, id), chip = el("span", "in" + (h < n ? " short" : ""));
      const ic = el("img"); ic.src = iconOf(id); ic.alt = "";
      chip.append(ic, document.createTextNode(`${h}/${n}`));
      chip.title = nameOf(id);
      ins.append(chip);
    }
    if (r.fee) { const fee = Info.coin(r.fee, "fee" + (s.gold < r.fee ? " short" : "")); fee.title = `수수료 ${r.fee.toLocaleString()} 골드${s.gold < r.fee ? " — 골드가 부족합니다" : ""}`; ins.append(fee); }
    tx.append(ins);
    if (lock) tx.append(el("small", "why", lock));
    row.append(img, tx);
    row.addEventListener("click", () => { if (st.sel !== r.id) { st.sel = r.id; st.n = 1; Sound.play("blip"); render(G.self); } });
    lst.append(row);
  }
  if (!rows.length) lst.append(el("p", "hint", "이곳에서 만들 수 있는 것이 없습니다."));
  box.append(lst);
  box.append(detail(s, R(st.sel), K));
  const pouch = el("div", "pouch");
  Gather.renderPouch(pouch, s, { where: "craft" });
  box.append(pouch);
  // a redraw keeps the list where it was; a fresh one shows the picked row
  const on = lst.querySelector(".sel");
  if (keep >= 0) lst.scrollTop = keep;
  else if (on) lst.scrollTop = Math.max(0, on.offsetTop - lst.offsetTop - 40);
}

/** The picked recipe: odds, time, what a failure costs, and the 만들기 / 일괄 buttons. */
function detail(s, r, K) {
  const box = el("div", "well st-detail");
  if (!r) return box;
  const L = lvOf(s, r.sk), lock = lockWhy(s, r);
  const hd = el("div", "st-dh");
  hd.append(el("b", "", nameOf(r.out[0]) + (r.out[1] > 1 ? ` ×${r.out[1]}` : "")));
  box.append(hd);
  const lines = [];
  if (r.any) lines.push("팬에 재료를 빈틈없이 빨리 채울수록 잘 익습니다 — 숙련될수록 덜 탑니다.");
  else {
    const [ok, great] = odds(L, r);
    lines.push(`성공 ${ok}% · 대성공 ${great}% (미니게임 점수에 따라 최대 ±10%p)`);
    lines.push(r.gear ? "고급~희귀 장비가 나옵니다 (대성공이면 한 단계 위)." : r.out[0] === "rune*" ? "가장 많은 룬 세 개로 무작위 룬 하나를 만듭니다." : r.sk === "cook" ? "대성공이면 두 접시가 나옵니다." : "대성공이면 결과물이 두 배입니다.");
    lines.push(`실패하면 재료의 절반을 돌려받고 수수료는 내지 않습니다${r.fee ? ` · 수수료 ${r.fee.toLocaleString()}G` : ""}`);
  }
  const mg = r.mg === "forge" ? "망치질" : r.mg === "brew" ? "가마 젓기" : "팬 채우기";
  const t = minMs(s, r);
  lines.push(`${K.mg}에서 ${mg}${t > 0 ? ` · 최소 ${(t / 1000).toFixed(1)}초` : ""}`);
  for (const l of lines) box.append(el("small", "", l));
  const btns = el("div", "btns");
  const why = lock || lackWhy(s, r);
  const make = el("button", "btn gold", st.pend ? "준비 중…" : "만들기");
  make.disabled = !!why || !!st.pend || !!st.run;
  if (why) make.title = why;
  make.addEventListener("click", () => start(r));
  btns.append(make);
  if (!lock && canBatch(s, r)) {
    let max = D().craft.batch;
    while (max > 1 && lackWhy(s, r, max)) max--;
    st.n = Math.max(1, Math.min(st.n, max));
    const minus = el("button", "btn small", "−"), plus = el("button", "btn small", "+");
    const num = el("span", "st-n", String(st.n));
    minus.disabled = st.n <= 1; plus.disabled = st.n >= max;
    minus.addEventListener("click", () => { st.n = Math.max(1, st.n - 1); Sound.play("blip"); render(G.self); });
    plus.addEventListener("click", () => { st.n = Math.min(max, st.n + 1); Sound.play("blip"); render(G.self); });
    const go = el("button", "btn", `일괄 ${st.n}개`);
    go.disabled = !!lackWhy(s, r, st.n) || !!st.pend || !!st.run;
    go.title = `미니게임 없이 ${st.n}개를 만듭니다 (점수 ${D().craft.batchS} 기준)`;
    go.addEventListener("click", () => { act({ t: "craft", r: r.id, n: st.n }); Sound.play("ui"); });
    btns.append(minus, num, plus, go);
  } else if (!lock && !r.gear && !r.any) {
    btns.append(el("small", "st-bt", `일괄 제작: ${D().names[D().keys.indexOf(r.sk)]} Lv.${r.lv + D().craft.batchD}부터`));
  }
  box.append(btns);
  if (why) box.append(el("small", "why", why));
  return box;
}

function start(r) {
  if (st.pend || st.run || Mini.active()) return;
  st.pend = { r: r.id, at: performance.now() };
  act({ t: "craft_open", r: r.id });
  Sound.play("ui");
  // the server refuses with an error toast; give the button back if no `mk` comes
  setTimeout(() => { if (st.pend && st.pend.r === r.id && performance.now() - st.pend.at >= 2900) { st.pend = null; render(G.self); } }, 3000);
  render(G.self);
}

/** The mini-game for `mk`; its score is sent once the recipe's minimum time has passed. */
function play(r) {
  const s = G.self, need = minMs(s, r) + 250, t0 = performance.now(), name = nameOf(r.out[0]);
  st.run = { r: r.id };
  // the mini-game sits under the windows (#minigame in #hud): the station window steps aside while it runs
  const back = isOpen("craft");
  closeWin("craft"); closeWin("talk");
  const reopen = () => { st.run = null; if (back && atStation()) open(st.kind, st.name); };
  const send = (score) => {
    if (score === null || score === undefined) { toast("제작을 그만두었습니다"); reopen(); return; }
    const wait = Math.max(0, t0 + need - performance.now());
    if (wait > 0) toast("마무리하는 중…");
    setTimeout(() => { act({ t: "craft", r: r.id, s: score }); reopen(); }, wait);
  };
  if (r.mg === "forge") Mini.forge(name, send);
  else if (r.mg === "brew") Mini.brew(name, need, send);
  else Mini.cooking(name, send);
}

/** `mk` / `mo` from the snapshot's `ev`; true when handled. */
export function onEvent(e) {
  if (e[0] === "mk") {
    if (e[1] !== G.you) return true;
    const r = R(e[2]);
    st.pend = null;
    if (r && !st.run && !Mini.active()) play(r);
    return true;
  }
  if (e[0] === "mo") {
    const [, eid, rid, best] = e, at = entityPos(eid), mine = eid === G.you;
    if (mine) {
      const r = R(rid);
      Sound.play(best === 2 ? "craft_great" : best === 1 ? (r && r.mg === "pan" ? "dish_done" : "craft_ok") : "craft_fail");
      if (best === 2) floatText("대성공!", G.me.x, G.me.y, 1.9, "#ffe08a", true);
      else if (best === 0) floatText("실패…", G.me.x, G.me.y, 1.7, "#ff9a8a");
      if (isOpen("craft")) render(G.self);
    }
    // anyone's 대성공 sparkles over their head
    if (at && best === 2) S3.fx.sparkle(at.x, at.y, 1.1, "#ffe08a", 12);
    return true;
  }
  return false;
}
