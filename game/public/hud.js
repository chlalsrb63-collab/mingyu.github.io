/**
 * The HUD (split from client.js): face and portrait (`drawFace drawPortrait`), HP/MP bars, purse,
 * unit frame, mastery strip, hotbar, quest tracker; window refresh (`draw(id, keyOf, fn)` re-renders
 * a window only when its key changed, `refreshUi`, `section`); the sky widget and `hudTick` (per frame:
 * event widget, cast bar, weapon gauge, streak, buffs).
 */

import { Sound } from "./audio.js";
import { iconImg, iconUrl, BUFF_ICON } from "./uiicons.js";
import * as SP from "./sprites.js";
import * as Growth from "./growth.js";
import * as Wardrobe from "./wardrobe_ui.js";
import { entryIconUrl } from "./weapons.js";
import * as QS from "./quickslots.js";
import * as SideQ from "./sidequests.js";
import { drawWeaponGauge } from "./weapongauge.js";
import * as Mastery from "./mastery.js";
import * as StatWin from "./statwin.js";
import * as JobTree from "./jobtree.js";
import * as Sky from "./sky.js";
import * as Housing from "./housing.js";
import * as Life from "./life.js";
import { G, $, clamp, VP, el, dollDocked } from "./state.js";
import * as Gather from "./gather.js";
import * as Station from "./station.js";
import * as Board from "./board.js";
import { fireNear, countItem, talk, stoneNear } from "./actions.js";
import { tip, showTip, tipBox, touch, hideTip, toggleWin, isOpen, shown, winEl, keepIn } from "./windows.js";
import { openTree, openStats, renderInv, renderChar, renderDoll, renderSkills } from "./win_char.js";
import { renderWarp, renderDaily, renderAchieve, renderCollect, tutCard, eventWidget, castBar, tickDaily } from "./win_world.js";
import { renderShop, renderSmith, renderQuest } from "./win_shop.js";

