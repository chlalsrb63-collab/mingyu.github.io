// 일일 아르바이트 · 파리잡기 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { fly: { name: "파리잡기", npc: "dongdong", place: "동동아파트 쓰레기장", skill: "gather", par: 1800, mul: 0.9, outfit: ["top_willow_apron"], tool: "swatter", hint: "파리를 눌러 잡으세요. 벌은 건드리지 마세요!" } });
ALBA_RULES.fly = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
