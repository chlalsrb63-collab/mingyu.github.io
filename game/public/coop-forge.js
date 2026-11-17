import { forgeIngotSprite, forgeOrderSprite } from "./coop-forge-art.js";
import { setWorkPrompt } from "./coop-briefing.js";

const tile = ([x, y]) => [x * 16 + 8, y * 16 + 10];
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const metals = ["철", "은", "금", "미스릴"];
const colors = ["#dfc9be", "#d5e8ff", "#ffdb73", "#9af3da"];
const clamp = (r) => Math.max(0, Math.min(100, r));
let panel, prompt, lane, action, send, flash = null;

export const active = () => !!lane;
export function work() { if (action && !lane) send({ t: "coop_act" }); }
export function tap() { if (lane) send({ t: "coop_act", beat: 1 }); }
export function cancel() { if (lane) send({ t: "coop_act", cancel: 1 }); }

function mount() {
  const hud = document.getElementById("hud");
  prompt = document.createElement("button");
  prompt.id = "forge-prompt"; prompt.type = "button"; prompt.className = "btn gold"; prompt.hidden = true;
  prompt.addEventListener("pointerdown", (e) => e.stopPropagation());
  prompt.addEventListener("click", work);
  panel = document.createElement("section");
  panel.id = "forge-rhythm"; panel.className = "frame"; panel.hidden = true;
  panel.setAttribute("aria-labelledby", "forge-rhythm-title");
  panel.innerHTML = `<header><b id="forge-rhythm-title"></b><span class="fr-progress"></span></header>
    <div class="fr-track" aria-hidden="true"><span class="fr-window"></span><i></i></div>
    <p class="fr-pair"></p><div class="fr-buttons"><button type="button" class="btn gold fr-hit">박자 맞추기 · 스페이스</button>
    <button type="button" class="btn fr-cancel">나오기</button></div>`;
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());
  panel.querySelector(".fr-hit").addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); });
  panel.querySelector(".fr-hit").addEventListener("click", (e) => { if (!e.detail) tap(); });
  panel.querySelector(".fr-cancel").addEventListener("click", cancel);
  hud.append(prompt, panel);
}

const write = (el, value) => { if (el.textContent !== value) el.textContent = value; };
function near(me, x, y, reach) { return !!me && Math.hypot(me.x - x, me.y - y) <= reach; }
function nearest(me, rows, point, reach) {
  let index = -1, best = reach;
  rows.forEach((row, i) => {
    const [x, y] = point(row), d = me ? Math.hypot(me.x - x, me.y - y) : Infinity;
    if (d > best || (index >= 0 && d === best)) return;
    index = i; best = d;
  });
  return index;
}
const anvilName = (index) => `${index + 1}번 모루`;
/** Empty-handed tongs workers already assigned to a different rhythm lane cannot join. */
function anvilCanStart(anvil, rows, team, players, reach) {
  return team.some(([eid, role, held]) => {
    const peer = players.get(eid);
    return peer && role === 0 && !held && near({ x: peer.tx, y: peer.ty }, anvil[2], anvil[3], reach)
      && !rows.some((r) => r[1] === 7 && r[6] === 2 && r[11] === eid);
  });
}

export function update(coop, rows, me, mine, elapsed, act, team, players) {
  send = act;
  const anvils = coop ? rows.filter((r) => r[1] === 7) : [];
  lane = mine && anvils.find((r) => r[6] === 2 && (r[11] === mine[0] || r[12] === mine[0]));
  action = null;
  let note = "";
  if (coop && mine && !lane) {
    const reach = coop.stationReach, ingot = mine[4] | 0, tongs = mine[1] === 0;
    const index = nearest(me, anvils, (r) => [r[2], r[3]], reach), anvil = anvils[index];
    if (anvil && tongs && ingot) {
      const metal = ingot - 1;
      const open = rows.filter((r) => r[1] === 8 && r[7] === 0 && !r[8] && r[10] === metal).length;
      const taken = anvils.filter((r) => r[6] > 0 && r[5] === metal).length;
      if (anvil[6] > 0) note = "빈 모루에 주괴를 올리세요";
      else if (open <= taken) note = `${metals[metal]} 주괴를 기다리는 주문이 없어요`;
      else action = `${anvilName(index)}에 주괴 올리기`;
    }
    if (anvil && !tongs && anvil[6] === 1) {
      if (anvilCanStart(anvil, rows, team, players, reach)) action = "합동 단조 시작";
      else note = `${anvilName(index)} 곁에 빈손인 집게 담당이 필요해요`;
    }
    if (tongs) {
      const crate = nearest(me, coop.jobs.forge[7].crate, tile, reach);
      if (crate >= 0) action = ingot ? "주괴 내려놓기" : metals[crate] + " 주괴 집기";
    }
  }
  if (!panel && (lane || action || note)) mount();
  if (!panel) return;
  panel.hidden = !lane;
  prompt.hidden = !action && !note;
  prompt.disabled = !action;
  if (action || note) setWorkPrompt(prompt, action || note, action ? "F" : "");
  if (!lane) return;

  const phase = lane[7] - elapsed, mask = lane[13] | 0;
  const role = mine[1], who = (bit) => (mask & bit) ? "맞춤" : "대기";
  const myBit = 1 << role;
  const track = panel.querySelector(".fr-track"), span = 1100;
  panel.dataset.flash = flash && performance.now() < flash.until ? flash.kind : "";
  write(panel.querySelector("header b"), `${anvilName(anvils.indexOf(lane))} · ${role ? "망치" : "집게"}`);
  write(panel.querySelector(".fr-progress"), `${lane[9]} / ${lane[10]}`);
  write(panel.querySelector(".fr-pair"), `나 ${who(myBit)}   ·   동료 ${who(3 ^ myBit)}`);
  track.style.setProperty("--note", clamp(24 + phase * 100 / span) + "%");
  track.style.setProperty("--window", clamp(lane[8] * 200 / span) + "%");
}

