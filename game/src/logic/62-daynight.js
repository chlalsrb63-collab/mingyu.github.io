// ───────────────────────────── the turning day, the weather, the fire at night ─────────────────────────────
// Outdoors the day turns on the server clock, the same for everyone on every channel;
// the weather is rolled per map from the clock and a seed, so all players see the same
// sky; and at night the town's campfire becomes a place to gather (Mabinogi's campfire,
// 바람의나라's 주막): stumps to sit on, warmth that grows with company, a storyteller.

/**
 * One day outdoors lasts 48 real minutes, so one hour of the day is two real minutes:
 * hour = (now mod 48 min) / 2 min, counted from the epoch (00:00 at every 48-minute mark).
 * The phases, by hour: 새벽 04:30 · 아침 07:00 · 낮 11:00 · 노을 17:00 · 밤 19:30–04:30.
 */
const SKY_DAY_MS = 48 * 60000;
const PHASES = [["새벽", 4.5], ["아침", 7], ["낮", 11], ["노을", 17], ["밤", 19.5]];
const PH_NIGHT = 4;
/** The hour of the day outdoors, 0–24 (fractional). */
function dayHour(now) { return ((((now % SKY_DAY_MS) + SKY_DAY_MS) % SKY_DAY_MS) / SKY_DAY_MS) * 24; }
/** Which phase the day is in: an index into PHASES (0 새벽 … 4 밤). */
function dayPhase(now) {
  const h = dayHour(now);
  for (let i = PHASES.length - 1; i >= 0; i--) if (h >= PHASES[i][1]) return i;
  return PH_NIGHT;
}
function isNight(now) { return dayPhase(now) === PH_NIGHT; }

// ── the weather: one roll per map for every six real minutes (three hours of the day)
const WEATHER = ["맑음", "흐림", "비", "안개", "바람", "눈"];
const WX = { clear: 0, cloud: 1, rain: 2, fog: 3, wind: 4, snow: 5 };
const WX_MS = 6 * 60000;
/** How often each weather comes, by the map's look: [맑음, 흐림, 비, 안개, 바람, 눈]. Snow is a rare treat. */
const WX_ODDS = {
  town: [50, 20, 14, 6, 10, 0],
  meadow: [40, 18, 16, 8, 16, 2],
  forest: [30, 18, 20, 22, 8, 2],
  city: [40, 30, 24, 6, 0, 0],
};
/** Small flavour: rain brings the fish up sooner, fog hides you a little from monsters. */
const WX_FISH = 0.75, WX_FOG_AGGRO = 0.9;
/** Maps under the open sky: the day turns and the weather comes only there. */
function outdoor(m) { return !!m && !m.indoor && Object.hasOwn(WX_ODDS, m.theme || m.id); }
/** A well-mixed 0–1 number from a map id and a slot, the same on every server. */
function wxRoll(id, slot) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (slot | 0), 2246822519); h ^= h >>> 13;
  h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** The weather on a map at a moment: an index into WEATHER, or -1 indoors and underground. */
function weatherAt(id, now) {
  const m = MAPS[id];
  if (!outdoor(m)) return -1;
  const odds = WX_ODDS[m.theme || m.id];
  let r = wxRoll(id, Math.floor(now / WX_MS)) * odds.reduce((a, b) => a + b, 0), w = 0;
  while (w < odds.length - 1 && r >= odds[w]) { r -= odds[w]; w++; }
  // fog burns off by midday
  if (w === WX.fog && dayPhase(now) === 2) w = WX.cloud;
  return w;
}

