# 작업 레시피 — task recipes (which files to touch)

Moved out of `AGENTS.md`; read the one recipe your task needs.

**Add a monster**
1. `src/logic/10-tables.js` `MOBS`: `key: { name:"한글", lv, hp, atk, def, spd, xp, gold:[a,b], aggro, range, cd, …moves }`
   (moves: `charge leap slam pool fan`, `fly`; `sp`/`tint` reuse another body in another colour).
2. Spawn it: the map cfg `mobs:[…]` in `src/logic/34-maps-world.js GEN` (and `FIELD_BOSS`/
   `QUESTS`/`REGION_BONUS` if relevant).
3. Art: a `BEASTS_*` entry in `public/mobart_a|b|c.js` (zone file) using `mobart_kit.js` parts; add it
   to the zone list in `public/_mobs.html`.
4. `npm run test:rules` (mobart checks every mob has a model that fits; maps/world check spawns),
   then `node scripts/shot.mjs --page mobs --q "k=<key>&z=4"`.

**Add an item**
1. `src/logic/10-tables.js` `ITEMS` (`type`: pot food fish scroll buff camp revive pet mat rune or gear);
   sold? add to `SHOP`. Gear tiers come from `GEAR`.
2. Behaviour: `case "use"` in `70-validate.js` and `75-apply.js` (or the relevant system); drops in
   `50-loot-combat.js lootFor`.
3. Icon: `public/art.js buildIcons` (by type/id). Quick-slot-usable types: `QS_USE` in 40-characters-world.
4. Test in `tests/loot.mjs` or `growth.mjs`.

**Add a skill**
1. `src/logic/03-skills.js SKILL`: `id: { kind: "a"|"p"|"j"|"h", wk, job?, need, name, mp, cd, mult, …, fx, desc }`
   (Korean name/desc; a skill belongs to a weapon at a mastery level, or to a job). Its place in `SKILL` is its order.
2. Behaviour: `case "<id>"` in `57-weapon-skills.js castSkill` (hits through `hit(mob, mult)`, lingering things
   through `prop({kind, wire, …})` + a `propPulse` case); emit a new fx code with the local `ev(code, x, y, extra)`.
3. Client: visuals/sound for that code in `public/skillfx.js cast` (props: `placeProp`/`propBeat`); icon glyph in
   `public/skillicons.js GLYPH` (`_icons.html` previews; `_feel.html?rows=sk<code>` plays it); new sound in `audio.js SFX`.
4. `tests/skills.mjs` (casts every skill and checks its fx code), then `tests/balance.mjs`.

**Add a map set piece**
1. Rows in `src/logic/30-maps-overworld.js PIECES` using the `PIECE` legend (`*` chest, `#` fire …).
2. Use it: add the name to a map cfg's `vaultKinds` or `features` in `34-maps-world.js`.
3. New tile/object character? solidity (`SOLID_G` in 20-helpers-mapkit; any object blocks), drawing in `public/scene2d.js`
   (scenery sprites) / `iso_tall.js` / `iso_ground.js`, minimap colour in `art.js renderMini`,
   preview colours in `_over.html`.
4. `node scripts/test-all.mjs maps world`, then `shot.mjs --page over --map <id>` and `--map <id>`.

**Add a UI window**
1. Markup: `<section class="window" id="w-<id>" hidden>` in `public/index.html` (copy one) + a
   `#menu button[data-win="<id>"]` with a `uiicons.js MENU_ICON`.
2. `public/client.js`: add `<id>` to `WIN`, a hotkey in the keydown switch (Korean 2-set key too, e.g.
   `case "u": case "ㅕ":`), a `render<Id>(s)` registered in `refreshUi()` as `draw("<id>", () => [deps…], render<Id>)`; styles in `public/hud.css`.
   Keep the `header` + `.body` shape: hud.css then caps it to the safe zone (`--win-max` for a wide one) and scrolls the body;
   `placeWin` places it beside open windows or folds them.
