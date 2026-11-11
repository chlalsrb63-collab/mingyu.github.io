/**
 * 루멘테일 온라인 — the browser side.
 *
 * The server is authoritative: this file sends intents ({type:"action"}) and
 * draws the snapshots that come back ten times a second. The one thing it does
 * on its own is move your character immediately (the server checks every step
 * and corrects it if it disagrees), so walking never waits on the network.
 *
 * Tables (items, monsters, skills, quests) and maps all arrive from the server;
 * nothing about the rules is duplicated here.
 */

import * as Art from "./art.js";
import { Sound } from "./audio.js";

const T = Art.TILE;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; // textContent only — server strings are never markup
  return e;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const now = () => performance.now();

// ───────────────────────────── connection ─────────────────────────────

/** Played from anywhere else (e.g. a static mirror), the game still talks to its live server. */
const LIVE_HOST = "lumentale-online.higgsfield.app";
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const HOST = local || location.hostname.endsWith("higgsfield.app") ? location.host : LIVE_HOST;
const PROTO = location.protocol === "http:" && local ? "ws:" : "wss:";

/** Your claim to your character. Kept in this browser; never shown to other players. */
function playerId() {
  const key = "lumentale:pid";
  let id = localStorage.getItem(key);
  if (!id || id.length < 16) {
    const b = crypto.getRandomValues(new Uint8Array(18));
    id = [...b].map((v) => v.toString(36).padStart(2, "0")).join("").slice(0, 32);
    localStorage.setItem(key, id);
  }
  return id;
}

let ws = null;
let retry = 0;
let wantOnline = false;
let channel = new URLSearchParams(location.search).get("ch") || localStorage.getItem("lumentale:ch") || "ch1";
if (!/^ch[1-3]$/.test(channel)) channel = "ch1";

function connect() {
  wantOnline = true;
  ws = new WebSocket(`${PROTO}//${HOST}/ws/${channel}`);
  ws.addEventListener("open", () => {
    retry = 0;
    ws.send(JSON.stringify({ type: "join", playerId: playerId() }));
  });
  ws.addEventListener("message", (ev) => {
    if (ev.data === "__pong") return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    onMessage(msg);
  });
  ws.addEventListener("close", () => {
    if (!wantOnline) return;
    retry = Math.min(retry + 1, 6);
    const wait = 400 * 2 ** (retry - 1);
    if (G.playing) addChat("서버와의 연결이 끊겼습니다. 다시 연결하는 중…", "err");
    else $("#title-msg").textContent = "서버에 연결하는 중…";
    setTimeout(() => wantOnline && connect(), wait);
  });
}
function act(action) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
}
setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send("__ping"); }, 30000);

// ───────────────────────────── state ─────────────────────────────

const G = {
  playing: false, you: 0, defs: null, icons: null, self: null, map: null,
  me: { x: 0, y: 0, dir: 0, hp: 1, mp: 0, dead: false, walk: 0, moving: false, atkT: -1e9, hurtT: -1e9 },
  who: new Map(), players: new Map(), mobs: new Map(), drops: new Map(),
  fx: [], parts: [], texts: [], bubbles: new Map(), statics: [],
  cdEnd: [0, 0, 0], buffEnd: [0, 0], potAt: 0, lastAtk: 0, lastSkill: 0,
  auto: false, sel: -1, shake: 0, flash: 0, near: null,
};
const scenery = Art.buildScenery();
const mobArt = Art.buildMobs();
let ground = null, mini = null;
let scale = 3, vw = 320, vh = 200, dpr = 1;
const cam = { x: 0, y: 0 };

const world = $("#world"), wg = world.getContext("2d");
const text = $("#text"), tg = text.getContext("2d");

function resize() {
  const W = innerWidth, H = innerHeight;
  scale = Math.max(2, Math.round(Math.min(W / 340, H / 210)));
  vw = Math.ceil(W / scale); vh = Math.ceil(H / scale);
  world.width = vw; world.height = vh;
  world.style.width = vw * scale + "px"; world.style.height = vh * scale + "px";
  dpr = Math.min(2, window.devicePixelRatio || 1);
  text.width = Math.round(W * dpr); text.height = Math.round(H * dpr);
  text.style.width = W + "px"; text.style.height = H + "px";
  wg.imageSmoothingEnabled = false;
}
addEventListener("resize", resize);
resize();

// ───────────────────────────── messages ─────────────────────────────

function onMessage(msg) {
  switch (msg.type) {
    case "need_char":
      $("#title").hidden = true;
      $("#create").hidden = false;
      $("#c-name").focus();
      break;
    case "welcome":
      G.you = msg.you;
      if (!G.defs) {
        G.defs = msg.defs;
        G.icons = Art.buildIcons(G.defs.items);
      }
      G.players.clear(); G.mobs.clear(); G.drops.clear(); G.who.clear();
      $("#title").hidden = true; $("#create").hidden = true; $("#hud").hidden = false;
      if (!G.playing) {
        G.playing = true;
        addChat(`루멘테일 온라인에 오신 것을 환영합니다! (${channelName()})`, "sys");
        addChat("촌장 엘더윈에게 말을 걸어 첫 의뢰를 받아 보세요. [?] 버튼에 조작법이 있습니다.", "sys");
      }
      break;
    case "snap": onSnap(msg); break;
    case "rank": renderRank(msg.list); break;
    case "error":
      if (msg.fatal) {
        wantOnline = false;
        G.playing = false;
        try { ws.close(); } catch { /* already closed */ }
        $("#hud").hidden = true; $("#create").hidden = true; $("#title").hidden = false;
        $("#title-msg").textContent = msg.error;
      } else if (!$("#create").hidden) {
        $("#create-msg").textContent = msg.error;
      } else {
        toast(msg.error);
        Sound.play("no");
      }
      break;
  }
}
const channelName = () => `채널 ${channel.slice(2)}`;

function loadMap(m) {
  G.map = m;
  ground = Art.renderGround(m);
  mini = Art.renderMini(m);
  const cv = $("#mini-cv");
  cv.width = mini.width; cv.height = mini.height;
  G.statics = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.o[y][x];
    let sp = scenery[ch];
    if (!sp || Array.isArray(sp)) continue;
    if (ch === "K" && Art.hash(x, y, 7) > 0.6) sp = scenery.K2;
    G.statics.push({ sp, x: x * T + 8, y: y * T + 15, glow: ch === "K" ? (sp === scenery.K2 ? "#c08af0" : "#6ae0f0") : ch === "L" ? "#ffe890" : null });
  }
  for (const b of m.big) {
    if (b.t === "house") G.statics.push({ sp: scenery.house[b.v % 4], x: b.x * T + 32, y: (b.y + 3) * T - 2 });
    else if (b.t === "fountain") G.statics.push({ anim: scenery.fountain, x: b.x * T + 16, y: (b.y + 2) * T - 1 });
  }
  for (const n of m.npcs) n.sprite = Art.charSprite(Art.npcLook(n.look, n.role));
  G.players.clear(); G.mobs.clear(); G.drops.clear();
  G.fx.length = 0; G.parts.length = 0;
  $("#mini-name").textContent = m.name;
  Sound.bgm(m.bgm);
  banner(m.name, true);
  closeWin("shop"); closeWin("smith"); closeWin("talk");
}

