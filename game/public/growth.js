/**
 * The browser side of growing a character and of the comforts of a long hunt,
 * modelled on what Korean MMORPGs settled on long ago:
 *
 *   - skill levels raised at the trainer (바람의나라 수련 · 메이플 마스터리),
 *     and the effects of the second-tier skills and the ultimates;
 *   - the warehouse window (창고: sixty slots and a purse per character);
 *   - pet icons and the pet running for loot (메이플 펫);
 *   - scrolls of blessing in the buff row, the revive feather on the death panel;
 *   - the loot filter (labels and what the pet fetches), auto-potion thresholds,
 *     picking the right size of potion, and selling every plain piece at once.
 *
 * client.js calls in here at a handful of points (see `init`); the rules
 * themselves live on the server, which checks everything sent from here.
 */
import { Sound } from "./audio.js";
import * as SP from "./sprites.js";

/** What client.js lends us: its state, its helpers, its windows. */
let C = null;
const $ = (s) => document.querySelector(s);

export function init(ctx) {
  C = ctx;
  // the death panel: back in town (costs experience) or up where you fell (costs a feather)
  $("#b-feather").addEventListener("click", () => C.act({ t: "respawn", here: true }));
  // settings kept with the character
  const send = (o) => { C.act({ t: "opt", ...o }); Sound.play("ui"); };
  $("#opt-filter").addEventListener("change", (e) => send({ filter: +e.target.value }));
  for (const [id, key] of [["#opt-ahp", "ahp"], ["#opt-amp", "amp"]]) {
    const inp = $(id);
    inp.addEventListener("input", () => { $(`${id}-v`).textContent = pctText(+inp.value); });
    inp.addEventListener("change", () => send({ [key]: +inp.value }));
  }
}
const pctText = (v) => (v > 0 ? `${v}% 이하` : "끔");

// ───────────────────────────── item icons ─────────────────────────────
// 16×16, side view, one dark outline, light from the upper left — as the shop's other wares.

