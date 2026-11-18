/** Native equipment icons. Work on the 32px grid: solid clusters, a dark edge and light from above left. */
export const EQUIP_ICON_SIZE = 32;

const INK = "#282131";
const PALETTE = [
  // highlight, face, shade, deep, trim, inset
  ["#f1dfb6", "#c6ad82", "#9b7e69", "#624658", "#f4d18a", "#9e5d48"],
  ["#e5b47b", "#b87749", "#854f3a", "#4d3240", "#f3cc84", "#568480"],
  ["#e3edf5", "#a5bacb", "#667d99", "#41435d", "#edc776", "#507487"],
  ["#a8c3ba", "#617c77", "#40565e", "#263544", "#90eee0", "#3ab3b6"],
  ["#f0ccfc", "#ac78d7", "#67458f", "#382957", "#affde3", "#5fbea9"],
  ["#cbd5fc", "#7c8ec5", "#465887", "#282d51", "#ffdf90", "#d99557"],
];

function surface() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = EQUIP_ICON_SIZE;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  return { cv, g };
}

/** Keep approved raster artwork at the new size, with its original pixel clusters. */
export function fitEquipmentIcon(src) {
  const N = EQUIP_ICON_SIZE;
  const { cv, g } = surface();
  const scale = N / Math.max(src.width, src.height);
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  g.drawImage(src, (N - w) >> 1, (N - h) >> 1, w, h);
  return cv;
}

function pencil(g) {
  const rect = (x, y, w, h, color) => {
    if (color === null) g.clearRect(x, y, w, h);
    else { g.fillStyle = color; g.fillRect(x, y, w, h); }
  };
  const poly = (points, color) => {
    const lo = Math.min(...points.map((p) => p[1])), hi = Math.max(...points.map((p) => p[1]));
    for (let y = lo; y < hi; y++) {
      const row = y + 0.5, ends = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[j], [bx, by] = points[i];
        if ((ay > row) !== (by > row)) ends.push(ax + (row - ay) * (bx - ax) / (by - ay));
      }
      ends.sort((a, b) => a - b);
      for (let i = 0; i < ends.length; i += 2) {
        const x = Math.ceil(ends[i] - 0.5);
        rect(x, y, Math.ceil(ends[i + 1] - 0.5) - x, 1, color);
      }
    }
  };
  const line = (x, y, toX, toY, color) => {
    const steps = Math.max(Math.abs(toX - x), Math.abs(toY - y), 1);
    for (let i = 0; i <= steps; i++) {
      rect(Math.round(x + (toX - x) * i / steps), Math.round(y + (toY - y) * i / steps), 1, 1, color);
    }
  };
  const oval = (cx, cy, rx, ry, color) => {
    for (let y = -ry; y <= ry; y++) {
      const r = Math.floor(rx * Math.sqrt(1 - (y / (ry + 0.25)) ** 2));
      rect(cx - r, cy + y, 2 * r + 1, 1, color);
    }
  };
  return { rect, poly, line, oval };
}

function ink(g, color = INK) {
  const N = EQUIP_ICON_SIZE;
  const data = g.getImageData(0, 0, N, N).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < N && y < N && data[(y * N + x) * 4 + 3];
  g.fillStyle = color;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
  }
}

function jewel({ poly, rect }, x, y, w, h, cut, face, light, dark) {
  if (cut === "square") {
    poly([[x-w+2,y-h],[x+w-2,y-h],[x+w,y-h+2],[x+w,y+h-2],[x+w-2,y+h],[x-w+2,y+h],[x-w,y+h-2],[x-w,y-h+2]], dark);
    rect(x-w+2,y-h+2,w*2-4,h*2-4,face);
    rect(x-w+2,y-h+1,w,1,light);
  } else {
    poly([[x,y-h],[x+w,y-1],[x+w-1,y+2],[x,y+h],[x-w,y+1],[x-w,y-2]], dark);
    poly([[x,y-h],[x+1,y+1],[x,y+h],[x-w,y+1],[x-w,y-2]], face);
    poly([[x,y-h],[x,y-1],[x-w,y+1],[x-w,y-2]], light);
  }
}

