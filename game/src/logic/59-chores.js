// ───────────────────────────── 버드나무 마을 chores (docs/design/life-and-coop.md H10) ─────────────────────────────
// Board jobs of kind "chore" (JB rows with `job`, CHORES in 12-life-tables.js): spots on CHORE_MAP drawn per player,
// day and template from a pool the map's own tiles give (mailboxes before the houses, long grass, flower beds, lamp
// posts and boards, paths, trees); one act a spot, in reach, not too fast; some fetch first (the giver's milk or
// leash, water from a well). The sheet keeps `active.got` (a bitmask of spots done) and `active.fill` (acts carried).
// 58-life.js routes `jb {a:"pick"|"do"|"give"}` here for chores and pays through jbPay.

/** Each job's candidate tiles [x, y] on CHORE_MAP, worked out on first use. */
const CHORE_POOL = {};
function chorePool(job) {
  if (Object.hasOwn(CHORE_POOL, job)) return CHORE_POOL[job];
  const m = mapOf(CHORE_MAP), W = m.w, H = m.h, out = [];
  const ok = (x, y) => inMap(m, x, y) && !!m.reach[y * W + x];
  const side = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ok(x + dx, y + dy));
  // litter keeps off the doorways and the waypoint, and every third paving tile is enough to choose from
  const far = (x, y) => m.portals.every((d) => Math.abs(d.x - x) + Math.abs(d.y - y) > 4) && m.npcs.every((n) => n.x !== x || n.y !== y);
  if (job === "milk") { for (const b of m.big) if (b.t === "house" && ok(b.x + 1, b.y + 3)) out.push([b.x + 1, b.y + 3]); }
  else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const g = m.g[y][x], o = m.o[y][x];
    if (job === "weed" ? g === "t" && ok(x, y)
      : job === "litter" ? (g === "p" || g === "o") && ok(x, y) && far(x, y) && (x * 7 + y * 13) % 3 === 0
      : job === "water" ? g === "\"" && ok(x, y)
      : job === "flyer" ? (o === "L" || o === "v" || o === "G") && side(x, y)
      : job === "dog" ? o === "T" && side(x, y) && x > 3 && y > 3 && x < W - 4 && y < H - 4
      : false) out.push([x, y]);
  }
  CHORE_POOL[job] = out;
  return out;
}
/** A chore's spots for this sheet, day and grade: jbNeed(t, g) tiles from its pool, seeded by name, day and id. */
function choreSpots(ch, day, id, g) {
  const pool = chorePool(JB[id].job).slice(), n = Math.min(jbNeed(JB[id], g), pool.length), out = [];
  const box = { seed: strHash(`${ch.name}:${day}:${id}:s`) | 0 };
  while (out.length < n) out.push(pool.splice(ri(box, 0, pool.length - 1), 1)[0]);
  return out;
}
/** How many acts the job needs (its spots: a pool smaller than the need caps it). */
const choreNeed = (ch, day, id, g) => Math.min(jbNeed(JB[id], g), chorePool(JB[id].job).length);
/** Is a well or the water's edge within CHORE.src tiles of the player? */
function choreWater(S, p) {
  const m = mapOfS(S, p.map), tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), r = CHORE.src;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(m, tx + dx, ty + dy) && m.g[ty + dy][tx + dx] === "w") return true;
  return m.big.some((b) => b.t === "prop" && b.k === "well" && Math.abs(b.x - tx) <= r + 1 && Math.abs(b.y - ty) <= r + 1);
}
/** A timed chore's clock (ms): the giver → each spot left (nearest first) as a parcel's limit is figured (jbLimit). */
function choreLimit(ch, a, g) {
  const m = mapOf(CHORE_MAP), at = lifePostAt(JB[a.id].npc), sp = choreSpots(ch, ch.jobBoard.day, a.id, g).filter((_, i) => !(a.got & (1 << i)));
  let x = at ? at.x : m.entry[0], y = at ? at.y : m.entry[1], tiles = 0;
  while (sp.length) {
    let k = 0;
    sp.forEach((s, i) => { if (Math.abs(s[0] - x) + Math.abs(s[1] - y) < Math.abs(sp[k][0] - x) + Math.abs(sp[k][1] - y)) k = i; });
    const [nx, ny] = sp.splice(k, 1)[0], leg = legTiles(m, x, y, nx, ny);
    tiles += Number.isFinite(leg) ? leg : Math.abs(nx - x) + Math.abs(ny - y);
    x = nx; y = ny;
  }
  return Math.round(((tiles * T) / (BASE_SPD * JB_PAY.limit[0])) * JB_PAY.limit[1] * JB_GRADE.lim[g] * 1000 + JB_PAY.limit[2]);
}

