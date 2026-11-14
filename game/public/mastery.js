/**
 * Weapon mastery at a glance (docs/design/jobs-and-stats.md B.10, F.2): the strip beside the
 * HP/MP bars in the dock — the weapon in hand, "숙련 Lv.N" and a thin bar to the next level
 * (a hybrid job shows both of its weapons) — and the hover card listing all six weapons, the
 * job and what the next mastery level unlocks.
 *
 * Reads only the wire: `self.wm` = [[lv, xp, need] × 6 in WK_ORDER], `self.wk` (in hand),
 * `self.wk2` (a hybrid's other weapon), `self.job` + `defs.jobs`. Before the server sends `wm`
 * every weapon reads as Lv.1 with an empty bar, so the strip never breaks.
 */
import { weaponIcon } from "./weapons.js";

export const WK_ORDER = ["sword", "dagger", "spear", "staff", "book", "bow"];
const WK_NAME = { sword: "대검", dagger: "단검", spear: "창", staff: "스태프", book: "마도서", bow: "활" };
/** The mastery-10 active of each weapon (C.2), until `defs.skills` carries them. */
const L10 = { sword: "대지 가르기", dagger: "그림자 칼날", spear: "유성창", staff: "서리 고리", book: "중력 왜곡진", bow: "도약 사격" };
const JOB_WM = 20, WM_MAX = 50;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** The short weapon names of the mastery/job design (대검 단검 창 스태프 마도서 활), not the item-kind names. */
export const kindName = (defs, k) => WK_NAME[k] || (defs && defs.wkinds && defs.wkinds[k] && defs.wkinds[k].name) || k;

/** Every weapon's mastery as { lv, xp, need }, from the wire or the Lv.1 default. */
export function masteryOf(s) {
  const out = {};
  WK_ORDER.forEach((k, i) => {
    const r = Array.isArray(s.wm) ? s.wm[i] : null;
    const lv = r ? Math.max(1, r[0] | 0) : 1;
    out[k] = { lv, xp: r ? Math.max(0, r[1] | 0) : 0, need: r && r[2] > 0 ? r[2] : 22 * lv * lv };
  });
  return out;
}
const pct = (m) => (m.lv >= WM_MAX ? 100 : Math.max(0, Math.min(100, (m.xp / m.need) * 100)));

/** The job: { id, name, kind: "none" | "single" | "hybrid" | "class", wk: [...] }. */
export function jobOf(s, defs) {
  const j = s.job && defs.jobs && defs.jobs[s.job];
  if (j) return { id: s.job, name: j.name, kind: j.kind || "none", wk: j.wk || [] };
  // before jobs reach the wire: the old class
  const c = s.cls && defs.classes && defs.classes[s.cls];
  return { id: s.cls || "", name: c ? c.name : "모험가", kind: c ? "class" : "none", wk: [] };
}

/** The weapons the strip shows: the hand, and a hybrid's other weapon. */
function shownKinds(s, job) {
  const hand = WK_ORDER.includes(s.wk) ? s.wk : null;
  if (job.kind === "hybrid" && job.wk.length === 2) return hand && job.wk.includes(hand) ? [hand, job.wk.find((k) => k !== hand)] : job.wk.slice();
  if (hand && WK_ORDER.includes(s.wk2) && s.wk2 !== hand) return [hand, s.wk2];
  return hand ? [hand] : [];
}

/** What the next mastery level of `k` brings, as one line. */
export function nextUnlock(k, lv, job, defs) {
  if (lv >= WM_MAX) return "최고 숙련 달성";
  if (lv < 10) {
    const sk = defs.skills && Object.values(defs.skills.SKILL || defs.skills).find((x) => x && x.wk === k && x.need === 10 && x.kind === "a");
    return `Lv.10: ${sk ? sk.name : L10[k]} 해금`;
  }
  const adventurer = job.kind === "none";
  if (lv < JOB_WM) return adventurer ? `Lv.${JOB_WM}: 전직 가능` : `Lv.${lv + 1}: 무기 공격력 +1%`;
  if (adventurer) return "전직 가능 · 전직관 아르센";
  return `Lv.${lv + 1}: 무기 공격력 +1%`;
}

const kindUrls = new Map();
/** A data URL of a kind's plain icon (tier 1 unless told). */
export function kindIcon(k, tier = 1) {
  const key = `${k}:${tier}`;
  if (!kindUrls.has(key)) { try { kindUrls.set(key, weaponIcon(k, tier).toDataURL()); } catch { kindUrls.set(key, ""); } }
  return kindUrls.get(key);
}

