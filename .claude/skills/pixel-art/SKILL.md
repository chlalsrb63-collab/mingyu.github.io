---
name: pixel-art
description: Pixel-art rules for drawing or reviewing sprites, tiles, terrain, monsters, props, VFX and UI icons. Use before drawing or changing any pixel art in game/public/sprites.js, scene2d.js or art.js, and when laying out a map.
---

# Pixel art

The rule set under `rules/` comes from the MIT-licensed
[with-pebbly/aseprite-ai-artist](https://github.com/with-pebbly/aseprite-ai-artist)
(commit 9def814; licence in `LICENSE-aseprite-ai-artist`). Its MCP server drives
Aseprite, which is not available here: this game draws every sprite in code, at
runtime, on small canvases. So the tool calls in those files (`draw`, `look`,
`validate`, `tileset` …) do not apply — the rules, size budgets, templates and
review lists do. Read the file for the subject before drawing it.

## How to apply them in this project

- **The loop** is the same with different tools: decide → draw in code → render a
  preview page (`game/public/_sheet.html`, `_scene.html`) → *look at the
  screenshot* → fix. Never judge a sprite from its code.
- **Write the constraints down first**: canvas (characters fit 16×16 inside a
  32×32 sheet, tiles are 32 px), palette, light from the upper left, one-pixel
  dark outline, top-down three-quarter view.
- **Shadows shift hue**, they do not just get darker: use `shade()` in
  `sprites.js` (toward violet), highlights toward yellow.
- **Ground is background**: three colours per surface with the mid tone
  dominant, clusters of 2+ pixels that never touch, a busy and a quiet variant,
  and unique features (a lone rock, a flower) on overlays, never in the
  repeating tile.
- **Transitions** between terrains get a boundary pass: dark outline on the
  upper terrain's edge, light rim on north/west edges, a one-pixel shadow on
  the lower terrain to the south and east.
- **Rocks** are three flat planes (lit top, mid front, dark side) in odd groups
  of mixed sizes, each on a short contact shadow.
- **Monsters**: one dominant shape, one identifying element, danger at the
  extremities, a visible weakness.
- **No semi-transparent or anti-aliased pixels, no isolated specks, no
  near-duplicate colours.**

## Where to look

| Subject | File |
|---|---|
| Principles, what makes art look generated | `rules/00-core-principles.md`, `rules/92-generated-art-tells.md` |
| Palette, shading, outlines, clusters | `rules/01` – `04`, `rules/10` – `14`, `rules/20` – `24` |
| Characters, faces, views | `rules/30` – `38` |
| Animation: idle, walk, attacks, top-down | `rules/40` – `47` |
| Animals, small creatures, monsters | `rules/50` – `54` |
| Skies, terrain, trees, water, ground, tiles, buildings | `rules/60` – `67` |
| Perspective, props, vehicles | `rules/70` – `75` |
| Fire, impacts and game feel, particles, UI icons, fonts | `rules/80` – `84` |
| Platform styles, composition, review checklist | `rules/90` – `91`, `rules/07-review-checklist.md` |
