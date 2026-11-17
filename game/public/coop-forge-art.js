// Forge order silhouettes and the four metals as 16 × 16 pixel sprites.
const outline = "#231c2d";
const handle = { h: "#a97050", b: "#593447", p: "#e8ba84" };
const metals = [
  { l: "#d2c4b1", m: "#9f9389", s: "#595165" },
  { l: "#edf4e8", m: "#97b4cf", s: "#505d88" },
  { l: "#fff1a6", m: "#e3ae53", s: "#94564a" },
  { l: "#c6f5d0", m: "#62bdab", s: "#315d75" },
];

const tools = [
  // The open jaws and two handles make the tongs readable beside a sprite.
  [2, 0, [
    "..xx..xx",
    ".xlx..xlx",
    "xmlx..xlmx",
    "xmsx..xlsmx",
    ".xmsxxlsmx",
    "..xmslsmx",
    "...xpsdx",
    "...xshx",
    "..xmsxlx",
    "..xsx.xmx",
    ".xmsx.xlsx",
    ".xsx...xmsx",
    "xsx....xlsx",
    "xx......xmx",
    ".........xx",
  ]],
  [1, 0, [
    "........xxxxx",
    "......xxllllsx",
    ".....xllmmmmmsx",
    "....xlmmmmmsmx",
    "...xlmmmmmsmsx",
    "....xmmsmmsxx",
    ".....xmmssxhx",
    "......xxxxphbx",
    "........xphbx",
    ".......xphbx",
    "......xphbx",
    ".....xphbx",
    "....xphbx",
    "...xphbx",
    "..xhbx",
    "...xx",
  ]],
];

const ingot = [1, 4, [
  ".....xxxxxx",
  "...xxllllllxx",
  "..xllmmmmmmmsx",
  ".xlmmmmmmmmmsx",
  "xlmmmmmmmmsssx",
  "xlllllllllsss",
  "xmmmmmmmmsssx",
  ".xsssssssssx",
  "..xxxxxxxxx",
]];

const orders = [
  // Horseshoe.
  [1, 1, [
    ".xxx......xxx",
    "xllmx....xllmx",
    "xlmsx....xlmsx",
    "xlmsx....xlmsx",
    "xlmsx....xlmsx",
    "xlmsx....xmssx",
    "xllssx..xmsssx",
    ".xlmssxxmsssx",
    ".xlmllmsmsssx",
    "..xlmllmsssx",
    "...xxlsssxx",
    ".....xxxx",
  ]],
  // Dagger, with a short taper and a crossguard.
  [2, 2, [
    "..........xxx",
    ".........xllx",
    "........xllmx",
    ".......xlmsx",
    "......xlmsx",
    ".....xlmsx",
    "...xxxmsx",
    "..xphxmx",
    "...xhhxpx",
    "...xphxbx",
    "..xphxbx",
    ".xphbxxx",
    "xpbxx",
    ".xx",
  ]],
  // Forged sword blade, broader, longer and deliberately unhilted.
  [1, 0, [
    "...........xxxx",
    "..........xllsx",
    ".........xllmsx",
    "........xllmsx",
    ".......xllmsx",
    "......xllmsx",
    ".....xllmsx",
    "....xllmsx",
    "...xllmsx",
    "..xllmsx",
    ".xllmsx",
    "xllmsx",
    ".xmsx",
    ".xmx",
    "xmx",
    "xx",
  ]],
  // Helm with a raised nose guard.
  [1, 1, [
    "......xxx",
    "....xxlllxxx",
    "...xllmmmmmmx",
    "..xllmmmmmmmsx",
    ".xllmmmmmmmmmsx",
    ".xlmmmmmmmmmmsx",
    "xlmmmmmmmmmmssx",
    "xllxxxllxxxmssx",
    "xlx..xlx..xmssx",
    "xlx..xmx..xmssx",
    ".xsx.xmx.xmssx",
    "..xx.xxx.xxx",
  ]],
  // Lidded pot, with two side handles.
  [0, 2, [
    "......xxxx",
    "......xllx",
    ".....xxmsxx",
    "...xxllllllxx",
    "..xllmmmmmmmsx",
    ".xllllllllllssx",
    "xxssxxxxxxxxssxx",
    "xmxllllllllllxmx",
    "xxxlmmmmmmmmsxxx",
    "..xlmmmmmmmmsx",
    "...xlmmmmmmsx",
    "....xxssssxx",
    "......xxxx",
  ]],
  // Shield with a raised diamond boss.
  [1, 1, [
    ".....xxx",
    "...xxlllxx",
    ".xxllmmmllxx",
    "xllmmmmmmmsxx",
    "xlmmmmlmmmmsx",
    "xlmmmlplmmmsx",
    "xlmmlphplmmsx",
    "xlmmmlplmmsx",
    ".xlmmmlmmmsx",
    ".xlmmmmmmssx",
    "..xlmmmmssx",
    "...xlmmssx",
    "....xsssx",
    ".....xxx",
  ]],
  // Breastplate: wide lapped shoulder plates and flared hem.
  [0, 1, [
    "..xxxx....xxxx",
    ".xlllmxxxxllmmx",
    "xllmssllllmsmssx",
    "xlmsxllmmmlxsssx",
    ".xxxllmmmmssxxx",
    "...xllmmmmmsx",
    "...xllmmmmsx",
    "...xlmmmmssx",
    "..xlmmmmmmssx",
    "..xllllllllsx",
    "..xlmmmmmmssx",
    ".xlmmmxxmmmssx",
    ".xssssxxsssssx",
    "..xxxx..xxxxx",
  ]],
];

const toolCache = [];
const ingotCache = [];
const orderCache = orders.map(() => []);

function sprite(drawing, metal) {
  const [x, y, rows] = drawing;
  const colors = { x: outline, d: "#39364c", ...handle, ...metals[metal] };
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const g = canvas.getContext("2d");
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = colors[row[dx]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x + dx, y + dy, 1, 1);
    }
  });
  return canvas;
}

export function forgeToolSprite(role) {
  if (!tools[role]) return null;
  return toolCache[role] ??= sprite(tools[role], 1);
}

export function forgeOrderSprite(kind, metal) {
  if (!orders[kind] || !metals[metal]) return null;
  return orderCache[kind][metal] ??= sprite(orders[kind], metal);
}

export function forgeIngotSprite(metal) {
  if (!metals[metal]) return null;
  return ingotCache[metal] ??= sprite(ingot, metal);
}
