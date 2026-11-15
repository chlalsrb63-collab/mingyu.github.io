// Headless test of the dash (Space, 59-dash.js): how far and which way, what stops it, its cooldown,
// the dodge window, what it cancels, and that it never carries anyone through a wall.
// node tests/dash.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const [AIM_N] = D.aim;
const [PX, MS, CD, INV] = D.dash;
assert.deepEqual(D.dash, [72, 180, 4000, 60], "the dash as designed: 72 px in 180 ms, every 4 s, 60 ms more of safety");

function world(name, mapId) {
  const S = L.setup();
  let now = 1_000_000;
  S.now = now;
  const PID = "pid-" + name;
  L.addPlayer(S, PID, L.hero(name, { wk: "sword", lvl: 157, migrate: true }));
  const W = {
    S, PID,
    get now() { return now; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, PID))); L.endTick(S); return v; },
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    wait(ms) { now += ms; S.now = now; },
    get p() { return S.players[PID]; },
    get rt() { return S.maps[S.players[PID].map]; },
  };
  const p = W.p;
  L.runtime(S, p.map).n--; p.map = mapId; L.runtime(S, mapId).n++; p.sendMap = true;
  const mp = (W.map = W.step().map);
  W.solid = (px, py) => {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    return tx < 0 || ty < 0 || tx >= mp.w || ty >= mp.h || mp.o[ty][tx] !== " " || "wW".includes(mp.g[ty][tx]);
  };
  W.canStand = (x, y) => !(W.solid(x - 4, y - 5) || W.solid(x + 4, y - 5) || W.solid(x - 4, y) || W.solid(x + 4, y));
  W.gate = (x, y) => mp.portals.some((pt) => Math.hypot(x - (pt.x * T + 8), y - 3 - (pt.y * T + 8)) < 12);
  /** Stand at (x, y), rested, the dash ready, every monster put away. */
  W.at = (x, y) => {
    p.x = x; p.y = y; p.mvAt = now; p.fix = false; p.dead = false; p.sit = false; p.fish = null; p.gat = null;
    p.hp = 1e6; p.stag = 0; p.dance = null; p.dashAt = 0; p.dodge = 0;
    for (const o of W.rt.mobs) { o.dead = true; o.respAt = now + 1e12; }
  };
  /** The dash events of the tick's stream so far. */
  W.evs = (code) => W.rt.ev.filter((e) => e[0] === code && e[1] === p.eid);
  return W;
}
/** A tile with `r` clear tiles all round it. */
function openSpot(W, r) {
  const mp = W.map, clear = (x, y) => !W.solid(x * T + 8, y * T + 8);
  for (let y = r + 2; y < mp.h - r - 2; y++) for (let x = r + 2; x < mp.w - r - 2; x++) {
    let ok = true;
    for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r && ok; dx++) if (!clear(x + dx, y + dy) || W.gate((x + dx) * T + 8, (y + dy) * T + 8)) ok = false;
    if (ok) return [x * T + 8, y * T + 10];
  }
  assert.fail("open ground");
}
const dirOf = (i) => [Math.cos((i / AIM_N) * 2 * Math.PI), Math.sin((i / AIM_N) * 2 * Math.PI)];

// ── 1. all eight facings: 72 px, straight along the aim, one event for the trail ──
{
  const W = world("eight", "meadow");
  const [hx, hy] = openSpot(W, 6);
  for (let k = 0; k < 8; k++) {
    const a = (k * AIM_N) / 8, [ux, uy] = dirOf(a);
    W.at(hx, hy);
    W.rt.ev.length = 0;
    assert.ok(W.act({ t: "dash", a }).ok, `facing ${k}: allowed`);
    const p = W.p;
    assert.ok(Math.abs(Math.hypot(p.x - hx, p.y - hy) - PX) < 0.01, `facing ${k}: ${PX} px (got ${Math.hypot(p.x - hx, p.y - hy)})`);
    assert.ok(Math.abs(p.x - (hx + ux * PX)) < 0.01 && Math.abs(p.y - (hy + uy * PX)) < 0.01, `facing ${k}: along the aim`);
    assert.equal(p.aim, a, "the aim sent with it is the aim taken");
    assert.ok(p.fix, "the client does not predict it: the server end point goes out as a position fix");
    const ds = W.evs("ds");
    assert.equal(ds.length, 1, "one trail event");
    assert.deepEqual(ds[0].slice(2), [hx, hy, Math.round(p.x), Math.round(p.y)], "from where to where");
  }
  // with no aim sent, the way the player already faces
  W.at(hx, hy);
  W.p.aim = AIM_N / 2;
  assert.ok(W.act({ t: "dash" }).ok);
  assert.ok(Math.abs(W.p.x - (hx - PX)) < 0.01 && Math.abs(W.p.y - hy) < 0.01, "no aim sent: the standing aim (west)");
  assert.equal(W.act({ t: "dash", a: 999 }).ok, false, "a bad aim is refused");
  assert.equal(W.act({ t: "dash", a: 1.5 }).ok, false, "a bad aim is refused");
}

