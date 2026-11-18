/** Willow's daily-work buildings, modelled on the same grid as the village houses. */
import { C, shade } from "./iso_px.js";

const styles = {
  ab_pipe:    { roof: "#4c7780", wall: "#a7b8a9", beam: "#596554", kind: "shed", HW: 23, rise: 11 },
  ab_fly:     { roof: "#677251", wall: "#b7b18c", beam: "#555943", kind: "shed", HW: 17, rise: 8 },
  ab_store:   { roof: "#3f8779", wall: "#f0e3ba", beam: "#5a7f69", kind: "gable", HW: 25, rise: 15 },
  ab_parcel:  { roof: "#9a784f", wall: "#c29869", beam: "#70543d", kind: "gable", HW: 25, rise: 18 },
  ab_laundry: { roof: "#6d9db7", wall: "#e3e9de", beam: "#638697", kind: "hip", HW: 24, rise: 12 },
  ab_taiyaki: { roof: "#ae5148", wall: "#e7be8a", beam: "#89503a", kind: "hip", HW: 22, rise: 11 },
  ab_pest:    { roof: "#4d7160", wall: "#a8b689", beam: "#466b53", kind: "round", HW: 23, rise: 15 },
  ab_wall:    { roof: "#6f6d6d", wall: "#b49781", beam: "#655749", kind: "shed", HW: 17, rise: 9 },
  ab_cross:   { roof: "#557587", wall: "#d6d5af", beam: "#5d624c", kind: "hip", HW: 21, rise: 14 },
  ab_lamp:    { roof: "#996049", wall: "#ddc391", beam: "#704b38", kind: "hip", HW: 24, rise: 15 },
  ab_rhythm:  { roof: "#72567d", wall: "#dec4ac", beam: "#724555", kind: "gable", HW: 30, rise: 19 },
  ab_garland: { roof: "#9f6c89", wall: "#e4d3a8", beam: "#64774b", kind: "round", HW: 22, rise: 14 },
};
const base = { floors: 1, plinth: 4, stone: "#a49b87", eave: 4 };
export function albaBuildingStyle(kind) {
  return styles[kind] ? { ...base, ...styles[kind] } : null;
}

