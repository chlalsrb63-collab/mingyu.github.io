import { dinerFoodSprite, drawDinerSink } from "./coop-diner-art.js";
import { setWorkPrompt } from "./coop-briefing.js";

const tile = ([x, y]) => [x * 16 + 8, y * 16 + 10];
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const dist = (x, y, p) => Math.hypot(x - p.x, y - p.y);

let prompt, menu, current, selected = 0, cookingAt = null;

function nearest(cells, me, reach) {
  let found = -1, best = reach;
  for (const [i, cell] of cells.entries()) {
    const distance = dist(...tile(cell), me);
    if (distance > best || (distance === best && found >= 0)) continue;
    found = i; best = distance;
  }
  return found;
}

function action(coop, rows, me, held, timeLeft) {
  const { stove, sink, tables } = coop.jobs.diner[7];
  const reach = coop.stationReach;
  const kitchen = nearest(stove, me, reach), table = nearest(tables, me, reach);
  const [tx, ty] = table < 0 ? [null, null] : tile(tables[table]);
  const target = rows.find((r) => (r[1] === 9 || (r[1] === 3 && !r[11])) && r[2] === tx && r[3] === ty);
  const atSink = dist(...tile(sink), me) <= reach;
  if (held === 3) return atSink ? { label: "빈그릇 반납" } : null;
  if (held != null) {
    if (atSink) return { label: "남은 요리 버리기" };
    if (target?.[1] !== 3 || target[4] < 0 || timeLeft(target[5]) <= 0 || target[9] > 0) return null;
    return target[4] === held ? { label: "요리 제출" } : { label: "주문과 다른 요리예요", disabled: true };
  }
  if (kitchen >= 0) {
    const [x, y] = tile(stove[kitchen]);
    const pot = rows.find((r) => r[1] === 4 && r[2] === x && r[3] === y);
    if (!pot) return { label: "조리대 열기", stove: kitchen };
    const seconds = Math.ceil(timeLeft(pot[5]) / 1000);
    return seconds > 0 ? { label: `조리 중 · ${seconds}초`, disabled: true } : { label: "완성 요리 들기" };
  }
  return target?.[1] === 9 ? { label: "빈그릇 줍기" } : null;
}

export const menuOpen = () => cookingAt !== null;

function closeMenu() {
  cookingAt = null;
  if (menu) menu.hidden = true;
}

function choose(recipe) {
  if (!current || cookingAt === null) return;
  const i = cookingAt;
  closeMenu();
  current.send({ t: "coop_act", i, r: recipe });
}

function select(recipe) {
  selected = recipe;
  Array.from(menu.querySelectorAll(".cd-recipe")).forEach((button, i) => {
    button.setAttribute("aria-pressed", i === recipe ? "true" : "false");
  });
}

function openMenu(coop, stove) {
  if (!menu) {
    menu = document.createElement("section");
    menu.id = "diner-menu"; menu.className = "frame";
    menu.setAttribute("aria-labelledby", "diner-menu-title");
    menu.innerHTML = `<header><h2 id="diner-menu-title">만들 요리</h2><button type="button" class="btn cd-close" aria-label="닫기">×</button></header>
      <div class="cd-recipes"></div><p>↑ ↓ 선택 · F 조리 시작</p>`;
    menu.querySelector(".cd-close").addEventListener("click", closeMenu);
    menu.addEventListener("pointerdown", (e) => e.stopPropagation());
    document.getElementById("hud").append(menu);
    const list = menu.querySelector(".cd-recipes");
    coop.dishes.forEach((name, i) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "btn cd-recipe";
      const icon = document.createElement("canvas");
      icon.width = 15; icon.height = 12; icon.setAttribute("aria-hidden", "true");
      icon.getContext("2d").drawImage(dinerFoodSprite(i), 0, 0);
      const label = document.createElement("b"); label.textContent = name;
      const time = document.createElement("span"); time.textContent = (coop.cook[i] / 1000) + "초";
      button.append(icon, label, time);
      button.addEventListener("click", () => choose(i));
      list.append(button);
    });
  }
  cookingAt = stove;
  select(0);
  menu.hidden = false;
}

export function key(e) {
  if (!menuOpen()) return false;
  const count = current.coop.dishes.length;
  if (e.key === "Escape") closeMenu();
  else if (e.key === "ArrowDown") select((selected + 1) % count);
  else if (e.key === "ArrowUp") select((selected + count - 1) % count);
  else if (!e.repeat && (e.code === "KeyF" || e.code === "Space" || e.code === "Enter")) choose(selected);
  return true;
}

