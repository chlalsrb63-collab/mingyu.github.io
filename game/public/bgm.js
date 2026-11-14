// Original looping scores. Each section holds chord symbols, a melody, and optional
// arrangement overrides. A chord and one line of melody span 16 sixteenth notes.
// E5:4 is four steps and -:4 is a rest. The form gives the repeating section order.
// Patterns have 16 steps: . rests, R/F/O/T/L select bass tones, and 0–4 select
// accompaniment tones (root/third/fifth/octave/seventh). Drums and pads use x/o
// for hits or soft hits. See audio.js for the Web Audio voices and scheduler.
// "double" quietly doubles longer melody notes one octave down.

export const TRACKS = {
  // D major · the title screen gradually opens into a half-time future-bass hook
  title: {
    bpm: 140, lead: "keys", vol: 0.115, bass: "sub", bassVol: 0.13, comp: "bell", compVol: 0.027,
    pad: true, padVol: 0.025, delay: 0.24, bassPat: "R.........F.....", compPat: "......1.......2.",
    drums: { k: "o...............", h: "..o.....o.....o." },
    sections: {
      A: ["Dadd9 Bm7 Gmaj7 Asus Dadd9 F#m7 Gmaj7 A7",
        `
          -:4 A4:3 F#5:2 E5:3 D5:4
          -:6 F#5:2 D5:4 A4:4
          B4:3 D5:3 A5:6 F#5:4
          E5:6 B4:2 A4:5 -:3
          -:2 A4:2 F#5:4 E5:2 F#5:2 A5:4
          C#6:3 A5:3 E5:6 -:4
          B5:2 A5:2 F#5:4 D5:6 B4:2
          E5:6 C#5:4 A4:4 -:2
        `],
      B: ["Dadd9 Bm7 Gmaj7 Asus Dadd9 F#m7 Gmaj7 A7",
        `
          -:2 F#5:2 A5:3 E6:3 D6:4 A5:2
          B5:4 F#5:2 A5:2 C#6:4 B5:3 -:1
          -:2 F#5:2 A5:2 B5:4 G5:2 D5:4
          E5:4 A5:4 B5:4 E6:3 -:1
          F#6:4 E6:2 D6:2 A5:3 F#5:3 -:2
          A5:3 C#6:3 E6:4 C#6:2 A5:4
          B5:4 A5:2 F#5:2 D5:3 B4:3 -:2
          C#5:2 E5:2 B5:4 A5:6 -:2
        `,
        { lead: "softLead", vol: 0.105, comp: null, bassPat: "R.....R...O.F...", padType: "wide", padVol: 0.039,
          padPat: "x.....x...x.x...", drums: { k: "x.....o...x.....", s: "........x.......", h: "o.o.o.ooo.o.oooo" } }],
      C: ["Bm7 Gmaj7 Dadd9 Asus Gmaj7 Bm7 Em7 A7",
        `
          F#5:3 A5:3 B5:4 D6:4 -:2
          B5:4 F#5:2 A5:2 D5:6 -:2
          -:2 A4:2 E5:3 F#5:3 A5:6
          B5:4 E5:6 -:2 A4:4
          G5:3 B5:3 F#5:6 D5:4
          F#5:4 D5:2 B4:4 C#5:4 -:2
          G5:3 E5:3 B4:6 D5:4
          C#5:4 B4:2 A4:5 -:5
        `,
        { padType: "wide", padVol: 0.023, padPat: "x.......x.......",
          drums: { k: "x.....o.........", s: "........o.......", h: "..o...o...o...o." } }],
    },
    form: "A B C",
  },
  // F major · Nexus Plaza beside the fishing dock, with a soft lo-fi beat
  town: {
    bpm: 82, lead: "keys", vol: 0.13, bass: "sub", bassVol: 0.112, comp: "keys", compVol: 0.04,
    pad: true, padType: "strings", padVol: 0.022, delay: 0.15, swing: 0.16,
    bassPat: "R.....F...R.....", compPat: "..1...2...4...1.",
    drums: { k: "o.........o.....", s: "....o.......o...", h: "..o...o...o...o." },
    sections: {
      A: ["Fmaj7 Dm7 Bbmaj7 C7 Am7 Dm7 Gm7 C7",
        `
          -:2 C5:3 A4:4 G4:3 A4:4
          F4:3 A4:3 C5:6 -:4
          -:4 D5:4 C5:3 A4:2 F4:3
          G4:3 E4:3 Bb4:5 -:5
          C5:3 A4:2 G4:3 E4:5 -:3
          F4:3 A4:3 E5:4 D5:6
          -:3 Bb4:3 A4:2 G4:4 D4:4
          E4:3 G4:3 C5:4 Bb4:3 -:3
        `],
      B: ["Bbmaj7 Am7 Gm7 C7 Fmaj7 Dm7 Gm7 C7",
        `
          A4:4 D5:5 C5:3 A4:4
          E5:3 C5:3 B4:2 A4:4 -:4
          -:2 Bb4:3 D5:4 F5:5 D5:2
          E5:3 C5:3 G4:4 Bb4:3 -:3
          A4:3 C5:3 E5:4 F5:4 -:2
          E5:2 D5:4 A4:4 F4:4 -:2
          G4:4 Bb4:3 A4:3 D5:4 C5:2
          Bb4:4 G4:3 E4:4 -:5
        `,
        { lead: "felt", double: "keys", comp: "bell", compVol: 0.024, compPat: "......1.....4...", bassPat: "R.......F.....O." }],
    },
    form: "A B",
  },
  // E major · the stream at Willow, a quiet theme with nylon-like plucks and held strings
  willow: {
    bpm: 74, lead: "felt", vol: 0.132, bass: "sub", bassVol: 0.078, comp: "softPluck", compVol: 0.042,
    pad: true, padType: "strings", padVol: 0.024, delay: 0.27, swing: 0.08,
    bassPat: "R.......F.......", compPat: "..2...1...4...2.",
    drums: { h: "......o.......o." },
    sections: {
      A: ["Eadd9 B C#m7 Amaj7 Eadd9 F#m7 Amaj7 Bsus",
        `
          -:2 B4:3 G#4:3 F#4:2 E4:6
          F#4:4 B4:3 C#5:2 D#5:5 -:2
          E5:4 C#5:4 B4:2 G#4:4 -:2
          A4:3 C#5:3 B4:4 E5:4 -:2
          G#5:4 E5:3 B4:3 G#4:6
          A4:3 C#5:3 F#5:6 E5:4
          E5:4 C#5:4 A4:4 G#4:4
          F#4:4 B4:4 A4:3 F#4:3 -:2
        `],
      B: ["C#m7 Amaj7 Eadd9 B F#m7 Amaj7 Eadd9 Bsus",
        `
          C#5:3 E5:3 G#5:6 E5:4
          F#5:4 E5:4 C#5:3 A4:5
          -:2 B4:3 E5:4 G#5:4 B5:3
          A#5:2 F#5:4 D#5:3 B4:5 -:2
          A4:4 C#5:4 E5:4 F#5:4
          E5:3 C#5:3 B4:4 A4:4 -:2
          G#4:4 B4:4 E5:6 F#5:2
          E5:4 F#5:3 B4:4 F#4:3 -:2
        `,
        { double: "flute", compPat: "....2...1...4...", bassPat: "R..........F...." }],
    },
    form: "A B",
  },
  // A major · electric piano, brushed drums and syncopated bass at the restaurant
  juju: {
    bpm: 108, lead: "keys", vol: 0.105, bass: "sub", bassVol: 0.133, comp: "softPluck", compVol: 0.042,
    pad: true, padType: "wide", padVol: 0.013, delay: 0.13, swing: 0.13,
    bassPat: "R.....F.R..O..T.", compPat: "..1..2....4...1.",
    drums: { k: "x......o..o.....", s: "....o.......x...", h: "..o...o.x.o...o." },
    sections: {
      A: ["Amaj7 F#m7 Bm7 E7 C#m7 F#7 Bm7 E7",
        `
          -:2 C#5:2 E5:3 B4:3 C#5:4 -:2
          A4:3 C#5:2 F#5:4 E5:3 C#5:2 -:2
          D5:3 F#5:3 A5:2 F#5:4 E5:2 -:2
          D5:3 B4:2 G#4:3 B4:2 E5:4 -:2
          G#5:3 E5:2 C#5:4 B4:2 C#5:3 -:2
          A#4:3 C#5:3 E5:2 F#5:4 E5:2 -:2
          D5:4 F#5:2 E5:2 D5:3 B4:3 -:2
          G#4:3 B4:3 D5:4 E5:3 -:3
        `],
      B: ["Dmaj7 E7 C#m7 F#m7 Bm7 E7 Aadd9 E7",
        `
          A5:3 F#5:3 E5:2 F#5:4 C#5:2 -:2
          D5:4 E5:2 G#5:4 F#5:2 E5:2 -:2
          -:3 E5:3 B4:2 C#5:4 G#4:2 -:2
          A4:3 C#5:3 E5:2 F#5:5 -:3
          D5:4 B4:2 F#5:3 A5:3 F#5:2 -:2
          G#5:3 F#5:2 E5:3 D5:2 B4:4 -:2
          A4:3 C#5:2 E5:5 B4:3 C#5:3
          G#4:3 B4:3 D5:2 E5:4 B4:2 -:2
        `,
        { comp: "bell", compVol: 0.029, compPat: "....2...1...4...", bassPat: "R....O..R.....F." }],
    },
    form: "A B",
  },
  // G major · bright woodwinds and plucked strings in the open fields
  clean: {
    bpm: 114, lead: "softPluck", vol: 0.10, comp: "keys", compVol: 0.032,
    bass: "sub", bassVol: 0.09, bassPat: "R......F.R...O..", compPat: "....1...2...4...",
    swing: 0.15, drums: { k: "x.......o..o....", s: "....o.......x...", h: "..o...o...o...o." },
    sections: {
      A: ["Fmaj7 Am7 Gm7 C7",
        "C5:2 A4:2 G4:3 A4:3 C5:4 -:2 E5:3 G5:2 E5:4 C5:3 -:4 D5:3 F5:3 G5:4 Bb4:3 -:3 G4:2 Bb4:3 E5:3 D5:4 -:4"],
      B: ["Dm7 Bbmaj7 Gm7 C7",
        "A4:3 C5:3 F5:4 E5:3 -:3 D5:4 C5:2 A4:4 F4:4 -:2 A4:2 Bb4:2 D5:4 G5:4 F5:2 -:2 E5:4 Bb4:4 G4:4 C5:2 -:2",
        { double: "felt", pad: true, padVol: 0.018 }],
      C: ["Bbmaj7 Am7 Gm7 C7",
        "F5:4 D5:4 C5:4 A4:2 -:2 E5:2 C5:4 B4:2 A4:4 C5:2 -:2 D5:4 G5:3 F5:3 D5:4 -:2 E5:4 D5:2 Bb4:4 C5:4 -:2",
        { lead: "felt", comp: "softPluck", drums: { k: "o...........o...", s: "............o...", h: "..o.......o....." } }],
    },
    form: "A B A C",
  },
  forge: {
    bpm: 126, lead: "felt", vol: 0.102, comp: "bell", compVol: 0.026, bass: "sub", bassVol: 0.11,
    bassPat: "R.....F.R..O....", compPat: "....2.....1...3.", drums: { k: "x.....o.x.......", s: "....x.......x...", h: "..o...o...o.o.o." },
    sections: {
      A: ["Dm7 Bbmaj7 Gm7 A7",
        "D5:2 F5:4 A5:3 F5:3 E5:2 -:2 F5:4 D5:2 Bb4:4 D5:4 -:2 G4:2 Bb4:3 D5:4 F5:3 -:4 E5:4 C#5:2 A4:4 E5:3 -:3"],
      B: ["Fadd9 C Dm7 A7",
        "A5:4 G5:2 F5:4 C5:4 -:2 E5:3 G5:4 C6:3 G5:2 -:4 F5:4 A5:4 D6:4 C6:2 -:2 Bb5:3 A5:3 E5:4 C#5:4 -:2",
        { double: "strings", pad: true, padVol: 0.025 }],
      C: ["Gm7 Dm7 Bbmaj7 A7",
        "Bb4:2 D5:3 F5:4 D5:4 -:3 A4:3 C5:2 D5:4 F5:5 -:2 D5:2 F5:4 A5:4 Bb5:4 -:2 G5:3 E5:4 C#5:4 A4:3 -:2",
        { lead: "keys", compVol: 0.014, bassPat: "R.....O.....F..." }],
    },
    form: "A B A C",
  },
  move: {
    bpm: 119, lead: "keys", vol: 0.105, comp: "softPluck", compVol: 0.036, bass: "sub", bassVol: 0.11,
    bassPat: "R.....F...O..R..", compPat: "..1...2...1...4.", swing: 0.12,
    drums: { k: "x.....o...o.....", s: "....o.......x...", h: "..o...o...o...o." },
    sections: {
      A: ["Bbmaj7 Gm7 Cm7 F7",
        "F5:3 D5:3 C5:2 Bb4:4 D5:2 -:2 Bb4:2 D5:4 G5:3 F5:4 -:3 Eb5:4 G5:3 Bb5:3 G5:3 -:3 A5:4 G5:2 Eb5:4 C5:4 -:2"],
      B: ["Ebmaj7 Dm7 Gm7 F7",
        "G5:3 Bb5:3 F5:4 G5:4 -:2 A5:2 F5:3 D5:4 E5:3 -:4 D5:4 Bb4:2 D5:2 G5:4 F5:2 -:2 C5:3 F5:4 A4:3 Bb4:4 -:2",
        { double: "felt" }],
      C: ["Ebmaj7 Bbmaj7 Cm7 F7",
        "Bb5:4 G5:2 Eb5:4 F5:4 -:2 F5:4 C5:2 D5:4 Bb4:4 -:2 C5:3 Eb5:3 G5:4 Bb5:4 -:2 A5:4 F5:4 C5:4 F5:2 -:2",
        { lead: "flute", comp: "keys", bassPat: "R...F.R.O..R...." }],
    },
    form: "A B A C",
  },
  brew: {
    bpm: 102, lead: "bell", vol: 0.079, comp: "felt", compVol: 0.045, bass: "sub", bassVol: 0.09,
    bassPat: "R.......F....O..", compPat: "..2...4.....1...", delay: 0.17, pad: true, padVol: 0.018,
    drums: { k: "o.........o.....", s: "............o...", h: "..o.....o.....o." },
    sections: {
      A: ["Em7 Cmaj7 Am7 B7",
        "G5:3 B5:4 A5:2 G5:4 -:3 E5:4 G5:2 E5:4 C5:4 -:2 A4:2 C5:4 E5:4 G5:4 -:2 F#5:3 D#5:4 B4:3 F#5:4 -:2"],
      B: ["Gmaj7 Dadd9 Cmaj7 B7",
        "B5:4 A5:2 D6:4 B5:4 -:2 A5:4 E5:2 F#5:4 D5:4 -:2 E5:3 G5:2 B5:5 A5:4 -:2 F#5:4 D#5:3 E5:5 -:4",
        { lead: "felt", double: "flute", comp: "bell" }],
      C: ["Am7 Em7 Cmaj7 B7",
        "A5:3 C6:4 G5:4 E5:3 -:2 E5:4 B4:2 G4:4 B4:4 -:2 C5:3 E5:3 G5:4 B5:4 -:2 F#5:5 D#5:3 A4:4 B4:2 -:2",
        { lead: "softPluck", compVol: 0.03, padVol: 0.025 }],
    },
    form: "A B A C",
  },
  meadow: {
    bpm: 114, lead: "flute", vol: 0.105, bass: "sub", bassVol: 0.129, comp: "softPluck", compVol: 0.046, delay: 0.16,
    pad: true, padType: "strings", padVol: 0.016,
    bassPat: "R...F..OR...F...", compPat: "..2.1..0..2.1...",
    drums: { k: "o.......o.......", s: "....o.......o...", h: "o.o...o.o.o...o." },
    sections: {
      A: ["Gadd9 Cmaj7 Em7 D Gadd9 Am7 Cmaj7 D7",
        `
          -:2 B4:2 D5:3 A5:3 G5:4 D5:2
          E5:3 G5:1 B5:4 A5:2 G5:4 -:2
          B4:2 D5:2 E5:4 G5:3 F#5:1 E5:4
          A4:3 D5:3 F#5:4 A5:3 -:3
          G5:3 B5:1 D6:4 B5:2 A5:3 G5:3
          A5:3 E5:3 C5:4 B4:2 A4:4
          E5:3 G5:1 B5:4 D6:5 C6:3
          A5:4 F#5:3 E5:1 D5:5 -:3
        `],
      B: ["Em7 D Cmaj7 Gadd9 Am7 Em7 Cmaj7 D7",
        `
          E5:3 B5:3 G5:4 D5:4 -:2
          F#5:3 A5:3 D6:4 A5:3 F#5:3
          G5:2 E5:2 G5:4 B5:3 G5:1 E5:4
          D5:3 A5:3 G5:6 -:4
          A4:3 C5:3 E5:2 G5:4 A5:4
          B5:4 G5:3 F#5:1 E5:4 B4:4
          C5:2 E5:2 G5:4 A5:4 B5:4
          A5:4 F#5:2 D5:4 A4:3 -:3
        `,
        { double: "felt", comp: "bell", compVol: 0.023, compPat: "......2.......1.", padVol: 0.029 }],
    },
    form: "A B",
  },
  // D Dorian · quiet flute calls and suspended, breathing harmony
  forest: {
    bpm: 78, lead: "flute", vol: 0.103, bass: "sub", bassVol: 0.097, comp: "bell", compVol: 0.022,
    pad: true, padType: "strings", padVol: 0.024, delay: 0.32, bassPat: "R.........F.....", compPat: "......2.......1.",
    drums: { t: "o.........o.....", h: "......o.......o." },
    sections: {
      A: ["Dm7 Gadd9 Cmaj7 Dm7 Em7 Gadd9 Am7 Dm7",
        `
          -:3 A4:3 C5:2 F5:6 -:2
          D5:5 B4:3 A4:6 -:2
          G4:3 B4:3 D5:4 E5:4 -:2
          F5:5 E5:3 D5:5 -:3
          -:4 G4:4 B4:3 D5:4 -:1
          B4:3 D5:3 A5:6 G5:4
          E5:4 G5:3 A5:5 C5:4
          F5:4 E5:4 C5:3 D5:5
        `],
      B: ["Dm7 Em7 Gadd9 Cmaj7 Dm7 Am7 Gadd9 Dm7",
        `
          A5:3 G5:3 F5:6 D5:4
          B4:4 E5:3 G5:5 -:4
          D5:3 B4:3 A4:4 G4:4 -:2
          -:4 E5:4 G5:6 D5:2
          F5:4 C5:4 A4:6 -:2
          G4:3 A4:3 E5:5 C5:5
          B4:6 D5:4 G5:6
          E5:3 F5:3 C5:4 D5:4 -:2
        `,
        { double: "felt", compPat: "...2.........4..", drums: { t: "o..............." } }],
    },
    form: "A B",
  },
  // A minor · synth bass and syncopated arpeggios for the neon streets
  city: {
    bpm: 116, lead: "softLead", vol: 0.11, bass: "sub", bassVol: 0.16, comp: "softPluck", compVol: 0.046,
    pad: true, padType: "wide", padVol: 0.014, padPat: "x.......x.......", delay: 0.14,
    bassPat: "R.R..OR.R.R.F.R.", compPat: "012.2.1.13..2.1.",
    drums: { k: "x...x...x...x...", s: "....o.......x...", h: "..o...o...o...oo" },
    sections: {
      A: ["Am7 Fmaj7 Dm7 E7 Am7 Cmaj7 Fmaj7 E7",
        `
          -:2 E5:2 A5:3 E5:1 G5:2 C6:4 -:2
          A5:3 G5:1 E5:4 C5:6 -:2
          D5:2 F5:2 C6:3 A5:1 F5:2 E5:2 D5:4
          B4:2 D5:2 G#5:4 B5:3 G#5:3 -:2
          E5:2 A5:3 C6:3 E6:4 C6:2 G5:2
          B5:4 G5:2 E5:2 C5:5 -:3
          -:2 C5:2 F5:2 A5:2 E6:4 C6:4
          B5:4 G#5:2 E5:2 F5:3 E5:3 -:2
        `],
      B: ["Dm7 Am7 Fmaj7 E7 Dm7 Cmaj7 Fmaj7 E7",
        `
          A5:4 C6:3 A5:1 F5:6 D5:2
          E5:3 G5:3 C6:4 B5:2 A5:4
          C6:2 A5:2 F5:4 E5:6 -:2
          D5:3 E5:3 G#5:4 B5:4 -:2
          F5:2 A5:2 D6:4 E6:4 D6:4
          B5:3 G5:1 E5:4 C5:6 -:2
          A4:3 C5:3 E5:3 A5:3 G5:4
          G#5:4 E5:4 B4:4 -:4
        `,
        { lead: "keys", vol: 0.1, padType: "strings", padVol: 0.023, bassPat: "R...R.O.R...F...", compPat: "..1...2...4...1." }],
    },
    form: "A B",
  },
  // E minor · sparse bells, long reflections and isolated drops
  cave: {
    bpm: 65, lead: "bell", vol: 0.1, bass: "sub", bassVol: 0.076, comp: "bell", compVol: 0.023,
    pad: true, padType: "strings", padVol: 0.023, delay: 0.39, bassPat: "R...............", compPat: "............2...",
    drums: { d: "......o........o" },
    sections: {
      A: ["Em7 Cmaj7 Am7 Bsus Em7 Cmaj7 Am7 B7",
        `
          B5:3 -:5 G5:4 E5:4
          D6:3 -:5 B5:5 -:3
          A5:3 C6:3 E6:5 -:5
          F#5:4 -:3 E5:5 B4:4
          -:2 E5:4 G5:4 B5:3 -:3
          D6:3 E6:3 G6:4 D6:4 -:2
          C6:4 E5:3 A5:5 G5:4
          D#5:4 F#5:3 B5:4 -:5
        `],
      B: ["Em7 Gadd9 Cmaj7 Bm7 Am7 Cmaj7 Bsus B7",
        `
          E6:3 B5:3 G5:3 E5:3 -:4
          A5:4 D6:4 B5:3 G5:5
          E6:2 -:4 B5:4 D6:4 -:2
          A5:4 F#5:4 D5:4 -:4
          C6:4 A5:4 E5:4 C5:4
          G5:5 B5:5 E6:4 -:2
          F#6:3 E6:3 B5:4 F#5:4 -:2
          D#5:4 B4:4 -:8
        `,
        { double: "felt", compPat: "........4.......", drums: { d: "....o.........o." } }],
    },
    form: "A B",
  },
  // C minor · low organ and weighty bell tolls in the bone chapels
  crypt: {
    bpm: 66, lead: "organ", vol: 0.092, bass: "sub", bassVol: 0.106, comp: "bell", compVol: 0.022,
    pad: true, padVol: 0.026, padType: "organ", delay: 0.37, bassPat: "R.........F.....", compPat: "............2...",
    drums: { b: "o..............." },
    sections: {
      A: ["Cm Abmaj7 Fm G7 Cm Eb Abmaj7 G7",
        `
          C4:6 Eb4:3 D4:3 C4:4
          G4:6 Eb4:4 C4:4 -:2
          F4:5 Ab4:3 G4:3 F4:5
          D4:6 B3:4 -:6
          G4:4 C5:5 Bb4:3 G4:4
          Eb4:6 G4:3 Bb4:4 G4:3
          Ab4:4 G4:4 Eb4:4 C4:4
          D4:4 F4:4 B3:5 -:3
        `],
      B: ["Fm Cm Abmaj7 G7 Cm Fm Abmaj7 G7",
        `
          Ab4:5 C5:3 F5:6 -:2
          Eb5:4 C5:4 G4:4 Bb4:4
          C5:5 G4:3 Eb4:6 -:2
          F4:5 D4:3 B3:6 -:2
          C4:3 Eb4:3 G4:4 C5:6
          Ab4:5 F4:4 C4:5 -:2
          Eb4:4 G4:4 C5:4 G4:4
          F4:4 D4:4 B3:4 -:4
        `,
        { lead: "felt", double: "organ", vol: 0.105, padType: "strings", padVol: 0.027, bassPat: "R.......F...O...", drums: { b: "........o......." } }],
    },
    form: "A B",
  },
  // G minor · lopsided percussion and short water-drop phrases
  sewer: {
    bpm: 93, lead: "keys", vol: 0.1, bass: "sub", bassVol: 0.154, comp: "softPluck", compVol: 0.036, delay: 0.24, swing: 0.14,
    bassPat: "R.....R..F..T...", compPat: "...2....1.....2.",
    drums: { k: "o.....o...o.....", s: ".....o......o...", d: "..o.....o......o" },
    sections: {
      A: ["Gm7 Ebmaj7 Cm7 D7 Gm7 Ab Ebmaj7 D7",
        `
          G4:3 -:2 Bb4:3 A4:2 D5:3 -:3
          Bb4:3 G4:3 D5:3 Eb5:2 Bb4:3 -:2
          C5:2 G4:3 Eb5:3 D5:3 C5:4 -:1
          A4:3 D5:3 C5:3 F#4:4 -:3
          G4:3 -:1 Bb4:2 D5:2 F5:3 D5:3 -:2
          C5:3 Ab4:2 Eb5:3 C5:4 -:4
          Bb4:3 D5:3 G5:2 F5:3 Eb5:3 -:2
          D5:3 C5:2 A4:3 F#4:4 -:4
        `],
      B: ["Cm7 Gm7 Ebmaj7 D7 Gm7 Cm7 Ab D7",
        `
          Eb5:3 G5:3 Bb5:2 G5:3 D5:3 -:2
          Bb4:3 D5:3 F5:2 G5:4 -:4
          -:2 G4:3 Bb4:3 D5:4 Bb4:4
          A4:2 F#4:2 E4:3 A4:3 D5:4 -:2
          D5:3 Bb4:3 F5:4 G5:3 -:3
          C5:3 D5:2 Eb5:3 G4:4 -:4
          Eb5:3 Ab5:3 G5:2 Eb5:4 C5:4
          D5:3 A4:3 F#4:3 D4:4 -:3
        `,
        { lead: "softLead", double: "felt", vol: 0.092, drums: { k: "o.........o.....", s: ".....o......o...", d: "..o.......o....." } }],
    },
    form: "A B",
  },
  // D Phrygian · a broken pulse beneath suspended dissonance
  abyss: {
    bpm: 72, lead: "dark", vol: 0.079, bass: "sub", bassVol: 0.115, comp: "organ", compVol: 0.023,
    pad: true, padVol: 0.023, padTritone: true, delay: 0.34, bassPat: "R.......R...L...", compPat: "..........1.....",
    drums: { hb: "x..o............" },
    sections: {
      A: ["Dm Eb Dm Cm Bbmaj7 Eb Dm A7",
        `
          A4:6 Eb4:2 D4:6 -:2
          G4:5 F4:3 Eb4:4 Bb3:4
          -:3 D4:3 A4:5 Ab4:5
          G4:6 D4:4 C4:4 -:2
          F4:6 A4:4 Bb4:4 -:2
          G4:5 Eb4:3 D4:6 -:2
          A4:4 D5:4 C5:4 A4:4
          Bb4:4 A4:4 G4:4 C#4:4
        `],
      B: ["Dm Eb Cm Dm Bbmaj7 Eb Dm A7",
        `
          D5:4 -:2 Eb5:4 D5:6
          Bb4:4 G4:5 F4:3 Eb4:4
          C5:4 Ab4:4 G4:5 -:3
          A4:5 D4:3 F4:4 Eb4:4
          F5:5 D5:3 A4:4 Bb4:4
          Eb5:4 D5:4 Bb4:4 G4:4
          F4:4 Ab4:4 A4:6 -:2
          G4:4 Bb4:4 C#4:5 -:3
        `,
        { lead: "felt", double: "strings", vol: 0.094, padType: "dark", padVol: 0.019, drums: { hb: "x..o......o....." } }],
    },
    form: "A B",
  },
  // E minor, 148 — a boss on screen
  boss: {
    bpm: 148, lead: "softLead", vol: 0.128, bass: "saw", comp: "softPluck", pad: true, padType: "wide", padVol: 0.023, padPat: "x.......x.......", delay: 0.08,
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
    bpm: 138, lead: "softLead", vol: 0.12, bass: "sub", bassVol: 0.13, comp: "softPluck", pad: true, padType: "wide", padVol: 0.022, padPat: "x.....o...x.....", delay: 0.1,
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

  cafe: {
    bpm: 84, lead: "bell", vol: 0.1, bass: "tri", comp: "pluck", compVol: 0.035, pad: true, padVol: 0.02, delay: 0.16,
    bassPat: "R.......F.......", compPat: "....1.2.....1.2.",
    drums: { h: "....o.......o..." },
    sections: {
      A: ["D Bm G A D Bm Em A",
        "F#5:6 A5:2 D6:8  B5:4 A5:4 F#5:8  G5:6 B5:2 D6:4 B5:4  A5:12 -:4  F#5:6 A5:2 D6:4 E6:4  D6:4 B5:4 F#5:8  G5:4 E5:4 G5:4 B5:4  A5:12 -:4"],
      B: ["G A F#m Bm G A D D",
        "B5:6 A5:2 G5:8  C#6:6 B5:2 A5:8  A5:4 F#5:4 C#5:8  D5:4 F#5:4 B5:8  B5:4 D6:4 G5:8  A5:4 C#6:4 E6:8  D6:8 A5:8  F#5:12 -:4"],
    },
    form: "A B A",
  },
  hall: {
    bpm: 76, lead: "flute", vol: 0.09, bass: "organ", comp: "organ", compVol: 0.025, pad: true, padType: "organ", padVol: 0.02, delay: 0.22,
    bassPat: "R.......R.......", compPat: "0...1...2...1...",
    sections: {
      A: ["Bb F Gm Eb Bb F Eb F",
        "D5:8 F5:8  C5:8 A4:8  Bb4:4 D5:4 G5:8  G5:8 Eb5:8  F5:8 D5:8  C5:4 A4:4 F5:8  Eb5:4 G5:4 Bb5:8  A5:12 -:4"],
      B: ["Gm Eb Bb F Gm Cm F Bb",
        "G5:8 Bb5:8  G5:8 Eb5:8  F5:4 D5:4 Bb4:8  C5:12 -:4  D5:8 G5:8  Eb5:8 C5:8  A4:4 C5:4 F5:8  D5:12 -:4"],
    },
    form: "A B",
  },
  inn: {
    bpm: 92, lead: "flute", vol: 0.1, bass: "tri", comp: "pluck", compVol: 0.04, pad: false, delay: 0.14,
    bassPat: "R.....F.R.....F.", compPat: "..2.1...2.2.1...",
    drums: { k: "x...............", h: "......o.......o." },
    sections: {
      A: ["G C G D G C D G",
        "B4:4 D5:4 G5:6 F#5:2  E5:4 G5:4 C5:8  B4:4 D5:4 G5:4 B5:4  A5:12 -:4  B5:6 A5:2 G5:4 E5:4  E5:4 G5:4 C6:8  B5:4 A5:4 F#5:4 D5:4  G5:12 -:4"],
      B: ["Em C G D Em C D D",
        "E5:6 F#5:2 G5:8  E5:4 C5:4 E5:8  D5:4 G5:4 B5:8  A5:6 G5:2 F#5:8  G5:6 A5:2 B5:8  C6:4 B5:4 A5:8  F#5:4 A5:4 D6:8  D6:12 -:4"],
    },
    form: "A B A",
  },
  dim: {
    bpm: 116, lead: "dark", vol: 0.1, bass: "tri", comp: null, pad: true, padVol: 0.03, padTritone: true, delay: 0.3,
    bassPat: "R.R.O.R.R.R.F.T.",
    drums: { k: "x...x...x...x...", s: "....o.......o...", h: "..o...o...o...o." },
    sections: {
      A: ["Em Em F F Em Em D B",
        "E5:2 -:2 G5:2 -:2 F5:2 E5:2 B4:4  E5:4 F5:2 G5:2 B5:8  C6:2 -:2 B5:2 A5:2 F5:4 A5:4  G5:2 F5:2 E5:4 F5:8  E5:2 -:2 G5:2 -:2 B5:2 C6:2 B5:4  G5:4 F5:2 E5:2 G5:8  F#5:2 -:2 A5:2 -:2 D6:4 C6:4  B5:8 D#5:4 F#5:4"],
      B: ["Am Am Em Em F G B B",
        "A5:4 C6:4 E6:4 C6:4  B5:2 A5:2 G5:4 A5:8  G5:4 B5:4 E6:4 B5:4  A5:2 G5:2 F#5:4 E5:8  F5:4 A5:4 C6:4 A5:4  G5:4 B5:4 D6:4 B5:4  B5:4 A5:4 F#5:4 D#5:4  B4:12 -:4"],
    },
    form: "A B",
  },
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
  town_night: {
    bpm: 72, lead: "bell", vol: 0.1, bass: "tri", comp: "pluck", pad: true, padVol: 0.022, delay: 0.24,
    bassPat: "R.......F.......", compPat: "0...2...1...2...", compVol: 0.03,
    sections: {
      A: ["F Dm Bb C F Am Bb C",
        "A4:6 C5:2 F5:8  E5:4 D5:4 A4:8  D5:6 F5:2 Bb5:8  A5:4 G5:4 E5:8  F5:6 A5:2 C6:8  C6:4 B5:2 A5:2 E5:8  D5:4 F5:4 Bb5:4 A5:4  G5:12 -:4"],
    },
    form: "A A",
  },
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
