/** Small, opaque-pixel dioramas for the world map. The surrounding canvas is transparent. */
const W = 60, H = 44;
const INK = "#363044";
const cache = new Map();

const turf = ["#91aa59", "#5a743d", "#3d5135"];
const woodland = ["#66865a", "#46664f", "#314446"];
const limestone = ["#a69a7b", "#736779", "#564958"];
const lake = ["#58aeb5", "#456f8b", "#384d73"];
const dust = ["#e0ae65", "#aa794d", "#765244"];
const flower = "#ffe7ac";

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

// Scan at pixel centers so slopes stay crisp at native atlas size.
function poly(g, points, color) {
  g.fillStyle = color;
  for (let y = Math.min(...points.map(p => p[1])); y < Math.max(...points.map(p => p[1])); y++) {
    const row = y + 0.5, abscissas = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
      if (row < Math.min(y0, y1) || row >= Math.max(y0, y1)) continue;
      abscissas.push(x0 + (x1 - x0) * (row - y0) / (y1 - y0));
    }
    abscissas.sort((a, b) => a - b);
    for (let i = 0; i + 1 < abscissas.length; i += 2) {
      const x0 = Math.ceil(abscissas[i] - 0.5), x1 = Math.ceil(abscissas[i + 1] - 0.5);
      g.fillRect(x0, y, x1 - x0, 1);
    }
  }
}

function ground(g, [top, face, dark]) {
  poly(g, [[3, 26], [25, 16], [44, 17], [57, 25], [57, 32], [35, 42], [25, 42], [3, 33]], INK);
  poly(g, [[4, 29], [29, 37], [56, 28], [56, 31], [34, 41], [25, 41], [4, 32]], dark);
  poly(g, [[4, 27], [28, 35], [56, 26], [56, 29], [33, 39], [25, 39], [4, 31]], face);
  poly(g, [[4, 26], [26, 17], [43, 18], [56, 25], [33, 36], [25, 36], [4, 29]], top);
  rect(g, 19, 37, 3, 1, dark);
  rect(g, 39, 36, 4, 1, top);
}

function fir(g, x, y, h, [light, mid, dark]) {
  rect(g, x - 1, y - 4, 3, 5, "#6e5146");
  poly(g, [[x, y - h], [x + 5, y - 8], [x + 3, y - 8], [x + 7, y - 3], [x, y - 1], [x - 7, y - 4], [x - 4, y - 8], [x - 5, y - 8]], INK);
  poly(g, [[x, y - h + 2], [x + 4, y - 8], [x + 2, y - 7], [x + 5, y - 4], [x, y - 2], [x - 5, y - 4]], dark);
  poly(g, [[x, y - h + 2], [x + 2, y - 8], [x, y - 8], [x + 2, y - 5], [x - 5, y - 4]], mid);
  rect(g, x - 1, y - h + 4, 2, 2, light);
}

function palm(g, x, y, leaves) {
  poly(g, [[x - 2, y], [x - 2, y - 7], [x + 1, y - 13], [x + 4, y - 13], [x + 1, y - 7], [x + 1, y]], INK);
  rect(g, x - 1, y - 6, 1, 5, "#c08756");
  rect(g, x, y - 10, 1, 4, "#c08756");
  poly(g, [[x + 2, y - 14], [x - 3, y - 17], [x - 8, y - 14], [x - 9, y - 10], [x - 3, y - 13], [x, y - 12], [x - 4, y - 8], [x + 1, y - 9], [x + 4, y - 12], [x + 11, y - 8], [x + 10, y - 13], [x + 6, y - 15], [x + 7, y - 17], [x + 11, y - 18], [x + 6, y - 19]], "#344b44");
  poly(g, [[x + 2, y - 13], [x - 3, y - 16], [x - 7, y - 14], [x - 7, y - 12], [x - 3, y - 14], [x + 2, y - 12], [x + 6, y - 14], [x + 9, y - 12], [x + 7, y - 14], [x + 3, y - 14], [x + 6, y - 18], [x + 4, y - 17]], leaves);
  rect(g, x + 1, y - 12, 2, 2, "#c89b55");
}

