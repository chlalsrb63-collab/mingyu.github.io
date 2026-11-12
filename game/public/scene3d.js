/**
 * The 3D world.
 *
 * Everything the player sees of the world is built here from simple solids —
 * no model files. The camera is orthographic and locked to a classic
 * three-quarter view, so the grid's axes run along the screen's diagonals
 * exactly as they did in 2D; the rules, the server and the controls are
 * untouched. What 3D adds is what is hardest to draw by hand: real light,
 * cast shadows, glow, depth and continuous motion.
 *
 * Units: one tile is one world unit. The server speaks in sixteenths of a tile
 * (`wx`, `wy`); x stays x and the server's y becomes z.
 */

import * as THREE from "./vendor/three.min.js";

const U = 1 / 16;
const V3 = THREE.Vector3;
const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

let renderer, scene, camera, root, sun, hemi, fill, canvas;
let viewH = 13, W = 1, H = 1;
const target = new V3(), camOff = new V3(20, 17, 20);
let shakeAmt = 0;
let mapData = null;
const lampSpots = [], lampPool = [];
let torch = null;

// ───────────────────────────── materials ─────────────────────────────

const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
const matCache = new Map();
/** A cel-shaded material, shared by colour. */
function M(color, opt) {
  const key = color + (opt ? JSON.stringify(opt) : "");
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...opt }); matCache.set(key, m); }
  return m;
}
const glowMat = (color, k = 1.4) => M(color, { emissive: color, emissiveIntensity: k });
function tone(hex, f) {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f); else c.lerp(new THREE.Color("#ffffff"), f - 1);
  return "#" + c.getHexString();
}

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 18, 14),
  low: new THREE.IcosahedronGeometry(1, 1),
  rock: new THREE.DodecahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cap: new THREE.CapsuleGeometry(1, 1, 6, 16),
  pyr: new THREE.ConeGeometry(1.4142, 1, 4).rotateY(Math.PI / 4),
  half: new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  ring: new THREE.RingGeometry(0.86, 1, 40),
  disc: new THREE.CircleGeometry(1, 32),
  tor: new THREE.TorusGeometry(1, 0.12, 8, 24),
};
/** A mesh with position and scale in one call. */
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function group(...kids) {
  const g = new THREE.Group();
  for (const k of kids) if (k) g.add(k);
  return g;
}

// ───────────────────────────── setup ─────────────────────────────

/** Per-world light: [background, sky, ground, hemisphere, sun colour, sun strength, lamps lit]. */
const MOOD = {
  town: ["#93b4c9", "#ffe9c8", "#7a6a58", 1.15, "#ffd49a", 2.6, false],
  meadow: ["#9cc6d8", "#eaf4ff", "#7c8a5c", 1.25, "#fff1d0", 2.6, false],
  forest: ["#39564e", "#bfe0d0", "#3c4a3a", 0.85, "#d8f0c0", 1.5, false],
  city: ["#0d1126", "#5868b0", "#20222e", 0.55, "#8ea0ff", 0.7, true],
  cave: ["#0b0916", "#6a5ca8", "#201a30", 0.5, "#a090ff", 0.45, true],
  show: ["#141826", "#cfd8ff", "#2a2a3a", 0.9, "#ffd9a8", 2.2, true],
};

export function init(cv) {
  canvas = cv;
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  hemi = new THREE.HemisphereLight("#ffffff", "#666666", 1);
  sun = new THREE.DirectionalLight("#ffffff", 2);
  sun.castShadow = true;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  fill = new THREE.DirectionalLight("#8aa0ff", 0.35);
  scene.add(hemi, sun, sun.target, fill);
  for (let i = 0; i < 6; i++) { const l = new THREE.PointLight("#ffd890", 0, 7, 1.6); lampPool.push(l); scene.add(l); }
  torch = new THREE.PointLight("#ffe2b0", 0, 6, 1.4);
  scene.add(torch);
  particles.init();
  resize();
}

export function resize() {
  if (!renderer) return;
  W = innerWidth; H = innerHeight;
  const touch = document.body.classList.contains("touch");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.setSize(W, H, false);
  const s = touch ? 1024 : 2048;
  if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  // show roughly the same amount of world on any screen
  viewH = W < H ? 13 : Math.max(8.5, Math.min(10.5, 10.5 * (H / 760)));
  const a = W / H;
  camera.left = (-viewH * a) / 2; camera.right = (viewH * a) / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
  const r = Math.max(viewH * a, viewH) * 0.75 + 4;
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 80 });
  sun.shadow.camera.updateProjectionMatrix();
}

function setMood(id) {
  const [bg, sky, ground, hk, sc, sk, lamps] = MOOD[id] || MOOD.meadow;
  scene.background = new THREE.Color(bg);
  hemi.color.set(sky); hemi.groundColor.set(ground); hemi.intensity = hk;
  sun.color.set(sc); sun.intensity = sk;
  scene.userData.lamps = lamps;
  torch.intensity = lamps ? 5 : 0;
}

function clearRoot() {
  if (root) { scene.remove(root); root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); }); }
  root = new THREE.Group();
  scene.add(root);
  for (const m of [figures, mobs, drops]) { for (const e of m.values()) scene.remove(e.group); m.clear(); }
  lampSpots.length = 0;
  fx.clear();
}

// ───────────────────────────── terrain ─────────────────────────────

const TILE_COL = {
  ".": "#86b46c", ",": "#86b46c", '"': "#86b46c", ":": "#5f9468", ";": "#5f9468", p: "#d6bf94", o: "#bdb6aa", s: "#e8d9ac",
  w: "#4a8cc0", b: "#a67c4e", c: "#6a6482", d: "#5f5a76", a: "#4c505b", m: "#4c505b", k: "#989ca6",
};
const TILE_Y = { w: -0.22, k: 0.06, b: 0.03 };

/** Collects transforms per kind, then builds one instanced mesh for each. */
function batcher() {
  const lists = new Map();
  const tmp = new THREE.Object3D();
  return {
    add(key, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, color = null, rx = 0) {
      let l = lists.get(key);
      if (!l) { l = { geo, mat, m: [], c: [] }; lists.set(key, l); }
      tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, 0); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
      l.m.push(tmp.matrix.clone());
      l.c.push(color);
    },
    build(parent, shadows = true) {
      for (const l of lists.values()) {
        const im = new THREE.InstancedMesh(l.geo, l.mat, l.m.length);
        l.m.forEach((m, i) => { im.setMatrixAt(i, m); if (l.c[i]) im.setColorAt(i, new THREE.Color(l.c[i])); });
        im.castShadow = shadows; im.receiveShadow = true;
        parent.add(im);
      }
    },
  };
}

const ROOF = ["#c85a48", "#5a7fc0", "#5a9a66", "#9068b8"];
const BLD = [["#6a7080", "#ff5a94"], ["#7a6458", "#5ae4e4"], ["#5a6678", "#ffd24a"], ["#6a5a7c", "#7aff8a"]];
const CAR = ["#b04248", "#4a72b0", "#d8d8dc", "#3c3e46", "#c8a038"];

