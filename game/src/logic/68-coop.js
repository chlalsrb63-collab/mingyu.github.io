// ───────────────────────────── 협동 아르바이트: the shared engine + 동동아파트 청소 (docs/design/life-and-coop.md C) ─────────────────────────────
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

/** The leader (or someone alone) starts a shift: everyone of the party in the lobby goes in (1–4). */
function coopStart(S, p, k) {
  const J = COOP[k], party = S.parties[p.party];
  const crew = (party ? party.m.map((pid) => S.players[pid]) : [p]).filter((o) => o && o.map === p.map && !o.dead).slice(0, 4);
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
    toast(o, `[${J.name}] ${crew.length}명 근무 시작! ${J.hint} (공격 키 / F)`);
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
  const c = dim.coop, g = coopGrade(c);
  c.state = "end"; c.doneAt = S.now + COOP_T.endMs; c.ver++;
  const avg = inside.reduce((s, o) => s + (c.pl[o.pid] ? c.pl[o.pid].pts : 0), 0) / Math.max(1, inside.length);
  const rows = [];
  for (const pid of Object.keys(c.pl)) {
    const q = c.pl[pid], o = S.players[pid];
    q.ok = !!(o && o.map === dim.id && S.now - q.idleAt < COOP_T.idleMs && q.pts >= COOP_T.lazy * avg);
    rows.push([q.name, Math.round(q.pts), COOP[c.k].tools.indexOf(q.tool), q.ok ? 1 : 0]);
  }
  S.coopBest = S.coopBest || {};
  S.coopBest[c.k] = Math.max(S.coopBest[c.k] || 0, Math.round(c.score));
  for (const o of inside) {
    const q = c.pl[o.pid];
    if (q && q.ok) coopPay(S, o, c, g); else toast(o, "근무 태도 불량 — 보상 없음");
    o.coopRes = [g, Math.round(c.score), S.coopBest[c.k], rows, [0, 1, 2, 3].map((i) => coopCut(c, i))];
  }
  coopEv(S, dim, 21, 0, 0, g);
}
/** C.7: a full day's pay at C or better (the first time today), a helper's tip after that, a small tip below C. */
function coopPay(S, p, c, g) {
  const ch = p.ch, J = COOP[c.k], R = COOP_T, today = dayOf(S.now);
  if (ch.coopDay !== today) { ch.coopDay = today; ch.coopDone = []; }
  const Tt = Math.max(1, Math.floor(toTier(ch.lvl))), life = lifeNeed(ch.life[J.skill].lv) * R.life[Math.max(0, g - 1)];
  const gold = (n) => { ch.gold += n; p.gain.push(["gold", n]); };
  if (!g) {
    gold(R.tip * Tt); gainLife(S, p, J.skill, life * R.tipLife);
    toast(p, "근무 평가 미달 — 수고비만 받았습니다. 오늘 다시 도전할 수 있어요.");
  } else if (ch.coopDone.includes(c.k)) {
    gold(R.helpTip * Tt); gainLife(S, p, J.skill, life * R.helpLife);
    toast(p, "오늘 보수는 이미 받았습니다 — 도와준 수고비를 받았습니다.");
  } else {
    ch.coopDone.push(c.k);
    gold(R.gold[g - 1] * Tt);
    if (addItem(ch, "stone", R.stone[g - 1])) p.gain.push(["item", "stone", R.stone[g - 1], 0]);
    rewardGear(S, p, Tt, R.gearQ[g - 1]);
    gainXp(S, p, Math.round(tierXp(Tt) * R.xp[g - 1]));
    gainLife(S, p, J.skill, life);
    addRep(S, p, J.npc, R.rep);
    toast(p, `[${J.name}] ${"CBAS"[g - 1]} 등급! 오늘의 보수를 받았습니다.`);
  }
  p.dirty = true;
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
    if (c.state === "run" && now >= c.endAt - COOP_T.feverMs) { c.state = "fever"; coopEv(S, dim, 14, 0, 0); coopToastAll(S, dim, "피버 타임! 남은 1분, 점수 ×1.5"); }
    if (c.state === "run" || c.state === "fever") {
      if (now >= c.endAt) coopFinish(S, dim, inside);
      else COOP_JOB[c.k].tick(S, dim, c, now);
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
const COOP_JOB = {
  apt: {
    init(S, dim, c) {
      const A = COOP_APT;
      c.next = { pile: c.runAt + A.pileMs[c.n - 1], sofa: c.runAt + A.sofaMs / COOP_T.parN[c.n] };
      // the opening mess, more with each worker; staggered so it doesn't all spread at once
      for (let i = 0; i < A.open[0] + A.open[1] * c.n; i++) { const e = aptSpawn(S, dim, c, 0); if (e) e.due = c.runAt + A.spreadMs + i * 1500; }
    },
    tick(S, dim, c, now) {
      const A = COOP_APT, k = COOP_T.parN[c.n], piles = c.ents.filter((e) => e.t === 0), pileCap = A.pileCap[0] + A.pileCap[1] * c.n;
      if (now >= c.next.pile) { c.next.pile = now + A.pileMs[c.n - 1]; if (piles.length < pileCap) aptSpawn(S, dim, c, 0); }
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
      if (party && party.rc) return bad("차원 균열 입장 준비 중입니다");
      if (coopLive(S) >= COOP_T.max) return bad(`지금은 일손이 꽉 찼습니다 (${COOP_T.max}/${COOP_T.max})`);
      if (Object.keys(S.dims).length >= DIM.max) return bad("지금은 빈 자리가 없습니다. 잠시 뒤 다시 오세요");
      return OK;
    }
    case "coop_act":
      if (!c || !c.pl[p.pid]) return bad("근무 중이 아닙니다");
      if (c.state === "brief") return bad("곧 근무가 시작됩니다!");
      if (c.state === "end") return bad("근무가 끝났습니다");
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
  const q = c.pl[p.pid];
  if (S.now - q.actAt < COOP_T.actMs) return;
  q.actAt = S.now;
  const r = COOP_JOB[c.k].act(S, dimAt(S, p.map), c, p, q);
  if (r === true) q.idleAt = S.now;
  else if (r && S.now >= q.hintAt) { q.hintAt = S.now + 1200; toast(p, r); }
}

// ── the wire (C.10, compact)

/**
 * Inside a shift: `cj` [job index, state 0 brief · 1 run · 2 fever · 3 end, seconds left, score, combo, mult ×10, grade 0–4,
 * next cut-off (0 at S), mess, mess cap, [[eid, tool 0 broom · 1 bin, held, zzz]…]] when it changes; `C` [[id, type
 * 0 pile · 1 bundle · 2 sofa, x, y, hp]…] when the entities change; `cr` the report card once: [grade, score, channel best,
 * [[name, pts, tool, eligible]…], [C B A S cut-offs]]. `cj: 0` once on the way out.
 */
function coopView(S, p, out) {
  const dim = inDim(p) ? dimAt(S, p.map) : null, c = dim && dim.coop;
  if (c) {
    const now = S.now, g = coopGrade(c), J = COOP[c.k];
    const secs = Math.max(0, Math.ceil(((c.state === "brief" ? c.runAt : c.state === "end" ? c.doneAt : c.endAt) - now) / 1000));
    const team = dimInside(S, dim.id).filter((o) => c.pl[o.pid]).map((o) => { const q = c.pl[o.pid]; return [o.eid, J.tools.indexOf(q.tool), q.hold.length, now - q.idleAt >= COOP_T.zzzMs ? 1 : 0]; });
    const v = [COOP_KINDS.indexOf(c.k), COOP_STATE.indexOf(c.state), secs, Math.round(c.score), c.combo, Math.round(coopMult(c) * 10), g, g < 4 ? coopCut(c, g) : 0, ...COOP_JOB[c.k].sum(c), team];
    const key = JSON.stringify(v);
    if (key !== p.cjKey || p.sendMap) { out.cj = v; p.cjKey = key; }
    if (p.cVer !== c.ver || p.sendMap) { out.C = c.ents.map((e) => [e.id, e.t, Math.round(e.x), Math.round(e.y), e.hp]); p.cVer = c.ver; }
  } else if (p.cjKey) { out.cj = 0; out.C = []; p.cjKey = null; p.cVer = -1; }
  if (p.coopRes) { out.cr = p.coopRes; p.coopRes = null; }
}
/** `self.coop`: the jobs done today (their day's pay taken). */
const coopSelf = (p) => (p.ch.coopDay === dayOf(p.S.now) ? p.ch.coopDone : []);
/** defs().coop: { jobs: { k: [name, minutes, tools, par, npc, lobby] }, cuts, parN, tools, binCap }. */
function coopDefs() {
  return { jobs: Object.fromEntries(Object.keys(COOP).map((k) => [k, [COOP[k].name, COOP[k].mins, COOP[k].tools, COOP[k].par, COOP[k].npc, COOP[k].lobby]])),
    kinds: COOP_KINDS, cuts: COOP_T.cuts, parN: COOP_T.parN, tools: COOP_TOOLS, binCap: COOP_APT.binCap, near: COOP_T.near };
}