function cottage(g, x, y, [roof, side, highlight]) {
  poly(g, [[x - 2, y - 8], [x + 6, y - 17], [x + 10, y - 17], [x + 18, y - 12], [x + 18, y - 3], [x + 8, y + 2], [x - 2, y - 2]], INK);
  poly(g, [[x - 1, y - 7], [x + 8, y - 6], [x + 8, y + 1], [x - 1, y - 2]], "#e2c393");
  poly(g, [[x + 8, y - 7], [x + 17, y - 12], [x + 17, y - 4], [x + 8, y + 1]], "#aa895f");
  poly(g, [[x - 1, y - 8], [x + 7, y - 16], [x + 11, y - 7], [x + 8, y - 5]], roof);
  poly(g, [[x + 7, y - 16], [x + 10, y - 16], [x + 17, y - 12], [x + 17, y - 10], [x + 11, y - 7]], side);
  poly(g, [[x + 2, y - 10], [x + 7, y - 15], [x + 8, y - 13], [x + 4, y - 9]], highlight);
  rect(g, x + 3, y - 5, 3, 4, INK);
  rect(g, x + 12, y - 7, 3, 2, flower);
}

function doorway(g, x, y, [stone, lit, dark, opening]) {
  poly(g, [[x - 13, y], [x - 13, y - 16], [x - 10, y - 16], [x - 10, y - 20], [x - 6, y - 23], [x + 6, y - 23], [x + 10, y - 20], [x + 13, y - 15], [x + 13, y], [x + 4, y + 3], [x - 6, y + 3]], INK);
  poly(g, [[x - 12, y - 1], [x - 12, y - 15], [x - 9, y - 15], [x - 9, y - 19], [x - 5, y - 22], [x + 5, y - 22], [x + 9, y - 19], [x + 12, y - 15], [x + 12, y - 1], [x + 4, y + 2], [x - 6, y + 2]], stone);
  rect(g, x - 6, y - 20, 11, 2, lit);
  rect(g, x - 11, y - 14, 4, 2, lit);
  rect(g, x - 10, y - 9, 4, 1, dark);
  rect(g, x + 7, y - 13, 4, 2, dark);
  rect(g, x + 8, y - 6, 4, 1, dark);
  poly(g, [[x - 6, y + 1], [x - 6, y - 13], [x - 3, y - 17], [x + 3, y - 17], [x + 7, y - 13], [x + 7, y + 1]], INK);
  poly(g, [[x - 4, y], [x - 4, y - 12], [x - 2, y - 14], [x + 3, y - 14], [x + 5, y - 12], [x + 5, y]], opening);
  rect(g, x - 5, y + 1, 13, 1, dark);
}

function crystal(g, x, y, h, [body, shade, light]) {
  poly(g, [[x - 4, y - h + 6], [x, y - h], [x + 5, y - h + 7], [x + 5, y - 3], [x + 1, y + 1], [x - 5, y - 2]], INK);
  poly(g, [[x - 3, y - h + 6], [x, y - h + 2], [x + 4, y - h + 7], [x + 4, y - 3], [x + 1, y], [x - 4, y - 2]], shade);
  poly(g, [[x - 3, y - h + 6], [x, y - h + 2], [x + 1, y - 5], [x - 4, y - 2]], body);
  rect(g, x - 1, y - h + 6, 1, 5, light);
}

function meadow(g) {
  ground(g, turf);
  poly(g, [[12, 24], [13, 13], [26, 8], [37, 10], [42, 16], [42, 25], [29, 31], [21, 30]], "#425948");
  poly(g, [[13, 19], [14, 13], [26, 9], [37, 11], [41, 16], [30, 22], [21, 22]], "#a6b85d");
  poly(g, [[31, 18], [39, 15], [43, 16], [37, 20], [36, 28], [45, 26], [48, 28], [35, 34], [26, 32], [29, 28]], "#3c8198");
  poly(g, [[33, 18], [39, 16], [41, 16], [35, 20], [34, 28], [40, 28], [43, 29], [35, 32], [29, 31], [33, 28]], "#7dd4d0");
  rect(g, 34, 20, 1, 8, "#c2f1dc");
  rect(g, 22, 14, 2, 1, flower);
  rect(g, 17, 26, 2, 1, flower);
  rect(g, 48, 24, 1, 2, flower);
}

function forest(g) {
  ground(g, woodland);
  poly(g, [[6, 25], [16, 18], [31, 18], [39, 24], [35, 33], [23, 34], [23, 29]], "#3e4555");
  poly(g, [[10, 25], [20, 21], [28, 21], [36, 25], [32, 28], [29, 31], [25, 32], [26, 27]], "#478e91");
  rect(g, 18, 24, 4, 1, "#90cb9f");
  rect(g, 30, 26, 4, 1, "#90cb9f");
  const needles = ["#82a365", "#476b4f", "#375146"];
  fir(g, 17, 23, 17, needles);
  fir(g, 38, 20, 18, needles);
  fir(g, 46, 27, 16, needles);
  fir(g, 12, 30, 14, needles);
  rect(g, 35, 31, 3, 1, "#a8b86e");
}

