// ───────────────────────────── 협동 아르바이트: the shared engine + 동동아파트 청소 · 쥬쥬식당 서빙 · 캉캉대장간 단조 (docs/design/life-and-coop.md C) ─────────────────────────────
// A shift is a runtime instance "dim:<n>" (registerDim / closeDim, like 67-trophies.js's story arenas) that carries
// `dim.coop`; 64-dim.js leaves it alone (it has no `prog`). Everything inside is instance state — piles, bundles,
// the sofa, what a bin holds — so nothing can be duped or traded out. Numbers: COOP, COOP_T, COOP_APT (12-life-tables.js).
//
// dim.coop = { k, state: brief|run|fever|end, t0, runAt, endAt, doneAt, n (party size at the start), box (seeded rnd),
//   score, combo, comboAt, ents: [{ id, t: 0 pile · 1 bundle · 2 sofa, x, y, hp, due, cred: {pid: n}, lift }], nid, ver,
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
const coopCut = (c, g) => c.k === "pipe" ? COOP.pipe.gradeSec[g] : Math.round(COOP[c.k].par * (COOP[c.k].parN || COOP_T.parN)[c.n] * COOP_T.cuts[g]);
/** 0 below C, 1 C · 2 B · 3 A · 4 S. */
function coopGrade(c) { if (c.k === "pipe") return pipeGrade(c); let g = 0; while (g < 4 && c.score >= coopCut(c, g)) g++; return g; }
const coopMult = (c) => c.k === "pipe" ? 1 : (1 + 0.1 * Math.min(c.combo, 10)) * (c.state === "fever" ? 1.5 : 1);
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
const coopCrew = (S, p) => { const party = S.parties[p.party]; return (party ? party.m.map((pid) => S.players[pid]) : [p]).filter((o) => o && o.map === p.map && !o.dead).slice(0, 4); };
/** The leader starts a shift: everyone of the party in the lobby goes in (2–4: co-op jobs are party-only). */
function coopStart(S, p, k) {
  const J = COOP[k], party = S.parties[p.party], crew = coopCrew(S, p);
  S.dimN = (S.dimN | 0) + 1;
  const id = "dim:" + S.dimN, seed = Math.imul(S.seed ^ S.nextId++, 2654435761) | 0;
  const map = fromEditor(J.tpl, id);
  finalize(map);
  const t0 = S.now, runAt = t0 + COOP_T.briefMs, endAt = runAt + J.mins * 60000;
  const dim = registerDim(S, { id, map, party: p.party || 0, seed, lv: 1, theme: "interior", expire: endAt + COOP_T.endMs + 60000 });
  const lob = mapOf(J.lobby);
  const c = dim.coop = { k, state: "brief", t0, runAt, endAt, doneAt: 0, n: crew.length, box: { seed }, score: 0, combo: 0, comboAt: -1e9,
    ents: [], nid: 1, ver: 1, pl: {}, home: [J.lobby, ...tilePx(lob.entry)], next: {}, compAt: 0 };
  if (party) party.coop = id;
  crew.forEach((o, i) => {
    const [x, y] = tilePx(J.start[i]);
    c.pl[o.pid] = { name: o.ch.name, tool: J.tools[i % 2], hold: [], pts: 0, idleAt: t0, x, y, actAt: 0, hintAt: 0, ok: false };
    changeMap(S, o, id, x, y);
    o.spdBuff = Math.max(o.spdBuff || 0, endAt);
    toast(o, `[${J.name}] ${crew.length}명 근무 시작! ${J.hint}${k === "pipe" ? "" : " (공격 키 / F)"}`);
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
    const q = c.pl[pid], o = S.players[pid];
    q.ok = !!(o && o.map === dim.id && (c.k === "pipe" ? pipeEligible(c, pid) : S.now - q.idleAt < COOP_T.idleMs && q.pts >= COOP_T.lazy * avg));
    rows.push([q.name, Math.round(q.pts), COOP[c.k].tools.indexOf(q.tool), q.ok ? 1 : 0]);
  }
  S.coopBest = S.coopBest || {};
  S.coopBest[c.k] = Math.max(S.coopBest[c.k] || 0, Math.round(c.score));
  for (const o of inside) {
    const q = c.pl[o.pid];
    let reward = 0;
    if (q?.ok || coopSelf(o).includes(c.k)) reward = coopPay(S, o, c, q?.ok ? g : 0);
    else if (c.k === "pipe") toast(o, g ? "완성된 배관에 참여해야 보수를 받을 수 있어요." : "시간이 끝났어요. 급수구에서 배수구까지 다시 이어 보세요.");
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
    toast(p, c.k === "pipe" ? "시간이 끝났어요. 배관 연결을 다시 도전할 수 있어요." : "C등급에 도달하면 보수를 받을 수 있어요. 오늘 다시 도전할 수 있어요.");
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
    const inside = dimInside(S, id);
    if (!inside.length) {
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
      if (c.k === "pipe") coopToastAll(S, dim, "물이 차오릅니다! 배관을 이을 시간이 1분 남았어요.");
      else { coopEv(S, dim, 14, 0, 0); coopToastAll(S, dim, "피버 타임! 남은 1분, 점수 ×1.5"); }
    }
    if (c.state === "run" || c.state === "fever") {
      if (now >= c.endAt) coopFinish(S, dim, inside);
      else COOP_JOB[c.k].tick?.(S, dim, c, now);
    } else if (c.state === "end" && now >= c.doneAt) coopClose(S, dim);
  }
}

// ── 동동아파트 청소 (C.4)

const aptStation = (c, p, key) => { const [x, y] = tilePx(COOP[c.k].st[key]); return dist(p.x, p.y, x, y) <= COOP_T.station + 8; };
const aptMess = (c) => c.ents.reduce((s, e) => s + (e.t === 0 ? 2 : e.t === 1 ? 1 : 3), 0);
const aptCap = (c) => COOP_APT.messCap[0] + COOP_APT.messCap[1] * c.n;
const aptFree = (m, c, tx, ty) => tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && m.reach[ty * m.w + tx] && !c.ents.some((e) => Math.abs(e.x - (tx * T + 8)) < 8 && Math.abs(e.y - (ty * T + 10)) < 8);
function aptAdd(c, t, tx, ty, hp, cred = {}) {
  const e = { id: c.nid++, t, x: tx * T + 8, y: ty * T + 10, hp, due: 0, cred, lift: null };
  c.ents.push(e); c.ver++;
  return e;
}
/** A free tile near (tx, ty) within `r` tiles, nearest first, or null. */
function aptNear(m, c, tx, ty, r) {
  for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) === d && aptFree(m, c, tx + dx, ty + dy)) return [tx + dx, ty + dy];
  }
  return null;
}
/** A new mess in the flat with the least mess (seeded tie-break), on a free tile. */
function aptSpawn(S, dim, c, t) {
  const J = COOP[c.k], m = dim.map, now = S.now;
  const load = J.rooms.map(([x0, y0, x1, y1], i) => [c.ents.filter((e) => e.x >= x0 * T && e.x < (x1 + 1) * T && e.y >= y0 * T && e.y < (y1 + 1) * T).length + rnd(c.box) * 0.5, i]);
  load.sort((a, b) => a[0] - b[0]);
  const [x0, y0, x1, y1] = J.rooms[load[0][1]];
  for (let i = 0; i < 30; i++) {
    const tx = ri(c.box, x0, x1), ty = ri(c.box, y0, y1);
    if (!aptFree(m, c, tx, ty)) continue;
    const e = aptAdd(c, t, tx, ty, t === 2 ? COOP_APT.sofaHp : COOP_APT.pileHp);
    e.due = now + COOP_APT.spreadMs;
    return e;
  }
  return null;
}
// ── 쥬쥬식당 서빙 (C.5, v1)

