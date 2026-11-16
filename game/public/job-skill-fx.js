import { fxPal, fxSkill, skillPal } from "./jobpal.js";

// One short accent per cast. The marks sit inside the primary effect and never draw a filled warning area.
// Each placement is [forward, side, height, lift during fade, phase offset].
const accents = {
  verdict: {
    pixels: [".....a.", "....al.", "..amwl.", ".amwlo.", "ammlo..", ".mm...."],
    spots: [[19, -12, 0.55, 8, 0], [25, 13, 0.35, 5, 0.16], [8, 2, 0.35, 12, 0.27]],
  },
  flurry: {
    pixels: [".....l.", "....lm.", "...la..", "..lo...", ".lm....", "lmo....", "o......"],
    spots: [[5, -12, 0.65, 7, 0], [-8, 10, 0.45, 4, 0.19]],
  },
  dragon: {
    pixels: ["..wma..", "..lm...", ".awmo..", "..alm..", "...wm..", "..al...", "..o...."],
    spots: [[-4, -12, 0.58, 14, 0], [4, 10, 0.7, 18, 0.13], [0, 0, 0.87, 27, 0.25]],
  },
  meteor: {
    pixels: [".....l.", "....ma.", "..oma..", ".amlo..", "amlw...", ".lo...."],
    spots: [[-12, -9, 1.03, -20, 0], [2, 14, 1.15, -18, 0.14], [10, -3, 1.17, -23, 0.29]],
  },
  pact: {
    pixels: ["o.....o", "oo...oo", ".ao.oa.", "..ama..", "...l...", "...m..."],
    spots: [[-9, -9, 0.37, 12, 0], [9, 10, 0.37, 12, 0.13]],
  },
  rain: {
    pixels: ["a......", ".la....", "..la...", "...la..", "....la.", "....mll", ".....ll"],
    spots: [[-8, 13, 1.12, -21, 0], [-2, -8, 1.4, -26, 0.09], [12, 7, 1.23, -24, 0.21], [6, -14, 1.11, -22, 0.32]],
  },
  crimson: {
    pixels: ["....ama", "...amlw", ".amolwo", "...lwm.", ".amlo..", "amo....", "a......"],
    spots: [[-31, -7, 0.65, 9, 0.06], [-24, 9, 0.4, 17, 0.14], [-16, 1, 0.5, 10, 0.25]],
    advance: 12,
  },
  traps: {
    pixels: ["o.....o", "ao...oa", ".mo.om.", "..omo..", ".oo.oo.", "o.....o"],
    spots: [[-9, -9, 0.16, 0, 0], [9, 9, 0.16, 0, 0.12], [8, -8, 0.16, 0, 0.22], [-8, 8, 0.16, 0, 0.3]],
  },
  dive: {
    pixels: ["...l...", "...a...", "..ama..", ".ao.oa.", "mo...om", "o.....o"],
    spots: [[-18, 0, 0.21, 4, 0.09], [3, -16, 0.22, 4, 0.17], [5, 18, 0.23, 3, 0.24]],
  },
  bloodburst: {
    pixels: ["o......", ".m...a.", ".om.l..", "..omm..", "...mo..", "...m...", "...o..."],
    spots: [[-8, 17, 0.1, 9, 0], [13, -16, 0.1, 9, 0.16], [-16, -7, 0.1, 12, 0.28]],
  },
  sanctuary: {
    pixels: ["..a.a..", "..lal..", "..omo..", "..omo..", ".omlmo.", "ommmmo."],
    spots: [[-12, -17, 0.36, 9, 0], [11, 17, 0.36, 9, 0], [17, -11, 0.36, 10, 0.2], [-17, 11, 0.36, 10, 0.2]],
  },
  crosscut: {
    pixels: ["l.....a", ".l...m.", "..l.m..", "...a...", "..m.l..", ".m...l.", "a.....l"],
    spots: [[8, -12, 0.45, 4, 0], [13, 11, 0.46, 4, 0.12], [19, 0, 0.65, 8, 0.24]],
  },
  elemfan: {
    pixels: ["...l...", "..ala..", ".am.ma.", "am.o.ma", ".am.ma.", "..ama..", "...o..."],
    spots: [[0, -14, 0.55, 5, 0], [9, 0, 0.61, 7, 0.07], [0, 14, 0.56, 5, 0.14]],
  },
  runecircle: {
    pixels: ["...l...", "..a.a..", ".a.l.a.", "l.mom.l", ".a.l.a.", "..a.a..", "...l..."],
    spots: [[-17, 0, 0.06, 7, 0], [12, -12, 0.06, 7, 0.1], [12, 12, 0.06, 7, 0.21]],
  },
  inkshot: {
    pixels: ["..alo..", ".am.om.", ".lo..m.", ".lo..a.", ".wo..l.", ".lo..m.", ".mo.oa.", "..oma.."],
    spots: [[11, 0, 0.4, 2, 0], [18, 0, 0.4, 3, 0.18]],
    advance: 11,
  },
  hammer_final: {
    pixels: ["......o", "....olo", "...owa.", "...lom.", ".olwo..", "olom.o.", "om..o.."],
    spots: [[0, -13, 0.07, 3, 0], [3, 12, 0.07, 3, 0.04], [-9, -3, 0.24, 21, 0.13], [10, 0, 0.24, 17, 0.22]],
  },
  ironsiege: {
    pixels: [".....aa", "....a.m", "...al.m", "..m.om.", ".moom..", "m..m...", ".mm...."],
    spots: [[-9, -8, 0.37, 6, 0], [-15, 2, 0.42, 6, 0.09], [-6, 10, 0.37, 8, 0.18]],
  },
  oathward: {
    pixels: [".ama...", "amlam..", "mlwlm..", ".aml...", "..am.aa", "...oa.a", ".....a."],
    spots: [[-10, -10, 0.75, 13, 0], [8, 12, 0.7, 12, 0.12], [11, -7, 0.62, 17, 0.22]],
  },
  whirl: {
    pixels: [".......", "...almm", ".alo...", "alo....", ".o.....", "..omma."],
    spots: [[8, -11, 0.45, 4, 0], [-11, 7, 0.34, 10, 0.16]],
  },
  musou: {
    pixels: ["..al...", "...la..", "..la...", ".al....", "alla...", ".a..m..", ".....o."],
    spots: [[11, -9, 0.67, 15, 0], [11, 11, 0.67, 15, 0.11]],
  },
};

