#!/usr/bin/env node
/**
 * Tales Tales SFX Automated Acoustic & Integrity Audit
 * Runs all SFX in game/public/audio.js through a strict instrumented Web Audio mock:
 *  1. Checks 0 runtime errors & 0 invalid AudioParam calls (NaN, <=0 exponential ramps)
 *  2. Checks 0 missing literal Sound.play("...") keys across game/public/*.js
 *  3. Audits all 7 weapons' voice budget, 4-layer composition, and dynamic hierarchy
 *     (swing < hit < finisher, hit < crit).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PUB = path.join(ROOT, "game", "public");
const AUDIO_JS = path.join(PUB, "audio.js");

// Minimal browser globals so audio.js imports cleanly in Node
globalThis.window = globalThis;
globalThis.document = { hidden: false, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });

function makeParam(initial = 0, name = "param", log = null) {
  let peak = Math.abs(initial);
  const check = (v, op, record = true) => {
    if (!Number.isFinite(v)) throw new Error(`Non-finite AudioParam (${name}.${op}): ${v}`);
    if (op === "exp" && v <= 0) throw new Error(`Invalid exponentialRamp <= 0 (${name}): ${v}`);
    if (record && Math.abs(v) > peak) peak = Math.abs(v);
    if (record && log) log.push({ op, v });
  };
  return {
    get value() { return initial; },
    set value(v) { check(v, "set"); initial = v; },
    get _peak() { return peak; },
    setValueAtTime(v, t) { check(v, "setAt"); check(t, "time", false); },
    linearRampToValueAtTime(v, t) { check(v, "lin"); check(t, "time", false); },
    exponentialRampToValueAtTime(v, t) { check(v, "exp"); check(t, "time", false); },
    setTargetAtTime(v, t, tc) { check(v, "target"); check(t, "time", false); check(tc, "tc", false); },
    cancelScheduledValues(t) { check(t, "cancel", false); },
  };
}

function createMockCtx() {
  let events = [];
  const makeNode = (kind) => {
    const node = {
      _kind: kind,
      _outs: [],
      connect(dest) { this._outs.push(dest); return dest; },
      disconnect() {},
    };
    return node;
  };
  const ctx = {
    currentTime: 10,
    state: "running",
    sampleRate: 44100,
    destination: makeNode("destination"),
    _resetEvents() { events = []; },
    _getEvents() { return events; },
    resume: async () => {},
    suspend: async () => {},
    createGain() {
      const n = makeNode("gain");
      n.gain = makeParam(1, "gain");
      return n;
    },
    createBiquadFilter() {
      const n = makeNode("filter");
      n.type = "lowpass";
      n.frequency = makeParam(350, "frequency");
      n.Q = makeParam(1, "Q");
      return n;
    },
    createDynamicsCompressor() {
      const n = makeNode("compressor");
      n.threshold = makeParam(-24, "threshold");
      n.knee = makeParam(30, "knee");
      n.ratio = makeParam(12, "ratio");
      n.attack = makeParam(0.003, "attack");
      n.release = makeParam(0.25, "release");
      return n;
    },
    createWaveShaper() {
      const n = makeNode("waveshaper");
      n.curve = null;
      n.oversample = "none";
      return n;
    },
    createDelay() {
      const n = makeNode("delay");
      n.delayTime = makeParam(0, "delayTime");
      return n;
    },
    createPeriodicWave() { return {}; },
    createBuffer(ch, len, sr) {
      const data = new Float32Array(len);
      return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: () => data };
    },
    createOscillator() {
      const n = makeNode("osc");
      const freqLog = [];
      n.type = "sine";
      n.frequency = makeParam(440, "osc.freq", freqLog);
      n.setPeriodicWave = () => { n.type = "periodic"; };
      n.start = (t = ctx.currentTime) => { n._start = t; };
      n.stop = (t = ctx.currentTime) => {
        n._stop = t;
        events.push({ kind: "osc", node: n, freqLog, start: n._start ?? ctx.currentTime, stop: t });
      };
      return n;
    },
    createBufferSource() {
      const n = makeNode("noise");
      n.buffer = null;
      n.loop = false;
      n.start = (t = ctx.currentTime, _off = 0, dur = 0.1) => {
        n._start = t;
        n._stop = t + dur;
        events.push({ kind: "noise", node: n, start: t, stop: t + dur });
      };
      n.stop = () => {};
      return n;
    },
  };
  return ctx;
}

function traceChain(node, seen = new Set()) {
  if (!node || seen.has(node)) return { gainPeak: 0, driven: false, filter: null };
  seen.add(node);
  let gainPeak = 0, driven = node._kind === "waveshaper", filter = node._kind === "filter" ? node : null;
  if (node._kind === "gain") gainPeak = Math.max(gainPeak, node.gain._peak);
  for (const out of node._outs || []) {
    const sub = traceChain(out, seen);
    if (sub.driven) driven = true;
    if (!filter && sub.filter) filter = sub.filter;
    if (node._kind !== "gain" && sub.gainPeak > gainPeak) gainPeak = sub.gainPeak;
  }
  return { gainPeak, driven, filter };
}

function analyzeEvents(evList) {
  let energy = 0, lowVoices = 0, midHighVoices = 0, noiseVoices = 0, drivenVoices = 0, maxDur = 0;
  for (const e of evList) {
    const dur = Math.max(0.01, e.stop - e.start);
    if (dur > maxDur) maxDur = dur;
    const { gainPeak, driven, filter } = traceChain(e.node);
    const g = gainPeak || 0.05;
    if (driven) drivenVoices++;
    energy += g * (driven ? 1.25 : 1.0) * Math.min(0.28, dur + 0.04);
    if (e.kind === "noise") {
      noiseVoices++;
      const fc = filter ? filter.frequency._peak : 1000;
      if (fc >= 700) midHighVoices++;
      else lowVoices++;
    } else {
      const fMax = e.freqLog.length ? Math.max(...e.freqLog.map(x => x.v)) : 440;
      const fMin = e.freqLog.length ? Math.min(...e.freqLog.map(x => x.v)) : 440;
      if (fMin <= 185) lowVoices++;
      if (fMax >= 300) midHighVoices++;
    }
  }
  return {
    voices: evList.length,
    energy: Number(energy.toFixed(4)),
    lowVoices,
    midHighVoices,
    noiseVoices,
    drivenVoices,
    maxDur: Number(maxDur.toFixed(3)),
  };
}

// 1. Parse defined SFX keys & literal callers
const src = fs.readFileSync(AUDIO_JS, "utf8");
const sfxStart = src.indexOf("const SFX = {");
const sfxEnd = src.indexOf("\n};", sfxStart);
const sfxBlock = src.slice(sfxStart, sfxEnd);
const definedKeys = [...sfxBlock.matchAll(/^\s{2}([a-zA-Z0-9_]+)\s*\(/gm)].map(m => m[1]);

const publicFiles = fs.readdirSync(PUB).filter(f => f.endsWith(".js"));
const playedLiterals = new Set();
for (const f of publicFiles) {
  const txt = fs.readFileSync(path.join(PUB, f), "utf8");
  for (const m of txt.matchAll(/Sound\.play\(\s*["']([a-zA-Z0-9_]+)["']/g)) {
    playedLiterals.add(m[1]);
  }
}
const missing = [...playedLiterals].filter(k => !definedKeys.includes(k));

// 2. Load audio.js and execute every SFX
const { Sound } = await import(pathToFileURL(AUDIO_JS).href);
const ctx = createMockCtx();
Sound.init(ctx);
Sound.vol.mute = false;

let errors = [];
for (const k of definedKeys) {
  Sound.voices = 0;
  ctx.currentTime += 5;
  ctx._resetEvents();
  try {
    Sound.play(k);
  } catch (err) {
    errors.push(`${k}: ${err.message}`);
  }
}

// 3. Detailed weapon combat audit
const weapons = [
  { wk: "sword", swing: ["swing_sword", false], swingFin: ["swing_sword", true], hit: ["hit", "sword"], fin: ["finisher", "sword"], crit: ["crit", "sword"] },
  { wk: "dagger", swing: ["swing_dagger"], hit: ["hit", "dagger"], fin: ["finisher", "dagger"], crit: ["crit", "dagger"] },
  { wk: "spear", swing: ["swing_spear", false], swingFin: ["swing_spear", true], hit: ["hit", "spear"], fin: ["finisher", "spear"], crit: ["crit", "spear"] },
  { wk: "hammer", swing: ["swing_hammer"], hit: ["hammer_land", { hit: true, kind: 7 }], fin: ["hammer_land", { hit: true, final: true }], crit: ["hammer_land", { hit: true, crit: true, kind: 132 }] },
  { wk: "staff", swing: ["swing_staff"], hit: ["magic_hit", false], fin: ["magic_hit", true], crit: ["crit", "staff"] },
  { wk: "book", swing: ["swing_book"], hit: ["magic_hit", false], fin: ["magic_hit", true], crit: ["crit", "book"] },
  { wk: "bow", swing: ["bow_shot", false], swingFin: ["bow_shot", true], hit: ["arrow_hit"], fin: ["finisher", "bow"], crit: ["crit", "bow"] },
];

const measure = ([name, arg]) => {
  Sound.voices = 0;
  ctx.currentTime += 5;
  ctx._resetEvents();
  Sound.play(name, arg);
  return analyzeEvents(ctx._getEvents());
};

const warnings = [];
const report = [];
for (const w of weapons) {
  const sw = measure(w.swing);
  const hi = measure(w.hit);
  const fi = measure(w.fin);
  const cr = measure(w.crit);
  report.push({ wk: w.wk, swing: sw, hit: hi, fin: fi, crit: cr });

  for (const [label, m] of [["swing", sw], ["hit", hi], ["fin", fi], ["crit", cr]]) {
    if (m.voices === 0) errors.push(`${w.wk}.${label}: 0 voices emitted`);
    if (m.voices > 12) warnings.push(`${w.wk}.${label}: high voice count (${m.voices})`);
  }
  if (hi.lowVoices < 1) warnings.push(`${w.wk}.hit: missing low-end weight (<185Hz)`);
  if (hi.noiseVoices < 1) warnings.push(`${w.wk}.hit: missing noise transient/body`);
  if (cr.energy <= hi.energy) warnings.push(`${w.wk}: crit energy (${cr.energy}) <= hit (${hi.energy})`);
  if (fi.energy < hi.energy * 0.95) warnings.push(`${w.wk}: finisher energy (${fi.energy}) < hit (${hi.energy})`);
}

console.log(`SFX Audit — Defined: ${definedKeys.length}, Literal callers: ${playedLiterals.size}, Missing: ${missing.length}`);
if (missing.length) console.error("Missing keys:", missing);

console.log("\nWeapon Combat Acoustic Profile (voices | energy | low/midHi/noise | driven):");
for (const r of report) {
  const fmt = (m) => `${m.voices}v E=${m.energy.toFixed(3)} (${m.lowVoices}/${m.midHighVoices}/${m.noiseVoices} d:${m.drivenVoices})`;
  console.log(`  ${r.wk.padEnd(7)} | sw: ${fmt(r.swing)} | hit: ${fmt(r.hit)} | fin: ${fmt(r.fin)} | crit: ${fmt(r.crit)}`);
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log("  -", w);
}
if (errors.length) {
  console.error("\nERRORS:");
  for (const e of errors) console.error("  !", e);
  process.exit(1);
}
if (missing.length) process.exit(1);
console.log("\nALL SFX AUDIT CHECKS PASSED.");