function helm(p, t, [l, m, s, d, a, c]) {
  const { poly, rect, line } = p;
  if (t === 1 || t === 2) {
    // Soft hood and leather cap, with a visible opening and overlapping ear flap.
    const crown = t === 1 ? [[5,22],[5,14],[8,7],[14,4],[20,4],[27,10],[27,23],[24,27],[12,27],[5,25]]
      : [[4,19],[6,12],[10,8],[23,8],[27,12],[28,18],[27,22],[22,23],[21,26],[16,26],[15,22],[5,22]];
    poly(crown, m);
    poly([[6,18],[8,10],[12,6],[19,5],[23,8],[16,8],[11,13],[9,18]], l);
    poly([[23,10],[27,12],[27,23],[24,26],[17,26],[19,21],[22,17]], s);
    poly([[9,16],[13,12],[18,12],[21,15],[20,22],[16,24],[10,22]], t === 1 ? d : s);
    if (t === 1) poly([[11,17],[14,14],[18,14],[19,16],[17,20],[11,21]], null);
    else { rect(5,18,19,2,d); rect(7,17,15,1,l); rect(19,22,3,2,a); }
    line(7,24,14,26,a);
    return;
  }
  if (t === 5) {
    // Uneven crystal points and a deep collar behind the emerald mount.
    poly([[4,10],[10,15],[11,8],[15,11],[18,4],[22,12],[27,8],[27,19],[24,25],[9,26],[5,22]], s);
    poly([[5,10],[11,16],[13,10],[17,16],[18,4],[22,14],[26,10],[25,20],[21,24],[10,24]], m);
    poly([[5,11],[11,17],[13,10],[14,18],[18,5],[19,18],[24,17],[20,20],[9,20]], l);
    rect(9,23,14,2,d);
    jewel(p,16,19,4,5,"kite",c,a,d);
    return;
  }
  const sleek = t === 4;
  if (t === 3) {
    poly([[4,6],[8,10],[12,12],[10,18],[5,14],[3,10]], a);
    poly([[28,5],[28,11],[24,16],[20,15],[24,10]], a);
  }
  poly(sleek
    ? [[4,17],[6,11],[10,7],[21,7],[26,10],[28,15],[28,22],[22,24],[16,24],[13,27],[7,25],[5,21]]
    : [[6,14],[8,9],[12,6],[20,6],[25,9],[27,14],[27,22],[22,26],[19,24],[15,24],[11,27],[7,23]], m);
  poly([[7,14],[10,9],[14,7],[20,7],[23,9],[15,10],[12,13],[11,18],[7,20]], l);
  poly([[24,11],[27,15],[27,22],[23,25],[19,24],[19,18]], s);
  poly([[8,16],[14,14],[21,14],[27,16],[27,20],[21,20],[17,18],[9,19]], d);
  rect(10,16,12,1,sleek ? a : c); rect(21,17,6,1,sleek ? c : a);
  rect(8,22,3,2,l); rect(22,22,2,2,a);
  if (t === 6) {
    poly([[14,7],[16,3],[18,6],[17,15],[14,16]], a);
    rect(15,6,1,6,l); line(9,24,19,22,a);
  }
}

const COATS = [
  [[4,9],[10,6],[13,5],[16,8],[19,5],[22,6],[28,9],[29,17],[24,19],[21,15],[25,27],[7,27],[10,15],[7,19],[3,17]],
  [[5,8],[12,5],[16,7],[20,5],[27,8],[28,16],[23,19],[22,17],[23,26],[9,27],[10,17],[8,19],[3,16]],
  [[3,10],[7,6],[12,6],[16,8],[20,6],[25,6],[29,10],[28,16],[24,18],[22,16],[23,26],[9,26],[10,16],[8,18],[4,16]],
  [[5,9],[11,6],[14,6],[16,8],[18,6],[23,6],[27,9],[28,16],[23,18],[22,17],[22,26],[10,26],[10,17],[9,18],[4,16]],
  [[3,8],[8,9],[10,4],[13,7],[16,9],[19,7],[22,4],[24,9],[29,8],[27,16],[23,18],[22,25],[19,27],[13,27],[10,25],[9,18],[5,16]],
  [[3,10],[6,7],[11,5],[16,7],[21,5],[26,7],[29,10],[28,16],[23,17],[22,23],[24,26],[16,28],[8,26],[10,23],[9,17],[4,16]],
];
function armor(p, t, [l, m, s, d, a, c]) {
  const { rect, poly, line } = p;
  poly(COATS[t - 1], m);
  poly([[19,8],[25,8],[27,13],[25,17],[22,15],[22,23],[23,26],[17,27],[17,16]], s);
  poly([[4,10],[10,7],[13,7],[16,10],[19,7],[23,7],[26,9],[22,11],[18,11],[16,13],[13,11],[9,10],[6,13],[4,13]], l);
  poly([[12,6],[16,9],[20,6],[20,9],[16,12],[12,9]], d);
  if (t <= 2) {
    line(19,8,11,18,a);
    rect(9,18,13,2,d);
    rect(14,18,4,2,a);
    line(10,25,21,25,l);
    if (t === 2) { rect(11,13,3,2,c); rect(19,13,2,2,c); line(16,13,16,17,s); }
  } else {
    for (const y of [14,18,22]) {
      poly([[11,y],[15,y+1],[21,y],[20,y+2],[16,y+4],[12,y+3]], d);
      line(12,y,16,y+1,l); line(16,y+1,20,y,l);
    }
    for (const x of [6,24]) { rect(x,11,3,2,t === 4 ? a : l); rect(x+1,14,2,1,s); }
    if (t === 4) { rect(12,12,8,7,d); rect(13,13,6,2,c); rect(17,16,2,1,a); }
    else if (t >= 5) jewel(p,16,13,3,4,"kite",c,a,d);
    else { rect(15,11,3,2,a); rect(15,23,3,2,a); }
  }
}

