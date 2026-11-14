/**
 * The six starting weapons as the character-creation page tells them (lobby.js). The lobby has no
 * `defs` yet (they come with `welcome`, after the character exists), so the few words it needs are
 * mirrored here: `name` = logic WK_NAME, `skill` = the weapon's first skill (mastery 1, what lands on
 * quick slot 1), `reach` = 원거리 from a basic-attack range of 80 px. tests/looks.mjs holds this table
 * to the rules. `diff` (1 쉬움 · 2 보통 · 3 어려움) and `feel` are the lobby's own words.
 * Pure data: no imports, so node can read it.
 */
export const STARTER_ORDER = ["sword", "dagger", "spear", "staff", "book", "bow"];
export const STARTER = {
  sword: { name: "대검", reach: "근접", diff: 1, skill: "파워 슬래쉬", feel: "넓게 베어 내는 묵직한 한 방" },
  dagger: { name: "단검", reach: "근접", diff: 2, skill: "암습", feel: "빠른 찌르기, 급소를 노리는 기습" },
  spear: { name: "창", reach: "근접", diff: 1, skill: "나선 찌르기", feel: "긴 창끝으로 줄지어 꿰뚫기" },
  staff: { name: "스태프", reach: "원거리", diff: 2, skill: "파이어볼", feel: "불과 얼음, 원소를 엮는 마법" },
  book: { name: "마도서", reach: "원거리", diff: 3, skill: "영혼 화살", feel: "낙인을 새기고 터뜨리는 저주" },
  bow: { name: "활", reach: "원거리", diff: 2, skill: "관통 화살", feel: "멀리서 날리는 화살" },
};
export const DIFF_NAME = ["", "쉬움", "보통", "어려움"];
/** A basic attack reaching this far (px) is told as 원거리. */
export const FAR_RANGE = 80;
