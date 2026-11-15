// ───────────────────────────── 보스전리품 (boss trophies) and the solo story fight ─────────────────────────────
// docs/design/boss-trophies.md. Every hunting ground's field boss (FIELD_BOSS) stands at its spot (fbHome) and is back
// FB_RESP after it falls. Each kind has one trophy with a fixed effect; every trophy held works at once (no slots),
// the sums capped by TROPHY_CAP. A trophy is won for sure by clearing the boss's story fight — the main chain's
// "defeat <boss>" quest (QUESTS `fb: 1`) pulls its holder, alone, into a private arena (a "dim:" instance, not a rift:
// no `prog`, so dimTick leaves it alone) with a weaker copy of the boss — or at TROPHY_P by a share of the real kill.
// A trophy already held pays TROPHY_GOLD × the boss's level instead.
// Sheet (v17): ch.tro = [kind…]. Wire: self.tro (with `dirty`), defs.trophies { list, cap, p, gold, story }.

/** Effects in whole percent: gold, xp, move (speed), aspd (attack speed), drop (magic find), hp (max HP), crit (chance, points). */
const TROPHIES = {
  lambmaw: { name: "뒤집힌 양털", fx: { xp: 2 } },
  ribdeer: { name: "갈비뼈 사슴뿔", fx: { move: 2 } },
  toadbrood: { name: "두꺼비 알주머니", fx: { hp: 2 } },
  doghead: { name: "세 머리 들개 송곳니", fx: { aspd: 2 } },
  crabskull: { name: "두개골 게딱지", fx: { gold: 3 } },
  moleworm: { name: "눈먼 두더지 발톱", fx: { drop: 3 } },
  loggator: { name: "악어 통나무 비늘", fx: { hp: 3 } },
  coralturtle: { name: "산호 뿔 조각", fx: { move: 3 } },
  mummycamel: { name: "미라 낙타 붕대", fx: { gold: 4 } },
  lionhand: { name: "손갈기 사자 갈기", fx: { xp: 4 } },
  bearmaw_ash: { name: "종지기 곰의 종", fx: { aspd: 4 } },
  sandmaw: { name: "모래 아가리 이빨", fx: { drop: 4 } },
  crownpeacock: { name: "금관 공작 깃", fx: { crit: 2, gold: 2 } },
  rotstag: { name: "썩은 사슴왕의 관", fx: { xp: 3, crit: 3 } },
  // the coast's field boss since bosses-2 (coralturtle's trophy stays: sheets may hold it)
  clubshrimp: { name: "공동 갯가재 눈자루", fx: { aspd: 3, hp: 2 } },
};
const TROPHY_CAP = { gold: 8, xp: 8, move: 5, aspd: 5, drop: 6, hp: 5, crit: 4 };
const TROPHY_P = 0.05, TROPHY_GOLD = 40;
/**
 * The story fight: the copy takes `hp` of a field boss's damage-scaled health (mob.hk: blows count 1/hp more) and
 * hits `atk` as hard (mob.ak); no traits. `r` tiles from the boss's spot pull the quest holder in; `limit` ms to win;
 * `endMs` after the win (loot to pick up) or a fall before the hero is back where they stepped in.
 * Measured with a solo bot at the quest's level in tests/trophies.mjs.
 */
const STORY = { hp: 0.5, atk: 0.6, r: 4, limit: 600000, endMs: 6000, failMs: 1500 };

