# 접두사 고유 효과 — prefix effects (design, 2026-11-16)

Status: **design only, nothing built.** Owner request: a wide variety of `[접두사]` effects (Diablo legendary powers and Mabinogi
enchants as the mood, all originals), different kinds per equipment type: **weapon / ring / gloves = offensive**, **armor (상의) /
boots (하의) / amulet (목걸이) = defensive**, helm = mixed defence + utility, **the same effect never stacks**.
Context: a 전설 (q3) and a 유니크 (q5) carry exactly ONE 고유 효과 `lg`; its name word is the item's prefix ("뇌명의 강철 양손검").
Magic/rare/legendary differ only by line count (2/3/4); plain stat lines carry no prefix. This doc designs the pool of `lg` effects only.
Read §1 (rules), §3 (catalogue), §6 (build plan); §2 lists the combat hooks every effect maps onto.

## 1. Rules

**Pools** (item type → letter; `ring1`/`ring2` are both R). An effect's slot letters say where it may *roll*; legacy pieces keep working anywhere (§6).

| letter | item type | pool | size |
| --- | --- | --- | --- |
| W | weapon | offense (on-hit, on-kill, on-skill, damage conditions) | 31 |
| R | ring (×2) | offense, many "utility-offense" (gold, resources, cooldowns, party) | 34 |
| G | gloves | offense, attack-speed / crit / combo styles | 35 |
| A | armor (상의) | defense: mitigation, regen, reflect, shields | 22 |
| B | boots (하의) | defense: mobility, evade, safety nets | 23 |
| N | amulet (목걸이) | defense: sustain, resource, aura | 20 |
| H | helm | **mixed**: shared defense effects that need no body (cleanse, poise, ward, heal share) + 8 helm-only utility effects | 25 |

Why helm is mixed: it is the "head" slot (senses, mind): wards, foresight, cleanse and sustain fit, and utility (xp, recall, pet, MP cost) has no
other home that is not a combat slot. Category tag per effect: **O** offense (slots ⊂ W R G), **D** defense (⊂ A B N H), **U** utility (H only).

