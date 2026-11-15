/**
 * 무기 · 스킬 and 전직의 길 (docs/design/jobs-and-stats.md B.10, C, E; J3): the K window's two tabs
 * and 전직관 아르센's window.
 *
 * - `renderWeapons`: six weapon rows (icon, "대검 숙련 17/50", bar, scaling grades, skill chips at
 *   1 / 10 / 10P / 20), the hand highlighted; a row picked shows that weapon's skills below (the
 *   client draws those rows, they carry the quick-slot drag).
 * - `renderTree`: 모험가 on top, then the weapon table — the six weapons across the top and down the
 *   side, and where two meet, their job: a weapon with itself is its single job (mastery `defs.jobWm`,
 *   20), two different weapons their two-weapon job (both at that job's `wm`, `defs.hybWm` = 15), so
 *   all 15 pairs and the 6 singles sit in one half of a 6×6 table (docs/design/jobs-and-stats.md H).
 *   Every cell shows the job, how far each weapon is and a two-part bar; the hand's row and column are
 *   lit; a picked cell shows its card (needs, cost, signature, scaling, the way there).
 * - `renderJobNpc`: 아르센 lists the jobs (open ones first) and changes job after a confirm.
 *
 * Reads `self`: job wm wk eq gold; `defs`: jobs (each with its `wm`) skills skillOrder wkOrder wkName jobWm
 * hybWm stats grade scale. No threshold is written here: a job's is `needOf(j)`.
 * Action: `job_change {j}` (the server checks place, mastery, gold, adventurer).
 */
import { iconImg } from "./uiicons.js";
import { kindIcon } from "./mastery.js";
import { jobImg } from "./jobicons.js";
import * as Info from "./infocard.js";
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
/** The mastery job `j` asks of each of its weapons: 20 for one weapon's job, 15 for a two-weapon job. */
export const needOf = (j) => { const d = D(), job = d.jobs[j]; return job.wm || (job.kind === "hybrid" && d.hybWm) || d.jobWm; };
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
  const ready = job.wk.filter((k) => wmOf(s, k)[0] >= needOf(j)).length;
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
  const b = el("button", "btn small gold", "전직 ");
  b.append(Info.coin(job.cost, "ink"));
  b.disabled = !atJob || s.gold < job.cost;
  b.title = !atJob ? "전직관 아르센 앞에서 할 수 있습니다" : s.gold < job.cost ? "골드가 부족합니다" : "";
  b.addEventListener("click", () => { ask = j; C.Sound.play("ui"); C.redraw(); });
  host.append(b);
}

/** One line per weapon a job needs: "✓ 대검 숙련 15" / "✗ 대검 숙련 12/15". */
function needLines(s, j) {
  const box = el("div", "jt-need"), need = needOf(j);
  for (const k of D().jobs[j].wk) {
    const lv = wmOf(s, k)[0], ok = lv >= need;
    const r = el("span", ok ? "ok" : "no");
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    r.append(ok ? "✓ " : "✗ ", ic, `${D().wkName[k]} 숙련 ${ok ? need : `${lv}/${need}`}`);
    box.append(r);
  }
  return box;
}

/** The card of job `j`: what it needs, costs and gives. */
function jobCard(s, j, atJob) {
  const d = D(), job = d.jobs[j], st = jobState(s, j), sig = sigOf(j);
  const card = el("div", `jt-card ${st}`);
  const hd = el("div", "hd");
  hd.append(Info.jobMark(j));
  for (const k of job.wk) { const ic = el("img", "wi"); ic.alt = ""; ic.title = d.wkName[k]; ic.src = kindIcon(k); hd.append(ic); }
  const kindOf = el("small", "", job.kind === "hybrid" ? "두 갈래 길 " : `${d.wkName[job.wk[0]]}의 길 `);
  kindOf.append(Info.coin(job.cost));
  hd.append(el("b", "", job.name), kindOf);
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
  else if (st === "ok") { if (!atJob) foot.append(el("small", "", "버드나무광장의 전직관 아르센에게 가면 전직할 수 있습니다.")); changeButton(foot, s, j, atJob); }
  else foot.append(el("small", "", job.kind === "hybrid" ? `모험가로 남아 두 무기(${job.wk.map((k) => d.wkName[k]).join(" · ")})를 모두 숙련 ${needOf(j)}까지 다루면 열립니다. 한 무기의 길로 먼저 전직하면 닫힙니다.` : `[${d.wkName[job.wk[0]]}] 숙련 ${needOf(j)}을 채우면 열립니다. 그 무기를 들고 싸우세요.`));
  card.append(foot);
  return card;
}

