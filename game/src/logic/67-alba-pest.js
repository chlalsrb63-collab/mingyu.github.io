// 일일 아르바이트 · 해충 방제 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { pest: { name: "해충 방제", npc: "bogle", place: "보글연금공방 지하 창고", skill: "alch", par: 2000, mul: 1.1, outfit: ["hat_goggles","top_alch"], tool: "sprayer", hint: "분무기로 해충 편대를 쏘세요. 급강하하는 놈을 놓치지 마세요!" } });
ALBA_RULES.pest = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
