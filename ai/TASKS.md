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
| Codex | 레퍼런스 기반 낚시·요리·연금·대장 아이콘 | `codex/item-reference-art` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Codex | 초반 캐릭터 Lv.30 ↔ 무기 숙련도 Lv.20 도달 구간 검증 및 조정 | `codex/early-mastery` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Codex | 레벨대별 사냥 동선과 Lv.200 전용 사냥터 | `codex/hunt-routes` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Codex | N1 NPC 일과 서버 규칙 (`docs/design/npc-life.md` B–D, K) | `codex/npc-life` · `~/.codex/worktrees/willow-plaza-release` | 2026-11-15 |
| Claude | 맵 그림 1단계 (수정굴·벽돌 회랑·폭포 고원 타일, `docs/design/maps-v2.md` 표 C) | `claude/maps-art-1` · 에이전트 워크트리 | 2026-11-15 |

## 이식 — `codex/combat-effects`(`c62b345`, 옛 v11 규칙 위)에서 지금 `main`(v12)으로 옮길 것

Codex 보고서 `ai/reports/codex-world-combat-life.md`(그 브랜치에 있음)의 "통합 시 확인" 표 순서. N1이 끝난 뒤
하나씩, 한 항목 = 한 브랜치. 저장 시트 모양이 바뀌는 항목은 시작 전에 Claude와 설계를 맞춥니다.

- [ ] 지역 서사·몬스터 41종 이름 검토와 본편 문구 이식 (메인 의뢰 진행 번호 유지). 도감 문구, 지역 목격자 의뢰 7개, 모리 후속 3개는 적용됨.
- [ ] 창 Lv.15 전열 구호기·마법서 Lv.15 되살림 제본(파티 회복)과 근접 무기 HP 비용을 `57-weapon-skills.js`로, FX 번호는 빈 번호에
- [x] 7개 무기별 패시브 5개와 교차 장착 2칸. [숙련 패시브 인계](reports/codex-weapon-mastery-passives.md)
- [ ] 되새김 인장 제작 + 레벨별 골드 재분배를 `12-life-tables.js` 레시피에
- [ ] 협동 근무지 5곳 → `life-and-coop.md` F의 C1–C3 순서로 (새 마을의 건물·실내 사용, `coopjobs.js`를 출발점으로)
- [ ] `89afb18` 스킬 이펙트·타격음 다듬기를 지금의 `skillfx.js` 코드 번호에 맞춰

## CODEX (구현 · 테스트)

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
- [x] 가방에서 요구 레벨을 충족한 장비로 빈 슬롯을 채울 수 있으면 ▲와 부위를 표시. 실제 서버에서 갑옷을 벗긴 뒤 `#w-inv`로 확인.
- [ ] `docs/FILEMAP.md` 파일 지도와 실제 파일을 대조해 틀린 줄·빠진 파일을 고치기 (줄 수 `[N]` 갱신 포함, 문서만 수정)

## GEMINI (분석 · 문서 · 콘텐츠)

- [ ] 레벨 1–50 구간별 "사냥터 · 몬스터 레벨 · 경험치 · 골드 · 드랍" 표를 `docs/balance.md`로 작성 (`game/src/logic/10-tables.js`, `20-helpers-mapkit.js`의 `xpNeed`, `34-maps-world.js` 기준). 성장이 막히거나 너무 빠른 구간을 표시
- [ ] 세계관(꼬리 달린 동물 친구들 vs 지옥에서 올라온 괴수들)에 맞는 새 퀘스트 10개와 마을 NPC 대사 20줄을 `docs/content-ideas.md`에 한국어로 제안 (기존 `QUESTS`, `game/public/npctalk.js` 참고)
- [ ] 업적 목록(`60-content.js`의 `ACH`)을 읽고 너무 쉽거나 어려운 업적, 보상이 어색한 업적을 표로 정리하고 수정안을 제안
