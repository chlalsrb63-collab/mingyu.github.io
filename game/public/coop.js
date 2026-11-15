/**
 * 협동 아르바이트 in the browser (v1: 동동아파트 청소; logic 68-coop.js, docs/design/life-and-coop.md C). The server
 * decides everything; this draws and asks.
 * - Lobby: by the job's owner (관리인 동동) a card offers [근무 시작] → `coop_start {k}` (the party comes along).
 * - Inside: `cj` drives the HUD line (time, score ×mult, grade and the next cut-off, mess), `C` the piles / bundles /
 *   sofa (scene props), `cr` the report card. Space / F (or the [청소] button) send `coop_act`; [그만두기] `coop_leave`.
 * - Events `["cj", code, x, y, a]`: 4 sweep · 5 burn · 6 bin pick · 14 fever · 15 complaint · 18 spread · 19 lift ·
 *   20 tied · 21 the end · 22 recycle · 23 tool swap.
 */
const T = 16;
const now = () => performance.now();
let A = null;   // { G, S3, Sound, act, toast, entityPos }
const st = { cj: null, at: 0, ents: [], keys: [], team: [], hud: null, card: null, res: null, cardKey: "" };

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
/** The entities as scene props (the old ones go). */
function setEnts(rows) {
  for (const k of st.keys) A.S3.props.delete(k);
  st.keys = [];
  st.ents = rows;
  for (const [id, t, x, y, hp] of rows) {
    const key = "cp" + id;
    st.keys.push(key);
    A.S3.props.set(key, { x, y, until: Infinity, draw(g, tt, sx, sy) { drawEnt(g, tt, Math.round(sx), Math.round(sy), t, hp, id); } });
  }
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
function drawTool(g, t, sx, sy, eid) {
  const row = st.team.find((r) => r[0] === eid);
  if (!row) return;
  const x = sx + 12, y = sy - 22;   // the prop follows its worker (tick): the tool beside their head
  if (row[1] === 0) {   // broom
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
    b.innerHTML = `<div class="ch-l"></div><div class="ch-g"><i></i></div><div class="ch-b"><button class="btn gold ch-work">청소 (Space)</button><button class="btn ch-quit">그만두기</button></div>`;
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
    ` | 등급 ${GRADE[grade]}${next ? ` (다음 ${next})` : ""} | 지저분함 ${mess}/${cap}${me ? ` | ${tools[me[1]] || ""}${me[1] === 1 ? ` ${me[2]}/${D().binCap}` : ""}` : ""}`;
  const l = b.querySelector(".ch-l");
  if (l.textContent !== txt) l.textContent = txt;
  b.classList.toggle("fever", state === 2);
  b.classList.toggle("messy", mess > cap);
  const bar = b.querySelector(".ch-g > i"), top = next || score || 1, w = `${Math.min(100, Math.round((100 * score) / top))}%`;
  if (bar.style.width !== w) bar.style.width = w;
  b.querySelector(".ch-work").disabled = !(state === 1 || state === 2);
}
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
    `<p>빗자루로 쓸어 묶고, 쓰레기통으로 모아 소각로나 재활용함(×1.5)에! 낡은 소파는 두 명이 함께 들어요.</p>` +
    `<p class="cc-day">${done ? "✓ 오늘 보수를 받았어요 (다시 하면 도와준 수고비만)" : "오늘의 보수: 등급 C 이상이면 골드·강화석·장비·배달 경험치"}</p>` +
    `<button class="btn gold">${party > 1 ? "파티와 근무 시작 (파티장)" : "근무 시작"}</button>`;
  b.querySelector("button").addEventListener("click", () => A.act({ t: "coop_start", k }));
  b.hidden = false;
}
function showReport(cr) {
  const [grade, score, best, rows, cuts] = cr;
  const b = st.res || (st.res = box("coop-res", "frame"));
  const tools = ["빗자루", "쓰레기통"];
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

const SND = { 4: "swing", 5: "coin", 6: "pop", 14: "quest", 15: "fail", 18: "warn", 19: "hit", 20: "pop", 22: "coin", 23: "ui" };
const COL = { 4: "#c8a070", 5: "#ff9a40", 6: "#8fd060", 18: "#7a5a3a", 19: "#e8d070", 20: "#6a8a6a", 22: "#60c0ff" };
/** cj events; true when the event was ours. */
export function onEvent(e) {
  if (e[0] !== "cj") return false;
  const [, code, x, y] = e;
  if (SND[code]) A.Sound.play(SND[code]);
  if (COL[code] && (x || y)) A.S3.fx.burst(x, y, 0.3, COL[code], code === 5 || code === 22 ? 10 : 4, 0.8);
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
