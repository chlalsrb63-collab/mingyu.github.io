// Damage type indices are wire values. Append new types without reordering these keys.
const DAMAGE_TYPES = ["physical", "bleed", "fire", "cold", "lightning", "poison", "dark", "light"];
const ELEMENTS = {
  physical: { name: "물리", color: "#fff4e8", enchant: "파쇄의" },
  bleed: { name: "출혈", color: "#fb4b85", enchant: "유혈의" },
  fire: { name: "화염", color: "#ff9246", enchant: "불꽃의" },
  cold: { name: "냉기", color: "#87e4ff", enchant: "서리의" },
  lightning: { name: "번개", color: "#fff07a", enchant: "감전의" },
  poison: { name: "독", color: "#a5ef66", enchant: "맹독의" },
  dark: { name: "어둠", color: "#d4a0ff", enchant: "저주의" },
  light: { name: "빛", color: "#ffca83", enchant: "눈부심의" },
};

const WEAPON_ELEMENT = { staff: "lightning", book: "dark" };
const WEAVE_ELEMENT = { f: "fire", i: "cold", l: "lightning" };
const SKILL_ELEMENT_GROUPS = {
  physical: ["slash", "rend", "spiral", "pierce", "leapshot", "verdict", "rain", "hammer_stamp", "hammer_fault", "hammer_final", "ironsiege", "crosscut", "cleave", "hook", "snipe", "whirl", "musou", "stomp", "dragonpierce", "rollshot", "shoulder", "parry", "mountain", "sword_weight40"],
  bleed: ["ambush", "flurry", "bloodburst", "rupture", "bladevortex"],
  fire: ["comet", "mortar"],
  cold: ["inkshot"],
  lightning: ["elemfan"],
  poison: ["traps", "snare"],
  dark: ["shade", "soulbolt", "gravity", "pact", "dive", "sanctuary", "drain"],
  light: ["oathward", "runecircle"],
};
const SKILL_ELEMENTS = Object.fromEntries(Object.entries(SKILL_ELEMENT_GROUPS).flatMap(([type, ids]) => ids.map((id) => [id, type])));
const SKILL_WITHOUT_DAMAGE = new Set(["rally_banner", "revive_binding", "smoke"]);
for (const [id, sk] of Object.entries(SKILL)) {
  sk.damageType = WEAVE_ELEMENT[sk.el] || SKILL_ELEMENTS[id] || (sk.kind === "p" || SKILL_WITHOUT_DAMAGE.has(id) ? null : WEAPON_ELEMENT[sk.wk] || "physical");
}

/** Skill objects and ids use the same table, including delayed spell hits. */
function skillDamageType(skill, wk) {
  const sk = typeof skill === "string" ? SKILL[skill] : skill;
  if (!sk) return "physical";
  return sk.damageType || WEAVE_ELEMENT[sk.el] || WEAPON_ELEMENT[wk] || "physical";
}

const CORE_AFFIX_KEYS = AFFIX.map(([key]) => key);
const OFFENSE_ELEMENT_AFFIX = [];
const DEFENSE_ELEMENT_AFFIX = ["res_all"];
const ELEMENT_AFFIX = { res_all: ["res", "all"] };
const CHANCE_AILMENTS = new Set(["bleed", "fire", "dark", "light"]);
const ELEMENT_AFFIX_TYPES = [
  ["dmg", "damage", "추가 피해", 2, 6, 0.28],
  ["pen", "pen", "관통 %", 3, 7, 0.05],
  ["proc", "proc", "상태이상 확률 %", 3, 7, 0.05],
  ["dur", "dur", "상태이상 지속시간 %", 6, 13, 0.10],
  ["res", "res", "저항 %", 4, 9, 0.10],
];
for (const type of DAMAGE_TYPES) {
  const { name, enchant } = ELEMENTS[type];
  for (const [prefix, stat, label, min, max, growth] of ELEMENT_AFFIX_TYPES) {
    if (stat === "proc" && !CHANCE_AILMENTS.has(type)) continue;
    const key = `${prefix}_${type}`;
    AFFIX.push([key, `${name} ${label}`, enchant, min, max, growth]);
    ELEMENT_AFFIX[key] = [stat, type];
    (stat === "res" ? DEFENSE_ELEMENT_AFFIX : OFFENSE_ELEMENT_AFFIX).push(key);
  }
}
AFFIX.push(["res_all", "모든 속성 저항 %", "조화의", 2, 4, 0.04]);
const AFFIX_BY_KEY = Object.fromEntries(AFFIX.map((a) => [a[0], a]));
registerElementRunes();

