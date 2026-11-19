// Batch installer for 2x2 boss monster sprite sheets -> crisp 96x96 transparent PNGs
// Saves to game/public/assets/mobs/<id>.png and registers `mob.<id>` in game/public/assets/manifest.json.

import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { execFileSync } from "child_process";

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
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
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

function isPureMagenta(r, g, b, tol = 58) {
  return g < 85 && r > 180 && b > 180 && (r - g) > tol && (b - g) > tol && Math.abs(r - b) < 70;
}

function extractCellRgba(sheet, col, row, cols = 2, rows = 2) {
  const { W, H, bgra } = sheet;
  const x0 = Math.floor((col * W) / cols), x1 = Math.floor(((col + 1) * W) / cols);
  const y0 = Math.floor((row * H) / rows), y1 = Math.floor(((row + 1) * H) / rows);
  const cw = x1 - x0, ch = y1 - y0;
  const rgba = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * 4;
      const di = (y * cw + x) * 4;
      rgba[di] = bgra[si + 2]; rgba[di + 1] = bgra[si + 1]; rgba[di + 2] = bgra[si]; rgba[di + 3] = bgra[si + 3];
    }
  }
  const bg = new Uint8Array(cw * ch);
  const q = [];
  const tryPush = (x, y) => {
    const idx = y * cw + x;
    if (bg[idx]) return;
    const di = idx * 4;
    if (rgba[di + 3] < 20 || isPureMagenta(rgba[di], rgba[di + 1], rgba[di + 2], 42)) { bg[idx] = 1; q.push(idx); }
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
  // Clear border-reached background AND enclosed ultra-pure #ff00ff pockets (between tentacles/antlers/lanterns)
  for (let i = 0; i < cw * ch; i++) {
    const di = i * 4;
    if (bg[i] || (rgba[di] > 220 && rgba[di + 1] < 38 && rgba[di + 2] > 220)) rgba[di + 3] = 0;
  }
  // Strip 1px neon-magenta fringe touching transparent background
  const fringe = new Uint8Array(cw * ch);
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const idx = y * cw + x, di = idx * 4;
      if (rgba[di + 3] === 0) continue;
      const nOp = (rgba[(idx - 1) * 4 + 3] > 0) + (rgba[(idx + 1) * 4 + 3] > 0) + (rgba[(idx - cw) * 4 + 3] > 0) + (rgba[(idx + cw) * 4 + 3] > 0);
      if (nOp === 0) { fringe[idx] = 1; continue; }
      if (nOp < 4) {
        const r = rgba[di], g = rgba[di + 1], b = rgba[di + 2];
        if (g < 105 && (r - g) > 38 && (b - g) > 38 && r > 130 && b > 130) fringe[idx] = 1;
      }
    }
  }
  for (let i = 0; i < cw * ch; i++) if (fringe[i]) rgba[i * 4 + 3] = 0;
  // Remove small disconnected neighbor-cell bleed touching left/right cell edges
  const vis = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) {
    if (vis[i] || rgba[i * 4 + 3] === 0) continue;
    const comp = [i]; vis[i] = 1;
    let touchesSide = false;
    for (let h = 0; h < comp.length; h++) {
      const idx = comp[h], x = idx % cw, y = (idx - x) / cw;
      if (x <= 2 || x >= cw - 3) touchesSide = true;
      for (const n of [x > 0 ? idx - 1 : -1, x + 1 < cw ? idx + 1 : -1, y > 0 ? idx - cw : -1, y + 1 < ch ? idx + cw : -1]) {
        if (n >= 0 && !vis[n] && rgba[n * 4 + 3] > 0) { vis[n] = 1; comp.push(n); }
      }
    }
    if (touchesSide && comp.length < cw * ch * 0.025) {
      for (const idx of comp) rgba[idx * 4 + 3] = 0;
    }
  }
  return { w: cw, h: ch, rgba };
}

function pixelSnap(src, SIZE = 96) {
  const { w, h, rgba } = src;
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
  const pad = 4, maxDim = SIZE - pad * 2;
  const scale = Math.min(maxDim / bw, maxDim / bh);
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  // Bottom-aligned to (SIZE - pad) so feet sit cleanly on the ground anchor!
  const ox = Math.floor((SIZE - tw) / 2), oy = SIZE - pad - th;
  const out = Buffer.alloc(SIZE * SIZE * 4);
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
          if (rgba[si + 3] > 128) { opaque++; samples.push([rgba[si], rgba[si + 1], rgba[si + 2]]); }
        }
      }
      if (opaque * 2.5 >= total && samples.length) {
        samples.sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
        const pick = samples[Math.floor(samples.length * 0.45)];
        const di = ((oy + y) * SIZE + (ox + x)) * 4;
        out[di] = pick[0]; out[di + 1] = pick[1]; out[di + 2] = pick[2]; out[di + 3] = 255;
      }
    }
  }
  return out;
}

const configPath = process.argv[2];
const contactOut = process.argv[3];
const jobs = JSON.parse(fs.readFileSync(configPath, "utf8"));
const outDir = path.join("game", "public", "assets", "mobs");
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join("game", "public", "assets", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.images = manifest.images || {};

const SIZE = 96;
const previews = [];
let totalBytes = 0;

for (const job of jobs) {
  const sheet = decodeImage(job.img);
  const cols = job.cols || 2, rows = job.rows || 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = job.ids[i++];
      if (!id) continue;
      const cell = extractCellRgba(sheet, c, r, cols, rows);
      const rgba = pixelSnap(cell, SIZE);
      const png = encodePng(SIZE, SIZE, rgba);
      const file = `${id}.png`;
      fs.writeFileSync(path.join(outDir, file), png);
      const hash = crypto.createHash("sha256").update(png).digest("hex").slice(0, 8);
      manifest.images[`mob.${id}`] = { src: `assets/mobs/${file}?v=${hash}`, w: SIZE, h: SIZE };
      totalBytes += png.length;
      previews.push({ id, rgba });
    }
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Installed ${previews.length} boss sprites (${(totalBytes / 1024).toFixed(1)} KB).`);

if (contactOut && previews.length) {
  const Z = 2, cell = (SIZE + 8) * Z, pad = 8, cols = 4, rows = Math.ceil(previews.length / cols);
  const W = cols * (cell + pad) + pad, H = rows * (cell + pad) + pad;
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { buf[i * 4] = 26; buf[i * 4 + 1] = 22; buf[i * 4 + 2] = 36; buf[i * 4 + 3] = 255; }
  previews.forEach((p, idx) => {
    const col = idx % cols, row = Math.floor(idx / cols);
    const bx = pad + col * (cell + pad), by = pad + row * (cell + pad);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const di = ((by + y) * W + (bx + x)) * 4;
      const b = x === 0 || y === 0 || x === cell - 1 || y === cell - 1;
      buf[di] = b ? 84 : 42; buf[di + 1] = b ? 70 : 36; buf[di + 2] = b ? 112 : 56; buf[di + 3] = 255;
    }
    const ox = bx + 4 * Z, oy = by + 4 * Z;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const si = (y * SIZE + x) * 4;
      if (p.rgba[si + 3] < 128) continue;
      for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) {
        const di = ((oy + y * Z + zy) * W + (ox + x * Z + zx)) * 4;
        buf[di] = p.rgba[si]; buf[di + 1] = p.rgba[si + 1]; buf[di + 2] = p.rgba[si + 2]; buf[di + 3] = 255;
      }
    }
  });
  fs.writeFileSync(contactOut, encodePng(W, H, buf));
  console.log("Saved boss contact sheet:", contactOut);
}