function onSnap(s) {
  const t = now();
  const me = G.me;
  if (s.map) loadMap(s.map);
  if (s.map || s.me[5]) { me.x = s.me[0]; me.y = s.me[1]; me.dir = s.me[6]; }
  me.hp = s.me[2]; me.mp = s.me[3];
  const dead = !!s.me[4];
  if (dead !== me.dead) { me.dead = dead; $("#dead").hidden = !dead; if (dead) { G.auto = false; Sound.play("die"); } }

  if (s.who) {
    G.who.clear();
    for (const [eid, name, cls, lvl, look, tier] of s.who) {
      G.who.set(eid, { name, cls, lvl, sprite: Art.charSprite(Art.playerLook(cls, look, tier)), look, tier });
    }
  }
  sync(G.players, s.P, (e, r) => { e.tx = r[1]; e.ty = r[2]; e.dir = r[3]; e.dead = !!r[4]; e.hp = r[5]; e.mhp = r[6]; }, t);
  sync(G.mobs, s.M, (e, r) => { e.k = r[1]; e.tx = r[2]; e.ty = r[3]; e.dir = r[4]; e.hp = r[5]; }, t, 0);
  sync(G.drops, s.D, (e, r) => { e.it = r[1]; e.tx = r[2]; e.ty = r[3]; }, t);

  if (s.self) {
    G.self = s.self;
    for (let i = 0; i < 3; i++) G.cdEnd[i] = t + s.self.cds[i];
    G.buffEnd = s.self.buffs.map((ms) => t + ms);
    refreshUi();
  }
  if (s.ev) for (const e of s.ev) onEvent(e, t);
  if (s.chat) for (const c of s.chat) c.sys ? addChat(c.m, "sys") : addChat(c.m, "", c.n);
  if (s.gain) for (const gn of s.gain) onGain(gn);
  if (s.toast) for (const m of s.toast) toast(m);
  hudBars();
}

/** Bring a Map of entities in line with a snapshot list (first field is the id). */
function sync(map, rows, apply, t) {
  const seen = new Set();
  for (const r of rows) {
    seen.add(r[0]);
    let e = map.get(r[0]);
    const fresh = !e;
    if (!e) { e = { id: r[0], x: 0, y: 0, walk: 0, atkT: -1e9, hurtT: -1e9, born: t }; map.set(r[0], e); }
    apply(e, r);
    if (fresh) { e.x = e.tx; e.y = e.ty; }
  }
  for (const id of map.keys()) if (!seen.has(id)) map.delete(id);
}

function entityPos(id) {
  if (id === G.you) return G.me;
  return G.players.get(id) || G.mobs.get(id) || null;
}

const MOB_COL = { slime: "#74d85e", bslime: "#62b8f4", shroom: "#dc4c40", boar: "#a06e46", bat: "#74529a", skel: "#ecebf2", golem: "#6ae0f0", boss: "#ff6ad0" };

function onEvent(e, t) {
  switch (e[0]) {
    case "a": {
      const [, eid, kind, tx, ty] = e;
      const src = entityPos(eid);
      if (!src) break;
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; }
      else G.me.dir = e[5];
      attackFx(kind, src.x, src.y - 8, tx, ty, e[5]);
      break;
    }
    case "h": {
      const [, id, dmg, crit, isPlayer] = e;
      const tgt = entityPos(id);
      if (!tgt) break;
      const big = isPlayer ? 0 : G.defs.mobs[tgt.k]?.boss ? 22 : 0;
      if (dmg < 0) floatText(`+${-dmg}`, tgt.x, tgt.y - 22, "#8cff8c");
      else {
        floatText(crit ? `${dmg}!` : String(dmg), tgt.x + (Math.random() * 10 - 5), tgt.y - 20 - big, isPlayer ? "#ff7a7a" : crit ? "#ffd84a" : "#ffffff", crit);
        tgt.hurtT = t;
        if (id === G.you) { G.flash = 1; G.shake = Math.max(G.shake, 3); Sound.play("hurt"); }
        else if (!isPlayer) Sound.play(crit ? "crit" : "hit");
        burst(tgt.x, tgt.y - 8 - big / 2, isPlayer ? "#ff7a7a" : "#ffffff", 4, 40);
      }
      break;
    }
    case "k": {
      const m = G.mobs.get(e[1]);
      if (m) { burst(m.x, m.y - 6, MOB_COL[m.k] || "#fff", G.defs.mobs[m.k]?.boss ? 60 : 12, 70); Sound.play("die"); G.mobs.delete(e[1]); }
      break;
    }
    case "m": { const m = G.mobs.get(e[1]); if (m) m.atkT = t; break; }
    case "t": G.fx.push({ type: "tele", x: e[1], y: e[2], r: e[3], t0: t, dur: e[4] }); Sound.play("warn"); break;
    case "b":
      G.fx.push({ type: "ring", x: e[1], y: e[2], r: e[3], t0: t, dur: 350, col: "#ff6ad0", fill: true });
      burst(e[1], e[2], "#ff6ad0", 30, 110);
      G.shake = 6; Sound.play("boom");
      break;
    case "l": {
      const p = entityPos(e[1]);
      if (p) { G.fx.push({ type: "pillar", x: p.x, y: p.y, t0: t, dur: 900, ent: p }); if (e[1] !== G.you) floatText("LEVEL UP", p.x, p.y - 30, "#ffd84a", true); }
      break;
    }
    case "pd": { const p = entityPos(e[1]); if (p) burst(p.x, p.y - 8, "#c8c8d8", 10, 40); break; }
    case "s": G.bubbles.set(e[1], { text: e[2], until: t + 4500 }); break;
    case "u": { const p = entityPos(e[1]); if (p) sparkle(p.x, p.y - 10, e[2] ? "#7ab4ff" : "#ff8a8a", 8); if (e[1] === G.you) Sound.play("potion"); break; }
    case "e": {
      const p = entityPos(e[1]);
      if (p) { sparkle(p.x, p.y - 10, e[2] ? "#ffd84a" : "#8a8a9a", e[2] ? 26 : 10); if (e[2]) G.fx.push({ type: "ring", x: p.x, y: p.y - 8, r: 26, t0: t, dur: 400, col: "#ffd84a" }); }
      if (e[1] === G.you) Sound.play(e[2] ? "ok" : "fail");
      break;
    }
  }
}

function onGain([kind, a, b]) {
  const me = G.me;
  if (kind === "xp") floatText(`+${a} EXP`, me.x, me.y - 30, "#fff08a");
  else if (kind === "gold") { addChat(`골드 +${a}`, "loot"); Sound.play("coin"); }
  else if (kind === "item") { addChat(`획득: ${G.defs.items[a].name}${b > 1 ? ` ×${b}` : ""}`, "loot"); Sound.play("item"); }
  else if (kind === "lvl") { banner("LEVEL UP!"); floatText(`Lv.${a}`, me.x, me.y - 40, "#ffd84a", true); Sound.play("level"); addChat(`레벨 ${a}이(가) 되었습니다!`, "sys"); }
}

// ───────────────────────────── effects ─────────────────────────────

function burst(x, y, col, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.25 + Math.random() * 0.3, col, g: 160 });
  }
}
function sparkle(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    G.parts.push({ x: x + Math.random() * 16 - 8, y: y + Math.random() * 12 - 4, vx: 0, vy: -18 - Math.random() * 24, life: 0.4 + Math.random() * 0.5, col, g: 0 });
  }
}
function floatText(str, x, y, col, big) {
  G.texts.push({ str, x, y, col, big: !!big, t0: now() });
}
function attackFx(kind, x, y, tx, ty, dir) {
  const t = now();
  const proj = (col, speed, size, then) => G.fx.push({ type: "proj", x, y, x2: tx, y2: ty, t0: t, dur: Math.max(60, (dist(x, y, tx, ty) / speed) * 1000), col, size, then });
  switch (kind) {
    case 0: G.fx.push({ type: "slash", x: tx, y: ty, dir, t0: t, dur: 160, col: "#ffffff", r: 11 }); Sound.play("swing"); break;
    case 1: proj("#f0e0a0", 420, 1); Sound.play("shoot"); break;
    case 2: proj("#b08aff", 300, 2); Sound.play("magic"); break;
    case 10: G.fx.push({ type: "slash", x: tx, y: ty, dir, t0: t, dur: 220, col: "#ffd84a", r: 17 }); G.shake = Math.max(G.shake, 2); Sound.play("crit"); break;
    case 11: G.fx.push({ type: "ring", x, y: y + 4, r: 46, t0: t, dur: 260, col: "#ffffff" }); G.fx.push({ type: "ring", x, y: y + 4, r: 34, t0: t + 60, dur: 240, col: "#ffd84a" }); Sound.play("swing"); break;
    case 12: G.fx.push({ type: "ring", x, y: y + 4, r: 30, t0: t, dur: 500, col: "#ff7a5a" }); sparkle(x, y, "#ff7a5a", 14); Sound.play("buff"); break;
    case 13: G.fx.push({ type: "beam", x, y, x2: tx, y2: ty, t0: t, dur: 260, col: "#9fe8ff" }); Sound.play("shoot"); break;
    case 14: sparkle(x, y + 6, "#b8ffd0", 16); G.fx.push({ type: "ring", x, y: y + 6, r: 22, t0: t, dur: 400, col: "#b8ffd0" }); Sound.play("buff"); break;
    case 15: proj("#ff8a3a", 260, 3, () => { G.fx.push({ type: "ring", x: tx, y: ty, r: 34, t0: now(), dur: 300, col: "#ff8a3a", fill: true }); burst(tx, ty, "#ffd84a", 18, 90); G.shake = Math.max(G.shake, 3); Sound.play("boom"); }); Sound.play("magic"); break;
    case 16: G.fx.push({ type: "ring", x, y: y + 4, r: 58, t0: t, dur: 420, col: "#9fe8ff", fill: true }); sparkle(x, y, "#d0f4ff", 20); Sound.play("ice"); break;
    case 17: G.fx.push({ type: "ring", x, y: y + 4, r: 72, t0: t, dur: 500, col: "#8cff8c" }); sparkle(x, y, "#8cff8c", 20); Sound.play("heal"); break;
  }
}

