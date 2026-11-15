# 스킬 v2 — job palettes, felt passives, balance (rules + data)

Owner's orders (2026-11-15): one representative colour per job with a colour combo that icons and effects follow; review
every skill's balance and effect and make them more varied; passives the player *feels*; fun when using skills. This doc is the
rules/data half (built). Icons and effects are the next task — §6 is their brief. Hammer jobs (파괴자, 머서너리, 성기사) belong to
Codex: untouched here, suggestions in §5. Code: `04-job-palettes.js`, `55-passives.js`, numbers in `03-skills.js`, `00-header.js`
(WKIND), `02-jobs-stats.js` (hybrid scales); tests `tests/passives.mjs`; measurements `scripts/skill-probe.mjs`.

## 1. Job palettes (`defs().jobPal[job] = { name, c: [main, light, dark, accent] }`, `defs().skillJob[skill] = job`)

Roles: **main** the body of a burst / arc / projectile · **light** flash, highlight, crit spark · **dark** outline and the single
shadow tone (pixel-art rule: one shadow) · **accent** the second note (element, marks, a hybrid's own touch). All mains are
light enough for the dark HUD (luma > 70, tested). Hybrids blend their two weapons and keep their own accent.

| job | concept | main | light | dark | accent |
| --- | --- | --- | --- | --- | --- |
| 모험가 `adventurer` | 길 위의 첫걸음 | `#c8a46a` | `#f0dcae` | `#5e4626` | `#7fb6d9` |
| 대검전사 `swordsman` | 강철과 불꽃 | `#e2413b` | `#ff9a80` | `#6a1418` | `#c9d2dc` |
| 도적 `thief` | 그림자와 독 | `#9353d3` | `#cfa8f5` | `#2c1648` | `#7ee07a` |
| 창술사 `lancer` | 천둥 기병 | `#3f86e8` | `#a8d0ff` | `#14345e` | `#ffe066` |
| 마법사 `wizard` | 원소의 불씨 | `#ff8c2e` | `#ffd29a` | `#6e2c06` | `#6fe3ff` |
| 마도사 `warlock` | 심연의 낙인 | `#cf3fa0` | `#f5a6d6` | `#4a0f36` | `#5be3b0` |
| 궁수 `archer` | 숲의 바람 | `#62c25a` | `#bdf0ae` | `#1d4a22` | `#f0c850` |
| 파괴자 `destroyer` | 용광로와 금맥 | `#e8b830` | `#ffe68a` | `#5c4208` | `#ff5a2a` |
| 마검사 `spellblade` | 홍련과 뇌전 | `#ff6a4a` | `#ffbfa6` | `#6e1c12` | `#ffe066` |
| 추적자 `tracker` | 밤숲의 덫 | `#8fb83a` | `#d6ee9e` | `#33441a` | `#9353d3` |
| 용기사 `dragoon` | 심연의 비룡 | `#5c5ee6` | `#b4b6ff` | `#1c1d5a` | `#cf3fa0` |
| 주술암살자 `hexblade` | 피의 주술 | `#b02a48` | `#f0889e` | `#3c0a16` | `#c48cff` |
| 암흑기사 `darkknight` | 검은 성역 | `#9aa4b8` | `#dfe5f0` | `#262b38` | `#e2413b` |
| 검무사 `bladedancer` | 칼바람 춤 | `#f0679e` | `#ffb8d8` | `#66183e` | `#c9d2dc` |
| 환술사 `trickster` | 환영의 세 원소 | `#36d1b4` | `#a8f5e4` | `#0c4a40` | `#ff8c2e` |
| 마창사 `spellspear` | 빙결의 창 | `#66d6ff` | `#d2f4ff` | `#164c68` | `#3f86e8` |
| 룬술사 `runesage` | 메아리 법진 | `#b49cff` | `#e4dcff` | `#3a2c6e` | `#ffd166` |
| 각인궁사 `runearcher` | 먹과 룬의 화살 | `#e6dcc0` | `#fffbea` | `#2b2620` | `#62c25a` |
| 머서너리 `mercenary` | 녹슨 철쇄 | `#b07850` | `#e8c4a4` | `#46281a` | `#6fa8e0` |
| 성기사 `paladin` | 성문의 빛 | `#f2dc7a` | `#fff7cc` | `#74601c` | `#8fd6ff` |

A weapon skill is drawn in its weapon's single-job palette (sword → 대검전사 …); a hybrid holding that weapon may tint the
light/flash with its own accent. Signatures use their job's palette.

## 2. Jobs: identity and the mechanic that is theirs

- **모험가** — 아직 직업이 없다 — 어떤 무기든 기본기와 무기 스킬만.
- **대검전사** — 넓게 베고 버티는 전열. 관성을 쌓아 **단죄의 일격**으로 터뜨리는 *스택 소모 피니셔*, 저체력 각성(벼랑 끝 투지).
- **도적** — 단일 대상 암살. 표식을 쌓고 **무영난무**로 *순간이동 연타*하며 소모, 처치하면 쿨이 돌아온다(그림자 회수).
- **창술사** — 긴 사거리와 창끝. **유성창** *돌진+끌고 가기*, **뇌룡승천** *끌어당김+기절*, 창끝 적중마다 쿨 감소.
- **마법사** — 원소 엮기. 불·얼음·번개를 겹쳐 *원소 반응*, **메테오 스톰** *체인 번개*, 서 있으면 집중(정신 집중).
- **마도사** — 낙인과 소환. **심연의 계약** *소환수*, 낙인이 *전염*되고(낙인 전염) 낙인에서 HP를 빨아들인다.
- **궁수** — 거리와 연사. **화살비** *지면 장판*, 멀수록 강한 화살(매의 시야), 다섯 발마다 덤 한 발.
- **마검사** — 검과 원소: **홍련참** 일직선 검기마다 과부하 폭발(*반응 연쇄*).
- **추적자** — 덫 사냥꾼: **그림자 덫** *은신 + 유인 + 덫(속박) + 분신*.
- **용기사** — **심연의 강림** *무적 도약 + 흡혈 장판*: 들어가서 버티는 창.
- **주술암살자** — **혈흔 폭발**: 표식·출혈·낙인을 *한꺼번에 현금화*하는 방어 무시 고정 피해.
- **암흑기사** — 탱커: **불멸의 성역** HP를 바쳐 파티 피해 −25%·흡혈 치유(*보호 장판*). 단일 딜이 낮은 대신 가장 질기다.
- **검무사** — **십자 난도**: 대검 휩쓸기로 표식 둘 → 단검이 그 표식을 즉시 *소모*(2단 콤보), 관성 가득.
- **환술사** — **원소 비수**: 세 원소 비수를 부채꼴로, 두 원소를 맞은 적마다 *반응* (최대 3).
- **마창사** — **빙결창**: 관통 + 창끝 *빙결* + 끝자리 얼음 기둥.
- **룬술사** — **메아리 법진**: 5초 *지면 법진*이 매초 원소를 바꾸며 두 박동마다 반응.
- **각인궁사** — **룬 먹화살**: 부채꼴 다섯 발이 *낙인을 새기고* 이미 낙인 찍힌 적은 +40%.

Every job already had at least one distinct mechanic (dash, blink chain, pull, summon, ground zone, mark-and-detonate, trap,
reaction chain); v2 adds the swordsman's *stack-consuming finisher* (verdict spends inertia, +10 %/stack) and the slash's
*core hit* (the aimed one ×1.45: a single-target reason to press it), and gives every weapon felt passives (§4).

## 3. Skill inventory (actives and signatures, non-hammer) — numbers as built, icon and effect brief

`k` grows with mastery past `need` (+0.4 %/lv), job level (+0.4 %/lv past 5) and 스킬 강화 (+2.5 %/step, 48-skill-enh.js);
job ranks cut a signature's MP 10/10/20 % and cooldown 0/8/12 % at job Lv.20/35/50. `mag` skills count ¼ of armour.

| skill | owner | need | MP | cd s | numbers | icon (16×16) | effect (palette roles) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 파워 슬래쉬 `slash` fx 80 | 대검전사 | 1 | 4 +HP 2% | 5 | ×2, core 1.45, r 46 | 크게 휜 대검 호(弧) + 불티 | 부채꼴 검기: M 호, L 가장자리 섬광, A 강철 잔상 |
| 대지 가르기 `rend` fx 81 | 대검전사 | 10 | 7 +HP 3% | 9 | ×2, wave 1.3, r 38, len 120, leap 60 | 땅에 꽂힌 대검과 갈라진 금 | 도약 궤적 → 착지 원형 충격(M) + 직선 균열 파동(L/D 파편) |
| 암습 `ambush` fx 84 | 도적 | 1 | 4 +HP 1.5% | 6 | ×2.6, len 110 | 등 뒤의 단검 실루엣 + 눈 | 순간이동 잔상(D) → 찌르기 섬광(L), 치명타면 A(독록) 반짝 |
| 그림자 칼날 `shade` fx 85 | 도적 | 10 | 6 +HP 2.1999999999999997% | 8 | ×0.7, len 120, n 3 | 부채꼴 세 자루 그림자 칼날 | 관통 투사체 3줄: M 칼날, D 꼬리, 맞은 적에 표식(A) |
| 나선 찌르기 `spiral` fx 87 | 창술사 | 1 | 4 +HP 1.7999999999999998% | 5 | ×1.8, len 110 | 비틀린 창날 나선 | 직선 나선 찌르기: M 나선, 창끝 구간 L 섬광(창끝 적중 별) |
| 유성창 `comet` fx 88 | 창술사 | 10 | 7 +HP 2.6% | 10 | ×0.9, len 130 | 유성처럼 꼬리 단 창 | 돌진 꼬리(M→D) + 끝점 충돌 별(A 번개) |
| 전열 구호기 `rally_banner` fx 135 | 창술사 | 15 | 12 | 16 | heal 0.023, atkHeal 0.06, r 76, 6s | 깃발과 파동 원 | 깃발 장판(M 테두리, L 박동), 파티원 위로 초록 회복 점 |
| 파이어볼 `fireball` fx 70 | 마법사 | 1 | 9 | 4 | ×1.7, r 30 | 불덩이 | 포물선 투사체(M 몸통, L 핵) → 폭발 원 + 3초 불바닥(D 그을음) |
| 서리 고리 `frostring` fx 71 | 마법사 | 10 | 13 | 8 | ×0.9, r 56 | 눈꽃 고리 | 주변 퍼지는 서리 고리: A(얼음 시안) 고리, L 결정, 빙결 적엔 얼음 덮개 |
| 영혼 화살 `soulbolt` fx 91 | 마도사 | 1 | 8 | 3.5 | ×2.4, heal 0.06, len 150 | 푸른 혼불 화살 | 유도 혼불(M) + 흡수 실(A 청록)이 시전자에게 돌아옴 |
| 중력 왜곡진 `gravity` fx 92 | 마도사 | 10 | 15 | 11 | ×0.4, r 60, at 70, 4s | 소용돌이 눈 | 4초 소용돌이 장판: M 나선, D 중심, 박동마다 안쪽으로 끌리는 선 |
| 되살림 제본 `revive_binding` fx 136 | 마도사 | 15 | 19 | 18 | heal 0.19, atkHeal 0.3, r 105 | 책장 사이 하트 | 책장 펼침 섬광(L) → 대상에게 리본(M) 회복 |
| 관통 화살 `pierce` fx 94 | 궁수 | 1 | 7 | 4.5 | ×1.6, r 8, len 180 | 깃 달린 화살 한 발 | 고속 직선 화살 꼬리(M), 관통마다 L 점 |
| 도약 사격 `leapshot` fx 95 | 궁수 | 10 | 13 | 9 | ×1.2, per 2, len 150, back 60, n 5 | 뒤로 뛰는 발 + 부채 화살 | 뒤 도약 먼지(D) + 화살 5발 부채(M, A 깃) |
| 단죄의 일격 `verdict` fx 83 | 대검전사 | job 5 | 16 +HP 5% | 36 | ×1.3, inert 0.1, r 70 | 피 묻은 대검 원 베기 | 360° 원 베기(M 굵기 = 잃은 HP), 소모한 관성 수만큼 L 불꽃 고리 |
| 무영난무 `flurry` fx 86 | 도적 | job 5 | 18 +HP 3.5000000000000004% | 36 | ×1.2, per 0.3, r 90, n 7 | 일곱 개의 그림자 발자국 | 적 사이 순간이동 선(D/M) 7회, 매 타격 A 섬광 |
| 뇌룡승천 `dragon` fx 89 | 창술사 | job 5 | 17 +HP 4% | 32 | ×0.4, fin 0.8, r 64, at 80, n 3 | 번개 용 기둥 | 번개 기둥(A 노랑 + L) 3박동 + 마지막 낙뢰, 끌림 선(M) |
| 메테오 스톰 `meteor` fx 90 | 마법사 | job 5 | 42 | 40 | ×0.6, chain 0.35, r 80, at 120, n 6 | 떨어지는 운석 셋 | 운석 6개 낙하(M 몸, L 꼬리) + 체인 번개(A 시안) |
| 심연의 계약 `pact` fx 93 | 마도사 | job 5 | 40 | 38 | ×2.2, bite 0.8, brandK 0.25, r 80, 6s | 뿔 달린 심연 짐승 머리 | 소환수 실루엣(D 몸, M 눈·테두리), 소멸 시 저주 폭발 원(A) |
| 화살비 `rain` fx 96 | 궁수 | job 5 | 34 | 30 | ×0.25, r 70, at 110, 3s | 하늘을 향한 화살 다발 | 3초 화살비 장판: M 원, 낙하 화살 L 선, 맞은 적 둔화 표시 |
| 원소 마검: 홍련참 `crimson` fx 97 | 마검사 | job 5 | 40 | 34 | ×1.6, len 160 | 불꽃 두른 검기 + 번개 갈래 | 직선 불꽃 검기(M) + 적마다 과부하 번개(A) |
| 사방의 그림자 덫 `traps` fx 98 | 추적자 | job 5 | 38 | 36 | stab 0.35, shot 0.45, back 40, n 4, 8s | 톱니 덫 넷 + 그림자 | 은신 페이드, 덫 4개(D 바탕, M 톱니), 발동 시 분신(보라 A) |
| 심연의 강림 `dive` fx 99 | 용기사 | job 5 | 44 | 40 | ×2, drain 0.2, heal 0.3, r 110, at 120, 4s | 하늘에서 내리꽂는 창 | 솟구침 잔상 → 착지 대폭발(M) + 흡혈 장판(A 자홍, 붉은 흡수 점) |
| 혈흔 폭발 `bloodburst` fx 100 | 주술암살자 | job 5 | 36 | 30 | r 100 | 터지는 핏방울 | 묶임 사슬(D) → 핏빛 폭발(M) + 보라(A) 낙인 파편 |
| 불멸의 성역 `sanctuary` fx 102 | 암흑기사 | job 5 | 20 | 45 | ×0.2, guard 0.25, r 90, 8s | 피의 방패와 원 | 시전자 따라다니는 성역 원(M 테두리, D 바닥), 받는 피해 감소 방패 표시(A) |
| 십자 난도 `crosscut` fx 120 | 검무사 | job 5 | 36 | 32 | ×1, stab 0.5, per 0.2, r 64 | X자 대검+단검 | 대검 호(M) → 표식(A) → 단검 찌르기 섬광(L) |
| 원소 비수 `elemfan` fx 124 | 환술사 | job 5 | 36 | 30 | ×0.9, len 140 | 세 색의 비수 | 불·얼음·번개 비수 3줄(각 원소색), 반응 지점 M 섬광 |
| 빙결창 `frostspire` fx 125 | 마창사 | job 5 | 36 | 30 | ×1.4, burst 1, r 44, len 150 | 얼음 창 + 고드름 | 얼음 관통(M) + 창끝 빙결(L) + 끝자리 얼음 기둥(A 남색) |
| 메아리 법진 `runecircle` fx 126 | 룬술사 | job 5 | 46 | 45 | ×0.2, r 64, at 80, 5s | 원형 룬 문자 | 5초 룬 법진(M 테두리, A 노랑 룬), 박동마다 원소색 교대 |
| 룬 먹화살 `inkshot` fx 128 | 각인궁사 | job 5 | 36 | 30 | ×0.8, per 2, brandK 0.4, r 8, len 170, n 5 | 먹물 묻은 화살 다섯 | 먹물 꼬리 화살 5발(D), 낙인 새김(A 초록) |

Number changes: 파워 슬래쉬 ×1.9 → ×2.0 + core ×1.45 · 대지 가르기 ×1.7/1.2 → ×2.0/1.3 · 암습 ×1.3 → ×2.6 · 그림자 칼날 ×0.5 → ×0.7 ·
나선 찌르기 ×1.3 → ×1.8 · 파이어볼 ×1.6 → ×1.7 · 영혼 화살 ×2.0 → ×2.4 · basic blows: 단검 ×1.1 → ×0.9, 활 ×0.9 → ×0.86, 창 ×1.4 → ×1.3
(skills now beat a basic blow: before, spear and dagger skills were worth about one basic hit — lancer's whole kit added 0 % over
auto-attacks at T40). Hybrid scales (same 2.2 budget): 마검사 STR/INT 0.9 (WIL/WIS 0.2), 암흑기사 0.9/0.9/0.4, 용기사 STR/INT 0.8,
룬술사 INT 0.9 WIS/WIL 0.4, 검무사 STR 0.68 DEX 0.5, 환술사 DEX 0.5 INT 0.75, 주술암살자 DEX 0.5 INT 0.78, 추적자 DEX 0.75;
각인궁사's bow hand adds LUK 0.45.

## 4. Passives — felt, not 3 %

Rules: a stat passive is never under 6 % (tested); the rest *change how a fight goes* and show a proc (`["ps", eid, code, x, y]`).
Borrowed into a cross slot (47-job-freedom.js) a triggered passive still gives only its `borrow` stat at 50/60 %. The four
passive slots now force a real choice at mastery 50 (five per weapon).

| passive | need | before | after (tooltip) | icon / proc |
| --- | --- | --- | --- | --- |
| 거검의 관성 `inertia` | 10 | 치명 피해 +6%/중첩 (설명은 8%) | 대검으로 적을 맞힐 때마다 관성이 1 쌓인다(최대 5). 관성 1당 사거리 +6%, 치명타 피해 +8%. 2.5초 동안 맞히지 못하면 사라진다. | 겹친 호(관성 1–5칸 게이지) |
| 반걸음 버티기 `sword_steadfast20` | 20 | 경직 저항 +8%p | 무거운 칼을 받치는 발을 굳힌다. 경직 저항이 15%p 증가한다. | 디딘 발(정적, 프로크 없음) |
| 벼랑 끝 투지 `sword_fortify30` | 30 | 방어 +7% | HP가 40% 아래로 떨어지면 받는 피해가 15% 줄고 기본 공격 속도가 20% 빨라진다. | 갈라진 방패 + 불꽃(ps 140: 붉은 오라 켜짐) |
| 날에 실은 무게 `sword_weight40` | 40 | 공격 +4% | 기본 공격 3연타의 마지막 일격이 땅을 울려, 맞은 적 둘레 36 안의 적 모두에게 공격력의 35% 피해를 준다. | 땅 울림 원(ps 141: 대상 둘레 충격 원 r36) |
| 칼끝의 결단 `sword_edge50` | 50 | 치명 피해 +8%p | HP가 30% 아래인 적에게 주는 피해가 35% 증가한다. 쓰러뜨릴 적을 끝까지 벤다. | 부서진 해골 마크(ps 142: 처형 대상 표시, 30% 미만) |
| 급소 도려내기 `vitals` | 10 | 설명 +4%/표식·출혈 12% (데이터 3%·8%) | 단검 기본 공격이 표식을 남긴다(최대 5, 10초). 표식 1개당 치명타 확률 +1.5%. 표식 있는 적을 베면 4초간 출혈(초당 공격력의 8%)을 일으키고 2초간 이동 속도 +20%. | 단검 + 핏방울 |
| 그림자 보폭 `dagger_shade20` | 20 | 이속 +5% | 그림자가 먼저 발을 디딜 만큼 가볍게 걷는다. 이동 속도가 10% 증가한다. | 그림자 발 |
| 그림자 회수 `dagger_snap30` | 30 | 공속 +4% | 적을 처치할 때마다 단검 스킬들의 남은 재사용 대기시간이 30% 줄어든다. | 되감긴 시계(ps 143: 쿨 감소 회오리) |
| 빈틈을 읽는 눈 `dagger_edge40` | 40 | 치명 +3%p | 아직 내게 한 번도 맞지 않은 적을 처음 벨 때는 반드시 치명타가 터진다(스킬 포함). | 열린 눈(ps 144: 첫 타 치명 섬광) |
| 피를 머금은 날 `dagger_fang50` | 50 | 흡혈 +1.5%p | 적을 처치하면 최대 HP의 6%를 회복하고, 3초 동안 기본 공격 속도가 25% 빨라진다. | 송곳니(ps 145: 회복 + 3초 가속 오라) |
| 창끝의 거리 `tip` | 10 | — | 사거리의 72% 이상 떨어진 적을 맞히면 창끝 일격 — 피해 ×1.5, 방어력의 35%를 무시한다. | 창끝 별 |
| 전열의 간격 `spear_guard20` | 20 | 방어 +7% | 창대를 세워 들고 방어할 틈을 벌린다. 방어력이 15% 증가한다. | 세운 창대 |
| 창끝 반동 `spear_advance30` | 30 | 이속 +4% | 창끝 일격이 적중할 때마다 창 스킬들의 재사용 대기시간이 0.5초 줄어든다. | 반동 화살표(ps 146: 쿨 감소 점) |
| 굽히지 않는 창대 `spear_truss40` | 40 | 경직 저항 +8%p | 굽힌 몸과 창대로 적의 힘을 받는다. 경직 저항이 15%p 증가한다. | 굽은 창대 |
| 하나로 모인 힘 `spear_edge50` | 50 | 치명 피해 +8%p | 두 발에서 올라온 힘을 창끝 한 점에 모은다. 창끝 일격은 빗맞지 않는 한 반드시 치명타가 된다. | 한 점 별(ps 147: 창끝 치명) |
| 마력 공명 `reso` | 10 | — | 스태프 스킬을 세 번 쓰면 공명이 차오른다 — 다음 스태프 스킬은 MP 없이 쓰고 피해 +30%. 불·얼음·번개가 겹치면 원소 반응이 일어난다. | 세 칸 공명 |
| 깊은 마력 그릇 `staff_mind20` | 20 | MP +8% | 공명을 일으키고 남은 마력도 모아 둔다. 최대 MP가 15% 증가한다. | 마력 그릇 |
| 원소 증폭 `staff_chant30` | 30 | 쿨감 +4%p | 내가 일으킨 원소 반응(증기 폭발 · 초전도 · 과부하)의 피해가 30% 증가한다. | 겹친 원소 고리(ps 148) |
| 정신 집중 `staff_spark40` | 40 | 치명 +3%p | 1.5초 동안 움직이지 않으면 집중한다 — 다음 스킬 한 번의 피해가 40% 증가한다. | 감은 눈 + 빛(ps 149: 집중 소모 / 플래그 128 동안 머리 위 빛) |
| 쏟아지는 마력 `staff_flood50` | 50 | 공격 +5% | MP가 70% 이상 남아 있는 동안 주는 모든 피해가 15% 증가한다. | 넘치는 물병(ps 150) |
| 금서의 낙인 `brand` | 10 | — | 마도서 스킬에 맞은 적에게 6초간 낙인을 새긴다. 낙인 찍힌 적은 누구에게서나 피해를 15% 더 받는다. | 낙인 문양 |
| 널찍한 여백 `book_margin20` | 20 | HP +6% | 여백에 회복 주문을 적어 몸에 새긴다. 최대 HP가 12% 증가한다. | 책 여백 하트 |
| 낙인 전염 `book_clause30` | 30 | 쿨감 +4%p | 낙인 찍힌 적이 쓰러지면, 남은 낙인이 둘레 64 안의 적 둘에게 옮겨 붙는다. | 번지는 낙인(ps 151 + ln 10: 낙인이 옮겨 가는 선) |
| 묵향의 잔재 `book_ink40` | 40 | MP +8% | 마르지 않은 글씨에서 남은 마력을 건져 올린다. 최대 MP가 15% 증가한다. | 먹 방울 |
| 영혼 흡수 `book_return50` | 50 | 흡혈 +1.25%p | 낙인 찍힌 적에게 준 피해의 5%만큼 HP를 회복한다. | 빨려드는 혼(ps 152) |
| 매의 시야 `hawk` | 10 | 설명 최대 +25% (데이터 15%) | 멀리서 쏜 화살일수록 세다 — 쏜 자리에서 40 너머부터 거리에 따라 최대 +15%(150에서). | 매의 눈 |
| 나뭇가지 걸음 `bow_lithe20` | 20 | 이속 +4% | 잔가지를 밟아도 휘어지기 전에 발을 뗀다. 이동 속도가 10% 증가한다. | 나뭇가지 발 |
| 연속 사격 `bow_string30` | 30 | 공속 +4% | 기본 공격 화살 다섯 발마다 같은 쪽으로 화살 한 발을 더 쏜다(위력 50%). | 겹친 화살 두 대(ps 153: 덤 화살) |
| 바람 틈의 표적 `bow_focus40` | 40 | 치명 +3%p | 바람이 멈추는 찰나에 과녁의 작은 점을 겨눈다. 치명타 확률이 6%p 증가한다. | 과녁 점 |
| 약점 포착 `bow_quill50` | 50 | 공격 +5% | 치명타를 맞힌 적은 4초 동안 나에게 받는 피해가 15% 늘어난다. | 금 간 과녁(ps 154: 약점 4초 표식) |

## 5. Measurements (scripts/skill-probe.mjs; band-tier plain gear, default loadout, pinned dummies)

`st` single-target dmg/s (×mean of all jobs) · `aoe/st` six-dummy pack ÷ single · `boss` seconds on the tier's boss dummy
(T25 knellkeeper 10 000 HP, T40 abyssboss 48 000 HP). Before = main before this branch.

| job | T25 st before → after | T40 st before → after | T40 aoe/st | T40 boss s | T40 MP/min |
| --- | --- | --- | --- | --- | --- |
| 대검전사 | 487 ×0.83 → 565 ×0.97 | 701 ×0.83 → 781 ×0.95 | 3.48 → 3.38 | 74 → 67 | 131 |
| 도적 | 861 ×1.47 → 809 ×1.38 | 1481 ×1.76 → 1104 ×1.34 | 1.03 → 1.1 | 33 → 46 | 126 |
| 창술사 | 688 ×1.18 → 668 ×1.14 | 832 ×0.99 → 913 ×1.11 | 1.59 → 1.46 | 81 → 80 | 324 |
| 마법사 | 512 ×0.88 → 519 ×0.89 | 806 ×0.96 → 843 ×1.02 | 3.87 → 4.01 | 61 → 54 | 306 |
| 마도사 | 535 ×0.91 → 564 ×0.96 | 751 ×0.89 → 774 ×0.94 | 2.59 → 2.53 | 63 → 64 | 413 |
| 궁수 | 540 ×0.92 → 521 ×0.89 | 887 ×1.05 → 904 ×1.09 | 1.63 → 1.65 | 53 → 53 | 282 |
| 파괴자 (Codex) | 589 ×1.01 → 589 ×1.01 | 828 ×0.98 → 828 ×1 | 1.74 → 1.74 | 57 → 57 | 95 |
| 마검사 | 493 ×0.84 → 531 ×0.91 | 677 ×0.8 → 710 ×0.86 | 3.46 → 3.37 | 72 → 68 | 304 |
| 추적자 | 675 ×1.15 → 620 ×1.06 | 1106 ×1.31 → 879 ×1.06 | 1.2 → 1.31 | 47 → 58 | 211 |
| 용기사 | 572 ×0.98 → 579 ×0.99 | 745 ×0.88 → 756 ×0.92 | 2.43 → 2.4 | 76 → 75 | 308 |
| 주술암살자 | 666 ×1.14 → 615 ×1.05 | 970 ×1.15 → 891 ×1.08 | 1.68 → 1.7 | 52 → 57 | 279 |
| 암흑기사 | 487 ×0.83 → 564 ×0.96 | 610 ×0.72 → 688 ×0.83 | 3.17 → 3.06 | 79 → 70 | 211 |
| 검무사 | 681 ×1.16 → 637 ×1.09 | 1001 ×1.19 → 927 ×1.12 | 2.22 → 2.24 | 47 → 50 | 196 |
| 환술사 | 676 ×1.16 → 614 ×1.05 | 984 ×1.17 → 876 ×1.06 | 1.79 → 1.83 | 49 → 54 | 290 |
| 마창사 | 566 ×0.97 → 563 ×0.96 | 778 ×0.92 → 790 ×0.96 | 2.14 → 2.14 | 74 → 73 | 349 |
| 룬술사 | 483 ×0.83 → 534 ×0.91 | 637 ×0.76 → 760 ×0.92 | 2.88 → 2.96 | 75 → 66 | 321 |
| 각인궁사 | 484 ×0.83 → 496 ×0.85 | 774 ×0.92 → 783 ×0.95 | 2.32 → 2.27 | 61 → 60 | 332 |
| 머서너리 (Codex) | 605 ×1.03 → 598 ×1.02 | 760 ×0.9 → 766 ×0.93 | 1.7 → 1.69 | 75 → 75 | 180 |
| 성기사 (Codex) | 512 ×0.88 → 527 ×0.9 | 687 ×0.82 → 715 ×0.87 | 2.31 → 2.22 | 66 → 62 | 227 |

Non-hammer single-target spread at T40: ×0.72–×1.76 before → ×0.83–×1.34 after
(T25: ×0.83–×1.47 → ×0.85–×1.38). At T40, 13 of the 16 non-hammer jobs sit inside ±12 % (outside: 도적 ×1.34,
암흑기사 ×0.83, 마검사 ×0.86); T25 is wider (창술사 ×1.14, 각인궁사 ×0.85, 도적 ×1.38).
Pack kills/min (tests/balance.mjs, the old-class bands) all still pass; the rift and raid bots (dimrift, bosses2 cloakbat /
bloomwhale) clear in their windows.

Outliers and why they stay (owner's call):
- **도적 ×1.3 single-target**, the lowest AoE (pack ×1.1). Its curve is steep: DEX attack speed (cap 30 %) and gear speed compound
  on a 520 ms swing, so at T40 it swings ~3.7×/s. Cutting the dagger's blow further breaks dagger T5 (balance band ×0.75, now
  ×0.77), and the raid bots need the thief's damage. Proposed owner fix (stat system): DEX attack-speed cap 30 % → 20 % or a
  per-weapon cap for the dagger; then 단검 ×0.9 → ×1.0 at T5 is affordable.
- **암흑기사 ×0.83**: the tank — sanctuary (−25 % damage for the party) and ~700 HP/min healing; single damage is its price.
- **마검사 ×0.86 at T40** inside its 2.2 scale budget; its strength is the pack (×3.4). More would need the budget raised.
- Raid bots are seed-sensitive (a wipe or not flips with any RNG change): a +0.1 staff passive swing flipped bloomwhale.

Redundant / rarely bound: 전열 구호기 and 되살림 제본 are party-only (solo bars skip them, `support`); kept. 서리 고리 and 중력 왜곡진
are crowd tools with low single damage — intended. No active is now worth less than a basic blow at its own weapon.

### Hammer jobs — suggestions for Codex (not changed)
- 성기사 ×0.87 and 머서너리 ×0.93 single-target at T40 (destroyer ×1.00): the two hybrids could take +6–10 % on `oathward` / `ironsiege`.
- Hammer passives are already mechanics (균열, 버팀발, 금의 결, 반동 호흡, 심철의 파문); 반동 호흡 (−1 %p HP cost) is the one under the
  felt line — e.g. "a hammer skill that detonates two cracks refunds 2 % max HP" instead.
- Palettes for the three are set (§1: 용광로와 금맥 gold/molten, 녹슨 철쇄 rust/steel blue, 성문의 빛 pale gold/sky).

## 6. For the icon/effect agent (client: `public/skillicons.js`, `skillfx.js`, `events.js`)

- Read `G.defs.jobPal` and `G.defs.skillJob` (static, in `welcome.defs`): draw each skill's icon from its owner's four colours —
  dark outline, main body, light highlight, accent detail; 16×16, one shadow tone, no AA (pixel-art rules). Icon motifs: §3, §4.
- Effects keep their existing `a` fx codes (§3 column); recolour them by owner palette, shape as listed (arc, line, projectile,
  zone, pillar, summon). A hybrid using a weapon skill may swap the flash to its own accent.
- New events: `["ps", eid, code, x, y]` passive proc, codes 140–154 (§4 table: 140 rally aura on, 141 finisher quake r36,
  142 execute (unused for now: drawn when you like at <30 % HP targets), 143 cooldown refund, 144 sure first crit, 145 kill heal
  + haste, 146 tip cooldown cut, 147 tip crit, 148 amplified reaction, 149 focused cast, 150 full-mana bonus, 151 brand spread,
  152 brand drain, 153 double arrow, 154 weak spot exposed). `["ln", 10, x0, y0, x1, y1]` a brand jumping to a new monster.
  Flag bit 128 in `me[8]` / `P[i][8]`: 정신 집중 ready (a soft glow over the caster). Today the client ignores these silently.
- Not every proc needs a big effect: 144/147 can reuse the crit spark tinted with the owner accent; 146/143 a small swirl on
  the hotbar; 141/151/153 deserve a visible ground ring / line / second arrow.

### As built (client, icons and effects)
- `public/jobpal.js`: `setJobDefs(defs)` at welcome (net.js); `jobPal(job)` / `skillPal(id, casterJob)` / `fxPal(code, G, eid)` give a
  cached `{w l m md d a al ad}` (four colours + mixes). A hybrid using one of its weapons' skills lends the skill its accent.
- Icons (`skillicons.js`): job-dark backing, 1-px main rim — square (clipped corners) for actives, round medal for passives,
  accent corners for signatures, a hybrid's rim split between its two weapons' mains; glyph `#` light, `o` main, `+` accent,
  dark outline; combo pips (2×1 in the state's colour) top-right = puts the state on, bottom-right = spends it.
- Effects (`skillfx.js`): the old literal colours of every skill helper / cast case / line / prop became palette roles (by hue
  and lightness; an element's second hue on the accent); `PAL` is set where the event comes in and carried through delayed
  beats. Every cast ends on `jobBeat` (accent motes, a signature's rings, `audio.js job_note` — one sound per job).
- New: `ps` 140–154 procs (flash + Korean word for one's own), `ln` 10 brand hop, flag 128 star (정신 집중), sanctuary in
  암흑기사 colours; `skillfx_combo.js` actives in palette, distinct `cb` payoffs (파쇄, 추가타, 점화, 결집). Hammer code untouched.
- Left: bow arrow looks (`ARROW_LOOK`), book/staff missiles and the support pennant/folio keep their fixed colours.
