# 플레이어 상호작용 — the menu on another player, trade, mini-games (as built 2026-11-15)

- **Menu** (`public/pmenu.js`): click or tap another player's body → a framed menu beside them: 파티 초대 (`pinv`) ·
  거래 제안 · 친구 추가 (`fr add`, the vault) · 귓속말 (fills `/w 이름 `) · 따라가기 · 미니게임 ▸ (`defs.sx.games`).
  Greyed items say why (same party, other party, full party, already a friend / asked, too far, busy). Esc closes.
- **따라가기** (client only): ordinary steps toward the target (`pathTo`, re-aimed every 0.5 s); through the door they
  vanished beside; stops on a move key / click, attack · dash · auto, death, or losing them (2.5 s after a door).
- **Requests** (`sx ask/yes/no`, `src/logic/69-social-play.js`): one pending per target, 20 s, 3 s cooldown per asker;
  refused when either side is busy (trade or game), blocked, dead, or too far (trade 5 tiles, games 10).
- **Trade** (server-authoritative): bag items + gold; quest items, charms and 참틀 확장못 refused (as the warehouse);
  equipped gear and cosmetics are not in the bag. Offers hold the slot objects themselves: an item sold, stored,
  sorted away or used falls off on the next tick and unlocks both. Any change unlocks both; 교환 needs both 확정, then
  both 교환. The swap re-checks every row and gold and runs on copies of both bags first — whole or nothing — then
  `saveSoon` both, a system line in each chat. Cancels: > 8 tiles apart, map change, death, logout, either closing.
- **Mini-games**: `MINIGAMES[id] = { name, start, check, act, tick, view }` — add a game there and it appears in the
  menu. 가위바위보: 3 s pick window (picks hidden; the other side sees only "골랐습니다"), a hand by lot (`ri(S)`) for a
  missing pick, reveal to both for 3.5 s (system line, sound), 다시 하기 asks again. World state only (`p.req`,
  `p.trade`, `p.game`), never on the sheet.
- **Wire**: snapshot `sx` only when it changes (0 = cleared): `{q: [name, kind, kindName], t: {n, e, m, mg, ml, mo, o,
  og, ol, oo}, g: [kind, name, …view]}`; decoder `sxwin.js onSnap`. Tests: `tests/social-actions.mjs`.
