/**
 * 협동 아르바이트 in the browser (logic 68-coop.js,
 * docs/design/life-and-coop.md C). The server decides everything; this draws and asks.
 * - Lobby: by the job's owner (관리인 동동, 쥬쥬, 캉캉, 보글) a card offers [근무 시작] → `coop_start {k}` (the party comes along).
 * - 올빼미 도서관: C rows 13 animate arriving guests, requests and departures; the team row names the held book.
 * - 동동아파트: labeled trash you stand on to pick up and a labeled automatic bin return station.
 * - Inside: `cj` drives the HUD line (time, score ×mult, grade and the next cut-off, the job's sum), `C` the trash /
 *   orders / pots / plated dishes (scene props), `cr` the report card. Space / F (or the [일하기]
 *   button) send `coop_act`; [그만두기] `coop_leave`.
 * - Events `["cb", anvil id, ms to the first beat, beat ms]` (the forge's beat ring) and `["cj", code, x, y, a]`: 5 bin deposited · 6 trash picked · 14 fever · 15 complaint ·
 *   21 the end · diner 30 off the stove · 31 on the stove · 32 angry · 38 served · 40 a new order ·
 *   42 plate returned · 43 plate picked up · 44 overdue plate · forge 9/10/11 strike
 *   perfect/good/miss · 12 quench · 13 deliver · 17 pump · 50 bar from the crate · 51 into the fire · 53 hot · 54 out hot ·
 *   55 onto the anvil · 56 cooled piece taken · 57 shaped piece taken · 58 shaped · 61 late order (forge: an angry customer) ·
 *   62 new order (a customer at the door) · 64 cooled · 65 furnace in the band · 66 a piece onto the 진열대.
 * - Forge uses the assigned players and beat countdown in its anvil rows. Both workers tap Space;
 *   raw work (F) and beat actions use separate intents within `coop_act`.
 */
import * as Keymap from "./keymap.js";
import * as Diner from "./coop-diner.js";
import * as Forge from "./coop-forge.js";
import * as Library from "./coop-library.js";
import { closeWalkthrough, hasWalkthrough, openWalkthrough, setWorkPrompt } from "./coop-briefing.js";
import * as SP from "./sprites.js";
import { PRESETS } from "./species.js";
import { drawTrash } from "./coop-briefing-art.js";

const T = 16;
const now = () => performance.now();
let A = null;   // { G, S3, Sound, act, toast, entityPos }
const st = { cj: null, at: 0, ents: [], keys: [], team: [], hud: null, card: null, res: null, cardKey: "", lane: null, flash: {}, stop: 0, trashTiles: new Set(), pickup: null };
const DIRS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }, DIR_ACT = { up: 0, right: 1, down: 2, left: 3 };