function catacomb(g, sewer) {
  ground(g, sewer ? woodland : limestone);
  doorway(g, 31, 26, sewer ? ["#8a6156", "#b68c64", "#633d44", "#44644e"] : ["#827882", "#aaa090", "#5b4e61", "#352b49"]);
  if (sewer) {
    poly(g, [[27, 23], [35, 23], [38, 28], [45, 28], [43, 31], [31, 35], [24, 30]], "#689443");
    poly(g, [[31, 24], [33, 24], [36, 30], [40, 29], [41, 30], [32, 33], [30, 30]], "#a8bf61");
    for (const x of [27, 30, 33, 36]) rect(g, x, 15, 1, 10, "#554549");
    return;
  }
  for (const [x, y] of [[13, 28], [45, 29]]) {
    rect(g, x, y - 6, 5, 6, "#514a5c");
    rect(g, x + 1, y - 6, 3, 4, "#f09559");
    rect(g, x + 2, y - 7, 1, 4, flower);
  }
  rect(g, 27, 30, 12, 2, "#68606a");
  rect(g, 24, 33, 12, 1, "#736779");
}

function cave(g) {
  ground(g, lake);
  poly(g, [[6, 25], [11, 17], [17, 9], [25, 9], [30, 5], [39, 8], [46, 15], [51, 23], [38, 28], [22, 29]], INK);
  poly(g, [[8, 25], [17, 10], [25, 10], [30, 6], [39, 9], [48, 21], [43, 25], [34, 27], [19, 27]], "#4e5f7b");
  poly(g, [[16, 25], [23, 12], [30, 10], [37, 16], [44, 25], [33, 28], [19, 28]], "#33425e");
  const ice = ["#77c9c6", "#4a8ba7", "#d5f6db"];
  crystal(g, 17, 28, 13, ice);
  crystal(g, 23, 32, 18, ice);
  crystal(g, 41, 30, 11, ["#ab93cf", "#6c62a5", "#e6c5ed"]);
  rect(g, 30, 32, 5, 1, "#a2ded1");
}

function town(g, willow) {
  ground(g, ["#a5ac65", "#817454", "#4d5148"]);
  poly(g, [[5, 26], [17, 22], [22, 26], [34, 25], [50, 26], [35, 33], [26, 34], [15, 30]], "#c6a579");
  const red = ["#a4524c", "#783b42", "#ce7b57"];
  const blue = ["#6e7da0", "#596482", "#9aabc1"];
  cottage(g, 31, 24, willow ? red : blue);
  cottage(g, 11, 26, red);
  if (!willow) {
    poly(g, [[24, 30], [30, 27], [36, 28], [39, 31], [34, 34], [27, 33]], "#6a7880");
    poly(g, [[26, 30], [31, 28], [36, 29], [37, 31], [32, 33], [27, 32]], "#75bcbd");
    rect(g, 32, 27, 2, 4, "#cef1d2");
    return;
  }
  rect(g, 28, 22, 3, 8, "#805149");
  poly(g, [[19, 15], [22, 9], [27, 7], [34, 9], [38, 15], [37, 23], [34, 23], [33, 19], [25, 21], [24, 25], [20, 24]], "#415c51");
  poly(g, [[20, 15], [23, 10], [28, 8], [34, 10], [36, 15], [35, 20], [32, 18], [24, 19], [23, 23], [21, 22]], "#7ea663");
  rect(g, 25, 12, 6, 1, "#a9ba73");
}

function city(g) {
  ground(g, ["#919281", "#68687a", "#575163"]);
  poly(g, [[13, 30], [27, 24], [44, 24], [50, 28], [33, 35], [26, 35]], "#62647a");
  for (const [x, y, h] of [[12, 27, 17], [37, 25, 18], [25, 29, 23]]) {
    poly(g, [[x, y - h], [x + 4, y - h + 1], [x + 7, y - h - 1], [x + 10, y - h + 2], [x + 11, y], [x + 7, y + 2], [x, y]], INK);
    poly(g, [[x + 1, y - h + 2], [x + 7, y - h + 2], [x + 7, y + 1], [x + 1, y - 1]], "#89859e");
    poly(g, [[x + 7, y - h + 2], [x + 9, y - h + 3], [x + 10, y - 1], [x + 7, y + 1]], "#5c5677");
    rect(g, x + 2, y - h + 6, 3, 2, x === 25 ? "#f3a485" : "#78c3bc");
    rect(g, x + 2, y - h + 11, 3, 1, "#4b485f");
  }
  rect(g, 36, 31, 5, 1, "#d8bb8a");
}

