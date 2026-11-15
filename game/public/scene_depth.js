// Atmospheric perspective belongs to the map scenery. The camera and combat art use their normal projection.
const PALETTE = {
  town: [[170, 182, 168], "#373b35"],
  meadow: [[177, 202, 177], "#344333"],
  forest: [[129, 167, 163], "#233e3e"],
  city: [[163, 169, 192], "#2e3450"],
  autumn: [[191, 158, 155], "#493040"],
  jungle: [[121, 160, 153], "#263c39"],
  coast: [[173, 199, 213], "#364456"],
  desert: [[219, 189, 163], "#5c423b"],
  mesa: [[198, 152, 145], "#562d39"],
  mist: [[174, 194, 209], "#394356"],
  cave: [[89, 121, 158], "#202b4a"],
  crypt: [[104, 100, 132], "#2d2537"],
  sewer: [[82, 111, 103], "#243a33"],
  abyss: [[124, 79, 104], "#3b2135"],
};
const WARM = new Set(["#ffb860", "#ffd890", "#ffe690", "#ffd070", "#ffd870"]);
const COLD = new Set(["#5ae4d0", "#72e6f4", "#b07aff", "#4aa8ff", "#ff6a7a"]);
const CANOPY = new Set(["town", "meadow", "forest", "jungle", "autumn", "mist"]);
const variants = new WeakMap();
const VARIANT_LIMIT = 12;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const rgba = (color, alpha) => `rgba(${color.join(",")},${alpha})`;

function groundShadow(g, x, y, rx, ry, shift, stretch, strength) {
  g.globalAlpha = strength * 0.54;
  g.beginPath();
  g.ellipse(x + shift, y + stretch * 0.27, rx + stretch * 0.45, ry + stretch * 0.14, 0.12 * Math.sign(shift), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = strength;
  g.beginPath();
  g.ellipse(x, y, rx * 0.73, ry * 0.74, 0, 0, Math.PI * 2);
  g.fill();
}

// Broad, small openings in the canopy light the ground on the sunward side of a tree.
function sunPatch(g, x, y, side, size, strength) {
  g.save();
  g.translate(x - side * size * 0.58, y - size * 0.16);
  g.rotate(side * 0.18);
  g.scale(1, 0.42);
  const light = g.createRadialGradient(0, 0, size * 0.12, 0, 0, size);
  light.addColorStop(0, rgba([255, 239, 163], strength));
  light.addColorStop(0.7, rgba([255, 223, 140], strength * 0.4));
  light.addColorStop(1, "rgba(255,223,140,0)");
  g.globalCompositeOperation = "screen";
  g.fillStyle = light;
  g.fillRect(-size, -size, size * 2, size * 2);
  g.restore();
}

function lampPool(g, light, night) {
  const radius = Math.min(40, light.r * 0.7);
  const alpha = 0.3 * night * (light.k ?? 1);
  const color = WARM.has(light.col) ? [255, 187, 101] : light.col.slice(1).match(/../g).map((part) => parseInt(part, 16));
  g.save();
  g.translate(light.x, light.y + 3);
  g.scale(1, 0.44);
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, radius);
  halo.addColorStop(0, rgba(color, alpha));
  halo.addColorStop(0.56, rgba(color, alpha * 0.48));
  halo.addColorStop(1, rgba(color, 0));
  g.fillStyle = halo;
  g.fillRect(-radius, -radius, radius * 2, radius * 2);
  g.restore();
}

