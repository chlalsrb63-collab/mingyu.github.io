// ───────────────────────────── 협동 아르바이트: the shared engine + 동동아파트 청소 · 쥬쥬식당 서빙 · 캉캉대장간 단조 (docs/design/life-and-coop.md C) ─────────────────────────────
// A shift is a runtime instance "dim:<n>" (registerDim / closeDim, like 67-trophies.js's story arenas) that carries
// `dim.coop`; 64-dim.js leaves it alone (it has no `prog`). Everything inside is instance state — piles, bundles,
// the sofa, what a bin holds — so nothing can be duped or traded out. Numbers: COOP, COOP_T, COOP_APT (12-life-tables.js).
//
// dim.coop = { k, state: brief|run|fever|end, t0, runAt, endAt, doneAt, n (party size at the start), box (seeded rnd),
//   score, combo, comboAt, ents: [{ id, t: 0 pile (hp = dirt units) · 2 sofa, x, y, hp, cred: {pid: n}, lift }], nid, ver,
//   pl: { pid: { name, tool, hold: [cred…], pts, idleAt, x, y, actAt, hintAt, ok } }, home: [map, x, y], next, compAt }

const COOP_STATE = ["brief", "run", "fever", "end"];
const coopOf = (S, p) => { const d = inDim(p) ? dimAt(S, p.map) : null; return d && d.coop ? d.coop : null; };
const coopLive = (S) => Object.keys(S.dims).filter((id) => S.dims[id].coop).length;
/** The job's owner NPC within reach of `p` in its lobby, or null. */
function coopNpc(S, p, k) {
  const J = COOP[k];
  if (p.map !== J.lobby) return null;
  const n = mapOfS(S, p.map).npcs.find((o) => o.id === J.npc);
  return n && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < COOP_T.near ? n : null;
}
const coopCut = (c, g) => Math.round(COOP[c.k].par * (COOP[c.k].parN || COOP_T.parN)[c.n] * COOP_T.cuts[g]);
/** 0 below C, 1 C · 2 B · 3 A · 4 S. */
function coopGrade(c) { let g = 0; while (g < 4 && c.score >= coopCut(c, g)) g++; return g; }
const coopMult = (c) => (1 + 0.1 * Math.min(c.combo, 10)) * (c.state === "fever" ? 1.5 : 1);
const coopEv = (S, dim, code, x, y, a = 0) => dim.rt.ev.push(["cj", code, Math.round(x), Math.round(y), a]);
const coopToastAll = (S, dim, m) => { for (const o of dimInside(S, dim.id)) toast(o, m); };

// ── the engine

/** Points for good work: combo and fever multiply them; `cred` ({pid: weight}) shares them out. */
function coopGood(S, c, base, cred) {
  c.combo = S.now - c.comboAt <= COOP[c.k].combo ? c.combo + 1 : 0;
  c.comboAt = S.now;
  const pts = Math.round(base * coopMult(c));
  c.score += pts;
  const w = Object.values(cred).reduce((s, v) => s + v, 0) || 1;
  for (const pid of Object.keys(cred)) if (c.pl[pid]) c.pl[pid].pts += (pts * cred[pid]) / w;
  return pts;
}
function coopFail(c, pen) { c.score = Math.max(0, c.score - pen); c.combo = 0; }

/** Who goes in with `p`: the party's members in the same lobby, alive (at most 4). */
function coopCrew(S, p) {
  const party = S.parties[p.party];
  const crew = (party ? party.m.map((pid) => S.players[pid]) : [p]).filter((o) => o && o.map === p.map && !o.dead).slice(0, 4);
  const b = buddyOf(S, p);
  if (crew.length === 1 && !buddyInParty(S, p) && !p.buddyCall && b?.map === p.map) crew.push(b);
  return crew;
}
const coopWorker = (S, pid) => S.players[pid] || S.buddies[pid];
const coopInside = (S, dim) => Object.keys(dim.coop.pl).map((pid) => coopWorker(S, pid)).filter((o) => o?.map === dim.id);
/** The leader starts a shift: everyone of the party in the lobby goes in (2–4: co-op jobs are party-only). */
function coopStart(S, p, k) {
  const J = COOP[k], party = S.parties[p.party], crew = coopCrew(S, p);
  S.dimN = (S.dimN | 0) + 1;
  const id = "dim:" + S.dimN, seed = Math.imul(S.seed ^ S.nextId++, 2654435761) | 0;
  const map = fromEditor(J.tpl, id);
  map.style = J.tpl.style;   // the code-built halls may use a shift-only style (apt) the editor list lacks
  finalize(map);
  const t0 = S.now, runAt = t0 + COOP_T.briefMs, endAt = runAt + J.mins * 60000;
  const dim = registerDim(S, { id, map, party: p.party || 0, seed, lv: 1, theme: "interior", expire: endAt + COOP_T.endMs + 60000 });
  const lob = mapOf(J.lobby);
  const c = dim.coop = { k, state: "brief", t0, runAt, endAt, doneAt: 0, n: crew.length, box: { seed }, score: 0, combo: 0, comboAt: -1e9,
    ents: [], nid: 1, ver: 1, pl: {}, home: [J.lobby, ...tilePx(lob.entry)], next: {}, compAt: 0 };
  if (party) party.coop = id;
  crew.forEach((o, i) => {
    const [x, y] = tilePx(J.start[i]);
    c.pl[o.pid] = { name: o.ch.name, tool: J.tools[i % J.tools.length], hold: [], pts: 0, idleAt: t0, x, y, actAt: 0, hintAt: 0, ok: false };
    if (o.owner) { buddyPlace(S, o, id, x, y, true); return; }
    changeMap(S, o, id, x, y);
    o.spdBuff = Math.max(o.spdBuff || 0, endAt);
    toast(o, `[${J.name}] ${crew.length}명 근무 시작! ${J.hint} (Space / F)`);
    o.dirty = true;
  });
  COOP_JOB[k].init(S, dim, c);
  return dim;
}
/** Out of the shift, back to the lobby's door (no reward unless it was paid at the end). */
function coopHome(S, p, c) {
  const [map, x, y] = c.home;
  p.spdBuff = Math.min(p.spdBuff || 0, S.now);
  changeMap(S, p, map, x, y);
  p.dirty = true;
}
function coopClose(S, dim) {
  for (const o of dimInside(S, dim.id)) coopHome(S, o, dim.coop);
  for (const id of Object.keys(S.parties)) if (S.parties[id].coop === dim.id) S.parties[id].coop = 0;
  closeDim(S, dim.id);
}
/** Time's up: the grade, the report card, and each eligible member's pay (once a day per job). */
function coopFinish(S, dim, inside) {
  const c = dim.coop;
  if (c.state === "end") return;
  const g = coopGrade(c);
  c.state = "end"; c.doneAt = S.now + COOP_T.endMs; c.ver++;
  const avg = inside.reduce((s, o) => s + (c.pl[o.pid] ? c.pl[o.pid].pts : 0), 0) / Math.max(1, inside.length);
  const rows = [];
  for (const pid of Object.keys(c.pl)) {
    const q = c.pl[pid], o = coopWorker(S, pid);
    q.ok = !!(o && o.map === dim.id && (S.now - q.idleAt < COOP_T.idleMs && q.pts >= COOP_T.lazy * avg));
    const npc = !!o?.owner || pid.startsWith("buddy:");
    rows.push([npc ? q.name + " (짝꿍)" : q.name, Math.round(q.pts), COOP[c.k].tools.indexOf(q.tool), npc ? 2 : q.ok ? 1 : 0]);
  }
  S.coopBest = S.coopBest || {};
  S.coopBest[c.k] = Math.max(S.coopBest[c.k] || 0, Math.round(c.score));
  for (const o of inside) {
    if (o.owner) continue;
    const q = c.pl[o.pid];
    let reward = 0;
    if (q?.ok || coopSelf(o).includes(c.k)) reward = coopPay(S, o, c, q?.ok ? g : 0);
    else toast(o, "근무 태도 불량 — 보상 없음");
    o.coopRes = [g, Math.round(c.score), S.coopBest[c.k], rows, [0, 1, 2, 3].map((i) => coopCut(c, i)), reward];
  }
  coopEv(S, dim, 21, 0, 0, g);
}
/** Report pay status: 0 no grade, 1 paid, 2 already claimed. Only a paid clear advances achievements. */
function coopPay(S, p, c, g) {
  const ch = p.ch, J = COOP[c.k], R = COOP_T, today = dayOf(S.now);
  if (coopSelf(p).includes(c.k)) {
    toast(p, "오늘 보수는 이미 받았어요. 친구들과 다시 참여할 수 있어요.");
    return 2;
  }
  if (!g) {
    toast(p, "C등급에 도달하면 보수를 받을 수 있어요. 오늘 다시 도전할 수 있어요.");
    return 0;
  }
  if (ch.coopDay !== today) { ch.coopDay = today; ch.coopDone = []; }
  // one base reward, × the grade's share (C 100 % · B 105 % · A 110 % · S 120 %) for gold and XP; stones and gear stay at base
  const Tt = Math.max(1, Math.floor(toTier(ch.lvl))), k = R.gradeK[g - 1], life = lifeNeed(ch.life[J.skill].lv) * R.base.life;
  ch.coopDone.push(c.k);
  ch.cnt.coop++;
  const achievement = "coopS_" + c.k;
  if (g === 4 && Object.hasOwn(ch.cnt, achievement)) ch.cnt[achievement]++;   // registered jobs earn an S achievement
  checkAch(S, p);
  const gold = Math.round(R.base.gold * Tt * k);
  ch.gold += gold;
  p.gain.push(["gold", gold]);
  const tokens = gainWillowToken(p, 2);
  if (addItem(ch, "stone", R.base.stone)) p.gain.push(["item", "stone", R.base.stone, 0]);
  rewardGear(S, p, Tt, R.base.gearQ);
  gainXp(S, p, Math.round(tierXp(Tt) * R.base.xp * k));
  gainLife(S, p, J.skill, life * k);
  addRep(S, p, J.npc, R.rep);
  toast(p, `[${J.name}] ${"CBAS"[g - 1]} 등급! 오늘의 보수 ${Math.round(k * 100)}%를 받았습니다.${tokens ? ` 버드나무토큰 +${tokens}` : ""}`);
  p.dirty = true;
  return 1;
}
/** Every tick: each shift — empty, its phases, its job's own clock. */
function coopTick(S, now) {
  for (const id of Object.keys(S.dims)) {
    const dim = S.dims[id], c = dim.coop;
    if (!c) continue;
    const inside = coopInside(S, dim);
    if (!inside.some((o) => !o.owner)) {
      if (!c.emptyAt) c.emptyAt = now;
      if (now - c.emptyAt >= COOP_T.emptyMs || now >= dim.expire) coopClose(S, dim);
      continue;
    }
    c.emptyAt = 0;
    // anti-AFK: walking 16 px counts as being at work too
    for (const o of inside) { const q = c.pl[o.pid]; if (q && dist(o.x, o.y, q.x, q.y) >= 16) { q.x = o.x; q.y = o.y; q.idleAt = now; } }
    if (c.state === "brief" && now >= c.runAt) { c.state = "run"; c.comboAt = -1e9; coopToastAll(S, dim, "근무 시작!"); }
    if (c.state === "run" && now >= c.endAt - COOP_T.feverMs) {
      c.state = "fever";
      coopEv(S, dim, 14, 0, 0); coopToastAll(S, dim, "피버 타임! 남은 1분, 점수 ×1.5");
    }
    if (c.state === "run" || c.state === "fever") {
      if (now >= c.endAt) coopFinish(S, dim, inside);
      else COOP_JOB[c.k].tick?.(S, dim, c, now, inside);
    } else if (c.state === "end" && now >= c.doneAt) coopClose(S, dim);
  }
}

