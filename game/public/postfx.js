/**
 * HD-2D post-processing (the Octopath Traveler look) over the finished world frame, under the name
 * canvas and the CSS CRT: a tilt-shift depth of field (a crisp band around you, softer toward the far
 * top and the near bottom), bloom around the lights, slow light shafts (diagonal sun outdoors by day,
 * vertical beams in the dungeons) and a colour grade by hour and region.
 *
 * Nothing here reads the frame back: any read of the world canvas (drawImage of it, getImageData)
 * makes the browser finish the whole frame on the spot, ~8 ms measured on an RTX 4070. So the blur is
 * done by the compositor (CSS `backdrop-filter` on masked layers just above the canvas, plus a light
 * sepia/saturate/contrast `filter` on it for the warmth and richness), and the canvas only gets fills
 * whose blend needs no copy of the frame (lighter, screen): cached gradient glows at the lights scene2d.js
 * already lists, a few gradient beams, one flat shadow tint (soft-light/multiply cost +2 ms each).
 * Levels: 0 끔 (draws and styles nothing: the frame is exactly what scene2d.js drew), 1 보통, 2 높음, kept
 * in localStorage "lumentale:gfx"; ?gfx=0|1|2 overrides it, and the art preview pages (`/_*.html`)
 * default to 끔 so pixel checks stay crisp. Frames slower than 30 fps for 4 s step the level down for
 * the session. Edges get blur, never darkness (the CRT rule: no dark vignette); the haze toward the
 * far top is scene_depth.js's, nothing here adds haze.
 */
import * as Sky from "./sky.js";

const KEY = "lumentale:gfx";
// dof: [blur in logical px, sharp half-band, ramp (fractions of the view height around you), top, bottom strength] per layer;
// bloom: halo alpha in the dark; shafts: how many and how bright; grade: shadow tint strength; warm/sat/con: the canvas filter
const LV = [null,
  { dof: [[1.4, 0.17, 0.22, 0.95, 0.75]], bloom: 0.42, shafts: 3, shaftA: 0.14, grade: 1, warm: 0.8, sat: 1.16, con: 1.05 },
  { dof: [[1.2, 0.12, 0.2, 1, 0.9], [3, 0.24, 0.18, 1, 0.85]], bloom: 0.6, shafts: 5, shaftA: 0.2, grade: 1.3, warm: 1, sat: 1.26, con: 1.09 },
];
// per region: [shadow tint (screened into the darks), warmth (sepia), beam colour]; hues follow scene_depth.js's PALETTE
const GRADE = {
  town: ["#22263a", 0.1, "#ffe8b0"], meadow: ["#1c3026", 0.08, "#fff0b0"], forest: ["#0e2c24", 0.1, "#eef0a0"], city: ["#1a2042", 0.06, "#ffe0c0"],
  autumn: ["#2c1824", 0.16, "#ffc890"], jungle: ["#0c2a20", 0.08, "#e8f8a8"], coast: ["#15304a", 0.04, "#fff4d0"], desert: ["#3a2216", 0.18, "#ffd8a0"],
  mesa: ["#381620", 0.16, "#ffc0a0"], mist: ["#1e2a3c", 0, "#e4eeff"], jianmen: ["#1c2a28", 0.08, "#f0e8c0"], cave: ["#06262e", 0, "#7eeedd"], crypt: ["#1c1428", 0.02, "#bfa2ff"],
  sewer: ["#0a2418", 0.04, "#aee08e"], abyss: ["#320810", 0.06, "#ff6a5a"], sanctum: ["#082422", 0.04, "#9effb8"], interior: ["#26140a", 0.14, "#ffc27c"],
};
const DUNGEON = new Set(["cave", "crypt", "sewer", "abyss", "sanctum"]);
const NIGHT = [12, 26, 72], DAWN = [255, 178, 196], DUSK = [255, 150, 70];
const WXK = [1, 0.45, 0.08, 0.75, 0.9, 0.25];   // sun shafts by weather: clear cloud rain fog wind snow

const fromUrl = typeof location === "object" ? new URLSearchParams(location.search).get("gfx") : null;
const preview = typeof location === "object" && /\/_\w+\.html$/.test(location.pathname);
let level = pick(fromUrl ?? (preview ? 0 : localStorage.getItem(KEY) ?? 1));
let onChange = () => {};
function pick(v) { const n = Math.round(+v); return n >= 0 && n <= 2 ? n : 1; }

export const getLevel = () => level;
/** The game at 그래픽 끔 (chosen, or dropped to by the slow-frame watch): the per-sprite canvas glows are skipped too. Never on a preview page. */
export const lowSpec = () => level === 0 && !preview;
/** The player's choice (the settings window): kept, and the slow-frame watch starts over. */
export function setLevel(n) { level = pick(n); slow = 0; ema = 16; localStorage.setItem(KEY, String(level)); onChange(); }
/** Wire the 끔/보통/높음 buttons (index.html #opt-gfx, `data-gfx`); `click` plays the UI sound. */
export function bindSetting(el, click) {
  if (!el) return;
  const bs = el.querySelectorAll("button");
  onChange = () => { for (const b of bs) { const on = +b.dataset.gfx === level; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); } };
  for (const b of bs) b.addEventListener("click", () => { setLevel(+b.dataset.gfx); click && click(); });
  onChange();
}

