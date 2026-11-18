# 메인 퀘스트 보강 (2026-11-19)

The main chain still lives in code (`src/logic/10-tables.js` `QUESTS`; `data/quests.json` `main` stays `null`). Six steps were
inserted (flag `v30`, sheet v30, `questV30` in `67-trophies.js`, mapped in `migrate`); the last row (crownstag) is still the
last, so side quests with `req.main` and the frostkeep tablet keep their meaning.

## New steps (player Lv. = 4 × tier − 3)
| after | mob (map) | kind | Lv. | reward |
| --- | --- | --- | --- | --- |
| 붕대 감은 짐꾼 | cactushog (oasis) | kill 12 | 125 | 26k xp · 4.3k G · hp_m 10, sc_xp 2 |
| 손갈기 사자 boss | wingcrane (cloudtemple) | kill 12 | 125 | 29k · 5.3k · mp_m 10, ske_stone 2 |
| 재 쌓인 종지기 | ribvulture_gold (dunesea) | kill 12 | 133 | 32k · 5.4k · hp_m 10, stone 6 |
| 금관을 쓴 깃 | clubshrimp (coast boss) | solo story fight | 153 | 50k · 6k · uncurse, stone 8 + trophy |
| 포자 무덤 | wingcrane_ash (inklake) | kill 12 | 165 | 48k · 9k · mp_m 10, sc_def 3 |
| (same) | serpentwing_ash (inklake boss) | solo story fight | 181 | 62k · 8k · feather 3, ske_stone 5 + trophy |

XP base = 1.4 × a level's worth (kill) or 1.5–1.7 (boss) at the mob's tier, like the neighbours.

## Reward plan (old boss rows had none; items only, all existing ids)
Field-boss steps now pay a utility item besides the trophy: 부활 깃털 (lambmaw 2, loggator 3, lionhand 3), 경험의 주문서 (ribdeer 2,
mummycamel 3, crownpeacock 5), 병아리 펫 (toadbrood), 공/방 주문서 (doghead), 저주 해제 (crabskull), 스킬 강화석
(moleworm 3, sandmaw 5, rotstag 8). Chapter capstones: 크리온 + 꼬마 박쥐 펫, 심연의 어미 + 도깨비불 펫.
Kill steps keep potions / 강화석 / runes. No new reward kind was needed.
