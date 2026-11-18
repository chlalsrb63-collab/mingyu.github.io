# 효과음(SFX) 전수 검수 및 스킬·컨텐츠 다채화 보고서

## 1. 무엇을 했나
- 최신 `main`(`842f843`) 기준으로 `game/public/audio.js` 및 클라이언트 전반(`skillfx.js`, `skillfx_combo.js`, `events.js`, `chores.js`, `coop.js`, `overlay.js`, `statwin.js`, `sxwin.js`)의 `Sound.play(...)` 호출과 `SFX` 카탈로그를 전수 대조·검수했습니다.
- 호출되지만 `SFX`에 정의되지 않아 무음으로 무시되던 누락 효과음(`clang`, `tick`), `JOB_NOTE`에 빠져 있던 신규 직업 3종(`destroyer`, `mercenary`, `paladin`)을 복구했습니다.
- 콤보 액티브(`140~145`), 직업 Lv.30 회전기(`146~147`), 신규 1차 무기 스킬 12종(`148~159`), 콤보 상태 폭발(`cb 1~9`), 무기 패시브 발동(`ps`), 보스 고유 기믹(`꽃무덤 고래`, `혈루 왕도마뱀`), 월드 이벤트, 마을 심부름, 협동 아르바이트에 총 **67종**의 신규 코드 합성 효과음을 추가·연결했습니다(전체 `SFX` **289종**).
- 자체 코드 리뷰를 통해 `weapons_daggers_collection.js`의 `frostglaive`(빙하 결정 단검) 코등이 보석 색상 키(`sapphire`) 누락 수정 및 `skillfx_combo.js`의 다단 히트 채널링 스킬(`144`, `146`, `147`, `155`) `job_note` 배음 중복 재생 디바운싱까지 완료했습니다.
- Codex와 Claude가 본편(`main`)에서 이어서 확인·통합할 수 있도록 후속 제안서(`ai/proposals/gemini-sfx-and-assets-integration.md`)를 작성하고 최신 `main` 위로 리베이스를 마쳤습니다.

## 2. 핵심 검수 발견 사항
1. **미정의 SFX 키 호출 (무음 버그 2건)**
   - `overlay.js`: 낮 시간대 마을 캉캉대장간 야외 모루 근처에서 `Sound.play("clang")`을 호출하나 `SFX.clang`이 없어 무음 처리됨.
   - `statwin.js` 및 `sxwin.js`: 스탯 가감 버튼 클릭 및 가위바위보 초시계 카운트다운에서 `Sound.play("tick")`을 호출하나 `SFX.tick`이 없어 무음 처리됨(`Sound.tick`은 BGM 시퀀서 메서드).
2. **`JOB_NOTE` 직업 고유 배음 누락 (3종)**
   - `02-jobs-stats.js`에 정의된 `destroyer`(파괴자), `mercenary`(머서너리), `paladin`(성기사)가 `audio.js`의 `JOB_NOTE`에 없어 스킬 시전 시 기본 모험가 음(`520Hz` 단음)으로 대체되던 문제 해결.
3. **스킬(`140~159`)·콤보(`cb`)·보스 연출의 무음 및 공용 효과음 중복**
   - `skillfx_combo.js`:
     - 콤보/신규 액티브 선딜레이(`extra === 0`: `140` 처형 내려베기, `143` 점화 폭발, `144` 영혼 착취, `145` 저격, `158` 칼등 받아치기, `159` 산 가르기) 무음 해소.
     - `144`(영혼 착취), `154`(올무 화살), `155`(칼날 소용돌이) 무음 해소 및 `140~159` 전체 스킬에 고유 타격/시전 합성음 부여.
     - 콤보 상태 폭발(`["cb", mobId, code]`): 8종 중 무음이던 6종(`1` 경직 강타, `3` 추가타, `4` 표식 폭발, `5` 낙인 폭발, `7` 결집, `9` 띄우기)과 `2`(파쇄), `6`(점화)에 전용 폭발음 부여.
   - `skillfx.js`: 보스 `꽃무덤 고래` 잠수/솟구침(`bloomwhaleDive`), `혈루 왕도마뱀` 혈루 사출(`bloodhornJet`), 보스 패턴 파훼(`bc 8`)·쫄 흡수(`bc 6`), 몬스터 빙결(`fz`)·방어 균열(`vu`), 패시브 발동(`115` 매의 시야, `ps` `142`/`146`/`150`/`153`)에 전용 효과음 부여.
4. **월드·마을 심부름·협동 알바 생활음 세분화**
   - `events.js`: 전직(`jc`) 전용 팡파르(`job_change`), 질주의 바람 성소(`wd` → `wind_shrine`), 펫 전리품 회수/소환 해제(`pet_fetch`/`pet_poof`), 암흑 광선(`dark_beam`), 투척 단검(`knife_throw`) 분리.
   - `chores.js`: 물뿌리개 채우기(`water_fill`), 물 주기(`water_pour`), 우유병 넣기(`milk_clink`), 잡초 뽑기(`weed_pull`), 전단지 붙이기(`flyer_slap`), 강아지 냄새 맡기(`dog_sniff`)로 세분화.
   - `coop.js`: 전투용 `hit`/`swing`/`pop`을 공유하던 빗자루 쓸기(`broom_sweep`), 가구 들기(`lift_heave`), 도마 칼질(`knife_chop`), 접시 세팅(`plate_clink`), 주문 벨(`order_bell`), 설거지 문지르기/완료(`dish_scrub`/`dish_clean`)를 생활형 효과음으로 교체(올빼미 도서관 `90~97` 효과음 유지).

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
