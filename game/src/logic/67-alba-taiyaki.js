// 일일 아르바이트 · 붕어빵 노점 (docs/design/daily-alba-minigames-2026-11-16.md §3.6): timing cooking. Contract: 66-alba.js. All times in `ab.g` are ms from the RUN start.
// A mould of 6 slots (8 after TAI.more); each slot walks 0 empty → 1 batter → 2 filling → 3 baking side 1 → 4 baking side 2 → (take out into the tray) or 5 burnt (clear it).
// Baking is a gauge 0..100 % over the slot's `d` ms, computed from absolute times (nothing ticks): side 1 may be flipped in the green window [z0, z1] (later than z1 only
// costs the "perfect"), side 2 is taken out from 50 %, perfect (×2) inside the yellow window [z2, z3] after a green flip; reaching 100 % burns it (−10, combo broken).
// Customers queue with an order (need per filling 팥/슈크림/치즈) and a patience bar; tapping one serves every matching piece of the tray; leaving costs 20 (a group order 40).
// Input: {slot, step, f?} — `step` is the stage the player saw (a stale tap is refused, so a double tap can't skip a step), `f` the filling at stage 1 —
//        or {c: customer id} to serve. Everything is validated; a refusal costs nothing.
// view = [open slots, [[stage, filling, quality, ms since the stage began (≤ 0), side ms, z0, z1, z2, z3]…8], [[id, n0, n1, n2, ms patience left, patience ms, group]…], [[filling, quality]…tray], ms to the 8th slot]
const TAI = { more: 120000, group: 170000, queue: 5, tray: 6, burn: 10, leave: 20, leaveGroup: 40, pts: [30, 60], bonus: 12, cook: [12000, 7000], flip: [26, 14], gold: [12, 5] };
Object.assign(ALBA, { taiyaki: { name: "붕어빵 노점", npc: "cafe_moka", place: "광장 먹거리 골목", skill: "cook", par: 13800, mul: 1, outfit: ["top_apron_juju"], tool: "spatula", hint: "알맞게 구워졌을 때 뒤집고 꺼내세요." } });

const taiLerp = (r, rt) => r[0] + (r[1] - r[0]) * clamp(rt / ALBA_T.runMs, 0, 1);
function taiCustomer(g, ab, bt, grp) {
  const need = [0, 0, 0], u = bt / ALBA_T.runMs;
  let tot = 1;
  if (grp) { need[0] = 4; need[1] = 3; need[2] = 3; tot = 10; }
  else {
    if (!g.bag.length) {   // the order sizes come from a shuffled bag: every shift asks for nearly the same
      g.bag = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2];
      for (let i = 9; i > 0; i--) { const j = ri(ab.box, 0, i), x = g.bag[i]; g.bag[i] = g.bag[j]; g.bag[j] = x; }
    }
    tot = g.bag.pop(); need[ri(ab.box, 0, 2)]++;
    if (tot === 2) need[ri(ab.box, 0, 2)]++;
  }
  const wait = Math.round(grp ? 68000 : (40000 - 24000 * u) * (tot === 2 ? 1.35 : 1) * (0.9 + 0.2 * rnd(ab.box)));
  g.cu.push({ id: g.nid++, need, tot, at: bt, until: bt + wait, wait, grp: grp ? 1 : 0 });
}
/** The earliest thing that happens by itself: [time, kind, index] — 0 the 8th slot opens · 1 the group order comes · 2 a customer arrives · 3 a slot burns · 4 a customer leaves. */
function taiNext(g) {
  let bt = Infinity, bk = -1, bi = 0;
  if (g.n < 8 && TAI.more < bt) { bt = TAI.more; bk = 0; }
  if (!g.grp && TAI.group < bt) { bt = TAI.group; bk = 1; }
  if (g.na < bt) { bt = g.na; bk = 2; }
  for (let i = 0; i < g.n; i++) { const x = g.sl[i]; if ((x.s === 3 || x.s === 4) && x.a + x.d < bt) { bt = x.a + x.d; bk = 3; bi = i; } }
  for (const c of g.cu) if (c.until < bt) { bt = c.until; bk = 4; bi = c.id; }
  return [bt, bk, bi];
}