// ── the unit frame and the bars ──
export const look = () => G.who.get(G.you);
let faceKey = "";
function drawFace() {
  const w = look(), s = G.self;
  if (!w || !s) return;
  const key = JSON.stringify([s.cls, w.look, w.gear && w.gear.cos]);
  if (key === faceKey) return;
  faceKey = key;
  const fr = SP.personSheet(SP.playerLook(s.cls, w.look, w.gear)).front[0];
  const g = $("#st-face").getContext("2d");
  g.clearRect(0, 0, 40, 40);
  g.imageSmoothingEnabled = false;
  g.drawImage(fr, 6, 8, 20, 20, 0, 0, 40, 40);
}
/** The paper-doll's figure: the player's own sprite, large, breathing and now and then blinking. */
let dollAt = 0, dollFrame = -1;
/** Draw the portrait afresh next frame (the character window changed). */
export function resetDoll() { dollFrame = -1; }
export function drawPortrait(t) {
  const w = look(), s = G.self;
  if (!w || !s) return;
  const f = t % 4200 < 160 ? 5 : Math.floor(t / 650) % 2;
  if (f === dollFrame && t - dollAt < 2000) return;
  dollFrame = f; dollAt = t;
  const cv = $("#char-cv"), g = cv.getContext("2d");
  g.clearRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = false;
  g.fillStyle = "rgba(0,0,0,.4)";
  g.beginPath(); g.ellipse(66, 147, 30, 6, 0, 0, Math.PI * 2); g.fill();
  const fr = SP.personSheet(SP.playerLook(s.cls, w.look, w.gear)).front[f];
  g.drawImage(fr, 4, 2, 24, 28, 6, 10, 120, 140);
}
export function hudBars() {
  const s = G.self, me = G.me;
  if (!s) return;
  const hp = `${clamp((me.hp / s.mhp) * 100, 0, 100)}%`;
  $("#st-hp").style.width = hp;
  $("#st-hp-trail").style.width = hp;
  $("#st-mp").style.width = `${clamp((me.mp / s.mmp) * 100, 0, 100)}%`;
  $("#st-hpt").textContent = `${me.hp}/${s.mhp}`;
  $("#st-mpt").textContent = `${me.mp}/${s.mmp}`;
}
/** The purse under the bars: the coin and the sum, with a short +N / -N that floats off when it changes. */
let hudGold = null;
/** Forget the purse shown (a new character's starts without a +N). */
export function resetPurse() { hudGold = null; }
function hudPurse(s) {
  if (s.gold === hudGold) return;
  const n = $("#st-gold-n"), fx = $("#st-gold-fx");
  if (!n.firstChild) n.append(iconImg("coin", "#e2c486"), document.createTextNode(""));
  n.lastChild.textContent = `${s.gold.toLocaleString()} G`;
  if (hudGold !== null) {
    const d = s.gold - hudGold;
    fx.textContent = `${d > 0 ? "+" : "-"}${Math.abs(d).toLocaleString()}`;
    fx.classList.toggle("lose", d < 0);
    fx.style.left = n.offsetWidth + 6 + "px";
    fx.classList.remove("go"); void fx.offsetWidth; fx.classList.add("go");
  }
  hudGold = s.gold;
}
export function setOnce(node, key, fill) {
  if (node.dataset.k === key) return;
  node.dataset.k = key;
  node.textContent = "";
  fill(node);
}
function hudFrame(s) {
  $("#st-name").textContent = s.name;
  // name and level on one line; the job is in the mastery card (hover the strip beside the bars)
  const jobName = Mastery.jobOf(s, G.defs).name;
  setOnce($("#st-lv"), `${s.lvl}:${jobName}`, (n) => { n.textContent = `Lv.${s.lvl}`; n.title = jobName; });
  drawFace();
  hudMastery(s);
  hudPurse(s);
  // unspent experience against the cheapest next stat point (a level is bought at a campfire or the trainer)
  const need = Math.min(...s.nx.filter((c) => c > 0), Infinity);
  const maxed = s.lvl >= G.defs.maxLv || !Number.isFinite(need);
  $("#exp-fill").style.width = maxed ? "100%" : `${Math.min(100, (s.xp / need) * 100)}%`;
  $("#exp-text").textContent = maxed ? `경험치 ${s.xp.toLocaleString()}` : s.xp >= need ? `EXP ${s.xp.toLocaleString()} — 레벨을 올릴 수 있습니다 (모닥불·수련관)` : `EXP ${s.xp.toLocaleString()} / ${need.toLocaleString()}  (${((s.xp / need) * 100).toFixed(2)}%)`;
  $("#exp").classList.toggle("ready", !maxed && s.xp >= need);
  hudBars();
}
/** The weapon-mastery strip beside the bars (mastery.js); a level gained flashes it and chimes. */
function hudMastery(s) {
  const wpn = s.eq.weapon, it = wpn && G.defs.items[wpn.id];
  const ups = Mastery.renderStrip($("#wm"), s, G.defs, wpn ? entryIconUrl(wpn, it) || G.icons.url[wpn.id] : "");
  if (ups.length) Sound.play("buff");
  if (tip.from === $("#wm")) showMasteryTip();
}
function showMasteryTip() {
  const box = $("#wm");
  if (!G.self) return;
  showTip(box, (n) => Mastery.fillTip(n, G.self, G.defs));
  // above the strip, so it never covers the hotbar (below it when the strip is at the top, phone on its side)
  const r = box.getBoundingClientRect(), h = tipBox.offsetHeight, w = tipBox.offsetWidth;
  tipBox.style.left = `${Math.round(clamp(r.left, 4, (VP.lay === "full" ? VP.w : innerWidth) - w - 4))}px`;
  const above = r.top - h - 18;
  tipBox.style.top = `${Math.round(above >= 4 ? above : Math.min(r.bottom + 6, innerHeight - h - 4))}px`;
}
function setSrc(img, src) { if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; } }
function hotbar(s) {
  for (const [btn, kind] of [["#b-hp", "hp"], ["#b-mp", "mp"]]) {
    const [n, show] = Growth.potionCount(kind);
    setSrc($(`${btn} img`), G.icons.url[show]);
    $(`${btn} .n`).textContent = n;
    $(btn).style.opacity = n ? 1 : 0.45;
  }
  QS.render();                                      // the quick slots 1–9 (quickslots.js)
  // the attack button carries the weapon in hand
  const wpn = s.eq.weapon;
  setSrc($("#b-atk img"), wpn ? G.icons.url[wpn.id] : iconUrl("sword"));
  $("#b-atk").title = `공격 (Space) — ${G.defs.wkinds[s.wk]?.name || ""} · 세 번째 타격은 마무리 일격`;
}
function tracker(s) {
  const quest = G.defs.quests[s.q.i], mobs = G.defs.mobs;
  // while the first steps are unfinished the daily tasks stay out of the tracker (첫걸음 and the main quest only)
  const tutOn = !!(s.tut && s.tut.i < (G.defs.tutorial || []).length);
  const dl = !tutOn && s.daily && s.daily.tasks.filter((d) => !d.claimed);
  const key = JSON.stringify([s.q, s.bq, dl, Board.trackKey(s)]);
  setOnce($("#quest-track"), key, (qt) => {
    if (!quest && !s.bq && !(dl && dl.length) && !Board.active(s)) return;
    const head = el("div", "qh"); head.append(iconImg("scroll", "#e2c486"), "의뢰");
    qt.append(head);
    const goal = (label, n, need, doneText) => {
      const done = n >= need, row = el("div", "qp");
      if (done) row.append(el("span", "done", doneText));
      else {
        const bar = el("div", "bar"), f = el("i");
        f.style.width = `${clamp((n / need) * 100, 0, 100)}%`;
        bar.append(f);
        row.append(el("span", "", label), bar, el("span", "", `${n}/${need}`));
      }
      return row;
    };
    Board.trackRows(s, qt, goal);                     // the 알바 in hand comes first: a parcel is on the clock (board.js)
    if (quest && s.q.st === 1) {
      const t = el("div", "qt"); t.append(el("small", "", "주요"), quest.title);
      qt.append(t, goal(G.defs.mobs[quest.mob].name, s.q.n, quest.n, "완료! 엘더윈에게 돌아가세요"));
    } else if (quest) {
      const t = el("div", "qt"); t.append(el("small", "", "주요"), "엘더윈에게 새 의뢰가 있습니다");
      qt.append(t);
    }
    if (s.bq) {
      const t = el("div", "qt"); t.append(el("small", "", "반복"), `${mobs[s.bq.k].name} 토벌`);
      qt.append(t, goal(mobs[s.bq.k].name, s.bq.n, s.bq.need, "완료! 엘더윈에게 보고하세요"));
    }
    if (dl && dl.length) {
      const t = el("div", "qt"); t.append(el("small", "", "일일"), `오늘의 과제 ${3 - dl.length}/3`);
      qt.append(t);
      for (const d of dl) qt.append(goal(d.text, d.n, d.need, `${d.text} — 완료! (U)`));
    }
  });
}

