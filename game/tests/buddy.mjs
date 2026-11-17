import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const test = { BUDDY_COOLDOWN, COOP, COOP_APT, COOP_T, JOBS, MOBS, buddyOf, brewNote, brewDir, canStand, changeMap, coopSt, dealMob, mapOf, tilePx };\n";
const L = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const X = L.test, pid = "test-player", message = "지금 어디야? 혹시 같이 갈래?";

function session() {
  const S = L.setup();
  S.now = 100000;
  const sheet = L.newChar("산책하는 모험가", [], "sword");
  delete sheet.buddy;
  sheet.v = 28;
  L.addPlayer(S, pid, sheet);
  const p = S.players[pid];
  const act = (t, extra = {}) => {
    const action = { t, ...extra }, check = L.validateAction(S, pid, action);
    if (check.ok) L.applyAction(S, pid, action);
    return check;
  };
  const frames = [];
  const step = (ms = 100) => {
    for (let i = 0; i < ms; i += 100) {
      L.tick(S, S.now + 100);
      const frame = L.viewFor(S, pid);
      if (frame.bm || frame.bs || frame.cr || frame.who || frame.cj) frames.push(frame);
      L.endTick(S);
    }
  };
  assert.equal(p.ch.buddy, null);
  return { S, p, act, step, frames };
}

function invite(w) {
  assert.ok(w.act("buddy", { k: "call", m: message }).ok);
  w.step(1900);
  const b = X.buddyOf(w.S, w.p);
  assert.ok(b && b.eid);
  return b;
}

{
  const w = session(), { p, S, step, act, frames } = w;
  assert.equal(act("buddy", { k: "call", m: " " }).ok, false);
  assert.ok(act("buddy", { k: "call", m: message }).ok);
  assert.equal(act("buddy", { k: "new", m: message }).ok, false);
  step(100);
  assert.deepEqual(frames.at(-1).bm, [0, message]);
  step(800);
  assert.deepEqual(frames.at(-1).bm, [1, "지금 바로 갈게!"]);
  assert.equal(Object.keys(S.buddies).length, 0, "reply precedes arrival");
  step(1000);
  const b = X.buddyOf(S, p), profile = { ...p.ch.buddy };
  assert.equal(b.ch.lvl, p.ch.lvl);
  assert.ok(X.JOBS[b.ch.job].wk.includes(b.ch.wk) && b.ch.look.length === 11);
  assert.equal(L.playerCount(S), 1);
  assert.ok(frames.at(-1).who.some((row) => row[0] === b.eid && row[17] === 1));
  const trail = X.mapOf("blossom_trail");
  X.changeMap(S, p, trail.id, ...X.tilePx(trail.entry));
  step(23000);
  assert.equal(b.map, trail.id);
  assert.match(frames.findLast((f) => f.bs).bs[1], /꽃잎|분홍색/);
  const start = [b.x, b.y], point = trail.reach.findIndex((reach, i) => {
    const xy = X.tilePx([i % trail.w, Math.floor(i / trail.w)]);
    return reach && Math.hypot(xy[0] - b.x, xy[1] - b.y) > 70 && Math.hypot(xy[0] - b.x, xy[1] - b.y) < 110;
  });
  [p.x, p.y] = X.tilePx([point % trail.w, Math.floor(point / trail.w)]);
  step(3500);
  assert.ok(Math.hypot(b.x - p.x, b.y - p.y) < 35 && Math.hypot(b.x - start[0], b.y - start[1]) > 35);
  assert.ok(X.canStand(trail, b.x, b.y));
  p.ch.lvl = 8;
  step();
  assert.equal(b.ch.lvl, 8);
  assert.ok(act("buddy", { k: "leave" }).ok);
  assert.equal(Object.keys(S.buddies).length, 0);
  assert.equal(act("buddy", { k: "new", m: message }).ok, false);
  const sheet = structuredClone(L.removePlayer(S, pid));
  L.addPlayer(S, pid, sheet);
  assert.equal(act("buddy", { k: "new", m: message }).ok, false, "a reconnect cannot reset the cooldown");
  assert.ok(act("buddy", { k: "call", m: message }).ok);
  step(1900);
  assert.deepEqual(S.players[pid].ch.buddy, profile, "calling back keeps the same buddy and the original cooldown");
  S.now = profile.nextAt;
  assert.ok(act("buddy", { k: "new", m: message }).ok);
  step(1900);
  assert.notEqual(S.players[pid].ch.buddy.name, profile.name);
  assert.equal(S.players[pid].ch.buddy.nextAt, profile.nextAt + X.BUDDY_COOLDOWN);
  assert.equal(Object.keys(S.buddies).length, 1);
}

{
  const w = session(), b = invite(w), { p, S, step } = w, map = X.mapOf("meadow");
  X.changeMap(S, p, map.id, ...X.tilePx(map.entry));
  step(200);
  const rt = S.maps[map.id], mob = rt.mobs.find((m) => !m.dead && !X.MOBS[m.k].chest && m.el === 0);
  assert.ok(mob);
  [mob.x, mob.y] = [b.x, b.y];
  mob.stun = S.now + 6000;
  mob.hp = 3;
  step(400);
  assert.equal(mob.hp, 3, "a buddy never engages a neutral target");
  X.dealMob(S, rt, mob, p, 2, false);
  step(400);
  assert.ok(mob.dead && p.ch.kills > 0, "the owner's attack unlocks an assist with ordinary kill credit");
  assert.equal(L.playerCount(S), 1);
}