// ── 동동아파트 청소
const aptStation = (c, p, key) => { const [x, y] = tilePx(COOP[c.k].st[key]); return dist(p.x, p.y, x, y) <= COOP_T.station + 8; };

// ── 쥬쥬식당 서빙 (C.5, v1)

/** The closest station of this kind within reach, or -1. */
function coopSt(c, p, key) {
  const v = COOP[c.k].st[key], list = Array.isArray(v[0]) ? v : [v];
  let closest = -1, best = COOP_T.station + 8;
  for (const [i, tile] of list.entries()) {
    const [x, y] = tilePx(tile), d = dist(p.x, p.y, x, y);
    if (d > best || (d === best && closest >= 0)) continue;
    closest = i; best = d;
  }
  return closest;
}
function dinerCookCheck(c, p, i, r) {
  const { stove } = COOP.diner.st;
  if (!Number.isInteger(i) || i < 0 || i >= stove.length || !Number.isInteger(r) || !COOP_DINER.dishes[r]) return "조리대와 만들 요리를 선택하세요.";
  const [x, y] = tilePx(stove[i]);
  if (dist(p.x, p.y, x, y) > COOP_T.station + 8) return "선택한 조리대 가까이에서 요리하세요.";
  if (c.pl[p.pid].hold.length) return "먼저 들고 있는 것을 내려놓으세요.";
  return c.ents.some((e) => e.t === 4 && e.si === i) ? "이 조리대는 사용 중이에요." : "";
}

/** The central aisle from the entrance connects to the clear path in front of each row of tables. */
function dinerWalkMs(x, y) {
  const [dx, dy] = tilePx(COOP.diner.st.door);
  return Math.ceil((Math.abs(x - dx) + Math.abs(y + T - dy)) * 10 / COOP_DINER.walkSpeed) * 100;
}

function dinerOrder(c, now) {
  const R = COOP_DINER, J = COOP.diner;
  const busy = new Set(c.ents.filter((e) => (e.t === 3 && !e.goneAt) || e.t === 9).map((e) => e.ti));
  const free = J.tables.map((_, i) => i).filter((i) => !busy.has(i));
  if (!free.length) return;
  const ti = free[ri(c.box, 0, free.length - 1)], r = ri(c.box, 0, R.dishes.length - 1);
  const [x, y] = tilePx(J.tables[ti]), walkMs = dinerWalkMs(x, y);
  const pat = Math.round(R.patience[c.n] * (c.state === "fever" ? 0.8 : 1)), arriveAt = now + walkMs;
  c.ents.push({ id: c.nid++, t: 3, x, y, r, ti, arriveAt, walkMs, until: arriveAt + pat, pat, seated: false, eatAt: 0, goneAt: 0 });
  c.ver++;
}

function dinerRow(e, at, now, ds) {
  if (e.t === 4) return [...at, e.r, Math.max(0, ds(e.doneAt))];
  if (e.t === 9) return [...at, Math.max(0, ds(e.due)), e.late ? 1 : 0];
  return [...at, e.seated && !e.goneAt ? e.r : -1, e.seated && !e.eatAt && !e.goneAt ? Math.max(0, ds(e.until)) : 0,
    Math.round(e.pat / 100), Math.max(0, ds(e.arriveAt)), Math.round(e.walkMs / 100), Math.max(0, ds(e.eatAt)), Math.max(0, ds(e.goneAt)), e.goneAt ? 1 : 0];
}

// ── 캉캉대장간 단조 (C.6, v1)
// Ents: furnaces { t: 6, fi, T, bars: [piece|null ×slots] }, anvils { t: 7, ai, pc, beat0, per, lastK }, orders { t: 8, r,
// until, dur }. A piece { r: order kind (−1 until it is on an anvil), q quality, n strikes, heat 0–100, hot (hot until),
// heats (times out of the fire), st: bar|shaped|quenched, ct: {pid: tongs work}, ch: {pid: hammer work} } is always in one
// place: a furnace slot, an anvil, or a worker's hands.

const forgeEnt = (c, t, key, i) => c.ents.find((e) => e.t === t && e[key] === i);
const forgeCr = (o, pid) => { o[pid] = (o[pid] || 0) + 1; };
/** Every piece in the shift (furnaces, anvils, the cauldron, the 진열대, hands, herbs being picked). */
const forgePieces = (c) => [...c.ents.flatMap((e) => (e.t === 6 ? e.bars.filter(Boolean) : (e.t === 7 || e.t === 10 || e.t === 12) && e.pc ? [e.pc] : [])), ...Object.values(c.pl).flatMap((q) => (q.herb ? [...q.hold, q.herb] : q.hold))];
/** The shop's numbers (forge or the alch's kiln) and a piece's grade (a potion's is set when it is bottled). */
const shopF = (c) => (c.k === "alch" ? COOP_BREW : COOP_FORGE);
const shopGrade = (h) => (h.gi !== undefined ? h.gi : forgeGrade(COOP_FORGE, h));
/** The waiting customers no piece is made for yet, most urgent first (a piece serves a customer of its kind and ingot). */
function forgeOpen(c) {
  const busy = forgePieces(c).filter((h) => h.r >= 0);
  return c.ents.filter((e) => e.t === 8 && !e.gone).sort((a, b) => a.until - b.until).filter((o) => {
    const i = busy.findIndex((h) => h.r === o.r && (o.m === undefined || h.m === o.m));
    if (i >= 0) busy.splice(i, 1);
    return i < 0;
  });
}
/**
 * The kind a new piece on an anvil becomes: the most urgent open order (a waiting customer) no piece is already for, else the
 * most urgent, else 편자. With an ingot `m` (the forge): the most urgent open order for that ingot, else (every order covered)
 * any order for it, else 편자 when nobody waits at all; −1 when the waiting customers want another ingot (refused).
 */
function forgeKind(c, m) {
  const open = forgeOpen(c), ords = c.ents.filter((e) => e.t === 8 && !e.gone).sort((a, b) => a.until - b.until);
  if (m === undefined) return open.length ? open[0].r : ords.length ? ords[0].r : 0;
  const fit = open.find((o) => o.m === m) || (!open.length && ords.find((o) => o.m === m));
  return fit ? fit.r : ords.length ? -1 : 0;
}
/** "금빛 투구": an order's name with its ingot's colour (the forge; the alch's names stand alone). */
const forgeName = (c, r, m) => (m === undefined || c.k !== "forge" ? COOP[c.k].skin.orders[r] : `${COOP_FORGE.metals[m].col} ${COOP[c.k].skin.orders[r]}`);
/**
 * A forge entity on the wire: furnace [.., T, heat per slot (−1 empty; 100 hot)] · anvil [.., state 0 empty · 1 hot ·
 * 2 cooled · 3 shaped, kind, strikes, ms to the next beat, beat ms] · order [.., kind, ds left, ds total].
 */
