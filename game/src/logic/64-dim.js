// ───────────────────────────── 차원 균열: the instance manager ─────────────────────────────
// docs/design/scale-and-rift.md D. A party's leader opens a rift at the town's obelisk; everyone of
// the party in town is asked (a ready check, 20 s); those who accept go in together. Inside: a
// gauge fills with kills (elites, and the orbs they drop, count for more), shrines left by elites
// lend the party a buff, at 100% the master walks in beside the party; its death leaves a chest
// (each member's own reward, once) and a way home. 15 minutes from the open, or a wipe, and it
// fails. Nobody inside for 20 s, and it is gone. Never saved: a player saved inside wakes in town.
// The map comes from dimension() (31-maps-dim.js); the world keeps it in S.dims (registerDim).

/** Achievement counters live in `ch.cnt` (jobs-and-stats J1 moved them from `ch.st`): every rift counter goes through here. */
const dimCnt = (ch) => ch.cnt;
/** The world tier an instance is made for, from the highest player level going in (toTier; shown as 4·tier − 3). */
const dimLvOf = (ps) => clamp(Math.floor(toTier(Math.max(...ps.map((o) => o.ch.lvl)))), 10, TIER_MAX - 1);
/** How much tougher a monster of level `mlv` is made for a party of `n` at level `lv` (taken off the blows it takes; DIM in 31-maps-dim.js). */
function dimHk(n, lv, mlv) {
  const [mid, width, trim] = DIM.hpMid;
  const low = DIM.hpLow[1] * Math.max(0, DIM.hpLow[0] - lv);
  const middle = trim * Math.max(0, 1 - Math.abs(lv - mid) / width);
  return (DIM.hpBase + low + middle) * DIM.hpN[clamp(n, 1, DIM.party) - 1] * (1 + DIM.lvK * Math.max(0, lv - 1 - mlv));
}

/** A sheet's rift record made whole (newChar, migrate): today's count, unlocked tier `t`, best tier and its time, the week's brackets `wb` and boss flags `bw`. */
function dimClean(d) {
  const o = isObj(d) ? d : {}, best = clamp(o.best | 0, 0, DIM_TIER.max);
  return {
    day: Math.max(0, o.day | 0), n: clamp(o.n | 0, 0, 999), t: clamp(o.t | 0, 1, Math.min(DIM_TIER.max, best + 1)), best, ms: best ? clamp(o.ms | 0, 0, DIM.limit) : 0,
    wk: Math.max(0, o.wk | 0), wb: clamp(o.wb | 0, 0, DIM_TIER.weekly.max), bw: clamp(o.bw | 0, 0, (1 << CHAL_KEYS.length) - 1),
  };
}
/** The record brought to today and to this week (a new day clears the count; a new week the brackets and boss flags). */
function dimRec(ch, now) {
  const d = ch.dim, day = dayOf(now), wk = weekOf(now);
  if (d.day !== day) { d.day = day; d.n = 0; }
  if (d.wk !== wk) { d.wk = wk; d.wb = 0; d.bw = 0; }
  return d;
}
/** What a leader asked for (`dim_open`), made safe: a boss challenge has no tier. */
const dimAsk = (a) => (a && a.boss ? { tier: 0, boss: a.boss } : { tier: (a && a.tier) | 0 || 1, boss: "" });
/** The highest tier every one of `ps` has unlocked. */
const dimTierCap = (ps) => Math.min(...ps.map((o) => o.ch.dim.t));
/** Why `o` may not go into what was asked ("" when they may): the tier not unlocked, the level short of the boss. */
function dimBar(o, ask) {
  if (ask.boss) return o.ch.lvl < chalMinLv(ask.boss) ? `보스 도전은 Lv.${chalMinLv(ask.boss)}부터 참가할 수 있습니다.` : "";
  return o.ch.dim.t < ask.tier ? `아직 균열 ${ask.tier}단을 열지 못했습니다. (해금 ${o.ch.dim.t}단)` : "";
}
/** What is being opened, in words. */
const dimWhat = (ask) => (ask.boss ? `보스 도전 [${MOBS[ask.boss].name}]` : ask.tier > 1 ? `차원 균열 ${ask.tier}단` : "차원 균열");

const inDim = (p) => typeof p.map === "string" && p.map.startsWith("dim:");
const dimAt = (S, id) => (S.dims && Object.hasOwn(S.dims, id) ? S.dims[id] : null);
const tilePx = ([x, y]) => [x * T + 8, y * T + 10];
/** Close enough to the town's obelisk (or its keeper) to use it. */
function obeliskNear(p) {
  if (p.map !== START.map) return false;
  const [ox, oy] = tilePx(DIM_TOWN.ob), [kx, ky] = tilePx(DIM_TOWN.keeper);
  return dist(p.x, p.y, ox, oy) <= DIM.near || dist(p.x, p.y, kx, ky) <= DIM.near;
}
/** Everyone standing inside instance `id`. */
const dimInside = (S, id) => Object.keys(S.players).map((pid) => S.players[pid]).filter((o) => o.map === id);
/** A free spot in the start room for the `i`-th arrival: a spiral round the room's middle. */
function dimSpot(m, i) {
  const [cx, cy] = m.dim.start;
  let n = 0;
  for (let r = 0; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy;
    if (!m.reach[y * m.w + x] || (Math.abs(x - m.dim.door[0]) <= 1 && Math.abs(y - m.dim.door[1]) <= 1)) continue;
    if (n++ === i % 9) return [x * T + 8, y * T + 10];
  }
  return tilePx(m.dim.start);
}

// ── the ready check

