import { drawBriefingArt } from "./coop-briefing-art.js";

// The server sends the actual job and tool assignment. These lines describe the opening action.
const GUIDES = {
  apt: {
    goal: "모두 쓰레기통을 들고 청소합니다",
    titles: ["쓰레기 줍기", "반납대에서 비우기"],
    steps: ["쓰레기 칸 위에서 F로 담아요.", "반납대에 가까이 가면 비워지고 점수가 올라요."],
    keys: "F 또는 화면의 [쓰레기 줍기] · 가득 차면 반납대로",
    walkthrough: [
      ["쓰레기 찾기", "병, 종이, 깡통과 껍질 위에 ‘쓰레기’ 표시가 떠요. 각자 다른 방을 맡으면 더 빨리 치울 수 있어요."],
      ["밟고 줍기", "쓰레기가 놓인 칸 위에 서면 [쓰레기 줍기]가 나타나요. F를 한 번 누르거나 버튼을 눌러 한 개씩 담으세요."],
      ["가득 차면 돌아가기", "쓰레기통에는 10개까지 들어가요. 가득 차면 알림이 뜨고 통이 반짝여요. 도중에 덜 찬 통도 비울 수 있어요."],
      ["반납대에서 득점", "초록색 반납대에 가까이 가면 자동으로 비우고, 반납한 개수만큼 팀 점수가 올라요. 전부 반납하거나 제한시간이 지나면 근무가 끝나요."],
    ],
  },
  diner: {
    goal: "모두 조리·서빙·정리를 할 수 있어요",
    titles: ["조리하기", "서빙하고 정리하기"],
    steps: ["말풍선의 메뉴를 보고 조리대에서 요리를 골라요.", "테이블에 요리를 내고 빈그릇은 싱크대로 가져가요."],
    keys: "작업할 곳에서 F · 빈그릇을 오래 두면 감점",
    walkthrough: [
      ["주문 확인", "손님이 테이블에 앉으면 말풍선에 원하는 요리 그림이 나와요. 기다리는 막대가 다 줄기 전에 음식을 내야 해요."],
      ["조리대에서 요리 선택", "비어 있는 조리대 두 곳 중 하나에서 F로 메뉴를 여세요. 방향키로 요리를 골라 F를 누르거나, 원하는 요리를 클릭하세요."],
      ["완성 요리를 들고 서빙", "몇 초 뒤 ‘완성’ 표시가 뜨면 조리대에서 F로 요리를 드세요. 같은 요리를 주문한 손님의 테이블에서 F로 제출하세요."],
      ["빈그릇 회수와 반납", "손님이 먹고 나면 테이블에 빈그릇이 남아요. F로 집어 싱크대에서 F로 반납하면 점수를 받아요. 오래 방치하면 감점돼요."],
      ["남은 요리 처리", "주문이 이미 끝났거나 잘못 들었다면 싱크대에서 F로 버릴 수 있어요. 한 사람은 한 번에 하나만 들 수 있어요."],
    ],
  },
  forge: {
    goal: "같은 모루에서 두 사람이 박자를 맞추세요",
    steps: ["주문 색에 맞는 주괴를 집어 모루에 올려요.", "모루에서 F로 시작해 동료와 박자를 맞춰요."],
    keys: "주괴·모루 F · 두 사람 모두 스페이스 · 완성품은 자동 제출",
    walkthrough: [
      ["주문에 맞는 금속 확인", "손님 말풍선의 완성품과 철·은·금·미스릴 색을 확인하세요. 4인이라면 두 명씩 모루 두 곳을 맡을 수 있어요."],
      ["집게가 주괴 올리기", "맞는 주괴상자에서 F로 한 개를 집어 빈 모루에서 F로 올리세요. 다른 금속을 집었다면 상자에서 F로 내려놓을 수 있어요."],
      ["망치가 합동 단조 시작", "집게와 망치 담당이 같은 모루 곁에 서세요. 망치 담당이 F를 누르면 양쪽 화면에 같은 박자 막대가 열려요."],
      ["두 사람이 같은 박자 누르기", "움직이는 음표가 밝은 판정 구간에 들어올 때 두 사람 모두 스페이스를 누르세요. 화면의 [박자 맞추기]도 사용할 수 있어요."],
      ["완성품 자동 납품", "두 사람 모두 맞힌 음표만 제작이 진행돼요. 놓치면 감점되고 해당 음표를 다시 맞춰야 해요. 필요한 박자를 모두 맞히면 손님에게 자동 납품돼요."],
    ],
  },
  alch: {
    goal: "가마 온도를 맞춰 물약을 만드세요",
    steps: ["풀무 앞에서 작업을 시작하고 방향키 음표에 맞춰 열을 올려요.", "약재를 순서대로 골라 솥에 넣고 물약을 진열해요."],
    keys: "작업 F · 음표와 약재 선택은 방향키",
    walkthrough: [
      ["온도 맞추기", "풀무 담당은 가마에서 F를 눌러 시작하고, 음표가 선에 닿을 때 알맞은 방향키를 눌러요. 온도계의 표시 구간에 맞추세요."],
      ["약재 고르기", "부채 담당은 주문 레시피의 색 순서대로 약재를 고른 뒤 솥에 F로 넣어요."],
      ["끓이기와 진열", "온도가 구간을 벗어나면 솥이 넘칠 수 있어요. 부채 담당이 F로 진정시키고, 완성한 물약은 진열대에 놓아요."],
    ],
  },
  lib: {
    goal: "모두 대출과 반납을 도울 수 있어요",
    titles: ["대출하기", "반납하기"],
    steps: ["요청한 장르의 책을 꺼내 안내데스크에 가져가요.", "안내데스크에서 책을 받아 같은 장르 책장에 꽂아요."],
    keys: "책장과 안내데스크에서 F · 말풍선의 장르를 확인하세요",
    walkthrough: [
      ["안내데스크에서 요청 확인", "손님 말풍선으로 대출과 반납, 책 장르를 구분하세요. 누구나 두 업무를 할 수 있어요."],
      ["대출 · 책장에서 데스크로", "말풍선과 같은 장르가 적힌 책장에서 F로 책을 꺼내세요. 손에 책을 든 채 안내데스크에서 F로 건네면 득점해요."],
      ["반납 · 데스크에서 책장으로", "반납 손님이 기다리면 안내데스크에서 F로 책을 받으세요. 책과 같은 장르의 책장에 가서 F로 꽂으면 득점해요."],
      ["한 권씩 정확하게", "잘못된 장르의 책장에는 꽂을 수 없어요. 대출 손님이 먼저 떠나면 책을 꺼낸 장르 책장에서 F로 돌려놓으세요."],
    ],
  },
};