// ── 2. cooldown: 4 s, refused in silence ──
{
  const W = world("cool", "meadow");
  const [hx, hy] = openSpot(W, 6);
  W.at(hx, hy);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  const x1 = W.p.x;
  for (const ms of [100, 1000, 2000, 3500, 3900]) {
    W.at(hx, hy); W.p.dashAt = W.now - ms;
    const v = W.act({ t: "dash", a: 0 });
    assert.equal(v.ok, false, `refused ${ms} ms after the last`);
    assert.equal(v.error, "dash", "a quiet code, not a Korean toast");
    assert.equal(W.p.x, hx, "and nobody moved");
  }
  W.at(hx, hy); W.p.dashAt = W.now - CD;
  assert.ok(W.act({ t: "dash", a: 0 }).ok, "allowed again after 4 s");
  assert.equal(W.p.x, x1);
  // in real time too: dash, wait, dash
  const W2 = world("cool2", "meadow");
  W2.at(hx, hy);
  assert.ok(W2.act({ t: "dash", a: 0 }).ok);
  W2.wait(2000); assert.equal(W2.act({ t: "dash", a: AIM_N / 2 }).ok, false);
  W2.wait(1900); assert.equal(W2.act({ t: "dash", a: AIM_N / 2 }).ok, false);
  W2.wait(100); assert.ok(W2.act({ t: "dash", a: AIM_N / 2 }).ok);
  assert.ok(Math.abs(W2.p.x - hx) < 0.01, "there and back");
  // the snapshot: the position is corrected (me[5]) and the cooldown rides last in `me` (me[11], ms left)
  let v = W2.step(0);
  assert.equal(v.me[5], 1, "the server's end point is pushed to the client");
  assert.equal(v.me[11], CD, "the full cooldown right after");
  v = W2.step(1500);
  assert.equal(v.me[5], 0);
  assert.equal(v.me[11], CD - 1500);
  v = W2.step(CD);
  assert.equal(v.me[11], 0, "0 when ready");
  assert.equal(W2.p.toast.filter((s) => /대시|회피|dash/.test(String(s))).length, 0, "no toast for a refused dash");
}

