// 일일 아르바이트 · 여관 공연 (docs/design/daily-alba-minigames-2026-11-16.md §9.5): a 4-lane falling-note rhythm game. Contract: 66-alba.js.
// The whole song is a seeded PATTERN SCHEDULE rolled at `init` (what the player presses never changes it): notes in time order, each
// { t: ms from the run start, l: lane 0..3, h: hold ms (0 = a tap), s: 0 waiting · 1 hit · 2 missed · 3 held (head hit, the tail is pending) }.
// A press is judged against the note's ABSOLUTE time: press time = server receipt − RHY.lat (a fixed latency allowance). Perfect ±45 ms (20 points),
// Good ±100 ms (10), ×1.5 wider while the fever "앙코르" lasts. A note whose Good window passed unhit is a Miss (albaBad 10), applied by `adv` in time order.
// A press that hits nothing is a stray: ignored, no penalty; 5 strays within 2 s are "mashing" and every press is ignored for 1.5 s.
// A hold note: hit its head, keep the key down, let go at its end (±RHY.tailOk early is fine; later is fine too — a press still down when the tail
// is over counts as held). Letting go early breaks the hold (a Miss). ab.g = { N, Q: per lane its note ids in time order, P: per lane the first
// id still waiting, H: first id still waiting overall, hold: per lane the held note id | -1, lock, stray: times of the last strays, sent: how far
// ahead the last view announced (ms from the run start), last: the final note's end, seq, ev: [[seq, lane, kind]…], cnt: [perfect, good, miss] }.
// Inputs: {l: 0..3} or {m: 1..15 (lane bits)} presses; with up: 1 the same releases (a hold's tail). One message may carry a chord (m).
// view = [notes flat [id, lane, ms from now (t − now), hold ms, held 0|1 …], judgements flat [seq, lane, kind …] (kind 0 miss · 1 good · 2 perfect ·
//         3 hold done · 4 hold broken, the last RHY.ring), bpm, [perfect, good, miss]]; the notes are the waiting / held ones within RHY.ahead ms.
const RHY = {
  ahead: 4000, refresh: 2500, lat: 40, perf: 45, good: 100, wide: 1.5, tailOk: 120, tailEnd: 150, lead: 2000, tail: 1500, sameLane: 240,
  perSec: 7, strayN: 5, strayMs: 2000, lockMs: 1500, missPen: 10, pts: [10, 20], holdPts: 10, ring: 8, bpm: [100, 140],
  quarterTo: 40000, holdFrom: 50000, chordFrom: 60000, tripleFrom: 180000,
};
Object.assign(ALBA, { rhythm: { name: "여관 공연", npc: "inn_lira", place: "여관 무대", skill: "cook", par: 21500, mul: 1.05, outfit: ["hat_beret", "top_vest"], tool: "lute", hint: "내려오는 음표를 박자에 맞춰 D F J K (← ↓ ↑ →) 또는 터치로 연주하세요. 긴 음표는 끝까지 누르세요!" } });

const rhyBpm = (t) => RHY.bpm[0] + (RHY.bpm[1] - RHY.bpm[0]) * clamp(t / ALBA_T.runMs, 0, 1);
/** Fever widens every window ×1.5. */
const rhyW = (ab, T) => (T < ab.feverUntil ? RHY.wide : 1);

/** Pick `k` distinct lanes among `ok`: no same lane twice running, the hands (lanes 0-1 / 2-3) take turns. */
function rhyLanes(box, ok, prev, k) {
  const out = [];
  while (out.length < k && ok.length) {
    const w = ok.map((l) => (l === prev ? 0.25 : 1) * (prev >= 0 && (l >> 1) !== (prev >> 1) ? 1.6 : 1) * (out.length && (l >> 1) === (out[0] >> 1) ? 0.4 : 1));
    let r = rnd(box) * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < ok.length - 1 && r >= w[i]) r -= w[i++];
    out.push(ok[i]); ok.splice(i, 1);
  }
  return out;
}
/** Roll the whole song: quarter notes first, then eighths on a half-filled grid; chords from 60 s, a few holds from 50 s, triples only in the last minute. */
function rhyBuild(box) {
  const T = ALBA_T.runMs, notes = [], free = [0, 0, 0, 0], hEnd = [0, 0, 0, 0];
  let t = RHY.lead, prev = -1;
  while (t < T - RHY.tail) {
    const u = t / T, beat = 60000 / rhyBpm(t), act = hEnd.filter((e) => e > t).length, cap = (t >= RHY.tripleFrom ? 3 : 2) - act;
    let busy = 0;
    for (let i = notes.length - 1; i >= 0 && notes[i].t > t - 1000; i--) busy++;   // keys already asked in the last second
    if (cap > 0 && busy < RHY.perSec && rnd(box) >= (t < RHY.quarterTo ? 0.22 : 0.58 - 0.2 * u)) {
      let k = 1;
      if (t >= RHY.chordFrom && cap >= 2 && rnd(box) < 0.06 + 0.14 * u) k = Math.min(t >= RHY.tripleFrom && cap >= 3 && rnd(box) < 0.2 ? 3 : 2, RHY.perSec - busy);
      const lanes = rhyLanes(box, [0, 1, 2, 3].filter((l) => free[l] <= t), prev, k);
      let hold = 0;
      if (lanes.length === 1 && t >= RHY.holdFrom && !act && rnd(box) < 0.06 + 0.08 * u) {
        hold = Math.round(beat * [1, 1.5, 2][ri(box, 0, 2)]);
        if (t + hold > T - RHY.tail - 400) hold = 0;
      }
      for (const l of lanes) {
        notes.push({ t: Math.round(t), l, h: hold, s: 0 });
        free[l] = t + (hold ? hold + 300 : RHY.sameLane);
        if (hold) hEnd[l] = t + hold;
      }
      prev = lanes.length ? lanes[0] : prev;
    }
    t += t < RHY.quarterTo ? beat : beat / 2;
  }
  notes.forEach((n, i) => { n.id = i; });
  const Q = [[], [], [], []];
  for (const n of notes) Q[n.l].push(n.id);
  return { N: notes, Q, P: [0, 0, 0, 0], H: 0, hold: [-1, -1, -1, -1], lock: 0, stray: [], sent: 0, last: notes.length ? notes[notes.length - 1].t + notes[notes.length - 1].h : 0, seq: 0, ev: [], cnt: [0, 0, 0] };
}
const rhyEv = (g, l, kind) => { g.ev.push([++g.seq, l, kind]); if (g.ev.length > RHY.ring) g.ev.shift(); };

