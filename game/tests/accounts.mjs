// Accounts, sessions, throttling, per-server keys and legacy adoption — the
// pure half of the vault (src/accounts.js) against a Map-backed fake of
// Durable Object storage: node tests/accounts.mjs
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import * as A from "../src/accounts.js";
import * as L from "../src/logic.js";

/** Durable Object storage as the account service uses it (values are cloned, like structured clone). */
class FakeStore {
  constructor() { this.m = new Map(); }
  async get(k) {
    if (Array.isArray(k)) { const out = new Map(); for (const x of k) if (this.m.has(x)) out.set(x, structuredClone(this.m.get(x))); return out; }
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === "string") { this.m.set(k, structuredClone(v)); return; }
    for (const [x, y] of Object.entries(k)) this.m.set(x, structuredClone(y));
  }
  async delete(k) { let n = 0; for (const x of [].concat(k)) n += this.m.delete(x) ? 1 : 0; return n; }
}

const store = new FakeStore();
const acc = new A.Accounts(store, webcrypto);
let now = 1_800_000_000_000;
const IP = "203.0.113.7";

// ── validation helpers
assert.equal(A.normId("  Bunny_01 "), "bunny_01");
for (const bad of ["abc", "a".repeat(17), "토끼토끼", "has space", "dash-ed", "", 12345, null]) assert.equal(A.normId(bad), null, `id ${bad}`);
assert.equal(A.pwProblem("12345"), "비밀번호는 6자 이상입니다");
assert.equal(A.pwProblem("123456"), "");
assert.equal(A.pwProblem("x".repeat(65)), "비밀번호가 너무 깁니다");
assert.equal(A.serverOf("s1-ch2"), "s1");
assert.equal(A.serverOf("s2-ch1"), "s2");
for (const bad of ["main", "ch1", "s3-ch1", "s1-ch3", "vault:characters", ""]) assert.equal(A.serverOf(bad), null, bad);
assert.deepEqual(A.CHANNELS, ["s1-ch1", "s1-ch2", "s2-ch1", "s2-ch2"]);
assert.deepEqual(A.splitPid("bunny@s2"), { id: "bunny", server: "s2" });
assert.equal(A.splitPid("x7k2m9q1p0abcdefgh"), null, "old anonymous pids are not account pids");
assert.equal(A.ipBucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), A.ipBucket("2001:db8:1:2:1:1:1:1"), "one IPv6 /64 = one bucket");
assert.notEqual(A.ipBucket("198.51.100.1"), A.ipBucket("198.51.100.2"));
assert.ok(A.safeEqual("abcd", "abcd"));
assert.ok(!A.safeEqual("abcd", "abce"));
assert.ok(!A.safeEqual("abcd", "abc"));

// ── the client contract matches (public/account.js keeps its own copy of the lists)
const client = await import("../public/account.js");
{
  assert.deepEqual(client.SERVERS, A.SERVERS, "server list differs between client and server");
  assert.equal(String(client.ID_RE), String(A.ID_RE));
  assert.equal(client.PW_MIN, A.PW_MIN);
}

// ── keys: s1 keeps the pre-account keys, s2 gets ones no old key can equal
assert.equal(A.K.name("s1", "토끼"), "n:토끼");
assert.equal(A.K.name("s2", "토끼"), "n:s2:토끼");
assert.equal(A.K.guild("s1", "Moon"), "g:moon");
assert.equal(A.K.guild("s2", "Moon"), "g:s2:moon");
assert.equal(A.K.rank("s1"), "rank");
assert.equal(A.K.rank("s2"), "rank:s2");
assert.ok(!L.validName("s2:토끼"), "a character name can never contain ':'");

// ── body parsing (what the worker forwards)
assert.deepEqual(A.parseApiBody("login", JSON.stringify({ id: "bunny", pw: "secret1", extra: { x: 1 } })), { ok: true, body: { id: "bunny", pw: "secret1" } });
assert.equal(A.parseApiBody("login", "{oops").ok, false);
assert.equal(A.parseApiBody("login", "[1]").ok, false);
assert.equal(A.parseApiBody("login", JSON.stringify({ id: 5, pw: "x" })).ok, false);
assert.equal(A.parseApiBody("me", JSON.stringify({ token: "a".repeat(500) })).ok, false);
assert.equal(A.parseApiBody("signup", "x".repeat(A.MAX_BODY_BYTES + 1)).ok, false);
assert.equal(A.parseApiBody("nuke", "{}").ok, false);

// ── a legacy (pre-account) character sitting in the vault
const LEGACY = "x7k2m9q1p0abcdefgh1234";
// (saved in the four-class days: a class, the old level scale, no job)
const oldChar = L.newChar("옛토끼", [1, 2, 3]);
delete oldChar.job; oldChar.cls = "rogue";
oldChar.lvl = 9;
await store.put({ [`c:${LEGACY}`]: { char: oldChar, sess: { room: "ch1", t: now - 3600_000 } }, "n:옛토끼": LEGACY });

