import { drawDinerFood } from "./coop-diner-art.js";
import { forgeIngotSprite } from "./coop-forge-art.js";
import { libraryBookSprite } from "./coop-lib-art.js";

// Tool illustrations for the co-op briefing, drawn on a 40 × 32 pixel grid.
const ink = "#221b2a";
const wood = "#8d523d", bark = "#533045", oak = "#d09560";
const steel = "#758ca2", steelLight = "#c8e0e3", steelShade = "#474a6a";
const straw = "#d39a48", strawLight = "#fce092", strawShade = "#895341";
const moss = "#79af67", leaf = "#c0dd90", forest = "#436155";
const paper = "#fae4ae", paperShade = "#c3946b", wax = "#a14156";
const hot = "#ff9a4d", ember = "#b94b4d", yellow = "#ffe380";

function paint(g, x, y, colors, rows) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = colors[row[dx]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}

const binColors = { x: ink, s: steel, l: steelLight, d: steelShade, m: moss, w: paperShade, p: paper };

export function drawTrashBin(g, x, y, full) {
  paint(g, x, y, binColors, full ? [
    ".......xxx",
    "..xxx.xmmx",
    "..xpxxmxmmxx",
    ".xppwxmpxxxx",
    "xxlxsdsxxsddx",
    "xllssssssssdx",
  ] : [
    "....xxxxx",
    "....xllsx",
    "...xxxsxxx",
    ".xxllllsssx",
    "xlllsssssssdx",
    "xssdddddddddx",
  ]);
  paint(g, x, y + 6, binColors, [
    ".xllssssssdx",
    ".xlslsdsdsdx",
    ".xlslsdsdsdx",
    "..xslsdsdsx",
    "..xslsdsdsx",
    "..xslsdsdsx",
    "..xslsdsdsx",
    "..xssssdddx",
    "...xdddddx",
    "....xxxxx",
  ]);
}

const trash = [
  // Bottle with its cap and angled neck.
  ["......xx", ".....xlx", "...xxmx", "..xmmmx", ".xmmfx", "xmmfx", ".xxx"],
  // Crumpled paper, with two large facets.
  ["...xx", "..xppxx", ".xppwpx", "xppwpwxx", ".xwppwwx", "..xwwwx", "...xxx"],
  // Dented tin with a painted band.
  ["..xxxx", ".xllsxx", "xlswddx", "xswddx", "xsdddx", ".xxxx"],
  // Banana peel, splayed at the tips.
  [".xx...xx", ".xlx.xlsx", "..xlsxlsx", "...xlsdx", "..xlsdxx", ".xlsdx", "..xxx"],
];

export function drawTrash(g, x, y, variant) {
  paint(g, x, y, {
    ...binColors, f: forest,
    ...(variant === 3 ? { l: strawLight, s: straw, d: strawShade } : {}),
  }, trash[variant] || trash[0]);
}

function bin(g) {
  g.save();
  g.scale(2, 2);
  drawTrashBin(g, 1, 0, false);
  g.restore();
  drawTrash(g, 30, 12, 0);
  drawTrash(g, 29, 22, 1);
}

function dropoff(g) {
  paint(g, 5, 5, { x: ink, s: steel, l: steelLight, d: steelShade, m: moss, f: forest, p: paper }, [
    ".......xxxxxxxxxxxx",
    "......xllllllllsssx",
    ".....xllsssssssssxx",
    "....xllsssssssssx",
    "...xllsssssssssx",
    "..xllssssddsssx....xx",
    ".xxxslxsddddxsxxxxxsx",
    "xlllldddddddddllllldsx",
    "xsssssdddddddssssssdsx",
    ".xmmfffffffffffffddsx",
    ".xmmmmmfffffffffffdsx",
    ".xmmmmmmmmmmmmmmmmdsx",
    ".xmmmmmmmpppmmmfmmdsx",
    ".xmmmmmmpppppmmfmmdsx",
    ".xmmmmmmmpppmmmfmmdsx",
    ".xmmmmmmmpppmmmfmmdsx",
    ".xmmmmmmmmmmmmmfmmdsx",
    ".xmmmmmmmmmmmmmfmmdsx",
    "..xmmmmmmmmmmmmmmddx",
    "..xxxxxxxxxxxxxxxxxx",
    "...xsx.........xdx",
    "...xxx.........xxx",
  ]);
  drawTrash(g, 28, 19, 2);
  drawTrash(g, 28, 24, 3);
}

function pan(g) {
  paint(g, 4, 6, { x: ink, s: steel, l: steelLight, d: steelShade, o: oak, w: wood, y: yellow, h: hot, e: ember }, [
    ".......s.......s",
    "......sl......sl",
    ".......sl.....s",
    "........s....s",
    "........s.....s",
    "............................xxxx",
    "..........................xxowwxx",
    ".........xxxxxxxxx......xxowwxx",
    "......xxxlssssssslxxxxxxowwxx",
    "....xxlssddddddddsslsxowwxx",
    "...xlsdddeeehddddddslsxxx",
    "..xlsddehhhyhhedddddslx",
    ".xlsddehhyhhhheeehddsslx",
    ".xlsdddeeehhheeeeddsslsx",
    "..xllsdddddddddddssllsx",
    "...xxllllssssssllllsxx",
    ".....xsssssssssssssx",
    "......xxxxssssxxxxx",
    "..........xxxx",
  ]);
}

