// ───────────────────────────── player to player: requests, trade, mini-games ─────────────────────────────
// The click menu on another player (public/pmenu.js) asks for these; party invites, friends and whispers use
// their own actions. One action `sx` with a sub-op `a`:
//   ask {k: "trade" | a MINIGAMES id, e: eid} → the target sees a request (p.req) for SX_ASK_MS; yes / no answer it
//   trade: put {s: bag slot, n} · take {i: offer row} · gold {n} · lock {v: 0|1} · go · x (close)
//   game:  pick {v} (the game's own ops, MINIGAMES[k].check / act) · x (leave)
// State lives on the players (p.req, p.trade, p.game), never on the sheet: a restart or a logout ends it.
// Trade offers hold the bag slot objects themselves, so an item sold, stored, sorted away or used mid-trade is
// no longer in the bag and the offer falls off (sxTick); the swap checks every row again and runs on copies of
// both bags first, so it either happens whole or not at all.

const SX_ASK_MS = 20000, SX_ASK_CD = 3000;
const SX_TRADE_ASK = 5 * T, SX_TRADE_KEEP = 8 * T, SX_GAME_ASK = 10 * T;
const SX_ROWS = 8;
const RPS_PICK = 3000, RPS_SHOW = 3500;
const RPS_HAND = ["가위", "바위", "보"];

/** Mini-games between two players, keyed by id: more plug in here (the menu lists them from defs().sx.games). */
const MINIGAMES = {
  rps: {
    name: "가위바위보",
    start(S, g) { g.ph = 0; g.end = S.now + RPS_PICK; g.pk = { [g.a]: -1, [g.b]: -1 }; g.au = {}; g.r = 0; },
    check(S, g, p, a) {
      if (a.a !== "pick") return "잘못된 요청입니다";
      if (g.ph !== 0) return "이미 공개되었습니다";
      return Number.isInteger(a.v) && a.v >= 0 && a.v <= 2 ? "" : "가위 · 바위 · 보 중에서 고르세요";
    },
    act(S, g, p, a) { g.pk[p.pid] = a.v; },
    tick(S, g) {
      if (S.now < g.end) return true;
      if (g.ph === 1) return false;                       // shown long enough: over
      // time is up: whoever has not picked gets a hand by lot, then both are shown at once
      for (const pid of [g.a, g.b]) if (g.pk[pid] < 0) { g.pk[pid] = ri(S, 0, 2); g.au[pid] = 1; }
      g.r = (g.pk[g.a] - g.pk[g.b] + 3) % 3;              // 0 draw · 1 a wins · 2 b wins
      g.ph = 1; g.end = S.now + RPS_SHOW;
      const A = S.players[g.a], B = S.players[g.b];
      const line = `가위바위보 · ${A.ch.name} ${RPS_HAND[g.pk[g.a]]} vs ${RPS_HAND[g.pk[g.b]]} ${B.ch.name} — ` +
        (g.r === 0 ? "비겼습니다" : `${(g.r === 1 ? A : B).ch.name} 승리!`);
      sxLine(S, A, line); sxLine(S, B, line);
      return true;
    },
    // [phase 0 pick · 1 shown, seconds left, my hand (-1 none), theirs (-1 hidden · 0..2 shown; while picking 9 = picked),
    //  result for me (1 win · 0 draw · -1 lose; while picking 0), my hand was by lot 0/1, theirs 0/1]
    view(S, g, pid) {
      const o = pid === g.a ? g.b : g.a, show = g.ph === 1;
      const r = !show || g.r === 0 ? 0 : (g.r === 1) === (pid === g.a) ? 1 : -1;
      return [g.ph, Math.max(0, Math.ceil((g.end - S.now) / 1000)), g.pk[pid], show ? g.pk[o] : g.pk[o] >= 0 ? 9 : -1, r, g.au[pid] | 0, show ? g.au[o] | 0 : 0];
    },
  },
};

/** A chat line only `p` reads (the system colour). */
function sxLine(S, p, m) { S.chat.push({ sys: 1, m, to: p.pid }); }
const sxBusy = (p) => !!(p.trade || p.game);
const sxKind = (k) => (k === "trade" ? "거래" : MINIGAMES[k] ? MINIGAMES[k].name : "");
/** What may be offered in a trade: what the warehouse takes (no quest items, no charms or their frame nails). */
const sxTradable = (s) => !!s && Object.hasOwn(ITEMS, s.id) && !isQuestItem(s.id) && !isCharm(s) && s.id !== "charm_nail";
/** A slot that moves as it is (gear, or anything carrying more than an id and a count). */
const sxWhole = (s) => isGear(s.id) || Object.keys(s).some((k) => k !== "id" && k !== "n");
const sxOther = (S, p, box) => S.players[box.a === p.pid ? box.b : box.a];