export function loadMap(m) {
  mapData = m;
  clearRoot();
  setMood(m.id);
  const B = batcher();
  const white = M("#ffffff");

  // ── the ground: one quad per tile, coloured by its type with a little variation
  const pos = [], col = [], c = new THREE.Color();
  const quad = (x, z, y, hex, k) => {
    c.set(hex).multiplyScalar(k);
    pos.push(x, y, z, x, y, z + 1, x + 1, y, z + 1, x, y, z, x + 1, y, z + 1, x + 1, y, z);
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
  };
  const dark = m.id === "cave" || m.id === "city";
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.g[y][x], o = m.o[y][x];
    if (ch === "W") continue;
    const k = 0.94 + hash(x, y, 1) * 0.1 + ((x + y) % 2 ? 0.015 : 0);
    quad(x, y, TILE_Y[ch] || 0, TILE_COL[ch] || "#888", k);
    const cx = x + 0.5, cz = y + 0.5, r = hash(x, y, 2), r2 = hash(x, y, 3);
    if (ch === "m") B.add("lane", GEO.box, M("#d8b848"), cx, 0.012, cz, 0.7, 0.01, 0.1);
    if (ch === "k" && m.g[y + 1] && "am".includes(m.g[y + 1][x])) B.add("curb", GEO.box, M("#7c8088"), cx, 0.03, y + 0.98, 1, 0.06, 0.05);
    if ((ch === "," || ch === ";") && o === " ") {
      for (let i = 0; i < 3; i++) B.add("tuft", GEO.cone4, M(ch === "," ? "#6c9a56" : "#4c7c56"), x + hash(x, y, 10 + i), 0.09, y + hash(x, y, 20 + i), 0.05, 0.2, 0.05, r * 6);
    }
    if (ch === '"' && o === " ") {
      for (let i = 0; i < 3; i++) B.add("flower", GEO.low, white, x + 0.15 + hash(x, y, 30 + i) * 0.7, 0.09, y + 0.15 + hash(x, y, 40 + i) * 0.7, 0.06, 0.06, 0.06, 0, ["#fff2a8", "#ffffff", "#f0a0c0", "#f4c860"][Math.floor(hash(x, y, 50 + i) * 4)]);
    }
    // ── things that stand on the tile
    const s = 0.85 + r * 0.3, ry = r2 * 6.28;
    if (o === "T") {
      B.add("trunk", GEO.cyl6, M("#7a5234"), cx, 0.5 * s, cz, 0.13 * s, 1 * s, 0.13 * s);
      B.add("leaf", GEO.low, M("#5c9e52", { flatShading: true }), cx, 1.5 * s, cz, 0.78 * s, 0.7 * s, 0.78 * s, ry);
      B.add("leaf2", GEO.low, M("#77b866", { flatShading: true }), cx - 0.22 * s, 2.02 * s, cz + 0.12 * s, 0.5 * s, 0.46 * s, 0.5 * s, ry);
    } else if (o === "P") {
      B.add("trunk", GEO.cyl6, M("#6a4630"), cx, 0.35 * s, cz, 0.1 * s, 0.7 * s, 0.1 * s);
      for (let i = 0; i < 3; i++) B.add("pine" + i, GEO.cone, M(["#34704c", "#3c7e56", "#46905f"][i], { flatShading: true }), cx, (0.95 + i * 0.62) * s, cz, (0.66 - i * 0.16) * s, 0.95 * s, (0.66 - i * 0.16) * s, ry);
    } else if (o === "B") {
      B.add("bush", GEO.low, M("#4f8f4a", { flatShading: true }), cx, 0.26, cz, 0.42, 0.32, 0.42, ry);
      for (let i = 0; i < 3; i++) B.add("berry", GEO.low, M("#d84a5a"), cx + Math.cos(ry + i * 2) * 0.3, 0.36, cz + Math.sin(ry + i * 2) * 0.3, 0.05);
    } else if (o === "R") {
      B.add("rock", GEO.rock, M("#9a9aa4", { flatShading: true }), cx, 0.2, cz, 0.4 * s, 0.28 * s, 0.36 * s, ry);
    } else if (o === "F") {
      B.add("post", GEO.box, M("#a8814e"), cx - 0.35, 0.3, cz, 0.09, 0.6, 0.09); B.add("post", GEO.box, M("#a8814e"), cx + 0.35, 0.3, cz, 0.09, 0.6, 0.09);
      B.add("rail", GEO.box, M("#c09a62"), cx, 0.42, cz, 1, 0.07, 0.05); B.add("rail", GEO.box, M("#c09a62"), cx, 0.2, cz, 1, 0.07, 0.05);
    } else if (o === "L") {
      B.add("pole", GEO.cyl6, M("#3c3e4a"), cx, 1.05, cz, 0.045, 2.1, 0.045);
      B.add("polefoot", GEO.cyl6, M("#3c3e4a"), cx, 0.06, cz, 0.13, 0.12, 0.13);
      B.add("lantern", GEO.box, glowMat("#ffe6a0", scene.userData.lamps ? 2.4 : 0.9), cx, 2.2, cz, 0.24, 0.3, 0.24);
      B.add("lampcap", GEO.pyr, M("#3c3e4a"), cx, 2.43, cz, 0.17, 0.16, 0.17);
      lampSpots.push([cx, 2.1, cz, "#ffd890", 9]);
    } else if (o === "G") {
      B.add("post", GEO.box, M("#8a6238"), cx, 0.3, cz, 0.08, 0.6, 0.08);
      B.add("board", GEO.box, M("#c9a468"), cx, 0.62, cz, 0.6, 0.34, 0.06, Math.PI / 4);
    } else if (o === "K") {
      const purple = hash(x, y, 7) > 0.6, cc = purple ? "#b98af0" : "#6ae0f0";
      B.add(purple ? "crysP" : "crysC", GEO.oct, M(cc, { emissive: cc, emissiveIntensity: 1.1, flatShading: true }), cx, 0.42, cz, 0.2, 0.62, 0.2, ry);
      B.add(purple ? "crysP" : "crysC", GEO.oct, M(cc, { emissive: cc, emissiveIntensity: 1.1, flatShading: true }), cx + 0.22, 0.24, cz - 0.1, 0.13, 0.36, 0.13, ry + 1);
      lampSpots.push([cx, 0.6, cz, cc, 5]);
    } else if (o === "S") {
      B.add("stal", GEO.cone, M("#7a7494", { flatShading: true }), cx, 0.45 * s, cz, 0.26 * s, 0.9 * s, 0.26 * s, ry);
    } else if (o === "Z") {
      B.add("brick", GEO.box, M("#3a3d4a"), cx, 1.3, cz, 1, 2.6, 1);
    } else if (o === "c") {
      const cc = CAR[Math.floor(hash(x, y, 3) * CAR.length)];
      B.add("carbody", GEO.box, white, x + 1, 0.36, cz, 1.8, 0.36, 0.82, 0, cc);
      B.add("carcab", GEO.box, M("#26303c"), x + 0.92, 0.7, cz, 0.95, 0.34, 0.72);
      B.add("carroof", GEO.box, white, x + 0.92, 0.89, cz, 0.9, 0.05, 0.7, 0, cc);
      for (const [dx, dz] of [[0.45, 0.42], [1.55, 0.42], [0.45, -0.42], [1.55, -0.42]]) B.add("wheel", GEO.cyl, M("#17181c"), x + dx, 0.17, cz + dz, 0.17, 0.12, 0.17, 0, null, Math.PI / 2);
      B.add("headl", GEO.box, glowMat("#fff0b0", 1.6), x + 1.91, 0.38, cz, 0.03, 0.1, 0.6);
      B.add("taill", GEO.box, glowMat("#ff4040", 1.2), x + 0.09, 0.38, cz, 0.03, 0.08, 0.6);
    } else if (o === "y") {
      B.add("hyd", GEO.cyl, M("#c04040"), cx, 0.22, cz, 0.11, 0.44, 0.11); B.add("hydcap", GEO.sph, M("#d85858"), cx, 0.46, cz, 0.12, 0.08, 0.12);
    } else if (o === "x") {
      B.add("bin", GEO.cyl, M("#5a5e68"), cx, 0.27, cz, 0.2, 0.54, 0.2); B.add("binlid", GEO.cyl, M("#6e727c"), cx, 0.56, cz, 0.23, 0.05, 0.23);
    }
  }
  // cave walls: every wall tile that borders open floor becomes a block of rock
  if (m.g.some((r) => r.includes("W"))) {
    const open = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.g[y][x] !== "W";
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.g[y][x] !== "W") continue;
      let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) if (open(x + dx, y + dy)) { edge = true; break; }
      if (!edge) continue;
      const hgt = 1.3 + hash(x, y, 5) * 0.9;
      B.add("wall", GEO.box, M("#4a4462", { flatShading: true }), x + 0.5, hgt / 2, y + 0.5, 1, hgt, 1, 0, tone("#4a4462", 0.9 + hash(x, y, 6) * 0.25));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  root.add(ground);
  // the slab the whole map sits on, so its edges read as a cut diorama
  const slab = mesh(GEO.box, M(dark ? "#262432" : "#6e5c48"), m.w / 2, -0.9, m.h / 2, m.w, 1.5, m.h);
  slab.castShadow = false;
  root.add(slab);

  // ── buildings
  for (const b of m.big) {
    const cx = b.x + 2, cz = b.y + 1.5;
    if (b.t === "fountain") {
      const fx0 = b.x + 1, fz = b.y + 1;
      B.add("fbase", GEO.cyl, M("#b8b2a6"), fx0, 0.18, fz, 0.98, 0.36, 0.98);
      B.add("fwater", GEO.cyl, M("#5aa8e0", { emissive: "#2a6aa8", emissiveIntensity: 0.5 }), fx0, 0.33, fz, 0.82, 0.1, 0.82);
      B.add("fcol", GEO.cyl, M("#cfc9bd"), fx0, 0.7, fz, 0.12, 0.9, 0.12);
      B.add("fbowl", GEO.cyl, M("#cfc9bd"), fx0, 1.1, fz, 0.34, 0.1, 0.34);
      B.add("ftop", GEO.sph, M("#9fd4f4", { emissive: "#6ab0e0", emissiveIntensity: 0.6 }), fx0, 1.24, fz, 0.14);
    } else if (b.v < 4) {
      const roof = ROOF[b.v % 4];
      B.add("hwall", GEO.box, M("#efe2c6"), cx, 0.95, cz, 3.5, 1.9, 2.5);
      B.add("hbase", GEO.box, M("#a89a84"), cx, 0.15, cz, 3.6, 0.3, 2.6);
      B.add("hroof" + b.v, GEO.pyr, M(roof, { flatShading: true }), cx, 2.6, cz, 1.95, 1.5, 1.45);
      B.add("hbeam", GEO.box, M("#8a6238"), cx, 1.9, cz, 3.62, 0.12, 2.62);
      B.add("door", GEO.box, M("#7a5230"), cx + 0.2, 0.62, cz + 1.26, 0.62, 1.1, 0.06);
      B.add("knob", GEO.sph, glowMat("#ffd870", 0.8), cx + 0.4, 0.62, cz + 1.31, 0.04);
      for (const dx of [-1.05, 1.25]) B.add("win", GEO.box, glowMat("#ffd98a", 0.9), cx + dx, 1.1, cz + 1.26, 0.55, 0.55, 0.05);
      B.add("win", GEO.box, glowMat("#ffd98a", 0.9), cx + 1.76, 1.1, cz, 0.05, 0.55, 0.7);
      B.add("chim", GEO.box, M("#b0a090"), cx + 0.9, 2.9, cz - 0.4, 0.34, 0.9, 0.34);
    } else {
      const [wall, neon] = BLD[b.v % 4], hgt = 4.6 + (b.v % 3) * 0.8;
      B.add("bwall" + b.v, GEO.box, M(wall), cx, hgt / 2, cz, 3.5, hgt, 2.5);
      B.add("broof", GEO.box, M("#30323c"), cx, hgt + 0.08, cz, 3.7, 0.16, 2.7);
      B.add("bunit", GEO.box, M("#4a4e5a"), cx - 0.8, hgt + 0.36, cz - 0.3, 0.8, 0.4, 0.6);
      for (let r = 0; r < Math.floor(hgt - 1.6); r++) {
        for (let i = 0; i < 5; i++) {
          const lit = hash(b.x * 7 + i, b.y * 3 + r, 1) > 0.42, cc = lit ? (hash(i, r, b.x) > 0.5 ? "#ffd880" : "#a8e4ff") : "#232836";
          B.add(lit ? "bwinOn" : "bwinOff", GEO.box, lit ? M("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.9 }) : M("#232836"), cx - 1.4 + i * 0.7, 1.9 + r * 0.9, cz + 1.26, 0.42, 0.5, 0.04, 0, lit ? cc : null);
          if (i < 4) {
            const lit2 = hash(b.x * 5 + i, b.y * 9 + r, 2) > 0.5;
            B.add(lit2 ? "bwinOn" : "bwinOff", GEO.box, lit2 ? M("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.9 }) : M("#232836"), cx + 1.76, 1.9 + r * 0.9, cz - 0.9 + i * 0.6, 0.04, 0.5, 0.36, 0, lit2 ? "#ffd880" : null);
          }
        }
      }
      B.add("neon" + b.v, GEO.box, glowMat(neon, 2.2), cx, 1.32, cz + 1.3, 2.6, 0.22, 0.06);
      B.add("shut", GEO.box, M("#2a2e3a"), cx, 0.55, cz + 1.26, 1.1, 1.1, 0.05);
      lampSpots.push([cx, 1.3, cz + 1.9, neon, 7]);
    }
  }
  B.build(root);

  // ── gates between worlds
  for (const p of m.portals) {
    const ring = mesh(GEO.tor, glowMat("#b08aff", 2), p.x + 0.5, 0.08, p.y + 0.5, 0.42, 0.42, 0.42);
    ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    const beam = mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: "#b89cff", transparent: true, opacity: 0.22, depthWrite: false }), p.x + 0.5, 0.9, p.y + 0.5, 0.36, 1.8, 0.36);
    beam.castShadow = false;
    root.add(ring, beam);
    fx.spin.push(ring);
    lampSpots.push([p.x + 0.5, 0.8, p.y + 0.5, "#b08aff", 6]);
  }
  // ── townsfolk
  for (const n of m.npcs) {
    const f = human(npcLook(n));
    f.group.position.set(n.x + 0.5, 0, n.y + 0.75);
    f.group.rotation.y = Math.PI / 4;
    root.add(f.group);
    fx.idlers.push(f);
  }
}