export function interact() {
  if (current?.disabled || !current) return;
  if (current.stove !== undefined) openMenu(current.coop, current.stove);
  else current.send({ t: "coop_act" });
}

export function update(coop, rows, me, held, timeLeft, send) {
  const next = coop && action(coop, rows, me, held, timeLeft);
  current = next && { ...next, coop, send };
  if (menuOpen() && current?.stove !== cookingAt) closeMenu();
  if (!current && !prompt) return;
  if (!prompt) {
    prompt = document.createElement("button");
    prompt.id = "diner-prompt"; prompt.type = "button"; prompt.className = "btn gold";
    prompt.addEventListener("pointerdown", (e) => e.stopPropagation());
    prompt.addEventListener("click", interact);
    document.getElementById("hud").append(prompt);
  }
  prompt.hidden = !current || menuOpen();
  if (!current) return;
  setWorkPrompt(prompt, current.label, current.disabled ? "" : "F");
  prompt.disabled = !!current.disabled;
}

function tag(g, x, y, text, c) {
  g.font = "8px Galmuri11, monospace";
  const w = Math.ceil(g.measureText(text).width / 2) + 3;
  px(g, x - w, y - 8, w * 2, 10, "#281f25");
  g.textAlign = "center"; g.fillStyle = c;
  g.fillText(text, x, y);
}

export function stations(st, prop) {
  for (const [key, text, color, cells, rise] of [
    ["table", "테이블", "#f1ddc5", st.tables, 16],
    ["stove", "조리대", "#ffe598", st.stove, 22],
    ["sink", "싱크대", "#a8e4f1", [st.sink], 30],
  ]) cells.forEach((cell, i) => {
    const [x, y] = tile(cell);
    prop(key + i, { x, y, until: Infinity, draw(g, t, sx, sy) {
      sx = Math.round(sx); sy = Math.round(sy);
      if (key === "sink") drawDinerSink(g, sx, sy);
      tag(g, sx, sy - rise, text, color);
    } });
  });
}

export function customerPosition(row, door, timeLeft) {
  const [, , x, tableY, , , , arrives, walk, , departure, gone] = row;
  const [dx, dy] = tile(door), y = tableY + 16;
  const remaining = Math.max(0, Math.min(1, timeLeft(gone ? departure : arrives) / (walk * 100 || 1)));
  const first = Math.abs(y - dy), second = Math.abs(x - dx), done = (first + second) * (gone ? remaining : 1 - remaining);
  return done <= first ? [dx, dy + Math.sign(y - dy) * done] : [dx + Math.sign(x - dx) * (done - first), y];
}

function patience(g, x, y, fraction) {
  const width = Math.max(0, Math.min(16, Math.ceil(16 * fraction)));
  px(g, x - 9, y, 18, 3, "#2b2230");
  px(g, x - 8, y + 1, width, 1, fraction > 0.5 ? "#92d573" : fraction > 0.25 ? "#f5cd68" : "#ef7663");
}

export function drawDiner(g, t, x, y, row, timeLeft, cookTimes, body) {
  const [id, type, , , dish, remaining, total, arrival, , eat, , gone] = row;
  if (type === 3) {
    const walking = !!gone || timeLeft(arrival) > 0;
    body(g, t, x, y, id, walking, !walking);
    if (walking || dish < 0) return;
    const sprite = dinerFoodSprite(dish);
    if (eat > 0) {
      g.drawImage(sprite, x - 7, y - 19);
      if (Math.floor(t / 300) % 2) px(g, x + 7, y - 16, 2, 2, "#fff3c6");
      return;
    }
    px(g, x - 11, y - 38, 23, 19, "#211a25");
    px(g, x - 10, y - 37, 21, 17, "#fff4d8");
    px(g, x - 2, y - 20, 5, 4, "#211a25");
    px(g, x - 1, y - 21, 3, 3, "#fff4d8");
    g.drawImage(sprite, x - 7, y - 35);
    patience(g, x, y - 41, timeLeft(remaining) / (total * 100));
  } else if (type === 4) {
    const left = timeLeft(remaining);
    g.drawImage(dinerFoodSprite(dish), x - 7, y - 18);
    if (left > 0) patience(g, x, y - 33, 1 - left / cookTimes[dish]);
    else tag(g, x, y - 32, "완성", "#b9e997");
  } else if (type === 9) {
    g.drawImage(dinerFoodSprite(3), x - 7, y - 15);
    tag(g, x, y - 28, "빈그릇", remaining ? "#ffad93" : "#e9d9be");
  }
}