/** Open a rift: alone at once; with a party, ask everyone of it who is in town. */
function dimOpen(S, p, a) {
  const party = S.parties[p.party], ask = dimAsk(a);
  if (!party) { dimStart(S, [p], 0, ask); return; }
  const rc = { id: S.nextId++, leader: p.pid, until: S.now + DIM.rcMs, resp: {}, tier: ask.tier, boss: ask.boss };
  // 0 asked, 1 yes, 2 no (or no answer in time), 3 not in town (or barred: the tier not unlocked, the level short)
  for (const pid of party.m) {
    const o = S.players[pid], bar = o && pid !== p.pid && o.map === START.map ? dimBar(o, ask) : "";
    rc.resp[pid] = pid === p.pid ? 1 : o && o.map === START.map && !bar ? 0 : 3;
    if (bar) toast(o, bar);
  }
  party.rc = rc;
  for (const pid of party.m) { const o = S.players[pid]; if (o && pid !== p.pid && rc.resp[pid] === 0) toast(o, `${p.ch.name}님이 ${dimWhat(ask)}${pp(dimWhat(ask), "을를")} 열려고 합니다. 입장을 수락하시겠습니까?`); }
  rcCheck(S, party);
}
function rcEnd(S, party, why) {
  const rc = party.rc;
  party.rc = null;
  if (why) for (const pid of Object.keys(rc.resp)) { const o = S.players[pid]; if (o) toast(o, why); }
}
/** A ready check's every tick: the party as it is now, answers in, time up — then go in, or not. */
function rcCheck(S, party) {
  const rc = party.rc;
  for (const pid of Object.keys(rc.resp)) if (!party.m.includes(pid) || !S.players[pid]) delete rc.resp[pid];
  // the leader gone, or no longer leading: nothing happens
  if (party.m[0] !== rc.leader || !S.players[rc.leader]) { rcEnd(S, party, "파티장이 자리를 비워 차원 균열 준비가 취소되었습니다."); return; }
  const timeUp = S.now >= rc.until;
  for (const pid of Object.keys(rc.resp)) {
    const o = S.players[pid];
    if (rc.resp[pid] === 0 && o.map !== START.map) rc.resp[pid] = 3;
    if (rc.resp[pid] === 1 && o.map !== START.map) rc.resp[pid] = 3;
    if (rc.resp[pid] === 0 && timeUp) { rc.resp[pid] = 2; toast(o, "차원 균열 입장 준비 시간이 지났습니다. 나중에 오벨리스크에서 합류할 수 있습니다."); }
  }
  if (Object.values(rc.resp).includes(0)) return;
  const go = Object.keys(rc.resp).filter((pid) => rc.resp[pid] === 1).map((pid) => S.players[pid]);
  party.rc = null;
  if (!go.length) return;
  const dim = dimStart(S, go, party.id, { tier: rc.tier, boss: rc.boss });
  if (!dim) return;
  for (const pid of party.m) {
    const o = S.players[pid];
    if (o && !go.includes(o)) toast(o, "일행이 차원 균열에 들어갔습니다. 오벨리스크에서 [합류]할 수 있습니다.");
  }
}

// ── an instance's life

