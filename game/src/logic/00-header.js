/**
 * 테일즈테일즈 (Tales Tales) — the whole game world, as plain rules.
 *
 * A party-hunting RPG set where worlds overlap: a fantasy meadow, a neon city
 * and a crystal rift all hang off one hub. Three ideas drive the rules:
 *   - loot is rolled, not listed: eight slots of gear, each piece with a rarity,
 *     random affixes and sockets; legendaries carry a unique power, set pieces
 *     grow stronger together, and runes in the right order form runewords;
 *   - a hunting ground is worth another lap: kill streaks, per-monster mastery,
 *     bounties that renew themselves, and a field boss the kills call out;
 *   - experience never stops mattering: it levels you up, and it can also be
 *     spent, without limit, on permanent training of your base stats;
 *   - hunting together pays: a party shares kills, quest credit and a bonus;
 *   - and there is a quiet side: campfires to sit by, fish to catch and cook,
 *     guilds, and a handful of emotes;
 *   - and a long game: waypoints, a return scroll, daily tasks, achievements and
 *     titles, a monster collection, a half-hourly world event, and first steps.
 *
 * This file is the single source of truth. The room (`room.ts`) only moves
 * bytes — it feeds actions and the clock in and fans per-player views out — and
 * the browser gets every table from `defs()` and every map from the server.
 *
 * Real-time notes: time is never read here (the room passes `now` in),
 * randomness comes from a seed in the state, and the world is advanced in
 * place; only characters are persisted (`exportChar`).
 */

export const meta = { game: "테일즈테일즈", minPlayers: 1, maxPlayers: 40 };

const T = 16;
/** The bag: INV_BASE slots to start, grown with bag_expand to INV_MAX (sheet field bagCap, 46-bag.js). */
const INV_BASE = 40, INV_MAX = 100;
/** Player levels run 1–200 (one level = one stat point); the world keeps its own 1–50 tiers (02-jobs-stats.js). */
const MAXLV = 200;
const STACK = 99;
/** The order the bag's tidy button puts things in. */
const SORT_KIND = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet", "rune", "pot", "food", "fish", "scroll", "buff", "camp", "revive", "pet", "mat", "furn"];
const VIEW_X = 280;
const VIEW_Y = 280;
const BASE_SPD = 48;
const PARTY_MAX = 4;
const PARTY_RANGE = 340;
/** Share of a kill's experience each member gets, by how many are in range. */
const PARTY_SHARE = [1, 0.8, 0.7, 0.65];

// ───────────────────────────── tables ─────────────────────────────

/**
 * A weapon kind decides how a basic attack lands. Attack no longer depends on a class, so the
 * per-hit mults follow the old classes' attack ratios (jobs-and-stats D.1). `crit` adds to the
 * critical chance, `mag` makes it magic (half the monster's armour counts), `shot` fires arrows.
 */
const WKIND = {
  // unhurried, weighty blows: each lands harder than a quick one would
  sword: { name: "대검", cd: 920, range: 34, fx: 0, cleave: 3, kb: 9, mult: 1.45, arc: 65, crit: 3 },
  dagger: { name: "단검", cd: 520, range: 26, fx: 3, kb: 4, mult: 1.1, arc: 35, crit: 10 },
  spear: { name: "창", cd: 780, range: 54, fx: 4, line: 3, kb: 7, mult: 1.4, arc: 25, crit: 5 },
  staff: { name: "스태프", cd: 980, range: 100, fx: 2, kb: 6, mult: 1.25, arc: 40, crit: 3, mag: 1 },
  book: { name: "마도서", cd: 800, range: 84, fx: 5, splash: 26, mult: 1.05, kb: 4, arc: 40, crit: 3, mag: 1 },
  // an arrow flies (45-jobs.js shots): the finisher hits 1.4× and goes through one more
  bow: { name: "활", cd: 760, range: 150, fx: 6, kb: 3, mult: 0.9, arc: 20, crit: 6, shot: { spd: 420, r: 6 } },
};
/**
 * Basic attacks come in threes: two strokes and a finisher. Strike again within
 * COMBO_MS of the last blow and the count goes on; wait longer and it starts over.
 */
const COMBO_MS = 700, FINISH = { mult: 1.4, kb: 1.8, stun: 280 };
/**
 * Aim. Every player aims along one of AIM_N directions on the ground (0 = +x, AIM_N/4 = +y),
 * set by the way they last walked or sent with an attack or skill. A basic attack reaches
 * only into its weapon's arc (`arc`, degrees either side of the aim); skills that pick a
 * target look within AIM_CONE degrees either side; lines, throws and dashes go straight
 * along the aim. Nothing behind you is ever hit by a blow aimed forward.
 */
const AIM_N = 64, AIM_CONE = 40;

/**
 * The weapon passives keep three of the old class mechanics alive on the weapons (03-skills.js,
 * 57-weapon-skills.js):
 *   단검 표식 (marks, 0–5 on each monster, MARK_MS): left by every stab once 급소 도려내기 is learned;
 *   창 창끝 (the spear's tip, TIP): a blow landing at the far end of the reach hits harder;
 *   스태프 원소 엮기 (weaving, WEAVE_MS): fire, ice and lightning react when one lands on another.
 */
const MARK_MAX = 5, MARK_MS = 10000, WEAVE_MS = 5000;
const TIP = { at: 0.72, mult: 1.5, flinch: 250 };
const ELEM = { f: "불", i: "얼음", l: "번개" };
/** What two elements make together (either order). */
const REACT = {
  fi: { id: "steam", name: "증기 폭발", r: 62, mult: 1.3 },
  il: { id: "super", name: "초전도", r: 56, mult: 0.6, vuln: 6000 },
  fl: { id: "over", name: "과부하", r: 50, mult: 1.1, knock: 26 },
};
const pairKey = (a, b) => [a, b].sort().join("");
