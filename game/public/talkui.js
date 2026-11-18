/**
 * The talk window's portrait (#talk-port): the NPC's own figure, drawn by the same sprite builder the world uses
 * (sprites.js npcSheet → front frame), cropped to the head and body and shown at a whole-number scale, pixelated.
 * An NPC that is not a person (a sign, a board) gets no portrait and the text takes the width.
 */
import * as SP from "./sprites.js";
import { $, G } from "./state.js";

const ROLE = { elder: "촌장", smith: "대장장이", shop: "상점", train: "훈련 교관", warp: "이동석 지기", collector: "수집가", achieve: "업적 전령", daily: "일일 의뢰", bank: "창고지기", costume: "의상점", job: "전직관", talk: "마을 사람" };

export function portrait(n) {
  const box = $("#talk-port"), cv = $("#talk-pc");
  if (!box || !cv) return;
  $("#talk-role").textContent = ROLE[n.originRole || n.role] || "";
  let frame = null;
  try { if (!n.thing) frame = SP.npcSheet(n).front[SP.FRAME.stand]; } catch { frame = null; }
  box.hidden = !frame;
  if (!frame) return;
  paint(cv, frame, false);
  me();
}

function paint(cv, frame, flip) {
  const d = frame.width / SP.SIZE, g = cv.getContext("2d");   // pixels per logical pixel (the sheet is 2× dense)
  cv.width = 20 * d; cv.height = 22 * d;
  g.imageSmoothingEnabled = false;
  if (flip) { g.translate(cv.width, 0); g.scale(-1, 1); }
  g.drawImage(frame, 6 * d, 5 * d, 20 * d, 22 * d, 0, 0, 20 * d, 22 * d);
  // whole-number scale of the source pixels: 4 at 720p/768p, less on a short screen
  const k = Math.max(2, Math.min(6, Math.floor(innerHeight / 150)));
  cv.style.width = `${cv.width * k}px`; cv.style.height = `${cv.height * k}px`;
}

/** Your own figure on the right, facing the NPC; only shown in a quest talk (CSS: body.talkq). */
function me() {
  const box = $("#talk-me"), cv = $("#talk-mc"), w = G.who && G.who.get(G.you);
  if (!box || !cv) return;
  let frame = null;
  try { if (w) frame = SP.personSheet(SP.playerLook(w.cls, w.look, w.gear)).front[SP.FRAME.stand]; } catch { frame = null; }
  box.dataset.ok = frame ? "1" : "";
  if (!frame) return;
  $("#talk-mn").textContent = w.name || "";
  paint(cv, frame, true);
}
