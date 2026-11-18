// ───────────────────────────── side quests (world map editor) ─────────────────────────────
// data/quests.json "side": errands NPCs hand out beside the main chain. A goal is to kill
// (kills of the kind count, like the main quest's), to collect (items in the bag, taken on
// hand-in), to talk to an NPC, to visit a map, to fell elites ("elite": anywhere, on one map,
// of one kind) or field bosses ("fb"), to make things with the life recipes ("make": only the
// player's own cooking/crafting/brewing counts), to carry a quest item to someone ("deliver":
// the item is given on take and handed over to goal.npc, who completes it; goal.time = seconds),
// or only to answer ("choice": ready on take). Any quest may end on a choice (q.choice, 2–3
// options): the pick is remembered in ch.sq.flags[id], may carry its own reward, and a later
// quest can wait for it (req.flag = [questId, pick]). Rewards may give a keepsake (기념품, ITEMS
// type "keep", kept forever in ch.keep) and a title (an achievement made here, category 이야기).
// Steps of a story are quests chained by req.quest. Progress lives on the sheet as
// ch.sq = { on: { id: n }, done: { id: times }, flags: { id: pick }, t: { id: time } } (sheet v23); t = a delivery's deadline,
// or when a weekly quest opens again. `repeat: true` may be taken again at once; `repeat: "week"` (Q6, the late field-boss
// 기록) once a week per giver, until the weekly book's turn (63-social-weekly.js nextWeek, Monday 06:00 KST). req.until = a quest whose hand-in retires
// this one (a giver's weekly text follows their arc: one row per stage, each until the next stage opens).

