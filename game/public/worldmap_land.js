// Native-pixel atlas illustration. Coordinates are in the same space as the outdoor map pins.
const STEP = 2;
const C = {
  deep: "#355462", sea: "#3d6572", swell: "#4b7280", foam: "#709699", shallow: "#648d8e", wetSand: "#98a48a",
  coast: "#5d6753", cliff: "#79775a", cliffLit: "#989074", lowland: "#9fa061", prairie: "#b9b679",
  lightGrass: "#d6cb91", hill: "#9ca365", grove: "#809058", woods: "#698455", jungle: "#5a8470",
  water: "#548c8f", waterLit: "#83aaaa", waterBright: "#b7cba9", waterEdge: "#607b69",
  rock: "#8c8275", rockLit: "#ac9b7f", rockDark: "#6c6b67", frost: "#bac4bc", ice: "#a8b9b8", iceShadow: "#8c9ea6", snow: "#dbe0cc",
  fall: "#b98d61", fallLit: "#cfa174", desert: "#d7ae72", beach: "#dfc28a", dune: "#c79460", duneLit: "#e7c98d",
  ash: "#74696e", slate: "#645c66", coal: "#554f5b", scar: "#9b6875", ember: "#cd8a83", crystal: "#7aa9aa",
};

export const ATLAS_WIDTH = 1056;
export const ATLAS_SOUTH = 602;

const outline = [
  [98, 207], [116, 172], [145, 157], [156, 133], [188, 127], [203, 101], [242, 99], [265, 71],
  [298, 58], [330, 68], [364, 53], [401, 56], [425, 73], [457, 73], [488, 52], [523, 64], [552, 49],
  [606, 56], [632, 75], [674, 55], [714, 62], [743, 37], [773, 33], [815, 51], [851, 40], [886, 46],
  [917, 32], [958, 40], [983, 61], [1008, 68], [1011, 96], [989, 120], [995, 147], [973, 174],
  [958, 197], [977, 221], [970, 245], [989, 270], [977, 291], [1008, 307], [1003, 334], [1023, 365],
  [996, 390], [991, 420], [968, 438], [971, 471], [941, 487], [933, 519], [902, 535], [882, 558],
  [853, 566], [822, 555], [794, 568], [759, 561], [736, 545], [699, 551], [666, 533], [643, 543],
  [610, 524], [578, 531], [554, 511], [526, 521], [500, 508], [472, 522], [443, 514], [426, 539],
  [396, 543], [379, 568], [352, 562], [324, 572], [300, 551], [276, 555], [263, 525], [238, 525],
  [223, 508], [205, 509], [192, 483], [161, 480], [139, 458], [115, 458], [111, 427], [130, 399],
  [105, 382], [111, 358], [93, 336], [111, 307], [93, 284], [113, 260], [90, 247], [104, 230],
];

const islands = [
  [[23, 166], [37, 148], [59, 150], [70, 164], [53, 183], [40, 183]],
  [[39, 203], [51, 192], [65, 197], [61, 211], [46, 215]],
  [[53, 401], [66, 384], [83, 384], [94, 402], [81, 418], [63, 419]],
  [[137, 532], [146, 513], [164, 504], [178, 515], [174, 532], [151, 542]],
  [[198, 556], [208, 543], [226, 543], [234, 556], [224, 566], [209, 568]],
  [[469, 567], [489, 548], [510, 550], [518, 570], [497, 580], [476, 578]],
  [[587, 560], [607, 556], [633, 566], [632, 581], [603, 583]],
  [[967, 543], [981, 528], [1000, 526], [1012, 550], [993, 563], [974, 558]],
];

