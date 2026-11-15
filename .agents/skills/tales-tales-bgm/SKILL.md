---
name: tales-tales-bgm
description: Use when composing, revising, previewing, or integrating map BGM, title music, or event themes for the Tales Tales browser RPG. Applies to requests for 테일즈테일즈 맵별 BGM or 배경음악.
---

# Tales Tales BGM

Read [AGENTS.md](../../../AGENTS.md) for repository rules and [the music brief](references/maps.md) for the requested scene. Audition synthesized drafts with the offline Web Audio authoring tool. Integrate approved recordings for live playback.

1. Match the scene to a track key in `game/public/bgm.js`. Check `buildMaps()` in `game/src/logic/34-maps-world.js` for an unfamiliar map. `Sound.bgm` picks an exact ID before trying the map's `bgm` fallback. `title` is the lobby. `boss` and `rift` temporarily override the map.
2. Compose a melody, harmony and rhythm for that scene. With music references, use the tempo, textures and arrangement as a starting point for the original score. Record whether those observations came from audio or public descriptions.
3. Follow the pattern legend at the top of `bgm.js`. A bar takes 16 sixteenth-note steps, including rests. For example, `D5:3 F#5:1 A5:6 -:6` fills one bar. Set the repeating section order with `form`. The optional third entry in a section can vary instruments, rhythmic patterns and levels. `Sound.tick` and `Sound.inst` in `audio.js` define the supported arrangements and instruments.
4. From the repository root, render the requested tracks through the production synth:

   ```powershell
   node .agents/skills/tales-tales-bgm/scripts/render-bgm.mjs title town --style newAge --out game/shots/bgm
   ```

   Use `--style classic` to audition the original synth/lo-fi arrangement in the authoring tool. The running game plays recorded audio only. Omit the track keys to verify everything. Omit `--out` for rendering checks without WAV files. Compare adjacent scenes at 1× playback speed and listen across the loop seam. WAV previews belong in the ignored `game/shots/` directory.
5. Run `npm run stamp` for a separate preview or deployment build. The repository stamps production releases automatically. In `game/`, run `npm run test:rules` and `node scripts/shot.mjs --live` against `npm run dev:local` after wiring. Record which tracks were played, their roles, and verification results.
