// Dishes for the diner menu, held objects, and the dining room's wash station.
const edge = "#241c2c";
const china = "#b8d1d8", chinaLight = "#f5edda", chinaDark = "#647d97";
const leaf = "#aac66a", lettuce = "#62965b", herb = "#3b6060";
const fruit = "#e87a59", fruitLight = "#ffd697", fruitDark = "#a74553";
const crust = "#c87549", crustLight = "#f3bd73", crustDark = "#733c4b";

const dishes = [
  {
    colors: { x: edge, c: china, l: chinaLight, d: chinaDark, g: leaf, m: lettuce, h: herb, r: fruit, y: fruitLight },
    rows: [
      ".....xx",
      "...xxggxx..xx",
      "..xgmgmhhxxmxx",
      ".xxmmymrggmgmx",
      "xlggrrrmggmrxxx",
      "xlgmmhmhmrmmhcx",
      ".xllhhhhhhhlldx",
      ".xclllllllcddx",
      "..xccllcccddx",
      "...xxccccddx",
      ".....xxxxxx",
    ],
  },
  {
    colors: { x: edge, c: china, l: chinaLight, d: chinaDark, o: crust, y: crustLight, b: crustDark, m: lettuce },
    rows: [
      "...........xx",
      "....xxxx...xyx",
      "...xoyyox.xox.x",
      "..xoxyyboxooxox",
      ".xcbyoyooyooxx",
      "xclxoooooxbxccx",
      "xlmmxxxxxxcccdx",
      "xclllcclccccddx",
      ".xcccccddddddx",
      "..xxxxxxxxxxx",
    ],
  },
  {
    colors: { x: edge, o: crust, y: crustLight, b: crustDark, r: fruit, t: fruitDark, l: fruitLight, m: lettuce },
    rows: [
      "....y....y",
      "...y......y",
      "....y....y",
      "..xxxxxxxxxxx",
      ".xyoooyyooooox",
      "xoyylrrttyrtoox",
      "xylrtorrtmtroyx",
      ".xyoyyyoyyyyox",
      ".xoooooooobbbx",
      "..xoooobbbbbx",
      "...xxbbbbbxx",
      ".....xxxxx",
    ],
  },
  {
    colors: { x: edge, c: china, l: chinaLight, d: chinaDark, o: crust, b: crustDark },
    rows: [
      "",
      "",
      "....xxxxxxx",
      "..xxlllllccxx",
      ".xllcccccccdcx",
      "xlcccobccoccddx",
      "xlcccbbcobccddx",
      "xclcccccccddddx",
      ".xccccdddddddx",
      "..xxxxxxxxxxx",
    ],
  },
];
const sprites = [];
const sink = {
  colors: { x: edge, c: "#517e86", d: "#2f4e5d", l: chinaLight, r: china, h: "#9cdae0", w: "#397f93", s: "#392b35" },
  rows: [
    "..................xxxxx",
    "................xxhhhhxx",
    "................xhh..rrx",
    "...............xxhh..rrx",
    "...............xrrx..xxx",
    "...............xrrx...h",
    ".............xxxrrx...h",
    "...........xxlxrrrxxx.w",
    ".........xxlllxxxxxrlxw",
    ".......xlllrrxxxxxxrrrlxx",
    ".....xlllrrxxxxxxxxxxrrlllx",
    "...xlllrrxxxxwwwwwxxxxxrrlllx",
    "..xxlllrrxwwwwwwwwwwwwwwxrrlllx",
    "..xrrrlllrwwwwwwwwwwwwwwxrrlllxx",
    "..xlrrrrlllrwwwhhhwwwwxrrlllrrlx",
    "...xllrrrrlllrrwwwxxwrrlllrrllxx",
    "...xcxllrrrllllrrwwrrlllrrllxxx",
    "...xcccxllrrrllllrrllllrllxxxdx",
    "...xcdcccxlllrrllllllrrlxxxdddx",
    "...xcdddcccxxllrrllrrllxxdddddx",
    "...xcdddddcccxxllrrllxxdrxddddx",
    "...xcdddllldcccxxllxxdddrxddddx",
    "...xccddddddddcccxxddrddrxddddxss",
    "...xxcccdddddddccxdddrrrrxdddxxss",
    "....xxxcccdddddccxdddxxxxxdxxxs",
    "......xxxcccdddccxdddddddxxxs",
    "........xxccccdccxdddddxxxs",
    "..........xxcccccxdddxxxss",
    "............xxcccxdxxxss",
    "..............xxcxxxss",
    "................xxss",
  ],
};
let sinkSprite;

function drawPixels(g, x, y, icon) {
  icon.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = icon.colors[row[dx]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

/** Paint a 15 × 12 icon at its pixel-space upper-left corner. */
export function drawDinerFood(g, x, y, dish) {
  const icon = dishes[dish];
  if (icon) drawPixels(g, x, y, icon);
}

export function dinerFoodSprite(dish) {
  if (!dishes[dish]) return null;
  if (!sprites[dish]) {
    const canvas = document.createElement("canvas");
    canvas.width = 15;
    canvas.height = 12;
    drawDinerFood(canvas.getContext("2d"), 0, 0, dish);
    sprites[dish] = canvas;
  }
  return sprites[dish];
}

/** The cabinet's feet extend past the center of its floor tile. */
export function drawDinerSink(g, x, y) {
  if (!sinkSprite) {
    sinkSprite = document.createElement("canvas");
    sinkSprite.width = 34;
    sinkSprite.height = sink.rows.length;
    drawPixels(sinkSprite.getContext("2d"), 0, 0, sink);
  }
  g.drawImage(sinkSprite, x - 17, y - 25);
}