const turf = [[120, 254], [180, 205], [252, 207], [264, 167], [236, 137], [266, 99], [315, 82], [356, 79], [408, 98], [440, 132], [494, 126], [529, 168], [565, 183], [583, 220], [552, 266], [516, 268], [466, 248], [426, 264], [379, 249], [344, 269], [300, 263], [256, 289], [202, 277], [166, 291], [139, 278]];
const forest = [[412, 117], [435, 93], [473, 94], [491, 84], [529, 101], [566, 81], [611, 100], [650, 106], [678, 128], [660, 162], [680, 191], [644, 224], [600, 237], [576, 220], [541, 233], [532, 209], [496, 204], [464, 183], [431, 174]];
const northernIce = [[666, 87], [699, 60], [743, 37], [773, 33], [815, 51], [851, 40], [886, 46], [917, 32], [958, 40], [983, 61], [1008, 68], [1011, 96], [989, 120], [995, 147], [973, 174], [930, 179], [900, 171], [863, 183], [846, 167], [807, 168], [781, 145], [752, 141], [723, 117], [693, 115]];
const autumn = [[668, 125], [704, 124], [752, 142], [775, 151], [801, 177], [846, 178], [873, 190], [901, 179], [939, 190], [957, 208], [937, 234], [948, 258], [918, 278], [887, 263], [855, 277], [822, 267], [797, 285], [766, 271], [755, 240], [731, 230], [713, 208], [693, 203], [662, 183]];
const badlands = [[848, 278], [898, 264], [922, 248], [970, 245], [989, 270], [977, 291], [1008, 307], [1003, 334], [1023, 365], [996, 390], [991, 420], [968, 438], [935, 433], [908, 449], [876, 443], [862, 421], [831, 423], [801, 403], [802, 380], [789, 360], [805, 334], [843, 313]];
const sand = [[436, 460], [475, 434], [499, 445], [530, 426], [571, 432], [605, 391], [640, 404], [669, 395], [703, 413], [722, 392], [756, 410], [790, 391], [806, 414], [841, 427], [866, 424], [880, 444], [908, 455], [946, 435], [968, 438], [971, 471], [941, 487], [933, 519], [902, 535], [882, 558], [853, 566], [822, 555], [794, 568], [759, 561], [736, 545], [699, 551], [666, 533], [643, 543], [610, 524], [578, 531], [554, 511], [526, 521], [500, 508], [472, 522], [450, 510]];
const jungle = [[124, 392], [153, 355], [196, 372], [219, 346], [251, 360], [295, 347], [312, 365], [342, 371], [368, 401], [357, 430], [375, 455], [347, 486], [310, 481], [277, 514], [238, 525], [223, 508], [205, 509], [192, 483], [161, 480], [139, 458], [115, 458], [111, 427]];
const reefs = [[253, 504], [281, 472], [306, 478], [346, 462], [371, 471], [398, 461], [431, 475], [459, 471], [470, 492], [443, 514], [426, 539], [396, 543], [379, 568], [352, 562], [324, 572], [300, 551], [276, 555], [263, 525]];

const px = n => Math.round(n / STEP) * STEP;
const rect = (g, x, y, w, h, color) => {
  g.fillStyle = color;
  g.fillRect(px(x), px(y), Math.max(STEP, px(w)), Math.max(STEP, px(h)));
};

function poly(g, points, color) {
  const bottom = Math.max(...points.map(p => p[1]));
  g.fillStyle = color;
  for (let y = px(Math.min(...points.map(p => p[1]))); y <= bottom; y += STEP) {
    const cuts = [], row = y + STEP / 2;
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
      if (row >= Math.min(ay, by) && row < Math.max(ay, by)) cuts.push(ax + (bx - ax) * (row - ay) / (by - ay));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const a = px(cuts[i]), b = px(cuts[i + 1]);
      if (b > a) g.fillRect(a, y, b - a, STEP);
    }
  }
}

const move = (points, dx, dy) => points.map(([x, y]) => [x + dx, y + dy]);
function expand(points, factor) {
  const [cx, cy] = points.reduce(([x, y], [a, b]) => [x + a / points.length, y + b / points.length], [0, 0]);
  return points.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}