// ── the campfire's company: stumps to sit on around every fire that always burns
/** Where the stumps stand around a fire, in world pixels from it (left-front, behind, right, front-right on screen). */
const SEAT_AT = [[-7, 27], [-15, -25], [17, -17], [34, 14]];
/** Warmth: +10% experience, +3% for each other sitter (up to four around one fire), +1% at night; regen +0.5% a second per sitter. */
const WARM_N = 4, WARM_BASE = 10, WARM_STEP = 3, WARM_NIGHT = 1, WARM_REGEN = 0.005;
/** Snapping onto a stump: how close you must stand to it. */
const SEAT_R = 18;
/** Fires and their seats, by map: { x, y, seats: [[x, y]…] } in world pixels. */
const CAMPS = {};
function campsOf(m) {
  const out = [];
  for (const [fx, fy] of FIRES[m.id] || []) {
    const at = freeTile(m, fx, fy);
    if (!at) continue;
    const x = at[0] * T + 8, y = at[1] * T + 10, seats = [];
    for (const [dx, dy] of SEAT_AT) {
      const sx = x + dx, sy = y + dy;
      if (canStand(m, sx, sy) && m.reach[Math.floor(sy / T) * m.w + Math.floor(sx / T)]) seats.push([sx, sy]);
    }
    // out in the wilds there is room for three around a camp; the town's fire seats four
    out.push({ x, y, seats: m.safe ? seats : seats.slice(0, 3) });
  }
  return out;
}
for (const id of Object.keys(MAPS)) CAMPS[id] = campsOf(MAPS[id]);

/** Players sitting around the fire `f` on `p`'s map, `p` counted if they sit too. */
function sittersAt(S, map, f) {
  let n = 0;
  for (const oid of Object.keys(S.players)) {
    const o = S.players[oid];
    if (o.map === map && o.sit && !o.dead && dist(o.x, o.y, f.x, f.y) <= FIRE_R) n++;
  }
  return n;
}
/** The warmth for `n` sitters (1–4 counted), by day or by night: { pct, regen }. */
function warmthFor(n, night) {
  const k = clamp(n | 0, 1, WARM_N);
  return { pct: WARM_BASE + WARM_STEP * (k - 1) + (night ? WARM_NIGHT : 0), regen: WARM_REGEN * k };
}
/**
 * Sitting down: on the nearest free stump within reach, facing the fire, or where you
 * stand. A stump is taken when someone already sits on it.
 */
function sitDown(S, p) {
  p.sit = true; p.warmT = 0;
  let best = null, bd = SEAT_R;
  for (const c of CAMPS[p.map] || []) for (const [sx, sy] of c.seats) {
    const d = dist(p.x, p.y, sx, sy);
    if (d > bd) continue;
    let taken = false;
    for (const oid of Object.keys(S.players)) { const o = S.players[oid]; if (o !== p && o.map === p.map && o.sit && dist(o.x, o.y, sx, sy) < 4) { taken = true; break; } }
    if (!taken) { bd = d; best = [sx, sy, c]; }
  }
  if (!best) return false;
  p.x = best[0]; p.y = best[1];
  p.dir = dirOf(best[2].x - p.x, best[2].y - p.y);
  p.fix = true;
  return true;
}
/** Once a second, for a calm player sitting by a fire: warmth that grows with the company. */
function warmTick(S, p, fire, now) {
  if (++p.warmT < WARM_SEC) return;
  p.warmT = 0;
  const n = sittersAt(S, p.map, fire), w = warmthFor(n, outdoor(MAPS[p.map]) && isNight(now));
  const live = p.warm > now, had = live ? p.warmPct : 0;
  if (w.pct > had) toast(p, `모닥불의 온기 — 10분간 경험치 +${w.pct}%, 회복 +${(w.regen * 100).toFixed(1)}%/초${n > 1 ? ` (함께 앉은 ${n}명)` : ""}`);
  // the warmth keeps the best company it has had while it lasts
  p.warmN = clamp(Math.max(live ? p.warmN || 0 : 0, n), 1, WARM_N);
  p.warm = now + WARM_MS; p.warmPct = Math.max(had, w.pct);
  p.ch.st.rest++;
  tutStep(S, p, "rest");
  checkAch(S, p);
  p.dirty = true;
}
/** The warmth's regen, a share of the maximum each second while it lasts and you are not fighting. */
function warmRegen(p, now) { return p.warm > now ? WARM_REGEN * clamp(p.warmN || 1, 1, WARM_N) : 0; }