// ───────────────────────────── input ─────────────────────────────

const keys = new Set();
const held = { atk: false };
const joy = { on: false, x: 0, y: 0, id: null };
const typing = () => document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

addEventListener("keydown", (e) => {
  Sound.unlock();
  if (!G.playing) return;
  if (typing()) { if (e.key === "Escape") document.activeElement.blur(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  switch (k) {
    case "1": case "2": case "3": castSkill(Number(k) - 1); break;
    case "q": case "ㅂ": usePotion("hp"); break;
    case "e": case "ㄷ": usePotion("mp"); break;
    case "f": case "ㄹ": interact(); break;
    case "i": case "ㅑ": toggleWin("inv"); break;
    case "c": case "ㅊ": toggleWin("char"); break;
    case "l": case "ㅣ": toggleWin("quest"); break;
    case "r": case "ㄱ": toggleAuto(); break;
    case "m": case "ㅡ": toggleSound(); break;
    case "Enter": e.preventDefault(); $("#chat-in").focus(); break;
    case "Escape": closeAll(); break;
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => { keys.clear(); held.atk = false; });

function moveVector() {
  let x = 0, y = 0;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("ㅁ")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("ㅇ")) x += 1;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("ㅈ")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("ㄴ")) y += 1;
  if (joy.on) { x = joy.x; y = joy.y; }
  const l = Math.hypot(x, y);
  return l > 0.2 ? [x / l, y / l] : [0, 0];
}

// virtual joystick + touch buttons
const joyEl = $("#joy"), knob = $("#joy-knob");
function joyMove(t) {
  const r = joyEl.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy), max = r.width / 2;
  if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
  joy.x = dx / max; joy.y = dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
joyEl.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.changedTouches[0]; joy.on = true; joy.id = t.identifier; joyMove(t); }, { passive: false });
joyEl.addEventListener("touchmove", (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === joy.id) joyMove(t); }, { passive: false });
const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ""; } };
joyEl.addEventListener("touchend", joyEnd); joyEl.addEventListener("touchcancel", joyEnd);
addEventListener("touchstart", () => { document.body.classList.add("touch"); Sound.unlock(); }, { once: true, passive: true });
addEventListener("pointerdown", () => Sound.unlock(), { once: true });

function press(btn, down, up) {
  const d = (e) => { e.preventDefault(); btn.classList.add("down"); down(); };
  const u = () => { btn.classList.remove("down"); up && up(); };
  btn.addEventListener("pointerdown", d);
  btn.addEventListener("pointerup", u); btn.addEventListener("pointerleave", u); btn.addEventListener("pointercancel", u);
}
press($("#b-atk"), () => { held.atk = true; }, () => { held.atk = false; });
for (let i = 0; i < 3; i++) press($(`#b-s${i}`), () => castSkill(i));
press($("#b-hp"), () => usePotion("hp"));
press($("#b-mp"), () => usePotion("mp"));
press($("#b-auto"), () => toggleAuto());
$("#prompt").addEventListener("click", () => interact());
$("#b-respawn").addEventListener("click", () => act({ t: "respawn" }));
$("#btn-sound").addEventListener("click", toggleSound);

function toggleSound() {
  const on = !(Sound.sfxOn && Sound.bgmOn);
  Sound.sfxOn = Sound.bgmOn = on;
  if (Sound.music) Sound.music.gain.value = on ? 0.32 : 0;
  $("#btn-sound").classList.toggle("off", !on);
}
function toggleAuto() {
  G.auto = !G.auto;
  $("#b-auto").classList.toggle("on", G.auto);
  toast(G.auto ? "자동사냥 시작" : "자동사냥 종료");
  Sound.play("ui");
}

// ───────────────────────────── player actions ─────────────────────────────

function solid(px, py) {
  const m = G.map;
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  return m.o[ty][tx] !== " " || "wW".includes(m.g[ty][tx]);
}
const canStand = (x, y) => !(solid(x - 4, y - 5) || solid(x + 4, y - 5) || solid(x - 4, y) || solid(x + 4, y));

function castSkill(i) {
  const s = G.self;
  if (!s || G.me.dead) return;
  const sk = G.defs.skills[s.cls][i];
  const t = now();
  if (s.lvl < sk.lv) { toast(`[${sk.name}] 레벨 ${sk.lv}에 배웁니다`); return false; }
  if (t < G.cdEnd[i] || G.me.mp < sk.mp) { if (G.me.mp < sk.mp && !G.auto) toast("MP가 부족합니다"); return false; }
  act({ t: "sk", i });
  G.cdEnd[i] = t + sk.cd;
  G.me.atkT = t; G.lastAtk = t; G.lastSkill = t;
  return true;
}
function countItem(id) {
  let n = 0;
  if (G.self) for (const s of G.self.inv) if (s.id === id) n += s.n || 1;
  return n;
}
function usePotion(kind) {
  const s = G.self, t = now();
  if (!s || G.me.dead || t < G.potAt) return;
  const [small, big] = kind === "hp" ? ["hp_s", "hp_m"] : ["mp_s", "mp_m"];
  const missing = kind === "hp" ? s.mhp - G.me.hp : s.mmp - G.me.mp;
  if (missing <= 0) return;
  const need = kind === "hp" ? G.defs.items[small].heal : G.defs.items[small].mana;
  let id = countItem(small) ? small : countItem(big) ? big : null;
  if (id === small && missing > need * 1.8 && countItem(big)) id = big;
  if (!id) { if (!G.auto) toast(kind === "hp" ? "HP 물약이 없습니다" : "MP 물약이 없습니다"); return; }
  act({ t: "use", id });
  G.potAt = t + 950;
}
function attack() {
  const t = now();
  const cd = G.defs.classes[G.self.cls].cd;
  if (t - G.lastAtk < cd) return;
  G.lastAtk = t; G.me.atkT = t;
  act({ t: "atk" });
}

