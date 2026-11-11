/**
 * Sound, synthesised on the fly — square and triangle waves in the spirit of a
 * hand-held console's sound chip. No audio files.
 */

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(n) {
  if (!n || n === "-") return 0;
  const semi = NOTE[n[0]] + (n[1] === "#" ? 1 : 0);
  const oct = Number(n[n.length - 1]);
  return 440 * Math.pow(2, (semi - 9 + (oct - 4) * 12) / 12);
}
const seq = (s) => s.trim().split(/\s+/);

// Short original loops: [tempo (steps/min), lead, bass]
const TRACKS = {
  town: [300,
    seq("E5 - G5 - C6 - B5 A5 G5 - E5 - D5 E5 G5 - A5 - C6 - A5 - G5 E5 D5 - C5 - D5 E5 D5 - E5 - G5 - C6 - B5 A5 G5 - A5 - B5 C6 D6 - C6 - B5 - G5 - A5 G5 E5 - D5 - C5 - - -"),
    seq("C3 - G3 - C3 - G3 - A2 - E3 - A2 - E3 - F2 - C3 - F2 - C3 - G2 - D3 - G2 - D3 - C3 - G3 - C3 - G3 - A2 - E3 - A2 - E3 - F2 - C3 - G2 - D3 - C3 - G3 - C3 - - -")],
  field: [340,
    seq("G4 - C5 D5 E5 - G5 - E5 - D5 C5 D5 - G4 - A4 - D5 E5 F5 - A5 - G5 - E5 D5 E5 - - - G4 - C5 D5 E5 - G5 - C6 - B5 G5 A5 - E5 - F5 - A5 G5 F5 E5 D5 - C5 - E5 D5 C5 - - -"),
    seq("C3 C3 G3 C3 C3 C3 G3 C3 C3 C3 G3 C3 G2 G2 D3 G2 D3 D3 A3 D3 D3 D3 A3 D3 E3 E3 B3 E3 E3 E3 B3 E3 C3 C3 G3 C3 C3 C3 G3 C3 A2 A2 E3 A2 A2 A2 E3 A2 F2 F2 C3 F2 G2 G2 D3 G2 C3 C3 G3 C3 C3 - - -")],
  forest: [250,
    seq("A4 - - C5 E5 - - D5 C5 - B4 - A4 - - - G4 - - B4 D5 - - C5 B4 - A4 - G4 - - - F4 - - A4 C5 - - B4 A4 - G4 - E4 - G4 - A4 - - - B4 - C5 - A4 - - - - - - -"),
    seq("A2 - E3 - A2 - E3 - A2 - E3 - A2 - E3 - G2 - D3 - G2 - D3 - G2 - D3 - G2 - D3 - F2 - C3 - F2 - C3 - E2 - B2 - E2 - B2 - A2 - E3 - A2 - E3 - A2 - - - - - - -")],
  cave: [200,
    seq("E4 - - - G4 - F#4 - E4 - - - B3 - - - D4 - - - F#4 - E4 - D4 - - - A3 - - - E4 - - - G4 - B4 - A4 - - - F#4 - - - E4 - D4 - B3 - D4 - E4 - - - - - - -"),
    seq("E2 - - - E2 - - - E2 - - - E2 - - - D2 - - - D2 - - - D2 - - - D2 - - - C2 - - - C2 - - - A1 - - - A1 - - - B1 - - - B1 - - - E2 - - - - - - -")],
};

export const Sound = {
  ctx: null, sfxOn: true, bgmOn: true, track: null, step: 0, next: 0, timer: 0, master: null, music: null,

  /** Browsers only allow audio after a gesture — call this from a click/keypress. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
    this.timer = setInterval(() => this.pump(), 60);
  },

  tone(type, f0, f1, dur, vol, when = 0, dest = null) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, hp = 800) {
    const c = this.ctx;
    if (!c) return;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = hp;
    s.buffer = buf; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
  },

  play(name) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case "swing": this.noise(0.09, 0.25, 1800); break;
      case "shoot": this.noise(0.06, 0.18, 2500); this.tone("square", 900, 400, 0.08, 0.08); break;
      case "magic": this.tone("sine", 500, 1300, 0.16, 0.16); this.tone("triangle", 750, 1700, 0.14, 0.08, 0.03); break;
      case "boom": this.noise(0.3, 0.4, 200); this.tone("square", 160, 40, 0.3, 0.2); break;
      case "ice": this.tone("triangle", 1800, 600, 0.3, 0.14); this.noise(0.2, 0.15, 4000); break;
      case "hit": this.tone("square", 240, 90, 0.08, 0.16); break;
      case "crit": this.tone("square", 520, 140, 0.14, 0.2); this.noise(0.08, 0.22, 1200); break;
      case "hurt": this.tone("sawtooth", 180, 70, 0.16, 0.2); break;
      case "die": this.tone("square", 300, 60, 0.22, 0.14); break;
      case "coin": this.tone("square", 1320, 1320, 0.05, 0.1); this.tone("square", 1760, 1760, 0.1, 0.1, 0.05); break;
      case "item": this.tone("square", 880, 880, 0.05, 0.1); this.tone("square", 1175, 1175, 0.05, 0.1, 0.05); this.tone("square", 1568, 1568, 0.1, 0.1, 0.1); break;
      case "potion": this.tone("sine", 300, 900, 0.2, 0.2); break;
      case "ui": this.tone("square", 660, 660, 0.04, 0.08); break;
      case "no": this.tone("square", 180, 150, 0.12, 0.12); break;
      case "level": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone("square", f, f, 0.16, 0.14, i * 0.09)); break;
      case "ok": [784, 988, 1319].forEach((f, i) => this.tone("triangle", f, f, 0.2, 0.2, i * 0.08)); break;
      case "fail": [392, 330, 262].forEach((f, i) => this.tone("sawtooth", f, f, 0.2, 0.1, i * 0.12)); break;
      case "warn": this.tone("square", 440, 440, 0.1, 0.12); this.tone("square", 440, 440, 0.1, 0.12, 0.2); break;
      case "heal": [659, 784, 988, 1319].forEach((f, i) => this.tone("sine", f, f, 0.25, 0.14, i * 0.06)); break;
      case "buff": this.tone("sawtooth", 200, 600, 0.3, 0.12); break;
    }
  },

  bgm(name) {
    if (this.track === name) return;
    this.track = name;
    this.step = 0;
    this.next = this.ctx ? this.ctx.currentTime + 0.1 : 0;
  },
  /** Schedule music a little ahead of the audio clock. */
  pump() {
    const c = this.ctx;
    const tr = TRACKS[this.track];
    if (!c || !tr || !this.bgmOn || c.state !== "running") { if (c) this.next = c.currentTime + 0.1; return; }
    const [tempo, lead, bass] = tr;
    const len = 60 / tempo;
    while (this.next < c.currentTime + 0.25) {
      const when = Math.max(0, this.next - c.currentTime);
      const a = freq(lead[this.step % lead.length]), b = freq(bass[this.step % bass.length]);
      if (a) this.tone("square", a, a, len * 1.7, 0.1, when, this.music);
      if (b) this.tone("triangle", b, b, len * 1.9, 0.26, when, this.music);
      this.step++;
      this.next += len;
    }
  },
};
