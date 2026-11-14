// ── the class mechanics
// (jobs-and-stats J1 bridge: "the class" is now the old class of the weapon in hand, legacyCls; J2 replaces this part)

/** What a skill costs right now: nothing to call a thrown sword back, nothing for a spell in a surge. */
function skMp(p, i) {
  const sk = legacySkills(p.ch)[i];
  if (!sk) return 0;
  if (sk.id === "toss" && p.sword) return 0;
  if (sk.el && p.surge > p.S.now) return 0;
  return sk.mp;
}
function addGrit(p, n) {
  if (legacyCls(p.ch) !== "warrior") return;
  p.grit = Math.min(GRIT_MAX, (p.grit || 0) + n);
  p.gritAt = p.S.now;
}
const marksOf = (S, mob) => (mob.mkAt > S.now ? mob.mk | 0 : 0);
function addMarks(S, mob, n) {
  if (mob.dead) return;
  mob.mk = Math.min(MARK_MAX, marksOf(S, mob) + n);
  mob.mkAt = S.now + MARK_MS;
}
function addFocus(S, p) {
  p.focus = Math.min(FOCUS_MAX, (p.focus || 0) + 1);
  p.focusAt = S.now;
}
/** Whether this cast spends full focus on its empowered form. */
function spendFocus(p, sk) {
  if (legacyCls(p.ch) !== "lancer" || sk.ult || (p.focus || 0) < FOCUS_MAX) return false;
  p.focus = 0;
  return true;
}
/** Drag a monster toward (tx, ty), as far as the ground lets it. */
function pullTo(m, mob, tx, ty) {
  if (MOBS[mob.k].boss || MOBS[mob.k].still || mob.el === 2) return false;
  const ok = MOBS[mob.k].fly ? canFly : canStand;
  const d = dist(mob.x, mob.y, tx, ty);
  if (d < 1) return true;
  const ux = (tx - mob.x) / d, uy = (ty - mob.y) / d;
  let far = 0;
  for (let k = 4; k <= d; k += 4) { if (!ok(m, mob.x + ux * k, mob.y + uy * k)) break; far = k; }
  if (far >= d - 4 && ok(m, tx, ty)) { mob.x = tx; mob.y = ty; } else { mob.x += ux * far; mob.y += uy * far; }
  return true;
}
/** How far along (ux, uy) from (x, y) something can fly before the ground stops it. */
function reach(m, x, y, ux, uy, len, step = 6) {
  let far = 0;
  for (let k = step; k <= len; k += step) { if (solidAt(m, x + ux * k, y + uy * k - 3)) break; far = k; }
  return far;
}
/**
 * A spell of element `e` landing at (x, y). If a different element is still held
 * (or a surge is on) the two react there; either way `e` is held next.
 */
function weave(S, rt, p, e, x, y, k) {
  const now = S.now, held = p.weave && p.weave.until > now ? p.weave.e : "";
  let other = held && held !== e ? held : "";
  if (!other && p.surge > now) other = SURGE_NEXT[e];
  p.weave = { e, until: now + WEAVE_MS };
  if (!other) return null;
  const rx = REACT[pairKey(e, other)];
  const m = mapOfS(p.S, p.map);
  rt.ev.push(["rx", rx.id === "steam" ? 1 : rx.id === "super" ? 2 : 3, Math.round(x), Math.round(y), rx.r]);
  for (const o of mobsWithin(rt, x, y, rx.r)) {
    if (rx.vuln) { o.vuln = now + rx.vuln; rt.ev.push(["vu", o.id, rx.vuln]); }
    if (rx.knock) { const d = dist(x, y, o.x, o.y) || 1; knock(m, o, (o.x - x) / d, (o.y - y) / d, rx.knock); }
    hurtMob(S, rt, o, p, rx.mult * k * (1 + stats(p).burst));
  }
  if (!(p.surge > now)) p.weave = null;    // a reaction uses both up — but a surge keeps the chain going
  return rx;
}
/** The mage's footprints, a few seconds of them, for the rewind. */
function trailPush(S, p) {
  if (legacyCls(p.ch) !== "mage") return;
  if (!p.trail) p.trail = [];
  const last = p.trail[p.trail.length - 1];
  if (last && S.now - last[0] < 200) return;
  p.trail.push([S.now, p.x, p.y, p.hp, p.map]);
  while (p.trail.length && S.now - p.trail[0][0] > 4200) p.trail.shift();
}