function nearestNpc() {
  let best = null, bd = 40;
  for (const n of G.map.npcs) {
    const d = dist(G.me.x, G.me.y, n.x * T + 8, n.y * T + 12);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function interact() {
  const n = G.near;
  if (!n || G.me.dead) return;
  Sound.play("ui");
  if (n.role === "shop") { openWin("shop"); openWin("inv"); }
  else if (n.role === "smith") openWin("smith");
  else if (n.role === "elder") openWin("quest");
  else { $("#talk-name").textContent = n.name; $("#talk-text").textContent = n.say || "…"; openWin("talk"); }
}

// ───────────────────────────── update ─────────────────────────────

let lastSend = 0, sent = { x: 0, y: 0, d: 0 };
const autoSt = { stuck: 0, side: 0, sign: 1, lastSkill: 0 };

function update(dt, t) {
  const me = G.me, s = G.self;
  if (!G.map || !s) return;
  let [mx, my] = me.dead ? [0, 0] : moveVector();
  let wantAtk = !me.dead && !typing() && (keys.has(" ") || keys.has("j") || held.atk);

  // auto-hunt: walk at the nearest monster, hit it, drink when low
  if (G.auto && !me.dead && mx === 0 && my === 0 && !G.map.safe) {
    let best = null, bd = 1e9;
    for (const m of G.mobs.values()) { const d = dist(me.x, me.y, m.x, m.y); if (d < bd) { bd = d; best = m; } }
    if (best) {
      const range = G.defs.classes[s.cls].range * 0.8;
      if (bd > range) {
        const ux = (best.x - me.x) / bd, uy = (best.y - me.y) / bd;
        if (autoSt.side > 0) { mx = -uy * autoSt.sign; my = ux * autoSt.sign; autoSt.side -= dt; }
        else { mx = ux; my = uy; }
      } else {
        wantAtk = true;
        if (t - autoSt.lastSkill > 500) {
          for (let i = 0; i < 3; i++) {
            const sk = G.defs.skills[s.cls][i];
            if (s.lvl >= sk.lv && t >= G.cdEnd[i] && me.mp >= sk.mp + 4) { if (castSkill(i)) { autoSt.lastSkill = t; break; } }
          }
        }
      }
    }
    if (me.hp < s.mhp * 0.45) usePotion("hp");
    if (me.mp < s.mmp * 0.25) usePotion("mp");
  }

  // walk — applied immediately, checked by the server afterwards
  const speed = s.spd * (t < G.buffEnd[1] ? 1.4 : 1);
  const ox = me.x, oy = me.y;
  if (mx || my) {
    const nx = me.x + mx * speed * dt, ny = me.y + my * speed * dt;
    if (canStand(nx, me.y)) me.x = nx;
    if (canStand(me.x, ny)) me.y = ny;
    if (t - me.atkT > 250) me.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : my < 0 ? 3 : 0;
  }
  const moved = dist(ox, oy, me.x, me.y);
  me.moving = moved > 0.01;
  if (me.moving) me.walk += dt * 9;
  if (G.auto && (mx || my)) {
    if (moved < speed * dt * 0.3) { autoSt.stuck += dt; if (autoSt.stuck > 0.2) { autoSt.side = 0.5 + Math.random() * 0.4; autoSt.sign = Math.random() < 0.5 ? -1 : 1; autoSt.stuck = 0; } }
    else autoSt.stuck = 0;
  }
  if (t - lastSend > 90 && (Math.abs(me.x - sent.x) > 0.3 || Math.abs(me.y - sent.y) > 0.3 || me.dir !== sent.d)) {
    lastSend = t;
    sent = { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, d: me.dir };
    act({ t: "mv", x: sent.x, y: sent.y, d: sent.d });
  }
  if (wantAtk) attack();

  // everyone else eases toward their latest server position
  const k = Math.min(1, dt * 14);
  for (const map of [G.players, G.mobs, G.drops]) {
    for (const e of map.values()) {
      const d = dist(e.x, e.y, e.tx, e.ty);
      e.moving = d > 0.7;
      if (d > 60) { e.x = e.tx; e.y = e.ty; } else { e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; }
      if (e.moving) e.walk += dt * 9;
    }
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt;
    if (p.life <= 0) { G.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
  }
  G.shake = Math.max(0, G.shake - dt * 18);
  G.flash = Math.max(0, G.flash - dt * 4);

  const near = me.dead ? null : nearestNpc();
  if (near !== G.near) {
    G.near = near;
    const p = $("#prompt");
    p.hidden = !near;
    if (near) { p.textContent = ""; p.append(el("b", "", document.body.classList.contains("touch") ? "▶ " : "F  "), near.name); }
    else { closeWin("shop"); closeWin("smith"); closeWin("talk"); }
  }
}

// ───────────────────────────── render ─────────────────────────────

function shadow(x, y, w) {
  wg.fillStyle = "rgba(10, 14, 30, .28)";
  wg.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2);
  wg.fillRect(Math.round(x - w / 2) + 1, Math.round(y - 2), w - 2, 4);
}
function drawChar(sprite, x, y, dir, walkT, moving, atkT, t, alpha = 1) {
  const frame = moving ? 1 + (Math.floor(walkT) % 2) : 0;
  let ox = 0, oy = 0;
  const a = t - atkT;
  if (a < 160) { const k = Math.sin((a / 160) * Math.PI) * 3; ox = [0, -1, 1, 0][dir] * k; oy = [1, 0, 0, -1][dir] * k; }
  shadow(x, y + 1, 10);
  if (alpha !== 1) wg.globalAlpha = alpha;
  wg.drawImage(sprite[dir][frame], Math.round(x - 8 + ox), Math.round(y - 21 + oy));
  wg.globalAlpha = 1;
}

function render(t) {
  const m = G.map, me = G.me;
  if (!m || !ground) return;
  const mw = m.w * T, mh = m.h * T;
  cam.x = mw > vw ? clamp(Math.round(me.x - vw / 2), 0, mw - vw) : Math.round((mw - vw) / 2);
  cam.y = mh > vh ? clamp(Math.round(me.y - 8 - vh / 2), 0, mh - vh) : Math.round((mh - vh) / 2);
  if (G.shake > 0.3) { cam.x += Math.round((Math.random() - 0.5) * G.shake); cam.y += Math.round((Math.random() - 0.5) * G.shake); }

  wg.fillStyle = "#0d1020";
  wg.fillRect(0, 0, vw, vh);
  wg.save();
  wg.translate(-cam.x, -cam.y);
  wg.drawImage(ground[Math.floor(t / 500) % 2], 0, 0);

  // ground decals
  for (const p of m.portals) {
    const px = p.x * T + 8, py = p.y * T + 9;
    for (let i = 0; i < 3; i++) {
      const ph = (t / 600 + i / 3) % 1;
      wg.strokeStyle = `rgba(${i % 2 ? "160,220,255" : "200,150,255"},${1 - ph})`;
      wg.beginPath(); wg.ellipse(px, py, 3 + ph * 7, 2 + ph * 4, 0, 0, Math.PI * 2); wg.stroke();
    }
    if (Math.random() < 0.15) G.parts.push({ x: px + Math.random() * 12 - 6, y: py, vx: 0, vy: -22, life: 0.6, col: "#d0b0ff", g: 0 });
  }
  for (const f of G.fx) {
    if (f.type !== "tele") continue;
    const k = clamp((t - f.t0) / f.dur, 0, 1);
    wg.fillStyle = `rgba(255,60,120,${0.15 + 0.2 * Math.abs(Math.sin(t / 70))})`;
    wg.beginPath(); wg.ellipse(f.x, f.y, f.r, f.r * 0.8, 0, 0, Math.PI * 2); wg.fill();
    wg.strokeStyle = "#ff6ad0";
    wg.beginPath(); wg.ellipse(f.x, f.y, f.r * k, f.r * 0.8 * k, 0, 0, Math.PI * 2); wg.stroke();
  }

  // everything that stands up, sorted by its feet
  const list = [];
  const x0 = cam.x - 40, x1 = cam.x + vw + 40, y0 = cam.y - 10, y1 = cam.y + vh + 70;
  for (const s of G.statics) if (s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1) list.push({ y: s.y, s });
  for (const n of m.npcs) list.push({ y: n.y * T + 12, n });
  for (const d of G.drops.values()) list.push({ y: d.y - 2, d });
  for (const mob of G.mobs.values()) list.push({ y: mob.y, mob });
  for (const [eid, p] of G.players) list.push({ y: p.y, p, eid });
  list.push({ y: me.y, me: true });
  list.sort((a, b) => a.y - b.y);

  for (const o of list) {
    if (o.s) {
      const sp = o.s.anim ? o.s.anim[Math.floor(t / 300) % 2] : o.s.sp;
      if (o.s.glow) {
        wg.globalAlpha = 0.14 + 0.06 * Math.sin(t / 400 + o.s.x);
        wg.fillStyle = o.s.glow;
        wg.beginPath(); wg.arc(o.s.x, o.s.y - sp.height * (o.s.glow === "#ffe890" ? 0.85 : 0.6), 13, 0, Math.PI * 2); wg.fill();
        wg.globalAlpha = 1;
      }
      wg.drawImage(sp, Math.round(o.s.x - sp.width / 2), Math.round(o.s.y - sp.height));
    } else if (o.n) {
      drawChar(o.n.sprite, o.n.x * T + 8, o.n.y * T + 12, 0, 0, false, -1e9, t);
    } else if (o.d) {
      const ic = G.icons.cv[o.d.it];
      const bob = Math.round(Math.sin(t / 220 + o.d.id) * 1.5);
      shadow(o.d.x, o.d.y, 8);
      if (ic) wg.drawImage(ic, Math.round(o.d.x - 6), Math.round(o.d.y - 13 + bob), 12, 12);
    } else if (o.mob) {
      const mob = o.mob;
      const art = mobArt[G.defs.mobs[mob.k].sp];
      if (!art) continue;
      const f = Math.floor(t / 320 + mob.id) % 2;
      const hurt = t - mob.hurtT < 110;
      const right = mob.dir === 2;
      const img = (hurt ? (right ? art.hurtR : art.hurt) : right ? art.right : art.frames)[f];
      let ox = 0;
      const a = t - mob.atkT;
      if (a < 200) ox = Math.sin((a / 200) * Math.PI) * 5 * (right ? 1 : -1);
      const fade = clamp((t - mob.born) / 300, 0, 1);
      shadow(mob.x, mob.y + 1, Math.min(22, img.width - 4));
      wg.globalAlpha = fade;
      wg.drawImage(img, Math.round(mob.x - img.width / 2 + ox), Math.round(mob.y - img.height + 2 - art.lift));
      wg.globalAlpha = 1;
      const max = G.defs.mobs[mob.k].hp;
      if (mob.hp < max) {
        const w = G.defs.mobs[mob.k].boss ? 40 : 16;
        const bx = Math.round(mob.x - w / 2), by = Math.round(mob.y - img.height - 3 - art.lift);
        wg.fillStyle = "#12142a"; wg.fillRect(bx - 1, by - 1, w + 2, 4);
        wg.fillStyle = "#e8404c"; wg.fillRect(bx, by, Math.max(1, Math.round((w * mob.hp) / max)), 2);
      }
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (w) drawChar(w.sprite, o.p.x, o.p.y, o.p.dir, o.p.walk, o.p.moving, o.p.atkT, t, o.p.dead ? 0.4 : 1);
    } else if (o.me) {
      const w = G.who.get(G.you);
      if (w) drawChar(w.sprite, me.x, me.y, me.dir, me.walk, me.moving, me.atkT, t, me.dead ? 0.4 : t - me.hurtT < 110 ? 0.6 : 1);
    }
  }

  // effects above everything
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    const k = (t - f.t0) / f.dur;
    if (k < 0) continue;
    if (k >= 1) { G.fx.splice(i, 1); if (f.then) f.then(); continue; }
    if (f.type === "slash") {
      const base = [Math.PI / 2, Math.PI, 0, -Math.PI / 2][f.dir] ?? 0;
      wg.strokeStyle = f.col; wg.lineWidth = 2; wg.globalAlpha = 1 - k;
      wg.beginPath(); wg.arc(f.x - Math.cos(base) * 6, f.y - Math.sin(base) * 6, f.r, base - 1.1 + k * 1.4, base - 0.3 + k * 1.4); wg.stroke();
      wg.lineWidth = 1; wg.globalAlpha = 1;
    } else if (f.type === "proj") {
      const x = f.x + (f.x2 - f.x) * k, y = f.y + (f.y2 - f.y) * k;
      const d = dist(f.x, f.y, f.x2, f.y2) || 1, ux = (f.x2 - f.x) / d, uy = (f.y2 - f.y) / d;
      wg.strokeStyle = f.col; wg.lineWidth = f.size;
      wg.beginPath(); wg.moveTo(x - ux * 6, y - uy * 6); wg.lineTo(x, y); wg.stroke();
      wg.lineWidth = 1;
      wg.fillStyle = "#ffffff"; wg.fillRect(Math.round(x) - 1, Math.round(y) - 1, f.size + 1, f.size + 1);
      if (f.size > 1 && Math.random() < 0.7) G.parts.push({ x, y, vx: 0, vy: 0, life: 0.2, col: f.col, g: 0 });
    } else if (f.type === "ring") {
      wg.globalAlpha = 1 - k;
      if (f.fill) { wg.fillStyle = f.col; wg.globalAlpha = (1 - k) * 0.35; wg.beginPath(); wg.ellipse(f.x, f.y, f.r * k, f.r * k * 0.8, 0, 0, Math.PI * 2); wg.fill(); wg.globalAlpha = 1 - k; }
      wg.strokeStyle = f.col; wg.lineWidth = 2;
      wg.beginPath(); wg.ellipse(f.x, f.y, f.r * k, f.r * k * 0.8, 0, 0, Math.PI * 2); wg.stroke();
      wg.lineWidth = 1; wg.globalAlpha = 1;
    } else if (f.type === "beam") {
      wg.globalAlpha = 1 - k; wg.strokeStyle = f.col; wg.lineWidth = 3;
      wg.beginPath(); wg.moveTo(f.x, f.y); wg.lineTo(f.x2, f.y2); wg.stroke();
      wg.strokeStyle = "#ffffff"; wg.lineWidth = 1;
      wg.beginPath(); wg.moveTo(f.x, f.y); wg.lineTo(f.x2, f.y2); wg.stroke();
      wg.globalAlpha = 1;
    } else if (f.type === "pillar") {
      const x = f.ent.x, y = f.ent.y;
      wg.globalAlpha = (1 - k) * 0.55; wg.fillStyle = "#fff08a";
      wg.fillRect(Math.round(x - 7), Math.round(y - 60), 14, 62);
      wg.fillStyle = "#ffffff"; wg.fillRect(Math.round(x - 3), Math.round(y - 60), 6, 62);
      wg.globalAlpha = 1;
      if (Math.random() < 0.6) sparkle(x, y - 10, "#ffd84a", 1);
    }
  }
  for (const p of G.parts) {
    wg.globalAlpha = clamp(p.life * 3, 0, 1);
    wg.fillStyle = p.col;
    wg.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  wg.globalAlpha = 1;
  wg.restore();
  if (G.flash > 0) { wg.fillStyle = `rgba(255,40,60,${G.flash * 0.3})`; wg.fillRect(0, 0, vw, vh); }

  renderText(t, list);
}

// crisp text on its own full-resolution canvas, positioned in world space
let fontK = 1;
function label(str, wx, wy, col, size = 11, bg = false) {
  const S = scale * dpr;
  const x = Math.round((wx - cam.x) * S), y = Math.round((wy - cam.y) * S);
  const px = size * fontK;
  tg.font = `${px}px Galmuri${size >= 14 ? 14 : 11}, "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  if (bg) {
    const w = tg.measureText(str).width + 10 * fontK;
    tg.fillStyle = "rgba(255,255,255,.94)";
    tg.fillRect(x - w / 2, y - px - 3 * fontK, w, px + 6 * fontK);
    tg.fillStyle = "#12142a";
    tg.fillRect(x - w / 2, y + 3 * fontK, w, fontK);
    tg.fillRect(x - 2 * fontK, y + 4 * fontK, 4 * fontK, 2 * fontK);
    tg.fillStyle = "#12142a";
    tg.fillText(str, x, y);
    return;
  }
  tg.fillStyle = "#12142a";
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) tg.fillText(str, x + dx * fontK, y + dy * fontK);
  tg.fillStyle = col;
  tg.fillText(str, x, y);
}

function renderText(t, list) {
  const S = scale * dpr;
  fontK = Math.max(Math.round(dpr), Math.round(S / 3.2));
  tg.clearRect(0, 0, text.width, text.height);
  tg.textAlign = "center";
  tg.textBaseline = "alphabetic";
  const m = G.map, me = G.me;

  for (const p of m.portals) if (p.y === m.portals.find((q) => q.to === p.to).y) label(`▸ ${p.to}`, p.x * T + 8, p.y * T - 4, "#e0c8ff");
  for (const n of m.npcs) {
    label(n.name, n.x * T + 8, n.y * T - 12, "#ffd84a");
    if (n.role === "elder" && G.self) {
      const q = G.self.q, quest = G.defs.quests[q.i];
      if (quest) {
        const mark = q.st === 0 ? "!" : q.n >= quest.n ? "?" : "";
        if (mark) label(mark, n.x * T + 8, n.y * T - 23 + Math.sin(t / 200) * 2, mark === "!" ? "#ffd84a" : "#8cff8c", 14);
      }
    }
  }
  for (const o of list) {
    if (o.mob) {
      const d = G.defs.mobs[o.mob.k];
      if (d.boss || o.mob.hp < d.hp) {
        const art = mobArt[d.sp];
        label(`Lv.${d.lv} ${d.name}`, o.mob.x, o.mob.y - art.frames[0].height - 7 - art.lift, d.boss ? "#ff9ae0" : "#ffe0e0");
      }
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (w) label(`Lv.${w.lvl} ${w.name}`, o.p.x, o.p.y - 23, o.p.dead ? "#9a9aa8" : "#d8f0ff");
    } else if (o.me) {
      const w = G.who.get(G.you);
      if (w) label(`Lv.${w.lvl} ${w.name}`, me.x, me.y - 23, "#b8ffb8");
    }
  }
  for (const [eid, b] of G.bubbles) {
    if (t > b.until) { G.bubbles.delete(eid); continue; }
    const p = entityPos(eid);
    if (p) label(b.text.length > 22 ? b.text.slice(0, 22) + "…" : b.text, p.x, p.y - 38, "#12142a", 11, true);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const f = G.texts[i];
    const k = (t - f.t0) / 900;
    if (k >= 1) { G.texts.splice(i, 1); continue; }
    tg.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    const pop = f.big && k < 0.15 ? -4 * Math.sin((k / 0.15) * Math.PI) : 0;
    label(f.str, f.x, f.y - k * 16 + pop, f.col, f.big ? 14 : 11);
  }
  tg.globalAlpha = 1;
}

let miniAt = 0;
function renderMini(t) {
  if (!mini || t - miniAt < 200) return;
  miniAt = t;
  const cv = $("#mini-cv"), g = cv.getContext("2d");
  const s = mini.width / G.map.w;
  g.drawImage(mini, 0, 0);
  const dot = (x, y, col, r = 2) => { g.fillStyle = col; g.fillRect(Math.round((x / T) * s - r / 2), Math.round((y / T) * s - r / 2), r, r); };
  for (const p of G.map.portals) dot(p.x * T + 8, p.y * T + 8, "#e080ff", 3);
  for (const n of G.map.npcs) dot(n.x * T + 8, n.y * T + 8, "#ffd84a", 3);
  for (const m of G.mobs.values()) dot(m.x, m.y, "#ff5050");
  for (const p of G.players.values()) dot(p.x, p.y, "#7ad8ff", 3);
  if (Math.floor(t / 300) % 2) dot(G.me.x, G.me.y, "#ffffff", 4);
  else dot(G.me.x, G.me.y, "#12142a", 4);
  $("#mini-info").textContent = `${channelName()} · ${G.who.size}명`;
}

// ───────────────────────────── HUD & windows ─────────────────────────────

const WIN = ["inv", "char", "shop", "smith", "quest", "rank", "talk", "help"];
const isOpen = (id) => !$(`#w-${id}`).hidden;
function openWin(id) {
  $(`#w-${id}`).hidden = false;
  if (id === "rank") { $("#rank-list").textContent = "불러오는 중…"; act({ t: "rank" }); }
  refreshUi();
}
function closeWin(id) { $(`#w-${id}`).hidden = true; }
function toggleWin(id) { Sound.play("ui"); isOpen(id) ? closeWin(id) : openWin(id); }
function closeAll() { for (const id of WIN) closeWin(id); }
for (const b of $$("#menu button[data-win]")) b.addEventListener("click", () => toggleWin(b.dataset.win));
for (const b of $$(".window .x")) b.addEventListener("click", () => { b.closest(".window").hidden = true; });

function toast(m) {
  const box = $("#toasts");
  const p = el("p", "", m);
  box.append(p);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => p.remove(), 3300);
}
function banner(str, small) {
  const b = $("#banner");
  b.hidden = true;
  void b.offsetWidth; // restart the animation
  b.textContent = str;
  b.style.fontSize = small ? "22px" : "";
  b.hidden = false;
}
function addChat(m, cls, name) {
  const log = $("#chat-log");
  const p = el("p", cls || "");
  if (name) p.append(el("span", "who", `${name}: `));
  p.append(m);
  log.append(p);
  while (log.children.length > 40) log.firstChild.remove();
}
$("#chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#chat-in");
  const m = input.value.trim();
  if (m) act({ t: "chat", m });
  input.value = "";
  input.blur();
});
$("#chat-log").addEventListener("click", () => {
  if (!document.body.classList.contains("touch")) return;
  const m = prompt("채팅");
  if (m && m.trim()) act({ t: "chat", m: m.trim().slice(0, 80) });
});

