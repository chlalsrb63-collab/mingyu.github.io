---
name: tales-tales-sfx
description: Use when designing, auditing, refining, or adding sound effects (SFX) — especially weapon swings, hit impacts, crits, finishers, skill blasts, boss attacks, or tactile UI foley — in `game/public/audio.js` for Tales Tales. Enforces 4-layer foley synthesis, waveshaper saturation, swell-shaped swings, loudness hierarchy, and automated acoustic auditing.
---

# Tales Tales Pro SFX & Foley Design Skill

This skill governs all sound effect design and refinement in `game/public/audio.js`. Its goal is to make every sword cleave, hammer crunch, dagger slice, bow twang, spell burst, and UI click feel **visceral, tactile, and unmistakable** over BGM—never flat, thin, or "synthesizer-beepy."

---

## 1. Core Acoustic Architecture

### A. Master & Saturation Bus (`Sound.init`)
Pure `sine`/`triangle` oscillators and dry filtered noise sound polite and thin on laptop speakers. Always route combat transients and impact bodies through a gentle **soft-clipping waveshaper (`this.drive`)** feeding `this.sfx`:
- `this.drive`: `WaveShaperNode` with a smooth hyperbolic tangent curve (`tanh(2.4 * x)`) and `oversample = "2x"`, attenuated slightly (`driveOut` gain ~`0.78`) so it adds warm mid-range harmonics and punch without harsh digital clipping.
- Use **clean bus (`this.sfx`)** for UI chimes, airy tails, and pure musical intervals.
- Use **driven bus (`this.drive`)** for weapon impacts, steel bites, crits, finishers, heavy swings, and explosions.

### B. Synthesis Primitives (Use Resonant & Envelope-Shaped Builders)
In `game/public/audio.js`:
- `tone(type, f0, f1, dur, vol, when, driven)`: Pitch-swept oscillator. Pass `driven = true` for saturated punch.
- `noise(dur, vol, fc, type, when, fc2, q, driven)`: Filtered noise with optional filter resonance `q` (default `1`; use `q = 3..6` for metallic blade edges and resonant air whooshes).
- `whoosh(dur, vol, fc0, fc1, peakAt, q, when, driven)`: Attack-peak-release shaped noise sweep (`0.001 → vol` at `dur * peakAt`, then exponential decay). **Mandatory for heavy weapon swings** so air pressure accelerates through the arc instead of clicking flatly at `t = 0`.
- `steel(f0, dur, vol, when, spread)`: Metallic ring generator using **2–3 non-integer inharmonic partials** (`1.0`, `1.47`, `2.19` or similar) with slight downward pitch bend. Never use a single pure sine wave for steel!

---

## 2. The Mandatory 4-Layer Foley Impact Stack

Every combat impact (`hit`, `crit`, `finisher`, `arrow_hit`, `magic_hit`, `hammer_land`, heavy skill hits) MUST be built from **four distinct acoustic layers**:

| Layer | Window | Purpose | Technique |
| --- | --- | --- | --- |
| **1. Transient Snap** | `0 – 18 ms` | Cuts through BGM so impact registers on frame 1 | Short highpass/bandpass noise burst (`12–24 ms`, driven) + fast high-to-mid pitch-drop (`0.5` pulse or `triangle`, `25–45 ms`) |
| **2. Weapon Material Body** | `6 – 95 ms` | Communicates *what* hit *what* (steel cleave vs blunt crush vs arcane shatter) | Resonant bandpass noise sweep (`Q 2.5–5`) + weapon-specific harmonics/inharmonic `steel()` partials, driven |
| **3. Sub-Bass Weight** | `0 – 150 ms` | Physical chest-thump / "손맛" (audible on small speakers via saturation) | Driven `sine` pitch drop (`115→34 Hz` heavy, `155→68 Hz` light) |
| **4. Tail & Glint** | `25 – 220 ms` | Follow-through, crit reward, and anti-fatigue variation | `vary()` (±5–7% micro-pitch), subtle steel shimmer on crits, extended air/debris tail on finishers |

---

## 3. Weapon Acoustic Profiles (7 Weapons)

Each weapon must be blind-test recognizable from its swing and hit alone:

1. **대검 (`sword`) — Heavy Cleaving Steel**
   - *Swing*: Deep accelerating air-displacement swell (`lowpass 260→620→140 Hz`) + resonant blade-edge slice (`whoosh` `Q 3.5`, `480→2900 Hz`) + heavy iron weight drop (`triangle 165→58 Hz`, driven). Finisher/heavy beat (`fin`): wider, lower, angrier steel tear + brief metallic draw glint.
   - *Hit*: Driven flesh/armor cleave (`bandpass 2400→680 Hz`, `Q 2.4`), crisp steel-bite (`steel(1850)` + `2720 Hz` inharmonic ring, clearly audible!), meaty sub-thump (`118→38 Hz`, driven), and sharp 18ms snap.
2. **단검 (`dagger`) — Razor Twin-Edge Flick**
   - *Swing*: Ultra-snappy high-Q steel whistle (`whoosh`, `3200→6800 Hz`, `Q 4.5`, `55 ms`) + tight dry cloth-flick (`1400→2600 Hz`).
   - *Hit*: Needle-sharp metallic slice (`bandpass 5400→2200 Hz`, `Q 3.2`), crisp high `steel(3100)` ping, tight punchy knock (`175→78 Hz`, `65 ms`).