function sxValidate(S, p, a) {
  const ch = p.ch, now = S.now;
  switch (a.a) {
    case "ask": {
      if (a.k !== "trade" && !Object.hasOwn(MINIGAMES, a.k)) return bad("없는 요청입니다");
      const o = byEid(S, a.e);
      if (!o || o === p || o.map !== p.map) return bad("대상을 찾을 수 없습니다");
      if (now - (p.sxAt || -1e9) < SX_ASK_CD) return bad("잠시 후에 다시 요청하세요");
      if (p.dead || o.dead) return bad("쓰러진 상태에서는 할 수 없습니다");
      if (sxBusy(p)) return bad("이미 거래나 미니게임 중입니다");
      if (sxBusy(o) || (o.req && now - o.req.at < SX_ASK_MS)) return bad("상대가 다른 일로 바쁩니다");
      if (blocked(o.ch, ch.name)) return bad("요청을 보낼 수 없는 상대입니다");
      const far = a.k === "trade" ? SX_TRADE_ASK : SX_GAME_ASK;
      if (dist(p.x, p.y, o.x, o.y) > far) return bad(`너무 멉니다 (${far / T}칸 이내로 다가가세요)`);
      return OK;
    }
    case "yes": case "no": {
      const q = p.req, from = q && now - q.at < SX_ASK_MS ? S.players[q.from] : null;
      if (!from) return bad("유효한 요청이 없습니다");
      if (a.a === "no") return OK;
      if (sxBusy(p) || sxBusy(from)) return bad("상대가 다른 일로 바쁩니다");
      if (from.map !== p.map || dist(p.x, p.y, from.x, from.y) > (q.k === "trade" ? SX_TRADE_KEEP : SX_GAME_ASK * 2)) return bad("상대가 너무 멀리 있습니다");
      if (p.dead || from.dead) return bad("쓰러진 상태에서는 할 수 없습니다");
      return OK;
    }
    case "x": return p.trade || p.game || p.req ? OK : bad("진행 중인 것이 없습니다");
  }
  if (p.game) {
    const err = MINIGAMES[p.game.k].check(S, p.game, p, a);
    return err ? bad(err) : OK;
  }
  const tr = p.trade;
  if (!tr) return bad("거래 중이 아닙니다");
  const me = tr.o[p.pid], them = tr.o[sxOther(S, p, tr).pid];
  switch (a.a) {
    case "put": {
      const s = invAt(ch, a.s);
      if (!s) return bad("아이템이 없습니다");
      if (!sxTradable(s)) return bad(isCharm(s) ? "참은 거래할 수 없습니다" : "거래할 수 없는 아이템입니다");
      if (me.it.some((r) => r.s === s)) return bad("이미 올린 아이템입니다");
      if (me.it.length >= SX_ROWS) return bad(`한 번에 ${SX_ROWS}칸까지 올릴 수 있습니다`);
      const n = a.n | 0;
      if (n < 1 || n > (s.n || 1)) return bad("잘못된 수량");
      return sxWhole(s) && n !== (s.n || 1) ? bad("이 아이템은 묶음째로만 올릴 수 있습니다") : OK;
    }
    case "take": return Number.isInteger(a.i) && me.it[a.i] ? OK : bad("올린 아이템이 없습니다");
    case "gold": return Number.isSafeInteger(a.n) && a.n >= 0 && a.n <= ch.gold ? OK : bad("골드가 부족합니다");
    case "lock": return a.v === 0 || a.v === 1 ? OK : bad("잘못된 요청입니다");
    case "go": {
      if (!me.l || !them.l) return bad("두 사람 모두 확정해야 교환할 수 있습니다");
      if (!them.go) return OK;
      const err = sxSwap(S, tr, true);
      return err ? bad(err) : OK;
    }
  }
  return bad("잘못된 요청입니다");
}

function sxApply(S, p, a) {
  const now = S.now;
  switch (a.a) {
    case "ask": {
      const o = byEid(S, a.e);
      p.sxAt = now;
      o.req = { k: a.k, from: p.pid, at: now };
      toast(p, `${o.ch.name}님에게 ${sxKind(a.k)}${pp(sxKind(a.k), "을를")} 신청했습니다`);
      return;
    }
    case "yes": case "no": {
      const q = p.req, from = S.players[q.from];
      p.req = null;
      if (a.a === "no") { toast(from, `${p.ch.name}님이 ${sxKind(q.k)} 신청을 거절했습니다`); return; }
      if (from.req && from.req.from === p.pid) from.req = null;
      sxBegin(S, from, p, q.k);
      return;
    }
    case "x":
      if (p.trade) sxEndTrade(S, p.trade, `${p.ch.name}님이 거래를 취소했습니다`, p);
      else if (p.game) sxEndGame(S, p.game, `${p.ch.name}님이 미니게임을 나갔습니다`);
      else p.req = null;
      return;
  }
  if (p.game) { MINIGAMES[p.game.k].act(S, p.game, p, a); return; }
  const tr = p.trade, me = tr.o[p.pid], them = tr.o[sxOther(S, p, tr).pid];
  const unlock = () => { me.l = me.go = them.l = them.go = 0; };
  switch (a.a) {
    case "put": { const s = p.ch.inv[a.s]; me.it.push({ s, n: a.n | 0 }); unlock(); break; }
    case "take": me.it.splice(a.i, 1); unlock(); break;
    case "gold": me.g = a.n; unlock(); break;
    case "lock": if (a.v) me.l = 1; else unlock(); break;
    case "go":
      me.go = 1;
      if (them.go) { const err = sxSwap(S, tr, false); if (err) { unlock(); toast(p, err); } }
      break;
  }
}

