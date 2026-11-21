// ───────────────────────────── the action table ─────────────────────────────
// One row per action `t`, its check and its mutation side by side:
//   check(S, p, a) → OK or bad(…)   asked by validateAction (70-validate.js) after its shared guards
//   run(S, p, a)                     done by applyAction (75-apply.js) once the check said OK
// A row with `down: true` may be asked while the hero is down; any other row is refused first with
// "쓰러진 상태입니다". A name missing here is "알 수 없는 행동".
const ACTIONS = {
  // ── allowed while down: where the residents are, getting up, settings, the mirror
  nw: {
    down: true,
    check(S, p) { return p.npcWhereAt === undefined || S.now >= p.npcWhereAt ? OK : bad("잠시 뒤 주민 위치를 다시 확인하세요"); },
    run(S, p) { p.npcWhereAt = S.now + 5000; p.npcWhere = true; },
  },
  respawn: {
    down: true,
    check(S, p, a) {
      if (!p.dead) return bad("살아 있습니다");
      if (a.here && countItem(p.ch, "feather") < 1) return bad("부활 깃털이 없습니다");
      if (!a.here && dimReviveWait(S, p) > 0) return bad(dimReviveWait(S, p) >= 99 ? "전투가 끝나야 일어날 수 있습니다 (전멸하면 다시 도전합니다)" : `${dimReviveWait(S, p)}초 뒤에 시작 지점에서 일어날 수 있습니다`);
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch, now = S.now;
      if (a.here) {
        // a revive feather: up again where you fell, a little shaken, nothing lost (메이플 부활 아이템)
        takeItem(ch, "feather", 1);
        p.dead = false;
        const st = stats(p);
        p.hp = Math.round(st.mhp * 0.6); p.mp = Math.max(p.mp, Math.round(st.mmp * 0.6));
        p.ghost = now + 2500;
        p.hitAt = now;
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        p.dirty = true;
        toast(p, "부활 깃털로 그 자리에서 일어났습니다. (경험치 손실 없음)");
        return;
      }
      // inside a 레이드던전: up again in its start room, at no cost (64-dim.js)
      if (dimRespawn(S, p)) return;
      const lost = deathLoss(ch, p);
      ch.xp -= lost;
      p.dead = false;
      changeMap(S, p, START.map, START.x, START.y);
      const st = stats(p);
      p.hp = st.mhp; p.mp = st.mmp;
      p.dirty = true;
      toast(p, lost > 0 ? `광장에서 깨어났습니다. (경험치 -${lost})` : "광장에서 깨어났습니다.");
    },
  },
  opt: {
    down: true,
    check(S, p, a) {
      // settings kept with the character: loot filter, auto-potion thresholds (percent)
      const okPct = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 90);
      if (a.filter !== undefined && !(Number.isInteger(a.filter) && a.filter >= 0 && a.filter < FILTER_Q.length)) return bad("잘못된 필터");
      if (!okPct(a.ahp) || !okPct(a.amp)) return bad("잘못된 설정값");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      if (a.filter !== undefined) ch.opt.filter = a.filter;
      if (a.ahp !== undefined) ch.opt.ahp = a.ahp;
      if (a.amp !== undefined) ch.opt.amp = a.amp;
      p.dirty = true;
    },
  },
  look: {
    down: true,
    check(S, p, a) {
      // a new look at the mirror in town, for gold
      if (!Array.isArray(a.look) || a.look.length > LOOK_MAX.length || !a.look.every((v, i) => Number.isInteger(v) && v >= 0 && v <= LOOK_MAX[i])) return bad("잘못된 외형");
      if (!mapOfS(p.S, p.map).safe) return bad("마을에서만 외형을 바꿀 수 있습니다");
      if (p.ch.gold < LOOK_COST) return bad(`골드가 부족합니다 (${LOOK_COST}G)`);
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      ch.look = cleanLook(a.look);
      ch.gold -= LOOK_COST;
      S.maps[p.map].who = true;
      toast(p, `새 모습이 되었습니다! (-${LOOK_COST}G)`);
      p.dirty = true;
    },
  },

  // ── chat, party, guild (allowed while down)
  chat: {
    down: true,
    check(S, p, a) {
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (S.now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      if (!chatLinks(p.ch, a.it)) return bad("링크한 물건이 가방에 없습니다");
      return OK;
    },
    run(S, p, a) {
      const text = a.m.trim().slice(0, 80);
      p.chatAt = S.now;
      S.chat.push(chatLine(p.ch, text, a));
      S.maps[p.map].ev.push(["s", p.eid, text]);
    },
  },
  pinv: {
    down: true,
    check(S, p, a) {
      const ch = p.ch, now = S.now;
      const o = byEid(S, a.e);
      if (!o || o === p) return bad("대상을 찾을 수 없습니다");
      const party = S.parties[p.party];
      if (party && party.m.length >= PARTY_MAX) return bad("파티가 가득 찼습니다");
      if (o.party) return bad("이미 다른 파티에 속해 있습니다");
      if (o.pinv && now - o.pinv.at < 15000) return bad("상대가 다른 초대에 응답 중입니다");
      if (blocked(o.ch, ch.name)) return bad("초대를 보낼 수 없는 상대입니다");
      return OK;
    },
    run(S, p, a) {
      const o = byEid(S, a.e);
      o.pinv = { from: p.pid, at: S.now };
      toast(p, `${o.ch.name}님을 파티에 초대했습니다.`);
    },
  },
  pacc: {
    down: true,
    check(S, p) {
      const inv = p.pinv;
      const from = inv && S.now - inv.at < 30000 ? S.players[inv.from] : null;
      if (!from) return bad("유효한 초대가 없습니다");
      if (p.party) return bad("이미 파티에 속해 있습니다");
      const party = S.parties[from.party];
      if (party && party.m.length >= PARTY_MAX) return bad("파티가 가득 찼습니다");
      return OK;
    },
    run(S, p) {
      const from = S.players[p.pinv.from];
      p.pinv = null;
      let party = S.parties[from.party];
      if (!party) {
        party = { id: S.nextId++, m: [from.pid] };
        S.parties[party.id] = party;
        from.party = party.id;
      }
      party.m.push(p.pid);
      p.party = party.id;
      for (const o of members(S, p)) {
        buddyReturnForParty(S, o);
        toast(o, o === p ? "파티에 참가했습니다." : `${p.ch.name}님이 파티에 참가했습니다.`);
        S.maps[o.map].who = true;
      }
    },
  },
  pdec: {
    down: true,
    check() { return OK; },
    run(S, p) { p.pinv = null; },
  },
  pleave: {
    down: true,
    check(S, p) { return p.party ? OK : bad("파티에 속해 있지 않습니다"); },
    run(S, p) {
      leaveParty(S, p);
      toast(p, "파티를 떠났습니다.");
    },
  },
  pchat: {
    down: true,
    check(S, p, a) {
      if (!S.parties[p.party]) return bad("파티에 속해 있지 않습니다");
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (S.now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      if (!chatLinks(p.ch, a.it)) return bad("링크한 물건이 가방에 없습니다");
      return OK;
    },
    run(S, p, a) {
      p.chatAt = S.now;
      S.chat.push(chatLine(p.ch, a.m.trim().slice(0, 80), a, { pt: p.party }));
    },
  },
  gcreate: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      if (ch.guild) return bad("이미 길드에 속해 있습니다");
      if (!validName(a.name)) return bad("길드 이름은 한글·영문·숫자 2~10자로 지어 주세요");
      if (ch.gold < GUILD_COST) return bad(`길드 창설에는 ${GUILD_COST}G가 필요합니다`);
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      ch.gold -= GUILD_COST;
      ch.guild = a.name; ch.gm = 1;
      sys(S, `${ch.name}님이 길드 [${a.name}]${pp(a.name, "을를")} 세웠습니다!`);
      ch.cnt.gfound = 1;
      checkAch(S, p);
      S.maps[p.map].who = true;
      p.dirty = true;
    },
  },
  ginv: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      const o = byEid(S, a.e);
      if (!ch.guild) return bad("길드에 속해 있지 않습니다");
      if (!o || o === p) return bad("대상을 찾을 수 없습니다");
      if (o.ch.guild) return bad("이미 길드에 속해 있습니다");
      if (o.ginv && S.now - o.ginv.at < 15000) return bad("상대가 다른 초대에 응답 중입니다");
      if (blocked(o.ch, ch.name)) return bad("초대를 보낼 수 없는 상대입니다");
      return OK;
    },
    run(S, p, a) {
      const o = byEid(S, a.e);
      o.ginv = { from: p.pid, g: p.ch.guild, at: S.now };
      toast(p, `${o.ch.name}님을 길드에 초대했습니다.`);
    },
  },
  gacc: {
    down: true,
    check(S, p) {
      if (p.ch.guild) return bad("이미 길드에 속해 있습니다");
      return p.ginv && S.now - p.ginv.at < 30000 ? OK : bad("유효한 초대가 없습니다");
    },
    run(S, p) {
      const ch = p.ch;
      ch.guild = p.ginv.g; ch.gm = 0;
      p.ginv = null;
      for (const oid of Object.keys(S.players)) {
        const o = S.players[oid];
        if (o.ch.guild === ch.guild) { toast(o, o === p ? `길드 [${ch.guild}]에 가입했습니다.` : `${ch.name}님이 길드 [${ch.guild}]에 들어왔습니다.`); o.dirty = true; }
      }
      checkAch(S, p);
      S.maps[p.map].who = true;
    },
  },
  gdec: {
    down: true,
    check() { return OK; },
    run(S, p) { p.ginv = null; },
  },
  glist: {
    down: true,
    check() { return OK; },
    run(S, p) { p.dirty = true; },
  },
  gleave: {
    down: true,
    check(S, p) { return p.ch.guild ? OK : bad("길드에 속해 있지 않습니다"); },
    run(S, p) {
      const ch = p.ch;
      toast(p, `길드 [${ch.guild}]${pp(ch.guild, "을를")} 떠났습니다.`);
      ch.guild = ""; ch.gm = 0;
      S.maps[p.map].who = true;
      p.dirty = true;
    },
  },
  gchat: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      if (!ch.guild) return bad("길드에 속해 있지 않습니다");
      if (typeof a.m !== "string" || !a.m.trim()) return bad("빈 메시지");
      if (S.now - p.chatAt < 700) return bad("채팅이 너무 빠릅니다");
      if (!chatLinks(ch, a.it)) return bad("링크한 물건이 가방에 없습니다");
      return OK;
    },
    run(S, p, a) {
      p.chatAt = S.now;
      S.chat.push(chatLine(p.ch, a.m.trim().slice(0, 80), a, { g: p.ch.guild }));
    },
  },

  // ── the bar, the bag, gestures (allowed while down)
  qs: {
    down: true,
    check(S, p, a) {
      // set slot i to v, or swap slots i and j
      const slot = (i) => Number.isInteger(i) && i >= 0 && i < QS_N;
      if (!slot(a.i)) return bad("없는 단축칸");
      if (a.j !== undefined) return slot(a.j) ? OK : bad("없는 단축칸");
      return qsOk(p.ch, a.v === undefined ? null : a.v) ? OK : bad("단축칸에 놓을 수 없습니다");
    },
    run(S, p, a) {
      const ch = p.ch;
      if (a.j !== undefined) [ch.qs[a.i], ch.qs[a.j]] = [ch.qs[a.j], ch.qs[a.i]];
      else ch.qs[a.i] = a.v ? a.v.slice() : null;
      p.dirty = true;
    },
  },
  sort: {
    down: true,
    check(S, p) { return p.ch.inv.length > 1 ? OK : bad("정리할 것이 없습니다"); },
    run(S, p) {
      // by kind, then the better piece first, then the higher level; stacks of the same thing merge (46-bag.js)
      p.ch.inv = sortSlots(p.ch.inv);
      p.dirty = true;
    },
  },
  jam: {
    down: true,
    check(S, p, a) {
      if (a.k !== 0 && a.k !== 1) return bad("없는 동작");
      if (!p.sit) return bad("앉아서 할 수 있습니다");
      if (a.k === 1 && !fireNear(S.maps[p.map], p)) return bad("모닥불 곁에서 할 수 있습니다");
      return S.now - p.emoAt < JAM_CD ? bad("잠시 후에") : OK;
    },
    run(S, p, a) {
      // a song on the lute or a raised cup, for everyone around to hear
      p.emoAt = S.now;
      S.maps[p.map].ev.push(["j", p.eid, a.k]);
    },
  },
  emo: {
    down: true,
    check(S, p, a) {
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= EMOTES) return bad("없는 감정표현");
      return S.now - p.emoAt < 600 ? bad("잠시 후에") : OK;
    },
    run(S, p, a) {
      p.emoAt = S.now;
      S.maps[p.map].ev.push(["o", p.eid, a.i]);
    },
  },

  // ── the wardrobe: wear something owned, take a slot off, or buy at the costume shop (allowed while down)
  cos_eq: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      if (typeof a.id !== "string" || !Object.hasOwn(COSMETICS, a.id)) return bad("없는 외형입니다");
      if (!ch.cos.own.includes(a.id)) return bad("아직 얻지 않은 외형입니다");
      return ch.cos.on[COSMETICS[a.id].slot] === a.id ? bad("이미 입고 있습니다") : OK;
    },
    run(S, p, a) {
      p.ch.cos.on[COSMETICS[a.id].slot] = a.id;
      S.maps[p.map].who = true;
      p.dirty = true;
    },
  },
  cos_off: {
    down: true,
    check(S, p, a) {
      if (!COS_SLOTS.includes(a.s)) return bad("잘못된 부위");
      return p.ch.cos.on[a.s] ? OK : bad("입은 외형이 없습니다");
    },
    run(S, p, a) {
      delete p.ch.cos.on[a.s];
      S.maps[p.map].who = true;
      p.dirty = true;
    },
  },
  cos_buy: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      const c = typeof a.id === "string" && Object.hasOwn(COSMETICS, a.id) ? COSMETICS[a.id] : null;
      if (!c || (c.src !== "shop" && c.src !== "token")) return bad("팔지 않는 외형입니다");
      if (!npcNear(p, "costume")) return bad("의상실 주인이 너무 멉니다");
      if (ch.cos.own.includes(a.id)) return bad("이미 가지고 있습니다");
      if (c.src === "token") return ch.cos.tokens < c.price ? bad("버드나무토큰이 부족합니다") : OK;
      return ch.gold < c.price ? bad("골드가 부족합니다") : OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const c = COSMETICS[a.id];
      if (c.src === "token") ch.cos.tokens -= c.price;
      else ch.gold -= c.price;
      ch.cos.own.push(a.id);
      // bought to be worn: put it on straight away
      ch.cos.on[c.slot] = a.id;
      S.maps[p.map].who = true;
      toast(p, `[${c.name}]${pp(c.name, "을를")} 샀습니다. 캐릭터 창 ‘외형’ 탭에서 갈아입을 수 있습니다.`);
      p.dirty = true;
    },
  },
  // 염색 at 루루's (P9): `d` 1–6 uses one dye of COS_DYES[d - 1]; 0 puts the original colours back for free
  cos_dye: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      if (typeof a.id !== "string" || !Object.hasOwn(COSMETICS, a.id)) return bad("없는 외형입니다");
      if (!ch.cos.own.includes(a.id)) return bad("아직 얻지 않은 외형입니다");
      if (!cosDyeable(a.id)) return bad("무기 외형은 염색할 수 없습니다");
      if (!Number.isInteger(a.d) || a.d < 0 || a.d > COS_DYES.length) return bad("없는 염료입니다");
      if (!npcNear(p, "costume")) return bad("의상실 주인이 너무 멉니다");
      if ((ch.cosDye[a.id] || 0) === a.d) return bad(a.d ? "이미 그 색으로 물들였습니다" : "이미 원래 색입니다");
      const dye = a.d ? ITEMS[COS_DYES[a.d - 1]] : null;
      return dye && countItem(ch, COS_DYES[a.d - 1]) < 1 ? bad(`[${dye.name}]${pp(dye.name, "이가")} 없습니다`) : OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const c = COSMETICS[a.id];
      if (a.d) { takeItem(ch, COS_DYES[a.d - 1], 1); ch.cosDye[a.id] = a.d; }
      else delete ch.cosDye[a.id];
      if (ch.cos.on[c.slot] === a.id) S.maps[p.map].who = true;
      toast(p, a.d ? `[${c.name}]${pp(c.name, "을를")} ${ITEMS[COS_DYES[a.d - 1]].name}${pp(ITEMS[COS_DYES[a.d - 1]].name, "으로")} 물들였습니다.` : `[${c.name}]${pp(c.name, "을를")} 원래 색으로 되돌렸습니다.`);
      p.dirty = true;
    },
  },
  // 기념품 재봉 (P9): a story keepsake becomes its outfit piece; the keepsake is kept
  cos_sew: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      if (typeof a.k !== "string" || !Object.hasOwn(KEEP_SEW, a.k)) return bad("재봉할 수 없는 기념품입니다");
      if (!ch.keep[a.k]) return bad("아직 간직하지 않은 기념품입니다");
      if (!KEEP_SEW[a.k]) return bad("루루가 아직 이 기념품의 옷본을 그리고 있어요");
      if (!npcNear(p, "costume")) return bad("의상실 주인이 너무 멉니다");
      return ch.cos.own.includes(KEEP_SEW[a.k]) ? bad("이미 지어 받은 외형입니다") : OK;
    },
    run(S, p, a) {
      giveCos(S, p, KEEP_SEW[a.k], `루루가 [${ITEMS[a.k].name}]${pp(ITEMS[a.k].name, "으로")} 지어 주었습니다`);
    },
  },
  title: {
    down: true,
    check(S, p, a) {
      if (a.id === "" || a.id === undefined || a.id === null) return OK;
      if (typeof a.id !== "string" || !ACH_BY[a.id] || !ACH_BY[a.id].title) return bad("없는 칭호입니다");
      return p.ch.ach.includes(a.id) ? OK : bad("아직 얻지 않은 칭호입니다");
    },
    run(S, p, a) {
      const ch = p.ch;
      ch.title = a.id || "";
      p.stc = null;
      S.maps[p.map].who = true;
      toast(p, ch.title ? `칭호 「${titleOf(ch)}」${pp(titleOf(ch), "을를")} 달았습니다.` : "칭호를 떼었습니다.");
      p.dirty = true;
    },
  },

  // ── dailies and the tutorial (allowed while down)
  daily: {
    down: true,
    check(S, p, a) {
      const ch = p.ch;
      ensureDaily(S, p);
      const dl = ch.daily;
      if (a.i === "party" || a.i === "solo") {
        const hunt = dl.tasks[0];
        if (dl.claimed[0] || hunt.n >= hunt.need) return bad("오늘의 사냥 과제를 이미 마쳤습니다");
        if (a.i === "party") return hunt.kind === "kill" && hunt.n === 0 ? OK : bad("처치를 시작하기 전에 파티 과제로 바꿀 수 있습니다");
        return hunt.kind === "party" ? OK : bad("현재 파티 과제를 진행하고 있지 않습니다");
      }
      if (a.i === "bonus") {
        if (dl.bonus) return bad("이미 보상을 받았습니다");
        if (!dl.claimed.every(Boolean)) return bad("세 과제의 보상을 모두 받아야 합니다");
        return ch.inv.length + 2 <= bagCap(ch) ? OK : bad("가방이 가득 찼습니다");
      }
      const t = Number.isInteger(a.i) ? dl.tasks[a.i] : null;
      if (!t) return bad("없는 과제입니다");
      if (dl.claimed[a.i]) return bad("이미 보상을 받았습니다");
      if (t.n < t.need) return bad("아직 과제를 마치지 못했습니다");
      const { stone } = dailyReward(ch, t);
      return !stone || canAdd(ch, "stone", stone) ? OK : bad("가방이 가득 찼습니다");
    },
    run(S, p, a) {
      const ch = p.ch;
      const dl = ch.daily;
      if (a.i === "party" || a.i === "solo") {
        dl.tasks[0] = a.i === "party"
          ? { kind: "party", k: null, n: 0, need: DAILY_PARTY_KILLS }
          : rollDaily(ch, dl.day).tasks[0];
        p.dirty = true;
        return;
      }
      if (a.i === "bonus") {
        dl.bonus = true;
        ch.cnt.daily++;
        toast(p, "토벌 의뢰 보상 상자를 열었습니다!");
        payout(S, p, dailyBonus(ch));
        cosFrom(S, p, "daily", "토벌 의뢰 보상 상자");
      } else {
        dl.claimed[a.i] = true;
        payout(S, p, dailyReward(ch, dl.tasks[a.i]));
      }
      checkAch(S, p);
    },
  },
  tut: {
    down: true,
    check(S, p, a) {
      const step = TUT[p.ch.tut.i];
      if (!step || step.id !== a.s || (a.s !== "talk" && a.s !== "bag")) return bad("지금 할 단계가 아닙니다");
      if (a.s === "talk" && !npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      return OK;
    },
    run(S, p, a) { tutStep(S, p, a.s); },
  },

  // ── alive only: walking, fighting, skills, the dash, the world map
  mv: {
    check(S, p, a) {
      if (!num(a.x) || !num(a.y)) return bad("잘못된 좌표");
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch, now = S.now, m = mapOfS(p.S, p.map);
      if (p.dance || p.ab || elementFrozen(S, p)) { p.fix = true; p.mvAt = now; return; }
      const dt = clamp(now - p.mvAt, 0, 600);
      p.mvAt = now;
      const max = (stats(p).spd * dt) / 1000 * 1.6 + 8;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d > max || !canStand(m, a.x, a.y)) { p.fix = true; return; }
      if (d > 1.5) { rouse(S, p); p.elementRunAt = now; }
      p.x = a.x; p.y = a.y;
      if (a.d >= 0 && a.d <= 3) p.dir = a.d | 0;
      if (validAim(a.a)) p.aim = a.a;
      // stepping anywhere on a gate tile (or brushing its edge) takes you through
      for (const pt of m.portals) {
        if (dist(p.x, p.y - 3, pt.x * T + 8, pt.y * T + 8) >= 12) continue;
        if (p.map === AIRSHIP_BACK[0] && pt.to === AIRSHIP_MAP && !airshipCleared(ch)) airshipBoard(S, p);
        else {
          const at = arrivalOf(S, pt);
          if (at) changeMap(S, p, pt.to, at[0] * T + 8, at[1] * T + 10);
        }
        break;
      }
      // the "내 집" door in town (64-housing.js)
      homeDoor(S, p);
    },
  },
  atk: {
    check(S, p, a) {
      const now = S.now;
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      if (carryOf(p)) return bad(CARRY_NO);
      if (p.dance) return bad("무영난무 중입니다");
      if (p.hammer) return bad("해머를 내려찍는 중입니다");
      if (now < (p.stag || 0) || elementFrozen(S, p)) return bad("stag");
      if (now - p.atkAt < atkCd(p) - 60) return bad("아직 공격할 수 없습니다");
      return OK;
    },
    run(S, p, a) { if (validAim(a.a)) setAim(p, a.a); basicAttack(S, p); },
  },
  sk: {
    check(S, p, a) {
      const ch = p.ch, now = S.now;
      // a skill by id (57-weapon-skills.js): its weapon in hand, its mastery or job, off cooldown, MP for it
      const sk = typeof a.id === "string" && Object.hasOwn(SKILL, a.id) ? SKILL[a.id] : null;
      if (!sk) return bad("없는 스킬");
      if (sk.kind === "p") return bad("저절로 발동하는 패시브 스킬입니다");
      if (carryOf(p)) return bad(CARRY_NO);
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      const why = skWhy(ch, sk);
      if (why) return bad(why);
      if (!loOf(ch).a.includes(a.id)) return bad("스킬 칸에 넣지 않은 스킬입니다 — 마을이나 모닥불 곁에서 바꿀 수 있습니다");
      if (p.dance) return bad("무영난무 중입니다");
      if (p.hammer) return bad("해머를 내려찍는 중입니다");
      if (p.charge) return bad("기술을 모으는 중입니다");
      // a held charge (E1): only the same skill again, which lets it go
      if (p.hold) return a.id === p.hold.id ? OK : bad("기술을 모으는 중입니다");
      if (now < (p.stag || 0) || elementFrozen(S, p)) return bad("stag");
      if (now < (p.cds[a.id] || 0)) return bad("재사용 대기 중입니다");
      if (p.mp < skMp(p, sk)) return bad("MP가 부족합니다");
      if (sk.hpPct && p.hp <= skillHpCost(p, sk)) return bad("HP가 부족합니다");
      return OK;
    },
    run(S, p, a) { if (validAim(a.a)) setAim(p, a.a); castSkill(S, p, a.id); },
  },
  skr: {
    check(S, p) {
      // the key of a held skill came up (57-weapon-skills.js holdGo)
      if (elementFrozen(S, p)) return bad("stag");
      return p.hold ? OK : bad("skr");
    },
    run(S, p) { holdGo(S, p); },
  },
  dash: {
    check(S, p, a) {
      // Space (59-dash.js): refused in silence while it cools, while reeling, when down
      if (a.a !== undefined && !validAim(a.a)) return bad("잘못된 조준");
      const why = dashWhy(S, p);
      return why ? bad(why) : OK;
    },
    run(S, p, a) { dashGo(S, p, mapOfS(p.S, p.map), a.a); },
  },
  warp: {
    check(S, p, a) {
      const ch = p.ch;
      // a big ground has several stones: `i` picks one (0, the first, when left out)
      const i = a.i === undefined ? 0 : a.i;
      if (!hasWp(a.to) || !Number.isInteger(i) || i < 0 || i >= MAP_META[a.to].wpn) return bad("그곳에는 이동의 돌이 없습니다");
      const denied = airshipAccess(ch, a.to);
      if (denied) return bad(denied);
      const minLv = mapLevelNeed(ch, a.to);
      if (minLv) return bad(mapLevelMessage(minLv));
      // owner 2026-11-18: the world map warps from anywhere, not only beside a stone; never out of an instance (raid, co-op shift)
      if (inDim(p)) return bad("레이드던전이나 협동 알바 중에는 이동할 수 없습니다");
      if (!wpWoken(ch, a.to, i)) return bad("아직 깨우지 않은 이동의 돌입니다");
      const at = wpNear(p);
      if (a.to === p.map && at && i === (at.i || 0)) return bad("이미 이곳에 있습니다");
      if (S.now - p.hitAt < WARP_CALM) return bad("전투 중에는 이동할 수 없습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const denied = airshipAccess(ch, a.to);
      if (denied) { toast(p, denied); return; }
      const minLv = mapLevelNeed(ch, a.to);
      if (minLv) { toast(p, mapLevelMessage(minLv)); return; }
      const i = a.i || 0, w = stonesOf(mapOf(a.to))[i] || wpOf(a.to);
      S.maps[p.map].ev.push(["wp", p.eid, 0]);
      // to another stone of the same ground: a step, not a journey (the map is not sent again)
      if (a.to === p.map) { dropAggro(S, p); p.x = w.ax * T + 8; p.y = w.ay * T + 10; p.fix = true; }
      else changeMap(S, p, a.to, w.ax * T + 8, w.ay * T + 10);
      S.maps[a.to].ev.push(["wp", p.eid, 1]);
      toast(p, `[${stoneName(a.to, i)}]의 이동의 돌로 건너왔습니다.`);
      p.dirty = true;
    },
  },

  // ── alive only: sitting, fishing, cooking
  sit: {
    check() { return OK; },
    run(S, p) {
      if (p.sit) p.sit = false;
      else { rouse(S, p); sitDown(S, p); fieldFire(S, p, S.now); }
    },
  },
  fish: {
    check(S, p) {
      if (p.fish) return bad("이미 낚시 중입니다");
      if (S.now - p.hitAt < 3000) return bad("싸우는 중에는 낚시할 수 없습니다");
      if (mapOfS(p.S, p.map).nofish) return bad("이곳에서는 낚시를 할 수 없습니다");
      if (!waterNear(mapOfS(p.S, p.map), p)) return bad("물가에서만 낚시할 수 있습니다");
      if (!canAdd(p.ch, "fish_s", 1)) return bad("가방이 가득 찼습니다");
      return OK;
    },
    run(S, p) {
      const m = mapOfS(p.S, p.map);
      rouse(S, p);
      const [wx, wy] = waterNear(m, p);
      // a practised angler gets bites sooner (life skills: −0.8 % a 낚시 level)
      p.fish = { at: S.now + fishWait(S, p.ch, lifeBuff(S, p, "bite")) * (S.maps[p.map].wx === WX.rain ? WX_FISH : 1), bite: 0 };
      p.dir = dirOf(wx - p.x, wy - p.y);
      S.maps[p.map].ev.push(["f", p.eid, 1, wx, wy]);
    },
  },
  hook: {
    check(S, p) { return p.fish && p.fish.bite && !p.fish.hook ? OK : bad("아직 입질이 없습니다"); },
    run(S, p) {
      // the fish is on: the angler now plays it in, and reports how well that went
      p.fish.hook = S.now;
      S.maps[p.map].ev.push(["f", p.eid, 3]);
    },
  },
  reel: {
    check(S, p) { return p.fish ? OK : bad("낚시 중이 아닙니다"); },
    run(S, p, a) {
      const ch = p.ch, now = S.now;
      const { bite, hook } = p.fish;
      p.fish = null;
      S.maps[p.map].ev.push(["f", p.eid, 0]);
      if (!bite) { toast(p, "너무 일찍 당겼습니다…"); return; }
      // how well the fish was played (0–100) decides what comes out of the water;
      // a fight that ended implausibly fast counts for little
      let score = hook ? clamp(a.s | 0, 0, 100) : 30;
      if (hook && now - hook < 2500) score = Math.min(score, 40);
      if (score < fishKeep(ch)) { toast(p, "물고기가 줄을 끊고 달아났습니다."); return; }
      // what bites depends on the water's grade and the angler's 낚시 level; 대성공 lands two (58-life.js)
      const { id, n, great } = fishLand(S, p, score);
      if (score >= 95) toast(p, "완벽한 낚시!");
      if (great) toast(p, `대성공! ${ITEMS[id].name} ${n}마리`);
      const g = ITEMS[id].grade | 0;
      if (addItem(ch, id, n)) p.gain.push(["item", id, n, id === "fish_l" ? 3 : g >= 3 ? 2 : g === 2 ? 1 : 0]);
      ch.fish++;
      if (id === "fish_l") { sys(S, `${ch.name}님이 [황금 잉어]를 낚았습니다!`); ch.cnt.carp++; }
      if (id.startsWith("fish")) dailyProg(S, p, "fish");
      checkAch(S, p);
      p.dirty = true;
    },
  },
  cook: {
    check(S, p, a) {
      const ch = p.ch;
      const r = typeof a.id === "string" ? fishRecipe(a.id) : null;
      if (!r || ITEMS[a.id].type !== "fish") return bad("요리할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (!fireNear(S.maps[p.map], p)) return bad("모닥불 곁에서만 요리할 수 있습니다");
      if (!canAdd(ch, r.out[0], r.out[1] * 2) || !canAdd(ch, "burnt", 1)) return bad("가방이 가득 찼습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      // the fish's recipe (12-life-tables.js RECIPES; L2's `craft` takes the same path)
      const r = fishRecipe(a.id);
      takeItem(ch, a.id, 1);
      // how neatly the pan was packed (0–100): a mess burns (less often for a practised cook), a perfect
      // fit or a 대성공 feeds two (58-life.js cookDish)
      const score = clamp(a.s | 0, 0, 100);
      const { id: out, n, great, burnt } = cookDish(S, p, r, score);
      addItem(ch, out, n);
      p.gain.push(["item", out, n, 0]);
      toast(p, burnt ? "태워 버렸습니다…" : n > 1 ? `${great ? "대성공" : "완벽한 요리"}! ${ITEMS[out].name} ${n}개` : `${ITEMS[out].name} 완성`);
      if (!burnt) { ch.cnt.cook++; dailyProg(S, p, "cook", r.at); checkAch(S, p); }
      fairPan(S, p, score);   // 장날 요리 대회 (63-festival.js)
      S.maps[p.map].ev.push(["u", p.eid, 0]);
      p.dirty = true;
    },
  },
};

// Whole systems keep their check and mutation in their own part; these names go straight to them.
for (const [names, check, run, down] of [
  ["buddy", buddyValidate, buddyApply, true],                 // 69-buddy.js
  ["mingyutest", devTestValidate, devTestApply, true],        // 74-dev-test.js
  ["ab_start ab_act ab_leave ab_close", albaValidate, albaApply, true],   // 일일 아르바이트 (66-alba.js)
  ["rest", restValidate, restApply, true],                    // 69-rest.js
  ["camp", campValidate, campApply],                          // 62-daynight.js
  ["sq", sqValidate, sqApply],                                // 62-side-quests.js
  ["dim_open dim_ready dim_cancel dim_leave dim_join", dimValidate, dimApply],   // 레이드던전 (64-dim.js)
  ["bag_expand", bagValidate, bagApply],                      // 46-bag.js
  ["house_buy house_upgrade house_style house_visit house_leave furn_buy furn_place furn_rot furn_pick h_dep h_wd h_sort h_rest", homeValidate, homeApply],   // 64-housing.js
  ["job_reset lv_reset lo", jfValidate, jfApply],             // 47-job-freedom.js
  ["ske", skeValidate, skeApply],                             // 48-skill-enh.js
  ["gat gat_tap craft_open craft jb", lifeValidate, lifeApply],   // life skills L2 (58-life.js): gathering, the stations, the 알바 board
  ["blk w wk", socialValidate, socialApply],                  // 차단, 귓속말, 주간 수첩 (63-social-weekly.js)
  ["charm_quest charm_id charm_place charm_move charm_remove charm_expand charm_claim charm_destroy charm_preset charm_fuse", charmValidate, charmApply],   // 66-charms.js
  ["enc_apply enc_extract enc_craft rune_fuse rune_extract", encValidate, encApply],   // enchant scrolls, extraction hammer, rune fusion (65-enchant.js)
  ["coop_start coop_act coop_leave", coopValidate, coopApply],   // 협동 아르바이트 (68-coop.js)
  ["fair_buy", fairValidate, fairApply],                      // 63-festival.js
  ["fair_open fair_shop", fairMktValidate, fairMktApply],     // the 장날 merchants (64-fair-market.js)
  ["sx", sxValidate, sxApply],                                // player to player (69-social-play.js)
]) for (const t of names.split(" ")) ACTIONS[t] = { down, check, run };
