// 일일 아르바이트 · 편의점 아르바이트: a cash register, solo (contract in 66-alba.js; plan docs/design/daily-alba-minigames-2026-11-16.md §3.3).
// Three customer lanes (a fourth opens for the last 30 s rush). A customer arrives with 1-5 items on the counter, scans nothing herself, and has a
// patience that runs out (she leaves: albaBad(ab, 20)). The clerk taps the items to scan them (any order); when all are scanned the customer's
// "paid" money is shown and the clerk gives EXACT change by tapping the pad (100 · 500 · 1000 · 5000 won): the change is complete the moment the
// tray equals paid - total, a tap that overshoots empties the tray (a slip: combo broken, the accuracy bonus lost). Special customers:
//   · 진상 (kind 1)  hands over another amount when the first coin is tapped, a shorter patience, grows angrier (-3 s) at every slip
//   · 단체 (kind 2)  twelve items, worth ×3
//   · VIP (kind 3)   a 50 point tip when served without a slip
// During a fever one scan tap scans the whole counter. Difficulty rises with the score and the time (more items, shorter patience, shorter gaps).
// Customers arrive and leave LAZILY: their times sit in `ab.g` and `adv` applies them in time order. Money is counted in hundreds of won.
//   act: {s: lane, i: item} scan · {p: lane, v: 0..3} a coin or bill (pad[v]) · {cl: lane} empty the tray
//   view: [lane ×4]; a lane is 0 (nobody) or [customer id, kind, item prices (hundreds), scanned bitmask, paid, tray, ms until she leaves, patience ms, changed-her-mind flag]

Object.assign(ALBA, { store: { name: "편의점 아르바이트", npc: "store_kong", place: "다람쥐 잡화점 계산대", skill: "deliver", par: 10500, mul: 1, outfit: ["top_coop_vest"], tool: "scanner", hint: "물건을 눌러 스캔하고, 받은 돈에서 합계를 뺀 거스름돈을 정확히 내주세요." } });

const ASTORE = { pad: [1, 5, 10, 50], lanes: 4, leavePen: 20, groupItems: 12 };
/** How hard it is at time `t`: climbs with the score (a second level per 550 points) and a little with the minutes, 0..8. */
const astoreDiff = (ab, t) => clamp(Math.floor(ab.score / 550 + Math.max(0, t - ab.runAt) / 120000), 0, 8);
/** The wait before the next customer comes to an empty lane (shorter as it gets harder, and 1.4× faster in the rush). */
const astoreGap = (ab, t) => Math.round((2800 - 230 * astoreDiff(ab, t) + ri(ab.g.gb, 0, 1800)) / (t >= ab.endAt - ALBA_T.rushMs ? 1.4 : 1));

/** Customer number `g.n + 1`, arriving at `t`: everything about her follows from the shift seed and her number. */
function astoreMake(ab, t) {
  const g = ab.g, id = ++g.n, cb = { seed: (ab.box.seed ^ Math.imul(id, 0x85ebca6b)) | 0 }, d = astoreDiff(ab, t), r = rnd(cb);
  const kind = d >= 3 && r < 0.05 && !g.lanes.some((l) => l.c && l.c.kind === 2) ? 2 : d >= 1 && r < 0.17 ? 1 : d >= 1 && r < 0.27 ? 3 : 0;
  const n = kind === 2 ? ASTORE.groupItems : ri(cb, 1, Math.min(5, 2 + (d >> 1))), it = [];
  let tot = 0;
  for (let i = 0; i < n; i++) { const v = ri(cb, 2, 15); it.push(v); tot += v; }
  const up = (Math.floor(tot / 10) + 1) * 10, q = rnd(cb);   // the next thousand won above the total, now and then more
  const paid = q < 0.6 ? up : q < 0.8 ? up + 10 : q < 0.9 && up < 50 ? 50 : up < 100 ? 100 : up + 10;
  const pt = Math.round(Math.max(12000, 28000 - 1500 * d) * (kind === 1 ? 0.8 : 1)) + 1800 * n;
  return { id, kind, it, sc: 0, tot, paid, tray: 0, lv: t + pt, pt, fl: 1, ch: 0 };
}

