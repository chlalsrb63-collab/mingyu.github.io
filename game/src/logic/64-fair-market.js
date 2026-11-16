// ───────────────────────────── 장날 상인 (the fair market's merchants) ─────────────────────────────
// While 버드나무 장날 is open (63-festival.js fairOpen: Tue and Sat 19–21 KST) six travelling merchants stand in the middle of
// 버드나무 마을: NPCs `fm_<vendor>` (role "fairmkt", data/maps/willow.json; the client draws them only while `dn[3]` says the
// market is open). Each sells a short, limited stock that is a pure function of the KST day number (the same for everyone,
// nothing is stored, nothing is saved); a product can be bought ONCE per player: `ch.fairBuy` { [KST day]: [product ids] }, only
// the newest day kept. Goods are dear — every figure is in FAIR_PRICE below.
//   leg   전설 장비 (4–6 legendary pieces of different slots, item levels spread over 30–190, rolled by rollGear at q3)
//   scr   인챈트 스크롤 (every `es_*` item that exists; none yet → an empty counter, no error)
//   rune  룬 (the game has no "set"/"legendary" runes; the rarest are the six that make the 3-rune words: the day's word's runes + 2)
//   cos   의상 (off-season 장날 pieces: COSMETICS src "fair", the ones 장꾼 다래 sells for tokens only in their own season)
//   food  음식 (five rare dishes in packs of five)
//   dye   염료 (four of 루루's six dyes in packs of three)
// Actions: `fair_open {v}` asks for a vendor's list (answered once, as snapshot `fm`, never every tick); `fair_shop {v, i, d}`
// buys row i of vendor v's list of KST day d (d guards against a window left open from another day).

/** The vendors, in wire/seed order. The NPC of vendor `v` is `fm_<v>`. */
const FAIR_VENDORS = ["leg", "scr", "rune", "cos", "food", "dye"];
const fairNpcId = (v) => `fm_${v}`;
/**
 * Prices in gold — the one table. Calibration (balance 2026-11-15/16: 알바 ≈ 12k a day at Lv40, hunting gold ≈ 6–9k an hour at every
 * level, 45 h to Lv.200): a cheap piece is an hour or two of play, the top one about a week of a casual player's savings.
 *   gear   price(il) = round(base × (il / ref) ^ pow, to step): il 30 → 15,000 · 60 → 38,000 · 100 → 76,000 · 150 → 130,000 · 190 → 182,000
 *          (a crafted tier-2 piece costs ≈ 1.5k, a tier-6 ≈ 30k; a dropped 전설 sells for ≤ 8.5k)
 *   scroll a flat price per 인챈트 스크롤 (one prefix, one scroll)         rune   per rune (shop price 500)
 *   food   a pack of `n` dishes costs mul × n × the dish's own price        dye    the same, for a pack of dyes
 *   cos    by the piece's rarity 0–4
 */
const FAIR_PRICE = {
  gear: { base: 15000, ref: 30, pow: 1.35, step: 500 }, scroll: 40000, rune: 15000,
  food: { n: 5, mul: 5 }, dye: { n: 3, mul: 10 }, cos: [10000, 30000, 60000, 120000, 200000],
};
/** The legendary stock: how many pieces a day, over which item levels, from which slots (each at most once a day). */
const FAIR_GEAR = { n: [4, 6], il: [30, 190], types: ["weapon", "helm", "armor", "gloves", "boots", "ring", "amulet"] };
/** The dishes worth the trip, best first (a day sells FAIR_FOOD.pick of the ones that exist). */
const FAIR_FOOD = { pool: ["fd_feast", "food_l", "fd_steam", "food_v", "food_c", "fd_honeybread", "fd_stew"], pick: 5 };

const fairGearPrice = (il) => { const P = FAIR_PRICE.gear; return Math.round((P.base * Math.pow(il / P.ref, P.pow)) / P.step) * P.step; };
/** The dice of one vendor on one KST day: same day, same vendor, same stock (every call starts from a fresh box). */
function fairBox(day, v) {
  const b = { seed: Math.imul(day, 0x9e3779b1) ^ Math.imul(FAIR_VENDORS.indexOf(v) + 1, 0x85ebca6b) };
  rnd(b); rnd(b);
  return b;
}
/** `k` of `list`, shuffled by the box (the list itself is left alone). */
function fairPick(box, list, k) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = ri(box, 0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, k);
}
/** A pack of `n` of item `id`: its row id is the item id (a vendor never lists one twice). */
const fairPack = (id, n, price) => ({ id, it: id, n, price });