/** Make an instance for `ps` (all in town) and take them in. Null when every slot of the room is taken. */
function dimStart(S, ps, partyId, ask) {
  const open = Object.keys(S.dims).length;
  if (open >= DIM.max) { for (const o of ps) toast(o, `차원 균열이 모두 사용 중입니다 (${open}/${DIM.max}).`); return null; }
  // a boss challenge (no tier), or a rift at the asked tier — never above what everyone going in has unlocked
  const boss = ask && ask.boss && Object.hasOwn(DIM_CHAL.bosses, ask.boss) ? ask.boss : "";
  const tier = boss ? 0 : clamp(Math.min((ask && ask.tier) | 0 || 1, dimTierCap(ps)), 1, DIM_TIER.max);
  const tk = dimTierK(tier || 1);
  const lv = boss ? Math.max(MOBS[boss].lv, dimLvOf(ps)) : dimLvOf(ps);
  S.dimN = (S.dimN | 0) + 1;
  const id = "dim:" + S.dimN;
  const seed = (Math.imul(S.seed ^ S.nextId++, 2654435761) ^ Math.imul(partyId + 1, 40503) ^ Math.floor(S.now / 1024)) | 0;
  const theme = boss ? DIM_CHAL.bosses[boss].theme : dimTheme(seed >>> 0, lv);
  const map = boss ? dimArena({ id, seed, k: boss }) : dimension({ id, seed, theme, lv });
  const dim = registerDim(S, { id, map, party: partyId, seed, lv, theme, expire: S.now + (boss ? DIM_CHAL.limit : DIM.limit) });
  Object.assign(dim, { prog: 0, boss: 0, n: ps.length, members: {}, hit: {}, got: {}, pylons: [], orbs: [], portal: null, chest: null, elites: 0, emptyAt: 0, endAt: 0, warned: false, kills: 0, opened: S.now, bossAt: 0, clearAt: 0 });
  // the ladder: the tier and what it does, the best hero going in (the carry guard), damage dealt, who was carried, each one's result flags
  Object.assign(dim, { tier, tk, top: Math.max(...ps.map((o) => toTier(o.ch.lvl))), dmg: {}, carry: {}, res: {}, chal: null });
  // from tier 4 on, the leader of one more pack (the last packs listed) is an elite every DIM_TIER.eliteEvery tiers
  const packs = map.dim.spawns.filter((sp) => !sp.el && !sp.chest);
  const lead = new Set(packs.slice(packs.length - Math.min(packs.length, tk.elites)));
  // a layout with few monsters fills the gauge faster, so a full clear always gives about DIM.full (no rift can stall short of 100%)
  const normalN = packs.reduce((n, sp) => n + sp.n, 0) - lead.size;
  dim.gK = boss ? 1 : Math.max(1, DIM.full / (normalN * DIM.normal + (map.dim.elites + lead.size) * (DIM.elite + DIM.orb)));
  if (partyId && S.parties[partyId]) S.parties[partyId].dim = id;
  const rt = dim.rt;
  for (const sp of map.dim.spawns) {
    for (let i = 0; i < sp.n; i++) {
      const mob = newMob(S, sp.k, [sp.at[0], sp.at[1], sp.at[0], sp.at[1]], { el: sp.el || (i === 0 && lead.has(sp) ? 1 : 0), elite: 0 });
      dimPlace(S, map, mob, sp.at, sp.chest ? 0 : 2);
      mob.temp = true; mob.dim = 1;
      if (sp.guard) mob.guard = 1;
      if (!sp.chest) mob.hk = dimHk(ps.length, lv, MOBS[sp.k].lv) * tk.hp;
      if (tk.atk > 1) mob.ak = tk.atk;
      if (mob.el === 1 && tk.traits > 1) mob.tr = rollTraits(S, tk.traits);
      rt.mobs.push(mob);
    }
  }
  if (boss) chalSpawn(S, dim, boss, ps.length);
  ps.forEach((o, i) => {
    o.dead = false;
    const [x, y] = dimSpot(map, i);
    changeMap(S, o, id, x, y);
    dim.members[o.pid] = S.now;
    toast(o, boss ? `[보스 도전] ${MOBS[boss].name} — ${DIM_CHAL.limit / 60000}분 안에 쓰러뜨리세요. 전멸해도 다시 도전할 수 있습니다.`
      : `[${DIM_THEMES[theme].name}] 차원 균열 Lv.${shownLv(lv)}${tier > 1 ? ` ${tier}단` : ""}에 들어왔습니다. 15분 안에 균열을 정화하세요!`);
    o.dirty = true;
  });
  rt.ev.push(["dm", "open", ...tilePx(map.dim.start)]);
  return dim;
}
/** A monster put down at an open tile within `r` tiles of `at` (the pack's place), else on `at` itself. */
function dimPlace(S, m, mob, at, r) {
  let x = at[0], y = at[1];
  for (let i = 0; i < 12 && r > 0; i++) {
    const tx = at[0] + ri(S, -r, r), ty = at[1] + ri(S, -r, r);
    if (tx > 1 && ty > 1 && tx < m.w - 2 && ty < m.h - 2 && m.reach[ty * m.w + tx]) { x = tx; y = ty; break; }
  }
  mob.x = mob.hx = x * T + 8; mob.y = mob.hy = y * T + 10;
  readyMob(S, mob);
}
const dimProg = (dim, v) => { dim.prog = Math.min(100, dim.prog + v * dim.gK); };
/** A monster of an instance died (killMob): the gauge, an elite's orb and maybe a shrine, the master's fall. */
function dimKill(S, rt, mob, looters) {
  const dim = dimAt(S, rt.id);
  if (!dim) return;
  for (const p of looters) dim.hit[p.pid] = 1;
  if (mob.id === dim.boss) { dimClear(S, dim, mob); return; }
  const d = MOBS[mob.k];
  if (d.chest || dim.state !== "run") return;
  dim.kills++;
  if (mob.el) {
    dim.elites++;
    dimProg(dim, DIM.elite);
    dim.orbs.push({ id: S.nextId++, x: Math.round(mob.x), y: Math.round(mob.y), until: S.now + DIM.orbMs });
    const alive = new Set(dim.pylons.map((s) => s.kind));
    const kinds = Object.keys(DIM.pylons).filter((k) => !alive.has(k));
    if (kinds.length && (dim.elites === 3 || dim.elites === 6 || rnd(S) < DIM.shrineP)) {
      const at = freeTile(dim.map, Math.floor(mob.x / T) + 1, Math.floor(mob.y / T)) || [Math.floor(mob.x / T), Math.floor(mob.y / T)];
      dim.pylons.push({ id: S.nextId++, kind: kinds[ri(S, 0, kinds.length - 1)], x: at[0] * T + 8, y: at[1] * T + 10, until: S.now + DIM.shrineMs });
    }
  } else dimProg(dim, DIM.normal);
  if (dim.prog >= 100) dimBoss(S, dim);
}
/** 100%: whatever still roams dissolves, and the master walks in beside the party (or waits in its hall when they are there). */
function dimBoss(S, dim) {
  const rt = dim.rt, m = dim.map, now = S.now;
  dim.state = "boss"; dim.bossAt = now;
  dim.orbs = [];
  for (const mob of rt.mobs) {
    if (mob.dead || !mob.dim || mob.guard || MOBS[mob.k].chest) continue;
    mob.dead = true;
    rt.ev.push(["dz", mob.id, Math.round(mob.x), Math.round(mob.y)]);
  }
  const folk = dimInside(S, dim.id).filter((o) => !o.dead);
  const cx = folk.length ? folk.reduce((s, o) => s + o.x, 0) / folk.length : m.dim.start[0] * T + 8;
  const cy = folk.length ? folk.reduce((s, o) => s + o.y, 0) / folk.length : m.dim.start[1] * T + 10;
  const W = m.w, toHall = bfs(W, m.h, m.dim.boss[1] * W + m.dim.boss[0], (i) => m.reach[i] === 1);
  let at = Math.floor(cy / T) * W + Math.floor(cx / T);
  if (toHall[at] < 0) at = m.dim.start[1] * W + m.dim.start[0];
  let anchor = m.dim.boss, away = 4;
  const start = m.dim.start;
  if (toHall[at] >= 10 && Math.hypot(at % W - start[0], Math.floor(at / W) - start[1]) >= 16) {
    // walk ten steps from the party toward the hall: the master comes to meet them
    for (let s = 0; s < 10; s++) {
      const x = at % W, y = Math.floor(at / W);
      for (const [dx, dy] of D4) {
        const n = (y + dy) * W + x + dx;
        if (inMap(m, x + dx, y + dy) && toHall[n] >= 0 && toHall[n] < toHall[at]) { at = n; break; }
      }
    }
    // never on the start room, where the fallen get up again
    if (Math.hypot(at % W - start[0], at / W - start[1]) >= 12) { anchor = [at % W, Math.floor(at / W)]; away = 8; }
  }
  const [tx, ty] = bossSpot(S, m, anchor[0], anchor[1], 0, away);
  const mob = newMob(S, m.dim.bossK, [tx, ty, tx, ty]);
  mob.el = 2; mob.temp = true; mob.dim = 1;
  mob.tr = rollTraits(S, dim.tk.boss);
  mob.x = mob.hx = mob.wx = tx * T + 8; mob.y = mob.hy = mob.wy = ty * T + 10;
  mob.hk = dimHk(dim.n, dim.lv, MOBS[mob.k].lv) * DIM.bossHp * dim.tk.hp;
  mob.ak = DIM.bossAtk * dim.tk.atk;
  mob.hp = mobMax(mob);
  mob.castAt = now + 4000;
  mob.stun = now + FB_WARN;
  rt.mobs.push(mob);
  dim.boss = mob.id;
  rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), 40, FB_WARN], ["r", mob.id], ["dm", "boss", Math.round(mob.x), Math.round(mob.y)]);
  for (const o of dimInside(S, dim.id)) toast(o, `균열이 가득 찼습니다! 균열의 주인 [${MOBS[mob.k].name}]${pp(MOBS[mob.k].name, "이가")} 나타났습니다!`);
}
/** The master is down: a chest for each member who fought, and a way home for 90 s. */
function dimClear(S, dim, mob) {
  const m = dim.map, now = S.now;
  dim.state = "clear"; dim.clearAt = now; dim.endAt = now + DIM.portalMs;
  const tx = Math.floor(mob.x / T), ty = Math.floor(mob.y / T);
  dim.chest = { x: Math.round(mob.x), y: Math.round(mob.y) };
  const pt = freeTile(m, tx + 3, ty) || freeTile(m, tx, ty + 3) || [tx, ty];
  dim.portal = { x: pt[0] * T + 8, y: pt[1] * T + 10 };
  for (const o of dimInside(S, dim.id)) if (dist(o.x, o.y, mob.x, mob.y) <= PARTY_RANGE) dim.hit[o.pid] = 1;
  dim.rt.ev.push(["dp", dim.portal.x, dim.portal.y]);
  const ms = now - dim.opened;
  for (const o of dimInside(S, dim.id)) {
    toast(o, dim.chal ? `${MOBS[mob.k].name}${pp(MOBS[mob.k].name, "을를")} 쓰러뜨렸습니다! 보상 상자를 열고 귀환의 문으로 돌아가세요.` : "차원 균열을 정화했습니다! 보상 상자를 열고 귀환의 문으로 돌아가세요.");
    if (!dim.hit[o.pid]) continue;
    if (!dim.chal) dimCnt(o.ch).dim = (dimCnt(o.ch).dim | 0) + 1;
    // the ladder: a real clear records the tier and opens the next — never for someone carried through it
    if (dimCarried(dim, o)) dim.carry[o.pid] = 1;
    else if (dim.tier) dimRecord(dim, o, ms);
    checkAch(S, o); saveSoon(o);
  }
}
/**
 * Carried through: more than DIM_TIER.carryLv world tiers under the best hero who went in, or (in company) under
 * DIM_TIER.carryShare of an even share of the damage dealt. Reduced reward, no unlock, no record, no weekly bonus.
 */
