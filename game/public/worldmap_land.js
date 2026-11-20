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

function coastNormals(shape) {
  const normals = shape.map(([x, y], i) => {
    const [endX, endY] = shape[(i + 1) % shape.length];
    const dx = endX - x, dy = endY - y, length = Math.hypot(dx, dy);
    return [dy / length, -dx / length];
  });
  return normals.map(([x, y], i) => {
    const [prevX, prevY] = normals[(i + shape.length - 1) % shape.length];
    const miter = Math.max(0.7, 1 + x * prevX + y * prevY);
    return [(prevX + x) / miter, (prevY + y) / miter];
  });
}

function coastShelf(g, shape, fill, small = false) {
  const normals = coastNormals(shape);
  const cliffDepth = small ? 6 : 12;
  const shelf = (distance, color) => poly(g, shape.map(([x, y], i) => {
    const [nx, ny] = normals[i];
    return [x + nx * distance, y + ny * distance + cliffDepth];
  }), color);
  shelf(small ? 10 : 18, "#45707b");
  shelf(small ? 6 : 12, "#567e84");
  shelf(small ? 3 : 6, C.shallow);
  shelf(2, C.wetSand);
  poly(g, move(shape, 0, cliffDepth), C.coast);
  poly(g, move(shape, 0, cliffDepth - 3), C.cliff);
  poly(g, move(shape, 0, 3), C.cliffLit);
  for (const [i, [x, y]] of shape.entries()) {
    const [endX, endY] = shape[(i + 1) % shape.length];
    if (endX >= x || x - endX < 10) continue;
    const a = x + (endX - x) * 0.36, b = y + (endY - y) * 0.36;
    steppedLine(g, [[a, b + 4], [a - 2, b + cliffDepth - 1]], 2, C.coast);
    if (!small) steppedLine(g, [[a + 4, b + 4], [a + 2, b + cliffDepth - 2]], 2, C.cliffLit);
  }
  poly(g, shape, fill);
}

