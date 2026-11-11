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
  auto: false, sel: -1, shake: 0, flash: 0, near: null, party: [], pinv: null, path: null, mark: null,
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
        addChat("관리자 엘더윈에게 말을 걸어 첫 의뢰를 받아 보세요. [?] 버튼에 조작법이 있습니다.", "sys");
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

/** Grid position (plus a height above the ground) → where it lands in the projected world. */
const P = (x, y, z = 0) => { const [ix, iy] = Art.iso(x, y); return [ix, iy - z]; };

function loadMap(m) {
  G.map = m;
  G.path = null;
  ground = Art.renderGround(m);
  mini = Art.renderMini(m);
  const cv = $("#mini-cv");
  cv.width = m.w + m.h; cv.height = Math.ceil((m.w + m.h) / 2);
  G.statics = [];
  // Things that stand on one tile are flat sprites planted at its centre;
  // buildings, walls and cars are solids drawn from their far ground corner.
  const billboard = (sp, tx, ty, extra) => {
    const [ix, iy] = P(tx * T + 8, ty * T + 8);
    G.statics.push({ sp, dx: Math.round(ix - sp.width / 2), dy: Math.round(iy + 4 - sp.height), cx: ix, cy: iy, depth: (tx + ty) * T + 16, ...extra });
  };
  const box = (b, wx, wy, w, d, extra) => {
    const [ix, iy] = P(wx, wy), [cx, cy] = P(wx + w / 2, wy + d / 2);
    G.statics.push({ sp: b.cv, dx: Math.round(ix - b.ax), dy: Math.round(iy - b.ay), cx, cy, depth: wx + wy + (w + d) / 2, ...extra });
  };
  const open = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.g[y][x] !== "W" && m.o[y][x] !== "Z";
  // only walls that border open ground are raised; the rest is darkness behind them
  const edge = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) return true;
    return false;
  };
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const ch = m.o[y][x];
    if (m.g[y][x] === "W") { if (edge(x, y)) box(scenery.W, x * T, y * T, T, T); continue; }
    if (ch === "Z") { if (edge(x, y)) box(scenery.Z, x * T, y * T, T, T); continue; }
    if (ch === "c") { box(scenery.c[Math.floor(Art.hash(x, y, 3) * scenery.c.length)], x * T - 5, y * T + 1.5, 26, 13); continue; }
    let sp = scenery[ch];
    if (!sp || Array.isArray(sp) || sp.cv) continue;
    if (ch === "K" && Art.hash(x, y, 7) > 0.6) sp = scenery.K2;
    billboard(sp, x, y, { glow: ch === "K" ? (sp === scenery.K2 ? "#c08af0" : "#6ae0f0") : ch === "L" ? "#ffe890" : null });
  }
  for (const b of m.big) {
    if (b.t === "house") box(scenery.house[b.v % 8], b.x * T, b.y * T, 64, 48, { win: b.v >= 4 });
    else if (b.t === "fountain") {
      const [ix, iy] = P((b.x + 1) * T, (b.y + 1) * T);
      G.statics.push({ anim: scenery.fountain, dx: Math.round(ix - 17), dy: Math.round(iy + 10 - 34), cx: ix, cy: iy, depth: (b.x + b.y + 2) * T });
    }
  }
  for (const n of m.npcs) n.sprite = Art.charSprite(Art.npcLook(n.look, n.role));
  G.players.clear(); G.mobs.clear(); G.drops.clear();
  G.fx.length = 0; G.parts.length = 0;
  $("#mini-name").textContent = m.name;
  Sound.bgm(m.bgm);
  banner(m.name, true);
  closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train");
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
    for (const [eid, name, cls, lvl, look, tier, wt, party] of s.who) {
      G.who.set(eid, { name, cls, lvl, sprite: Art.charSprite(Art.playerLook(cls, look, tier)), look, tier, wid: wt ? `w_${cls}_${wt}` : null, party });
    }
    if (isOpen("party")) renderParty();
  }
  sync(G.players, s.P, (e, r) => { e.tx = r[1]; e.ty = r[2]; e.dir = r[3]; e.dead = !!r[4]; e.hp = r[5]; e.mhp = r[6]; }, t);
  sync(G.mobs, s.M, (e, r) => { e.k = r[1]; e.tx = r[2]; e.ty = r[3]; e.dir = r[4]; e.hp = r[5]; e.el = r[6]; }, t);
  sync(G.drops, s.D, (e, r) => { e.it = r[1]; e.tx = r[2]; e.ty = r[3]; e.q = r[4]; }, t);

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
  const pk = JSON.stringify(s.party || []);
  if (pk !== G.partyKey) { G.partyKey = pk; G.party = s.party || []; renderPartyHud(); if (isOpen("party")) renderParty(); }
  if ((s.pinv || null) !== G.pinv) { G.pinv = s.pinv || null; renderInvite(); }
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

const MOB_COL = { slime: "#5a9a4a", bslime: "#4a7aa8", shroom: "#8e3434", boar: "#6a4a34", bat: "#4a3862", drone: "#aab4c4", thug: "#5e2a2e", robot: "#7a808c", skel: "#d0d0d8", golem: "#5ac8d8", boss: "#e050b8" };
const mobMax = (m) => Math.round(G.defs.mobs[m.k].hp * (m.el ? G.defs.eliteHp : 1));

