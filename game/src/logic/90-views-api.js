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
      Math.max(0, ch.scr.atk - now), Math.max(0, ch.scr.def - now), Math.max(0, ch.scr.xp - now),
      // then 질주의 바람 (a wind shrine's push)
      Math.max(0, (p.wind || 0) - now),
      // then 안락한 휴식 (a bed or a hearth at home, 64-housing.js)
      Math.max(0, ch.house.cozy - now)],
    // skill levels and what the next level of each costs ({ gold, xp, lvl } or null at the top)
    skl: ch.skl, skc: SKILLS[ch.cls].map((sk, i) => (ch.skl[i] >= SK_MAX ? null : skillCost(sk, ch.skl[i]))),
    wh: ch.wh, pet: ch.pet, opt: ch.opt, cos: ch.cos, sq: sqView(ch),
    dead: p.dead ? { loss: deathLoss(ch), feather: countItem(ch, "feather"), by: p.blame ? p.blame.by : null, lv: p.blame ? p.blame.lv : 0, el: p.blame ? p.blame.el : 0 } : null,
    warm: p.warmPct, food: p.food ? p.food.id : null, guild: ch.guild, gm: ch.gm, fishN: ch.fish,
    // waypoint stones woken: { mapId: bitmask } (bit 0 = the map's first stone)
    wp: ch.wp, seen: ch.seen, ach: ch.ach, pts: achPoints(ch), title: ch.title, col: REGIONS.filter((id) => regionDone(ch, id)), st: ch.st,
    daily: dailyView(p), tut: { i: ch.tut.i, n: ch.tut.n }, evt: evtView(p.S, p), recall: p.recall ? Math.max(0, p.recall.at - now) : 0,
    gmates: ch.guild ? Object.keys(p.S.players).map((id) => p.S.players[id]).filter((o) => o.ch.guild === ch.guild).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, mapOfS(o.S, o.map).name, o.ch.gm]) : [],
    // the bag's size (46-bag.js) and the house (64-housing.js homeSelf)
    bagCap: bagCap(ch), house: homeSelf(p),
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
    // a field boss (or the rift invasion's lord) is shown on the radar wherever it stands on the map
    if (mob.temp && mob.el === 2 && !mob.dim && !mob.dead) (out.fb || (out.fb = [])).push([Math.round(mob.x), Math.round(mob.y)]);
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
  if (p.sendMap) out.map = mapPayload(mapOfS(S, p.map));
  // the sky: [weather (-1 under a roof), server clock in seconds], when the weather turns, on
  // arrival, and once a minute to keep everyone's hour of the day in step
  const wx = rt.wx ?? weatherAt(p.map, S.now);
  if (p.sendMap || wx !== p.wx || S.now - (p.dnAt || 0) >= 60000) { out.dn = [wx, Math.floor(S.now / 1000)]; p.wx = wx; p.dnAt = S.now; }
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
    // … then where each stands (pixels, for the radar and the map window) and the id of their map
    out.party = members(S, p).map((o) => [o.eid, o.ch.name, o.ch.cls, o.ch.lvl, Math.round(o.hp), stats(o).mhp, o.map === p.map ? "" : mapOfS(o.S, o.map).name, Math.round(o.x), Math.round(o.y), o.map]);
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
  dimView(S, p, out);
  if (p.toast.length) out.toast = p.toast;
  p.sendMap = false; p.fix = false; p.dirty = false; p.gain = []; p.toast = [];
  return out;
}

/** Static tables the browser needs to draw windows and tooltips. Sent once. */
/**
 * The generated world as the generators left it, for the map tests: every map with
 * its spawns, set pieces and region count, plus the camps and waypoint stones (this
 * builds every map). With `fresh`, everything (or only `ids`) is generated again from
 * the seeds, apart from the kept maps (for checking determinism and build time).
 */
export function atlas(fresh = false, ids = null) {
  if (!fresh) return { maps: allMaps(), fires: FIRES, waypoints: WP };
  const maps = {};
  for (const id of ids || Object.keys(MAP_META)) {
    maps[id] = finishMap(baseMap(id));
    for (const pt of maps[id].portals) arrivalOf(null, pt);
  }
  return { maps, fires: FIRES, waypoints: WP };
}
/** The registry, for the tests: which maps are built so far, and what is known of every map without building it. */
export function mapStats() {
  return { built: Object.keys(MAP_CACHE), meta: MAP_META };
}

