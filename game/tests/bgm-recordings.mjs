import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate as nextTurn } from "node:timers/promises";
import { Sound } from "../public/audio.js";
import { LOCAL_BGM_PATH } from "../public/local-host.js";

const { bgmLocal } = JSON.parse(readFileSync(new URL("../public/assets/manifest.json", import.meta.url), "utf8"));
const localPath = file => `/__local-bgm/${encodeURI(file)}`;
const paths = new Set(Object.values(bgmLocal).filter(Array.isArray).flat().map(([file]) => localPath(file)));
assert.ok([...paths].every(path => LOCAL_BGM_PATH.test(path)), "all catalogued local recordings have a valid route");

const played = [];
const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, cancelAndHoldAtTime() {} };
Sound.ctx = {
  currentTime: 10,
  createGain: () => ({ gain: { ...param }, connect() {}, disconnect() {} }),
  createBufferSource: () => ({ connect() {}, start(...args) { played.push(args); } }),
  decodeAudioData: async () => ({ duration: 200 }),
};
Sound.vol.style = "classic"; // An old setting must not bring back synthesized music.
Sound.recordings = {};
Sound.localScores = bgmLocal;
globalThis.location = { hostname: "192.168.31.58" };
globalThis.fetch = async ({ pathname }) => paths.has(pathname.replace(/^\/[a-z]:/i, ""))
  ? new Response(new Uint8Array(8)) : new Response(null, { status: 204 });

const live = () => Sound.playing.find(p => !p.dying);
async function check(src, key) {
  for (let i = 0; i < 12 && live()?.key !== key; i++) await nextTurn();
  const current = live();
  assert.equal(current.key, key);
  assert.equal(current.src, localPath(src));
  assert.equal(current.source.loop, true);
  return current;
}

// Both variants can be selected, and a pending or active theme doesn't reroll itself.
const realRandom = Math.random;
try {
  Math.random = () => 0.1;
  Sound.pick();
  assert.equal(Sound.playing.length, 0, "no synthesized music while the recording loads");
  const title = await check("0.TITLE1.mp3", "title");
  assert.equal(title.source.loopStart, 2.76);
  const count = played.length;
  Math.random = () => 0.9;
  Sound.pick();
  assert.equal(played.length, count);
  Sound.bgm("town", "town");
  await check("1.town1.mp3", "town");
  const townCount = played.length;
  Sound.setNight(true);
  await nextTurn();
  assert.equal(played.length, townCount, "dusk keeps the same recording when no night recording exists");
  Sound.setNight(false);
  Sound.base = null; Sound.pick();
  await check("0.title2.mp3", "title");

  for (const [theme, file] of [["crypt", "4.crypt.mp3"], ["sewer", "6.sewer.mp3"], ["cave", "7.cave.mp3"], ["abyss", "9.abyss.mp3"]]) {
    Sound.bgm("dim:31", "dim", theme);
    await check(file, `dim_${theme}`);
  }
  Sound.setTheme("rift");
  await check("9.abyss.mp3", "rift");
  Sound.setTheme(null);
  await check("9.abyss.mp3", "dim_abyss");
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
  for (const [lobby, fallback, lobbyFile, shift, track, loopEnd] of [
    ["dongdong_apt", "clean", "dongdong_apt", "coop_apt", "apt", 104.98],
    ["juju_diner", "juju", "juju_diner", "coop_diner", "restaurant", 177.55],
    ["kangkang_forge", "forge", "kangkang_forge", "coop_forge", "Blacksmith", 121.83],
    ["owl_library", "cafe", "owl_library", "coop_lib", "library", 120.08],
  ]) {
    Sound.bgm(lobby, fallback, "interior");
    await check(`inside/${lobbyFile}.mp3`, lobby);
    Sound.bgm("dim:32", shift, "interior");
    const current = await check(`arbeit/${track}.mp3`, shift);
    assert.equal(current.source.loopEnd, loopEnd);
    Sound.bgm(lobby, fallback, "interior");
    await check(`inside/${lobbyFile}.mp3`, lobby);
  }
  Sound.bgm("airship", "oasis", "mist");
  const airship = await check("17. aircraft.mp3", "airship");
  assert.equal(airship.source.loopEnd, 200, "the airship plays the full decoded recording");
  Sound.bgm("sunset_beach", "coast", "coast");
  await check("18.dawn sea.mp3", "sunset_beach");
  Sound.bgm("blossom_trail", "willow", "meadow");
  await check("19. flower.mp3", "blossom_trail");
  Sound.bgm("sanctum", "cave", "sanctum");
  await check("20. sanctum.mp3", "sanctum");
  Sound.bgm("jianmen", "autumn", "jianmen");
  await check("21. jianmen.mp3", "jianmen");
  Sound.localScores = {};
  Sound.bgm("without_recordings", "without_recordings");
  for (let i = 0; i < 12 && live(); i++) await nextTurn();
  assert.equal(live(), undefined, "missing recordings fade out to silence");
  assert.ok(Sound.playing.every(track => track.source), "all scheduled music is recorded");
} finally { Math.random = realRandom; }

const originalFetch = globalThis.fetch, decode = Sound.ctx.decodeAudioData;
let deliver, cancelledDecodes = 0;
try {
  globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: () => new Promise(resolve => { deliver = resolve; }) });
  Sound.ctx.decodeAudioData = async () => { cancelledDecodes++; return { duration: 120 }; };
  Sound.localScores = bgmLocal;
  const pending = Sound.queueRecording(["town"], true);
  await nextTurn();
  assert.equal(typeof deliver, "function");
  await Sound.queueRecording([], true);
  deliver(new ArrayBuffer(8));
  await pending;
  assert.equal(cancelledDecodes, 0, "a recording that arrives after a map switch is skipped before decoding");
} finally {
  globalThis.fetch = originalFetch;
  Sound.ctx.decodeAudioData = decode;
}

console.log("recorded BGM: LAN, rift terrains, indoor and co-op loops, airship, variants, missing clips, and cancellation without synthesis");
