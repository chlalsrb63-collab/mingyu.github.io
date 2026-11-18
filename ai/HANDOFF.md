# 이전 통합 인계 (2026-11-16 정리판)

2026-11-18 로컬 빌드·폴더 정리·Claude/Gemini 경로는 [최신 개발 현황 인수인계](HANDOFF-DEV-STATUS.md)와 [현황판](../docs/development-status.html)을 먼저 확인하세요. 아래에는 이전 통합 세션의 이력을 유지합니다.

설계 결정 이력과 이전 기록(§0~§0.12)은 `ai/HANDOFF-archive-2026-11-16.md`에서 해당 절만 찾아 읽으세요.
프로젝트 규칙: `AGENTS.md`. 파일 지도: `docs/FILEMAP.md`. 작업 보드: `ai/TASKS.md`. 이번 아이템 개편 명세: `docs/design/item-system-spec-2026-11-16.md`.

## 1. 지금 상태
- **2026-11-18 정렬(태그 `play-2026-11-18`):** main에 Codex `codex/regional-monsters`(0f5048d까지: 버디 메신저·솔로 협동 파트너, 외형 다듬기, 64px 뒤꼬리, 성능, 개발 현황판 `docs/development-status.html`, 지역 변이 몬스터 동작) · Gemini `gemini/work`(무기 외형 60종 6팩 + 팔레트 의상 4세트 12종 — **시안 모듈만, 게임 미연결·아이콘 미설치, 오너 승인 대기**; 의상 권장 코드는 147–158이 main과 겹쳐 199–210으로 옮김) · 솔로 알바 라운드(`claude/alba-wip-1118`, 무대 장면 `alba_stage.js`, 스모크 12종 OK) 병합.
  **대체됨(병합 금지, main에 이미 이식):** 11-14~11-16 codex 브랜치(asset-review combat-effects combat-pressure coop-briefing elemental-combat held-weapon-scale local-play-polish map-bgm rift-beasts rune-sockets skill-effects-followup starter-weapons studio-opening weapon-sil world-map work). 남은 새 작업: `codex/regional-monsters` 5814877(한옥·절차형 레이드), `codex/monster-display-names`.
- `main` 초록: **84/84 테스트**, `npm run data:check` 통과, 저장 시트 **v29**. **push 안 함**(push = 배포). 로컬 플레이 서버: 8830 포트, 고정 폴더 `../tt-play-current`(커밋 644a4d8), 설정 이름 `play-local`
  (LAN `http://192.168.31.58:8830`, 저장 `game/.wrangler/play`). 새 빌드 반영: `git -C ../tt-play-current checkout --detach <커밋>` 후 `play-local` 재시작. **오너의 서버이니 허락 없이 재시작 금지.**
- 이번 라운드에 들어간 것: 아이템 레벨(`il`, 착용 = il−10) · 마법2/희귀3/전설4줄 · 유니크(q5, 전설 효과 + 강한 줄) · 접두사 95종 중 52종 구현(`on`) · 아이템도감(Shift+I) · 창 별도 분리/붙이기 ·
  HUD 투명도 · 도움말 15주제 + `<Guide>` 87개 · 레이드던전 개명·6분 페이스 · 장날(화·토 19–21시 KST, 상인 6명) · P9~P12 외형 · 스마트폰 메뉴 UI(`phone.js`, 키 Backquote).
- **2026-11-16 밤 통합 세션 3:** Codex 병합 3건(룬 소켓·세트 룬 / 8대 피해 속성·상태이상 / 오프닝·기본 무기 / 전직 전용기 연출·연계·이동 경계) + W5 기획 문서 + Gemini 외형 16종(전통 한복·직업 제복, 코드 183–198, 의상실 판매).
  Claude가 넣은 것: 초반 몬스터 12종 새 공격(쌍두 토끼 덮치기, 양 침, 숫양·쥐 왕 울음, 멧돼지 내려찍기, 사슴 돌진, 오소리 흙먼지, 뱀 독웅덩이, 해골 토끼 잠복, 박쥐 부채꼴, 추격수 숨결) · 정예는 모든 이동기를 더 자주(`TRICK_EL`) ·
  웅덩이/구름은 몬스터 속성을 따름(`POOL_OF`) · 도약이 보이고 울음에 소리 · 던전 3곳(crypt sewer abyss) 모닥불 주변 5칸 스폰 없음(`FIRE_QUIET`) · 접두사 이동속도 5종 활성(와이어 `pspd`) · 가방이 꽉 차도 보상 장비 보존 ·
  잡템 일괄 판매(`sell {junk: 0|1}`) · 스냅샷 예외 격리(`room.ts`) · 피해 숫자 70개·불티 1400개 상한 · 그래픽 끔에서 무기 광채 생략(`postfx.lowSpec`).
