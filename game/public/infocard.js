/**
 * The detail card: the HUD shows glyphs and numbers, and every glyph answers a click (a tap on a phone)
 * with one small framed card — what it is, the numbers now, how to raise or use it. One card at a time
 * (`#info`); Esc, the ✕, a click anywhere else or a second click on the same glyph closes it.
 *
 *   `bind(node, tip, spec)`   hover: the short `tip` (the native tooltip); click/tap: the card `spec()` builds
 *   `open(anchor, spec)` `close()`
 *   spec = { icon?: Node, title, tag?, text?: string[], rows?: [label, value][], how?, btn?: [label, fn] }
 *   builders: `jobCard statCard coinCard buffCard questCard barCard`; `coin(n)` = coin glyph + number;
 *   `statChip(key, value)` = a sheet number as glyph + number; `questMark(kind)` = the tracker's kind glyph;
 *   `jobMark(id)` = a job emblem that opens its job's card.
 *
 * Reads `G.defs` (jobs, skills, wkName, jobWm, hybWm, stats) and `G.self`; changes nothing in the game.
 */
import { G, el, clamp } from "./state.js";
import { Sound } from "./audio.js";
import { iconImg } from "./uiicons.js";
import { K } from "./keymap.js";
import { jobImg, jobId, jobMotif } from "./jobicons.js";

const hooks = { openTree: null, openStats: null, openWin: null };
let box = null, from = null;
const fmt = (n) => Number(n).toLocaleString();

export const isOpen = () => !!box && !box.hidden;
export function close() { if (box) box.hidden = true; from = null; }

/** Show the card for `anchor`, beside it and inside the screen. */
export function open(anchor, spec) {
  if (!box) {
    box = el("div", "frame");
    box.id = "info";
    box.hidden = true;
    document.body.append(box);
  }
  box.textContent = "";
  const hd = el("header");
  if (spec.icon) { spec.icon.classList.add("ic"); hd.append(spec.icon); }
  const tt = el("div", "tt");
  tt.append(el("b", "", spec.title));
  if (spec.tag) tt.append(el("small", "", spec.tag));
  const x = el("button", "x");
  x.title = "닫기 (Esc)";
  x.addEventListener("click", (e) => { e.stopPropagation(); close(); Sound.play("close"); });
  hd.append(tt, x);
  box.append(hd);
  for (const t of spec.text || []) if (t) box.append(el("p", "", t));
  if (spec.rows && spec.rows.length) {
    const dl = el("div", "rows");
    for (const [k, v] of spec.rows) { const r = el("div"); r.append(el("span", "", k), v instanceof Node ? v : el("b", "", String(v))); dl.append(r); }
    box.append(dl);
  }
  if (spec.how) { const p = el("p", "how"); p.append(el("em", "", spec.howLabel || "올리는 법"), spec.how); box.append(p); }
  if (spec.btn) {
    const b = el("button", "btn small gold", spec.btn[0]);
    b.addEventListener("click", (e) => { e.stopPropagation(); close(); spec.btn[1](); });
    box.append(b);
  }
  box.hidden = false;
  from = anchor;
  // beside the window the glyph sits in (never over the sheet it explains) when there is room; else over the
  // glyph (the dock), else under it; a narrow screen centres the card
  const r = anchor.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  const narrow = innerWidth < 520, win = anchor.closest(".window"), wr = win && win.getBoundingClientRect();
  let left = narrow ? (innerWidth - w) / 2 : r.left + r.width / 2 - w / 2;
  let top = r.top - h - 8;
  if (top < 4) top = r.bottom + 8;
  if (wr && !narrow && (wr.left - w - 6 >= 4 || wr.right + w + 6 <= innerWidth - 4)) {
    left = wr.left - w - 6 >= 4 ? wr.left - w - 6 : wr.right + 6;
    top = r.top - 12;
  }
  box.style.left = `${Math.round(clamp(left, 4, Math.max(4, innerWidth - w - 4)))}px`;
  box.style.top = `${Math.round(clamp(top, 4, Math.max(4, innerHeight - h - 4)))}px`;
}

/**
 * Make `node` explain itself: `tip` on hover, the card on a click or a tap (and Enter, for the keyboard).
 * The click stops there, so a glyph inside a clickable row or bar does not also fire the row.
 */
