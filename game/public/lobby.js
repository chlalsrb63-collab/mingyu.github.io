/**
 * Everything before the world: the title, 로그인 / 회원가입, the server and channel
 * list, and the character creation page. client.js owns the connection and the
 * game; it hands this module a few hooks (`init`) and tells it what the server
 * said (`needChar`, `welcome`, `fatal`, `createError`).
 *
 * Accounts and servers come from account.js (the HTTP side); the picture behind
 * the title is titlescene.js. One character per account per server; each server
 * has two channels, and a character can stand in only one of them at a time.
 */
import * as Account from "./account.js";
import * as TS from "./titlescene.js";
import * as S3 from "./scene2d.js";
import * as SP from "./sprites.js";
import * as SPC from "./species.js";
import * as Looks from "./looks.js";
import { Sound } from "./audio.js";
import { iconImg } from "./uiicons.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const VERSION = "v1.2";
const LAST = "tales:last";                    // the last channel played: "s1-ch2"

let C = null;
/** title · auth · servers · create · game */
let view = "title";
let pending = null;                           // { ch, why: "play" | "create" | "switch", tries }
let retryT = 0;

// ───────────────────────────── servers and channels ─────────────────────────────

const serverOf = (ch) => String(ch || "").split("-")[0];
const SERVER = (id) => Account.SERVERS.find((s) => s.id === id) || Account.SERVERS[0];
/** "1서버 · 채널 2" */
export function label(ch) {
  const sv = SERVER(serverOf(ch)), c = sv.channels.find((x) => x.id === ch);
  return `${sv.name} · ${c ? c.name : "채널 1"}`;
}
export const validChannel = (ch) => Account.SERVERS.some((s) => s.channels.some((c) => c.id === ch));
/** The channel to use on a server: the last one played there, else its first. */
function channelFor(sid) {
  const last = localStorage.getItem(LAST + ":" + sid);
  return validChannel(last) && serverOf(last) === sid ? last : SERVER(sid).channels[0].id;
}
export function lastChannel() { const l = localStorage.getItem(LAST); return validChannel(l) ? l : "s1-ch1"; }
/** The join frame for the socket. */
export function joinMsg() {
  const s = Account.session(), msg = { type: "join", token: s ? s.token : "" };
  // the map editor's playtest (?dev=1&map=willow&x=24&y=30, tiles): sent with the first join of the
  // page only; the server honours it only in local dev (wrangler.local.jsonc PLAYTEST)
  if (PLAYTEST && !playtestSent) { msg.dev = PLAYTEST; playtestSent = true; }
  return msg;
}
const PLAYTEST = (() => {
  const q = new URLSearchParams(location.search);
  return q.get("dev") === "1" && q.get("map") ? { map: q.get("map"), x: Math.max(0, parseInt(q.get("x"), 10) || 0), y: Math.max(0, parseInt(q.get("y"), 10) || 0) } : null;
})();
let playtestSent = false;

// ───────────────────────────── setup ─────────────────────────────

/**
 * ctx: { connect(ch), disconnect(), act(a), stopGame(), playing(), channel(), toast(t) }
 */
