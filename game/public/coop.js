/**
 * 협동 아르바이트 in the browser (동동아파트 청소, 쥬쥬식당 서빙, 캉캉대장간 단조; logic 68-coop.js, docs/design/life-and-coop.md C). The
 * server decides everything; this draws and asks.
 * - Lobby: by the job's owner (관리인 동동, 쥬쥬, 캉캉) a card offers [근무 시작] → `coop_start {k}` (the party comes along).
 * - Inside: `cj` drives the HUD line (time, score ×mult, grade and the next cut-off, the job's sum), `C` the piles /
 *   bundles / sofa or the orders / pots / plated dishes (scene props), `cr` the report card. Space / F (or the [일하기]
 *   button) send `coop_act`; [그만두기] `coop_leave`.
 * - Events `["cb", anvil id, ms to the first beat, beat ms]` (the forge's beat ring) and `["cj", code, x, y, a]`: 4 sweep · 5 burn · 6 bin pick · 14 fever · 15 complaint · 18 spread · 19 lift ·
 *   20 tied · 21 the end · 22 recycle · 23 tool swap · diner 30 off the stove · 31 on the stove · 32 angry · 33 burnt ·
 *   34 chop · 35 plated · 36 trash · 37 from a crate · 38 served · 39 onto the tray · 40 a new order · forge 9/10/11 strike
 *   perfect/good/miss · 12 quench · 13 deliver · 17 pump · 50 bar from the crate · 51 into the fire · 53 hot · 54 out hot ·
 *   55 onto the anvil · 56 cooled piece taken · 57 shaped piece taken · 58 shaped · 61 late order · 62 new order · 64 cooled ·
 *   65 furnace in the band.
 */
const T = 16;
const now = () => performance.now();
let A = null;   // { G, S3, Sound, act, toast, entityPos }
const st = { cj: null, at: 0, ents: [], keys: [], team: [], hud: null, card: null, res: null, cardKey: "", beat: {} };

