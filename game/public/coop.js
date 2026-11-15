/**
 * 협동 아르바이트 in the browser (동동아파트 청소, 쥬쥬식당 서빙, 캉캉대장간 단조, 보글연금공방 가마 = the forge's skin; logic 68-coop.js,
 * docs/design/life-and-coop.md C). The server decides everything; this draws and asks.
 * - Lobby: by the job's owner (관리인 동동, 쥬쥬, 캉캉, 보글) a card offers [근무 시작] → `coop_start {k}` (the party comes along).
 * - 올빼미 도서관 (lib): C rows 13 returner · 14 a book on the 반납대 · 15 a wrong book; genre signs over the shelves, books in hand
 *   from the team row's `what` (genre·16 + title), a second HUD line (desk, queue, the books in hand); events 90–97.
 * - 동동아파트 v3: `cd` the dirt (a full string, then deltas) on a cached canvas drawn flat on the floor (onDirt); the HUD reads
 *   "청소율 n%" and "쓰레기통 n/10" (your team row's `what` = the bin's 칸), the dumpster gets a sign.
 * - Inside: `cj` drives the HUD line (time, score ×mult, grade and the next cut-off, the job's sum), `C` the piles /
 *   bundles / sofa or the orders / pots / plated dishes (scene props), `cr` the report card. Space / F (or the [일하기]
 *   button) send `coop_act`; [그만두기] `coop_leave`.
 * - Events `["cb", anvil id, ms to the first beat, beat ms]` (the forge's beat ring) and `["cj", code, x, y, a]`: 4 sweep · 5 burn · 6 bin pick · 14 fever · 15 complaint · 18 spread · 19 lift ·
 *   20 tied · 21 the end · 22 recycle · 23 tool swap · diner 30 off the stove · 31 on the stove · 32 angry · 33 burnt ·
 *   34 chop · 35 plated · 36 trash · 37 from a crate · 38 served · 39 onto the tray · 40 a new order · 41 a plate into the sink / a scrub ·
 *   42 washed clean · 43 a dirty plate onto the tray · forge 9/10/11 strike
 *   perfect/good/miss · 12 quench · 13 deliver · 17 pump · 50 bar from the crate · 51 into the fire · 53 hot · 54 out hot ·
 *   55 onto the anvil · 56 cooled piece taken · 57 shaped piece taken · 58 shaped · 61 late order (forge: an angry customer) ·
 *   62 new order (a customer at the door) · 64 cooled · 65 furnace in the band · 66 a piece onto the 진열대.
 * - Forge v2: anvil rows carry the pattern's beat 0 and the heat left; `drawLane` scrolls that piece's notes (defs orders[k][4])
 *   onto a hit line while it plays. Standing there with the hammer (or empty-handed for 갑옷's answers) is `lane()`: input.js
 *   stops walking and the movement keys send `coop_act {d}` (↑ → ↓ ←) for the flip notes. Customers (t 8, 10 fields) walk
 *   from `defs.coop.door` to their seat and back out; pieces on show are t 10.
 */
import * as Keymap from "./keymap.js";
import * as Pipes from "./coop-pipes.js";
import { closeWin } from "./windows.js";

const T = 16;
const now = () => performance.now();
let A = null;   // { G, S3, Sound, act, toast, entityPos }
const st = { cj: null, at: 0, ents: [], keys: [], team: [], hud: null, card: null, res: null, cardKey: "", beat: {}, lane: null, flash: {}, stop: 0, lw: new Map(), lwAt: 0 };
const DIRS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }, DIR_ACT = { up: 0, right: 1, down: 2, left: 3 };

export function init(api) {
  A = api; window.__coop = st;   // st exposed for automation (like window.__game)
  Pipes.init(api);
  // the work key: Space / F inside a shift (before input.js turns them into an attack or a talk); on the forge's rhythm
  // lane the movement keys are the flip arrows instead (input.js stands still while `lane()`)
  addEventListener("keydown", (e) => {
    if (Pipes.active()) { Pipes.key(e); return; }
    if (!inside() || /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) return;
    const d = st.lane ? (e.code in DIRS ? DIRS[e.code] : DIR_ACT[Keymap.actionOf(e)]) : undefined;
    if (d !== undefined) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) work(d); return; }
    if (e.repeat || (e.key !== " " && e.key !== "f" && e.key !== "F" && e.key !== "ㄹ")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    work();
  }, true);
}
/** On the forge's rhythm lane (an anvil's pattern playing, you free to play it): movement stops, the arrows flip. */
export const lane = () => !!st.lane || Pipes.active();
export const boardActive = Pipes.active;
const G = () => A.G;
const D = () => (G().defs && G().defs.coop) || { jobs: {}, kinds: ["apt"], tools: {}, binCap: 10, near: 56 };
const inside = () => !!st.cj;
const work = (d) => { if (st.cj && (st.cj[1] === 1 || st.cj[1] === 2)) A.act(d === undefined ? { t: "coop_act" } : { t: "coop_act", d }); };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const GRADE = ["-", "C", "B", "A", "S"];

// ───────────────────────────── the snapshot ─────────────────────────────

export function onSnap(s) {
  let ents = "C" in s ? s.C || [] : null;
  if ("cj" in s) {
    const was = st.team.map((r) => r[0]).join();
    st.cj = s.cj || null; st.at = now();
    st.team = st.cj ? st.cj[10] || [] : [];
    if (!st.cj) ents = [];
    else if (!ents && st.team.map((r) => r[0]).join() !== was) ents = st.ents;   // someone left: their tool goes
    renderHud();
  }
  if ("cd" in s && st.cj) onDirt(s.cd);
  if (!st.cj) dropDirt();
  if ("cp" in s) Pipes.onSnap(s.cp);
  const pipe = jobOf() === "pipe";
  if (pipe && !Pipes.active()) closeWin("board");
  Pipes.update(pipe ? st.cj : null, st.at);
  if (ents) setEnts(pipe ? [] : ents);
  if (s.cr) showReport(s.cr);
}
const jobOf = () => (st.cj ? D().kinds[st.cj[0]] : null);
/** The forge engine's jobs: 캉캉's forge and 보글's alch (its skin: same rows, other art and names). */
const smithy = (k) => k === "forge" || k === "alch";
/** The diner's and the forge's fixed stations (crates, boards, trash · iron crate, quench, chute) get a little icon each. */
function setStations(k) {
  const j = D().jobs[k], sts = j && j[7];
  if (!sts) return;
  const icons = k === "apt" ? [["dump", 20]] : k === "alch" ? [["herbs", 13]] : smithy(k) ? [...(Array.isArray(sts.crate[0]) ? sts.crate : [sts.crate]).map((t, i) => ["crate" + i, 16 + i, t]), ...(sts.quench || []).map((t, i) => ["quench" + i, 12, t])]
    : [["veg", 0], ["fish", 1], ["meat", 2], ["trash", 9], ["sink", 15], ...(sts.board || []).map((t, i) => ["board" + i, 8, t])];
  for (const [k, code, t] of icons) {
    const [tx, ty] = t || sts[k], key = "cs" + k;
    st.keys.push(key);
    A.S3.props.set(key, { x: tx * T + 8, y: ty * T + 10, until: Infinity, draw(g, tt, sx, sy) { drawIcon(g, Math.round(sx), Math.round(sy) - 22, code); } });
  }
}
// ───────────────────────────── 동동아파트's dirt (apt v3): one cached canvas, a 16×16 cell per tile, redrawn by the deltas ─────────────────────────────