/** The sums of every trophy held, each capped (deriveStats). */
function trophySum(ch) {
  const out = { gold: 0, xp: 0, move: 0, aspd: 0, drop: 0, hp: 0, crit: 0 };
  for (const k of ch.tro || []) for (const [e, v] of Object.entries(TROPHIES[k].fx)) out[e] += v;
  for (const e of Object.keys(out)) out[e] = Math.min(TROPHY_CAP[e], out[e]);
  return out;
}
/** `p` wins kind `k`'s trophy — or, holding it already, its worth in gold. */
function grantTrophy(S, p, k) {
  const ch = p.ch, T0 = TROPHIES[k];
  if (!T0) return;
  if (ch.tro.includes(k)) {
    const g = TROPHY_GOLD * MOBS[k].lv;
    ch.gold += g; p.gain.push(["gold", g]);
    toast(p, `이미 가진 보스전리품 [${T0.name}]${pp(T0.name, "은는")} ${g}G로 바뀌었습니다.`);
  } else {
    ch.tro.push(k);
    p.stc = null;
    const fx = Object.entries(T0.fx).map(([e, v]) => `${TROPHY_FX[e]} +${v}%`).join(", ");
    toast(p, `보스전리품 [${T0.name}] 획득! ${fx}`);
    sys(S, `${ch.name}님이 보스전리품 [${T0.name}]${pp(T0.name, "을를")} 얻었습니다!`);
  }
  p.dirty = true;
  saveSoon(p);
}
const TROPHY_FX = { gold: "골드", xp: "경험치", move: "이동 속도", aspd: "공격 속도", drop: "아이템 발견", hp: "최대 HP", crit: "치명타" };
/** A real field boss down: each sharer without its trophy may find it (TROPHY_P). */
function fbTrophy(S, looters, k) {
  if (!TROPHIES[k]) return;
  for (const p of looters) if (!p.ch.tro.includes(k) && rnd(S) < TROPHY_P) grantTrophy(S, p, k);
}

// ── a hunting ground's field boss: at its spot, back after FB_RESP; its quest's holder stepping near goes in alone

