// 일일 아르바이트 · 택배 상하차 (STUB: the real game replaces this file; contract in 66-alba.js)
Object.assign(ALBA, { parcel: { name: "택배 상하차", npc: "shop", place: "광장 택배 집하장", skill: "deliver", par: 2200, mul: 1.15, outfit: ["hat_coop_cap","top_appr_deliver"], tool: "box", hint: "박스를 트럭에 빈틈없이 쌓아 한 줄씩 출하하세요." } });
ALBA_RULES.parcel = {
  init(S, p, ab) { ab.g = { n: 0 }; },
  adv() {},
  act(S, p, ab, a, now) { ab.g.n++; albaGood(ab, now, 10); return null; },
  view(ab) { return [ab.g.n]; },
};
