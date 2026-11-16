// 일일 아르바이트 · 가로등 점등 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { lamp: { name: "가로등 점등", npc: "hall_bori", place: "버드나무 골목", skill: "gather", par: 1900, mul: 1, outfit: ["top_willow_patrol"], tool: "torch", hint: "골목의 가로등을 모두 켜세요. 그림자를 조심하세요!" } });
ALBA_RULES.lamp = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
