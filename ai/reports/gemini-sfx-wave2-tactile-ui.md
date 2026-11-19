# Gemini (Antigravity) — 추가 효과음 개선 프로젝트 (Wave 2: 생활·장비·의상·포켓폰·로비·소셜 촉각 SFX)

- **작성일**: 2026-11-19
- **브랜치**: `gemini/work` (`Desktop/Tales Tales/.work/gemini`)
- **구역 준수 (`ai/LANES.md` §3)**: Antigravity 담당 구역인 `game/public/audio.js`(소리 정의) 및 클라이언트 파일들의 `Sound.play(...)` 호출 이름만 수정 (`game/src/logic/**` 무수정).

## 1. 작업 요약

일상적인 플레이 루프에서 범용 `"ui"` / `"ok"` / `"coin"` / `"item"` / `"open"` / `"close"` / `"blip"`에 의존하던 장비·가방·의상·염색·캐릭터 생성·포켓폰·스탯/스킬 편성·소셜·알바 게시판·장날 동작에 **36종의 신규 Web Audio 합성 효과음**을 추가하고 각 UI/클라이언트 호출에 연결했습니다. (정의된 전체 SFX: `292종 → 328종`)

## 2. 수정한 파일 (총 18개, 모두 `LANES.md` 효과음 구역 내)

| 구분 | 파일 | 변경 내용 |
| --- | --- | --- |
| 소리 정의 | `game/public/audio.js` | Wave-2 촉각 SFX **36종** 추가 (`gear_equip` ~ `warp_click`) |
| 장비·가방·창고 | `game/public/items.js` | 장비 장착(`gear_equip`), 음식(`food_eat`), 주문서(`scroll_read`), 모닥불(`camp_light`), 펫(`pet_call`), 가방 정리(`bag_sort`) |
| 장비·가방·창고 | `game/public/win_char.js` | 장비 해제(`gear_unequip`), 무기 스왑(`weapon_swap`), 창고 드래그 보관(`bank_move`) |
| 장비·가방·창고 | `game/public/quickslots.js` | 단축칸 등록/교체(`qs_bind`), 단축칸 집기(`qs_pick`) |
| 장비·가방·창고 | `game/public/growth.js` | 창고 물건 이동(`bank_move`), 골드 입출금·일반 장비 일괄 판매(`gold_stash`) |
| 의상·염색·재봉 | `game/public/wardrobe_ui.js` | 외형 착용(`cloth_equip`), 입어보기(`cloth_try`), 염색 적용(`dye_splash`), 염색 초기화(`dye_wash`), 기념품 재봉(`sew_stitch`) |
| 로비·포켓폰 | `game/public/lobby.js` | 외형 파츠/프리셋(`char_part`), 랜덤/주사위(`char_dice`), 시작 무기 선택(`char_weapon`), 채널 입장·캐릭터 생성(`world_enter`) |
| 로비·포켓폰 | `game/public/phone.js` | 포켓폰 열기(`phone_open`), 닫기(`phone_close`), 앱 실행·홈 버튼(`phone_tap`) |
| 성장·전직·편성 | `game/public/statwin.js` | 스탯 훈련 확정(`stat_train`), 수련관 무기 선택(`char_weapon`), 망각의 의식(`stat_respec`) |
| 성장·전직·편성 | `game/public/jobtree.js` | 전직/숙련 초기화 확정(`stat_respec`) |
| 성장·전직·편성 | `game/public/loadout.js` | 스킬 슬롯 편성/적용(`skill_equip`), 스킬 강화 시도(`skill_rankup`) |
| 소셜·게시판·장날 | `game/public/net.js` | 귓속말 수신(`whisper_in`) |
| 소셜·게시판·장날 | `game/public/buddy.js` | 짝꿍 메시지 수신(`buddy_msg`) |
| 소셜·게시판·장날 | `game/public/win_social.js` | 파티·친구·길드 초대 발송(`invite_send`), 길드 창설(`guild_found`) |
| 소셜·게시판·장날 | `game/public/win_world.js` | 웨이포인트 이동 클릭(`warp_click`), 칭호 달기(`title_equip`) |
| 소셜·게시판·장날 | `game/public/board.js` | 알바 수락(`board_take`), 장날 토큰 구매(`fair_buy`) |
| 소셜·게시판·장날 | `game/public/fairmkt.js` | 장날 상점 구매(`fair_buy`) |
| 소셜·게시판·장날 | `game/public/sidequests.js` | 의뢰 수락(`board_take`), 완료(`quest`), 포기(`close`) |

## 3. 테스트 및 검증 결과

- **구문 검사 (`node --check`)**: 수정된 18개 JS 파일 전원 통과
- **전수 SFX 합성 및 참조 무결성 검증**: `Defined SFX: 328, Played: 328, Missing literal Sound.play keys: 0 []`
- **오디오/로직 빌드 테스트 (`node game/scripts/test-all.mjs bgm-recordings`)**: `src/logic.js unchanged`, `1/1 passed in 0.1 s`