/** A rogue's puppet goes off: it marks and hurts whatever crowded round it. */
function popDecoy(S, rt, dc) {
  if (dc.gone) return;
  dc.gone = true;
  rt.ev.push(["dx", dc.id, Math.round(dc.x), Math.round(dc.y), dc.r]);
  for (const o of rt.mobs) if (o.dec === dc) o.dec = null;
  const p = S.players[dc.pid];
  if (!p || p.map !== rt.id) return;
  for (const o of mobsWithin(rt, dc.x, dc.y, dc.r)) { hurtMob(S, rt, o, p, dc.mult); addMarks(S, o, 2); }
}
/** Banners, teapots and puppets standing in a map. */
function classProps(S, rt, m, now) {
  if (rt.decoys && rt.decoys.length) {
    for (let i = rt.decoys.length - 1; i >= 0; i--) {
      const dc = rt.decoys[i];
      if (!dc.gone && now >= dc.until) popDecoy(S, rt, dc);
      if (dc.gone) rt.decoys.splice(i, 1);
    }
  }
  if (!rt.props || !rt.props.length) return;
  for (let i = rt.props.length - 1; i >= 0; i--) {
    const o = rt.props[i];
    if (now >= o.until) { rt.props.splice(i, 1); continue; }
    if (now < o.next) continue;
    if (o.kind === "banner") {
      o.next = now + 500;
      for (const mob of mobsWithin(rt, o.x, o.y, o.r)) mob.slow = Math.max(mob.slow || 0, now + 800);
    } else if (o.kind === "tea") {
      // a warm cup for everyone close by, once a second
      o.next = now + 1000;
      rt.ev.push(["tq", o.id]);
      for (const pid of Object.keys(S.players)) {
        const q = S.players[pid];
        if (q.map !== rt.id || q.dead || dist(q.x, q.y, o.x, o.y) > o.r) continue;
        const mhp = stats(q).mhp, amt = Math.min(mhp - q.hp, Math.round(mhp * o.pct));
        if (amt < 1) continue;
        q.hp += amt;
        rt.ev.push(["h", q.eid, -amt, 0, 1]);
      }
    }
  }
}
/** One blink of the shadow dance: on to the next marked monster, or home when there is none. */
function danceStep(S, p, now) {
  const dn = p.dance;
  if (now < dn.next) return;
  const rt = S.maps[p.map], m = mapOfS(p.S, p.map);
  let mob = null;
  while (dn.i < dn.ids.length && !mob) { const id = dn.ids[dn.i++]; mob = rt.mobs.find((o) => o.id === id && !o.dead) || null; }
  const ox = p.x, oy = p.y;
  if (!mob) {
    if (canStand(m, dn.ox, dn.oy)) { p.x = dn.ox; p.y = dn.oy; }
    p.fix = true; p.mvAt = now; p.dance = null; p.dirty = true;
    rt.ev.push(["ln", 5, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
    rt.ev.push(["a", p.eid, 56, Math.round(p.x), Math.round(p.y - 6), p.dir]);
    return;
  }
  dn.next = now + dn.every;
  const [ux, uy] = aimVec(p, mob);
  for (const k of [14, -14, 0]) { const nx = mob.x + ux * k, ny = mob.y + uy * k; if (canStand(m, nx, ny)) { p.x = nx; p.y = ny; break; } }
  p.fix = true; p.mvAt = now;
  face(p, mob);
  rt.ev.push(["ln", 5, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
  rt.ev.push(["a", p.eid, 57, Math.round(mob.x), Math.round(mob.y - 6), p.dir, 2]);
  const n = marksOf(S, mob);
  mob.mk = 0;
  hurtMob(S, rt, mob, p, dn.mult + dn.per * n, n >= 3);
}
/** What every class keeps track of from moment to moment. */
function classTick(S, p, now) {
  const rt = S.maps[p.map], m = mapOfS(p.S, p.map);
  const cls = legacyCls(p.ch);
  // a banner hurries the party standing by it
  let haste = 0;
  if (rt.props) for (const o of rt.props) {
    if (o.kind !== "banner" || dist(p.x, p.y, o.x, o.y) > o.r) continue;
    const owner = S.players[o.pid];
    if (owner && (owner === p || allies(S, p).includes(owner))) haste = Math.max(haste, o.haste);
  }
  if (haste !== (p.banHaste || 0)) { p.banHaste = haste; p.dirty = true; }
  if (p.hide && now >= p.hide) p.hide = 0;
  if (cls === "warrior") {
    if (p.sword && now >= p.sword.until) {
      // left too long, the sword finds its own way back — with nothing to show for it
      rt.ev.push(["sr", p.eid, Math.round(p.sword.x), Math.round(p.sword.y)]);
      p.sword = null;
      p.cds[0] = Math.max(p.cds[0], now + 1500);
      p.dirty = true;
    }
    if (p.brace && now >= p.brace.until) {
      const b = p.brace;
      p.brace = null;
      const st = stats(p);
      const mult = Math.max(b.mult, Math.min(6, (b.stored * 3) / Math.max(1, st.atk)));
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), b.r, 1]);
      for (const o of mobsWithin(rt, p.x, p.y, b.r)) {
        const d = dist(p.x, p.y, o.x, o.y) || 1;
        knock(m, o, (o.x - p.x) / d, (o.y - p.y) / d, 14);
        hurtMob(S, rt, o, p, mult);
      }
      addGrit(p, 30);
      p.dirty = true;
    }
    if (p.stomp) {
      const sp = p.stomp;
      if (now >= sp.until) p.stomp = null;
      else if (now >= sp.next) {
        const walked = dist(p.x, p.y, sp.lx, sp.ly) >= 4;
        sp.next = now + (walked ? 500 : 1000);
        sp.lx = p.x; sp.ly = p.y;
        rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), sp.r, 3]);
        for (const o of mobsWithin(rt, p.x, p.y, sp.r)) {
          if (!MOBS[o.k].boss && o.el < 2) o.stun = Math.max(o.stun, now + 150);
          hurtMob(S, rt, o, p, sp.mult);
        }
      }
    }
    // grit cools once the fighting stops — never in a giant
    if (p.grit > 0 && !(p.giant > now) && now - p.gritAt > 4000 && now - (p.gritDec || 0) >= 100) { p.gritDec = now; p.grit = Math.max(0, p.grit - 1); }
    if (p.giant && now >= p.giant) { p.giant = 0; p.dirty = true; }
  } else if (cls === "rogue") {
    if (p.dance) danceStep(S, p, now);
    if (p.venom && now >= p.venom.until) { p.venom = null; p.dirty = true; }
  } else if (cls === "lancer") {
    if (p.focus > 0 && now - p.focusAt > FOCUS_MS) p.focus = 0;
    if (p.wheel && now >= p.wheel) p.wheel = 0;
  } else if (cls === "mage") {
    trailPush(S, p);
    if (p.weave && now >= p.weave.until) p.weave = null;
    if (p.surge && now >= p.surge) { p.surge = 0; p.dirty = true; }
  }
}
/** Everything a class has going that does not survive a fall or a change of map. */
function classReset(p, death) {
  p.sword = null; p.brace = null; p.stomp = null; p.dance = null; p.wheel = 0; p.weave = null;
  p.trail = []; p.hide = 0; p.banHaste = 0; p.tipNext = 0;
  if (death) { p.giant = 0; p.surge = 0; p.grit = 0; p.focus = 0; p.venom = null; p.coinFree = false; }
}
/** The bits other players see of a class at work: giant, sword thrown, braced, spinning, dancing, surging, hidden. */
function flagsOf(p, now) {
  return (p.giant > now ? 1 : 0) | (p.sword ? 2 : 0) | (p.brace ? 4 : 0) | (p.wheel > now ? 8 : 0) | (p.dance ? 16 : 0) | (p.surge > now ? 32 : 0) | (p.hide > now ? 64 : 0);
}
const WEAVE_CODE = { f: 1, i: 2, l: 3 };
/** The class gauge's live number: grit, venomed strikes left, focus, or the element held. */
function crValue(p, now) {
  switch (legacyCls(p.ch)) {
    case "warrior": return Math.round(p.grit || 0);
    case "rogue": return p.venom && p.venom.until > now ? p.venom.n : 0;
    case "lancer": return p.focus || 0;
    default: return p.weave && p.weave.until > now ? WEAVE_CODE[p.weave.e] : 0;
  }
}
function crView(p, now) {
  switch (legacyCls(p.ch)) {
    case "": return null;
    case "warrior": return { k: "grit", v: crValue(p, now), max: GRIT_MAX, sw: p.sword ? Math.max(0, p.sword.until - now) : 0, gi: Math.max(0, (p.giant || 0) - now) };
    case "rogue": return { k: "mark", v: crValue(p, now), max: MARK_MAX, coin: p.coinFree ? 1 : 0 };
    case "lancer": return { k: "focus", v: crValue(p, now), max: FOCUS_MAX, tip: Math.round(WKIND.spear.range * TIP.at) };
    default: return { k: "weave", v: crValue(p, now), left: p.weave ? Math.max(0, p.weave.until - now) : 0, su: Math.max(0, (p.surge || 0) - now) };
  }
}