function tray(g) {
  paint(g, 2, 11, { x: ink, o: oak, w: wood, b: bark }, [
    "...xxxxxxxxxxxxxxxxx",
    "..xoooooooooooooooowx",
    "..xowwwwwwwwwwwwwwowx",
    ".xowwwwwwwwwwwwwwwowx",
    "xowwwwwwwwwwwwwwwwwwox",
    "xooooooooooooooooooowx",
    "xwwwwwwwwwwwwwwwwwwwbx",
    ".xxbbbbbbbbbbbbbbbbbxx",
    "...xxxxxxxxxxxxxxxxx",
  ]);
  drawDinerFood(g, 5, 4, 1);
  drawDinerFood(g, 24, 18, 3);
}

function tongs(g) {
  paint(g, 3, 5, { x: ink, s: steel, l: steelLight, d: steelShade }, [
    "...xxx",
    "..xllsxxx",
    ".xllssddxxx",
    ".xsxxxssddxxx",
    "..x..xxxssddxx",
    ".......xxxssddxx",
    ".........xxxssddxx",
    "..........xxxxssdsxx",
    ".........xllxxxxxldsxx",
    ".......xxlssdx..xxxssdsxx",
    ".....xxlssddx.....xxssddxx",
    "...xxlssddxx........xxssddxx",
    "..xlssddxx............xxssddx",
    ".xlssddx................xxssx",
    ".xsxxxx...................xx",
    "..xx",
  ]);
  g.drawImage(forgeIngotSprite(1), 23, 16);
}

function hammer(g) {
  paint(g, 9, 4, { x: ink, s: steel, l: steelLight, d: steelShade, w: wood, o: oak, b: bark }, [
    ".........xxxxxxx",
    "........xlllllssx",
    ".......xllsssssssx",
    "......xllssssssdsdx",
    ".....xllssssssdsddx",
    "....xllssssssdsddx",
    "....xlssssssdsddx",
    ".....xsssddsddxx",
    "......xxxddxxwwx",
    ".........xxxowbx",
    "..........xowbx",
    ".........xowbx",
    "........xowbx",
    ".......xowbx",
    "......xowbx",
    ".....xowbx",
    "....xowbx",
    "...xowbx",
    "..xowbx",
    ".xowbx",
    ".xwbx",
    "..xx",
  ]);
  paint(g, 20, 14, { x: ink, s: steel, l: steelLight, d: steelShade, y: yellow }, [
    "...........y",
    "........y.y",
    "..........y",
    ".......yy",
    "...........y",
    "..............xxx",
    "x.............xlx",
    "xx.....xxxxxxxlxxx",
    "xlxxxxxlllllllsssx",
    ".xsssssssssssdxxx",
    "..xxsssssdddxx",
    "....xxsssdxx",
    "......xsdx",
    "....xxssddxx",
    "...xlsssssddx",
    "...xxxxxxxxxx",
  ]);
}

function bellows(g) {
  paint(g, 4, 6, { x: ink, w: wood, o: oak, b: bark, s: steel, l: steelLight, d: steelShade }, [
    "....xxxx",
    ".xxxoooxxxxxxx",
    "xooowwwwoooowwxxxx",
    ".xxxoooooooooowwwxxx",
    "...xwwwoooooooooowwwxx",
    "....xbbbwwoooooooooowwxx",
    "....xwwwwbbwooooooooowwxxx",
    "....xbbwwwwwbbwooooooowwxxlxxx",
    "...xwwbbbbwwwwwwbbwoooowxllssxx",
    ".xxbbbbwwwbbbbwwwwbbbwwxxssddx",
    "xoooowwbbbwwwwbbbwwwwwxxddxx",
    ".xxwoooooowwbbwwbbwwxx",
    "...xxwwwooooooowwwwxx",
    ".....xxxwwwooooowxx",
    "........xxxwwwxxx",
    "...........xxx",
  ]);
}