function onEvent(e, t) {
  switch (e[0]) {
    case "a": {
      const [, eid, kind, tx, ty] = e;
      const src = entityPos(eid);
      if (!src) break;
      if (eid !== G.you) { src.atkT = t; src.dir = e[5]; }
      else G.me.dir = e[5];
      attackFx(kind, P(src.x, src.y, 10), P(tx, ty + 6, 8), e[5]);
      break;
    }
    case "h": {
      const [, id, dmg, crit, isPlayer] = e;
      const tgt = entityPos(id);
      if (!tgt) break;
      const big = isPlayer ? 0 : G.defs.mobs[tgt.k]?.boss ? 22 : 0;
      const [x, y] = P(tgt.x, tgt.y);
      if (dmg < 0) floatText(`+${-dmg}`, x, y - 26, "#8cff8c");
      else {
        floatText(crit ? `${dmg}!` : String(dmg), x + (Math.random() * 10 - 5), y - 24 - big, isPlayer ? "#ff7a7a" : crit ? "#ffd84a" : "#ffffff", crit);
        tgt.hurtT = t;
        if (id === G.you) { G.flash = 1; G.shake = Math.max(G.shake, 3); Sound.play("hurt"); }
        else if (!isPlayer) Sound.play(crit ? "crit" : "hit");
        burst(x, y - 10 - big / 2, isPlayer ? "#ff7a7a" : "#ffffff", 4, 40);
      }
      break;
    }
    case "k": {
      const m = G.mobs.get(e[1]);
      if (m) { const [x, y] = P(m.x, m.y, 6); burst(x, y, MOB_COL[m.k] || "#fff", G.defs.mobs[m.k]?.boss ? 60 : 12, 70); Sound.play("die"); G.mobs.delete(e[1]); }
      break;
    }
    case "m": {
      const m = G.mobs.get(e[1]);
      if (m) {
        m.atkT = t;
        if (e.length > 2) {
          const [x, y] = P(m.x, m.y, 16), [x2, y2] = P(e[2], e[3] + 8, 10);
          G.fx.push({ type: "proj", x, y, x2, y2, t0: t, dur: 120, col: "#ff5a4a", size: 1 });
          Sound.play("shoot");
        }
      }
      break;
    }
    case "d": {
      const [x, y] = P(e[2], e[3] + 8, 8), [x2, y2] = P(e[4], e[5] + 8, 8);
      G.fx.push({ type: "beam", x, y, x2, y2, t0: t, dur: 220, col: "#6a5a9a" });
      burst(x, y, "#3a3550", 8, 30);
      break;
    }
    case "t": G.fx.push({ type: "tele", x: e[1], y: e[2], r: e[3], t0: t, dur: e[4] }); Sound.play("warn"); break;
    case "b": {
      const [x, y] = P(e[1], e[2]);
      G.fx.push({ type: "ring", x, y, r: e[3], t0: t, dur: 350, col: "#ff6ad0", fill: true });
      burst(x, y, "#ff6ad0", 30, 110);
      G.shake = 6; Sound.play("boom");
      break;
    }
    case "l": {
      const p = entityPos(e[1]);
      if (p) { G.fx.push({ type: "pillar", t0: t, dur: 900, ent: p }); if (e[1] !== G.you) { const [x, y] = P(p.x, p.y); floatText("LEVEL UP", x, y - 34, "#ffd84a", true); } }
      break;
    }
    case "pd": { const p = entityPos(e[1]); if (p) { const [x, y] = P(p.x, p.y, 10); burst(x, y, "#c8c8d8", 10, 40); } break; }
    case "s": G.bubbles.set(e[1], { text: e[2], until: t + 4500 }); break;
    case "u": {
      const p = entityPos(e[1]);
      if (p) { const [x, y] = P(p.x, p.y, 12); sparkle(x, y, e[2] === 2 ? "#ffd84a" : e[2] ? "#7ab4ff" : "#ff8a8a", e[2] === 2 ? 14 : 8); }
      if (e[1] === G.you) Sound.play(e[2] === 2 ? "buff" : "potion");
      break;
    }
    case "e": {
      const p = entityPos(e[1]);
      if (p) {
        const [x, y] = P(p.x, p.y);
        sparkle(x, y - 12, e[2] ? "#ffd84a" : "#8a8a9a", e[2] ? 26 : 10);
        if (e[2]) G.fx.push({ type: "ring", x, y, r: 20, t0: t, dur: 400, col: "#ffd84a" });
      }
      if (e[1] === G.you) Sound.play(e[2] ? "ok" : "fail");
      break;
    }
  }
}

function onGain([kind, a, b, q]) {
  const [x, y] = P(G.me.x, G.me.y);
  if (kind === "xp") floatText(`+${a} EXP`, x, y - 34, "#fff08a");
  else if (kind === "gold") { addChat(`골드 +${a}`, "loot"); Sound.play("coin"); }
  else if (kind === "item") {
    const p = addChat(`획득: ${q ? `[${G.defs.rarity[q]}] ` : ""}${G.defs.items[a].name}${b > 1 ? ` ×${b}` : ""}`, "loot");
    if (q) p.style.color = Art.RARITY_COL[q];
    Sound.play(q >= 2 ? "ok" : "item");
    if (q === 3) banner("전설 획득!", true);
  } else if (kind === "lvl") { banner("LEVEL UP!"); floatText(`Lv.${a}`, x, y - 44, "#ffd84a", true); Sound.play("level"); addChat(`레벨 ${a}이(가) 되었습니다!`, "sys"); }
}

// ───────────────────────────── effects ─────────────────────────────
// Effects, particles and floating text all live in projected space (see `P`).