function forgeRow(e, at, now, ds) {
  // the forge's ingots (metal index, appended): per furnace slot (−1 empty), per customer, per shelf piece, per anvil piece (−1)
  const mt = (h) => (h && h.m !== undefined ? [h.m] : []);
  if (e.t === 6) return [...at, Math.round(e.T), ...e.bars.map((b) => (b ? Math.floor(b.heat) : -1)), ...e.bars.map((b) => (b ? b.m | 0 : -1))];
  // forge v2: a customer [.., ds to arrive, 0 waiting · 1 bought · 2 angry, ds to gone, ingot] · a piece on the 진열대 [id, 10, x, y, kind, grade, ingot]
  if (e.t === 8) return e.spot === undefined ? [...at, e.r, ds(e.until), Math.round(e.dur / 100)] : [...at, e.r, ds(e.until), Math.round(e.dur / 100), Math.max(0, ds(e.at)), e.gone, e.gone ? Math.max(0, ds(e.goneAt)) : 0, ...mt(e)];
  if (e.t === 10) return [...at, e.pc.r, shopGrade(e.pc), ...mt(e.pc)];
  const pc = e.pc, hot = pc && pc.st === "bar" && pc.hot > now;
  const next = hot ? e.beat0 + Math.max(0, Math.ceil((now - e.beat0) / e.per)) * e.per - now : 0;
  const row = [...at, !pc ? 0 : pc.st !== "bar" ? 3 : hot ? 1 : 2, pc ? pc.r : -1, pc ? pc.n : 0, next, e.per];
  // forge v2 anvils: [.., ms from now to the pattern's beat 0, ms of heat left, ingot (−1 empty)] (the notes are in defs: orders[kind][4])
  return e.v2 ? [...row, hot ? Math.round(e.beat0 - now) : 0, hot ? Math.round(pc.hot - now) : 0, pc ? pc.m | 0 : -1] : row;
}
const forgeMed = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
/** A piece's grade index (0 걸작 … 3 하) by its quality against its strikes or notes. */
const forgeGrade = (F, h) => F.grades.findIndex(([m]) => h.q >= m * (F.orders[h.r].pat ? F.orders[h.r].pat.length : F.orders[h.r].n));
/** Tongs and hammer shares of a piece's pay ({pid: weight}). */
function forgeCred(F, h) {
  const cred = {};
  for (const [part, k] of [[h.ct, F.tongsK], [h.ch, F.hammerK]]) {
    const w = Object.values(part).reduce((s, v) => s + v, 0) || 1;
    for (const pid of Object.keys(part)) cred[pid] = (cred[pid] || 0) + (k * part[pid]) / w;
  }
  return cred;
}
const COOP_JOB = {
  apt: {
    init(S, dim, c) {
      const m = dim.map, J = COOP.apt, [dx, dy] = tilePx(J.st.dump);
      const spots = [], parity = ri(c.box, 0, 1);
      for (let i = 0; i < m.reach.length; i++) {
        if (!m.reach[i]) continue;
        const tx = i % m.w, ty = Math.floor(i / m.w);
        if ((tx + ty) % 2 !== parity) continue;
        const [x, y] = tilePx([tx, ty]);
        if (dist(x, y, dx, dy) > COOP_T.station + 8 + T) spots.push([x, y]);
      }
      c.total = Math.min(spots.length, Math.round(J.par * J.parN[c.n]));
      // Shuffle only the picks we need and cycle variants so every shift has all four.
      for (let i = 0; i < c.total; i++) {
        const j = ri(c.box, i, spots.length - 1), [x, y] = spots[j];
        spots[j] = spots[i];
        c.ents.push({ id: c.nid++, t: 0, x, y, variant: i % COOP_APT.variants });
      }
    },
    tick(S, dim, c, now, inside) {
      const [x, y] = tilePx(COOP.apt.st.dump);
      for (const [pid, q] of Object.entries(c.pl)) {
        if (!q.hold.length) continue;
        const p = coopWorker(S, pid);
        if (!p || p.map !== dim.id) {
          // The rest of the party can finish if a worker leaves with a full bin.
          c.ents.push(...q.hold);
          q.hold = [];
          c.ver++;
        } else if (aptStation(c, p, "dump")) {
          const count = q.hold.length;
          q.hold = [];
          c.score += count;
          q.pts += count;
          q.idleAt = now;
          coopEv(S, dim, 5, x, y, count);
        }
      }
      if (c.score >= c.total) coopFinish(S, dim, inside);
    },
    act(S, dim, c, p, q) {
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
      const i = c.ents.findIndex((e) => Math.floor(e.x / T) === tx && Math.floor(e.y / T) === ty);
      if (i < 0) return "쓰레기가 있는 칸 위에서 주워 주세요.";
      if (q.hold.length >= COOP_APT.binCap) return "쓰레기통이 가득 찼어요! 비워주세요";
      const [e] = c.ents.splice(i, 1);
      q.hold.push(e);
      c.ver++;
      coopEv(S, dim, 6, e.x, e.y, q.hold.length);
      if (q.hold.length === COOP_APT.binCap) {
        toast(p, "쓰레기통이 가득 찼어요! 비워주세요");
        q.hintAt = S.now + 1200;
      }
      return true;
    },
    sum: (c) => [c.total - c.score, c.total],
    what: (q) => q.hold.length,
  },
  diner: {
    init(S, dim, c) {
      c.served = 0; c.miss = 0; c.openN = c.n;
      c.next = { order: c.runAt + COOP_DINER.firstMs };
    },
    tick(S, dim, c, now) {
      const R = COOP_DINER;
      if (now >= c.next.order) {
        const rush = c.openN > 0;
        c.next.order = now + (rush ? 1700 : R.orderMs[c.n]);
        if (rush) c.openN--;
        if (c.ents.filter((e) => e.t === 3 && !e.goneAt).length < R.seats[c.n]) dinerOrder(c, now);
      }
      for (const e of [...c.ents]) {
        if (e.t === 3 && e.goneAt && now >= e.goneAt) {
          c.ents.splice(c.ents.indexOf(e), 1); c.ver++;
        } else if (e.t === 3 && !e.seated && now >= e.arriveAt) {
          e.seated = true; c.ver++;
          coopEv(S, dim, 40, e.x, e.y, e.r);
        } else if (e.t === 3 && !e.goneAt && e.eatAt && now >= e.eatAt) {
          e.goneAt = now + e.walkMs;
          c.ents.push({ id: c.nid++, t: 9, x: e.x, y: e.y, ti: e.ti, due: now + R.plateMs, late: false });
          c.ver++;
        } else if (e.t === 3 && !e.goneAt && !e.eatAt && now >= e.until) {
          e.goneAt = now + e.walkMs;
          c.ver++; c.miss++;
          coopFail(c, R.angryPen); coopEv(S, dim, 32, e.x, e.y, R.angryPen);
          coopToastAll(S, dim, `[화난 손님] ${R.dishes[e.r].name}${pp(R.dishes[e.r].name, "을를")} 못 받고 떠났어요! 점수 -${R.angryPen}`);
        } else if (e.t === 9 && !e.late && now >= e.due) {
          e.late = true; c.ver++;
          coopFail(c, R.platePen); coopEv(S, dim, 44, e.x, e.y, R.platePen);
          coopToastAll(S, dim, `빈그릇을 오래 방치했어요. 점수 -${R.platePen}`);
        }
      }
    },
    act(S, dim, c, p, q, d, a = {}) {
      const R = COOP_DINER, J = COOP.diner, now = S.now, held = q.hold[0];
      if (a.r !== undefined) {
        const error = dinerCookCheck(c, p, a.i, a.r);
        if (error) return error;
        const [x, y] = tilePx(J.st.stove[a.i]);
        c.ents.push({ id: c.nid++, t: 4, x, y, r: a.r, si: a.i, doneAt: now + R.dishes[a.r].cook, cook: p.pid });
        c.ver++; coopEv(S, dim, 31, x, y, a.r);
        return true;
      }
      if (held && coopSt(c, p, "sink") >= 0) {
        q.hold = [];
        if (held.r !== 3) { toast(p, "들고 있던 요리를 버렸어요."); return true; }
        const pts = coopGood(S, c, R.washPts, { [p.pid]: 1 });
        coopEv(S, dim, 42, p.x, p.y, pts);
        return true;
      }
      const stove = coopSt(c, p, "stove");
      if (stove >= 0) {
        if (held) return "들고 있는 요리나 빈그릇을 먼저 내려놓으세요.";
        const pot = c.ents.find((e) => e.t === 4 && e.si === stove);
        if (!pot) return "조리대에서 만들 요리를 선택하세요.";
        if (now < pot.doneAt) return "아직 요리 중이에요.";
        c.ents.splice(c.ents.indexOf(pot), 1); c.ver++;
        q.hold = [{ r: pot.r, cook: pot.cook }];
        coopEv(S, dim, 30, p.x, p.y, pot.r);
        return true;
      }
      const table = coopSt(c, p, "tables");
      const target = table >= 0 && c.ents.find((e) => (e.t === 9 || (e.t === 3 && !e.goneAt)) && e.ti === table);
      if (!target) return "조리대, 손님의 테이블이나 싱크대 가까이에서 작업하세요.";
      if (target.t === 9) {
        if (held) return "손이 비어 있어야 빈그릇을 들 수 있어요.";
        c.ents.splice(c.ents.indexOf(target), 1); c.ver++;
        q.hold = [{ r: 3 }];
        coopEv(S, dim, 43, target.x, target.y);
        return true;
      }
      if (!target.seated) return "손님이 자리에 앉고 나서 주문을 확인하세요.";
      if (target.eatAt) return "손님이 식사 중이에요.";
      if (now >= target.until) return "손님이 떠나고 있어요.";
      if (!held) return `${R.dishes[target.r].name} 주문이에요.`;
      if (held.r !== target.r) return held.r === 3 ? "빈그릇은 싱크대로 가져가세요." : "주문과 다른 요리예요. 남은 요리는 싱크대에서 버릴 수 있어요.";
      q.hold = []; target.eatAt = now + R.eatMs;
      c.ver++; c.served++;
      const cred = { [p.pid]: 1 };
      if (held.cook !== p.pid) cred[held.cook] = 1;
      const pts = coopGood(S, c, R.dishes[target.r].pts, cred);
      coopEv(S, dim, 38, target.x, target.y, pts);
      return true;
    },
    sum: (c) => [c.served, c.miss],
    what: (q) => q.hold.map((h) => h.r),
  },
};

