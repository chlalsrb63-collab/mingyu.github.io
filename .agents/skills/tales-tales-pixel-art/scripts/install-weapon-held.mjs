// Batch installer for held in-world weapon sprites from high-res AI weapon icon sheets.
// Rotates 45-deg upper-right weapons by +45 deg clockwise at FULL resolution before crisp pixel-snap
// downscaling so held weapons match their bag icons 1:1 with zero jagged diagonal artifacts.
//
// Usage: node .agents/skills/tales-tales-pixel-art/scripts/install-weapon-held.mjs <sheets-map.json> [contact-out.png]

import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { execFileSync } from "child_process";

const KINDS = ["sword", "dagger", "spear", "hammer", "staff", "book", "bow"];

// Exact canvas dimensions and visual placement matching game/public/weapons.js (ox=5, oy=16; book ox=16, oy=16)
const SPEC = {
  sword:  { W: 44, H: 32, x0: 1, maxW: 41, maxH: 26, rot: 45, oy: 16 },
  dagger: { W: 32, H: 32, x0: 1, maxW: 24, maxH: 20, rot: 45, oy: 16 },
  spear:  { W: 52, H: 32, x0: 1, maxW: 49, maxH: 24, rot: 45, oy: 16 },
  hammer: { W: 40, H: 36, x0: 1, maxW: 37, maxH: 30, rot: 45, oy: 16 },
  staff:  { W: 32, H: 32, x0: 1, maxW: 30, maxH: 22, rot: 45, oy: 16 },
  book:   { W: 32, H: 32, x0: -1, maxW: 20, maxH: 20, rot: 0,  oy: 16 }, // x0:-1 => centered at (16,16)
  bow:    { W: 32, H: 32, x0: 5, maxW: 16, maxH: 28, rot: -45, oy: 16 },
};

function encodePng(w, h, rgba) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function decodeImage(imgPath) {
  const rawPath = imgPath + ".rawbgra";
  const ps = `
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::new('${imgPath.replace(/'/g, "''")}')
$w = $bmp.Width; $h = $bmp.Height
$rect = [System.Drawing.Rectangle]::new(0, 0, $w, $h)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($w * $h * 4)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data); $bmp.Dispose()
[System.IO.File]::WriteAllBytes('${rawPath.replace(/'/g, "''")}', $bytes)
Write-Output "$w,$h"
`;
  const dims = execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim().split("\n").pop();
  const [W, H] = dims.split(",").map(Number);
  const bgra = fs.readFileSync(rawPath);
  fs.unlinkSync(rawPath);
  return { W, H, bgra };
}

function isMagenta(r, g, b, tol = 58) {
  return (r - g) > tol && (b - g) > tol && r > 140 && b > 140 && Math.abs(r - b) < 85;
}

function extractCellRgba(sheet, col, row, cols, rows) {
  const { W, H, bgra } = sheet;
  const x0 = Math.floor((col * W) / cols), x1 = Math.floor(((col + 1) * W) / cols);
  const y0 = Math.floor((row * H) / rows), y1 = Math.floor(((row + 1) * H) / rows);
  const cw = x1 - x0, ch = y1 - y0;
  const rgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * 4;
      const di = (y * cw + x) * 4;
      rgba[di] = bgra[si + 2];
      rgba[di + 1] = bgra[si + 1];
      rgba[di + 2] = bgra[si];
      rgba[di + 3] = bgra[si + 3];
    }
  }
  // Flood-fill magenta background from cell borders
  const bg = new Uint8Array(cw * ch);
  const q = [];
  const tryPush = (x, y) => {
    const idx = y * cw + x;
    if (bg[idx]) return;
    const di = idx * 4;
    if (rgba[di + 3] < 20 || isMagenta(rgba[di], rgba[di + 1], rgba[di + 2], 42)) {
      bg[idx] = 1;
      q.push(idx);
    }
  };
  for (let x = 0; x < cw; x++) { tryPush(x, 0); tryPush(x, ch - 1); }
  for (let y = 0; y < ch; y++) { tryPush(0, y); tryPush(cw - 1, y); }
  for (let head = 0; head < q.length; head++) {
    const idx = q[head], x = idx % cw, y = (idx - x) / cw;
    if (x > 0) tryPush(x - 1, y);
    if (x + 1 < cw) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y + 1 < ch) tryPush(x, y + 1);
  }
  for (let i = 0; i < cw * ch; i++) {
    const di = i * 4;
    if (bg[i]) rgba[di + 3] = 0;
    else if (isMagenta(rgba[di], rgba[di + 1], rgba[di + 2], 62)) rgba[di + 3] = 0;
  }
  // Strip 1px pink fringe touching transparent background
  const fringe = new Uint8Array(cw * ch);
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const idx = y * cw + x, di = idx * 4;
      if (rgba[di + 3] === 0) continue;
      if (rgba[(idx - 1) * 4 + 3] === 0 || rgba[(idx + 1) * 4 + 3] === 0 || rgba[(idx - cw) * 4 + 3] === 0 || rgba[(idx + cw) * 4 + 3] === 0) {
        const r = rgba[di], g = rgba[di + 1], b = rgba[di + 2];
        if ((r - g) > 28 && (b - g) > 28 && r > 110 && b > 110) fringe[idx] = 1;
      }
    }
  }
  for (let i = 0; i < cw * ch; i++) if (fringe[i]) rgba[i * 4 + 3] = 0;
  return { w: cw, h: ch, rgba };
}

