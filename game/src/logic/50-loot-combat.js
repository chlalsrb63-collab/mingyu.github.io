// ───────────────────────────── inventory & loot ─────────────────────────────

/** Old clients asked for "W<tier>": the weapon of that tier of the kind in hand. */
function resolveItem(key, ch) {
  if (key[0] === "W" && key.length === 2) return `w_${WK_ID[weaponKind(ch)]}_${key[1]}`;
  return key;
}
/** How many of `id` a character carries: the bag, plus the 재료 주머니 for materials (58-life.js pouchHas). */
function countItem(ch, id) {
  let n = pouchHas(ch, id);
  for (const s of ch.inv) if (s.id === id) n += s.n || 1;
  return n;
}
function canAdd(ch, id, n, il) {
  if (isGear(id)) return ch.inv.length + n <= bagCap(ch);
  let room = Math.max(0, bagCap(ch) - ch.inv.length) * STACK + pouchRoom(ch, id);
  for (const s of ch.inv) if (stackMatches(s, id, il)) room += STACK - s.n;
  return room >= n;
}
function addItem(ch, id, n, il) {
  if (!canAdd(ch, id, n, il)) return false;
  if (isGear(id)) {
    for (let i = 0; i < n; i++) ch.inv.push(plain(id));
    return true;
  }
  // materials, staples and flasks go into the 재료 주머니 first (up to POUCH_MAX each), the rest into the bag
  const pr = pouchRoom(ch, id);
  if (pr > 0) { const put = Math.min(n, pr); ch.pouch[id] = pouchHas(ch, id) + put; n -= put; if (n <= 0) return true; }
  stackInto(ch.inv, id, n, il);
  return true;
}
/** Room in the warehouse for `n` of `id`. */
function whRoom(wh, id, n, il) {
  if (isGear(id)) return wh.items.length + 1 <= WH;
  let room = (WH - wh.items.length) * STACK;
  for (const s of wh.items) if (stackMatches(s, id, il)) room += STACK - s.n;
  return room >= n;
}
/** Stack `n` of `id` into a list of slots, filling what is there first. */
function stackInto(list, id, n, il) {
  for (const s of list) {
    if (!stackMatches(s, id, il) || n <= 0) continue;
    const put = Math.min(n, STACK - s.n);
    s.n += put; n -= put;
  }
  while (n > 0) { const put = Math.min(n, STACK); list.push(stackItem(id, put, il)); n -= put; }
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
  if (dr.c) return ch.inv.length < bagCap(ch);
  return dr.g ? ch.inv.length < bagCap(ch) : canAdd(ch, dr.it, dr.n, dr.il);
}
function bagFull(S, p) {
  if (S.now > p.fullAt) { p.fullAt = S.now + 3000; toast(p, "가방이 가득 찼습니다."); }
}
/** Put a drop into `p`'s bag (or purse). False, with a reminder, if there is no room. */
function pickUp(S, p, dr) {
  if (dr.c) return charmPick(S, p, dr);   // a sealed charm (66-charms.js)
  if (!fits(p.ch, dr)) { bagFull(S, p); return false; }
  if (dr.it === "gold") {
    p.ch.gold += dr.n;
    runeEarnGold(S, p, dr.n);
    p.gain.push(["gold", dr.n]);
  } else if (dr.g) {
    p.ch.inv.push(dr.g);
    p.gain.push(["item", dr.it, 1, dr.q]);
    if (dr.q === 3 || dr.q === 5) p.ch.cnt.leg++;   // a 유니크 counts as a legendary find (the 첫 전설 achievement)
    if (dr.q >= 3) checkAch(S, p);
    if (dr.q >= 3) sys(S, `${p.ch.name}님이 ${RARITY[dr.q]} 장비 [${gearName(dr.g)}]${pp(gearName(dr.g), "을를")} 획득했습니다!`);
  } else {
    addItem(p.ch, dr.it, dr.n, dr.il);
    foundItem(S, p, dr.it, dr.n);
    sqPicked(p, dr.it);
  }
  p.dirty = true;
  return true;
}
/** What dying costs: 3% of the unspent experience, up to about one old level's worth (a revive feather spares it). */
const deathLoss = (ch, p) => { const n = Math.floor(Math.min(ch.xp, levelXp(ch.lvl)) * 0.03); return p ? Math.max(0, Math.floor(pfxNum(p, "loss", n))) : n; };
function takeItem(ch, id, n) {
  for (let i = ch.inv.length - 1; i >= 0 && n > 0; i--) {
    const s = ch.inv[i];
    if (s.id !== id) continue;
    const take = Math.min(n, s.n);
    s.n -= take; n -= take;
    if (s.n <= 0) ch.inv.splice(i, 1);
  }
  // (what the bag did not have comes out of the pouch)
  if (n > 0) pouchTake(ch, id, n);
}
/**
 * The item level (shown 1–200 scale) of a piece: its `il`, or for a piece without one (an old sheet, shop stock)
 * the level it always asked for plus IL_GAP, so wearing it needs the same level as before (10-tables.js IL_RANK).
 */
