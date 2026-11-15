// ───────────────────────────── content: the long game ─────────────────────────────
// What keeps a character coming back, each after a live game that does it well:
// waypoints (Diablo II), a return scroll (Baram, Lineage), daily tasks (Lost Ark),
// achievements and titles (MapleStory, Baram), a monster collection (MapleStory,
// Lost Ark), a timed field event (Lineage, Baram) and a first-steps chain.

const dirtyAll = (S) => { for (const pid of Object.keys(S.players)) S.players[pid].dirty = true; };

// ── waypoints and the return scroll
const WP_R = 40, RECALL_MS = 2000, WARP_CALM = 3000;
/** The waypoint stone of the player's map they stand beside (a big ground has several: its `i` says which), or null. */
function wpNear(p) {
  const m = mapOfS(p.S, p.map);
  if (!m) return null;
  for (const w of stonesOf(m)) if (dist(p.x, p.y, w.x * T + 8, w.y * T + 10) <= WP_R) return w;
  return null;
}
/** Waking the stone you stand beside, and noting the maps you have walked. */
function explore(S, p) {
  const ch = p.ch;
  if (!ch.seen.includes(p.map)) { ch.seen.push(p.map); checkAch(S, p); }
  const w = wpNear(p), i = w ? w.i || 0 : 0;
  if (w && !wpWoken(ch, p.map, i)) {
    ch.wp[p.map] = (ch.wp[p.map] | 0) | (1 << i);
    toast(p, `[${MAP_META[p.map] ? stoneName(p.map, i) : mapOfS(p.S, p.map).name}] 이동의 돌을 깨웠습니다. 다른 이동의 돌에서 이곳으로 올 수 있습니다.`);
    S.maps[p.map].ev.push(["wp", p.eid, 2]);
    p.dirty = true;
    checkAch(S, p);
  }
}
function cancelRecall(S, p, why) {
  if (!p.recall) return;
  p.recall = null;
  S.maps[p.map].ev.push(["rc", p.eid, 0]);
  p.dirty = true;
  if (why) toast(p, why);
}
function finishRecall(S, p) {
  if (countItem(p.ch, "recall") < 1) { cancelRecall(S, p, "귀환 주문서가 없습니다."); return; }
  takeItem(p.ch, "recall", 1);
  p.recall = null;
  S.maps[p.map].ev.push(["rc", p.eid, -1]);
  changeMap(S, p, START.map, START.x, START.y);
  toast(p, "버드나무광장으로 돌아왔습니다.");
  p.dirty = true;
}

// ── daily tasks, reset at 06:00 Korean time
const DAY_MS = 86400000, KST = 9 * 3600000, RESET_AT = 6 * 3600000;
const dayOf = (now) => Math.floor((now + KST - RESET_AT) / DAY_MS);
const nextReset = (now) => (dayOf(now) + 1) * DAY_MS - KST + RESET_AT;
function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const DAILY_TEXT = { kill: "{mob} {need}마리 처치", elite: "정예 몬스터 {need}마리 처치", fish: "물고기 {need}마리 낚기", cook: "요리 {need}번 성공하기", chest: "보물 상자 {need}개 열기", bounty: "반복 의뢰 {need}번 보고하기",
  gather: "채집 {need}번 하기", craft: "제작·연금·요리 {need}번 성공하기",
  campcook: "모닥불 요리 {need}회 성공하기", party: "파티로 몬스터 {need}마리 처치" };
