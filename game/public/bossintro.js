/**
 * A boss fight's opening (설정 → 화면 → 보스 연출, owner 2026-11-21): the first time a boss comes within its aggro reach,
 * letterbox bars slide in, the camera eases in on it and a red WARNING shows its name and, under it, its epithet
 * ("- 절망의 친칠라 -"). About three seconds; the fight itself does not wait (the server never pauses).
 * Each boss spawn plays once (its mob id). overlay.js asks `active()` / `tick()` for the camera like talkcam.js.
 */
import * as S3 from "./scene2d.js";
import { G, el } from "./state.js";
import { Sound } from "./audio.js";

const IN = 450, HOLD = 2700, OUT = 500, ZOOM = 0.8;
const seen = new Set();
let run = null, box = null;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (x) => x * x * (3 - 2 * x);

/** The line under the name: the epithet without the name it often ends in ("절망의 친칠라 재매이" → "절망의 친칠라"). */
export function subtitle(d) {
  const e = (d.epithet || "").trim();
  return (e.endsWith(d.name) ? e.slice(0, -d.name.length) : e).trim();
}

function show(d) {
  if (!box) { box = el("div"); box.id = "boss-intro"; document.body.append(box); }
  const sub = subtitle(d);
  box.replaceChildren(el("div", "bi-warn", "WARNING"), el("div", "bi-name", d.name), ...(sub ? [el("div", "bi-sub", `- ${sub} -`)] : []));
}

/** Once a frame: start an opening when a boss first comes near. */
function check(t) {
  if (run || !G.bossFx || !G.me || G.me.dead || !G.map) return;
  for (const [id, m] of G.mobs) {
    const d = G.defs.mobs[m.k];
    if (!d?.boss || seen.has(id)) continue;
    if (Math.hypot(m.x - G.me.x, m.y - G.me.y) > (d.aggro || 130)) continue;
    seen.add(id);
    run = { id, d, at: t, map: G.map.id, x: m.x, y: m.y };
    show(d);
    document.body.classList.add("bossintro");
    Sound.play("boss_enrage");
    return;
  }
}

/** Is an opening playing (it then owns the camera)? */
export function active(t) {
  check(t);
  if (run && (t - run.at > IN + HOLD + OUT || G.map?.id !== run.map || !G.me)) { stop(); }
  return !!run;
}

function stop() {
  run = null;
  document.body.classList.remove("bossintro");
  S3.setZoomMul(1);
}

/** The camera's point and zoom while it plays. */
export function tick(_dt, t) {
  const e = t - run.at, me = G.me;
  if (e > IN + HOLD) document.body.classList.remove("bossintro");   // the bars and the title leave while the camera eases back
  const k = calm() ? 0 : ease(Math.max(0, Math.min(1, e < IN ? e / IN : e < IN + HOLD ? 1 : 1 - (e - IN - HOLD) / OUT)));
  const m = G.mobs.get(run.id);
  if (m) { run.x = m.x; run.y = m.y; }
  S3.setZoomMul(1 + ZOOM * k);
  return [me.x + (run.x - me.x) * k, me.y + (run.y - me.y) * k];
}
