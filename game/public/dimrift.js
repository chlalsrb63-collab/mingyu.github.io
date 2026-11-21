/**
 * 레이드던전 in the browser (docs/design/scale-and-rift.md D.8–D.9): the keeper's window by the
 * obelisk (open / join / cancel), the ready-check window every party member in town is shown,
 * the rift HUD over the viewport (gauge, clock, party, the master's health), shrines, orbs, the
 * way home and the chest in the world (scene2d props), their sounds, and the minimap marks.
 * The server decides everything; this only draws `dim`, `rc` and `dj` from the snapshots.
 *
 * Wire: dim = [gauge×10, secs (the run's clock; the door's or the way down's countdown), state 0 run · 1 final boss · 2 cleared · 3 failed · 4 way down open, masterId, lv,
 *   [[eid, hp%, alive]…], [[id, kind, x, y, secs]…] shrines, [[id, x, y]…] orbs, [x, y]|0 way home,
 *   [x, y, 0 yours · 1 opened · 2 not yours]|0 chest, theme, [x, y]|0 master's hall, ward secs, revive secs]
 *   , floor 1..3 (0: a boss challenge), challenge 0 | [boss index, 0 · 1 casting · 2 staggered, stagger gauge left %, half-secs left, enrage steps, tries, fury]]
 * rc = [id, secs, [[eid, name, 0 asked · 1 yes · 2 no · 3 away]…], lv, leader?, 0, boss index + 1 | 0, step]
 * dj = [secs, inside, gauge×10, lv, floor, boss index + 1 | 0, step]; self.dimr = [floors in a run, most floors cleared, best full clear secs, full clears left today, weekly bonus taken 0/1, weekly boss bits, best step + 1 per boss, rotation index]
 * A Hanok run appends 1 to dim, rc and dj when applicable.
 * (dr, the chest's result, is not drawn: the server's toasts say it)
 */
import * as Art from "./dimart.js";

const $ = (s) => document.querySelector(s);
/** Set an element's text only when it differs (a same-value write still swaps the text node and restyles). */
const put = (e, s) => { if (e.textContent !== s) e.textContent = s; };
const now = () => performance.now();
const T = 16;
let A = null;                       // { G, S3, Sound, act, openWin, closeWin, isOpen, toast }
const st = { dim: null, at: 0, rc: null, rcAt: 0, rcId: 0, dj: null, props: new Set(), state: -1, hud: false, warned: false };

export function init(api) { A = api; window.__dim = st; }   // st exposed for automation (like window.__game)
const D = () => (A.G.defs && A.G.defs.dim) || { themes: {}, pylons: {}, limit: 900000, party: 4, max: 4, rcMs: 20000 };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** defs().dim.chal.bosses row `i`: [key, name, level needed, marked cast, patterns, reward bit, rotating]. */
const chalDef = (i) => ((D().chal || {}).bosses || [])[i];
/** A challenge's difficulty in words: "어려움 Lv.150" (`s` the step index of boss `i`). */
/** A raid's difficulty step as a tag (defs().dim.difs; 0 보통 shows nothing). */
const difTag = (i) => (i ? ` [${((D().difs || [])[i] || [])[0] || ""}]` : "");
const stepWord = (i, s) => { const c = D().chal || {}, st = ((chalDef(i) || [])[5] || [])[s | 0]; return st ? `${(c.stepNames || [])[s | 0] || ""} Lv.${st[0]}` : ""; };
/** Floors in a run (defs().dim.raid). */
const floors = () => (D().raid && D().raid.floors) || 3;
/** The clock's text: the way home's or the way down's countdown, a failing rift's seconds, else the run's time left. */
const clock = (state, s) => (state === 2 ? `문 ${mmss(s)}` : state === 4 ? `하강 ${s}초` : state === 3 ? `${s}초` : mmss(s));
export const inside = () => !!(A && A.G.map && String(A.G.map.id).startsWith("dim:"));

// ───────────────────────────── snapshots ─────────────────────────────