// (gather and craft: life skills L2, counted in 58-life.js gatDone/craftOnce)
const DAILY_OTHER = ["elite", "fish", "campcook", "chest", "bounty", "gather", "craft"];
const DAILY_PARTY_KILLS = 10;
function rollDaily(ch, day) {
  const box = { seed: strHash(`${ch.name}:${day}`) | 0 };
  // the monster to hunt is one around the character's level that lives somewhere they can reach
  const t = toTier(ch.lvl);
  const near = HUNTED.filter((k) => MOBS[k].lv <= t + 2).sort((a, b) => Math.abs(MOBS[a].lv - t) - Math.abs(MOBS[b].lv - t)).slice(0, 4);
  const k = near.length ? near[ri(box, 0, near.length - 1)] : HUNTED[0];
  const tasks = [{ kind: "kill", k, n: 0, need: 30 + 10 * ri(box, 0, 2) }];
  const pool = DAILY_OTHER.slice();
  while (tasks.length < 3) {
    const kind = pool.splice(ri(box, 0, pool.length - 1), 1)[0];
    const need = { elite: ri(box, 3, 5), fish: ri(box, 4, 6), campcook: ri(box, 1, 1), chest: 2, bounty: 1, gather: ri(box, 4, 6), craft: ri(box, 2, 3) }[kind];
    tasks.push({ kind, k: null, n: 0, need });
  }
  return { day, tasks, claimed: [false, false, false], bonus: false };
}
function ensureDaily(S, p) {
  const ch = p.ch, day = dayOf(S.now);
  // the weekly book rides the same once-a-second check (63-social-weekly.js)
  weekTick(S, p);
  if (ch.daily && ch.daily.day === day) return;
  const prev = ch.daily;
  ch.daily = rollDaily(ch, day);
  // days gone by with nothing claimed come back as a bonus on today's rewards (63: restCarry)
  ch.daily.rest = restCarry(prev, day);
  p.dirty = true;
  if (prev) toast(p, ch.daily.rest ? `일일 과제가 새로 갱신되었습니다. 쉬고 온 보너스: 오늘 과제 보상 +${ch.daily.rest * WEEK.restPct}%` : "일일 과제가 새로 갱신되었습니다.");
}
const dailyText = (t) => DAILY_TEXT[t.kind].replace("{mob}", t.k ? MOBS[t.k].name : "").replace("{need}", t.need);
/** Rewards are paid on the world's scale: the tier a level maps to (the same as before levels went to 200). */
const rewardTier = (ch) => Math.min(toTier(ch.lvl), TIER_MAX - 1);
function dailyReward(ch, t) {
  const tr = rewardTier(ch);
  const k = restK(ch);
  return { gold: Math.round((60 + 25 * tr) * k), xp: Math.round(tierXp(tr) * 0.12 * k), stone: ["kill", "party", "elite", "chest"].includes(t.kind) ? 1 : 0 };
}
function dailyBonus(ch) {
  const tr = rewardTier(ch);
  const k = restK(ch);
  return { gold: Math.round((150 + 40 * tr) * k), xp: Math.round(tierXp(tr) * 0.25 * k), stone: 3, gear: 1 };
}
/** Count one more of `kind` (and, for hunting, of monster `k`) toward today's tasks. */
function dailyProg(S, p, kind, k) {
  ensureDaily(S, p);
  weekProg(S, p, kind, k);
  for (const t of p.ch.daily.tasks) {
    const matches = t.kind === kind || (t.kind === "campcook" && kind === "cook" && k === "fire");
    if (!matches || (kind === "kill" && t.k !== k) || t.n >= t.need) continue;
    t.n++;
    p.dirty = true;
    if (t.n >= t.need) toast(p, `일일 과제 완료: ${dailyText(t)} — 보상을 받으세요.`);
  }
}
/** A piece of gear for the looter's class, of at least rarity `minQ`, if the bag has room. */
function rewardGear(S, p, ilvl, minQ) {
  if (p.ch.inv.length >= bagCap(p.ch)) { toast(p, "가방이 가득 차 장비 보상을 받지 못했습니다."); return; }
  let roll = rnd(S) * 100, type = "weapon";
  for (const [ty, w] of DROP_TYPES) { if (roll < w) { type = ty; break; } roll -= w; }
  const tier = tierFor(ilvl);
  let id;
  if (type === "weapon") id = `w_${WK_ID[dropKind(S, p)]}_${tier}`;
  else id = `${GEAR[type].pre}_${tier}`;
  const g = rollGear(S, id, Math.max(minQ, rollRarity(S, 1, 0)), ilvl);
  p.ch.inv.push(g);
  p.gain.push(["item", g.id, 1, g.q]);
}
function payout(S, p, r) {
  const ch = p.ch;
  if (r.gold) { ch.gold += r.gold; p.gain.push(["gold", r.gold]); }
  if (r.stone && addItem(ch, "stone", r.stone)) p.gain.push(["item", "stone", r.stone, 0]);
  if (r.rune) { const id = `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`; if (addItem(ch, id, 1)) p.gain.push(["item", id, 1, 0]); }
  if (r.gear) rewardGear(S, p, Math.floor(toTier(ch.lvl)), r.gearQ || 2);
  if (r.xp) gainXp(S, p, r.xp);
  p.dirty = true;
}

