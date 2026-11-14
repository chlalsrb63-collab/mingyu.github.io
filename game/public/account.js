/**
 * Accounts, servers and channels — the browser side of the login flow.
 *
 * The game is split into worlds (servers) and each world into channels:
 *   1서버: s1-ch1, s1-ch2      2서버: s2-ch1, s2-ch2
 * An account (아이디 + 비밀번호) owns one character per server. The session
 * token lives in localStorage and is sent with the WebSocket join.
 *
 * HTTP API (served by src/worker.ts, answered by the vault):
 *   POST /api/signup  {id, pw, legacy?} → {ok, token, id} | {ok:false, error}
 *   POST /api/login   {id, pw}          → {ok, token, id} | {ok:false, error}
 *   POST /api/logout  {token}           → {ok}
 *   POST /api/me      {token}           → {ok, id, chars: {s1: summary|null, s2: summary|null}}
 *        summary = {name, cls, lvl, look}
 *   GET  /api/servers                   → {servers: [{id, name, channels: [{id, name, n}]}]}
 *        n = players online in that channel (best effort, may be 0 or missing)
 * WebSocket: /ws/<channel id> then {type:"join", token}.
 */
const SESS = "lumentale:sess";
/** The id the browser used before accounts existed; offered for adoption at sign-up. */
export const LEGACY_PID = "lumentale:pid";

export const ID_RE = /^[a-z0-9_]{4,16}$/;
export const PW_MIN = 6;

/** The fixed world list, also used when the server cannot be reached for counts. */
export const SERVERS = [
  { id: "s1", name: "1서버", channels: [{ id: "s1-ch1", name: "채널 1" }, { id: "s1-ch2", name: "채널 2" }] },
  { id: "s2", name: "2서버", channels: [{ id: "s2-ch1", name: "채널 1" }, { id: "s2-ch2", name: "채널 2" }] },
];

/**
 * Where the API lives: this origin when the page is served by the game server
 * itself (or locally), else the live server — the same rule client.js uses for
 * the WebSocket, so a static mirror still signs in. The API allows any origin.
 */
const LIVE_HOST = "lumentale-online.higgsfield.app";
const LOCAL = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
export const API = typeof location === "undefined" || LOCAL || location.hostname.endsWith("higgsfield.app") ? "" : `https://${LIVE_HOST}`;

async function post(path, body) {
  try {
    const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { ok: false, error: j.error || `서버 오류 (${r.status})` };
  } catch {
    return { ok: false, error: "서버에 연결할 수 없습니다" };
  }
}

/** {id, token} of the signed-in account, or null. */
export function session() {
  try { const s = JSON.parse(localStorage.getItem(SESS) || "null"); return s && s.token && s.id ? s : null; } catch { return null; }
}
function keep(res) {
  if (res.ok && res.token) localStorage.setItem(SESS, JSON.stringify({ id: res.id, token: res.token }));
  return res;
}
export async function signup(id, pw) {
  const legacy = localStorage.getItem(LEGACY_PID) || undefined;
  const res = keep(await post("/api/signup", { id: String(id).trim().toLowerCase(), pw, legacy }));
  if (res.ok && res.adopted) localStorage.removeItem(LEGACY_PID);
  return res;
}
export async function login(id, pw) { return keep(await post("/api/login", { id: String(id).trim().toLowerCase(), pw })); }
export async function logout() {
  const s = session();
  localStorage.removeItem(SESS);
  if (s) await post("/api/logout", { token: s.token });
}
/** The account's characters per server; clears a dead session. */
export async function me() {
  const s = session();
  if (!s) return { ok: false, error: "로그인이 필요합니다" };
  const res = await post("/api/me", { token: s.token });
  if (!res.ok && res.expired) localStorage.removeItem(SESS);
  return res;
}
/** Servers with live channel counts when available, else the fixed list. */
export async function servers() {
  try {
    const r = await fetch(API + "/api/servers");
    if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.servers)) return j.servers; }
  } catch { /* fall through */ }
  return SERVERS;
}
/** Check an id/password pair the way the server will, for instant feedback. */
export function checkId(id) {
  const s = String(id || "").trim().toLowerCase();
  if (!s) return "아이디를 입력하세요";
  if (!ID_RE.test(s)) return "아이디는 영문 소문자·숫자·밑줄 4~16자입니다";
  return "";
}
export function checkPw(pw, again) {
  if (!pw || pw.length < PW_MIN) return `비밀번호는 ${PW_MIN}자 이상입니다`;
  if (pw.length > 64) return "비밀번호가 너무 깁니다";
  if (again !== undefined && pw !== again) return "비밀번호가 서로 다릅니다";
  return "";
}
