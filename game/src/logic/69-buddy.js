// ── 짝꿍부르기: a saved contact and a room-local NPC, never an account or party member.

const BUDDY_COOLDOWN = 60 * 60000;
const BUDDY_PARTY_NOTICE = "다른 유저와 파티를 하여, 짝꿍은 집으로 돌아갑니다";
const BUDDY_ASSIST = { share: 0.15, bossShare: 0.08, perHit: 0.18, duration: 4200, range: 120, maxTargets: 5, guardRange: 64, guardHealCd: 10000, guardHealRate: 0.06 };
const BUDDY_MODES = ["neutral", "attack", "guard", "passive"];
const BUDDY_AI_LINES = {
  attack: "알겠어! 주변 몬스터는 내가 먼저 앞장서서 상대할게!",
  neutral: "좋아, 네가 먼저 노리는 녀석부터 맞춰서 도울게.",
  guard: "맡겨 줘! 다가오는 적을 막아 주고 네 체력도 챙길게.",
  passive: "응, 전투는 잠시 쉬고 옆에서 조용히 따라갈게.",
};
const BUDDY_NAMES = ["보리", "솔이", "두리", "단비", "포포", "모루", "여울", "라온", "콩이", "나루", "초리", "새봄", "밤톨", "하루", "별이"];
const BUDDY_JOBS = Object.keys(JOBS).filter((job) => JOBS[job].wk.length);
const BUDDY_LINES = {
  town: [
    "오늘 날씨 참 좋다. 벚꽃나무길에 가볼래?",
    "모험은 잠깐 쉬어도 돼. 오늘은 천천히 걸을까?",
    "길을 잊어버리면 지도를 열어봐. 가 본 곳은 이름부터 반갑더라.",
    "마을의 이동비석은 먼저 깨워 두면 다음에 편하게 올 수 있어.",
    "가방에 간식 넣어 뒀어? 물어보는 거야. 달라는 건 아니고… 조금만?",
    "나도 멋지게 걷고 싶은데, 신나면 꼬리부터 흔들려.",
    "장터 앞을 지날 때마다 발걸음이 느려져. 맛있는 냄새가 나거든!",
    "오늘 같이 걷는 길은 기억해 뒀다가, 다음에는 내가 안내할게.",
  ],
  rain: ["빗소리 들려? 오늘은 발맞춰 걷기 좋겠다.", "비 오는 날엔 모닥불 생각이 나. 따뜻한 데서 조금 쉴까?", "물웅덩이에 하늘이 들어 있어. 작은 하늘은 밟지 말고 가자."],
  wind: ["바람이 앞서 달려가네. 천천히 따라가도 기다려 줄까?", "바람 불 때마다 귀가 펄럭여. 오늘은 두 귀로 날씨를 알아볼 수 있어.", "바람이 시원하다. 우리 조금만 더 걸을까?"],
  fog: ["저 앞이 뿌옇다. 서로 보이는 거리에서 천천히 가자.", "안개가 걷히면 무슨 색이 먼저 보일까?", "안개 속에선 발소리부터 들려. 네 발소리는 이제 알 것 같아."],
  night: ["조용하다. 발소리도 오늘은 살금살금 나는 것 같아.", "밤바람이 차네. 불빛 있는 데까지 같이 걷자.", "저 창문에 아직 불이 켜져 있어. 누가 늦게까지 책을 읽나 봐.", "어두워지면 마을 길이 새로워 보여. 낮에도 같은 길을 걸었는데 말이야."],
  blossom_trail: ["분홍 꽃잎이 유채꽃 위에 내려앉았어. 저기 잠깐 서 볼래?", "꽃잎 떨어지는 속도에 맞춰 걸으면 산책이 길어지는 기분이야.", "바람 불 때 봐! 길 전체가 분홍색으로 흔들려.", "유채꽃 사이로 난 길이 어디까지 이어지는지 같이 가 보자.", "벚꽃잎 하나가 네 어깨에 앉았어. 바람이 준 기념품인가 봐."],
  sunset_beach: ["파도 한 번만 더 보고 갈까? …아까도 그렇게 말했지?", "저 큰 모닥불 옆에 앉으면 바다 소리가 더 잘 들릴 것 같아.", "노을이 물 위에 길을 내 줬네. 저 끝에는 뭐가 있을까?", "젖은 모래가 반짝여. 발자국을 남기면 다음 파도가 지워 주겠지?", "오늘 기억하고 싶은 소리가 있어. 바로 이 파도 소리야."],
  camp: ["불 옆에서 숨 좀 돌리자. 장작 타는 소리 좋다.", "여기 앉아 있으면 방금 힘들었던 일도 금방 옛날 얘기 같다.", "잠깐 쉴 동안 가방도 정리할까? 내 건 간식 자리부터 비워 둘게."],
  field: ["낯선 사냥터에서는 몬스터를 한 마리씩 상대해 보자.", "잠깐 쉬고 싶으면 모닥불이나 이동비석 쪽으로 가자.", "뒤로 돌아갈 길을 먼저 봐 두면 마음이 놓이더라.", "발자국이 여러 개네. 앞에 뭐가 있는지 살피면서 가자."],
  fight: ["지금 상대하는 녀석, 가까운 쪽에서 도울게!", "한 마리씩 보자. 먼저 맞붙은 상대에 집중할게.", "네가 물러서면 나도 따라갈게. 천천히 숨을 고르자.", "손발이 척척 맞네. 다음 공격은 네 박자에 맞출게."],
  boss: ["큰 녀석이다. 바닥이 빛나면 먼저 피하자.", "우두머리한텐 한 걸음씩 다가가자. 난 가까이 붙은 적부터 봐 줄게.", "몸을 크게 웅크리면 큰 공격이 올 수도 있어. 발밑을 보자."],
  danger: ["발밑이 위험해. 옆으로 빠지자!", "저 표시가 사라질 때까지 가장자리에서 기다릴게.", "이쪽 땅이 안전해 보여. 한 발 물러서자!"],
  hurt: ["체력이 많이 줄었어. 물약부터 챙기자.", "잠깐 물러날까? 가까운 모닥불에서 숨을 돌리자.", "가방에 회복 물약 있지? 여기서 한 모금 마시고 가자."],
  apt: ["난 네가 있는 곳에서 조금 떨어진 바닥부터 살필게.", "방 하나씩 살피면 놓친 쓰레기도 금방 보여.", "깨끗해진 바닥에 우리 발자국만 남겠다!"],
  apt_dump: ["쓰레기통이 찼어. 나 반납대에 잠깐 다녀올게!", "반납대에서 비우고 올게. 네가 줍던 쪽은 남겨 둘게.", "가득 찬 통은 들 때 소리가 달라. 반납하고 다시 올게!"],
  diner: ["손님 말풍선에 주문이 있어. 한 자리씩 챙기자.", "네가 조리대에 있으면 난 테이블 쪽을 먼저 살필게.", "같은 요리를 주문하신 손님이 계시면 한 분씩 가져다 드리자."],
  diner_clean: ["빈그릇이 보여. 싱크대에 가져다 둘게.", "다 드신 자리부터 치워야 다음 손님이 앉지. 그릇은 내가 챙길게.", "접시 내려놓는 소리 들리면 테이블을 한 번 둘러보자."],
  forge: ["네가 주괴를 올려 줘. 모루 옆에서 둘이 스페이스 박자를 맞추자!", "손님 주문에 맞는 색 주괴를 가져와 줘. 모루에서 기다릴게.", "집게로 주괴를 잡아 주면 내가 망치를 들게."],
  forge_beat: ["표시가 중앙에 올 때 같이 눌러 보자.", "한 박자 엇나가도 괜찮아. 다음 음표에 다시 맞추자.", "망치를 들었어. 네 박자에 맞춰 내리칠게."],
  alch: ["풀무로 온도를 맞춰 줘. 나는 약초를 골라서 솥과 진열대를 맡을게.", "솥 옆에서 색이 바뀌는 걸 볼게. 풀무 박자를 부탁해!", "온도가 맞으면 거품이 고르게 올라와. 그때 병을 준비할게."],
  alch_pump: ["풀무는 내가 맡을게. 약초가 들어가면 온도를 올릴게.", "가마 온도는 내가 볼게. 약초 순서를 확인해 줘.", "솥의 거품을 봐 줘. 넘치면 부채로 식힐 수 있어."],
  alch_hot: ["솥이 너무 뜨겁다. 잠깐 풀무에서 손을 떼자.", "지금은 불을 조금 식힐 때야. 거품이 가라앉으면 다시 맞추자.", "거품이 커졌어! 솥 곁에서 넘치지 않게 조심하자."],
  lib: ["빌릴 책은 장르 책장에서, 반납할 책도 같은 장르에 꽂아 줘.", "안내데스크 쪽을 봐 줘. 저쪽 책장은 내가 살펴볼게.", "손님 말풍선에 찾는 장르가 떠 있어. 거기서부터 보면 돼."],
  lib_return: ["이 책은 원래 자리로 가져다 둘게. 책장 위 장르를 확인할게.", "반납할 책이 들어왔어. 기록해 두고 책장에 꽂자.", "반납도 끝까지 해야 일이 마무리돼. 나는 책장으로 갈게."],
  shift_end: ["수고했어! 나오면 같이 천천히 걷자.", "오늘 네 덕분에 일이 손에 착착 붙었어.", "정리하고 나면 좀 쉬자. 다음에 또 같이 하자!"],
};