function gloves(p, t, [l, m, s, d, a, c]) {
  const { rect, poly, line } = p;
  // Two gauntlets overlap. The turned wrist and separated fingers keep the silhouette readable.
  poly([[12,7],[16,5],[21,5],[24,7],[24,10],[27,10],[27,16],[24,20],[23,23],[16,23],[14,18],[12,15]], s);
  rect(16,7,6,2,l); rect(19,11,5,2,m); rect(21,16,3,1,a);
  poly([[4,9],[7,6],[9,8],[11,6],[14,7],[17,8],[18,13],[20,12],[21,15],[20,19],[17,21],[17,25],[8,27],[6,25],[6,21],[4,17]], m);
  poly([[5,9],[7,7],[9,9],[12,7],[15,8],[16,10],[10,10],[6,13],[5,16]], l);
  poly([[17,12],[19,13],[20,16],[18,20],[16,21],[16,25],[11,26],[11,21],[14,19]], s);
  rect(8,22,8,2,t <= 2 ? d : a); rect(8,20,8,1,l);
  for (const x of [7,10,13]) rect(x,10,1,4,d);
  line(7,15,13,14,l);
  if (t >= 4) jewel(p,12,17,3,3,t === 4 ? "square" : "kite",c,a,d);
  else rect(10,22,2,2,a);
}

function boots(p, t, [l, m, s, d, a, c]) {
  const { rect, poly, line } = p;
  const high = t === 1 ? 10 : t === 4 ? 7 : 5;
  poly([[13,high+1],[20,high],[24,high+3],[23,16],[24,18],[28,19],[28,23],[25,24],[16,24],[14,21]], s);
  line(15,high+2,22,high+2,l);
  rect(21,21,6,2,d);
  poly([[4,high+1],[11,high],[17,high+2],[16,15],[17,19],[22,21],[24,23],[24,26],[21,28],[7,28],[5,26],[5,20],[6,15]], m);
  poly([[5,high+2],[10,high+1],[16,high+3],[15,high+5],[10,high+4],[7,high+5]], l);
  poly([[14,high+6],[16,high+5],[16,16],[17,20],[22,21],[24,23],[23,26],[14,26],[14,23],[10,22],[12,20]], s);
  poly([[5,24],[7,26],[22,26],[24,24],[24,26],[21,28],[7,28],[5,26]], d);
  line(15,23,22,23,l);
  for (let y = high+7; y <= 19; y += 3) rect(8,y,5,1,t <= 2 ? a : d);
  if (t >= 3) { line(8,high+5,8,20,l); rect(9,17,2,3,t === 4 ? c : a); }
  if (t >= 4) rect(14,25,7,1,a);
}

