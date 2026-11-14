// Headless checks for the quick slots 1–9, party chat and the bag's tidy button:
// node tests/hotbar.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const S = L.setup();
let now = 1_000_000;
S.now = now;
const A = "pid-hotbar-a", B = "pid-hotbar-b", C = "pid-hotbar-c";
const act = (pid, a) => { S.now = now; const v = L.validateAction(S, pid, a); if (v.ok) L.applyAction(S, pid, a); return v; };
const view = (pid) => { now += 100; L.tick(S, now); S.players[pid].dirty = true; const v = JSON.parse(JSON.stringify(L.viewFor(S, pid))); L.endTick(S); return v; };

// ── a new character starts with nine empty quick slots
const fresh = L.newChar("단축", "warrior", []);
assert.equal(fresh.qs.length, 9);
assert.ok(fresh.qs.every((v) => v === null), "nothing pre-filled: the player sets the slots");
const ea = L.addPlayer(S, A, fresh);
let self = view(A).self;
assert.deepEqual(self.qs, Array(9).fill(null), "the slots ride along in the self payload");

// ── an old sheet (before quick slots) migrates to nine empty slots and a newer version
const old = JSON.parse(JSON.stringify(L.newChar("옛날", "mage", [])));
delete old.qs; old.v = 5;
L.addPlayer(S, C, old);
assert.equal(S.players[C].ch.qs.length, 9);
assert.ok(S.players[C].ch.qs.every((v) => v === null));
assert.ok(S.players[C].ch.v >= 6, "the sheet version moved on");
// a damaged list keeps only what is still valid
const bent = JSON.parse(JSON.stringify(L.newChar("굽음", "rogue", [])));
bent.qs = [["s", 2], ["s", 99], ["i", "hp_s"], ["i", "nope"], ["i", "a_1"], "x", null, ["s", -1], ["s", 0], ["extra"]];
L.removePlayer(S, C);
L.addPlayer(S, C, bent);
assert.deepEqual(S.players[C].ch.qs, [["s", 2], null, ["i", "hp_s"], null, null, null, null, null, ["s", 0]]);
L.removePlayer(S, C);

// ── assigning: skills by index, usable items by id, anything else is refused
assert.ok(act(A, { t: "qs", i: 0, v: ["s", 0] }).ok);
assert.ok(act(A, { t: "qs", i: 1, v: ["i", "hp_s"] }).ok);
assert.ok(act(A, { t: "qs", i: 8, v: ["s", D.skills.warrior.length - 1] }).ok, "the ultimate can go anywhere");
assert.equal(act(A, { t: "qs", i: 9, v: ["s", 0] }).ok, false, "only nine slots");
assert.equal(act(A, { t: "qs", i: -1, v: null }).ok, false);
assert.equal(act(A, { t: "qs", i: 1.5, v: null }).ok, false);
assert.equal(act(A, { t: "qs", i: 2, v: ["s", D.skills.warrior.length] }).ok, false, "no such skill");
assert.equal(act(A, { t: "qs", i: 2, v: ["s", "0"] }).ok, false);
assert.equal(act(A, { t: "qs", i: 2, v: ["i", "a_1"] }).ok, false, "armour is not something you use");
assert.equal(act(A, { t: "qs", i: 2, v: ["i", "__proto__"] }).ok, false);
assert.equal(act(A, { t: "qs", i: 2, v: ["i", "nope"] }).ok, false);
assert.equal(act(A, { t: "qs", i: 2, v: ["x", 1] }).ok, false);
assert.equal(act(A, { t: "qs", i: 2, v: "hp_s" }).ok, false);
assert.equal(act(A, { t: "qs", i: 0, j: 12 }).ok, false);
for (const id of ["mp_s", "camp", "recall"]) if (D.items[id]) assert.ok(act(A, { t: "qs", i: 3, v: ["i", id] }).ok, id + " can sit in a slot");
self = view(A).self;
assert.deepEqual(self.qs[0], ["s", 0]);
assert.deepEqual(self.qs[1], ["i", "hp_s"]);
// an item the bag does not hold right now can still sit in a slot (the client greys it out)
assert.ok(act(A, { t: "qs", i: 4, v: ["i", "mp_m" in D.items ? "mp_m" : "mp_s"] }).ok);

