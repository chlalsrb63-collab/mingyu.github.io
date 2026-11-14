// Shared helpers for the art scripts (shot.mjs, export-art.mjs, gallery.mjs, import-art.mjs):
// paths, starting a headless browser, a tiny static file server and a dependency-free
// PNG reader/writer (RGBA, 8 bits per channel). Pure node; works on Windows.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync, deflateSync } from "node:zlib";

export const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC = join(GAME, "public");
export const REPO = join(GAME, "..");
export const ASSET = join(REPO, "asset");

/** Parse `--key value` / `--flag` arguments; bare words go to `_`. */
export function args(argv = process.argv.slice(2)) {
  const opt = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { opt._.push(a); continue; }
    const k = a.slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) opt[k] = true;
    else { opt[k] = v; i++; }
  }
  return opt;
}

// ───────────────────────────── browser ─────────────────────────────

/**
 * A headless Chromium: Playwright's own (npx playwright install chromium) or, failing
 * that, an installed Edge or Chrome. `channel` forces one ("msedge", "chrome").
 */
export async function launch(channel) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright is not installed. In game/: npm install   (then once: npx playwright install chromium)");
    process.exit(2);
  }
  const tries = channel ? [{ channel: String(channel) }] : [{}, { channel: "msedge" }, { channel: "chrome" }];
  let last;
  for (const t of tries) {
    try { return await chromium.launch({ headless: true, ...t }); } catch (e) { last = e; }
  }
  console.error("No browser could be started. Run once: npx playwright install chromium\n" + String(last && last.message).split("\n")[0]);
  process.exit(2);
}

// ───────────────────────────── static server ─────────────────────────────

export const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };

/**
 * Serve `dir` on 127.0.0.1 (port 0 = any free port). `extra` maps a path to a
 * string body (virtual pages that are not files).
 */
export function serve(dir, port = 0, extra = {}) {
  const srv = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (extra[path] !== undefined) {
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(extra[path]);
      return;
    }
    const file = normalize(join(dir, path === "/" ? "index.html" : path));
    if (!file.startsWith(dir + sep)) { res.writeHead(403).end(); return; }
    try {
      if (!(await stat(file)).isFile()) throw new Error("not a file");
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok(srv)));
}

// ───────────────────────────── PNG ─────────────────────────────

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Width and height from a PNG's header, or null if it is not a PNG. */
export function pngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIG)) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * Decode a PNG into { w, h, data: Uint8Array RGBA }. Handles 8- and 16-bit grey,
 * grey+alpha, RGB, RGBA and 8-bit palette images (with tRNS), not interlaced.
 * Throws on anything else — then decode in the browser instead (decodeInBrowser).
 */
export function readPng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let p = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString("latin1", p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (kind === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === "PLTE") plte = body;
    else if (kind === "tRNS") trns = body;
    else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
    p += 12 + len;
  }
  if (interlace) throw new Error("interlaced PNG");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!ch || (depth !== 8 && depth !== 16) || (type === 3 && depth !== 8)) throw new Error(`PNG type ${type} depth ${depth} not supported here`);
  const bpp = (ch * depth) / 8, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const cur = new Uint8Array(stride), prev = new Uint8Array(stride);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = (k) => cur[x * bpp + k * (depth / 8)]; // the high byte of a 16-bit sample
      const o = (y * w + x) * 4;
      let r, g, bl, al = 255;
      if (type === 0) { r = g = bl = s(0); if (trns && depth === 8 && trns.readUInt16BE(0) === r) al = 0; }
      else if (type === 4) { r = g = bl = s(0); al = s(1); }
      else if (type === 2) { r = s(0); g = s(1); bl = s(2); if (trns && depth === 8 && trns.readUInt16BE(0) === r && trns.readUInt16BE(2) === g && trns.readUInt16BE(4) === bl) al = 0; }
      else if (type === 6) { r = s(0); g = s(1); bl = s(2); al = s(3); }
      else { const i = cur[x]; r = plte[i * 3]; g = plte[i * 3 + 1]; bl = plte[i * 3 + 2]; al = trns && i < trns.length ? trns[i] : 255; }
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al;
    }
    prev.set(cur);
  }
  return { w, h, data: out };
}

/** Encode { w, h, data: RGBA } as a PNG buffer. */
export function writePng({ w, h, data }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const chunk = (kind, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const kb = Buffer.from(kind, "latin1"), crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([kb, body])));
    return Buffer.concat([len, kb, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** A data: URL → Buffer. */
export const dataUrlBuffer = (u) => Buffer.from(u.slice(u.indexOf(",") + 1), "base64");

/** Decode any image the browser understands (JPEG, WebP, GIF, odd PNGs) into RGBA. */
export async function decodeInBrowser(buf, mime = "image/png", channel) {
  const browser = await launch(channel);
  try {
    const pg = await browser.newPage();
    const r = await pg.evaluate(async ([b64, type]) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type }), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
      const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext("2d");
      g.drawImage(bmp, 0, 0);
      const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
      let s = ""; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
      return { w: bmp.width, h: bmp.height, b64: btoa(s) };
    }, [buf.toString("base64"), mime]);
    return { w: r.w, h: r.h, data: new Uint8Array(Buffer.from(r.b64, "base64")) };
  } finally { await browser.close(); }
}