function jungle(g) {
  ground(g, ["#6c9762", "#486f6b", "#374d5a"]);
  poly(g, [[7, 26], [16, 23], [29, 26], [43, 20], [51, 22], [41, 27], [30, 31], [24, 31]], "#384e69");
  poly(g, [[10, 26], [16, 24], [30, 27], [43, 21], [48, 22], [33, 29], [25, 30]], "#5b7081");
  rect(g, 19, 26, 4, 1, "#d8ba7f");
  rect(g, 37, 26, 4, 1, "#d8ba7f");
  palm(g, 18, 25, "#90ad56");
  palm(g, 33, 22, "#7eae65");
  palm(g, 43, 29, "#a2b857");
  rect(g, 28, 32, 3, 1, "#c2c17a");
}

function coast(g) {
  ground(g, lake);
  poly(g, [[6, 27], [26, 17], [42, 18], [47, 21], [40, 25], [30, 27], [23, 32], [17, 32]], "#e6cb92");
  poly(g, [[19, 33], [23, 32], [30, 27], [41, 24], [47, 21], [49, 22], [43, 26], [32, 29], [25, 33]], "#e1f5d5");
  rect(g, 43, 29, 5, 1, "#a5e4ce");
  rect(g, 34, 32, 5, 1, "#a5e4ce");
  palm(g, 18, 24, "#8db568");
  for (const [x, y, h] of [[32, 26, 8], [38, 25, 10]]) {
    poly(g, [[x - 3, y - 1], [x - 3, y - 6], [x - 1, y - 6], [x, y - 3], [x + 1, y - h], [x + 4, y - h], [x + 3, y - 1], [x + 1, y + 1]], "#ae536c");
    rect(g, x + 2, y - h, 2, 3, "#ef9185");
    rect(g, x - 3, y - 6, 1, 2, "#ef9185");
  }
}

function oasis(g) {
  ground(g, dust);
  poly(g, [[7, 25], [15, 18], [23, 16], [29, 17], [35, 22], [28, 24], [19, 22]], "#edc681");
  poly(g, [[28, 27], [36, 21], [46, 21], [52, 24], [46, 27], [37, 26]], "#f1d092");
  poly(g, [[16, 27], [24, 23], [32, 23], [38, 26], [28, 32], [19, 31]], "#958867");
  poly(g, [[18, 27], [25, 24], [31, 24], [36, 26], [27, 30], [21, 30]], "#5aa8a3");
  rect(g, 26, 28, 6, 1, "#bee7bf");
  palm(g, 18, 25, "#8e9854");
  palm(g, 37, 24, "#a5a961");
  rect(g, 39, 29, 6, 1, "#f1d092");
}

function autumn(g) {
  ground(g, ["#b89161", "#8a624d", "#614747"]);
  poly(g, [[11, 29], [20, 24], [35, 23], [47, 26], [36, 30], [28, 33]], "#aa9990");
  rect(g, 27, 28, 8, 2, "#cab690");
  const maple = (x, y, light, dark) => {
    rect(g, x - 1, y - 9, 3, 9, "#695045");
    poly(g, [[x - 9, y - 10], [x - 9, y - 15], [x - 6, y - 15], [x - 5, y - 19], [x - 1, y - 18], [x + 1, y - 21], [x + 5, y - 17], [x + 8, y - 17], [x + 8, y - 13], [x + 11, y - 12], [x + 8, y - 8], [x + 1, y - 7], [x - 5, y - 9]], INK);
    poly(g, [[x - 8, y - 11], [x - 8, y - 14], [x - 5, y - 14], [x - 4, y - 18], [x - 1, y - 17], [x + 1, y - 20], [x + 5, y - 16], [x + 7, y - 16], [x + 7, y - 12], [x + 9, y - 12], [x + 7, y - 9], [x + 1, y - 8]], dark);
    poly(g, [[x - 8, y - 12], [x - 4, y - 17], [x - 1, y - 16], [x + 1, y - 19], [x + 4, y - 16], [x + 4, y - 13], [x - 1, y - 11]], light);
  };
  maple(36, 24, "#e6ad63", "#b86b4d");
  maple(18, 30, "#e08e53", "#ae514f");
  rect(g, 38, 31, 3, 1, "#db7850");
  rect(g, 14, 32, 2, 1, "#f6b76f");
}

