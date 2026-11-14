# 주아나의 참 공방 — Charm system (owner's spec, frozen contract)

Status: **spec from the owner (2026-11-15), verbatim below**. Implementation is split: **C1 rules** (server, sheet,
drops, stats, tests) then **C2 client** (bag 참 tab, appraisal window, board UI, icons, Juana's art, sounds).
Each phase appends a "C<n> as built" section (deviations only). Where this spec and the code disagree on names
(e.g. a skill id), map to the real code and record it in "as built" — never invent ids that the data lacks.

---

# Claude 구현 프롬프트 · 주아나의 참 공방

테일즈테일즈에 장비와 독립된 **참(Charm)** 시스템을 구현하라. 필드 사냥과 차원 균열에서 미감정 참을 얻고, 버드나무광장의 햄스터 감정사 주아나에게 감정받은 뒤 전용 보드에 배치한다. 플레이어가 빈칸의 형태와 자기 직업의 콤보를 함께 고려하도록 설계한다.

`AGENTS.md`, `ai/HANDOFF.md` §1, `docs/FILEMAP.md`를 읽고 최신 로컬 `main`에서 작업하라. 다른 작업자의 변경은 보존하라. 구현과 검증은 로컬에서 진행한다.

## 1. 주아나와 해금 퀘스트

- **주아나** (`town_charm_juana`)는 버드나무광장의 참감정사다. 기존 햄스터 종족에 통통한 볼주머니, 둥근 귀, 꿀빛 털과 자주색 앞치마를 쓴다. 작은 황동 돋보기로 참을 살피는 16×16 코드 픽셀 아트를 적용한다. 광장 수련관 부근의 접근 가능한 빈 타일에 감정대를 둔다. NPC 일과 기능이 병합되어 있다면 근무와 식사 일과를 등록하고 그 시스템의 서비스 접근 규칙을 사용한다.
- 표시 캐릭터 레벨 **Lv.30**부터 주아나에게 일회성 의뢰 **〈빛나는 조각의 자리〉**를 받는다. 서버가 권장 티어대의 필드 몬스터 8마리 처치를 기록하고, 주아나에게 보고하면 **3×3 보드**, **미감정 참 1개**, **첫 감정 비용 면제 1회**를 함께 지급한다. 지급 공간이 부족하면 보고 가능 상태를 유지한다.
- 전직 여부와 무기 숙련도는 의뢰 수주 조건에 포함하지 않는다. 해금은 캐릭터 단위 영구 기록이며, 스탯 초기화 후에도 유지된다.
- 수주 대사 “볼주머니에 넣기엔 제법 무거운 조각이네요. 빛을 품을 자리를 같이 찾아봐요.”
- 감정 대사 “여기, 테두리에 무늬가 보여요. 돌려 보면 작은 빈자리에도 맞겠어요.”

## 2. 획득과 감정

| 획득처 | 미감정 참 확률 | 매직 / 레어 / 전설 | 확장 재료 확률 |
| --- | ---: | ---: | ---: |
| 권장 티어 필드 일반 몬스터 | 0.60% | 85% / 14.8% / 0.2% | 0.05% |
| 권장 티어 필드 정예 | 2.40% | 79% / 20.65% / 0.35% | 0.20% |
| 필드 보스·수호자 | 12% | 67% / 32.5% / 0.5% | 1% |
| 차원 균열 클리어 개인 상자 | 40% | 60% / 39% / 1% | 8% |

- 수치는 첫 검증에 쓸 초안이다. 등급 확률은 참이 떨어졌을 때의 조건부 확률이다. 예를 들어 일반 사냥 전설 참은 처치당 **0.0012%**, 균열 보상 상자는 개인 개봉당 **0.4%**다. 행운·장비 매찬·연쇄 효과는 이 첫 버전의 참 확률에 연결하지 않는다. 필드는 기존 처치 기여 판정을 쓰고 플레이어보다 4티어 넘게 낮은 대상과 인스턴스 잡몹은 제외한다. 균열은 침공 이벤트와 분리된 기존 개인 클리어 상자 `64-dim.js dimChest`를 사용한다.
- 일반 가방에서 참 하나가 한 슬롯을 차지한다. 미감정일 때는 아이콘과 획득처만 보여 주고 등급, 크기, 효과를 가린다. 희귀성을 UI나 네트워크 필드에서 미리 노출하지 않는다. 가방이 가득 찬 균열 보상은 서버의 캐릭터별 보류함에 최대 한 건 보존하고 주아나에게서 수령한다. 보류함이 차 있으면 새 상자에서 참만 별도로 예약하는 대신 **개봉을 보류**하고 가방 정리를 안내한다. 아직 보상을 받지 않은 상자는 개인 수령 완료로 처리하지 않는다.
- 주아나 옆에서 감정하면 서버가 참의 등급, 형태, 옵션을 확정한다. 캐릭터별 고유 ID와 보이지 않는 봉인값을 저장한다. 봉인값과 규칙 버전을 이용해 같은 참의 결과가 재시도·재접속으로 바뀌지 않도록 한다. 첫 감정은 무료이며 이후 비용은 획득 티어 기준 `round(200 + 12 × sourceTier)` G다. 감정 등급에 따라 비용을 바꾸지 않는다.
- 매직에는 1개 옵션, 레어에는 서로 다른 일반 옵션 2개, 전설에는 고유 효과 1개와 일반 옵션 1개를 부여한다. 최초 퀘스트 참은 매직 1×1로 고정한다. 일반 장비의 판매·분해·룬·강화·퀵슬롯 경로와 분리하고 첫 버전에는 자동 정리와 파괴 확인을 제공한다. 캐릭터간 거래·창고 이동은 후속 범위로 둔다.

## 3. 모양, 배치, 확장

아래 수치는 **가로×세로**다. 한 변은 최대 3칸이며 실제 점유 면적은 1~4칸이다.

| 형태 ID | 점유 좌표 (기본 방향) | 크기 | 일반 옵션 계수 |
| --- | --- | --- | ---: |
| `pin` | (0,0) | 1×1 | 1.00 |
| `bar2` | (0,0), (1,0) | 2×1 또는 1×2 | 1.70 |
| `bar3` | (0,0), (1,0), (2,0) | 3×1 또는 1×3 | 2.30 |
| `elbow` | (0,0), (0,1), (1,1) | ㄴ자 3칸 | 2.30 |
| `tile2` | (0,0), (1,0), (0,1), (1,1) | 2×2 | 2.90 |

- 좌표를 90°씩 회전하며 원점 기준으로 정규화한다. ㄴ자의 빈 모서리에는 다른 참을 놓을 수 있다. 보드 밖, 잠긴 칸, 이미 쓰는 칸에 겹치면 거부한다. 자기 참의 옮기기·회전은 기존 자리만 점유 검사에서 제외한다.
- 보드에는 감정 완료 참만 놓이며, 놓여 있는 참만 효과를 낸다. 드래그 중에는 후보 위치와 유효 여부를 보여 준다. 좌표를 클릭하고 회전 버튼을 눌러도 된다. 서버가 이동을 거절하면 원래 자리로 돌아간다. 보드에서 가방으로 꺼낼 공간이 없으면 참은 현재 자리에 남는다. 장착 수치가 변할 때 서버가 한 번 갱신하고 현재 HP·MP는 새 최대치에 맞춰 상한 처리한다.
- 최대 5×5 보드의 내부 (1,1)~(3,3)부터 연다. **참틀 확장못** 1개와 골드로 순서대로 한 칸씩 열며 총 16번이다. 좌표 순서 `[4,1] [4,2] [4,3] [1,4] [2,4] [3,4] [4,4] [0,1] [0,2] [0,3] [0,4] [1,0] [2,0] [3,0] [4,0] [0,0]`. 다음 칸과 가격을 미리 보여 준다.
- 다음 확장 가격 `2,000 + 800 × k + 100 × k²` G. `k`는 이미 확장한 칸 수(0~15)다. 첫 2,000G, 마지막 36,500G, 총 252,000G다. Lv.50과 Lv.90의 주아나 후속 의뢰가 확장못을 각각 1개 보장한다. 재료와 골드는 확장을 성공시킨 트랜잭션에서 함께 차감한다.

## 4. 능력치와 전설 효과

- 일반 옵션은 참 1×1 기준으로 유효 능력치 +1~2, HP +8~14, MP +4~7, 공격력 +1~2, 특정 기존 액티브 피해 +2~3%, 특정 힐 스킬 회복량 +2~3%에서 시작한다. 확장 형태 계수를 곱하고 정수 옵션은 내림한다. 능력치 옵션은 전투 계산에만 쓰고 캐릭터 레벨·스탯 투자량·전직·스탯 초기화 비용에는 들어가지 않는다.
- 1차 상한은 보드 전체 합으로 능력치 각 +8, 장비 계산 후 공격력 +30, HP +120, MP +60, 특정 스킬 피해·회복량 각각 +12%다. 전설 고유 효과는 보드에 최대 1개만 활성화한다. 첫 버전에는 스킬 습득, 스탯 조건 우회, 공격속도, 재사용 대기시간 초기화, 추가 발동 연쇄를 열지 않는다.
- 아래 세 가지는 판정과 트리거의 예시다. 현재 데이터에 없는 힐 스킬 ID를 가정하지 말고, 해당 기능이 구현되어 있을 때만 연결한다.

| 전설 참 | 형태 | 효과와 제한 |
| --- | --- | --- |
| 메아리 뿔참 | 1×3 막대 | 대검 `대지 가르기` 파동의 끝 30%에서 첫 피격 대상에게 그 적중 피해의 18%를 추가로 준다. 한 시전당 1회, 12초 내부 재사용 대기시간. |
| 수호의 매듭참 | ㄴ자 | 창이나 마도서의 실제 파티 회복 스킬이 HP 50% 미만 아군을 회복하면 해당 아군에게 최대 HP 4%의 보호막을 4초 부여한다. 참 착용자당 18초, 보호막 중첩 없음. 회복 API가 아직 없다면 이 참의 드롭을 뒤로 미룬다. |
| 길별의 렌즈참 | 2×2 정사각형 | 활 `관통 화살`이 2번째 표적을 실제로 적중시키면 그 표적에 4초간 표식을 남긴다. 자신의 다음 기본 공격 1회에 피해 +15%, 14초 내부 재사용 대기시간. |

스킬 허용과 소유 무기·직업·숙련도 검사는 기존 규칙을 사용한다. 조건 불충족 시 UI에 비활성 사유를 표시한다. 추가 피해에는 추가 참 발동을 금지하며 기존 크리티컬·흡혈·처치·스킬 숙련 중복 지급이 생기지 않게 한다. 무기 스왑이나 참 재배치로 전투 중 발동 대기시간을 초기화할 수 없게 하고, 보드 변경은 마을에서만 허용한다.

## 5. 서버·클라이언트 구현 순서

1. **규칙과 이관.** `src/logic/`에 참 정의와 규칙을 추가한다. 저장 예시 `ch.charms = { unlocked: false, openN: 0, intro: 0, freeId: 0, nextUid: 1, placed: [], pending: null }`. 일반 가방의 참 인스턴스는 `{ id:"charm", uid, seal, sourceTier, revealed, ... }` 형태로 관리한다. 가방과 보드 사이 이동 시 같은 고유 ID를 보존한다. 기본값과 버전 이관을 작성하고 기존 캐릭터와 손상된 좌표·중복 ID를 처리한다. 복구된 참은 가방과 별도 복구 대기열로 보존하며 자동 장착하지 않는다.
2. **서버 동작.** `validateAction`와 `applyAction`에 `charm_quest`, `charm_id`, `charm_place`, `charm_move`, `charm_remove`, `charm_expand`, `charm_claim`을 추가한다. 이동 요청은 참 ID·앵커·회전만 받는다. 가격과 효과, 점유 칸, NPC 거리, 퀘스트 충족, 최신 인벤토리 상태는 서버에서 검증한다. 전체 검증을 마친 후 적용하며, 처리 완료된 요청의 반복은 중복 감정·지급·차감을 일으키지 않는다. 변동 즉시 저장 예약을 하고 기존 채널 세션 소유권을 따른다.
3. **획득과 능력치.** 필드 개인 루팅과 `dimChest`의 보상에 연결한다. `deriveStats`에 보드 집계 결과를 합치고 기존 캐시를 무효화한다. 스킬 특수 효과는 서버의 해당 적중·회복 지점에서만 실행한다. 참 정의는 `defs()`, 캐릭터 자신의 변경만 `self`로 보내고 미감정 참의 봉인값은 가린다.
4. **화면과 아트.** 가방의 **참** 탭, 감정 확인창, 효과 합계와 잠금 사유, 회전·제거·확장 UI를 연결한다. 투박한 봉인 조각, 매직의 청동 띠, 레어의 은장, 전설의 독자 문양을 16×16 코드 아이콘으로 그린다. 보드의 모양은 서버 정의를 그대로 사용한다. 색 외에 문양과 텍스트로 등급을 표시한다. 배치·감정에 짧은 Web Audio 효과음을 넣는다.
5. **검증.** `npm run build:logic`, `npm run data:check`, `npm run typecheck`, `npm run test:rules`, `npm run check:split`을 통과시킨다. 두 클라이언트 로그인과 재접속으로 중복 요청, 가방 만석 보류·수령, 배치와 능력치 복원, Lv.29 차단 / Lv.30 수주 / 1회 보상을 확인한다. 전설 발동은 고정 시드로 시험하고 실시간 판정에 난수를 주입하는 공개 경로를 만들지 않는다. 모양별 회전·겹침·잠금·네트워크 재전송, 16회 확장, 스탯 초기화 후 해금 보존, 예전 저장의 마이그레이션을 테스트한다. UI는 감정창과 보드가 보이는 로컬 화면으로 확인한다.

`game/src/logic.js`는 생성 스크립트로 갱신한다. 캐시 태그는 `npm run stamp`를 사용한다. 단계별 파일, 수치 측정 결과, 재현 절차를 구현 보고서에 남기고 경로별로 스테이징해 로컬 Codex/Claude 작업 규칙에 맞춰 인계한다.

---

# C1 as built — contract for C2 (server rules, 2026-11-15)

Code: `game/src/logic/66-charms.js` (everything) + one- or two-line hooks in `10-tables` (items), `36-custom-maps`
(role), `40-characters-world` (`newChar`, `migrate`), `45-jobs` (`deriveStats`, `shotTick`), `46-bag` (sort),
`50-loot-combat` (`fits`, `pickUp`, `killMob`, `basicAttack`), `57-weapon-skills` (`castSkill`), `64-dim`
(`dimChest`), `70-validate`, `75-apply`, `90-views-api`. Tests: `game/tests/charms.mjs` (`-v` prints the measured rates).
Sheet version **13**. 주아나 is `data/npcs.json` `town_charm_juana`, role `charm`, town tile (66, 23) — two tiles
west of 카이; her look is a full hero look `[7,0,11,11,0,0,4,6,2,0,0]` (hamster, honey fur `#e0b46c`, purple cloth).

## Items
`charm` (type `charm`, one per bag slot, never stacked/sold/stored/quick-slotted) and `charm_nail` 참틀 확장못
(type `mat`, stacks, cannot be sold). Both have price 0.

## Actions (all refuse while dead; every error is a Korean string in `error`)
| action | body | where | notes |
| --- | --- | --- | --- |
| `charm_quest` | `{ a: "accept" \| "done" }` | next to 주아나 | acts on the quest in `self.charms.quest`; `done` with no room keeps it reportable (`가방을 비우고 다시 오세요`) |
| `charm_id` | `{ uid }` | next to 주아나 | sealed charm in the bag; free while `self.charms.free`, else `cost` on the charm's wire; a second request is refused (`이미 감정한 참입니다`) |
| `charm_place` | `{ uid, x, y, r }` | any safe (town) map | bag → board; anchor = top-left of the turned shape, `r` 0–3 |
| `charm_move` | `{ uid, x, y, r }` | safe map | on the board; its own cells do not block it; same place → `이미 그 자리에 있습니다` |
| `charm_remove` | `{ uid }` | safe map | board → bag; bag full → refused, stays |
| `charm_expand` | `{ k }` | next to 주아나 | `k` must equal `self.charms.next.k` (a resend buys nothing); takes 1 nail + `next.cost` G together |
| `charm_claim` | `{}` | next to 주아나 | pending box first, then the recovery queue, as far as the bag has room |
| `charm_destroy` | `{ uid, ok: 1 }` | anywhere | **added** (the spec's 파괴 확인): a bag charm, sealed or not; without `ok: 1` → `참을 부수려면 확인이 필요합니다` |

Refusals worth showing: `주아나가 너무 멉니다` · `참 보드는 마을에서만 바꿀 수 있습니다` · `보드 밖입니다` · `잠긴 칸입니다` ·
`다른 참이 놓인 칸입니다` · `잘못된 자리입니다` · `감정하지 않은 참은 놓을 수 없습니다` · `아직 참 보드가 없습니다` ·
`Lv.30부터 받을 수 있는 의뢰입니다` · `참틀 확장못이 없습니다` · `골드가 부족합니다 (2,000G 필요)` · `이미 확장한 칸입니다` ·
`참은 팔 수 없습니다` / `참은 맡길 수 없습니다` (shop, warehouse, house chest).

## Wire
- **Bag** `self.inv[i]` — sealed: `{ id:"charm", n:1, uid, src, tier, rev:0, cost }`; appraised:
  `{ id:"charm", n:1, uid, src, tier, rev:1, g, sh, op, lg? }`. `src` indexes `defs.charms.src` (0 필드 사냥, 1 필드 정예,
  2 우두머리·수문장, 3 차원 균열 상자, 4 주아나의 의뢰); `g` 1 매직 / 2 레어 / 3 전설; `sh` a shape id; `op` =
  `[[kind, value, arg]]` with kind `st` (arg = stat key) `hp` `mp` `atk` `skd` (arg = skill id, %) `skh` (arg = skill id, %).
  The seal, the rule version and anything about a sealed charm's grade/shape/options never leave the server.
- **Ground drop** `D` row `[id, "charm", x, y, 0]` (and `"charm_nail"`): rarity slot always 0. Pickup → `gain ["item","charm",1,0]`.
- **`self.charms`** `{ un, openN, open:[[x,y]…], next:{k, cell:[x,y], cost, nail}|null, free, placed:[{c, x, y, r}],
  pending: charm|null, rec:[charm…], quest:{i, st, n, need, lv, ok}|null, sum:{st:[6], hp, mp, atk, skd:{id:%}, skh:{id:%}},
  lg, lgWhy, lgN }` — `sum` is the capped total actually applied; `lg` the one power at work (first placed), `lgWhy` the
  inactive reason (the skill's own `skWhy` text, e.g. `[활]을 들어야 쓸 수 있습니다`), `lgN` how many legendaries lie on the board.
- **`defs().charms`** `{ v, size:5, lv:30, low:4, shapes:{id:{cells, k, rot:[4 turned cell lists]}}, grades, src, opts:{kind:{name, lo, hi,
  pct, cap}}, skd:[skill ids], skh:[skill ids], legend:{id:{name, shape, sk, cd, off, desc}}, expand:[16 cells], expandCost:[16],
  nail:"charm_nail", idCost:[200, 12], quests:[{id, lv, n, title, text, reward}], say:{accept, appraise}, npc, role }`.
  Draw shapes from `shapes[id].rot[r]` — the server uses the same lists.
- **Map events** `["cm", eid, kind, x, y, mobId?]`: 0 메아리 extra hit, 1 렌즈 mark placed on `mobId`, 2 mark spent.
  Everything else is a toast (주아나's two lines are sent as toasts `주아나: “…”`) plus the existing `["u", eid, 2]` sparkle on a quest reward.
  A legendary appraisal is announced with `sys`.

## Readings of the spec
- **표시 캐릭터 레벨** = `ch.lvl` (1–200, what the HUD prints). Checked only when a quest is taken, so a later stat
  reset (level back to 1) changes nothing; `unlocked` is never cleared.
- **권장 티어 / 4티어** — monsters carry a world tier `MOBS[k].lv` (1–50; shown as `4·tier − 3`), a hero's tier is
  `toTier(lvl) = (lvl + 3) / 4`. A kill counts (quest and drops) when `MOBS[k].lv ≥ toTier(lvl) − 4`, on a registry
  map (`MAP_META`), and the monster is not a rift's (`mob.dim`), an invasion's (`mob.evt`), a chest or a rooted thing.
  `sourceTier` = the monster's tier (field) or the rift's level (`dim.lv`); the quest charm takes the hero's own tier.
- Rows of the table: elite = `el 1`; 필드 보스·수호자 = `el 2` or a dungeon boss (`MOBS[k].boss`).
- Charms and nails only drop **once the board is unlocked** (before that the quest charm is the first one).
- Field charms are ground drops owned by the looter (free for all after 20 s like other loot); the uid is given on
  pickup. A rift chest's charm goes straight into the bag, else into the one-slot box (`pending`). The chest **stays
  shut** (not marked received, no dice thrown) only while the box is taken and the bag has fewer than 2 free slots.
- `freeId` is a flag (1 = the free appraisal is unspent), not a uid. Extra sheet fields: `fu` (follow-ups 0/1/2),
  `kn` (kills of the quest under way), `rec` (recovery queue). A charm also stores `rv` (rule version it was sealed under).
- Stats: a `st` option adds to the stat **after** its soft cap (`eff(st) + bonus`) in `deriveStats` only — level,
  points spent, job checks and reset costs never see it. Attack is added after the gear multiplier. HP/MP are clamped once
  after every place/remove (`afterGear`).
- Dice: charm rolls use their own hashed stream (`charmRoll`, like `cosRoll`), so no existing seeded run changes.
  Luck, magic find and streaks do not touch them.
- Shape odds (not in the spec): pin 40 · bar2 25 · bar3 12 · elbow 13 · tile2 10; option odds: st 30 · hp 18 · mp 14 ·
  atk 14 · skd 18 · skh 6. `skd` names one of the 12 weapon actives, `skh` one of the two skills that heal the caster
  (`soulbolt`, `dive`). Percent options are kept to 0.1.
- Legendaries: several may lie on the board; only the first placed works (its general option always counts).
  **메아리 뿔참** → `rend` (대지 가르기): the wave's first monster at ≥ 70% of its length takes `round(hit × 0.18)` as plain
  damage (no crit, leech, mastery or further procs); nothing there → the 12 s wait is not spent. **길별의 렌즈참** → `pierce`
  (관통 화살): the second monster the arrow strikes (alive) is marked 4 s; the marker's next basic attack on it (melee
  main target or a plain arrow) ×1.15, once; 14 s. Waits live on the player (`p.chCd`), so swapping weapons or re-placing
  the charm does not clear them (a relog does — the runtime player is rebuilt).

## Deferred
- **수호의 매듭참**: no spear or book skill heals the party yet (`soulbolt`/`dive` heal only the caster). It is in
  `defs.charms.legend.knot` with `off: 1`, never drops, and does nothing if found on a sheet.
- **NPC 일과** (work/meal schedule, service-access rule): the NPC-life code is not on `main` yet; 주아나 uses the plain
  `npcNear(p, "charm")` reach (56 px). Register her schedule when `62-npc-life.js` lands.
- 캐릭터간 거래·창고 이동 (spec: later). Sort keeps charms at the end of the bag, never stacked.

## Measured (tests/charms.mjs -v, fixed seeds)
| source | sealed charm | spec | nail | spec | 매직 / 레어 / 전설 over 200k seals | spec |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| field, 120,000 kills | 0.622% | 0.60% | 0.052% | 0.05% | 84.95 / 14.83 / 0.22 | 85 / 14.8 / 0.2 |
| elite, 30,000 kills | 2.517% | 2.40% | 0.187% | 0.20% | 78.98 / 20.67 / 0.35 | 79 / 20.65 / 0.35 |
| boss · guardian, 8,000 kills | 11.84% | 12% | 0.975% | 1% | 66.94 / 32.57 / 0.50 | 67 / 32.5 / 0.5 |
| rift chest, 20,000 openings | 40.78% | 40% | 8.31% | 8% | 59.74 / 39.23 / 1.03 | 60 / 39 / 1 |

## Notes for C2
- `self.inv` charm rows have no gear fields (`q`, `enh`, `af` …): bag code that assumes them needs a `type === "charm"` branch.
- `ITEMS.charm.name` is just "참"; build the label from the wire (`rev`, `g`, `lg`) — sealed: "미감정 참" + `src` name.
- The board is editable only on safe maps; appraisal, expansion, claim and quests need 주아나 in reach.
- Juana's 16×16 art, the 참 tab, appraisal window, board UI, icons and sounds are all C2.

---

# C2 as built — client (2026-11-15)

Code: `game/public/charms.js` (everything) + hooks: `art.js` (icons), `sprites.js` (`juanaSheet npcSheet`), `scene_map.js`
(NPC sheets by `npcSheet(n)`), `audio.js` (5 effects), `items.js` / `win_char.js` (charm branches, the bag tabs), `windows.js`
(`WIN` `charm` `juana`; `charm` in `PANEL`), `hud.js` (`sync` + two `draw`s), `input.js` (Shift+C, `onKey`), `actions.js` (F at role
`charm`), `events.js` (`cm`), `net.js` (`onError`), `update.js` (her window closes when you walk off), `index.html`, `hud.css`
(one block at the end). Preview: `node scripts/shot.mjs --page charm [--q grid=1]`. No rules, data or wire changed.

- **Bag.** A tab row 전체 · 참 n over the grid. 전체 shows a charm as a slot (its icon, a grade band along the bottom edge);
  참 lists them as cards — sealed: the shard and 획득처 only; appraised: name, a tag with the grade's letter and word
  (`매 매직` `레 레어` `전 전설`), the shape drawn in cells, the options. A chosen charm's pane has 보드에 놓기 (appraised) and
  부수기 → 정말 부수기 / 취소 → `charm_destroy {uid, ok:1}`. A charm is never offered for sale, salvage or a quick slot, and its
  tooltip has no price.
- **Grades are told three ways**: the icon's setting (bronze band, silver mount, the legendary's own emblem: horn / knot /
  lens), the letter mark on the piece (`매 레 전`), and the word in the tag — colour is only the fourth.
- **참 보드** (`Shift+C`, the 참 menu button; docked in the side panel on a desktop, 38 px cells): locked cells are hatched
  with a padlock, the next cell to open has a brass one. A placed charm is one outlined piece over its cells. Drag from
  the tray (가방의 참) or from the board: the cells it would cover show ✓ on green or ✕ on red hatching; or click a charm, then a
  cell. 회전 (R) turns the charm in hand — one lying on the board turns where it lies (`charm_move` with the same anchor);
  빼기 or a drag back onto the tray sends `charm_remove`; Esc lets go. The anchor sent is the hovered cell minus the cell
  the charm was grabbed by. The client checks the same three things as the server (밖 / 잠긴 칸 / 다른 참) only to colour the
  ghost and to spare a hopeless request; a request shows as a pale dashed piece until `self.charms` confirms it, and on a
  refusal the piece is back where it was, the grid shakes and the server's sentence stays under the board (and as a toast).
  효과 합계 lists each total against its cap (`상한` in gold at the cap); 전설 효과 shows the one at work with ✓ 활성 / ✕ 비활성 and
  `lgWhy`; off a safe map a brass note says 마을에서만 변경 and the controls are off.
- **주아나** (F): her portrait and line, the quest card (의뢰 받기 with the Lv. reason, the kill bar, 보고하기), 감정 — each
  sealed charm with its cost (무료 while `free`), 감정 → "이 참을 296G에 감정할까요?" → `charm_id`; when the charm comes back
  appraised the reveal card (rays, the icon rising, grade / shape / options, her appraisal line) and the sparkle sound that
  climbs with the grade; 맡아 둔 참 (`pending` + `rec`) → `charm_claim`; 보드 확장 — a 5×5 miniature with the next cell blinking,
  못 have/1, price → `charm_expand {k}`. Everything is disabled with "주아나 곁에서만" away from her.
- **Her figure**: the hamster of her look with cheek pouches a pixel past the head and a row below it, a deeper purple
  apron with a pale bib (a bow at the back) and a 3×3 brass magnifier at her side; only the added pixels are re-inked.
- **`cm` events**: 0 two gold rings and a "메아리" float, 1 a blue ring and dot and "표식" on the monster, 2 a white ring;
  `charm_proc` sounds for the owner only.

## Deviations / not done
- The window ids are `charm` (board) and `juana`: `board` was already the 알바 board.
- Hotkey Shift+C (C alone stays the character window); R is the board's while a charm is in hand, otherwise auto-hunt.
- The lens mark has no lasting marker over the monster (a ring when set, a ring when spent) — the server sends no expiry event.
- Confirmations are in-window second clicks, not browser dialogs.
- Verified live against a local server: 주아나 in town, F → her window, the quest card and the server's Lv.30 refusal, Shift+C,
  the locked board, a real drag through the pointer handlers ending in the server's refusal on the board. **Staged only**
  (client state set in the page; no local way to reach Lv.30 with charms): the filled board, totals, legendary panel,
  appraisal confirm, reveal card, pending box, expansion row, the bag's 참 tab — and so the confirmed-path sounds
  (place / remove / appraise / expand) and the `cm` visuals were not heard or seen end to end.