function gearIl(g) {
  if ((g.il | 0) > 0) return g.il | 0;
  const r = ITEMS[g.id].req | 0;
  return r > 1 ? r + IL_GAP : 1;
}
/** The player level a piece can be worn from: its item level minus IL_GAP (at least 1). */
const gearReq = (g) => Math.max(1, gearIl(g) - IL_GAP);
/** Item level and enhancement strengthen flat stats. The authored speed and critical chance stay fixed. */
function gearBaseValue(g, stat) {
  const value = ITEMS[g.id].base[stat] || 0;
  if (stat === "spd" || stat === "crit") return value;
  const scale = (stat === "def" ? DEF_BASE_SCALE : GEAR_BASE_SCALE)[clamp(gearIl(g), 1, MAXLV) - 1] / 1000;
  return value * scale * enhMul(g.enh);
}
/** A piece's name word comes from a legendary or unique power. */
function gearWord(g) {
  return g.lg ? `${LEGEND[g.lg][0]} ` : "";
}
/** "+3 뇌명의 강철 양손검" (a 유니크 is named like a 전설: by its power's word) */
function gearName(g) {
  return (g.enh > 0 ? `+${g.enh} ` : "") + gearWord(g) + ITEMS[g.id].name;
}
/** "희귀 강철 양손검 +6" — the whole name, rarity first and the level last (enhancement news). */
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
/** The [low, high] an ordinary line of `key` rolls at item level `il`, before the rarity factor: a flat line is min–max % of AFFIX_REF, a % line min–max + growth × tier. */
function affixRange(key, il) {
  const [, , , min, max, grow] = AFFIX_BY_KEY[key], ref = affixRefOf(key);
  if (ref) { const r = ref[clamp(il | 0, 1, MAXLV) - 1] / 100; return [min * r, max * r]; }
  const b = grow * Math.min(TIER_MAX, toTier(clamp(il | 0, 1, MAXLV)));
  return [min + b, max + b];
}
/** One affix line [key, value] at item level `il`, times `mul` (the rarity's AFFIX_MUL); at least 1. */
function rollLine(S, key, il, mul) {
  const [lo, hi] = affixRange(key, il);
  return [key, Math.max(1, Math.round((lo + rnd(S) * (hi - lo)) * mul))];
}
const rollGearLine = (S, key, g) => rollLine(S, key, gearIl(g), AFFIX_MUL[g.q | 0]);
/**
 * Roll one piece of gear: rarity decides how many affixes, `ilvl` (a monster's tier, 1–50) how big and, shown, its item
 * level `il` (+ IL_RANK[rank] for an elite or boss). A 전설 or 유니크 also rolls one `lg` power of its item type's pool (a 유니크: 4 stronger lines, AFFIX_MUL[5]).
 */
function rollGear(S, id, q, ilvl, rank = 0) {
  const il = clamp(Math.max(shownLv(ilvl | 0) + IL_RANK[rank | 0], G_REQ[(ITEMS[id].tier | 0) - 1] || 1), 1, MAXLV);
  return rollGearAtLevel(S, id, q, il);
}
/** Drop and craft use the same ordinary affix budget for the level printed on the item. */
function rollGearAtLevel(S, id, q, il) {
  const it = ITEMS[id];
  if (q === 4) q = 3;
  const g = plain(id);
  g.q = q;
  g.il = il;
  const [lo, hi] = RARITY_AFFIX[q];
  const used = new Set();
  for (let n = ri(S, lo, hi); n > 0; n--) {
    const key = rollAffixKey(S, it.type, used);
    used.add(key);
    g.af.push(rollGearLine(S, key, g));
  }
  if (q === 3 || q === 5) g.lg = pfxPick(S, it.type);   // the power comes from the item type's pool (51-prefix.js)
  g.sk = ri(S, 0, sockCap(g));
  return g;
}
/** `rank`: 0 for ordinary monsters, 1 elite, 2 field boss or boss. */
function rollRarity(S, rank, mf) {
  const k = 1 + mf / 100;
  let r = rnd(S);
  // a 유니크 first (the lowest slice of the one roll); the rest keep their own odds
  const uq = UNIQ_P[rank] * k;
  if (r < uq) return 5;
  r -= uq;
  const top = [0.012, 0.07, 0.2][rank] * k;
  const rare = [0.09, 0.3, 0.55][rank] * k;
  const magic = 0.36 * k;
  if (r < top) return 3;
  return r < top + rare ? 2 : r < top + rare + magic ? 1 : 0;
}
function tierFor(lv) {
  return clamp(Math.ceil(shownLv(lv) / 20), 1, G_REQ.length);
}
/** Which kind of piece drops: weapons most often, jewellery least. */
const DROP_TYPES = [["weapon", 24], ["helm", 13], ["armor", 15], ["gloves", 13], ["boots", 13], ["ring", 13], ["amulet", 9]];

