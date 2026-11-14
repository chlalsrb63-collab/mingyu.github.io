// ───────────────────────────── inventory & loot ─────────────────────────────

/** Old clients asked for "W<tier>": the weapon of that tier of the kind in hand. */
function resolveItem(key, ch) {
  if (key[0] === "W" && key.length === 2) return `w_${WK_ID[weaponKind(ch)]}_${key[1]}`;
  return key;
}
function countItem(ch, id) {
  let n = 0;
  for (const s of ch.inv) if (s.id === id) n += s.n || 1;
  return n;
}
function canAdd(ch, id, n) {
  if (isGear(id)) return ch.inv.length + n <= bagCap(ch);
  let room = (bagCap(ch) - ch.inv.length) * STACK;
  for (const s of ch.inv) if (s.id === id) room += STACK - s.n;
  return room >= n;
}
function addItem(ch, id, n) {
  if (!canAdd(ch, id, n)) return false;
  if (isGear(id)) {
    for (let i = 0; i < n; i++) ch.inv.push(plain(id));
    return true;
  }
  for (const s of ch.inv) {
    if (s.id !== id || n <= 0) continue;
    const put = Math.min(n, STACK - s.n);
    s.n += put; n -= put;
  }
  while (n > 0) {
    const put = Math.min(n, STACK);
    ch.inv.push({ id, n: put });
    n -= put;
  }
  return true;
}
/** Room in the warehouse for `n` of `id`. */
function whRoom(wh, id, n) {
  if (isGear(id)) return wh.items.length + 1 <= WH;
  let room = (WH - wh.items.length) * STACK;
  for (const s of wh.items) if (s.id === id) room += STACK - s.n;
  return room >= n;
}
/** Stack `n` of `id` into a list of slots, filling what is there first. */
function stackInto(list, id, n) {
  for (const s of list) {
    if (s.id !== id || n <= 0) continue;
    const put = Math.min(n, STACK - s.n);
    s.n += put; n -= put;
  }
  while (n > 0) { const put = Math.min(n, STACK); list.push({ id, n: put }); n -= put; }
}
/** A pet whose item is no longer in the bag goes home. */
function petCheck(S, p) {
  if (p.ch.pet && countItem(p.ch, p.ch.pet) < 1) { p.ch.pet = ""; S.maps[p.map].who = true; }
}
/** Whether a drop passes its owner's loot filter (gold and anything that is not gear always does). */
function wanted(ch, dr) {
  return !dr.g || dr.q >= FILTER_Q[(ch.opt && ch.opt.filter) | 0];
}
/** Whether `p` has room for a drop. */
function fits(ch, dr) {
  if (dr.it === "gold") return true;
  return dr.g ? ch.inv.length < bagCap(ch) : canAdd(ch, dr.it, dr.n);
}
function bagFull(S, p) {
  if (S.now > p.fullAt) { p.fullAt = S.now + 3000; toast(p, "가방이 가득 찼습니다."); }
}
/** Put a drop into `p`'s bag (or purse). False, with a reminder, if there is no room. */
function pickUp(S, p, dr) {
  if (!fits(p.ch, dr)) { bagFull(S, p); return false; }
  if (dr.it === "gold") {
    p.ch.gold += dr.n;
    p.gain.push(["gold", dr.n]);
  } else if (dr.g) {
    p.ch.inv.push(dr.g);
    p.gain.push(["item", dr.it, 1, dr.q]);
    if (dr.q === 3) p.ch.cnt.leg++;
    if (dr.q === 4) p.ch.cnt.set++;
    if (dr.q >= 3) checkAch(S, p);
    if (dr.q >= 3) sys(S, `${p.ch.name}님이 ${RARITY[dr.q]} 장비 [${gearName(dr.g)}]${pp(gearName(dr.g), "을를")} 획득했습니다!`);
  } else {
    addItem(p.ch, dr.it, dr.n);
    p.gain.push(["item", dr.it, dr.n, 0]);
    sqPicked(p, dr.it);
  }
  p.dirty = true;
  return true;
}
/** What dying costs: 3% of the unspent experience, up to about one old level's worth (a revive feather spares it). */
const deathLoss = (ch) => Math.floor(Math.min(ch.xp, 4 * pointCost(ch.lvl, STAT_K0)) * 0.03);
function takeItem(ch, id, n) {
  for (let i = ch.inv.length - 1; i >= 0 && n > 0; i--) {
    const s = ch.inv[i];
    if (s.id !== id) continue;
    const take = Math.min(n, s.n);
    s.n -= take; n -= take;
    if (s.n <= 0) ch.inv.splice(i, 1);
  }
}
/** A piece's name word: a legendary's power, a set's name, or its first affix (as the client shows it). */
function gearWord(g) {
  const af = Array.isArray(g.af) && g.af.length ? AFFIX.find((x) => x[0] === g.af[0][0]) : null;
  return g.lg ? `${LEGEND[g.lg][0]} ` : g.set ? `${SETS[g.set].name} ` : af ? `${af[2]} ` : "";
}
/** "+3 뇌명의 강철 양손검" */
function gearName(g) {
  return (g.enh > 0 ? `+${g.enh} ` : "") + gearWord(g) + ITEMS[g.id].name;
}
/** "희귀 잔혹한 강철 양손검 +6" — the whole name, rarity first and the level last (enhancement news). */
function gearFull(g) {
  return ((g.q | 0) > 0 && RARITY[g.q] ? `${RARITY[g.q]} ` : "") + gearWord(g) + ITEMS[g.id].name + (g.enh > 0 ? ` +${g.enh}` : "");
}
/** Plain gear: no rarity, no enhancement, nothing socketed — what "sell all" sells. */
const junk = (s) => isGear(s.id) && !(s.q | 0) && !(s.enh | 0) && !(s.ru || []).some(Boolean);
function sellPrice(s) {
  const it = ITEMS[s.id];
  if (!isGear(s.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.05 * (1 + 0.8 * (s.q | 0)) * (1 + 0.3 * (s.enh | 0)));
}
/** The set a base item can belong to, if any. */
function setFor(it) {
  for (const id of Object.keys(SETS)) {
    if (SETS[id].types.includes(it.type) && SETS[id].tiers.includes(it.tier)) return id;
  }
  return null;
}

/** Roll one piece of gear: rarity decides how many affixes, item level how big. */
function rollGear(S, id, q, ilvl) {
  const it = ITEMS[id];
  if (q === 4 && !setFor(it)) q = 3;
  const g = plain(id);
  g.q = q;
  const [lo, hi] = RARITY_AFFIX[q];
  const pool = AFFIX.slice();
  for (let n = ri(S, lo, hi); n > 0 && pool.length; n--) {
    const [key, , , min, max, grow] = pool.splice(ri(S, 0, pool.length - 1), 1)[0];
    g.af.push([key, Math.max(1, Math.round((min + rnd(S) * (max - min) + grow * ilvl) * (q >= 3 ? 1.3 : 1)))]);
  }
  if (q === 3) { const keys = Object.keys(LEGEND); g.lg = keys[ri(S, 0, keys.length - 1)]; }
  if (q === 4) g.set = setFor(it);
  if (!isJewel(id)) {
    const r = rnd(S);
    const most = it.type === "gloves" || it.type === "boots" ? 1 : 3;
    g.sk = Math.min(most, (r < 0.12 ? 2 : r < 0.45 ? 1 : 0) + (q >= 3 ? 1 : 0));
  }
  return g;
}
/** `rank`: 0 for ordinary monsters, 1 elite, 2 field boss or boss. */
function rollRarity(S, rank, mf) {
  const k = 1 + mf / 100;
  const r = rnd(S);
  const top = [0.012, 0.07, 0.2][rank] * k;       // legendary or set
  const rare = [0.09, 0.3, 0.55][rank] * k;
  const magic = 0.36 * k;
  if (r < top) return rnd(S) < 0.4 ? 4 : 3;
  return r < top + rare ? 2 : r < top + rare + magic ? 1 : 0;
}
function tierFor(lv) {
  return lv < 8 ? 1 : lv < 16 ? 2 : lv < 26 ? 3 : lv < 38 ? 4 : 5;
}
/** Which kind of piece drops: weapons most often, jewellery least. */
const DROP_TYPES = [["weapon", 24], ["helm", 13], ["armor", 15], ["gloves", 13], ["boots", 13], ["ring", 13], ["amulet", 9]];

/** A dropped weapon's kind: half the time the looter's own, else any of the six. */
const dropKind = (S, p) => (rnd(S) < 0.5 ? weaponKind(p.ch) : WK_ORDER[ri(S, 0, WK_ORDER.length - 1)]);
/** What one looter finds on one corpse. Everyone in the party rolls their own. */
function lootFor(S, rt, mob, p) {
  const d = MOBS[mob.k];
  const st = stats(p);
  const out = [];
  const share = allies(S, p).length;
  const rank = d.boss ? 2 : d.chest ? 1 : mob.el;
  const gold = ri(S, d.gold[0], d.gold[1]) * [1, 3, 12][mob.el] * goldK(d.lv) * (1 + st.gold / 100) * (mob.lucky ? 2 : 1) * (mob.dim ? DIM.lootGold : 1);
  out.push({ it: "gold", n: Math.max(1, Math.round(gold / share)) });
  const tries = d.boss ? 4 : mob.el === 2 ? 3 : 1;
  for (let i = 0; i < tries; i++) {
    if (rnd(S) >= (rank === 2 || d.chest ? 1 : rank === 1 ? 0.35 : d.gear) * (1 + st.mf / 100)) continue;
    let tier = tierFor(d.lv);
    if (rank && rnd(S) < 0.25) tier = Math.min(5, tier + 1);
    let roll = rnd(S) * 100, type = "weapon";
    for (const [t, w] of DROP_TYPES) { if (roll < w) { type = t; break; } roll -= w; }
    let id;
    if (type === "weapon") id = `w_${WK_ID[dropKind(S, p)]}_${tier}`;
    else id = `${GEAR[type].pre}_${tier}`;
    let q = rollRarity(S, rank, st.mf);
    if (isJewel(id) && q === 0) q = 1;
    out.push({ g: rollGear(S, id, q, d.lv) });
  }
  if (rnd(S) < (rank === 2 ? 1 : rank === 1 ? 0.25 : (0.02 + d.lv * 0.001) * GEAR_CUT)) out.push({ it: `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`, n: 1 });
  if (rnd(S) < (rank === 2 ? 1 : rank === 1 ? 0.5 : 0.05 * GEAR_CUT)) out.push({ it: "stone", n: rank === 2 ? ri(S, 3, 6) : 1 });
  if (rnd(S) < 0.1) out.push({ it: d.lv < 8 ? "hp_s" : d.lv < 26 ? "hp_m" : "hp_l", n: 1 });
  if (rnd(S) < 0.07) out.push({ it: d.lv < 8 ? "mp_s" : d.lv < 26 ? "mp_m" : "mp_l", n: 1 });
  for (const o of out) {
    rt.drops.push({
      id: S.nextId++, it: o.g ? o.g.id : o.it, g: o.g || null, n: o.n || 1, q: o.g ? o.g.q : 0,
      x: mob.x + ri(S, -14, 14), y: mob.y + ri(S, -8, 10), own: p.pid, freeAt: S.now + 20000, dieAt: S.now + 60000,
    });
  }
}

// ───────────────────────────── combat ─────────────────────────────

/**
 * Experience only piles up: it is spent on stat points at a campfire or at 수련관 카이 (action
 * `train`, one point = one level). The first time a point is affordable, a word says where.
 */
function gainXp(S, p, n) {
  const ch = p.ch;
  n = Math.max(1, Math.round(n * (1 + stats(p).xp / 100)));
  ch.xp = Math.min(2e9, ch.xp + n);
  p.gain.push(["xp", n]);
  if (!p.lvHint && ch.lvl < MAXLV && ch.xp >= Math.min(...nextCosts(ch).filter((c) => c > 0))) {
    p.lvHint = true;
    toast(p, "레벨을 올릴 수 있습니다 — 모닥불이나 수련관에서 능력치를 고르세요.");
  }
  p.dirty = true;
}

/** Take `dmg` off a monster on behalf of `p`; true if that killed it. */
function dealMob(S, rt, mob, p, dmg, crit) {
  if (mob.dead) return false;
  // a rift's monster is made tougher for a bigger or stronger party (64-dim.js dimHk)
  if (mob.hk) dmg = Math.max(1, Math.round(dmg / mob.hk));
  mob.hp -= dmg;
  mob.by[p.pid] = (mob.by[p.pid] || 0) + dmg;
  if (mob.evt && S.evt && (S.evt.phase === "on" || S.evt.phase === "boss")) S.evt.dmg[p.pid] = (S.evt.dmg[p.pid] || 0) + dmg;
  if (!mob.tgt) mob.tgt = p.pid;
  rt.ev.push(["h", mob.id, dmg, crit === 2 ? 2 : crit ? 1 : 0, 0]);
  if (mob.hp > 0) return false;
  killMob(S, rt, mob);
  return true;
}

/**
 * Hitstun. Every blow that lands staggers a normal or elite monster: for `ms` (a crit: `crit`)
 * it neither moves nor strikes, and the time its attack and its next trick were still cooling
 * down is held over (paused) rather than spent. It is also nudged `kb` px straight away from the
 * striker, stopping short of anything solid (knock). Bosses, field bosses / guardians and things
 * rooted to the spot only flinch on screen. A wound-up charge still goes off (tickMob).
 */
const STAGGER = { ms: 140, crit: 200, elite: 0.65, kb: 3, eliteKb: 2 };
/**
 * No stun-lock: from a monster's first hold, for HOLD.win ms it is held (and its cooldowns paused)
 * for at most HOLD.cap ms in all; past that it shrugs blows off (no hold, no shove) until the
 * window ends. So however many hit it, it still strikes at least ~86% as often as unhurt.
 */
const HOLD = { win: 2400, cap: 340 };
/** Is it shrugging hitstun off just now (its hold budget for this window spent)? */
function steady(S, mob) { return S.now < (mob.hw || 0) && (mob.hu || 0) >= HOLD.cap; }
/** Hold a monster still until `S.now + ms` (within its HOLD budget): its stun runs longer, and its cooldowns pause for the extra time. */
function holdMob(S, mob, ms) {
  const now = S.now;
  if (!(now < (mob.hw || 0))) { mob.hw = now + HOLD.win; mob.hu = 0; }
  const from = Math.max(mob.stun, now), until = Math.min(now + Math.round(ms), from + HOLD.cap - mob.hu);
  if (until <= from) return;
  const add = until - from;
  mob.atkAt = Math.max(mob.atkAt, now) + add;
  if (mob.castAt > now) mob.castAt += add;
  mob.stun = until;
  mob.hu += add;
}
function stagger(S, mob, p, crit) {
  const d = MOBS[mob.k];
  if (d.boss || d.still || mob.el === 2 || mob.dead || steady(S, mob)) return false;
  holdMob(S, mob, (crit ? STAGGER.crit : STAGGER.ms) * (mob.el ? STAGGER.elite : 1));
  const dd = dist(p.x, p.y, mob.x, mob.y);
  if (dd > 0.5) knock(mapOfS(S, p.map), mob, (mob.x - p.x) / dd, (mob.y - p.y) / dd, mob.el ? STAGGER.eliteKb : STAGGER.kb);
  return true;
}

/**
 * A blow from `p` on `mob` for `mult` × attack. `sure`: a crit that cannot graze. `opt` (skills):
 * `mag` magic damage whatever the weapon, `ign` share of armour ignored (the spear's tip), `crit` extra
 * crit chance, `sk` the skill it came from (a book's skill brands what it hits).
 */
function hurtMob(S, rt, mob, p, mult, sure, opt) {
  if (mob.dead) return;
  const st = stats(p);
  const d = MOBS[mob.k];
  const o = opt || {};
  // a blow beyond your depth, or from an unpractised hand, may only graze (×0.5, never a crit)
  const graze = !sure && rnd(S) * 100 < grazeChance(p, mob);
  // 급소 도려내기: a dagger finds the gaps its marks point to (+4% critical chance per mark)
  const vit = st.wk === "dagger" && pasOn(p, "vitals") ? marksOf(S, mob) * SKILL.vitals.crit : 0;
  const crit = !graze && (sure || rnd(S) * 100 < st.crit + vit + (o.crit || 0));
  // 거검의 관성: each stack a sword carries adds to its critical damage
  const critd = st.critd + (st.wk === "sword" ? inertOf(p) * SKILL.inertia.critd : 0);
  let dmg = st.atk * mult * (0.85 + rnd(S) * 0.3) * (crit ? critd : 1) * (graze ? SFX.grazeK : 1) - d.def * ((o.mag ?? st.mag) ? SFX.magDef : SFX.physDef) * (1 - (o.ign || 0));
  // a dagger in a back that is not watching you
  if (st.wk === "dagger" && mob.tgt !== p.pid) dmg *= 1 + st.sneak;
  dmg *= 1 + 0.03 * masteryRank(p.ch, mob.k);
  if (st.lg.giant && (mob.el || d.boss)) dmg *= 1.3;
  if (has(mob, "tough")) dmg *= 0.6;
  if (mob.vuln > S.now) dmg *= 1.3;
  // 금서의 낙인: a branded monster takes more from everyone
  if (mob.brand > S.now) dmg *= 1 + SKILL.brand.k;
  // a sword hit builds inertia, once an action
  if (st.wk === "sword" && p.inAct !== p.actN && pasOn(p, "inertia")) {
    p.inAct = p.actN;
    p.inert = Math.min(SKILL.inertia.max, inertOf(p) + 1);
    p.inertAt = S.now;
    if (p.inert === SKILL.inertia.max) rt.ev.push(["a", p.eid, 110, Math.round(p.x), Math.round(p.y - 6), p.dir]);
  }
  // a book's skill brands what it strikes
  if (o.sk && skOf(o.sk, "book") && !d.chest && pasOn(p, "brand")) {
    if (!(mob.brand > S.now)) rt.ev.push(["a", p.eid, 114, Math.round(mob.x), Math.round(mob.y - 6), p.dir]);
    mob.brand = S.now + SKILL.brand.ms;
  }
  dmg = Math.max(1, Math.round(dmg));
  // thorns: a blow struck from up close costs the striker a little (never the last of their health)
  if (has(mob, "thorn") && st.arm.range < 60 && !p.dead) {
    const back = Math.min(p.hp - 1, Math.max(1, Math.round(dmg * 0.12)));
    if (back > 0) { p.hp -= back; rt.ev.push(["h", p.eid, back, 0, 1]); }
  }
  if (st.ls > 0 && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + Math.max(1, Math.round((dmg * st.ls) / 100)));
  const x = mob.x, y = mob.y;
  wmHit(S, p, mob);
  if (!dealMob(S, rt, mob, p, dmg, graze ? 2 : crit)) {
    // whatever is hit (and lives) staggers for a moment and is nudged back; the biggest things shrug it off
    if (!mob.dead) stagger(S, mob, p, crit);
    return;
  }
  // legendary powers that answer a kill
  if (st.lg.feast && !p.dead) p.hp = Math.min(st.mhp, p.hp + st.mhp * 0.04);
  if (st.lg.nova && !p.chainKill) {
    p.chainKill = true;
    rt.ev.push(["b", Math.round(x), Math.round(y), 34, 1]);
    for (const o of mobsWithin(rt, x, y, 34)) hurtMob(S, rt, o, p, 0.8);
    p.chainKill = false;
  }
}

function killMob(S, rt, mob) {
  const d = MOBS[mob.k];
  const el = mob.el;
  mob.dead = true;
  mob.respAt = S.now + (mob.fix === 2 ? GUARD_RESP : d.resp);
  // a cell's monster leaves its slot: the cell refills it once its time is up (80-simulation.js cellPass)
  if (mob.slot) { mob.slot.mob = null; mob.slot.due = mob.respAt; rt.lastKill[mob.slot.c] = S.now; mob.slot = null; mob.cellGone = true; }
  mob.tgt = null;
  mob.dot = null;
  mob.mk = 0; mob.dec = null; mob.vuln = 0; mob.brand = 0;
  rt.ev.push(["k", mob.id]);
  // the hands that struck it learn from it
  wmKill(S, rt, mob);
  // everyone who hit it, plus their party members standing nearby, shares the kill
  const looters = new Set();
  let top = null, topDmg = 0;
  for (const pid of Object.keys(mob.by)) {
    const p = S.players[pid];
    if (!p || p.map !== rt.id) continue;
    if (mob.by[pid] > topDmg) { top = p; topDmg = mob.by[pid]; }
    for (const o of allies(S, p)) if (!o.dead) looters.add(o);
  }
  mob.by = {};
  const xp = d.xp * ELITE[el].xp;
  for (const p of looters) {
    const ch = p.ch;
    // a chest is opened, not hunted: it pays out its loot and nothing else
    if (d.chest) { p.dirty = true; lootFor(S, rt, mob, p); dailyProg(S, p, "chest"); if (cosRoll(S, p, "chest") < COS_CHEST) cosFrom(S, p, "chest", "보물 상자"); continue; }
    const n = Math.min(PARTY_MAX, allies(S, p).length);
    // a kill soon after the last one keeps the streak alive
    p.streak = S.now - p.streakAt < STREAK_MS ? p.streak + 1 : 1;
    p.streakAt = S.now;
    const rank = masteryRank(ch, mob.k);
    gainXp(S, p, xp * PARTY_SHARE[n - 1] * (1 + Math.min(STREAK_MAX, p.streak - 1) * 0.02 + rank * 0.02 + guildNear(S, p) * GUILD_XP));
    ch.kills = (ch.kills || 0) + 1;
    ch.mk[mob.k] = (ch.mk[mob.k] || 0) + 1;
    const now = masteryRank(ch, mob.k);
    if (now > rank) {
      toast(p, `토벌 숙련 [${d.name}] ${now}단계 — 피해 +${now * 3}%, 경험치 +${now * 2}%`);
      rt.ev.push(["u", p.eid, 2]);
      if (rank === 0 && HUNTED.includes(mob.k)) registered(S, p, mob.k);
    }
    const q = ch.q;
    const quest = QUESTS[q.i];
    if (q.st === 1 && quest && quest.mob === mob.k && q.n < quest.n) {
      q.n++;
      if (q.n >= quest.n) toast(p, `의뢰 [${quest.title}] 달성! 관리자에게 돌아가세요.`);
    }
    const bq = ch.bq;
    if (bq && bq.k === mob.k && bq.n < bq.need) {
      bq.n++;
      if (bq.n >= bq.need) toast(p, `반복 의뢰 [${d.name} ${bq.need}마리] 달성! 관리자에게 보고하세요.`);
    }
    sqProgress(S, p, "kill", (g) => g.mob === mob.k);
    if (el === 1) ch.cnt.elite++;
    else if (el === 2) { if (mob.evt) ch.cnt.evb++; else if (mob.temp) ch.cnt.fb++; else ch.cnt.guard++; }
    if (n >= 2) ch.cnt.party++;
    dailyProg(S, p, "kill", mob.k);
    if (el >= 1) dailyProg(S, p, "elite");
    if (mob.k === "twinhare") tutStep(S, p, "hunt");
    checkAch(S, p);
    p.dirty = true;
    lootFor(S, rt, mob, p);
    // a field boss, a guardian or a boss may leave something to wear
    if ((el === 2 || d.boss) && cosRoll(S, p, "boss") < COS_BOSS) cosFrom(S, p, "boss", d.name);
  }
  if (d.boss && top) sys(S, `${top.ch.name}님의 일행이 ${d.name}${pp(d.name, "을를")} 쓰러뜨렸습니다!`);
  if (el === 2) {
    if (mob.evt) { if (S.evt) S.evt.bossDead = true; }
    else if (mob.temp) rt.fb = 0;
    if (top) sys(S, `${top.ch.name}님의 일행이 ${mapOfS(S, rt.id).name}의 ${mob.evt ? "침공 우두머리" : mob.temp ? "우두머리" : "수문장"} [${d.name}]${pp(d.name, "을를")} 쓰러뜨렸습니다!`);
  }
  // some monsters go off where they fall, and so does any elite with the trait
  if (d.burst || has(mob, "burst")) {
    const r = d.burst || 34;
    rt.tele.push({ x: mob.x, y: mob.y, r, at: S.now + 900, dmg: d.atk * ELITE[el].atk * 1.3 });
    rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), r, 900]);
  }
  // enough kills in one hunting ground call out its field boss
  if (!d.boss && !d.chest && !mob.evt && el < 2 && FIELD_BOSS[rt.id] && looters.size) {
    rt.kc++;
    if (rt.kc >= FB_KILLS && !rt.fb) spawnFieldBoss(S, rt, mob.x, mob.y);
  }
  // inside a 차원 균열: the gauge, orbs and shrines, the master (64-dim.js)
  if (mob.dim) dimKill(S, rt, mob, looters);
}
/**
 * The last thing that hurt a player, kept so a fall can say what did it (the death window
 * shows it with a word of advice): `by` is the label players see over its head.
 */