const DIRT = { cv: null, g: null, w: 0, fx: null };
st.dirt = DIRT;   // for automation (window.__coop.dirt)
/** `cd`: a string of every tile's level on the way in (the canvas is rebuilt), then [tile·4 + level…] changes. */
function onDirt(cd) {
  const m = G().map;
  if (typeof cd === "string") {
    if (!m || !m.w) return;
    const cv = DIRT.cv && DIRT.w === m.w && DIRT.cv.height === m.h * T ? DIRT.cv : Object.assign(document.createElement("canvas"), { width: m.w * T, height: m.h * T });
    DIRT.cv = cv; DIRT.w = m.w; DIRT.g = cv.getContext("2d"); DIRT.g.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < cd.length; i++) if (cd.charCodeAt(i) !== 48) dirtCell(i, cd.charCodeAt(i) - 48);
  } else if (DIRT.g) for (const k of cd) dirtCell(k >> 2, k & 3);
  // drawn flat on the floor, under everyone (a custom effect in the ground pass that never ends)
  // (the flat pass works in the renderer's world units, server px × 2: scene_view.js P)
  if (!DIRT.fx || !A.S3.fx.list.includes(DIRT.fx)) A.S3.fx.add(DIRT.fx = { k: "custom", flat: true, dur: 1e12, draw: (g) => { if (DIRT.cv) g.drawImage(DIRT.cv, 0, 0, DIRT.cv.width * 2, DIRT.cv.height * 2); } });
}
function dropDirt() {
  if (DIRT.fx) { const i = A.S3.fx.list.indexOf(DIRT.fx); if (i >= 0) A.S3.fx.list.splice(i, 1); }
  DIRT.fx = DIRT.cv = DIRT.g = null;
}
/** One tile's dirt, seeded by the tile so a cell always looks the same: dust (1) specks on a faint smudge; litter (2) adds a paper scrap and a crumb. */
function dirtCell(i, lv) {
  const g = DIRT.g, x = (i % DIRT.w) * T, y = Math.floor(i / DIRT.w) * T;
  g.clearRect(x, y, T, T);
  if (!lv) return;
  let h = (Math.imul(i + 1, 2654435761) >>> 0) || 1;
  const r = (n) => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) % n; };
  // cool grey on the warm wood and rugs so it reads: a grimy smudge, two dust bunnies (pale fluff on a dark underside), dark specks
  g.fillStyle = "rgba(54,50,48,.34)"; g.fillRect(x + 1 + r(3), y + 1 + r(3), 11 + r(3), 10 + r(3));
  for (let k = 0; k < 2; k++) { const bx = x + 2 + r(10), by = y + 2 + r(10); g.fillStyle = "#3a3634"; g.fillRect(bx - 1, by, 5, 3); g.fillStyle = "#d4d0c4"; g.fillRect(bx, by, 3, 2); g.fillStyle = "#a8a49a"; g.fillRect(bx, by + 1, 3, 1); }
  for (let k = 0; k < 4; k++) { g.fillStyle = "#2e2a28"; g.fillRect(x + 1 + r(14), y + 1 + r(14), 1, 1); }
  if (lv < 2) return;
  const sx = x + 3 + r(8), sy = y + 3 + r(8);
  g.fillStyle = "#2a2018"; g.fillRect(sx - 1, sy - 1, 6, 5);
  g.fillStyle = ["#e8e0c8", "#c8d8e8", "#e0c890"][r(3)]; g.fillRect(sx, sy, 4, 3);
  g.fillStyle = "#a8a090"; g.fillRect(sx, sy + 2, 4, 1);
  g.fillStyle = ["#c84a3a", "#5a8ab0", "#6a9a4a"][r(3)]; g.fillRect(x + 1 + r(12), y + 1 + r(12), 2, 2);
}
/** The entities as scene props (the old ones go). */
function setEnts(rows) {
  for (const k of st.keys) A.S3.props.delete(k);
  st.keys = [];
  st.ents = rows; st.entsAt = now();
  if (jobOf() === "pipe") return;
  for (const row of rows) {
    const [id, t, x, y, hp] = row, key = "cp" + id;
    if (t === 8 && row.length < 10) continue;   // the alch's orders: on the HUD only (the forge's customers walk in)
    if (t === 7 && row[4] === 1) st.beat[id] = [st.entsAt + row[7], row[8]];
    st.keys.push(key);
    if (t === 8) { A.S3.props.set(key, { x, y, until: Infinity, cust: row, draw(g, tt, sx, sy) { drawCustomer(g, tt, Math.round(sx), Math.round(sy), row); } }); continue; }
    A.S3.props.set(key, { x, y, until: Infinity, draw(g, tt, sx, sy) { t >= 13 ? drawLib(g, tt, Math.round(sx), Math.round(sy), row) : t === 11 ? drawKiln(g, tt, Math.round(sx), Math.round(sy), row) : t === 12 ? drawPot(g, tt, Math.round(sx), Math.round(sy), row) : t === 10 ? drawShelved(g, tt, Math.round(sx), Math.round(sy), row) : t >= 6 && t < 9 ? drawForge(g, tt, Math.round(sx), Math.round(sy), row) : t >= 3 ? drawDiner(g, tt, Math.round(sx), Math.round(sy), row) : drawEnt(g, tt, Math.round(sx), Math.round(sy), t, hp, id); } });
  }
  if (jobOf() === "diner" || jobOf() === "apt" || smithy(jobOf())) setStations(jobOf());
  if (jobOf() === "lib") { libSigns(); libWalkers(rows); } else st.lw.clear();
  // a tool over each worker's head (a prop that follows them)
  for (const [eid] of st.team) {
    const key = "ct" + eid;
    st.keys.push(key);
    A.S3.props.set(key, { x: 0, y: 0, until: Infinity, eid, draw(g, tt, sx, sy) { drawTool(g, tt, Math.round(sx), Math.round(sy), eid); } });
  }
}

// ───────────────────────────── art (code-drawn, one shadow tone, dark outline) ─────────────────────────────

const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function drawEnt(g, t, sx, sy, kind, hp, id) {
  g.fillStyle = "rgba(20,24,50,.26)";
  g.beginPath(); g.ellipse(sx, sy, kind === 2 ? 14 : 8, kind === 2 ? 5 : 3, 0, 0, 7); g.fill();
  if (kind === 0) {
    // 쓰레기 더미: a heap that shrinks with each sweep, bits of paper and a can on top
    const k = Math.min(1, hp / 40), w = 8 + Math.round(16 * k), h = 4 + Math.round(8 * k);
    px(g, sx - w / 2 - 1, sy - h - 1, w + 2, h + 1, "#2a1e16");
    px(g, sx - w / 2, sy - h, w, h, "#7a5a3a");
    px(g, sx - w / 2, sy - h, w, 2, "#9a7a52");
    px(g, sx - 2, sy - h - 2, 3, 2, "#d8d0b8");
    if (hp >= 8) px(g, sx + 2, sy - h + 1, 2, 2, "#5a8ab0");
    if (hp >= 16) px(g, sx - 5, sy - h + 2, 2, 1, "#c84a3a");
    if (hp >= 28) { px(g, sx + 5, sy - h + 3, 3, 2, "#e8e0c8"); px(g, sx - 8, sy - 3, 2, 2, "#6a9a4a"); }
    if ((t + id * 911) % 2400 < 120) px(g, sx + 1, sy - h - 5, 1, 2, "#a8a070");   // a whiff
  } else if (kind === 1) {
    // 묶은 쓰레기: a tied bag
    px(g, sx - 5, sy - 10, 10, 10, "#1e2a22");
    px(g, sx - 4, sy - 9, 8, 8, "#4a6a52");
    px(g, sx - 4, sy - 9, 8, 2, "#6a8a6a");
    px(g, sx - 1, sy - 12, 3, 3, "#1e2a22"); px(g, sx, sy - 12, 1, 2, "#e8d070");
  } else {
    // 낡은 소파: wide, sagging, cracking as it is lifted
    const lift = hp < 4 ? 2 : 0;
    px(g, sx - 13, sy - 13 - lift, 26, 12, "#2a1418");
    px(g, sx - 12, sy - 12 - lift, 24, 5, "#8a3a3a");
    px(g, sx - 12, sy - 7 - lift, 24, 5, "#a84a42");
    px(g, sx - 12, sy - 12 - lift, 3, 10, "#6a2a2a"); px(g, sx + 9, sy - 12 - lift, 3, 10, "#6a2a2a");
    for (let i = 0; i < 4 - hp; i++) px(g, sx - 6 + i * 4, sy - 9 - lift, 1, 3, "#2a1418");
    // the "two hands" hint: two little arrows bobbing
    if (Math.floor(t / 400) % 2) { px(g, sx - 16, sy - 20, 3, 3, "#fff2a0"); px(g, sx + 13, sy - 20, 3, 3, "#fff2a0"); }
  }
}
// ───────────────────────────── 올빼미 도서관 (lib): returners, books on the 반납대, wrong books, shelf signs ─────────────────────────────

