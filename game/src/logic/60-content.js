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
const DAILY_TEXT = { kill: "{mob} {need}마리 처치", elite: "정예 몬스터 {need}마리 처치", fish: "물고기 {need}마리 낚기", cook: "요리 {need}번 성공하기", chest: "보물 상자 {need}개 열기", bounty: "반복 토벌 {need}번 보고하기",
  gather: "채집 {need}번 하기", craft: "제작·연금·요리 {need}번 성공하기",
  campcook: "모닥불 요리 {need}회 성공하기", party: "파티로 몬스터 {need}마리 처치" };
// (gather and craft: life skills L2, counted in 58-life.js gatDone/craftOnce)
// 토벌 의뢰 (owner 2026-11-16): the day's three are all hunting; fishing, cooking, gathering and crafting are 아르바이트 (the board, 58-life.js).
// The life kinds stay in DAILY_TEXT so a day rolled before the change still reads and pays.
const DAILY_OTHER = ["elite", "chest", "bounty"];
const DAILY_HUNT = ["kill", "party", "elite", "chest", "bounty"];
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
  if (ch.daily && ch.daily.day === day) {
    // a day rolled before 일일 = 토벌 (2026-11-16): its unclaimed life tasks become hunting ones at once
    const life = ch.daily.tasks.filter((t, i) => !DAILY_HUNT.includes(t.kind) && !ch.daily.claimed[i]);
    if (life.length) {
      const free = DAILY_OTHER.filter((k) => !ch.daily.tasks.some((t) => t.kind === k));
      for (const t of life) { const kind = free.shift() || "elite"; Object.assign(t, { kind, k: null, n: 0, need: kind === "elite" ? 3 : kind === "chest" ? 2 : 1 }); }
      p.dirty = true;
    }
    return;
  }
  const prev = ch.daily;
  ch.daily = rollDaily(ch, day);
  // days gone by with nothing claimed come back as a bonus on today's rewards (63: restCarry)
  ch.daily.rest = restCarry(prev, day);
  p.dirty = true;
  if (prev) toast(p, ch.daily.rest ? `토벌 의뢰가 새로 갱신되었습니다. 쉬고 온 보너스: 오늘 토벌 보상 +${ch.daily.rest * WEEK.restPct}%` : "토벌 의뢰가 새로 갱신되었습니다.");
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
    if (t.n >= t.need) toast(p, `토벌 의뢰 완료: ${dailyText(t)} — 보상을 받으세요.`);
  }
}
/** A piece of gear for the looter's class, of at least rarity `minQ`; with `il`, a top-tier base at that item level (고대: IL_ANCIENT). */
function rewardGear(S, p, ilvl, minQ, il = 0) {
  // a reward earned is never lost: with a full bag it sits in an extra slot until room is made (as a recovered rune does, 40 migrate)
  if (p.ch.inv.length >= bagCap(p.ch)) toast(p, "가방이 가득 차 보상 장비를 임시 칸에 넣었습니다. 가방을 비워 주세요.");
  let roll = rnd(S) * 100, type = "weapon";
  for (const [ty, w] of DROP_TYPES) { if (roll < w) { type = ty; break; } roll -= w; }
  const tier = il ? G_REQ.length : tierFor(ilvl);
  let id;
  if (type === "weapon") id = `w_${WK_ID[dropKind(S, p)]}_${tier}`;
  else id = `${GEAR[type].pre}_${tier}`;
  const q = Math.max(minQ, Math.min(3, rollRarity(S, 1, 0)));   // uniques come from monster drops
  const g = il ? rollGearAtLevel(S, id, q, il) : rollGear(S, id, q, ilvl);
  p.ch.inv.push(g);
  p.gain.push(["item", g.id, 1, g.q]);
}
function payout(S, p, r) {
  const ch = p.ch;
  if (r.gold) { ch.gold += r.gold; p.gain.push(["gold", r.gold]); }
  if (r.stone && addItem(ch, "stone", r.stone)) p.gain.push(["item", "stone", r.stone, 0]);
  if (r.rune) gainRune(S, p, r.gearQ >= 3 ? 2 : 1);
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
  ["abyss", "사냥", "심연을 넘은 자", "모르마 처치", 50, (c) => (c.mk.abyssboss || 0) >= 1, "심연을 넘은 자", [["atkp", 4], ["critd", 10]]],
  // bosses-2 (docs/design/bosses-2.md): first kills earn a title
  ["clubshrimp", "사냥", "파도를 꺾은 자", "딱파랑 처치", 30, (c) => (c.mk.clubshrimp || 0) >= 1, "파도를 꺾은 자", [["hp", 3]]],
  ["bloodhorn", "사냥", "피눈물을 닦은 자", "루비악 처치", 40, (c) => (c.mk.bloodhorn || 0) >= 1, "피눈물을 닦은 자", [["atkp", 3]]],
  ["cloakbat", "사냥", "장막을 걷은 자", "벨모라 처치 (주간 토벌)", 40, (c) => (c.mk.cloakbat || 0) >= 1, "장막을 걷은 자", [["crit", 2]]],
  ["mvp10", "사냥", "선봉장", "보스·수문장 피해 기여도 1위 10번", 30, (c) => c.cnt.mvp >= 10, "선봉장"],
  ["bloomwhale", "사냥", "고래의 장송곡", "모비화 처치 (주간 토벌)", 60, (c) => (c.mk.bloomwhale || 0) >= 1, "고래의 장송곡", [["atkp", 4], ["hp", 4]]],
  // the retired 균열 침공 (removed by owner order): kept so holders keep the achievement and title; nobody earns them now (gone)
  ["evt1", "사냥", "침공 저지", "균열 침공에 참여", 10, () => false, null, null, 1],
  ["evt10", "사냥", "균열 수호자", "균열 침공 10번 참여", 25, () => false, "균열 수호자", [["def", 3]], 1],
  ["dim1", "사냥", "차원의 틈", "레이드던전 정화", 10, (c) => dimCnt(c).dim >= 1],
  ["dim10", "사냥", "차원 탐험가", "레이드던전 10번 정화", 25, (c) => dimCnt(c).dim >= 10, "차원 탐험가", [["mf", 5]]],
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
  // 일일 아르바이트 (66-alba.js): stamps are the best scores against each game's cut-offs
  ["alba1", "생활", "첫 아르바이트", "일일 아르바이트에서 C 등급 이상 받기", 5, (c) => albaStamps(c, 1) >= 1],
  ["albaS1", "생활", "알바 에이스", "일일 아르바이트 하나에서 S 등급 받기", 10, (c) => albaStamps(c, 4) >= 1],
  ["albaS6", "생활", "알바의 달인", "일일 아르바이트 여섯 종에서 S 등급 받기", 20, (c) => albaStamps(c, 4) >= 6, "알바의 달인"],
  ["albaSall", "생활", "만능 알바생", "일일 아르바이트의 모든 종류에서 S 등급 받기", 40, (c) => albaStamps(c, 4) >= ALBA_ORDER.length, "만능 알바생", [["gold", 5]]],
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
  ["rune_find", "장비", "룬 수집가", "세트 룬 획득", 10, (c) => c.cnt.rune_find >= 1],
  ["enh7", "장비", "강화의 손길", "장비 +7 강화 성공", 10, (c) => c.cnt.enh >= 7],
  ["enh10", "장비", "명장", "장비 +10 강화 성공", 30, (c) => c.cnt.enh >= 10, "명장", [["def", 4]]],
  ["rune_bond", "장비", "새겨진 맹세", "세트 룬 효과 처음 발동", 10, (c) => c.cnt.rune_bond >= 1],
  ["party100", "함께", "함께하는 사냥", "파티로 몬스터 100마리 처치", 10, (c) => c.cnt.party >= 100, "동료"],
  ["guild", "함께", "길드원", "길드 가입", 5, (c) => !!c.guild],
  ["gfound", "함께", "길드장", "길드 창설", 10, (c) => c.cnt.gfound >= 1, "길드장"],
  // (ids from the 50-level days; holders keep them)
  ["lv10", "성장", "견습 모험가", "레벨 40 달성", 5, (c) => c.lvl >= 40],
  ["lv30", "성장", "베테랑 모험가", "레벨 120 달성", 15, (c) => c.lvl >= 120, "베테랑"],
  ["lv50", "성장", "전설의 모험가", "레벨 200 달성", 40, (c) => c.lvl >= 200, "전설의 모험가", [["hp", 80]]],
  ["job1", "성장", "첫 전직", "전직관 아르센에게서 전직하기", 10, (c) => c.job !== "adventurer"],
  ["job2", "성장", "두 번째 길", "직업 레벨 30 달성 또는 두 개 이상의 직업 경험하기", 20, (c) => (c.jp?.lv || 0) >= 30 || Object.keys(c.jobs || {}).length >= 2],
  ["daily1", "성장", "성실한 하루", "토벌 의뢰 보상 상자 받기", 5, (c) => c.cnt.daily >= 1],
  ["daily30", "성장", "성실한 모험가", "토벌 의뢰 보상 상자 30번 받기", 20, (c) => c.cnt.daily >= 30, "성실한 모험가", [["gold", 10]]],
].map(([id, cat, name, desc, pts, test, title, bonus, gone]) => ({ id, cat, name, desc, pts, test, title: title || null, bonus: bonus || null, gone: !!gone }));
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
const REGION_BONUS = { meadow: [["hp", 20]], forest: [["xp", 2]], crypt: [["def", 2]], city: [["crit", 1]], sewer: [["mf", 5]], cave: [["atk", 3]], abyss: [["atkp", 2]], maple: [["hp", 60], ["mf", 4]], frostkeep: [["def", 3], ["hp", 40]], jianmen: [["atkp", 2], ["crit", 1]], sanctum: [["mf", 5], ["hp", 50]] };
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