- **세션 3 후반(오너 컨펌분):** 넓은 맵 4곳 모닥불 +1(`FIRE_EXTRA`, 기존 불에서 가장 먼 지점) · 초원 Lv5–8/13–16 변형 2종(`twinhare_blood` `gutfrog_frost`, 도감 선택형) · 먹빛 호수 Lv185+(`serpentwing_ash` `wingcrane_frost`, band 40–47, DENSITY 15) ·
  새 지형 요소 `grove henge spring` + 넓은 구역 다중 배치(`featureMore`: dunesea mesa oasis coast inklake; 정글은 구역 테스트 때문에 제외) · **명칭 정리(오너): 사냥형 = "토벌"**(일일 토벌 = 사냥 목표만, 주간 토벌, 반복 토벌, 게시판 사냥 일감 태그 "토벌"), 생활형 = "아르바이트".
  남은 것: 알바 게시판의 사냥 일감 10종(`jb_hunt_*`)은 아직 게시판 안에 있음(토벌 창으로 옮길지 오너 결정) · 주간 수첩은 사냥·생활 혼합이라 이름 유지 · `skills`/`combos` 테스트는 고정 시드(31337)로 굴림.
- **일일 아르바이트 (2026-11-17, 오너 지시):** 알바는 이제 90초짜리 **미니게임**(2026-11-18 오너: 4분 → 90초, 설계 문서 §11)(기획 `docs/design/daily-alba-minigames-2026-11-16.md`). 엔진 `66-alba.js`(서버 세션 `p.ab`, 액션 `ab_start ab_act ab_leave ab_close`, 와이어 `ab`, 저장 `ch.ab` — 시트 버전 안 올림) + 창 `public/alba.js`(위 연출 · 아래 게임판) + 게임마다 `67-alba-<k>.js`/`alba_<k>.js`/`tests/alba-<k>.mjs`.
- **정리·최적화 점검 (2026-11-17):** 오너 지시 — **로컬 빌드만 개발, 멀티플레이(온라인) 빌드는 갱신하지 않음**(나중에 오너가 로컬 버전을 올림; `AGENTS.md` §2). 폴더 정리: `.claude/worktrees` 418MB→0(고아 작업 폴더 + 연결 폴더, 병합된 로컬 브랜치 38개 삭제), `game/.wrangler`의 옛 시험 상태·로그, `game/shots*` 스크린샷, 루트 로그 삭제. 측정(`scripts/bench-tick.mjs`, `scripts/client-prof.mjs`): 서버 43명 부하에서 틱 평균 1.0ms · 스냅샷 1.2KB, 클라이언트는 1280×720에서 60fps(마을/숲 CPU 약 10%), 스킬 이펙트 초당 40개를 퍼부어도 평균 17ms, 메모리 안정(48초 동안 증가 없음). 눈에 띄는 병목은 없어 코드는 건드리지 않음. 알려진 것: 브라우저가 소켓을 열어 둔 채 닫히면 **wrangler dev(Node 26)가 오류 없이 종료**되는 경우가 있음 — 테스트 스크립트는 `__game.disconnect()` 후 닫을 것.
- **일일 아르바이트 개선 라운드 (2026-11-17):** 목록 창이 열리지 않던 버그(`listKey` 인자) · 그만두기 확인창이 알바 창 뒤에 가려지던 버그 · 접속 끊김 시 판이 얼어붙던 것을 고치고, 오늘의 특근(2종 ×1.25) · 결과 카드(받은 골드·신기록·한 번 더) · 목록 도장 · 업적 4개 · 협동 알바 목록 복원을 더함. 실제 클라이언트 스모크: `scripts/alba-smoke.js`(머리말대로 `shot.mjs --live --eval`). 설계 기록 `docs/design/daily-alba-minigames-2026-11-16.md` §10.
  1차: pipe fly store parcel laundry taiyaki · 2차: pest(갤러그) wall(알카노이드) cross lamp rhythm garland. 등급 C 0.30 · B 0.65 · A 0.85 · S 1.0 × par, 종류별 하루 1회 보수, 하루 4회 상한. **옛 알바 일감(bring make fish deliver scout chore)은 `JB_RETIRED`로 신규 수락 불가**, 협동 배관은 철거(협동 5종 유지).
  **par는 봇(사람 같은 봇 ≈ B)에 맞춘 초안** — 실제 플레이 뒤 조정(붕어빵은 촘촘해서 일반 플레이어가 C일 가능성). 새 게임 추가법: 엔진 헤더 주석(`66-alba.js`)과 `alba.js` 헤더의 계약, `ALBA_ORDER`와 `LOADERS`에 키 추가.
