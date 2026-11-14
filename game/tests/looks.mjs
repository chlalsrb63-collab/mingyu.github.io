// Headless checks for the players' looks (public/species.js, the look list in logic.js):
// the server's limits match the parts, old sheets keep their look, every option draws
// in every view and frame inside the sheet, the mirror in town, and what goes on the wire.
// node tests/looks.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as L from "../src/logic.js";
import * as SPC from "../public/species.js";

const D = L.defs();

// ── the server's limits are exactly the parts the browser offers
assert.deepEqual(D.lookMax, SPC.LOOK_N.map((n) => n - 1), "logic.js LOOK_MAX matches species.js PARTS");
assert.equal(SPC.PARTS.length, 11);
assert.deepEqual(SPC.PARTS.slice(0, 7).map((p) => p.key), ["ear", "eye", "nose", "fur", "blush", "pat", "cloth"], "the first seven keep their places");
// the original choices keep their meaning (and their order) at the front of each list
assert.deepEqual(SPC.PARTS[0].names.slice(0, 6), ["고양이", "토끼", "곰", "여우", "강아지", "쥐"]);
assert.deepEqual(SPC.PARTS[1].names.slice(0, 6), ["점 눈", "긴 눈", "큰 눈", "웃는 눈", "졸린 눈", "파란 눈"]);
assert.deepEqual(SPC.PARTS[2].names.slice(0, 5), ["작은 코", "분홍 코", "ㅅ 입", "큰 코", "없음"]);
assert.deepEqual(SPC.PARTS[3].colors.slice(0, 10), ["#fbfbff", "#fff0d8", "#ffd9c2", "#ffd0dc", "#e2d6ff", "#cfe6ff", "#cff2dc", "#ffeaa0", "#b9bdca", "#b98b68"]);
assert.deepEqual(SPC.PARTS[4].names.slice(0, 4), ["분홍", "빨강", "주황", "없음"]);
assert.deepEqual(SPC.PARTS[5].names.slice(0, 4), ["없음", "눈 얼룩", "줄무늬", "포인트"]);
assert.deepEqual(SPC.PARTS[6].colors.slice(0, 6), [null, "#5a8ae0", "#e0605a", "#5ab87a", "#9a78e0", "#f0c050"]);
for (const p of SPC.PARTS) assert.equal(new Set(p.names || p.colors).size, (p.names || p.colors).length, p.key + ": no duplicate choices");
assert.ok(SPC.SPECIES.length >= 12, "a dozen animals or more");
assert.ok(SPC.LOOK_N[1] >= 14 && SPC.LOOK_N[2] >= 12 && SPC.LOOK_N[0] >= 12 && SPC.LOOK_N[3] >= 20, "many eyes, mouths, ears and colours");

// ── a new character: anything sent is clamped into a full, valid look
{
  const c = L.newChar("새얼굴", "rogue", [99, -3, "x", 2.7, null, 4, 11, 13, 5, 2, 7, 9, 9]);
  assert.equal(c.look.length, 11);
  c.look.forEach((v, i) => assert.ok(Number.isInteger(v) && v >= 0 && v <= D.lookMax[i], "part " + i));
  assert.deepEqual(c.look.slice(0, 2), [D.lookMax[0], 0]);
  assert.deepEqual(L.newChar("빈얼굴", "mage", undefined).look, Array(11).fill(0));
}

