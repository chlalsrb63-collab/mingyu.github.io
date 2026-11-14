/**
 * Sound, synthesised on the fly in the spirit of an old console's sound chip:
 * pulse and triangle waves, a little noise, and the odd soft pad. No audio files.
 *
 * Music: every map has its own composed loop (melody, bass, chords, drums),
 * plus a title theme, a boss theme and a rift-invasion theme. Notes are
 * scheduled a little ahead on the audio clock, and tracks crossfade.
 * Effects: a named catalogue, played through a voice limiter.
 */

// ───────────────────────────── notes and chords ─────────────────────────────

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "C#5", "Bb4", "E2" → Hz (A4 = 440). */
function hz(n) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) return 0;
  const semi = PITCH[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}
const midiHz = (k) => 440 * Math.pow(2, (k - 69) / 12);
/** "F#m", "Bb", "G7", "Bdim" → MIDI notes of the chord rooted in octave 3. */
function chord(sym) {
  const m = /^([A-G])([#b]?)(m|7|dim|sus)?$/.exec(sym);
  if (!m) return [48, 52, 55];
  const root = 48 + PITCH[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const q = m[3] || "";
  const third = q === "m" || q === "dim" ? 3 : q === "sus" ? 5 : 4, fifth = q === "dim" ? 6 : 7;
  const tones = [root, root + third, root + fifth];
  if (q === "7") tones.push(root + 10);
  return tones;
}
/** "E5:4 G5:2 -:2" → [[hz, startStep, lengthSteps], …]; rests are skipped. */
function melody(src) {
  const out = [];
  let at = 0;
  for (const tok of src.trim().split(/\s+/)) {
    const [n, d] = tok.split(":");
    const len = Number(d || 2);
    if (n !== "-") out.push([hz(n), at, len]);
    at += len;
  }
  out.total = at;
  return out;
}

// ───────────────────────────── the compositions ─────────────────────────────
// Each track: tempo, which instruments play the parts, the patterns they play
// over each bar's chord, and sections of 8 bars (chords + melody) in a form.
// Patterns are 16 sixteenth-steps per bar. Bass: R root, F fifth, O octave,
// T third, L the root an octave down, . nothing. Comp: digits pick chord
// tones (0 root, 1 third, 2 fifth, 3 octave). Drums: x hit, o soft hit.

const TRACKS = {
  // C major, 96 — the title: an open, hopeful call
  title: {
    bpm: 96, lead: "pulse25", vol: 0.11, bass: "tri", comp: "pluck", pad: false, delay: 0.18,
    bassPat: "R.......R...F...", compPat: "0.2.1.2.0.2.1.2.",
    drums: { k: "x.......x.......", s: "....o.......o...", h: "o.o.o.o.o.o.o.o." },
    sections: {
      A: ["C G Am F C G F G",
        "E5:4 G5:4 C6:6 B5:2  A5:4 G5:4 D5:8  E5:4 A5:4 C6:4 B5:4  A5:6 G5:2 F5:8  E5:4 G5:4 C6:6 D6:2  E6:4 D6:4 B5:8  C6:4 A5:4 G5:4 F5:4  G5:12 -:4"],
      B: ["Am F C G Am F G G",
        "A5:6 B5:2 C6:4 A5:4  F5:6 G5:2 A5:8  G5:4 E5:4 C5:4 E5:4  D5:12 -:4  A5:6 B5:2 C6:4 E6:4  D6:6 C6:2 A5:8  B5:4 C6:4 D6:4 B5:4  G5:8 -:8"],
    },
    form: "A B A",
  },
  // F major, 100 — the plaza: a lilting tune over an off-beat strum
  town: {
    bpm: 100, lead: "bell", vol: 0.12, bass: "tri", comp: "pluck", pad: false, delay: 0.12,
    bassPat: "R.....F.R.....F.", compPat: "..2...1...2...1.",
    drums: { k: "x.......x.......", s: "........o.......", h: "..o...o...o...o." },
    sections: {
      A: ["F C Dm Bb F C Bb C",
        "C5:2 F5:2 A5:4 G5:2 F5:2 C5:4  E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4  F5:2 A5:2 D6:4 C6:2 A5:2 F5:4  D5:4 F5:4 Bb5:6 A5:2  C5:2 F5:2 A5:4 C6:4 A5:4  G5:2 A5:2 Bb5:4 G5:4 E5:4  F5:2 G5:2 A5:4 D5:4 E5:4  G5:6 E5:2 C5:8"],
      B: ["Gm C F Dm Gm C F F",
        "Bb5:4 A5:2 G5:2 D5:8  E5:2 F5:2 G5:4 C6:8  A5:4 G5:2 F5:2 C5:8  D5:2 E5:2 F5:4 A5:8  Bb5:4 C6:2 D6:2 Bb5:8  G5:4 A5:2 Bb5:2 E5:8  F5:4 A5:4 C6:4 A5:4  F5:12 -:4"],
    },
    form: "A B A",
  },
  // G major, 128 — the meadow: off on an adventure
  meadow: {
    bpm: 128, lead: "pulse50", vol: 0.1, bass: "tri", comp: "pulse12", pad: false, delay: 0.1,
    bassPat: "R.R.F.R.R.R.F.O.", compPat: "0123012301230123", compVol: 0.035,
    drums: { k: "x...x...x...x...", s: "....x.......x...", h: "o.oo.oo.o.oo.oo." },
    sections: {
      A: ["G D Em C G D C D",
        "D5:2 G5:2 B5:4 A5:2 G5:2 D5:4  F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4  G5:2 B5:2 E6:4 D6:2 B5:2 G5:4  E5:4 G5:4 C6:6 B5:2  B5:4 D6:4 B5:2 A5:2 G5:4  A5:4 F#5:4 D5:8  E5:2 G5:2 C6:4 B5:2 G5:2 E5:4  F#5:4 A5:4 D6:8"],
      B: ["Em C G D Em C D D",
        "E5:6 G5:2 B5:8  C6:4 B5:4 G5:8  D5:2 G5:2 B5:4 D6:8  C6:4 A5:4 F#5:8  E6:6 D6:2 B5:8  C6:4 E6:4 G5:8  A5:4 B5:4 C6:4 D6:4  D6:8 -:8"],
    },
    form: "A B A",
  },
  // D dorian, 80 — the forest: a wooden flute among the trees
  forest: {
    bpm: 80, lead: "flute", vol: 0.13, bass: "tri", comp: null, pad: true, padVol: 0.035, delay: 0.25,
    bassPat: "R.......F.......",
    drums: { t: "x.....x...x.....", h: "..o...o...o...o." },
    sections: {
      A: ["Dm C G Dm Dm Am Bb C",
        "D5:6 F5:2 A5:8  G5:4 E5:4 C5:8  B4:4 D5:4 G5:6 F5:2  A5:12 -:4  D6:6 C6:2 A5:8  E5:4 G5:4 A5:8  F5:4 D5:4 Bb4:8  C5:4 E5:4 G5:8"],
      B: ["Bb C Dm Dm Gm Am Dm Dm",
        "F5:6 G5:2 A5:4 Bb5:4  C6:8 G5:8  A5:6 G5:2 F5:4 E5:4  D5:12 -:4  G5:6 A5:2 Bb5:4 D6:4  C6:4 A5:4 E5:8  F5:4 E5:4 D5:4 A4:4  D5:12 -:4"],
    },
    form: "A B",
  },
  // A minor, 124 — the city: synths over a running bass
  city: {
    bpm: 124, lead: "duo", vol: 0.085, bass: "saw", comp: "pulse12", pad: false, delay: 0.14,
    bassPat: "RROR.RRORROR.RRO", compPat: "....0.......0...", compVol: 0.04,
    drums: { k: "x...x...x...x...", s: "....x.......x...", h: ".o.o.o.o.o.o.o.o" },
    sections: {
      A: ["Am Am F G Am Am F E",
        "A4:2 -:2 A4:2 C5:2 -:2 A4:2 E5:4  D5:2 C5:2 A4:2 G4:2 A4:8  A4:2 -:2 A4:2 C5:2 -:2 F5:2 E5:4  D5:2 B4:2 G4:4 B4:4 D5:4  E5:2 -:2 E5:2 G5:2 -:2 E5:2 A5:4  G5:2 E5:2 D5:2 C5:2 A4:8  C5:2 D5:2 F5:4 A5:4 F5:4  E5:4 G#5:4 B5:8"],
      B: ["Dm Am F G Dm Am E E",
        "F5:4 A5:4 D6:4 C6:4  C6:4 B5:2 A5:2 E5:8  F5:4 A5:4 C6:4 A5:4  B5:4 D6:4 G5:8  D6:4 F6:4 E6:2 D6:2 C6:4  E6:4 C6:4 A5:8  G#5:4 B5:4 E6:4 D6:4  B5:8 G#5:8"],
    },
    form: "A B A",
  },
  // E minor, 68 — the cave: bells ringing into the dark, water dripping
  cave: {
    bpm: 68, lead: "bell", vol: 0.12, bass: "tri", comp: null, pad: true, padVol: 0.03, delay: 0.42,
    bassPat: "R...............",
    drums: { d: "......x.......x." },
    sections: {
      A: ["Em Em C C Am Am B B",
        "E5:4 -:4 G5:4 B5:4  A5:8 G5:8  E5:4 -:4 G5:4 C6:4  B5:12 -:4  A5:4 -:4 C6:4 E6:4  D6:8 C6:8  B5:4 A5:4 F#5:4 D#5:4  B4:12 -:4"],
      B: ["Em G D C Am B Em Em",
        "G5:8 F#5:4 E5:4  D5:8 B4:8  A5:8 F#5:4 D5:4  E5:12 -:4  C6:6 B5:2 A5:8  D#6:6 C6:2 B5:8  G5:4 F#5:4 E5:4 B4:4  E5:12 -:4"],
    },
    form: "A B",
  },
  // C minor, 64 — the crypt: a slow organ in a cold nave
  crypt: {
    bpm: 64, lead: "organ", vol: 0.09, bass: "organ", comp: null, pad: true, padVol: 0.04, padType: "organ", delay: 0.32,
    bassPat: "R...............",
    drums: { b: "x..............." },
    sections: {
      A: ["Cm Cm Ab Ab Fm Fm G G",
        "C5:8 Eb5:4 G5:4  F5:8 Eb5:8  C5:8 Eb5:4 Ab5:4  G5:12 -:4  F5:8 Ab5:4 C6:4  Bb5:8 Ab5:8  G5:4 F5:4 Eb5:4 D5:4  B4:12 -:4"],
      B: ["Cm Bb Ab G Fm G Cm Cm",
        "G5:8 Ab5:4 G5:4  F5:8 D5:8  Eb5:8 F5:4 Eb5:4  D5:12 -:4  C6:8 Ab5:4 F5:4  D5:4 F5:4 B5:8  C6:8 G5:8  C5:12 -:4"],
    },
    form: "A B",
  },
  // G minor, 96 — the sewer: a crooked, creeping groove
  sewer: {
    bpm: 96, lead: "pulse12", vol: 0.1, bass: "tri", comp: null, pad: false, delay: 0.22,
    bassPat: "R...R...R.T.F...",
    drums: { k: "x.....x...x.....", s: "....o.......o...", d: "..x.....x.x....." },
    sections: {
      A: ["Gm Gm Eb D Gm Gm Ab D",
        "G4:2 -:2 Bb4:2 -:2 A4:2 -:2 G4:4  D5:2 -:2 C#5:2 D5:2 -:8  Eb5:2 -:2 D5:2 -:2 C5:2 -:2 Bb4:4  A4:4 F#4:4 D4:8  G4:2 Bb4:2 D5:2 -:2 F#5:2 G5:2 -:4  F5:2 Eb5:2 D5:4 Bb4:8  C5:2 -:2 Eb5:2 -:2 D5:2 -:2 C5:4  A4:2 Bb4:2 C5:2 C#5:2 D5:8"],
      B: ["Cm Cm Gm Gm Eb D Gm Gm",
        "Eb5:4 -:2 Eb5:2 D5:4 C5:4  G5:8 -:8  D5:4 -:2 D5:2 C5:4 Bb4:4  G4:8 -:8  Bb4:2 C5:2 Eb5:4 G5:4 Eb5:4  F#5:4 A5:4 D5:8  G5:2 F5:2 D5:2 Bb4:2 A4:4 G4:4  G4:12 -:4"],
    },
    form: "A B",
  },
  // D phrygian, 70 — the abyss: a heartbeat under a wrong, swollen tune
  abyss: {
    bpm: 70, lead: "dark", vol: 0.1, bass: "tri", comp: null, pad: true, padVol: 0.045, padTritone: true, delay: 0.36,
    bassPat: "L.......L.......",
    drums: { hb: "x..x............" },
    sections: {
      A: ["Dm Eb Dm Eb Bb A Dm Dm",
        "D5:8 Eb5:8  G5:8 F5:4 Eb5:4  D5:6 A4:2 Bb4:8  A4:12 -:4  F5:8 G#5:8  A5:8 C#5:8  D5:4 F5:4 A5:4 G#5:4  A5:12 -:4"],
      B: ["Gm Eb A A Dm Eb A Dm",
        "Bb5:8 A5:4 G5:4  G5:8 Eb5:8  E5:4 F5:4 G#5:8  A5:12 -:4  D6:8 C#6:8  Bb5:8 G5:8  A5:4 G#5:4 F5:4 E5:4  D5:12 -:4"],
    },
    form: "A B",
  },
  // A minor, 84 — 단풍 왕도: a flute over a plucked lute, a fallen kingdom remembered fondly; the leaves rustle between phrases
  autumn: {
    bpm: 84, lead: "flute", vol: 0.12, bass: "tri", comp: "pluck", pad: true, padVol: 0.025, delay: 0.3, rustle: true,
    bassPat: "R.......F...R...", compPat: "0.2.1.2.3.2.1.2.", compVol: 0.03,
    drums: { h: "....o.......o..." },
    sections: {
      A: ["Am F C G Am F E E",
        "E5:4 A5:4 C6:6 B5:2  A5:4 F5:4 C5:8  E5:4 G5:4 C6:4 E6:4  D6:6 C6:2 B5:8  C6:4 B5:4 A5:4 E5:4  F5:6 G5:2 A5:8  G#5:4 B5:4 E6:4 D6:4  B5:12 -:4"],
      B: ["Dm G C Am Dm E Am Am",
        "F5:6 E5:2 D5:8  B4:4 D5:4 G5:8  E5:6 F5:2 G5:4 C6:4  A5:12 -:4  D6:6 C6:2 A5:4 F5:4  G#5:4 B5:4 E5:8  A5:4 C6:4 E6:4 C6:4  A5:12 -:4"],
    },
    form: "A B A",
  },
  // E minor, 148 — a boss on screen
  boss: {
    bpm: 148, lead: "pulse25", vol: 0.1, bass: "saw", comp: "pulse12", pad: false, delay: 0.08,
    bassPat: "R.R.R.R.R.R.F.O.", compPat: "0.1.2.1.0.1.2.1.", compVol: 0.03,
    drums: { k: "x...x.x.x...x.x.", s: "....x.......x...", h: "oooooooooooooooo" },
    sections: {
      A: ["Em C D B Em C D B",
        "E5:2 E5:2 G5:2 E5:2 B5:4 A5:2 G5:2  E5:2 E5:2 G5:2 E5:2 C6:4 B5:2 G5:2  F#5:2 F#5:2 A5:2 F#5:2 D6:4 C6:2 A5:2  B5:4 A5:2 G5:2 F#5:4 D#5:4  E6:4 D6:2 B5:2 G5:4 E5:4  C6:4 B5:2 G5:2 E5:4 C5:4  D6:4 C6:2 A5:2 F#5:4 D5:4  D#5:4 F#5:4 B5:8"],
      B: ["Am Em B Em C D B B",
        "A5:6 B5:2 C6:4 E6:4  B5:6 A5:2 G5:4 E5:4  F#5:4 A5:4 B5:4 D#6:4  E6:12 -:4  G5:4 C6:4 E6:4 G6:4  F#6:4 D6:4 A5:4 F#5:4  B5:4 D#6:4 F#6:4 D#6:4  B5:8 -:8"],
    },
    form: "A B",
  },
  // F# minor, 138 — the rift is open on this map
  rift: {
    bpm: 138, lead: "duo", vol: 0.09, bass: "saw", comp: "pulse12", pad: false, delay: 0.1,
    bassPat: "R.RR.RR.R.RR.RF.", compPat: "3...3...3...3...", compVol: 0.035,
    drums: { k: "x...x...x...x...", s: "....x..x....x...", h: "o.o.o.o.o.o.o.o." },
    sections: {
      A: ["F#m D E C#m F#m D E C#",
        "C#5:4 F#5:4 A5:4 C#6:4  D6:4 C#6:4 A5:8  B5:4 G#5:4 E5:4 B5:4  C#6:8 G#5:8  A5:2 B5:2 C#6:4 F#6:4 E6:4  D6:4 A5:4 F#5:8  E5:4 G#5:4 B5:4 D6:4  C#6:4 F5:4 G#5:8"],
      B: ["Bm F#m D E Bm C# F#m F#m",
        "D6:6 C#6:2 B5:8  A5:6 G#5:2 F#5:8  F#5:4 A5:4 D6:4 F#6:4  E6:12 -:4  B5:4 D6:4 F#6:4 D6:4  F6:4 C#6:4 G#5:8  A5:4 C#6:4 F#6:4 E6:4  F#6:8 -:8"],
    },
    form: "A B",
  },
  // F major, 72 — the plaza by night: a lullaby on bells over a soft pad, no drums
  town_night: {
    bpm: 72, lead: "bell", vol: 0.1, bass: "tri", comp: "pluck", pad: true, padVol: 0.022, delay: 0.24,
    bassPat: "R.......F.......", compPat: "0...2...1...2...", compVol: 0.03,
    sections: {
      A: ["F Dm Bb C F Am Bb C",
        "A4:6 C5:2 F5:8  E5:4 D5:4 A4:8  D5:6 F5:2 Bb5:8  A5:4 G5:4 E5:8  F5:6 A5:2 C6:8  C6:4 B5:2 A5:2 E5:8  D5:4 F5:4 Bb5:4 A5:4  G5:12 -:4"],
    },
    form: "A A",
  },
  // D dorian, 66 — the fields by night: a wooden flute among the crickets
  field_night: {
    bpm: 66, lead: "flute", vol: 0.1, bass: "tri", comp: "pluck", pad: true, padVol: 0.02, delay: 0.26,
    bassPat: "R...............", compPat: "0.......2.......", compVol: 0.028,
    sections: {
      A: ["Dm Am Bb C Dm Am G Am",
        "D5:6 F5:2 A5:8  C6:4 A5:4 E5:8  F5:6 D5:2 Bb4:8  C5:4 E5:4 G5:8  A5:6 G5:2 F5:4 E5:4  E5:8 C5:8  D5:4 G5:4 B5:8  A5:12 -:4"],
    },
    form: "A A",
  },
};
/** The calmer tune a map's music turns into after dark. */
const NIGHT = { town: "town_night", meadow: "field_night", forest: "field_night" };
/** Per-track level trims, measured by rendering each offline, so all sit near the same loudness. */
const TRIM = { city: 1.6, rift: 1.55, boss: 1.45, cave: 1.5, crypt: 1.15 };
/** Old names some maps still carry. */
const ALIAS = { field: "meadow" };

/** Unroll a track into bars: [{ chord: [midi…], notes: [[hz, step, len]…] }]. */
function compile(def) {
  const bars = [];
  for (const name of def.form.split(/\s+/)) {
    const [chords, mel] = def.sections[name];
    const syms = chords.split(/\s+/);
    const notes = melody(mel);
    syms.forEach((sym, b) => bars.push({ chord: chord(sym), notes: notes.filter((n) => n[1] >= b * 16 && n[1] < (b + 1) * 16).map((n) => [n[0], n[1] - b * 16, n[2]]) }));
  }
  return bars;
}
const SONGS = {};
for (const k of Object.keys(TRACKS)) SONGS[k] = compile(TRACKS[k]);

/** For the test page: every section's melody must fill exactly its bars. */
export function checkTracks() {
  const bad = [];
  for (const [k, def] of Object.entries(TRACKS)) {
    for (const [name, [chords, mel]] of Object.entries(def.sections)) {
      const want = chords.split(/\s+/).length * 16, got = melody(mel).total;
      if (want !== got) bad.push(`${k}.${name}: ${got}/${want}`);
    }
  }
  return bad;
}
export const TRACK_NAMES = Object.keys(TRACKS);

// ───────────────────────────── the engine ─────────────────────────────

const STORE = "lumentale:audio";
const LOOKAHEAD = 0.3, FADE = 1.6, MAX_SFX = 22;

export const Sound = {
  ctx: null, master: null, music: null, sfx: null, verb: null,
  /** Kept for older callers: both follow `muted`. */
  sfxOn: true, bgmOn: true,
  vol: { music: 0.7, sfx: 0.85, mute: false },
  base: null, theme: null, playing: [], timer: 0,
  voices: 0, last: {}, k: 1, amb: 0, ambNext: 0, noiseBuf: null, waves: {},

  /** Browsers only allow audio after a gesture — call this from a click/keypress. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended" && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { Object.assign(this.vol, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* defaults */ }
    const c = (this.ctx = new AC());
    // master → a gentle limiter → speakers; music and effects each have a bus
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = c.createGain(); this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    // a shared echo the music sends into (more in caves, less in the plaza)
    const d = c.createDelay(1); d.delayTime.value = 0.32;
    const fb = c.createGain(); fb.gain.value = 0.38;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    this.verb = c.createGain(); this.verb.gain.value = 0.15;
    this.verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.music);
    // one second of noise, reused by every drum and effect
    const n = (this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)).getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    for (const duty of [0.125, 0.25, 0.5]) {
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let i = 1; i < N; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      this.waves[duty] = c.createPeriodicWave(re, im);
    }
    this.applyVolume();
    // nothing plays in a hidden tab
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
    this.timer = setInterval(() => this.pump(), 50);
    this.pick();
  },

  // ── volume ──
  applyVolume() {
    this.sfxOn = this.bgmOn = !this.vol.mute;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.vol.mute ? 0 : this.vol.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.mute ? 0 : this.vol.sfx * 0.8, t, 0.05);
  },
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.vol)); } catch { /* private mode */ } },
  setMusic(v) { this.vol.music = Math.max(0, Math.min(1, v)); this.save(); this.applyVolume(); },
  setSfx(v) { this.vol.sfx = Math.max(0, Math.min(1, v)); this.save(); this.applyVolume(); },
  setMute(m) { this.vol.mute = !!m; this.save(); this.applyVolume(); },
  /** Read before unlock, so the settings window can show saved values. */
  load() { try { Object.assign(this.vol, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* defaults */ } this.sfxOn = this.bgmOn = !this.vol.mute; return this.vol; },

  // ── music ──
  /** The map's own music: its id has a track, or else its `fallback` name does. */
  bgm(name, fallback) {
    const own = (k) => (TRACKS[k] ? k : TRACKS[ALIAS[k]] ? ALIAS[k] : null);
    this.base = own(name) || own(fallback) || "meadow";
    this.pick();
  },
  /** A theme over the map's music — "boss", "rift" — or null to go back. */
  setTheme(name) { if (this.theme === name) return; this.theme = name; this.pick(); },
  /** Night falls (or lifts) outdoors: the map's music crossfades to its night variant and back. */
  setNight(on) { on = !!on; if (this.night === on) return; this.night = on; this.pick(); },
  /** Crossfade to whichever track should be playing now. */
  pick() {
    const want = this.theme || (this.night && NIGHT[this.base]) || this.base || "title";
    const c = this.ctx;
    if (!c) return;
    const live = this.playing.find((p) => !p.dying);
    if (live && live.name === want) return;
    const t = c.currentTime;
    for (const p of this.playing) if (!p.dying) { p.gain.gain.cancelScheduledValues(t); p.gain.gain.setValueAtTime(p.gain.gain.value, t); p.gain.gain.linearRampToValueAtTime(0, t + FADE); p.dying = t + FADE + 0.1; }
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(TRIM[want] || 1, t + FADE);
    g.connect(this.music);
    const send = c.createGain(); send.gain.value = TRACKS[want].delay || 0; g.connect(send); send.connect(this.verb);
    this.playing.push({ name: want, def: TRACKS[want], song: SONGS[want], gain: g, step: 0, next: t + 0.12, dying: 0 });
  },
  /** Schedule music (and the fire's crackle) a little ahead of the audio clock. */
  pump() {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const now = c.currentTime;
    for (let i = this.playing.length - 1; i >= 0; i--) {
      const p = this.playing[i];
      if (p.dying && now > p.dying) { p.gain.disconnect(); this.playing.splice(i, 1); continue; }
      const sixteenth = 60 / p.def.bpm / 4;
      if (p.next < now - 0.5) p.next = now + 0.05;          // woke from a long sleep: don't rush to catch up
      while (p.next < now + LOOKAHEAD) {
        this.tick(p, p.next, sixteenth);
        p.step++;
        p.next += sixteenth;
      }
    }
    this.ambience(now);
    // a campfire nearby crackles and pops now and then
    if (this.amb > 0.02 && !this.vol.mute) {
      if (this.ambNext < now) this.ambNext = now;
      while (this.ambNext < now + LOOKAHEAD) {
        this.crackle(this.ambNext, this.amb);
        this.ambNext += 0.07 + Math.random() * 0.3;
      }
    }
    // under an autumn track, a breeze through dry leaves now and then
    if (!this.vol.mute && this.playing.some((p) => !p.dying && p.def.rustle)) {
      if (!this.rustleNext || this.rustleNext < now) this.rustleNext = now + 1 + Math.random() * 3;
      if (this.rustleNext < now + LOOKAHEAD) { this.rustle(this.rustleNext); this.rustleNext += 2.5 + Math.random() * 5; }
    }
  },
  /** Leaves stirring: a soft swell of high, filtered noise with a few dry ticks in it. */
  rustle(t) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), len = 0.9 + Math.random() * 0.8;
    s.buffer = this.noiseBuf; s.loop = true; f.type = "bandpass"; f.frequency.value = 3200 + Math.random() * 1800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + len * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + len + 0.05);
    for (let i = 0; i < 3; i++) this.crackle(t + len * (0.2 + Math.random() * 0.6), 0.25);
  },
  /** Everything that sounds on one sixteenth step of a track. */
  tick(p, t, s16) {
    const def = p.def, bars = p.song, bar = bars[Math.floor(p.step / 16) % bars.length], i = p.step % 16;
    const out = p.gain, ch = bar.chord;
    for (const [f, at, len] of bar.notes) if (at === i) this.inst(def.lead, f, t, len * s16, def.vol, out);
    const bc = def.bassPat && def.bassPat[i];
    if (bc && bc !== ".") {
      const root = ch[0] - 12, k = bc === "R" ? root : bc === "F" ? root + 7 : bc === "O" ? root + 12 : bc === "T" ? ch[1] - 12 : root - 12;
      let len = 1; while (i + len < 16 && def.bassPat[i + len] === ".") len++;
      this.inst(def.bass, midiHz(k), t, Math.min(len, 8) * s16 * 0.95, def.bass === "saw" ? 0.07 : def.bass === "organ" ? 0.05 : 0.2, out);
    }
    const cc = def.compPat && def.compPat[i];
    if (def.comp && cc && cc !== ".") {
      const k = Number(cc), n = k === 3 ? ch[0] + 12 : ch[k % ch.length];
      this.inst(def.comp, midiHz(n + 12), t, s16 * 1.6, def.compVol || 0.045, out);
    }
    if (def.pad && i === 0) {
      const tones = def.padTritone ? [...ch, ch[0] + 6] : ch;
      for (const n of tones) this.inst(def.padType || "pad", midiHz(n + 12), t, s16 * 16, def.padVol || 0.035, out);
    }
    const d = def.drums;
    if (d) for (const kind of Object.keys(d)) { const v = d[kind][i]; if (v && v !== ".") this.drum(kind, t, v === "x" ? 1 : 0.55, out); }
  },

  // ── instruments ──
  /** One note on an instrument, into `out`. */
  inst(type, f, t, dur, vol, out) {
    const c = this.ctx;
    if (!f) return;
    const g = c.createGain();
    g.connect(out);
    const env = (a, d, rel) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.setTargetAtTime(vol * d, t + a, dur * 0.4);
      g.gain.setTargetAtTime(0.0001, t + dur, rel);
    };
    const osc = (wave, freq, gain = 1, detune = 0) => {
      const o = c.createOscillator();
      if (typeof wave === "number") o.setPeriodicWave(this.waves[wave]); else o.type = wave;
      o.frequency.value = freq; o.detune.value = detune;
      let n = o;
      if (gain !== 1) { const k = c.createGain(); k.gain.value = gain; o.connect(k); n = k; }
      o.start(t); o.stop(t + dur + 0.6);
      return n;
    };
    const lowpass = (fc, q = 0.7) => { const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = fc; f2.Q.value = q; f2.connect(g); return f2; };
    switch (type) {
      case "pulse12": osc(0.125, f).connect(g); env(0.005, 0.55, 0.05); break;
      case "pulse25": osc(0.25, f).connect(g); env(0.005, 0.6, 0.06); break;
      case "pulse50": osc(0.5, f).connect(g); env(0.005, 0.55, 0.06); break;
      case "duo": { const lp = lowpass(3200); osc(0.5, f, 0.6, -7).connect(lp); osc(0.25, f, 0.6, 7).connect(lp); env(0.006, 0.6, 0.07); break; }
      case "tri": osc("triangle", f).connect(g); env(0.004, 0.8, 0.05); break;
      case "saw": { const lp = lowpass(f * 6, 2); osc("sawtooth", f).connect(lp); env(0.004, 0.7, 0.05); break; }
      case "pluck": osc(0.25, f).connect(g); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); break;
      case "bell": {
        osc("sine", f).connect(g); osc("sine", f * 2.76, 0.28).connect(g); osc("sine", f * 5.4, 0.08).connect(g);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.6, dur * 1.4)); break;
      }
      case "flute": {
        const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = 5.2; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * 0.008, t + 0.25);
        lfo.connect(depth); depth.connect(o.frequency);
        const air = c.createBufferSource(), ag = c.createGain(), af = c.createBiquadFilter();
        air.buffer = this.noiseBuf; af.type = "bandpass"; af.frequency.value = f * 2; af.Q.value = 3; ag.gain.value = 0.25;
        air.connect(af); af.connect(ag); ag.connect(g);
        o.connect(g); o.start(t); o.stop(t + dur + 0.5); lfo.start(t); lfo.stop(t + dur + 0.5); air.start(t, Math.random() * 0.5, Math.min(0.4, dur));
        env(0.06, 0.85, 0.12); break;
      }
      case "organ": { const lp = lowpass(1800); osc("sine", f).connect(lp); osc("sine", f * 2, 0.5).connect(lp); osc(0.5, f * 4, 0.08).connect(lp); env(0.03, 0.9, 0.18); break; }
      case "dark": { const lp = lowpass(900, 4); osc("sawtooth", f, 0.7, -10).connect(lp); osc("sawtooth", f * 1.003, 0.7, 10).connect(lp); env(0.12, 0.85, 0.4); break; }
      case "pad": { const lp = lowpass(900); osc("sawtooth", f, 0.5, -8).connect(lp); osc("sawtooth", f, 0.5, 8).connect(lp); env(0.5, 0.9, 0.6); break; }
    }
  },
  /** A drum or a sound of the place, at time `t`. */
  drum(kind, t, accent, out) {
    const c = this.ctx;
    const g = c.createGain(); g.connect(out);
    const noise = (dur, type, fc, q = 1) => {
      const s = c.createBufferSource(), f = c.createBiquadFilter();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.value = fc; f.Q.value = q;
      s.connect(f); f.connect(g); s.start(t, Math.random() * 0.8, dur);
    };
    const thump = (f0, f1, dur, v) => {
      const o = c.createOscillator(), k = c.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      k.gain.setValueAtTime(v, t); k.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(k); k.connect(g); o.start(t); o.stop(t + dur + 0.02);
    };
    switch (kind) {
      case "k": thump(130, 45, 0.16, 0.5 * accent); break;
      case "s": g.gain.setValueAtTime(0.16 * accent, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); noise(0.14, "bandpass", 1900, 0.8); thump(200, 150, 0.06, 0.12 * accent); break;
      case "h": g.gain.setValueAtTime(0.045 * accent, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); noise(0.05, "highpass", 7500); break;
      case "t": thump(190, 95, 0.22, 0.32 * accent); break;
      case "d": { const o = c.createOscillator(), k = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(700 + Math.random() * 500, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.06); k.gain.setValueAtTime(0.08 * accent, t); k.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(k); k.connect(g); o.start(t); o.stop(t + 0.14); break; }
      case "b": { const f = 98; for (const [m, v] of [[1, 0.14], [2.4, 0.05], [3.9, 0.025]]) { const o = c.createOscillator(), k = c.createGain(); o.frequency.value = f * m; k.gain.setValueAtTime(v * accent, t); k.gain.exponentialRampToValueAtTime(0.0001, t + 3); o.connect(k); k.connect(g); o.start(t); o.stop(t + 3.05); } break; }
      case "hb": { thump(75, 42, 0.2, 0.55 * accent); break; }
    }
  },
  crackle(t, level) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = "bandpass"; f.frequency.value = 1500 + Math.random() * 2500; f.Q.value = 2;
    g.gain.setValueAtTime(level * (0.04 + Math.random() * 0.06), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random() * 0.9, 0.09);
  },
  /**
   * The sounds of the place outdoors: { out, ph (0 새벽 … 4 밤), wx (weather), night 0–1 }.
   * Birds at dawn and in the morning, a few by day, crickets from sunset, owls at night,
   * a rain loop and a wind loop under it all.
   */
  scene(sc) { this.sc = sc; },
  ambience(now) {
    const c = this.ctx, sc = this.sc;
    if (!c || !sc) return;
    const rain = sc.out && (sc.wx === 2) ? 1 : 0, wind = sc.out && sc.wx === 4 ? 1 : sc.out && sc.wx === 3 ? 0.3 : 0;
    this.loop("rain", rain * 0.16, 1400, "lowpass", 0.6);
    this.loop("wind", wind * 0.1, 420, "lowpass", 2);
    if (!sc.out || this.vol.mute) return;
    if (!this.ambAt) this.ambAt = { bird: 0, cricket: 0, owl: 0 };
    const A = this.ambAt, R = Math.random, wet = sc.wx === 2 || sc.wx === 5;
    // birdsong: a short trill, often at dawn and in the morning, now and then by day
    const birds = wet ? 0 : sc.ph === 0 ? 1 : sc.ph === 1 ? 0.7 : sc.ph === 2 ? 0.25 : 0;
    if (birds && now > A.bird) {
      const f = 2600 + R() * 1400, n = 2 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) this.tone("sine", f * (1 + (i % 2) * 0.12), f * 0.86, 0.06, 0.018 * birds, i * 0.08);
      A.bird = now + (1.2 + R() * 3) / birds;
    }
    // crickets: from sunset on, little chirps in threes
    const crick = sc.ph === 3 ? 0.6 : sc.ph === 4 ? 1 : 0;
    if (crick && !wet && now > A.cricket) {
      const f = 4200 + R() * 500;
      for (let i = 0; i < 3; i++) this.tone("sine", f, f, 0.03, 0.009 * crick, i * 0.06);
      A.cricket = now + 0.5 + R() * 0.9;
    }
    // an owl, far off, two notes
    if (sc.ph === 4 && now > A.owl) {
      if (A.owl) { this.tone("sine", 420, 380, 0.32, 0.03); this.tone("sine", 380, 340, 0.5, 0.03, 0.45); }
      A.owl = now + 14 + R() * 16;
    }
  },
  /** A looping filtered noise bed (`rain`, `wind`) faded to `level`. */
  loop(name, level, fc, type, q) {
    const c = this.ctx;
    if (!this.loops) this.loops = {};
    let L = this.loops[name];
    if (!L) {
      if (level < 0.001) return;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; src.loop = true; f.type = type; f.frequency.value = fc; f.Q.value = q; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
      L = this.loops[name] = { g, f };
    }
    const t = c.currentTime, lv = this.vol.mute ? 0 : level;
    // the wind rises and falls
    const k = name === "wind" ? 0.6 + 0.4 * Math.sin(t / 2.3) : 1;
    L.g.gain.setTargetAtTime(lv * k, t, 0.8);
  },
  /** How close a campfire is: 0 none … 1 sitting by it. */
  ambient(level) { this.amb = Math.max(0, Math.min(1, level)); },

  // ── effects ──
  /** A tone sweeping from f0 to f1 over `dur`, `when` seconds from now. */
  tone(type, f0, f1, dur, vol, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    if (typeof type === "number") o.setPeriodicWave(this.waves[type]); else o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol * this.k, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
    this.voices++; o.onended = () => this.voices--;
  },
  /** Filtered noise: `type` lowpass/highpass/bandpass at `fc`, optionally sweeping to `fc2`. */
  noise(dur, vol, fc = 800, type = "highpass", when = 0, fc2 = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(fc, t); if (fc2) f.frequency.exponentialRampToValueAtTime(fc2, t + dur);
    s.buffer = this.noiseBuf; g.gain.setValueAtTime(vol * this.k, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.8, dur + 0.02);
    this.voices++; s.onended = () => this.voices--;
  },
  arp(type, notes, gap, len, vol, when = 0) { notes.forEach((f, i) => this.tone(type, f, f, len, vol, when + i * gap)); },

  /** Play a named effect. `arg` refines a few: item rarity for "loot", power for swings. */
  play(name, arg) {
    const c = this.ctx;
    if (!c || this.vol.mute || c.state !== "running") return;
    // the same sound twice within a few frames is one sound; and never too many at once
    const now = c.currentTime, gap = THROTTLE[name] ?? 0.03;
    if (now - (this.last[name] ?? -1e9) < gap) return;
    if (this.voices > MAX_SFX && !IMPORTANT.has(name)) return;
    this.last[name] = now;
    const fx = SFX[name];
    if (!fx) return;
    this.k = BOOST[name] || 1;
    try { fx.call(this, arg); } finally { this.k = 1; }
  },
  /** A footstep on the ground under the player. */
  step(ground) { this.play(`step_${ground}`); },
};

