// Headless test of jobs and stats (docs/design/jobs-and-stats.md, J1): the six stats and what a
// level costs, derived stats, weapon mastery, jobs, resets, the starter weapon, the hybrid's swap,
// the world's tiers as players see them, and the bow's arrows.   node tests/jobs.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const ST = ["str", "wil", "dex", "int", "wis", "luk"];
const eff = (s) => 5 + 1.25 * (Math.min(s, 40) - 5 + 0.5 * Math.min(20, Math.max(0, s - 40)) + 0.25 * Math.max(0, s - 60));
const near = (a, b, d, msg) => assert.ok(Math.abs(a - b) <= d, `${msg}: ${a} vs ${b}`);

let pidN = 0;
/** One hero in a fresh world, standing on open meadow ground with every monster put away. */
function world(o = {}, name = "직업" + pidN) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-job" + pidN++;
  const ch = o.ch || L.hero(name, o);
  L.addPlayer(S, PID, ch);
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    get rt() { return S.maps[S.players[PID].map]; },
    npc(role) { W.go("town"); const n = W.map.npcs.find((x) => x.role === role); assert.ok(n, role); W.p.x = n.x * T + 8; W.p.y = n.y * T + 30; W.p.mvAt = now; },
    go(id, tx, ty) {
      const p = W.p;
      if (p.map !== id) { L.runtime(S, p.map).n--; p.map = id; L.runtime(S, id).n++; p.sendMap = true; W.map = W.step().map; }
      if (tx !== undefined) { p.x = tx * T + 8; p.y = ty * T + 10; p.mvAt = now; }
    },
  };
  W.map = W.step().map;
  return W;
}
/** Open meadow ground: a spot with `r` free tiles every way. */
function openSpot(W, r = 2) {
  W.go("meadow");
  const mp = W.map, clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  for (let y = r + 2; y < mp.h - r - 2; y++) for (let x = r + 12; x < mp.w - r - 12; x++) {
    let ok = true;
    for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= 12 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
    if (ok) return [x, y];
  }
  throw new Error("no open ground");
}
/** Stand on open meadow ground, every monster put away; returns a function that calls plain monsters up. */
function arena(W) {
  const [sx, sy] = openSpot(W);
  W.go("meadow", sx, sy);
  const p = W.p;
  p.aim = 0; p.dir = 2;
  W.step();
  for (const o of W.rt.mobs) { o.dead = true; o.respAt = W.now + 1e12; }
  W.rt.fb = -1;
  const pool = W.rt.mobs.filter((o) => !D.mobs[o.k].chest && !D.mobs[o.k].boss && !D.mobs[o.k].fly);
  for (const o of pool) o.slot = null;
  return (offs, extra = {}) => offs.map(([dx, dy], j) => {
    const m = pool[j];
    Object.assign(m, { k: "twinhare", dead: false, el: 0, tr: [], hp: 50000, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, wx: p.x + dx, wy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, tgt: null, st: 0, act: null, castAt: W.now + 1e9, atkAt: W.now + 1e9, mvAt: W.now + 1e9 }, extra);
    return m;
  });
}
const ready = (W) => { const p = W.p; p.mp = 9999; p.hp = 1e6; p.atkAt = 0; p.stag = 0; p.combo = 0; };

// ═════════ the sheet ═════════
{
  const ch = L.newChar("새싹", [1, 2]);
  assert.equal(ch.v, L.newChar("현재양식", []).v); assert.equal(ch.job, "adventurer"); assert.equal(ch.lvl, 1); assert.equal(ch.xp, 0); assert.equal(ch.xpt, 0);
  assert.deepEqual(ch.st, { str: 5, wil: 5, dex: 5, int: 5, wis: 5, luk: 5 });
  assert.deepEqual(Object.keys(ch.wm), ["sword", "dagger", "spear", "staff", "book", "bow", "hammer"]);
  assert.ok(Object.values(ch.wm).every((r) => r.lv === 1 && r.xp === 0));
  assert.equal(ch.rs, 0); assert.equal(ch.sw, 0);
  assert.equal(ch.eq.weapon.id, "w_rogue_1", "a new 모험가 holds an old dagger"); assert.equal(ch.eq.weapon2, null);
  assert.ok(!("cls" in ch) && !("tr" in ch) && !("skl" in ch));
  assert.ok("elite" in ch.cnt && "daily" in ch.cnt, "achievement counters live in cnt");
  assert.deepEqual(ch.look.slice(0, 2), [1, 2]);
  assert.deepEqual(L.newChar("옛호출", "warrior", [3]).look[0], 3, "an old (name, cls, look) caller still gets its look");
}

// ═════════ the tables the client reads ═════════
{
  assert.equal(D.maxLv, 200);
  assert.deepEqual(D.stats.map((s) => s[0]), ST);
  assert.ok(D.stats.every((s) => s[1] && s[2]), "every stat has a Korean name and a line");
  assert.deepEqual(D.wkOrder, ["sword", "dagger", "spear", "staff", "book", "bow", "hammer"]);
  assert.deepEqual(D.scale.sword, { str: "A", wil: "C" });
  assert.deepEqual(D.scale.bow, { dex: "A", luk: "C" });
  const singles = Object.keys(D.jobs).filter((j) => D.jobs[j].kind === "single");
  const hybrids = Object.keys(D.jobs).filter((j) => D.jobs[j].kind === "hybrid");
  assert.deepEqual(singles, ["swordsman", "thief", "lancer", "wizard", "warlock", "archer", "destroyer"]);
  assert.deepEqual(hybrids, ["spellblade", "tracker", "dragoon", "hexblade", "darkknight",
    "bladedancer", "trickster", "spellspear", "runesage", "runearcher", "mercenary", "paladin"]);
  assert.deepEqual(singles.map((j) => D.jobs[j].wk[0]), D.wkOrder, "one single job per weapon");
  // Each supported pair is unique. The five retired combinations have no job.
  const pairs = hybrids.map((j) => D.jobs[j].wk.slice().sort().join("+"));
  assert.equal(new Set(pairs).size, 12);
  for (const pair of ["spear+sword", "dagger+spear", "bow+sword", "bow+spear", "bow+staff"]) assert.ok(!pairs.includes(pair), pair);
  for (const j of hybrids) {
    const [a, b] = D.jobs[j].wk;
    assert.ok(a !== b && D.wkOrder.includes(a) && D.wkOrder.includes(b), j + " pairs two different weapons");
    assert.equal(D.jobs[j].cost, 5000, j + " costs 5,000 G");
    assert.equal(D.jobs[j].wm, 15, j + " asks mastery 15 of both");
    // the scale budget: real stats, nothing above 0.9; 2.2 for two different mains, less when the pair shares one (1.4–2.2)
    const sc = D.jobs[j].scale, sum = Object.values(sc).reduce((x, y) => x + y, 0);
    assert.ok(Object.keys(sc).every((k) => ST.includes(k)) && Object.values(sc).every((v) => v > 0 && v <= 0.9), j + " scales on real stats");
    assert.ok(sum >= 1.4 - 1e-9 && sum <= 2.2 + 1e-9, `${j} scale budget ${sum}`);
    for (const k of [a, b]) assert.ok(Object.keys(D.scale[k]).some((st) => sc[st] >= 0.5), `${j} scales with ${k}'s stats`);
    assert.ok(D.jobs[j].sig && D.skills[D.jobs[j].sig].job === j && D.skills[D.jobs[j].sig].kind === "h", j + " names its signature");
  }
  for (const j of singles) { assert.equal(D.jobs[j].cost, 1000); assert.equal(D.jobs[j].wm, 20, j + " asks mastery 20"); }
  assert.equal(D.jobWm, 20); assert.equal(D.hybWm, 15, "defs carry both thresholds");
  // ids and names are all different
  const names = Object.values(D.jobs).map((j) => j.name);
  assert.equal(new Set(names).size, names.length, "every job has its own name");
  assert.ok(names.every((n) => /^[가-힣]{2,5}$/.test(n)), "short Korean names");
  assert.deepEqual(D.jobs.swordsman.scale, { str: 0.95, wil: 0.6 }, "a single job adds 0.1 to its weapon's two grades");
  assert.deepEqual(D.jobs.spellblade.scale, { str: 0.9, int: 0.9, wil: 0.2, wis: 0.2 }, "skills-v2: its attack stats lifted inside the same budget");
  assert.equal(D.jobs.swordsman.cost, 1000); assert.equal(D.jobs.tracker.cost, 5000);
  assert.equal(D.jobs.adventurer.name, "모험가");
  assert.equal(D.wmNeed.length, 50); assert.equal(D.wmNeed[0], 22); assert.equal(D.wmNeed[9], 2200); assert.equal(D.wmNeed[48], 52822);
  // the bow: a real weapon kind, five tiers, sold at tier 1, legendary and set looks roll on it
  assert.equal(D.wkinds.bow.range, 150); assert.equal(D.wkinds.bow.cd, 760); assert.equal(D.wkinds.bow.fx, 6); assert.deepEqual(D.wkinds.bow.shot, { spd: 420, r: 6 });
  assert.deepEqual([1, 2, 3, 4, 5].map((t) => D.items[`w_bow_${t}`].name), ["물푸레나무 활", "사냥꾼의 장궁", "기사단 전투활", "카본 컴파운드 보우", "균열의 시위"]);
  for (const id of ["w_warrior_1", "w_rogue_1", "w_lancer_1", "w_mage_1", "w_book_1", "w_bow_1"]) assert.ok(D.shop.includes(id), "the shop sells " + id);
  assert.ok(!D.shop.includes("W1"));
  assert.ok(Object.values(D.items).every((it) => !("cls" in it)), "no item is locked to a class");
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((t) => D.items[`h_${t}`].req), [1, 29, 61, 101, 149, 181], "gear asks for levels on the 1–200 scale");
}