// ── 캉캉대장간 단조: one tongs worker and one hammer worker strike each beat together.

const forgeBeatAt = (a, p) => dist(p.x, p.y, a.x, a.y) <= COOP_T.station + 8;
const forgeBound = (c, pid) => c.anvils.find((a) => a.pair?.ids.includes(pid));
const forgePending = (c) => c.ents.filter((e) => e.t === 8 && !e.gone).sort((a, b) => a.until - b.until);
function forgeWalkMs(x, y) {
  const [dx, dy] = tilePx(COOP.forge.st.door);
  return Math.round((dist(x, y, dx, dy) * 1000) / 48);
}
function forgeLeave(c, guest, now, outcome) {
  guest.gone = outcome;
  guest.goneAt = now + forgeWalkMs(guest.x, guest.y);
  c.ver++;
}

function forgeOrder(c, now) {
  const F = COOP_FORGE, seats = COOP.forge.seats, orders = forgePending(c);
  const spot = seats.findIndex((_, i) => !orders.some((e) => e.spot === i));
  if (orders.length >= F.open[c.n] || spot < 0) return;
  const r = ri(c.box, 0, F.orders.length - 1);
  let pick = ri(c.box, 1, F.metals.reduce((n, o) => n + o.w, 0));
  const m = F.metals.findIndex((o) => (pick -= o.w) <= 0), [x, y] = tilePx(seats[spot]);
  const at = now + forgeWalkMs(x, y);
  c.ents.push({ id: c.nid++, t: 8, x, y, r, m, spot, at, until: at + F.deadMs, dur: F.deadMs, gone: 0 });
  c.ver++;
}

function forgePair(S, dim, c, a, p) {
  const order = a.order;
  if (!order || S.now >= order.until) return "집게 담당이 모루에 주문 주괴를 올리면 시작할 수 있어요.";
  if (a.pair) return "이 모루는 이미 단조 중이에요.";
  const workers = Object.keys(c.pl).filter((id) => {
    const other = coopWorker(S, id), q = c.pl[id];
    return other && other.map === dim.id && q.tool === "tongs" && !q.hold.length && forgeBeatAt(a, other) && !forgeBound(c, id);
  });
  const tongs = workers.includes(a.loader) ? a.loader : workers[0];
  if (!tongs) return "모루 곁에 집게 담당이 한 명 더 필요해요.";
  a.pair = { ids: [tongs, p.pid], eids: [coopWorker(S, tongs).eid, p.eid], taps: 0, noteAt: S.now + COOP_FORGE.leadMs };
  c.ver++;
  coopEv(S, dim, 61, a.x, a.y, order.r);
  return true;
}

function forgeBeat(S, dim, c, a, p) {
  const F = COOP_FORGE, order = a.order, pair = a.pair, O = F.orders[order.r];
  if (S.now >= order.until || !pair.ids.every((pid) => {
    const other = coopWorker(S, pid);
    return other && other.map === dim.id && forgeBeatAt(a, other);
  })) return "";
  if (Math.abs(S.now - pair.noteAt) > F.windowMs) return "";
  const bit = 1 << pair.ids.indexOf(p.pid);
  if (pair.taps & bit) return "";
  pair.taps |= bit;
  c.ver++;
  coopEv(S, dim, 62, a.x, a.y, p.eid);
  if (pair.taps !== 3) return true;
  a.progress++;
  if (a.progress < O.beats) {
    pair.taps = 0;
    pair.noteAt += O.per;
    return true;
  }
  const cred = Object.fromEntries(pair.ids.map((pid) => [pid, 1]));
  if (a.loader && !Object.hasOwn(cred, a.loader)) cred[a.loader] = 0.5;
  forgeLeave(c, order, S.now, 1);
  c.done++;
  a.order = null; a.pair = null; a.progress = 0;
  const pts = coopGood(S, c, O.pts * F.metals[order.m].price, cred);
  coopEv(S, dim, 65, order.x, order.y, pts);
  return true;
}

function forgeAnvilRow(e, at, now) {
  const o = e.order, pair = e.pair, F = COOP_FORGE, recipe = o && F.orders[o.r];
  return [...at, o?.r ?? -1, o?.m ?? -1, pair ? 2 : o ? 1 : 0, pair ? Math.round(pair.noteAt - now) : 0,
    F.windowMs, e.progress, recipe?.beats ?? 0, ...(pair?.eids ?? [0, 0]), pair?.taps ?? 0];
}