ALBA_RULES.taiyaki = {
  init(S, p, ab) {
    ab.g = { n: 6, sl: Array.from({ length: 8 }, () => ({ s: 0, f: 0, q: 2, a: 0, d: 0, z: [0, 0, 0, 0] })), tray: [], cu: [], na: 0, nid: 1, grp: 0, bag: [] };
  },
  adv(S, p, ab, now) {
    const g = ab.g, rt = now - ab.runAt;
    for (let guard = 0; guard < 64; guard++) {
      const [bt, bk, bi] = taiNext(g);
      if (bt > rt) break;
      if (bk === 0) g.n = 8;
      else if (bk === 1) { g.grp = 1; taiCustomer(g, ab, bt, true); }
      else if (bk === 2) {
        if (g.cu.reduce((n, c) => n + (c.grp ? 0 : 1), 0) < TAI.queue) taiCustomer(g, ab, bt, false);
        g.na = bt + Math.round(taiLerp([6000, 1700], bt) * (0.7 + 0.6 * rnd(ab.box)));
      } else if (bk === 3) { g.sl[bi].s = 5; albaBad(ab, TAI.burn); }
      else { const i = g.cu.findIndex((c) => c.id === bi); albaBad(ab, g.cu[i].grp ? TAI.leaveGroup : TAI.leave); g.cu.splice(i, 1); }
      albaTouch(ab);
    }
  },
  act(S, p, ab, a, now) {
    const g = ab.g, rt = now - ab.runAt;
    if (Number.isInteger(a.slot)) {
      if (a.slot < 0 || a.slot >= g.n) return "없는 칸입니다";
      const x = g.sl[a.slot];
      if (a.step !== x.s) return "이미 바뀐 칸입니다";
      const gauge = x.s === 3 || x.s === 4 ? ((rt - x.a) / x.d) * 100 : 0;
      if (x.s === 0) x.s = 1;
      else if (x.s === 1) { if (!Number.isInteger(a.f) || a.f < 0 || a.f > 2) return "맛을 고르세요"; x.f = a.f; x.s = 2; }
      else if (x.s === 2) {   // the lid goes on: side 1 starts baking, the windows are fixed for this piece
        const gl = 38, yl = 72;
        x.s = 3; x.a = rt; x.q = 2; x.d = Math.round(taiLerp(TAI.cook, rt) * (rt >= ALBA_T.runMs - ALBA_T.rushMs ? 0.9 : 1));
        x.z = [gl, Math.round(gl + taiLerp(TAI.flip, rt)), yl, Math.round(yl + taiLerp(TAI.gold, rt))];
      } else if (x.s === 3) {
        if (gauge < x.z[0]) return "아직이에요";
        if (gauge > x.z[1]) x.q = 1;
        x.s = 4; x.a = rt;
      } else if (x.s === 4) {
        if (gauge < 50) return "아직 덜 익었어요";
        if (g.tray.length >= TAI.tray) return "진열대가 꽉 찼어요";
        g.tray.push([x.f, x.q === 2 && gauge >= x.z[2] && gauge <= x.z[3] ? 2 : 1]);
        x.s = 0;
      } else x.s = 0;   // 5: the burnt one goes in the bin
      albaTouch(ab);
      return null;
    }
    if (Number.isInteger(a.c)) {
      const c = g.cu.find((x) => x.id === a.c);
      if (!c) return "손님이 없어요";
      let served = 0;
      for (let f = 0; f < 3; f++) {
        while (c.need[f] > 0) {
          let best = -1;
          g.tray.forEach((t, i) => { if (t[0] === f && (best < 0 || t[1] > g.tray[best][1])) best = i; });
          if (best < 0) break;
          const q = g.tray.splice(best, 1)[0][1];
          c.need[f]--; c.tot--; served++;
          albaGood(ab, now, TAI.pts[q - 1]);
        }
      }
      if (!served) return "원하는 맛이 없어요";
      if (c.tot <= 0) { albaGood(ab, now, Math.round(TAI.bonus * (c.grp ? 10 : 1) * clamp((c.until - rt) / c.wait, 0, 1))); g.cu.splice(g.cu.indexOf(c), 1); }
      albaTouch(ab);
      return null;
    }
    return "알 수 없는 입력입니다";
  },
  view(ab, now) {
    const g = ab.g, rt = now - ab.runAt;
    return [g.n, g.sl.map((x, i) => (i >= g.n || x.s < 3 || x.s === 5 ? [x.s, x.f] : [x.s, x.f, x.q, x.a - rt, x.d, ...x.z])),
      g.cu.map((c) => [c.id, c.need[0], c.need[1], c.need[2], c.until - rt, c.wait, c.grp]), g.tray, g.n < 8 ? Math.max(0, TAI.more - rt) : 0];
  },
};