function buddyClean(value) {
  if (!value || !BUDDY_NAMES.includes(value.name) || !BUDDY_JOBS.includes(value.job)) return null;
  const kit = JOBS[value.job].wk;
  return {
    name: value.name, job: value.job, look: cleanLook(value.look),
    wk: kit.includes(value.wk) ? value.wk : kit[0],
    nextAt: Number.isSafeInteger(value.nextAt) ? Math.max(0, value.nextAt) : 0,
    active: value.active === true,
    ai: BUDDY_MODES.includes(value.ai) ? value.ai : "neutral",
  };
}

function buddyValidate(S, p, a) {
  if (!["call", "leave", "new", "ai"].includes(a.k)) return bad("알 수 없는 짝꿍 요청이에요.");
  const b = p.ch.buddy;
  if (a.k === "ai") {
    if (p.dead) return bad("쓰러진 상태에서는 지시할 수 없어요.");
    if (!b) return bad("먼저 짝꿍을 불러 주세요.");
    return BUDDY_MODES.includes(a.ai) ? OK : bad("알 수 없는 행동 모드예요.");
  }
  if (a.k !== "leave" && buddyInParty(S, p)) return bad("다른 유저와 파티 중에는 짝꿍을 부를 수 없어요.");
  if (p.dead || inDim(p) || p.ab) return bad("현재 활동을 마치고 짝꿍에게 연락해 주세요.");
  if (p.buddyCall) return bad("짝꿍이 메시지를 확인하고 있어요.");
  if (a.k === "leave") return b?.active ? OK : bad("곁에 있는 짝꿍이 없어요.");
  if (typeof a.m !== "string" || !a.m.trim() || a.m.length > 60 || /[\x00-\x1f\x7f]/.test(a.m)) return bad("메시지를 1~60자로 써 주세요.");
  if (a.k === "call") return b?.active ? bad("짝꿍이 이미 곁에 있어요.") : OK;
  return b && S.now < b.nextAt ? bad("새 짝꿍에게 연락하기까지 아직 시간이 남았어요.") : OK;
}

