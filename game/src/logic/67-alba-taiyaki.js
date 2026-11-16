// 일일 아르바이트 · 붕어빵 노점 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { taiyaki: { name: "붕어빵 노점", npc: "cafe_moka", place: "광장 먹거리 골목", skill: "cook", par: 1700, mul: 1, outfit: ["top_apron_juju"], tool: "spatula", hint: "알맞게 구워졌을 때 뒤집고 꺼내세요." } });
ALBA_RULES.taiyaki = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
