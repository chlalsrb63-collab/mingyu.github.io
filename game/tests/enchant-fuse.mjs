// Unit test for ITM-02 (enchant scrolls & extraction hammer), ITM-03 (boss gloves/boots & T6-T10 unique armor),
// ITM-08 (3-to-1 rune upgrade fusion & rune_chisel extraction), and ITM-09 (charm board presets & 3-to-1 charm fusion).
// node tests/enchant-fuse.mjs
import assert from "node:assert/strict";
import * as L from "../src/logic.js";

const D = L.defs();
const T = 16;
const BASE = Date.UTC(2026, 10, 20, 12, 0, 0);

function world() {
  const S = L.setup();
  let now = BASE;
  S.now = now;
  const PID = "p-itm";
  const ch = L.newChar("대장장이", [], "sword");
  ch.lvl = 200;
  ch.gold = 500000;
  L.addPlayer(S, PID, ch);
  const town = L.atlas().maps.town;
  const moveNear = (role) => {
    const n = town.npcs.find((x) => x.role === role);
    assert.ok(n, `town has npc role=${role}`);
    const p = S.players[PID];
    p.x = n.x * T + 8; p.y = (n.y + 1) * T + 8;
  };
  return {
    S, PID,
    get p() { return S.players[PID]; },
    get ch() { return S.players[PID].ch; },
    moveNear,
    act(a) { S.now = now; const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; },
    ok(a) { const r = this.act(a); assert.ok(r.ok, `${JSON.stringify(a)} failed: ${r.error}`); return r; },
    step(ms = 100) { now += ms; L.tick(S, now); const v = L.viewFor(S, PID); L.endTick(S); return v; },
  };
}

// ── ITM-03: boss gloves/boots & T6-T10 unique armor catalogue
{
  const expected = [
    "veil_g", "veil_b", "bloom_g", "bloom_b",
    "u_meteor_g", "u_meteor_b", "u_blood_g", "u_blood_b", "u_blood_a",
    "u_sun_g", "u_sun_b", "u_sun_h", "u_star_g", "u_star_b",
    "u_dawn_g", "u_dawn_b", "u_dawn_h", "u_dawn_a",
  ];
  for (const id of expected) {
    assert.ok(D.items[id] && D.items[id].uniq === 1, `ITM-03 unique item ${id} exists`);
  }
}

// ── ITM-02: enchant scrolls, scroll craft, extraction hammer, imprint & persistence
{
  const W = world();
  W.moveNear("smith");
  W.ch.eq.weapon = { id: "w_warrior_5", n: 1, q: 2, il: 100, enh: 0, af: [["atk", 20], ["crit", 3], ["hp", 50]], sk: 1, ru: [null] };
  W.ch.eq.armor = { id: "a_5", n: 1, q: 3, il: 100, enh: 0, af: [["def", 20], ["hp", 80], ["mp", 30], ["spd", 4]], lg: "thorn", sk: 1, ru: [null] };
  W.ch.inv.push({ id: "enc_atk", n: 3 }, { id: "enc_def", n: 1 }, { id: "enc_hammer", n: 1 });
  W.ch.inv.push({ id: "w_warrior_6", n: 1, q: 3, il: 120, enh: 0, af: [["atk", 30]], lg: "haste", sk: 0, ru: [] });

  // Apply red (offense) scroll to rare weapon → becomes legendary with offense prefix
  W.ok({ t: "enc_apply", k: "weapon", src: "scroll", id: "enc_atk" });
  assert.equal(W.ch.eq.weapon.q, 3, "rare upgraded to legendary on enchant");
  assert.ok(W.ch.eq.weapon.lg && D.legend[W.ch.eq.weapon.lg][3] === "O", "rolled offense prefix");
  assert.equal(W.ch.eq.weapon.af.length, 4, "upgraded to 4 affix lines");

  // Convert 2 enc_atk → 1 enc_util
  W.ok({ t: "enc_craft", from: "enc_atk", to: "enc_util" });
  assert.ok(W.ch.inv.some((s) => s.id === "enc_util" && s.n === 1), "crafted blue scroll");

  // Extract "haste" from bag weapon with enc_hammer
  const bagIdx = W.ch.inv.findIndex((s) => s.id === "w_warrior_6");
  W.ok({ t: "enc_extract", s: bagIdx });
  assert.deepEqual(W.ch.enc, ["haste"], "extracted prefix stored in ch.enc");
  assert.equal(W.ch.inv.findIndex((s) => s.id === "w_warrior_6"), -1, "source gear consumed");

  // Reject incompatible slot (haste is WG, not armor A)
  assert.equal(W.act({ t: "enc_apply", k: "armor", src: "imprint", i: 0 }).ok, false, "incompatible slot rejected");

  // Imprint "haste" onto equipped weapon
  W.ok({ t: "enc_apply", k: "weapon", src: "imprint", i: 0 });
  assert.equal(W.ch.eq.weapon.lg, "haste", "imprinted exact prefix onto weapon");
  assert.equal(W.ch.enc.length, 0, "imprinted prefix consumed from storage");

  // Persistence through exportChar -> migrate
  W.ch.enc.push("chain");
  const saved = L.exportChar(W.S, W.PID);
  const S2 = L.setup();
  L.addPlayer(S2, "p-mig", saved);
  assert.deepEqual(S2.players["p-mig"].ch.enc, ["chain"], "ch.enc persists across save/migrate");
}

