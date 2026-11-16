// ───────────────────────────── weapon skills: tables ─────────────────────────────
// docs/design/jobs-and-stats.md C. Skills belong to weapons, not classes: each weapon kind brings an active
// skill at mastery 1, another at 10 and five passives at 10, 20, 30, 40 and 50; a single job adds its weapon's signature, a hybrid
// its fusion signature. Functions live in 57-weapon-skills.js.
//
// SKILL[id] = { id, name, kind, wk?, job?, need, mp, cd, mult, …params, mag?, el?, fx, desc }
//   kind "a" weapon active · "p" weapon passive · "j" single-job signature · "h" hybrid signature
//   wk   the weapon it needs in hand (a hybrid signature: either weapon of its job)
//   need mastery of that weapon (signatures: the job's — JOB_WM 20 a single, HYB_WM 15 a hybrid; growth counts from it)
//   mult × attack, grown by mastery: × (1 + SK_GROW·(mastery − need)); r / len / half in px; times in ms
//   mag  magic damage (a quarter of the monster's armour counts); el an element (f fire, i ice, l lightning)
//   fx   the "a" event code the client draws it with (C.5)
//   autoHp auto-hunt casts it only above this share of HP
//   perk   [stat, percentage points] for a mastery stat passive, also usable at reduced strength when borrowed
//   borrow [stat, percentage points] for an original weapon-specific passive's transferable effect

/** Skill power grows with mastery past the level it was learned at: +1.2 % a level. */
const SK_GROW = 0.004;