function abyss(g) {
  ground(g, ["#8c5265", "#713b56", "#472e4c"]);
  poly(g, [[10, 27], [16, 20], [26, 21], [30, 17], [42, 20], [53, 25], [39, 30], [33, 35], [21, 34]], "#51344d");
  poly(g, [[15, 27], [22, 24], [28, 27], [34, 21], [44, 24], [39, 26], [33, 32], [27, 32], [22, 28]], "#bd566f");
  const tear = [[24, 23], [29, 17], [25, 13], [36, 4], [33, 13], [40, 17], [29, 28], [23, 31]];
  poly(g, tear, "#593452");
  poly(g, [[26, 23], [31, 17], [28, 12], [34, 7], [31, 13], [37, 17], [28, 27], [25, 28]], "#e478a3");
  poly(g, [[28, 22], [33, 16], [31, 13], [35, 17], [29, 24], [26, 28]], "#ffd0bd");
  rect(g, 20, 16, 2, 2, "#c46a90");
  rect(g, 42, 13, 2, 2, "#c46a90");
}

function interior(g) {
  ground(g, limestone);
  poly(g, [[10, 25], [14, 25], [14, 19], [18, 19], [18, 14], [22, 11], [38, 11], [42, 15], [42, 20], [46, 20], [46, 25], [50, 25], [50, 28], [10, 28]], "#66536a");
  doorway(g, 30, 27, ["#b08b61", "#e4bd87", "#79554c", "#74515a"]);
  rect(g, 29, 16, 1, 10, "#9c715d");
  rect(g, 33, 22, 2, 2, flower);
  rect(g, 21, 30, 18, 1, "#71616c");
}

function frostkeep(g) {
  ground(g, ["#d4dfd3", "#8da5af", "#617c90"]);
  poly(g, [[9, 26], [11, 22], [43, 20], [50, 26], [40, 32], [25, 33]], "#b0bfbb");
  rect(g, 15, 16, 31, 13, "#566b7b");
  rect(g, 16, 17, 28, 9, "#a1b2b8");
  for (const [x, y, h] of [[12, 26, 12], [24, 25, 18], [38, 27, 14]]) {
    rect(g, x, y - h, 10, h, "#566b7b");
    rect(g, x + 1, y - h + 4, 6, h - 5, "#c6d2c9");
    poly(g, [[x - 2, y - h + 3], [x + 4, y - h - 5], [x + 6, y - h - 5], [x + 11, y - h + 2], [x + 5, y - h + 5]], "#668c9e");
    rect(g, x + 1, y - h + 1, 5, 2, "#e6edda");
    rect(g, x + 4, y - 7, 2, 4, "#4d6376");
  }
  rect(g, 24, 27, 12, 2, "#ebefd8");
  rect(g, 25, 31, 8, 1, "#f4ecd6");
}

function dunesea(g) {
  ground(g, ["#dcb371", "#a57b5a", "#745748"]);
  poly(g, [[8, 26], [17, 18], [27, 15], [43, 18], [46, 22], [34, 21], [27, 24], [17, 29]], "#a87852");
  poly(g, [[8, 26], [18, 17], [27, 14], [42, 17], [32, 17], [22, 21], [15, 26]], "#f2d596");
  poly(g, [[25, 30], [34, 25], [45, 24], [51, 27], [42, 27], [35, 31]], "#f1d092");
  rect(g, 39, 19, 3, 5, "#8d6850");
  rect(g, 36, 20, 3, 3, "#c69a65");
  rect(g, 26, 33, 9, 1, "#e6c18b");
}

