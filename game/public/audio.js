/**
 * Sound synthesised on the fly with Web Audio. Music is scored in bgm.js.
 *
 * Music: every map has its own composed loop (melody, bass, chords, drums),
 * plus a title theme, a boss theme and a rift-invasion theme. Notes are
 * scheduled a little ahead on the audio clock, and tracks crossfade.
 * Effects: a named catalogue, played through a voice limiter.
 */

import { TRACKS } from "./bgm.js";

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
/** MIDI notes of the chord rooted in octave 3. */
function chord(sym) {
  const m = /^([A-G])([#b]?)(maj7|m7|add9|m|7|dim|sus)?$/.exec(sym);
  if (!m) throw new Error("Invalid chord " + sym);
  const root = 48 + PITCH[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const q = m[3] || "";
  const third = ["m", "m7", "dim"].includes(q) ? 3 : q === "sus" ? 5 : 4, fifth = q === "dim" ? 6 : 7;
  const tones = [root, root + third, root + fifth];
  if (q === "7" || q === "m7") tones.push(root + 10);
  if (q === "maj7") tones.push(root + 11);
  if (q === "add9") tones.push(root + 14);
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

/** Per-track level trims, measured by rendering each offline, so all sit near the same loudness. */
const TRIM = { city: 1.6, rift: 1.55, boss: 1.45, cave: 1.5, crypt: 1.15 };
/** Old names some maps still carry. */
const ALIAS = { field: "meadow" };

/** Unroll a track into bars: [{ chord: [midi…], notes: [[hz, step, len]…] }]. */
function compile(def) {
  const bars = [];
  for (const name of def.form.split(/\s+/)) {
    const [chords, mel, arrangement] = def.sections[name];
    const parts = arrangement ? { ...def, ...arrangement } : def;
    const syms = chords.split(/\s+/);
    const notes = melody(mel);
    syms.forEach((sym, b) => bars.push({ chord: chord(sym), parts, notes: notes.filter((n) => n[1] >= b * 16 && n[1] < (b + 1) * 16).map((n) => [n[0], n[1] - b * 16, n[2]]) }));
  }
  return bars;
}
const SONGS = {};
for (const k of Object.keys(TRACKS)) SONGS[k] = compile(TRACKS[k]);

/** For the test page: every section's melody must fill exactly its bars. */
export function checkTracks() {
  const bad = [];
  for (const [k, def] of Object.entries(TRACKS)) {
    for (const [name, [chords, mel, arrangement]] of Object.entries(def.sections)) {
      const label = k + "." + name;
      const want = chords.split(/\s+/).length * 16, notes = melody(mel);
      if (notes.total !== want) bad.push(label + " has " + notes.total + "/" + want + " melody steps");
      if (notes.some(([f, at, len]) => !f || len <= 0 || at % 16 + len > 16)) bad.push(label + " has an invalid note");
      const parts = { ...def, ...arrangement };
      for (const [pattern, syntax] of [[parts.bassPat, /^[RFOTL.]{16}$/], [parts.compPat, /^[0-4.]{16}$/], [parts.padPat, /^[xo.]{16}$/]]) {
        if (pattern && !syntax.test(pattern)) bad.push(label + " has an invalid pattern " + pattern);
      }
      for (const [drum, pattern] of Object.entries(parts.drums || {})) {
        if (!/^(k|s|h|t|d|b|hb)$/.test(drum) || !/^[xo.]{16}$/.test(pattern)) bad.push(label + " has an invalid drum pattern " + drum);
      }
    }
  }
  return bad;
}
export const TRACK_NAMES = Object.keys(TRACKS);
export const BGM_KEYS = [...TRACK_NAMES, ...Object.keys(ALIAS)];

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
    this.load();
    this.init(new AC());
    // nothing plays in a hidden tab
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
    this.timer = setInterval(() => this.pump(), 50);
    this.pick();
  },
  /** Set up the same mix graph for live audio and offline score previews. */
  init(c) {
    this.ctx = c;
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
  /** Crossfade to whichever track should be playing now. */
  pick() {
    const want = this.theme || this.base || "title";
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
    // a campfire nearby crackles and pops now and then
    if (this.amb > 0.02 && !this.vol.mute) {
      if (this.ambNext < now) this.ambNext = now;
      while (this.ambNext < now + LOOKAHEAD) {
        this.crackle(this.ambNext, this.amb);
        this.ambNext += 0.07 + Math.random() * 0.3;
      }
    }
  },
  /** Everything that sounds on one sixteenth step of a track. */
  tick(p, t, s16) {
    const bars = p.song, bar = bars[Math.floor(p.step / 16) % bars.length], i = p.step % 16;
    const def = bar.parts, out = p.gain, ch = bar.chord;
    if (i % 2) t += (def.swing || 0) * s16;
    for (const [f, at, len] of bar.notes) if (at === i) this.inst(def.lead, f, t, len * s16, def.vol, out);
    const bc = def.bassPat && def.bassPat[i];
    if (bc && bc !== ".") {
      const root = ch[0] - 12, k = bc === "R" ? root : bc === "F" ? root + 7 : bc === "O" ? root + 12 : bc === "T" ? ch[1] - 12 : root - 12;
      let len = 1; while (i + len < 16 && def.bassPat[i + len] === ".") len++;
      this.inst(def.bass, midiHz(k), t, Math.min(len, 8) * s16 * 0.95, def.bassVol ?? (def.bass === "saw" ? 0.07 : def.bass === "organ" ? 0.05 : 0.2), out);
    }
    const cc = def.compPat && def.compPat[i];
    if (def.comp && cc && cc !== ".") {
      const k = Number(cc), n = k === 3 ? ch[0] + 12 : ch[k === 4 ? Math.min(3, ch.length - 1) : k];
      this.inst(def.comp, midiHz(n + 12), t, s16 * 1.6, def.compVol || 0.045, out);
    }
    const padPat = def.padPat || "x...............";
    if (def.pad && padPat[i] !== ".") {
      let len = 1;
      while (i + len < 16 && padPat[i + len] === ".") len++;
      const tones = def.padTritone ? [...ch, ch[0] + 6] : ch;
      const volume = (def.padVol || 0.035) * (padPat[i] === "o" ? 0.55 : 1);
      for (const n of tones) this.inst(def.padType || "pad", midiHz(n + 12), t, s16 * len, volume, out);
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
      case "sub": osc("sine", f).connect(g); osc("triangle", f * 2, 0.2).connect(g); env(0.012, 0.78, 0.09); break;
      case "keys": {
        const lp = lowpass(Math.min(3400, f * 6));
        osc("sine", f, 0.76, -2).connect(lp);
        osc("triangle", f, 0.32, 3).connect(lp);
        const tine = c.createGain();
        tine.gain.setValueAtTime(0.34, t);
        tine.gain.exponentialRampToValueAtTime(0.006, t + 0.14);
        osc("sine", f * 3, 0.62).connect(tine);
        tine.connect(lp);
        env(0.006, 0.38, 0.16);
        break;
      }
      case "wide": {
        const lp = lowpass(2600);
        lp.frequency.setValueAtTime(1300, t);
        lp.frequency.exponentialRampToValueAtTime(2650, t + 0.09);
        for (const detune of [-13, 0, 13]) {
          const pan = c.createStereoPanner();
          pan.pan.value = detune / 15;
          osc("sawtooth", f, 0.33, detune).connect(pan);
          pan.connect(lp);
        }
        env(0.028, 0.58, 0.08);
        break;
      }
      case "tri": osc("triangle", f).connect(g); env(0.004, 0.8, 0.05); break;
      case "saw": { const lp = lowpass(f * 6, 2); osc("sawtooth", f).connect(lp); env(0.004, 0.7, 0.05); break; }
      case "softPluck": {
        const lp = lowpass(2600);
        osc("triangle", f, 0.75).connect(lp);
        osc("sine", f * 2, 0.16).connect(lp);
        osc("sine", f * 3, 0.08).connect(lp);
        env(0.008, 0.18, 0.085);
        break;
      }
      case "softLead": {
        const lp = lowpass(2100);
        osc("triangle", f, 0.74, -4).connect(lp);
        osc("sine", f, 0.44, 4).connect(lp);
        osc("sine", f * 2, 0.16).connect(lp);
        env(0.024, 0.68, 0.13);
        break;
      }
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
