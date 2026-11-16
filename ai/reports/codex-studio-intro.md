# Studio Goguma 시작 영상과 캐릭터 뒷모습

- 소유자가 제공한 3초짜리 `Intro.mp4` 원본을 `public/assets/intro/studio-goguma.mp4`로 복사하고 SHA-256 일치를 확인했다.
- 처음 페이지를 열 때 원본 영상만 3초간 무음으로 재생한다. 영상이 끝나면 타이틀이 처음 표시된다. 로딩 제한과 재생 제한을 따로 적용하며, 재생 오류가 나면 타이틀을 바로 연다.
- 타이틀의 `PRESS START` 바로 아래에 `만든이 · 민규 / studio goguma`를 표시한다. 영상 중에는 타이틀 조작과 게임 사운드 시작을 보류한다.
- 여우·다람쥐는 뒷모습에서 꼬리 밑동을 좁혀 몸통 뒤로 들어가도록 그렸다. 앞·옆의 프레임은 픽셀 단위로 같다. 망토 착용과 대기·걷는 자세를 1배율과 확대에서 검사했다.
- 원본 작업에서 로컬 브라우저의 MP4 재생과 제작자 표기를 확인했다.
- 화면은 `game/shots/studio-goguma-intro.png`, `game/shots/studio-goguma-title.png`, `game/shots/person-tail-rear.png`.
- 전체 규칙 검사 56/56 통과 후 새 장비 에셋이 들어간 `main`을 반영했다. 최종 브랜치에서 `looks`, `person64`, `wardrobe`를 재검사했다.
- 2026-11-16 `codex/studio-opening`에서 데스크톱·세로 모바일의 영상 단독 자동 재생, 자연 종료·로그인 진입, 로딩 지연과 영상 오류를 확인했다.
