# Antigravity (Gemini) assets: quality check and install

All files viewed at 6-10x on a contact sheet. Heroes are still 32 px in `main` (`wardrobe.js SZ = 32`), so the 64 px cosmetic packs cannot be used yet.

| pack | files | verdict | reason | where used |
| --- | --- | --- | --- | --- |
| gear-sets | 8 icons 16x16 (veil_/bloom_ h a r n) | INSTALL | crisp, 9-10 colours, outline, readable, items already exist | `icon.item.veil_*` / `bloom_*` in manifest -> `public/assets/gear/...` |
| porcelain | weapons_porcelain.js + 7 icons | INSTALL (as code) | sprites and icons look good and fit the GRIP; code draws icons, so PNGs are not installed | one cosmetic `ws_porcelain` (wire 129, shop 8000 G, rare): weapons.js motif `porcelain` hands over to the module for all 7 kinds |
| coop-diner | 6 icons 16x16 | NEXT (art good) | no UI slot uses item icons yet (coop.js draws its own 8x7 station icons) | not installed |
| neon-crystal | 6 armor icons 16x16 | NEXT (art good) | needs ITEMS rows with tier / source decided by owner | not installed |
| cosmetics-64 | 8 layers 64x64 + 8 icons | NEXT | layers are single-frame fragments for a 64 px rig `main` lacks; wire codes 109-116 proposed are already taken (max now 129) | not installed |
| oasis-night, windlantern-back | modules + 64 layers + icons | NEXT | same: need the 64 px wardrobe renderer; renumber codes (taken 117-123) | not installed |
| sword_sheet_01.png | ChatGPT sheet, not Antigravity | skip | already reviewed by Codex | - |

Notes: `import-art.mjs --install` rewrites the manifest and drops `bgmLocal` (breaks `bgm-recordings` test); I restored it by hand. Fix `writeManifest` to keep unknown keys.
Tests: wardrobe cosmetics looks growth pass; full suite 55/56, the one failure was the manifest above (now fixed); data-check passes.
Contact sheet: main checkout `game/shots/assets-installed.png`.
