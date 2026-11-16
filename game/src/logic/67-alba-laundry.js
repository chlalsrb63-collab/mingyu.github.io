// 일일 아르바이트 · 세탁소 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { laundry: { name: "세탁소", npc: "costume", place: "의상실 세탁실", skill: "craft", par: 2000, mul: 1.1, outfit: ["top_apron_moka"], tool: "basket", hint: "같은 색 빨래 4개를 이어 세탁하세요." } });
ALBA_RULES.laundry = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
