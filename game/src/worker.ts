/**
 * The Worker entry — everything that is not a static file lands here.
 *
 * Its whole job is routing a WebSocket upgrade to the right channel. Static
 * files (`dist/client`) are served by the platform BEFORE this runs.
 *
 * The `Room` re-export is required: a Durable Object class must be exported from
 * the Worker's entry module or the class does not ship and the deploy fails.
 */

import type { Env } from "./env";
import { Room } from "./room";

export { Room };

/** `/ws` and `/ws/<channel>` — the only server-side route the game has. */
const WS_PREFIX = "/ws";

/**
 * A channel name comes from the URL, so it is untrusted. Restricting it to a
 * short, boring label also guarantees nobody can address the character vault,
 * whose name contains a character this pattern refuses.
 */
const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_ROOM = "main";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === WS_PREFIX || url.pathname.startsWith(WS_PREFIX + "/")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected a websocket upgrade", { status: 426 });
      }
      const raw = url.pathname.slice(WS_PREFIX.length).replace(/^\/+/, "");
      const room = raw === "" ? DEFAULT_ROOM : raw;
      if (!ROOM_RE.test(room)) {
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
