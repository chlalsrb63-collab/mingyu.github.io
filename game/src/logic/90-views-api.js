function dailyView(p) {
  const ch = p.ch, dl = ch.daily;
  if (!dl) return null;
  return {
    day: dl.day, reset: Math.max(0, nextReset(p.S.now) - p.S.now), bonus: dl.bonus, bonusReward: dailyBonus(ch),
    tasks: dl.tasks.map((t, i) => ({ kind: t.kind, k: t.k, n: t.n, need: t.need, done: t.n >= t.need, claimed: dl.claimed[i], text: dailyText(t), reward: dailyReward(ch, t) })),
  };
}
function selfPayload(p) {
  const ch = p.ch;
  const st = stats(p);
  const now = p.S.now;
  const trc = {};
  for (const k of Object.keys(TRAIN)) trc[k] = [trainCost(ch.tr[k]), trainTotal(ch.tr[k], 10)];
  const enh = {};
  for (const k of SLOTS) enh[k] = ch.eq[k] && !isJewel(ch.eq[k].id) ? enhCost(ch.eq[k]) : null;
  return {
    name: ch.name, cls: ch.cls, lvl: ch.lvl, xp: ch.xp, need: ch.lvl >= MAXLV ? 0 : xpNeed(ch.lvl), gold: ch.gold,
    mhp: st.mhp, mmp: st.mmp, atk: st.atk, def: st.def, crit: st.crit, critd: Math.round(st.critd * 100), ls: st.ls, xpb: st.xp, mf: st.mf, spd: st.spd0,
    goldb: st.gold, lg: Object.keys(st.lg), wk: weaponKind(ch), acd: atkCd(p), range: atkRange(p),
    // the class gauge, and what each skill costs this moment
    cr: crView(p, now), skm: SKILLS[ch.cls].map((_, i) => skMp(p, i)),
    inv: ch.inv, eq: ch.eq, q: ch.q, kills: ch.kills || 0, tr: ch.tr, trc, enh, qs: ch.qs,
    bq: ch.bq, bn: ch.bn, mk: ch.mk, streak: [p.streak, Math.max(0, STREAK_MS - (now - p.streakAt))],
    cds: p.cds.map((t) => Math.max(0, t - now)),
    // attack up, speed up, warmth, food — then what monsters leave on you: slowed, burning, poisoned —
    // then the scrolls being read: attack, defence, experience
    buffs: [Math.max(0, p.atkBuff - now), Math.max(0, p.spdBuff - now), Math.max(0, p.warm - now), p.food ? Math.max(0, p.food.until - now) : 0,
      Math.max(0, (p.slowed || 0) - now), p.burn ? Math.max(0, p.burn.until - now) : 0, p.poison ? Math.max(0, p.poison.until - now) : 0,
      Math.max(0, ch.scr.atk - now), Math.max(0, ch.scr.def - now), Math.max(0, ch.scr.xp - now)],
    // skill levels and what the next level of each costs ({ gold, xp, lvl } or null at the top)
    skl: ch.skl, skc: SKILLS[ch.cls].map((sk, i) => (ch.skl[i] >= SK_MAX ? null : skillCost(sk, ch.skl[i]))),
    wh: ch.wh, pet: ch.pet, opt: ch.opt, cos: ch.cos,
    dead: p.dead ? { loss: deathLoss(ch), feather: countItem(ch, "feather") } : null,
    warm: p.warmPct, food: p.food ? p.food.id : null, guild: ch.guild, gm: ch.gm, fishN: ch.fish,
    wp: ch.wp, seen: ch.seen, ach: ch.ach, pts: achPoints(ch), title: ch.title, col: REGIONS.filter((id) => regionDone(ch, id)), st: ch.st,
    daily: dailyView(p), tut: { i: ch.tut.i, n: ch.tut.n }, evt: evtView(p.S, p), recall: p.recall ? Math.max(0, p.recall.at - now) : 0,
    gmates: ch.guild ? Object.keys(p.S.players).map((id) => p.S.players[id]).filter((o) => o.ch.guild === ch.guild).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, MAPS[o.map].name, o.ch.gm]) : [],
  };
}

