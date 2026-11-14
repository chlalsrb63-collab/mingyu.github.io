// Headless test of the class skills and the mechanic each class plays around:
// 전사 투지, 도적 표식, 창술사 창끝·집중, 마도사 원소 엮기.   node tests/skills.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;

function world(name, cls, lvl = 40) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-" + name;
  const ch = L.newChar(name, cls, []);
  ch.lvl = lvl;
  L.addPlayer(S, PID, ch);
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    self() { S.players[PID].dirty = true; return W.step().self; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
  };
  // the open middle of the meadow, every monster put away until a test calls one up
  const p = W.p;
  S.maps[p.map].n--; p.map = "meadow"; S.maps.meadow.n++; p.sendMap = true;
  const mp = W.step().map;
  const clear = (x, y) => mp.o[y] && mp.o[y][x] === " " && !"wW".includes(mp.g[y][x]);
  let spot = null;
  for (let y = 4; y < mp.h - 4 && !spot; y++) for (let x = 6; x < mp.w - 10 && !spot; x++) {
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -5; dx <= 9 && ok; dx++) if (!clear(x + dx, y + dy)) ok = false;
    if (ok) spot = [x, y];
  }
  assert.ok(spot, "open ground");
  p.x = spot[0] * T + 8; p.y = spot[1] * T + 10; p.mvAt = now; p.dir = 2; p.aim = 0;
  for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  W.map = mp;
  W.ready = () => { p.mp = 9999; p.hp = 1e6; p.atkAt = 0; for (let i = 0; i < 6; i++) p.cds[i] = 0; };
  /** Call up `n` plain monsters at offsets from the player. */
  W.mobs = (offs, hp = 50000) => {
    const pool = W.rt.mobs.filter((o) => !D.mobs[o.k].chest && !D.mobs[o.k].boss && !D.mobs[o.k].fly);
    return offs.map(([dx, dy], j) => {
      const m = pool[j];
      Object.assign(m, { dead: false, el: 0, tr: [], hp, x: p.x + dx, y: p.y + dy, hx: p.x + dx, hy: p.y + dy, by: {}, stun: 0, slow: 0, mk: 0, mkAt: 0, dec: null, vuln: 0, tgt: null, st: 0, act: null, castAt: now + 1e9, atkAt: now + 1e9 });
      return m;
    });
  };
  return W;
}
const evts = (v, tag) => (v.ev || []).filter((e) => e[0] === tag);
const sk = (cls, id) => D.skills[cls].findIndex((s) => s.id === id);

// ── the tables: four kits of six, each class with its own gauge
for (const cls of Object.keys(D.classes)) {
  assert.equal(D.skills[cls].length, 6);
  assert.deepEqual(D.skills[cls].map((s) => s.lv), [3, 7, 12, 18, 25, 35]);
  for (const s of D.skills[cls]) assert.ok(s.desc && s.desc.length > 20, s.id + " is described");
}
assert.deepEqual(D.skills.mage.filter((s) => s.el).map((s) => s.el), ["f", "i", "l"], "fire, ice and lightning");
assert.ok(D.mech && D.mech.react && D.mech.grit === 100);

