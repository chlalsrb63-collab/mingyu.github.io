// ───────────────────────────── 쉼표 수첩: resting spots and stroll finds in the safe zones ─────────────────────────────
// docs/design/safezone-healing-2026-11-20.md. Two calm things to do on the four safe maps: no fight, no timer, no way to fail.
//   · 쉬어가기 — sit down (the `sit` action) near a REST_SPOTS place for REST_T.sitSec seconds: today's stamp, a little gold
//     (more at 노을 and 밤) and 여유, an experience bonus that grows with today's stamps. The first stamp ever fills the book.
//   · 산책 줍기 — REST_T.finds keepsakes a day on each map, on tiles drawn from the player, the day and the map; walking up
//     to one picks it up (the client asks `rest {a:"pick", i}`, the rules check the reach).
// Cost: restTick runs once a second per player and leaves at once unless they sit on one of the four maps; nothing is kept
// in the world, only on the sheet.
// Sheet (no version bump, as ch.ab: a missing one starts fresh):
//   ch.rest = { day, s (today's stamps, a bit per spot), k (today's finds, bit = map index × finds + i), book (stamps ever),
//               n (finds ever), until (여유 ends, ms), pct (여유 %) }
// Wire: self.rest = [s, k, book, n, 여유 ms left, 여유 %, today's finds on this map [[tile x, tile y]…] | 0]; defs.rest;
//       event ["rs", eid, spot] when a stamp lands.

const REST_T = { sitSec: 8, reach: 44, pick: 30, finds: 6, gold: 30, glow: 1.5, findGold: 10, strollGold: 60, lxp: 3, pct: 2, pctMax: 10, ms: 30 * 60000, bookGold: 2000 };
/** [map, tile x, tile y, name, what the stamp says]: tiles one can stand on (tests/rest.mjs checks each). */
const REST_SPOTS = [
  ["town", 49, 42, "광장 분수 앞", "물소리를 들으며 잠깐 숨을 골랐어요."],
  ["town", 81, 67, "광장 전망대", "지붕 너머로 마을이 한눈에 들어와요."],
  ["town", 70, 58, "장터 남쪽 벤치", "지나가는 사람들을 구경했어요."],
  ["willow", 38, 29, "마을 분수", "물방울이 햇빛에 반짝였어요."],
  ["willow", 58, 27, "물레방아 물가", "물레방아 도는 소리가 마음을 가라앉혀요."],
  ["willow", 38, 33, "버드나무 벤치", "버드나무 가지가 바람에 흔들려요."],
  ["sunset_beach", 147, 64, "노을 전망대", "수평선이 천천히 물들어 가요."],
  ["sunset_beach", 29, 72, "작은 선착장", "발밑에서 파도가 찰랑거려요."],
  ["sunset_beach", 58, 48, "야자숲 그늘", "야자잎 사이로 바람이 지나가요."],
  ["blossom_trail", 37, 10, "오래된 벚나무 쉼터", "꽃잎이 어깨 위에 내려앉았어요."],
  ["blossom_trail", 20, 36, "물결 유채밭", "노란 물결이 바람을 따라 흘러가요."],
  ["blossom_trail", 52, 36, "햇살 유채밭", "따뜻한 햇살에 눈이 스르르 감겨요."],
];
/** The keepsake each map hides for a stroll. */
const REST_FIND = { town: "반짝이는 단추", willow: "네잎클로버", sunset_beach: "조개껍데기", blossom_trail: "벚꽃잎" };
const REST_NAME = { town: "버드나무광장", willow: "버드나무 마을", sunset_beach: "노을해변", blossom_trail: "벚꽃나무산책로" };   // as the maps name themselves (tests/rest.mjs)
const REST_MAPS = Object.keys(REST_FIND);

const restFresh = () => ({ day: 0, s: 0, k: 0, book: 0, n: 0, until: 0, pct: 0 });
/** A sheet's `rest` made whole (migrate): whole numbers, nothing negative, bits within their range. */
function restClean(r) {
  const o = restFresh();
  if (!isObj(r)) return o;
  for (const f of Object.keys(o)) { const v = Math.floor(Number(r[f])); if (Number.isFinite(v) && v > 0) o[f] = v; }
  const all = 2 ** REST_SPOTS.length - 1;
  o.s &= all; o.book &= all; o.k &= 2 ** (REST_MAPS.length * REST_T.finds) - 1;
  o.pct = Math.min(o.pct, REST_T.pctMax);
  return o;
}
/** Today's page: a new day (06:00, as the dailies) clears the stamps and finds, never the book. */
function restToday(p) {
  const ch = p.ch, day = dayOf(p.S.now);
  if (!isObj(ch.rest)) ch.rest = restFresh();
  if (ch.rest.day !== day) { ch.rest.day = day; ch.rest.s = 0; ch.rest.k = 0; }
  return ch.rest;
}
const restBits = (v) => { let n = 0; for (; v; v &= v - 1) n++; return n; };
/** 여유: the experience bonus in percent while it lasts (stats). */
const restPct = (ch, now) => (ch.rest && ch.rest.until > now ? ch.rest.pct | 0 : 0);

