# 작업 보드 — AI 팀 할 일

사용 방법: 원하는 일을 아래 섹션에 `- [ ] 할 일` 한 줄로 적고 저장한 뒤 `AI-TEAM.bat`을 더블클릭하세요.
각 AI는 자기 섹션에서 **위에서부터 체크 안 된 첫 번째 일**을 합니다. 끝난 일은 `AI-MERGE.bat`(Claude)이
검토·합치기 후 `[x]`로 바꿉니다. 한 번 실행에 AI마다 한 가지 일만 합니다.

**Claude와 Codex는 한 프로젝트입니다** (규칙: `ai/HANDOFF.md` §1). 기준은 언제나 로컬 `main` 하나 —
일은 `main`에서 브랜치를 따서 시작하고, 끝나면 `main` 위로 rebase해서 넘기고, Claude가 `main`에 합칩니다.
시작하기 전에 아래 "진행 중" 표에 한 줄을 적고, 남이 잡은 일은 하지 않습니다.
기능이 바뀌면 새 채팅에서 해당 행과 설계 문서로 시작합니다. 이어서 작업할 때는 보고서의 브랜치, 마지막 커밋, 검증 결과, 다음 작업을 읽습니다.

## 진행 중 (누가 · 무엇을 · 어디서)

| 누가 | 일 | 브랜치 · 폴더 | 시작 |
| --- | --- | --- | --- |
| Claude (통합 세션 2) | **협동 알바 전체** — 동동아파트 청소 개편, 쥬쥬식당 큰 홀, 대장간 v3, 새 알바 올빼미 도서관. `game/src/logic/68-coop.js`, `game/public/coop.js`, `12-life-tables.js`의 협동(COOP) 블록은 **Codex 손대지 말 것** (보상 1일 1회·재도전 가능 정책은 Codex 1998f06 그대로) | main | 2026-11-15 22:00 |
| Claude (통합 세션 1·2) | 스킬 이펙트·아이콘(`skillfx.js`, `skillfx_combo.js`, `skillicons.js`, `jobpal.js`, `swing.js`) — Codex 손대지 말 것 | main | 2026-11-15 |
| Claude (통합 세션 2) | **HD-2D 후처리** — 새 모듈 `game/public/postfx.js`(빛 번짐, 틸트시프트 초점 흐림, 시간대·지역 색감, 빛줄기, 설정 끔/보통/높음). `scene2d.js`에는 호출 1~2줄만. Codex의 `scene_depth.js`·`scene2d.js` 본체·`scene_map.js`는 Codex 담당 그대로 | main | 2026-11-15 |
| Codex | 레퍼런스 기반 낚시·요리·연금·대장 아이콘 | `codex/item-reference-art` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Codex | 초반 캐릭터 Lv.30 ↔ 무기 숙련도 Lv.20 도달 구간 검증 및 조정 | `codex/early-mastery` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Codex | 레벨대별 사냥 동선과 Lv.200 전용 사냥터 | `codex/hunt-routes` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Claude | 맵 그림 1단계 (수정굴·벽돌 회랑·폭포 고원 타일, `docs/design/maps-v2.md` 표 C) | `claude/maps-art-1` · 에이전트 워크트리 | 2026-11-15 |

## 이식 — `codex/combat-effects`(`c62b345`, 옛 v11 규칙 위)에서 지금 `main`(v12)으로 옮길 것

Codex 보고서 `ai/reports/codex-world-combat-life.md`(그 브랜치에 있음)의 "통합 시 확인" 표 순서. N1이 끝난 뒤
하나씩, 한 항목 = 한 브랜치. 저장 시트 모양이 바뀌는 항목은 시작 전에 Claude와 설계를 맞춥니다.