const SKILL = {
  // ── 대검 sword
  slash: { kind: "a", wk: "sword", need: 1, name: "파워 슬래쉬", mp: 3, hpPct: 0.02, autoHp: 0.35, cd: 3500, mult: 1.45, core: 1.3, r: 46, arc: 75, stag: [600, 360], knock: 14, eat: { drag: 0.3 }, fx: 80,
    desc: "대검을 크게 휘둘러 앞쪽 부채꼴의 적을 모두 벤다. 겨눈 적은 정통으로 맞아 피해가 30% 더 크다. 맞은 적은 휘청이며 밀려나 경직된다. 끌려온 적에게는 +30%." },
  rend: { kind: "a", wk: "sword", need: 10, name: "대지 가르기", mp: 7, hpPct: 0.03, autoHp: 0.35, cd: 9000, leap: 60, r: 38, mult: 1.7, len: 120, half: 14, wave: 1.2, air: 700, fx: 81,
    desc: "앞으로 뛰어올라 내려찍어(범위) 적을 0.7초 띄우고, 착지한 자리에서 일직선으로 땅을 가르는 충격파를 보내 경직시킨다. 벽은 넘지 못한다." },
  inertia: { kind: "p", wk: "sword", need: 10, name: "거검의 관성", max: 5, ms: 2500, reach: 0.06, critd: 0.08, fx: 110, borrow: ["atk", 4],
    desc: "대검으로 적을 맞힐 때마다 관성이 1 쌓인다(최대 5). 관성 1당 사거리 +6%, 치명타 피해 +8%. 2.5초 동안 맞히지 못하면 사라진다." },
  sword_steadfast20: { kind: "p", wk: "sword", need: 20, name: "반걸음 버티기", perk: ["poise", 15],
    desc: "무거운 칼을 받치는 발을 굳힌다. 경직 저항이 15%p 증가한다." },
  sword_fortify30: { kind: "p", wk: "sword", need: 30, name: "벼랑 끝 투지", ps: 140, below: 0.4, guard: 0.15, aspd: 0.2, borrow: ["def", 7],
    desc: "HP가 40% 아래로 떨어지면 받는 피해가 15% 줄고 기본 공격 속도가 20% 빨라진다." },
  sword_weight40: { kind: "p", wk: "sword", need: 40, name: "날에 실은 무게", ps: 141, r: 36, mult: 0.35, borrow: ["atk", 4],
    desc: "기본 공격 3연타의 마지막 일격이 땅을 울려, 맞은 적 둘레 36 안의 적 모두에게 공격력의 35% 피해를 준다." },
  sword_edge50: { kind: "p", wk: "sword", need: 50, name: "칼끝의 결단", ps: 142, below: 0.3, k: 0.35, borrow: ["critd", 8],
    desc: "HP가 30% 아래인 적에게 주는 피해가 35% 증가한다. 쓰러뜨릴 적을 끝까지 벤다." },
  // ── 단검 dagger
  ambush: { kind: "a", wk: "dagger", need: 1, name: "암습", mp: 4, hpPct: 0.015, autoHp: 0.35, cd: 6000, len: 110, mult: 1.8, behind: 16, crit: 30, eat: { air: 0.5 }, fx: 84,
    desc: "겨눈 적의 등 뒤로 순간이동해 찌른다. 나를 노리지 않던 적에게는 반드시 치명타, 아니면 치명타 확률 +30%. 공중에 뜬 적에게는 추가타 +50%." },
  shade: { kind: "a", wk: "dagger", need: 10, name: "그림자 칼날", mp: 6, hpPct: 0.022, autoHp: 0.35, cd: 8000, n: 3, spread: 15, len: 120, half: 10, mult: 0.5, fx: 85,
    desc: "그림자 칼날 세 자루를 부채꼴로 던진다. 칼날은 적을 꿰뚫고, 맞은 적마다 표식을 하나씩 남긴다." },
  vitals: { kind: "p", wk: "dagger", need: 10, name: "급소 도려내기", max: 5, crit: 1.5, bleed: 0.08, ms: 4000, spd: 0.2, spdMs: 2000, fx: 111, borrow: ["crit", 3],
    desc: "단검 기본 공격이 표식을 남긴다(최대 5, 10초). 표식 1개당 치명타 확률 +1.5%. 표식 있는 적을 베면 4초간 출혈(초당 공격력의 8%)을 일으키고 2초간 이동 속도 +20%." },
  dagger_shade20: { kind: "p", wk: "dagger", need: 20, name: "그림자 보폭", perk: ["spd", 10],
    desc: "그림자가 먼저 발을 디딜 만큼 가볍게 걷는다. 이동 속도가 10% 증가한다." },
  dagger_snap30: { kind: "p", wk: "dagger", need: 30, name: "그림자 회수", ps: 143, k: 0.3, borrow: ["aspd", 4],
    desc: "적을 처치할 때마다 단검 스킬들의 남은 재사용 대기시간이 30% 줄어든다." },
  dagger_edge40: { kind: "p", wk: "dagger", need: 40, name: "빈틈을 읽는 눈", ps: 144, borrow: ["crit", 3],
    desc: "아직 내게 한 번도 맞지 않은 적을 처음 벨 때는 반드시 치명타가 터진다(스킬 포함)." },
  dagger_fang50: { kind: "p", wk: "dagger", need: 50, name: "피를 머금은 날", ps: 145, heal: 0.06, aspd: 0.25, ms: 3000, borrow: ["ls", 1.5],
    desc: "적을 처치하면 최대 HP의 6%를 회복하고, 3초 동안 기본 공격 속도가 25% 빨라진다." },
  // ── 창 spear
  spiral: { kind: "a", wk: "spear", need: 1, name: "나선 찌르기", mp: 3, hpPct: 0.018, autoHp: 0.35, cd: 3500, len: 110, half: 12, mult: 1.1, far: 0.72, eat: { frz: 0.6 }, fx: 87,
    desc: "창을 비틀어 일직선을 모두 꿰뚫는다. 끝부분(28%)에 걸린 적은 창끝으로 맞는다. 얼어붙은 적은 얼음째 부서진다(파쇄 +60%)." },
  comet: { kind: "a", wk: "spear", need: 10, name: "유성창", mp: 7, hpPct: 0.026, autoHp: 0.35, cd: 10000, len: 130, half: 20, mult: 0.9, stun: 500, fx: 88,
    desc: "겨눈 쪽으로 130만큼 돌진한다. 길 위의 적을 끝까지 끌고 가 꿰뚫고 0.5초 기절시킨다. 끌려간 적은 모여 광역기에 더 아프다." },
  tip: { kind: "p", wk: "spear", need: 10, name: "창끝의 거리", at: 0.72, mult: 1.5, ign: 0.35, borrow: ["critd", 6],
    desc: "사거리의 72% 이상 떨어진 적을 맞히면 창끝 일격 — 피해 ×1.5, 방어력의 35%를 무시한다." },
  rally_banner: { kind: "a", wk: "spear", need: 15, name: "전열 구호기", mp: 12, cd: 16000, r: 76, ms: 6000, every: 1000, heal: 0.023, atkHeal: 0.06, haste: 0.10, creditMs: 10000, support: true, noAuto: true, fx: 135,
    desc: "6초 동안 깃발 주변의 파티원을 매초 최대 HP 2.3%와 공격력의 6%만큼 회복시키고 기본 공격 속도를 10% 높인다. 시전자 회복은 절반이며 깃발 효과는 겹치지 않는다." },
  spear_guard20: { kind: "p", wk: "spear", need: 20, name: "전열의 간격", perk: ["def", 15],
    desc: "창대를 세워 들고 방어할 틈을 벌린다. 방어력이 15% 증가한다." },
  spear_advance30: { kind: "p", wk: "spear", need: 30, name: "창끝 반동", ps: 146, cut: 500, borrow: ["spd", 4],
    desc: "창끝 일격이 적중할 때마다 창 스킬들의 재사용 대기시간이 0.5초 줄어든다." },
  spear_truss40: { kind: "p", wk: "spear", need: 40, name: "굽히지 않는 창대", perk: ["poise", 15],
    desc: "굽힌 몸과 창대로 적의 힘을 받는다. 경직 저항이 15%p 증가한다." },
  spear_edge50: { kind: "p", wk: "spear", need: 50, name: "하나로 모인 힘", ps: 147, borrow: ["critd", 8],
    desc: "두 발에서 올라온 힘을 창끝 한 점에 모은다. 창끝 일격은 빗맞지 않는 한 반드시 치명타가 된다." },
  // ── 스태프 staff
  fireball: { kind: "a", wk: "staff", need: 1, name: "파이어볼", mp: 8, cd: 3500, el: "f", mag: 1, r: 30, mult: 1.4, burn: 0.1, fx: 70,
    desc: "불덩이를 던진다(범위). 맞은 적에게 화상이 1 쌓이고(최대 3, 6초) 떨어진 자리는 3초간 타오른다. 불 원소." },
  frostring: { kind: "a", wk: "staff", need: 10, name: "서리 고리", mp: 13, cd: 8000, el: "i", mag: 1, r: 56, mult: 0.9, freeze: 1000, push: 18, eat: { drag: 0.3 }, fx: 71,
    desc: "주변에 서리 고리를 퍼뜨려 적을 밀어내고 느리게 한다. 이미 느려진 적은 1초간 빙결된다. 끌려온 적에게는 +30%. 얼음 원소." },
  reso: { kind: "p", wk: "staff", need: 10, name: "마력 공명", n: 3, k: 0.3, fx: 113, borrow: ["mp", 6],
    desc: "스태프 스킬을 세 번 쓰면 공명이 차오른다 — 다음 스태프 스킬은 MP 없이 쓰고 피해 +30%. 불·얼음·번개가 겹치면 원소 반응이 일어난다." },
  staff_mind20: { kind: "p", wk: "staff", need: 20, name: "깊은 마력 그릇", perk: ["mp", 15],
    desc: "공명을 일으키고 남은 마력도 모아 둔다. 최대 MP가 15% 증가한다." },
  staff_chant30: { kind: "p", wk: "staff", need: 30, name: "원소 증폭", ps: 148, k: 0.15, borrow: ["cdr", 4],
    desc: "내가 일으킨 원소 반응(증기 폭발 · 초전도 · 과부하)의 피해가 15% 증가한다." },
  staff_spark40: { kind: "p", wk: "staff", need: 40, name: "정신 집중", ps: 149, ms: 1500, k: 0.4, borrow: ["crit", 3],
    desc: "1.5초 동안 움직이지 않으면 집중한다 — 다음 스킬 한 번의 피해가 40% 증가한다." },
  staff_flood50: { kind: "p", wk: "staff", need: 50, name: "쏟아지는 마력", ps: 150, at: 0.7, k: 0.15, borrow: ["atk", 5],
    desc: "MP가 70% 이상 남아 있는 동안 주는 모든 피해가 15% 증가한다." },
  // ── 마도서 book
  soulbolt: { kind: "a", wk: "book", need: 1, name: "영혼 화살", mp: 8, cd: 3500, mag: 1, len: 150, arc: 30, spd: 350, mult: 2.4, heal: 0.06, fx: 91,
    desc: "겨눈 적을 쫓아가는 영혼의 화살을 쏜다. 맞히면 준 피해의 6%만큼 HP를 회복한다." },
  gravity: { kind: "a", wk: "book", need: 10, name: "중력 왜곡진", mp: 15, cd: 11000, mag: 1, at: 70, r: 60, ms: 4000, every: 500, pull: 6, mult: 0.4, fx: 92,
    desc: "앞쪽에 4초간 중력의 소용돌이를 연다. 0.5초마다 안의 적을 가운데로 끌어당기며 피해를 준다. 끌려간 적은 모여 광역기에 더 아프다." },
  brand: { kind: "p", wk: "book", need: 10, name: "금서의 낙인", ms: 6000, k: 0.15, fx: 114, borrow: ["cdr", 3],
    desc: "마도서 스킬에 맞은 적에게 6초간 낙인을 새긴다. 낙인 찍힌 적은 누구에게서나 피해를 15% 더 받는다." },
  revive_binding: { kind: "a", wk: "book", need: 15, name: "되살림 제본", mp: 19, cd: 18000, r: 105, heal: 0.19, atkHeal: 0.30, creditMs: 10000, support: true, noAuto: true, fx: 136,
    desc: "가까이에서 가장 위급한 파티원을 최대 HP 19%와 공격력의 30%만큼, 다음 파티원을 절반만큼 즉시 회복시킨다. 회복할 파티원이 없으면 자신이 절반을 회복한다." },
  book_margin20: { kind: "p", wk: "book", need: 20, name: "널찍한 여백", perk: ["hp", 12],
    desc: "여백에 회복 주문을 적어 몸에 새긴다. 최대 HP가 12% 증가한다." },
  book_clause30: { kind: "p", wk: "book", need: 30, name: "낙인 전염", ps: 151, n: 2, r: 64, borrow: ["cdr", 4],
    desc: "낙인 찍힌 적이 쓰러지면, 남은 낙인이 둘레 64 안의 적 둘에게 옮겨 붙는다." },
  book_ink40: { kind: "p", wk: "book", need: 40, name: "묵향의 잔재", perk: ["mp", 15],
    desc: "마르지 않은 글씨에서 남은 마력을 건져 올린다. 최대 MP가 15% 증가한다." },
  book_return50: { kind: "p", wk: "book", need: 50, name: "영혼 흡수", ps: 152, k: 0.05, borrow: ["ls", 1.25],
    desc: "낙인 찍힌 적에게 준 피해의 5%만큼 HP를 회복한다." },
  // ── 활 bow
  pierce: { kind: "a", wk: "bow", need: 1, name: "관통 화살", mp: 7, cd: 4500, spd: 600, len: 180, r: 8, mult: 1.6, fx: 94,
    desc: "빠른 화살 한 대가 일직선의 적을 모두 꿰뚫고 날아간다." },
  leapshot: { kind: "a", wk: "bow", need: 10, name: "도약 사격", mp: 13, cd: 9000, back: 60, n: 5, spread: 30, len: 150, mult: 1.2, per: 2, fx: 95,
    desc: "뒤로 뛰어 물러나며 화살 다섯 대를 부채꼴로 쏜다. 한 적은 최대 두 대까지 맞는다." },
  hawk: { kind: "p", wk: "bow", need: 10, name: "매의 시야", k: 0.15, d0: 40, span: 110, fx: 115, borrow: ["atk", 4],
    desc: "멀리서 쏜 화살일수록 세다 — 쏜 자리에서 40 너머부터 거리에 따라 최대 +15%(150에서)." },
  bow_lithe20: { kind: "p", wk: "bow", need: 20, name: "나뭇가지 걸음", perk: ["spd", 10],
    desc: "잔가지를 밟아도 휘어지기 전에 발을 뗀다. 이동 속도가 10% 증가한다." },
  bow_string30: { kind: "p", wk: "bow", need: 30, name: "연속 사격", ps: 153, n: 5, k: 0.3, borrow: ["aspd", 4],
    desc: "기본 공격 화살 다섯 발마다 같은 쪽으로 화살 한 발을 더 쏜다(위력 30%)." },
  bow_focus40: { kind: "p", wk: "bow", need: 40, name: "바람 틈의 표적", perk: ["crit", 6],
    desc: "바람이 멈추는 찰나에 과녁의 작은 점을 겨눈다. 치명타 확률이 6%p 증가한다." },
  bow_quill50: { kind: "p", wk: "bow", need: 50, name: "약점 포착", ps: 154, ms: 4000, k: 0.15, borrow: ["atk", 5],
    desc: "치명타를 맞힌 적은 4초 동안 나에게 받는 피해가 15% 늘어난다." },

  // ── single-job signatures
  verdict: { kind: "j", job: "swordsman", wk: "sword", need: 20, name: "단죄의 일격", mp: 16, hpPct: 0.05, autoHp: 0.35, cd: 36000, r: 70, mult: 1.3, miss: 0.9, inert: 0.1, knock: 20, secondaryDamageType: "fire", fx: 83,
    desc: "대검전사의 기술 · 불을 두른 대검으로 주변을 벤다. 잃은 HP가 많을수록 강하고(최대 +90%), 쌓인 관성을 모두 터뜨려 관성 1당 피해가 10% 늘어난다." },
  flurry: { kind: "j", job: "thief", wk: "dagger", need: 20, name: "무영난무", mp: 18, hpPct: 0.035, autoHp: 0.35, cd: 36000, n: 7, every: 220, r: 90, mult: 1.2, per: 0.3, fx: 86,
    desc: "도적의 기술 · 그림자가 되어 주변의 적 사이를 일곱 번 넘나들며 벤다(표식 있는 적부터, 표식 1개당 +30%). 그동안 피해를 입지 않는다." },
  dragon: { kind: "j", job: "lancer", wk: "spear", need: 20, name: "뇌룡승천", mp: 17, hpPct: 0.04, autoHp: 0.35, cd: 32000, at: 80, r: 64, pull: 20, n: 3, every: 400, mult: 0.4, fin: 0.8, stun: [1500, 600], el: "l", fx: 89,
    desc: "창술사의 기술 · 앞쪽에 번개 용의 기둥을 세워 적을 끌어당기고 세 번 몰아친 뒤, 마지막 일격으로 기절시킨다. 번개 원소." },
  meteor: { kind: "j", job: "wizard", wk: "staff", need: 20, name: "메테오 스톰", mp: 42, cd: 40000, at: 120, r: 80, n: 6, every: 400, hr: 30, mult: 0.6, chain: 0.35, el: "f", mag: 1, fx: 90,
    desc: "마법사의 기술 · 앞쪽에 운석 여섯 개를 떨어뜨린다. 운석마다 번개가 한 적에게 튀어 원소 반응을 일으킨다." },
  pact: { kind: "j", job: "warlock", wk: "book", need: 20, name: "심연의 계약", mp: 40, cd: 38000, ms: 6000, every: 600, bite: 0.8, r: 80, mult: 2.2, brandK: 0.25, mag: 1, fx: 93,
    desc: "마도사의 기술 · 6초간 심연의 짐승을 불러낸다. 짐승은 가까운 적을 물어뜯고, 사라질 때 저주를 터뜨린다(낙인 찍힌 적에게 +25%)." },
  rain: { kind: "j", job: "archer", wk: "bow", need: 20, name: "화살비", mp: 34, cd: 30000, at: 110, r: 70, ms: 3000, every: 300, mult: 0.25, armorPenPct: 25, fx: 96,
    desc: "궁수의 기술 · 하늘로 쏘아 올린 화살이 3초간 앞쪽에 비처럼 쏟아져 안의 모든 적을 맞히고 느리게 한다." },

  // ── hybrid signatures (either weapon of the pair)
  crimson: { kind: "h", job: "spellblade", need: 15, name: "원소 마검: 홍련참", mp: 40, cd: 34000, len: 160, half: 20, mult: 1.6, el: "f", fx: 97,
    desc: "마검사의 기술 · 불꽃을 두른 검기를 일직선으로 날린다. 맞은 적마다 번개가 겹쳐 과부하 폭발이 일어난다." },
  traps: { kind: "h", job: "tracker", need: 15, name: "사방의 그림자 덫", mp: 38, cd: 36000, hide: 3000, back: 40, n: 4, ring: 45, ms: 8000, trig: 14, root: 1500, stab: 0.35, shot: 0.45, fx: 98,
    desc: "추적자의 기술 · 3초간 모습을 감추고(이동 속도 +40%) 뒤로 물러나며, 선 자리 둘레에 그림자 덫 넷을 깐다. 밟은 적은 묶이고, 튀어나온 분신이 세 번 찌르고 두 번 쏜다." },
  dive: { kind: "h", job: "dragoon", need: 15, name: "심연의 강림", mp: 44, cd: 40000, at: 120, ghost: 800, r: 110, mult: 2.0, field: 70, ms: 4000, every: 500, drain: 0.2, heal: 0.3, secondaryDamageType: "dark", mag: 1, fx: 99,
    desc: "용기사의 기술 · 하늘로 솟구쳐(0.8초 무적) 착지하며 번개 충격파로 적을 감전시킨다. 착지 지점에 4초간 어둠 장판을 남기고, 장판이 준 피해의 30%만큼 자신의 HP를 회복한다." },
  bloodburst: { kind: "h", job: "hexblade", need: 15, name: "혈흔 폭발", mp: 36, cd: 30000, r: 100, root: 1200, base: 0.6, bleed: 0.5, mark: 0.4, brand: 0.6, fx: 100,
    desc: "주술암살자의 기술 · 주변의 적을 1.2초간 묶은 뒤 피를 터뜨린다 — 방어를 무시하는 고정 피해(공격력의 60% + 출혈 50% + 표식 1개당 40% + 낙인 60%). 표식·출혈·낙인은 사라진다." },
  sanctuary: { kind: "h", job: "darkknight", need: 15, name: "불멸의 성역", mp: 20, hpCost: 0.2, cd: 45000, r: 90, ms: 8000, every: 1000, guard: 0.25, mult: 0.2, autoHp: 0.6, fx: 102,
    desc: "암흑기사의 기술 · 현재 HP의 20%를 바쳐 8초간 피의 성역을 편다. 안의 파티원은 받는 피해 -25%, 안의 적은 매초 피해를 입고 그 절반이 가장 다친 파티원을 치유한다." },
  // the hybrid expansion (docs/design/jobs-and-stats.md "Hybrid expansion"): fx 120–128
  crosscut: { kind: "h", job: "bladedancer", need: 15, name: "십자 난도", mp: 36, cd: 32000, r: 64, arc: 100, mult: 1.0, marks: 2, stab: 0.6, per: 0.2, crit: 30, armorPenPct: 25, secondaryDamageType: "bleed", fx: 120,
    desc: "검무사의 기술 · 대검으로 앞을 휩쓸어 표식 둘을 새기고, 단검으로 파고들어 출혈 피해를 더한다(표식 1개당 +20%, 나를 노리지 않던 적에게는 반드시 치명타). 관성이 가득 찬다." },
  elemfan: { kind: "h", job: "trickster", need: 15, name: "원소 비수", mp: 36, cd: 30000, len: 140, half: 12, spread: 18, mult: 0.9, rx: 3, slow: 2000, mag: 1, secondaryDamageType: "dark", fx: 124,
    desc: "환술사의 기술 · 번개와 어둠이 깃든 비수 셋을 부채꼴로 던져 표식을 남긴다. 비수마다 붙은 불·얼음·번개 문양 중 둘이 한 적에 겹치면 원소 반응이 터진다(적 셋까지). 얼음 문양은 적을 느리게 한다." },
  frostspire: { kind: "h", job: "spellspear", need: 15, name: "빙결창", mp: 36, cd: 30000, len: 150, half: 14, mult: 1.4, far: 0.72, freeze: 1000, r: 44, burst: 1.0, el: "i", fx: 125,
    desc: "마창사의 기술 · 얼음을 두른 창을 일직선으로 내지른다. 맞은 적은 느려지고, 창끝(끝 28%)에 걸린 적은 1초간 얼어붙는다. 창끝이 닿은 자리에서 얼음 기둥이 솟아 주변을 친다. 얼음 원소." },
  runecircle: { kind: "h", job: "runesage", need: 15, name: "메아리 법진", mp: 46, cd: 45000, at: 80, r: 64, ms: 5000, every: 1000, mult: 0.2, rxK: 0.5, mag: 1, fx: 126,
    desc: "룬술사의 기술 · 앞쪽에 5초간 룬 법진을 새긴다. 1초마다 안의 적을 치고 낙인을 새기며, 불·얼음·번개가 번갈아 깃들어 두 박동마다 법진 안에서 원소 반응이 메아리친다." },
  inkshot: { kind: "h", job: "runearcher", need: 15, name: "룬 먹화살", mp: 36, cd: 30000, n: 5, spread: 24, len: 170, r: 8, mult: 0.8, per: 2, brandK: 0.4, mag: 1, secondaryDamageType: "dark", fx: 128,
    desc: "각인궁사의 기술 · 냉기와 어둠을 담은 룬 화살 다섯 대를 부채꼴로 쏜다. 적에게 오한과 낙인을 남기고, 이미 낙인 찍힌 적은 +40% 피해를 입는다. 한 적은 최대 두 대까지 맞는다." },
  hammer_stamp: { kind: "a", wk: "hammer", need: 1, name: "쐐기찍기", mp: 3, hpPct: 0.02, autoHp: 0.35, cd: 6000, center: 23, r: 28, wind: 200, mult: 2.55, splashMult: 1, stun: 180, fx: 130,
    desc: "앞쪽을 내려찍어 가장 가까운 적에게 정타를 가하고 두 적까지 충격을 준다. 맞은 일반 적은 잠깐 휘청인다." },
  hammer_fault: { kind: "a", wk: "hammer", need: 10, name: "금맥 벌리기", mp: 5, hpPct: 0.03, autoHp: 0.35, cd: 10000, center: 24, r: 31, wind: 200, mult: 2.85, splashMult: 1.10, crackMult: 1.25, hpRefund: 0.5, fx: 131,
    desc: "해머로 땅을 갈라 세 적까지 맞힌다. 내가 새긴 균열 두 개를 터뜨리면 정타 피해가 25% 늘고 소모한 HP의 절반을 돌려받는다." },
  hammer_final: { kind: "j", job: "destroyer", wk: "hammer", need: 20, name: "파성추", mp: 10, hpPct: 0.05, autoHp: 0.35, cd: 32000, center: 22, r: 36, wind: 400, mult: 4.5, splashMult: 1.60, crackMult: 1.35, hpRefund: 0.5, brace: 0.25, armorPenPct: 35, fx: 132,
    desc: "파괴자의 기술. 준비 중 경직이 25% 줄어든다. 내가 새긴 균열 두 개를 터뜨리면 정타 피해가 35% 늘고 소모한 HP의 절반을 돌려받는다." },
  hammer_crack: { kind: "p", wk: "hammer", need: 10, name: "균열 새기기", max: 2, ms: 5000, borrow: ["atk", 4],
    desc: "해머 기본 공격 정타에 맞은 적에게 5초 동안 내 균열을 남긴다. 최대 두 개까지 쌓인다." },
  hammer_brace: { kind: "p", wk: "hammer", need: 20, name: "버팀발", brace: 0.20, borrow: ["poise", 8],
    desc: "해머를 들어 올리는 동안 받는 경직이 20% 줄어든다. 파성추 중에는 더 큰 효과를 적용한다." },
  hammer_hold: { kind: "p", wk: "hammer", need: 30, name: "금의 결", ms: 7000, borrow: ["def", 6],
    desc: "내 해머 정타가 남긴 균열의 지속 시간이 5초에서 7초로 늘어난다." },
  hammer_breath: { kind: "p", wk: "hammer", need: 40, name: "반동 호흡", discount: 0.01, borrow: ["hp", 6],
    desc: "해머 기술의 HP 소모가 최대 HP의 1%만큼 줄어든다. 최소 소모량은 최대 HP의 1%다." },
  hammer_heart: { kind: "p", wk: "hammer", need: 50, name: "심철의 파문", bonus: 1.08, borrow: ["critd", 8],
    desc: "해머 기술로 내 균열 두 개를 실제로 터뜨리면 정타 피해가 추가로 8% 늘어난다." },
  ironsiege: { kind: "h", job: "mercenary", need: HYB_WM, name: "철쇄 돌진", mp: 24, cd: 28000, len: 48, half: 11, r: 23, mult: 2.45, sweep: 1.05, armorPenPct: 30, fx: 133,
    desc: "창으로 열린 길을 따라 전진하고 끝에서 해머를 내려친다. 돌진과 충격에 동시에 걸린 적은 정타 한 번을 받는다." },
  oathward: { kind: "h", job: "paladin", need: HYB_WM, name: "성문 서약", mp: 26, cd: 26000, r: 34, mult: 1.55, healR: 88, heal: 0.10, atkHeal: 0.30, creditMs: 10000, fx: 134,
    desc: "주변을 내리치고 자신과 반경 88 안의 파티원에게 최대 HP 10% + 성기사 공격력의 30%를 회복시킨다. 회복한 파티원이 10초 안에 처치에 기여하면 성기사도 직업 경험치를 받는다." },
  // ── the combo actives (docs/design/skill-combos.md, fx 140–145): mastery 25, after the signatures so a fresh bar keeps them
  cleave: { kind: "a", wk: "sword", need: 25, name: "처형 내려베기", mp: 8, hpPct: 0.03, autoHp: 0.35, cd: 16000, wind: 500, len: 56, half: 18, n: 3, mult: 2.4, eat: { stg: 0.6, air: 0.5, frz: 0.6 }, fx: 140,
    desc: "0.5초 동안 대검을 치켜들었다가 앞의 적 셋까지 내려벤다. 경직된 적 +60%, 공중에 뜬 적 +50%, 얼어붙은 적 +60% — 그 상태는 풀린다." },
  rupture: { kind: "a", wk: "dagger", need: 25, name: "급소 터뜨리기", mp: 3, hpPct: 0.01, autoHp: 0.35, cd: 3500, len: 44, mult: 0.5, eat: { mk: 0.3, brand: 0.5 }, pop: 3, r: 32, splash: 0.4, fx: 141,
    desc: "겨눈 적의 표식을 한꺼번에 터뜨린다 — 표식 1개당 +30%, 낙인이 있으면 +50%. 표식이 셋 이상이면 주변 적도 폭발에 휘말린다." },
  hook: { kind: "a", wk: "spear", need: 25, name: "갈고리 창", mp: 5, hpPct: 0.02, autoHp: 0.35, cd: 7000, len: 120, half: 14, n: 3, to: 18, hold: 400, mult: 0.7, fx: 142,
    desc: "창끝 갈고리를 일직선으로 던져 맞은 적 셋까지 눈앞으로 끌어당기고 경직시킨다. 끌려온 적은 광역기에 더 아프다." },
  ignite: { kind: "a", wk: "staff", need: 25, name: "점화 폭발", mp: 14, cd: 14000, wind: 400, el: "f", mag: 1, at: 90, r: 40, mult: 1.3, eat: { brn: 0.35, frz: 0.8 }, fx: 143,
    desc: "0.4초 주문을 모아 겨눈 자리를 터뜨린다. 화상 1당 +35%(화상은 사라진다), 얼어붙은 적은 열충격으로 +80%. 불 원소." },
  drain: { kind: "a", wk: "book", need: 25, name: "영혼 착취", mp: 16, cd: 15000, mag: 1, len: 110, half: 12, n: 6, every: 400, mult: 0.35, fin: 0.8, heal: 0.15, eat: { brand: 1.0 }, fx: 144,
    desc: "2.4초 동안 겨눈 쪽 적 둘에게 영혼의 줄기를 이어 0.4초마다 피해를 주고 그 15%를 회복한다. 마지막 줄기는 낙인을 터뜨려 +100%. 다른 기술을 쓰면 끊긴다." },
  snipe: { kind: "a", wk: "bow", need: 25, name: "저격", mp: 12, cd: 18000, wind: 700, len: 220, half: 8, n: 2, mult: 1.8, eat: { stg: 0.5, air: 0.6, frz: 0.5 }, fx: 145,
    desc: "0.7초 시위를 끝까지 당겨 아주 멀리 일직선으로 쏜다(앞의 둘까지). 경직된 적 +50%, 공중에 뜬 적 +60%, 얼어붙은 적 +50%." },
  // ── job Lv.30 spins (owner, 2026-11-15): held whirls that follow the caster and pay their cost every beat (`spin` prop, 57)
  whirl: { kind: "j", job: "swordsman", wk: "sword", need: 20, jl: 30, name: "돌개바람", mp: 6, hpPct: 0.02, autoHp: 0.35, cd: 12000, ms: 5000, every: 300, r: 46, mult: 0.33, mpT: 0.03, hpT: 0.0047, fx: 146,
    desc: "대검전사의 기술 (직업 Lv.30) · 5초 동안 대검을 들고 회오리처럼 돌며 움직이고, 주변의 모든 적을 0.3초마다 벤다. 도는 동안 마나와 HP를 조금씩 쓰며, 마나가 모자라거나 다른 스킬을 쓰면 멈춘다." },
  musou: { kind: "j", job: "lancer", wk: "spear", need: 20, jl: 30, name: "무쌍난무", mp: 8, cd: 10000, ms: 3000, every: 200, r: 52, mult: 0.32, mpT: 0.04, fx: 147,
    desc: "창술사의 기술 (직업 Lv.30) · 3초 동안 창을 휘휘 돌리며 움직이고, 창 길이만큼 둘러싼 모든 적을 0.2초마다 찌른다. 도는 동안 마나를 조금씩 쓰며, 마나가 모자라거나 다른 스킬을 쓰면 멈춘다." },
  // ── the first wave of new weapon skills (docs/design/skill-ideas.md §9, fx 148–159); after everything older so a fresh bar keeps its old skills
  stomp: { kind: "a", wk: "hammer", need: 40, name: "땅울림 발구르기", mp: 2, hpPct: 0.015, autoHp: 0.35, cd: 4000, stomp: true, r: 52, mult: 0.5, air: 600, stg: 600, gauge: 0.1, fx: 148,
    desc: "쿵! 발을 굴러 둘레 52 안의 적을 친다(공격력의 50%). 작은 괴물은 0.6초 통째로 튀어 오르고(공중), 정예는 경직되며, 보스는 무력화 게이지가 10% 깎인다. 준비 동작이 없다." },
  mortar: { kind: "a", wk: "bow", need: 5, name: "곡사 폭약 화살", mp: 6, cd: 7000, at: 150, delay: 500, r: 40, mult: 0.7, marks: 2, fx: 149,
    desc: "하늘로 쏜 화살이 0.5초 뒤 겨눈 자리(최대 150)에 떨어져 둘레 40의 괴물을 치고(공격력의 70%), 맞은 적마다 폭약 깃(표식)을 둘 꽂는다." },
  dragonpierce: { kind: "a", wk: "bow", need: 45, name: "용뼈 관통 사격", mp: 14, cd: 20000, wind: 800, len: 200, half: 14, mult: 1.6, back: 20, eat: { mk: 0.25, brand: 0.5 }, fx: 150,
    desc: "0.8초 몸을 낮춰 활을 한껏 당긴 뒤, 일직선 200의 적을 모두 꿰뚫는다(공격력의 160%). 반동에 20 밀려난다. 박힌 표식 1개당 +25%(최대 5), 낙인 +50% — 표식과 낙인은 터진다. 매의 시야가 있으면 언제나 최대 거리로 친다." },
  rollshot: { kind: "a", wk: "bow", need: 40, name: "구르며 쏘기", mp: 4, cd: 3500, back: 40, len: 170, mult: 1.0, win: 350, ace: 2.2, dashCut: 2000, fx: 151,
    desc: "뒤로 40 물러나며 화살 한 대를 쏜다. 구르기(Space)가 끝난 뒤 0.35초 안에 쏘면 회심의 화살 — 피해 ×2.2, 적을 꿰뚫고, 구르기 재사용 대기가 2초 줄어든다." },
  chainbolt: { kind: "a", wk: "staff", need: 15, name: "연쇄 번개", mp: 10, cd: 3500, el: "l", mag: 1, at: 130, n: 5, jr: 60, mult: 0.5, rxK: 0.25, fx: 152,
    desc: "겨눈 적(최대 130)에게 번개를 내리꽂고, 번개는 60 안의 다른 적으로 튀어 모두 다섯을 친다(각 공격력의 50%). 불붙거나 얼어붙은 적을 지나면 원소 반응이 한 번 터진다(위력 25%). 번개 원소." },
  shoulder: { kind: "a", wk: "sword", need: 15, name: "어깨 돌파", mp: 5, hpPct: 0.02, autoHp: 0.35, cd: 9000, len: 90, half: 16, mult: 0.9, stun: 1000, knock: 14, fx: 153,
    desc: "어깨로 밀고 90 앞으로 돌진해 길 위의 적을 끝까지 끌고 간다(공격력의 90%). 벽에 처박히거나 둘 이상이 한데 엉킨 적은 1초 기절하고 경직되며, 나머지는 밀려난다. 끌려간 적은 광역기에 더 아프다." },
  snare: { kind: "a", wk: "bow", need: 30, name: "올무 화살", mp: 6, cd: 10000, at: 120, ms: 10000, max: 2, trig: 10, root: [2500, 1500, 500], pull: 30, mult: 0.5, fx: 154,
    desc: "올무를 매단 화살을 땅(최대 120)에 박아 둔다(10초, 둘까지). 처음 밟은 괴물은 2.5초 묶이고(정예 1.5초, 보스 0.5초) 경직으로 친다. 30 안의 둘은 올무 쪽으로 끌려온다." },
  bladevortex: { kind: "a", wk: "dagger", need: 40, name: "칼날 소용돌이", mp: 2, cd: 3500, max: 5, ms: 8000, r: 36, every: 400, per: 0.12, cap: 3, n: 5, spread: 14, len: 110, half: 10, fan: 0.6, fx: 155, fx2: 156,
    desc: "부를 때마다 칼날 하나가 내 주위를 돈다(최대 5, 8초 — 부를 때마다 다시 8초). 0.4초마다 둘레 36에서 가장 가까운 적 셋을 칼날 1개당 공격력의 12%로 벤다. 다섯 자루일 때 다시 부르면 칼날이 부채꼴로 흩어져(각 60%) 맞은 적마다 표식을 남기고 소용돌이가 끝난다." },
  smoke: { kind: "a", wk: "dagger", need: 5, name: "연막탄", mp: 5, cd: 12000, util: true, noAuto: true, at: 90, r: 48, ms: 4000, every: 250, shot: 0.3, fx: 157,
    desc: "겨눈 자리(최대 90)에 4초간 연막을 터뜨린다. 연기 속의 괴물(보스 제외)은 노리던 상대를 잊고 헤맨다 — 그런 적에게 암습은 반드시 치명타. 연기 속의 파티원은 화살·투사체 피해를 30% 덜 받는다." },
  parry: { kind: "a", wk: "sword", need: 5, name: "칼등 받아치기", mp: 3, cd: 5000, util: true, noAuto: true, ms: 350, arc: 90, stg: 1200, r: 40, mult: 1.2, inert: 2, cdCut: 0.5, gauge: 0.25, whiff: 400, exposed: 0.2, fx: 158,
    desc: "0.35초 동안 칼을 눕혀 앞을 막는다. 그 사이 앞에서 날아든 일격은 막아 내고, 친 괴물은 1.2초 휘청이며(보스는 무력화 게이지 25%) 앞 40의 적에게 반격한다(공격력의 120%). 관성 +2, 재사용 대기 절반. 헛막으면 0.4초 동안 받는 피해가 20% 늘어난다." },
  mountain: { kind: "a", wk: "sword", need: 30, name: "산 가르기", mp: 8, hpPct: 0.03, autoHp: 0.35, cd: 16000, holdMs: 1800, tiers: [500, 1000, 1400], ks: [1.0, 1.6, 2.6, 4.2], holdSpd: 0.3, brace: 0.5, len: 60, half: 20, eat3: { stg: 0.4, air: 0.4 }, fx: 159,
    desc: "누르고 있는 동안 대검을 끌어올려 힘을 모으고(걸음 30%), 놓거나 다시 누르면 앞 60을 넓게 가른다. 0.5초 ×1.6 · 1초 ×2.6 · 1.4초 ×4.2 — 1.8초를 넘기면 힘이 새어 ×2.6. 모으는 동안 처음 맞는 일격은 절반만 받고 한 단계 더 모인다. 관성 5는 첫 단계부터 시작한다. 3단계는 경직·공중 적에게 +40%." },
};
for (const [id, sk] of Object.entries(SKILL)) {
  sk.id = id;
  // a job skill comes at the signature level unless the row names its own (`jl`)
  if (sk.job) sk.jobNeed = sk.jl || JOB_PROGRESS.signature;
}
/** The order skills are listed in (per weapon: L1, L10 active, L10 passive; then single, then hybrid signatures — the first six, then the nine of the expansion). */
const SKILL_ORDER = Object.keys(SKILL);
/** The skills each weapon kind brings, in order. */
const WK_SKILLS = Object.fromEntries(WK_ORDER.map((k) => [k, SKILL_ORDER.filter((id) => SKILL[id].wk === k && (SKILL[id].kind === "a" || SKILL[id].kind === "p"))]));
/** A job's signature skill. */
const JOB_SKILL = Object.fromEntries(SKILL_ORDER.filter((id) => SKILL[id].job && !SKILL[id].jl).map((id) => [SKILL[id].job, id]));
/** The weapon passive of each kind. */
const WK_PASSIVE = Object.fromEntries(WK_ORDER.map(wk => [wk, WK_SKILLS[wk].find(id => SKILL[id].kind === "p")]));
