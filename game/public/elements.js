/** Element labels and live status displays shared by the HUD and the world overlay. */
import { G, el } from "./state.js";
import { iconImg } from "./uiicons.js";

const ICON = {
  shatter: "shieldp", bleed: "drop", burn: "fire", chill: "snow", freeze: "gem", stagger: "fist",
  shock: "burst", poison: "venom", curse: "skull", blind: "eye", ward: "shield",
};
const NONE = Object.freeze([]);

export const elementInfo = (type) => G.defs?.elements?.info?.[type];
export const damageColor = (index) => elementInfo(G.defs?.elements?.types?.[index])?.color || "#ffffff";
export const enchantName = (mob) => elementInfo(mob.enchant)?.enchant || "";

export const skillArmorPenetration = (sk) => sk.armorPenPct > 0 ? `물리 방어력 ${sk.armorPenPct}% 관통` : "";

export function skillElements(sk) {
  const group = el("span", "skill-elements");
  for (const type of [sk.damageType, sk.secondaryDamageType]) {
    const meta = elementInfo(type);
    if (!meta) continue;
    const label = type === "physical" && sk.armorPenPct > 0 ? "물리 특화" : meta.name;
    const tag = el("small", "skill-element", label);
    tag.style.color = meta.color;
    group.append(tag);
  }
  return group.firstChild ? group : "";
}

/** Use tenths for short control effects, seconds for the rest. */
export function statusesAt(id, t) {
  const rows = G.ailments.get(id);
  if (!rows) return NONE;
  const defs = G.defs.elements.status;
  const visible = [];
  for (const [index, until, stacks] of rows) {
    const status = defs[index], left = until - t;
    if (!status || left <= 0) continue;
    const sec = left >= 1000 ? Math.ceil(left / 1000) : (Math.ceil(left / 100) / 10).toFixed(1);
    visible.push({ index, name: status.name, icon: ICON[status.id] || "gem", color: elementInfo(status.type)?.color || "#ffffff", sec, stacks });
  }
  return visible;
}

export function statusHud(host, id, t) {
  const rows = statusesAt(id, t);
  // Refresh DOM only when the countdown text or stack count actually changes.
  const key = rows.map((s) => `${s.index}/${s.sec}/${s.stacks}`).join("|");
  if (host.dataset.key === key) return;
  host.dataset.key = key;
  host.replaceChildren(...rows.map((s) => {
    const chip = el("span", "element-status");
    chip.style.setProperty("--element-color", s.color);
    chip.append(iconImg(s.icon, s.color), `${s.sec}초${s.stacks > 1 ? ` ×${s.stacks}` : ""}`);
    chip.title = `${s.name} · ${s.sec}초${s.stacks > 1 ? ` · ${s.stacks}중첩` : ""}`;
    chip.setAttribute("aria-label", chip.title);
    return chip;
  }));
}

const signed = (value) => `${value > 0 ? "+" : "−"}${Math.abs(value)}%`;
export function matchups(mob) {
  if (!mob?.resist) return [];
  const types = G.defs.elements.types;
  const rows = [];
  for (const type of types) {
    const v = mob.resist[type] || 0;
    if (v) rows.push({ type, v, label: `${elementInfo(type).name} ${signed(v)}` });
  }
  return rows;
}

export function monsterElementText(mob) {
  const type = elementInfo(mob?.element);
  if (!type || mob.chest) return "";
  const data = matchups(mob);
  const weak = data.filter((row) => row.v < 0).map((row) => row.label);
  const tough = data.filter((row) => row.v > 0).map((row) => row.label);
  return [`주 공격 ${type.name}`, weak.length && `약점 ${weak.join(" · ")}`, tough.length && `저항 ${tough.join(" · ")}`, mob.holyWeak && "빛 특효 대상"].filter(Boolean).join(" / ");
}
