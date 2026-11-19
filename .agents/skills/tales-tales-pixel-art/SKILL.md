---
name: tales-tales-pixel-art
description: Use when designing, auditing, refining, or replacing pixel art icons, equipment icons (gear_icons.js), weapon sprites, wardrobe cosmetics, or UI pixel assets for Tales Tales. Enforces pro pixel-art rules, sel-out colored outlines, hard-material ramps, automated pixel linting, and mandatory 4x+1x visual self-inspection loops.
---

# Tales Tales Pixel Art & Icon Craft Skill

This skill ensures every pixel-art icon, weapon, and equipment sprite crafted for **Tales Tales** meets cohesive retro-MMORPG (GBA / MapleStory / TalesWeaver) studio quality instead of rough procedural shapes.

## 1. Mandatory Reference Rules (Read Before Drawing)

This repository includes a comprehensive pixel-art manual in `.claude/skills/pixel-art/rules/`. Read the relevant files before authoring pixels:
- **Equipment & Props**: `.claude/skills/pixel-art/rules/73-props-and-items.md`
- **Icons & UI Readability**: `.claude/skills/pixel-art/rules/83-ui-and-icons.md`
- **Outlines, Jaggies & Banding**: `.claude/skills/pixel-art/rules/04-outlines-and-edges.md`
- **Hard Materials (Steel, Gold, Gems, Glass, Wood)**: `.claude/skills/pixel-art/rules/22-materials-hard.md`
- **Soft Materials (Cloth, Leather, Fur)**: `.claude/skills/pixel-art/rules/23-materials-soft.md`
- **Final Audit Checklist**: `.claude/skills/pixel-art/rules/07-review-checklist.md`

## 2. Tales Tales 32×32 Equipment Icon Standards

1. **Silhouette First (1× Readability Test)**:
   - Every icon must be instantly recognizable at **1× (32×32)** as a single flat silhouette.
   - **Never overlap two cluttered objects** (e.g., two tangled gloves or two merged boots) into a single unreadable lump. Draw one heroic, well-proportioned angled gauntlet or greave boot with unmistakable anatomy.
   - Maintain a **2 px breathing margin** around the 32×32 frame (art sits cleanly inside ~28×28) so slot borders and `+10` enhancement rims never clip the silhouette.
2. **Consistent Top-Left Light & Material Ramps (`22-materials-hard.md`)**:
   - Light ALWAYS comes from **upper-left**.
   - **Steel**: cool blue-grey lights, darker plum-navy shadows, 3–4 crisp hard-edged bands + tiny specular (`#181425 #262b44 #3a4466 #5a6988 #8b9bb4 #c0cbdc #eef5fc` + `#ffffff` 1–2 px glint).
   - **Gold** (never flat orange): orange-brown darks → warm golden mid → pale-yellow specular (`#3b1f14 #703c19 #a8723a #d9a742 #f0cf6e #fffad1`).
   - **Gems (Ruby / Sapphire / Emerald / Amethyst)**: flat whole-facet lighting, saturated refraction bounce on the shadow side, 1 px crisp white sparkle opposite the deepest facet.
   - **Leather / Cloth**: softer contrast, crimson/warm-brown shadow shift, no harsh white specular.
3. **Selective / Colored Outlines (Sel-out)**:
   - Avoid harsh uniform black outlines everywhere.
   - Use **dark tinted outlines on lit upper-left edges** (e.g., `#3a4466` on lit steel, `#703c19` on lit gold, `#6e2438` on lit ruby) and **deep ink (`#181425`) on bottom-right shadowed edges**.
   - Keep internal separation lines subtle (1 step darker than the adjacent fill) rather than heavy black coloring-book lines.
4. **Zero Jaggies, Doubles, or Orphan Noise**:
   - Curves must follow consistent pixel-run steps (e.g., `3-2-1-1-2-3`, never `2-1-3-1`).
   - Remove accidental 1 px isolated orphan pixels and 2×2 outline clumps ("doubles") on diagonals.
   - Break long parallel banding stripes with form bevels or subtle bounce light.

## 3. Preferred Production Pipeline: `image-generator` Sheet → Crisp 32×32 Pixel Snap

Hand-typing 32×32 ASCII pixel grids in text loses 3D proportion and silhouette grace. For equipment icons, weapons, and detailed pixel assets, use the **official hybrid pipeline** (`AGENTS.md` §4.7):

1. **Batch-Generate 3×2 Sheets (`image-generator`)**:
   - Generate 6 related items per sheet (e.g., 1 tier × 6 slots, or 1 weapon family × 6 tiers) in a clean 3×2 grid on a **flat solid bright magenta (`#ff00ff`) background** with NO grid lines, NO borders, NO drop shadows, NO text.
   - Specify classic 16-bit/32-bit Korean 2D MMORPG / JRPG pixel art (MapleStory / TalesWeaver / Chrono Trigger style), upper-left lighting, rich material highlights, dark colored outlines.
2. **Flood-Fill Chroma Key + Crisp 32×32 Downscale**:
   - Decode the generated image and flood-fill `#ff00ff` from cell borders (plus pure bright magenta interior loops) so crimson/ruby interiors are never damaged.
   - Tight-crop each item and downsample into a centered `28×28` box inside `32×32` using median/crisp pixel-art sampling (never blurry bilinear averaging) with thin-feature gold/highlight preservation.
3. **Visual Self-Inspection (`read_file`) & Install**:
   - Render a contact sheet at **4× zoom + 1× actual slot size** on `#362d42`, inspect EVERY icon with `read_file`, fix any fringe or clipped icon, then install into `game/public/assets/` + `game/public/assets/manifest.json` and record provenance in `asset/CREDITS.md`.

## 4. Fallback Code-Drawn Craft Loop (When Pure Code Is Required)

If an asset must be purely code-drawn without external PNGs, run at least **2 visual refinement passes**:
1. Render Before/After contact sheet via `game/scripts/pixcanvas.mjs`.
2. Run `.agents/skills/tales-tales-pixel-art/scripts/pixel-lint.mjs`.
3. Inspect with `read_file` and refine until silhouette, margins, and material ramps pass.
