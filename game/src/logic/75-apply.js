export function applyAction(S, pid, a) {
  const p = S.players[pid];
  const ch = p.ch;
  const now = S.now;
  const m = MAPS[p.map];
  switch (a.t) {
    case "mv": {
      if (p.dance) { p.fix = true; break; }
      const dt = clamp(now - p.mvAt, 0, 600);
      p.mvAt = now;
      const max = (stats(p).spd * dt) / 1000 * 1.6 + 8;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d > max || !canStand(m, a.x, a.y)) { p.fix = true; break; }
      if (d > 1.5) rouse(S, p);
      p.x = a.x; p.y = a.y;
      if (a.d >= 0 && a.d <= 3) p.dir = a.d | 0;
      // stepping anywhere on a gate tile (or brushing its edge) takes you through
      for (const pt of m.portals) {
        if (dist(p.x, p.y - 3, pt.x * T + 8, pt.y * T + 8) < 12) { changeMap(S, p, pt.to, pt.tx * T + 8, pt.ty * T + 10); break; }
      }
      break;
    }
    case "atk": basicAttack(S, p); break;
    case "sk": castSkill(S, p, a.i); break;
    case "use": {
      const it = ITEMS[a.id];
      const st = stats(p);
      if (it.type === "scroll") {
        rouse(S, p);
        p.recall = { at: now + RECALL_MS };
        S.maps[p.map].ev.push(["rc", p.eid, RECALL_MS]);
        toast(p, "귀환 주문서를 읽는 중… (움직이거나 피해를 입으면 취소)");
        p.dirty = true;
        break;
      }
      if (it.type === "pet") {
        // the same pet again sends it home; another takes its place
        ch.pet = ch.pet === a.id ? "" : a.id;
        S.maps[p.map].who = true;
        if (ch.pet) S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, ch.pet ? `${it.name}이(가) 곁을 따라다닙니다. 내 전리품을 주워 옵니다.` : `${it.name}을(를) 돌려보냈습니다.`);
        p.dirty = true;
        break;
      }
      takeItem(ch, a.id, 1);
      if (it.type === "buff") {
        // the same scroll never stacks with itself: reading it again refills its time
        const had = ch.scr[it.buff] > now;
        ch.scr[it.buff] = now + it.min * 60000;
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, had ? `${it.name} — 남은 시간을 다시 채웠습니다 (10분).` : `${it.name}을(를) 읽었습니다. ${it.desc.split(".")[0]}.`);
        p.dirty = true;
        break;
      }
      if (it.type === "camp") {
        S.maps[p.map].fires.push({ id: S.nextId++, x: Math.round(p.x), y: Math.round(p.y) - 14, until: now + FIRE_MS });
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, "모닥불을 피웠습니다. 앉아서(X) 쉬어 가세요.");
        p.dirty = true;
        break;
      }
      if (it.type === "food") {
        p.food = { id: a.id, until: now + it.buff.min * 60000, xp: it.buff.xp, atk: it.buff.atk };
        toast(p, `${it.name}을(를) 먹었습니다. ${it.desc}`);
      }
      p.potAt = now + 900;
      if (it.heal) {
        const amt = Math.min(Math.round(it.heal + st.mhp * (it.pct || 0)), Math.max(1, Math.round(st.mhp - p.hp)));
        p.hp = Math.min(st.mhp, p.hp + amt);
        S.maps[p.map].ev.push(["h", p.eid, -amt, 0, 1]);
      }
      if (it.mana) p.mp = Math.min(st.mmp, p.mp + it.mana);
      S.maps[p.map].ev.push(["u", p.eid, it.heal ? 0 : 1]);
      p.dirty = true;
      break;
    }
    case "eq": {
      const s = ch.inv[a.s];
      // a ring goes where asked, else on the first bare finger
      const fits = slotsFor(ITEMS[s.id].type);
      const k = fits.includes(a.k) ? a.k : fits.find((o) => !ch.eq[o]) || fits[0];
      const old = ch.eq[k];
      ch.eq[k] = s;
      if (old) ch.inv[a.s] = old;
      else ch.inv.splice(a.s, 1);
      afterGear(S, p);
      if (k === "weapon") tutStep(S, p, "equip");
      break;
    }
    case "uneq":
      ch.inv.push(ch.eq[a.k]);
      ch.eq[a.k] = null;
      afterGear(S, p);
      break;
    case "rune": {
      const g = ch.eq[a.k];
      const key = ITEMS[ch.inv[a.s].id].rune;
      takeItem(ch, `ru_${key}`, 1);
      while (g.ru.length < g.sk) g.ru.push(null);
      g.ru[a.i] = key;
      const rw = runeword(g);
      toast(p, rw ? `룬어 [${rw.name}] 완성!` : `${RUNES[key][0]} 룬을 끼웠습니다.`);
      if (rw) { sys(S, `${ch.name}님이 룬어 [${rw.name}]을(를) 완성했습니다!`); ch.st.rw++; checkAch(S, p); }
      S.maps[p.map].ev.push(["e", p.eid, 1]);
      afterGear(S, p);
      break;
    }
    case "train": {
      const n = a.n | 0;
      ch.xp -= trainTotal(ch.tr[a.k], n);
      ch.tr[a.k] += n;
      p.stc = null;
      p.dirty = true;
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `${TRAIN[a.k].name} +${n} (누적 ${ch.tr[a.k]})`);
      break;
    }
    case "sklv": {
      const sk = SKILLS[ch.cls][a.i], c = skillCost(sk, ch.skl[a.i]);
      ch.gold -= c.gold;
      ch.xp -= c.xp;
      const L = ++ch.skl[a.i];
      p.dirty = true;
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `[${sk.name}] 스킬 레벨 ${L}!${L === 5 || L === 10 ? " 재사용 대기시간이 줄었습니다." : ""}`);
      break;
    }
    case "wh": {
      const wh = ch.wh;
      if (a.a === "gold") {
        ch.gold -= a.n; wh.gold += a.n;
        toast(p, a.n > 0 ? `${a.n}G를 맡겼습니다.` : `${-a.n}G를 찾았습니다.`);
      } else if (a.a === "put") {
        const sl = ch.inv[a.s];
        if (isGear(sl.id)) { ch.inv.splice(a.s, 1); wh.items.push(sl); }
        else {
          const n = a.n | 0;
          stackInto(wh.items, sl.id, n);
          sl.n -= n;
          if (sl.n <= 0) ch.inv.splice(a.s, 1);
        }
        petCheck(S, p);
      } else {
        const sl = wh.items[a.s];
        if (isGear(sl.id)) { wh.items.splice(a.s, 1); ch.inv.push(sl); }
        else {
          const n = a.n | 0;
          addItem(ch, sl.id, n);
          sl.n -= n;
          if (sl.n <= 0) wh.items.splice(a.s, 1);
        }
      }
      p.dirty = true;
      break;
    }
    case "sellall": {
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
      break;
    }
    case "look":
      ch.look = cleanLook(a.look);
      ch.gold -= LOOK_COST;
      S.maps[p.map].who = true;
      toast(p, `새 모습이 되었습니다! (-${LOOK_COST}G)`);
      p.dirty = true;
      break;
    case "opt":
      if (a.filter !== undefined) ch.opt.filter = a.filter;
      if (a.ahp !== undefined) ch.opt.ahp = a.ahp;
      if (a.amp !== undefined) ch.opt.amp = a.amp;
      p.dirty = true;
      break;
    case "buy": {
      const id = resolveItem(a.id, ch.cls);
      const n = a.n | 0;
      ch.gold -= ITEMS[id].price * n;
      addItem(ch, id, n);
      p.gain.push(["item", id, n, 0]);
      if (ITEMS[id].type === "pot") tutStep(S, p, "buy");
      p.dirty = true;
      break;
    }
    case "sell": {
      const s = ch.inv[a.s];
      const n = a.n | 0;
      const each = sellPrice(s);
      ch.gold += each * n;
      if (isGear(s.id) || s.n <= n) ch.inv.splice(a.s, 1);
      else s.n -= n;
      p.gain.push(["gold", each * n]);
      petCheck(S, p);
      p.dirty = true;
      break;
    }
    case "enh": {
      const g = ch.eq[a.k];
      const c = enhCost(g);
      ch.gold -= c.gold;
      takeItem(ch, "stone", c.stone);
      const win = rnd(S) * 100 < ENH_RATE[g.enh];
      if (win) {
        g.enh++;
        toast(p, `강화 성공! ${gearName(g)}`);
        if (g.enh >= 7) sys(S, `${ch.name}님이 ${gearName(g)} 강화에 성공했습니다!`);
        ch.st.enh = Math.max(ch.st.enh, g.enh);
        checkAch(S, p);
      } else if (g.enh >= 5) {
        g.enh--;
        toast(p, `강화 실패... ${gearName(g)}(으)로 단계가 내려갔습니다.`);
      } else {
        toast(p, "강화 실패... 장비는 무사합니다.");
      }
      S.maps[p.map].ev.push(["e", p.eid, win ? 1 : 0]);
      afterGear(S, p);
      break;
    }
    case "sit":
      if (p.sit) p.sit = false;
      else { rouse(S, p); p.sit = true; p.warmT = 0; }
      break;
    case "fish": {
      rouse(S, p);
      const [wx, wy] = waterNear(m, p);
      p.fish = { at: now + 2500 + rnd(S) * 4500, bite: 0 };
      p.dir = dirOf(wx - p.x, wy - p.y);
      S.maps[p.map].ev.push(["f", p.eid, 1, wx, wy]);
      break;
    }
    case "hook":
      // the fish is on: the angler now plays it in, and reports how well that went
      p.fish.hook = now;
      S.maps[p.map].ev.push(["f", p.eid, 3]);
      break;
    case "reel": {
      const { bite, hook } = p.fish;
      p.fish = null;
      S.maps[p.map].ev.push(["f", p.eid, 0]);
      if (!bite) { toast(p, "너무 일찍 당겼습니다…"); break; }
      // how well the fish was played (0–100) decides what comes out of the water;
      // a fight that ended implausibly fast counts for little
      let score = hook ? clamp(a.s | 0, 0, 100) : 30;
      if (hook && now - hook < 2500) score = Math.min(score, 40);
      if (score < 30) { toast(p, "물고기가 줄을 끊고 달아났습니다."); break; }
      const k = score / 100, r = rnd(S);
      const gold = 0.01 + 0.07 * k * k, trout = 0.1 + 0.3 * k;
      const id = r < gold ? "fish_l" : r < gold + trout ? "fish_m" : r < gold + trout + 0.04 ? "stone" : "fish_s";
      if (score >= 95) toast(p, "완벽한 낚시!");
      if (addItem(ch, id, 1)) p.gain.push(["item", id, 1, id === "fish_l" ? 3 : id === "fish_m" ? 1 : 0]);
      ch.fish++;
      if (id === "fish_l") { sys(S, `${ch.name}님이 [황금 잉어]를 낚았습니다!`); ch.st.carp++; }
      if (id.startsWith("fish")) dailyProg(S, p, "fish");
      checkAch(S, p);
      p.dirty = true;
      break;
    }
    case "cook": {
      const it = ITEMS[a.id];
      takeItem(ch, a.id, 1);
      // how neatly the pan was packed (0–100): a mess burns, a perfect fit feeds two
      const score = clamp(a.s | 0, 0, 100);
      const out = score < 35 ? "burnt" : it.cook, n = score >= 85 ? 2 : 1;
      addItem(ch, out, n);
      p.gain.push(["item", out, n, 0]);
      toast(p, score < 35 ? "태워 버렸습니다…" : score >= 85 ? `완벽한 요리! ${ITEMS[out].name} 2개` : `${ITEMS[out].name} 완성`);
      if (score >= 35) { ch.st.cook++; dailyProg(S, p, "cook"); checkAch(S, p); }
      S.maps[p.map].ev.push(["u", p.eid, 0]);
      p.dirty = true;
      break;
    }
    case "salv": {
      const s = ch.inv[a.s];
      ch.inv.splice(a.s, 1);
      // better pieces break down into more stones; enhancement gives some back
      const n = [rnd(S) < 0.35 ? 1 : 0, 1, 2, 5, 5][s.q | 0] + Math.floor((s.enh | 0) / 2);
      if (n > 0) { addItem(ch, "stone", n); p.gain.push(["item", "stone", n, 0]); }
      toast(p, n > 0 ? `${gearName(s)} 분해 — 강화석 ${n}개` : `${gearName(s)} 분해 — 건진 것이 없습니다`);
      p.dirty = true;
      break;
    }
    case "bq": {
      if (a.a === "take") {
        ch.bq = { k: a.k, n: 0, need: BOUNTY_N };
        toast(p, `반복 의뢰 수락: ${MOBS[a.k].name} ${BOUNTY_N}마리`);
      } else {
        const d = MOBS[ch.bq.k];
        const gold = Math.round(((d.gold[0] + d.gold[1]) / 2) * ch.bq.need * 0.8);
        ch.gold += gold;
        p.gain.push(["gold", gold]);
        ch.bn++;
        // every third report earns a stone, every tenth a rune
        if (ch.bn % 3 === 0 && addItem(ch, "stone", 1)) p.gain.push(["item", "stone", 1, 0]);
        if (ch.bn % 10 === 0) {
          const id = `ru_${RUNE_KEYS[ri(S, 0, RUNE_KEYS.length - 1)]}`;
          if (addItem(ch, id, 1)) p.gain.push(["item", id, 1, 0]);
        }
        toast(p, `반복 의뢰 완료 (${ch.bn}회째) — 같은 의뢰가 다시 시작됩니다.`);
        dailyProg(S, p, "bounty");
        const xp = Math.round(d.xp * ch.bq.need * 0.5);
        ch.bq = { k: ch.bq.k, n: 0, need: BOUNTY_N };
        gainXp(S, p, xp);
      }
      p.dirty = true;
      break;
    }
    case "quest": {
      const quest = QUESTS[ch.q.i];
      tutStep(S, p, "talk");
      if (a.a === "accept") {
        ch.q.st = 1; ch.q.n = 0;
        toast(p, `의뢰 수락: ${quest.title}`);
      } else {
        ch.gold += quest.gold;
        p.gain.push(["gold", quest.gold]);
        for (const [id, n] of quest.items) { addItem(ch, id, n); p.gain.push(["item", id, n, 0]); }
        ch.q = { i: ch.q.i + 1, n: 0, st: 0 };
        toast(p, `의뢰 완료: ${quest.title}`);
        gainXp(S, p, quest.xp);
      }
      p.dirty = true;
      break;
    }
    case "respawn": {
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
        break;
      }
      const lost = deathLoss(ch);
      ch.xp -= lost;
      p.dead = false;
      changeMap(S, p, START.map, START.x, START.y);
      const st = stats(p);
      p.hp = st.mhp; p.mp = st.mmp;
      p.dirty = true;
      toast(p, lost > 0 ? `광장에서 깨어났습니다. (경험치 -${lost})` : "광장에서 깨어났습니다.");
      break;
    }
    case "chat": {
      const text = a.m.trim().slice(0, 80);
      p.chatAt = now;
      S.chat.push({ n: ch.name, m: text });
      S.maps[p.map].ev.push(["s", p.eid, text]);
      break;
    }
    case "pinv": {
      const o = byEid(S, a.e);
      o.pinv = { from: pid, at: now };
      toast(p, `${o.ch.name}님을 파티에 초대했습니다.`);
      break;
    }
    case "pacc": {
      const from = S.players[p.pinv.from];
      p.pinv = null;
      let party = S.parties[from.party];
      if (!party) {
        party = { id: S.nextId++, m: [from.pid] };
        S.parties[party.id] = party;
        from.party = party.id;
      }
      party.m.push(pid);
      p.party = party.id;
      for (const o of members(S, p)) { toast(o, `${ch.name}님이 파티에 참가했습니다.`); S.maps[o.map].who = true; }
      break;
    }
    case "pdec": p.pinv = null; break;
    case "gcreate":
      ch.gold -= GUILD_COST;
      ch.guild = a.name; ch.gm = 1;
      sys(S, `${ch.name}님이 길드 [${a.name}]을(를) 세웠습니다!`);
      ch.st.gfound = 1;
      checkAch(S, p);
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "ginv": {
      const o = byEid(S, a.e);
      o.ginv = { from: pid, g: ch.guild, at: now };
      toast(p, `${o.ch.name}님을 길드에 초대했습니다.`);
      break;
    }
    case "gacc": {
      ch.guild = p.ginv.g; ch.gm = 0;
      p.ginv = null;
      for (const oid of Object.keys(S.players)) {
        const o = S.players[oid];
        if (o.ch.guild === ch.guild) { toast(o, `${ch.name}님이 길드 [${ch.guild}]에 들어왔습니다.`); o.dirty = true; }
      }
      checkAch(S, p);
      S.maps[p.map].who = true;
      break;
    }
    case "gdec": p.ginv = null; break;
    case "glist": p.dirty = true; break;
    case "gleave":
      toast(p, `길드 [${ch.guild}]을(를) 떠났습니다.`);
      ch.guild = ""; ch.gm = 0;
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "gchat":
      p.chatAt = now;
      S.chat.push({ n: ch.name, m: a.m.trim().slice(0, 80), g: ch.guild });
      break;
    case "pchat":
      p.chatAt = now;
      S.chat.push({ n: ch.name, m: a.m.trim().slice(0, 80), pt: p.party });
      break;
    case "qs":
      if (a.j !== undefined) [ch.qs[a.i], ch.qs[a.j]] = [ch.qs[a.j], ch.qs[a.i]];
      else ch.qs[a.i] = a.v ? a.v.slice() : null;
      p.dirty = true;
      break;
    case "sort": {
      // by kind, then the better piece first, then the higher level; stacks of the same thing merge
      const rank = (e) => { const r = SORT_KIND.indexOf(ITEMS[e.id].type); return r < 0 ? 99 : r; };
      const order = ch.inv.map((e, i) => [e, i]).sort(([a1, i1], [b1, i2]) => rank(a1) - rank(b1) || (b1.q || 0) - (a1.q || 0) || (ITEMS[b1.id].req || 0) - (ITEMS[a1.id].req || 0) || (a1.id < b1.id ? -1 : a1.id > b1.id ? 1 : 0) || i1 - i2).map(([e]) => e);
      const out = [];
      for (const e of order) {
        const top = out[out.length - 1];
        if (!isGear(e.id) && top && top.id === e.id && top.n < STACK) {
          const put = Math.min(e.n || 1, STACK - top.n);
          top.n += put;
          if ((e.n || 1) > put) out.push({ id: e.id, n: (e.n || 1) - put });
        } else out.push(e);
      }
      ch.inv = out;
      p.dirty = true;
      break;
    }
    case "emo":
      p.emoAt = now;
      S.maps[p.map].ev.push(["o", p.eid, a.i]);
      break;
    case "title":
      ch.title = a.id || "";
      p.stc = null;
      S.maps[p.map].who = true;
      toast(p, ch.title ? `칭호 「${titleOf(ch)}」을(를) 달았습니다.` : "칭호를 떼었습니다.");
      p.dirty = true;
      break;
    case "cos_eq":
      ch.cos.on[COSMETICS[a.id].slot] = a.id;
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "cos_off":
      delete ch.cos.on[a.s];
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "cos_buy": {
      const c = COSMETICS[a.id];
      ch.gold -= c.price;
      ch.cos.own.push(a.id);
      // bought to be worn: put it on straight away
      ch.cos.on[c.slot] = a.id;
      S.maps[p.map].who = true;
      toast(p, `[${c.name}]을(를) 샀습니다. 캐릭터 창 ‘외형’ 탭에서 갈아입을 수 있습니다.`);
      p.dirty = true;
      break;
    }
    case "daily": {
      const dl = ch.daily;
      if (a.i === "bonus") {
        dl.bonus = true;
        ch.st.daily++;
        toast(p, "일일 과제 보상 상자를 열었습니다!");
        payout(S, p, dailyBonus(ch));
        cosFrom(S, p, "daily", "일일 과제 보상 상자");
      } else {
        dl.claimed[a.i] = true;
        payout(S, p, dailyReward(ch, dl.tasks[a.i]));
      }
      checkAch(S, p);
      break;
    }
    case "tut": tutStep(S, p, a.s); break;
    case "warp": {
      const w = WP[a.to];
      S.maps[p.map].ev.push(["wp", p.eid, 0]);
      changeMap(S, p, a.to, w.ax * T + 8, w.ay * T + 10);
      S.maps[a.to].ev.push(["wp", p.eid, 1]);
      toast(p, `[${MAPS[a.to].name}]의 이동의 돌로 건너왔습니다.`);
      p.dirty = true;
      break;
    }
    case "pleave":
      leaveParty(S, p);
      toast(p, "파티를 떠났습니다.");
      break;
  }
  return S;
}

function afterGear(S, p) {
  p.stc = null;
  const st = stats(p);
  p.hp = Math.min(p.hp, st.mhp);
  p.mp = Math.min(p.mp, st.mmp);
  p.dirty = true;
  S.maps[p.map].who = true;
}

