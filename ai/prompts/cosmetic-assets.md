# 외형 장비(코스튬) 에셋 — 규칙과 Codex 프롬프트

모자·상의·등·얼굴 외형은 전부 **코드로 그립니다** (`game/public/wardrobe.js`). 이 파일은 ① 지켜야 할 규칙,
② 기준 데이터가 어디 있는지, ③ 미리보기·테스트 방법, ④ Codex에게 붙여 넣을 프롬프트(한국어 + 영어 본문)입니다.
무기 외형(무기 스킨)은 `ai/prompts/weapon-assets.md`.

---

## 1. 규칙 (tests/cosmetics.mjs가 모든 아이템 × 종족 × 방향 × 프레임을 검사)

1. **고정 좌표 금지.** 모든 위치는 `anchors(base, o, view, f)`의 `A`에서: `A.top`/`A.x0`/`A.x1`(머리 윗줄),
   `A.halfAt(y)`, `A.earTop`/`A.ear`/`A.earIn`(귀), `A.eye`/`A.lx`/`A.rx`(눈), `A.nx`/`A.ny`(코),
   `A.cheekL`/`A.cheekR`, `A.bt`(몸 윗줄)/`A.foot`(발 줄), `A.f`(프레임), `A.front/side/back`.
   숨쉬기·걸음의 머리 흔들림(`HEAD_BOB`)은 이미 반영돼 있음.
2. **종족별 맞춤은 species.js에만**: 머리 모양 `SPECIES`, 귀 종류 `EARS`(tall · small · side · antler · horn · none),
   `headAnchor()`(머리), `faceAnchor()`(눈·코·볼), 눈 색 목록 `EYE_PIX`. 아이템 안에 "토끼면 +1" 같은 예외를 넣지 말 것.
3. **레이어 순서** (`dress`): 앞·옆 = 등 아이템 → 몸 → 상의 → 망토 걸쇠/가방 끈 → 모자(크라운·귀·챙) → 눈 복원 → 얼굴.
   뒤 = 몸 → 상의 → 등 아이템(머리 **아래**) → 모자.
4. **귀와 모자**: 모자마다 `ears: "through"`(귀가 구멍/챙 뒤로 나옴: 비니·밀짚·마법사·야구모자·베레) 또는
   `"behind"`(모자가 귀를 덮고 큰 귀·뿔만 위로 보임: 해적·산타·투구·개구리·요리사). 왕관·리본·화관·뿔은 귀 **앞**에
   작게, 천사 고리는 가장 높은 귀 위에 뜸. 개구리의 눈 혹은 항상 위에 남음(모자는 눈 혹 사이에 앉음).
5. **눈은 절대 가리지 않음** — 모자 다음에 눈 픽셀을 되살림. 일부러 가리는 얼굴 아이템만 `covers: true`(선글라스·안대).
6. **외곽선**: 배경에 닿는 픽셀은 모두 잉크 `#2b2233`(천사 고리처럼 자기 잉크 색 `ink`도 가능). 몸·얼굴 안에서는
   색으로 구분. 털과 색이 너무 비슷하면 가장자리가 자동으로 한 단계 어두워짐(`sep`). 얼굴 테·끈은 `rim(A, c)`를 써서
   어두운 무늬(판다·너구리) 위에서는 밝은 테로 바뀌게.
7. **상의 = 8칸 픽셀 템플릿** (`TOP`, 열 12–19; 몸은 13–18): 앞·옆·뒤 각각 `[윗줄, 가운데, 아랫줄, (발 사이 밑단)]`.
   발에 맞춰 붙으므로 숨쉴 때는 윗줄이 머리에 가려지고, 기지개 땐 윗줄이 두 번 — 무늬가 깜빡이지 않음.
   **상의마다 한눈에 읽히는 모티프 하나**(멜빵·단추, 끈·주머니, 세일러 칼라·스카프, 벨트·버클, 금색 앞단, 리본 허리띠,
   넥타이, 동정·고름, 털 가장자리, 별무늬). 색 글자: c 기본 · s 그림자 · d 짙은 그림자 · l 밝은 · b 보조 · B 보조 그림자 ·
   w 흰 · y 금 · r 빨강 · k 잉크 (`pal(p)`로 추가).
8. **등 아이템**: 날개는 왼쪽 날개 템플릿(오른쪽 아래가 뿌리) 하나로 `wingPair()` — 머리 옆까지 올라와야 보임, 걸음에
   맞춰 퍼덕임. 망토는 걸음마다 밑단이 흔들림. 뒤에서 볼 때는 머리 밑으로.