/** Which of a job's stations `key` p stands by (its index; 0 for a single tile), or -1. */
function coopSt(c, p, key) {
  const v = COOP[c.k].st[key], list = Array.isArray(v[0]) ? v : [v];
  return list.findIndex((t) => { const [x, y] = tilePx(t); return dist(p.x, p.y, x, y) <= COOP_T.station + 8; });
}
/** A dish in a cook's hands: 0 ready to plate · 1 to chop · 2 to cook. */
const dinerNeed = (h) => (h.chop > 0 ? 1 : COOP_DINER.dishes[h.r].cook && !h.cooked ? 2 : 0);
/** Customers sit at a free table (seeded) and order a dish the shift has unlocked. */
function dinerOrder(S, dim, c, now) {
  const R = COOP_DINER, J = COOP[c.k];
  const free = J.tables.map((t, i) => i).filter((i) => now >= c.tbl[i] && !c.ents.some((e) => (e.t === 3 || e.t === 9) && e.ti === i));
  if (!free.length) return;
  const ti = free[ri(c.box, 0, free.length - 1)], menu = R.dishes.map((d, i) => i).filter((i) => now - c.runAt >= R.dishes[i].at);
  const r = menu[ri(c.box, 0, menu.length - 1)], pat = Math.round(R.patience[c.n] * (c.state === "fever" ? R.feverK : 1));
  const [x, y] = tilePx(J.tables[ti]);
  c.ents.push({ id: c.nid++, t: 3, x, y, r, ti, until: now + pat, pat });
  c.ver++;
  coopEv(S, dim, 40, x, y, r);
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
/** The kind a new piece on an anvil becomes: the most urgent open order (a waiting customer) no piece is already for (else the most urgent, else 편자). */
function forgeKind(c) {
  const ords = c.ents.filter((e) => e.t === 8 && !e.gone).sort((a, b) => a.until - b.until), busy = forgePieces(c).filter((h) => h.r >= 0).map((h) => h.r);
  for (const o of ords) { const i = busy.indexOf(o.r); if (i < 0) return o.r; busy.splice(i, 1); }
  return ords.length ? ords[0].r : 0;
}
/**
 * A forge entity on the wire: furnace [.., T, heat per slot (−1 empty; 100 hot)] · anvil [.., state 0 empty · 1 hot ·
 * 2 cooled · 3 shaped, kind, strikes, ms to the next beat, beat ms] · order [.., kind, ds left, ds total].
 */
function forgeRow(e, at, now, ds) {
  if (e.t === 6) return [...at, Math.round(e.T), ...e.bars.map((b) => (b ? Math.floor(b.heat) : -1))];
  // forge v2: a customer [.., ds to arrive, 0 waiting · 1 bought · 2 angry, ds to gone] · a piece on the 진열대 [id, 10, x, y, kind, grade]
  if (e.t === 8) return e.spot === undefined ? [...at, e.r, ds(e.until), Math.round(e.dur / 100)] : [...at, e.r, ds(e.until), Math.round(e.dur / 100), Math.max(0, ds(e.at)), e.gone, e.gone ? Math.max(0, ds(e.goneAt)) : 0];
  if (e.t === 10) return [...at, e.pc.r, shopGrade(e.pc)];
  const pc = e.pc, hot = pc && pc.st === "bar" && pc.hot > now;
  const next = hot ? e.beat0 + Math.max(0, Math.ceil((now - e.beat0) / e.per)) * e.per - now : 0;
  const row = [...at, !pc ? 0 : pc.st !== "bar" ? 3 : hot ? 1 : 2, pc ? pc.r : -1, pc ? pc.n : 0, next, e.per];
  // forge v2 anvils: [.., ms from now to the pattern's beat 0, ms of heat left] (the notes are in defs: orders[kind][4])
  return e.v2 ? [...row, hot ? Math.round(e.beat0 - now) : 0, hot ? Math.round(pc.hot - now) : 0] : row;
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
      const A = COOP_APT;
      c.next = { pile: c.runAt + A.pileMs[c.n], sofa: c.runAt + A.sofaMs / COOP_T.parN[c.n] };
      // the opening mess, more with each worker; staggered so it doesn't all spread at once
      for (let i = 0; i < A.open[0] + A.open[1] * c.n; i++) { const e = aptSpawn(S, dim, c, 0); if (e) e.due = c.runAt + A.spreadMs + i * 1500; }
    },
    tick(S, dim, c, now) {
      const A = COOP_APT, k = COOP_T.parN[c.n], piles = c.ents.filter((e) => e.t === 0), pileCap = A.pileCap[0] + A.pileCap[1] * c.n;
      if (now >= c.next.pile) { c.next.pile = now + A.pileMs[c.n]; if (piles.length < pileCap) aptSpawn(S, dim, c, 0); }
      // the sofa needs two people: it only comes to a shift that started with two or more
      if (c.n >= 2 && now >= c.next.sofa) { c.next.sofa = now + A.sofaMs / k; if (!c.ents.some((e) => e.t === 2)) { const e = aptSpawn(S, dim, c, 2); if (e) coopToastAll(S, dim, "낡은 소파가 나왔어요! 두 명이 함께 들어야 해요."); } }
      // a pile left alone spreads
      for (const e of piles) {
        if (now < e.due) continue;
        e.due = now + A.spreadMs;
        if (c.ents.filter((q) => q.t === 0).length >= pileCap) continue;
        const at = aptNear(dim.map, c, Math.floor(e.x / T), Math.floor(e.y / T), 2);
        if (at) { const n = aptAdd(c, 0, at[0], at[1], A.pileHp); n.due = now + A.spreadMs; coopEv(S, dim, 18, n.x, n.y); }
      }
      // the mess meter: over the cap, a complaint every 10 s
      if (aptMess(c) > aptCap(c)) {
        if (!c.compAt) c.compAt = now + A.complainMs;
        else if (now >= c.compAt) { c.compAt = now + A.complainMs; coopFail(c, A.complainPen); coopEv(S, dim, 15, 0, 0); coopToastAll(S, dim, `[민원] 동동: 너무 지저분해요! 점수 -${A.complainPen}`); }
      } else c.compAt = 0;
    },
    /** One context action: true when something happened, else the quiet reason. */
    act(S, dim, c, p, q) {
      const A = COOP_APT, now = S.now, R = COOP_T.reach;
      const near = (t) => c.ents.filter((e) => e.t === t && dist(p.x, p.y, e.x, e.y) <= R + (t === 2 ? 8 : 0)).sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y) || a.id - b.id)[0];
      // the bin: chutes first
      if (q.tool === "bin" && q.hold.length) {
        const rec = aptStation(c, p, "recycle");
        if (rec || aptStation(c, p, "burn")) {
          const n = q.hold.length, base = n * A.bundlePts * (1 + 0.1 * (n - 1)) * (rec ? A.recycleK : 1);
          const cred = { [p.pid]: A.holdK * n };
          for (const b of q.hold) { const w = Object.values(b).reduce((s, v) => s + v, 0) || 1; for (const pid of Object.keys(b)) cred[pid] = (cred[pid] || 0) + ((1 - A.holdK) * b[pid]) / w; }
          q.hold = [];
          const pts = coopGood(S, c, base, cred);
          coopEv(S, dim, rec ? 22 : 5, p.x, p.y, pts);
          return true;
        }
      }
      // the sofa: two people, any tools, within 1.5 s of each other
      const sofa = near(2);
      if (sofa) {
        if (sofa.lift && sofa.lift.pid !== p.pid && now - sofa.lift.at <= A.pairMs) {
          const other = sofa.lift.pid;
          sofa.lift = null; sofa.hp--;
          sofa.cred[p.pid] = (sofa.cred[p.pid] || 0) + 1; sofa.cred[other] = (sofa.cred[other] || 0) + 1;
          coopEv(S, dim, 19, sofa.x, sofa.y, sofa.hp);
          if (sofa.hp <= 0) {
            c.ents.splice(c.ents.indexOf(sofa), 1);
            for (let i = 0; i < A.sofaBundles; i++) { const at = aptNear(dim.map, c, Math.floor(sofa.x / T), Math.floor(sofa.y / T), 3); if (at) aptAdd(c, 1, at[0], at[1], 1, { ...sofa.cred }); }
          }
          c.ver++;
          return true;
        }
        sofa.lift = { pid: p.pid, at: now };
        return "혼자서는 못 들어요 — 한 명 더 소파 곁에서 함께 누르세요!";
      }
      if (q.tool === "broom") {
        const pile = near(0);
        if (pile) {
          pile.hp--; pile.due = now + A.spreadMs;
          pile.cred[p.pid] = (pile.cred[p.pid] || 0) + 1;
          if (pile.hp <= 0) { pile.t = 1; pile.hp = 1; coopEv(S, dim, 20, pile.x, pile.y); }
          coopEv(S, dim, 4, pile.x, pile.y);
          c.ver++;
          return true;
        }
      } else {
        const b = near(1);
        if (b) {
          if (q.hold.length >= A.binCap) return "쓰레기통이 꽉 찼어요 — 소각로나 재활용함에 비우세요!";
          c.ents.splice(c.ents.indexOf(b), 1); c.ver++;
          q.hold.push(b.cred);
          coopEv(S, dim, 6, b.x, b.y, q.hold.length);
          return true;
        }
      }
      // the rack: swap tools (hands empty). shortcut: no per-tool stock on the rack (C.3's ceil(n/2)), add it if tools get fought over
      if (aptStation(c, p, "rack")) {
        if (q.hold.length) return "들고 있는 것을 먼저 비우세요";
        q.tool = q.tool === "broom" ? "bin" : "broom";
        coopEv(S, dim, 23, p.x, p.y);
        toast(p, `${COOP_TOOLS[q.tool]}${pp(COOP_TOOLS[q.tool], "을를")} 들었습니다.`);
        return true;
      }
      if (q.tool === "broom" && near(1)) return "빗자루로는 쓰레기를 치울 수 없어요 — 쓰레기통 담당에게!";
      if (q.tool === "bin" && near(0)) return "쓰레기통으로는 쓸 수 없어요 — 빗자루 담당에게!";
      if (q.tool === "bin" && q.hold.length) return "소각로(서쪽)나 재활용함(동쪽, ×1.5)에 비우세요";
      return "주변에 치울 것이 없어요";
    },
    /** The HUD's job summary: mess, its cap. */
    sum: (c) => [aptMess(c), aptCap(c)],
  },
  diner: {
    init(S, dim, c) {
      const R = COOP_DINER;
      c.tbl = COOP[c.k].tables.map(() => 0);   // a table is free again at this time (after the customers eat)
      c.served = 0; c.miss = 0;
      c.next = { order: c.runAt + R.firstMs };
      c.openN = c.n;                           // the opening rush: n orders as the doors open
    },
    tick(S, dim, c, now) {
      const R = COOP_DINER, J = COOP[c.k];
      if (now >= c.next.order) {
        const rush = c.openN > 0;
        c.next.order = now + (rush ? 1500 : R.orderMs[c.n]);
        if (rush) c.openN--;
        if (c.ents.filter((e) => e.t === 3).length < R.seats[c.n]) dinerOrder(S, dim, c, now);
      }
      for (const e of [...c.ents]) {
        if (e.t === 3 && now >= e.until) {
          // patience ran out: they leave angry
          c.ents.splice(c.ents.indexOf(e), 1); c.ver++; c.miss++;
          c.tbl[e.ti] = now;
          coopFail(c, R.angryPen); coopEv(S, dim, 32, e.x, e.y);
          coopToastAll(S, dim, `[화난 손님] ${R.dishes[e.r].name}${pp(R.dishes[e.r].name, "을를")} 못 받고 떠났어요! 점수 -${R.angryPen}`);
        } else if (e.t === 4 && now >= e.burnAt) {
          c.ents.splice(c.ents.indexOf(e), 1); c.ver++;
          coopFail(c, R.burnPen); coopEv(S, dim, 33, e.x, e.y);
          coopToastAll(S, dim, `[탔어요!] ${R.dishes[e.r].name}${pp(R.dishes[e.r].name, "이가")} 새까맣게 탔어요. 점수 -${R.burnPen}`);
        }
      }
    },
    act(S, dim, c, p, q) {
      const R = COOP_DINER, D = R.dishes, now = S.now, J = COOP[c.k];
      const h = q.hold[0], si = (key) => coopSt(c, p, key);
      if (q.tool === "pan") {
        // the stove: take what is done (hands empty), or put on what needs cooking
        const s = si("stove");
        if (s >= 0) {
          const pot = c.ents.find((e) => e.t === 4 && e.si === s);
          if (pot && !h) {
            if (now < pot.doneAt) return "아직 익는 중이에요";
            c.ents.splice(c.ents.indexOf(pot), 1); c.ver++;
            q.hold = [{ r: pot.r, chop: 0, cooked: true, cred: pot.cred }];
            coopEv(S, dim, 30, p.x, p.y, pot.r);
            return true;
          }
          if (h && dinerNeed(h) === 2) {
            if (pot) return "이 화덕은 사용 중이에요 — 옆 화덕으로!";
            const [x, y] = tilePx(J.st.stove[s]);
            c.ents.push({ id: c.nid++, t: 4, x, y, r: h.r, si: s, doneAt: now + D[h.r].cook, burnAt: now + D[h.r].cook + R.burnMs, cred: h.cred });
            c.ver++; q.hold = [];
            coopEv(S, dim, 31, x, y, h.r);
            return true;
          }
        }
        if (h && dinerNeed(h) === 1 && si("board") >= 0) {
          h.chop--; c.ver++;
          coopEv(S, dim, 34, p.x, p.y, h.chop);
          return true;
        }
        if (h && dinerNeed(h) === 0 && si("pass") >= 0) {
          const on = c.ents.filter((e) => e.t === 5);
          if (on.length >= R.passCap) return "패스대가 꽉 찼어요 — 쟁반 담당을 기다리세요!";
          const slot = [0, 1, 2, 3, 4, 5].find((i) => !on.some((e) => e.slot === i)), [x, y] = tilePx(J.st.pass[slot % J.st.pass.length]);
          c.ents.push({ id: c.nid++, t: 5, x: x + (slot >= J.st.pass.length ? 4 : -2), y: y - 4, r: h.r, slot, cred: h.cred });
          c.ver++; q.hold = [];
          coopEv(S, dim, 35, x, y, h.r);
          return true;
        }
        if (h && si("trash") >= 0) { q.hold = []; c.ver++; coopEv(S, dim, 36, p.x, p.y); return true; }
        if (!h) {
          const r = D.findIndex((d) => si(d.crate) >= 0);
          if (r >= 0) { q.hold = [{ r, chop: D[r].chop, cooked: false, cred: { [p.pid]: 1 } }]; c.ver++; coopEv(S, dim, 37, p.x, p.y, r); return true; }
        }
      } else {
        // the tray: serve a table that ordered what we carry, else take from the pass
        const tables = c.ents.filter((e) => e.t === 3 && dist(p.x, p.y, e.x, e.y) <= COOP_T.reach + 8);
        const o = tables.length && tables.find((e) => q.hold.some((d) => d.r === e.r));
        if (o) {
          const d = q.hold.splice(q.hold.findIndex((x) => x.r === o.r), 1)[0];
          c.ents.splice(c.ents.indexOf(o), 1); c.ver++; c.served++;
          // they eat, then the plate stays dirty on the table (it keeps the table closed) until a tray takes it
          c.ents.push({ id: c.nid++, t: 9, x: o.x, y: o.y, ti: o.ti, due: now + R.eatMs, hp: R.washN });
          const w = Object.values(d.cred).reduce((s, v) => s + v, 0) || 1, cred = { [p.pid]: R.serveK };
          for (const pid of Object.keys(d.cred)) cred[pid] = (cred[pid] || 0) + (R.cookK * d.cred[pid]) / w;
          const pts = coopGood(S, c, D[o.r].pts * (1 + 0.5 * Math.max(0, o.until - now) / o.pat), cred);
          coopEv(S, dim, 38, o.x, o.y, pts);
          return true;
        }
        const plate = c.ents.find((e) => e.t === 9 && e.ti >= 0 && now >= e.due && dist(p.x, p.y, e.x, e.y) <= COOP_T.reach + 8);
        if (plate) {
          if (q.hold.length >= R.trayCap) return `쟁반에는 ${R.trayCap}개까지만 올라가요 — 개수대로!`;
          c.ents.splice(c.ents.indexOf(plate), 1); c.ver++;
          q.hold.push({ r: 3, cred: {} });
          coopEv(S, dim, 43, plate.x, plate.y);
          return true;
        }
        if (tables.length && q.hold.some((d) => d.r < 3)) return "주문과 다른 요리예요";
        if (si("sink") >= 0 && q.hold.some((d) => d.r === 3)) {
          const [x, y] = tilePx(J.st.sink);
          for (const d of q.hold.filter((d) => d.r === 3)) c.ents.push({ id: c.nid++, t: 9, x, y, ti: -1, due: 0, hp: R.washN });
          q.hold = q.hold.filter((d) => d.r !== 3); c.ver++;
          coopEv(S, dim, 41, x, y);
          return true;
        }
        if (si("pass") >= 0) {
          const on = c.ents.filter((e) => e.t === 5).sort((a, b) => a.id - b.id);
          if (on.length) {
            if (q.hold.length >= R.trayCap) return `쟁반에는 ${R.trayCap}개까지만 올라가요 — 테이블로!`;
            // what a table is waiting for (and not on a tray yet) first, else the oldest
            const want = c.ents.filter((e) => e.t === 3).map((e) => e.r);
            for (const x of q.hold) { const i = want.indexOf(x.r); if (i >= 0) want.splice(i, 1); }
            const d = on.find((e) => want.includes(e.r)) || on[0];
            c.ents.splice(c.ents.indexOf(d), 1); c.ver++;
            q.hold.push({ r: d.r, cred: d.cred });
            coopEv(S, dim, 39, p.x, p.y, d.r);
            return true;
          }
        }
      }
      // the sink: anyone with empty hands washes the oldest plate there, `washN` acts each
      if (!q.hold.length && si("sink") >= 0) {
        const e = c.ents.find((e) => e.t === 9 && e.ti < 0);
        if (!e) return "씻을 접시가 없어요";
        e.hp--; c.ver++;
        if (e.hp > 0) { coopEv(S, dim, 41, e.x, e.y); toast(p, `설거지 ${R.washN - e.hp}/${R.washN}`); return true; }
        c.ents.splice(c.ents.indexOf(e), 1);
        const pts = coopGood(S, c, R.washPts, { [p.pid]: 1 });
        coopEv(S, dim, 42, e.x, e.y, pts); toast(p, `설거지 ${R.washN}/${R.washN} — 반짝반짝! +${pts}`);
        return true;
      }
      // the rack: swap tools (hands empty)
      if (si("rack") >= 0) {
        if (q.hold.length) return "들고 있는 것을 먼저 내려놓으세요";
        q.tool = q.tool === "pan" ? "tray" : "pan";
        coopEv(S, dim, 23, p.x, p.y);
        toast(p, `${COOP_TOOLS[q.tool]}${pp(COOP_TOOLS[q.tool], "을를")} 들었습니다.`);
        return true;
      }
      if (q.tool === "pan") {
        if (!h) return "재료 상자(채소·생선·고기)에서 재료를 꺼내세요";
        return ["패스대에 올리세요", "도마에서 썰어야 해요", "화덕에 올려 익히세요"][dinerNeed(h)];
      }
      if (q.hold.length && q.hold.every((d) => d.r === 3)) return "빈 접시는 개수대(주방 동쪽)로!";
      return q.hold.length ? "주문한 테이블로 가져가세요 (말풍선의 요리)" : "패스대에서 요리를 받아 오세요";
    },
    /** The HUD's job summary: served, missed. */
    sum: (c) => [c.served, c.miss],
    /** What each worker carries, for the HUD and the sprites: dish · 3 + stage (0 ready · 1 to chop · 2 to cook). */
    what: (q) => q.hold.map((h) => h.r * 3 + (q.tool === "tray" ? 0 : dinerNeed(h))),
  },
};

