import { $, G, el } from "./state.js";
import { act } from "./net.js";
import { addChat } from "./windows.js";
import { Sound } from "./audio.js";

const GREETING = "지금 어디야? 혹시 같이 갈래?";
let contact = null, refreshAt = 0, availableAt = 0;

export function setup() {
  $("#buddy-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const m = $("#buddy-message").value.trim();
    if (m) act({ t: "buddy", k: ev.submitter?.value || "call", m });
  });
  $("#buddy-leave").addEventListener("click", () => act({ t: "buddy", k: "leave" }));
  render(0);
}

export function reset() {
  contact = null; refreshAt = 0; availableAt = 0;
  $("#buddy-message").value = GREETING;
  $("#buddy-messages").replaceChildren();
  render(0);
}

function render(t) {
  const [name, job, lv, active, , busy] = contact || [];
  const grouped = G.party.some(([eid]) => eid !== G.you);
  const canSend = !!G.playing && !grouped && !G.me.dead && !G.map?.id.startsWith("dim:") && !G.ab;
  $("#buddy-name").textContent = name || "짝꿍에게 연락하기";
  const detail = name ? `Lv.${lv} · ${G.defs?.classes?.[job]?.name || ""} · ` : "";
  $("#buddy-status").textContent = detail + (grouped ? "파티 중" : busy ? "답장 기다리는 중…" : active ? "곁에 있어요" : name ? "연락할 수 있어요" : "메시지를 보내면 모험을 함께할 짝꿍이 찾아와요.");
  $("#buddy-leave").hidden = !active || !!busy;
  $("#buddy-leave").disabled = !canSend;
  $("#buddy-message").disabled = !canSend || !!busy;
  $("#buddy-send").disabled = !canSend || !!active || !!busy;
  const seconds = Math.max(0, Math.ceil((availableAt - t) / 1000));
  $("#buddy-new").hidden = !name || !!busy || seconds > 0;
  $("#buddy-new").disabled = !canSend;
  $("#buddy-cooldown").textContent = grouped ? "다른 유저와 파티 중에는 짝꿍을 부를 수 없어요."
    : !canSend && G.playing ? "현재 활동을 마친 뒤 연락할 수 있어요."
    : !name ? "짝꿍 한 명이 산책·사냥·협동 알바에 동행해요."
      : seconds ? `새 짝꿍까지 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} · 같은 짝꿍은 다시 부를 수 있어요.` : "";
}

function line(side, msg, name) {
  const log = $("#buddy-messages"), row = el("div", "buddy-line " + side);
  row.append(el("small", "", name), el("p", "", msg));
  log.append(row);
  while (log.childElementCount > 24) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}

export function onSnap(s, t) {
  if (s.self) {
    contact = s.self.buddy || null;
    availableAt = t + (contact?.[4] || 0);
  }
  if (s.bm) {
    const [from, msg] = s.bm;
    if (from === 2) line("system", msg, "안내");
    else line(from ? "incoming" : "outgoing", msg, from ? contact?.[0] || "짝꿍" : "나");
    if (from === 1) Sound.play("buddy_msg");
  }
  if (s.bs) {
    const [eid, msg] = s.bs;
    G.bubbles.set(eid, { text: msg, t0: t, until: t + 6500 });
    addChat(msg, "", `[짝꿍] ${contact?.[0] || "짝꿍"}`);
    line("incoming", msg, contact?.[0] || "짝꿍");
  }
  if (s.self || s.bm || s.map || (!$("#w-buddy").hidden && t >= refreshAt)) {
    render(t);
    refreshAt = t + 1000;
  }
}
