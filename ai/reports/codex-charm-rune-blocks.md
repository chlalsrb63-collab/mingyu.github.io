# 참 각인 타일 · 로컬 통합

- 브랜치 `codex/charm-rune-blocks`. 참 디자인 `0a0783e`, 로컬 `main` 병합 `a24a270` 및 `61774f6`. 마지막 병합의 `main`은 `1dcdf64`.
- 자동 병합에 충돌이 없었다. 두 병합에서 `game/`의 `npm run build:logic`을 실행했고 생성 파일이 원본 조각과 일치했다.

## 만진 파일

- `game/public/charms.js` — 감정한 참을 서버의 점유 좌표에 따라 합성한다. 각 칸에 룬 각인을 넣고 가방, 보드, 감정 결과, 드래그와 회전에 같은 타일을 사용한다. 은·청동·금 색상과 전설별 문양을 사용한다. 미감정 상태는 봉인 아이콘으로 표시한다.
- `game/public/hud.css` — 공유 파일. 참 타일, 축소 아이콘, 배치 가능·불가 미리보기 스타일을 조정했다.
- 구역 밖 수정 — `game/public/charms.js`는 구역표를 읽기 전에 요청받은 참 디자인이다. 이후 작업에는 `ai/LANES.md`의 Codex 구역을 적용한다.
- 같은 브랜치에 포함된 기존 장비 커밋 `ee7894a`는 `game/src/logic/{10-tables,50-loot-combat,51-prefix,53-prefix-guard,66-charms}.js`, 생성본 `game/src/logic.js`, `game/tests/{charms,prefix,prefix-guard,rune-sockets}.mjs`를 변경했다.
- `ai/reports/codex-charm-rune-blocks.md` — 변경 사항과 검증 결과를 기록한다.

## 검증

- `node scripts/test-all.mjs charms maps world content lifeskills loot rune-sockets rune-powers` — 8/8 통과.
- `node scripts/test-all.mjs prefix prefix-guard` — 2/2 통과.
- 최초 병합의 지도 검사에서 `cloudtemple` 생성이 153 ms로 150 ms 제한을 넘었다. 단독 재실행은 86 ms였고 최신 병합본의 지도 검사도 통과했다.
- `npm run check:split`, `node --check game/public/charms.js`, `git diff --check` 통과.
- Chromium에서 게임 모듈과 테스트용 캐릭터 데이터로 보드를 렌더링했다. 점유 칸 10개의 각인, 가방 참 3개, 미감정·잠긴 칸·전설 아이콘, 드래그, 90° 회전 및 배치 가능·불가 표시를 확인했다. 브라우저 오류가 없었다.

## 몬스터 이름 확인

- 이름 변경 커밋 `42f0b63`이 로컬 `main` `1dcdf64`에 포함됐다. 8830 플레이 작업 트리는 검사 초기에 이전 커밋 `842f843`이었고 최종 확인 시에는 `1dcdf64`였다.
- 플레이 작업 트리의 생성 규칙에서 두굴, 모랫빛 두굴, 토비또와 각 설정 문구를 확인했다. 8830이 제공하는 도감 모듈이 해당 작업 트리의 파일과 일치했다.
