#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { TRACKS } from "../public/bgm.js";
import { defs } from "../src/logic.js";

const target = new URL("../public/assets/manifest.json", import.meta.url);
const music = new URL("../public/assets/music/", import.meta.url);
const headers = {
  ".mp3": b => b.toString("ascii", 0, 3) === "ID3" || (b[0] === 255 && (b[1] & 0xe0) === 0xe0),
  ".ogg": b => b.toString("ascii", 0, 4) === "OggS",
  ".wav": b => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE",
};

async function writeAtomic(destination, data) {
  const temp = new URL(`${destination.href}.${process.pid}.tmp`);
  try {
    await writeFile(temp, data, { flag: "wx" });
    await rename(temp, destination);
  } finally {
    await unlink(temp).catch(() => {});
  }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    track: { type: "string" }, start: { type: "string" }, end: { type: "string" },
    gain: { type: "string" }, replace: { type: "boolean" }, list: { type: "boolean" },
  } });
  const keys = new Set([...Object.keys(TRACKS), ...defs().maps.map(m => m.id)]);
  if (values.list) return console.log([...keys].join(" "));
  const [file] = positionals, key = values.track;
  if (positionals.length !== 1 || !keys.has(key) || !/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new Error('사용법 npm run bgm:import -- "파일.mp3" --track town [--start 2.4 --end 85.2] [--gain 0.65] [--replace]');
  }
  const ext = extname(file).toLowerCase();
  if (!Object.hasOwn(headers, ext)) throw new Error("MP3, OGG 또는 WAV 파일을 선택하세요.");
  const start = Number(values.start ?? 0), end = values.end === undefined ? undefined : Number(values.end);
  const gain = Number(values.gain ?? 0.65);
  if (!Number.isFinite(start) || start < 0 || start >= 210 || (end !== undefined && !(end <= 210 && end - start >= 1))) {
    throw new Error("반복 구간은 0–210초 범위에서 최소 1초여야 합니다.");
  }
  if (!(gain >= 0.05 && gain <= 1)) throw new Error("음량 계수는 0.05–1 사이여야 합니다.");
  const manifest = JSON.parse(await readFile(target, "utf8"));
  manifest.bgm ||= {};
  if (Object.hasOwn(manifest.bgm, key) && !values.replace) throw new Error(`'${key}'에 곡이 이미 있습니다. 교체하려면 --replace를 지정하세요.`);
  const disk = await stat(file);
  if (!disk.isFile() || disk.size < 12 || disk.size > 24 * 1024 * 1024) throw new Error("24 MiB 이하의 오디오 파일을 선택하세요.");
  const bytes = await readFile(file);
  if (!headers[ext](bytes)) throw new Error("파일 내용이 오디오 확장자와 일치하지 않습니다.");
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const name = `${key}-${digest}${ext}`;
  await mkdir(music, { recursive: true });
  // Different mixes get different filenames so the game never reuses an earlier cached copy.
  await writeAtomic(new URL(name, music), bytes);
  manifest.bgm[key] = { src: `assets/music/${name}`, start, ...(end === undefined ? {} : { end }), gain };
  await writeAtomic(target, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${key}에 로컬 BGM을 등록했습니다. 게임을 새로고침하고 음악 설정에서 뉴에이지를 선택하세요.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
