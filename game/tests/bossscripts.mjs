// Every map boss and field boss that 15-boss-scripts.js scripts has a valid script, and a ~60 s fight against it throws nothing and lands patterns.
// node tests/bossscripts.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { MOBS, FIELD_BOSS, BS_PAT, bsDef, newMob, readyMob, mobMax, T };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;
const KINDS = new Set(["charge", "fan", "fan2", "fan3", "rings", "pools", "charge2", "leapslam", "dive", "blast", "jet", "punch", ...Object.keys(X.BS_PAT)]);
const BIG = ["wickregent", "knotwidow", "knellkeeper", "loomcolossus", "sluiceleviathan", "prismcantor", "boss", "abyssboss", "crownstag", "mistiger"];
const FIELD = Object.values(X.FIELD_BOSS).filter((k) => k !== "clubshrimp");

for (const k of [...BIG, ...FIELD]) {
  const B = X.bsDef({ k });
  assert.ok(B, k + ": has a script");
  assert.ok(B.pats.length >= 3 && new Set(B.pats.map((p) => p[1])).size >= 3, k + ": 3+ patterns of 3+ kinds");
  assert.ok([...B.pats, ...B.phases.flatMap((P) => P.pats || [])].every((p) => KINDS.has(p[1]) && p[0]), k + ": known kinds, named");
  assert.equal(B.phases.length, BIG.includes(k) ? 2 : 1, k + ": phases");
  assert.ok(B.phases.every((P, i) => P.at < (i ? B.phases[i - 1].at : 1)), k + ": phases fall");

  const S = L.setup(); let now = 1_000_000; S.now = now;
  L.addPlayer(S, "p1", L.hero("시험", { wk: "sword", lvl: 100, migrate: true }));
  const p = S.players.p1, rt = L.runtime(S, p.map);
  const mob = X.newMob(S, k, [10, 10, 10, 10], { elite: 0 });
  mob.x = mob.hx = 10 * X.T + 8; mob.y = mob.hy = 10 * X.T + 8; X.readyMob(S, mob); rt.mobs.push(mob);
  for (const o of rt.mobs) if (o !== mob) { o.dead = true; o.respAt = now + 1e12; }
  const idx = new Set();
  for (let i = 0; i < 600; i++) {
    p.dead = false; p.hp = 1e7; p.x = mob.x + 26; p.y = mob.y; p.mvAt = now;
    now += 100; L.tick(S, now);
    for (const e of rt.ev) if (e[0] === "bc" && e[1] === mob.id) idx.add(e[2]);
    L.endTick(S);
  }
  assert.ok(idx.size >= 1, k + ": lands a pattern in 60 s (got " + [...idx] + ")");
}
console.log("bossscripts: " + (BIG.length + FIELD.length) + " bosses scripted; 60 s fights run");