- 작업 폴더·브랜치는 정리됨(병합된 에이전트 브랜치 164개 삭제). 남은 오래된 에이전트 폴더 2개(`agent-a2033284…` 미커밋 수정, `agent-a72d64ca…` 미병합)는 내용을 모르므로 보존.

## 2. 일하는 방법 (오너 명령: 토큰 절약)
1. 이 파일 → 필요한 설계 문서 일부만(`grep -n "^#"`). **코드는 코드 그래프(`codebase-memory` MCP)로 먼저 찾기 — 오너가 쓰길 원함.** 프로젝트 이름 `C-Users-mankyu-Desktop-Tales-Tales`(색인 최신·자동 감시): `search_graph`(함수·상수 찾기) → `trace_path`(누가 부르나) → `get_code_snippet`(그 함수만 읽기) → `get_file_outline`(큰 파일 구조); 문자열·설정·JSON은 grep. 생성물 `src/logic.js`는 검색 대상 아님. 파일 지도는 `docs/FILEMAP.md`.
   **에이전트 브리프에도 한 줄 넣기:** "코드는 codebase-memory(프로젝트 C-Users-mankyu-Desktop-Tales-Tales)로 먼저 찾고, 그 파일의 해당 부분만 읽어라(워크트리의 새 파일은 grep)".
2. 에이전트: 한 번에 **1~2개, `model: "sonnet"`**, 짧은 브리프(목표·파일·"끝" 기준·보고 ≤ 15줄). 같은 파일을 건드리는 일은 순서대로.
3. 병합 → `npm run build:logic` → `node scripts/test-all.mjs`(**병합마다 1번**, `maps`는 부하에서 흔들리면 단독 재실행) → `npm run data:check`.
4. 스크린샷은 요청받은 것만, `node scripts/shot.mjs`(워크트리에서도 동작, 메인의 playwright 자동 사용).
5. 병합된 에이전트 폴더/브랜치는 그때그때 삭제. 대화가 길어지면(~250k) 이 파일을 갱신하고 새 세션으로.
6. 커밋 꼬리: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; `git -c user.name=Claude -c user.email=noreply@anthropic.com commit`. 캐시 태그 `?v=`는 손대지 않음.

## 3. 오너 정책 (바꾸지 말 것)
- 레벨 200까지 약 45시간, 6단계 장비는 Lv.181, 사냥 골드 ×0.4(알바가 주 수입), 칼날 소용돌이 3마리, **도적은 광역 없이 단일 대상 강함이 의도**, 직업 추가는 오너만.
- 협동 알바: 2~4인 파티 필수, 파티장 시작, 보상은 하루 1회(재도전 가능, 매일 06시 초기화). 균열 = 3단 레이드(≈10분), 이제 이름은 **레이드던전**(게이지 약 6분 + 보스 3분 이내).
- 이름 접두어는 **고유 효과가 있는 장비(전설·유니크, 세트)만**. 마법/희귀는 접두어 없음. 유니크 = 전설 효과 + 줄이 약 +12 % 강함.
- UI: 큰 창은 별도 창으로, 작은 정보창만 패널/폰 안에. 미니맵은 불투명. 외부·AI 이미지는 `asset/` 파이프라인으로만(코드로 그린 도트가 기본).
- 열린 설정 질문은 건드리지 않음: 오래된 주문을 깨운 존재, 도톨/갈피 이동 여부, 일곱 별 표식, 리나가 갈대의 딸인지.

## 4. 진행 중 · 다음 (Codex는 `ai/TASKS.md` CODEX 섹션 — 프롬프트는 오너가 갖고 있음)
- **Codex:** (W5 문서·룬 소켓·속성·전직 전용기는 병합 완료) · W1 보조 옵션 3분류+공격형 쿼터 · **W2 인챈트 스크롤·지선(햄스터, 볼칸의 여동생)·인챈트 창·골드 비용·추출의 마법망치**(명세 §3.3–3.4) ·
  W3-A 공격형 접두사 구현(`52-prefix-*.js`) · W4 밸런스 패스.
