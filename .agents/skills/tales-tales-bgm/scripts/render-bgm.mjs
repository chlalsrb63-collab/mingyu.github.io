import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { args, launch, serve, PUBLIC } from "../../../../game/scripts/artkit.mjs";
import { atlas } from "../../../../game/src/logic.js";
import { BGM_KEYS, checkTracks, DEFAULT_MUSIC_STYLE, MUSIC_STYLES, TRACK_NAMES } from "../../../../game/public/audio.js";

const options = args();
const style = options.style || DEFAULT_MUSIC_STYLE;
assert.ok(MUSIC_STYLES.includes(style), "Unknown arrangement: " + style);
const tracks = options._.length ? options._ : TRACK_NAMES;
assert.deepEqual(checkTracks(style), [], "all tracks need valid notes and bar lengths");
for (const { id, bgm } of Object.values(atlas().maps)) {
  assert.ok(TRACK_NAMES.includes(id) || BGM_KEYS.includes(bgm), "Missing map track: " + id);
}
for (const track of tracks) assert.ok(TRACK_NAMES.includes(track), "Unknown track: " + track);
const out = options.out ? resolve(String(options.out)) : null;
if (out) await mkdir(out, { recursive: true });

const server = await serve(PUBLIC, 0, {
  "/__bgm.html": '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>BGM</title>',
});
let browser;
try {
  browser = await launch(options.channel);
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:" + server.address().port + "/__bgm.html");
  for (const track of tracks) {
    const result = await page.evaluate(async ({ track, style, save }) => {
      const [{ Sound }, { arrangedTrack }] = await Promise.all([import("/audio.js"), import("/bgm-arrangements.js")]);
      const def = arrangedTrack(track, style);
      const s16 = 60 / def.bpm / 4;
      const steps = def.form.split(/\s+/).reduce((total, section) => total + def.sections[section][0].split(/\s+/).length * 16, 0);
      const seconds = steps * s16;
      const sampleRate = 44100;
      // The first cycle primes the synth and echo. The second cycle is the preview.
      const context = new OfflineAudioContext(2, Math.ceil((0.12 + 2 * seconds + 0.05) * sampleRate), sampleRate);
      const sound = { ...Sound, playing: [], waves: {}, vol: { ...Sound.vol, style } };
      sound.init(context);
      sound.bgm(track);
      const playing = sound.playing[0];
      for (let step = 0; step < steps * 2; step++) {
        playing.step = step;
        sound.tick(playing, playing.next + step * s16, s16);
      }
      const audio = await context.startRendering();
      const left = audio.getChannelData(0), right = audio.getChannelData(1);
      const start = Math.round((playing.next + seconds) * sampleRate);
      const frames = Math.round(seconds * sampleRate);
      let peak = 0, squared = 0, loudBars = 0, barSquared = 0;
      const barFrames = Math.round(16 * s16 * sampleRate);
      for (let i = start; i < start + frames; i++) {
        const power = (left[i] ** 2 + right[i] ** 2) / 2;
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        squared += power;
        barSquared += power;
        if ((i - start + 1) % barFrames === 0) {
          if (Math.sqrt(barSquared / barFrames) > 0.005) loudBars++;
          barSquared = 0;
        }
      }
      const seam = Math.max(Math.abs(left[start] - left[start + frames - 1]), Math.abs(right[start] - right[start + frames - 1]));
      let encoded = null;
      if (save) {
        const bytes = new Uint8Array(44 + frames * 4);
        const header = new DataView(bytes.buffer);
        const chars = (offset, text) => bytes.set(Array.from(text, c => c.charCodeAt(0)), offset);
        chars(0, "RIFF"); header.setUint32(4, bytes.length - 8, true); chars(8, "WAVE");
        chars(12, "fmt "); header.setUint32(16, 16, true); header.setUint16(20, 1, true);
        header.setUint16(22, 2, true); header.setUint32(24, sampleRate, true);
        header.setUint32(28, 4 * sampleRate, true); header.setUint16(32, 4, true); header.setUint16(34, 16, true);
        chars(36, "data"); header.setUint32(40, frames * 4, true);
        for (let i = 0; i < frames; i++) {
          header.setInt16(44 + i * 4, Math.round(Math.min(1, Math.max(-1, left[start + i])) * 32767), true);
          header.setInt16(46 + i * 4, Math.round(Math.min(1, Math.max(-1, right[start + i])) * 32767), true);
        }
        let binary = "";
        for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
        encoded = btoa(binary);
      }
      return { seconds, peak, rms: Math.sqrt(squared / frames), loudBars, seam, encoded };
    }, { track, style, save: !!out });
    const { seconds, peak, rms, loudBars, seam, encoded } = result;
    assert.ok(seconds >= 24 && seam < 0.035 && Number.isFinite(peak) && peak < 0.98 && rms > 0.005 && loudBars > 8, track + " must render an audible, unclipped loop");
    console.log(style + " " + track + " " + seconds.toFixed(2) + " s · peak " + peak.toFixed(3) + " · RMS " + rms.toFixed(3) + " · seam " + seam.toFixed(3));
    if (out) await writeFile(join(out, track + ".wav"), Buffer.from(encoded, "base64"));
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
