/** The town hall pipe board draws server snapshots and submits tile/hand intents. */
const N = 32, MID = 16, COUNT = N * N, ART = 16;
const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const MASK = [0, 0, UP | DOWN, RIGHT | LEFT, LEFT | DOWN, UP | RIGHT, RIGHT, LEFT];
const DIR = [[UP, DOWN, 0, -1], [RIGHT, LEFT, 1, 0], [DOWN, UP, 0, 1], [LEFT, RIGHT, -1, 0]];
const NAMES = ["빈 칸", "바위", "세로 배관", "가로 배관", "ㄱ자 배관", "ㄴ자 배관", "급수구", "배수구", "망치"];
const ROLES = ["급수 담당", "배수 담당"];
const PHASE = ["brief", "run", "fever", "end"];
const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
const column = (i) => i % N, row = (i) => (i / N) | 0, zoneOf = (i) => Number(column(i) >= MID);
const sprites = new Map();
const st = { rev: -1, cells: null, src: -1, dst: -1, seats: [], selected: -1 };
let A, ui, shift, pending, pointer, hover = -1, clock = -1, warned, wet, tips;
let zoom = 1, panX = 0, panY = 0, left = 0, top = 0, step = 0, ratio = 1;

export function init(api) { A = api; }
export const active = () => !!shift;
const mine = () => st.seats.find(([eid]) => eid === A.G.you);
const working = () => shift && shift[1] > 0 && shift[1] < 3;
function canPlace(i, seat = mine()) {
  if (!working() || !seat || !st.cells || i < 0 || i >= COUNT || zoneOf(i) !== seat[1]) return false;
  const tool = seat[2];
  return tool === 8 ? st.cells[i] === 1 : tool >= 2 && tool <= 5 && st.cells[i] === 0;
}

function sprite(code, flow, floor) {
  const key = (code * 2 + Number(flow)) * 3 + floor;
  if (sprites.has(key)) return sprites.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = ART;
  const g = c.getContext("2d");
  const r = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (floor) {
    const [base, hi, low, chip] = floor === 1 ? ["#453a45", "#4c434d", "#352f3b", "#645559"] : ["#3b4449", "#464d51", "#30363e", "#57616a"];
    r(base, 0, 0, 16, 16); r(hi, 1, 1, 14, 2); r(low, 0, 15, 16, 1); r(low, 15, 3, 1, 12); r(chip, 2, 3, 2, 1);
  }
  const ink = "#251d2a";
  if (code === 1) {
    r(ink, 4, 2, 8, 13); r(ink, 2, 5, 12, 8); r(ink, 1, 8, 14, 3);
    r("#686574", 4, 4, 8, 8); r("#686574", 3, 7, 10, 5); r("#4d4758", 4, 11, 9, 2);
    r("#938d9b", 5, 3, 6, 3); r("#a59ca4", 4, 6, 3, 2); r("#4d4758", 9, 7, 4, 4);
    r("#342c3a", 9, 6, 1, 3); r("#342c3a", 7, 8, 3, 1);
  } else if (code === 8) {
    r(ink, 6, 5, 4, 10); r("#aa7654", 7, 5, 2, 9); r("#dab082", 7, 8, 1, 4);
    r(ink, 2, 1, 12, 7); r("#777888", 3, 2, 10, 5); r("#bcc5ce", 4, 2, 7, 2); r("#535465", 9, 5, 4, 2); r("#e5b772", 6, 4, 3, 3);
  } else if (MASK[code]) {
    const m = MASK[code], metal = "#bc8253", shine = "#f1bd76", low = "#8e4e44", water = "#7bcaca";
    const stem = (x, y, vertical) => {
      r(ink, x, y, 8, 8);
      if (vertical) {
        r(metal, x + 1, y, 6, 8); r(shine, x + 1, y, 1, 8); r(low, x + 6, y, 1, 8);
        if (flow) r(water, x + 3, y, 2, 8);
      } else {
        r(metal, x, y + 1, 8, 6); r(shine, x, y + 1, 8, 1); r(low, x, y + 6, 8, 1);
        if (flow) r(water, x, y + 3, 8, 2);
      }
    };
    r(ink, 4, 4, 8, 8);
    if (m & UP) stem(4, 0, true);
    if (m & DOWN) stem(4, 8, true);
    if (m & LEFT) stem(0, 4, false);
    if (m & RIGHT) stem(8, 4, false);
    r(metal, 5, 5, 6, 6); r(shine, 5, 5, 6, 1); r(low, 5, 10, 6, 1);
    if (flow) { r(water, 7, 7, 2, 2); r("#d3ffeb", 7, 7, 1, 1); }
    if (code === 6) {
      r(ink, 1, 2, 9, 11); r("#496b86", 2, 3, 7, 9); r("#a3e5e1", 4, 4, 3, 7); r("#d6ffea", 3, 6, 5, 2); r("#487984", 4, 7, 3, 1);
    }
    if (code === 7) {
      r(ink, 6, 2, 9, 11); r("#dfba77", 7, 3, 7, 9); r("#382f35", 8, 5, 5, 5);
      r("#d09658", 9, 5, 1, 5); r("#d09658", 11, 5, 1, 5);
    }
  }
  sprites.set(key, c);
  return c;
}

