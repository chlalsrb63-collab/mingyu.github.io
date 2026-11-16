# 인계 — 여기서 시작 (2026-11-16 정리판)

새 세션은 **이 파일만 읽고** 시작하세요. 지난 기록 전부(§0~§0.12, 설계 결정 이력)는 `ai/HANDOFF-archive-2026-11-16.md` — 필요할 때 `grep -n`으로 해당 절만.
프로젝트 규칙: `AGENTS.md`. 파일 지도: `docs/FILEMAP.md`. 작업 보드: `ai/TASKS.md`. 이번 아이템 개편 명세: `docs/design/item-system-spec-2026-11-16.md`.

## 1. 지금 상태
- `main` 초록: **65/65 테스트**, `npm run data:check` 통과, 저장 시트 **v27**. **push 안 함**(push = 배포). 로컬 플레이 서버: 8830 포트, 고정 폴더 `../tt-play-current`(커밋 644a4d8), 설정 이름 `play-local`
  (LAN `http://192.168.31.58:8830`, 저장 `game/.wrangler/play`). 새 빌드 반영: `git -C ../tt-play-current checkout --detach <커밋>` 후 `play-local` 재시작. **오너의 서버이니 허락 없이 재시작 금지.**
- 이번 라운드에 들어간 것: 아이템 레벨(`il`, 착용 = il−10) · 마법2/희귀3/전설4줄 · 유니크(q5, 전설 효과 + 강한 줄) · 접두사 95종 중 52종 구현(`on`) · 아이템도감(Shift+I) · 창 별도 분리/붙이기 ·
  HUD 투명도 · 도움말 15주제 + `<Guide>` 87개 · 레이드던전 개명·6분 페이스 · 장날(화·토 19–21시 KST, 상인 6명) · P9~P12 외형 · 스마트폰 메뉴 UI(`phone.js`, 키 Backquote).
- 작업 폴더·브랜치는 정리됨(병합된 에이전트 브랜치 164개 삭제). 남은 오래된 에이전트 폴더 2개(`agent-a2033284…` 미커밋 수정, `agent-a72d64ca…` 미병합)는 내용을 모르므로 보존.

## 2. 일하는 방법 (오너 명령: 토큰 절약)
1. 이 파일 → 필요한 설계 문서 일부만(`grep -n "^#"`). 코드는 코드 그래프/`docs/FILEMAP.md`로 찾기.
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
- **Codex:** W5 추가 컨텐츠 기획(`codex/item-content-plan`, 문서 있음, 미병합) · W1 보조 옵션 3분류+공격형 쿼터 · **W2 인챈트 스크롤·지선(햄스터, 볼칸의 여동생)·인챈트 창·골드 비용·추출의 마법망치**(명세 §3.3–3.4) ·
  W3-A 공격형 접두사 구현(`52-prefix-*.js`) · W4 밸런스 패스. 또 `codex/rune-sockets`(세트 → 소켓 룬 세트)가 진행 중일 수 있음 — 병합 때 q4 세트·`v` 숫자(27)·`itemlevel/wardrobe` 테스트 충돌 주의.
- **Claude:** Codex 결과 병합·테스트, 아래 "알려진 문제" 정리.
- **오너 결정 대기:** Q3 후반 메인 처치 수 · Q4 파티 필요 서브퀘스트 · Q7 Lv.200 이후 목표(`docs/design/content-audit-2026-11-16.md` §3) · 추출 시 장비 파괴 vs 희귀 강등(기본 강등) · 인챈트·장날 가격 표 · 폰 단축키/위치.

## 5. 알려진 문제 (작은 것)
- 접두사 5종 `after relax chase panic slick`은 `on:0`(이동속도 증가가 클라이언트 걷기 속도에 안 실림: `public/update.js` 가 `self.spd`×자체 상수 사용 → 와이어 필드 필요).
- 새 접두사의 무기 외형(`weapons.js MOTIF`)은 처음 8종만 있음; 나머지는 기본 무기 모양. 장판 효과는 0.5초마다 화면 흔들림(기존 이벤트 재사용).
- 폰 UI는 데스크톱만(휴대폰/작은 화면은 옛 서랍). 폰이 열리면 미니맵 왼쪽·퀘스트 글자 일부를 가림. 레이드던전 실제 플레이 페이스는 봇 기준 추정.
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