export function feedback(code, x, y) {
  if (!lane || lane[2] !== x || lane[3] !== y || (code !== 62 && code !== 63)) return;
  flash = { kind: code === 62 ? "good" : "miss", until: performance.now() + 210 };
}

function tag(g, x, y, text, color) {
  g.font = "8px Galmuri11, monospace";
  const w = Math.ceil(g.measureText(text).width / 2) + 3;
  px(g, x - w, y - 8, w * 2, 10, "#2b2328");
  g.textAlign = "center"; g.fillStyle = color;
  g.fillText(text, x, y); g.textAlign = "left";
}

export function stations(st, prop) {
  st.anvil.forEach((cell, i) => {
    const [x, y] = tile(cell);
    prop("anvil" + i, { x, y, until: Infinity, draw(g, t, sx, sy) {
      tag(g, Math.round(sx), Math.round(sy) - 35, anvilName(i), "#ffe9ab");
    } });
  });
  st.crate.forEach((cell, i) => {
    const [x, y] = tile(cell);
    prop("crate" + i, { x, y, until: Infinity, draw(g, t, sx, sy) {
      sx = Math.round(sx); sy = Math.round(sy);
      const ingot = forgeIngotSprite(i);
      g.drawImage(ingot, sx - 8, sy - 27);
      tag(g, sx, sy - 30, metals[i] + "주괴상자", colors[i]);
    } });
  });
}

export function customerPosition(row, door, timeLeft) {
  const [, , x, y, , , , arrival, gone, departure] = row, [dx, dy] = tile(door);
  const ms = Math.hypot(dx - x, dy - y) * 1000 / 48;
  const remaining = Math.max(0, Math.min(1, timeLeft(gone ? departure : arrival) / (ms || 1)));
  const f = gone ? 1 - remaining : remaining;
  return [x + (dx - x) * f, y + (dy - y) * f];
}

export function drawForge(g, t, x, y, row, timeLeft, body) {
  const [id, type, , , kind] = row;
  if (type === 7) {
    const metal = row[5], status = row[6];
    if (metal >= 0) g.drawImage(forgeIngotSprite(metal), x - 8, y - 24);
    if (status === 2 && Math.floor(t / 150) % 2) px(g, x + 10, y - 16, 2, 2, colors[metal]);
    return;
  }
  const metal = row[10];
  const gone = row[8], walking = row[7] > 0 && timeLeft(row[7]) > 0;
  body(g, t, x, y, id, walking || !!gone);
  if (gone) {
    if (row[9] * 100 - timeLeft(row[9]) > 850) return;
    const ink = gone === 1 ? "#ffe185" : "#ff9582";
    px(g, x - 4, y - 31, 9, 9, "#292131");
    if (gone === 1) {
      px(g, x - 2, y - 29, 5, 5, ink);
      px(g, x, y - 28, 1, 3, "#a2633c");
    } else {
      px(g, x, y - 29, 1, 3, ink);
      px(g, x, y - 25, 1, 1, ink);
    }
    return;
  }
  if (walking || row[7] > 0) return;
  px(g, x - 12, y - 42, 25, 20, "#252030");
  px(g, x - 11, y - 41, 23, 18, "#fff2d5");
  px(g, x - 1, y - 23, 3, 3, "#252030");
  const icon = forgeOrderSprite(kind, metal);
  if (icon) g.drawImage(icon, x - 8, y - 40);
  if (colors[metal]) px(g, x + 7, y - 39, 4, 3, colors[metal]);
  const patience = Math.max(0, Math.min(1, timeLeft(row[5]) / (row[6] * 100)));
  px(g, x - 10, y - 46, 20, 3, "#292131");
  px(g, x - 9, y - 45, Math.ceil(18 * patience), 1, patience > 0.5 ? "#92d573" : "#f29b63");
}
