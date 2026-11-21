function socketApply(S, p, slot) {
  const ch = p.ch, g = ch.eq[slot];
  takeItem(ch, SOCK_ITEM, 1);
  ch.gold -= SOCK_COST[g.sk];
  g.sk++;
  toast(p, `[${gearName(g)}]에 홈을 뚫었습니다 (${g.sk}/${sockCap(g)}).`);
  S.maps[p.map].ev.push(["e", p.eid, 1]);
  p.dirty = true;
  saveSoon(p);
}

/** Carries out an action validateAction accepted: its ACTIONS row's `run` (72-actions.js), then a prompt save for the ones in SAVE_SOON. */
export function applyAction(S, pid, a) {
  const p = S.players[pid];
  if (Object.hasOwn(ACTIONS, a.t)) ACTIONS[a.t].run(S, p, a);
  if (SAVE_SOON.has(a.t)) saveSoon(p);
  return S;
}

/** A different kind of weapon came into hand: a dance stops; a kind never used before puts its first skill on the bar. */
function handChanged(p) {
  const ch = p.ch, wk = inHand(ch);
  p.dance = null;
  p.hammer = null;
  qsFollow(ch);
  if (!wk || ch.wm[wk].lv > 1 || ch.wm[wk].xp > 0) return;
  for (const id of WK_SKILLS[wk]) if (SKILL[id].kind === "a" && SKILL[id].need <= 1) qsLearn(ch, id);
}

function afterGear(S, p) {
  p.stc = null;
  const st = stats(p);
  if (!p.ch.cnt.rune_bond && deriveStats(p).runeSets.length) {
    p.ch.cnt.rune_bond = 1;
    checkAch(S, p);
  }
  p.hp = Math.min(p.hp, st.mhp);
  p.mp = Math.min(p.mp, st.mmp);
  p.dirty = true;
  S.maps[p.map].who = true;
}

