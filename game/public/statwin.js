/** The stat allocation tab, starter weapon and respec at 카이. The server supplies earned points and caps. */
import { iconImg } from "./uiicons.js";
import { kindIcon } from "./mastery.js";
import * as Info from "./infocard.js";

let C = null;
/** deps: { G, act, el, section, Sound, redraw, openStats } */
export function init(deps) { C = deps; }

const ST = ["str", "wil", "dex", "int", "wis", "luk"];
/** The glyph and ink of each stat (also the C window's 장비 tab). */
export const STAT_GLYPH = { str: ["fist", "#ff9a6a"], wil: ["heart", "#f07a8a"], dex: ["feather", "#9af0ae"], int: ["burst", "#8ab8ff"], wis: ["eye", "#c8a0ff"], luk: ["clover", "#ffe070"] };
const BATCH = 50;
/** The derived list: [key, name, value of self]. */
const DERIVED = [
  ["atk", "공격력", (s) => s.atk], ["mhp", "HP", (s) => s.mhp], ["mmp", "MP", (s) => s.mmp], ["def", "방어", (s) => s.def],
  ["crit", "치명타", (s) => `${s.crit}%`], ["critd", "치명 피해", (s) => `${s.critd}%`], ["aspd", "공격 속도", (s) => `+${s.dv[2]}%`],
  ["eva", "회피", (s) => `${s.dv[1]}%`], ["cdr", "재사용 감소", (s) => `${s.dv[3]}%`], ["res", "상태 저항", (s) => `${s.dv[4]}%`],
  ["poise", "강인도", (s) => `${s.dv[5]}%`], ["kbr", "밀림 저항", (s) => `${s.dv[6]}%`], ["burst", "원소 폭발", (s) => `+${s.dv[7]}%`],
  ["mf", "아이템 발견", (s) => `+${Math.round(s.mf)}%`],
];
/** Which derived rows each stat raises (display only; attack also follows the hand's scaling). */
const FEEDS = { str: ["kbr"], wil: ["mhp", "def", "poise", "res"], dex: ["aspd", "eva"], int: ["mmp", "burst"], wis: ["mmp", "cdr"], luk: ["crit", "critd", "mf"] };

const el = (...a) => C.el(...a);
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : "—");
const jobName = (s) => (C.G.defs.jobs[s.job] || { name: "모험가" }).name;

// ── the weapon in hand: how it scales (job adjusted), as grade letters ──
/** A coefficient as a grade: the highest grade at or under it, "+" when a job lifted it past. */
export function gradeOf(c) {
  const G = Object.entries(C.G.defs.grade).sort((a, b) => b[1] - a[1]);
  for (const [g, v] of G) if (c >= v - 1e-9) return g + (c - v > 0.04 ? "+" : "");
  return "E";
}
/** { stat: coefficient } for weapon kind `k` as this character fights with it (single job +0.1, hybrid table). */
export function scaleFor(s, k) {
  const D = C.G.defs, job = D.jobs[s.job];
  if (job && job.kind !== "none" && job.wk.includes(k)) return { ...job.scale };
  const out = {}, g = D.scale[k] || {};
  for (const st of Object.keys(g)) out[st] = D.grade[g[st]];
  return out;
}
/** "힘 A · 의지 C" for weapon kind `k`, strongest first. */
export function scaleText(s, k) {
  const sc = scaleFor(s, k), names = Object.fromEntries(C.G.defs.stats.map(([key, name]) => [key, name]));
  return Object.entries(sc).sort((a, b) => b[1] - a[1]).map(([st, c]) => `${names[st]} ${gradeOf(c)}`).join(" · ");
}

// ── the stat tab ──
const pend = [0, 0, 0, 0, 0, 0];
let lastStats = "", lit = -1;
const sum = (a) => a.reduce((n, v) => n + v, 0);
/** Whatever the panel shows besides `self` (for the window's redraw key). */
export const key = () => pend.join();