/**
 * Fill the strip `box` (only when what it shows changed). `handUrl` is the bag icon of the weapon in
 * hand. Returns the kinds whose level went up since the last call (the caller flashes and plays a sound).
 */
let prevLv = {}, prevName = "";
export function renderStrip(box, s, defs, handUrl) {
  const wm = masteryOf(s), job = jobOf(s, defs), kinds = shownKinds(s, job);
  const ups = [];
  if (s.name !== prevName) { prevName = s.name; prevLv = {}; }
  for (const k of WK_ORDER) {
    if (prevLv[k] !== undefined && wm[k].lv > prevLv[k] && Array.isArray(s.wm)) ups.push(k);
    prevLv[k] = wm[k].lv;
  }
  const key = JSON.stringify([kinds, kinds.map((k) => [wm[k].lv, Math.floor(pct(wm[k]))]), handUrl, job.id]);
  if (box.dataset.k !== key) {
    box.dataset.k = key;
    box.textContent = "";
    box.classList.toggle("dual", kinds.length > 1);
    if (!kinds.length) box.append(el("span", "wm-none", "무기 없음"));
    kinds.forEach((k) => {
      const m = wm[k], c = el("div", "wm-c" + (k === s.wk ? " on" : ""));
      const ic = el("img", "wi"); ic.alt = ""; ic.src = (k === s.wk && handUrl) || kindIcon(k);
      const t = el("b", "wt");
      if (kinds.length === 1) t.append(el("span", "wl", `${kindName(defs, k)} 숙련 `));
      t.append(`Lv.${m.lv}`);
      const bar = el("i", "wb"), f = el("i"); f.style.width = `${pct(m)}%`; bar.append(f);
      c.append(ic, t, bar);
      c.dataset.k = k;
      box.append(c);
    });
  }
  if (ups.length) {
    box.classList.remove("up"); void box.offsetWidth; box.classList.add("up");
    const pop = el("em", "wm-pop", `${kindName(defs, ups[0])} 숙련 Lv.${wm[ups[0]].lv}!`);
    box.append(pop);
    setTimeout(() => pop.remove(), 1700);
  }
  return ups;
}

/** The hover card: the job, all six weapons with mini bars (the hand marked), and what comes next. */
export function fillTip(node, s, defs) {
  const wm = masteryOf(s), job = jobOf(s, defs), kinds = shownKinds(s, job);
  node.classList.add("wm-tip");
  const hd = el("div", "nm", "무기 숙련");
  node.append(hd);
  const jl = el("div", "wm-job");
  jl.append("직업 ", el("b", "", job.name));
  if (job.kind === "hybrid") jl.append(el("small", "", ` · 하이브리드 (${job.wk.map((k) => kindName(defs, k)).join(" + ")})`));
  else if (job.kind === "single") jl.append(el("small", "", ` · ${kindName(defs, job.wk[0])} 전문`));
  node.append(jl);
  const list = el("div", "wm-list");
  for (const k of WK_ORDER) {
    const m = wm[k], row = el("div", "wm-r" + (kinds.includes(k) ? " on" : "") + (k === s.wk ? " hand" : ""));
    const ic = el("img", "wi"); ic.alt = ""; ic.src = kindIcon(k);
    const bar = el("i", "wb"), f = el("i"); f.style.width = `${pct(m)}%`; bar.append(f);
    row.append(ic, el("span", "wn", kindName(defs, k)), el("b", "wv", `Lv.${m.lv}`), bar);
    list.append(row);
  }
  node.append(list);
  for (const k of kinds) {
    const m = wm[k];
    const nx = el("div", "wm-next");
    nx.append(el("small", "", kinds.length > 1 ? `${kindName(defs, k)} 다음` : "다음"), ` ${nextUnlock(k, m.lv, job, defs)}`);
    if (m.lv < WM_MAX) nx.append(el("small", "wm-xp", ` (${m.xp.toLocaleString()} / ${m.need.toLocaleString()})`));
    node.append(nx);
  }
  if (!Array.isArray(s.wm)) node.append(el("div", "hint", "숙련은 들고 있는 무기로 몬스터를 때리고 쓰러뜨리면 오릅니다."));
  else node.append(el("div", "hint", "숙련 1마다 그 무기의 공격력 +1% · 숙련 10에 새 스킬, 20에 전직"));
}
