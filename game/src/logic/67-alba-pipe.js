// 일일 아르바이트 · 배관 수리 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { pipe: { name: "배관 수리", npc: "popo", place: "마을회관 배관실", skill: "craft", par: 1500, mul: 1, outfit: ["hat_coop_cap","top_coop_vest"], tool: "wrench", hint: "조각을 칸에 놓아 급수구에서 배수구까지 길을 이으세요." } });
ALBA_RULES.pipe = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
