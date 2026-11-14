# asset — 그림·소리 보관함과 갤러리

게임 그림은 기본적으로 **코드로 그립니다** (`game/public/weapons.js`, `art.js`, `mobart*.js` …).
이 폴더는 그 밖의 그림·소리 — 받은 무료 팩, 참고 이미지, AI가 만든 시안, 다듬어서 승인한 완성본 — 를
**종류별로 모아 두고 한눈에 보는 곳**입니다. 이 폴더 자체는 배포되지 않습니다. 승인된 파일만
`import-art.mjs --install`로 `game/public/assets/`에 복사되어 게임에 나옵니다.

## 1. 한눈에 보기 — 갤러리

저장소 맨 위의 **`ASSETS.bat`** 을 더블클릭하세요. 하는 일:

1. 지금 코드로 그린 그림 전부를 PNG로 뽑아 `asset/_export/`에 저장 (무기 5종×5단계 + 전설·세트·스킨·강화 빛,
   장비·아이템 아이콘, 몬스터, 캐릭터 프리셋, 외형)
2. `asset/` 안의 모든 파일 목록(`gallery.json`, `gallery.js`)을 만들고
3. `asset/index.html`(갤러리)을 브라우저로 엽니다.

갤러리에서: 확대 1×/2×/4×/8×, 배경(어둡게·밝게·체크·풀밭), 이름 검색, 폴더 접기, 그리고
**새 그림과 같은 이름의 코드 그림을 나란히 비교**("새 그림 옆에 비교")할 수 있습니다.
명령으로는 `game` 폴더에서 `npm run art:export` → `npm run art:gallery`.

## 2. 폴더 구조

| 폴더 | 무엇을 | 깃에 올리나 |
| --- | --- | --- |
| `incoming/` | 받은 팩 원본 (압축 풀어 팩 이름 폴더째로, 라이선스 파일 포함) | 라이선스 확인된 것만 |
| `reference/` | **참고용** 이미지 (분위기·형태 참고, 라이선스 모름) — 절대 게임에 안 씀 | ✗ (gitignore) |
| `generated/` | AI가 만든 **원본** (ChatGPT 이미지 등), 다듬기 전 | ○ |
| `weapons/sword · dagger · spear · staff · book/` | **승인된 완성본** 무기 (게임 규격) | ○ |
| `gear/helm · armor · gloves · boots · ring · amulet/` | 승인된 장비 아이콘 (16×16) | ○ |
| `items/potion · food · scroll · material · misc/` | 승인된 아이템 아이콘 (16×16) | ○ |
| `monsters/` `characters/` `tiles/` `ui/` `fx/` | 승인된 그 밖의 그림 | ○ |
| `sfx/` `music/` `fonts/` | 소리·음악·폰트 | ○ |
| `_export/` | 지금 코드 그림의 PNG (ASSETS.bat이 매번 새로 만듦) | ✗ |
| `_preview/` | `import-art.mjs`의 전/후 비교 그림 | ✗ |
| `index.html` | 갤러리 페이지 | ○ |
| `CREDITS.md` | **모든 외부·AI 그림의 출처와 라이선스** | ○ |

### 무기 파일 이름 (게임 규격)

| 파일 | 게임 키 | 크기 |
| --- | --- | --- |
| `sword_t3.png` (단계 1–5) | `weapon.sword.t3` | 월드 스프라이트: 검 44×32, 창 52×32, 단검·지팡이·책 32×32 |
| `sword_lg_chain.png` (전설 힘: chain nova greed haste thorn feast echo giant) | `weapon.sword.lg.chain` | 〃 |
| `sword_set_rift.png` (세트: rift pioneer runner) | `weapon.sword.set.rift` | 〃 |
| `sword_skin_frost.png` (무기 스킨: sakura frost candy bone star flame) | `weapon.sword.skin.frost` | 〃 |
| `icon_sword_t3.png`, `icon_sword_lg_chain.png` … | `icon.weapon.sword.t3` … | 가방 아이콘 16×16 |

월드 스프라이트는 **오른쪽을 향하고**, 손잡이(손 위치)가 (5, 16) 근처, 칼끝이 오른쪽 끝입니다 (책은 가운데).
아이콘은 **왼쪽 아래 손잡이 → 오른쪽 위 끝**으로 대각선입니다. 장비·아이템 아이콘은 아이템 id로:
`gear/helm/h_3.png` → `icon.item.h_3`, `items/potion/hp_s.png` → `icon.item.hp_s`.
레어도 테두리 색과 +7/+10 강화 빛은 게임이 그 위에 자동으로 덧입힙니다.

## 3. 외부·AI 그림을 게임에 넣는 순서

1. **넣기**: 받은 팩 → `incoming/`, AI 결과 → `generated/`, 참고만 할 것 → `reference/`.
   `CREDITS.md`에 한 줄 (팩: 이름·만든 사람·주소·라이선스 / AI: "AI-generated", 도구, 프롬프트 파일).
2. **다듬기** (`game` 폴더에서):
   ```
   node scripts/import-art.mjs ..\asset\generated\sword_sheet.png --split --names sword_t1,sword_t2,sword_t3,sword_t4,sword_t5
   node scripts/import-art.mjs ..\asset\generated\staff.png --kind staff --tier 4
   node scripts/import-art.mjs ..\asset\generated\icon.png --kind dagger --tier 2 --icon
   ```
   커진 그림의 도트 격자를 찾아(또는 `--scale 16`) 1픽셀=1도트로 줄이고, 배경을 지우고, 색 수를 줄이고
   (`--colors 16`, `--palette game`), 잡티를 지우고, 없으면 1픽셀 외곽선(#2b2233)을 두르고, 게임 캔버스에
   맞춰 `weapons/…`에 저장합니다. 전/후 비교 그림은 `_preview/`에. `--help`로 모든 옵션.
3. **보고 고르기**: `ASSETS.bat` → 갤러리에서 코드 그림과 나란히 비교. 마음에 들면 승인.
4. **연결**: `node scripts/import-art.mjs --install ..\asset\weapons\sword\sword_t3.png`
   → `game/public/assets/`로 복사 + `manifest.json` 등록 + 캐시 태그 갱신. 게임에서 확인(`PLAY.bat`).
   되돌리기: `--uninstall weapon.sword.t3`. 목록: `--list`.
5. 커밋: `asset/…`, `game/public/assets/…`, `game/public/index.html`.

## 4. 라이선스 규칙

- **CC0 / 퍼블릭 도메인** 최우선 (표기 의무 없음). **CC-BY**는 게임 안 크레딧 필요. 폰트는 **OFL**.
- **유료 팩**은 상업적 사용·게임 안 재배포가 허락된 라이선스만.
- **비상업(NC)·재배포 금지·라이선스 모름** → 게임에 쓰지 않습니다. 참고만 하려면 `reference/`(깃에 안 올라감).
- **AI 생성 그림**: 도구의 이용약관이 상업적 사용을 허락해야 하고, CREDITS.md에 "AI-generated (도구, 프롬프트 파일)"을
  적고, 반드시 `import-art.mjs` 정리 + 주인 승인을 거칩니다. 실존 작품·작가 스타일을 베끼라는 프롬프트는 쓰지 않습니다.
- 무기 디자인 프롬프트: `ai/prompts/weapon-assets.md`.

자세한 규칙은 저장소 맨 위 `AGENTS.md`의 "External assets" 절을 보세요.
