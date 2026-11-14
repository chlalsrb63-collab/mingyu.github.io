// ───────────────────────────── simulation ─────────────────────────────

function stepMob(m, mob, tx, ty, speed, dt, fly) {
  const d = dist(mob.x, mob.y, tx, ty);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = mob.x + ((tx - mob.x) / d) * step;
  const ny = mob.y + ((ty - mob.y) / d) * step;
  const ok = fly ? canFly : canStand;
  if (ok(m, nx, ny)) { mob.x = nx; mob.y = ny; }
  else if (ok(m, nx, mob.y)) mob.x = nx;
  else if (ok(m, mob.x, ny)) mob.y = ny;
  else return true;
  if (Math.abs(tx - mob.x) > 2) mob.dir = tx < mob.x ? 1 : 2;
  return d - step < 1;
}

const has = (mob, t) => !!mob.tr && mob.tr.includes(t);
/** Pick `n` different traits for an elite (one) or a guardian / field boss (two). */
function rollTraits(S, n) {
  const pool = TRAIT_KEYS.slice(), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(ri(S, 0, pool.length - 1), 1)[0]);
  return out;
}
/** Put a lingering condition on a player: "burn" and "poison" bite once a second, "slow" drags the feet. */
function afflict(S, p, kind, atk) {
  const now = S.now, k = 1 - deriveStats(p).res;     // WIL shortens it and dulls its bite
  if (kind === "slow") p.slowed = Math.max(p.slowed || 0, now + Math.round(SLOW_MS * k));
  else if (kind === "burn") p.burn = { until: now + Math.round(4000 * k), next: (p.burn && p.burn.next) || now + 1000, dmg: Math.max(1, Math.round(atk * 0.14 * k)) };
  else p.poison = { until: now + Math.round(6000 * k), next: (p.poison && p.poison.next) || now + 1000, dmg: Math.max(1, Math.round(atk * 0.09 * k)) };
  p.dirty = true;
}
/**
 * A monster's blow landing on a player, and whatever its traits add to that. `how`: "blow" (a direct
 * blow) and "shot" (a volley) can be evaded (DEX); "charge" and "tele" (a leap, slam or fan landing) —
 * or any blow of an elite or a boss — shove the player back and make them reel (45-jobs.js).
 */