function seaMarks(g, w, h) {
  // Quiet bands of open water frame the composition, with short wakes near the shoals.
  poly(g, [[13, 120], [49, 97], [98, 128], [113, 178], [97, 247], [115, 292], [86, 355], [91, 423], [63, 469], [13, 499]], "#395e6b");
  poly(g, [[43, 569], [102, 546], [153, 558], [231, 569], [304, 586], [615, 586], [716, 561], [803, 573], [886, 583], [975, 571], [1043, 545], [1043, 581], [13, 581]], "#395c69");
  for (let y = 31; y < h - 14; y += 27) for (let x = 19; x < w - 20; x += 36) {
    const n = hash(x, y), a = x + (n % 21) - 10, b = y + ((n >>> 7) % 13) - 6;
    if (n % 7 < 2) continue;
    rect(g, a, b, 4 + (n % 7), 2, C.swell);
    if (n % 4 === 0) rect(g, a + 7, b + 4, 6, 2, "#547e85");
  }
  for (const [x, y] of [[58, 316], [73, 480], [518, 559], [1006, 474]]) {
    poly(g, [[x - 13, y], [x + 15, y - 2], [x + 8, y + 5], [x - 5, y + 6]], "#634d43");
    poly(g, [[x - 10, y], [x + 10, y - 1], [x + 6, y + 2], [x - 6, y + 3]], "#9b7456");
    poly(g, [[x - 1, y - 21], [x - 1, y - 2], [x - 10, y - 2], [x - 7, y - 9]], "#e2d6b1");
    poly(g, [[x + 2, y - 18], [x + 9, y - 7], [x + 11, y - 3], [x + 2, y - 3]], "#b5a989");
    rect(g, x - 13, y + 8, 15, 2, C.foam);
    rect(g, x + 7, y + 8, 7, 2, C.shallow);
    rect(g, x - 21, y + 12, 14, 2, C.swell);
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

function country(g) {
  // Wide, irregular masses establish the terrain before the small illustration marks.
  poly(g, turf, C.prairie);
  poly(g, [[133, 249], [166, 228], [195, 232], [213, 259], [245, 258], [268, 243], [298, 246], [321, 236], [358, 245], [375, 259], [343, 268], [301, 264], [255, 289], [202, 279], [168, 291], [140, 278]], "#adb375");
  poly(g, [[171, 211], [194, 181], [225, 167], [272, 166], [289, 186], [328, 188], [361, 174], [389, 184], [412, 208], [373, 227], [334, 212], [307, 226], [278, 217], [250, 234], [221, 223], [195, 228]], "#c2ba7e");
  poly(g, forest, C.grove);
  poly(g, [[434, 119], [451, 106], [471, 120], [495, 114], [511, 122], [536, 118], [567, 99], [611, 111], [634, 108], [666, 129], [649, 155], [663, 183], [632, 210], [607, 213], [590, 225], [560, 213], [548, 224], [530, 201], [499, 194], [482, 176], [455, 173], [440, 150]], C.woods);
  poly(g, [[453, 148], [470, 134], [495, 139], [525, 132], [545, 144], [585, 126], [623, 132], [612, 148], [585, 154], [563, 176], [544, 170], [518, 184], [484, 173]], "#768a54");
  poly(g, jungle, C.jungle);
  poly(g, [[122, 406], [153, 366], [198, 381], [216, 371], [244, 367], [270, 380], [296, 366], [324, 380], [349, 405], [333, 430], [352, 453], [333, 467], [307, 461], [282, 481], [263, 475], [240, 500], [209, 498], [199, 478], [164, 471], [140, 447], [122, 449]], "#527a64");
  poly(g, [[144, 426], [173, 404], [191, 405], [217, 389], [234, 396], [266, 387], [282, 399], [296, 395], [320, 415], [303, 438], [271, 442], [253, 465], [235, 454], [216, 468], [195, 457], [164, 463]], "#678855");
  poly(g, reefs, C.beach);
  poly(g, [[270, 511], [288, 490], [326, 497], [349, 479], [374, 490], [397, 478], [423, 495], [397, 510], [380, 540], [353, 541], [327, 552], [305, 537], [278, 536]], "#e6cb91");
  poly(g, sand, C.desert);
  poly(g, [[517, 461], [557, 442], [588, 450], [626, 421], [651, 431], [670, 424], [699, 443], [739, 442], [769, 455], [809, 445], [854, 459], [884, 484], [856, 505], [823, 506], [797, 487], [758, 497], [730, 480], [702, 491], [678, 467], [647, 471], [615, 494], [580, 493], [554, 483], [525, 489]], "#e0ba7d");
  poly(g, [[612, 503], [633, 481], [664, 484], [688, 511], [710, 503], [749, 511], [767, 536], [742, 545], [699, 550], [666, 533], [643, 543], [610, 524]], "#cda168");
  poly(g, northernIce, C.frost);
  poly(g, [[692, 86], [720, 64], [758, 49], [775, 44], [819, 60], [850, 53], [887, 61], [924, 42], [956, 49], [990, 73], [996, 92], [971, 118], [979, 134], [958, 152], [921, 152], [896, 164], [867, 154], [851, 162], [813, 152], [805, 142], [771, 135], [747, 121], [725, 102]], C.snow);
  poly(g, [[754, 105], [798, 104], [815, 92], [845, 100], [887, 83], [922, 90], [938, 112], [967, 119], [953, 135], [919, 139], [887, 131], [856, 149], [824, 139], [802, 125], [776, 127]], "#c6d2cc");
  poly(g, autumn, C.fall);
  poly(g, [[697, 151], [724, 136], [756, 150], [783, 156], [806, 181], [845, 179], [880, 197], [910, 185], [938, 203], [915, 218], [887, 217], [856, 238], [834, 227], [798, 242], [770, 216], [738, 217], [720, 195], [704, 193]], C.fallLit);
  poly(g, badlands, C.ash);
  poly(g, [[833, 344], [863, 313], [895, 300], [930, 269], [954, 260], [979, 273], [965, 292], [988, 314], [978, 341], [1001, 366], [974, 386], [976, 411], [942, 415], [923, 432], [894, 427], [875, 405], [845, 410], [820, 394], [829, 373], [813, 358]], C.slate);
  poly(g, [[298, 320], [330, 283], [374, 282], [405, 296], [433, 308], [455, 309], [492, 278], [532, 268], [578, 280], [615, 308], [595, 352], [537, 360], [502, 374], [461, 377], [422, 369], [371, 389], [334, 372], [318, 354]], "#9d9882");
  poly(g, [[315, 338], [353, 299], [382, 303], [419, 322], [450, 325], [472, 312], [514, 287], [556, 287], [582, 299], [590, 325], [549, 335], [529, 348], [500, 345], [457, 360], [419, 348], [382, 370], [343, 362]], "#a7a08a");
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
  // Narrow buttresses and breaks in the facets give the range an uneven relief.
  poly(g, [[l + w * 0.08, y - h * 0.08], [x - w * 0.22, y - h * 0.40], [x - w * 0.17, y - h * 0.49], [x - w * 0.21, y - h * 0.25], [x - w * 0.12, y - h * 0.21], [x - w * 0.24, y - h * 0.13], [x - w * 0.29, y]], base);
  poly(g, [[x + w * 0.06, y - h * 0.76], [x + w * 0.15, y - h * 0.51], [x + w * 0.28, y - h * 0.37], [x + w * 0.19, y - h * 0.37], [x + w * 0.29, y - h * 0.14], [x + w * 0.25, y - h * 0.06], [x + w * 0.16, y - h * 0.32]], base);
  poly(g, [[x - w * 0.04, y - h * 0.48], [x + w * 0.01, y - h * 0.23], [x + w * 0.13, y - h * 0.11], [x + w * 0.02, y + 3], [x - w * 0.15, y + 1], [x - w * 0.08, y - h * 0.16]], base);
  if (cap) {
    poly(g, [[x, y - h], [x + w * 0.08, y - h * 0.85], [x + w * 0.19, y - h * 0.54], [x + w * 0.09, y - h * 0.62], [x + w * 0.06, y - h * 0.46], [x - w * 0.04, y - h * 0.57]], darkCap);
    poly(g, [[x, y - h], [x - w * 0.04, y - h * 0.57], [x - w * 0.09, y - h * 0.63], [x - w * 0.13, y - h * 0.53], [x - w * 0.24, y - h * 0.43], [x - w * 0.13, y - h * 0.69]], cap);
  }
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
  // Alluvial flats step out around the lower course, where it breaks into the sea.
  poly(g, [[405, 399], [430, 395], [453, 402], [477, 423], [465, 451], [453, 471], [463, 491], [445, 516], [428, 531], [402, 525], [400, 504], [418, 480], [408, 457], [427, 435]], "#9bac75");
  poly(g, [[408, 480], [423, 469], [444, 476], [452, 492], [439, 511], [426, 526], [411, 520], [411, 501]], "#88a377");
  poly(g, [[469, 361], [486, 344], [510, 346], [517, 366], [501, 384], [482, 381]], "#89967d");
  poly(g, [[475, 362], [488, 350], [505, 351], [510, 365], [499, 377], [483, 375]], "#7b9c91");
  poly(g, [[483, 359], [495, 355], [501, 360], [500, 368], [489, 372], [483, 368]], C.water);
  stream(g, [[497, 367], [484, 385], [460, 397], [450, 404]], 3);
  stream(g, [[443, 496], [417, 507], [392, 517], [375, 545], [370, 561]], 4);
  stream(g, [[425, 530], [436, 532], [448, 519]], 3);
  stream(g, [[495, 84], [489, 115], [455, 136], [427, 154], [429, 189], [398, 210], [375, 248], [396, 269], [395, 285], [424, 313], [456, 336], [462, 355], [444, 393], [462, 419], [455, 441], [430, 465], [444, 498], [425, 530], [417, 542]], 7);
  stream(g, [[597, 120], [578, 147], [584, 176], [564, 197], [539, 203], [507, 225], [472, 235], [442, 257], [395, 269]], 4);
  stream(g, [[139, 214], [166, 212], [202, 240], [244, 246], [268, 229], [294, 238], [324, 253], [360, 249], [375, 248]], 4);
  stream(g, [[300, 272], [284, 285], [264, 284], [238, 299], [207, 301], [187, 324], [156, 319], [113, 338]], 3);
  steppedLine(g, [[779, 123], [793, 115], [817, 116], [829, 106]], 3, "#afc3c5");
  steppedLine(g, [[912, 137], [893, 149], [870, 145], [855, 152], [830, 150]], 4, "#afc5cb");
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
  for (const [x, y, width] of [[477, 359, 10], [495, 365, 8], [421, 494, 10], [410, 515, 8], [368, 551, 8]]) rect(g, x, y, width, 2, C.waterLit);
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
  const dunes = [[504, 479, 38, 8], [650, 494, 47, 11], [717, 515, 46, 11], [768, 472, 39, 9], [840, 504, 48, 11], [907, 505, 55, 13]];
  for (let y = 423; y < 545; y += 22) for (let x = 475; x < 948; x += 42) {
    const n = hash(x, y), a = x + (n % 28) - 14, b = y + ((n >>> 8) % 17) - 8;
    if (!contains(sand, a, b) || !contains(sand, a + 19, b) || n % 5 < 2) continue;
    if (!dunes.some(([dx, dy]) => Math.abs(dx - a) < 22 && Math.abs(dy - b) < 12)) dunes.push([a, b, 18 + n % 16, 5 + n % 3]);
  }
  for (const [a, b, w, h] of dunes) {
    if (busy(a, b)) continue;
    poly(g, [[a - w * 0.52, b], [a - w * 0.20, b - h], [a + w * 0.11, b - h * 1.30], [a + w * 0.50, b - h * 0.83], [a + w * 0.36, b + 3], [a + w * 0.04, b + 2], [a - 4, b - h * 0.26]], "#d9b278");
    poly(g, [[a - w * 0.10, b - h * 0.6], [a + w * 0.11, b - h * 1.30], [a + w * 0.50, b - h * 0.83], [a + w * 0.36, b + 3], [a + w * 0.04, b + 2], [a + w * 0.06, b - h * 0.2]], C.dune);
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
  for (const patch of [
    [[267, 541], [274, 552], [296, 559], [315, 575], [333, 580]],
    [[341, 589], [364, 587], [379, 579], [390, 566]],
    [[442, 547], [466, 536], [483, 538], [505, 529]],
  ]) {
    steppedLine(g, patch, 5, "#749d9b");
    steppedLine(g, patch.slice(1, -1), 2, "#a6b6a1");
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
  const w = chart.width, h = chart.height;
  rect(g, 0, 0, w, h, "#b79871");
  rect(g, 5, 5, w - 10, h - 10, "#4a5654");
  rect(g, 9, 9, w - 18, h - 18, C.deep);
  rect(g, 13, 13, w - 26, h - 26, C.sea);
  seaMarks(g, w - 13, h - 13);
  islands.forEach((shape, i) => coastShelf(g, shape, i > 4 ? C.beach : C.grove, true));
  coastShelf(g, outline, C.lowland);
  country(g);
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
  ["maple", "jianmen", [[821, 199], [812, 174], [810, 151]]],
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
