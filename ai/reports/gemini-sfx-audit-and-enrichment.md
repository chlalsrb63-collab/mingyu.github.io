# 효과음(SFX) 전수 검수 및 스킬·컨텐츠 다채화 보고서 (Antigravity / Gemini)

## 1. 만진 파일 (`ai/LANES.md` 구역 준수 확인)
- **Antigravity 담당 구역 (`효과음`: `public/audio.js` 소리 정의, 각 파일의 `Sound.play` 이름 / `무기 외형 시안`)**:
  - `game/public/audio.js`: 누락 SFX 2종(`clang`, `tick`) 복구, `JOB_NOTE` 신규 직업 3종(`destroyer`, `mercenary`, `paladin`) 추가, 스킬·콤보·보스·월드·심부름·협동 알바·신규 1차 무기 스킬(`148~159`)용 합성 효과음 **67종** 추가 (전체 **292종**).
  - `game/public/skillfx_combo.js`: `140~159` 선딜레이(`extra === 0`)·타격음·콤보 상태 폭발(`cb 1~9`)의 `Sound.play` 이름 연결 및 다단 히트 채널링 스킬(`144`, `146`, `147`, `155`) `job_note` 배음 디바운싱(`castPfx` 등 이펙트 드로잉 코드는 변경하지 않음).
  - `game/public/skillfx.js`: 보스 기믹(`whale_dive`, `whale_burst`, `blood_jet`, `boss_break`, `boss_absorb`), 상태이상(`freeze_lock`, `armor_break`), 패시브(`hawk_eye`, `PS_SOUND` `142`/`146`/`150`/`153`)의 `Sound.play` 이름 연결.
  - `game/public/events.js`: `dark_beam`, `wind_shrine`, `knife_throw`, `pet_fetch`, `pet_poof`, `job_change`의 `Sound.play` 이름 연결.
  - `game/public/chores.js`: 마을 심부름 6종(`water_fill`, `water_pour`, `milk_clink`, `weed_pull`, `flyer_slap`, `dog_sniff`)의 `Sound.play` 이름 연결.
  - `game/public/coop.js`: 협동 알바 `SND` 테이블의 `Sound.play` 이름 연결(`broom_sweep`, `lift_heave`, `knife_chop`, `plate_clink`, `order_bell`, `dish_scrub`, `dish_clean`; 올빼미 도서관 `90~97` 유지).
  - `game/public/weapons_daggers_collection.js` 및 `asset/generated/daggers/icon_ws_dagger_frostglaive.png`: 코드 리뷰에서 발견한 `frostglaive`(빙하 결정 단검) 코등이 보석 색상 키(`sapphire: "#3578f2"`) 보완.
  - `ai/proposals/gemini-sfx-and-assets-integration.md`: Codex·Claude 후속 작업 제안 4건.

## 2. 테스트 결과
- **최신 `main` 병합 (`git merge main`)**: 충돌 해결 완료 (`game/src/logic.js` 무수정, `70 fragments + data, 25464 lines` 일치).
- **문법 검사 (`node --check`)**: `audio.js`, `skillfx_combo.js`, `skillfx.js`, `events.js`, `chores.js`, `coop.js`, `weapons_daggers_collection.js` 전 파일 통과.
- **관련 규칙/오디오 테스트**:
  - `node game/scripts/test-all.mjs bgm-recordings` → **`1/1 passed in 0.1 s`**
  - 오프라인 합성 및 정적 키 대조 검수 → 정의된 **`292종` SFX 전체 합성 호출 통과**, `game/public/*.js` 내 미정의 리터럴 `Sound.play` 키 **`0건`**.

## 3. 신규 추가된 효과음 목록 (67종)

