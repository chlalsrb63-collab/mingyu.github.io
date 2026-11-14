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
 * Sources: shop (sold for `price` gold), chest, boss, daily, rift, ach (earned with achievement `price`).
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
].map(([id, n, slot, name, q, src, price, desc]) => [id, { n, slot, name, q, src, price: src === "shop" ? price : 0, ach: src === "ach" ? price : "", desc }]));
const COS_IDS = Object.keys(COSMETICS);
const COS_BY_N = Object.fromEntries(COS_IDS.map((id) => [COSMETICS[id].n, id]));
const COS_ACH = Object.fromEntries(COS_IDS.filter((id) => COSMETICS[id].ach).map((id) => [COSMETICS[id].ach, id]));
/** The chance a looted chest, or a downed field boss or guardian, holds a cosmetic. */
const COS_CHEST = 0.08, COS_BOSS = 0.15, COS_RIFT_TOP3 = 0.3;
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
  if (COSMETICS[id].q >= 3) sys(S, `${ch.name}님이 외형 [${COSMETICS[id].name}]을(를) 얻었습니다!`);
  p.dirty = true;
  return true;
}
/** A cosmetic from one source's pool the character does not own yet, if any is left. */
function cosFrom(S, p, src, why) {
  const left = COS_IDS.filter((id) => COSMETICS[id].src === src && !p.ch.cos.own.includes(id));
  if (!left.length) return false;
  return giveCos(S, p, left[Math.floor(cosRoll(S, p, src) * left.length)], why);
}

