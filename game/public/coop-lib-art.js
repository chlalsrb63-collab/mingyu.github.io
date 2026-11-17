// Library genre order follows defs.coop.lib.genres. The cover matches the shelf label.
const covers = [
  ["#839aee", "#4a6ad0", "#342d67"], // Mystery
  ["#9aedeb", "#40c8d8", "#296179"], // Science fiction
  ["#a9d77a", "#5ab050", "#355550"], // Science
  ["#feb5c2", "#f070a8", "#864469"], // Romance
  ["#ffd08c", "#f0a040", "#8a4b50"], // Web fiction
  ["#caabfb", "#a070e0", "#5d407d"], // Fantasy
  ["#e67863", "#b83838", "#693144"], // Horror
  ["#fff0a0", "#f0d840", "#886150"], // Comedy
];
const bindings = {
  x: "#241b2c", p: "#f6e5bf", q: "#bc966d", b: "#eaba78",
};
const book = [
  "",
  ".....xxxxxxxxx",
  "....xlllllllllx",
  "....xlmmmmmmmmsx",
  "...xlmmmmmmmmmsx",
  "...xlmmmmmmmmssx",
  "..xblmmmmmmmmssx",
  "..xslmmmmmmmssx",
  "..xslmmmmmmmssx",
  ".xblmmmmmmmsssx",
  ".xsllllllllssx",
  ".xxmsssssssssxx",
  ".xsppppppppppx",
  "..xsqqqqqqqqqx",
  "...xxxxxxxxxx",
];
const symbols = [
  [".##", "..#", ".#.", ".#."],  // Question mark
  ["..#..", ".###.", "#####", ".###", "..#"],  // Star
  [".##", ".##", "####", "#..#", ".##."],  // Flask
  ["##.##", "#####", ".###", "..#"],  // Heart
  ["####", "#...", "###", "#..."],  // Page
  ["#.#.#", "#####", ".###", ".###"],  // Crown
  [".###", "#.#.#", ".###"],  // Eye
  ["#..#", "....", "#..#", ".##."],  // Smile
];
const cache = [];

/** Return a cached 16 × 16 book canvas anchored at the upper-left. */
export function libraryBookSprite(genre) {
  const ramp = covers[genre];
  if (!ramp) return null;
  if (cache[genre]) return cache[genre];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const g = canvas.getContext("2d");
  const [l, m, s] = ramp;
  const colors = { ...bindings, l, m, s };
  book.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  });
  const stamp = symbols[genre], width = Math.max(...stamp.map((row) => row.length));
  const left = 9 - Math.floor(width / 2);
  g.fillStyle = genre === 7 ? "#794b53" : bindings.p;
  stamp.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") g.fillRect(left + x, 4 + y, 1, 1);
    }
  });
  cache[genre] = canvas;
  return canvas;
}
