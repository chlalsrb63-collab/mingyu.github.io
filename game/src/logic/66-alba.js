// ───────────────────────────── 일일 아르바이트: the solo mini-game shift engine ─────────────────────────────
// docs/design/daily-alba-minigames-2026-11-16.md. A shift is `p.ab` (never saved): a seeded mini-game run on the SERVER for ~4 minutes,
// shown in its own client window (public/alba.js + public/alba_<k>.js). The client only sends inputs (`ab_act`); the rules, the clock,
// the score and the grade live here. One game = one part file `67-alba-<k>.js` that fills two tables:
//   ALBA[k]       = { name, npc, place, skill, par, mul, outfit: [cosmetic ids], tool, hint }          (static; goes to defs.alba.rows)
//   ALBA_RULES[k] = { init(S, p, ab), adv(S, p, ab, now), act(S, p, ab, a, now) → error string | null, view(ab, now) → JSON }
// and its key sits in ALBA_ORDER. Rules of the road for a game:
//   · state lives in `ab.g` (plain data); randomness only through `rnd(ab.box)` / `ri(ab.box, a, b)` (no host randomness, no clock reads);
//   · `adv` brings the game to `now` lazily (called every tick and before every action): events whose time passed are applied in
//     order with their own timestamps; keep it O(small) — it runs 10×/s per player;
//   · `act` gets the raw client object `a` ({t:"ab_act", ...}): validate every field (Number.isInteger, ranges); return a short reason
//     on refusal (the client is resynced, nothing is shown), or null after applying; change `ab.rev` through `albaTouch(ab)`;
//   · points go through `albaGood(ab, now, base)` (combo, fever and the last-30-s rush multiply it) and `albaBad(ab, pen)` (combo
//     broken, `pen` taken off); never touch `ab.score` directly;
//   · `view(ab, now)` is the full state for the client, sent only when `ab.rev` changed; every time in it is MILLISECONDS FROM NOW
//     (`t - now`), the client rebuilds absolute times from its own clock.

const ALBA = {};
const ALBA_RULES = {};
/** The window's order (a game whose part is missing is skipped). More games are appended here. */
const ALBA_ORDER = ["pipe", "fly", "store", "parcel", "laundry", "taiyaki",
  "pest", "wall", "cross", "lamp", "rhythm", "garland"];
const ALBA_T = {
  briefMs: 6000, runMs: 240000, resultMs: 90000, rushMs: 30000, actMs: 35,
  feverMs: 15000, feverMax: 2, feverEvery: 10,   // a fever at combo 10 and 20 (at most two per shift)
  cuts: [0.40, 0.65, 0.85, 1.0],                  // share of the game's par for C B A S
  gradeK: [0.7, 1.0, 1.3, 1.7],                   // pay multiplier per grade
  rep: [1, 2, 2, 3], stone: [0, 0, 1, 2], life: 0.5,
};
/** What a hero may still do on a shift (everything else is refused until it ends). */
const ALBA_OK = new Set(["nw", "opt", "chat", "pchat", "gchat", "emo", "respawn"]);

// ── saved: today's pay and the best scores (`ch.ab`; no sheet version bump, a missing one starts fresh in `migrate`)
const albaFresh = () => ({ day: 0, done: {}, best: {} });
function albaClean(a) {
  const o = albaFresh();
  if (!isObj(a)) return o;
  o.day = Number.isSafeInteger(a.day) ? Math.max(0, a.day) : 0;
  for (const k of Object.keys(ALBA)) {
    if (isObj(a.done) && Number.isInteger(a.done[k])) o.done[k] = clamp(a.done[k], 0, 4);
    if (isObj(a.best) && Number.isFinite(a.best[k])) o.best[k] = Math.max(0, Math.round(a.best[k]));
  }
  return o;
}
/** Today's record (a new day starts it empty). */
function albaToday(p) {
  const ch = p.ch, day = dayOf(p.S.now);
  if (!isObj(ch.ab)) ch.ab = albaFresh();
  if (ch.ab.day !== day) { ch.ab.day = day; ch.ab.done = {}; }
  return ch.ab;
}
const albaPaid = (p) => Object.keys(albaToday(p).done).length;
function albaSelf(p) {
  const a = albaToday(p);
  return [a.done, a.best, Math.max(0, JB_PAY.perDay - Object.keys(a.done).length)];
}

