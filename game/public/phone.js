/**
 * The smartphone menu (desktop "full" layout; 설정 → 화면 → 메뉴 방식 turns the old side panel back on).
 *
 * The permanent menu column is gone: a pocket button at the bottom right (or the `phone` key, keymap.js) pulls a phone out
 * beside the player. Its home screen is a grid of app icons — every window the menu used to list, each with its name under it —
 * and an app is simply that window docked into the phone's screen: windows.js moves `#panel` (the side panel's host of docked
 * windows) into `#ph-app`, so every `PANEL` window renders there with the machinery it already had. The round home button and
 * the ‹ in the title bar close the app; Esc closes the app, then the phone.
 *
 * Placement (`place`): the phone's left edge stands SAFE px right of the player's feet on screen (the camera keeps the player
 * in the middle), full height of the world viewport at most, so it never covers the character; if the right side is too narrow
 * it takes the left side, and only then shrinks (CSS zoom). Everything is drawn in code like frames.js: a 2 px art grid,
 * hard edges, the bezel in the HUD theme's colours (`hud-skin` event from frames.js redraws it), one dot texture.
 */
import { $, $$, el, G, VP, MENU_KEY, clamp, resize } from "./state.js";
import * as S3 from "./scene2d.js";
import * as Sky from "./sky.js";
import { Sound } from "./audio.js";
import { icon } from "./uiicons.js";
import { phoneHook, openWin, closeWin, panelWin, hoverTip, hideTip, keepAll } from "./windows.js";
import { K } from "./keymap.js";
import { act, channelName } from "./net.js";
import { openCharTab } from "./win_char.js";
import { openEmotes } from "./win_social.js";

const PW = 352, PH = 640, MINW = 300, SAFE = 90, MARGIN = 6;
const INK = "#0d0b12", CREAM = "#fff6dc";

/**
 * The apps, in home-screen order: [id, name under the icon (\n = a second line), game's own name, glyph (uiicons.js), tile colour,
 * what a tap does, key action, note]. `win` opens that window in the phone; `float` closes the phone and opens a window that
 * needs the room; `tab` is a tab of the 캐릭터 window; `act` closes the phone and does it.
 */
