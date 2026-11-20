// 일일 아르바이트 · 파리잡기 (docs/design/daily-alba-minigames-2026-11-16.md §3.2): whack-a-mole with flies on a 3×3 grid of trash cans. Contract: 66-alba.js.
// The whole 90 s spawn schedule is rolled at `init` from `ab.box` (a seed always gives the same flies); play only moves it when a can is hit
// (that can shuts for 1 s and its later flies slide back). `ab.g` = { F: flies by id, Q: per can its fly ids in time order, H: per can the first
// unresolved index, cd: per can the run-time (ms) its lid stays shut until, sent: how far ahead the client's last view announced }.
// A fly = { id, c: can 0..8, t0: ms from the run start, life, k: 0 plain 1 golden 2 bee 3 poison, hp, dn: hit }. A can never holds two flies at once.
// view = [[[id, can, ms to spawn (< 0: already out), life, kind (4 = wounded poison)]… alive or spawning within FLY.ahead ms], [[can, ms the lid stays shut]…]];
// the view is re-sent (rev) on every hit and whenever the announced window is about to run dry, so an idle player still sees what comes.
// The only input is {hit: fly id}: it must name a fly that is out (± FLY.grace for latency) and not hit yet; a swing at nothing is refused without a penalty.
const FLY = { ahead: 3500, refresh: 1200, grace: 250, early: 100, close: 1000, gap: 400, pts: [10, 40, 0, 25], beePen: 30, bombs: [22000, 60000, 80000], rate: [1.9, 2.8], life: [[840, 460], [500, 340], [960, 670], [1560, 1020]] };   // (easier 2026-11-20) every fly stays 20 % longer
Object.assign(ALBA, { fly: { name: "파리잡기", npc: "dongdong", place: "동동아파트 쓰레기장", skill: "gather", par: 5200, lives: 5, mul: 0.9, outfit: ["top_willow_apron"], tool: "swatter", hint: "파리를 눌러 잡으세요. 벌을 치면 ♥ 하나 (다섯 번이면 끝)!" } });

/** Roll the whole schedule: a spawn clock whose pace and lifetimes ramp with the time, and two 쓰레기 폭탄 (every can opens at once). */
function flyBuild(box) {
  const T = ALBA_T.runMs, F = [], free = new Array(9).fill(0);
  const put = (c, t0, k) => {
    const [a, b] = FLY.life[k], u = t0 / T, l = Math.round((a + (b - a) * u) * (0.9 + 0.2 * rnd(box)) * (t0 >= T - ALBA_T.rushMs ? 0.9 : 1));
    F.push({ id: 0, c, t0, life: l, k, hp: k === 3 ? 2 : 1, dn: 0 });
    free[c] = t0 + l + FLY.gap;
  };
  const bag = [];   // kinds come out of a shuffled bag, so every shift holds nearly the same mix
  const kind = (t) => {
    if (t < 2000) return 0;
    if (!bag.length) {
      (t < 10000 ? [11, 1, 2, 2] : [10, 1, 3, 3]).forEach((n, k) => { for (let i = 0; i < n; i++) bag.push(k); });
      for (let i = bag.length - 1; i > 0; i--) { const j = ri(box, 0, i), x = bag[i]; bag[i] = bag[j]; bag[j] = x; }
    }
    return bag.pop();
  };
  let t = 800, nb = 0;
  while (t < T) {
    if (nb < FLY.bombs.length && t >= FLY.bombs[nb]) {
      const kinds = [0, 0, 0, 0, 0, 0, 1, 2, 3];
      for (let i = 8; i > 0; i--) { const j = ri(box, 0, i), x = kinds[i]; kinds[i] = kinds[j]; kinds[j] = x; }
      const tb = Math.max(t, ...free);   // wait for the cans still busy: the bomb opens all nine within half a second
      for (let c = 0; c < 9; c++) put(c, tb + ri(box, 0, 450), kinds[c]);
      t = tb + 2600; nb++;
      continue;
    }
    const open = [];
    for (let c = 0; c < 9; c++) if (free[c] <= t) open.push(c);
    if (open.length) put(open[ri(box, 0, open.length - 1)], t, kind(t));
    const rate = (FLY.rate[0] + (FLY.rate[1] - FLY.rate[0]) * (t / T)) * (t >= T - ALBA_T.rushMs ? 1.4 : 1);
    t += Math.round((1000 / rate) * (0.5 + rnd(box)));
  }
  F.sort((a, b) => a.t0 - b.t0);
  const Q = [[], [], [], [], [], [], [], [], []];
  F.forEach((f, i) => { f.id = i; Q[f.c].push(i); });
  return { F, Q, H: new Array(9).fill(0), cd: new Array(9).fill(0), sent: 0 };
}

ALBA_RULES.fly = {
  init(S, p, ab) { ab.g = flyBuild(ab.box); },
  adv(S, p, ab, now) {
    const g = ab.g, rt = now - ab.runAt;
    for (let c = 0; c < 9; c++) {
      const q = g.Q[c];
      while (g.H[c] < q.length) { const f = g.F[q[g.H[c]]]; if (!f.dn && f.t0 + f.life + FLY.grace > rt) break; g.H[c]++; }
    }
    if (rt + FLY.refresh >= g.sent) albaTouch(ab);
  },
  act(S, p, ab, a, now) {
    const g = ab.g, id = a.hit, rt = now - ab.runAt;
    if (!Number.isInteger(id) || id < 0 || id >= g.F.length) return "없는 파리입니다";
    const f = g.F[id];
    if (f.dn || rt < f.t0 - FLY.early || rt > f.t0 + f.life + FLY.grace) return "이미 사라졌어요";
    if (f.k === 3 && f.hp > 1) { f.hp--; albaTouch(ab); return null; }   // a poison fly takes two swats
    f.dn = 1;
    // a bee sting costs a life
    if (f.k === 2) albaStrike(ab, now, FLY.beePen); else albaGood(ab, now, FLY.pts[f.k]);
    // the lid drops for a second: the next flies of this can wait for it
    const end = rt + FLY.close, q = g.Q[f.c];
    g.cd[f.c] = end;
    let d = -1;
    for (let i = g.H[f.c]; i < q.length; i++) { const x = g.F[q[i]]; if (x.dn || x.t0 <= rt) continue; if (d < 0) d = Math.max(0, end - x.t0); x.t0 += d; }
    return null;
  },
  view(ab, now) {
    const g = ab.g, rt = now - ab.runAt, to = Math.max(rt, 0) + FLY.ahead, fl = [], cl = [];
    g.sent = to;
    for (let c = 0; c < 9; c++) {
      const q = g.Q[c];
      for (let i = g.H[c]; i < q.length; i++) {
        const f = g.F[q[i]];
        if (f.t0 >= to) break;
        if (!f.dn && f.t0 + f.life > rt) fl.push([f.id, c, f.t0 - rt, f.life, f.k === 3 && f.hp < 2 ? 4 : f.k]);
      }
      if (g.cd[c] > rt) cl.push([c, g.cd[c] - rt]);
    }
    return [fl, cl];
  },
};
