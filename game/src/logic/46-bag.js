// ───────────────────────────── the bag: its size, its tidying ─────────────────────────────
// A character's bag holds ch.bagCap slots: INV_BASE (40) to start, +BAG_STEP (5) per bag_expand
// up to INV_MAX (100), for gold on the BAG_COST curve (10-tables.js). Every bag-space check
// (canAdd, fits, pickup, buy, warehouse and house-storage withdrawals, rewards, unequipping)
// asks bagCap(ch). Sheets from before v10 had a 30-slot bag: they start at 40 (or at what
// they carry, rounded up to a step).

/** 12345 → "12,345" (the same everywhere: no locale). */
const gStr = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** How many slots a sheet's bag has (a sheet without the field: the base). */
function bagCap(ch) {
  const c = ch.bagCap | 0;
  return c >= INV_BASE ? Math.min(c, INV_MAX) : INV_BASE;
}
/** Room for `n` of `id` in a list of slots holding at most `cap` slots (stacks fill first). */
function roomIn(list, cap, id, n) {
  if (isGear(id)) return list.length + 1 <= cap;
  let room = Math.max(0, cap - list.length) * STACK;
  for (const s of list) if (s.id === id) room += STACK - s.n;
  return room >= n;
}
/**
 * A list of slots tidied: by kind, then the better piece first, then the higher level, then
 * by id; stacks of the same thing merge (the bag's 정리 and the house storage's).
 */
function sortSlots(list) {
  const rank = (e) => { const r = SORT_KIND.indexOf(ITEMS[e.id].type); return r < 0 ? 99 : r; };
  const order = list.map((e, i) => [e, i]).sort(([a1, i1], [b1, i2]) => rank(a1) - rank(b1) || (b1.q || 0) - (a1.q || 0) || (ITEMS[b1.id].req || 0) - (ITEMS[a1.id].req || 0) || (a1.id < b1.id ? -1 : a1.id > b1.id ? 1 : 0) || i1 - i2).map(([e]) => e);
  const out = [];
  for (const e of order) {
    const top = out[out.length - 1];
    if (!isGear(e.id) && top && top.id === e.id && top.n < STACK) {
      const put = Math.min(e.n || 1, STACK - top.n);
      top.n += put;
      if ((e.n || 1) > put) out.push({ id: e.id, n: (e.n || 1) - put });
    } else out.push(e);
  }
  return out;
}
/** The bag's size on a sheet being migrated (v10): 40 to 100 in steps of 5, never less than what it holds. */
function bagClean(ch) {
  const want = Math.max(INV_BASE, ch.bagCap | 0, Array.isArray(ch.inv) ? ch.inv.length : 0);
  ch.bagCap = Math.min(INV_MAX, INV_BASE + Math.ceil((want - INV_BASE) / BAG_STEP) * BAG_STEP);
}

/** bag_expand: +5 slots, for the next step's price (anywhere; the bag panel's button). */
function bagValidate(S, p, a) {
  const ch = p.ch, cap = bagCap(ch);
  if (a.t !== "bag_expand") return bad("잘못된 요청입니다");
  if (cap >= INV_MAX) return bad(`가방이 이미 최대 크기(${INV_MAX}칸)입니다`);
  if (ch.gold < bagCost(cap)) return bad(`골드가 부족합니다 (${gStr(bagCost(cap))}G 필요)`);
  return OK;
}
function bagApply(S, p, a) {
  const ch = p.ch, cap = bagCap(ch), cost = bagCost(cap);
  void a;
  ch.gold -= cost;
  ch.bagCap = cap + BAG_STEP;
  S.maps[p.map].ev.push(["u", p.eid, 2]);
  toast(p, `가방이 ${ch.bagCap}칸으로 늘어났습니다! (-${gStr(cost)}G)`);
  p.dirty = true;
  saveSoon(p);
}