function buddyApply(S, p, a) {
  if (a.k === "ai") {
    p.ch.buddy.ai = a.ai;
    const b = buddyOf(S, p);
    if (b) {
      b.ch.ai = a.ai;
      if (a.ai === "passive") { b.target = null; b.engaged.clear(); }
      p.buddySay = [b.eid, BUDDY_AI_LINES[a.ai]];
    }
  } else if (a.k === "leave") {
    p.ch.buddy.active = false;
    buddyRemove(S, p);
  } else {
    if (!p.ch.buddy || a.k === "new") {
      const prevAi = BUDDY_MODES.includes(p.ch.buddy?.ai) ? p.ch.buddy.ai : "neutral";
      buddyRemove(S, p);
      const job = BUDDY_JOBS[ri(S, 0, BUDDY_JOBS.length - 1)], kit = JOBS[job].wk;
      const names = BUDDY_NAMES.filter((name) => name !== p.ch.name && name !== p.ch.buddy?.name);
      const look = LOOK_MAX.map((max, slot) => ri(S, slot === 8 ? 1 : 0, max));
      p.ch.buddy = { name: names[ri(S, 0, names.length - 1)], job, wk: kit[ri(S, 0, kit.length - 1)], look, nextAt: S.now + BUDDY_COOLDOWN, active: false, ai: prevAi };
    }
    p.ch.buddy.active = false;
    p.buddyCall = { replyAt: S.now + 850, arriveAt: S.now + 1800 };
    p.buddyMail = [0, a.m.trim()];
  }
  p.dirty = true;
  saveSoon(p);
}

const buddyPid = (p) => "buddy:" + p.pid;
const buddyOf = (S, p) => S.buddies[buddyPid(p)];
const buddyInParty = (S, p) => !!S.parties[p.party]?.m.some((pid) => pid !== p.pid && S.players[pid]);
const buddyShift = (dim, p) => !!dim?.coop?.pl[buddyPid(p)];

function buddyReturnForParty(S, p) {
  if ((!p.ch.buddy?.active && !p.buddyCall) || !buddyInParty(S, p)) return;
  const dim = S.dims[p.map];
  p.ch.buddy.active = false;
  p.buddyCall = null;
  p.buddyMail = [2, BUDDY_PARTY_NOTICE];
  buddyRemove(S, p);
  toast(p, BUDDY_PARTY_NOTICE);
  p.dirty = true;
  saveSoon(p);
  if (buddyShift(dim, p) && dim.coop.state !== "end") {
    toast(p, "짝꿍과 하던 근무를 마치고 대기실로 돌아갑니다.");
    coopClose(S, dim);
  }
}