/** Trace wet cells for presentation only. The server reports completed paths. */
function trace() {
  wet = new Uint8Array(COUNT); tips = new Uint8Array(COUNT);
  if (st.src < 0 || st.src >= COUNT) return;
  const queue = [st.src]; wet[st.src] = 1;
  for (const i of queue) for (const [port, back, dx, dy] of DIR) {
    if (!(MASK[st.cells[i]] & port)) continue;
    const x = column(i) + dx, y = row(i) + dy, j = y * N + x;
    if (x < 0 || x >= N || y < 0 || y >= N || !(MASK[st.cells[j]] & back)) tips[i] |= port;
    else if (!wet[j]) { wet[j] = 1; queue.push(j); }
  }
}

function reset() {
  Object.assign(st, { rev: -1, cells: null, src: -1, dst: -1, seats: [], selected: -1 });
  shift = pending = pointer = null; hover = clock = -1; warned = false;
  zoom = 1; panX = panY = 0;
  if (ui) ui.root.hidden = true;
}
export function onSnap(packet) {
  if (!packet) { reset(); return; }
  const [rev, mode, data, src, dst, seats] = packet;
  if (!Number.isInteger(rev) || !Array.isArray(seats) || rev < st.rev) return;
  const old = pending && st.cells?.[pending.i];
  if (mode === 0 && typeof data === "string" && data.length === COUNT && !/[^0-7]/.test(data)) st.cells = Uint8Array.from(data, Number);
  else if (mode === 1 && st.cells && Array.isArray(data)) {
    for (const [i, code] of data) if (Number.isInteger(i) && i >= 0 && i < COUNT && Number.isInteger(code) && code >= 0 && code <= 7) st.cells[i] = code;
  } else return;
  Object.assign(st, { rev, src, dst, seats });
  const seat = mine();
  if (pending && seat?.[3] !== pending.handRev) {
    if (old !== st.cells[pending.i]) A.Sound.play(pending.tool === 8 ? "hammer_land" : "anvil_good");
    pending = null;
  }
  if (st.selected < 0 && seat) st.selected = seat[1] ? dst - 1 : src + 1;
  trace(); draw(); info();
}