// [screen x, screen y, outward drift, lift, delay] from the authoritative contact point.
const contacts = {
  meteor: {
    skill: "meteor", duration: 270,
    pixels: [".....o.", "....oo.", "...oma.", "..omal.", "..omww.", ".omwl..", "omal..."],
    spots: [[-6, 0, -17, 10, 0], [7, 2, 23, 13, 0.08], [0, -3, 4, 21, 0.1]],
  },
  pillar: {
    skill: "dragon", duration: 240,
    pixels: ["l......", ".l..a..", "..w.a..", "..www..", "....wl.", "...lm..", ".....ll"],
    spots: [[-8, -17, -12, 11, 0], [8, -13, 13, 8, 0.09]],
    last: [[-12, -28, -15, 10, 0], [12, -25, 16, 16, 0], [-10, -4, -16, 8, 0.14], [12, -2, 20, 10, 0.21]],
  },
  phantom: {
    skill: "pact", duration: 260,
    pixels: ["....moo", "..moomm", ".mmoa..", ".m.l...", "omwl...", "owm....", "o......"],
    spots: [[-17, -18, 13, 1, 0], [17, -19, -13, 1, 0.05]],
  },
  rune: {
    skill: "runecircle", duration: 280,
    pixels: ["...w...", "..lol..", ".lo.ol.", "w.am.aw", ".lo.ol.", "..lom..", "...w..."],
    // Each element takes a different pair of points on the circle.
    phases: [
      [[-23, 4, -4, 14, 0], [13, 9, 3, 15, 0.13]],
      [[-20, -10, -3, 13, 0], [13, 11, 3, 15, 0.13]],
      [[17, -8, 3, 15, 0], [-24, 2, -3, 13, 0.13]],
    ],
  },
  burst: {
    skill: "bloodburst", duration: 290,
    pixels: ["o......", "mo.....", ".lmo...", "..lwmo.", "...almo", ".....lm", "......a"],
    spots: [[-16, -7, -16, 11, 0.07], [21, 3, 19, 9, 0], [-10, 7, -10, 16, 0.2]],
  },
  frostspire: {
    duration: 330,
    pixels: ["..l....", "..wm...", ".lwoo..", ".lmo...", ".oml...", "owlmw..", "omlmoo."],
    spots: [[-13, 1, -5, 12, 0.1], [1, -1, 1, 23, 0], [13, 4, 6, 13, 0.21]],
  },
};

