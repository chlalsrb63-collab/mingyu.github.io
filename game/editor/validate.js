/**
 * Map / links / npcs / quests checks shared by the editor page (live list) and
 * scripts/editor-server.mjs (refuses a PUT with errors). Plain ES module, no DOM.
 * Shapes: docs/editor/SCHEMA.md. Messages are Korean (the owner reads them).
 *
 * ctx = { palette: {ground:[{ch,solid}], objects:[{ch,solid}]}, defs: {mobs, items, roles, themes},
 *         maps: { id: { w, h, builtin } }, builtin: [ids] }
 * Every problem: { level: "error" | "warn", path, msg, x?, y? }.
 */
export const ID_RE = /^[a-z][a-z0-9_]{1,23}$/;
export const NPC_ID_RE = /^[a-z][a-z0-9_]{1,31}$/;
export const QUEST_ID_RE = /^[a-z][a-z0-9_]{2,31}$/;
export const MIN_SIZE = 16, MAX_SIZE = 160;

const isInt = (v) => Number.isInteger(v);
const isStr = (v) => typeof v === "string";
const isXY = (a) => Array.isArray(a) && a.length === 2 && isInt(a[0]) && isInt(a[1]);

function sets(ctx) {
  const pal = ctx.palette || { ground: [], objects: [] };
  const solidG = new Set(pal.ground.filter((p) => p.solid).map((p) => p.ch));
  return {
    ground: new Set(pal.ground.map((p) => p.ch)),
    objects: new Set(pal.objects.map((p) => p.ch)),
    solidG,
  };
}

/** Can a player stand on (x, y)? (no object, no solid ground, inside) */
export function standable(m, x, y, solidG) {
  if (!m || x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  const o = m.objects[y] && m.objects[y][x];
  const g = m.ground[y] && m.ground[y][x];
  return o === " " && !solidG.has(g);
}

/** Tiles reachable on foot from the entry (Uint8Array w*h), or null if the entry is bad. */
export function reach(m, solidG) {
  if (!isXY(m.entry)) return null;
  const W = m.w, H = m.h, out = new Uint8Array(W * H);
  const [ex, ey] = m.entry;
  if (!standable(m, ex, ey, solidG)) return out;
  const stack = [ey * W + ex];
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    if (out[i] || !standable(m, x, y, solidG)) continue;
    out[i] = 1;
    if (x + 1 < W) stack.push(i + 1);
    if (x > 0) stack.push(i - 1);
    if (y + 1 < H) stack.push(i + W);
    if (y > 0) stack.push(i - W);
  }
  return out;
}

