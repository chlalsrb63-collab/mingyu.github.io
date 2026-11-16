// 일일 아르바이트 · 화환 엮기 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { garland: { name: "화환 엮기", npc: "willow_florist", place: "꽃집 앞 꽃밭", skill: "gather", par: 1600, mul: 0.95, outfit: ["hat_wreath_pink","top_willow_apron"], tool: "shears", hint: "꽃줄을 이끌어 꽃을 모아 화환을 완성하세요." } });
ALBA_RULES.garland = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