/** A key goes down on lane `l` at `tt` (ms from the run start, latency allowance already taken off). */
function rhyPress(ab, l, tt, now) {
  const g = ab.g, k = rhyW(ab, now), q = g.Q[l], wg = RHY.good * k, wp = RHY.perf * k;
  if (now < g.lock) return;
  while (g.P[l] < q.length && g.N[q[g.P[l]]].s) g.P[l]++;
  for (let i = g.P[l]; i < q.length; i++) {
    const n = g.N[q[i]];
    if (n.s) continue;
    const dt = tt - n.t;
    if (dt > wg) continue;   // its window is over: `adv` calls it a Miss
    if (dt < -wg) break;     // too early for this one (and so for the later ones)
    const perfect = Math.abs(dt) <= wp;
    n.s = n.h ? 3 : 1;
    if (n.h) g.hold[l] = n.id;
    albaGood(ab, now, RHY.pts[perfect ? 1 : 0]);
    g.cnt[perfect ? 0 : 1]++;
    rhyEv(g, l, perfect ? 2 : 1);
    return;
  }
  g.stray.push(now);
  if (g.stray.length > RHY.strayN) g.stray.shift();
  if (g.stray.length === RHY.strayN && now - g.stray[0] <= RHY.strayMs) { g.lock = now + RHY.lockMs; g.stray.length = 0; }
}
/** A key comes up on lane `l`: the tail of the note held there (nothing held: nothing happens). */
function rhyRelease(ab, l, tt, now) {
  const g = ab.g, id = g.hold[l];
  if (id < 0) return;
  const n = g.N[id];
  g.hold[l] = -1;
  if (tt >= n.t + n.h - RHY.tailOk) { n.s = 1; albaGood(ab, now, RHY.holdPts); rhyEv(g, l, 3); }
  else { n.s = 2; albaBad(ab, RHY.missPen); g.cnt[2]++; rhyEv(g, l, 4); }
}

ALBA_RULES.rhythm = {
  init(S, p, ab) { ab.g = rhyBuild(ab.box); },
  adv(S, p, ab, now) {
    const g = ab.g, J = now - RHY.lat - ab.runAt, n = g.N;   // J: the judged clock, ms from the run start
    for (;;) {   // the next thing that falls due: the oldest waiting note's Good window, or a held tail nobody let go of
      while (g.H < n.length && n[g.H].s !== 0) g.H++;
      let due = Infinity, id = -1, tail = false;
      if (g.H < n.length) { due = n[g.H].t + RHY.good * rhyW(ab, ab.runAt + n[g.H].t); id = g.H; }
      for (let l = 0; l < 4; l++) if (g.hold[l] >= 0) { const h = n[g.hold[l]], d = h.t + h.h + RHY.tailEnd; if (d < due) { due = d; id = h.id; tail = true; } }
      if (due >= J) break;
      const m = n[id];
      if (tail) { m.s = 1; g.hold[m.l] = -1; albaGood(ab, ab.runAt + due + RHY.lat, RHY.holdPts); rhyEv(g, m.l, 3); }
      else { m.s = 2; albaBad(ab, RHY.missPen); g.cnt[2]++; rhyEv(g, m.l, 0); }
    }
    if (g.sent < g.last && g.sent - (now - ab.runAt) <= RHY.refresh) albaTouch(ab);   // the announced window is running dry: send the next stretch
  },
  act(S, p, ab, a, now) {
    let m;
    if (a.m !== undefined) {
      if (a.l !== undefined || !Number.isInteger(a.m) || a.m < 1 || a.m > 15) return "bad";
      m = a.m;
    } else {
      if (!Number.isInteger(a.l) || a.l < 0 || a.l > 3) return "bad";
      m = 1 << a.l;
    }
    if (a.up !== undefined && a.up !== 1) return "bad";
    const tt = now - RHY.lat - ab.runAt;
    for (let l = 0; l < 4; l++) if (m & (1 << l)) (a.up === 1 ? rhyRelease : rhyPress)(ab, l, tt, now);
    return null;
  },
  view(ab, now) {
    const g = ab.g, rt = now - ab.runAt, to = rt + RHY.ahead, notes = [];
    g.sent = to;
    for (let l = 0; l < 4; l++) { const id = g.hold[l]; if (id >= 0 && id < g.H) { const n = g.N[id]; notes.push(id, l, n.t - rt, n.h, 1); } }
    for (let i = g.H; i < g.N.length; i++) {
      const n = g.N[i];
      if (n.t >= to) break;
      if (n.s === 0 || n.s === 3) notes.push(i, n.l, n.t - rt, n.h, n.s === 3 ? 1 : 0);
    }
    return [notes, g.ev.flat(), Math.round(rhyBpm(rt)), g.cnt.slice()];
  },
};