export function onSnap(s) {
  const t = now();
  if ("dim" in s) {
    const was = st.dim;
    st.dim = s.dim || null; st.at = t;
    if (st.dim && st.dim[2] !== st.state) {
      if (st.dim[2] === 1) A.Sound.play("dim_boss");
      if (st.dim[2] === 2) A.Sound.play("dim_clear");
      if (st.dim[2] === 3) A.Sound.play("fail");
      st.state = st.dim[2];
    }
    if (!st.dim) { st.state = -1; st.warned = false; }
    if (!was && st.dim) {
      A.Sound.play("dim_open");
      if (st.dim[16] && A.isOpen("dim")) A.closeWin("dim");
    }
    syncProps();
  }
  if ("rc" in s) {
    st.rc = s.rc || null; st.rcAt = t;
    if (st.rc && st.rc[0] !== st.rcId) { st.rcId = st.rc[0]; A.Sound.play("rc_ping"); A.openWin("rc"); }
    if (!st.rc && A.isOpen("rc")) A.closeWin("rc");
    renderRc();
  }
  if ("dj" in s) { st.dj = s.dj || null; if (A.isOpen("dim")) renderKeeper(); }
  if ("sty" in s) { st.sty = s.sty || null; st.styAt = t; }
  document.body.classList.toggle("in-dim", inside());
  renderHud();
  if (A.isOpen("rc")) renderRc();
  // the death panel inside: up again in the start room, nothing lost
  if (inside() && A.G.me.dead && st.dim) {
    const wait = st.dim[13] | 0;
    // (99: a boss challenge's fight is on — the party gets up together when it ends or everyone is down)
    $("#dead-loss").textContent = wait >= 99 ? "보스 도전 중에는 일어날 수 없습니다. 전멸하면 모두 함께 다시 일어납니다. (경험치 손실 없음)"
      : `레이드던전의 시작 지점에서 다시 일어납니다. (경험치 손실 없음)${wait ? ` — ${wait}초 뒤` : ""}`;
    $("#b-respawn").textContent = wait >= 99 ? "전투 중" : wait ? `시작 지점에서 부활 (${wait})` : "시작 지점에서 부활";
    $("#b-respawn").disabled = wait > 0;
  } else if ($("#b-respawn").textContent !== "마을에서 부활") { $("#b-respawn").textContent = "마을에서 부활"; $("#b-respawn").disabled = false; }
}

/** Shrines, orbs, the way home and the chest stand in the world as scene props, kept in step with the `dim` block. */
function syncProps() {
  const S3 = A.S3, keep = new Set(), d = st.dim;
  if (d) {
    for (const [id, kind, x, y, secs] of d[6]) {
      const key = "dpy" + id, t0 = now();
      keep.add(key);
      const pr = S3.props.get(key);
      if (pr) { pr.left = secs; pr.t0 = t0; continue; }
      S3.props.set(key, { x, y, until: Infinity, left: secs, t0, draw(g, t, sx, sy) { Art.drawPylon(g, t, sx, sy, kind, this.left - (t - this.t0) / 1000); } });
    }
    for (const [id, x, y] of d[7]) {
      const key = "dor" + id;
      keep.add(key);
      if (!S3.props.has(key)) S3.props.set(key, { x, y, until: Infinity, draw(g, t, sx, sy) { Art.drawOrb(g, t, sx, sy, id); } });
    }
    if (d[8]) {
      keep.add("dpt");
      if (!S3.props.has("dpt")) S3.props.set("dpt", { x: d[8][0], y: d[8][1], until: Infinity, draw(g, t, sx, sy) { Art.drawPortal(g, t, sx, sy); } });
    }
    if (d[9]) {
      keep.add("dch");
      const pr = S3.props.get("dch");
      if (pr) pr.state = d[9][2];
      else S3.props.set("dch", { x: d[9][0], y: d[9][1], until: Infinity, state: d[9][2], draw(g, t, sx, sy) { Art.drawChest(g, t, sx, sy, this.state); } });
    }
  }
  for (const key of st.props) if (!keep.has(key)) S3.props.delete(key);
  st.props = keep;
}

// ───────────────────────────── events ─────────────────────────────