/**
 * One player's slice of the world for this tick: only their map, only what is
 * near them, and their own sheet only when it changed.
 */
export function viewFor(S, pid) {
  const p = S.players[pid];
  if (!p) return null;
  const rt = S.maps[p.map];
  const near = (o) => Math.abs(o.x - p.x) < VIEW_X && Math.abs(o.y - p.y) < VIEW_Y;
  const out = {
    type: "snap",
    me: [Math.round(p.x), Math.round(p.y), Math.round(p.hp), Math.round(p.mp), p.dead ? 1 : 0, p.fix ? 1 : 0, p.dir, p.sit ? 1 : 0, flagsOf(p, S.now), crValue(p, S.now), p.aim | 0],
    P: [], M: [], D: [], F: [],
  };
  for (const oid of Object.keys(S.players)) {
    const o = S.players[oid];
    if (o === p || o.map !== p.map || !near(o)) continue;
    out.P.push([o.eid, Math.round(o.x), Math.round(o.y), o.dir, o.dead ? 1 : 0, Math.round(o.hp), stats(o).mhp, o.sit ? 1 : 0, flagsOf(o, S.now)]);
  }
  for (const mob of rt.mobs) {
    if (mob.dead || !near(mob)) continue;
    const mk = marksOf(S, mob);
    out.M.push(mk ? [mob.id, mob.k, Math.round(mob.x), Math.round(mob.y), mob.dir, Math.ceil(mob.hp), mob.el, mob.tr || [], mk] : [mob.id, mob.k, Math.round(mob.x), Math.round(mob.y), mob.dir, Math.ceil(mob.hp), mob.el, mob.tr || []]);
  }
  for (const dr of rt.drops) {
    if (near(dr) && (dr.own === pid || S.now >= dr.freeAt)) out.D.push([dr.id, dr.it, Math.round(dr.x), Math.round(dr.y), dr.q]);
  }
  for (const f of rt.fires) if (near(f)) out.F.push([f.id, f.x, f.y]);
  if (rt.ev.length) out.ev = rt.ev;
  // guild chat reaches only the guild
  if (S.chat.length) { const chat = S.chat.filter((c) => (!c.g || c.g === p.ch.guild) && (!c.pt || c.pt === p.party)); if (chat.length) out.chat = chat; }
  if (p.sendMap) out.map = mapPayload(MAPS[p.map]);
  if (p.sendMap || rt.who) {
    out.who = [];
    for (const oid of Object.keys(S.players)) {
      const o = S.players[oid];
      if (o.map !== p.map) continue;
      // what everyone can see of this player: look, party, and the weapon in hand
      // (its tier, rarity, enhancement and kind)
      const ar = o.ch.eq.armor, wp = o.ch.eq.weapon;
      out.who.push([o.eid, o.ch.name, o.ch.cls, o.ch.lvl, o.ch.look, ar ? ITEMS[ar.id].tier : 0, wp ? ITEMS[wp.id].tier : 0, o.party,
        wp ? wp.q : 0, wp ? wp.enh : 0, o.ch.pet || 0, weaponKind(o.ch), o.ch.guild, titleOf(o.ch),
        // the outfit (cosmetic codes, slot order) and the weapon's legendary power or set, for its look
        cosWire(o.ch), wp ? wp.lg || wp.set || "" : ""]);
    }
  }
  if (p.party) {
    out.party = members(S, p).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, Math.round(o.hp), stats(o).mhp, o.map === p.map ? "" : MAPS[o.map].name]);
  }
  if (p.pinv) {
    const from = S.players[p.pinv.from];
    if (from) out.pinv = from.ch.name;
  }
  if (p.ginv) {
    const from = S.players[p.ginv.from];
    if (from) out.ginv = [from.ch.name, p.ginv.g];
  }
  if (p.dirty) out.self = selfPayload(p);
  if (p.gain.length) out.gain = p.gain;
  if (p.toast.length) out.toast = p.toast;
  p.sendMap = false; p.fix = false; p.dirty = false; p.gain = []; p.toast = [];
  return out;
}

