// ───────────────────────────── social, the weekly book, enhancement pity (sheet v14)
// docs/design/social-weekly.md. Three small systems that share one sheet bump:
//   · 차단 and 귓속말 — the block list lives on the sheet (`ch.blk`) so the rules can drop a blocked
//     name's chat, whispers and invitations; a whisper is a chat line with one reader (`to`).
//     Friends are NOT here: they live in the vault (src/social.js), the room relays them.
//   · 주간 수첩 — twelve boxes, any seven finish the week (`ch.wk`); most boxes read the achievement
//     counters against a baseline taken when the week opened, so they need no hook of their own.
//     A day without a claim leaves a rest bonus on the next day's daily tasks (`ch.daily.rest`).
//   · 강화 보정 — failures at +5 and above fill `ch.pity`, one gauge per step; a full gauge makes the
//     next try at that step certain.

// ── 차단 · 귓속말
const BLOCK_MAX = 50, FRIEND_MAX = 50, WHISPER_LEN = 80;
const lowName = (v) => String(v).toLowerCase();
/** Has this sheet blocked that name? (names are unique without regard to case) */
const blocked = (ch, name) => { const k = lowName(name); return ch.blk.some((n) => lowName(n) === k); };
function playerByName(S, name) {
  const k = lowName(name);
  for (const pid in S.players) if (lowName(S.players[pid].ch.name) === k) return S.players[pid];
  return null;
}
/**
 * Item links on a chat line (Shift+click in the bag): `it` = [[bag slot, item id]…], at most CHAT_LINKS, each still
 * that item in the sender's bag when the line is sent. The bag entries themselves, or null when any is not.
 */
const CHAT_LINKS = 2;
function chatLinks(ch, it) {
  if (it === undefined) return [];
  if (!Array.isArray(it) || it.length > CHAT_LINKS) return null;
  const out = [];
  for (const r of it) {
    if (!Array.isArray(r) || !Number.isInteger(r[0]) || typeof r[1] !== "string") return null;
    const e = ch.inv[r[0]];
    if (!e || e.id !== r[1]) return null;
    out.push(e);
  }
  return out;
}
/** A chat line `{n, m}` plus copies of its linked items (`it`, as the bag holds them: the reader's tooltip shows them). */
function chatLine(ch, m, a, extra) {
  const it = chatLinks(ch, a.it) || [];
  return { n: ch.name, m, ...extra, ...(it.length ? { it: it.map((e) => JSON.parse(JSON.stringify(e))) } : {}) };
}
/** The chat lines one player may read: guild and party lines of their own, whispers addressed to them, nothing from a blocked name. */
function chatFor(S, p, pid) {
  const out = [];
  for (const c of S.chat) {
    if (c.g && c.g !== p.ch.guild) continue;
    if (c.pt && c.pt !== p.party) continue;
    if (c.to !== undefined && c.to !== pid) continue;
    if (c.n && !c.sys && c.w !== 2 && p.ch.blk.length && blocked(p.ch, c.n)) continue;
    out.push(c.to !== undefined ? (c.sys ? { sys: 1, m: c.m } : { n: c.n, m: c.m, w: c.w, ...(c.it ? { it: c.it } : {}) }) : c);
  }
  return out;
}
/** Copies of the bag entries a whisper links (`it` as chatLinks takes it; [] when none or not in the bag). */
export function whisperItems(S, pid, it) {
  const p = S.players[pid];
  return ((p && chatLinks(p.ch, it)) || []).map((e) => JSON.parse(JSON.stringify(e)));
}
/** Linked items on a whisper line, as `{it}` to spread in: at most CHAT_LINKS known items (they may come from another channel). */
function whisperIt(items) {
  if (!Array.isArray(items)) return {};
  const it = items.slice(0, CHAT_LINKS).filter((e) => e && typeof e === "object" && typeof e.id === "string" && ITEMS[e.id]);
  return it.length ? { it: JSON.parse(JSON.stringify(it)) } : {};
}
/** The sender's own copy of a whisper (`w: 2`, `n` = who it went to; `items`: whisperItems). */
export function whisperOut(S, pid, toName, text, items) {
  const p = S.players[pid];
  if (!p) return false;
  p.chatAt = S.now;
  S.chat.push({ n: String(toName), m: String(text).trim().slice(0, WHISPER_LEN), w: 2, to: pid, ...whisperIt(items) });
  return true;
}
/**
 * A whisper arriving for a player of this world (`w: 1`, `n` = the sender). False when nobody of that
 * name is here; true when it was delivered OR quietly dropped by the reader's block list — the sender
 * is never told which.
 */
