// ───────────────────────────── /mingyutest: the owner's local test character ─────────────────────────────
// Chat `/mingyutest [직업]` (public/windows.js chatAction) sends { t: "mingyutest", j? }. Local build only: room.ts
// sets S.dev from the PLAYTEST env var (wrangler.local.jsonc), the same gate as the editor's devPlace.
// It makes the current character Lv.200 (stats laid out by the hand's BUILD), every weapon mastery 50, every job
// walked to job Lv.50 (so each job's skills are learned and job_change back to any of them is free), every
// waypoint stone woken, a top-tier weapon of each kind in the bag, and full HP/MP. With `j` (a job id or its
// Korean name) it also switches to that job on the spot, so every job's skills can be tried without the 전직관.
// No new sheet fields: it only fills ones that exist (st, xpt, wm, jobs, jp, job, wp, inv).

/** The job `j` names (id or Korean name), or "" for none / unknown. */
function devJob(j) {
  if (typeof j !== "string" || !j) return "";
  if (Object.hasOwn(JOBS, j)) return j;
  return Object.keys(JOBS).find((id) => JOBS[id].name === j) || "";
}
function devTestValidate(S, p, a) {
  if (!S.dev) return bad("테스트 명령은 로컬 빌드에서만 쓸 수 있습니다");
  if (a.j !== undefined && !devJob(a.j)) return bad("그런 직업은 없습니다");
  return OK;
}
function devTestApply(S, p, a) {
  const ch = p.ch;
  const wk = WK_ORDER.includes(inHand(ch)) ? inHand(ch) : "sword";
  const al = allocate(BUILD[wk] || BUILD.sword, MAXLV - 1);
  ch.st = al.st; ch.xpt = al.xpt; ch.lvl = levelOf(ch.st);
  for (const k of WK_ORDER) ch.wm[k] = { lv: WM_MAX, xp: 0 };
  for (const j of Object.keys(JOBS)) if (j !== "adventurer") ch.jobs[j] = { lv: JOB_PROGRESS.cap, xp: 0 };
  const j = devJob(a.j);
  if (j) ch.job = j;
  ch.jp = ch.job === "adventurer" ? null : ch.jobs[ch.job];
  for (const id of Object.keys(MAP_META)) if (hasWp(id)) ch.wp[id] = (1 << (MAP_META[id].wpn || 1)) - 1;
  // one weapon of each kind at its highest tier, unless the bag already holds one of that tier
  for (const k of WK_ORDER) {
    let n = 1;
    while (ITEMS[`w_${WK_ID[k]}_${n + 1}`]) n++;
    const id = `w_${WK_ID[k]}_${n}`;
    if (ITEMS[id] && !ch.inv.some((g) => g && g.id === id)) ch.inv.push(plain(id));
  }
  afterGear(S, p);
  p.stc = null;
  const st = stats(p);
  p.hp = st.mhp; p.mp = st.mmp;
  p.dirty = true;
  S.chat.push({ sys: 1, to: p.pid, m: `테스트 캐릭터 활성화: Lv.${ch.lvl} · 숙련도 ${WM_MAX} · 모든 직업 스킬 · 모든 이동의 돌${j ? ` · [${JOBS[j].name}] 전직` : ""} (직업 바꾸기: /mingyutest 직업이름)` });
}
