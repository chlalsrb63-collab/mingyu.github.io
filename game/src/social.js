/**
 * Friends and presence — the vault's half of 친구 · 귓속말 (docs/design/social-weekly.md).
 *
 * Plain JavaScript with no platform calls, like accounts.js: `store` is Durable Object storage or the
 * Map-backed fake of the tests. It runs only inside the vault instance, so one object is the single
 * writer of every friend record: a request can be written to a player who is offline or in another
 * channel, which the rules (one world per channel, sheets in memory) could not do.
 *
 * ── STORAGE KEY (also listed in the accounts.js header) ─────────────────
 *   fr:<pid>   {f: {pid: name}, i: {pid: name}, o: {pid: name}}
 *              friends, requests received, requests sent — of one character (pid = <account>@<server>,
 *              so a list never crosses servers). A missing key is an empty list.
 * Names are resolved through the existing name claims (n:<name> / n:s2:<name>) and levels through the
 * existing summaries (m:<pid>); the block list is read from the character record (c:<pid>.char.blk).
 * No existing key changes shape.
 *
 * ── PRESENCE ────────────────────────────────────────────────────────────
 * Kept in memory only: every save a room sends (15 s, or sooner) says which characters it holds and on
 * which map; a release (the player left) clears it. After the vault is evicted the next save restores
 * it; until then `where` falls back to the lock a channel holds on the character record (c:<pid>.sess).
 */

import { K } from "./accounts.js";

export const FRIEND_MAX = 50;
/** Requests waiting on one character (received or sent) are capped too. */
export const PENDING_MAX = 30;
/** A room's word that a character is with it is trusted this long (rooms save every 15 s). */
export const PRESENCE_MS = 45_000;

export const KS = { friends: (pid) => `fr:${pid}` };

export const SMSG = {
  none: "그런 이름의 모험가가 없습니다",
  self: "자신에게는 보낼 수 없습니다",
  already: "이미 친구입니다",
  sent: "이미 요청을 보냈습니다",
  full: `친구는 ${FRIEND_MAX}명까지 둘 수 있습니다`,
  theirFull: "상대의 친구 목록이 가득 찼습니다",
  pending: "보낸 요청이 너무 많습니다. 답을 기다려 주세요",
  noReq: "받은 요청이 없습니다",
  notFriend: "친구가 아닙니다",
  away: "접속 중이 아닙니다",
  bad: "잘못된 요청입니다",
};

const low = (v) => String(v).toLowerCase();
const empty = () => ({ f: {}, i: {}, o: {} });
const size = (o) => Object.keys(o).length;
function clean(rec) {
  const ok = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  return rec && typeof rec === "object" ? { f: ok(rec.f), i: ok(rec.i), o: ok(rec.o) } : empty();
}
const serverOfPid = (pid) => String(pid).slice(String(pid).lastIndexOf("@") + 1);

export class Social {
  constructor(store) {
    this.store = store;
    /** pid → {room, map, t}: where the rooms last said a character was. */
    this.online = new Map();
  }

  // ── presence ─────────────────────────────────────────────────────────
  seen(pid, room, map, now) {
    this.online.set(String(pid), { room: String(room), map: typeof map === "string" ? map : "", t: now });
  }
  gone(pid) {
    this.online.delete(String(pid));
  }
  /** {room, map} while a room vouched for the character lately, else null. */
  at(pid, now) {
    const o = this.online.get(String(pid));
    if (!o) return null;
    if (now - o.t >= PRESENCE_MS) { this.online.delete(String(pid)); return null; }
    return o;
  }

  /** The pid and the name as it was claimed, of a character of this server; null when there is none. */
  async find(server, name) {
    const pid = await this.store.get(K.name(server, name));
    if (typeof pid !== "string") return null;
    const sum = await this.store.get(K.sum(pid));
    return { pid, name: sum && typeof sum.name === "string" ? sum.name : String(name) };
  }

