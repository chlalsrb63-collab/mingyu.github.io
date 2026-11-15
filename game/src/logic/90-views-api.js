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
  const enh = {};
  for (const k of SLOTS) enh[k] = ch.eq[k] && !isJewel(ch.eq[k].id) ? enhCost(ch.eq[k]) : null;
  return {
    // jobs and stats: the job, the level (1 + points), unspent and spent experience, the six stats and
    // what the next point in each costs (0 at a cap), resets left, the starter pick taken, mastery
    // [lv, xp, need] per kind (WK_ORDER), the kinds in hand and on the back
    name: ch.name, job: ch.job, lvl: ch.lvl, xp: ch.xp, xpt: ch.xpt, st: ch.st, nx: nextCosts(ch), rs: ch.rs, sw: ch.sw, respecCost: statResetCost(ch),
    wm: WK_ORDER.map((k) => [ch.wm[k].lv, Math.floor(ch.wm[k].xp),ch.wm[k].lv >= WM_MAX ? 0 : wmNeed(ch.wm[k].lv)]),
    jp: ch.jp ? [ch.jp.lv, ch.jp.xp, ch.jp.lv >= JOB_PROGRESS.cap ? 0 : jobNeed(ch.jp.lv)] : null,
    wk2: ch.eq.weapon2 ? ITEMS[ch.eq.weapon2.id].wk : "",
    // 직업 자유 (47-job-freedom.js): [[job, lv, xp]] every job walked; the loadout [actives, passives, off-job passive, set 1/0, off slot open 1/0]
    jobs: Object.keys(ch.jobs).map((j) => [j, ch.jobs[j].lv, ch.jobs[j].xp]),
    // skill enhancement { [id]: +n } (48-skill-enh.js)
    ske: ch.ske,
    lo: (() => { const lo = loOf(ch); return [lo.a, lo.p, lo.x, ch.lo[ch.job] ? 1 : 0, loOpen(ch) ? 1 : 0, lo.y, loPower(ch)]; })(),
    gold: ch.gold,
    mhp: st.mhp, mmp: st.mmp, atk: st.atk, def: st.def, crit: r1(st.crit), critd: Math.round(st.critd * 100), ls: st.ls, xpb: st.xp, mf: Math.round(st.mf), spd: st.spd0,
    goldb: st.gold, lg: Object.keys(st.lg), wk: weaponKind(ch), acd: atkCd(p), range: atkRange(p),
    // derived: attack type (0 physical, 1 magic), evasion %, attack speed %, cooldown cut %, status resist %, poise %,
    // knockback resist %, elemental burst %, item find from luck %, graze chance on a monster of your own tier %
    dv: [st.mag, r1(st.eva), r1(st.aspd * 100), r1(st.cdr * 100), r1(st.res * 100), r1(st.poise * 100), r1(st.kbr * 100), r1(st.burst * 100),
      r1(Math.min(SFX.mf[1], SFX.mf[0] * eff(ch.st.luk))), clamp(SFX.graze[0] - (ch.eq.weapon ? ch.wm[weaponKind(ch)].lv : 0), 0, SFX.graze[3])],
    // the weapon passive's gauge (57 crView), and every skill learned: [id, MP now, cooldown left ms, usable in hand 1/0]
    cr: crView(p, now), sk: skWire(p, now),
    inv: charmBag(ch.inv), eq: ch.eq, q: ch.q, kills: ch.kills || 0, enh, qs: ch.qs,
    bq: ch.bq, bn: ch.bn, mk: ch.mk, streak: [p.streak, Math.max(0, STREAK_MS - (now - p.streakAt))],
    // attack up, speed up, warmth, food — then what monsters leave on you: slowed, burning, poisoned —
    // then the scrolls being read: attack, defence, experience
    buffs: [Math.max(0, p.atkBuff - now), Math.max(0, p.spdBuff - now), Math.max(0, p.warm - now), p.food ? Math.max(0, p.food.until - now) : 0,
      Math.max(0, (p.slowed || 0) - now), p.burn ? Math.max(0, p.burn.until - now) : 0, p.poison ? Math.max(0, p.poison.until - now) : 0,
      Math.max(0, ch.scr.atk - now), Math.max(0, ch.scr.def - now), Math.max(0, ch.scr.xp - now),
      // then 질주의 바람 (a wind shrine's push)
      Math.max(0, (p.wind || 0) - now),
      // then 안락한 휴식 (a bed or a hearth at home, 64-housing.js)
      Math.max(0, ch.house.cozy - now)],
    wh: ch.wh, pet: ch.pet, opt: ch.opt, cos: ch.cos, cosDye: ch.cosDye, sq: sqView(ch), keep: Object.keys(ch.keep),
    dead: p.dead ? { loss: deathLoss(ch), feather: countItem(ch, "feather"), by: p.blame ? p.blame.by : null, lv: p.blame ? p.blame.lv : 0, el: p.blame ? p.blame.el : 0 } : null,
    warm: p.warmPct, food: p.food ? p.food.id : null, guild: ch.guild, gm: ch.gm, fishN: ch.fish,
    // waypoint stones woken: { mapId: bitmask } (bit 0 = the map's first stone)
    wp: ch.wp, seen: ch.seen, ach: ch.ach, pts: achPoints(ch), title: ch.title, col: REGIONS.filter((id) => regionDone(ch, id)), cnt: ch.cnt,
    daily: dailyView(p), tut: { i: ch.tut.i, n: ch.tut.n }, evt: evtView(p.S, p), recall: p.recall ? Math.max(0, p.recall.at - now) : 0,
    gmates: ch.guild ? Object.keys(p.S.players).map((id) => p.S.players[id]).filter((o) => o.ch.guild === ch.guild).map((o) => [o.eid, o.ch.name, o.ch.job, o.ch.lvl, mapOfS(o.S, o.map).name, o.ch.gm]) : [],
    // the bag's size (46-bag.js) and the house (64-housing.js homeSelf)
    bagCap: bagCap(ch), house: homeSelf(p),
    // 균열 단수 and the weekly boss flags (64-dim.js dimSelf)
    dimr: dimSelf(p),
    // charms (66-charms.js): the board, what waits at 주아나, her quest; a sealed charm's seal never leaves the server
    charms: charmSelf(p),
    // boss trophies held (67-trophies.js): field-boss kinds, in the order won
    tro: p.ch.tro,
    // life skills (58-life.js): [lv, xp, need] per skill in LIFE order; L2: the 알바 board, trust, the 재료 주머니
    life: lifeView(ch), jb: jbView(p), rep: repView(ch), pouch: ch.pouch, fbook: ch.fbook,
    // 버드나무 장날 (63-festival.js): [purse, earned today, my best pan, the day's best, its cook]
    fair: fairSelf(p),
    // the block list, the enhancement pity gauge, the weekly book (63-social-weekly.js)
    ...socialSelf(p),
    // 협동 아르바이트 paid today (68-coop.js)
    coop: coopSelf(p),
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
    me: [Math.round(p.x), Math.round(p.y), Math.round(p.hp), Math.round(p.mp), p.dead ? 1 : 0, p.fix ? 1 : 0, p.dir, p.sit ? 1 : 0, flagsOf(p, S.now), crValue(p, S.now), p.aim | 0, dashLeft(S, p)],
    P: [], M: [], D: [], F: [],
  };
  // me[12] / a P row's [9]: the carry code (58-life.js carryOf), only while something is held
  const held = carryOf(p);
  if (held) out.me.push(held);
  for (const oid of Object.keys(S.players)) {
    const o = S.players[oid];
    if (o === p || o.map !== p.map || !near(o)) continue;
    const row = [o.eid, Math.round(o.x), Math.round(o.y), o.dir, o.dead ? 1 : 0, Math.round(o.hp), stats(o).mhp, o.sit ? 1 : 0, flagsOf(o, S.now)], c = carryOf(o);
    if (c) row.push(c);
    out.P.push(row);
  }
  for (const mob of rt.mobs) {
    // a field boss (or the rift invasion's lord) is shown on the radar wherever it stands on the map
    if (mob.temp && mob.el === 2 && !mob.dim && !mob.dead) (out.fb || (out.fb = [])).push([Math.round(mob.x), Math.round(mob.y)]);
    // (a burrowing monster is underground: not shown until it comes up, 80-simulation.js special)
    if (mob.dead || !near(mob) || (mob.dive && !bsDef(mob))) continue;
    // then, only when there is one: the dagger's marks on it, and 1 when it bears a book's brand
    const mk = marksOf(S, mob), br = mob.brand > S.now ? 1 : 0;
    const row = [mob.id, mob.k, Math.round(mob.x), Math.round(mob.y), mob.dir, Math.ceil(mob.hp), mob.el, mob.tr || []];
    // a scripted boss (56-boss-script.js) always carries both, then its phase, 0 · 1 marked cast · 2 dived out of reach,
    // and while it casts the stagger gauge still to break (%)
    if (bsDef(mob)) row.push(mk || 0, br, mob.bs ? mob.bs.ph : 1, mob.dive ? 2 : mob.cast ? 1 : 0, mob.cast ? Math.ceil(100 * (1 - mob.cast.got / mob.cast.need)) : 0);
    else {
      if (mk || br) row.push(mk);
      if (br) row.push(1);
    }
    out.M.push(row);
    // a rift's toughness (64-dim.js hk: party size, level, tier) — only where it isn't 1, so the bar can show the real HP
    if (mob.hk && mob.hk !== 1) (out.HK || (out.HK = {}))[mob.id] = Math.round(mob.hk * 1000) / 1000;
  }
  for (const dr of rt.drops) {
    if (near(dr) && (dr.own === pid || S.now >= dr.freeAt)) out.D.push([dr.id, dr.it, Math.round(dr.x), Math.round(dr.y), dr.q]);
  }
  for (const f of rt.fires) if (near(f)) out.F.push([f.id, f.x, f.y]);
  if (rt.ev.length) out.ev = rt.ev;
  // guild chat reaches only the guild
  // (and a whisper only its reader, and nobody a name they blocked: 63-social-weekly.js chatFor)
  if (S.chat.length) { const chat = chatFor(S, p, pid); if (chat.length) out.chat = chat; }
  if (p.sendMap) out.map = mapPayload(mapOfS(S, p.map));
  // the sky: [weather (-1 under a roof), server clock in seconds, season 0–3, 장날 open 0/1 (63-festival.js)], when
  // the weather turns or the market opens or closes, on arrival, and once a minute to keep everyone's hour in step
  const wx = rt.wx ?? weatherAt(p.map, S.now), fo = fairOpen(S.now) ? 1 : 0;
  if (p.sendMap || wx !== p.wx || fo !== p.fairDn || S.now - (p.dnAt || 0) >= 60000) { out.dn = [wx, Math.floor(S.now / 1000), seasonOf(S.now), fo]; p.wx = wx; p.fairDn = fo; p.dnAt = S.now; }
  if (p.sendMap || rt.who) {
    out.who = [];
    for (const oid of Object.keys(S.players)) {
      const o = S.players[oid];
      if (o.map !== p.map) continue;
      // what everyone can see of this player: look, party, and the weapon in hand
      // (its tier, rarity, enhancement and kind)
      const ar = o.ch.eq.armor, wp = o.ch.eq.weapon;
      out.who.push([o.eid, o.ch.name, o.ch.job, o.ch.lvl, o.ch.look, ar ? ITEMS[ar.id].tier : 0, wp ? ITEMS[wp.id].tier : 0, o.party,
        wp ? wp.q : 0, wp ? wp.enh : 0, o.ch.pet || 0, weaponKind(o.ch), o.ch.guild, titleOf(o.ch),
        // the outfit (cosmetic codes, slot order) and the weapon's legendary power or set, for its look
        cosWire(o.ch), wp ? wp.lg || wp.set || (ITEMS[wp.id].uniq ? wp.id : "") : "",   // a unique (bosses-2) weapon: its own look (weapons.js MOTIF[id])
        // a hybrid's second weapon, on the back
        o.ch.eq.weapon2 ? ITEMS[o.ch.eq.weapon2.id].wk : ""]);
    }
  }
  if (p.party) {
    // … then where each stands (pixels, for the radar and the map window) and the id of their map
    out.party = members(S, p).map((o) => [o.eid, o.ch.name, o.ch.job, o.ch.lvl, Math.round(o.hp), stats(o).mhp, o.map === p.map ? "" : mapOfS(o.S, o.map).name, Math.round(o.x), Math.round(o.y), o.map]);
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
  coopView(S, p, out);   // 협동 아르바이트: cj, C, cr (68-coop.js)
  sxView(S, p, out);     // requests, trade window, mini-game: sx when it changes (69-social-play.js)
  // this map's gathering nodes the player has spent, when that changes (58-life.js)
  lifeSnap(S, p, out);
  npcLifeSnap(S, p, out);
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

// Fixed positions for the main world map at 1×. Editor maps fall back to layout by route.
const WORLD_MAP_POS = {
  willow: [170, 233], town: [327, 205], meadow: [348, 93], forest: [548, 124], crypt: [723, 133],
  city: [367, 334], sewer: [552, 320], cave: [710, 302], abyss: [928, 335], maple: [824, 229],
  jungle: [203, 417], coast: [370, 528], oasis: [622, 470], dunesea: [838, 516], frostkeep: [915, 91],
  airship: [622, 389], mesa: [764, 386], inklake: [850, 300],
};
const WORLD_MAP_ART = { willow: "willow", frostkeep: "frostkeep", dunesea: "dunesea", airship: "airship" };

function worldMapDefs() {
  // Only custom labels need coordinates to disambiguate the destination. Keep generated terrain lazy.
  const doors = {};
  for (const link of DATA.links) {
    if (typeof link.label !== "string" || !link.label) continue;
    const from = realId(link.map), to = realId(link.to);
    if (!from || !to || !xyOk(MAP_META[from], link.x, link.y) || !xyOk(MAP_META[to], link.tx, link.ty)) continue;
    (doors[from] ??= []).push([link.x, link.y, to]);
  }
  return Object.entries(MAP_META).map(([id, meta]) => {
    const { name, band, kinds, theme, safe, w, h, wpn, minLv } = meta;
    const kind = theme === "interior" ? "in" : safe ? "town" : (minLv || ["crypt", "sewer", "cave", "abyss"].includes(theme)) ? "dun" : "field";
    const bosses = [...new Set([FIELD_BOSS[id], ...kinds.filter((mob) => MOBS[mob].boss)].filter(Boolean))];
    return { id, name, band: band && band.map(shownLv), mobs: kinds.slice(), theme, safe, w, h, wpn, to: ROUTES[id],
      kind, gateLabel: doorName(meta), pos: WORLD_MAP_POS[id]?.slice() || null, bosses, ...(Object.hasOwn(WORLD_MAP_ART, id) ? { art: WORLD_MAP_ART[id] } : {}), ...(minLv ? { minLv } : {}), ...(doors[id] ? { doors: doors[id] } : {}),
      ...(id === AIRSHIP_MAP ? { unlockQuest: AIRSHIP_QUEST } : {}) };
  });
}

/** One side quest for the client: who gives it and takes it back, where its goal is, what to call it (sidequests.js, track.js). */
function sideDef(q) {
  const g = q.goal, r = g.type === "make" ? sqRecipe(g.item) : null, to = sqTurnIn(q);
  return { ...q, giverName: npcName(q.giver), giverMap: MAP_META[NPC_MAP[q.giver]].name, giverMapId: NPC_MAP[q.giver],
    turnIn: to, turnInName: npcName(to), turnInMap: MAP_META[NPC_MAP[to]].name,
    targetMap: q.id === AIRSHIP_QUEST ? AIRSHIP_MAP : g.type === "talk" || g.type === "deliver" ? NPC_MAP[g.npc] : g.type === "visit" || g.map ? g.map || null : null,
    // make: where the recipe is made ("fire" = any campfire, else the station's NPC)
    ...(r ? { station: r.at === "fire" ? "fire" : SQ_STATION[r.at] || null } : {}),
    target: g.type === "kill" ? MOBS[g.mob].name : g.type === "collect" || g.type === "make" || g.type === "deliver" ? ITEMS[g.item].name : g.type === "talk" ? npcName(g.npc)
      : g.type === "elite" || g.type === "fb" ? g.named || `${g.map ? MAP_META[g.map].name + " " : ""}${g.type === "fb" ? "우두머리" : g.mob ? `정예 ${MOBS[g.mob].name}` : "정예 몬스터"}`
        : g.type === "choice" ? npcName(q.giver) : MAP_META[g.map].name };
}
export function defs() {
  const mobs = {};
  for (const k of Object.keys(MOBS)) {
    const d = MOBS[k];
    // levels as players see them (4·tier − 3); `tier` the world's own
    mobs[k] = { name: d.name, lore: d.lore || MOB_LORE[k] || "", sp: d.sp, tint: d.tint || null, lv: shownLv(d.lv), tier: d.lv, hp: d.hp, boss: d.boss ? 1 : 0, chest: d.chest ? 1 : 0, xp: d.xp, fly: d.fly ? 1 : 0, aggro: d.aggro || 0 };
    if (d.bonusOptional) mobs[k].optional = 1;
    if (d.questOnly) mobs[k].questOnly = 1;
  }
  const affix = {};
  for (const [k, label, prefix] of AFFIX) affix[k] = [label, prefix];
  // jobs and stats: the jobs (with each weapon's scaling as coefficients), the stats, the scaling grades,
  // the base cost of each of the 200 levels' point (pointCost at a stat ≤ 30) and the stat surcharge
  // [STAT_K, STAT_K0] — the one rule the client mirrors for its cost preview; mastery need per level.
  // jobs[id].wm: the mastery each of its weapons needs (single JOB_WM, hybrid HYB_WM); .sig its signature skill
  const jobs = {};
  for (const id of Object.keys(JOBS)) {
    const j = JOBS[id];
    jobs[id] = { name: j.name, kind: j.kind, wk: j.wk.slice(), cost: j.cost, scale: j.kind === "hybrid" ? { ...j.scale } : j.kind === "single" ? scaleOf({ job: id }, j.wk[0]) : {}, wm: j.kind === "none" ? 0 : jobWmOf(id), sig: JOB_SKILL[id] || "" };
  }
  return {
    worldName: "루넬샤대륙",
    items: ITEMS, mobs, skills: SKILL, skillOrder: SKILL_ORDER, skGrow: SK_GROW, jobPal: JOB_PAL, skillJob: SKILL_JOB, shop: SHOP, quests: QUESTS, enh: ENH_RATE, enhPct: ENH_PCT, enhCrit: ENH_CRIT, enhUc: ENH_UNCURSE, uncurseFee: UNCURSE_FEE, inv: INV_BASE, invMax: INV_MAX, bag: { step: BAG_STEP, cost: BAG_COST }, house: homeDefs(), maxLv: MAXLV,
    jobs, jobSkillRanks: JOB_SKILL_RANKS, stats: STATS, scale: SCALE, grade: GRADE, lvc: Array.from({ length: MAXLV }, (_, i) => pointCost(i + 1, 0)), statK: [STAT_K, STAT_K0],
    wmNeed: Array.from({ length: WM_MAX }, (_, i) => wmNeed(i + 1)), wkOrder: WK_ORDER, wkName: WK_NAME, jobWm: JOB_WM, hybWm: HYB_WM, wswMs: WSW_MS,
    // 직업 자유: loadout sizes, the reset scrolls and gold [base, per level], the off-slot quest
    ske: { rate: SKE_RATE, pct: SKE_PCT, max: SKE_MAX, item: SKE_ITEM },
    jf: { lo: [LO_MAX.a, LO_MAX.p], borrow: LO_BORROW, scroll: JF_SCROLL, cost: JF_COST, quest: JF_QUEST, respecItem: RESPEC_ITEM },
    // J3: the stat panel's exact cost mirror — tierXp of each level and LV_DIV, so the client rounds once as pointCost does
    // (lvc is already rounded, so lvc × surcharge can miss by one)
    lvt: Array.from({ length: MAXLV }, (_, i) => tierXp(toTier(i + 1))), lvDiv: LV_DIV,
    affix, runes: RUNES, runewords: RUNEWORDS, rarity: RARITY, eliteHp: ELITE.map((e) => e.hp), partyMax: PARTY_MAX,
    fieldParty: { tiles: FIELD_PARTY_RANGE / T, share: PARTY_SHARE },
    slots: SLOTS, wkinds: WKIND, legend: LEGEND, sets: SETS, mastery: MASTERY, bounty: BOUNTY_N, fbResp: FB_RESP,
    traits: TRAITS, slow: SLOW, aim: [AIM_N, AIM_CONE], dash: [DASH.px, DASH.ms, DASH.cd, DASH.inv], mech: { marks: MARK_MAX, tip: SKILL.tip.at, tipMult: SKILL.tip.mult, react: REACT, elem: ELEM, weaveMs: WEAVE_MS }, whSlots: WH, filters: ["모두", "마법 이상", "희귀 이상"], petMs: PET_MS,
    // n: how many stones the map has (woken as "<id>" for the first, "<id>#<i>" for the others), names: what each is called
    waypoints: Object.keys(MAP_META).filter(hasWp).map((id) => ({ id, name: MAP_META[id].name, band: MAP_META[id].band && MAP_META[id].band.map(shownLv), n: MAP_META[id].wpn || 1, names: stoneNames(id), minLv: MAP_META[id].minLv || undefined })),
    // the wardrobe: id → { n wire code, slot, name, q rarity, src, price, ach, desc }; `cosN[n]` the id of a code
    cos: COSMETICS, cosSlots: COS_SLOTS, cosSlotName: COS_SLOT_NAME, cosN: COS_BY_N, cosSets: COS_SETS,
    // 염색 (P9): the dye items in self.cosDye order (1 = cosDyes[0]); a worn code ≥ cosDyeK carries a dye; keepsake → outfit piece ("" not yet)
    cosDyes: COS_DYES, cosDyeK: COS_DYE_K, keepSew: KEEP_SEW,
    achievements: ACH.map(({ id, cat, name, desc, pts, title, bonus }) => ({ id, cat, name, desc, pts, title, bonus })),
    collection: Object.fromEntries(REGIONS.map((id) => [id, { mobs: COL_MOBS[id], bonus: REGION_BONUS[id] }])), colNeed: MASTERY[0],
    event: { every: EVT.every, warn: EVT.warn, len: EVT.len, waves: EVT.waves, boss: EVT.boss, maps: EVT_MAPS },
    daily: { resetKST: 6, text: DAILY_TEXT }, social: socialDefs(), tutorial: TUT.map(({ id, title, hint, need }) => ({ id, title, hint, need: need || 1 })), recallMs: RECALL_MS,
    // side quests from the world map editor, with who gives them and where they stand
    questTurnIn: { npc: "elder", map: NPC_MAP.elder },
    // every NPC id → the map it stands on (the client's 추적 walks there; track.js)
    npcMap: { ...NPC_MAP },
    side: SIDE.map(sideDef),
    // the turning day and the weather (the client keeps the same clock), the fire's company
    sky: { dayMs: SKY_DAY_MS, phases: PHASES, weather: WEATHER, wxMs: WX_MS, warm: [WARM_N, WARM_BASE, WARM_STEP, WARM_NIGHT, WARM_REGEN], tales: TALES, teller: TELLER.name, jam: JAM, season: SEASON.name },
    fair: fairDefs(),
    // life skills: names, curve, grades, the bonus formula, fish, recipes, each map's grade (58-life.js)
    life: lifeDefs(), npclife: npcLifeDefs(),
    // charms: shapes, options and caps, legendaries, the expansion order and prices, 주아나's quests (66-charms.js)
    charms: charmDefs(),
    // 협동 아르바이트: the jobs, cut-offs, tools (68-coop.js)
    coop: coopDefs(),
    sx: sxDefs(),
    // boss trophies: { list: { kind: { name, fx } }, cap, p, gold, story: { r, limit } } (67-trophies.js)
    trophies: trophyDefs(),
    streak: [STREAK_MS, STREAK_MAX], guildCost: GUILD_COST, guildXp: GUILD_XP, fireR: FIRE_R, lookCost: LOOK_COST, lookMax: LOOK_MAX, emotes: EMOTES, dim: dimDefs(), maps: worldMapDefs(),
  };
}
