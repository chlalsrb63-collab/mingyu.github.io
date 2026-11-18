/**
 * Another player clicked (or tapped): a small menu beside them — 파티 초대 · 거래 제안 · 친구 추가 · 귓속말 · 따라가기 ·
 * 미니게임 ▸ (the games from defs.sx.games). An item that cannot apply is greyed with the reason as its tooltip (a tap
 * on it says the reason). Esc, a click elsewhere or the player walking off closes it.
 * - 파티 초대 `pinv`, 친구 추가 `fr add` (room.ts relays it to the vault), 귓속말 fills the chat box, 거래 and the games
 *   ask through `sx` (69-social-play.js, windows in sxwin.js).
 * - 따라가기: walks after them with ordinary steps (`G.path`, pathTo), re-aimed as they move; when they vanish beside a
 *   door it walks through the same door and looks for them on the other side. Stops on a move key or click, an
 *   attack, dash or auto-hunt, death, or when they are lost (a toast). `#follow-ind` shows it with [취소].
 */
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import * as Track from "./track.js";
import { G, $, el, dist, T, now } from "./state.js";
import { act } from "./net.js";
import { toast, chatTo } from "./windows.js";
import { show as hint } from "./hints.js";
import { pathTo, walkToDoor, toggleAuto } from "./input.js";

const box = () => $("#pmenu");
let menu = null;          // { eid, name }
let fo = null;            // following: { eid, name, path, end, on (map id), at, seen, last: [x, y] }

const sxd = () => (G.defs && G.defs.sx) || { games: [], tradeR: 5, gameR: 10 };
const who = (eid) => G.who.get(eid);
const busy = () => !!(G.sx && (G.sx.t || G.sx.g));

/** Why each item cannot be used now ("" when it can). */
function reasons(eid) {
  const o = G.players.get(eid), w = who(eid), name = w ? w.name : "";
  const far = (r) => !o || dist(G.me.x, G.me.y, o.x, o.y) > r * T;
  const mine = who(G.you), fr = G.friends || { f: [], o: [] };
  return {
    party: G.party.some((r) => r[0] === eid) ? "이미 같은 파티입니다"
      : w && w.party && (!mine || w.party !== mine.party) ? "이미 다른 파티에 속해 있습니다"
      : G.party.length >= ((G.defs && G.defs.partyMax) || 4) ? "파티가 가득 찼습니다" : "",
    trade: busy() ? "이미 거래나 미니게임 중입니다" : o && o.dead ? "쓰러진 상대와는 거래할 수 없습니다"
      : far(sxd().tradeR) ? `너무 멉니다 (${sxd().tradeR}칸 이내로 다가가세요)` : "",
    friend: fr.f.some((r) => r[0] === name) ? "이미 친구입니다" : (fr.o || []).includes(name) ? "이미 친구 신청을 보냈습니다" : "",
    whisper: "",
    follow: fo && fo.eid === eid ? "이미 따라가는 중입니다" : "",
    game: busy() ? "이미 거래나 미니게임 중입니다" : far(sxd().gameR) ? `너무 멉니다 (${sxd().gameR}칸 이내로 다가가세요)` : "",
  };
}

function item(label, why, run, extra) {
  const b = el("button", "pm-i" + (why ? " off" : ""), label);
  b.type = "button";
  if (why) b.title = why;
  b.addEventListener("pointerdown", (e) => e.stopPropagation());
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (why) { toast(why); Sound.play("no"); return; }
    run(b);
    Sound.play("ui");
  });
  if (extra) b.append(extra);
  return b;
}

/** Open the menu for player `eid`. */
export function open(eid) {
  const w = who(eid);
  if (!w || w.buddy) return;
  menu = { eid, name: w.name };
  render();
  hint("pmenu");   // the first time: what this menu does (hints.js)
}
export function close() {
  if (!menu) return;
  menu = null;
  box().hidden = true;
}
export const isOpen = () => !!menu;

function render() {
  const b = box(), { eid, name } = menu, why = reasons(eid);
  b.textContent = "";
  b.append(el("div", "pm-h", name));
  const done = (fn) => () => { fn(); close(); };
  b.append(
    item("파티 초대", why.party, done(() => act({ t: "pinv", e: eid }))),
    item("거래 제안", why.trade, done(() => act({ t: "sx", a: "ask", k: "trade", e: eid }))),
    item("친구 추가", why.friend, done(() => act({ t: "fr", a: "add", name }))),
    item("귓속말", why.whisper, done(() => chatTo(`/w ${name} `))),
    item("따라가기", why.follow, done(() => follow(eid))),
  );
  // 미니게임 ▸: a list, so more games slot in from defs.sx.games
  const sub = el("div", "pm-sub");
  sub.hidden = true;
  for (const [k, label] of sxd().games) sub.append(item(label, why.game, done(() => act({ t: "sx", a: "ask", k, e: eid }))));
  const mg = item("미니게임 ▸", "", () => { sub.hidden = !sub.hidden; });
  b.append(mg, sub);
  b.hidden = false;
  place();
}
/** Beside the player (kept on screen). */
function place() {
  const o = menu && G.players.get(menu.eid), b = box();
  if (!o) return;
  const [x, y] = S3.project(o.x, o.y, 0);
  const w = b.offsetWidth, h = b.offsetHeight;
  b.style.left = `${Math.round(Math.max(4, Math.min(innerWidth - w - 4, x + 14)))}px`;
  b.style.top = `${Math.round(Math.max(4, Math.min(innerHeight - h - 4, y - 44)))}px`;
}