const LB = () => D().lib || { genres: [], cols: [], titles: [], deskCap: 8, carry: 3, shelves: [] };
const libCol = (g) => LB().cols[g] || "#8a8a9a";
const libName = (code) => { const g = code >> 4, ti = code & 15; return `『${(LB().titles[g] || [])[ti] || "?"}』(${LB().genres[g] || "?"})`; };
/** A book lying flat (or a stack of n), in its genre's colour with a pale page edge and a dark spine. */
function drawBook(g, x, y, gi, n = 1) {
  for (let i = 0; i < n; i++) { const yy = y - i * 3; px(g, x - 5, yy - 3, 10, 4, "#1a1420"); px(g, x - 4, yy - 3, 8, 2, libCol(gi)); px(g, x - 4, yy - 1, 8, 1, "#e8e0c8"); px(g, x - 5, yy - 3, 1, 4, "#1a1420"); }
}
/** t 13 a returner (a villager hugging their books, a patience bar) · 14 a book on the 반납대 · 15 a wrong book sticking out of a shelf. */
function drawLib(g, t, sx, sy, row) {
  const k = row[1];
  if (k === 14) { drawBook(g, sx, sy - 18, row[4]); return; }
  if (k === 15) {
    px(g, sx - 2, sy - 34, 5, 12, "#1a1420"); px(g, sx - 1, sy - 33, 3, 10, libCol(row[5]));
    if (Math.floor(t / 300) % 2) { px(g, sx - 1, sy - 48, 3, 8, "#ff4040"); px(g, sx - 1, sy - 38, 3, 2, "#ff4040"); }
    return;
  }
  // a returner: body colour by id, dot eyes, the books in their arms, patience left as a bar
  const body = ["#c87a4a", "#7a9ac8", "#a8c87a", "#c8a0d8", "#e0b060"][row[0] % 5];
  g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(sx, sy, 7, 3, 0, 0, 7); g.fill();
  px(g, sx - 5, sy - 15, 10, 15, "#1a1420"); px(g, sx - 4, sy - 14, 8, 13, body); px(g, sx - 4, sy - 5, 8, 4, "#3a3040");
  px(g, sx - 5, sy - 24, 10, 10, "#1a1420"); px(g, sx - 4, sy - 23, 8, 8, "#f0d8b8"); px(g, sx - 2, sy - 20, 1, 2, "#1a1420"); px(g, sx + 1, sy - 20, 1, 2, "#1a1420");
  if (row[7] >= 0) drawBook(g, sx, sy - 8, row[7], Math.min(3, row[4]));
  if (row.gone) return;
  const left = Math.max(0, dsLeft(row[5])) / (row[6] * 100), bw = 14;
  px(g, sx - bw / 2 - 1, sy - 30, bw + 2, 4, "#1a1420"); px(g, sx - bw / 2, sy - 29, Math.round(bw * left), 2, left > 0.5 ? "#8fd060" : left > 0.25 ? "#f0c040" : "#e05040");
}
/**
 * Returners walk (client-side only): a new one starts at the door and walks to its place in the queue, the queue shuffles up
 * smoothly, and one that is gone (served or angry) walks back out empty-handed. The rules' positions are the targets.
 */