/** Check one map file. `opts.deep` adds the reachability warnings (costs a flood fill). */
export function checkMap(m, ctx, opts = {}) {
  const P = [];
  const err = (path, msg, x, y) => P.push({ level: "error", path, msg, x, y });
  const warn = (path, msg, x, y) => P.push({ level: "warn", path, msg, x, y });
  if (!m || typeof m !== "object" || Array.isArray(m)) { err("", "맵 내용이 비어 있거나 형식이 틀렸어요."); return P; }
  const S = sets(ctx), defs = ctx.defs || {}, mobs = defs.mobs || {};
  const builtin = new Set(ctx.builtin || []);
  if (m.v !== 1) err("v", "파일 버전(v)은 1이어야 해요.");
  if (!isStr(m.id) || !ID_RE.test(m.id)) err("id", "맵 아이디는 영어 소문자로 시작하고 소문자·숫자·_ 만 2~24글자여야 해요.");
  if (m.replaces != null) {
    if (!builtin.has(m.replaces)) err("replaces", `대신할 기본 맵 "${m.replaces}"이(가) 없어요.`);
    else if (m.replaces !== m.id) err("replaces", "기본 맵을 대신하는 맵은 아이디가 그 기본 맵과 같아야 해요.");
  } else if (builtin.has(m.id)) err("id", `"${m.id}"는 기본 맵 아이디예요. 다른 아이디를 쓰거나 '기본 맵 대신하기'로 저장하세요.`);
  if (!isStr(m.name) || !m.name.trim()) err("name", "맵 이름을 적어 주세요.");
  else if (m.name.length > 24) err("name", "맵 이름은 24글자까지예요.");
  if (defs.themes && !defs.themes.includes(m.theme)) err("theme", `테마 "${m.theme}"을(를) 모르겠어요.`);
  if (defs.bgm && m.bgm != null && !defs.bgm.includes(m.bgm)) warn("bgm", `배경음악 "${m.bgm}"이(가) 목록에 없어요.`);
  if (typeof m.safe !== "boolean") err("safe", "안전지대는 예/아니오(true/false)로 정해 주세요.");
  if (m.band != null && !(Array.isArray(m.band) && m.band.length === 2 && isInt(m.band[0]) && isInt(m.band[1]) && m.band[0] >= 1 && m.band[0] <= m.band[1]))
    err("band", "레벨대는 [최소, 최대] 숫자 두 개예요 (예: 5~9).");
  const sizeOk = isInt(m.w) && isInt(m.h) && m.w >= MIN_SIZE && m.h >= MIN_SIZE && m.w <= MAX_SIZE && m.h <= MAX_SIZE;
  if (!sizeOk) { err("w", `맵 크기는 가로·세로 ${MIN_SIZE}~${MAX_SIZE}칸이어야 해요.`); return P; }
  for (const L of ["ground", "objects"]) {
    const rows = m[L], ko = L === "ground" ? "바닥" : "물체", known = L === "ground" ? S.ground : S.objects;
    if (!Array.isArray(rows) || rows.length !== m.h) { err(L, `${ko} 층의 줄 수가 맵 세로(${m.h})와 달라요.`); return P; }
    const bad = new Map();
    for (let y = 0; y < m.h; y++) {
      const r = rows[y];
      if (!isStr(r) || r.length !== m.w) { err(`${L}[${y}]`, `${ko} 층 ${y}번 줄의 길이가 맵 가로(${m.w})와 달라요.`, 0, y); return P; }
      for (let x = 0; x < m.w; x++) {
        const c = r[x];
        if (L === "objects" && c === " ") continue;
        if (known.size && !known.has(c) && !bad.has(c)) bad.set(c, [x, y]);
      }
    }
    for (const [c, [x, y]] of bad) err(`${L}[${y}]`, `${ko} 층에 모르는 글자 "${c}"가 있어요.`, x, y);
  }
  const inb = (x, y) => isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < m.w && y < m.h;
  const stand = (x, y) => standable(m, x, y, S.solidG);
  if (!isXY(m.entry) || !inb(m.entry[0], m.entry[1])) err("entry", "입구(처음 도착하는 곳)를 맵 안에 정해 주세요.");
  else if (!stand(m.entry[0], m.entry[1])) err("entry", "입구가 막힌 칸(물체·물·벽) 위에 있어요.", m.entry[0], m.entry[1]);
  const R = opts.deep && isXY(m.entry) ? reach(m, S.solidG) : null;
  const reachable = (x, y) => !R || R[y * m.w + x] === 1;

  if (!Array.isArray(m.spawns)) err("spawns", "몬스터 구역 목록 형식이 틀렸어요.");
  else m.spawns.forEach((s, i) => {
    const p = `spawns[${i}]`;
    if (!s || !mobs[s.k]) { err(p, `몬스터 구역 ${i + 1}: 몬스터 "${s && s.k}"를 모르겠어요.`, s && s.r && s.r[0], s && s.r && s.r[1]); return; }
    const r = s.r;
    if (!Array.isArray(r) || r.length !== 4 || !inb(r[0], r[1]) || !inb(r[2], r[3]) || r[0] > r[2] || r[1] > r[3]) { err(p, `몬스터 구역 ${i + 1}(${mobs[s.k].name}): 범위가 맵 밖이에요.`); return; }
    if (!isInt(s.n) || s.n < 1 || s.n > 40) err(p, `몬스터 구역 ${i + 1}(${mobs[s.k].name}): 마리 수는 1~40이에요.`, r[0], r[1]);
    if (s.elite != null && !(typeof s.elite === "number" && s.elite >= 0 && s.elite <= 1)) err(p, `몬스터 구역 ${i + 1}: 정예 확률은 0~100%예요.`, r[0], r[1]);
    let open = 0, reached = 0;
    for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) if (stand(x, y)) { open++; if (reachable(x, y)) reached++; }
    if (!open) err(p, `몬스터 구역 ${i + 1}(${mobs[s.k].name}): 안에 설 수 있는 칸이 하나도 없어요.`, r[0], r[1]);
    else if (R && !reached) warn(p, `몬스터 구역 ${i + 1}(${mobs[s.k].name}): 입구에서 걸어갈 수 없는 곳이에요.`, r[0], r[1]);
    if (m.safe) warn(p, "안전지대 맵에는 몬스터가 나오지 않아요.", r[0], r[1]);
  });

  const roles = defs.roles || [];
  const ids = new Set();
  if (!Array.isArray(m.npcs)) err("npcs", "NPC 목록 형식이 틀렸어요.");
  else m.npcs.forEach((n, i) => {
    const p = `npcs[${i}]`, who = (n && n.name) || `NPC ${i + 1}`;
    if (!n || !isStr(n.id) || !NPC_ID_RE.test(n.id)) err(p, `${who}: 아이디는 영어 소문자·숫자·_ 2~32글자예요.`, n && n.x, n && n.y);
    else if (ids.has(n.id)) err(p, `${who}: 아이디 "${n.id}"가 겹쳐요.`, n.x, n.y);
    else ids.add(n.id);
    if (!n) return;
    if (!isStr(n.name) || !n.name.trim()) err(p, `NPC ${i + 1}: 이름을 적어 주세요.`, n.x, n.y);
    if (roles.length && !roles.includes(n.role)) err(p, `${who}: 역할 "${n.role}"을(를) 모르겠어요.`, n.x, n.y);
    if (!inb(n.x, n.y)) err(p, `${who}: 맵 밖에 있어요.`);
    else {
      if (!stand(n.x, n.y)) warn(p, `${who}: 막힌 칸 위에 서 있어요.`, n.x, n.y);
      else if (!reachable(n.x, n.y)) warn(p, `${who}: 입구에서 걸어갈 수 없는 곳에 있어요.`, n.x, n.y);
    }
    if (!Array.isArray(n.look)) err(p, `${who}: 모습(look) 형식이 틀렸어요.`, n.x, n.y);
    if (!Array.isArray(n.lines) || n.lines.some((l) => !isStr(l))) err(p, `${who}: 대사 형식이 틀렸어요.`, n.x, n.y);
    else if (!n.lines.length && n.role === "talk") warn(p, `${who}: 할 말이 하나도 없어요.`, n.x, n.y);
  });

  if (!Array.isArray(m.portals)) err("portals", "문 목록 형식이 틀렸어요.");
  else m.portals.forEach((d, i) => checkDoor(d, `portals[${i}]`, `문 ${i + 1}`, m, ctx, P, inb, reachable));

  if (!Array.isArray(m.fires)) err("fires", "모닥불 목록 형식이 틀렸어요.");
  else m.fires.forEach((f, i) => {
    if (!isXY(f) || !inb(f[0], f[1])) err(`fires[${i}]`, `모닥불 ${i + 1}: 맵 밖이에요.`);
    else if (!stand(f[0], f[1])) warn(`fires[${i}]`, `모닥불 ${i + 1}: 막힌 칸 위에 있어요.`, f[0], f[1]);
  });
  if (m.waypoint != null) {
    if (!isXY(m.waypoint) || !inb(m.waypoint[0], m.waypoint[1])) err("waypoint", "이동의 돌이 맵 밖이에요.");
  }
  if (typeof m.fishing !== "boolean") err("fishing", "낚시 허용은 예/아니오(true/false)로 정해 주세요.");
  if (m.boss != null) {
    const b = m.boss;
    if (!b || !mobs[b.k]) err("boss", `필드 보스 "${b && b.k}"를 모르겠어요.`, b && b.x, b && b.y);
    else if (!inb(b.x, b.y)) err("boss", "필드 보스 자리가 맵 밖이에요.");
    else if (!stand(b.x, b.y)) err("boss", "필드 보스가 막힌 칸 위에 있어요.", b.x, b.y);
    if (m.safe) warn("boss", "안전지대 맵에는 보스가 나오지 않아요.", b && b.x, b && b.y);
  }
  return P;
}

