/**
 * <Guide> tips: now and then a client-only line `<Guide> …` in mint (`#chat-log .guide`) lands in the 전체 and 시스템 chat tabs — a hint on
 * co-op jobs, stats, jobs, quests, life skills, gear, raids … (no server message: the line is added here with `addChat`). Words read the
 * live keymap (`K`) and `G.defs`, so a rebound key or a changed number reads right.
 * Behaviour: the first tip 45–90 s after entering the world, then one every 3–5 minutes, never two within 2 minutes (also across a reload),
 * only when it fits (a level or job gate in `when`) and the player is free: not dead, not in a minigame, not inside an instance (co-op shift,
 * raid), not typing, tab visible. The first four tips go out in order (the owner's own lines); then a random one of those not yet shown, until
 * all are, then again. Progress lives in localStorage per character (`lumentale:guide:<name>`); the 설정 → 게임 → 가이드 메시지 button turns
 * it off (`lumentale:guide` "0"). The cards of hints.js (first meetings) are not repeated here. `tick(t)` runs in the client's frame loop.
 */
import { G, $ } from "./state.js";
import { K } from "./keymap.js";
import { Sound } from "./audio.js";
import * as Mini from "./minigames.js";
import { addChat } from "./windows.js";
import { typing } from "./input.js";
import { SOFT } from "./statwin.js";

const LS = "lumentale:guide", LS_ST = (n) => `lumentale:guide:${n}`;
const FIRST = [45, 90], EVERY = [180, 300], GAP = 120;   // seconds
const GUIDE = { name: "", seen: [], at: 0, round: 0 };
const on = () => localStorage.getItem(LS) !== "0";

/** [id, text(d, self), when(d, self)?, first?] — `d` is G.defs, `s` is G.self; a tip without `when` fits everyone. */
const T = (id, text, when, first) => ({ id, text, when, first });
const mins = (ms) => Math.round(ms / 60000);
const free = (s) => s.job === "adventurer";
const lv = (n) => (d, s) => s.lvl >= n;
const jobsN = (d, kind) => Object.values(d.jobs).filter((j) => (kind ? j.kind === kind : j.kind !== "none")).length;
const coopSize = (d) => { const p = Object.keys(d.coop.parN).map(Number); return `${Math.min(...p)}~${Math.max(...p)}`; };

