// Headless checks for the systems that need more than one player or lucky drops:
// node tests/party.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const S = L.setup();
let now = 1000;
S.now = now;
const A = "pid-aaaaaaaa", B = "pid-bbbbbbbb";
const ea = L.addPlayer(S, A, L.newChar("가", "warrior", {}));
const eb = L.addPlayer(S, B, L.newChar("나", "mage", {}));
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const step = (pid) => { now += 100; L.tick(S, now); const v = JSON.parse(JSON.stringify(L.viewFor(S, pid))); const o = JSON.parse(JSON.stringify(L.viewFor(S, pid === A ? B : A))); L.endTick(S); return [v, o]; };

// ── party: invite, accept, both see it
assert.ok(act(A, { t: "pinv", e: eb }).ok);
assert.equal(act(A, { t: "pacc" }).ok, false, "the inviter has nothing to accept");
let [va, vb] = step(A);
assert.ok(vb.pinv, "invitee is told who invited them");
assert.ok(act(B, { t: "pacc" }).ok);
[va, vb] = step(A);
assert.equal(va.party.length, 2);
assert.equal(vb.party.length, 2);

// ── shared kill: B never touches the monster but still gets experience
const pa = S.players[A], pb = S.players[B];
const rt = S.maps.town;
const mob = { id: 9999, k: "twinhare", r: [18, 16, 22, 20], x: pa.x + 10, y: pa.y, hx: pa.x, hy: pa.y, hp: 1, dir: 0, st: 0, tgt: null, atkAt: 0, mvAt: 1e12, wx: pa.x, wy: pa.y, by: {}, dead: false, respAt: 0, slow: 0, castAt: 1e12, el: 1, stun: 0, dot: null, temp: false, fix: 0, ep: 0 };
rt.mobs.push(mob);
now += 1000;
assert.ok(act(A, { t: "atk" }).ok);
assert.ok(mob.dead, "one hit should finish a 1 hp monster");
assert.ok(pa.ch.xp > 0 && pb.ch.xp > 0, "both party members gain experience");
assert.ok(pa.ch.xp < 36, "a shared kill pays each member a share, not the full amount");
assert.ok(rt.drops.some((d) => d.own === A) && rt.drops.some((d) => d.own === B), "each member rolls their own loot");

// ── training: needs the trainer nearby and enough experience
assert.equal(act(A, { t: "train", k: "str", n: 1 }).ok, false);
pa.ch.xp = 5000;
pa.x = 23 * 16 + 8; pa.y = 13 * 16 + 8;
const before = L.viewFor(S, A).self.atk;
assert.ok(act(A, { t: "train", k: "str", n: 10 }).ok);
const self = L.viewFor(S, A).self;
assert.equal(self.tr.str, 10);
assert.equal(self.atk, before + 10);
assert.ok(self.xp < 5000);

// ── runes: socket two in order and the runeword appears
pa.ch.eq.weapon.sk = 2;
pa.ch.inv.push({ id: "ru_ign", n: 1 }, { id: "ru_acu", n: 1 });
const slot = (id) => pa.ch.inv.findIndex((s) => s.id === id);
assert.equal(act(A, { t: "rune", s: slot("ru_ign"), k: "weapon", i: 5 }).ok, false, "no such socket");
assert.ok(act(A, { t: "rune", s: slot("ru_ign"), k: "weapon", i: 0 }).ok);
assert.ok(act(A, { t: "rune", s: slot("ru_acu"), k: "weapon", i: 1 }).ok);
assert.deepEqual(pa.ch.eq.weapon.ru, ["ign", "acu"]);
assert.ok(L.viewFor(S, A).self.critd >= 185, "runeword 섬광 adds critical damage");

// ── leaving disbands a two-person party
assert.ok(act(B, { t: "pleave" }).ok);
[va] = step(A);
assert.equal(va.party, undefined);
JSON.stringify(L.removePlayer(S, A));
console.log("party ok");