/** The unstamped-or-not spot within reach of `p`, as its index, or -1. */
function restNear(p) {
  for (let i = 0; i < REST_SPOTS.length; i++) {
    const s = REST_SPOTS[i];
    if (s[0] === p.map && dist(p.x, p.y, s[1] * T + 8, s[2] * T + 8) <= REST_T.reach) return i;
  }
  return -1;
}
/** Once a second (80 tick): sitting by a spot not stamped today counts up to the stamp. */
function restTick(S, p, now) {
  if (!p.sit || !Object.hasOwn(REST_FIND, p.map)) { p.restT = 0; return; }
  const i = restNear(p), r = i < 0 ? null : restToday(p);
  if (!r || r.s & (1 << i)) { p.restT = 0; return; }
  p.restT = (p.restT | 0) + 1;
  if (p.restT < REST_T.sitSec) return;
  p.restT = 0;
  const ph = dayPhase(now), glow = ph >= 3, first = !(r.book & (1 << i));   // 노을 and 밤 pay more
  let gold = Math.round(REST_T.gold * (glow ? REST_T.glow : 1));
  r.s |= 1 << i; r.book |= 1 << i;
  r.pct = Math.min(REST_T.pctMax, REST_T.pct * restBits(r.s)); r.until = now + REST_T.ms;
  toast(p, `[쉼표 수첩] ${REST_SPOTS[i][3]} — ${REST_SPOTS[i][4]} (+${gold}G${glow ? ` · ${PHASES[ph][0]}빛 보너스` : ""}) 여유: ${REST_T.ms / 60000}분간 경험치 +${r.pct}%`);
  if (first && restBits(r.book) === REST_SPOTS.length) { gold += REST_T.bookGold; toast(p, `쉼표 수첩의 모든 명소를 채웠어요! 축하 선물 ${REST_T.bookGold.toLocaleString()}G`); }
  p.ch.gold += gold; p.gain.push(["gold", gold]);
  S.maps[p.map].ev.push(["rs", p.eid, i]);
  p.dirty = true;
}

/** Tiles a keepsake may lie on: every tile of the map one can walk to (worked out once a map). */
const REST_POOL = {};
function restPool(map) {
  if (REST_POOL[map]) return REST_POOL[map];
  const m = mapOf(map), out = (REST_POOL[map] = []);
  for (let i = 0; i < m.reach.length; i++) if (m.reach[i]) out.push(i);
  return out;
}
/** Today's keepsakes for `p` on a rest map: [[tile x, tile y]…], the same all day. */
function restFinds(p, map) {
  const pool = restPool(map), w = mapOf(map).w, day = dayOf(p.S.now), out = [];
  for (let i = 0; i < REST_T.finds; i++) { const at = pool[strHash(`${p.pid}|${day}|${map}|${i}`) % pool.length]; out.push([at % w, Math.floor(at / w)]); }
  return out;
}

function restValidate(S, p, a) {
  const mi = REST_MAPS.indexOf(p.map);
  if (a.a !== "pick" || !Number.isInteger(a.i) || a.i < 0 || a.i >= REST_T.finds) return bad("알 수 없는 요청입니다");
  if (mi < 0 || p.dead) return bad("여기서는 주울 것이 없습니다");
  if (restToday(p).k & (1 << (mi * REST_T.finds + a.i))) return bad("이미 주웠습니다");
  const [x, y] = restFinds(p, p.map)[a.i];
  if (dist(p.x, p.y, x * T + 8, y * T + 8) > REST_T.pick) return bad("조금 더 가까이 가야 합니다");
  return OK;
}
function restApply(S, p, a) {
  const r = restToday(p), mi = REST_MAPS.indexOf(p.map), base = mi * REST_T.finds, mask = (2 ** REST_T.finds - 1) << base;
  r.k |= 1 << (base + a.i); r.n++;
  const got = restBits(r.k & mask), done = got === REST_T.finds, gold = REST_T.findGold + (done ? REST_T.strollGold : 0);
  p.ch.gold += gold; p.gain.push(["gold", gold]);
  gainLife(S, p, "gather", REST_T.lxp);
  toast(p, done ? `${REST_FIND[p.map]} 발견! 오늘 이곳의 산책을 마쳤어요 (+${gold}G)` : `${REST_FIND[p.map]} 발견! (+${gold}G) · 오늘 이곳 ${got}/${REST_T.finds}`);
  p.dirty = true;
}

function restSelf(p) {
  const r = restToday(p), now = p.S.now, on = r.until > now;
  return [r.s, r.k, r.book, r.n, on ? r.until - now : 0, on ? r.pct : 0, Object.hasOwn(REST_FIND, p.map) ? restFinds(p, p.map) : 0];
}
const restDefs = () => ({
  spots: REST_SPOTS.map(([map, x, y, name]) => [map, x, y, name]), maps: REST_MAPS, find: REST_FIND, names: REST_NAME,
  sitSec: REST_T.sitSec, reach: REST_T.reach, finds: REST_T.finds, pct: REST_T.pct, pctMax: REST_T.pctMax, ms: REST_T.ms,
});