// ───────────────────────────── people ─────────────────────────────

const HAIR = ["#7c5842", "#35353f", "#d6b66c", "#c26a4e", "#9684b4", "#e2e4ec"];
const SKIN = ["#f8dcc6", "#e8ba98", "#bc8866"];
export const SWATCH = { HAIR, SKIN };
/** Outfit by armour tier: [main, secondary, trim]. */
const OUTFIT = {
  warrior: [["#b8483c", "#98a0b0", "#e8c460"], ["#a0683e", "#a8b2c4", "#e8c460"], ["#4466b0", "#d8e0ee", "#f0d470"], ["#363c4a", "#6a7488", "#ff6a52"], ["#237c8c", "#a6eef4", "#f2ffff"]],
  rogue: [["#555b74", "#c84a5c", "#e0c888"], ["#6a5446", "#d87a38", "#e0c888"], ["#345a6e", "#5cc8b8", "#eaf6f0"], ["#2c2e3a", "#ea4868", "#c8ccd8"], ["#1f5666", "#7ef4e2", "#f2ffff"]],
  ranger: [["#66864e", "#f0e4c4", "#ccaa64"], ["#927248", "#f4ead0", "#ccaa64"], ["#5072a4", "#eef2f8", "#ecd070"], ["#363a46", "#d0d4dc", "#ffb44a"], ["#24828e", "#e2fcff", "#f2ffff"]],
  mage: [["#7464cc", "#f2ecff", "#f2d478"], ["#ac5496", "#ffeaf6", "#f2d478"], ["#4272c4", "#eaf6ff", "#f2d478"], ["#363260", "#c0b0ff", "#d0b0ff"], ["#22949e", "#eaffff", "#f2ffff"]],
};
const METAL = ["#b8bcc6", "#b8bcc6", "#dfe4ee", "#a8c8f4", "#7fe4ee", "#e49af8"];
const RARITY = [null, "#6aa8ff", "#ffd84a", "#ff8a30"];

function npcLook(n) {
  const col = n.look[3] || "#667";
  const base = { hair: n.look[0], skin: n.look[1], style: n.look[2], main: col, sub: tone(col, 1.3), trim: "#f0cc60", at: 1 };
  if (n.role === "elder") return { ...base, cls: "robe", beard: 1 };
  if (n.role === "smith") return { ...base, cls: "npc", apron: "#5c4e46" };
  if (n.role === "shop") return { ...base, cls: "npc", apron: "#fff4e4" };
  if (n.role === "train") return { ...base, cls: "npc", band: "#f0e8d8" };
  return { ...base, cls: "warrior", at: 3, sub: "#c8d0e0", wt: 2, cape: tone(col, 0.8) };
}
/** A player's look from the public record the server sends. */
export function playerLook(cls, look, gear = {}) {
  if (!OUTFIT[cls]) cls = "warrior";
  const at = Math.max(1, Math.min(5, gear.at | 0 || 1));
  const [main, sub, trim] = OUTFIT[cls][at - 1];
  return { cls, hair: look[0] | 0, skin: look[1] | 0, style: look[2] | 0, at, main, sub, trim, wt: Math.max(1, Math.min(5, gear.wt | 0 || 1)), wq: gear.wq | 0, we: gear.we | 0, acc: gear.acc | 0 };
}

/**
 * Build a person. Returns the group and an `anim` function driven every frame.
 * The figure faces +z; limbs hang from pivots so they can swing.
 */
