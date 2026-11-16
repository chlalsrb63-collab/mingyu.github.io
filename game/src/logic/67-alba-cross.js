// 일일 아르바이트 · 횡단 배달 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { cross: { name: "횡단 배달", npc: "inn_toto", place: "여관 앞 큰길", skill: "deliver", par: 1700, mul: 1, outfit: ["hat_coop_cap","top_appr_deliver"], tool: "parcelbag", hint: "마차와 통나무 사이를 건너 꾸러미를 전하세요." } });
ALBA_RULES.cross = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