/** A dropped weapon's kind: half the time the looter's own, else any of the six. */
const dropKind = (S, p) => (rnd(S) < 0.5 ? weaponKind(p.ch) : WK_ORDER[ri(S, 0, WK_ORDER.length - 1)]);
const huntBandK = (level, tier) => 1 - 0.75 * clamp((toTier(level) - tier - 5) / 17, 0, 1);
function gearDropChance(d, rank, find, band) {
  const base = rank === 2 || d.chest ? 1 : rank === 1 ? 0.35 + 0.08 * mobGearPressure(d.lv) : d.gear * (1.18 + 0.57 * mobGearPressure(d.lv));
  return Math.min(1, base * (1 + find / 100) * (rank === 2 || d.chest ? 1 : 0.6 + 0.4 * band));
}
/** What one looter finds on one corpse. Everyone in the party rolls their own. */
function lootFor(S, rt, mob, p) {
  const d = MOBS[mob.k];
  const st = stats(p);
  const out = [];
  const share = allies(S, p).length;
  const rank = d.boss ? 2 : d.chest ? 1 : mob.el;
  const fx = pfxLoot(S, rt, p, mob, "drop");   // the powers that add to this kill's loot (51-prefix.js); all 0 without one
  const band = !d.chest && !mob.dim ? huntBandK(p.ch.lvl, d.lv) : 1;
  const goblin = has(mob, "goblin");
  const gold = ri(S, d.gold[0], d.gold[1]) * [1, 3, 12][mob.el] * goldK(d.lv) * HUNT_GOLD * (1 + (st.gold + fx.gold) / 100) * (1 + fx.gx) * (mob.lucky ? 2 : 1) * (goblin ? 3.5 : 1) * (mob.dim ? DIM.lootGold : 1) * (0.5 + 0.5 * band);
  out.push({ it: "gold", n: Math.max(1, Math.round(gold / share)) });
  const tries = (d.boss ? 4 : mob.el === 2 ? 3 : 1) + (goblin ? 2 : 0);
  const dropRank = goblin ? 2 : rank;
  for (let i = 0; i < tries; i++) {
    if (rnd(S) >= gearDropChance(d, dropRank, st.mf + fx.mf, band)) continue;
    let tier = tierFor(d.lv);
    if (dropRank && rnd(S) < 0.25) tier = Math.min(G_REQ.length, tier + 1);
    let roll = rnd(S) * 100, type = "weapon";
    for (const [t, w] of DROP_TYPES) { if (roll < w) { type = t; break; } roll -= w; }
    let id;
    if (type === "weapon") id = `w_${WK_ID[dropKind(S, p)]}_${tier}`;
    else id = `${GEAR[type].pre}_${tier}`;
    let q = rollRarity(S, dropRank, st.mf + fx.mf);
    if (isJewel(id) && q === 0) q = 1;
    out.push({ g: rollGear(S, id, q, d.lv, dropRank) });
  }
  if (rnd(S) < runeDropChance(shownLv(d.lv), dropRank)) out.push({ it: rollRuneId(S, dropRank), n: 1 });
  const stoneRoll = rnd(S);
  if (goblin) out.push({ it: "stone", n: ri(S, 1, 2) });
  else if (stoneRoll < (rank === 2 ? 1 : rank === 1 ? 0.5 : 0.05 * GEAR_CUT)) out.push({ it: "stone", n: rank === 2 ? ri(S, 3, 6) : 1 });
  if (fx.stone) out.push({ it: "stone", n: 1 });   // (a power's extra stone: at most one a kill)
  // A kind's own finds (MOBS[k].drops: [item, chance, min, max]); its signature gear always drops legendary.
  for (const [it, c, lo = 1, hi = lo] of d.drops || []) if (rnd(S) < c) out.push(isGear(it) ? { g: rollGear(S, it, 3, d.lv, rank) } : { it, n: ri(S, lo, hi) });
  if (rnd(S) < 0.1) out.push({ it: d.lv < 8 ? "hp_s" : d.lv < 26 ? "hp_m" : "hp_l", n: 1 });
  if (rnd(S) < 0.07) out.push({ it: d.lv < 8 ? "mp_s" : d.lv < 26 ? "mp_m" : "mp_l", n: 1 });
  // Use the high end of the material roll without drawing more combat randomness.
  if (!d.chest && stoneRoll >= 1 - SOCK_DROP[rank]) out.push({ it: SOCK_ITEM, n: 1 });
  // Crafting materials (herbs/ores/wood) matching this field's grade drop directly from monsters.
  if (!mob.dim) for (const mat of rollHuntMats(S, mapOfS(S, rt.id), d, rank)) out.push(mat);
  for (const o of out) {
    const atCorpse = o.it === SOCK_ITEM;
    rt.drops.push({
      id: S.nextId++, it: o.g ? o.g.id : o.it, g: o.g || null, n: o.n || 1, q: o.g ? o.g.q : stackQuality(o.it),
      ...(RUNES[o.it] ? { il: runeIl(shownLv(d.lv) + IL_RANK[rank]) } : {}),
      x: mob.x + (atCorpse ? 0 : o.dx !== undefined ? o.dx : ri(S, -14, 14)), y: mob.y + (atCorpse ? 0 : o.dy !== undefined ? o.dy : ri(S, -8, 10)),
      own: p.pid, freeAt: S.now + 20000, dieAt: S.now + 60000,
    });
  }
}

// ───────────────────────────── combat ─────────────────────────────

/** Award experience, carrying excess through every earned level. */
function gainXp(S, p, n) {
  const ch = p.ch;
  n = Math.max(1, Math.round(n * (1 + stats(p).xp / 100)));
  const from = ch.lvl;
  ch.xp = Math.min(2e9, ch.xp + n);
  p.gain.push(["xp", n]);
  advanceLevels(ch);
  if (ch.lvl > from) {
    const rt = S.maps[p.map];
    p.stc = null;
    if (!p.dead) { const st = stats(p); p.hp = st.mhp; p.mp = st.mmp; }
    p.gain.push(["lvl", ch.lvl]);
    rt.ev.push(["l", p.eid]);
    rt.who = true;
    toast(p, `레벨 ${ch.lvl}! 능력치 포인트 +${(ch.lvl - from) * AP_PER_LEVEL}`);
    for (let l = from + 1; l <= ch.lvl; l++) if (l % 50 === 0) sys(S, `${ch.name}님이 레벨 ${l}${pp(l, "을를")} 달성했습니다!`);
    tutStep(S, p, "level");
    checkAch(S, p);
    saveSoon(p);
  }
  p.dirty = true;
}

// Optional presentation tag at h[6]. h[5] is reserved for HP costs.
const HIT_CUE = { oath: 1, sanctuary: 2, hammer: 3, rally: 4, binding: 5 };

const damageTotal = (parts) => parts.reduce((n, [, amount]) => n + amount, 0);

/** Send the actual damage by element after shields and encounter modifiers. */
function damageEvent(rt, eid, amount, crit, player, cue, parts, melee) {
  const event = ["h", eid, amount, crit, player];
  const typed = amount > 0 && parts && (parts.length > 1 || parts[0]?.[0] !== "physical");
  if (typed) {
    const sum = damageTotal(parts), shown = [];
    let cumulative = 0, prior = 0;
    for (const [type, n] of parts) {
      cumulative += n;
      const end = Math.round(cumulative * amount / sum);
      if (end > prior) shown.push([DAMAGE_TYPES.indexOf(type), end - prior]);
      prior = end;
    }
    if (shown.length) event.push(0, cue || 0, shown);
  }
  if (cue && event.length === 5) event.push(0, cue);
  if (melee) {
    // h[8] identifies whose basic swing landed. Slots 5–7 keep their existing meaning.
    if (event.length === 5) event.push(0, 0);
    if (event.length === 7) event.push(null);
    event.push(melee);
  }
  rt.ev.push(event);
}