/** One door (a map portal or a links.json entry). */
function checkDoor(d, p, label, m, ctx, P, inb, reachable) {
  const err = (msg, x, y) => P.push({ level: "error", path: p, msg, x, y });
  const warn = (msg, x, y) => P.push({ level: "warn", path: p, msg, x, y });
  if (!d || !inb(d.x, d.y)) { err(`${label}: 맵 밖에 있어요.`); return; }
  const maps = ctx.maps || {};
  const to = maps[d.to];
  if (!isStr(d.to) || !d.to) err(`${label}: 어디로 가는지(도착 맵) 정해 주세요.`, d.x, d.y);
  else if (!to) err(`${label}: 도착 맵 "${d.to}"이(가) 없어요.`, d.x, d.y);
  else if (!isInt(d.tx) || !isInt(d.ty) || d.tx < 0 || d.ty < 0 || d.tx >= to.w || d.ty >= to.h) err(`${label}: 도착 위치가 "${d.to}" 맵 밖이에요.`, d.x, d.y);
  if (m && m.objects && m.objects[d.y] && m.objects[d.y][d.x] !== " ") warn(`${label}: 문 칸 위에 물체가 있어 밟을 수 없어요.`, d.x, d.y);
  else if (!reachable(d.x, d.y)) warn(`${label}: 입구에서 걸어갈 수 없는 곳이에요.`, d.x, d.y);
}