/** One roll per line, preserving ordinary affix weighting and excluding duplicate keys. */
function rollAffixKey(S, slotType, existing) {
  const ordinary = CORE_AFFIX_KEYS.filter((key) => !existing.has(key));
  const typed = (slotType === "weapon" ? OFFENSE_ELEMENT_AFFIX : DEFENSE_ELEMENT_AFFIX).filter((key) => !existing.has(key));
  const roll = rnd(S), chance = 0.21;
  if (!ordinary.length) return typed[Math.floor(roll * typed.length)];
  if (!typed.length) return ordinary[Math.floor(roll * ordinary.length)];
  return roll < chance ? typed[Math.floor((roll / chance) * typed.length)] : ordinary[Math.floor(((roll - chance) / (1 - chance)) * ordinary.length)];
}

const emptyElementStats = () => ({ damage: {}, pen: {}, res: {}, proc: {}, dur: {} });

function addElementAffix(out, key, value) {
  if (!Object.hasOwn(ELEMENT_AFFIX, key)) return;
  const [kind, type] = ELEMENT_AFFIX[key], row = out[kind];
  if (type === "all") for (const t of DAMAGE_TYPES) row[t] = (row[t] || 0) + value;
  else row[type] = (row[type] || 0) + value;
}

// Signature weapon and armor benefits are static: existing gear receives them on load as well.
const SIGNATURE_ELEMENT_AFFIX = {
  w_bloodcrown: [["dmg_bleed", 12], ["proc_bleed", 5]],
  w_cavhammer: [["dmg_lightning", 12], ["pen_lightning", 6]],
  w_ribbook: [["dmg_dark", 10], ["dur_dark", 10]],
  w_whalebow: [["dmg_cold", 12], ["pen_cold", 6]],
  w_bloomstaff: [["dmg_light", 13], ["proc_light", 5]],
  veil_h: [["res_dark", 12]], veil_a: [["res_dark", 14]], veil_r: [["res_bleed", 9]], veil_n: [["res_dark", 9], ["res_all", 3]],
  bloom_h: [["res_cold", 12]], bloom_a: [["res_cold", 16]], bloom_r: [["res_light", 10]], bloom_n: [["res_cold", 10], ["res_all", 3]],
};
for (const [id, lines] of Object.entries(SIGNATURE_ELEMENT_AFFIX)) ITEMS[id].elementAf = lines;

// These named bonuses follow the existing legendary power's equipped winner.
const ELEMENT_PREFIX_AFFIX = {
  chain: [["pen_lightning", 8], ["dur_lightning", 8]],
  nova: [["dmg_fire", 6]],
  bleed: [["pen_bleed", 8], ["dur_bleed", 10]],
  bile: [["pen_poison", 8]],
  hellfire: [["dmg_fire", 12], ["dur_fire", 10]],
  blizzard: [["dmg_cold", 9], ["dur_cold", 8]],
  rime: [["res_cold", 15]],
  cure: [["res_poison", 10]],
  purge: [["res_all", 4]],
  halo: [["res_dark", 8]],
  carap: [["res_physical", 8]],
  bastion: [["res_all", 5]],
};

const MONSTER_PROFILES = {
  neutral: { type: "physical", res: { bleed: -8 }, holyWeak: false },
  hide: { type: "physical", res: { physical: 4, bleed: 16, fire: -12 }, holyWeak: false },
  feral: { type: "bleed", res: { bleed: 24, cold: -16 }, holyWeak: false },
  blood: { type: "bleed", res: { bleed: 44, dark: 12, light: -18 }, holyWeak: false },
  ember: { type: "fire", res: { fire: 48, cold: -24 }, holyWeak: false },
  inferno: { type: "fire", res: { fire: 80, bleed: 14, cold: -30 }, holyWeak: false },
  frost: { type: "cold", res: { cold: 48, fire: -24 }, holyWeak: false },
  rime: { type: "cold", res: { cold: 72, physical: 8, fire: -30 }, holyWeak: false },
  storm: { type: "lightning", res: { lightning: 46, cold: -14, poison: -10 }, holyWeak: false },
  toxin: { type: "poison", res: { poison: 54, fire: -20 }, holyWeak: false },
  shadow: { type: "dark", res: { dark: 45, light: -22 }, holyWeak: true },
  revenant: { type: "dark", res: { dark: 42, bleed: 24, poison: 18, light: -30 }, holyWeak: true },
  radiant: { type: "light", res: { light: 48, dark: -25 }, holyWeak: false },
  chest: { type: "physical", res: {}, holyWeak: false },
};

