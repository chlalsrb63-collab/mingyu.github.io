// Extracts 4x2 mythic avatar weapon skin sheets (top row = kindA, bottom row = kindB; cols = 4 motifs)
// into BOTH 32x32 bag/shop icons (`icon.weapon.<kind>.skin.<motif>`) AND horizontal held sprites (`weapon.<kind>.skin.<motif>`).
// Usage: node .agents/skills/tales-tales-pixel-art/scripts/install-weapon-skins.mjs <sheet.jpg> <row0Kind> <row1Kind> <m0,m1,m2,m3> [contact.png]

import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { execFileSync } from "child_process";

const HELD_SPEC = {
  sword:  { W: 44, H: 32, x0: 1, maxW: 41, maxH: 26, rot: 45,  oy: 16 },
  dagger: { W: 32, H: 32, x0: 1, maxW: 24, maxH: 20, rot: 45,  oy: 16 },
  spear:  { W: 52, H: 32, x0: 1, maxW: 49, maxH: 24, rot: 45,  oy: 16 },
  hammer: { W: 40, H: 36, x0: 1, maxW: 37, maxH: 30, rot: 45,  oy: 16 },
  staff:  { W: 32, H: 32, x0: 1, maxW: 30, maxH: 22, rot: 45,  oy: 16 },
  book:   { W: 32, H: 32, x0: -1, maxW: 20, maxH: 20, rot: 0,  oy: 16 },
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

function isMagenta(r, g, b, tol = 58) {
  return g < 95 && r > 175 && b > 175 && (r - g) > tol && (b - g) > tol && Math.abs(r - b) < 75;
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
      rgba[di] = bgra[si + 2]; rgba[di + 1] = bgra[si + 1]; rgba[di + 2] = bgra[si]; rgba[di + 3] = bgra[si + 3];
    }
  }
  const bg = new Uint8Array(cw * ch);
  const q = [];
  const tryPush = (x, y) => {
    const idx = y * cw + x;
    if (bg[idx]) return;
    const di = idx * 4;
    if (rgba[di + 3] < 20 || isMagenta(rgba[di], rgba[di + 1], rgba[di + 2], 42)) { bg[idx] = 1; q.push(idx); }
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
    if (bg[i]) rgba[i * 4 + 3] = 0;
  }
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
  const rad = (deg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const { w, h, rgba } = src;
  const nw = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin));
  const nh = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos));
  const out = Buffer.alloc(nw * nh * 4);
  const cx = w / 2, cy = h / 2, ncx = nw / 2, ncy = nh / 2;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const dx = x - ncx, dy = y - ncy;
      const sx = Math.round(dx * cos + dy * sin + cx), sy = Math.round(-dx * sin + dy * cos + cy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = (sy * w + sx) * 4;
      if (rgba[si + 3] < 128) continue;
      const di = (y * nw + x) * 4;
      out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = 255;
    }
  }
  return { w: nw, h: nh, rgba: out };
}

function pixelSnap(src, W, H, maxW, maxH, x0, oyCenter) {
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
  const scale = Math.min(maxW / bw, maxH / bh);
  const tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
  const ox = x0 < 0 ? Math.floor((W - tw) / 2) : x0;
  const oy = Math.max(1, Math.min(H - th - 1, Math.round(oyCenter - th / 2)));
  const out = Buffer.alloc(W * H * 4);
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
      if (opaque * 2.6 >= total && samples.length) {
        samples.sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
        const pick = samples[Math.floor(samples.length * 0.45)];
        const dx = ox + x, dy = oy + y;
        if (dx >= 0 && dx < W && dy >= 0 && dy < H) {
          const di = (dy * W + dx) * 4;
          out[di] = pick[0]; out[di + 1] = pick[1]; out[di + 2] = pick[2]; out[di + 3] = 255;
        }
      }
    }
  }
  return out;
}

