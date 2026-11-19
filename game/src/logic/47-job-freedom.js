// ───────────────────────────── 직업 자유: job reset, level reset, skill loadout ─────────────────────────────
// docs/design/job-freedom.md (owner decisions). Every job's progress stays on the sheet (ch.jobs; ch.jp is the
// current job's record, the same object), the 전직 교관 resets the job (back to 모험가) or the level (stats back
// to 1), each for a scroll and gold. The loadout (ch.lo[job] = { a, p, x, y }) holds the skills in use: at most
// LO_MAX.a actives and LO_MAX.p passives, changed in town or beside a campfire; a job without one set uses its
// first learned skills (the quick bar's first). A job opens two off-weapon passives; the Lv.150 quest improves them.

const LO_MAX = { a: 5, p: 4 };
/** The side quest (data/quests.json) that improves borrowed effects. */
const JF_QUEST = "sq_job_free";
const LO_BORROW = [50, 60];
const JF_SCROLL = { job: "scr_job", lvl: "scr_lvl" };
/** Gold for a reset: base + per character level. */
// economy review 2026-11-15: the level reset's slope 100 → 250 (it was under an hour of gold at every level)
const JF_COST = { job: [1000, 50], lvl: [5000, 250] };
const jfGold = (ch, k) => JF_COST[k][0] + JF_COST[k][1] * ch.lvl;
const loOpen = (ch) => ch.job !== "adventurer";
const loPower = (ch) => LO_BORROW[ch.sq.done[JF_QUEST] ? 1 : 0];
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
    const p = ids(r.p, true, LO_MAX.p);
    const valid = (id) => ids([id], true, 1).length && !p.includes(id)
      && !JOBS[j].wk.includes(SKILL[id].wk) && skLearned(ch, SKILL[id]);
    const x = valid(r.x) ? r.x : "";
    const y = valid(r.y) && r.y !== x ? r.y : "";
    ch.lo[j] = { a: ids(r.a, false, LO_MAX.a), p, x, y };
  }
  // the current job's record is ch.jp itself (a v17 sheet's jp moves in here)
  if (ch.jp) ch.jobs[ch.job] = ch.jp;
}

/**
 * The current job's loadout: an explicit loadout, else the hand's or hybrid pair's learned skills first.
 * Default to the offensive kit. A support skill uses a free spot or can be set as part of an explicit loadout.
 */
function loOf(ch) {
  if (ch.lo[ch.job]) return ch.lo[ch.job];
  const pair = JOBS[ch.job].kind === "hybrid" ? JOBS[ch.job].wk : [inHand(ch)];
  const now = (id) => skWks(SKILL[id]).some((k) => pair.includes(k));
  const learned = skillsFor(ch), order = [...learned.filter(now), ...learned.filter((id) => !now(id))];
  const actives = order.filter((id) => SKILL[id].kind !== "p"), home = actives.filter(now);
  const a = [...home.filter((id) => !SKILL[id].support), ...home.filter((id) => SKILL[id].support), ...actives.filter((id) => !now(id))];
  return { a: a.slice(0, LO_MAX.a), p: order.filter((id) => SKILL[id].kind === "p").slice(0, LO_MAX.p), x: "", y: "" };
}
/** A passive in the cross-weapon slots must come from mastery outside the current job's weapon pair. */
function loOffOk(ch, id) {
  const sk = typeof id === "string" && Object.hasOwn(SKILL, id) ? SKILL[id] : null;
  return loOpen(ch) && !!sk && sk.kind === "p" && !JOBS[ch.job].wk.includes(sk.wk) && skLearned(ch, sk);
}
const loOff = (ch, id, lo = loOf(ch)) => !!inHand(ch) && (lo.x === id || lo.y === id) && !lo.p.includes(id) && loOffOk(ch, id);

/** Sheet bonuses from the active native perks plus the transferable portion of the borrowed perks. */
function loPerks(ch) {
  const b = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, critd: 0, spd: 0, ls: 0, aspd: 0, cdr: 0, poise: 0 };
  const hand = inHand(ch);
  if (!hand) return b;
  const load = loOf(ch);
  for (const id of load.p) {
    const perk = SKILL[id].perk;
    if (perk && pasNative(ch, id, load, hand)) b[perk[0]] += perk[1];
  }
  for (const id of [load.x, load.y]) {
    if (!id || !loOff(ch, id, load)) continue;
    const perk = SKILL[id].borrow || SKILL[id].perk;
    if (perk) b[perk[0]] += perk[1] * loPower(ch) / 100;
  }
  return b;
}
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
    const borrowed = [a.x ?? "", a.y === undefined ? loOf(ch).y : a.y].filter((id) => id !== "");
    if (borrowed.length) {
      if (!loOpen(ch)) return bad("전직하면 교차 패시브 칸이 열립니다");
      if (new Set([...a.p, ...borrowed]).size !== a.p.length + borrowed.length) return bad("같은 패시브를 두 번 넣을 수 없습니다");
      if (!borrowed.every((id) => loOffOk(ch, id))) return bad("교차 칸에는 현재 직업의 무기군 외에서 배운 패시브만 넣을 수 있습니다");
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
  const off = k === "job" ? 0 : SLOTS.filter((s) => ch.eq[s] && gearReq(ch.eq[s]) > 1).length;
  if (ch.inv.length + off > bagCap(ch)) return bad(`가방에 빈칸이 ${off}칸 필요합니다`);
  return OK;
}
function jfApply(S, p, a) {
  const ch = p.ch;
  p.dirty = true;
  if (a.t === "lo") {
    ch.lo[ch.job] = { a: a.a.slice(), p: a.p.slice(), x: a.x ?? "", y: a.y === undefined ? loOf(ch).y : a.y };
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
