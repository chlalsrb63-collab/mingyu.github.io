/**
 * 쉼표 수첩 in the browser (rules: src/logic/69-rest.js; plan docs/design/safezone-healing-2026-11-20.md).
 * Two calm things on the four safe maps:
 *   · 쉬어가기 — a little signpost stands at each resting spot (defs.rest.spots). F beside one sits you down (the `sit`
 *     action); the server stamps it after defs.rest.sitSec seconds and says so with `["rs", eid, spot]`. The bar over the
 *     post is this page's own count of that time (the server's is the one that matters).
 *   · 산책 줍기 — today's keepsakes on this map come on `self.rest[6]` as tiles; one twinkles until you walk up to it,
 *     and then this page asks for it (`rest {a:"pick", i}`).
 * self.rest = [stamps today (bits), finds today (bits), the book (bits), finds ever, 여유 ms left, 여유 %, finds here | 0]
 * The 쉼표 수첩 window (#w-rest, the phone's app) lists it all.
 */
import { Sound } from "./audio.js";
import * as S3 from "./scene2d.js";
import { G, T, $, el, dist, now } from "./state.js";
import { act, entityPos } from "./wire.js";

const INK = "#2b2233";
const FIND_COL = { town: "#ffd84a", willow: "#6adf6a", sunset_beach: "#ffc0d8", blossom_trail: "#ff9ac8" };
const st = { hooked: false, sent: 0, sitAt: 0, k: -1, map: "" };

const D = () => G.defs && G.defs.rest;
const R = () => (G.self && G.self.rest) || null;
const here = () => (G.map && G.map.id) || "";
const xy = (tx, ty) => [tx * T + 8, ty * T + 8];
const bits = (v) => { let n = 0; for (; v; v &= v - 1) n++; return n; };

/** The resting spot on this map within reach, as its index in defs.rest.spots, or -1. */
function nearSpot() {
  const d = D();
  if (!d || !G.me || G.me.dead) return -1;
  for (let i = 0; i < d.spots.length; i++) {
    const s = d.spots[i];
    if (s[0] === here() && dist(G.me.x, G.me.y, ...xy(s[1], s[2])) <= d.reach - 4) return i;
  }
  return -1;
}
/** The spot in reach that has no stamp today, or -1. */
function openSpot() { const i = nearSpot(), r = R(); return i >= 0 && r && !(r[0] & (1 << i)) ? i : -1; }

/** The F prompt beside a spot with no stamp today, else "" (update.js; a villager in reach comes first). */
export function label() {
  const i = openSpot();
  if (i < 0) return "";
  return G.me.sit ? `${D().spots[i][3]} — 쉬는 중…` : `${D().spots[i][3]}에서 쉬어가기`;
}
/** F: sit down at the spot in reach (true), else false (actions.js goes on). */
export function interact() {
  if (openSpot() < 0 || G.me.sit || G.near) return false;
  if (now() - st.sent > 500) { st.sent = now(); act({ t: "sit" }); }
  return true;
}
/** `["rs", eid, spot]`: a stamp landed. True when handled. */
export function onEvent(e) {
  if (e[0] !== "rs") return false;
  const d = D(), s = d && d.spots[e[2]], mine = e[1] === G.you;
  if (s && s[0] === here()) { const [x, y] = xy(s[1], s[2]); S3.fx.sparkle(x, y - 10, mine ? 1.2 : 0.7, "#fff0a0", mine ? 16 : 6); }
  if (mine) Sound.play("alba_win");
  return true;
}

/** Each frame (hud.js): hook the drawing in once, time the sitting, pick up a keepsake underfoot. */
export function tick() {
  if (!st.hooked) { S3.hooks.push(draw); st.hooked = true; }
  const r = R(), d = D();
  if (!r || !d || !G.me) return;
  if (!(G.me.sit && openSpot() >= 0)) st.sitAt = 0; else if (!st.sitAt) st.sitAt = now();
  // a find just went into the book: a sparkle where it lay
  if (st.map !== here()) { st.map = here(); st.k = r[1]; }
  else if (r[1] !== st.k) { st.k = r[1]; Sound.play("alba_coin"); S3.fx.sparkle(G.me.x, G.me.y - 6, 0.8, FIND_COL[here()] || "#fff0a0", 10); }
  const mi = d.maps.indexOf(here());
  if (mi < 0 || !r[6] || G.me.dead || now() - st.sent < 700) return;
  for (let i = 0; i < r[6].length; i++) {
    if (r[1] & (1 << (mi * d.finds + i)) || dist(G.me.x, G.me.y, ...xy(...r[6][i])) > 22) continue;
    st.sent = now(); act({ t: "rest", a: "pick", i });
    return;
  }
}