const [sheetPath, row0Kind, row1Kind, motifList, contactOut] = process.argv.slice(2);
if (!sheetPath || !row0Kind || !row1Kind || !motifList) {
  console.error("Usage: node install-weapon-skins.mjs <sheet.jpg> <row0Kind> <row1Kind> <m0,m1,m2,m3> [contact.png]");
  process.exit(1);
}
const motifs = motifList.split(",");
const kinds = [row0Kind, row1Kind];
const sheet = decodeImage(sheetPath);
const outDir = path.join("game", "public", "assets", "weapons", "skins");
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join("game", "public", "assets", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.images = manifest.images || {};

const previews = [];
let totalBytes = 0;
for (let r = 0; r < 2; r++) {
  const kind = kinds[r];
  const spec = HELD_SPEC[kind];
  for (let c = 0; c < motifs.length; c++) {
    const motif = motifs[c];
    const cell = extractCellRgba(sheet, c, r, motifs.length, 2);
    // 1. 32x32 icon
    const iconRgba = pixelSnap(cell, 32, 32, 28, 28, -1, 16);
    const iconPng = encodePng(32, 32, iconRgba);
    const iconFile = `${kind}_skin_${motif}.png`;
    fs.writeFileSync(path.join(outDir, iconFile), iconPng);
    const ih = crypto.createHash("sha256").update(iconPng).digest("hex").slice(0, 8);
    manifest.images[`icon.weapon.${kind}.skin.${motif}`] = { src: `assets/weapons/skins/${iconFile}?v=${ih}`, w: 32, h: 32 };
    totalBytes += iconPng.length;

    // 2. Held world sprite
    const rot = rotateRgba(cell, spec.rot);
    const heldRgba = pixelSnap(rot, spec.W, spec.H, spec.maxW, spec.maxH, spec.x0, spec.oy);
    const heldPng = encodePng(spec.W, spec.H, heldRgba);
    const heldFile = `${kind}_skin_${motif}_held.png`;
    fs.writeFileSync(path.join(outDir, heldFile), heldPng);
    const hh = crypto.createHash("sha256").update(heldPng).digest("hex").slice(0, 8);
    manifest.images[`weapon.${kind}.skin.${motif}`] = { src: `assets/weapons/skins/${heldFile}?v=${hh}`, w: spec.W, h: spec.H };
    totalBytes += heldPng.length;

    previews.push({ r, c, iconRgba, heldRgba, W: spec.W, H: spec.H });
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Installed ${previews.length} weapon skin icons + ${previews.length} held sprites (${(totalBytes / 1024).toFixed(1)} KB).`);

if (contactOut) {
  const Z = 3, cellW = 52 * Z, cellH = 38 * Z, pad = 6;
  const W = 4 * (cellW + pad) + pad, H = 4 * (cellH + pad) + pad; // 2 rows icons + 2 rows held
  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { buf[i * 4] = 32; buf[i * 4 + 1] = 28; buf[i * 4 + 2] = 44; buf[i * 4 + 3] = 255; }
  const blit = (row, col, rgba, sw, sh) => {
    const bx = pad + col * (cellW + pad), by = pad + row * (cellH + pad);
    for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) {
      const di = ((by + y) * W + (bx + x)) * 4;
      const b = x === 0 || y === 0 || x === cellW - 1 || y === cellH - 1;
      buf[di] = b ? 80 : 48; buf[di + 1] = b ? 70 : 42; buf[di + 2] = b ? 105 : 64; buf[di + 3] = 255;
    }
    const ox = bx + Math.floor((cellW - sw * Z) / 2), oy = by + Math.floor((cellH - sh * Z) / 2);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const si = (y * sw + x) * 4;
      if (rgba[si + 3] < 128) continue;
      for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) {
        const di = ((oy + y * Z + zy) * W + (ox + x * Z + zx)) * 4;
        buf[di] = rgba[si]; buf[di + 1] = rgba[si + 1]; buf[di + 2] = rgba[si + 2]; buf[di + 3] = 255;
      }
    }
  };
  for (const p of previews) {
    blit(p.r, p.c, p.iconRgba, 32, 32);
    blit(p.r + 2, p.c, p.heldRgba, p.W, p.H);
  }
  fs.writeFileSync(contactOut, encodePng(W, H, buf));
  console.log(`Saved skin contact sheet: ${contactOut}`);
}
