// 일일 아르바이트 · 택배 상하차 client (STUB: replaced by the real game; contract in public/alba.js)
let host = null, api = null, n = 0;
export default {
  mount(h, a) { host = h; api = a; host.textContent = ""; const b = document.createElement("button"); b.className = "btn gold"; b.textContent = "일하기 (임시)"; b.onclick = () => api.act({}); host.append(b); },
  setState(g) { n = g[0]; },
  frame() {},
  unmount() { if (host) host.textContent = ""; },
};