export function bind(node, tip, spec) {
  node.title = tip;
  node.classList.add("info");
  node.dataset.info = "1";
  if (node.tabIndex < 0) node.tabIndex = 0;
  const go = (e) => {
    e.stopPropagation();
    if (e.type === "click") e.preventDefault();
    if (from === node && isOpen()) { close(); return; }
    Sound.play("ui");
    open(node, spec());
  };
  node.addEventListener("click", go);
  node.addEventListener("keydown", (e) => { if (e.key === "Enter") go(e); });
  return node;
}

/** Start-up wiring, once (client.js): closing by Esc or a press elsewhere, and the ways on (`openTree openStats openWin`). */
export function setup(deps) {
  Object.assign(hooks, deps);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);
  addEventListener("pointerdown", (e) => { if (isOpen() && !box.contains(e.target) && !(from && from.contains(e.target))) close(); }, true);
  addEventListener("resize", close);
}
/** Per frame (hud.js): a card whose glyph went away goes with it. */
export function tick() { if (from && (!from.isConnected || from.closest("[hidden]"))) close(); }

// ── a sum of gold: the coin and the number ──
/** `<span class="coin">` coin glyph + number; the tooltip says 골드. */
export function coin(n, cls = "") {
  const sp = el("span", "coin" + (cls ? " " + cls : ""));
  sp.append(iconImg("coin", "#e2c486"), el("b", "", fmt(n)));
  sp.title = `${fmt(n)} 골드`;
  return sp;
}
export const coinCard = () => ({
  icon: iconImg("coin", "#e2c486"), title: "골드", tag: "돈",
  text: ["상점·대장간·전직·길드 창설, 생활 공방의 수수료에 쓰는 돈입니다."],
  rows: G.self ? [["지금 가진 골드", fmt(G.self.gold)]] : [],
  how: "몬스터를 쓰러뜨리고, 의뢰와 알바를 마치고, 남는 장비와 재료를 상점에 팔아 법니다.", howLabel: "버는 법",
});

export const bagCard = () => {
  const s = G.self, cap = s ? s.bagCap || G.defs.inv : 0;
  return {
    icon: iconImg("bag", "#e2c486"), title: "가방 칸", tag: "쓴 칸 / 전체 칸",
    text: ["장비와 물약, 음식이 한 칸씩 차지합니다. 같은 소모품은 한 칸에 겹칩니다. 가득 차면 더 줍지 못합니다."],
    rows: s ? [["지금", `${s.inv.length} / ${cap}`]] : [],
    how: "가방 아래의 [가방 확장]으로 칸을 늘리고, 남는 것은 상점에 팔거나 창고에 맡깁니다. 채집 재료는 재료 주머니에 따로 쌓입니다.", howLabel: "넓히는 법",
  };
};