const SETTING = [
  ["#f3c985","#b67b4b","#704a49","#f7aaa0","#bd5368"],
  ["#f4f4f9","#acbcd4","#566780","#a8e2ff","#5084c6"],
  ["#ffe3a0","#dca45a","#825437","#ffb4aa","#b94a66"],
  ["#bcfff1","#59b9b5","#386879","#dcfff2","#4ebfa1"],
  ["#edcefd","#9b76c7","#503269","#90ffdd","#489c98"],
  ["#ffedbd","#cb9e63","#755b5a","#cbdcff","#647fbe"],
];
function ring(p, t) {
  const { oval, line, rect, poly } = p;
  const [l, m, s, g, d] = SETTING[t-1], high = t === 3 || t === 6 ? 7 : 6;
  oval(15,18,11,8,s); oval(15,16,11,8,m); oval(14,16,7,4,null);
  line(8,11,11,9,l); line(6,14,7,12,l); line(16,24,22,21,l);
  poly([[11,7],[14,5],[20,5],[24,8],[23,12],[20,14],[14,12],[11,10]], m);
  jewel(p,18,9,5,high-2,t === 3 || t === 4 ? "square" : "kite",d,g,s);
  rect(12,8,2,2,l); rect(22,9,2,2,m);
}
function amulet(p, t) {
  const { line, rect, poly } = p;
  const [l, m, s, g, d] = SETTING[t-1];
  line(4,4,7,9,m); line(7,9,13,14,m); line(13,14,17,15,m);
  line(26,4,24,9,s); line(24,9,20,14,m); line(20,14,17,15,l);
  for (const [x,y] of [[5,6],[8,10],[12,13],[25,7],[22,12]]) rect(x,y,1,1,l);
  poly(t === 3 || t === 6
    ? [[17,12],[21,15],[24,19],[23,24],[20,27],[14,27],[10,23],[10,18],[13,15]]
    : [[17,12],[21,16],[24,20],[21,24],[17,28],[13,26],[10,21],[11,17]], s);
  poly([[17,14],[21,17],[22,21],[19,25],[15,26],[12,23],[12,19],[14,16]], m);
  line(12,21,14,17,l); line(14,17,17,15,l);
  jewel(p,17,21,4,5,t === 4 ? "square" : "kite",d,g,s);
  rect(16,13,2,2,l);
}

const painters = { helm, armor, gloves, boots, ring, amulet };
const cache = new Map();
export function equipmentIcon(type, tier) {
  const draw = painters[type];
  if (!draw) return null;
  const t = Math.min(PALETTE.length, Math.max(1,tier | 0)), key = type + ":" + t;
  if (!cache.has(key)) {
    const { cv, g } = surface();
    draw(pencil(g), t, PALETTE[t - 1]);
    ink(g);
    cache.set(key, cv);
  }
  return cache.get(key);
}