function mobHit(S, rt, p, raw, mob, how = "blow") {
  if (p.dead) return;
  if ((how === "blow" || how === "shot") && evadeBlow(S, rt, p)) return;
  const before = p.hp;
  const src = mob && !mob.dead ? mob : null;
  // a rift's master hits softer than its wild kin (64-dim.js)
  if (mob && mob.ak) raw *= mob.ak;
  hurtPlayer(S, rt, p, raw, src);
  if (!p.dead && (how === "charge" || (how === "tele" && mob) || (src && (src.el >= 1 || MOBS[src.k].boss)))) staggerPlayer(S, rt, p, mob);
  if (!src || src.dead || !src.tr || !src.tr.length) return;
  const atk = MOBS[src.k].atk * ELITE[src.el].atk;
  if (!p.dead) {
    if (has(src, "fire")) afflict(S, p, "burn", atk);
    if (has(src, "poison")) afflict(S, p, "poison", atk);
    if (has(src, "frost")) afflict(S, p, "slow", atk);
  }
  if (has(src, "vamp")) {
    // it drinks what it spills
    // (a rift monster made tougher heals by the same measure: 64-dim.js dimHk)
    const heal = Math.min(mobMax(src) - src.hp, (Math.max(0, before - p.hp) * 3) / (src.hk || 1));
    if (heal >= 1) { src.hp += heal; rt.ev.push(["h", src.id, -Math.round(heal), 0, 0]); }
  }
}
/** Three (or more) shots fanned out around the line to the target; each lands where it was aimed, a beat later. */
function volley(S, rt, mob, tgt, dmg, n) {
  const dx = tgt.x - mob.x, dy = tgt.y - mob.y, base = Math.atan2(dy, dx), far = Math.max(30, Math.hypot(dx, dy));
  const ev = ["v", mob.id, VOLLEY_MS];
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * 0.42;
    const x = mob.x + Math.cos(a) * far, y = mob.y + Math.sin(a) * far;
    rt.tele.push({ x, y, r: 13, at: S.now + VOLLEY_MS, dmg, by: mob, ev: "q" });
    ev.push(Math.round(x), Math.round(y));
  }
  rt.ev.push(ev);
}
/** One of a monster's tricks, if the moment suits it. True when it was used. */
function special(S, m, rt, mob, tgt, dd, atk, k) {
  const d = MOBS[mob.k], now = S.now;
  if (k === "charge") {
    // lower the head along a marked line, then run it through
    if (dd < 34 || dd > d.charge) return false;
    const ux = (tgt.x - mob.x) / dd, uy = (tgt.y - mob.y) / dd, len = Math.min(dd + 36, d.charge + 20);
    mob.act = { at: now + CHARGE_MS, ux, uy, len };
    mob.dir = ux < 0 ? 1 : 2;
    rt.ev.push(["c", mob.id, Math.round(mob.x), Math.round(mob.y), Math.round(mob.x + ux * len), Math.round(mob.y + uy * len), CHARGE_MS]);
    mob.castAt = now + 5500;
    return true;
  }
  if (k === "leap") {
    // pounce: land beside the target in one bound
    if (dd <= d.range + 16 || dd >= d.leap) return false;
    mob.castAt = now + 4500;
    const nx = tgt.x - ((tgt.x - mob.x) / dd) * 14, ny = tgt.y - ((tgt.y - mob.y) / dd) * 14;
    if (canStand(m, nx, ny)) { mob.x = nx; mob.y = ny; mob.atkAt = Math.max(mob.atkAt, now + 350); }
    return true;
  }
  if (k === "slam") {
    // pound the ground: a ring to step out of
    if (dd >= 70) return false;
    mob.castAt = now + 6000;
    rt.tele.push({ x: mob.x, y: mob.y, r: d.slam, at: now + 1100, dmg: atk * 1.5, by: mob });
    rt.ev.push(["t", Math.round(mob.x), Math.round(mob.y), d.slam, 1100]);
    return true;
  }
  if (k === "pool") {
    // spit a puddle under the target's feet; it lies there for a while
    if (dd >= 110) return false;
    mob.castAt = now + 6500;
    const kind = d.poolKind || 0;
    rt.pools.push({ x: tgt.x, y: tgt.y, r: d.pool, next: now + POOL_FLY, until: now + POOL_FLY + POOL_MS, dmg: atk * 0.4, atk, kind });
    rt.ev.push(["g", mob.id, Math.round(tgt.x), Math.round(tgt.y), d.pool, POOL_FLY, POOL_MS, kind]);
    return true;
  }
  if (k === "fan") {
    if (dd < 24 || dd >= d.fan) return false;
    mob.castAt = now + 5000;
    volley(S, rt, mob, tgt, atk, d.boss ? 5 : 3);
    return true;
  }
  return false;
}
/** The run at the end of a charge: as far along the line as the ground allows, through whoever is on it. */
function dash(S, m, rt, mob, atk) {
  const a = mob.act;
  mob.act = null;
  const ok = MOBS[mob.k].fly ? canFly : canStand;
  const x0 = mob.x, y0 = mob.y;
  let far = 0;
  for (let k = 4; k <= a.len; k += 4) { if (!ok(m, x0 + a.ux * k, y0 + a.uy * k)) break; far = k; }
  mob.x = x0 + a.ux * far; mob.y = y0 + a.uy * far;
  rt.ev.push(["m", mob.id]);
  for (const pid of Object.keys(S.players)) {
    const p = S.players[pid];
    if (p.map !== m.id || p.dead) continue;
    const rx = p.x - x0, ry = p.y - y0, along = rx * a.ux + ry * a.uy;
    if (along > -6 && along < far + 10 && Math.abs(rx * a.uy - ry * a.ux) < 13) mobHit(S, rt, p, atk * 1.7, mob, "charge");
  }
  mob.atkAt = Math.max(mob.atkAt, S.now + 600);
}