/** A quenched piece onto the first free slot of the 진열대. */
function forgeShelve(S, dim, c, p, q, h) {
  const J = COOP[c.k], on = c.ents.filter((e) => e.t === 10);
  if (on.length >= J.st.shelf.length) return J.skin.txt.full;
  const slot = J.st.shelf.findIndex((t, i) => !on.some((e) => e.slot === i)), [x, y] = tilePx(J.st.shelf[slot]);
  c.ents.push({ id: c.nid++, t: 10, x, y, slot, pc: h });
  q.hold = []; c.ver++;
  coopEv(S, dim, 66, x, y, h.r);
  return true;
}
/** A customer buys: the item × its grade × patience left × mult, shared by the tongs and the hammers; then they go. */
function forgeSell(S, dim, c, e, s, now) {
  const F = shopF(c), K = COOP[c.k].skin, h = s.pc, gi = shopGrade(h), name = forgeName(c, h.r, h.m), mk = h.m !== undefined ? COOP_FORGE.metals[h.m].price : 1;
  c.ents.splice(c.ents.indexOf(s), 1);
  e.gone = 1; e.goneAt = now + F.leaveMs; c.done++; c.ver++;
  const pts = coopGood(S, c, F.orders[h.r].pts * mk * F.grades[gi][1] * (1 + (F.timeK * Math.max(0, e.until - now)) / e.dur), forgeCred(F, h));
  coopEv(S, dim, 13, s.x, s.y, pts);
  coopToastAll(S, dim, `[${K.grades[gi]}] 손님이 ${name}${pp(name, "을를")} 사 갔어요! +${pts}`);
}
/** A customer walks in for a piece: one on the shelf nobody waits for first, else a kind the shift has unlocked (seeded). */
function forgeCustomer(S, dim, c, now) {
  const F = shopF(c), J = COOP[c.k], spot = J.seats.findIndex((t, i) => !c.ents.some((e) => e.t === 8 && e.spot === i));
  if (spot < 0) return;
  const want = c.ents.filter((e) => e.t === 8 && !e.gone), left = [];
  for (const s of c.ents.filter((e) => e.t === 10)) { const i = want.findIndex((e) => shopFits(e, s.pc)); if (i >= 0) want.splice(i, 1); else left.push(s.pc); }
  const menu = F.orders.map((o, i) => i).filter((i) => now - c.runAt >= (F.orders[i].at || 0));
  const r = left.length ? left[0].r : menu[ri(c.box, 0, menu.length - 1)];
  // the forge's customers want an ingot too (weighted by metals[].w)
  let m;
  if (F.metals) { if (left.length) m = left[0].m; else { let u = ri(c.box, 1, F.metals.reduce((s, o) => s + o.w, 0)); m = F.metals.findIndex((o) => (u -= o.w) <= 0); } }
  const [x, y] = tilePx(J.seats[spot]), [dx, dy] = tilePx(J.door);
  c.ents.push({ id: c.nid++, t: 8, x, y, r, m, until: now + F.deadMs, dur: F.deadMs, at: now + Math.round((dist(x, y, dx, dy) / F.walk) * 1000), spot, gone: 0, goneAt: 0 });
  c.ver++; coopEv(S, dim, 62, dx, dy, r);
}
/** A piece is what customer `e` came for: its kind, and its ingot at the forge. */
const shopFits = (e, pc) => pc.r === e.r && (e.m === undefined || pc.m === e.m);
/** A customer each tick: gone out of sight, angry at the end of their patience, or buying the best piece they came for. */
function shopCustomer(S, dim, c, e, now) {
  const F = shopF(c), K = COOP[c.k].skin;
  if (e.gone) { if (now >= e.goneAt) { c.ents.splice(c.ents.indexOf(e), 1); c.ver++; } }
  else if (now >= e.until) {
    e.gone = 2; e.goneAt = now + F.leaveMs; c.late++; c.ver++;
    coopFail(c, F.latePen); coopEv(S, dim, 61, e.x, e.y, e.r);
    const name = forgeName(c, e.r, e.m);
    coopToastAll(S, dim, `[화난 손님] ${name}${pp(name, "을를")} 못 사고 떠났어요! 점수 -${F.latePen}`);
  } else if (now >= e.at + F.browseMs) {
    const s = c.ents.filter((o) => o.t === 10 && shopFits(e, o.pc)).sort((a, b) => b.pc.q - a.pc.q || a.id - b.id)[0];
    if (s) forgeSell(S, dim, c, e, s, now);
  }
}
/** The door: the opening rush, then a customer every `orderMs[n]` while there is room. */
function shopOpen(S, dim, c, now) {
  const F = shopF(c);
  if (now < c.next.order) return;
  const rush = c.openN > 0;
  c.next.order = now + (rush ? 1500 : F.orderMs[c.n]);
  if (rush) c.openN--;
  if (c.ents.filter((e) => e.t === 8 && !e.gone).length < F.open[c.n]) forgeCustomer(S, dim, c, now);
}
COOP_JOB.forge = {
  init(S, dim, c) {
    c.anvils = COOP.forge.st.anvil.map((tile, ai) => {
      const [x, y] = tilePx(tile);
      return { id: c.nid++, t: 7, x, y, ai, order: null, pair: null, progress: 0, loader: "" };
    });
    c.ents.push(...c.anvils);
    c.done = 0; c.late = 0;
    c.openN = c.n;
    c.next.order = c.runAt + COOP_FORGE.firstMs;
  },
  tick(S, dim, c, now) {
    const F = COOP_FORGE;
    for (let i = c.ents.length - 1; i >= 0; i--) {
      const guest = c.ents[i];
      if (guest.t === 8 && guest.gone && now >= guest.goneAt) { c.ents.splice(i, 1); c.ver++; }
    }
    for (const e of forgePending(c)) {
      if (!e.seated && now >= e.at) { e.seated = true; c.ver++; coopEv(S, dim, 50, e.x, e.y, e.r); }
      if (now < e.until) continue;
      forgeLeave(c, e, now, 2);
      const a = c.anvils.find((a) => a.order === e);
      if (a) { a.order = null; a.pair = null; a.progress = 0; }
      c.late++;
      coopFail(c, F.latePen);
      coopEv(S, dim, 68, e.x, e.y, F.latePen);
    }
    for (const a of c.anvils) {
      if (!a.pair) continue;
      if (a.pair.ids.some((pid) => {
        const worker = coopWorker(S, pid);
        return worker?.map !== dim.id || !forgeBeatAt(a, worker);
      })) {
        a.pair = null;
        c.ver++;
      } else if (now > a.pair.noteAt + F.windowMs) {
        const per = F.orders[a.order.r].per;
        a.pair.noteAt = Math.max(a.pair.noteAt + per, now + per / 2);
        a.pair.taps = 0;
        c.ver++;
        coopFail(c, F.missPen);
        coopEv(S, dim, 63, a.x, a.y, F.missPen);
      }
    }
    if (now >= c.next.order) {
      c.next.order = now + (c.openN > 0 ? 1700 : F.orderMs[c.n]);
      if (c.openN > 0) c.openN--;
      forgeOrder(c, now);
    }
  },
  act(S, dim, c, p, q, d, action) {
    const bound = forgeBound(c, p.pid);
    if (action.cancel === 1 && bound) { bound.pair = null; c.ver++; return true; }
    if (action.beat === 1) return bound ? forgeBeat(S, dim, c, bound, p) : "";
    if (action.cancel === 1) return "";
    if (bound) return "박자에 맞춰 스페이스를 누르세요.";
    if (d >= 0) return "";
    const ai = coopSt(c, p, "anvil"), a = c.anvils[ai], h = q.hold[0];
    if (q.tool === "hammer") return a ? forgePair(S, dim, c, a, p) : "주괴가 놓인 모루 곁에서 F로 시작하세요.";
    const ci = coopSt(c, p, "crate");
    if (ci >= 0) {
      // A second use returns the current ingot, so any wrong choice is recoverable.
      if (h) { q.hold = []; coopEv(S, dim, 67, p.x, p.y, h.m); }
      else { q.hold = [{ m: ci }]; coopEv(S, dim, 50, p.x, p.y, ci); }
      return true;
    }
    if (!h || !a) return h ? "들고 있는 주괴를 빈 모루에 올리세요." : "손님이 주문한 주괴를 상자에서 꺼내세요.";
    if (a.order) return "이미 주괴가 놓인 모루예요.";
    const order = forgePending(c).find((e) => e.seated && S.now < e.until && e.m === h.m && !c.anvils.some((a) => a.order === e));
    if (!order) return "지금 주문받은 주괴와 달라요. 주괴 상자에서 돌려놓을 수 있어요.";
    a.order = order; a.loader = p.pid; a.progress = 0;
    q.hold = [];
    c.ver++;
    coopEv(S, dim, 60, a.x, a.y, h.m);
    return true;
  },
  row(e, at, now, ds) {
    if (e.t === 7) return forgeAnvilRow(e, at, now);
    return [...at, e.r, Math.max(0, ds(e.until)), Math.round(e.dur / 100), e.seated ? 0 : Math.max(0, ds(e.at)), e.gone,
      e.gone ? Math.max(0, ds(e.goneAt)) : 0, e.m];
  },
  lane: (S, c, p) => !!forgeBound(c, p.pid),
  sum: (c) => [c.done, c.late],
  what: (q) => (q.hold.length ? q.hold[0].m + 1 : 0),
};

// ── 보글연금공방 가마 v2 (the owner's concept; COOP_BREW, H9): the 풀무 players play the kiln's note chart with ↑→↓← to keep its
// heat in the brew's band (together on one note: 합동 풀무), the 부채 holder picks herbs in the recipe's colour order, pours
// them in, fans the heat down, calms a boil-over, bottles the potion and puts it on the 진열대 (the forge's shop and customers).
// Ents: the kiln { t: 11, H }, the cauldron { t: 12, pc, st 0 empty · 1 brewing · 2 done · 3 boiling over, at (done or boiling
// since), hotAt (over the band since), foam, was }, customers t 8 and potions on show t 10 as the forge's. A brew { r, prog (ms in
// band), inMs, outMs (out of band after it first got there), got, boils, ct: {pid: fan work}, ch: {pid: 풀무 notes} }.