function buddyRemove(S, p) {
  const b = buddyOf(S, p);
  p.buddySay = null;
  if (!b) return;
  if (S.maps[b.map]) S.maps[b.map].who = true;
  delete S.buddies[b.pid];
}

function buddyPlace(S, b, map, x, y, exact = false) {
  if (S.maps[b.map]) S.maps[b.map].who = true;
  b.map = map;
  const m = mapOfS(S, map);
  const offsets = [[-2 * T, 0], [2 * T, 0], [0, T], [0, -T], [-T, 0], [T, 0]];
  const spot = exact ? [x, y] : offsets.map(([dx, dy]) => [x + dx, y + dy]).find(([sx, sy]) =>
    canStand(m, sx, sy) && canStand(m, (sx + x) / 2, (sy + y) / 2));
  [b.x, b.y] = spot || [x, y];
  b.route = []; b.goal = ""; b.routeAt = 0;
  b.engaged.clear(); b.target = null; b.trash = null; b.anvil = null; b.forgeRetryAt = 0;
  S.maps[map].who = true;
}

function buddySpawn(S, p) {
  const ch = p.ch.buddy;
  const b = { pid: buddyPid(p), eid: S.nextId++, ch: { ...ch, lvl: p.ch.lvl }, dir: p.dir, toast: [],
    lineAt: S.now + 12000, atkAt: 0, hp: 1, owner: p.pid, engaged: new Map(), heard: [] };
  S.buddies[b.pid] = b;
  buddyPlace(S, b, p.map, p.x, p.y);
  return b;
}

function buddySelf(p) {
  const b = p.ch.buddy;
  return b ? [b.name, b.job, p.ch.lvl, b.active ? 1 : 0, Math.max(0, b.nextAt - p.S.now), p.buddyCall ? 1 : 0, b.ai || "neutral"] : null;
}

function buddyView(p, out) {
  if (p.buddyMail) { out.bm = p.buddyMail; p.buddyMail = null; }
  if (p.buddySay) { out.bs = p.buddySay; p.buddySay = null; }
}

// Search from the current tile only when the goal changes or a route needs refreshing.
// Walk all intermediate tiles, including in cluttered shift maps.
const BUDDY_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function buddyRoute(m, b, tx, ty, radius, accept, pass) {
  const start = Math.floor(b.y / T) * m.w + Math.floor(b.x / T);
  const q = [start], prev = new Map([[start, -1]]);
  let end = -1, best = Infinity;
  for (let i = 0; i < q.length && i < 2304; i++) {
    const at = q[i], x = at % m.w, y = (at / m.w) | 0;
    const [px, py] = tilePx([x, y]), d = dist(px, py, tx, ty);
    if (d <= radius && accept(px, py)) { end = at; break; }
    if (d < best) { best = d; end = at; }
    for (const [dx, dy] of BUDDY_STEPS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const n = ny * m.w + nx;
      if (prev.has(n)) continue;
      const [sx, sy] = tilePx([nx, ny]);
      if (!canStand(m, sx, sy) || (pass && !pass(sx, sy))) continue;
      prev.set(n, at); q.push(n);
    }
  }
  const path = [];
  for (let at = end; at !== start && at >= 0; at = prev.get(at)) path.push(tilePx([at % m.w, (at / m.w) | 0]));
  const center = tilePx([start % m.w, (start / m.w) | 0]);
  if (dist(b.x, b.y, ...center) > 1 && canStand(m, ...center)) path.push(center);
  return path.reverse();
}

function buddyWalk(S, b, x, y, radius, dt, accept = () => true, key = "", pass = null) {
  if (dist(b.x, b.y, x, y) <= radius && accept(b.x, b.y)) { b.route = []; b.goal = ""; return true; }
  const m = mapOfS(S, b.map);
  const goal = [Math.floor(x / T), Math.floor(y / T), key].join();
  if (S.now >= b.routeAt && (goal !== b.goal || !b.route.length)) {
    b.goal = goal;
    b.route = buddyRoute(m, b, x, y, radius, accept, pass);
    b.routeAt = S.now + (b.route.length ? 350 : 950);
  }
  const next = b.route[0];
  if (!next) return false;
  const [nx, ny] = next, dx = nx - b.x, dy = ny - b.y, left = Math.hypot(dx, dy);
  if (left < 0.01) { b.route.shift(); return false; }
  const speed = inDim(b) ? 143 : 113;
  const step = Math.min(left, dt * speed);
  const px = b.x + dx * step / left, py = b.y + dy * step / left;
  if (!canStand(m, px, py) || (pass && !pass(px, py))) { b.route = []; return false; }
  b.dir = dirOf(dx, dy);
  b.x = px; b.y = py;
  if (step === left) b.route.shift();
  return false;
}