// These inventory silhouettes are composed for a square. Held weapon models have their own proportions.
function swordIcon(p, t, [l,m,s,d,a,c]) {
  const {poly,rect,line}=p;
  poly([[4,25],[10,19],[13,22],[7,28]],d);
  poly([[5,24],[10,19],[11,20],[7,25]],s);
  rect(5,26,3,2,a);
  const shoulder = t < 3 ? 13 : 11;
  poly([[shoulder,17],[21,8],[27,4],[28,7],[24,15],[16,23]],m);
  poly([[shoulder,17],[21,8],[27,4],[22,13],[14,20]],l);
  poly([[16,20],[24,11],[28,7],[24,15],[16,23]],s);
  line(15,18,24,9,t >= 4 ? c : m);
  poly(t <= 2 ? [[8,16],[10,15],[18,22],[17,25]] : [[6,16],[8,14],[12,17],[16,19],[21,21],[19,24],[13,21]],a);
  rect(13,19,2,2,t >= 4 ? c : l);
}
function daggerIcon(p,t,[l,m,s,d,a,c]) {
  const {poly,rect,line}=p;
  poly([[5,24],[12,17],[15,20],[8,27]],d);
  line(7,23,10,20,l);
  rect(5,25,3,2,s);
  poly(t === 5
    ? [[11,15],[16,11],[20,11],[25,5],[27,10],[24,16],[18,20],[15,20]]
    : [[11,15],[15,9],[26,5],[23,15],[17,20],[14,20]],m);
  poly([[11,15],[15,10],[25,6],[19,12],[14,18]],l);
  poly([[15,18],[21,12],[25,8],[23,15],[17,20]],s);
  poly([[8,15],[10,14],[18,20],[16,23]],a);
  rect(13,17,2,2,t >= 4 ? c : s);
}
function spearIcon(p,t,[l,m,s,d,a,c]) {
  const {poly,line,rect}=p;
  poly([[4,25],[18,12],[20,14],[6,28]],d);
  line(6,25,18,13,t >= 4 ? m : "#bc925b");
  rect(5,25,2,2,a);
  poly([[14,12],[18,11],[21,14],[19,18]],a);
  if(t===5){
    poly([[17,13],[15,8],[18,10],[19,7],[25,3],[24,9],[28,8],[25,13],[22,16]],m);
    poly([[18,12],[20,7],[25,3],[23,10],[21,14]],l);
  }else{
    poly([[17,12],[21,6],[28,3],[26,11],[21,16]],m);
    poly([[17,12],[21,6],[28,3],[23,10],[19,14]],l);
    poly([[20,14],[25,9],[28,3],[26,11],[21,16]],s);
  }
  if(t>=4)rect(21,10,2,2,c);
}
function staffIcon(p,t,[l,m,s,d,a,c]) {
  const {poly,line,oval,rect}=p;
  poly([[4,26],[15,15],[19,13],[20,16],[8,28]],d);
  line(6,26,18,14,t<=2?"#c29a62":m);
  rect(6,25,2,2,a);
  const cap=t===3||t>=5;
  poly(cap
    ? [[14,14],[13,8],[17,3],[24,3],[28,7],[28,11],[23,16],[18,16]]
    : [[14,15],[15,8],[19,4],[25,5],[28,9],[26,14],[21,17],[17,17]],s);
  if(cap) oval(21,9,5,4,null);
  jewel(p,21,9,5,5,t===4?"square":"kite",c,t <= 2 ? a : l,d);
  line(14,13,17,16,a);
  if(t>=3)line(17,4,23,4,a);
}
function bookIcon(p,t,[l,m,s,d,a,c]) {
  const {poly,line,rect}=p;
  poly([[8,4],[23,5],[27,9],[25,26],[21,29],[5,26],[5,8]],d);
  poly([[7,10],[25,10],[24,25],[21,27],[7,25]],"#dac9a7");
  line(10,25,22,26,"#a69786");
  poly([[8,4],[23,5],[27,8],[25,24],[8,23],[5,20],[5,8]],m);
  poly([[5,8],[8,4],[11,5],[9,23],[6,21]],s);
  line(10,5,23,6,l); line(25,8,23,21,s);
  for(const y of [8,18])rect(6,y,4,2,a);
  if(t<=2){line(13,10,21,11,a);line(13,14,19,14,s);}else jewel(p,17,14,4,5,t===4?"square":"kite",c,a,s);
  if(t>=3)poly([[18,25],[21,25],[20,29],[19,28],[17,29]],a);
}
function bowIcon(p,t,[l,m,s,d,a,c]) {
  const {poly,line,rect}=p;
  line(4,10,7,24,"#c7bbab"); line(7,24,22,27,"#a99f9e");
  poly([[4,10],[6,6],[12,4],[18,5],[23,8],[27,14],[27,21],[25,25],[22,28],[22,23],[24,19],[23,13],[19,9],[13,8],[8,9]],s);
  poly([[4,10],[6,6],[12,4],[18,5],[23,8],[27,14],[26,19],[24,14],[20,10],[16,8],[10,7]],m);
  line(7,6,12,5,l); line(24,14,25,19,l);
  line(8,23,22,9,t>=4?c:"#ccb182");
  poly([[20,8],[26,5],[24,11],[22,11]],t>=4?a:l);
  poly([[5,24],[7,20],[9,22],[8,25]],t>=4?a:s);
  rect(21,11,2,2,a);
}
function hammerIcon(p,t,[l,m,s,d,a,c]) {
  const {poly,line,rect}=p;
  poly([[5,25],[16,14],[19,16],[8,28]],d);
  line(7,25,17,15,t>=4?m:"#b98154");
  rect(6,24,2,2,a);
  poly(t===5
    ? [[12,11],[15,6],[23,4],[28,9],[28,16],[24,20],[17,19]]
    : [[11,10],[16,5],[24,4],[28,8],[29,14],[25,20],[17,20]],m);
  poly([[11,10],[16,5],[24,4],[28,8],[22,11],[15,13]],l);
  poly([[22,11],[28,8],[29,14],[25,20],[20,19]],s);
  poly([[14,13],[19,11],[23,12],[22,16],[18,18]],d);
  if(t>=3)jewel(p,18,14,3,3,t===4?"square":"kite",c,a,s);
  else rect(17,13,3,2,l);
}
const weaponPainters={sword:swordIcon,dagger:daggerIcon,spear:spearIcon,staff:staffIcon,book:bookIcon,bow:bowIcon,hammer:hammerIcon};
export function inventoryWeaponIcon(kind,tier,enhancement) {
  const {cv,g}=surface(), p=pencil(g);
  const t=Math.min(PALETTE.length,Math.max(1,tier|0));
  const colors=PALETTE[t-1].slice();
  if(enhancement>=7){ colors[0]="#fff2bd";colors[4]="#ffd483"; }
  (weaponPainters[kind] || swordIcon)(p,t,colors);
  ink(g);
  if(enhancement>=10) ink(g,"#dbab55");
  return cv;
}