function hudBars() {
  const s = G.self, me = G.me;
  if (!s) return;
  $("#st-hp").style.width = `${clamp((me.hp / s.mhp) * 100, 0, 100)}%`;
  $("#st-mp").style.width = `${clamp((me.mp / s.mmp) * 100, 0, 100)}%`;
  $("#st-hpt").textContent = `${me.hp} / ${s.mhp}`;
  $("#st-mpt").textContent = `${me.mp} / ${s.mmp}`;
}

function itemSlot(entry, onClick, selected) {
  const d = el("div", "slot");
  if (!entry) return d;
  const it = G.defs.items[entry.id];
  if (it.tier > 1) d.classList.add(`t${it.tier}`);
  if (selected) d.classList.add("sel");
  const img = el("img");
  img.src = G.icons.url[entry.id];
  img.alt = it.name;
  d.append(img);
  if (entry.n > 1) d.append(el("span", "n", entry.n));
  if (entry.enh > 0) d.append(el("span", "e", `+${entry.enh}`));
  if (onClick) d.addEventListener("click", onClick);
  return d;
}
function itemName(entry) {
  return (entry.enh > 0 ? `+${entry.enh} ` : "") + G.defs.items[entry.id].name;
}
function itemDesc(entry) {
  const it = G.defs.items[entry.id];
  const e = entry.enh || 0;
  if (it.type === "weapon") return `공격력 +${Math.round(it.atk * (1 + 0.1 * e))} · 치명타 +${e}% · ${G.defs.classes[it.cls].name} 전용 · Lv.${it.req}`;
  if (it.type === "armor") return `방어력 +${Math.round(it.def * (1 + 0.1 * e))} · HP +${it.hp + e * 8} · Lv.${it.req}`;
  return it.desc || "";
}
const sellPrice = (entry) => Math.floor(G.defs.items[entry.id].price * 0.4 * (1 + 0.5 * (entry.enh || 0)));