// ═════════ 전사 ═════════
{
  const W = world("투지", "warrior");
  const p = W.p;
  W.ready();
  const [m] = W.mobs([[20, 0]]);
  assert.ok(W.act({ t: "atk" }).ok);
  assert.equal(p.grit, 8, "a blow earns grit");
  let v = W.step();
  assert.equal(v.me[9], 8, "the gauge's number rides on every snapshot");
  assert.equal(W.self().cr.k, "grit");
  // being struck earns it too
  m.atkAt = 0; m.castAt = W.now + 1e9; m.tgt = W.PID;
  for (let i = 0; i < 20 && p.grit < 12; i++) W.step(100);
  assert.ok(p.grit >= 12, "taking a blow earns grit, now " + p.grit);
  m.dead = true;
  // and it cools off after four quiet seconds
  const g0 = p.grit;
  for (let i = 0; i < 38; i++) W.step(100);
  assert.equal(p.grit, g0, "kept while the fight is fresh");
  for (let i = 0; i < 20; i++) W.step(100);
  assert.ok(p.grit < g0, "and fades after");
  // 투지 폭발: everything spent, wider and harder with more
  const blast = (grit) => {
    W.ready();
    const ms = W.mobs([[20, 0], [-30, 10], [50, 0]]);
    p.grit = grit;
    // the same dice for both blasts, so the comparison is about the gauge and not a lucky crit
    W.S.seed = 7777;
    assert.ok(W.act({ t: "sk", i: sk("warrior", "burst") }).ok);
    const ev = evts(W.step(), "a").find((e) => e[2] === 46);
    assert.equal(p.grit, 0, "all of it spent");
    const out = { r: ev[7], hurt: ms.filter((o) => o.hp < 50000).length, dmg: 50000 - ms[0].hp };
    for (const o of ms) o.dead = true;
    return out;
  };
  const lo = blast(0), hi = blast(100);
  assert.ok(hi.r > lo.r + 30 && hi.hurt > lo.hurt, `a full gauge goes wider (${lo.r}→${hi.r}, ${lo.hurt}→${hi.hurt} hit)`);
  assert.ok(hi.dmg > lo.dmg * 2.5, `and far harder (${lo.dmg}→${hi.dmg})`);
}
{
  // 대검 투척: thrown, stuck, headbutting meanwhile, then called back through the pack
  const W = world("투척", "warrior");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[30, 0], [60, 0]]);
  const acd0 = W.self().acd;
  assert.ok(W.act({ t: "sk", i: 0 }).ok);
  let v = W.step();
  assert.ok(p.sword && p.sword.x > p.x + 60, "the sword flies down the line and sticks");
  assert.ok(ms.every((o) => o.hp < 50000), "cutting everything on the way");
  assert.ok(evts(v, "sw").length === 1 && (v.me[8] & 2), "it is shown stuck, and gone from the hand");
  const s1 = W.self();
  assert.ok(s1.acd < acd0 && s1.range < 30, "barehanded the warrior butts — quick and close");
  assert.equal(s1.skm[0], 0, "calling it back costs nothing");
  // a headbutt
  ms[0].x = p.x + 14; ms[0].y = p.y;
  const x0 = ms[0].x, g0 = p.grit;
  p.atkAt = 0;
  assert.ok(W.act({ t: "atk" }).ok);
  v = W.step();
  assert.ok(evts(v, "a").some((e) => e[2] === 40), "a headbutt");
  assert.ok(ms[0].x > x0 + 6 && p.grit >= g0 + 12, "that knocks back hard and fires the blood");
  // the recall drags what it passes back to the warrior
  for (let i = 0; i < 8; i++) W.step(100);
  ms[1].x = p.sword.x - 20; ms[1].y = p.sword.y;
  const far = ms[1].x - p.x, h1 = ms[1].hp;
  assert.ok(W.act({ t: "sk", i: 0 }).ok, "pressed again: the recall");
  v = W.step();
  assert.ok(!p.sword && evts(v, "sr").length === 1, "the sword is back in hand");
  assert.ok(ms[1].x - p.x < far - 30 && ms[1].hp < h1, "and dragged the monster home, cutting it");
  assert.ok(p.cds[0] - W.now > D.skills.warrior[0].cd * 0.8, "now the real cooldown");
  // left lying, it comes home by itself after eight seconds
  W.ready();
  W.act({ t: "sk", i: 0 });
  for (let i = 0; i < 85; i++) W.step(100);
  assert.ok(!p.sword, "the sword comes home on its own");
}
{
  // 버티기: most of each blow is caught and sent back as a shockwave
  const W = world("버티기", "warrior");
  const p = W.p;
  W.ready();
  const [m] = W.mobs([[16, 0]]);
  p.hp = 100000; p.grit = 0;
  assert.ok(W.act({ t: "sk", i: 1 }).ok);
  const hp0 = p.hp;
  W.rt.tele.push({ x: p.x, y: p.y, r: 13, at: W.now + 50, dmg: 3000, by: m });
  let v = W.step(100);
  const taken = hp0 - p.hp;
  assert.ok(p.brace && p.brace.stored > taken, `most of the blow is held back (${taken} taken, ${p.brace && p.brace.stored} held)`);
  m.atkAt = W.now + 1e9;
  const before = m.hp;
  let wave = false;
  for (let i = 0; i < 12; i++) { v = W.step(100); if (evts(v, "bw").some((e) => e[4] === 1)) wave = true; }
  assert.ok(wave && !p.brace && m.hp < before, "then let loose");
  assert.ok(p.grit >= 30, "with a surge of grit");
}
{
  // 도발 포효 and 대지 걸음 and 거신화
  const W = world("포효", "warrior");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[70, 0], [-60, 16], [60, -24]]);
  const d0 = ms.map((o) => Math.hypot(o.x - p.x, o.y - p.y));
  assert.ok(W.act({ t: "sk", i: sk("warrior", "roar") }).ok);
  W.step();
  ms.forEach((o, j) => assert.ok(Math.hypot(o.x - p.x, o.y - p.y) < d0[j] - 25 && o.tgt === W.PID, "pulled in and fixed on the warrior"));
  assert.ok(p.grit >= 30 && p.atkBuff > W.now, "grit for each, and the party fired up");
  for (const o of ms) o.dead = true;
  W.ready();
  W.mobs([[10, 0], [-10, 0]]);
  assert.ok(W.act({ t: "sk", i: sk("warrior", "stomp") }).ok);
  let quakes = 0;
  for (let i = 0; i < 20; i++) { p.x += i % 2 ? 5 : -5; p.mvAt = W.now; quakes += evts(W.step(100), "bw").filter((e) => e[4] === 3).length; }
  assert.ok(quakes >= 3, "walking shakes the ground, " + quakes + " times in two seconds");
  W.ready();
  p.slowed = W.now + 1e6;
  assert.ok(W.act({ t: "sk", i: 5 }).ok);
  const v = W.step();
  assert.ok(v.me[8] & 1, "a giant, for all to see");
  const [m] = W.mobs([[22, 0]]);
  for (let i = 0; i < 3; i++) { p.atkAt = 0; W.act({ t: "atk" }); W.step(1200); }
  assert.ok(p.combo >= 0 && m.stun > 0, "every blow a finisher");
  for (let i = 0; i < 100; i++) W.step(100);
  assert.ok(!(W.step().me[8] & 1), "and back to size after ten seconds");
}

