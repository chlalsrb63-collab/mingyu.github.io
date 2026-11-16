// 일일 아르바이트 · 철거 알바 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { wall: { name: "철거 알바", npc: "kangkang", place: "캉캉대장간 옆 헌 벽", skill: "craft", par: 1800, mul: 1.1, outfit: ["hat_coop_cap","top_smith"], tool: "chain", hint: "철구로 벽돌을 부수세요. 발판으로 공을 받아 주세요." } });
ALBA_RULES.wall = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