function steppedLine(g, points, width, color) {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], length = Math.max(1, Math.abs(bx - ax), Math.abs(by - ay));
    for (let j = 0; j <= length; j += STEP) rect(g, ax + (bx - ax) * j / length - width / 2, ay + (by - ay) * j / length - width / 2, width, width, color);
  }
}

const hash = (x, y) => (Math.imul(x ^ 0x654d7, 1597334677) ^ Math.imul(y ^ 0x3ab1, 3812015801)) >>> 0;
function contains(shape, x, y) {
  let inShape = false;
  for (let i = 0; i < shape.length; i++) {
    const [ax, ay] = shape[i], [bx, by] = shape[(i + 1) % shape.length];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inShape = !inShape;
  }
  return inShape;
}

function coastShelf(g, shape, fill, small = false) {
  const d = small ? 7 : 13;
  poly(g, move(expand(shape, small ? 1.30 : 1.052), 0, d), C.swell);
  poly(g, move(expand(shape, small ? 1.14 : 1.027), 0, d), C.shallow);
  poly(g, move(expand(shape, small ? 1.06 : 1.011), 0, d), C.wetSand);
  poly(g, move(shape, 0, d), C.coast);
  poly(g, move(shape, 0, d - 4), C.cliff);
  poly(g, move(shape, 0, 3), C.cliffLit);
  poly(g, shape, fill);
}

function seaMarks(g, w, h) {
  for (let y = 31; y < h - 14; y += 27) for (let x = 19; x < w - 20; x += 36) {
    const n = hash(x, y), a = x + (n % 21) - 10, b = y + ((n >>> 7) % 13) - 6;
    rect(g, a, b, 5 + (n % 5), 2, C.swell);
    if (n % 4 === 0) rect(g, a + 7, b + 4, 11, 2, "#547e85");
  }
  for (const [x, y] of [[58, 316], [73, 480], [518, 559], [1006, 474]]) {
    poly(g, [[x - 13, y], [x + 15, y - 2], [x + 8, y + 5], [x - 5, y + 6]], "#634d43");
    poly(g, [[x - 10, y], [x + 10, y - 1], [x + 6, y + 2], [x - 6, y + 3]], "#9b7456");
    poly(g, [[x - 1, y - 21], [x - 1, y - 2], [x - 10, y - 2], [x - 7, y - 9]], "#e2d6b1");
    poly(g, [[x + 2, y - 18], [x + 9, y - 7], [x + 11, y - 3], [x + 2, y - 3]], "#b5a989");
    rect(g, x - 13, y + 8, 15, 2, C.foam);
  }
}

function compass(g) {
  const x = 135, y = 81;
  const rosette = [[x, y - 34], [x + 7, y - 8], [x + 30, y], [x + 7, y + 8], [x, y + 28], [x - 7, y + 8], [x - 30, y], [x - 7, y - 8]];
  poly(g, expand(rosette, 1.11), "#28434f");
  poly(g, rosette, "#a79875");
  poly(g, [[x, y - 34], [x + 4, y - 6], [x, y], [x - 4, y - 6]], "#e5d3a5");
  poly(g, [[x, y], [x + 7, y - 8], [x + 30, y], [x + 7, y + 8]], "#c2ab81");
  rect(g, x - 3, y - 3, 6, 6, "#635f55");
  g.fillStyle = "#eddfb6"; g.font = "bold 10px Galmuri11, sans-serif"; g.textAlign = "center";
  g.fillText("북", x, y - 43);
}