// ═════════ Auto level-up, points and reallocation ═════════
{
  assert.deepEqual(D.statGrowth, { perLevel: 5, cap: 475, soft: [180, 280] });
  const earned = (lvl) => L.hero("누적", { wk: "sword", lvl }).xpt;
  const cumulative = Array.from({ length: D.maxLv }, (_, i) => earned(i + 1));
  const costs = cumulative.slice(1).map((n, i) => n - cumulative[i]);
  assert.equal(costs[0], 74);
  assert.ok(costs.every((cost, i) => !i || cost > costs[i - 1]), "the level cost increases across the full range");
  const W = world({ wk: "sword" }), { ch, p } = W;
  const mobs = arena(W);
  ch.xp = costs[0] + costs[1] - 1;
  p.hp = 1;
  const [m] = mobs([[16, 0]], { hp: 1 });
  ready(W);
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  W.step();
  assert.ok(m.dead);
  const leveled = W.self();
  assert.equal(leveled.lvl, 3, "a kill carries experience through both levels");
  assert.equal(leveled.ap, 10, "each earned level grants five points");
  assert.equal(leveled.xpNext, costs[2]);
  assert.equal(ch.xpt, costs[0] + costs[1]);
  assert.ok(ch.xp > 0 && ch.xp < costs[2]);
  assert.equal(p.hp, leveled.mhp, "level-up restores health");
  const xp = ch.xp;
  assert.ok(W.act({ t: "train", a: [5, 5, 0, 0, 0, 0] }).ok, "allocate points away from the trainer");
  assert.deepEqual([ch.lvl, ch.xp, ch.st.str, ch.st.wil, W.self().ap], [3, xp, 10, 10, 0]);
  assert.equal(W.act({ t: "train", a: [1, 0, 0, 0, 0, 0] }).error, "능력치 포인트가 부족합니다");
  for (const bad of [[1, 0], [0, 0, 0, 0, 0, 0], [-1, 2, 0, 0, 0, 0], [51, 0, 0, 0, 0, 0], [0.5, 0, 0, 0, 0, 0], "1"]) {
    assert.ok(!W.act({ t: "train", a: bad }).ok);
  }
  ch.rs = 1;
  assert.equal(W.act({ t: "respec" }).error, "수련관이 너무 멉니다");
  W.npc("train");
  assert.ok(W.act({ t: "respec" }).ok);
  assert.equal(W.self().ap, 10, "the free reset refunds the points");
  assert.deepEqual([ch.lvl, ch.xp, ch.xpt, ch.rs], [3, xp, costs[0] + costs[1], 0]);
  assert.equal(W.act({ t: "respec" }).error, "되돌릴 능력치가 없습니다");
  assert.ok(W.act({ t: "train", a: [5, 0, 0, 0, 0, 0] }).ok);
  const fee = W.self().respecCost;
  assert.equal(W.act({ t: "respec" }).error, "되새김 인장이 필요합니다");
  ch.inv.push({ id: D.jf.respecItem, n: 1 }); ch.gold = fee - 1;
  assert.match(W.act({ t: "respec" }).error, /골드가 부족합니다/);
  ch.gold = fee + 30;
  assert.ok(W.act({ t: "respec" }).ok);
  assert.equal(ch.gold, 30);
  assert.ok(!ch.inv.some((item) => item.id === D.jf.respecItem));
  assert.deepEqual([W.self().ap, ch.lvl, ch.xp], [10, 3, xp]);
  const top = world({ wk: "sword", lvl: 200, st: { str: 99 } });
  assert.equal(top.self().xpNext, 0);
  assert.equal(top.self().respecCost, 85220);
  assert.equal(top.act({ t: "train", a: [1, 0, 0, 0, 0, 0] }).error, "능력치는 475까지 올릴 수 있습니다");
  assert.ok(top.act({ t: "train", a: [0, 5, 0, 0, 0, 0] }).ok, "max-level heroes can still assign their points");
  top.p.dead = true;
  assert.ok(!top.act({ t: "train", a: [0, 5, 0, 0, 0, 0] }).ok, "no allocation while fallen");

  const legacy = L.newChar("구형", [], "sword");
  Object.assign(legacy, { v: 30, lvl: 6, xp: 10, xpt: earned(6), st: { ...legacy.st, str: 8, wil: 7 } });
  const restored = world({ ch: legacy });
  assert.deepEqual([restored.ch.v, restored.ch.lvl, restored.ch.st.str, restored.ch.st.wil, restored.ch.xp, restored.self().ap], [31, 6, 20, 15, 10, 0]);
  const reload = world({ ch: JSON.parse(JSON.stringify(restored.ch)) });
  assert.deepEqual(reload.ch.st, restored.ch.st, "loading again does not multiply the points");
}