// ── 3. walls, water, the map's edge, gates: every dash ends on ground a walker could stand on ──
for (const mapId of ["meadow", "crypt", "town"]) {
  const W = world("walls-" + mapId, mapId);
  const mp = W.map;
  // which standable tiles a walker can reach from which (4-way: the feet box cannot squeeze through a corner)
  const comp = new Int32Array(mp.w * mp.h).fill(-1);
  let nComp = 0;
  for (let i = 0; i < mp.w * mp.h; i++) {
    if (comp[i] >= 0 || W.solid((i % mp.w) * T + 8, Math.floor(i / mp.w) * T + 8)) continue;
    const q = [i]; comp[i] = nComp;
    while (q.length) {
      const c = q.pop(), cx = c % mp.w, cy = Math.floor(c / mp.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, y = cy + dy, j = y * mp.w + x;
        if (x < 0 || y < 0 || x >= mp.w || y >= mp.h || comp[j] >= 0 || W.solid(x * T + 8, y * T + 8)) continue;
        comp[j] = nComp; q.push(j);
      }
    }
    nComp++;
  }
  const tileOf = (x, y) => Math.floor(y / T) * mp.w + Math.floor(x / T);
  let tried = 0, short = 0, slid = 0;
  for (let ty = 1; ty < mp.h - 1; ty += 2) for (let tx = 1 + (ty % 3); tx < mp.w - 1; tx += 3) {
    const x0 = tx * T + 8, y0 = ty * T + 10;
    if (!W.canStand(x0, y0) || W.gate(x0, y0)) continue;
    for (let k = 0; k < 16; k++) {
      const a = (k * AIM_N) / 16, [ux, uy] = dirOf(a);
      W.at(x0, y0);
      const from = W.p.map;
      assert.ok(W.act({ t: "dash", a }).ok);
      const p = W.p, far = Math.hypot(p.x - x0, p.y - y0);
      tried++;
      assert.equal(p.map, from, `${mapId}: a dash never goes through a gate`);
      assert.ok(W.canStand(p.x, p.y), `${mapId} (${tx},${ty}) aim ${a}: ends on standable ground`);
      assert.ok(!W.gate(p.x, p.y), `${mapId} (${tx},${ty}) aim ${a}: ends short of a gate`);
      assert.ok(p.x >= 0 && p.y >= 0 && p.x < mp.w * T && p.y < mp.h * T, "inside the map");
      assert.ok(far <= PX + 0.01, `${mapId}: never further than ${PX} px`);
      assert.equal(comp[tileOf(p.x, p.y)], comp[tileOf(x0, y0)], `${mapId} (${tx},${ty}) aim ${a}: never into ground it could not walk to`);
      // never backwards, and never sideways further than a slide along a wall allows
      assert.ok((p.x - x0) * ux + (p.y - y0) * uy >= -0.01, "never backwards");
      if (far < PX - 0.01) short++;
      // the path it swept, re-walked here with the test's own collision: every 4 px standable, the same end
      // (a slide round a corner can rejoin the straight line, so the end alone says nothing about the path)
      let sx = x0, sy = y0, slidHere = false;
      const freeT = (x, y) => W.canStand(x, y) && !W.gate(x, y), slant = Math.abs(ux) > 0.01 && Math.abs(uy) > 0.01;
      for (let d = 4; d <= PX; d += 4) {
        const nx = sx + ux * 4, ny = sy + uy * 4;
        if (freeT(nx, ny)) { sx = nx; sy = ny; }
        else if (slant && freeT(nx, sy)) { sx = nx; slidHere = true; }
        else if (slant && freeT(sx, ny)) { sy = ny; slidHere = true; }
        else break;
        assert.ok(W.canStand(sx, sy), `${mapId} (${tx},${ty}) aim ${a} d ${d}: every step of the way is standable`);
      }
      assert.ok(Math.abs(sx - p.x) < 0.01 && Math.abs(sy - p.y) < 0.01, `${mapId} (${tx},${ty}) aim ${a}: the sweep ends where the server put them`);
      if (slidHere) slid++;
      // head-on (along a tile axis) it stops dead at the first thing in the way
      if (k % 4 === 0 && far < PX - 0.01) {
        const nx = p.x + ux * 4, ny = p.y + uy * 4;
        assert.ok(!W.canStand(nx, ny) || W.gate(nx, ny), `${mapId}: stopped by something right ahead`);
      }
    }
  }
  assert.ok(tried > 400 && short > 20, `${mapId}: the sweep met walls (${tried} dashes, ${short} cut short, ${slid} slid)`);
  if (mapId === "crypt") assert.ok(nComp >= 1 && short > 100, "the crypt's walls cut many dashes short");
}
// water and the map's edge by name: next to a pond, and next to the border
{
  const W = world("water", "meadow");
  const mp = W.map;
  let pond = null, edge = null;
  for (let y = 2; y < mp.h - 2 && !(pond && edge); y++) for (let x = 3; x < mp.w - 2; x++) {
    const open2 = !W.solid((x - 1) * T + 8, y * T + 8) && !W.solid((x - 2) * T + 8, y * T + 8) && W.canStand((x - 2) * T + 8, y * T + 10);
    if (!pond && mp.g[y][x] === "w" && mp.o[y][x] === " " && open2) pond = [x, y];
    if (!edge && W.solid((x + 1) * T + 8, y * T + 8) && x + 5 >= mp.w - 1 && [1, 2, 3, 4, 5].every((d) => x + d >= mp.w || W.solid((x + d) * T + 8, y * T + 8)) && !W.solid(x * T + 8, y * T + 8) && W.canStand((x - 1) * T + 8, y * T + 10)) edge = [x, y];
  }
  if (pond) {
    W.at((pond[0] - 2) * T + 8, pond[1] * T + 10);
    assert.ok(W.act({ t: "dash", a: 0 }).ok);
    assert.ok(W.p.x < pond[0] * T - 3.99, "stops at the water's edge");
    assert.ok(W.p.x - ((pond[0] - 2) * T + 8) < PX, "cut short by water");
  }
  assert.ok(pond, "the meadow has water to test against");
  if (edge) {
    W.at((edge[0] - 1) * T + 8, edge[1] * T + 10);
    assert.ok(W.act({ t: "dash", a: 0 }).ok);
    assert.ok(W.p.x < mp.w * T && W.canStand(W.p.x, W.p.y), "stops inside the map's edge");
  }
}