const libDoor = () => LB().door || [31 * T + 8, 42 * T + 10];
function libWalkers(rows) {
  const seen = new Set(), [dx, dy] = libDoor();
  for (const row of rows) {
    if (row[1] !== 13) continue;
    seen.add(row[0]);
    const w = st.lw.get(row[0]);
    const v = w || { x: dx, y: dy, row };
    v.row = row; st.lw.set(row[0], v);
    const pr = A.S3.props.get("cp" + row[0]);
    if (pr) { pr.x = v.x; pr.y = v.y; }
  }
  for (const [id, w] of st.lw) {
    if (!seen.has(id) && !w.row.gone) { w.row = Object.assign([...w.row], { gone: true }); w.row[7] = -1; }
    if (!w.row.gone) continue;
    st.keys.push("cw" + id);
    A.S3.props.set("cw" + id, { x: w.x, y: w.y, until: Infinity, draw(g, tt, sx, sy) { drawLib(g, tt, Math.round(sx), Math.round(sy), w.row); } });
  }
}
function libWalk() {
  const t = now(), step = Math.min(0.25, (t - (st.lwAt || t)) / 1000) * 80, [dx, dy] = libDoor();
  st.lwAt = t;
  for (const [id, w] of st.lw) {
    const [tx, ty] = w.row.gone ? [dx, dy] : [w.row[2], w.row[3]], d = Math.hypot(tx - w.x, ty - w.y);
    if (d <= step) { w.x = tx; w.y = ty; } else { w.x += ((tx - w.x) / d) * step; w.y += ((ty - w.y) / d) * step; }
    const pr = A.S3.props.get((w.row.gone ? "cw" : "cp") + id);
    if (pr) { pr.x = w.x; pr.y = w.y; }
    if (w.row.gone && d <= step) { st.lw.delete(id); A.S3.props.delete("cw" + id); }
  }
}
/** A sign over each genre shelf in its colour, and one over the 반납대. */
function libSigns() {
  const sign = (key, wx, wy, text, col) => {
    st.keys.push(key);
    A.S3.props.set(key, { x: wx, y: wy, until: Infinity, draw(g, tt, sx, sy) {
      g.font = "8px Galmuri11, monospace"; const w = Math.ceil(g.measureText(text).width) + 6, x = Math.round(sx - w / 2), y = Math.round(sy) - 46;
      px(g, x - 1, y - 1, w + 2, 12, "#1a1420"); px(g, x, y, w, 10, col); px(g, x, y + 9, w, 1, "rgba(0,0,0,.35)");
      g.textAlign = "center"; g.fillStyle = "#1a1420"; g.fillText(text, Math.round(sx), y + 8); g.textAlign = "left";
    } });
  };
  LB().shelves.forEach(([x, y], i) => sign("cslib" + i, (x + 3) * T, y * T + 10, LB().genres[i], libCol(i)));
  sign("cslibdesk", 32 * T, 32 * T + 10, "반납대", "#e8d8b0");
}
/** 쥬쥬식당 icons, about 8×7: 0 채소 · 1 생선 · 2 고기 (raw), 8 도마 · 9 쓰레기통; 20 동동아파트's dumpster sign. */
function drawIcon(g, x, y, code) {
  if (code === 20) {   // 버리는 곳: a green skip with its lid up and an arrow down, named
    px(g, x - 8, y - 4, 17, 9, "#10200e"); px(g, x - 7, y - 3, 15, 7, "#3a8a3a"); px(g, x - 7, y - 3, 15, 1, "#6ac060"); px(g, x - 6, y, 13, 1, "#2a6a2a");
    px(g, x - 8, y - 8, 9, 3, "#10200e"); px(g, x - 7, y - 7, 7, 1, "#6ac060");
    px(g, x + 3, y - 11, 2, 5, "#fff2a0"); px(g, x + 1, y - 7, 6, 1, "#fff2a0"); px(g, x + 2, y - 6, 4, 1, "#fff2a0");
    g.font = "8px Galmuri11, monospace"; g.textAlign = "center"; g.fillStyle = "#10200e"; g.fillText("버리는 곳", x + 1, y - 13); g.fillStyle = "#c8f0a0"; g.fillText("버리는 곳", x, y - 14); g.textAlign = "left";
    return;
  }
  if (code === 0) { px(g, x - 3, y - 2, 7, 5, "#1e3a1a"); px(g, x - 2, y - 1, 5, 3, "#5ab04a"); px(g, x, y - 4, 1, 2, "#3a7a2a"); }
  else if (code === 1) { px(g, x - 4, y - 2, 8, 4, "#1e2a3a"); px(g, x - 3, y - 1, 5, 2, "#8ab0c8"); px(g, x + 2, y - 2, 2, 4, "#5a7a98"); px(g, x - 2, y - 1, 1, 1, "#1e2a3a"); }
  else if (code === 2) { px(g, x - 3, y - 2, 7, 5, "#3a1a1a"); px(g, x - 2, y - 1, 5, 3, "#d86a6a"); px(g, x - 1, y, 2, 1, "#f0c0b0"); }
  else if (code === 8) { px(g, x - 4, y - 1, 8, 3, "#5a3a1a"); px(g, x - 3, y - 1, 6, 1, "#b08a5a"); px(g, x + 1, y - 4, 1, 3, "#c8d0d8"); }
  else if (code === 9) { px(g, x - 3, y - 3, 7, 7, "#1a1e28"); px(g, x - 2, y - 2, 5, 5, "#6a7a8a"); px(g, x - 3, y - 4, 7, 1, "#9aaaba"); }
  else if (code >= 16 && code <= 19) {   // an ingot crate: a stack of ingots in the metal's colour and its name
    const m = code - 16, c = metalCol(m, now()), name = ((D().metals || [])[m] || ["주괴"])[0].replace("주괴", "");
    px(g, x - 7, y - 3, 14, 7, "#1a1a20"); px(g, x - 6, y - 2, 6, 2, c); px(g, x + 1, y - 2, 5, 2, c); px(g, x - 3, y + 1, 6, 2, c);
    g.font = "8px Galmuri11, monospace"; g.textAlign = "center"; g.fillStyle = "#1a1a20"; g.fillText(name, x + 1, y - 5); g.fillStyle = c; g.fillText(name, x, y - 6); g.textAlign = "left";
  }
  else if (code === 10) { px(g, x - 5, y - 2, 10, 4, "#1a1a20"); px(g, x - 4, y - 1, 8, 2, "#7a7e8a"); px(g, x - 4, y - 1, 8, 1, "#a8acb8"); }   // 쇠막대
  else if (code === 11) { px(g, x - 1, y - 4, 3, 5, "#2a1e16"); px(g, x, y - 4, 1, 4, "#ffd860"); px(g, x - 3, y, 7, 2, "#2a1e16"); px(g, x - 2, y, 5, 1, "#ffd860"); }   // 납품 ↓
  else if (code === 12) { px(g, x - 2, y - 3, 5, 6, "#10203a"); px(g, x - 1, y - 2, 3, 4, "#5aa0e0"); px(g, x, y - 4, 1, 1, "#10203a"); }   // 담금질 물
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
/** A piece of iron by its heat 0–100 (100 hot): grey → red → orange → yellow-white. */
const heatCol = (h) => (h >= 100 ? "#fff0a0" : h >= 70 ? "#ff9a30" : h >= 40 ? "#d0402a" : h >= 15 ? "#7a3a30" : "#6a6e7a");
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
function drawCustomer(g, t, sx, sy, row) {
  const [id, , , , k, left, dur, arr, gone] = row, fur = ["#c89060", "#e8e0d0", "#8a6a4a", "#d8b070", "#a0a0a8"][id % 5], cloth = ["#5a8ab0", "#b05a5a", "#6aa060", "#a07ac0", "#c0904a"][(id >> 1) % 5];
  const moving = gone || dsLeft(arr) > 0, bob = moving && Math.floor(t / 180) % 2 ? 1 : 0;
  g.fillStyle = "rgba(20,24,50,.26)"; g.beginPath(); g.ellipse(sx, sy, 5, 2, 0, 0, 7); g.fill();
  px(g, sx - 4, sy - 9 - bob, 8, 8, "#1a1a20"); px(g, sx - 3, sy - 8 - bob, 6, 6, cloth);                       // body
  px(g, sx - 3, sy - 1, 2, 1, "#1a1a20"); px(g, sx + 1, sy - 1, 2, 1, "#1a1a20");                               // feet
  px(g, sx - 4, sy - 16 - bob, 8, 7, "#1a1a20"); px(g, sx - 3, sy - 15 - bob, 6, 5, fur);                       // head
  px(g, sx - 4, sy - 18 - bob, 2, 3, "#1a1a20"); px(g, sx + 2, sy - 18 - bob, 2, 3, "#1a1a20");                 // ears
  px(g, sx - 2, sy - 13 - bob, 1, 1, "#1a1a20"); px(g, sx + 1, sy - 13 - bob, 1, 1, "#1a1a20");                 // dot eyes
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
/**
 * The forge's rhythm lane over an anvil whose pattern plays: the notes slide left onto the hit line (2 s ahead), blows gold,
 * 갑옷's answers blue, flips as arrows; the bar's heat underneath. Times are the snapshot's (beat 0 and heat, ms from then).
 */
function drawLane(g, t, sx, sy, row) {
  const [id, , , , , k, n, , per, b0, hot] = row, o = (D().orders || [])[k];
  if (!o) return;
  const nowL = now() < st.stop ? st.stopAt : now(), base = (st.entsAt || 0) + b0, W = 76, x0 = sx - 30, y = sy - 60, hit = x0 + 8, span = 2000;
  const mine = st.lane === id;
  px(g, x0 - 1, y - 7, W + 2, 14, "#1a1a20"); px(g, x0, y - 6, W, 12, mine ? "#3a2a24" : "#2a2226");
  // the hot bar being shaped, in a slot at the lane's left end (the anvil itself hides under the hammer's name tag)
  px(g, x0 - 17, y - 7, 17, 14, "#1a1a20"); px(g, x0 - 16, y - 6, 15, 12, "#6a5444");
  drawPiece(g, x0 - 8, y + 1, k, 1, t, row[11]);
  const fl = st.flash[id], fla = fl && now() - fl[0] < 160 ? fl[1] : -1;
  px(g, hit - 1, y - 6, 3, 12, fla === 0 ? "#ffffff" : fla === 1 ? "#ffd860" : fla === 2 ? "#e05040" : "#c8a070");
  o[4].forEach(([b, kind], i) => {
    if (i < n) return;
    const dt = base + b * per - nowL, x = Math.round(hit + (dt / span) * (W - 10));
    if (x > x0 + W - 3 || dt < -400) return;
    if (kind >= 2) {
      // a flip: an arrow ↑ → ↓ ←, white on orange
      px(g, x - 3, y - 4, 7, 7, "#1a1a20"); px(g, x - 2, y - 3, 5, 5, "#ff9a40");
      const d = kind - 2;
      if (d === 0 || d === 2) { px(g, x, y - 2, 1, 4, "#ffffff"); px(g, x - 1, d ? y + 1 : y - 2, 3, 1, "#ffffff"); }
      else { px(g, x - 2, y, 4, 1, "#ffffff"); px(g, d === 1 ? x + 1 : x - 2, y - 1, 1, 3, "#ffffff"); }
    } else { px(g, x - 2, y - 3, 5, 6, "#1a1a20"); px(g, x - 1, y - 2, 3, 4, kind === 1 ? "#60c0ff" : "#ffd860"); }
  });
  // the heat left: a bar from yellow to red as it cools
  const left = hot - (now() - (st.entsAt || 0)), f = Math.max(0, Math.min(1, left / 8000));
  px(g, x0, y + 7, W, 2, "#1a1a20"); px(g, x0, y + 7, Math.round(W * f), 2, f > 0.4 ? "#ffb040" : "#e05040");
}
/** Forge rows: furnace [.., T, heat…] (a thermometer and the bars in the mouth) · anvil [.., state, kind, strikes, ms to beat, beat ms]. */
function drawForge(g, t, sx, sy, row) {
  const [id, kind] = row, F = D().forge || [60, 80, 90, 4], al = jobOf() === "alch";
  if (kind === 6) {
    const T = Math.max(0, row[4] - (F[3] * (now() - (st.entsAt || 0))) / 1000), ns = al ? row.length - 5 : (row.length - 5) / 2, bars = row.slice(5, 5 + ns), mts = row.slice(5 + ns);
    if (al) {   // 가마: a brick dome over the furnace furniture, its mouth glowing green/purple with the heat
      px(g, sx - 10, sy - 30, 20, 4, "#2a1a14"); px(g, sx - 12, sy - 26, 24, 14, "#2a1a14"); px(g, sx - 9, sy - 29, 18, 3, "#a0583a");
      px(g, sx - 11, sy - 25, 22, 12, "#8a4a30"); for (let i = 0; i < 3; i++) px(g, sx - 11, sy - 22 + i * 4, 22, 1, "#5a2e1e");
      px(g, sx - 9, sy - 18, 18, 7, "#1a1014"); px(g, sx - 8, sy - 17, 16, 5, T >= F[0] ? (Math.floor(t / 300) % 2 ? "#6ad050" : "#9a50d0") : "#3a2a3a");
    }
    // thermometer: 20 px, the good band marked, the level coloured by band
    const x = sx + 14, y = sy - 34;
    px(g, x - 1, y - 1, 5, 22, "#1a1a20"); px(g, x, y, 3, 20, "#3a3a44");
    px(g, x - 2, y + 20 - Math.round((F[1] / 100) * 20), 7, 1, "#8fd060"); px(g, x - 2, y + 20 - Math.round((F[0] / 100) * 20), 7, 1, "#8fd060");
    const h = Math.round((T / 100) * 20);
    px(g, x, y + 20 - h, 3, h, T > F[2] ? "#ff4030" : T >= F[0] ? "#ffb040" : "#5a8ad0");
    bars.forEach((b, i) => { if (b >= 0) { px(g, sx - 8 + i * 9, sy - 14, 7, 3, "#1a1a20"); px(g, sx - 7 + i * 9, sy - 13, 5, 1, al ? brewCol(b, t) : b >= 100 && Math.floor(t / 250) % 2 ? "#ffffff" : heatCol(b)); if (!al && mts[i] >= 0) px(g, sx - 7 + i * 9, sy - 12, 5, 1, metalCol(mts[i], t)); } });
    if (T > F[2] && Math.floor(t / 200) % 2) px(g, sx - 1, sy - 44, 3, 5, "#ff4030");   // scorching
  } else {
    const [, , , , s, k, n] = row;
    if (al) {   // 가마솥: a black pot on the anvil furniture, its brew bubbling while it is stirred
      px(g, sx - 11, sy - 18, 22, 11, "#14141a"); px(g, sx - 12, sy - 19, 24, 3, "#2a2a34"); px(g, sx - 9, sy - 8, 3, 3, "#14141a"); px(g, sx + 6, sy - 8, 3, 3, "#14141a");
      px(g, sx - 10, sy - 18, 20, 2, !s ? "#2a3a2a" : s === 1 ? (Math.floor(t / 250) % 2 ? "#6ad050" : "#9a50d0") : BREW[k] || "#6ad050");
    }
    if (!s) return;
    const need = (((al ? D().alchOrders : D().orders) || [])[k] || [0, 8])[1];
    drawPiece(g, sx, sy - 16, k, s === 1 ? 2 : s === 2 ? 1 : 3, t, row[11]);
    for (let i = 0; i < need; i++) px(g, Math.round(sx - need * 1.5) + i * 3, sy - 24, 2, 2, i < n ? "#ffd860" : "#2a2e3a");   // strikes
    if (s === 2 && Math.floor(t / 400) % 2) px(g, sx - 1, sy - 32, 3, 5, "#5a8ad0");   // cooled: reheat
    if (s === 1 && row.length >= 11) return drawLane(g, t, sx, sy, row);   // forge v2: the rhythm lane instead of the ring
    const b = s === 1 && st.beat[id];
    if (b) {
      // the beat ring closes in on the anvil and flashes on the beat
      const ms = now() - b[0], ph = ((ms % b[1]) + b[1]) % b[1], f = ms < 0 ? 1 : 1 - ph / b[1], r = 4 + Math.round(12 * f);
      g.strokeStyle = ph < 90 && ms >= 0 ? "#ffffff" : "#ffd860"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(sx + 0.5, sy - 8.5, r * 1.4, r * 0.7, 0, 0, 7); g.stroke();
    }
  }
}
// ── 보글's kiln v2: rows t 11 kiln [.., heat ×10, ms to beat 0, beat ms, cooling ‰/s], t 12 cauldron [.., recipe, state, %, grade,
// foam, ds to trouble, next recipe]; the chart and recipes in defs.coop.brew. Your lane is st.lane (the kiln's id, or "herb").
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
/** A ready dish on its plate: 0 채소 샐러드 · 1 생선구이 · 2 고기 스튜. */
function drawDish(g, x, y, r) {
  px(g, x - 5, y, 10, 2, "#2a2a30"); px(g, x - 4, y, 8, 1, "#f0f0f0");
  if (r === 0) { px(g, x - 3, y - 3, 6, 3, "#2a4a1a"); px(g, x - 2, y - 3, 4, 2, "#6ac05a"); px(g, x - 1, y - 3, 1, 1, "#e05040"); }
  else if (r === 1) { px(g, x - 4, y - 2, 8, 2, "#3a2a1a"); px(g, x - 3, y - 2, 5, 1, "#c89050"); px(g, x + 2, y - 3, 2, 3, "#a07040"); }
  else { px(g, x - 4, y - 4, 8, 4, "#3a1a10"); px(g, x - 3, y - 3, 6, 2, "#a0502a"); px(g, x - 1, y - 6, 1, 2, "#e8e0d0"); }
}
/** What a worker holds (dish · 3 + stage): ready dishes on a plate, the rest as the raw ingredient (chopped: a knife mark). */
function drawHeld(g, x, y, code) {
  const r = Math.floor(code / 3), stage = code % 3;
  if (r === 3) drawPlate(g, x, y);
  else if (!stage) drawDish(g, x, y, r);
  else { drawIcon(g, x, y, r); if (stage === 2) px(g, x - 3, y - 4, 1, 1, "#ffffff"); }
}
/** An empty dirty plate: crumbs and a smear. */
function drawPlate(g, x, y) {
  px(g, x - 5, y, 10, 2, "#2a2a30"); px(g, x - 4, y, 8, 1, "#d8d0c0");
  px(g, x - 2, y, 2, 1, "#8a6a3a"); px(g, x + 2, y, 1, 1, "#6a4a2a"); px(g, x - 3, y - 1, 1, 1, "#8a6a3a");
}
const dsLeft = (ds) => ds * 100 - (now() - (st.entsAt || 0));
function drawDiner(g, t, sx, sy, row) {
  const [, kind, , , r, a, b] = row;
  if (kind === 3) {
    // an order: a speech bubble with the dish, a patience bar going green → yellow → red
    const left = dsLeft(a), f = Math.max(0, Math.min(1, left / (b * 100))), y = sy - 30;
    px(g, sx - 9, y - 9, 18, 14, "#2a2a30"); px(g, sx - 8, y - 8, 16, 12, "#fff8e8"); px(g, sx - 1, y + 5, 3, 2, "#2a2a30");
    drawDish(g, sx, y - 1, r);
    px(g, sx - 8, y + 8, 16, 3, "#2a2a30");
    px(g, sx - 7, y + 9, Math.max(1, Math.round(14 * f)), 1, f > 0.5 ? "#6ad050" : f > 0.25 ? "#e8c040" : "#e05040");
    if (f <= 0.25 && Math.floor(t / 250) % 2) px(g, sx + 9, y - 9, 2, 5, "#e05040");
  } else if (kind === 4) {
    // a pot on the stove: a progress bar, then the dish blinking, red when it is about to burn
    const toDone = dsLeft(a), toBurn = dsLeft(b), y = sy - 22;
    px(g, sx - 5, y - 4, 10, 6, "#1a1a1e"); px(g, sx - 4, y - 3, 8, 4, "#5a5a68");
    if (toDone > 0) { px(g, sx - 6, y + 4, 12, 3, "#2a2a30"); px(g, sx - 5, y + 5, Math.max(1, Math.round(10 * (1 - toDone / ((D().cook || [])[r] || 6000)))), 1, "#ff9a40"); }
    else if (Math.floor(t / (toBurn < 3000 ? 150 : 400)) % 2) drawDish(g, sx, y - 6, r);
    if (toDone <= 0 && toBurn < 3000) { px(g, sx - 1, y - 12, 3, 3, "#e05040"); }
    if (Math.floor(t / 300) % 2) px(g, sx - 2 + (Math.floor(t / 600) % 3), y - 7, 1, 2, "#c8c8d0");   // steam
  } else if (kind === 9) {
    // a plate: the dish being eaten at the table, then dirty; at the sink a stack with the washes done as pips
    const [, , , , eat, left, sink] = row;
    if (!sink) { drawPlate(g, sx, sy - 14); if (dsLeft(eat) > 0) px(g, sx - 2, sy - 16, 4 - (Math.floor(t / 1500) % 3), 2, "#c89050"); return; }
    const i = st.ents.filter((e) => e[1] === 9 && e[6]).indexOf(row), n = (D().washN || 3);
    drawPlate(g, sx - 1, sy - 24 - i * 2);
    if (!i) for (let k = 0; k < n; k++) px(g, sx - 4 + k * 3, sy - 30 - k, 2, 2, k < n - left ? "#a8d8ff" : "#2a2e3a");
  } else drawDish(g, sx, sy - 14, r);   // plated, on the pass
}
function drawTool(g, t, sx, sy, eid) {
  const row = st.team.find((r) => r[0] === eid);
  if (!row) return;
  const x = sx + 12, y = sy - 22;   // the prop follows its worker (tick): the tool beside their head
  if (jobOf() === "lib") {
    if (row[1] === 0) { px(g, x - 2, y - 6, 5, 4, "#1a1420"); px(g, x - 1, y - 5, 3, 2, "#c8a060"); px(g, x - 4, y - 2, 9, 4, "#1a1420"); px(g, x - 3, y - 1, 7, 2, "#c84a4a"); }   // 반납 도장
    else (row[4] || []).forEach((code, i) => drawBook(g, x, y + 2 - i * 4, code >> 4));
  } else if (jobOf() === "diner") {
    if (row[1] === 0) { px(g, x - 4, y, 7, 3, "#1a1a1e"); px(g, x - 3, y, 5, 2, "#4a4a58"); px(g, x + 3, y + 1, 4, 1, "#6a4a2a"); }   // pan
    else { px(g, x - 6, y + 2, 13, 2, "#3a2a1a"); px(g, x - 5, y + 2, 11, 1, "#b08a5a"); }                                       // tray
    (row[4] || []).forEach((code, i) => drawHeld(g, x - (row[1] ? 3 - i * 7 : 0), y - (row[1] ? 1 : 4), code));
  } else if (jobOf() === "alch") {
    if (row[1] === 1) { px(g, x, y - 1, 2, 6, "#2a1e16"); px(g, x - 3, y - 7, 8, 6, "#1a2a14"); px(g, x - 2, y - 6, 6, 4, "#8fd060"); px(g, x - 2, y - 6, 1, 4, "#5ab04a"); px(g, x + 1, y - 6, 1, 4, "#5ab04a"); }   // fan
    else { px(g, x - 4, y - 3, 8, 7, "#2a1e16"); px(g, x - 3, y - 2, 6, 5, "#8a5a3a"); px(g, x - 3, y, 6, 1, "#5a3a24"); px(g, x + 4, y, 3, 2, "#a8a8b0"); px(g, x - 6, y - 2, 2, 1, "#c8a070"); }   // 풀무 (bellows)
    if (row[5] === 1) px(g, x - 1, y - 6, 2, 2, Math.floor(t / 200) % 2 ? "#ffe060" : "#ff9a40");   // on the 풀무
    for (const code of row[4] || []) drawPiece(g, x + 1, y - 9, Math.floor(code / 5) - 1, code % 5, t);
  } else if (jobOf() === "forge") {
    if (row[1] === 0) { px(g, x - 1, y - 6, 2, 9, "#1a1a20"); px(g, x + 2, y - 6, 2, 9, "#1a1a20"); px(g, x - 1, y - 5, 1, 7, "#8a8e9a"); px(g, x + 2, y - 5, 1, 7, "#8a8e9a"); }   // tongs
    else { px(g, x, y - 2, 2, 8, "#2a1e16"); px(g, x, y - 1, 1, 6, "#b08a5a"); px(g, x - 3, y - 6, 8, 5, "#1a1a20"); px(g, x - 2, y - 5, 6, 3, "#7a7e8a"); }                 // hammer
    // what you carry, held up over your head (the ingot in its colour)
    (row[4] || []).forEach((code, i) => drawPiece(g, sx, sy - 50, Math.floor(code / 5) - 1, code % 5, t, (row[5] || [])[i]));
  } else if (row[1] === 0) {   // broom
    px(g, x - 1, y - 8, 2, 9, "#2a1e16"); px(g, x, y - 7, 1, 7, "#b08a5a");
    px(g, x - 3, y, 7, 4, "#2a1e16"); px(g, x - 2, y + 1, 5, 2, "#e0c060");
  } else {              // bin, with its load in pips
    px(g, x - 4, y - 6, 9, 9, "#1a1e28"); px(g, x - 3, y - 5, 7, 7, "#6a7a8a"); px(g, x - 3, y - 5, 7, 1, "#9aaaba");
    const cap = D().binCap || 5;
    const n = jobOf() === "apt" ? row[4] : row[2];   // apt: the bin's 칸
    for (let i = 0; i < cap; i++) px(g, x - 14 + i * 3, y + 5, 2, 2, i < n ? (n >= cap ? "#e05040" : "#8fd060") : "#2a2e3a");
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
  if (!st.cj || jobOf() === "pipe") { b.hidden = true; return; }
  if (!b.firstChild) {
    b.innerHTML = `<div class="ch-l"></div><div class="ch-g"><i></i></div><div class="ch-b"><button class="btn gold ch-work">일하기 (Space)</button><button class="btn ch-quit">그만두기</button></div>`;
    b.querySelector(".ch-work").addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); work(); });
    b.querySelector(".ch-quit").addEventListener("click", () => A.act({ t: "coop_leave" }));
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
  const txt = `${job[0]} · ${phase} ${state === 0 ? `${s}초 뒤 시작` : mmss(s)} | ${apt ? `청소율 ${pct(score)}` : `점수 ${score}${mult > 10 ? ` ×${(mult / 10).toFixed(1)}` : ""}${combo > 1 ? ` (콤보 ${combo})` : ""}`}` +
    ` | 등급 ${GRADE[grade]}${next ? ` (다음 ${apt ? pct(next) : next})` : ""}${smithy(k) ? ` | 판매 ${mess} · 화난 손님 ${cap}` : k === "diner" ? ` | 서빙 ${mess} · 화난 손님 ${cap}` : ""}` +
    `${me ? ` | ${tools[me[1]] || ""}${me[1] === 1 && !smithy(k) ? ` ${apt ? me[4] : me[2]}/${k === "diner" ? D().trayCap : k === "lib" ? LB().carry : D().binCap}` : ""}` : ""}` +
    (smithy(k) ? `\n손님 ${forgeOrders()}` : "") + (k === "lib" ? libHud(me) : "") + (k === "alch" ? brewHud(me) : st.lane ? "  ♪ 음표에 맞춰 Space · 화살표 음표는 방향키" : "");   // the forge's and kiln's open orders on a line of their own (the top line ran out of room)
  const l = b.querySelector(".ch-l");
  if (l.textContent !== txt) l.textContent = txt;
  b.classList.toggle("fever", state === 2);
  b.classList.toggle("messy", k !== "diner" && mess > cap);
  const bar = b.querySelector(".ch-g > i"), top = next || score || 1, w = `${Math.min(100, Math.round((100 * score) / top))}%`;
  if (bar.style.width !== w) bar.style.width = w;
  b.querySelector(".ch-work").disabled = !(state === 1 || state === 2);
}
/** The library's second HUD line: the 반납대 and the queue, the next book on the desk, the books in your hands. */
function libHud(me) {
  const desk = st.ents.filter((r) => r[1] === 14).sort((a, b) => a[0] - b[0]), line = st.ents.filter((r) => r[1] === 13).length, held = (me && me[1] === 1 && me[4]) || [];
  const [, , , , , , , , shelved, angry] = st.cj;
  return `\n반납대 ${desk.length}/${LB().deskCap} · 줄 ${line}명 · 꽂은 책 ${shelved} · 화난 손님 ${angry}` + (held.length ? ` | 들고 있는 책: ${held.map(libName).join(", ")}` : desk.length ? ` | 다음 책: ${libName(desk[0][4] * 16 + desk[0][5])}` : "");
}
/** apt's 청소율 (‰ on the wire) as a percentage, "60.4%". */
const pct = (v) => `${(v / 10).toFixed(1)}%`;
/** The forge's open orders, most urgent first: "검날 1:12 · 편자 0:40" (the client counts the deciseconds down). */
function forgeOrders() {
  const sk = (D().jobs[jobOf()] || [])[8], names = sk ? sk.orders.map((n) => [n]) : D().orders || [], rows = st.ents.filter((r) => r[1] === 8 && !r[8]).map((r) => [r[4], Math.max(0, Math.ceil(dsLeft(r[5]) / 1000)), r[10]]).sort((a, b) => a[1] - b[1]);
  const col = (m) => (m === undefined ? "" : ((D().metals || [])[m] || ["", ""])[1] + " ");
  return rows.length ? rows.map(([k, s, m]) => `${col(m)}${(names[k] || ["?"])[0]} ${mmss(s)}`).join(" · ") : "없음";
}
const SKILL = { apt: "배달", diner: "요리", forge: "제작", alch: "연금", lib: "배달" };
const CARD_TIP = { apt: " 쓰레기통은 10칸이 차면 꽉 차요 — 중간중간 뒷마당 버리는 곳에서 비우세요. 청소율(%)이 등급이에요. 낡은 소파는 두 명이 함께 들어요.", diner: " 손님이 기다리다 지치면 화내며 떠나요!", forge: " 음표가 선에 닿을 때 두드리세요! 물건마다 리듬이 달라요 — 갑옷은 둘이 번갈아.",
  lib: " 책마다 제목과 장르가 적혀 있어요 — 장르 색 표지판의 책장에 꽂으세요. 잘못 꽂으면 감점, 빼서 다시 꽂아야 해요!",
  alch: " 풀무는 다 함께! 같은 음표를 같이 치면 합동 풀무. 온도계의 띠를 지키고, 넘치면 부채로 F 연타!" };
/** The pay share by grade, "C 100% · B 105% · A 110% · S 120%". */
const gradePct = () => (D().gradeK || [1, 1.05, 1.1, 1.2]).map((k, i) => `${"CBAS"[i]} ${Math.round(k * 100)}%`).join(" · ");
/** By the job's owner in the lobby: the card with [근무 시작]. */
function renderCard() {
  const m = G().map, me = G().me, b = st.card || (st.card = box("coop-card", "frame"));
  let k = null, n = null;
  if (m && me && !inside()) for (const kk of Object.keys(D().jobs)) {
    if (kk === "pipe") continue;
    const j = D().jobs[kk], o = j[5] === m.id && m.npcs.find((q) => q.id === j[4]);
    if (o && Math.hypot(me.x - (o.x * T + 8), me.y - (o.y * T + 12)) < D().near - 4) { k = kk; n = o; }
  }
  const done = !!(k && G().self && (G().self.coop || []).includes(k)), party = (G().party || []).length;
  const key = k ? [k, done, party].join() : "";
  if (key === st.cardKey) return;
  st.cardKey = key;
  if (!k) { b.hidden = true; return; }
  const j = D().jobs[k];
  b.innerHTML = `<b>협동 아르바이트 · ${j[0]}</b><p>${n.name}: "일손이 필요해요! 2~4명 파티로, ${j[1]}분 근무예요."</p>` +
    `<p>${esc(j[6] || "")}${CARD_TIP[k] || ""}</p>` +
    `<p class="cc-day">${done ? "오늘 보수 수령 완료 · 보수 없이 다시 참여할 수 있어요. 조건을 충족한 미수령 팀원은 보수를 받아요."
      : `참여 조건을 충족하고 C 등급 이상이면 골드·강화석·장비·${SKILL[k] || "생활"} 경험치를 받아요.`}</p>` +
    (done ? "" : `<p class="cc-day">등급별 보수 ${gradePct()}</p>`) +
    (party > 1 ? `<button class="btn gold">파티와 ${done ? "다시 근무" : "근무 시작"} (파티장)</button><p class="cc-day">파티장만 시작할 수 있어요.</p>` : `<p class="cc-day">협동 알바는 2~4명 파티로만 할 수 있어요. 파티원과 함께 와 주세요.</p>`);
  const btn = b.querySelector("button");
  if (btn) btn.addEventListener("click", () => A.act({ t: "coop_start", k }));
  b.hidden = false;
}
function showReport(cr) {
  const [grade, score, best, rows, cuts, reward] = cr;
  const b = st.res || (st.res = box("coop-res", "frame"));
  const tools = ((D().jobs[jobOf()] || [])[2] || ["broom", "bin"]).map((t) => D().tools[t] || t);
  const pipe = jobOf() === "pipe";
  const finish = pipe ? (grade ? `배관 연결 완료 · ${mmss(score)} 남김` : "배관 연결 미완료") : grade ? "근무 완료!" : "근무 평가 미달";
  const pay = reward === 1 ? `내 보수 ${Math.round((D().gradeK || [1, 1.05, 1.1, 1.2])[grade - 1] * 100)}% 지급 완료` : "이번 근무 보수 없음";
  b.innerHTML = `<div class="cr-g g${grade}">${GRADE[grade]}</div><b>${finish}</b>` +
    (pipe ? `<p>이 채널 최고 ${mmss(best)} 남김</p><p class="cr-cut">C 연결 · B ${cuts[1]}초 · A ${cuts[2]}초 · S ${cuts[3]}초</p>` :
      jobOf() === "apt" ? `<p>청소율 ${pct(score)} · 이 채널 최고 ${pct(best)}</p><p class="cr-cut">C ${pct(cuts[0])} · B ${pct(cuts[1])} · A ${pct(cuts[2])} · S ${pct(cuts[3])}</p>` :
      `<p>점수 ${score} · 이 채널 최고 ${best}</p><p class="cr-cut">C ${cuts[0]} · B ${cuts[1]} · A ${cuts[2]} · S ${cuts[3]}</p>`) +
    (reward === undefined ? "" : `<p class="cr-cut">${reward === 2 ? "오늘 보수 수령 완료 · " : ""}${pay}</p>`) +
    `<table>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${tools[r[2]] || ""}</td><td>${r[1]}${pipe ? "칸" : "점"}</td><td>${r[3] ? "" : "참여 조건 미충족"}</td></tr>`).join("")}</table>` +
    `<p class="cr-note">잠시 뒤 로비로 돌아갑니다.</p><button class="btn">확인</button>`;
  b.querySelector("button").addEventListener("click", () => { b.hidden = true; });
  b.hidden = false;
  A.Sound.play(grade >= 3 ? "quest" : grade ? "craft_ok" : "fail");
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ───────────────────────────── events, each frame ─────────────────────────────

const SND = { 4: "swing", 5: "coin", 6: "pop", 14: "quest", 15: "fail", 18: "warn", 19: "hit", 20: "pop", 22: "coin", 23: "ui",
  30: "pop", 31: "hit", 32: "fail", 33: "warn", 34: "swing", 35: "pop", 36: "ui", 37: "ui", 38: "coin", 39: "pop", 40: "ui", 41: "swing", 42: "coin", 43: "pop",
  9: "hit", 10: "hit", 11: "fail", 12: "pop", 13: "coin", 17: "swing", 50: "ui", 51: "pop", 53: "craft_ok", 54: "pop", 55: "hit", 56: "ui", 57: "pop", 58: "craft_ok",
  61: "fail", 62: "ui", 64: "warn", 65: "ui", 66: "pop", 90: "ui", 91: "fail", 92: "book_thunk", 93: "desk_bell", 94: "book_thunk", 95: "wrong_buzz", 96: "pop", 97: "pop" };
const COL = { 4: "#c8a070", 5: "#ff9a40", 6: "#8fd060", 18: "#7a5a3a", 19: "#e8d070", 20: "#6a8a6a", 22: "#60c0ff",
  32: "#e05040", 33: "#4a4a50", 34: "#8fd060", 38: "#ffd860", 41: "#a8d8ff", 42: "#e8f4ff", 12: "#a8d8ff", 13: "#ffd860", 17: "#ff9a40", 53: "#fff0a0", 58: "#ffb040" };
/** cj and cb events; true when the event was ours. */
export function onEvent(e) {
  if (e[0] === "cb") { st.beat[e[1]] = [now() + e[2], e[3]]; return true; }   // an anvil's beat: [id, ms to the first, beat ms]
  if (e[0] !== "cj") return false;
  const [, code, x, y] = e;
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
  const own = smithy(jobOf()) && (jobOf() === "alch" ? { 13: "order_done", 61: "order_late", 66: "pop", 74: "pop", 75: "craft_ok", 76: "fail", 77: "kiln_whoosh", 78: "pop", 79: "craft_ok", 80: "boil_over", 81: "kiln_whoosh", 82: "fail", 83: "bottle_pop", 84: "kiln_whoosh" }
    : { 9: "anvil_perfect", 10: "anvil_good", 11: "anvil_miss", 12: "quench_hiss", 13: "order_done", 17: "bellows_puff", 61: "order_late", 65: "furnace_roar" })[code];
  if (own || SND[code]) A.Sound.play(own || SND[code]);
  if (code >= 9 && code <= 11) {
    A.S3.fx.spark(x, y - 8, ["#ffe060", "#ffffff", "#6a6e7a"][code - 9], code === 9 ? 1.4 : 1);   // perfect · good · miss
    const an = st.ents.find((r) => r[1] === 7 && Math.abs(r[2] - x) < 2 && Math.abs(r[3] - y) < 2);
    if (an) st.flash[an[0]] = [now(), code - 9];
    // a perfect blow on the forge: a spark burst, a short hit-stop on the lane and a little shake
    if (code === 9 && jobOf() === "forge") { A.S3.fx.burst(x, y - 10, 0.35, "#fff0a0", 10, 1); st.stopAt = now(); st.stop = now() + 70; if (A.S3.shake) A.S3.shake(2); }
  }
  if (COL[code] && (x || y)) A.S3.fx.burst(x, y, 0.3, COL[code], code === 5 || code === 22 || code === 38 ? 10 : 4, 0.8);
  return true;
}
/** The anvil whose lane is yours to play: its pattern running, you beside it with the hammer (or empty hands for 갑옷's answers). */
function laneOf() {
  const me = G().me, my = st.team.find((r) => r[0] === G().you);
  if (!me || !my || my[2]) return null;
  for (const r of st.ents) {
    if (r[1] !== 7 || r[4] !== 1 || r.length < 11 || Math.hypot(me.x - r[2], me.y - r[3]) > 34) continue;
    const o = (D().orders || [])[r[5]];
    if (my[1] === 1 || (o && o[4].some((n) => n[1] === 1))) return r[0];
  }
  return null;
}
export function tick() {
  if (!G().playing) return;
  renderCard();
  st.lane = null;
  if (inside()) {
    if (jobOf() === "pipe") { Pipes.update(st.cj, st.at); return; }
    for (const [eid] of st.team) { const pr = A.S3.props.get("ct" + eid), e = A.entityPos(eid); if (pr && e) { pr.x = e.x; pr.y = e.y + 1; } }
    for (const row of st.ents) if (row[1] === 8 && row.length >= 10) { const pr = A.S3.props.get("cp" + row[0]); if (pr) [pr.x, pr.y] = custPos(row); }
    if (jobOf() === "lib") libWalk();
    st.lane = jobOf() === "forge" ? laneOf() : jobOf() === "alch" ? brewLaneOf() : null;
    frame();
  }
  if (st.res && !st.res.hidden && !inside()) st.res.hidden = true;
}
