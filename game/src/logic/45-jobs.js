// ───────────────────────────── jobs and stats ─────────────────────────────
// docs/design/jobs-and-stats.md (tables in 02-jobs-stats.js). Levels, stat points, derived stats,
// weapon mastery, jobs, the migration of the old four classes, and the arrows a bow looses.

/** Player level (1–200) → world tier (1–50, real); tier → the level printed on screen. */
const toTier = (lvl) => (lvl + 3) / 4;
const shownLv = (t) => 4 * t - 3;
/** Soft caps: a stat counts fully to 40, half to 60, a quarter beyond. */
const eff = (s) => Math.min(s, 40) + 0.5 * clamp(s - 40, 0, 20) + 0.25 * Math.max(0, s - 60);
/** The experience one stat point costs at level `N` (buying N → N+1) for a stat now at `s`. */
const pointCost = (N, s) => Math.round((tierXp(toTier(N)) / LV_DIV) * (1 + STAT_K * Math.max(0, s - STAT_K0)));
/** A batch of points `a` (six counts, ST_ORDER), bought one at a time in stat order. */
function batchCost(ch, a) {
  let lvl = ch.lvl, c = 0;
  ST_ORDER.forEach((k, i) => { let s = ch.st[k]; for (let n = 0; n < a[i]; n++) c += pointCost(lvl++, s++); });
  return c;
}
const levelOf = (st) => 1 + ST_ORDER.reduce((n, k) => n + st[k] - ST_BASE, 0);
/** What the next point in each stat costs now (0 when that stat or the level is at its cap). */
const nextCosts = (ch) => ST_ORDER.map((k) => (ch.st[k] >= ST_CAP || ch.lvl >= MAXLV ? 0 : pointCost(ch.lvl, ch.st[k])));
/** Mastery experience from level m to m + 1. */
const wmNeed = (m) => 22 * m * m;
const freshWm = () => Object.fromEntries(WK_ORDER.map((k) => [k, { lv: 1, xp: 0 }]));
const r1 = (v) => Math.round(v * 10) / 10;
const freshSt = () => Object.fromEntries(ST_ORDER.map((k) => [k, ST_BASE]));

/** How the weapon kind `wk` scales for this character: { stat: coefficient } (job and hybrid adjusted). */
function scaleOf(ch, wk) {
  const job = JOBS[ch.job];
  if (job && job.kind === "hybrid" && job.wk.includes(wk)) return { ...job.scale };
  const out = {}, g = SCALE[wk] || {};
  for (const k of Object.keys(g)) out[k] = GRADE[g[k]] + (job && job.kind === "single" && job.wk[0] === wk ? JOB_PLUS : 0);
  return out;
}
/** The hybrid job a pair of weapon kinds opens, if any. */
function hybridOf(a, b) {
  for (const id of Object.keys(JOBS)) { const j = JOBS[id]; if (j.kind === "hybrid" && j.wk.includes(a) && j.wk.includes(b) && a !== b) return id; }
  return null;
}
/** Why `ch` may not take job `j` right now ("" when it may; place and gold are checked by the action). */
function jobOk(ch, j) {
  const job = Object.hasOwn(JOBS, j) ? JOBS[j] : null;
  if (!job || job.kind === "none") return "없는 직업입니다";
  if (ch.job !== "adventurer") return "모험가만 전직할 수 있습니다";
  const [a, b] = job.wk;
  if (job.kind === "single") return ch.wm[a].lv >= JOB_WM ? "" : `[${WK_NAME[a]}] 숙련 ${JOB_WM}이 필요합니다`;
  return ch.wm[a].lv >= JOB_WM && ch.wm[b].lv >= JOB_WM ? "" : `[${WK_NAME[a]}]${pp(WK_NAME[a], "과와")} [${WK_NAME[b]}] 숙련이 모두 ${JOB_WM}이어야 합니다`;
}
const isHybrid = (ch) => !!JOBS[ch.job] && JOBS[ch.job].kind === "hybrid";
/** Until J2: the old class whose skills and gauge the weapon in hand brings ("" for the bow or bare hands). */
const legacyCls = (ch) => (ch.eq.weapon ? LEGACY_CLS[ITEMS[ch.eq.weapon.id].wk] || "" : "");
const legacySkills = (ch) => SKILLS[legacyCls(ch)] || [];