export function albaBuildingDetails(kind, M, W, D, H, info, at) {
  const put = (x, y, z, col) => M.put(x, y, z, C(col), 4);
  const box = (x, y, z, w, d, h, col) => {
    const near = shade(col, 0.84), side = shade(col, 0.63);
    for (let a = x; a < x + w; a++) {
      for (let b = y; b < y + d; b++) put(a, b, z + h - 1, col);
      for (let t = z; t < z + h - 1; t++) put(a, y + d - 1, t, near);
    }
    for (let b = y; b < y + d; b++) for (let t = z; t < z + h - 1; t++) put(x + w - 1, b, t, side);
  };
  const disc = (x, y, z, rx, rz, col, rim) => {
    for (let a = -rx; a <= rx; a++) for (let b = -rz; b <= rz; b++) {
      const r = (a / rx) ** 2 + (b / rz) ** 2;
      if (r <= 1) put(x + a, y, z + b, r > 0.68 ? rim : col);
    }
  };
  const awning = (left, right, depth, colors) => {
    for (let x = left; x < right; x += 0.5) for (let b = 0; b < depth; b += 0.5) {
      const col = colors[Math.floor((x - left) / 4) % colors.length];
      M.slope(x, D + b, H - 6 - b / 3, C(b >= depth - 1 ? shade(col, 0.73) : col), 4);
    }
  };
  const crate = (x, y, z, w = 9) => {
    box(x, y, z, w, 7, 7, "#b88552");
    for (let i = 1; i < w - 1; i++) put(x + i, y + 6, z + 1 + Math.floor(4 * i / w), "#dcac6e");
  };
  const lantern = (x, y, z, col = "#ffd386") => {
    disc(x, y, z, 3, 4, col, "#a15b39");
    put(x, y, z + 5, "#624536");
    info.lamps.push(at(x, y, z));
  };
  const c = Math.floor(W / 2);
  switch (kind) {
    case "ab_pipe": {
      // Braced cistern and a copper downpipe with a shutoff wheel.
      box(6, 6, H + 3, 19, 17, 13, "#769394");
      box(4, 4, H + 16, 23, 21, 3, "#a6b9ab");
      for (const z of [H + 7, H + 13]) box(5, 5, z, 21, 19, 2, "#496a6e");
      box(W - 4, D - 16, 5, 5, 5, H + 9, "#b88658");
      box(W - 5, D - 16, H + 11, 7, 13, 4, "#c79c6b");
      disc(W - 12, D + 2, 12, 5, 5, "#ab5c40", "#6c4b42");
      box(W - 13, D + 1, 10, 3, 3, 4, "#dfba70");
      break;
    }
    case "ab_fly":
      for (const [x, col] of [[3, "#738b51"], [14, "#55788a"], [W - 13, "#8c7355"]]) {
        box(x, D + 1, 0, 8, 6, 9, col);
        box(x - 1, D, 9, 10, 8, 2, col);
        put(x + 4, D + 6, 5, "#e5d6ac");
      }
      break;
    case "ab_store":
      awning(1, W - 1, 8, ["#56ac8d", "#f3d894", "#f3d894", "#c06248"]);
      for (let i = 0; i < 3; i++) {
        box(W - 22 + i * 6, D + 2, 0, 5, 5, 4, "#926443");
        box(W - 21 + i * 6, D + 3, 4, 3, 3, 2, ["#c65949", "#93b459", "#e4af55"][i]);
      }
      break;
    case "ab_parcel":
      box(2, D, 0, 21, 7, 3, "#856345");
      crate(3, D + 1, 3);
      crate(13, D + 1, 3);
      crate(6, D + 1, 10, 7);
      crate(W - 15, D + 1, 0, 12);
      break;
    case "ab_laundry":
      for (const x of [3, W - 5]) box(x, D + 5, 0, 2, 2, 20, "#866946");
      for (let x = 4; x < W - 4; x++) {
        const z = 19 - Math.round(3 * Math.sin(Math.PI * x / W));
        put(x, D + 5, z, "#5c625e");
        if (x % 12 >= 2 && x % 12 <= 7 && Math.abs(x - c) > 9) {
          const col = ["#f0edda", "#df9fa0", "#80b5bd"][Math.floor(x / 12) % 3];
          for (let t = 1; t < 8; t++) put(x, D + 5, z - t, col);
        }
      }
      break;
    case "ab_taiyaki":
      awning(3, W - 3, 10, ["#b34d48", "#e8aa72"]);
      box(W - 22, D + 1, 0, 17, 8, 7, "#825841");
      box(W - 21, D + 2, 7, 15, 6, 2, "#484c52");
      for (let x = W - 20; x < W - 9; x += 4) disc(x, D + 7, 9, 2, 1, "#e3a054", "#875830");
      info.steam = at(W - 12, D + 4, 13);
      lantern(4, D + 5, 13);
      break;
    case "ab_pest":
      for (const [x, col] of [[5, "#6a9965"], [17, "#8eaa5a"], [W - 12, "#507a6c"]]) {
        box(x, D + 2, 0, 8, 7, 11, col);
        box(x + 2, D + 3, 11, 4, 4, 3, "#56614e");
        put(x + 3, D + 8, 6, "#eddf95");
      }
      break;
    case "ab_wall": {
      // Build a stepped bare brick wall and suspend the demolition weight.
      for (let i = 0; i < 5; i++) box(W - 27 + 4 * i, D + 2, 0, 4, 5, 5 + i * 2, i % 2 ? "#b27554" : "#a86c56");
      box(W - 6, D - 5, 0, 4, 4, H + 23, "#745b43");
      box(W - 22, D - 5, H + 21, 20, 4, 3, "#ad8354");
      for (let z = H + 6; z < H + 22; z++) put(W - 20, D - 2, z, z % 2 ? "#555768" : "#aea9a2");
      disc(W - 20, D - 2, H + 4, 5, 5, "#636570", "#3d3f4c");
      break;
    }
    case "ab_cross":
      box(W - 8, D + 2, 0, 2, 2, 24, "#76553f");
      box(W - 22, D + 3, 18, 20, 2, 5, "#f2d078");
      for (let z = 18; z < 23; z++) put(W - 23 - Math.min(z - 18, 22 - z), D + 4, z, "#f2d078");
      crate(4, D + 1, 0);
      break;
    case "ab_lamp":
      for (const x of [7, W - 10]) {
        box(x, D + 3, 0, 2, 2, 22, "#654c3a");
        lantern(x + 2, D + 5, 18, "#ffde92");
        lantern(x - 3, D + 4, 13, "#f0a572");
      }
      break;
    case "ab_rhythm":
      box(7, D, 0, W - 14, 9, 4, "#aa7551");
      awning(3, W - 3, 8, ["#996387", "#ba7a88"]);
      for (const x of [7, W - 14]) {
        box(x, D + 1, H - 21, 7, 2, 14, "#94556b");
        for (let i = 0; i < 7; i++) put(x + i, D + 2, H - 9, "#e3af72");
        lantern(x + 4, D + 3, 6);
      }
      break;
    case "ab_garland":
      for (const x of [6, 16, W - 17, W - 8]) {
        box(x - 2, D + 1, 0, 6, 6, 4, "#9f674c");
        box(x, D + 3, 4, 2, 2, 6, "#5d8150");
      }
      for (const [x, y, z] of [[8, D + 3, 10], [18, D + 3, 10], [W - 14, D + 3, 10], [W - 6, D + 3, 10]]) {
        disc(x, y, z, 3, 2, "#efb4b2", "#bf697c");
      }
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI * 2 * i / 16;
        const x = Math.round(c + Math.cos(angle) * 9), z = Math.round(H - 8 + Math.sin(angle) * 7);
        disc(x, D + 1, z, 2, 2, i % 3 === 0 ? "#e1a0b2" : "#789157", "#637a45");
      }
      break;
  }
}