export function init(ctx) {
  C = ctx;
  TS.init($("#title-cv"));
  drawLogo();
  addEventListener("resize", () => { drawLogo(); sizeStage(); });
  $("#t-ver").textContent = `${VERSION} · © 2026 테일즈테일즈 · 그림·음악 모두 코드로 그렸습니다`;
  // press start: a click, a tap or any key
  const start = (e) => {
    if (view !== "title") return;
    if (e && e.type === "keydown" && (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab" || /^F\d+$/.test(e.key))) return;
    Sound.unlock(); Sound.play("ok");
    if (Account.session()) showServers(); else showAuth("login");
  };
  $("#t-press").addEventListener("click", start);
  $("#title-cv").addEventListener("pointerdown", (e) => { if (view === "title") { e.preventDefault(); start(e); } });
  addEventListener("keydown", (e) => {
    if (view === "title" && !$("#title").hidden && !e.metaKey && !e.ctrlKey && !e.altKey && !/^F\d+$/.test(e.key)) { e.preventDefault(); start(e); }
    else if (e.key === "Escape" && view === "auth") show("title");
  });
  wireAuth();
  wireCreate();
  $("#sv-re").addEventListener("click", () => { Sound.play("ui"); refreshServers(); });
  setInterval(() => { if (view === "servers" && !pending && !document.hidden) refreshServers(); }, 20000);
  wireSettings();
  show("title");
}

/** Show one of the lobby's screens (or none: "game"). */
function show(v, msg) {
  view = v;
  const inTitle = v === "title" || v === "auth" || v === "servers";
  $("#title").hidden = !inTitle;
  $("#create").hidden = v !== "create";
  $("#t-press").hidden = v !== "title";
  $("#t-auth").hidden = v !== "auth";
  $("#t-servers").hidden = v !== "servers";
  document.body.dataset.lobby = inTitle ? v : v === "create" ? "create" : "";
  setMsg(msg || "");
  if (v === "create") requestAnimationFrame(sizeStage);
}
function setMsg(text, kind = "err") {
  const m = $("#title-msg");
  m.textContent = text;
  m.className = text ? kind : "";
}
/** Back to the title music after the world's. */
function titleMusic() { if (Sound.base || Sound.theme) { Sound.base = null; Sound.theme = null; Sound.pick(); } }

// ───────────────────────────── the logo ─────────────────────────────

function drawLogo() {
  const box = $("#t-logo");
  const W = innerWidth, H = innerHeight, land = H < 520 && W > H;
  // as big as fits: about half the width on a desktop, nearly all of it on a phone
  const want = land ? Math.min(W * 0.44, 360) : Math.min(W * 0.92, 620, H * 0.9);
  const S = Math.max(2, Math.min(Math.floor(want / 118), Math.floor(H / 150)));
  if (box.dataset.s === String(S)) return;
  box.dataset.s = String(S);
  const src = TS.logo(S);
  box.width = src.width; box.height = src.height;
  box.getContext("2d").drawImage(src, 0, 0);
}

// ───────────────────────────── log in / sign up ─────────────────────────────

let authMode = "login";
function showAuth(mode, msg) {
  titleMusic();
  setAuthMode(mode || authMode);
  show("auth", msg);
  const s = Account.session();
  if (s && !$("#a-id").value) $("#a-id").value = s.id;
  setTimeout(() => { if (matchMedia("(pointer: fine)").matches) ($("#a-id").value ? $("#a-pw") : $("#a-id")).focus(); }, 30);
}
function setAuthMode(mode) {
  authMode = mode;
  for (const b of $$("#t-auth .t-tabs button")) b.classList.toggle("on", b.dataset.mode === mode);
  const up = mode === "signup";
  $("#a-pw2-row").hidden = !up;
  $("#a-pw").autocomplete = up ? "new-password" : "current-password";
  $("#a-submit").textContent = up ? "아이디 만들기" : "로그인";
  $("#a-legacy").hidden = !(up && localStorage.getItem(Account.LEGACY_PID));
  $("#a-title").textContent = up ? "새 아이디 만들기" : "모험가 로그인";
  for (const id of ["a-id-msg", "a-pw-msg", "a-pw2-msg"]) $("#" + id).textContent = "";
  $("#a-msg").textContent = "";
  validate(false);
}
/** Instant checks; `all` also marks fields not touched yet. Returns true when the form can go. */
function validate(all) {
  const id = $("#a-id").value, pw = $("#a-pw").value, pw2 = $("#a-pw2").value, up = authMode === "signup";
  const eId = Account.checkId(id), ePw = up ? Account.checkPw(pw) : pw ? "" : "비밀번호를 입력하세요";
  const ePw2 = up ? (pw2 ? Account.checkPw(pw, pw2) && pw !== pw2 ? "비밀번호가 서로 다릅니다" : "" : "비밀번호를 한 번 더 입력하세요") : "";
  const mark = (input, msgEl, err, okText) => {
    const touched = all || input.dataset.touched;
    msgEl.textContent = touched ? err || (up ? okText : "") : "";
    msgEl.className = "fmsg " + (touched ? (err ? "bad" : "good") : "");
    input.classList.toggle("bad", !!(touched && err));
  };
  mark($("#a-id"), $("#a-id-msg"), up ? eId : id.trim() ? "" : "아이디를 입력하세요", "사용할 수 있는 형식이에요");
  mark($("#a-pw"), $("#a-pw-msg"), ePw, "좋아요");
  if (up) mark($("#a-pw2"), $("#a-pw2-msg"), ePw2, "일치합니다");
  return up ? !eId && !ePw && !ePw2 : !!id.trim() && !!pw;
}
function wireAuth() {
  for (const b of $$("#t-auth .t-tabs button")) b.addEventListener("click", () => { Sound.play("ui"); setAuthMode(b.dataset.mode); });
  for (const id of ["a-id", "a-pw", "a-pw2"]) {
    const i = $("#" + id);
    i.addEventListener("input", () => { if (id === "a-id") { const lo = i.value.toLowerCase(); if (lo !== i.value) i.value = lo; } i.dataset.touched = i.value ? "1" : i.dataset.touched || ""; validate(false); $("#a-msg").textContent = ""; });
    i.addEventListener("blur", () => { if (i.value) { i.dataset.touched = "1"; validate(false); } });
  }
  $("#a-eye").addEventListener("click", () => {
    const show = $("#a-pw").type === "password";
    for (const id of ["a-pw", "a-pw2"]) $("#" + id).type = show ? "text" : "password";
    $("#a-eye").classList.toggle("on", show);
    $("#a-eye").title = show ? "비밀번호 숨기기" : "비밀번호 보기";
    $("#a-eye").textContent = show ? "숨기기" : "보기";
    $("#a-eye").setAttribute("aria-pressed", String(show));
  });
  $("#a-back").addEventListener("click", () => { Sound.play("ui"); show("title"); });
  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#a-submit").disabled) return;
    if (!validate(true)) { Sound.play("no"); const bad = $("#t-auth input.bad"); if (bad) bad.focus(); return; }
    const up = authMode === "signup", id = $("#a-id").value.trim(), pw = $("#a-pw").value;
    setMsg("");
    busy(true, up ? "만드는 중…" : "확인 중…");
    const res = up ? await Account.signup(id, pw) : await Account.login(id, pw);
    busy(false);
    if (!res.ok) { $("#a-msg").textContent = res.error || "다시 시도해 주세요"; Sound.play("no"); return; }
    Sound.play("ok");
    $("#a-pw").value = ""; $("#a-pw2").value = "";
    for (const i of $$("#t-auth input")) i.dataset.touched = "";
    showServers(up ? (res.adopted ? "아이디를 만들었습니다! 이 브라우저의 캐릭터를 1서버로 옮겼어요." : "아이디를 만들었습니다! 서버를 골라 캐릭터를 만들어 보세요.") : "", "ok");
  });
}
function busy(on, text) {
  const b = $("#a-submit");
  b.disabled = on;
  b.classList.toggle("busy", on);
  if (on) { b.dataset.t = b.textContent; b.textContent = text; } else if (b.dataset.t) b.textContent = b.dataset.t;
}