// ── achievements and titles
/** [id, category, name, description, points, test, title, title bonus]. */
const ACH = [
  ["hunt100", "사냥", "첫 사냥꾼", "몬스터 100마리 처치", 5, (c) => c.kills >= 100],
  ["hunt1000", "사냥", "숙련된 사냥꾼", "몬스터 1,000마리 처치", 10, (c) => c.kills >= 1000, "사냥꾼"],
  ["hunt10000", "사냥", "학살자", "몬스터 10,000마리 처치", 30, (c) => c.kills >= 10000, "학살자", [["atkp", 2]]],
  ["elite10", "사냥", "정예 사냥", "정예 몬스터 10마리 처치", 5, (c) => c.cnt.elite >= 10],
  ["elite100", "사냥", "정예 학살", "정예 몬스터 100마리 처치", 15, (c) => c.cnt.elite >= 100, "정예 사냥꾼", [["crit", 1]]],
  ["fb1", "사냥", "우두머리 토벌", "사냥터 우두머리 처치", 10, (c) => c.cnt.fb >= 1],
  ["fb10", "사냥", "우두머리 사냥꾼", "사냥터 우두머리 10마리 처치", 20, (c) => c.cnt.fb >= 10, "우두머리 사냥꾼", [["hp", 40]]],
  ["guard1", "사냥", "수문장 격파", "던전 수문장 처치", 10, (c) => c.cnt.guard >= 1],
  ["boss", "사냥", "균열을 닫은 자", "균열의 군주 처치", 30, (c) => (c.mk.boss || 0) >= 1, "균열을 닫은 자", [["atkp", 3]]],
  ["abyss", "사냥", "심연을 넘은 자", "심연의 어미 처치", 50, (c) => (c.mk.abyssboss || 0) >= 1, "심연을 넘은 자", [["atkp", 4], ["critd", 10]]],
  // bosses-2 (docs/design/bosses-2.md): first kills earn a title
  ["clubshrimp", "사냥", "파도를 꺾은 자", "망치 갯가재 처치", 30, (c) => (c.mk.clubshrimp || 0) >= 1, "파도를 꺾은 자", [["hp", 3]]],
  ["bloodhorn", "사냥", "피눈물을 닦은 자", "혈루 왕도마뱀 처치", 40, (c) => (c.mk.bloodhorn || 0) >= 1, "피눈물을 닦은 자", [["atkp", 3]]],
  ["cloakbat", "사냥", "장막을 걷은 자", "밤장막 박쥐군주 처치 (주간 도전)", 40, (c) => (c.mk.cloakbat || 0) >= 1, "장막을 걷은 자", [["crit", 2]]],
  ["mvp10", "사냥", "선봉장", "보스·수문장 피해 기여도 1위 10번", 30, (c) => c.cnt.mvp >= 10, "선봉장"],
  ["bloomwhale", "사냥", "고래의 장송곡", "꽃무덤 고래 처치 (주간 도전)", 60, (c) => (c.mk.bloomwhale || 0) >= 1, "고래의 장송곡", [["atkp", 4], ["hp", 4]]],
  ["evt1", "사냥", "침공 저지", "균열 침공에 참여", 10, (c) => c.cnt.evt >= 1],
  ["evt10", "사냥", "균열 수호자", "균열 침공 10번 참여", 25, (c) => c.cnt.evt >= 10, "균열 수호자", [["def", 3]]],
  ["dim1", "사냥", "차원의 틈", "차원 균열 정화", 10, (c) => dimCnt(c).dim >= 1],
  ["dim10", "사냥", "차원 탐험가", "차원 균열 10번 정화", 25, (c) => dimCnt(c).dim >= 10, "차원 탐험가", [["mf", 5]]],
  ["wp3", "탐험", "이동의 돌", "이동의 돌 3개 깨우기", 5, (c) => wpCount(c) >= 3],
  ["wpall", "탐험", "모든 길을 아는 자", "모든 이동의 돌 깨우기", 20, (c) => Object.keys(MAP_META).every((id) => !MAP_META[id].wp || wpWoken(c, id))],
  ["explore", "탐험", "세계 여행자", "모든 지역 방문", 20, (c) => Object.keys(MAP_META).every((id) => c.seen.includes(id)), "여행자", [["spd", 3]]],
  ["star10", "숙련", "숙련의 길", "토벌 숙련 별 10개", 10, (c) => stars(c) >= 10],
  ["star50", "숙련", "토벌의 장인", "토벌 숙련 별 50개", 30, (c) => stars(c) >= 50, "토벌의 장인", [["xp", 3]]],
  ["col1", "숙련", "첫 도감 완성", "한 지역의 몬스터 도감 완성", 10, (c) => REGIONS.some((id) => regionDone(c, id))],
  ["colall", "숙련", "박물학자", "모든 지역의 몬스터 도감 완성", 50, (c) => REGIONS.every((id) => regionDone(c, id)), "박물학자", [["mf", 10]]],
  ["fish10", "생활", "낚시꾼", "물고기 10마리 낚기", 5, (c) => c.fish >= 10],
  ["fish100", "생활", "강태공", "물고기 100마리 낚기", 15, (c) => c.fish >= 100, "강태공"],
  ["carp", "생활", "황금 잉어", "황금 잉어 낚기", 15, (c) => c.cnt.carp >= 1],
  ["cook10", "생활", "요리사", "요리 10번 성공", 10, (c) => c.cnt.cook >= 10, "요리사"],
  ["rest10", "생활", "모닥불 단골", "모닥불의 온기 10번 받기", 5, (c) => c.cnt.rest >= 10],
  // life skills (58-life.js): any skill at 10 and 30, each at 50 with its master's title; gathering, making, deliveries
  ["life10", "생활", "생활의 발견", "생활 기술 하나를 Lv.10까지 올리기", 5, (c) => !!c.life && LIFE.some((k) => c.life[k].lv >= 10)],
  ["life30", "생활", "생활의 달인", "생활 기술 하나를 Lv.30까지 올리기", 15, (c) => !!c.life && LIFE.some((k) => c.life[k].lv >= 30), "생활의 달인"],
  // each skill at 30: its 견습 장인 tool belt (COS_ACH)
  ...LIFE.map((k, i) => [`life30_${k}`, "생활", LIFE_MASTER[i].replace("명인", "견습"), `${LIFE_NAME[i]} Lv.30 달성`, 10, (c) => !!c.life && c.life[k].lv >= 30]),
  // co-op part-time jobs (68-coop.js): the first S in each earns that job's cosmetic (COS_ACH)
  ["coopS_apt", "생활", "청소의 달인", "동동아파트 청소 S 등급", 20, (c) => c.cnt.coopS_apt >= 1, "청소의 달인"],
  ["coopS_diner", "생활", "서빙의 달인", "쥬쥬식당 서빙 S 등급", 20, (c) => c.cnt.coopS_diner >= 1, "서빙의 달인"],
  ["coopS_forge", "생활", "단조의 달인", "캉캉대장간 단조 S 등급", 20, (c) => c.cnt.coopS_forge >= 1, "단조의 달인"],
  ["coopS_alch", "생활", "가마의 달인", "보글연금공방 가마 S 등급", 20, (c) => c.cnt.coopS_alch >= 1, "가마의 달인"],
  ["coopS_lib", "생활", "서고의 달인", "올빼미 도서관 책 분류 S 등급", 20, (c) => c.cnt.coopS_lib >= 1, "서고의 달인"],
  ["coopall", "생활", "협동 알바 왕", "모든 협동 알바에서 S 등급", 40, (c) => CNT_KEYS.every((k) => !k.startsWith("coopS_") || c.cnt[k] >= 1), "협동 알바 왕"],
  ["coop20", "생활", "단골 알바생", "협동 알바 20번 완수", 30, (c) => c.cnt.coop >= 20, "단골 알바생"],
  ...LIFE.map((k, i) => [`life50_${k}`, "생활", LIFE_MASTER[i], `${LIFE_NAME[i]} Lv.50 달성`, 30, (c) => !!c.life && c.life[k].lv >= LIFE_MAX, LIFE_MASTER[i]]),
  ["gat100", "생활", "부지런한 채집꾼", "채집 100번", 5, (c) => c.cnt.gat >= 100],
  ["craft50", "생활", "솜씨 좋은 손", "제작·연금·요리 50번 성공", 10, (c) => c.cnt.craft >= 50],
  ["fbook", "생활", "물고기 박사", "물고기 도감 33칸을 모두 채우기", 20, (c) => fbookN(c) >= FISH_BOOK[FISH_BOOK.length - 1][0], "물고기 박사"],
  ["fbig10", "생활", "월척 기록가", "물고기 10종을 대(大) 크기로 도감에 올리기", 15, (c) => Object.values(c.fbook || {}).filter((e) => e[1] & 4).length >= 10],
  ["chore100", "생활", "버드나무 일꾼", "버드나무 마을 잡일 100번", 15, (c) => c.cnt.chore >= 100, "버드나무 일꾼"],
  ["deliver20", "생활", "믿음직한 배달부", "배달 20번 성공", 10, (c) => c.cnt.deliver >= 20],
  // trust 60 (가족) with an NPC who has perks: their title
  ...Object.keys(REP_PERK).map((id) => [`rep_${id}`, "함께", REP_PERK[id].title, `${REP_PERK[id].who}의 신뢰 ${REP_TIER[2]} (${REP_NAME[2]})`, 10, (c) => !!c.rep && (c.rep[id] | 0) >= REP_TIER[2], REP_PERK[id].title]),
  ["repwillow", "함께", "버드나무 이웃", `버드나무 마을 이웃 셋과 ${REP_NAME[1]} (신뢰 ${REP_TIER[1]})`, 10, (c) => !!c.rep && Object.keys(c.rep).filter((id) => id.startsWith("willow_") && c.rep[id] >= REP_TIER[1]).length >= 3],
  ["leg", "장비", "첫 전설", "전설 장비 획득", 10, (c) => c.cnt.leg >= 1],
  ["set", "장비", "세트 수집가", "세트 장비 획득", 10, (c) => c.cnt.set >= 1],
  ["enh7", "장비", "강화의 손길", "장비 +7 강화 성공", 10, (c) => c.cnt.enh >= 7],
  ["enh10", "장비", "명장", "장비 +10 강화 성공", 30, (c) => c.cnt.enh >= 10, "명장", [["def", 4]]],
  ["rw", "장비", "룬어 완성", "룬어 완성", 10, (c) => c.cnt.rw >= 1],
  ["party100", "함께", "함께하는 사냥", "파티로 몬스터 100마리 처치", 10, (c) => c.cnt.party >= 100, "동료"],
  ["guild", "함께", "길드원", "길드 가입", 5, (c) => !!c.guild],
  ["gfound", "함께", "길드장", "길드 창설", 10, (c) => c.cnt.gfound >= 1, "길드장"],
  // (ids from the 50-level days; holders keep them)
  ["lv10", "성장", "견습 모험가", "레벨 40 달성", 5, (c) => c.lvl >= 40],
  ["lv30", "성장", "베테랑 모험가", "레벨 120 달성", 15, (c) => c.lvl >= 120, "베테랑"],
  ["lv50", "성장", "전설의 모험가", "레벨 200 달성", 40, (c) => c.lvl >= 200, "전설의 모험가", [["hp", 80]]],
  ["job1", "성장", "첫 전직", "전직관 아르센에게서 전직하기", 10, (c) => c.job !== "adventurer"],
  ["job2", "성장", "두 갈래 길", "두 무기의 길(혼합 직업)로 전직하기", 20, (c) => !!JOBS[c.job] && JOBS[c.job].kind === "hybrid"],
  ["daily1", "성장", "성실한 하루", "일일 과제 보상 상자 받기", 5, (c) => c.cnt.daily >= 1],
  ["daily30", "성장", "성실한 모험가", "일일 과제 보상 상자 30번 받기", 20, (c) => c.cnt.daily >= 30, "성실한 모험가", [["gold", 10]]],
].map(([id, cat, name, desc, pts, test, title, bonus]) => ({ id, cat, name, desc, pts, test, title: title || null, bonus: bonus || null }));
const ACH_BY = Object.fromEntries(ACH.map((a) => [a.id, a]));
/** Every mastery star a character has earned. */
function stars(ch) {
  let n = 0;
  for (const k of Object.keys(ch.mk)) n += masteryRank(ch, k);
  return n;
}
/** bosses-2 kills whose first on each server is remembered (room.ts → vault "first") and announced (firstNotice). */
const SERVER_FIRST = ["clubshrimp", "bloodhorn", "cloakbat", "bloomwhale"];
/** room.ts: the first kills to claim since the last call — [character name, boss kind]. */
export function takeFirsts(S) {
  const out = S.firsts || [];
  S.firsts = [];
  return out;
}
/** room.ts: the vault says it was this server's first — everyone in this channel hears it. */
export function firstNotice(S, name, k) {
  if (!SERVER_FIRST.includes(k)) return false;
  const boss = MOBS[k].name;
  sys(S, `[서버 최초] ${String(name).slice(0, 16)}님이 이 서버에서 처음으로 ${boss}${pp(boss, "을를")} 쓰러뜨렸습니다!`);
  return true;
}
function checkAch(S, p) {
  const ch = p.ch;
  for (const a of ACH) {
    if (ch.ach.includes(a.id) || !a.test(ch)) continue;
    ch.ach.push(a.id);
    toast(p, `업적 달성: [${a.name}] +${a.pts}점${a.title ? ` — 칭호 「${a.title}」 획득` : ""}`);
    S.maps[p.map].ev.push(["ac", p.eid, a.id]);
    for (const id of COS_ACH[a.id] || []) giveCos(S, p, id, `업적 [${a.name}]`);
    if (a.pts >= 30) sys(S, `${ch.name}님이 업적 [${a.name}]${pp(a.name, "을를")} 달성했습니다!`);
    if (SERVER_FIRST.includes(a.id)) (S.firsts || (S.firsts = [])).push([ch.name, a.id]);
    p.dirty = true;
  }
}
const achPoints = (ch) => ch.ach.reduce((n, id) => n + (ACH_BY[id] ? ACH_BY[id].pts : 0), 0);
const titleOf = (ch) => (ch.title && ACH_BY[ch.title] ? ACH_BY[ch.title].title : "");

