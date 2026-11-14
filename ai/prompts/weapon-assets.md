# 무기 에셋 — 검토와 프롬프트 (Codex CLI · ChatGPT 이미지)

이 파일 하나로: ① 보여 준 외부 에셋 시트를 써도 되는지 검토, ② Codex가 **코드로** 새 무기 디자인을 그리게 하는
프롬프트 A, ③ ChatGPT 이미지 생성용 프롬프트 B와 정리 명령, ④ AI 결과 묶음을 Codex가 검수하는 프롬프트 C.
폴더·명령은 `asset/README.md`, 규칙은 `AGENTS.md` §4-7·§9.

---

## 0. 검토 — 보여 준 두 시트를 쓸 수 있나?

**참고한 시트**: ① 16×16~24×24 RPG 아이템 아이콘 격자 (장갑·장화·목걸이·반지·지팡이 여러 단계·마법서·오브·가방·열쇠,
줄마다 회갈색 → 화려하게 빛나는 전설로 올라감), ② "100 swords" (1–100번, 24~32px 대각선 칼, 사브르·시미터·톱날·
물결날(플랑베르주)·레이피어·식칼형·수정 칼 등).

### 라이선스
- 두 시트 모두 **라이선스를 모릅니다** → 게임에 **그대로도, 잘라서도, 따라 그려서도** 넣을 수 없습니다.
  `asset/reference/`에 두고 **아이디어(실루엣 종류, 단계별 색 오르는 방식)만** 참고합니다 (그 폴더는 깃에 안 올라감).
- 쓰려면 원본 페이지에서 라이선스를 확인해야 합니다: **CC0/퍼블릭 도메인**, 또는 **상업적 사용과 게임 안 재배포를
  허락하는 유료 라이선스**(itch.io 팩 대부분이 이런 식)일 때만. 그때는 `asset/incoming/<팩 이름>/`에 원본과
  LICENSE 파일을 넣고 `asset/CREDITS.md`에 한 줄을 적은 뒤 아래 정리 과정을 거칩니다.
  "무료 다운로드"는 라이선스가 아닙니다. NC(비상업)·재배포 금지·출처 불명은 쓰지 않습니다.

### 우리 게임 스타일과 맞나?
| | 그 시트 | 우리 게임 |
| --- | --- | --- |
| 크기 | 24~32px 대각선 칼, 16~24px 아이콘 | 가방 아이콘 16×16 (대각선), **월드 스프라이트는 오른쪽을 향함** (검 44×32, 창 52×32, 단검·지팡이·책 32×32, 손 위치 GRIP (5,16)) |
| 선 | 가늘고 섬세한 날, 2~3단 명암, 반사광 | **두툼한 도트**, 재질마다 밝은 면 1 + 그림자 1, 1px 어두운 외곽선 `#2b2233` |
| 비율 | 사실적인 칼 비율 | 16px짜리 **통통한 동물 영웅이 자기 몸만 한 무기**를 듦 → 짧고 굵고 큼직한 날, 1배율로도 읽히는 실루엣 |
| 단계 | 회색 → 빛나는 전설 | 녹슨/나무 → 강철 → 기사단(금·보석) → **하이테크(건메탈+청록 빛)** → **차원/공허(보라·검정+수정)** |
| 각도 | 대각선만 | 아이콘은 대각선, 손에 든 그림은 수평 → 대각선 그림을 45° 돌리면 도트가 깨짐 |

→ 24~32px 대각선 칼은 **16×16 아이콘으로 줄이면** 세부가 뭉개지고, 월드 스프라이트로 쓰려면 다시 그려야 합니다.
가는 날·섬세한 반사광은 우리 "통통하고 단순한" 방향과 다릅니다.