function tickMob(S, m, rt, mob, dt) {
  const d = MOBS[mob.k];
  const now = S.now;
  if (mob.dead) {
    // (a cell's monster is gone for good: its cell sends another in its place, cellPass)
    if (!mob.temp && !mob.cellGone && now >= mob.respAt) { placeMob(S, m, mob); rt.ev.push(["r", mob.id]); }
    return;
  }
  if (mob.dot) {
    // poison keeps biting once a second
    const dot = mob.dot;
    if (now >= dot.until) mob.dot = null;
    else if (now >= dot.next) {
      dot.next = now + 1000;
      const o = S.players[dot.pid];
      if (o && o.map === m.id && dealMob(S, rt, mob, o, dot.dmg, 0)) return;
    }
  }
  if (d.still) return;
  const atk = d.atk * ELITE[mob.el].atk;
  // a charge already wound up goes off whatever is done to the charger in the meantime
  if (mob.act) {
    if (now >= mob.act.at) dash(S, m, rt, mob, atk);
    return;
  }
  if (mob.stun > now) return;
  const swift = has(mob, "swift");
  const speed = d.spd * (mob.slow > now ? 0.5 : 1) * (swift ? 1.35 : 1);
  if (mob.dec) {
    // a rogue's puppet: walk up to it and strike it, which sets it off
    const dc = mob.dec;
    if (dc.gone || now >= dc.until) mob.dec = null;
    else {
      if (dist(mob.x, mob.y, dc.x, dc.y) <= d.range + 4) { if (now >= mob.atkAt) { mob.atkAt = now + d.cd; rt.ev.push(["m", mob.id]); popDecoy(S, rt, dc); } }
      else stepMob(m, mob, dc.x, dc.y, speed, dt, d.fly);
      return;
    }
  }
  let tgt = mob.tgt ? S.players[mob.tgt] : null;
  const leash = Math.max(150, d.aggro * 2.4);
  if (tgt && (tgt.map !== m.id || tgt.dead || dist(mob.x, mob.y, mob.hx, mob.hy) > leash + 60 || dist(mob.x, mob.y, tgt.x, tgt.y) > leash)) {
    tgt = null; mob.tgt = null; mob.st = 2; mob.by = {};
  }
  if (!tgt && d.aggro > 0 && mob.st !== 2) {
    // fog: monsters see a little less far
    let bd = d.aggro * (rt.wx === WX.fog ? WX_FOG_AGGRO : 1);
    for (const pid of Object.keys(S.players)) {
      const p = S.players[pid];
      if (p.map !== m.id || p.dead || (p.foes || 0) >= AGGRO_CAP || p.hide > now) continue;
      const dd = dist(mob.x, mob.y, p.x, p.y);
      if (dd < bd) { bd = dd; tgt = p; }
    }
    if (tgt) { mob.tgt = tgt.pid; tgt.foes = (tgt.foes || 0) + 1; }
  }
  if (tgt) {
    const dd = dist(mob.x, mob.y, tgt.x, tgt.y);
    if (now >= mob.castAt) {
      const big = d.boss || mob.el === 2;
      // each kind has its own tricks: it tries them in turn and uses the first that suits the moment.
      // Bosses, guardians and field bosses alternate those with a blast on everyone in the fight.
      let used = false;
      mob.cn = (mob.cn || 0) + 1;
      if (!big || mob.cn % 2) {
        for (let i = 0; i < d.moves.length && !used; i++) {
          const k = d.moves[((mob.mv || 0) + i) % d.moves.length];
          if (special(S, m, rt, mob, tgt, dd, atk, k)) { used = true; mob.mv = ((mob.mv || 0) + i + 1) % d.moves.length; }
        }
      }
      if (!used && big) {
        mob.castAt = now + 6500;
        // one blast on every player in the fight: stand still and the whole party pays
        for (const pid of Object.keys(S.players)) {
          const o = S.players[pid];
          if (o.map !== m.id || o.dead || dist(mob.x, mob.y, o.x, o.y) > 220) continue;
          const r = d.boss ? 40 : 32;
          rt.tele.push({ x: o.x, y: o.y, r, at: now + 1300, dmg: atk * (d.boss ? 1.7 : 1.3), by: mob });
          rt.ev.push(["t", Math.round(o.x), Math.round(o.y), r, 1300]);
        }
      } else if (!used) mob.castAt = now + 800;        // nothing suited: look again shortly
      if (mob.act) return;
    }
    if (dd <= d.range) {
      if (now >= mob.atkAt) {
        mob.atkAt = now + d.cd * (swift ? 0.74 : 1);
        mob.dir = tgt.x < mob.x ? 1 : 2;
        if (d.volley) { rt.ev.push(["m", mob.id]); volley(S, rt, mob, tgt, atk * 0.85, 3); }
        else {
          rt.ev.push(d.shot ? ["m", mob.id, Math.round(tgt.x), Math.round(tgt.y - 8)] : ["m", mob.id]);
          if (d.shot && tgt.wheel > now) rt.ev.push(["bl", tgt.eid]);
          else mobHit(S, rt, tgt, atk, mob);
        }
      }
    } else stepMob(m, mob, tgt.x, tgt.y, speed, dt, d.fly);
    return;
  }
  if (mob.st === 2) {
    const max = mobMax(mob);
    mob.hp = Math.min(max, mob.hp + max * 0.2 * dt);
    if (stepMob(m, mob, mob.hx, mob.hy, speed * 1.4, dt, d.fly)) { mob.st = 0; mob.hp = max; }
    return;
  }
  if (now >= mob.mvAt) {
    mob.mvAt = now + 1500 + rnd(S) * 3500;
    mob.wx = mob.hx + (rnd(S) - 0.5) * 70;
    mob.wy = mob.hy + (rnd(S) - 0.5) * 70;
  }
  stepMob(m, mob, mob.wx, mob.wy, speed * 0.5, dt, d.fly);
}