- [ ] 지역 서사·몬스터 41종 이름 검토와 본편 문구 이식 (메인 의뢰 진행 번호 유지). 도감 문구, 지역 목격자 의뢰 7개, 모리 후속 3개는 적용됨.
- [x] 창 전열 구호기·마도서 되살림 제본과 근접 무기 HP 비용. [지원 기술 인계](reports/codex-field-support-skills.md)
- [x] 7개 무기별 패시브 5개와 교차 장착 2칸. [숙련 패시브 인계](reports/codex-weapon-mastery-passives.md)
- [x] 되새김 인장 제작과 레벨별 골드 재분배. [스탯 인계](reports/codex-stat-redistribution.md)
- [ ] (Claude 통합 세션 2가 맡음 — Codex 건너뛸 것) 협동 근무지 5곳 → `life-and-coop.md` F의 C1–C3 순서로 (새 마을의 건물·실내 사용, `coopjobs.js`를 출발점으로)
- [ ] (Claude·Gemini 스킬 이펙트 작업 중 — Codex 건너뛸 것) `89afb18` 스킬 이펙트·타격음 다듬기를 지금의 `skillfx.js` 코드 번호에 맞춰

## CODEX (구현 · 테스트)

- [ ] `codex/combat-pressure`(ffda360, 보스 실루엣·엔드게임 장비 그림)를 지금 main 위로 rebase하고 `art.js`·`mobart.js`·`mobart_c.js` 충돌을 직접 해결(내 새 그림 6b283ed·7ad1e06과 합치기). `node tests/mobart.mjs`와 `--page mobs` 확인 후 넘기기 — Alpha 1.0.1에서 충돌로 빠짐
- [ ] `game/scripts/import-art.mjs --install`이 manifest를 다시 쓸 때 `bgmLocal`(로컬 BGM 목록)을 지워 버림 → `writeManifest`가 모르는 키를 보존하게 고치고, 설치 전후 manifest 비교 테스트 추가
- [x] Alpha 1.0.1 월드 원근·광원, 같은 와이파이 파티 접속. [검수](reports/codex-scene-depth.md)

- [x] Studio Goguma 시작 영상과 제작자 표기, 여우·다람쥐 꼬리 뒷모습 보정. [검수](reports/codex-studio-intro.md)

- [x] 균열 파편 무기 7종 실루엣, 장비 아이콘 9종, 여우·다람쥐 꼬리와 얼굴 윤곽 보정. [검수](reports/codex-reference-weapon-art.md)

차기 게임 소개 페이지와 PDF를 제작할 때는 협동 아르바이트를 독립 항목으로 싣습니다. 실제 2~4인 역할 분담 화면과 근무지별 구성은 [배관 수리 인계](reports/codex-coop-pipes.md)를 참고합니다.

- [x] 마을회관 2~4인 협동 배관 알바. [구현·검증](reports/codex-coop-pipes.md)
- [x] 루넬샤 필드·균열 보스 7종과 월드 크기 보강. [검수](reports/codex-boss-reference-art.md)
- [x] 작은꼬리 64×64 캐릭터·NPC·착용 외형, 버드나무토큰과 희귀 망토. [검증](reports/codex-person64.md)
- [x] 보스 4종 아트 개편과 2·4인 필드 및 균열 보스전 촬영. [검증](reports/codex-boss-combat-report.md)
- [x] 직업 스킬 33개 연출·효과음 연결 검수, 해머와 복합 직업 기술의 연출·소리 및 아이콘 보강. [스킬 인계](reports/codex-job-skill-feel.md)
- [x] 지역 몬스터 6종과 월요일 06:00에 교대하는 주간 보스 6종 적용. [몬스터·보스 인계](reports/codex-region-beasts-refresh.md)
- [x] 제미나이 실외·실내 BGM과 균열 테마별 재생 연결. [BGM 인계](reports/codex-recorded-map-bgm.md)
- [x] 양손해머의 머리 위 내려찍기, 월드 스프라이트 크기 및 원형 타격 범위 확대.

- [x] 양손해머·직업 성장·월드맵·파티 밸런스·스킬 연출과 로컬 BGM을 통합하고 [직업 성장 인계](reports/codex-job-skill-ranks.md)를 남김.

