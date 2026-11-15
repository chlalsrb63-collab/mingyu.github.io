// ───────────────────────────── cosmetics (외형) ─────────────────────────────
// Hats, tops, back pieces, face accessories and weapon skins change only how a
// character looks. They are not bag items: each character keeps a wardrobe of
// everything it owns (`ch.cos.own`) and wears one per slot (`ch.cos.on`). Some are
// sold at the costume shop in town; the rest only come from opening chests,
// field bosses and guardians, the daily reward box, the rift invasion and
// achievements. The art lives in the browser (public/wardrobe.js, weapons.js),
// keyed by the same ids.

/** The cosmetic slots, in the order the wire sends them. */
const COS_SLOTS = ["hat", "top", "back", "face", "wskin"];
const COS_SLOT_NAME = { hat: "모자", top: "상의", back: "등", face: "얼굴", wskin: "무기 외형" };
/**
 * id → [wire code, slot, name, rarity 0–4, source, price or achievement id, description].
 * Sources: shop (sold for `price` gold), chest, boss, daily, rift, ach (earned with achievement `price`: the
 * Lv-50 life masters' outfits and the NPCs' 가족 gifts are these), quest (a chance on every quest hand-in) and weekly
 * (a chance with a boss challenge's weekly big reward). An optional ninth field is the themed set (COS_SETS).
 * Codes are what the wire carries: never reuse or renumber one.
 */