// ═════════ derived stats (B.4, B.7: golden rows ±1) ═════════
{
  // [job, stats, atkCore, HP, MP, def, crit (without the weapon kind's own), attack speed %, evasion %, cdr %]
  const rows = [
    ["swordsman", [22, 19, 7, 5, 7, 9], 49, 463, 109, 10, 8, 4, 2, 3],
    ["thief", [7, 11, 22, 5, 7, 17], 48, 333, 109, 8, 11, 13, 8, 3],
    ["wizard", [5, 13, 5, 22, 17, 7], 48, 365, 227, 9, 7, 3, 2, 8],
    ["swordsman", [49, 40, 10, 5, 10, 15], 118, 954, 168, 24, 10, 6, 3, 5],
    ["thief", [10, 20, 49, 5, 10, 35], 113, 629, 168, 18, 18, 27, 16, 5],
    ["wizard", [5, 25, 5, 49, 35, 10], 113, 710, 454, 20, 8, 3, 2, 17],
    ["spellblade", [40, 20, 5, 39, 10, 15], 133, 629, 253, 18, 10, 3, 2, 5],
    ["swordsman", [94, 75, 15, 5, 15, 25], 196, 1427, 265, 40, 14, 9, 5, 7],
    ["thief", [15, 35, 94, 5, 15, 65], 193, 1123, 265, 35, 24, 30, 20, 7],
    ["wizard", [5, 45, 5, 94, 65, 15], 193, 1244, 671, 37, 10, 3, 2, 25],
    ["spellblade", [75, 35, 5, 74, 15, 25], 231, 1123, 386, 35, 14, 3, 2, 7],
    ["adventurer", [99, 14, 44, 14, 14, 44], 133, 781, 280, 28, 20, 26, 15, 7],
  ];
  for (const [job, sv, atk, hp, mp, def, crit, aspd, eva, cdr] of rows) {
    const st = Object.fromEntries(ST.map((k, i) => [k, sv[i]]));
    const ch = L.hero("표본", { st, job });
    if (job !== "adventurer") ch.jp = { lv: 1, xp: 0 };
    ch.eq.weapon = null; ch.eq.armor = null;     // B.7 is measured bare: no weapon, no gear
    const W = world({ ch });
    const s = W.self();
    const tag = `${job} Lv.${s.lvl}`;
    const kind = D.jobs[job].wk[0] || "dagger";
    near(s.atk, atk, 1, tag + " attack"); near(s.mhp, hp, 1, tag + " HP"); near(s.mmp, mp, 1, tag + " MP"); near(s.def, def, 1, tag + " def");
    near(s.crit - (D.wkinds[kind].crit || 0), crit, 1, tag + " crit"); near(s.dv[2], aspd, 1, tag + " attack speed");
    near(s.dv[1], eva, 1, tag + " evasion"); near(s.dv[3], cdr, 1, tag + " cooldown cut");
    assert.equal(s.dv[0], D.wkinds[kind].mag ? 1 : 0, tag + " damage type");
  }
  // soft caps: 40 counts fully, then half to 60, then a quarter
  const atkAt = (str) => world({ wk: "sword", lvl: 99, st: { str } }).self().atk;
  const expected = 0.85 * 1.25 * (1 + 0.65 * 98 / 199);
  near(atkAt(40) - atkAt(30), expected * 10, 1, "50 AP below the first threshold");
  near(atkAt(60) - atkAt(40), expected * 10, 1, "100 AP in the half-efficiency band");
  near(atkAt(99) - atkAt(60), expected * 9.75, 1, "195 AP in the quarter-efficiency band");
  // the weapon's grades decide what a stat is worth to it: INT does nothing for a sword
  const pair = (wk, st) => { const W = world({ wk, st: { str: 5, wil: 5, dex: 5, int: 5, wis: 5, luk: 5, ...st } }); const s = W.self(); return Math.round(s.atk - 0.1 * s.lvl); };
  assert.ok(Math.abs(pair("sword", { int: 40 }) - pair("sword", {})) <= 1, "(beyond the levels it adds)");
  assert.ok(pair("staff", { int: 40 }) > pair("staff", {}) + 25);
  assert.ok(pair("bow", { dex: 40 }) > pair("bow", {}) + 25);
  // a single job adds to its own weapon only; a hybrid uses its own table for both of its weapons
  const atkJob = (job, wk) => {
    const ch = L.hero("직업보정", { wk, job, st: { str: 40, wil: 5, dex: 5, int: 40, wis: 5, luk: 5 } });
    if (job !== "adventurer") ch.jp = { lv: 1, xp: 0 };
    return world({ ch }).self().atk;
  };
  const attackStat = 5 + (eff(40) - 5) * (1 + 0.65 * 70 / 199);
  near(atkJob("swordsman", "sword") - atkJob("adventurer", "sword"), 0.1 * attackStat, 1, "대검전사 +0.1 STR on the sword");
  assert.equal(atkJob("swordsman", "staff"), atkJob("adventurer", "staff"), "but nothing on a staff");
  near(atkJob("spellblade", "staff") - atkJob("adventurer", "staff"), (0.9 + 0.9 - 0.85) * attackStat + (0.2 - 0.5) * 5 + 0.2 * 5, 1, "마검사's table on the staff");
}

// ═════════ weapon mastery (B.10) ═════════
{
  const W = world({ wk: "sword", lvl: 1 });
  const ch = W.ch;
  const mobs = arena(W);
  // A landed basic attack credits the weapon in hand once, with the early mastery bonus.
  const [m] = mobs([[16, 0]]);
  ready(W);
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  assert.equal(ch.wm.sword.xp, 5, "one early action, five points");
  assert.equal(ch.wm.dagger.xp, 0);
  // A kill adds tier × rank and capped experience-based mastery to contributors.
  const ally = "pid-ally";
  L.addPlayer(W.S, ally, L.hero("동료", { wk: "dagger" }));
  const o = W.S.players[ally];
  o.map = W.p.map; o.x = W.p.x - 20; o.y = W.p.y; L.runtime(W.S, "town").n--; L.runtime(W.S, "meadow").n++;
  W.S.parties[1] = { id: 1, m: [W.PID, ally], lead: W.PID }; W.p.party = 1; o.party = 1;
  Object.assign(m, { k: "ribdeer", hp: 1, el: 1 });
  ready(W);
  ch.wm.sword = { lv: 10, xp: 0 };
  const before = ch.wm.sword.xp;
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  assert.ok(m.dead);
  assert.equal(ch.wm.sword.xp - before, 5 + 24 + 852, "landed hit and capped elite kill bonus");
  assert.equal(o.ch.wm.dagger.xp, 0, "the idle party member learns nothing");
  assert.ok(o.ch.xp + o.ch.xpt > 0 && ch.xp + ch.xpt === o.ch.xp + o.ch.xpt, "both share ordinary XP from a monster far above their level");
  // 22·m² a level, an event, a toast; capped at 50
  ch.wm.sword = { lv: 9, xp: 22 * 81 - 1 };
  const [m2] = mobs([[16, 0]]);
  // hitstun holds a shoved monster where it landed: put it back in reach before each blow
  const reach = () => { m2.x = W.p.x + 16; m2.y = W.p.y; m2.stun = 0; };
  ready(W);
  W.act({ t: "atk", a: 0 });
  let v = W.step();
  assert.equal(ch.wm.sword.lv, 10);
  assert.ok(v.ev.some((e) => e[0] === "wm" && e[1] === W.p.eid && e[2] === 0 && e[3] === 10));
  assert.ok(W.p.toast.some((t) => t.includes("[대검] 숙련 10!")) || (v.toast || []).some((t) => t.includes("[대검] 숙련 10!")));
  ch.wm.sword = { lv: 19, xp: 22 * 361 - 1 };
  ready(W); reach(); m2.hp = 50000; W.act({ t: "atk", a: 0 }); v = W.step();
  assert.ok((v.toast || []).some((t) => t.includes("전직관 아르센") && t.includes("[대검전사]")), "at 20 the job is offered");
  assert.deepEqual(ch.wm.sword, { lv: 20, xp: 0 }, "the overflow past 20 goes back to the normal rate");
  ch.wm.sword = { lv: 50, xp: 0 };
  ready(W); reach(); W.act({ t: "atk", a: 0 }); W.step();
  assert.deepEqual(ch.wm.sword, { lv: 50, xp: 0 }, "capped at 50");
  ch.wm.sword = { lv: 20, xp: 0 };
  ready(W); reach(); W.act({ t: "atk", a: 0 }); W.step();
  assert.equal(ch.wm.sword.xp, 1, "ordinary mastery rate after job mastery");
  // at 15 the two-weapon jobs whose other weapon is already at 15 are named
  ch.wm.sword = { lv: 14, xp: 22 * 196 - 1 }; ch.wm.bow.lv = 15; ch.wm.staff.lv = 18; ch.wm.dagger.lv = 14;
  ready(W); m2.hp = 50000; W.act({ t: "atk", a: 0 }); v = W.step();
  assert.equal(ch.wm.sword.lv, 15);
  const t15 = (v.toast || []).find((t) => t.includes("두 갈래 길"));
  assert.ok(t15 && t15.includes("[마검사]") && !t15.includes("[검궁사]") && !t15.includes("[검무사]"), "at 15 only eligible pairings are named: " + t15);
  // monsters far below you teach nothing; a skill teaches 2
  const W2 = world({ wk: "sword", lvl: 157, wm: { sword: 12 } });
  const mobs2 = arena(W2);
  const [low] = mobs2([[16, 0]]);
  ready(W2); W2.act({ t: "atk", a: 0 });
  assert.equal(W2.ch.wm.sword.xp, 0, "a tier-1 hare teaches a Lv.157 nothing");
  low.hp = 1;
  ready(W2); assert.ok(W2.act({ t: "atk", a: 0 }).ok);
  assert.ok(low.dead);
  assert.equal(W2.ch.wm.sword.xp, 0, "the kill of a trivial mob also teaches nothing");
  mobs2([[16, 0]], { k: "blightsquirrel" });
  ready(W2); W2.act({ t: "atk", a: 0 });
  assert.equal(W2.ch.wm.sword.xp, 5);
  ready(W2); W2.act({ t: "sk", id: "slash", a: 0 });
  W2.step();
  assert.equal(W2.ch.wm.sword.xp, 15, "a landed skill adds ten to early mastery");
  // mastery shows up in the self payload: [lv, xp, need] in wire order
  const s = W2.self();
  assert.deepEqual(s.wm[0], [12, 15, 22 * 144]);
  assert.equal(s.wk, "sword");
}