/** ["dm", kind, x, y]: an orb taken, a shrine used, the chest opened, the rift opened or its master come; ["dp", x, y] the way home; ["dz", id, x, y] a monster dissolving. */
export function onEvent(e) {
  const S3 = A.S3, f = S3.fx;
  if (e[0] === "dm") {
    const [, kind, x, y] = e;
    if (kind === "orb") { f.ring(x, y, 22, "#c890ff", 360, false); f.sparkle(x, y, 0.5, "#e8c8ff", 14); A.Sound.play("dim_orb"); }
    else if (kind === "chest") { f.pillar(x, y); f.sparkle(x, y, 0.6, "#ffd84a", 20); A.Sound.play("dim_chest"); }
    else if (kind === "open") { f.wave(x, y, 60, "#b880ff", 600); A.Sound.play("dim_open"); }
    else if (kind === "boss") { f.wave(x, y, 70, "#ff5a8a", 700); f.burst(x, y, 0.4, "#b880ff", 18, 2); S3.shake && S3.shake(6); }
    else {
      const col = (Art.PYLON[kind] || Art.PYLON.gauge).col[2];
      f.wave(x, y, 80, col, 520); f.ring(x, y, 40, col, 420, true); f.sparkle(x, y, 0.8, col, 18);
      A.Sound.play("dim_pylon");
    }
    return true;
  }
  if (e[0] === "dp") { A.S3.fx.wave(e[1], e[2], 60, "#b880ff", 800); A.S3.fx.sparkle(e[1], e[2], 1, "#e8c8ff", 24); A.Sound.play("dim_portal"); return true; }
  if (e[0] === "dz") { f.burst(e[2], e[3], 0.4, "#7a4ac0", 10, 1.2); f.sparkle(e[2], e[3], 0.4, "#b880ff", 6); return true; }
  return false;
}

// ───────────────────────────── the rift HUD ─────────────────────────────