### 추천 경로
1. **기본: Codex가 코드로 그리기 (프롬프트 A)** — 참고 시트에서 *실루엣 아이디어*만 얻어 `game/public/weapons.js`의
   도형+재질 시스템으로 새 디자인을 추가. 지금 파이프라인(레어도 테두리, 전설·세트·스킨 재색, +7/+10 빛, 아이콘 자동 생성)과
   그대로 맞물리고 **라이선스 위험이 0**입니다.
2. **보조: ChatGPT 이미지 (프롬프트 B)** — 컨셉/러프 용. 결과는 반드시 `import-art.mjs`로 정리 → 갤러리에서 코드
   그림과 비교 → **주인 승인** → `--install`. 정리해도 어색하면 "컨셉"으로만 쓰고 프롬프트 A로 Codex가 코드로 옮깁니다.
3. 외부 팩: 라이선스가 확인된 것만, 2번과 같은 정리·승인 과정.

---

## 프롬프트 A — Codex CLI: 새 무기 실루엣을 코드로 (권장)

Codex를 `Tales Tales` 폴더(또는 `.work\codex`)에서 실행하고 아래를 붙여 넣으세요. `<N>`은 종류마다 몇 개 (예: 4).

```
Read AGENTS.md, ai/codex.md and ai/prompts/weapon-assets.md (section 0 and prompt A), then
.claude/skills/pixel-art/rules/03-silhouette-and-form.md, 04-outlines-and-edges.md,
14-readability-and-scale.md, 22-materials-hard.md, 73-props-and-items.md, 83-ui-and-icons.md and
92-generated-art-tells.md. Run `cd game && npm run art:export` and look at asset/_export/weapons/ (the current
code-drawn weapons) and, for inspiration ONLY, at anything in asset/reference/ — never trace or copy a reference.

Task: give each weapon kind <N> new SILHOUETTES in game/public/weapons.js, inspired by classic RPG sword/staff sheets
(sabre, scimitar, cleaver, flamberge/wavy blade, rapier, serrated/saw blade, crystal blade, bone blade, thorn blade;
for spears: glaive, trident, partisan, war scythe; for staves: crook, forked branch, orb cage, crescent; for books:
chained tome, skull tome, crystal-bound grimoire), and use them so legendary weapons stop being mere recolours.

Rules:
- Keep the existing system: a design is a function returning { sh: shapes (R P C L D in weapon space: s from the hand
  (0) to the tip, t across, negative t = lit upper edge), head: [s0,s1,t0,t1], blade: [material names] }, materials
  only from M (one lit + one shadow tone per material, the rasteriser shades), one-pixel outline added by the code.
- Add `SIL = { sword: { sabre: () => ({...}), ... }, dagger: {...}, spear: {...}, staff: {...}, book: {...} }` and a
  map `MOTIF_SIL = { sword: { chain: "flamberge", nova: "cleaver", greed: "sabre", haste: "rapier", thorn: "serrated",
  feast: "bone", echo: "crystal", giant: "cleaver" }, ... }` (choose per kind). In build(), when the motif is a
  legendary power with a silhouette for that kind, start from that design instead of the tier design; the motif's
  recolour and extras still apply. Normal items keep their tier designs (names in src/logic/10-tables.js WEAPON_NAMES:
  rust/crude → steel → knightly gilt → high-tech gunmetal+cyan → void/rift violet+crystal).
- Fit the world canvas: sword ≤ 38 px from pommel to tip (canvas 44×32), dagger ≤ 20 (32×32), spear ≤ 48 (52×32),
  staff ≤ 28 (32×32), book about 20×14 front-on; nothing outside t ∈ [-14, 14]. The 16×16 icon is made automatically.
- Cute and chunky to match 16-px animal heroes holding weapons as big as themselves: blades at least 3 px thick
  (a rapier 2 px), big readable heads, no 1-px noise, no anti-aliasing, no pillow shading. Every silhouette must be
  recognisable as a black shape at 1x.
- Client-only change: no logic, no wire, no sheet fields. Do not edit game/src/logic.js.
- Preview: add a mode `?m=sil` to game/public/_wardrobe.html that shows every SIL design per kind at 4x with its icon,
  and extend game/scripts/export-art.mjs to write asset/_export/weapons/<kind>/<kind>_sil_<name>.png (+ icon_ variant).
- Test: in game/tests/wardrobe.mjs check that every SIL design's shape points stay inside the canvas bounds above
  (pure geometry, no canvas in node) and that every MOTIF_SIL entry names an existing design.

Verify: `cd game && npm run test:rules`, `node scripts/export-art.mjs --only weapons && node scripts/gallery.mjs`,
ONE screenshot `node scripts/shot.mjs --page wardrobe --q "m=sil" --size 1240x900 --out shots/sil.png` and look at it;
fix anything muddy. Bump the ?v= cache tag in game/public/index.html (all four). Write ai/reports/codex-weapon-sil.md
(what each silhouette is, which legendary uses it, the screenshot path) and commit on codex/<task> (stage by path).
```