// ── songs and toasts by the fire (연주, 건배)
const JAM = ["연주", "건배"];
const JAM_CD = 1200;

// ── the storyteller: at night she sits by the town's fire and tells a tale every hundred seconds
const TALE_MS = 100000;
const TELLER = { id: "story", name: "이야기꾼 할머니 소담", role: "talk", x: 20, y: 22, night: 1, look: [5, 2, 0, "#7a5a8a"],
  say: "밤이 깊었구나. 불 가까이 앉으렴 — 이야기는 혼자 듣는 것보다 여럿이 듣는 게 더 따뜻하단다." };
const TALES = [
  "옛날 옛적, 넥서스 광장은 정령나무 한 그루뿐인 빈 들판이었단다. 길 잃은 이들이 그 푸른 빛을 보고 모여들었지.",
  "정령나무의 잎은 밤마다 빛을 머금는단다. 그 빛이 꺼지지 않는 한, 마을에는 지옥 짐승이 들어오지 못해.",
  "바람초원의 두 머리 토끼는 원래 평범한 토끼였대. 심연에서 새어 나온 붉은 안개를 마시고 그리 되었다더구나.",
  "속삭임 숲에서 누가 네 이름을 부르거든 대답하지 말거라. 눈 달린 까마귀가 목소리를 흉내 내는 거란다.",
  "반딧불이는 먼 길 떠난 모험가들의 작은 소원이래. 모닥불 곁에 모이는 건 따뜻한 데가 그리워서지.",
  "지하묘지의 뼈들은 아직 자기가 살아 있는 줄 안단다. 그러니 그곳에선 발소리를 죽이렴.",
  "네온 시티가 생기기 전, 그 자리엔 별을 세던 천문대가 있었지. 지금도 비 오는 밤엔 옛 종소리가 들린대.",
  "모닥불에 둘러앉은 이들은 서로의 이름을 오래 기억한단다. 그래서 불가의 인연은 쉽게 끊어지지 않지.",
  "심연 깊은 곳의 사자손은 한때 이 마을의 문지기였다는 소문이 있어. 믿거나 말거나 말이다.",
  "비 오는 날엔 물고기가 수면 가까이 올라온단다. 낚싯대를 챙겨 연못으로 가 보렴.",
  "안개 낀 날엔 짐승들도 앞이 잘 안 보인단다. 살금살금 지나가면 들키지 않을지도 몰라.",
  "새벽녘 정령나무 아래에서 소원을 빌면, 그날 사냥은 운이 좋다는구나. 할미도 젊을 적엔 매일 빌었지.",
];
MAPS.town.npcs.push(TELLER);
/** The storyteller of `map` if she is out at `now` (only by night), else null. */
function nightNpc(map, now) { return map === "town" && isNight(now) ? TELLER : null; }
/** Which tale is being told at `now` (an index into TALES), or -1 by day. */
function taleAt(now) { return isNight(now) ? Math.floor(now / TALE_MS) % TALES.length : -1; }

/** Once a tick, per outdoor map: the weather, and at night in town the next tale by the fire. */
function skyTick(S, now) {
  for (const id of Object.keys(S.maps)) {
    const rt = S.maps[id];
    rt.wx = weatherAt(id, now);
    if (id !== "town") continue;
    const slot = isNight(now) ? Math.floor(now / TALE_MS) : -1;
    if (slot !== rt.tale) { rt.tale = slot; if (slot >= 0) rt.ev.push(["tl", slot % TALES.length]); }
  }
}

/**
 * The sky over a map at a moment, for the tests and the tools: the hour, the phase, the
 * weather, whether the storyteller is out and which tale she tells, and the camps.
 */
export function skyAt(map, now) {
  const ph = dayPhase(now), m = MAPS[map];
  return { hour: dayHour(now), phase: ph, name: PHASES[ph][0], night: ph === PH_NIGHT, outdoor: outdoor(m), wx: weatherAt(map, now), npc: nightNpc(map, now), tale: map === "town" ? taleAt(now) : -1, camps: CAMPS[map] || [] };
}
