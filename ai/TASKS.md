# 작업 보드 — AI 팀 할 일

사용 방법: 원하는 일을 아래 섹션에 `- [ ] 할 일` 한 줄로 적고 저장한 뒤 `AI-TEAM.bat`을 더블클릭하세요.
각 AI는 자기 섹션에서 **위에서부터 체크 안 된 첫 번째 일**을 합니다. 끝난 일은 `AI-MERGE.bat`(Claude)이
검토·합치기 후 `[x]`로 바꿉니다. 한 번 실행에 AI마다 한 가지 일만 합니다.

## CODEX (구현 · 테스트)

- [ ] 거울(외형 변경)을 골드가 부족할 때 시도하면 거절되고 골드·외형이 그대로인지 확인하는 테스트를 `game/tests/looks.mjs`에 추가
- [ ] 더 이상 쓰지 않는 옛 스킬 이펙트 코드 정리: `game/public/growth.js`의 `skillFx` 25–32번·`zoneFx` 4–6번, `game/public/client.js`의 `attackFx` 10–24번, `game/public/scene2d.js`의 `showcase`/`renderStage`/`leaveStage` — 호출하는 곳이 없는지 grep으로 확인한 뒤 삭제, 테스트와 `shot.mjs --live`로 오류 없음 확인, 캐시 태그 올리기
- [ ] 휴대폰 가로 화면의 캐릭터 생성 페이지에서 추천 모습 버튼에 이름이 안 보이는 문제 수정 (`game/public/lobby.css`), `shot.mjs`로 iPhone 가로 크기 한 장 확인
- [ ] 도적의 수정 동굴·피의 심연 사망 횟수가 다른 직업보다 많음: `game/tests/growth.mjs`의 봇 결과를 확인하고, 도적 생존력(체력 성장 또는 연막/분신 지속)을 소폭 올려 사망 수를 다른 직업 수준으로 맞추기 (규칙 테스트 통과)

## GEMINI (분석 · 문서 · 콘텐츠)

- [ ] 레벨 1–50 구간별 "사냥터 · 몬스터 레벨 · 경험치 · 골드 · 드랍" 표를 `docs/balance.md`로 작성 (`game/src/logic/10-tables.js`, `20-helpers-mapkit.js`의 `xpNeed`, `34-maps-world.js` 기준). 성장이 막히거나 너무 빠른 구간을 표시
- [ ] `AGENTS.md` §3 파일 지도와 실제 파일을 대조해 틀린 줄·빠진 파일 목록을 보고서로 작성 (코드는 고치지 말 것)
- [ ] 세계관(꼬리 달린 동물 친구들 vs 지옥에서 올라온 괴수들)에 맞는 새 퀘스트 10개와 마을 NPC 대사 20줄을 `docs/content-ideas.md`에 한국어로 제안 (기존 `QUESTS`, `game/public/npctalk.js` 참고)
- [ ] 업적 목록(`60-content.js`의 `ACH`)을 읽고 너무 쉽거나 어려운 업적, 보상이 어색한 업적을 표로 정리하고 수정안을 제안
