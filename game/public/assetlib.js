/**
 * Optional external assets (PNG sprites, OGG/MP3 sounds) on top of the code-drawn art.
 *
 * Nothing imports this yet, so the game looks and sounds exactly as before. To let an
 * external file stand in for (or add to) something drawn in code:
 *
 *   1. copy the curated file to public/assets/<type>/… and list it in
 *      public/assets/manifest.json under "images" or "audio" with a key:
 *        "images": { "mob.twinhare": { "src": "assets/sprites/twinhare.png", "w": 32, "h": 32 } }
 *        "audio":  { "sfx.coin": { "src": "assets/sfx/coin.ogg", "vol": 0.6 } }
 *   2. call `await Assets.ready()` once at start-up (client.js), then where the art is
 *      made, prefer the file and keep the code as the fallback:
 *        const cv = Assets.canvas("mob.twinhare") || drawTwinhareInCode();
 *   3. record the pack in game/assets/CREDITS.md (name, author, URL, licence).
 *
 * Images come back as canvases (pixelated, never smoothed) so they drop in wherever a
 * code-drawn canvas was used. Sounds come back as decoded AudioBuffers for audio.js's
 * AudioContext. A missing or broken file is logged once and treated as absent.
 */

const BASE = new URL("./", import.meta.url);
let manifest = { images: {}, audio: {} };
let loading = null;
const canvases = new Map(); // key → canvas
const buffers = new Map(); // key → AudioBuffer
const failed = new Set();

/** Fetch the manifest and decode every listed image (sounds wait for an AudioContext). */
export function ready(url = "assets/manifest.json") {
  if (!loading) {
    loading = (async () => {
      try {
        const r = await fetch(new URL(url, BASE), { cache: "no-cache" });
        if (r.ok) manifest = { images: {}, audio: {}, ...(await r.json()) };
      } catch { /* no manifest: everything stays code-drawn */ }
      await Promise.all(Object.keys(manifest.images).map((k) => image(k)));
      return manifest;
    })();
  }
  return loading;
}

/** Load any image file as an HTMLImageElement (cached by URL). */
const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((ok, no) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => no(new Error("could not load " + src));
      im.src = new URL(src, BASE).href;
    }));
  }
  return imgCache.get(src);
}

/** Load a sound file and decode it with the given AudioContext (cached by URL). */
const audioCache = new Map();
export function loadAudio(ctx, src) {
  if (!audioCache.has(src)) {
    audioCache.set(src, fetch(new URL(src, BASE)).then((r) => {
      if (!r.ok) throw new Error("could not load " + src);
      return r.arrayBuffer();
    }).then((b) => ctx.decodeAudioData(b)));
  }
  return audioCache.get(src);
}

/** Decode the manifest image `key` into a canvas (optionally a sub-rectangle x, y, w, h). */
async function image(key) {
  const d = manifest.images[key];
  if (!d || canvases.has(key) || failed.has(key)) return;
  try {
    const im = await loadImage(d.src);
    const w = d.w || im.naturalWidth, h = d.h || im.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(im, d.x || 0, d.y || 0, w, h, 0, 0, w, h);
    canvases.set(key, c);
  } catch (e) {
    failed.add(key);
    console.warn("[assets]", e.message);
  }
}

/** The canvas for `key`, or null (not listed, not loaded yet, or broken) — then draw in code. */
export function canvas(key) {
  return canvases.get(key) || null;
}

/** Is `key` listed in the manifest (images or audio)? */
export function has(key) {
  return !!(manifest.images[key] || manifest.audio[key]);
}

/** Decode every listed sound with `ctx` (call once the AudioContext exists). */
export async function loadSounds(ctx) {
  await Promise.all(Object.entries(manifest.audio).map(async ([k, d]) => {
    if (buffers.has(k) || failed.has(k)) return;
    try { buffers.set(k, await loadAudio(ctx, d.src)); } catch (e) { failed.add(k); console.warn("[assets]", e.message); }
  }));
}

/** The decoded sound for `key` and its volume, or null. */
export function sound(key) {
  const b = buffers.get(key);
  return b ? { buffer: b, vol: manifest.audio[key].vol ?? 1 } : null;
}

/** Play a decoded sound through `ctx` (to `dest`, default the speakers). Returns false if absent. */
export function play(ctx, key, dest = ctx.destination) {
  const s = sound(key);
  if (!s) return false;
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = s.buffer;
  gain.gain.value = s.vol;
  src.connect(gain).connect(dest);
  src.start();
  return true;
}