/** Build a small, expiring allowance from direct player damage on each target. */
function buddyEngage(S, p, mob, damage) {
  const b = buddyOf(S, p);
  if (b?.map !== p.map || MOBS[mob.k].chest || S.dims[p.map] || buddyInParty(S, p)) return;
  const previous = b.engaged.get(mob);
  const share = mob.el === 2 || MOBS[mob.k].boss ? BUDDY_ASSIST.bossShare : BUDDY_ASSIST.share;
  const credit = (previous?.until >= S.now ? previous.credit : 0) + damage * share;
  b.engaged.delete(mob);
  b.engaged.set(mob, { credit: Math.min(credit, Math.max(1, stats(p).atk * 0.36)), until: S.now + BUDDY_ASSIST.duration });
  if (b.engaged.size > BUDDY_ASSIST.maxTargets) b.engaged.delete(b.engaged.keys().next().value);
}

function buddyDanger(S, rt, x, y) {
  const near = (e) => dist(x, y, e.x, e.y) <= e.r + 8;
  return rt.tele.some((e) => e.at >= S.now && e.at <= S.now + 2000 && near(e)) ||
    rt.pools.some((e) => e.until > S.now && near(e));
}

function buddyTarget(S, p, b, rt, mode) {
  if (mode === "passive") return null;
  let best = null, priority = Infinity;
  for (const [mob, hit] of b.engaged) {
    const d = dist(p.x, p.y, mob.x, mob.y);
    if (mob.dead || S.now > hit.until || d > BUDDY_ASSIST.range) { b.engaged.delete(mob); continue; }
    if (mob.dive || hit.credit < 1) continue;
    const rank = d + dist(b.x, b.y, mob.x, mob.y) * 0.2 - (mob === b.target ? 22 : 0) - (mob.tgt === p.pid ? 30 : 0);
    if (rank < priority) { best = mob; priority = rank; }
  }
  if (best || mode === "neutral") return best;
  for (const mob of rt.mobs) {
    if (mob.dead || mob.dive || MOBS[mob.k].chest) continue;
    const d = dist(p.x, p.y, mob.x, mob.y);
    if (d > BUDDY_ASSIST.range) continue;
    if (mode === "guard" && mob.tgt !== p.pid && d > BUDDY_ASSIST.guardRange) continue;
    const rank = d + dist(b.x, b.y, mob.x, mob.y) * 0.2 - (mob === b.target ? 22 : 0) - (mob.tgt === p.pid ? 40 : 0);
    if (rank < priority) { best = mob; priority = rank; }
  }
  return best;
}

function buddyFight(S, p, b, rt, m, dt) {
  if (p.sit || p.recall || dist(b.x, b.y, p.x, p.y) > BUDDY_ASSIST.range) { b.target = null; b.engaged.clear(); return false; }
  const mode = p.ch.buddy?.ai || "neutral";
  const safe = (x, y) => !buddyDanger(S, rt, x, y);
  if (!safe(b.x, b.y)) {
    buddyWalk(S, b, p.x, p.y, 64, dt, safe, "evade");
    return true;
  }
  if (mode === "passive") { b.target = null; b.engaged.clear(); return false; }
  const st = stats(p);
  if (mode === "guard" && p.hp > 0 && p.hp < st.mhp * 0.65 && S.now >= (b.healAt || 0)) {
    const heal = Math.min(st.mhp - p.hp, Math.max(1, Math.round(st.mhp * BUDDY_ASSIST.guardHealRate * elementHealFactor(S, p))));
    if (heal > 0) {
      p.hp += heal;
      b.healAt = S.now + BUDDY_ASSIST.guardHealCd;
      rt.ev.push(["h", p.eid, heal, 1, 0]);
      p.buddySay = [b.eid, "괜찮아? 내가 잠깐 회복해 줄게!"];
      p.dirty = true;
    }
  }
  const mob = b.target = buddyTarget(S, p, b, rt, mode);
  if (!mob) return false;
  const w = WKIND[b.ch.wk], reach = (w.shot ? Math.min(86, w.range) : w.range) - 3;
  const clear = (x, y) => {
    if (!safe(x, y) || dist(p.x, p.y, x, y) > BUDDY_ASSIST.range) return false;
    const n = Math.ceil(dist(x, y, mob.x, mob.y) / 6);
    for (let i = 1; i < n; i++) if (solidAt(m, x + (mob.x - x) * i / n, y + (mob.y - y) * i / n)) return false;
    return true;
  };
  const pass = (x, y) => safe(x, y) && dist(p.x, p.y, x, y) <= BUDDY_ASSIST.range;
  if (!buddyWalk(S, b, mob.x, mob.y, reach, dt, clear, "hunt-" + mob.id, pass) || S.now < b.atkAt) return true;
  face(b, mob);
  b.atkAt = S.now + (mode === "attack" ? Math.max(1250, Math.round(w.cd * 1.4)) : Math.max(1500, Math.round(w.cd * 1.65)));
  rt.ev.push(["a", b.eid, w.fx, Math.round(mob.x), Math.round(mob.y - 6), b.dir, 0]);
  const type = WEAPON_ELEMENT[b.ch.wk] || "physical";
  const hit = b.engaged.get(mob), base = Math.max(1, Math.min(2 + b.ch.lvl * 0.35, st.atk * BUDDY_ASSIST.perHit));
  const defence = MOBS[mob.k].def * (w.mag ? SFX.magDef : SFX.physDef);
  const raw = Math.max(1, Math.round((base * (mode !== "neutral" && (mob.el === 2 || MOBS[mob.k].boss) ? 0.65 : 1) - defence) * elementResist(S, mob, type, 0)));
  const damage = hit && hit.credit >= 1 ? Math.min(Math.floor(hit.credit), raw) : raw;
  if (hit && hit.credit >= 1) hit.credit -= damage;
  dealMob(S, rt, mob, p, damage, false, 0, [[type, damage]], { buddyCap: damage });
  return true;
}

