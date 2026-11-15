/**
 * 스킬 칸 (K window's 3rd tab; docs/design/job-freedom.md "As built"): 5 active + 4 passive slots (`defs.jf.lo`) and the
 * two cross-weapon passive slots. `self.lo = [actives, passives, first, set, offOpen, second, power]`.
 * The local draft is sent whole as `{t:"lo", a, p, x, y}` and validated by the server.
 */
import { G, el } from "./state.js";
import { act } from "./net.js";
import { countItem } from "./actions.js";
import { Sound } from "./audio.js";
import { skillIconUrl } from "./skillicons.js";
import { hoverTip } from "./windows.js";
import { refreshUi } from "./hud.js";

const PERK_NAME = {
  atk: "공격력", def: "방어력", hp: "최대 HP", mp: "최대 MP", crit: "치명타 확률", critd: "치명타 피해",
  spd: "이동 속도", ls: "생명력 흡수", aspd: "공격 속도", cdr: "재사용 대기시간 감소", poise: "경직 저항",
};
const POINT_PERKS = new Set(["crit", "critd", "poise"]);
const isCross = (slot) => slot === "x" || slot === "y";
function bonusText(perk, scale = 100) {
  if (!perk || !PERK_NAME[perk[0]]) return "";
  const [stat, value] = perk;
  return `${PERK_NAME[stat]} +${(value * scale / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${POINT_PERKS.has(stat) ? "%p" : "%"}`;
}

let draft = null, from = "", pick = "";   // pick: "a3" | "p0" | "x" | "y" — the slot waiting for a skill
export const key = () => JSON.stringify([G.self?.lo, G.self?.ske, G.defs.ske && countItem(G.defs.ske.item), draft, pick]);