function human(o) {
  const skin = M(SKIN[o.skin] || SKIN[0]), hair = M(o.bone ? "#e4e6ee" : HAIR[o.hair] || HAIR[0]);
  const main = M(o.main), sub = M(o.sub), trim = M(o.trim || "#e8c460");
  const glowing = o.at >= 5;
  const subMat = glowing ? M(o.sub, { emissive: o.sub, emissiveIntensity: 0.45 }) : sub;
  const cls = o.cls, robe = cls === "mage" || cls === "robe";
  const body = new THREE.Group();

  // legs
  const legMat = cls === "warrior" ? subMat : M(cls === "ranger" ? "#5c586a" : cls === "rogue" ? tone(o.main, 0.8) : "#565266");
  const bootMat = M(cls === "warrior" ? tone(o.sub, 0.85) : "#4a3c36");
  const leg = (x) => { const p = new THREE.Group(); p.position.set(x, 0.4, 0); p.add(mesh(GEO.cap, legMat, 0, -0.17, 0, 0.068, 0.2, 0.075), mesh(GEO.box, bootMat, 0, -0.35, 0.02, 0.15, 0.1, 0.2)); return p; };
  const legL = leg(-0.09), legR = leg(0.09);
  if (!robe) body.add(legL, legR);

  // torso
  const torso = new THREE.Group();
  torso.position.y = 0.4;
  body.add(torso);
  if (robe) {
    torso.add(mesh(GEO.cyl, main, 0, -0.02, 0, 0.3, 0.74, 0.3));
    torso.children[0].geometry = new THREE.CylinderGeometry(0.52, 1, 1, 14);
    torso.add(mesh(GEO.cyl, trim, 0, -0.36, 0, 0.305, 0.05, 0.305));
    torso.add(mesh(GEO.cyl, M(o.sash || "#6acce0"), 0, 0.1, 0, 0.205, 0.07, 0.205));
    if (cls === "mage") { const mantle = mesh(new THREE.CylinderGeometry(0.4, 1, 1, 14), subMat, 0, 0.29, 0, 0.27, 0.2, 0.25); torso.add(mantle, mesh(GEO.sph, glowMat("#8adcf4", 1.6), 0, 0.3, 0.2, 0.04)); }
    body.add(mesh(GEO.box, bootMat, -0.09, 0.05, 0.03, 0.14, 0.1, 0.2), mesh(GEO.box, bootMat, 0.09, 0.05, 0.03, 0.14, 0.1, 0.2));
  } else {
    torso.add(mesh(GEO.cap, cls === "ranger" ? sub : main, 0, 0.19, 0, 0.165, 0.16, 0.12));
    torso.add(mesh(GEO.cyl, M("#7a5236"), 0, 0.02, 0, 0.172, 0.06, 0.128), mesh(GEO.box, trim, 0, 0.02, 0.125, 0.06, 0.07, 0.02));
    if (cls === "warrior") {
      torso.add(mesh(GEO.cap, subMat, 0, 0.22, 0.012, 0.17, 0.09, 0.125));
      const pr = 0.085 + o.at * 0.012;
      torso.add(mesh(GEO.sph, subMat, -0.21, 0.33, 0, pr, pr * 0.8, pr), mesh(GEO.sph, subMat, 0.21, 0.33, 0, pr, pr * 0.8, pr));
      torso.add(mesh(GEO.box, main, 0, 0.12, 0.13, 0.11, 0.3, 0.02), mesh(GEO.sph, trim, 0, 0.24, 0.145, 0.03));
      const cape = mesh(GEO.box, M(o.cape || tone(o.main, 0.8)), 0, 0.02, -0.14, 0.34, 0.56, 0.03);
      cape.rotation.x = 0.16; torso.add(cape); body.userData.cape = cape;
    } else if (cls === "rogue") {
      const scarf = mesh(GEO.tor, sub, 0, 0.36, 0, 0.13, 0.13, 0.16); scarf.rotation.x = Math.PI / 2;
      const tail = mesh(GEO.box, sub, 0.05, 0.2, -0.16, 0.09, 0.34, 0.03); tail.rotation.x = 0.3;
      torso.add(scarf, tail); body.userData.cape = tail;
      const strap = mesh(GEO.box, M("#7a5236"), 0, 0.2, 0.125, 0.04, 0.36, 0.015); strap.rotation.z = 0.7; torso.add(strap);
      if (o.at >= 3) torso.add(mesh(GEO.sph, M(tone(o.main, 1.3)), -0.2, 0.33, 0, 0.08, 0.06, 0.08));
    } else if (cls === "ranger") {
      // an open coat: a skirted shell around the shirt
      const coat = mesh(new THREE.CylinderGeometry(0.72, 1, 1, 14, 1, true, 0.5, Math.PI * 2 - 1), M(o.main, { side: THREE.DoubleSide }), 0, 0.1, 0, 0.215, o.at >= 3 ? 0.62 : 0.5, 0.165);
      torso.add(coat, mesh(GEO.box, M("#b08a58"), -0.1, 0.02, 0.13, 0.08, 0.09, 0.05));
    } else if (o.apron) torso.add(mesh(GEO.box, M(o.apron), 0, 0.12, 0.125, 0.2, 0.36, 0.02));
  }

  // arms
  const sleeve = cls === "rogue" ? skin : cls === "warrior" ? M(tone(o.main, 0.85)) : cls === "ranger" ? main : cls === "mage" ? main : main;
  const glove = cls === "warrior" ? subMat : cls === "ranger" || cls === "rogue" ? M("#4a4048") : skin;
  const arm = (x) => { const p = new THREE.Group(); p.position.set(x, 0.72, 0); p.add(mesh(GEO.cap, sleeve, 0, -0.13, 0, 0.052, 0.15, 0.052), mesh(GEO.sph, glove, 0, -0.27, 0, 0.055)); return p; };
  const armL = arm(-0.225), armR = arm(0.225);
  body.add(armL, armR);

  // head
  const head = new THREE.Group();
  head.position.y = 1.0;
  body.add(head);
  head.add(mesh(GEO.sph, o.bone ? M("#e4e6ee") : skin, 0, 0, 0, 0.215, 0.205, 0.205));
  if (!o.bone) {
    head.add(mesh(GEO.half, hair, 0, 0.012, -0.012, 0.232, 0.232, 0.232));
    const fringe = mesh(GEO.sph, hair, 0, 0.115, 0.125, 0.205, 0.085, 0.12); fringe.rotation.x = -0.2; head.add(fringe);
    head.add(mesh(GEO.sph, hair, -0.19, 0.0, 0.03, 0.05, 0.13, 0.09), mesh(GEO.sph, hair, 0.19, 0.0, 0.03, 0.05, 0.13, 0.09));
    if (o.style === 1) head.add(mesh(GEO.sph, hair, 0, -0.14, -0.12, 0.2, 0.26, 0.11));
    if (o.style === 2) { const tail = mesh(GEO.cap, hair, 0, -0.12, -0.24, 0.055, 0.2, 0.055); tail.rotation.x = -0.5; head.add(tail, mesh(GEO.sph, trim, 0, 0.02, -0.21, 0.045)); }
    for (const x of [-0.078, 0.078]) { head.add(mesh(GEO.sph, M("#2a2230"), x, -0.012, 0.192, 0.026, 0.04, 0.02), mesh(GEO.sph, M("#ffffff"), x - 0.008, 0.004, 0.207, 0.009)); }
    if (o.beard) head.add(mesh(GEO.sph, M("#e4e6ee"), 0, -0.15, 0.12, 0.13, 0.15, 0.09));
  } else {
    for (const x of [-0.078, 0.078]) head.add(mesh(GEO.sph, glowMat(o.eye || "#6ae8f4", 2), x, 0, 0.19, 0.035, 0.045, 0.02));
  }
  if (cls === "warrior" || o.band) { const band = mesh(GEO.tor, M(o.band || "#d84a4a"), 0, 0.075, 0, 0.212, 0.212, 0.3); band.rotation.x = Math.PI / 2; head.add(band); }
  if (cls === "rogue") { const band = mesh(GEO.tor, sub, 0, 0.09, 0, 0.214, 0.214, 0.34); band.rotation.x = Math.PI / 2; head.add(band); }
  if (cls === "ranger") {
    head.add(mesh(GEO.cyl, main, 0, 0.17, -0.01, 0.2, 0.1, 0.2), mesh(GEO.box, M(tone(o.main, 0.8)), 0, 0.125, 0.2, 0.26, 0.025, 0.17));
    if (o.at >= 2) for (const x of [-0.07, 0.07]) head.add(mesh(GEO.sph, glowMat("#8fe8f4", o.at >= 4 ? 1.8 : 0.7), x, 0.17, 0.185, 0.045, 0.036, 0.03));
  }
  if (cls === "mage") {
    if (o.at >= 2) {
      const hat = mesh(GEO.cone, main, 0, 0.42, -0.03, 0.2, 0.5, 0.2); hat.rotation.x = -0.22;
      head.add(mesh(GEO.cyl, M(tone(o.main, 0.86)), 0, 0.17, 0, 0.36, 0.03, 0.36), hat, mesh(GEO.cyl, trim, 0, 0.2, 0, 0.205, 0.05, 0.205));
    } else head.add(mesh(GEO.sph, glowMat("#8adcf4", 1.2), 0, 0.12, 0.2, 0.03));
  }
  if (o.acc) torso.add(mesh(GEO.sph, glowMat(o.acc >= 4 ? "#8ff4ff" : o.acc >= 3 ? "#eef0f6" : "#e8a860", 1.4), 0, 0.33, 0.14, 0.03));

  // weapon, held in the right hand (the two-handed sword swings with it)
  const wt = o.wt || 1, metal = METAL[wt], aura = RARITY[o.wq | 0];
  const blade = M(metal, aura || wt >= 4 || o.we >= 7 ? { emissive: aura || metal, emissiveIntensity: 0.35 + (o.we >= 7 ? 0.7 : o.we >= 4 ? 0.3 : 0) + (wt >= 4 ? 0.25 : 0) } : undefined);
  const hand = new THREE.Group();
  hand.position.y = -0.27;
  armR.add(hand);
  let reach = 0;
  if (cls === "warrior") {
    const len = 0.8 + wt * 0.06;
    hand.add(mesh(GEO.box, blade, 0, len / 2 + 0.12, 0, 0.09 + wt * 0.008, len, 0.025), mesh(GEO.box, trim, 0, 0.1, 0, 0.26 + wt * 0.02, 0.05, 0.05), mesh(GEO.cyl, M("#6a4a34"), 0, 0, 0, 0.022, 0.2, 0.022));
    const tip = mesh(GEO.cone4, blade, 0, len + 0.17, 0, 0.065 + wt * 0.006, 0.12, 0.018); hand.add(tip);
    hand.rotation.set(-1.9, 0, 0.5);
  } else if (cls === "rogue") {
    const dag = (h) => { h.add(mesh(GEO.cone4, blade, 0, -0.14, 0, 0.03, 0.26 + wt * 0.02, 0.012), mesh(GEO.box, trim, 0, -0.01, 0, 0.09, 0.025, 0.03)); h.children[h.children.length - 2].rotation.x = Math.PI; };
    dag(hand);
    const off = new THREE.Group(); off.position.y = -0.27; armL.add(off); dag(off);
  } else if (cls === "ranger") {
    const long = wt >= 3 ? 0.5 + wt * 0.04 : 0.24 + wt * 0.03;
    hand.add(mesh(GEO.box, M("#3c404c"), 0, 0, long * 0.3, 0.05, 0.07, long * 0.6), mesh(GEO.cyl, blade, 0, 0.01, long * 0.75, 0.018 + (wt >= 5 ? 0.02 : 0), long * 0.55, 0.018 + (wt >= 5 ? 0.02 : 0)), mesh(GEO.box, M("#5a4234"), 0, -0.06, 0.02, 0.04, 0.1, 0.05));
    hand.children[1].rotation.x = Math.PI / 2;
    if (wt >= 4) hand.add(mesh(GEO.box, glowMat("#8ff4ff", 2), 0, 0.045, long * 0.3, 0.02, 0.012, long * 0.5));
    reach = long;
  } else if (cls === "mage") {
    const gem = ["", "#8ad8f0", "#8ad8f0", "#b6a0ff", "#8ff4ff", "#ff9af0"][wt];
    hand.add(mesh(GEO.cyl, M("#96704a"), 0, 0.28, 0, 0.022, 1.25, 0.022), mesh(GEO.oct, glowMat(gem, 2.2), 0, 0.98, 0, 0.07 + wt * 0.008, 0.1 + wt * 0.01, 0.07 + wt * 0.008));
    if (wt >= 3) { const ring = mesh(GEO.tor, blade, 0, 0.98, 0, 0.12, 0.12, 0.12); hand.add(ring); }
  } else if (o.wpn === "bat") hand.add(mesh(GEO.cyl, M("#8a6a48"), 0, -0.2, 0, 0.03, 0.5, 0.03));
  if (aura) { const halo = new THREE.Sprite(haloMat(aura)); halo.scale.setScalar(0.9 + (o.we >= 7 ? 0.5 : 0)); halo.position.y = cls === "mage" ? 0.98 : cls === "warrior" ? 0.6 : 0; hand.add(halo); }
  else if (o.we >= 7) { const halo = new THREE.Sprite(haloMat("#ffffff")); halo.scale.setScalar(0.8); halo.position.y = cls === "warrior" ? 0.6 : 0.3; hand.add(halo); }

  const g = new THREE.Group();
  g.add(body);
  let walk = 0, yaw = null;
  const ranged = cls === "ranger" || cls === "mage";
  /** s: { moving, atk (seconds since the last attack), dead, yaw } */
  function anim(dt, t, s) {
    if (s.yaw !== undefined) {
      if (yaw === null) yaw = s.yaw;
      let d = s.yaw - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw += d * Math.min(1, dt * 14);
      g.rotation.y = yaw;
    }
    if (s.dead) { body.rotation.x += (-1.45 - body.rotation.x) * Math.min(1, dt * 8); body.position.y = 0.12; return; }
    body.rotation.x += (0 - body.rotation.x) * Math.min(1, dt * 10);
    if (s.moving) walk += dt * 11; else walk += (Math.round(walk / Math.PI) * Math.PI - walk) * Math.min(1, dt * 10);
    const sw = Math.sin(walk), stride = s.moving ? 0.75 : 0;
    legL.rotation.x = sw * stride; legR.rotation.x = -sw * stride;
    body.position.y = s.moving ? Math.abs(Math.cos(walk)) * 0.035 : Math.sin(t / 620) * 0.008;
    torso.scale.y = 1 + Math.sin(t / 620) * 0.012;
    armL.rotation.x = -sw * stride * 0.7; armL.rotation.z = -0.08;
    let ax = sw * stride * 0.7, az = 0.08;
    const a = s.atk;
    if (a < 0.34) {
      const k = a / 0.34;
      if (cls === "warrior") { ax = k < 0.3 ? -2.6 * (k / 0.3) : -2.6 + 3.6 * ((k - 0.3) / 0.7); body.rotation.x = k > 0.3 ? 0.22 * Math.sin(((k - 0.3) / 0.7) * Math.PI) : 0; }
      else if (ranged) { ax = -1.5 + (k < 0.25 ? -0.35 * Math.sin((k / 0.25) * Math.PI) : 0); }
      else { ax = -1.3 * Math.sin(k * Math.PI); armL.rotation.x = -1.1 * Math.sin(Math.max(0, k - 0.25) / 0.75 * Math.PI); body.rotation.x = 0.16 * Math.sin(k * Math.PI); }
    } else if (cls === "ranger") ax = -0.9;
    armR.rotation.x = ax; armR.rotation.z = az;
    if (body.userData.cape) body.userData.cape.rotation.x = 0.16 + (s.moving ? 0.3 + sw * 0.08 : Math.sin(t / 700) * 0.03);
  }
  return { group: g, anim, key: JSON.stringify(o), reach, height: robe && o.at >= 2 ? 1.75 : 1.32 };
}

const haloTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.35, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const haloMats = new Map();
function haloMat(color) {
  let m = haloMats.get(color);
  if (!m) { m = new THREE.SpriteMaterial({ map: haloTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); haloMats.set(color, m); }
  return m;
}

// ───────────────────────────── monsters ─────────────────────────────

function eyes(g, y, z, gap, r, mat = M("#1c1620")) {
  g.add(mesh(GEO.sph, mat, -gap, y, z, r, r * 1.3, r * 0.6), mesh(GEO.sph, mat, gap, y, z, r, r * 1.3, r * 0.6));
}
/** Build a monster by kind. `anim(dt, t, s)` gets { moving, atk, hurt }. */
function monster(kind) {
  const g = new THREE.Group(), b = new THREE.Group();
  g.add(b);
  let anim = () => {}, height = 0.7, hover = 0;
  if (kind === "slime" || kind === "bslime") {
    const col = kind === "slime" ? "#6cc05c" : "#5a9ae0";
    b.add(mesh(GEO.sph, M(col, { transparent: true, opacity: 0.9 }), 0, 0.26, 0, 0.34, 0.27, 0.34), mesh(GEO.sph, M(tone(col, 1.5)), -0.1, 0.4, 0.12, 0.07, 0.04, 0.05));
    eyes(b, 0.28, 0.3, 0.1, 0.035);
    anim = (dt, t, s) => { const k = Math.sin(t / 260 + g.id) * (s.moving ? 0.16 : 0.07); b.scale.set(1 - k * 0.6, 1 + k, 1 - k * 0.6); b.position.y = s.moving ? Math.abs(Math.sin(t / 200 + g.id)) * 0.12 : 0; };
    height = 0.62;
  } else if (kind === "shroom") {
    b.add(mesh(GEO.cyl, M("#eadcc0"), 0, 0.2, 0, 0.14, 0.4, 0.14), mesh(GEO.half, M("#b8423e"), 0, 0.36, 0, 0.36, 0.3, 0.36));
    for (let i = 0; i < 5; i++) b.add(mesh(GEO.sph, M("#f6ecd8"), Math.cos(i * 1.3) * 0.2, 0.52 + (i % 2) * 0.04, Math.sin(i * 1.3) * 0.2, 0.05, 0.02, 0.05));
    eyes(b, 0.24, 0.13, 0.06, 0.025);
    anim = (dt, t, s) => { b.rotation.z = Math.sin(t / 180 + g.id) * (s.moving ? 0.14 : 0.04); };
    height = 0.75;
  } else if (kind === "boar") {
    const fur = M("#7a5a40");
    b.add(mesh(GEO.cap, fur, 0, 0.36, -0.05, 0.22, 0.3, 0.2), mesh(GEO.sph, fur, 0, 0.36, 0.34, 0.17, 0.16, 0.18), mesh(GEO.cyl, M("#c08a84"), 0, 0.32, 0.5, 0.07, 0.06, 0.07), mesh(GEO.box, M("#3e2c20"), 0, 0.57, -0.02, 0.07, 0.07, 0.5));
    b.children[0].rotation.x = Math.PI / 2; b.children[2].rotation.x = Math.PI / 2;
    for (const x of [-0.09, 0.09]) { const tusk = mesh(GEO.cone, M("#f4f0e4"), x, 0.3, 0.47, 0.022, 0.1, 0.022); tusk.rotation.x = -0.7; b.add(tusk); }
    eyes(b, 0.42, 0.46, 0.09, 0.022, glowMat("#e04040", 1.2));
    const legs = [[-0.13, 0.2], [0.13, 0.2], [-0.13, -0.26], [0.13, -0.26]].map(([x, z]) => { const p = new THREE.Group(); p.position.set(x, 0.22, z); p.add(mesh(GEO.cyl, M("#4e3a2a"), 0, -0.11, 0, 0.045, 0.22, 0.045)); b.add(p); return p; });
    anim = (dt, t, s) => { const w = s.moving ? Math.sin(t / 70) * 0.7 : 0; legs.forEach((l, i) => { l.rotation.x = i % 3 === 0 ? w : -w; }); b.position.y = s.moving ? Math.abs(Math.sin(t / 70)) * 0.03 : 0; };
    height = 0.8;
  } else if (kind === "bat") {
    const col = M("#4e3c6a");
    b.add(mesh(GEO.sph, col, 0, 0, 0, 0.15, 0.17, 0.15), mesh(GEO.cone4, col, -0.07, 0.17, 0, 0.04, 0.1, 0.03), mesh(GEO.cone4, col, 0.07, 0.17, 0, 0.04, 0.1, 0.03));
    eyes(b, 0.03, 0.13, 0.055, 0.025, glowMat("#ff4a4a", 1.6));
    const wings = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.x = sd * 0.1; const w = mesh(GEO.box, M("#3a2c50"), sd * 0.24, 0, 0, 0.46, 0.02, 0.26); p.add(w); b.add(p); return p; });
    hover = 0.95;
    anim = (dt, t) => { const f = Math.sin(t / 55 + g.id) * 0.8; wings[0].rotation.z = f; wings[1].rotation.z = -f; b.position.y = hover + Math.sin(t / 300 + g.id) * 0.08; };
    height = 1.35;
  } else if (kind === "drone") {
    b.add(mesh(GEO.box, M("#6a7080"), 0, 0, 0, 0.42, 0.14, 0.42), mesh(GEO.sph, glowMat("#ff4a4a", 2.4), 0, -0.06, 0.16, 0.06), mesh(GEO.box, M("#3c414c"), 0, -0.1, 0, 0.2, 0.08, 0.2));
    const rotors = [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]].map(([x, z]) => { b.add(mesh(GEO.cyl, M("#3c414c"), x, 0.07, z, 0.02, 0.08, 0.02)); const r = mesh(GEO.box, M("#aab4c4", { transparent: true, opacity: 0.6 }), x, 0.12, z, 0.3, 0.01, 0.04); b.add(r); return r; });
    hover = 1.15;
    anim = (dt, t) => { rotors.forEach((r) => { r.rotation.y = t / 18; }); b.position.y = hover + Math.sin(t / 380 + g.id) * 0.06; b.rotation.z = Math.sin(t / 500) * 0.05; };
    height = 1.5;
  } else if (kind === "thug" || kind === "skel") {
    const look = kind === "thug"
      ? { cls: "rogue", hair: 1, skin: 1, style: 0, at: 2, main: "#7a3640", sub: "#e8e4d8", trim: "#c8c8d0", wt: 2 }
      : { cls: "warrior", bone: 1, hair: 5, skin: 0, style: 0, at: 3, main: "#3a3852", sub: "#6e6c8a", trim: "#6ae8f4", eye: "#6ae8f4", cape: "#24223a", wt: 3, band: "#24223a" };
    const f = human(look);
    b.add(f.group);
    anim = (dt, t, s) => f.anim(dt, t, { moving: s.moving, atk: s.atk, dead: false });
    height = 1.32;
  } else {
    // golem family: robot, crystal golem, and the rift lord
    const boss = kind === "boss", robot = kind === "robot";
    const st = robot ? ["#8a909c", "#5c626e", "#ff5038"] : boss ? ["#5a4a9c", "#3a2f72", "#ff6ad0"] : ["#8a84a4", "#666082", "#6ae0f0"];
    const A = M(st[0], { flatShading: !robot }), D = M(st[1], { flatShading: !robot }), glw = glowMat(st[2], 2);
    b.add(mesh(GEO.box, A, 0, 0.6, 0, 0.56, 0.5, 0.4), mesh(GEO.box, D, 0, 0.3, 0, 0.4, 0.2, 0.3), mesh(GEO.box, A, 0, 0.98, 0.02, 0.3, 0.26, 0.28));
    b.add(mesh(GEO.box, glw, 0, 0.99, 0.165, robot ? 0.22 : 0.2, 0.05, 0.02), mesh(robot ? GEO.box : GEO.oct, glw, 0, 0.62, 0.21, 0.09, 0.12, 0.05));
    const arms = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.4, 0.78, 0); p.add(mesh(GEO.box, D, 0, -0.26, 0, 0.18, 0.52, 0.2), mesh(GEO.box, A, 0, -0.56, 0, 0.22, 0.18, 0.24)); b.add(p); return p; });
    const legs = [-1, 1].map((sd) => { const p = new THREE.Group(); p.position.set(sd * 0.15, 0.24, 0); p.add(mesh(GEO.box, D, 0, -0.12, 0, 0.17, 0.26, 0.2)); b.add(p); return p; });
    if (!robot) for (const [x, y, z, s2] of [[-0.3, 0.92, -0.05, 0.12], [0.32, 0.9, -0.03, 0.1], [0, 1.2, -0.02, boss ? 0.14 : 0.07], [-0.14, 1.16, 0, boss ? 0.1 : 0], [0.14, 1.16, 0, boss ? 0.1 : 0]]) if (s2) b.add(mesh(GEO.oct, glw, x, y, z, s2 * 0.6, s2 * 1.5, s2 * 0.6));
    const sc = boss ? 2.4 : robot ? 1.15 : 1.35;
    b.scale.setScalar(sc);
    if (boss) { const l = new THREE.PointLight("#ff6ad0", 6, 7, 1.5); l.position.y = 2; g.add(l); }
    anim = (dt, t, s) => {
      const w = s.moving ? Math.sin(t / 160) * 0.45 : 0;
      legs[0].rotation.x = w; legs[1].rotation.x = -w; arms[0].rotation.x = -w;
      arms[1].rotation.x = s.atk < 0.4 ? -2.2 * Math.sin((s.atk / 0.4) * Math.PI) : w;
      b.position.y = s.moving ? Math.abs(Math.sin(t / 160)) * 0.04 : 0;
    };
    height = 1.2 * sc;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, anim, height, hover };
}