const OUT = "#111118";
function canvas16() {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function outline(c, g) {
  const src = g.getImageData(0, 0, 16, 16).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && src[(y * 16 + x) * 4 + 3] > 0;
  g.fillStyle = OUT;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
}
/** A square-shouldered flask with a gold band: the concentrated potions. */
function flask(liquid, light) {
  const [c, g] = canvas16();
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  r(6, 1, 4, 2, "#7a5430");
  r(6, 3, 4, 2, "#c8d8e0");
  r(4, 5, 8, 1, "#f0c040");
  r(3, 6, 10, 8, "#c8d8e0"); r(4, 14, 8, 1, "#c8d8e0");
  r(4, 7, 8, 7, liquid); r(5, 14, 6, 0, liquid);
  r(4, 8, 1, 3, light); r(5, 7, 1, 1, light);
  r(11, 10, 1, 3, "#00000033".slice(0, 7));
  outline(c, g);
  return c;
}
/** A rolled scroll with a coloured seal. */
function scroll(seal, light) {
  const [c, g] = canvas16();
  const r = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  r(3, 3, 10, 10, "#ecdcac"); r(11, 4, 2, 9, "#cdb27a");
  r(2, 2, 12, 2, "#d8c088"); r(2, 12, 12, 2, "#d8c088"); r(2, 3, 12, 1, "#b8985a"); r(2, 13, 12, 1, "#b8985a");
  r(5, 5, 6, 1, "#a08858"); r(5, 10, 4, 1, "#a08858");
  r(7, 6, 3, 3, seal); r(8, 9, 1, 1, seal); r(7, 6, 1, 1, light);
  outline(c, g);
  return c;
}
/** A white feather lying corner to corner. */
function feather() {
  const [c, g] = canvas16();
  for (let i = 0; i < 10; i++) {
    const cx = 4 + i, cy = 12 - i, w = i < 1 ? 0 : i < 7 ? 2 : 1;
    for (let j = -w; j <= w; j++) { g.fillStyle = j > 0 ? "#c4bcd8" : "#f6f2ea"; g.fillRect(cx + j, cy + j, 1, 1); }
  }
  g.fillStyle = "#b08a5a";
  for (let i = 0; i < 12; i++) g.fillRect(2 + i, 14 - i, 1, 1);
  g.fillStyle = "#ffffff"; g.fillRect(9, 6, 1, 1);
  outline(c, g);
  return c;
}
/** A pet's icon: its resting frame, cut to the middle of its sheet. */
function petIcon(kind) {
  const [c, g] = canvas16();
  g.drawImage(SP.petSheet(kind)[0], 8, 13, 16, 16, 0, 0, 16, 16);
  return c;
}
function mirrored(src) {
  const [c, g] = canvas16();
  g.translate(16, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}
/** Add icons for the wares this module brought in to the set client.js built. */
export function icons(set) {
  const add = {
    hp_l: flask("#b8303c", "#f09aa0"), mp_l: flask("#3058c0", "#9ab4f0"),
    recall: scroll("#7a5ad8", "#c8b0ff"),          // the return scroll never had an icon of its own
    sc_atk: scroll("#d84a3a", "#ff9a8a"), sc_def: scroll("#3a6ad8", "#9ab8ff"), sc_xp: scroll("#3aa84a", "#9ae8a0"),
    feather: feather(), pet_chick: petIcon("pet_chick"), pet_bat: petIcon("pet_bat"), pet_wisp: petIcon("pet_wisp"),
  };
  for (const id of Object.keys(add)) {
    if (set.cv[id]) continue;
    set.cv[id] = add[id]; set.url[id] = add[id].toDataURL(); set.left[id] = mirrored(add[id]);
  }
  return set;
}

// ───────────────────────────── effects ─────────────────────────────

/** The second-tier skills and the ultimates: `kind` 25–32 of an "a" event. */
export function skillFx(kind, src, tx, ty, ang, S3) {
  const f = S3.fx;
  switch (kind) {
    case 25: f.storm(src.x, src.y, 54, "#d8e8ff"); f.ring(src.x, src.y, 54, "#ffffff", 300); S3.shake(2); Sound.play("swing"); break;
    case 26: f.crack(src.x, src.y, 84); f.ring(src.x, src.y, 84, "#ffb04a", 420, true); f.ring(src.x, src.y, 60, "#ffffff", 260); f.burst(src.x, src.y, 0.2, "#e0b070", 40, 3.2); S3.shake(10); Sound.play("boom"); break;
    case 27: f.storm(src.x, src.y, 30, "#c890ff", 360, 3); f.burst(src.x, src.y, 0.6, "#6a4a9a", 22, 1.8); Sound.play("swing"); break;
    case 28: f.slash(tx, ty, ang + 0.8, "#ff3a5a", 1.3); f.slash(tx, ty, ang - 0.8, "#ff3a5a", 1.3, true); f.spark(tx, ty, "#ffd0d8", 2); f.burst(tx, ty, 0.5, "#ff3a5a", 18, 2.4); S3.shake(7); Sound.play("crit"); break;
    case 29: f.burst(src.x, src.y, 0.2, "#d0f0e8", 18, 2.4); f.ring(src.x, src.y, 22, "#d0f0e8", 260); S3.shake(3); Sound.play("swing"); break;
    case 30: f.fall(tx, ty, "#ffd84a", 480); f.fall(tx - 22, ty + 8, "#ffe9a0", 900); f.fall(tx + 20, ty - 6, "#ffe9a0", 1350); Sound.play("magic"); break;
    case 31: f.sparkle(src.x, src.y, 0.8, "#bfe8ff", 14); Sound.play("magic"); break;
    case 32: f.snow(tx, ty, 76, 3800); f.ring(tx, ty, 76, "#cfeaff", 600, true); Sound.play("ice"); break;
  }
}
/** A skill's lasting zone going off: 4 the blade storm, 5 the blizzard, 6 the dragon's spear. */
export function zoneFx(e, S3) {
  const [, x, y, r, kind] = e, f = S3.fx;
  if (kind === 4) f.storm(x, y, r, "#d8e8ff", 380, 4);
  else if (kind === 5) { f.ring(x, y, r, "#cfeaff", 300); f.sparkle(x, y, 0.3, "#ffffff", 10); }
  else if (kind === 6) { f.fall(x, y, "#ffd84a", 220); f.crack(x, y, r * 0.8, "#ffd84a", 600); S3.shake(5); }
}
/** Something crossing from one point to another: 2 a chain-lightning hop, 3 a phantom's dash. */
export function lineFx(e, S3) {
  const [, ax, ay, bx, by, kind] = e, f = S3.fx;
  if (kind === 2) { f.bolt(ax, ay + 8, bx, by + 8); f.spark(bx, by + 6, "#bfe8ff", 1.4); Sound.play("magic"); }
  else { f.beam(ax, ay + 8, bx, by + 8, "#a070e0", 0.5); f.slash(bx, by + 6, Math.atan2(by - ay, bx - ax), "#c890ff", 0.7); }
}

// ───────────────────────────── potions ─────────────────────────────

const POTS = { hp: ["hp_s", "hp_m", "hp_l"], mp: ["mp_s", "mp_m", "mp_l"] };
/** The potion that fits: the smallest one that covers most of what is missing, else the biggest at hand. */
export function pickPotion(kind, missing) {
  const s = C.G.self, it = C.G.defs.items;
  const owned = POTS[kind].filter((id) => it[id] && C.countItem(id) > 0);
  if (!owned.length) return null;
  const amount = (id) => (kind === "hp" ? it[id].heal + s.mhp * (it[id].pct || 0) : it[id].mana);
  return owned.find((id) => amount(id) >= missing * 0.7) || owned[owned.length - 1];
}
/** Every potion of a kind in the bag, and the icon to show for them. */
export function potionCount(kind) {
  let n = 0, show = null;
  for (const id of POTS[kind]) { const k = C.countItem(id); n += k; if (k && !show) show = id; }
  return [n, show || POTS[kind][0]];
}
/** Drink by the thresholds the player set, if there is anything to drink. */
export function autoPotion() {
  const G = C.G, s = G.self;
  if (!s || !s.opt || G.me.dead) return;
  if (s.opt.ahp > 0 && G.me.hp < (s.mhp * s.opt.ahp) / 100 && potionCount("hp")[0] > 0) C.usePotion("hp");
  if (s.opt.amp > 0 && G.me.mp < (s.mmp * s.opt.amp) / 100 && potionCount("mp")[0] > 0) C.usePotion("mp");
}

// ───────────────────────────── loot filter ─────────────────────────────

/** Whether a drop on the ground gets its name shown: everything, magic and better, or rare and better. */
export function showDrop(d) {
  const f = (C.G.self && C.G.self.opt && C.G.self.opt.filter) | 0;
  return (d.q | 0) >= f && (f > 0 || d.it === "gold" || !!C.G.defs.items[d.it]);
}
export const dropName = (d) => (d.it === "gold" ? "골드" : C.G.defs.items[d.it].name);

// ───────────────────────────── the player's sheet changed ─────────────────────────────

/** One line of advice under "쓰러졌습니다", from what did it and what the bag holds. */
function deathTip(s) {
  const d = s.dead, hp = (s.inv || []).some((e) => e && C.G.defs.items[e.id] && C.G.defs.items[e.id].type === "pot" && /^hp_/.test(e.id));
  if (d.el >= 2) return "우두머리는 혼자 상대하기 어렵습니다 — 파티를 맺어 도전하세요.";
  if (d.lv >= s.lvl + 12) return `나보다 ${d.lv - s.lvl}레벨 높은 상대입니다. 입구 쪽 약한 몬스터부터 사냥하세요.`;
  if (!hp) return "빨간 물약이 없었습니다. 보급상 리나에게서 넉넉히 사 두세요.";
  if (d.el === 1) return "정예는 일반 몬스터보다 훨씬 셉니다. 체력이 줄면 물러서세요.";
  return "체력이 줄면 물약(Q)을 마시고, 모닥불 곁에서 쉬어 가세요.";
}

export function onSelf(s) {
  // the death panel: what town costs, and whether there is a feather
  if (s.dead) {
    const pct = s.xp ? ((s.dead.loss / s.xp) * 100).toFixed(1) : "0";   // of the unspent experience
    $("#dead-loss").textContent = s.dead.loss > 0 ? `마을에서 부활하면 경험치 ${s.dead.loss.toLocaleString()} (${pct}%)를 잃습니다.` : "마을에서 부활합니다. (잃을 경험치가 없습니다)";
    // who did it, and a word of advice for next time
    const by = $("#dead-by");
    if (by) {
      by.hidden = !s.dead.by;
      by.textContent = s.dead.by ? `${s.dead.by}에게 쓰러졌습니다. ${deathTip(s)}` : "";
    }
    $("#b-feather").disabled = s.dead.feather < 1;
    $("#dead-feather").textContent = s.dead.feather > 0 ? `부활 깃털 ${s.dead.feather}개 — 그 자리에서 HP·MP 60%로 일어나며 경험치를 잃지 않습니다.` : "부활 깃털이 없습니다. (보급상 리나에게서 살 수 있습니다)";
  }
  // the settings window shows what the server keeps
  if (s.opt) {
    const f = $("#opt-filter");
    if (document.activeElement !== f && f.value !== String(s.opt.filter)) f.value = String(s.opt.filter);
    for (const [id, key] of [["#opt-ahp", "ahp"], ["#opt-amp", "amp"]]) {
      const inp = $(id);
      if (document.activeElement !== inp && +inp.value !== s.opt[key]) { inp.value = String(s.opt[key]); $(`${id}-v`).textContent = pctText(s.opt[key]); }
    }
  }
}

// ───────────────────────────── windows ─────────────────────────────

/** Plain gear: what "sell all" sells. */
const junk = (e) => C.isGear(e.id) && !(e.q | 0) && !(e.enh | 0) && !(e.ru || []).some(Boolean);
/** The shop's first row: sell every plain piece in the bag at once. */
export function shopTop(list, s) {
  const { el } = C;
  const items = s.inv.filter(junk);
  const gold = items.reduce((a, e) => a + C.sellPrice(e), 0);
  const row = el("div", "it sellall");
  const tx = el("div", "tx", "일반 장비 모두 팔기");
  tx.append(el("small", "", items.length ? `가방의 일반 등급 장비 ${items.length}개 · ${gold.toLocaleString()}G (강화·룬·마법 이상은 남깁니다)` : "팔 일반 장비가 없습니다"));
  const b = el("button", "", "모두 팔기");
  b.disabled = !items.length;
  b.addEventListener("click", () => { C.act({ t: "sellall" }); Sound.play("coin"); });
  row.append(tx, b);
  list.append(row);
}
/** The warehouse: the bag on the left, the store on the right, the purse below. */
export function renderBank(s) {
  const { el, G, iconImg, itemSlot, act } = C;
  const box = $("#bank-body");
  box.textContent = "";
  const wh = s.wh || { items: [], gold: 0 };
  const top = el("div", "bank-top");
  const g1 = el("span", "gold"); g1.append(iconImg("coin", "#e2c486"), `소지 ${s.gold.toLocaleString()} G`);
  const g2 = el("span", "gold"); g2.append(iconImg("coin", "#e2c486"), `보관 ${wh.gold.toLocaleString()} G`);
  top.append(g1, g2);
  box.append(top);
  const panes = el("div", "bank-panes");
  const pane = (title, list, size, a) => {
    const p = el("div", "pane");
    p.append(el("div", "pt", `${title}  ${list.length} / ${size}`));
    const grid = el("div", "grid bank-grid");
    for (let i = 0; i < size; i++) {
      const e = list[i];
      grid.append(e ? itemSlot(e, {
        onClick: (ev) => { act({ t: "wh", a, s: i, n: ev.shiftKey ? 1 : e.n || 1 }); Sound.play("item"); },
        hint: a === "put" ? "클릭: 맡기기 (Shift+클릭: 1개)" : "클릭: 찾기 (Shift+클릭: 1개)",
      }) : itemSlot(null));
    }
    p.append(grid);
    return p;
  };
  panes.append(pane("가방", s.inv, s.bagCap || G.defs.inv, "put"), pane("창고", wh.items, G.defs.whSlots, "take"));
  box.append(panes);
  const gl = el("div", "bank-gold");
  const inp = el("input");
  inp.type = "number"; inp.min = "1"; inp.step = "1"; inp.placeholder = "골드"; inp.id = "bank-amt";
  const btn = (label, sign) => {
    const b = el("button", "btn small", label);
    b.addEventListener("click", () => { const n = Math.floor(+inp.value || 0); if (n > 0) { act({ t: "wh", a: "gold", n: n * sign }); Sound.play("coin"); } });
    return b;
  };
  gl.append(inp, btn("맡기기", 1), btn("찾기", -1));
  box.append(gl);
  box.append(el("p", "hint", "같은 물건은 한 칸에 모입니다 (최대 99개). 창고는 캐릭터마다 따로이며, 맡긴 물건과 골드는 접속을 끊어도 남습니다."));
}
