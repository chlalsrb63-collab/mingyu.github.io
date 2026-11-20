import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const test = { BUDDY_ASSIST, BUDDY_COOLDOWN, BUDDY_PARTY_NOTICE, COOP, COOP_APT, COOP_BREW, COOP_T, JOBS, MOBS, buddyOf, brewNote, brewDir, canStand, changeMap, coopSt, dealMob, mapOf, tilePx };\n";
const L = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const X = L.test, pid = "test-player", message = "지금 어디야? 혹시 같이 갈래?";

function perform(S, id, t, extra = {}) {
  const action = { t, ...extra }, check = L.validateAction(S, id, action);
  if (check.ok) L.applyAction(S, id, action);
  return check;
}

function session(seed) {
  const S = L.setup();
  if (seed !== undefined) S.seed = seed;
  S.now = 100000;
  const sheet = L.newChar("산책하는 모험가", [], "sword");
  delete sheet.buddy;
  sheet.v = 28;
  L.addPlayer(S, pid, sheet);
  const p = S.players[pid];
  const act = (t, extra) => perform(S, pid, t, extra);
  const frames = [];
  const step = (ms = 100) => {
    for (let i = 0; i < ms; i += 100) {
      L.tick(S, S.now + 100);
      const frame = L.viewFor(S, pid);
      if (frame && (frame.bm || frame.bs || frame.cr || frame.who || frame.cj)) frames.push(frame);
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
  const { S, act, step } = session();
  assert.ok(act("buddy", { k: "call", m: message }).ok);
  step(500);
  const saved = structuredClone(L.removePlayer(S, pid));
  L.addPlayer(S, pid, saved);
  step(5000);
  assert.equal(Object.keys(S.buddies).length, 0, "reconnecting cannot skip the reply of an unfinished invitation");
  assert.equal(S.players[pid].ch.buddy.nextAt, saved.buddy.nextAt);
  assert.ok(act("buddy", { k: "call", m: message }).ok);
  step(1900);
  assert.equal(X.buddyOf(S, S.players[pid]).ch.name, saved.buddy.name);
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
  step(165000);
  const lines = frames.flatMap((frame) => frame.bs ? [frame.bs[1]] : []);
  assert.ok(lines.length >= 4 && new Set(lines.slice(0, 4)).size === 4, "walking chatter varies within the same location");
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
  mob.hp = 20;
  step(400);
  assert.equal(mob.hp, 20, "a buddy never engages a neutral target");
  X.dealMob(S, rt, mob, p, 5, false);
  step(400);
  assert.equal(mob.hp, 15, "damage-over-time and other secondary damage do not earn assist hits");
  X.dealMob(S, rt, mob, p, 1, false, 0, null, { trackBuddy: true });
  step(500);
  assert.equal(mob.hp, 14, "an insufficient allowance never rounds up to a free hit");
  X.dealMob(S, rt, mob, p, 13, false, 0, null, { trackBuddy: true });
  step(400);
  assert.ok(mob.dead && p.ch.kills > 0, "the owner's attack unlocks an assist with ordinary kill credit");
  assert.equal(L.playerCount(S), 1);
}

{
  const w = session(), b = invite(w), { p, S, step } = w, map = X.mapOf("meadow");
  X.changeMap(S, p, map.id, ...X.tilePx(map.entry));
  step(200);
  const rt = S.maps[p.map], mob = rt.mobs.find((m) => !m.dead && !X.MOBS[m.k].chest && m.el === 0);
  [mob.x, mob.y] = [b.x, b.y]; mob.stun = S.now + 14000; mob.hp = 80;
  const dealt = 20;
  X.dealMob(S, rt, mob, p, dealt, false, 0, null, { trackBuddy: true });
  const origin = { x: b.x, y: b.y };
  rt.tele.push({ ...origin, r: 17, at: S.now + 1200, dmg: 0 });
  step(450);
  assert.equal(mob.hp, 80 - dealt, "the buddy moves out of a marked area before resuming attacks");
  assert.ok(Math.hypot(origin.x - b.x, origin.y - b.y) > 16);
  step(4700);
  const assisted = 80 - dealt - mob.hp;
  assert.ok(assisted > 0 && assisted <= Math.floor(dealt * X.BUDDY_ASSIST.share));
  const before = mob.hp;
  step(4000);
  assert.equal(mob.hp, before, "expired assistance does not continue farming");
  const groupedDamage = 10;
  mob.el = 2;
  X.dealMob(S, rt, mob, p, groupedDamage, false, 0, null, { trackBuddy: true });
  assert.equal(b.engaged.get(mob).credit, groupedDamage * X.BUDDY_ASSIST.bossShare);
}

const peer = "other-player";
function addPeer(S, sheet = L.newChar("산책 친구", [], "bow")) {
  L.addPlayer(S, peer, sheet);
  return S.players[peer];
}
function joinParty(S, leader, member) {
  assert.ok(perform(S, leader.pid, "pinv", { e: member.eid }).ok);
  assert.ok(perform(S, member.pid, "pacc").ok);
}

{
  const w = session(), { S, p, act, step, frames } = w, other = addPeer(S);
  invite(w);
  assert.ok(perform(S, peer, "buddy", { k: "call", m: message }).ok);
  const original = p.ch.buddy.nextAt;
  joinParty(S, p, other);
  assert.equal(Object.keys(S.buddies).length, 0, "party creation removes the NPC before the next tick");
  assert.equal(other.buddyCall, null, "a concurrent reply cannot summon after joining a party");
  assert.equal(p.ch.buddy.active, false);
  assert.equal(p.ch.buddy.nextAt, original);
  assert.ok(p.toast.includes(X.BUDDY_PARTY_NOTICE) && other.toast.includes(X.BUDDY_PARTY_NOTICE));
  step(5000);
  assert.deepEqual(frames.findLast((f) => f.bm).bm, [2, X.BUDDY_PARTY_NOTICE]);
  for (const id of [pid, peer]) for (const k of ["call", "new"]) {
    assert.match(perform(S, id, "buddy", { k, m: message }).error, /파티 중에는 짝꿍/);
  }
  const otherSave = structuredClone(L.removePlayer(S, peer));
  assert.equal(p.party, 0);
  invite(w);
  addPeer(S, otherSave);
  assert.ok(p.party, "rejoining restores the human party");
  assert.equal(X.buddyOf(S, p), undefined, "rejoining also dismisses an active buddy");
  const save = structuredClone(L.removePlayer(S, pid));
  L.addPlayer(S, pid, save);
  step(2000);
  assert.equal(Object.keys(S.buddies).length, 0);
  assert.ok(act("pleave").ok);
  step(1000);
  assert.equal(Object.keys(S.buddies).length, 0, "a dismissed buddy does not auto-return when the party disbands");
  assert.ok(act("buddy", { k: "call", m: message }).ok, "the original contact remains callable once solo");
}

function shift(k, seed) {
  const w = session(seed), b = invite(w), { S, p, act, step } = w;
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
  const { b, c, dim, act, S, p, step } = shift("apt");
  assert.ok(c.pl[b.pid]);
  const other = addPeer(S);
  joinParty(S, other, p);
  step();
  assert.equal(S.dims[dim.id], undefined, "joining a human party ends the unfinished NPC shift");
  assert.equal(p.map, c.home[0]);
  assert.equal(Object.keys(S.buddies).length, 0);
  assert.equal(p.ch.coopDone.includes("apt"), false);
  assert.match(act("buddy", { k: "call", m: message }).error, /파티 중에는 짝꿍/);
}

for (const reason of ["leave", "disconnect"]) {
  const { S, p, dim, act, step } = shift("lib");
  if (reason === "leave") assert.ok(act("coop_leave").ok);
  else L.removePlayer(S, pid);
  step();
  assert.equal(S.dims[dim.id], undefined, "a solo shift frees its map immediately");
  assert.ok(Object.values(S.buddies).every((b) => b.map !== dim.id));
  assert.equal(p.ch.coopDone.includes("lib"), false);
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

for (const seed of [20251111, 808093]) {
  const { b, c, step } = shift("diner", seed);
  step(29500);
  assert.ok(c.served >= 1 && c.pl[b.pid].pts > 0, "a buddy cooks and serves at least one real order");
}

for (const seed of [20251111, 808093]) {
  const { b, c, step } = shift("lib", seed);
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

{
  const { b, p, c, j, S, act, step } = shift("alch"), q = c.pl[pid], B = X.COOP_BREW;
  const [rx, ry] = j.st.rack, [hx, hy] = j.st.herbs, [px, py] = j.st.pot;
  [p.x, p.y] = X.tilePx([rx + 1, ry]);
  act("coop_act");
  assert.equal(q.tool, "fan");
  [p.x, p.y] = X.tilePx([hx + 1, hy]);
  step(1500);
  act("coop_act");
  assert.ok(q.herb);
  for (const d of B.orders[q.herb.r].herbs) { step(100); act("coop_act", { d }); }
  assert.equal(q.hold[0].st, "herbs");
  [p.x, p.y] = X.tilePx([px, py + 1]);
  step(300); act("coop_act");
  assert.equal(c.pot.st, 1);
  let peaked = c.kiln.H;
  for (let t = 0; t < 240 && c.pot.st === 1; t++) { step(); peaked = Math.max(peaked, c.kiln.H); }
  assert.equal(c.pl[b.pid].tool, "bellows");
  assert.ok(peaked >= B.orders[c.pot.pc.r].lo && c.pot.pc.ch[b.pid] > 0, "after a role swap, the buddy heats the player's recipe in rhythm");
  assert.equal(c.pot.st, 2);
  act("coop_act");
  assert.equal(q.hold[0].st, "potion");
  const shelf = j.st.shelf[2];
  [p.x, p.y] = X.tilePx([shelf[0] - 1, shelf[1]]);
  step(300); act("coop_act");
  assert.ok(c.ents.some((e) => e.t === 10));
  assert.ok(S.now - q.workAt < 1000);
}

// AI stance modes: neutral (default), attack (proactive), guard (intercept + heal), passive (no combat) + persistence
{
  const w = session(), b = invite(w), { p, S, act, step } = w, map = X.mapOf("meadow");
  assert.equal(p.ch.buddy.ai, "neutral");
  assert.equal(act("buddy", { k: "ai", ai: "bogus" }).ok, false);
  X.changeMap(S, p, map.id, ...X.tilePx(map.entry));
  step(200);
  const rt = S.maps[map.id], mob = rt.mobs.find((m) => !m.dead && !X.MOBS[m.k].chest && m.el === 0);
  [mob.x, mob.y] = [b.x, b.y];
  mob.stun = S.now + 20000;
  mob.hp = 60;
  // attack mode engages proactively without owner hitting first
  assert.ok(act("buddy", { k: "ai", ai: "attack" }).ok);
  assert.equal(p.ch.buddy.ai, "attack");
  step(2000);
  assert.ok(mob.hp < 60, "attack mode proactively engages nearby monsters");
  // passive mode stops attacking even engaged monsters
  assert.ok(act("buddy", { k: "ai", ai: "passive" }).ok);
  X.dealMob(S, rt, mob, p, 10, false, 0, null, { trackBuddy: true });
  const hpAfterPassive = mob.hp;
  step(2000);
  assert.equal(mob.hp, hpAfterPassive, "passive mode never attacks");
  // guard mode heals low-HP owner and intercepts close threats
  assert.ok(act("buddy", { k: "ai", ai: "guard" }).ok);
  p.hp = 10;
  step(2000);
  assert.ok(p.hp > 10, "guard mode heals hurt owner");
  assert.ok(mob.hp < hpAfterPassive, "guard mode intercepts close threats");
  // persists across reconnect and old sheets without ai default to neutral
  const saved = structuredClone(L.removePlayer(S, pid));
  assert.equal(saved.buddy.ai, "guard");
  L.addPlayer(S, pid, saved);
  assert.equal(S.players[pid].ch.buddy.ai, "guard");
  const legacy = structuredClone(L.removePlayer(S, pid));
  delete legacy.buddy.ai;
  L.addPlayer(S, pid, legacy);
  assert.equal(S.players[pid].ch.buddy.ai, "neutral", "legacy buddy sheets default to neutral");
}

console.log("buddy: dialogue rotation, party lifecycle, bounded hunting, AI stances, five co-op jobs and replay rewards");
