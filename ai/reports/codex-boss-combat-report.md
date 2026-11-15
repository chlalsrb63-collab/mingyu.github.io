# 보스 4종 아트와 플레이 가이드

- `game/public/mobart_f.js`에서 망치 갯가재(갑각과 해머 집게), 혈루 왕도마뱀(낮게 깔린 갑옷과 붉은 등뼈), 밤장막 박쥐군주(뿔과 큰 날개), 꽃무덤 고래(넓은 턱과 드러난 갈비뼈)의 실루엣을 새로 그렸다. 기존 포즈·페이즈와 전투 판정을 사용한다.
- 로컬 서버에서 바람초원 파티 2인·4인의 스킬 적중과 경험치 공유를 확인했다. 별도 촬영용 저장소에서 4명의 테스트 캐릭터를 균열 3층에 배치했다. 손갈기 사자의 1.3초 범위 전조와 파티 공격, 실제 HP 감소를 확인했다.
- 화면 `game/shots/report-field-2p.png`, `game/shots/report-field-4p.png`, `game/shots/report-rift-combat.png`, `game/shots/boss-silhouettes-report.png`. 새 왕도마뱀의 실제 공격 장면은 `game/shots/report-bloodhorn-live.png`. 공유용 가이드 PDF는 별도 산출물이다.
- `node --check game/public/mobart_f.js`, `node scripts/test-all.mjs --no-build mobart bosses2 bossscript` 3/3 통과. 아트 규격 검사로 93종·12포즈·모든 방향의 캔버스 경계를 확인했다.
