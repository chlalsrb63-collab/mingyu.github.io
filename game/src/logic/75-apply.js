export function applyAction(S, pid, a) {
  const p = S.players[pid];
  const ch = p.ch;
  const now = S.now;
  const m = mapOfS(p.S, p.map);
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
      if (validAim(a.a)) p.aim = a.a;
      // stepping anywhere on a gate tile (or brushing its edge) takes you through
      for (const pt of m.portals) {
        if (dist(p.x, p.y - 3, pt.x * T + 8, pt.y * T + 8) < 12) { const at = arrivalOf(S, pt); if (at) changeMap(S, p, pt.to, at[0] * T + 8, at[1] * T + 10); break; }
      }
      // the "내 집" door in town (64-housing.js)
      homeDoor(S, p);
      break;
    }
    case "atk": if (validAim(a.a)) setAim(p, a.a); basicAttack(S, p); break;
    case "sk": if (validAim(a.a)) setAim(p, a.a); castSkill(S, p, a.id); break;
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
        p.food = { id: a.id, until: now + it.buff.min * 60000, xp: it.buff.xp, atk: it.buff.atk };
        toast(p, `${it.name}${pp(it.name, "을를")} 먹었습니다. ${it.desc}`);
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
      const k = a.k === "weapon2" ? "weapon2" : fits.includes(a.k) ? a.k : fits.find((o) => !ch.eq[o]) || fits[0];
      const old = ch.eq[k], was = inHand(ch);
      ch.eq[k] = s;
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
      if (inHand(ch) !== was) handChanged(p);
      afterGear(S, p);
      break;
    }
    case "rune": {
      const g = ch.eq[a.k];
      const key = ITEMS[ch.inv[a.s].id].rune;
      takeItem(ch, `ru_${key}`, 1);
      while (g.ru.length < g.sk) g.ru.push(null);
      g.ru[a.i] = key;
      const rw = runeword(g);
      toast(p, rw ? `룬어 [${rw.name}] 완성!` : `${RUNES[key][0]} 룬을 끼웠습니다.`);
      if (rw) { sys(S, `${ch.name}님이 룬어 [${rw.name}]${pp(rw.name, "을를")} 완성했습니다!`); ch.cnt.rw++; checkAch(S, p); }
      S.maps[p.map].ev.push(["e", p.eid, 1]);
      afterGear(S, p);
      break;
    }
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
      const id = resolveItem(a.id, ch);
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
        toast(p, `${gearFull(g)} 강화 성공!`);
        if (g.enh >= 7) sys(S, `${ch.name}님이 ${gearFull(g)} 강화에 성공했습니다!`);
        ch.cnt.enh = Math.max(ch.cnt.enh, g.enh);
        checkAch(S, p);
      } else if (g.enh >= 5) {
        g.enh--;
        toast(p, `강화 실패... ${gearFull(g)}${pp(gearFull(g), "으로")} 단계가 내려갔습니다.`);
      } else {
        toast(p, `${gearFull(g)} 강화 실패... 장비는 무사합니다.`);
      }
      S.maps[p.map].ev.push(["e", p.eid, win ? 1 : 0]);
      afterGear(S, p);
      break;
    }
    case "sit":
      if (p.sit) p.sit = false;
      else { rouse(S, p); sitDown(S, p); }
      break;
    case "fish": {
      rouse(S, p);
      const [wx, wy] = waterNear(m, p);
      // a practised angler gets bites sooner (life skills: −0.8 % a 낚시 level)
      p.fish = { at: now + fishWait(S, ch) * (S.maps[p.map].wx === WX.rain ? WX_FISH : 1), bite: 0 };
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
      if (!burnt) { ch.cnt.cook++; dailyProg(S, p, "cook"); checkAch(S, p); }
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
      // inside a 차원 균열: up again in its start room, at no cost (64-dim.js)
      if (dimRespawn(S, p)) break;
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
        if (o.ch.guild === ch.guild) { toast(o, `${ch.name}님이 길드 [${ch.guild}]에 들어왔습니다.`); o.dirty = true; }
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
      ch.gold -= c.price;
      ch.cos.own.push(a.id);
      // bought to be worn: put it on straight away
      ch.cos.on[c.slot] = a.id;
      S.maps[p.map].who = true;
      toast(p, `[${c.name}]${pp(c.name, "을를")} 샀습니다. 캐릭터 창 ‘외형’ 탭에서 갈아입을 수 있습니다.`);
      p.dirty = true;
      break;
    }
    case "daily": {
      const dl = ch.daily;
      if (a.i === "bonus") {
        dl.bonus = true;
        ch.cnt.daily++;
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
    // ── 차원 균열 (64-dim.js)
    case "dim_open": case "dim_ready": case "dim_cancel": case "dim_leave": case "dim_join": dimApply(S, p, a); break;
    // ── the bag's size and housing (46-bag.js, 64-housing.js)
    case "bag_expand": bagApply(S, p, a); break;
    case "house_buy": case "house_upgrade": case "house_style": case "house_visit": case "house_leave":
    case "furn_buy": case "furn_place": case "furn_rot": case "furn_pick": case "h_dep": case "h_wd": case "h_sort": case "h_rest": homeApply(S, p, a); break;
    // ── jobs and stats (45-jobs.js)
    case "respec": {
      // 망각의 의식: every stat back to 5, the experience they cost back (the first reset is free)
      const fee = ch.rs > 0 ? 0 : Math.ceil(0.1 * ch.xpt);
      if (ch.rs > 0) ch.rs--;
      ch.xp = Math.min(2e9, ch.xp + ch.xpt - fee);
      ch.xpt = 0;
      ch.st = freshSt();
      ch.lvl = 1;
      afterGear(S, p);
      S.maps[p.map].ev.push(["u", p.eid, 2]);
      toast(p, `망각의 의식 — 능력치를 모두 되돌렸습니다.${fee ? ` (경험치 ${fee.toLocaleString()} 소모)` : " (무료)"}`);
      break;
    }
    case "starter": {
      const id = `w_${WK_ID[a.wk]}_1`;
      ch.sw = 1;
      ch.inv.push(plain(id));
      p.gain.push(["item", id, 1, 0]);
      toast(p, `[${ITEMS[id].name}]${pp(ITEMS[id].name, "을를")} 받았습니다. C 창에서 장착하세요.`);
      p.dirty = true;
      break;
    }
    case "job_change": {
      const job = JOBS[a.j];
      ch.gold -= job.cost;
      ch.job = a.j;
      afterGear(S, p);
      S.maps[p.map].ev.push(["jc", p.eid]);
      sys(S, `${ch.name}님이 [${job.name}]의 길을 걷기 시작했습니다!`);
      toast(p, job.kind === "hybrid" ? `[${job.name}] 전직! 보조 무기 칸이 열렸습니다 — Tab으로 두 무기를 바꿔 듭니다.` : `[${job.name}] 전직!`);
      // the job's signature skill onto the bar
      toast(p, `새 스킬 ${skLearnNew(p, [JOB_SKILL[a.j]]).join("")}`);
      checkAch(S, p);
      break;
    }
    case "wsw": {
      // a hybrid's swap keeps both weapons' gauges; only a dance in progress stops
      [ch.eq.weapon, ch.eq.weapon2] = [ch.eq.weapon2, ch.eq.weapon];
      p.wswAt = S.now + WSW_MS;
      p.dance = null;
      afterGear(S, p);
      S.maps[p.map].ev.push(["ws", p.eid]);
      break;
    }
  }
  if (SAVE_SOON.has(a.t)) saveSoon(p);
  return S;
}

/** A different kind of weapon came into hand: a dance stops; a kind never used before puts its first skill on the bar. */
function handChanged(p) {
  const ch = p.ch, wk = inHand(ch);
  p.dance = null;
  if (!wk || ch.wm[wk].lv > 1 || ch.wm[wk].xp > 0) return;
  for (const id of WK_SKILLS[wk]) if (SKILL[id].kind === "a" && SKILL[id].need <= 1) qsLearn(ch, id);
}

function afterGear(S, p) {
  p.stc = null;
  const st = stats(p);
  p.hp = Math.min(p.hp, st.mhp);
  p.mp = Math.min(p.mp, st.mmp);
  p.dirty = true;
  S.maps[p.map].who = true;
}

