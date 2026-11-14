/**
 * The weapon gauge in the bottom-centre status panel: the passive of the weapon in hand, at a glance
 * (docs/design/jobs-and-stats.md C.7). The HUD calls drawWeaponGauge(canvas, self, defs, t) every frame;
 * `self.cr` says which gauge (null while the passive is not learned), and the live number rides on every
 * snapshot (`me[9]`, read by skillfx.js). 120×20 pixels, drawn pixel by pixel.
 *
 *   대검 관성   five stacks, lit by sword hits, falling away 2.5 s after the last
 *   단검 표식   the deepest stack of marks nearby, and how many are marked
 *   창 창끝     the reach, with the tip's stretch marked and the aimed monster on it
 *   스태프 공명 three charges to a free, stronger spell, and the element held
 *   마도서 낙인 how many branded monsters are near
 *   활 매의 시야 how far the nearest monster in front is, against the hawk's range
 * A hybrid's other weapon (`cr.o`) is named by a small second glyph at the right.
 */
import { live } from "./skillfx.js";

const INK = "#1a1622", TROUGH = "#2e2a36", DIM = "#4a4656", PALE = "#8f8b80", WHITE = "#f4efe2";
let g = null;
const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
/** Three-by-five digits. */
const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];
function num(n, x, y, c) {
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    const d = DIG[+s[i]];
    if (!d) continue;
    for (let k = 0; k < 15; k++) if (d[k] === "1") { r(x + i * 4 + (k % 3) + 1, y + Math.floor(k / 3) + 1, 1, 1, INK); }
    for (let k = 0; k < 15; k++) if (d[k] === "1") r(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1, c);
  }
}
/** Small glyphs (one per passive) at the left: 12×12 from strings, `#` the main tone and `o` the second. */
const GLYPH = {
  inertia: ["........##..", ".......###..", "......###...", ".....###....", "....###.....", "...###......", "..###.......", ".o##........", "oo#.........", ".oo.........", "o..o..o..o..", "............"],
  mark: [".....##.....", "....####....", "...##..##...", "..##....##..", ".##..##..##.", "##..####..##", "##..####..##", ".##..##..##.", "..##....##..", "...##..##...", "....####....", ".....##....."],
  tip: [".....#......", "....###.....", "....###.....", "...#####....", "...#####....", "....#o#.....", ".....o......", ".....o......", ".....o......", ".....o......", ".....o......", ".....o......"],
  reso: ["....####....", "...#....#...", "...#....#...", "....####....", ".....oo.....", "....oooo....", "...o.##.o...", "..##....##..", ".#..#..#..#.", ".#..#..#..#.", "..##....##..", "............"],
  brand: ["..########..", "..#......#..", "..#.oooo.#..", "..#.o..o.#..", "..#.oooo.#..", "..#...o..#..", "..#..ooo.#..", "..#......#..", "..#.####.#..", "..#......#..", "..########..", "............"],
  hawk: ["............", "....####....", "..##....##..", ".#...oo...#.", "#...oooo...#", "#...oooo...#", ".#...oo...#.", "..##....##..", "....####....", "............", "............", "............"],
};
const COL = { inertia: ["#ffb04a", "#fff2c0"], mark: ["#c070ff", "#ffd0ff"], tip: ["#5ad0b8", "#e8fff8"], reso: ["#b08aff", "#ffffff"], brand: ["#c8a0ff", "#ff6a8a"], hawk: ["#e8c070", "#ffffff"] };
function glyph(k, x, y, on) {
  const [c, c2] = on ? COL[k] : [DIM, DIM];
  GLYPH[k].forEach((row, j) => { for (let i = 0; i < 12; i++) { const ch = row[i]; if (ch === "#") r(x + i, y + j, 1, 1, c); else if (ch === "o") r(x + i, y + j, 1, 1, c2); } });
}
/** A tiny element sign: 1 fire, 2 ice, 3 lightning, 10×10. */
const ELEM = {
  1: ["....#.....", "....##....", "...###....", "...####...", "..#####.#.", "..#######.", ".###oo###.", ".##oooo##.", "..##oo##..", "...####..."],
  2: ["....##....", ".#..##..#.", "..#.##.#..", "...####...", "##########", "##########", "...####...", "..#.##.#..", ".#..##..#.", "....##...."],
  3: [".....###..", "....###...", "...###....", "..######..", ".....##...", "....##....", "...##.....", "..##......", ".##.......", "#........."],
};
const ECOL = { 1: ["#ff8a3a", "#ffd84a"], 2: ["#9fe8ff", "#ffffff"], 3: ["#ffe86a", "#ffffff"] };
function elem(e, x, y, on) {
  const [c, c2] = on ? ECOL[e] : [DIM, DIM];
  ELEM[e].forEach((row, j) => { for (let i = 0; i < 10; i++) { const ch = row[i]; if (ch === "#") r(x + i, y + j, 1, 1, c); else if (ch === "o") r(x + i, y + j, 1, 1, c2); } });
}
/** A row of `n` pips from x, `on` lit, `hot` flickering white. */
function pips(n, on, x, y, w, c, hot, t) {
  for (let i = 0; i < n; i++) {
    const px = x + i * (w + 2), lit = i < on, flick = hot && Math.sin(t / 80 + i) > 0;
    r(px, y, w, 10, INK);
    r(px + 1, y + 1, w - 2, 8, lit ? (flick ? "#ffffff" : c) : TROUGH);
    if (lit) r(px + 1, y + 1, w - 2, 2, flick ? "#ffffff" : "#ffffffa0");
  }
}
/** Monsters near the player (within `d` px), from the snapshot rows. */
function nearMobs(G, d) {
  const out = [];
  if (G) for (const m of G.mobs.values()) if (Math.hypot(m.x - G.me.x, m.y - G.me.y) <= d) out.push(m);
  return out;
}