export function defs() {
  const mobs = {};
  for (const k of Object.keys(MOBS)) {
    const d = MOBS[k];
    mobs[k] = { name: d.name, sp: d.sp, tint: d.tint || null, lv: d.lv, hp: d.hp, boss: d.boss ? 1 : 0, chest: d.chest ? 1 : 0, xp: d.xp, fly: d.fly ? 1 : 0, aggro: d.aggro || 0 };
  }
  const classes = {};
  for (const k of Object.keys(CLASSES)) {
    const arm = WKIND[CLASSES[k].wk[0]];
    classes[k] = { name: CLASSES[k].name, arm: CLASSES[k].arm, wk: CLASSES[k].wk, cd: arm.cd, range: arm.range };
  }
  const affix = {};
  for (const [k, label, prefix] of AFFIX) affix[k] = [label, prefix];
  return {
    items: ITEMS, mobs, classes, skills: SKILLS, shop: SHOP, quests: QUESTS, enh: ENH_RATE, inv: INV_BASE, invMax: INV_MAX, bag: { step: BAG_STEP, cost: BAG_COST }, house: homeDefs(), maxLv: MAXLV,
    affix, runes: RUNES, runewords: RUNEWORDS, rarity: RARITY, train: TRAIN, eliteHp: ELITE.map((e) => e.hp), partyMax: PARTY_MAX,
    slots: SLOTS, wkinds: WKIND, legend: LEGEND, sets: SETS, mastery: MASTERY, bounty: BOUNTY_N, fbKills: FB_KILLS,
    traits: TRAITS, slow: SLOW, aim: [AIM_N, AIM_CONE], skMax: SK_MAX, mech: { grit: GRIT_MAX, marks: MARK_MAX, focus: FOCUS_MAX, tip: TIP.at, tipMult: TIP.mult, react: REACT, elem: ELEM, weaveMs: WEAVE_MS }, skStep: SK_STEP, whSlots: WH, filters: ["모두", "마법 이상", "희귀 이상"], petMs: PET_MS,
    // n: how many stones the map has (woken as "<id>" for the first, "<id>#<i>" for the others), names: what each is called
    waypoints: Object.keys(MAP_META).filter(hasWp).map((id) => ({ id, name: MAP_META[id].name, band: MAP_META[id].band, n: MAP_META[id].wpn || 1, names: STONE_NAMES[MAP_META[id].wpn || 1] || [] })),
    // the wardrobe: id → { n wire code, slot, name, q rarity, src, price, ach, desc }; `cosN[n]` the id of a code
    cos: COSMETICS, cosSlots: COS_SLOTS, cosSlotName: COS_SLOT_NAME, cosN: COS_BY_N,
    achievements: ACH.map(({ id, cat, name, desc, pts, title, bonus }) => ({ id, cat, name, desc, pts, title, bonus })),
    collection: Object.fromEntries(REGIONS.map((id) => [id, { mobs: COL_MOBS[id], bonus: REGION_BONUS[id] }])), colNeed: MASTERY[0],
    event: { every: EVT.every, warn: EVT.warn, len: EVT.len, waves: EVT.waves, boss: EVT.boss, maps: EVT_MAPS },
    daily: { resetKST: 6, text: DAILY_TEXT }, tutorial: TUT.map(({ id, title, hint, need }) => ({ id, title, hint, need: need || 1 })), recallMs: RECALL_MS,
    // side quests from the world map editor, with who gives them and where they stand
    side: SIDE.map((q) => ({ ...q, giverName: npcName(q.giver), giverMap: MAP_META[NPC_MAP[q.giver]].name,
      target: q.goal.type === "kill" ? MOBS[q.goal.mob].name : q.goal.type === "collect" ? ITEMS[q.goal.item].name : q.goal.type === "talk" ? npcName(q.goal.npc) : MAP_META[q.goal.map].name })),
    // the turning day and the weather (the client keeps the same clock), the fire's company
    sky: { dayMs: SKY_DAY_MS, phases: PHASES, weather: WEATHER, wxMs: WX_MS, warm: [WARM_N, WARM_BASE, WARM_STEP, WARM_NIGHT, WARM_REGEN], tales: TALES, teller: TELLER.name, jam: JAM },
    streak: [STREAK_MS, STREAK_MAX], guildCost: GUILD_COST, guildXp: GUILD_XP, fireR: FIRE_R, lookCost: LOOK_COST, lookMax: LOOK_MAX, emotes: EMOTES, dim: dimDefs(), maps: Object.keys(MAP_META).map((id) => ({ id, name: MAP_META[id].name, band: MAP_META[id].band, mobs: MAP_META[id].kinds.slice(),
      // the world route map (radar.js): theme, safe, big, how many stones, and the maps its doors lead to
      theme: MAP_META[id].theme, safe: MAP_META[id].safe, w: MAP_META[id].w, h: MAP_META[id].h, wpn: MAP_META[id].wpn, to: ROUTES[id] })),
  };
}