function renderHud() {
  const box = $("#dim-hud"), d = st.dim;
  if (!box) return;
  if (!d && st.sty && inside()) { renderStory(box); return; }
  if (!d || !inside()) { if (!box.hidden) box.hidden = true; return; }
  box.hidden = false;
  if (box.classList.contains("story")) box.classList.remove("story");
  const secs = Math.max(0, d[1] - Math.floor((now() - st.at) / 1000));
  const pct = Math.min(100, d[0] / 10);
  const name = D().themes[d[10]] || "레이드던전";
  const label = ["", d[8] ? "최종 보스 출현! 균열의 문으로 보스의 방 앞까지" : "최종 보스 출현! 가장 먼 방으로", "정화 완료 — 귀환의 문까지", "균열이 닫힙니다…", "하강의 문 — 다음 단으로"][d[2]];
  // the floor's own concept (defs().dim.raid.names: 1단 무너진 지하 회랑 …), else the look's name
  const names = raidOf(d[16])?.floors || (d[16] ? D().raid?.hanokNames : D().raid?.names);
  const fname = names?.[d[14] - 1] || name;
  // (the wire carries the rift's world tier; players see levels as 4·tier − 3, like monsters and doors)
  const chal = d[15], bossName = chal && chalDef(chal[0]) ? `${chalDef(chal[0])[1]} · ${stepWord(chal[0], chal[7])}` : "";
  put($("#dim-title"), chal ? `보스 도전 · ${bossName}` : `레이드던전${difTag(d[17])} Lv.${4 * d[4] - 3} · ${d[14]}단 · ${fname} (${d[14]}/${floors()})`);
  put($("#dim-time"), clock(d[2], secs));
  $("#dim-time").classList.toggle("low", (d[2] <= 1 && secs <= 180) || d[2] === 4);
  $("#dim-fill").style.width = `${pct}%`;
  put($("#dim-pct"), d[2] === 0 ? `${pct.toFixed(1)}%` : d[15] && d[2] === 1 ? "보스를 쓰러뜨리세요!" : label);
  box.classList.toggle("boss", d[2] === 1);
  box.classList.toggle("clear", d[2] === 2);
  // the party inside: a chip per member, their health
  const team = d[5].map(([eid, hp, alive]) => {
    const w = A.G.who.get(eid), me = eid === A.G.you;
    return `<span class="dim-chip${alive ? "" : " down"}${me ? " me" : ""}"><b>${esc(w ? w.name : "?")}</b><i><i style="width:${alive ? hp : 0}%"></i></i></span>`;
  }).join("");
  const ward = d[12] ? `<span class="dim-buff">수호 ${d[12]}초</span>` : "";
  const html = team + ward;
  if ($("#dim-team").dataset.k !== html) { $("#dim-team").innerHTML = html; $("#dim-team").dataset.k = html; }
  // the master's health
  const bar = $("#dim-boss");
  const m = d[3] ? A.G.mobs.get(d[3]) : null;
  if (m && A.G.defs.mobs[m.k]) {
    const def = A.G.defs.mobs[m.k], max = def.hp * (A.G.defs.eliteHp[m.el] || 1);
    bar.hidden = false;
    put($("#dim-boss-name"), chal ? `${def.name} · ${chal[5]}번째 시도${chal[4] ? ` · 광폭 ${chal[4]}` : ""}${chal[6] ? ` · 분노 ${chal[6]}` : ""}` : `최종 보스 · ${def.name}`);
    $("#dim-boss-fill").style.width = `${Math.max(0, Math.min(100, (100 * m.hp) / max))}%`;
  } else if (!bar.hidden) bar.hidden = true;
  // the stagger gauge of a marked cast: empty it with damage before the time runs out
  const sg = $("#dim-stag"), mode = chal ? chal[1] : 0;
  if (sg.hidden !== !mode) sg.hidden = !mode;
  if (mode) {
    const cd = chalDef(chal[0]), left = (chal[3] / 2).toFixed(1);
    sg.classList.toggle("broke", mode === 2);
    put($("#dim-stag-t"), mode === 1 ? `[${cd ? cd[3] : "?"}] 무력화 게이지 ${chal[2]}% · ${left}초` : `무력화! ${left}초`);
    $("#dim-stag-fill").style.width = `${mode === 1 ? chal[2] : 100}%`;
  }
  if (d[2] <= 1 && secs <= 180 && !st.warned) { st.warned = true; A.Sound.play("rift_warn"); }
}
/** A solo story fight (67-trophies.js `sty`): the boss's name, the time left, and the same [떠나기]. */
const storyLeft = () => Math.max(0, st.sty[0] - Math.floor((now() - st.styAt) / 1000));
function renderStory(box) {
  const [, won, k, raiders] = st.sty, def = A.G.defs.mobs[k];
  const rescue = Number.isInteger(raiders);
  box.hidden = false;
  box.classList.add("story"); box.classList.remove("boss", "clear");
  $("#dim-title").textContent = rescue ? "바람등호 구조" : `홀로 도전 · ${def ? def.name : "우두머리"}`;
  $("#dim-time").textContent = mmss(storyLeft());
  $("#dim-time").classList.toggle("low", !won && storyLeft() <= 60);
  $("#dim-fill").style.width = won ? "100%" : rescue ? `${(4 - raiders) * 20}%` : "0%";
  $("#dim-pct").textContent = rescue ? won ? "갑판 해방! 곧 안전 갑판으로 이동합니다" : raiders > 0 ? `남은 침입자 ${raiders}마리` : `${def.name} 격퇴`
    : won ? "승리! 전리품을 줍고 곧 돌아갑니다" : "쓰러뜨리면 보스 전리품을 얻습니다";
  if ($("#dim-team").dataset.k) { $("#dim-team").innerHTML = ""; $("#dim-team").dataset.k = ""; }
  $("#dim-boss").hidden = true;
}
/** Every frame (cheap): keep the clock ticking between snapshots. */
export function frame() { if (!st.dim && st.sty && inside()) { const el = $("#dim-time"), want = mmss(storyLeft()); if (el && el.textContent !== want) el.textContent = want; return; } if (st.dim && inside()) { const s = Math.max(0, st.dim[1] - Math.floor((now() - st.at) / 1000)); const el = $("#dim-time"); const want = clock(st.dim[2], s); if (el && el.textContent !== want) el.textContent = want; } }