function rotateRgba(src, deg) {
  if (!deg) return src;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const { w, h, rgba } = src;
  const nw = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin));
  const nh = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos));
  const out = Buffer.alloc(nw * nh * 4);
  const cx = w / 2, cy = h / 2, ncx = nw / 2, ncy = nh / 2;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      // Inverse rotate (counter-clockwise by deg) to sample source cleanly
      const dx = x - ncx, dy = y - ncy;
      const sx = Math.round(dx * cos + dy * sin + cx);
      const sy = Math.round(-dx * sin + dy * cos + cy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = (sy * w + sx) * 4;
      if (rgba[si + 3] < 128) continue;
      const di = (y * nw + x) * 4;
      out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = 255;
    }
  }
  return { w: nw, h: nh, rgba: out };
}

function renderHeldSprite(cell, spec) {
  const rot = rotateRgba(cell, spec.rot);
  const { w, h, rgba } = rot;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const bw = Math.max(1, maxX - minX + 1), bh = Math.max(1, maxY - minY + 1);
  const scale = Math.min(spec.maxW / bw, spec.maxH / bh);
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  const ox = spec.x0 < 0 ? Math.floor((spec.W - tw) / 2) : spec.x0;
  const oy = Math.max(1, Math.min(spec.H - th - 1, Math.round(spec.oy - th / 2)));

  const out = Buffer.alloc(spec.W * spec.H * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx0 = minX + Math.floor((x * bw) / tw);
      const sx1 = Math.max(sx0 + 1, minX + Math.floor(((x + 1) * bw) / tw));
      const sy0 = minY + Math.floor((y * bh) / th);
      const sy1 = Math.max(sy0 + 1, minY + Math.floor(((y + 1) * bh) / th));
      let total = 0, opaque = 0;
      const samples = [];
      for (let sy = sy0; sy < sy1 && sy < h; sy++) {
        for (let sx = sx0; sx < sx1 && sx < w; sx++) {
          total++;
          const si = (sy * w + sx) * 4;
          if (rgba[si + 3] > 128) {
            opaque++;
            samples.push([rgba[si], rgba[si + 1], rgba[si + 2]]);
          }
        }
      }
      if (opaque * 2.6 >= total && samples.length) {
        // Pick median-luminance pixel for crisp pixel-art edges without muddy averaging
        samples.sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
        const pick = samples[Math.floor(samples.length * 0.45)];
        const dx = ox + x, dy = oy + y;
        if (dx >= 0 && dx < spec.W && dy >= 0 && dy < spec.H) {
          const di = (dy * spec.W + dx) * 4;
          out[di] = pick[0]; out[di + 1] = pick[1]; out[di + 2] = pick[2]; out[di + 3] = 255;
        }
      }
    }
  }
  return out;
}

const mapPath = process.argv[2];
const contactPath = process.argv[3];
if (!mapPath) {
  console.error("Usage: node install-weapon-held.mjs <sheets-map.json> [contact-out.png]");
  process.exit(1);
}

const sheetsMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const manifestPath = path.join("game", "public", "assets", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.images = manifest.images || {};

let installed = 0, totalBytes = 0;
const previews = []; // { kind, tier, W, H, rgba }

for (const kind of KINDS) {
  const entry = sheetsMap[kind];
  if (!entry) continue;
  const spec = SPEC[kind];
  const outDir = path.join("game", "public", "assets", "weapons", kind);
  fs.mkdirSync(outDir, { recursive: true });

  const jobs = [];
  if (typeof entry === "string") {
    jobs.push({ imgPath: entry, cols: 3, rows: 2, tierStart: 1 });
  } else {
    if (entry.t1_6) jobs.push({ imgPath: entry.t1_6, cols: 3, rows: 2, tierStart: 1 });
    if (entry.t7_10) jobs.push({ imgPath: entry.t7_10, cols: 2, rows: 2, tierStart: 7 });
  }

  for (const job of jobs) {
    const sheet = decodeImage(job.imgPath);
    let tier = job.tierStart;
    for (let r = 0; r < job.rows; r++) {
      for (let c = 0; c < job.cols; c++) {
        const cell = extractCellRgba(sheet, c, r, job.cols, job.rows);
        const rgba = renderHeldSprite(cell, spec);
        const png = encodePng(spec.W, spec.H, rgba);
        const fileName = `${kind}_held_t${tier}.png`;
        fs.writeFileSync(path.join(outDir, fileName), png);
        const hash = crypto.createHash("sha256").update(png).digest("hex").slice(0, 8);
        manifest.images[`weapon.${kind}.t${tier}`] = {
          src: `assets/weapons/${kind}/${fileName}?v=${hash}`,
          w: spec.W,
          h: spec.H,
        };
        previews.push({ kind, tier, W: spec.W, H: spec.H, rgba });
        installed++;
        totalBytes += png.length;
        tier++;
      }
    }
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Installed ${installed} held weapon sprites (${(totalBytes / 1024).toFixed(1)} KB).`);

if (contactPath && previews.length) {
  const Z = 3, cellW = 56 * Z, cellH = 40 * Z, pad = 6;
  const cols = 6, rows = KINDS.length;
  const W = cols * (cellW + pad) + pad, H = rows * (cellH + pad) + pad;
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = 34; buf[i * 4 + 1] = 30; buf[i * 4 + 2] = 44; buf[i * 4 + 3] = 255;
  }
  for (const p of previews) {
    const row = KINDS.indexOf(p.kind), col = (p.tier - 1) % cols;
    if (row < 0 || col >= cols) continue;
    const bx = pad + col * (cellW + pad), by = pad + row * (cellH + pad);
    // Draw subtle cell background
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const di = ((by + y) * W + (bx + x)) * 4;
        const border = x === 0 || y === 0 || x === cellW - 1 || y === cellH - 1;
        buf[di] = border ? 74 : 48; buf[di + 1] = border ? 66 : 42; buf[di + 2] = border ? 94 : 62; buf[di + 3] = 255;
      }
    }
    const offX = bx + Math.floor((cellW - p.W * Z) / 2);
    const offY = by + Math.floor((cellH - p.H * Z) / 2);
    for (let y = 0; y < p.H; y++) {
      for (let x = 0; x < p.W; x++) {
        const si = (y * p.W + x) * 4;
        if (p.rgba[si + 3] < 128) continue;
        for (let zy = 0; zy < Z; zy++) {
          for (let zx = 0; zx < Z; zx++) {
            const di = ((offY + y * Z + zy) * W + (offX + x * Z + zx)) * 4;
            buf[di] = p.rgba[si]; buf[di + 1] = p.rgba[si + 1]; buf[di + 2] = p.rgba[si + 2]; buf[di + 3] = 255;
          }
        }
      }
    }
    // Tiny grip indicator dot at (ox, oy)
    const gx = p.kind === "book" ? 16 : 5, gy = 16;
    const di = ((offY + gy * Z + 1) * W + (offX + gx * Z + 1)) * 4;
    buf[di] = 255; buf[di + 1] = 80; buf[di + 2] = 80; buf[di + 3] = 255;
  }
  fs.writeFileSync(contactPath, encodePng(W, H, buf));
  console.log(`Saved held contact sheet: ${contactPath}`);
}
