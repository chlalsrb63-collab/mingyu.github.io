/** Types for `accounts.js` (plain JS so node tests can import it as-is). */

export interface Summary {
  name: string;
  cls: string;
  lvl: number;
  look: unknown[];
}
export interface ServerList {
  servers: Array<{ id: string; name: string; channels: Array<{ id: string; name: string; n?: number }> }>;
}
/** A cleaned /api body as the worker forwards it; `ip` is added by the worker. */
export interface ApiBody {
  id?: string | undefined;
  pw?: string | undefined;
  legacy?: string | undefined;
  token?: string | undefined;
  ip?: string | undefined;
}
export type ApiReply = { ok: boolean; [key: string]: unknown };

/** The slice of Durable Object storage the account service uses. */
export interface KeyStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put(entries: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
}

export const SERVERS: ServerList["servers"];
export const CHANNELS: string[];
export const ID_RE: RegExp;
export const TOKEN_RE: RegExp;
export const PW_MIN: number;
export const PW_MAX: number;
export const MAX_BODY_BYTES: number;
export const PBKDF2_ITER: number;
export const SESSION_MS: number;

export function serverOf(room: string): string | null;
export function normId(v: unknown): string | null;
export function pidFor(id: string, server: string): string;
export function splitPid(pid: string): { id: string; server: string } | null;
export function validLegacy(v: unknown): boolean;
export function ipBucket(ip: unknown): string;
export function summary(char: unknown): Summary | null;
export function parseApiBody(
  op: string,
  text: string,
): { ok: true; body: Record<string, string> } | { ok: false; error: string };

export const K: {
  acc(id: string): string;
  sess(tokenKey: string): string;
  char(pid: string): string;
  sum(pid: string): string;
  name(server: string, name: string): string;
  guild(server: string, name: string): string;
  rank(server: string): string;
  failId(id: string): string;
  failIp(bucket: string): string;
  signupIp(bucket: string): string;
};

export class Accounts {
  constructor(store: KeyStore, crypto: Crypto);
  signup(body: ApiBody, now: number): Promise<ApiReply>;
  login(body: ApiBody, now: number): Promise<ApiReply>;
  logout(body: ApiBody): Promise<ApiReply>;
  auth(token: unknown, now: number): Promise<{ ok: true; id: string } | { ok: false; expired: true; error: string }>;
  me(body: ApiBody, now: number): Promise<ApiReply>;
  report(room: string, n: number, now: number): void;
  servers(now: number): ServerList;
  summaryPuts(list: Array<{ pid: string; char: unknown }>): Record<string, Summary | null>;
}
