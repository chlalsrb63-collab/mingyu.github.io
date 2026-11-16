// 일일 아르바이트 · 여관 공연 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { rhythm: { name: "여관 공연", npc: "inn_lira", place: "여관 무대", skill: "cook", par: 2100, mul: 1.05, outfit: ["hat_beret","top_vest"], tool: "lute", hint: "내려오는 음표를 박자에 맞춰 연주하세요." } });
ALBA_RULES.rhythm = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