/** links.json */
export function checkLinks(f, ctx) {
  const P = [];
  if (!f || f.v !== 1 || !Array.isArray(f.links)) { P.push({ level: "error", path: "links", msg: "links.json 형식이 틀렸어요 ({v:1, links:[…]})." }); return P; }
  const maps = ctx.maps || {};
  f.links.forEach((l, i) => {
    const m = l && maps[l.map];
    if (!m) { P.push({ level: "error", path: `links[${i}]`, msg: `문 ${i + 1}: 놓인 맵 "${l && l.map}"이(가) 없어요.` }); return; }
    const inb = (x, y) => isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < m.w && y < m.h;
    checkDoor(l, `links[${i}]`, `${l.label || "문"} (${l.map})`, null, ctx, P, inb, () => true);
    if (l.label != null && !isStr(l.label)) P.push({ level: "error", path: `links[${i}]`, msg: "문 이름은 글자여야 해요." });
  });
  return P;
}

/** npcs.json */
export function checkNpcs(f, ctx) {
  const P = [];
  if (!f || f.v !== 1 || !Array.isArray(f.npcs)) { P.push({ level: "error", path: "npcs", msg: "npcs.json 형식이 틀렸어요 ({v:1, npcs:[…]})." }); return P; }
  const maps = ctx.maps || {}, roles = (ctx.defs && ctx.defs.roles) || [], ids = new Set();
  f.npcs.forEach((n, i) => {
    const p = `npcs[${i}]`, who = (n && n.name) || `NPC ${i + 1}`;
    const add = (msg) => P.push({ level: "error", path: p, msg, x: n && n.x, y: n && n.y, map: n && n.map });
    if (!n) { add("NPC 형식이 틀렸어요."); return; }
    const m = maps[n.map];
    if (!m) add(`${who}: 놓인 맵 "${n.map}"이(가) 없어요.`);
    else if (!isInt(n.x) || !isInt(n.y) || n.x < 0 || n.y < 0 || n.x >= m.w || n.y >= m.h) add(`${who}: 맵 밖에 있어요.`);
    if (!isStr(n.id) || !NPC_ID_RE.test(n.id)) add(`${who}: 아이디는 영어 소문자·숫자·_ 2~32글자예요.`);
    else if (ids.has(n.id)) add(`${who}: 아이디 "${n.id}"가 겹쳐요.`);
    else ids.add(n.id);
    if (!isStr(n.name) || !n.name.trim()) add(`NPC ${i + 1}: 이름을 적어 주세요.`);
    if (roles.length && !roles.includes(n.role)) add(`${who}: 역할 "${n.role}"을(를) 모르겠어요.`);
    if (!Array.isArray(n.look)) add(`${who}: 모습(look) 형식이 틀렸어요.`);
    if (!Array.isArray(n.lines) || n.lines.some((l) => !isStr(l))) add(`${who}: 대사 형식이 틀렸어요.`);
  });
  return P;
}

/**
 * quests.json. ctx.npcIds: every NPC id that can give a quest; ctx.mapIds: every map id.
 */