function point(e) {
  const bounds = ui.board.getBoundingClientRect();
  return [(e.clientX - bounds.left) * ratio, (e.clientY - bounds.top) * ratio];
}
function cellAt(x, y) {
  const cx = Math.floor((x - left) / step), cy = Math.floor((y - top) / step);
  return cx >= 0 && cx < N && cy >= 0 && cy < N ? cy * N + cx : -1;
}
function select(i) {
  if (i < 0 || i >= COUNT) return false;
  st.selected = i;
  const w = ui.board.width, h = ui.board.height;
  const px = left + (column(i) + 0.5) * step, py = top + (row(i) + 0.5) * step;
  if (px < step / 2 || px > w - step / 2 || py < step / 2 || py > h - step / 2) { panX += w / 2 - px; panY += h / 2 - py; }
  draw(); selection();
  return true;
}
function place() {
  const seat = mine(), i = st.selected;
  if (pending || !canPlace(i, seat)) return false;
  pending = { i, tool: seat[2], handRev: seat[3], at: performance.now() };
  A.act({ t: "coop_act", i, handRev: seat[3] });
  selection(); return true;
}
function resize() {
  if (ui.root.hidden) return;
  const { width, height } = ui.board.getBoundingClientRect();
  ratio = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(width * ratio), h = Math.round(height * ratio);
  if (w && h && (ui.board.width !== w || ui.board.height !== h)) { ui.board.width = w; ui.board.height = h; }
  draw();
}
function changeZoom(value, x = ui.board.width / 2, y = ui.board.height / 2) {
  const old = zoom, dx = ui.board.width / 2 - x, dy = ui.board.height / 2 - y;
  zoom = clamp(value, 1, 4);
  panX = zoom === 1 ? 0 : (panX + dx) * zoom / old - dx;
  panY = zoom === 1 ? 0 : (panY + dy) * zoom / old - dy;
  draw(); selection();
}
function draw() {
  if (!ui || ui.root.hidden || !st.cells) return;
  const { board: { width: w, height: h }, g } = ui, span = Math.min(w, h) * zoom;
  step = span / N;
  const limX = Math.max(0, (span - w) / 2), limY = Math.max(0, (span - h) / 2);
  panX = clamp(panX, -limX, limX); panY = clamp(panY, -limY, limY);
  left = (w - span) / 2 + panX; top = (h - span) / 2 + panY;
  g.imageSmoothingEnabled = false; g.fillStyle = "#201b29"; g.fillRect(0, 0, w, h);
  const seat = mine();
  for (let y = Math.max(0, Math.floor(-top / step)); y < Math.min(N, Math.ceil((h - top) / step)); y++) {
    for (let x = Math.max(0, Math.floor(-left / step)); x < Math.min(N, Math.ceil((w - left) / step)); x++) {
      const i = y * N + x, code = st.cells[i], z = zoneOf(i);
      const a = Math.floor(left + x * step), b = Math.floor(top + y * step);
      const width = Math.floor(left + (x + 1) * step) - a, height = Math.floor(top + (y + 1) * step) - b;
      g.drawImage(sprite(code, !!wet[i], z + 1), a, b, width, height);
      if (z !== seat?.[1]) { g.fillStyle = "#18172738"; g.fillRect(a, b, width, height); }
      if (tips[i]) {
        const n = Math.max(2, Math.round(step * 0.18)), xx = Math.round(a + (width - n) / 2), yy = Math.round(b + (height - n) / 2);
        g.fillStyle = "#ffdf9b";
        if (tips[i] & UP) g.fillRect(xx, b, n, 2);
        if (tips[i] & DOWN) g.fillRect(xx, b + height - 2, n, 2);
        if (tips[i] & LEFT) g.fillRect(a, yy, 2, n);
        if (tips[i] & RIGHT) g.fillRect(a + width - 2, yy, 2, n);
      }
      if (i === st.selected || i === hover) {
        const ok = canPlace(i, seat);
        if (ok && code === 0) { g.globalAlpha = 0.46; g.drawImage(sprite(seat[2], false, 0), a, b, width, height); g.globalAlpha = 1; }
        g.strokeStyle = ok ? "#fff1a0" : "#f4a587"; g.lineWidth = (i === st.selected ? 2 : 1) * ratio;
        g.strokeRect(a + 1, b + 1, width - 2, height - 2);
      }
    }
  }
  const seam = Math.round(left + MID * step);
  if (seam > 0 && seam < w) {
    g.save(); g.setLineDash([4 * ratio, 3 * ratio]); g.lineWidth = ratio; g.strokeStyle = "#ffe9a789";
    g.beginPath(); g.moveTo(seam, top); g.lineTo(seam, top + span); g.stroke(); g.restore();
  }
  if (working() && clock >= 0 && clock <= 60) {
    const depth = Math.min(h * 0.16, (61 - clock) * h / 370);
    g.fillStyle = "#4f96b555"; g.fillRect(0, h - depth, w, depth);
    g.fillStyle = "#9acdd68a"; g.fillRect(0, h - depth, w, ratio);
  }
  if (shift[1] === 3 && shift[6]) {
    g.strokeStyle = "#b9eec0"; g.lineWidth = 3 * ratio; g.strokeRect(2, 2, w - 4, h - 4);
  }
}

