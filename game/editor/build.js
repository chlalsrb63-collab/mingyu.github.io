/**
 * The 빌드·테스트 tab: POST /api/check (problems list, click → map), POST /api/build?stream=1
 * (log streamed as it runs), POST /api/playtest (start the local game, open it).
 */
import { $, el, api, toast } from "./ui.js";

let goMap = async () => {}, busy = false;
const log = (s, clear) => { const p = $("#b-log"); if (clear) p.textContent = ""; p.textContent += s; p.scrollTop = p.scrollHeight; };
const setBusy = (b, what) => { busy = b; for (const id of ["#b-check", "#b-build", "#b-play"]) $(id).disabled = b; $("#b-status").textContent = b ? what : ""; };

export async function check() {
  if (busy) return;
  setBusy(true, "검사하는 중…");
  try {
    const r = await api("/api/check", { method: "POST" });
    show(r);
    log(`검사: 오류 ${r.errors.length}개, 주의 ${r.warnings.length}개\n`, true);
    for (const e of r.errors) log(`✗ ${e.file} ${e.path || ""}: ${e.msg}\n`);
    for (const w of r.warnings) log(`△ ${w.file} ${w.path || ""}: ${w.msg}\n`);
    toast(r.ok ? "검사 통과!" : `오류 ${r.errors.length}개가 있어요`, r.ok ? "ok" : "bad");
    return r;
  } catch (e) { toast(e.message, "bad"); } finally { setBusy(false); }
}
function show(r) {
  const ul = $("#b-problems");
  ul.textContent = "";
  const b = $("#b-count");
  b.textContent = r.errors.length ? `오류 ${r.errors.length}` : r.warnings.length ? `주의 ${r.warnings.length}` : "좋아요";
  b.className = "badge " + (r.errors.length ? "bad" : r.warnings.length ? "mid" : "ok");
  if (!r.errors.length && !r.warnings.length) ul.append(el("li.okline", null, "문제 없어요!"));
  const item = (p, cls) => {
    const m = /^maps\/([a-z0-9_]+)\.json$/.exec(p.file || "");
    const map = m ? m[1] : p.map || null;
    ul.append(el("li." + cls, { title: map ? "눌러서 맵에서 보기" : p.file, onclick: () => { if (map) goMap(map, p.x != null ? { x: p.x, y: p.y } : null); } }, `${p.msg}`, el("span.id", null, p.file || "")));
  };
  r.errors.forEach((p) => item(p, "err"));
  r.warnings.forEach((p) => item(p, "warn"));
}
export async function build() {
  if (busy) return;
  setBusy(true, "빌드하는 중… (몇 초~1분)");
  log("", true);
  try {
    const res = await fetch("/api/build?stream=1", { method: "POST" });
    const rd = res.body.getReader(), dec = new TextDecoder();
    let all = "";
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      const s = dec.decode(value, { stream: true });
      all += s;
      const cut = s.indexOf("__RESULT__");
      log(cut >= 0 ? s.slice(0, cut) : s);
    }
    const i = all.lastIndexOf("__RESULT__");
    const r = i >= 0 ? JSON.parse(all.slice(i + 10)) : { ok: false };
    toast(r.ok ? "빌드 성공! 게임에 반영됐어요." : "빌드 실패 — 기록을 보세요.", r.ok ? "ok" : "bad");
    if (!r.ok) check();
  } catch (e) { toast("빌드 중 연결이 끊겼어요: " + e.message, "bad"); } finally { setBusy(false); }
}
export async function play(map = "town", x, y) {
  if (busy) return;
  setBusy(true, "게임을 켜는 중… (처음엔 30초쯤)");
  const win = window.open("about:blank", "_blank");
  if (win) win.document.write("<body style='background:#120f18;color:#f3e8cc;font:16px sans-serif;padding:40px'>게임을 준비하고 있어요…</body>");
  try {
    const r = await api("/api/playtest", { method: "POST", body: { map, x, y } });
    if (win) win.location.href = r.url; else window.open(r.url, "_blank");
    log(`게임: ${r.url}\n`);
    toast("새 탭에서 게임이 열려요.", "ok");
  } catch (e) {
    if (win) win.close();
    toast(e.message, "bad");
    if (e.data && e.data.log) log(e.data.log, true);
  } finally { setBusy(false); }
}
export function init(opts) {
  goMap = opts.goMap;
  $("#b-check").onclick = check;
  $("#b-build").onclick = build;
  $("#b-play").onclick = () => play();
  $("#b-wlog").onclick = async () => { try { const r = await api("/api/playtest/log"); log(`── 게임 서버 (${r.running ? "켜짐" : "꺼짐"}) ──\n${r.log || "(기록 없음)"}\n`, true); } catch (e) { toast(e.message, "bad"); } };
}