function dimCarried(dim, p) {
  if (toTier(p.ch.lvl) < dim.top - DIM_TIER.carryLv) return true;
  const pids = Object.keys(dim.hit), all = pids.reduce((s, pid) => s + (dim.dmg[pid] || 0), 0);
  return pids.length > 1 && all > 0 && (dim.dmg[p.pid] || 0) < (all * DIM_TIER.carryShare) / pids.length;
}
/** A clear of tier `dim.tier` on `p`'s sheet: the best tier (and the quickest time at it), the next tier for whoever stood at this one. */
function dimRecord(dim, p, ms) {
  const d = p.ch.dim, n = dim.tier;
  let fl = 0;
  if (n > d.best || (n === d.best && (!d.ms || ms < d.ms))) { d.best = n; d.ms = ms; fl |= 1; }
  if (d.t >= n && d.t < n + 1 && n < DIM_TIER.max) { d.t = n + 1; fl |= 2; toast(p, `균열 ${n + 1}단이 열렸습니다!`); }
  dim.res[p.pid] = fl;
  p.dirty = true;
}
/**
 * The master's chest at rift level `lv`, tier `tier`: what `payout` takes, `rune` a chance. The tier's extra is for
 * the day's full-reward clears only; someone carried gets DIM_TIER.carryK of the gold and experience and no gear.
 */
function dimReward(lv, tier, full, carried) {
  const R = DIM.reward, K = DIM_TIER, t = full && !carried ? Math.max(0, (tier | 0) - 1) : 0, ck = carried ? K.carryK : 1;
  return {
    gold: Math.round(R.gold * lv * Math.min(K.goldMax, 1 + K.gold * t) * ck), stone: R.stone + Math.min(K.stoneMax, Math.floor(t / K.stoneEvery)),
    rune: Math.min(1, R.rune + K.rune * t), gear: carried ? 0 : 1, gearQ: R.gearQ,
    xp: Math.round(R.xp * xpNeed(lv) * Math.min(K.xpMax, 1 + K.xp * t) * (full ? 1 : 0.5) * ck),
  };
}
/**
 * Rare loot with no other source (HANDOFF §0.1): 스킬 강화석, 저주 해제 주문서, the two reset scrolls. `src`: "rift" a
 * full-reward clear at `tier` (the stone from tier `skeFrom`, +`ske` a tier), "big" / "small" a weekly boss challenge,
 * "fb" a field boss (each looter). `wkN` weekly brackets cleared add one 저주 해제 주문서 each.
 */