// ── first steps: a short tutorial chain beside the main quests
const TUT = [
  { id: "talk", title: "관리자에게 말 걸기", hint: "광장 분수 앞의 관리자 엘더윈에게 다가가 F를 누르세요. 첫 의뢰를 맡겨 줍니다.", reward: { gold: 20 } },
  { id: "equip", title: "무기 받기", hint: "수련관 카이에게 F로 말을 걸어 무기를 하나 받으세요. 받은 무기를 바로 손에 듭니다.", reward: { gold: 20 } },
  { id: "bag", title: "가방 열기", hint: "I를 눌러 가방을 열어 보세요.", reward: { gold: 20 } },
  { id: "buy", title: "물약 사기", hint: "보급상 리나에게 F로 말을 걸고 빨간 물약을 사 보세요.", reward: { gold: 40 } },
  { id: "hunt", title: "토비또 3마리 처치", hint: "동쪽 문으로 나가 바람초원에서 토비또를 잡으세요. X로 공격, R로 자동 사냥.", need: 3, reward: { gold: 60 } },
  { id: "rest", title: "모닥불에서 쉬기", hint: "모닥불 곁에서 Z로 앉아 잠시 쉬면 체력이 빨리 차고 경험치 보너스를 얻습니다.", reward: { gold: 40 } },
  { id: "skill", title: "스킬 써 보기", hint: "든 무기의 첫 스킬은 숙련 1부터 단축칸 1번에 있습니다. 몬스터 곁에서 1을 눌러 써 보세요.", reward: { gold: 100, items: [["camp", 1], ["recall", 2], ["pet_chick", 1]] } },
  // appended (the index is persisted): spending experience on a stat point
  { id: "level", title: "첫 레벨업", hint: "사냥과 의뢰로 경험치를 모아 레벨 2에 도달하세요. 받은 능력치 포인트는 C 창에서 투자할 수 있습니다.", reward: { gold: 50 } },
];
/** Is tutorial step `id` already done by what the sheet shows? (a step that becomes current then completes at once) */
function tutDone(ch, id) {
  if (id === "equip") return !!(ch.eq.weapon && ch.sw);
  if (id === "level") return ch.lvl >= 2;
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