// ═════════ 도적 ═════════
{
  const W = world("표식", "rogue");
  const p = W.p;
  W.ready();
  const [m, m2] = W.mobs([[16, 0], [60, 24]]);
  W.act({ t: "atk" });
  let v = W.step();
  assert.equal(m.mk, 1, "every stab leaves a mark");
  assert.equal(v.M.find((r) => r[0] === m.id)[8], 1, "shown over the monster");
  assert.equal(v.M.find((r) => r[0] === m2.id).length, 8, "unmarked monsters cost nothing extra on the wire");
  // 그림자 바꿔치기
  const px = p.x, py = p.y, mx = m2.x, my = m2.y;
  m.dead = true;
  assert.ok(W.act({ t: "sk", i: 0 }).ok);
  v = W.step();
  assert.ok(Math.abs(p.x - mx) < 1 && Math.abs(m2.x - px) < 1 && Math.abs(m2.y - py) < 1, "rogue and monster trade places");
  assert.equal(m2.mk, 2, "two marks");
  assert.ok(evts(v, "cf").length === 1 && m2.stun > W.now, "it reels, confused");
  // 맹독 바르기: two marks a stab, and a poison as strong as the marks
  W.ready();
  m2.x = p.x + 16; m2.y = p.y; m2.mk = 0;
  assert.ok(W.act({ t: "sk", i: 1 }).ok);
  W.step();
  p.atkAt = 0; W.act({ t: "atk" }); W.step(600);
  p.atkAt = 0; W.act({ t: "atk" });
  assert.equal(m2.mk, 4, "venom marks twice");
  assert.ok(m2.dot && m2.dot.dmg > 0 && p.venom.n === 4, "and poisons");
  // 표식 수확: every mark goes off
  W.ready();
  m2.dead = true;
  const [a, b] = W.mobs([[30, 0], [-30, 0]]);
  a.mk = 5; a.mkAt = W.now + 9000; b.mk = 1; b.mkAt = W.now + 9000;
  W.S.seed = 7777; // fixed dice: a lucky crit on the one-mark target must not decide the comparison
  assert.ok(W.act({ t: "sk", i: sk("rogue", "harvest") }).ok);
  W.step();
  assert.ok(a.mk === 0 && b.mk === 0, "the marks are spent");
  assert.ok(50000 - a.hp > (50000 - b.hp) * 3, `five marks hurt far more than one (${50000 - a.hp} vs ${50000 - b.hp})`);
  // marks fade if left alone
  a.mk = 3; a.mkAt = W.now + 9000;
  for (let i = 0; i < 100; i++) W.step(100);
  assert.ok(!W.step().M.find((r) => r[0] === a.id)[8], "marks fade after ten seconds");
}
{
  // 행운의 동전: both faces turn up
  const W = world("동전", "rogue");
  const p = W.p;
  let heads = 0, tails = 0;
  for (let i = 0; i < 40 && !(heads && tails); i++) {
    W.ready();
    const [m] = W.mobs([[20, 0]]);
    const h0 = m.hp;
    assert.ok(W.act({ t: "sk", i: 2 }).ok);
    const v = W.step();
    const c = evts(v, "cn")[0];
    // the coin's own blow: the first hit on the target after the flip (a skill cast just before may have landed in the same tick)
    const crit = v.ev.slice(v.ev.indexOf(c)).find((e) => e[0] === "h" && e[1] === m.id);
    if (c[4]) { heads++; assert.equal(crit[3], 1, "heads is always a critical hit"); assert.ok(!p.coinFree); }
    else {
      tails++;
      assert.ok(p.coinFree, "tails: the next skill comes back at once");
      assert.ok(W.act({ t: "sk", i: 0 }).ok);
      assert.ok(p.cds[0] - W.now <= 300 && !p.coinFree, "and it did");
    }
    assert.ok(m.hp < h0);
    m.dead = true;
  }
  assert.ok(heads && tails, `both faces (${heads} heads, ${tails} tails)`);
}
{
  // 꼭두각시 분신: the monsters go for the puppet, and it goes off among them
  const W = world("분신", "rogue");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[40, 0], [40, 20]]);
  for (const o of ms) { o.tgt = W.PID; o.atkAt = 0; o.castAt = W.now + 1e9; }
  assert.ok(W.act({ t: "sk", i: 3 }).ok);
  let v = W.step();
  assert.ok(evts(v, "dc").length === 1 && (v.me[8] & 64), "a puppet left behind, the rogue hidden");
  assert.ok(ms.every((o) => o.dec && o.tgt !== W.PID), "and the monsters turn on it");
  p.x -= 120; p.mvAt = W.now;
  let popped = false;
  for (let i = 0; i < 50 && !popped; i++) { v = W.step(100); popped = evts(v, "dx").length > 0; }
  assert.ok(popped && ms.some((o) => o.mk >= 1 && o.hp < 50000), "struck, it goes off and marks them");
}
{
  // 그림자 무도: untouchable, from mark to mark, then home
  const W = world("무도", "rogue");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[40, 0], [-40, 20], [10, -26], [80, 20]]);
  ms.forEach((o, j) => { o.mk = j < 3 ? 3 : 0; o.mkAt = W.now + 9000; });
  const ox = p.x, oy = p.y;
  assert.ok(W.act({ t: "sk", i: 5 }).ok);
  assert.ok(!W.act({ t: "atk" }).ok, "no attacking mid-dance");
  let blinks = 0;
  for (let i = 0; i < 30; i++) {
    const v = W.step(100);
    blinks += evts(v, "ln").filter((e) => e[1] === 5).length;
    if (i === 3) { const h = p.hp; ms[3].atkAt = 0; ms[3].tgt = W.PID; ms[3].x = p.x + 10; ms[3].y = p.y; blinks += evts(W.step(100), "ln").filter((e) => e[1] === 5).length; assert.equal(p.hp, h, "nothing touches a shadow"); }
  }
  assert.ok(ms.slice(0, 3).every((o) => o.hp < 50000 && !o.mk), "every marked one struck, marks spent");
  assert.equal(ms[3].hp, 50000, "the unmarked one is left alone");
  assert.ok(blinks >= 4 && Math.abs(p.x - ox) < 1 && Math.abs(p.y - oy) < 1, "and home again, " + blinks + " blinks");
}