/** Two players agreed: open the trade or start the game. */
function sxBegin(S, A, B, k) {
  if (k === "trade") {
    const tr = { a: A.pid, b: B.pid, o: { [A.pid]: { it: [], g: 0, l: 0, go: 0 }, [B.pid]: { it: [], g: 0, l: 0, go: 0 } } };
    A.trade = B.trade = tr;
    for (const [x, y] of [[A, B], [B, A]]) toast(x, `${y.ch.name}님과 거래를 시작합니다`);
    return;
  }
  const g = { k, a: A.pid, b: B.pid };
  MINIGAMES[k].start(S, g);
  A.game = B.game = g;
}
function sxEndTrade(S, tr, why, by) {
  for (const pid of [tr.a, tr.b]) {
    const x = S.players[pid];
    if (!x || x.trade !== tr) continue;
    x.trade = null;
    if (why) toast(x, x === by ? "거래를 취소했습니다" : why);   // the one who cancelled is not named to themselves
  }
}
function sxEndGame(S, g, why) {
  for (const pid of [g.a, g.b]) {
    const x = S.players[pid];
    if (!x || x.game !== g) continue;
    x.game = null;
    if (why) toast(x, why);
  }
}

/** The rows of one side that still stand: the slot is in that bag and holds at least what was offered. */
const sxRowOk = (ch, r) => ch.inv.includes(r.s) && r.n >= 1 && r.n <= (r.s.n || 1) && sxTradable(r.s);

/**
 * Swap both offers. `dry`: only say whether it would work ("" or why not). For real, it first runs on copies of
 * both bags (and pouches, and gold) and only touches the real sheets when the copies came through whole.
 */
function sxSwap(S, tr, dry) {
  const A = S.players[tr.a], B = S.players[tr.b];
  if (!A || !B) return "상대가 없습니다";
  const oa = tr.o[tr.a], ob = tr.o[tr.b];
  for (const [x, o] of [[A, oa], [B, ob]]) {
    if (!o.it.every((r) => sxRowOk(x.ch, r))) return `${x.ch.name}님이 올린 아이템이 가방에 없습니다`;
    if (x.ch.gold < o.g) return `${x.ch.name}님의 골드가 부족합니다`;
  }
  const copy = (ch) => ({ ...ch, inv: ch.inv.map((s) => ({ ...s })), pouch: ch.pouch ? { ...ch.pouch } : ch.pouch });
  const ca = copy(A.ch), cb = copy(B.ch);
  const err = sxMove(ca, cb, oa, ob, A.ch, B.ch);
  if (err || dry) return err;
  sxMove(A.ch, B.ch, oa, ob, A.ch, B.ch);
  const got = (o) => [...o.it.map((r) => `${ITEMS[r.s.id].name}${(r.s.n || 1) > 1 || r.n > 1 ? ` ×${r.n}` : ""}`), ...(o.g ? [`${gStr(o.g)}G`] : [])].join(", ") || "없음";
  for (const [x, y, give, take] of [[A, B, oa, ob], [B, A, ob, oa]]) {
    sxLine(S, x, `거래 완료 · ${y.ch.name}님에게 준 것: ${got(give)} · 받은 것: ${got(take)}`);
    toast(x, `${y.ch.name}님과 거래를 마쳤습니다`);
    x.dirty = true;
    saveSoon(x);
  }
  A.trade = B.trade = null;
  return "";
}
/**
 * Move both offers between two sheets (real ones, or the copies made in sxSwap: rows are found by their index in
 * the real bags `ra`/`rb`). Takes everything out first, then puts in; "" or why it cannot be done.
 */