export function init(api) {
  A = api; window.__coop = st;   // st exposed for automation (like window.__game)
  // Capture the shift's work keys before combat or conversation. Alchemy uses the direction keys on its lane.
  addEventListener("keydown", (e) => {
    if (e.code === "Escape" && closeWalkthrough(true)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (!inside() || /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) return;
    if (Diner.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (jobOf() === "forge") {
      if (e.code !== "Space" && e.code !== "KeyF" && !(Forge.active() && e.code === "Escape")) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.code === "Space") Forge.tap();
      else if (e.code === "Escape") Forge.cancel();
      else Forge.work();
      return;
    }
    const d = st.lane ? (e.code in DIRS ? DIRS[e.code] : DIR_ACT[Keymap.actionOf(e)]) : undefined;
    if (d !== undefined) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) work(d); return; }
    if (e.repeat || (e.key !== " " && e.key !== "f" && e.key !== "F" && e.key !== "ㄹ")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    work();
  }, true);
}
/** Some co-op controls claim otherwise shared movement keys. */
export const lane = () => !!st.lane || Diner.menuOpen() || Forge.active();
export const boardActive = () => false;
const G = () => A.G;
const D = () => (G().defs && G().defs.coop) || { jobs: {}, kinds: ["apt"], tools: {}, binCap: 10, near: 56 };
const inside = () => !!st.cj;
const working = () => st.cj?.[1] === 1 || st.cj?.[1] === 2;
const work = (d) => {
  if (!working()) return;
  if (jobOf() === "diner") Diner.interact();
  else if (jobOf() === "lib") Library.interact();
  else if (jobOf() === "apt" && (st.pickup?.hidden ?? true)) return;
  else A.act(d === undefined ? { t: "coop_act" } : { t: "coop_act", d });
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const GRADE = ["-", "C", "B", "A", "S"];

// ───────────────────────────── the snapshot ─────────────────────────────

export function onSnap(s) {
  let ents = "C" in s ? s.C || [] : null;
  if ("cj" in s) {
    if (st.cj && !s.cj) closeWalkthrough();
    const was = st.team.map((r) => r[0]).join();
    st.cj = s.cj || null; st.at = now();
    st.team = st.cj ? st.cj[10] || [] : [];
    const job = jobOf(), team = new Map(st.team.map((row) => [row[0], row]));
    const gear = (p, eid) => {
      const row = team.get(eid);
      p.aptBin = job === "apt" && row ? (row[2] >= D().binCap ? 2 : 1) : 0;
      p.dinerItem = job === "diner" ? (row?.[4]?.[0] ?? -1) + 1 : 0;
      p.dinerWorker = job === "diner" && !!row;
      p.forgeTool = job === "forge" && row ? row[1] + 1 : 0;
      p.forgeMetal = p.forgeTool === 1 ? row[4] : 0;
      p.libraryBook = job === "lib" ? (row?.[4]?.[0] ?? -1) + 1 : 0;
      p.libraryWorker = job === "lib" && !!row;
    };
    gear(G().me, G().you);
    for (const [eid, p] of G().players) gear(p, eid);
    if (job !== "diner") Diner.update(null);
    if (job !== "forge") Forge.update(null);
    if (job !== "lib") Library.update(null);
    if (!st.cj) ents = [];
    else if (!ents && st.team.map((r) => r[0]).join() !== was) ents = st.ents;   // someone left: their tool goes
    renderHud();
  }
  if (ents) setEnts(ents);
  if (s.cr) {
    closeWalkthrough();
    showReport(s.cr);
  }
}
const jobOf = () => (st.cj ? D().kinds[st.cj[0]] : null);
const smithy = (k) => k === "forge" || k === "alch";
/** Fixed job stations get a little icon each. */
function setStations(k) {
  const j = D().jobs[k], sts = j && j[7];
  if (!sts) return;
  const [spot, code] = k === "apt" ? ["dump", 20] : ["herbs", 13];
  const [tx, ty] = sts[spot], key = "cs" + spot;
  st.keys.push(key);
  A.S3.props.set(key, { x: tx * T + 8, y: ty * T + 10, until: Infinity, draw(g, tt, sx, sy) { drawIcon(g, Math.round(sx), Math.round(sy) - 22, code); } });
}
/** The entities as scene props (the old ones go). */
function setEnts(rows) {
  for (const k of st.keys) A.S3.props.delete(k);
  st.keys = [];
  st.ents = rows; st.entsAt = now();
  const job = jobOf();
  const waiting = job === "lib" ? rows.filter((r) => r[1] === 13 && r[9] === 1) : [];
  const loan = waiting.find((r) => r[4] === 0 && !r[13]) || waiting.find((r) => r[4] === 0);
  const notices = [loan?.[0], waiting.find((r) => r[4] === 1)?.[0]];
  st.trashTiles.clear();
  for (const row of rows) {
    const [id, t, x, y, item] = row, key = "cp" + id;
    if (job === "apt") {
      st.trashTiles.add(trashTile(x, y));
      st.keys.push(key);
      A.S3.props.set(key, { x, y, until: Infinity, draw(g, tt, sx, sy) { drawTrashProp(g, Math.round(sx), Math.round(sy), x, y, item); } });
      continue;
    }
    if (job === "diner" || job === "forge" || job === "lib") {
      st.keys.push(key);
      A.S3.props.set(key, { x, y, until: Infinity, draw(g, tt, sx, sy) {
        sx = Math.round(sx); sy = Math.round(sy);
        if (job === "diner") Diner.drawDiner(g, tt, sx, sy, row, dsLeft, D().cook, drawCustomerBody);
        else if (job === "forge") Forge.drawForge(g, tt, sx, sy, row, dsLeft, drawCustomerBody);
        else Library.drawCustomer(g, tt, sx, sy, row, LB(), drawCustomerBody, notices.includes(id), dsLeft);
      } });
      continue;
    }
    if (t === 8 && row.length < 10) continue;   // the alch's orders: on the HUD only (the forge's customers walk in)
    st.keys.push(key);
    if (t === 8) { A.S3.props.set(key, { x, y, until: Infinity, cust: row, draw(g, tt, sx, sy) { drawCustomer(g, tt, Math.round(sx), Math.round(sy), row); } }); continue; }
    A.S3.props.set(key, { x, y, until: Infinity, draw(g, tt, sx, sy) { t === 11 ? drawKiln(g, tt, Math.round(sx), Math.round(sy), row) : t === 12 ? drawPot(g, tt, Math.round(sx), Math.round(sy), row) : drawShelved(g, tt, Math.round(sx), Math.round(sy), row); } });
  }
  if (job === "apt" || job === "alch") setStations(job);
  const prop = (key, prop) => {
    const name = "cd" + key;
    st.keys.push(name);
    A.S3.props.set(name, prop);
  };
  if (job === "apt") prop("inspector", { x: 0, y: 0, until: Infinity, draw(g, t, x, y) {
    if (!this.present) return;
    drawCustomerBody(g, t, Math.round(x), Math.round(y), 2, this.moving);
    g.font = "8px Galmuri11, monospace"; g.textAlign = "center"; g.fillStyle = "#fff1c8";
    g.fillText("관리인 동동", Math.round(x), Math.round(y) - 22);
  } });
  if (job === "diner") Diner.stations(D().jobs.diner[7], prop);
  if (job === "forge") Forge.stations(D().jobs.forge[7], prop);
  if (job === "lib") Library.stations(D().jobs.lib[7], LB(), prop);
  if (job !== "alch") return;
  for (const [eid] of st.team) {
    const key = "ct" + eid;
    st.keys.push(key);
    A.S3.props.set(key, { x: 0, y: 0, until: Infinity, eid, draw(g, tt, sx, sy) { drawTool(g, tt, Math.round(sx), Math.round(sy), eid); } });
  }
}

// ───────────────────────────── art (code-drawn, one shadow tone, dark outline) ─────────────────────────────

const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const trashSprites = [];
const trashTile = (x, y) => Math.floor(x / T) + Math.floor(y / T) * G().map.w;
function drawTrashProp(g, sx, sy, x, y, variant) {
  const here = trashTile(G().me.x, G().me.y) === trashTile(x, y);
  if (!trashSprites[variant]) {
    const cv = Object.assign(document.createElement("canvas"), { width: 9, height: 7 });
    drawTrash(cv.getContext("2d"), 0, 0, variant);
    trashSprites[variant] = cv;
  }
  if (here) {
    px(g, sx - 7, sy, 15, 1, "#e9bd63");
    px(g, sx - 4, sy + 1, 9, 1, "#ffe9a2");
  }
  g.drawImage(trashSprites[variant], sx - 4, sy - 7);
  g.font = "8px Galmuri11, monospace";
  g.textAlign = "center";
  px(g, sx - 13, sy - 18, 26, 10, here ? "#493221" : "#272026");
  g.fillStyle = here ? "#ffe2a3" : "#fff3d7";
  g.fillText("쓰레기", sx, sy - 10);
}

// ───────────────────────────── 올빼미 도서관 (lib): returners, books on the 반납대, wrong books, shelf signs ─────────────────────────────

const LB = () => D().lib;

/** Station badge for the return bin or the dormant alchemy workshop. */
function drawIcon(g, x, y, code) {
  if (code === 20) {   // 버리는 곳: a green skip with its lid up and an arrow down, named
    px(g, x - 8, y - 4, 17, 9, "#10200e"); px(g, x - 7, y - 3, 15, 7, "#3a8a3a"); px(g, x - 7, y - 3, 15, 1, "#6ac060"); px(g, x - 6, y, 13, 1, "#2a6a2a");
    px(g, x - 8, y - 8, 9, 3, "#10200e"); px(g, x - 7, y - 7, 7, 1, "#6ac060");
    px(g, x + 3, y - 11, 2, 5, "#fff2a0"); px(g, x + 1, y - 7, 6, 1, "#fff2a0"); px(g, x + 2, y - 6, 4, 1, "#fff2a0");
    g.font = "8px Galmuri11, monospace"; g.textAlign = "center"; g.fillStyle = "#10200e"; g.fillText("반납대", x + 1, y - 13); g.fillStyle = "#c8f0a0"; g.fillText("반납대", x, y - 14); g.textAlign = "left";
    return;
  }
  if (code === 12) { px(g, x - 2, y - 3, 5, 6, "#10203a"); px(g, x - 1, y - 2, 3, 4, "#5aa0e0"); px(g, x, y - 4, 1, 1, "#10203a"); }   // 담금질 물
  else if (code === 13) { px(g, x - 4, y - 1, 9, 4, "#3a2a1a"); px(g, x - 3, y, 7, 2, "#b08a5a"); px(g, x - 3, y - 3, 2, 2, "#5ab04a"); px(g, x, y - 4, 2, 3, "#3a8a3a"); px(g, x + 2, y - 3, 2, 2, "#8fd060"); }   // 약재 바구니
  else if (code === 14) drawBrew(g, x, y + 1, 3, 4, 0);   // 병입대: an empty bottle
  else if (code === 15) { px(g, x - 5, y - 1, 11, 5, "#1a1e28"); px(g, x - 4, y, 9, 3, "#8a9aaa"); px(g, x - 3, y, 7, 2, "#5aa0e0"); px(g, x + 2, y - 5, 2, 4, "#1a1e28"); px(g, x, y - 5, 3, 1, "#1a1e28"); px(g, x + 2, y - 4, 1, 3, "#c8d0d8"); }   // 개수대
}
/** 보글's brews: order colours (빨간 물약 · 파란 물약 · 엘릭서 · 묘약; −1 herbs) and the kiln's green/purple boil by heat. */
const BREW = ["#e04848", "#4878e0", "#e8c040", "#a050d0", "#5ac060"];
/** Herb colours by arrow (↑ 붉은 꽃잎 · → 푸른 이끼 · ↓ 황금 뿌리 · ← 보라 버섯); 무지개 물약 (5) cycles through them. */
const HERB_COL = ["#e04848", "#4878e0", "#e8c040", "#a050d0"];
const brewC = (k, t) => (k === 5 ? HERB_COL[Math.floor(t / 200) % 4] : BREW[k] || BREW[0]);
const brewCol = (h, t) => (h >= 100 ? (Math.floor(t / 250) % 2 ? "#e0ffb0" : "#c890ff") : h >= 70 ? "#8fe070" : h >= 40 ? "#b070e0" : h >= 15 ? "#5a3a6a" : "#4a5a3a");
/** A brew in hand or in the cauldron by state (1 herbs · 2 boiling · 3 stirred · 4 bottled) and kind. */
function drawBrew(g, x, y, kind, s, t) {
  if (s <= 1) { px(g, x - 4, y - 3, 8, 4, "#1a2a14"); px(g, x - 3, y - 2, 2, 2, "#5ab04a"); px(g, x - 1, y - 3, 2, 3, "#3a8a3a"); px(g, x + 1, y - 2, 2, 2, "#8fd060"); return; }
  if (s === 2 || kind < 0) { px(g, x - 4, y - 2, 8, 4, "#1a1a20"); px(g, x - 3, y - 1, 6, 2, Math.floor(t / 200) % 2 ? "#8fe070" : "#b070e0"); px(g, x - 1 + (Math.floor(t / 300) % 3), y - 4, 1, 1, "#e0ffb0"); return; }
  const c = brewC(kind, t);
  if (s === 3) { px(g, x - 4, y - 2, 8, 4, "#1a1a20"); px(g, x - 3, y - 1, 6, 2, c); return; }
  px(g, x - 3, y - 4, 6, 8, "#1a1a20"); px(g, x - 1, y - 6, 2, 2, "#1a1a20");   // a bottle
  px(g, x - 2, y - 1, 4, 4, c); px(g, x - 2, y - 3, 4, 2, "#d8e8f0"); px(g, x - 1, y - 7, 2, 1, "#8a5a2a");
}
/** The four ingots' colours (owner: 철 grey · 은 white-blue · 금 yellow · 미스릴 teal, glowing). */
const METAL = ["#8a909a", "#dce8f8", "#f0c840", "#40d8c0"];
const metalCol = (m, t) => (m === 3 && Math.floor(t / 300) % 3 === 0 ? "#a8fff0" : METAL[m] || METAL[0]);
/**
 * A forge piece in hand, on the anvil or on show by its state (1 cold ingot · 2 hot · 3 shaped · 4 quenched), kind (0 편자 · 1 단검 ·
 * 2 검날 · 3 투구 · 4 냄비 · 5 방패 · 6 갑옷) and ingot m (its colour once cold and finished).
 */
function drawPiece(g, x, y, kind, s, t, m = 0) {
  if (jobOf() === "alch") return drawBrew(g, x, y, kind, s, t);
  const c = s === 2 ? (Math.floor(t / 200) % 2 ? "#fff0a0" : "#ffb040") : s === 4 ? metalCol(m, t) : s === 3 ? "#d0602a" : metalCol(m, t);
  if (s <= 2 || kind < 0) { px(g, x - 5, y - 2, 10, 4, "#1a1a20"); px(g, x - 4, y - 1, 8, 2, c); return; }
  px(g, x - 5, y - 4, 10, 7, "#1a1a20");
  if (kind === 0) { px(g, x - 4, y - 3, 2, 5, c); px(g, x + 2, y - 3, 2, 5, c); px(g, x - 4, y - 3, 8, 2, c); }                                   // 편자
  else if (kind === 1) { px(g, x - 2, y - 1, 6, 2, c); px(g, x - 4, y - 2, 1, 4, "#6a4a2a"); px(g, x - 3, y - 1, 1, 2, "#6a4a2a"); }              // 단검
  else if (kind === 2) { px(g, x - 4, y - 1, 8, 2, c); px(g, x + 4, y - 1, 1, 1, c); px(g, x - 4, y - 3, 1, 5, "#6a4a2a"); }                       // 검날
  else if (kind === 3) { px(g, x - 3, y - 3, 6, 4, c); px(g, x - 4, y - 1, 1, 3, c); px(g, x + 3, y - 1, 1, 3, c); px(g, x - 1, y - 1, 2, 3, "#1a1a20"); }   // 투구
  else if (kind === 4) { px(g, x - 4, y - 2, 8, 4, c); px(g, x - 3, y - 3, 6, 1, c); px(g, x - 5, y - 2, 1, 1, c); px(g, x + 4, y - 2, 1, 1, c); }   // 냄비
  else if (kind === 5) { px(g, x - 3, y - 3, 6, 5, c); px(g, x - 2, y + 2, 4, 1, c); px(g, x - 1, y - 2, 2, 3, "#d0a040"); }                        // 방패
  else { px(g, x - 4, y - 3, 8, 5, c); px(g, x - 2, y - 3, 4, 1, "#1a1a20"); px(g, x - 4, y + 2, 2, 1, c); px(g, x + 2, y + 2, 2, 1, c); px(g, x - 1, y - 1, 2, 2, "#e8e8f0"); }   // 갑옷
}
/** A piece on the 진열대 [id, 10, x, y, kind, grade]: on a cloth, 걸작 twinkling. */
function drawShelved(g, t, sx, sy, row) {
  const [, , , , k, gi, m] = row;
  px(g, sx - 7, sy - 14, 14, 2, ["#e8c040", "#c84a3a", "#5a7ab0", "#6a6a70"][gi] || "#6a6a70");
  drawPiece(g, sx, sy - 16, k, 4, t, m);
  if (!gi && Math.floor((t + row[0] * 137) / 300) % 4 === 0) { px(g, sx + 4, sy - 23, 1, 3, "#ffffff"); px(g, sx + 3, sy - 22, 3, 1, "#ffffff"); }
}
/** Where a customer stands now: walking in from the door, at their seat, or walking out (48 px/s like the rules' `walk`). */
function custPos(row) {
  const [, , x, y, , , , arr, gone, out] = row, d = D().door || [x, y + 144], len = Math.hypot(d[0] - x, d[1] - y), walk = (len / 48) * 1000;
  const f = gone ? 1 - Math.max(0, dsLeft(out)) / 2500 : Math.max(0, dsLeft(arr)) / walk;
  const k = Math.max(0, Math.min(1, f));
  return [x + (d[0] - x) * k, y + (d[1] - y) * k];
}
/** A villager customer (code-drawn, a colour per id): the piece they want in a bubble with a patience bar; happy or cross on the way out. */
const visitors = [];
function drawCustomerBody(g, t, sx, sy, id, moving, sitting = false) {
  const slot = Math.abs(id) % PRESETS.length;
  const sheet = visitors[slot] ||= SP.personSheet(SP.npcLook(PRESETS[slot][1]));
  const pose = moving ? [SP.FRAME.stepA, SP.FRAME.stretch, SP.FRAME.stepB, SP.FRAME.stretch][Math.floor(t / 135) % 4]
    : Math.floor(t / 420) % 3 ? SP.FRAME.stand : SP.FRAME.breathe;
  const h = sitting ? SP.SIZE - 3 : SP.SIZE, dx = sx - SP.FOOT[0], dy = sy - SP.FOOT[1] + (sitting ? 3 : 0);
  g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(sx, sy, 5, 2, 0, 0, 7); g.fill();
  g.globalAlpha = 1;
  g.drawImage(sheet.front[pose], dx, dy, SP.SIZE, h);
}
function drawCustomer(g, t, sx, sy, row) {
  const [id, , , , k, left, dur, arr, gone] = row, moving = gone || dsLeft(arr) > 0;
  drawCustomerBody(g, t, sx, sy, id, moving);
  if (gone === 1) { px(g, sx - 1, sy - 26, 3, 3, "#ffd860"); px(g, sx, sy - 25, 1, 1, "#a07010"); return; }      // paid: a coin
  if (gone === 2) { px(g, sx + 3, sy - 24, 2, 4, "#e05040"); px(g, sx + 3, sy - 19, 2, 1, "#e05040"); return; }  // cross
  if (moving) return;
  const f = Math.max(0, Math.min(1, dsLeft(left) / (dur * 100))), y = sy - 30;
  px(g, sx - 9, y - 9, 18, 13, "#2a2a30"); px(g, sx - 8, y - 8, 16, 11, "#fff8e8"); px(g, sx - 1, y + 4, 3, 2, "#2a2a30");
  drawPiece(g, sx, y - 2, k, 4, t, row[10]);
  if (row[10] !== undefined) px(g, sx + 6, y - 7, 2, 2, metalCol(row[10], t));   // the ingot it needs, a pip in the corner
  px(g, sx - 8, y + 7, 16, 3, "#2a2a30");
  px(g, sx - 7, y + 8, Math.max(1, Math.round(14 * f)), 1, f > 0.5 ? "#6ad050" : f > 0.25 ? "#e8c040" : "#e05040");
}
const BR = () => D().brew || { orders: [], chart: [], loop: 8, amb: 20, herbs: [], foam: 5 };
const potRow = () => st.ents.find((r) => r[1] === 12);
/** The recipe the kiln works for: the cauldron's brew, else the one the next herbs make. */
const kilnRecipe = () => { const p = potRow(); return p ? (p[4] >= 0 && p[5] !== 2 ? p[4] : p[10]) : 0; };
/** The kiln's heat now: the snapshot's, cooled toward the room's since. */
const kilnHeat = (row) => { const amb = BR().amb; return amb + (row[4] / 10 - amb) * Math.exp(-(row[7] / 1000) * ((now() - (st.entsAt || 0)) / 1000)); };
function drawArrow(g, x, y, d, c) {
  px(g, x - 3, y - 4, 7, 7, "#1a1a20"); px(g, x - 2, y - 3, 5, 5, c);
  if (d === 0 || d === 2) { px(g, x, y - 2, 1, 4, "#ffffff"); px(g, x - 1, d ? y + 1 : y - 2, 3, 1, "#ffffff"); }
  else { px(g, x - 2, y, 4, 1, "#ffffff"); px(g, d === 1 ? x + 1 : x - 2, y - 1, 1, 3, "#ffffff"); }
}
/** The big kiln: a brick dome glowing with the heat, a tall thermometer with the brew's band, the shared note lane above. */
function drawKiln(g, t, sx, sy, row) {
  const H = kilnHeat(row), r = kilnRecipe(), O = BR().orders[r] || ["", 0, 100], bc = brewC(r, t);
  px(g, sx - 14, sy - 37, 28, 5, "#2a1a14"); px(g, sx - 17, sy - 32, 34, 21, "#2a1a14"); px(g, sx - 12, sy - 36, 24, 3, "#a0583a");
  px(g, sx - 16, sy - 31, 32, 19, "#8a4a30"); for (let i = 0; i < 4; i++) px(g, sx - 16, sy - 28 + i * 4, 32, 1, "#5a2e1e");
  px(g, sx - 3, sy - 44, 6, 8, "#2a1a14"); px(g, sx - 2, sy - 43, 4, 7, "#6a3a24");   // chimney
  const mouth = H >= 80 ? "#fff0a0" : H >= 60 ? "#ffb040" : H >= 40 ? "#ff7030" : H >= 28 ? "#a0402a" : "#3a2a2a";
  px(g, sx - 10, sy - 22, 20, 9, "#1a1014"); px(g, sx - 9, sy - 21, 18, 7, H >= 40 && Math.floor(t / 160) % 3 === 0 ? "#ffe080" : mouth);
  if (H >= 55 && Math.floor(t / 240) % 2) px(g, sx - 1, sy - 48 - (Math.floor(t / 120) % 3), 2, 2, "#c8c8d0");   // smoke
  // thermometer: 40 px, the brew's band as brackets in its colour, the level blue below · gold in band · red over
  const x = sx + 21, y = sy - 52, Hh = 40, lv = (v) => y + Hh - Math.round((Math.max(0, Math.min(100, v)) / 100) * Hh);
  px(g, x - 1, y - 1, 7, Hh + 7, "#1a1a20"); px(g, x, y, 5, Hh, "#3a3a44");
  px(g, x - 3, lv(O[2]), 2, lv(O[1]) - lv(O[2]) + 1, bc); px(g, x + 6, lv(O[2]), 2, lv(O[1]) - lv(O[2]) + 1, bc);
  const col = H > O[2] + 6 ? (Math.floor(t / 150) % 2 ? "#ff4030" : "#ffd0a0") : H >= O[1] && H <= O[2] ? "#ffd860" : H > O[2] ? "#ff9a40" : "#5a8ad0";
  px(g, x + 1, lv(H), 3, y + Hh - lv(H), col); px(g, x - 1, y + Hh, 7, 5, "#1a1a20"); px(g, x, y + Hh + 1, 5, 3, col);
  if (st.joint && now() - st.joint[0] < 900) { g.fillStyle = "#ffe060"; g.font = "8px Galmuri11, monospace"; g.fillText(`합동 풀무! ×${st.joint[1]}`, sx - 28, sy - 70 - Math.round((now() - st.joint[0]) / 90)); }
  drawBrewLane(g, sx, sy - 62, row);
}
/** The shared chart sliding onto the hit line (2 s ahead), arrows in their herb colours; yours brighter and flashing on your notes. */
function drawBrewLane(g, sx, y, row) {
  const [id, , , , , b0, per] = row, B = BR(), L = B.chart.length;
  if (!L || !(st.cj && (st.cj[1] === 1 || st.cj[1] === 2))) return;
  const nowL = now() < st.stop ? st.stopAt : now(), base = (st.entsAt || 0) + b0, W = 96, x0 = sx - 48, hit = x0 + 10, span = 2000, mine = st.lane === id;
  px(g, x0 - 1, y - 7, W + 2, 14, "#1a1a20"); px(g, x0, y - 6, W, 12, mine ? "#2a2440" : "#221e2a");
  const fl = st.flash[id], fla = fl && now() - fl[0] < 160 ? fl[1] : -1;
  px(g, hit - 1, y - 6, 3, 12, fla === 0 ? "#ffffff" : fla === 1 ? "#ffd860" : fla === 2 ? "#e05040" : "#c8a070");
  const k0 = Math.max(0, Math.floor((nowL - base) / (per * B.loop)) - 1);
  for (let k = k0; k < k0 + 3; k++) for (const [b, d] of B.chart) {
    const dt = base + (k * B.loop + b) * per - nowL, x = Math.round(hit + (dt / span) * (W - 12));
    if (dt < -200 || x > x0 + W - 4) continue;
    drawArrow(g, x, y, d, mine ? HERB_COL[d] : "#5a5a68");
  }
}
/** The cauldron: a big black pot; the brew's colour, bubbles then steam by its progress, sparkling when done, foaming over when it boils over. */
function drawPot(g, t, sx, sy, row) {
  const [, , , , r, s, prog, gi, foam, due] = row, c = r >= 0 ? brewC(r, t) : "#2a3a2a";
  px(g, sx - 13, sy - 20, 26, 14, "#14141a"); px(g, sx - 14, sy - 21, 28, 3, "#2a2a34"); px(g, sx - 11, sy - 7, 3, 4, "#14141a"); px(g, sx + 8, sy - 7, 3, 4, "#14141a");
  px(g, sx - 12, sy - 20, 24, 2, s ? c : "#2a3a2a");
  if (!s) return;
  if (prog >= 33 || s >= 2) for (let i = 0; i < 3; i++) { const ph = Math.floor((t + i * 170) / 260) % 3; px(g, sx - 8 + i * 7, sy - 22 - ph, 2, 2, "#e8f0ff"); }   // bubbles
  if (prog >= 66 || s >= 2) for (let i = 0; i < 2; i++) px(g, sx - 5 + i * 9 + (Math.floor(t / 300 + i) % 2), sy - 28 - (Math.floor(t / 200 + i * 2) % 4), 2, 3, "#c8c8d0");   // steam
  px(g, sx - 12, sy, 24, 3, "#1a1a20"); px(g, sx - 11, sy + 1, Math.max(1, Math.round((22 * prog) / 100)), 1, c);   // progress
  if (gi >= 0) px(g, sx + 14, sy - 24, 3, 3, ["#e8c040", "#c84a3a", "#5a7ab0", "#6a6a70"][gi]);   // the grade so far
  if (s === 2 && Math.floor(t / 250) % 2) { px(g, sx - 1, sy - 34, 3, 1, "#ffffff"); px(g, sx, sy - 35, 1, 3, "#ffffff"); }
  if (s === 3) {
    for (let i = 0; i < 6; i++) { const f = Math.floor((t + i * 90) / 180) % 3; px(g, sx - 14 + i * 5, sy - 22 + f * 3, 4, 3 + f, i % 2 ? "#e0ffe0" : c); }   // foam spilling over
    const n = BR().foam || 5;
    for (let i = 0; i < n; i++) px(g, sx - n * 2 + i * 4, sy - 30, 3, 3, i < foam ? "#e05040" : "#2a2e3a");
  }
  if ((s === 2 || s === 3 || due) && due && dsLeft(due) < 3000 && Math.floor(t / 150) % 2) px(g, sx + 15, sy - 34, 2, 6, "#e05040");
}
/** Your lane in the lab: the kiln's (holding a 풀무 beside it) or the herb shelf's (mid-pick). */
function brewLaneOf() {
  const me = G().me, my = st.team.find((r) => r[0] === G().you);
  if (!me || !my) return null;
  if (my[5] >= 10) return "herb";
  const k = st.ents.find((r) => r[1] === 11);
  return my[5] === 1 && !my[2] && k && Math.hypot(me.x - k[2], me.y - k[3]) <= 34 ? k[0] : null;
}
/** The lab's HUD line: the kiln's heat and target band, then what your keys do. */
function brewHud(me) {
  const k = st.ents.find((r) => r[1] === 11), B = BR(), r = kilnRecipe(), O = B.orders[r];
  if (!k || !O) return "";
  let s = `\n가마 ${Math.round(kilnHeat(k))}° · 목표 ${O[0]} ${O[1]}~${O[2]}°`;
  if (st.lane === "herb" && me) {
    const code = (me[4] || [])[0], hr = B.orders[Math.floor(code / 5) - 1], i = me[5] - 10;
    if (hr) s += ` · 약재: ${hr[4].map((h, j) => (j < i ? "✓" : j === i ? `[${B.herbs[h]}]` : B.herbs[h])).join(" → ")}`;
  } else if (st.lane) s += "  ♪ 화살표 음표에 맞춰 방향키 · F 풀무 놓기";
  return s;
}
const dsLeft = (ds) => ds * 100 - (now() - (st.entsAt || 0));
function drawTool(g, t, sx, sy, eid) {
  const row = st.team.find((r) => r[0] === eid);
  if (!row) return;
  const x = sx + 12, y = sy - 22;   // the prop follows its worker (tick): the tool beside their head
  if (jobOf() === "alch") {
    if (row[1] === 1) { px(g, x, y - 1, 2, 6, "#2a1e16"); px(g, x - 3, y - 7, 8, 6, "#1a2a14"); px(g, x - 2, y - 6, 6, 4, "#8fd060"); px(g, x - 2, y - 6, 1, 4, "#5ab04a"); px(g, x + 1, y - 6, 1, 4, "#5ab04a"); }   // fan
    else { px(g, x - 4, y - 3, 8, 7, "#2a1e16"); px(g, x - 3, y - 2, 6, 5, "#8a5a3a"); px(g, x - 3, y, 6, 1, "#5a3a24"); px(g, x + 4, y, 3, 2, "#a8a8b0"); px(g, x - 6, y - 2, 2, 1, "#c8a070"); }   // 풀무 (bellows)
    if (row[5] === 1) px(g, x - 1, y - 6, 2, 2, Math.floor(t / 200) % 2 ? "#ffe060" : "#ff9a40");   // on the 풀무
    for (const code of row[4] || []) drawPiece(g, x + 1, y - 9, Math.floor(code / 5) - 1, code % 5, t);
  }
  if (row[3]) { g.fillStyle = "#c8d0ff"; g.font = "8px Galmuri11, monospace"; g.fillText("zzz", x + 6, y - 6 - (Math.floor(t / 500) % 2)); }
}

// ───────────────────────────── HUD, lobby card, report ─────────────────────────────

function box(id, cls) {
  let b = document.getElementById(id);
  if (!b) { b = document.createElement("div"); b.id = id; b.className = cls; b.hidden = true; (document.querySelector("#hud") || document.body).append(b); }
  return b;
}
function renderHud() {
  const b = st.hud || (st.hud = box("coop-hud", "frame"));
  if (!st.cj) {
    b.hidden = true;
    if (st.pickup) st.pickup.hidden = true;
    return;
  }
  if (!b.firstChild) {
    b.innerHTML = `<div class="ch-l"></div><div class="ch-g"><i></i></div><div class="ch-b"><button class="btn gold ch-work"><kbd>F</kbd> 작업하기</button><button class="btn ch-guide" type="button">진행 방법</button><button class="btn ch-quit">그만두기</button></div>`;
    b.querySelector(".ch-work").addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); work(); });
    b.querySelector(".ch-quit").addEventListener("click", () => A.act({ t: "coop_leave" }));
    b.querySelector(".ch-guide").addEventListener("click", (e) => openWalkthrough(jobOf(), D().jobs[jobOf()], e.currentTarget));
  }
  b.querySelector(".ch-guide").hidden = !hasWalkthrough(jobOf());
  if (jobOf() === "apt" && !st.pickup) {
    const pick = document.createElement("button");
    pick.id = "apt-pickup"; pick.type = "button"; pick.className = "btn gold"; pick.hidden = true;
    setWorkPrompt(pick, "쓰레기 줍기");
    pick.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    pick.addEventListener("click", (ev) => { ev.stopPropagation(); work(); });
    document.getElementById("hud").append(pick);
    st.pickup = pick;
  }
  b.hidden = false;
  frame();
}
/** The HUD's clock and numbers (every frame: the clock counts down between snapshots). */
function frame() {
  const c = st.cj, b = st.hud;
  if (!c || !b || b.hidden) return;
  const [ki, state, secs, score, combo, mult, grade, next, mess, cap] = c;
  const k = D().kinds[ki], job = D().jobs[k] || ["협동 아르바이트"];
  const s = Math.max(0, secs - Math.floor((now() - st.at) / 1000));
  const me = st.team.find((r) => r[0] === G().you), tools = (job[2] || []).map((t) => D().tools[t] || t);
  const phase = ["준비", "근무", "피버!", "끝"][state];
  const apt = k === "apt";
  const full = apt && me?.[2] >= D().binCap;
  let hand = me ? tools[me[1]] || "" : "";
  if (apt && me) hand += ` ${me[2]}/${D().binCap}`;
  if (k === "diner" && me) hand = "손에 든 것 " + (me[4]?.[0] === 3 ? "빈그릇" : D().dishes[me[4]?.[0]] || "없음");
  const txt = `${job[0]} · ${phase} ${state === 0 ? `${s}초 뒤 시작` : mmss(s)} | 점수 ${score}${!apt && mult > 10 ? ` ×${(mult / 10).toFixed(1)}` : ""}${!apt && combo > 1 ? ` (콤보 ${combo})` : ""}` +
    ` | 등급 ${GRADE[grade]}${next ? ` (다음 ${next}점)` : ""}${smithy(k) ? ` | 판매 ${mess} · 화난 손님 ${cap}` : k === "diner" ? ` | 서빙 ${mess} · 화난 손님 ${cap}` : ""}` +
    (hand ? ` | ${hand}` : "") +
    (apt && full ? "\n쓰레기통이 가득 찼어요! 비워주세요" : "") +
    (smithy(k) ? `\n손님 ${forgeOrders()}` : "") + (k === "lib" ? libHud(me) : "") + (k === "alch" ? brewHud(me) : "");   // the forge's and kiln's open orders on a line of their own (the top line ran out of room)
  const l = b.querySelector(".ch-l");
  if (l.textContent !== txt) l.textContent = txt;
  b.classList.toggle("fever", state === 2);
  b.classList.toggle("messy", full || (!apt && k !== "diner" && mess > cap));
  b.classList.toggle("compact-job", k !== "alch");
  const bar = b.querySelector(".ch-g > i"), top = next || score || 1, w = `${Math.min(100, Math.round((100 * score) / top))}%`;
  if (bar.style.width !== w) bar.style.width = w;
  const active = working(), button = b.querySelector(".ch-work");
  button.hidden = apt || k === "diner" || k === "forge" || k === "lib";
  button.disabled = !active;
  if (st.pickup) {
    const { x, y, serverX, serverY } = G().me;
    const here = apt && trashTile(x, y);
    st.pickup.hidden = !(apt && active && !full && st.trashTiles.has(here) && here === trashTile(serverX, serverY));
  }
}
/** The library's second HUD line: the 반납대 and the queue, the next book on the desk, the books in your hands. */
function libHud(me) {
  const line = st.ents.filter((r) => r[1] === 13 && r[9] === 1).length, held = me?.[4];
  const [, , , , , , , , handled, missed] = st.cj;
  return `\n대기 ${line}명 · 처리 ${handled}권 · 떠난 손님 ${missed}` + (held?.length ? ` | 손에 든 책 ${LB().genres[held[0]]}` : "");
}
/** The forge's open orders, most urgent first: "검날 1:12 · 편자 0:40" (the client counts the deciseconds down). */
function forgeOrders() {
  const forge = jobOf() === "forge", sk = (D().jobs[jobOf()] || [])[8], names = sk ? sk.orders.map((n) => [n]) : D().orders || [];
  const rows = st.ents.filter((r) => r[1] === 8 && !r[8] && (!forge || !r[7])).map((r) => [r[4], Math.max(0, Math.ceil(dsLeft(r[5]) / 1000)), r[10]]).sort((a, b) => a[1] - b[1]);
  const col = (m) => (m === undefined ? "" : ((D().metals || [])[m] || ["", ""])[1] + " ");
  return rows.length ? rows.map(([k, s, m]) => `${col(m)}${(names[k] || ["?"])[0]} ${mmss(s)}`).join(" · ") : "없음";
}
const SKILL = { apt: "배달", diner: "요리", forge: "제작", alch: "연금", lib: "배달" };
const CARD_TIP = { apt: " 쓰레기 위에서 F로 줍고, 반납대에 가까이 가면 통이 비워져요.", diner: " 주문과 같은 음식을 만들어 내고, 다 먹은 그릇은 싱크대에 반납하세요.", forge: " 주문에 맞는 주괴를 모루에 올리고, 두 사람이 스페이스로 박자를 맞추세요.",
  lib: " 대출은 책장에서 안내데스크로, 반납은 안내데스크에서 같은 장르의 책장으로 가져가세요.",
  alch: " 풀무는 다 함께! 같은 음표를 같이 치면 합동 풀무. 온도계의 띠를 지키고, 넘치면 부채로 F 연타!" };
