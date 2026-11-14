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
export function newChar(name: string, look?: unknown, oldLook?: unknown): Char;
/** A test or probe hero (jobs-and-stats F.3). */
export function hero(name: string, o?: { wk?: string; lvl?: number; st?: Record<string, number>; wm?: Record<string, number>; job?: string; wk2?: string; migrate?: boolean; look?: unknown[] }): Char;
export function addPlayer(state: World, playerId: string, char: Char): number;
export function removePlayer(state: World, playerId: string): Char | null;
export function exportChar(state: World, playerId: string): Char | null;
/** Players whose progress asked to be saved soon (quest, enhancement, level…); clears the flags. */
export function takeSaves(state: World): string[];
export function defs(): unknown;
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