function buddyContext(S, p, b, rt, m, c) {
  if (c?.pl[b.pid]) {
    if (c.state === "end") return "shift_end";
    const q = c.pl[b.pid], h = q.hold[0];
    if (c.k === "apt" && q.hold.length >= COOP_APT.binCap) return "apt_dump";
    if (c.k === "diner" && h?.r === 3) return "diner_clean";
    if (c.k === "forge" && forgeBound(c, b.pid)) return "forge_beat";
    if (c.k === "alch") {
      if (c.pot.st === 3 || (c.pot.pc && c.kiln.H > COOP_BREW.orders[c.pot.pc.r].hi)) return "alch_hot";
      if (q.tool === "bellows") return "alch_pump";
    }
    if (c.k === "lib" && h?.kind === 1) return "lib_return";
    return c.k;
  }
  if (!m.safe) {
    if (buddyDanger(S, rt, p.x, p.y)) return "danger";
    if (p.hp < stats(p).mhp * 0.35 && !p.sit && !p.recall) return "hurt";
    if (b.target && (b.target.el === 2 || MOBS[b.target.k].boss)) return "boss";
    if (b.target) return "fight";
  }
  if (p.sit && fireNear(rt, p)) return "camp";
  if (p.map === "blossom_trail" || p.map === "sunset_beach") return p.map;
  const wx = rt.wx ?? weatherAt(p.map, S.now);
  if (wx === WX.rain) return "rain";
  if (wx === WX.wind) return "wind";
  if (wx === WX.fog) return "fog";
  if (wx >= 0 && isNight(S.now)) return "night";
  return m.safe ? "town" : "field";
}

function buddySpeak(S, p, b, key) {
  const urgent = key === "danger" || key === "hurt";
  if (key !== b.talkKey) {
    const minGap = (b.spokeAt || 0) + (urgent ? 14000 : 20000);
    b.lineAt = Math.min(b.lineAt, Math.max(minGap, S.now + (urgent ? 300 : 3500)));
    b.talkKey = key;
  }
  if (S.now < b.lineAt) return;
  const lines = BUDDY_LINES[key];
  const fresh = lines.filter((line) => !b.heard.includes(line));
  const pool = fresh.length ? fresh : lines.filter((line) => line !== b.heard.at(-1));
  const line = pool[ri(S, 0, pool.length - 1)];
  b.heard.push(line);
  if (b.heard.length > 12) b.heard.shift();
  b.spokeAt = S.now;
  b.lineAt = S.now + ri(S, 35000, 55000);
  p.buddySay = [b.eid, line];
}