**Rolls.** Only q3 and q5 carry one (q4 sets, q0–2 none; unchanged). `rollGear` picks the effect from the pool of the item's type, **weighted by
rating: S 1 · M 2 · L 1** (an M key is twice as likely as an S or L key; the few L keys are ~3–7 % of a slot's rolls). A 유니크 rolls the same way; its first line `af[0]` is the thematic key of the effect's *family*
(`fam` in §3 → `UNIQ.fx`: blow/kill/pass→`atkp`, crit→`critd`, skill→`mp`, mit→`def`, sus→`hp`, mob→`spd`, eco→`gold`/`mf`, xp→`xp`, util→`mp`;
the 8 existing keep their current `UNIQ.fx`). **Numbers are fixed** (like today's 8): no item-level scaling; item level only moves the ordinary lines.

**No-stack rule.** Effects are keyed by `lg`. Wearing several pieces with the same key activates **one**: the piece with the highest item level
`il` (`gearIl`); a tie goes to the earlier slot in `SLOTS` (weapon, helm, armor, gloves, boots, ring1, ring2, amulet). The other pieces' effect
does nothing (their normal lines still count) and their tooltip shows a grey line **"중복 적용되지 않음"** under the 고유 효과. A player may wear
two of a kind (e.g. 2 rings with 낙뢰의): the second is simply dead weight. Today `gearBonus` already collapses repeats (`lg[key]=1`);
the change is making the winner explicit (§6). Different keys that do similar things *do* coexist, bounded by the caps in §5.

**Power budget (the rule that keeps late game safe).** Reference unit **1P ≈ +17.6 % damage** = 질주의 (attack interval ×0.85) and
**1D ≈ −15 % damage taken** (same EHP gain). Rate by *average uplift in the situation the tooltip names*, including uptime and cooldown.
- **S** ≤ 0.5 unit (≈ +8 %): niche, conditional or small; **M** 0.5–1.2 unit (≈ +8–20 %): the standard; **L** up to ~1.7 unit (≈ +30 %):
  the ceiling, set by 거인 사냥꾼의 (+30 % on elites/bosses), 메아리의, 포식자의. **Nothing new exceeds an existing L.** L ≤ 1 in 8 of a pool,
  and an L must be conditional or have a ≥ 5 min cooldown. Basic-blow procs: `chance × damage × expected targets` ≈ 0.25–0.35 of a hit = M.
- Every proc chance below is a *base* chance, × `min(st.proc, 1.5)` (LUK); 뇌명의/메아리의 keep their current uncapped `st.proc`.
- A full loadout has ≤ 8 prefixed pieces (W, H, A, G, B, R, R, N), all of different keys: worst case ≈ 4 offense + 4 defense effects, the same
  headroom as today's 8 legendaries. The category caps in §5 stop sums from escaping.

## 2. Combat hooks that exist (every effect maps to one)

| hook | where (`game/src/logic/`) | knows | prefixes use it for |
| --- | --- | --- | --- |
| BLOW | `50 chainBlow` ← `basicAttack`, `magicLand`, `56 hammer` (3 call sites; becomes `pfxBlow(..., fin)`) | target, hit pos, combo finisher `fin` | basic-blow procs (never a skill) |
| HIT | `50 hurtMob`: dmg line, crit roll, `ign`, after `dealMob` | `opt.sk` (skill), crit, killed, `mob.hp`, `mob.by[pid]`, `mob.tgt` | damage multipliers, crit procs, statuses |
| KILL | `50 hurtMob` tail (feast/nova today), `killMob` (`looters`, loot, `gainXp`, `p.streak`) | overkill (`mob.hp<0`), rank | on-kill heals, resources, cooldowns, loot |
| SKILL | `57 castSkill` (`cost`, `p.cds[id]`, `aimMob`) | skill id, target by aim | on-skill procs, MP cost |
| HURT / MITI | `50 hurtPlayer` (damage formula = MITI, after hp loss = HURT) | raw, dmg, `mob` (null = telegraphed area) | mitigation, reflect, shields, low-HP |
| LETHAL | `hurtPlayer` and `wound` right before `fall` | hp ≤ 0 | cheat death (`p.ghost` exists) |
| EVADE | `80 evadeBlow`, `59 dodged` (dash i-frames) | a dodge happened | on-dodge |
| STAT | `45 deriveStats` → `p.stc`, `stats(p)` (non-cached part: buffs, `p.hp`, `p.streak`) | everything | passive stats, timed/conditional buffs |
| TICK | `80` player loop, 1 s: regen (`calm` = no hit 5 s), burn/poison | `p.hitAt`, `p.mvAt` | regen, cleanse, resting |
| STATUS | `80 afflict` (`res`), `45 staggerPlayer` (`poise`, `kbr`) | kind | resist / shorten |
| POT | `75 use` (`it.heal`, `p.potAt`) | amount | potion boosts |
| DASH | `59 dashGo` (`DASH_CD`, `p.dodge`) | start/end pos | dash cooldown, on-dash |
| LOOT | `50 lootFor`, `gainXp`, `killMob` | mob, rank | gold, stones, xp, chest MF |
| MOB | `mob.slow` (½ speed), `holdMob`/`mob.stun`, `mob.frz` (+`["fz"]`), `mob.vuln` (×1.3, `["vu"]`), `mob.dot`, `mobsWithin` | | statuses (no new status UI) |

**Burn / poison / freeze / slow** exist on players (`afflict`) and as mob slow/freeze/vuln/dot; there is **no** mob burn or second dot slot, and
no player absorb shield or party aura. Fire flavour is therefore damage numbers + `["b",x,y,r,kind]` bursts.
**Player-side prefix state `p.pc`** (phase 1, in memory only, never saved): cooldown stamps, counters, timed buffs; read inside `stats()`,
`hurtMob`, `hurtPlayer`, `atkCd`, exactly like today's `p.atkBuff`/`p.vitSpd`.
**Phase-2 hooks (small, 8 effects):** **DOT2** `mob.pd` second dot slot ticked in `tickMob` (a prefix never overwrites the dagger's `mob.dot`);
**ABS** `p.abs={n,until}` absorbed first in `hurtPlayer` (shown as the existing "막음" `["h"]` cue); **AURA** the 1 s tick gives a 2 s `pc.aura` to
party `members(S,p)` within r; **ZN** `rt.zones.push({…px:1})` (existing zone loop; ≤ 1 per player, replaces its own).

## 3. Catalogue — 95 (48 offense, 39 defense, 8 utility) prefixes

Columns: `key` · prefix word · slots · tooltip (the one Korean sentence) · hook / family · phase (1 = existing hooks + `p.pc`, 2 = needs a phase-2 hook) · rating.
Procs deal damage through `opt.px` hits (§5) so they never trigger each other. "공격" = basic blow (BLOW), "타격" = any blow incl. skills (HIT).
Flavour: 전격 화염 빙결 맹독 출혈 신성 그림자 바람 대지 별 균열, plus the hell-beast tone (쌍두, 충혈된, 담즙, 껍질, 꼬리).

### 3.1 Offense (O) — W / R / G
The first six are today's legendaries, **numbers unchanged**.

| key | 접두 | 슬롯 | 효과 | 훅 / fam | 단 | 급 |
| --- | --- | --- | --- | --- | --- | --- |
| chain | 뇌명의 | W G | 공격 시 25% 확률로 번개가 주변 적 2명에게 튄다 (60%) | BLOW / blow | 1 | M |
| nova | 폭렬의 | W G R | 적을 처치하면 폭발해 주변에 피해를 준다 (80%) | KILL / kill | 1 | M |
| haste | 질주의 | W G | 공격 속도 +15% | STAT / pass | 1 | M |
| giant | 거인 사냥꾼의 | W R G | 정예와 우두머리에게 주는 피해 +30% | HIT / pass | 1 | L |
| echo | 메아리의 | W R G | 스킬 사용 시 20% 확률로 재사용 대기시간이 사라진다 | SKILL / skill | 1 | L |
| greed | 황금손의 | R G | 골드 획득 +60% | STAT / eco | 1 | M |
| frost | 빙결의 | W G | 공격 시 15% 확률로 적을 1.2초 얼린다 (정예 0.6초, 우두머리 제외) | BLOW+frz / blow | 1 | M |
| venom | 맹독의 | W G R | 타격 시 20% 확률로 5초간 매초 공격력의 12% 독 피해를 준다 (이미 중독된 적 제외) | HIT+dot / blow | 1 | M |
| blaze | 화염의 | W R | 공격 시 15% 확률로 대상 주위(반경 30)에 불꽃이 터져 공격력의 70% 피해 | BLOW / blow | 1 | M |
| twin | 쌍두의 | G | 공격 시 15% 확률로 같은 적을 한 번 더 때린다 (70%) | BLOW / blow | 1 | M |
| gale | 선풍의 | W G | 기본 공격 5번째마다 바람 칼날이 직선의 적 3명을 벤다 (90%) | BLOW / blow | 1 | M |
| quake | 대지의 | W | 3연타 마무리 시 땅이 갈라져 반경 36의 적에게 공격력의 50% 피해와 0.3초 경직 | BLOW fin / blow | 1 | M |
| tail | 꼬리치는 | G | 3연타 마무리 시 반경 40의 적을 밀쳐 내고 0.4초 경직시킨다 (우두머리 제외) | BLOW fin / blow | 1 | S |
| chill | 냉기의 | W R G | 타격 시 적을 2초간 둔화시킨다 (이동속도 -50%) | HIT+slow / blow | 1 | S |
| sunder | 꿰뚫는 | W G | 적의 방어력을 25% 무시한다 | HIT ign / pass | 1 | M |
| relent | 집요한 | G | 같은 적을 이어 때릴수록 피해 +6% (최대 +24%), 대상이 바뀌면 처음부터 | HIT / pass | 1 | M |
| crush | 짓누르는 | W | 경직·빙결·둔화된 적에게 주는 피해 +25% | HIT / pass | 1 | M |
| exec | 처형자의 | W G R | HP 25% 이하의 적에게 주는 피해 +35% | HIT / pass | 1 | M |
| umbra | 그림자의 | W G | 나를 노리지 않는 적에게 주는 피해 +25% | HIT `mob.tgt` / pass | 1 | M |
| judge | 심판의 | W R | 각 적에게 처음 입히는 타격의 피해 +60% | HIT `mob.by` / pass | 1 | S |
| fury | 분노의 | W G R | HP 50% 이하면 공격력 +12%, 25% 이하면 +25% | STAT hp / pass | 1 | M |
| moon | 달빛의 | W R | 밤에 주는 피해 +15% | HIT `isNight` / pass | 1 | S |
| star | 별똥의 | W R G | 치명타 시 12% 확률로 별이 떨어져 대상 주위(반경 36)에 공격력의 90% 피해 (1.5초 간격) | HIT crit / crit | 1 | M |
| bleed | 출혈의 | W G R | 치명타 시 4초간 출혈 (매초 공격력의 15%) | HIT crit+DOT2 / crit | 2 | M |
| flurry | 난무의 | G | 치명타 시 2초간 공격 속도 +25% | HIT crit+`atkCd` / crit | 1 | M |
| weak | 간파의 | W R G | 치명타 시 15% 확률로 적의 약점이 3초간 드러나 받는 피해 +30% (6초 간격) | HIT crit+vuln / crit | 1 | M |
| eye | 충혈된 | W G R | HP 90% 이상인 적에게 치명타 확률 +15%p | HIT crit roll / crit | 1 | M |
| siphon | 흡수의 | R G | 치명타 시 최대 HP의 1.5%와 최대 MP의 3%를 회복한다 (1초 간격) | HIT crit / crit | 1 | S |
| aim | 정조준의 | W R G | 1.5초 이상 멈춰 선 뒤의 첫 타격은 반드시 치명타 (5초 간격) | HIT `sure`, `p.mvAt` / crit | 1 | M |
| jackpot | 대박의 | R G | 치명타 시 10% 확률로 피해가 2배가 된다 | HIT crit / crit | 1 | M |
| over | 넘치는 | W R | 처치 시 남은 피해의 60%가 가장 가까운 적(반경 70)에게 옮겨 간다 | KILL `mob.hp<0` / kill | 1 | M |
| reap | 수확자의 | W G R | 연속 처치(8초 이내) 1회마다 공격력 +3%, 최대 +15% | STAT `p.streak` / kill | 1 | M |
| snap | 재촉의 | R G | 처치 시 모든 스킬의 재사용 대기시간이 0.8초 줄어든다 | KILL `p.cds` / kill | 1 | M |
| mana | 샘솟는 | R G | 처치 시 최대 MP의 5%를 회복한다 | KILL / kill | 1 | S |
| scav | 약탈의 | R | 처치 시 8% 확률로 그 몬스터의 골드를 3배 더 얻는다 | LOOT / eco | 1 | S |
| smelt | 단련의 | R | 정예·우두머리 처치 시 25% 확률로 강화석 1개를 더 얻는다 | LOOT / eco | 1 | S |
| hellfire | 지옥불의 | W R | 처치 시 20% 확률로 그 자리에 3초간 불길이 남아 0.5초마다 공격력의 25% 피해 (반경 30, 동시에 1개) | KILL+ZN / kill | 2 | M |
| bolt | 낙뢰의 | W R | 스킬 사용 시 조준한 적(사거리 140)에게 번개가 떨어져 공격력의 110% 피해 (2초 간격) | SKILL `aimMob` / skill | 1 | M |
| rift | 균열의 | W R G | 스킬 사용 후 4초 안의 첫 기본 공격 피해 +50% | SKILL→HIT / skill | 1 | M |
| thrift | 절약의 | R G | 스킬 사용 시 25% 확률로 MP를 소모하지 않는다 | SKILL cost / skill | 1 | S |
| surge | 과부하의 | G | 스킬 사용 후 3초간 공격 속도 +20% | SKILL+`atkCd` / skill | 1 | M |
| flood | 범람의 | R G | MP가 70% 이상이면 스킬 피해 +15% | HIT `opt.sk` / skill | 1 | M |
| link | 연계의 | W R G | 서로 다른 스킬 3개를 5초 안에 쓰면 다음 스킬은 MP 소모 없이 피해 +30% | SKILL / skill | 1 | M |
| vent | 분출의 | W R | 스킬 사용 시 주위(반경 40)에 충격파가 퍼져 공격력의 40% 피해 (3초 간격) | SKILL / skill | 1 | S |
| blizzard | 눈보라의 | W R | 스킬 사용 시 시전 위치에 2.5초간 눈보라가 일어 반경 40의 적을 둔화시키고 0.5초마다 공격력의 20% 피해 (동시에 1개) | SKILL+ZN / skill | 2 | M |
| lunge | 돌진의 | G | 대시 직후 2초간 주는 피해 +25% | DASH→HIT / pass | 1 | M |
| pack | 무리의 | R G | 근처(반경 200) 파티원 1명마다 공격력 +4% (최대 +12%) | AURA / pass | 2 | M |
| lone | 홀로선 | R | 파티 없이 사냥할 때 주는 피해 +12% | HIT / pass | 1 | S |

### 3.2 Defense (D) — A / B / N (+ H)
The first two are today's. Mobility effects live on boots, sustain/resource on the amulet, mitigation/reflect/shields on armor.

| key | 접두 | 슬롯 | 효과 | 훅 / fam | 단 | 급 |
| --- | --- | --- | --- | --- | --- | --- |
| thorn | 가시의 | A B H | 받은 피해의 40%를 공격한 적에게 되돌려 준다 | HURT / mit | 1 | M |
| feast | 포식자의 | A N H | 적을 처치할 때마다 최대 HP의 4% 회복 | KILL / sus | 1 | L |
| bark | 껍질의 | A H | 피격 시 15% 확률로 그 피해를 60% 줄인다 | MITI / mit | 1 | M |
| fur | 포근한 | A N | HP가 90% 이상이면 받는 피해 -15% | MITI / mit | 1 | S |
| last | 불굴의 | A B H | HP 30% 이하일 때 받는 피해 -25% | MITI / mit | 1 | M |
| gran | 굳건한 | A B | 정예와 우두머리에게 받는 피해 -12% | MITI `mob.el` / mit | 1 | M |
| stone | 둔중한 | A | 한 번에 최대 HP의 25%를 넘는 피해는 초과분이 절반이 된다 | MITI / mit | 1 | M |
| ward | 수호의 | A B N H | 12초마다 한 번, 받는 첫 피해를 막아 낸다 | MITI / mit | 1 | M |
| smoke | 연막의 | B N | 피격 시 8% 확률로 1.2초간 무적이 된다 (10초 간격) | HURT→`p.ghost` / mit | 1 | M |
| foresee | 예지의 | A B H | 붉은 예고 범위 공격에서 받는 피해 -30% | MITI `!mob` / mit | 1 | M |
| manawall | 마나방벽의 | A N | 받는 피해의 25%를 MP가 대신 받는다 (MP가 있는 동안) | MITI `p.mp` / mit | 1 | M |
| root | 뿌리내린 | B H | 1.5초 이상 멈춰 서 있으면 받는 피해 -15% | MITI `p.mvAt` / mit | 1 | S |
| heavy | 버티는 | A B H | 피격 경직 -50%, 밀려나는 거리 -50% | STAT poise,kbr / mit | 1 | S |
| purge | 정화의 | A B N H | 독·화상·둔화의 지속시간과 피해가 50% 줄어든다 | STATUS / mit | 1 | S |
| cure | 맑은 | B N H | 독·화상·둔화에 걸리면 3초 뒤 풀리고 8초간 다시 걸리지 않는다 (30초 간격) | TICK / mit | 1 | S |
| rime | 서리갑옷의 | A B | 근접 피격 시 30% 확률로 공격한 적을 2초간 둔화시킨다 | HURT+slow / mit | 1 | S |
| counter | 되받는 | A B | 피격 시 15% 확률로 공격한 적에게 공격력의 150% 반격 (2초 간격) | HURT / mit | 1 | M |
| fate | 불사의 | A N | 치명상을 입으면 HP 1로 버티고 3초간 무적이 된다 (6분 간격) | LETHAL / mit | 1 | L |
| bile | 담즙의 | A B | 피격 시 20% 확률로 공격한 적이 5초간 매초 공격력의 10% 독 피해를 입는다 | HURT+DOT2 / mit | 2 | M |
| carap | 갑각의 | A N | 처치 시 최대 HP의 3% 보호막이 생긴다 (최대 15%, 10초 유지) | KILL+ABS / sus | 2 | M |
| bastion | 방벽의 | A N H | 5초 넘게 피격이 없다가 맞으면 최대 HP의 12% 보호막이 8초간 생긴다 (25초 간격) | HURT+ABS / mit | 2 | M |
| halo | 후광의 | N H | 근처(반경 150) 파티원이 받는 피해 -6% | AURA / mit | 2 | S |
| panic | 다급한 | A B | HP가 35% 이하로 떨어지면 5초간 이동속도 +30%, 받는 피해 -15% (60초 간격) | HURT low / mob | 1 | M |
| wisp | 스치는 | B | 대시 재사용 대기시간 -25% (4초 → 3초) | DASH / mob | 1 | M |
| dust | 흙먼지의 | B | 대시 도착 지점 반경 40의 적이 0.6초 경직 (우두머리 제외, 6초 간격) | DASH / mob | 1 | S |
| after | 잔상의 | B | 대시 직후 1.5초간 이동속도 +25% | DASH+STAT / mob | 1 | S |
| nimble | 날렵한 | B N | 공격을 피하면 (회피·대시 무적) 최대 HP의 2% 회복 (1초 간격) | EVADE / sus | 1 | S |
| reflex | 반사신경의 | B | 공격을 피하면 2초간 공격력 +15% | EVADE+STAT / mob | 1 | S |
| relax | 한가로운 | B | 5초 넘게 피격이 없으면 이동속도 +15% | STAT `p.hitAt` / mob | 1 | S |
| chase | 추격의 | B | 처치 후 3초간 이동속도 +20% | KILL+STAT / mob | 1 | S |
| slick | 미끄러운 | B | 둔화에 걸리지 않고, 경직에서 일어나면 1초간 이동속도 +30% | STATUS / mob | 1 | S |
| share | 나눔의 | N H | 처치 시 근처(반경 160) 파티원의 HP를 최대 HP의 3% 회복 | KILL `looters` / sus | 1 | S |
| spring | 샘물의 | A N | HP 50% 이하면 매초 최대 HP의 1.2% 회복 | TICK / sus | 1 | M |
| pot | 약사의 | N H | 물약 회복량 +35% | POT / sus | 1 | M |
| elixir | 달이는 | N | 물약 사용 후 6초간 매초 최대 HP의 1% 회복 | POT+TICK / sus | 1 | S |
| med | 명상의 | N H | 2초 넘게 멈춰 서 있으면 매초 MP 2% 회복 | TICK / sus | 1 | S |
| moss | 이끼의 | A N | 5초 넘게 피격이 없으면 매초 HP 1.5% 추가 회복 | TICK / sus | 1 | S |
| emerg | 비상의 | A B N H | HP가 30% 이하가 되면 즉시 최대 HP의 20% 회복 (90초 간격) | HURT low / sus | 1 | M |
| owl | 올빼미의 | N H | 밤에 받는 피해 -10% | MITI `isNight` / mit | 1 | S |

### 3.3 Utility (U) — helm only

| key | 접두 | 슬롯 | 효과 | 훅 / fam | 단 | 급 |
| --- | --- | --- | --- | --- | --- | --- |
| trace | 추적자의 | H | 정예·우두머리 처치 경험치 +25% | LOOT / xp | 1 | S |
| sage | 현자의 | H | 파티 사냥 시 경험치 +8% | LOOT / xp | 1 | S |
| mercy | 자비로운 | H | 쓰러져도 잃는 경험치가 50% 줄어든다 | `deathLoss` / util | 1 | S |
| homing | 귀소의 | H | 귀환 주문서 시전 시간이 절반이다 (2초 → 1초) | `RECALL_MS` / util | 1 | S |
| clever | 영리한 | H | 스킬의 MP 소모 -15% | SKILL cost / util | 1 | M |
| treasure | 보물눈의 | H | 상자 몬스터에게서 아이템 발견 +50% | LOOT / eco | 1 | S |
| tame | 길들이는 | H | 펫이 전리품을 줍는 속도가 2배다 | `PET_MS` / util | 1 | S |
| hearth | 화덕의 | H | 모닥불 곁 휴식 회복 +50% | TICK / util | 1 | S |

## 4. Pools by slot (what each slot can roll; generated from §3)

- **W 무기** (31): chain nova haste giant echo frost venom blaze gale quake chill sunder crush exec umbra judge fury moon star bleed weak eye aim over reap hellfire bolt rift link vent blizzard
- **R 반지** (34): nova giant echo greed venom blaze chill exec judge fury moon star bleed weak eye siphon aim jackpot over reap snap mana scav smelt hellfire bolt rift thrift flood link vent blizzard pack lone
- **G 장갑** (35): chain nova haste giant echo greed frost venom twin gale tail chill sunder relent exec umbra fury star bleed flurry weak eye siphon aim jackpot reap snap mana rift thrift surge flood link lunge pack
- **A 상의** (22): thorn feast bark fur last gran stone ward foresee manawall heavy purge rime counter fate bile carap bastion panic spring moss emerg
- **B 하의** (23): thorn last gran ward smoke foresee root heavy purge cure rime counter bile panic wisp dust after nimble reflex relax chase slick emerg
- **N 목걸이** (20): feast fur ward smoke manawall purge cure fate carap bastion halo nimble share spring pot elixir med moss emerg owl
- **H 투구** (25): thorn feast bark last ward foresee root heavy purge cure bastion halo share pot med emerg owl trace sage mercy homing clever treasure tame hearth

Totals: **95** distinct prefixes = 48 offense (W/R/G pool) + 39 defense (A/B/N pool, the helm shares 17 of them) + 8 helm utility. Phase 1 (existing hooks): 87; phase 2 (small new hook): 8. Ratings S 37 / M 54 / L 4. Effects restricted to one slot kind: W 2, R 3, G 6, A 1, B 7, N 1, H 8.
Trigger mix (by family `fam`): on-basic-blow 9 · on-crit 8 · on-kill 6 + eco/xp/loot 6 · on-skill 9 · conditional/passive damage 13 · mitigation 21 (on-hurt, low-HP, shields,
cheat death) · sustain 10 (kill/tick/potion/low-HP) · mobility 8 (dash, dodge, calm, kill-rush) · utility 5. Elements: 전격 (뇌명 낙뢰) 화염 (화염 지옥불) 빙결 (빙결 냉기 눈보라 서리갑옷)
맹독 (맹독 담즙) 출혈 신성 (심판) 그림자 바람 (선풍) 대지 별 균열.

## 5. Interaction and abuse notes

- **PvE only, server-authoritative, deterministic.** All rolls `rnd(S)` (never `Math.random`/`Date`); times from `S.now`; effects evaluate in `st.lg`
  order (= `SLOTS` order) so the RNG stream is reproducible. The client sends nothing new; it only draws events.
- **No proc chains.** Damage a prefix deals goes through `hurtMob(..., {px:1})`: a `px` hit may not trigger BLOW/HIT/crit/DOT prefixes. KILL heals and
  resources still run on `px` kills (so 포식자의 keeps working on 폭렬의 kills, as today); 폭렬의 keeps `p.chainKill`.
- **Cooldown on every proc that can repeat.** Any proc that can fire more than once per second per player carries an internal cooldown ≥ 1 s
  (`p.pc.cd[key]`), or is a ≤ 25 % chance on a basic blow with no area. Cooldowns are per key, never shared.
- **Category caps (one clamp function each, all tested):** (1) *damage*: every prefix HIT multiplier (giant included) multiplies into one factor capped ×1.6;
  skill passives (`pasHurtK`) stay outside. (2) *attack interval*: 질주의 stays ×0.85 in `deriveStats`; the other prefix speeds (난무의, 과부하의) multiply into one
  factor floored at ×0.80; the final `atkCd` is never below 45 % of the weapon's. (3) *mitigation*: all prefix mitigation multiplies into one factor floored at ×0.60
  (never more than −40 %), applied before `st.guard`; absorb ≤ 20 % mhp at once. (4) *healing*: prefix heals total ≤ 8 % mhp per rolling second (`p.pc.heal`).
  (5) *cooldown refunds*: 재촉의/메아리의 never set a cooldown below 400 ms (echo's value today). (6) *xp*: prefix xp total ≤ +15 % (the level curve is fixed,
  ~45 h to Lv.200); the 연속 처치 bonus is untouched. (7) *gold*: 황금손의 and 약탈의 together ≤ +100 %; 단련의's stone only on elite/boss kills, ≤ 1 per kill. (8) *crit*: 충혈된 adds to the roll but the total stays under `SFX.critCap` (75 %).
- **Statuses never beat bosses.** Freeze/stun/slow/knock prefixes skip bosses and `el === 2` and honour `HOLD.cap` (`holdMob`). 간파의 uses the existing flat
  `mob.vuln` (×1.3); on a scripted boss it multiplies with the stagger vuln (×1.69 worst), hence its 15 % chance and 6 s lockout.
- **Existing mechanics are not overwritten.** 맹독의 writes `mob.dot` only if empty (the dagger's bleed wins); anything stronger uses DOT2. Player-side effects
  respect `p.ghost`, the dash `p.dodge` and `p.stag`.
- **Cheat death (불사의)**: once per 6 min per player (`p.pc`), also checked in `wound`. Scripted raid blasts that call `hurtPlayer` are covered; anything that
  bypasses it (rift fail) is not: test with the rift/raid bosses first. Relogging resets `p.pc` (accepted: 6 min is not worth an exploit).
- **Performance (tick ~1 ms).** Hot hooks iterate precomputed per-hook arrays (`p.stc.px = {blow:[…], hit:[…], …}` built in `deriveStats`), ≤ 8 entries, no allocation.
  Area effects scan `mobsWithin` once per proc, ≤ 4 targets, chance ≤ 15 % or ICD ≥ 1.5 s. ZN: ≤ 1 per player, ≤ 6 zone ticks/s per map. AURA, 나눔의, 무리의 walk the party
  (≤ 4) once per second, never per hit; 홀로선 reads a value cached by that tick.
- **Tuning knobs:** every number lives in one `PFX` table (§6), so a balance pass is a data edit; ratings are re-measured in `tests/prefix.mjs`.
- **Overlap with skills/passives:** 범람의 vs the staff MP passive, 정조준의/난무의 vs dagger crit passives, 재촉의 vs `dagger_snap30`: all multiply inside the caps
  above; add one combo case per pair to the tests.

## 6. Implementation plan (next agent)

**Data.** `10-tables.js`: keep `LEGEND[key] = [word, desc]` (the client reads `[0]`, `[1]`) and append **`[word, desc, slots, cat, rating, fam]`**
(`slots` e.g. `"WGR"`, `cat` O|D|U, `rating` S|M|L, `fam` per §3). Numbers go in a new `PFX = { frost:{p:0.15, ms:1200, elite:0.5}, … }`; the `desc`
strings are built from `PFX` with a tiny template so tooltip and rule share numbers (the 8 existing descs stay byte-identical). Also `PFX_W = {S:1,M:2,L:1}` and
`SLOT_L = {weapon:"W", ring1:"R", ring2:"R", gloves:"G", armor:"A", boots:"B", amulet:"N", helm:"H"}`. `defs.legend` already ships `LEGEND`; the 4 new tail
fields cost ≈ 10 KB once in `welcome`. `UNIQ.fx` gets the fam table (§1) for new keys.

**Files.**
- new `logic/51-prefix.js` (after 50; function declarations hoist, constants stay in 10): `PFX_FN = { key: { blow, hit, crit, kill, skill, hurt, miti, dash, evade, tick, stat } }`,
  dispatchers `pfxBlow pfxHit pfxKill pfxSkill pfxMiti pfxHurt pfxLethal pfxDash pfxEvade pfxTick pfxPot pfxLoot`, the clamps of §5 and the `p.pc` helpers.
- `40-characters-world.js gearBonus`: `lg[g.lg] = slot` of the **winning** piece (higher `gearIl`, tie = earlier `SLOTS`), losing slots → `b.lgOff`. Values stay truthy, so every
  `st.lg.x` test keeps working; `if (lg.greed) b.gold += 60` stays.
- `45-jobs.js deriveStats`: passive STAT effects (`haste` ×0.85 as today, `heavy` poise/kbr, `eye`, `sunder`…) and `p.stc.px`; `stats()` for hp/streak/timed buffs; `atkCd` for the speed clamp.
- `50-loot-combat.js`: `chainBlow` → `pfxBlow` (3 call sites, pass `fin`); `hurtMob` gets HIT multipliers / crit / `ign` / `sure` / `opt.px` and its kill tail → `pfxKill`
  (feast/nova move there, same numbers); `hurtPlayer` → `pfxMiti` before the hp loss, `pfxHurt` after, `pfxLethal` before `fall`; `rollGear` rolls by slot pool with `PFX_W`; `lootFor`/`gainXp` → `pfxLoot`.
- `57-weapon-skills.js castSkill` → `pfxSkill` (MP cost, echo moves there); `56-hammer.js` chain site → `pfxBlow`; `59-dash.js` → `pfxDash` (`dashWhy` uses the reduced cd);
  `80-simulation.js`: `evadeBlow` → `pfxEvade`, player loop → `pfxTick`, `afflict` res, and for phase 2 the zone loop + `tickMob`; `75-apply.js use` → `pfxPot`; `fall`/respawn → 자비로운.
- `90-views-api.js`: `defs.legend` keeps its key; **append `lgOff` (array of slot names) to `self`** (rebuilt when gear changes; `dirty` already sends `self`).
- client `public/items.js` tooltip: print the 고유 효과 desc as today; if the piece's slot is in `self.lgOff` add the grey line **"중복 적용되지 않음"**; for a bag piece, grey it when a worn
  piece with the same key has `il ≥` its own (worn wins ties). No new windows, icons or status UI; reuse events `["z"]` (line), `["b"]` (burst), `["fz"]`, `["vu"]`, `["h"]` (cue 3 = 막음), and a toast only for rare procs (≥ 6 s apart).
- docs: `docs/FILEMAP.md` row for `51-prefix.js`; `docs/systems/loot-and-economy.md` gets the pool / no-stack line.

**Legacy and saves.** Sheets store only `lg:"key"` (+ `un`): **no format change, no `v` bump.** `migrate` keeps any key present in `LEGEND`; a key is never deleted (if retired,
set `off:1` in `PFX`: the piece loads inert, like `CHARM_LEGEND.off`). Slot letters restrict *rolling* only: a 황금손의 helm from before stays valid and active. Existing 유니크
(`un:[suffix]`) unchanged. `rollGear`'s pick changes (filter + weights), so a seeded loot test that pins a specific `lg` needs its expectation refreshed.

**Phases.** **P1a** infrastructure + the 8 existing moved onto `PFX`/dispatch with identical results + no-stack + `lgOff` + tooltip line (all old tests pass untouched).
**P1b** the 79 new phase-1 effects, grouped by hook (BLOW → HIT → KILL → SKILL → MITI/HURT → TICK/POT/LOOT → DASH/EVADE/STAT), one PR per group with its tests.
**P2** the 8 effects needing DOT2 (출혈의, 담즙의), ABS (갑각의, 방벽의), AURA (무리의, 후광의), ZN (지옥불의, 눈보라의): hooks first, then the effects.
A key may exist in `LEGEND` before it can drop: `PFX[k].on` hides it from `rollGear` until built.

**Tests** (`game/tests/prefix.mjs`, add to `tests/LIST`; node:assert, seeded `S`, no screenshots):
1. table: every key has valid slots/cat/rating/fam, `cat` ⊂ its allowed slots (O ⊂ WRG, D ⊂ ABNH, U = H), ≥ 20 per slot, desc Korean with a digit, the 8 old descs unchanged.
2. roll: 2000 seeded rolls per slot never produce a key outside its pool; per-key weights ≈ 1:2:1 (S:M:L); q0–2 and q4 never carry `lg`; a 유니크's `af[0]` follows `fam`.
3. no-stack: two same-key pieces → higher `il` wins, tie → earlier slot, `lgOff` lists the loser, stats equal a single piece; different keys both active.
4. per effect (table-driven, one fixture per hook): fires with `rnd` forced, not otherwise; numbers match `PFX`; `px` hits do not chain; ICD respected; bosses immune where stated.
5. caps: a max-stack loadout hits each clamp in §5 (damage ×1.6, interval ×0.80 / 45 %, guard ×0.60, heal 8 %, xp +15 %, gold +100 %).
6. legacy: an old sheet with `lg:"giant"` on a ring/helm loads and works; an unknown `lg` is dropped as today; an old 유니크 unchanged; determinism (same seed → same events).
7. perf smoke: 4 players × 8 prefixes × 60 mobs over 600 ticks stays inside the existing `balance`/tick budget.

## 7. Open decisions for the owner

1. The L list is small on purpose (거인 사냥꾼의, 메아리의, 포식자의, 불사의); promote more only if a 전설 should feel like a jackpot.
2. Weapon-kind specific effects (e.g. 선풍의 only for bow/spear)? Designed kind-agnostic to keep the pools simple.
3. 단련의 (extra 강화석) and 약탈의 touch the gold/stone faucets: check against `economy-review-2026-11-15.md` before enabling.
4. Proc feedback is toasts + existing events; a small `["px", eid, code]` icon event is an optional later polish.
