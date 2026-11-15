// ───────────────────────────── 직업 자유: job reset, level reset, skill loadout ─────────────────────────────
// docs/design/job-freedom.md (owner decisions). Every job's progress stays on the sheet (ch.jobs; ch.jp is the
// current job's record, the same object), the 전직 교관 resets the job (back to 모험가) or the level (stats back
// to 1), each for a scroll and gold. The loadout (ch.lo[job] = { a, p, x }) holds the skills in use: at most
// LO_MAX.a actives and LO_MAX.p passives, changed in town or beside a campfire; a job without one set uses its
// first learned skills (the quick bar's first). The 전직 교관's Lv.150 quest opens one off-job passive slot (x).

const LO_MAX = { a: 5, p: 4 };
/** The side quest (data/quests.json) whose hand-in opens the off-job passive slot. */
const JF_QUEST = "sq_job_free";
const JF_SCROLL = { job: "scr_job", lvl: "scr_lvl" };
/** Gold for a reset: base + per character level. */
// economy review 2026-11-15: the level reset's slope 100 → 250 (it was under an hour of gold at every level)
const JF_COST = { job: [1000, 50], lvl: [5000, 250] };
const jfGold = (ch, k) => JF_COST[k][0] + JF_COST[k][1] * ch.lvl;
const loOpen = (ch) => !!ch.sq.done[JF_QUEST];
const jfSafe = (S, p) => !!(MAP_META[p.map] && MAP_META[p.map].safe) || fireNear(S.maps[p.map], p);

/** A job-progress record, clamped. */
function jpClean(r) {
  const lv = clamp(num(r.lv) ? Math.floor(r.lv) : 1, 1, JOB_PROGRESS.cap);
  return { lv, xp: lv === JOB_PROGRESS.cap ? 0 : clamp(num(r.xp) ? Math.floor(r.xp) : 0, 0, jobNeed(lv) - 1) };
}
/** Per-job progress and loadouts (v18), cleaned on every load. ch.jp must already be clean (cleanJobs). */
function jfClean(ch) {
  const jobs = isObj(ch.jobs) ? ch.jobs : {}, lo = isObj(ch.lo) ? ch.lo : {};
  ch.jobs = {}; ch.lo = {};
  for (const j of Object.keys(JOBS)) {
    if (j !== "adventurer" && isObj(jobs[j])) ch.jobs[j] = jpClean(jobs[j]);
    const r = lo[j];
    if (!isObj(r)) continue;
    const ids = (v, pas, n) => (Array.isArray(v) ? [...new Set(v.filter((id) => typeof id === "string" && Object.hasOwn(SKILL, id) && (SKILL[id].kind === "p") === pas))].slice(0, n) : []);
    const x = typeof r.x === "string" && Object.hasOwn(SKILL, r.x) && SKILL[r.x].kind === "p" ? r.x : "";
    ch.lo[j] = { a: ids(r.a, false, LO_MAX.a), p: ids(r.p, true, LO_MAX.p), x };
  }
  // the current job's record is ch.jp itself (a v17 sheet's jp moves in here)
  if (ch.jp) ch.jobs[ch.job] = ch.jp;
}

/**
 * The current job's loadout: the one set at a safe place, else the first learned, those the hand can use first
 * (one weapon, or a hybrid's pair, never has more than 5 actives, so nobody loses a skill they use).
 */
function loOf(ch) {
  if (ch.lo[ch.job]) return ch.lo[ch.job];
  const pair = JOBS[ch.job].kind === "hybrid" ? JOBS[ch.job].wk : [inHand(ch)];
  const now = (id) => skWks(SKILL[id]).some((k) => pair.includes(k));
  const learned = skillsFor(ch), order = [...learned.filter(now), ...learned.filter((id) => !now(id))];
  return { a: order.filter((id) => SKILL[id].kind !== "p").slice(0, LO_MAX.a), p: order.filter((id) => SKILL[id].kind === "p").slice(0, LO_MAX.p), x: "" };
}
/** May passive `id` sit in the off-job slot: learned, of a weapon of another job this hero has job levels in. */
function loOffOk(ch, id) {
  const sk = Object.hasOwn(SKILL, id) ? SKILL[id] : null;
  return !!sk && sk.kind === "p" && ch.wm[sk.wk].lv >= sk.need && Object.keys(ch.jobs).some((j) => j !== ch.job && JOBS[j].wk.includes(sk.wk));
}
/** Is passive `id` in the off-job slot (which works whatever weapon is in hand)? */
const loOff = (ch, id) => loOpen(ch) && loOf(ch).x === id && loOffOk(ch, id);
/** New skills learned after a loadout was set: into its free slots. */
function loAdd(ch, ids) {
  const lo = ch.lo[ch.job];
  if (!lo) return;
  for (const id of ids) {
    const k = SKILL[id].kind === "p" ? "p" : "a";
    if (lo[k].length < LO_MAX[k] && !lo[k].includes(id)) lo[k].push(id);
  }
}

