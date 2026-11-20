// ─────────────────────────────────────────────────────────────────────────────
// 스킬 강화 — active skill enhancement +1..+10 (owner, docs/design/job-freedom.md §7)
// A rare 스킬 강화석 per try; +1..+3 always succeed; a failure eats the stone only (the level stays).
// Each step adds a flat SKE_PCT % to the skill's power (+10 = +25 %). Sheet: ch.ske = { [skill id]: 1..10 }.
// ─────────────────────────────────────────────────────────────────────────────
// success % of the try from +n to +n+1 (proposed to the owner: steep, for hardcore players)
const SKE_RATE = [100, 100, 100, 80, 65, 50, 35, 25, 15, 10];
const SKE_PCT = 2.5, SKE_MAX = 10, SKE_ITEM = "ske_stone";
const skeOf = (ch, id) => (ch.ske && ch.ske[id]) | 0;
/** Skill power from enhancement (57 skGrow multiplies by it). */
const skeMul = (ch, sk) => 1 + (SKE_PCT / 100) * skeOf(ch, sk.id);
/** migrate(): learned-or-not is not checked (a job reset keeps it); known active skills, whole steps 1..10. */
function skeClean(ch) {
  const out = {};
  if (isObj(ch.ske)) for (const id of Object.keys(ch.ske)) {
    const n = Math.floor(Number(ch.ske[id]) || 0);
    if (Object.hasOwn(SKILL, id) && SKILL[id].kind !== "p" && n > 0) out[id] = clamp(n, 1, SKE_MAX);
  }
  ch.ske = out;
}
/** {t:"ske", id}: a learned active skill, in a safe place (town or by a campfire), with a stone. */
function skeValidate(S, p, a) {
  const ch = p.ch, sk = typeof a.id === "string" && Object.hasOwn(SKILL, a.id) ? SKILL[a.id] : null;
  if (!sk || sk.kind === "p" || !skillsFor(ch).includes(a.id)) return { ok: false, error: "배운 액티브 스킬만 강화할 수 있습니다" };
  if (skeOf(ch, a.id) >= SKE_MAX) return { ok: false, error: "최대 강화 단계입니다" };
  if (!jfSafe(S, p)) return { ok: false, error: "마을이나 모닥불 곁에서 강화할 수 있습니다" };
  if (countItem(ch, SKE_ITEM) < 1) return { ok: false, error: "스킬 강화석이 없습니다" };
  return { ok: true };
}
function skeApply(S, p, a) {
  const ch = p.ch, n = skeOf(ch, a.id), name = SKILL[a.id].name, ok = rnd(S) * 100 < SKE_RATE[n];
  takeItem(ch, SKE_ITEM, 1);
  if (ok) {
    ch.ske[a.id] = n + 1;
    toast(p, `[${name}] +${n + 1} 강화 성공! 위력 +${(SKE_PCT * (n + 1)).toFixed(1)}%`);
    if (n + 1 >= 7) sys(S, `${ch.name}님이 [${name}] +${n + 1} 스킬 강화에 성공했습니다!`);
  } else toast(p, `[${name}] 강화 실패... 스킬 강화석만 사라지고 단계는 그대로입니다.`);
  S.maps[p.map].ev.push(["e", p.eid, ok ? 1 : 0, ok ? n + 1 : 0, 1]);
  p.dirty = true;
}
