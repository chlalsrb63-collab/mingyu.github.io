// Original chamber themes for the coast loop. Each line is one 16-step bar.
export const COAST_THEMES = {
  jungle: {
    bpm: 92, lead: "felt", vol: 0.14, bass: "felt", bassVol: 0.115, bassPat: "R.....F.O.......",
    comp: "softPluck", compVol: 0.054, compPat: "0.2...1.4...2...", pad: false, padType: "strings", padVol: 0.021, delay: 0.20,
    sections: {
      A: ["Dm7 Gsus Cmaj7 Am7 Dm7 G7 Cmaj7 A7",
        `
          A4:2 C5:2 D5:4 F5:3 E5:1 D5:4
          D5:3 G5:3 A5:4 D5:4 -:2
          E5:2 G5:2 B5:4 A5:4 G5:4
          E5:4 C5:2 B4:2 A4:6 -:2
          F4:2 A4:2 D5:4 F5:3 A5:3 G5:2
          G5:3 F5:3 D5:4 B4:4 -:2
          E5:3 G5:3 B5:6 G5:4
          C#5:3 E5:3 G5:2 E5:2 A4:4 -:2
        `],
      B: ["Fmaj7 Gsus Dm7 Am7 Fmaj7 Cmaj7 G7 Dm7",
        `
          C5:3 F5:3 A5:5 G5:3 -:2
          D5:2 G5:4 D6:6 C6:4
          A5:3 F5:3 E5:2 D5:6 -:2
          C5:2 E5:2 A5:5 G5:3 E5:4
          A4:2 C5:2 F5:4 E5:4 D5:4
          E5:3 G5:3 B5:4 D6:4 -:2
          D6:3 B5:3 A5:4 G5:4 -:2
          F5:3 E5:3 D5:6 -:4
        `,
        { lead: "flute", double: "felt", vol: 0.115, pad: true, compVol: 0.046 }],
    }, form: "A B",
  },
  coast: {
    bpm: 84, lead: "flute", vol: 0.112, bass: "felt", bassVol: 0.104, bassPat: "R.......F.......",
    comp: "felt", compVol: 0.060, compPat: "0.2.1.2.4.2.1.2.", pad: false, padType: "strings", padVol: 0.020, delay: 0.29,
    sections: {
      A: ["Fadd9 Cmaj7 Dm7 Bbmaj7 Gm7 Fadd9 Bbmaj7 C7",
        `
          -:2 A4:2 C5:4 G5:4 F5:4
          E5:4 G5:3 B5:3 G5:4 -:2
          F5:3 A5:3 C6:6 A5:4
          F5:3 D5:3 C5:2 Bb4:6 -:2
          Bb4:2 D5:2 F5:4 A5:4 G5:4
          A5:4 G5:2 F5:4 C5:4 -:2
          D5:2 F5:2 A5:4 Bb5:4 F5:4
          E5:4 G5:3 Bb5:3 G5:4 -:2
        `],
      B: ["Dm7 Am7 Bbmaj7 Fadd9 Gm7 Dm7 C7 Fadd9",
        `
          -:2 A5:2 C6:4 D6:4 A5:4
          G5:3 E5:3 C5:4 A4:6
          C5:3 D5:3 F5:6 A5:4
          G5:2 F5:2 A5:4 C6:6 -:2
          Bb5:3 G5:3 A5:2 D5:6 -:2
          F5:4 E5:2 D5:6 A4:4
          E5:2 G5:2 Bb5:4 G5:4 E5:4
          G5:3 F5:8 -:5
        `,
        { lead: "felt", double: "softPluck", vol: 0.147, pad: true, compVol: 0.050 }],
    }, form: "A B",
  },
  oasis: {
    bpm: 74, lead: "felt", vol: 0.152, bass: "felt", bassVol: 0.122, bassPat: "R.........F.....",
    comp: "softPluck", compVol: 0.052, compPat: "0..2..1.4..2..1.", pad: false, padType: "strings", padVol: 0.024, delay: 0.33,
    sections: {
      A: ["Am7 Fmaj7 Cmaj7 E7 Am7 Dm7 Fmaj7 E7",
        `
          E5:4 C5:3 B4:1 A4:6 -:2
          C5:3 E5:3 A5:4 G5:4 -:2
          G5:2 E5:2 D5:4 B4:4 C5:4
          B4:3 D5:3 G#5:4 E5:4 -:2
          C5:3 B4:1 A4:4 E5:5 C5:3
          D5:2 F5:4 A5:4 G5:3 F5:3
          E5:4 F5:2 A5:4 C6:4 -:2
          B5:3 E5:3 G#5:4 B4:4 -:2
        `],
      B: ["Fmaj7 Cmaj7 Dm7 Am7 Fmaj7 Dm7 E7 Am7",
        `
          A5:3 C6:3 E6:6 C6:4
          B5:5 G5:3 E5:4 -:4
          F5:3 A5:3 D6:4 C6:3 A5:3
          E5:4 C5:2 B4:2 A4:6 -:2
          C5:3 F5:3 A5:6 G5:4
          F5:2 D5:2 F5:4 A5:4 E5:4
          D5:3 B4:3 G#4:6 B4:4
          C5:3 B4:1 A4:8 -:4
        `,
        { lead: "flute", double: "felt", vol: 0.112, pad: true, compVol: 0.043 }],
    }, form: "A B",
  },
};