// ── sign-up
let r = await acc.signup({ id: "Bunny", pw: "carrot99", legacy: LEGACY, ip: IP }, now);
assert.equal(r.ok, true, r.error);
assert.equal(r.id, "bunny");
assert.match(r.token, A.TOKEN_RE);
assert.equal(r.adopted, true, "the old character is adopted");
const tokenA = r.token;
const rec = store.m.get("a:bunny");
assert.equal(rec.iter, 100_000);
assert.equal(rec.salt.length, 32, "16-byte salt");
assert.ok(!JSON.stringify([...store.m]).includes("carrot99"), "the password is never stored");
assert.ok(!JSON.stringify([...store.m]).includes(tokenA), "the token is never stored, only its hash");
assert.ok(!store.m.has(`c:${LEGACY}`), "the old key is gone");
assert.equal(store.m.get("c:bunny@s1").char.name, "옛토끼");
assert.equal(store.m.get("c:bunny@s1").sess, undefined, "adopted character is not locked to an old channel");
assert.equal(store.m.get("n:옛토끼"), "bunny@s1", "the name claim follows the character");

r = await acc.signup({ id: "bunny", pw: "another1", ip: IP }, now);
assert.deepEqual([r.ok, r.error], [false, "이미 사용 중인 아이디입니다"]);
r = await acc.signup({ id: "BUNNY", pw: "another1", ip: IP }, now);
assert.equal(r.ok, false, "ids are case-insensitive");
r = await acc.signup({ id: "bun", pw: "another1", ip: IP }, now);
assert.equal(r.ok, false);
r = await acc.signup({ id: "fox_two", pw: "12345", ip: IP }, now);
assert.equal(r.ok, false);

// The same legacy pid cannot be adopted twice.
r = await acc.signup({ id: "thief", pw: "steal123", legacy: LEGACY, ip: "198.51.100.9" }, now);
assert.equal(r.ok, true);
assert.equal(r.adopted, undefined);
assert.equal(store.m.get("c:thief@s1"), undefined);
// Junk legacy values are ignored, not errors.
r = await acc.signup({ id: "junkpid", pw: "junk1234", legacy: "c:bunny@s1", ip: "198.51.100.9" }, now);
assert.equal(r.ok, true);
assert.equal(r.adopted, undefined);

// ── /me
r = await acc.me({ token: tokenA }, now);
assert.equal(r.ok, true);
assert.equal(r.id, "bunny");
assert.deepEqual(r.chars.s1, { name: "옛토끼", cls: "rogue", lvl: 9, look: oldChar.look });
assert.equal(r.chars.s2, null);
r = await acc.me({ token: "f".repeat(64) }, now);
assert.deepEqual([r.ok, r.expired], [false, true]);
r = await acc.me({ token: "nonsense" }, now);
assert.deepEqual([r.ok, r.expired], [false, true]);

// ── login, wrong password, lockout
r = await acc.login({ id: "bunny", pw: "carrot99", ip: IP }, now);
assert.equal(r.ok, true);
const tokenB = r.token;
assert.notEqual(tokenB, tokenA);
for (let i = 0; i < 4; i++) {
  r = await acc.login({ id: "bunny", pw: "wrong-" + i, ip: IP }, now + i);
  assert.deepEqual([r.ok, r.error], [false, "아이디 또는 비밀번호가 올바르지 않습니다"]);
}
r = await acc.login({ id: "nobody_here", pw: "whatever", ip: IP }, now);
assert.deepEqual([r.ok, r.error], [false, "아이디 또는 비밀번호가 올바르지 않습니다"], "unknown ids answer like wrong passwords");
r = await acc.login({ id: "bunny", pw: "wrong-5", ip: IP }, now + 10);
assert.equal(r.ok, false);
r = await acc.login({ id: "bunny", pw: "carrot99", ip: IP }, now + 20);
assert.equal(r.ok, false, "5 failures lock the id, even with the right password");
assert.match(r.error, /초 후에 다시 시도/);
assert.ok(r.retry > 50 && r.retry <= 60);
r = await acc.login({ id: "bunny", pw: "carrot99", ip: "192.0.2.50" }, now + 30);
assert.equal(r.ok, false, "the id lock holds from another address too");
r = await acc.login({ id: "bunny", pw: "carrot99", ip: IP }, now + 61_000);
assert.equal(r.ok, true, "after the lock the right password works");
assert.ok(!store.m.has("f:i:bunny"), "a good login clears the id's failure count");
// A second lock lasts longer.
for (let i = 0; i < 5; i++) await acc.login({ id: "bunny", pw: "nope" + i, ip: "192.0.2." + i }, now + 62_000);
r = await acc.login({ id: "bunny", pw: "carrot99", ip: IP }, now + 62_000 + 70_000);
assert.equal(r.ok, true, "first re-lock after a success starts again at 60 s");
// An address that keeps guessing different ids is locked as a whole.
for (let i = 0; i < 20; i++) await acc.login({ id: "guess" + String(i).padStart(2, "0"), pw: "123456", ip: "198.18.0.1" }, now + 200_000);
r = await acc.login({ id: "thief", pw: "steal123", ip: "198.18.0.1" }, now + 200_001);
assert.equal(r.ok, false, "20 failures from one address lock that address");
r = await acc.login({ id: "thief", pw: "steal123", ip: "198.18.0.2" }, now + 200_001);
assert.equal(r.ok, true, "other addresses are unaffected");

