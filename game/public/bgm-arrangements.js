// Acoustic arrangements of the original map themes. Keep the notes and harmony
// in bgm.js so a player can change instruments without learning a different tune.
import { TRACKS } from "./bgm.js";

export const MUSIC_STYLES = ["newAge", "classic"];
export const DEFAULT_MUSIC_STYLE = "newAge";

const RIPPLE = "0.2.1.2.4.2.1.2.";
const WAVE = "0..2..1.4..2..1.";
const SPARSE = "0.......2...4...";
const WALTZ = "0...2.1.4...2.1.";
const TREAD = "0.2...1.4...2...";

const ROOM = {
  lead: "grand", vol: 0.15,
  bass: "grand", bassVol: 0.13, bassPat: "R.......F.......",
  comp: "harp", compVol: 0.066, compPat: WAVE,
  pad: true, padType: "bowed", padVol: 0.028,
  delay: 0.23, trim: 1.16, expressive: true,
};
const CHAMBER = {
  bass: "bowed", bassVol: 0.12, bassPat: "R...............",
  comp: "grand", compVol: 0.062, compPat: SPARSE,
  padVol: 0.038, delay: 0.33,
};
const PULSE = {
  bass: "bowed", bassVol: 0.14, bassPat: "R.....F.O...R...",
  comp: "harp", compPat: TREAD, padVol: 0.035,
  drums: { t: "o...........o..." }, trim: 1.10,
};
const ARRANGEMENTS = {
  title: { bpm: 94, comp: "grand", compPat: RIPPLE, openingPad: false },
  town: { bpm: 76, compPat: WALTZ, padVol: 0.019, openingPad: false },
  willow: { bpm: 70, compPat: RIPPLE, compVol: 0.071, delay: 0.25, openingPad: false, reply: "flute" },
  juju: { bpm: 99, lead: "harp", comp: "grand", compPat: WALTZ, padVol: 0.019 },
  clean: { bpm: 104, lead: "harp", comp: "grand", compPat: TREAD, pad: false },
  forge: { ...PULSE, bpm: 108, lead: "grand", comp: "grand", compPat: WAVE, delay: 0.18 },
  move: { bpm: 103, lead: "flute", comp: "grand", compPat: WALTZ, padVol: 0.019 },
  brew: { ...CHAMBER, bpm: 88, lead: "harp", compPat: RIPPLE, delay: 0.23 },
  meadow: { bpm: 102, lead: "flute", vol: 0.13, comp: "grand", compPat: RIPPLE, padVol: 0.024 },
  forest: { ...CHAMBER, bpm: 74, lead: "flute", vol: 0.12, compPat: WAVE },
  crypt: { ...CHAMBER, bpm: 66, lead: "grand", comp: "harp", padTritone: true, delay: 0.36 },
  city: { ...PULSE, bpm: 102, comp: "grand", compPat: TREAD, delay: 0.21 },
  sewer: { ...CHAMBER, bpm: 82, lead: "harp", compPat: TREAD, padTritone: true },
  cave: { ...CHAMBER, bpm: 61, lead: "grand", comp: "harp", compPat: "....2.......4...", delay: 0.4, openingPad: false },
  abyss: { ...CHAMBER, bpm: 67, lead: "bowed", vol: 0.19, compPat: TREAD, padTritone: true, reply: "grand" },
  autumn: { bpm: 79, lead: "flute", vol: 0.13, comp: "grand", compPat: WALTZ, padVol: 0.03 },
  dim: { ...PULSE, bpm: 103, compPat: RIPPLE, reply: "bowed", delay: 0.32 },
  boss: { ...PULSE, bpm: 122, lead: "bowed", vol: 0.16, comp: "grand", compPat: RIPPLE, drums: { t: "o.....o.x...o..." } },
  rift: { ...PULSE, bpm: 112, lead: "grand", compPat: RIPPLE, reply: "bowed" },
  cafe: { bpm: 78, lead: "grand", compPat: WALTZ, pad: false },
  hall: { bpm: 74, lead: "grand", compPat: SPARSE, padVol: 0.028 },
  inn: { bpm: 70, lead: "harp", comp: "grand", compPat: WAVE, openingPad: false },
  town_night: { bpm: 68, lead: "grand", compPat: SPARSE, padVol: 0.019, openingPad: false },
  field_night: { ...CHAMBER, bpm: 64, lead: "flute", vol: 0.13, openingPad: false },
};

export function arrangedTrack(name, style) {
  const original = TRACKS[name];
  if (style === "classic") return original;
  const { openingPad = true, reply, ...parts } = ARRANGEMENTS[name] || {};
  const sections = Object.fromEntries(Object.entries(original.sections).map(([id, [chords, melody]], i) => {
    const dynamics = i ? { double: reply } : { pad: openingPad && (parts.pad ?? ROOM.pad), compVol: (parts.compVol ?? ROOM.compVol) * 0.8 };
    return [id, [chords, melody, dynamics]];
  }));
  return { bpm: original.bpm, rustle: original.rustle, form: original.form, ...ROOM, ...parts, sections };
}