// ── the points
const albaTouch = (ab) => { ab.rev++; };
const albaMult = (ab, now) => (1 + 0.1 * Math.min(ab.combo, 10)) * (now < ab.feverUntil ? 2 : 1) * (now >= ab.endAt - ALBA_T.rushMs ? 1.5 : 1);
/** A good move worth `base` points: combo up, fever when the combo reaches 10 / 20. Returns the points added. */
function albaGood(ab, now, base) {
  const pts = Math.round(base * albaMult(ab, now));
  ab.score += pts;
  ab.combo++;
  ab.maxCombo = Math.max(ab.maxCombo, ab.combo);
  if (ab.combo >= ab.nextFever && ab.feverUsed < ALBA_T.feverMax) {
    ab.feverUntil = now + ALBA_T.feverMs;
    ab.feverUsed++;
    ab.nextFever += ALBA_T.feverEvery;
  }
  ab.rev++;
  return pts;
}
/** A slip: the combo is broken and `pen` points are lost (never below 0). */
function albaBad(ab, pen = 0) {
  ab.combo = 0;
  ab.nextFever = Math.max(ab.nextFever, ALBA_T.feverEvery);
  ab.score = Math.max(0, ab.score - Math.round(pen));
  ab.rev++;
}

// ── a shift's life
function albaStart(S, p, k) {
  const now = S.now, R = ALBA_RULES[k];
  const ab = {
    k, box: { seed: strHash(`${p.ch.name}:${now}:${k}`) | 0 }, t0: now, runAt: now + ALBA_T.briefMs, endAt: now + ALBA_T.briefMs + ALBA_T.runMs,
    state: "run", score: 0, combo: 0, maxCombo: 0, nextFever: ALBA_T.feverEvery, feverUntil: 0, feverUsed: 0, lastAct: 0, rev: 1, g: null, res: null,
  };
  R.init(S, p, ab);
  p.ab = ab; p.abSeen = 0;
  p.ghost = ab.endAt + ALBA_T.resultMs + 1000;   // nothing can hurt a hero at the counter
  p.sit = false;
  p.dirty = true;
}
function albaClear(S, p) {
  if (!p.ab) return;
  p.ab = null; p.abSeen = 0; p.ghost = 0;
  p.dirty = true;
}
/** The grade for a score: 0 below C, 1 C · 2 B · 3 A · 4 S. */
function albaGrade(k, score) {
  let g = 0;
  while (g < 4 && score >= Math.round(ALBA[k].par * ALBA_T.cuts[g])) g++;
  return g;
}
/** Pay a finished shift: 0 no grade · 1 paid · 2 already paid today · 3 today's pay slots are used. */
function albaPay(S, p, ab, g) {
  const ch = p.ch, a = albaToday(p), k = ab.k, J = ALBA[k];
  a.best[k] = Math.max(a.best[k] || 0, Math.round(ab.score));
  if (!g) return 0;
  if (Object.hasOwn(a.done, k)) return 2;
  if (Object.keys(a.done).length >= JB_PAY.perDay) return 3;
  a.done[k] = g;
  const Tt = Math.max(1, Math.floor(toTier(ch.lvl))), kk = ALBA_T.gradeK[g - 1] * (J.mul || 1);
  const gold = Math.round((JB_PAY.gold[0] + JB_PAY.gold[1] * Tt) * kk * (repOf(ch, J.npc) >= REP_TIER[0] ? REP_TIP : 1));
  ch.gold += gold;
  p.gain.push(["gold", gold]);
  gainXp(S, p, Math.round(tierXp(Tt) * JB_PAY.xp * kk));
  gainLife(S, p, J.skill, lifeNeed(ch.life[J.skill].lv) * ALBA_T.life * kk);
  addRep(S, p, J.npc, ALBA_T.rep[g - 1]);
  const stone = ALBA_T.stone[g - 1];
  if (stone && addItem(ch, "stone", stone)) p.gain.push(["item", "stone", stone, 0]);
  const tokens = gainWillowToken(p, 1);
  toast(p, `[${J.name}] ${"CBAS"[g - 1]} 등급! 보수 ${gold.toLocaleString()}G${tokens ? ` · 버드나무토큰 +${tokens}` : ""}`);
  p.dirty = true;
  return 1;
}
function albaFinish(S, p, ab) {
  if (ab.state === "end") return;
  ab.state = "end";
  const g = albaGrade(ab.k, ab.score), code = albaPay(S, p, ab, g);
  if (code === 2) toast(p, "오늘 이 알바의 보수는 이미 받았어요. 기록 연습으로 끝났습니다.");
  else if (code === 3) toast(p, `오늘 받을 수 있는 알바 보수 ${JB_PAY.perDay}번을 모두 받았어요.`);
  else if (!g) toast(p, "C 등급에 닿지 못했어요. 오늘 다시 도전할 수 있어요.");
  // [grade, score, par, best, pay code, max combo, cut-offs]
  ab.res = [g, Math.round(ab.score), ALBA[ab.k].par, albaToday(p).best[ab.k] || 0, code, ab.maxCombo, ALBA_T.cuts.map((c) => Math.round(ALBA[ab.k].par * c))];
  ab.rev++;
}
/** Bring a shift to `now`: the game's own clock, then the end (and the result's timeout). */
function albaAdvance(S, p, ab, now) {
  if (ab.state === "run" && now >= ab.runAt) {
    ALBA_RULES[ab.k].adv(S, p, ab, Math.min(now, ab.endAt));
    if (now >= ab.endAt) albaFinish(S, p, ab);
  } else if (ab.state === "end" && now >= ab.endAt + ALBA_T.resultMs) albaClear(S, p);
}
/** Every tick: the clocks of the shifts under way (cheap: only heroes with a shift). */
function albaTick(S, now) {
  for (const pid of Object.keys(S.players)) {
    const p = S.players[pid];
    if (p.ab) albaAdvance(S, p, p.ab, now);
  }
}

