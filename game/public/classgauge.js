/**
 * The class gauge in the bottom-centre status panel: what each class plays around,
 * at a glance. The HUD calls drawClassGauge(canvas, self, defs, t) every frame;
 * `self.cr` says which gauge (and its timers), and the live number rides on every
 * snapshot (read by skillfx.js). 120×20 pixels, drawn pixel by pixel.
 *
 *   전사 투지   a bar that fills with every blow given and taken
 *   도적 표식   the deepest stack of marks nearby, and how many are marked
 *   창술사 집중 five spear-points, lit one by one by hits with the tip
 *   마도사 원소 the three elements, the one held lit, and what the others would make
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
/** A thin timer line along the bottom: `u` of it left. */
function timer(y, u, c) {
  if (u <= 0) return;
  r(16, y, 102, 2, TROUGH);
  r(16, y, Math.max(1, Math.round(102 * Math.min(1, u))), 2, c);
}
/** Small glyphs (one per class) at the left: 12×12 from strings. */
const GLYPH = {
  grit: ["....##......", "...###......", "...####.....", "..#####..#..", "..######.##.", ".##########.", ".####oo####.", "####oooo####", "####oooo####", ".####oo####.", "..########..", "....####...."],
  mark: [".....##.....", "....####....", "...##..##...", "..##....##..", ".##..##..##.", "##..####..##", "##..####..##", ".##..##..##.", "..##....##..", "...##..##...", "....####....", ".....##....."],
  focus: [".....#......", "....###.....", "....###.....", "...#####....", "...#####....", "....#o#.....", ".....o......", ".....o......", ".....o......", ".....o......", ".....o......", ".....o......"],
  weave: ["....####....", "...#....#...", "...#....#...", "....####....", ".....oo.....", "....oooo....", "...o.##.o...", "..##....##..", ".#..#..#..#.", ".#..#..#..#.", "..##....##..", "............"],
};
function glyph(k, x, y, c, c2) {
  const rows = GLYPH[k];
  rows.forEach((row, j) => { for (let i = 0; i < 12; i++) { const ch = row[i]; if (ch === "#") r(x + i, y + j, 1, 1, c); else if (ch === "o") r(x + i, y + j, 1, 1, c2); } });
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
/** Which reaction two elements make: 1 steam, 2 superconduct, 3 overload. */
const REACT = (a, b) => ((a === 1 && b === 2) || (a === 2 && b === 1) ? 1 : (a === 2 && b === 3) || (a === 3 && b === 2) ? 2 : 3);
const RCOL = [null, "#ffffff", "#b8a0ff", "#ffb04a"];

export function drawClassGauge(cv, self, defs, t) {
  g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  const cr = self && self.cr;
  if (!cr) return;
  const G = live.G;
  const v = G && G.me && G.me.cv !== undefined ? G.me.cv : cr.v | 0;
  const sinceSelf = G && G.selfAt ? t - G.selfAt : 0;
  switch (cr.k) {
    case "grit": {
      const max = cr.max || 100, full = v >= max;
      glyph("grit", 1, 3, full ? "#ffd84a" : v > 0 ? "#f08a3a" : DIM, full ? "#ffffff" : "#ffd84a");
      // a bar of ten cells
      r(16, 3, 102, 10, INK);
      r(17, 4, 100, 8, TROUGH);
      const w = Math.round((100 * Math.min(v, max)) / max);
      const hot = full && Math.sin(t / 90) > 0;
      const col = hot ? "#fff2a0" : v >= max ? "#ffd84a" : v >= 60 ? "#f0a040" : "#d8703a";
      r(17, 4, w, 8, col);
      r(17, 4, w, 2, hot ? "#ffffff" : "#ffd890");
      r(17, 10, w, 2, "#a8482a");
      for (let i = 1; i < 10; i++) r(17 + i * 10, 4, 1, 8, INK);
      num(v, 118 - String(v).length * 4 - 2, 5, WHITE);
      // the sword out of hand, a giant's time left
      if (cr.sw) timer(15, (cr.sw - sinceSelf) / 8000, PALE);
      if (cr.gi) timer(18, (cr.gi - sinceSelf) / 10000, "#ffd84a");
      break;
    }
    case "mark": {
      // the deepest stack on anything within reach, and how many monsters bear a mark
      let best = 0, n = 0;
      if (G) for (const m of G.mobs.values()) { if (!m.mk) continue; if (Math.hypot(m.x - G.me.x, m.y - G.me.y) > 160) continue; n++; best = Math.max(best, m.mk); }
      glyph("mark", 1, 3, best ? "#c070ff" : DIM, best ? "#ffd0ff" : DIM);
      for (let i = 0; i < (cr.max || 5); i++) {
        const x = 17 + i * 10, y = 3, on = i < best, hot = best >= 5 && Math.sin(t / 90) > 0;
        r(x + 3, y, 3, 1, INK); r(x + 1, y + 1, 7, 2, INK); r(x, y + 3, 9, 3, INK); r(x + 1, y + 6, 7, 2, INK); r(x + 3, y + 8, 3, 1, INK);
        const c = on ? (hot ? "#ffd0ff" : "#c070ff") : TROUGH;
        r(x + 3, y + 1, 3, 1, c); r(x + 2, y + 2, 5, 1, c); r(x + 1, y + 3, 7, 3, c); r(x + 2, y + 6, 5, 1, c); r(x + 3, y + 7, 3, 1, c);
        if (on) r(x + 3, y + 2, 1, 2, "#f0e0ff");
      }
      if (n) { r(69, 6, 1, 1, PALE); r(70, 7, 1, 1, PALE); r(71, 6, 1, 1, PALE); r(69, 8, 1, 1, PALE); r(71, 8, 1, 1, PALE); num(n, 74, 5, WHITE); }
      // venomed strikes left, as drops; a lucky coin waiting
      for (let i = 0; i < v; i++) { const x = 86 + i * 4; r(x + 1, 3, 1, 1, "#8ad84a"); r(x, 4, 3, 3, "#8ad84a"); r(x + 1, 7, 1, 1, "#5aa83a"); }
      if (cr.coin) { const x = 108, y = 9 + (Math.sin(t / 150) > 0 ? 0 : 1); r(x, y, 8, 8, INK); r(x + 1, y + 1, 6, 6, "#ffd84a"); r(x + 3, y + 2, 2, 4, "#c89a3a"); r(x + 1, y + 1, 1, 1, "#fff6b0"); }
      break;
    }
    case "focus": {
      const max = cr.max || 5, full = v >= max;
      glyph("focus", 1, 3, full ? "#7affe0" : v ? "#5ad0b8" : DIM, full ? "#ffffff" : PALE);
      for (let i = 0; i < max; i++) {
        const x = 18 + i * 19, y = 3, on = i < v, glow = full && Math.sin(t / 80 + i) > 0;
        const c = on ? (glow ? "#e8fff8" : "#5ad0b8") : TROUGH;
        // a spear-point pointing right
        for (let j = 0; j < 9; j++) { const w = 13 - Math.abs(j - 4) * 3; r(x, y + j, Math.max(1, w) + 2, 1, INK); }
        for (let j = 1; j < 8; j++) { const w = 13 - Math.abs(j - 4) * 3; if (w > 0) r(x + 1, y + j, w, 1, c); }
        if (on) r(x + 2, y + 3, 4, 1, glow ? "#ffffff" : "#c8fff0");
      }
      if (full) { r(16, 15, 102, 2, Math.sin(t / 80) > 0 ? "#7affe0" : "#3aa894"); }
      break;
    }
    case "weave": {
      glyph("weave", 1, 3, v ? ECOL[v][0] : DIM, v ? WHITE : DIM);
      const surge = cr.su && cr.su - sinceSelf > 0;
      for (let e = 1; e <= 3; e++) {
        const x = 18 + (e - 1) * 26, held = v === e;
        r(x - 2, 1, 14, 14, held ? WHITE : INK);
        r(x - 1, 2, 12, 12, held ? INK : "#221e2a");
        elem(e, x, 3, held || surge || !v);
        // casting this one on what is held would make…
        if (v && !held) { const c = RCOL[REACT(v, e)]; r(x + 2, 16, 6, 2, c); if (Math.sin(t / 120) > 0) r(x + 4, 18, 2, 1, c); }
      }
      // how long the held element lasts; the surge's time left
      if (v && cr.left !== undefined) { const left = (G && G.weaveAt && G.weaveE === v) ? 1 - (t - G.weaveAt) / 5000 : 1; r(96, 4, 20, 6, INK); r(97, 5, Math.max(0, Math.round(18 * left)), 4, ECOL[v][0]); }
      if (surge) { const u = (cr.su - sinceSelf) / 8000; r(96, 12, 20, 4, INK); r(97, 13, Math.max(1, Math.round(18 * u)), 2, "#ffe86a"); }
      if (G) { if (G.weaveE !== v) { G.weaveE = v; G.weaveAt = t; } }
      break;
    }
  }
}

/** One line for the tooltip over the gauge. */
export function gaugeTip(self) {
  const cr = self && self.cr;
  if (!cr) return "";
  const G = live.G, v = G && G.me ? G.me.cv | 0 : cr.v | 0;
  switch (cr.k) {
    case "grit": return `투지 ${v}/${cr.max} — 기본 공격(+8)과 받는 피해(+4)로 쌓입니다. [투지 폭발]이 전부 터뜨리고, 4초간 싸우지 않으면 식습니다.`;
    case "mark": return "표식 — 기본 공격마다 적에게 하나씩(최대 5) 남습니다. 표식 1개당 치명타 +4%. [표식 수확]·[그림자 무도]가 터뜨립니다. 10초가 지나면 사라집니다.";
    case "focus": return `집중 ${v}/${cr.max} — 사거리 끝(창끝)으로 맞히면 피해 +50%, 집중 +1. 집중 5이면 다음 스킬이 강화되고, [백보일섬]은 남은 집중만큼 강해집니다.`;
    default: return "원소 엮기 — 불·얼음·번개 주문이 다른 원소 위에 떨어지면 반응합니다. 불+얼음 증기 폭발, 얼음+번개 초전도(받는 피해 +30%), 번개+불 과부하. 원소는 5초간 남습니다.";
  }
}
