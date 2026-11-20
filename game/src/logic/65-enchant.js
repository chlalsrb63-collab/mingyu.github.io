// ───────────────────────────── enchant scrolls, extraction hammer & rune fusion (ITM-02, ITM-08) ─────────────────────────────
// ITM-02: Red/Green/Blue enchant scrolls roll a live prefix (LEGEND) by category (O/D/U) onto equipped gear;
//         추출의 마법망치 extracts a legendary/unique prefix from bag gear into ch.enc for 100% imprint onto another piece.
// ITM-08: Fuse 3 runes of the same rarity (1→2, 2→3, 3→4) into a random rune of the next higher rarity;
//         룬 해체석 extracts a socketed rune safely back into the bag without destroying it.

Object.assign(ITEMS, {
  enc_atk: { name: "붉은 인챈트 주문서", type: "tool", q: 2, price: 3000, desc: "대장장이에게 건네 장착한 희귀 이상 장비에 공격형(O) 전설 접두사를 부여하거나 변경합니다." },
  enc_def: { name: "초록 인챈트 주문서", type: "tool", q: 2, price: 3000, desc: "대장장이에게 건네 장착한 희귀 이상 장비에 방어형(D) 전설 접두사를 부여하거나 변경합니다." },
  enc_util: { name: "푸른 인챈트 주문서", type: "tool", q: 2, price: 3000, desc: "대장장이에게 건네 장착한 희귀 이상 장비에 유틸형(U) 전설 접두사를 부여하거나 변경합니다." },
  enc_hammer: { name: "추출의 마법망치", type: "tool", q: 3, price: 8000, desc: "대장장이에게 건네 가방 속 전설·유니크 장비의 접두사를 추출해 보관합니다. (장비는 소멸)" },
  rune_chisel: { name: "룬 해체석", type: "tool", q: 2, price: 2500, desc: "대장장이에게 건네 장착한 장비 소켓의 룬을 파괴하지 않고 가방으로 회수합니다." },
});

const ENC_CAT = { enc_atk: "O", enc_def: "D", enc_util: "U" };
const ENC_SCROLLS = Object.keys(ENC_CAT);
const ENC_MAX = 20;
const ENC_COST = { scroll: 1500, imprint: 2500, extract: 3000, craft: 2000 };
const RUNE_FUSE_COST = [0, 1000, 3000, 8000];
const RUNE_EXTRACT_COST = 1000;

/** Clean persisted extracted prefix list on a character sheet. */
function encClean(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((k) => typeof k === "string" && Object.hasOwn(LEGEND, k) && PFX[k] && PFX[k].on && !PFX[k].off).slice(0, ENC_MAX);
}

/** Live prefix keys eligible for gear type `type` and category `cat` ("O" | "D" | "U"). */
function encPool(type, cat) {
  const L = SLOT_L[type];
  const live = (k) => PFX[k] && PFX[k].on && !PFX[k].off && LEGEND[k][3] === cat;
  let pool = Object.keys(LEGEND).filter((k) => live(k) && (!L || LEGEND[k][2].includes(L)));
  if (!pool.length) pool = Object.keys(LEGEND).filter(live);
  return pool;
}

/** Count runes of rarity `q` in the bag (summing stacks). */
function countRunesByRarity(ch, q) {
  let n = 0;
  for (const s of ch.inv) if (RUNES[s.id]?.q === q) n += s.n || 1;
  return n;
}

/** All rune IDs belonging to rarity `q` (for q === 4, flatten all set-rune tiers). */
function runePoolAll(q) {
  if (q === 4) return [...RUNE_POOLS[4][2], ...RUNE_POOLS[4][3], ...RUNE_POOLS[4][4]];
  return RUNE_POOLS[q] || [];
}

