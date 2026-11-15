// Oasis main chapter: a private rescue gives the character access to the shared deck.
const AIRSHIP_QUEST = "sq_airship_rescue";
const AIRSHIP_BOSS = "airship_lookout";
const AIRSHIP_FLOCK = [[15, 16], [22, 12], [27, 19], [34, 15]];
const AIRSHIP_BACK = ["oasis", 12 * T + 8, 64 * T + 10];
const AIRSHIP_DECK = [AIRSHIP_MAP, 9 * T + 8, 16 * T + 10];
const AIRSHIP_LIMIT = 480000;
const AIRSHIP_VICTORY_MS = 3200;

function airshipCleared(ch) {
  return !!ch.sq?.done?.[AIRSHIP_QUEST];
}

function airshipAccess(ch, id) {
  if (id !== AIRSHIP_MAP) return "";
  if (ch.lvl < AIRSHIP_MIN_LV) return mapLevelMessage(AIRSHIP_MIN_LV);
  return airshipCleared(ch) ? "" : "긴급 구조 의뢰를 마치면 바람등호에 오를 수 있습니다.";
}

function airshipMob(S, rt, kind, [tx, ty]) {
  const mob = newMob(S, kind, [tx, ty, tx, ty]);
  mob.temp = true;
  mob.airship = true;
  mob.x = mob.hx = mob.wx = tx * T + 8;
  mob.y = mob.hy = mob.wy = ty * T + 10;
  mob.hp = mobMax(mob);
  mob.castAt = S.now + 1700;
  rt.mobs.push(mob);
  rt.ev.push(["r", mob.id]);
  return mob;
}

/** Only the physical Oasis boarding gate uses this transition before rescue. */
function airshipBoard(S, p) {
  if (p.dead || p.map !== AIRSHIP_BACK[0]) return;
  const ch = p.ch;
  let blocked = "";
  if (ch.lvl < AIRSHIP_MIN_LV) blocked = mapLevelMessage(AIRSHIP_MIN_LV);
  else if (!Object.hasOwn(ch.sq.on, AIRSHIP_QUEST)) blocked = "오아시스 신호 담당에게 먼저 긴급 구조 의뢰를 받으세요.";
  else if (Object.keys(S.dims).length >= DIM.max) blocked = "지금은 승선할 수 없습니다. 잠시 뒤 다시 다가가세요.";
  if (blocked) {
    if (S.now >= (p.gateHintAt || 0)) {
      toast(p, blocked);
      p.gateHintAt = S.now + 1500;
    }
    return;
  }
  const deck = mapOf(AIRSHIP_MAP);
  // Geometry and scenery stay shared. The rescue has its own gates, services and encounter state.
  const map = {
    ...deck, name: "바람등호 · 긴급 구조", safe: false, npcs: [], portals: [], spawns: [], cells: null, camps: [],
    marks: (deck.marks || []).filter((mark) => mark.kind !== "waypoint"),
  };
  const id = "dim:" + (S.dimN = (S.dimN | 0) + 1);
  const seed = Math.imul(S.seed ^ S.nextId++, 2654435761) | 0;
  const dim = registerDim(S, { id, map, seed, lv: MOBS[AIRSHIP_BOSS].lv, theme: map.theme, expire: S.now + AIRSHIP_LIMIT });
  dim.story = { pid: p.pid, k: AIRSHIP_BOSS, airship: true, remaining: AIRSHIP_FLOCK.length, from: AIRSHIP_BACK, endAt: 0, won: 0, deadAt: 0 };
  for (const at of AIRSHIP_FLOCK) airshipMob(S, dim.rt, "airship_gale", at);
  changeMap(S, p, id, AIRSHIP_DECK[1], AIRSHIP_DECK[2]);
  toast(p, "구조 신호를 따라 승선했습니다. 갑판의 감염 조류 네 마리를 먼저 몰아내세요.");
  p.dirty = true;
  saveSoon(p);
}

/** These enemies feed the encounter alone, so restarting a rescue pays no combat rewards. */
function airshipKill(S, rt, mob) {
  const dim = dimAt(S, rt.id), st = dim?.story;
  const p = st && S.players[st.pid], hit = st && mob.by[st.pid] > 0;
  mob.by = {};
  if (!st?.airship || st.won || !p || p.dead || p.map !== rt.id || !hit) return;
  if (mob.airship && mob.k === "airship_gale" && st.remaining > 0) {
    st.remaining--;
    if (st.remaining === 0) {
      dim.boss = airshipMob(S, rt, AIRSHIP_BOSS, [40, 18]).id;
      toast(p, "감염된 정찰대장이 선수에 내려앉았습니다. 정찰대장을 쓰러뜨려 바람등호를 구하세요!");
    }
    return;
  }
  if (mob.id !== dim.boss || st.remaining || !Object.hasOwn(p.ch.sq.on, AIRSHIP_QUEST)) return;
  const quest = SQ_BY[AIRSHIP_QUEST];
  p.ch.sq.on[AIRSHIP_QUEST] = quest.goal.n;
  sqApply(S, p, { a: "done", id: AIRSHIP_QUEST });
  st.won = 1;
  st.endAt = S.now + AIRSHIP_VICTORY_MS;
  toast(p, "바람등호를 해방했습니다! 이제 오아시스 승선문에서 갑판을 다시 찾을 수 있습니다.");
  saveSoon(p);
}

// Runtime instances never persist. An unfinished rescue wakes at the Oasis boarding post.
function airshipReturn(st) {
  return st.won ? AIRSHIP_DECK : st.from;
}
