/**
 * 차원 균열 in the browser (docs/design/scale-and-rift.md D.8–D.9): the keeper's window by the
 * obelisk (open / join / cancel), the ready-check window every party member in town is shown,
 * the rift HUD over the viewport (gauge, clock, party, the master's health), shrines, orbs, the
 * way home and the chest in the world (scene2d props), their sounds, and the minimap marks.
 * The server decides everything; this only draws `dim`, `rc` and `dj` from the snapshots.
 *
 * Wire: dim = [gauge×10, secs, state 0 run · 1 master · 2 cleared · 3 failed, masterId, lv,
 *   [[eid, hp%, alive]…], [[id, kind, x, y, secs]…] shrines, [[id, x, y]…] orbs, [x, y]|0 way home,
 *   [x, y, 0 yours · 1 opened · 2 not yours]|0 chest, theme, [x, y]|0 master's hall, ward secs, revive secs]
 * rc = [id, secs, [[eid, name, 0 asked · 1 yes · 2 no · 3 away]…], lv, leader?]; dj = [secs, inside, gauge×10, lv]
 */
import * as Art from "./dimart.js";

const $ = (s) => document.querySelector(s);
const now = () => performance.now();
const T = 16;
let A = null;                       // { G, S3, Sound, act, openWin, closeWin, isOpen, toast }
const st = { dim: null, at: 0, rc: null, rcAt: 0, rcId: 0, dj: null, props: new Set(), state: -1, hud: false, warned: false };

export function init(api) { A = api; window.__dim = st; }   // st exposed for automation (like window.__game)
const D = () => (A.G.defs && A.G.defs.dim) || { themes: {}, pylons: {}, limit: 900000, party: 4, max: 4, rcMs: 20000 };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
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
    if (!was && st.dim) A.Sound.play("dim_open");
    syncProps();
  }
  if ("rc" in s) {
    st.rc = s.rc || null; st.rcAt = t;
    if (st.rc && st.rc[0] !== st.rcId) { st.rcId = st.rc[0]; A.Sound.play("rc_ping"); A.openWin("rc"); }
    if (!st.rc && A.isOpen("rc")) A.closeWin("rc");
    renderRc();
  }
  if ("dj" in s) { st.dj = s.dj || null; if (A.isOpen("dim")) renderKeeper(); }
  document.body.classList.toggle("in-dim", inside());
  renderHud();
  if (A.isOpen("rc")) renderRc();
  // the death panel inside: up again in the start room, nothing lost
  if (inside() && A.G.me.dead && st.dim) {
    const wait = st.dim[13] | 0;
    $("#dead-loss").textContent = `차원 균열의 시작 지점에서 다시 일어납니다. (경험치 손실 없음)${wait ? ` — ${wait}초 뒤` : ""}`;
    $("#b-respawn").textContent = wait ? `시작 지점에서 부활 (${wait})` : "시작 지점에서 부활";
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
    else if (kind === "chest") { f.pillar(x, y); f.sparkle(x, y, 0.6, "#ffd84a", 20); A.Sound.play("loot"); }
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
  if (!d || !inside()) { if (!box.hidden) box.hidden = true; return; }
  box.hidden = false;
  const secs = Math.max(0, d[1] - Math.floor((now() - st.at) / 1000));
  const pct = Math.min(100, d[0] / 10);
  const name = D().themes[d[10]] || "차원 균열";
  const label = ["", "균열의 주인 출현!", "정화 완료 — 귀환의 문까지", "균열이 닫힙니다…"][d[2]];
  // (the wire carries the rift's world tier; players see levels as 4·tier − 3, like monsters and doors)
  $("#dim-title").textContent = `차원 균열 Lv.${4 * d[4] - 3} · ${name}`;
  $("#dim-time").textContent = d[2] === 2 ? `문 ${mmss(secs)}` : d[2] === 3 ? `${secs}초` : mmss(secs);
  $("#dim-time").classList.toggle("low", d[2] <= 1 && secs <= 180);
  $("#dim-fill").style.width = `${pct}%`;
  $("#dim-pct").textContent = d[2] === 0 ? `${pct.toFixed(1)}%` : label;
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
    $("#dim-boss-name").textContent = `균열의 주인 · ${def.name}`;
    $("#dim-boss-fill").style.width = `${Math.max(0, Math.min(100, (100 * m.hp) / max))}%`;
  } else bar.hidden = true;
  if (d[2] <= 1 && secs <= 180 && !st.warned) { st.warned = true; A.Sound.play("rift_warn"); }
}
/** Every frame (cheap): keep the clock ticking between snapshots. */
export function frame() { if (st.dim && inside()) { const s = Math.max(0, st.dim[1] - Math.floor((now() - st.at) / 1000)); const el = $("#dim-time"); const want = st.dim[2] === 2 ? `문 ${mmss(s)}` : st.dim[2] === 3 ? `${s}초` : mmss(s); if (el && el.textContent !== want) el.textContent = want; } }