function sxMove(a, b, oa, ob, ra, rb) {
  const out = (ch, o, real) => {
    const rows = o.it.map((r) => ({ i: real.inv.indexOf(r.s), n: r.n })).sort((x, y) => y.i - x.i);
    const got = [];
    for (const { i, n } of rows) {
      const s = ch.inv[i], whole = sxWhole(s) || n >= (s.n || 1);
      if (whole) { ch.inv.splice(i, 1); got.push({ s, whole: true }); } else { s.n -= n; got.push({ s: { id: s.id, n }, whole: false }); }
    }
    ch.gold -= o.g;
    return got;
  };
  const into = (ch, got, g) => {
    for (const { s, whole } of got) {
      if (whole && sxWhole(s)) {
        if (ch.inv.length >= bagCap(ch)) return `${ch.name}님의 가방이 가득 찼습니다`;
        ch.inv.push(s);
      } else if (!addItem(ch, s.id, s.n || 1)) return `${ch.name}님의 가방이 가득 찼습니다`;
    }
    ch.gold += g;
    return "";
  };
  const ga = out(a, oa, ra), gb = out(b, ob, rb);
  return into(b, ga, oa.g) || into(a, gb, ob.g);
}

/** Every tick: requests run out, trades break off when the two part, offers fall off when their item is gone, games run. */
function sxTick(S, now) {
  for (const pid in S.players) {
    const p = S.players[pid];
    if (p.req && (now - p.req.at >= SX_ASK_MS || !S.players[p.req.from])) p.req = null;
    const tr = p.trade;
    if (tr && tr.a === pid) {
      const o = S.players[tr.b];
      if (!o) sxEndTrade(S, tr, "상대가 떠나 거래가 취소되었습니다");
      else if (p.dead || o.dead) sxEndTrade(S, tr, "쓰러져서 거래가 취소되었습니다");
      else if (o.map !== p.map || dist(p.x, p.y, o.x, o.y) > SX_TRADE_KEEP) sxEndTrade(S, tr, "너무 멀어져 거래가 취소되었습니다");
      else for (const x of [p, o]) {
        const side = tr.o[x.pid], keep = side.it.filter((r) => sxRowOk(x.ch, r));
        const gold = Math.min(side.g, x.ch.gold);
        if (keep.length === side.it.length && gold === side.g) continue;
        side.it = keep; side.g = gold;
        for (const pid2 of [tr.a, tr.b]) { const s2 = tr.o[pid2]; s2.l = s2.go = 0; }
        for (const y of [p, o]) toast(y, "올린 물건이 바뀌어 확정이 풀렸습니다");
      }
    }
    const g = p.game;
    if (g && g.a === pid) {
      const o = S.players[g.b];
      if (!o || o.map !== p.map) sxEndGame(S, g, "상대가 떠나 미니게임이 끝났습니다");
      else if (!MINIGAMES[g.k].tick(S, g)) sxEndGame(S, g, "");
    }
  }
}
/** A player leaving the world (removePlayer) or the channel ends whatever they were in. */
function sxLeave(S, p) {
  if (p.trade) sxEndTrade(S, p.trade, "상대가 떠나 거래가 취소되었습니다");
  if (p.game) sxEndGame(S, p.game, "상대가 떠나 미니게임이 끝났습니다");
}

/**
 * The snapshot's `sx`, sent only when it changes (0 = nothing any more):
 * { q: [name, kind] a request for me · t: trade · g: [kind, other's name, ...MINIGAMES[kind].view] }
 * trade t: { n: other's name, e: their eid, m: [[bag slot, n]…], mg, ml, mo (my gold, lock, go),
 *            o: [[slot object, n]…], og, ol, oo (theirs) }
 */
function sxPayload(S, p) {
  const v = {};
  const q = p.req, from = q && S.players[q.from];
  if (from) v.q = [from.ch.name, q.k, sxKind(q.k)];
  if (p.trade) {
    const tr = p.trade, o = sxOther(S, p, tr), me = tr.o[p.pid], th = tr.o[o.pid];
    v.t = { n: o.ch.name, e: o.eid, m: me.it.map((r) => [p.ch.inv.indexOf(r.s), r.n]), mg: me.g, ml: me.l, mo: me.go,
      o: th.it.map((r) => [r.s, r.n]), og: th.g, ol: th.l, oo: th.go };
  }
  if (p.game) {
    const g = p.game, o = S.players[g.a === p.pid ? g.b : g.a];
    if (o) v.g = [g.k, o.ch.name, ...MINIGAMES[g.k].view(S, g, p.pid)];
  }
  return v.q || v.t || v.g ? v : null;
}
function sxView(S, p, out) {
  const v = sxPayload(S, p), k = v ? JSON.stringify(v) : "";
  if (k === (p.sxSent || "")) return;
  p.sxSent = k;
  out.sx = v || 0;
}
const sxDefs = () => ({ games: Object.keys(MINIGAMES).map((k) => [k, MINIGAMES[k].name]), tradeR: SX_TRADE_ASK / T, gameR: SX_GAME_ASK / T, rows: SX_ROWS, pickMs: RPS_PICK });
