// Automated pixel-art quality linter for 32x32 (or NxN) canvases/RGBA buffers.
// Usage: import { lintIcon } from './pixel-lint.mjs';
// Returns { ok, metrics, warnings } for margin, centering, contrast, orphan pixels, and outline doubles.

function lum(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function key(d, i) {
  return d[i + 3] === 0 ? 0 : ((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) + 1;
}

export function lintIcon(name, w, h, rgba) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : key(rgba, (y * w + x) * 4);
  const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : rgba[(y * w + x) * 4 + 3];

  let minX = w, minY = h, maxX = -1, maxY = -1, solid = 0;
  let minLum = 1, maxLum = 0;
  const colors = new Set();
  const orphans = [];
  const doubles = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = at(x, y);
      if (!k) continue;
      solid++;
      colors.add(k);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const idx = (y * w + x) * 4;
      const L = lum(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
      // Track interior contrast (skip near-black outline luminance < 0.14)
      if (L >= 0.14) {
        if (L < minLum) minLum = L;
        if (L > maxLum) maxLum = L;
      }

      // Orphan pixel: interior pixel whose 4-neighbors are opaque and NONE of its 8-neighbors share its color
      const n4 = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      const n8 = [...n4, at(x - 1, y - 1), at(x + 1, y - 1), at(x - 1, y + 1), at(x + 1, y + 1)];
      if (n4.every((v) => v !== 0) && n8.every((v) => v !== k)) {
        // Ignore pure specular glints (very bright L > 0.92)
        if (L < 0.92) orphans.push([x, y]);
      }

      // Outline double: dark outline pixel (L < 0.18) on the outer boundary forming a 2x2 dark clump
      if (L < 0.18 && x + 1 < w && y + 1 < h) {
        const isDark = (px, py) => {
          if (!alpha(px, py)) return false;
          const ii = (py * w + px) * 4;
          return lum(rgba[ii], rgba[ii + 1], rgba[ii + 2]) < 0.18;
        };
        const touchesBg = (px, py) => !alpha(px - 1, py) || !alpha(px + 1, py) || !alpha(px, py - 1) || !alpha(px, py + 1);
        if (
          isDark(x + 1, y) && isDark(x, y + 1) && isDark(x + 1, y + 1) &&
          (touchesBg(x, y) || touchesBg(x + 1, y) || touchesBg(x, y + 1) || touchesBg(x + 1, y + 1))
        ) {
          doubles.push([x, y]);
        }
      }
    }
  }

  const warnings = [];
  if (minX <= 0 || minY <= 0 || maxX >= w - 1 || maxY >= h - 1) {
    warnings.push(`margin-clip: bbox [${minX},${minY}]..[${maxX},${maxY}] touches 0px edge`);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  if (Math.abs(cx - (w - 1) / 2) > 3.5 || Math.abs(cy - (h - 1) / 2) > 3.5) {
    warnings.push(`off-center: center (${cx.toFixed(1)}, ${cy.toFixed(1)})`);
  }
  const contrast = maxLum - minLum;
  if (contrast < 0.45) {
    warnings.push(`low-contrast: lum span ${contrast.toFixed(2)} (< 0.45)`);
  }
  if (orphans.length > 4) {
    warnings.push(`orphan-pixels: ${orphans.length} (${orphans.slice(0, 5).map((p) => p.join(',')).join(' ')})`);
  }
  if (doubles.length > 2) {
    warnings.push(`outline-doubles: ${doubles.length} (${doubles.slice(0, 5).map((p) => p.join(',')).join(' ')})`);
  }

  return {
    name,
    ok: warnings.length === 0,
    metrics: {
      solid,
      colors: colors.size,
      bbox: `${maxX - minX + 1}x${maxY - minY + 1}`,
      contrast: Number(contrast.toFixed(2)),
      orphans: orphans.length,
      doubles: doubles.length,
    },
    warnings,
  };
}
