// 일일 아르바이트 · 편의점 아르바이트 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { store: { name: "편의점 아르바이트", npc: "store_kong", place: "다람쥐 잡화점 계산대", skill: "deliver", par: 1600, mul: 1, outfit: ["top_coop_vest"], tool: "scanner", hint: "물건을 스캔하고 거스름돈을 맞춰 주세요." } });
ALBA_RULES.store = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
