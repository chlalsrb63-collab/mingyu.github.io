import { libraryBookSprite } from "./coop-lib-art.js";
import { setWorkPrompt } from "./coop-briefing.js";

const tile = ([x, y]) => [x * 16 + 8, y * 16 + 10];
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const distance = (me, cell) => { const [x, y] = tile(cell); return Math.hypot(me.x - x, me.y - y); };
let button, label, send, highlighted = 0;

function nextAction(coop, waiting, me, held, readyLoan, availableLoans, recoveredReturns) {
  const { desk, shelf } = coop.jobs.lib[7], reach = coop.stationReach ?? 34;
  if (desk.some((cell) => distance(me, cell) <= reach)) {
    if (readyLoan) return "대출 도서 건네기";
    if (!held) {
      if (recoveredReturns > 0) return "남겨진 반납 도서 받기";
      if (waiting.some((row) => row[4] === 1)) return "반납 도서 받기";
    }
  }
  let best = Infinity, closest = -1;
  for (const [i, cell] of shelf.entries()) {
    const d = distance(me, cell);
    if (d <= reach && d < best) { best = d; closest = i; }
  }
  if (closest < 0) return "";
  const genre = Math.floor(closest / 6);
  if (held && held[0] === genre) return held[2] === 1 ? "책장에 꽂기" : "책장으로 돌려놓기";
  if (!held && (availableLoans & (1 << genre))) return "대출 도서 꺼내기";
  return "";
}

export function interact() { if (label) send({ t: "coop_act" }); }

export function update(coop, rows, me, held, act, recoveredReturns = 0) {
  if (!me) coop = null;
  const waiting = coop ? rows.filter((row) => row[1] === 13 && row[9] === 1) : [];
  const readyLoan = held?.[2] === 0 && waiting.some((row) => row[0] === held[3] && row[4] === 0);
  const availableLoans = waiting.reduce((mask, row) => row[4] === 0 && !row[13] ? mask | (1 << row[5]) : mask, 0);
  highlighted = !coop ? 0 : held ? (readyLoan ? 0 : 1 << held[0]) : availableLoans;
  label = coop ? nextAction(coop, waiting, me, held, readyLoan, availableLoans, recoveredReturns) : "";
  send = act;
  if (!button && label) {
    button = document.createElement("button");
    button.id = "library-prompt"; button.className = "btn gold"; button.type = "button";
    button.addEventListener("pointerdown", (e) => e.stopPropagation());
    button.addEventListener("click", interact);
    document.getElementById("hud").append(button);
  }
  if (!button) return;
  button.hidden = !label;
  if (label) setWorkPrompt(button, label);
}

function tag(g, x, y, text, color, active = false) {
  g.font = "8px Galmuri11, monospace";
  const w = Math.ceil(g.measureText(text).width / 2) + 4;
  px(g, x - w, y - 8, w * 2, 11, active ? "#5c3927" : "#222030");
  px(g, x - w, y + 2, w * 2, 1, color);
  if (active) {
    px(g, x + w + 2, y - 6, 4, 3, "#ffd981");
    px(g, x + w + 3, y - 3, 2, 2, "#ffd981");
  }
  g.textAlign = "center"; g.fillStyle = "#fff4d8";
  g.fillText(text, x, y);
  g.textAlign = "left";
}

export function stations(st, lib, prop) {
  const [left, row] = st.desk[0], [right] = st.desk.at(-1);
  const [dx, dy] = tile([(left + right) / 2, row]);
  prop("desk", { x: dx, y: dy, until: Infinity, draw(g, t, x, y) {
    tag(g, Math.round(x), Math.round(y) - 26, "안내데스크", "#efc67b");
  } });
  lib.shelves.forEach(([left, row], i) => {
    const [x, y] = tile([left + 2.5, row]);
    prop("shelf" + i, { x, y, until: Infinity, draw(g, t, sx, sy) {
      tag(g, Math.round(sx), Math.round(sy) - 30, lib.genres[i], lib.cols[i], !!(highlighted & (1 << i)));
    } });
  });
}

export function position(row, door, timeLeft) {
  const [, , x, y, , , , , , phase, left, total] = row;
  if (phase === 1) return [x, y];
  const [dx, dy] = tile(door);
  const f = Math.max(0, Math.min(1, timeLeft(left) / (total * 100 || 1)));
  if (phase === 0) return [x + (dx - x) * f, y + (dy - y) * f];
  // Returning visitors use the side aisle, keeping the entrance queue visible.
  const aisle = dx + 32, across = aisle - x, down = dy - y;
  const step = (1 - f) * (across + down + aisle - dx);
  if (step < across) return [x + step, y];
  if (step < across + down) return [aisle, y + step - across];
  return [aisle - step + across + down, dy];
}

export function drawCustomer(g, t, x, y, row, lib, body, announce, timeLeft) {
  const [id, , , , kind, genre, , , , phase] = row;
  body(g, t, x, y, id, phase !== 1);
  if (phase === 0) return;
  if (phase === 2) {
    if (row[12]) tag(g, x, y - 26, "감사합니다!", "#f6d888");
    return;
  }
  if (!announce) return;
  const request = kind === 0 ? (row[13] ? " 책 준비 중" : "을 읽고 싶어요") : "을 반납하러 왔어요";
  const text = lib.genres[genre] + request;
  g.font = "8px Galmuri11, monospace";
  const width = Math.ceil(g.measureText(text).width) + 27, left = kind === 0 ? x - width - 12 : x + 12, top = y - 36;
  const edge = kind === 0 ? left + width - 1 : left - 3;
  px(g, left, top, width, 19, "#252030");
  px(g, left + 1, top + 1, width - 2, 17, "#fff3d4");
  px(g, edge, top + 13, 4, 3, "#252030");
  px(g, edge + 1, top + 13, 2, 2, "#fff3d4");
  const art = libraryBookSprite(genre);
  if (art) g.drawImage(art, left + 3, top + 2);
  g.textAlign = "left"; g.fillStyle = "#352936";
  g.fillText(text, left + 22, top + 13);
  const patience = Math.max(0, Math.min(1, timeLeft(row[7]) / (row[8] * 100 || 1)));
  px(g, left + 1, top + 17, width - 2, 1, "#676070");
  px(g, left + 1, top + 17, Math.round((width - 2) * patience), 1, patience > 0.5 ? "#518d62" : patience > 0.25 ? "#bd782b" : "#bf424d");
}
