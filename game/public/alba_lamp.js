// 일일 아르바이트 · 가로등 점등 client (STUB: replaced by the real game; contract in public/alba.js)
let host = null, api = null;
export default {
  mount(h, a) { host = h; api = a; host.textContent = ""; const b = document.createElement("button"); b.className = "btn gold"; b.textContent = "일하기 (임시)"; b.onclick = () => api.act({}); host.append(b); },
  setState() {},
  frame() {},
  unmount() { if (host) host.textContent = ""; },
};
