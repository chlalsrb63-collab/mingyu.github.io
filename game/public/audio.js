/**
 * The game's Web Audio score player and synthesised effects.
 *
 * Music: every map has its own composed loop (melody, bass, chords, drums),
 * plus a title theme, a boss theme and a rift-invasion theme. Notes are
 * scheduled a little ahead on the audio clock, and tracks crossfade.
 * Effects: a named catalogue, played through a voice limiter.
 */

import { TRACKS } from "./bgm.js";
import { arrangedTrack, DEFAULT_MUSIC_STYLE, MUSIC_STYLES } from "./bgm-arrangements.js";
import { LOCAL_BGM_PATH, localHost } from "./local-host.js";
import { ready as assetsReady } from "./assetlib.js";

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

// ───────────────────────────── the compositions ─────────────────────────────
// Each track: tempo, which instruments play the parts, the patterns they play
// over each bar's chord, and sections of 8 bars (chords + melody) in a form.
// Patterns are 16 sixteenth-steps per bar. Bass: R root, F fifth, O octave,
// T third, L the root an octave down, . nothing. Comp: digits pick chord
// tones (0 root, 1 third, 2 fifth, 3 octave). Drums: x hit, o soft hit.

/** The calmer tune a map's music turns into after dark. */
const NIGHT = { town: "town_night", meadow: "field_night", forest: "field_night" };
/** Per-track level trims, measured by rendering each offline, so all sit near the same loudness. */
const TRIM = { cafe: 1.2, hall: 1.2, inn: 1.15, city: 1.6, rift: 1.55, boss: 1.45, cave: 1.5, crypt: 1.15 };
/** Old names some maps still carry. */
const ALIAS = { field: "meadow", coop_apt: "clean", coop_diner: "juju", coop_forge: "forge", coop_lib: "cafe" };
const DIM_RECORDINGS = new Set(["crypt", "sewer", "cave", "abyss"]);
const RECORDING_KEY = /^[a-z][a-z0-9_]*$/;
const RECORDING_SRC = /^assets\/music\/[a-z][a-z0-9_]*-[a-f0-9]{12}\.(mp3|ogg|wav)$/i;
const localTrack = ([file, start, end]) => ({ src: `/__local-bgm/${encodeURI(file)}`, start, end, loose: true });

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
const styleOf = (value) => MUSIC_STYLES.includes(value) ? value : DEFAULT_MUSIC_STYLE;
const SCORES = Object.fromEntries(MUSIC_STYLES.map((style) => [style, Object.fromEntries(Object.keys(TRACKS).map((key) => {
  const def = arrangedTrack(key, style);
  return [key, { def, song: compile(def) }];
}))]));
export { MUSIC_STYLES, DEFAULT_MUSIC_STYLE };