// ── the actions: ab_start {k} · ab_act {…the game's inputs} · ab_leave (give up) · ab_close (leave the result)
function albaValidate(S, p, a) {
  if (a.t === "ab_start") {
    if (typeof a.k !== "string" || !Object.hasOwn(ALBA, a.k)) return bad("알 수 없는 아르바이트입니다");
    if (p.ab) return bad("이미 아르바이트 중입니다");
    if (p.dead) return bad("지금은 일할 수 없습니다");
    if (inDim(p) || Object.hasOwn(DENSITY, p.map)) return bad("아르바이트는 마을에서 시작할 수 있습니다");
    return OK;
  }
  if (!p.ab) return bad("진행 중인 아르바이트가 없습니다");
  return OK;
}
function albaApply(S, p, a) {
  const now = S.now;
  if (a.t === "ab_start") { albaStart(S, p, a.k); return; }
  const ab = p.ab;
  if (!ab) return;
  if (a.t === "ab_leave" || (a.t === "ab_close" && ab.state !== "end")) { toast(p, "아르바이트를 그만두었습니다. 보수는 없습니다."); albaClear(S, p); return; }
  if (a.t === "ab_close") { albaClear(S, p); return; }
  albaAdvance(S, p, ab, now);
  if (ab.state !== "run" || now < ab.runAt || now - ab.lastAct < ALBA_T.actMs) return;
  ab.lastAct = now;
  if (ALBA_RULES[ab.k].act(S, p, ab, a, now)) albaTouch(ab);   // a refused input resyncs the client's board
}

// ── the wire: `ab: [k, ended, ms to start, ms to end, score, combo, fever ms left, game state | 0 (unchanged), result | 0, rev]`
function albaView(S, p, out) {
  const ab = p.ab, now = S.now;
  if (!ab) return;
  out.ab = [ab.k, ab.state === "end" ? 1 : 0, Math.max(0, ab.runAt - now), Math.max(0, ab.endAt - now), Math.round(ab.score), ab.combo, Math.max(0, ab.feverUntil - now),
    p.abSeen === ab.rev ? 0 : ALBA_RULES[ab.k].view(ab, now), ab.res || 0, ab.rev];
  p.abSeen = ab.rev;
}
function albaDefs() {
  const rows = {};
  for (const k of ALBA_ORDER) {
    const r = ALBA[k];
    if (!r) continue;
    rows[k] = { name: r.name, npc: r.npc, place: r.place, skill: r.skill, par: r.par, hint: r.hint, outfit: r.outfit, tool: r.tool };
  }
  return { order: ALBA_ORDER.filter((k) => ALBA[k]), rows, runMs: ALBA_T.runMs, briefMs: ALBA_T.briefMs, cuts: ALBA_T.cuts, gradeK: ALBA_T.gradeK, perDay: JB_PAY.perDay, feverMs: ALBA_T.feverMs, rushMs: ALBA_T.rushMs, field: Object.keys(DENSITY) };
}