const brewNote = (c, i) => { const B = COOP_BREW, L = B.chart.length; return c.beat0 + (Math.floor(i / L) * B.loop + B.chart[i % L][0]) * c.per; };
const brewDir = (i) => COOP_BREW.chart[i % COOP_BREW.chart.length][1];
function brewHeat(c, dh) { c.kiln.H = clamp(c.kiln.H + dh, 0, 100); c.ver++; }
/** A brew's share of time in its band since it first got there, less its boil-overs; its grade index (0 명약 … 3 하). */
const brewShare = (pc) => (pc.inMs + pc.outMs ? pc.inMs / (pc.inMs + pc.outMs) : 1) - COOP_BREW.boilQ * pc.boils;
const brewGrade = (pc) => COOP_BREW.grades.findIndex(([m]) => brewShare(pc) >= m);
/** Holding a 풀무 at the kiln (taken with F), or at the herb shelf mid-pick: the movement keys are notes. */
const brewLane = (S, c, p, q) => (q.bel && q.tool === "bellows" && !q.hold.length && coopSt(c, p, "kiln") >= 0) || (!!q.herb && coopSt(c, p, "herbs") >= 0);
/** A 풀무 note (d 0–3) against the player's next note on the chart, after their own offset; notes nobody plays just pass. */
function brewHit(S, dim, c, p, q, d) {
  const B = COOP_BREW, now = S.now, k = c.kiln, e = c.pot;
  q.offs = q.offs || [];
  const lat = clamp(forgeMed(q.offs), -B.latMax, B.latMax), t = now - lat;
  q.ln = q.ln || 0;
  while (brewNote(c, q.ln) < t - B.good) q.ln++;
  // past this note and nearer the next (a half-beat pair): the one before was skipped
  if (t > brewNote(c, q.ln) && Math.abs(t - brewNote(c, q.ln + 1)) < t - brewNote(c, q.ln)) q.ln++;
  const i = q.ln, dd = t - brewNote(c, i);
  let j = Math.abs(dd) <= B.perfect ? 0 : Math.abs(dd) <= B.good ? 1 : 2;
  if (dd >= -B.good) { q.ln++; if (d !== brewDir(i)) j = 2; }   // too early is a stray press: the note still waits
  if (j < 2) { q.offs.push(now - brewNote(c, i)); if (q.offs.length > 5) q.offs.shift(); }
  brewHeat(c, j < 2 ? B.heat[j] : -B.heat[2]);
  coopEv(S, dim, 70 + j, k.x, k.y, p.eid);
  if (j < 2) {
    const pc = e.pc && e.st === 1 ? e.pc : null, O = pc && B.orders[pc.r], band = O && k.H >= O.lo && k.H <= O.hi + B.over;
    forgeCr(pc ? pc.ch : c.preCh, p.pid);
    // a note in band stirs the brew on (more 풀무, quicker brews)
    if (band) pc.prog += B.stir[j];
    const on = (c.jn[i] = c.jn[i] || []);
    if (!on.includes(p.pid)) { on.push(p.pid); if (on.length >= 2) { brewHeat(c, B.joint); if (band) pc.prog += B.stir[2]; coopEv(S, dim, 73, k.x, k.y, on.length); } }
    for (const key of Object.keys(c.jn)) if (+key < i - 8) delete c.jn[key];
  }
  return true;
}
/** Herbs into the empty cauldron: a new brew, credited with the 풀무 notes played while it stood empty. */
function brewPour(S, dim, c, h) {
  const e = c.pot;
  e.pc = { r: h.r, prog: 0, inMs: 0, outMs: 0, got: false, boils: 0, ct: h.ct, ch: c.preCh };
  c.preCh = {}; e.st = 1; e.hotAt = 0; c.ver++;
  coopEv(S, dim, 77, e.x, e.y, h.r);
}
function brewBoil(S, dim, c, was) {
  const e = c.pot;
  e.was = was; e.st = 3; e.at = S.now; e.foam = COOP_BREW.foam; e.hotAt = 0; e.pc.boils++; c.ver++;
  coopEv(S, dim, 80, e.x, e.y, e.pc.r);
  coopToastAll(S, dim, "부글부글 넘침! 부채 담당은 가마솥에서 F 연타!");
}
COOP_JOB.alch = {
  init(S, dim, c) {
    const B = COOP_BREW, J = COOP[c.k], [kx, ky] = tilePx(J.st.kiln), [ox, oy] = tilePx(J.st.pot);
    c.kiln = { id: c.nid++, t: 11, x: kx, y: ky, H: B.H0 };
    c.pot = { id: c.nid++, t: 12, x: ox, y: oy, pc: null, st: 0, at: 0, hotAt: 0, foam: 0, was: 0 };
    c.ents.push(c.kiln, c.pot);
    c.per = B.per[c.n]; c.beat0 = c.runAt + B.leadMs; c.jn = {}; c.preCh = {};
    c.done = 0; c.late = 0; c.lastAt = c.runAt;
    c.next = { order: c.runAt + B.firstMs, sync: c.runAt };
    c.openN = Math.min(c.n + 1, B.open[c.n]);   // the opening customers, 1.5 s apart
    // everyone pumps but the last one in, who fans and carries (the owner's "한 사람은 옆에서")
    const qs = Object.values(c.pl);
    qs.forEach((q, i) => { q.tool = i === qs.length - 1 ? "fan" : "bellows"; });
  },
  tick(S, dim, c, now) {
    const B = COOP_BREW, dt = Math.max(0, now - c.lastAt), k = c.kiln, e = c.pot, pc = e.pc;
    c.lastAt = now;
    k.H = Math.max(0, k.H - (B.cool[c.n] * (k.H - B.amb) * dt) / 1000);
    if (pc) {
      const O = B.orders[pc.r], band = k.H >= O.lo && k.H <= O.hi;
      if (e.st === 1) {
        const was = Math.floor((3 * pc.prog) / O.hold);
        if (band) { pc.got = true; pc.prog += dt; pc.inMs += dt; } else if (pc.got) pc.outMs += dt;
        const stage = Math.floor((3 * pc.prog) / O.hold);
        if (stage > was && stage < 3) { c.ver++; coopEv(S, dim, 78, e.x, e.y, stage); }
        e.hotAt = k.H > O.hi + B.over ? e.hotAt || now : 0;
        if (pc.prog >= O.hold) { e.st = 2; e.at = now; c.ver++; coopEv(S, dim, 79, e.x, e.y, pc.r); }
        else if (e.hotAt && now - e.hotAt >= B.overMs) brewBoil(S, dim, c, 1);
      } else if (e.st === 2 && now - e.at >= B.doneMs) brewBoil(S, dim, c, 2);
      else if (e.st === 3 && now - e.at >= B.ruinMs) {
        const name = COOP[c.k].skin.orders[pc.r];
        e.pc = null; e.st = 0; c.ver++;
        coopFail(c, B.ruinPen); coopEv(S, dim, 82, e.x, e.y, pc.r);
        coopToastAll(S, dim, `[넘침] ${name}${pp(name, "이가")} 다 넘쳐 버렸어요! 점수 -${B.ruinPen}`);
      }
    }
    for (const o of [...c.ents]) if (o.t === 8) shopCustomer(S, dim, c, o, now);
    shopOpen(S, dim, c, now);
    // the kiln cools every tick: resend it twice a second (the client extrapolates the cooling)
    if (now >= c.next.sync) { c.next.sync = now + B.syncMs; c.ver++; }
  },
  act(S, dim, c, p, q, d) {
    const B = COOP_BREW, now = S.now, h = q.hold[0], si = (key) => coopSt(c, p, key), J = COOP[c.k], X = J.skin.txt, e = c.pot, fan = q.tool === "fan";
    if (q.herb && si("herbs") < 0) q.herb = null;
    if (d >= 0) {
      if (q.herb) {
        // the herb shelf: the next herb of the recipe's colour order, or the pick starts over
        const O = B.orders[q.herb.r];
        if (d !== O.herbs[q.herb.i]) { q.herb = null; coopEv(S, dim, 76, p.x, p.y); toast(p, X.herbBad); return true; }
        q.herb.i++; coopEv(S, dim, 74, p.x, p.y, d);
        if (q.herb.i >= O.herbs.length) { q.hold = [{ r: q.herb.r, st: "herbs", ct: { [p.pid]: O.herbs.length } }]; q.herb = null; c.ver++; coopEv(S, dim, 75, p.x, p.y, q.hold[0].r); }
        return true;
      }
      return brewLane(S, c, p, q) ? brewHit(S, dim, c, p, q, d) : "";
    }
    if (si("rack") >= 0) {
      if (q.hold.length) return "들고 있는 것을 먼저 내려놓으세요";
      q.tool = fan ? "bellows" : "fan"; q.bel = false; q.herb = null;
      coopEv(S, dim, 23, p.x, p.y);
      toast(p, `${COOP_TOOLS[q.tool]}${pp(COOP_TOOLS[q.tool], "을를")} 들었습니다.`);
      return true;
    }
    if (h && h.st === "potion" && si("shelf") >= 0) return forgeShelve(S, dim, c, p, q, h);
    if (si("pot") >= 0) {
      const pc = e.pc;
      if (e.st === 3) {
        if (!fan) return X.calm;
        e.foam--; brewHeat(c, -B.calmHeat); forgeCr(pc.ct, p.pid); coopEv(S, dim, 81, e.x, e.y, e.foam);
        if (e.foam <= 0) { e.st = e.was; e.at = now; }
        return true;
      }
      // done: bottle it (with herbs in hand they go straight in: potion out, the next brew on)
      if (e.st === 2 && (!h || h.st === "herbs")) {
        forgeCr(pc.ct, p.pid);
        const pot = { r: pc.r, st: "potion", gi: brewGrade(pc), q: brewShare(pc), ct: pc.ct, ch: pc.ch };
        e.pc = null; e.st = 0; q.bel = false; c.ver++;
        coopEv(S, dim, 83, e.x, e.y, pc.r);
        if (h) brewPour(S, dim, c, h);
        q.hold = [pot];
        return true;
      }
      if (e.st === 0 && h && h.st === "herbs") { brewPour(S, dim, c, h); q.hold = []; return true; }
      if (e.st === 1 && fan) { brewHeat(c, -B.trim); forgeCr(pc.ct, p.pid); coopEv(S, dim, 84, e.x, e.y); return true; }
      if (h && h.st === "herbs") return X.busy;
    }
    if (!fan && !h && si("kiln") >= 0) {
      q.bel = !q.bel;
      toast(p, q.bel ? X.keys : "풀무를 놓았어요");
      return true;
    }
    if (si("herbs") >= 0) {
      if (!fan) return X.fanOnly;
      if (!h) {
        const r = forgeKind(c), O = B.orders[r], name = J.skin.orders[r];
        q.herb = { r, i: 0 };
        coopEv(S, dim, 74, p.x, p.y, -1);
        toast(p, `${name}: ${O.herbs.map((x) => BREW_HERBS[x]).join(" → ")}`);
        return true;
      }
    }
    return fan ? X.a[!h ? 0 : h.st === "herbs" ? 1 : 2] : X.b[!h ? (q.bel ? 1 : 0) : 2];
  },
  lane: brewLane,
  /** The HUD's job summary: sold, customers who left angry. */
  sum: (c) => [c.done, c.late],
  /** What each worker carries: (kind + 1) · 5 + 0 herbs being picked · 1 a basket of herbs · 4 a potion. */
  what: (q) => [...(q.herb ? [(q.herb.r + 1) * 5] : []), ...q.hold.map((h) => (h.r + 1) * 5 + (h.st === "herbs" ? 1 : 4))],
  /** The team row's 6th field: 1 on the 풀무 · 10 + herbs picked so far · else 0. */
  mode: (q) => (q.bel ? 1 : q.herb ? 10 + q.herb.i : 0),
};
/** Herb names by colour index (↑ → ↓ ←). */
const BREW_HERBS = ["붉은 꽃잎(↑)", "푸른 이끼(→)", "황금 뿌리(↓)", "보라 버섯(←)"];

