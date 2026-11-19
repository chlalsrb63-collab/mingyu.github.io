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

## 3. Mandatory Craft Loop (Never Ship Draft 1)

Every icon or sprite batch MUST go through at least **2 visual refinement passes**:

1. **Draft & Render**: Render a contact sheet using `game/scripts/pixcanvas.mjs` showing **Before (4×)**, **After (4×)**, and **Actual In-Game Slot Size (1×)** on the game's dark inventory slot background (`#362d42`).
2. **Run Pixel Linter**: Run `.agents/skills/tales-tales-pixel-art/scripts/pixel-lint.mjs` on every icon to detect margin clips, orphan pixels, outline doubles, and low contrast.
3. **Visual Self-Inspection (`read_file`)**: Open the rendered PNG with `read_file` and inspect EVERY icon at both 4× and 1× against:
   - Silhouette clarity at 1×
   - Proportions & heroic readability
   - Smoothness of curves (jaggies / doubles)
   - Material distinction (steel vs gold vs leather vs gem)
4. **Polish Pass**: Fix every flaw found in steps 2–3, re-render, and re-inspect with `read_file` before presenting to the user or committing.

## 4. Hybrid External/AI Asset Option

When intricate crests, ornate uniques, or painterly portraits exceed pure code-drawn geometry, follow `AGENTS.md` §4.7:
- Generate reference/draft in `asset/<category>/` → normalize to 32×32 via `game/scripts/import-art.mjs` → pixel-cleanup & lint → get owner approval → `--install` and record provenance in `asset/CREDITS.md`.
