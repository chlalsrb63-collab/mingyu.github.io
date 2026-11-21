/**
 * The socket handle and the send side (split from net.js so windows and actions can talk to the
 * server without importing the snapshot decoder, which imports them): `ws channel act channelName`
 * and `entityPos`. Only net.js opens, swaps or closes the socket (`setSocket setChannel`).
 */
import * as Lobby from "./lobby.js";
import * as NpcLife from "./npclife.js";
import { G, T } from "./state.js";

/**
 * The channel: one of the two of a server ("s1-ch2"), chosen in the lobby
 * (lobby.js). The socket joins with the account's session token (account.js).
 */
export let ws = null;
export let channel = Lobby.lastChannel();
export function setSocket(s) { ws = s; }
export function setChannel(ch) { channel = ch; }

export function act(action) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
}
export const channelName = () => Lobby.label(channel);

export function entityPos(id) {
  if (id === G.you) return G.me;
  if (typeof id === "string" && id.startsWith("npc:")) {
    const key = id.slice(4), body = NpcLife.at(key);
    if (body) return { x: body.x, y: body.y, h3: 1.32 };
    if (NpcLife.cast(key)) return null;
    const post = G.map?.npcs.find((n) => n.id === key);
    return post ? { x: post.x * T + 8, y: post.y * T + 12, h3: 1.32 } : null;
  }
  return G.players.get(id) || G.mobs.get(id) || G.gone.get(id) || null;
}