// ═════════ 창술사 ═════════
{
  const W = world("창끝", "lancer");
  const p = W.p;
  W.ready();
  const [m] = W.mobs([[48, 0]]);
  W.act({ t: "atk" });
  let v = W.step();
  assert.ok(evts(v, "tip").length === 1 && p.focus === 1, "the far end of the reach is the spear's tip");
  m.x = p.x + 18; p.atkAt = 0;
  W.act({ t: "atk" });
  v = W.step();
  assert.ok(!evts(v, "tip").length && p.focus === 1, "up close is not");
  // the tip hits harder
  const dmg = (dx) => { let t = 0; for (let i = 0; i < 20; i++) { m.hp = 50000; m.x = p.x + dx; m.y = p.y; p.atkAt = 0; p.combo = 0; p.focus = 0; W.act({ t: "atk" }); t += 50000 - m.hp; W.step(2000); } return t; };
  const near = dmg(18), tip = dmg(48);
  assert.ok(tip > near * 1.3, `tip ${tip} vs close ${near}`);
  // 갈고리 걸기: the farthest is hooked to the tip; with full focus, three are
  W.ready();
  m.dead = true;
  const ms = W.mobs([[60, 0], [100, 4], [130, -4]]);
  p.focus = 0;
  assert.ok(W.act({ t: "sk", i: 0 }).ok);
  W.step();
  const tipAt = D.classes.lancer.range * 0.85;
  assert.ok(Math.abs(ms[2].x - p.x - tipAt) < 6 && ms[2].slow > W.now, "the farthest is pulled to exactly the tip, slowed");
  assert.ok(Math.abs(ms[1].x - p.x - 100) < 8, "the others stay");
  W.ready();
  ms.forEach((o, j) => { o.x = p.x + 60 + j * 30; o.y = p.y; });
  p.focus = 5; p.focusAt = W.now;
  assert.ok(W.act({ t: "sk", i: 0 }).ok);
  const v2 = W.step();
  assert.ok(evts(v2, "fo").length === 1 && p.focus === 0, "full focus is spent");
  assert.ok(ms.every((o) => Math.abs(o.x - p.x - tipAt) < 8), "and hooks all three");
  for (const o of ms) o.dead = true;
}
{
  // 장대 도약, 깃발 꽂기, 회전 방벽, 투창, 백보일섬
  const W = world("도약", "lancer");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[30, 0], [80, 0]]);
  const x0 = p.x;
  assert.ok(W.act({ t: "sk", i: 1 }).ok);
  W.step();
  assert.ok(p.x > ms[0].x + 10, "over the first and down beyond it");
  assert.ok(ms[1].hp < 50000 && p.tipNext > W.now, "landing hard, the next blow certain to find the tip");
  ms[1].x = p.x + 14; p.atkAt = 0;
  W.act({ t: "atk" });
  assert.ok(evts(W.step(), "tip").length === 1, "a tip hit from up close, after the vault");
  for (const o of ms) o.dead = true;
  // the banner
  W.ready();
  const acd0 = W.self().acd;
  assert.ok(W.act({ t: "sk", i: 2 }).ok);
  W.step(); W.step();
  const [m] = W.mobs([[30, 24]]);
  W.step(600);
  assert.ok(W.self().acd < acd0 * 0.85, "the banner hurries the lancer");
  assert.ok(m.slow > W.now, "and slows the monster beside it");
  p.x += 200; p.mvAt = W.now; W.step();
  assert.equal(W.self().acd, acd0, "but only beside it");
  p.x -= 200; m.dead = true;
  // the wheel turns aside what is shot at it
  W.ready();
  assert.ok(W.act({ t: "sk", i: 3 }).ok);
  W.step();
  const rt = W.rt;
  const shooter = W.mobs([[60, 0]])[0];
  rt.tele.push({ x: p.x, y: p.y, r: 13, at: W.now + 50, dmg: 500, by: shooter, ev: "q" });
  const h0 = p.hp;
  const v = W.step(100);
  assert.ok(p.hp === h0 && evts(v, "bl").length === 1, "a shot is blocked by the spinning spear");
  shooter.dead = true;
  // the javelin pins a monster to a wall: find a wall to throw at
  const mp = W.map;
  let wall = null;
  for (let y = 4; y < mp.h - 4 && !wall; y++) for (let x = 12; x < mp.w - 4 && !wall; x++) {
    const solid = (tx, ty) => mp.o[ty][tx] !== " " || "wW".includes(mp.g[ty][tx]);
    if (!solid(x, y)) continue;
    let ok = true;
    for (let k = 1; k <= 7 && ok; k++) for (let dy = -1; dy <= 1 && ok; dy++) if (solid(x - k, y + dy)) ok = false;
    if (ok) wall = [x, y];
  }
  assert.ok(wall, "a wall to pin against");
  W.ready();
  p.x = (wall[0] - 6) * T + 8; p.y = wall[1] * T + 10; p.dir = 2; p.aim = 0;
  const [pm] = W.mobs([[48, 0]]);
  pm.x = p.x + 48;
  assert.ok(W.act({ t: "sk", i: 4 }).ok);
  const vj = W.step();
  assert.ok(evts(vj, "wl").length === 1 && pm.stun > W.now + 1500, "벽꿍 — pinned and stunned");
  pm.dead = true;
}
{
  const W = world("백보", "lancer");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[40, 0], [90, 0], [130, 0]]);
  p.focus = 5; p.focusAt = W.now;
  const x0 = p.x;
  assert.ok(W.act({ t: "sk", i: 5 }).ok);
  const v = W.step();
  assert.ok(p.x > x0 + 120 && p.focus === 0, "the lancer is through, focus spent");
  assert.ok(ms.every((o) => o.hp < 50000) && evts(v, "tip").length >= 3, "every one passed takes the tip");
}

