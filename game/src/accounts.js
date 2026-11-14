/**
 * Accounts, sessions, servers and channels — the server side of public/account.js.
 *
 * Plain JavaScript with no imports so the same file runs inside the vault
 * Durable Object (via room.ts) and under node in tests/accounts.mjs. Everything
 * that needs the platform is passed in: `store` (Durable Object storage, or a
 * Map-backed fake with the same get/put/delete shape) and `crypto` (WebCrypto).
 *
 * ── WORLDS ──────────────────────────────────────────────────────────────
 * Two servers with two channels each: s1-ch1, s1-ch2, s2-ch1, s2-ch2. A
 * character belongs to an account on one server; its storage id ("pid") is
 * `${accountId}@${server}`, so each account has one character per server and
 * the same character in every channel of that server.
 *
 * ── STORAGE KEYS (all in the vault instance, "vault:characters") ────────
 *   a:<id>            account {id, salt, hash, iter, t, sess:[tokenKey…]}
 *   s:<sha256(token)> session {id, exp} — the raw token is never stored
 *   c:<pid>           character record {char, sess?}       (unchanged shape)
 *   m:<pid>           character summary {name, cls, lvl, look} for /api/me
 *   n:<name>          s1 character-name claim → pid       (the old global index)
 *   n:s2:<name>       s2 character-name claim → pid
 *   g:<guild>         s1 guild-name claim                  (the old global index)
 *   g:s2:<guild>      s2 guild-name claim
 *   rank / rank:s2    top-20 ranking of s1 / s2
 *   f:i:<id>          failed-login counter for an id
 *   f:p:<ip bucket>   failed-login counter for an address
 *   f:s:<ip bucket>   sign-up counter for an address
 *
 * ── MIGRATION NOTE ──────────────────────────────────────────────────────
 * Before accounts, characters lived at c:<random anonymous pid> (base36, never
 * contains "@"), names at n:<name>, guilds at g:<name> and the ranking at
 * "rank", all global. 1서버 inherits those keys unchanged, so every old name
 * and guild stays reserved on s1 and the old ranking becomes the s1 ranking;
 * 2서버 gets fresh, ":"-separated keys that no old key can equal (character and
 * guild names cannot contain ":"). Old characters are NOT moved in bulk: they
 * wait at c:<old pid> until their browser signs up with `legacy` = that pid,
 * which moves the record to c:<id>@s1 (and its name claim to the new pid) and
 * deletes the old key, so a character can be adopted only once. The new
 * prefixes a:/s:/m:/f: did not exist before.
 */

export const SERVERS = [
  { id: "s1", name: "1서버", channels: [{ id: "s1-ch1", name: "채널 1" }, { id: "s1-ch2", name: "채널 2" }] },
  { id: "s2", name: "2서버", channels: [{ id: "s2-ch1", name: "채널 1" }, { id: "s2-ch2", name: "채널 2" }] },
];
export const CHANNELS = SERVERS.flatMap((s) => s.channels.map((c) => c.id));

export const ID_RE = /^[a-z0-9_]{4,16}$/;
export const PW_MIN = 6;
export const PW_MAX = 64;
export const TOKEN_RE = /^[0-9a-f]{64}$/;
/** Workers' WebCrypto refuses PBKDF2 above 100 000 iterations. */
export const PBKDF2_ITER = 100_000;
export const SESSION_MS = 30 * 24 * 3600_000;
/** A session is pushed forward at most once a day (one write, not one per request). */
const SESSION_SLIDE_MS = 24 * 3600_000;
/** Sessions kept per account; signing in on an 11th device ends the oldest. */
const SESSIONS_PER_ACCOUNT = 10;
/** A channel's reported head count is trusted for this long. */
const COUNT_TTL_MS = 45_000;

/** Failed-login throttles: `limit` failures inside `window` → locked for base·2^(n-1) (≤ max). */
export const THROTTLE = {
  id: { limit: 5, window: 15 * 60_000, base: 60_000, max: 15 * 60_000 },
  ip: { limit: 20, window: 15 * 60_000, base: 60_000, max: 15 * 60_000 },
  /** Sign-ups per address per hour. */
  signup: { limit: 10, window: 3600_000 },
};

export const MSG = {
  badId: "아이디는 영문 소문자·숫자·밑줄 4~16자입니다",
  shortPw: `비밀번호는 ${PW_MIN}자 이상입니다`,
  longPw: "비밀번호가 너무 깁니다",
  taken: "이미 사용 중인 아이디입니다",
  wrong: "아이디 또는 비밀번호가 올바르지 않습니다",
  expired: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  signups: "이 주소에서 너무 많은 아이디를 만들었습니다. 잠시 후 다시 시도해 주세요.",
  locked: (s) => `로그인 시도가 너무 많습니다. ${s}초 후에 다시 시도해 주세요.`,
};