function burst(x, y, col, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, life: 0.25 + Math.random() * 0.3, col, g: 160 });
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
/** `from` is the attacker's chest, `to` the point of impact — both already projected. */
function attackFx(kind, [x, y], [tx, ty], dir) {
  const t = now();
  const gy = y + 10; // the ground under the attacker, for rings
  const proj = (col, speed, size, then) => G.fx.push({ type: "proj", x, y, x2: tx, y2: ty, t0: t, dur: Math.max(60, (dist(x, y, tx, ty) / speed) * 1000), col, size, then });
  const ring = (cx, cy, r, dur, col, fill, delay = 0) => G.fx.push({ type: "ring", x: cx, y: cy, r, t0: t + delay, dur, col, fill });
  switch (kind) {
    case 0: G.fx.push({ type: "slash", x: tx, y: ty, dir, t0: t, dur: 180, col: "#e8e8f0", r: 15 }); Sound.play("swing"); break;
    case 1: proj("#fff0c0", 900, 1); burst(x + (tx - x) * 0.12, y + (ty - y) * 0.12, "#ffd84a", 3, 30); Sound.play("shoot"); break;
    case 2: proj("#b08aff", 300, 2); Sound.play("magic"); break;
    case 3: G.fx.push({ type: "slash", x: tx, y: ty, dir, t0: t, dur: 100, col: "#d8d8e8", r: 7 }); Sound.play("swing"); break;
    case 10: G.fx.push({ type: "slash", x: tx, y: ty, dir, t0: t, dur: 220, col: "#ffd84a", r: 17 }); G.shake = Math.max(G.shake, 2); Sound.play("crit"); break;
    case 11: ring(x, gy, 48, 260, "#ffffff"); ring(x, gy, 34, 240, "#ffd84a", false, 60); Sound.play("swing"); break;
    case 12: ring(x, gy, 60, 500, "#ff7a5a"); sparkle(x, y, "#ff7a5a", 14); Sound.play("buff"); break;
    case 13: G.fx.push({ type: "beam", x, y, x2: tx, y2: ty, t0: t, dur: 260, col: "#9fe8ff" }); Sound.play("shoot"); break;
    case 14: sparkle(x, y + 6, "#b8ffd0", 16); ring(x, gy, 22, 400, "#b8ffd0"); Sound.play("buff"); break;
    case 15: proj("#ff8a3a", 260, 3, () => { G.fx.push({ type: "ring", x: tx, y: ty + 8, r: 34, t0: now(), dur: 300, col: "#ff8a3a", fill: true }); burst(tx, ty, "#ffd84a", 18, 90); G.shake = Math.max(G.shake, 3); Sound.play("boom"); }); Sound.play("magic"); break;
    case 16: ring(x, gy, 58, 420, "#9fe8ff", true); sparkle(x, y, "#d0f4ff", 20); Sound.play("ice"); break;
    case 17: ring(x, gy, 90, 500, "#8cff8c"); sparkle(x, y, "#8cff8c", 20); Sound.play("heal"); break;
    case 18: G.fx.push({ type: "slash", x: tx, y: ty, dir, t0: t, dur: 200, col: "#c03048", r: 13 }); burst(tx, ty, "#c03048", 8, 60); Sound.play("crit"); break;
    case 19: burst(x, y, "#3a3550", 8, 30); break;
    case 20: for (let i = 0; i < 26; i++) G.parts.push({ x: x + Math.random() * 40 - 20, y: y + Math.random() * 20 - 4, vx: Math.random() * 20 - 10, vy: -8 - Math.random() * 10, life: 0.6 + Math.random() * 0.7, col: i % 2 ? "#6a6a78" : "#4a4a56", g: 0 }); Sound.play("buff"); break;
    case 21: proj("#3a4a3a", 240, 3, () => { G.fx.push({ type: "ring", x: tx, y: ty + 8, r: 42, t0: now(), dur: 320, col: "#ffb04a", fill: true }); burst(tx, ty, "#ffd84a", 24, 110); G.shake = Math.max(G.shake, 4); Sound.play("boom"); }); Sound.play("swing"); break;
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
    case "p": case "ㅔ": toggleWin("party"); break;
    case "m": case "ㅡ": toggleSound(); break;
    case "Enter": e.preventDefault(); $("#chat-in").focus(); break;
    case "Escape": closeAll(); break;
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => { keys.clear(); held.atk = false; });

/**
 * Which way to walk, in grid terms. The grid's axes are the screen's diagonals,
 * so each arrow key walks one diagonal (up = up-right, right = down-right,
 * down = down-left, left = up-left) and two keys together walk straight. The
 * stick and click-to-move work in screen terms and are converted.
 */
function moveVector() {
  let x = 0, y = 0;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("ㅁ")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("ㅇ")) x += 1;
  if (keys.has("ArrowUp") || keys.has("w") || keys.has("ㅈ")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("ㄴ")) y += 1;
  if (joy.on) [x, y] = Art.unIso(joy.x, joy.y);
  if (x || y) G.path = null;
  else if (G.path) {
    while (G.path.length && dist(G.me.x, G.me.y, G.path[0][0], G.path[0][1]) < 2.5) G.path.shift();
    if (!G.path.length) G.path = null;
    else { x = G.path[0][0] - G.me.x; y = G.path[0][1] - G.me.y; }
  }
  const l = Math.hypot(x, y);
  return l > 0.2 ? [x / l, y / l] : [0, 0];
}

/**
 * Click or tap the ground to walk there. A shortest-path search over the tile
 * grid in which a diagonal step costs √2, so routes run straight where they can.
 * If the spot cannot be reached, the route ends at the nearest tile that can.
 */
function pathTo(wx, wy) {
  const m = G.map, n = m.w * m.h;
  const free = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.o[y][x] === " " && !"wW".includes(m.g[y][x]);
  const sx = Math.floor(G.me.x / T), sy = Math.floor((G.me.y - 2) / T);
  const gx = clamp(Math.floor(wx / T), 0, m.w - 1), gy = clamp(Math.floor(wy / T), 0, m.h - 1);
  const cost = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const start = sy * m.w + sx, goal = gy * m.w + gx;
  cost[start] = 0;
  const open = [start];
  let best = start, bestD = Math.hypot(sx - gx, sy - gy);
  while (open.length) {
    let k = 0;
    for (let i = 1; i < open.length; i++) if (cost[open[i]] < cost[open[k]]) k = i;
    const cur = open[k];
    open[k] = open[open.length - 1]; open.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = cur % m.w, cy = (cur - cx) / m.w;
    const d = Math.hypot(cx - gx, cy - gy);
    if (d < bestD) { bestD = d; best = cur; }
    if (cur === goal) break;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy, ni = ny * m.w + nx;
      if (!free(nx, ny) || done[ni]) continue;
      if (dx && dy && !(free(cx + dx, cy) && free(cx, cy + dy))) continue; // no cutting corners
      const c = cost[cur] + (dx && dy ? 1.4142 : 1);
      if (c < cost[ni]) { cost[ni] = c; prev[ni] = cur; open.push(ni); }
    }
  }
  const path = [];
  for (let cur = best; cur !== start && cur !== -1; cur = prev[cur]) path.unshift([(cur % m.w) * T + 8, Math.floor(cur / m.w) * T + 10]);
  return path.length ? path : null;
}
world.addEventListener("pointerdown", (e) => {
  if (!G.playing || !G.map || G.me.dead) return;
  const [wx, wy] = Art.unIso(e.clientX / scale + cam.x, e.clientY / scale + cam.y);
  G.path = pathTo(wx, wy);
  if (G.path) G.mark = { at: now(), pos: G.path[G.path.length - 1] };
});

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
  else if (n.role === "train") openWin("train");
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
  if (G.auto && !me.dead && mx === 0 && my === 0 && !G.path && !G.map.safe) {
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
    else { closeWin("shop"); closeWin("smith"); closeWin("talk"); closeWin("train"); }
  }
}

// ───────────────────────────── render ─────────────────────────────
// Everything is positioned on the grid and drawn through `P`, the diamond
// projection; the camera works in projected space.