function blameOf(mob) {
  const d = MOBS[mob.k];
  const rank = d.boss ? "보스 " : mob.el === 2 ? (mob.evt ? "침공 우두머리 " : mob.temp ? "우두머리 " : "수문장 ") : mob.el ? "정예 " : "";
  return { by: `Lv.${shownLv(d.lv)} ${rank}${d.name}`, lv: shownLv(d.lv), el: d.boss ? 3 : mob.el | 0 };
}
function hurtPlayer(S, rt, p, raw, mob) {
  if (p.dead || S.now < (p.ghost || 0)) return;
  const st = stats(p);
  // inside a dark knight's blood sanctuary a blow lands lighter (57-weapon-skills.js)
  const ward = S.now < (p.sanctAt || 0) ? 1 - SKILL.sanctuary.guard : 1;
  const dmg = Math.max(1, Math.round((raw * (0.85 + rnd(S) * 0.3) - st.def * 0.6) * st.guard * ward));
  p.hp -= dmg;
  p.hitAt = S.now;
  rouse(S, p);
  if (mob) p.blame = blameOf(mob);
  rt.ev.push(["h", p.eid, dmg, 0, 1]);
  if (mob && st.lg.thorn) dealMob(S, rt, mob, p, Math.max(1, Math.round(dmg * 0.4)), 0);
  if (p.hp <= 0) fall(S, rt, p);
}
/** Damage that no armour turns: fire, poison. */
function wound(S, rt, p, dmg) {
  if (p.dead || S.now < (p.ghost || 0)) return;
  cancelRecall(S, p, "귀환이 취소되었습니다.");
  p.hp -= dmg;
  p.hitAt = S.now;
  rt.ev.push(["h", p.eid, dmg, 0, 1]);
  if (p.hp <= 0) fall(S, rt, p);
}
function fall(S, rt, p) {
  p.hp = 0;
  p.dead = true;
  p.streak = 0;
  p.burn = null; p.poison = null; p.slowed = 0;
  weaponReset(p, true);
  dropAggro(S, p);
  rt.ev.push(["pd", p.eid]);
  toast(p, p.blame ? `쓰러졌습니다... (${p.blame.by})` : "쓰러졌습니다...");
  p.dirty = true;
}