  /**
   * Which channel holds the character of that name right now: {ok, pid, name, room} or {ok: false}.
   * `lockMs` is how long a channel's lock on a character record counts when presence is not known.
   */
  async where(server, name, now, lockMs = 40_000) {
    const who = await this.find(server, name);
    if (!who) return { ok: false, error: SMSG.none };
    const o = this.at(who.pid, now);
    if (o) return { ok: true, pid: who.pid, name: who.name, room: o.room };
    const rec = await this.store.get(K.char(who.pid));
    if (rec && rec.sess && now - rec.sess.t < lockMs) return { ok: true, pid: who.pid, name: who.name, room: rec.sess.room };
    return { ok: false, error: SMSG.away };
  }

  // ── friends ──────────────────────────────────────────────────────────
  async rec(pid) {
    return clean(await this.store.get(KS.friends(pid)));
  }

  /** The list as the client shows it: friends [name, lvl, job, room, map] (room "" = offline), requests in and out. */
  async list(pid, now) {
    const rec = await this.rec(pid);
    const pids = Object.keys(rec.f);
    const sums = pids.length ? await this.store.get(pids.map((p) => K.sum(p))) : new Map();
    const f = pids.map((p) => {
      const sum = sums.get(K.sum(p)), o = this.at(p, now);
      return [rec.f[p], sum ? Number(sum.lvl) || 1 : 1, sum && sum.v ? String(sum.cls) : "adventurer", o ? o.room : "", o ? o.map : ""];
    });
    // online first, then by name
    f.sort((a, b) => (b[3] ? 1 : 0) - (a[3] ? 1 : 0) || String(a[0]).localeCompare(String(b[0])));
    return { ok: true, f, i: Object.values(rec.i), o: Object.values(rec.o) };
  }

  /**
   * Ask `toName` to be friends. A request that crosses one already waiting the other way makes the two
   * friends at once. Someone who blocked the asker never sees it: the asker's side records it as sent
   * and nothing more happens. Replies {ok, msg, peer?: {pid, note}} — `peer` is whom the room should tell.
   */
  async request(pid, myName, toName, now) {
    const server = serverOfPid(pid);
    const who = await this.find(server, toName);
    if (!who) return { ok: false, error: SMSG.none };
    if (who.pid === pid) return { ok: false, error: SMSG.self };
    const [mine0, theirs0, target] = await Promise.all([this.store.get(KS.friends(pid)), this.store.get(KS.friends(who.pid)), this.store.get(K.char(who.pid))]);
    const mine = clean(mine0), theirs = clean(theirs0);
    if (mine.f[who.pid]) return { ok: false, error: SMSG.already };
    if (size(mine.f) >= FRIEND_MAX) return { ok: false, error: SMSG.full };
    if (mine.i[who.pid]) return this.accept(pid, myName, who, mine, theirs);
    if (mine.o[who.pid]) return { ok: false, error: SMSG.sent };
    if (size(mine.o) >= PENDING_MAX) return { ok: false, error: SMSG.pending };
    mine.o[who.pid] = who.name;
    const blk = target && target.char && Array.isArray(target.char.blk) ? target.char.blk : [];
    const dropped = blk.some((n) => low(n) === low(myName)) || size(theirs.i) >= PENDING_MAX;
    const puts = { [KS.friends(pid)]: mine };
    if (!dropped) { theirs.i[pid] = String(myName); puts[KS.friends(who.pid)] = theirs; }
    await this.store.put(puts);
    const out = { ok: true, msg: `${who.name}님에게 친구 요청을 보냈습니다.` };
    if (!dropped) out.peer = { pid: who.pid, note: `${myName}님이 친구 요청을 보냈습니다. (친구 창)` };
    return out;
  }

