/**
 * The Worker entry — everything that is not a static file lands here.
 *
 * It routes a WebSocket upgrade to the right channel and the account API
 * (/api/*) to the vault. Static files are served by the platform BEFORE this runs.
 *
 *   POST /api/signup {id, pw, legacy?} · /api/login {id, pw}
 *   POST /api/logout {token} · /api/me {token} · GET /api/servers
 *
 * The worker reads at most `MAX_BODY_BYTES`, keeps only the known string
 * fields (accounts.js `parseApiBody`) and forwards them, plus the caller's
 * address from CF-Connecting-IP for login throttling, to the vault's private
 * `api/<op>` path. No public URL reaches the vault directly: /ws/<room> only
 * forwards the four channel names, and a channel instance refuses vault paths.
 *
 * The `Room` re-export is required: a Durable Object class must be exported from
 * the Worker's entry module or the class does not ship and the deploy fails.
 */

import type { Env } from "./env";
import { CHANNELS, MAX_BODY_BYTES, parseApiBody } from "./accounts.js";
import { Room, VAULT_NAME, VAULT_PATH } from "./room";

export { Room };

/** `/ws/<channel>` — one of 1서버/2서버 × 채널 1/2 (accounts.js CHANNELS). */
const WS_PREFIX = "/ws";
const API_PREFIX = "/api/";
const POST_OPS = new Set(["signup", "login", "logout", "me"]);

/**
 * The API answers any origin (the game is also played from a static mirror).
 * That is safe because nothing rides on cookies: the session token is in the body.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}

async function api(request: Request, env: Env, op: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let body: Record<string, string> = {};
  if (op === "servers") {
    if (request.method !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
  } else if (POST_OPS.has(op)) {
    if (request.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: "request too large" }, 413);
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: "request too large" }, 413);
    const parsed = parseApiBody(op, text);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    body = parsed.body;
  } else {
    return json({ ok: false, error: "not found" }, 404);
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(VAULT_NAME));
    const res = await stub.fetch(`https://vault${VAULT_PATH}api/${op}`, {
      method: "POST",
      body: JSON.stringify({ ...body, ip }),
    });
    return json(await res.json());
  } catch (err) {
    console.error("api call failed:", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: "서버가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith(API_PREFIX)) return api(request, env, url.pathname.slice(API_PREFIX.length));

    if (url.pathname === WS_PREFIX || url.pathname.startsWith(WS_PREFIX + "/")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected a websocket upgrade", { status: 426 });
      }
      const room = url.pathname.slice(WS_PREFIX.length).replace(/^\/+/, "");
      if (!CHANNELS.includes(room)) {
        return new Response("invalid room name", { status: 400 });
      }
      const id = env.ROOMS.idFromName(room);
      return env.ROOMS.get(id).fetch(request);
    }

    if (request.method === "GET" && request.headers.get("Accept")?.includes("text/html")) {
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