function shadow(x, y, w) {
  wg.fillStyle = "rgba(4, 6, 14, .32)";
  wg.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2);
  wg.fillRect(Math.round(x - w / 2) + 2, Math.round(y - 2), w - 4, 4);
}
/** Screen-space unit vector for each facing (the four diagonals). */
const FACE = [[-1, 0.5], [-1, -0.5], [1, 0.5], [1, -0.5]];
function drawChar(sprite, x, y, dir, walkT, moving, atkT, t, alpha = 1, wid = null) {
  const frame = moving ? 1 + (Math.floor(walkT) % 2) : 0;
  let ox = 0, oy = 0;
  const a = t - atkT;
  if (a < 160) { const k = Math.sin((a / 160) * Math.PI) * 3; ox = FACE[dir][0] * k; oy = FACE[dir][1] * k; }
  shadow(x, y + 1, 12);
  if (alpha !== 1) wg.globalAlpha = alpha;
  const cx = Math.round(x - 8 + ox), cy = Math.round(y - Art.CHAR_H + 2 + oy);
  // the weapon in hand: behind the body when facing away, raised during a swing
  const leftward = dir < 2, away = dir === 1 || dir === 3;
  const icon = wid && G.icons ? (leftward ? G.icons.left[wid] : G.icons.cv[wid]) : null;
  const wx = leftward ? cx - 9 : cx + 9, wy = cy + 7 + (a < 160 ? -3 : 0) + (frame ? 1 : 0);
  if (icon && away) wg.drawImage(icon, wx, wy);
  wg.drawImage(sprite[dir][frame], cx, cy);
  if (icon && !away) wg.drawImage(icon, wx, wy);
  wg.globalAlpha = 1;
}
/** A circle lying on the ground looks like a 2:1 ellipse from this angle. */
function groundEllipse(x, y, r) {
  wg.beginPath();
  wg.ellipse(x, y, Math.max(0.5, r * 1.41), Math.max(0.5, r * 0.71), 0, 0, Math.PI * 2);
}

function render(t) {
  const m = G.map, me = G.me;
  if (!m || !ground) return;
  const [mix, miy] = P(me.x, me.y);
  cam.x = Math.round(mix - vw / 2);
  cam.y = Math.round(miy - 12 - vh / 2);
  if (G.shake > 0.3) { cam.x += Math.round((Math.random() - 0.5) * G.shake); cam.y += Math.round((Math.random() - 0.5) * G.shake); }

  wg.fillStyle = "#050608";
  wg.fillRect(0, 0, vw, vh);
  wg.save();
  wg.translate(-cam.x, -cam.y);
  wg.drawImage(ground.frames[Math.floor(t / 500) % 2], -ground.ox, 0);

  // ground decals
  for (const p of m.portals) {
    const [px, py] = P(p.x * T + 8, p.y * T + 9);
    for (let i = 0; i < 3; i++) {
      const ph = (t / 600 + i / 3) % 1;
      wg.strokeStyle = `rgba(${i % 2 ? "160,220,255" : "200,150,255"},${1 - ph})`;
      wg.beginPath(); wg.ellipse(px, py, 5 + ph * 13, 2.5 + ph * 6.5, 0, 0, Math.PI * 2); wg.stroke();
    }
    if (Math.random() < 0.15) G.parts.push({ x: px + Math.random() * 20 - 10, y: py, vx: 0, vy: -22, life: 0.6, col: "#d0b0ff", g: 0 });
  }
  if (G.path && G.mark) {
    const [px, py] = P(G.mark.pos[0], G.mark.pos[1]);
    const k = ((t - G.mark.at) / 500) % 1;
    wg.strokeStyle = `rgba(240,224,168,${1 - k * 0.7})`;
    wg.beginPath(); wg.ellipse(px, py, 4 + k * 5, 2 + k * 2.5, 0, 0, Math.PI * 2); wg.stroke();
  }
  for (const f of G.fx) {
    if (f.type !== "tele") continue;
    const k = clamp((t - f.t0) / f.dur, 0, 1);
    const [fx, fy] = P(f.x, f.y);
    wg.fillStyle = `rgba(255,60,120,${0.15 + 0.2 * Math.abs(Math.sin(t / 70))})`;
    groundEllipse(fx, fy, f.r); wg.fill();
    wg.strokeStyle = "#ff6ad0";
    groundEllipse(fx, fy, f.r * k); wg.stroke();
  }

  // everything that stands up, drawn back to front along the view axis
  const list = [];
  const x0 = cam.x - 70, x1 = cam.x + vw + 70, y0 = cam.y - 30, y1 = cam.y + vh + 90;
  for (const s of G.statics) if (s.cx > x0 && s.cx < x1 && s.cy > y0 && s.cy < y1) list.push({ z: s.depth, s });
  const put = (o, wx, wy) => { const [ix, iy] = P(wx, wy); o.ix = ix; o.iy = iy; o.z = wx + wy; list.push(o); };
  for (const n of m.npcs) put({ n }, n.x * T + 8, n.y * T + 12);
  for (const d of G.drops.values()) put({ d }, d.x, d.y - 2);
  for (const mob of G.mobs.values()) put({ mob }, mob.x, mob.y);
  for (const [eid, p] of G.players) put({ p, eid }, p.x, p.y);
  put({ me: true }, me.x, me.y);
  list.sort((a, b) => a.z - b.z);

  for (const o of list) {
    const x = o.ix, y = o.iy;
    if (o.s) {
      const sp = o.s.anim ? o.s.anim[Math.floor(t / 300) % 2] : o.s.sp;
      if (o.s.glow) {
        wg.globalAlpha = 0.14 + 0.06 * Math.sin(t / 400 + o.s.cx);
        wg.fillStyle = o.s.glow;
        wg.beginPath(); wg.arc(o.s.cx, o.s.dy + sp.height * (o.s.glow === "#ffe890" ? 0.18 : 0.45), 13, 0, Math.PI * 2); wg.fill();
        wg.globalAlpha = 1;
      }
      wg.drawImage(sp, o.s.dx, o.s.dy);
    } else if (o.n) {
      drawChar(o.n.sprite, x, y, 0, 0, false, -1e9, t);
    } else if (o.d) {
      const ic = G.icons.cv[o.d.it];
      const bob = Math.round(Math.sin(t / 220 + o.d.id) * 1.5);
      shadow(x, y, 8);
      if (o.d.q) {
        wg.fillStyle = Art.RARITY_COL[o.d.q];
        wg.globalAlpha = 0.25 + 0.15 * Math.sin(t / 180 + o.d.id);
        wg.fillRect(Math.round(x - 1), Math.round(y - 12 - o.d.q * 9), 2, o.d.q * 9 + 10);
        wg.globalAlpha = 1;
      }
      if (ic) wg.drawImage(ic, Math.round(x - 6), Math.round(y - 13 + bob), 12, 12);
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
      shadow(x, y + 1, Math.min(22, img.width - 4));
      if (mob.el) {
        wg.strokeStyle = `rgba(255,190,60,${0.5 + 0.3 * Math.sin(t / 160)})`;
        wg.beginPath(); wg.ellipse(x, y, 13, 6, 0, 0, Math.PI * 2); wg.stroke();
        if (Math.random() < 0.2) G.parts.push({ x: x + Math.random() * 14 - 7, y: y - 2, vx: 0, vy: -20, life: 0.5, col: "#ffbe3c", g: 0 });
      }
      wg.globalAlpha = clamp((t - mob.born) / 300, 0, 1);
      wg.drawImage(img, Math.round(x - img.width / 2 + ox), Math.round(y - img.height + 3 - art.lift + ox * (right ? 0.5 : -0.5) * 0));
      wg.globalAlpha = 1;
      const max = mobMax(mob);
      if (mob.hp < max) {
        const w = G.defs.mobs[mob.k].boss ? 40 : 16;
        const bx = Math.round(x - w / 2), by = Math.round(y - img.height - 3 - art.lift);
        wg.fillStyle = "#08090c"; wg.fillRect(bx - 1, by - 1, w + 2, 4);
        wg.fillStyle = mob.el ? "#ffbe3c" : "#c8303c"; wg.fillRect(bx, by, Math.max(1, Math.round((w * mob.hp) / max)), 2);
      }
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (w) drawChar(w.sprite, x, y, o.p.dir, o.p.walk, o.p.moving, o.p.atkT, t, o.p.dead ? 0.4 : 1, w.wid);
    } else if (o.me) {
      const w = G.who.get(G.you);
      if (w) drawChar(w.sprite, x, y, me.dir, me.walk, me.moving, me.atkT, t, me.dead ? 0.4 : t - me.hurtT < 110 ? 0.6 : 1, w.wid);
    }
  }

  // effects above everything
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    const k = (t - f.t0) / f.dur;
    if (k < 0) continue;
    if (k >= 1) { G.fx.splice(i, 1); if (f.then) f.then(); continue; }
    if (f.type === "slash") {
      const base = Math.atan2(FACE[f.dir][1], FACE[f.dir][0]);
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
      if (f.fill) { wg.fillStyle = f.col; wg.globalAlpha = (1 - k) * 0.35; groundEllipse(f.x, f.y, f.r * k); wg.fill(); }
      wg.globalAlpha = 1 - k;
      wg.strokeStyle = f.col; wg.lineWidth = 2;
      groundEllipse(f.x, f.y, f.r * k); wg.stroke();
      wg.lineWidth = 1; wg.globalAlpha = 1;
    } else if (f.type === "beam") {
      wg.globalAlpha = 1 - k; wg.strokeStyle = f.col; wg.lineWidth = 3;
      wg.beginPath(); wg.moveTo(f.x, f.y); wg.lineTo(f.x2, f.y2); wg.stroke();
      wg.strokeStyle = "#ffffff"; wg.lineWidth = 1;
      wg.beginPath(); wg.moveTo(f.x, f.y); wg.lineTo(f.x2, f.y2); wg.stroke();
      wg.globalAlpha = 1;
    } else if (f.type === "pillar") {
      const [x, y] = P(f.ent.x, f.ent.y);
      wg.globalAlpha = (1 - k) * 0.55; wg.fillStyle = "#fff08a";
      wg.fillRect(Math.round(x - 7), Math.round(y - 64), 14, 66);
      wg.fillStyle = "#ffffff"; wg.fillRect(Math.round(x - 3), Math.round(y - 64), 6, 66);
      wg.globalAlpha = 1;
      if (Math.random() < 0.6) sparkle(x, y - 12, "#ffd84a", 1);
    }
  }
  for (const p of G.parts) {
    wg.globalAlpha = clamp(p.life * 3, 0, 1);
    wg.fillStyle = p.col;
    wg.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  wg.globalAlpha = 1;
  wg.restore();
  lighting(t, list);
  if (G.flash > 0) { wg.fillStyle = `rgba(255,40,60,${G.flash * 0.3})`; wg.fillRect(0, 0, vw, vh); }

  renderText(t, list);
}