// ── jobs ──
const KIND = { none: "아직 직업 없음", single: "한 무기 직업", hybrid: "두 갈래 직업" };
/** The card of the job `id`: what it is, its weapons, what it asks, its own skill. */
export function jobCard(id) {
  // the rules' own row when they know the id (even one without a mark yet), else the old name's job, else 모험가
  const d = G.defs, key = d.jobs && d.jobs[id] ? id : jobId(id), job = (d.jobs && d.jobs[key]) || { name: "모험가", kind: "none", wk: [] };
  const wkName = d.wkName || {}, need = job.wm || (job.kind === "hybrid" && d.hybWm) || d.jobWm;
  const sig = (d.skillOrder || []).find((s) => d.skills[s].job === key);
  const rows = [];
  if (job.wk.length) rows.push(["무기", job.wk.map((k) => wkName[k] || k).join(" + ")]);
  if (job.kind !== "none") rows.push(["전직 조건", `${job.wk.map((k) => `${wkName[k]} 숙련 ${need}`).join(" · ")}`], ["전직 비용", coin(job.cost)]);
  if (sig) rows.push(["고유 기술", d.skills[sig].name]);
  const names = Object.fromEntries((d.stats || []).map(([k, n]) => [k, n]));
  if (job.scale && Object.keys(job.scale).length) rows.push(["공격력을 올리는 능력치", Object.entries(job.scale).sort((a, b) => b[1] - a[1]).map(([k]) => names[k] || k).join(" · ")]);
  const text = jobId(key) === key ? [jobMotif(key) + "."] : [];
  if (job.kind === "none") text.push(`어떤 무기든 들 수 있습니다. 한 무기의 숙련이 ${d.jobWm}이 되면 그 무기의 직업, 두 무기가 ${d.hybWm || d.jobWm}씩이면 두 갈래 직업으로 전직할 수 있습니다.`);
  else if (job.kind === "single") text.push(`${wkName[job.wk[0]]} 하나에 모든 것을 건 직업입니다. 그 무기의 공격력 계수가 더 오르고 고유 기술을 배웁니다.`);
  else text.push(`${job.wk.map((k) => wkName[k]).join("와(과) ")}, 두 무기를 ${K("swap")}으로 바꿔 가며 싸우는 직업입니다.`);
  return {
    icon: jobImg(key), title: job.name, tag: KIND[job.kind] || "", text, rows,
    how: "전직관 아르센 앞에서 한 번만 할 수 있고 되돌릴 수 없습니다.", howLabel: "전직",
    btn: hooks.openTree && G.self ? [`전직의 길 보기 (${K("skill")})`, () => hooks.openTree()] : null,
  };
}
/** A job's emblem that explains itself: the name on hover, the job's card on a click. `mono` for a dim one. */
export function jobMark(id, opt) {
  const im = jobImg(id, opt), d = G.defs, job = d && d.jobs && (d.jobs[id] || d.jobs[jobId(id)]);
  return bind(im, job ? job.name : "모험가", () => jobCard(id));
}