export function checkQuests(f, ctx) {
  const P = [];
  const add = (path, msg, level = "error") => P.push({ level, path, msg });
  if (!f || f.v !== 1) { add("quests", "quests.json 형식이 틀렸어요 ({v:1, main, side})."); return P; }
  const defs = ctx.defs || {}, mobs = defs.mobs || {}, items = defs.items || {};
  const npcIds = new Set(ctx.npcIds || []), mapIds = new Set(ctx.mapIds || Object.keys(ctx.maps || {}));
  const itemsOk = (list, path, who) => {
    if (list == null) return;
    if (!Array.isArray(list)) { add(path, `${who}: 보상 아이템 형식이 틀렸어요.`); return; }
    list.forEach((it, j) => {
      if (!Array.isArray(it) || !items[it[0]]) add(path, `${who}: 아이템 "${Array.isArray(it) ? it[0] : it}"을(를) 모르겠어요.`);
      else if (!isInt(it[1]) || it[1] < 1 || it[1] > 999) add(path, `${who}: 아이템 ${j + 1}의 개수는 1~999예요.`);
    });
  };
  if (f.main != null) {
    if (!Array.isArray(f.main) || !f.main.length) add("main", "메인 퀘스트를 바꾸려면 한 개 이상 있어야 해요 (아니면 '기본 퀘스트 사용').");
    else f.main.forEach((q, i) => {
      const who = `메인 ${i + 1}번`;
      if (!q || !mobs[q.mob]) add(`main[${i}]`, `${who}: 몬스터 "${q && q.mob}"를 모르겠어요.`);
      if (!q) return;
      if (!isInt(q.n) || q.n < 1 || q.n > 999) add(`main[${i}]`, `${who}: 마리 수는 1~999예요.`);
      if (!isStr(q.title) || !q.title.trim()) add(`main[${i}]`, `${who}: 제목을 적어 주세요.`);
      if (!isStr(q.text)) add(`main[${i}]`, `${who}: 본문을 적어 주세요.`);
      if (!isInt(q.xp) || q.xp < 0 || !isInt(q.gold) || q.gold < 0) add(`main[${i}]`, `${who}: 경험치·골드는 0 이상의 정수예요.`);
      itemsOk(q.items, `main[${i}]`, who);
    });
  }
  if (!Array.isArray(f.side)) { add("side", "사이드 퀘스트 목록 형식이 틀렸어요."); return P; }
  const ids = new Set(f.side.map((q) => q && q.id));
  const seen = new Set();
  f.side.forEach((q, i) => {
    const p = `side[${i}]`, who = (q && q.title) || `사이드 ${i + 1}번`;
    if (!q) { add(p, `${who}: 형식이 틀렸어요.`); return; }
    if (!isStr(q.id) || !QUEST_ID_RE.test(q.id)) add(p, `${who}: 아이디는 영어 소문자·숫자·_ 3~32글자예요.`);
    else if (seen.has(q.id)) add(p, `${who}: 아이디 "${q.id}"가 겹쳐요.`);
    seen.add(q.id);
    if (!npcIds.has(q.giver)) add(p, `${who}: 의뢰인 NPC "${q.giver || "(없음)"}"를 찾을 수 없어요.`);
    if (!isStr(q.title) || !q.title.trim()) add(p, `사이드 ${i + 1}번: 제목을 적어 주세요.`);
    if (!isStr(q.text) || !q.text.trim()) add(p, `${who}: 본문(부탁하는 말)을 적어 주세요.`);
    if (!isStr(q.done)) add(p, `${who}: 완료 대사를 적어 주세요.`, "warn");
    const g = q.goal || {};
    if (g.type === "kill") { if (!mobs[g.mob]) add(p, `${who}: 잡을 몬스터를 골라 주세요.`); if (!isInt(g.n) || g.n < 1 || g.n > 999) add(p, `${who}: 잡을 수는 1~999예요.`); }
    else if (g.type === "collect") { if (!items[g.item]) add(p, `${who}: 모을 아이템을 골라 주세요.`); if (!isInt(g.n) || g.n < 1 || g.n > 999) add(p, `${who}: 모을 개수는 1~999예요.`); }
    else if (g.type === "talk") { if (!npcIds.has(g.npc)) add(p, `${who}: 말 걸 NPC를 골라 주세요.`); }
    else if (g.type === "visit") { if (!mapIds.has(g.map)) add(p, `${who}: 찾아갈 맵을 골라 주세요.`); }
    else add(p, `${who}: 목표 종류(잡기·모으기·대화·방문)를 골라 주세요.`);
    const req = q.req || {};
    if (req.lv != null && (!isInt(req.lv) || req.lv < 1 || req.lv > 99)) add(p, `${who}: 필요 레벨은 1~99예요.`);
    if (req.quest != null && !ids.has(req.quest)) add(p, `${who}: 선행 퀘스트 "${req.quest}"가 없어요.`);
    if (req.quest === q.id) add(p, `${who}: 자기 자신을 선행 퀘스트로 할 수 없어요.`);
    const rw = q.reward || {};
    if ((rw.xp != null && (!isInt(rw.xp) || rw.xp < 0)) || (rw.gold != null && (!isInt(rw.gold) || rw.gold < 0))) add(p, `${who}: 보상 경험치·골드는 0 이상의 정수예요.`);
    itemsOk(rw.items, p, who);
    if (typeof q.repeat !== "boolean") add(p, `${who}: 반복 여부는 예/아니오로 정해 주세요.`);
  });
  return P;
}
