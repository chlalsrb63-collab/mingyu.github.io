// ───────────────────────────── the action table ─────────────────────────────
// One row per action `t`, its check and its mutation side by side:
//   check(S, p, a) → OK or bad(…)   asked by validateAction (70-validate.js) after its shared guards
//   run(S, p, a)                     done by applyAction (75-apply.js) once the check said OK
// A row with `down: true` may be asked while the hero is down; any other row, or a name missing here, is
// refused first with "쓰러진 상태입니다". An unknown name from a hero on their feet is "알 수 없는 행동".
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

  // ── alive only: using things, gear, runes, sockets, stats
  use: {
    check(S, p, a) {
      const ch = p.ch, now = S.now;
      if (a.id === SOCK_ITEM) return socketValidate(p, a.k);
      // Elixirs and the whetstone (life skills, 58-life.js).
      if (lifeUse(a.id)) return lifeUseValidate(S, p, a);
      const it = ITEMS[a.id];
      if (!it || !["pot", "food", "camp", "scroll", "buff", "pet"].includes(it.type)) return bad("사용할 수 없는 아이템");
      if (countItem(ch, a.id) < 1) return bad("아이템이 없습니다");
      if (it.type === "buff" || it.type === "pet") return OK;
      if (it.type === "scroll") {
        if (S.dims[p.map]?.story?.airship) return bad("구조 중에는 [떠나기]로 오아시스에 돌아갈 수 있습니다");
        if (p.map === START.map) return bad("이미 마을에 있습니다");
        if (p.recall) return bad("이미 귀환을 준비하고 있습니다");
        return OK;
      }
      if (it.type === "camp") {
        const rt = S.maps[p.map];
        if (rt.fires.some((f) => dist(f.x, f.y, p.x, p.y) < 40)) return bad("바로 곁에 모닥불이 있습니다");
        if (rt.fires.filter((f) => f.until).length >= FIRE_MAX) return bad("이 지역에는 모닥불이 너무 많습니다");
        return OK;
      }
      if (now < p.potAt) return bad("재사용 대기 중입니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch, now = S.now;
      if (a.id === SOCK_ITEM) { socketApply(S, p, a.k); return; }
      if (lifeUse(a.id)) { lifeUseApply(S, p, a); return; }
      const it = ITEMS[a.id];
      const st = stats(p);
      if (it.type === "scroll") {
        rouse(S, p);
        const rms = Math.round(pfxNum(p, "recall", RECALL_MS));   // (a prefix power may shorten the cast)
        p.recall = { at: now + rms };
        S.maps[p.map].ev.push(["rc", p.eid, rms]);
        toast(p, "귀환 주문서를 읽는 중… (움직이거나 피해를 입으면 취소)");
        p.dirty = true;
        return;
      }
      if (it.type === "pet") {
        // the same pet again sends it home; another takes its place
        ch.pet = ch.pet === a.id ? "" : a.id;
        S.maps[p.map].who = true;
        if (ch.pet) S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, ch.pet ? `${it.name}${pp(it.name, "이가")} 곁을 따라다닙니다. 내 전리품을 주워 옵니다.` : `${it.name}${pp(it.name, "을를")} 돌려보냈습니다.`);
        p.dirty = true;
        return;
      }
      takeItem(ch, a.id, 1);
      if (it.type === "buff") {
        // the same scroll never stacks with itself: reading it again refills its time
        const had = ch.scr[it.buff] > now;
        ch.scr[it.buff] = now + it.min * 60000;
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, had ? `${it.name} — 남은 시간을 다시 채웠습니다 (10분).` : `${it.name}${pp(it.name, "을를")} 읽었습니다. ${it.desc.split(".")[0]}.`);
        p.dirty = true;
        return;
      }
      if (it.type === "camp") {
        S.maps[p.map].fires.push({ id: S.nextId++, x: Math.round(p.x), y: Math.round(p.y) - 14, until: now + FIRE_MS });
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, "모닥불을 피웠습니다. 앉아서(X) 쉬어 가세요.");
        p.dirty = true;
        return;
      }
      if (it.type === "food") {
        // a life-buff food (P8) trades the meal's xp/atk for its work buff `lf` (58-life.js lifeBuff)
        p.food = { id: a.id, until: now + it.buff.min * 60000, xp: it.buff.xp, atk: it.buff.atk, lf: it.buff.lf || null };
        toast(p, `${it.name}${pp(it.name, "을를")} ${it.lit ? "피웠습니다" : "먹었습니다"}. ${it.desc}`);
      }
      p.potAt = now + 900;
      if (it.heal) {
        const amt = Math.min(Math.round(pfxPot(S, p, st, it.heal + st.mhp * (it.pct || 0)) * elementHealFactor(S, p)), Math.max(1, Math.round(st.mhp - p.hp)));
        p.hp = Math.min(st.mhp, p.hp + amt);
        S.maps[p.map].ev.push(["h", p.eid, -amt, 0, 1]);
      }
      if (it.mana) p.mp = Math.min(st.mmp, p.mp + it.mana);
      if (it.cure) {
        p.burn = null; p.poison = null; p.slowed = 0;
        elementClear(p, "poison", "burn", "chill", "freeze");
        toast(p, "몸이 개운해졌습니다. 중독·화상·오한·빙결이 씻겨 나갔습니다.");
      }
      S.maps[p.map].ev.push(["u", p.eid, it.heal ? 0 : 1]);
      p.dirty = true;
    },
  },
  eq: {
    check(S, p, a) {
      const ch = p.ch;
      const s = invAt(ch, a.s);
      if (!s || !isGear(s.id)) return bad("장착할 수 없습니다");
      const it = ITEMS[s.id];
      // worn from item level − 10 (an entry without `il` asks what its base always asked: gearReq, 50-loot-combat.js)
      const need = gearReq(s);
      if (ch.lvl < need) return bad(`레벨 ${need}부터 착용할 수 있습니다`);
      if (a.k === "weapon2") {
        // a second main weapon for everyone (§9); a hybrid's is one of its pair
        if (it.type !== "weapon") return bad("무기만 Ⅱ에 장착할 수 있습니다");
        if (isHybrid(ch) && !JOBS[ch.job].wk.includes(it.wk)) return bad(`${JOBS[ch.job].wk.map((k) => WK_NAME[k]).join("이나 ")}만 들 수 있습니다`);
        return OK;
      }
      if (a.k !== undefined && !slotsFor(it.type).includes(a.k)) return bad("그 부위에는 착용할 수 없습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const s = ch.inv[a.s];
      // a ring goes where asked, else on the first bare finger
      const fits = slotsFor(ITEMS[s.id].type);
      const k = a.k === "weapon2" ? "weapon2" : fits.includes(a.k) ? a.k : fits.find((o) => !ch.eq[o]) || fits[0];
      const old = ch.eq[k], was = inHand(ch);
      ch.eq[k] = s;
      if (k === "weapon") p.hammer = null;
      if (old) ch.inv[a.s] = old;
      else ch.inv.splice(a.s, 1);
      // another kind of weapon in hand: a dance stops; a kind never used before puts its first skill on the bar
      if (inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
      if (k === "weapon") tutStep(S, p, "equip");
    },
  },
  uneq: {
    check(S, p, a) {
      const ch = p.ch;
      if (!SLOTS.includes(a.k)) return bad("잘못된 부위");
      if (!ch.eq[a.k]) return bad("장착한 장비가 없습니다");
      if (ch.inv.length >= bagCap(ch)) return bad("가방이 가득 찼습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const was = inHand(ch);
      ch.inv.push(ch.eq[a.k]);
      ch.eq[a.k] = null;
      if (a.k === "weapon") p.hammer = null;
      if (inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
    },
  },
  rune: {
    check(S, p, a) {
      const ch = p.ch;
      const s = invAt(ch, a.s);
      if (!s || ITEMS[s.id].type !== "rune") return bad("룬이 아닙니다");
      if (p.dead) return bad("쓰러진 상태입니다");
      const need = runeReq(s.il);
      if (ch.lvl < need) return bad(`레벨 ${need}부터 이 룬을 사용할 수 있습니다`);
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (!Number.isInteger(a.i) || a.i < 0 || a.i >= Math.min(g.sk, sockCap(g))) return bad("뚫린 홈이 없습니다");
      const current = g.ru[a.i];
      if (runeSocketId(current) === s.id && runeSocketLevel(current) === runeIl(s.il)) return bad("이미 같은 룬이 끼워져 있습니다");
      if (g.ru[a.i] && a.r !== 1) return bad("끼워진 룬을 교체하면 사라집니다. 교체를 확인하세요");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const g = ch.eq[a.k];
      const slot = ch.inv[a.s];
      if (--slot.n === 0) ch.inv.splice(a.s, 1);
      while (g.ru.length < g.sk) g.ru.push(null);
      g.ru[a.i] = [slot.id, runeIl(slot.il)];
      const name = RUNES[slot.id].name;
      toast(p, `[${name}]${pp(name, "을를")} 끼웠습니다.`);
      S.maps[p.map].ev.push(["e", p.eid, 1]);
      afterGear(S, p);
    },
  },
  socket: {
    check(S, p, a) { return socketValidate(p, a.k); },
    run(S, p, a) { socketApply(S, p, a.k); },
  },
  train: {
    check(S, p, a) {
      const ch = p.ch;
      // Spend earned points: a = [str, wil, dex, int, wis, luk].
      if (!Array.isArray(a.a) || a.a.length !== ST_ORDER.length || !a.a.every((v) => Number.isInteger(v) && v >= 0 && v <= 50)) return bad("잘못된 능력치");
      const n = a.a.reduce((s, v) => s + v, 0);
      if (n < 1 || n > 50) return bad("잘못된 능력치");
      if (p.dead) return bad("쓰러진 상태입니다");
      if (ST_ORDER.some((k, i) => ch.st[k] + a.a[i] > ST_CAP)) return bad(`능력치는 ${ST_CAP}까지 올릴 수 있습니다`);
      if (n > statPoints(ch)) return bad("능력치 포인트가 부족합니다");
      return OK;
    },
    run(S, p, a) {
      ST_ORDER.forEach((k, i) => { p.ch.st[k] += a.a[i]; });
      afterGear(S, p);
    },
  },

  // ── alive only: the warehouse, the shop
  wh: {
    check(S, p, a) {
      const ch = p.ch;
      if (!npcNear(p, "bank")) return bad("창고지기가 너무 멉니다");
      const wh = ch.wh;
      if (a.a === "gold") {
        if (!Number.isSafeInteger(a.n) || a.n === 0) return bad("잘못된 금액");
        if (a.n > 0 && ch.gold < a.n) return bad("골드가 부족합니다");
        if (a.n < 0 && wh.gold < -a.n) return bad("창고에 골드가 부족합니다");
        return OK;
      }
      // materials straight from the 재료 주머니: { a: "put", pid: itemId, n }
      if (a.a === "put" && typeof a.pid === "string") {
        const n = a.n | 0;
        if (n < 1 || n > pouchHas(ch, a.pid)) return bad("잘못된 수량");
        return whRoom(wh, a.pid, n) ? OK : bad("창고가 가득 찼습니다");
      }
      const from = a.a === "put" ? ch.inv : a.a === "take" ? wh.items : null;
      if (!from) return bad("잘못된 요청입니다");
      const sl = Number.isInteger(a.s) ? from[a.s] : null;
      if (!sl) return bad("아이템이 없습니다");
      if (a.a === "put" && isQuestItem(sl.id)) return bad("퀘스트 아이템은 창고에 맡길 수 없습니다");
      const n = isGear(sl.id) ? 1 : a.n | 0;
      if (n < 1 || n > (sl.n || 1)) return bad("잘못된 수량");
      if (a.a === "put") return whRoom(wh, sl.id, n, sl.il) ? OK : bad("창고가 가득 찼습니다");
      return (isGear(sl.id) ? ch.inv.length < bagCap(ch) : canAdd(ch, sl.id, n, sl.il)) ? OK : bad("가방이 가득 찼습니다");
    },
    run(S, p, a) {
      const ch = p.ch;
      const wh = ch.wh;
      if (a.a === "gold") {
        ch.gold -= a.n; wh.gold += a.n;
        toast(p, a.n > 0 ? `${a.n}G를 맡겼습니다.` : `${-a.n}G를 찾았습니다.`);
      } else if (a.a === "put" && typeof a.pid === "string") {
        // from the 재료 주머니 (taking it back out goes through addItem, so into the pouch again)
        stackInto(wh.items, a.pid, a.n | 0);
        pouchTake(ch, a.pid, a.n | 0);
      } else if (a.a === "put") {
        const sl = ch.inv[a.s];
        if (isGear(sl.id)) { ch.inv.splice(a.s, 1); wh.items.push(sl); }
        else {
          const n = a.n | 0;
          stackInto(wh.items, sl.id, n, sl.il);
          sl.n -= n;
          if (sl.n <= 0) ch.inv.splice(a.s, 1);
        }
        petCheck(S, p);
      } else {
        const sl = wh.items[a.s];
        if (isGear(sl.id)) { wh.items.splice(a.s, 1); ch.inv.push(sl); }
        else {
          const n = a.n | 0;
          addItem(ch, sl.id, n, sl.il);
          sl.n -= n;
          if (sl.n <= 0) wh.items.splice(a.s, 1);
        }
      }
      p.dirty = true;
    },
  },
  sellall: {
    check(S, p) {
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      return p.ch.inv.some(junk) ? OK : bad("팔 일반 장비가 없습니다");
    },
    run(S, p) {
      const ch = p.ch;
      // every plain, unenhanced, unsocketed piece in the bag goes in one go
      let n = 0, gold = 0;
      for (let i = ch.inv.length - 1; i >= 0; i--) {
        if (!junk(ch.inv[i])) continue;
        gold += sellPrice(ch.inv[i]);
        ch.inv.splice(i, 1);
        n++;
      }
      ch.gold += gold;
      p.gain.push(["gold", gold]);
      toast(p, `일반 장비 ${n}개를 ${gold}G에 팔았습니다.`);
      p.dirty = true;
    },
  },
  buy: {
    check(S, p, a) {
      const ch = p.ch;
      if (typeof a.id !== "string" || !Object.hasOwn(ITEMS, a.id) && !SHOP.includes(a.id)) return bad("팔지 않는 물건입니다");
      const n = a.n | 0;
      if (n < 1 || n > STACK) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      if (!goodsNear(p).has(a.id)) return bad("이 가게에서는 팔지 않는 물건입니다");
      const id = resolveItem(a.id, ch);
      if (ch.gold < buyCost(p, a.id, id, n)) return bad("골드가 부족합니다");
      if (!canAdd(ch, id, n)) return bad("가방이 가득 찼습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const id = resolveItem(a.id, ch);
      const n = a.n | 0;
      ch.gold -= buyCost(p, a.id, id, n);
      addItem(ch, id, n);
      foundItem(S, p, id, n);
      if (ITEMS[id].type === "pot") tutStep(S, p, "buy");
      p.dirty = true;
    },
  },
  sell: {
    check(S, p, a) {
      const ch = p.ch;
      // from the 재료 주머니: { pid: itemId, n }
      if (typeof a.pid === "string") {
        const n = a.n | 0;
        if (n < 1 || n > pouchHas(ch, a.pid)) return bad("잘못된 수량");
        return npcNear(p, "shop") ? OK : bad("상인이 너무 멉니다");
      }
      // every piece of plain gear at once: { junk: 0 | 1 } (46-bag.js junkSlots)
      if (a.junk !== undefined) {
        if (a.junk !== 0 && a.junk !== 1) return bad("잘못된 요청");
        if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
        return junkSlots(ch, a.junk).length ? OK : bad("팔 만한 장비가 없습니다");
      }
      const s = invAt(ch, a.s);
      if (!s) return bad("아이템이 없습니다");
      if (isQuestItem(s.id)) return bad("퀘스트 아이템은 팔 수 없습니다");
      const n = a.n | 0;
      if (n < 1 || n > (s.n || 1)) return bad("잘못된 수량");
      if (!npcNear(p, "shop")) return bad("상인이 너무 멉니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const n = a.n | 0;
      if (typeof a.pid === "string") {
        // from the 재료 주머니
        const each = sellPrice({ id: a.pid });
        pouchTake(ch, a.pid, n);
        ch.gold += each * n;
        p.gain.push(["gold", each * n]);
        p.dirty = true;
        return;
      }
      if (a.junk !== undefined) {
        let gold = 0, cnt = 0;
        for (const i of junkSlots(ch, a.junk)) { gold += sellPrice(ch.inv[i]); ch.inv.splice(i, 1); cnt++; }
        ch.gold += gold;
        p.gain.push(["gold", gold]);
        toast(p, `장비 ${cnt}개를 ${gStr(gold)}G에 팔았습니다.`);
        petCheck(S, p);
        p.dirty = true;
        return;
      }
      const s = ch.inv[a.s];
      const each = sellPrice(s);
      ch.gold += each * n;
      if (isGear(s.id) || s.n <= n) ch.inv.splice(a.s, 1);
      else s.n -= n;
      p.gain.push(["gold", each * n]);
      petCheck(S, p);
      p.dirty = true;
    },
  },

  // ── alive only: the smith
  enh: {
    check(S, p, a) {
      const ch = p.ch;
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g) return bad("장착한 장비가 없습니다");
      if (isJewel(g.id)) return bad("장신구는 강화할 수 없습니다");
      if (g.enh >= 10) return bad("최대 강화 단계입니다");
      if (g.cu === 1) return bad("저주받은 장비는 강화할 수 없습니다 — 저주 해제 주문서로 먼저 풀어 주세요");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      const c = enhCost(g);
      if (ch.gold < c.gold) return bad("골드가 부족합니다");
      if (countItem(ch, "stone") < c.stone) return bad("강화석이 부족합니다");
      // b: 1 adds a 축복 강화석 (+10 %p, a failure never drops a step)
      if (a.b !== undefined && a.b !== 0 && a.b !== 1) return bad("잘못된 요청입니다");
      if (a.b === 1 && countItem(ch, "stone_b") < 1) return bad("축복 강화석이 없습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const g = ch.eq[a.k];
      const c = enhCost(g);
      ch.gold -= c.gold;
      takeItem(ch, "stone", c.stone);
      // a 축복 강화석 (b: 1): +ENH_BLESS %p, and a failure keeps the step and brings no curse
      const bless = a.b === 1;
      if (bless) takeItem(ch, "stone_b", 1);
      // the roll, with the pity gauge (63-social-weekly.js enhWin: failures from +5 fill it, a full gauge is a sure try)
      const win = enhWin(S, ch, g, bless);
      // a lifted curse (cu 2) helps this one try only
      if (g.cu === 2) delete g.cu;
      if (win) {
        g.enh++;
        toast(p, `${gearFull(g)} 강화 성공!`);
        if (g.enh >= 7) sys(S, `${ch.name}님이 ${gearFull(g)} 강화에 성공했습니다!`);
        ch.cnt.enh = Math.max(ch.cnt.enh, g.enh);
        checkAch(S, p);
      } else if (bless) {
        toast(p, `${gearFull(g)} 강화 실패... 축복 덕분에 단계도 그대로, 저주도 없습니다.`);
      } else {
        // owner (job-freedom.md §8): a failure drops one step and curses the piece until a 저주 해제 주문서 lifts it
        g.enh = Math.max(0, g.enh - 1);
        g.cu = 1;
        toast(p, `강화 실패... ${gearFull(g)}${pp(gearFull(g), "으로")} 내려가고 저주를 받았습니다. 저주 해제 주문서로 풀 수 있습니다.`);
      }
      S.maps[p.map].ev.push(["e", p.eid, win ? 1 : 0, win ? g.enh : bless ? 0 : -1]);
      afterGear(S, p);
    },
  },
  uncurse: {
    check(S, p, a) {
      const ch = p.ch;
      const g = SLOTS.includes(a.k) ? ch.eq[a.k] : null;
      if (!g || g.cu !== 1) return bad("저주받은 장비가 아닙니다");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      if (countItem(ch, "uncurse") < 1) return bad("저주 해제 주문서가 없습니다");
      if (ch.gold < UNCURSE_FEE * ITEMS[g.id].tier) return bad(`저주 해제 수수료 ${(UNCURSE_FEE * ITEMS[g.id].tier).toLocaleString()}G가 부족합니다`);
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const g = ch.eq[a.k];
      takeItem(ch, "uncurse", 1);
      ch.gold -= UNCURSE_FEE * ITEMS[g.id].tier;
      g.cu = 2;
      toast(p, `${gearFull(g)}의 저주가 풀렸습니다 — 다음 강화는 성공 확률 +${ENH_UNCURSE}%p`);
      S.maps[p.map].ev.push(["e", p.eid, 2]);
      afterGear(S, p);
    },
  },
  salv: {
    check(S, p, a) {
      const s = invAt(p.ch, a.s);
      if (!s || !isGear(s.id)) return bad("분해할 수 없는 아이템");
      if (!npcNear(p, "smith")) return bad("대장장이가 너무 멉니다");
      if (!canAdd(p.ch, "stone", 12)) return bad("가방이 가득 찼습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const s = ch.inv[a.s];
      ch.inv.splice(a.s, 1);
      // better pieces break down into more stones; enhancement gives some back
      const n = [rnd(S) < 0.35 ? 1 : 0, 1, 2, 5, 5, 8][s.q | 0] + Math.floor((s.enh | 0) / 2);
      if (n > 0) { addItem(ch, "stone", n); p.gain.push(["item", "stone", n, 0]); }
      toast(p, n > 0 ? `${gearName(s)} 분해 — 강화석 ${n}개` : `${gearName(s)} 분해 — 건진 것이 없습니다`);
      p.dirty = true;
    },
  },

  // ── alive only: the elder's bounties and quests
  bq: {
    check(S, p, a) {
      const ch = p.ch;
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      if (a.a === "take") {
        const d = MOBS[a.k];
        if (typeof a.k !== "string" || !d || d.boss || d.chest || d.questOnly) return bad("그런 의뢰는 없습니다");
        if (d.lv > toTier(ch.lvl) + 4) return bad("아직 감당하기 어려운 상대입니다");
        return OK;
      }
      if (a.a === "done") return ch.bq && ch.bq.n >= ch.bq.need ? OK : bad("아직 의뢰를 마치지 못했습니다");
      return bad("잘못된 요청입니다");
    },
    run(S, p, a) {
      const ch = p.ch;
      if (a.a === "take") {
        ch.bq = { k: a.k, n: 0, need: BOUNTY_N };
        toast(p, `반복 토벌 수락: ${MOBS[a.k].name} ${BOUNTY_N}마리`);
      } else {
        const d = MOBS[ch.bq.k];
        const gold = Math.round(((d.gold[0] + d.gold[1]) / 2) * ch.bq.need * 0.8);
        ch.gold += gold;
        p.gain.push(["gold", gold]);
        ch.bn++;
        // every third report earns a stone, every tenth a rune
        if (ch.bn % 3 === 0 && addItem(ch, "stone", 1)) p.gain.push(["item", "stone", 1, 0]);
        if (ch.bn % 10 === 0) gainRune(S, p);
        toast(p, `반복 토벌 완료 (${ch.bn}회째) — 같은 의뢰가 다시 시작됩니다.`);
        dailyProg(S, p, "bounty");
        const xp = Math.round(d.xp * ch.bq.need * 0.5);
        ch.bq = { k: ch.bq.k, n: 0, need: BOUNTY_N };
        gainXp(S, p, xp);
      }
      p.dirty = true;
    },
  },
  quest: {
    check(S, p, a) {
      const ch = p.ch;
      if (!npcNear(p, "elder")) return bad("관리자가 너무 멉니다");
      const quest = QUESTS[ch.q.i];
      if (!quest) return bad("모든 의뢰를 마쳤습니다");
      if (a.a === "accept") {
        if (ch.q.st !== 0) return bad("이미 진행 중입니다");
        // a chapter's story beat comes first (QUESTS `sq`, 62-side-quests.js SQ_MAIN)
        const beat = quest.sq && !ch.sq.done[quest.sq] ? SQ_BY[quest.sq] : null;
        return beat ? bad(`먼저 [${beat.title}]${pp(beat.title, "을를")} 마쳐 주게 — ${npcName(beat.giver)}`) : OK;
      }
      if (a.a === "done") {
        if (ch.q.st !== 1 || ch.q.n < quest.n) return bad("아직 의뢰를 마치지 못했습니다");
        for (const [id, n] of quest.items) if (!canAdd(ch, id, n)) return bad("가방을 비우고 다시 오세요");
        return OK;
      }
      return bad("잘못된 요청입니다");
    },
    run(S, p, a) {
      const ch = p.ch;
      const quest = QUESTS[ch.q.i];
      tutStep(S, p, "talk");
      if (a.a === "accept") {
        ch.q.st = 1; ch.q.n = 0;
        toast(p, `의뢰 수락: ${quest.title}`);
      } else {
        ch.gold += quest.gold;
        p.gain.push(["gold", quest.gold]);
        for (const [id, n] of quest.items) if (addItem(ch, id, n)) foundItem(S, p, id, n);
        ch.q = { i: ch.q.i + 1, n: 0, st: 0 };
        toast(p, `의뢰 완료: ${quest.title}`);
        if (quest.honor) { checkAch(S, p); toast(p, `칭호 「${quest.honor}」 획득!`); }
        if (cosRoll(S, p, "quest") < COS_QUEST) cosFrom(S, p, "quest", "의뢰 보상");
        gainXp(S, p, quest.xp);
      }
      p.dirty = true;
    },
  },

  // ── alive only: jobs and stats (45-jobs.js): reset, the starter weapon, a job, a hybrid's swap
  respec: {
    check(S, p) {
      const ch = p.ch;
      if (p.dead) return bad("쓰러진 상태입니다");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (!spentPoints(ch.st)) return bad("되돌릴 능력치가 없습니다");
      const gold = statResetCost(ch);
      if (gold && countItem(ch, RESPEC_ITEM) < 1) return bad("되새김 인장이 필요합니다");
      if (ch.gold < gold) return bad(`골드가 부족합니다 (${gold.toLocaleString()}G 필요)`);
      return OK;
    },
    run(S, p) {
      const ch = p.ch;
      const fee = statResetCost(ch);
      if (fee) {
        ch.gold -= fee;
        takeItem(ch, RESPEC_ITEM, 1);
      } else ch.rs--;
      ch.st = freshSt();
      afterGear(S, p);
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `망각의 의식 — 능력치를 모두 되돌렸습니다.${fee ? ` (되새김 인장 1개 · ${fee.toLocaleString()}G)` : " (무료)"}`);
    },
  },
  starter: {
    check(S, p, a) {
      const ch = p.ch;
      if (ch.sw) return bad("이미 무기를 받았습니다");
      if (!STARTER_WKS.includes(a.wk)) return bad("그런 무기는 없습니다");
      if (!npcNear(p, "train")) return bad("수련관이 너무 멉니다");
      if (ch.inv.length >= bagCap(ch)) return bad("가방이 가득 찼습니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      // the weapon picked at 카이 goes straight into the hand; the one held before goes to the bag
      const id = `w_${WK_ID[a.wk]}_1`, old = ch.eq.weapon, was = inHand(ch);
      ch.sw = 1;
      ch.eq.weapon = plain(id);
      if (old) ch.inv.push(old);
      p.gain.push(["item", id, 1, 0]);
      if (inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
      toast(p, `[${ITEMS[id].name}]${pp(ITEMS[id].name, "을를")} 받아 손에 들었습니다.${old ? " 들던 무기는 가방에 넣었습니다." : ""}`);
      tutStep(S, p, "equip");
    },
  },
  job_change: {
    check(S, p, a) {
      const ch = p.ch;
      if (typeof a.j !== "string") return bad("없는 직업입니다");
      const why = jobOk(ch, a.j);
      if (why) return bad(why);
      if (!npcNear(p, "job")) return bad("전직관이 너무 멉니다");
      // a job walked before is taken up again for free (47-job-freedom.js)
      if (!ch.jobs[a.j] && ch.gold < JOBS[a.j].cost) return bad("골드가 부족합니다");
      return OK;
    },
    run(S, p, a) {
      const ch = p.ch;
      const job = JOBS[a.j], back = ch.jobs[a.j];
      if (!back) ch.gold -= job.cost;
      ch.job = a.j;
      // a job walked before resumes where it was left (47-job-freedom.js)
      ch.jp = ch.jobs[a.j] = back || { lv: 1, xp: 0 };
      afterGear(S, p);
      S.maps[p.map].ev.push(["jc", p.eid]);
      sys(S, `${ch.name}님이 [${job.name}]의 길을 걷기 시작했습니다!`);
      toast(p, `[${job.name}] 전직!`);
      // the job's signature skill onto the bar
      const signature = SKILL[JOB_SKILL[a.j]];
      if (back) toast(p, `[${job.name}] 직업 Lv.${back.lv}부터 이어서 걷습니다.`);
      else if (signature) toast(p, `직업 Lv.${signature.jobNeed}에 [${signature.name}]${pp(signature.name, "을를")} 배웁니다.`);
      checkAch(S, p);
    },
  },
  wsw: {
    check(S, p) {
      if (p.dead || p.fish) return bad("지금은 무기를 바꿀 수 없습니다");
      if (!p.ch.eq.weapon2) return bad("Ⅱ에 장착한 무기가 없습니다");
      if (S.now < (p.wswAt || 0)) return bad("wsw");
      return OK;
    },
    run(S, p) {
      const ch = p.ch;
      // a hybrid's swap keeps both weapons' gauges; only a dance in progress stops. Anyone else: as a re-equip.
      const was = inHand(ch);
      [ch.eq.weapon, ch.eq.weapon2] = [ch.eq.weapon2, ch.eq.weapon];
      p.wswAt = S.now + WSW_MS;
      p.dance = null;
      if (!isHybrid(ch) && inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
      S.maps[p.map].ev.push(["ws", p.eid]);
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
