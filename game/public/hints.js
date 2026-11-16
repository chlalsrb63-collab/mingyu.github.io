/**
 * First-time hints (UX audit O2, pass 2): the first time a player meets a system — a co-op job's owner, a village
 * chore's spot, the player menu, the 알바 board, the rift obelisk — a small card says what it is in a line or two
 * and where to read more (a button opens that window). Seen per character (localStorage `lumentale:hints:<name>`);
 * the settings' [안내 다시 보기] forgets them (`resetHints`). update.js calls `meet(near, chore)` when the F prompt
 * changes; pmenu.js calls `show("pmenu")`.
 */
import { G, $, el } from "./state.js";
import { K } from "./keymap.js";
import { Sound } from "./audio.js";
import { openWin } from "./windows.js";

// key → [title, what it is, the window that tells more]
const HINTS = {
  coop: ["협동 아르바이트", () => "파티와 함께 하는 가게 일이에요. 주인 곁의 카드에서 [근무 시작] — 파티원도 함께 들어가고, 점수 등급(C~S)에 따라 보수가 올라요.", "alba"],
  board: ["알바 중개소", () => "게시판에서 하루 몇 번 짧은 일을 맡아 골드와 주민의 신뢰를 벌어요. 배달은 정해진 시간 안에 전해야 해요.", "alba"],
  chore: ["마을 일거리", () => `반짝이는 자리마다 ${K("interact")} 로 일을 해요. 다 마치면 의뢰 추적 칸이 다음에 갈 곳을 알려 줘요.`, "alba"],
  pmenu: ["다른 모험가", () => "이 메뉴로 파티 초대 · 거래 · 친구 추가 · 귓속말 · 따라가기를 해요. 거래는 두 사람 모두 [확정]한 뒤 [교환]해야 끝나요.", "party"],
  dim: ["레이드던전", () => "균열 지기에게 말을 걸어 파티가 함께 들어가는 레이드던전을 열어요. 마을에 있는 파티원에게는 준비 확인 창이 떠요.", ""],
};
const MORE = { alba: () => `아르바이트 창 (${K("alba")})`, party: () => `파티 창 (${K("party")})` };
const KEY = () => `lumentale:hints:${G.self ? G.self.name : ""}`;
function seen() { try { const v = JSON.parse(localStorage.getItem(KEY()) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }

let tm = 0;
function hide() { const c = $("#hint"); if (c) c.hidden = true; clearTimeout(tm); }
/** Show hint `k` unless this character has seen it (it counts as seen once shown). */
export function show(k) {
  const h = HINTS[k], was = seen();
  if (!h || !G.self || was.includes(k)) return;
  try { localStorage.setItem(KEY(), JSON.stringify([...was, k])); } catch { /* private mode: shown again next time */ }
  let c = $("#hint");
  if (!c) { c = el("div", "frame"); c.id = "hint"; $("#hud").append(c); }
  c.textContent = "";
  const x = el("button", "x"); x.type = "button"; x.title = "닫기";
  x.addEventListener("click", () => { hide(); Sound.play("close"); });
  const hd = el("div", "hint-hd"); hd.append(el("span", "hint-tag", "처음이에요"), el("b", "", h[0]), x);
  c.append(hd, el("p", "", h[1]()));
  const row = el("div", "btns");
  if (h[2]) {
    row.append(el("span", "more", `자세히: ${MORE[h[2]]()}`));
    const b = el("button", "btn small", "열어 보기"); b.type = "button";
    b.addEventListener("click", () => { hide(); openWin(h[2]); Sound.play("open"); });
    row.append(b);
  }
  const ok = el("button", "btn small gold", "알겠어요"); ok.type = "button";
  ok.addEventListener("click", () => { hide(); Sound.play("ui"); });
  row.append(ok);
  c.append(row);
  c.hidden = false;
  Sound.play("announce");
  clearTimeout(tm); tm = setTimeout(hide, 30000);
}
/** The F prompt changed: the NPC (or chore spot) now in reach. */
export function meet(n, chore) {
  if (chore) show("chore");
  if (!n) return;
  if (n.role === "jobs") show("board");
  else if (n.role === "dim") show("dim");
  else if (Object.values(G.defs.coop?.jobs || {}).some((j) => j[4] === n.id)) show("coop");
}
/** Settings [안내 다시 보기]: every hint shows again (this character). */
export function resetHints() { try { localStorage.removeItem(KEY()); } catch { /* private mode */ } hide(); }
