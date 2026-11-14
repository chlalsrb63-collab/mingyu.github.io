#!/usr/bin/env node
// Runs every rule test listed in tests/LIST (the single list CI uses too).
//
//   node scripts/test-all.mjs              build src/logic.js, then run all tests
//   node scripts/test-all.mjs maps skills  run only these (still builds first)
//   node scripts/test-all.mjs --no-build   skip the logic build (CI checks the split separately)
//   node scripts/test-all.mjs -v           show each test's own output even when it passes, and PASS lines
//
// Quiet by default (cheap to read): only failures (their last 60 lines) and one summary line.
//
// Tests run one at a time (tests/maps.mjs asserts on timings). Pure node, no deps.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = join(ROOT, "tests");
const args = process.argv.slice(2);
const verbose = args.includes("-v") || args.includes("--verbose");
const only = args.filter((a) => !a.startsWith("-"));

const listed = readFileSync(join(TESTS, "LIST"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

// A test file nobody listed would silently never run: fail loudly instead.
const onDisk = readdirSync(TESTS).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4));
const unlisted = onDisk.filter((n) => !listed.includes(n));
const missing = listed.filter((n) => !existsSync(join(TESTS, n + ".mjs")));
if (unlisted.length || missing.length) {
  if (unlisted.length) console.error(`tests/LIST is missing: ${unlisted.join(", ")} (add them)`);
  if (missing.length) console.error(`tests/LIST names files that do not exist: ${missing.join(", ")}`);
  process.exit(1);
}
const bad = only.filter((n) => !listed.includes(n));
if (bad.length) {
  console.error(`unknown test(s): ${bad.join(", ")} — known: ${listed.join(" ")}`);
  process.exit(1);
}
const run = only.length ? listed.filter((n) => only.includes(n)) : listed;

if (!args.includes("--no-build")) {
  const b = spawnSync(process.execPath, [join(ROOT, "scripts", "build-logic.mjs")], { cwd: ROOT, stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status || 1);
}

const results = [];
for (const name of run) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(TESTS, name + ".mjs")], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  const ms = Date.now() - t0;
  const ok = r.status === 0;
  results.push({ name, ok, ms });
  if (!ok || verbose) console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(10)} ${String(ms).padStart(6)} ms`);
  if (!ok || verbose) {
    let out = ((r.stdout || "") + (r.stderr || "")).trimEnd();
    if (!verbose) { const ls = out.split("\n"); if (ls.length > 60) out = `… ${ls.length - 60} lines cut (run with -v)\n` + ls.slice(-60).join("\n"); }
    if (out) console.log(out.replace(/^/gm, "      | "));
  }
}

const failed = results.filter((r) => !r.ok);
const total = results.reduce((n, r) => n + r.ms, 0);
console.log(`\n${results.length - failed.length}/${results.length} passed in ${(total / 1000).toFixed(1)} s` +
  (failed.length ? ` — FAILED: ${failed.map((r) => r.name).join(", ")}` : ""));
process.exitCode = failed.length ? 1 : 0;