const LOOT_X = {
  rift: { skeFrom: 10, ske: 0.01, skeMax: 0.15, unc: 0.04, uncTier: 0.005, uncMax: 0.25 },
  big: { ske: [1, 2], unc: 1 }, small: { unc: 0.1 },
  fb: { ske: 0.03, unc: 0.08, job: 0.02, lvl: 0.01 },
};
function lootX(S, src, tier = 0, wkN = 0) {
  const out = wkN > 0 ? [["uncurse", wkN]] : [], chance = (id, c) => { if (rnd(S) < c) out.push([id, 1]); };
  if (src === "rift") {
    const R = LOOT_X.rift, t = tier | 0;
    if (t >= R.skeFrom) chance(SKE_ITEM, Math.min(R.skeMax, R.ske * (t - R.skeFrom + 1)));
    chance("uncurse", Math.min(R.uncMax, R.unc + R.uncTier * t));
  } else if (src === "big") out.push([SKE_ITEM, ri(S, LOOT_X.big.ske[0], LOOT_X.big.ske[1])], ["uncurse", LOOT_X.big.unc]);
  else if (src === "small") chance("uncurse", LOOT_X.small.unc);
  else if (src === "fb") {
    const F = LOOT_X.fb;
    chance(SKE_ITEM, F.ske); chance("uncurse", F.unc); chance(JF_SCROLL.job, F.job); chance(JF_SCROLL.lvl, F.lvl);
  }
  return out;
}
function giveX(S, p, src, tier, wkN, box = S) {
  for (const [id, n] of lootX(box, src, tier, wkN)) {
    if (addItem(p.ch, id, n)) p.gain.push(["item", id, n, 0]); else bagFull(S, p);
  }
}
/** A field boss's share for one looter, from the ground's own draw so the world's other draws stay as they were. */
function fbLoot(S, rt, p) {
  if (!rt.lxRng) rt.lxRng = { seed: ((rt.fbRng ? rt.fbRng.seed : S.seed) ^ 0x2545f491) | 0 };
  giveX(S, p, "fb", 0, 0, rt.lxRng);
}
/** Each member's own reward from the master's chest, once; full experience for the first few clears of the day. */
function dimChest(S, dim, p) {
  const ch = p.ch, lv = dim.lv;
  if (charmChestHold(S, p)) return;   // a charm already waits at 주아나 and the bag is full (66-charms.js)
  dim.got[p.pid] = 1;
  const d = dimRec(ch, S.now), carried = !!(dim.carry && dim.carry[p.pid]);
  let fl = ((dim.res && dim.res[p.pid]) || 0) | (carried ? 4 : 0), wkN = 0, r, msg;
  if (dim.chal) {
    // a boss challenge: the big reward once a week per boss, a small one after (and for someone carried, who keeps the week's)
    const bit = 1 << CHAL_KEYS.indexOf(dim.chal.k), big = !carried && !(d.bw & bit), R = big ? DIM_CHAL.big : DIM_CHAL.small;
    if (big) { d.bw |= bit; fl |= 8; }
    r = { gold: R.gold * lv, xp: Math.round(R.xp * xpNeed(lv)), stone: R.stone, rune: !!R.rune, gear: R.gear ? 1 : 0, gearQ: R.gearQ };
    payout(S, p, r);
    for (let i = 1; i < (R.rune | 0); i++) payout(S, p, { rune: true });
    for (let i = 1; i < (R.gear | 0); i++) payout(S, p, { gear: 1, gearQ: R.gearQ });
    if (big) { charmChest(S, dim, p); jfScroll(p, "lvl"); }
    giveX(S, p, big ? "big" : carried ? "" : "small");
    msg = big ? "주간 보스 도전 보상을 받았습니다! (이번 주 큰 보상 완료)" : carried ? "기여가 부족해 작은 보상만 받았습니다." : "보스 도전 반복 보상을 받았습니다. 큰 보상은 월요일 06:00에 다시 열립니다.";
  } else {
    d.n++;
    const full = d.n <= DIM.dailyFull, W = DIM_TIER.weekly;
    r = dimReward(lv, dim.tier, full, carried);
    r.rune = rnd(S) < r.rune;
    // the week's first clear of each bracket of tiers (everything up to this one at once)
    const b = Math.min(W.max, Math.floor(((dim.tier || 1) - 1) / W.every) + 1);
    if (!carried && b > d.wb) { wkN = b - d.wb; d.wb = b; r.gold += W.gold * lv * wkN; r.stone += W.stone * wkN; fl |= 8; }
    payout(S, p, r);
    if (wkN && dim.tier >= 20) jfScroll(p, "job");
    if (!carried) giveX(S, p, full ? "rift" : "", dim.tier, wkN);
    charmChest(S, dim, p);
    msg = carried ? "기여가 부족해 균열의 보상이 줄었습니다. (단수 기록·주간 보너스 없음)"
      : (full ? `균열의 보상을 받았습니다! (오늘 ${d.n}번째)` : `균열의 보상을 받았습니다. 오늘 ${DIM.dailyFull}번을 넘겨 경험치는 절반입니다.`) + (wkN ? ` 주간 첫 정화 보너스 ×${wkN}!` : "");
  }
  // the result panel: [0 rift / 1 boss, tier or boss index, clear seconds, flags (1 record, 2 next tier, 4 carried, 8 weekly), gold, experience, weekly brackets]
  p.dimRes = [dim.chal ? 1 : 0, dim.chal ? CHAL_KEYS.indexOf(dim.chal.k) : dim.tier, Math.round(((dim.clearAt | 0) - (dim.opened | 0)) / 1000), fl, r.gold, r.xp, wkN];
  dim.rt.ev.push(["dm", "chest", dim.chest.x, dim.chest.y]);
  toast(p, msg);
  saveSoon(p);
}
function dimFail(S, dim, why) {
  dim.state = "fail"; dim.endAt = S.now + DIM.failMs;
  for (const o of dimInside(S, dim.id)) toast(o, why);
}
/** Back to the obelisk, on your feet (an instance's death costs nothing). */
function dimHome(S, p) {
  const [x, y] = tilePx(DIM_TOWN.land);
  if (p.dead) { p.dead = false; const st = stats(p); p.hp = Math.round(st.mhp * 0.5); p.mp = Math.max(p.mp, Math.round(st.mmp * 0.5)); }
  p.dimDeadAt = 0; p.dimWard = 0;
  changeMap(S, p, START.map, x, y);
  p.dirty = true;
}
function dimEnd(S, dim) {
  for (const o of dimInside(S, dim.id)) {
    if (dim.state === "fail") { const g = dim.lv * DIM.failGold; o.ch.gold += g; o.gain.push(["gold", g]); toast(o, `차원 균열에서 밀려났습니다. (위로금 ${g}G)`); }
    dimHome(S, o);
  }
  closeDim(S, dim.id);
}
/** A shrine's gift to everyone of the instance within reach of `p`. */
function dimBuff(S, dim, p, kind) {
  const now = S.now, [name, ms] = DIM.pylons[kind];
  for (const o of dimInside(S, dim.id)) {
    if (o.dead || dist(o.x, o.y, p.x, p.y) > DIM.buffR) continue;
    if (kind === "atk") { o.atkBuffK = o.atkBuff > now ? Math.max(o.atkBuffK ?? 0, DIM.atkK) : DIM.atkK; o.atkBuff = Math.max(o.atkBuff, now + ms); }
    else if (kind === "spd") o.spdBuff = Math.max(o.spdBuff, now + ms);
    else if (kind === "shield") o.dimWard = now + ms;
    else {
      const st = stats(o);
      o.mp = Math.min(st.mmp, o.mp + st.mmp * DIM.gaugeMp);
      // the weapon gauges fill too: a sword's full inertia, a staff's resonance ready
      if (pasOn(o, "inertia")) { o.inert = SKILL.inertia.max; o.inertAt = now; }
      if (pasOn(o, "reso")) o.reso = SKILL.reso.n;
    }
    o.dirty = true;
    toast(o, `[${name}] ${kind === "atk" ? `공격력 +${Math.round(DIM.atkK * 100)}%` : kind === "spd" ? "이동 속도 증가" : kind === "shield" ? `받는 피해 -${Math.round(DIM.ward * 100)}%` : "마나와 기력 회복"}${ms ? ` (${ms / 1000}초)` : ""}`);
  }
}
/** Every tick, before the maps: ready checks, then each instance — empty, timed out, wiped, orbs, shrines, the chest, the way home. */
function dimTick(S, now) {
  for (const id of Object.keys(S.parties)) if (S.parties[id].rc) rcCheck(S, S.parties[id]);
  for (const id of Object.keys(S.dims)) {
    const dim = S.dims[id];
    if (dim.prog === undefined) continue; // registered by something else (tests of the map registry)
    const inside = dimInside(S, id);
    for (const o of inside) {
      dim.members[o.pid] = now;
      if (o.dead && !o.dimDeadAt) o.dimDeadAt = now;
      else if (!o.dead) o.dimDeadAt = 0;
    }
    if (!inside.length) {
      if (!dim.emptyAt) dim.emptyAt = now;
      if (now - dim.emptyAt >= DIM.emptyMs) { closeDim(S, id); continue; }
    } else dim.emptyAt = 0;
    if (dim.state === "run" || dim.state === "boss") {
      if (now >= dim.expire) dimFail(S, dim, "시간이 다 되어 차원 균열이 닫힙니다…");
      else if (!dim.warned && dim.expire - now <= DIM.warn) { dim.warned = true; for (const o of inside) toast(o, "차원 균열이 닫히기까지 3분 남았습니다!"); }
    }
    if ((dim.state === "fail" || dim.state === "clear") && now >= dim.endAt) { dimEnd(S, dim); continue; }
    const alive = inside.filter((o) => !o.dead);
    if (dim.chal && dim.state === "boss") chalTick(S, dim, inside, alive);
    // orbs fly to whoever comes near; shrines answer a step on them
    for (let i = dim.orbs.length - 1; i >= 0; i--) {
      const b = dim.orbs[i];
      if (now >= b.until) { dim.orbs.splice(i, 1); continue; }
      const o = alive.find((q) => dist(q.x, q.y, b.x, b.y) <= DIM.orbR);
      if (!o) continue;
      dim.orbs.splice(i, 1);
      dim.rt.ev.push(["dm", "orb", b.x, b.y]);
      if (dim.state === "run") { dimProg(dim, DIM.orb); if (dim.prog >= 100) dimBoss(S, dim); }
    }
    for (let i = dim.pylons.length - 1; i >= 0; i--) {
      const s = dim.pylons[i];
      if (now >= s.until) { dim.pylons.splice(i, 1); continue; }
      const o = alive.find((q) => dist(q.x, q.y, s.x, s.y) <= DIM.shrineR);
      if (!o) continue;
      dim.pylons.splice(i, 1);
      dim.rt.ev.push(["dm", s.kind, s.x, s.y]);
      dimBuff(S, dim, o, s.kind);
    }
    if (dim.state === "clear") {
      for (const o of alive) {
        if (dim.hit[o.pid] && !dim.got[o.pid] && dist(o.x, o.y, dim.chest.x, dim.chest.y) <= 26) dimChest(S, dim, o);
        if (dist(o.x, o.y, dim.portal.x, dim.portal.y) > 14) continue;
        // nobody walks out past their own reward by accident
        if (dim.hit[o.pid] && !dim.got[o.pid]) { if (!o.dimNag || now - o.dimNag > 4000) { o.dimNag = now; toast(o, "먼저 보상 상자를 여세요!"); } continue; }
        toast(o, "버드나무광장으로 돌아왔습니다."); dimHome(S, o);
      }
    }
  }
}
/** Someone dead inside gets up again in the start room (the `respawn` action), at no cost. True if handled. */
function dimRespawn(S, p) {
  const dim = dimAt(S, p.map);
  if (!dim) return false;
  if (dim.story) { storyHome(S, p, "쓰러졌습니다… 다시 그 자리로 다가가면 재도전할 수 있습니다."); return true; }
  const [x, y] = dimSpot(dim.map, ri(S, 0, 8));
  p.dead = false; p.dimDeadAt = 0;
  const st = stats(p);
  p.hp = st.mhp; p.mp = st.mmp;
  p.x = x; p.y = y; p.fix = true;
  p.ghost = S.now + 2500;
  dim.rt.ev.push(["u", p.eid, 2]);
  p.dirty = true;
  toast(p, "시작 지점에서 다시 일어났습니다. (차원 균열 안에서는 경험치를 잃지 않습니다)");
  return true;
}
/** Seconds `p` must still wait to get up in an instance (0: may). */
function dimReviveWait(S, p) {
  if (!inDim(p)) return 0;
  const dim = dimAt(S, p.map), chal = dim && dim.chal;
  // a boss challenge: nobody gets up while the fight is on (99: until it ends — a wipe resets the boss)
  if (chal && dim.state === "boss" && chal.engAt) return 99;
  if (chal && chal.upAt) return Math.max(1, Math.ceil((chal.upAt - S.now) / 1000));
  return Math.max(0, Math.ceil(((p.dimDeadAt || S.now) + (chal ? DIM_CHAL.reviveMs : DIM.reviveMs) - S.now) / 1000));
}