// ── 올빼미 도서관 대출·반납. Row 13 is a patron: phase 0 walks in, 1 waits, and 2 walks out.

const libTitle = (book) => `『${COOP_LIB.titles[book.g][book.ti]}』`;
const libWaiting = (c, now) => c.ents.filter((guest) => guest.phase === 1 && now < guest.until);
function libReserve(c, guest, worker) {
  guest.worker = worker;
  c.ver++;
}
function libPlaceLine(c) {
  const [x, y] = LIBH.queue;
  c.ents.filter((guest) => guest.phase < 2).forEach((guest, i) => { [guest.x, guest.y] = tilePx([x, y + i]); });
  c.ver++;
}
function libDepart(S, dim, c, guest, ok) {
  const L = COOP_LIB;
  guest.phase = 2;
  guest.phaseAt = S.now + L.departMs;
  guest.phaseMs = L.departMs;
  guest.leftOk = ok;
  guest.worker = "";
  libPlaceLine(c);
  coopEv(S, dim, ok ? 93 : 91, guest.x, guest.y, guest.g);
  if (!ok) { c.angry++; coopFail(c, L.angryPen); }
}
function libScore(S, dim, c, p, x, y, points) {
  c.done++;
  coopEv(S, dim, 94, x, y, coopGood(S, c, points, { [p.pid]: 1 }));
}
function libRow(guest, at, ds) {
  return [...at, guest.kind, guest.g, guest.ti, guest.phase === 1 ? Math.max(0, ds(guest.until)) : 0, COOP_LIB.patience / 100,
    guest.phase, guest.phase === 1 ? 0 : Math.max(0, ds(guest.phaseAt)), Math.ceil(guest.phaseMs / 100), guest.leftOk ? 1 : 0, guest.worker ? 1 : 0];
}
COOP_JOB.lib = {
  init(S, dim, c) {
    c.done = 0; c.angry = 0; c.bookKind = 0; c.returns = [];
    c.openN = c.n;
    c.next.arrive = c.runAt + COOP_LIB.firstMs;
  },
  tick(S, dim, c, now) {
    const L = COOP_LIB;
    // Release a loan or recover a return if its worker leaves or disconnects.
    for (const [pid, q] of Object.entries(c.pl)) {
      const h = q.hold[0];
      if (!h || coopWorker(S, pid)?.map === dim.id) continue;
      q.hold = [];
      if (h.kind === 1) c.returns.push(h);
      else {
        const e = c.ents.find((guest) => guest.id === h.id);
        if (e?.worker === pid) libReserve(c, e, "");
      }
    }
    for (const guest of [...c.ents]) {
      if (guest.phase === 0 && now >= guest.phaseAt) { guest.phase = 1; c.ver++; }
      else if (guest.phase === 1 && now >= guest.until) libDepart(S, dim, c, guest, false);
      else if (guest.phase === 2 && now >= guest.phaseAt) { c.ents.splice(c.ents.indexOf(guest), 1); c.ver++; }
    }
    if (now < c.next.arrive) return;
    const pace = c.state === "fever" ? L.feverK : 1;
    c.next.arrive = now + (c.openN > 0 ? L.rushMs : L.arriveMs[c.n] / pace);
    if (c.openN > 0) c.openN--;
    const n = c.ents.filter((guest) => guest.phase < 2).length;
    if (n >= L.queueCap[c.n]) return;
    const g = ri(c.box, 0, L.genres.length - 1), ti = ri(c.box, 0, L.titles[g].length - 1);
    const phaseMs = 300 * (LIBH.door[1] - LIBH.queue[1] - n), phaseAt = now + phaseMs;
    c.ents.push({ id: c.nid++, t: 13, g, ti, kind: c.bookKind, phase: 0, phaseAt, phaseMs, until: phaseAt + L.patience, worker: "" });
    c.bookKind = 1 - c.bookKind;
    libPlaceLine(c);
    coopEv(S, dim, 90, ...tilePx(LIBH.door), g);
  },
  act(S, dim, c, p, q) {
    const L = COOP_LIB, desk = coopSt(c, p, "desk") >= 0, seat = coopSt(c, p, "shelf");
    const shelf = seat < 0 ? -1 : Math.floor(seat / 6);
    const waiting = libWaiting(c, S.now), h = q.hold[0];
    if (desk) {
      if (h?.kind === 1) return `${L.genres[h.g]} 책장에 꽂으세요.`;
      if (h) {
        const guest = waiting.find((e) => e.id === h.id && e.kind === 0 && e.worker === p.pid);
        if (!guest) return "이 손님은 자리를 떠났어요. 책을 꺼낸 장르 책장에 돌려놓으세요.";
        q.hold = [];
        libDepart(S, dim, c, guest, true);
        libScore(S, dim, c, p, guest.x, guest.y, L.loanPts);
        toast(p, "대출을 마쳤어요. 손님이 고맙다고 인사했어요.");
        return true;
      }
      if (c.returns.length) { q.hold = [c.returns.shift()]; return true; }
      const guest = waiting.find((e) => e.kind === 1);
      if (!guest) return "대출 도서는 손님이 요청한 장르의 책장에서 꺼내세요.";
      q.hold = [{ kind: 1, id: guest.id, g: guest.g, ti: guest.ti }];
      libDepart(S, dim, c, guest, true);
      toast(p, `${libTitle(guest)} 반납. ${L.genres[guest.g]} 책장으로 가져가세요.`);
      return true;
    }
    if (shelf < 0) return "안내데스크나 책장 가까이에서 작업하세요.";
    if (h) {
      if (h.g !== shelf) {
        coopEv(S, dim, 95, p.x, p.y, shelf);
        return `이 책은 ${L.genres[h.g]} 책장에 꽂아야 해요.`;
      }
      q.hold = [];
      if (h.kind === 1) libScore(S, dim, c, p, p.x, p.y, L.returnPts);
      else {
        const guest = waiting.find((e) => e.id === h.id);
        if (guest?.worker === p.pid) libReserve(c, guest, "");
        toast(p, "책을 원래 책장에 돌려놓았어요.");
      }
      return true;
    }
    const guest = waiting.find((e) => e.kind === 0 && e.g === shelf && !e.worker);
    if (!guest) return "아직 이 장르를 빌리려는 손님이 없거나 동료가 가져갔어요.";
    libReserve(c, guest, p.pid);
    q.hold = [{ kind: 0, id: guest.id, g: guest.g, ti: guest.ti }];
    coopEv(S, dim, 97, p.x, p.y, guest.g);
    toast(p, `${libTitle(guest)}을 안내데스크에 가져가세요.`);
    return true;
  },
  sum: (c) => [c.done, c.angry],
  what: (q) => q.hold.length ? [q.hold[0].g, q.hold[0].ti, q.hold[0].kind, q.hold[0].id] : [],
};

// ── actions (validated in 70-validate.js, applied in 75-apply.js)


function coopValidate(S, p, a) {
  const c = coopOf(S, p);
  switch (a.t) {
    case "coop_start": {
      if (typeof a.k !== "string" || !Object.hasOwn(COOP, a.k)) return bad("아직 열리지 않은 아르바이트입니다");
      if (!coopNpc(S, p, a.k)) return bad(`${npcName(COOP[a.k].npc)}에게 다가가 말을 거세요`);
      const party = S.parties[p.party];
      if (party && party.m[0] !== p.pid) return bad("파티장만 근무를 시작할 수 있습니다");
      if (party && party.coop && dimAt(S, party.coop)) return bad("파티가 이미 근무 중입니다");
      if (party && party.rc) return bad("레이드던전 입장 준비 중입니다");
      // the owner's rule: a co-op job is the one you do with a party of 2–4, unlike the solo 알바 board
      if (coopCrew(S, p).length < 2) return bad(party?.m.length > 1 ? "파티원과 함께 이 방에 와 주세요." : "파티원과 함께 오거나 짝꿍을 불러 주세요.");
      if (coopLive(S) >= COOP_T.max) return bad(`지금은 일손이 꽉 찼습니다 (${COOP_T.max}/${COOP_T.max})`);
      if (Object.keys(S.dims).length >= DIM.max) return bad("지금은 빈 자리가 없습니다. 잠시 뒤 다시 오세요");
      return OK;
    }
    case "coop_act":
      if (!c || !c.pl[p.pid]) return bad("근무 중이 아닙니다");
      if (a.d !== undefined && !(Number.isInteger(a.d) && a.d >= 0 && a.d <= 3)) return bad("알 수 없는 행동");
      if (c.state === "brief") return bad("곧 근무가 시작됩니다!");
      if (c.state === "end") return bad("근무가 끝났습니다");
      if (c.k === "diner" && (a.i !== undefined || a.r !== undefined)) {
        const error = dinerCookCheck(c, p, a.i, a.r);
        if (error) return bad(error);
      }
      if (a.beat !== undefined || a.cancel !== undefined) {
        if (c.k !== "forge" || a.d !== undefined || !((a.beat === 1 && a.cancel === undefined) || (a.cancel === 1 && a.beat === undefined))) return bad("알 수 없는 단조 행동입니다.");
        if (!forgeBound(c, p.pid)) return bad("함께 단조를 시작한 뒤 사용할 수 있어요.");
      }
      return OK;
    case "coop_leave":
      return c ? OK : bad("근무 중이 아닙니다");
  }
  return bad("알 수 없는 행동");
}
function coopApply(S, p, a) {
  if (a.t === "coop_start") { coopStart(S, p, a.k); return; }
  const c = coopOf(S, p);
  if (a.t === "coop_leave") {
    toast(p, c.state === "end" ? "수고하셨습니다!" : "근무를 포기했습니다");
    const dim = dimAt(S, p.map);
    if (buddyShift(dim, p)) coopClose(S, dim);
    else coopHome(S, p, c);
    return;
  }
  const q = c.pl[p.pid], job = COOP_JOB[c.k];
  // a rhythm lane's notes come faster than the work key's 250 ms
  if (S.now - q.actAt < (job.lane && job.lane(S, c, p, q) ? COOP_FORGE.laneMs : COOP_T.actMs)) return;
  q.actAt = S.now;
  const r = job.act(S, dimAt(S, p.map), c, p, q, a.d === undefined ? -1 : a.d, a);
  if (r === true) q.idleAt = q.workAt = S.now;
  else if (r && S.now >= q.hintAt) { q.hintAt = S.now + 1200; toast(p, r); }
}

