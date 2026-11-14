// A tiny canvas for node: just enough of HTMLCanvasElement / CanvasRenderingContext2D
// for the code-drawn pixel art (sprites.js, species.js, wardrobe.js) to run outside
// a browser — whole-pixel rects in solid colours, image data, nearest-neighbour
// drawImage. Used by tests/cosmetics.mjs and scripts/cos-audit.mjs.
//
//   import { installCanvas } from "../scripts/pixcanvas.mjs";
//   installCanvas();                 // sets globalThis.document (createElement("canvas"))
//   const SP = await import("../public/sprites.js");
//
// Not a general canvas: paths fill nothing, transforms and text are ignored. Pixel art that
// only uses fillRect / clearRect / get/putImageData / drawImage renders exactly as in Chrome
// (with imageSmoothingEnabled = false).

function parseColour(c) {
  if (typeof c !== "string") return [0, 0, 0, 255];
  c = c.trim();
  if (c[0] === "#") {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  return [0, 0, 0, 255];
}

class ImageDataLike {
  constructor(w, h, data) { this.width = w; this.height = h; this.data = data || new Uint8ClampedArray(w * h * 4); }
}

class Ctx {
  constructor(cv) {
    this.canvas = cv;
    this._fill = [0, 0, 0, 255];
    this._fs = "#000000";
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = false;
    this.strokeStyle = "#000"; this.lineWidth = 1; this.font = ""; this.globalCompositeOperation = "source-over";
  }
  set fillStyle(v) { this._fs = v; this._fill = parseColour(v); }
  get fillStyle() { return this._fs; }
  /** Source-over one pixel. */
  _put(x, y, r, g, b, a) {
    const W = this.canvas.width, H = this.canvas.height;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    a = a * this.globalAlpha;
    if (a <= 0) return;
    const d = this.canvas._data, i = (y * W + x) * 4;
    if (a >= 255) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    const sa = a / 255, da = d[i + 3] / 255, oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(([r, g, b][k] * sa + d[i + k] * da * (1 - sa)) / oa);
    d[i + 3] = Math.round(oa * 255);
  }
  _rect(x, y, w, h) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    // canvas covers pixel centres inside the rect
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    return [x0, y0, x1, y1];
  }
  fillRect(x, y, w, h) {
    const [x0, y0, x1, y1] = this._rect(x, y, w, h);
    const [r, g, b, a] = this._fill;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this._put(xx, yy, r, g, b, a);
  }
  clearRect(x, y, w, h) {
    const [x0, y0, x1, y1] = this._rect(x, y, w, h);
    const W = this.canvas.width, H = this.canvas.height, d = this.canvas._data;
    for (let yy = Math.max(0, y0); yy < Math.min(H, y1); yy++) for (let xx = Math.max(0, x0); xx < Math.min(W, x1); xx++) d.fill(0, (yy * W + xx) * 4, (yy * W + xx) * 4 + 4);
  }
  getImageData(x, y, w, h) {
    const W = this.canvas.width, H = this.canvas.height, d = this.canvas._data;
    if (x === 0 && y === 0 && w === W && h === H) return new ImageDataLike(w, h, d.slice());
    const out = new ImageDataLike(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const sx = x + xx, sy = y + yy;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const i = (sy * W + sx) * 4, o = (yy * w + xx) * 4;
      out.data[o] = d[i]; out.data[o + 1] = d[i + 1]; out.data[o + 2] = d[i + 2]; out.data[o + 3] = d[i + 3];
    }
    return out;
  }
  createImageData(w, h) { return typeof w === "object" ? new ImageDataLike(w.width, w.height) : new ImageDataLike(w, h); }
  putImageData(img, x, y) {
    const W = this.canvas.width, H = this.canvas.height, d = this.canvas._data;
    if (x === 0 && y === 0 && img.width === W && img.height === H) { d.set(img.data); return; }
    for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) {
      const tx = x + xx, ty = y + yy;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const i = (ty * W + tx) * 4, o = (yy * img.width + xx) * 4;
      d[i] = img.data[o]; d[i + 1] = img.data[o + 1]; d[i + 2] = img.data[o + 2]; d[i + 3] = img.data[o + 3];
    }
  }
  drawImage(src, ...a) {
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; }
    else if (a.length === 4) { [dx, dy, dw, dh] = a; }
    else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    const sd = src._data || (src.data && src.data), SW = src.width, SH = src.height;
    if (!sd || dw === 0 || dh === 0) return;
    // the common case: a same-size sheet laid over another, opaque pixels only
    if (sx === 0 && sy === 0 && dx === 0 && dy === 0 && sw === SW && sh === SH && dw === SW && dh === SH && SW === this.canvas.width && SH === this.canvas.height && this.globalAlpha === 1) {
      const d = this.canvas._data;
      for (let i = 0; i < sd.length; i += 4) {
        const a = sd[i + 3];
        if (!a) continue;
        if (a === 255) { d[i] = sd[i]; d[i + 1] = sd[i + 1]; d[i + 2] = sd[i + 2]; d[i + 3] = 255; }
        else this._put((i >> 2) % SW, Math.floor((i >> 2) / SW), sd[i], sd[i + 1], sd[i + 2], a);
      }
      return;
    }
    const [x0, y0, x1, y1] = this._rect(dx, dy, dw, dh);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const u = Math.floor(sx + ((xx + 0.5 - dx) / dw) * sw), v = Math.floor(sy + ((yy + 0.5 - dy) / dh) * sh);
      if (u < 0 || v < 0 || u >= SW || v >= SH) continue;
      const i = (v * SW + u) * 4;
      if (sd[i + 3]) this._put(xx, yy, sd[i], sd[i + 1], sd[i + 2], sd[i + 3]);
    }
  }
  // paths, transforms, text: accepted and ignored
  save() {} restore() {} translate() {} scale() {} rotate() {} setTransform() {} resetTransform() {}
  beginPath() {} closePath() {} moveTo() {} lineTo() {} arc() {} ellipse() {} rect() {} quadraticCurveTo() {} bezierCurveTo() {}
  fill() {} stroke() {} clip() {} fillText() {} strokeText() {}
  measureText(s) { return { width: String(s).length * 6 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
}

export class PixCanvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this._buf = null; this._ctx = null; }
  /** The RGBA pixels, allocated on first use (setting a size clears them, as in a browser). */
  get _data() { return this._buf || (this._buf = new Uint8ClampedArray(this._w * this._h * 4)); }
  get width() { return this._w; }
  set width(v) { this._w = v | 0; this._buf = null; }
  get height() { return this._h; }
  set height(v) { this._h = v | 0; this._buf = null; }
  getContext() { return this._ctx || (this._ctx = new Ctx(this)); }
}

/** Make `document.createElement("canvas")` return a PixCanvas (only when there is no real DOM). */
export function installCanvas() {
  if (globalThis.document && globalThis.document.createElement && !globalThis.document.__pix) return;
  globalThis.document = { __pix: true, createElement: (t) => (t === "canvas" ? new PixCanvas() : {}) };
  globalThis.OffscreenCanvas = PixCanvas;
}

/** RGBA pixels of a canvas as { w, h, data } (for artkit.writePng). */
export const pixels = (c) => ({ w: c.width, h: c.height, data: Buffer.from(c._data.buffer.slice(0)) });