function buddyTick(S, dt) {
  for (const p of Object.values(S.players)) {
    if (!p.ch.buddy?.active && !p.buddyCall) continue;
    if (buddyInParty(S, p)) { buddyReturnForParty(S, p); continue; }
    if (p.buddyCall) {
      const call = p.buddyCall;
      if (call.replyAt && S.now >= call.replyAt) {
        p.buddyMail = [1, "지금 바로 갈게!"]; call.replyAt = 0;
        continue;
      }
      if (S.now < call.arriveAt || p.dead) continue;
      p.ch.buddy.active = true;
      p.buddyCall = null; p.dirty = true; saveSoon(p);
    }
    const dim = S.dims[p.map], b = buddyOf(S, p) || buddySpawn(S, p);
    if (b.map !== p.map) buddyPlace(S, b, p.map, p.x, p.y);
    if (b.ch.lvl !== p.ch.lvl) { b.ch.lvl = p.ch.lvl; S.maps[p.map].who = true; }
    if (p.dead) { b.target = null; b.engaged.clear(); continue; }
    const m = mapOfS(S, p.map), c = dim?.coop, rt = S.maps[p.map];
    if (c?.pl[b.pid]) {
      if (c.state === "run" || c.state === "fever") buddyJob(S, p, b, c, dt);
    } else if (!dim && !m.safe && buddyFight(S, p, b, rt, m, dt)) {
      // The NPC is already moving into attack range or fighting from there.
    } else if (dist(p.x, p.y, b.x, b.y) > 750) {
      buddyPlace(S, b, p.map, p.x, p.y);
    } else buddyWalk(S, b, p.x, p.y, 31, dt);
    b.toast.length = 0;
    if (dist(b.x, b.y, p.x, p.y) <= 130) buddySpeak(S, p, b, buddyContext(S, p, b, rt, m, c));
  }
}