// ───────────────────────────── the ready check ─────────────────────────────

function renderRc() {
  const rc = st.rc;
  if (!rc) return;
  const left = Math.max(0, rc[1] - Math.floor((now() - st.rcAt) / 1000));
  const me = rc[2].find((r) => r[0] === A.G.you);
  const WORD = ["대기 중", "수락", "거절", "입장 불가"];
  $("#rc-lv").textContent = rc[6] ? `보스 도전 · ${(chalDef(rc[6] - 1) || [])[1] || "?"} · ${stepWord(rc[6] - 1, rc[7])} · 최대 ${D().party}명`
    : `${rc[8] ? raidOf(rc[8])?.name || "레이드던전" : "레이드던전"}${difTag(rc[9])} Lv.${4 * rc[3] - 3} · ${floors()}단 레이드 · 최대 ${D().party}명`;
  $("#rc-time").textContent = `${left}초`;
  $("#rc-fill").style.width = `${(100 * left) / Math.max(1, D().rcMs / 1000)}%`;
  const rows = rc[2].map(([eid, name, s]) => `<li class="rc-${s}"><span class="rc-mark"></span><b>${esc(name)}</b><em>${WORD[s]}</em></li>`).join("");
  if ($("#rc-list").dataset.k !== rows) { $("#rc-list").innerHTML = rows; $("#rc-list").dataset.k = rows; }
  const pending = me && me[2] === 0;
  $("#rc-yes").hidden = !pending; $("#rc-no").hidden = !pending;
  $("#rc-cancel").hidden = !rc[4];
  $("#rc-wait").hidden = pending;
  $("#rc-wait").textContent = rc[4] ? "파티원의 응답을 기다리는 중…" : me && me[2] === 1 ? "수락했습니다. 다른 파티원을 기다리는 중…" : "";
}
export function bindUi() {
  $("#rc-yes").addEventListener("click", () => { if (st.rc) { A.act({ t: "dim_ready", id: st.rc[0], ok: 1 }); A.Sound.play("rc_accept"); } });
  $("#rc-no").addEventListener("click", () => { if (st.rc) { A.act({ t: "dim_ready", id: st.rc[0], ok: 0 }); A.Sound.play("rc_decline"); } });
  $("#rc-cancel").addEventListener("click", () => { A.act({ t: "dim_cancel" }); A.Sound.play("rc_decline"); });
  $("#dim-open").addEventListener("click", () => { A.act({ t: "dim_open" }); A.Sound.play("raid_enter"); });
  $("#dim-hanok").addEventListener("click", () => { A.act({ t: "dim_open", hanok: true }); A.Sound.play("raid_enter"); });
  $("#dim-pick").addEventListener("click", (e) => {
    const r = e.target.closest("button[data-a=raid]");
    if (r) { A.act({ t: "dim_open", raid: r.dataset.k, ...(st.dif ? { dif: st.dif } : {}) }); A.Sound.play("raid_enter"); return; }
    const df = e.target.closest("button[data-a=dif]");
    if (df) { st.dif = +df.dataset.i || 0; renderKeeper(); return; }
    const b = e.target.closest("button[data-a=boss]");
    if (!b) return;
    A.act({ t: "dim_open", boss: b.dataset.k, step: +b.dataset.s || 0 });
    A.Sound.play("raid_enter");
  });
  $("#dim-join").addEventListener("click", () => { A.act({ t: "dim_join" }); A.Sound.play("raid_enter"); });
  $("#dim-leave").addEventListener("click", () => {
    const ask = st.sty && !st.dim ? "도전을 그만두고 원래 자리로 돌아갈까요? (그 자리로 다시 다가가면 재도전할 수 있습니다)" : "레이드던전을 떠나 마을로 돌아갈까요? (나중에 오벨리스크에서 다시 합류할 수 있습니다)";
    A.ask(ask, "떠나기", () => A.act({ t: "dim_leave" }));
  });
}
/** Seconds left on the ready check, ticking between snapshots. */
export function tick() { if (st.rc && A.isOpen("rc")) renderRc(); frame(); }