// ── an old sheet (seven parts) keeps its look: padded with "as before", nothing else changed
{
  const S = L.setup();
  S.now = 1000;
  const old = L.newChar("옛얼굴", "warrior", []);
  old.look = [3, 5, 2, 9, 1, 3, 4];
  L.addPlayer(S, "pid-old", old);
  assert.deepEqual(S.players["pid-old"].ch.look, [3, 5, 2, 9, 1, 3, 4, 0, 0, 0, 0]);
  const o = SPC.lookOf([3, 5, 2, 9, 1, 3, 4]);
  assert.deepEqual(o, { sp: 0, ear: 3, eye: 5, nose: 2, fur: "#b98b68", blush: "#f07882", frk: 0, pat: 3, cloth: "#9a78e0", tail: 0, acc: null, eyeC: null });
  // nonsense in a saved look is cleaned rather than trusted
  const odd = L.newChar("이상한", "lancer", []);
  odd.look = { a: 1 };
  L.addPlayer(S, "pid-odd", odd);
  assert.deepEqual(S.players["pid-odd"].ch.look, Array(11).fill(0));
  const big = L.newChar("큰값", "lancer", []);
  big.look = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
  L.addPlayer(S, "pid-big", big);
  assert.deepEqual(S.players["pid-big"].ch.look, D.lookMax);
  // and it survives being saved and loaded again
  const saved = JSON.parse(JSON.stringify(L.exportChar(S, "pid-old")));
  L.removePlayer(S, "pid-old");
  L.addPlayer(S, "pid-old", saved);
  assert.deepEqual(S.players["pid-old"].ch.look, [3, 5, 2, 9, 1, 3, 4, 0, 0, 0, 0]);
}

// ── drawing: a recording stand-in for sprites.js's pixel tools
const FRAME = { stand: 0, breathe: 1, stepA: 2, stretch: 3, stepB: 4, blink: 5 };
function draw(look, view, f) {
  const rects = [];
  const T = {
    sheet: () => [{}, {}], brush: () => ({ r: (x, y, w, h, c) => rects.push([x, y, w, h, c]) }), finish: () => rects,
    shade: (c, t = 0.16) => c + "~" + t, blend: (a, b, t) => a + "+" + b + t, lt: (c) => c + "^", FRAME,
  };
  SPC.animal(SPC.lookOf(look), view, f, T);
  return rects;
}
const views = ["front", "side", "back"];
let n = 0;
const inside = (rects, what) => {
  for (const [x, y, w, h, c] of rects) {
    assert.ok(typeof c === "string" && c, what + ": every pixel has a colour");
    // the figure stays inside its box on the sheet: the outline needs a pixel around it, the feet stand on row 27
    assert.ok(x >= 5 && y >= 10 && x + w <= 27 && y + h <= 28 && w > 0 && h > 0, `${what}: ${[x, y, w, h]} inside the figure's box`);
  }
};
// every species with every ear, tail and marking, every view and frame
for (let sp = 0; sp < SPC.LOOK_N[7]; sp++) {
  for (const key of ["ear", "tail", "pat", "eye", "nose", "blush"]) {
    const i = SPC.LI[key];
    for (let v = 0; v < SPC.LOOK_N[i]; v++) {
      const look = SPC.withSpecies([], sp);
      look[i] = v;
      look[SPC.LI.acc] = (sp + v) % SPC.LOOK_N[SPC.LI.acc];
      for (const view of views) for (let f = 0; f < 6; f++) { inside(draw(look, view, f), `${SPC.SPECIES[sp].name} ${key} ${v} ${view} ${f}`); n++; }
    }
  }
}
assert.ok(n > 5000);
// the same look always draws the same, and different animals draw differently
assert.deepEqual(draw([1, 2, 3, 4, 0, 2, 1, 5, 4, 3, 2], "side", 2), draw([1, 2, 3, 4, 0, 2, 1, 5, 4, 3, 2], "side", 2));
const heads = new Set(SPC.SPECIES.map((_, sp) => JSON.stringify(draw(SPC.withSpecies([], sp), "front", 0))));
assert.equal(heads.size, SPC.SPECIES.length, "every animal has a face of its own");
// a guard on the original look: the pixels species 0 draws for the old choices (checked pixel-for-pixel
// against the old drawing in the browser, _species.html?m=cmp) must not drift
{
  const h = createHash("sha1");
  for (let ear = 0; ear < 6; ear++) for (let eye = 0; eye < 6; eye++) for (let nose = 0; nose < 5; nose++)
    for (const view of views) for (const f of [0, 1, 2, 5]) h.update(JSON.stringify(draw([ear, eye, nose, (ear + eye) % 10, nose % 4, (eye + nose) % 4, ear], view, f)));
  assert.equal(h.digest("hex"), "c6ce20b1137ce864db387620b35e2c04b30fccf8", "the original looks are drawn as before");
}