export function drawWeaponGauge(cv, self, defs, t) {
  g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  const cr = self && self.cr;
  if (!cr) return;
  const G = live.G;
  const v = G && G.me && G.me.cv !== undefined ? G.me.cv : cr.v | 0;
  switch (cr.k) {
    case "inertia": {
      const max = cr.max || 5, full = v >= max;
      glyph("inertia", 1, 3, v > 0);
      pips(max, v, 17, 3, 17, full ? "#ffd84a" : "#f08a3a", full, t);
      break;
    }
    case "mark": {
      // the deepest stack on anything within reach, and how many monsters bear a mark
      let best = 0, n = 0;
      for (const m of nearMobs(G, 160)) { if (!m.mk) continue; n++; best = Math.max(best, m.mk); }
      glyph("mark", 1, 3, best > 0);
      for (let i = 0; i < (cr.max || 5); i++) {
        const x = 17 + i * 10, y = 3, on = i < best, hot = best >= 5 && Math.sin(t / 90) > 0;
        r(x + 3, y, 3, 1, INK); r(x + 1, y + 1, 7, 2, INK); r(x, y + 3, 9, 3, INK); r(x + 1, y + 6, 7, 2, INK); r(x + 3, y + 8, 3, 1, INK);
        const c = on ? (hot ? "#ffd0ff" : "#c070ff") : TROUGH;
        r(x + 3, y + 1, 3, 1, c); r(x + 2, y + 2, 5, 1, c); r(x + 1, y + 3, 7, 3, c); r(x + 2, y + 6, 5, 1, c); r(x + 3, y + 7, 3, 1, c);
        if (on) r(x + 3, y + 2, 1, 2, "#f0e0ff");
      }
      if (n) { r(69, 6, 1, 1, PALE); r(70, 7, 1, 1, PALE); r(71, 6, 1, 1, PALE); r(69, 8, 1, 1, PALE); r(71, 8, 1, 1, PALE); num(n, 74, 5, WHITE); }
      break;
    }
    case "tip": {
      // the reach as a ruler: the tip's stretch lit, the nearest monster in front marked on it
      const range = (defs.wkinds.spear && defs.wkinds.spear.range) || 54, tip = cr.tip || range * 0.72;
      let d = -1;
      if (G) for (const m of nearMobs(G, range + 30)) { const dd = Math.hypot(m.x - G.me.x, m.y - G.me.y); if (d < 0 || dd < d) d = dd; }
      const hot = d >= tip && d <= range + 6;
      glyph("tip", 1, 3, hot);
      const X = 17, W = 96, at = (u) => X + Math.round((Math.min(u, range) / range) * W);
      r(X, 6, W + 2, 6, INK); r(X + 1, 7, W, 4, TROUGH);
      r(at(tip), 7, X + W - at(tip) + 1, 4, hot ? "#7affe0" : "#3aa894");
      if (d >= 0 && d <= range + 30) { const x = Math.min(X + W, at(d)); r(x - 1, 3, 3, 3, INK); r(x, 4, 1, 1, hot ? WHITE : PALE); r(x, 12, 1, 3, hot ? WHITE : PALE); }
      break;
    }
    case "reso": {
      // three charges, then the element held (the live number: charges + 4 × element)
      const n = v & 3, e = v >> 2, full = n >= (cr.max || 3);
      glyph("reso", 1, 3, n > 0);
      pips(cr.max || 3, n, 17, 3, 16, full ? "#e0c8ff" : "#b08aff", full, t);
      for (let k = 1; k <= 3; k++) {
        const x = 74 + (k - 1) * 14, held = e === k;
        r(x - 2, 2, 14, 14, held ? WHITE : INK);
        r(x - 1, 3, 12, 12, held ? INK : "#221e2a");
        elem(k, x, 4, held);
      }
      break;
    }
    case "brand": {
      const n = nearMobs(G, 200).filter((m) => m.br).length;
      glyph("brand", 1, 3, n > 0);
      for (let i = 0; i < Math.min(8, n); i++) { const x = 18 + i * 9; r(x, 4, 7, 9, INK); r(x + 1, 5, 5, 7, "#c8a0ff"); r(x + 2, 7, 3, 1, "#ff6a8a"); }
      if (n) num(n, 106, 5, WHITE);
      break;
    }
    case "hawk": {
      // how far the nearest monster stands, against where the hawk's eye starts and peaks
      const d0 = cr.d0 || 40, span = cr.span || 110, X = 17, W = 96, at = (u) => X + Math.round(Math.min(1, u / (d0 + span)) * W);
      let d = -1;
      if (G) for (const m of nearMobs(G, d0 + span + 40)) { const dd = Math.hypot(m.x - G.me.x, m.y - G.me.y); if (d < 0 || dd < d) d = dd; }
      const k = d < 0 ? 0 : Math.max(0, Math.min(1, (d - d0) / span));
      glyph("hawk", 1, 3, k > 0.5);
      r(X, 6, W + 2, 6, INK); r(X + 1, 7, W, 4, TROUGH);
      for (let x = at(d0); x < X + W; x++) { const u = (x - at(d0)) / (X + W - at(d0)); r(x, 7, 1, 4, u < 0.5 ? "#8a6a3a" : u < 0.85 ? "#c89a4a" : "#ffd84a"); }
      if (d >= 0) { const x = Math.min(X + W, at(d)); r(x - 1, 3, 3, 3, INK); r(x, 4, 1, 1, WHITE); r(x, 12, 1, 3, WHITE); }
      break;
    }
  }
  // a hybrid's other weapon: its glyph, small, in the corner
  if (cr.o && GLYPH[cr.o.k]) { r(108, 9, 12, 11, INK); g.globalAlpha = 0.8; glyph(cr.o.k, 108, 9, true); g.globalAlpha = 1; }
}