const big = (mob) => (MOBS[mob.k].boss ? 12 : mob.el === 2 ? 8 : 0);
function mobsWithin(rt, x, y, r) {
  return rt.mobs.filter((mob) => !mob.dead && dist(x, y, mob.x, mob.y) - big(mob) <= r);
}
/** Monsters standing in a strip `len` long from (x, y) along the unit vector (ux, uy). */
function mobsInLine(rt, x, y, ux, uy, len, half) {
  return rt.mobs.filter((o) => {
    if (o.dead) return false;
    const rx = o.x - x, ry = o.y - y;
    const along = rx * ux + ry * uy;
    return along > -4 && along < len && Math.abs(rx * uy - ry * ux) < half + big(o);
  });
}
/** Shove a monster `far` along (ux, uy), stopping at anything solid. */
function knock(m, mob, ux, uy, far) {
  if (MOBS[mob.k].boss || MOBS[mob.k].still || mob.el === 2) return;
  const ok = MOBS[mob.k].fly ? canFly : canStand;
  // slide back a little at a time and stop at the first thing in the way, so a blow never throws anything through a wall
  let go = 0;
  for (let k = 4; k <= far; k += 4) { if (!ok(m, mob.x + ux * k, mob.y + uy * k)) break; go = k; }
  if (go < far && go + 4 > far && ok(m, mob.x + ux * far, mob.y + uy * far)) go = far;
  mob.x += ux * go; mob.y += uy * go;
}
function face(p, mob) {
  p.dir = dirOf(mob.x - p.x, mob.y - p.y);
}
/** The AIM_N unit vectors a player can aim along (0 = +x, a quarter turn = +y). */
const AIM_V = [];
for (let i = 0; i < AIM_N; i++) { const a = (i / AIM_N) * 2 * Math.PI; AIM_V.push([Math.round(Math.cos(a) * 1e9) / 1e9, Math.round(Math.sin(a) * 1e9) / 1e9]); }
/** The aim step nearest the direction (dx, dy). */
const aimIdx = (dx, dy) => ((Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * AIM_N) % AIM_N) + AIM_N) % AIM_N;
const validAim = (v) => Number.isInteger(v) && v >= 0 && v < AIM_N;
/** Aim along step `i`; the body turns with it. */
function setAim(p, i) {
  p.aim = i;
  p.dir = dirOf(AIM_V[i][0], AIM_V[i][1]);
}
/**
 * Does monster `o` stand within `half` degrees either side of where the player aims?
 * A big body is easier to catch at the edge, and one right underfoot is always caught.
 */