// ───────────────────────────── entities ─────────────────────────────

const figures = new Map(), mobs = new Map(), drops = new Map();
const YAW = [0, -Math.PI / 2, Math.PI / 2, Math.PI];
const ITEM_COL = { gold: "#f0c848", hp_s: "#d8404c", hp_m: "#d8404c", mp_s: "#4a74e0", mp_m: "#4a74e0", stone: "#6ae0f0" };

function figureFor(id, look) {
  const key = JSON.stringify(look);
  let f = figures.get(id);
  if (f && f.key !== key) { scene.remove(f.group); f = null; }
  if (!f) { f = human(look); f.key = key; scene.add(f.group); figures.set(id, f); }
  return f;
}

/**
 * Bring the 3D world in line with the game state for this frame.
 * `G` is the client's state; `looks` maps entity id → look.
 */
export function sync(G, dt, t) {
  const seen = new Set();
  const put = (id, e, w, isMe) => {
    if (!w) return;
    seen.add(id);
    const f = figureFor(id, playerLook(w.cls, w.look, w.gear));
    f.group.position.set(e.x * U, 0, e.y * U);
    f.anim(dt, t, { moving: e.moving, atk: (t - e.atkT) / 1000, dead: e.dead, yaw: YAW[e.dir] || 0 });
    f.group.visible = true;
    e.h3 = f.height;
    if (isMe) torch.position.set(e.x * U, 1.4, e.y * U);
  };
  put(G.you, G.me, G.who.get(G.you), true);
  for (const [eid, p] of G.players) put(eid, p, G.who.get(eid));
  for (const [id, f] of figures) if (!seen.has(id)) { scene.remove(f.group); figures.delete(id); }

  for (const [id, m] of G.mobs) {
    let o = mobs.get(id);
    if (!o) {
      o = monster(G.defs.mobs[m.k].sp);
      if (m.el) { o.group.scale.setScalar(1.22); const ring = mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: "#ffbe3c", transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0.03, 0, 0.5); ring.rotation.x = -Math.PI / 2; ring.castShadow = false; o.group.add(ring); o.height *= 1.22; }
      o.yaw = 0; o.px = m.x; o.py = m.y;
      scene.add(o.group); mobs.set(id, o);
    }
    const dx = m.x - o.px, dy = m.y - o.py;
    if (Math.hypot(dx, dy) > 0.05) { const want = Math.atan2(dx, dy); let d = want - o.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); o.yaw += d * Math.min(1, dt * 10); }
    o.px = m.x; o.py = m.y;
    o.group.position.set(m.x * U, 0, m.y * U);
    o.group.rotation.y = o.yaw;
    o.anim(dt, t, { moving: m.moving, atk: (t - m.atkT) / 1000 });
    const hurt = t - m.hurtT < 110;
    if (hurt !== o.hurt) { o.hurt = hurt; o.group.scale.setScalar((m.el ? 1.22 : 1) * (hurt ? 1.12 : 1)); }
    m.h3 = o.height;
  }
  for (const [id, o] of mobs) if (!G.mobs.has(id)) { scene.remove(o.group); mobs.delete(id); }

  for (const [id, d] of G.drops) {
    let o = drops.get(id);
    if (!o) {
      const it = G.defs.items[d.it], rare = RARITY[d.q | 0];
      const col = ITEM_COL[d.it] || (it && it.type === "rune" ? "#b07aff" : rare || "#d8d4c8");
      const g = new THREE.Group();
      const core = d.it === "gold" ? mesh(GEO.cyl, glowMat(col, 0.5), 0, 0.2, 0, 0.11, 0.035, 0.11) : it && it.type === "pot" ? mesh(GEO.sph, M(col, { emissive: col, emissiveIntensity: 0.4 }), 0, 0.18, 0, 0.1, 0.12, 0.1) : mesh(GEO.oct, M(col, { emissive: col, emissiveIntensity: rare ? 1 : 0.3, flatShading: true }), 0, 0.22, 0, 0.11, 0.15, 0.11);
      if (d.it === "gold") core.rotation.x = Math.PI / 2;
      g.add(core);
      if (rare) { const beam = mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: rare, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.9 + d.q * 0.3, 0, 0.05, 1.8 + d.q * 0.6, 0.05); beam.castShadow = false; g.add(beam); }
      o = { group: g, core };
      scene.add(g); drops.set(id, o);
    }
    o.group.position.set(d.x * U, 0, d.y * U);
    o.core.rotation.y = t / 500 + id;
    o.core.position.y = 0.22 + Math.sin(t / 300 + id) * 0.04;
  }
  for (const [id, o] of drops) if (!G.drops.has(id)) { scene.remove(o.group); drops.delete(id); }
}