/** Take `dmg` off a monster on behalf of `p`; true if that killed it. */
function dealMob(S, rt, mob, p, dmg, crit, cue, parts, combat = {}) {
  // a boss that dived out of reach is not hit at all (56-boss-script.js)
  if (mob.dead || mob.dive) return false;
  // A charm that copies a fraction of an actual hit inherits its target modifiers.
  if (!combat.copied) {
    const poison = runePoisonFactor(S, mob);
    if (poison !== 1) dmg = Math.max(1, Math.round(dmg * poison));
    const taken = elementTaken(S, mob);
    if (taken !== 1) dmg = Math.max(1, Math.round(dmg * taken));
    if (mob.bs) dmg = bsTaken(S, rt, mob, dmg);
    if (mob.hk) dmg = Math.max(1, Math.round(dmg / mob.hk));
  }
  if (combat.buddyCap) dmg = Math.min(dmg, combat.buddyCap);
  dmg = elementShield(S, mob, dmg);
  mob.hp -= dmg;
  if (combat.trackBuddy && dmg > 0 && mob.hp > 0) buddyEngage(S, p, mob, dmg);
  mob.by[p.pid] = (mob.by[p.pid] || 0) + dmg;
  if (mob.dim) dimDealt(S, rt, mob, p, dmg);   // the carry guard's damage share (64-dim.js)
  if (mob.cast) bsDealt(S, rt, mob, dmg);      // a scripted boss's stagger gauge (56-boss-script.js)
  if (!mob.tgt) mob.tgt = p.pid;
  damageEvent(rt, mob.id, dmg, crit === 2 ? 2 : crit ? 1 : 0, 0, cue, parts, combat.melee);
  if (mob.hp > 0) return false;
  killMob(S, rt, mob);
  runeKillHeal(S, p, mob);
  return true;
}

/** Damage already fixed by a skill or an old affix still takes its type's resistance. */
function dealTypedMob(S, rt, mob, p, amount, type, crit = false, cue = 0) {
  const dmg = Math.max(1, Math.round(amount * elementResist(S, mob, type, stats(p).element?.pen[type] || 0)));
  return dealMob(S, rt, mob, p, dmg, crit, cue, [[type, dmg]]);
}

/**
 * Hitstun. Every blow that lands staggers a normal or elite monster: for `ms` (a crit: `crit`)
 * it neither moves nor strikes, and the time its attack and its next trick were still cooling
 * down is held over (paused) rather than spent. It is also nudged `kb` px straight away from the
 * striker, stopping short of anything solid (knock). Bosses, field bosses / guardians and things
 * rooted to the spot only flinch on screen. A wound-up charge still goes off (tickMob).
 */
// owner (2026-11-15, "경직 더 길게"): 140/200 ms → 220/320, budget 340 → 520 ms; the shove stays (more splits ranged targets)
const STAGGER = { ms: 220, crit: 320, elite: 0.65, kb: 3, eliteKb: 2 };
/**
 * No stun-lock: from a monster's first hold, for HOLD.win ms it is held (and its cooldowns paused)
 * for at most HOLD.cap ms in all; past that it shrugs blows off (no hold, no shove) until the
 * window ends. So however many hit it, it still strikes at least ~78% as often as unhurt.
 */
const HOLD = { win: 2400, cap: 520 };
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
 * crit chance, `sk` the skill it came from (a book's skill brands what it hits), `px` a blow a prefix power dealt (51-prefix.js: it
 * never starts another power's chance, status or crit effect; its passive multipliers and a kill's heal still count).
 */