/**
 * Everything about a character that only changes with their sheet (cached in `p.stc` until the sheet
 * changes): the six stats through their soft caps, the weapon's scaling and mastery, gear. `arm` is the
 * WKIND in hand, `mag` 1 for a magic weapon. stats(p) adds the moment's buffs on top.
 */
function deriveStats(p) {
  if (p.stc) return p.stc;
  const ch = p.ch, lv = ch.lvl, b = gearBonus(ch), w = ch.eq.weapon, wk = weaponKind(ch), arm = WKIND[wk];
  const E = {};
  for (const k of ST_ORDER) E[k] = eff(ch.st[k]);
  const wAtk = w ? (ITEMS[w.id].base.atk || 0) * (1 + 0.1 * w.enh) : 0;
  const sc = scaleOf(ch, wk);
  let core = SFX.atk[0] + SFX.atk[1] * lv;
  for (const k of Object.keys(sc)) core += sc[k] * E[k];
  const wm = w ? ch.wm[wk].lv : 0;
  const luk = E.luk, dex = E.dex, wil = E.wil, wis = E.wis;
  p.stc = {
    mhp: Math.round(SFX.hp[0] + SFX.hp[1] * lv + SFX.hp[2] * wil + b.hp),
    mmp: Math.round(SFX.mp[0] + SFX.mp[1] * lv + SFX.mp[2] * wis + SFX.mp[3] * E.int + b.mp),
    atk0: (core + wAtk * (1 + SFX.wmAtk * wm) + (b.atk - wAtk)) * (1 + b.atkp / 100),
    core,
    def: Math.round(SFX.def[0] * lv + SFX.def[1] * wil) + Math.round(b.def),
    crit: Math.min(SFX.critCap, SFX.crit[0] + (arm.crit || 0) + SFX.crit[1] * luk + (w ? w.enh : 0) + b.crit),
    critd: SFX.critd[0] + SFX.critd[1] * luk + b.critd / 100,
    ls: Math.min(15, b.ls), spd0: BASE_SPD * (1 + Math.min(40, b.spd) / 100), xp: b.xp, gold: b.gold,
    mf: b.mf + Math.min(SFX.mf[1], SFX.mf[0] * luk),
    lg: b.lg, arm, wk, mag: arm.mag ? 1 : 0,
    acd: Math.round(arm.cd * (1 - Math.min(SFX.aspd[1], SFX.aspd[0] * dex)) * (b.lg.haste ? 0.85 : 1)),
    aspd: Math.min(SFX.aspd[1], SFX.aspd[0] * dex),
    eva: Math.min(SFX.eva[1], SFX.eva[0] * dex),
    sneak: SFX.sneak * dex,
    cdr: Math.min(SFX.cdr[1], SFX.cdr[0] * wis),
    mpReg: SFX.mpReg * wis,
    burst: SFX.burst * E.int,
    proc: 1 + SFX.proc * luk,
    kbr: Math.min(SFX.kbr[1], SFX.kbr[0] * E.str),
    poise: Math.min(SFX.poise[1], SFX.poise[0] * wil),
    res: Math.min(SFX.res[1], SFX.res[0] * wil),
  };
  return p.stc;
}

// ── weapon mastery