function escarpments(g) {
  for (const [[x, y], w, h] of [[[263, 143], 77, 40], [[292, 138], 78, 34], [[380, 133], 83, 48], [[410, 168], 86, 36], [[635, 336], 76, 35]]) {
    const top = [[x - w * 0.48, y], [x - w * 0.45, y - h * 0.26], [x - w * 0.34, y - h * 0.38], [x - w * 0.18, y - h * 0.37], [x - w * 0.10, y - h * 0.52], [x + w * 0.20, y - h * 0.5], [x + w * 0.48, y - h * 0.12], [x + w * 0.47, y + h * 0.12], [x + w * 0.16, y + h * 0.26], [x - w * 0.32, y + h * 0.18]];
    poly(g, move(top, 0, h * 0.33), C.rockDark);
    poly(g, move(top, 0, h * 0.24), C.cliff);
    poly(g, move(top, 0, h * 0.09), C.cliffLit);
    poly(g, top, C.hill);
    poly(g, expand(top, 0.9), C.prairie);
    rect(g, x - w * 0.23, y - h * 0.20, w * 0.26, 2, C.lightGrass);
    rect(g, x - w * 0.18, y + h * 0.38, w * 0.13, 2, C.cliffLit);
    rect(g, x + w * 0.22, y + h * 0.28, w * 0.14, 2, C.rock);
  }
}

function mountain(g, x, y, w, h, style) {
  const [base, light, shade, cap, darkCap] = style;
  const [l, r] = [x - w * 0.53, x + w * 0.50];
  poly(g, [[l - 8, y], [x - 7, y - 15], [r, y - 4], [r + 12, y + 2], [x + w * 0.15, y + 9], [x - w * 0.30, y + 5]], shade);
  poly(g, [[l, y], [l + w * 0.18, y - h * 0.24], [x - w * 0.20, y - h * 0.42], [x - w * 0.12, y - h * 0.68], [x, y - h], [x + w * 0.08, y - h * 0.85], [x + w * 0.19, y - h * 0.54], [x + w * 0.34, y - h * 0.31], [r, y], [x + 5, y + 6]], base);
  poly(g, [[l, y], [l + w * 0.18, y - h * 0.23], [x - w * 0.20, y - h * 0.40], [x, y - h], [x - w * 0.04, y - h * 0.60], [x + w * 0.08, y - h * 0.32], [x - w * 0.05, y - 2]], light);
  poly(g, [[x, y - h], [x + w * 0.08, y - h * 0.85], [x + w * 0.19, y - h * 0.54], [x + w * 0.34, y - h * 0.31], [r, y], [x + w * 0.18, y + 3], [x + w * 0.08, y - h * 0.32], [x - w * 0.04, y - h * 0.59]], shade);
  if (cap) {
    poly(g, [[x, y - h], [x + w * 0.08, y - h * 0.85], [x + w * 0.19, y - h * 0.54], [x + w * 0.09, y - h * 0.62], [x + w * 0.06, y - h * 0.46], [x - w * 0.04, y - h * 0.57]], darkCap);
    poly(g, [[x, y - h], [x - w * 0.04, y - h * 0.57], [x - w * 0.09, y - h * 0.63], [x - w * 0.13, y - h * 0.53], [x - w * 0.24, y - h * 0.43], [x - w * 0.13, y - h * 0.69]], cap);
  }
  rect(g, x - w * 0.12, y - h * 0.27, w * 0.12, 2, base);
}

function ranges(g) {
  const rock = [C.rock, C.rockLit, C.rockDark];
  const frozen = [C.ice, C.frost, C.iceShadow, C.snow, "#b9c7cb"];
  const burnt = [C.ash, "#8c7777", C.slate];
  const sandstone = ["#aa845f", "#bc9469", "#8b7360"];
  for (const m of [[473, 102, 75, 44], [548, 90, 74, 48], [601, 123, 68, 51], [647, 121, 92, 57], [684, 164, 88, 65], [690, 203, 65, 47], [663, 239, 65, 43], [660, 288, 92, 66]]) mountain(g, ...m, rock);
  for (const m of [[775, 84, 72, 52], [829, 95, 80, 50], [873, 85, 69, 51], [957, 104, 75, 58], [923, 134, 94, 71], [985, 136, 55, 35], [953, 168, 73, 41]]) mountain(g, ...m, frozen);
  for (const m of [[972, 292, 71, 75], [934, 306, 91, 77], [859, 333, 91, 59], [989, 358, 65, 81], [965, 402, 67, 73], [898, 426, 84, 54]]) mountain(g, ...m, burnt);
  for (const m of [[751, 429, 81, 53], [797, 446, 75, 47], [850, 470, 67, 42], [912, 484, 83, 55]]) mountain(g, ...m, sandstone);
}