function hurtMob(S, rt, mob, p, mult, sure, opt) {
  if (mob.dead || mob.dive) return;
  if (elementMiss(S, p)) { damageEvent(rt, mob.id, 0, 3, 0); return false; }
  const st = stats(p);
  const d = MOBS[mob.k];
  const o = opt || {};
  const fx = pfxPre(S, p, st, mob, d, o);   // the powers that bend this blow before it rolls: armour ignored, crit chance, a sure crit
  const pure = fx.pure;
  // a blow beyond your depth, or from an unpractised hand, may only graze (×0.5, never a crit)
  const graze = !sure && !fx.sure && rnd(S) * 100 < grazeChance(p, mob);
  // 급소 도려내기: a dagger finds the gaps its marks point to (+4% critical chance per mark)
  const vit = st.wk === "dagger" && pasOn(p, "vitals") ? marksOf(S, mob) * SKILL.vitals.crit : 0;
  const crit = !graze && (sure || pasFirst(p, mob) || fx.sure > 0 || rnd(S) * 100 < st.crit + vit + (o.crit || 0) + fx.crit);
  const ign = fx.ign ? 1 - (1 - (o.ign || 0)) * (1 - fx.ign) : (o.ign || 0);
  // 거검의 관성: each stack a sword carries adds to its critical damage
  const critd = st.critd + (st.wk === "sword" ? inertOf(p) * SKILL.inertia.critd : 0);
  const defence = d.def * ((o.mag ?? st.mag) ? SFX.magDef : SFX.physDef) * (1 - ign);
  const raw = st.atk * mult * (0.85 + rnd(S) * 0.3) * (crit ? critd : 1) * (graze ? SFX.grazeK : 1) * elementOutgoing(S, p);
  const parts = elementDamage(S, p, mob, raw, defence, {
    type: o.elem || skillDamageType(o.sk, st.wk),
    secondaryType: o.secondaryType === undefined ? o.sk?.secondaryDamageType : o.secondaryType,
    armorPenPct: (o.sk?.armorPenPct || 0) + (o.armorPenPct || 0) + jobTraitArmorPen(S, p),
    element: st.element, extraScale: o.px ? 0 : mult * (graze ? SFX.grazeK : 1), pure, crit, typedOnly: o.typedOnly,
  });
  let dmg = damageTotal(parts);
  if (pure) dmg *= RUNE_POWER.blackstar.damage;
  // a dagger in a back that is not watching you
  if (st.wk === "dagger" && mob.tgt !== p.pid) dmg *= 1 + st.sneak;
  dmg *= 1 + 0.03 * masteryRank(p.ch, mob.k);
  dmg *= pfxMul(S, p, st, mob, d, o, crit);   // combine active rune and prefix damage factors within their shared cap
  if (!pure && has(mob, "tough")) dmg *= 0.6;
  if (mob.vuln > S.now) dmg *= 1.3;
  // 금서의 낙인: a branded monster takes more from everyone
  if (mob.brand > S.now) dmg *= 1 + SKILL.brand.k;
  dmg *= pasHurtK(S, p, mob, st, o);   // the felt passives + job identity trait (55-passives.js)
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
  // reflect shield (CBT-06): periodic golden barrier bounces 16% of non-proc damage back
  if (has(mob, "reflect") && mob.refUntil > S.now && !o.px && !p.dead) {
    const back = Math.min(p.hp - 1, Math.max(1, Math.round(dmg * 0.16)));
    if (back > 0) { p.hp -= back; rt.ev.push(["h", p.eid, back, 0, 1]); }
  }
  if (st.ls > 0 && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + Math.max(1, Math.round((dmg * st.ls) / 100)) * elementHealFactor(S, p));
  const x = mob.x, y = mob.y;
  wmHit(S, p, mob);
  const trackBuddy = !o.px && p.ch.buddy?.active;
  const brand = mob.brand, before = mob.hp, killed = dealMob(S, rt, mob, p, dmg, graze ? 2 : crit, o.cue, parts, { trackBuddy, melee: o.melee });
  const lost = before - Math.max(0, mob.hp);
  if (!o.px && (!pure || o.forceAilment) && lost > 0) {
    elementApplyHit(S, rt, p, mob, parts, {
      crit, element: st.element, proc: !graze && !pure, forceAilment: o.forceAilment,
      noDarkLeech: o.noDarkLeech, noRx: o.noRx, scale: lost / Math.max(1, damageTotal(parts)),
    });
  }
  if (pure) runeShock(S, rt, p, x, y, mob);
  pasAfter(S, rt, p, mob, st, dmg, crit, killed, brand, o);
  if (!o.px) pfxHit(S, rt, p, st, mob, dmg, crit, killed, o);   // the powers that answer a blow landing (chance, status, crit)
  if (!killed) {
    // whatever is hit (and lives) staggers for a moment and is nudged back; the biggest things shrug it off
    if (!mob.dead) stagger(S, mob, p, crit);
    return crit;
  }
  // the powers that answer a kill (feast heals, nova bursts; a `px` kill counts too)
  pfxKill(S, rt, p, st, mob, x, y, o);
  return crit;
}