// ── sign-up quota per address
for (let i = 0; i < 10; i++) await acc.signup({ id: "spam" + String(i).padStart(2, "0"), pw: "spam1234", ip: "100.64.0.1" }, now);
r = await acc.signup({ id: "spam99", pw: "spam1234", ip: "100.64.0.1" }, now);
assert.equal(r.ok, false);
r = await acc.signup({ id: "spam99", pw: "spam1234", ip: "100.64.0.1" }, now + 3600_001);
assert.equal(r.ok, true, "the quota resets after an hour");

// ── sessions: sliding expiry, expiry, logout
let a = await acc.auth(tokenA, now + 2 * 24 * 3600_000);
assert.deepEqual(a, { ok: true, id: "bunny" });
a = await acc.auth(tokenA, now + 31 * 24 * 3600_000);
assert.equal(a.ok, true, "using a session pushes its expiry forward");
a = await acc.auth(tokenA, now + 62 * 24 * 3600_000);
assert.equal(a.ok, false, "30 days unused → expired");
assert.equal(a.expired, true);
r = await acc.login({ id: "bunny", pw: "carrot99", ip: IP }, now + 62 * 24 * 3600_000);
const tokenC = r.token;
assert.equal((await acc.me({ token: tokenC }, now + 62 * 24 * 3600_000)).ok, true);
assert.deepEqual(await acc.logout({ token: tokenC }), { ok: true });
r = await acc.me({ token: tokenC }, now + 62 * 24 * 3600_000);
assert.deepEqual([r.ok, r.expired], [false, true], "logout invalidates the token");
assert.deepEqual(await acc.logout({ token: "garbage" }), { ok: true });
// At most 10 live sessions per account; the oldest goes first.
const toks = [];
for (let i = 0; i < 12; i++) toks.push((await acc.login({ id: "thief", pw: "steal123", ip: "198.51.100.1" }, now + 300_000 + i)).token);
assert.equal(store.m.get("a:thief").sess.length, 10);
assert.equal((await acc.auth(toks[0], now + 300_100)).ok, false, "oldest session dropped");
assert.equal((await acc.auth(toks[11], now + 300_100)).ok, true);

// ── per-server characters and summaries
assert.equal(A.pidFor("bunny", "s1"), "bunny@s1");
const s2char = L.newChar("옛토끼", "mage", []);
let puts = acc.summaryPuts([{ pid: "bunny@s2", char: s2char }, { pid: LEGACY, char: oldChar }]);
assert.deepEqual(Object.keys(puts), ["m:bunny@s2"], "only account characters get summaries");
assert.deepEqual(acc.summaryPuts([{ pid: "bunny@s2", char: s2char }]), {}, "an unchanged summary is not rewritten");
s2char.lvl = 2;
assert.deepEqual(Object.keys(acc.summaryPuts([{ pid: "bunny@s2", char: s2char }])), ["m:bunny@s2"]);

// ── jobs: summaries and rank rows carry the job under `cls` and say `v: 2`; rows from before are read on the new scale
assert.deepEqual(A.summary(s2char), { name: "옛토끼", cls: "adventurer", lvl: 2, look: s2char.look, v: 2 });
const hero = L.hero("영웅", { wk: "spear", lvl: 77, job: "lancer" });
assert.deepEqual(A.rankRow(hero), { name: "영웅", cls: "lancer", lvl: 77, xp: hero.xpt, v: 2 });
assert.ok(hero.xpt > 0, "ranked ties break on the experience spent");
assert.deepEqual(A.fromOldRow({ name: "옛", cls: "mage", lvl: 20, xp: 999 }), { name: "옛", cls: "wizard", lvl: 77, xp: 0, v: 2 });
assert.deepEqual(A.fromOldRow({ name: "옛", cls: "warrior", lvl: 50, xp: 1 }).lvl, 197);
assert.equal(A.fromOldRow({ name: "옛", cls: "ranger", lvl: 3 }).cls, "lancer");
const fresh = A.rankRow(hero);
assert.equal(A.fromOldRow(fresh), fresh, "a new row is left alone");

// ── live channel counts
acc.report("s1-ch1", 3, now);
acc.report("s2-ch2", 7, now);
acc.report("main", 9, now);
let sv = acc.servers(now + 1000).servers;
assert.deepEqual(sv.map((s) => s.id), ["s1", "s2"]);
assert.deepEqual(sv.flatMap((s) => s.channels.map((c) => [c.id, c.n])), [["s1-ch1", 3], ["s1-ch2", 0], ["s2-ch1", 0], ["s2-ch2", 7]]);
sv = acc.servers(now + 60_000).servers;
assert.equal(sv[0].channels[0].n, 0, "stale counts fall back to 0");

console.log("accounts: ok");