function airship(g) {
  const wood = "#965b45", shade = "#674553", deck = "#d49b64";
  const brass = "#e8bc73", metal = "#a87553";
  const cloth = "#f3e6c3", clothShade = "#aebebb";
  const plum = "#914252", rose = "#d97864";

  // Long, offset cloud shapes keep the ship clear of a painted ground tile.
  poly(g, [[2, 40], [7, 40], [9, 38], [15, 38], [17, 39], [24, 39], [20, 42], [5, 42]], clothShade);
  rect(g, 7, 39, 9, 1, cloth);
  poly(g, [[47, 7], [51, 4], [55, 4], [57, 6], [60, 6], [57, 9], [48, 9]], clothShade);
  rect(g, 51, 5, 5, 1, cloth);

  // Tall forward mast, curved canvas and a furled aft vane.
  rect(g, 25, 3, 2, 21, INK);
  poly(g, [[27, 4], [31, 4], [35, 6], [40, 6], [36, 9], [31, 8], [27, 8]], INK);
  poly(g, [[27, 5], [31, 5], [36, 7], [37, 7], [35, 8], [31, 7], [27, 7]], rose);
  poly(g, [[26, 10], [33, 11], [39, 15], [40, 20], [30, 18], [24, 19], [21, 21], [23, 16]], INK);
  poly(g, [[27, 11], [33, 12], [38, 16], [39, 19], [31, 17], [24, 18], [25, 15]], clothShade);
  poly(g, [[27, 11], [33, 12], [37, 15], [36, 16], [31, 15], [25, 17]], cloth);
  poly(g, [[44, 18], [47, 12], [51, 11], [51, 14], [48, 19]], INK);
  poly(g, [[45, 18], [48, 13], [50, 12], [48, 17]], cloth);

  // Main hull. The lighter upper plane and angled bow make the heading readable.
  poly(g, [[2, 28], [11, 24], [33, 20], [47, 17], [54, 17], [59, 23], [57, 29], [49, 32], [36, 36], [23, 38], [15, 37], [9, 34], [6, 30]], INK);
  poly(g, [[7, 28], [17, 27], [47, 21], [57, 23], [56, 28], [47, 31], [35, 35], [23, 37], [15, 36], [10, 33]], shade);
  poly(g, [[8, 28], [17, 25], [47, 19], [54, 19], [57, 23], [54, 26], [42, 30], [25, 34], [16, 34], [10, 31]], wood);
  poly(g, [[9, 28], [17, 25], [48, 18], [53, 18], [56, 22], [48, 24], [25, 29], [16, 31], [11, 30]], deck);

  // A raised wheelhouse and a large brass pod set into the near side.
  poly(g, [[40, 22], [43, 17], [49, 15], [55, 18], [56, 21], [49, 25]], INK);
  poly(g, [[43, 19], [49, 16], [54, 18], [48, 21]], rose);
  poly(g, [[43, 19], [48, 21], [55, 18], [55, 21], [49, 24], [42, 22]], plum);
  rect(g, 49, 21, 3, 1, brass);
  poly(g, [[37, 31], [42, 27], [49, 26], [54, 28], [54, 32], [50, 35], [42, 36], [38, 34]], INK);
  poly(g, [[38, 31], [43, 28], [49, 27], [53, 29], [53, 32], [49, 34], [42, 35]], metal);
  poly(g, [[39, 31], [44, 28], [49, 27], [52, 29], [48, 31], [42, 32]], brass);
  rect(g, 49, 31, 3, 2, shade);

  // Short ventral wing and the brass stem where the model tapers to the bow.
  poly(g, [[27, 33], [36, 32], [34, 36], [28, 39], [22, 39], [24, 36]], INK);
  poly(g, [[27, 34], [34, 33], [32, 36], [27, 38], [24, 38]], clothShade);
  poly(g, [[27, 34], [33, 33], [30, 35], [25, 37]], cloth);
  rect(g, 11, 29, 6, 1, brass);
}

const terrains = new Map([
  ["frostkeep", frostkeep], ["dunesea", dunesea], ["airship", airship],
  ["town", town], ["willow", g => town(g, true)], ["city", city],
  ["meadow", meadow], ["forest", forest], ["jungle", jungle], ["coast", coast],
  ["desert", oasis], ["oasis", oasis], ["autumn", autumn], ["maple", autumn],
  ["crypt", catacomb], ["sewer", g => catacomb(g, true)], ["cave", cave],
  ["abyss", abyss], ["interior", interior],
  ["swamp", forest], ["deepsea", coast], ["frostlake", cave], ["icevault", cave],
  ["clockwork", city], ["skyruins", city], ["citadel", city], ["volcano", abyss], ["burrow", catacomb],
]);

export function terrainIcon(theme, kind) {
  const draw = kind === "in" ? interior : terrains.get(theme) || (kind === "town" ? town : kind === "dun" ? catacomb : meadow);
  if (cache.has(draw)) return cache.get(draw);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  draw(g);
  cache.set(draw, canvas);
  return canvas;
}