// Explicit profiles express the ecology rather than treating a different sprite as a different species.
const MONSTER_ELEMENT_GROUPS = {
  hide: ["meadowram", "splitboar", "ratking", "gatorhalf", "crabskull", "moleworm", "bearmaw", "twingoat", "loggator", "coralturtle", "cactushog", "stumpmaw", "burrlynx", "catsplit_gold", "foxtwine_gold", "twingoat_gold", "bearmaw_gold", "gatorhalf_steel", "ratking_gold", "spinescorp_gold", "ribdeer_gold", "moleworm_gold", "horsehalf_gold"],
  feral: ["foxtwine", "catsplit", "gnawbadger", "dropsloth", "gigglehyena", "pigeonmass", "horsehalf", "lionhand", "spiderhand", "blightsquirrel", "wingcrane", "loomcolossus", "vinemonkey", "orchidmantis"],
  blood: ["batcluster_blood", "crabskull_blood", "squidrat_blood", "fishwalker_blood", "twingoat_blood", "spiderhand_blood", "gravrose_blood", "barnacleseal_blood", "bloodhorn", "bloodshard"],
  ember: ["wickhare", "smoggecko", "doghead_fire", "spinescorp_fire", "ribvulture_fire", "foxtwine_fire", "eyecrow_ash", "lionhand_gold"],
  inferno: ["boss", "wickregent", "sandmaw"],
  frost: ["splitboar_frost", "fishwalker_frost", "eelknot_frost", "crabskull_frost", "ribdeer_frost", "foxtwine_frost", "shroomboar_frost", "crowscare_frost", "hermitskull_frost", "rimehare", "frostmoth", "barnacleseal", "hagfishhead"],
  rime: ["rimewalrus", "rootwarden", "crownstag", "bloomwhale"],
  storm: ["sluiceeel", "spoolsnipe", "eelknot", "hydrasnake_steel", "eelknot_gold", "prismmole", "airship_gale", "airship_lookout", "eyegull", "brainjelly", "clubshrimp", "sluiceleviathan"],
  toxin: ["hydrasnake", "mothface", "toadbrood", "gutfrog_poison", "ratking_bile", "slugtongue", "leechmaw", "toadbrood_poison", "hydrasnake_poison", "mothface_bile", "ribdeer_bile", "leechmaw_ash", "mothface_ash", "shroomboar", "gravrose", "dartbrood", "spinescorp", "sowseer", "knotwidow"],
  shadow: ["owlstare", "crowscare", "bogcrown", "hollowowl", "batcluster", "nightbat", "serpentwing", "serpentwing_ash", "bearmaw_ash", "splitboar_ash", "fishwalker_ash", "wingcrane_ash", "abyssboss", "mistiger", "cloakbat"],
  revenant: ["bellnewt", "gravecricket", "dunescarab", "ribdeer", "twinhare_bone", "bonehound", "bonehound_ash", "bonehound_gold", "lambmaw_bone", "leechmaw_bone", "spiderhand_bone", "serpentwing_bone", "rotstag", "hermitskull", "ribvulture_bone", "mummycamel", "spinescorp_bone", "ribvulture", "knellkeeper"],
  radiant: ["prismcantor", "beadmonkey", "crownpeacock", "hydrasnake_gold", "sowseer_gold", "owlstare_gold", "ribvulture_gold"],
};
const MONSTER_ELEMENT = Object.fromEntries(Object.entries(MONSTER_ELEMENT_GROUPS).flatMap(([profile, kinds]) => kinds.map((kind) => [kind, MONSTER_PROFILES[profile]])));
for (const [id, mob] of Object.entries(MOBS)) mob.element = mob.chest ? MONSTER_PROFILES.chest : MONSTER_ELEMENT[id] || MONSTER_PROFILES.neutral;

/** A missing or neutral kind still has a complete damage profile. */
const monsterElement = (kind) => MOBS[kind]?.element || MONSTER_PROFILES.neutral;