/** Mastery experience for the weapon in hand; levels it up (events, toasts, old skills learned until J2). */
function gainWm(S, p, n) {
  const ch = p.ch;
  if (!ch.eq.weapon || !(n > 0)) return;
  const wk = ITEMS[ch.eq.weapon.id].wk, r = ch.wm[wk];
  if (r.lv >= WM_MAX) return;
  r.xp += Math.round(n);
  p.dirty = true;
  while (r.lv < WM_MAX && r.xp >= wmNeed(r.lv)) {
    r.xp -= wmNeed(r.lv);
    r.lv++;
    p.stc = null;
    S.maps[p.map].ev.push(["wm", p.eid, WK_ORDER.indexOf(wk), r.lv]);
    saveSoon(p);
    // until J2 the old skills of the hand's class come with mastery (at the level they used to)
    const learned = [];
    legacySkills(ch).forEach((sk, i) => { if (sk.lv === r.lv) { const key = qsLearn(ch, i); learned.push(`[${sk.name}]${key ? `(단축칸 ${key}번)` : ""}`); } });
    toast(p, `[${WK_NAME[wk]}] 숙련 ${r.lv}!${learned.length ? ` 새 스킬 ${learned.join(", ")}` : ""}`);
    if (r.lv === JOB_WM && ch.job === "adventurer") {
      const j = Object.keys(JOBS).find((id) => JOBS[id].kind === "single" && JOBS[id].wk[0] === wk);
      toast(p, `[${WK_NAME[wk]}] 숙련 ${JOB_WM}! 전직관 아르센에게 가면 [${JOBS[j].name}]${pp(JOBS[j].name, "으로")} 전직할 수 있습니다.`);
    }
  }
  if (r.lv >= WM_MAX) r.xp = 0;
}
/**
 * A blow from `p` landed on `mob`: the action it came from (a basic attack +1, a skill +2) counts once,
 * if the monster is worth it (no more than WM_GAIN.lowTier tiers below; never a chest or a still thing).
 */
function wmHit(S, p, mob) {
  const d = MOBS[mob.k];
  if (d.chest || d.still || d.lv < toTier(p.ch.lvl) - WM_GAIN.lowTier) return;
  const [a, n] = p.hitAct || [p.actN | 0, p.actGain | 0];
  if (!a || a <= (p.wmAct | 0)) return;
  p.wmAct = a;
  gainWm(S, p, n);
}
/** A new action (`skill` true for a skill): blows it lands until the next one count toward its mastery. */
function newAct(p, skill) {
  p.actN = (p.actN | 0) + 1;
  p.actGain = skill ? WM_GAIN.skill : WM_GAIN.hit;
}
/** A kill: everyone who struck it (not idle party members) gets mastery by its tier and rank. */
function wmKill(S, rt, mob) {
  const d = MOBS[mob.k];
  if (d.chest || d.still) return;
  const n = (1 + Math.floor(d.lv / 2)) * WM_GAIN.kill[mob.el | 0] * (d.boss ? WM_GAIN.boss : 1);
  for (const pid of Object.keys(mob.by)) { const p = S.players[pid]; if (p && p.map === rt.id && !p.dead) gainWm(S, p, n); }
}

// ── accuracy, evasion, stagger

/** Chance (%) that a blow from `p` only grazes `mob`: deeper than you, a boss, an unpractised weapon. */
function grazeChance(p, mob) {
  const d = MOBS[mob.k];
  if (d.chest || d.still) return 0;
  const ch = p.ch, m = ch.eq.weapon ? ch.wm[ITEMS[ch.eq.weapon.id].wk].lv : 0, g = SFX.graze;
  return clamp(g[0] + g[1] * Math.max(0, Math.ceil(d.lv - toTier(ch.lvl) - 1e-9)) + (d.boss ? g[2] : 0) - m, 0, g[3]);
}
/** A monster's direct blow or shot at `p`: true if they slipped it ("회피"). */
function evadeBlow(S, rt, p) {
  const e = deriveStats(p).eva;
  if (!(e > 0) || rnd(S) * 100 >= e) return false;
  rt.ev.push(["h", p.eid, 0, 3, 1]);
  return true;
}
/** A charge, a leap, a slam, a fan, or any blow of an elite or a boss shoves `p` back and makes them reel. */
function staggerPlayer(S, rt, p, mob) {
  if (p.dead) return;
  const st = deriveStats(p), m = mapOfS(S, p.map);
  const far = SFX.stagPx * (1 - st.kbr);
  if (mob) {
    const d = dist(mob.x, mob.y, p.x, p.y);
    if (d > 0.5) {
      const ux = (p.x - mob.x) / d, uy = (p.y - mob.y) / d;
      let go = 0;
      for (let k = 2; k <= far; k += 2) { if (!canStand(m, p.x + ux * k, p.y + uy * k)) break; go = k; }
      if (go > 0) { p.x += ux * go; p.y += uy * go; p.fix = true; p.mvAt = S.now; }
    }
  }
  p.stag = S.now + Math.round(SFX.stagMs * (1 - st.poise));
  rt.ev.push(["sg", p.eid]);
}