function stream(g, points, width) {
  steppedLine(g, points, width + 4, C.waterEdge);
  steppedLine(g, points, width, C.water);
  steppedLine(g, move(points, -2, -1), Math.max(2, width / 2), C.waterLit);
}

function waterways(g) {
  stream(g, [[495, 84], [489, 115], [455, 136], [427, 154], [429, 189], [398, 210], [375, 248], [396, 269], [395, 285], [424, 313], [456, 336], [462, 355], [444, 393], [462, 419], [455, 441], [430, 465], [444, 498], [425, 530], [417, 542]], 7);
  stream(g, [[597, 120], [578, 147], [584, 176], [564, 197], [539, 203], [507, 225], [472, 235], [442, 257], [395, 269]], 4);
  stream(g, [[139, 214], [166, 212], [202, 240], [244, 246], [268, 229], [294, 238], [324, 253], [360, 249], [375, 248]], 4);
  // Two ledges break the waterway into a waterfall and a foaming pool.
  rect(g, 423, 150, 10, 22, C.waterLit);
  rect(g, 424, 153, 4, 17, C.waterBright);
  rect(g, 430, 160, 3, 11, C.waterBright);
  poly(g, [[414, 171], [424, 168], [436, 169], [446, 175], [435, 181], [419, 179]], C.waterLit);
  rect(g, 421, 174, 16, 2, "#d4d7ac");
  poly(g, [[535, 475], [548, 447], [580, 438], [618, 446], [627, 469], [602, 490], [570, 496], [544, 489]], "#9bac69");
  poly(g, [[546, 472], [559, 454], [581, 451], [602, 458], [611, 469], [598, 482], [573, 488], [551, 481]], C.waterEdge);
  poly(g, [[549, 470], [563, 456], [582, 453], [599, 460], [607, 468], [596, 478], [574, 484], [554, 479]], "#72a4a0");
  rect(g, 565, 468, 25, 2, C.waterBright);
  rect(g, 579, 472, 16, 2, C.waterBright);
}

function tree(g, x, y, s, [shade, base, light], canopy) {
  rect(g, x - s * 0.10, y - s * 0.12, 3, s * 0.24, "#655e4d");
  const shape = canopy ? [[x - s * 0.47, y - s * 0.23], [x - s * 0.58, y - s * 0.43], [x - s * 0.34, y - s * 0.66], [x - s * 0.24, y - s * 0.91], [x + s * 0.17, y - s], [x + s * 0.42, y - s * 0.79], [x + s * 0.56, y - s * 0.44], [x + s * 0.4, y - s * 0.20], [x, y - s * 0.15]] : [[x - s * 0.43, y - s * 0.17], [x - s * 0.31, y - s * 0.41], [x - s * 0.24, y - s * 0.41], [x - s * 0.32, y - s * 0.54], [x, y - s], [x + s * 0.29, y - s * 0.53], [x + s * 0.21, y - s * 0.51], [x + s * 0.42, y - s * 0.18], [x + s * 0.12, y - s * 0.10]];
  poly(g, shape, shade);
  poly(g, expand(move(shape, -s * 0.06, -s * 0.06), 0.75), base);
  rect(g, x - s * 0.15, y - s * 0.58, s * 0.21, Math.max(2, s * 0.14), light);
}