// ───────────────────────────── active-area cells ─────────────────────────────
// docs/design/scale-and-rift.md B.4d: the monsters of a map live in its cells (m.cells, built
// with the map; rt.slots, one per monster a cell should hold). Cells near the living players
// wake and fill out of sight; far ones sleep and let their calm monsters go. Chests, bosses,
// guardians and event monsters are not in cells and never sleep.

/**
 * A tile in box r that is walkable and at least SPAWN_MIN_D tiles from every one of `pts` (tile
 * coordinates), or null. On a zoned map (33-maps-zones.js) only a tile of zone `z` will do.
 */
function placeAway(S, m, r, pts, z) {
  const [x0, y0, x1, y1] = r, d2 = SPAWN_MIN_D * SPAWN_MIN_D, zone = m.zone && z !== undefined ? m.zone : null;
  for (let i = 0; i < 24; i++) {
    const tx = ri(S, x0, x1), ty = ri(S, y0, y1);
    if (!m.reach[ty * m.w + tx] || (zone && zone[ty * m.w + tx] !== z)) continue;
    let ok = true;
    for (const [px, py] of pts) if ((tx + 0.5 - px) ** 2 + (ty + 0.5 - py) ** 2 < d2) { ok = false; break; }
    if (ok) return [tx, ty];
  }
  return null;
}
/**
 * A cell's crowd for `k` players near it: base × (0.75 + 0.25k), at most DENSITY_MAX; extra slots
 * come and (empty) go, but a wave's slots wait for their monster until their time (`exp`) is up.
 */
function crowdTo(rt, c, k, now) {
  const list = rt.slots[c], base = rt.base[c];
  const target = Math.round(base * Math.min(DENSITY_MAX, 0.75 + 0.25 * k));
  for (let i = list.length - 1; i >= base && list.length > target; i--) if (!list[i].mob && !(list[i].exp > now)) list.splice(i, 1);
  for (let i = list.length; i < target; i++) list.push({ q: list[i % base].q, c, mob: null, due: 0, extra: true });
}
/**
 * A cell falls asleep: its calm monsters leave (one still fighting stays until it calms, a later
 * pass), the ones killed there come back no sooner than CELL_RESPAWN_MS after its last kill, and
 * its extra slots go.
 */
function sleepCell(rt, c) {
  rt.cells[c] = 0;
  const list = rt.slots[c], since = rt.lastKill[c] + CELL_RESPAWN_MS;
  let gone = 0;
  for (const s of list) {
    const mob = s.mob;
    if (!mob) { s.due = Math.max(s.due, since); continue; }
    if (mob.tgt || mob.act) continue;
    mob.slot = null; mob.dead = true; mob.cellGone = true; s.mob = null; s.due = 0; gone++;
  }
  if (gone) for (let i = rt.mobs.length - 1; i >= 0; i--) if (rt.mobs[i].cellGone && rt.mobs[i].dead && !rt.mobs[i].slot) rt.mobs.splice(i, 1);
  for (let i = list.length - 1; i >= rt.base[c]; i--) if (!list[i].mob) list.splice(i, 1);
}
/**
 * Every CELL_PASS_MS on a map with players: wake the cells near the living, put to sleep the ones
 * nobody is near (the dead hold their ground too: dying never clears a crowd), send the waves, then
 * fill the empty slots of the awake cells near the living whose time has come, nearest cells first,
 * out of sight (of the dead too), never past WAKE_MAX_MOBS standing monsters.
 */