function selection() {
  if (!ui || ui.root.hidden || !st.cells) return;
  const i = st.selected, seat = mine(), ok = canPlace(i, seat), tool = seat?.[2], act = tool === 8 ? "바위 깨기" : "배관 설치";
  let note = "";
  if (pending) note = " · 작업 확인 중";
  else if (i >= 0 && seat && working()) note = zoneOf(i) !== seat[1] ? " · 다른 담당 구역" :
    ok ? " · 작업 가능" : tool === 8 ? " · 망치는 바위에만 사용" : " · 빈 칸에만 설치";
  const txt = i < 0 ? "칸을 선택하세요." : (row(i) + 1) + "행 " + (column(i) + 1) + "열 · " + NAMES[st.cells[i]] + note;
  if (ui.selection.textContent !== txt) ui.selection.textContent = txt;
  ui.root.dataset.selected = String(i); ui.root.dataset.zoom = String(zoom);
  ui.place.textContent = act; ui.place.disabled = !!pending || !ok;
  ui.minus.disabled = zoom === 1; ui.plus.disabled = zoom === 4;
}
function info() {
  if (!ui || ui.root.hidden || !st.cells) return;
  const seat = mine();
  Object.assign(ui.root.dataset, { rev: st.rev, zone: seat?.[1] ?? -1, tool: seat?.[2] ?? 0, handRev: seat?.[3] ?? -1, src: st.src, dst: st.dst });
  ui.role.textContent = ROLES[seat?.[1]] || "참가자 확인 중";
  ui.hand.textContent = NAMES[seat?.[2]] || "도구 없음";
  const hand = ui.handArt.getContext("2d");
  hand.clearRect(0, 0, ART, ART);
  if (seat) hand.drawImage(sprite(seat[2], false, 0), 0, 0);
  ui.crew.replaceChildren(...st.seats.map(([eid, z, code]) => {
    const li = document.createElement("li"), label = document.createElement("span"), icon = document.createElement("canvas");
    li.className = z ? "cp-drain" : "cp-inlet";
    label.textContent = (eid === A.G.you ? "나" : A.G.who.get(eid)?.name || "팀원") + (z ? " · 배수" : " · 급수");
    label.title = label.textContent; icon.width = icon.height = ART; icon.title = NAMES[code] || "도구 없음";
    icon.getContext("2d").drawImage(sprite(code, false, 0), 0, 0);
    li.append(label, icon); return li;
  }));
  selection();
}

export function key(e) {
  if (!active() || !ui || ui.root.hidden || /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target?.tagName || "")) return false;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (d) {
    const i = st.selected;
    if (i >= 0) select(clamp(row(i) + d[1], 0, N - 1) * N + clamp(column(i) + d[0], 0, N - 1));
  } else if (e.key === "Enter" || e.key === " " || e.code === "KeyF") {
    if (!e.repeat) place();
  } else if (e.key === "+" || e.key === "=") changeZoom(zoom + 1);
  else if (e.key === "-") changeZoom(zoom - 1);
  else if (e.key === "0") changeZoom(1);
  else return false;
  e.preventDefault(); e.stopImmediatePropagation();
  return true;
}