// ── 무기 · 스킬 ──
/** The four chips of a weapon: L1, L10, the L10 passive, and the job's signature (its job's mastery). */
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
  if (!open) c.append(el("i", "", String(sk.job ? needOf(sk.job) : sk.need)));
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
  box.append(el("p", "hint", `스킬은 무기에 딸려 있습니다: 숙련 1과 10에 하나씩, 10에 패시브, 숙련 ${d.jobWm}에 전직하면 그 직업의 기술${d.hybWm ? ` (두 무기를 ${d.hybWm}씩 다루면 두 갈래 직업)` : ""}. 숙련은 그 무기를 들고 싸우면 오르고, 오를 때마다 그 무기 공격력이 1%씩 붙습니다.${job && job.kind === "hybrid" ? " Tab으로 두 무기를 바꿔 듭니다." : ""}`));
}

// ── 전직의 길 ──
// The table (hud.css .jt-grid): a narrow side column of weapons, then six equal columns that share the
// window's width (60 px each at most, about 52 in a 400-px window: no scaling, the pixels stay whole).

let jsel = "";
export const treeKey = () => jsel;

/** The job where weapons `a` and `b` meet (the same weapon twice: its single job). */
const jobAt = (a, b) => (a === b ? singleOf(a) : Object.keys(D().jobs).find((j) => D().jobs[j].kind === "hybrid" && D().jobs[j].wk.includes(a) && D().jobs[j].wk.includes(b)));

/** A weapon heading a column (`top`) or a row: icon, mastery, a bar to 20 with a notch at the two-weapon 15. */
function weaponHead(s, k, top) {
  const d = D(), [lv] = wmOf(s, k), hyb = d.hybWm || d.jobWm;
  const w = el("div", "jt-h " + (top ? "top" : "side") + (k === s.wk && s.eq.weapon ? " hand" : s.wk2 === k ? " back" : "") + (lv >= d.jobWm ? " ready" : lv >= hyb ? " half" : ""));
  const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
  const bar = el("i", "bar"), f = el("i"), n = el("u");
  f.style.width = `${Math.min(100, (lv / d.jobWm) * 100)}%`; n.style.left = `${(hyb / d.jobWm) * 100}%`;
  bar.append(f, n);
  w.append(ic, el("b", "", String(lv)));
  if (top) w.append(el("small", "", d.wkName[k]));
  w.append(bar);
  w.title = `${d.wkName[k]} 숙련 ${lv} — 두 갈래 직업에 ${hyb}, ${d.jobs[singleOf(k)].name} 전직에 ${d.jobWm}`;
  return w;
}

