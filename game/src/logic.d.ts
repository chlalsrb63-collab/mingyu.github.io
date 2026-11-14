/**
 * Types for `logic.js` — the six contract exports plus the real-time extras the
 * room drives (`tick`, player lifecycle, character sheets).
 *
 * `logic.js` stays plain JavaScript with no imports; this file is what gives the
 * room type-checking against it. The world state is opaque to the room.
 */

export type World = { now: number; seed: number };
export type Char = { name: string; cls: string; lvl: number; xp: number; [key: string]: unknown };

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
export function newChar(name: string, cls: unknown, look: unknown): Char;
export function addPlayer(state: World, playerId: string, char: Char): number;
export function removePlayer(state: World, playerId: string): Char | null;
export function exportChar(state: World, playerId: string): Char | null;
export function defs(): unknown;
/** Local playtest (map editor): put a sheet on a map tile (the nearest standable one). */
export function devPlace(char: Char, map: string, tx: number, ty: number): boolean;