function grove(g, cx, cy, rx, ry, colors, canopy, busy, shape) {
  for (let y = cy - ry + 7; y < cy + ry; y += 13) for (let x = cx - rx + 4; x < cx + rx; x += 14) {
    const n = hash(x, y), a = x + (n % 15) - 7, b = y + ((n >>> 7) % 11) - 5;
    if ((a - cx) ** 2 / rx ** 2 + (b - cy) ** 2 / ry ** 2 >= 1 || n % 11 < 3 || !contains(shape, a, b) || busy(a, b)) continue;
    tree(g, a, b, 11 + ((n >>> 11) % 10), colors, canopy);
  }
}

function foliage(g, busy) {
  const pine = ["#49654c", "#61774d", "#83935f"], green = ["#56704e", "#73884e", "#a0a562"];
  const jungleColors = ["#3d655e", "#587852", "#87a268"], maple = ["#895f52", "#af744e", "#d69c60"];
  for (const [x, y, rx, ry] of [[213, 153, 72, 38], [277, 218, 75, 32], [168, 285, 60, 44], [246, 322, 73, 37]]) grove(g, x, y, rx, ry, green, true, busy, outline);
  for (const [x, y, rx, ry] of [[460, 137, 42, 36], [602, 151, 73, 42], [560, 201, 70, 32], [496, 183, 58, 48]]) grove(g, x, y, rx, ry, pine, false, busy, forest);
  for (const [x, y, rx, ry] of [[193, 429, 78, 70], [302, 406, 63, 58], [278, 475, 49, 25]]) grove(g, x, y, rx, ry, jungleColors, true, busy, jungle);
  for (const [x, y, rx, ry] of [[756, 179, 66, 32], [816, 199, 53, 34], [873, 252, 67, 33]]) grove(g, x, y, rx, ry, maple, true, busy, autumn);
  grove(g, 912, 153, 53, 24, ["#729095", "#8da6a1", C.snow], false, busy, northernIce);
}

function duneField(g, busy) {
  for (let y = 423; y < 545; y += 22) for (let x = 475; x < 948; x += 42) {
    const n = hash(x, y), a = x + (n % 28) - 14, b = y + ((n >>> 8) % 17) - 8;
    if (!contains(sand, a, b) || !contains(sand, a + 23, b) || busy(a, b) || n % 5 < 2) continue;
    const w = 20 + n % 19, h = 6 + (n % 3);
    poly(g, [[a - w * 0.52, b], [a - w * 0.20, b - h], [a + w * 0.11, b - h * 1.30], [a + w * 0.50, b - h * 0.83], [a + w * 0.36, b + 3], [a + w * 0.04, b + 2], [a - 4, b - h * 0.26]], C.dune);
    steppedLine(g, [[a - w * 0.42, b - 1], [a - w * 0.19, b - h], [a + w * 0.11, b - h * 1.30], [a + w * 0.45, b - h * 0.82]], 2, C.duneLit);
  }
}