// ───────────────────────────── servers ─────────────────────────────

let chars = { s1: null, s2: null };
async function showServers(msg, kind) {
  titleMusic();
  const s = Account.session();
  if (!s) return showAuth("login", msg);
  show("servers");
  if (msg) setMsg(msg, kind);
  $("#sv-id").textContent = s.id;
  const list = $("#sv-list");
  if (!list.children.length) renderServers(Account.SERVERS, true);
  await refreshServers();
}
/** Characters and channel counts, fetched again (also every 20 s while the list is up). */
async function refreshServers() {
  const [me, svs] = await Promise.all([Account.me(), Account.servers()]);
  if (view !== "servers" || pending) return;
  if (!me.ok) {
    if (me.expired || !Account.session()) return showAuth("login", me.error || "로그인이 만료되었습니다. 다시 로그인해 주세요.");
    setMsg(me.error || "계정 정보를 불러오지 못했습니다");
  } else chars = me.chars || {};
  renderServers(svs, !me.ok);
}
/** How busy a channel is, from its player count. */
function load(n) {
  if (typeof n !== "number") return { k: 0, t: "" };
  return n >= 30 ? { k: 3, t: "혼잡" } : n >= 12 ? { k: 2, t: "보통" } : { k: 1, t: "원활" };
}
function renderServers(svs, loading) {
  const list = $("#sv-list");
  list.textContent = "";
  const last = lastChannel();
  for (const sv of svs) {
    const card = el("div", "sv-card" + (serverOf(last) === sv.id ? " last" : ""));
    const hd = el("div", "sv-hd");
    hd.append(el("b", "", sv.name));
    const total = sv.channels.reduce((a, c) => a + (typeof c.n === "number" ? c.n : 0), 0);
    hd.append(el("small", "", sv.channels.some((c) => typeof c.n === "number") ? `접속 ${total}명` : ""));
    card.append(hd);
    const ch = chars[sv.id];
    const who = el("div", "sv-char");
    if (loading && !ch) who.append(el("span", "sv-empty", "불러오는 중…"));
    else if (ch) {
      who.append(portrait(ch.cls, ch.look));
      const t = el("div", "sv-ct");
      const jr = jobRow(ch);
      t.append(el("b", "", ch.name), el("span", "", `Lv.${jr.lvl} ${JOB_NAME[jr.cls] || ""}`));
      who.append(t);
    } else {
      const b = el("button", "sv-new");
      b.type = "button";
      b.append(el("i", "", "+"), el("span", "", "캐릭터 없음"), el("b", "", "새로 만들기"));
      b.addEventListener("click", () => enter(channelFor(sv.id), "create"));
      who.append(b);
    }
    card.append(who);
    const chs = el("div", "sv-chs");
    for (const c of sv.channels) {
      const L = load(c.n), b = el("button", "sv-ch" + (c.id === last ? " on" : ""));
      b.type = "button";
      b.title = `${sv.name} ${c.name}${typeof c.n === "number" ? ` · ${c.n}명` : ""}`;
      const bars = el("i", "bars l" + L.k);
      bars.append(el("i"), el("i"), el("i"));
      b.append(el("span", "nm", c.name), bars, el("small", "", L.t ? `${L.t}${typeof c.n === "number" ? ` ${c.n}` : ""}` : ""));
      if (c.id === last) b.append(el("em", "", "최근"));
      b.addEventListener("click", () => enter(c.id, ch ? "play" : "create"));
      chs.append(b);
    }
    card.append(chs);
    list.append(card);
  }
}
/** A small picture of a character: the standing frame, head and body. */
function portrait(cls, look) {
  const c = el("canvas", "sv-face");
  c.width = 22; c.height = 22;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  try { g.drawImage(SP.personSheet(SP.playerLook(cls, look || [], {})).front[SP.FRAME.stand], 5, 8, 22, 22, 0, 0, 22, 22); } catch { /* an old look */ }
  return c;
}
/** Connect to a channel: to play, or to make a character there first. */
function enter(ch, why) {
  Sound.unlock(); Sound.play("ok");
  pending = { ch, why, tries: 0 };
  clearTimeout(retryT);
  setMsg(`${label(ch)} 접속 중…`, "info");
  for (const b of $$("#sv-list button")) b.disabled = true;
  C.connect(ch);
}
function unlockServers() { for (const b of $$("#sv-list button")) b.disabled = false; }