// Mood: each world has its own ambient darkness, and lamps, crystals, lit
// windows and the players themselves cut pools of light out of it.
const AMBIENT = { town: ["#141a38", 0.3], meadow: ["#1a2030", 0.1], forest: ["#06141c", 0.46], city: ["#080a22", 0.62], cave: ["#04030e", 0.7] };
const lightCv = document.createElement("canvas"), lg = lightCv.getContext("2d");
function lighting(t, list) {
  const [col, alpha] = AMBIENT[G.map.id] || AMBIENT.meadow;
  if (lightCv.width !== vw || lightCv.height !== vh) { lightCv.width = vw; lightCv.height = vh; }
  lg.globalCompositeOperation = "source-over";
  lg.clearRect(0, 0, vw, vh);
  lg.globalAlpha = alpha;
  lg.fillStyle = col;
  lg.fillRect(0, 0, vw, vh);
  lg.globalAlpha = 1;
  lg.globalCompositeOperation = "destination-out";
  const hole = (x, y, r, k = 1) => {
    const sx = x - cam.x, sy = y - cam.y;
    if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) return;
    const gr = lg.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    lg.fillStyle = gr;
    lg.fillRect(sx - r, sy - r, r * 2, r * 2);
  };
  if (alpha > 0.2) {
    for (const o of list) {
      if (o.me) hole(o.ix, o.iy - 10, 80, 0.9);
      else if (o.p) hole(o.ix, o.iy - 10, 66, 0.8);
      else if (o.s && o.s.glow) hole(o.s.cx, o.s.cy - 16, o.s.glow === "#ffe890" ? 64 : 36, 0.85 + 0.1 * Math.sin(t / 300 + o.s.cx));
      else if (o.s && o.s.win) hole(o.s.cx, o.s.cy - 10, 56, 0.5);
      else if (o.d && o.d.q) hole(o.ix, o.iy - 6, 18, 0.7);
    }
    for (const p of G.map.portals) { const [x, y] = P(p.x * T + 8, p.y * T + 8); hole(x, y, 44, 0.8); }
    for (const f of G.fx) if (f.type === "ring" || f.type === "proj") hole(f.type === "proj" ? f.x2 : f.x, f.type === "proj" ? f.y2 : f.y, 50, 0.6);
  }
  wg.drawImage(lightCv, 0, 0);
  // a soft vignette pulls the eye to the middle of the screen
  const v = wg.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.42)");
  wg.fillStyle = v;
  wg.fillRect(0, 0, vw, vh);
}