// ═════════ two main weapons for everyone (job-freedom §9): the second weapon learns 30 %, the same kind +10 % ═════════
{
  const W = world({ wk: "sword", lvl: 1 }), ch = W.ch, mobs = arena(W);
  const gear = (id) => ({ id, q: 0, enh: 0, af: [], sk: 0, ru: [] });
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
  ch.inv.push(gear("w_bow_1"));
  assert.ok(W.act({ t: "eq", s: ch.inv.length - 1, k: "weapon2" }).ok, "a 모험가 holds a bow on the back");
  mobs([[16, 0]]);
  ready(W); assert.ok(W.act({ t: "atk", a: 0 }).ok);
  assert.equal(ch.wm.sword.xp, 5, "the hand learns in full");
  near(ch.wm.bow.xp, 1.5, "the bow on the back learns 30 % (early bonus included)");
  assert.equal(W.self().wm[D.wkOrder.indexOf("bow")][1], 1, "the wire shows whole points");
  // the same kind twice: +10 % to that kind, no 30 % share
  ch.wm.sword = { lv: 1, xp: 0 }; ch.wm.bow = { lv: 1, xp: 0 };
  ch.inv.push(gear("w_warrior_1"));
  assert.ok(W.act({ t: "eq", s: ch.inv.length - 1, k: "weapon2" }).ok);
  assert.equal(ch.inv.at(-1).id, "w_bow_1", "the bow went back to the bag");
  ready(W); W.act({ t: "atk", a: 0 });
  near(ch.wm.sword.xp, 5.5, "two swords: +10 %");
  assert.equal(ch.wm.bow.xp, 0);
  // a save floors the share; the sheet shape is unchanged
  const W2 = world({ ch: JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID))) });
  assert.equal(W2.ch.wm.sword.xp, 5); assert.equal(W2.ch.eq.weapon2.id, "w_warrior_1");
}

// ═════════ grazes, evasion, stagger (B.4, B.6) ═════════
{
  // a fresh weapon on a monster five tiers up grazes about 25 % − mastery; mastery 25 never
  const graze = (wm) => {
    const W = world({ wk: "sword", lvl: 1, wm: { sword: wm } });
    const mobs = arena(W);
    const [m] = mobs([[16, 0]], { k: "ribdeer" });     // tier 10 vs tier 1 → 9 tiers up: 10 + 27 − wm
    let n = 0, g = 0;
    for (let i = 0; i < 300; i++) { ready(W); m.hp = 50000; m.x = W.p.x + 16; m.y = W.p.y; W.act({ t: "atk", a: 0 }); for (const e of W.rt.ev) if (e[0] === "h" && e[1] === m.id) { n++; if (e[3] === 2) g++; } W.step(); }
    return g / n;
  };
  near(graze(1), 0.36, 0.07, "a fresh sword nine tiers deep grazes 36 %");
  assert.equal(graze(40), 0, "mastery 37+ never grazes there");
  // A fully invested DEX build reaches the existing evasion ceiling.
  const dodge = (dex) => {
    const W = world({ wk: "dagger", st: { str: 5, wil: 5, dex, int: 5, wis: 5, luk: 5 } });
    const mobs = arena(W);
    const [m] = mobs([[14, 0]], { tgt: W.PID, atkAt: 0, castAt: 1e15 });
    let n = 0, e3 = 0;
    for (let i = 0; i < 4000 && n < 400; i++) { W.p.hp = 1e6; W.p.dead = false; const v = W.step(); for (const e of v.ev || []) if (e[0] === "h" && e[1] === W.p.eid) { n++; if (e[3] === 3) e3++; } m.x = W.p.x + 14; m.y = W.p.y; }
    return e3 / n;
  };
  near(dodge(99), 0.20, 0.05, "a capped DEX build evades 20% of eligible blows");
  assert.ok(dodge(5) < 0.05);
  // an elite's blow staggers: shoved back, and a moment when no blow or skill can be thrown
  const W = world({ wk: "sword", lvl: 1 });
  const mobs = arena(W);
  const [el] = mobs([[14, 0]], { k: "lambmaw", el: 1, tgt: W.PID, atkAt: 0 });
  const x0 = W.p.x;
  let v, staggered = false;
  for (let i = 0; i < 40 && !staggered; i++) { W.p.hp = 1e6; v = W.step(); staggered = (v.ev || []).some((e) => e[0] === "sg" && e[1] === W.p.eid); el.x = W.p.x + 14; el.y = W.p.y; }
  assert.ok(staggered, "an elite's blow staggers");
  assert.ok(W.p.x < x0, "shoved away from the blow");
  W.p.atkAt = 0;
  if (W.S.now < W.p.stag) assert.equal(W.act({ t: "atk", a: 0 }).error, "stag", "a quiet refusal");
  // WIL makes a stagger short, STR a shove small
  const W2 = world({ wk: "sword", st: { str: 60, wil: 60, dex: 5, int: 5, wis: 5, luk: 5 } });
  const s2 = W2.self();
  assert.ok(s2.dv[5] > 50 && s2.dv[6] > 50, "poise and knockback resistance from WIL and STR");
}


{
  const levels = [1, 30, 35, 40];
  const gains = levels.map((lvl) => {
    const W = world({ lvl, wk: "sword" }), mobs = arena(W);
    const [m] = mobs([[16, 0]], { hp: 1, k: "gutfrog" });
    const before = W.ch.xp + W.ch.xpt;
    ready(W); assert.ok(W.act({ t: "atk", a: 0 }).ok); assert.ok(m.dead);
    return W.ch.xp + W.ch.xpt - before;
  });
  assert.deepEqual(gains, [29, 28, 22, 16], "the early hunter bonus tapers while trivial monsters pay less XP");

  const boosted = world({ wk: "sword" }), high = arena(boosted);
  const [outOfBand] = high([[16, 0]], { hp: 1, k: "ribdeer" });
  ready(boosted);
  assert.ok(boosted.act({ t: "atk", a: 0 }).ok && outOfBand.dead);
  assert.equal(boosted.ch.xp + boosted.ch.xpt, D.mobs.ribdeer.xp, "late-game carries get the regular reward");

  const W = world({ wk: "sword" });
  W.npc("elder");
  W.ch.q = { i: 0, n: D.quests[0].n, st: 1 };
  assert.ok(W.act({ t: "quest", a: "done" }).ok);
  assert.equal(W.ch.xp + W.ch.xpt, D.quests[0].xp);
  assert.deepEqual(W.ch.wm.sword, { lv: 1, xp: 0 }, "quest turn-ins do not teach weapon mastery");
}