// ── the monster collection: a kind is registered at its first mastery star
const REGION_BONUS = { meadow: [["hp", 20]], forest: [["xp", 2]], crypt: [["def", 2]], city: [["crit", 1]], sewer: [["mf", 5]], cave: [["atk", 3]], abyss: [["atkp", 2]], maple: [["hp", 60], ["mf", 4]], frostkeep: [["def", 3], ["hp", 40]] };
// a hunting ground from the world map editor has a collection too, with no bonus; one with no monsters left has none
for (const id of Object.keys(COL_MOBS)) if (!REGION_BONUS[id]) REGION_BONUS[id] = [];
for (const id of Object.keys(REGION_BONUS)) if (!COL_MOBS[id]) delete REGION_BONUS[id];
const REGIONS = Object.keys(REGION_BONUS);
const regionDone = (ch, id) => COL_MOBS[id].every((k) => MOBS[k].bonusOptional || (ch.mk[k] || 0) >= MASTERY[0]);
function registered(S, p, k) {
  const ch = p.ch;
  toast(p, `몬스터 도감 등록: ${MOBS[k].name}`);
  for (const id of REGIONS) {
    if (!COL_MOBS[id].includes(k) || !regionDone(ch, id)) continue;
    const words = REGION_BONUS[id].map(([s, v]) => `${s === "xp" || s === "mf" || s === "crit" || s === "atkp" ? `${v}%` : `+${v}`} ${STAT_WORD[s]}`).join(", ");
    toast(p, words ? `[${MAP_META[id].name}] 도감 완성! 영구 보너스: ${words}` : `[${MAP_META[id].name}] 도감 완성!`);
    sys(S, `${ch.name}님이 [${MAP_META[id].name}] 몬스터 도감을 완성했습니다!`);
    p.stc = null;
  }
}
const STAT_WORD = { hp: "최대 HP", xp: "경험치", def: "방어력", crit: "치명타", mf: "아이템 발견", atk: "공격력", atkp: "공격력" };