const SQ_MAX = 10;
const SQ_GOALS = ["kill", "collect", "talk", "visit", "elite", "fb", "make", "deliver", "choice"];
const SQ_COUNTED = ["kill", "collect", "elite", "fb", "make", "deliver"];
const SQ_ID = /^[a-z][a-z0-9_]{2,31}$/;
// the NPC at each recipe station (track.js walks there for a make goal; "fire" = any campfire)
const SQ_STATION = { cook: "juju", craft: "kangkang", alch: "bogle" };
const isQuestItem = (id) => Object.hasOwn(ITEMS, id) && ITEMS[id].type === "quest";
const isKeep = (id) => Object.hasOwn(ITEMS, id) && ITEMS[id].type === "keep";
/** The recipe that makes `item`, or null. */
const sqRecipe = (item) => Object.values(RECIPES).find((r) => r.out[0] === item) || null;
function sqReward(rw) {
  rw = isObj(rw) ? rw : {};
  return {
    xp: Math.max(0, rw.xp | 0), gold: Math.max(0, rw.gold | 0),
    items: (Array.isArray(rw.items) ? rw.items : []).filter((it) => Array.isArray(it) && typeof it[0] === "string" && Object.hasOwn(ITEMS, it[0]) && !isKeep(it[0])).map(([id, n]) => [id, clamp(n | 0, 1, 999)]),
    ...(isKeep(rw.keep) ? { keep: rw.keep } : {}), ...(txt(rw.title, 16) ? { title: txt(rw.title, 16) } : {}),
  };
}
/** The side quests, cleaned: anything naming what does not exist is left out. */
const SIDE = DATA.quests.side.filter((q) => typeof q.id === "string" && SQ_ID.test(q.id) && typeof q.giver === "string" && q.goal && SQ_GOALS.includes(q.goal.type)).map((q) => {
  const g = q.goal, req = q.req && typeof q.req === "object" ? q.req : {};
  const goal = { type: g.type, n: SQ_COUNTED.includes(g.type) ? clamp((g.n ?? 1) | 0, 1, 999) : 1 };
  if (g.type === "kill" || ((g.type === "elite" || (g.type === "collect" && isQuestItem(g.item))) && typeof g.mob === "string")) goal.mob = g.mob;
  if (g.type === "collect" && isQuestItem(g.item) && g.rift === true) goal.rift = true;
  if (g.type === "collect" || g.type === "make" || g.type === "deliver") goal.item = g.item;
  if (g.type === "talk" || g.type === "deliver") goal.npc = g.npc;
  if (g.type === "deliver" && (g.time | 0) > 0) goal.time = clamp(g.time | 0, 30, 3600);
  if (g.type === "elite" && txt(g.named, 24)) goal.named = txt(g.named, 24);
  if (g.type === "visit" || ((g.type === "elite" || g.type === "fb") && typeof g.map === "string")) goal.map = g.map;
  const choice = (Array.isArray(q.choice) ? q.choice : []).filter((o) => isObj(o) && txt(o.label, 40)).slice(0, 3)
    .map((o) => ({ label: txt(o.label, 40), done: txt(o.done, 400), ...(o.reward ? { reward: sqReward(o.reward) } : {}) }));
  const flag = Array.isArray(req.flag) && typeof req.flag[0] === "string" && Number.isInteger(req.flag[1]) ? [req.flag[0], clamp(req.flag[1], 0, 2)] : null;
  return {
    id: q.id, giver: q.giver, title: txt(q.title, 40) || q.id, text: txt(q.text, 400), done: txt(q.done, 400), ...(txt(q.hint, 80) ? { hint: txt(q.hint, 80) } : {}),
    goal, req: { lv: clamp(req.lv | 0, 0, MAXLV), quest: typeof req.quest === "string" ? req.quest : null, ...(req.main === true ? { main: true } : {}), ...(flag ? { flag } : {}), ...(typeof req.until === "string" ? { until: req.until } : {}) },
    reward: sqReward(q.reward), ...(choice.length >= 2 ? { choice } : {}),
    repeat: q.repeat === "week" ? "week" : !!q.repeat, ...(q.mainChapter ? { mainChapter: true } : {}),
  };
}).filter((q, i, all) => all.findIndex((o) => o.id === q.id) === i && NPC_MAP[q.giver] && (!q.goal.mob || Object.hasOwn(MOBS, q.goal.mob)) && (
  q.goal.type === "kill" ? true : q.goal.type === "collect" ? Object.hasOwn(ITEMS, q.goal.item) : q.goal.type === "talk" ? !!NPC_MAP[q.goal.npc]
    : q.goal.type === "make" ? !!sqRecipe(q.goal.item) : q.goal.type === "deliver" ? !!NPC_MAP[q.goal.npc] && isQuestItem(q.goal.item)
      : q.goal.type === "visit" || q.goal.map ? Object.hasOwn(MAP_META, q.goal.map) : true));
const SQ_BY = {};
for (const q of SIDE) SQ_BY[q.id] = q;
for (const q of SIDE) {
  if (q.req.quest && !SQ_BY[q.req.quest]) q.req.quest = null;
  if (q.req.flag && !SQ_BY[q.req.flag[0]]?.choice) delete q.req.flag;
  if (q.req.until && !SQ_BY[q.req.until]) delete q.req.until;
}
// main-chain chapters (P6): a QUESTS row's `sq` is its story beat, a mainChapter quest that opens once the chain reaches
// that row and must be done before the row can be accepted (70-validate.js); a row naming none, or a missing one, has no beat
const SQ_MAIN = {};
/** `req.main` quests open once the frost king (the chain's last boss) is down; the epilogue after him does not gate them. */
const kingDown = (ch) => ch.q.i > QUESTS.findIndex((q) => q.mob === "crownstag");
for (const [i, Q] of QUESTS.entries()) {
  if (Q.sq && SQ_BY[Q.sq]?.mainChapter && !Object.hasOwn(SQ_MAIN, Q.sq)) SQ_MAIN[Q.sq] = i;
  else delete Q.sq;
}
/** Who a quest is handed in to: the recipient of a delivery, else the giver. */
const sqTurnIn = (q) => (q.goal.type === "deliver" ? q.goal.npc : q.giver);
/** The reward a hand-in pays: the picked option's own, else the quest's. */
const sqPay = (q, pick) => (q.choice && q.choice[pick] && q.choice[pick].reward) || q.reward;
// quest titles: every reward with a title becomes an achievement (category 이야기) the title picker already shows
for (const q of SIDE) for (const [pick, rw] of [[-1, q.reward], ...(q.choice || []).map((o, i) => [i, o.reward])]) {
  if (!rw || !rw.title) continue;
  const id = pick < 0 ? `t_${q.id}` : `t_${q.id}_${pick}`;
  const a = { id, cat: "이야기", name: rw.title, desc: `[${q.title}] 완료${pick < 0 ? "" : ` · ${q.choice[pick].label}`}`, pts: 5,
    test: (c) => !!c.sq.done[q.id] && (pick < 0 || (c.sq.flags[q.id] | 0) === pick), title: rw.title, bonus: null };
  ACH.push(a); ACH_BY[id] = a; rw.ach = id;
}