ALBA_RULES.store = {
  init(S, p, ab) {
    ab.g = { n: 0, gb: { seed: (ab.box.seed ^ 0x5bd1e995) | 0 }, lanes: [] };
    for (let i = 0; i < ASTORE.lanes; i++) ab.g.lanes.push({ c: null, at: i < 3 ? ab.runAt + 400 + 2600 * i : ab.endAt - ALBA_T.rushMs + 400 });
  },
  /** Customers come and go in the order of their times, each with its own timestamp. */
  adv(S, p, ab, now) {
    const g = ab.g;
    for (;;) {
      let best = null, bt = Infinity;
      for (const l of g.lanes) { const t = l.c ? l.c.lv : l.at; if (t <= now && t < bt) { bt = t; best = l; } }
      if (!best) return;
      if (best.c) { best.c = null; best.at = bt + astoreGap(ab, bt); albaBad(ab, ASTORE.leavePen); }
      else { best.c = astoreMake(ab, bt); albaTouch(ab); }
    }
  },
  act(S, p, ab, a, now) {
    const g = ab.g;
    if (!isObj(a)) return "잘못된 입력";
    const key = a.s !== undefined ? "s" : a.p !== undefined ? "p" : a.cl !== undefined ? "cl" : "";
    const lane = key ? a[key] : -1;
    if (!key || !Number.isInteger(lane) || lane < 0 || lane >= ASTORE.lanes) return "잘못된 입력";
    const c = g.lanes[lane].c;
    if (!c) return "손님이 없습니다";
    const all = (1 << c.it.length) - 1;
    if (key === "s") {
      const i = a.i;
      if (!Number.isInteger(i) || i < 0 || i >= c.it.length) return "잘못된 물건";
      if (c.sc & (1 << i)) return "이미 스캔했습니다";
      c.sc = now < ab.feverUntil ? all : c.sc | (1 << i);   // in a fever one scan takes the whole counter
      albaTouch(ab);
      return null;
    }
    if (key === "cl") { c.tray = 0; albaTouch(ab); return null; }
    const v = a.v;
    if (!Number.isInteger(v) || v < 0 || v >= ASTORE.pad.length) return "잘못된 돈";
    if (c.sc !== all) return "먼저 모든 물건을 스캔하세요";
    if (c.kind === 1 && !c.ch) {   // 진상: she hands over something else instead (this coin is not counted)
      c.ch = 1; c.paid = c.paid < 50 ? 50 : c.paid + 10; c.tray = 0;
      albaTouch(ab);
      return null;
    }
    c.tray += ASTORE.pad[v];
    const due = c.paid - c.tot;
    if (c.tray < due) { albaTouch(ab); return null; }
    if (c.tray > due) {   // too much: the coins go back, the slip counts
      c.tray = 0; c.fl = 0;
      if (c.kind === 1) c.lv -= 3000;
      albaBad(ab, 5);
      return null;
    }
    const frac = clamp((c.lv - now) / c.pt, 0, 1);
    albaGood(ab, now, (20 + 5 * c.it.length + Math.round(30 * frac) + (c.fl ? 15 : 0)) * (c.kind === 2 ? 3 : 1) + (c.kind === 3 && c.fl ? 50 : 0));
    const l = g.lanes[lane];
    l.c = null; l.at = now + astoreGap(ab, now);
    return null;
  },
  view(ab, now) {
    return ab.g.lanes.map((l) => (l.c ? [l.c.id, l.c.kind, l.c.it, l.c.sc, l.c.paid, l.c.tray, Math.max(0, l.c.lv - now), l.c.pt, l.c.ch] : 0));
  },
};