export function renderLoadout(box, s) {
  box.textContent = "";
  const lo = s.lo, jf = G.defs.jf, SK = G.defs.skills;
  if (!lo || !jf) { box.append(el("p", "hint", "스킬 칸 정보를 기다리는 중입니다.")); return; }
  const src = JSON.stringify([s.job, lo]);
  if (!draft || from !== src) { draft = { a: [...lo[0]], p: [...lo[1]], x: lo[2] || "", y: lo[5] || "" }; from = src; pick = ""; }
  const [nA, nP] = jf.lo, learned = (s.sk || []).map((r) => r[0]);
  const actives = learned.filter((id) => SK[id] && SK[id].kind !== "p"), passives = learned.filter((id) => SK[id] && SK[id].kind === "p");
  const twoCross = Array.isArray(jf.borrow) && lo.length >= 7;
  const power = twoCross ? (lo[6] || jf.borrow[0]) : 100;
  const benefit = (id, k) => {
    const skill = SK[id];
    if (!skill) return "";
    return isCross(k) ? (twoCross ? bonusText(skill.borrow || skill.perk, power) : "") : bonusText(skill.perk);
  };
  const tip = (node, id, bonus, cross) => {
    if (!SK[id]) return;
    hoverTip(node, (n) => {
      n.append(el("div", "nm", SK[id].name));
      if (!cross || !twoCross) n.append(el("div", "", SK[id].desc));
      if (bonus) n.append(el("div", "", bonus));
    });
  };
  box.append(el("p", "hint", "스킬은 마을이나 모닥불 곁에서 장착하며, 장착한 스킬만 작동합니다. 칸을 눌러 스킬을 고르고, 같은 칸을 다시 누르면 비웁니다."));
  const setSlot = (k, id) => {
    if (isCross(k)) draft[k] = id;
    else {
      const kind = k[0], arr = draft[kind];
      arr[+k.slice(1)] = id;
      draft[kind] = arr.filter(Boolean);
    }
  };
  const slot = (id, k, label) => {
    const b = el("button", "lo-slot" + (pick === k ? " sel" : "") + (id ? " full" : ""));
    b.type = "button";
    if (id) {
      const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id);
      const bonus = benefit(id, k), name = SK[id]?.name || id;
      b.append(ic, el("small", "", isCross(k) && bonus ? `${name} · ${bonus}` : name));
      tip(b, id, bonus, isCross(k));
    } else b.append(el("small", "", label));
    b.addEventListener("click", () => {
      Sound.play("tab");
      if (id && pick === k) { setSlot(k, ""); pick = ""; } else pick = pick === k ? "" : k;   // a second click on a filled slot empties it
      refreshUi();
    });
    return b;
  };
  const row = (title, n, arr, pre) => {
    const r = el("div", "lo-row"); r.append(el("b", "", title));
    for (let i = 0; i < n; i++) r.append(slot(arr[i] || "", pre + i, "비어 있음"));
    return r;
  };
  box.append(row(`액티브 ${nA}칸`, nA, draft.a, "a"), row(`패시브 ${nP}칸`, nP, draft.p, "p"));
  if (lo[4]) {
    const r = el("div", "lo-row");
    r.append(el("b", "", twoCross ? `교차 패시브 2칸 · 효과 ${power}%` : "다른 직업 패시브"), slot(draft.x, "x", "첫째 칸"));
    if (twoCross) r.append(slot(draft.y, "y", "둘째 칸"));
    box.append(r);
  } else if (twoCross) box.append(el("p", "hint", "교차 패시브는 첫 전직 이후 사용할 수 있습니다."));
  if (pick) {
    const cross = isCross(pick), kind = pick[0] === "a" ? "a" : "p", jobs = G.defs.jobs;
    let list = kind === "a" ? actives : passives;
    if (cross) {
      const other = pick === "x" ? draft.y : draft.x;
      if (twoCross) {
        const native = new Set(jobs[s.job]?.wk || []);
        list = passives.filter((id) => (SK[id].borrow || SK[id].perk) && !native.has(SK[id].wk) && !draft.p.includes(id) && id !== other);
      } else {
        const wks = new Set((s.jobs || []).filter((r) => r[0] !== s.job).flatMap((r) => jobs[r[0]]?.wk || []));
        list = passives.filter((id) => wks.has(SK[id].wk) && !draft.p.includes(id));
      }
    } else if (kind === "p") {
      list = passives.filter((id) => id !== draft.x && id !== draft.y);
    }
    const pool = el("div", "lo-pool");
    pool.append(el("b", "", cross ? "교차 장착 가능한 패시브" : kind === "a" ? "익힌 액티브" : "익힌 패시브"));
    if (!list.length) pool.append(el("small", "hint", "고를 수 있는 스킬이 없습니다."));
    for (const id of list) {
      const used = cross ? draft[pick] === id : draft[kind].includes(id);
      const bonus = benefit(id, pick);
      const c = el("button", "lo-chip" + (used ? " used" : ""));
      c.type = "button"; c.disabled = used;
      const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id);
      c.append(ic, el("span", "", bonus ? `${SK[id].name} · ${bonus}` : SK[id].name));
      tip(c, id, bonus, cross);
      c.addEventListener("click", () => { Sound.play("ok"); setSlot(pick, id); pick = ""; refreshUi(); });
      pool.append(c);
    }
    box.append(pool);
  }
  const go = el("button", "btn small gold", "적용"), rs = el("button", "btn small", "되돌리기");
  go.addEventListener("click", () => {
    Sound.play("ok");
    const m = { t: "lo", a: draft.a, p: draft.p };
    if (lo[4]) m.x = draft.x;
    if (lo[4] && twoCross) m.y = draft.y;
    act(m);
  });
  rs.addEventListener("click", () => { draft = null; Sound.play("close"); refreshUi(); });
  const bar = el("div", "lo-bar"); bar.append(go, rs); box.append(bar);
  skeSection(box, s, actives);
}
/** 스킬 강화 (rules 48-skill-enh.js): +n per active skill, a 스킬 강화석 a try, town or campfire only (the server decides). */
function skeSection(box, s, actives) {
  const D = G.defs.ske, SK = G.defs.skills;
  if (!D || !actives.length) return;
  const have = countItem(D.item), stoneName = G.defs.items[D.item] ? G.defs.items[D.item].name : D.item;
  box.append(el("b", "lo-head", "스킬 강화"), el("p", "hint", `${stoneName} 1개로 한 번 (보유 ${have}). +3까지는 반드시 성공, 그 뒤 실패하면 돌만 사라집니다. 한 단계마다 위력 +${D.pct}%.`));
  for (const id of actives) {
    const n = (s.ske && s.ske[id]) | 0, r = el("div", "lo-row");
    const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id);
    r.append(ic, el("span", "", `${SK[id].name} ${n ? "+" + n : ""}`));
    if (n >= D.max) r.append(el("small", "", "최대"));
    else {
      const b = el("button", "btn small", `강화 ${D.rate[n]}%`);
      b.disabled = have < 1;
      b.addEventListener("click", () => { Sound.play("ok"); act({ t: "ske", id }); });
      r.append(b);
    }
    box.append(r);
  }
}