  async accept(pid, myName, who, mine, theirs) {
    if (size(mine.f) >= FRIEND_MAX) return { ok: false, error: SMSG.full };
    if (size(theirs.f) >= FRIEND_MAX) return { ok: false, error: SMSG.theirFull };
    delete mine.i[who.pid]; delete mine.o[who.pid];
    delete theirs.i[pid]; delete theirs.o[pid];
    mine.f[who.pid] = who.name;
    theirs.f[pid] = String(myName);
    await this.store.put({ [KS.friends(pid)]: mine, [KS.friends(who.pid)]: theirs });
    return { ok: true, msg: `${who.name}님과 친구가 되었습니다.`, peer: { pid: who.pid, note: `${myName}님과 친구가 되었습니다.` } };
  }

  /** Answer a request received from `name`: yes makes the two friends, no drops it without a word. */
  async answer(pid, myName, name, yes) {
    const who = await this.find(serverOfPid(pid), name);
    if (!who) return { ok: false, error: SMSG.none };
    const [mine0, theirs0] = await Promise.all([this.store.get(KS.friends(pid)), this.store.get(KS.friends(who.pid))]);
    const mine = clean(mine0), theirs = clean(theirs0);
    if (!mine.i[who.pid]) return { ok: false, error: SMSG.noReq };
    if (yes) return this.accept(pid, myName, who, mine, theirs);
    delete mine.i[who.pid];
    delete theirs.o[pid];
    await this.store.put({ [KS.friends(pid)]: mine, [KS.friends(who.pid)]: theirs });
    return { ok: true, msg: `${who.name}님의 요청을 거절했습니다.` };
  }

  /**
   * Cut every tie with `name`: the friendship and any request either way. `quiet` (a block) succeeds
   * even when there was nothing to cut; otherwise that is an error.
   */
  async remove(pid, name, quiet = false) {
    const who = await this.find(serverOfPid(pid), name);
    if (!who) return quiet ? { ok: true } : { ok: false, error: SMSG.none };
    const [mine0, theirs0] = await Promise.all([this.store.get(KS.friends(pid)), this.store.get(KS.friends(who.pid))]);
    const mine = clean(mine0), theirs = clean(theirs0);
    const had = !!(mine.f[who.pid] || mine.i[who.pid] || mine.o[who.pid] || theirs.f[pid] || theirs.i[pid] || theirs.o[pid]);
    if (!had) return quiet ? { ok: true } : { ok: false, error: SMSG.notFriend };
    const wasFriend = !!mine.f[who.pid];
    for (const k of ["f", "i", "o"]) { delete mine[k][who.pid]; delete theirs[k][pid]; }
    await this.store.put({ [KS.friends(pid)]: mine, [KS.friends(who.pid)]: theirs });
    const out = { ok: true, msg: wasFriend ? `${who.name}님을 친구 목록에서 지웠습니다.` : `${who.name}님과의 요청을 지웠습니다.` };
    // the other side's list changed: their window refreshes, but nobody is told who left
    if (wasFriend) out.peer = { pid: who.pid, note: "" };
    return out;
  }

  /** One entry for the room: `a` = list | add | ok | no | del | drop (a block). Always replies with the fresh list on success. */
  async op({ a, pid, me, name }, now) {
    if (typeof pid !== "string" || !pid.includes("@")) return { ok: false, error: SMSG.bad };
    let res;
    if (a === "list") res = { ok: true };
    else if (typeof name !== "string" || !name) return { ok: false, error: SMSG.bad };
    else if (a === "add") res = await this.request(pid, me, name, now);
    else if (a === "ok" || a === "no") res = await this.answer(pid, me, name, a === "ok");
    else if (a === "del") res = await this.remove(pid, name);
    else if (a === "drop") res = await this.remove(pid, name, true);
    else return { ok: false, error: SMSG.bad };
    if (!res.ok) return res;
    if (res.peer) { const o = this.at(res.peer.pid, now); res.peer.room = o ? o.room : ""; }
    return { ...res, list: await this.list(pid, now) };
  }
}
