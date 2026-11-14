# CREDITS — 외부·AI 에셋 출처와 라이선스

팩(또는 파일 묶음) 하나에 한 줄. 넣을 때 바로 적습니다. 라이선스를 모르면 쓰지 않습니다 (`reference/`에만).
CC-BY 계열은 게임 안에도 크레딧을 보여야 합니다 ("게임 안 표기" 칸에 어디에 보였는지 적기).
`game/scripts/import-art.mjs --install`은 파일 이름(예: `sword_t3`)이나 폴더(예: `weapons/sword`)가 이 표에
없으면 설치를 거부합니다. AI가 만든 그림은 "만든 사람"에 도구, "출처"에 프롬프트 파일, "라이선스"에
"AI-generated (도구 약관)"을 적습니다.

| 이름 | 만든 사람 | 출처 URL | 라이선스 | 받은 날 | 사용 중 (어디에) | 게임 안 표기 |
| --- | --- | --- | --- | --- | --- | --- |
| Galmuri (갈무리) 픽셀 폰트 | Lee Minseo (quiple) | https://github.com/quiple/galmuri | SIL OFL 1.1 | 2026-11 | HUD · 창 글꼴 (`public/fonts/`, 라이선스 `public/fonts/Galmuri-OFL.txt`) | 필요 없음 (OFL) |
| Pretendard | Kil Hyung-jin (orioncactus) | https://github.com/orioncactus/pretendard | SIL OFL 1.1 | — | 본문 글꼴, CDN으로 불러옴 (`public/index.html`) | 필요 없음 (OFL) |
<!-- 예시 (지우고 쓰세요):
| Tiny Dungeon | Kenney | https://kenney.nl/assets/tiny-dungeon | CC0 | 2026-11-20 | incoming/ 보관만 | 필요 없음 |
| 검 1–5단계 시안 (weapons/sword: sword_t1…sword_t5) | ChatGPT 이미지 생성 → import-art.mjs 정리 → 주인 승인 | ai/prompts/weapon-assets.md 프롬프트 B | AI-generated (OpenAI 약관) | 2026-11-20 | weapon.sword.t1–t5 | 필요 없음 |
-->