// ───────────────────────────── the keeper by the obelisk ─────────────────────────────

/** A raid row of defs().dim.raids by its key (the wire carries the key; an old `1` meant the hanok raid). */
const raidOf = (k) => (D().raids || []).find((r) => r.k === (k === 1 ? "hanok" : k));
export function openKeeper() { A.openWin("dim"); renderKeeper(); }
function renderKeeper() {
  const d = D(), s = A.G.self, party = A.G.party || [], dj = st.dj;
  const lead = !party.length || party[0][0] === A.G.you;
  const n = floors();
  // the how-to is 도움말 → 레이드던전 (the "?" in the title bar)
  $("#dim-info").innerHTML = `<b>${n}단 레이드 · 파티 최대 ${d.party}명 · ${Math.round(d.limit / 60000)}분 제한</b>` + (s && s.st ? `<br><span class="dim-n">정화한 균열 ${s.st.dim | 0}번</span>` : "");
  // the record and the weekly boss challenge
  const r = (s && s.dimr) || [n, 0, 0, 0, 0, 0], ch = d.chal || { bosses: [] }, lvl = (s && s.lvl) || 0;
  // dimr[6]: best step + 1 per boss; dimr[7]: this week's rotating boss. Row: [k, name, need, cast, pats, steps, reward bit, rotating]
  const shown = ch.bosses.map((b, i) => [b, i]).filter(([b, i]) => !b[7] || i === r[7]);
  const challenges = shown.map(([[k, name, need, cast, , steps, bit, rotating], i]) => {
    return `<div class="dim-chal"><span>${rotating ? "순환" : "주간"} · <b>${esc(name)}</b>${r[6] && r[6][i] ? ` <em>최고 ${esc((ch.stepNames || [])[r[6][i] - 1] || "")}</em>` : ""}</span>` +
      // one button a difficulty step: its level, what it adds; greyed under the step's level (the server checks every member)
      (steps || [[0, need]]).map(([L, min], s) => `<button class="btn small" data-a="boss" data-k="${esc(k)}" data-s="${s}"${!lead || (lvl && lvl < min) ? " disabled" : ""} ` +
        `title="Lv.${min}부터 · 골드·경험치 Lv.${L} 기준${s && ch.stepR ? ` · 큰 보상 강화석 +${Math.floor(ch.stepR.stone * s)}${Math.floor(ch.stepR.rune * s) ? ` · 룬 +${Math.floor(ch.stepR.rune * s)}` : ""}${Math.floor(ch.stepR.gear * s) ? ` · 장비 +${Math.floor(ch.stepR.gear * s)}` : ""}` : ""} · [${esc(cast)}]을(를) 무력화하세요">${esc((ch.stepNames || [])[s] || "도전")} ${L ? `Lv.${L}` : ""}</button>`).join("") + `</div>`;
  }).join("") +
    (shown.length ? `<div class="dim-rw"><b>주간 토벌 보상</b> <em>(보스마다 주 1회 · 월요일 06:00 초기화)</em>` + shown.map(([[, name, , , , , bit, , big], i]) => {
      const done = r[5] & (bit ?? (1 << i)), [st, ru, ge] = big || [];
      return `<div class="${done ? "got" : ""}"><b>${esc(name)}</b> 강화석 ${st} · 룬 ${ru} · 장비 ${ge} · 참 상자 <em>${done ? "받음" : "남음"}</em></div>`;
    }).join("") + (ch.stepR ? `<div><em>난이도 한 단계마다 강화석 +${ch.stepR.stone}</em></div>` : "") + `</div>` : "");
  // the raids by level (defs().dim.raids): the leader picks one; the server checks every member's level
  // the difficulty step for the raid picked below (defs().dim.difs: [name, level needed, gold ×, xp ×, extra gear, extra stones]); 헬 has no level window
  const difs = d.difs || [], dif = Math.min(st.dif | 0, Math.max(0, difs.length - 1)), D0 = difs[dif], hell = !!(D0 && D0[1]);
  const difRow = dj || !difs.length ? "" : `<div class="dim-chal dim-dif"><span><b>난이도</b></span>` + difs.map(([name, need, g, x, ge, stn], i) =>
    `<button class="btn small${i === dif ? " gold" : ""}" data-a="dif" data-i="${i}"${need && lvl && lvl < need ? " disabled" : ""} title="${need ? `Lv.${need}부터 · 모든 몬스터가 최고 레벨로 · ` : ""}${i ? `보상 골드 ×${g} · 경험치 ×${x} · 장비 +${ge} · 강화석 +${stn}` : "기본 난이도"}">${esc(name)}</button>`).join("") + `</div>`;
  const raids = dj ? "" : difRow + (d.raids || []).map((x) => {
    const ok = !lvl || (hell ? lvl >= D0[1] : lvl >= x.minLv && (!x.maxLv || lvl <= x.maxLv));
    return `<div class="dim-chal"><span><b>${esc(x.name)}</b> <em>${hell ? `Lv.${D0[1]}+ · 최고 레벨` : `Lv.${x.minLv}${x.maxLv ? `~${x.maxLv}` : "+"}`}</em></span>` +
      `<button class="btn small${ok ? " gold" : ""}" data-a="raid" data-k="${esc(x.k)}"${!lead || !ok ? " disabled" : ""} title="${ok ? (party.length ? "파티 입장 준비" : "혼자 입장") : "레벨이 맞지 않습니다"}">${lead ? "입장" : "파티장만"}</button></div>`;
  }).join("");
  const pick = dj ? "" : raids + `<div class="dim-rec">최고 기록 ${r[1] >= r[0] ? mmss(r[2]) : r[1] ? `${r[1]}단까지` : "없음"} · 오늘 전체 보상 ${r[3]}번 남음 · 주간 첫 정화 보너스 ${r[4] ? "받음" : "남음"}</div>` +
    challenges;
  if ($("#dim-pick").dataset.k !== pick) { $("#dim-pick").innerHTML = pick; $("#dim-pick").dataset.k = pick; }
  $("#dim-hanok").hidden = true;   // the raid list (defs().dim.raids) has every raid
  $("#dim-hanok").disabled = !lead;
  $("#dim-open").hidden = !!dj || !!(d.raids && d.raids.length);
  $("#dim-open").disabled = !lead;
  $("#dim-open").textContent = party.length ? (lead ? "균열 열기 (파티 입장 준비)" : "파티장만 열 수 있습니다") : "혼자 균열 열기";
  $("#dim-join").hidden = !dj;
  if (dj) $("#dim-join").textContent = dj[5] ? `합류하기 — 보스 도전 · ${(chalDef(dj[5] - 1) || [])[1] || "?"} · ${stepWord(dj[5] - 1, dj[6])} · ${dj[1]}명 · ${mmss(dj[0])}`
    : `합류하기 — ${dj[7] ? `${raidOf(dj[7])?.name || "달그림자 한옥"}${difTag(dj[8])} · ` : ""}Lv.${4 * dj[3] - 3} · ${dj[4]}/${floors()}단 · ${dj[1]}명 · ${(dj[2] / 10).toFixed(0)}% · ${mmss(dj[0])}`;
}

// ───────────────────────────── the minimap ─────────────────────────────

/** Extra marks on the minimap inside a rift: the master's hall once it is out, shrines, orbs, the chest, the way home. */
export function miniDots(dot, t) {
  const d = st.dim;
  if (!d || !inside()) return;
  if (d[11]) { const [x, y] = d[11]; if (Math.floor(t / 400) % 2) dot(x * T + 8, y * T + 8, "#ff4a8a", 5); }
  for (const [, kind, x, y] of d[6]) dot(x, y, (Art.PYLON[kind] || Art.PYLON.gauge).col[2], 3);
  for (const [, x, y] of d[7]) dot(x, y, "#c890ff", 2);
  if (d[8]) dot(d[8][0], d[8][1], "#e8c8ff", 4);
  if (d[9]) dot(d[9][0], d[9][1], "#ffd84a", 4);
}