/** The main quest's boss in hand (accepted, not yet beaten), or "". */
function storyQuest(ch) {
  const q = ch.q, Q = QUESTS[q.i];
  return q.st === 1 && Q && Q.fb && q.n < Q.n ? Q.mob : "";
}
/** Each tick of a hunting ground someone stands in (80-simulation.js). */
function fbTick(S, rt, now) {
  const k = FIELD_BOSS[rt.id];
  if (!k) return;
  if (!rt.fb && now >= rt.fbAt) spawnFieldBoss(S, rt);
  const [hx, hy] = fbHome(S, rt), x = hx * T + 8, y = hy * T + 10;
  for (const pid of Object.keys(S.players)) {
    const p = S.players[pid];
    if (p.map !== rt.id || p.dead) continue;
    // back from a try: step out of the ring first, then in again to retry
    if (dist(p.x, p.y, x, y) > STORY.r * T) { p.storyBack = 0; continue; }
    if (!p.storyBack && storyQuest(p.ch) === k) storyStart(S, p, rt);
  }
}
/** `p` alone into a fresh arena with the weaker copy of the ground's boss. */
function storyStart(S, p, rt) {
  p.storyBack = 1;
  if (Object.keys(S.dims).length >= DIM.max) { toast(p, "지금은 도전할 자리가 없습니다. 잠시 뒤 다시 다가가세요."); return; }
  const k = FIELD_BOSS[rt.id], src = mapOfS(S, rt.id);
  S.dimN = (S.dimN | 0) + 1;
  const id = "dim:" + S.dimN, seed = Math.imul(S.seed ^ S.nextId++, 2654435761) | 0;
  const map = dimArena({ id, seed, k, theme: src.theme || "meadow", name: `${MOBS[k].name}의 자리` });
  const dim = registerDim(S, { id, map, seed, lv: MOBS[k].lv, theme: map.theme, expire: S.now + STORY.limit });
  dim.story = { pid: p.pid, k, from: [rt.id, p.x, p.y], endAt: 0, won: 0, deadAt: 0 };
  const [tx, ty] = map.dim.boss, mob = newMob(S, k, [tx, ty, tx, ty]);
  mob.el = 2; mob.temp = true; mob.story = 1; mob.tr = [];
  mob.hk = STORY.hp; mob.ak = STORY.atk;
  mob.x = mob.hx = mob.wx = tx * T + 8; mob.y = mob.hy = mob.wy = ty * T + 10;
  mob.hp = mobMax(mob);
  mob.castAt = S.now + 4000; mob.stun = S.now + FB_WARN;
  dim.rt.mobs.push(mob);
  dim.boss = mob.id;
  const [sx, sy] = tilePx(map.dim.start);
  changeMap(S, p, id, sx, sy);
  dim.rt.ev.push(["dm", "open", sx, sy]);
  toast(p, `[홀로 도전] ${MOBS[k].name} — ${STORY.limit / 60000}분 안에 쓰러뜨리세요. 쓰러지거나 [떠나기]로 나가도 다시 도전할 수 있습니다.`);
  p.dirty = true;
}
/** The copy down: the trophy, the quest done (its reward paid here), home in STORY.endMs. */
function storyClear(S, rt, mob) {
  const dim = dimAt(S, rt.id), st = dim && dim.story, p = st && S.players[st.pid];
  if (!st || st.won) return;
  st.won = 1; st.endAt = S.now + STORY.endMs;
  if (!p || p.map !== rt.id) return;
  const ch = p.ch, Q = QUESTS[ch.q.i];
  grantTrophy(S, p, mob.k);
  if (Q && Q.fb && Q.mob === mob.k && ch.q.st === 1) {
    ch.gold += Q.gold; p.gain.push(["gold", Q.gold]);
    for (const [id, n] of Q.items) { addItem(ch, id, n); p.gain.push(["item", id, n, 0]); }
    ch.q = { i: ch.q.i + 1, n: 0, st: 0 };
    toast(p, `의뢰 완료: ${Q.title}`);
    gainXp(S, p, Q.xp);
  }
  toast(p, `${MOBS[mob.k].name}${pp(MOBS[mob.k].name, "을를")} 쓰러뜨렸습니다! 잠시 뒤 원래 자리로 돌아갑니다.`);
  p.dirty = true;
}
/** Out of the arena, on their feet, where they stepped in (a fall there costs nothing); the arena closes. */
function storyHome(S, p, why) {
  const dim = dimAt(S, p.map), st = dim && dim.story;
  if (!st) return;
  const [map, x, y] = st.from;
  if (p.dead) { p.dead = false; const s = stats(p); p.hp = Math.round(s.mhp * 0.5); p.mp = Math.max(p.mp, Math.round(s.mmp * 0.5)); }
  p.storyBack = 1;
  changeMap(S, p, map, x, y);
  if (why) toast(p, why);
  p.dirty = true;
  closeDim(S, dim.id);
}
/** Every tick: each story arena — its hero gone, fallen, out of time, or done. */
function storyTick(S, now) {
  for (const id of Object.keys(S.dims)) {
    const dim = S.dims[id], st = dim.story;
    if (!st) continue;
    const p = S.players[st.pid];
    if (!p || p.map !== id) { closeDim(S, id); continue; }
    if (st.won) { if (now >= st.endAt) storyHome(S, p, "원래 자리로 돌아왔습니다."); continue; }
    if (p.dead) { if (!st.deadAt) st.deadAt = now; else if (now - st.deadAt >= STORY.failMs) storyHome(S, p, "쓰러졌습니다… 다시 그 자리로 다가가면 재도전할 수 있습니다."); continue; }
    if (now >= dim.expire) storyHome(S, p, "시간이 다 되었습니다. 다시 그 자리로 다가가면 재도전할 수 있습니다.");
  }
}
/** defs().trophies: the table, the caps, the field chance, the duplicate's gold per boss level, the story's numbers. */
/** (migrate, sheets before v17) an old main-chain index → the same errand's index now (the boss quests went in between). */
function questV17(i) {
  const old = QUESTS.map((q, j) => (q.fb ? -1 : j)).filter((j) => j >= 0);
  return i < old.length ? old[i] : QUESTS.length;
}
const trophyDefs = () => ({ list: TROPHIES, cap: TROPHY_CAP, p: TROPHY_P, gold: TROPHY_GOLD, story: { r: STORY.r, limit: STORY.limit } });