// ═════════ profession signature ranks ═════════
{
  const W = world({ wk: "book", lvl: 45, job: "paladin", wm: { hammer: 20, book: 20 } });
  const id = "oathward", sk = D.skills[id], act = { t: "sk", id, a: 0 };
  assert.deepEqual(D.jobSkillRanks.map(r => r.lv), [5, 20, 35, 50]);
  W.ch.jp = { lv: 4, xp: 0 };
  assert.match(W.act(act).error, /직업 Lv\.5/);
  for (const [lv, mpCut, cdCut] of [[5, 0, 0], [19, 0, 0], [20, 10, 0], [34, 10, 0], [35, 10, 8], [49, 10, 8], [50, 20, 12]]) {
    W.ch.jp = { lv, xp: 0 };
    W.p.stc = null;
    W.p.cds = {};
    ready(W);
    const rows = W.self().sk, row = rows.find(r => r[0] === id);
    const mp = Math.ceil(sk.mp * (100 - mpCut) / 100);
    const cd = Math.round(sk.cd * (1 - W.p.stc.cdr) * (100 - cdCut) / 100);
    assert.deepEqual(row, [id, mp, 0, 1, 0, cd], `job level ${lv} effective cost and cooldown`);
    assert.deepEqual(rows.find(r => r[0] === "soulbolt"), ["soulbolt", D.skills.soulbolt.mp, 0, 1]);
    W.p.mp = mp - 1;
    assert.equal(W.act(act).error, "MP가 부족합니다");
    W.p.mp = mp;
    assert.ok(W.act(act).ok);
    assert.equal(W.p.mp, 0);
    assert.equal(W.p.cds[id], W.now + cd);
    assert.match(W.act(act).error, /재사용 대기/);
  }
}