function inArc(p, o, half) {
  const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
  if (d < 4) return true;
  const [ax, ay] = AIM_V[p.aim | 0];
  const off = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
  return off <= (half * Math.PI) / 180 + Math.atan2(big(o) + 4, d);
}
/** Aim assist: the nearest monster within `range` that stands in the arc, or null. */
function aimMob(rt, p, range, half) {
  let best = null, bd = range;
  for (const mob of rt.mobs) {
    if (mob.dead) continue;
    const d = dist(p.x, p.y, mob.x, mob.y) - big(mob);
    if (d <= bd && inArc(p, mob, half)) { bd = d; best = mob; }
  }
  return best;
}
/** The unit vector from a player toward a monster, or the way the player aims. */
function aimVec(p, mob) {
  if (!mob) return AIM_V[p.aim | 0];
  const d = dist(p.x, p.y, mob.x, mob.y) || 1;
  return [(mob.x - p.x) / d, (mob.y - p.y) / d];
}

/** How long a basic attack takes now. */
function atkCd(p) {
  return stats(p).acd;
}
/** How far a basic attack reaches now: a greatsword with inertia (거검의 관성) reaches further. */
function atkRange(p) {
  const st = stats(p), r = st.arm.range;
  return st.wk === "sword" ? r * (1 + inertOf(p) * SKILL.inertia.reach) : r;
}