const WIDTH = 7;
const SIZE = 2;
const bitmaps = new WeakMap();

function bitmap(accent, palette) {
  let cache = bitmaps.get(palette);
  if (!cache) { cache = new Map(); bitmaps.set(palette, cache); }
  if (cache.has(accent)) return cache.get(accent);
  const sprite = document.createElement("canvas");
  sprite.width = WIDTH * 4; // cool and hot, each with a mirrored side
  sprite.height = accent.pixels.length;
  const g = sprite.getContext("2d");
  const colors = { o: palette.md, m: palette.m, a: palette.a, l: palette.l, w: palette.a };
  accent.pixels.forEach((row, y) => {
    for (let x = 0; x < WIDTH; x++) {
      const color = colors[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
      g.fillRect(2 * WIDTH - 1 - x, y, 1, 1);
      g.fillStyle = row[x] === "w" ? palette.w : color;
      g.fillRect(2 * WIDTH + x, y, 1, 1);
      g.fillRect(4 * WIDTH - 1 - x, y, 1, 1);
    }
  });
  cache.set(accent, sprite);
  return sprite;
}

const facing = [[0, 1], [-1, 0], [1, 0], [0, -1]];
const START_ONLY = new Set(["whirl", "musou"]);
const DURATION = 350;
const MAX_FX_FOR_ACCENT = 96;
const NEAR_SQ = 220 ** 2;
const MAX_TRACKED_PROPS = 64;
const contactProps = new WeakMap();

function drawContact(S3, contact, spots, palette, x, y, own) {
  const [ox, oy] = S3.iso(x, y);
  const sprite = bitmap(contact, palette);
  const opacity = own ? 0.95 : 0.7;
  S3.fxCustom((g, k) => {
    g.imageSmoothingEnabled = false;
    for (const [sx, sy, drift, lift, delay] of spots) {
      const t = (k - delay) / (1 - delay);
      if (t < 0) continue;
      const travel = 1 - (1 - t) ** 2;
      const px = Math.round(ox + sx + drift * travel);
      const py = Math.round(oy + sy - lift * Math.sin(Math.PI * 0.76 * travel));
      const frame = (t < 0.2 ? 2 : 0) + Number(sx < 0);
      g.globalAlpha = opacity * Math.min(1, (1 - t) * 1.8);
      g.drawImage(sprite, frame * WIDTH, 0, WIDTH, sprite.height,
        px - 3 * SIZE, py - (sprite.height - 1) * SIZE, WIDTH * SIZE, sprite.height * SIZE);
    }
  }, contact.duration);
}

function propContact(e, G, S3, entityPos) {
  let state = contactProps.get(G);
  if (!state || state.map !== G.map) {
    state = { map: G.map, props: new Map() };
    contactProps.set(G, state);
  }
  const { props } = state;
  const id = e[1];
  if (e[0] === "pr") {
    const kind = e[2];
    if (!Object.hasOwn(contacts, kind) || !contacts[kind].skill) return;
    if (props.size >= MAX_TRACKED_PROPS && !props.has(id)) props.delete(props.keys().next().value);
    props.set(id, { kind, eid: e[7] });
    return;
  }
  if (e[0] === "pe") { props.delete(id); return; }
  const prop = props.get(id);
  if (!prop || document.hidden || S3.fx.list.length >= MAX_FX_FOR_ACCENT) return;

  const { kind, eid } = prop;
  const target = kind === "phantom" ? entityPos(e[4]) : null;
  const x = target?.x ?? e[2], y = target?.y ?? e[3];
  const own = eid === G.you;
  if (!own && (!G.me || (x - G.me.x) ** 2 + (y - G.me.y) ** 2 > NEAR_SQ)) return;
  const contact = contacts[kind];
  const spots = e[4] === 1 && contact.last || contact.phases?.[e[4] - 1] || contact.spots;
  if (spots) drawContact(S3, contact, spots, skillPal(contact.skill, G.who?.get(eid)?.cls), x, y, own);
}

export function jobSkillFx(e, G, S3, entityPos) {
  if (e[0] === "pr" || e[0] === "pp" || e[0] === "pe") {
    propContact(e, G, S3, entityPos);
    return;
  }
  const impact = e[0] === "hm";
  if ((e[0] !== "a" && !impact) || document.hidden) return;
  const code = impact ? e[7] : e[2], id = fxSkill(code);
  const accent = accents[id];
  if ((!accent && id !== "frostspire") || (id === "hammer_final") !== impact || S3.fx.list.length >= MAX_FX_FOR_ACCENT) return;
  if ((id === "flurry" && e[7] !== undefined) || (START_ONLY.has(id) && e[7] !== 0)) return;
  const eid = e[1], x = impact ? e[2] : e[3];
  // Three long casts already carry a ground point. Other "a" events report the regular body-height offset.
  const ground = impact || id === "crimson" || id === "elemfan" || id === "inkshot";
  const y = impact ? e[3] : e[4] + (ground ? 0 : 6);
  if (eid !== G.you && (!G.me || (x - G.me.x) ** 2 + (y - G.me.y) ** 2 > NEAR_SQ)) return;
  if (id === "frostspire") {
    const contact = contacts.frostspire;
    drawContact(S3, contact, contact.spots, fxPal(code, G, eid), x, y, eid === G.you);
    return;
  }

  const src = entityPos(eid);
  if (id === "inkshot" && !src) return;
  let [dx, dy] = facing[impact ? src?.dir : e[5]] || facing[0];
  if (impact && Number.isFinite(src?.hammerYaw)) {
    dx = Math.cos(src.hammerYaw); dy = Math.sin(src.hammerYaw);
  } else if (src && id !== "traps") {
    const vx = x - src.x, vy = y - src.y, length = Math.hypot(vx, vy);
    if (length > 8) { dx = vx / length; dy = vy / length; }
  }
  const sprite = bitmap(accent, fxPal(code, G, eid));
  const left = dx - dy < 0;
  const opacity = eid === G.you ? 0.94 : 0.74;
  const ink = id === "inkshot";
  const ox = ink ? src.x : x, oy = ink ? src.y : y;
  const [driftX, driftY] = S3.iso(dx * (accent.advance || 0), dy * (accent.advance || 0));
  const spots = accent.spots.map(([front, side, h, lift, delay]) => [
    ...S3.iso(ox + dx * front - dy * side, oy + dy * front + dx * side, h), lift, delay,
  ]);
  S3.fxCustom((g, k) => {
    g.imageSmoothingEnabled = false;
    for (let i = 0; i < spots.length; i++) {
      const [px, py, lift, delay] = spots[i], t = (k - delay) / (1 - delay);
      if (t < 0) continue;
      const dx = Math.round(px + driftX * t), dy = Math.round(py + (driftY - lift) * t);
      const flip = left !== (i % 2 === 1);
      const frame = (t < 0.18 ? 2 : 0) + Number(flip);
      g.globalAlpha = opacity * (1 - t);
      g.drawImage(sprite, frame * WIDTH, 0, WIDTH, sprite.height,
        dx - 3 * SIZE, dy - 3 * SIZE, WIDTH * SIZE, sprite.height * SIZE);
    }
  }, DURATION, false, ink ? S3.impactMs("bow", 2) : 0);
}
