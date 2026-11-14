/**
 * What the townsfolk say. Each of them has a handful of lines, chosen by who
 * is asking (level, the main quest, the hour) and rotated so that talking twice
 * does not repeat the same thing. The server only knows each NPC's role and a
 * single greeting; this is flavour and advice, nothing it has to agree with.
 */

/** Lines by role; `{n}` is the player's name. A function gets the player's sheet. */
const LINES = {
  shop: [
    "물약은 넉넉히 챙기게, {n}. 작은 것, 큰 것, 진한 것 — 모자란 만큼 골라 마시면 된다네.",
    "모닥불 꾸러미 하나면 사냥터 한가운데서도 쉬어 갈 수 있다네.",
    "귀환 주문서는 비상용이야. 읽는 동안 맞으면 끊기니 조용한 곳에서!",
    (s) => (s.lvl < 10 ? "초원에서 얻은 잡동사니는 여기서 팔면 돼. 장비는 대장간에서 분해해도 쓸모가 있고." : "단축칸에 물약을 올려 두면 숫자 키 하나로 마실 수 있지. 편하다고들 하더군."),
  ],
  smith: [
    "강화석은 몬스터가 떨어뜨리기도 하고, 장비를 분해해서 얻기도 하지.",
    "+5부터는 실패하면 한 단계 내려갈 수 있어. 각오가 됐을 때 두드리게.",
    "홈이 난 장비에 룬을 순서대로 맞춰 끼우면 룬어가 깨어난다네.",
    (s) => `그 ${s.eq && s.eq.weapon ? "무기로" : "맨손으로"} 어디까지 가려고? 한번 보여 주게.`,
  ],
  elder: [
    "균열이 열린 뒤로 짐승들이 이상하게 돌아왔지. 자네 같은 이가 있어 다행이야.",
    (s) => (s.qDone ? "오, 해냈군! 의뢰 창에서 [의뢰 완료]를 누르고 보상을 받아 가게." : s.q && s.q.st === 1 ? "의뢰는 잘 되어 가나? 다 마치면 다시 찾아오게." : "새 의뢰가 있다네. 의뢰 창에서 읽어 보고 수락하게."),
    (s) => (s.qDone ? "보상은 의뢰 창 아래 [의뢰 완료] 버튼이라네. 잊지 말고 받아 가게." : "반복 의뢰는 언제든 받을 수 있네. 강화석이 모자라면 해 보게."),
  ],
  train: [
    "스킬 레벨은 경험치와 골드로 올리지. 5레벨과 10레벨에 재사용 대기시간이 줄어든다네.",
    "배운 스킬은 K 창에서 아래 단축칸으로 끌어다 놓게. 자동사냥은 단축칸의 스킬만 쓴다네.",
    "힘·체력·지력·수호 수련은 레벨이 오를수록 비싸지. 꾸준히 하게.",
  ],
  bank: [
    "창고는 채널이 달라도 같은 창고라네. 안심하고 맡기게.",
    "가방이 꽉 찼다면 가방 위의 [정리] 버튼부터 눌러 보게. 같은 물건끼리 한 묶음이 되지.",
  ],
  talk: [
    "동쪽 문은 바람초원, 서쪽 문은 네온 시티야. 문 이름 옆의 레벨을 보고 가!",
    "막다른 길엔 보물 상자나 모닥불이 있을 때가 많아. 샛길을 그냥 지나치지 마.",
    "엘리트는 몸 색이 다르고 머리 위에 표식이 있어. 혼자라면 물러서는 것도 용기지.",
    "파티를 맺으면 /p 로 파티원끼리만 이야기할 수 있어. 채팅창의 파티 탭에서 써도 되고.",
    (s) => (s.lvl >= 15 ? "요즘 균열 침공이 잦아. 알림이 뜨면 이동의 돌로 달려가!" : "물가에서 F를 누르면 낚시를 할 수 있어. 구운 생선은 꽤 든든하다고."),
  ],
  warp: [
    "돌은 한 번 깨우면 잊지 않는다네. 새 사냥터에 가면 입구 근처부터 살펴보게.",
    "싸우는 중에는 건너갈 수 없어. 숨을 고르고 오게.",
  ],
  collector: [
    "도감의 그림자는 같은 몬스터를 서른 마리 잡아야 걷히지.",
    "한 지역을 다 채우면 그 땅이 힘을 빌려준다네. 초원부터 해 보게.",
  ],
  achieve: [
    "칭호는 업적 창에서 골라 달 수 있네. 어떤 칭호는 능력치도 조금 올려 주지.",
    "강화 성공, 전설 장비, 룬어 — 비석은 모두 기억한다네.",
  ],
  daily: [
    "과제는 매일 아침 6시에 바뀌네. 세 개를 다 하면 보너스 상자가 열리지!",
    "과제 보상은 U 키로 언제든 받을 수 있어.",
  ],
  costume: [
    "외형은 능력치를 바꾸지 않아요. 마음껏 꾸며 보세요!",
    "무기 외형도 있어요. 휘두르는 모습이 달라 보일걸요?",
  ],
};

const said = new Map();
/** The next line for this NPC, or null if they have nothing to add. */
export function lineFor(npc, s) {
  // a service NPC from the map editor (the cafe, the inn, the town hall) speaks its own lines in turn
  const list = Array.isArray(npc.lines) && npc.lines.length ? npc.lines : LINES[npc.role];
  if (!list || !s) return null;
  // the elder opens with the quest line (what to do next); everyone else starts anywhere
  const i = (said.get(npc.name) ?? (npc.role === "elder" ? 1 : Math.floor(Math.random() * list.length))) % list.length;
  said.set(npc.name, i + 1);
  const l = list[i];
  return (typeof l === "function" ? l(s) : l).replaceAll("{n}", s.name);
}
/** Every line for a talking NPC, the server's greeting first. */
export function allLines(npc, s) {
  // an NPC from the map editor says exactly what it was given
  if (Array.isArray(npc.lines) && npc.lines.length) return npc.lines.map((l) => (s ? l.replaceAll("{n}", s.name) : l));
  const out = npc.say ? [npc.say] : [];
  for (let k = 0; k < (LINES[npc.role] || []).length; k++) { const l = lineFor(npc, s); if (l && !out.includes(l)) out.push(l); }
  return out;
}
