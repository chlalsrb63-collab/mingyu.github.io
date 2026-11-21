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
  autumn: [34, 22, 14, 16, 14, 0],
  jungle: [30, 22, 30, 12, 6, 0], coast: [46, 14, 16, 0, 24, 0], desert: [62, 8, 0, 0, 30, 0],
  // maps-batch2: the cloud temple is fog first; the red mesa is dry and windy; jianmen is crisp highland mountain weather
  mist: [18, 24, 14, 36, 6, 2], mesa: [56, 12, 4, 6, 22, 0], jianmen: [34, 24, 14, 18, 10, 0],
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
  // (from what is known of the map: the weather never builds one; an instance is underground)
  const m = MAP_META[id];
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
function campsOf(m) {
  if (m.camps) return m.camps;
  const out = (m.camps = []);
  // indoors the fire burns in a fireplace: no stumps round it, you sit where you stand (armchairs are furniture)
  if (m.theme === "interior") return out;
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
  for (const c of campsOf(mapOfS(S, p.map))) for (const [sx, sy] of c.seats) {
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
/** 모닥불 피우기 (owner): sitting down in the field lights a short fire — calm, no live monster this close, none burning near. */
const FIELD_FIRE_MS = 120000, FIELD_FIRE_CALM = 5000, FIELD_FIRE_MOB = 160;
/** Called when someone sits down: lights a field fire when it may, says why when it may not. */
function fieldFire(S, p, now) {
  const rt = S.maps[p.map], m = mapOfS(S, p.map);
  if (fireNear(rt, p) || m.safe || m.theme === "interior") return;
  if (now - p.hitAt < FIELD_FIRE_CALM) return toast(p, "싸우는 중에는 모닥불을 피울 수 없습니다");
  if (rt.mobs.some((o) => !o.dead && dist(o.x, o.y, p.x, p.y) < FIELD_FIRE_MOB)) return toast(p, "몬스터가 가까워 모닥불을 피울 수 없습니다");
  if (rt.fires.filter((f) => f.until).length >= FIRE_MAX) return toast(p, "이 지역에는 모닥불이 너무 많습니다");
  rt.fires.push({ id: S.nextId++, x: Math.round(p.x), y: Math.round(p.y) - 14, until: now + FIELD_FIRE_MS });
  rt.ev.push(["u", p.eid, 2]);
  toast(p, "모닥불을 피웠습니다 — 2분 동안 요리, 스킬 칸 바꾸기, 수련을 이 곁에서 할 수 있습니다.");
}
/** Once a second, for a calm player sitting by a fire: warmth that grows with the company. */
function warmTick(S, p, fire, now) {
  if (++p.warmT < WARM_SEC) return;
  p.warmT = 0;
  const n = sittersAt(S, p.map, fire), w = warmthFor(n, outdoor(mapOfS(p.S, p.map)) && isNight(now));
  const live = p.warm > now, had = live ? p.warmPct : 0;
  if (w.pct > had) toast(p, `모닥불의 온기 — 10분간 경험치 +${w.pct}%, 회복 +${(w.regen * 100).toFixed(1)}%/초${n > 1 ? ` (함께 앉은 ${n}명)` : ""}`);
  // the warmth keeps the best company it has had while it lasts
  p.warmN = clamp(Math.max(live ? p.warmN || 0 : 0, n), 1, WARM_N);
  p.warm = now + WARM_MS; p.warmPct = Math.max(had, w.pct);
  p.ch.cnt.rest++;
  tutStep(S, p, "rest");
  checkAch(S, p);
  p.dirty = true;
}
/** The warmth's regen, a share of the maximum each second while it lasts and you are not fighting. */
function warmRegen(p, now) { return p.warm > now ? WARM_REGEN * clamp(p.warmN || 1, 1, WARM_N) : 0; }

// ── songs and toasts by the fire (연주, 건배)
const JAM = ["연주", "건배"];
const JAM_CD = 1200;

// ── the storyteller: at night she sits by the town's fire (two tiles west of the plaza fire, FIRES.town[0]) and tells a tale every hundred seconds
const TALE_MS = 100000;
const TELLER = { id: "story", name: "이야기꾼 할머니 소담", role: "talk", x: FIRES.town[0][0] - 2, y: FIRES.town[0][1], night: 1, look: [5, 2, 0, "#7a5a8a"],
  say: "밤이 깊었구나. 불 가까이 앉으렴 — 이야기는 혼자 듣는 것보다 여럿이 듣는 게 더 따뜻하단다." };
const TALES = [
  "옛날 옛적, 버드나무광장은 정령나무 한 그루뿐인 빈 들판이었단다. 길 잃은 이들이 그 푸른 빛을 보고 모여들었지.",
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
mapOf("town").npcs.push(TELLER);
noteNpc("town", TELLER.id, TELLER.name);
/** The storyteller of `map` if she is out at `now` (only by night), else null. */
function nightNpc(map, now) {
  if (map !== "town" || !isNight(now)) return null;
  const body = npcAt(TELLER.id, now);
  return !body || (body.place === "fire" && !body.moving && !body.hidden) ? TELLER : null;
}
/** Which tale is being told at `now` (an index into TALES), or -1 by day. */
function taleAt(now) { return nightNpc("town", now) ? Math.floor(now / TALE_MS) % TALES.length : -1; }

/** Once a tick, per outdoor map: the weather, special nocturnal/rain ecology (WLD-03), and at night in town the next tale by the fire. */
const ECO_MS = 12000, ECO_CAP = 2;
function spawnEcoMob(S, id, m, rt, kind, tag, now) {
  let host = null;
  for (const pid of Object.keys(S.players)) {
    const p = S.players[pid];
    if (p.map === id && !p.dead) { host = p; break; }
  }
  if (!host) return null;
  const slot = Math.floor(now / ECO_MS);
  const px = Math.floor(host.x / T), py = Math.floor(host.y / T);
  let tx = px, ty = py, found = false;
  for (let i = 0; i < 16 && !found; i++) {
    const ang = wxRoll(`${id}:${kind}:a`, slot * 17 + i) * Math.PI * 2;
    const rad = 8 + Math.floor(wxRoll(`${id}:${kind}:r`, slot * 31 + i) * 7);
    const cx = clamp(px + Math.round(Math.cos(ang) * rad), 2, m.w - 3);
    const cy = clamp(py + Math.round(Math.sin(ang) * rad), 2, m.h - 3);
    if (m.reach && m.reach[cy * m.w + cx] && (!m.zone || m.zone[cy * m.w + cx] !== 0)) { tx = cx; ty = cy; found = true; }
  }
  if (!found && m.entry) { tx = m.entry[0]; ty = m.entry[1]; }
  const mob = newMob(S, kind, [0, 0, 0, 0]);
  mob.el = 0; mob.tr = []; mob.temp = true; mob.eco = tag;
  mob.x = mob.hx = mob.wx = tx * T + 8; mob.y = mob.hy = mob.wy = ty * T + 10;
  // Scale to the nearest local non-boss/non-chest spawn at (tx, ty), else the map's lowest-level mob
  let refK = null, bestD = Infinity;
  for (const sp of m.spawns || []) {
    const sd = MOBS[sp.k];
    if (!sd || sd.boss || sd.chest) continue;
    const cx = (sp.r[0] + sp.r[2]) / 2, cy = (sp.r[1] + sp.r[3]) / 2;
    const d = Math.hypot(cx - tx, cy - ty);
    if (d < bestD) { bestD = d; refK = sp.k; }
  }
  if (!refK) {
    const pool = (MAP_META[id]?.kinds || []).filter((k) => MOBS[k] && !MOBS[k].boss && !MOBS[k].chest);
    pool.sort((a, b) => MOBS[a].lv - MOBS[b].lv);
    refK = pool[0] || null;
  }
  if (refK) {
    const ref = MOBS[refK], base = MOBS[kind];
    mob.hk = Math.max(0.01, (ref.hp * 1.15) / base.hp);
    mob.ak = Math.max(0.02, ref.atk / base.atk);
    mob.ecoDef = ref.def;
    mob.xpK = Math.max(0.01, (ref.xp * 1.8) / base.xp);
    mob.goldK = Math.max(0.01, (ref.gold[1] * 2.2) / base.gold[1]);
    mob.ecoLv = ref.lv;
  }
  mob.hp = mobMax(mob);
  mob.castAt = now + 3500;
  rt.mobs.push(mob);
  rt.ev.push(["r", mob.id]);
  const noteKey = `${tag}:${Math.floor(now / (tag === "night" ? SKY_DAY_MS : WX_MS))}`;
  if (rt.ecoNote !== noteKey) {
    rt.ecoNote = noteKey;
    const msg = tag === "night"
      ? "달빛이 짙어지며 사냥터에 밤 전용 [달빛정령 탈루나]가 모습을 드러냈습니다!"
      : "빗줄기를 따라 사냥터에 희귀 영물 [비구름 도글란]이 나타났습니다!";
    for (const pid of Object.keys(S.players)) {
      const p = S.players[pid];
      if (p.map === id) toast(p, msg);
    }
  }
  return mob;
}

function ecoTick(S, id, rt, now) {
  const meta = MAP_META[id];
  if (!outdoor(meta) || meta.safe || !meta.kinds || !meta.kinds.length) return;
  const night = isNight(now), rain = rt.wx === WX.rain;
  // Retire calm untargeted nocturnal or rain spirits once their time/weather passes
  for (let i = rt.mobs.length - 1; i >= 0; i--) {
    const o = rt.mobs[i];
    if (!o.eco) continue;
    if (o.dead || ((o.eco === "night" && !night) || (o.eco === "rain" && !rain)) && !o.tgt) {
      o.dead = true;
      rt.mobs.splice(i, 1);
    }
  }
  if (!rt.ecoAt) { rt.ecoAt = now + ECO_MS; return; }
  if (now < rt.ecoAt) return;
  rt.ecoAt = now + ECO_MS;
  const m = mapOfS(S, id);
  if (!m.cells) return;
  if (night) {
    const n = rt.mobs.filter((o) => !o.dead && o.k === "moonspirit").length;
    if (n < ECO_CAP) spawnEcoMob(S, id, m, rt, "moonspirit", "night", now);
  }
  if (rain) {
    const n = rt.mobs.filter((o) => !o.dead && o.k === "rainspirit").length;
    if (n < ECO_CAP) spawnEcoMob(S, id, m, rt, "rainspirit", "rain", now);
  }
}

function skyTick(S, now) {
  for (const id of Object.keys(S.maps)) {
    const rt = S.maps[id];
    rt.wx = weatherAt(id, now);
    if (rt.n <= 0) continue;
    if (id !== "town") { ecoTick(S, id, rt, now); continue; }
    const slot = nightNpc(id, now) ? Math.floor(now / TALE_MS) : -1;
    if (slot !== rt.tale) { rt.tale = slot; if (slot >= 0) rt.ev.push(["tl", slot % TALES.length]); }
  }
}

// ── 필드 모닥불 캠프 기능 강화 (WLD-05): 냄비 요리 나눔(pot), 긴급 물약 보충(supply), 장비 정비(mend), 파티원 소환(call)
const CAMP_FEAST_MS = 30 * 60000, CAMP_MEND_MS = 10 * 60000;
function campPotionsFor(lvl) { return lvl < 30 ? ["hp_s", "mp_s"] : lvl < 100 ? ["hp_m", "mp_m"] : ["hp_l", "mp_l"]; }
function campFeeFor(lvl, base) { return base * Math.max(1, toTier(lvl)); }

function campValidate(S, p, a) {
  const ch = p.ch, rt = S.maps[p.map];
  if (!a || !["pot", "supply", "mend", "call"].includes(a.a)) return { ok: false, error: "없는 야영 기능입니다" };
  if (!fireNear(rt, p)) return { ok: false, error: "모닥불 곁에서만 이용할 수 있습니다" };
  if (S.now - p.hitAt < 3000) return { ok: false, error: "전투 중에는 야영 기능을 이용할 수 없습니다" };
  if (a.a === "pot") {
    const hasFood = ch.inv.some((s) => ITEMS[s.id]?.type === "food");
    const fee = campFeeFor(ch.lvl, 80);
    if (!hasFood && ch.gold < fee) return { ok: false, error: `나눌 요리나 야영 식재료비(${fee}G)가 부족합니다` };
    return { ok: true };
  }
  if (a.a === "supply") {
    const [hpId, mpId] = campPotionsFor(ch.lvl), price = ITEMS[hpId].price;
    if (ch.gold < price) return { ok: false, error: `골드가 부족합니다 (${price}G 이상 필요)` };
    if (!canAdd(ch, hpId, 1) && !canAdd(ch, mpId, 1)) return { ok: false, error: "가방이 가득 찼습니다" };
    return { ok: true };
  }
  if (a.a === "mend") {
    const fee = campFeeFor(ch.lvl, 50);
    if (ch.gold < fee) return { ok: false, error: `정비 비용이 부족합니다 (${fee}G 필요)` };
    return { ok: true };
  }
  if (a.a === "call") {
    if (String(p.map).startsWith("dim:") || p.ab || p.cj) return { ok: false, error: "이곳에서는 파티원을 소환할 수 없습니다" };
    const pt = S.parties[p.party];
    if (!pt || pt.m.length < 2) return { ok: false, error: "소환할 파티원이 없습니다" };
    return { ok: true };
  }
  return { ok: true };
}

function campApply(S, p, a) {
  const ch = p.ch, rt = S.maps[p.map], now = S.now, fire = fireNear(rt, p);
  if (!fire) return;
  if (a.a === "pot") {
    // 냄비 요리 나눔: consumes 1 food item in bag if available, else pays camp ration gold; buffs party & fireside sitters for 30 min
    const foodSlot = ch.inv.find((s) => ITEMS[s.id]?.type === "food");
    const foodId = foodSlot ? foodSlot.id : "inn_stew";
    if (foodSlot) takeItem(ch, foodId, 1);
    else ch.gold -= campFeeFor(ch.lvl, 80);
    const targets = new Set([p]);
    for (const o of allies(S, p, 360)) if (!o.dead) targets.add(o);
    for (const oid of Object.keys(S.players)) {
      const o = S.players[oid];
      if (o.map === p.map && !o.dead && dist(o.x, o.y, fire.x, fire.y) <= FIRE_R * 1.5) targets.add(o);
    }
    for (const o of targets) {
      o.warm = Math.max(o.warm || 0, now + CAMP_FEAST_MS);
      o.warmPct = Math.max(o.warmPct || 0, 20);
      o.warmN = WARM_N;
      o.atkBuff = Math.max(o.atkBuff || 0, now + CAMP_FEAST_MS);
      o.spdBuff = Math.max(o.spdBuff || 0, now + CAMP_FEAST_MS);
      if (ITEMS[foodId]) o.food = { id: foodId, until: now + CAMP_FEAST_MS };
      const st = stats(o);
      o.hp = Math.min(st.mhp, o.hp + Math.round(st.mhp * 0.35));
      o.mp = Math.min(st.mmp, o.mp + Math.round(st.mmp * 0.35));
      o.stc = null; o.dirty = true;
      rt.ev.push(["u", o.eid, 2]);
      if (o !== p) toast(o, `${ch.name}님이 모닥불 냄비 요리를 나누었습니다! (30분간 온기 EXP+20% · 전투·식사 버프)`);
    }
    toast(p, `모닥불 냄비 요리를 나누었습니다! (${targets.size}명에게 30분간 온기 EXP+20% · 공격·이속·식사 버프 적용)`);
    saveSoon(p);
    return;
  }
  if (a.a === "supply") {
    // 긴급 물약 보충: buys up to 5 HP and 5 MP potions of the character's level tier
    const [hpId, mpId] = campPotionsFor(ch.lvl);
    let boughtHp = 0, boughtMp = 0;
    for (let i = 0; i < 5; i++) {
      if (ch.gold >= ITEMS[hpId].price && canAdd(ch, hpId, 1)) { ch.gold -= ITEMS[hpId].price; addItem(ch, hpId, 1); boughtHp++; }
      if (ch.gold >= ITEMS[mpId].price && canAdd(ch, mpId, 1)) { ch.gold -= ITEMS[mpId].price; addItem(ch, mpId, 1); boughtMp++; }
    }
    p.dirty = true;
    rt.ev.push(["u", p.eid, 1]);
    toast(p, `야영 보급품 보충 완료: ${ITEMS[hpId].name} ×${boughtHp}, ${ITEMS[mpId].name} ×${boughtMp}`);
    saveSoon(p);
    return;
  }
  if (a.a === "mend") {
    // 장비 정비 & 응급 치료: full HP/MP, cleanse ailments, 10m maintenance buff, and auto-uncurse if holding uncurse scroll
    const fee = campFeeFor(ch.lvl, 50);
    ch.gold -= fee;
    const st = stats(p);
    p.hp = st.mhp; p.mp = st.mmp;
    p.burn = null; p.poison = null; p.slowed = 0; elementClear(p);
    p.atkBuff = Math.max(p.atkBuff || 0, now + CAMP_MEND_MS);
    let uncursed = 0;
    for (const k of SLOTS) {
      const g = ch.eq[k];
      if (g && g.cu === 1 && countItem(ch, "uncurse") >= 1) { takeItem(ch, "uncurse", 1); g.cu = 2; uncursed++; }
    }
    p.stc = null; p.dirty = true;
    rt.ev.push(["e", p.eid, uncursed ? 2 : 1]);
    toast(p, `모닥불 장비 정비 완료! 체력·마력 회복 및 10분간 무기 정비 버프가 적용되었습니다.${uncursed ? ` (장비 저주 ${uncursed}개 해제)` : ""}`);
    saveSoon(p);
    return;
  }
  if (a.a === "call") {
    // 파티원 소환: brings eligible party members to the campfire
    const pt = S.parties[p.party], m = mapOfS(S, p.map);
    if (!pt) return;
    let called = 0;
    for (const oid of pt.m) {
      if (oid === p.pid) continue;
      const o = S.players[oid];
      if (!o || o.dead || String(o.map).startsWith("dim:") || o.ab || o.cj || now - o.hitAt < 3000) continue;
      if (mapLevelNeed(o.ch, p.map) || airshipAccess(o.ch, p.map)) continue;
      if (o.map !== p.map) {
        S.maps[o.map].n--;
        o.map = p.map; o.ch.map = p.map;
        rt.n++; rt.who = true;
        o.sendMap = true;
      }
      o.x = o.ch.x = fire.x;
      o.y = o.ch.y = clamp(fire.y + 12, 16, m.h * T - 16);
      o.fix = true; o.sit = false; o.dirty = true;
      if (!o.ch.seen.includes(p.map)) o.ch.seen.push(p.map);
      rt.ev.push(["wp", o.eid, 1]);
      toast(o, `${ch.name}님이 [${m.name}] 모닥불 앞으로 파티원을 소환했습니다!`);
      called++;
    }
    if (called > 0) {
      rt.ev.push(["wp", p.eid, 1]);
      toast(p, `파티원 ${called}명을 모닥불 앞으로 소환했습니다!`);
    } else toast(p, "지금 소환할 수 있는 파티원이 없습니다 (전투 중·던전·레벨 제한 제외).");
  }
}

/**
 * The sky over a map at a moment, for the tests and the tools: the hour, the phase, the
 * weather, whether the storyteller is out and which tale she tells, the camps, and the active special ecology.
 */
export function skyAt(map, now) {
  const ph = dayPhase(now), m = mapOf(map), wx = weatherAt(map, now), out = outdoor(m);
  const eco = out && !m?.safe ? (ph === PH_NIGHT ? "moonspirit" : wx === WX.rain ? "rainspirit" : null) : null;
  return { hour: dayHour(now), phase: ph, name: PHASES[ph][0], night: ph === PH_NIGHT, outdoor: out, wx, eco, npc: nightNpc(map, now), tale: map === "town" ? taleAt(now) : -1, camps: m ? campsOf(m) : [] };
}
