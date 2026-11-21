// ───────────────────────────── actions ─────────────────────────────

function npcNear(p, role) {
  for (const n of mapOfS(p.S, p.map).npcs) {
    if (n.role === role && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < 56) return true;
  }
  return false;
}
/** What the shopkeepers within reach sell: their own `goods`, or the general SHOP list. */
function goodsNear(p) {
  const out = new Set();
  for (const n of mapOfS(p.S, p.map).npcs) {
    if (n.role !== "shop" || dist(p.x, p.y, n.x * T + 8, n.y * T + 12) >= 56) continue;
    for (const id of n.goods || SHOP) out.add(id);
  }
  return out;
}
const bad = (error) => ({ ok: false, error });
/** The bag slot a client names, or undefined: only a whole index ("length" or "__proto__" is no slot). */
const invAt = (ch, s) => (Number.isInteger(s) ? ch.inv[s] : undefined);
const OK = { ok: true };

function socketValidate(p, slot) {
  const ch = p.ch;
  const g = SLOTS.includes(slot) ? ch.eq[slot] : null;
  if (!g) return bad("장착한 장비를 골라 주세요");
  if (p.dead) return bad("쓰러진 상태입니다");
  if (!npcNear(p, "smith")) return bad("대장장이 볼칸에게 가까이 가야 합니다");
  if (g.sk >= sockCap(g)) return bad("더 이상 홈을 뚫을 수 없습니다");
  if (countItem(ch, SOCK_ITEM) < 1) return bad("룬 천공석이 1개 필요합니다");
  if (ch.gold < SOCK_COST[g.sk]) return bad(`골드가 부족합니다 (${gStr(SOCK_COST[g.sk])}G 필요)`);
  return OK;
}
function enhCost(g) {
  const tier = ITEMS[g.id].tier;
  return { gold: 60 * tier * (g.enh + 1), stone: g.enh < 3 ? 1 : g.enh < 6 ? 2 : 3 };
}
function byEid(S, eid) {
  for (const pid of Object.keys(S.players)) if (S.players[pid].eid === eid) return S.players[pid];
  return null;
}

/**
 * The only gate between an untrusted browser and the world. Everything a client
 * could lie about — position, cooldowns, gold, where it is standing — is checked
 * here, before `applyAction` touches anything.
 */
