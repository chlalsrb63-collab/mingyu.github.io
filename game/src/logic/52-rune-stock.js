// Four one-line variants per prefix encourage different builds under the same set effect.
const SET_AFFIXES = {
  willowwind: ["spd", "crit", "mp", "xp"], duskfang: ["ls", "atk", "hp", "critd"],
  lantern: ["hp", "def", "ls", "mp"], brassscale: ["gold", "mf", "xp", "atk"],
  azureknot: ["mp", "spd", "def", "crit"], ashbloom: ["atkp", "atk", "critd", "mp"],
  silverlake: ["critd", "crit", "def", "mp"], stormsail: ["spd", "atk", "crit", "atkp"],
  inkthorn: ["crit", "critd", "ls", "atkp"], lastbell: ["atkp", "atk", "critd", "ls"],
  redanvil: ["hp", "atk", "atkp", "ls"], astrolabe: ["mp", "atkp", "critd", "spd"],
  dawnpillar: ["hp", "def", "ls", "crit"], moonveil: ["spd", "critd", "crit", "atk"],
  blackstar: ["atkp", "atk", "critd", "hp"],
};
const MAGIC_AFFIX = Object.fromEntries(MAGIC_RUNES.map(([, , stat, n]) => [stat, n]));
for (const [set, def] of Object.entries(RUNE_SETS)) {
  const lines = SET_AFFIXES[set];
  for (let i = 0; i < lines.length; i++) {
    const stat = lines[i];
    addRune(`ru_${set}_${i + 1}`, 4, `${def.name}의 룬`, [[stat, MAGIC_AFFIX[stat]]], set);
  }
}

/** Normal packs mainly drop magic runes; elites and boss/chest rewards improve the rarity. */
const RUNE_ODDS = [[73, 20, 2], [59, 25, 6], [45, 30, 12]];
function rollRuneId(S, rank = 0) {
  const [magic, rare, legendary] = RUNE_ODDS[rank];
  const roll = rnd(S) * 100;
  const q = roll < magic ? 1 : roll < magic + rare ? 2 : roll < magic + rare + legendary ? 3 : 4;
  const tierRoll = q === 4 ? rnd(S) : 0;
  const pool = q === 4 ? RUNE_POOLS[4][tierRoll < 0.5 ? 2 : tierRoll < 0.83 ? 3 : 4] : RUNE_POOLS[q];
  return pool[ri(S, 0, pool.length - 1)];
}

function foundItem(S, p, id, n) {
  const rune = RUNES[id];
  p.gain.push(["item", id, n, rune?.q || 0]);
  if (rune?.set) {
    p.ch.cnt.rune_find += n;
    checkAch(S, p);
  }
}

function gainRune(S, p, rank = 0) {
  const id = rollRuneId(S, rank);
  if (!addItem(p.ch, id, 1)) return false;
  foundItem(S, p, id, 1);
  return true;
}