// ── stats: the six, and what they make ──
/** key → [glyph, name, what it is, how to raise it] */
export const STAT_INFO = {
  atk: ["sword", "공격력", "기본 공격과 모든 스킬 피해의 바탕이 되는 수치입니다.", "더 좋은 무기와 강화, 무기가 쓰는 능력치(등급이 높을수록 크게), 무기 숙련으로 오릅니다."],
  crit: ["target", "치명타 확률", "공격이 치명타로 들어갈 확률입니다. 치명타는 치명 피해만큼 세게 들어갑니다.", "행운을 올리거나 치명타 옵션이 붙은 장비를 낍니다. 단검과 활은 기본 확률이 높습니다."],
  critd: ["burst", "치명 피해", "치명타가 들어갈 때 피해가 몇 %로 커지는지입니다.", "행운을 올리거나 치명 피해 옵션이 붙은 장비를 낍니다."],
  acd: ["clock", "공격 간격", "기본 공격을 한 번 하고 다음 공격까지 걸리는 시간입니다. 짧을수록 빠릅니다.", "민첩을 올리면 짧아집니다. 무기 종류마다 기본 간격이 다릅니다."],
  ls: ["fang", "흡혈", "준 피해의 이만큼을 HP로 되찾습니다.", "흡혈 옵션이 붙은 장비와 룬으로 얻습니다."],
  def: ["shield", "방어력", "받는 피해를 줄입니다. 물리 공격에 더 잘 듣습니다.", "의지를 올리고, 방어구를 입고 강화합니다."],
  mhp: ["heart", "최대 HP", "HP가 0이 되면 쓰러집니다.", "의지와 레벨, HP 옵션이 붙은 장비로 오릅니다."],
  mmp: ["drop", "최대 MP", "스킬을 쓸 때 드는 힘입니다.", "지혜(크게)와 지능, 레벨, MP 옵션이 붙은 장비로 오릅니다."],
  xpb: ["up", "경험치 추가", "사냥으로 얻는 경험치에 더해지는 비율입니다.", "모닥불의 온기, 경험의 주문서, 연속 처치, 장비 옵션으로 오릅니다."],
  mf: ["gem", "아이템 발견", "좋은 등급의 장비가 떨어질 확률을 높입니다.", "행운을 올리거나 아이템 발견 옵션이 붙은 장비를 낍니다."],
  goldb: ["coin", "골드 획득", "몬스터가 떨어뜨리는 골드에 더해지는 비율입니다.", "골드 획득 옵션이 붙은 장비로 오릅니다."],
  kills: ["skull", "처치 수", "지금까지 쓰러뜨린 몬스터의 수입니다.", "사냥하면 오릅니다. 업적과 칭호가 이 수를 봅니다."],
  eva: ["feather", "회피", "적의 공격을 완전히 피할 확률입니다.", "민첩을 올립니다."],
  aspd: ["chevron", "공격 속도", "공격 간격이 이만큼 짧아집니다.", "민첩을 올립니다."],
  cdr: ["auto", "재사용 감소", "스킬의 재사용 대기 시간이 이만큼 줄어듭니다.", "지혜를 올립니다."],
  res: ["shieldp", "상태 저항", "둔화·화상·중독 같은 상태 이상을 버티는 힘입니다.", "의지를 올립니다."],
  poise: ["anvil", "강인도", "맞았을 때 움찔하지 않고 버티는 힘입니다.", "의지를 올립니다."],
  kbr: ["thorn", "밀림 저항", "강한 공격에 뒤로 밀려나는 것을 버티는 힘입니다.", "힘을 올립니다."],
  burst: ["fire", "원소 폭발", "서로 다른 원소가 만나 터질 때의 피해가 이만큼 커집니다.", "지능을 올립니다."],
  wm: ["star", "무기 숙련", "지금 든 무기를 얼마나 다뤄 봤는지입니다. 숙련마다 공격력이 조금씩 오르고, 숙련이 쌓이면 스킬과 직업이 열립니다.", "그 무기로 몬스터를 때리고 쓰러뜨리면 오릅니다."],
};
/** The six stats' glyph and ink (statwin.js keeps the same table). */
const SIX = { str: ["fist", "#ff9a6a"], wil: ["heart", "#f07a8a"], dex: ["feather", "#9af0ae"], int: ["burst", "#8ab8ff"], wis: ["eye", "#c8a0ff"], luk: ["clover", "#ffe070"] };
/** The card of a derived number (`STAT_INFO` key) or of one of the six stats; `value` is what the sheet shows now. */
export function statCard(key, value) {
  const six = (G.defs.stats || []).find((s) => s[0] === key);
  if (six) {
    const [glyph, ink] = SIX[key], v = G.self ? G.self.st[key] : value;
    return {
      icon: iconImg(glyph, ink), title: six[1], tag: "능력치", text: [`${six[2]}.`],
      rows: [["지금", v], ["반영", v >= 60 ? "60부터는 1/4만" : v >= 40 ? "40부터는 절반만" : "40까지는 모두"]],
      how: "레벨 1 = 능력치 1포인트. 모닥불 곁이나 수련관 카이 앞에서 경험치로 올립니다.",
      btn: hooks.openStats ? [`능력치 열기 (${K("char")})`, () => hooks.openStats()] : null,
    };
  }
  const [glyph, name, what, how] = STAT_INFO[key];
  return { icon: iconImg(glyph, "#e2c486"), title: name, tag: "전투 수치", text: [what], rows: value === undefined ? [] : [["지금", value]], how };
}

/**
 * A number on a sheet as a glyph and the number: the name is the tooltip, a click opens its card.
 * `name` overrides the title (공격력(마법)).
 */
export function statChip(key, value, name) {
  const six = SIX[key], row = (G.defs.stats || []).find((s) => s[0] === key);
  const label = name || (six ? (row ? row[1] : key) : STAT_INFO[key][1]);
  const sp = el("span", "chip");
  sp.append(iconImg(six ? six[0] : STAT_INFO[key][0], six ? six[1] : undefined), el("b", "", String(value)));
  return bind(sp, `${label} ${value}`, () => ({ ...statCard(key, value), ...(name ? { title: name } : {}) }));
}

// ── the unit frame: health, mana ──
export function barCard(kind) {
  const s = G.self, me = G.me, hp = kind === "hp";
  return {
    icon: iconImg(hp ? "heart" : "drop", hp ? "#ff7a7a" : "#7ab4ff"), title: hp ? "HP (체력)" : "MP (마력)", tag: hp ? "0이 되면 쓰러집니다" : "스킬을 쓰는 힘",
    text: [hp ? "쓰러지면 쓰지 않고 모아 둔 경험치를 조금 잃습니다." : "스킬마다 드는 MP가 다릅니다. 가만히 있어도 조금씩 차오릅니다."],
    rows: s && me ? [["지금", `${hp ? me.hp : me.mp} / ${hp ? s.mhp : s.mmp}`]] : [],
    how: hp ? `HP 물약(${K("hp")}), 음식, 모닥불 곁에 앉기(${K("sit")})로 채웁니다. 최대치는 의지와 장비로 오릅니다.` : `MP 물약(${K("mp")}), 음식, 앉아 쉬기(${K("sit")})로 채웁니다. 최대치는 지혜와 지능으로 오릅니다.`,
    howLabel: "채우는 법",
  };
}