function fan(g) {
  paint(g, 4, 4, { x: ink, m: moss, l: leaf, f: forest, w: wood, o: oak }, [
    "....xxxxxx",
    "..xxllllmmxx",
    ".xlllmmmmmmfx",
    "xlmmmlmmmmmfx",
    "xlmlmmmlmmmfx",
    "xmmmlmmmmlmfx",
    ".xmmmlmmmmffx",
    ".xfmmlmmlffx",
    "..xfmllmffx",
    "...xfmlfx",
    "....xfmlx",
    ".....xwx",
    ".....xowx",
    "......xowx",
    ".......xowx",
    "........xowx",
    ".........xx",
  ]);
  paint(g, 22, 9, { x: ink, s: steel, l: steelLight, w: wood, o: oak, m: moss, f: forest }, [
    "....xxxxx",
    "...xooowx",
    "...xowwx",
    "...xlssx",
    "...xlssx",
    "..xlssssx",
    ".xlssssssx",
    ".xlmmmmmsx",
    "xlmmfmmmmfx",
    "xlmmmmmmmfx",
    "xsmmmmmmffx",
    "xsmmmmmfffx",
    ".xssssssfx",
    "..xxxxxxx",
  ]);
}

function pipe(g, role) {
  const colors = role ? { s: steel, l: steelLight, d: steelShade } : { s: straw, l: strawLight, d: strawShade };
  g.save();
  if (role) { g.translate(g.canvas.width, 0); g.scale(-1, 1); }
  paint(g, 5, 6, { x: ink, ...colors, w: wax, o: oak }, [
    "......xxxxxxx",
    ".....xxoooooxx",
    "....xowwwwwwox",
    "....xowxxxwwox",
    "....xowwwwwwox",
    ".....xxwwwwxx",
    ".......xwxx",
    ".......xwx",
    "......xxxxx.............xxxxxx",
    "..xxxxlllllxxxxxxxxxxxxxxllssx",
    ".xxllsssllllsssslllllllllllddx",
    "xxlssssssssslllsssssssssssssxx",
    "xlsssssssssssssssssssssssssss",
    "xlsssssssssssssssssssssssssss",
    "xlsdddddddddssssssssssssssssx",
    "xsssdddddddxxdddddddddddxxddx",
    "xxssssddddxxxxxxxxxxxxxxxddsx",
    ".xllsssssx..............xxxxxx",
    ".xlsdddddx",
    ".xlsdddddx",
    "xllsddddddx",
    "xssssssdddx",
    ".xxxxxxxxx",
  ]);
  g.restore();
}

function desk(g) {
  paint(g, 4, 4, { x: ink, w: wood, o: oak, b: bark, r: wax, p: paper }, [
    "......................xxxxx",
    ".....................xooowwx",
    ".....................xowwwwx",
    "......................xwwx",
    "......................xwwx",
    "....................xxxooxxx",
    "...................xoooooobbx",
    "...................xwwwbbbwwx",
    "...................xrrrrrrrrx",
    "....................xxxxxxxx",
    "",
    "......xxxxxxxxxxxxxxxxxxxxx",
    "....xxoooooooooooooooooooooxx",
    "..xxooooooooooooooooooooooooox",
    ".xooooooooooooooooooooooooxxx",
    "xooooooooooooooooooooxxxxxwx",
    "xoooooooooooooooooxxxxowwwbx",
    "xxooooooooooooxxxxwwwwwwbbx",
    "xwxxxxxxxxxxxxwwoowwwwbbbx",
    "xowwwwwwwwwwwwwwwwwwwbbbxx",
    "xowwwwwwpppwwwwwwwbbbbbx",
    "xowwwwwwpppwwwwbbbbxxxx",
    "xwwwwwwwwwwwbbbxxxx",
    "xxbbbbbbbbxxxxx",
    ".xxxxxxxxxx",
  ]);
  g.drawImage(libraryBookSprite(3), 6, 4);
}

function shelf(g) {
  paint(g, 6, 5, { x: ink, p: paper, w: wax, g: moss, s: steel, o: oak, b: bark }, [
    "xxxxxxx",
    "xooooox",
    "xobbbbx....xx",
    "xobbbbx..xxppx",
    "xobbbwxxxppppx",
    "xobbbwxpppsppx..xxxx",
    "xobbbwxpppsppx.xxggx",
    "xobbbwxssxsppxxggggx",
    "xobbbwxspppppxggxxgx",
    "xobbbwxspppppxggppgx",
    "xobbbwxspppppxggxxgx",
    "xobbbwxspppppxgggggx",
    "xobbbwxspppppxgggggx",
    "xobbbwxspppppxgggggx",
    "xobbbwxspppppxgggggx",
    "xoxxxxxxxxxxxxxxxxxxxxxxxx",
    "xooooooooooooooooooooooobx",
    "xobbbbbbbbbbbbbbbbbbbbbbbx",
    "xxxxxxxxxxxxxxxxxxxxxxxxxx",
  ]);
  g.drawImage(libraryBookSprite(3), 23, 14);
}

const art = {
  apt: [bin, dropoff],
  diner: [pan, tray],
  forge: [tongs, hammer],
  alch: [bellows, fan],
  pipe: [(g) => pipe(g, 0), (g) => pipe(g, 1)],
  lib: [desk, shelf],
};

export function drawBriefingArt(canvas, kind, role) {
  canvas.width = 40;
  canvas.height = 32;
  const draw = art[kind]?.[role];
  if (draw) draw(canvas.getContext("2d"));
}