// ── arrows (D.2): simulated, wall-blocked, stepped every tick

/**
 * Loose an arrow from `p` at `mob` (or along the aim). `kind` 0 plain, 1 finisher, 2+ skill (the
 * client's trail); `pierce` how many monsters it passes through before it stops.
 */
function fireArrow(S, rt, p, mob, mult, pierce, kind) {
  const arm = deriveStats(p).arm, sh = arm.shot || WKIND.bow.shot;
  if (!rt.shots) rt.shots = [];
  const mine = rt.shots.filter((s) => s.pid === p.pid);
  if (mine.length >= SHOT_MAX) { const o = mine[0]; rt.shots.splice(rt.shots.indexOf(o), 1); rt.ev.push(["ae", o.id, Math.round(o.x), Math.round(o.y), 2]); }
  const [ux, uy] = aimVec(p, mob);
  const shot = { id: S.nextId++, pid: p.pid, x: p.x, y: p.y - 6, ux, uy, spd: sh.spd, left: arm.range || 150, r: sh.r, pierce, hit: [], mult, kind, x0: p.x, y0: p.y, act: p.actN | 0, gain: p.actGain | 0 };
  rt.shots.push(shot);
  rt.ev.push(["ar", shot.id, Math.round(shot.x), Math.round(shot.y), Math.round(ux * 1000), Math.round(uy * 1000), shot.spd, kind, p.eid]);
  return shot;
}
/** How hard an arrow lands on `mob`: from 90 px or more a sure eye adds DEX's ranged power. */
function arrowMult(p, shot, mob) {
  const d = dist(shot.x0, shot.y0, mob.x, mob.y);
  return shot.mult * (d >= SFX.far ? 1 + deriveStats(p).sneak : 1);
}
/** Move every arrow on one map one tick on: walls stop them, monsters take them (pierce + 1 at most). */
function shotTick(S, rt, dt) {
  if (!rt.shots || !rt.shots.length) return;
  const m = mapOfS(S, rt.id);
  for (let i = rt.shots.length - 1; i >= 0; i--) {
    const s = rt.shots[i], p = S.players[s.pid];
    const end = (how) => { rt.shots.splice(i, 1); rt.ev.push(["ae", s.id, Math.round(s.x), Math.round(s.y), how]); };
    // a shooter who fell or left takes their arrows with them
    if (!p || p.dead || p.map !== rt.id) { end(2); continue; }
    const seg = Math.min(s.left, s.spd * dt);
    // how far along the segment it gets before a wall (flying height: the ground point is 6 px below)
    let free = seg, wall = false;
    for (let k = 3; k <= seg + 0.01; k += 3) { if (!canFly(m, s.x + s.ux * k, s.y + 6 + s.uy * k) || solidAt(m, s.x + s.ux * k, s.y + 3 + s.uy * k)) { free = Math.max(0, k - 3); wall = true; break; } }
    const hits = [];
    for (const o of rt.mobs) {
      if (o.dead || s.hit.includes(o.id)) continue;
      const rx = o.x - s.x, ry = o.y - 6 - s.y, along = rx * s.ux + ry * s.uy;
      if (along < -4 || along > free + 4) continue;
      if (Math.abs(rx * s.uy - ry * s.ux) <= s.r + big(o) + 4) hits.push([along, o]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    let stop = null;
    for (const [along, o] of hits) {
      s.hit.push(o.id);
      p.hitAct = [s.act, s.gain];
      hurtMob(S, rt, o, p, arrowMult(p, s, o));
      p.hitAct = null;
      if (s.hit.length > s.pierce) { stop = along; break; }
    }
    if (stop !== null) { s.x += s.ux * Math.max(0, stop); s.y += s.uy * Math.max(0, stop); end(0); continue; }
    s.x += s.ux * free; s.y += s.uy * free; s.left -= free;
    if (wall) end(1);
    else if (s.left <= 0.5) end(2);
  }
}
/** A bow's basic attack: aim, draw, loose. The third of a combo flies harder and goes through one more. */
function bowShot(S, rt, p, fin) {
  const st = deriveStats(p), c = st.arm;
  const mob = aimMob(rt, p, atkRange(p), c.arc || AIM_CONE);
  if (mob) face(p, mob);
  const [ux, uy] = aimVec(p, mob);
  const far = mob ? dist(p.x, p.y, mob.x, mob.y) : c.range * 0.7;
  rt.ev.push(["a", p.eid, 6, Math.round(p.x + ux * far), Math.round(p.y - 6 + uy * far), p.dir, p.combo]);
  fireArrow(S, rt, p, mob, (c.mult || 1) * (fin ? FINISH.mult : 1), fin ? 1 : 0, fin ? 1 : 0);
}

// ── migration of the four-class sheets (B.11) and the test hero

/** Old skill-training prices (the refund on migration). */
const oldSkillCost = (sk, L) => ({ gold: Math.round((50 + sk.lv * 25) * L * (L + 1) / 2), xp: Math.round(tierXp(sk.lv) * 0.12 * L) });
/**
 * Spend `points` one by one on the stat furthest below its share (ties: stat order), none past 99.
 * Returns the stats and the experience that path cost (the xpt of a migrated sheet).
 */
function allocate(shares, points) {
  const st = freshSt();
  let xpt = 0;
  for (let n = 0; n < points; n++) {
    let best = null, bd = -Infinity;
    for (const k of ST_ORDER) {
      if (st[k] >= ST_CAP) continue;
      const gap = (shares[k] || 0) * (n + 1) - (st[k] - ST_BASE);
      if (gap > bd + 1e-9) { bd = gap; best = k; }
    }
    if (!best) break;
    xpt += pointCost(1 + n, st[best]);
    st[best]++;
  }
  return { st, xpt };
}
/**
 * A sheet from the four-class days (has `cls`, no `job`): a level 4L−3 hero with stats laid out like
 * its class, the class weapon's mastery at its old level, the class's job from old level 20, every
 * point of training and every skill level paid back, one free reset, and nothing taken from the bag.
 */
function migrateV10(ch) {
  let cls = ch.cls === "ranger" || ch.cls === "archer" ? "lancer" : ch.cls;
  if (!OLD_CLASS[cls]) cls = "warrior";
  const L = clamp(Math.floor(num(ch.lvl) ? ch.lvl : 1), 1, 50);
  let [wk, job] = OLD_CLASS[cls];
  const w = isObj(ch.eq) && ch.eq.weapon && typeof ch.eq.weapon.id === "string" ? ch.eq.weapon.id : "";
  if (cls === "mage" && w.startsWith("w_book_")) { wk = "book"; job = "warlock"; }
  const lvl = Math.min(197, 4 * L - 3);
  const { st, xpt } = allocate(BUILD[wk], lvl - 1);
  let xp = num(ch.xp) ? Math.max(0, Math.floor(ch.xp)) : 0, gold = num(ch.gold) ? Math.max(0, Math.floor(ch.gold)) : 0;
  // stat training: 120 + 40n experience a point, all back
  const tr = isObj(ch.tr) ? ch.tr : {};
  for (const k of ["str", "vit", "int", "grd"]) { const n = clamp(tr[k] | 0, 0, 100000); xp += 120 * n + 20 * n * (n - 1); }
  // skill levels: every level bought, gold and experience, back
  const skl = Array.isArray(ch.skl) ? ch.skl : [];
  SKILLS[cls].forEach((sk, i) => { const top = clamp(skl[i] | 0 || 1, 1, 10); for (let l = 1; l < top; l++) { const c = oldSkillCost(sk, l); gold += c.gold; xp += c.xp; } });
  const wm = freshWm();
  wm[wk].lv = Math.min(WM_MAX, L);
  if (cls === "mage") { const o = wk === "book" ? "staff" : "book"; wm[o].lv = Math.max(1, Math.floor(0.6 * L)); }
  ch.cnt = isObj(ch.st) ? ch.st : {};
  Object.assign(ch, { job: L >= JOB_WM ? job : "adventurer", lvl, st, xp: Math.min(2e9, xp), xpt, gold, wm, rs: 1, sw: 1 });
  // skill entries are cleared (J2 fills its own); until then the old skills the mastery already holds go back on the bar
  if (Array.isArray(ch.qs)) {
    ch.qs = ch.qs.map((v) => (Array.isArray(v) && v[0] === "s" ? null : v));
    SKILLS[cls].forEach((sk, i) => { const j = ch.qs.indexOf(null); if (sk.lv <= L && j >= 0 && j < 9) ch.qs[j] = ["s", i]; });
  }
  if (isObj(ch.eq) && !("weapon2" in ch.eq)) ch.eq.weapon2 = null;
  delete ch.cls; delete ch.tr; delete ch.skl;
  return ch;
}
/** Clamp a v10 sheet's jobs-and-stats fields (every load; never trust what was stored). */
function cleanJobs(ch) {
  const st = isObj(ch.st) ? ch.st : {};
  ch.st = {};
  for (const k of ST_ORDER) ch.st[k] = clamp(Math.floor(num(st[k]) ? st[k] : ST_BASE), ST_BASE, ST_CAP);
  // a level is one point above 5; a sheet claiming more than 200 gives the extra back from its highest stats
  while (levelOf(ch.st) > MAXLV) { const k = ST_ORDER.reduce((a, b) => (ch.st[b] > ch.st[a] ? b : a)); ch.st[k]--; }
  ch.lvl = levelOf(ch.st);
  ch.xp = num(ch.xp) ? clamp(Math.floor(ch.xp), 0, 2e9) : 0;
  ch.xpt = num(ch.xpt) ? clamp(Math.floor(ch.xpt), 0, 2e9) : 0;
  const wm = isObj(ch.wm) ? ch.wm : {};
  ch.wm = {};
  for (const k of WK_ORDER) {
    const r = isObj(wm[k]) ? wm[k] : {}, lv = clamp(r.lv | 0 || 1, 1, WM_MAX);
    ch.wm[k] = { lv, xp: lv >= WM_MAX ? 0 : clamp(Math.floor(num(r.xp) ? r.xp : 0), 0, wmNeed(lv) - 1) };
  }
  // a job once taken is never revoked, whatever the mastery says now
  ch.job = typeof ch.job === "string" && Object.hasOwn(JOBS, ch.job) ? ch.job : "adventurer";
  ch.rs = clamp(ch.rs | 0, 0, 9);
  ch.sw = ch.sw ? 1 : 0;
}
/**
 * A character for tests and probes: `wk` the weapon kind in hand (a tier-1 piece), `lvl` the level
 * (stats laid out by that weapon's BUILD unless `st` is given), `wm` mastery levels by kind,
 * `job` a job id. With `migrate`, mastery and job follow the old-class migration for that level.
 */
export function hero(name, o = {}) {
  const ch = newChar(name, o.look || []);
  const wk = WK_ORDER.includes(o.wk) ? o.wk : "sword";
  ch.eq.weapon = plain(`w_${WK_ID[wk]}_1`);
  ch.sw = 1;
  const lvl = clamp(o.lvl | 0 || 1, 1, MAXLV);
  if (isObj(o.st)) { for (const k of ST_ORDER) if (num(o.st[k])) ch.st[k] = o.st[k]; }
  else { const a = allocate(BUILD[wk], lvl - 1); ch.st = a.st; ch.xpt = a.xpt; }
  ch.lvl = levelOf(ch.st);
  if (o.migrate) {
    const L = Math.round(toTier(ch.lvl));
    ch.wm[wk].lv = Math.min(WM_MAX, L);
    if (L >= JOB_WM) ch.job = Object.keys(JOBS).find((id) => JOBS[id].kind === "single" && JOBS[id].wk[0] === wk);
  }
  if (isObj(o.wm)) for (const k of WK_ORDER) if (num(o.wm[k])) ch.wm[k].lv = clamp(o.wm[k] | 0, 1, WM_MAX);
  if (typeof o.job === "string" && Object.hasOwn(JOBS, o.job)) ch.job = o.job;
  if (o.wk2) ch.eq.weapon2 = plain(`w_${WK_ID[o.wk2]}_1`);
  return ch;
}