// ───────────────────────────── what the server says ─────────────────────────────

/** No character on this server yet: open the creation page. */
export function needChar() {
  const ch = C.channel();
  if (pending) pending.why = "create";
  openCreate(serverOf(ch));
}
/** In the world. */
export function welcome(msg) {
  const ch = C.channel();
  localStorage.setItem(LAST, ch);
  localStorage.setItem(LAST + ":" + serverOf(ch), ch);
  const was = pending;
  pending = null;
  unlockServers();
  $("#b-create").disabled = false;
  show("game");
  refreshSettings();
  return was ? was.why : "";
}
/** A non-fatal error: on the creation page it is about the name. */
export function createError(text) {
  if (view !== "create") return false;
  $("#create-msg").textContent = text;
  $("#create-msg").className = "bad";
  $("#b-create").disabled = false;
  $("#b-create").classList.remove("busy");
  $("#b-create").textContent = "생성";
  Sound.play("no");
  $("#c-name").focus();
  return true;
}
/** The server shut the door: decide where the player goes, and say why. */
export function fatal(msg) {
  const text = msg.error || "연결이 끊겼습니다";
  // the character is still being let go by the other channel: wait and knock again
  if (/다른 채널에서 접속 중/.test(text) && pending && pending.tries < (pending.why === "switch" ? 14 : 4)) {
    pending.tries++;
    const left = 3;
    const note = `이전 채널에서 캐릭터를 데려오는 중… (${pending.tries})`;
    if (C.playing()) C.toast(note); else setMsg(note, "info");
    clearTimeout(retryT);
    retryT = setTimeout(() => pending && C.connect(pending.ch), left * 1000);
    return;
  }
  pending = null;
  unlockServers();
  if (C.playing()) C.stopGame();
  if (msg.auth) {
    // a dead or missing session: sign in again
    Account.logout();
    return showAuth("login", text);
  }
  if (Account.session()) return showServers(text);
  showAuth("login", text);
}
/** The socket dropped while still in the lobby. */
export function connecting() {
  if (view === "servers") setMsg("서버에 연결하는 중…", "info");
  else if (view === "create") { $("#create-msg").textContent = "서버에 다시 연결하는 중…"; $("#create-msg").className = "info"; }
}
export const inLobby = () => view !== "game";