3. Data it needs: `selfPayload` in `90-views-api.js` (send only when dirty) or `defs()`; actions via
   `act({t:…})` + validate/apply cases.
4. `shot.mjs --live --keys <key>`.

**Add content with the editor data files** (`game/data/`, format in `docs/editor/SCHEMA.md`)
0. Normally the owner does this in the editor (`npm run editor`). Changing the editor: drive it with
   Playwright against a copy (`EDITOR_DATA=<scratch copy of data> npm run editor`), never the real data.
1. A map: `data/maps/<id>.json` (new id, or `"replaces": "<built-in id>"`; start from
   `editor-lib.mjs mapToEditor(id)`); doors in its `portals` + an entry in `links.json` for the way in.
2. NPCs on built-in maps: `npcs.json`; side quests: `quests.json` `side` (giver = an NPC with role
   `quest`); `main` replaces the main chain. No rules code needed.
3. `npm run data:check`, then `npm run test:rules` (rebuilds logic.js; commit data + logic.js together).
   Playtest: `npm run dev:local`, open `http://localhost:8787/?dev=1&map=<id>&x=<tx>&y=<ty>`.

**Add a sound / music**
- Effect: a function in `public/audio.js SFX` (synth: `this.tone`, `this.noise`), optional level in
  `BOOST`, rate limit in `THROTTLE`, priority in `IMPORTANT`; play with `Sound.play("name")`. Server-driven sounds are
  played from event handlers in `client.js`/`skillfx.js`.
- Music: a track in `audio.js TRACKS`; a map picks it with `bgm` in its cfg.
- External file instead: the External assets section below + `Assets.play(ctx, "sfx.<key>")` (fall back to the synth).

# External assets (외부 에셋)

- Library: repo-root `asset/` (Korean guide `asset/README.md`), never deployed. `incoming/` raw packs ·
  `reference/` inspiration only, gitignored, never shipped · `generated/` raw AI outputs · approved game-ready art in
  `weapons/<kind>/` (`<kind>_t<n>`, `_lg_<power>`, `_set_<set>`, `_skin_<motif>`, `icon_<kind>_…`), `gear/<type>/<id>`,
  `items/<cat>/<id>`, `monsters/ characters/ tiles/ ui/ fx/ sfx/ music/ fonts/` · `_export/` and `_preview/` are
  generated (gitignored). Gallery: `ASSETS.bat` (= `npm run art:export && npm run art:gallery`) opens `asset/index.html`.
- Licences: CC0 / public domain (preferred), CC-BY (credit shown in-game), OFL fonts, paid licences that allow
  commercial use + redistribution in a game. Not allowed: NC, no-redistribution, unclear. AI images: tool terms must
  allow commercial use; never prompt for a living artist's or another game's style. One line per pack/batch in
  `asset/CREDITS.md` — `--install` refuses files it does not mention.
- Pipeline: `node scripts/import-art.mjs <img> --kind sword --tier 3 [--icon]` (or `--split --names …`, `--category
  items/potion --name hp_s --size 16x16`) detects the pixel grid, samples, removes the background, reduces the palette
  (`--colors`, `--palette game`), cleans specks, adds the `#2b2233` outline, places on the game canvas (world weapon:
  points right, hand at GRIP [5,16]; icons 16×16), writes `asset/…` + `asset/_preview/<name>.compare.png`. After owner
  approval: `--install <files>` → `public/assets/…` + manifest key + cache tag; `--uninstall <key>` reverts.
- Code: `Assets.canvas("key") || drawnInCode()` (weapons.js, art.js buildIcons already do); keep the code path.
  Prompts for weapon art (Codex code-drawn = preferred, ChatGPT image = concept/rough): `ai/prompts/weapon-assets.md`;
  cosmetics (hats, tops, backs, face pieces — rules, anchors, preview, test): `ai/prompts/cosmetic-assets.md`.
