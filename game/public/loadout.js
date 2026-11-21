/**
 * 스킬 칸 (K window's 3rd tab; docs/design/job-freedom.md "As built", owner 2026-11-21): up to `defs.jf.lo[0]` actives of the
 * weapon in hand. Passives take no slot: every learned one of the hand is on, listed here read-only.
 * `self.lo = [actives in use, set]`. The local draft is sent whole as `{t:"lo", a}` and validated by the server.
 */
import { G, el } from "./state.js";
import { act } from "./wire.js";
import { countItem } from "./actions.js";
import { Sound } from "./audio.js";
import { skillIconUrl } from "./skillicons.js";
import { hoverTip } from "./windows.js";
import { refreshUi } from "./hudkit.js";

const PERK_NAME = {
  atk: "공격력", def: "방어력", hp: "최대 HP", mp: "최대 MP", crit: "치명타 확률", critd: "치명타 피해",
  spd: "이동 속도", ls: "생명력 흡수", aspd: "공격 속도", cdr: "재사용 대기시간 감소", poise: "경직 저항",
};
const POINT_PERKS = new Set(["crit", "critd", "poise"]);
const bonusText = (perk) => (perk && PERK_NAME[perk[0]] ? `${PERK_NAME[perk[0]]} +${perk[1]}${POINT_PERKS.has(perk[0]) ? "%p" : "%"}` : "");
/** Can active `id` be used with the weapon in hand (a hybrid signature: with either of its job's weapons)? */
function fits(s, id) {
  const sk = G.defs.skills[id];
  if (!sk || !s.eq.weapon) return false;
  return (sk.kind === "h" ? G.defs.jobs[sk.job].wk : [sk.wk]).includes(s.wk);
}

let draft = null, from = "", pick = -1;   // pick: the active slot waiting for a skill
export const key = () => JSON.stringify([G.self?.lo, G.self?.wk, G.self?.ske, G.defs.ske && countItem(G.defs.ske.item), draft, pick]);

export function renderLoadout(box, s) {
  box.textContent = "";
  const lo = s.lo, jf = G.defs.jf, SK = G.defs.skills;
  if (!lo || !jf) { box.append(el("p", "hint", "스킬 칸 정보를 기다리는 중입니다.")); return; }
  const src = JSON.stringify([s.job, s.wk, lo]);
  if (!draft || from !== src) { draft = [...lo[0]]; from = src; pick = -1; }
  const nA = jf.lo[0], wkName = G.defs.wkinds?.[s.wk]?.name || G.defs.wkName?.[s.wk] || "무기";
  const rows = s.sk || [];
  const actives = rows.map((r) => r[0]).filter((id) => SK[id] && SK[id].kind !== "p" && fits(s, id));
  const passives = rows.filter((r) => SK[r[0]] && SK[r[0]].kind === "p" && r[3]).map((r) => r[0]);
  if (!s.eq.weapon) { box.append(el("p", "hint", "무기를 들면 그 무기로 쓸 수 있는 스킬이 여기에 나옵니다.")); return; }
  box.append(el("p", "hint", `지금 든 ${wkName}의 스킬만 보입니다. 액티브는 마을이나 모닥불 곁에서 ${nA}개까지 넣고, 넣은 것만 씁니다. 칸을 눌러 고르고, 같은 칸을 다시 누르면 비웁니다.`));
  const tip = (node, id) => hoverTip(node, (n) => {
    n.append(el("div", "nm", SK[id].name), el("div", "", SK[id].desc));
    const bonus = bonusText(SK[id].perk);
    if (bonus) n.append(el("div", "", bonus));
  });
  const icon = (id) => { const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id); return ic; };
  const r = el("div", "lo-row");
  r.append(el("b", "", `액티브 ${nA}칸`));
  for (let i = 0; i < nA; i++) {
    const id = draft[i] || "";
    const b = el("button", "lo-slot" + (pick === i ? " sel" : "") + (id ? " full" : ""));
    b.type = "button";
    if (id) { b.append(icon(id), el("small", "", SK[id]?.name || id)); tip(b, id); } else b.append(el("small", "", "비어 있음"));
    b.addEventListener("click", () => {
      Sound.play("tab");
      if (id && pick === i) { draft.splice(i, 1); pick = -1; } else pick = pick === i ? -1 : i;   // a second click on a filled slot empties it
      refreshUi();
    });
    r.append(b);
  }
  box.append(r);
  if (pick >= 0) {
    const pool = el("div", "lo-pool");
    pool.append(el("b", "", `${wkName} 액티브 · 칸에 넣을 스킬 고르기`));
    if (!actives.length) pool.append(el("small", "hint", "고를 수 있는 스킬이 없습니다."));
    for (const id of actives) {
      const used = draft.includes(id);
      const c = el("button", "lo-chip" + (used ? " used" : ""));
      c.type = "button"; c.disabled = used;
      c.append(icon(id), el("span", "", SK[id].name));
      tip(c, id);
      c.addEventListener("click", () => {
        Sound.play("skill_equip");
        if (pick < draft.length) draft[pick] = id; else draft.push(id);
        pick = -1; refreshUi();
      });
      pool.append(c);
    }
    box.append(pool);
  }
  const go = el("button", "btn small gold", "적용"), rs = el("button", "btn small", "되돌리기");
  go.addEventListener("click", () => { Sound.play("skill_equip"); act({ t: "lo", a: draft.filter(Boolean) }); });
  rs.addEventListener("click", () => { draft = null; Sound.play("close"); refreshUi(); });
  const bar = el("div", "lo-bar"); bar.append(go, rs); box.append(bar);
  // passives: no slot, every learned one of the hand is on
  const pr = el("div", "lo-pool");
  pr.append(el("b", "", `켜져 있는 패시브 ${passives.length}개 · 자동 적용`));
  if (!passives.length) pr.append(el("small", "hint", `${wkName} 숙련이나 직업 레벨이 오르면 패시브가 생깁니다.`));
  for (const id of passives) {
    const c = el("span", "lo-chip");
    const bonus = bonusText(SK[id].perk);
    c.append(icon(id), el("span", "", bonus ? `${SK[id].name} · ${bonus}` : SK[id].name));
    tip(c, id);
    pr.append(c);
  }
  box.append(pr);
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
      b.addEventListener("click", () => { Sound.play("skill_rankup"); act({ t: "ske", id }); });
      r.append(b);
    }
    box.append(r);
  }
}