// ── names and keys ─────────────────────────────────────────────────────

/** "s1" for "s1-ch2"; null for anything that is not one of the four channels. */
export function serverOf(room) {
  return CHANNELS.includes(room) ? String(room).slice(0, 2) : null;
}
export function normId(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return ID_RE.test(s) ? s : null;
}
/** "" when the password is acceptable, else the reason. */
export function pwProblem(pw) {
  if (typeof pw !== "string" || pw.length < PW_MIN) return MSG.shortPw;
  if (pw.length > PW_MAX) return MSG.longPw;
  return "";
}
export function pidFor(id, server) {
  return `${id}@${server}`;
}
/** {id, server} of an account pid, or null for an old anonymous pid. */
export function splitPid(pid) {
  const m = /^([a-z0-9_]{4,16})@(s[12])$/.exec(String(pid));
  return m ? { id: m[1], server: m[2] } : null;
}
/** An old anonymous pid as the browser kept it: 8–64 chars, never one of ours. */
export function validLegacy(v) {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

export const K = {
  acc: (id) => `a:${id}`,
  sess: (tokenKey) => `s:${tokenKey}`,
  char: (pid) => `c:${pid}`,
  sum: (pid) => `m:${pid}`,
  /** s1 keeps the pre-account global keys (see MIGRATION NOTE). */
  name: (server, name) => (server === "s1" ? `n:${String(name).toLowerCase()}` : `n:${server}:${String(name).toLowerCase()}`),
  guild: (server, name) => (server === "s1" ? `g:${String(name).toLowerCase()}` : `g:${server}:${String(name).toLowerCase()}`),
  rank: (server) => (server === "s1" ? "rank" : `rank:${server}`),
  failId: (id) => `f:i:${id}`,
  failIp: (bucket) => `f:p:${bucket}`,
  signupIp: (bucket) => `f:s:${bucket}`,
};

/** Throttle by address, but treat one IPv6 /64 as one address. */
export function ipBucket(ip) {
  const s = typeof ip === "string" ? ip.trim().slice(0, 64) : "";
  if (!s) return "?";
  if (s.includes(":")) return s.toLowerCase().split(":").slice(0, 4).join(":");
  return s.replace(/[^0-9.]/g, "") || "?";
}

/**
 * The old four classes as job ids (jobs-and-stats: summaries and rank rows written before jobs carry
 * `cls` = a class id and `lvl` on the old 1–50 scale, and no `v`).
 */
export const JOB_ALIAS = { warrior: "swordsman", rogue: "thief", lancer: "lancer", mage: "wizard", ranger: "lancer", archer: "lancer" };

/**
 * A character's lobby summary. `cls` keeps its key but carries the job id; `v: 2` marks the 1–200 level
 * scale. A sheet still from the four-class days (not yet loaded into a world) is summarised as it was —
 * no `v`, its class and old level — and readers convert it (fromOldRow).
 */
export function summary(char) {
  if (!char || typeof char !== "object") return null;
  const look = Array.isArray(char.look) ? char.look : [];
  if (typeof char.job === "string") return { name: String(char.name), cls: char.job, lvl: Number(char.lvl) || 1, look, v: 2 };
  return { name: String(char.name), cls: String(char.cls), lvl: Number(char.lvl) || 1, look };
}

/** A ranking row: name, job (under `cls`), level, total experience spent on points (the tie-break), `v: 2`. */
export function rankRow(char) {
  return { name: String(char.name), cls: String(char.job || JOB_ALIAS[char.cls] || "adventurer"), lvl: Number(char.lvl) || 1, xp: Number(char.xpt) || 0, v: 2 };
}

/** A summary or rank row from before jobs (no `v`) read on the new scale: level 4L−3, the class's job. */
export function fromOldRow(row) {
  if (!row || typeof row !== "object" || row.v) return row;
  return { ...row, cls: JOB_ALIAS[row.cls] || "adventurer", lvl: Math.min(197, 4 * (Number(row.lvl) || 1) - 3), xp: 0, v: 2 };
}

// ── request bodies ─────────────────────────────────────────────────────

/** Largest /api body the worker reads. */
export const MAX_BODY_BYTES = 2048;
const FIELDS = { signup: ["id", "pw", "legacy"], login: ["id", "pw"], logout: ["token"], me: ["token"] };
const FIELD_MAX = { id: 64, pw: 256, legacy: 128, token: 128 };

/** Untrusted JSON text → the known string fields of `op`, or an error. */
export function parseApiBody(op, text) {
  const fields = FIELDS[op];
  if (!fields) return { ok: false, error: "unknown request" };
  if (typeof text !== "string" || text.length > MAX_BODY_BYTES) return { ok: false, error: "request too large" };
  let obj;
  try {
    obj = JSON.parse(text || "{}");
  } catch {
    return { ok: false, error: "invalid json" };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return { ok: false, error: "expected a json object" };
  const body = {};
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string" || v.length > FIELD_MAX[f]) return { ok: false, error: `invalid ${f}` };
    body[f] = v;
  }
  return { ok: true, body };
}

// ── crypto helpers (crypto = WebCrypto, passed in) ─────────────────────

export function hex(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += b.toString(16).padStart(2, "0");
  return s;
}
export function fromHex(s) {
  const out = new Uint8Array(s.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
/** PBKDF2-SHA256 → 64 hex chars. The password is NFC-normalised so every keyboard types the same bytes. */
export async function hashPassword(crypto, pw, salt, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pw).normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return hex(bits);
}
/** Compares two equal-format strings without an early exit. */
export function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  return diff === 0;
}
export function newToken(crypto) {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
/** Sessions are stored under SHA-256(token): a storage dump does not hand out logins. */
export async function tokenKey(crypto, token) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

// ── throttles ──────────────────────────────────────────────────────────

/** Milliseconds a counter still keeps its subject locked out (0 = free). */
export function lockLeft(rec, now) {
  return rec && rec.until > now ? rec.until - now : 0;
}
/** The counter after one more failure. */
export function failed(rec, now, rule) {
  const fresh = !rec || now - rec.t >= rule.window;
  const locks = rec && now - rec.t < 3600_000 ? rec.locks || 0 : 0;
  const r = { n: fresh ? 0 : rec.n, t: now, until: rec && !fresh ? rec.until || 0 : 0, locks };
  r.n += 1;
  if (r.n >= rule.limit) {
    r.locks += 1;
    r.until = now + Math.min(rule.base * 2 ** (r.locks - 1), rule.max);
    r.n = 0;
  }
  return r;
}

// ── the account service ────────────────────────────────────────────────

/**
 * One per vault instance. `store` is Durable Object storage (or a fake):
 * get(key) → value, get(keys[]) → Map, put({key: value}), delete(keys[]).
 *
 * Durable Objects hold other requests back while a storage call is in flight
 * but NOT while WebCrypto runs, so every check that guards a write is made
 * after the last crypto await, right before the write.
 */
export class Accounts {
  constructor(store, crypto) {
    this.store = store;
    this.crypto = crypto;
    /** room → {n, t}: players per channel as the rooms last reported. */
    this.counts = new Map();
    /** pid → JSON of the last summary written, so saves rewrite it only on change. */
    this.sums = new Map();
    this.dummySalt = null;
  }

  async signup({ id, pw, legacy, ip }, now) {
    const uid = normId(id);
    if (!uid) return { ok: false, error: MSG.badId };
    const why = pwProblem(pw);
    if (why) return { ok: false, error: why };
    const sk = K.signupIp(ipBucket(ip));
    const quota = await this.store.get(sk);
    const used = quota && now - quota.t < THROTTLE.signup.window ? quota.n : 0;
    if (used >= THROTTLE.signup.limit) return { ok: false, error: MSG.signups };
    if (await this.store.get(K.acc(uid))) return { ok: false, error: MSG.taken };

    const salt = this.crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(this.crypto, pw, salt);
    const token = newToken(this.crypto);
    const tk = await tokenKey(this.crypto, token);

    // No awaits but storage from here on: nothing can slip in between check and write.
    const [acc0, quota1] = await Promise.all([this.store.get(K.acc(uid)), this.store.get(sk)]);
    if (acc0) return { ok: false, error: MSG.taken };
    const puts = {
      [K.acc(uid)]: { id: uid, salt: hex(salt), hash, iter: PBKDF2_ITER, t: now, sess: [tk] },
      [K.sess(tk)]: { id: uid, exp: now + SESSION_MS },
      [sk]: { n: (quota1 && now - quota1.t < THROTTLE.signup.window ? quota1.n : 0) + 1, t: quota1 && now - quota1.t < THROTTLE.signup.window ? quota1.t : now },
    };
    const dels = [];
    let adopted = false;
    if (validLegacy(legacy)) {
      const old = await this.store.get(K.char(legacy));
      const pid = pidFor(uid, "s1");
      if (old && old.char && !(await this.store.get(K.char(pid)))) {
        puts[K.char(pid)] = { char: old.char };
        const sum = summary(old.char);
        puts[K.sum(pid)] = sum;
        if (old.char.name) puts[K.name("s1", old.char.name)] = pid;
        dels.push(K.char(legacy));
        adopted = true;
      }
    }
    await this.store.put(puts);
    if (dels.length) await this.store.delete(dels);
    return adopted ? { ok: true, token, id: uid, adopted: true } : { ok: true, token, id: uid };
  }

  async login({ id, pw, ip }, now) {
    const uid = normId(id);
    if (!uid || typeof pw !== "string" || !pw || pw.length > PW_MAX) return { ok: false, error: MSG.wrong };
    const fk = K.failId(uid);
    const pk = K.failIp(ipBucket(ip));
    const got = await this.store.get([fk, pk, K.acc(uid)]);
    const wait = Math.max(lockLeft(got.get(fk), now), lockLeft(got.get(pk), now));
    if (wait) return { ok: false, error: MSG.locked(Math.ceil(wait / 1000)), retry: Math.ceil(wait / 1000) };

    const acc = got.get(K.acc(uid));
    // Unknown ids cost the same hash as known ones, so timing does not tell them apart.
    if (!this.dummySalt) this.dummySalt = this.crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(this.crypto, pw, acc ? fromHex(acc.salt) : this.dummySalt, acc ? acc.iter : PBKDF2_ITER);
    const good = safeEqual(hash, acc ? acc.hash : "0".repeat(64)) && !!acc;

    if (!good) {
      const now2 = await this.store.get([fk, pk]);
      await this.store.put({ [fk]: failed(now2.get(fk), now, THROTTLE.id), [pk]: failed(now2.get(pk), now, THROTTLE.ip) });
      return { ok: false, error: MSG.wrong };
    }
    const token = newToken(this.crypto);
    const tk = await tokenKey(this.crypto, token);
    const cur = (await this.store.get(K.acc(uid))) ?? acc;
    const list = [...(cur.sess ?? []).filter((k) => k !== tk), tk];
    const drop = list.splice(0, Math.max(0, list.length - SESSIONS_PER_ACCOUNT));
    await this.store.put({ [K.acc(uid)]: { ...cur, sess: list }, [K.sess(tk)]: { id: uid, exp: now + SESSION_MS } });
    await this.store.delete([fk, ...drop.map(K.sess)]);
    return { ok: true, token, id: uid };
  }

  async logout({ token }) {
    if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: true };
    const tk = await tokenKey(this.crypto, token);
    const s = await this.store.get(K.sess(tk));
    if (s) {
      const acc = await this.store.get(K.acc(s.id));
      if (acc) await this.store.put({ [K.acc(s.id)]: { ...acc, sess: (acc.sess ?? []).filter((k) => k !== tk) } });
      await this.store.delete([K.sess(tk)]);
    }
    return { ok: true };
  }

  /** The account a token belongs to: {ok, id} or {ok:false, expired:true}. Slides the expiry. */
  async auth(token, now) {
    const dead = { ok: false, expired: true, error: MSG.expired };
    if (typeof token !== "string" || !TOKEN_RE.test(token)) return dead;
    const tk = await tokenKey(this.crypto, token);
    const s = await this.store.get(K.sess(tk));
    if (!s) return dead;
    if (s.exp <= now) {
      await this.store.delete([K.sess(tk)]);
      return dead;
    }
    if (s.exp - now < SESSION_MS - SESSION_SLIDE_MS) await this.store.put({ [K.sess(tk)]: { id: s.id, exp: now + SESSION_MS } });
    return { ok: true, id: s.id };
  }

  async me({ token }, now) {
    const a = await this.auth(token, now);
    if (!a.ok) return a;
    const chars = {};
    const keys = SERVERS.map((s) => K.sum(pidFor(a.id, s.id)));
    const got = await this.store.get(keys);
    for (const s of SERVERS) chars[s.id] = got.get(K.sum(pidFor(a.id, s.id))) ?? null;
    return { ok: true, id: a.id, chars };
  }

  /** A room's head count (best effort, kept in memory only). */
  report(room, n, now) {
    if (serverOf(room) && Number.isFinite(n)) this.counts.set(room, { n: Math.max(0, Math.floor(n)), t: now });
  }
  servers(now) {
    return {
      servers: SERVERS.map((s) => ({
        id: s.id,
        name: s.name,
        channels: s.channels.map((c) => {
          const r = this.counts.get(c.id);
          return { id: c.id, name: c.name, n: r && now - r.t < COUNT_TTL_MS ? r.n : 0 };
        }),
      })),
    };
  }

  /** Summary rows to write alongside a character save: only those that changed. */
  summaryPuts(list) {
    const puts = {};
    for (const { pid, char } of list) {
      if (!splitPid(pid)) continue;
      const sum = summary(char);
      const j = JSON.stringify(sum);
      if (this.sums.get(pid) === j) continue;
      this.sums.set(pid, j);
      puts[K.sum(pid)] = sum;
    }
    return puts;
  }
}