export function validateAction(S, pid, a) {
  const p = S.players[pid];
  if (!p) return bad("캐릭터가 없습니다");
  if (!isObj(a) || typeof a.t !== "string") return bad("잘못된 요청입니다");
  const ch = p.ch;
  const now = S.now;
  // charms keep to their own ways (66-charms.js)
  const cg = charmGuard(ch, a);
  if (cg) return bad(cg);
  // a 일일 아르바이트 shift (66-alba.js): the hero stays at the counter
  if (p.ab && !a.t.startsWith("ab_") && !ALBA_OK.has(a.t)) return bad("아르바이트 중에는 할 수 없습니다");
  const h = Object.hasOwn(ACTIONS, a.t) ? ACTIONS[a.t] : null;
  if (h) return !h.down && p.dead ? bad("쓰러진 상태입니다") : h.check(S, p, a);
  if (p.dead) return bad("쓰러진 상태입니다");
  switch (a.t) {
    case "use": {
      if (a.id === SOCK_ITEM) return socketValidate(p, a.k);
      // Elixirs and the whetstone (life skills, 58-life.js).
      if (lifeUse(a.id)) return lifeUseValidate(S, p, a);
      const it = ITEMS[a.id];
      if (!it || !["pot", "food", "camp", "scroll", "buff", "pet"].includes(it.type)) return bad("사용할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (it.type === "buff" || it.type === "pet") return OK;
      if (it.type === "scroll") {
        if (S.dims[p.map]?.story?.airship) return bad("구조 중에는 [떠나기]로 오아시스에 돌아갈 수 있습니다");
        if (p.map === START.map) return bad("이미 마을에 있습니다");
        if (p.recall) return bad("이미 귀환을 준비하고 있습니다");
        return OK;
      }
      if (it.type === "camp") {
        const rt = S.maps[p.map];
        if (rt.fires.some((f) => dist(f.x, f.y, p.x, p.y) < 40)) return bad("바로 곁에 모닥불이 있습니다");
        if (rt.fires.filter((f) => f.until).length >= FIRE_MAX) return bad("이 지역에는 모닥불이 너무 많습니다");
        return OK;
      }
      if (now < p.potAt) return bad("재사용 대기 중입니다");
      return OK;
    }
    case "eq": {
      const s = invAt(ch, a.s);
      if (!s || !isGear(s.id)) return bad("장착할 수 없습니다");
      const it = ITEMS[s.id];
      // worn from item level − 10 (an entry without `il` asks what its base always asked: gearReq, 50-loot-combat.js)
      const need = gearReq(s);
      if (ch.lvl < need) return bad(`레벨 ${need}부터 착용할 수 있습니다`);
      if (a.k === "weapon2") {
        // a second main weapon for everyone (§9); a hybrid's is one of its pair
        if (it.type !== "weapon") return bad("무기만 Ⅱ에 장착할 수 있습니다");
        if (isHybrid(ch) && !JOBS[ch.job].wk.includes(it.wk)) return bad(`${JOBS[ch.job].wk.map((k) => WK_NAME[k]).join("이나 ")}만 들 수 있습니다`);
        return OK;
      }
      if (a.k !== undefined && !slotsFor(it.type).includes(a.k)) return bad("그 부위에는 착용할 수 없습니다");
      return OK;
    }
    case "uneq":
      if (!SLOTS.includes(a.k)) return bad("잘못된 부위");
      if (!ch.eq[a.k]) return bad("장착한 장비가 없습니다");
      if (ch.inv.length >= bagCap(ch)) return bad("가방이 가득 찼습니다");
      return OK;
    case "rune": {
      const s = invAt(ch, a.s);
      if (!s || ITEMS[s.id].type !== "rune") return bad("룬이 아닙니다");
      if (p.dead) return bad("쓰러진 상태입니다");
      const need = runeReq(s.il);
      if (ch.lvl < need) return bad(`레벨 ${need}부터 이 룬을 사용할 수 있습니다`);
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= Math.min(g.sk, sockCap(g))) return bad("뚫린 홈이 없습니다");
      const current = g.ru[a.i];
      if (runeSocketId(current) === s.id && runeSocketLevel(current) === runeIl(s.il)) return bad("이미 같은 룬이 끼워져 있습니다");
      if (g.ru[a.i] && a.r !== 1) return bad("끼워진 룬을 교체하면 사라집니다. 교체를 확인하세요");
      return OK;
    }
    case "socket": return socketValidate(p, a.k);
    case "train": {
      // Spend earned points: a = [str, wil, dex, int, wis, luk].
      if (!Array.isArray(a.a) || a.a.length !== ST_ORDER.length || !a.a.every((v) => Number.isInteger(v) && v >= 0 && v <= 50)) return bad("잘못된 능력치");
      const n = a.a.reduce((s, v) => s + v, 0);
      if (n < 1 || n > 50) return bad("잘못된 능력치");
      if (p.dead) return bad("쓰러진 상태입니다");
      if (ST_ORDER.some((k, i) => ch.st[k] + a.a[i] > ST_CAP)) return bad(`능력치는 ${ST_CAP}까지 올릴 수 있습니다`);
      if (n > statPoints(ch)) return bad("능력치 포인트가 부족합니다");
      return OK;
    }
    case "wh": {
      if (!npcNear(p, "bank")) return bad("창고지기가 너무 멉니다");
      const wh = ch.wh;
      if (a.a === "gold") {
        if (!Number.isSafeInteger(a.n) || a.n === 0) return bad("잘못된 금액");
        if (a.n > 0 && ch.gold < a.n) return bad("골드가 부족합니다");
        if (a.n < 0 && wh.gold < -a.n) return bad("창고에 골드가 부족합니다");
        return OK;
      }
      // materials straight from the 재료 주머니: { a: "put", pid: itemId, n }
      if (a.a === "put" && typeof a.pid === "string") {
        const n = a.n | 0;
        if (n < 1 || n > pouchHas(ch, a.pid)) return bad("잘못된 수량");
        return whRoom(wh, a.pid, n) ? OK : bad("창고가 가득 찼습니다");
      }
      const from = a.a === "put" ? ch.inv : a.a === "take" ? wh.items : null;
      if (!from) return bad("잘못된 요청입니다");
      const sl = Number.isInteger(a.s) ? from[a.s] : null;
      if (!sl) return bad("아이템이 없습니다");
      if (a.a === "put" && isQuestItem(sl.id)) return bad("퀘스트 아이템은 창고에 맡길 수 없습니다");
      const n = isGear(sl.id) ? 1 : a.n | 0;
      if (n < 1 || n > (sl.n || 1)) return bad("잘못된 수량");
      if (a.a === "put") return whRoom(wh, sl.id, n, sl.il) ? OK : bad("창고가 가득 찼습니다");
      return (isGear(sl.id) ? ch.inv.length < bagCap(ch) : canAdd(ch, sl.id, n, sl.il)) ? OK : bad("가방이 가득 찼습니다");
    }
    case "sellall":
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      return ch.inv.some(junk) ? OK : bad("팔 일반 장비가 없습니다");
    case "buy": {
      if (typeof a.id !== "string" || !Object.hasOwn(ITEMS, a.id) && !SHOP.includes(a.id)) return bad("팔지 않는 물건입니다");
      const n = a.n | 0;
      if (n < 1 || n > STACK) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      if (!goodsNear(p).has(a.id)) return bad("이 가게에서는 팔지 않는 물건입니다");
      const id = resolveItem(a.id, ch);
      if (ch.gold < buyCost(p, a.id, id, n)) return bad("골드가 부족합니다");
      if (!canAdd(ch, id, n)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "sell": {
      // from the 재료 주머니: { pid: itemId, n }
      if (typeof a.pid === "string") {
        const n = a.n | 0;
        if (n < 1 || n > pouchHas(ch, a.pid)) return bad("잘못된 수량");
        return npcNear(p, "shop") ? OK : bad("상인이 너무 멉니다");
      }
      // every piece of plain gear at once: { junk: 0 | 1 } (46-bag.js junkSlots)
      if (a.junk !== undefined) {
        if (a.junk !== 0 && a.junk !== 1) return bad("잘못된 요청");
        if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
        return junkSlots(ch, a.junk).length ? OK : bad("팔 만한 장비가 없습니다");
      }
      const s = invAt(ch, a.s);
      if (!s) return bad("아이템이 없습니다");
      if (isQuestItem(s.id)) return bad("퀘스트 아이템은 팔 수 없습니다");
      const n = a.n | 0;
      if (n < 1 || n > (s.n || 1)) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      return OK;
    }
    case "enh": {
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (isJewel(g.id)) return bad("장신구는 강화할 수 없습니다");
      if (g.enh >= 10) return bad("최대 강화 단계입니다");
      if (g.cu === 1) return bad("저주받은 장비는 강화할 수 없습니다 — 저주 해제 주문서로 먼저 풀어 주세요");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      const c = enhCost(g);
      if (ch.gold < c.gold) return bad("골드가 부족합니다");
      if (countItem(ch, "stone") < c.stone) return bad("강화석이 부족합니다");
      // b: 1 adds a 축복 강화석 (+10 %p, a failure never drops a step)
      if (a.b !== undefined && a.b !== 0 && a.b !== 1) return bad("잘못된 요청입니다");
      if (a.b === 1 && countItem(ch, "stone_b") < 1) return bad("축복 강화석이 없습니다");
      return OK;
    }
    case "uncurse": {
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g || g.cu !== 1) return bad("저주받은 장비가 아닙니다");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      if (countItem(ch, "uncurse") < 1) return bad("저주 해제 주문서가 없습니다");
      if (ch.gold < UNCURSE_FEE * ITEMS[g.id].tier) return bad(`저주 해제 수수료 ${(UNCURSE_FEE * ITEMS[g.id].tier).toLocaleString()}G가 부족합니다`);
      return OK;
    }
    case "salv": {
      const s = invAt(ch, a.s);
      if (!s || !isGear(s.id)) return bad("분해할 수 없는 아이템");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      if (!canAdd(ch, "stone", 12)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "bq": {
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      if (a.a === "take") {
        const d = MOBS[a.k];
        if (typeof a.k !== "string" || !d || d.boss || d.chest || d.questOnly) return bad("그런 의뢰는 없습니다");
        if (d.lv > toTier(ch.lvl) + 4) return bad("아직 감당하기 어려운 상대입니다");
        return OK;
      }
      if (a.a === "done") return ch.bq && ch.bq.n >= ch.bq.need ? OK : bad("아직 의뢰를 마치지 못했습니다");
      return bad("잘못된 요청입니다");
    }
    case "quest": {
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      const quest = QUESTS[ch.q.i];
      if (!quest) return bad("모든 의뢰를 마쳤습니다");
      if (a.a === "accept") {
        if (ch.q.st !== 0) return bad("이미 진행 중입니다");
        // a chapter's story beat comes first (QUESTS `sq`, 62-side-quests.js SQ_MAIN)
        const beat = quest.sq && !ch.sq.done[quest.sq] ? SQ_BY[quest.sq] : null;
        return beat ? bad(`먼저 [${beat.title}]${pp(beat.title, "을를")} 마쳐 주게 — ${npcName(beat.giver)}`) : OK;
      }
      if (a.a === "done") {
        if (ch.q.st !== 1 || ch.q.n < quest.n) return bad("아직 의뢰를 마치지 못했습니다");
        for (const [id, n] of quest.items) if (!canAdd(ch, id, n)) return bad("가방을 비우고 다시 오세요");
        return OK;
      }
      return bad("잘못된 요청입니다");
    }
    // ── jobs and stats (45-jobs.js): reset, the starter weapon, a job, a hybrid's swap
    case "respec": {
      if (p.dead) return bad("쓰러진 상태입니다");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (!spentPoints(ch.st)) return bad("되돌릴 능력치가 없습니다");
      const gold = statResetCost(ch);
      if (gold && countItem(ch, RESPEC_ITEM) < 1) return bad("되새김 인장이 필요합니다");
      if (ch.gold < gold) return bad(`골드가 부족합니다 (${gold.toLocaleString()}G 필요)`);
      return OK;
    }
    case "starter": {
      if (ch.sw) return bad("이미 무기를 받았습니다");
      if (!STARTER_WKS.includes(a.wk)) return bad("그런 무기는 없습니다");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (ch.inv.length >= bagCap(ch)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "job_change": {
      if (typeof a.j !== "string") return bad("없는 직업입니다");
      const why = jobOk(ch, a.j);
      if (why) return bad(why);
      if (!npcNear(p, "job")) return bad("전직관이 너무 멉니다");
      // a job walked before is taken up again for free (47-job-freedom.js)
      if (!ch.jobs[a.j] && ch.gold < JOBS[a.j].cost) return bad("골드가 부족합니다");
      return OK;
    }
    case "wsw": {
      if (p.dead || p.fish) return bad("지금은 무기를 바꿀 수 없습니다");
      if (!ch.eq.weapon2) return bad("Ⅱ에 장착한 무기가 없습니다");
      if (now < (p.wswAt || 0)) return bad("wsw");
      return OK;
    }
    default:
      return bad("알 수 없는 행동");
  }
}