const TIPS = [
  // the owner's four, in his order
  T("coop1", () => "파티원들과 함께 협동 아르바이트를 플레이하고 경험치와 특별한 아이템을 획득해보세요!", null, true),
  T("stat1", () => `모은 경험치로 캐릭터 창(${K("char")})의 능력치 탭에서 스탯업을 하실 수 있습니다. (모닥불 곁이나 수련관 앞에서)`, null, true),
  T("jobs1", (d) => `테일즈테일즈에는 총 ${jobsN(d)}종의 직업이 있어요. 다양한 직업에 도전해보세요`, null, true),
  T("reset1", () => `직업과 스탯은 초기화가 가능합니다. 자세한 방법은 도움말(${K("help")})의 '스탯과 성장'에 있어요.`, null, true),
  // 협동 아르바이트
  T("coop2", (d) => `협동 아르바이트는 ${coopSize(d)}명 파티로만 할 수 있어요. 파티장이 가게 주인(머리 위 보라색 느낌표)에게 말을 걸어 시작해요.`),
  T("coop3", (d) => `협동 아르바이트의 보수는 등급(C·B·A·S)에 따라 달라져요. S등급이면 ×${d.coop.gradeK[3]} — 파티원과 호흡을 맞춰 보세요!`),
  T("coop4", () => "협동 아르바이트 보수는 같은 일을 하루 한 번만 받아요. 하지만 아직 못 받은 파티원이 있다면 함께 다시 도전해 줄 수 있어요."),
  T("coop5", (d) => `협동 아르바이트는 모두 ${Object.keys(d.coop.jobs).length}가지예요: ${Object.values(d.coop.jobs).map((j) => j[0]).join(" · ")}`),
  T("coop6", () => "협동 아르바이트 중에 가만히 서 있으면 '근무 태도 불량'으로 보수를 받지 못해요. 파티원과 함께 움직여 주세요!"),
  // 스탯과 초기화
  T("stat2", (d) => `능력치는 ${d.stats.map((x) => x[1]).join("·")} 여섯 가지예요. 능력치 위에 마우스를 올리면 영향을 주는 항목이 밝아져요.`),
  T("stat3", (d) => `능력치를 한 칸 올릴 때마다 레벨도 1씩 올라요. 최고 레벨은 ${d.maxLv}!`),
  T("stat4", () => `능력치는 ${SOFT[0]}과 ${SOFT[1]}을 넘기면 한 칸의 효과가 줄어들어요. 골고루 올리는 것도 방법이에요.`, lv(10)),
  T("reset2", () => "능력치만 되돌리고 싶다면 수련관 카이의 '망각의 의식'을 찾아가세요. 되새김 인장(연금공방 제작)과 골드로 투자한 경험치를 돌려받아요.", lv(10)),
  T("reset3", () => "전직관 아르센에게 전직 초기화 주문서와 골드를 내면 모험가로 돌아갈 수 있어요. 직업 레벨은 직업별로 그대로 남아요.", (d, s) => !free(s)),
  T("reset4", () => "레벨 초기화 주문서를 쓰면 레벨과 능력치만 1로 돌아가요. 숙련 · 장비 · 골드는 그대로예요.", lv(30)),
  T("reset5", () => "초기화 주문서는 사냥터 우두머리가 드물게 떨어뜨려요.", lv(20)),
  // 직업
  T("job2", (d) => `한 무기의 숙련이 ${d.jobWm}이 되면 광장의 전직관 아르센에게서 그 무기의 직업으로 전직할 수 있어요.`, (d, s) => free(s)),
  T("job3", (d) => `두 무기를 숙련 ${d.hybWm}씩 키우면 두 갈래 직업(${jobsN(d, "hybrid")}종)으로 전직할 수 있어요. 두 무기는 ${K("swap")} 으로 번갈아 써요.`),
  T("job4", () => `스킬 창(${K("skill")})의 '전직의 길' 탭에서 직업과 전직 조건을 한눈에 볼 수 있어요.`),
  T("job5", (d) => `스킬 칸은 액티브 ${d.jf.lo[0]}개 · 패시브 ${d.jf.lo[1]}개까지예요. 마을이나 모닥불 곁에서 스킬 창의 '스킬 칸' 탭으로 바꿔요.`, lv(10)),
  T("job6", () => "직업마다 직업 레벨이 따로 올라요. 다른 직업으로 갈아타도 기록은 남아 있어요.", (d, s) => !free(s)),
  T("job7", () => `보조 무기를 끼면 ${K("swap")} 으로 바꿔 들 수 있어요. 보조 무기도 숙련이 조금씩 올라요.`, lv(5)),
  // 퀘스트
  T("q1", () => "NPC 머리 위 표시의 색: 노랑은 주요 의뢰, 파랑은 서브 의뢰, 초록은 알바, 보라는 협동 아르바이트예요."),
  T("q2", () => `의뢰 창(${K("quest")})의 [추적] 단추를 누르면 목표까지 자동으로 걸어가요. ${K("track")} 키로도 시작하고 취소할 수 있어요.`),
  T("q3", (d) => `일일 토벌(${K("daily")})는 매일 오전 ${d.daily.resetKST}시에 새로 주어져요. 세 개를 모두 끝내면 보너스 상자!`),
  T("q4", (d) => `주간 수첩(${K("week")})은 ${d.social.week.boxes.length}칸 중 ${d.social.week.need}칸을 채우면 한 주가 완료돼요.`, lv(10)),
  T("q5", (d) => `반복 토벌은 관리자 엘더윈에게서 받아요. 같은 몬스터 ${d.bounty}마리를 잡고 보고하면 돼요.`, lv(5)),
  T("q6", () => "서브 의뢰는 마을 곳곳에 숨어 있어요. 파란 느낌표를 찾아보세요!"),
  // 알바
  T("a1", (d) => `알바 창(${K("alba")})에서 오늘의 일감을 볼 수 있어요. 일감은 마을회관의 알바 중개인 포포에게서 맡아요 (하루 최대 ${d.life.jbPay.perDay}개).`),
  T("a2", (d) => `알바는 ${d.life.jbGrade.name.join(" · ")} 난이도가 있어요. 어려울수록 보수가 ×${d.life.jbGrade.pay.join(" / ×")}로 커져요.`),
  T("a3", (d) => `긴급 알바는 ${d.life.jbRush.min}분 안에 끝내면 골드 ×${d.life.jbRush.bonus}! 늦어도 기본 보수는 받아요.`),
  T("a4", (d) => `알바를 마칠 때마다 의뢰한 NPC와 신뢰가 쌓여요. 단골(${d.life.rep.tier[0]}) · 친구(${d.life.rep.tier[1]}) · 가족(${d.life.rep.tier[2]})이 되면 혜택이 있어요.`),
  T("a5", (d) => `버드나무 마을에는 ${Object.values(d.life.chores).slice(0, 3).map((c) => c.name).join(", ")} 같은 마을 일거리도 있어요.`),
  // 생활 스킬
  T("l1", (d) => `생활 스킬은 ${d.life.names.join(" · ")} ${d.life.names.length}가지예요. 생활 창(${K("life")})에서 레벨을 확인해요.`),
  T("l2", () => `채집은 약초 · 광맥 · 통나무 곁에서 ${K("interact")}! '반짝!' 하는 순간에 한 번 더 누르면 대성공이 잘 나와요.`),
  T("l3", (d) => `한 번 캔 채집 지점은 ${mins(d.life.nodes.cd)}분 뒤에 다시 캘 수 있어요. 사람마다 따로 계산돼요.`),
  T("l4", () => `낚시는 물가에서 ${K("interact")}. 입질이 오면 물결이 찌에 닿는 박자에 맞춰 다시 눌러요.`),
  T("l5", () => "잡은 생선은 모닥불 곁에서 구워 먹을 수 있어요. 쥬쥬의 화덕에서는 더 많은 요리를 만들 수 있어요."),
  T("l6", () => `제작은 캉캉대장간의 캉캉, 연금은 보글연금공방의 보글 곁에서 ${K("interact")} 로 시작해요.`),
  T("l7", (d) => `재료는 가방이 아니라 재료 주머니에 쌓여요. 종류마다 ${d.life.pouch.max}개까지 담겨요.`),
  T("l8", (d) => `생활 레벨이 10 오를 때마다 한 등급 높은 재료를 다룰 수 있어요. ${d.life.max}레벨이면 '명인' 칭호!`),
  // 파티 · 길드 · 친구 · 거래
  T("p1", (d) => `파티는 최대 ${d.partyMax}명이에요. 다른 모험가를 클릭하면 파티 초대 · 거래 · 친구 추가 · 귓속말 메뉴가 열려요.`),
  T("p2", (d) => `가까이에서 함께 잡으면 경험치를 나눠 받아요 (2명 ${Math.round(d.fieldParty.share[1] * 100)}% · 3명 ${Math.round(d.fieldParty.share[2] * 100)}% · 4명 ${Math.round(d.fieldParty.share[3] * 100)}%씩).`),
  T("p3", () => "/p 메시지는 파티 채팅, /g 메시지는 길드 채팅이에요. 채팅창의 파티 · 길드 탭에서는 그 채널로 보내져요."),
  T("p4", (d) => `길드(${K("guild")})는 ${d.guildCost.toLocaleString("ko-KR")}G로 만들 수 있어요. 근처에 길드원이 있으면 사냥 경험치가 +${Math.round(d.guildXp * 100)}%씩 늘어요.`, lv(5)),
  T("p5", () => `/w 이름 메시지 로 귓속말을 보내고, ${K("reply")} 로 마지막 상대에게 답장해요.`),
  T("p6", (d) => `거래할 때는 골드도 함께 올릴 수 있어요. 서로 ${d.sx.tradeR}칸 안에 있어야 시작할 수 있어요.`),
  T("p7", (d) => `상대를 클릭해 가위바위보를 걸어 보세요! 서로 ${d.sx.gameR}칸 안에서, ${d.sx.pickMs / 1000}초 안에 골라야 해요.`),
  T("p8", () => "가방에서 Shift+클릭하면 아이템을 채팅에 링크할 수 있어요. 자랑하고 싶은 장비를 보여 주세요!"),
  T("p9", (d) => `${K("emote")} 키로 감정표현 ${d.emotes}종을 쓸 수 있어요. 앉은 채(${K("sit")}) ${K("jamB")} 는 연주, ${K("jamZ")} 는 건배!`),
  // 장비와 아이템
  T("i1", (d) => `장비 등급은 ${d.rarity.filter(Boolean).join(" · ")}예요. 전설과 유니크 장비는 이름 앞에 접두사가 붙어요.`),
  T("i2", (d) => `장비의 착용 레벨은 아이템 레벨 −${d.ilGap}이에요. 정보창에서 확인해 보세요.`),
  T("i3", () => "접두사(예: 뇌명의)는 전설 · 유니크 장비의 고유 효과예요. 같은 접두사는 아이템 레벨이 가장 높은 하나만 적용돼요.", lv(5)),
  T("i4", (d) => `아이템도감(${K("dex")})에서 접두사 ${d.pfxOn.length}종의 효과를 찾아볼 수 있어요.`, lv(5)),
  T("i5", () => "유니크 장비는 전설의 고유 효과에 더 강한 보조 옵션이 붙어요.", lv(10)),
  T("i6", (d) => `대장장이 볼칸에게서 강화석으로 장비를 +${d.enh.length}까지 강화할 수 있어요. +${d.enh.filter((r) => r >= 100).length}까지는 항상 성공해요!`, lv(5)),
  T("i7", () => "강화에 실패하면 한 단계 내려가고 저주를 받아요. 저주 해제 주문서로 풀 수 있어요.", lv(10)),
  T("i8", (d) => `가방에서 룬을 골라 장비 소켓에 끼워요. 같은 이름의 세트 룬을 모으면 세트 효과가 최대 ${d.runeSetMax}종 발동해요.`, lv(20)),
  T("i12", (d) => `${d.items[d.sockItem].name}은 볼칸의 의뢰 보상이나 드문 사냥 전리품으로 얻어요. 볼칸이 천공석과 골드를 받고 장착 장비의 소켓을 열어 줘요.`, (d, s) => !!d.sockItem && s.lvl >= 20),
  T("i9", (d) => `가방은 ${d.inv}칸에서 시작해 골드로 ${d.bag.step}칸씩 최대 ${d.invMax}칸까지 넓힐 수 있어요. 창고지기 도담에게는 ${d.whSlots}칸을 맡겨요.`),
  T("i10", () => `펫은 곁을 따라다니며 전리품을 주워 와요. 설정(${K("settings")})에서 아이템 필터와 자동 물약도 정해 보세요.`),
  T("i11", () => `단축칸 ${K("slot1")}~${K("slot9")} 에는 물약 · 음식 · 주문서도 올릴 수 있어요. 스킬 창이나 가방에서 끌어다 놓아요.`),
  // 전투와 월드
  T("c1", (d) => `${K("dash")} 대시는 ${d.dash[2] / 1000}초마다 쓸 수 있어요. 위험할 때 보는 쪽으로 빠르게 빠져나오세요.`),
  T("c2", (d) => `${d.streak[0] / 1000}초 안에 이어서 잡으면 연속 처치 — 경험치가 최대 +${d.streak[1] * 2}%까지 늘어요.`),
  T("c3", (d) => `사냥터마다 우두머리가 있어요. 쓰러뜨리면 ${mins(d.fbResp)}분 뒤 다시 나타나고, 가끔 보스 전리품(${K("trophy")})을 남겨요.`, lv(10)),
  T("c4", () => `${K("auto")} 자동사냥은 단축칸의 스킬을 칸 순서대로 써요. 스킬을 채워 둘수록 잘 싸워요.`),
  T("c5", () => "쓰러지면 쌓아 둔 경험치의 일부를 잃어요. 부활 깃털(보급상)이 있으면 그 자리에서 일어나요.", lv(5)),
  T("c6", (d) => `이동의 돌을 깨워 두면 ${K("interact")} 로 돌에서 돌로 순간이동할 수 있어요. 귀환 주문서는 ${d.recallMs / 1000}초 읽으면 광장으로 돌아가요.`),
  T("c7", () => "정예 몬스터는 이름 위 아이콘으로 특성을 알 수 있어요. 특성을 보고 싸움을 준비하세요."),
  // 레이드던전 · 이벤트 · 장날
  T("r1", (d) => `레이드던전은 광장 오벨리스크의 균열 지기 오르카에게서 파티장이 열어요. 최대 ${d.dim.party}명, ${d.dim.raid.floors}단 + 최종 보스!`, (d, s) => s.lvl >= d.dim.minLv),
  T("r2", (d) => `레이드던전은 ${mins(d.dim.limit)}분 안에 끝내야 해요. 단마다 게이지를 100%로 채우면 다음 단으로 가는 문이 열려요.`, (d, s) => s.lvl >= d.dim.minLv),
  T("r3", (d) => `레이드던전 보상은 하루 ${d.dim.raid.daily}번, 매주 첫 클리어에는 주간 보너스가 있어요.`, (d, s) => s.lvl >= d.dim.minLv),
  T("r4", (d) => `레이드던전에서 정예가 남기는 기둥(${Object.values(d.dim.pylons).map((p) => p[0]).join(" · ")})은 파티에게 도움을 줘요.`, (d, s) => s.lvl >= d.dim.minLv),
  T("r5", (d) => `균열 침공은 ${mins(d.event.every)}분마다 한 사냥터에 열려요. 오른쪽 위에 남은 시간이 보여요.`, lv(10)),
  T("r6", () => "보스 도전은 균열 지기에게서 보스 하나와 겨루는 모드예요. 보스마다 입장 레벨이 달라요.", (d, s) => s.lvl >= Math.min(...d.dim.chal.bosses.map((b) => b[2]))),
  T("f1", (d) => `매주 ${d.fair.days.map((n) => "일월화수목금토"[n] + "요일").join("·")} 저녁 ${d.fair.open}~${d.fair.close}시, 버드나무 마을 광장에 장날이 서요. 장날 토큰으로 계절 외형을 살 수 있어요.`),
  T("f3", (d) => `장날 저녁에는 떠돌이 상인들이 전설 장비 · 룬 · 의상 · 요리를 팔아요. 한정 상품이라 한 사람당 상품마다 한 번만 살 수 있고, ${d.fair.close - d.fair.open}시간 뒤 모두 떠나요!`),
  T("f2", (d) => `장날 토큰은 하루 최대 ${d.fair.cap}개예요. 장꾼 다래의 좌판에는 지금 계절의 외형만 나와요.`),
  // 도감 · 업적 · 꾸미기
  T("b1", (d) => `몬스터 도감(${K("collect")})은 같은 몬스터를 ${d.colNeed}마리 잡으면 등록돼요. 한 지역을 모두 채우면 영구 보너스!`),
  T("b2", (d) => `업적(${K("achieve")})은 ${d.achievements.length}개, 칭호는 ${d.achievements.filter((a) => a.title).length}개예요. 달성한 업적의 칭호를 골라 달 수 있어요.`),
  T("b3", (d) => `참 보드(${K("charm")})는 Lv.${d.charms.lv}부터 참감정사 주아나에게서 시작해요.`, (d, s) => s.lvl >= d.charms.lv),
  T("b4", () => `캐릭터 창(${K("char")})의 외형 탭에서 옷을 갈아입을 수 있어요. 의상실 주인 루루의 옷도 있어요.`),
  T("b5", (d) => `하우징 안내인 포근에게서 집을 마련할 수 있어요. ${d.house.tiers[1].name}은 ${d.house.tiers[1].price.toLocaleString("ko-KR")}G부터예요.`, lv(20)),
  // 화면과 설정
  T("u1", () => "창은 제목 줄을 끌어 옮길 수 있어요. 제목 줄의 작은 단추로 오른쪽 패널에 붙이거나 별도 창으로 띄워요."),
  T("u2", () => `설정(${K("settings")})의 조작 탭에서 모든 단축키를 바꿀 수 있어요.`),
  T("u3", () => "설정의 HUD 투명도로 패널의 바탕을 비치게 할 수 있어요. HUD 색상과 글자 크기도 바꿔 보세요."),
  T("u4", () => `궁금한 건 도움말(${K("help")})에서 찾아보세요. 검색창에 낱말을 넣으면 바로 찾아 줘요.`),
  T("u5", () => `이 <Guide> 메시지는 설정(${K("settings")})의 게임 탭에서 끌 수 있어요.`),
  T("u6", () => "채팅창의 시스템 탭에서는 시스템 메시지와 가이드만 모아 볼 수 있어요."),
];

