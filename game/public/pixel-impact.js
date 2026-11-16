// A coloured material edge and a small white core, drawn as integer pixels at contact.
const IMPACT_PIXELS = {
  physical: [".....+.....", ".....+..o..", "..o.o+.oo..", "...o+++o...", "oooo+++oooo", "..o+++++o..", "...o+++o...", "..oo.+..o..", ".....+....."],
  bleed: [".........o.", "......oooo.", "....oo++o..", "...o++oo...", "..o++o.....", ".o++o..o...", ".ooo...oo..", "oo......o..", "..........."],
  fire: ["....o..o...", "..o.o.oo...", "...oo+ooo..", ".ooo+++oo..", ".oo+++++oo.", "..o+++++ooo", "..o++++oo..", "...ooooo...", "....ooo...."],
  cold: [".....+.....", "....o+o....", "....o+o..+.", ".+..o+o.o+.", ".o+.o+oo+o.", ".oo++++oo..", "..oo++oo...", "...oooo....", "....oo....."],
  lightning: [".......++..", "......++...", "...o.++....", "....++o..o.", "...++++oo..", ".....++o...", "....++.....", "...++..o...", "..++......."],
  poison: ["...ooo.....", "..o+++o.oo.", "..o+++oo+o.", "...oooooo..", ".ooo...oooo", "oo+oo..o++o", ".oooo..oooo", "..oo...ooo.", "....oo....."],
  dark: [".....oo....", "....oooo...", ".o.oo++oo..", "..oo+..+oo.", ".oo+....+oo", "..oo+..+oo.", ".o.oo++oo..", "....oooo...", ".....oo..o."],
  light: [".....+.....", ".....+.....", "....ooo....", ".o..o+o..o.", ".ooo+++ooo.", ".o..o+o..o.", "....ooo....", ".....+.....", ".....+....."],
};

// Residue moves away from each motif in a readable direction, even in a busy pack.
const MOTION = {
  physical: [[-1, -0.2], [1, -0.25], [-0.6, 0.6], [0.8, 0.55], [0.1, -0.9]],
  bleed: [[0.95, -0.7], [0.68, -0.4], [-0.8, 0.58], [-0.66, 0.25], [0.22, 0.45]],
  fire: [[-0.5, -0.95], [0.55, -0.9], [0.05, -1.2], [-0.72, 0.24], [0.83, 0.25]],
  cold: [[-0.72, -0.5], [0.76, -0.55], [-0.55, 0.4], [0.64, 0.58], [0, -1]],
  lightning: [[-1, -0.35], [1, 0.35], [-0.5, 0.64], [0.42, -0.75], [0.02, -1.1]],
  poison: [[-0.55, -0.52], [0.44, -0.65], [0.02, -0.8], [-0.82, -0.26], [0.81, -0.3]],
  dark: [[-0.76, -0.6], [0.69, -0.57], [-0.81, 0.4], [0.8, 0.5], [0.12, 0.8]],
  light: [[-0.95, 0], [0.95, 0], [0, -1], [0, 0.75], [0.63, -0.7]],
};

const stamps = new Map();
function impactStamp(type, color) {
  const key = type + color;
  if (stamps.has(key)) return stamps.get(key);
  const image = document.createElement("canvas");
  image.width = 22;
  image.height = 9;
  const g = image.getContext("2d");
  IMPACT_PIXELS[type].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const pixel = row[x];
      if (pixel === ".") continue;
      g.fillStyle = pixel === "+" ? "#fffaf0" : color;
      g.fillRect(x, y, 1, 1);
      g.fillStyle = color;
      g.fillRect(x + 11, y, 1, 1);
    }
  });
  stamps.set(key, image);
  return image;
}

export function impactLook(type, color) {
  const kind = Object.hasOwn(IMPACT_PIXELS, type) ? type : "physical";
  return { stamp: impactStamp(kind, color), motion: MOTION[kind] };
}

export function drawImpact(g, f, t) {
  const { stamp, motion } = f.look;
  const w = f.big ? 2 : 1;
  if (t < 0.62) {
    const scale = t < 0.15 && f.big ? 3 : f.graze ? 1 : 2;
    const frame = t < 0.2 ? 0 : 11;
    g.globalAlpha = (f.graze ? 0.58 : 0.95) * (1 - Math.max(0, t - 0.18) / 0.49);
    g.drawImage(stamp, frame, 0, 11, 9, Math.round(f.x - 5.5 * scale), Math.round(f.y - 4.5 * scale), 11 * scale, 9 * scale);
  }
  // Move the flecks out and lift or drop them, then let them disappear between hits.
  const distance = (f.big ? 26 : 16) * (0.3 + t * 0.9);
  g.globalAlpha = 0.88 * (1 - t);
  g.fillStyle = f.color;
  for (const [dx, dy] of motion) {
    g.fillRect(Math.round(f.x + dx * distance), Math.round(f.y + dy * distance + t * t * 4), w, w);
  }
  g.globalAlpha = 1;
}