// ── presets, species defaults and the hat anchor
for (const [name, look] of SPC.PRESETS) {
  assert.equal(look.length, 11, name);
  look.forEach((v, i) => assert.ok(v >= 0 && v < SPC.LOOK_N[i], `${name} part ${i}`));
}
assert.equal(new Set(SPC.PRESETS.map((p) => p[1].join())).size, SPC.PRESETS.length, "presets differ");
for (let sp = 0; sp < SPC.SPECIES.length; sp++) {
  const lk = SPC.withSpecies([0, 3, 0, 5, 0, 0, 2], sp);
  assert.equal(lk[7], sp);
  assert.equal(lk[1], 3, "picking an animal keeps the eyes");
  assert.equal(lk[3], 5, "and the colour");
  for (let ear = 0; ear < SPC.LOOK_N[0]; ear++) {
    lk[0] = ear;
    const a = SPC.headAnchor(lk);
    assert.ok(a.top >= 15 && a.top <= 19 && a.earTop >= 10 && a.earTop <= a.top && a.half >= 5 && a.half <= 7 && a.cx === 16, `${sp} ${ear} anchor`);
  }
}
// switching away from the panda takes its markings with it
assert.equal(SPC.withSpecies(SPC.withSpecies([], 13), 1)[SPC.LI.pat], 0);

// ── the mirror: in town, for gold, a valid look only; everyone sees the new look
{
  const S = L.setup();
  let now = 5000;
  S.now = now;
  const ch = L.newChar("거울", "warrior", [0, 0, 0, 0, 0, 0, 0]);
  L.addPlayer(S, "pid-m", ch);
  const p = S.players["pid-m"];
  const act = (a) => { S.now = now; const v = L.validateAction(S, "pid-m", a); if (v.ok) L.applyAction(S, "pid-m", a); return v; };
  const want = [2, 12, 7, 0, 3, 12, 3, 13, 2, 9, 0];
  assert.equal(p.map, "town");
  assert.match(act({ t: "look", look: want }).error, /골드/, "costs gold");
  ch.gold = 2000;
  assert.equal(act({ t: "look", look: [...want, 1] }).ok, false, "too long");
  assert.equal(act({ t: "look", look: [99] }).ok, false, "out of range");
  assert.equal(act({ t: "look", look: [1.5] }).ok, false, "not whole");
  assert.equal(act({ t: "look", look: "x" }).ok, false, "not a list");
  L.tick(S, now); L.viewFor(S, "pid-m"); L.endTick(S);
  assert.ok(act({ t: "look", look: want }).ok);
  assert.deepEqual(ch.look, want);
  assert.equal(ch.gold, 2000 - D.lookCost);
  now += 100; L.tick(S, now);
  const v = L.viewFor(S, "pid-m"); L.endTick(S);
  assert.ok(v.who && v.who.some((r) => r[0] === p.eid && JSON.stringify(r[4]) === JSON.stringify(want)), "the room is told");
  // a short look is fine (the rest is "as before")
  assert.ok(act({ t: "look", look: [1, 2] }).ok);
  assert.deepEqual(ch.look, [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // only in town
  const field = Object.keys(D.maps.reduce((o, m) => (o[m.id] = 1, o), {})).find((id) => id !== "town" && id !== "home");
  L.runtime(S, "town").n--; p.map = "meadow"; L.runtime(S, "meadow").n++;
  assert.match(act({ t: "look", look: want }).error, /마을/);
  void field;
}

// ── on the wire: a look is a short list of small numbers
{
  const worst = JSON.stringify(D.lookMax);
  assert.ok(worst.length <= 34, "a look costs at most " + worst.length + " bytes in a who row");
}

console.log("looks: ok", n, "frames drawn");