const APPS = [
  { id: "inv", name: "인벤토리", game: "가방", glyph: "bag", hue: "#c8873a", win: "inv", key: "inv", note: "가진 물건 · 장비를 입고 벗기 · 사용 · 판매" },
  { id: "char", name: "장비", game: "캐릭터", glyph: "person", hue: "#4a7fd0", win: "char", tab: "gear", key: "char", note: "입은 장비와 능력치 요약" },
  { id: "skill", name: "스킬", game: "무기 · 스킬", glyph: "book", hue: "#8a5ad0", win: "skill", key: "skill", note: "무기 숙련 · 스킬 · 전직의 길" },
  { id: "quest", name: "퀘스트", game: "의뢰", glyph: "scroll", hue: "#d6a82c", win: "quest", key: "quest", note: "받은 의뢰와 진행 상황" },
  { id: "party", name: "파티", game: "파티", glyph: "party", hue: "#4aa860", win: "party", key: "party", note: "함께 사냥할 파티 만들기 · 초대" },
  { id: "guild", name: "길드", game: "길드", glyph: "banner", hue: "#d0505a", win: "guild", key: "guild", note: "길드 만들기 · 가입 · 멤버" },
  { id: "daily", name: "일일\n퀘스트", game: "일일 의뢰", glyph: "cal", hue: "#2aa8a0", win: "daily", key: "daily", note: "오늘의 과제" },
  { id: "week", name: "주간\n수첩", game: "주간 수첩", glyph: "clock", hue: "#3a90c8", win: "week", key: "week", note: "이번 주 목표와 보상" },
  { id: "achieve", name: "업적", game: "업적 · 칭호", glyph: "trophy", hue: "#e09a30", win: "achieve", key: "achieve", note: "업적과 얻은 칭호" },
  { id: "collect", name: "몬스터\n도감", game: "몬스터 도감", glyph: "paw", hue: "#8aa83a", win: "collect", key: "collect", note: "만난 몬스터 기록" },
  { id: "dex", name: "아이템\n도감", game: "아이템도감", glyph: "codex", hue: "#5a62c8", win: "dex", key: "dex", note: "전설 · 유니크 접두사의 효과를 한눈에" },
  { id: "alba", name: "알바", game: "아르바이트", glyph: "crate", hue: "#d87a3a", win: "alba", key: "alba", note: "맡은 알바와 남은 시간" },
  { id: "life", name: "생활", game: "생활 기술", glyph: "life", hue: "#58b050", win: "life", key: "life", note: "낚시 · 채집 · 요리 같은 생활 기술" },
  { id: "charm", name: "참\n보드", game: "참 보드", glyph: "gem", hue: "#c85aa8", win: "charm", key: "charm", note: "참을 끼워 능력 높이기" },
  { id: "trophy", name: "전리품", game: "보스 전리품", glyph: "skull", hue: "#b8404a", win: "trophy", key: "trophy", note: "잡은 보스의 전리품" },
  { id: "rank", name: "랭킹", game: "모험가 랭킹", glyph: "crown", hue: "#e0b838", win: "rank", key: "rank", note: "서버 모험가 순위" },
  { id: "map", name: "지도", game: "지도", glyph: "map", hue: "#3aa878", win: "map", key: "map", kind: "float", note: "큰 지도 창 — 이동의 돌 · 추적" },
  { id: "cos", name: "의상", game: "외형 · 꾸미기", glyph: "shirt", hue: "#e070a0", win: "char", tab: "cos", key: "char", note: "캐릭터 창의 외형 탭 — 입을 수 있는 의상과 꾸미기" },
  { id: "stat", name: "능력치", game: "능력치", glyph: "fist", hue: "#6a8aa8", win: "char", tab: "stat", key: "char", note: "캐릭터 창의 능력치 탭 — 모닥불 곁에서 올립니다" },
  { id: "emo", name: "감정", game: "감정표현", glyph: "smile", hue: "#e8c840", key: "emote", kind: "act", run: () => openEmotes("emote"), note: "이모트 고르기" },
  { id: "sit", name: "앉기", game: "앉기 · 모닥불", glyph: "fire", hue: "#e86a3a", key: "sit", kind: "act", run: () => act({ t: "sit" }), note: "사냥터에서 앉으면 모닥불을 피웁니다" },
  { id: "help", name: "도움말", game: "도움말", glyph: "help", hue: "#4ab0e0", win: "help", key: "help", note: "게임 방법과 규칙" },
  { id: "settings", name: "설정", game: "설정", glyph: "gear", hue: "#8a8f9c", win: "settings", key: "settings", note: "화면 · 소리 · 조작 · 메뉴 방식" },
];
/** The four icons that stay in the dock row under the grid. */
const DOCK = ["inv", "char", "skill", "quest"];
const appOf = (a) => APPS.find((x) => x.id === a);
const plain = (name) => name.replace("\n", " ");

// ───────────────────────────── pixel painting ─────────────────────────────