// swap and clear
assert.ok(act(A, { t: "qs", i: 0, j: 1 }).ok);
self = view(A).self;
assert.deepEqual(self.qs[0], ["i", "hp_s"]);
assert.deepEqual(self.qs[1], ["s", 0]);
assert.ok(act(A, { t: "qs", i: 3, v: null }).ok);
assert.equal(view(A).self.qs[3], null);
assert.ok(act(A, { t: "qs", i: 4 }).ok, "no value clears too");
assert.equal(view(A).self.qs[4], null);

// ── persisted with the sheet and back again
const saved = JSON.parse(JSON.stringify(L.exportChar(S, A)));
assert.deepEqual(saved.qs.slice(0, 2), [["i", "hp_s"], ["s", 0]]);
L.removePlayer(S, A);
L.addPlayer(S, A, saved);
self = view(A).self;
assert.deepEqual(self.qs.slice(0, 2), [["i", "hp_s"], ["s", 0]]);
assert.deepEqual(self.qs[8], ["s", D.skills.warrior.length - 1]);

// ── pressing a slot: the client turns it into the action it already has — use the item, cast the skill
const p = S.players[A];
p.hp = 10;
const qsAction = (v) => (v[0] === "s" ? { t: "sk", i: v[1] } : { t: "use", id: v[1] });
const potsBefore = p.ch.inv.find((s) => s.id === "hp_s").n;
assert.ok(act(A, qsAction(self.qs[0])).ok, "slot 1 drinks the potion");
assert.equal(p.ch.inv.find((s) => s.id === "hp_s").n, potsBefore - 1);
assert.equal(act(A, qsAction(self.qs[1])).ok, false, "the first skill waits for level 3");
p.ch.lvl = 3; p.stc = null; p.mp = 999;
now += 2000;
assert.ok(act(A, qsAction(self.qs[1])).ok, "slot 2 casts the first skill");
assert.ok(p.cds[0] > now, "and it goes on cooldown");

// ── the quick slots work while dead too (just a setting)
p.dead = true;
assert.ok(act(A, { t: "qs", i: 5, v: ["s", 1] }).ok);
p.dead = false; p.hp = 100;

// ── party chat: only the party hears it
const eb = L.addPlayer(S, B, L.newChar("파티원", "lancer", []));
L.addPlayer(S, C, L.newChar("남", "mage", []));
assert.equal(act(A, { t: "pchat", m: "안녕" }).ok, false, "no party, no party chat");
S.players[B].x = p.x + 10; S.players[B].y = p.y; S.players[B].map = p.map;
assert.ok(act(A, { t: "pinv", e: eb }).ok);
now += 100;
assert.ok(act(B, { t: "pacc" }).ok);
now += 1000;
assert.ok(act(A, { t: "pchat", m: "  모여요  " }).ok);
L.tick(S, now += 100);
const [vA, vB, vC] = [A, B, C].map((id) => JSON.parse(JSON.stringify(L.viewFor(S, id))));
L.endTick(S);
const said = (v) => (v.chat || []).find((c) => c.m === "모여요");
assert.ok(said(vA) && said(vA).pt, "the sender sees it marked as party chat");
assert.ok(said(vB), "the party member hears it");
assert.ok(!said(vC), "a stranger does not");
assert.equal(act(A, { t: "pchat", m: "   " }).ok, false);
assert.equal(act(A, { t: "pchat", m: "또" }).ok, false, "too fast");

// ── tidying the bag: by kind, best first, stacks merged; nothing lost
const ch = p.ch;
ch.inv = [{ id: "hp_s", n: 3 }, { id: "a_1", q: 0, enh: 0, af: [], sk: 0, ru: [] }, { id: "mp_s", n: 2 }, { id: "hp_s", n: 98 }, { id: `w_warrior_1`, q: 2, enh: 0, af: [], sk: 0, ru: [] }];
const count = (id) => ch.inv.filter((s) => s.id === id).reduce((n, s) => n + (s.n || 1), 0);
const before = { hp: count("hp_s"), mp: count("mp_s") };
assert.ok(act(A, { t: "sort" }).ok);
assert.equal(ch.inv[0].id, "w_warrior_1", "the weapon first");
assert.equal(ch.inv[1].id, "a_1");
assert.equal(count("hp_s"), before.hp);
assert.equal(count("mp_s"), before.mp);
assert.ok(ch.inv.every((s) => !s.n || s.n <= 99), "stacks stay within 99");
assert.equal(ch.inv.filter((s) => s.id === "hp_s").length, 2, "101 potions make a full stack and a small one");
ch.inv = [ch.inv[0]];
assert.equal(act(A, { t: "sort" }).ok, false, "nothing to tidy");

console.log("hotbar ok");