/** A boss or guardian fallen to two or more heroes: each of them hears the damage ranking (top 3, and their own place below it). */
function dmgBoard(S, rt, by) {
  const rows = Object.keys(by).filter((pid) => S.players[pid] && S.players[pid].map === rt.id && by[pid] > 0).sort((a, b) => by[b] - by[a]);
  if (rows.length < 2) return;
  const sum = rows.reduce((n, pid) => n + by[pid], 0), pct = (pid) => Math.round((100 * by[pid]) / sum);
  S.players[rows[0]].ch.cnt.mvp++;
  const line = rows.slice(0, 3).map((pid, i) => `${i + 1}. ${S.players[pid].ch.name} ${pct(pid)}%`).join(" · ");
  rows.forEach((pid, i) => toast(S.players[pid], `피해 기여도 — ${line}${i >= 3 ? ` · 나 ${i + 1}위 ${pct(pid)}%` : ""}`));
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
  elementClear(mob);
  mob.runePoison = null;
  mob.mk = 0; mob.dec = null; mob.vuln = 0; mob.brand = 0;
  rt.ev.push(["k", mob.id]);
  if (S.dims[rt.id]?.story?.airship) { airshipKill(S, rt, mob); return; }
  // the hands that struck it learn from it
  wmKill(S, rt, mob);
  // In the field, a party member needs to be near a hitter and the fallen monster.
  const field = !d.chest && !S.dims[rt.id];
  const range = field ? FIELD_PARTY_RANGE : PARTY_RANGE;
  const looters = new Set();
  let top = null, topDmg = 0;
  const hitters = mob.by;
  for (const pid of Object.keys(hitters)) {
    const p = S.players[pid];
    if (!p || p.map !== rt.id) continue;
    if (hitters[pid] > topDmg) { top = p; topDmg = hitters[pid]; }
    for (const o of allies(S, p, range)) {
      if (!o.dead && (!field || o === p || dist(o.x, o.y, mob.x, mob.y) <= range)) looters.add(o);
    }
  }
  if (d.boss || el === 2) dmgBoard(S, rt, hitters);
  mob.by = {};
  const xp = d.xp * ELITE[el].xp;
  // Summoned minions and splitlings award light XP only (no loot/quest/split exploit).
  if (mob.noDrop) {
    for (const p of looters) if (!d.chest) gainXp(S, p, Math.max(1, Math.round(xp * 0.25)));
    return;
  }
  const rareBoss = !mob.story && !mob.guard
    && (mob.dim ? S.dims[rt.id]?.boss === mob.id : d.boss || (el === 2 && mob.temp));
  for (const p of looters) {
    const ch = p.ch;
    // a chest is opened, not hunted: it pays out its loot and nothing else
    if (d.chest) { p.dirty = true; lootFor(S, rt, mob, p); dailyProg(S, p, "chest"); if (cosRoll(S, p, "chest") < COS_CHEST) cosFrom(S, p, "chest", "보물 상자"); continue; }
    const nearby = allies(S, p, range).filter((o) => !field || looters.has(o));
    const n = Math.min(PARTY_MAX, nearby.length);
    // a kill soon after the last one keeps the streak alive
    p.streak = S.now - p.streakAt < STREAK_MS ? p.streak + 1 : 1;
    p.streakAt = S.now;
    const rank = masteryRank(ch, mob.k);
    const early = hitters[p.pid] > 0 && wmEligible(p, d) && d.lv <= toTier(ch.lvl) + HUNT_EARLY.ahead
      ? HUNT_EARLY.extra * clamp((HUNT_EARLY.end - ch.lvl) / (HUNT_EARLY.end - HUNT_EARLY.full), 0, 1)
      : 0;
    const band = field ? huntBandK(ch.lvl, d.lv) : 1;
    gainXp(S, p, xp * band * (1 + pfxLoot(S, rt, p, mob, "xp").xp / 100) * (1 + early) * PARTY_SHARE[n - 1] * (1 + Math.min(STREAK_MAX, p.streak - 1) * 0.02 + rank * 0.02 + guildNear(S, p) * GUILD_XP));
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
    if (q.st === 1 && quest && quest.mob === mob.k && q.n < quest.n && (!quest.fb || el === 2)) {
      q.n++;
      if (q.n >= quest.n && !mob.story) toast(p, `의뢰 [${quest.title}] 달성! 관리자에게 돌아가세요.`);
    }
    const bq = ch.bq;
    if (bq && bq.k === mob.k && bq.n < bq.need) {
      bq.n++;
      if (bq.n >= bq.need) toast(p, `반복 토벌 [${d.name} ${bq.need}마리] 달성! 관리자에게 보고하세요.`);
    }
    sqProgress(S, p, "kill", (g) => g.mob === mob.k);
    sqFind(S, p, mob.k);
    if (el === 1 || (el === 2 && mob.temp && !mob.story && !mob.dim)) sqProgress(S, p, el === 1 ? "elite" : "fb", (g) => (!g.map || g.map === rt.id) && (!g.mob || g.mob === mob.k));
    if (el === 1) ch.cnt.elite++;
    else if (el === 2) { if (mob.temp) ch.cnt.fb++; else ch.cnt.guard++; }
    if (n >= 2) ch.cnt.party++;
    dailyProg(S, p, "kill", mob.k);
    if (ch.daily.tasks[0].kind === "party" && nearby.some((o) => o !== p && looters.has(o))) dailyProg(S, p, "party");
    if (el >= 1) dailyProg(S, p, "elite");
    if (mob.k === "twinhare") tutStep(S, p, "hunt");
    checkAch(S, p);
    p.dirty = true;
    lootFor(S, rt, mob, p);
    charmKill(S, rt, mob, p);   // 주아나's quests, sealed charms (66-charms.js)
    // a field boss, a guardian or a boss may leave something to wear
    if ((el === 2 || d.boss) && cosRoll(S, p, "boss") < COS_BOSS) cosFrom(S, p, "boss", d.name);
    if (rareBoss) cosBossRare(S, p, d.name);
    if (el === 2 && mob.temp && !mob.story && !mob.dim) fbLoot(S, rt, p);   // a field boss (64-dim.js LOOT_X)
  }
  if (d.boss && top) sys(S, `${top.ch.name}님의 일행이 ${d.name}${pp(d.name, "을를")} 쓰러뜨렸습니다!`);
  if (el === 2) {
    if (mob.story) storyClear(S, rt, mob);
    // a field boss is back at its spot FB_RESP after it falls; now and then it leaves its trophy (67-trophies.js)
    else if (mob.temp) { rt.fb = 0; rt.fbAt = S.now + FB_RESP; fbTrophy(S, looters, mob.k); }
    if (top && !mob.story) sys(S, `${top.ch.name}님의 일행이 ${mapOfS(S, rt.id).name}의 ${mob.temp ? "우두머리" : "수문장"} [${d.name}]${pp(d.name, "을를")} 쓰러뜨렸습니다!`);
  }
  // some monsters go off where they fall, and so does any elite with the trait
  if (d.burst || has(mob, "burst")) {
    const r = d.burst || 34;
    const k = has(mob, "burst") ? 1.3 : 1.05;
    rt.tele.push({ x: mob.x, y: mob.y, r, at: S.now + 950, dmg: d.atk * ELITE[el].atk * k });
    rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), r, 950]);
  }
  // volatile archetype (CBT-05): leaves a short hazard puddle on death
  if (d.deathPool && !mob.noDrop) {
    const kind = d.poolKind ?? POOL_OF[monsterElement(mob.k).type] ?? 0;
    const atk = d.atk * ELITE[el].atk;
    rt.pools.push({ x: mob.x, y: mob.y, r: d.deathPool, next: S.now + 700, until: S.now + 3400, dmg: atk * 0.35, atk, kind });
    rt.ev.push(["g", mob.id, Math.round(mob.x), Math.round(mob.y), d.deathPool, 700, 2700, kind]);
  }
  // split trait (CBT-06): splits into two frail mini-clones on death (never chained)
  if (has(mob, "split") && !mob.noSplit && !d.boss && el < 2 && !d.chest) {
    const m = mapOfS(S, rt.id), ok = d.fly ? canFly : canStand;
    for (const side of [-1, 1]) {
      const cx = mob.x + side * 14, cy = mob.y + (side > 0 ? 6 : -6);
      const [mx, my] = ok(m, cx, cy) ? [cx, cy] : [mob.x, mob.y];
      const clone = newMob(S, mob.k, null, { elite: 0 });
      clone.x = clone.hx = clone.wx = mx; clone.y = clone.hy = clone.wy = my;
      clone.temp = true; clone.noSplit = true; clone.noDrop = true; clone.noSummon = true;
      clone.hk = (mob.hk || 1) * 0.35; clone.ak = (mob.ak || 1) * 0.6;
      clone.hp = mobMax(clone); clone.tr = []; clone.tgt = top ? top.pid : null;
      rt.mobs.push(clone);
      rt.ev.push(["r", clone.id]);
    }
  }
  // inside a 레이드던전: the gauge, orbs and shrines, the master (64-dim.js)
  if (mob.dim) dimKill(S, rt, mob, looters);
}
/**
 * The last thing that hurt a player, kept so a fall can say what did it (the death window
 * shows it with a word of advice): `by` is the label players see over its head.
 */
