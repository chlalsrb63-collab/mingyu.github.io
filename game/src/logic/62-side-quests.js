// ───────────────────────────── side quests (world map editor) ─────────────────────────────
// data/quests.json "side": errands NPCs hand out beside the main chain. A goal is to kill
// (kills of the kind count, like the main quest's), to collect (items in the bag, taken on
// hand-in), to talk to an NPC or to visit a map. Progress lives on the sheet as
// ch.sq = { on: { id: n }, done: { id: times } } (sheet v8).

const SQ_MAX = 10;
const SQ_GOALS = ["kill", "collect", "talk", "visit"];
/** The side quests, cleaned: anything naming what does not exist is left out. */
const SIDE = DATA.quests.side.filter((q) => typeof q.id === "string" && /^[a-z][a-z0-9_]{2,31}$/.test(q.id) && typeof q.giver === "string" && q.goal && SQ_GOALS.includes(q.goal.type)).map((q) => {
  const g = q.goal, req = q.req && typeof q.req === "object" ? q.req : {}, rw = q.reward && typeof q.reward === "object" ? q.reward : {};
  const goal = { type: g.type, n: g.type === "kill" || g.type === "collect" ? clamp(g.n | 0, 1, 999) : 1 };
  if (g.type === "kill") goal.mob = g.mob;
  if (g.type === "collect") goal.item = g.item;
  if (g.type === "talk") goal.npc = g.npc;
  if (g.type === "visit") goal.map = g.map;
  return {
    id: q.id, giver: q.giver, title: txt(q.title, 40) || q.id, text: txt(q.text, 400), done: txt(q.done, 400),
    goal, req: { lv: clamp(req.lv | 0, 0, MAXLV), quest: typeof req.quest === "string" ? req.quest : null, ...(req.main === true ? { main: true } : {}) },
    reward: { xp: Math.max(0, rw.xp | 0), gold: Math.max(0, rw.gold | 0), items: (Array.isArray(rw.items) ? rw.items : []).filter((it) => Array.isArray(it) && typeof it[0] === "string" && Object.hasOwn(ITEMS, it[0])).map(([id, n]) => [id, clamp(n | 0, 1, 999)]) },
    repeat: !!q.repeat, ...(q.mainChapter ? { mainChapter: true } : {}),
  };
}).filter((q, i, all) => all.findIndex((o) => o.id === q.id) === i && NPC_MAP[q.giver] && (
  q.goal.type === "kill" ? Object.hasOwn(MOBS, q.goal.mob) : q.goal.type === "collect" ? Object.hasOwn(ITEMS, q.goal.item) : q.goal.type === "talk" ? !!NPC_MAP[q.goal.npc] : Object.hasOwn(MAP_META, q.goal.map)));
const SQ_BY = {};
for (const q of SIDE) SQ_BY[q.id] = q;
for (const q of SIDE) if (q.req.quest && !SQ_BY[q.req.quest]) q.req.quest = null;

