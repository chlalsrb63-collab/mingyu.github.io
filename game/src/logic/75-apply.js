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

export function applyAction(S, pid, a) {
  const p = S.players[pid];
  const ch = p.ch;
  const now = S.now;
  const m = mapOfS(p.S, p.map);
  switch (a.t) {
    case "buddy": buddyApply(S, p, a); break;
    case "mingyutest": devTestApply(S, p, a); break;
    case "nw": p.npcWhereAt = now + 5000; p.npcWhere = true; break;
    case "mv": {
      if (p.dance || p.ab || elementFrozen(S, p)) { p.fix = true; p.mvAt = now; break; }
      const dt = clamp(now - p.mvAt, 0, 600);
      p.mvAt = now;
      const max = (stats(p).spd * dt) / 1000 * 1.6 + 8;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d > max || !canStand(m, a.x, a.y)) { p.fix = true; break; }
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
      break;
    }
    case "atk": if (validAim(a.a)) setAim(p, a.a); basicAttack(S, p); break;
    case "sk": if (validAim(a.a)) setAim(p, a.a); castSkill(S, p, a.id); break;
    case "skr": holdGo(S, p); break;
    case "dash": dashGo(S, p, m, a.a); break;
    case "use": {
      if (a.id === SOCK_ITEM) { socketApply(S, p, a.k); break; }
      if (lifeUse(a.id)) { lifeUseApply(S, p, a); break; }
      const it = ITEMS[a.id];
      const st = stats(p);
      if (it.type === "scroll") {
        rouse(S, p);
        const rms = Math.round(pfxNum(p, "recall", RECALL_MS));   // (a prefix power may shorten the cast)
        p.recall = { at: now + rms };
        S.maps[p.map].ev.push(["rc", p.eid, rms]);
        toast(p, "귀환 주문서를 읽는 중… (움직이거나 피해를 입으면 취소)");
        p.dirty = true;
        break;
      }
      if (it.type === "pet") {
        // the same pet again sends it home; another takes its place
        ch.pet = ch.pet === a.id ? "" : a.id;
        S.maps[p.map].who = true;
        if (ch.pet) S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, ch.pet ? `${it.name}${pp(it.name, "이가")} 곁을 따라다닙니다. 내 전리품을 주워 옵니다.` : `${it.name}${pp(it.name, "을를")} 돌려보냈습니다.`);
        p.dirty = true;
        break;
      }
      takeItem(ch, a.id, 1);
      if (it.type === "buff") {
        // the same scroll never stacks with itself: reading it again refills its time
        const had = ch.scr[it.buff] > now;
        ch.scr[it.buff] = now + it.min * 60000;
        S.maps[p.map].ev.push(["u", p.eid, 2]);
        toast(p, had ? `${it.name} — 남은 시간을 다시 채웠습니다 (10분).` : `${it.name}${pp(it.name, "을를")} 읽었습니다. ${it.desc.split(".")[0]}.`);
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
      break;
    }
    case "eq": {
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
      break;
    }
    case "uneq": {
      const was = inHand(ch);
      ch.inv.push(ch.eq[a.k]);
      ch.eq[a.k] = null;
      if (a.k === "weapon") p.hammer = null;
      if (inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
      break;
    }
    case "rune": {
      const g = ch.eq[a.k];
      const slot = ch.inv[a.s];
      if (--slot.n === 0) ch.inv.splice(a.s, 1);
      while (g.ru.length < g.sk) g.ru.push(null);
      g.ru[a.i] = [slot.id, runeIl(slot.il)];
      const name = RUNES[slot.id].name;
      toast(p, `[${name}]${pp(name, "을를")} 끼웠습니다.`);
      S.maps[p.map].ev.push(["e", p.eid, 1]);
      afterGear(S, p);
      break;
    }
    case "socket": socketApply(S, p, a.k); break;
    case "train": {
      // one point = one level: the stats rise, a full heal as of old, the news at every fifty
      const cost = batchCost(ch, a.a), from = ch.lvl;
      ch.xp -= cost;
      ch.xpt += cost;
      ST_ORDER.forEach((k, i) => { ch.st[k] += a.a[i]; });
      ch.lvl = levelOf(ch.st);
      p.stc = null;
      const st = stats(p);
      p.hp = st.mhp; p.mp = st.mmp;
      p.gain.push(["lvl", ch.lvl]);
      S.maps[p.map].ev.push(["l", p.eid]);
      S.maps[p.map].who = true;
      toast(p, `레벨 ${ch.lvl}! ${STATS.filter((_, i) => a.a[i]).map((s) => `${s[1]} +${a.a[ST_ORDER.indexOf(s[0])]}`).join(" · ")}`);
      for (let l = from + 1; l <= ch.lvl; l++) if (l % 50 === 0) sys(S, `${ch.name}님이 레벨 ${l}${pp(l, "을를")} 달성했습니다!`);
      tutStep(S, p, "level");
      checkAch(S, p);
      p.dirty = true;
      break;
    }
    case "wh": {
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
      const id = resolveItem(a.id, ch);
      const n = a.n | 0;
      ch.gold -= buyCost(p, a.id, id, n);
      addItem(ch, id, n);
      foundItem(S, p, id, n);
      if (ITEMS[id].type === "pot") tutStep(S, p, "buy");
      p.dirty = true;
      break;
    }
    case "sell": {
      const n = a.n | 0;
      if (typeof a.pid === "string") {
        // from the 재료 주머니
        const each = sellPrice({ id: a.pid });
        pouchTake(ch, a.pid, n);
        ch.gold += each * n;
        p.gain.push(["gold", each * n]);
        p.dirty = true;
        break;
      }
      if (a.junk !== undefined) {
        let gold = 0, cnt = 0;
        for (const i of junkSlots(ch, a.junk)) { gold += sellPrice(ch.inv[i]); ch.inv.splice(i, 1); cnt++; }
        ch.gold += gold;
        p.gain.push(["gold", gold]);
        toast(p, `장비 ${cnt}개를 ${gStr(gold)}G에 팔았습니다.`);
        petCheck(S, p);
        p.dirty = true;
        break;
      }
      const s = ch.inv[a.s];
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
      S.maps[p.map].ev.push(["e", p.eid, win ? 1 : 0]);
      afterGear(S, p);
      break;
    }
    case "uncurse": {
      const g = ch.eq[a.k];
      takeItem(ch, "uncurse", 1);
      ch.gold -= UNCURSE_FEE * ITEMS[g.id].tier;
      g.cu = 2;
      toast(p, `${gearFull(g)}의 저주가 풀렸습니다 — 다음 강화는 성공 확률 +${ENH_UNCURSE}%p`);
      afterGear(S, p);
      break;
    }
    case "sit":
      if (p.sit) p.sit = false;
      else { rouse(S, p); sitDown(S, p); fieldFire(S, p, now); }
      break;
    case "fish": {
      rouse(S, p);
      const [wx, wy] = waterNear(m, p);
      // a practised angler gets bites sooner (life skills: −0.8 % a 낚시 level)
      p.fish = { at: now + fishWait(S, ch, lifeBuff(S, p, "bite")) * (S.maps[p.map].wx === WX.rain ? WX_FISH : 1), bite: 0 };
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
      if (score < fishKeep(ch)) { toast(p, "물고기가 줄을 끊고 달아났습니다."); break; }
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
      break;
    }
    case "cook": {
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
      break;
    }
    case "salv": {
      const s = ch.inv[a.s];
      ch.inv.splice(a.s, 1);
      // better pieces break down into more stones; enhancement gives some back
      const n = [rnd(S) < 0.35 ? 1 : 0, 1, 2, 5, 5, 8][s.q | 0] + Math.floor((s.enh | 0) / 2);
      if (n > 0) { addItem(ch, "stone", n); p.gain.push(["item", "stone", n, 0]); }
      toast(p, n > 0 ? `${gearName(s)} 분해 — 강화석 ${n}개` : `${gearName(s)} 분해 — 건진 것이 없습니다`);
      p.dirty = true;
      break;
    }
    case "bq": {
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
      break;
    }
    case "sq": sqApply(S, p, a); break;
    case "quest": {
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
      // inside a 레이드던전: up again in its start room, at no cost (64-dim.js)
      if (dimRespawn(S, p)) break;
      const lost = deathLoss(ch, p);
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
      S.chat.push(chatLine(ch, text, a));
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
      for (const o of members(S, p)) {
        buddyReturnForParty(S, o);
        toast(o, o === p ? "파티에 참가했습니다." : `${ch.name}님이 파티에 참가했습니다.`);
        S.maps[o.map].who = true;
      }
      break;
    }
    case "pdec": p.pinv = null; break;
    case "gcreate":
      ch.gold -= GUILD_COST;
      ch.guild = a.name; ch.gm = 1;
      sys(S, `${ch.name}님이 길드 [${a.name}]${pp(a.name, "을를")} 세웠습니다!`);
      ch.cnt.gfound = 1;
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
        if (o.ch.guild === ch.guild) { toast(o, o === p ? `길드 [${ch.guild}]에 가입했습니다.` : `${ch.name}님이 길드 [${ch.guild}]에 들어왔습니다.`); o.dirty = true; }
      }
      checkAch(S, p);
      S.maps[p.map].who = true;
      break;
    }
    case "gdec": p.ginv = null; break;
    case "glist": p.dirty = true; break;
    case "gleave":
      toast(p, `길드 [${ch.guild}]${pp(ch.guild, "을를")} 떠났습니다.`);
      ch.guild = ""; ch.gm = 0;
      S.maps[p.map].who = true;
      p.dirty = true;
      break;
    case "gchat":
      p.chatAt = now;
      S.chat.push(chatLine(ch, a.m.trim().slice(0, 80), a, { g: ch.guild }));
      break;
    case "pchat":
      p.chatAt = now;
      S.chat.push(chatLine(ch, a.m.trim().slice(0, 80), a, { pt: p.party }));
      break;
    case "qs":
      if (a.j !== undefined) [ch.qs[a.i], ch.qs[a.j]] = [ch.qs[a.j], ch.qs[a.i]];
      else ch.qs[a.i] = a.v ? a.v.slice() : null;
      p.dirty = true;
      break;
    case "sort": {
      // by kind, then the better piece first, then the higher level; stacks of the same thing merge (46-bag.js)
      ch.inv = sortSlots(ch.inv);
      p.dirty = true;
      break;
    }
    case "jam":
      // a song on the lute or a raised cup, for everyone around to hear
      p.emoAt = now;
      S.maps[p.map].ev.push(["j", p.eid, a.k]);
      break;
    case "emo":
      p.emoAt = now;
      S.maps[p.map].ev.push(["o", p.eid, a.i]);
      break;
    case "title":
      ch.title = a.id || "";
      p.stc = null;
      S.maps[p.map].who = true;
      toast(p, ch.title ? `칭호 「${titleOf(ch)}」${pp(titleOf(ch), "을를")} 달았습니다.` : "칭호를 떼었습니다.");
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
      if (c.src === "token") ch.cos.tokens -= c.price;
      else ch.gold -= c.price;
      ch.cos.own.push(a.id);
      // bought to be worn: put it on straight away
      ch.cos.on[c.slot] = a.id;
      S.maps[p.map].who = true;
      toast(p, `[${c.name}]${pp(c.name, "을를")} 샀습니다. 캐릭터 창 ‘외형’ 탭에서 갈아입을 수 있습니다.`);
      p.dirty = true;
      break;
    }
    case "cos_dye": {
      const c = COSMETICS[a.id];
      if (a.d) { takeItem(ch, COS_DYES[a.d - 1], 1); ch.cosDye[a.id] = a.d; }
      else delete ch.cosDye[a.id];
      if (ch.cos.on[c.slot] === a.id) S.maps[p.map].who = true;
      toast(p, a.d ? `[${c.name}]${pp(c.name, "을를")} ${ITEMS[COS_DYES[a.d - 1]].name}${pp(ITEMS[COS_DYES[a.d - 1]].name, "으로")} 물들였습니다.` : `[${c.name}]${pp(c.name, "을를")} 원래 색으로 되돌렸습니다.`);
      p.dirty = true;
      break;
    }
    case "cos_sew":
      giveCos(S, p, KEEP_SEW[a.k], `루루가 [${ITEMS[a.k].name}]${pp(ITEMS[a.k].name, "으로")} 지어 주었습니다`);
      break;
    case "daily": {
      const dl = ch.daily;
      if (a.i === "party" || a.i === "solo") {
        dl.tasks[0] = a.i === "party"
          ? { kind: "party", k: null, n: 0, need: DAILY_PARTY_KILLS }
          : rollDaily(ch, dl.day).tasks[0];
        p.dirty = true;
        break;
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
      break;
    }
    case "tut": {
      // the first talk with 엘더윈 also takes on the first main quest: no button to miss
      if (a.s === "talk" && ch.q.i === 0 && ch.q.st === 0 && QUESTS[0]) {
        ch.q.st = 1; ch.q.n = 0;
        toast(p, `의뢰 수락: ${QUESTS[0].title}`);
        p.dirty = true;
      }
      tutStep(S, p, a.s);
      break;
    }
    case "warp": {
      const denied = airshipAccess(ch, a.to);
      if (denied) { toast(p, denied); break; }
      const minLv = mapLevelNeed(ch, a.to);
      if (minLv) { toast(p, mapLevelMessage(minLv)); break; }
      const i = a.i || 0, w = stonesOf(mapOf(a.to))[i] || wpOf(a.to);
      S.maps[p.map].ev.push(["wp", p.eid, 0]);
      // to another stone of the same ground: a step, not a journey (the map is not sent again)
      if (a.to === p.map) { dropAggro(S, p); p.x = w.ax * T + 8; p.y = w.ay * T + 10; p.fix = true; }
      else changeMap(S, p, a.to, w.ax * T + 8, w.ay * T + 10);
      S.maps[a.to].ev.push(["wp", p.eid, 1]);
      toast(p, `[${stoneName(a.to, i)}]의 이동의 돌로 건너왔습니다.`);
      p.dirty = true;
      break;
    }
    case "pleave":
      leaveParty(S, p);
      toast(p, "파티를 떠났습니다.");
      break;
    // ── 레이드던전 (64-dim.js)
    case "dim_open": case "dim_ready": case "dim_cancel": case "dim_leave": case "dim_join": dimApply(S, p, a); break;
    // ── the bag's size and housing (46-bag.js, 64-housing.js)
    case "bag_expand": bagApply(S, p, a); break;
    case "house_buy": case "house_upgrade": case "house_style": case "house_visit": case "house_leave":
    case "furn_buy": case "furn_place": case "furn_rot": case "furn_pick": case "h_dep": case "h_wd": case "h_sort": case "h_rest": homeApply(S, p, a); break;
    // ── jobs and stats (45-jobs.js)
    case "respec": {
      const fee = statResetCost(ch);
      if (fee) {
        ch.gold -= fee;
        takeItem(ch, RESPEC_ITEM, 1);
      } else ch.rs--;
      ch.xp = Math.min(2e9, ch.xp + ch.xpt);
      ch.xpt = 0;
      ch.st = freshSt();
      ch.lvl = 1;
      if (mapLevelNeed(ch, p.map)) changeMap(S, p, START.map, START.x, START.y);
      afterGear(S, p);
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `망각의 의식 — 능력치를 모두 되돌렸습니다.${fee ? ` (되새김 인장 1개 · ${fee.toLocaleString()}G)` : " (무료)"}`);
      break;
    }
    case "starter": {
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
      break;
    }
    case "job_change": {
      const job = JOBS[a.j], back = ch.jobs[a.j];
      if (!back) ch.gold -= job.cost;
      ch.job = a.j;
      // a job walked before resumes where it was left (47-job-freedom.js)
      ch.jp = ch.jobs[a.j] = back || { lv: 1, xp: 0 };
      afterGear(S, p);
      S.maps[p.map].ev.push(["jc", p.eid]);
      sys(S, `${ch.name}님이 [${job.name}]의 길을 걷기 시작했습니다!`);
      toast(p, job.kind === "hybrid" ? `[${job.name}] 전직! 두 무기를 Ⅰ/Ⅱ에 하나씩 장착하고 Tab으로 바꿔 듭니다.` : `[${job.name}] 전직!`);
      // the job's signature skill onto the bar
      const signature = SKILL[JOB_SKILL[a.j]];
      if (back) toast(p, `[${job.name}] 직업 Lv.${back.lv}부터 이어서 걷습니다.`);
      else if (signature) toast(p, `직업 Lv.${signature.jobNeed}에 [${signature.name}]${pp(signature.name, "을를")} 배웁니다.`);
      checkAch(S, p);
      break;
    }
    // life skills L2 (58-life.js): gathering, the stations, the 알바 board
    case "gat": case "gat_tap": case "craft_open": case "craft": case "jb": lifeApply(S, p, a); break;
    // 차단, 귓속말, 주간 수첩 (63-social-weekly.js)
    case "blk": case "w": case "wk": socialApply(S, p, a); break;
    case "job_reset": case "lv_reset": case "lo": jfApply(S, p, a); break;
    case "ske": skeApply(S, p, a); break;
    case "wsw": {
      // a hybrid's swap keeps both weapons' gauges; only a dance in progress stops. Anyone else: as a re-equip.
      const was = inHand(ch);
      [ch.eq.weapon, ch.eq.weapon2] = [ch.eq.weapon2, ch.eq.weapon];
      p.wswAt = S.now + WSW_MS;
      p.dance = null;
      if (!isHybrid(ch) && inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
      S.maps[p.map].ev.push(["ws", p.eid]);
      break;
    }
    // charms (66-charms.js)
    case "charm_quest": case "charm_id": case "charm_place": case "charm_move": case "charm_remove": case "charm_expand": case "charm_claim": case "charm_destroy": charmApply(S, p, a); break;
    // 협동 아르바이트 (68-coop.js)
    case "coop_start": case "coop_act": case "coop_leave": coopApply(S, p, a); break;
    case "ab_start": case "ab_act": case "ab_leave": case "ab_close": albaApply(S, p, a); break;
    case "fair_buy": fairApply(S, p, a); break;
    case "fair_open": case "fair_shop": fairMktApply(S, p, a); break;
    // player to player: requests, trade, mini-games (69-social-play.js)
    case "sx": sxApply(S, p, a); break;
  }
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

