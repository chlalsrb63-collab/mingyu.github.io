// Copy the pixelfx effects the game uses (the CAST/HIT/PROC tables in public/skillpfx*.js) from a pixelfx checkout into public/pfx/.
// pixelfx (MIT, Patch + Hugo Duprez: https://github.com/patch-gg/pixelfx) draws pixel effects in code, so they stay
// code-drawn art. Only the core and the effect files the table names (and what they import) are copied.
//   node scripts/pfx-vendor.mjs [path to the pixelfx checkout, default ~/pixelfx]
import { readFile, writeFile, mkdir, rm, copyFile, readdir } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(process.argv[2] || join(homedir(), "pixelfx"), "src");
const OUT = join(GAME, "public", "pfx");
const tables = (await readdir(join(GAME, "public"))).filter((f) => /^skillpfx.*\.js$/.test(f));
const table = (await Promise.all(tables.map((f) => readFile(join(GAME, "public", f), "utf8")))).join("\n");
const ids = [...new Set([...table.matchAll(/fx: "([a-z]+\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
if (!ids.length) throw new Error("no effect ids found in public/skillpfx*.js");

const seen = new Set();
async function take(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) await take(resolve(dirname(file), m[1]));
}
await take(join(SRC, "core", "index.js"));
for (const id of ids) await take(join(SRC, "fx", id + ".js"));

await rm(OUT, { recursive: true, force: true });
for (const file of seen) {
  const to = join(OUT, relative(SRC, file));
  await mkdir(dirname(to), { recursive: true });
  await copyFile(file, to);
}
const root = resolve(SRC, "..");
await copyFile(join(root, "LICENSE"), join(OUT, "LICENSE"));
await writeFile(join(OUT, "README.md"), `Vendored from pixelfx (MIT, see LICENSE): https://github.com/patch-gg/pixelfx\nCopied by game/scripts/pfx-vendor.mjs for the effects in public/skillpfx*.js. Do not edit here: change the table and re-run the script.\n`);
console.log(`pfx: ${ids.length} effects, ${seen.size} files → public/pfx/`);