function cellPass(S, m, rt, pids) {
  const now = S.now;
  if (now < rt.cellAt || !m.cells) return;
  rt.cellAt = now + CELL_PASS_MS;
  const C = m.cells, cw = C.cw, ch = C.ch, nc = cw * ch;
  const folk = [], here = [];
  for (const pid of pids) { const p = S.players[pid]; if (p.map !== rt.id) continue; here.push(p); if (!p.dead) folk.push(p); }
  const cellX = (p) => clamp(Math.floor(p.x / T / CELL), 0, cw - 1), cellY = (p) => clamp(Math.floor(p.y / T / CELL), 0, ch - 1);
  // near: Chebyshev cells to the nearest living player; held: to the nearest player, dead or alive.
  // Only the cells within SLEEP_R of a player are looked at (the rest stay far).
  const near = new Int32Array(nc).fill(1 << 20), held = new Int32Array(nc).fill(1 << 20), crowd = new Uint8Array(nc);
  for (const p of here) {
    const px = cellX(p), py = cellY(p), live = !p.dead;
    for (let cy = Math.max(0, py - SLEEP_R); cy <= Math.min(ch - 1, py + SLEEP_R); cy++) for (let cx = Math.max(0, px - SLEEP_R); cx <= Math.min(cw - 1, px + SLEEP_R); cx++) {
      const d = Math.max(Math.abs(cx - px), Math.abs(cy - py)), c = cy * cw + cx;
      if (d < held[c]) held[c] = d;
      if (!live) continue;
      if (d < near[c]) near[c] = d;
      if (d <= WAKE_R) crowd[c]++;
    }
  }
  for (let c = 0; c < nc; c++) {
    if (!rt.base[c]) continue;
    if (held[c] > SLEEP_R) {
      if (rt.cells[c] || rt.slots[c].some((s) => s.mob)) sleepCell(rt, c);
      continue;
    }
    if (!rt.cells[c] && near[c] <= WAKE_R) rt.cells[c] = 1;
    if (rt.cells[c]) crowdTo(rt, c, crowd[c], now);
  }
  // waves: a hunter on the move finds more ahead of them
  for (const p of folk) {
    const w = p.wave;
    if (!w || w.map !== rt.id) { p.wave = { map: rt.id, at: now + WAVE_MS, x: p.x, y: p.y }; continue; }
    if (now < w.at) continue;
    const dx = (p.x - w.x) / T, dy = (p.y - w.y) / T, len = Math.hypot(dx, dy);
    w.at = now + WAVE_MS; w.x = p.x; w.y = p.y;
    if (len <= WAVE_MOVE) continue;
    const c = clamp(cellY(p) + Math.round((dy / len) * WAVE_AHEAD), 0, ch - 1) * cw + clamp(cellX(p) + Math.round((dx / len) * WAVE_AHEAD), 0, cw - 1);
    const base = rt.base[c], list = rt.slots[c];
    if (!rt.cells[c] || !base) continue;
    const add = Math.min(Math.ceil(base * WAVE_K), Math.floor(base * DENSITY_MAX) - list.length);
    for (let i = 0; i < add; i++) list.push({ q: list[i % base].q, c, mob: null, due: 0, extra: true, exp: now + WAVE_MS });
  }
  // fill
  let standing = 0;
  for (const mob of rt.mobs) if (!mob.dead && !mob.temp) standing++;
  if (standing >= WAKE_MAX_MOBS) return;
  const order = [];
  for (let c = 0; c < nc; c++) if (rt.cells[c] && rt.base[c] && near[c] <= SLEEP_R) order.push(c);
  order.sort((a, b) => near[a] - near[b] || a - b);
  const pts = here.map((p) => [p.x / T, p.y / T]);
  for (const c of order) for (const s of rt.slots[c]) {
    if (s.mob || now < s.due) continue;
    const at = placeAway(S, m, s.q.r, pts, s.q.zone);
    if (!at) continue;
    const mob = newMob(S, s.q.k, s.q.r, { elite: s.q.ep });
    mob.x = mob.hx = at[0] * T + 8; mob.y = mob.hy = at[1] * T + 10;
    readyMob(S, mob);
    mob.slot = s; s.mob = mob;
    rt.mobs.push(mob);
    if (++standing >= WAKE_MAX_MOBS) return;
  }
}