// ── ITM-08: 3-to-1 rune fusion (1→2, 2→3, 3→4) & rune_chisel extraction
{
  const W = world();
  W.moveNear("smith");
  // Fuse 3 magic runes (q=1) → 1 random rare rune (q=2) keeping max iLv
  W.ch.inv.push({ id: "ru_ign", n: 2, il: 40 }, { id: "ru_vit", n: 1, il: 120 });
  W.ok({ t: "rune_fuse", q: 1 });
  const fusedRare = W.ch.inv.find((s) => D.runes[s.id]?.q === 2);
  assert.ok(fusedRare && fusedRare.il === 120, "3 magic runes fused into random rare rune with max iLv");

  // Fuse 3 rare runes (q=2) → 1 random legendary rune (q=3)
  W.ch.inv.push({ id: "ru_cedar", n: 2, il: 150 });
  W.ok({ t: "rune_fuse", q: 2 });
  const fusedLeg = W.ch.inv.find((s) => D.runes[s.id]?.q === 3);
  assert.ok(fusedLeg && fusedLeg.il === 150, "3 rare runes fused into random legendary rune");

  // Fuse 3 legendary runes (q=3) → 1 random set rune (q=4)
  W.ch.inv.push({ id: "ru_firstsun", n: 2, il: 190 });
  W.ok({ t: "rune_fuse", q: 3 });
  const fusedSet = W.ch.inv.find((s) => D.runes[s.id]?.q === 4);
  assert.ok(fusedSet && fusedSet.il === 190, "3 legendary runes fused into random set rune");

  // Socket & safely extract with rune_chisel
  W.ch.eq.weapon = { id: "w_warrior_5", n: 1, q: 2, il: 100, enh: 0, af: [], sk: 1, ru: [["ru_firstsun", 180]] };
  W.ch.inv.push({ id: "rune_chisel", n: 1 });
  W.ok({ t: "rune_extract", k: "weapon", i: 0 });
  assert.equal(W.ch.eq.weapon.ru[0], null, "socket emptied");
  assert.ok(W.ch.inv.some((s) => s.id === "ru_firstsun" && s.il === 180), "extracted rune returned to bag with exact iLv");
}

// ── ITM-09: charm board presets & 3-to-1 charm upgrade fusion (magic→rare, rare→legendary)
{
  const W = world();
  W.moveNear("charm");
  W.ch.charms.unlocked = true;
  W.ch.charms.openN = 16; // full 5x5 board
  // Create 3 appraised magic charms + 3 appraised rare charms
  const mkCharm = (uid, seal, fg) => {
    const c = { id: "charm", n: 1, uid, seal, rv: 2, tier: 40, src: 3, rev: 0, ...(fg ? { fg } : { fx: 1 }) };
    W.ch.inv.push(c);
    W.ok({ t: "charm_id", uid });
    return W.ch.inv.find((s) => s.id === "charm" && s.uid === uid);
  };
  const c1 = mkCharm(1, 101, 0);
  const c2 = mkCharm(2, 202, 0);
  const c3 = mkCharm(3, 303, 0);
  W.ch.charms.nextUid = 10;

  // Place c1, save preset 0, remove c1, load preset 0 → c1 back on board!
  W.ok({ t: "charm_place", uid: c1.uid, x: 0, y: 0, r: 0 });
  assert.equal(W.ch.charms.placed.length, 1);
  W.ok({ t: "charm_preset", a: "save", i: 0 });
  W.ok({ t: "charm_remove", uid: c1.uid });
  assert.equal(W.ch.charms.placed.length, 0);
  W.ok({ t: "charm_preset", a: "load", i: 0 });
  assert.equal(W.ch.charms.placed.length, 1);
  assert.equal(W.ch.charms.placed[0].c.uid, c1.uid, "preset 0 restored charm onto board");
  W.ok({ t: "charm_remove", uid: c1.uid });

  // Fuse 3 magic charms → 1 appraised rare charm (g=2)
  assert.equal(W.ch.inv.filter((s) => s.id === "charm" && s.rev && s.g === 1).length, 3);
  W.ok({ t: "charm_fuse", g: 1 });
  const rareCharms = W.ch.inv.filter((s) => s.id === "charm" && s.rev && s.g === 2);
  assert.equal(rareCharms.length, 1, "3 magic charms fused into 1 rare charm");

  // Add 2 more rare charms and fuse 3 rare → 1 appraised legendary charm (g=3)
  mkCharm(11, 404, 2);
  mkCharm(12, 505, 2);
  W.ch.charms.nextUid = 20;
  W.ok({ t: "charm_fuse", g: 2 });
  const legCharm = W.ch.inv.find((s) => s.id === "charm" && s.rev && s.g === 3);
  assert.ok(legCharm && legCharm.lg, "3 rare charms fused into 1 legendary charm with live power");

  // Verify fused legendary charm survives save/migrate
  const saved = L.exportChar(W.S, W.PID);
  const S2 = L.setup();
  L.addPlayer(S2, "p-cmig", saved);
  const kept = S2.players["p-cmig"].ch.inv.find((s) => s.id === "charm" && s.uid === legCharm.uid);
  assert.ok(kept && kept.g === 3 && kept.lg === legCharm.lg, "fused legendary charm survives migrate intact");
}

console.log("enchant-fuse (ITM-02/03/08/09): ok");
