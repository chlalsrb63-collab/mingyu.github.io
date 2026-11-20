/**
 * Laputa-inspired silent tapestry opening cinematic (Part 1: 4 woodcut plates, no narration/text)
 * followed by the 11-second in-game Willow Plaza camera pan & dolly-in transition (Part 2).
 */
import * as S3 from "./scene2d.js";
import { Sound } from "./audio.js";
import { G, el } from "./state.js";

const OPENING_BGM = "assets/music/opening.mp3";
let bgmAudio = null, bgmFadeTimer = 0;

function startIntroBgm() {
  stopIntroBgm(false);
  if (Sound.vol?.mute) return;
  // Duck normal map BGM cleanly while opening.mp3 plays
  if (Sound.ctx && Sound.music) {
    const t = Sound.ctx.currentTime;
    Sound.music.gain.cancelScheduledValues(t);
    Sound.music.gain.setTargetAtTime(0, t, 0.15);
  }
  const a = new Audio(OPENING_BGM);
  a.volume = Math.max(0, Math.min(1, (Sound.vol?.music ?? 0.7) * 0.85));
  a.currentTime = 0;
  a.play().catch(() => { /* autoplay blocked until user gesture */ });
  bgmAudio = a;
}

function fadeOutIntroBgm(ms = 3200) {
  clearInterval(bgmFadeTimer);
  // Restore town BGM gently as Willow Plaza fades in
  if (Sound.applyVolume) Sound.applyVolume();
  if (!bgmAudio) return;
  const a = bgmAudio, v0 = a.volume, t0 = performance.now();
  bgmFadeTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, v0 * (1 - p));
    if (p >= 1) {
      clearInterval(bgmFadeTimer);
      a.pause();
      if (bgmAudio === a) bgmAudio = null;
    }
  }, 50);
}

function stopIntroBgm(restore = true) {
  clearInterval(bgmFadeTimer);
  if (bgmAudio) { bgmAudio.pause(); bgmAudio.currentTime = 0; bgmAudio = null; }
  if (restore && Sound.applyVolume) Sound.applyVolume();
}

const SCENES = [
  { src: "assets/intro/scene1.jpg", dur: 7000, x0: -3.5, x1: 3.5, y0: 0, y1: -1.5, s0: 1.06, s1: 1.15, mood: "peace" },
  { src: "assets/intro/scene2.jpg", dur: 7000, x0: 3.0, x1: -3.0, y0: -1.0, y1: 1.0, s0: 1.08, s1: 1.16, mood: "warm" },
  { src: "assets/intro/scene3.jpg", dur: 7000, x0: 0, x1: 0, y0: 1.5, y1: -1.5, s0: 1.04, s1: 1.18, mood: "infect" },
  { src: "assets/intro/scene4.jpg", dur: 7000, x0: -2.5, x1: 2.5, y0: 0.5, y1: -0.5, s0: 1.14, s1: 1.05, mood: "gather" },
];
const FADE_MS = 1200;
const CAM_TOTAL_MS = 11000;
const CAM_ZOOM_OUT = 0.62;

let phase = "idle"; // "idle" | "video" | "cam"
let overlay = null, fadeEl = null;
let startedAt = 0, camStartAt = 0;
let rafId = 0, keyHandler = null;
let camSnapNext = false;
let camStartPos = [0, 0], camRightPos = [0, 0];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
const easeInOutCubic = (t) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2; };
const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;

export function isActive() { return phase !== "idle"; }
export function isCamActive() { return phase === "cam"; }
export function snapping() { const s = camSnapNext; camSnapNext = false; return s; }

/** Auto-trigger once for a brand-new character entering Willow Plaza right after creation. */
export function maybeStart(self) {
  if (!self || !self.name || phase !== "idle") return;
  const key = `lumentale:intro:${self.name}`;
  if (localStorage.getItem(key) === "1") return;
  if (self.lvl === 1 && (self.kills || 0) === 0 && self.q && self.q.i === 0 && self.q.st === 0) {
    localStorage.setItem(key, "1");
    start();
  } else {
    // Existing character: mark seen so it never interrupts veterans unless replayed from Settings
    localStorage.setItem(key, "1");
  }
}

