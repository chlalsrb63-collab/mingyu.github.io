import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate as nextTurn } from "node:timers/promises";
import { Sound, DEFAULT_MUSIC_STYLE } from "../public/audio.js";

const { bgmLocal } = JSON.parse(readFileSync(new URL("../public/assets/manifest.json", import.meta.url), "utf8"));
const paths = new Set(Object.values(bgmLocal).filter(Array.isArray).flat().map(([file]) => `/__local-bgm/${file}`));

const played = [];
const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, cancelAndHoldAtTime() {} };
Sound.ctx = {
  currentTime: 10,
  createGain: () => ({ gain: { ...param }, connect() {}, disconnect() {} }),
  createBufferSource: () => ({ connect() {}, start(...args) { played.push(args); } }),
  decodeAudioData: async () => ({ duration: 200 }),
};
Sound.vol.style = DEFAULT_MUSIC_STYLE;
Sound.recordings = {};
Sound.localScores = bgmLocal;
globalThis.location = { hostname: "127.0.0.1" };
globalThis.fetch = async ({ pathname }) => paths.has(pathname.replace(/^\/[a-z]:/i, ""))
  ? new Response(new Uint8Array(8)) : new Response(null, { status: 204 });

const live = () => Sound.playing.find(p => !p.dying);
async function check(src, key) {
  for (let i = 0; i < 12 && live()?.key !== key; i++) await nextTurn();
  const current = live();
  assert.equal(current.key, key);
  assert.equal(current.src, `/__local-bgm/${src}`);
  assert.equal(current.source.loop, true);
  return current;
}

// Both variants can be selected, and a pending or active theme doesn't reroll itself.
const realRandom = Math.random;
try {
  Math.random = () => 0.1;
  Sound.pick();
  const title = await check("0.TITLE1.mp3", "title");
  assert.equal(title.source.loopStart, 2.76);
  const count = played.length;
  Math.random = () => 0.9;
  Sound.pick();
  assert.equal(played.length, count);
  Sound.bgm("town", "town");
  await check("1.town1.mp3", "town");
  Sound.base = null; Sound.pick();
  await check("0.title2.mp3", "title");

  for (const [theme, file] of [["crypt", "4.crypt.mp3"], ["sewer", "6.sewer.mp3"], ["cave", "7.cave.mp3"], ["abyss", "9.abyss.mp3"]]) {
    Sound.bgm("dim:31", "dim", theme);
    await check(file, `dim_${theme}`);
    assert.equal(Sound.base, "dim", "the ordinary synth fallback is preserved");
  }
  Sound.setTheme("boss");
  await check("16.boss2.mp3", "boss");
  Sound.setTheme(null);
  await check("9.abyss.mp3", "dim_abyss");
  Math.random = () => 0.1;
  Sound.setTheme("boss");
  await check("16.boss1.mp3", "boss");

  Sound.setTheme(null);
  await check("9.abyss.mp3", "dim_abyss");
  paths.delete("/__local-bgm/16.boss1.mp3");
  Sound.setTheme("boss");
  await check("16.boss2.mp3", "boss");
  Sound.setTheme(null);
  Sound.bgm("starlight_inn", "inn", "interior");
  await check("inside/starlight_inn.mp3", "starlight_inn");
  Sound.bgm("house:22", "inn", "interior");
  await check("inside/inn.mp3", "inn");
  Sound.setMusicStyle("classic");
  assert.equal(live().name, "inn");
  assert.equal(live().style, "classic");
} finally { Math.random = realRandom; }

const originalFetch = globalThis.fetch, decode = Sound.ctx.decodeAudioData;
let deliver, cancelledDecodes = 0;
try {
  globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: () => new Promise(resolve => { deliver = resolve; }) });
  Sound.ctx.decodeAudioData = async () => { cancelledDecodes++; return { duration: 120 }; };
  const pending = Sound.queueRecording("town", [], bgmLocal.town, []);
  await nextTurn();
  assert.equal(typeof deliver, "function");
  await Sound.queueRecording(null, [], [], []);
  deliver(new ArrayBuffer(8));
  await pending;
  assert.equal(cancelledDecodes, 0, "a recording that arrives after a map switch is skipped before decoding");
} finally {
  globalThis.fetch = originalFetch;
  Sound.ctx.decodeAudioData = decode;
}

console.log("recorded BGM: rift terrains, indoors, stable variants, missing clips, and cancelled downloads");