export function draw(id, keyOf, fn) {
  if (!isOpen(id)) return;
  const k = JSON.stringify(keyOf());
  if (shown[id] === k) return;
  shown[id] = k;
  if (tip.from && winEl(id).contains(tip.from)) hideTip();
  fn(G.self);
  keepIn(id);
}
export function refreshUi() {
  const s = G.self;
  if (!s) return;
  hudFrame(s);
  hotbar(s);
  tracker(s);
  const near = G.near && G.near.role;
  draw("inv", () => [s.inv, s.gold, s.eq, s.lvl, G.sel, near, isOpen("shop"), isOpen("smith"), fireNear(), touch(), s.pet, s.qs, s.bagCap, Gather.pouchKey(s)], renderInv);
  // the C window: 장비 or 능력치 (points can be bought by a campfire or at 수련관 카이)
  draw("char", () => G.charTab === "cos" ? ["cos", s.xp, s.nx] : G.charTab === "stat"
    ? ["stat", s.st, s.lvl, s.xp, s.xpt, s.nx, s.rs, s.dv, s.atk, s.mhp, s.mmp, s.def, s.crit, s.critd, s.mf, s.job, s.wk, s.eq.weapon && s.eq.weapon.id, s.dead, fireNear(), near, StatWin.key()]
    : ["gear", dollDocked(), s.xp, s.nx, s.eq, s.atk, s.def, s.mhp, s.mmp, s.crit, s.critd, s.ls, s.xpb, s.mf, s.goldb, s.acd, s.kills, s.st, s.dv, s.skLv, s.job, s.lg, s.lvl, s.name, s.guild], renderChar);
  dockedDoll(s);
  // K: 무기 · 스킬 or 전직의 길
  draw("skill", () => [G.skTab, s.lvl, s.job, s.wk, s.wk2, s.acd, s.range, s.eq.weapon && s.eq.weapon.id, s.wm, s.qs, s.gold, JSON.stringify(s.sk), near, JobTree.key(), JobTree.weaponKey(), JobTree.treeKey()], renderSkills);
  draw("shop", () => [s.gold, s.cls, s.lvl, s.inv, G.near, s.rep], renderShop);
  draw("smith", () => [s.eq, s.enh, s.gold, countItem("stone")], renderSmith);
  draw("train", () => [s.xp, s.xpt, s.nx, s.rs, s.sw, s.lvl, s.inv.length, near, StatWin.trainerKey()], (s) => StatWin.renderTrainer($("#train-body"), s, { atTrainer: near === "train" }));
  draw("job", () => [s.job, s.wm, s.gold, near, JobTree.key()], (s) => JobTree.renderJobNpc($("#job-body"), s, { atJob: near === "job" }));
  draw("bank", () => [s.inv, s.wh, s.gold], Growth.renderBank);
  draw("quest", () => [s.q, s.bq, s.bn, s.mk, s.lvl, near, G.qsel, s.sq], renderQuest);
  draw("talk", () => [s.sq, s.lvl, talk.npc && talk.npc.id, Board.talkKey(s)], () => { SideQ.renderTalk($("#talk-sq"), talk.npc, s, (line) => { $("#talk-text").textContent = line; }); Board.renderTalk(talk.npc, s); });
  draw("warp", () => [s.wp, G.map && G.map.id, stoneNear(), near, G.warpPick], renderWarp);
  draw("daily", () => [s.daily && s.daily.day, s.daily && s.daily.tasks, s.daily && s.daily.bonus, s.inv.length], renderDaily);
  draw("achieve", () => [s.ach, s.title, s.pts, G.achTab], renderAchieve);
  draw("collect", () => [s.mk, s.col, G.colTab], renderCollect);
  Wardrobe.refresh(s);
  Housing.refresh(s);
  Life.refresh(s);
  draw("craft", Station.key, Station.render);   // the life stations: 제작 연금 요리 (station.js)
  draw("board", Board.key, Board.render);       // the 알바 board (board.js)
  tutCard(s);
}
/** The paper-doll docked in the side column (desktop): redrawn when the gear or the name line changes; its tab buttons light with the C window. */
function dockedDoll(s) {
  if (!dollDocked()) return;
  const k = JSON.stringify([s.eq, s.lvl, s.name, s.cls, s.job, touch()]);
  if (shown.doll !== k) {
    shown.doll = k;
    if (tip.from && $("#side-char").contains(tip.from)) hideTip();
    renderDoll(s);
  }
  const on = isOpen("char") ? G.charTab || "gear" : "";
  for (const b of $("#sc-tabs").children) b.classList.toggle("on", b.dataset.t === on);
}
export function section(text, glyph) {
  const h = el("div", "section");
  if (glyph) h.append(iconImg(glyph, "#e2c486"));
  h.append(text);
  return h;
}