function load(name) {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(LS_ST(name)) || "null"); } catch { /* private mode or a damaged value: start over */ }
  const ids = new Set(TIPS.map((t) => t.id));
  Object.assign(GUIDE, { name, seen: Array.isArray(o && o.seen) ? o.seen.filter((id) => ids.has(id)) : [], at: o && Number.isFinite(o.at) ? o.at : 0, round: o && o.round > 0 ? 1 : 0 });
}
function save() {
  try { localStorage.setItem(LS_ST(GUIDE.name), JSON.stringify({ seen: GUIDE.seen, at: GUIDE.at, round: GUIDE.round })); } catch { /* private mode: it just starts over next time */ }
}
const fits = (t, d, s) => { try { return !t.when || t.when(d, s); } catch { return false; } };

/** Post the next tip: the first four in order, then a random one not shown yet (all shown: a new round). Returns the line, or "". */
export function say() {
  const d = G.defs, s = G.self;
  if (!d || !s) return "";
  const pool = TIPS.filter((t) => fits(t, d, s));
  let left = pool.filter((t) => !GUIDE.seen.includes(t.id));
  if (!left.length) { GUIDE.seen = GUIDE.seen.filter((id) => !pool.some((t) => t.id === id)); GUIDE.round = 1; left = pool; }
  const tip = (GUIDE.round ? null : left.find((t) => t.first)) || left[Math.floor(Math.random() * left.length)];
  if (!tip) return "";
  let text = "";
  try { text = tip.text(d, s); } catch { /* a table the server did not send: skip this one */ }
  GUIDE.seen.push(tip.id); GUIDE.at = Date.now(); save();
  if (!text) return "";
  const line = `<Guide> ${text}`;
  addChat(line, "sys guide");
  return line;
}