// ───────────────────────────── effects ─────────────────────────────

const particles = {
  n: 500, pos: null, col: null, vel: [], life: [], pts: null, head: 0,
  init() {
    this.pos = new Float32Array(this.n * 3); this.col = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) { this.vel.push(new V3()); this.life.push(0); this.pos[i * 3 + 1] = -99; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, map: haloTex, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  },
  emit(x, y, z, color, n, speed, up = 1.2) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.head = (this.head + 1) % this.n;
      const a = Math.random() * 6.28, v = speed * (0.3 + Math.random() * 0.7);
      this.pos.set([x, y, z], i * 3); this.col.set([c.r, c.g, c.b], i * 3);
      this.vel[i].set(Math.cos(a) * v, up * (0.4 + Math.random()), Math.sin(a) * v);
      this.life[i] = 0.35 + Math.random() * 0.4;
    }
  },
  step(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -99; continue; }
      const v = this.vel[i];
      v.y -= 3.2 * dt;
      this.pos[i * 3] += v.x * dt; this.pos[i * 3 + 1] += v.y * dt; this.pos[i * 3 + 2] += v.z * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.pts.geometry.attributes.color.needsUpdate = true;
  },
};

/** Short-lived effect meshes. World coordinates are the server's (sixteenths of a tile). */
export const fx = {
  list: [], spin: [], idlers: [],
  clear() { for (const f of this.list) scene.remove(f.mesh); this.list.length = 0; this.spin.length = 0; this.idlers.length = 0; },
  add(m, dur, update, done) { m.castShadow = false; scene.add(m); this.list.push({ mesh: m, t0: performance.now(), dur, update, done }); },
  /** A ring spreading over the ground. */
  ring(wx, wy, r, color, dur = 300, filled = false, delay = 0) {
    const m = mesh(filled ? GEO.disc : GEO.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }), wx * U, 0.05, wy * U, 0.01);
    m.rotation.x = -Math.PI / 2;
    const R = r * U;
    setTimeout(() => this.add(m, dur, (k) => { m.scale.setScalar(Math.max(0.01, R * k)); m.material.opacity = (filled ? 0.4 : 0.85) * (1 - k); }), delay);
  },
  /** A warning circle that fills up before something lands. */
  tele(wx, wy, r, ms) {
    const R = r * U;
    const base = mesh(GEO.disc, new THREE.MeshBasicMaterial({ color: "#ff3c78", transparent: true, opacity: 0.22, depthWrite: false }), wx * U, 0.04, wy * U, R);
    base.rotation.x = -Math.PI / 2;
    const edge = mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: "#ff6ad0", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }), wx * U, 0.05, wy * U, 0.01);
    edge.rotation.x = -Math.PI / 2;
    this.add(base, ms, (k) => { base.material.opacity = 0.16 + 0.14 * Math.abs(Math.sin(k * 20)); });
    this.add(edge, ms, (k) => edge.scale.setScalar(Math.max(0.01, R * k)));
  },
  /** Something flying from a to b (heights in world units). */
  proj(ax, ay, ah, bx, by, bh, color, size, speed, done) {
    const m = mesh(GEO.sph, new THREE.MeshBasicMaterial({ color }), ax * U, ah, ay * U, size);
    const halo = new THREE.Sprite(haloMat(color)); halo.scale.setScalar(6); m.add(halo);
    const a = new V3(ax * U, ah, ay * U), b = new V3(bx * U, bh, by * U);
    const dur = Math.max(70, (a.distanceTo(b) / speed) * 1000);
    this.add(m, dur, (k) => { m.position.lerpVectors(a, b, k); if (size > 0.05 && Math.random() < 0.6) particles.emit(m.position.x, m.position.y, m.position.z, color, 1, 0.2, 0.2); }, done);
  },
  /** A blade's arc in front of someone. */
  slash(wx, wy, yaw, color, size = 0.6) {
    const m = mesh(new THREE.RingGeometry(size * 0.72, size, 24, 1, -0.9, 1.8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }), wx * U, 0.6, wy * U);
    m.rotation.set(-Math.PI / 2 + 0.35, 0, yaw - Math.PI / 2, "YXZ");
    m.rotation.set(-1.25, yaw, 0, "YXZ");
    this.add(m, 190, (k) => { m.rotation.z = -1.2 + k * 2.4; m.material.opacity = 0.9 * (1 - k); m.scale.setScalar(1 + k * 0.25); });
  },
  beam(ax, ay, bx, by, color, h = 0.6) {
    const a = new V3(ax * U, h, ay * U), b = new V3(bx * U, h, by * U), len = a.distanceTo(b);
    const m = mesh(GEO.box, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }), (a.x + b.x) / 2, h, (a.z + b.z) / 2, 0.09, 0.09, len);
    m.lookAt(b);
    this.add(m, 260, (k) => { m.material.opacity = 0.9 * (1 - k); m.scale.x = m.scale.y = 0.09 * (1 - k * 0.6); });
  },
  pillar(wx, wy) {
    const m = mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: "#fff0a0", transparent: true, opacity: 0.5, depthWrite: false }), wx * U, 1.6, wy * U, 0.34, 3.2, 0.34);
    this.add(m, 900, (k) => { m.material.opacity = 0.5 * (1 - k); m.scale.x = m.scale.z = 0.34 * (1 + k * 0.6); });
    particles.emit(wx * U, 0.3, wy * U, "#ffd84a", 26, 0.9, 2.4);
  },
  burst(wx, wy, h, color, n = 8, speed = 1.4) { particles.emit(wx * U, h, wy * U, color, n, speed); },
  sparkle(wx, wy, h, color, n = 10) { particles.emit(wx * U, h, wy * U, color, n, 0.35, 2); },
  flash(wx, wy, h, color) { const s = new THREE.Sprite(haloMat(color)); s.position.set(wx * U, h, wy * U); s.scale.setScalar(0.4); this.add(s, 140, (k) => { s.scale.setScalar(0.4 + k * 1.2); s.material = haloMat(color); s.material.opacity = 1; }); },
};
export function shake(n) { shakeAmt = Math.max(shakeAmt, n); }