// ───────────────────────────── drawing (an S3 hook: world pixels in the iso frame) ─────────────────────────────
function draw(g, t) {
  const d = D(), r = R(), map = here();
  if (!d || !r || !d.maps.includes(map)) return;
  const at = (wx, wy) => { const [X, Y] = S3.iso(wx, wy), x0 = Math.round(X), y0 = Math.round(Y); return (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x0 + a, y0 + b, w, h); }; };
  d.spots.forEach((s, i) => {
    if (s[0] !== map) return;
    const px = at(...xy(s[1], s[2])), done = !!(r[0] & (1 << i));
    px(-2, -11, 4, 12, INK); px(-1, -10, 2, 10, "#8a6238");                                   // the post
    px(-7, -22, 14, 12, INK); px(-6, -21, 12, 10, done ? "#8ad88a" : "#fff0c8");             // the board
    if (done) { px(-4, -16, 2, 2, "#1f6a3a"); px(-2, -14, 2, 2, "#1f6a3a"); px(0, -16, 2, 2, "#1f6a3a"); px(2, -18, 2, 2, "#1f6a3a"); }   // ✓
    else { px(-1, -19, 3, 3, "#c0560a"); px(0, -16, 2, 1, "#c0560a"); px(-1, -15, 2, 1, "#c0560a"); }                                // , (쉼표)
    if (!done && Math.floor(t / 200 + i * 3) % 7 === 0) { px(5, -25, 3, 1, "#ffffff"); px(6, -26, 1, 3, "#ffffff"); }
    if (!done && st.sitAt && i === nearSpot()) {                                              // the rest counting up
      const f = Math.min(1, (now() - st.sitAt) / (d.sitSec * 1000));
      px(-9, -29, 18, 5, INK); px(-8, -28, 16, 3, "#4a3e58"); px(-8, -28, Math.round(16 * f), 3, "#ffd84a");
    }
  });
  const mi = d.maps.indexOf(map), col = FIND_COL[map];
  (r[6] || []).forEach((f, i) => {
    if (r[1] & (1 << (mi * d.finds + i))) return;
    const px = at(...xy(f[0], f[1])), ph = Math.floor(t / 150 + i * 2) % 8;
    px(-2, -3, 4, 3, INK); px(-1, -2, 2, 1, col);                                             // the keepsake on the ground
    if (ph < 3) { const k = ph === 1 ? 2 : 1; px(-k, -8, 2 * k + 1, 1, "#ffffff"); px(0, -8 - k, 1, 2 * k + 1, "#ffffff"); }   // a twinkle over it
  });
}

// ───────────────────────────── the 쉼표 수첩 window ─────────────────────────────
export const listKey = () => [JSON.stringify(R()), here(), !!D()];
export function renderList(s) {
  const box = $("#rest-body"), d = D(), r = s && s.rest;
  box.textContent = "";
  if (!d || !r) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const top = el("div", "daily-top");
  top.append(el("span", "", r[5] ? `여유 · 경험치 +${r[5]}%` : "여유 없음"), el("b", "", r[5] ? `약 ${Math.max(1, Math.round(r[4] / 60000))}분 남음` : "명소에서 쉬면 생겨요"));
  box.append(top);
  box.append(el("p", "hint", `명소의 팻말 곁에서 F(또는 앉기)로 앉아 ${d.sitSec}초 쉬면 오늘의 도장을 받아요. 도장마다 여유가 +${d.pct}% (최대 +${d.pctMax}%, ${d.ms / 60000}분) 쌓이고, 노을과 밤에는 보수가 더 많아요.`));
  box.append(el("p", "hint", "산책길에 반짝이는 것은 가까이 걸어가면 주워요. 매일 아침 6시에 새로 놓여요."));
  d.maps.forEach((map, mi) => {
    const card = el("div", "dcard jb-card rs-card" + (map === here() ? " on" : "")), hd = el("div", "dh");
    const got = bits((r[1] >> (mi * d.finds)) & (2 ** d.finds - 1));
    const tag = el("span", "tag", `${d.find[map]} ${got}/${d.finds}`);
    if (got === d.finds) tag.style.background = "#5ee07a";
    hd.append(el("b", "", d.names[map]), tag);
    card.append(hd);
    d.spots.forEach((sp, i) => {
      if (sp[0] !== map) return;
      const today = !!(r[0] & (1 << i)), ever = !!(r[2] & (1 << i));
      card.append(el("small", today ? "ok" : "where", `${today ? "✔" : ever ? "★" : "·"} ${sp[3]}${today ? " — 오늘 쉬어감" : ever ? "" : " — 아직 가 보지 않은 곳"}`));
    });
    box.append(card);
  });
  box.append(el("p", "hint", `수첩에 담은 명소 ${bits(r[2])}/${d.spots.length} · 지금까지 주운 추억 ${r[3].toLocaleString()}개`));
}