function refreshUi() {
  const s = G.self;
  if (!s) return;
  const it = G.defs.items;
  $("#st-name").textContent = s.name;
  $("#st-lv").textContent = `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`;
  const maxed = s.lvl >= G.defs.maxLv;
  $("#exp-fill").style.width = maxed ? "100%" : `${(s.xp / s.need) * 100}%`;
  $("#exp-text").textContent = maxed ? "MAX" : `EXP ${s.xp} / ${s.need} (${((s.xp / s.need) * 100).toFixed(1)}%)`;
  hudBars();

  // quick slots
  for (const [btn, ids] of [["#b-hp", ["hp_s", "hp_m"]], ["#b-mp", ["mp_s", "mp_m"]]]) {
    const n = countItem(ids[0]) + countItem(ids[1]);
    $(`${btn} img`).src = G.icons.url[countItem(ids[0]) || !countItem(ids[1]) ? ids[0] : ids[1]];
    $(`${btn} .n`).textContent = n;
    $(btn).style.opacity = n ? 1 : 0.45;
  }
  G.defs.skills[s.cls].forEach((sk, i) => {
    const b = $(`#b-s${i}`);
    b.querySelector(".nm").textContent = sk.name;
    b.classList.toggle("locked", s.lvl < sk.lv);
    b.title = `${sk.name} (MP ${sk.mp}) — ${sk.desc}`;
  });

  // quest tracker
  const qt = $("#quest-track");
  qt.textContent = "";
  const quest = G.defs.quests[s.q.i];
  if (quest && s.q.st === 1) {
    const done = s.q.n >= quest.n;
    qt.append(el("b", "", `[의뢰] ${quest.title}`), el("br"), el("span", done ? "done" : "", done ? "완료! 촌장에게 돌아가세요" : `${G.defs.mobs[quest.mob].name} ${s.q.n} / ${quest.n}`));
  } else if (quest) {
    qt.append(el("b", "", "[의뢰]"), " 촌장 엘더윈에게 새 의뢰가 있습니다");
  }

  if (isOpen("inv")) {
    $("#inv-gold").textContent = s.gold.toLocaleString();
    const grid = $("#inv-grid");
    grid.textContent = "";
    if (G.sel >= s.inv.length) G.sel = -1;
    for (let i = 0; i < G.defs.inv; i++) {
      grid.append(itemSlot(s.inv[i], () => { G.sel = G.sel === i ? -1 : i; Sound.play("ui"); refreshUi(); }, i === G.sel));
    }
    const det = $("#inv-detail");
    det.textContent = "";
    const entry = s.inv[G.sel];
    if (!entry) det.append(el("div", "ds", "아이템을 고르면 설명이 나옵니다."));
    else {
      const d = it[entry.id];
      const nm = el("div", "nm", itemName(entry));
      nm.style.color = Art.TIER_COL[d.tier || 0];
      det.append(nm, el("div", "ds", itemDesc(entry)));
      const btns = el("div", "btns");
      const add = (label, fn, off) => { const b = el("button", "", label); b.disabled = !!off; b.addEventListener("click", fn); btns.append(b); };
      if (d.type === "pot") add("사용", () => act({ t: "use", id: entry.id }));
      if (d.type === "weapon" || d.type === "armor") add("장착", () => { act({ t: "eq", s: G.sel }); G.sel = -1; }, (d.cls && d.cls !== s.cls) || s.lvl < d.req);
      if (isOpen("shop")) {
        const each = sellPrice(entry);
        add(`판매 (${each}G)`, () => act({ t: "sell", s: G.sel, n: 1 }));
        if (entry.n > 1) add(`전부 판매 (${each * entry.n}G)`, () => act({ t: "sell", s: G.sel, n: entry.n }));
      }
      det.append(btns);
    }
  }

  if (isOpen("char")) {
    const w = G.who.get(G.you);
    const cv = $("#char-cv"), cg = cv.getContext("2d");
    cg.clearRect(0, 0, 16, 22);
    if (w) cg.drawImage(w.sprite[0][0], 0, 0);
    $("#char-title").textContent = `${s.name} · Lv.${s.lvl} ${G.defs.classes[s.cls].name}`;
    for (const k of ["weapon", "armor"]) {
      const host = $(`#eq-${k}`);
      const slot = itemSlot(s.eq[k], s.eq[k] ? () => act({ t: "uneq", k }) : null);
      slot.id = `eq-${k}`;
      slot.title = s.eq[k] ? `${itemName(s.eq[k])} — ${itemDesc(s.eq[k])} (눌러서 해제)` : k === "weapon" ? "무기 없음" : "방어구 없음";
      host.replaceWith(slot);
    }
    const st = $("#char-stats");
    st.textContent = "";
    for (const [k, v] of [["공격력", s.atk], ["방어력", s.def], ["최대 HP", s.mhp], ["최대 MP", s.mmp], ["치명타", `${s.crit}%`], ["처치 수", s.kills], ["골드", s.gold.toLocaleString()], ["무기", s.eq.weapon ? itemName(s.eq.weapon) : "-"]]) {
      const sp = el("span", "", k);
      sp.append(el("b", "", v));
      st.append(sp);
    }
    const sk = $("#char-skills");
    sk.textContent = "";
    for (const d of G.defs.skills[s.cls]) {
      const p = el("p", s.lvl < d.lv ? "locked" : "");
      p.append(el("b", "", `${d.name} `), `Lv.${d.lv} · MP ${d.mp} · ${d.cd / 1000}초 — ${d.desc}`);
      sk.append(p);
    }
  }

  if (isOpen("shop")) {
    const list = $("#shop-list");
    list.textContent = "";
    for (const key of G.defs.shop) {
      const id = key[0] === "W" && key.length === 2 ? `w_${s.cls}_${key[1]}` : key;
      const d = it[id];
      const row = el("div", "it");
      const img = el("img"); img.src = G.icons.url[id]; img.alt = "";
      const tx = el("div", "tx", d.name);
      tx.style.color = Art.TIER_COL[d.tier || 0];
      tx.append(el("small", "", `${d.price}G · ${itemDesc({ id })}`));
      row.append(img, tx);
      const buy = (n) => { const b = el("button", "", n > 1 ? `×${n}` : "구매"); b.disabled = s.gold < d.price * n; b.addEventListener("click", () => act({ t: "buy", id: key, n })); row.append(b); };
      buy(1);
      if (d.type === "pot") buy(10);
      list.append(row);
    }
  }

  if (isOpen("smith")) {
    const list = $("#smith-list");
    list.textContent = "";
    const stones = countItem("stone");
    for (const k of ["weapon", "armor"]) {
      const g = s.eq[k];
      const row = el("div", "it");
      if (!g) { row.append(el("div", "tx", k === "weapon" ? "무기를 장착하지 않았습니다" : "방어구를 장착하지 않았습니다")); list.append(row); continue; }
      const d = it[g.id];
      const img = el("img"); img.src = G.icons.url[g.id]; img.alt = "";
      const tx = el("div", "tx", itemName(g));
      tx.style.color = Art.TIER_COL[d.tier];
      row.append(img, tx);
      if (g.enh >= 10) tx.append(el("small", "", "최대 강화 단계입니다"));
      else {
        const c = s.enh[k];
        tx.append(el("small", "", `성공률 ${G.defs.enh[g.enh]}% · ${c.gold}G · 강화석 ${c.stone}개 (보유 ${stones})`));
        const b = el("button", "", "강화");
        b.disabled = s.gold < c.gold || stones < c.stone;
        b.addEventListener("click", () => act({ t: "enh", k }));
        row.append(b);
      }
      list.append(row);
    }
  }

  if (isOpen("quest")) {
    const body = $("#quest-body");
    body.textContent = "";
    const atElder = G.near && G.near.role === "elder";
    if (!quest) body.append(el("p", "say", "자네 덕분에 마을에 평화가 찾아왔네. 모든 의뢰를 완료했다네! 이제 수정 군주에게 다시 도전하며 더 강한 장비를 노려 보게."));
    else {
      body.append(el("div", "q-title", `${s.q.i + 1}. ${quest.title}`), el("p", "say", quest.text));
      const mob = G.defs.mobs[quest.mob];
      body.append(el("div", "", `목표: Lv.${mob.lv} ${mob.name} ${s.q.st === 1 ? `${Math.min(s.q.n, quest.n)} / ` : ""}${quest.n}마리`));
      body.append(el("div", "q-reward", `보상: EXP ${quest.xp} · ${quest.gold}G · ${quest.items.map(([id, n]) => `${it[id].name} ×${n}`).join(", ")}`));
      const btns = el("div", "btns");
      const b = el("button");
      if (s.q.st === 0) { b.textContent = "의뢰 수락"; b.addEventListener("click", () => { act({ t: "quest", a: "accept" }); Sound.play("ok"); }); }
      else { b.textContent = "의뢰 완료"; b.disabled = s.q.n < quest.n; b.addEventListener("click", () => { act({ t: "quest", a: "done" }); Sound.play("ok"); }); }
      if (!atElder) { b.disabled = true; btns.append(b, el("span", "ds", " 촌장 엘더윈 근처에서만 가능합니다")); }
      else btns.append(b);
      body.append(btns);
    }
  }
}