/** The pay share by grade, "C 100% · B 105% · A 110% · S 120%". */
const gradePct = () => (D().gradeK || [1, 1.05, 1.1, 1.2]).map((k, i) => `${"CBAS"[i]} ${Math.round(k * 100)}%`).join(" · ");
/** By the job's owner in the lobby: the card with [근무 시작]. */
function renderCard() {
  const m = G().map, me = G().me, b = st.card || (st.card = box("coop-card", "frame"));
  let k = null, n = null;
  if (m && me && !inside()) for (const kk of Object.keys(D().jobs)) {
    const j = D().jobs[kk], o = j[5] === m.id && m.npcs.find((q) => q.id === j[4]);
    if (o && Math.hypot(me.x - (o.x * T + 8), me.y - (o.y * T + 12)) < D().near - 4) { k = kk; n = o; }
  }
  const game = G(), party = game.party || [];
  const done = !!(k && game.self?.coop?.includes(k));
  const leader = party[0]?.[0] === game.you;
  const present = k ? party.filter(([, , , , hp, , , , , id]) => hp > 0 && id === m.id).length : 0;
  const key = k ? [k, done, party.length, present, leader].join() : "";
  if (key === st.cardKey) return;
  st.cardKey = key;
  if (!k) { b.hidden = true; return; }
  const j = D().jobs[k];
  const canStart = leader && present >= 2;
  const startHint = party.length < 2 ? "파티원을 초대하고 이 방에서 만나세요."
    : present < 2 ? "파티원이 이 방에 도착하면 시작할 수 있어요."
      : leader ? "이 방에 있는 파티원만 참가해요." : "파티장이 근무를 시작하면 함께 입장해요.";
  b.innerHTML = `<b>협동 아르바이트 · ${j[0]}</b><p>${n.name}: "일손이 필요해요! 2~4명 파티로, ${j[1]}분 근무예요."</p>` +
    `<p>${esc(j[6] || "")}${CARD_TIP[k] || ""}</p>` +
    `<p class="cc-day">${done ? "오늘 보수 수령 완료 · 보수 없이 다시 참여할 수 있어요. 조건을 충족한 미수령 팀원은 보수를 받아요."
      : `C 등급 이상에서 참여 조건을 충족하면 골드·버드나무토큰·강화석·장비·${SKILL[k] || "생활"} 경험치를 받아요.`}</p>` +
    (done ? "" : `<p class="cc-day">등급별 보수 ${gradePct()}</p>`) +
    `<div class="cc-buttons">${hasWalkthrough(k) ? '<button class="btn cc-guide" type="button">진행 방법</button>' : ""}` +
    (canStart ? `<button class="btn gold cc-start" type="button">${done ? "파티와 다시 근무" : "파티와 근무 시작"}</button>` : "") +
    `</div><p class="cc-day">${party.length > 1 ? `모인 파티원 ${present}/${party.length}명 · ` : ""}${startHint}</p>`;
  b.querySelector(".cc-guide")?.addEventListener("click", (e) => openWalkthrough(k, j, e.currentTarget));
  b.querySelector(".cc-start")?.addEventListener("click", () => { closeWalkthrough(); A.act({ t: "coop_start", k }); });
  b.hidden = false;
}
function showReport(cr) {
  const [grade, score, best, rows, cuts, reward] = cr;
  const b = st.res || (st.res = box("coop-res", "frame"));
  const tools = (D().jobs[jobOf()]?.[2] || []).map((t) => D().tools[t] || t);
  const finish = grade ? "근무 완료!" : "근무 평가 미달";
  const pay = reward === 1 ? `내 보수 ${Math.round((D().gradeK || [1, 1.05, 1.1, 1.2])[grade - 1] * 100)}% 지급 완료` : "이번 근무 보수 없음";
  b.innerHTML = `<div class="cr-g g${grade}">${GRADE[grade]}</div><b>${finish}</b>` +
    `<p>점수 ${score} · 이 채널 최고 ${best}</p><p class="cr-cut">C ${cuts[0]} · B ${cuts[1]} · A ${cuts[2]} · S ${cuts[3]}</p>` +
    (reward === undefined ? "" : `<p class="cr-cut">${reward === 2 ? "오늘 보수 수령 완료 · " : ""}${pay}</p>`) +
    `<table>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${tools[r[2]] || ""}</td><td>${r[1]}점</td><td>${r[3] ? "" : "참여 조건 미충족"}</td></tr>`).join("")}</table>` +
    `<p class="cr-note">잠시 뒤 로비로 돌아갑니다.</p><button class="btn">확인</button>`;
  b.querySelector("button").addEventListener("click", () => { b.hidden = true; });
  b.hidden = false;
  A.Sound.play(grade >= 3 ? "quest" : grade ? "craft_ok" : "fail");
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ───────────────────────────── events, each frame ─────────────────────────────

const SND = { 4: "swing", 5: "coin", 6: "pop", 14: "quest", 15: "fail", 18: "warn", 19: "hit", 20: "pop", 22: "coin", 23: "ui",
  30: "dish_done", 31: "pan_place", 32: "fail", 38: "coin", 40: "ui", 42: "coin", 43: "pop", 44: "warn",
  9: "hit", 10: "hit", 11: "fail", 12: "pop", 13: "coin", 17: "swing", 50: "ui", 51: "pop", 53: "craft_ok", 54: "pop", 55: "hit", 56: "ui", 57: "pop", 58: "craft_ok",
  61: "fail", 62: "ui", 64: "warn", 65: "ui", 66: "pop", 90: "ui", 91: "fail", 92: "book_thunk", 93: "desk_bell", 94: "book_thunk", 95: "wrong_buzz", 96: "pop", 97: "pop" };
const COL = { 4: "#c8a070", 5: "#ff9a40", 6: "#8fd060", 18: "#7a5a3a", 19: "#e8d070", 20: "#6a8a6a", 22: "#60c0ff",
  32: "#e05040", 33: "#4a4a50", 34: "#8fd060", 38: "#ffd860", 41: "#a8d8ff", 42: "#e8f4ff", 12: "#a8d8ff", 13: "#ffd860", 17: "#ff9a40", 53: "#fff0a0", 58: "#ffb040" };
/** cj and cb events; true when the event was ours. */
export function onEvent(e) {
  if (e[0] !== "cj") return false;
  const [, code, x, y] = e;
  if (jobOf() === "forge") {
    const sound = { 14: "quest", 50: "pop", 60: "clang", 61: "ui", 62: "anvil_perfect", 63: "anvil_miss", 65: "order_done", 67: "pop", 68: "order_late" }[code];
    if (sound) A.Sound.play(sound);
    Forge.feedback(code, x, y);
    if (code === 62 || code === 65) A.S3.fx.burst(x, y - 9, 0.38, "#ffd986", code === 65 ? 12 : 5, 1);
    return true;
  }
  if (jobOf() === "alch" && code >= 70 && code <= 73) {
    // 풀무 notes (a = the player's eid): yours flash the lane; a perfect one puffs in the brew's colour with a short lane freeze
    const kiln = st.ents.find((r) => r[1] === 11), mine = e[4] === G().you, col = brewC(kilnRecipe(), now());
    if (code === 73) { st.joint = [now(), e[4]]; A.Sound.play("kiln_roar"); A.S3.fx.burst(x, y - 16, 0.6, "#ffe060", 14, 1.3); return true; }
    if (mine && kiln) st.flash[kiln[0]] = [now(), code - 70];
    if (mine || code === 70) A.Sound.play(["stir_perfect", "stir_good", "stir_miss"][code - 70]);
    if (code === 70) { A.S3.fx.burst(x, y - 12, 0.5, col, mine ? 10 : 4, 1); if (mine) { st.stopAt = now(); st.stop = now() + 60; } }
    else if (code === 72 && mine) A.S3.fx.spark(x, y - 8, "#6a6e7a", 1);
    return true;
  }
  const own = jobOf() === "alch" && { 13: "order_done", 61: "order_late", 66: "pop", 74: "pop", 75: "craft_ok", 76: "fail", 77: "kiln_whoosh", 78: "pop", 79: "craft_ok", 80: "boil_over", 81: "kiln_whoosh", 82: "fail", 83: "bottle_pop", 84: "kiln_whoosh" }[code];
  if (own || SND[code]) A.Sound.play(own || SND[code]);
  if (COL[code] && (x || y)) A.S3.fx.burst(x, y, 0.3, COL[code], code === 5 || code === 22 || code === 38 ? 10 : 4, 0.8);
  return true;
}
export function tick() {
  if (!G().playing) return;
  renderCard();
  st.lane = null;
  if (inside()) {
    if (jobOf() === "apt") {
      const npc = A.S3.props.get("cdinspector");
      const age = ((D().jobs.apt[1] * 60 - st.cj[2]) * 1000 + Math.min(999, now() - st.at)) % 26000;
      const route = D().jobs.apt[7].inspector;
      if (npc && route) {
        npc.present = working() && age >= 3500 && age < 14500;
        const inward = Math.max(0, Math.min(1, (age - 3500) / 4100, (14500 - age) / 4100));
        const [[x0, y0], [x1, y1]] = route;
        npc.x = (x0 + inward * (x1 - x0)) * T + 8;
        npc.y = (y0 + inward * (y1 - y0)) * T + 10;
        npc.moving = inward < 1;
      }
    }
    if (jobOf() === "diner") {
      const { dinerItem, serverX, serverY } = G().me;
      Diner.update(working() ? D() : null, st.ents, { x: serverX, y: serverY }, dinerItem ? dinerItem - 1 : null, dsLeft, A.act);
      for (const row of st.ents) if (row[1] === 3) {
        const pr = A.S3.props.get("cp" + row[0]);
        if (pr) [pr.x, pr.y] = Diner.customerPosition(row, D().jobs.diner[7].door, dsLeft);
      }
    }
    if (jobOf() === "forge") {
      const { serverX, serverY } = G().me, mine = st.team.find((row) => row[0] === G().you);
      Forge.update(working() ? D() : null, st.ents, { x: serverX, y: serverY }, mine, now() - st.entsAt, A.act, st.team, G().players);
      for (const row of st.ents) if (row[1] === 8) {
        const pr = A.S3.props.get("cp" + row[0]);
        if (pr) [pr.x, pr.y] = Forge.customerPosition(row, D().jobs.forge[7].door, dsLeft);
      }
    }
    if (jobOf() === "lib") {
      const { serverX, serverY } = G().me, held = st.team.find((row) => row[0] === G().you)?.[4];
      Library.update(working() ? D() : null, st.ents, { x: serverX, y: serverY }, held?.length ? held : null, A.act, st.cj[11]);
      for (const row of st.ents) if (row[1] === 13) {
        const pr = A.S3.props.get("cp" + row[0]);
        if (pr) [pr.x, pr.y] = Library.position(row, D().jobs.lib[7].door, dsLeft);
      }
    }
    for (const [eid] of st.team) { const pr = A.S3.props.get("ct" + eid), e = A.entityPos(eid); if (pr && e) { pr.x = e.x; pr.y = e.y + 1; } }
    if (jobOf() === "alch") for (const row of st.ents) if (row[1] === 8 && row.length >= 10) {
      const pr = A.S3.props.get("cp" + row[0]);
      if (pr) [pr.x, pr.y] = custPos(row);
    }
    st.lane = jobOf() === "alch" ? brewLaneOf() : null;
    frame();
  }
  if (st.res && !st.res.hidden && !inside()) st.res.hidden = true;
}