/** Static tables the browser needs to draw windows and tooltips. Sent once. */
/**
 * The generated world as the generators left it, for the map tests: every map with
 * its spawns, set pieces and region count, plus the camps and waypoint stones. With
 * `fresh`, everything is generated again from the seeds (for checking determinism).
 */
export function atlas(fresh = false) {
  const maps = fresh ? buildMaps() : MAPS;
  return { maps, fires: FIRES, waypoints: WP };
}

export function defs() {
  const mobs = {};
  for (const k of Object.keys(MOBS)) {
    const d = MOBS[k];
    mobs[k] = { name: d.name, sp: d.sp, tint: d.tint || null, lv: d.lv, hp: d.hp, boss: d.boss ? 1 : 0, chest: d.chest ? 1 : 0, xp: d.xp, fly: d.fly ? 1 : 0 };
  }
  const classes = {};
  for (const k of Object.keys(CLASSES)) {
    const arm = WKIND[CLASSES[k].wk[0]];
    classes[k] = { name: CLASSES[k].name, arm: CLASSES[k].arm, wk: CLASSES[k].wk, cd: arm.cd, range: arm.range };
  }
  const affix = {};
  for (const [k, label, prefix] of AFFIX) affix[k] = [label, prefix];
  return {
    items: ITEMS, mobs, classes, skills: SKILLS, shop: SHOP, quests: QUESTS, enh: ENH_RATE, inv: INV, maxLv: MAXLV,
    affix, runes: RUNES, runewords: RUNEWORDS, rarity: RARITY, train: TRAIN, eliteHp: ELITE.map((e) => e.hp), partyMax: PARTY_MAX,
    slots: SLOTS, wkinds: WKIND, legend: LEGEND, sets: SETS, mastery: MASTERY, bounty: BOUNTY_N, fbKills: FB_KILLS,
    traits: TRAITS, slow: SLOW, aim: [AIM_N, AIM_CONE], skMax: SK_MAX, mech: { grit: GRIT_MAX, marks: MARK_MAX, focus: FOCUS_MAX, tip: TIP.at, tipMult: TIP.mult, react: REACT, elem: ELEM, weaveMs: WEAVE_MS }, skStep: SK_STEP, whSlots: WH, filters: ["모두", "마법 이상", "희귀 이상"], petMs: PET_MS,
    waypoints: Object.keys(WP).map((id) => ({ id, name: MAPS[id].name, band: MAPS[id].band || null })),
    // the wardrobe: id → { n wire code, slot, name, q rarity, src, price, ach, desc }; `cosN[n]` the id of a code
    cos: COSMETICS, cosSlots: COS_SLOTS, cosSlotName: COS_SLOT_NAME, cosN: COS_BY_N,
    achievements: ACH.map(({ id, cat, name, desc, pts, title, bonus }) => ({ id, cat, name, desc, pts, title, bonus })),
    collection: Object.fromEntries(REGIONS.map((id) => [id, { mobs: COL_MOBS[id], bonus: REGION_BONUS[id] }])), colNeed: MASTERY[0],
    event: { every: EVT.every, warn: EVT.warn, len: EVT.len, waves: EVT.waves, boss: EVT.boss, maps: EVT_MAPS },
    daily: { resetKST: 6, text: DAILY_TEXT }, tutorial: TUT.map(({ id, title, hint, need }) => ({ id, title, hint, need: need || 1 })), recallMs: RECALL_MS,
    streak: [STREAK_MS, STREAK_MAX], guildCost: GUILD_COST, guildXp: GUILD_XP, fireR: FIRE_R, lookCost: LOOK_COST, lookMax: LOOK_MAX, emotes: EMOTES, maps: Object.keys(MAPS).map((id) => ({ id, name: MAPS[id].name, band: MAPS[id].band || null, mobs: [...new Set(MAPS[id].spawns.map((sp) => sp.k))] })),
  };
}