const COSMETICS = Object.fromEntries([
  ["hat_beanie_red", 1, "hat", "빨간 비니", 0, "shop", 800, "폭신한 털실 모자. 귀는 구멍으로 쏙."],
  ["hat_beanie_navy", 2, "hat", "남색 비니", 0, "shop", 800, "차분한 남색 털실 모자."],
  ["hat_beanie_mint", 3, "hat", "민트 비니", 0, "shop", 800, "상큼한 민트색 털실 모자."],
  ["hat_straw", 4, "hat", "밀짚모자", 0, "shop", 1200, "챙 넓은 여름 모자. 빨간 리본이 달렸다."],
  ["hat_straw_blue", 5, "hat", "파란 리본 밀짚모자", 1, "chest", 0, "보물 상자 속에서 나온 밀짚모자."],
  ["hat_wizard", 6, "hat", "마법사 모자", 1, "shop", 3000, "끝이 꺾인 보랏빛 고깔모자."],
  ["hat_wizard_night", 7, "hat", "밤하늘 마법사 모자", 2, "boss", 0, "우두머리가 쓰던 별빛 고깔모자."],
  ["hat_crown", 8, "hat", "황금 왕관", 3, "ach", "boss", "균열의 군주를 쓰러뜨린 자의 왕관."],
  ["hat_crown_silver", 9, "hat", "은빛 왕관", 2, "rift", 0, "균열 침공을 막아 낸 보답."],
  ["hat_wreath_pink", 10, "hat", "벚꽃 화관", 1, "shop", 2000, "분홍 꽃을 엮은 화관."],
  ["hat_wreath_sun", 11, "hat", "해바라기 화관", 1, "daily", 0, "일일 과제 보상 상자에서 나온 화관."],
  ["hat_bow_red", 12, "hat", "빨간 리본", 0, "shop", 1000, "머리 위의 커다란 리본."],
  ["hat_bow_pink", 13, "hat", "분홍 리본", 0, "shop", 1000, "머리 위의 커다란 분홍 리본."],
  ["hat_cap_blue", 14, "hat", "파란 야구모자", 0, "shop", 900, "챙이 바라보는 쪽을 따라간다."],
  ["hat_cap_red", 15, "hat", "빨간 야구모자", 0, "chest", 0, "보물 상자 속 야구모자."],
  ["hat_tricorn", 16, "hat", "해적 모자", 2, "chest", 0, "해골 무늬 삼각모."],
  ["hat_santa", 17, "hat", "산타 모자", 1, "daily", 0, "방울이 달랑거리는 빨간 모자."],
  ["hat_helm", 18, "hat", "기사 투구", 2, "ach", "elite100", "정예 사냥꾼에게 주어지는 깃털 투구."],
  ["hat_frog", 19, "hat", "개구리 모자", 1, "ach", "fish10", "낚시꾼들 사이에서 유행하는 모자."],
  ["hat_halo", 20, "hat", "천사의 고리", 3, "rift", 0, "머리 위에 떠 있는 빛의 고리."],
  ["hat_horns", 21, "hat", "꼬마 악마 뿔", 2, "boss", 0, "귀여운 척하는 작은 뿔."],
  ["hat_chef", 22, "hat", "요리사 모자", 1, "ach", "cook10", "요리를 열 번 성공한 자의 모자."],
  ["hat_beret", 23, "hat", "빨간 베레모", 0, "shop", 1500, "비스듬히 눌러 쓴 베레모."],
  ["hat_beret_black", 24, "hat", "검은 베레모", 1, "shop", 2500, "화가의 검은 베레모."],
  ["top_overalls", 25, "top", "멜빵바지", 0, "shop", 1200, "단추 두 개가 반짝이는 청 멜빵바지."],
  ["top_hoodie_grey", 26, "top", "회색 후드티", 0, "shop", 1000, "편안한 회색 후드티."],
  ["top_hoodie_pink", 27, "top", "분홍 후드티", 0, "shop", 1000, "편안한 분홍 후드티."],
  ["top_sailor", 28, "top", "세일러복", 1, "shop", 2500, "줄무늬와 빨간 스카프."],
  ["top_armor", 29, "top", "기사 흉갑", 2, "ach", "guard1", "던전 수문장을 쓰러뜨린 증표."],
  ["top_robe", 30, "top", "마법사 로브", 1, "shop", 3000, "금실 장식의 보랏빛 로브."],
  ["top_robe_green", 31, "top", "숲의 로브", 2, "chest", 0, "이끼 냄새가 나는 초록 로브."],
  ["top_dress_pink", 32, "top", "분홍 드레스", 1, "shop", 2800, "허리에 리본을 묶은 드레스."],
  ["top_dress_white", 33, "top", "하얀 드레스", 2, "daily", 0, "하늘색 리본의 하얀 드레스."],
  ["top_suit", 34, "top", "정장", 2, "ach", "lv30", "베테랑 모험가의 정장과 넥타이."],
  ["top_hanbok", 35, "top", "색동 한복", 2, "shop", 6000, "노랑 저고리에 붉은 치마, 고름까지."],
  ["top_vest", 36, "top", "털 조끼", 1, "boss", 0, "우두머리의 털로 지은 조끼."],
  ["top_pajama", 37, "top", "별무늬 잠옷", 1, "ach", "rest10", "모닥불 곁에서 꾸벅꾸벅."],
  ["back_cape_red", 38, "back", "붉은 망토", 1, "shop", 4000, "걸음마다 펄럭이는 망토."],
  ["back_cape_blue", 39, "back", "푸른 망토", 1, "shop", 4000, "걸음마다 펄럭이는 푸른 망토."],
  ["back_cape_black", 40, "back", "칠흑 망토", 2, "boss", 0, "수문장이 두르던 검은 망토."],
  ["back_angel", 41, "back", "천사 날개", 3, "rift", 0, "균열을 막아 낸 자에게 돋는 날개."],
  ["back_bat", 42, "back", "박쥐 날개", 2, "chest", 0, "보물 상자에 숨어 있던 날개."],
  ["back_fairy", 43, "back", "요정 날개", 2, "daily", 0, "반짝이는 작은 날개."],
  ["back_pack", 44, "back", "모험가 배낭", 0, "shop", 1500, "뭐든 들어갈 것 같은 가죽 배낭."],
  ["back_dragon", 45, "back", "용의 날개", 3, "ach", "abyss", "심연을 넘은 자의 날개."],
  ["face_glasses", 46, "face", "동그란 안경", 0, "shop", 700, "똑똑해 보이는 안경."],
  ["face_glasses_gold", 47, "face", "금테 안경", 1, "ach", "col1", "도감 하나를 채운 학자의 안경."],
  ["face_shades", 48, "face", "선글라스", 1, "shop", 1800, "햇빛도 몬스터도 무섭지 않다."],
  ["face_patch", 49, "face", "안대", 1, "chest", 0, "한쪽 눈을 가린 해적 안대."],
  ["face_bandage", 50, "face", "반창고", 0, "shop", 300, "볼에 붙인 반창고."],
  ["face_mask", 51, "face", "마스크", 0, "shop", 400, "하얀 천 마스크."],
  ["face_heart", 52, "face", "하트 스티커", 1, "daily", 0, "양 볼의 하트."],
  ["face_monocle", 53, "face", "외알 안경", 2, "ach", "hunt1000", "숙련된 사냥꾼의 외알 안경."],
  ["face_stache", 54, "face", "콧수염", 1, "chest", 0, "멋지게 말린 콧수염."],
  ["ws_sakura", 55, "wskin", "벚꽃 무기 외형", 2, "shop", 8000, "어떤 무기든 벚꽃빛으로. 꽃잎이 흩날린다."],
  ["ws_frost", 56, "wskin", "서리 무기 외형", 2, "boss", 0, "날 끝에 얼음 가시가 돋는다."],
  ["ws_candy", 57, "wskin", "사탕 무기 외형", 1, "daily", 0, "줄무늬 사탕 같은 무기."],
  ["ws_bone", 58, "wskin", "해골 무기 외형", 2, "chest", 0, "뼈로 깎은 듯한 무기."],
  ["ws_star", 59, "wskin", "별빛 무기 외형", 3, "rift", 0, "밤하늘을 담은 무기."],
  ["ws_flame", 60, "wskin", "화염 무기 외형", 3, "ach", "enh10", "명장의 무기는 불꽃을 두른다."],
  // ── themed sets (the ninth field is the set, COS_SETS): the seaside
  ["hat_sunhat", 61, "hat", "해변 밀짚모자", 1, "shop", 2400, "챙이 축 늘어진 큰 모자. 꽃 한 송이를 꽂았다.", "sea"],
  ["face_snorkel", 62, "face", "스노클", 1, "shop", 2000, "물안경과 숨대롱. 뭍에서도 쓰고 다닌다.", "sea"],
  ["top_shell", 63, "top", "조개 목걸이", 0, "shop", 1200, "바닷가에서 주운 조개를 꿴 목걸이.", "sea"],
  ["top_swim", 64, "top", "줄무늬 수영복", 1, "shop", 2600, "파란 줄무늬 수영복.", "sea"],
  ["back_surf", 65, "back", "서핑보드", 2, "shop", 7000, "제 키보다 큰 보드를 등에 멨다.", "sea"],
  ["ws_coral", 66, "wskin", "산호 무기 외형", 2, "shop", 8000, "산호빛 날에 물거품이 맺힌다.", "sea"],
  // the desert
  ["hat_turban", 67, "hat", "사막 터번", 1, "shop", 3000, "모래바람을 막는 터번. 이마에 보석 하나.", "desert"],
  ["hat_goggles", 68, "hat", "모래바람 고글", 1, "chest", 0, "이마에 올려 쓴 놋쇠 고글.", "desert"],
  ["back_cape_sand", 69, "back", "모래 망토", 1, "shop", 4000, "모래 언덕 빛깔의 망토.", "desert"],
  ["back_gourd", 70, "back", "물 호리병", 0, "shop", 1500, "사막을 건널 때는 물부터.", "desert"],
  ["ws_dune", 71, "wskin", "모래바람 무기 외형", 2, "boss", 0, "모래 물결이 날을 타고 흐른다.", "desert"],
  // the jungle
  ["hat_pith", 72, "hat", "탐험가 모자", 1, "shop", 2800, "밀림 탐험가의 둥근 모자.", "jungle"],
  ["top_safari", 73, "top", "탐험가 셔츠", 1, "shop", 2800, "주머니 많은 셔츠와 빨간 목수건.", "jungle"],
  ["face_paint", 74, "face", "밀림 얼굴 분장", 0, "shop", 600, "양 볼에 그은 풀빛 줄무늬.", "jungle"],
  // the eastern temple
  ["hat_bamboo", 75, "hat", "삿갓", 1, "shop", 3200, "대나무로 엮은 넓은 삿갓.", "temple"],
  ["top_dopo", 76, "top", "쪽빛 도포", 2, "shop", 6500, "허리띠를 맨 긴 쪽빛 도포.", "temple"],
  ["top_beads", 77, "top", "염주", 1, "chest", 0, "오래된 사원의 나무 염주.", "temple"],
  ["face_fox", 78, "face", "여우 탈", 2, "quest", 0, "붉은 무늬를 그린 흰 여우 탈.", "temple"],
  ["ws_bamboo", 79, "wskin", "대나무 무기 외형", 2, "shop", 8000, "마디가 진 푸른 대나무 무기.", "temple"],
  // the brick dungeon
  ["hat_miner", 80, "hat", "광부 안전모", 1, "shop", 2600, "이마에 등불을 단 노란 안전모.", "delver"],
  ["back_lantern", 81, "back", "탐험 등불", 2, "boss", 0, "등 뒤 장대 끝에서 흔들리는 등불.", "delver"],
  ["top_delver", 82, "top", "가죽 멜빵", 1, "chest", 0, "주머니가 줄줄이 달린 탐험가의 멜빵.", "delver"],
  // life skill masters: one per skill at Lv 50 (ACH life50_<skill>)
  ["hat_fisher", 83, "hat", "명인의 낚시 모자", 3, "ach", "life50_fish", "낚시 명인의 벙거지. 찌 하나를 꽂았다.", "master"],
  ["top_chefcoat", 84, "top", "명인의 조리복", 3, "ach", "life50_cook", "단추가 두 줄인 새하얀 조리복.", "master"],
  ["back_basket", 85, "back", "명인의 채집 바구니", 3, "ach", "life50_gather", "약초가 넘치는 등바구니.", "master"],
  ["top_smith", 86, "top", "명인의 대장 앞치마", 3, "ach", "life50_craft", "불똥 자국이 남은 두꺼운 가죽 앞치마.", "master"],
  ["top_alch", 87, "top", "명인의 연금 외투", 3, "ach", "life50_alch", "약병 띠를 두른 연금술사의 외투.", "master"],
  ["back_satchel", 88, "back", "명인의 배달 가방", 3, "ach", "life50_deliver", "편지가 삐죽 나온 배달부의 가방.", "master"],
  // NPC trust: a gift at 가족 (ACH rep_<npc>)
  ["top_apron_juju", 89, "top", "쥬쥬의 앞치마", 2, "ach", "rep_juju", "쥬쥬가 손수 지어 준 분홍 앞치마.", "family"],
  ["back_hammer", 90, "back", "캉캉의 큰 망치", 2, "ach", "rep_kangkang", "캉캉이 쓰던 망치. 등에 메면 든든하다.", "family"],
  ["hat_goggles_bogle", 91, "hat", "보글의 실험 고글", 2, "ach", "rep_bogle", "보글이 물려준 초록 고글.", "family"],
  ["top_apron_moka", 92, "top", "모카의 카페 앞치마", 2, "ach", "rep_cafe_moka", "커피 향이 밴 갈색 앞치마.", "family"],
  ["hat_nightcap", 93, "hat", "마루의 나이트캡", 2, "ach", "rep_inn_maru", "마루네 여관의 푹신한 잠자리 모자.", "family"],
  // the rift and the weekly challenge (weekly, quest: sources of systems still to come; nothing grants them yet)
  ["hat_shard", 94, "hat", "균열 파편 고리", 3, "rift", 0, "머리 위를 맴도는 균열의 파편.", "rift"],
  ["back_trophy", 95, "back", "우두머리 전리품", 3, "weekly", 0, "쓰러뜨린 우두머리의 뿔 달린 해골.", "rift"],
  ["ws_shard", 96, "wskin", "균열 파편 무기 외형", 3, "weekly", 0, "균열의 파편이 날에 박혀 빛난다.", "rift"],
  // just cute
  ["hat_wreath_blue", 97, "hat", "수국 화관", 1, "shop", 2000, "파란 수국을 엮은 화관.", "cute"],
  ["hat_wreath_white", 98, "hat", "데이지 화관", 1, "daily", 0, "하얀 데이지를 엮은 화관.", "cute"],
  ["top_scarf", 99, "top", "빨간 목도리", 0, "shop", 900, "한쪽 끝이 길게 늘어진 목도리.", "cute"],
  ["back_plush", 100, "back", "곰 인형 배낭", 1, "shop", 3500, "어깨 너머로 빼꼼 내다보는 곰 인형.", "cute"],
  ["ws_bee", 101, "wskin", "꿀벌 무기 외형", 1, "daily", 0, "노랑과 검정 줄무늬.", "cute"],
  ["back_batcape", 102, "back", "박쥐 망토", 3, "weekly", 0, "밤장막 박쥐군주의 날개를 본뜬 망토. 펄럭일 때마다 작은 박쥐가 숨는다.", "rift"],
  ["hat_bloodcrown", 103, "hat", "혈루 뿔 왕관", 3, "boss", 0, "혈루 왕도마뱀의 뿔을 깎아 만든 붉은 왕관. 아직 미지근하다."],
  ["ws_clubclaw", 104, "wskin", "갯가재 집게 무기 외형", 2, "boss", 0, "망치 갯가재의 집게를 씌운 무기. 휘두를 때마다 물이 튄다."],
].map(([id, n, slot, name, q, src, price, desc, set]) => [id, { n, slot, name, q, src, price: src === "shop" ? price : 0, ach: src === "ach" ? price : "", desc, set: set || "" }]));
/** The themed sets (a label in the wardrobe; wearing one whole gives nothing but the look). */
const COS_SETS = { sea: "바닷가", desert: "사막 여행자", jungle: "밀림 탐험가", temple: "동방 사원", delver: "던전 탐험가", master: "생활 명인", family: "가족의 선물", rift: "균열", cute: "포근포근" };
const COS_IDS = Object.keys(COSMETICS);
const COS_BY_N = Object.fromEntries(COS_IDS.map((id) => [COSMETICS[id].n, id]));
const COS_ACH = Object.fromEntries(COS_IDS.filter((id) => COSMETICS[id].ach).map((id) => [COSMETICS[id].ach, id]));
/** The chance a looted chest, or a downed field boss or guardian, holds a cosmetic. */
const COS_CHEST = 0.08, COS_BOSS = 0.15, COS_RIFT_TOP3 = 0.3, COS_WEEKLY = 0.35, COS_QUEST = 0.12;
const cosEmpty = () => ({ own: [], on: {} });
function cosClean(c, ch) {
  const src = isObj(c) ? c : {};
  const own = [...new Set((Array.isArray(src.own) ? src.own : []).filter((id) => typeof id === "string" && Object.hasOwn(COSMETICS, id)))];
  // what was earned through an achievement before the wardrobe existed comes along
  for (const id of ch.ach || []) if (COS_ACH[id] && !own.includes(COS_ACH[id])) own.push(COS_ACH[id]);
  const on = {};
  const was = isObj(src.on) ? src.on : {};
  for (const s of COS_SLOTS) if (typeof was[s] === "string" && own.includes(was[s]) && COSMETICS[was[s]].slot === s) on[s] = was[s];
  return { own, on };
}
/** What others see: the worn codes in slot order, trailing empties dropped ([] for none). */
function cosWire(ch) {
  const on = ch.cos ? ch.cos.on : {};
  const out = COS_SLOTS.map((s) => (on[s] ? COSMETICS[on[s]].n : 0));
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
/** A roll in [0, 1) for cosmetic finds, kept apart from the world's own random stream. */
function cosRoll(S, p, salt) {
  S.cosN = (S.cosN | 0) + 1;
  return (strHash(`${S.now}:${p.eid}:${salt}:${S.cosN}`) >>> 0) / 4294967296;
}
/** Give one cosmetic; false when it is already owned. */
function giveCos(S, p, id, why) {
  const ch = p.ch;
  if (!COSMETICS[id] || ch.cos.own.includes(id)) return false;
  ch.cos.own.push(id);
  toast(p, `외형 획득: [${COSMETICS[id].name}]${why ? ` — ${why}` : ""} (캐릭터 창 ‘외형’ 탭에서 입을 수 있습니다)`);
  p.gain.push(["cos", id]);
  if (COSMETICS[id].q >= 3) sys(S, `${ch.name}님이 외형 [${COSMETICS[id].name}]${pp(COSMETICS[id].name, "을를")} 얻었습니다!`);
  p.dirty = true;
  return true;
}
/** A cosmetic from one source's pool the character does not own yet, if any is left. */
function cosFrom(S, p, src, why) {
  const left = COS_IDS.filter((id) => COSMETICS[id].src === src && !p.ch.cos.own.includes(id));
  if (!left.length) return false;
  return giveCos(S, p, left[Math.floor(cosRoll(S, p, src) * left.length)], why);
}

