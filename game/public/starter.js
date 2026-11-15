/**
 * The creation page's own words about the starting weapons (lobby.js). WHICH weapons there are, their
 * names, first skills and reach come from the rules with `need_char` (logic `starters()`); this file only
 * adds a difficulty (1 쉬움 · 2 보통 · 3 어려움) and a one-line feel per kind. A kind the rules add and this
 * table does not know yet still gets its tile, just without these words. `FALLBACK` is what the page shows
 * before the server has spoken (and to an old server): tests/looks.mjs holds it to the rules.
 * Pure data: no imports, so node can read it.
 */
export const WORDS = {
  sword: { diff: 1, feel: "넓게 베어 내는 묵직한 한 방" },
  dagger: { diff: 2, feel: "빠른 찌르기, 급소를 노리는 기습" },
  spear: { diff: 1, feel: "긴 창끝으로 줄지어 꿰뚫기" },
  staff: { diff: 2, feel: "불과 얼음, 원소를 엮는 마법" },
  book: { diff: 3, feel: "낙인을 새기고 터뜨리는 저주" },
  bow: { diff: 2, feel: "멀리서 날리는 화살" },
  hammer: { diff: 2, feel: "가까운 땅을 내려찍는 무거운 원형 정타" },
};
export const DIFF_NAME = ["", "쉬움", "보통", "어려움"];
/** A basic attack reaching this far (px) is told as 원거리. */
export const FAR_RANGE = 80;
/** [kind, name, tier-1 weapon name, first skill name, basic-attack range] — the shape of logic `starters()`. */
export const FALLBACK = [
  ["sword", "대검", "녹슨 대검", "파워 슬래쉬", 34],
  ["dagger", "단검", "낡은 단검", "암습", 26],
  ["spear", "창", "대나무 창", "나선 찌르기", 54],
  ["staff", "스태프", "견습 지팡이", "파이어볼", 100],
  ["book", "마도서", "낡은 주문서", "영혼 화살", 84],
  ["bow", "활", "나무 짧은활", "관통 화살", 150],
  ["hammer", "양손해머", "말뚝박이 망치", "쐐기찍기", 49],
];
/** A list as the server sent it, kept only if it is well-formed (else the fallback). */
export function cleanStarters(list) {
  const ok = Array.isArray(list) && list.length > 0 && list.length <= 24 && list.every((r) => Array.isArray(r) && typeof r[0] === "string" && /^[a-z][a-z0-9_]{1,15}$/.test(r[0]) && typeof r[1] === "string");
  return ok ? list.map((r) => [r[0], r[1], String(r[2] || ""), String(r[3] || ""), +r[4] || 0]) : FALLBACK;
}