- **Claude:** Codex 결과 병합·테스트, 아래 "알려진 문제" 정리.
- **오너에게 제안해 둔 것(컨펌 대기, 2026-11-16 세션 3):** ① 직업 밸런스(T40 단일 ×평균: 도적 1.58 의도 · 마법사 1.16 + 광역 4582로 1위 → 광역 소폭 하향 / 마검사 0.87·용기사 0.91·마창사 0.90·창술사 0.96 → +6~8 % / 추적자 광역 1.32 최저; 측정 `node scripts/skill-probe.mjs 25 40`)
  ② 초원 Lv5–8·Lv13–16 빈 구간에 색변형 몬스터 2종 ③ 먹빛 호수 밀도 +25 %와 Lv189까지 연장 ④ 모래바다·네온 시티·단풍 왕도·먹빛 호수에 모닥불 +1 ⑤ 문 레벨 제한(숲 → 수정 동굴·단풍 왕도 직행) ⑥ 필드 보스 5종(wickregent knotwidow knellkeeper loomcolossus sluiceleviathan)에 레이드 스크립트 재사용
  ⑦ 성능: 몹 스냅샷 델타(`M`이 바이트의 69 %), 정예·보스 광채 스프라이트 캐시, 저사양에서 `sky.grade` 단순화, 오한 때 `self` 8KB 재전송 제거.
- **오너 결정 대기:** Q3 후반 메인 처치 수 · Q4 파티 필요 서브퀘스트 · Q7 Lv.200 이후 목표(`docs/design/content-audit-2026-11-16.md` §3) · 추출 시 장비 파괴 vs 희귀 강등(기본 강등) · 인챈트·장날 가격 표 · 폰 단축키/위치.

## 5. 알려진 문제 (작은 것)
- 새 접두사의 무기 외형(`weapons.js MOTIF`)은 처음 8종만 있음; 나머지는 기본 무기 모양. 장판 효과는 0.5초마다 화면 흔들림(기존 이벤트 재사용).
- 폰 UI는 데스크톱만(휴대폰/작은 화면은 옛 서랍). 폰이 열리면 미니맵 왼쪽·퀘스트 글자 일부를 가림. 레이드던전 실제 플레이 페이스는 봇 기준 추정.
- 번개 경직(130 ms) 중 보낸 이동이 `p.fix`로 되돌려져 러버밴딩 가능(`75-apply.js` mv) · 스킬 창 설명이 한 줄로 잘림 · 폰 메뉴가 첫걸음 카드를 가림 · `maps` 테스트의 빌드 시간 단언은 부하에서 실패(단독 재실행).
- QA에서 남은 것: 자동 사냥이 정예를 따로 안 노림 · 추적이 웨이포인트 안 씀 · NPC 평소 대사가 퀘스트 후에도 같음 · 잉크 호수 몬스터가 Lv.196을 두 번 죽임(밸런스).

## 6. 명령
`cd game` → `npm run build:logic` · `node scripts/test-all.mjs [이름…]` · `npm run data:check` · `npm run check:split` · `node scripts/shot.mjs --page tip|wardrobe|mobs … | --live --url http://localhost:<포트>` ·
워크트리 서버: 메인의 `node_modules/wrangler/bin/wrangler.js dev -c wrangler.local.jsonc --port <8841~8860> --persist-to .wrangler/<이름>` (**8830 금지**).


(아래는 접두사 효과를 추가하는 방법 — 에이전트·Codex가 그대로 따르는 레시피)

## 0.11 Prefix powers — extension recipe (P1a infrastructure, 2026-11-16)
Design: `docs/design/prefix-effects.md` (95 powers). Built: the registry, the hooks, the caps, the roll by slot pool, no-stack + `self.lgOff` + the grey tooltip line, the
8 old powers moved onto `PFX_FN` with identical results (differential run of 24 bots × 8 powers over 2500 ticks: same hashes). **How to add powers (do NOT edit 10-tables / 51-prefix / any shared file):**
- One NEW part per group, name `NN-prefix-<group>.js` with NN ≥ 52 (`52-prefix-blow.js`, `53-prefix-guard.js` …; the build loads parts by name, after 51). Per power, three load-time lines:
  `Object.assign(PFX, { frost: { p: 0.15, ms: 1200, elite: 0.5 } });` (numbers only here; add `on: 1` when code + test are done, until then it never drops),
  `Object.assign(LEGEND, { frost: ["빙결의", pfxText("frost", "공격 시 {p:%}% 확률로 적을 {ms:s}초 얼린다"), "WG", "O", "M", "blow"] });` (`{k}` raw · `{k:%}` ×100 · `{k:+%}` (×−1)×100 · `{k:-%}` (1−×)×100 · `{k:s}` ms→s; slots W R G A B N H; cat O/D/U; rating S/M/L; fam as in the design §3),
  `Object.assign(PFX_FN, { frost: { blow(S, rt, p, st, mob, x, y, fin, skip) { … } } });`.