const rand = ([a, b]) => (a + Math.random() * (b - a)) * 1000;
let next = 0;
/** The player is busy or the world is quiet time: a dead hero, a minigame, a co-op shift or raid (`dim:` maps), the chat box, a hidden tab. */
const quiet = (s) => document.hidden || s.dead || G.me.dead || Mini.active() || String(G.map && G.map.id).startsWith("dim:") || typing();
/** The frame loop calls this: when the next tip is due and the player is free, say it. */
export function tick() {
  const s = G.self;
  if (!G.playing || !s || !G.defs || !on()) { next = 0; return; }
  if (GUIDE.name !== s.name) { load(s.name); next = 0; }
  const t = Date.now();
  if (!next) { next = Math.max(t + rand(FIRST), GUIDE.at + GAP * 1000); return; }
  if (t < next) return;
  if (quiet(s)) { next = t + 8000; return; }
  say();
  next = t + rand(EVERY);
}

/** The 설정 → 게임 → 가이드 메시지 button. */
export function setup() {
  const b = $("#btn-guide");
  const show = () => { b.classList.toggle("off", !on()); b.textContent = on() ? "켜짐" : "꺼짐"; b.setAttribute("aria-pressed", String(on())); };
  b.addEventListener("click", () => { localStorage.setItem(LS, on() ? "0" : "1"); show(); Sound.play("ui"); });
  show();
}