// ── 4. the dodge window: a slam landing mid-dash misses, one landing after it lands ──
{
  const W = world("dodge", "meadow");
  const [hx, hy] = openSpot(W, 6);
  const slam = (x, y, inMs) => W.rt.tele.push({ x, y, r: 200, at: W.now + inMs, dmg: 400, by: null });
  // no dash: it lands
  W.at(hx, hy);
  slam(hx, hy, 100);
  let v = W.step(100);
  assert.ok(W.p.hp < 1e6, "a slam hurts whoever stands in it");
  assert.ok(!v.ev.some((e) => e[0] === "dg"), "no 회피 without a dash");
  // dash, the slam lands 100 ms and 200 ms in (still inside its circle: only the window saves you)
  for (const at of [100, 200]) {
    W.at(hx, hy);
    assert.ok(W.act({ t: "dash", a: 0 }).ok);
    slam(hx, hy, at);
    let got = [];
    for (let k = 0; k < at / 100; k++) got = got.concat(W.step(100).ev);
    assert.equal(W.p.hp, 1e6, `a slam ${at} ms into the dash misses`);
    assert.equal(got.filter((e) => e[0] === "dg" && e[1] === W.p.eid).length, 1, "회피! once");
    assert.ok(!W.p.stag || W.p.stag <= W.now - at, "and it does not make them reel");
  }
  // the window is the dash + 60 ms: at 300 ms it lands again
  W.at(hx, hy);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  assert.equal(W.p.dodge, W.now + MS + INV, "safe for the dash and 60 ms more");
  slam(hx, hy, 300);
  W.step(100); W.step(100);
  assert.equal(W.p.hp, 1e6, "nothing yet");
  v = W.step(100);
  assert.ok(W.p.hp < 1e6, "a slam after the window lands");
  assert.ok(!v.ev.some((e) => e[0] === "dg"));
  // a puddle bites after the window too, not in it
  W.at(hx, hy);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  W.rt.pools.push({ x: W.p.x, y: W.p.y, r: 300, until: W.now + 5000, next: W.now, dmg: 300, kind: 0, atk: 100 });
  W.step(100);
  assert.equal(W.p.hp, 1e6, "a puddle does not bite mid-dash");
  assert.ok(!W.p.poison, "nor leave its mark");
  for (let k = 0; k < 10; k++) W.step(100);
  assert.ok(W.p.hp < 1e6, "it bites once the window is over");
  W.rt.pools.length = 0;
  // what was already on them keeps biting: a dash cleanses nothing
  W.at(hx, hy);
  W.p.poison = { until: W.now + 6000, next: W.now + 100, dmg: 50 };
  W.p.burn = null;
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  W.step(100);
  assert.ok(W.p.poison, "poison stays");
  assert.equal(W.p.hp, 1e6 - 50, "and bites mid-dash");
  W.p.poison = null;
}

