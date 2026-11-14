// ───────────────────────────── actions ─────────────────────────────

function npcNear(p, role) {
  for (const n of MAPS[p.map].npcs) {
    if (n.role === role && dist(p.x, p.y, n.x * T + 8, n.y * T + 12) < 56) return true;
  }
  return false;
}
const bad = (error) => ({ ok: false, error });
const OK = { ok: true };
function enhCost(g) {
  const tier = ITEMS[g.id].tier;
  return { gold: 60 * tier * (g.enh + 1), stone: g.enh < 3 ? 1 : g.enh < 6 ? 2 : 3 };
}
function trainTotal(have, n) {
  let c = 0;
  for (let i = 0; i < n; i++) c += trainCost(have + i);
  return c;
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
  switch (a.t) {
    case "respawn":
      if (!p.dead) return bad("살아 있습니다");
      if (a.here && countItem(ch, "feather") < 1) return bad("부활 깃털이 없습니다");
      return OK;
    case "opt": {
      // settings kept with the character: loot filter, auto-potion thresholds (percent)
      const okPct = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 90);
      if (a.filter !== undefined && !(Number.isInteger(a.filter) && a.filter >= 0 && a.filter < FILTER_Q.length)) return bad("잘못된 필터");
      if (!okPct(a.ahp) || !okPct(a.amp)) return bad("잘못된 설정값");
      return OK;
    }
    case "look": {
      // a new look at the mirror in town, for gold
      if (!Array.isArray(a.look) || a.look.length > LOOK_MAX.length || !a.look.every((v, i) => Number.isInteger(v) && v >= 0 && v <= LOOK_MAX[i])) return bad("잘못된 외형");
      if (!MAPS[p.map].safe) return bad("마을에서만 외형을 바꿀 수 있습니다");
      if (ch.gold < LOOK_COST) return bad(`골드가 부족합니다 (${LOOK_COST}G)`);
      return OK;
    }
    case "chat":
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      return OK;
    case "pinv": {
      const o = byEid(S, a.e);
      if (!o || o === p) return bad("대상을 찾을 수 없습니다");
      const party = S.parties[p.party];
      if (party && party.m.length >= PARTY_MAX) return bad("파티가 가득 찼습니다");
      if (o.party) return bad("이미 다른 파티에 속해 있습니다");
      if (o.pinv && now - o.pinv.at < 15000) return bad("상대가 다른 초대에 응답 중입니다");
      return OK;
    }
    case "pacc": {
      const inv = p.pinv;
      const from = inv && now - inv.at < 30000 ? S.players[inv.from] : null;
      if (!from) return bad("유효한 초대가 없습니다");
      if (p.party) return bad("이미 파티에 속해 있습니다");
      const party = S.parties[from.party];
      if (party && party.m.length >= PARTY_MAX) return bad("파티가 가득 찼습니다");
      return OK;
    }
    case "pdec": return OK;
    case "pleave": return p.party ? OK : bad("파티에 속해 있지 않습니다");
    case "gcreate":
      if (ch.guild) return bad("이미 길드에 속해 있습니다");
      if (!validName(a.name)) return bad("길드 이름은 한글·영문·숫자 2~10자로 지어 주세요");
      if (ch.gold < GUILD_COST) return bad(`길드 창설에는 ${GUILD_COST}G가 필요합니다`);
      return OK;
    case "ginv": {
      const o = byEid(S, a.e);
      if (!ch.guild) return bad("길드에 속해 있지 않습니다");
      if (!o || o === p) return bad("대상을 찾을 수 없습니다");
      if (o.ch.guild) return bad("이미 길드에 속해 있습니다");
      if (o.ginv && now - o.ginv.at < 15000) return bad("상대가 다른 초대에 응답 중입니다");
      return OK;
    }
    case "gacc":
      if (ch.guild) return bad("이미 길드에 속해 있습니다");
      return p.ginv && now - p.ginv.at < 30000 ? OK : bad("유효한 초대가 없습니다");
    case "gdec": case "glist": return OK;
    case "gleave": return ch.guild ? OK : bad("길드에 속해 있지 않습니다");
    case "gchat":
      if (!ch.guild) return bad("길드에 속해 있지 않습니다");
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      return OK;
    case "pchat":
      if (!S.parties[p.party]) return bad("파티에 속해 있지 않습니다");
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      return OK;
    case "qs": {
      // set slot i to v, or swap slots i and j
      const slot = (i) => Number.isInteger(i) && i >= 0 && i < QS_N;
      if (!slot(a.i)) return bad("없는 단축칸");
      if (a.j !== undefined) return slot(a.j) ? OK : bad("없는 단축칸");
      return qsOk(ch, a.v === undefined ? null : a.v) ? OK : bad("단축칸에 놓을 수 없습니다");
    }
    case "sort": return ch.inv.length > 1 ? OK : bad("정리할 것이 없습니다");
    case "jam":
      if (a.k !== 0 && a.k !== 1) return bad("없는 동작");
      if (!p.sit) return bad("앉아서 할 수 있습니다");
      if (a.k === 1 && !fireNear(S.maps[p.map], p)) return bad("모닥불 곁에서 할 수 있습니다");
      return now - p.emoAt < JAM_CD ? bad("잠시 후에") : OK;
    case "emo":
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= EMOTES) return bad("없는 감정표현");
      return now - p.emoAt < 600 ? bad("잠시 후에") : OK;
    // the wardrobe: wear something owned, take a slot off, or buy at the costume shop
    case "cos_eq":
      if (typeof a.id !== "string" || !Object.hasOwn(COSMETICS, a.id)) return bad("없는 외형입니다");
      if (!ch.cos.own.includes(a.id)) return bad("아직 얻지 않은 외형입니다");
      return ch.cos.on[COSMETICS[a.id].slot] === a.id ? bad("이미 입고 있습니다") : OK;
    case "cos_off":
      if (!COS_SLOTS.includes(a.s)) return bad("잘못된 부위");
      return ch.cos.on[a.s] ? OK : bad("입은 외형이 없습니다");
    case "cos_buy": {
      const c = typeof a.id === "string" && Object.hasOwn(COSMETICS, a.id) ? COSMETICS[a.id] : null;
      if (!c || c.src !== "shop") return bad("팔지 않는 외형입니다");
      if (!npcNear(p, "costume")) return bad("의상실 주인이 너무 멉니다");
      if (ch.cos.own.includes(a.id)) return bad("이미 가지고 있습니다");
      return ch.gold < c.price ? bad("골드가 부족합니다") : OK;
    }
    case "title":
      if (a.id === "" || a.id === undefined || a.id === null) return OK;
      if (typeof a.id !== "string" || !ACH_BY[a.id] || !ACH_BY[a.id].title) return bad("없는 칭호입니다");
      return ch.ach.includes(a.id) ? OK : bad("아직 얻지 않은 칭호입니다");
    case "daily": {
      ensureDaily(S, p);
      const dl = ch.daily;
      if (a.i === "bonus") {
        if (dl.bonus) return bad("이미 보상을 받았습니다");
        if (!dl.claimed.every(Boolean)) return bad("세 과제의 보상을 모두 받아야 합니다");
        return ch.inv.length + 2 <= INV ? OK : bad("가방이 가득 찼습니다");
      }
      const t = Number.isInteger(a.i) ? dl.tasks[a.i] : null;
      if (!t) return bad("없는 과제입니다");
      if (dl.claimed[a.i]) return bad("이미 보상을 받았습니다");
      if (t.n < t.need) return bad("아직 과제를 마치지 못했습니다");
      return canAdd(ch, "stone", 1) ? OK : bad("가방이 가득 찼습니다");
    }
    case "tut": {
      const step = TUT[ch.tut.i];
      if (!step || step.id !== a.s || (a.s !== "talk" && a.s !== "bag")) return bad("지금 할 단계가 아닙니다");
      if (a.s === "talk" && !npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      return OK;
    }
  }
  if (p.dead) return bad("쓰러진 상태입니다");
  switch (a.t) {
    case "mv":
      if (!num(a.x) || !num(a.y)) return bad("잘못된 좌표");
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      return OK;
    case "atk":
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      if (p.dance) return bad("그림자 무도 중입니다");
      if (now - p.atkAt < atkCd(p) - 60) return bad("아직 공격할 수 없습니다");
      return OK;
    case "warp": {
      if (typeof a.to !== "string" || !WP[a.to]) return bad("그곳에는 이동의 돌이 없습니다");
      if (!wpNear(p)) return bad("이동의 돌 곁에서만 이동할 수 있습니다");
      if (!ch.wp.includes(a.to)) return bad("아직 깨우지 않은 이동의 돌입니다");
      if (a.to === p.map) return bad("이미 이곳에 있습니다");
      if (now - p.hitAt < WARP_CALM) return bad("전투 중에는 이동할 수 없습니다");
      return OK;
    }
    case "sk": {
      const sk = Number.isInteger(a.i) ? SKILLS[ch.cls][a.i] : null;
      if (!sk) return bad("없는 스킬");
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      if (ch.lvl < sk.lv) return bad(`레벨 ${sk.lv}에 배울 수 있습니다`);
      if (p.dance) return bad("그림자 무도 중입니다");
      if (now < p.cds[a.i]) return bad("재사용 대기 중입니다");
      if (p.mp < skMp(p, a.i)) return bad("MP가 부족합니다");
      return OK;
    }
    case "use": {
      const it = ITEMS[a.id];
      if (!it || !["pot", "food", "camp", "scroll", "buff", "pet"].includes(it.type)) return bad("사용할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (it.type === "buff" || it.type === "pet") return OK;
      if (it.type === "scroll") {
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
      const s = ch.inv[a.s];
      if (!s || !isGear(s.id)) return bad("장착할 수 없습니다");
      const it = ITEMS[s.id];
      if (it.cls && it.cls !== ch.cls) return bad("다른 직업의 장비입니다");
      if (ch.lvl < it.req) return bad(`레벨 ${it.req}부터 착용할 수 있습니다`);
      if (a.k !== undefined && !slotsFor(it.type).includes(a.k)) return bad("그 부위에는 착용할 수 없습니다");
      return OK;
    }
    case "uneq":
      if (!SLOTS.includes(a.k)) return bad("잘못된 부위");
      if (!ch.eq[a.k]) return bad("장착한 장비가 없습니다");
      if (ch.inv.length >= INV) return bad("가방이 가득 찼습니다");
      return OK;
    case "rune": {
      const s = ch.inv[a.s];
      if (!s || ITEMS[s.id].type !== "rune") return bad("룬이 아닙니다");
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= g.sk) return bad("빈 홈이 없습니다");
      return OK;
    }
    case "train": {
      if (!TRAIN[a.k]) return bad("잘못된 능력치");
      const n = a.n | 0;
      if (n !== 1 && n !== 10) return bad("잘못된 횟수");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (ch.xp < trainTotal(ch.tr[a.k], n)) return bad("경험치가 부족합니다");
      return OK;
    }
    case "sklv": {
      const sk = Number.isInteger(a.i) ? SKILLS[ch.cls][a.i] : null;
      if (!sk) return bad("없는 스킬");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (ch.lvl < sk.lv) return bad(`레벨 ${sk.lv}에 배울 수 있습니다`);
      const L = ch.skl[a.i];
      if (L >= SK_MAX) return bad("이미 최고 레벨입니다");
      const c = skillCost(sk, L);
      if (ch.lvl < c.lvl) return bad(`캐릭터 레벨 ${c.lvl}부터 올릴 수 있습니다`);
      if (ch.gold < c.gold) return bad("골드가 부족합니다");
      if (ch.xp < c.xp) return bad("경험치가 부족합니다");
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
      const from = a.a === "put" ? ch.inv : a.a === "take" ? wh.items : null;
      if (!from) return bad("잘못된 요청입니다");
      const sl = Number.isInteger(a.s) ? from[a.s] : null;
      if (!sl) return bad("아이템이 없습니다");
      const n = isGear(sl.id) ? 1 : a.n | 0;
      if (n < 1 || n > (sl.n || 1)) return bad("잘못된 수량");
      if (a.a === "put") return whRoom(wh, sl.id, n) ? OK : bad("창고가 가득 찼습니다");
      return (isGear(sl.id) ? ch.inv.length < INV : canAdd(ch, sl.id, n)) ? OK : bad("가방이 가득 찼습니다");
    }
    case "sellall":
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      return ch.inv.some(junk) ? OK : bad("팔 일반 장비가 없습니다");
    case "buy": {
      if (!SHOP.includes(a.id)) return bad("팔지 않는 물건입니다");
      const n = a.n | 0;
      if (n < 1 || n > STACK) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      const id = resolveItem(a.id, ch.cls);
      if (ITEMS[id].cls && ITEMS[id].cls !== ch.cls) return bad("다른 직업의 장비입니다");
      if (ch.gold < ITEMS[id].price * n) return bad("골드가 부족합니다");
      if (!canAdd(ch, id, n)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "sell": {
      const s = ch.inv[a.s];
      if (!s) return bad("아이템이 없습니다");
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
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      const c = enhCost(g);
      if (ch.gold < c.gold) return bad("골드가 부족합니다");
      if (countItem(ch, "stone") < c.stone) return bad("강화석이 부족합니다");
      return OK;
    }
    case "sit": return OK;
    case "fish":
      if (p.fish) return bad("이미 낚시 중입니다");
      if (now - p.hitAt < 3000) return bad("싸우는 중에는 낚시할 수 없습니다");
      if (MAPS[p.map].nofish) return bad("이곳에서는 낚시를 할 수 없습니다");
      if (!waterNear(MAPS[p.map], p)) return bad("물가에서만 낚시할 수 있습니다");
      if (!canAdd(ch, "fish_s", 1)) return bad("가방이 가득 찼습니다");
      return OK;
    case "hook": return p.fish && p.fish.bite && !p.fish.hook ? OK : bad("아직 입질이 없습니다");
    case "reel": return p.fish ? OK : bad("낚시 중이 아닙니다");
    case "cook": {
      const it = ITEMS[a.id];
      if (!it || it.type !== "fish") return bad("요리할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (!fireNear(S.maps[p.map], p)) return bad("모닥불 곁에서만 요리할 수 있습니다");
      if (!canAdd(ch, it.cook, 2) || !canAdd(ch, "burnt", 1)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "salv": {
      const s = ch.inv[a.s];
      if (!s || !isGear(s.id)) return bad("분해할 수 없는 아이템");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      if (!canAdd(ch, "stone", 12)) return bad("가방이 가득 찼습니다");
      return OK;
    }
    case "bq": {
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      if (a.a === "take") {
        const d = MOBS[a.k];
        if (typeof a.k !== "string" || !d || d.boss || d.chest) return bad("그런 의뢰는 없습니다");
        if (d.lv > ch.lvl + 4) return bad("아직 감당하기 어려운 상대입니다");
        return OK;
      }
      if (a.a === "done") return ch.bq && ch.bq.n >= ch.bq.need ? OK : bad("아직 의뢰를 마치지 못했습니다");
      return bad("잘못된 요청입니다");
    }
    case "sq": return sqValidate(S, p, a);
    case "quest": {
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      const quest = QUESTS[ch.q.i];
      if (!quest) return bad("모든 의뢰를 마쳤습니다");
      if (a.a === "accept") return ch.q.st === 0 ? OK : bad("이미 진행 중입니다");
      if (a.a === "done") {
        if (ch.q.st !== 1 || ch.q.n < quest.n) return bad("아직 의뢰를 마치지 못했습니다");
        for (const [id, n] of quest.items) if (!canAdd(ch, id, n)) return bad("가방을 비우고 다시 오세요");
        return OK;
      }
      return bad("잘못된 요청입니다");
    }
    default:
      return bad("알 수 없는 행동");
  }
}