function blameOf(mob) {
  const d = MOBS[mob.k];
  const rank = d.boss ? "보스 " : mob.el === 2 ? (mob.temp ? "우두머리 " : "수문장 ") : mob.el ? "정예 " : "";
  return { by: `Lv.${shownLv(d.lv)} ${rank}${d.name}`, lv: shownLv(d.lv), el: d.boss ? 3 : mob.el | 0 };
}
function hurtPlayer(S, rt, p, raw, mob, type) {
  if (p.dead || S.now < (p.ghost || 0)) return 0;
  const st = stats(p);
  // inside a dark knight's blood sanctuary a blow lands lighter (57-weapon-skills.js)
  const ward = S.now < (p.sanctAt || 0) ? 1 - SKILL.sanctuary.guard : 1;
  const primary = type || (mob ? monsterElement(mob.k).type : "physical");
  const parts = elementDamage(S, mob, p, raw * (0.85 + rnd(S) * 0.3) * elementOutgoing(S, mob), st.def * 0.6,
    { type: primary, enchant: mob?.enchant });
  // the powers that lighten a blow (51-prefix.js); a blow they stop altogether (0) shows as a dodge
  const resisted = Math.max(1, Math.round(damageTotal(parts) * st.guard * ward * pasGuard(p) * elementTaken(S, p)));
  const dmg = elementShield(S, p, pfxMiti(S, rt, p, st, mob, resisted, raw));
  const before = p.hp;
  p.hp -= dmg;
  p.hitAt = S.now;
  rouse(S, p);
  if (mob) p.blame = blameOf(mob);
  damageEvent(rt, p.eid, dmg, dmg ? 0 : 3, 1, 0, parts);
  pfxHurt(S, rt, p, st, mob, dmg, raw);   // the powers that answer a hurt (thorn gives back 40%)
  if (p.hp > 0 && dmg && mob && (p.ch.job === "swordsman" || p.ch.job === "paladin")) jobTraitGain(S, rt, p, 1, false);
  if (p.hp > 0 && dmg && mob) elementApplyHit(S, rt, mob, p, parts, { scale: Math.min(before, dmg) / Math.max(1, damageTotal(parts)) });
  else if (p.hp <= 0 && !pfxLethal(S, rt, p, st, mob, dmg)) fall(S, rt, p);
  return dmg;
}
/** Damage that no armour turns: fire, poison. */
function wound(S, rt, p, dmg, type) {
  if (p.dead || S.now < (p.ghost || 0)) return;
  dmg = elementShield(S, p, Math.max(1, Math.round(dmg * elementTaken(S, p))));
  if (!dmg) return;
  cancelRecall(S, p, "귀환이 취소되었습니다.");
  p.hp -= dmg;
  p.hitAt = S.now;
  damageEvent(rt, p.eid, dmg, 0, 1, 0, type ? [[type, dmg]] : null);
  if (p.hp <= 0 && !pfxLethal(S, rt, p, stats(p), null, dmg)) fall(S, rt, p);
}
function fall(S, rt, p) {
  p.hp = 0;
  p.dead = true;
  pfxReset(p);
  p.streak = 0;
  p.burn = null; p.poison = null; p.slowed = 0;
  elementClear(p);
  weaponReset(p, true);
  dropAggro(S, p);
  rt.ev.push(["pd", p.eid]);
  toast(p, p.blame ? `쓰러졌습니다... (${p.blame.by})` : "쓰러졌습니다...");
  p.dirty = true;
}