// ── 캉캉대장간 단조 v2 (the owner's concept; COOP_FORGE, H8): heat → each piece's rhythm pattern on the anvil (flips; 갑옷's
// answers by a second worker) → quench → the 진열대; customers walk in, look, and buy the piece they came for.
// Ents: furnaces t 6 (as the alch's), anvils { t: 7, v2, ai, pc, beat0 (ms of the pattern's beat 0), per }, customers { t: 8, r,
// until, dur, at (arrives), spot, gone 0 · 1 bought · 2 angry, goneAt }, pieces on the shelf { t: 10, slot, pc }. A piece
// { r, q, n (notes judged), heat, hot, heats, st, ct, ch, ha (갑옷: who calls) } is in one place: furnace, anvil, shelf or hands.

const FORGE_DIR = ["↑", "→", "↓", "←"];
const forgeNote = (a, i) => a.beat0 + COOP_FORGE.orders[a.pc.r].pat[i][0] * a.per;
const forgeDuet = (pc) => COOP_FORGE.orders[pc.r].pat.some((n) => n[1] === 1);
/** A hot piece goes on an anvil (or back on it after a reheat): its next note `leadMs` from now, hot for the rest of the pattern. */
function forgeLane(S, dim, c, a, now) {
  const F = COOP_FORGE, pc = a.pc, P = F.orders[pc.r].pat;
  a.per = Math.round(F.orders[pc.r].per * (c.state === "fever" ? F.feverK : 1));
  a.beat0 = now + F.leadMs - P[pc.n][0] * a.per;
  pc.hot = now + F.leadMs + (P[P.length - 1][0] - P[pc.n][0]) * a.per + F.slackMs;
  dim.rt.ev.push(["cb", a.id, F.leadMs, a.per]);
}
/** One note judged (0 perfect +2 · 1 good +1 · 2 miss −1, and the bar cools faster); the last one shapes the piece. */
function forgeJudge(S, dim, c, a, j, pid) {
  const F = COOP_FORGE, pc = a.pc;
  pc.q += [2, 1, -1][j]; pc.n++;
  if (j === 2) pc.hot -= F.missCool;
  if (pid) forgeCr(pc.ch, pid);
  coopEv(S, dim, 9 + j, a.x, a.y, pc.n);
  if (pc.n >= F.orders[pc.r].pat.length) { pc.st = "shaped"; coopEv(S, dim, 58, a.x, a.y, pc.r); }
  c.ver++;
}
/** Notes nobody struck in time (a late ping's included) are misses. */
function forgeLapse(S, dim, c, a, now) {
  const F = COOP_FORGE;
  while (a.pc && a.pc.st === "bar" && a.pc.hot > now && now - forgeNote(a, a.pc.n) > F.good + F.latMax) forgeJudge(S, dim, c, a, 2, 0);
}
/** A blow (d −1) or a flip (d 0–3: ↑ → ↓ ←) on the anvil's lane, judged against its next note after p's own offset. */
function forgeHit(S, dim, c, p, q, a, d) {
  const F = COOP_FORGE, now = S.now, pc = a.pc, P = F.orders[pc.r].pat, X = COOP[c.k].skin.txt;
  forgeLapse(S, dim, c, a, now);
  if (pc.st !== "bar" || !(pc.hot > now)) return true;
  q.offs = q.offs || [];
  const lat = clamp(forgeMed(q.offs), -F.latMax, F.latMax), off = (i) => now - lat - forgeNote(a, i);
  // past the next note's window and nearer the one after: the one before it was skipped
  if (pc.n + 1 < P.length && off(pc.n) > F.good && Math.abs(off(pc.n + 1)) < off(pc.n)) { forgeJudge(S, dim, c, a, 2, 0); if (!(pc.hot > now)) return true; }
  const i = pc.n, dd = off(i), note = P[i][1], want = note >= 2 ? note - 2 : -1;
  // too early: a stray blow costs quality and heat, the note still waits
  if (dd < -F.good) { pc.q--; pc.hot -= F.missCool; c.ver++; coopEv(S, dim, 11, a.x, a.y, pc.n); return true; }
  let j = Math.abs(dd) <= F.perfect ? 0 : Math.abs(dd) <= F.good ? 1 : 2, why = "";
  if (d !== want) { j = 2; why = want >= 0 ? `${X.flip} (${FORGE_DIR[want]})` : X.noflip; }
  else if (note < 2 && forgeDuet(pc)) {
    // 갑옷: the calls by one worker, the answers by someone else
    if (note === 0 && !pc.ha) pc.ha = p.pid;
    if (note === 0 ? p.pid !== pc.ha : p.pid === pc.ha) { j = 2; why = X.duet; }
  }
  const raw = now - forgeNote(a, i);
  if (!why && Math.abs(raw) <= F.good + F.latMax) { q.offs.push(raw); if (q.offs.length > 5) q.offs.shift(); }
  forgeJudge(S, dim, c, a, j, p.pid);
  if (why && now >= q.hintAt) { q.hintAt = now + 1200; toast(p, why); }
  return true;
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
  const F = shopF(c), K = COOP[c.k].skin, h = s.pc, gi = shopGrade(h), name = K.orders[h.r];
  c.ents.splice(c.ents.indexOf(s), 1);
  e.gone = 1; e.goneAt = now + F.leaveMs; c.done++; c.ver++;
  const pts = coopGood(S, c, F.orders[h.r].pts * F.grades[gi][1] * (1 + (F.timeK * Math.max(0, e.until - now)) / e.dur), forgeCred(F, h));
  coopEv(S, dim, 13, s.x, s.y, pts);
  coopToastAll(S, dim, `[${K.grades[gi]}] 손님이 ${name}${pp(name, "을를")} 사 갔어요! +${pts}`);
}
/** A customer walks in for a piece: one on the shelf nobody waits for first, else a kind the shift has unlocked (seeded). */
function forgeCustomer(S, dim, c, now) {
  const F = shopF(c), J = COOP[c.k], spot = J.seats.findIndex((t, i) => !c.ents.some((e) => e.t === 8 && e.spot === i));
  if (spot < 0) return;
  const want = c.ents.filter((e) => e.t === 8 && !e.gone).map((e) => e.r), left = [];
  for (const s of c.ents.filter((e) => e.t === 10)) { const i = want.indexOf(s.pc.r); if (i >= 0) want.splice(i, 1); else left.push(s.pc.r); }
  const menu = F.orders.map((o, i) => i).filter((i) => now - c.runAt >= (F.orders[i].at || 0));
  const r = left.length ? left[0] : menu[ri(c.box, 0, menu.length - 1)];
  const [x, y] = tilePx(J.seats[spot]), [dx, dy] = tilePx(J.door);
  c.ents.push({ id: c.nid++, t: 8, x, y, r, until: now + F.deadMs, dur: F.deadMs, at: now + Math.round((dist(x, y, dx, dy) / F.walk) * 1000), spot, gone: 0, goneAt: 0 });
  c.ver++; coopEv(S, dim, 62, dx, dy, r);
}
/** A customer each tick: gone out of sight, angry at the end of their patience, or buying the best piece they came for. */
function shopCustomer(S, dim, c, e, now) {
  const F = shopF(c), K = COOP[c.k].skin;
  if (e.gone) { if (now >= e.goneAt) { c.ents.splice(c.ents.indexOf(e), 1); c.ver++; } }
  else if (now >= e.until) {
    e.gone = 2; e.goneAt = now + F.leaveMs; c.late++; c.ver++;
    coopFail(c, F.latePen); coopEv(S, dim, 61, e.x, e.y, e.r);
    coopToastAll(S, dim, `[화난 손님] ${K.orders[e.r]}${pp(K.orders[e.r], "을를")} 못 사고 떠났어요! 점수 -${F.latePen}`);
  } else if (now >= e.at + F.browseMs) {
    const s = c.ents.filter((o) => o.t === 10 && o.pc.r === e.r).sort((a, b) => b.pc.q - a.pc.q || a.id - b.id)[0];
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
/** Standing at an anvil whose piece is on its lane, free to play it (a hammer, or anyone empty-handed for 갑옷's answers). */
function forgeOnLane(S, c, p, q) {
  const ai = coopSt(c, p, "anvil"), a = ai >= 0 ? forgeEnt(c, 7, "ai", ai) : null;
  return a && a.pc && a.pc.st === "bar" && a.pc.hot > S.now && !q.hold.length && (q.tool === "hammer" || forgeDuet(a.pc)) ? a : null;
}
COOP_JOB.forge = {
  init(S, dim, c) {
    const F = COOP_FORGE, J = COOP[c.k];
    J.st.furnace.forEach((t, fi) => { const [x, y] = tilePx(t); c.ents.push({ id: c.nid++, t: 6, x, y, fi, T: F.T0, bars: Array(F.slots).fill(null) }); });
    J.st.anvil.forEach((t, ai) => { const [x, y] = tilePx(t); c.ents.push({ id: c.nid++, t: 7, v2: 1, x, y, ai, pc: null, beat0: 0, per: 700, lastK: -1 }); });
    c.done = 0; c.late = 0; c.lastAt = c.runAt;
    c.next = { order: c.runAt + F.firstMs, sync: c.runAt };
    c.openN = Math.min(c.n + 1, F.open[c.n]);   // the opening customers, 1.5 s apart
  },
  tick(S, dim, c, now) {
    const F = COOP_FORGE, dt = Math.max(0, now - c.lastAt) / 1000;
    c.lastAt = now;
    for (const e of [...c.ents]) {
      if (e.t === 6) {
        e.T = Math.max(0, e.T - F.decay * dt);
        for (const b of e.bars) {
          if (!b) continue;
          if (b.heat < 100) {
            b.heat = Math.min(100, b.heat + (e.T >= F.lo ? F.heatIn : e.T >= 30 ? F.heatLo : 0) * dt);
            if (b.heat >= 100) { c.ver++; coopEv(S, dim, 53, e.x, e.y); }
          }
          if (e.T > F.scorch) b.q -= F.scorchQ * dt;
        }
      } else if (e.t === 7 && e.pc && e.pc.st === "bar" && e.pc.hot) {
        forgeLapse(S, dim, c, e, now);
        if (e.pc.st === "bar" && now >= e.pc.hot) { e.pc.hot = 0; c.ver++; coopEv(S, dim, 64, e.x, e.y); }
      } else if (e.t === 8) shopCustomer(S, dim, c, e, now);
    }
    shopOpen(S, dim, c, now);
    // furnace temperatures and heats drift every tick: resend them once a second (the client extrapolates the decay)
    if (now >= c.next.sync) { c.next.sync = now + F.syncMs; c.ver++; }
  },
  act(S, dim, c, p, q, d) {
    const F = COOP_FORGE, now = S.now, h = q.hold[0], si = (key) => coopSt(c, p, key), J = COOP[c.k], X = J.skin.txt;
    const ai = si("anvil"), a = ai >= 0 ? forgeEnt(c, 7, "ai", ai) : null, live = !!(a && a.pc && a.pc.st === "bar" && a.pc.hot > now);
    if (d >= 0 && !live) return "";   // a direction key off the lane does nothing
    if (q.tool === "tongs") {
      if (live && !h && forgeDuet(a.pc)) return forgeHit(S, dim, c, p, q, a, d);   // 갑옷: the tongs answer the hammer
      const fi = si("furnace");
      if (fi >= 0) {
        const f = forgeEnt(c, 6, "fi", fi);
        // put a cold bar in, take a hot one out, else pump the bellows
        if (h && h.st === "bar" && !(h.hot > now)) {
          const s = f.bars.indexOf(null);
          if (s >= 0) { h.heat = h.n ? F.reheat : 0; f.bars[s] = h; q.hold = []; forgeCr(h.ct, p.pid); c.ver++; coopEv(S, dim, 51, f.x, f.y); return true; }
        }
        if (!h) {
          const s = f.bars.findIndex((b) => b && b.heat >= 100);
          if (s >= 0) { const b = f.bars[s]; f.bars[s] = null; b.hot = now + F.hotMs; b.heats++; q.hold = [b]; forgeCr(b.ct, p.pid); c.ver++; coopEv(S, dim, 54, f.x, f.y); return true; }
        }
        if (now - (q.pumpAt || 0) < F.pumpMs) return "";
        const was = f.T;
        f.T = Math.min(100, f.T + F.pump); q.pumpAt = now; c.ver++;
        coopEv(S, dim, was < F.lo && f.T >= F.lo ? 65 : 17, f.x, f.y, Math.round(f.T));
        return true;
      }
      if (a) {
        if (h && h.st === "bar" && h.hot > now) {
          if (a.pc) return X.busy;
          if (h.r < 0) h.r = forgeKind(c);
          a.pc = h; q.hold = [];
          forgeLane(S, dim, c, a, now); forgeCr(h.ct, p.pid); c.ver++;
          coopEv(S, dim, 55, a.x, a.y, h.r);
          return true;
        }
        if (!h && a.pc && a.pc.st === "bar" && !live) { q.hold = [a.pc]; a.pc = null; c.ver++; coopEv(S, dim, 56, a.x, a.y); return true; }
      }
      if (!h && si("crate") >= 0) {
        q.hold = [{ r: -1, q: 0, n: 0, heat: 0, hot: 0, heats: 0, st: "bar", ct: { [p.pid]: 1 }, ch: {} }];
        c.ver++; coopEv(S, dim, 50, p.x, p.y);
        return true;
      }
    } else {
      if (a && a.pc && a.pc.st === "bar") {
        if (h) return X.first;
        if (!live) return X.cooled;
        return forgeHit(S, dim, c, p, q, a, d);
      }
      if (a && a.pc && !h) { q.hold = [a.pc]; a.pc = null; c.ver++; coopEv(S, dim, 57, a.x, a.y); return true; }
      if (h && h.st === "shaped" && si("quench") >= 0) { h.st = "quenched"; forgeCr(h.ch, p.pid); c.ver++; coopEv(S, dim, 12, p.x, p.y); return true; }
      if (h && h.st === "quenched" && si("shelf") >= 0) return forgeShelve(S, dim, c, p, q, h);
    }
    // the rack: swap tools (hands empty; a worker left alone after a drop does both jobs)
    if (si("rack") >= 0) {
      if (q.hold.length) return "들고 있는 것을 먼저 내려놓으세요";
      q.tool = q.tool === "tongs" ? "hammer" : "tongs";
      coopEv(S, dim, 23, p.x, p.y);
      toast(p, `${COOP_TOOLS[q.tool]}${pp(COOP_TOOLS[q.tool], "을를")} 들었습니다.`);
      return true;
    }
    if (q.tool === "tongs") return X.a[!h ? 0 : h.hot > now ? 1 : 2];
    return X.b[!h ? 0 : h.st === "shaped" ? 1 : 2];
  },
  lane: (S, c, p, q) => !!forgeOnLane(S, c, p, q),
  /** The HUD's job summary: sold, customers who left angry. */
  sum: (c) => [c.done, c.late],
  /** What each worker carries: (kind + 1) · 5 + 1 cold bar · 2 hot · 3 shaped · 4 quenched. */
  what: (q, now) => q.hold.map((h) => (h.r + 1) * 5 + (h.st === "quenched" ? 4 : h.st === "shaped" ? 3 : h.hot > now ? 2 : 1)),
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

// ── actions (validated in 70-validate.js, applied in 75-apply.js)

COOP_JOB.pipe = { init: pipeInit, sum: () => [0, 0] };

function coopValidate(S, p, a) {
  const c = coopOf(S, p);
  switch (a.t) {
    case "coop_start": {
      if (typeof a.k !== "string" || !Object.hasOwn(COOP, a.k)) return bad("아직 열리지 않은 아르바이트입니다");
      if (!coopNpc(S, p, a.k)) return bad(`${npcName(COOP[a.k].npc)}에게 다가가 말을 거세요`);
      const party = S.parties[p.party];
      if (party && party.m[0] !== p.pid) return bad("파티장만 근무를 시작할 수 있습니다");
      if (party && party.coop && dimAt(S, party.coop)) return bad("파티가 이미 근무 중입니다");
      if (party && party.rc) return bad("차원 균열 입장 준비 중입니다");
      // the owner's rule: a co-op job is the one you do with a party of 2–4, unlike the solo 알바 board
      if (coopCrew(S, p).length < 2) return bad(party ? "협동 알바는 2명 이상 파티로만 할 수 있어요. 파티원과 함께 이 방에 와 주세요." : "협동 알바는 2명 이상 파티로만 할 수 있어요. 파티원과 함께 와 주세요.");
      if (coopLive(S) >= COOP_T.max) return bad(`지금은 일손이 꽉 찼습니다 (${COOP_T.max}/${COOP_T.max})`);
      if (Object.keys(S.dims).length >= DIM.max) return bad("지금은 빈 자리가 없습니다. 잠시 뒤 다시 오세요");
      return OK;
    }
    case "coop_act":
      if (!c || !c.pl[p.pid]) return bad("근무 중이 아닙니다");
      if (a.d !== undefined && !(Number.isInteger(a.d) && a.d >= 0 && a.d <= 3)) return bad("알 수 없는 행동");
      if (c.state === "brief") return bad("곧 근무가 시작됩니다!");
      if (c.state === "end") return bad("근무가 끝났습니다");
      if (c.k === "pipe") return pipeValidate(S, p, c, a);
      return OK;
    case "coop_leave":
      return c ? OK : bad("근무 중이 아닙니다");
  }
  return bad("알 수 없는 행동");
}
function coopApply(S, p, a) {
  if (a.t === "coop_start") { coopStart(S, p, a.k); return; }
  const c = coopOf(S, p);
  if (a.t === "coop_leave") { toast(p, c.state === "end" ? "수고하셨습니다!" : "근무를 포기했습니다"); coopHome(S, p, c); return; }
  if (c.k === "pipe") { pipeApply(S, dimAt(S, p.map), c, p, a); return; }
  const q = c.pl[p.pid], job = COOP_JOB[c.k];
  // a rhythm lane's notes come faster than the work key's 250 ms
  if (S.now - q.actAt < (job.lane && job.lane(S, c, p, q) ? COOP_FORGE.laneMs : COOP_T.actMs)) return;
  q.actAt = S.now;
  const r = job.act(S, dimAt(S, p.map), c, p, q, a.d === undefined ? -1 : a.d);
  if (r === true) q.idleAt = S.now;
  else if (r && S.now >= q.hintAt) { q.hintAt = S.now + 1200; toast(p, r); }
}

// ── the wire (C.10, compact)

/**
 * Inside a shift: `cj` [job index, state 0 brief · 1 run · 2 fever · 3 end, seconds left, score, combo, mult ×10, grade 0–4,
 * next cut-off (0 at S), job sum (apt: mess, mess cap · diner: served, missed · forge and alch: sold, angry customers), [[eid, tool (index in the job's two), held,
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
  pipeView(S, p, out, c?.k === "pipe" ? c : null);
  if (c) {
    const now = S.now, g = coopGrade(c), J = COOP[c.k];
    const secs = Math.max(0, Math.ceil(((c.state === "brief" ? c.runAt : c.state === "end" ? c.doneAt : c.endAt) - now) / 1000));
    const team = dimInside(S, dim.id).filter((o) => c.pl[o.pid]).map((o) => { const q = c.pl[o.pid]; return [o.eid, J.tools.indexOf(q.tool), q.hold.length, now - q.idleAt >= COOP_T.zzzMs ? 1 : 0, COOP_JOB[c.k].what ? COOP_JOB[c.k].what(q, now) : 0, ...(COOP_JOB[c.k].mode ? [COOP_JOB[c.k].mode(q)] : [])]; });
    const v = [COOP_KINDS.indexOf(c.k), COOP_STATE.indexOf(c.state), secs, Math.round(c.score), c.combo, Math.round(coopMult(c) * 10), g, g < 4 ? coopCut(c, g) : 0, ...COOP_JOB[c.k].sum(c), team];
    const key = JSON.stringify(v);
    if (key !== p.cjKey || p.sendMap) { out.cj = v; p.cjKey = key; }
    if (p.cVer !== c.ver || p.sendMap) { out.C = c.ents.map(coopRow(now, c)); p.cVer = c.ver; }
  } else if (p.cjKey) { out.cj = 0; out.C = []; p.cjKey = null; p.cVer = -1; }
  if (p.coopRes) { out.cr = p.coopRes; p.coopRes = null; }
}
/** One entity on the wire; the diner’s carry a dish and, for orders and pots, deciseconds left (the client counts down). */
const coopRow = (now, c) => (e) => {
  const at = [e.id, e.t, Math.round(e.x), Math.round(e.y)], ds = (t) => Math.ceil((t - now) / 100);
  if (e.t === 9) return [...at, Math.max(0, ds(e.due)), e.hp, e.ti < 0 ? 1 : 0];
  if (e.t === 11) return [...at, Math.round(e.H * 10), Math.round(c.beat0 - now), c.per, Math.round(COOP_BREW.cool[c.n] * 1000)];
  if (e.t === 12) {
    const B = COOP_BREW, pc = e.pc, O = pc && B.orders[pc.r];
    const due = e.st === 3 ? e.at + B.ruinMs : e.st === 2 ? e.at + B.doneMs : e.hotAt ? e.hotAt + B.overMs : 0;
    return [...at, pc ? pc.r : -1, e.st, pc ? Math.min(100, Math.floor((100 * pc.prog) / O.hold)) : 0, pc ? brewGrade(pc) : -1, e.st === 3 ? e.foam : 0, due ? Math.max(0, ds(due)) : 0, forgeKind(c)];
  }
  if (e.t >= 6) return forgeRow(e, at, now, ds);
  return e.t < 3 ? [...at, e.hp] : e.t === 3 ? [...at, e.r, ds(e.until), Math.round(e.pat / 100)] : e.t === 4 ? [...at, e.r, ds(e.doneAt), ds(e.burnAt)] : [...at, e.r];
};
/** `self.coop`: the jobs done today (their day's pay taken). */
const coopSelf = (p) => (p.ch.coopDay === dayOf(p.S.now) ? p.ch.coopDone : []);
/** defs().coop: { jobs: { k: [name, minutes, tools, par, npc, lobby, hint, stations, skin {orders, grades} names or 0] }, kinds, cuts, gradeK (pay share C B A S), parN, tools, binCap, near, dishes, cook (ms), trayCap, washN, orders (forge v2) [name, notes, pts, beat ms, pattern [[beat, note 0 blow · 1 answer · 2–5 flip ↑→↓←]…]], door (the forge customers' door, px), forge [band lo, hi, scorch, decay/s], grades (forge piece grade names), brew (alch) { orders [name, lo, hi, hold ms, herbs, pts], chart [[beat, dir]…], loop, amb, herbs (names), foam } }. */
function coopDefs() {
  const J = (k) => COOP[k], skin = (k) => (J(k).skin ? { orders: J(k).skin.orders, grades: J(k).skin.grades } : 0);
  return { jobs: Object.fromEntries(Object.keys(COOP).map((k) => [k, [J(k).name, J(k).mins, J(k).tools, J(k).par, J(k).npc, J(k).lobby, J(k).hint, J(k).st, skin(k)]])),
    kinds: COOP_KINDS, cuts: COOP_T.cuts, gradeK: COOP_T.gradeK, parN: COOP_T.parN, tools: COOP_TOOLS, binCap: COOP_APT.binCap, near: COOP_T.near,
    dishes: COOP_DINER.dishes.map((d) => d.name), cook: COOP_DINER.dishes.map((d) => d.cook), trayCap: COOP_DINER.trayCap, washN: COOP_DINER.washN,
    orders: COOP_FORGE.orders.map((o, i) => [COOP.forge.skin.orders[i], o.pat.length, o.pts, o.per, o.pat]), door: tilePx(COOP.forge.door), forge: [COOP_FORGE.lo, COOP_FORGE.hi, COOP_FORGE.scorch, COOP_FORGE.decay], grades: COOP.forge.skin.grades,
    brew: { orders: COOP_BREW.orders.map((o, i) => [COOP.alch.skin.orders[i], o.lo, o.hi, o.hold, o.herbs, o.pts]), chart: COOP_BREW.chart, loop: COOP_BREW.loop, amb: COOP_BREW.amb, herbs: BREW_HERBS, foam: COOP_BREW.foam } };
}