export function init(api) {
  A = api; window.__coop = st;   // st exposed for automation (like window.__game)
  // the work key: Space / F inside a shift (before input.js turns them into an attack or a talk)
  addEventListener("keydown", (e) => {
    if (!inside() || e.repeat || /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) return;
    if (e.key !== " " && e.key !== "f" && e.key !== "F" && e.key !== "ㄹ") return;
    e.preventDefault(); e.stopImmediatePropagation();
    work();
  }, true);
}
const G = () => A.G;
const D = () => (G().defs && G().defs.coop) || { jobs: {}, kinds: ["apt"], tools: {}, binCap: 5, near: 56 };
const inside = () => !!st.cj;
const work = () => { if (st.cj && (st.cj[1] === 1 || st.cj[1] === 2)) A.act({ t: "coop_act" }); };
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
  if (ents) setEnts(ents);
  if (s.cr) showReport(s.cr);
}
const jobOf = () => (st.cj ? D().kinds[st.cj[0]] : null);
/** The diner's and the forge's fixed stations (crates, boards, trash · iron crate, quench, chute) get a little icon each. */
function setStations(k) {
  const j = D().jobs[k], sts = j && j[7];
  if (!sts) return;
  const icons = k === "forge" ? [["crate", 10], ["chute", 11], ...(sts.quench || []).map((t, i) => ["quench" + i, 12, t])]
    : [["veg", 0], ["fish", 1], ["meat", 2], ["trash", 9], ...(sts.board || []).map((t, i) => ["board" + i, 8, t])];
  for (const [k, code, t] of icons) {
    const [tx, ty] = t || sts[k], key = "cs" + k;
    st.keys.push(key);
    A.S3.props.set(key, { x: tx * T + 8, y: ty * T + 10, until: Infinity, draw(g, tt, sx, sy) { drawIcon(g, Math.round(sx), Math.round(sy) - 22, code); } });
  }
}
/** The entities as scene props (the old ones go). */
function setEnts(rows) {
  for (const k of st.keys) A.S3.props.delete(k);
  st.keys = [];
  st.ents = rows; st.entsAt = now();
  for (const row of rows) {
    const [id, t, x, y, hp] = row, key = "cp" + id;
    if (t === 8) continue;   // forge orders: on the HUD only
    if (t === 7 && row[4] === 1) st.beat[id] = [st.entsAt + row[7], row[8]];
    st.keys.push(key);
    A.S3.props.set(key, { x, y, until: Infinity, draw(g, tt, sx, sy) { t >= 6 ? drawForge(g, tt, Math.round(sx), Math.round(sy), row) : t >= 3 ? drawDiner(g, tt, Math.round(sx), Math.round(sy), row) : drawEnt(g, tt, Math.round(sx), Math.round(sy), t, hp, id); } });
  }
  if (jobOf() === "diner" || jobOf() === "forge") setStations(jobOf());
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
    const w = 8 + hp * 4, h = 4 + hp * 2;
    px(g, sx - w / 2 - 1, sy - h - 1, w + 2, h + 1, "#2a1e16");
    px(g, sx - w / 2, sy - h, w, h, "#7a5a3a");
    px(g, sx - w / 2, sy - h, w, 2, "#9a7a52");
    px(g, sx - 2, sy - h - 2, 3, 2, "#d8d0b8");
    if (hp >= 2) px(g, sx + 2, sy - h + 1, 2, 2, "#5a8ab0");
    if (hp >= 3) px(g, sx - 5, sy - h + 2, 2, 1, "#c84a3a");
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
/** 쥬쥬식당 icons, about 8×7: 0 채소 · 1 생선 · 2 고기 (raw), 8 도마 · 9 쓰레기통. */
function drawIcon(g, x, y, code) {
  if (code === 0) { px(g, x - 3, y - 2, 7, 5, "#1e3a1a"); px(g, x - 2, y - 1, 5, 3, "#5ab04a"); px(g, x, y - 4, 1, 2, "#3a7a2a"); }
  else if (code === 1) { px(g, x - 4, y - 2, 8, 4, "#1e2a3a"); px(g, x - 3, y - 1, 5, 2, "#8ab0c8"); px(g, x + 2, y - 2, 2, 4, "#5a7a98"); px(g, x - 2, y - 1, 1, 1, "#1e2a3a"); }
  else if (code === 2) { px(g, x - 3, y - 2, 7, 5, "#3a1a1a"); px(g, x - 2, y - 1, 5, 3, "#d86a6a"); px(g, x - 1, y, 2, 1, "#f0c0b0"); }
  else if (code === 8) { px(g, x - 4, y - 1, 8, 3, "#5a3a1a"); px(g, x - 3, y - 1, 6, 1, "#b08a5a"); px(g, x + 1, y - 4, 1, 3, "#c8d0d8"); }
  else if (code === 9) { px(g, x - 3, y - 3, 7, 7, "#1a1e28"); px(g, x - 2, y - 2, 5, 5, "#6a7a8a"); px(g, x - 3, y - 4, 7, 1, "#9aaaba"); }
  else if (code === 10) { px(g, x - 5, y - 2, 10, 4, "#1a1a20"); px(g, x - 4, y - 1, 8, 2, "#7a7e8a"); px(g, x - 4, y - 1, 8, 1, "#a8acb8"); }   // 쇠막대
  else if (code === 11) { px(g, x - 1, y - 4, 3, 5, "#2a1e16"); px(g, x, y - 4, 1, 4, "#ffd860"); px(g, x - 3, y, 7, 2, "#2a1e16"); px(g, x - 2, y, 5, 1, "#ffd860"); }   // 납품 ↓
  else if (code === 12) { px(g, x - 2, y - 3, 5, 6, "#10203a"); px(g, x - 1, y - 2, 3, 4, "#5aa0e0"); px(g, x, y - 4, 1, 1, "#10203a"); }   // 담금질 물
}
/** A piece of iron by its heat 0–100 (100 hot): grey → red → orange → yellow-white. */
const heatCol = (h) => (h >= 100 ? "#fff0a0" : h >= 70 ? "#ff9a30" : h >= 40 ? "#d0402a" : h >= 15 ? "#7a3a30" : "#6a6e7a");
/** A forge piece in hand or on the anvil by its state (1 cold bar · 2 hot · 3 shaped · 4 quenched) and kind (0 편자 · 1 괭이날 · 2 검날 · 3 냄비). */
function drawPiece(g, x, y, kind, s, t) {
  const c = s === 2 ? (Math.floor(t / 200) % 2 ? "#fff0a0" : "#ffb040") : s === 4 ? "#a8b8c8" : s === 3 ? "#d0602a" : "#6a6e7a";
  if (s <= 2 || kind < 0) { px(g, x - 5, y - 2, 10, 4, "#1a1a20"); px(g, x - 4, y - 1, 8, 2, c); return; }
  px(g, x - 5, y - 4, 10, 7, "#1a1a20");
  if (kind === 0) { px(g, x - 4, y - 3, 2, 5, c); px(g, x + 2, y - 3, 2, 5, c); px(g, x - 4, y - 3, 8, 2, c); }   // 편자
  else if (kind === 1) { px(g, x - 4, y - 3, 8, 3, c); px(g, x - 1, y, 2, 2, c); }                               // 괭이날
  else if (kind === 2) { px(g, x - 4, y - 1, 8, 2, c); px(g, x + 4, y - 1, 1, 1, c); px(g, x - 4, y - 3, 1, 5, "#6a4a2a"); }   // 검날
  else { px(g, x - 4, y - 2, 8, 4, c); px(g, x - 3, y - 3, 6, 1, c); px(g, x - 5, y - 2, 1, 1, c); px(g, x + 4, y - 2, 1, 1, c); }   // 냄비
}
/** Forge rows: furnace [.., T, heat…] (a thermometer and the bars in the mouth) · anvil [.., state, kind, strikes, ms to beat, beat ms]. */
function drawForge(g, t, sx, sy, row) {
  const [id, kind] = row, F = D().forge || [60, 80, 90, 4];
  if (kind === 6) {
    const T = Math.max(0, row[4] - (F[3] * (now() - (st.entsAt || 0))) / 1000), bars = row.slice(5);
    // thermometer: 20 px, the good band marked, the level coloured by band
    const x = sx + 14, y = sy - 34;
    px(g, x - 1, y - 1, 5, 22, "#1a1a20"); px(g, x, y, 3, 20, "#3a3a44");
    px(g, x - 2, y + 20 - Math.round((F[1] / 100) * 20), 7, 1, "#8fd060"); px(g, x - 2, y + 20 - Math.round((F[0] / 100) * 20), 7, 1, "#8fd060");
    const h = Math.round((T / 100) * 20);
    px(g, x, y + 20 - h, 3, h, T > F[2] ? "#ff4030" : T >= F[0] ? "#ffb040" : "#5a8ad0");
    bars.forEach((b, i) => { if (b >= 0) { px(g, sx - 8 + i * 9, sy - 14, 7, 3, "#1a1a20"); px(g, sx - 7 + i * 9, sy - 13, 5, 1, b >= 100 && Math.floor(t / 250) % 2 ? "#ffffff" : heatCol(b)); } });
    if (T > F[2] && Math.floor(t / 200) % 2) px(g, sx - 1, sy - 44, 3, 5, "#ff4030");   // scorching
  } else {
    const [, , , , s, k, n] = row;
    if (!s) return;
    const need = ((D().orders || [])[k] || [0, 8])[1];
    drawPiece(g, sx, sy - 16, k, s === 1 ? 2 : s === 2 ? 1 : 3, t);
    for (let i = 0; i < need; i++) px(g, Math.round(sx - need * 1.5) + i * 3, sy - 24, 2, 2, i < n ? "#ffd860" : "#2a2e3a");   // strikes
    if (s === 2 && Math.floor(t / 400) % 2) px(g, sx - 1, sy - 32, 3, 5, "#5a8ad0");   // cooled: reheat
    const b = s === 1 && st.beat[id];
    if (b) {
      // the beat ring closes in on the anvil and flashes on the beat
      const ms = now() - b[0], ph = ((ms % b[1]) + b[1]) % b[1], f = ms < 0 ? 1 : 1 - ph / b[1], r = 4 + Math.round(12 * f);
      g.strokeStyle = ph < 90 && ms >= 0 ? "#ffffff" : "#ffd860"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(sx + 0.5, sy - 8.5, r * 1.4, r * 0.7, 0, 0, 7); g.stroke();
    }
  }
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
  if (!stage) drawDish(g, x, y, r);
  else { drawIcon(g, x, y, r); if (stage === 2) px(g, x - 3, y - 4, 1, 1, "#ffffff"); }
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
  } else drawDish(g, sx, sy - 14, r);   // plated, on the pass
}
function drawTool(g, t, sx, sy, eid) {
  const row = st.team.find((r) => r[0] === eid);
  if (!row) return;
  const x = sx + 12, y = sy - 22;   // the prop follows its worker (tick): the tool beside their head
  if (jobOf() === "diner") {
    if (row[1] === 0) { px(g, x - 4, y, 7, 3, "#1a1a1e"); px(g, x - 3, y, 5, 2, "#4a4a58"); px(g, x + 3, y + 1, 4, 1, "#6a4a2a"); }   // pan
    else { px(g, x - 6, y + 2, 13, 2, "#3a2a1a"); px(g, x - 5, y + 2, 11, 1, "#b08a5a"); }                                       // tray
    (row[4] || []).forEach((code, i) => drawHeld(g, x - (row[1] ? 3 - i * 7 : 0), y - (row[1] ? 1 : 4), code));
  } else if (jobOf() === "forge") {
    if (row[1] === 0) { px(g, x - 1, y - 6, 2, 9, "#1a1a20"); px(g, x + 2, y - 6, 2, 9, "#1a1a20"); px(g, x - 1, y - 5, 1, 7, "#8a8e9a"); px(g, x + 2, y - 5, 1, 7, "#8a8e9a"); }   // tongs
    else { px(g, x, y - 2, 2, 8, "#2a1e16"); px(g, x, y - 1, 1, 6, "#b08a5a"); px(g, x - 3, y - 6, 8, 5, "#1a1a20"); px(g, x - 2, y - 5, 6, 3, "#7a7e8a"); }                 // hammer
    for (const code of row[4] || []) drawPiece(g, x + 1, y - 9, Math.floor(code / 5) - 1, code % 5, t);
  } else if (row[1] === 0) {   // broom
    px(g, x - 1, y - 8, 2, 9, "#2a1e16"); px(g, x, y - 7, 1, 7, "#b08a5a");
    px(g, x - 3, y, 7, 4, "#2a1e16"); px(g, x - 2, y + 1, 5, 2, "#e0c060");
  } else {              // bin, with its load in pips
    px(g, x - 4, y - 6, 9, 9, "#1a1e28"); px(g, x - 3, y - 5, 7, 7, "#6a7a8a"); px(g, x - 3, y - 5, 7, 1, "#9aaaba");
    const cap = D().binCap || 5;
    for (let i = 0; i < cap; i++) px(g, x - 7 + i * 3, y + 5, 2, 2, i < row[2] ? (row[2] >= cap ? "#e05040" : "#8fd060") : "#2a2e3a");
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
  if (!st.cj) { b.hidden = true; return; }
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
  if (!c || !b) return;
  const [ki, state, secs, score, combo, mult, grade, next, mess, cap] = c;
  const k = D().kinds[ki], job = D().jobs[k] || ["협동 아르바이트"];
  const s = Math.max(0, secs - Math.floor((now() - st.at) / 1000));
  const me = st.team.find((r) => r[0] === G().you), tools = (job[2] || []).map((t) => D().tools[t] || t);
  const phase = ["준비", "근무", "피버!", "끝"][state];
  const txt = `${job[0]} · ${phase} ${state === 0 ? `${s}초 뒤 시작` : mmss(s)} | 점수 ${score}${mult > 10 ? ` ×${(mult / 10).toFixed(1)}` : ""}${combo > 1 ? ` (콤보 ${combo})` : ""}` +
    ` | 등급 ${GRADE[grade]}${next ? ` (다음 ${next})` : ""} | ${k === "forge" ? `납품 ${mess} · 납기 초과 ${cap} | 주문 ${forgeOrders()}` : k === "diner" ? `서빙 ${mess} · 화난 손님 ${cap}` : `지저분함 ${mess}/${cap}`}` +
    `${me ? ` | ${tools[me[1]] || ""}${me[1] === 1 && k !== "forge" ? ` ${me[2]}/${k === "diner" ? D().trayCap : D().binCap}` : ""}` : ""}`;
  const l = b.querySelector(".ch-l");
  if (l.textContent !== txt) l.textContent = txt;
  b.classList.toggle("fever", state === 2);
  b.classList.toggle("messy", k !== "diner" && mess > cap);
  const bar = b.querySelector(".ch-g > i"), top = next || score || 1, w = `${Math.min(100, Math.round((100 * score) / top))}%`;
  if (bar.style.width !== w) bar.style.width = w;
  b.querySelector(".ch-work").disabled = !(state === 1 || state === 2);
}
/** The forge's open orders, most urgent first: "검날 1:12 · 편자 0:40" (the client counts the deciseconds down). */
function forgeOrders() {
  const names = D().orders || [], rows = st.ents.filter((r) => r[1] === 8).map((r) => [r[4], Math.max(0, Math.ceil(dsLeft(r[5]) / 1000))]).sort((a, b) => a[1] - b[1]);
  return rows.length ? rows.map(([k, s]) => `${(names[k] || ["?"])[0]} ${mmss(s)}`).join(" · ") : "없음";
}
const SKILL = { apt: "배달", diner: "요리", forge: "제작" };
const CARD_TIP = { apt: " 낡은 소파는 두 명이 함께 들어요.", diner: " 손님이 기다리다 지치면 화내며 떠나요!", forge: " 모루의 고리가 닫힐 때 두드리면 걸작이 나와요!" };
/** By the job's owner in the lobby: the card with [근무 시작]. */
function renderCard() {
  const m = G().map, me = G().me, b = st.card || (st.card = box("coop-card", "frame"));
  let k = null, n = null;
  if (m && me && !inside()) for (const kk of Object.keys(D().jobs)) {
    const j = D().jobs[kk], o = j[5] === m.id && m.npcs.find((q) => q.id === j[4]);
    if (o && Math.hypot(me.x - (o.x * T + 8), me.y - (o.y * T + 12)) < D().near - 4) { k = kk; n = o; }
  }
  const done = !!(k && G().self && (G().self.coop || []).includes(k)), party = (G().party || []).length;
  const key = k ? [k, done, party].join() : "";
  if (key === st.cardKey) return;
  st.cardKey = key;
  if (!k) { b.hidden = true; return; }
  const j = D().jobs[k];
  b.innerHTML = `<b>협동 아르바이트 · ${j[0]}</b><p>${n.name}: "일손이 필요해요! 1~4명, ${j[1]}분 근무예요."</p>` +
    `<p>${esc(j[6] || "")}${CARD_TIP[k] || ""}</p>` +
    `<p class="cc-day">${done ? "✓ 오늘 보수를 받았어요 (다시 하면 도와준 수고비만)" : `오늘의 보수: 등급 C 이상이면 골드·강화석·장비·${SKILL[k] || "생활"} 경험치`}</p>` +
    `<button class="btn gold">${party > 1 ? "파티와 근무 시작 (파티장)" : "근무 시작"}</button>`;
  b.querySelector("button").addEventListener("click", () => A.act({ t: "coop_start", k }));
  b.hidden = false;
}
function showReport(cr) {
  const [grade, score, best, rows, cuts] = cr;
  const b = st.res || (st.res = box("coop-res", "frame"));
  const tools = ((D().jobs[jobOf()] || [])[2] || ["broom", "bin"]).map((t) => D().tools[t] || t);
  b.innerHTML = `<div class="cr-g g${grade}">${GRADE[grade]}</div><b>${grade ? "근무 완료!" : "근무 평가 미달"}</b>` +
    `<p>점수 ${score} · 이 채널 최고 ${best}</p><p class="cr-cut">C ${cuts[0]} · B ${cuts[1]} · A ${cuts[2]} · S ${cuts[3]}</p>` +
    `<table>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${tools[r[2]] || ""}</td><td>${r[1]}점</td><td>${r[3] ? "" : "보상 없음"}</td></tr>`).join("")}</table>` +
    `<p class="cr-note">잠시 뒤 로비로 돌아갑니다.</p><button class="btn">확인</button>`;
  b.querySelector("button").addEventListener("click", () => { b.hidden = true; });
  b.hidden = false;
  A.Sound.play(grade >= 3 ? "quest" : grade ? "craft_ok" : "fail");
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ───────────────────────────── events, each frame ─────────────────────────────

const SND = { 4: "swing", 5: "coin", 6: "pop", 14: "quest", 15: "fail", 18: "warn", 19: "hit", 20: "pop", 22: "coin", 23: "ui",
  30: "pop", 31: "hit", 32: "fail", 33: "warn", 34: "swing", 35: "pop", 36: "ui", 37: "ui", 38: "coin", 39: "pop", 40: "ui",
  9: "hit", 10: "hit", 11: "fail", 12: "pop", 13: "coin", 17: "swing", 50: "ui", 51: "pop", 53: "craft_ok", 54: "pop", 55: "hit", 56: "ui", 57: "pop", 58: "craft_ok",
  61: "fail", 62: "ui", 64: "warn", 65: "ui" };
const COL = { 4: "#c8a070", 5: "#ff9a40", 6: "#8fd060", 18: "#7a5a3a", 19: "#e8d070", 20: "#6a8a6a", 22: "#60c0ff",
  32: "#e05040", 33: "#4a4a50", 34: "#8fd060", 38: "#ffd860", 12: "#a8d8ff", 13: "#ffd860", 17: "#ff9a40", 53: "#fff0a0", 58: "#ffb040" };
/** cj and cb events; true when the event was ours. */
export function onEvent(e) {
  if (e[0] === "cb") { st.beat[e[1]] = [now() + e[2], e[3]]; return true; }   // an anvil's beat: [id, ms to the first, beat ms]
  if (e[0] !== "cj") return false;
  const [, code, x, y] = e;
  if (SND[code]) A.Sound.play(SND[code]);
  if (code >= 9 && code <= 11) A.S3.fx.spark(x, y - 8, ["#ffe060", "#ffffff", "#6a6e7a"][code - 9], code === 9 ? 1.4 : 1);   // perfect · good · miss
  if (COL[code] && (x || y)) A.S3.fx.burst(x, y, 0.3, COL[code], code === 5 || code === 22 || code === 38 ? 10 : 4, 0.8);
  return true;
}
export function tick() {
  if (!G().playing) return;
  renderCard();
  if (inside()) {
    frame();
    for (const [eid] of st.team) { const pr = A.S3.props.get("ct" + eid), e = A.entityPos(eid); if (pr && e) { pr.x = e.x; pr.y = e.y + 1; } }
  }
  if (st.res && !st.res.hidden && !inside()) st.res.hidden = true;
}