// ── 5. what blocks it, what it cancels ──
{
  const W = world("state", "meadow");
  const [hx, hy] = openSpot(W, 6);
  // down: refused
  W.at(hx, hy); W.p.dead = true;
  let v = W.act({ t: "dash", a: 0 });
  assert.equal(v.ok, false, "no dash while down");
  assert.equal(v.error, "쓰러진 상태입니다", "the shared refusal for anything done while down (the client sends none)");
  assert.equal(W.p.x, hx);
  // reeling from a blow: refused with the quiet code the attack uses
  W.at(hx, hy); W.p.stag = W.now + 200;
  v = W.act({ t: "dash", a: 0 });
  assert.equal(v.ok, false, "no dash while reeling");
  assert.equal(v.error, "stag");
  // sitting: the dash stands them up
  W.at(hx, hy); W.p.sit = true;
  assert.ok(W.act({ t: "dash", a: 0 }).ok, "a dash from a seat");
  assert.equal(W.p.sit, false, "stands up");
  assert.ok(W.p.x > hx + PX - 1);
  // a recall being read is broken, as by a step
  W.at(hx, hy); W.p.recall = { at: W.now + 3000 };
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  assert.equal(W.p.recall, null, "a recall is broken");
  // a line in the water comes in
  W.at(hx, hy); W.p.fish = { at: W.now + 5000 };
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  assert.equal(W.p.fish, null, "fishing ends");
  // gathering stops
  W.at(hx, hy); W.p.gat = { i: 0, k: 0, map: W.p.map, x: hx, y: hy, at: W.now, end: W.now + 3000, tapAt: W.now + 1000 };
  W.rt.ev.length = 0;
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  assert.equal(W.p.gat, null, "gathering stops");
  assert.ok(W.rt.ev.some((e) => e[0] === "ga" && e[3] === -1), "and says so");
  // a parcel in hand does not stop it
  W.at(hx, hy); W.p.parcel = { id: "x" };
  assert.ok(W.act({ t: "dash", a: 0 }).ok, "a parcel does not stop a dash");
  assert.ok(W.p.parcel, "and stays in hand");
  W.p.parcel = null;
  // the walk that follows from where it ended is taken without a fix
  W.at(hx, hy);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  const ex = W.p.x;
  W.step(200); // the snapshot carrying the fix has gone out
  assert.ok(W.act({ t: "mv", x: ex + 6, y: hy, d: 2, a: 0 }).ok);
  assert.ok(!W.p.fix && Math.abs(W.p.x - (ex + 6)) < 0.01, "walking on from the end is not a correction");
  // a walk from where the dash began (a client that never dashed) is put right
  W.at(hx, hy);
  assert.ok(W.act({ t: "dash", a: 0 }).ok);
  W.wait(100);
  W.act({ t: "mv", x: hx + 4, y: hy, d: 2, a: 0 });
  assert.ok(W.p.fix && W.p.x === ex, "the server's end stands");
}
// in town it works too (movement only)
{
  const W = world("town", "town");
  // the square is busy (stalls, trees, fountains): any spot with 72 px of clear street to the south
  let hx = 0, hy = 0;
  const clearSouth = (x, y) => { for (let d = 0; d <= PX; d += 4) if (!W.canStand(x, y + d) || W.gate(x, y + d)) return false; return true; };
  for (let ty = 2; ty < W.map.h - 8 && !hx; ty++) for (let tx = 2; tx < W.map.w - 2 && !hx; tx++) if (clearSouth(tx * T + 8, ty * T + 10)) { hx = tx * T + 8; hy = ty * T + 10; }
  assert.ok(hx, "a clear street in town");
  W.at(hx, hy);
  assert.ok(W.act({ t: "dash", a: AIM_N / 4 }).ok, "a dash in town");
  assert.ok(Math.abs(W.p.y - (hy + PX)) < 0.01);
}

// ── 6. determinism: the same world and the same presses end the same ──
{
  const run = () => {
    const W = world("same", "crypt");
    const out = [];
    const mp = W.map;
    let n = 0;
    for (let ty = 2; ty < mp.h - 2 && n < 40; ty += 3) for (let tx = 2; tx < mp.w - 2 && n < 40; tx += 5) {
      if (!W.canStand(tx * T + 8, ty * T + 10) || W.gate(tx * T + 8, ty * T + 10)) continue;
      W.at(tx * T + 8, ty * T + 10);
      W.act({ t: "dash", a: (n * 5) % AIM_N });
      const v = W.step(100);
      out.push([W.p.x, W.p.y, v.me.slice(0, 2), v.ev.filter((e) => e[0] === "ds")]);
      n++;
    }
    return JSON.stringify(out);
  };
  assert.equal(run(), run(), "deterministic");
}

console.log("dash: ok — 8 facings, walls/water/edge/gates, cooldown, dodge window, cancels, determinism");