- Hooks (all signatures in the header of `51-prefix.js`): `pre mul hit crit kill blow skill miti hurt lethal dash evade tick status pot loot stat sheet num`. Damage a power deals: `hurtMob(S, rt, mob, p, mult, false, PX)`
  (a `px` blow runs no `blow/hit/crit` hook; `pre/mul` and `kill` still run). Chances `pfxChance(S, st, base)`; ICD `pfxIcd(S, p, key, ms)`; counters `pfxStack`; heals `pfxHeal` (≤ 8 % mhp/s);
  state `pfxPc(p)` (`cd` survives map change and death, `n t v heal` do not). Caps are enforced by the dispatchers (dmg ×1.6, speed ×0.8 / 45 %, miti ×0.6, absorb 20 %, xp +15, gold +100, 1 stone).
- Test: `tests/prefix.mjs` already walks every `LEGEND` row (shape, slots vs cat, Korean tooltip with a number, PFX numbers, PFX_FN hooks, `defs.legend`) and, once all 95 exist, the pool sizes. Add your own per-power
  tests in the same file's style (or a new `tests/prefix-<group>.mjs` + `tests/LIST`): fire with `rnd` forced via `S.seed`, numbers from `PFX`, ICD, `px` no-chain, bosses immune where stated. Wear a power on any piece: `W.wear(slot, id, "key", il)` pattern in `prefix.mjs`.
- Phase 2 needs no new hook: ZN = `rt.zones.push({ …, px: 1 })` (the zone loop honours `px`); ABS = a shield kept in `pfxPc(p).v` and offered through `miti`'s `r.abs` (the dispatcher caps it at 20 % mhp; reduce your shield by what you offered);
  AURA = the `tick` hook walking `members(S, p)`; DOT2 = a `mob.pd` your `hit` hook sets and your own `tick` hook (1 s) pays out with `hurtMob(…, PX)` (the dagger's `mob.dot` is untouched).
Known: a basic arrow now calls `blow` (so 뇌명의 works on a bow; before it silently did not); `deathLoss(ch, p)`, `skMp`, `dashCd(p)`, recall, pet interval, campfire rest read `pfxNum`.
**P1a merged 4d02d68 (2026-11-16).** Codex: W1/W2/W3-A may start. Effect part files: Codex offense = `52-prefix-*.js`, Claude defense = `53-prefix-guard.js`,
helm utility + phase-2 hooks = `54-prefix-util.js`; extension recipe, hook signatures and helpers are in §0.11 above. Suite 62/62.
**W3-B merged (2026-11-16, suite 64/64):** `53-prefix-guard.js` (33 defense; 28 `on`, **5 held back `on:0`: after relax chase panic slick** — their move-speed half only changes
`stats(p).spd`; the client walks at `self.spd` (= `spd0`) × its own buff constants (`public/update.js:203`), so a timed/conditional prefix speed needs a wire field first) +
`54-prefix-util.js` (8 helm + 8 phase-2, all `on`). Shared edits: `80-simulation.js mobHit` sets `p.hitHow`; `51-prefix.js pfxMiti` reads `p.pc.aura`.
Known: 추적(trace) +25 % xp is cut to +15 % by the prefix xp cap (tooltip overpromises); 후광(halo) works solo; zone events shake the screen every 0.5 s; new weapons' `lg` have no weapon look
(only the first 8 powers do, `tests/wardrobe.mjs LOOKS`). Codex W3-A/W2 will touch `itemlevel.mjs`/`wardrobe.mjs` the same way — keep the permissive wardrobe check.
**W2 ownership (owner 2026-11-16):** the enchant system (scrolls + icons, 지선, window, fee, 추출의 마법망치) is **Codex's** task (a short Claude agent was started and stopped; nothing was built). Spec §3.3/§3.4.
**장날 market merged (2026-11-16, suite 65/65, sheet v27):** `FAIR` = Tue+Sat 19:00–21:00 KST (`63-festival.js`), merchants `fm_leg fm_scr fm_rune fm_cos fm_food fm_dye` (`64-fair-market.js`, `public/fairmkt.js`),
once per player per product per day (`ch.fairBuy`), prices in `FAIR_PRICE` (legendary 15k×(il/30)^1.35, scroll 40k, costume 60k …). 몽실 (scroll vendor) fills itself once `es_*` items exist (Codex W2).
**Sheet `v` is now 27:** Codex's branches that bump `v` must rebase and re-pin the ~16 tests that assert it. Help/Guide read days from `defs.fair.days`.