---

## 프롬프트 B — ChatGPT 이미지 생성 (종류마다 시트 한 장)

ChatGPT(이미지 생성)에 붙여 넣습니다. `{KIND}` 줄만 바꿔 다섯 번 (검·단검·창·지팡이·책). 영어가 결과가 더 정확합니다.
결과 PNG는 `asset\generated\`에 `sword_sheet_01.png`처럼 저장하세요.

```
Create a pixel-art weapon SPRITE SHEET for a cute isometric MMORPG.

SUBJECT ({KIND} = SWORD):
Row 1, five tiers from left to right, each clearly better than the last:
 1. "Rusted greatsword": crude, notched, rusty brown-grey slab, plain iron crossguard, leather grip.
 2. "Steel two-hander": clean steel, simple fuller, wrapped grip.
 3. "Knight's claymore": bright steel, gilded forward-swept guard, one blue gem.
 4. "High-frequency blade": dark gunmetal, vents, a thin glowing cyan edge line (tech, not magic).
 5. "Dimension cutter": hooked black-violet void blade, glowing lilac crack, two small crystal shards floating off the tip.
Row 2, three legendary variants (same size class, unique silhouettes, not recolours):
 6. Lightning flamberge: wavy pale-blue blade with a yellow zigzag spark.
 7. Ember cleaver: wide orange-red cleaver blade with a glowing crack.
 8. Thorn saw: green-grey serrated blade with thorn spikes on the back edge.

STRICT PIXEL-ART RULES:
- True pixel art on an exact square grid. Each weapon is drawn inside its own 32x32-pixel cell at 1 art pixel = 1 pixel,
  then the whole sheet is enlarged with NEAREST-NEIGHBOUR scaling so every art pixel is an exact 8x8 block of one colour.
  No blur, no anti-aliasing, no soft edges, no gradients, no dithering noise, no half pixels.
- Layout: 4 cells per row with at least 1 empty cell-width of space between weapons; weapons never touch each other.
- Orientation: blade pointing to the UPPER-RIGHT at 45 degrees, grip/pommel at the LOWER-LEFT, like an inventory icon.
- Outline: every weapon has a 1-art-pixel dark outline in #2b2233 all the way round.
- Shading: light comes from the top-left. Each material uses exactly ONE highlight tone and ONE shadow tone besides its
  base colour. Maximum 16 colours per weapon. Shadows lean violet, highlights lean warm.
- Proportions: cute but sturdy — short, thick, chunky blades (at least 3 art pixels wide) and big readable guards and
  heads, made to be held by a chubby 16-pixel animal hero. Silhouettes must read as a black shape at 1x.
