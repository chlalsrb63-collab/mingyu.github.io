# Server, accounts and saves

Purpose: how a browser reaches a world, how accounts/characters are stored, how a sheet is saved and
upgraded. Source of truth: `game/src/worker.ts`, `room.ts`, `accounts.js`, `logic/40-characters-world.js`.

## Key files
| file · symbol | role |
| --- | --- |
| `worker.ts` `api()` / default fetch | `/api/{signup,login,logout,me}` (POST, body ≤ `MAX_BODY_BYTES`=2048, whitelisted by `parseApiBody`), `GET /api/servers`; `/ws/<channel>` (must be in `CHANNELS`: s1-ch1 s1-ch2 s2-ch1 s2-ch2) → Room DO; CORS `*` (token in body, no cookies). Forwards to vault with caller `ip` |
| `room.ts` `class Room` | one DO class, two roles: channel (sockets + world) and vault (name `VAULT_NAME`="vault:characters", paths `VAULT_PATH`="/__vault/"; refuses vault paths unless `ctx.id` is the vault) |
| `room.ts` `ready()` | builds `logic.setup()` lazily; after DO eviction re-`enter`s every socket whose attachment has `live` via vault `load` |
| `room.ts` `onMessage` | `join` → `create` → `rank` → `gcreate` → generic action (see flow) |
| `room.ts` `alarm()` | tick loop, saves, stops when nobody is live (`this.world = null`) |
| `room.ts` `vault(op)` | ops `api/* auth count load create save rank guild` |
| `accounts.js` `Accounts` | `signup login logout auth me servers report summaryPuts`; plain JS, store+crypto injected (tests use a Map fake) |
| `accounts.js` `K`, `pidFor`, `serverOf`, `THROTTLE`, `rankRow`, `summary`, `fromOldRow` | key scheme, pid = `<accountId>@<server>`, login/sign-up throttles, lobby summary / rank rows (`v:2`) |
| `protocol.ts` `parseClientMessage` | size/shape limits of untrusted frames (join, action, reset) |
| `logic/40-characters-world.js` | `newChar`, `migrate` (private), `addPlayer` (calls `migrate`), `removePlayer`, `exportChar`, `takeSaves`, `SAVE_SOON`/`saveSoon` |

## Data shapes
- Vault keys: `a:<id>` account · `s:<sha256(token)>` session (30 d, slides ≤ 1×/day, ≤10 per account) · `c:<pid>` `{char, sess?:{room,t}}` · `m:<pid>` summary · `n:<name>` / `n:s2:<name>` name claim · `g:` / `g:s2:` guild claim · `rank` / `rank:s2` top 20 · `f:i|p|s:` throttles. **Live format: never change a key shape without a migration** (AGENTS rule 9). s1 keeps the pre-account global keys; old anonymous `c:<pid>` are adopted once by sign-up `legacy`.
- Lock: `rec.sess={room,t}`; a `load` from another room within `LOCK_MS`=40 s is refused; a `save` from a room not holding the lock is dropped; `leave` saves with `release:[pid]`.
- Wire: in `join{token,dev?}` / `action` / `reset`; out `need_char`, `welcome{you,defs,room,server,max}`, `snap`, `rank{list}`, `error{error,fatal?,auth?}`.

## Flow
1. Client signs up/logs in over HTTP (`public/account.js`), gets a 64-hex token, opens `/ws/<channel>`, sends `join{token}`.
2. Room → vault `auth` (token → id) → `pid=pidFor(id,server)`; a second socket for the same pid kicks the first; full channel (`meta.maxPlayers`) refuses.
3. Vault `load`: no record → `need_char` → client sends `{t:"create",name,look}` (the only action allowed without a character; `validName`, `newChar`) → vault `create` claims the name (unique per server).
4. `enter` → `logic.addPlayer` (runs `migrate`) → `welcome` with `defs()`; `startClock` sets the alarm.
5. Every `TICK_MS`=100 ms: `logic.tick(world, now)` → per live socket `viewFor` → `endTick`.
6. Saves (non-blocking `waitUntil`): every `SAVE_MS`=15 s all live chars; otherwise at most 1×/`SAVE_SOON_MS`=1 s only the pids from `logic.takeSaves` (players flagged `p.save` by `saveSoon`: after actions in `SAVE_SOON` (applied in 75-apply.js ~L567) and explicit calls in 45-jobs/46-bag/64-dim/64-housing). Vault `save` also refreshes rank (top 20 by `lvl`, then `xp`=`xpt`) and `m:` summaries.
7. Close/error → `leave` → `removePlayer` (returns `exportChar`) → vault `save` with release.
8. `gcreate` is special: validate → vault `guild` name claim → re-validate → apply (the await lets other frames in).

## Sheet versioning (`newChar` writes `v`; current **v: 11**)
`migrate(ch)` runs on every `addPlayer`, is idempotent, clamps everything, ends `ch.v = max(ch.v, 11)`. What each version added:
- ≤v6: base fields (inv/eq/q/bq/mk/guild/fish, wp, seen, ach, cnt, daily, tut, wh, pet, scr, opt, qs) — all re-normalised on every load.
- v7 `cos` (wardrobe, `cosClean`) · v8 `sq` (editor side quests, `sqClean`) · v9 `wp` = `{mapId: stone bitmask}` (was a map list) + `dim={day,n}` (rift clears today)
- v10 `bagCap` 40..100 step 5 (`bagClean`, 46-bag.js; old bags were 30) + `house` (`houseClean`, 64-housing.js)
- v11 jobs/stats: `job lvl xp xpt st wm rs sw` (`cleanJobs`, 45-jobs.js). A four-class sheet (`cls`, no `job`) goes through `migrateV10`: level 4L−3, stats re-allocated, training/skill spend refunded, free reset (`rs`,`sw`). `JOB_ALIAS` maps old class → job for summaries/rank rows lacking `v`.
- Also in `migrate`: `OLD_ID` renames, `w_ranger_*`→`w_lancer_*`, single `acc` slot → ring/amulet, `weapon2` slot.

`exportChar(S,pid)`: copies live pos/hp/mp into the sheet; inside a runtime instance (map not in `MAP_META`: rift, house) it saves the town (house: its door via `homeExit`); returns the same `ch` object, clears `p.save`.

## Invariants / gotchas
- New sheet field ⇒ default in `newChar` AND clamp in `migrate`, bump `v`, add an old-sheet case (`content.mjs`/`wardrobe.mjs`).
- `logic.d.ts` / `accounts.d.ts` must follow export changes; `logic.js` is generated.
- The world lives in memory only; a channel with nobody live drops it (runtimes, drops, fires are lost by design).
- The vault is a single DO: keep `save` batches small; it never reads the world.
- Channel switch = leave + join (lock released on leave, else 40 s). Playtest `dev` join only when `PLAYTEST=1` and `HF_ENV!=prod`.

## Tests
`accounts.mjs` (vault logic with fake store, throttles, legacy adoption, client contract) · `content.mjs` (old sheets, `v`==11, long game) · `wardrobe.mjs`, `data.mjs` (sheet fields) · `jobs.mjs` (`migrateV10`) · `housing.mjs` (house/bag fields) · `sim.mjs` (smoke).