/** Minimum seconds between two plays of the same effect. */
const THROTTLE = { quake: 0.2, tip: 0.06, clang: 0.08, block: 0.1, tea: 0.5, dance: 0.08, hit: 0.035, crit: 0.05, mob_shot: 0.08, warn: 0.25, blip: 0.12, hover: 0.06, step_grass: 0.12, step_stone: 0.12, step_wood: 0.12, step_dirt: 0.12, die_small: 0.04, coin: 0.06, pop: 0.06, elite: 1, announce: 1.5 };
/** Level trims by name, from rendering each effect offline against the music: combat sits forward. */
const BOOST = {
  swing: 3, swing_sword: 3, swing_dagger: 3, swing_spear: 3, swing_staff: 2, swing_book: 2.2, shoot: 1.6, magic: 1.5,
  hit: 2, crit: 1.6, hurt: 2, die: 2, die_small: 2.2, die_big: 1.8, mob_shot: 1.8, charge: 2, volley: 1.8, spit: 2, pop: 2, buff: 1.5,
  ui: 1.8, open: 2, close: 2, tab: 2, blip: 1.8, emote: 1.6, cast: 1.8, coin: 1.5, salvage: 1.5, recall: 1.4, warp_out: 1.4, rift_warn: 1.5, fail: 1.4,
  step_grass: 2.5, step_dirt: 2.5, step_stone: 2, step_wood: 1.6,
  drip: 1.6, reel: 1.8, slack: 1.6, sizzle: 1.4, pan_place: 1.8, pan_turn: 1.6, pan_bump: 1.6,
};
/** Effects that play even when many voices are already sounding. */
const IMPORTANT = new Set(["heads", "steam", "overload", "supercon", "giant", "hundred", "level", "achieve", "death", "rift_start", "rift_boss", "announce", "enh_ok", "enh_fail", "warp", "loot"]);

