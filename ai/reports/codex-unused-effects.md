# 미사용 스킬 이펙트 정리

> - [ ] 더 이상 쓰지 않는 옛 스킬 이펙트 코드 정리: `game/public/growth.js`의 `skillFx` 25–32번·`zoneFx` 4–6번, `game/public/client.js`의 `attackFx` 10–24번, `game/public/scene2d.js`의 `showcase`/`renderStage`/`leaveStage` — 호출하는 곳이 없는지 grep으로 확인한 뒤 삭제, 테스트와 `shot.mjs --live`로 오류 없음 확인, 캐시 태그 올리기

## 호출처 확인과 변경

- `git grep`으로 클라이언트·프리뷰·테스트의 호출처를 찾고, `rg`로 서버 이벤트 생성 코드를 대조했다. 기본 공격은 무기별 번호와 박치기 40번을 보낸다. 현재 스킬은 40번대 이상을 보내며, 도적의 그림자 바꿔치기는 대상이 없을 때 `55-class-skills.js`에서 19번을 보낸다.
- `game/public/client.js`의 `attackFx`에서 사용 중인 19번을 유지하고 10–18, 20–21, 23–24번과 `Growth.skillFx` 호출을 삭제했다. 지속 장판은 `skillfx.js`가 처리하는 10·11번만 서버에서 생성하므로 `Growth.zoneFx` 호출을 삭제했다. `game/public/growth.js`에서 두 함수 정의도 제거했다.
- `game/public/scene2d.js`의 `showcase`와 `renderStage`는 호출처가 없었다. `client.js`의 맵 로드가 호출하던 `leaveStage`는 초기값이 `null`인 옛 상태만 비웠으므로 호출과 함께 삭제했다. 타이틀과 캐릭터 생성에서 쓰는 `figure`/`drawFigure`는 별도 경로에서 사용된다.
- `game/public/index.html`의 캐시 태그 네 곳을 `1795130001`로 갱신하고, 브라우저의 기본 `/favicon.ico` 요청에서 발생한 404를 없애기 위해 빈 favicon을 명시했다. `AGENTS.md`의 파일 지도도 갱신했다.

## 검증

- `npm.cmd run test:rules` 15/15 통과.
- 로컬 Wrangler에서 `node scripts/shot.mjs --live --url http://127.0.0.1:18787 --out shots/codex-unused-effects-live.png`를 실행했다. `--eval`로 마을 입장, 새 캐시 태그, 서버에 기본 공격을 보낸 뒤 클라이언트에 들어온 베기 이펙트를 확인했다. 브라우저의 페이지 오류와 콘솔 오류는 없었다.
- `git diff --check`를 통과했고, 삭제한 함수 이름의 참조가 클라이언트·스크립트·테스트에 남지 않았다.

남은 작업은 통합 담당자의 검토와 작업 보드 갱신이다.
