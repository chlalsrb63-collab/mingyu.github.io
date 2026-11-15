// ───────────────────────────── 버드나무 장날 and the seasons (P12) ─────────────────────────────
// The year turns on the server clock alone: four seasons of 91 KST days, counted from 2026-03-01 (봄), so the
// game's year is 364 days and drifts a day and a bit a year against the calendar — fine for a game. Every Sunday
// 10:00–22:00 KST 버드나무 마을 holds its market: four festival rows on the 알바 board (JB `fair`, never counted in
// perDay) and a cooking contest (the day's best pan score in the village) pay 장날 토큰 — never gold — up to
// FAIR.cap a board day; 장꾼 다래 (role `fair`, by the market stalls) sells the season's pieces for them.
// Sheet: `fair` { t: the purse, d: the board day `n`/`pan` belong to, n: tokens earned that day, pan: best pan score that day }.

/** Seasons: KST calendar days from `epoch` (2026-03-01 = day 20513) in blocks of `len`, named in order. */
const SEASON = { epoch: 20513, len: 91, name: ["봄", "여름", "가을", "겨울"] };
/** The KST calendar day (midnight to midnight; the board's day turns at 06:00, dayOf). */
const kstDay = (now) => Math.floor((now + KST) / DAY_MS);
/** The season now: 0 봄 · 1 여름 · 2 가을 · 3 겨울 (the cycle repeats every 364 days, before the epoch too). */
const seasonOf = (now) => ((Math.floor((kstDay(now) - SEASON.epoch) / SEASON.len) % 4) + 4) % 4;
/**
 * 장날: KST weekday `day` (0 Sunday; day 0 of the clock was a Thursday) from `open` to `close` o'clock, on `map`.
 * Tokens: at most `cap` a board day and `max` in the purse; `job` per festival row by grade (쉬움 보통 어려움);
 * the contest's `pan` steps [score, tokens], each paid once a day when the day's best first reaches it.
 */
const FAIR = { map: "willow", day: 0, open: 10, close: 22, cap: 8, max: 999, job: [1, 2, 2], pan: [[60, 1], [90, 1]] };
const fairOpen = (now) => (kstDay(now) + 4) % 7 === FAIR.day && (now + KST) % DAY_MS >= FAIR.open * 3600000 && (now + KST) % DAY_MS < FAIR.close * 3600000;
/** The board's festival rows (12-life-tables.js JB, `fair: true`). */
const FAIR_JOBS = Object.keys(JB).filter((id) => JB[id].fair);
/**
 * 장꾼 다래's stall, per season: [cosmetic id, tokens]; only the season now sells. Rows 2–5 are the 사계절 pieces (P11:
 * hat, top, back, weapon skin of 벚꽃 · 한여름 바다 · 단풍 · 눈꽃; COSMETICS src "fair"), the first an older piece that fits
 * the season. A row whose id is not in COSMETICS would show "곧 들어옵니다" and not sell. A season's four cost 100: ≈ 13 Sundays × 8.
 */
const FAIR_SET = ["sakura", "sea", "maple", "snow"];
const FAIR_NOW = ["hat_wreath_white", "hat_wreath_sun", "hat_straw_blue", "hat_santa"];
const FAIR_SHOP = FAIR_SET.map((k, s) => [[FAIR_NOW[s], 20], [`hat_ssn_${k}`, 20], [`top_ssn_${k}`, 30], [`back_ssn_${k}`, 25], [`ws_ssn_${k}`, 25]]);