/** `jb` pick / do / give for a chore in hand (58-life.js lifeValidate): OK or why not. */
function choreValidate(S, p, a, act) {
  const ch = p.ch, t = JB[act.id], c = CHORES[t.job], day = ch.jobBoard.day, g = jbRoll(ch, day, act.id).g, need = choreNeed(ch, day, act.id, g);
  if (p.dead) return bad("쓰러진 상태입니다");
  if (a.a === "give" && !npcReach(p, t.npc)) return bad(`${npcName(t.npc)}에게 가서 알려 주세요`);
  if (a.a === "give") return act.prog >= need ? OK : bad(`${c.name}${pp(c.name, "이가")} 아직 남았습니다 (${act.prog}/${need})`);
  if (p.map !== CHORE_MAP) return bad("버드나무 마을에서 하는 알바입니다");
  if (a.a === "pick") {
    if (!c.src) return bad("받아 올 것이 없습니다");
    if (act.prog >= need) return bad(`다 했습니다. ${npcName(t.npc)}에게 알려 주세요`);
    if (c.src === "npc") {
      if (act.fill > 0) return bad("이미 받았습니다");
      return npcReach(p, t.npc) ? OK : bad(`${npcName(t.npc)}에게 가서 받으세요`);
    }
    if (act.fill >= c.carry) return bad("물뿌리개가 가득 찼습니다");
    return choreWater(S, p) ? OK : bad("우물이나 물가로 가세요");
  }
  // a:"do", i — one spot of this chore
  const sp = choreSpots(ch, day, act.id, g);
  if (!Number.isInteger(a.i) || a.i < 0 || a.i >= sp.length) return bad("그곳이 아닙니다");
  if (act.got & (1 << a.i)) return bad("이미 끝낸 곳입니다");
  if (dist(p.x, p.y, sp[a.i][0] * T + 8, sp[a.i][1] * T + 8) > CHORE.range) return bad("너무 멉니다");
  if (S.now - (p.choAt || 0) < CHORE.gap) return bad("너무 서둘렀습니다");
  if (c.src && !(act.fill > 0)) return bad(c.src === "water" ? "물뿌리개가 비었습니다. 우물이나 물가에서 채우세요" : `먼저 ${npcName(t.npc)}에게 가서 받아 오세요`);
  return OK;
}
/** `jb` pick / do for a chore (58-life.js lifeApply; give goes to jbPay). */
function choreApply(S, p, a, act) {
  const ch = p.ch, t = JB[act.id], c = CHORES[t.job], day = ch.jobBoard.day, g = jbRoll(ch, day, act.id).g, need = choreNeed(ch, day, act.id, g);
  if (a.a === "pick") {
    if (c.src === "water") { act.fill = c.carry; toast(p, `${c.get} (${c.carry}번)`); return; }
    act.fill = need - act.prog;
    if (c.timed) {
      const limit = choreLimit(ch, act, g);
      act.expAt = S.now + limit;
      toast(p, `${c.get}! ${Math.ceil(limit / 1000)}초 안에 ${c.spot} ${act.fill}곳을 돌아 주세요.`);
    } else toast(p, `${c.get}!`);
    return;
  }
  act.got |= 1 << a.i;
  act.prog++;
  if (c.src) act.fill = Math.max(0, act.fill - 1);
  p.choAt = S.now;
  S.maps[p.map].ev.push(["co", p.eid, a.i]);
  toast(p, act.prog >= need ? `[알바] ${c.name} ${act.prog}/${need} — 다 했습니다! ${npcName(t.npc)}에게 알려 주세요.`
    : c.src === "water" && !act.fill ? `[알바] ${c.name} ${act.prog}/${need} — 물뿌리개가 비었어요.` : `[알바] ${c.name} ${act.prog}/${need}`);
}
/** Once a tick (lifeTick): a timed chore whose clock ran out with acts still carried fails. */
function choreTick(S, p, now) {
  const a = p.ch.jobBoard.active, t = a && JB[a.id];
  if (!t || t.kind !== "chore" || !CHORES[t.job].timed || !(a.fill > 0) || now <= a.expAt) return;
  p.ch.jobBoard.active = null;
  toast(p, "우유가 미지근해졌습니다… 마을 알바 실패.");
  S.maps[p.map].ev.push(["dl", p.eid, 0]);
  p.dirty = true;
}
/** A saved chore in hand, cleaned (lifeSheetClean): the spots done kept (only bits of real spots; prog = how many), nothing carried. */
function choreClean(ch, day, a) {
  const got = (a.got >>> 0) & ((1 << jbNeed(JB[a.id], jbRoll(ch, day, a.id).g)) - 1);
  let prog = 0;
  for (let b = got; b; b &= b - 1) prog++;
  const expAt = !CHORES[JB[a.id].job].timed && num(a.expAt) ? Math.max(0, Math.floor(a.expAt)) : 0;
  return { id: a.id, npc: a.npc, prog, expAt, got, fill: 0 };
}
/** self.jb's active row tail for a chore: [[x, y, done 0/1]…, fill]; [] for any other job. */
function choreView(ch, a) {
  const t = JB[a.id];
  if (t.kind !== "chore") return [];
  const g = jbRoll(ch, ch.jobBoard.day, a.id).g;
  return [choreSpots(ch, ch.jobBoard.day, a.id, g).map(([x, y], i) => [x, y, a.got & (1 << i) ? 1 : 0]), a.fill | 0];
}