/**
 * A pointer down on the world: a player under it opens the menu (and is not a walk or a blow); any other press
 * first closes an open menu. True when the press was used here.
 */
export function onWorldDown(e) {
  const o = S3.pickPlayer(e.clientX, e.clientY);
  if (o && !who(o.id)?.buddy) { open(o.id); Sound.play("tab"); return true; }
  if (menu) { close(); return true; }
  return false;
}
/** Esc closes the menu. */
export function onKey(e) {
  if (menu && e.key === "Escape") { close(); return true; }
  return false;
}

// ───────────────────────────── 따라가기 ─────────────────────────────

export const following = () => !!fo;
function show() {
  $("#follow-ind").hidden = !fo;
  if (fo) $("#follow-name").textContent = `따라가는 중 · ${fo.name}`;
}
export function follow(eid) {
  const o = G.players.get(eid), w = who(eid);
  if (!o || !w || G.me.dead) return;
  Track.stop();
  if (G.auto) toggleAuto();
  fo = { eid, name: w.name, path: null, end: null, on: G.map.id, at: now(), seen: now(), last: [o.x, o.y], re: 0 };
  show();
  toast(`${w.name}님을 따라갑니다 (움직이면 멈춥니다)`);
}
export function stopFollow(why) {
  if (!fo) return;
  if (G.path === fo.path) G.path = null;
  fo = null;
  show();
  if (why) toast(why);
}
function go(path) {
  G.path = path; fo.path = path; fo.end = path ? path.at(-1) : null;
}
/** Each frame (client.js): keep after the target; close the menu when its player is gone. */
export function tick(t) {
  if (menu) { if (!G.players.has(menu.eid)) close(); else place(); }
  if (!fo) return;
  if (!G.playing || !G.map || G.me.dead) { stopFollow(G.me.dead ? "쓰러져서 따라가기를 멈췄습니다" : null); return; }
  if (G.map.id !== fo.on) { fo.on = G.map.id; fo.at = t; fo.path = fo.end = null; return; }   // through a door: look again
  if (fo.path && G.path !== fo.path) {
    // the route walked to its end (moveVector drops it): fine; anything else (a key, a click) breaks it off
    if (!(G.path === null && fo.end && dist(G.me.x, G.me.y, fo.end[0], fo.end[1]) < 20)) { stopFollow("따라가기를 취소했습니다"); return; }
    fo.path = null;
  }
  const o = G.players.get(fo.eid);
  if (o) {
    fo.seen = t; fo.last = [o.x, o.y];
    const d = dist(G.me.x, G.me.y, o.x, o.y);
    if (d <= 22) { if (fo.path) { G.path = null; fo.path = null; } return; }
    if (!fo.path || t - fo.re > 500) { fo.re = t; const p = pathTo(o.x, o.y); if (p) go(p); }
    return;
  }
  // out of sight since coming through a door: give the new map a moment, then give up
  if (fo.at > fo.seen) { if (t - fo.at > 2500) stopFollow(`${fo.name}님을 놓쳤습니다`); return; }
  if (fo.path) return;
  // vanished beside a door on this map: through the same door
  const [lx, ly] = fo.last;
  const door = G.map.portals.find((p) => dist(p.x * T + 8, p.y * T + 8, lx, ly) < 2.5 * T);
  if (door && t - fo.seen < 4000) {
    const tx = Math.floor(G.me.x / T), ty = Math.floor((G.me.y - 2) / T);
    if (tx === door.x && ty === door.y) return;            // standing on it: the map change is on its way
    if (walkToDoor([[door.x, door.y]])) { fo.path = G.path; fo.end = G.path.at(-1); return; }
  }
  // walk to where they were last seen, then give up
  if (dist(G.me.x, G.me.y, lx, ly) > 24 && t - fo.seen < 4000) { const p = pathTo(lx, ly); if (p) { go(p); return; } }
  stopFollow(`${fo.name}님을 놓쳤습니다`);
}
export function setup() {
  $("#follow-x").addEventListener("click", () => stopFollow("따라가기를 취소했습니다"));
  addEventListener("pointerdown", (e) => { if (menu && !box().contains(e.target) && e.target.id !== "world" && !e.target.closest("#world")) close(); });
}