// ── the world event: a rift opens in one hunting ground every half hour
const EVT = { every: 1800000, warn: 120000, len: 480000, waves: [0, 150000, 300000], boss: 360000 };
/** Where a rift can open: every hunting ground with a waypoint stone, a field boss and monsters of its own (never an instance). */
const EVT_MAPS = Object.keys(MAP_META).filter((id) => !MAP_META[id].safe && MAP_META[id].wp && FIELD_BOSS[id] && COL_MOBS[id]);
const evtMap = (slot) => EVT_MAPS[(Math.imul(slot, 2654435761) >>> 0) % EVT_MAPS.length];
/** A rift line in the chat, tagged with its map: players elsewhere see it in the 시스템 tab only. */
function sysEvt(S, map, m) { S.chat.push({ sys: 1, m, ev: map }); }
const newEvt = (slot) => ({ slot, map: evtMap(slot), phase: "warn", start: slot * EVT.every, end: slot * EVT.every + EVT.len, waves: 0, boss: 0, bossDead: false, dmg: {}, top: null });
function worldEvent(S, now) {
  const slot = Math.floor(now / EVT.every);
  let e = S.evt;
  if (e && (e.phase === "on" || e.phase === "boss")) { runEvent(S, e, now); return; }
  // the next one is called out two minutes ahead
  const next = slot + 1;
  if (now >= next * EVT.every - EVT.warn && (!e || e.slot !== next)) {
    S.evt = e = newEvt(next);
    sysEvt(S, e.map, `2분 뒤 [${MAP_META[e.map].name}]에 균열 침공이 시작됩니다! [${stoneName(e.map, evtStone(e.map))}] 이동의 돌 곁으로 모이세요 — 깨운 돌이라면 어느 이동의 돌에서든 건너갈 수 있습니다.`);
    dirtyAll(S);
    return;
  }
  if (e && e.phase === "warn" && now >= e.start) { beginEvent(S, e); return; }
  // a channel that wakes in the middle of an event's window joins it late
  if (slot > 0 && (!e || e.slot < slot) && now >= slot * EVT.every && now < slot * EVT.every + EVT.len - 60000) { S.evt = e = newEvt(slot); beginEvent(S, e); }
}
function beginEvent(S, e) {
  e.phase = "on";
  sysEvt(S, e.map, `균열 침공 시작! [${stoneName(e.map, evtStone(e.map))}] 이동의 돌 곁에 정예 몬스터가 몰려옵니다. (8분)`);
  dirtyAll(S);
  runEvent(S, e, S.now);
}
function runEvent(S, e, now) {
  while (e.waves < EVT.waves.length && now >= e.start + EVT.waves[e.waves]) { e.waves++; spawnWave(S, e); }
  if (!e.boss && now >= e.start + EVT.boss) spawnEvtBoss(S, e);
  if (now >= e.end || e.bossDead) endEvent(S, e);
}
/**
 * Which stone an event gathers at: the middle one (중턱) on a big ground, so the entrance plaza
 * stays safe for newcomers; the only one elsewhere.
 */