function landmarks(g) {
  // Wind-bent palms, reef shallows and beach rocks.
  for (const [x, y] of [[284, 527], [303, 513], [392, 506], [418, 519], [548, 466], [567, 450], [591, 449], [609, 482]]) {
    steppedLine(g, [[x, y], [x + 3, y - 7], [x + 3, y - 16]], 2, "#866c50");
    poly(g, [[x - 10, y - 12], [x - 7, y - 17], [x + 3, y - 17], [x + 12, y - 15], [x + 14, y - 11], [x + 4, y - 14], [x + 5, y - 9], [x + 1, y - 10], [x + 2, y - 14], [x - 6, y - 11]], "#668456");
    rect(g, x - 4, y - 17, 6, 2, "#8fa060");
  }
  for (const [x, y] of [[333, 557], [360, 566], [300, 548], [399, 547], [410, 554]]) {
    rect(g, x, y, 12, 2, C.waterLit);
    rect(g, x + 3, y + 4, 6, 2, "#c4bca1");
  }
  // Crystal outcrops alongside the old road and a magma scar across the rift easterly slope.
  for (const [x, y, s] of [[678, 273, 19], [688, 279, 15], [747, 318, 23], [738, 320, 12], [767, 312, 15]]) {
    poly(g, [[x, y], [x - s * 0.17, y - s * 0.39], [x + 1, y - s], [x + s * 0.23, y - s * 0.66], [x + s * 0.30, y - 3]], "#668690");
    poly(g, [[x, y], [x - s * 0.17, y - s * 0.39], [x + 1, y - s], [x + s * 0.11, y - s * 0.60], [x + s * 0.11, y - 2]], C.crystal);
  }
  for (const part of [[[893, 291], [881, 317], [885, 345], [870, 363], [882, 391], [870, 412]], [[976, 363], [941, 373], [931, 389], [915, 397], [882, 391]], [[845, 369], [865, 365], [870, 363]]]) {
    steppedLine(g, part, 7, C.coal);
    steppedLine(g, part, 4, C.scar);
    steppedLine(g, part.slice(1, -1), 2, C.ember);
  }
  // Ruined pylons sit back from the brighter city pin.
  for (const [x, y, h] of [[337, 314, 17], [365, 294, 20], [480, 321, 17], [508, 309, 20], [527, 293, 13]]) {
    poly(g, [[x, y], [x, y - h], [x + 5, y - h - 3], [x + 10, y - h + 2], [x + 10, y - 2], [x + 5, y + 2]], "#777778");
    rect(g, x + 2, y - h + 2, 4, h - 1, "#a29c89");
    rect(g, x + 2, y - h + 6, 3, 2, "#cba781");
  }
}

/** Draw once into the unscaled chart canvas. The renderer composites routes and game state above it. */
export function paintLandscape(g, chart) {
  const w = chart.width, south = chart.inset ?? chart.height - 10;
  rect(g, 0, 0, w, chart.height, "#b79871");
  rect(g, 5, 5, w - 10, chart.height - 10, "#4a5654");
  rect(g, 9, 9, w - 18, south - 12, C.deep);
  rect(g, 13, 13, w - 26, south - 19, C.sea);
  seaMarks(g, w, south);
  islands.forEach((shape, i) => coastShelf(g, shape, i > 4 ? C.beach : C.grove, true));
  coastShelf(g, outline, C.lowland);
  poly(g, turf, C.prairie);
  poly(g, forest, C.grove);
  poly(g, expand(forest, 0.83), C.woods);
  poly(g, jungle, C.jungle);
  poly(g, reefs, C.beach);
  poly(g, sand, C.desert);
  poly(g, northernIce, C.frost);
  poly(g, expand(northernIce, 0.88), C.snow);
  poly(g, autumn, C.fall);
  poly(g, move(expand(autumn, 0.87), -8, -5), C.fallLit);
  poly(g, badlands, C.ash);
  poly(g, expand(badlands, 0.89), C.slate);
  poly(g, [[298, 320], [330, 283], [374, 282], [405, 296], [433, 308], [455, 309], [492, 278], [532, 268], [578, 280], [615, 308], [595, 352], [537, 360], [502, 374], [461, 377], [422, 369], [371, 389], [334, 372], [318, 354]], "#9d9882");
  const nodes = [...chart.nodes.values()].filter(n => n.d.kind !== "in");
  const busy = (x, y) => nodes.some(n => Math.abs(n.x - x) < 45 && y > n.y - 34 && y < n.y + 34);
  // New editor maps outside the curated shore still have ground underneath their markers.
  for (const n of nodes) if (!contains(outline, n.x, n.y)) {
    const x = n.x, y = n.y;
    coastShelf(g, [[x - 65, y - 7], [x - 54, y - 28], [x - 26, y - 42], [x + 15, y - 38], [x + 49, y - 23], [x + 61, y + 8], [x + 41, y + 26], [x - 8, y + 33], [x - 50, y + 24]], C.hill, true);
  }
  escarpments(g);
  ranges(g);
  waterways(g);
  foliage(g, busy);
  duneField(g, busy);
  landmarks(g);
  compass(g);
}