| 효과음 이름 (`SFX`) | 길이 | 연결된 스킬 / 컨텐츠 |
| --- | --- | --- |
| `clang` | 0.27s | 마을 캉캉대장간 야외 모루 환경음 (`overlay.js`) |
| `tick` | 0.03s | 스탯 훈련 가감 클릭(`statwin.js`) · 가위바위보 초시계(`sxwin.js`) |
| `cleave_wind` | 0.28s | 대검 콤보 액티브 `처형 내려베기` (fx 140) 준비 동작 |
| `cleave_hit` | 0.32s | 대검 콤보 액티브 `처형 내려베기` (fx 140) 내려찍기 타격 |
| `rupture` | 0.18s | 단검 콤보 액티브 `급소 터뜨리기` (fx 141, 표식 수 비례) |
| `hook_chain` | 0.26s | 창 콤보 액티브 `갈고리 창` (fx 142) 사슬 투척 및 견인 |
| `ignite_wind` | 0.26s | 스태프 콤보 액티브 `점화 폭발` (fx 143) 주문 응축 |
| `ignite_burst` | 0.35s | 스태프 콤보 액티브 `점화 폭발` (fx 143) 및 `점화!` (cb 6) 폭발 |
| `soul_drain` | 0.20s | 마도서 콤보 액티브 `영혼 착취` (fx 144) 흡수 틱 |
| `soul_drain_fin` | 0.34s | 마도서 콤보 액티브 `영혼 착취` (fx 144) 마지막 낙인 폭발 |
| `snipe_wind` | 0.32s | 활 콤보 액티브 `저격` (fx 145) 시위 당기기 집중 |
| `snipe_shot` | 0.25s | 활 콤보 액티브 `저격` (fx 145) 초고속 관통 사격 |
| `whirl_slash` | 0.24s | 대검전사 Lv.30 `돌개바람` (fx 146) 회전 베기 |
| `musou_thrust` | 0.18s | 창술사 Lv.30 `무쌍난무` (fx 147) 연속 찌르기 |
| `earth_stomp` | 0.26s | 신규 무기 스킬 `땅울림 발구르기` (fx 148) 지면 강타 |
| `mortar_launch` | 0.14s | 신규 무기 스킬 `곡사 폭약 화살` (fx 149) 곡사 발사 |
| `mortar_blast` | 0.30s | 신규 무기 스킬 `곡사 폭약 화살` (fx 149) 착탄 폭발 |
| `dragonbone_shot` | 0.22s | 신규 무기 스킬 `용뼈 관통 사격` (fx 150) 중량 관통탄 |
| `roll_shot` | 0.15s | 신규 무기 스킬 `구르며 쏘기` (fx 151, 회심 발동 시 고음 화음) |
| `chain_zap` | 0.10s | 신규 무기 스킬 `연쇄 번개` (fx 152) 전격 도약 |
| `shoulder_bash` | 0.14s | 신규 무기 스킬 `어깨 돌파` (fx 153) 몸통 박치기 충격 |
| `bolas_wrap` | 0.18s | 신규 무기 스킬 `올무 화살` (fx 154) 줄 감기 속박 |
| `blade_vortex` | 0.12s | 신규 무기 스킬 `칼날 소용돌이` (fx 155) 회전 칼날 궤도 |
| `blade_fan` | 0.12s | 신규 무기 스킬 `칼날 흩뿌리기` (fx 156) 다중 비수 투척 |
| `smoke_bomb` | 0.34s | 신규 무기 스킬 `연막탄` (fx 157) 연막 파열 및 분사 |
| `parry_stance` | 0.09s | 신규 무기 스킬 `칼등 받아치기` (fx 158) 방어 태세 |
| `parry_clang` | 0.25s | 신규 무기 스킬 `칼등 받아치기` (fx 158) 패링 성공 금속음 |
| `mountain_charge` | 0.24s | 신규 무기 스킬 `산 가르기` (fx 159) 차징 기력 응축 |
| `mountain_split` | 0.36s | 신규 무기 스킬 `산 가르기` (fx 159, 차징 단계별 타격감 강화) |
| `cb_stagger` | 0.18s | 콤보 상태 폭발 `경직 강타!` (cb 1) |
| `cb_shatter` | 0.20s | 콤보 상태 폭발 `파쇄!` (cb 2) 얼음 파열 |
| `cb_aerial` | 0.16s | 콤보 상태 폭발 `추가타!` (cb 3) 공중 추격타 |
| `cb_mark` | 0.14s | 콤보 상태 폭발 `표식 폭발!` (cb 4) |
| `cb_brand` | 0.24s | 콤보 상태 폭발 `낙인 폭발!` (cb 5) |
| `cb_gather` | 0.24s | 콤보 상태 폭발 `결집!` (cb 7) 소용돌이 흡인 |
| `cb_launch` | 0.16s | 콤보 상태 `띄우기` (cb 9) |
| `freeze_lock` | 0.14s | 몬스터 `빙결` 상태 부여 (`fz`) |
| `armor_break` | 0.12s | 몬스터 방어 약화/균열 부여 (`vu`) |
| `hawk_eye` | 0.14s | 활 패시브 `매의 시야` (fx 115) · `약점 포착` (ps 154) |
| `edge_cut` | 0.12s | 대검 패시브 `칼끝의 결단` (ps 142) |
| `spear_cd` | 0.12s | 창 패시브 `창끝 반동` (ps 146) |
| `mana_surge` | 0.16s | 스태프 패시브 `쏟아지는 마력` (ps 150) |
| `double_nock` | 0.10s | 활 패시브 `연속 사격` (ps 153) |
| `whale_dive` | 0.55s | 보스 `꽃무덤 고래` 심연 잠수 (`bloomwhaleDive`) |
| `whale_burst` | 0.48s | 보스 `꽃무덤 고래` 수면 솟구침 폭발 (`bloomwhaleDive`) |
| `blood_jet` | 0.42s | 보스 `혈루 왕도마뱀` 고압 혈루 사출 (`bloodhornJet`) |
| `boss_break` | 0.26s | 보스 정신집중 패턴 파훼/그로기 (`bc` code 8) |
| `boss_absorb` | 0.30s | 보스 소환수 흡수 회복 (`bc` code 6) |
| `dark_beam` | 0.20s | 몬스터/이벤트 암흑 광선 (`events.js` case `"d"`) |
| `wind_shrine` | 0.40s | 필드 `질주의 바람` 성소 가속 (`events.js` case `"wd"`) |
| `knife_throw` | 0.08s | 투척 단검/독침 발사 (`events.js` case `"z"`) |
| `pet_fetch` | 0.14s | 펫 아이템 회수 완료 (`events.js` case `"pk"`) |
| `pet_poof` | 0.14s | 펫 소환 해제 (`events.js` case `"pd"`) |
| `job_change` | 0.70s | 캐릭터 전직 달성 팡파르 (`events.js` case `"jc"`) |
| `water_fill` | 0.22s | 버드나무 마을 심부름 — 물뿌리개 채우기 (`chores.js`) |
| `water_pour` | 0.28s | 버드나무 마을 심부름 — 화단 물 주기 (`chores.js`) |
| `milk_clink` | 0.16s | 버드나무 마을 심부름 — 우유 넣기 (`chores.js`) |
| `weed_pull` | 0.14s | 버드나무 마을 심부름 — 잡초 뽑기 (`chores.js`) |
| `flyer_slap` | 0.08s | 버드나무 마을 심부름 — 전단지 붙이기 (`chores.js`) |
| `dog_sniff` | 0.22s | 버드나무 마을 심부름 — 강아지 산책 냄새 맡기 (`chores.js`) |
| `broom_sweep` | 0.15s | 협동 알바(동동아파트) — 빗자루 쓸기 (`coop.js` code 4) |
| `lift_heave` | 0.14s | 협동 알바(동동아파트) — 대형 쓰레기/소파 들기 (`coop.js` code 19) |
| `knife_chop` | 0.05s | 협동 알바(쥬쥬식당) — 도마 재료 손질 (`coop.js` code 34) |
| `plate_clink` | 0.08s | 협동 알바(쥬쥬식당) — 접시 담기/쟁반 올리기 (`coop.js` code 35, 39, 43) |
| `order_bell` | 0.24s | 협동 알바(식당/대장간) — 신규 주문 도착 벨 (`coop.js` code 40, 62) |
| `dish_scrub` | 0.14s | 협동 알바(쥬쥬식당) — 싱크대 설거지 문지르기 (`coop.js` code 41) |
| `dish_clean` | 0.16s | 협동 알바(쥬쥬식당) — 설거지 세척 완료 (`coop.js` code 42) |
