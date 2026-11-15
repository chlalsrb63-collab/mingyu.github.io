/**
 * Types for `logic.js` — the six contract exports plus the real-time extras the
 * room drives (`tick`, player lifecycle, character sheets).
 *
 * `logic.js` stays plain JavaScript with no imports; this file is what gives the
 * room type-checking against it. The world state is opaque to the room.
 */

export type World = { now: number; seed: number };
export type Char = { name: string; job: string; lvl: number; xp: number; [key: string]: unknown };

export const meta: { game: string; minPlayers: number; maxPlayers: number };

export function setup(players?: string[]): World;
export function validateAction(
  state: World,
  playerId: string,
  action: unknown,
): { ok: true } | { ok: false; error?: string };
export function applyAction(state: World, playerId: string, action: unknown): World;
export function isGameOver(state?: World): { over: false };
/** One player's snapshot for this tick, or null if they have no character in the world. */
export function viewFor(state: World, playerId: string): unknown;

/** Advance the world to `now` (ms). */
export function tick(state: World, now: number): World;
/** Clear per-tick events once every player's view has been taken. */
export function endTick(state: World): void;
export function playerCount(state: World): number;

export function validName(name: unknown): boolean;
/** A new 모험가; `look` (an old caller's `(name, cls, look)` still works: the look in third place is taken). */
/** `wk`: the weapon kind picked at creation (whitelisted; anything else = the old dagger). A look array there is the old call shape. */
export function newChar(name: string, look?: unknown, wk?: unknown): Char;
/** A test or probe hero (jobs-and-stats F.3). */
export function hero(name: string, o?: { wk?: string; lvl?: number; st?: Record<string, number>; wm?: Record<string, number>; job?: string; wk2?: string; migrate?: boolean; look?: unknown[] }): Char;
export function addPlayer(state: World, playerId: string, char: Char): number;
export function removePlayer(state: World, playerId: string): Char | null;
export function exportChar(state: World, playerId: string): Char | null;
/** Players whose progress asked to be saved soon (quest, enhancement, level…); clears the flags. */
export function takeSaves(state: World): string[];
export function defs(): unknown;
/** The starting weapons for the creation page: [kind, name, weapon name, first skill name, range] each. */
export function starters(): [string, string, string, string, number][];
/** Local playtest (map editor): put a sheet on a map tile (the nearest standable one). */
export function devPlace(char: Char, map: string, tx: number, ty: number): boolean;
/** The sky over a map at `now`: hour, phase, weather, the night storyteller and the camps (tests, tools). */
export function skyAt(map: string, now: number): { hour: number; phase: number; name: string; night: boolean; outdoor: boolean; wx: number; npc: unknown; tale: number; camps: { x: number; y: number; seats: number[][] }[] };
/** The live state of a map in the world, made on first use (monsters placed, camps lit); null for an unknown id (tests). */
export function runtime(state: World, mapId: string): { id: string; mobs: unknown[]; n: number; [key: string]: unknown } | null;
/** Every map built (tests, tools); `fresh` builds them (or only `ids`) again from the seeds. */
export function atlas(fresh?: boolean, ids?: string[] | null): { maps: Record<string, unknown>; fires: Record<string, number[][]>; waypoints: Record<string, unknown> };
/** The map registry (tests): the maps built so far, and what is known of every map without building it. */
export function mapStats(): { built: string[]; meta: Record<string, { id: string; name: string; theme: string | null; band: number[] | null; safe: boolean; w: number; h: number; wp: boolean; kinds: string[]; eager: boolean }> };

export type NpcAt = {
  id: string; map: string; x: number; y: number; tx: number; ty: number;
  dir: number; act: string; place: string; with: string | null;
  moving: boolean; hidden: boolean; onPost: boolean; until: number;
};
export function npcAt(id: string, now: number): NpcAt | null;
export function npcPlan(id: string, now: number): { place: string; act: string; until: number; next: { place: string; act: string; at: number } } | null;
export function npcsOn(map: string, now: number): string[];
export function lifeLegs(map: string, now: number, since?: number): number[][];
export function lifeWhere(now: number): number[][];
export function npcReach(player: { S: World; map: string; x: number; y: number }, id: string): boolean;
export function lifeCheck(): string[];

// ── 차단 · 귓속말 (63-social-weekly.js): what the room needs to relay whispers and friend notices
/** The pid of the player of that name in this world, or null. */
export function pidOfName(state: World, name: unknown): string | null;
/** A character's name by pid; "" when they are not in this world. */
export function nameOf(state: World, playerId: string): string;
/** Has the player blocked that name? */
export function blockedBy(state: World, playerId: string, name: unknown): boolean;
/** A whisper arriving for `toName`: false when they are not here; true when delivered or dropped by their block list. */
export function whisperIn(state: World, toName: string, fromName: string, text: string): boolean;
/** The sender's own copy of a whisper that was handed to another channel. */
export function whisperOut(state: World, playerId: string, toName: string, text: string): boolean;
/** A toast for one player from outside the rules; false when they are not here. */
export function noteTo(state: World, playerId: string, text: string): boolean;
