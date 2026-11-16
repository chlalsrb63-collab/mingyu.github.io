// 일일 아르바이트 UI smoke test: runs INSIDE the live game page (nothing in tests/ touches public/alba*.js).
// It goes the way a player does: opens the 알바 window, presses each game's [시작], looks at the board, gives up with the
// two-press 그만두기, and finally drops the socket to see the window say so and leave on the reconnect. Needs a dev server (npm run dev:local, or a
// preview on another port); results are printed as "page problems" lines starting with SMOKE.
//   node scripts/shot.mjs --live --url http://localhost:8823 --size 1366x768 --out shots/smoke.png --eval "$(cat scripts/alba-smoke.js)"
// "SMOKE ok ..." lines are fine; any "SMOKE FAIL" line (or a page error above it) is a bug.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [], fail = (m) => out.push("SMOKE FAIL " + m);
  const until = async (f, ms = 8000) => { const t = performance.now(); while (performance.now() - t < ms) { try { if (f()) return true; } catch { /* not yet */ } await sleep(80); } return false; };
  const modal = () => document.querySelector("#alba-play");
  const shown = () => { const m = modal(); return !!m && !m.hidden; };
  const D = __game.G.defs.alba;
  let acc = 0, n = 0, on = false;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => raf((t) => { const a = performance.now(); f(t); if (on) { acc += performance.now() - a; n++; } });

  // 1. the list window
  __game.openWin("alba");
  if (!(await until(() => document.querySelectorAll("#alba-body .jb-card").length === D.order.length))) fail(`the list shows ${document.querySelectorAll("#alba-body .jb-card").length} cards, not ${D.order.length}`);
  else out.push(`SMOKE ok list: ${D.order.length} cards · ${document.querySelectorAll("#alba-body .section").length} sections · hint "${(document.querySelector("#alba-body .hint") || {}).textContent}"`);

  // 2. every game through the real buttons
  for (let i = 0; i < D.order.length; i++) {
    const k = D.order[i];
    const btn = document.querySelectorAll("#alba-body .jb-card")[i]?.querySelector("button");
    if (!btn || btn.disabled) { fail(`${k}: no usable [시작] button`); continue; }
    btn.click();
    if (!(await until(() => shown() && modal().querySelector(".ap-host > *")))) { fail(`${k}: the window did not open`); __game.act({ t: "ab_leave" }); await sleep(600); continue; }
    await sleep(500);
    const r = (s) => { const e = modal().querySelector(s); if (!e) return "-"; const b = e.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; };
    const cv = [...modal().querySelectorAll(".ap-host canvas")].map((c) => { const b = c.getBoundingClientRect(); return `${c.width}x${c.height}->${Math.round(b.width)}x${Math.round(b.height)}`; });
    acc = 0; n = 0; on = true; await sleep(1200); on = false;
    out.push(`SMOKE ok ${k}: box ${r(".ap-box")} board ${r(".ap-board")} canvases [${cv.join(" ")}] frame ${n ? (acc / n).toFixed(2) : "?"} ms`);
    const quit = modal().querySelector(".ap-head button");
    quit.click();
    if (!/정말/.test(quit.textContent)) fail(`${k}: the first press on 그만두기 did not ask again (${quit.textContent})`);
    quit.click();
    if (!(await until(() => !shown()))) fail(`${k}: the second press did not end the shift`);
    await sleep(500);
  }

  // 3. the socket drops in a shift: the window must not stay over the lobby
  __game.openWin("alba");
  await sleep(300);
  const first = document.querySelector("#alba-body .jb-card button");
  if (first && !first.disabled) {
    first.click();
    if (await until(() => shown())) {
      __game.sock().close();   // an outage: net.js retries by itself
      const said = await until(() => modal().classList.contains("down"), 1500);
      out.push(said ? "SMOKE ok the board says the connection dropped" : "SMOKE FAIL the window did not say the connection dropped");
      out.push((await until(() => !shown(), 15000)) ? "SMOKE ok the window left once the world came back without the shift" : "SMOKE FAIL the window stayed after the reconnect");
    }
    else fail("could not start a game for the drop test");
  }
  console.error(out.join("\n"));
})()