// main-chain honors (QUESTS[i].honor): an achievement earned once ch.q.i is past that row (a sheet already past it gets it at its next achievement check)
QUESTS.forEach((q, i) => {
  if (!q.honor) return;
  const a = { id: `h_${i}`, cat: "이야기", name: q.honor, desc: `[${q.title}] 의뢰 완료`, pts: 5, test: (c) => c.q.i > i, title: q.honor, bonus: null };
  ACH.push(a); ACH_BY[a.id] = a;
});

const sqEmpty = () => ({ on: {}, done: {}, flags: {}, t: {} });
/** A saved ch.sq, cleaned: active quests that no longer exist are dropped; finished ones are remembered. */
function sqClean(v) {
  const out = sqEmpty();
  if (!isObj(v)) return out;
  let side = 0;
  if (isObj(v.on)) for (const id of Object.keys(v.on)) {
    const q = Object.hasOwn(SQ_BY, id) ? SQ_BY[id] : null;
    if (!q || (!q.mainChapter && side >= SQ_MAX)) continue;
    out.on[id] = clamp(v.on[id] | 0, 0, q.goal.n);
    if (!q.mainChapter) side++;
    if (q.goal.time && isObj(v.t) && Number.isSafeInteger(v.t[id])) out.t[id] = v.t[id];
  }
  if (isObj(v.done)) for (const id of Object.keys(v.done).slice(0, 400)) if (SQ_ID.test(id) && (v.done[id] | 0) > 0) out.done[id] = Math.min(9999, v.done[id] | 0);
  if (isObj(v.flags)) for (const id of Object.keys(v.flags)) if (SQ_BY[id]?.choice && out.done[id]) out.flags[id] = clamp(v.flags[id] | 0, 0, SQ_BY[id].choice.length - 1);
  if (isObj(v.t)) for (const id of Object.keys(v.t)) if (SQ_BY[id]?.repeat === "week" && !Object.hasOwn(out.on, id) && out.done[id] && Number.isSafeInteger(v.t[id])) out.t[id] = v.t[id];
  return out;
}
/** Keepsakes (기념품) on a sheet: { id: 1 } for known ones (v23). */
const keepClean = (v) => Object.fromEntries((isObj(v) ? Object.keys(v) : []).filter(isKeep).map((id) => [id, 1]));
/**
 * After the sheet is cleaned (migrate): a delivery under way whose quest item is missing (a sheet from
 * before the quest became a delivery, or a lost parcel) gets it again; quest items nothing asks for go.
 */
