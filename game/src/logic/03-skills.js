// ───────────────────────────── weapon skills: tables ─────────────────────────────
// docs/design/jobs-and-stats.md C. Skills belong to weapons, not classes: each weapon kind brings an active
// skill at mastery 1, another at 10 and a passive at 10; a single job adds its weapon's signature, a hybrid
// its fusion signature. Functions live in 57-weapon-skills.js.
//
// SKILL[id] = { id, name, kind, wk?, job?, need, mp, cd, mult, …params, mag?, el?, fx, desc }
//   kind "a" weapon active · "p" weapon passive · "j" single-job signature · "h" hybrid signature
//   wk   the weapon it needs in hand (a hybrid signature: either weapon of its job)
//   need mastery of that weapon (signatures: the job, which asks 20)
//   mult × attack, grown by mastery: × (1 + SK_GROW·(mastery − need)); r / len / half in px; times in ms
//   mag  magic damage (a quarter of the monster's armour counts); el an element (f fire, i ice, l lightning)
//   fx   the "a" event code the client draws it with (C.5)
//   autoHp auto-hunt casts it only above this share of HP

/** Skill power grows with mastery past the level it was learned at: +1.2 % a level. */
const SK_GROW = 0.004;

const SKILL = {
  // ── 대검 sword
  slash: { kind: "a", wk: "sword", need: 1, name: "파워 슬래쉬", mp: 8, cd: 5000, mult: 1.9, r: 46, arc: 75, stag: [600, 360], knock: 14, fx: 80,
    desc: "대검을 크게 휘둘러 앞쪽 부채꼴의 적을 모두 벤다. 맞은 적은 크게 휘청이며 밀려난다." },
  rend: { kind: "a", wk: "sword", need: 10, name: "대지 가르기", mp: 14, cd: 9000, leap: 60, r: 38, mult: 1.7, len: 120, half: 14, wave: 1.2, fx: 81,
    desc: "앞으로 뛰어올라 내려찍고(범위), 착지한 자리에서 일직선으로 땅을 가르는 충격파를 보낸다. 벽은 넘지 못한다." },
  inertia: { kind: "p", wk: "sword", need: 10, name: "거검의 관성", max: 5, ms: 2500, reach: 0.06, critd: 0.06, fx: 110,
    desc: "대검으로 적을 맞힐 때마다 관성이 1 쌓인다(최대 5). 관성 1당 사거리 +6%, 치명타 피해 +8%. 2.5초 동안 맞히지 못하면 사라진다." },
  // ── 단검 dagger
  ambush: { kind: "a", wk: "dagger", need: 1, name: "암습", mp: 7, cd: 6000, len: 110, mult: 1.3, behind: 16, crit: 30, fx: 84,
    desc: "겨눈 적의 등 뒤로 순간이동해 찌른다. 나를 노리지 않던 적에게는 반드시 치명타, 아니면 치명타 확률 +30%." },
  shade: { kind: "a", wk: "dagger", need: 10, name: "그림자 칼날", mp: 12, cd: 8000, n: 3, spread: 15, len: 120, half: 10, mult: 0.5, fx: 85,
    desc: "그림자 칼날 세 자루를 부채꼴로 던진다. 칼날은 적을 꿰뚫고, 맞은 적마다 표식을 하나씩 남긴다." },
  vitals: { kind: "p", wk: "dagger", need: 10, name: "급소 도려내기", max: 5, crit: 3, bleed: 0.08, ms: 4000, spd: 0.2, spdMs: 2000, fx: 111,
    desc: "단검 기본 공격이 표식을 남긴다(최대 5, 10초). 표식 1개당 치명타 확률 +4%. 표식 있는 적을 베면 4초간 출혈(초당 공격력의 12%)을 일으키고 2초간 이동 속도 +20%." },
  // ── 창 spear
  spiral: { kind: "a", wk: "spear", need: 1, name: "나선 찌르기", mp: 8, cd: 5000, len: 110, half: 12, mult: 1.3, far: 0.72, fx: 87,
    desc: "창을 비틀어 일직선을 모두 꿰뚫는다. 끝부분(28%)에 걸린 적은 창끝으로 맞는다." },
  comet: { kind: "a", wk: "spear", need: 10, name: "유성창", mp: 14, cd: 10000, len: 130, half: 20, mult: 0.9, stun: 500, fx: 88,
    desc: "겨눈 쪽으로 130만큼 돌진한다. 길 위의 적을 끝까지 끌고 가 꿰뚫고 0.5초 기절시킨다." },
  tip: { kind: "p", wk: "spear", need: 10, name: "창끝의 거리", at: 0.72, mult: 1.5, ign: 0.35,
    desc: "사거리의 72% 이상 떨어진 적을 맞히면 창끝 일격 — 피해 ×1.5, 방어력의 35%를 무시한다." },
  // ── 스태프 staff
  fireball: { kind: "a", wk: "staff", need: 1, name: "파이어볼", mp: 9, cd: 4000, el: "f", mag: 1, r: 30, mult: 1.6, burn: 0.12, fx: 70,
    desc: "불덩이를 던진다(범위). 떨어진 자리는 3초간 타오른다(0.5초마다 20%). 불 원소." },
  frostring: { kind: "a", wk: "staff", need: 10, name: "서리 고리", mp: 13, cd: 8000, el: "i", mag: 1, r: 56, mult: 0.9, freeze: 1000, push: 18, fx: 71,
    desc: "주변에 서리 고리를 퍼뜨려 적을 밀어내고 느리게 한다. 이미 느려진 적은 1초간 얼어붙는다. 얼음 원소." },
  reso: { kind: "p", wk: "staff", need: 10, name: "마력 공명", n: 3, k: 0.3, fx: 113,
    desc: "스태프 스킬을 세 번 쓰면 공명이 차오른다 — 다음 스태프 스킬은 MP 없이 쓰고 피해 +30%. 불·얼음·번개가 겹치면 원소 반응이 일어난다." },
  // ── 마도서 book
  soulbolt: { kind: "a", wk: "book", need: 1, name: "영혼 화살", mp: 8, cd: 3500, mag: 1, len: 150, arc: 30, spd: 350, mult: 2.0, heal: 0.06, fx: 91,
    desc: "겨눈 적을 쫓아가는 영혼의 화살을 쏜다. 맞히면 준 피해의 6%만큼 HP를 회복한다." },
  gravity: { kind: "a", wk: "book", need: 10, name: "중력 왜곡진", mp: 15, cd: 11000, mag: 1, at: 70, r: 60, ms: 4000, every: 500, pull: 6, mult: 0.4, fx: 92,
    desc: "앞쪽에 4초간 중력의 소용돌이를 연다. 0.5초마다 안의 적을 가운데로 끌어당기며 피해를 준다." },
  brand: { kind: "p", wk: "book", need: 10, name: "금서의 낙인", ms: 6000, k: 0.15, fx: 114,
    desc: "마도서 스킬에 맞은 적에게 6초간 낙인을 새긴다. 낙인 찍힌 적은 누구에게서나 피해를 15% 더 받는다." },
  // ── 활 bow
  pierce: { kind: "a", wk: "bow", need: 1, name: "관통 화살", mp: 7, cd: 4500, spd: 600, len: 180, r: 8, mult: 1.6, fx: 94,
    desc: "빠른 화살 한 대가 일직선의 적을 모두 꿰뚫고 날아간다." },
  leapshot: { kind: "a", wk: "bow", need: 10, name: "도약 사격", mp: 13, cd: 9000, back: 60, n: 5, spread: 30, len: 150, mult: 1.2, per: 2, fx: 95,
    desc: "뒤로 뛰어 물러나며 화살 다섯 대를 부채꼴로 쏜다. 한 적은 최대 두 대까지 맞는다." },
  hawk: { kind: "p", wk: "bow", need: 10, name: "매의 시야", k: 0.15, d0: 40, span: 110, fx: 115,
    desc: "멀리서 쏜 화살일수록 세다 — 쏜 자리에서 40 너머부터 거리에 따라 최대 +25%(150에서)." },

  // ── single-job signatures
  verdict: { kind: "j", job: "swordsman", wk: "sword", need: 20, name: "단죄의 일격", mp: 30, cd: 36000, r: 70, mult: 1.3, miss: 0.9, knock: 20, fx: 83,
    desc: "대검전사의 기술 · 대검을 한 바퀴 휘둘러 주변을 모두 벤다. 잃은 HP가 많을수록 강하다(최대 +90%)." },
  flurry: { kind: "j", job: "thief", wk: "dagger", need: 20, name: "무영난무", mp: 36, cd: 36000, n: 7, every: 220, r: 90, mult: 1.2, per: 0.3, fx: 86,
    desc: "도적의 기술 · 그림자가 되어 주변의 적 사이를 일곱 번 넘나들며 벤다(표식 있는 적부터, 표식 1개당 +30%). 그동안 피해를 입지 않는다." },
  dragon: { kind: "j", job: "lancer", wk: "spear", need: 20, name: "뇌룡승천", mp: 34, cd: 32000, at: 80, r: 64, pull: 20, n: 3, every: 400, mult: 0.4, fin: 0.8, stun: [1500, 600], el: "l", fx: 89,
    desc: "창술사의 기술 · 앞쪽에 번개 용의 기둥을 세워 적을 끌어당기고 세 번 몰아친 뒤, 마지막 일격으로 기절시킨다. 번개 원소." },
  meteor: { kind: "j", job: "wizard", wk: "staff", need: 20, name: "메테오 스톰", mp: 42, cd: 40000, at: 120, r: 80, n: 6, every: 400, hr: 30, mult: 0.6, chain: 0.35, el: "f", mag: 1, fx: 90,
    desc: "마법사의 기술 · 앞쪽에 운석 여섯 개를 떨어뜨린다. 운석마다 번개가 한 적에게 튀어 원소 반응을 일으킨다." },
  pact: { kind: "j", job: "warlock", wk: "book", need: 20, name: "심연의 계약", mp: 40, cd: 38000, ms: 6000, every: 600, bite: 0.8, r: 80, mult: 2.2, brandK: 0.25, mag: 1, fx: 93,
    desc: "마도사의 기술 · 6초간 심연의 짐승을 불러낸다. 짐승은 가까운 적을 물어뜯고, 사라질 때 저주를 터뜨린다(낙인 찍힌 적에게 +25%)." },
  rain: { kind: "j", job: "archer", wk: "bow", need: 20, name: "화살비", mp: 34, cd: 30000, at: 110, r: 70, ms: 3000, every: 300, mult: 0.25, fx: 96,
    desc: "궁수의 기술 · 하늘로 쏘아 올린 화살이 3초간 앞쪽에 비처럼 쏟아져 안의 모든 적을 맞히고 느리게 한다." },

  // ── hybrid signatures (either weapon of the pair)
  crimson: { kind: "h", job: "spellblade", need: 20, name: "원소 마검: 홍련참", mp: 40, cd: 34000, len: 160, half: 20, mult: 2.0, el: "f", fx: 97,
    desc: "마검사의 기술 · 불꽃을 두른 검기를 일직선으로 날린다. 맞은 적마다 번개가 겹쳐 과부하 폭발이 일어난다." },
  traps: { kind: "h", job: "tracker", need: 20, name: "사방의 그림자 덫", mp: 38, cd: 36000, hide: 3000, back: 40, n: 4, ring: 45, ms: 8000, trig: 14, root: 1500, stab: 0.6, shot: 0.8, fx: 98,
    desc: "추적자의 기술 · 3초간 모습을 감추고(이동 속도 +40%) 뒤로 물러나며, 선 자리 둘레에 그림자 덫 넷을 깐다. 밟은 적은 묶이고, 튀어나온 분신이 세 번 찌르고 두 번 쏜다." },
  dive: { kind: "h", job: "dragoon", need: 20, name: "심연의 강림", mp: 44, cd: 40000, at: 120, ghost: 800, r: 110, mult: 2.4, field: 70, ms: 4000, every: 500, drain: 0.25, heal: 0.3, mag: 1, fx: 99,
    desc: "용기사의 기술 · 하늘로 솟구쳐(0.8초 무적) 앞쪽에 내리꽂는다(넓은 범위). 착지한 자리에 4초간 흡혈의 장이 남아 피해의 30%를 회복한다." },
  bloodburst: { kind: "h", job: "hexblade", need: 20, name: "혈흔 폭발", mp: 36, cd: 30000, r: 100, root: 1200, base: 0.6, bleed: 0.5, mark: 0.4, brand: 0.6, fx: 100,
    desc: "주술암살자의 기술 · 주변의 적을 1.2초간 묶은 뒤 피를 터뜨린다 — 방어를 무시하는 고정 피해(공격력의 60% + 출혈 50% + 표식 1개당 40% + 낙인 60%). 표식·출혈·낙인은 사라진다." },
  thunder: { kind: "h", job: "stormrider", need: 20, name: "천뢰의 투창", mp: 38, cd: 32000, len: 200, half: 12, mult: 2.2, el: "l", r: 60, ms: 3000, every: 400, storm: 0.3, fx: 101,
    desc: "폭풍기수의 기술 · 번개 투창이 일직선을 꿰뚫고 맞은 적을 끝까지 끌고 간다. 꽂힌 자리에 3초간 자기 폭풍이 몰아친다." },
  sanctuary: { kind: "h", job: "darkknight", need: 20, name: "불멸의 성역", mp: 20, hpCost: 0.2, cd: 45000, r: 90, ms: 8000, every: 1000, guard: 0.25, mult: 0.2, autoHp: 0.6, fx: 102,
    desc: "암흑기사의 기술 · 현재 HP의 20%를 바쳐 8초간 피의 성역을 편다. 안의 파티원은 받는 피해 -25%, 안의 적은 매초 피해를 입고 그 절반이 가장 다친 파티원을 치유한다." },
};
for (const id of Object.keys(SKILL)) SKILL[id].id = id;
/** The order skills are listed in (per weapon: L1, L10 active, L10 passive; then single, then hybrid signatures). */
const SKILL_ORDER = Object.keys(SKILL);
/** The skills each weapon kind brings, in order. */
const WK_SKILLS = Object.fromEntries(["sword", "dagger", "spear", "staff", "book", "bow"].map((k) => [k, SKILL_ORDER.filter((id) => SKILL[id].wk === k && (SKILL[id].kind === "a" || SKILL[id].kind === "p"))]));
/** A job's signature skill. */
const JOB_SKILL = Object.fromEntries(SKILL_ORDER.filter((id) => SKILL[id].job).map((id) => [SKILL[id].job, id]));
/** The weapon passive of each kind. */
const WK_PASSIVE = Object.fromEntries(SKILL_ORDER.filter((id) => SKILL[id].kind === "p").map((id) => [SKILL[id].wk, id]));