const sqEmpty = () => ({ on: {}, done: {} });
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
  }
  if (isObj(v.done)) for (const id of Object.keys(v.done).slice(0, 400)) if (/^[a-z][a-z0-9_]{2,31}$/.test(id) && (v.done[id] | 0) > 0) out.done[id] = Math.min(9999, v.done[id] | 0);
  return out;
}
/** How far along an active quest is (a collect goal counts what is in the bag right now). */
const sqHave = (ch, q) => (q.goal.type === "collect" ? Math.min(q.goal.n, countItem(ch, q.goal.item)) : Math.min(q.goal.n, ch.sq.on[q.id] | 0));
/** 0 locked · 1 can take · 2 under way · 3 ready to hand in · 4 finished for good. */
function sqState(ch, q) {
  if (Object.hasOwn(ch.sq.on, q.id)) return sqHave(ch, q) >= q.goal.n ? 3 : 2;
  if (ch.sq.done[q.id] && !q.repeat) return 4;
  if (ch.lvl < q.req.lv || (q.req.main && ch.q.i < QUESTS.length) || (q.req.quest && !ch.sq.done[q.req.quest])) return 0;
  return 1;
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
    else if (type === "kill") toast(p, `[${q.title}] ${ch.sq.on[id]}/${q.goal.n}`);
  }
}
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
  if (!npcReach(p, q.giver)) return bad(`${npcName(q.giver)}에게 가까이 가야 합니다`);
  const st = sqState(ch, q);
  if (a.a === "take") {
    if (q.mainChapter && p.dead) return bad("쓰러진 채로는 주요 의뢰를 받을 수 없습니다");
    if (st === 2 || st === 3) return bad("이미 진행 중입니다");
    if (st === 4) return bad("이미 마친 퀘스트입니다");
    if (ch.lvl < q.req.lv) return bad(`레벨 ${q.req.lv} 이상이어야 합니다`);
    if (q.req.main && ch.q.i < QUESTS.length) return bad("앞선 주요 의뢰를 모두 마쳐야 합니다");
    if (st === 0) return bad(`먼저 [${SQ_BY[q.req.quest].title}]${pp(SQ_BY[q.req.quest].title, "을를")} 마쳐야 합니다`);
    if (!q.mainChapter && Object.keys(ch.sq.on).filter((id) => !SQ_BY[id]?.mainChapter).length >= SQ_MAX) return bad(`퀘스트는 ${SQ_MAX}개까지 받을 수 있습니다`);
    return OK;
  }
  if (a.a === "done") {
    if (q.id === AIRSHIP_QUEST) return bad("감염된 정찰대장을 쓰러뜨리면 구조 의뢰가 완료됩니다");
    if (q.mainChapter && p.dead) return bad("쓰러진 채로는 주요 의뢰를 마칠 수 없습니다");
    if (st !== 3) return bad("아직 퀘스트를 마치지 못했습니다");
    for (const [id, n] of q.reward.items) if (!canAdd(ch, id, n)) return bad("가방을 비우고 다시 오세요");
    return OK;
  }
  return bad("잘못된 요청입니다");
}
function sqApply(S, p, a) {
  const ch = p.ch;
  p.dirty = true;
  if (a.a === "talk") { sqProgress(S, p, "talk", (g) => g.npc === a.npc); return; }
  if (a.a === "drop") { const q = SQ_BY[a.id]; delete ch.sq.on[a.id]; toast(p, `퀘스트 포기: ${q ? q.title : a.id}`); return; }
  const q = SQ_BY[a.id];
  if (a.a === "take") {
    ch.sq.on[q.id] = q.req.main && q.goal.type === "talk" && q.goal.npc === q.giver ? 1 : 0;
    toast(p, `퀘스트 수락: ${q.title}`);
    if (q.goal.type === "visit" && p.map === q.goal.map) sqProgress(S, p, "visit", (g) => g.map === p.map);
    return;
  }
  // hand in: collected items are given over, then the reward
  if (q.goal.type === "collect") takeItem(ch, q.goal.item, q.goal.n);
  delete ch.sq.on[q.id];
  ch.sq.done[q.id] = (ch.sq.done[q.id] | 0) + 1;
  if (q.id === JF_QUEST) afterGear(S, p);
  if (q.reward.gold) { ch.gold += q.reward.gold; p.gain.push(["gold", q.reward.gold]); }
  for (const [id, n] of q.reward.items) if (addItem(ch, id, n)) p.gain.push(["item", id, n, 0]);
  toast(p, `퀘스트 완료: ${q.title}`);
  if (q.id !== AIRSHIP_QUEST && cosRoll(S, p, "quest") < COS_QUEST) cosFrom(S, p, "quest", "퀘스트 보상");
  if (q.reward.xp) gainXp(S, p, q.reward.xp);
}
/** What the quest windows show: [id, state, have, need] for every side quest. */
const sqView = (ch) => SIDE.map((q) => [q.id, sqState(ch, q), Object.hasOwn(ch.sq.on, q.id) ? sqHave(ch, q) : 0, q.goal.n]);