function jfValidate(S, p, a) {
  const ch = p.ch;
  if (a.t === "lo") {
    if (!jfSafe(S, p)) return bad("스킬 칸은 마을이나 모닥불 곁에서만 바꿀 수 있습니다");
    if (!Array.isArray(a.a) || !Array.isArray(a.p) || a.a.length > LO_MAX.a || a.p.length > LO_MAX.p) return bad(`액티브 ${LO_MAX.a}개, 패시브 ${LO_MAX.p}개까지 넣을 수 있습니다`);
    const all = [...a.a, ...a.p];
    if (!all.every((id) => typeof id === "string" && Object.hasOwn(SKILL, id)) || new Set(all).size !== all.length) return bad("잘못된 스킬입니다");
    if (!a.a.every((id) => SKILL[id].kind !== "p") || !a.p.every((id) => SKILL[id].kind === "p")) return bad("액티브와 패시브 칸이 맞지 않습니다");
    if (!all.every((id) => skLearned(ch, SKILL[id]))) return bad("배우지 않은 스킬입니다");
    const x = a.x === undefined ? "" : a.x;
    if (x !== "") {
      if (!loOpen(ch)) return bad("다른 직업 패시브 칸이 아직 열리지 않았습니다");
      if (typeof x !== "string" || a.p.includes(x) || !loOffOk(ch, x)) return bad("다른 직업 칸에는 직업 Lv.1 이상인 다른 직업의 배운 패시브만 넣을 수 있습니다");
    }
    return OK;
  }
  if (p.dead) return bad("쓰러진 상태입니다");
  if (!npcNear(p, "job")) return bad("전직관이 너무 멉니다");
  const k = a.t === "job_reset" ? "job" : "lvl";
  if (k === "job" && ch.job === "adventurer") return bad("모험가는 초기화할 직업이 없습니다");
  if (k === "lvl" && ch.lvl <= 1) return bad("이미 레벨 1입니다");
  if (countItem(ch, JF_SCROLL[k]) < 1) return bad(`[${ITEMS[JF_SCROLL[k]].name}]${pp(ITEMS[JF_SCROLL[k]].name, "이가")} 필요합니다`);
  if (ch.gold < jfGold(ch, k)) return bad("골드가 부족합니다");
  // what comes off goes to the bag: gear above level 1 on a level reset (a job reset keeps both weapons, §9)
  const off = k === "job" ? 0 : SLOTS.filter((s) => ch.eq[s] && (ITEMS[ch.eq[s].id].req || 0) > 1).length;
  if (ch.inv.length + off > bagCap(ch)) return bad(`가방에 빈칸이 ${off}칸 필요합니다`);
  return OK;
}
function jfApply(S, p, a) {
  const ch = p.ch;
  p.dirty = true;
  if (a.t === "lo") {
    ch.lo[ch.job] = { a: a.a.slice(), p: a.p.slice(), x: a.x || "" };
    p.stc = null;
    toast(p, "스킬 칸을 바꿨습니다.");
    return;
  }
  const k = a.t === "job_reset" ? "job" : "lvl", gold = jfGold(ch, k);
  takeItem(ch, JF_SCROLL[k], 1);
  ch.gold -= gold;
  if (k === "job") {
    const was = JOBS[ch.job].name;
    if (ch.jp) ch.jobs[ch.job] = ch.jp;
    ch.job = "adventurer";
    ch.jp = null;
    toast(p, `전직 초기화 — [${was}]의 직업 레벨은 그대로 남습니다. 다시 전직하면 이어서 걷습니다. (${gold.toLocaleString()} G)`);
  } else {
    // stats back to 5 and the level to 1; the experience they cost is not given back (망각의 의식 does that)
    const hand = inHand(ch);
    ch.st = freshSt(); ch.lvl = 1; ch.xpt = 0;
    for (const s of SLOTS) if (ch.eq[s] && (ITEMS[ch.eq[s].id].req || 0) > 1) { ch.inv.push(ch.eq[s]); ch.eq[s] = null; }
    if (inHand(ch) !== hand) handChanged(p);
    if (mapLevelNeed(ch, p.map)) changeMap(S, p, START.map, START.x, START.y);
    toast(p, `레벨 초기화 — 레벨 1부터 다시 걷습니다. 레벨이 모자란 장비는 가방에 넣었습니다. (${gold.toLocaleString()} G)`);
  }
  afterGear(S, p);
  S.maps[p.map].ev.push(["u", p.eid, 2]);
}
/** A reset scroll as a reward (rift and boss chests, 64-dim.js). */
function jfScroll(p, k) {
  if (addItem(p.ch, JF_SCROLL[k], 1)) p.gain.push(["item", JF_SCROLL[k], 1, 0]);
}