// The two raid sets carry their own silhouettes and accents.
const VEIL={edge:"#afa0c5",face:"#746288",shadow:"#4b3d5e",dark:"#302637",jewel:"#ba6487",shine:"#ffd0ca"};
const BLOOM={edge:"#f0eee5",face:"#b5c3c1",shadow:"#71868b",dark:"#364553",jewel:"#57c3b7",shine:"#d0fff0"};
const SETS={
  veil_h(p,c){
    const {poly,rect}=p;
    poly([[4,5],[10,10],[13,7],[16,11],[19,8],[22,10],[28,5],[27,17],[22,23],[17,27],[12,24],[6,19]],c.face);
    poly([[4,5],[11,12],[15,12],[11,15],[7,14]],c.edge);
    poly([[24,11],[28,5],[27,17],[22,23],[17,27],[17,19]],c.shadow);
    poly([[7,15],[13,15],[15,18],[10,19]],c.dark);poly([[18,17],[22,14],[25,14],[22,19]],c.dark);
    rect(12,16,2,1,c.shine);rect(20,16,2,1,c.shine);
    poly([[13,20],[17,21],[21,20],[17,24]],c.jewel);
  },
  veil_a(p,c){
    const {poly,line}=p;
    poly([[6,8],[11,5],[15,8],[18,7],[22,4],[27,9],[24,16],[27,24],[24,27],[19,24],[13,28],[5,25],[8,19],[4,17]],c.face);
    poly([[5,10],[11,6],[14,8],[11,12],[8,19],[6,24],[12,25],[9,20]],c.edge);
    poly([[15,10],[21,7],[25,9],[23,15],[26,24],[24,27],[18,23],[12,26],[14,20]],c.shadow);
    poly([[13,10],[16,8],[21,8],[20,12],[16,15],[13,19]],c.jewel);
    line(11,15,22,10,c.dark); jewel(p,16,11,3,3,"kite",c.jewel,c.shine,c.dark);
  },
  veil_r(p,c){
    const {oval,poly,line}=p;
    oval(15,18,10,8,c.shadow);oval(15,16,10,7,c.face);oval(14,17,6,4,null);
    line(7,16,11,11,c.edge);
    poly([[10,7],[14,9],[16,14],[12,12]],c.edge);
    poly([[24,7],[23,12],[19,15],[20,9]],c.shine);
    jewel(p,17,10,4,4,"kite",c.jewel,c.shine,c.dark);
  },
  veil_n(p,c){
    const {poly,line,rect}=p;
    line(5,5,10,10,c.edge);line(10,10,16,13,c.face);line(26,5,21,10,c.shadow);line(21,10,16,13,c.face);
    poly([[15,10],[19,11],[23,16],[23,22],[18,27],[13,26],[9,21],[10,15]],c.dark);
    jewel(p,16,19,4,6,"kite",c.jewel,c.shine,c.dark);
    for(const y of [15,18,21]){
      poly([[9,y],[12,y-1],[15,y+1],[15,y+2],[12,y+1],[10,y+2]],c.edge);
      poly([[17,y+1],[20,y-1],[23,y],[22,y+2],[20,y+1],[17,y+3]],c.face);
    }
    rect(15,12,3,2,c.edge);
  },
  bloom_h(p,c){
    const {poly,line,rect}=p;
    poly([[5,20],[7,12],[12,8],[17,6],[21,8],[26,12],[27,6],[29,14],[25,21],[23,25],[18,26],[15,22],[11,25],[6,24]],c.face);
    poly([[7,16],[8,11],[16,7],[20,9],[14,10],[11,13],[10,17]],c.edge);
    poly([[24,12],[27,6],[29,14],[25,21],[23,25],[20,24],[22,15]],c.shadow);
    poly([[8,18],[14,14],[21,14],[22,18],[19,21],[12,20]],c.dark);
    line(12,17,19,16,c.shadow);rect(11,18,3,1,c.shine);
    jewel(p,17,11,3,4,"kite",c.jewel,c.shine,c.dark);
  },
  bloom_a(p,c){
    const {poly,line}=p;
    poly([[4,11],[8,6],[13,5],[16,9],[20,5],[25,7],[29,12],[24,19],[22,26],[16,28],[10,25],[8,19],[4,17]],c.shadow);
    poly([[5,12],[8,8],[13,6],[16,10],[12,13],[9,12],[8,17],[5,16]],c.edge);
    poly([[17,10],[20,6],[24,8],[28,12],[25,17],[21,15],[20,12]],c.face);
    for(const y of [13,17,21]){
      poly([[9,y],[13,y+1],[16,y+3],[16,y+5],[11,y+3]],c.edge);
      poly([[17,y+3],[22,y],[24,y+1],[21,y+4],[17,y+5]],c.face);
    }
    line(12,25,18,26,c.dark);jewel(p,16,14,4,6,"kite",c.jewel,c.shine,c.dark);
  },
  bloom_r(p,c){
    const {oval,poly,line}=p;
    oval(15,19,10,8,c.shadow);oval(15,17,10,7,c.face);oval(14,18,6,4,null);
    line(6,17,10,12,c.edge);
    poly([[10,9],[8,5],[14,6],[17,11],[21,5],[26,6],[23,11],[19,14],[14,13]],c.edge);
    jewel(p,17,9,5,5,"kite",c.jewel,c.shine,c.dark);
  },
  bloom_n(p,c){
    const {line,poly,rect}=p;
    line(5,4,10,9,c.edge);line(10,9,16,12,c.face);line(27,4,22,9,c.shadow);line(22,9,16,12,c.face);
    poly([[11,10],[16,12],[20,9],[25,14],[24,21],[19,28],[15,29],[8,22],[7,16]],c.shadow);
    poly([[9,15],[11,11],[15,13],[14,18],[12,20]],c.edge);
    jewel(p,17,19,7,9,"kite",c.jewel,c.shine,c.dark);
    rect(19,19,2,2,c.edge);
  },
};
export function specialEquipmentIcon(id) {
  if (!Object.hasOwn(SETS,id)) return null;
  if (!cache.has(id)) {
    const {cv,g}=surface();
    SETS[id](pencil(g),id.startsWith("veil_")?VEIL:BLOOM);
    ink(g);
    cache.set(id,cv);
  }
  return cache.get(id);
}

