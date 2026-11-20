// ───────────────────────────── 직업 자유: job reset, level reset, skill loadout ─────────────────────────────
// docs/design/job-freedom.md (owner decisions). Every job's progress stays on the sheet (ch.jobs; ch.jp is the
// current job's record, the same object), the 전직 교관 resets the job (back to 모험가) or the level (stats back
// to 1), each for a scroll and gold. The loadout (ch.lo[job] = { a }) holds the actives in use: at most LO_MAX.a
// skills of the weapon in hand, changed in town or beside a campfire; without one set (or when none of it fits the
// hand) the hand's first learned actives are used. Every learned passive is always on while its weapon is in hand
// (owner 2026-11-21: the passive slots and the cross-weapon "borrowed" passive slots are gone; sheet v33).

const LO_MAX = { a: 5 };
const JF_SCROLL = { job: "scr_job", lvl: "scr_lvl" };
/** Gold for a reset: base + per character level. */
// economy review 2026-11-15: the level reset's slope 100 → 250 (it was under an hour of gold at every level)
const JF_COST = { job: [1000, 50], lvl: [5000, 250] };
const jfGold = (ch, k) => JF_COST[k][0] + JF_COST[k][1] * ch.lvl;
const jfSafe = (S, p) => !!(MAP_META[p.map] && MAP_META[p.map].safe) || fireNear(S.maps[p.map], p);
/** The stat passives (perk = [stat, percentage points]), checked against the hand in loPerks. */
const PAS_PERK = SKILL_ORDER.filter((id) => SKILL[id].kind === "p" && SKILL[id].perk);

/** A job-progress record, clamped. */
function jpClean(r) {
  const lv = clamp(num(r.lv) ? Math.floor(r.lv) : 1, 1, JOB_PROGRESS.cap);
  return { lv, xp: lv === JOB_PROGRESS.cap ? 0 : clamp(num(r.xp) ? Math.floor(r.xp) : 0, 0, jobNeed(lv) - 1) };
}
/** Per-job progress and loadouts (v18; v33 keeps only the actives), cleaned on every load. ch.jp must already be clean (cleanJobs). */
function jfClean(ch) {
  const jobs = isObj(ch.jobs) ? ch.jobs : {}, lo = isObj(ch.lo) ? ch.lo : {};
  ch.jobs = {}; ch.lo = {};
  for (const j of Object.keys(JOBS)) {
    if (j !== "adventurer" && isObj(jobs[j])) ch.jobs[j] = jpClean(jobs[j]);
    const r = lo[j];
    if (!isObj(r)) continue;
    // an old sheet's passive slots (p) and cross slots (x, y) are dropped: passives need no slot now
    const a = Array.isArray(r.a) ? [...new Set(r.a.filter((id) => typeof id === "string" && Object.hasOwn(SKILL, id) && SKILL[id].kind !== "p"))].slice(0, LO_MAX.a) : [];
    ch.lo[j] = { a };
  }
  // the current job's record is ch.jp itself (a v17 sheet's jp moves in here)
  if (ch.jp) ch.jobs[ch.job] = ch.jp;
}

/** Can active `id` go in the loadout now: a skill of the weapon in hand (or of a hybrid job's two weapons)? */
function loUsable(ch, id) {
  const hand = inHand(ch), pair = JOBS[ch.job].kind === "hybrid" ? JOBS[ch.job].wk : [hand];
  return !!hand && skWks(SKILL[id]).some((k) => pair.includes(k));
}
/**
 * The actives in use now: the set loadout's skills that fit the hand, else the hand's learned actives
 * (offensive first, a support skill after them).
 */
function loOf(ch) {
  const set = ch.lo[ch.job], fits = set ? set.a.filter((id) => loUsable(ch, id)) : [];
  if (fits.length) return { a: fits };
  const actives = skillsFor(ch).filter((id) => SKILL[id].kind !== "p" && loUsable(ch, id));
  return { a: [...actives.filter((id) => !SKILL[id].support), ...actives.filter((id) => SKILL[id].support)].slice(0, LO_MAX.a) };
}
/** Sheet bonuses from the stat passives working now (every learned one of the weapon in hand). */
function loPerks(ch) {
  const b = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, critd: 0, spd: 0, ls: 0, aspd: 0, cdr: 0, poise: 0 };
  const hand = inHand(ch);
  if (!hand) return b;
  for (const id of PAS_PERK) if (pasNative(ch, id, hand)) b[SKILL[id].perk[0]] += SKILL[id].perk[1];
  return b;
}
/** New skills learned after a loadout was set: into its free slots. */
function loAdd(ch, ids) {
  const lo = ch.lo[ch.job];
  if (!lo) return;
  for (const id of ids) {
    if (SKILL[id].kind !== "p" && lo.a.length < LO_MAX.a && !lo.a.includes(id)) lo.a.push(id);
  }
}

function jfValidate(S, p, a) {
  const ch = p.ch;
  if (a.t === "lo") {
    if (!jfSafe(S, p)) return bad("스킬 칸은 마을이나 모닥불 곁에서만 바꿀 수 있습니다");
    if (!Array.isArray(a.a) || a.a.length > LO_MAX.a) return bad(`액티브 스킬은 ${LO_MAX.a}개까지 넣을 수 있습니다`);
    if (!a.a.every((id) => typeof id === "string" && Object.hasOwn(SKILL, id)) || new Set(a.a).size !== a.a.length) return bad("잘못된 스킬입니다");
    if (!a.a.every((id) => SKILL[id].kind !== "p")) return bad("패시브는 칸에 넣지 않아도 늘 켜져 있습니다");
    if (!a.a.every((id) => skLearned(ch, SKILL[id]))) return bad("배우지 않은 스킬입니다");
    if (!a.a.every((id) => loUsable(ch, id))) return bad("지금 든 무기로 쓸 수 없는 스킬입니다");
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
  const off = k === "job" ? 0 : SLOTS.filter((s) => ch.eq[s] && gearReq(ch.eq[s]) > 1).length;
  if (ch.inv.length + off > bagCap(ch)) return bad(`가방에 빈칸이 ${off}칸 필요합니다`);
  return OK;
}
function jfApply(S, p, a) {
  const ch = p.ch;
  p.dirty = true;
  if (a.t === "lo") {
    ch.lo[ch.job] = { a: a.a.slice() };
    afterGear(S, p);
    saveSoon(p);
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
    const hand = inHand(ch);
    ch.st = freshSt(); ch.lvl = 1; ch.xpt = 0; ch.xp = 0;
    for (const s of SLOTS) if (ch.eq[s] && gearReq(ch.eq[s]) > 1) { ch.inv.push(ch.eq[s]); ch.eq[s] = null; }
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