export function render(box, s) {
  const D = C.G.defs;
  const { cap, soft, perLevel } = D.statGrowth;
  const statKey = ST.map((k) => s.st[k]).join();
  if (statKey !== lastStats || sum(pend) > s.ap) { pend.fill(0); lastStats = statKey; }
  box.textContent = "";
  const hd = el("div", "sw-head");
  const xpn = el("span", "xpn");
  xpn.append(iconImg("up", "#9af0ae"), el("b", "xp", `남은 포인트 ${fmt(s.ap)}`));
  hd.append(Info.jobMark(s.job), el("b", "", `Lv.${s.lvl} ${jobName(s)}`), xpn);
  box.append(hd);
  // what the hand wants: its scaling stats get a grade badge in their rows
  const hand = D.wkOrder.includes(s.wk) && s.eq.weapon ? s.wk : "";
  const sc = hand ? scaleFor(s, hand) : {};
  const hb = el("div", "sw-hand");
  if (hand) {
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(hand);
    hb.append(ic, el("b", "", D.wkName[hand]), el("span", "", ` — ${scaleText(s, hand)}`), el("small", "", "등급이 높은 능력치가 공격력을 크게 올립니다"));
  } else hb.append(el("small", "", "무기를 들면 그 무기가 쓰는 능력치에 등급이 표시됩니다."));
  box.append(hb);
  const n = sum(pend);
  const rows = el("div", "sw-rows");
  D.stats.forEach(([k, name, desc], i) => {
    const v = s.st[k], p = pend[i], [glyph, ink] = STAT_GLYPH[k] || ["star"];
    const row = el("div", "sw-row" + (sc[k] ? " hand" : "") + (lit === i ? " lit" : ""));
    const nm = el("div", "nm");
    nm.append(iconImg(glyph, ink), el("b", "", name));
    // what the stat does is one click away (its card), not a sentence in every row
    Info.bind(nm, `${name} — ${desc}`, () => Info.statCard(k));
    if (sc[k]) { const g = el("span", "gr", gradeOf(sc[k])); g.title = `${D.wkName[hand]}의 공격력이 ${name}에 따라 오릅니다 (등급 ${gradeOf(sc[k])})`; nm.append(g); }
    const val = el("div", "val");
    const vb = el("b", v + p >= soft[1] ? "cap2" : v + p >= soft[0] ? "cap1" : "", String(v + p));
    vb.title = v + p >= soft[1] ? "추가 투자 효율 25%" : v + p >= soft[0] ? "추가 투자 효율 50%" : "기본 투자 효율 100%";
    val.append(vb);
    if (p) val.append(el("em", "pn", `+${p}`));
    const minus = el("button", "btn small pm", "−");
    minus.disabled = !p;
    minus.title = "한 칸 빼기 (Shift: 모두)";
    minus.addEventListener("click", (e) => { pend[i] = e.shiftKey ? 0 : Math.max(0, p - 1); C.Sound.play("tick"); C.redraw(); });
    const plus = el("button", "btn small pm", "+");
    const can = !s.dead && v + p < cap && n < Math.min(BATCH, s.ap);
    plus.disabled = !can;
    plus.title = v + p >= cap ? `능력치는 ${cap}까지` : "+1 포인트 (Shift: +5)";
    plus.addEventListener("click", (e) => {
      pend[i] += Math.max(0, Math.min(e.shiftKey ? 5 : 1, s.ap - n, BATCH - n, cap - v - p));
      C.Sound.play("tick");
      C.redraw();
    });
    const btns = el("div", "pmb");
    btns.append(minus, plus);
    row.append(nm, val, btns, el("small", "nx", v + p >= cap ? "최대" : ""));
    // hovering a stat lights what it raises below
    row.addEventListener("mouseenter", () => { if (lit !== i) { lit = i; light(box, k, sc); } });
    row.addEventListener("mouseleave", () => { if (lit === i) { lit = -1; light(box, "", sc); } });
    rows.append(row);
  });
  box.append(rows);

  // the footer: the next point, the batch, confirm or clear
  const ft = el("div", "sw-foot");
  const info = el("div", "sum");
  info.append(el("span", "", `${n}포인트 투자 · 확정 후 ${fmt(s.ap - n)} 남음`));
  const clear = el("button", "btn small", "되돌리기");
  clear.disabled = !n;
  clear.title = "고른 포인트를 모두 비웁니다";
  clear.addEventListener("click", () => { pend.fill(0); C.Sound.play("close"); C.redraw(); });
  const ok = el("button", "btn small gold", "확정");
  ok.disabled = !n || s.dead || n > s.ap;
  ok.addEventListener("click", () => { C.act({ t: "train", a: pend.slice() }); pend.fill(0); C.Sound.play("ok"); C.redraw(); });
  ft.append(info, clear, ok);
  box.append(ft);

  // derived stats, each lit while a stat that raises it is hovered
  const dv = el("div", "sw-dv");
  for (const [k, label, val] of DERIVED) {
    const name = k === "atk" && s.dv[0] ? "공격력(마법)" : label;
    const r = Info.statChip(k, String(val(s)), name);
    r.dataset.k = k;
    dv.append(r);
  }
  box.append(dv);
  if (lit >= 0) light(box, ST[lit], sc);
  box.append(el("p", "hint", `레벨업당 ${perLevel}포인트. 한 능력치는 ${soft[0]}부터 추가 투자 효율이 50%, ${soft[1]}부터 25%가 됩니다. 수련관 카이에게서 투자한 포인트를 되돌릴 수 있습니다.`));
}
/** Light the derived rows stat `k` raises (attack too when the hand scales with it). */
function light(box, k, sc) {
  const on = new Set(k ? [...(FEEDS[k] || []), ...(sc[k] ? ["atk"] : [])] : []);
  for (const r of box.querySelectorAll(".sw-dv span")) r.classList.toggle("lit", on.has(r.dataset.k));
  box.querySelectorAll(".sw-row").forEach((r, i) => r.classList.toggle("lit", ST[i] === k));
}

