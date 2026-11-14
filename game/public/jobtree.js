/**
 * 무기 · 스킬 and 전직의 길 (docs/design/jobs-and-stats.md B.10, C, E; J3): the K window's two tabs
 * and 전직관 아르센's window.
 *
 * - `renderWeapons`: six weapon rows (icon, "대검 숙련 17/50", bar, scaling grades, skill chips at
 *   1 / 10 / 10P / 20), the hand highlighted; a row picked shows that weapon's skills below (the
 *   client draws those rows, they carry the quick-slot drag).
 * - `renderTree`: 모험가 on top, the six weapons in the middle row, each one's single job above it
 *   (mastery 20) and the six two-weapon jobs below between their pairs (both at 20); lines light as
 *   mastery reaches 20; a picked node shows its card (needs, cost, signature, scaling, the way there).
 * - `renderJobNpc`: 아르센 lists the jobs (open ones first) and changes job after a confirm.
 *
 * Reads `self`: job wm wk eq gold; `defs`: jobs skills skillOrder wkOrder wkName jobWm stats grade scale.
 * Action: `job_change {j}` (the server checks place, mastery, gold, adventurer).
 */
import { iconImg } from "./uiicons.js";
import { kindIcon } from "./mastery.js";
import { skillIconUrl } from "./skillicons.js";
import { scaleText, gradeOf } from "./statwin.js";

let C = null;
/** deps: { G, act, el, section, Sound, hoverTip, redraw, openTree } */
export function init(deps) { C = deps; }
const el = (...a) => C.el(...a);
const D = () => C.G.defs;
const fmt = (n) => n.toLocaleString();
/** 으로/로 after a name. */
const ro = (name) => { const c = name.charCodeAt(name.length - 1) - 0xac00; return c >= 0 && c % 28 && c % 28 !== 8 ? "으로" : "로"; };
const wmOf = (s, k) => (Array.isArray(s.wm) ? s.wm[D().wkOrder.indexOf(k)] : null) || [1, 0, 0];

// ── jobs: who may take what ──
/** The single job of weapon `k`. */
const singleOf = (k) => Object.keys(D().jobs).find((j) => D().jobs[j].kind === "single" && D().jobs[j].wk[0] === k);
/** A job's signature skill id. */
const sigOf = (j) => D().skillOrder.find((id) => D().skills[id].job === j);
/**
 * Where `s` stands with job `j`: "cur" (it is the job), "ok" (may take it now), "half" (a two-weapon
 * job with one weapon ready), "no" (not yet), "shut" (another job taken: jobs are for good).
 */
export function jobState(s, j) {
  const job = D().jobs[j];
  if (s.job === j) return "cur";
  if (s.job !== "adventurer") return "shut";
  const ready = job.wk.filter((k) => wmOf(s, k)[0] >= D().jobWm).length;
  return ready === job.wk.length ? "ok" : ready ? "half" : "no";
}
const STATE_TEXT = { cur: "현재 직업", ok: "전직 가능", half: "한 무기 준비", no: "", shut: "닫힌 길" };

// ── the confirm (shared by the tree card and 아르센's list) ──
let ask = "";
export const key = () => ask;
/** [전직] → the question → `job_change`. `atJob`: standing at 아르센 (else the button says where to go). */
function changeButton(host, s, j, atJob) {
  const job = D().jobs[j];
  if (ask === j) {
    const cf = el("div", "confirm");
    cf.append(el("p", "", `[${job.name}]${ro(job.name)} 전직합니다. 전직은 되돌릴 수 없습니다. 계속할까요? (${fmt(job.cost)}G)`));
    const yes = el("button", "btn small gold", "전직"), no = el("button", "btn small", "취소");
    yes.disabled = !atJob || s.gold < job.cost;
    yes.addEventListener("click", () => { ask = ""; C.act({ t: "job_change", j }); C.Sound.play("ok"); C.redraw(); });
    no.addEventListener("click", () => { ask = ""; C.Sound.play("close"); C.redraw(); });
    cf.append(yes, no);
    host.append(cf);
    return;
  }
  const b = el("button", "btn small gold", `전직 ${fmt(job.cost)}G`);
  b.disabled = !atJob || s.gold < job.cost;
  b.title = !atJob ? "전직관 아르센 앞에서 할 수 있습니다" : s.gold < job.cost ? "골드가 부족합니다" : "";
  b.addEventListener("click", () => { ask = j; C.Sound.play("ui"); C.redraw(); });
  host.append(b);
}