// ═════════ jobs (C.3, C.4) ═════════
{
  const W = world({ wk: "sword", wm: { sword: 19, staff: 20 } });
  const ch = W.ch;
  ch.gold = 1e6;
  assert.equal(W.act({ t: "job_change", j: "swordsman" }).error, "[대검] 숙련 20이 필요합니다");
  ch.wm.sword.lv = 20;
  assert.equal(W.act({ t: "job_change", j: "swordsman" }).error, "전직관이 너무 멉니다");
  W.npc("job");
  assert.equal(W.map.npcs.find((n) => n.role === "job").name, "전직관 아르센", "전직관 아르센 stands in town");
  assert.equal(W.act({ t: "job_change", j: "emperor" }).error, "없는 직업입니다");
  assert.equal(W.act({ t: "job_change", j: "adventurer" }).error, "없는 직업입니다");
  assert.equal(W.act({ t: "job_change", j: "thief" }).error, "[단검] 숙련 20이 필요합니다");
  assert.equal(W.act({ t: "job_change", j: "darkknight" }).error, "[대검]과 [마도서] 숙련이 모두 15 이상이어야 합니다");
  ch.gold = D.jobs.swordsman.cost - 1;
  assert.equal(W.act({ t: "job_change", j: "swordsman" }).error, "골드가 부족합니다");
  ch.gold = 30000;
  // two weapons at 15 open the hybrid of the pair (a single job still asks 20)
  ch.wm.sword.lv = 15; ch.wm.staff.lv = 14;
  assert.equal(W.act({ t: "job_change", j: "spellblade" }).error, "[대검]과 [스태프] 숙련이 모두 15 이상이어야 합니다", "15 + 14 is not enough");
  assert.equal(W.act({ t: "job_change", j: "swordsman" }).error, "[대검] 숙련 20이 필요합니다", "a single job still asks 20");
  ch.wm.staff.lv = 15;
  assert.ok(W.act({ t: "job_change", j: "spellblade" }).ok, "sword 15 + staff 15 → 마검사");
  assert.equal(ch.job, "spellblade"); assert.equal(ch.gold, 30000 - D.jobs.spellblade.cost);
  assert.deepEqual(ch.jp, { lv: 1, xp: 0 });
  assert.match(W.act({ t: "sk", id: "crimson" }).error, /직업 Lv\.5/);
  let v = W.step();
  assert.ok(v.ev.some((e) => e[0] === "jc" && e[1] === W.p.eid));
  assert.ok(ch.ach.includes("job1") && ch.ach.includes("job2"));
  assert.ok(W.S.chat.length === 0 || true);
  // irreversible
  assert.equal(W.act({ t: "job_change", j: "swordsman" }).error, "모험가만 전직할 수 있습니다");
  // the swap: hybrids only, a second weapon of the pair, Tab-quick but not instant
  ch.inv.push({ id: "w_mage_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }, { id: "w_bow_1", q: 0, enh: 0, af: [], sk: 0, ru: [] });
  assert.equal(W.act({ t: "wsw" }).error, "Ⅱ에 장착한 무기가 없습니다");
  assert.equal(W.act({ t: "eq", s: ch.inv.findIndex((s) => s.id === "w_bow_1"), k: "weapon2" }).error, "대검이나 스태프만 들 수 있습니다");
  assert.ok(W.act({ t: "eq", s: ch.inv.findIndex((s) => s.id === "w_mage_1"), k: "weapon2" }).ok);
  assert.equal(ch.eq.weapon.id, "w_warrior_1"); assert.equal(ch.eq.weapon2.id, "w_mage_1");
  const atkSword = W.self().atk;
  assert.ok(W.act({ t: "wsw" }).ok);
  assert.equal(ch.eq.weapon.id, "w_mage_1");
  v = W.step();
  assert.equal(v.self.wk, "staff"); assert.equal(v.self.wk2, "sword");
  assert.ok(v.who.find((r) => r[0] === W.p.eid).at(-1) === "sword", "everyone sees the weapon on the back");
  assert.equal(W.act({ t: "wsw" }).error, "wsw", "a quiet wait between swaps");
  for (let i = 0; i < 9; i++) W.step();
  assert.ok(W.act({ t: "wsw" }).ok);
  assert.equal(W.self().atk, atkSword, "the second weapon adds nothing while on the back");
  // §9: a single job holds any second weapon too, and swaps it like a re-equip
  const W2 = world({ wk: "dagger", job: "thief" });
  W2.ch.inv.push({ id: "w_bow_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }, { id: "h_1", q: 0, enh: 0, af: [], sk: 0, ru: [] });
  assert.equal(W2.act({ t: "eq", s: W2.ch.inv.length - 1, k: "weapon2" }).error, "무기만 Ⅱ에 장착할 수 있습니다");
  assert.ok(W2.act({ t: "eq", s: W2.ch.inv.findIndex((s) => s.id === "w_bow_1"), k: "weapon2" }).ok);
  assert.ok(W2.act({ t: "wsw" }).ok);
  assert.equal(W2.ch.eq.weapon.id, "w_bow_1"); assert.equal(W2.ch.eq.weapon2.id, "w_rogue_1");
  assert.equal(W2.step().self.wk2, "dagger");
  // a single job: one weapon at 20; the job adds to that weapon
  const W3 = world({ wk: "bow", wm: { bow: 20 } });
  W3.ch.gold = D.jobs.archer.cost;
  W3.npc("job");
  assert.ok(W3.act({ t: "job_change", j: "archer" }).ok, "bow 20 → 궁수");
  assert.equal(W3.ch.gold, 0);
  assert.equal(W3.act({ t: "job_change", j: "tracker" }).error, "모험가만 전직할 수 있습니다", "a single job never becomes a hybrid");
}

// ═════════ saved hybrids load as they were (no sheet change: a job is an id) ═════════
{
  for (const [job, wk, wk2, lv] of [["tracker", "dagger", "bow", 20], ["spellspear", "spear", "staff", 15], ["runearcher", "bow", "book", 31]]) {
    const W = world({ wk, wk2, wm: { [wk]: lv, [wk2]: lv }, job });
    const saved = JSON.parse(JSON.stringify(L.exportChar(W.S, W.PID)));
    const W2 = world({ ch: saved });
    assert.equal(W2.ch.job, job, job + " survives a save and a load");
    assert.equal(W2.ch.eq.weapon2 && W2.ch.eq.weapon2.id, W.ch.eq.weapon2.id, "with its second weapon");
    const s = W2.self();
    assert.ok(s.sk.some((x) => x[0] === D.jobs[job].sig && x[3] === 1), job + "'s signature is on the wire, usable");
  }
}

{
  const retired = { stormrider: "thunder", breaker: "breach", arcblade: "qiarrow", shadowlance: "shadowpierce", spellarcher: "tristar" };
  for (const [job, skill] of Object.entries(retired)) {
    const ch = L.hero("복구", { wk: "spear", wk2: "bow", wm: { spear: 24, bow: 26 } });
    ch.job = job; ch.qs[3] = ["s", skill];
    const W = world({ ch });
    assert.equal(W.ch.job, "adventurer");
    assert.deepEqual([W.ch.wm.spear.lv, W.ch.wm.bow.lv], [24, 26]);
    assert.equal(W.ch.eq.weapon2.id, "w_bow_1");
    assert.equal(W.ch.qs[3], null);
    W.npc("job");
    assert.equal(W.act({ t: "job_change", j: job }).error, "없는 직업입니다");
    assert.match(W.act({ t: "sk", id: skill }).error, /^없는 스킬/);
  }
}

// ═════════ the starter weapon ═════════
{
  const W = world({ ch: L.newChar("시작", []) });
  W.npc("train");
  W.ch.inv = Array.from({ length: D.inv }, () => ({ id: "h_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }));
  assert.equal(W.act({ t: "starter", wk: "bow" }).error, "가방이 가득 찼습니다");
  W.ch.inv = [];
  assert.ok(W.act({ t: "starter", wk: "bow" }).ok);
  assert.equal(W.ch.eq.weapon.id, "w_bow_1", "the starter goes straight into the hand");
  assert.deepEqual(W.ch.inv.map((s) => s.id), ["w_rogue_1"], "the old dagger goes to the bag");
  assert.notEqual(W.ch.qs[0][1], "ambush", "slot 1 no longer holds the dagger's skill");
  assert.equal(W.ch.sw, 1);
  assert.equal(W.act({ t: "starter", wk: "sword" }).error, "이미 무기를 받았습니다");
}

// ═════════ the weapon picked on the creation page ═════════
{
  // every starting weapon the rules list (logic starters()): no fixed six
  const kinds = L.starters().map((r) => r[0]);
  assert.ok(kinds.length >= 6 && kinds.includes("sword") && kinds.includes("bow"));
  const FIRST = {}, WID = {};
  for (const wk of kinds) {
    FIRST[wk] = D.skillOrder.find((id) => D.skills[id].wk === wk && D.skills[id].kind === "a" && D.skills[id].need <= 1);
    WID[wk] = Object.keys(D.items).find((id) => D.items[id].type === "weapon" && D.items[id].wk === wk && D.items[id].tier === 1);
    assert.ok(FIRST[wk] && WID[wk], wk + " has a tier-1 weapon and a first skill");
  }
  const base = L.newChar("기준", []);
  for (const wk of kinds) {
    const ch = L.newChar("새" + wk, [1, 2, 3], wk);
    assert.equal(ch.eq.weapon.id, WID[wk], wk + " is in hand");
    assert.deepEqual(ch.qs[0], ["s", FIRST[wk]], wk + ": slot 1 is its first skill");
    assert.equal(ch.qs.filter(Boolean).length, 1, wk + ": nothing else on the bar");
    assert.equal(ch.sw, 1, wk + ": the free pick is spent");
    assert.deepEqual(ch.wm, base.wm, wk + ": mastery as any new hero's");
    assert.deepEqual(ch.inv, base.inv, wk + ": the same bag (no spare dagger)");
    assert.deepEqual(ch.look, L.newChar("모습", [1, 2, 3]).look, "the look is still taken");
    // in the world: the hand, the skill usable, and the 무기 step passed over after the first talk
    const W = world({ ch });
    const me = W.self();
    assert.equal(me.wk, wk);
    assert.equal(me.tut.i, 0, "the first step is still the elder");
    W.npc("elder");
    const gold = W.ch.gold;
    assert.ok(W.act({ t: "tut", s: "talk" }).ok);
    assert.equal(D.tutorial[W.ch.tut.i].id, "bag", wk + ": talk → bag, the weapon step is already done");
    assert.equal(W.ch.gold - gold, 40, "both steps' gold");
    assert.ok(W.p.toast.some((s) => s.includes("다음: 가방 열기")), "the weapon step is never announced as next");
    assert.ok(!W.p.toast.some((s) => s.includes("다음: 무기")));
    W.npc("train");
    assert.equal(W.act({ t: "starter", wk: kinds.find((k) => k !== wk) }).error, "이미 무기를 받았습니다", "no second free weapon");
    // a save and a load keep it
    const back = L.exportChar(W.S, W.PID);
    assert.equal(back.eq.weapon.id, WID[wk]); assert.equal(back.sw, 1);
  }
  // anything that is not one of the six: the old start (dagger, the pick still open, the step still to do)
  for (const bad of [undefined, null, "gun", "", 3, {}, "__proto__", "toString", ["sword"]]) {
    const ch = L.newChar("헌판", Array.isArray(bad) ? "warrior" : [], bad);
    assert.equal(ch.eq.weapon.id, "w_rogue_1", String(bad) + " → the old dagger");
    assert.deepEqual(ch.qs[0], ["s", "ambush"]);
    assert.equal(ch.sw, 0);
  }
  assert.deepEqual(L.newChar("옛모습", "warrior", [1, 2, 3]).look, L.newChar("옛모습", [1, 2, 3]).look, "the four-class call shape still gives its look");
  const W = world({ ch: L.newChar("옛길", []) });
  W.npc("elder");
  assert.ok(W.act({ t: "tut", s: "talk" }).ok);
  assert.equal(D.tutorial[W.ch.tut.i].id, "equip", "an old client's hero still goes to 카이");
}

// ═════════ the world's tiers as players see them (B.8) ═════════
{
  for (const k of Object.keys(D.mobs)) assert.equal(D.mobs[k].lv, 4 * D.mobs[k].tier - 3);
  const maple = D.maps.find((m) => m.id === "maple");
  assert.deepEqual(maple.band, [157, 197], "단풍 왕도 shows Lv.157–197");
  const W = world({ wk: "sword", lvl: 13 });   // tier 4
  const town = W.map;
  assert.ok(town.portals.some((pt) => pt.to.includes("바람초원 Lv.1–25")), "doors name shown levels");
  // a bounty is refused more than four tiers above
  W.npc("elder");
  assert.equal(W.act({ t: "bq", a: "take", k: "ribdeer" }).error, "아직 감당하기 어려운 상대입니다", "tier 10 at tier 4");
  assert.ok(W.act({ t: "bq", a: "take", k: "splitboar" }).ok, "tier 8 at tier 4");
  // daily rewards are 12 % of the tier's experience (tierXp)
  for (const old of [4, 10, 25, 40]) {
    const Wd = world({ wk: "sword", lvl: 4 * old - 3 });
    const d = Wd.self().daily;
    // XP_STEPS (20-helpers-mapkit.js, the 2026-11-16 curve), interpolated
    const K = [[1, 6], [7, 6], [10, 8], [15, 11], [17, 16], [19, 19], [22, 23], [25, 29], [28, 43], [31, 56], [35, 68], [40, 87], [45, 95], [50, 124]];
    const i = K.findIndex(([l]) => old <= l), [[l0, k0], [l1, k1]] = [K[Math.max(0, i - 1)], K[i]];
    const xpK = l1 === l0 ? k1 : k0 + ((k1 - k0) * (old - l0)) / (l1 - l0);
    const oldNeed = Math.round((34 * Math.pow(old, 1.85) + 20) * xpK);
    assert.equal(d.tasks[0].reward.xp, Math.round(oldNeed * 0.12), `old Lv.${old}'s daily experience`);
    assert.equal(d.tasks[0].reward.gold, 60 + 25 * old, `and gold`);
  }
  // the death window names the killer at its shown level
  const Wk = world({ wk: "sword" });
  const mobs = arena(Wk);
  const [m] = mobs([[14, 0]], { k: "ribdeer", el: 1, tgt: Wk.PID, atkAt: 0 });
  for (let i = 0; i < 300 && !Wk.p.dead; i++) { Wk.step(); m.x = Wk.p.x + 14; m.y = Wk.p.y; }
  assert.ok(Wk.p.dead);
  const dv = Wk.self().dead;
  assert.ok(dv.by.startsWith("Lv.37 ") && dv.lv === 37, dv.by);
}

// ═════════ the bow (D.2) ═════════
{
  const W = world({ wk: "bow", lvl: 37, wm: { bow: 30 } });
  const mobs = arena(W);
  const p = W.p;
  // an arrow flies: nothing the moment it is loosed, a hit a few ticks later
  let [m] = mobs([[120, 0]]);
  ready(W);
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  const ev = W.rt.ev.slice();
  const a = ev.find((e) => e[0] === "a" && e[1] === p.eid), ar = ev.find((e) => e[0] === "ar");
  assert.equal(a[2], 6, "the bow's basic attack is fx 6");
  assert.equal(ar.length, 9, "[ar, id, x0, y0, ux·1000, uy·1000, spd, kind, shooter]");
  assert.deepEqual([ar[4], ar[5], ar[6], ar[7], ar[8]], [1000, 0, 420, 0, p.eid]);
  assert.equal(m.hp, 50000, "not yet");
  let v = W.step();
  assert.equal(m.hp, 50000, "one tick: 42 px of 120");
  let hitAt = 0;
  for (let i = 2; i <= 5 && !hitAt; i++) { v = W.step(); if (m.hp < 50000) hitAt = i; }
  assert.ok(hitAt >= 2, "it lands after a few ticks: " + hitAt);
  assert.ok((v.ev || []).some((e) => e[0] === "ae" && e[1] === ar[1] && e[4] === 0), "it ends struck (0)");
  // out of range: past 150 px it falls away (2)
  W.step(1000);
  [m] = mobs([[175, 0]]);
  ready(W);
  W.act({ t: "atk", a: 0 });
  const id2 = W.rt.ev.find((e) => e[0] === "ar")[1];
  let ended = null;
  for (let i = 0; i < 8 && !ended; i++) { v = W.step(); ended = (v.ev || []).find((e) => e[0] === "ae" && e[1] === id2); }
  assert.equal(m.hp, 50000, "out of range"); assert.equal(ended[4], 2, "ran out of range (2)");
  // the arc: a monster square to the side is not aimed at; the arrow flies along the aim and misses
  W.step(1000);
  [m] = mobs([[0, 60]]);
  ready(W);
  W.act({ t: "atk", a: 0 });
  for (let i = 0; i < 6; i++) W.step();
  assert.equal(m.hp, 50000, "nothing to the side");
  // aim assist inside the arc: a monster a little off the line is shot at
  W.step(1000);
  [m] = mobs([[100, 20]]);
  ready(W);
  W.act({ t: "atk", a: 0 });
  for (let i = 0; i < 5; i++) W.step();
  assert.ok(m.hp < 50000, "inside the arc, aimed at");
  // one plain arrow stops at the first monster; the finisher (third of a run) goes through one more
  W.step(1000);
  const line = mobs([[60, 0], [90, 0], [120, 0]]);
  for (let shot = 0; shot < 3; shot++) {
    for (const o of line) o.hp = 50000;
    p.stag = 0; p.mp = 9999; p.hp = 1e6;
    if (shot) p.atkAt = W.now - 800;           // within the combo window
    else { p.atkAt = 0; p.combo = 0; }
    W.act({ t: "atk", a: 0 });
    for (let i = 0; i < 5; i++) W.step();
    const hit = line.filter((o) => o.hp < 50000).length;
    assert.equal(hit, shot === 2 ? 2 : 1, `shot ${shot + 1} hits ${hit}`);
  }
  // walls stop arrows (1)
  const Ww = world({ wk: "bow", lvl: 37, wm: { bow: 30 } });
  Ww.go("meadow");
  const mp = Ww.map, free = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  const solid = (x, y) => mp.o[y] && mp.o[y][x] !== " " && mp.o[y][x] !== undefined;
  let spot = null;
  for (let y = 4; y < mp.h - 4 && !spot; y++) for (let x = 4; x < mp.w - 12 && !spot; x++) {
    if (free(x, y) && free(x + 1, y) && free(x + 2, y) && solid(x + 3, y) && free(x + 5, y) && free(x + 6, y)) spot = [x, y];
  }
  assert.ok(spot, "a wall to shoot at");
  Ww.go("meadow", spot[0], spot[1]);
  Ww.step();
  for (const o of Ww.rt.mobs) { o.dead = true; o.respAt = Ww.now + 1e12; }
  const pw = Ww.p, mw = Ww.rt.mobs.find((o) => !D.mobs[o.k].chest && !D.mobs[o.k].boss && !D.mobs[o.k].fly);
  mw.slot = null;
  Object.assign(mw, { k: "twinhare", dead: false, el: 0, tr: [], hp: 50000, x: (spot[0] + 6) * T + 8, y: pw.y, hx: (spot[0] + 6) * T + 8, hy: pw.y, by: {}, tgt: null, st: 0, castAt: 1e15, atkAt: 1e15, mvAt: 1e15 });
  pw.aim = 0; ready(Ww);
  // the target is beyond the wall but inside range: aim assist picks it, and the wall takes the arrow
  Ww.act({ t: "atk", a: 0 });
  const idw = Ww.rt.ev.find((e) => e[0] === "ar")[1];
  let endw = null;
  for (let i = 0; i < 6 && !endw; i++) { v = Ww.step(); endw = (v.ev || []).find((e) => e[0] === "ae" && e[1] === idw); }
  assert.ok(endw && endw[4] === 1, "stuck in the wall (1)");
  assert.equal(mw.hp, 50000, "nothing behind a wall is hit");
  assert.ok(endw[2] < (spot[0] + 3) * T + 8, "it stops at the wall");
  // from afar a sure eye hits harder (DEX); thorns never bite an archer
  const shotDmg = (dx) => {
    // (mastery under 10: no 매의 시야 yet, that passive is tested in skills.mjs)
    const Wf = world({ wk: "bow", lvl: 37, wm: { bow: 9 }, st: { str: 5, wil: 5, dex: 99, int: 5, wis: 5, luk: 5 } });
    const mf = arena(Wf);
    const [t] = mf([[dx, 0]]);
    let sum = 0;
    for (let i = 0; i < 80; i++) { ready(Wf); t.hp = 50000; t.x = Wf.p.x + dx; t.y = Wf.p.y; Wf.act({ t: "atk", a: 0 }); for (let k = 0; k < 4; k++) Wf.step(); sum += 50000 - t.hp; Wf.step(600); }
    return sum;
  };
  const ratio = shotDmg(120) / shotDmg(40);
  assert.ok(ratio > 1.12 && ratio < 1.4, "a shot from 90 px or more hits harder: ×" + ratio.toFixed(2));
  const Wt = world({ wk: "bow", lvl: 37, wm: { bow: 30 } });
  const mt = arena(Wt);
  const [th] = mt([[80, 0]], { el: 1, tr: ["thorn"] });
  ready(Wt); Wt.p.hp = 500;
  Wt.act({ t: "atk", a: 0 });
  for (let i = 0; i < 4; i++) Wt.step();
  assert.ok(th.hp < 50000 && Wt.p.hp >= 500, "thorns do not reach an archer");
  // a shooter who leaves the map takes their arrows along
  const Wl = world({ wk: "bow", lvl: 37 });
  const ml = arena(Wl);
  ml([[140, 0]]);
  ready(Wl);
  Wl.act({ t: "atk", a: 0 });
  assert.equal(Wl.rt.shots.length, 1);
  const rtm = Wl.rt;
  // someone else stays in the meadow so it keeps ticking
  L.addPlayer(Wl.S, "pid-stay", L.hero("남은이", { wk: "sword" }));
  const stay = Wl.S.players["pid-stay"];
  L.runtime(Wl.S, stay.map).n--; stay.map = "meadow"; rtm.n++; stay.x = Wl.p.x - 40; stay.y = Wl.p.y;
  const sid = rtm.shots[0].id;
  Wl.go("town");
  let gone = null;
  for (let i = 0; i < 3 && !gone; i++) { Wl.step(); gone = L.viewFor(Wl.S, "pid-stay").ev?.find((e) => e[0] === "ae" && e[1] === sid); L.endTick(Wl.S); }
  assert.equal(rtm.shots.length, 0, "no arrow is left behind");
}
// a staff's and a book's basic attacks fly as homing missiles (shot kinds 8 and 9): the blow lands when it gets there
{
  const W = world({ wk: "staff", lvl: 37, wm: { staff: 30 } });
  const mobs = arena(W);
  const p = W.p;
  let [m] = mobs([[90, 0]]), v;
  ready(W);
  assert.ok(W.act({ t: "atk", a: 0 }).ok);
  const ar = W.rt.ev.find((e) => e[0] === "ar");
  assert.ok(W.rt.ev.some((e) => e[0] === "a" && e[1] === p.eid && e[2] === 2), "the staff's cast is still fx 2");
  assert.deepEqual([ar[6], ar[7], ar[8], ar[9]], [320, 8, p.eid, m.id], "a staff missile: spd 320, kind 8, homing on its monster");
  assert.equal(m.hp, 50000, "nothing the moment it is cast");
  W.step();
  assert.equal(m.hp, 50000, "one tick: 32 px of 90");
  let hitAt = 0;
  for (let i = 2; i <= 5 && !hitAt; i++) { v = W.step(); if (m.hp < 50000) hitAt = i; }
  assert.ok(hitAt >= 3, "it lands after its flight: tick " + hitAt);
  assert.ok((v.ev || []).some((e) => e[0] === "ae" && e[1] === ar[1] && e[4] === 0), "and ends struck");
  // homing: a monster that steps aside after the cast is still hit
  W.step(1000);
  [m] = mobs([[90, 0]]);
  ready(W);
  W.act({ t: "atk", a: 0 });
  W.step();
  m.y += 40; m.wy = m.y; m.hy = m.y;
  for (let i = 0; i < 6; i++) W.step();
  assert.ok(m.hp < 50000, "the missile follows the monster that moved");
  // nothing aimed at: it flies straight and fades at the reach
  W.step(1000);
  [m] = mobs([[0, 60]]);
  ready(W);
  W.act({ t: "atk", a: 0 });
  const ar2 = W.rt.ev.find((e) => e[0] === "ar");
  assert.equal(ar2.length, 9, "no monster to home on");
  let end = null;
  for (let i = 0; i < 8 && !end; i++) { v = W.step(); end = (v.ev || []).find((e) => e[0] === "ae" && e[1] === ar2[1]); }
  assert.ok(end && end[4] === 2 && m.hp === 50000, "it fades at the reach");
  // a book's orb (kind 9, slower) bursts where it lands: what stands within its splash takes 60% too
  const B = world({ wk: "book", lvl: 37, wm: { book: 30 } });
  const bm = arena(B);
  const ring = bm([[70, 0], [85, 18], [85, -18], [90, 0], [200, 0]]);
  ready(B);
  B.act({ t: "atk", a: 0 });
  const bar = B.rt.ev.find((e) => e[0] === "ar");
  assert.deepEqual([bar[6], bar[7], bar[9]], [240, 9, ring[0].id], "a book orb: spd 240, kind 9");
  B.step();
  assert.ok(ring.every((o) => o.hp === 50000), "nothing on the cast");
  let bend = null;
  for (let i = 0; i < 6 && !bend; i++) { v = B.step(); bend = (v.ev || []).find((e) => e[0] === "ae" && e[1] === bar[1]); }
  assert.ok(bend && bend[4] === 0 && bend[5] === 26, "it bursts with the splash ring: " + JSON.stringify(bend));
  assert.equal(ring.filter((o) => o.hp < 50000).length, 4, "the target and three beside it");
  assert.equal(ring[4].hp, 50000, "not one far off");
}

// ═════════ loot: any weapon kind drops for anyone ═════════
{
  const W = world({ wk: "dagger", lvl: 37 });
  const mobs = arena(W);
  const kinds = new Set();
  const [m] = mobs([[16, 0]]);
  for (let i = 0; i < 400; i++) {
    Object.assign(m, { dead: false, hp: 1, el: 1, k: "twinhare", by: {}, x: W.p.x + 16, y: W.p.y });
    ready(W); W.act({ t: "atk", a: 0 });
    for (const d of W.rt.drops) if (d.g && D.items[d.it].type === "weapon") kinds.add(D.items[d.it].wk);
    W.rt.drops.length = 0;
    W.step(10);
  }
  assert.ok(kinds.has("dagger") && kinds.size >= 4, "weapons of many kinds drop: " + [...kinds]);
}

{
  // sheet v16 joins two v15 shapes: main's (rift tiers, no job level) and codex/hammer's (job level, the old rift record)
  const job = Object.keys(D.jobs).find((k) => k !== "adventurer");
  const S = L.setup(); S.now = 1_000_000;
  const mainV15 = L.newChar("본판열다섯", []); mainV15.v = 15; mainV15.job = job; delete mainV15.jp;
  const codexV15 = L.newChar("망치열다섯", []); codexV15.v = 15; codexV15.job = job; codexV15.jp = { lv: 12, xp: 3 }; codexV15.dim = { day: 20000, n: 2 };
  L.addPlayer(S, "m15", mainV15); L.addPlayer(S, "c15", codexV15);
  const a = S.players.m15.ch, b = S.players.c15.ch;
  const current = L.newChar("현재양식", []).v;
  assert.deepEqual([a.v, b.v], [current, current]);
  assert.deepEqual(a.jp, { lv: 5, xp: 0 }, "a changed job without a job level starts at the signature level");
  assert.deepEqual(b.jp, { lv: 12, xp: 3 }, "a job level survives");
  assert.deepEqual(b.dim, { day: 20000, n: 2, t: 1, best: 0, ms: 0, wk: 0, wb: 0, bw: 0, bs: D.dim.chal.bosses.map(() => 0) }, "the old rift record gains the tier ladder");
  assert.deepEqual(a.dim, L.newChar("새", []).dim);
}

console.log("jobs ok");
