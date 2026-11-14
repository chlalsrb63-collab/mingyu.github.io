#!/usr/bin/env node
// Validates the world map editor's data (game/data/**, docs/editor/SCHEMA.md): grid sizes and
// characters, standable entrances, spawn areas, doors that land on open ground reachable from
// the entrance, NPCs, quests and every id they name. Korean messages with file/path pointers.
//
//   node scripts/data-check.mjs [dataDir]     (npm run data:check)   exit 1 on errors
//   import { checkData } from "./data-check.mjs"  → { ok, errors, warnings }
//
// Pure node, no dependencies.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkData, DATA_DIR } from "./editor-lib.mjs";

export { checkData };

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DATA_DIR;
  const r = await checkData(dir);
  const line = (e) => `  ${e.file}${e.path ? ` · ${e.path}` : ""}: ${e.msg}`;
  if (r.errors.length) console.log(`오류 ${r.errors.length}개:\n${r.errors.map(line).join("\n")}`);
  if (r.warnings.length) console.log(`주의 ${r.warnings.length}개:\n${r.warnings.map(line).join("\n")}`);
  console.log(r.ok ? "데이터 검사 통과." : "데이터 검사 실패.");
  process.exitCode = r.ok ? 0 : 1;
}
