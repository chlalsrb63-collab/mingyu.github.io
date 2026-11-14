// Original looping scores. Each section holds chord symbols, a melody, and optional
// arrangement overrides. A chord and one line of melody span 16 sixteenth notes.
// E5:4 is four steps and -:4 is a rest. The form gives the repeating section order.
// Patterns have 16 steps: . rests, R/F/O/T/L select bass tones, and 0–4 select
// accompaniment tones (root/third/fifth/octave/seventh). Drums and pads use x/o
// for hits or soft hits. See audio.js for the Web Audio voices and scheduler.

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
        { lead: "duo", vol: 0.084, comp: null, bassPat: "R.....R...O.F...", padType: "wide", padVol: 0.039,
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
    pad: true, padType: "organ", padVol: 0.014, delay: 0.15, swing: 0.16,
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
        { comp: "bell", compVol: 0.025, compPat: "......1.....4...", bassPat: "R.......F.....O." }],
    },
    form: "A B",
  },
  // G major · bright woodwinds and plucked strings in the open fields
  meadow: {
    bpm: 114, lead: "flute", vol: 0.105, bass: "tri", comp: "pluck", compVol: 0.032, delay: 0.14,
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
        { comp: "bell", compVol: 0.023, compPat: "......2.......1." }],
    },
    form: "A B",
  },
  // D Dorian · quiet flute calls and suspended, breathing harmony
  forest: {
    bpm: 78, lead: "flute", vol: 0.103, bass: "sub", bassVol: 0.097, comp: "bell", compVol: 0.022,
    pad: true, padVol: 0.023, delay: 0.37, bassPat: "R.........F.....", compPat: "......2.......1.",
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
        { compPat: "...2.........4..", drums: { t: "o..............." } }],
    },
    form: "A B",
  },
  // A minor · synth bass and syncopated arpeggios for the neon streets
  city: {
    bpm: 116, lead: "duo", vol: 0.08, bass: "saw", bassVol: 0.1, comp: "pulse12", compVol: 0.031,
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
        { lead: "keys", vol: 0.09, bassPat: "R...R.O.R...F...", compPat: "..1...2...4...1." }],
    },
    form: "A B",
  },
  // E minor · sparse bells, long reflections and isolated drops
  cave: {
    bpm: 65, lead: "bell", vol: 0.1, bass: "sub", bassVol: 0.076, comp: "bell", compVol: 0.023,
    pad: true, padVol: 0.025, delay: 0.48, bassPat: "R...............", compPat: "............2...",
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
        { compPat: "........4.......", drums: { d: "....o.........o." } }],
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
        { bassPat: "R.......F...O...", drums: { b: "........o......." } }],
    },
    form: "A B",
  },
  // G minor · lopsided percussion and short water-drop phrases
  sewer: {
    bpm: 93, lead: "keys", vol: 0.1, bass: "sub", bassVol: 0.154, comp: "pulse12", compVol: 0.025, delay: 0.24, swing: 0.14,
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
        { lead: "duo", vol: 0.065, drums: { k: "o.........o.....", s: ".....o......o...", d: "..o.......o....." } }],
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
        { padType: "dark", padVol: 0.019, drums: { hb: "x..o......o....." } }],
    },
    form: "A B",
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
};
