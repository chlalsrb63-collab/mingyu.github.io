// ───────────────────────────── job palettes (docs/design/skills-v2.md) ─────────────────────────────
// One representative colour per job and the combo its skill icons and effects are drawn from (owner, 2026-11-15):
// c = [main, light, dark, accent] — main: the body of a burst, a blade arc or a projectile; light: its flash and
// highlights; dark: outlines and the one shadow tone; accent: the second note (sparks, marks, an element). A hybrid
// blends its two weapons' palettes and keeps an accent of its own. Sent once in defs() as `jobPal`, with `skillJob`
// (which job's palette each skill is drawn in: a signature its job's, a weapon skill its weapon's single job's).
const JOB_PAL = {
  adventurer: { name: "길 위의 첫걸음", c: ["#c8a46a", "#f0dcae", "#5e4626", "#7fb6d9"] },
  swordsman: { name: "강철과 불꽃", c: ["#e2413b", "#ff9a80", "#6a1418", "#c9d2dc"] },
  thief: { name: "그림자와 독", c: ["#9353d3", "#cfa8f5", "#2c1648", "#7ee07a"] },
  lancer: { name: "천둥 기병", c: ["#3f86e8", "#a8d0ff", "#14345e", "#ffe066"] },
  wizard: { name: "원소의 불씨", c: ["#ff8c2e", "#ffd29a", "#6e2c06", "#6fe3ff"] },
  warlock: { name: "심연의 낙인", c: ["#cf3fa0", "#f5a6d6", "#4a0f36", "#5be3b0"] },
  archer: { name: "숲의 바람", c: ["#62c25a", "#bdf0ae", "#1d4a22", "#f0c850"] },
  destroyer: { name: "용광로와 금맥", c: ["#e8b830", "#ffe68a", "#5c4208", "#ff5a2a"] },
  spellblade: { name: "홍련과 뇌전", c: ["#ff6a4a", "#ffbfa6", "#6e1c12", "#ffe066"] },
  tracker: { name: "밤숲의 덫", c: ["#8fb83a", "#d6ee9e", "#33441a", "#9353d3"] },
  dragoon: { name: "심연의 비룡", c: ["#5c5ee6", "#b4b6ff", "#1c1d5a", "#cf3fa0"] },
  hexblade: { name: "피의 주술", c: ["#b02a48", "#f0889e", "#3c0a16", "#c48cff"] },
  darkknight: { name: "검은 성역", c: ["#9aa4b8", "#dfe5f0", "#262b38", "#e2413b"] },
  bladedancer: { name: "칼바람 춤", c: ["#f0679e", "#ffb8d8", "#66183e", "#c9d2dc"] },
  trickster: { name: "환영의 세 원소", c: ["#36d1b4", "#a8f5e4", "#0c4a40", "#ff8c2e"] },
  spellspear: { name: "빙결의 창", c: ["#66d6ff", "#d2f4ff", "#164c68", "#3f86e8"] },
  runesage: { name: "메아리 법진", c: ["#b49cff", "#e4dcff", "#3a2c6e", "#ffd166"] },
  runearcher: { name: "먹과 룬의 화살", c: ["#e6dcc0", "#fffbea", "#2b2620", "#62c25a"] },
  mercenary: { name: "녹슨 철쇄", c: ["#b07850", "#e8c4a4", "#46281a", "#6fa8e0"] },
  paladin: { name: "성문의 빛", c: ["#f2dc7a", "#fff7cc", "#74601c", "#8fd6ff"] },
};
/** Each skill's palette owner: a signature's job, a weapon skill's single job of that weapon. */
const SKILL_JOB = Object.fromEntries(SKILL_ORDER.map((id) => {
  const sk = SKILL[id];
  return [id, sk.job || Object.keys(JOBS).find((j) => JOBS[j].kind === "single" && JOBS[j].wk[0] === sk.wk)];
}));