export function whisperIn(S, toName, fromName, text, items) {
  const o = playerByName(S, toName);
  if (!o) return false;
  if (!blocked(o.ch, fromName)) S.chat.push({ n: String(fromName), m: String(text).trim().slice(0, WHISPER_LEN), w: 1, to: o.pid, ...whisperIt(items) });
  return true;
}
/** The pid of the player of that name in this world, or null (the room finds a socket with it). */
export function pidOfName(S, name) {
  const o = typeof name === "string" ? playerByName(S, name) : null;
  return o ? o.pid : null;
}
/** A character's name by pid, "" when they are not in this world. */
export function nameOf(S, pid) {
  return S.players[pid] ? S.players[pid].ch.name : "";
}
/** Has the player blocked that name? (the room asks before it sends a friend request for them) */
export function blockedBy(S, pid, name) {
  return !!S.players[pid] && typeof name === "string" && blocked(S.players[pid].ch, name);
}
/** A line for one player from outside the rules (a friend request arrived…); false when they are not here. */
export function noteTo(S, pid, text) {
  const p = S.players[pid];
  if (!p) return false;
  toast(p, String(text).slice(0, 80));
  return true;
}

// ── 주간 수첩
const WEEK = {
  need: 7, tiers: [3, 5, 7], restMax: 3, restPct: 20,
  /** [id, text, need] — `hunt` and `fish` are counted here, the rest are counter deltas (weekRaw). */
  boxes: [
    ["hunt", "제 수준 사냥터의 몬스터 {need}마리 처치", 150],
    ["elite", "정예 몬스터 {need}마리 처치", 8],
    ["fb", "사냥터 우두머리 {need}마리 처치", 1],
    ["rift", "균열 {need}번 닫기 (레이드던전)", 1],
    ["gather", "채집 {need}번 하기", 25],
    ["craft", "제작대 · 연금 솥 · 화덕에서 {need}번 만들기", 6],
    ["cook", "요리 {need}번 성공하기", 5],
    ["fish", "물고기 {need}마리 낚기", 12],
    ["job", "알바 배달 {need}번 마치기", 2],
    ["party", "파티로 몬스터 {need}마리 처치", 40],
    ["side", "의뢰 {need}번 마치기 (곁가지 · 반복)", 2],
    ["rest", "모닥불의 온기 {need}번 받기", 3],
  ],
};
/** Weeks turn on Monday 06:00 KST (day 0 of `dayOf` is a Thursday, so day 4 is the first Monday). */
const weekOf = (now) => Math.floor((dayOf(now) + 3) / 7);
const nextWeek = (now) => (weekOf(now) * 7 - 3 + 7) * DAY_MS - KST + RESET_AT;
/** Counters that only ever grow; a box's progress is its counter now minus its value when the week opened. */
function weekRaw(ch) {
  const c = ch.cnt;
  let side = ch.bn | 0;
  for (const id in ch.sq.done) side += ch.sq.done[id] | 0;
  return { elite: c.elite, fb: c.fb, rift: c.dim, gather: c.gat, craft: c.craft, cook: c.cook, job: c.deliver, party: c.party, side, rest: c.rest };
}
const weekFresh = (ch, w) => ({ w, n: { hunt: 0, fish: 0 }, b: weekRaw(ch), got: [0, 0, 0], seen: 0 });
/** Progress of the twelve boxes, each 0..need. */
function weekVals(ch) {
  const wk = ch.wk, raw = weekRaw(ch);
  return WEEK.boxes.map(([id, , need]) => clamp(id in wk.n ? wk.n[id] : raw[id] - (wk.b[id] | 0), 0, need));
}
const weekDone = (ch) => weekVals(ch).reduce((n, v, i) => n + (v >= WEEK.boxes[i][2] ? 1 : 0), 0);
function weekReward(ch, i) {
  const tr = rewardTier(ch);
  return [
    { gold: Math.round(300 + 80 * tr), xp: Math.round(tierXp(tr) * 0.3), stone: 3 },
    { gold: Math.round(500 + 120 * tr), xp: Math.round(tierXp(tr) * 0.5), stone: 5, rune: 1 },
    { gold: Math.round(900 + 200 * tr), xp: Math.round(tierXp(tr) * 0.8), stone: 8, bless: 1, gear: 1, gearQ: 3, cos: 1 },
  ][i];
}
/** Open this week's book if the sheet still holds last week's; tell the player what was just finished. Called once a second (ensureDaily). */
function weekTick(S, p) {
  const ch = p.ch, w = weekOf(S.now);
  if (ch.wk.w !== w) {
    const had = ch.wk.w > 0;
    ch.wk = weekFresh(ch, w);
    p.dirty = true;
    if (had) toast(p, "주간 수첩의 새 장이 펼쳐졌습니다.");
  }
  let bits = 0;
  weekVals(ch).forEach((v, i) => { if (v >= WEEK.boxes[i][2]) bits |= 1 << i; });
  if (bits === ch.wk.seen) return;
  const before = bitCount(ch.wk.seen), n = bitCount(bits);
  ch.wk.seen = bits;
  p.dirty = true;
  if (n <= before) return;
  toast(p, WEEK.tiers.includes(n) && !ch.wk.got[WEEK.tiers.indexOf(n)] ? `주간 수첩 ${n}칸 완료 — 보상을 받으세요.` : `주간 수첩 ${n}/${WEEK.need}칸 완료`);
}
function bitCount(v) { let n = 0; for (let x = v >>> 0; x; x >>>= 1) n += x & 1; return n; }
/** The two boxes with counters of their own, fed from dailyProg (60-content.js). */
function weekProg(S, p, kind, k) {
  const ch = p.ch;
  if (ch.wk.w !== weekOf(S.now)) weekTick(S, p);
  if (kind === "kill" && MOBS[k] && MOBS[k].lv >= toTier(ch.lvl) - 3) { ch.wk.n.hunt++; p.dirty = true; }
  else if (kind === "fish") { ch.wk.n.fish++; p.dirty = true; }
}
function weekView(p) {
  const ch = p.ch, vals = weekVals(ch), now = p.S.now;
  const done = vals.reduce((n, v, i) => n + (v >= WEEK.boxes[i][2] ? 1 : 0), 0);
  return {
    v: vals, done, got: ch.wk.got, reset: Math.max(0, nextWeek(now) - now),
    rw: WEEK.tiers.map((_, i) => weekReward(ch, i)), rest: ch.daily ? ch.daily.rest | 0 : 0,
  };
}

