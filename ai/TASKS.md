# 작업 보드 — AI 팀 할 일

사용 방법: 원하는 일을 아래 섹션에 `- [ ] 할 일` 한 줄로 적고 저장한 뒤 `AI-TEAM.bat`을 더블클릭하세요.
각 AI는 자기 섹션에서 **위에서부터 체크 안 된 첫 번째 일**을 합니다. 끝난 일은 `AI-MERGE.bat`(Claude)이
검토·합치기 후 `[x]`로 바꿉니다. 한 번 실행에 AI마다 한 가지 일만 합니다.

## CODEX (구현 · 테스트)

- [ ] 거울(외형 변경)을 골드가 부족할 때 시도하면 거절되고 골드·외형이 그대로인지 확인하는 테스트를 `game/tests/looks.mjs`에 추가
- [ ] 더 이상 쓰지 않는 옛 스킬 이펙트 코드 정리: `game/public/growth.js`의 `skillFx` 25–32번·`zoneFx` 4–6번, `game/public/client.js`의 `attackFx` 10–24번, `game/public/scene2d.js`의 `showcase`/`renderStage`/`leaveStage` — 호출하는 곳이 없는지 grep으로 확인한 뒤 삭제, 테스트와 `shot.mjs --live`로 오류 없음 확인
- [ ] 휴대폰 가로 화면의 캐릭터 생성 페이지에서 추천 모습 버튼에 이름이 안 보이는 문제 수정 (`game/public/lobby.css`), `shot.mjs`로 iPhone 가로 크기 한 장 확인
- [ ] 몬스터 도감에 몬스터별 한 줄 설명(한국어, 귀엽고 짧게, 괴수는 기괴하게): `game/src/logic/10-tables.js` `MOBS`에 `lore` 필드 + `defs()`로 전달 + 도감 창에 표시, 테스트(모든 몬스터에 lore 있음) 추가
- [ ] 일일 과제 종류 2가지 추가 (모닥불에서 요리 1회, 파티로 몬스터 10마리) — `game/src/logic/60-content.js`, 테스트 추가
- [ ] 가방 장비 칸에 "빈 슬롯에 낄 수 있음 ▲" 표시 (빈 장비 슬롯에 맞는 장비를 들고만 다니는 경우) — 가방 그리기는 `game/public/client.js` `renderBag` 근처, `shot.mjs --live --keys i --el "#w-bag"` 한 장
- [ ] `docs/FILEMAP.md` 파일 지도와 실제 파일을 대조해 틀린 줄·빠진 파일을 고치기 (줄 수 `[N]` 갱신 포함, 문서만 수정)

## GEMINI (분석 · 문서 · 콘텐츠)

- [ ] 레벨 1–50 구간별 "사냥터 · 몬스터 레벨 · 경험치 · 골드 · 드랍" 표를 `docs/balance.md`로 작성 (`game/src/logic/10-tables.js`, `20-helpers-mapkit.js`의 `xpNeed`, `34-maps-world.js` 기준). 성장이 막히거나 너무 빠른 구간을 표시
- [ ] 세계관(꼬리 달린 동물 친구들 vs 지옥에서 올라온 괴수들)에 맞는 새 퀘스트 10개와 마을 NPC 대사 20줄을 `docs/content-ideas.md`에 한국어로 제안 (기존 `QUESTS`, `game/public/npctalk.js` 참고)
- [ ] 업적 목록(`60-content.js`의 `ACH`)을 읽고 너무 쉽거나 어려운 업적, 보상이 어색한 업적을 표로 정리하고 수정안을 제안
