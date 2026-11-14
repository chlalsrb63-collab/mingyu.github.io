# Wire protocol, actions and the client

> Jobs/skills (J2), life (L1) and the town redesign are changing these right now — see `docs/design/README.md`.
> Treat skill/job fields (`lc skm cr cds wm …`) and town-tied UI as in flux; the mechanisms below are stable.

Purpose: how intents reach the rules and how state reaches the screen: action validate/apply, the 10 Hz
snapshot (`viewFor`), `defs()`, and the plain-ES-module client (`client.js`, windows, renderer, radar).

## Key files / functions
| symbol (file) | role |
| --- | --- |
| `parseClientMessage` (`src/protocol.ts`) | frames ≤16 KiB, action ≤4 KiB, token ≤128; types `join` `action` `reset` |
| `validateAction(S,pid,a)` (`logic/70-validate.js`) | one `case a.t`; returns `{ok}` or `{ok:false,error}` (Korean text). Helpers `bad OK npcNear goodsNear fireNear enhCost` |
| `applyAction(S,pid,a)` (`75-apply.js`) | same cases, mutates; ends with `SAVE_SOON` → `saveSoon`; `afterGear` recomputes after equipment changes |
| `tick(S,now)` / `endTick(S)` (`80-simulation.js`) | world step; `endTick` clears `rt.ev`, `rt.who`, `S.chat` after all snapshots are sent |
| `viewFor(S,pid)` (`90-views-api.js`) | builds one player's `snap`; also `selfPayload(p)` (own sheet), `mapPayload` (34), `dimView` (64-dim), `homeSelf` (64-housing) |
| `defs()` (`90-views-api.js`) | static tables sent once in `welcome`: `items mobs skills shop quests enh bag house jobs stats scale grade wm* affix runes runewords rarity slots wkinds legend sets mastery waypoints cos* achievements collection event daily tutorial side sky dim maps(+`to` routes) …` — the client duplicates no rules |
| `client.js` (3 091 lines; FILEMAP's 2 563 is stale) | banners (`grep -n "^// ───"`): connection L58 · state `G` L118 · messages `onSnap` L276 · effects · input L631 · player actions L845 · update L1020 · render L1220 · HUD & windows L1454 · title · main loop L3072 |
| `public/radar.js` | radar (side column, player-centred, `ZOOMS`) + map window `#w-map` (current map, world route map from `defs.maps[].to`); fed by `G`, `Art.renderMini` texture; `Radar.init(deps)`, `loadMap`, `draw`, `drawWin`, `opened` |
| `public/scene2d.js` (3 003) | renderer; banners: drawing tools · scenery · ground L683 · ambient life · creatures · effects L1774 · pets · the frame L2401 · title/creation L2959 |

## Snapshot (`type:"snap"`) — positional arrays, append new fields at the END
| field | content |
| --- | --- |
| `me` | `[x, y, hp, mp, dead, fix, dir, sit, flags, crValue, aim]` — `fix=1` ⇒ client must take server x,y |
| `P` | other players near (±`VIEW_X/Y`=280 px): `[eid,x,y,dir,dead,hp,mhp,sit,flags]` |
| `M` | mobs near: `[id,k,x,y,dir,hp,el,traits[,marks]]` |
| `D` | drops visible to you (own or past `freeAt`): `[id,it,x,y,q]` · `F` fires `[id,x,y]` · `fb` field-boss/event-lord positions for the radar `[[x,y]]` (map-wide) |
| `ev` | events of your map this tick (`rt.ev`, shared): `a` attack, `h` hit, `k` kill, `r` spawn, `u/e` fx, `f` fishing, `wp` warp, `rc` recall, `tl` tale, `j` jam, `ac` achievement, `wd` wind, `t`/`b` telegraph/zone, skill codes 40–75, `dm dp dz` rift |
| `chat` | `{m,n?,sys?,g?,pt?}` filtered for guild/party |
| `party` `[eid,name,job,lvl,hp,mhp,mapName,x,y,mapId]` · `pinv`, `ginv` invites |
| `map` | `mapPayload` — only when `p.sendMap` (arrival, map change) |
| `who` | everyone on your map (look, gear, guild, title, outfit…) — only when `p.sendMap` or `rt.who` |
| `dn` | `[weather, serverSecs]` on arrival / weather change / every 60 s |
| `self` | `selfPayload` — only when `p.dirty`; client sets `G.self` and calls `refreshUi()` |
| `gain`, `toast` | one-shot lists: `["gold",n]`, `["item",id,n,q]`; strings |
| `dim` `rc` `dj` | rift (see `rift.md`); `home*` housing (`Housing.onSnap`) |
Each player sees only their map. Big/rare data ⇒ `defs()`, `map`, `who` or `self` (dirty flags), never every snapshot.

## Action flow
1. Client `act({t,…})` → `ws.send({type:"action",action})` (`client.js` L113). Walking: `{t:"mv",x,y,d,a}` at most every 90 ms when changed; client predicts own movement.
2. `room.ts` → `validateAction` (fail ⇒ `{type:"error",error}` except silent for `mv`/`atk`) → `applyAction`.
3. Server `mv`: max step = `spd·dt·1.6+8`, `canStand`; failure sets `p.fix` so the next `me[5]=1` snaps the client. Stepping on a portal tile triggers `changeMap`.
4. `applyAction` sets `p.dirty = true` (→ `self`), pushes `rt.ev`, `p.gain`, `p.toast`; `saveSoon` for persistent progress.
5. Next alarm: `tick` → `viewFor` per socket → `endTick`.
Action types (grep `case "` in 70-validate): respawn opt look chat p*/g* (party/guild) qs sort emo cos_* title daily tut mv atk warp sk use eq uneq rune train sklv wh sellall buy sell enh sit fish hook reel cook salv bq quest sq job_change bag_expand house_*/furn_*/h_* dim_* (+ `create` `rank` `gcreate` handled in `room.ts`).

## Client state and flow
- `G`: `playing you defs icons self map me{x,y,dir,aimI,hp,mp,dead,…} who players mobs gone drops fires party pinv path auto sel …`; entity maps are reconciled by `sync(map, rows, apply, t)` (first field = id; missing ⇒ removed, mobs go to `G.gone` 1.5 s for death anims); positions ease toward `tx,ty` (`k=min(1,dt·14)`).
- `onSnap(s)` order: `map` → `dn` → `me` → `who` → `P F M D` → `SkillFx.onSnap` → `self` (+`refreshUi`, `Growth.onSelf`) → `ev` (impact-delayed `onEvent`) → `chat` → `gain` `toast` → `party` → `Dim.onSnap`, `Housing.onSnap` → `hudBars`.
- `onEvent(e,t)`: tries `SkillFx.skillEvent`, `Dim.onEvent`, `Housing.onEvent`, `MobArt.onEvent`, then a local switch.
- Main loop `frame()`: `update(dt,t)` (input, prediction, `mv` send, auto-hunt) → `render(t,dt)` (→ `scene2d.render(focusX,focusY,dt,t,snap)`, `S3.sync(G)` first) → `Radar.draw/drawWin` → `hudTick`; lobby when not playing.
- Windows: `WIN` list (inv char skill shop smith quest rank talk help settings train party guild warp daily achieve collect bank costume dim rc map house deco hstore); `openWin/closeWin/toggleWin/closeTop/closeAll`; markup `section.window#w-<id>` in `index.html`; `draw(id, keyOf, fn)` re-renders a window only when `JSON.stringify(keyOf())` changed (`shown[id]`), called from `refreshUi()`; `inv` is docked and always "open". Placement: `zone()` = safe rectangle (viewport minus side column/dock, 4 px edge, minus tab strip), `homeOf(id)` default spot, `placeWin` (saved position → beside open windows → one row → else `fold` the covered into tabs `layTabs`), `keepIn`, `front`. Position persisted in `localStorage lumentale:win2:<id>`.
- Layout: `layout()` sets docks (`sideW` 288/256, `dockH` 160–224) and CSS vars `--vpw --vph --zone-w --zone-h`; `VP.lay` = full | land | phone-portrait. Cache tag `?v=` in `index.html` (bump on every `public/` change).
- Automation: `window.__game = {G, act, S3, go, openWin, closeWin, closeAll}`, `window.__dim`.

## Invariants / gotchas
- Never trust client numbers: new action ⇒ `validateAction` case + `applyAction` case + (if progress) `SAVE_SOON`.
- New snapshot field: append at the end of the array/object, decode in `onSnap` in the same commit, document here. New static table ⇒ `defs()`.
- `rt.ev` is per map and shared by everyone there: never put per-player secrets in events (use `self`/`toast`).
- Window needs data ⇒ add to `selfPayload` and to the `draw()` key list or it will not refresh.
- `self.cls` is synthesised from `self.job` on the client (legacy name); `lc`/`skm` are the old-class bridge until J2.
- Client JS is not type-checked: after edits load once with `node scripts/shot.mjs --live` and read page errors.

## Tests
`sim.mjs` (smoke of tick/viewFor/actions) · `party.mjs` · `hotbar.mjs` (quick slots, chat) · `aim.mjs`/`feel.mjs` (action→effect paths) · `accounts.mjs` (HTTP/client contract) · `data.mjs` · `housing.mjs` (home wire) · `dimrift.mjs` (`dim rc dj` wire). No client unit tests; visual checks via `scripts/shot.mjs`.