// ═════════ 마도사 ═════════
{
  const W = world("원소", "mage");
  const p = W.p;
  W.ready();
  const ms = W.mobs([[40, 0], [48, 8], [36, -6]]);
  assert.ok(W.act({ t: "sk", i: 0 }).ok);
  let v = W.step();
  assert.equal(v.me[9], 1, "fire is held");
  assert.ok(!evts(v, "rx").length, "one element alone makes nothing");
  assert.ok(W.act({ t: "sk", i: 1 }).ok);
  v = W.step();
  assert.equal(evts(v, "rx")[0][1], 1, "fire then ice: steam");
  assert.equal(v.me[9], 0, "and both are used up");
  assert.ok(W.act({ t: "sk", i: 3 }).ok);
  v = W.step();
  assert.ok(!evts(v, "rx").length, "lightning on nothing");
  W.ready();
  for (const o of ms) { o.x = p.x + 40; o.y = p.y; }
  assert.ok(W.act({ t: "sk", i: 1 }).ok);
  v = W.step();
  assert.equal(evts(v, "rx")[0][1], 2, "lightning then ice: superconduct");
  assert.ok(ms.some((o) => o.vuln > W.now), "which leaves monsters open");
  W.ready();
  W.act({ t: "sk", i: 3 }); W.step();
  W.act({ t: "sk", i: 0 });
  v = W.step();
  assert.equal(evts(v, "rx")[0][1], 3, "lightning then fire: overload");
  // the held element fades
  W.ready();
  W.act({ t: "sk", i: 0 }); W.step();
  for (let i = 0; i < 55; i++) W.step(100);
  assert.equal(W.step().me[9], 0, "an element is held for five seconds");
  // superconducted monsters take more
  ms[1].dead = true; ms[2].dead = true;
  const hurt = (vuln) => { const [m] = ms; let t = 0; for (let i = 0; i < 20; i++) { m.hp = 50000; m.vuln = vuln ? W.now + 9999 : 0; m.x = p.x + 40; m.y = p.y; p.atkAt = 0; W.act({ t: "atk" }); t += 50000 - m.hp; W.step(1100); } return t; };
  const a = hurt(false), b = hurt(true);
  assert.ok(b > a * 1.15, `superconduct: ${a} → ${b}`);
  for (const o of ms) o.dead = true;
}
{
  // the teapot, the rewind, the surge
  const W = world("찻주전자", "mage");
  const p = W.p;
  W.ready();
  const mhp = W.self().mhp;
  p.hp = Math.round(mhp * 0.3);
  assert.ok(W.act({ t: "sk", i: 2 }).ok);
  let v = W.step();
  assert.equal(evts(v, "tp").length, 1, "a teapot is set down");
  const h0 = p.hp;
  for (let i = 0; i < 85; i++) W.step(100);
  assert.ok(p.hp - h0 > mhp * 0.3, `tea mends (${p.hp - h0} of ${mhp})`);
  // rewind: back where the mage stood three seconds ago, with the health they had
  W.ready();
  p.hp = Math.round(mhp * 0.9);
  const x0 = p.x, y0 = p.y;
  for (let i = 0; i < 10; i++) W.step(100);
  p.x += 60; p.mvAt = W.now;
  for (let i = 0; i < 20; i++) { W.step(100); }
  p.hp = Math.round(mhp * 0.3);
  p.cds[0] = W.now + 4000;
  assert.ok(W.act({ t: "sk", i: 4 }).ok);
  W.step();
  assert.ok(Math.abs(p.x - x0) < 2 && Math.abs(p.y - y0) < 2, "back to where it stood");
  assert.ok(p.hp > mhp * 0.8, "and as hale as it was");
  assert.ok(p.cds[0] - W.now <= 2000, "with the element spells' wait cut");
  // surge: no cost, half the wait, every cast reacts
  W.ready();
  const ms = W.mobs([[40, 0], [44, 6]]);
  assert.ok(W.act({ t: "sk", i: 5 }).ok);
  W.step();
  const s = W.self();
  assert.deepEqual([s.skm[0], s.skm[1], s.skm[3]], [0, 0, 0], "element spells cost nothing in a surge");
  p.mp = 0;
  for (let i = 0; i < 4; i++) p.cds[i] = 0;
  assert.ok(W.act({ t: "sk", i: 0 }).ok, "even with an empty pool");
  v = W.step();
  assert.ok(p.cds[0] - W.now < D.skills.mage[0].cd * 0.6, "and comes back in half the time");
  assert.equal(evts(v, "rx").length, 1, "every cast reacts, even the first");
  for (let i = 0; i < 90; i++) W.step(100);
  assert.equal(W.self().skm[0], D.skills.mage[0].mp, "until the surge ends");
  for (const o of ms) o.dead = true;
}

// ── trained skill levels carry over from the old kits slot by slot
{
  const S = L.setup();
  const ch = L.newChar("옛전사", "warrior", []);
  ch.lvl = 40; ch.skl = [4, 3, 2, 1, 6, 10]; ch.v = 5;
  L.addPlayer(S, "pid-old", ch);
  assert.deepEqual(S.players["pid-old"].ch.skl, [4, 3, 2, 1, 6, 10], "levels stay with their slot");
  const out = L.removePlayer(S, "pid-old");
  assert.ok(!("grit" in out) && !("sword" in out), "nothing of the fight is saved with the sheet");
}

console.log("skills ok");