function sqItemsFix(ch) {
  const want = {}, named = new Set();
  for (const id of Object.keys(ch.sq.on)) {
    const g = SQ_BY[id].goal;
    if (g.item) named.add(g.item);
    if (g.type === "deliver") want[g.item] = (want[g.item] | 0) + g.n;
  }
  for (const s of ch.inv.slice()) if (isQuestItem(s.id) && !named.has(s.id)) takeItem(ch, s.id, s.n || 1);
  for (const id of Object.keys(want)) { const have = countItem(ch, id); if (have < want[id]) addItem(ch, id, want[id] - have); }
}
/** How far along an active quest is (collect and deliver count what is in the bag right now). */
const sqHave = (ch, q) => (q.goal.type === "collect" || q.goal.type === "deliver" ? Math.min(q.goal.n, countItem(ch, q.goal.item)) : Math.min(q.goal.n, ch.sq.on[q.id] | 0));
/** A weekly quest of this giver was handed in this week (one a week per giver, whichever stage of the arc it was). */
const sqWeekDone = (ch, q, now) => Object.keys(ch.sq.t).some((id) => now < ch.sq.t[id] && SQ_BY[id].repeat === "week" && SQ_BY[id].giver === q.giver);
/** 0 locked · 1 can take · 2 under way · 3 ready to hand in · 4 finished (for good, or this week) · -1 another branch was chosen or the story moved on. */
function sqState(ch, q, now) {
  if (Object.hasOwn(ch.sq.on, q.id)) return sqHave(ch, q) >= q.goal.n ? 3 : 2;
  if (ch.sq.done[q.id] && !q.repeat) return 4;
  const f = q.req.flag;
  if ((f && ch.sq.done[f[0]] && (ch.sq.flags[f[0]] | 0) !== f[1]) || (q.req.until && ch.sq.done[q.req.until])) return -1;
  if (ch.lvl < q.req.lv || (q.req.main && !kingDown(ch)) || (Object.hasOwn(SQ_MAIN, q.id) && ch.q.i < SQ_MAIN[q.id]) || (q.req.quest && !ch.sq.done[q.req.quest]) || (f && !ch.sq.done[f[0]])) return 0;
  return q.repeat === "week" && sqWeekDone(ch, q, now) ? 4 : 1;
}
const npcName = (id) => (Object.hasOwn(NPC_NAME, id) ? NPC_NAME[id] : id);
/** Credit `n` toward every active quest of this type that `match` accepts. */
function sqProgress(S, p, type, match, n = 1) {
  const ch = p.ch;
  for (const id of Object.keys(ch.sq.on)) {
    const q = SQ_BY[id];
    if (!q || q.goal.type !== type || !match(q.goal)) continue;
    const was = ch.sq.on[id] | 0;
    if (was >= q.goal.n) continue;
    ch.sq.on[id] = Math.min(q.goal.n, was + n);
    p.dirty = true;
    if (ch.sq.on[id] >= q.goal.n) toast(p, `[${q.title}] 달성! ${npcName(q.giver)}에게 돌아가세요.`);
    else if (type !== "talk" && type !== "visit") toast(p, `[${q.title}] ${ch.sq.on[id]}/${q.goal.n}`);
  }
}
/**
 * Quest-only finds: a collect goal of a quest item may name where it comes from — `mob` (a kill of that kind drops
 * one now and then, straight into the bag) or `rift` (each cleared 레이드던전's chest gives one). `from` = the kind
 * killed, or "rift". Only while the quest is under way and short of its count.
 */