- Palette (use these colours, or very close ones):
  steel #e2e8f0 #b4bcc9 #7a7f98 · bright steel #f0f6ff #c4d0e0 #8690b0 · rust #c4a894 #94786a #64484c ·
  iron #9a9eaa #6c707e #464658 · dark metal #6a6e7c #454856 #2c2c3c · gunmetal #a6b2c4 #6e7a90 #464c66 ·
  carbon #5a5e6c #373a46 #22222e · wood #c48e5c #9a6a40 #6a4434 · dark wood #8e6444 #6a4630 #463040 ·
  leather #9a6a48 #74482e #4e2e2e · gold #fff0a0 #e8bc4c #a8742e · bone #fff8e4 #e6d8ba #b0a08e ·
  red #ff8a78 #e04a3c #a0283a · green #a4e07a #5aa84a #2e6a46 · blue #8ab4ff #4a6ad0 #2e3a8a ·
  violet #d8a8ff #9a5ae0 #5a2ea0 · void #6a4a9a #3c2668 #221640 · crystal #ffd0ff #c88af0 #7e48c0 ·
  teal #9af0e0 #3ab8b0 #1e6a7a · accents: cyan glow #7af4ff, core #e8ffff, energy #e8a8ff, spark #fff4a0,
  ruby #ff5a6a, sapphire #5ab8ff, orange #ff9a3a, white #ffffff, outline #2b2233.