// ── 주간 보스 도전: the boss's script (docs/design/scale-and-rift.md H.6)

/** The boss of a challenge, in the middle of its arena, asleep until someone comes near or strikes it. */
function chalSpawn(S, dim, k, n) {
  const [tx, ty] = dim.map.dim.boss, d = MOBS[k], now = S.now, up = Math.max(0, dim.lv - d.lv);
  const mob = newMob(S, k, [tx, ty, tx, ty]);
  readyMob(S, mob);
  mob.temp = true; mob.dim = 1; mob.chal = 1; mob.tr = [];
  mob.x = mob.hx = mob.wx = tx * T + 8; mob.y = mob.hy = mob.wy = ty * T + 10;
  mob.hk = DIM_CHAL.hp * DIM.hpN[clamp(n, 1, DIM.party) - 1] * (1 + DIM_CHAL.lvK * up);
  // its script's state (56-boss-script.js) is the challenge's own: one object, with the tries and the wipe clock
  dim.chal = Object.assign(bsNew(1 + DIM_CHAL.atkLv * up), { k, tries: 1, upAt: 0 });
  mob.bs = dim.chal; mob.ak = dim.chal.ak;
  mob.castAt = now + 5000; mob.stun = now + 3000;
  dim.rt.mobs.push(mob);
  dim.boss = mob.id; dim.state = "boss"; dim.bossAt = now;
}
/** A wipe: the boss is whole again in the middle, its fury and its clock forgotten; the party gets up and tries again. */
function chalReset(S, dim, mob) {
  const c = dim.chal, [tx, ty] = dim.map.dim.boss, now = S.now;
  mob.hp = mobMax(mob); mob.by = {}; mob.tgt = null; mob.st = 0; mob.cast = null; mob.act = null; mob.dot = null; mob.slow = 0;
  mob.x = mob.hx = mob.wx = tx * T + 8; mob.y = mob.hy = mob.wy = ty * T + 10;
  mob.stun = now + 3000; mob.castAt = now + 7000; mob.ak = c.ak; mob.stag = 0;
  dim.rt.tele.length = 0; dim.rt.pools.length = 0;
  // everyone gets up together in DIM_CHAL.reviveMs (chalTick); the boss sleeps till then
  Object.assign(c, bsNew(c.ak), { tries: c.tries + 1, upAt: now + DIM_CHAL.reviveMs });
  dim.rt.ev.push(["r", mob.id]);
}
/** Every tick of a challenge's fight: a wipe, the boss never losing interest, the marked cast running out, queued steps, the enrage. */
function chalTick(S, dim, inside, alive) {
  const c = dim.chal, now = S.now, rt = dim.rt, mob = rt.mobs.find((q) => q.id === dim.boss);
  if (!mob || mob.dead) return;
  const d = MOBS[mob.k];
  if (c.engAt && inside.length && !alive.length) {
    chalReset(S, dim, mob);
    for (const o of inside) toast(o, `전멸했습니다… ${d.name}${pp(d.name, "이가")} 기력을 되찾았습니다. 일어나 다시 도전하세요! (${c.tries}번째 시도)`);
    return;
  }
  // after a wipe: the whole party gets up at once, then the boss may wake
  if (c.upAt) {
    if (now < c.upAt) { mob.tgt = null; mob.mvAt = now + 5000; return; }
    c.upAt = 0;
    for (const o of inside) if (o.dead) dimRespawn(S, o);
  }
  // asleep in the middle until someone comes near or strikes it
  if (!c.engAt) { if (!mob.tgt) { mob.mvAt = now + 5000; mob.wx = mob.hx; mob.wy = mob.hy; return; } c.engAt = now; }
  // it never walks home to heal: its target down or gone, it turns on the nearest still standing
  const cur = S.players[mob.tgt];
  if (!cur || cur.dead || cur.map !== dim.id || mob.st === 2) {
    const o = alive.reduce((a, b) => (!a || dist(mob.x, mob.y, b.x, b.y) < dist(mob.x, mob.y, a.x, a.y) ? b : a), null);
    mob.tgt = o ? o.pid : null;
    if (o) mob.st = 0;
  }
  bsTick(S, dim.map, rt, mob, inside, alive);   // phases, the marked cast, queued steps, the enrage (56-boss-script.js)
}
/** A blow on a rift's monster (dealMob): the striker's share of the damage, for the carry guard. */
function dimDealt(S, rt, mob, p, dmg) {
  const dim = dimAt(S, rt.id);
  if (!dim || !dim.dmg) return;
  dim.dmg[p.pid] = (dim.dmg[p.pid] || 0) + dmg;
}
/** The running instance `p` (in town) may walk back into, or null: one they were in lately, or their party's. */
function dimJoinable(S, p) {
  for (const id of Object.keys(S.dims)) {
    const dim = S.dims[id];
    if (dim.prog === undefined || (dim.state !== "run" && dim.state !== "boss")) continue;
    const seen = dim.members[p.pid];
    if (!((seen && S.now - seen <= DIM.memberMs) || (p.party && p.party === dim.party))) continue;
    return dim;
  }
  return null;
}