// ───────────────────────────── in the game: channels, account ─────────────────────────────

/** The settings window's channel and account rows. */
function wireSettings() {
  $("#btn-servers").addEventListener("click", () => leave(false));
  $("#btn-logout").addEventListener("click", () => leave(true));
  $("#sv-out").addEventListener("click", () => leave(true));
}
export function refreshSettings() {
  const ch = C.channel(), sv = SERVER(serverOf(ch)), box = $("#set-ch");
  if (!box) return;
  $("#set-sv").textContent = sv.name;
  const s = Account.session();
  $("#set-acc").textContent = s ? s.id : "";
  box.textContent = "";
  for (const c of sv.channels) {
    const b = el("button", "btn" + (c.id === ch ? " on" : ""), c.name);
    b.type = "button";
    b.disabled = c.id === ch;
    b.addEventListener("click", () => switchTo(c.id));
    box.append(b);
  }
}
/** Hop to the other channel of this server. */
function switchTo(ch) {
  if (ch === C.channel() || pending) return;
  Sound.play("ui");
  pending = { ch, why: "switch", tries: 0 };
  C.toast(`${label(ch)}(으)로 이동합니다…`);
  C.connect(ch, 500);
}
/** Out of the world: to the server list, or logged out to the title. */
async function leave(logout) {
  Sound.play("ui");
  pending = null;
  C.disconnect();
  if (C.playing()) C.stopGame();
  if (logout) { await Account.logout(); $("#a-pw").value = ""; showAuth("login", "로그아웃했습니다."); setMsg("로그아웃했습니다.", "ok"); }
  else showServers();
}

// ───────────────────────────── character creation ─────────────────────────────

