/**
 * 보스 전리품 window `#w-trophy` (WIN `trophy`, Shift+T; docs/design/boss-trophies.md): every `defs.trophies.list` entry,
 * owned (`self.tro`) lit and unowned dim, its effect, and the held totals against `defs.trophies.cap`. Read-only: the
 * server hands trophies out (a story fight's clear, 5 % of a field boss kill).
 */
import { G, $, el } from "./state.js";

const FX = { xp: "경험치", gold: "골드 획득", move: "이동 속도", aspd: "공격 속도", drop: "드랍률", hp: "최대 HP", crit: "치명타" };
const fxText = (fx) => Object.entries(fx).map(([k, v]) => `${FX[k] || k} +${v}${k === "crit" ? "p" : "%"}`).join(" · ");
const T = () => G.defs && G.defs.trophies;
export const key = () => JSON.stringify(G.self && G.self.tro);

export function render(s) {
  const box = $("#trophy-body"), d = T();
  box.textContent = "";
  if (!d) { box.append(el("p", "hint", "불러오는 중…")); return; }
  const have = new Set(s.tro || []), kinds = Object.keys(d.list), tot = {};
  for (const k of have) if (d.list[k]) for (const [f, v] of Object.entries(d.list[k].fx)) tot[f] = (tot[f] || 0) + v;
  box.append(el("p", "hint", `우두머리를 혼자 쓰러뜨리는 메인퀘스트를 마치면 확실히, 필드 우두머리를 잡으면 ${Math.round(d.p * 100)}% 확률로 얻습니다. 이미 가진 전리품은 골드로 바뀝니다. (${have.size}/${kinds.length})`));
  const sum = el("div", "tr-sum");
  const cap = Object.keys(d.cap).filter((f) => tot[f]).map((f) => `${FX[f] || f} +${Math.min(tot[f], d.cap[f])}${f === "crit" ? "p" : "%"} (한도 ${d.cap[f]})`);
  sum.append(el("b", "", "지금 받는 효과"), el("span", "", cap.length ? cap.join(" · ") : "아직 없음"));
  box.append(sum);
  for (const k of kinds) {
    const t = d.list[k], on = have.has(k), mob = G.defs.mobs && G.defs.mobs[k];
    const row = el("div", "tr-row" + (on ? " on" : ""));
    row.append(el("b", "", on ? t.name : `${t.name} (미획득)`), el("small", "", `${mob ? mob.name : k} · ${fxText(t.fx)}`));
    box.append(row);
  }
}