- [x] 거울(외형 변경)을 골드가 부족할 때 시도하면 거절되고 골드·외형이 그대로인지 확인하는 테스트를 `game/tests/looks.mjs`에 추가
- [x] 더 이상 쓰지 않는 옛 스킬 이펙트 코드 정리: `game/public/growth.js`의 `skillFx` 25–32번·`zoneFx` 4–6번, `game/public/client.js`의 `attackFx` 10–24번, `game/public/scene2d.js`의 `showcase`/`renderStage`/`leaveStage` — 호출하는 곳이 없는지 grep으로 확인한 뒤 삭제, 테스트와 `shot.mjs --live`로 오류 없음 확인
- [x] 휴대폰 캐릭터 생성 화면에서 추천 외형 20개 이름을 표시. 844×390, 667×375, 390×844 확인.
- [x] 몬스터 도감 설명 129개를 `11-mob-lore.js`에 추가하고 등록 카드에 표시. 지역은 선택 메뉴로 전환하고 설명 데이터·등록 전후 화면 검증.
- [x] 일일 과제 모닥불 요리 1회와 파티로 몬스터 10마리. [과제 인계](reports/codex-daily-party-hunt.md)
- [x] 필드 파티 경험치 16칸 근거리 공유와 1~4인 사냥 비교. [밸런스 인계](reports/codex-field-party-xp.md)
- [x] 광장 주민 17명 일과를 마을·지도·대화에 연결. [주민 일과 인계](reports/codex-npc-life-client.md)
- [x] 광장 장식 주민과 포포·모카를 포함한 34명 일과, 협동 보상 쟁반·가마솥 착용 개선. [광장 인계](reports/codex-plaza-routines.md)
- [x] 가방에서 요구 레벨을 충족한 장비로 빈 슬롯을 채울 수 있으면 ▲와 부위를 표시. 실제 서버에서 갑옷을 벗긴 뒤 `#w-inv`로 확인.
- [x] `docs/FILEMAP.md` 파일 지도와 실제 파일을 대조해 틀린 줄·빠진 파일을 고치기 (줄 수 `[N]` 갱신 포함, 문서만 수정). [검수](reports/codex-filemap.md)
- [x] 바람등호 Lv.100 구조 의뢰와 안전 갑판, 루넬샤 지도 표기와 작은꼬리들 서사. [인계](reports/codex-oasis-airship.md)
- [x] 단검·창 스킬 4종 연출, 단검·창·스태프·마도서 모션, 단검·창 타격음. [검수](reports/codex-skill-feedback-round2.md)
- [x] 버드나무마을 확장본에 재료 납품 2종·요리 1종·배달 1종을 연결하고 동선과 순익을 검증. [의뢰 설계](../docs/design/willow-job-economy.md) · [검증 보고서](reports/codex-atlas-navigation.md)

## GEMINI (분석 · 문서 · 콘텐츠 · [ART]/[VFX] 그림과 이펙트 — `ai/gemini.md` 5번)