/** A canvas of w×h art cells, `s` px each; fn(x, y) → a colour or null. */
function paint(w, h, fn, s = 2) {
  const c = document.createElement("canvas");
  c.width = w * s; c.height = h * s;
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const col = fn(x, y); if (col) { g.fillStyle = col; g.fillRect(x * s, y * s, s, s); } }
  return c;
}
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** `hex` toward `to` by t (0–1). */
function mix(hex, to, t) {
  const a = rgb(hex), b = rgb(to);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
/** A rounded rectangle test: is cell (x, y) inside a w×h box inset by k, corners cut with radius r−k? */
function inside(x, y, w, h, r, k) {
  const rr = Math.max(r - k, 0), cx = x + 0.5, cy = y + 0.5;
  if (cx < k || cx > w - k || cy < k || cy > h - k) return false;
  const dx = cx < k + rr ? k + rr - cx : cx > w - k - rr ? cx - (w - k - rr) : 0;
  const dy = cy < k + rr ? k + rr - cy : cy > h - k - rr ? cy - (h - k - rr) : 0;
  return dx * dx + dy * dy <= rr * rr;
}

/** One app's tile: 16×16 cells at 2 px (32 px), ink outline, a lit top-left and shaded bottom-right bevel, the glyph with a drop shadow. */
function tileCanvas(glyph, hue) {
  const hi = mix(hue, "#ffffff", 0.38), lo = mix(hue, "#000000", 0.38), sh = mix(hue, "#000000", 0.6);
  const base = paint(16, 16, (x, y) => {
    if (!inside(x, y, 16, 16, 3, 0)) return null;
    if (!inside(x, y, 16, 16, 3, 1)) return INK;
    if (y === 1 || x === 1) return hi;
    if (y === 14 || x === 14) return lo;
    return hue;
  });
  const g = base.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(icon(glyph, sh), 2 * 2 + 2, 2 * 2 + 2, 24, 24);   // the shadow, one cell down and right
  g.drawImage(icon(glyph, CREAM), 2 * 2, 2 * 2, 24, 24);
  return base;
}
/** The pocket button's little phone: 14×18 cells at 3 px, a 3×3 grid of app tiles on its screen. */
function pocketCanvas() {
  const apps = ["#e8584a", "#e8c840", "#58b050", "#4a7fd0", "#c85aa8", "#e09a30", "#2aa8a0", "#8a5ad0", "#d87a3a"];
  return paint(14, 18, (x, y) => {
    if (!inside(x, y, 14, 18, 3, 0)) return null;
    if (!inside(x, y, 14, 18, 3, 1)) return INK;
    if (x >= 2 && x <= 11 && y >= 3 && y <= 14) {
      const gx = x - 3, gy = y - 4;
      if (gx >= 0 && gy >= 0 && gx < 8 && gy < 8 && gx % 3 < 2 && gy % 3 < 2) return apps[Math.floor(gx / 3) + Math.floor(gy / 3) * 3];
      return x === 2 || y === 3 ? "#2b3d6e" : "#3f5a9c";
    }
    if (y === 2 && x >= 5 && x <= 8) return "#141018";
    if (y === 16 && x >= 6 && x <= 7) return "#9a8cb0";
    return x === 1 || y === 1 ? "#6a5a80" : "#3a3248";
  }, 3);
}
/** The ‹ of the app bar: 7×9 cells, two cells thick with an ink edge. */
function chevCanvas() {
  return paint(7, 9, (x, y) => { const d = Math.abs(y - 4); return x === d || x === d + 1 ? CREAM : x === d + 2 ? INK : null; });
}

/** What the bezel, the wallpaper and the little parts are drawn in: the HUD theme's colours (read from #hud, so a theme change repaints them). */
function buildSkin() {
  const box = $("#phone");
  if (!box) return;
  const cs = getComputedStyle($("#hud")), v = (n, d) => cs.getPropertyValue(n).trim() || d;
  const ink = v("--ink", INK), body = v("--sf3", "#2c2537"), dot = v("--sf4", "#3d3448"), lit = v("--sf5", "#5b4d6c"), dark = v("--sf1", "#17131d");
  const brass = v("--b-mid", "#cf9f55"), brassHi = v("--b-hi", "#f4dfa4"), brassLo = v("--b-lo", "#7c5326"), face = v("--sf2", "#1f1a28");
  // the bezel: 22×52 cells, 9 cells of side, 18 above the screen, 28 below; the middle 4 cells repeat. A 2-cell ink outline, a lit/shaded
  // edge, a dotted body, and a 1-cell ink edge around the screen opening (x 8…13, y 17…22).
  const W = 22, H = 50, R = 6;
  const bezel = paint(W, H, (x, y) => {
    if (!inside(x, y, W, H, R, 0)) return null;
    if (!inside(x, y, W, H, R, 2)) return ink;
    const edge = (x === 8 || x === 13) && y >= 17 && y <= 22 || (y === 17 || y === 22) && x >= 8 && x <= 13;
    if (edge) return ink;
    if (x > 8 && x < 13 && y > 17 && y < 22) return null;   // the screen opening
    if (!inside(x, y, W, H, R, 3)) return Math.min(x, y) <= Math.min(W - 1 - x, H - 1 - y) ? lit : dark;
    return x % 2 === 0 && y % 2 === 0 ? dot : body;
  });
  const home = paint(16, 16, (x, y) => {
    if (!inside(x, y, 16, 16, 8, 0)) return null;
    if (!inside(x, y, 16, 16, 8, 1)) return ink;
    if (!inside(x, y, 16, 16, 8, 2)) return Math.min(x, y) <= Math.min(15 - x, 15 - y) ? brassHi : brassLo;
    if (!inside(x, y, 16, 16, 8, 3)) return brass;
    if (x >= 5 && x <= 10 && y >= 5 && y <= 10) return (x === 5 || x === 10 || y === 5 || y === 10) ? brassHi : face;   // the little square
    return face;
  });
  const spk = paint(14, 3, (x, y) => (y === 2 ? (x > 0 && x < 13 ? lit : null) : (y === 0 && (x === 0 || x === 13)) ? null : ink));
  const cam = paint(6, 6, (x, y) => {
    if (!inside(x, y, 6, 6, 3, 0)) return null;
    if (!inside(x, y, 6, 6, 3, 1)) return ink;
    return (x === 2 && y === 2) ? "#6a8ad8" : "#1a2040";
  });
  // the home screen's wallpaper: a quiet two-tone dither, the same under every theme (the labels over it are cream with an ink outline)
  const wall = paint(8, 8, (x, y) => ((x + y) % 2 === 0 ? "#1e2545" : (x % 4 === 1 && y % 4 === 2) ? "#2d386a" : "#222a4d"));
  box.style.setProperty("--ph-bezel", `url(${bezel.toDataURL()})`);
  box.style.setProperty("--ph-home", `url(${home.toDataURL()})`);
  box.style.setProperty("--ph-spk", `url(${spk.toDataURL()})`);
  box.style.setProperty("--ph-cam", `url(${cam.toDataURL()})`);
  box.style.setProperty("--ph-wall", `url(${wall.toDataURL()})`);
  box.style.setProperty("--ph-chev", `url(${chevCanvas().toDataURL()})`);
}

// ───────────────────────────── the phone ─────────────────────────────

let out = false, edge = null, tapped = null, key = "";
const box = () => $("#phone");

/** Put the phone beside the player (see the header); the window zone (windows.js) reads `edge`. */
function place() {
  const b = box(), W = VP.w, H = VP.h;
  let cx = W / 2;
  if (G.me && Number.isFinite(G.me.x)) { const p = S3.project(G.me.x, G.me.y); if (Number.isFinite(p[0])) cx = clamp(p[0], 0, W); }
  const right = W - (cx + SAFE) - MARGIN, left = cx - SAFE - MARGIN;
  const onLeft = right < MINW && left > right, room = onLeft ? left : right;
  const w = Math.round(clamp(room, MINW, PW)), z = room >= MINW ? 1 : clamp(room / MINW, 0.6, 1);
  const pw = Math.round(w * z), ph = Math.round(Math.min(PH, H - 2 * MARGIN));
  const x = Math.round(clamp(onLeft ? cx - SAFE - pw : cx + SAFE, MARGIN, Math.max(MARGIN, W - pw - MARGIN)));
  const y = Math.round((H - ph) / 2);
  const k = [x, y, pw, ph, z].join();
  edge = [x, x + pw];
  if (k === key) return;
  key = k;
  b.style.left = x + "px"; b.style.top = y + "px"; b.style.width = pw + "px"; b.style.height = ph + "px";
  b.style.setProperty("--ph-bw", w + "px"); b.style.setProperty("--ph-bh", Math.round(ph / z) + "px"); b.style.setProperty("--ph-z", z);
}
function open() {
  if (out || !VP.phone) return;
  out = true; key = "";
  box().hidden = false;
  $("#phone-btn").classList.add("on");
  place();
  keepAll();
}
function close() {
  if (!out) return;
  if (VP.phone && panelWin()) closeWin(panelWin());
  out = false; edge = null;
  box().hidden = true;
  $("#phone-btn").classList.remove("on");
  hideTip();
  keepAll();
}
/** The phone key / the pocket button. */
export function toggle() {
  if (!VP.phone || !G.playing) return;
  if (out) { close(); Sound.play("close"); } else { open(); Sound.play("open"); }
}
export const isOut = () => out;

/** The app on the phone's screen changed (windows.js setPanel): the app, or null for the home screen. */
function showApp(id) {
  const app = id && (tapped && tapped.win === id ? tapped : APPS.find((a) => a.win === id));
  $("#ph-home").hidden = !!id;
  $("#ph-appbox").hidden = !id;
  if (!id) { tapped = null; return; }
  $("#ph-title").textContent = app ? plain(app.name) : id;
  $("#ph-alias").textContent = app && app.game.replace(/\s/g, "") !== app.name.replace(/\s/g, "") ? app.game : "";   // the game's own word when it differs (인벤토리 · 가방)
}
function launch(a) {
  Sound.play("ui");
  hideTip();
  if (a.kind === "act") { close(); a.run(); return; }
  if (a.kind === "float") { close(); openWin(a.win); return; }
  tapped = a;
  if (a.tab) openCharTab(a.tab); else openWin(a.win);
}
function home() {
  Sound.play("ui");
  if (panelWin()) closeWin(panelWin()); else $("#ph-grid").scrollTop = 0;
}

/** One icon: the tile, its name under it (always shown), the hotkey on hover. */
function appButton(a) {
  const b = el("button", "ph-ico");
  b.type = "button"; b.dataset.app = a.id;
  b.setAttribute("aria-label", plain(a.name));
  const im = el("img", "ph-ic"); im.alt = ""; im.src = tileCanvas(a.glyph, a.hue).toDataURL();
  b.append(im, el("span", "ph-lb", a.name));
  b.addEventListener("click", () => launch(a));
  hoverTip(b, (h) => {
    h.classList.add("mn-tip");
    h.append(el("div", "nm", `${plain(a.name)} (${K(a.key)})`));
    h.append(el("div", "hint", a.game.replace(/\s/g, "") !== a.name.replace(/\s/g, "") ? `${a.game} — ${a.note}` : a.note));
  }, true);
  return b;
}

let lastAt = 0;
/** Every frame while playing (client.js): follow the player, and twice a second the clock, the server line and the pocket button's dot. */
export function tick(t) {
  if (!VP.phone) return;
  if (out) place();
  if (t - lastAt < 500) return;
  lastAt = t;
  const h = Sky.hour(), sky = [Sky.clockText(h), Sky.weatherName(), Sky.seasonName(), Sky.fairOn() ? "장날" : ""].filter(Boolean).join(" · ");
  if ($("#ph-clock").textContent !== sky) $("#ph-clock").textContent = sky;
  const srv = channelName();
  if ($("#ph-srv").textContent !== srv) $("#ph-srv").textContent = srv;
  // the dot: a quest is ready to hand in (the tracker marks it .done)
  $("#phone-dot").hidden = !$("#quest-track .done");
}

export function setup() {
  buildSkin();
  addEventListener("hud-skin", buildSkin);
  const ic = $("#phone-ic"), pc = pocketCanvas();
  ic.width = pc.width; ic.height = pc.height;
  ic.getContext("2d").drawImage(pc, 0, 0);
  const grid = $("#ph-grid"), dock = $("#ph-dock");
  for (const a of APPS) if (!DOCK.includes(a.id)) grid.append(appButton(a));
  for (const id of DOCK) dock.append(appButton(appOf(id)));
  const btn = $("#phone-btn");
  btn.addEventListener("click", toggle);
  hoverTip(btn, (h) => { h.classList.add("mn-tip"); h.append(el("div", "nm", `스마트폰 (${K("phone")})`)); h.append(el("div", "hint", "메뉴 — 가방 · 스킬 · 퀘스트 같은 앱이 들어 있습니다")); }, true);
  $("#ph-back").addEventListener("click", home);
  $("#ph-hbtn").addEventListener("click", home);
  hoverTip($("#ph-hbtn"), (h) => { h.classList.add("mn-tip"); h.append(el("div", "nm", "홈")); h.append(el("div", "hint", "앱을 닫고 앱 목록으로")); }, true);
  Object.assign(phoneHook, { open, close, out: () => out, app: showApp, edge: () => edge });
  // 설정 → 화면 → 메뉴 방식: 스마트폰 / 기존 패널, remembered; the layout pass moves every window (windows.js dockPanel)
  const seg = $("#opt-menu");
  const mark = () => { for (const b of $$("#opt-menu button")) b.classList.toggle("on", b.dataset.m === (localStorage.getItem(MENU_KEY) === "panel" ? "panel" : "phone")); };
  mark();
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-m]");
    if (!b) return;
    try { localStorage.setItem(MENU_KEY, b.dataset.m); } catch { /* private mode: lasts until the page is left */ }
    mark(); Sound.play("ui");
    resize();
  });
}