// ── 쉬고 온 보너스 (rest bonus on the daily tasks)
/** Days of rest carried into a new day's tasks: +1 for each day with nothing claimed, at most WEEK.restMax. */
function restCarry(prev, day) {
  if (!prev) return 0;
  const idle = !prev.bonus && !prev.claimed.some(Boolean);
  return clamp((idle ? (prev.rest | 0) + 1 : 0) + Math.max(0, day - prev.day - 1), 0, WEEK.restMax);
}
/** The multiplier on today's daily gold and experience. */
const restK = (ch) => 1 + (WEEK.restPct / 100) * (ch.daily ? clamp(ch.daily.rest | 0, 0, WEEK.restMax) : 0);

// ── 강화 보정
/**
 * `need[i]` failures at step +(from + i) make the next try at that step certain; balance here. The gauges
 * belong to the character, not to a piece of gear, and there is one per step: failures at +5 cannot be
 * saved up for +9 (a sure +9 is worth some 260 tries, a sure +5 three). A failure weighs the tier of the
 * gear it happened on and a sure try needs `need` × the tier of the gear in hand, so cheap gear cannot
 * fill the gauge for dear gear.
 */
const PITY = { from: 5, need: [10, 12, 16, 20, 26] };
const pityNeed = (g) => PITY.need[g.enh - PITY.from] * ITEMS[g.id].tier;
/**
 * One enhancement roll. The dice are thrown every time (the world's stream stays what it was); a full
 * gauge makes the try certain and is spent by it, a failure from +5 fills the gauge of its step.
 */
function enhWin(S, ch, g, bless) {
  const roll = rnd(S) * 100, i = g.enh - PITY.from;
  if (i >= 0 && ch.pity[i] >= pityNeed(g)) { ch.pity[i] = 0; return true; }
  const win = roll < ENH_RATE[g.enh] + (bless ? ENH_BLESS : 0) + (g.cu === 2 ? ENH_UNCURSE : 0);
  if (!win && i >= 0) ch.pity[i] = Math.min(PITY_CAP, ch.pity[i] + ITEMS[g.id].tier);
  return win;
}
const PITY_CAP = 9999;
const pityFresh = () => PITY.need.map(() => 0);

// ── the sheet (v14)
const socialFresh = () => ({ blk: [], pity: pityFresh(), wk: { w: 0, n: { hunt: 0, fish: 0 }, b: {}, got: [0, 0, 0], seen: 0 } });
/** migrate(): `rawDaily` is the daily record as it was saved (its `rest` is not part of the older shape). */
function socialSheetClean(ch, rawDaily) {
  const seen = new Set();
  ch.blk = (Array.isArray(ch.blk) ? ch.blk : []).filter((n) => validName(n) && !seen.has(lowName(n)) && seen.add(lowName(n))).slice(0, BLOCK_MAX);
  ch.pity = pityFresh().map((_, i) => clamp(Array.isArray(ch.pity) && num(ch.pity[i]) ? Math.floor(ch.pity[i]) : 0, 0, PITY_CAP));
  const wk = isObj(ch.wk) ? ch.wk : {}, n = isObj(wk.n) ? wk.n : {}, b = isObj(wk.b) ? wk.b : {};
  const raw = weekRaw(ch), base = {};
  // a baseline can never sit above the counter it was taken from
  for (const k in raw) base[k] = clamp(b[k] | 0, 0, raw[k]);
  ch.wk = {
    w: Math.max(0, wk.w | 0), n: { hunt: Math.max(0, n.hunt | 0), fish: Math.max(0, n.fish | 0) }, b: base,
    got: [0, 1, 2].map((i) => (Array.isArray(wk.got) && wk.got[i] ? 1 : 0)), seen: (wk.seen | 0) & 0xfff,
  };
  if (ch.daily) ch.daily.rest = clamp(isObj(rawDaily) ? rawDaily.rest | 0 : 0, 0, WEEK.restMax);
}