/** Travel to the named fixture and press the same F / rhythm action a human uses. */
function buddyJob(S, p, b, c, dt) {
  const q = c.pl[b.pid], teammate = c.pl[p.pid];
  if (!teammate || S.now - Math.max(teammate.workAt || 0, teammate.idleAt, c.runAt) >= 30000) return;
  const now = S.now, h = q.hold[0], st = COOP[c.k].st, action = { t: "coop_act" };
  const act = (details) => {
    Object.assign(action, details);
    if (coopValidate(S, b, action).ok) coopApply(S, b, action);
  };
  const at = (station, index = 0, details = {}, extra = () => true) => {
    const tile = Array.isArray(st[station][0]) ? st[station][index] : st[station];
    const [x, y] = tilePx(tile);
    const accepts = (px, py) => {
      const here = { x: px, y: py };
      return coopSt(c, here, station) === index && extra(here);
    };
    if (buddyWalk(S, b, x, y, COOP_T.station + 8, dt, accepts, station + index)) act(details);
  };

  if (c.k === "forge") {
    const a = forgeBound(c, b.pid);
    if (a) {
      b.anvil = a.ai;
      const { noteAt, taps } = a.pair, own = 1 << a.pair.ids.indexOf(b.pid), close = Math.abs(now - noteAt) <= COOP_FORGE.windowMs;
      if (close && !(taps & own) && (taps || now >= noteAt)) act({ beat: 1 });
      return;
    }
    if (b.anvil !== null && c.anvils[b.anvil]?.order) b.forgeRetryAt = now + 1700;
    b.anvil = null;
    const ready = c.anvils.filter((anvil) => anvil.order && !anvil.pair && anvil.order.until > now + COOP_FORGE.leadMs && forgeBeatAt(anvil, p));
    const next = buddyNearest(b, ready);
    if (next && now >= b.forgeRetryAt) at("anvil", next.ai);
    else buddyWalk(S, b, p.x, p.y, 30, dt);
    return;
  }
  if (c.k === "apt") {
    const dump = tilePx(st.dump), lastTrip = c.endAt - now < 5000 + (dist(b.x, b.y, ...dump) * 1000) / 115;
    if (q.hold.length >= COOP_APT.binCap || (h && (!c.ents.length || lastTrip))) { at("dump"); b.trash = null; return; }
    const apart = (trash) => dist(p.x, p.y, trash.x, trash.y) > 22;
    const heldTarget = b.trash && c.ents.includes(b.trash) && apart(b.trash) ? b.trash : null;
    const e = b.trash = heldTarget || buddyNearest(b, c.ents, apart) || buddyNearest(b, c.ents);
    if (e && buddyWalk(S, b, e.x, e.y, 6, dt)) act();
    return;
  }
  if (c.k === "diner") {
    const orders = c.ents.filter((e) => e.t === 3 && !e.eatAt && !e.goneAt && now < e.until);
    const available = orders.filter((e) => e.seated);
    const tableClear = (spot) => coopSt(c, spot, "stove") < 0 && (!h || coopSt(c, spot, "sink") < 0);
    if (h) {
      const guest = h.r === 3 ? null : available.filter((e) => e.r === h.r).sort((a, b) => a.until - b.until)[0];
      if (guest) at("tables", guest.ti, {}, tableClear);
      else if (h.r === 3 || !orders.some((e) => e.r === h.r)) at("sink");
      return;
    }
    const pot = c.ents.find((e) => e.t === 4 && e.cook === b.pid);
    if (pot && now >= pot.doneAt && orders.some((e) => e.r === pot.r)) { at("stove", pot.si); return; }
    const plates = c.ents.filter((e) => e.t === 9);
    const plate = plates.filter((e) => !e.late).sort((a, b) => a.due - b.due)[0] || buddyNearest(b, plates);
    if (plate) { at("tables", plate.ti, {}, tableClear); return; }
    if (pot) { if (now >= pot.doneAt) at("stove", pot.si); return; }
    const stoves = st.stove.map((tile, i) => {
      const [x, y] = tilePx(tile);
      return { x, y, i, cost: dist(b.x, b.y, x, y) + (dist(p.x, p.y, x, y) < 38 ? 64 : 0) };
    }).filter(({ i }) => !c.ents.some((e) => e.t === 4 && e.si === i)).sort((a, b) => a.cost - b.cost);
    const stove = stoves[0];
    if (!stove) return;
    const supplies = [...c.ents.filter((e) => e.t === 4), ...Object.values(c.pl).flatMap((worker) => worker.hold)];
    const guest = available.sort((a, b) => a.until - b.until).find((e) => {
      const eta = (dist(b.x, b.y, stove.x, stove.y) + dist(stove.x, stove.y, e.x, e.y)) * 1000 / 105 + COOP_DINER.dishes[e.r].cook;
      return now + eta < e.until && orders.filter((g) => g.r === e.r).length > supplies.filter((g) => g.r === e.r).length;
    });
    if (guest) at("stove", stove.i, { i: stove.i, r: guest.r });
    return;
  }
  if (c.k === "lib") {
    const waiting = libWaiting(c, now);
    const deskCost = (tile) => {
      const [x, y] = tilePx(tile);
      return Math.abs(x - b.x) + (dist(x, y, p.x, p.y) < 28 ? 38 : 0);
    };
    const desk = st.desk.reduce((best, tile, i) => deskCost(tile) < deskCost(st.desk[best]) ? i : best, 0);
    if (h?.kind === 0 && waiting.some((e) => e.id === h.id)) { at("desk", desk); return; }
    const guest = waiting.filter((e) => e.kind === 0 && !e.worker).sort((a, b) => a.until - b.until)[0];
    if (h || guest) { at("shelf", (h?.g ?? guest.g) * 6 + 2, {}, (spot) => coopSt(c, spot, "desk") < 0); return; }
    if (c.returns.length || waiting.some((e) => e.kind === 1)) at("desk", desk);
    return;
  }
  if (c.k === "alch") {
    // Keep complementary roles even if the human swaps tools at the rack.
    const tool = teammate.tool === "bellows" ? "fan" : "bellows";
    if (q.tool !== tool && !h) { at("rack"); return; }
    const e = c.pot, clear = (spot) => coopSt(c, spot, "rack") < 0;
    if (q.herb) { at("herbs", 0, { d: COOP_BREW.orders[q.herb.r].herbs[q.herb.i] }); return; }
    if (h?.st === "potion") { at("shelf", 2, {}, clear); return; }
    if (e.st === 2 || (e.st === 3 && q.tool === "fan") || (h && e.st === 0)) { at("pot", 0, {}, clear); return; }
    if (q.tool === "fan") {
      if (e.st === 1 && c.kiln.H > COOP_BREW.orders[e.pc.r].hi + 1) at("pot", 0, {}, clear);
      else if (e.st === 0 && !h && c.ents.filter((entity) => entity.t === 10).length < st.shelf.length) at("herbs", 0, {}, clear);
      return;
    }
    const need = e.st === 1 && COOP_BREW.orders[e.pc.r];
    const kiln = (spot) => clear(spot) && coopSt(c, spot, "pot") < 0;
    if (!q.bel) { at("kiln", 0, {}, kiln); return; }
    if (coopSt(c, b, "kiln") < 0) {
      buddyWalk(S, b, ...tilePx(st.kiln), COOP_T.station + 8, dt, (x, y) => kiln({ x, y }), "kiln");
      return;
    }
    let i = Math.max(0, q.ln || 0);
    while (brewNote(c, i) < now - 100) i++;
    if (need && c.kiln.H < (need.lo + need.hi) / 2 && Math.abs(brewNote(c, i) - now) <= 100) act({ d: brewDir(i) });
  }
}

function buddyNearest(b, list, test = () => true) {
  let nearest = null, best = Infinity;
  for (const e of list) {
    const d = dist(b.x, b.y, e.x, e.y);
    if (d < best && test(e)) { best = d; nearest = e; }
  }
  return nearest;
}