/** Job names for the server list (the lobby has no defs yet); summaries from before jobs name an old class. */
const JOB_NAME = { adventurer: "모험가", swordsman: "대검전사", thief: "도적", lancer: "창술사", wizard: "마법사", warlock: "마도사", archer: "궁수", spellblade: "마검사", tracker: "추적자", dragoon: "용기사", hexblade: "주술암살자", stormrider: "폭풍기수", darkknight: "암흑기사" };
const OLD_JOB = { warrior: "swordsman", rogue: "thief", lancer: "lancer", mage: "wizard", ranger: "lancer", archer: "lancer" };
/** A summary as the 1–200 scale reads it: one written before jobs (no `v`) is level 4L−3 of its class's job. */
const jobRow = (ch) => (ch.v ? ch : { ...ch, cls: OLD_JOB[ch.cls] || "adventurer", lvl: Math.min(197, 4 * (ch.lvl | 0 || 1) - 3) });
/** Cute names for the dice: a word, now and then with a little word in front. */
const NAMES = ["몽실", "콩이", "보리", "두부", "호떡", "찹쌀", "꼬미", "말랑", "뭉치", "도토리", "솜사탕", "누룽지", "모찌", "꿀떡", "별이", "구름", "방울", "쿠키", "치즈", "단팥", "호두", "땅콩", "감자", "고구마", "밤톨", "토실", "포동", "동글", "젤리", "푸딩", "자두", "복숭아", "마루", "나비", "초코", "라떼", "우유", "망고", "레몬", "앵두", "바둑", "깜지", "하양", "까망", "노랑", "단추", "꼬리", "주먹밥", "만두", "약과", "곶감", "보송", "폭신", "몽글", "달콩", "새콤", "알밤", "버터", "와플", "솔방울"];
const PRE = ["꼬마", "작은", "아기", "용감한", "졸린", "빠른", "작은별", "숲속", "꼬리긴", "말썽"];
function randomName() {
  const R = (a) => a[Math.floor(Math.random() * a.length)];
  for (let k = 0; k < 20; k++) {
    const n = Math.random() < 0.3 ? R(PRE) + R(NAMES) : R(NAMES);
    if (n.length <= 10 && n.length >= 2) return n;
  }
  return R(NAMES);
}
/** The same rule as logic.js validName, said the way the player needs to hear it. */
export function nameError(name) {
  const n = String(name || "");
  if (!n.trim()) return "이름을 지어 주세요";
  if (/\s/.test(n)) return "이름에는 띄어쓰기를 쓸 수 없어요";
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(n)) return "완성된 글자로 써 주세요 (ㄱ, ㅏ 같은 낱자는 안 돼요)";
  if (/[^가-힣A-Za-z0-9]/.test(n)) return "한글·영문·숫자만 쓸 수 있어요";
  if (n.length < 2) return "두 글자 이상이어야 해요";
  if (n.length > 10) return "10자까지 쓸 수 있어요";
  return "";
}

// (`cls` only picks the preview's weapon now: a new 모험가 holds an old dagger)
const draft = { cls: "rogue", look: SPC.cleanLook(SPC.PRESETS[0][1]) };
const history = [];
let lookEd = null, fig = null, figKey = "";
/** The preview: "auto" plays a loop; or stand / walk / attack facing `dir`. */
const pv = { mode: "auto", dir: 0, t0: 0, atkT: -1e9, atkN: 0, next: 0 };