/** 전설 장비: n pieces on n different slots; piece i takes its item level from the i-th of n equal bands of FAIR_GEAR.il. */
function fairGear(box) {
  const [lo, hi] = FAIR_GEAR.il, n = ri(box, FAIR_GEAR.n[0], FAIR_GEAR.n[1]);
  return fairPick(box, FAIR_GEAR.types, n).map((type, i) => {
    const il = Math.round(lo + ((i + rnd(box)) * (hi - lo)) / n);
    const tier = G_REQ.filter((r) => r <= il).length;   // the highest tier whose level the piece has reached
    const id = type === "weapon" ? `w_${WK_ID[WK_ORDER[ri(box, 0, WK_ORDER.length - 1)]]}_${tier}` : `${GEAR[type].pre}_${tier}`;
    const g = rollGear(box, id, 3, Math.ceil((il + 3) / 4));   // (the power comes from the live pool, 51-prefix.js pfxPick)
    return { id: `l${i}`, g, price: fairGearPrice(g.il) };
  });
}
/** 룬: the three runes of one of the 3-rune words (피의 맹세, 불멸) and two others. */
function fairRunes(box) {
  const words = RUNEWORDS.filter((w) => w.seq.length === 3), word = words[ri(box, 0, words.length - 1)];
  const more = fairPick(box, RUNE_KEYS.filter((k) => !word.seq.includes(k)), 2);
  return [...word.seq, ...more].map((k) => fairPack(`ru_${k}`, 1, FAIR_PRICE.rune));
}
/** The rows vendor `v` sells on KST day `day`: { id (product), price, and g (a gear piece) | it + n (items) | cos (a cosmetic) }. */
function fairStock(day, v) {
  const box = fairBox(day, v), P = FAIR_PRICE;
  switch (v) {
    case "leg": return fairGear(box);
    case "scr": return fairPick(box, Object.keys(ITEMS).filter((k) => k.startsWith("es_")).sort(), 4).map((id) => fairPack(id, 1, P.scroll));
    case "rune": return fairRunes(box);
    case "cos": return fairPick(box, COS_IDS.filter((id) => COSMETICS[id].src === "fair" && !id.endsWith(`_${FAIR_SET[seasonOf(day * DAY_MS - KST)]}`)), 4).map((id) => ({ id, cos: id, price: P.cos[COSMETICS[id].q] }));
    case "food": return fairPick(box, FAIR_FOOD.pool.filter((id) => Object.hasOwn(ITEMS, id)), FAIR_FOOD.pick).map((id) => fairPack(id, P.food.n, P.food.mul * P.food.n * ITEMS[id].price));
    case "dye": return fairPick(box, COS_DYES, 4).map((id) => fairPack(id, P.dye.n, P.dye.mul * P.dye.n * ITEMS[id].price));
    default: return [];
  }
}

/** The product ids this sheet bought on KST day `day`. */
const fairBought = (ch, day) => (Object.hasOwn(ch.fairBuy, day) ? ch.fairBuy[day] : []);
/** A saved `fairBuy` cleaned (migrate): only the newest day, its product ids as short unique strings; an old sheet starts empty. */
function fairBuyClean(v) {
  if (!isObj(v)) return {};
  const days = Object.keys(v).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d < 1e7).sort((a, b) => b - a);
  if (!days.length) return {};
  const ids = Array.isArray(v[days[0]]) ? [...new Set(v[days[0]].filter((x) => typeof x === "string" && x.length <= 32))].slice(0, 32) : [];
  return { [days[0]]: ids };
}

/** The vendor `v`'s NPC when `p` stands within reach of it on 버드나무 마을 (the 56 px every NPC has), else null. */
function fairVendorAt(p, v) {
  if (typeof v !== "string" || !FAIR_VENDORS.includes(v) || p.map !== FAIR.map) return null;
  return mapOfS(p.S, p.map).npcs.find((n) => n.id === fairNpcId(v) && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < 56) || null;
}
/** `fair_open {v}` and `fair_shop {v, i, d}` (see the head of this file). */
function fairMktValidate(S, p, a) {
  const ch = p.ch;
  if (!fairOpen(S.now)) return bad("장날이 아닙니다");
  if (!fairVendorAt(p, a.v)) return bad("장날 상인이 너무 멉니다");
  if (a.t === "fair_open") return OK;
  const day = kstDay(S.now);
  if (a.d !== day) return bad("장날 목록이 바뀌었습니다. 창을 다시 열어 주세요");
  const row = Number.isInteger(a.i) ? fairStock(day, a.v)[a.i] : null;
  if (!row) return bad("그런 상품은 없습니다");
  if (fairBought(ch, day).includes(row.id)) return bad("이미 구매한 상품입니다 (상품마다 한 사람에 한 번)");
  if (row.cos && ch.cos.own.includes(row.cos)) return bad("이미 가지고 있는 외형입니다");
  if (ch.gold < row.price) return bad("골드가 부족합니다");
  if (row.g ? ch.inv.length >= bagCap(ch) : row.it && !canAdd(ch, row.it, row.n)) return bad("가방이 가득 찼습니다");
  return OK;
}
function fairMktApply(S, p, a) {
  if (a.t === "fair_open") { p.fmSend = a.v; return; }
  const ch = p.ch, day = kstDay(S.now), row = fairStock(day, a.v)[a.i];
  ch.gold -= row.price;
  let name;
  if (row.g) { ch.inv.push(row.g); name = gearName(row.g); p.gain.push(["item", row.g.id, 1, row.g.q]); sys(S, `${ch.name}님이 장날 상인에게서 전설 장비 [${name}]${pp(name, "을를")} 샀습니다!`); }
  else if (row.it) { addItem(ch, row.it, row.n); name = `${ITEMS[row.it].name} ×${row.n}`; p.gain.push(["item", row.it, row.n, 0]); }
  else { giveCos(S, p, row.cos, ""); name = COSMETICS[row.cos].name; }
  ch.fairBuy = { [day]: [...fairBought(ch, day), row.id] };
  p.fmSend = a.v;
  p.dirty = true;
  toast(p, `[${name}]${pp(name, "을를")} ${row.price.toLocaleString()}G에 샀습니다.`);
}
/**
 * snapshot `fm` (once per window open and after a purchase): [vendor, KST day, the market's closing time in epoch ms, rows, ids bought
 * today]; a row is [id, price, 0, gear piece] · [id, price, 1, item id, n] · [id, price, 2, cosmetic id].
 */
function fairMktWire(S, p, v) {
  if (!fairOpen(S.now) || !fairVendorAt(p, v)) return null;
  const day = kstDay(S.now);
  const rows = fairStock(day, v).map((r) => (r.g ? [r.id, r.price, 0, r.g] : r.cos ? [r.id, r.price, 2, r.cos] : [r.id, r.price, 1, r.it, r.n]));
  return [v, day, day * DAY_MS - KST + FAIR.close * 3600000, rows, fairBought(p.ch, day)];
}