function renderRank(list) {
  const box = $("#rank-list");
  box.textContent = "";
  if (!list.length) { box.textContent = "아직 기록이 없습니다."; return; }
  list.forEach((r, i) => {
    const row = el("div", "rk" + (G.self && r.name === G.self.name ? " me" : ""));
    row.append(el("i", "", i + 1), el("b", "", r.name), el("span", "", `Lv.${r.lvl} ${G.defs.classes[r.cls]?.name ?? ""}`));
    box.append(row);
  });
}

function hudTick(t) {
  const s = G.self;
  if (!s) return;
  G.defs.skills[s.cls].forEach((sk, i) => {
    const left = G.cdEnd[i] - t;
    $(`#b-s${i} .cd`).style.height = left > 0 ? `${clamp(left / sk.cd, 0, 1) * 100}%` : "0";
  });
  const buffs = $("#st-buffs");
  const names = ["공격력↑", "이동속도↑"];
  const want = G.buffEnd.map((e, i) => (e > t ? `${names[i]} ${Math.ceil((e - t) / 1000)}` : "")).filter(Boolean).join("|");
  if (buffs.dataset.v !== want) {
    buffs.dataset.v = want;
    buffs.textContent = "";
    for (const b of want ? want.split("|") : []) buffs.append(el("span", "", b));
  }
}