// Intermediate waypoints follow the painted shore, passes and valleys. Only real gate edges use these roads.
const roads = [
  ["willow", "town", [[212, 227], [257, 219], [298, 228]]],
  ["town", "meadow", [[332, 174], [358, 157], [364, 133]]],
  ["town", "city", [[348, 245], [331, 281], [350, 308]]],
  ["meadow", "forest", [[392, 106], [431, 115], [483, 124], [522, 112]]],
  ["forest", "crypt", [[598, 137], [625, 148], [658, 130], [687, 127]]],
  ["forest", "cave", [[555, 159], [577, 215], [606, 244], [643, 265], [688, 269]]],
  ["forest", "maple", [[590, 108], [633, 103], [669, 106], [693, 156], [742, 176], [770, 215]]],
  ["crypt", "city", [[722, 173], [682, 195], [637, 185], [603, 214], [542, 222], [496, 250], [449, 272], [409, 278]]],
  ["city", "sewer", [[399, 332], [435, 346], [479, 351], [524, 341]]],
  ["city", "jungle", [[339, 360], [313, 400], [276, 421], [241, 422]]],
  ["sewer", "cave", [[593, 331], [624, 320], [648, 327], [677, 309]]],
  ["cave", "abyss", [[744, 305], [776, 318], [801, 353], [845, 357], [894, 348]]],
  ["maple", "abyss", [[849, 263], [861, 305], [894, 321]]],
  ["cave", "oasis", [[704, 351], [666, 370], [641, 397], [655, 425], [641, 447]]],
  ["maple", "frostkeep", [[856, 204], [846, 166], [865, 141], [883, 117]]],
  ["jungle", "coast", [[229, 459], [266, 470], [301, 499], [340, 510]]],
  ["coast", "oasis", [[414, 510], [466, 486], [524, 491], [577, 476]]],
  ["coast", "dunesea", [[408, 531], [466, 505], [516, 511], [563, 515], [627, 504], [680, 526], [738, 536], [805, 522]]],
  ["oasis", "dunesea", [[663, 473], [708, 462], [760, 480], [803, 501]]],
];
const roadKey = (a, b) => a < b ? `${a}/${b}` : `${b}/${a}`;
const byRoad = new Map(roads.map(([a, b, points]) => [roadKey(a, b), a < b ? points : points.slice().reverse()]));

function smooth(points) {
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(i + 2, points.length - 1)];
    const amount = Math.max(2, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / 8));
    for (let t = 1; t <= amount; t++) {
      const u = t / amount, u2 = u * u, u3 = u2 * u;
      out.push(b.map((v, axis) => Math.round(0.5 * (2 * v + (-a[axis] + c[axis]) * u + (2 * a[axis] - 5 * v + 4 * c[axis] - d[axis]) * u2 + (-a[axis] + 3 * v - 3 * c[axis] + d[axis]) * u3))));
    }
  }
  return out;
}

/** Shared by the base and highlighted route so traversal runs over the same road pixels. */
export function terrainTrail(a, b) {
  const forward = a.d.id < b.d.id, src = forward ? a : b, dest = forward ? b : a;
  const from = [src.x, src.y], to = [dest.x, dest.y];
  const dx = dest.x - src.x, dy = dest.y - src.y, dist = Math.hypot(dx, dy) || 1;
  const n = Math.min(22, dist / 6) * (hash(src.x, dest.y) % 2 ? 1 : -1);
  const mids = byRoad.get(roadKey(src.d.id, dest.d.id)) || [
    [src.x + dx * 0.31 - dy / dist * n, src.y + dy * 0.31 + dx / dist * n],
    [src.x + dx * 0.69 + dy / dist * n * 0.55, src.y + dy * 0.69 - dx / dist * n * 0.55],
  ];
  const points = smooth([from, ...mids, to]);
  return forward ? points : points.reverse();
}
