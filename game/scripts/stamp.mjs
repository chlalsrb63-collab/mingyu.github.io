#!/usr/bin/env node
/**
 * Sets the cache tag `?v=` in public/index.html to a short hash of everything the
 * page loads (public/*.js, *.css, index.html without its tags, fonts and installed
 * assets), so nobody bumps it by hand and parallel branches never conflict on it.
 *
 *   node scripts/stamp.mjs           rewrite index.html (CI and deploy:cf run this)
 *   node scripts/stamp.mjs --print   only print the tag
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const index = join(pub, "index.html");
const TAG = /\?v=[0-9a-z]+/g;

function files(dir, rel = "") {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith("_") || name.startsWith(".")) continue; // dev previews, dotfiles
    const p = join(dir, name), r = rel + name;
    if (statSync(p).isDirectory()) out.push(...files(p, r + "/"));
    else if (r !== "index.html") out.push([r, p]);
  }
  return out;
}

const h = createHash("sha256");
const html = readFileSync(index, "utf8");
h.update(html.replace(TAG, "?v="));
for (const [r, p] of files(pub)) { h.update(r); h.update(readFileSync(p)); }
const tag = parseInt(h.digest("hex").slice(0, 10), 16).toString(36);

if (process.argv.includes("--print")) console.log(tag);
else {
  const next = html.replace(TAG, "?v=" + tag);
  if (next !== html) writeFileSync(index, next);
  console.log("cache tag ?v=" + tag + (next === html ? " (unchanged)" : ""));
}
