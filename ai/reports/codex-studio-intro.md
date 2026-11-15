# Studio Goguma 시작 영상과 캐릭터 뒷모습

- 소유자가 제공한 3초짜리 `Intro.mp4` 원본을 `public/assets/intro/studio-goguma.mp4`로 복사하고 SHA-256 일치를 확인했다.
- 처음 페이지를 열 때 영상이 한 번 재생된다. 기본은 음소거이며 영상에서 소리를 켤 수 있다. 종료, 건너뛰기 버튼, `Esc`로 타이틀이 열린다. 미디어 오류, 자동 재생 차단, 로드 지연과 동작 줄이기 설정도 처리한다.
- 타이틀의 `PRESS START` 바로 아래에 `만든이 · 민규 / studio goguma`를 표시한다. 영상 중에는 타이틀 조작과 게임 사운드 시작을 보류한다.
- 여우·다람쥐는 뒷모습에서 꼬리 밑동을 좁혀 몸통 뒤로 들어가도록 그렸다. 앞·옆의 프레임은 픽셀 단위로 같다. 망토 착용과 대기·걷는 자세를 1배율과 확대에서 검사했다.
- 로컬 브라우저에서 MP4 재생과 오디오 선택, 자동 종료, 모바일 건너뛰기, 키보드, 미디어 오류, 동작 줄이기, 로그인 전후 제작자 표기를 확인했다.
- 화면은 `game/shots/studio-goguma-intro.png`, `game/shots/studio-goguma-title.png`, `game/shots/person-tail-rear.png`.
- 전체 규칙 검사 56/56 통과 후 새 장비 에셋이 들어간 `main`을 반영했다. 최종 브랜치에서 `looks`, `person64`, `wardrobe`를 재검사했다.