// ── actions: blk {a: "add"|"del", name} · w {to, m} · wk {i}
function socialValidate(S, p, a) {
  const ch = p.ch;
  switch (a.t) {
    case "blk": {
      if (!validName(a.name)) return bad("이름을 다시 확인해 주세요");
      if (a.a === "del") return blocked(ch, a.name) ? OK : bad("차단한 적이 없는 이름입니다");
      if (a.a !== "add") return bad("잘못된 요청입니다");
      if (lowName(a.name) === lowName(ch.name)) return bad("자신은 차단할 수 없습니다");
      if (blocked(ch, a.name)) return bad("이미 차단한 이름입니다");
      if (ch.blk.length >= BLOCK_MAX) return bad(`차단은 ${BLOCK_MAX}명까지 할 수 있습니다`);
      return OK;
    }
    case "w": {
      if (!validName(a.to)) return bad("귓속말 상대의 이름을 다시 확인해 주세요");
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (lowName(a.to) === lowName(ch.name)) return bad("자신에게는 귓속말을 보낼 수 없습니다");
      if (blocked(ch, a.to)) return bad("차단한 상대입니다. 차단을 풀고 보내 주세요");
      if (S.now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      if (!chatLinks(ch, a.it)) return bad("링크한 물건이 가방에 없습니다");
      return OK;
    }
    case "wk": {
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= WEEK.tiers.length) return bad("잘못된 요청입니다");
      weekTick(S, p);
      if (ch.wk.got[a.i]) return bad("이미 받은 보상입니다");
      if (weekDone(ch) < WEEK.tiers[a.i]) return bad(`수첩을 ${WEEK.tiers[a.i]}칸 채워야 받을 수 있습니다`);
      return OK;
    }
  }
  return bad("잘못된 요청입니다");
}
function socialApply(S, p, a) {
  const ch = p.ch;
  switch (a.t) {
    case "blk": {
      if (a.a === "del") {
        const k = lowName(a.name);
        ch.blk = ch.blk.filter((n) => lowName(n) !== k);
        toast(p, `${a.name}님의 차단을 풀었습니다.`);
      } else {
        const o = playerByName(S, a.name);
        ch.blk.push(o ? o.ch.name : a.name);
        // an invitation from them that was waiting goes with it
        if (o && p.pinv && p.pinv.from === o.pid) p.pinv = null;
        if (o && p.ginv && p.ginv.from === o.pid) p.ginv = null;
        toast(p, `${a.name}님을 차단했습니다. 채팅 · 귓속말 · 초대가 오지 않습니다.`);
      }
      p.dirty = true;
      break;
    }
    case "w": {
      // one room: the reader is here or nowhere (the room relays to the other channel before it asks this)
      const it = whisperItems(S, p.pid, a.it);
      if (whisperIn(S, a.to, ch.name, a.m, it)) whisperOut(S, p.pid, playerByName(S, a.to).ch.name, a.m, it);
      else toast(p, `${a.to}님은 접속 중이 아닙니다.`);
      break;
    }
    case "wk": {
      const r = weekReward(ch, a.i);
      ch.wk.got[a.i] = 1;
      payout(S, p, r);
      if (r.bless && addItem(ch, "stone_b", r.bless)) p.gain.push(["item", "stone_b", r.bless, 0]);
      if (r.cos) cosFrom(S, p, "daily", "주간 수첩");
      toast(p, `주간 수첩 ${WEEK.tiers[a.i]}칸 보상을 받았습니다.`);
      break;
    }
  }
}

// ── wire
/** selfPayload: the block list, the pity gauge, the weekly book. */
const socialSelf = (p) => ({ blk: p.ch.blk, pity: p.ch.pity, week: weekView(p) });
/** defs(): what the client draws these with. */
const socialDefs = () => ({
  pity: PITY, blockMax: BLOCK_MAX, friendMax: FRIEND_MAX, whisperLen: WHISPER_LEN,
  week: { need: WEEK.need, tiers: WEEK.tiers, restPct: WEEK.restPct, restMax: WEEK.restMax, boxes: WEEK.boxes.map(([id, text, need]) => [id, text.replace("{need}", need), need]) },
});
