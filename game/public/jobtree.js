/**
 * 무기 · 스킬 and 전직의 길 (docs/design/jobs-and-stats.md B.10, C, E; J3): the K window's two tabs
 * and 전직관 아르센's window.
 *
 * - `renderWeapons`: seven weapon rows (icon, "대검 숙련 17/50", bar, scaling grades, skill chips at
 *   1 / 10 / 10P / signature), the hand highlighted; the row picked opens in place with that weapon's
 *   skills (the client draws those rows, they carry the quick-slot drag).
 * - `renderTree`: 모험가 on top, then the weapon table — the weapons across the top and down the
 *   side, and where two meet, their job: a weapon with itself is its single job (mastery `defs.jobWm`,
 *   20), two different weapons their two-weapon job (both at that job's `wm`, `defs.hybWm` = 15), so
 *   all 15 pairs and the 6 singles sit in one half of a 6×6 table (docs/design/jobs-and-stats.md H).
 *   A cell is the job's icon and ONE number (the weakest weapon's level; the detail is the hover and the
 *   card); the hand's row and column are lit; a picked cell shows its card in a fixed-height slot ABOVE the table.
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
import { K } from "./keymap.js";
import { countItem } from "./actions.js";
import { skillArmorPenetration, skillElements } from "./elements.js";

let C = null;
/** deps: { G, act, el, section, Sound, hoverTip, redraw, openTree } */
export function init(deps) { C = deps; }
const el = (...a) => C.el(...a);
const D = () => C.G.defs;
const fmt = (n) => n.toLocaleString();
/** 으로/로 after a name. */
const ro = (name) => { const c = name.charCodeAt(name.length - 1) - 0xac00; return c >= 0 && c % 28 && c % 28 !== 8 ? "으로" : "로"; };
const wmOf = (s, k) => (Array.isArray(s.wm) ? s.wm[D().wkOrder.indexOf(k)] : null) || [1, 0, 0];

// ── compact skill rows (owner: icon · cooldown · 위력 · cost at a glance, the text behind 상세보기) ──
/** ⏲ cooldown · 위력 · cost of skill `sk` (or 패시브); `wire` its self.sk row when learned, `enh` its 스킬 강화. */
export function skillStats(sk, wire, enh = 0) {
  const m = el("div", "sk-meta");
  if (sk.kind === "p") { m.append(el("span", "sk-tag", "패시브")); return m; }
  const cd = el("span", "sk-cd");
  cd.append(iconImg("clock"), `${+((wire?.[5] ?? sk.cd) / 1000).toFixed(1)}초`);
  m.append(cd);
  if (sk.mult) m.append(el("span", "sk-pow" + (enh > 0 ? " up" : ""), `위력 ${Math.round(sk.mult * 100 * (1 + ((D().ske?.pct || 2.5) / 100) * enh))}%${sk.hits > 1 ? `×${sk.hits}` : ""}`));
  m.append(el("span", "mp", `MP ${wire?.[1] ?? sk.mp}${wire?.[4] ? ` · HP ${wire[4]}` : sk.hpPct ? ` · 최대 HP ${Math.round(sk.hpPct * 100)}%` : ""}`));
  return m;
}
const openSk = new Set();
/** A 상세보기/접기 button showing and hiding `box` (hidden at first), remembered per `key` across redraws. */
export function moreButton(key, box) {
  const b = el("button", "btn small sk-more");
  const set = () => { box.hidden = !openSk.has(key); b.textContent = box.hidden ? "상세보기" : "접기"; };
  b.addEventListener("click", (e) => { e.stopPropagation(); if (openSk.has(key)) openSk.delete(key); else openSk.add(key); set(); });
  set();
  return b;
}