// ── buffs (the order of `self.buffs`, hud.js names them) ──
const BUFF_HOW = [
  "스킬이나 음식, 물약이 걸어 줍니다.", "스킬이나 음식, 물약이 걸어 줍니다.", `모닥불 곁에 앉아 쉬면(${K("sit")}) 쌓입니다. 불을 떠나도 한동안 남습니다.`, "음식을 먹으면 걸립니다. 한 번에 한 가지 음식만 듭니다.",
  "몬스터의 얼음 공격에 맞으면 걸립니다. 시간이 지나면 풀립니다.", "불 공격이나 불 장판에 닿으면 걸립니다. 시간이 지나면 풀립니다.", "독 공격이나 독 웅덩이에 닿으면 걸립니다. 시간이 지나면 풀립니다.",
  "공격의 주문서를 읽으면 걸립니다.", "방어의 주문서를 읽으면 걸립니다.", "경험의 주문서를 읽으면 걸립니다.", "바람의 사당에 닿으면 걸립니다.", "내 집 침대에서 쉬면 걸립니다.",
];
export function buffCard(i, name, left, icon) {
  const bad = i >= 4 && i < 7;
  return { icon, title: name.split(":")[0], tag: bad ? "해로운 상태" : "이로운 상태", text: [name.includes(":") ? name.split(":").slice(1).join(":").trim() + "." : ""], rows: [["남은 시간", left]], how: BUFF_HOW[i] || "", howLabel: "얻는 법" };
}

// ── quest kinds in the tracker ──
/** kind → [glyph, ink, name, what, how] */
export const QUEST_KIND = {
  main: ["crown", "#ffd27a", "주요 의뢰", "관리자 엘더윈이 맡기는 이야기의 줄기입니다. 하나를 마치면 다음 사냥터와 보상이 열립니다.", `엘더윈에게 받아(${K("interact")}) 목표를 채우고 돌아가 보고합니다.`],
  repeat: ["auto", "#9ad8ff", "반복 의뢰", "같은 몬스터를 정해진 수만큼 토벌하는, 몇 번이든 다시 받을 수 있는 의뢰입니다.", "엘더윈에게 받고, 다 잡으면 돌아가 보고합니다."],
  daily: ["cal", "#9af0ae", "일일 의뢰", "날마다 아침 6시에 바뀌는 세 가지 과제입니다.", `채운 과제는 일일 창(${K("daily")})에서 보상을 받습니다.`],
  job: ["note", "#e2c486", "알바", "게시판지기 포포가 내거는 마을 일거리입니다. 배달은 시간 안에 닿아야 합니다. 마치면 골드와 주민의 신뢰를 얻습니다.", `포포 앞 게시판에서 맡고(${K("interact")}), 일이 가리키는 주민에게 가져갑니다.`],
  side: ["talk", "#c8a0ff", "곁가지 의뢰", "마을 주민이 부탁하는 작은 일입니다.", `머리 위에 ! 가 뜬 주민에게 말을 걸어(${K("interact")}) 받습니다.`],
};
export function questCard(kind) {
  const [glyph, ink, name, what, how] = QUEST_KIND[kind];
  return { icon: iconImg(glyph, ink), title: name, tag: "의뢰의 종류", text: [what], how, howLabel: "하는 법", btn: hooks.openWin ? [kind === "daily" ? `일일 창 열기 (${K("daily")})` : kind === "job" ? "알바 게시판 보기" : `의뢰 창 열기 (${K("quest")})`, () => hooks.openWin(kind === "daily" ? "daily" : kind === "job" ? "board" : "quest")] : null };
}
/** The tracker's kind mark: a glyph in place of the word, explaining itself. */
export function questMark(kind) {
  const [glyph, ink, name] = QUEST_KIND[kind];
  return bind(iconImg(glyph, ink), name, () => questCard(kind));
}