/** For the test page: every section's melody must fill exactly its bars. */
export function checkTracks(style = DEFAULT_MUSIC_STYLE) {
  const bad = [];
  for (const [k, { def }] of Object.entries(SCORES[styleOf(style)])) {
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
  base: null, mapScore: null, theme: null, playing: [], timer: 0,
  recordings: null, localScores: {}, recordingRequest: null,
  voices: 0, last: {}, k: 1, amb: 0, ambNext: 0, noiseBuf: null, waves: {},

  /** Browsers only allow audio after a gesture — call this from a click/keypress. */
  unlock() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.load();
    this.init(new AC());
    this.resume();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.ctx.suspend().catch(() => {}); else this.resume();
    });
    this.timer = setInterval(() => this.pump(), 50);
    assetsReady().then(manifest => {
      this.recordings = manifest.bgm || {};
      this.localScores = manifest.bgmLocal || {};
      this.pick();
    }).catch(() => {});
  },
  resume() {
    if (!document.hidden && this.ctx.state !== "running" && this.ctx.state !== "closed") this.ctx.resume().catch(() => {});
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
  load() { try { Object.assign(this.vol, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch { /* defaults */ } delete this.vol.style; this.sfxOn = this.bgmOn = !this.vol.mute; return this.vol; },

  // ── music ──
  /** The map's own music: its id has a track, or else its `fallback` name does. */
  bgm(name, fallback, terrain) {
    const own = (k) => Object.hasOwn(TRACKS, k) ? k : Object.hasOwn(ALIAS, k) ? ALIAS[k] : null;
    this.mapScore = fallback === "dim" && name?.startsWith("dim:") && DIM_RECORDINGS.has(terrain)
      ? `dim_${terrain}` : RECORDING_KEY.test(name) ? name : fallback;
    this.base = own(name) || own(fallback) || "meadow";
    this.pick();
  },
  /** A theme over the map's music — "boss", "rift" — or null to go back. */
  setTheme(name) { if (this.theme === name) return; this.theme = name; this.pick(); },
  /** Night falls (or lifts) outdoors: the map's music crossfades to its night variant and back. */
  setNight(on) { on = !!on; if (this.night === on) return; this.night = on; this.pick(); },
  fadeOut(track, time, fade) {
    if (!track) return;
    const gain = track.gain.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(time);
    else { const value = gain.value; gain.cancelScheduledValues(time); gain.setValueAtTime(value, time); }
    gain.linearRampToValueAtTime(0, time + fade);
    track.dying = time + fade + 0.1;
  },
  recordingChoices(key, loose) {
    const local = loose ? this.localScores[key] : null;
    const variants = typeof local === "string" ? this.localScores[local] : local;
    const list = Array.isArray(variants) ? variants : [];
    const offset = list.length > 1 ? Math.floor(Math.random() * list.length) : 0;
    const override = loose && RECORDING_KEY.test(key) ? localTrack([`${key}.mp3`]) : null;
    return [this.recordings[key], override, ...list.slice(offset).concat(list.slice(0, offset)).map(localTrack)].filter(Boolean);
  },
  async queueRecording(keys, loose) {
    const key = keys.join("|");
    if (this.recordingRequest?.key === key) return;
    this.recordingRequest?.controller.abort();
    this.recordingRequest = null;
    if (!key) return;
    const candidates = keys.flatMap(k => this.recordingChoices(k, loose));
    const seen = new Set();
    const request = { key, controller: new AbortController() };
    this.recordingRequest = request;
    const c = this.ctx;
    for (const entry of candidates) {
      if (this.recordingRequest !== request) return;
      if (!(entry.loose ? LOCAL_BGM_PATH : RECORDING_SRC).test(entry.src) || seen.has(entry.src)) continue;
      seen.add(entry.src);
      const live = this.playing.find(p => !p.dying);
      if (live?.src === entry.src) { live.key = keys[0]; return; }
      try {
        const r = await fetch(new URL(entry.src, import.meta.url), { signal: request.controller.signal });
        if (r.status === 204 || (r.status === 404 && entry.loose)) continue;
        if (!r.ok) throw new Error("Music recording unavailable");
        const data = await r.arrayBuffer();
        if (this.recordingRequest !== request) return;
        const buffer = await c.decodeAudioData(data);
        if (this.recordingRequest !== request) return;
        const start = entry.start ?? 0, end = entry.end ?? buffer.duration;
        if (!(buffer.duration <= 210 && start >= 0 && end - start >= 1 && end <= buffer.duration + 0.02)) throw new Error("Invalid music duration or loop range");
        const t = c.currentTime, gain = c.createGain(), source = c.createBufferSource();
        source.buffer = buffer; source.loop = true; source.loopStart = start; source.loopEnd = Math.min(end, buffer.duration);
        source.connect(gain); gain.connect(this.music);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(Math.max(0.05, Math.min(1, entry.gain ?? 0.65)), t + FADE);
        this.fadeOut(this.playing.find(p => !p.dying), t, FADE);
        this.playing.push({ key: keys[0], src: entry.src, source, gain, dying: 0 });
        source.start(t, start);
        return;
      } catch (error) {
        if (this.recordingRequest === request) console.warn(`[BGM] ${key}: ${error.message}`);
      }
    }
    if (this.recordingRequest === request) this.fadeOut(this.playing.find(p => !p.dying), c.currentTime, FADE);
  },
  /** Live music uses recordings only, including during loading and missing-file fallbacks. */
  pick() {
    if (!this.ctx || !this.recordings) return;
    const loose = typeof location !== "undefined" && localHost(location.hostname);
    const mapScore = this.base && this.mapScore;
    const day = this.base || "title";
    const recorded = k => Object.hasOwn(this.recordings, k) || (loose && Object.hasOwn(this.localScores, k));
    const night = this.night && (NIGHT[mapScore] || (!recorded(mapScore) && NIGHT[day]));
    const recordedNight = night && recorded(night) ? night : null;
    this.queueRecording([...new Set([this.theme, recordedNight, mapScore, day].filter(Boolean))], loose);
  },
  /** Synth scores are used explicitly by the offline authoring tool. */
  previewScore(name, style) {
    const c = this.ctx, { def, song } = SCORES[styleOf(style)][name];
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(def.trim ?? TRIM[name] ?? 1, t + FADE);
    g.connect(this.music);
    const send = c.createGain(); send.gain.value = def.delay || 0; g.connect(send); send.connect(this.verb);
    return { def, song, gain: g, send, step: 0, next: t + 0.12 };
  },
  /** Finish fading recordings and schedule nearby ambience. */
  pump() {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const now = c.currentTime;
    for (let i = this.playing.length - 1; i >= 0; i--) {
      const p = this.playing[i];
      if (!p.dying || now <= p.dying) continue;
      p.source.stop(); p.source.disconnect(); p.gain.disconnect();
      this.playing.splice(i, 1);
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
    if (!this.vol.mute && this.base === "maple" && !this.theme) {
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
    const bars = p.song, bar = bars[Math.floor(p.step / 16) % bars.length], i = p.step % 16;
    const def = bar.parts, out = p.gain, ch = bar.chord;
    if (i % 2) t += (def.swing || 0) * s16;
    if (def.expressive) t += [0, 0.008, 0.005, 0.012][i % 4];
    for (const [f, at, len] of bar.notes) if (at === i) {
      const length = len * s16;
      const emphasis = def.expressive ? (i % 4 === 0 ? 1.02 : 0.83) : 1;
      this.inst(def.lead, f, t, length, def.vol * emphasis, out);
      if (def.double && len >= 3) this.inst(def.double, f / 2, t + 0.009, length * 0.84, def.vol * 0.24, out);
    }
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
      case "grand": {
        const finish = t + dur + 0.48;
        const soundboard = lowpass(Math.min(6800, 1300 + f * 12), 0.46);
        // Each string partial decays at its own rate. Two strings start in tune and separate slightly.
        const warmth = Math.max(0.35, Math.min(1.0, 420 / f));
        for (const [ratio, amp, decay] of [[1, 0.79, 0.44], [2.001, 0.27, 0.23], [3.008, 0.15, 0.14], [4.024, 0.09, 0.085], [5.055, 0.042, 0.055], [7.1, 0.018, 0.034]]) {
          const partial = c.createGain();
          const level = vol * amp * (ratio === 1 ? 1 : warmth);
          partial.gain.setValueAtTime(0.00001, t);
          partial.gain.exponentialRampToValueAtTime(level, t + 0.005);
          partial.gain.exponentialRampToValueAtTime(Math.max(0.00002, level * 0.16), t + Math.min(decay, dur * 0.7));
          partial.gain.setTargetAtTime(0.00001, t + dur * 0.78, decay * 0.32);
          osc("sine", f * ratio, 1, ratio === 1 ? -1.5 : 1.5).connect(partial);
          if (ratio === 1) osc("sine", f, f > 350 ? 0.22 : 0.12, 3.3).connect(partial);
          partial.connect(soundboard);
        }
        // A short, quiet hammer sound stays near the pitch, followed by the body of the note.
        const strike = c.createGain();
        strike.gain.setValueAtTime(vol * 0.057, t);
        strike.gain.exponentialRampToValueAtTime(0.00001, t + 0.025);
        osc("sine", f * 8.07).connect(strike);
        strike.connect(soundboard);
        g.gain.setValueAtTime(1, t);
        g.gain.setTargetAtTime(0.0001, finish, 0.04);
        break;
      }
      case "harp": {
        const lp = lowpass(Math.min(4600, f * 8));
        osc("sine", f, 0.78).connect(lp);
        osc("triangle", f * 2.001, 0.23, -3).connect(lp);
        const attack = c.createGain();
        attack.gain.setValueAtTime(0.22, t);
        attack.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
        osc("sine", f * 3.017).connect(attack);
        attack.connect(lp);
        env(0.004, 0.21, 0.17);
        break;
      }
      case "bowed": {
        const lp = lowpass(Math.min(2550, f * 8), 0.56);
        osc("triangle", f, 0.58, -3).connect(lp);
        osc("sawtooth", f, 0.27, 4).connect(lp);
        osc("sine", f * 2, 0.14, 1.5).connect(lp);
        env(Math.min(0.16, dur * 0.36), 0.75, 0.23);
        break;
      }
      case "felt": {
        const lp = lowpass(Math.min(3400, f * 6));
        osc("triangle", f, 0.62, -1.2).connect(lp);
        osc("sine", f, 0.41, 1.0).connect(lp);
        const strike = c.createGain();
        strike.gain.setValueAtTime(0.18, t);
        strike.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc("sine", f * 2.005).connect(strike);
        osc("sine", f * 3.016, 0.31).connect(strike);
        strike.connect(lp);
        env(0.007, 0.3, 0.18);
        break;
      }
      case "strings": {
        const lp = lowpass(Math.min(2200, f * 5.5));
        for (const [detune, pan] of [[-8, -0.47], [6, 0.47]]) {
          const stereo = c.createStereoPanner();
          stereo.pan.value = pan;
          osc("sawtooth", f, 0.33, detune).connect(stereo);
          osc("triangle", f, 0.15, -detune).connect(stereo);
          stereo.connect(lp);
        }
        env(Math.min(0.21, dur * 0.36), 0.78, 0.26);
        break;
      }
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
  /**
   * The sounds of the place outdoors: { out, ph (0 새벽 … 4 밤), wx (weather), night 0–1 }.
   * Birds at dawn and in the morning, a few by day, crickets from sunset, owls at night,
   * a rain loop and a wind loop under it all.
   */
  scene(sc) { this.sc = sc; },
  ambience(now) {
    const c = this.ctx, sc = this.sc;
    if (!c || !sc) return;
    const shore = this.mapScore === "sunset_beach";
    this.loop("surf", shore ? 0.30 : 0, 1200, "lowpass", 0.6);
    const rain = sc.out && (sc.wx === 2) ? 1 : 0, wind = sc.out && sc.wx === 4 ? 1 : sc.out && sc.wx === 3 ? 0.3 : 0;
    this.loop("rain", rain * 0.16, 1400, "lowpass", 0.6);
    this.loop("wind", wind * 0.1, 420, "lowpass", 2);
    if (shore || !sc.out || this.vol.mute) return;
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
  /** A looping filtered noise bed faded to `level`. */
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
    const k = name === "surf" ? 0.24 + 0.76 * Math.max(0, Math.sin(t / 0.92)) ** 2
      : name === "wind" ? 0.6 + 0.4 * Math.sin(t / 2.3) : 1;
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
  /** ±5% on a repeated sound, so ten hits in a row never sound like one sample on a loop. */
  vary() { return 1 + (Math.random() - 0.5) * 0.1; },
  /**
   * A blow's punch, three layers at pitch `p`: a short pitch-drop transient (`drop` Hz falling to
   * a third over 50 ms), a low thud (`thud` Hz, 80-140, falling an octave) and a bright click of
   * burst noise with a metallic ring (`metal` Hz, 0 for none). `w` scales the whole.
   */
  punch(p, drop, thud, metal, w = 1, when = 0) {
    this.tone(0.5, drop * p, drop * p * 0.33, 0.05, 0.12 * w, when);
    this.tone("sine", thud * p, thud * p * 0.5, 0.11 + 0.05 * w, 0.26 * w, when);
    this.noise(0.022, 0.2 * w, 5200 * p, "highpass", when);
    if (metal) this.tone("sine", metal * p, metal * p * 0.94, 0.06, 0.035 * w, when + 0.004);
  },

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

/** A blow's colour by weapon: [punch drop Hz, thud Hz, metal ring Hz (0: none), crack Hz]. Blades ring, blunt things thump. */
const IMPACT0 = [300, 112, 2300, 1600];
const IMPACT = { sword: [330, 118, 2500, 1900], dagger: [420, 130, 3300, 2600], spear: [360, 112, 2100, 1700], hammer: [220, 82, 0, 900], staff: [260, 96, 0, 1200], book: [280, 100, 0, 1300] };

/** Minimum seconds between two plays of the same effect. */
const THROTTLE = { job_note: 0.06, gat_work: 0.2, gat_start: 0.3, bow_draw: 0.06, arrow_hit: 0.035, magic_hit: 0.04, arrow_wall: 0.05, quake: 0.2, tip: 0.06, bleed: 0.12, brand: 0.1, gravity_tick: 0.3, phantom_bite: 0.1, meteor_hit: 0.08, dance: 0.08, hit: 0.035, crit: 0.05, mob_shot: 0.08, warn: 0.25, blip: 0.12, hover: 0.06, step_grass: 0.12, step_stone: 0.12, step_wood: 0.12, step_dirt: 0.12, step_water: 0.12, die_small: 0.04, coin: 0.06, pop: 0.06, elite: 1, announce: 1.5,
  hammer_land: 0.065, graze: 0.045, merc_dash: 0.1, oath_cast: 0.15, oath_heal: 0.28,
  rally_banner: 0.18, rally_mend: 0.26, revive_binding: 0.22, revive_mend: 0.4,
  cross_cut: 0.1, element_dagger: 0.12, frost_lance: 0.12, rune_circle: 0.18, inkshot: 0.12,
};
/** Level trims by name, from rendering each effect offline against the music: combat sits forward. */
const BOOST = {
  swing: 3, swing_sword: 3, swing_dagger: 3, swing_spear: 3, swing_staff: 2, swing_book: 2.2, shoot: 1.6, magic: 1.5,
  swing_hammer: 1.65, hammer_land: 2,
  bow_draw: 2, bow_shot: 2.6, release: 2.6, arrow_hit: 2, magic_hit: 1.8, arrow_wall: 1.6,
  hit: 2, crit: 1.6, hurt: 2, die: 2, die_small: 2.2, die_big: 1.8, mob_shot: 1.8, charge: 2, volley: 1.8, spit: 2, pop: 2, buff: 1.5,
  charm_place: 1.6, charm_remove: 1.6, charm_id: 1.6, charm_expand: 1.5, ui: 1.8, open: 2, close: 2, tab: 2, blip: 1.8, emote: 1.6, cast: 1.8, coin: 1.5, salvage: 1.5, recall: 1.4, warp_out: 1.4, rift_warn: 1.5, fail: 1.4,
  step_grass: 2.5, step_dirt: 2.5, step_stone: 2, step_wood: 1.6, step_water: 2,
  drip: 1.6, reel: 1.8, slack: 1.6, sizzle: 1.4, pan_place: 1.8, pan_turn: 1.6, pan_bump: 1.6,
};
/** Effects that play even when many voices are already sounding. */
const IMPORTANT = new Set(["verdict", "steam", "overload", "supercon", "dragon_final", "meteor_cast", "crimson", "dive", "thunder", "sanctuary", "pact", "hundred", "oath_cast", "level", "achieve", "death", "rift_start", "rift_boss", "rc_ping", "dim_boss", "dim_clear", "announce", "enh_ok", "enh_fail", "warp", "loot"]);
/** 일일 아르바이트 sounds that may come in quick bursts (a hop, a brick, a spray) and the three that frame a shift, which never get dropped. */
Object.assign(THROTTLE, { alba_pop: 0.045, alba_snap: 0.04, alba_crunch: 0.05, alba_step: 0.05, alba_zap: 0.06, alba_sizzle: 0.1, alba_swish: 0.08, alba_thud: 0.06, alba_clang: 0.05, alba_n0: 0.04, alba_n1: 0.04, alba_n2: 0.04, alba_n3: 0.04 });
for (const n of ["alba_go", "alba_end", "alba_win"]) IMPORTANT.add(n);

/** The catalogue. `this` is Sound. */
/** Each job's note under its skills (skills-v2.md §6): [wave, from Hz, to Hz, noise Hz, noise filter] — steel rings, shadows hiss,
 * thunder cracks, embers rise, the abyss growls, the forest whistles; hybrids lean on their own touch. */
const JOB_NOTE = {
  adventurer: ["triangle", 520, 520, 0, ""], swordsman: ["triangle", 880, 830, 2600, "bandpass"], thief: ["sine", 1500, 2100, 6000, "highpass"],
  lancer: ["square", 220, 110, 900, "lowpass"], wizard: ["sine", 440, 1320, 3400, "bandpass"], warlock: ["sawtooth", 98, 82, 500, "lowpass"],
  archer: ["sine", 1800, 1250, 5000, "highpass"], spellblade: ["triangle", 660, 1320, 1800, "bandpass"], tracker: ["sine", 1250, 900, 4200, "highpass"],
  dragoon: ["sawtooth", 147, 98, 700, "lowpass"], hexblade: ["sawtooth", 196, 131, 1200, "bandpass"], darkknight: ["square", 110, 98, 600, "lowpass"],
  bladedancer: ["triangle", 1175, 1568, 5200, "highpass"], trickster: ["sine", 784, 1175, 3000, "bandpass"], spellspear: ["sine", 1320, 1980, 7000, "highpass"],
  runesage: ["triangle", 523, 784, 2200, "bandpass"], runearcher: ["sine", 990, 660, 3600, "bandpass"],
};
/** A plucky lane note for the rhythm game: a triangle with a short bright overtone and a pick click. */
const albaNote = (s, f) => { s.tone("triangle", f, f, 0.24, 0.075); s.tone("sine", f * 2, f * 2, 0.1, 0.022); s.noise(0.015, 0.02, 4000, "highpass"); };
const SFX = {
  job_note({ job, sig } = {}) {
    const [w, f0, f1, fc, ft] = JOB_NOTE[job] || JOB_NOTE.adventurer, v = sig ? 0.07 : 0.035, p = this.vary();
    this.tone(w, f0 * p, f1 * p, sig ? 0.32 : 0.16, v, 0.03);
    if (sig) this.tone(w, f0 * 1.5 * p, f1 * 1.5 * p, 0.28, v * 0.5, 0.09);
    if (fc) this.noise(sig ? 0.16 : 0.08, v * 0.8, fc * p, ft, 0.02);
  },
  // ── weapons ──
  swing() { this.noise(0.1, 0.22, 1800, "bandpass", 0, 600); },
  // the dash (Space): a rush of air rising, a scuff of the feet; a blow slipped: a quick bright flick
  dash() { const p = this.vary(); this.noise(0.18, 0.2, 700 * p, "bandpass", 0, 3400 * p); this.tone("triangle", 220 * p, 480 * p, 0.1, 0.04); this.noise(0.05, 0.1, 500, "lowpass", 0.12); },
  dodge() { this.tone("sine", 1400, 2200, 0.08, 0.05); this.noise(0.06, 0.08, 4200, "highpass"); },
  // swings: a quick whoosh (shorter now the strokes snap) on a small pitch-drop and a soft thud
  swing_sword(fin) { const p = this.vary(); this.noise(fin ? 0.18 : 0.13, fin ? 0.32 : 0.24, 500 * p, "bandpass", 0, 2600 * p); this.tone("triangle", 150 * p, 70 * p, 0.11, 0.08); this.tone(0.5, 420 * p, 140 * p, 0.04, 0.04); },
  swing_dagger() {
    const p = this.vary();
    this.noise(0.046, 0.155, 2900 * p, "bandpass", 0, 5750 * p);
    this.noise(0.029, 0.058, 1250 * p, "bandpass", 0.012, 1850 * p);
  },
  swing_spear(fin) {
    const p = this.vary();
    this.noise(fin ? 0.11 : 0.083, fin ? 0.2 : 0.17, 950 * p, "bandpass", 0, 3320 * p);
    this.tone("triangle", 270 * p, 410 * p, 0.055, 0.047, 0.013);
  },
  swing_hammer() { const p = this.vary(); this.noise(0.055, 0.10, 780 * p, "bandpass", 0, 1350 * p); this.tone("triangle", 185 * p, 118 * p, 0.05, 0.043); },
  hammer_land({ hit, crit, kind = 7, final } = {}) {
    const p = this.vary();
    if (final) kind = 132;
    const strength = crit ? 0.91 : 0.7;
    if (kind === 130) { // A pointed wedge rings briefly as it bites.
      if (hit) this.punch(p, 360, 121, 2120, strength);
      this.noise(0.048, hit ? 0.09 : 0.07, 2480 * p, "bandpass", 0.01, 690 * p);
      this.tone("triangle", 540 * p, 265 * p, 0.064, hit ? 0.08 : 0.04);
    } else if (kind === 131) { // Stone splits after the initial strike.
      if (hit) this.punch(p, 270, 103, 990, strength);
      this.noise(0.12, hit ? 0.095 : 0.06, 1780 * p, "bandpass", 0.035, 480 * p);
      this.noise(0.085, 0.05, 810 * p, "lowpass", 0.09);
      this.tone("triangle", 170 * p, 87 * p, 0.13, 0.063, 0.05);
    } else if (kind === 132) { // The ram lands, then the ground answers.
      if (hit) this.punch(p, 300, 90, 1530, crit ? 0.98 : 0.87);
      this.tone("sine", 94 * p, 44 * p, 0.23, hit ? 0.13 : 0.085, 0.035);
      this.noise(0.22, hit ? 0.13 : 0.075, 1400 * p, "lowpass", 0.055, 180 * p);
      this.tone("triangle", 220 * p, 92 * p, 0.1, 0.064, 0.11);
    } else { // The ordinary hammer has a single short knock.
      if (hit) this.punch(p, crit ? 315 : 245, 105, crit ? 1500 : 1020, strength);
      this.noise(hit ? 0.039 : 0.065, hit ? 0.10 : 0.065, 850 * p, "bandpass", 0, 440 * p);
      if (!hit) this.tone("sine", 86 * p, 64 * p, 0.065, 0.074);
    }
  },
  swing_staff() { this.tone("sine", 420, 760, 0.18, 0.1); this.tone("triangle", 630, 1140, 0.16, 0.05, 0.02); this.noise(0.12, 0.06, 3000, "highpass"); },
  swing_book() { this.noise(0.08, 0.12, 2400, "bandpass", 0, 1200); this.noise(0.06, 0.1, 3000, "bandpass", 0.07, 1600); this.tone("sine", 880, 1320, 0.14, 0.06, 0.04); },
  shoot() { this.noise(0.06, 0.16, 2500); this.tone(0.5, 900, 400, 0.08, 0.07); },
  // the bow (all ±5%): a short creak as it is drawn; the release — the string's twang (a pitch drop
  // 220 → 110 with a bright pluck and a click) and the arrow's whoosh leaving; the arrow striking
  // flesh (a thunk) or wood and stone (a knock and a rattle)
  bow_draw() { const p = this.vary(); this.noise(0.08, 0.07, 700 * p, "bandpass", 0, 1500 * p); this.tone("triangle", 180 * p, 240 * p, 0.07, 0.025); },
  bow_shot(fin) {
    const p = this.vary();
    this.tone("triangle", 220 * p, 110 * p, 0.15, 0.15); this.tone(0.5, 440 * p, 210 * p, 0.05, 0.05);
    this.noise(0.025, 0.18, 3400 * p, "highpass");
    this.noise(fin ? 0.2 : 0.13, fin ? 0.24 : 0.17, 1300 * p, "bandpass", 0.012, 4400 * p);
  },
  release(fin) { SFX.bow_shot.call(this, fin); },
  arrow_hit() {
    const p = this.vary();
    this.noise(0.022, 0.20, 2750 * p, "bandpass", 0, 1260 * p);
    this.tone("triangle", 850 * p, 410 * p, 0.031, 0.09);
    this.tone("sine", 166 * p, 78 * p, 0.077, 0.16, 0.004);
  },
  // a staff's missile or a book's orb bursting: a bright glassy ping falling away over a soft fizz (`big`: the orb, a finisher)
  magic_hit(big) {
    const p = this.vary();
    this.tone("triangle", 1490 * p, 580 * p, big ? 0.09 : 0.065, 0.11);
    this.noise(big ? 0.085 : 0.04, big ? 0.14 : 0.10, 3380 * p, "bandpass", 0, 1150 * p);
    this.tone("sine", (big ? 260 : 430) * p, (big ? 82 : 210) * p, big ? 0.19 : 0.10, 0.17, 0.008);
  },
  arrow_wall() { const p = this.vary(); this.tone("square", 330 * p, 260 * p, 0.035, 0.06); this.noise(0.05, 0.12, 2400 * p, "bandpass"); this.tone("triangle", 190 * p, 182 * p, 0.14, 0.05, 0.02); this.tone("triangle", 196 * p, 188 * p, 0.1, 0.03, 0.06); },
  magic() { this.tone("sine", 500, 1300, 0.16, 0.14); this.tone("triangle", 750, 1700, 0.14, 0.07, 0.03); },
  boom() { this.noise(0.34, 0.36, 1600, "lowpass", 0, 120); this.tone("square", 150, 40, 0.3, 0.16); },
  ice() { this.tone("triangle", 1800, 600, 0.3, 0.12); this.noise(0.22, 0.12, 4000); this.arp("sine", [2093, 2637, 3136], 0.04, 0.12, 0.04, 0.05); },
  heal() { this.arp("sine", [659, 784, 988, 1319], 0.06, 0.25, 0.12); },
  buff() { this.tone("sawtooth", 200, 600, 0.3, 0.09); this.arp(0.25, [523, 659, 784], 0.07, 0.12, 0.06, 0.1); },
  // ── weapon skills (skillfx.js, by fx code) ──
  // 대검: a heavy crescent; the leap's landing (slam) and the ground splitting on (quake); the verdict's spin
  power_slash() { const p = this.vary(); this.noise(0.22, 0.34, 420 * p, "bandpass", 0, 3200 * p); this.tone("triangle", 180 * p, 60 * p, 0.2, 0.14); this.tone(0.5, 640 * p, 220 * p, 0.06, 0.05, 0.02); },
  verdict() { this.noise(0.5, 0.3, 300, "bandpass", 0, 4200); this.tone("sawtooth", 90, 45, 0.5, 0.16); this.arp(0.25, [523, 392, 262], 0.06, 0.16, 0.07, 0.12); },
  inertia_full() { this.arp("triangle", [330, 440, 554], 0.04, 0.1, 0.06); },
  // 단검: the blink behind (swap); a fan of shadow blades; the dance; a bleeding wound
  shade() { for (let i = 0; i < 3; i++) this.noise(0.07, 0.14, 4200, "bandpass", i * 0.04, 1800); this.tone("sine", 1300, 700, 0.1, 0.04); },
  bleed() { this.noise(0.12, 0.1, 700, "lowpass", 0, 200); this.tone("sine", 260, 160, 0.12, 0.05); },
  // 창: the drill of the spiral thrust; the comet's charge (hundred); the thunder dragon and its last stroke
  spiral() { const p = this.vary(); this.noise(0.2, 0.22, 900 * p, "bandpass", 0, 5200 * p); this.tone("square", 220 * p, 880 * p, 0.14, 0.04); this.tone("triangle", 440 * p, 1320 * p, 0.12, 0.04, 0.04); },
  dragon() { this.noise(0.3, 0.26, 3000, "highpass"); this.tone("sawtooth", 110, 220, 0.4, 0.1); this.arp(0.25, [392, 523, 659], 0.06, 0.18, 0.06); },
  dragon_final() {
    const p = this.vary();
    this.noise(0.092, 0.28, 5100 * p, "bandpass", 0, 850 * p);
    this.tone("triangle", 1250 * p, 310 * p, 0.103, 0.12);
    this.tone("sine", 119 * p, 40 * p, 0.285, 0.27, 0.017);
  },
  // 스태프: fire (ember, boom), ice (frost), the meteors; resonance filled
  meteor_cast() { this.tone("sawtooth", 70, 140, 0.8, 0.1); this.noise(0.8, 0.14, 300, "bandpass", 0, 1800); this.arp("triangle", [196, 233, 294], 0.1, 0.3, 0.06); },
  meteor_hit() {
    const p = this.vary();
    this.noise(0.044, 0.25, 2680 * p, "bandpass", 0, 850 * p);
    this.tone("sine", 162 * p, 43 * p, 0.23, 0.26, 0.008);
    this.noise(0.17, 0.14, 920 * p, "lowpass", 0.035, 145 * p);
  },
  reso_ready() { this.arp("sine", [784, 988, 1175, 1568], 0.04, 0.14, 0.07); this.tone("triangle", 392, 392, 0.3, 0.04); },
  // 마도서: the soul bolt, the vortex and its beats, the phantom beast's bite and its curse, the brand
  soulbolt() { this.tone("sine", 300, 900, 0.22, 0.08); this.tone("triangle", 150, 450, 0.22, 0.05, 0.03); this.noise(0.2, 0.06, 1600, "bandpass", 0, 400); },
  gravity() { this.tone("sine", 220, 55, 0.6, 0.14); this.noise(0.6, 0.12, 400, "bandpass", 0, 120); },
  gravity_tick() { this.tone("sine", 110, 70, 0.12, 0.06); },
  pact() { this.tone("sawtooth", 65, 50, 0.9, 0.12); this.arp("square", [147, 139, 131], 0.16, 0.3, 0.05, 0.1); this.noise(0.8, 0.1, 600, "bandpass", 0, 200); },
  phantom_bite() { const p = this.vary(); this.noise(0.08, 0.2, 1600 * p, "bandpass"); this.tone("square", 300 * p, 120 * p, 0.08, 0.06); },
  pact_end() { this.noise(0.5, 0.32, 1200, "lowpass", 0, 70); this.tone("sawtooth", 160, 40, 0.5, 0.14); this.tone("sine", 1200, 300, 0.3, 0.05); },
  brand() { this.tone(0.25, 880, 660, 0.08, 0.05); this.noise(0.1, 0.06, 3000, "highpass"); },
  // 활: the piercing shot's crack, the hop back, the volley loosed at the sky
  pierce() { this.noise(0.05, 0.22, 4000, "highpass"); this.tone(0.5, 1200, 500, 0.06, 0.05); },
  leapshot() { this.noise(0.14, 0.12, 800, "bandpass", 0, 300); this.tone("triangle", 260, 520, 0.12, 0.05); },
  rain() { for (let i = 0; i < 6; i++) this.noise(0.06, 0.08, 3600, "bandpass", 0.25 + i * 0.07, 2000); this.tone("triangle", 330, 660, 0.2, 0.05); },
  // the hybrids: a blade of fire, the tracker's lure (decoy) and traps (decoy_pop), the dive, the blood, the thunder, the sanctuary
  crimson() { this.noise(0.45, 0.3, 500, "lowpass", 0, 3200); this.tone("sawtooth", 220, 110, 0.4, 0.1); this.tone(0.5, 880, 1760, 0.2, 0.04, 0.05); },
  dive() { this.noise(0.5, 0.22, 3000, "bandpass", 0, 300); this.tone("sawtooth", 600, 60, 0.5, 0.12); this.tone("sine", 70, 30, 0.4, 0.3, 0.3); },
  blood_bind() { this.tone("sawtooth", 98, 92, 0.6, 0.08); this.noise(0.6, 0.08, 500, "bandpass", 0, 900); },
  blood_burst() { this.noise(0.3, 0.32, 900, "lowpass", 0, 120); this.tone("square", 220, 55, 0.25, 0.14); this.noise(0.15, 0.12, 2200, "bandpass", 0.05); },
  thunder() { this.noise(0.15, 0.3, 3000, "highpass"); this.tone("square", 1600, 120, 0.25, 0.1); this.noise(0.6, 0.24, 700, "lowpass", 0.1, 60); },
  sanctuary() { this.tone("sawtooth", 82, 82, 0.9, 0.1); this.arp("triangle", [196, 247, 294, 392], 0.08, 0.5, 0.06, 0.05); this.noise(0.8, 0.08, 900, "bandpass", 0, 300); },
  // Hybrid signatures: give the swing, cast or movement one voice of its own.
  merc_dash() {
    const p = this.vary();
    this.noise(0.145, 0.16, 660 * p, "bandpass", 0, 2900 * p);
    this.tone("triangle", 156 * p, 264 * p, 0.11, 0.07);
    this.tone("sine", 1450 * p, 1130 * p, 0.065, 0.064, 0.055);
    this.noise(0.05, 0.073, 1320 * p, "bandpass", 0.097, 530 * p);
  },
  oath_cast() {
    this.tone("sine", 262, 262, 0.4, 0.08);
    this.arp("triangle", [392, 523, 659, 784], 0.043, 0.23, 0.067, 0.02);
    this.tone("sine", 1047, 1047, 0.31, 0.05, 0.13);
  },
  oath_heal() {
    this.arp("sine", [784, 1047], 0.056, 0.15, 0.049);
    this.tone("triangle", 1568, 1568, 0.13, 0.021, 0.06);
  },
  // A planted staff and a short flap of cloth, followed by a warm two-note heal.
  rally_banner() {
    this.tone("triangle", 174, 105, 0.11, 0.13);
    this.noise(0.14, 0.069, 980, "bandpass", 0.022, 2360);
    this.tone("triangle", 330, 330, 0.21, 0.06, 0.06);
    this.tone("sine", 659, 630, 0.16, 0.036, 0.082);
  },
  rally_mend() {
    this.arp("sine", [698, 880], 0.064, 0.17, 0.066);
    this.tone("triangle", 523, 523, 0.15, 0.024, 0.064);
  },
  // A loose page snaps into the binding. The confirmed receiver hears a separate rising chord.
  revive_binding() {
    this.noise(0.11, 0.084, 2420, "bandpass", 0, 880);
    this.tone("sine", 220, 165, 0.18, 0.07);
    this.arp("triangle", [330, 494, 659], 0.057, 0.23, 0.057, 0.048);
  },
  revive_mend() {
    this.tone("sine", 220, 440, 0.19, 0.075);
    this.arp("sine", [440, 659, 880, 1047], 0.057, 0.27, 0.071, 0.035);
    this.tone("triangle", 1319, 1319, 0.22, 0.029, 0.2);
  },
  cross_cut() {
    const p = this.vary();
    this.noise(0.115, 0.18, 740 * p, "bandpass", 0, 3360 * p);
    this.tone("triangle", 215 * p, 98 * p, 0.11, 0.12);
    this.noise(0.055, 0.115, 4900 * p, "bandpass", 0.14, 2350 * p);
    this.tone("sine", 1830 * p, 1310 * p, 0.085, 0.062, 0.158);
  },
  element_dagger() {
    const p = this.vary();
    this.noise(0.07, 0.105, 900 * p, "bandpass", 0, 3100 * p);
    this.tone("triangle", 410 * p, 620 * p, 0.081, 0.075);
    this.tone("sine", 1780 * p, 1350 * p, 0.095, 0.071, 0.047);
    this.noise(0.063, 0.086, 5600 * p, "highpass", 0.088);
    this.tone("square", 940 * p, 310 * p, 0.06, 0.029, 0.092);
  },
  frost_lance() {
    const p = this.vary();
    this.noise(0.093, 0.13, 1200 * p, "bandpass", 0, 5600 * p);
    this.tone("triangle", 380 * p, 1060 * p, 0.078, 0.064);
    this.arp("sine", [1790 * p, 2260 * p, 2820 * p], 0.029, 0.13, 0.065, 0.075);
    this.noise(0.11, 0.069, 4900 * p, "highpass", 0.105);
  },
  rune_circle() {
    this.tone("triangle", 175, 350, 0.35, 0.09);
    this.arp("sine", [349, 523, 698, 587], 0.072, 0.28, 0.068, 0.024);
    this.tone("sine", 1047, 1047, 0.23, 0.044, 0.24);
  },
  inkshot() {
    const p = this.vary();
    this.noise(0.115, 0.106, 900 * p, "bandpass", 0, 290 * p);
    this.tone(0.25, 480 * p, 168 * p, 0.147, 0.088);
    this.tone("sine", 196 * p, 102 * p, 0.165, 0.086, 0.028);
    this.noise(0.054, 0.063, 2700 * p, "bandpass", 0.088, 680 * p);
  },
  quake() { this.tone("sine", 70, 40, 0.18, 0.28); this.noise(0.12, 0.12, 400, "lowpass"); },
  swap() { this.tone("sine", 900, 300, 0.12, 0.1); this.tone("sine", 300, 900, 0.12, 0.08, 0.1); this.noise(0.12, 0.08, 3000, "highpass"); },
  decoy() { this.noise(0.4, 0.12, 2000, "bandpass", 0, 500); this.tone("sine", 700, 350, 0.3, 0.05); },
  decoy_pop() { this.noise(0.2, 0.26, 1800, "lowpass", 0, 200); this.tone("square", 400, 120, 0.15, 0.1); this.noise(0.15, 0.08, 6000, "highpass", 0.05); },
  dance() { this.noise(0.08, 0.16, 5000, "bandpass", 0, 2000); this.tone("sine", 1500, 600, 0.08, 0.05); },
  tip() { this.tone(0.25, 1760, 1760, 0.04, 0.06); },
  hundred() { this.noise(0.4, 0.3, 300, "bandpass", 0, 6000); this.tone("sawtooth", 200, 800, 0.3, 0.08); this.tone(0.5, 2093, 2093, 0.3, 0.04, 0.3); },
  ember() { this.noise(0.3, 0.18, 400, "lowpass", 0, 2400); this.tone("sine", 260, 520, 0.18, 0.08); },
  frost() { this.tone("triangle", 2200, 800, 0.3, 0.1); this.noise(0.3, 0.1, 6000, "highpass"); },
  bolt() { this.noise(0.12, 0.26, 3000, "highpass"); this.tone("square", 1200, 200, 0.12, 0.08); this.noise(0.25, 0.12, 900, "lowpass", 0.05, 120); },
  steam() { this.noise(0.5, 0.3, 5000, "highpass", 0, 1500); this.noise(0.3, 0.2, 800, "lowpass", 0, 120); this.tone("sine", 160, 60, 0.3, 0.2); },
  supercon() { this.tone("square", 2400, 600, 0.2, 0.06); this.tone("triangle", 1800, 2600, 0.2, 0.06); this.noise(0.2, 0.1, 6000, "highpass"); },
  overload() { this.noise(0.45, 0.38, 2000, "lowpass", 0, 90); this.tone("square", 220, 40, 0.35, 0.18); this.noise(0.1, 0.2, 4000, "highpass"); },
  // ── hits ──
  // hits: the punch (pitch-drop + 80–140 Hz thud + metallic click), each ±5% apart
  // A dagger cuts with a brief, narrow metal click; the spear couples a lower knock to a tip ring.
  hit(wk) {
    const p = this.vary();
    if (wk === "dagger") {
      this.noise(0.020, 0.22, 4880 * p, "bandpass", 0, 2100 * p);
      this.tone("triangle", 760 * p, 300 * p, 0.028, 0.11);
      this.tone("sine", 157 * p, 85 * p, 0.062, 0.17, 0.004);
    } else if (wk === "spear") {
      this.noise(0.031, 0.17, 2850 * p, "highpass");
      this.tone("triangle", 325 * p, 112 * p, 0.052, 0.13);
      this.tone("sine", 109 * p, 56 * p, 0.114, 0.23);
      this.tone("sine", 1960 * p, 1790 * p, 0.083, 0.081, 0.004);
    } else {
      const [d, th, m, cr] = IMPACT[wk] || IMPACT0;
      this.punch(p, d, th, m, 1);
      this.tone("sine", 96 * p, 45 * p, 0.088, 0.18, 0.008);
      this.noise(0.037, 0.16, cr * p, "bandpass", 0, 760 * p);
    }
  },
  graze() {
    const p = this.vary();
    this.noise(0.041, 0.14, 2400 * p, "bandpass", 0, 980 * p);
    this.tone("triangle", 520 * p, 290 * p, 0.052, 0.052);
  },
  // a crit: higher, harder and louder — a deeper boom, a sharp snap on top, the glint
  crit(wk) {
    const p = this.vary(), [drop, thud, metal, crack] = IMPACT[wk] || IMPACT0;
    this.punch(p, drop * 1.37, thud * 1.07, metal ? metal * 1.14 : 2600, 1.23);
    this.noise(0.028, 0.21, Math.max(3200, crack * 1.4) * p, "bandpass", 0, 1620 * p);
    this.tone("sine", 84 * p, 38 * p, 0.13, 0.23, 0.012);
  },
  finisher(wk) {
    const p = this.vary(), [drop, thud, metal, crack] = IMPACT[wk] || IMPACT0;
    this.punch(p, drop * 0.88, thud * 0.85, metal * 0.74, 1.15);
    const quick = wk === "dagger" || wk === "bow";
    this.noise(quick ? 0.046 : 0.11, 0.19, crack * 1.12 * p, "bandpass", 0.006, 380 * p);
    this.tone("sine", thud * 0.86 * p, (quick ? 62 : 38) * p, quick ? 0.09 : 0.16, 0.18, 0.018);
  },
  hurt() { this.tone("sawtooth", 190, 70, 0.16, 0.17); this.noise(0.08, 0.1, 900, "bandpass"); },
  // ── monsters ──
  die() { this.tone(0.5, 300, 60, 0.22, 0.12); },
  die_small() { this.tone(0.25, 420, 90, 0.16, 0.1); this.noise(0.1, 0.09, 1200, "bandpass", 0.02); },
  die_big() { this.tone("sawtooth", 220, 45, 0.4, 0.13); this.noise(0.3, 0.18, 1800, "lowpass", 0, 150); },
  die_boss() { this.tone("sawtooth", 160, 30, 1.4, 0.16); this.noise(1.2, 0.26, 2400, "lowpass", 0, 80); this.arp("triangle", [392, 330, 262, 196], 0.18, 0.4, 0.1, 0.3); },
  /** 일일 아르바이트 (alba.js): a good move, a big one, a slip, a fever, the last ten seconds. */
  alba_ok() { this.tone("square", 520, 780, 0.07, 0.06); },
  alba_big() { this.tone("square", 660, 1100, 0.12, 0.07); this.tone("square", 990, 1320, 0.14, 0.05, 0.07); },
  alba_bad() { this.tone("sawtooth", 210, 110, 0.14, 0.09); },
  alba_fever() { this.tone("square", 440, 880, 0.1, 0.06); this.tone("square", 660, 1320, 0.1, 0.06, 0.08); this.tone("square", 880, 1760, 0.16, 0.06, 0.16); },
  alba_tick() { this.tone("square", 880, 880, 0.05, 0.04); },
  /** More 일일 아르바이트 effects (each under 0.4 s, quiet): what the games' hands do, then the lane notes (C E G A) and the shift's start / end / win. */
  alba_pop() { this.tone("sine", 380, 1250, 0.06, 0.08); this.noise(0.03, 0.03, 2600, "bandpass"); },
  alba_snap() { this.noise(0.02, 0.08, 3600, "highpass"); this.tone("square", 1800, 900, 0.025, 0.05); this.tone("square", 1200, 640, 0.03, 0.04, 0.045); },
  alba_swish() { this.noise(0.22, 0.07, 500, "bandpass", 0, 3400); this.noise(0.1, 0.04, 3600, "highpass", 0.1); },
  alba_thud() { this.tone("sine", 150, 45, 0.2, 0.09); this.noise(0.1, 0.05, 320, "lowpass", 0, 110); },
  alba_coin() { this.noise(0.02, 0.06, 4500, "highpass"); this.tone("square", 988, 988, 0.06, 0.05, 0.02); this.tone("square", 1319, 1319, 0.2, 0.05, 0.07); this.tone("triangle", 2637, 2637, 0.2, 0.025, 0.07); },
  alba_splash() { this.noise(0.3, 0.07, 700, "bandpass", 0, 2400); this.noise(0.12, 0.05, 3500, "highpass", 0.05); this.tone("sine", 600, 250, 0.1, 0.03); this.tone("sine", 350, 720, 0.08, 0.03, 0.14); },
  alba_clang() { this.tone("square", 880, 860, 0.25, 0.05); this.tone("square", 1330, 1300, 0.2, 0.04); this.tone("triangle", 2234, 2200, 0.18, 0.03); this.noise(0.03, 0.06, 5000, "highpass"); },
  alba_crunch() { this.noise(0.05, 0.08, 1800, "bandpass"); this.noise(0.05, 0.07, 1200, "bandpass", 0.04); this.noise(0.06, 0.06, 2400, "bandpass", 0.09); this.noise(0.08, 0.05, 900, "lowpass", 0.15); this.tone("sawtooth", 160, 60, 0.12, 0.04, 0.02); },
  alba_sizzle() { this.noise(0.35, 0.05, 6000, "highpass"); for (const t of [0.05, 0.14, 0.23]) this.noise(0.03, 0.05, 4200, "bandpass", t); },
  alba_ding() { this.tone("sine", 1568, 1568, 0.38, 0.07); this.tone("sine", 3136, 3136, 0.22, 0.03); this.tone("sine", 4186, 4186, 0.12, 0.015); },
  alba_step() { this.tone("triangle", 330, 180, 0.05, 0.05); this.noise(0.025, 0.03, 1200, "bandpass"); },
  alba_zap() { this.noise(0.14, 0.05, 3500, "bandpass", 0, 1200); this.tone("square", 1400, 500, 0.08, 0.04); },
  alba_chime() { this.tone("sine", 784, 784, 0.18, 0.06); this.tone("triangle", 784, 784, 0.12, 0.02); this.tone("sine", 1175, 1175, 0.26, 0.06, 0.09); },
  alba_buzz() { this.tone("sawtooth", 110, 100, 0.22, 0.07); this.tone("square", 112, 104, 0.22, 0.04); },
  alba_n0() { albaNote(this, 523.25); },
  alba_n1() { albaNote(this, 659.25); },
  alba_n2() { albaNote(this, 783.99); },
  alba_n3() { albaNote(this, 880); },
  alba_go() { this.arp("square", [523, 659, 784], 0.08, 0.1, 0.05); },
  alba_end() { this.tone("triangle", 784, 784, 0.14, 0.07); this.tone("triangle", 523, 523, 0.26, 0.07, 0.14); },
  alba_win() { this.arp("square", [523, 659, 784], 0.06, 0.09, 0.05); this.tone("square", 1047, 1047, 0.2, 0.055, 0.18); this.arp("triangle", [523, 659, 784, 1047], 0.06, 0.12, 0.04); },
  /** A rallying cry: a low growl that climbs. */
  mob_howl() { this.tone("sawtooth", 150, 300, 0.38, 0.09); this.tone("sawtooth", 110, 84, 0.42, 0.06, 0.04); },
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
  // ── 레이드던전 (dimrift.js) ──
  /** A party member is asked to go in: two bright pings over a low hum, hard to miss. */
  rc_ping() { this.tone("sine", 1319, 1319, 0.12, 0.1); this.tone("sine", 1760, 1760, 0.16, 0.09, 0.14); this.tone("triangle", 220, 233, 0.6, 0.06); },
  /** Stepping through into a rift: a downward rush and a hollow chord. */
  dim_open() { this.noise(0.6, 0.18, 4000, "bandpass", 0, 200); this.tone("sawtooth", 330, 110, 0.6, 0.06); this.arp("triangle", [247, 294, 370], 0.06, 0.4, 0.06, 0.25); },
  /** An orb taken: a quick rising sparkle. */
  dim_orb() { this.arp("sine", [880, 1175, 1568], 0.04, 0.14, 0.07); this.tone("triangle", 440, 880, 0.12, 0.05); },
  /** A shrine answers: a struck crystal and a swell. */
  dim_pylon() { this.tone("sine", 1047, 1047, 0.8, 0.08); this.tone("sine", 1568, 1568, 0.6, 0.05, 0.02); this.noise(0.5, 0.06, 6000, "highpass", 0, 3000); this.arp("triangle", [523, 659, 784, 1047], 0.05, 0.2, 0.06, 0.1); },
  /** The master comes: a deep tear, a drum and a falling minor figure. */
  dim_boss() { this.tone("sawtooth", 70, 35, 1.4, 0.2); this.noise(1.2, 0.3, 900, "lowpass", 0, 50); this.arp("square", [233, 220, 208, 196], 0.18, 0.3, 0.07, 0.3); },
  /** Cleared: a bright fanfare. */
  dim_clear() { this.arp(0.25, [523, 659, 784, 1047, 1319], 0.09, 0.3, 0.1); this.tone("triangle", 262, 262, 1, 0.1, 0.45); this.tone("triangle", 392, 392, 1, 0.08, 0.45); },
  /** The way home opens: a slow shimmer. */
  dim_portal() { this.noise(1, 0.08, 3000, "bandpass", 0, 6000); this.arp("sine", [784, 988, 1175, 1568], 0.12, 0.5, 0.06); },
  // ── gathering (gather.js): kind 0 herb · 1 ore · 2 wood ──
  /** Kneeling to a herb, setting a pick to the rock, an axe to the log. */
  gat_start(k = 0) {
    if (k === 0 || k === 3) { this.noise(0.18, 0.07, 2600, "bandpass", 0, 4200); this.tone("triangle", 520, 620, 0.08, 0.04); }
    else if (k === 1) { this.tone("square", 1180 * this.vary(), 900, 0.05, 0.05); this.noise(0.06, 0.08, 3000, "highpass"); }
    else { this.tone("triangle", 180, 120, 0.09, 0.09); this.noise(0.08, 0.1, 900, "lowpass"); }
  },
  /** One beat of the work: a leafy rustle, a clink of iron on stone, a chop. */
  gat_work(k = 0) {
    const v = this.vary();
    if (k === 0 || k === 3) this.noise(0.12, 0.05, 3200 * v, "bandpass", 0, 1800);
    else if (k === 1) { this.tone("square", 1480 * v, 1100, 0.04, 0.05); this.tone("sine", 2960 * v, 2600, 0.12, 0.025, 0.01); this.noise(0.04, 0.06, 4000, "highpass"); }
    else { this.tone("triangle", 150 * v, 90, 0.08, 0.1); this.noise(0.07, 0.1, 1100 * v, "lowpass"); }
  },
  /** "반짝!": a bright two-note glint — tap now. */
  gat_tap() { this.tone("sine", 1568, 1568, 0.07, 0.09); this.tone("sine", 2093, 2093, 0.14, 0.08, 0.06); },
  /** A tap in time: a quick upward sparkle. */
  gat_hit() { this.arp("sine", [1319, 1760, 2349], 0.03, 0.08, 0.06); },
  /** 대성공: the sparkle and a warm chord under it. */
  gat_great() { this.arp("sine", [1047, 1319, 1568, 2093], 0.05, 0.16, 0.07); this.tone("triangle", 523, 523, 0.4, 0.06, 0.05); },
  /** The channel broken: a soft falling note. */
  gat_break() { this.tone("triangle", 440, 260, 0.18, 0.06); },
  // ── crafting stations (station.js, minigames.js forge/brew; L2b) ──
  /** A hammer blow on the ingot: a ringing clank, brighter for a good blow (q 0..1). */
  forge_hit(q = 1) {
    const v = this.vary();
    this.tone("square", (900 + 700 * q) * v, 700, 0.05, 0.07); this.tone("sine", (2200 + 900 * q) * v, 2000, 0.22, 0.03 + 0.03 * q, 0.01);
    this.noise(0.05, 0.1, 3500, "highpass");
  },
  /** The finished piece dunked in water: a hiss. */
  forge_quench() { this.noise(0.7, 0.09, 4200, "highpass", 0, 1500); this.tone("sine", 660, 880, 0.12, 0.04, 0.05); },
  /** The paddle dips into the brew. */
  brew_stir() { this.noise(0.14, 0.05, 900, "lowpass", 0, 1600); },
  /** A bubble rises in the cauldron. */
  brew_bubble() { const f = 260 + Math.random() * 220; this.tone("sine", f, f * 2.2, 0.07, 0.05); },
  /** A clear brew: a glassy chime. */
  brew_done() { this.arp("sine", [784, 1047, 1319, 1568], 0.06, 0.25, 0.06); this.noise(0.2, 0.03, 5000, "highpass"); },
  /** A craft made (station.js `mo` 1) and a 대성공 (`mo` 2); a failure falls. */
  craft_ok() { this.arp("triangle", [523, 659, 784], 0.06, 0.18, 0.08); },
  craft_great() { this.arp("square", [523, 659, 784, 1047, 1319], 0.06, 0.2, 0.06); this.tone("triangle", 262, 262, 0.6, 0.08, 0.3); },
  craft_fail() { this.tone("triangle", 392, 196, 0.35, 0.08); this.noise(0.25, 0.05, 700, "lowpass", 0.05); },
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
  // 참 (charms.js): a charm clicks into the board's frame, lifts out of it, a seal breaks (the sparkle climbs with
  // the grade: 1 매직, 2 레어, 3 전설), a nail opens a cell, a legendary goes off
  charm_place() { this.tone("sine", 620, 880, 0.07, 0.1); this.tone(0.5, 1760, 1760, 0.05, 0.05, 0.05); this.noise(0.03, 0.08, 3200, "bandpass"); },
  charm_remove() { this.tone("sine", 780, 520, 0.08, 0.09); this.noise(0.04, 0.06, 1800, "bandpass", 0.02); },
  charm_id(g = 1) {
    this.noise(0.18, 0.1, 1400, "bandpass", 0, 5200);                       // the seal crumbling off
    const notes = g >= 3 ? [784, 988, 1175, 1568, 1976, 2349] : g === 2 ? [784, 988, 1175, 1568] : [784, 988, 1175];
    this.arp("sine", notes, 0.07, 0.22, 0.09, 0.14);
    this.arp(0.5, notes.map((f) => f * 2), 0.07, 0.1, 0.03, 0.16);
    if (g >= 3) { this.tone("sine", 392, 392, 0.9, 0.08, 0.14); this.tone("sine", 3136, 3136, 0.5, 0.04, 0.6); }
  },
  charm_expand() { this.tone("square", 180, 120, 0.05, 0.1); this.noise(0.03, 0.16, 2600, "bandpass"); this.tone("square", 200, 130, 0.05, 0.1, 0.12); this.noise(0.03, 0.16, 2800, "bandpass", 0.12); this.arp("sine", [660, 880, 1320], 0.06, 0.16, 0.08, 0.26); },
  charm_proc(k = 0) { if (k === 0) { this.tone("sine", 440, 330, 0.18, 0.09); this.tone("sine", 660, 495, 0.22, 0.05, 0.08); } else this.arp("sine", k === 1 ? [1320, 1760] : [1760, 1320], 0.05, 0.12, 0.07); },
  salvage() { this.noise(0.12, 0.2, 2000, "bandpass"); this.tone("square", 500, 250, 0.1, 0.08, 0.04); this.tone(0.5, 1320, 1320, 0.06, 0.06, 0.14); },
  // ── interface ──
  ui() { this.tone(0.5, 660, 660, 0.035, 0.06); },
  // ── a house of one's own (housing.js) ──
  /** A piece set down: a soft wooden knock, then a little settle. */
  furn_place() { this.noise(0.05, 0.22, 700, "bandpass", 0, 300); this.tone("triangle", 220, 150, 0.08, 0.14); this.tone("triangle", 330, 300, 0.05, 0.06, 0.07); },
  /** A piece lifted: a scrape upward and a light pop. */
  furn_pick() { this.noise(0.08, 0.12, 900, "bandpass", 0, 1800); this.tone(0.5, 440, 660, 0.07, 0.06, 0.04); },
  /** A piece turned: a short wooden creak. */
  furn_turn() { this.tone("sawtooth", 160, 210, 0.07, 0.05); this.noise(0.04, 0.08, 1200, "bandpass", 0.03); },
  /** A chest lid creaks open, a latch clicks. */
  chest_open() { this.tone(0.5, 1800, 1800, 0.02, 0.06); this.tone("sawtooth", 120, 190, 0.18, 0.06, 0.03); this.tone("triangle", 392, 523, 0.12, 0.08, 0.16); },
  /** 안락한 휴식: a warm, slow lullaby of three notes. */
  cozy() { this.arp("triangle", [392, 494, 587, 784], 0.14, 0.3, 0.1); this.tone("sine", 196, 196, 0.8, 0.06, 0.2); },
  open() { this.tone(0.25, 520, 780, 0.06, 0.06); },
  close() { this.tone(0.25, 700, 460, 0.06, 0.05); },
  tab() { this.tone(0.125, 880, 880, 0.03, 0.05); },
  hover() { this.tone("sine", 1200, 1200, 0.02, 0.02); },
  no() { this.tone("square", 180, 150, 0.12, 0.1); this.tone("square", 140, 120, 0.12, 0.08, 0.1); },
  // ── travel ──
  wp_wake() { this.arp("sine", [392, 523, 659, 784, 1047], 0.09, 0.4, 0.1); this.noise(0.8, 0.05, 5000, "highpass", 0.2); },
  warp() { this.noise(0.5, 0.18, 300, "bandpass", 0, 4000); this.arp("sine", [523, 784, 1047], 0.06, 0.3, 0.08, 0.2); },
  // a wooden door: the latch, a soft creak, a bell over the door, the door closing behind you
  door() { this.noise(0.04, 0.16, 1800, "bandpass"); this.tone("triangle", 180, 120, 0.22, 0.05, 0.03); this.tone("sawtooth", 340, 260, 0.18, 0.012, 0.05); this.tone("sine", 1568, 1568, 0.5, 0.05, 0.08); this.tone("sine", 2093, 2093, 0.4, 0.03, 0.12); this.noise(0.08, 0.14, 300, "lowpass", 0.32); },
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
  // ── forge (캉캉대장간) and alchemy kiln (보글연금공방) shifts: all short and soft next to combat hits ──
  bellows_puff() { this.noise(0.22, 0.09, 500, "bandpass", 0, 1800); this.noise(0.12, 0.04, 2500, "highpass", 0.1); },
  furnace_roar() { this.noise(0.65, 0.12, 160, "lowpass", 0, 420); this.tone("sawtooth", 55, 80, 0.6, 0.05); this.noise(0.4, 0.04, 900, "bandpass", 0.1, 300); },
  anvil_perfect() { const p = this.vary(); this.punch(p, 520, 140, 3200, 0.8); this.tone("sine", 1760 * p, 1700 * p, 0.38, 0.06, 0.005); this.tone("sine", 2640 * p, 2600 * p, 0.3, 0.035, 0.005); this.tone("sine", 3980 * p, 3900 * p, 0.2, 0.02, 0.005); },
  anvil_good() { const p = this.vary(); this.punch(p, 380, 120, 1500, 0.7); this.tone("sine", 1100 * p, 1040 * p, 0.14, 0.05, 0.005); },
  anvil_miss() { const p = this.vary(); this.tone("sine", 110 * p, 60 * p, 0.12, 0.2); this.noise(0.05, 0.1, 400, "lowpass"); },
  quench_hiss() { this.noise(0.38, 0.12, 6500, "highpass", 0, 1200); this.noise(0.2, 0.05, 3000, "bandpass", 0.04, 800); },
  order_done() { this.arp("triangle", [784, 1047, 1319], 0.07, 0.14, 0.09); this.tone("sine", 2093, 2093, 0.18, 0.025, 0.14); },
  order_late() { this.tone("square", 196, 190, 0.16, 0.06); this.tone("square", 147, 140, 0.2, 0.06, 0.17); },
  kiln_whoosh() { this.noise(0.3, 0.07, 350, "bandpass", 0, 1100); this.noise(0.18, 0.03, 1800, "bandpass", 0.08, 600); },
  stir_perfect() { const p = this.vary(); this.arp("sine", [880 * p, 1320 * p, 1760 * p], 0.05, 0.12, 0.07); this.tone("sine", 2640 * p, 2640 * p, 0.2, 0.025, 0.1); },
  stir_good() { const p = this.vary(); this.arp("sine", [660 * p, 880 * p], 0.06, 0.1, 0.07); },
  stir_miss() { const p = this.vary(); this.tone("sine", 240 * p, 90 * p, 0.2, 0.14); this.tone("sine", 180 * p, 80 * p, 0.12, 0.08, 0.08); this.noise(0.1, 0.03, 500, "lowpass"); },
  /** The kiln roars up: a joint 풀무 note (합동 풀무). */
  kiln_roar() { this.noise(0.5, 0.1, 220, "lowpass", 0, 600); this.tone("sawtooth", 70, 110, 0.4, 0.05); this.noise(0.25, 0.05, 1400, "bandpass", 0.08, 500); },
  /** A brew boiling over: wet bubbling glugs. */
  /** A book put down (on the 반납대 or into a shelf): a soft, papery thunk. */
  book_thunk() { const p = this.vary(); this.tone("triangle", 150 * p, 90 * p, 0.08, 0.16); this.noise(0.06, 0.06, 900, "lowpass"); },
  /** A book in the wrong shelf: a flat double buzz. */
  wrong_buzz() { this.tone("square", 140, 130, 0.12, 0.06); this.tone("square", 140, 120, 0.14, 0.06, 0.16); },
  /** The 반납대's desk bell: one bright ding with a ring-out. */
  desk_bell() { const p = this.vary(); this.tone("sine", 1760 * p, 1760 * p, 0.6, 0.08); this.tone("sine", 2640 * p, 2640 * p, 0.3, 0.03); },
  boil_over() { const p = this.vary(); for (let i = 0; i < 4; i++) this.tone("sine", (180 + i * 40) * p, (420 + i * 60) * p, 0.06, 0.12, i * 0.07); this.noise(0.3, 0.06, 700, "lowpass", 0, 900); },
  bottle_pop() { const p = this.vary(); this.tone("sine", 300 * p, 1100 * p, 0.07, 0.16); this.noise(0.03, 0.1, 2400, "bandpass"); this.tone("sine", 900 * p, 700 * p, 0.1, 0.04, 0.05); },
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
  // footsteps: light and low, a little different each time
  step_grass() { const p = this.vary(); this.noise(0.05, 0.03, 2500 * p, "bandpass"); this.noise(0.03, 0.012, 6000 * p, "highpass", 0.012); },
  step_dirt() { this.noise(0.05, 0.04, 900 * this.vary(), "bandpass"); },
  step_stone() { const p = this.vary(); this.noise(0.03, 0.04, 3200 * p, "bandpass"); this.tone("sine", 300 * p, 220 * p, 0.03, 0.018); },
  step_water() { const p = this.vary(); this.noise(0.07, 0.035, 1400 * p, "bandpass", 0, 3200 * p); this.tone("sine", 700 * p, 1100 * p, 0.04, 0.012, 0.015); },
  step_wood() { this.tone("triangle", 220, 160, 0.05, 0.05); this.noise(0.03, 0.025, 1200, "bandpass"); },
};