3. **창 (`spear`) — Piercing Iron & Hardwood Shaft**
   - *Swing*: Focused directional lance-whip (`whoosh`, `950→3800 Hz`, `Q 3.8`) + rising shaft tension (`triangle 260→460 Hz`).
   - *Hit*: Sharp armor-pierce transient (`highpass 3200 Hz`), hollow shaft knock (`triangle 340→115 Hz`, driven), focused iron tip-ring (`steel(2050)`), solid mid-low punch (`112→48 Hz`).
4. **해머 (`hammer`) — Crushing Blunt Mass**
   - *Swing*: Heavy wind-up air groan (`whoosh` lowpass `220→680 Hz`, `Q 1.8`) + heavy handle grunt (`triangle 150→72 Hz`).
   - *Hit / `hammer_land`*: Massive driven sub-thump (`96→34 Hz`), bone/stone crunch (`bandpass 980→280 Hz`, `Q 2.2`, driven), secondary debris/ground rattle on heavy slams (`kind 131`/`132`), minimal delicate high-ring.
5. **지팡이 (`staff`) — Arcane Crystal Resonance**
   - *Swing*: Crystalline harmonic swell (`sine` + `triangle` fifth `440→880 Hz` & `660→1320 Hz`) + airy mana-sparkle sweep (`whoosh`, `2600→5400 Hz`, `Q 3.0`).
   - *Hit (`magic_hit`)*: Glassy crystal shatter (`steel(1680)` bright) + arcane crackle burst (`bandpass 3800→1100 Hz`) + warm resonant mana bloom (`280→85 Hz` driven).
6. **마도서 (`book`) — Parchment Snap & Sealed Runes**
   - *Swing*: Crisp double-page flutter (`bandpass 2400→1100 Hz` + `3200→1500 Hz`, `Q 2.5`) + sealed rune chime (`triangle 784→1175 Hz`).
   - *Hit (`magic_hit(true)` / `hit("book")`)*: Dry ink-seal pop + resonant arcane chord burst + tight sub-pulse.
7. **활 (`bow`) — Taut Bowstring & Feathered Arrow**
   - *Swing (`bow_draw` / `bow_shot`)*: Creaking wood tension on draw; snapping bowstring twang (`triangle 230→98 Hz` driven + `0.5` pluck overtone) + crisp string-slap transient + whistling feathered arrow (`whoosh` `1400→4800 Hz`, `Q 3.5`).
   - *Hit (`arrow_hit`)*: Crisp arrowhead bite (`bandpass 3400→1200 Hz`, `Q 2.8`, driven) + woody shaft thwack (`triangle 780→310 Hz`) + tight flesh thunk (`165→68 Hz`).

---

## 4. Loudness Hierarchy & Anti-Fatigue Rules

1. **Dynamic Tiering**: Within the same weapon, perceived punch MUST step up cleanly:
   `swing` < `graze` < `hit` < `finisher` < `crit`
2. **Crit Signature**: Every `crit(wk)` adds:
   - Higher transient bite (`+25%` frequency & drive)
   - Deeper sub-impact (`86→32 Hz`, `150 ms`)
   - Unmistakable **crystalline steel glint** (`steel(2800)` + high harmonic flash at `+14 ms`)
3. **Finisher Signature**: Every `finisher(wk)` adds:
   - Wider, heavier body cleave/crush with extended follow-through tail (`+45–80 ms`)
   - Secondary impact echo/shatter at `+22 ms` so the combo closer feels decisive
4. **Anti-Fatigue**:
   - Always call `this.vary()` for pitch jitter on repeated combat sounds.
   - Keep `THROTTLE` entries tight enough for rapid attacks (`0.03–0.05 s`) while preventing chorus flanging on simultaneous multi-target hits.
   - Never exceed `MAX_SFX` voice budget with bloated 15-oscillator stacks — aim for **4–7 voices per impact** (smartly layered beats brute force).

---

## 5. Mandatory Verification Workflow

After ANY edit to `game/public/audio.js`, ALWAYS run the automated SFX audit script:

```powershell
node .agents/skills/tales-tales-sfx/scripts/sfx-audit.mjs
```

The audit verifies:
1. **Zero synthesis errors**: Every SFX key in `SFX` executes cleanly (including weapon/rarity/boss arguments).
2. **Zero missing references**: Every literal `Sound.play("...")` across `game/public/*.js` exists in `SFX`.
3. **Acoustic & Hierarchy Checks** (for all 7 weapons):
   - Voice count within budget (`<= 10` per single trigger)
   - Presence of transient + body + low-end layers on combat impacts
   - Weighted energy hierarchy: `swing < hit < finisher` and `hit < crit`
   - No zero-gain or invalid exponential ramp targets (`<= 0`)

---

## 6. Optional Hybrid Foley Extension

Default SFX are 100% code-synthesised Web Audio (`0 KB` download, `0 ms` latency). If a future task explicitly calls for recorded/external foley layers (`.ogg`/`.wav` sword-clash or heavy impact samples):
1. Normalize short clips (`<= 400 ms`, mono, `-1 dBTP`, trimmed silence) into `game/public/assets/sfx/`.
2. Register under `sfx` in `game/public/assets/manifest.json` and log licence/source in `asset/CREDITS.md`.
3. Keep the Web Audio synthesis as an automatic fallback so offline/instant playback never breaks.