/** Terrain effects use logical screen pixels and only cover the top face of the map. */
export function drawDepthGround(g, { width, height, ox, oy, focusY, theme, hour, night, bounds, statics, sources = [] }) {
  const [air, ink] = PALETTE[theme] || PALETTE.town;
  const focus = focusY - oy;
  g.save();
  g.beginPath();
  g.moveTo(bounds[0][0] - ox, bounds[0][1] - oy);
  for (const [x, y] of bounds.slice(1)) g.lineTo(x - ox, y - oy);
  g.closePath();
  g.clip();

  // The sun crosses the map from left to right. Its shadow is shortest at noon.
  g.fillStyle = ink;
  const sunSide = Math.cos(clamp01((hour - 6) / 12) * Math.PI);
  const seen = new Set();
  const patches = [];
  const canopy = CANOPY.has(theme) && night < 0.35;
  for (const { s: st } of statics) {
    if (!st || seen.has(st)) continue;
    const building = st.depthBuilding || st.house;
    const foliage = st.depthFoliage;
    const largeProp = st.sp.width >= 30 && st.sp.height >= 30 && (st.big || st.prop || st.land);
    if (!building && !foliage && !largeProp) continue;
    seen.add(st);
    const x = (st.depthBuilding?.x ?? st.x) - ox;
    const y = (st.depthBuilding?.y ?? st.y) - oy;
    if (x < -80 || x > width + 80 || y < -26 || y > height + 26) continue;
    const rx = building ? Math.min(44, st.sp.width * 0.32) : Math.min(23, st.sp.width * (foliage ? 0.25 : 0.36));
    const ry = Math.max(3, rx * 0.25);
    const strength = 0.31 - 0.16 * night;
    const stretch = Math.min(34, st.sp.height * 0.36) * (0.2 + 0.8 * Math.abs(sunSide)) * (1 - 0.86 * night);
    groundShadow(g, x, y, rx, ry, sunSide * stretch, stretch, strength);
    if (canopy && patches.length < 6 && foliage && st.sp.height >= 34 && (Math.round(st.x) * 13 + Math.round(st.y) * 7) % 17 === 0) patches.push([x, y, Math.min(49, rx * 2.4)]);
  }
  g.globalAlpha = 1;
  const sunlight = 0.22 * (1 - night) * (0.7 + 0.3 * Math.abs(sunSide));
  for (const [x, y, size] of patches) sunPatch(g, x, y, sunSide, size, sunlight);

  const far = focus - height * 0.55;
  const clear = focus - height * 0.05;
  if (clear > 0) {
    const haze = g.createLinearGradient(0, far, 0, clear);
    const strength = 0.39 - 0.20 * night;
    haze.addColorStop(0, rgba(air, strength));
    haze.addColorStop(0.44, rgba(air, strength * 0.61));
    haze.addColorStop(1, rgba(air, 0));
    g.fillStyle = haze;
    g.fillRect(0, 0, width, Math.min(height, clear));
  }

  if (night > 0.12) {
    for (const light of sources) {
      if (!(WARM.has(light.col) || COLD.has(light.col)) || light.x < -40 || light.x > width + 40 || light.y < -20 || light.y > height + 20) continue;
      lampPool(g, light, night);
    }
  }
  g.restore();
}

/** Soften only the color inside the sprite, keeping every pixel of its alpha mask. */
export function depthSprite(g, sp, st, { y, focusY, height, theme, night }) {
  const distance = (focusY - (st.d ?? y)) / height;
  const foreground = distance < 0;
  const ramp = foreground ? (-distance - 0.27) / 0.27 : (distance - 0.10) / 0.36;
  const level = Math.round(clamp01(ramp) * 5);
  if (!level) return sp;

  const dim = night > 0.46;
  const key = `${theme}:${foreground}:${level}:${dim}`;
  let cache = variants.get(sp);
  if (!cache) { cache = new Map(); variants.set(sp, cache); }
  if (cache.has(key)) return cache.get(key);

  const cv = g.canvas.ownerDocument.createElement("canvas");
  cv.width = sp.width;
  cv.height = sp.height;
  const vg = cv.getContext("2d");
  vg.drawImage(sp, 0, 0);
  vg.globalCompositeOperation = "source-atop";
  vg.globalAlpha = level * 0.081;
  vg.filter = `blur(${0.34 + level * 0.16}px)`;
  vg.drawImage(sp, 0, 0);
  vg.filter = "none";
  const [air, ink] = PALETTE[theme] || PALETTE.town;
  vg.fillStyle = foreground ? ink : rgba(air, 1);
  vg.globalAlpha = level * (foreground ? 0.047 : dim ? 0.043 : 0.073);
  vg.fillRect(0, 0, sp.width, sp.height);

  if (cache.size === VARIANT_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, cv);
  return cv;
}
