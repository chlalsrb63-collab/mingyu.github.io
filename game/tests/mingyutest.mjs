// Headless test of /mingyutest (src/logic/74-dev-test.js): local-only gate, Lv.200, masteries 50, every job's
// skills learned (switching with `j`), every waypoint stone woken, full HP/MP. node tests/mingyutest.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/logic.js", import.meta.url), "utf8") +
  "\nexport const __t = { skLearned, SKILL, SKILL_ORDER, JOBS, WK_ORDER, WM_MAX, MAXLV, MAP_META, hasWp, wpWoken, stats };\n";
const L = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const X = L.__t;

const S = L.setup();
S.now = 1_000_000;
const PID = "pid-민규";
L.addPlayer(S, PID, L.newChar("민규", []));
const p = S.players[PID], ch = p.ch;
const act = (a) => { const v = L.validateAction(S, PID, a); if (v.ok) L.applyAction(S, PID, a); return v; };

// the gate: refused unless the room says this is the local build
assert.equal(act({ t: "mingyutest" }).error, "테스트 명령은 로컬 빌드에서만 쓸 수 있습니다");
assert.equal(ch.lvl, 1, "nothing changed while refused");
S.dev = true;
assert.equal(act({ t: "mingyutest", j: "없는직업" }).error, "그런 직업은 없습니다");
assert.ok(act({ t: "mingyutest" }).ok);
assert.equal(ch.lvl, X.MAXLV, "Lv.200");
for (const k of X.WK_ORDER) assert.equal(ch.wm[k].lv, X.WM_MAX, k + " mastery 50");
for (const id of Object.keys(X.MAP_META)) if (X.hasWp(id)) for (let i = 0; i < (X.MAP_META[id].wpn || 1); i++) assert.ok(X.wpWoken(ch, id, i), `${id} stone ${i} woken`);
const st = X.stats(p);
assert.equal(p.hp, st.mhp); assert.equal(p.mp, st.mmp);
assert.ok(S.chat.some((c) => c.to === PID && c.m.startsWith("테스트 캐릭터 활성화: Lv.200")), "a private system line confirms it");
// every job: switch with `j` (id or Korean name) and its job skills are learned
const jobs = Object.keys(X.JOBS).filter((j) => j !== "adventurer");
for (const [n, j] of jobs.entries()) {
  assert.ok(act({ t: "mingyutest", j: n % 2 ? X.JOBS[j].name : j }).ok, j);
  assert.equal(ch.job, j);
  const mine = X.SKILL_ORDER.filter((id) => X.SKILL[id].job === j);
  for (const id of mine) assert.ok(X.skLearned(ch, X.SKILL[id]), `${j}: ${id} is learned`);
}
// the sheet saves and loads back the same
const ex = L.exportChar(S, PID);
L.removePlayer(S, PID);
L.addPlayer(S, PID, ex);
assert.equal(S.players[PID].ch.lvl, X.MAXLV); assert.equal(S.players[PID].ch.job, jobs[jobs.length - 1]);
console.log("mingyutest ok — jobs", jobs.length);