// ───────────────────────────── title & creation ─────────────────────────────

const CLASS_DESC = {
  warrior: "전사 — 튼튼한 체력과 방어력. 가까이 붙어 베고, 회전베기로 무리를 쓸어 버립니다.",
  archer: "궁수 — 멀리서 빠르게 쏩니다. 관통 화살로 일직선의 적을 꿰뚫고, 바람처럼 달립니다.",
  mage: "마법사 — 강력한 범위 마법과 치유. 체력은 약하지만 화력은 최고입니다.",
};
const draft = { cls: "warrior", hair: 0, skin: 0, style: 0 };
function pick(sel, key, cast = (v) => v) {
  for (const b of $$(`${sel} button`)) {
    b.addEventListener("click", () => {
      for (const o of $$(`${sel} button`)) o.classList.remove("on");
      b.classList.add("on");
      draft[key] = cast(b.dataset.v);
      $("#c-desc").textContent = CLASS_DESC[draft.cls];
      Sound.unlock(); Sound.play("ui");
    });
  }
}
Art.HAIR.forEach((c, i) => { const b = el("button", i ? "" : "on"); b.dataset.v = i; b.style.background = c[0]; $("#c-hair").append(b); });
Art.SKIN.forEach((c, i) => { const b = el("button", i ? "" : "on"); b.dataset.v = i; b.style.background = c[0]; $("#c-skin").append(b); });
pick("#c-cls", "cls"); pick("#c-hair", "hair", Number); pick("#c-skin", "skin", Number); pick("#c-style", "style", Number);
$("#c-desc").textContent = CLASS_DESC.warrior;

for (const b of $$("#ch-pick button")) {
  b.classList.toggle("on", b.dataset.ch === channel);
  b.addEventListener("click", () => {
    channel = b.dataset.ch;
    localStorage.setItem("lumentale:ch", channel);
    for (const o of $$("#ch-pick button")) o.classList.toggle("on", o === b);
  });
}
$("#b-start").addEventListener("click", () => {
  Sound.unlock();
  Sound.play("ok");
  $("#title-msg").textContent = "서버에 연결하는 중…";
  if (ws) { wantOnline = false; try { ws.close(); } catch { /* fine */ } }
  connect();
});
$("#b-create").addEventListener("click", () => {
  const name = $("#c-name").value.trim();
  if (!/^[가-힣A-Za-z0-9]{2,10}$/.test(name)) { $("#create-msg").textContent = "이름은 한글·영문·숫자 2~10자로 지어 주세요"; return; }
  $("#create-msg").textContent = "";
  act({ t: "create", name, cls: draft.cls, look: { hair: draft.hair, skin: draft.skin, style: draft.style } });
});
$("#c-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#b-create").click(); });

// a small living diorama behind the title
const tcv = $("#title-cv"), tgx = tcv.getContext("2d");
const parade = [
  Art.charSprite(Art.playerLook("warrior", [3, 0, 0], 0)), Art.charSprite(Art.playerLook("mage", [4, 0, 1], 0)),
  Art.charSprite(Art.playerLook("archer", [2, 1, 0], 0)),
];
function renderTitle(t) {
  const s = Math.max(2, Math.round(Math.min(innerWidth / 300, innerHeight / 180)));
  const w = Math.ceil(innerWidth / s), h = Math.ceil(innerHeight / s);
  if (tcv.width !== w || tcv.height !== h) { tcv.width = w; tcv.height = h; }
  tgx.imageSmoothingEnabled = false;
  const sky = tgx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1a2a6c"); sky.addColorStop(0.6, "#5a78d0"); sky.addColorStop(1, "#ffc890");
  tgx.fillStyle = sky; tgx.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(Art.hash(i, 1) * w), y = Math.floor(Art.hash(i, 2) * h * 0.55);
    tgx.fillStyle = Math.sin(t / 400 + i) > 0.2 ? "#ffffff" : "#9fb8ff";
    tgx.fillRect(x, y, 1, 1);
  }
  const gy = h - 34;
  tgx.fillStyle = "#3c7a58";
  for (let x = 0; x < w; x++) { const hh = 14 + Math.sin(x / 23) * 8 + Math.sin(x / 7) * 2; tgx.fillRect(x, gy - hh, 1, hh); }
  tgx.fillStyle = "#6cbf4b"; tgx.fillRect(0, gy, w, 34);
  tgx.fillStyle = "#58a83e"; for (let x = 0; x < w; x += 5) tgx.fillRect(x + ((x * 7) % 3), gy + 3 + ((x * 13) % 26), 2, 1);
  tgx.fillStyle = "#e0c383"; tgx.fillRect(0, gy + 14, w, 9);
  for (let i = 0; i < Math.ceil(w / 70) + 1; i++) {
    const x = ((i * 70 - (t / 40) % 70) + 70) % (w + 70) - 35;
    tgx.drawImage(i % 2 ? scenery.T : scenery.P, Math.round(x), gy - (i % 2 ? 26 : 30));
  }
  const cx = Math.round(w / 2);
  parade.forEach((sp, i) => tgx.drawImage(sp[2][1 + (Math.floor(t / 160) % 2)], cx - 34 + i * 20, gy));
  const sl = mobArt.slime.right[Math.floor(t / 300) % 2];
  tgx.drawImage(sl, cx + 34, gy + 4 - Math.abs(Math.round(Math.sin(t / 250) * 5)));
  tgx.drawImage(mobArt.bslime.right[Math.floor(t / 300 + 1) % 2], cx + 54, gy + 4 - Math.abs(Math.round(Math.sin(t / 250 + 1) * 5)));
}
function renderCreate(t) {
  const g = $("#create-cv").getContext("2d");
  g.clearRect(0, 0, 16, 22);
  const sp = Art.charSprite(Art.playerLook(draft.cls, [draft.hair, draft.skin, draft.style], 0));
  g.drawImage(sp[Math.floor(t / 1600) % 4][1 + (Math.floor(t / 200) % 2)], 0, 0);
}

// ───────────────────────────── main loop ─────────────────────────────

let last = now();
function frame() {
  const t = now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (G.playing) {
    update(dt, t);
    render(t);
    renderMini(t);
    hudTick(t);
  } else if (!$("#title").hidden) renderTitle(t);
  if (!$("#create").hidden) renderCreate(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// handy for automated play-testing
window.__game = { G, act };