// ── actions (validated in 70-validate.js, applied in 75-apply.js)

function dimValidate(S, p, a) {
  const party = S.parties[p.party];
  switch (a.t) {
    case "dim_open": {
      if (!obeliskNear(p)) return bad("차원의 오벨리스크 곁에서만 균열을 열 수 있습니다");
      if (party && party.m[0] !== p.pid) return bad("파티장만 균열을 열 수 있습니다.");
      if (party && party.rc) return bad("이미 준비 확인 중입니다.");
      if (p.dead) return bad("쓰러진 채로는 열 수 없습니다");
      if (dimJoinable(S, p)) return bad("이미 열린 차원 균열이 있습니다. [합류]하세요.");
      const open = Object.keys(S.dims).length;
      if (open >= DIM.max) return bad(`차원 균열이 모두 사용 중입니다 (${open}/${DIM.max}).`);
      // a boss challenge (the leader's own level), or a tier nobody of the party in town is short of
      if (a.boss !== undefined) {
        if (typeof a.boss !== "string" || !Object.hasOwn(DIM_CHAL.bosses, a.boss)) return bad("알 수 없는 보스 도전입니다");
        const bar = dimBar(p, dimAsk(a));
        if (bar) return bad(bar);
      } else if (a.tier !== undefined) {
        if (!Number.isInteger(a.tier) || a.tier < 1 || a.tier > DIM_TIER.max) return bad("잘못된 단수입니다");
        const cap = dimTierCap(party ? party.m.map((pid) => S.players[pid]).filter((o) => o && o.map === START.map) : [p]);
        if (a.tier > cap) return bad(party && p.ch.dim.t >= a.tier ? `일행 중 ${a.tier}단을 열지 못한 사람이 있습니다. (파티 최고 ${cap}단)` : `아직 균열 ${a.tier}단을 열지 못했습니다. (해금 ${cap}단)`);
      }
      return OK;
    }
    case "dim_ready": {
      const rc = party && party.rc;
      if (!rc || rc.id !== a.id) return bad("응답할 입장 준비가 없습니다");
      if (rc.resp[p.pid] !== 0) return bad("이미 응답했습니다");
      if (p.map !== START.map) return bad("마을에 있을 때만 입장할 수 있습니다");
      if (a.ok !== 0 && a.ok !== 1) return bad("잘못된 요청입니다");
      return OK;
    }
    case "dim_cancel":
      if (!party || !party.rc) return bad("진행 중인 입장 준비가 없습니다");
      if (party.rc.leader !== p.pid) return bad("파티장만 취소할 수 있습니다.");
      return OK;
    case "dim_leave":
      return inDim(p) && dimAt(S, p.map) ? OK : bad("차원 균열 안에 있지 않습니다");
    case "dim_join": {
      if (!obeliskNear(p)) return bad("차원의 오벨리스크 곁에서만 합류할 수 있습니다");
      if (p.dead) return bad("쓰러진 채로는 합류할 수 없습니다");
      const dim = dimJoinable(S, p);
      if (!dim) return bad("합류할 수 있는 차원 균열이 없습니다");
      if (dimInside(S, dim.id).length >= DIM.party) return bad(`차원 균열 안이 가득 찼습니다 (${DIM.party}명).`);
      const bar = dimBar(p, { tier: dim.tier | 0, boss: dim.chal ? dim.chal.k : "" });
      if (bar) return bad(bar);
      return OK;
    }
  }
  return bad("알 수 없는 행동");
}
function dimApply(S, p, a) {
  const party = S.parties[p.party];
  switch (a.t) {
    case "dim_open": dimOpen(S, p, a); break;
    case "dim_ready":
      party.rc.resp[p.pid] = a.ok ? 1 : 2;
      for (const pid of party.m) { const o = S.players[pid]; if (o && o !== p && party.rc.resp[pid] !== 3) toast(o, `${p.ch.name}님이 입장을 ${a.ok ? "수락" : "거절"}했습니다.`); }
      if (!a.ok) toast(p, "차원 균열 입장을 거절했습니다. 나중에 오벨리스크에서 합류할 수 있습니다.");
      rcCheck(S, party);
      break;
    case "dim_cancel": rcEnd(S, party, "파티장이 차원 균열 입장을 취소했습니다."); break;
    case "dim_leave":
      if (dimAt(S, p.map).story) { storyHome(S, p, "도전을 그만두고 돌아왔습니다. 다시 그 자리로 다가가면 재도전할 수 있습니다."); break; }
      toast(p, "차원 균열을 떠나 버드나무광장으로 돌아왔습니다."); dimHome(S, p); break;
    case "dim_join": {
      const dim = dimJoinable(S, p);
      const [x, y] = dimSpot(dim.map, dimInside(S, dim.id).length);
      dim.members[p.pid] = S.now;
      changeMap(S, p, dim.id, x, y);
      dim.top = Math.max(dim.top || 0, toTier(p.ch.lvl));
      toast(p, `차원 균열 Lv.${shownLv(dim.lv)}에 합류했습니다.`);
      for (const o of dimInside(S, dim.id)) if (o !== p) toast(o, `${p.ch.name}님이 균열에 합류했습니다.`);
      p.dirty = true;
      break;
    }
  }
}