const fairFresh = () => ({ t: 0, d: 0, n: 0, pan: 0 });
/** A saved `fair` cleaned (migrate): whole numbers, clamped; an old sheet starts with an empty purse. */
function fairClean(v) {
  const f = isObj(v) ? v : {}, n = (x, hi) => clamp(Number.isFinite(x) ? Math.floor(x) : 0, 0, hi);
  return { t: n(f.t, FAIR.max), d: n(f.d, 1e7), n: n(f.n, FAIR.cap), pan: n(f.pan, 100) };
}
/** Today's counters: a new board day starts them at zero (the purse stays). */
function fairToday(S, ch) {
  const d = dayOf(S.now);
  if (ch.fair.d !== d) ch.fair = { t: ch.fair.t, d, n: 0, pan: 0 };
  return ch.fair;
}
/** Pay up to `n` 장날 토큰, never past today's cap or the purse's; returns how many were paid. */
function fairGain(S, p, n) {
  const f = fairToday(S, p.ch), k = Math.max(0, Math.min(n, FAIR.cap - f.n, FAIR.max - f.t));
  if (k > 0) { f.n += k; f.t += k; p.dirty = true; }
  return k;
}
/** The channel's best pan score today: { d, s, name } (in memory only: a restart starts the day's contest over). */
function fairTop(S) {
  const d = dayOf(S.now);
  if (!S.fairTop || S.fairTop.d !== d) S.fairTop = { d, s: 0, name: "" };
  return S.fairTop;
}
/** A pan score (0–100) from a played mini-game (never a batch): on 장날 in the village it enters the cooking contest. */
function fairPan(S, p, s) {
  if (!fairOpen(S.now) || p.map !== FAIR.map) return;
  const f = fairToday(S, p.ch), was = f.pan;
  if (!(s > was)) return;
  f.pan = s;
  p.dirty = true;
  let got = 0;
  for (const [at, k] of FAIR.pan) if (was < at && s >= at) got += fairGain(S, p, k);
  toast(p, `[장날 요리 대회] 오늘 내 최고 ${s}점${got ? ` · 장날 토큰 +${got}` : ""}`);
  const top = fairTop(S);
  if (s <= top.s) return;
  Object.assign(top, { s, name: p.ch.name });
  for (const o of Object.values(S.players)) if (o.map === FAIR.map) { o.dirty = true; toast(o, `[장날 요리 대회] ${p.ch.name} 님이 ${s}점으로 1등!`); }
}
/** Once a tick (lifeTick): the market opening (also on arrival while it is open) and closing, said; the board re-sent. */
function fairWatch(S, p, now) {
  const o = fairOpen(now);
  if (p.fairOn === o) return;
  if (o) toast(p, `오늘은 버드나무 장날! ${FAIR.close}시까지 마을 게시판의 장날 알바와 공동 부엌 요리 대회로 장날 토큰을 모아 보세요.`);
  else if (p.fairOn !== undefined) toast(p, "버드나무 장날이 끝났습니다. 다음 일요일에 또 만나요!");
  if (p.fairOn !== undefined) p.dirty = true;
  p.fairOn = o;
}

/** `fair_buy {id}` beside 장꾼 다래: a piece of this season's stall, for tokens. */
function fairValidate(S, p, a) {
  const ch = p.ch, row = typeof a.id === "string" ? FAIR_SHOP[seasonOf(S.now)].find((r) => r[0] === a.id) : null;
  if (!row) return bad("이번 계절 장터에서 팔지 않는 물건입니다");
  if (!Object.hasOwn(COSMETICS, a.id)) return bad("곧 들어옵니다");
  if (!npcNear(p, "fair")) return bad("장꾼 다래가 너무 멉니다");
  if (ch.cos.own.includes(a.id)) return bad("이미 가지고 있습니다");
  return ch.fair.t < row[1] ? bad("장날 토큰이 부족합니다") : OK;
}
function fairApply(S, p, a) {
  const ch = p.ch, price = FAIR_SHOP[seasonOf(S.now)].find((r) => r[0] === a.id)[1], c = COSMETICS[a.id];
  ch.fair.t -= price;
  ch.cos.own.push(a.id);
  // bought to be worn, as at the costume shop
  ch.cos.on[c.slot] = a.id;
  S.maps[p.map].who = true;
  toast(p, `[${c.name}]${pp(c.name, "을를")} 장날 토큰 ${price}개에 샀습니다. 캐릭터 창 ‘외형’ 탭에서 갈아입을 수 있습니다.`);
  p.dirty = true;
}

/** self.fair: [purse, earned today, my best pan today, the channel's best today, its cook's name]. */
function fairSelf(p) {
  const f = p.ch.fair, d = dayOf(p.S.now), top = p.S.fairTop && p.S.fairTop.d === d ? p.S.fairTop : { s: 0, name: "" };
  return [f.t, f.d === d ? f.n : 0, f.d === d ? f.pan : 0, top.s, top.name];
}
/** defs().fair: the seasons, the market's hours and pay, and each season's stall [id, price, on sale (drawn) 0/1, name, slot]. */
const fairDefs = () => ({
  season: SEASON.name, map: FAIR.map, open: FAIR.open, close: FAIR.close, cap: FAIR.cap, job: FAIR.job, pan: FAIR.pan,
  shop: FAIR_SHOP.map((rows) => rows.map(([id, price]) => {
    const c = Object.hasOwn(COSMETICS, id) ? COSMETICS[id] : null;
    return [id, price, c ? 1 : 0, c ? c.name : "", COS_SLOT_NAME[c ? c.slot : id.startsWith("ws_") ? "wskin" : id.split("_")[0]]];
  })),
});