function encValidate(S, p, a) {
  const ch = p.ch;
  if (p.dead) return bad("쓰러진 상태입니다");
  if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
  switch (a.t) {
    case "enc_apply": {
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (g.cu === 1) return bad("저주받은 장비는 인챈트할 수 없습니다");
      if ((g.q | 0) < 2) return bad("희귀 등급 이상 장비만 인챈트할 수 있습니다");
      const tier = ITEMS[g.id].tier || 1;
      if (a.src === "imprint") {
        const list = ch.enc || [];
        if (!Number.isInteger(a.i) || a.i < 0 || a.i >= list.length) return bad("보관된 접두사가 없습니다");
        const lg = list[a.i];
        const L = SLOT_L[ITEMS[g.id].type];
        if (!LEGEND[lg] || (L && !LEGEND[lg][2].includes(L))) return bad("이 장비 부위에는 이식할 수 없는 접두사입니다");
        const cost = ENC_COST.imprint * tier;
        return ch.gold < cost ? bad(`골드가 부족합니다 (${cost.toLocaleString()}G 필요)`) : OK;
      }
      if (!ENC_SCROLLS.includes(a.id)) return bad("인챈트 주문서가 아닙니다");
      if (countItem(ch, a.id) < 1) return bad(`${ITEMS[a.id].name}가 부족합니다`);
      const cost = ENC_COST.scroll * tier;
      return ch.gold < cost ? bad(`골드가 부족합니다 (${cost.toLocaleString()}G 필요)`) : OK;
    }
    case "enc_extract": {
      const g = invAt(ch, a.s);
      if (!g || !isGear(g.id)) return bad("추출할 장비가 아닙니다");
      if ((g.q | 0) < 3 || !g.lg || !Object.hasOwn(LEGEND, g.lg)) return bad("전설 접두사가 있는 장비만 추출할 수 있습니다");
      if (g.cu === 1) return bad("저주받은 장비에서는 추출할 수 없습니다");
      if (countItem(ch, "enc_hammer") < 1) return bad("추출의 마법망치가 없습니다");
      if ((ch.enc || []).length >= ENC_MAX) return bad(`접두사 보관함이 가득 찼습니다 (최대 ${ENC_MAX}개)`);
      const cost = ENC_COST.extract * (ITEMS[g.id].tier || 1);
      return ch.gold < cost ? bad(`골드가 부족합니다 (${cost.toLocaleString()}G 필요)`) : OK;
    }
    case "enc_craft": {
      if (!ENC_SCROLLS.includes(a.from) || !ENC_SCROLLS.includes(a.to) || a.from === a.to) return bad("변환할 주문서를 올바르게 선택하세요");
      if (countItem(ch, a.from) < 2) return bad(`${ITEMS[a.from].name} 2장이 필요합니다`);
      if (ch.gold < ENC_COST.craft) return bad(`골드가 부족합니다 (${ENC_COST.craft.toLocaleString()}G 필요)`);
      return canAdd(ch, a.to, 1) ? OK : bad("가방이 가득 찼습니다");
    }
    case "rune_fuse": {
      const q = a.q | 0;
      if (q < 1 || q > 3) return bad("합성할 수 없는 룬 등급입니다");
      if (countRunesByRarity(ch, q) < 3) return bad(`${RUNE_RARITY[q]} 룬 3개가 필요합니다`);
      const cost = RUNE_FUSE_COST[q];
      if (ch.gold < cost) return bad(`골드가 부족합니다 (${cost.toLocaleString()}G 필요)`);
      // After removing 3 runes, at least 1 slot is guaranteed or bag has space
      return ch.inv.length <= bagCap(ch) ? OK : bad("가방이 가득 찼습니다");
    }
    case "rune_extract": {
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= g.ru.length || !g.ru[a.i]) return bad("회수할 룬이 없습니다");
      if (countItem(ch, "rune_chisel") < 1) return bad("룬 해체석이 없습니다");
      if (ch.gold < RUNE_EXTRACT_COST) return bad(`골드가 부족합니다 (${RUNE_EXTRACT_COST.toLocaleString()}G 필요)`);
      const rid = runeSocketId(g.ru[a.i]), ril = runeSocketLevel(g.ru[a.i]);
      return canAdd(ch, rid, 1, ril) ? OK : bad("가방이 가득 찼습니다");
    }
    default: return bad("잘못된 요청입니다");
  }
}