// ── 수련관 카이 ──
/** Each weapon's feel, one line (the scaling stats come from defs). */
const FEEL = {
  sword: "넓게 베어 내는 묵직한 한 방",
  dagger: "빠른 찌르기, 급소를 노리는 기습",
  spear: "긴 사거리로 줄지어 꿰뚫기",
  staff: "불과 얼음, 원소를 엮는 마법",
  book: "낙인을 새기고 터뜨리는 저주",
  bow: "멀리서 날리는 화살",
};
let pick = "", sure = false;
export const trainerKey = () => [pick, sure];
/** The tier-1 weapon of kind `k` (what the starter pick gives). */
const starterOf = (k) => Object.keys(C.G.defs.items).find((id) => { const d = C.G.defs.items[id]; return d.type === "weapon" && d.wk === k && d.tier === 1; });
/** Two scaling stats of a kind, "힘·의지". */
const feelStats = (k) => { const g = C.G.defs.scale[k] || {}, names = Object.fromEntries(C.G.defs.stats.map(([a, b]) => [a, b])); return Object.keys(g).sort((a, b) => C.G.defs.grade[g[b]] - C.G.defs.grade[g[a]]).map((st) => names[st]).join("·"); };

/** 수련관 카이's window: the starter pick (once), the way to the stat tab, and 망각의 의식. `atTrainer`: standing at 카이. */
export function renderTrainer(box, s, { atTrainer }) {
  const D = C.G.defs;
  box.textContent = "";
  if (!s.sw) {
    box.append(el("p", "say", atTrainer ? "어떤 무기로 시작하겠나? 하나를 골라 가게." : "무기 하나를 골라 줄 테니 내 앞으로 오게."));
    const grid = el("div", "tw-pick");
    for (const k of D.wkOrder) {
      const b = el("button", "tw-card" + (pick === k ? " on" : ""));
      b.type = "button";
      const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
      b.append(ic, el("b", "", D.wkName[k]), el("small", "st", feelStats(k)), el("small", "fl", FEEL[k] || ""));
      b.addEventListener("click", () => { pick = k; C.Sound.play("ui"); C.redraw(); });
      grid.append(b);
    }
    box.append(grid);
    const go = el("div", "tw-go");
    const id = pick && starterOf(pick);
    go.append(el("span", "", id ? `[${D.items[id].name}] — 숙련과 직업은 나중에 얼마든지 다른 무기로 쌓을 수 있습니다.` : "하나를 고르면 그 무기를 줍니다. 다른 무기도 나중에 얼마든지 쓸 수 있습니다."));
    const b = el("button", "btn gold", "이 무기로 시작");
    b.disabled = !id || !atTrainer;
    b.addEventListener("click", () => { C.act({ t: "starter", wk: pick }); C.Sound.play("ok"); });
    go.append(b);
    box.append(go);
  } else box.append(el("p", "say", "성장하며 얻은 능력치 포인트를 원하는 능력에 투자해 보게."));

  // levels: the stat tab does it
  const lv = el("div", "tw-sec");
  lv.append(C.section("능력치 투자", "up"));
  const ready = s.ap > 0;
  const line = el("div", "tw-line");
  line.append(el("span", "", `Lv.${s.lvl} · 남은 포인트 ${fmt(s.ap)}`));
  const open = el("button", "btn small" + (ready ? " gold" : ""), ready ? "능력치 올리기 ★" : "능력치 보기");
  open.addEventListener("click", () => C.openStats());
  line.append(open);
  lv.append(line);
  box.append(lv);

  // The server quotes the ritual's gold cost at the character's current level.
  const rs = el("div", "tw-sec");
  rs.append(C.section("망각의 의식", "clock"));
  const fee = s.respecCost || 0, seal = C.G.defs.jf.respecItem;
  const hasSeal = s.inv.some((st) => st.id === seal);
  const why = !s.spentAp ? "되돌릴 능력치가 없습니다" : !atTrainer ? "수련관 카이 앞에서 할 수 있습니다"
    : fee && !hasSeal ? "연금 숙련 Lv.10의 되새김 인장이 필요합니다" : s.gold < fee ? "골드가 부족합니다" : "";
  rs.append(el("p", "tw-txt", "투자한 능력치 포인트를 돌려받아 다시 배분할 수 있습니다."));
  const row = el("div", "tw-line");
  row.append(el("span", fee ? "fee" : "free", fee ? `${fmt(fee)}G · 되새김 인장 1개` : `무료 (${s.rs}회 남음)`));
  if (fee && !hasSeal) rs.append(el("p", "tw-txt", "되새김 인장은 보글연금공방에서 연금 숙련 Lv.10에 제작할 수 있습니다."));
  if (!sure) {
    const b = el("button", "btn small", "되돌리기");
    b.disabled = !!why;
    b.title = why;
    b.addEventListener("click", () => { sure = true; C.Sound.play("ui"); C.redraw(); });
    row.append(b);
    rs.append(row);
  } else {
    rs.append(row);
    const cf = el("div", "confirm");
    cf.append(el("p", "", `능력치 포인트 ${fmt(s.spentAp)}개를 돌려받습니다.${fee ? ` 되새김 인장 1개와 ${fmt(fee)}G를 사용합니다.` : ""}`));
    const yes = el("button", "btn small gold", "되돌리기"), no = el("button", "btn small", "취소");
    yes.disabled = !!why;
    yes.title = why;
    yes.addEventListener("click", () => { sure = false; C.act({ t: "respec" }); C.Sound.play("ok"); C.redraw(); });
    no.addEventListener("click", () => { sure = false; C.Sound.play("close"); C.redraw(); });
    cf.append(yes, no);
    rs.append(cf);
  }
  box.append(rs);
}
/** Forget a half-made choice when the window closes. */
export function reset() { pick = ""; sure = false; }