/** One line for the tooltip over the gauge. */
export function gaugeTip(self) {
  const cr = self && self.cr;
  if (!cr) return "무기 패시브 — 손에 든 무기의 숙련 10에 배웁니다.";
  const G = live.G, v = G && G.me ? G.me.cv | 0 : cr.v | 0;
  const line = {
    inertia: `거검의 관성 ${v}/${cr.max} — 대검으로 맞힐 때마다 1 쌓입니다. 1당 사거리 +6%, 치명타 피해 증가. 2.5초 동안 맞히지 못하면 사라집니다.`,
    mark: "급소 도려내기 — 단검 기본 공격이 적에게 표식을 남깁니다(최대 5). 표식 1개당 치명타 확률 증가, 표식 있는 적을 베면 출혈과 이동 속도 증가.",
    tip: "창끝의 거리 — 사거리 끝부분(밝은 칸)으로 맞히면 피해 ×1.5, 방어력 35% 무시.",
    reso: `마력 공명 ${v & 3}/${cr.max} — 스태프 스킬 세 번마다 다음 스태프 스킬은 MP 없이, 피해 +30%. 불·얼음·번개가 겹치면 원소 반응.`,
    brand: "금서의 낙인 — 마도서 스킬에 맞은 적은 6초간 누구에게서나 피해를 15% 더 받습니다.",
    hawk: "매의 시야 — 쏜 자리에서 멀리 날아간 화살일수록 셉니다(150에서 최대).",
  }[cr.k];
  return cr.o ? `${line} · 보조 무기의 패시브도 함께 켜져 있습니다.` : line;
}