9. **팔레트**: 그림자는 `sh()`(보랏빛), 빛은 `li()`(따뜻한 노랑). 1px 반투명·안티에일리어싱 금지, 외톨이 픽셀 금지.
   귀엽고 단순하게 — 16px 동물이 입었을 때 실루엣이 바뀌거나 모티프 하나가 또렷해야 함.
10. **카탈로그 id는 영구**: 새 아이템 = `game/src/logic/65-cosmetics.js COSMETICS`(새 와이어 코드, 한국어 이름·설명) +
    `wardrobe.js ART` 한 줄. 기존 id는 지우거나 번호를 바꾸지 말 것(저장된 캐릭터가 깨짐) — 디자인이 안 맞으면
    같은 id에 그림만 고칠 것.

## 2. 미리보기와 검사 (`game/`에서)

```
node scripts/cos-audit.mjs                                  # 모든 칸 × 15종족 접촉 시트 → shots_cos/ (gitignore)
node scripts/cos-audit.mjs --slot hat --view side --frame 2 --sp 0,3,7,12 --z 6
node scripts/cos-audit.mjs --each --items top_robe,top_suit --sp 0,13 --z 7 --crop 12 --cy 18   # 몸 확대
node scripts/cos-audit.mjs --item hat_crown                 # 한 아이템: 15종족 × 3방향 × 6프레임
node scripts/cos-audit.mjs --giant hat_wizard,top_robe      # 전사 거인화(1.6배)
node tests/cosmetics.mjs                                    # 가드 테스트 (~4초)
npm run test:rules                                          # 전부
```
브라우저 없이 node로 그립니다(`scripts/pixcanvas.mjs`). 그림은 **반드시 PNG를 열어 눈으로 확인**한 뒤 커밋.
`public/`을 바꿨으면 `public/index.html`의 `?v=` 4곳을 올릴 것.

---

## 3. Codex 프롬프트

**한국어 (붙여 넣기)**
```
AGENTS.md 와 ai/prompts/cosmetic-assets.md 를 읽어. 외형 아이템 <종류: 모자/상의/등/얼굴> "<이름>" 을 추가해 (또는: <id>의
그림을 고쳐). 규칙 1~10을 지키고, 위치는 anchors()의 A 값만 써. 종족별 문제는 species.js 데이터로 해결해.
1) game/src/logic/65-cosmetics.js COSMETICS 에 새 줄(새 와이어 코드, 한국어 이름·설명, 출처) → npm run build:logic
2) game/public/wardrobe.js 에 디자인(HAT/TOP/BACK/FACE)과 ART 한 줄
3) node scripts/cos-audit.mjs --item <id> 와 --slot <칸> 시트를 열어 15종족 × 앞·옆·뒤 × 걸음 프레임을 직접 확인하고,
   이상한 곳(떠 있음, 눈 가림, 귀와 겹침, 외곽선 끊김, 털과 같은 색, 뒤·옆 그림 없음)을 고쳐
4) npm run test:rules 통과, index.html ?v= 올리기, 보고서 ai/reports/codex-*.md (시트 경로 포함), 커밋.
```

**English (prompt body)**
```
Read AGENTS.md and ai/prompts/cosmetic-assets.md. Add the cosmetic <slot: hat/top/back/face> "<name>" (or: redraw <id>).
Follow rules 1–10: place everything from the anchors `A` (never fixed head coordinates); fix per-species fit in
species.js data (SPECIES, EARS, headAnchor, faceAnchor), not inside the item; pick the hat's ear mode ("through" or
"behind"); tops are 8-column templates per view with one clear motif; wings come from one left-wing template via
wingPair(); face rims use rim(A, c) so they read on dark masks; never cover the eyes unless the piece is made to
(`covers: true`). Steps: 1) a COSMETICS row in game/src/logic/65-cosmetics.js (new wire code, Korean name and
description, source) and `npm run build:logic`; 2) the design and an ART entry in game/public/wardrobe.js;
3) render `node scripts/cos-audit.mjs --item <id>` and `--slot <slot>` (game/shots_cos/), open the PNGs and check all
15 species in front/side/back over the walk frames — floating, covered eyes, ear clashes, broken outline, fur-coloured
parts, missing side/back art — and fix; 4) `npm run test:rules` (tests/cosmetics.mjs is the guard), bump `?v=` in
public/index.html, write ai/reports/codex-*.md with the sheet paths, commit. Never delete or renumber an existing id.
```
