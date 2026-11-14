/**
 * 테일즈테일즈 (Tales Tales) — the whole game world, as plain rules.
 *
 * A party-hunting RPG set where worlds overlap: a fantasy meadow, a neon city
 * and a crystal rift all hang off one hub. Three ideas drive the rules:
 *   - loot is rolled, not listed: eight slots of gear, each piece with a rarity,
 *     random affixes and sockets; legendaries carry a unique power, set pieces
 *     grow stronger together, and runes in the right order form runewords;
 *   - a hunting ground is worth another lap: kill streaks, per-monster mastery,
 *     bounties that renew themselves, and a field boss the kills call out;
 *   - experience never stops mattering: it levels you up, and it can also be
 *     spent, without limit, on permanent training of your base stats;
 *   - hunting together pays: a party shares kills, quest credit and a bonus;
 *   - and there is a quiet side: campfires to sit by, fish to catch and cook,
 *     guilds, and a handful of emotes;
 *   - and a long game: waypoints, a return scroll, daily tasks, achievements and
 *     titles, a monster collection, a half-hourly world event, and first steps.
 *
 * This file is the single source of truth. The room (`room.ts`) only moves
 * bytes — it feeds actions and the clock in and fans per-player views out — and
 * the browser gets every table from `defs()` and every map from the server.
 *
 * Real-time notes: time is never read here (the room passes `now` in),
 * randomness comes from a seed in the state, and the world is advanced in
 * place; only characters are persisted (`exportChar`).
 */

export const meta = { game: "테일즈테일즈", minPlayers: 1, maxPlayers: 40 };

const T = 16;
/** The bag: INV_BASE slots to start, grown with bag_expand to INV_MAX (sheet field bagCap, 46-bag.js). */
const INV_BASE = 40, INV_MAX = 100;
const MAXLV = 50;
const STACK = 99;
/** The order the bag's tidy button puts things in. */
const SORT_KIND = ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet", "rune", "pot", "food", "fish", "scroll", "buff", "camp", "revive", "pet", "mat", "furn"];
const VIEW_X = 280;
const VIEW_Y = 280;
const BASE_SPD = 48;
const PARTY_MAX = 4;
const PARTY_RANGE = 340;
/** Share of a kill's experience each member gets, by how many are in range. */
const PARTY_SHARE = [1, 0.8, 0.7, 0.65];

// ───────────────────────────── tables ─────────────────────────────

/** A weapon kind decides how a basic attack lands. */
const WKIND = {
  // unhurried, weighty blows: each lands harder than a quick one would
  sword: { name: "양손검", cd: 920, range: 34, fx: 0, cleave: 3, kb: 9, mult: 1.3, arc: 65 },
  dagger: { name: "단검", cd: 520, range: 26, fx: 3, kb: 4, mult: 1.35, arc: 35 },
  spear: { name: "창", cd: 780, range: 54, fx: 4, line: 3, kb: 7, mult: 1.4, arc: 25 },
  staff: { name: "마법지팡이", cd: 980, range: 100, fx: 2, kb: 6, mult: 1.2, arc: 40 },
  book: { name: "마법책", cd: 800, range: 84, fx: 5, splash: 26, mult: 1, kb: 4, arc: 40 },
};
/**
 * Basic attacks come in threes: two strokes and a finisher. Strike again within
 * COMBO_MS of the last blow and the count goes on; wait longer and it starts over.
 */
const COMBO_MS = 700, FINISH = { mult: 1.4, kb: 1.8, stun: 280 };
/**
 * Aim. Every player aims along one of AIM_N directions on the ground (0 = +x, AIM_N/4 = +y),
 * set by the way they last walked or sent with an attack or skill. A basic attack reaches
 * only into its weapon's arc (`arc`, degrees either side of the aim); skills that pick a
 * target look within AIM_CONE degrees either side; lines, throws and dashes go straight
 * along the aim. Nothing behind you is ever hit by a blow aimed forward.
 */
const AIM_N = 64, AIM_CONE = 40;
const CLASSES = {
  warrior: { name: "전사", arm: "양손검", wk: ["sword"], hp: [130, 24], mp: [30, 4], atk: [10, 2.6], def: [3, 0.9], crit: 8 },
  rogue: { name: "도적", arm: "단검", wk: ["dagger"], hp: [92, 16], mp: [40, 6], atk: [7, 1.9], def: [1, 0.5], crit: 22 },
  lancer: { name: "창술사", arm: "창", wk: ["spear"], hp: [112, 20], mp: [36, 5], atk: [9, 2.3], def: [2, 0.7], crit: 12 },
  mage: { name: "마도사", arm: "마법지팡이 · 마법책", wk: ["staff", "book"], hp: [80, 15], mp: [60, 10], atk: [9, 2.4], def: [1, 0.55], crit: 10 },
};