function remember() {
  history.push({ cls: draft.cls, look: draft.look.slice() });
  if (history.length > 40) history.shift();
  $("#c-undo").disabled = false;
}
function undo() {
  const h = history.pop();
  $("#c-undo").disabled = !history.length;
  if (!h) return;
  Sound.play("ui");
  draft.cls = h.cls; draft.look = h.look;
  markClass(); if (lookEd) lookEd.refresh(); markPresets();
}
function openCreate(sid) {
  const sv = SERVER(sid);
  $("#cr-server").textContent = `${sv.name}에 만드는 중`;
  $("#create-msg").textContent = "";
  $("#b-create").disabled = false; $("#b-create").classList.remove("busy"); $("#b-create").textContent = "생성";
  show("create");
  if (!$("#c-name").value) nameCheck();
  if (matchMedia("(pointer: fine)").matches) setTimeout(() => $("#c-name").focus(), 50);
}
function markClass() {
  for (const b of $$("#c-cls .cls")) { const on = b.dataset.v === draft.cls; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); }
  pv.atkT = -1e9;
}
function nameCheck() {
  const v = $("#c-name").value, err = nameError(v), m = $("#c-name-msg");
  m.textContent = v ? err || "좋은 이름이에요! (이미 있는 이름인지는 생성할 때 확인해요)" : "한글·영문·숫자 2~10자";
  m.className = "fmsg " + (v ? (err ? "bad" : "good") : "");
  $("#c-name").classList.toggle("bad", !!(v && err));
  return !err;
}
function wireCreate() {
  // no class to pick any more: everyone starts a 모험가 with an old dagger (J3 restyles this corner)
  const box = $("#c-cls");
  box.textContent = "";
  const card = el("div", "cls on");
  const hd = el("div", "cls-hd");
  const ic = el("span", "cls-ic"); ic.append(iconImg("dagger", "#2a1806"));
  hd.append(ic, el("b", "", "모험가"));
  card.append(hd, el("p", "cls-mech", "모든 모험가는 직업 없이 시작합니다. 무기를 쓰며 숙련을 쌓고, 숙련 20에 전직하세요."));
  box.append(card);
  markClass();
  // the look editor (looks.js), without its presets: they get a row of their own
  lookEd = Looks.editor($("#c-parts"), () => draft.look, (l) => { remember(); draft.look = l; markPresets(); }, () => { Sound.unlock(); Sound.play("ui"); }, { presets: false });
  const pr = $("#c-presets");
  pr.textContent = "";
  for (const [name, l] of SPC.PRESETS) {
    const b = el("button", "pr");
    b.type = "button"; b.title = name; b.dataset.k = SPC.cleanLook(l).join();
    b.append(Looks.thumb(SPC.cleanLook(l)), el("small", "", name));
    b.addEventListener("click", () => { remember(); draft.look = SPC.cleanLook(l); Sound.play("ui"); lookEd.refresh(); markPresets(); });
    pr.append(b);
  }
  markPresets();
  $("#c-rand").addEventListener("click", () => { remember(); draft.look = SPC.cleanLook(Looks.randomLook()); Sound.play("ui"); lookEd.refresh(); markPresets(); });
  $("#c-undo").addEventListener("click", undo);
  $("#c-undo").disabled = true;
  $("#c-dice").addEventListener("click", () => { $("#c-name").value = randomName(); nameCheck(); Sound.play("ui"); });
  $("#c-name").addEventListener("input", nameCheck);
  $("#c-name").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); $("#b-create").click(); } });
  $("#b-create").addEventListener("click", create);
  $("#cr-back").addEventListener("click", () => { Sound.play("ui"); pending = null; C.disconnect(); showServers(); });
  // preview controls
  for (const b of $$("#cr-modes button")) b.addEventListener("click", () => { pv.mode = b.dataset.m; pv.t0 = performance.now(); pv.atkT = -1e9; pv.next = 0; markModes(); Sound.play("ui"); });
  $("#cr-left").addEventListener("click", () => turn(1));
  $("#cr-right").addEventListener("click", () => turn(-1));
  markModes();
  // Ctrl+Z undoes the last change, unless the name field is being edited
  addEventListener("keydown", (e) => {
    if (view !== "create") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && document.activeElement !== $("#c-name")) { e.preventDefault(); undo(); }
  });
  // drag the stage sideways to turn the figure
  let dragX = null;
  const st = $("#cr-stage");
  st.addEventListener("pointerdown", (e) => { dragX = e.clientX; });
  addEventListener("pointerup", () => { dragX = null; });
  st.addEventListener("pointermove", (e) => { if (dragX === null) return; const d = e.clientX - dragX; if (Math.abs(d) > 40) { turn(d > 0 ? 1 : -1); dragX = e.clientX; } });
}
function markPresets() { const k = draft.look.join(); for (const b of $$("#c-presets .pr")) b.classList.toggle("on", b.dataset.k === k); }
function markModes() { for (const b of $$("#cr-modes button")) b.classList.toggle("on", b.dataset.m === pv.mode); }
/** Front → right → back → left, as the arrows turn it. */
const RING = [0, 2, 3, 1];
function turn(d) {
  if (pv.mode === "auto") { pv.mode = "stand"; markModes(); }
  pv.dir = RING[(RING.indexOf(pv.dir) + d + 4) % 4];
  pv.atkT = -1e9;
  Sound.play("ui");
}
function create() {
  if ($("#b-create").disabled) return;
  if (!nameCheck()) { Sound.play("no"); $("#create-msg").textContent = nameError($("#c-name").value); $("#create-msg").className = "bad"; $("#c-name").focus(); return; }
  if (!C.isOpen()) { $("#create-msg").textContent = "서버에 연결되기를 기다리는 중입니다…"; $("#create-msg").className = "info"; return; }
  $("#create-msg").textContent = "";
  $("#b-create").disabled = true; $("#b-create").classList.add("busy"); $("#b-create").textContent = "만드는 중…";
  Sound.play("ok");
  C.act({ t: "create", name: $("#c-name").value.trim(), look: draft.look.slice() });
}