const evtStone = (id) => ((MAP_META[id] && MAP_META[id].wpn) >= 2 ? 1 : 0);
/** Where an event's monsters gather: beside that stone. */
const evtSpot = (id) => { const w = stonesOf(mapOf(id))[evtStone(id)] || wpOf(id); return [w.ax, w.ay]; };
function spawnWave(S, e) {
  const m = mapOf(e.map), rt = runtime(S, e.map), [cx, cy] = evtSpot(e.map);
  const kinds = COL_MOBS[e.map].filter(k => !MOBS[k].bonusOptional).sort((a, b) => MOBS[b].lv - MOBS[a].lv).slice(0, 2);
  const n = clamp(5 + 2 * rt.n, 5, 14);
  for (let i = 0; i < n; i++) {
    const mob = newMob(S, kinds[i % kinds.length], [Math.max(2, cx - 6), Math.max(2, cy - 6), Math.min(m.w - 3, cx + 6), Math.min(m.h - 3, cy + 6)]);
    placeMob(S, m, mob);
    if (!mob.x) { mob.x = mob.hx = mob.wx = cx * T + 8; mob.y = mob.hy = mob.wy = cy * T + 10; }
    mob.el = 1; mob.tr = rollTraits(S, 1); mob.hp = mobMax(mob); mob.temp = true; mob.evt = true;
    rt.mobs.push(mob);
    rt.ev.push(["r", mob.id]);
  }
  sysEvt(S, e.map, `[${m.name}] 균열 침공 ${e.waves}파 — 정예 ${n}마리가 나타났습니다!`);
  dirtyAll(S);
}
function spawnEvtBoss(S, e) {
  // the rift's lord gathers by the stone too, but never on it or on a signpost
  const m = mapOf(e.map), rt = runtime(S, e.map), [cx, cy] = bossSpot(S, m, ...evtSpot(e.map), FB_CLEAR, 0);
  const mob = newMob(S, FIELD_BOSS[e.map], [0, 0, 0, 0]);
  mob.el = 2; mob.temp = true; mob.evt = true; mob.tr = rollTraits(S, 2);
  mob.x = mob.hx = mob.wx = cx * T + 8; mob.y = mob.hy = mob.wy = cy * T + 10;
  mob.hp = mobMax(mob);
  mob.castAt = S.now + 4000;
  rt.mobs.push(mob);
  rt.ev.push(["r", mob.id]);
  e.boss = mob.id; e.phase = "boss";
  sysEvt(S, e.map, `[${m.name}] 균열 침공의 우두머리 [${MOBS[mob.k].name}]${pp(MOBS[mob.k].name, "이가")} 나타났습니다!`);
  dirtyAll(S);
}
function endEvent(S, e) {
  const rt = runtime(S, e.map);
  for (const mob of rt.mobs) if (mob.evt && !mob.dead) { mob.dead = true; rt.ev.push(["k", mob.id]); }
  const list = Object.entries(e.dmg).filter(([pid]) => S.players[pid]).sort((a, b) => b[1] - a[1]);
  const total = list.reduce((n, [, d]) => n + d, 0) || 1;
  const hi = MAP_META[e.map].band ? MAP_META[e.map].band[1] : 10;
  list.forEach(([pid, d], rank) => {
    const p = S.players[pid], share = d / total;
    const lv = rewardTier(p.ch);
    payout(S, p, {
      gold: Math.round(40 * hi * (0.5 + 2 * share)), xp: Math.round(tierXp(lv) * (0.06 + 0.3 * share)),
      stone: 1 + (share >= 0.25 ? 1 : 0) + (rank === 0 ? 2 : 0), rune: rank < 3, gear: rank === 0 ? 1 : 0, gearQ: 2,
    });
    p.ch.cnt.evt++;
    if (rank === 0 || (rank < 3 && cosRoll(S, p, "rift") < COS_RIFT_TOP3)) cosFrom(S, p, "rift", "균열 침공");
    toast(p, `균열 침공 보상 — 기여도 ${Math.round(share * 100)}%${rank < 3 ? ` (${rank + 1}위)` : ""}`);
    checkAch(S, p);
  });
  e.top = list.slice(0, 3).map(([pid, d]) => [S.players[pid].ch.name, d]);
  e.phase = "done";
  sysEvt(S, e.map, list.length ? `균열 침공 종료! ${e.top.map(([n], i) => `${i + 1}위 ${n}`).join(", ")}` : "균열 침공이 끝났습니다. 아무도 막지 못했습니다…");
  dirtyAll(S);
}
function evtView(S, p) {
  const e = S.evt, now = S.now, next = Math.floor(now / EVT.every) + 1;
  // st / nextSt: the stone (index) the event gathers at, for the warp shortcut
  const out = { phase: e ? e.phase : "idle", next: next * EVT.every - now, nextMap: evtMap(next), nextSt: evtStone(evtMap(next)) };
  if (e) Object.assign(out, { map: e.map, st: evtStone(e.map), name: stoneName(e.map, evtStone(e.map)), in: e.start - now, left: e.end - now, waves: e.waves, mine: e.dmg[p.pid] || 0, top: e.top });
  return out;
}