function basicAttack(S, p) {
  rouse(S, p);
  const st = stats(p);
  const c = st.arm;
  const rt = S.maps[p.map];
  const now = S.now;
  // one, two, three: the third blow of an unbroken run is the finisher
  p.combo = now - p.atkAt < atkCd(p) + COMBO_MS ? (p.combo + 1) % 3 : 0;
  const fin = p.combo === 2;
  p.atkAt = now;
  newAct(p, false);
  // a bow looses an arrow that flies (45-jobs.js): it lands, or not, a few ticks later
  if (c.shot) { bowShot(S, rt, p, fin); return; }
  const range = atkRange(p);
  // the blow goes where you aim: the nearest monster inside the weapon's arc, or nothing
  const arc = c.arc || AIM_CONE;
  const mob = aimMob(rt, p, range, arc);
  if (!mob) {
    const far = range < 60 ? 14 : range * 0.7, [ax, ay] = AIM_V[p.aim | 0];
    rt.ev.push(["a", p.eid, c.fx, Math.round(p.x + ax * far), Math.round(p.y - 6 + ay * far), p.dir, p.combo]);
    return;
  }
  face(p, mob);
  // 창끝의 거리: a spear blow landing at the far end of the reach hits harder and through armour
  const tip = c === WKIND.spear && pasOn(p, "tip") && dist(p.x, p.y, mob.x, mob.y) - big(mob) >= c.range * SKILL.tip.at;
  if (tip) rt.ev.push(["tip", mob.id]);
  rt.ev.push(["a", p.eid, c.fx, Math.round(mob.x), Math.round(mob.y - 6), p.dir, p.combo]);
  const mult = (c.mult || 1) * (fin ? FINISH.mult : 1);
  // a greatsword's arc catches what stands beside the target, a spear runs through
  // what stands behind it, and a spellbook's burst splashes around it
  // (only ever in front: nothing behind the swing is caught by it)
  let extra = [];
  const near = (a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y);
  if (c.cleave) extra = mobsWithin(rt, p.x, p.y, range + (fin ? 10 : 4)).filter((o) => o !== mob && inArc(p, o, arc * (fin ? 1.25 : 1))).sort(near).slice(0, c.cleave + (fin ? 1 : 0));
  else if (c.line) { const [ux, uy] = aimVec(p, mob); extra = mobsInLine(rt, p.x, p.y, ux, uy, c.range + 10, fin ? 16 : 11).slice(0, c.line + (fin ? 1 : 0)); }
  else if (c.splash) { const [ux, uy] = aimVec(p, mob); extra = mobsWithin(rt, mob.x, mob.y, c.splash + (fin ? 8 : 0)).filter((o) => (o.x - p.x) * ux + (o.y - p.y) * uy > -4).slice(0, 4); }
  const zx = mob.x, zy = mob.y;
  // the blow lands with weight: whatever it hits is shoved back and reels, the
  // finisher most of all. Elites only reel; bosses and field bosses stand firm.
  const shove = (o, k) => {
    if (MOBS[o.k].boss || o.el === 2 || steady(S, o)) return;
    if (!o.el) { const [ux, uy] = aimVec(p, o); knock(mapOfS(p.S, p.map), o, ux, uy, c.kb * k * (fin ? FINISH.kb : 1)); }
    holdMob(S, o, (fin ? FINISH.stun : 150) * (o.el ? 0.6 : 1) + (tip && o === mob ? TIP.flinch : 0));   // reels: cooldowns paused
  };
  shove(mob, 1);
  // 급소 도려내기: a stab on a marked monster opens it up (bleeding, and a burst of speed); every stab marks
  const vit = c === WKIND.dagger && pasOn(p, "vitals") ? SKILL.vitals : null;
  const marked = vit && marksOf(S, mob) > 0;
  hurtMob(S, rt, mob, p, mult * (tip ? SKILL.tip.mult : 1), false, tip ? { ign: SKILL.tip.ign } : null);
  if (vit && !mob.dead) {
    if (marked) {
      if (!(mob.dot && mob.dot.until > now && mob.dot.pid === p.pid)) rt.ev.push(["a", p.eid, 111, Math.round(mob.x), Math.round(mob.y - 6), p.dir]);
      mob.dot = { until: now + vit.ms, next: now + 1000, dmg: Math.max(1, Math.round(st.atk * vit.bleed)), pid: p.pid };
      p.vitSpd = now + vit.spdMs;
    }
    addMarks(S, mob, 1);
  }
  for (const o of extra) if (o !== mob) { shove(o, 0.6); hurtMob(S, rt, o, p, mult * 0.6); }
  if (st.lg.chain && rnd(S) < 0.25 * st.proc) {
    for (const o of mobsWithin(rt, zx, zy, 70).filter((o) => o !== mob).slice(0, 2)) {
      rt.ev.push(["z", Math.round(zx), Math.round(zy - 6), Math.round(o.x), Math.round(o.y - 6), 0]);
      hurtMob(S, rt, o, p, 0.6);
    }
  }
}