// ───────────────────────────── the frame ─────────────────────────────

const tmpV = new V3();
/** Draw one frame. (fx, fz) is where the camera should look, in server units. */
export function render(focusX, focusY, dt, t, snap, focusH = 0) {
  if (!renderer) return;
  tmpV.set(focusX * U, focusH, focusY * U);
  if (snap) target.copy(tmpV); else target.lerp(tmpV, Math.min(1, dt * 9));
  shakeAmt = Math.max(0, shakeAmt - dt * 14);
  const sx = (Math.random() - 0.5) * shakeAmt * 0.05, sy = (Math.random() - 0.5) * shakeAmt * 0.05;
  camera.position.set(target.x + camOff.x + sx, target.y + camOff.y + sy, target.z + camOff.z - sx);
  camera.lookAt(target.x + sx, target.y + sy, target.z - sx);
  sun.position.set(target.x - 9, 16, target.z + 5);
  sun.target.position.copy(target);
  fill.position.set(target.x + 8, 6, target.z - 4);

  // the nearest few lamps and crystals actually cast light
  const lit = scene.userData.lamps;
  if (lit && lampSpots.length) {
    lampSpots.sort((a, b) => (a[0] - target.x) ** 2 + (a[2] - target.z) ** 2 - ((b[0] - target.x) ** 2 + (b[2] - target.z) ** 2));
    lampPool.forEach((l, i) => { const s = lampSpots[i]; if (s) { l.position.set(s[0], s[1], s[2]); l.color.set(s[3]); l.intensity = s[4]; } else l.intensity = 0; });
  } else for (const l of lampPool) l.intensity = 0;

  const now = performance.now();
  for (let i = fx.list.length - 1; i >= 0; i--) {
    const f = fx.list[i], k = (now - f.t0) / f.dur;
    if (k >= 1) { scene.remove(f.mesh); fx.list.splice(i, 1); if (f.done) f.done(); continue; }
    if (f.update) f.update(k);
  }
  for (const m of fx.spin) m.rotation.z = t / 600;
  for (const f of fx.idlers) f.anim(dt, t, { moving: false, atk: 9, dead: false });
  particles.step(dt);
  renderer.render(scene, camera);
}

/** Where a point of the world lands on screen (CSS pixels). `h` is its height in tiles. */
export function project(wx, wy, h = 0) {
  tmpV.set(wx * U, h, wy * U).project(camera);
  return [((tmpV.x + 1) / 2) * W, ((1 - tmpV.y) / 2) * H];
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new V3(0, 1, 0), 0), hit = new V3();
/** The ground point under a screen position, in server units — for click-to-move. */
export function pick(clientX, clientY) {
  ray.setFromCamera(new THREE.Vector2((clientX / W) * 2 - 1, -(clientY / H) * 2 + 1), camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  return [hit.x / U, hit.z / U];
}

// ───────────────────────────── the title stage ─────────────────────────────

let stage = null;
/** A small lit stage behind the title: the four classes around a campfire glow. */
export function showcase(draft) {
  clearRoot();
  mapData = null;
  setMood("show");
  const B = batcher();
  B.add("floor", GEO.cyl, M("#5c7a58"), 0, -0.25, 0, 5.2, 0.5, 5.2);
  B.add("floor2", GEO.cyl, M("#4a4438"), 0, -0.8, 0, 5.4, 0.7, 5.4);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + 0.4, r = 3.6 + (i % 3) * 0.5, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.9 + (i % 4) * 0.12;
    if (x + z > 2.5) continue;
    B.add("trunk", GEO.cyl6, M("#6a4630"), x, 0.35 * s, z, 0.1 * s, 0.7 * s, 0.1 * s);
    for (let k = 0; k < 3; k++) B.add("pine" + k, GEO.cone, M(["#34704c", "#3c7e56", "#46905f"][k], { flatShading: true }), x, (0.95 + k * 0.62) * s, z, (0.66 - k * 0.16) * s, 0.95 * s, (0.66 - k * 0.16) * s);
  }
  for (let i = 0; i < 40; i++) B.add("tuft", GEO.cone4, M("#6c9a56"), (hash(i, 1) - 0.5) * 8, 0.09, (hash(i, 2) - 0.5) * 8, 0.05, 0.2, 0.05);
  B.add("fire", GEO.oct, glowMat("#ffb04a", 2.6), 0, 0.22, 0, 0.14, 0.3, 0.14);
  for (let i = 0; i < 6; i++) B.add("stone", GEO.rock, M("#8a8a94", { flatShading: true }), Math.cos(i) * 0.36, 0.06, Math.sin(i) * 0.36, 0.1);
  B.build(root);
  lampSpots.push([0, 0.7, 0, "#ffb060", 5]);
  stage = [];
  const cast = draft ? [draft] : [
    playerLook("warrior", [3, 0, 0], { at: 3, wt: 3, wq: 2 }), playerLook("mage", [4, 0, 1], { at: 2, wt: 3 }),
    playerLook("ranger", [2, 1, 2], { at: 2, wt: 3 }), playerLook("rogue", [1, 2, 0], { at: 1, wt: 2 }),
  ];
  cast.forEach((look, i) => {
    const f = human(look);
    const a = draft ? 0 : -0.6 + i * 0.75, r = draft ? 0 : 1.5;
    f.group.position.set(Math.sin(a + 0.8) * r + (draft ? 0.9 : 0), 0, Math.cos(a + 0.8) * r + (draft ? 0.9 : 0));
    f.group.rotation.y = draft ? Math.PI / 4 : Math.atan2(-f.group.position.x, -f.group.position.z) + 0.9;
    root.add(f.group);
    stage.push(f);
    if (!draft) fx.idlers.push(f);
  });
  viewStage(draft);
}
function viewStage(draft) {
  target.set(draft ? 0.9 : 0, draft ? 0.7 : 0.9, draft ? 0.9 : 0);
}
/** Frame for the title and character-creation screens. */
export function renderStage(dt, t, draft) {
  if (!renderer || !stage) return;
  const zoom = draft ? 0.34 : 0.62;
  const a = W / H;
  camera.left = (-viewH * zoom * a) / 2; camera.right = (viewH * zoom * a) / 2; camera.top = (viewH * zoom) / 2; camera.bottom = (-viewH * zoom) / 2;
  camera.updateProjectionMatrix();
  if (draft && stage[0]) { stage[0].group.rotation.y = Math.PI / 4 + Math.sin(t / 1400) * 0.9; const k = (t % 3200) / 1000; stage[0].anim(dt, t, { moving: k > 1.2 && k < 2.4, atk: k > 2.6 ? k - 2.6 : 9, dead: false }); }
  render(target.x / U, target.z / U, dt, t, true, target.y);
  camera.left = (-viewH * a) / 2; camera.right = (viewH * a) / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
}
export function leaveStage() { stage = null; }
