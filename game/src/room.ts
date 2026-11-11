/**
 * `Room` — one game channel, as a Durable Object.
 *
 * A channel is a live copy of the whole world (`logic.js`): every map, monster
 * and player in it. The room owns the sockets and the clock; `logic.js` owns
 * every game decision.
 *
 * ── HOW TIME PASSES ─────────────────────────────────────────────────────
 * While at least one player is connected the room re-arms an alarm every
 * `TICK_MS`. Each alarm advances the world (`logic.tick`) and sends every
 * player their own snapshot (`logic.viewFor`). With nobody connected the alarm
 * is dropped and the room goes back to costing nothing.
 *
 * ── WHERE STATE LIVES ───────────────────────────────────────────────────
 * The world is held in memory: it changes ten times a second and none of it
 * (monster positions, loot on the floor) is worth a storage write. What must
 * survive — the characters — is saved to the VAULT: one extra instance of this
 * same class, addressed by a name no URL can produce (`VAULT_NAME`), so that a
 * character is the same in every channel. If the room is evicted and revived,
 * the world is rebuilt and every still-open socket is put back in from the
 * vault; identity rides on the socket attachment for exactly that reason.
 *
 * ── WIRE PROTOCOL ───────────────────────────────────────────────────────
 *   in:  {type:"join", playerId} · {type:"action", action:{t, …}}
 *   out: {type:"need_char"} · {type:"welcome", you, defs, room}
 *        {type:"snap", …} · {type:"rank", list} · {type:"error", error}
 */

import { DurableObject } from "cloudflare:workers";

import type { Env } from "./env";
import * as logic from "./logic.js";
import type { Char, World } from "./logic.js";
import { parseClientMessage } from "./protocol";

const TICK_MS = 100;
const SAVE_MS = 15_000;
/** A character counts as "in another channel" until its lock is this stale. */
const LOCK_MS = 40_000;
const RANK_SIZE = 20;

/** Contains ":" — the Worker only routes `[A-Za-z0-9_-]` names, so players can never open it. */
export const VAULT_NAME = "vault:characters";
const VAULT_PATH = "/__vault/";

const PING = "__ping";
const PONG = "__pong";

/** Rides on each socket so it survives the room being evicted from memory. */
interface Attachment {
  connId: string;
  /** The player's private id (their claim to a character). Never sent to others. */
  pid?: string;
  /** True once the character is in the world. */
  live?: boolean;
}

interface VaultRecord {
  char: Char;
  sess?: { room: string; t: number };
}
interface RankRow {
  name: string;
  cls: string;
  lvl: number;
  xp: number;
}

