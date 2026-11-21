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
/** The gold factor of ENH_LATE for a tier-`tier` piece at +`enh` (1 for tiers 1–4). */
const enhLateK = (tier, enh) => 1 + ENH_LATE.tier * Math.max(0, tier - ENH_LATE.from) * (1 + ENH_LATE.stepK * Math.max(0, enh - ENH_LATE.step));
/** One try's price, and `unc` the smith's fee to lift a curse from this piece (the client shows both). */
function enhCost(g) {
  const tier = ITEMS[g.id].tier, k = enhLateK(tier, g.enh);
  return { gold: Math.round(60 * tier * (g.enh + 1) * k), stone: g.enh < 3 ? 1 : g.enh < 6 ? 2 : 3, unc: Math.round(UNCURSE_FEE * tier * k) };
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
  // charms keep to their own ways (66-charms.js)
  const cg = charmGuard(p.ch, a);
  if (cg) return bad(cg);
  // a 일일 아르바이트 shift (66-alba.js): the hero stays at the counter
  if (p.ab && !a.t.startsWith("ab_") && !ALBA_OK.has(a.t)) return bad("아르바이트 중에는 할 수 없습니다");
  // each action's own check lives in its ACTIONS row (72-actions.js)
  const h = Object.hasOwn(ACTIONS, a.t) ? ACTIONS[a.t] : null;
  if (!(h && h.down) && p.dead) return bad("쓰러진 상태입니다");
  return h ? h.check(S, p, a) : bad("알 수 없는 행동");
}