/**
 * Every class plays around one thing of its own, shown in the class gauge:
 *   전사 투지 (grit, 0–100): earned by striking and by being struck, spent in one blast;
 *   도적 표식 (marks, 0–5 on each monster): left by every stab, cashed in all at once;
 *   창술사 창끝 (the spear's tip): a blow that lands at the far end of the reach hits
 *     harder and builds 집중 (focus, 0–5); full focus empowers the next skill;
 *   마도사 원소 엮기 (weaving): fire, ice and lightning react when one lands on another.
 * `el` is a mage spell's element; `emp` says what full focus adds to a lancer's skill.
 */
const GRIT_MAX = 100, MARK_MAX = 5, FOCUS_MAX = 5, MARK_MS = 10000, FOCUS_MS = 10000, WEAVE_MS = 5000;
const TIP = { at: 0.72, mult: 1.5, flinch: 250 };
const ELEM = { f: "불", i: "얼음", l: "번개" };
/** What two elements make together (either order), and the third element's partner in a surge. */
const REACT = {
  fi: { id: "steam", name: "증기 폭발", r: 62, mult: 1.3 },
  il: { id: "super", name: "초전도", r: 56, mult: 0.6, vuln: 6000 },
  fl: { id: "over", name: "과부하", r: 50, mult: 1.1, knock: 26 },
};
const pairKey = (a, b) => [a, b].sort().join("");
const SURGE_NEXT = { f: "i", i: "l", l: "f" };