// ───────────────────────────── the ready check ─────────────────────────────

function renderRc() {
  const rc = st.rc;
  if (!rc) return;
  const left = Math.max(0, rc[1] - Math.floor((now() - st.rcAt) / 1000));
  const me = rc[2].find((r) => r[0] === A.G.you);
  const WORD = ["대기 중", "수락", "거절", "마을 밖"];
  $("#rc-lv").textContent = `차원 균열 Lv.${4 * rc[3] - 3} · 최대 ${D().party}명`;
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
  $("#rc-yes").addEventListener("click", () => { if (st.rc) { A.act({ t: "dim_ready", id: st.rc[0], ok: 1 }); A.Sound.play("ui"); } });
  $("#rc-no").addEventListener("click", () => { if (st.rc) { A.act({ t: "dim_ready", id: st.rc[0], ok: 0 }); A.Sound.play("ui"); } });
  $("#rc-cancel").addEventListener("click", () => { A.act({ t: "dim_cancel" }); A.Sound.play("ui"); });
  $("#dim-open").addEventListener("click", () => { A.act({ t: "dim_open" }); A.Sound.play("ui"); });
  $("#dim-join").addEventListener("click", () => { A.act({ t: "dim_join" }); A.Sound.play("ui"); });
  $("#dim-leave").addEventListener("click", () => { if (confirm("차원 균열을 떠나 마을로 돌아갈까요? (나중에 오벨리스크에서 다시 합류할 수 있습니다)")) A.act({ t: "dim_leave" }); });
}
/** Seconds left on the ready check, ticking between snapshots. */
export function tick() { if (st.rc && A.isOpen("rc")) renderRc(); frame(); }

// ───────────────────────────── the keeper by the obelisk ─────────────────────────────

export function openKeeper() { A.openWin("dim"); renderKeeper(); }
function renderKeeper() {
  const d = D(), s = A.G.self, party = A.G.party || [], dj = st.dj;
  const lead = !party.length || party[0][0] === A.G.you;
  const pyl = Object.values(d.pylons || {}).map(([n]) => n).join(" · ");
  $("#dim-info").innerHTML = `파티장이 균열을 열면 마을에 있는 파티원 모두에게 입장 준비 창이 뜹니다. 수락한 사람만 함께 들어갑니다.<br>` +
    `<b>${Math.round(d.limit / 60000)}분</b> 안에 몬스터를 쓰러뜨려 균열 게이지를 채우면 <b>균열의 주인</b>이 나타납니다. 정예가 남긴 <b>균열의 구슬</b>과 기둥(${pyl})을 놓치지 마세요.<br>` +
    `주인을 쓰러뜨리면 파티원마다 보상 상자가 열립니다. 하루 첫 3번은 경험치를 모두 받습니다.` + (s && s.st ? `<br><span class="dim-n">정화한 균열: ${s.st.dim | 0}번</span>` : "");
  $("#dim-open").hidden = !!dj;
  $("#dim-open").disabled = !lead;
  $("#dim-open").textContent = party.length ? (lead ? "균열 열기 (파티 입장 준비)" : "파티장만 열 수 있습니다") : "혼자 균열 열기";
  $("#dim-join").hidden = !dj;
  if (dj) $("#dim-join").textContent = `합류하기 — Lv.${4 * dj[3] - 3} · ${dj[1]}명 · ${(dj[2] / 10).toFixed(0)}% · ${mmss(dj[0])}`;
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