/** The table into `box`, then the card of the picked job. `atJob`: standing at 아르센. */
export function renderTree(box, s, { atJob }) {
  const d = D(), jobs = d.jobs, adv = s.job === "adventurer", hyb = d.hybWm || d.jobWm;
  box.textContent = "";
  // the root: where this character stands
  const root = el("div", "jt-root" + (adv ? " cur" : ""));
  root.append(Info.jobMark(s.job), el("b", "", adv ? "모험가" : `모험가 ▸ ${jobs[s.job].name}`));
  root.append(el("small", "", adv ? "아이콘이 있는 조합에서 전직할 수 있습니다. 전직은 한 번뿐입니다." : `지금 [${jobs[s.job].name}] — 전직은 되돌릴 수 없습니다`));
  box.append(root);

  // the picked job: by default the current one, else the first open one, else the hand's single job
  const open = Object.keys(jobs).filter((j) => jobState(s, j) === "ok");
  if (!jobs[jsel] || jobs[jsel].kind === "none") jsel = !adv ? s.job : open[0] || singleOf(d.wkOrder.includes(s.wk) ? s.wk : "sword");

  const grid = el("div", "jt-grid");
  grid.style.setProperty("--weapon-count", String(d.wkOrder.length));
  const hand = s.eq.weapon ? s.wk : "";
  const cell = (j, row, col) => {
    const job = jobs[j], st = jobState(s, j), need = needOf(j), lvs = job.wk.map((k) => wmOf(s, k)[0]);
    const b = el("button", `jt-node ${job.kind} ${st}` + (jsel === j ? " sel" : "") + (job.wk.includes(hand) ? " mine" : "") + (job.name.length > 4 ? " long" : ""));
    b.type = "button";
    b.style.gridRow = String(row + 2); b.style.gridColumn = String(col + 2);
    // the cell is the job's emblem; its name is the tooltip and the card under the table (a click picks the job)
    b.append(jobImg(j, st === "shut" ? { mono: "#6f6a60" } : undefined));
    // how far: "숙련 17/20" for one weapon, "12·9/15" for two (a weapon that is there shows ✓)
    const prog = lvs.map((lv) => (lv >= need ? "✓" : String(lv)));
    const sub = st === "cur" || st === "ok" ? STATE_TEXT[st] : st === "shut" ? "—" : `${prog.length > 1 ? prog.join("·") : `숙련 ${prog[0]}`}/${need}`;
    b.append(el("small", "", sub));
    // one bar per weapon, side by side, each filling toward what the job asks
    const bars = el("span", "bars");
    for (const lv of lvs) { const t = el("i", lv >= need ? "full" : ""), f = el("i"); f.style.width = `${Math.min(100, (lv / need) * 100)}%`; t.append(f); bars.append(t); }
    b.append(bars);
    b.title = `${job.name} — ${job.wk.map((k, i) => `${d.wkName[k]} ${lvs[i]}/${need}`).join(" + ")} · ${fmt(job.cost)}G`;
    b.addEventListener("click", () => { jsel = j; ask = ""; C.Sound.play("tab"); C.redraw(); });
    grid.append(b);
  };
  const corner = el("div", "jt-corner"); corner.append(iconImg("crown", "#8a7aa0"));
  grid.append(corner);
  d.wkOrder.forEach((k, i) => { const h = weaponHead(s, k, true); h.style.gridRow = "1"; h.style.gridColumn = String(i + 2); grid.append(h); });
  d.wkOrder.forEach((k, r) => {
    const h = weaponHead(s, k, false); h.style.gridRow = String(r + 2); h.style.gridColumn = "1"; grid.append(h);
    for (let c = 0; c <= r; c++) { const j = jobAt(k, d.wkOrder[c]); if (j) cell(j, r, c); }
  });
  // the empty half of the table holds the key
  const key = el("div", "jt-key");
  const k1 = el("span", "single"), k2 = el("span", "hybrid");
  k1.append(el("i"), `같은 무기 칸 — 한 무기의 길 · 숙련 ${d.jobWm}`);
  k2.append(el("i"), `다른 두 무기 칸 — 두 갈래 길 · 둘 다 숙련 ${hyb}`);
  key.append(k1, k2, el("small", "", "칸을 누르면 아래에 그 직업이 펼쳐집니다."));
  grid.append(key);

  const wrap = el("div", "jt-wrap");
  wrap.append(grid);
  box.append(wrap);
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
    box.append(el("p", "say", `무기 하나를 숙련 ${d.jobWm}까지 다뤘다면 그 무기의 길을, 두 무기를 모두 ${d.hybWm || d.jobWm}까지 다뤘다면 두 갈래 길을 열어 주지. 한 번 걸으면 되돌릴 수 없다네.`));
    const ids = Object.keys(jobs).filter((j) => jobs[j].kind !== "none");
    const open = ids.filter((j) => jobState(s, j) === "ok");
    if (open.length) {
      box.append(C.section("열린 길", "crown"));
      for (const j of open) box.append(jobCard(s, j, atJob));
    } else box.append(el("p", "hint", "아직 열린 길이 없습니다. 무기를 들고 싸워 숙련을 쌓으세요."));
    // the nearest of the rest: the two jobs closest to open
    const rest = ids.filter((j) => !open.includes(j)).map((j) => [j, jobs[j].wk.reduce((n, k) => n + Math.min(needOf(j), wmOf(s, k)[0]) / needOf(j), 0) / jobs[j].wk.length]).sort((a, b) => b[1] - a[1]);
    if (rest.length) {
      box.append(C.section("가까운 길", "up"));
      const list = el("div", "jt-near");
      for (const [j] of rest.slice(0, 4)) {
        const r = el("div", "it");
        const tx = el("div", "tx");
        const sm = el("small", "", ` ${jobs[j].kind === "hybrid" ? "두 갈래" : "한 무기"} `);
        sm.append(Info.coin(jobs[j].cost));
        tx.append(el("b", "", jobs[j].name), sm);
        r.append(Info.jobMark(j), tx, needLines(s, j));
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
