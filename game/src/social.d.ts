/** Types for `social.js` (plain JS so node tests can import it as-is). */

export const FRIEND_MAX: number;
export const PENDING_MAX: number;
export const PRESENCE_MS: number;
export const KS: { friends(pid: string): string };
export const SMSG: Record<string, string>;

/** [name, level, job id, channel ("" = offline), map id]. */
export type FriendRow = [string, number, string, string, string];
export interface FriendList {
  ok: true;
  f: FriendRow[];
  /** names of those who asked */
  i: string[];
  /** names asked */
  o: string[];
}
export interface SocialReply {
  ok: boolean;
  error?: string;
  msg?: string;
  /** the other side, to be told in the channel `room` ("" = not online) */
  peer?: { pid: string; note: string; room?: string };
  list?: FriendList;
}
export interface SocialStore {
  get(key: string | string[]): Promise<unknown>;
  put(key: string | Record<string, unknown>, value?: unknown): Promise<unknown>;
}
export class Social {
  constructor(store: unknown);
  seen(pid: string, room: string, map: unknown, now: number): void;
  gone(pid: string): void;
  at(pid: string, now: number): { room: string; map: string; t: number } | null;
  find(server: string, name: string): Promise<{ pid: string; name: string } | null>;
  where(server: string, name: string, now: number, lockMs?: number): Promise<{ ok: boolean; error?: string; pid?: string; name?: string; room?: string }>;
  list(pid: string, now: number): Promise<FriendList>;
  request(pid: string, myName: string, toName: string, now: number): Promise<SocialReply>;
  answer(pid: string, myName: string, name: string, yes: boolean): Promise<SocialReply>;
  remove(pid: string, name: string, quiet?: boolean): Promise<SocialReply>;
  op(req: { a: string; pid: string; me?: string; name?: string | undefined }, now: number): Promise<SocialReply>;
}