function shift(k) {
  const w = session(), b = invite(w), { S, p, act, step } = w;
  const j = X.COOP[k], npc = X.mapOf(j.lobby).npcs.find((n) => n.id === j.npc);
  X.changeMap(S, p, j.lobby, ...X.tilePx([npc.x, npc.y + 1]));
  step();
  assert.ok(act("coop_start", { k }).ok, k);
  const dim = S.dims[p.map], c = dim.coop;
  assert.deepEqual(Object.keys(c.pl), [pid, b.pid]);
  assert.equal(b.map, dim.id);
  step(X.COOP_T.briefMs);
  return { ...w, b, dim, c, j };
}

{
  const w = shift("apt"), { b, p, c, j, step, act } = w;
  const dump = () => { [p.x, p.y] = X.tilePx([j.st.dump[0] + 1, j.st.dump[1]]); step(300); };
  const finish = (shift) => {
    for (let i = 0; shift.state !== "end" && i < shift.total * 2; i++) {
      const worker = shift.pl[pid], trash = shift.ents.at(-1);
      if (worker.hold.length >= X.COOP_APT.binCap || !trash) dump();
      else { [p.x, p.y] = [trash.x, trash.y]; act("coop_act"); step(300); }
    }
    assert.equal(shift.state, "end");
  };
  const e = c.ents.at(-1);
  [p.x, p.y] = [e.x, e.y];
  assert.ok(act("coop_act").ok);
  dump();
  step(26000);
  assert.ok(c.pl[b.pid].pts >= X.COOP_APT.binCap, "a buddy picks up and empties a bin");
  assert.ok(c.pl[pid].pts > 0);
  const before = p.ch.gold;
  finish(c);
  assert.ok(p.ch.gold > before && p.ch.coopDone.includes("apt"));
  assert.ok(w.frames.findLast((f) => f.cr).cr[3].some((row) => row[3] === 2));
  assert.ok(act("coop_leave").ok);
  const npc = X.mapOf(j.lobby).npcs.find((n) => n.id === j.npc);
  [p.x, p.y] = X.tilePx([npc.x, npc.y + 1]);
  step();
  const paid = p.ch.gold;
  assert.ok(act("coop_start", { k: "apt" }).ok);
  step(X.COOP_T.briefMs);
  finish(w.S.dims[p.map].coop);
  assert.equal(p.ch.gold, paid, "repeating with a buddy cannot pay twice on the same day");
  assert.equal(w.frames.findLast((f) => f.cr).cr[5], 2);
}

{
  const { b, c, step } = shift("diner");
  step(29500);
  assert.ok(c.served >= 1 && c.pl[b.pid].pts > 0, "a buddy cooks and serves at least one real order");
}

{
  const w = shift("lib"), { b, c, step } = w;
  step(29500);
  assert.ok(c.done >= 2 && c.pl[b.pid].pts > 0, "a buddy lends and shelves returned books");
}

{
  const { b, p, c, j, S, act, step } = shift("forge");
  step(12000);
  const order = c.ents.find((e) => e.t === 8 && e.seated && !e.gone);
  assert.ok(order);
  const [cx, cy] = j.st.crate[order.m], [ax, ay] = j.st.anvil[0];
  [p.x, p.y] = X.tilePx([cx, cy + 1]); act("coop_act");
  step(300);
  [p.x, p.y] = X.tilePx([ax, ay + 1]); act("coop_act");
  const a = c.anvils[0];
  for (let i = 0; i < 40 && !a.pair; i++) step();
  assert.deepEqual(a.pair?.ids, [pid, b.pid]);
  while (a.pair && S.now < c.runAt + 29000) {
    const note = a.pair.noteAt;
    while (S.now < note && a.pair) step();
    if (a.pair && a.pair.noteAt === note) act("coop_act", { beat: 1 });
    step();
  }
  assert.equal(c.done, 1, "human tongs and buddy hammer finish a shared rhythm order");
}

{
  const { b, p, c, j, S, act, step } = shift("alch");
  [p.x, p.y] = X.tilePx([j.st.kiln[0], j.st.kiln[1] - 1]);
  assert.ok(act("coop_act").ok && c.pl[pid].bel);
  let i = 0;
  for (let t = 0; t < 700 && !c.done; t++) {
    if (S.now >= X.brewNote(c, i)) {
      const pc = c.pot.pc, max = pc ? [45, 60, 74, 90, 52, 84][pc.r] : 45;
      if (c.kiln.H < max - 5) act("coop_act", { d: X.brewDir(i) });
      i++;
    }
    step();
  }
  assert.ok(c.done > 0 && c.pl[b.pid].pts > 0, "the buddy gathers, brews, bottles and stocks while the player pumps");
}

console.log("buddy: messenger, save/cooldown, walking, hunting, five co-op jobs and rewards");