const big = (mob) => (MOBS[mob.k].boss ? 12 : mob.el === 2 ? 8 : 0);
function mobsWithin(rt, x, y, r) {
  return rt.mobs.filter((mob) => !mob.dead && !mob.dive && dist(x, y, mob.x, mob.y) - big(mob) <= r);
}
/** Monsters standing in a strip `len` long from (x, y) along the unit vector (ux, uy). */
function mobsInLine(rt, x, y, ux, uy, len, half) {
  return rt.mobs.filter((o) => {
    if (o.dead || o.dive) return false;
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
    if (mob.dead || mob.dive) continue;
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
  return Math.round(stats(p).acd * pasAspd(p) * elementAttackFactor(p.S, p));
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
  if (st.wk === "hammer") {
    p.atkAt = now;
    p.combo = 0;
    p.swordBeat = null;
    newAct(p, false);
    startHammer(S, p, c);
    return;
  }
  const chained = now - p.atkAt < atkCd(p) + COMBO_MS;
  p.combo = chained ? (p.combo + 1) % 3 : 0;
  const fin = p.combo === 2;
  // The greatsword alternates its horizontal poses independently of the damage cadence.
  p.swordBeat = c === WKIND.sword ? (chained ? 1 - (p.swordBeat ?? 1) : 0) : null;
  const beat = p.swordBeat ?? p.combo;
  p.atkAt = now;
  newAct(p, false);
  // a bow looses an arrow, a staff or a book a homing missile, that flies (45-jobs.js): it lands, or not, a few ticks later
  if (c.shot) { (c.mag ? magicShot : bowShot)(S, rt, p, fin); return; }
  const range = atkRange(p);
  // the blow goes where you aim: the nearest monster inside the weapon's arc, or nothing
  const arc = c.arc || AIM_CONE;
  const mob = aimMob(rt, p, range, arc);
  if (!mob) {
    const far = range < 60 ? 14 : range * 0.7, [ax, ay] = AIM_V[p.aim | 0];
    rt.ev.push(["a", p.eid, c.fx, Math.round(p.x + ax * far), Math.round(p.y - 6 + ay * far), p.dir, beat]);
    return;
  }
  face(p, mob);
  // 창끝의 거리: a spear blow landing at the far end of the reach hits harder and through armour
  const tip = c === WKIND.spear && pasOn(p, "tip") && dist(p.x, p.y, mob.x, mob.y) - big(mob) >= c.range * SKILL.tip.at;
  if (tip) rt.ev.push(["tip", mob.id]);
  rt.ev.push(["a", p.eid, c.fx, Math.round(mob.x), Math.round(mob.y - 6), p.dir, beat]);
  const mult = (c.mult || 1) * (fin ? FINISH.mult : 1);
  // a greatsword's arc catches what stands beside the target, a spear runs through
  // what stands behind it (only ever in front: nothing behind the swing is caught by it)
  let extra = [];
  const near = (a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y);
  if (c.cleave) extra = mobsWithin(rt, p.x, p.y, range + (fin ? 10 : 4)).filter((o) => o !== mob && inArc(p, o, arc * (fin ? 1.25 : 1))).sort(near).slice(0, c.cleave + (fin ? 1 : 0));
  else if (c.line) { const [ux, uy] = aimVec(p, mob); extra = mobsInLine(rt, p.x, p.y, ux, uy, c.range + 10, fin ? 16 : 11).slice(0, c.line + (fin ? 1 : 0)); }
  const zx = mob.x, zy = mob.y;
  // the blow lands with weight: whatever it hits is shoved back and reels, the
  // finisher most of all. Elites only reel; bosses and field bosses stand firm.
  const shove = (o, k) => { const [ux, uy] = aimVec(p, o); shoveMob(S, p, o, ux, uy, c.kb * k, fin, tip && o === mob ? TIP.flinch : 0); };
  shove(mob, 1);
  // 급소 도려내기: a stab on a marked monster opens it up (bleeding, and a burst of speed); every stab marks
  const vit = c === WKIND.dagger && pasOn(p, "vitals") ? SKILL.vitals : null;
  const marked = vit && marksOf(S, mob) > 0;
  const melee = [p.eid, c.fx, +fin];
  hurtMob(S, rt, mob, p, mult * (tip ? SKILL.tip.mult : 1) * charmMarkK(S, rt, p, mob), false,
    tip ? { ...pasTip(S, rt, p), melee } : { melee });
  if (fin && c === WKIND.sword && pasHas(p, "sword_weight40")) pasQuake(S, rt, p, mob, zx, zy);
  if (vit && !mob.dead) {
    if (marked) {
      if (!(mob.dot && mob.dot.until > now && mob.dot.pid === p.pid)) rt.ev.push(["a", p.eid, 111, Math.round(mob.x), Math.round(mob.y - 6), p.dir]);
      mob.dot = { until: now + vit.ms, next: now + 1000, dmg: Math.max(1, Math.round(st.atk * vit.bleed)), pid: p.pid };
      p.vitSpd = now + vit.spdMs;
    }
    addMarks(S, mob, 1);
  }
  for (const o of extra) if (o !== mob) { shove(o, 0.6); hurtMob(S, rt, o, p, mult * 0.6, false, { melee }); }
  chainBlow(S, rt, p, st, mob, zx, zy, fin);
}
/**
 * A basic blow lands with weight: whatever it hits is shoved back along (ux, uy) and reels, the
 * finisher most of all. Elites only reel; bosses and field bosses stand firm. `more` ms more reeling.
 */
function shoveMob(S, p, o, ux, uy, kb, fin, more) {
  if (MOBS[o.k].boss || o.el === 2 || steady(S, o)) return;
  if (!o.el) knock(mapOfS(p.S, p.map), o, ux, uy, kb * (fin ? FINISH.kb : 1));
  holdMob(S, o, (fin ? FINISH.stun : 150) * (o.el ? 0.6 : 1) + more);   // reels: cooldowns paused
}
/** A basic blow landed on `mob` at (zx, zy) (`fin`: the combo's finisher): the prefix powers that answer one (뇌명의 leaps on: 51-prefix.js). */
function chainBlow(S, rt, p, st, mob, zx, zy, fin) {
  pfxBlow(S, rt, p, st, mob, zx, zy, !!fin);
}
/**
 * A staff's missile or a book's orb (45-jobs.js magicShot) strikes `mob`: the basic blow lands now,
 * magic, shoved along its flight. A book's orb bursts and splashes ≤ 4 more within `splash` px (the
 * finisher's wider), never behind where it was cast; the finisher's burst shows its ring (`s.ring`).
 */
function magicLand(S, rt, p, s, mob) {
  const st = stats(p), c = WKIND[s.blow.wk] || WKIND.staff, fin = s.blow.fin, zx = mob.x, zy = mob.y, mag = { mag: 1 };
  shoveMob(S, p, mob, s.ux, s.uy, c.kb, fin, 0);
  hurtMob(S, rt, mob, p, s.mult * charmMarkK(S, rt, p, mob), false, mag);
  if (c.splash) {
    s.ring = c.splash + (fin ? 8 : 0);
    const by = mobsWithin(rt, zx, zy, s.ring).filter((o) => o !== mob && (o.x - s.x0) * s.ux + (o.y - s.y0) * s.uy > -4).slice(0, 4);
    for (const o of by) { shoveMob(S, p, o, s.ux, s.uy, c.kb * 0.6, fin, 0); hurtMob(S, rt, o, p, s.mult * 0.6, false, mag); }
  } else if (fin) s.ring = 18;
  chainBlow(S, rt, p, st, mob, zx, zy, fin);
}

