#!/usr/bin/env node
// A few throwaway adventurers for live screenshots: each signs up on the local dev
// server, makes a character, walks to a stump at the town's campfire, sits and stays.
//   node scripts/bots.mjs [count=2] [--url http://localhost:8787] [--secs 90] [--jam]
// Dev only (npm run dev:local first). Uses Node's built-in fetch and WebSocket.
const argv = process.argv.slice(2);
const opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const v = argv[i + 1]; if (v === undefined || v.startsWith("--")) opt[argv[i].slice(2)] = true; else { opt[argv[i].slice(2)] = v; i++; } }
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 2);
const BASE = String(opt.url || "http://localhost:8787").replace(/\/+$/, "");
const SECS = Number(opt.secs || 90);
const api = async (op, body) => (await fetch(`${BASE}/api/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const rand = () => Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "a");
const CLS = ["lancer", "mage", "rogue", "warrior"];

async function bot(i) {
  const id = "bot" + rand(), pw = "pw-" + rand() + rand();
  const r = await api("signup", { id, pw });
  if (!r.ok) throw new Error("signup: " + JSON.stringify(r));
  const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws/s1-ch1");
  const send = (o) => ws.send(JSON.stringify(o));
  const act = (a) => send({ type: "action", action: a });
  let me = null, camps = null, seat = null, sat = false, eid = 0, route = null;
  ws.onopen = () => send({ type: "join", token: r.token });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "need_char") act({ t: "create", name: "모닥" + rand().slice(0, 4), cls: CLS[i % 4], look: [i % 6, (i * 2) % 5, i % 3, (i * 3) % 10, 0, i % 4, i % 6] });
    if (m.type === "welcome") eid = m.you;
    if (m.type !== "snap") return;
    if (m.map) camps = m.map.camps;
    me = m.me;
    if (!camps || !camps.length || sat) return;
    seat = seat || camps[0].seats[(i + 1) % camps[0].seats.length];
    // in town, down the south road first (the plaza's hedges and the spirit tree stand between), then to the stump
    if (!route) route = m.map && m.map.id === "town" ? [[312, 312], [312, 376], seat] : [seat];
    const to = route[0], dx = to[0] - me[0], dy = to[1] - me[1], d = Math.hypot(dx, dy);
    if (d < 4 && route.length > 1) { route.shift(); return; }
    if (d < 4) { act({ t: "sit" }); sat = true; console.log(`bot ${i} (${eid}) sits at`, seat); return; }
    const k = Math.min(1, 9 / d);
    act({ t: "mv", x: me[0] + dx * k, y: me[1] + dy * k, d: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0 });
  };
  if (opt.jam) setInterval(() => { if (sat) act({ t: "jam", k: i % 2 }); }, 1700 + i * 300);
  return ws;
}
const socks = [];
for (let i = 0; i < N; i++) socks.push(await bot(i));
setTimeout(() => { for (const s of socks) s.close(); process.exit(0); }, SECS * 1000);