- Background: fully TRANSPARENT. If transparency is impossible, one flat solid pure white (#ffffff) background with no
  shadow, no texture, no checkerboard pattern, no vignette.
- Nothing else in the image: no text, no numbers, no labels, no frames, no grid lines, no UI, no hands, no scenery.
- Original designs only; do not imitate any existing game, artist or asset pack.
```

다른 종류는 SUBJECT만 바꿉니다 (단계 이름은 게임의 `WEAPON_NAMES` 그대로):
- **DAGGER**: 1 worn knife (dull, wrapped) · 2 assassin's stiletto (black, red tassel) · 3 twin venom fangs (bone, green venom) ·
  4 carbon tanto (matte, hot orange spine) · 5 rift fang (jagged crystal, cracked with light) / legendary: lightning kris, gold
  parrying dagger, bone hook-knife. 셀 크기 그대로 32x32, 칼이 짧고 굵게 (날 길이 12~16 art px).
- **SPEAR**: 1 bamboo spear · 2 steel pike (red tassel) · 3 knight's halberd (gilt collar) · 4 plasma lance (cone, cyan core) ·
  5 void trident (curled prongs, crystal point) / legendary: glaive, war scythe, partisan. 아이콘 시트는 32x32 셀, 대각선.
- **STAFF**: 1 apprentice stick (green glass pebble) · 2 rune staff (blue gem in a wooden claw) · 3 sage's staff (gilt
  crescent, big sapphire, ribbon) · 4 plasma rod (coils, caged cyan orb) · 5 void sceptre (thorned crown, black-violet orb,
  circling fragments) / legendary: forked branch with fire orb, crook with lightning, crystal cluster staff.
- **BOOK** (월드 그림도 아이콘처럼 정면): 1 worn spellbook (yellowed pages, torn corner) · 2 rune grimoire (blue cover,
  glowing rune) · 3 sage's codex (violet, gilt corners, golden sigil) · 4 hologram codex (teal metal slate, light pages, a
  floating panel) · 5 void tome (black-violet, an open eye on the pages, shards) / legendary: chained tome, skull tome,
  crystal-bound grimoire. "drawn OPEN, facing the viewer, not rotated" 로 방향 문장을 바꿉니다.

**월드 스프라이트(손에 든 모습)용**으로 따로 받고 싶으면 방향 문장을 이렇게 바꿉니다:
`Orientation: horizontal, blade pointing straight to the RIGHT, pommel at the far left, cells 48x32 (spear 56x32).`

### 받은 그림 정리하기 (`game` 폴더에서)
```
:: 시트 → 아이콘 8개 (순서: 윗줄 왼→오, 다음 줄)
node scripts/import-art.mjs ..\asset\generated\sword_sheet_01.png --split --names icon_sword_t1,icon_sword_t2,icon_sword_t3,icon_sword_t4,icon_sword_t5,icon_sword_lg_chain,icon_sword_lg_nova,icon_sword_lg_thorn --fit
:: 수평 시트 → 월드 스프라이트
node scripts/import-art.mjs ..\asset\generated\sword_world_01.png --split --names sword_t1,sword_t2,sword_t3,sword_t4,sword_t5,sword_lg_chain,sword_lg_nova,sword_lg_thorn
:: 대각선 그림 하나를 월드 스프라이트로 (45° 회전은 도트가 상하니 손질 필요)
node scripts/import-art.mjs ..\asset\generated\staff_04.png --kind staff --tier 4 --rotate 45 --fit
:: 색이 너무 많거나 우리 팔레트와 다르면
... --colors 12 --palette game
:: 격자를 못 찾으면 (뿌옇게 확대된 그림) 그림 뷰어로 한 도트의 크기를 재서
... --scale 16
```
그다음 `ASSETS.bat` → 갤러리에서 코드 그림과 나란히 비교 → 마음에 드는 것만 `asset/CREDITS.md`에 적고
`node scripts/import-art.mjs --install ..\asset\weapons\sword\icon_sword_t3.png …` → `PLAY.bat`으로 게임에서 확인.
파일이 이미 있으면 `--force`가 있어야 덮어씁니다.

---

## 프롬프트 C — Codex: `asset/generated/` 묶음 검수·정리·추천

```
Read AGENTS.md (§4 rule 7, §9), asset/README.md and ai/prompts/weapon-assets.md. New AI-generated pictures are in
asset/generated/ (list them; skip ones already listed in asset/CREDITS.md as installed).
For each picture:
1. Normalise it with game/scripts/import-art.mjs into the right asset/weapons/<kind>/ (or gear/, items/) name:
   sheets with --split --names in reading order (look at the picture first to name each sprite: tier 1–5 by material
   progression rust/crude → steel → knightly gilt → high-tech cyan → void violet; legendary motifs chain nova greed haste
   thorn feast echo giant; sets rift pioneer runner; skins sakura frost candy bone star flame). Use --fit if needed,
   --palette game when the colours drift, --scale N if no grid is found. Never overwrite an existing file without
   asking (no --force).
2. Look at every asset/_preview/<name>.compare.png and judge against .claude/skills/pixel-art/rules/07-review-checklist.md
   and 92-generated-art-tells.md: readable silhouette at 1x, 1-px outline, ≤16 colours, no stray pixels or mush, no
   half-transparent pixels, orientation (icons: blade to the upper right; world sprites: pointing right, hand at
   GRIP 5,16), size/proportion next to the code-drawn twin in asset/_export/, fits the tier/motif it is named after.
3. Run `cd game && npm run art:export && npm run art:gallery`.
Do NOT run --install and do NOT edit game code. Write ai/reports/codex-asset-review-<date>.md with a table:
file | normalised to | verdict (INSTALL / FIX: what / CONCEPT ONLY → redraw in code with prompt A / REJECT: why) |
notes, plus draft asset/CREDITS.md lines for the INSTALL ones ("AI-generated", tool, prompt file, date) and the exact
--install command line for the owner. Commit the normalised files and the report on codex/<task> (stage by path).
```

---

### 장비·아이템 아이콘에도 쓰려면
첫 번째 참고 시트(장갑·장화·반지·목걸이·물약·가방·열쇠)처럼 쓰려면 프롬프트 B의 SUBJECT를 바꿔 16x16 셀로 받고
(`each item inside its own 16x16-pixel cell ... enlarged so every art pixel is an exact 16x16 block`), 이름을 아이템 id로
정리합니다: `--split --category gear/gloves --names g_1,g_2,g_3,g_4,g_5 --size 16x16 --fit` → 설치 키 `icon.item.g_1`.
아이템 id와 이름은 `game/src/logic/10-tables.js`의 `GEAR`·`ITEMS`에 있습니다 (예: 장갑 g_1 헝겊 장갑 … g_5 차원 손아귀).