/** One line per weapon a job needs: "✓ 대검 숙련 20" / "✗ 대검 숙련 17/20". */
function needLines(s, j) {
  const box = el("div", "jt-need");
  for (const k of D().jobs[j].wk) {
    const lv = wmOf(s, k)[0], ok = lv >= D().jobWm;
    const r = el("span", ok ? "ok" : "no");
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    r.append(ok ? "✓ " : "✗ ", ic, `${D().wkName[k]} 숙련 ${ok ? D().jobWm : `${lv}/${D().jobWm}`}`);
    box.append(r);
  }
  return box;
}

/** The card of job `j`: what it needs, costs and gives. */
function jobCard(s, j, atJob) {
  const d = D(), job = d.jobs[j], st = jobState(s, j), sig = sigOf(j);
  const card = el("div", `jt-card ${st}`);
  const hd = el("div", "hd");
  for (const k of job.wk) { const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k); hd.append(ic); }
  hd.append(el("b", "", job.name), el("small", "", job.kind === "hybrid" ? `두 갈래 길 · ${fmt(job.cost)}G` : `${d.wkName[job.wk[0]]}의 길 · ${fmt(job.cost)}G`));
  if (STATE_TEXT[st]) hd.append(el("em", st, STATE_TEXT[st]));
  card.append(hd);
  card.append(needLines(s, j));
  if (sig) {
    const sk = d.skills[sig], r = el("div", "jt-sig");
    const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(sig);
    const tx = el("div", "tx");
    tx.append(el("b", "", sk.name), el("small", "", ` MP ${sk.mp} · 재사용 ${sk.cd / 1000}초`), el("p", "", sk.desc));
    r.append(ic, tx);
    card.append(r);
  }
  const sc = el("div", "jt-scale");
  if (job.kind === "hybrid") {
    const names = Object.fromEntries(d.stats.map(([a, b]) => [a, b]));
    sc.append(el("span", "", `두 무기 모두 — ${Object.entries(job.scale).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${names[k]} ${gradeOf(c)}`).join(" · ")}`));
    sc.append(el("small", "", "보조 무기 칸이 열리고 Tab으로 두 무기를 바꿔 듭니다. 두 무기의 패시브가 늘 켜집니다."));
  } else {
    sc.append(el("span", "", `${d.wkName[job.wk[0]]} — ${scaleText({ ...s, job: j }, job.wk[0])}`));
    sc.append(el("small", "", "그 무기의 능력치 등급이 한 칸쯤 오릅니다."));
  }
  card.append(sc);
  const foot = el("div", "jt-foot");
  if (st === "cur") foot.append(el("small", "", "지금 걷고 있는 길입니다."));
  else if (st === "shut") foot.append(el("small", "", "이미 전직한 몸입니다. 전직은 되돌릴 수 없습니다."));
  else if (st === "ok") { if (!atJob) foot.append(el("small", "", "넥서스 광장의 전직관 아르센에게 가면 전직할 수 있습니다.")); changeButton(foot, s, j, atJob); }
  else foot.append(el("small", "", job.kind === "hybrid" ? `모험가로 남아 두 무기를 모두 숙련 ${d.jobWm}까지 다루면 열립니다. 한 무기의 길로 먼저 전직하면 닫힙니다.` : `${d.wkName[job.wk[0]]}을 들고 싸워 숙련 ${d.jobWm}을 채우면 열립니다.`));
  card.append(foot);
  return card;
}

// ── 무기 · 스킬 ──
/** The four chips of a weapon: L1, L10, the L10 passive, and the job's signature (20). */
function chipsOf(s, k) {
  const d = D(), own = d.skillOrder.filter((id) => d.skills[id].wk === k && !d.skills[id].job);
  const job = d.jobs[s.job];
  const sig = job && job.kind === "hybrid" && job.wk.includes(k) ? sigOf(s.job) : sigOf(singleOf(k));
  return [...own, sig].filter(Boolean);
}
function chip(s, id) {
  const d = D(), sk = d.skills[id], lv = sk.wk ? wmOf(s, sk.wk)[0] : 0;
  const open = sk.job ? s.job === sk.job : lv >= sk.need;
  const c = el("span", "chip" + (open ? "" : " off") + (sk.kind === "p" ? " pas" : "") + (sk.job ? " sig" : ""));
  const ic = el("img"); ic.alt = ""; ic.src = skillIconUrl(id);
  c.append(ic);
  if (!open) c.append(el("i", "", sk.job ? "20" : String(sk.need)));
  C.hoverTip(c, (n) => {
    n.append(el("div", "nm", sk.name));
    n.append(el("small", "", sk.kind === "p" ? "패시브" : sk.job ? `${d.jobs[sk.job].name} 전용 · MP ${sk.mp} · ${sk.cd / 1000}초` : `MP ${sk.mp} · ${sk.cd / 1000}초`));
    n.append(el("div", "", sk.desc));
    n.append(el("div", open ? "hint ok" : "hint", open ? "배운 스킬" : sk.job ? `[${d.jobs[sk.job].name}]으로 전직하면 배웁니다` : `${d.wkName[sk.wk]} 숙련 ${sk.need}에 배웁니다`));
  });
  return c;
}

let wsel = "";
export const weaponKey = () => wsel;
/** The weapon whose skills are listed: the one picked, else the hand, else the first. */
export const pickedWeapon = (s) => (D().wkOrder.includes(wsel) ? wsel : D().wkOrder.includes(s.wk) && s.eq.weapon ? s.wk : D().wkOrder[0]);

/** Six weapon rows into `box`; `skills(host, k)` draws the picked weapon's skill rows. */
export function renderWeapons(box, s, { skills }) {
  const d = D(), cur = pickedWeapon(s), job = d.jobs[s.job];
  box.textContent = "";
  const list = el("div", "wp-list");
  for (const k of d.wkOrder) {
    const [lv, xp, need] = wmOf(s, k);
    const hand = k === s.wk && !!s.eq.weapon, back = s.wk2 === k;
    const row = el("button", "wp-row" + (hand ? " hand" : "") + (k === cur ? " sel" : ""));
    row.type = "button";
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    const mid = el("div", "mid");
    const t = el("div", "t");
    t.append(el("b", "", d.wkName[k]), el("span", "lv", `숙련 ${lv}`), el("small", "", "/50"));
    if (hand) t.append(el("em", "tag", "손"));
    else if (back) t.append(el("em", "tag back", "등"));
    if (lv >= d.jobWm && s.job === "adventurer") t.append(el("em", "tag job", "전직"));
    const bar = el("i", "bar"), f = el("i"); f.style.width = `${need ? Math.min(100, (xp / need) * 100) : 100}%`; bar.append(f);
    // where 10 and 20 sit on the way to 50
    mid.append(t, bar, el("small", "sc", scaleText(s, k)));
    const chips = el("div", "chips");
    for (const id of chipsOf(s, k)) chips.append(chip(s, id));
    row.append(ic, mid, chips);
    row.title = need ? `숙련 ${lv} — 다음 숙련까지 ${fmt(xp)} / ${fmt(need)}` : "최고 숙련";
    row.addEventListener("click", () => { wsel = k; C.Sound.play("tab"); C.redraw(); });
    list.append(row);
  }
  box.append(list);
  const sec = el("div", "wp-skills");
  sec.append(C.section(`${d.wkName[cur]} 스킬`, "book"));
  skills(sec, cur);
  box.append(sec);
  box.append(el("p", "hint", `스킬은 무기에 딸려 있습니다: 숙련 1과 10에 하나씩, 10에 패시브, 숙련 ${d.jobWm}에 전직하면 그 직업의 기술. 숙련은 그 무기를 들고 싸우면 오르고, 오를 때마다 그 무기 공격력이 1%씩 붙습니다.${job && job.kind === "hybrid" ? " Tab으로 두 무기를 바꿔 듭니다." : ""}`));
}

// ── 전직의 길 ──
const COL = 64, NW = 58, W = COL * 6;
const Y = { single: 0, wpn: 46, hyb: 110, far: 160 }, H = { single: 32, wpn: 40, hyb: 32 };
const HEIGHT = Y.far + H.hyb + 2;
/** The middle row's order: every pair of a two-weapon job side by side but one (marked `far`). */
const ORDER = ["staff", "sword", "book", "dagger", "bow", "spear"];
const cx = (k) => COL * ORDER.indexOf(k) + COL / 2;

let jsel = "";
export const treeKey = () => jsel;

/** A chunky 2-px line from a to b (pixel steps, no smoothing). */
function line(g, x0, y0, x1, y1, col) {
  g.fillStyle = col;
  let a = Math.round(x0 / 2), b = Math.round(y0 / 2);
  const ex = Math.round(x1 / 2), ey = Math.round(y1 / 2), dx = Math.abs(ex - a), dy = -Math.abs(ey - b), sx = a < ex ? 1 : -1, sy = b < ey ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    g.fillRect(a * 2, b * 2, 2, 2);
    if (a === ex && b === ey) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; a += sx; }
    if (e2 <= dx) { e += dx; b += sy; }
  }
}
const INK = { off: "#4a3f5a", ready: "#c8963e", cur: "#f4d27a" };

/** The tree into `box`, then the card of the picked node. `atJob`: standing at 아르센. */
export function renderTree(box, s, { atJob }) {
  const d = D(), jobs = d.jobs, adv = s.job === "adventurer";
  box.textContent = "";
  // the root: where this character stands
  const root = el("div", "jt-root" + (adv ? " cur" : ""));
  root.append(iconImg("person", adv ? "#2a1806" : "#e2c486"), el("b", "", adv ? "모험가" : `모험가 ▸ ${jobs[s.job].name}`));
  root.append(el("small", "", adv ? `▲ 한 무기 숙련 ${d.jobWm} → 그 무기의 직업 · ▼ 두 무기 모두 ${d.jobWm} → 두 갈래 직업` : `지금 [${jobs[s.job].name}] — 전직은 되돌릴 수 없습니다`));
  box.append(root);

  const map = el("div", "jt-map");
  map.style.width = `${W}px`; map.style.height = `${HEIGHT}px`;
  const cv = el("canvas");
  cv.width = W; cv.height = HEIGHT;
  map.append(cv);
  const g = cv.getContext("2d");
  const ready = (k) => wmOf(s, k)[0] >= d.jobWm;
  const mine = (j) => s.job === j;
  // the picked node: by default the current job, else the first open one, else the hand's job
  const open = Object.keys(jobs).filter((j) => jobState(s, j) === "ok");
  if (!jobs[jsel] || jobs[jsel].kind === "none") jsel = !adv ? s.job : open[0] || singleOf(d.wkOrder.includes(s.wk) ? s.wk : "sword");

  const node = (j, x, y, h) => {
    const job = jobs[j], st = jobState(s, j);
    const b = el("button", `jt-node ${job.kind} ${st}` + (jsel === j ? " sel" : ""));
    b.type = "button";
    b.style.left = `${x - NW / 2}px`; b.style.top = `${y}px`; b.style.width = `${NW}px`; b.style.height = `${h}px`;
    b.append(el("b", "", job.name));
    // how far: "숙련 17/20" for one weapon, "17/20·9/20" for two
    const prog = job.wk.map((k) => `${Math.min(wmOf(s, k)[0], d.jobWm)}/${d.jobWm}`);
    const sub = st === "cur" || st === "ok" ? STATE_TEXT[st] : prog.length > 1 ? prog.join("·") : `숙련 ${prog[0]}`;
    b.append(el("small", "", st === "shut" ? "—" : sub));
    b.title = `${job.name} — ${job.wk.map((k) => `${d.wkName[k]} ${d.jobWm}`).join(" + ")} · ${fmt(job.cost)}G`;
    b.addEventListener("click", () => { jsel = j; ask = ""; C.Sound.play("tab"); C.redraw(); });
    map.append(b);
  };
  // weapons, and each one's single job above it
  for (const k of ORDER) {
    const x = cx(k), j = singleOf(k), [lv] = wmOf(s, k);
    line(g, x, Y.single + H.single, x, Y.wpn, mine(j) ? INK.cur : ready(k) && adv ? INK.ready : INK.off);
    node(j, x, Y.single, H.single);
    const w = el("div", "jt-wpn" + (k === s.wk && s.eq.weapon ? " hand" : "") + (ready(k) ? " ready" : ""));
    w.style.left = `${x - NW / 2}px`; w.style.top = `${Y.wpn}px`; w.style.width = `${NW}px`; w.style.height = `${H.wpn}px`;
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    const bar = el("i", "bar"), f = el("i"); f.style.width = `${Math.min(100, (lv / d.jobWm) * 100)}%`; bar.append(f);
    // the icon and the mastery level on top, the name under them, the way to 20 at the bottom
    w.append(ic, el("b", "", String(lv)), el("small", "", d.wkName[k]), bar);
    w.title = `${d.wkName[k]} 숙련 ${lv} / 전직에 ${d.jobWm}`;
    map.append(w);
  }
  // the two-weapon jobs: side by side pairs hang between their weapons, the one far pair at the bottom
  for (const j of Object.keys(jobs).filter((id) => jobs[id].kind === "hybrid")) {
    const [a, b] = jobs[j].wk, xa = cx(a), xb = cx(b), ink = (k) => (mine(j) ? INK.cur : ready(k) && adv ? INK.ready : INK.off);
    if (Math.abs(ORDER.indexOf(a) - ORDER.indexOf(b)) === 1) {
      const x = (xa + xb) / 2;
      line(g, xa, Y.wpn + H.wpn, x, Y.hyb, ink(a));
      line(g, xb, Y.wpn + H.wpn, x, Y.hyb, ink(b));
      node(j, x, Y.hyb, H.hyb);
    } else {
      const x = (xa + xb) / 2, ym = Y.far + H.hyb / 2, [l, r] = xa < xb ? [a, b] : [b, a];
      for (const [k, edge] of [[l, x - NW / 2], [r, x + NW / 2]]) {
        line(g, cx(k), Y.wpn + H.wpn, cx(k), ym, ink(k));
        line(g, cx(k), ym, edge, ym, ink(k));
      }
      node(j, x, Y.far, H.hyb);
    }
  }
  const wrap = el("div", "jt-wrap");
  wrap.append(map);
  box.append(wrap);
  // narrow windows shrink the map as a whole
  requestAnimationFrame(() => { const w = wrap.clientWidth; map.style.zoom = w && w < W ? String(w / W) : ""; });
  box.append(jobCard(s, jsel, atJob));
}

// ── 전직관 아르센 ──
/** 아르센's window: the open jobs first with their [전직], then the rest with what they still need. */
export function renderJobNpc(box, s, { atJob }) {
  const d = D(), jobs = d.jobs;
  box.textContent = "";
  if (s.job !== "adventurer") {
    box.append(el("p", "say", `이미 [${jobs[s.job].name}]의 길을 걷고 있군. 전직은 되돌릴 수 없다네. 그 길 끝까지 가 보게.`));
  } else {
    box.append(el("p", "say", `무기 하나를 숙련 ${d.jobWm}까지 다뤘다면 그 무기의 길을, 두 무기를 모두 ${d.jobWm}까지 다뤘다면 두 갈래 길을 열어 주지. 한 번 걸으면 되돌릴 수 없다네.`));
    const ids = Object.keys(jobs).filter((j) => jobs[j].kind !== "none");
    const open = ids.filter((j) => jobState(s, j) === "ok");
    if (open.length) {
      box.append(C.section("열린 길", "crown"));
      for (const j of open) box.append(jobCard(s, j, atJob));
    } else box.append(el("p", "hint", "아직 열린 길이 없습니다. 무기를 들고 싸워 숙련을 쌓으세요."));
    // the nearest of the rest: the two jobs closest to open
    const rest = ids.filter((j) => !open.includes(j)).map((j) => [j, jobs[j].wk.reduce((n, k) => n + Math.min(d.jobWm, wmOf(s, k)[0]) / d.jobWm, 0) / jobs[j].wk.length]).sort((a, b) => b[1] - a[1]);
    if (rest.length) {
      box.append(C.section("가까운 길", "up"));
      const list = el("div", "jt-near");
      for (const [j] of rest.slice(0, 4)) {
        const r = el("div", "it");
        const tx = el("div", "tx");
        tx.append(el("b", "", jobs[j].name), el("small", "", ` ${jobs[j].kind === "hybrid" ? "두 갈래" : "한 무기"} · ${fmt(jobs[j].cost)}G`));
        r.append(tx, needLines(s, j));
        list.append(r);
      }
      box.append(list);
    }
  }
  const b = el("button", "btn small", "전직의 길 보기 (K)");
  b.addEventListener("click", () => C.openTree());
  const f = el("div", "jt-more");
  f.append(b);
  box.append(f);
}
/** Forget a half-asked question when the window closes. */
export function reset() { ask = ""; }