let panel, clock, shown, details, opener;

export const hasWalkthrough = (kind) => !!GUIDES[kind]?.walkthrough;

export function setWorkPrompt(button, label, key = "F") {
  if (button.dataset.action === label && button.dataset.controlKey === key) return;
  button.dataset.action = label;
  button.dataset.controlKey = key;
  button.textContent = label;
  if (!key) return;
  const kbd = document.createElement("kbd");
  kbd.textContent = key;
  button.prepend(kbd);
}

export function closeWalkthrough(restore = false) {
  if (!details || details.hidden) return false;
  details.hidden = true;
  if (restore && opener?.isConnected && opener.getClientRects().length) opener.focus();
  opener = null;
  return true;
}

export function openWalkthrough(kind, job, trigger) {
  const guide = GUIDES[kind];
  if (!job || !guide?.walkthrough) return;
  if (!details) {
    details = document.createElement("section");
    details.id = "coop-guide";
    details.className = "frame";
    details.setAttribute("aria-labelledby", "coop-guide-title");
    details.innerHTML = `<header><h2 id="coop-guide-title"></h2><button class="btn" type="button">닫기</button></header>
      <div class="cgd-body"><div class="cgd-key"><kbd>F</kbd><p>작업 위치에서 누르거나 화면에 뜨는 작업 버튼을 클릭하세요. 근무 중에는 제한시간이 계속 흐릅니다.</p></div><ol></ol></div>`;
    details.querySelector("button").addEventListener("click", () => closeWalkthrough(true));
    document.querySelector("#hud").append(details);
  }
  opener = trigger || null;
  details.querySelector("h2").textContent = job[0] + " 진행 방법";
  const list = details.querySelector("ol");
  list.replaceChildren();
  guide.walkthrough.forEach(([label, text]) => {
    const step = document.createElement("li");
    const title = document.createElement("b");
    title.textContent = label;
    const copy = document.createElement("p");
    copy.textContent = text;
    step.append(title, copy);
    list.append(step);
  });
  details.hidden = false;
  details.querySelector(".cgd-body").scrollTop = 0;
  details.querySelector("button").focus();
}

export function hideBriefing() {
  if (panel) panel.hidden = true;
  shown = null;
}

function makePanel() {
  const el = document.createElement("section");
  el.id = "coop-briefing";
  el.className = "frame";
  el.setAttribute("aria-labelledby", "coop-briefing-title");
  el.innerHTML = `<header><h2 id="coop-briefing-title"></h2><span>준비 <b></b>초</span></header>
    <p class="cb-goal"></p><div class="cb-roles"></div>
    <footer><p class="cb-keys"></p><button class="btn" type="button">진행 방법</button></footer>`;
  document.querySelector("#hud").append(el);
  return el;
}

export function renderBriefing(snap, coop, you) {
  if (!("cj" in snap)) return; // Unchanged summaries arrive as omitted fields.
  const cj = snap.cj;
  if (!cj || cj[1] !== 0) return hideBriefing();
  const kind = coop?.kinds[cj[0]];
  const guide = GUIDES[kind], job = coop?.jobs[kind];
  const mine = cj[10]?.find(([eid]) => eid === you)?.[1];
  if (!guide || !job || (mine !== 0 && mine !== 1)) return hideBriefing();

  panel ||= makePanel();
  const key = kind + ":" + mine;
  if (key !== shown) {
    shown = key;
    panel.dataset.kind = kind;
    panel.querySelector("h2").textContent = job[0];
    panel.querySelector(".cb-goal").textContent = guide.goal;
    panel.querySelector(".cb-keys").textContent = guide.keys;
    const button = panel.querySelector("footer button");
    button.hidden = !hasWalkthrough(kind);
    button.onclick = () => openWalkthrough(kind, job, button);
    const roles = panel.querySelector(".cb-roles");
    roles.replaceChildren();
    const titles = guide.titles || job[2].map((tool, role) => (role === mine ? "내 역할 · " : "동료 · ") + coop.tools[tool]);
    titles.forEach((label, role) => {
      if (role) {
        const link = document.createElement("span");
        link.className = "cb-link";
        link.setAttribute("aria-hidden", "true");
        link.textContent = guide.link || "→";
        roles.append(link);
      }
      const card = document.createElement("div");
      card.className = "cb-role";
      if (!guide.titles && role === mine) card.classList.add("cb-mine");
      const art = document.createElement("canvas");
      art.setAttribute("aria-hidden", "true");
      drawBriefingArt(art, kind, role);
      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = label;
      const step = document.createElement("p");
      step.textContent = guide.steps[role];
      copy.append(title, step);
      card.append(art, copy);
      roles.append(card);
    });
    clock = panel.querySelector("header b");
  }
  clock.textContent = cj[2];
  panel.hidden = false;
}