function encApply(S, p, a) {
  const ch = p.ch;
  switch (a.t) {
    case "enc_apply": {
      const g = ch.eq[a.k], it = ITEMS[g.id], tier = it.tier || 1;
      let nextLg = "";
      if (a.src === "imprint") {
        ch.gold -= ENC_COST.imprint * tier;
        nextLg = ch.enc.splice(a.i, 1)[0];
      } else {
        ch.gold -= ENC_COST.scroll * tier;
        takeItem(ch, a.id, 1);
        const pool = encPool(it.type, ENC_CAT[a.id]);
        const choices = pool.length > 1 ? pool.filter((k) => k !== g.lg) : pool;
        nextLg = choices[ri(S, 0, choices.length - 1)];
      }
      g.lg = nextLg;
      if ((g.q | 0) < 3) {
        g.q = 3;
        const used = new Set(g.af.map((x) => x[0]));
        if (g.af.length < 4) g.af.push(rollGearLine(S, rollAffixKey(S, it.type, used), g));
      }
      afterGear(S, p);
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `인챈트 완료: [${LEGEND[nextLg][0]} ${it.name}]!`);
      break;
    }
    case "enc_extract": {
      const g = ch.inv[a.s], it = ITEMS[g.id], lg = g.lg;
      ch.gold -= ENC_COST.extract * (it.tier || 1);
      ch.inv.splice(a.s, 1);
      takeItem(ch, "enc_hammer", 1);
      (ch.enc ||= []).push(lg);
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `접두사 [${LEGEND[lg][0]}] 추출 완료! 대장간 보관함에 저장되었습니다.`);
      break;
    }
    case "enc_craft": {
      ch.gold -= ENC_COST.craft;
      takeItem(ch, a.from, 2);
      addItem(ch, a.to, 1);
      p.gain.push(["item", a.to, 1, 2]);
      toast(p, `[${ITEMS[a.to].name}] 1장으로 변환했습니다.`);
      break;
    }
    case "rune_fuse": {
      const q = a.q | 0;
      ch.gold -= RUNE_FUSE_COST[q];
      let need = 3, maxIl = 1;
      for (let i = ch.inv.length - 1; i >= 0 && need > 0; i--) {
        const s = ch.inv[i];
        if (RUNES[s.id]?.q !== q) continue;
        const take = Math.min(need, s.n || 1);
        maxIl = Math.max(maxIl, runeIl(s.il));
        s.n = (s.n || 1) - take;
        if (s.n <= 0) ch.inv.splice(i, 1);
        need -= take;
      }
      const pool = runePoolAll(q + 1);
      const outId = pool[ri(S, 0, pool.length - 1)];
      addItem(ch, outId, 1, maxIl);
      foundItem(S, p, outId, 1);
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `룬 합성 성공! [${RUNE_RARITY[q + 1]}] ${ITEMS[outId].name} (iLv.${maxIl}) 획득!`);
      break;
    }
    case "rune_extract": {
      const g = ch.eq[a.k], sock = g.ru[a.i];
      const rid = runeSocketId(sock), ril = runeSocketLevel(sock);
      ch.gold -= RUNE_EXTRACT_COST;
      takeItem(ch, "rune_chisel", 1);
      g.ru[a.i] = null;
      addItem(ch, rid, 1, ril);
      p.gain.push(["item", rid, 1, stackQuality(rid)]);
      afterGear(S, p);
      toast(p, `[${ITEMS[rid].name}]을(를) 손상 없이 회수했습니다.`);
      break;
    }
  }
  p.dirty = true;
  saveSoon(p);
}

function encDefs() {
  return { scrolls: ENC_SCROLLS, cat: ENC_CAT, max: ENC_MAX, cost: ENC_COST, runeFuse: RUNE_FUSE_COST, runeExtract: RUNE_EXTRACT_COST };
}
