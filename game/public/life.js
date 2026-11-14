/**
 * Life skills in the browser (logic 12-life-tables.js, 58-life.js; docs/design/life-and-coop.md B.12).
 * L1 is read-only: the 생활 window (#w-life, menu button and Shift+L) lists the six skills — level, a bar to the
 * next, the grade of materials and fish each handles, its 대성공 and time bonus, the next unlock — and the grade
 * of the water where you stand. 채집 제작 연금 배달 show "곧 열립니다" until L2 opens them.
 * Wire: self.life = [[lv, xp, need (0 at the cap)] × 6] in defs.life.keys order; defs.life (lifeDefs).
 * Events: ["lv2", eid, skill index, lv] — a life level reached (a sound for you, a sparkle over anyone).
 */

let A = null;   // { G, Sound, S3, el, iconImg, draw, entityPos }
export function init(api) { A = api; }
const G = () => A.G;
const D = () => G().defs.life;
const $ = (s) => document.querySelector(s);
/** The glyph (uiicons.js) and colour of each skill, in LIFE order. */
const GLYPH = [["fish", "#8ad8ff"], ["fire", "#ffb04a"], ["life", "#9be05a"], ["anvil", "#c8c8d8"], ["drop", "#d88ae8"], ["bag", "#e2c486"]];
/** Which skills do something yet (L1: 낚시 and 요리). */
const OPEN = [true, true, false, false, false, false];
const HOW = ["물가에서 F — 물고기를 낚을 때마다", "모닥불 곁에서 생선을 구울 때마다", "채집", "제작", "연금", "배달"];

const r1 = (v) => Math.round(v * 10) / 10;
const gradeOf = (L) => D().grades.filter((lv) => L >= lv).length || 1;
/** The 대성공 chance at life level L for the highest grade it handles (logic lifeOdds at an average score). */
function greatAt(L) {
  const R = D().roll, d = Math.max(0, L - D().grades[gradeOf(L) - 1]);
  return r1(Math.min(R.great[2], R.great[0] + R.great[1] * d));
}

export function refresh(s) {
  A.draw("life", () => [s.life, G().map && G().map.id], render);
}

export function onEvent(e) {
  if (e[0] !== "lv2") return false;
  const [, eid, k] = e, mine = eid === G().you, at = A.entityPos(eid);
  if (mine) A.Sound.play("achieve");
  if (at) A.S3.fx.sparkle(at.x, at.y, 1.1, (GLYPH[k] || GLYPH[0])[1], 14);
  return true;
}

function render(s) {
  const box = $("#life-body"), el = A.el;
  box.textContent = "";
  const life = s.life;
  if (!life || !D()) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const top = el("div", "daily-top");
  top.append(A.iconImg("life", "#9be05a"), el("span", "", "전투와 따로 자라는 여섯 가지 솜씨"));
  const mg = G().map && D().mapGrade[G().map.id];
  if (mg) top.append(el("b", "", `이곳: ${D().gradeName[mg - 1]}`));
  box.append(top);
  D().keys.forEach((_, i) => {
    const [lv, xp, need] = life[i] || [1, 0, D().need[0]];
    const card = el("div", "dcard life-card" + (OPEN[i] ? "" : " soon"));
    const hd = el("div", "dh");
    const nm = el("b", "");
    nm.append(A.iconImg(GLYPH[i][0], GLYPH[i][1]), document.createTextNode(" " + D().names[i]));
    hd.append(nm, el("span", "lv", `Lv.${lv}`));
    const bar = el("div", "bar"), f = el("i");
    f.style.width = need ? `${Math.min(100, (xp / need) * 100)}%` : "100%";
    bar.append(f, el("b", "", need ? `${xp.toLocaleString("ko-KR")} / ${need.toLocaleString("ko-KR")}` : "명장"));
    card.append(hd, bar);
    const g = gradeOf(lv), next = D().grades.find((u) => u > lv) || (lv < D().max ? D().max : 0);
    const ft = el("div", "df");
    ft.append(el("small", "", OPEN[i]
      ? `${D().gradeName[g - 1]} · 대성공 ${greatAt(lv)}% · 시간 −${r1(D().roll.time * lv * 100)}%`
      : "곧 열립니다"));
    if (next) ft.append(el("small", "next", `Lv.${next}: ${D().unlock[next]}`));
    card.append(ft);
    if (OPEN[i]) card.title = `${HOW[i]} 경험치를 얻습니다.`;
    box.append(card);
  });
  box.append(el("p", "hint", "낚시: 사냥터마다 물의 등급이 다르고, 낚시 레벨이 오를수록 높은 등급의 물고기가 입질합니다. 요리: 숙련될수록 덜 타고, 대성공하면 두 접시가 나옵니다."));
}