/** The catalogue. `this` is Sound. */
const SFX = {
  // ── weapons ──
  swing() { this.noise(0.1, 0.22, 1800, "bandpass", 0, 600); },
  swing_sword(fin) { this.noise(fin ? 0.26 : 0.2, fin ? 0.32 : 0.24, 400, "bandpass", 0, 2200); this.tone("triangle", 140, 70, 0.16, 0.08); },
  swing_dagger() { this.noise(0.07, 0.2, 2600, "bandpass", 0, 5200); },
  swing_spear(fin) { this.noise(fin ? 0.16 : 0.12, 0.22, 900, "bandpass", 0, 3200); this.tone("triangle", 300, 520, 0.08, 0.05); },
  swing_staff() { this.tone("sine", 420, 760, 0.18, 0.1); this.tone("triangle", 630, 1140, 0.16, 0.05, 0.02); this.noise(0.12, 0.06, 3000, "highpass"); },
  swing_book() { this.noise(0.08, 0.12, 2400, "bandpass", 0, 1200); this.noise(0.06, 0.1, 3000, "bandpass", 0.07, 1600); this.tone("sine", 880, 1320, 0.14, 0.06, 0.04); },
  shoot() { this.noise(0.06, 0.16, 2500); this.tone(0.5, 900, 400, 0.08, 0.07); },
  magic() { this.tone("sine", 500, 1300, 0.16, 0.14); this.tone("triangle", 750, 1700, 0.14, 0.07, 0.03); },
  boom() { this.noise(0.34, 0.36, 1600, "lowpass", 0, 120); this.tone("square", 150, 40, 0.3, 0.16); },
  ice() { this.tone("triangle", 1800, 600, 0.3, 0.12); this.noise(0.22, 0.12, 4000); this.arp("sine", [2093, 2637, 3136], 0.04, 0.12, 0.04, 0.05); },
  heal() { this.arp("sine", [659, 784, 988, 1319], 0.06, 0.25, 0.12); },
  buff() { this.tone("sawtooth", 200, 600, 0.3, 0.09); this.arp(0.25, [523, 659, 784], 0.07, 0.12, 0.06, 0.1); },
  // ── class skills ──
  throw() { this.noise(0.3, 0.26, 600, "bandpass", 0, 2600); this.tone("triangle", 220, 520, 0.22, 0.06); },
  sword_back() { this.noise(0.24, 0.24, 2600, "bandpass", 0, 700); this.tone("triangle", 520, 220, 0.2, 0.06); this.tone(0.5, 1200, 1200, 0.05, 0.06, 0.22); },
  headbutt() { this.tone("sine", 140, 60, 0.14, 0.3); this.noise(0.06, 0.16, 900, "lowpass"); this.tone(0.25, 520, 380, 0.05, 0.05, 0.03); },
  brace() { this.tone("square", 110, 110, 0.12, 0.08); this.tone("triangle", 220, 330, 0.2, 0.08); this.noise(0.1, 0.06, 4000, "highpass", 0.02); },
  clang() { this.tone(0.5, 1400, 1100, 0.07, 0.08); this.tone("sine", 2100, 1900, 0.1, 0.04); },
  shock() { this.noise(0.36, 0.34, 2400, "lowpass", 0, 100); this.tone("sine", 90, 35, 0.4, 0.34); this.tone("square", 240, 60, 0.2, 0.1); },
  roar() { this.tone("sawtooth", 110, 80, 0.5, 0.12); this.tone("sawtooth", 165, 120, 0.5, 0.08); this.noise(0.45, 0.14, 500, "bandpass", 0, 300); },
  grit_burst() { this.noise(0.5, 0.36, 3000, "lowpass", 0, 80); this.tone("square", 180, 40, 0.45, 0.16); this.arp(0.25, [330, 440, 554], 0.04, 0.1, 0.06); },
  quake() { this.tone("sine", 70, 40, 0.18, 0.28); this.noise(0.12, 0.12, 400, "lowpass"); },
  giant() { this.tone("sawtooth", 60, 120, 0.7, 0.14); this.arp("triangle", [131, 165, 196, 262], 0.09, 0.3, 0.1, 0.1); this.noise(0.6, 0.2, 200, "bandpass", 0, 1200); },
  swap() { this.tone("sine", 900, 300, 0.12, 0.1); this.tone("sine", 300, 900, 0.12, 0.08, 0.1); this.noise(0.12, 0.08, 3000, "highpass"); },
  venom() { this.noise(0.3, 0.1, 400, "lowpass", 0, 1600); this.tone("sine", 300, 180, 0.25, 0.06); this.tone("sine", 600, 420, 0.1, 0.05, 0.18); },
  coin_flip() { for (let i = 0; i < 4; i++) this.tone(0.5, 1800 + i * 120, 1800 + i * 120, 0.03, 0.05, i * 0.07); },
  heads() { this.arp(0.25, [1047, 1319, 1568, 2093], 0.05, 0.12, 0.09); this.tone(0.5, 2637, 2637, 0.2, 0.05, 0.2); },
  tails() { this.arp(0.25, [784, 659], 0.08, 0.12, 0.07); },
  decoy() { this.noise(0.4, 0.12, 2000, "bandpass", 0, 500); this.tone("sine", 700, 350, 0.3, 0.05); },
  decoy_pop() { this.noise(0.2, 0.26, 1800, "lowpass", 0, 200); this.tone("square", 400, 120, 0.15, 0.1); this.noise(0.15, 0.08, 6000, "highpass", 0.05); },
  harvest() { for (let i = 0; i < 4; i++) this.tone(0.5, 900 - i * 90, 400 - i * 40, 0.08, 0.07, i * 0.04); this.noise(0.2, 0.2, 2200, "bandpass", 0, 600); },
  dance() { this.noise(0.08, 0.16, 5000, "bandpass", 0, 2000); this.tone("sine", 1500, 600, 0.08, 0.05); },
  hook() { this.noise(0.18, 0.14, 1400, "bandpass", 0, 3000); this.tone("square", 300, 600, 0.06, 0.06); this.tone(0.5, 1000, 700, 0.05, 0.06, 0.16); },
  pole() { this.tone("triangle", 300, 900, 0.3, 0.08); this.noise(0.25, 0.1, 1500, "bandpass", 0, 4000); },
  banner() { this.noise(0.25, 0.12, 900, "bandpass", 0, 2500); this.arp("triangle", [392, 523, 659], 0.07, 0.18, 0.1, 0.12); },
  wheel() { for (let i = 0; i < 4; i++) this.noise(0.08, 0.12, 1200, "bandpass", i * 0.1, 3600); },
  block() { this.tone(0.5, 1600, 1200, 0.06, 0.08); this.noise(0.05, 0.1, 5000, "highpass"); },
  javelin() { this.noise(0.22, 0.22, 800, "bandpass", 0, 4200); this.tone("triangle", 400, 900, 0.16, 0.05); },
  wall() { this.tone("sine", 110, 50, 0.25, 0.32); this.noise(0.18, 0.26, 1400, "lowpass", 0, 150); this.tone("square", 260, 200, 0.06, 0.08); },
  tip() { this.tone(0.25, 1760, 1760, 0.04, 0.06); },
  focus() { this.arp("sine", [880, 1175, 1568], 0.04, 0.12, 0.06); },
  hundred() { this.noise(0.4, 0.3, 300, "bandpass", 0, 6000); this.tone("sawtooth", 200, 800, 0.3, 0.08); this.tone(0.5, 2093, 2093, 0.3, 0.04, 0.3); },
  ember() { this.noise(0.3, 0.18, 400, "lowpass", 0, 2400); this.tone("sine", 260, 520, 0.18, 0.08); },
  frost() { this.tone("triangle", 2200, 800, 0.3, 0.1); this.noise(0.3, 0.1, 6000, "highpass"); },
  tea() { this.tone("sine", 1200, 1500, 0.12, 0.05); this.noise(0.4, 0.05, 3000, "bandpass", 0.06, 6000); this.tone("sine", 660, 660, 0.3, 0.05, 0.1); },
  bolt() { this.noise(0.12, 0.26, 3000, "highpass"); this.tone("square", 1200, 200, 0.12, 0.08); this.noise(0.25, 0.12, 900, "lowpass", 0.05, 120); },
  rewind() { this.tone("sine", 1400, 300, 0.4, 0.1); this.tone("triangle", 700, 150, 0.4, 0.06, 0.04); this.noise(0.4, 0.06, 2000, "bandpass", 0, 400); },
  surge() { this.arp(0.25, [262, 330, 392, 523, 659, 784], 0.05, 0.2, 0.08); this.noise(0.6, 0.16, 300, "bandpass", 0, 5000); this.tone("sawtooth", 80, 160, 0.6, 0.1); },
  steam() { this.noise(0.5, 0.3, 5000, "highpass", 0, 1500); this.noise(0.3, 0.2, 800, "lowpass", 0, 120); this.tone("sine", 160, 60, 0.3, 0.2); },
  supercon() { this.tone("square", 2400, 600, 0.2, 0.06); this.tone("triangle", 1800, 2600, 0.2, 0.06); this.noise(0.2, 0.1, 6000, "highpass"); },
  overload() { this.noise(0.45, 0.38, 2000, "lowpass", 0, 90); this.tone("square", 220, 40, 0.35, 0.18); this.noise(0.1, 0.2, 4000, "highpass"); },
  // ── hits ──
  hit() { this.tone(0.5, 260, 90, 0.08, 0.15); this.noise(0.05, 0.12, 1600, "bandpass"); },
  crit() { this.tone(0.5, 560, 130, 0.14, 0.18); this.noise(0.1, 0.22, 1200, "bandpass"); this.tone("sine", 1400, 1100, 0.08, 0.05, 0.02); },
  finisher() { this.noise(0.22, 0.3, 2400, "lowpass", 0, 200); this.tone("square", 220, 55, 0.24, 0.18); this.tone("sine", 90, 40, 0.3, 0.3); },
  hurt() { this.tone("sawtooth", 190, 70, 0.16, 0.17); this.noise(0.08, 0.1, 900, "bandpass"); },
  // ── monsters ──
  die() { this.tone(0.5, 300, 60, 0.22, 0.12); },
  die_small() { this.tone(0.25, 420, 90, 0.16, 0.1); this.noise(0.1, 0.09, 1200, "bandpass", 0.02); },
  die_big() { this.tone("sawtooth", 220, 45, 0.4, 0.13); this.noise(0.3, 0.18, 1800, "lowpass", 0, 150); },
  die_boss() { this.tone("sawtooth", 160, 30, 1.4, 0.16); this.noise(1.2, 0.26, 2400, "lowpass", 0, 80); this.arp("triangle", [392, 330, 262, 196], 0.18, 0.4, 0.1, 0.3); },
  mob_shot() { this.tone("square", 700, 300, 0.1, 0.06); this.noise(0.05, 0.08, 3000); },
  charge() { this.tone("sawtooth", 90, 260, 0.6, 0.08); this.noise(0.6, 0.08, 300, "bandpass", 0, 1600); },
  volley() { this.arp(0.25, [880, 740, 620], 0.05, 0.08, 0.06); this.noise(0.15, 0.1, 2800); },
  spit() { this.noise(0.18, 0.16, 500, "lowpass", 0, 2400); this.tone("sine", 300, 120, 0.2, 0.08); },
  pop() { this.noise(0.08, 0.14, 1600, "lowpass", 0, 300); this.tone("sine", 200, 90, 0.1, 0.1); },
  slam() { this.noise(0.4, 0.34, 900, "lowpass", 0, 60); this.tone("sine", 70, 30, 0.4, 0.4); },
  warn() { this.tone(0.5, 440, 440, 0.09, 0.08); this.tone(0.5, 440, 440, 0.09, 0.08, 0.18); },
  elite() { this.tone("sawtooth", 110, 220, 0.5, 0.07); this.arp("triangle", [330, 311, 330], 0.12, 0.16, 0.08, 0.1); },
  announce() { this.arp(0.25, [392, 523, 659, 784], 0.1, 0.2, 0.08); this.tone("triangle", 196, 196, 0.6, 0.12); },
  rift_warn() { for (let i = 0; i < 3; i++) { this.tone("sawtooth", 520, 380, 0.25, 0.08, i * 0.32); } },
  rift_start() { this.noise(0.8, 0.3, 3000, "lowpass", 0, 100); this.tone("sawtooth", 80, 40, 0.9, 0.18); this.arp(0.25, [370, 440, 554, 740], 0.08, 0.18, 0.08, 0.3); },
  rift_boss() { this.tone("sawtooth", 60, 30, 1.2, 0.2); this.noise(1, 0.28, 1200, "lowpass", 0, 60); this.arp("square", [185, 175, 165], 0.2, 0.3, 0.07, 0.2); },
  // ── loot and progress ──
  coin() { this.tone(0.5, 1320, 1320, 0.05, 0.08); this.tone(0.5, 1760, 1760, 0.1, 0.08, 0.05); },
  item() { this.arp(0.5, [880, 1175, 1568], 0.05, 0.08, 0.08); },
  /** Pick-up, brighter and longer with rarity: 0 common … 4 set. */
  loot(q = 0) {
    const scale = [[784, 988], [784, 988, 1175], [784, 988, 1175, 1568], [659, 880, 1175, 1568, 2093], [698, 932, 1175, 1568, 1865, 2349]][Math.max(0, Math.min(4, q | 0))];
    this.arp(q >= 3 ? "triangle" : 0.25, scale, q >= 3 ? 0.07 : 0.05, q >= 3 ? 0.3 : 0.12, q >= 3 ? 0.1 : 0.07);
    if (q >= 2) this.arp("sine", scale.map((f) => f * 2), 0.05, 0.2, 0.03, 0.12);
    if (q >= 3) this.noise(0.6, 0.05, 6000, "highpass", 0.1);
  },
  potion() { this.tone("sine", 260, 520, 0.12, 0.14); this.tone("sine", 300, 700, 0.12, 0.12, 0.12); this.tone("sine", 360, 900, 0.14, 0.1, 0.24); },
  level() { this.arp(0.25, [523, 659, 784, 1047], 0.09, 0.18, 0.12); this.arp("triangle", [262, 330, 392, 523], 0.09, 0.2, 0.12); this.tone(0.25, 1319, 1319, 0.5, 0.1, 0.4); this.tone("triangle", 659, 659, 0.6, 0.1, 0.4); },
  achieve() { this.arp(0.25, [784, 988, 1175, 1568], 0.08, 0.2, 0.1); this.arp("triangle", [392, 494, 587, 784], 0.08, 0.25, 0.1); this.noise(0.7, 0.05, 7000, "highpass", 0.3); },
  daily() { this.arp(0.5, [1047, 1319, 1568], 0.07, 0.14, 0.08); },
  quest() { this.arp("triangle", [523, 659, 784, 1047], 0.08, 0.22, 0.14); },
  ok() { this.arp("triangle", [784, 988, 1319], 0.08, 0.2, 0.17); },
  fail() { this.arp("sawtooth", [392, 330, 262], 0.12, 0.2, 0.08); },
  enh_ok() { this.tone("square", 900, 900, 0.04, 0.1); this.tone("square", 900, 900, 0.04, 0.1, 0.12); this.arp("triangle", [784, 988, 1319, 1568], 0.06, 0.25, 0.14, 0.26); },
  enh_fail() { this.tone("square", 900, 900, 0.04, 0.1); this.tone("square", 900, 900, 0.04, 0.1, 0.12); this.noise(0.3, 0.2, 1200, "lowpass", 0.26, 200); this.tone("sawtooth", 220, 110, 0.4, 0.1, 0.26); },
  salvage() { this.noise(0.12, 0.2, 2000, "bandpass"); this.tone("square", 500, 250, 0.1, 0.08, 0.04); this.tone(0.5, 1320, 1320, 0.06, 0.06, 0.14); },
  // ── interface ──
  ui() { this.tone(0.5, 660, 660, 0.035, 0.06); },
  open() { this.tone(0.25, 520, 780, 0.06, 0.06); },
  close() { this.tone(0.25, 700, 460, 0.06, 0.05); },
  tab() { this.tone(0.125, 880, 880, 0.03, 0.05); },
  hover() { this.tone("sine", 1200, 1200, 0.02, 0.02); },
  no() { this.tone("square", 180, 150, 0.12, 0.1); this.tone("square", 140, 120, 0.12, 0.08, 0.1); },
  // ── travel ──
  wp_wake() { this.arp("sine", [392, 523, 659, 784, 1047], 0.09, 0.4, 0.1); this.noise(0.8, 0.05, 5000, "highpass", 0.2); },
  warp() { this.noise(0.5, 0.18, 300, "bandpass", 0, 4000); this.arp("sine", [523, 784, 1047], 0.06, 0.3, 0.08, 0.2); },
  warp_out() { this.noise(0.4, 0.16, 4000, "bandpass", 0, 300); this.tone("sine", 1047, 262, 0.4, 0.08); },
  recall() { this.tone("triangle", 330, 330, 1.8, 0.05); this.noise(1.8, 0.04, 3000, "bandpass", 0, 6000); this.noise(0.08, 0.1, 2400, "bandpass"); },
  // ── fishing, emotes, chat, party ──
  cast() { this.noise(0.2, 0.12, 2000, "bandpass", 0, 700); this.tone("sine", 600, 300, 0.12, 0.05, 0.2); this.noise(0.1, 0.12, 900, "lowpass", 0.35); },
  bite() { this.tone("sine", 400, 900, 0.08, 0.12); this.tone("sine", 400, 900, 0.08, 0.12, 0.12); this.noise(0.12, 0.1, 1200, "lowpass", 0.05); },
  emote() { this.tone("sine", 600, 1200, 0.08, 0.1); this.tone("sine", 900, 1800, 0.08, 0.05, 0.05); },
  blip() { this.tone(0.25, 1100, 1100, 0.025, 0.035); this.tone(0.25, 1400, 1400, 0.025, 0.03, 0.04); },
  party() { this.arp("triangle", [659, 784, 1047], 0.07, 0.16, 0.12); },
  // ── by the fire at night ──
  /** The storyteller begins: a soft, low chime. */
  tale() { this.arp("sine", [392, 523, 659], 0.12, 0.6, 0.04); },
  /** A strum on the lute (`near` 0–1: quieter farther away): a chord rolled up, plucked. */
  strum(near = 1) {
    const v = 0.05 * Math.max(0.15, near), roots = [[262, 330, 392, 523], [220, 262, 330, 440], [175, 220, 262, 349], [196, 247, 294, 392]];
    const ch = roots[Math.floor(Math.random() * roots.length)];
    ch.forEach((f, i) => { this.tone(0.25, f, f * 0.998, 0.5, v, i * 0.035); this.tone("triangle", f * 2, f * 2, 0.25, v * 0.4, i * 0.035); });
    ch.slice(1).forEach((f, i) => this.tone(0.25, f, f, 0.4, v * 0.8, 0.45 + i * 0.03));
  },
  /** Cups knocked together: a bright clink and a little cheer. */
  cheers(near = 1) { const v = Math.max(0.2, near); this.tone("sine", 2400, 2300, 0.18, 0.06 * v); this.tone("sine", 3150, 3000, 0.14, 0.035 * v, 0.01); this.arp("triangle", [784, 988, 1175], 0.06, 0.12, 0.04 * v, 0.15); },
  // ── the fishing and cooking mini-games ──
  /** A ripple reaching the float: a soft drip on the beat. */
  drip() { this.tone("sine", 1400, 700, 0.06, 0.05); this.noise(0.04, 0.03, 1800, "bandpass"); },
  /** The line pulled on the beat: 2 perfect, 1 good, 0 barely. */
  reel(q = 1) {
    this.noise(0.07, 0.14, 1500, "bandpass", 0, 4200);
    this.tone(0.25, 520 + q * 180, 720 + q * 260, 0.06, 0.09);
    if (q >= 2) this.tone("sine", 1568, 2093, 0.1, 0.06, 0.04);
  },
  /** Too early, too late, or nothing there: the line goes slack. */
  slack() { this.tone("triangle", 220, 140, 0.16, 0.08); this.noise(0.12, 0.06, 600, "lowpass"); },
  /** The fish comes out of the water. */
  landed() { this.noise(0.25, 0.22, 1400, "lowpass", 0, 300); this.noise(0.1, 0.1, 3000, "bandpass", 0.18); this.noise(0.1, 0.1, 3000, "bandpass", 0.3); this.arp("triangle", [659, 880, 1175], 0.07, 0.16, 0.1, 0.25); },
  /** Something snapped. */
  snap() { this.tone(0.5, 1800, 400, 0.05, 0.08); this.noise(0.3, 0.1, 900, "lowpass", 0.05, 200); },
  /** Oil in a hot pan, now and then while cooking; `heat` 0–1 makes it fiercer as time runs out. */
  sizzle(heat = 0) { this.noise(0.35 + heat * 0.2, 0.05 + heat * 0.05, 5200, "highpass", 0, 3000); this.noise(0.12, 0.025, 2200, "bandpass", 0.12); },
  /** An ingredient set down in the pan: a soft thunk and a burst of sizzle. */
  pan_place() { this.tone("sine", 180, 110, 0.08, 0.14); this.noise(0.4, 0.12, 4800, "highpass", 0.02, 2600); },
  /** A piece turned over, or picked back up. */
  pan_turn() { this.noise(0.06, 0.08, 1600, "bandpass", 0, 900); this.tone(0.25, 440, 520, 0.03, 0.04); },
  /** It does not fit there. */
  pan_bump() { this.tone("square", 160, 130, 0.08, 0.07); },
  dish_done() { this.noise(0.6, 0.08, 5000, "highpass", 0, 2000); this.arp("triangle", [523, 659, 784, 1047], 0.07, 0.2, 0.12, 0.1); },
  dish_burnt() { this.noise(0.5, 0.12, 2400, "lowpass", 0, 300); this.arp("sawtooth", [330, 294, 247], 0.12, 0.2, 0.07, 0.08); },
  // ── life and death ──
  death() { this.arp("sawtooth", [392, 370, 349, 330, 262], 0.16, 0.3, 0.07); this.tone("sine", 110, 55, 1.2, 0.18, 0.4); },
  revive() { this.arp("sine", [262, 392, 523, 784, 1047], 0.08, 0.3, 0.1); this.noise(0.6, 0.04, 5000, "highpass", 0.2); },
  // ── footsteps, by ground ──
  step_grass() { this.noise(0.05, 0.035, 2500, "bandpass"); },
  step_dirt() { this.noise(0.05, 0.04, 900, "bandpass"); },
  step_stone() { this.noise(0.03, 0.045, 3200, "bandpass"); this.tone("sine", 300, 220, 0.03, 0.02); },
  step_wood() { this.tone("triangle", 220, 160, 0.05, 0.05); this.noise(0.03, 0.025, 1200, "bandpass"); },
};
export const SFX_NAMES = Object.keys(SFX);