// ── first steps: a short tutorial chain beside the main quests
const TUT = [
  { id: "talk", title: "관리자에게 말 걸기", hint: "광장 분수 앞의 관리자 엘더윈에게 다가가 F를 누르세요. 첫 의뢰를 맡겨 줍니다.", reward: { gold: 20 } },
  { id: "equip", title: "무기 받기", hint: "수련관 카이에게 F로 말을 걸어 무기를 하나 받으세요. 받은 무기를 바로 손에 듭니다.", reward: { gold: 20 } },
  { id: "bag", title: "가방 열기", hint: "I를 눌러 가방을 열어 보세요.", reward: { gold: 20 } },
  { id: "buy", title: "물약 사기", hint: "보급상 리나에게 F로 말을 걸고 빨간 물약을 사 보세요.", reward: { gold: 40 } },
  { id: "hunt", title: "쌍두 토끼 3마리 처치", hint: "동쪽 문으로 나가 바람초원에서 쌍두 토끼를 잡으세요. X로 공격, R로 자동 사냥.", need: 3, reward: { gold: 60 } },
  { id: "rest", title: "모닥불에서 쉬기", hint: "모닥불 곁에서 Z로 앉아 잠시 쉬면 체력이 빨리 차고 경험치 보너스를 얻습니다.", reward: { gold: 40 } },
  { id: "skill", title: "스킬 써 보기", hint: "든 무기의 첫 스킬은 숙련 1부터 단축칸 1번에 있습니다. 몬스터 곁에서 1을 눌러 써 보세요.", reward: { gold: 100, items: [["camp", 1], ["recall", 2], ["pet_chick", 1]] } },
  // appended (the index is persisted): spending experience on a stat point
  { id: "level", title: "모닥불에서 레벨 올리기", hint: "모닥불 곁이나 수련관 카이 앞에서 C 창 → 능력치를 한 칸 올려 보세요. 한 칸이 1레벨입니다.", reward: { gold: 50 } },
];
/** Is tutorial step `id` already done by what the sheet shows? (a step that becomes current then completes at once) */
function tutDone(ch, id) {
  if (id === "equip") return !!(ch.eq.weapon && ch.sw);
  if (id === "level") return (ch.xpt | 0) > 0;
  return false;
}
function tutStep(S, p, id) {
  const ch = p.ch, step = TUT[ch.tut.i];
  if (!step || step.id !== id) return;
  if (step.need && ++ch.tut.n < step.need) { p.dirty = true; return; }
  const pay = (r) => {
    if (r.gold) { ch.gold += r.gold; p.gain.push(["gold", r.gold]); }
    for (const [it, n] of r.items || []) if (addItem(ch, it, n)) p.gain.push(["item", it, n, 0]);
  };
  ch.tut.i++; ch.tut.n = 0;
  pay(step.reward);
  // a step already done needs no doing (a weapon picked on the creation page): passed over, paid, never announced as next
  let next;
  while ((next = TUT[ch.tut.i]) && tutDone(ch, next.id)) { ch.tut.i++; pay(next.reward); }
  toast(p, `[첫걸음] ${step.title} 완료!${next ? ` 다음: ${next.title}` : " 모든 첫걸음을 마쳤습니다!"}`);
  p.dirty = true;
}