const SKILLS = {
  warrior: [
    { id: "toss", name: "대검 투척", lv: 3, mp: 8, cd: 6000, mult: 1.5, ret: 1.2, len: 120, stay: 8000, desc: "대검을 던져 일직선의 적을 꿰뚫는다 (150%). 검은 땅에 꽂혀 8초간 남고, 다시 누르면 회수 — 돌아오는 검이 길 위의 적을 다시 베며 (120%) 내 앞으로 끌고 온다. 검이 없는 동안 기본 공격은 빠른 박치기 (투지 +12)" },
    { id: "brace", name: "버티기", lv: 7, mp: 10, cd: 9000, dur: 1200, guard: 0.8, r: 54, mult: 1.2, desc: "1.2초간 버티며 받는 피해를 80% 막는다. 버티기가 끝나면 막아 낸 피해의 세 배를 충격파로 되돌려 준다 (최소 120%) · 투지 +30" },
    { id: "roar", name: "도발 포효", lv: 12, mp: 14, cd: 16000, r: 96, mult: 0.6, dur: 8000, durUp: 300, buff: 15, desc: "주변의 적을 내 앞으로 끌어당기고 나만 노리게 한다 (60%). 끌려온 적 하나마다 투지 +10 · 8초간 나와 파티원의 공격력 15% 증가" },
    { id: "burst", name: "투지 폭발", lv: 18, mp: 16, cd: 10000, mult: 1, per: 0.018, r: 36, desc: "모은 투지를 모두 터뜨린다 — 투지가 많을수록 넓고 강하다 (100% + 투지 1당 1.8%, 최대 280%)" },
    { id: "stomp", name: "대지 걸음", lv: 25, mp: 24, cd: 16000, dur: 8000, durUp: 250, mult: 0.35, r: 40, desc: "8초간 걸음마다 땅이 울린다 — 걸으면 0.5초마다, 서 있으면 1초마다 발밑의 적에게 35%" },
    { id: "giant", name: "거신화", lv: 35, mp: 40, cd: 45000, dur: 10000, durUp: 200, mult: 2.4, r: 56, ult: 1, desc: "궁극기 · 10초간 거인이 된다. 내려서며 주변을 부수고 (240%), 넉백·둔화에 끄떡없으며, 모든 기본 공격이 마무리 일격으로 넓게 휩쓴다. 투지가 줄지 않는다" },
  ],
  rogue: [
    { id: "swap", name: "그림자 바꿔치기", lv: 3, mp: 7, cd: 5000, len: 110, mult: 1.3, marks: 2, desc: "가장 가까운 적과 자리를 바꾸며 벤다 (130%) · 표식 +2, 적은 1초간 혼란에 빠진다" },
    { id: "venom", name: "맹독 바르기", lv: 7, mp: 10, cd: 14000, n: 6, dot: 0.12, desc: "다음 기본 공격 6번이 표식을 하나 더 남기고, 표식 수만큼 독해지는 독을 묻힌다 (4초, 표식 1당 공격력의 12%/초)" },
    { id: "coin", name: "행운의 동전", lv: 12, mp: 12, cd: 8000, len: 84, mult: 3, miss: 0.8, desc: "동전을 튕겨 앞의 적에게 던진다. 앞면 — 확정 치명타 300%, 이 일격으로 쓰러지면 골드 두 배. 뒷면 — 80%, 대신 다음에 쓰는 스킬의 재사용 대기가 사라진다" },
    { id: "decoy", name: "꼭두각시 분신", lv: 18, mp: 16, cd: 15000, dur: 4000, mult: 1.8, r: 44, desc: "제자리에 분신을 남기고 몸을 감춘다 (2.5초간 이동속도 40% 증가, 적이 나를 잊는다). 분신은 적을 끌어모으다 맞거나 4초가 지나면 터진다 (180%, 표식 +2)" },
    { id: "harvest", name: "표식 수확", lv: 25, mp: 22, cd: 14000, r: 110, mult: 1.4, desc: "주변의 표식을 모두 터뜨린다 — 표식 1개당 140%, 터진 자리 곁의 적에게도 그 35%. 이것으로 쓰러뜨린 적 하나마다 재사용 대기 1.5초 감소" },
    { id: "dance", name: "그림자 무도", lv: 35, mp: 40, cd: 40000, len: 150, n: 8, every: 260, mult: 2.2, per: 0.4, ult: 1, desc: "궁극기 · 2.5초간 그림자가 되어 표식이 있는 적 사이를 (없으면 가까운 적을) 차례로 넘나들며 벤다 — 최대 8명, 각 220% + 표식 1당 40%. 끝나면 제자리로 돌아온다. 그동안은 피해를 입지 않는다" },
  ],
  lancer: [
    { id: "hook", name: "갈고리 걸기", lv: 3, mp: 7, cd: 5000, len: 140, mult: 1.3, desc: "일직선에서 가장 먼 적을 걸어 정확히 창끝 거리로 끌어온다 (130%, 둔화)", emp: "집중 5: 셋을 한꺼번에 걸어 온다" },
    { id: "pole", name: "장대 도약", lv: 7, mp: 12, cd: 9000, len: 100, r: 44, mult: 2, desc: "창을 짚고 적의 머리 위로 뛰어넘어 내려찍는다 (범위 200%). 착지 후 1.2초 안의 기본 공격은 반드시 창끝으로 들어간다", emp: "집중 5: 착지 범위가 넓어지고 1초간 기절시킨다" },
    { id: "banner", name: "깃발 꽂기", lv: 12, mp: 16, cd: 20000, dur: 12000, durUp: 400, r: 80, haste: 0.2, desc: "12초간 깃발을 꽂는다. 깃발 곁의 파티원은 공격 속도 20% 증가, 깃발 곁의 적은 느려진다", emp: "집중 5: 깃발이 더 넓게, 6초 더 오래 선다" },
    { id: "wheel", name: "회전 방벽", lv: 18, mp: 16, cd: 12000, dur: 1500, r: 36, n: 5, every: 300, mult: 0.6, knock: 10, desc: "1.5초간 창을 돌린다 — 날아오는 공격을 모두 막고, 닿는 적을 다섯 번 쳐 밀어낸다 (5회 × 60%)", emp: "집중 5: 두 배 오래 돈다" },
    { id: "javelin", name: "투창", lv: 25, mp: 22, cd: 13000, len: 150, carry: 70, mult: 2.2, pin: 1.6, desc: "창을 던져 맞은 적을 뒤로 날려 보낸다 (220%). 벽에 박히면 2초간 기절하고 피해 1.6배 (벽꿍)", emp: "집중 5: 길 위의 적을 모두 꿰어 날린다" },
    { id: "hundred", name: "백보일섬", lv: 35, mp: 40, cd: 40000, len: 160, mult: 2.6, per: 0.4, ult: 1, desc: "궁극기 · 집중을 모두 쏟아 160만큼 꿰뚫고 지나간다 — 지나친 모든 적에게 창끝 일격 (260% + 집중 1당 40%)" },
  ],
  mage: [
    { id: "ember", name: "불씨", lv: 3, mp: 9, cd: 4000, el: "f", mult: 1.7, r: 26, burn: 0.15, desc: "불덩이를 던진다 (범위 170%). 떨어진 자리는 3초간 타오른다 (0.5초마다 15%)" },
    { id: "frost", name: "서리 고리", lv: 7, mp: 13, cd: 8000, el: "i", mult: 1.3, r: 56, desc: "주변에 서리 고리를 퍼뜨린다 (130%, 둔화). 이미 느려진 적은 1초간 얼어붙는다" },
    { id: "teapot", name: "따뜻한 찻주전자", lv: 12, mp: 20, cd: 18000, dur: 8000, r: 80, pct: 0.4, desc: "따뜻한 찻주전자를 내려놓는다. 8초 동안 곁의 아군이 매초 조금씩 회복한다 (모두 합쳐 최대 HP의 40%)" },
    { id: "bolt", name: "번개 화살", lv: 18, mp: 16, cd: 7000, el: "l", mult: 1.6, r: 72, n: 3, desc: "번개 화살이 적 셋을 차례로 튄다 (160%, 튈 때마다 10%씩 약해진다)" },
    { id: "rewind", name: "시간 되감기", lv: 25, mp: 18, cd: 20000, ago: 3000, desc: "3초 전에 서 있던 곳으로 돌아간다. 그때 HP가 더 많았다면 그만큼 되돌린다 · 원소 주문의 재사용 대기 2초 감소" },
    { id: "surge", name: "원소 폭주", lv: 35, mp: 30, cd: 50000, dur: 8000, durUp: 200, mult: 1.5, r: 60, ult: 1, desc: "궁극기 · 세 원소를 터뜨리며 (범위 150%) 8초간 폭주한다 — 원소 주문의 MP 소모 없음, 재사용 대기 절반, 모든 시전이 직전 원소와 반응한다" },
  ],
};