// ── the wire (C.10, compact)

/**
 * Inside a shift: `cj` [job index, state 0 brief · 1 run · 2 fever · 3 end, seconds left, score, combo, mult ×10, grade 0–4,
 * next cut-off (0 at S), job sum (apt: dirt units left, the opening dirt (the 청소율 is the score, ‰); `cd` the dirt itself, aptWire · diner: served, missed · forge and alch: sold, angry customers), [[eid, tool (index in the job's two), held,
 * zzz, what (diner: dish·3 + stage per thing held; forge: (kind + 1)·5 + state; alch: (kind + 1)·5 + 0 picking · 1 herbs · 4 potion; else 0), alch only: mode (1 on the 풀무 ·
 * 10 + herbs picked)]…]] when it changes; `C` when the entities change: [id, type
 * 0 pile · 1 bundle · 2 sofa, x, y, hp], diner [id, 3 order, x, y, dish, ds left, ds patience] · [id, 4 pot, x, y, dish,
 * ds to done, ds to burnt] · [id, 5 plated dish on the pass, x, y, dish] · [id, 9 plate, x, y, ds still eating (0 dirty), washes left, at the sink 0/1], forge rows 6 furnace · 7 anvil · 8 customer · 10 a piece on the 진열대 (forgeRow),
 * alch [id, 11 kiln, x, y, heat ×10, ms to the chart's beat 0, beat ms, cooling ‰/s] · [id, 12 cauldron, x, y, recipe (−1), state 0 empty · 1 brewing · 2 done · 3 boiling over,
 * progress %, grade so far (−1), foam left, ds to the next trouble (0 none), the recipe the next herbs make]; `cr` the report card once: [grade, score, channel best,
 * [[name, pts, tool, eligible]…], [C B A S cut-offs]]. `cj: 0` once on the way out.
 */
function coopView(S, p, out) {
  const dim = inDim(p) ? dimAt(S, p.map) : null, c = dim && dim.coop;
  if (c) {
    const now = S.now, g = coopGrade(c), J = COOP[c.k];
    const secs = Math.max(0, Math.ceil(((c.state === "brief" ? c.runAt : c.state === "end" ? c.doneAt : c.endAt) - now) / 1000));
    const team = coopInside(S, dim).map((o) => { const q = c.pl[o.pid]; return [o.eid, J.tools.indexOf(q.tool), q.hold.length, now - q.idleAt >= COOP_T.zzzMs ? 1 : 0, COOP_JOB[c.k].what ? COOP_JOB[c.k].what(q, now) : 0, ...(COOP_JOB[c.k].mode ? [COOP_JOB[c.k].mode(q)] : [])]; });
    const v = [COOP_KINDS.indexOf(c.k), COOP_STATE.indexOf(c.state), secs, Math.round(c.score), c.combo, Math.round(coopMult(c) * 10), g, g < 4 ? coopCut(c, g) : 0, ...COOP_JOB[c.k].sum(c), team];
    if (c.k === "lib") v.push(c.returns.length);
    const key = JSON.stringify(v);
    if (key !== p.cjKey || p.sendMap) { out.cj = v; p.cjKey = key; }
    if (p.cVer !== c.ver || p.sendMap) { out.C = c.ents.map(coopRow(now, c)); p.cVer = c.ver; }
  } else if (p.cjKey) { out.cj = 0; out.C = []; p.cjKey = null; p.cVer = -1; }
  if (p.coopRes) { out.cr = p.coopRes; p.coopRes = null; }
}
/** One entity on the wire; the diner’s carry a dish and, for orders and pots, deciseconds left (the client counts down). */
const coopRow = (now, c) => (e) => {
  const at = [e.id, e.t, Math.round(e.x), Math.round(e.y)], ds = (t) => Math.ceil((t - now) / 100);
  if (c.k === "apt") return [...at, e.variant];
  if (c.k === "diner") return dinerRow(e, at, now, ds);
  if (c.k === "forge") return COOP_JOB.forge.row(e, at, now, ds);
  if (c.k === "lib") return libRow(e, at, ds);
  if (e.t === 11) return [...at, Math.round(e.H * 10), Math.round(c.beat0 - now), c.per, Math.round(COOP_BREW.cool[c.n] * 1000)];
  if (e.t === 12) {
    const B = COOP_BREW, pc = e.pc, O = pc && B.orders[pc.r];
    const due = e.st === 3 ? e.at + B.ruinMs : e.st === 2 ? e.at + B.doneMs : e.hotAt ? e.hotAt + B.overMs : 0;
    return [...at, pc ? pc.r : -1, e.st, pc ? Math.min(100, Math.floor((100 * pc.prog) / O.hold)) : 0, pc ? brewGrade(pc) : -1, e.st === 3 ? e.foam : 0, due ? Math.max(0, ds(due)) : 0, forgeKind(c)];
  }
  return forgeRow(e, at, now, ds);
};
/** `self.coop`: the jobs done today (their day's pay taken). */
const coopSelf = (p) => (p.ch.coopDay === dayOf(p.S.now) ? p.ch.coopDone : []);
/** defs().coop: { jobs: { k: [name, minutes, tools, par, npc, lobby, hint, stations, skin {orders, grades} names or 0] }, kinds, cuts, gradeK (pay share C B A S), parN, tools, binCap, near, dishes, cook (ms), trayCap, washN, orders (forge v2) [name, notes, pts, beat ms, pattern [[beat, note 0 blow · 1 answer · 2–5 flip ↑→↓←]…]], door (the forge customers' door, px), forge [band lo, hi, scorch, decay/s], grades (forge piece grade names), metals (forge ingots) [name, colour word, heat ×, tempo ×, window ×, price ×], brew (alch) { orders [name, lo, hi, hold ms, herbs, pts], chart [[beat, dir]…], loop, amb, herbs (names), foam } }. */
function coopDefs() {
  const J = (k) => COOP[k], skin = (k) => (J(k).skin ? { orders: J(k).skin.orders, grades: J(k).skin.grades } : 0);
  return { jobs: Object.fromEntries(Object.keys(COOP).map((k) => [k, [J(k).name, J(k).mins, J(k).tools, J(k).par, J(k).npc, J(k).lobby, J(k).hint, J(k).st, skin(k)]])),
    kinds: COOP_KINDS, cuts: COOP_T.cuts, gradeK: COOP_T.gradeK, parN: COOP_T.parN, tools: COOP_TOOLS, binCap: COOP_APT.binCap, near: COOP_T.near, stationReach: COOP_T.station + 8,
    dishes: COOP_DINER.dishes.map((d) => d.name), cook: COOP_DINER.dishes.map((d) => d.cook),
    orders: COOP_FORGE.orders.map((o, i) => [COOP.forge.skin.orders[i], o.beats, o.pts, o.per]), door: tilePx(COOP.forge.door), grades: COOP.forge.skin.grades,
    metals: COOP_FORGE.metals.map((o) => [o.name, o.col]),
    brew: { orders: COOP_BREW.orders.map((o, i) => [COOP.alch.skin.orders[i], o.lo, o.hi, o.hold, o.herbs, o.pts]), chart: COOP_BREW.chart, loop: COOP_BREW.loop, amb: COOP_BREW.amb, herbs: BREW_HERBS, foam: COOP_BREW.foam },
    lib: { genres: COOP_LIB.genres, cols: COOP_LIB.cols, titles: COOP_LIB.titles, carry: COOP_LIB.carry, shelves: LIBH.shelves, door: tilePx(LIBH.door) } };
}