/** Play Part 1 (4-scene silent woodcut opening) → Part 2 (11s Willow Plaza camera pan & zoom-in). */
export function start() {
  if (phase !== "idle") stop();
  phase = "video";
  document.body.classList.add("introcam", "intro-video");
  startIntroBgm();

  overlay = el("div", "intro-overlay");
  const stage = el("div", "intro-stage");
  const imgs = SCENES.map((sc, i) => {
    const img = el("img", "intro-plate" + (i === 0 ? " on" : ""));
    img.src = sc.src;
    img.alt = "";
    stage.append(img);
    return img;
  });
  const grain = el("div", "intro-grain");
  const spores = el("div", "intro-spores");
  for (let i = 0; i < 18; i++) {
    const dot = el("i");
    dot.style.left = `${(i * 37 + 11) % 96}%`;
    dot.style.top = `${(i * 53 + 7) % 92}%`;
    dot.style.animationDelay = `${(i * 0.35).toFixed(2)}s`;
    spores.append(dot);
  }
  const skip = el("button", "intro-skip", "건너뛰기 (ESC)");
  skip.type = "button";
  skip.addEventListener("click", (e) => { e.stopPropagation(); beginCameraPan(); });
  overlay.append(stage, grain, spores, skip);
  document.body.append(overlay);

  keyHandler = (e) => {
    if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (phase === "video") beginCameraPan();
      else if (phase === "cam") finish();
    }
  };
  window.addEventListener("keydown", keyHandler, true);

  startedAt = performance.now();
  const totalDur = SCENES.reduce((a, b) => a + b.dur, 0);

  const loop = (now) => {
    if (phase !== "video") return;
    const elapsed = now - startedAt;
    if (elapsed >= totalDur + FADE_MS) {
      beginCameraPan();
      return;
    }
    let acc = 0;
    for (let i = 0; i < SCENES.length; i++) {
      const sc = SCENES[i], img = imgs[i];
      const local = elapsed - acc;
      const active = local >= -FADE_MS && local <= sc.dur + FADE_MS;
      if (active) {
        const p = clamp01(local / sc.dur);
        const s = sc.s0 + (sc.s1 - sc.s0) * p;
        const x = sc.x0 + (sc.x1 - sc.x0) * p;
        const y = sc.y0 + (sc.y1 - sc.y0) * p;
        let op = 1;
        if (local < FADE_MS) op = clamp01(local / FADE_MS);
        else if (local > sc.dur - FADE_MS) op = clamp01((sc.dur - local) / FADE_MS);
        img.style.opacity = String(op);
        img.style.transform = `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0) scale(${s.toFixed(4)})`;
      } else {
        img.style.opacity = "0";
      }
      acc += sc.dur;
    }
    // Show dark spore particles during Scene 3 (outbreak) & early Scene 4
    const infectOn = elapsed >= SCENES[0].dur + SCENES[1].dur - 600 && elapsed <= totalDur - 1200;
    spores.classList.toggle("on", infectOn);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

/** Part 2: Fade-in from black → 2~8s Willow Plaza Far-Left→Right pan → 8~11s focus & dolly-in to player → 11s HUD fade-in. */
function beginCameraPan() {
  cancelAnimationFrame(rafId);
  if (overlay) { overlay.remove(); overlay = null; }
  document.body.classList.remove("intro-video");
  fadeOutIntroBgm(3200);

  // If not on a map yet (e.g. still loading), end cleanly
  if (!G.me || !G.map) { finish(); return; }

  phase = "cam";
  camStartAt = performance.now();
  camSnapNext = true;

  // Compute Willow Plaza horizontal pan endpoints in world coordinates:
  // In 2:1 iso, increasing (wx - wy) moves screen-right; decreasing (wx - wy) moves screen-left.
  const px = G.me.x, py = G.me.y;
  const span = G.map.id === "town" ? 210 : 140;
  camStartPos = [px - span, py + span];   // Far-left of Willow Plaza (Long Shot)
  camRightPos = [px + 34, py - 34];       // Slightly right of player before settling onto player

  // Black fade-in curtain (0~2s transition bridge)
  fadeEl = el("div", "intro-fade");
  const skip = el("button", "intro-skip", "건너뛰기 (ESC)");
  skip.type = "button";
  skip.addEventListener("click", (e) => { e.stopPropagation(); finish(); });
  fadeEl.append(skip);
  document.body.append(fadeEl);
  S3.setZoomMul(CAM_ZOOM_OUT);
}

/** Called once per frame by overlay.js while phase === "cam"; returns [focusX, focusY] for scene2d.render. */
export function cameraTick(_dt, _t) {
  const me = G.me;
  if (!me || phase !== "cam") return [me ? me.x : 0, me ? me.y : 0];
  const elapsed = performance.now() - camStartAt;

  // 0~2s: Black screen fades out smoothly over the far-left Long Shot
  if (fadeEl) {
    const fadeOp = elapsed < 2000 ? 1 - easeOutCubic(elapsed / 2000) : 0;
    fadeEl.style.background = `rgba(6, 5, 10, ${fadeOp.toFixed(3)})`;
  }

  if (elapsed >= CAM_TOTAL_MS) {
    finish();
    return [me.x, me.y];
  }

  // 0~2s: hold far-left long shot while fading in
  if (elapsed < 2000) {
    S3.setZoomMul(CAM_ZOOM_OUT);
    return camStartPos;
  }

  // 2~8s: Slow Horizontal Pan from Far-Left → Right across Willow Plaza
  if (elapsed < 8000) {
    const p = easeInOutSine((elapsed - 2000) / 6000);
    S3.setZoomMul(CAM_ZOOM_OUT);
    return [
      camStartPos[0] + (camRightPos[0] - camStartPos[0]) * p,
      camStartPos[1] + (camRightPos[1] - camStartPos[1]) * p,
    ];
  }

  // 8~11s: Ease-out onto player character & smooth Dolly-in / Zoom-in (0.62 → 1.0)
  const p = easeInOutCubic((elapsed - 8000) / 3000);
  S3.setZoomMul(CAM_ZOOM_OUT + (1 - CAM_ZOOM_OUT) * p);
  return [
    camRightPos[0] + (me.x - camRightPos[0]) * p,
    camRightPos[1] + (me.y - camRightPos[1]) * p,
  ];
}

export function finish() {
  stop();
}

export function stop() {
  cancelAnimationFrame(rafId);
  phase = "idle";
  stopIntroBgm(true);
  if (overlay) { overlay.remove(); overlay = null; }
  if (fadeEl) { fadeEl.remove(); fadeEl = null; }
  if (keyHandler) { window.removeEventListener("keydown", keyHandler, true); keyHandler = null; }
  document.body.classList.remove("introcam", "intro-video");
  S3.setZoomMul(1);
}