/** Fit weapon-space primitives to a square. Books face forward, other weapons point up-right. */
export function weaponIconProjection(kind, shapes) {
  const points = [];
  for (const sh of shapes) {
    if (sh.m === null) continue;
    if (sh.k === "p") points.push(...sh.pts);
    else if (sh.k === "c") {
      points.push([sh.s - sh.r, sh.t - sh.r], [sh.s + sh.r, sh.t + sh.r], [sh.s + sh.r, sh.t - sh.r], [sh.s - sh.r, sh.t + sh.r]);
    } else if (sh.k === "l") {
      for (const [s, t] of [sh.a, sh.b]) points.push([s + 0.5, t + 0.5]);
    } else points.push([sh.s, sh.t], [sh.s + 1, sh.t + 1]);
  }
  const diagonal = kind !== "book";
  const xs = points.map(([s,t]) => diagonal ? s+t : s);
  const ys = points.map(([s,t]) => diagonal ? t-s : t);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // Enough empty pixels for the ink and the +10 rim at every corner.
  const span = EQUIP_ICON_SIZE - 8;
  const scale = Math.min(diagonal ? 1.8 : 2, span / (x1-x0), span / (y1-y0));
  const ox = EQUIP_ICON_SIZE / 2 - scale * (x0+x1) / 2;
  const oy = EQUIP_ICON_SIZE / 2 - scale * (y0+y1) / 2;
  const xf = (s,t) => [ox + scale * (diagonal ? s+t : s), oy + scale * (diagonal ? t-s : t)];
  const inv = (x,y) => {
    const u = (x-ox) / scale, v = (y-oy) / scale;
    return diagonal ? [(u-v) / 2, (u+v) / 2] : [u,v];
  };
  return { xf, inv };
}