/** Fit the preview canvas to its box: one art pixel is `z` screen pixels. */
let stageZ = 4;
function sizeStage() {
  const box = $("#cr-stage"), cv = $("#cr-cv");
  if (!box || view !== "create") return;
  const r = box.getBoundingClientRect();
  if (!r.width || !r.height) return;
  stageZ = Math.max(2, Math.min(6, Math.floor(Math.min(r.width / 86, r.height / 62))));
  cv.width = Math.ceil(r.width / stageZ); cv.height = Math.ceil(r.height / stageZ);
  cv.style.width = cv.width * stageZ + "px"; cv.style.height = cv.height * stageZ + "px";
}
/** What the figure is doing at time t. */
function pose(t) {
  const strokeT = (SP.HOLD[SP.weaponKind(draft.cls)] || SP.HOLD.sword).time;
  let dir = pv.dir, moving = false, attack = false;
  if (pv.mode === "auto") {
    // turn round, walk a little, then three strokes
    const k = ((t - pv.t0) / 1000) % 9;
    if (k < 3.2) dir = RING[Math.floor(k / 0.8)];
    else if (k < 5.4) { dir = k < 4.3 ? 2 : 1; moving = true; }
    else { dir = 2; attack = true; }
  } else if (pv.mode === "walk") moving = true;
  else if (pv.mode === "attack") attack = true;
  if (attack) {
    if (t >= pv.next) { pv.atkN = t - pv.atkT > strokeT * 1000 + 600 ? 0 : (pv.atkN + 1) % 3; pv.atkT = t; pv.next = t + strokeT * 1000 + (pv.atkN === 2 ? 900 : 120); }
  }
  const side = dir === 1 ? -1 : 1;
  const live = t - pv.atkT < strokeT * 1000 + 500;
  return { dir, moving, atkT: pv.atkT, atkN: pv.atkN, aim: live ? [side * 40, dir === 3 ? -20 : dir === 0 ? 20 : 4] : null };
}

/** One frame of whichever lobby screen is up. */
export function frame(t, dt) {
  if (view === "title" || view === "auth" || view === "servers") TS.render(t, dt);
  else if (view === "create") {
    const key = draft.cls + draft.look.join();
    if (key !== figKey) { figKey = key; fig = S3.figure(S3.playerLook(draft.cls, draft.look.slice(), {})); }
    TS.stage($("#cr-cv"), fig, pose(t), t, dt);
  }
}
