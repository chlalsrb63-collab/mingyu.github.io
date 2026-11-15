/**
 * 스킬 칸 (K window's 3rd tab; docs/design/job-freedom.md "As built"): 5 active + 4 passive slots (`defs.jf.lo`) and the
 * off-job passive slot (`self.lo[4]`). `self.lo = [actives, passives, offJob, set, offOpen]`. The draft is edited locally and
 * sent whole as `{t:"lo", a, p, x}`; the server decides (town / beside a campfire) and its Korean error shows as a toast.
 */
import { G, el } from "./state.js";
import { act } from "./net.js";
import { countItem } from "./actions.js";
import { Sound } from "./audio.js";
import { skillIconUrl } from "./skillicons.js";
import { hoverTip } from "./windows.js";
import { refreshUi } from "./hud.js";

let draft = null, from = "", pick = "";   // pick: "a3" | "p0" | "x" — the slot waiting for a skill
export const key = () => JSON.stringify([G.self?.lo, G.self?.ske, G.defs.ske && countItem(G.defs.ske.item), draft, pick]);

export function renderLoadout(box, s) {
  box.textContent = "";
  const lo = s.lo, jf = G.defs.jf, SK = G.defs.skills;
  if (!lo || !jf) { box.append(el("p", "hint", "스킬 칸 정보를 기다리는 중입니다.")); return; }
  const src = JSON.stringify(lo);
  if (!draft || from !== src) { draft = { a: [...lo[0]], p: [...lo[1]], x: lo[2] || "" }; from = src; pick = ""; }
  const [nA, nP] = jf.lo, learned = (s.sk || []).map((r) => r[0]);
  const actives = learned.filter((id) => SK[id] && SK[id].kind !== "p"), passives = learned.filter((id) => SK[id] && SK[id].kind === "p");
  box.append(el("p", "hint", "마을이나 모닥불 곁에서만 바꿀 수 있습니다. 칸에 넣지 않은 액티브는 쓸 수 없고, 패시브는 켜지지 않습니다. 칸을 누른 뒤 아래 스킬을 누르세요."));
  const setSlot = (k, id) => { if (k === "x") draft.x = id; else { const arr = draft[k[0] === "a" ? "a" : "p"]; arr[+k.slice(1)] = id; draft[k[0] === "a" ? "a" : "p"] = arr.filter(Boolean); } };
  const slot = (id, k, label) => {
    const b = el("button", "lo-slot" + (pick === k ? " sel" : "") + (id ? " full" : ""));
    b.type = "button";
    if (id) { const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id); b.append(ic, el("small", "", SK[id] ? SK[id].name : id)); } else b.append(el("small", "", label));
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
  if (lo[4]) { const r = el("div", "lo-row"); r.append(el("b", "", "다른 직업 패시브"), slot(draft.x, "x", "비어 있음")); box.append(r); }
  if (pick) {
    const kind = pick[0] === "a" ? "a" : "p", jobs = G.defs.jobs;
    let list = kind === "a" ? actives : passives;
    if (pick === "x") {   // learned passives of a weapon of another job walked
      const wks = new Set((s.jobs || []).filter((r) => r[0] !== s.job).flatMap((r) => (jobs[r[0]] ? jobs[r[0]].wk : [])));
      list = passives.filter((id) => wks.has(SK[id].wk) && !draft.p.includes(id));
    }
    const pool = el("div", "lo-pool");
    pool.append(el("b", "", pick === "x" ? "고를 수 있는 패시브" : kind === "a" ? "익힌 액티브" : "익힌 패시브"));
    if (!list.length) pool.append(el("small", "hint", "고를 수 있는 스킬이 없습니다."));
    for (const id of list) {
      const used = pick === "x" ? draft.x === id : draft[kind].includes(id);
      const c = el("button", "lo-chip" + (used ? " used" : ""));
      c.type = "button"; c.disabled = used;
      const ic = el("img", "ic"); ic.alt = ""; ic.src = skillIconUrl(id);
      c.append(ic, el("span", "", SK[id].name));
      hoverTip(c, (n) => n.append(el("div", "nm", SK[id].name), el("div", "", SK[id].desc)));
      c.addEventListener("click", () => { Sound.play("ok"); setSlot(pick, id); pick = ""; refreshUi(); });
      pool.append(c);
    }
    box.append(pool);
  }
  const go = el("button", "btn small gold", "적용"), rs = el("button", "btn small", "되돌리기");
  go.addEventListener("click", () => { Sound.play("ok"); const m = { t: "lo", a: draft.a, p: draft.p }; if (lo[4]) m.x = draft.x; act(m); });
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