const SQ_FIND = 0.35;
function sqFind(S, p, from) {
  for (const id of Object.keys(p.ch.sq.on)) {
    const q = SQ_BY[id], g = q && q.goal;
    if (!g || g.type !== "collect" || !(from === "rift" ? g.rift : g.mob === from) || sqHave(p.ch, q) >= g.n) continue;
    if (from !== "rift" && rnd(S) >= SQ_FIND) continue;
    if (addItem(p.ch, g.item, 1)) { p.gain.push(["item", g.item, 1, 0]); p.dirty = true; sqPicked(p, g.item); }
  }
}
/** Something the player made with a recipe (58-life.js): make goals count it. */
const sqMade = (S, p, id, n) => sqProgress(S, p, "make", (g) => g.item === id, n);
/** A picked-up item that a collect quest wants says so. */
function sqPicked(p, item) {
  for (const id of Object.keys(p.ch.sq.on)) {
    const q = SQ_BY[id];
    if (!q || q.goal.type !== "collect" || q.goal.item !== item) continue;
    const have = sqHave(p.ch, q);
    toast(p, have >= q.goal.n ? `[${q.title}] 달성! ${npcName(q.giver)}에게 돌아가세요.` : `[${q.title}] ${ITEMS[item].name} ${have}/${q.goal.n}`);
  }
}
function sqValidate(S, p, a) {
  const ch = p.ch;
  if (a.a === "drop") {
    if (a.id === AIRSHIP_QUEST && S.dims[p.map]?.story?.airship) return bad("갑판을 떠난 뒤 구조 의뢰를 포기할 수 있습니다");
    return typeof a.id === "string" && Object.hasOwn(ch.sq.on, a.id) ? OK : bad("진행 중인 퀘스트가 아닙니다");
  }
  if (a.a === "talk") return typeof a.npc === "string" && npcReach(p, a.npc) ? OK : bad("너무 멉니다");
  const q = typeof a.id === "string" && Object.hasOwn(SQ_BY, a.id) ? SQ_BY[a.id] : null;
  if (!q) return bad("없는 퀘스트입니다");
  const who = a.a === "done" ? sqTurnIn(q) : q.giver;
  if (!npcReach(p, who)) return bad(`${npcName(who)}에게 가까이 가야 합니다`);
  const st = sqState(ch, q, S.now);
  if (a.a === "take") {
    if (q.mainChapter && p.dead) return bad("쓰러진 채로는 주요 의뢰를 받을 수 없습니다");
    if (st === 2 || st === 3) return bad("이미 진행 중입니다");
    if (st === 4) return bad(q.repeat === "week" ? "이번 주에는 이미 마쳤습니다. 월요일 아침 6시에 다시 받을 수 있습니다" : "이미 마친 퀘스트입니다");
    if (st === -1) return bad("다른 길을 골랐습니다");
    if (ch.lvl < q.req.lv) return bad(`레벨 ${q.req.lv} 이상이어야 합니다`);
    if (q.req.main && !kingDown(ch)) return bad("성에왕을 쓰러뜨리는 주요 의뢰까지 마쳐야 합니다");
    if (Object.hasOwn(SQ_MAIN, q.id) && ch.q.i < SQ_MAIN[q.id]) return bad("주요 의뢰를 더 진행해야 합니다");
    if (st === 0) { const pre = SQ_BY[q.req.quest || q.req.flag[0]]; return bad(`먼저 [${pre.title}]${pp(pre.title, "을를")} 마쳐야 합니다`); }
    if (!q.mainChapter && Object.keys(ch.sq.on).filter((id) => !SQ_BY[id]?.mainChapter).length >= SQ_MAX) return bad(`퀘스트는 ${SQ_MAX}개까지 받을 수 있습니다`);
    if (q.goal.type === "deliver" && !canAdd(ch, q.goal.item, q.goal.n)) return bad("맡길 물건을 넣을 가방 자리가 없습니다");
    return OK;
  }
  if (a.a === "done") {
    if (q.id === AIRSHIP_QUEST) return bad("감염된 정찰대장을 쓰러뜨리면 구조 의뢰가 완료됩니다");
    if (q.mainChapter && p.dead) return bad("쓰러진 채로는 주요 의뢰를 마칠 수 없습니다");
    if (st !== 3) return bad("아직 퀘스트를 마치지 못했습니다");
    if (q.goal.time && S.now > (ch.sq.t[q.id] || 0)) return bad("제한 시간이 지났습니다. 퀘스트를 포기하고 다시 받으세요");
    if (q.choice && !(Number.isInteger(a.pick) && a.pick >= 0 && a.pick < q.choice.length)) return bad("대답을 골라 주세요");
    for (const [id, n] of sqPay(q, a.pick).items) if (!canAdd(ch, id, n)) return bad("가방을 비우고 다시 오세요");
    return OK;
  }
  return bad("잘못된 요청입니다");
}
function sqApply(S, p, a) {
  const ch = p.ch;
  p.dirty = true;
  if (a.a === "talk") { sqProgress(S, p, "talk", (g) => g.npc === a.npc); return; }
  if (a.a === "drop") {
    const q = SQ_BY[a.id];
    delete ch.sq.on[a.id]; delete ch.sq.t[a.id];
    if (q && q.goal.type === "deliver") takeItem(ch, q.goal.item, countItem(ch, q.goal.item));   // the parcel goes back
    toast(p, `퀘스트 포기: ${q ? q.title : a.id}`);
    return;
  }
  const q = SQ_BY[a.id];
  if (a.a === "take") {
    ch.sq.on[q.id] = (q.req.main && q.goal.type === "talk" && q.goal.npc === q.giver) || q.goal.type === "choice" ? 1 : 0;
    delete ch.sq.t[q.id];   // a weekly's reopening time is spent
    toast(p, `퀘스트 수락: ${q.title}`);
    if (q.goal.type === "deliver") {
      addItem(ch, q.goal.item, q.goal.n);
      p.gain.push(["item", q.goal.item, q.goal.n, 0]);
      if (q.goal.time) ch.sq.t[q.id] = S.now + q.goal.time * 1000;
    }
    if (q.goal.type === "visit" && p.map === q.goal.map) sqProgress(S, p, "visit", (g) => g.map === p.map);
    return;
  }
  // hand in: collected or carried items are given over, the answer remembered, then the reward
  if (q.goal.type === "collect" || q.goal.type === "deliver") takeItem(ch, q.goal.item, q.goal.n);
  else if (q.goal.type === "make" && isQuestItem(q.goal.item)) takeItem(ch, q.goal.item, countItem(ch, q.goal.item));   // a made quest item goes to whoever asked
  delete ch.sq.on[q.id]; delete ch.sq.t[q.id];
  ch.sq.done[q.id] = (ch.sq.done[q.id] | 0) + 1;
  if (q.repeat === "week") ch.sq.t[q.id] = nextWeek(S.now);
  if (q.choice) ch.sq.flags[q.id] = a.pick;
  const rw = sqPay(q, a.pick);
  if (q.id === JF_QUEST) afterGear(S, p);
  if (rw.gold) { ch.gold += rw.gold; p.gain.push(["gold", rw.gold]); }
  for (const [id, n] of rw.items) if (addItem(ch, id, n)) foundItem(S, p, id, n);
  toast(p, `퀘스트 완료: ${q.title}`);
  if (rw.keep && !ch.keep[rw.keep]) { ch.keep[rw.keep] = 1; toast(p, `기념품 [${ITEMS[rw.keep].name}]${pp(ITEMS[rw.keep].name, "을를")} 간직했습니다 (도감 · 기념품)`); }
  if (rw.ach) checkAch(S, p);
  if (q.id !== AIRSHIP_QUEST && cosRoll(S, p, "quest") < COS_QUEST) cosFrom(S, p, "quest", "퀘스트 보상");
  if (rw.xp) gainXp(S, p, rw.xp);
}
/** What the quest windows show: [id, state, have, need, deadline?] for every side quest (a closed branch is left out). */
const sqView = (ch, now) => SIDE.map((q) => {
  const st = sqState(ch, q, now), on = Object.hasOwn(ch.sq.on, q.id);
  return st < 0 ? null : on && ch.sq.t[q.id] ? [q.id, st, sqHave(ch, q), q.goal.n, ch.sq.t[q.id]] : [q.id, st, on ? sqHave(ch, q) : 0, q.goal.n];
}).filter(Boolean);
