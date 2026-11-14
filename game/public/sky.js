/**
 * The sky outdoors: the hour of the day (the server's clock, kept in step by the
 * snapshot's `dn`), the colour grade it puts on the world, the light pools of lamps
 * and fires that show against the night, and the weather: rain, fog, cloud shadows,
 * wind, snow, and fireflies after dark.
 *
 * The grade is one multiply over the whole view — the same everywhere on screen,
 * never darker at the edges — and the lights are cut into it as stepped, flattened
 * pools so they read as pixel art on the quarter-view ground.
 *
 * Preview overrides: globalThis.__skyHour (0–24) and __skyWx (0–5).
 */

// ───────────────────────────── the clock ─────────────────────────────

/** Defaults until `welcome.defs.sky` arrives (the same numbers as the server). */
let DAY_MS = 48 * 60000;
let PHASES = [["새벽", 4.5], ["아침", 7], ["낮", 11], ["노을", 17], ["밤", 19.5]];
let WEATHER = ["맑음", "흐림", "비", "안개", "바람", "눈"];
let offset = 0, wxNow = 0;
export const WX = { clear: 0, cloud: 1, rain: 2, fog: 3, wind: 4, snow: 5 };

export function configure(sky) {
  if (!sky) return;
  DAY_MS = sky.dayMs || DAY_MS; PHASES = sky.phases || PHASES; WEATHER = sky.weather || WEATHER;
}
/** The server clock in seconds, from a snapshot's `dn`; and the weather on this map (-1 indoors). */
export function setSky(dn, arrived = false) {
  if (!dn) return;
  wxNow = dn[0];
  // arriving on a map, its weather is simply there; a change while you stand in it eases in
  if (arrived) snapNext = true;
  offset = dn[1] * 1000 - Date.now();
}
export const serverNow = () => Date.now() + offset;
export function hour(now = serverNow()) {
  if (typeof globalThis.__skyHour === "number") return globalThis.__skyHour;
  return ((((now % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS) * 24;
}
export function phase(h = hour()) {
  for (let i = PHASES.length - 1; i >= 0; i--) if (h >= PHASES[i][1]) return i;
  return PHASES.length - 1;
}
export function weather() { return typeof globalThis.__skyWx === "number" ? globalThis.__skyWx : wxNow; }
export const weatherName = (w = weather()) => WEATHER[w] || "";
export const phaseName = (h = hour()) => PHASES[phase(h)][0];
/** "노을 18:40": the phase and the hour, to ten minutes. */
export function clockText(h = hour()) {
  const m = Math.floor((h * 60) / 10) * 10;
  return `${phaseName(h)} ${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
const ramp = (a, b, v) => Math.max(0, Math.min(1, (v - a) / (b - a)));
/** How far into night, 0–1: full from 20:00 to 04:30, easing in through dusk and out through dawn. */
export function nightK(h = hour()) { return h < 12 ? 1 - ramp(4.5, 6.2, h) : ramp(18.4, 20, h); }

// ───────────────────────────── the grade ─────────────────────────────

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
/** The light of each hour: what the world is multiplied by, and a thin haze screened over it. */
const KEYS = [
  [0, "#404a88", "#000000", 0],
  [4.4, "#404a88", "#000000", 0],
  [5.3, "#9a84c0", "#ff8ab8", 0.06],      // dawn: violet turning pink
  [6.4, "#ecc4d2", "#ffb098", 0.07],
  [7.6, "#fff2e6", "#ffe0b8", 0.03],
  [11, "#ffffff", "#ffffff", 0],          // day: neutral
  [16, "#fff4e0", "#ffe0a0", 0.02],
  [17.3, "#ffd09a", "#ff9a40", 0.08],     // sunset: golden, long and warm
  [18.4, "#f0a08a", "#ff6a3a", 0.09],
  [19.3, "#9a80b4", "#b060c0", 0.04],     // dusk: rose into violet
  [20.2, "#404a88", "#000000", 0],        // night: cool blue
  [24, "#404a88", "#000000", 0],
].map(([h, m, a, k]) => [h, rgb(m), rgb(a), k]);
/** What each weather does to the light: a colour mixed into the grade, and how much. */
const WX_TINT = [null, ["#a8aebc", 0.22], ["#7e8698", 0.34], ["#c4cad8", 0.3], null, ["#d6e0f0", 0.12]];

/** The light right now: { mul, haze, hazeA, night }, eased between weathers by `wk` (per-weather weights). */
export function light(h, wk) {
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
  const [h0, m0, a0, k0] = KEYS[i], [h1, m1, a1, k1] = KEYS[i + 1], u = (h - h0) / (h1 - h0 || 1);
  let mul = lerp3(m0, m1, u);
  const haze = lerp3(a0, a1, u), hazeA = k0 + (k1 - k0) * u;
  for (let w = 0; w < WX_TINT.length; w++) if (WX_TINT[w] && wk[w] > 0.001) mul = lerp3(mul, lerp3(mul, rgb(WX_TINT[w][0]), 1), WX_TINT[w][1] * wk[w]);
  return { mul, haze, hazeA: hazeA * (1 - 0.6 * (wk[2] || 0) - 0.4 * (wk[1] || 0)), night: nightK(h) };
}

// ── light pools: stepped, flattened ellipses (no smooth gradient mush), cached by colour and size
const pools = new Map();
function pool(col, r, flat) {
  const key = col + r + flat;
  let c = pools.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  const h = Math.ceil(r / flat);
  c.width = r * 2; c.height = h * 2;
  const x = c.getContext("2d"), [R, G, B] = rgb(col);
  // four bands, brightest in the middle; each a hard-edged ring of whole pixels
  const bands = [[1, 0.2], [0.74, 0.42], [0.5, 0.68], [0.28, 1]];
  for (const [rr, a] of bands) {
    const rx = r * rr, ry = (r * rr) / flat;
    x.fillStyle = `rgba(${R},${G},${B},${a})`;
    for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
      x.clearRect(r - w, h + y, w * 2, 1);
      x.fillRect(r - w, h + y, w * 2, 1);
    }
  }
  pools.set(key, c);
  return c;
}
/** A soft halo for the bloom over a flame or a lamp (drawn additively, small). */
const halos = new Map();
export function halo(col, r) {
  const key = col + r;
  let c = halos.get(key);
  if (c) return c;
  c = document.createElement("canvas"); c.width = c.height = r * 2;
  const x = c.getContext("2d"), gr = x.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
  halos.set(key, c);
  return c;
}

let lm = null, lx = null;
/** Ease the weather in and out over a few seconds. */
const wk = [1, 0, 0, 0, 0, 0];
let snapNext = true;
function easeWeather(dt, outdoor) {
  const w = outdoor ? weather() : -1, u = snapNext || typeof globalThis.__skyWx === "number" ? 1 : Math.max(0, Math.min(1, dt * 0.6));
  for (let i = 0; i < wk.length; i++) wk[i] = Math.max(0, Math.min(1, wk[i] + ((i === w ? 1 : 0) - wk[i]) * u));
  snapNext = false;
}
export const weatherK = (i) => wk[i];

/**
 * Grade the view: multiply it by the hour's light with every light source cut in as a
 * pool, then screen a thin haze (dawn, sunset) and bloom the brightest sources.
 * `lights`: [{ x, y, r, col, k, flat }] in screen pixels. Returns the light used.
 */
export function grade(g, vw, vh, dt, t, lights, clouds) {
  const h = hour(), L = light(h, wk), n = L.night;
  if (!lm) { lm = document.createElement("canvas"); lx = lm.getContext("2d"); }
  if (lm.width !== vw || lm.height !== vh) { lm.width = vw; lm.height = vh; }
  lx.globalCompositeOperation = "source-over"; lx.globalAlpha = 1;
  lx.fillStyle = css(L.mul); lx.fillRect(0, 0, vw, vh);
  // cloud shadows drift across the ground as darker patches of light
  if (clouds) clouds(lx, L);
  if (n > 0.02 || wk[2] > 0.3) {
    lx.globalCompositeOperation = "lighter";
    const lit = Math.max(n, wk[2] * 0.35);
    for (const s of lights) {
      if (s.x < -s.r || s.y < -s.r || s.x > vw + s.r || s.y > vh + s.r) continue;
      const sp = pool(s.col, s.r, s.flat || 2);
      lx.globalAlpha = Math.min(1, lit * (s.k ?? 1));
      lx.drawImage(sp, Math.round(s.x - sp.width / 2), Math.round(s.y - sp.height / 2));
    }
    lx.globalAlpha = 1;
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // night drains a little colour before the light is laid on; the pools bring it back warm
  if (n > 0.02) { g.globalCompositeOperation = "saturation"; g.globalAlpha = 0.32 * n; g.fillStyle = "#808080"; g.fillRect(0, 0, vw, vh); g.globalAlpha = 1; }
  g.globalCompositeOperation = "multiply";
  g.drawImage(lm, 0, 0);
  if (L.hazeA > 0.004) { g.globalCompositeOperation = "screen"; g.globalAlpha = L.hazeA; g.fillStyle = css(L.haze); g.fillRect(0, 0, vw, vh); }
  // the bloom: a little light spilling past the brightest sources after dark
  if (n > 0.05) {
    g.globalCompositeOperation = "lighter";
    for (const s of lights) {
      if (!s.bloom || s.x < -60 || s.y < -60 || s.x > vw + 60 || s.y > vh + 60) continue;
      const r = s.bloom, f = 0.85 + 0.15 * Math.sin(t / 90 + s.x);
      g.globalAlpha = n * 0.32 * f * (s.k ?? 1);
      g.drawImage(halo(s.col, r), Math.round(s.x - r), Math.round(s.by ?? s.y) - r);
    }
  }
  g.restore();
  return L;
}

// ───────────────────────────── the weather ─────────────────────────────

const rain = [], splash = [], snow = [], leaves = [], streaks = [], flies = [];
const R = Math.random;
/** A hard-edged cloud shadow, made once: a few flattened blobs merged into one shape. */
let cloudSp = null;
function cloudShape() {
  if (cloudSp) return cloudSp;
  const W = 220, H = 90, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  for (const [cx, cy, rx] of [[70, 50, 60], [130, 40, 70], [170, 55, 45], [100, 62, 50]]) {
    const ry = rx / 2.1;
    for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) { const w = Math.floor(rx * Math.sqrt(1 - (y / ry) ** 2)); x.fillRect(cx - w, cy + y, w * 2, 1); }
  }
  cloudSp = c;
  return c;
}
/** Cloud shadows for the grade: big dark shapes sliding slowly across the world. */
export function cloudPainter(ox, oy, t) {
  const k = Math.max(wk[1], wk[2] * 0.7, wk[4] * 0.6);
  if (k < 0.02) return null;
  return (x, L) => {
    const sp = cloudShape(), span = 900;
    x.globalAlpha = 0.16 * k;
    for (let i = 0; i < 6; i++) {
      const wx = ((i * 337 + t * 0.012 * (1 + wk[4] * 2)) % span) - (ox % span), wy = (i * 211) % 600 - (oy % 600);
      for (const [dx, dy] of [[0, 0], [span, 0], [0, 600], [span, 600], [-span, 0], [0, -600]]) {
        const X = Math.round(wx + dx - 110), Y = Math.round(wy + dy - 45);
        if (X > -230 && X < x.canvas.width + 10 && Y > -100 && Y < x.canvas.height + 10) x.drawImage(sp, X, Y);
      }
    }
    x.globalAlpha = 1;
    void L;
  };
}

/**
 * Rain, fog, wind and snow over the whole view, and fireflies after dark. `camps` are the
 * screen positions of fires (fireflies gather there at night).
 */
export function drawWeather(g, vw, vh, dt, t, ox, oy, outdoor, theme, camps, L) {
  easeWeather(dt, outdoor);
  if (!outdoor) { rain.length = snow.length = leaves.length = flies.length = 0; return; }
  const n = L ? L.night : nightK(), dim = L ? Math.max(0.35, (L.mul[0] + L.mul[1] + L.mul[2]) / 765) : 1;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // ── rain: short slanted streaks, and splashes where they land
  const wantRain = Math.round(260 * wk[2]);
  while (rain.length < wantRain) rain.push({ x: R() * (vw + 60), y: R() * vh - vh, v: 260 + R() * 80, len: 5 + Math.floor(R() * 4), end: vh * (0.2 + R() * 0.85) });
  if (rain.length > wantRain) rain.length = wantRain;
  g.fillStyle = n > 0.5 ? "#9ab0e4" : "#d8e6ff";
  g.globalAlpha = 0.6 * Math.min(1, wk[2] * 1.3);
  for (const d of rain) {
    d.y += d.v * dt; d.x -= d.v * 0.18 * dt;
    if (d.y > d.end) {
      if (splash.length < 60) splash.push({ x: Math.round(d.x), y: Math.round(d.y), t: 0 });
      d.x = R() * (vw + 60); d.y = -10 - R() * 40; d.end = vh * (0.15 + R() * 0.9);
    }
    const x = Math.round(d.x), y = Math.round(d.y), h2 = d.len >> 1;
    g.fillRect(x, y, 1, h2); g.fillRect(x - 1, y + h2, 1, d.len - h2);
  }
  g.globalAlpha = 0.75 * Math.min(1, wk[2] * 1.3);
  for (let i = splash.length - 1; i >= 0; i--) {
    const s = splash[i];
    s.t += dt;
    if (s.t > 0.24) { splash.splice(i, 1); continue; }
    if (s.t < 0.08) { g.fillRect(s.x, s.y - 1, 1, 1); g.fillRect(s.x - 2, s.y - 2, 1, 1); g.fillRect(s.x + 2, s.y - 2, 1, 1); }
    else { g.fillRect(s.x - 3, s.y, 2, 1); g.fillRect(s.x + 2, s.y, 2, 1); g.fillRect(s.x - 1, s.y - 1, 3, 1); }
  }
  // puddle glints: a white pixel catching the light here and there
  if (wk[2] > 0.5) {
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 14; i++) {
      const gx = ((i * 2971 - ox) % vw + vw) % vw, gy = ((i * 1733 - oy) % vh + vh) % vh;
      if (Math.sin(t / 240 + i * 1.7) > 0.8) { g.globalAlpha = 0.6 * wk[2]; g.fillRect(Math.round(gx), Math.round(gy), 2, 1); }
    }
  }
  // ── fog: low bands drifting across, thicker toward the bottom of the view
  g.globalAlpha = 1;
  if (wk[3] > 0.02) {
    const col = n > 0.5 ? "120,136,184" : "232,236,244";
    for (let b = 0; b < 6; b++) {
      const by = Math.round(vh * (0.22 + b * 0.15) + Math.sin(t / 3000 + b) * 8 - ((oy * 0.3) % 40));
      const bh = 22 + b * 6, drift = (t / (90 + b * 20) + b * 140 - ox * 0.6) % 64;
      for (const [f, a] of [[1, 0.15], [0.66, 0.15], [0.33, 0.16]]) {
        g.fillStyle = `rgba(${col},${a * wk[3] * (0.7 + b * 0.12)})`;
        const hh = Math.round(bh * f);
        // the top edge of each band rolls in 8-pixel steps
        for (let x = -64; x < vw + 64; x += 8) {
          const off = Math.round(Math.sin((x + drift) / 37 + b) * 3) * 2;
          g.fillRect(x + Math.round(drift), by + Math.round((bh - hh) / 2) + off, 8, hh);
        }
      }
    }
  }
  // ── wind: leaves tumbling across, and thin streaks of moving air
  const wantLeaf = Math.round(26 * wk[4] + (theme === "forest" || theme === "autumn" ? 6 * wk[4] : 0));
  while (leaves.length < wantLeaf) leaves.push({ x: -20 - R() * vw, y: R() * vh, v: 90 + R() * 60, ph: R() * 9, c: ["#d89a48", "#7abf52", "#c8643c", "#a8d468"][Math.floor(R() * 4)] });
  if (leaves.length > wantLeaf) leaves.length = wantLeaf;
  g.globalAlpha = Math.min(1, wk[4] * 1.2) * (0.5 + 0.5 * dim);
  for (const l of leaves) {
    l.x += l.v * dt; l.y += Math.sin(t / 260 + l.ph) * 30 * dt + 6 * dt;
    if (l.x > vw + 20) { l.x = -20; l.y = R() * vh; }
    const flip = Math.sin(t / 120 + l.ph) > 0, x = Math.round(l.x), y = Math.round(l.y);
    g.fillStyle = l.c; g.fillRect(x, y, 2, flip ? 1 : 2); g.fillRect(x + (flip ? 2 : 1), y + 1, 1, 1);
  }
  if (wk[4] > 0.2 && streaks.length < 5 && R() < dt * 2) streaks.push({ x: -40, y: 20 + R() * (vh - 40), v: 260 + R() * 80, len: 18 + Math.floor(R() * 16) });
  g.fillStyle = "#ffffff";
  for (let i = streaks.length - 1; i >= 0; i--) {
    const s = streaks[i];
    s.x += s.v * dt;
    if (s.x > vw + 40) { streaks.splice(i, 1); continue; }
    g.globalAlpha = 0.22 * wk[4]; g.fillRect(Math.round(s.x), Math.round(s.y), s.len, 1); g.fillRect(Math.round(s.x) + s.len - 6, Math.round(s.y) - 1, 6, 1);
  }
  // ── snow: big slow flakes swaying down
  const wantSnow = Math.round(130 * wk[5]);
  while (snow.length < wantSnow) snow.push({ x: R() * vw, y: R() * vh, v: 18 + R() * 22, ph: R() * 9, big: R() < 0.3 });
  if (snow.length > wantSnow) snow.length = wantSnow;
  g.fillStyle = "#ffffff"; g.globalAlpha = Math.min(1, wk[5] * 1.2) * 0.9;
  for (const f of snow) {
    f.y += f.v * dt; f.x += Math.sin(t / 700 + f.ph) * 12 * dt;
    if (f.y > vh + 4) { f.y = -4; f.x = R() * vw; }
    const x = Math.round(f.x), y = Math.round(f.y);
    if (f.big) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } else g.fillRect(x, y, 1, 1);
  }
  // ── fireflies after dark, wandering over the grass and gathering at the fires
  const calm = 1 - Math.max(wk[2], wk[5]) * 0.9;
  const wild = theme === "meadow" || theme === "forest" || theme === "autumn" || theme === "town" ? 22 : 0;
  const wantFly = n > 0.35 ? Math.round((wild + camps.length * 9) * calm) : 0;
  while (flies.length < wantFly) flies.push({ wx: R() * vw + ox, wy: R() * vh + oy, ph: R() * 9, camp: flies.length >= Math.round(wild * calm) ? Math.floor(R() * Math.max(1, camps.length)) : -1, a: R() * 6.28, r: 26 + R() * 46 });
  if (flies.length > wantFly) flies.length = wantFly;
  g.globalCompositeOperation = "lighter";
  for (const f of flies) {
    let x, y;
    if (f.camp >= 0 && camps[f.camp]) {
      const c = camps[f.camp];
      f.a += dt * 0.35 * (f.ph > 4.5 ? 1 : -1);
      x = c.x + Math.cos(f.a) * f.r + Math.sin(t / 800 + f.ph) * 6; y = c.y - 14 + Math.sin(f.a) * f.r * 0.55 + Math.cos(t / 600 + f.ph) * 8 - Math.abs(Math.sin(t / 1400 + f.ph)) * 10;
    } else {
      f.wx += Math.sin(t / 900 + f.ph) * 9 * dt; f.wy += Math.cos(t / 1100 + f.ph * 2) * 7 * dt;
      x = f.wx - ox; y = f.wy - oy;
      if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) { f.wx = R() * vw + ox; f.wy = R() * vh + oy; continue; }
    }
    const blink = Math.max(0, Math.sin(t / 420 + f.ph * 3)), a = Math.min(1, n * 1.4) * (0.25 + 0.75 * blink);
    x = Math.round(x); y = Math.round(y);
    g.globalAlpha = a * 0.35; g.fillStyle = "#c8f060"; g.fillRect(x - 1, y - 2, 3, 5); g.fillRect(x - 2, y - 1, 5, 3);
    g.globalAlpha = a; g.fillStyle = "#f4ff9a"; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
    g.fillStyle = "#ffffff"; g.fillRect(x, y, 1, 1);
  }
  g.restore();
}

// ───────────────────────────── the HUD clock ─────────────────────────────

/** A 12×12 glyph for the phase (sunrise, sun, sunset, moon) with the weather tucked in a corner. */
export function drawIcon(cv, h = hour(), w = weather()) {
  const x = cv.getContext("2d"), ph = phase(h);
  x.clearRect(0, 0, 12, 12);
  const r = (a, b, c, d, col) => { x.fillStyle = col; x.fillRect(a, b, c, d); };
  const disc = (cx, cy, col, edge) => { r(cx - 2, cy - 3, 4, 6, col); r(cx - 3, cy - 2, 6, 4, col); r(cx - 2, cy - 3, 4, 1, edge); };
  if (ph === 4) {
    // a crescent moon and a star
    r(4, 2, 4, 1, "#fff2b0"); r(3, 3, 2, 6, "#fff2b0"); r(4, 9, 4, 1, "#fff2b0"); r(5, 3, 1, 1, "#d8c070"); r(5, 8, 2, 1, "#d8c070");
    r(9, 2, 1, 1, "#ffffff"); r(10, 6, 1, 1, "#b8c8ff");
  } else if (ph === 2 || ph === 1) {
    disc(6, 6, "#ffd84a", "#fff4b0");
    r(6, 0, 1, 2, "#ffb030"); r(6, 10, 1, 2, "#ffb030"); r(0, 6, 2, 1, "#ffb030"); r(10, 6, 2, 1, "#ffb030");
    r(2, 2, 1, 1, "#ffb030"); r(9, 2, 1, 1, "#ffb030"); r(2, 9, 1, 1, "#ffb030"); r(9, 9, 1, 1, "#ffb030");
  } else {
    // half a sun on the horizon: pink at dawn, orange at sunset
    const c = ph === 0 ? "#ff9ac0" : "#ff8a3a", e = ph === 0 ? "#ffd0e0" : "#ffd070";
    r(3, 5, 6, 3, c); r(4, 4, 4, 1, e); r(0, 8, 12, 1, "#ffe0a0"); r(2, 10, 8, 1, ph === 0 ? "#b08ad8" : "#c8604a");
    r(6, 1, 1, 2, e); r(2, 3, 1, 1, e); r(9, 3, 1, 1, e);
  }
  // the weather, small in the lower right
  if (w === 2) { r(8, 8, 4, 2, "#c8d0e0"); r(8, 10, 1, 2, "#7aa8ff"); r(10, 11, 1, 1, "#7aa8ff"); }
  else if (w === 1) { r(7, 8, 5, 3, "#d8dce8"); r(8, 7, 3, 1, "#d8dce8"); }
  else if (w === 3) { r(5, 9, 7, 1, "#c8d0dc"); r(3, 11, 8, 1, "#c8d0dc"); }
  else if (w === 4) { r(6, 9, 5, 1, "#e8f0ff"); r(10, 8, 1, 1, "#e8f0ff"); r(4, 11, 6, 1, "#e8f0ff"); }
  else if (w === 5) { r(9, 8, 1, 3, "#ffffff"); r(8, 9, 3, 1, "#ffffff"); }
}