const cgauge = $("#cgauge");
/** The sky widget over the minimap: the phase and hour (sun or moon), and the weather. */
const skyHud = { at: 0, key: "" };
function skyTick(t) {
  if (t - skyHud.at < 500 || !G.map) return;
  skyHud.at = t;
  const out = Sky.weather() >= 0 && !G.map.indoor, box = $("#sky");
  if (box.hidden === out) box.hidden = !out;
  // the stumps' songs: shown while you sit
  const jam = $("#jam");
  if (jam.hidden === !!G.me.sit) jam.hidden = !G.me.sit;
  if (!out) return;
  const h = Sky.hour(), text = `${Sky.clockText(h)} · ${Sky.weatherName()}`;
  if (text === skyHud.key) return;
  skyHud.key = text;
  $("#sky-t").textContent = text;
  Sky.drawIcon($("#sky-ic"), h);
}
export function hudTick(t) {
  eventWidget(t);
  skyTick(t);
  castBar(t);
  Board.tick(t);                                    // a parcel's countdown (board.js)
  if (isOpen("daily")) tickDaily(t);
  const s = G.self;
  if (!s) return;
  // the weapon gauge (weapongauge.js); a fault there must never stop the frame
  try { drawWeaponGauge(cgauge, s, G.defs, t); } catch (err) { if (!hudTick.warned) { hudTick.warned = true; console.warn("weapon gauge:", err); } }
  QS.tick(t);
  if (tip.from && (!tip.from.isConnected || tip.from.closest("[hidden]"))) hideTip();
  if (isOpen("char") || dollDocked()) drawPortrait(t);
  // the kill streak: counts up while kills keep coming, drains between them
  const sb = $("#streak"), k = G.streak;
  const live = k && k.n >= 2 && t < k.end;
  if (sb.hidden === live) sb.hidden = !live;
  if (live) {
    const want = `${k.n}`;
    if (sb.dataset.v !== want) {
      sb.dataset.v = want;
      $("#streak-n").textContent = `연속 처치 ${k.n}`;
      $("#streak-b").textContent = `EXP +${Math.min(G.defs.streak[1], k.n - 1) * 2}%`;
      sb.classList.remove("pop"); void sb.offsetWidth; sb.classList.add("pop");
    }
    $("#streak-bar").style.width = `${clamp((k.end - t) / G.defs.streak[0], 0, 1) * 100}%`;
  }
  const buffs = $("#st-buffs");
  // each status is its glyph and the time left; the last three are things done to you
  const names = ["공격력 증가", "이동속도 증가", `모닥불의 온기: 경험치 +${s.warm}%`, s.food ? G.defs.items[s.food].name : "음식", "둔화: 이동속도 감소", "화상: 지속 피해", "중독: 지속 피해", "공격의 주문서: 공격력 +10%", "방어의 주문서: 받는 피해 -12%", "경험의 주문서: 경험치 +20%", "질주의 바람: 이동속도 +30%", `안락한 휴식: 경험치 +${G.defs.house ? G.defs.house.rest.xp : 8}%`];
  const bad = (i) => i >= 4 && i < 7;
  const left = (ms) => (ms > 90000 ? `${Math.ceil(ms / 60000)}분` : `${Math.ceil(ms / 1000)}`);
  const shownB = G.buffEnd.map((e, i) => (e > t ? [i, left(e - t)] : null)).filter(Boolean);
  const want = shownB.map(([i, l]) => `${i}:${l}`).join("|");
  if (buffs.dataset.v !== want) {
    buffs.dataset.v = want;
    buffs.textContent = "";
    for (const [i, l] of shownB) {
      const scr = i >= 7 && i < 10;
      const sp = el("span", bad(i) ? "bad" : scr ? "scr" : "", l);
      sp.title = names[i];
      sp.prepend(iconImg(BUFF_ICON[i], bad(i) ? "#ff9a8a" : scr ? "#9ad8ff" : i === 10 ? "#9affc8" : i === 11 ? "#ffb0c8" : "#e2c486"));
      buffs.append(sp);
    }
  }
}

/** Start-up wiring (listeners, DOM tweaks), run once: client.js calls it where this code used to stand, so the order is unchanged. */
export function setupHud() {
  $("#wm").addEventListener("mouseenter", () => { if (!touch()) showMasteryTip(); });
  $("#wm").addEventListener("mouseleave", () => { if (tip.from === $("#wm")) hideTip(); });
  // a click (a tap) opens 전직의 길: every weapon's mastery and where it leads
  $("#wm").addEventListener("click", () => { if (!G.self) return; hideTip(); openTree(); });
  $("#wm").title = "눌러서 전직의 길 보기 (K)";
  // the EXP bar: a click opens the 능력치 tab
  $("#exp").addEventListener("click", () => { if (G.self) openStats(); });
  $("#exp").title = "눌러서 능력치 열기 — 모닥불 곁이나 수련관 앞에서 레벨을 올립니다";
  $("#quest-track").addEventListener("click", () => toggleWin("quest"));
  // a clicked button lets go of the focus, so Space and Enter go back to the game
  addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("button"); if (b && document.activeElement === b) b.blur(); });
}