type VaultReply = { ok: true; char?: Char | null; list?: RankRow[] } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export class Room extends DurableObject<Env> {
  /** The live world. Null until the first player arrives (or after an eviction). */
  private world: World | null = null;
  private reviving: Promise<void> | null = null;
  private roomName = "";
  private lastSave = 0;
  private nextTick = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  // ── entry ──────────────────────────────────────────────────────────────

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(VAULT_PATH)) return this.vault(url.pathname.slice(VAULT_PATH.length), request);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a websocket upgrade", { status: 426 });
    }
    const name = url.pathname.split("/").filter(Boolean).pop() ?? "main";
    if (this.roomName !== name) {
      this.roomName = name;
      await this.ctx.storage.put("name", name);
    }
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    this.attach(server, { connId: crypto.randomUUID().slice(0, 8) });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private att(ws: WebSocket): Attachment | null {
    return ws.deserializeAttachment() as Attachment | null;
  }
  private attach(ws: WebSocket, att: Attachment): void {
    ws.serializeAttachment(att);
  }
  private send(ws: WebSocket, data: unknown): void {
    try {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
    } catch {
      /* socket already gone; its close handler cleans up */
    }
  }

  // ── world lifecycle ────────────────────────────────────────────────────

  /**
   * Make sure the world exists. After an eviction this rebuilds it and puts
   * every still-connected player back in from their last save.
   */
  private async ready(): Promise<World> {
    if (this.reviving) await this.reviving;
    if (this.world) return this.world;
    const world = logic.setup();
    world.seed = (Date.now() & 0x7fffffff) | 1;
    world.now = Date.now();
    this.world = world;
    this.lastSave = Date.now();
    const orphans = this.ctx.getWebSockets().filter((ws) => this.att(ws)?.live);
    if (orphans.length) {
      this.reviving = (async () => {
        if (!this.roomName) this.roomName = (await this.ctx.storage.get<string>("name")) ?? "main";
        for (const ws of orphans) {
          const att = this.att(ws);
          if (!att?.pid) continue;
          const res = await this.callVault("load", { pid: att.pid, room: this.roomName });
          if (res.ok && res.char) this.enter(ws, att, res.char);
          else ws.close(4001, "session lost");
        }
      })();
      try {
        await this.reviving;
      } finally {
        this.reviving = null;
      }
    }
    return world;
  }

  private enter(ws: WebSocket, att: Attachment, char: Char): void {
    const world = this.world;
    if (!world || !att.pid) return;
    world.now = Date.now();
    const you = logic.addPlayer(world, att.pid, char);
    this.attach(ws, { connId: att.connId, pid: att.pid, live: true });
    this.send(ws, { type: "welcome", you, defs: logic.defs(), room: this.roomName, max: logic.meta.maxPlayers });
  }

  private async startClock(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      this.nextTick = Date.now() + TICK_MS;
      await this.ctx.storage.setAlarm(this.nextTick);
    }
  }

  // ── messages ───────────────────────────────────────────────────────────

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = this.att(ws);
    if (!att) return;
    try {
      await this.onMessage(ws, att, raw);
    } catch (err) {
      console.error("room message failed:", err instanceof Error ? err.stack : String(err));
      this.send(ws, { type: "error", error: "서버 오류가 발생했습니다" });
    }
  }

  private async onMessage(ws: WebSocket, att: Attachment, raw: string | ArrayBuffer): Promise<void> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return this.send(ws, { type: "error", error: parsed.error });
    const msg = parsed.msg;
    if (msg.type === "reset") return;

    if (msg.type === "join") {
      if (att.live) return;
      const pid = msg.playerId;
      if (pid.length < 8) return this.send(ws, { type: "error", error: "잘못된 접속 정보입니다" });
      const world = await this.ready();
      // One character, one connection: a second tab takes over from the first.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && this.att(other)?.pid === pid) await this.leave(other, "다른 곳에서 접속했습니다");
      }
      if (logic.playerCount(world) >= logic.meta.maxPlayers) {
        this.send(ws, { type: "error", error: "채널이 가득 찼습니다. 다른 채널을 이용해 주세요.", fatal: true });
        return;
      }
      att = { connId: att.connId, pid };
      this.attach(ws, att);
      const res = await this.callVault("load", { pid, room: this.roomName });
      if (!res.ok) return this.send(ws, { type: "error", error: res.error, fatal: true });
      if (!res.char) return this.send(ws, { type: "need_char" });
      this.enter(ws, att, res.char);
      await this.startClock();
      return;
    }

    // msg.type === "action"
    const pid = att.pid;
    if (!pid) return this.send(ws, { type: "error", error: "join first" });
    const action = msg.action;
    const kind = isRecord(action) ? action.t : undefined;

    if (kind === "rank") {
      const res = await this.callVault("rank", {});
      return this.send(ws, { type: "rank", list: res.ok ? (res.list ?? []) : [] });
    }

    if (!att.live) {
      // The only thing a character-less connection may do is create one.
      if (kind !== "create" || !isRecord(action)) return this.send(ws, { type: "need_char" });
      if (!logic.validName(action.name)) {
        return this.send(ws, { type: "error", error: "이름은 한글·영문·숫자 2~10자로 지어 주세요" });
      }
      const char = logic.newChar(String(action.name), action.cls, action.look);
      const res = await this.callVault("create", { pid, room: this.roomName, char });
      if (!res.ok) return this.send(ws, { type: "error", error: res.error });
      await this.ready();
      // The awaits above let other frames in; don't enter the same socket twice.
      if (this.att(ws)?.live) return;
      this.enter(ws, att, char);
      await this.startClock();
      return;
    }

    const world = await this.ready();
    world.now = Date.now();
    const verdict = logic.validateAction(world, pid, action);
    if (!verdict.ok) {
      // Movement and attack spam fail silently; everything else tells the player why.
      if (kind !== "mv" && kind !== "atk") this.send(ws, { type: "error", error: verdict.error ?? "invalid action" });
      return;
    }
    logic.applyAction(world, pid, action);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws, null);
  }
  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws, null);
  }

  /** Take a connection out of the world and save its character. */
  private async leave(ws: WebSocket, kick: string | null): Promise<void> {
    const att = this.att(ws);
    if (kick) {
      this.send(ws, { type: "error", error: kick, fatal: true });
      try {
        ws.close(4000, "replaced");
      } catch {
        /* already closed */
      }
    }
    if (!att?.pid) return;
    this.attach(ws, { connId: att.connId });
    if (!att.live || !this.world) return;
    const char = logic.removePlayer(this.world, att.pid);
    if (char) {
      await this.callVault("save", { room: this.roomName, list: [{ pid: att.pid, char }], release: [att.pid] });
    }
  }

  // ── the clock ──────────────────────────────────────────────────────────

  override async alarm(): Promise<void> {
    try {
      const world = await this.ready();
      const now = Date.now();
      const live: Array<[WebSocket, string]> = [];
      for (const ws of this.ctx.getWebSockets()) {
        const att = this.att(ws);
        if (att?.live && att.pid) live.push([ws, att.pid]);
      }
      if (live.length === 0) {
        // Nobody home: stop the clock. The next join starts it again.
        this.world = null;
        return;
      }
      logic.tick(world, now);
      for (const [ws, pid] of live) {
        const view = logic.viewFor(world, pid);
        if (view) this.send(ws, view);
      }
      logic.endTick(world);

      if (now - this.lastSave >= SAVE_MS) {
        this.lastSave = now;
        const list: Array<{ pid: string; char: Char }> = [];
        for (const [, pid] of live) {
          const char = logic.exportChar(world, pid);
          if (char) list.push({ pid, char });
        }
        // Not awaited: a save must never stall the tick.
        this.ctx.waitUntil(this.callVault("save", { room: this.roomName, list, release: [] }));
      }

      // Hold a steady cadence even when a tick ran long.
      this.nextTick = Math.max(now + 20, this.nextTick + TICK_MS);
      if (this.nextTick > now + TICK_MS * 2) this.nextTick = now + TICK_MS;
      await this.ctx.storage.setAlarm(this.nextTick);
    } catch (err) {
      console.error("room tick failed:", err instanceof Error ? err.stack : String(err));
      await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
    }
  }

  // ── the vault (character storage shared by every channel) ──────────────

  private async callVault(op: string, body: unknown): Promise<VaultReply> {
    try {
      const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(VAULT_NAME));
      const res = await stub.fetch(`https://vault${VAULT_PATH}${op}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return (await res.json()) as VaultReply;
    } catch (err) {
      console.error("vault call failed:", err instanceof Error ? err.stack : String(err));
      return { ok: false, error: "캐릭터 저장소에 연결하지 못했습니다" };
    }
  }

  /** Runs only inside the vault instance; reachable solely through `callVault`. */
  private async vault(op: string, request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>;
    const store = this.ctx.storage;
    const now = Date.now();
    const reply = (r: VaultReply): Response => Response.json(r);
    const room = String(body.room ?? "");

    if (op === "load") {
      const key = `c:${String(body.pid)}`;
      const rec = await store.get<VaultRecord>(key);
      if (!rec) return reply({ ok: true, char: null });
      if (rec.sess && rec.sess.room !== room && now - rec.sess.t < LOCK_MS) {
        return reply({ ok: false, error: "이 캐릭터는 다른 채널에서 접속 중입니다. 잠시 후 다시 시도해 주세요." });
      }
      rec.sess = { room, t: now };
      await store.put(key, rec);
      return reply({ ok: true, char: rec.char });
    }

    if (op === "create") {
      const char = body.char as Char;
      const nameKey = `n:${char.name.toLowerCase()}`;
      const charKey = `c:${String(body.pid)}`;
      const [taken, mine] = await Promise.all([store.get<string>(nameKey), store.get<VaultRecord>(charKey)]);
      if (mine) return reply({ ok: false, error: "이미 캐릭터가 있습니다. 새로고침해 주세요." });
      if (taken) return reply({ ok: false, error: "이미 사용 중인 이름입니다" });
      await store.put({ [nameKey]: String(body.pid), [charKey]: { char, sess: { room, t: now } } });
      return reply({ ok: true });
    }

    if (op === "save") {
      const list = (body.list ?? []) as Array<{ pid: string; char: Char }>;
      const release = new Set((body.release ?? []) as string[]);
      if (!list.length) return reply({ ok: true });
      const keys = list.map((e) => `c:${e.pid}`);
      const [recs, rankNow] = await Promise.all([store.get<VaultRecord>(keys), store.get<RankRow[]>("rank")]);
      const puts: Record<string, unknown> = {};
      const rank = new Map((rankNow ?? []).map((r) => [r.name, r]));
      for (const { pid, char } of list) {
        const rec = recs.get(`c:${pid}`);
        // A save from a channel that no longer holds the lock is stale — drop it.
        if (!rec || (rec.sess && rec.sess.room !== room)) continue;
        const next: VaultRecord = { char };
        if (!release.has(pid)) next.sess = { room, t: now };
        puts[`c:${pid}`] = next;
        rank.set(char.name, { name: char.name, cls: char.cls, lvl: char.lvl, xp: char.xp });
      }
      puts.rank = [...rank.values()].sort((a, b) => b.lvl - a.lvl || b.xp - a.xp).slice(0, RANK_SIZE);
      await store.put(puts);
      return reply({ ok: true });
    }

    if (op === "rank") {
      return reply({ ok: true, list: (await store.get<RankRow[]>("rank")) ?? [] });
    }
    return reply({ ok: false, error: "unknown vault op" });
  }
}