// ── jobs: who may take what ──
/** All jobs belonging to weapon `k` (two branches per weapon). */
const jobsOf = (k) => Object.keys(D().jobs).filter((j) => D().jobs[j].kind !== "none" && D().jobs[j].wk[0] === k);
/** The first (primary) job of weapon `k`. */
const singleOf = (k) => jobsOf(k)[0];
/** The mastery job `j` asks of its weapon (JOB_WM = 30). */
export const needOf = (j) => { const d = D(), job = d.jobs[j]; return job.wm || d.jobWm; };
/** All signature skill ids belonging to job `j` (primary Lv.5 first, then secondary Lv.30). */
const sigsOf = (j) => D().skillOrder.filter((id) => D().skills[id].job === j).sort((a, b) => (D().skills[a].jobNeed || 0) - (D().skills[b].jobNeed || 0));
/** A job's primary signature skill id. */
const sigOf = (j) => sigsOf(j)[0];
/** Labels for the signature rank already reached and the next job-level milestone. */
export function signatureProgress(defs, level) {
  const ranks = defs.jobSkillRanks;
  if (!ranks?.length) return null;
  const rank = ranks.filter(({ lv }) => (level || 0) >= lv).length;
  const current = ranks[rank - 1], next = ranks[rank];
  const bonus = ({ mp, cd }) => [mp && `MP −${mp}%`, cd && `재사용 시간 −${cd}%`].filter(Boolean).join(" · ");
  return {
    current: current ? [`전용기 ${rank}단계`, bonus(current)].filter(Boolean).join(" · ") : "",
    next: next ? `직업 Lv.${next.lv} · ${rank ? `${rank + 1}단계 · ${bonus(next)}` : "전용기 습득"}` : "",
    roadmap: ranks.map((r, i) => `Lv.${r.lv} ${i ? bonus(r) : "습득"}`).join(" / "),
  };
}
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
export const key = () => ask + "|" + rask;
/** [전직] → the question → `job_change`. `atJob`: standing at 아르센 (else the button says where to go). */
function changeButton(host, s, j, atJob) {
  const job = D().jobs[j];
  if (ask === j) {
    const cf = el("div", "confirm");
    cf.append(el("p", "", `[${job.name}]${ro(job.name)} 전직합니다. 전직관에서 전직 초기화 주문서로 모험가로 되돌릴 수 있고, 걸었던 직업은 그 레벨을 이어받습니다. 계속할까요? (${s.jobs?.some((r) => r[0] === j) ? "걸었던 길 — 무료" : fmt(job.cost) + "G"})`));
    const yes = el("button", "btn small gold", "전직"), no = el("button", "btn small", "취소");
    yes.disabled = !atJob || (s.gold < job.cost && !s.jobs?.some((r) => r[0] === j));
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
function needLines(s, j, missingOnly) {
  const box = el("div", "jt-need"), need = needOf(j);
  for (const k of D().jobs[j].wk) {
    const lv = wmOf(s, k)[0], ok = lv >= need;
    if (missingOnly && ok) continue;
    const r = el("span", ok ? "ok" : "no");
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    r.append(ok ? "✓ " : "✗ ", ic, `${D().wkName[k]} 숙련 ${ok ? need : `${lv}/${need}`}`);
    box.append(r);
  }
  return box;
}

/** The card of job `j`: what it needs, costs and gives. */
function jobCard(s, j, atJob) {
  const d = D(), job = d.jobs[j], st = jobState(s, j), sigs = sigsOf(j);
  const card = el("div", `jt-card ${st}`);
  const hd = el("div", "hd");
  hd.append(Info.jobMark(j));
  for (const k of job.wk) { const ic = el("img", "wi"); ic.alt = ""; ic.title = d.wkName[k]; ic.src = kindIcon(k); hd.append(ic); }
  const kindOf = el("small", "", `${d.wkName[job.wk[0]]}의 길 `);
  kindOf.append(Info.coin(job.cost));
  hd.append(el("b", "", job.name), kindOf);
  if (STATE_TEXT[st]) hd.append(el("em", st, STATE_TEXT[st]));
  card.append(hd);
  card.append(needLines(s, j));
  sigs.forEach((sig, idx) => {
    const sk = d.skills[sig], r = el("div", "jt-sig");
    const rank = idx === 0 ? signatureProgress(d, st === "cur" ? s.jp?.[0] : 0) : null;
    const wire = st === "cur" ? s.sk?.find(([id]) => id === sig) : null;
    const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(sig);
    const tx = el("div", "tx");
    const armorPen = skillArmorPenetration(sk);
    tx.append(el("b", "", sk.name), " ", skillElements(sk));
    const stats = skillStats(sk, wire);
    stats.append(el("span", "sk-req", sk.jobNeed ? `직업 Lv.${sk.jobNeed}` : "전직 시 습득"));
    const more = el("div", "sk-desc");
    if (armorPen) more.append(el("p", "skill-armor-pen", armorPen));
    more.append(el("p", "", sk.desc));
    if (rank) {
      const text = [rank.current, rank.next && `${rank.current ? "다음 · " : ""}${rank.next}`].filter(Boolean).join(" / ");
      const progress = el("p", "", text);
      progress.title = rank.roadmap;
      more.append(progress);
    }
    stats.append(moreButton(`jt:${j}:${sig}`, more));
    tx.append(stats, more);
    r.append(ic, tx);
    card.append(r);
  });
  const sc = el("div", "jt-scale");
  sc.append(el("span", "", `${d.wkName[job.wk[0]]} — ${scaleText({ ...s, job: j }, job.wk[0])}`));
  sc.append(el("small", "", "해당 무기 숙련 30에 두 갈래 중 하나를 선택해 전직합니다."));
  card.append(sc);
  const foot = el("div", "jt-foot");
  if (st === "cur") foot.append(el("small", "", "지금 걷고 있는 길입니다."));
  else if (st === "shut") foot.append(el("small", "", "이미 다른 길을 걷는 몸입니다. 전직관에서 전직 초기화 주문서로 모험가로 돌아가면 다시 고를 수 있습니다."));
  else if (st === "ok") { if (!atJob) foot.append(el("small", "", "버드나무광장의 전직관 아르센에게 가면 전직할 수 있습니다.")); changeButton(foot, s, j, atJob); }
  else foot.append(el("small", "", `[${d.wkName[job.wk[0]]}] 숙련 ${needOf(j)}을 채우면 열립니다. 그 무기를 들고 싸우세요.`));
  card.append(foot);
  return card;
}

// ── 무기 · 스킬 ──
/** The chips of a weapon: L1, L10, the L10 passive, and the weapon's job signature(s). */
function chipsOf(s, k) {
  const d = D(), own = d.skillOrder.filter((id) => d.skills[id].wk === k && !d.skills[id].job && d.skills[id].need <= 10);
  const job = d.jobs[s.job];
  const sig = job && job.wk[0] === k ? sigOf(s.job) : sigOf(singleOf(k));
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
  const d = D(), cur = pickedWeapon(s);
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
    if (k === cur) { const sec = el("div", "wp-skills"); skills(sec, cur); list.append(sec); }
  }
  box.append(list);
  box.append(legend());
}
/** One line under the rows: what the chips are (the long explanation is the H window's 직업과 숙련 topic, helptext.js). */
function legend() {
  const l = el("p", "wp-legend");
  const a = el("span", "chip"), b = el("span", "chip pas"), c = el("span", "chip sig off"), n = el("span", "chip off");
  for (const x of [a, b, c, n]) { const im = el("img"); im.alt = ""; im.src = skillIconUrl(D().skillOrder[0]); x.append(im); }
  n.append(el("i", "", "10"));
  l.append(a, " 스킬 ", b, " 패시브 ", c, " 직업 전용기 ", n, " 숫자 = 배우는 숙련 · 자세한 설명은 ", el("kbd", "", K("help")));
  return l;
}

// ── 전직의 길 (7 weapons × 2 branches at mastery 30) ──

let jsel = "";
export const treeKey = () => jsel;

/** The 7×2 branch list into `box`, with the picked job's card above it. `atJob`: standing at 아르센. */
export function renderTree(box, s, { atJob }) {
  const d = D(), jobs = d.jobs, adv = s.job === "adventurer";
  box.textContent = "";
  const root = el("div", "jt-root" + (adv ? " cur" : ""));
  root.append(Info.jobMark(s.job), el("b", "", adv ? "모험가" : `모험가 ▸ ${jobs[s.job].name}`));
  root.append(el("small", "", adv ? `무기 숙련 ${d.jobWm}을 달성하면 해당 무기의 두 직업 중 하나를 선택해 전직할 수 있습니다.` : `지금 [${jobs[s.job].name}] — 전직관의 전직 초기화 주문서로 모험가로 돌아갈 수 있습니다`));
  if (s.jp) {
    root.append(jobProgress(s.jp));
    const next = signatureProgress(d, s.jp[0])?.next;
    if (next) root.append(el("small", "", `다음 보상 · ${next}`));
  }
  box.append(root);

  const open = Object.keys(jobs).filter((j) => jobState(s, j) === "ok");
  if (!jobs[jsel] || jobs[jsel].kind === "none") jsel = !adv ? s.job : open[0] || singleOf(d.wkOrder.includes(s.wk) ? s.wk : "sword");

  const list = el("div", "jt-branches");
  const hand = s.eq.weapon ? s.wk : "";
  for (const k of d.wkOrder) {
    const [lv] = wmOf(s, k), ready = lv >= d.jobWm;
    const row = el("div", "jt-brow" + (k === hand ? " hand" : "") + (ready ? " ready" : ""));
    const wh = el("div", "jt-bw");
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    const bar = el("i", "bar"), f = el("i");
    f.style.width = `${Math.min(100, (lv / d.jobWm) * 100)}%`;
    bar.append(f);
    wh.append(ic, el("b", "", d.wkName[k]), el("small", "", `${lv}/${d.jobWm}`), bar);
    wh.title = `${d.wkName[k]} 숙련 ${lv}/${d.jobWm}`;
    row.append(wh);
    for (const j of jobsOf(k)) {
      const job = jobs[j], st = jobState(s, j), need = needOf(j);
      const b = el("button", `jt-bnode ${st}` + (jsel === j ? " sel" : "") + (k === hand ? " mine" : ""));
      b.type = "button";
      b.append(jobImg(j, st === "shut" ? { mono: "#6f6a60" } : undefined), el("b", "", job.name));
      b.append(el("small", "", st === "cur" ? "★" : st === "ok" ? "✓" : ""));
      b.title = `${job.name} — ${d.wkName[k]} 숙련 ${lv}/${need} · ${fmt(job.cost)}G`;
      b.addEventListener("click", () => { jsel = j; ask = ""; C.Sound.play("tab"); C.redraw(); });
      row.append(b);
    }
    list.append(row);
  }

  const slot = el("div", "jt-slot");
  slot.append(jobCard(s, jsel, atJob));
  box.append(slot, list);
}

// ── 전직관 아르센 ──
/** 아르센's window: the open jobs first with their [전직], then the rest with what they still need. */
export function renderJobNpc(box, s, { atJob }) {
  const d = D(), jobs = d.jobs;
  box.textContent = "";
  if (s.job !== "adventurer") {
    box.append(el("p", "say", `이미 [${jobs[s.job].name}]의 길을 걷고 있군. 전직 초기화 주문서가 있으면 모험가로 돌려 주지. 걸었던 직업의 레벨은 남아서, 다시 그 길에 서면 이어진다네.`));
  } else {
    box.append(el("p", "say", `무기 하나를 숙련 ${d.jobWm}까지 다루면 그 무기의 두 갈래 길 중 하나를 열어 주지. 전직 초기화 주문서가 있으면 다시 고를 수 있고, 걸었던 직업의 레벨은 남는다네.`));
    const ids = Object.keys(jobs).filter((j) => jobs[j].kind !== "none");
    const open = ids.filter((j) => jobState(s, j) === "ok");
    if (open.length) {
      box.append(C.section("열린 길", "crown"));
      for (const j of open) box.append(jobCard(s, j, atJob));
    } else box.append(el("p", "hint", "아직 열린 길이 없습니다. 무기를 들고 싸워 숙련을 쌓으세요."));
    // the rest, nearest first: the closest one big with a bar, the others folded away
    const rest = ids.filter((j) => !open.includes(j)).map((j) => [j, jobs[j].wk.reduce((n, k) => n + Math.min(needOf(j), wmOf(s, k)[0]) / needOf(j), 0) / jobs[j].wk.length]).sort((a, b) => b[1] - a[1]);
    if (rest.length) {
      box.append(C.section(open.length ? "가까운 길" : "가장 가까운 길", "up"));
      const [j, frac] = rest[0], first = el("div", "jt-top"), hd = el("div", "hd");
      const sm = el("small", "", ` ${d.wkName[jobs[j].wk[0]]} `);
      sm.append(Info.coin(jobs[j].cost));
      hd.append(Info.jobMark(j), el("b", "", jobs[j].name), sm);
      const bar = document.createElement("progress");
      bar.max = 100; bar.value = Math.round(frac * 100); bar.setAttribute("aria-label", "전직까지");
      const pr = el("div", "jt-progress"); pr.append(bar, el("span", "", `${Math.round(frac * 100)}%`));
      first.append(hd, pr, needLines(s, j, true));
      box.append(first);
      if (rest.length > 1) {
        const fold = el("details", "jt-fold");
        fold.open = foldOpen;
        fold.addEventListener("toggle", () => { foldOpen = fold.open; });
        fold.append(el("summary", "", `다른 길 ${rest.length - 1}개`));
        for (const [o, f] of rest.slice(1)) {
          const r = el("div", "it"), tx = el("div", "tx");
          tx.append(el("b", "", jobs[o].name), el("small", "", ` ${d.wkName[jobs[o].wk[0]]}`));
          r.append(Info.jobMark(o), tx, needLines(s, o, true));
          r.title = `${jobs[o].name} — ${Math.round(f * 100)}% · ${fmt(jobs[o].cost)}G`;
          fold.append(r);
        }
        box.append(fold);
      }
    }
  }
  resetSection(box, s, atJob);
  const b = el("button", "btn small", `전직의 길 보기 (${K("skill")})`);
  b.addEventListener("click", () => C.openTree());
  const f = el("div", "jt-more");
  f.append(b);
  box.append(f);
}
let foldOpen = false, rask = "";
const bagCount = (id) => countItem(id);

/** 전직 초기화 / 레벨 초기화 (docs/design/job-freedom.md): a button each, with a confirm that states cost and what stays. */
function resetSection(box, s, atJob) {
  const jf = D().jf; if (!jf) return;
  box.append(C.section("초기화", "up"));
  const kinds = [
    ["job", "전직 초기화", "job_reset", s.job !== "adventurer", "모험가로 돌아갑니다. 걸었던 직업의 레벨은 남고, 다시 그 길에 서면 이어집니다. 두 무기 직업이었다면 두 번째 무기는 가방으로 갑니다(빈 칸 필요)."],
    ["lvl", "레벨 초기화", "lv_reset", true, "능력치는 5로, 레벨은 1로 돌아갑니다. 쓴 경험치는 돌려받지 못합니다. 남는 것: 미사용 경험치 · 무기 숙련 · 장비 · 골드 · 퀘스트 · 전리품 · 외형 · 직업 레벨. 레벨 제한이 있는 착용 장비는 가방으로 갑니다."],
  ];
  for (const [k, label, t, can, keep] of kinds) {
    const [base, per] = jf.cost[k], gold = base + per * (s.lvl || 1), sid = jf.scroll[k];
    const name = D().items?.[sid]?.name || sid, have = bagCount(sid);
    const row = el("div", "jt-reset");
    if (rask === k) {
      const cf = el("div", "confirm");
      cf.append(el("p", "", `${label}: ${name} 1개 + ${fmt(gold)}G가 듭니다. ${keep} 계속할까요?`));
      const yes = el("button", "btn small gold", label), no = el("button", "btn small", "취소");
      yes.disabled = !atJob || s.gold < gold || have < 1;
      yes.addEventListener("click", () => { rask = ""; C.act({ t }); C.Sound.play("stat_respec"); C.redraw(); });
      no.addEventListener("click", () => { rask = ""; C.Sound.play("close"); C.redraw(); });
      cf.append(yes, no);
      if (have < 1) cf.append(el("small", "", `${name}가 없습니다.`));
      row.append(cf);
    } else {
      const b = el("button", "btn small", `${label} (${fmt(gold)}G + ${name})`);
      b.disabled = !can;
      b.addEventListener("click", () => { rask = k; C.Sound.play("tab"); C.redraw(); });
      row.append(b, el("small", "", can ? ` 보유 ${name} ${have}개` : " 이미 모험가입니다."));
    }
    box.append(row);
  }
}
/** Forget a half-asked question when the window closes. */
export function reset() { ask = ""; rask = ""; }

function jobProgress([level, xp, need]) {
  const row = el("div", "jt-progress"), bar = document.createElement("progress");
  bar.max = need || 1;
  bar.value = need ? xp : 1;
  bar.setAttribute("aria-label", "직업 경험치");
  row.append(el("b", "", `직업 Lv.${level}`), bar, el("span", "", need ? `${xp.toLocaleString()} / ${need.toLocaleString()}` : "최고 직업 레벨"));
  return row;
}