function attach() {
  const root = document.createElement("div");
  root.id = "coop-pipes"; root.hidden = true;
  root.innerHTML = '<section id="coop-pipe-panel" class="frame" role="dialog" aria-label="마을회관 배관이 터졌어요!">' +
    '<header class="cp-head"><div><h2>마을회관 배관이 터졌어요!</h2><p id="coop-pipe-phase"></p></div><time id="coop-pipe-time"></time></header>' +
    '<div class="cp-main"><div class="cp-map"><div class="cp-map-title"><span>급수 구역</span><span>배수 구역</span></div>' +
    '<div class="cp-view"><canvas id="coop-pipe-board" tabindex="0" aria-label="32×32 배관 보드. 방향키로 고르고 엔터로 작업합니다." aria-describedby="coop-pipe-selection"></canvas></div></div>' +
    '<aside class="cp-side"><div class="cp-hand"><canvas id="coop-pipe-tool" width="16" height="16" aria-hidden="true"></canvas><div><b id="coop-pipe-role"></b><span id="coop-pipe-held"></span></div></div>' +
    '<ul id="coop-pipe-crew" aria-label="팀원과 도구"></ul><p class="cp-tip">중앙 경계에서 두 구역의 배관이 같은 행에 마주보게 놓으세요.</p>' +
    '<div class="cp-zoom" aria-label="보드 확대"><button type="button" class="btn" id="coop-pipe-zoom-out" aria-label="축소">−</button><button type="button" class="btn" id="coop-pipe-fit">전체</button><button type="button" class="btn" id="coop-pipe-zoom-in" aria-label="확대">+</button></div></aside></div>' +
    '<footer class="cp-controls"><output id="coop-pipe-selection" aria-live="polite"></output><div><button type="button" id="coop-pipe-leave" class="btn">그만두기</button><button type="button" id="coop-pipe-place" class="btn gold">배관 설치</button></div></footer></section>';
  (document.querySelector("#hud") || document.body).append(root);
  const $ = (id) => root.querySelector("#coop-pipe-" + id), board = $("board");
  ui = { root, board, g: board.getContext("2d"), time: $("time"), phase: $("phase"), role: $("role"), hand: $("held"), handArt: $("tool"),
    crew: $("crew"), selection: $("selection"), place: $("place"), minus: $("zoom-out"), plus: $("zoom-in") };
  ui.place.addEventListener("click", place);
  $("leave").addEventListener("click", () => A.act({ t: "coop_leave" }));
  ui.minus.addEventListener("click", () => changeZoom(zoom - 1));
  ui.plus.addEventListener("click", () => changeZoom(zoom + 1));
  $("fit").addEventListener("click", () => changeZoom(1));
  board.addEventListener("wheel", (e) => { e.preventDefault(); changeZoom(zoom + (e.deltaY < 0 ? 1 : -1), ...point(e)); }, { passive: false });
  board.addEventListener("pointerdown", (e) => {
    if (pointer || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault(); board.focus({ preventScroll: true }); board.setPointerCapture(e.pointerId);
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, panX, panY, drag: false };
  });
  board.addEventListener("pointermove", (e) => {
    if (pointer?.id === e.pointerId) {
      const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
      if (Math.hypot(dx, dy) > 5) pointer.drag = true;
      if (pointer.drag) { panX = pointer.panX + dx * ratio; panY = pointer.panY + dy * ratio; hover = -1; draw(); }
    } else if (!pointer && e.pointerType === "mouse") {
      const i = cellAt(...point(e));
      if (hover !== i) { hover = i; draw(); }
    }
  });
  board.addEventListener("pointerup", (e) => {
    if (pointer?.id !== e.pointerId) return;
    const drag = pointer.drag; pointer = null;
    if (!drag && select(cellAt(...point(e))) && e.pointerType === "mouse") place();
  });
  board.addEventListener("lostpointercapture", () => { pointer = null; });
  board.addEventListener("pointerleave", () => { hover = -1; draw(); });
  new ResizeObserver(resize).observe(board);
}

export function update(c, at) {
  if (!c) { if (active()) reset(); return; }
  shift = c;
  if (!st.cells) return;
  if (!ui) attach();
  const changed = ui.root.dataset.state !== PHASE[c[1]];
  if (ui.root.hidden) { ui.root.hidden = false; resize(); info(); ui.board.focus({ preventScroll: true }); }
  if (changed) {
    ui.root.dataset.state = PHASE[c[1]];
    ui.phase.textContent = c[1] === 0 ? "곧 작업이 시작됩니다" : c[1] === 3 ? (c[6] ? "연결 완료 · 곧 회관으로 돌아갑니다" : "작업 종료 · 곧 회관으로 돌아갑니다") : "급수구에서 배수구까지";
    selection();
  }
  if (pending && performance.now() - pending.at > 1800) { pending = null; selection(); }
  const s = Math.max(0, c[2] - Math.floor((performance.now() - at) / 1000));
  if (s === clock && !changed) return;
  clock = s;
  ui.time.textContent = (c[1] === 3 ? "복귀 " : "") + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const danger = working() && s <= 60;
  ui.root.classList.toggle("cp-danger", danger);
  if (danger) {
    ui.phase.textContent = "물이 차오릅니다!";
    if (!warned) { warned = true; A.Sound.play("warn"); }
  }
  draw();
}