// ── the wire (docs/design/scale-and-rift.md D.8)

const DIM_STATE = { run: 0, boss: 1, clear: 2, fail: 3 };
/** What `p` sees of rifts this tick, added to `out` only when it changed: `dim` inside, `rc` while asked, `dj` in town. */
function dimView(S, p, out) {
  const now = S.now, dim = inDim(p) ? dimAt(S, p.map) : null;
  if (dim && dim.prog !== undefined) {
    const secs = Math.max(0, Math.ceil(((dim.state === "run" || dim.state === "boss" ? dim.expire : dim.endAt) - now) / 1000));
    const team = dimInside(S, dim.id).map((o) => [o.eid, Math.round((100 * Math.max(0, o.hp)) / stats(o).mhp), o.dead ? 0 : 1]);
    const v = [Math.floor(dim.prog * 10), secs, DIM_STATE[dim.state], dim.state === "boss" ? dim.boss : 0, dim.lv, team,
      dim.pylons.map((s) => [s.id, s.kind, s.x, s.y, Math.ceil((s.until - now) / 1000)]), dim.orbs.map((b) => [b.id, b.x, b.y]),
      dim.portal ? [dim.portal.x, dim.portal.y] : 0, dim.chest ? [dim.chest.x, dim.chest.y, dim.got[p.pid] ? 1 : dim.hit[p.pid] ? 0 : 2] : 0,
      dim.theme, dim.state === "boss" ? dim.map.dim.boss : 0, Math.max(0, Math.ceil(((p.dimWard || 0) - now) / 1000)), dimReviveWait(S, p),
      // appended: the tier (0 in a boss challenge), then the challenge — [boss index, 0 / 1 casting / 2 staggered, stagger gauge left %,
      // half-seconds left of that, enrage steps, tries, fury]
      dim.tier | 0, dim.chal ? chalView(S, dim) : 0];
    const key = JSON.stringify(v);
    if (key !== p.dimKey || p.sendMap) { out.dim = v; p.dimKey = key; }
  } else if (p.dimKey) { out.dim = 0; p.dimKey = null; }
  // the ready check: [id, seconds left, [[eid, name, answer]…], level, am I the leader]
  const party = S.parties[p.party], rc = party && party.rc;
  if (rc && rc.resp[p.pid] !== undefined && rc.resp[p.pid] !== 3) {
    const rows = party.m.filter((pid) => S.players[pid] && rc.resp[pid] !== undefined).map((pid) => [S.players[pid].eid, S.players[pid].ch.name, rc.resp[pid]]);
    const v = [rc.id, Math.max(0, Math.ceil((rc.until - now) / 1000)), rows, dimLvOf(party.m.map((pid) => S.players[pid]).filter((o) => o && o.map === START.map)), rc.leader === p.pid ? 1 : 0,
      rc.tier | 0, rc.boss ? CHAL_KEYS.indexOf(rc.boss) + 1 : 0];
    const key = JSON.stringify(v);
    if (key !== p.rcKey) { out.rc = v; p.rcKey = key; }
  } else if (p.rcKey) { out.rc = 0; p.rcKey = null; }
  // in town: a rift to walk back into — [seconds left, inside, gauge ×10, level]
  const j = p.map === START.map ? dimJoinable(S, p) : null;
  const dj = j ? [Math.max(0, Math.ceil((j.expire - now) / 1000)), dimInside(S, j.id).length, Math.floor(j.prog * 10), j.lv, j.tier | 0, j.chal ? CHAL_KEYS.indexOf(j.chal.k) + 1 : 0] : 0;
  const dk = dj ? dj.join(",") : "";
  if (dk !== (p.djKey || "")) { out.dj = dj; p.djKey = dk; }
  // a chest just opened: the result panel, once
  if (p.dimRes) { out.dr = p.dimRes; p.dimRes = null; }
}
function chalView(S, dim) {
  const c = dim.chal, now = S.now, mob = dim.state === "boss" ? dim.rt.mobs.find((q) => q.id === dim.boss) : null, cast = mob && mob.cast;
  const mode = cast ? 1 : mob && !mob.dead && mob.stag > now ? 2 : 0;
  return [CHAL_KEYS.indexOf(c.k), mode, cast ? Math.ceil(100 * (1 - cast.got / cast.need)) : 0,
    cast ? Math.ceil((cast.until - now) / 500) : mode === 2 ? Math.ceil((mob.stag - now) / 500) : 0, c.rage, c.tries, c.fury];
}
/** `self.dimr`: [unlocked tier, best tier, its clear seconds, full-reward clears left today, weekly brackets taken, weekly boss flags]. */
function dimSelf(p) {
  const d = p.ch.dim, now = p.S.now, wk = d.wk === weekOf(now);
  return [d.t, d.best, Math.round(d.ms / 1000), Math.max(0, DIM.dailyFull - (d.day === dayOf(now) ? d.n : 0)), wk ? d.wb : 0, wk ? d.bw : 0];
}
/** The tables the browser needs for rifts (defs().dim). */
function dimDefs() {
  return {
    themes: Object.fromEntries(Object.keys(DIM_THEMES).map((k) => [k, DIM_THEMES[k].name])), pylons: DIM.pylons, limit: DIM.limit, party: DIM.party, max: DIM.max,
    rcMs: DIM.rcMs, obelisk: DIM_TOWN.ob, reviveMs: DIM.reviveMs, near: DIM.near,
    // the ladder and the boss challenge: [key, name, level needed, the marked cast, pattern names]
    tier: { max: DIM_TIER.max, hp: DIM_TIER.hp, atk: DIM_TIER.atk, every: DIM_TIER.weekly.every, daily: DIM.dailyFull },
    chal: { limit: DIM_CHAL.limit, enrage: DIM_CHAL.enrage, castMs: DIM_CHAL.castMs, bosses: CHAL_KEYS.map((k) => [k, MOBS[k].name, chalMinLv(k), DIM_CHAL.bosses[k].cast, DIM_CHAL.bosses[k].pats.map((q) => q[0])]) },
  };
}