/** Advance the world to `now`. Maps nobody is standing in are frozen. */
export function tick(S, now) {
  const dt = clamp(now - (S.last || now), 0, 300) / 1000;
  S.last = now;
  S.now = now;
  worldEvent(S, now);
  skyTick(S, now);
  dimTick(S, now);
  homeTick(S, now);
  const pids = Object.keys(S.players);
  for (const id of liveMapIds(S)) {
    const rt = S.maps[id];
    if (rt.n <= 0) continue;
    const m = mapOfS(S, id);
    cellPass(S, m, rt, pids);
    // how many monsters are already after each player here
    for (const pid of pids) if (S.players[pid].map === id) S.players[pid].foes = 0;
    for (const mob of rt.mobs) { const o = !mob.dead && mob.tgt ? S.players[mob.tgt] : null; if (o && o.map === id) o.foes++; }
    for (const mob of rt.mobs) tickMob(S, m, rt, mob, dt);
    shotTick(S, rt, dt);
    for (let i = rt.mobs.length - 1; i >= 0; i--) if ((rt.mobs[i].temp || rt.mobs[i].cellGone) && rt.mobs[i].dead) rt.mobs.splice(i, 1);
    for (let i = rt.zones.length - 1; i >= 0; i--) {
      const z = rt.zones[i];
      if (now < z.next) continue;
      const p = S.players[z.pid];
      if (!p || p.map !== id || (z.follow && p.dead)) { rt.zones.splice(i, 1); continue; }
      if (z.follow) { z.x = p.x; z.y = p.y; }
      z.next = now + z.every;
      rt.ev.push(["b", Math.round(z.x), Math.round(z.y), z.r, z.kind]);
      for (const o of mobsWithin(rt, z.x, z.y, z.r)) {
        if (z.slow) o.slow = now + 2500;
        if (z.knock) { const d = dist(z.x, z.y, o.x, o.y) || 1; knock(m, o, (o.x - z.x) / d, (o.y - z.y) / d, z.knock); }
        hurtMob(S, rt, o, p, z.mult);
      }
      if (--z.left <= 0) rt.zones.splice(i, 1);
    }
    classProps(S, rt, m, now);
    for (let i = rt.tele.length - 1; i >= 0; i--) {
      const t = rt.tele[i];
      if (now < t.at) continue;
      rt.tele.splice(i, 1);
      rt.ev.push([t.ev || "b", Math.round(t.x), Math.round(t.y), t.r]);
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead || dist(p.x, p.y, t.x, t.y) > t.r) continue;
        if (t.ev === "q" && p.wheel > now) { rt.ev.push(["bl", p.eid]); continue; }
        mobHit(S, rt, p, t.dmg, t.by, t.ev === "q" ? "shot" : "tele");
      }
    }
    for (let i = rt.pools.length - 1; i >= 0; i--) {
      // a puddle bites whoever is standing in it, and leaves its mark on them
      const q = rt.pools[i];
      if (now >= q.until) { rt.pools.splice(i, 1); continue; }
      if (now < q.next) continue;
      q.next = now + 700;
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead || dist(p.x, p.y, q.x, q.y) > q.r) continue;
        // overlapping puddles do not add up: one bite at a time
        if (now < (p.poolAt || 0) + 600) continue;
        p.poolAt = now;
        p.blame = { by: q.kind === 1 ? "불길" : q.kind === 2 ? "얼음 웅덩이" : "독 웅덩이", lv: 0, el: 0 };
        hurtPlayer(S, rt, p, q.dmg);
        if (!p.dead) afflict(S, p, q.kind === 1 ? "burn" : q.kind === 2 ? "slow" : "poison", q.atk);
      }
    }
    for (let i = rt.fires.length - 1; i >= 0; i--) if (rt.fires[i].until && now >= rt.fires[i].until) rt.fires.splice(i, 1);
    for (let i = rt.drops.length - 1; i >= 0; i--) {
      const dr = rt.drops[i];
      if (now >= dr.dieAt) { rt.drops.splice(i, 1); continue; }
      for (const pid of pids) {
        const p = S.players[pid];
        if (p.map !== id || p.dead) continue;
        if (dr.own !== pid && now < dr.freeAt) continue;
        if (dist(p.x, p.y, dr.x, dr.y) > 15) continue;
        if (!pickUp(S, p, dr)) continue;
        rt.drops.splice(i, 1);
        break;
      }
    }
    // a pet runs for its owner's own drops within its reach, one at a time, minding the
    // loot filter and the room in the bag (메이플 펫의 줍기)
    if (rt.drops.length) for (const pid of pids) {
      const p = S.players[pid];
      if (p.map !== id || p.dead || !p.ch.pet || now < (p.petAt || 0)) continue;
      const reach = ITEMS[p.ch.pet].radius;
      let best = -1, bd = reach;
      for (let i = 0; i < rt.drops.length; i++) {
        const dr = rt.drops[i];
        if (dr.own !== pid || !wanted(p.ch, dr) || !fits(p.ch, dr)) continue;
        const d = dist(p.x, p.y, dr.x, dr.y);
        if (d <= bd) { bd = d; best = i; }
      }
      if (best < 0) continue;
      p.petAt = now + PET_MS;
      const dr = rt.drops[best];
      if (pickUp(S, p, dr)) { rt.drops.splice(best, 1); rt.ev.push(["pk", p.eid, Math.round(dr.x), Math.round(dr.y)]); }
    }
  }
  for (const pid of pids) {
    const p = S.players[pid];
    if (p.pinv && now - p.pinv.at > 30000) p.pinv = null;
    if (p.ginv && now - p.ginv.at > 30000) p.ginv = null;
    if (p.fish) {
      // a bite, then a short moment to reel it in
      const rt = S.maps[p.map];
      if (!p.fish.bite && now >= p.fish.at) { p.fish.bite = now; rt.ev.push(["f", p.eid, 2]); }
      else if ((p.fish.bite && !p.fish.hook && now > p.fish.bite + 1800) || (p.fish.hook && now > p.fish.hook + 25000)) { p.fish = null; rt.ev.push(["f", p.eid, 0]); toast(p, "물고기가 달아났습니다."); }
    }
    if (!p.dead) {
      // fire and poison bite once a second until they run out
      for (const key of ["burn", "poison"]) {
        const s = p[key];
        if (!s) continue;
        if (now >= s.until) { p[key] = null; continue; }
        if (now >= s.next) { s.next = now + 1000; wound(S, S.maps[p.map], p, s.dmg); if (p.dead) break; }
      }
    }
    if (p.recall && now >= p.recall.at && !p.dead) finishRecall(S, p);
    windTouch(S, p, now);
    if (!p.dead) classTick(S, p, now);
    if (p.dead || now - p.regenAt < 1000) continue;
    p.regenAt = now;
    ensureDaily(S, p);
    explore(S, p);
    const st = stats(p);
    const calm = now - p.hitAt > 5000;
    // a campfire is a place to catch your breath; sitting by it is better still
    const fire = calm ? fireNear(S.maps[p.map], p) : null;
    const rest = fire ? (p.sit ? 0.12 : 0.06) : mapOfS(p.S, p.map).safe ? 0.08 : 0.02;
    // a fire's warmth carries on after you stand up, as long as you keep out of a fight
    const wr = calm ? warmRegen(p, now) : 0;
    if (calm && p.hp < st.mhp) p.hp = Math.min(st.mhp, p.hp + st.mhp * (rest + wr) + 1);
    if (p.mp < st.mmp) p.mp = Math.min(st.mmp, p.mp + st.mmp * ((fire ? rest : 0.03) + wr + st.mpReg) + 1);
    if (fire && p.sit) warmTick(S, p, fire, now);
    else p.warmT = 0;
  }
  return S;
}

/** Call once every player's view for this tick has been taken. */
export function endTick(S) {
  for (const id of Object.keys(S.maps)) {
    const rt = S.maps[id];
    rt.ev.length = 0;
    rt.who = false;
  }
  S.chat.length = 0;
}

export function isGameOver() {
  return { over: false };
}

/** Today's tasks as the player sees them: what, how far, what it pays, and when they renew. */