function castSkill(S, p, i) {
  const sk = legacySkills(p.ch)[i];
  const st = stats(p);
  const c = st.arm;
  const rt = S.maps[p.map];
  const m = mapOfS(p.S, p.map);
  const now = S.now;
  const k = 1;
  rouse(S, p);
  tutStep(S, p, "skill");
  newAct(p, true);
  p.mp -= skMp(p, i);
  // an element spell in a surge comes back in half the time; WIS shortens every wait
  p.cds[i] = now + Math.round((sk.el && p.surge > now ? sk.cd * 0.5 : sk.cd) * (1 - st.cdr));
  if (st.lg.echo && rnd(S) < 0.2 * st.proc) { p.cds[i] = now + 400; toast(p, `메아리! [${sk.name}] 재사용 대기 초기화`); }
  // the coin came up tails last time: this skill is free to use again at once
  if (p.coinFree && sk.id !== "coin" && !(sk.id === "toss" && !p.sword)) { p.coinFree = false; p.cds[i] = now + 300; toast(p, `행운! [${sk.name}] 재사용 대기 없음`); }
  p.atkAt = now;
  p.dirty = true;
  const emp = spendFocus(p, sk);
  if (emp) rt.ev.push(["fo", p.eid]);
  const ev = (kind, x, y, extra) => rt.ev.push(extra === undefined ? ["a", p.eid, kind, Math.round(x), Math.round(y), p.dir] : ["a", p.eid, kind, Math.round(x), Math.round(y), p.dir, 2, extra]);
  // a skill that picks its target looks where you aim (the nearest monster in the cone);
  // one that runs along a line, a throw or a dash goes straight along the aim
  const aimAt = (range) => {
    const mob = aimMob(rt, p, range, AIM_CONE);
    if (mob) face(p, mob);
    return mob;
  };
  const [aimX, aimY] = AIM_V[p.aim | 0];
  const ahead = (n) => [p.x + aimX * n, p.y + aimY * n];
  switch (sk.id) {
    // ── 전사: 투지
    case "toss": {
      if (p.sword) {
        // the recall: the sword comes home down the line, cutting and dragging what it passes
        const sw = p.sword;
        p.sword = null;
        p.cds[i] = now + Math.round(sk.cd * (1 - st.cdr));
        const d = dist(sw.x, sw.y, p.x, p.y) || 1, ux = (p.x - sw.x) / d, uy = (p.y - sw.y) / d;
        face(p, { x: sw.x, y: sw.y });
        ev(42, sw.x, sw.y - 6);
        rt.ev.push(["sr", p.eid, Math.round(sw.x), Math.round(sw.y)]);
        for (const o of mobsInLine(rt, sw.x, sw.y, ux, uy, d, 15)) {
          pullTo(m, o, p.x - ux * 16, p.y - uy * 16);
          o.stun = Math.max(o.stun, now + 300);
          hurtMob(S, rt, o, p, sk.ret);
          addGrit(p, 4);
        }
        break;
      }
      const ux = aimX, uy = aimY;
      const far = Math.max(12, reach(m, p.x, p.y, ux, uy, sk.len));
      const x = p.x + ux * far, y = p.y + uy * far;
      p.sword = { x, y, until: now + sk.stay };
      p.cds[i] = now + 700;                       // a moment, then it can be called back
      ev(41, x, y - 6);
      rt.ev.push(["sw", p.eid, Math.round(x), Math.round(y), sk.stay]);
      for (const o of mobsInLine(rt, p.x, p.y, ux, uy, far + 8, 14)) hurtMob(S, rt, o, p, sk.mult);
      break;
    }
    case "brace":
      p.brace = { until: now + sk.dur, stored: 0, r: sk.r, mult: sk.mult };
      ev(43, p.x, p.y - 6);
      break;
    case "roar": {
      ev(45, p.x, p.y - 6, sk.r);
      let n = 0;
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        const d = dist(p.x, p.y, o.x, o.y) || 1;
        if (pullTo(m, o, p.x + ((o.x - p.x) / d) * 18, p.y + ((o.y - p.y) / d) * 18)) n++;
        if (o.tgt !== p.pid) o.tgt = p.pid;
        o.st = 0; o.taunt = now + 4000;
        hurtMob(S, rt, o, p, sk.mult);
      }
      addGrit(p, 10 * n);
      for (const o of members(S, p)) {
        if (o !== p && (o.map !== p.map || o.dead || dist(o.x, o.y, p.x, p.y) > sk.r * 1.4)) continue;
        o.atkBuff = now + sk.dur; o.atkBuffK = sk.buff / 100;
        o.dirty = true;
        if (o !== p) rt.ev.push(["u", o.eid, 2]);
      }
      break;
    }
    case "burst": {
      const g = p.grit || 0;
      p.grit = 0;
      const r = sk.r + g * 0.4;
      ev(46, p.x, p.y - 6, Math.round(r));
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), Math.round(r), 2]);
      for (const o of mobsWithin(rt, p.x, p.y, r)) {
        const [ux, uy] = aimVec(p, o);
        knock(m, o, ux, uy, 8 + g * 0.14);
        hurtMob(S, rt, o, p, (sk.mult + g * sk.per) * k);
      }
      break;
    }
    case "stomp":
      p.stomp = { until: now + sk.dur, next: now + 250, lx: p.x, ly: p.y, r: sk.r, mult: sk.mult };
      ev(47, p.x, p.y - 6);
      break;
    case "giant":
      p.giant = now + sk.dur;
      p.slowed = 0;
      ev(48, p.x, p.y - 6);
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), sk.r, 9]);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        const [ux, uy] = aimVec(p, o);
        knock(m, o, ux, uy, 18);
        if (!MOBS[o.k].boss) o.stun = Math.max(o.stun, now + 700 * (o.el ? 0.5 : 1));
        hurtMob(S, rt, o, p, sk.mult);
      }
      p.stc = null;
      break;

    // ── 도적: 표식
    case "swap": {
      const mob = aimAt(sk.len);
      if (!mob) { ev(19, p.x, p.y - 6); p.cds[i] = now + 600; p.mp += sk.mp; break; }
      const ox = p.x, oy = p.y;
      const movable = !MOBS[mob.k].boss && !MOBS[mob.k].still && mob.el !== 2 && (MOBS[mob.k].fly ? canFly : canStand)(m, ox, oy);
      if (canStand(m, mob.x, mob.y)) {
        p.x = mob.x; p.y = mob.y;
        if (movable) { mob.x = ox; mob.y = oy; }
      }
      p.fix = true; p.mvAt = now;
      face(p, mob);
      rt.ev.push(["ln", 6, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(50, mob.x, mob.y - 6);
      if (!MOBS[mob.k].boss) { mob.stun = Math.max(mob.stun, now + 1000); mob.conf = now + 1000; rt.ev.push(["cf", mob.id, 1000]); }
      hurtMob(S, rt, mob, p, sk.mult);
      addMarks(S, mob, sk.marks);
      break;
    }
    case "venom":
      p.venom = { n: sk.n, until: now + 20000, dot: sk.dot };
      ev(51, p.x, p.y - 6);
      break;
    case "coin": {
      const mob = aimAt(sk.len);
      const [tx, ty] = mob ? [mob.x, mob.y] : ahead(40);
      const heads = rnd(S) < 0.5;
      ev(52, tx, ty - 6);
      rt.ev.push(["cn", p.eid, Math.round(tx), Math.round(ty), heads ? 1 : 0]);
      if (heads) {
        if (mob) { mob.lucky = true; hurtMob(S, rt, mob, p, sk.mult, true); mob.lucky = false; }
      } else {
        if (mob) hurtMob(S, rt, mob, p, sk.miss * k);
        p.coinFree = true;
      }
      if (mob) addMarks(S, mob, 1);
      break;
    }
    case "decoy": {
      if (!rt.decoys) rt.decoys = [];
      const dc = { id: S.nextId++, x: p.x, y: p.y, until: now + sk.dur, pid: p.pid, r: sk.r, mult: sk.mult };
      rt.decoys.push(dc);
      rt.ev.push(["dc", dc.id, p.eid, Math.round(p.x), Math.round(p.y), sk.dur]);
      ev(53, p.x, p.y - 6);
      // everything after the rogue turns on the puppet instead
      for (const o of rt.mobs) if (!o.dead && (o.tgt === p.pid || dist(o.x, o.y, p.x, p.y) < 110) && !MOBS[o.k].boss) { o.dec = dc; if (o.tgt === p.pid) o.tgt = null; }
      p.hide = now + 2500;
      p.spdBuff = Math.max(p.spdBuff, now + 2500);
      break;
    }
    case "harvest": {
      ev(54, p.x, p.y - 6, sk.r);
      let kills = 0;
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        const n = marksOf(S, o);
        if (!n) continue;
        o.mk = 0;
        const x = o.x, y = o.y;
        rt.ev.push(["bw", Math.round(x), Math.round(y), 12 + n * 4, 5]);
        hurtMob(S, rt, o, p, sk.mult * n);
        if (o.dead) kills++;
        // each mark that bursts throws splinters at whatever stands beside it
        for (const q of mobsWithin(rt, x, y, 12 + n * 4)) if (q !== o && !q.dead) hurtMob(S, rt, q, p, sk.mult * n * 0.35);
      }
      if (kills) p.cds[i] = Math.max(now + 1000, p.cds[i] - 1500 * kills);
      break;
    }
    case "dance": {
      let list = mobsWithin(rt, p.x, p.y, sk.len).filter((o) => marksOf(S, o) > 0)
        .sort((a, b) => marksOf(S, b) - marksOf(S, a)).slice(0, sk.n);
      // nothing marked: the nearest few, those you aim at first
      const front = (o) => (inArc(p, o, AIM_CONE) ? 0 : 1e4);
      if (!list.length) list = mobsWithin(rt, p.x, p.y, sk.len).sort((a, b) => front(a) + dist(p.x, p.y, a.x, a.y) - front(b) - dist(p.x, p.y, b.x, b.y)).slice(0, 4);
      ev(55, p.x, p.y - 6);
      p.ghost = Math.max(p.ghost || 0, now + 2500);
      if (!list.length) break;
      p.dance = { ids: list.map((o) => o.id), i: 0, next: now + 120, ox: p.x, oy: p.y, mult: sk.mult, per: sk.per, every: sk.every };
      break;
    }

    // ── 창술사: 창끝과 집중
    case "hook": {
      const ux = aimX, uy = aimY;
      const tip = c.range * 0.85;
      const list = mobsInLine(rt, p.x, p.y, ux, uy, sk.len, 15)
        .sort((a, b) => dist(p.x, p.y, b.x, b.y) - dist(p.x, p.y, a.x, a.y)).slice(0, emp ? 3 : 1);
      const end = list[0] ? dist(p.x, p.y, list[0].x, list[0].y) : sk.len * 0.6;
      ev(60, p.x + ux * end, p.y + uy * end - 6);
      list.forEach((o, j) => {
        rt.ev.push(["ln", 1, Math.round(p.x), Math.round(p.y), Math.round(o.x), Math.round(o.y)]);
        const off = (j - (list.length - 1) / 2) * 12;
        pullTo(m, o, p.x + ux * tip - uy * off, p.y + uy * tip + ux * off);
        o.slow = now + 2500;
        hurtMob(S, rt, o, p, sk.mult);
      });
      break;
    }
    case "pole": {
      const ux = aimX, uy = aimY;
      // the vault lands just past the first monster on the line, or most of the way along it
      const mob = mobsInLine(rt, p.x, p.y, ux, uy, sk.len, 14).sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y))[0] || null;
      // over the heads of anything in the way, never over a wall
      let far = 0;
      const want = mob ? Math.min(sk.len, dist(p.x, p.y, mob.x, mob.y) + 18) : sk.len * 0.7;
      for (let d = 6; d <= want; d += 6) { if (solidAt(m, p.x + ux * d, p.y + uy * d - 3)) break; far = d; }
      while (far > 0 && !canStand(m, p.x + ux * far, p.y + uy * far)) far -= 3;
      const ox = p.x, oy = p.y;
      p.x += ux * far; p.y += uy * far;
      p.fix = true; p.mvAt = now;
      rt.ev.push(["ln", 9, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      const r = sk.r * (emp ? 1.5 : 1);
      ev(61, p.x, p.y - 6, Math.round(r));
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), Math.round(r), 14]);
      for (const o of mobsWithin(rt, p.x, p.y, r)) {
        if (emp && !MOBS[o.k].boss) o.stun = Math.max(o.stun, now + 1000);
        hurtMob(S, rt, o, p, sk.mult);
      }
      p.tipNext = now + 1200;
      break;
    }
    case "banner": {
      if (!rt.props) rt.props = [];
      const [x, y] = ahead(10);
      const fx = canStand(m, x, y) ? x : p.x, fy = canStand(m, x, y) ? y : p.y;
      const r = Math.round(sk.r * (emp ? 1.4 : 1)), dur = sk.dur + (emp ? 6000 : 0);
      // one banner per lancer
      rt.props = rt.props.filter((o) => !(o.kind === "banner" && o.pid === p.pid));
      const b = { id: S.nextId++, kind: "banner", x: fx, y: fy, r, until: now + dur, pid: p.pid, haste: sk.haste, next: now };
      rt.props.push(b);
      rt.ev.push(["bn", b.id, Math.round(fx), Math.round(fy), r, dur]);
      ev(62, fx, fy - 6);
      break;
    }
    case "wheel": {
      const n = sk.n * (emp ? 2 : 1);
      p.wheel = now + sk.every * n;
      ev(63, p.x, p.y - 6, sk.every * n);
      rt.zones.push({ x: p.x, y: p.y, r: sk.r, next: now + 100, every: sk.every, left: n, mult: sk.mult, pid: p.pid, kind: 11, follow: 1, knock: sk.knock });
      break;
    }
    case "javelin": {
      const ux = aimX, uy = aimY;
      const line = mobsInLine(rt, p.x, p.y, ux, uy, sk.len, 13).sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y));
      const carried = emp ? line : line.slice(0, 1);
      const far = line.length ? dist(p.x, p.y, line[0].x, line[0].y) : reach(m, p.x, p.y, ux, uy, sk.len);
      ev(64, p.x + ux * far, p.y + uy * far - 6);
      let endX = p.x + ux * far, endY = p.y + uy * far;
      for (const o of carried) {
        const x0 = o.x, y0 = o.y;
        let pinned = false;
        if (!MOBS[o.k].boss && !MOBS[o.k].still && o.el !== 2) {
          const ok = MOBS[o.k].fly ? canFly : canStand;
          let go = 0;
          for (let d = 4; d <= sk.carry; d += 4) { if (!ok(m, x0 + ux * d, y0 + uy * d)) { pinned = true; break; } go = d; }
          o.x = x0 + ux * go; o.y = y0 + uy * go;
        }
        endX = o.x; endY = o.y;
        if (pinned) { o.stun = Math.max(o.stun, now + 2000); rt.ev.push(["wl", o.id]); }
        hurtMob(S, rt, o, p, sk.mult * (pinned ? sk.pin : 1));
      }
      for (const o of line) if (!carried.includes(o)) hurtMob(S, rt, o, p, sk.mult * 0.5);
      rt.ev.push(["ln", 2, Math.round(p.x), Math.round(p.y), Math.round(endX), Math.round(endY)]);
      break;
    }
    case "hundred": {
      const f = p.focus || 0;
      p.focus = 0;
      const ux = aimX, uy = aimY;
      const ox = p.x, oy = p.y;
      let far = 0;
      for (let d = 6; d <= sk.len; d += 6) { if (!canStand(m, ox + ux * d, oy + uy * d)) break; far = d; }
      p.x = ox + ux * far; p.y = oy + uy * far;
      p.fix = true; p.mvAt = now;
      p.ghost = Math.max(p.ghost || 0, now + 500);
      rt.ev.push(["ln", 3, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
      ev(65, p.x, p.y - 6, f);
      for (const o of mobsInLine(rt, ox, oy, ux, uy, far + 20, 18)) {
        rt.ev.push(["tip", o.id]);
        if (!MOBS[o.k].boss) o.stun = Math.max(o.stun, now + 600);
        hurtMob(S, rt, o, p, (sk.mult + sk.per * f) * k);
      }
      break;
    }

    // ── 마도사: 원소 엮기
    case "ember": {
      const mob = aimAt(c.range + 10);
      const [tx, ty] = mob ? [mob.x, mob.y] : ahead(70);
      ev(70, tx, ty - 6);
      for (const o of mobsWithin(rt, tx, ty, sk.r)) hurtMob(S, rt, o, p, sk.mult);
      rt.zones.push({ x: tx, y: ty, r: sk.r, next: now + 500, every: 500, left: 6, mult: sk.burn * k, pid: p.pid, kind: 10 });
      weave(S, rt, p, "f", tx, ty, k);
      break;
    }
    case "frost": {
      ev(71, p.x, p.y - 6, sk.r);
      let first = null;
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) {
        if (o.slow > now && !MOBS[o.k].boss) { o.stun = Math.max(o.stun, now + 1000); rt.ev.push(["fz", o.id, 1000]); }
        o.slow = now + 3000;
        hurtMob(S, rt, o, p, sk.mult);
        if (!first) first = o;
      }
      weave(S, rt, p, "i", first ? first.x : p.x, first ? first.y : p.y, k);
      break;
    }
    case "teapot": {
      if (!rt.props) rt.props = [];
      const [x, y] = ahead(10);
      const fx = canStand(m, x, y) ? x : p.x, fy = canStand(m, x, y) ? y : p.y;
      const tp = { id: S.nextId++, kind: "tea", x: fx, y: fy, r: sk.r, until: now + sk.dur, pid: p.pid, next: now + 1000, pct: sk.pct / (sk.dur / 1000) };
      rt.props.push(tp);
      rt.ev.push(["tp", tp.id, Math.round(fx), Math.round(fy), sk.r, sk.dur]);
      ev(72, fx, fy - 6);
      break;
    }
    case "bolt": {
      let mob = aimAt(c.range + 20);
      const [ax, ay] = mob ? [mob.x, mob.y] : ahead(60);
      ev(73, ax, ay - 6);
      let fx = p.x, fy = p.y - 8, mult = sk.mult;
      const hit = new Set();
      for (let j = 0; j < sk.n && mob; j++) {
        rt.ev.push(["ln", 4, Math.round(fx), Math.round(fy), Math.round(mob.x), Math.round(mob.y - 6)]);
        hit.add(mob);
        hurtMob(S, rt, mob, p, mult);
        mult *= 0.9;
        fx = mob.x; fy = mob.y - 6;
        const from = mob;
        mob = mobsWithin(rt, from.x, from.y, sk.r).filter((o) => !hit.has(o))
          .sort((a, b) => dist(from.x, from.y, a.x, a.y) - dist(from.x, from.y, b.x, b.y))[0] || null;
      }
      weave(S, rt, p, "l", ax, ay, k);
      break;
    }
    case "rewind": {
      const want = now - sk.ago;
      const tr = (p.trail || []).filter((s) => s[4] === p.map);
      const then = tr.find((s) => s[0] >= want) || tr[0];
      if (then) {
        const ox = p.x, oy = p.y;
        if (canStand(m, then[1], then[2])) { p.x = then[1]; p.y = then[2]; p.fix = true; p.mvAt = now; }
        rt.ev.push(["ln", 8, Math.round(ox), Math.round(oy), Math.round(p.x), Math.round(p.y)]);
        if (then[3] > p.hp) { const back = Math.round(Math.min(st.mhp, then[3]) - p.hp); p.hp += back; rt.ev.push(["h", p.eid, -back, 0, 1]); }
      }
      p.burn = null; p.poison = null; p.slowed = 0;
      SKILLS.mage.forEach((o, j) => { if (o.el) p.cds[j] = Math.max(now, p.cds[j] - 2000); });
      ev(74, p.x, p.y - 6);
      p.trail = [];
      break;
    }
    case "surge":
      p.surge = now + sk.dur;
      p.weave = null;
      ev(75, p.x, p.y - 6, sk.r);
      rt.ev.push(["bw", Math.round(p.x), Math.round(p.y), sk.r, 13]);
      for (const o of mobsWithin(rt, p.x, p.y, sk.r)) { o.slow = now + 2000; hurtMob(S, rt, o, p, sk.mult); }
      break;
  }
}