// the slow-frame watch: a smoothed frame time over 33 ms (under 30 fps) for 4 s drops one level, not saved
let ema = 16, slow = 0;
function watch(dt) {
  if (!(dt > 0) || dt >= 0.05) return;   // the client clamps dt at 50 ms: a hitch or a hidden tab, not the pace
  ema += (dt * 1000 - ema) * 0.05;
  slow = ema > 33 ? slow + dt : 0;
  if (slow > 4) { level--; slow = 0; ema = 16; onChange(); }
}

// ───────────────────────────── the compositor layers (depth of field) ─────────────────────────────

const layers = [];
let shown = 0, maskAt = -1, rect = null;
const box = ["", "", 0, 0];   // the canvas size and window size the layers were fitted to
/** Keep the blur layers over the canvas, at this level's blur and around your band; level 0 takes them all away. */
function compositor(cv, vw, focus, vh) {
  const P = LV[level];
  if (shown !== level) {
    shown = level; box[0] = gradeKey = ""; maskAt = -1;
    if (!P) cv.style.filter = "";
    for (let i = 0; i < 2; i++) {
      if (!layers[i] && P) {
        const d = document.createElement("div");
        d.setAttribute("aria-hidden", "true");
        d.style.cssText = "position:fixed;pointer-events:none;margin:0";
        (layers[i - 1] || cv).after(d);
        layers.push(d);
      }
      if (layers[i]) layers[i].style.display = P && P.dof[i] ? "block" : "none";
    }
  }
  if (!P) return;
  if (cv.style.width !== box[0] || cv.style.height !== box[1] || innerWidth !== box[2] || innerHeight !== box[3]) {
    box[0] = cv.style.width; box[1] = cv.style.height; box[2] = innerWidth; box[3] = innerHeight; maskAt = -1;
    const r = (rect = cv.getBoundingClientRect()), z = getComputedStyle(cv).zIndex;
    for (const d of layers) Object.assign(d.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", zIndex: z });
  }
  const at = Math.round(Math.min(0.85, Math.max(0.15, focus / vh)) * 100), f = at / 100;
  if (at === maskAt) return;
  maskAt = at;
  const Z = rect.width / vw, pc = (v) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(1)}%`;
  P.dof.forEach(([blur, band, ramp, top, bot], i) => {
    const a = f - band, b = f + band;
    const m = `linear-gradient(to bottom, rgba(0,0,0,${top}) 0%, rgba(0,0,0,${top * 0.35}) ${pc(a - ramp)}, transparent ${pc(a)}, transparent ${pc(b)}, rgba(0,0,0,${bot * 0.35}) ${pc(b + ramp)}, rgba(0,0,0,${bot}) 100%)`;
    const s = layers[i].style;
    s.backdropFilter = s.webkitBackdropFilter = `blur(${(blur * Z).toFixed(1)}px)`;
    s.maskImage = s.webkitMaskImage = m;
  });
}

// ───────────────────────────── the canvas side ─────────────────────────────

let gradeKey = "", beamFill = null, beamKey = "";
const tint = { lo: "", loA: 0, sun: [0, 0, 0] };
const glowFill = new Map(), HALO = [24, 36, 56];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const bump = (h, a, m, b) => (h <= a || h >= b ? 0 : h < m ? (h - a) / (m - a) : (b - h) / (b - m));

// Glows and beams are gradient fills through a transform, never sprites: a canvas or bitmap source
// drawn every frame cost the GPU process 2–9 ms here, a cached gradient costs nothing measurable.
/** A unit round glow (radius 1 at the origin) in a light's colour; the transform places and sizes it. */
function glow(g, col) {
  let f = glowFill.get(col);
  if (!f) {
    const c = rgb(col);
    f = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    f.addColorStop(0, css(c)); f.addColorStop(0.35, css(c, 0.4)); f.addColorStop(1, css(c, 0));
    glowFill.set(col, f);
  }
  return f;
}

/** The grade for this region and hour, worked out again (and the canvas's filter restyled) only when it changes. */
function grade(cv, theme, dark, outdoor, P) {
  const h = outdoor ? Sky.hour() : 12, key = `${theme}|${level}|${Math.round(h * 10)}|${Math.round(dark * 20)}|${outdoor}`;
  if (key === gradeKey) return;
  gradeKey = key;
  const [lo, warm, beam] = GRADE[theme] || GRADE.town;
  const dawn = outdoor ? bump(h, 4.6, 6.2, 8) : 0, dusk = outdoor ? bump(h, 16.4, 18.4, 20) : 0;
  tint.lo = css(outdoor ? mix(rgb(lo), NIGHT, dark * 0.8) : rgb(lo));
  tint.loA = (0.06 + 0.1 * dark) * P.grade;
  // warm by day, warmer at dawn and dusk, none at night (blue shadows; the lamps are warm on their own)
  const sepia = (warm + 0.08 * (dawn + dusk)) * (1 - 0.9 * dark) * P.warm;
  cv.style.filter = `sepia(${sepia.toFixed(3)}) saturate(${(P.sat - 0.06 * dark).toFixed(3)}) contrast(${P.con})`;
  // the beams: the region's sunlight, pink at dawn, orange at dusk
  tint.sun = outdoor ? mix(mix(rgb(beam), DAWN, dawn), DUSK, dusk) : rgb(beam);
}

/**
 * Lay the effects over the frame `g` has just drawn. `vw`/`vh`: the view in logical pixels; `focus`:
 * your feet's height on screen (logical); `ox`: the camera's left edge (the beams keep to the world);
 * `dark`: 0 by day … 1 at night (dungeons pass their own); `outdoor`: the sky is overhead; `lights`:
 * scene2d.js's light list ({ x, y, col, k, bloom, by } on screen) or null.
 */
export function frame(g, vw, vh, t, dt, focus, ox, theme, dark, outdoor, lights) {
  if (level) watch(dt);
  if (level || shown) compositor(g.canvas, vw, focus, vh);
  if (!level) return;
  const P = LV[level], D = g.canvas.width / vw;
  grade(g.canvas, theme, dark, outdoor, P);
  g.save();
  g.setTransform(D, 0, 0, D, 0, 0);
  g.filter = "none"; g.imageSmoothingEnabled = true;

  // bloom: a wide soft halo around every light that has a bright core (lamp heads, windows, flames, crystals)
  if (lights && dark > 0.05) {
    g.globalCompositeOperation = "lighter";
    for (const s of lights) {
      if (!s.bloom || s.col.length !== 7) continue;   // "#rrggbb" only
      const r = HALO[s.bloom <= 10 ? 0 : s.bloom <= 16 ? 1 : 2], x = s.x, y = s.by ?? s.y;
      if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
      g.globalAlpha = Math.min(1, P.bloom * dark * (s.k ?? 1));
      g.fillStyle = glow(g, s.col);
      g.setTransform(D * r, 0, 0, D * r, x * D, y * D);
      g.fillRect(-1, -1, 2, 2);
    }
    g.setTransform(D, 0, 0, D, 0, 0);
  }

  // light shafts, drifting slowly and sliding at half the ground's pace (they hang in the air)
  const sun = outdoor ? (1 - dark) * (WXK[Sky.weather()] ?? 0.5) : DUNGEON.has(theme) ? 0.75 : 0;
  if (sun > 0.02) {
    const n = outdoor ? P.shafts : P.shafts - 1, span = vw + 220;
    if (beamKey !== gradeKey) {
      // a unit beam: bright down its middle, soft at the sides and toward both ends (an ellipse stretched along it)
      beamKey = gradeKey; beamFill = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      beamFill.addColorStop(0, css(tint.sun)); beamFill.addColorStop(0.45, css(tint.sun, 0.55)); beamFill.addColorStop(1, css(tint.sun, 0));
    }
    // the sun crosses from left to right (scene_depth.js): beams lean down-right in the morning, upright at noon
    const lean = outdoor ? 0.18 + 0.42 * Math.cos(Math.min(1, Math.max(0, (Sky.hour() - 6) / 12)) * Math.PI) : 0.04;
    const c = Math.cos(-lean) * D, s = Math.sin(-lean) * D, len = vh * 0.75, par = outdoor ? 0.5 : 0.85;
    g.globalCompositeOperation = "screen"; g.fillStyle = beamFill;
    for (let i = 0; i < n; i++) {
      const x = ((((i * 0.618 + 0.11) * span - ox * par + t * (outdoor ? 0.004 : 0.0015)) % span) + span) % span - 110;
      const w = 12 + ((i * 29) % 18), y = vh * 0.38 + ((i * 17) % 20);   // half-width, and the beam's middle
      g.globalAlpha = P.shaftA * sun * (0.6 + 0.4 * Math.sin(t / 2600 + i * 1.9));
      g.setTransform(c * w, s * w, -s * len, c * len, x * D, y * D);
      g.fillRect(-1, -1, 2, 2);
    }
    g.setTransform(D, 0, 0, D, 0, 0);
  }

  // the region's tint screened into the shadows (night blue outdoors): even over the whole view, lamps and fires keep their colour
  g.globalCompositeOperation = "screen"; g.globalAlpha = tint.loA; g.fillStyle = tint.lo; g.fillRect(0, 0, vw, vh);
  g.restore();
}