**스킬 색은 `game/public/jobpal.js`의 `fxPal(fx코드, G, eid)`에서 가져올 것** (직업 팔레트, 다른 세션이 이미 skillfx.js·skillfx_combo.js를 이 방식으로 바꿔 둠 — 기존 색 코드를 새로 하드코딩하지 말 것).
**스킬 완성도 우선 (Owner, 2026-11-15)** — 아래 [SKILL] 표시 작업부터. 스킬 색은 직업 팔레트(`defs().jobPal`, `game/src/logic/04-job-palettes.js`)를 따를 것. 스킬 조합 규칙은 `docs/design/skill-combos.md` (상태 7종과 `["cb", mobId, code]` 이벤트).
- [ ] [VFX] 같은 방식으로 해머와 직업 스킬(파괴자·머서너리·성기사 등, `hammer_*`, `ironsiege`, `oathward` …)
- [ ] [SFX] `docs/fx-audit.md`에서 전용 소리가 없는 스킬마다 시전음·타격음을 `game/public/audio.js`에 코드로 만들고 연결 (무기 종류별로 결이 다르게: 금속·둔기·마법·활시위). 지금 가장 큰 타격음보다 크지 않게, 보고서에 새 소리 이름 목록
- [ ] [SFX] 치명타·스킬 마무리 타격음과 몬스터 피격/사망음을 크기별(일반·정예·보스)로 다르게
- [x] (Claude 17시 세션이 직업 색으로 다시 그림 — Gemini는 `game/public/skillicons.js`를 고치지 말 것) [VFX] [SKILL] 스킬 아이콘 손보기: `game/public/skillicons.js`에서 아이콘끼리 비슷하거나 무엇을 하는지 안 보이는 스킬을 골라 다시 그리기(16×16, 무기별 색 계열 유지). 새로 생긴 스킬(`03-skills.js`에 있는데 아이콘이 기본 모양인 것)도 포함. 미리보기 `--page icons` 스크린샷
- [ ] [VFX] [SKILL] 조합 상태 표시: 몬스터에게 걸린 경직·공중·빙결·표식·낙인·화상(1~3중첩)·끌림을 머리 위 작은 도트 표시/오라로 (한 몬스터에 여러 개가 겹쳐도 읽히게), 그리고 `["cb", mobId, code]`로 상태를 터뜨릴 때 코드별 폭발 연출(파쇄 얼음 조각, 점화 불꽃, 표식 폭발…). **`game/public/skillfx_combo.js`가 main에 생긴 뒤에만** — 없으면 건너뛰고 다음 작업으로
- [ ] [VFX] [SKILL] 새 시전 동작 연출: 차지(모을수록 커지는 빛), 집중(채널링 줄기), 도약·후퇴 잔상, 지정 위치 마법진. 위와 같은 조건(`skillfx_combo.js`가 생긴 뒤)
- [ ] [SFX] [SKILL] 조합 터뜨리기 소리 7종(상태별)과 차지 완료·집중 유지음. 위와 같은 조건
- [ ] [VFX] [SKILL] 신규 스킬 11종 본 연출 (`docs/design/skill-ideas.md` §11 "As built", 지금은 `skillfx_combo.js`의 임시 그림, 색은 `fxPal`): 148 땅울림 발구르기 충격 고리+균열 · 149 곡사 폭약 화살 포물선 → 화약 폭발(extra 2 = 착지) · 150 용뼈 관통 사격 굵은 뼈 화살+반동 섬광 · 151 구르며 쏘기 화살(extra 2 = "회심!") · 152 연쇄 번개 타격(연결선은 `ln 4`) · 153 어깨 돌파 충돌 파동 · 154 올무 화살 · 155 칼날 소용돌이 도는 칼날 고리(extra = 칼날 수) · 156 칼날 부채 폭발 · 157 연막 구름(반지름) · 158 칼등 받아치기 자세(extra 0)/패링 섬광(extra 1) · 159 산 가르기 모으는 빛(extra 0)/가르기(extra = 단계+1). **이 작업은 Claude가 신규 스킬을 main에 합친 뒤에만** — `game/src/logic/03-skills.js`에 `stomp`가 없으면 건너뛸 것
- [ ] [VFX] [SKILL] 새 스킬 6종 본 연출 (지금은 임시 그림, 계약은 `docs/design/skill-combos.md` §7): 140 처형 내려베기(모으는 빛 → 내려찍기 + 화면 흔들림), 141 급소 터뜨리기(표식 수만큼 커지는 분홍 폭발), 142 갈고리 창(사슬이 날아가 꽂히고 끌려옴), 143 점화 폭발(지정 위치 마법진 → 불기둥, 반지름 40), 144 영혼 착취(대상→시전자 흡수 줄기, 마지막 박자 폭발), 145 저격(모으는 조준선 → 아주 빠른 긴 화살과 관통 섬광). `game/public/skillfx_combo.js` 안에서만
- [ ] [VFX] [SKILL] 직업 전용기(`03-skills.js`의 kind "j") 4단계 성장 연출: 직업 레벨 단계(전용기 랭크)가 오를수록 같은 스킬이 더 크고 화려해지게(색 하나 추가 → 잔상 → 파편 → 마지막 단계 고유 마무리). 랭크는 이벤트/self에서 읽을 수 있는 값만 사용
- [ ] [VFX] [SKILL] 스킬 강화(+1~+10, `self.ske`) 단계별 빛: +4부터 은은한 테두리, +7 금빛 잔광, +10 전용 색 폭발. 내 스킬에만, 다른 사람 것은 이벤트에 정보가 없으면 생략
- [ ] [VFX] [SKILL] 패시브 발동 표시: 패시브가 실제로 터질 때(공명, 급소, 흡혈, 반격 등 — `docs/fx-audit.md`와 `03-skills.js` kind "p") 캐릭터 머리 위 작은 아이콘 깜빡임 + 짧은 효과. 한 번에 여러 개면 줄 세우기
- [ ] [VFX] [SKILL] 단축칸(핫바) 조합 안내: 지금 노리는 몬스터에 터뜨릴 수 있는 상태가 걸려 있으면, 그 상태를 쓰는 스킬 칸이 반짝이게(`game/public/quickslots.js`/`hud.js`, 서버 수정 없이 클라이언트가 아는 정보만). 쿨타임 끝나는 순간 칸 번쩍임도
- [ ] [VFX] [SKILL] 무기 바꾸기(Ⅰ/Ⅱ) 순간 연출과 무기별 대시 잔상 색(대검 강철빛, 단검 그림자, 창 바람, 지팡이 불티, 마도서 룬, 활 깃털, 해머 먼지)
- [ ] [VFX] [SKILL] 파티 연계 표시: 서로 다른 플레이어가 상태를 걸고 터뜨리면 "연계!" 글씨와 두 사람 사이 잇는 빛줄기(`cb` 이벤트와 시전자 정보로 클라이언트에서 판단, 정보가 부족하면 터뜨린 사람 쪽만)
- [ ] [SFX] [SKILL] 새 스킬 6종 시전음·타격음, 차지 완료 '팅', 집중 유지 웅웅, 무기 바꾸기 소리
- [x] [VFX] 새 보스 졸개 3종의 전용 그림: 혈루 결정 전갈 `bloodshard`(지금은 붉게 칠한 전갈), 밤장막 박쥐 `nightbat`(지금은 batcluster 색만 바꿈), 먹장어 머리 `hagfishhead`(지금은 eelknot). `game/public/mobart_f.js`의 보스 그림 방식 그대로, 지옥 괴수 느낌(귀엽지 않게), 16색 이내·외곽선. `--page mobs --q "k=bloodshard,nightbat,hagfishhead&z=4"` 스크린샷 1장
- [x] [VFX] 꽃무덤 고래 `bloomwhale`의 잠수/떠오름 이펙트와 혈루 왕도마뱀 `bloodhorn`의 혈루 사출(jet) 물줄기를 `game/public/skillfx.js`에 코드로 그리기 (서버 이벤트 `bt`/`bc`는 그대로, 그림만). 바닥 경고와 겹쳐도 잘 보이게
- [x] [VFX] 스킬 이펙트·타격음 점검표: 모든 액티브 스킬 35개와 직업 스킬(`game/src/logic/03-skills.js`·`02-jobs-stats.js`의 `fx` 번호)마다 지금 화면에 무엇이 그려지고(`game/public/skillfx.js`, `swing.js`, `events.js`, `growth.js`) 어떤 소리가 나는지(`game/public/audio.js`) 표로 정리하고, "약함/보통/좋음"과 이유를 매겨 `docs/fx-audit.md`에 작성. 맨 아래에 고칠 순서(약한 것부터) 목록. 코드는 고치지 말 것
- [x] [VFX] `docs/fx-audit.md`에서 "약함"인 검·단검·창 스킬 이펙트를 다시 그리기 (휘두름 궤적, 타격 순간 섬광·파편, 바닥 충격). 서버 이벤트·판정 범위는 그대로, 그림이 실제 판정 범위와 맞게. 스킬마다 미리보기 스크린샷
- [x] [VFX] 같은 방식으로 지팡이·마도서·활 스킬 (원소별 색: 불·얼음·번개·암흑 구분이 한눈에)
- [x] [ART] 쥬쥬식당 협동 알바 도구·요리 아이콘 시안 6개(프라이팬, 쟁반, 샐러드, 생선구이, 스튜, 더러운 접시) 16×16 → `asset/generated/coop-diner/`, 프롬프트 파일 포함. 설치는 하지 말 것 (Owner 승인 후 Claude가 설치)
- [ ] [VFX] 몬스터 기본 공격 이펙트: 근접(물기·할퀴기·들이받기)은 휘두름 호와 타격 섬광, 원거리(침·뼈·깃털·독)는 날아가는 도트 투사체와 착탄, 공격 직전 0.2초 예비 동작 번쩍임. 몬스터를 생김새별 무리로 묶어 무리마다 하나씩 (`game/public/events.js`·`skillfx.js`에서 몬스터 공격 이벤트를 찾아 그림만). 지옥 괴수답게 거칠게
- [ ] [VFX] 몬스터 피격·사망 이펙트를 크기별로: 일반(작은 살점·핏방울 도트), 정예(파편+짧은 충격파), 보스(사망 연출 2초: 균열·섬광·잔해). 지금 피격 흰 번쩍임·밀림은 유지
- [ ] [VFX] 상태 이상과 버프 시각화: 화상·중독·둔화·빙결·출혈(몬스터와 플레이어 모두, 작은 도트 입자와 색조), 공격·방어 주문서, 모닥불 온기, 축복 오라. 한 화면에 여러 개가 겹쳐도 지저분하지 않게
- [ ] [VFX] 정예 몬스터 특성(`defs.traits`)마다 서로 다른 오라·입자 (특성 이름만 봐도 어떤 효과인지 짐작되게)
- [ ] [VFX] 보상 연출: 바닥 드롭 등급별 빛기둥(매직·레어·전설·세트), 장비 강화 성공·실패·저주, 스킬 강화 성공, 레벨업, 업적 달성
- [ ] [VFX] 옛 보스와 필드 보스(크리온·심연의 어미, 각 사냥터 필드 보스)의 공격 이펙트 점검 후 약한 것부터 다시 그리기 — `docs/fx-audit.md`에 보스 섹션 추가 후 작업
- [ ] [SFX] 몬스터 공격음을 생김새 무리별로(물기·할퀴기·침·포효), 정예·보스는 더 무겁게. 기존 믹스보다 크지 않게, 보고서에 새 소리 이름 목록
- [x] [ART] 보스 세트 장비 아이콘 8개 (16×16, 지금은 일반 5단계 그림을 같이 씀): 밤장막 세트 `veil_h` 박쥐 가면 · `veil_a` 장막 망토 · `veil_r` 송곳니 반지 · `veil_n` 흉곽 부적 (검보라·뼈·자홍 심장), 꽃무덤 세트 `bloom_h` 고래뼈 투구 · `bloom_a` 갈비 흉갑 · `bloom_r` 혼꽃 반지 · `bloom_n` 결정 심장 (청록 수정·백골·꽃잎). 파일 이름 = 아이템 id (`asset/generated/gear-sets/veil_h.png` …), 프롬프트 파일, `asset/CREDITS.md` 한 줄, `import-art.mjs`로 16×16 정리까지. 설치는 하지 말 것
- [ ] [ART] 보스 전설 무기 5종의 가방 아이콘(16×16)과 손에 드는 월드 스프라이트(크기·방향은 `asset/README.md` 2번 표): `w_bloodcrown` 혈루 왕관 창, `w_cavhammer` 공동 망치, `w_ribbook` 흉곽 등불(책), `w_whalebow` 고래뼈 활, `w_bloomstaff` 혼꽃 지팡이 → `asset/generated/boss-legendaries/`. 설치는 하지 말 것
- [ ] [ART] 보스 재료 아이콘 2개: `mat_bloodtear` 피눈물 결정, `mat_clubclaw` 망치 갯가재 집게 → `asset/generated/boss-mats/`
- [ ] [ART] 일반 장비 리디자인 시안 1: 투구·갑옷·장갑 각 1~5단계(15개, 단계가 오를수록 재질이 가죽→철→강철→문양→전설 느낌으로) → `asset/generated/gear-t/`, 파일 이름 `h_1.png`…`g_5.png`. 지금 코드 그림(`game/public/art.js` `helmIcon` 등)과 갤러리에서 나란히 비교할 수 있게
- [ ] [ART] 일반 장비 리디자인 시안 2: 신발·반지·목걸이 각 1~5단계(15개, `b_1`…, `r_1`…, `n_1`…) 같은 방식