// crisp text on its own full-resolution canvas, positioned in projected space
let fontK = 1;
function label(str, ix, iy, col, size = 11, bg = false) {
  const S = scale * dpr;
  const x = Math.round((ix - cam.x) * S), y = Math.round((iy - cam.y) * S);
  const px = size * fontK;
  tg.font = `${px}px Galmuri${size >= 14 ? 14 : 11}, "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`;
  if (bg) {
    const w = tg.measureText(str).width + 10 * fontK;
    tg.fillStyle = "rgba(236,232,220,.95)";
    tg.fillRect(x - w / 2, y - px - 3 * fontK, w, px + 6 * fontK);
    tg.fillStyle = "#08090c";
    tg.fillRect(x - w / 2, y + 3 * fontK, w, fontK);
    tg.fillRect(x - 2 * fontK, y + 4 * fontK, 4 * fontK, 2 * fontK);
    tg.fillText(str, x, y);
    return;
  }
  tg.fillStyle = "#08090c";
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
  const m = G.map;
  const top = Art.CHAR_H + 3;
  const myParty = G.who.get(G.you)?.party;

  for (const p of m.portals) {
    if (p !== m.portals.find((q) => q.to === p.to)) continue;
    const [x, y] = P(p.x * T + 8, p.y * T + 8);
    label(`▸ ${p.to}`, x, y - 16, "#e0c8ff");
  }
  for (const o of list) {
    if (o.n) {
      label(o.n.name, o.ix, o.iy - top, "#e8c860");
      if (o.n.role === "elder" && G.self) {
        const q = G.self.q, quest = G.defs.quests[q.i];
        const mark = !quest ? "" : q.st === 0 ? "!" : q.n >= quest.n ? "?" : "";
        if (mark) label(mark, o.ix, o.iy - top - 11 + Math.sin(t / 200) * 2, mark === "!" ? "#ffd84a" : "#8cff8c", 14);
      }
    } else if (o.mob) {
      const d = G.defs.mobs[o.mob.k];
      if (d.boss || o.mob.el || o.mob.hp < mobMax(o.mob)) {
        const art = mobArt[d.sp];
        label(`Lv.${d.lv} ${o.mob.el ? "정예 " : ""}${d.name}`, o.ix, o.iy - art.frames[0].height - 7 - art.lift, d.boss ? "#ff9ae0" : o.mob.el ? "#ffbe3c" : "#e8d8d8");
      }
    } else if (o.d) {
      if (o.d.q) label(G.defs.items[o.d.it].name, o.ix, o.iy - 16, Art.RARITY_COL[o.d.q]);
    } else if (o.p) {
      const w = G.who.get(o.eid);
      if (w) label(`Lv.${w.lvl} ${w.name}`, o.ix, o.iy - top, o.p.dead ? "#9a9aa8" : w.party && w.party === myParty ? "#8cff8c" : "#d8e4f0");
    } else if (o.me) {
      const w = G.who.get(G.you);
      if (w) label(`Lv.${w.lvl} ${w.name}`, o.ix, o.iy - top, "#f0e0a8");
    }
  }
  for (const [eid, b] of G.bubbles) {
    if (t > b.until) { G.bubbles.delete(eid); continue; }
    const p = entityPos(eid);
    if (!p) continue;
    const [x, y] = P(p.x, p.y);
    label(b.text.length > 22 ? b.text.slice(0, 22) + "…" : b.text, x, y - top - 14, "#08090c", 11, true);
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
  const m = G.map;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  g.imageSmoothingEnabled = false;
  // the same diamond projection as the world, one pixel per tile
  g.setTransform(0.5, 0.25, -0.5, 0.25, m.h, 0);
  g.drawImage(mini, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const dot = (x, y, col, r = 2) => { g.fillStyle = col; g.fillRect(Math.round((x - y) / T + m.h - r / 2), Math.round((x + y) / (2 * T) - r / 2), r, r); };
  for (const p of m.portals) dot(p.x * T + 8, p.y * T + 8, "#e080ff", 3);
  for (const n of m.npcs) dot(n.x * T + 8, n.y * T + 8, "#ffd84a", 3);
  for (const mob of G.mobs.values()) dot(mob.x, mob.y, mob.el ? "#ffbe3c" : "#ff5050");
  for (const p of G.players.values()) dot(p.x, p.y, "#7ad8ff", 3);
  dot(G.me.x, G.me.y, Math.floor(t / 300) % 2 ? "#ffffff" : "#08090c", 3);
  $("#mini-info").textContent = `${channelName()} · ${G.who.size}명`;
}

// ───────────────────────────── HUD & windows ─────────────────────────────

const WIN = ["inv", "char", "shop", "smith", "quest", "rank", "talk", "help", "train", "party"];
const isOpen = (id) => !$(`#w-${id}`).hidden;
function openWin(id) {
  $(`#w-${id}`).hidden = false;
  if (id === "rank") { $("#rank-list").textContent = "불러오는 중…"; act({ t: "rank" }); }
  if (id === "party") renderParty();
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
  return p;
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
  if (entry.q) d.classList.add(`q${entry.q}`);
  if (entry.sk) { const pips = el("span", "sk"); for (let i = 0; i < entry.sk; i++) pips.append(el("i", entry.ru && entry.ru[i] ? "on" : "")); d.append(pips); }
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
const GEAR = ["weapon", "armor", "acc"];
const SLOT_NAME = { weapon: "무기", armor: "방어구", acc: "장신구" };
const isGear = (id) => GEAR.includes(G.defs.items[id].type);
function runewordOf(g) {
  if (!g.sk || !g.ru || g.ru.length !== g.sk) return null;
  return G.defs.runewords.find((rw) => rw.seq.length === g.sk && rw.seq.every((r, i) => g.ru[i] === r)) || null;
}
/** "+3 맹렬한 강철 양손검" — the first affix lends the item its prefix. */
function itemName(entry) {
  const it = G.defs.items[entry.id];
  const prefix = entry.af && entry.af.length ? G.defs.affix[entry.af[0][0]][1] + " " : "";
  return (entry.enh > 0 ? `+${entry.enh} ` : "") + prefix + it.name;
}
function itemDesc(entry) {
  const it = G.defs.items[entry.id];
  const e = entry.enh || 0;
  if (it.type === "weapon") return `공격력 +${Math.round(it.atk * (1 + 0.1 * e))} · ${G.defs.classes[it.cls].name} 전용 · Lv.${it.req}`;
  if (it.type === "armor") return `방어력 +${Math.round(it.def * (1 + 0.1 * e))} · HP +${it.hp + e * 10} · Lv.${it.req}`;
  if (it.type === "acc") return `장신구 · Lv.${it.req}`;
  if (it.type === "rune") { const r = G.defs.runes[it.rune]; return `${G.defs.affix[r[1]][0]} +${r[2]} — 장착한 장비의 홈에 끼웁니다.`; }
  return it.desc || "";
}
/** The full tooltip: base line, rolled affixes, sockets, runeword. */
function describe(entry, host) {
  const it = G.defs.items[entry.id];
  const nm = el("div", "nm", itemName(entry));
  nm.style.color = Art.RARITY_COL[entry.q || 0];
  host.append(nm);
  if (isGear(entry.id)) host.append(el("div", "rar", `${G.defs.rarity[entry.q || 0]} ${SLOT_NAME[it.type]}`));
  host.append(el("div", "ds", itemDesc(entry)));
  for (const [k, v] of entry.af || []) host.append(el("div", "af", `${G.defs.affix[k][0].replace(" %", "")} +${v}${G.defs.affix[k][0].includes("%") ? "%" : ""}`));
  if (entry.sk) {
    const names = [];
    for (let i = 0; i < entry.sk; i++) { const r = entry.ru && entry.ru[i]; names.push(r ? G.defs.runes[r][0] : "빈 홈"); }
    host.append(el("div", "so", `홈 ${entry.sk}개 [ ${names.join(" · ")} ]`));
    for (const r of entry.ru || []) if (r) host.append(el("div", "af", `${G.defs.affix[G.defs.runes[r][1]][0].replace(" %", "")} +${G.defs.runes[r][2]}${G.defs.affix[G.defs.runes[r][1]][0].includes("%") ? "%" : ""}`));
    const rw = runewordOf(entry);
    if (rw) host.append(el("div", "rw", `룬어 「${rw.name}」 ${rw.add.map(([k, v]) => `${G.defs.affix[k][0].replace(" %", "")} +${v}`).join(", ")}`));
  }
}
function sellPrice(entry) {
  const it = G.defs.items[entry.id];
  if (!isGear(entry.id)) return Math.floor(it.price * 0.4);
  return Math.floor(it.price * 0.25 * (1 + 0.8 * (entry.q || 0)) * (1 + 0.3 * (entry.enh || 0)));
}

function refreshUi() {
  const s = G.self;
  if (!s) return;
  const it = G.defs.items;
  $("#st-name").textContent = s.name;
  $("#st-lv").textContent = `Lv.${s.lvl} ${G.defs.classes[s.cls].name}`;
  const maxed = s.lvl >= G.defs.maxLv;
  $("#exp-fill").style.width = maxed ? "100%" : `${Math.min(100, (s.xp / s.need) * 100)}%`;
  $("#exp-text").textContent = maxed ? `수련 경험치 ${s.xp.toLocaleString()}` : `EXP ${s.xp.toLocaleString()} / ${s.need.toLocaleString()} (${((s.xp / s.need) * 100).toFixed(1)}%)`;
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
    qt.append(el("b", "", `[의뢰] ${quest.title}`), el("br"), el("span", done ? "done" : "", done ? "완료! 관리자에게 돌아가세요" : `${G.defs.mobs[quest.mob].name} ${s.q.n} / ${quest.n}`));
  } else if (quest) {
    qt.append(el("b", "", "[의뢰]"), " 관리자 엘더윈에게 새 의뢰가 있습니다");
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
      describe(entry, det);
      const btns = el("div", "btns");
      const add = (label, fn, off) => { const b = el("button", "", label); b.disabled = !!off; b.addEventListener("click", fn); btns.append(b); };
      if (d.type === "pot") add("사용", () => act({ t: "use", id: entry.id }));
      if (isGear(entry.id)) add("장착", () => { act({ t: "eq", s: G.sel }); G.sel = -1; }, (d.cls && d.cls !== s.cls) || s.lvl < d.req);
      if (d.type === "rune") {
        let any = false;
        for (const k of GEAR) {
          const g = s.eq[k];
          for (let i = 0; g && i < g.sk; i++) {
            any = true;
            const cur = g.ru && g.ru[i];
            add(`${SLOT_NAME[k]} 홈 ${i + 1}${cur ? ` (${G.defs.runes[cur][0]} 교체)` : ""}`, () => { act({ t: "rune", s: G.sel, k, i }); });
          }
        }
        if (!any) btns.append(el("span", "ds", "홈이 있는 장비를 장착해야 끼울 수 있습니다."));
      }
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
    cg.clearRect(0, 0, 16, 26);
    if (w) cg.drawImage(w.sprite[0][0], 0, 0);
    $("#char-title").textContent = `${s.name} · Lv.${s.lvl} ${G.defs.classes[s.cls].name}`;
    for (const k of GEAR) {
      const host = $(`#eq-${k}`);
      const slot = itemSlot(s.eq[k], s.eq[k] ? () => act({ t: "uneq", k }) : null);
      slot.id = `eq-${k}`;
      slot.title = s.eq[k] ? `${itemName(s.eq[k])} (눌러서 해제)` : `${SLOT_NAME[k]} 없음`;
      if (!s.eq[k]) slot.append(el("span", "ph", SLOT_NAME[k]));
      host.replaceWith(slot);
    }
    const st = $("#char-stats");
    st.textContent = "";
    for (const [k, v] of [["공격력", s.atk], ["방어력", s.def], ["최대 HP", s.mhp], ["최대 MP", s.mmp], ["치명타", `${s.crit}%`], ["치명타 피해", `${s.critd}%`], ["흡혈", `${s.ls}%`], ["경험치 보너스", `${s.xpb}%`], ["아이템 발견", `${s.mf}%`], ["처치 수", s.kills],
      ["수련 · 힘", s.tr.str], ["수련 · 체력", s.tr.vit], ["수련 · 지력", s.tr.int], ["수련 · 수호", s.tr.grd]]) {
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
      tx.style.color = Art.RARITY_COL[g.q || 0];
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

  if (isOpen("train")) {
    const list = $("#train-list");
    list.textContent = "";
    $("#train-xp").textContent = `보유 경험치 ${s.xp.toLocaleString()}`;
    for (const k of Object.keys(G.defs.train)) {
      const d = G.defs.train[k];
      const row = el("div", "it");
      const tx = el("div", "tx", `${d.name}  ${s.tr[k]}`);
      tx.append(el("small", "", `${d.desc} · 1회 ${s.trc[k][0].toLocaleString()} EXP`));
      row.append(tx);
      for (const [n, cost] of [[1, s.trc[k][0]], [10, s.trc[k][1]]]) {
        const b = el("button", "", `+${n}`);
        b.disabled = s.xp < cost;
        b.title = `${cost.toLocaleString()} EXP`;
        b.addEventListener("click", () => act({ t: "train", k, n }));
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
      if (!atElder) { b.disabled = true; btns.append(b, el("span", "ds", " 관리자 엘더윈 근처에서만 가능합니다")); }
      else btns.append(b);
      body.append(btns);
    }
  }
}

// ── party ──
function renderPartyHud() {
  const box = $("#party-hud");
  box.textContent = "";
  for (const [eid, name, cls, lvl, hp, mhp, where] of G.party) {
    if (eid === G.you) continue;
    const row = el("div", "pm");
    row.append(el("span", "", `Lv.${lvl} ${name}${where ? ` · ${where}` : ""}`));
    const bar = el("div", "bar hp"), fill = el("i");
    fill.style.width = `${clamp((hp / mhp) * 100, 0, 100)}%`;
    bar.append(fill);
    row.append(bar);
    box.append(row);
  }
}
function renderParty() {
  const box = $("#party-body");
  box.textContent = "";
  const mine = G.party.length > 0;
  box.append(el("p", "say", mine ? `파티원 ${G.party.length} / ${G.defs.partyMax} — 함께 잡으면 모두가 경험치와 전리품을 얻고, 인원이 많을수록 총 경험치가 늘어납니다.` : "파티에 속해 있지 않습니다. 주변의 모험가를 초대해 보세요. 강한 적과 정예 몬스터는 파티로 잡는 것이 훨씬 빠릅니다."));
  const list = el("div", "list");
  for (const [eid, name, cls, lvl, hp, mhp, where] of G.party) {
    const row = el("div", "rk" + (eid === G.you ? " me" : ""));
    row.append(el("b", "", name), el("span", "", `Lv.${lvl} ${G.defs.classes[cls].name}${where ? ` · ${where}` : ` · HP ${hp}/${mhp}`}`));
    list.append(row);
  }
  const inParty = new Set(G.party.map((m) => m[0]));
  const myParty = G.who.get(G.you)?.party;
  let near = 0;
  for (const [eid, w] of G.who) {
    if (eid === G.you || inParty.has(eid)) continue;
    near++;
    const row = el("div", "it");
    row.append(el("div", "tx", `Lv.${w.lvl} ${w.name} · ${G.defs.classes[w.cls].name}`));
    const b = el("button", "", w.party ? "다른 파티" : "초대");
    b.disabled = !!w.party || G.party.length >= G.defs.partyMax;
    b.addEventListener("click", () => { act({ t: "pinv", e: eid }); Sound.play("ui"); });
    row.append(b);
    list.append(row);
  }
  if (!near) list.append(el("div", "ds", "같은 지역에 초대할 수 있는 모험가가 없습니다."));
  box.append(list);
  if (mine || myParty) {
    const btns = el("div", "btns");
    const b = el("button", "", "파티 탈퇴");
    b.addEventListener("click", () => act({ t: "pleave" }));
    btns.append(b);
    box.append(btns);
  }
}
function renderInvite() {
  const box = $("#invite");
  box.hidden = !G.pinv;
  if (!G.pinv) return;
  $("#invite-text").textContent = `${G.pinv}님이 파티에 초대했습니다.`;
  Sound.play("ok");
}
$("#invite-yes").addEventListener("click", () => act({ t: "pacc" }));
$("#invite-no").addEventListener("click", () => act({ t: "pdec" }));

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
  warrior: "전사 · 양손검 — 파티의 방패. 대검의 궤적이 주변 적까지 베고, 전투함성으로 파티 전체의 공격력을 올립니다.",
  rogue: "도적 · 단검 — 가장 빠른 공격과 높은 치명타. 그림자 도약으로 적의 등 뒤를 잡고 연막으로 빠져나옵니다.",
  ranger: "레인저 · 총 — 다른 세계의 화기를 다루는 원거리 딜러. 관통탄과 수류탄으로 무리를 정리합니다.",
  mage: "마도사 · 지팡이 — 광역 마법과 치유. 체력은 약하지만 파티의 생존을 책임집니다.",
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
  Art.charSprite(Art.playerLook("ranger", [2, 1, 0], 0)), Art.charSprite(Art.playerLook("rogue", [1, 2, 0], 0)),
];
function renderTitle(t) {
  const s = Math.max(2, Math.round(Math.min(innerWidth / 300, innerHeight / 180)));
  const w = Math.ceil(innerWidth / s), h = Math.ceil(innerHeight / s);
  if (tcv.width !== w || tcv.height !== h) { tcv.width = w; tcv.height = h; }
  tgx.imageSmoothingEnabled = false;
  const sky = tgx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#05060c"); sky.addColorStop(0.6, "#1a1c38"); sky.addColorStop(1, "#6a3a3a");
  tgx.fillStyle = sky; tgx.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(Art.hash(i, 1) * w), y = Math.floor(Art.hash(i, 2) * h * 0.55);
    tgx.fillStyle = Math.sin(t / 400 + i) > 0.2 ? "#ffffff" : "#9fb8ff";
    tgx.fillRect(x, y, 1, 1);
  }
  const gy = h - 34;
  tgx.fillStyle = "#16261e";
  for (let x = 0; x < w; x++) { const hh = 14 + Math.sin(x / 23) * 8 + Math.sin(x / 7) * 2; tgx.fillRect(x, gy - hh, 1, hh); }
  tgx.fillStyle = "#2c4a2a"; tgx.fillRect(0, gy, w, 34);
  tgx.fillStyle = "#223a22"; for (let x = 0; x < w; x += 5) tgx.fillRect(x + ((x * 7) % 3), gy + 3 + ((x * 13) % 26), 2, 1);
  tgx.fillStyle = "#5a4a34"; tgx.fillRect(0, gy + 14, w, 9);
  for (let i = 0; i < Math.ceil(w / 70) + 1; i++) {
    const x = ((i * 70 - (t / 40) % 70) + 70) % (w + 70) - 35;
    tgx.drawImage(i % 2 ? scenery.T : scenery.P, Math.round(x), gy - (i % 2 ? 26 : 30));
  }
  const cx = Math.round(w / 2);
  parade.forEach((sp, i) => tgx.drawImage(sp[2][1 + (Math.floor(t / 160) % 2)], cx - 50 + i * 20, gy - 4));
  const sl = mobArt.slime.right[Math.floor(t / 300) % 2];
  tgx.drawImage(sl, cx + 34, gy + 4 - Math.abs(Math.round(Math.sin(t / 250) * 5)));
  tgx.drawImage(mobArt.bslime.right[Math.floor(t / 300 + 1) % 2], cx + 54, gy + 4 - Math.abs(Math.round(Math.sin(t / 250 + 1) * 5)));
}
function renderCreate(t) {
  const g = $("#create-cv").getContext("2d");
  g.clearRect(0, 0, 16, 26);
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
window.__game = { G, act, go: (wx, wy) => { G.path = pathTo(wx, wy); return !!G.path; } };
