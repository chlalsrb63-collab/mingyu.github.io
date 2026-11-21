// ───────────────────────────── 레이드던전: the raid table and the four field raids ─────────────────────────────
// docs/design/scale-and-rift.md (as built: field raids). Four more 3단 레이드 built on the hunting grounds' own concepts and art
// (속삭임 숲, 산호 해안, 모래바람 오아시스, 단풍 왕도). A floor row names its layout (`style`, as DIM_FLOORS in 31-maps-dim.js) and its
// look: a DIM_THEMES entry carrying `theme` (the client's art set), the field's own ground chars (`ground`, `alt` for the rubble
// patches, `road` for corridors), the barrier its map draws (`wall` objects against open floor, `deep` behind them, `wallG` / `deepG`
// the ground under them; no rock "W" is left, so the browser draws trees, palms, reef and ruin, never a cave) and the rooms'
// dressing, all from chars that field's map already uses (steps: see DIM_THEMES). dimBuild (31-maps-dim.js) does the conversion.

Object.assign(DIM_THEMES, {
  forest_gorge: { name: "이끼 협곡", theme: "forest", chest: "forest", pool: "w", ground: ":", alt: ";", road: "p", wall: [["P", 0.55], ["T", 0.15], ["R", 0.2], ["B", 0.1]], deep: "P", rooms: {
    glade: [["patch", '"', 0.4], ["clump", "Y", 2, 2], ["edge", "l", 0.06]],
    mossrock: [["clump", "R", 3, 2], ["patch", ";", 0.4], ["edge", "u", 0.05]],
    birch: [["clump", "T", 3, 2], ["edge", "B", 0.12], ["patch", '"', 0.3]],
    stream: [["pool", "w", 2], ["edge", "e", 0.1], ["edge", "R", 0.06]],
    fallen: [["clump", "l", 3, 2], ["clump", "u", 2, 1], ["edge", "P", 0.1]],
  } },
  forest_temple: { name: "잊힌 사원 뜰", theme: "forest", chest: "forest", pool: "w", ground: ":", alt: ";", road: "p", wall: [["P", 0.35], ["U", 0.35], ["R", 0.15], ["T", 0.15]], deep: "P", rooms: {
    court: [["patch", "=", 0.4], ["altar", "z", "q"], ["edge", "U", 0.08]],
    ruin: [["clump", "q", 3, 2], ["clump", "U", 2, 2], ["patch", "=", 0.35]],
    henge: [["ring", "Y", 3], ["altar", "z", "U"], ["patch", "=", 0.3]],
    overgrown: [["clump", "P", 3, 2], ["clump", "q", 1, 2], ["patch", ";", 0.4]],
    spring: [["pool", "w", 2], ["edge", "q", 0.1], ["patch", "=", 0.3]],
  } },
  forest_bog: { name: "속삭임 늪", theme: "forest", chest: "forest", pool: "w", ground: ":", alt: "j", road: "p", wall: [["P", 0.5], ["A", 0.25], ["T", 0.15], ["Y", 0.1]], deep: "P", rooms: {
    bog: [["pool", "w", 3], ["patch", "j", 0.5], ["edge", "e", 0.1]],
    deadwood: [["clump", "A", 3, 2], ["clump", "Y", 2, 2], ["patch", "j", 0.4]],
    shroom: [["ring", "Y", 3], ["clump", "Y", 2, 2], ["patch", ";", 0.4]],
    hollow: [["patch", "j", 0.55], ["edge", "A", 0.08], ["clump", "u", 2, 1]],
    fen: [["pool", "w", 4], ["edge", "P", 0.08]],
  } },
  coast_beach: { name: "백사장", theme: "coast", chest: "coast", pool: "w", ground: "S", alt: "z", road: "p", wall: [["Ψ", 0.45], ["Ω", 0.2], ["R", 0.15], ["T", 0.2]], deep: "Ψ", rooms: {
    dunes: [["patch", "z", 0.45], ["clump", "Ψ", 1, 2], ["edge", "Ω", 0.06]],
    grove: [["clump", "Ψ", 3, 2], ["patch", ".", 0.4], ["edge", "B", 0.1]],
    driftwood: [["clump", "l", 3, 2], ["clump", "Ω", 2, 2], ["patch", "z", 0.3]],
    lagoon: [["pool", "w", 3], ["ring", "Ψ", 4], ["patch", "z", 0.3]],
    shells: [["edge", "Ω", 0.12], ["clump", "R", 2, 2]],
  } },
  coast_reef: { name: "산호 얕은 물", theme: "coast", chest: "coast", pool: "w", ground: "~", alt: "S", road: "S", wallG: "~", deepG: "w", wall: [["Ω", 0.45], ["R", 0.35], ["Ψ", 0.2]], deep: " ", rooms: {
    reef: [["clump", "Ω", 4, 2], ["clump", "R", 2, 2], ["patch", "S", 0.3]],
    sandbar: [["patch", "S", 0.55], ["clump", "Ψ", 1, 1], ["edge", "Ω", 0.06]],
    islet: [["patch", "S", 0.6], ["ring", "Ψ", 3], ["altar", "O", "R"]],
    hole: [["pool", "w", 3], ["edge", "Ω", 0.08], ["patch", "S", 0.25]],
    shoal: [["clump", "R", 3, 2], ["patch", "S", 0.4]],
  } },
  coast_wreck: { name: "난파선 만", theme: "coast", chest: "coast", pool: "w", ground: "S", alt: "z", road: "p", wall: [["Ω", 0.35], ["R", 0.3], ["Ψ", 0.35]], deep: "R", rooms: {
    hull: [["ring", "l", 3], ["clump", "q", 2, 2], ["patch", "z", 0.3]],
    cargo: [["clump", "l", 3, 2], ["clump", "u", 2, 1], ["edge", "Ω", 0.08]],
    cove: [["pool", "w", 3], ["edge", "Ω", 0.1], ["clump", "Ψ", 1, 2]],
    mast: [["altar", "l", "u"], ["clump", "Ω", 2, 2], ["patch", "z", 0.3]],
    strand: [["edge", "Ω", 0.14], ["clump", "R", 2, 2], ["patch", "z", 0.4]],
  } },
  oasis_dunes: { name: "모래바람 사구", theme: "desert", chest: "oasis", pool: "w", ground: "s", alt: "z", road: "p", wall: [["R", 0.55], ["A", 0.25], ["B", 0.2]], deep: "R", rooms: {
    dunes: [["patch", "z", 0.4], ["clump", "R", 2, 2], ["edge", "A", 0.05]],
    scrub: [["clump", "B", 3, 2], ["edge", "A", 0.08], ["patch", ",", 0.3]],
    ridge: [["clump", "R", 4, 2], ["edge", "R", 0.1], ["patch", "r", 0.3]],
    flat: [["edge", "B", 0.1], ["clump", "A", 1, 1], ["patch", "z", 0.3]],
    stony: [["patch", "r", 0.4], ["clump", "R", 3, 2]],
  } },
  oasis_palm: { name: "야자 오아시스", theme: "desert", chest: "oasis", pool: "w", ground: "s", alt: "z", road: "p", wall: [["R", 0.45], ["Ψ", 0.35], ["B", 0.2]], deep: "R", rooms: {
    lake: [["pool", "w", 4], ["ring", "Ψ", 4], ["patch", ",", 0.5]],
    grove: [["clump", "Ψ", 3, 2], ["patch", ".", 0.5], ["edge", "B", 0.1]],
    reeds: [["pool", "w", 2], ["edge", "e", 0.2], ["patch", ".", 0.4]],
    camp: [["altar", "O", "B"], ["clump", "Ψ", 1, 2], ["patch", "t", 0.4]],
    dry: [["patch", "z", 0.4], ["clump", "A", 1, 1], ["edge", "R", 0.06]],
  } },
  oasis_ruin: { name: "모래 유적", theme: "desert", chest: "oasis", pool: "w", ground: "s", alt: "z", road: "p", wall: [["R", 0.35], ["U", 0.45], ["A", 0.2]], deep: "R", rooms: {
    hall: [["clump", "U", 2, 2], ["clump", "q", 3, 2], ["patch", "r", 0.4]],
    court: [["altar", "z", "q"], ["patch", "=", 0.4], ["edge", "U", 0.08]],
    henge: [["ring", "U", 3], ["altar", "z", "q"], ["patch", "r", 0.3]],
    buried: [["patch", "z", 0.55], ["clump", "q", 2, 2], ["clump", "R", 1, 2]],
    graves: [["rows", "J"], ["edge", "A", 0.06], ["patch", "z", 0.3]],
  } },
  maple_trail: { name: "단풍 숲길", theme: "autumn", chest: "maple", pool: "w", ground: ".", alt: "%", road: "p", wall: [["T", 0.55], ["P", 0.15], ["B", 0.15], ["R", 0.15]], deep: "T", rooms: {
    crimson: [["patch", "%", 0.5], ["clump", "T", 3, 2], ["edge", "u", 0.05]],
    gold: [["patch", ";", 0.5], ["clump", "T", 2, 2], ["edge", "B", 0.08]],
    leafpile: [["patch", "%", 0.6], ["clump", "l", 2, 1], ["edge", "u", 0.08]],
    clearing: [["patch", '"', 0.4], ["clump", "B", 2, 2], ["edge", "T", 0.08]],
    hollow: [["patch", "&", 0.5], ["clump", "Y", 2, 2], ["clump", "A", 1, 2]],
  } },
  maple_gate: { name: "무너진 성문", theme: "autumn", chest: "maple", pool: "w", ground: ".", alt: "%", road: "=", wall: [["U", 0.4], ["T", 0.3], ["q", 0.15], ["R", 0.15]], deep: "T", rooms: {
    gate: [["altar", "z", "q"], ["edge", "V", 0.1], ["patch", "=", 0.4]],
    graveyard: [["rows", "J"], ["edge", "u", 0.06], ["patch", "%", 0.35]],
    ruinhall: [["clump", "U", 3, 2], ["clump", "q", 2, 2], ["patch", "=", 0.45]],
    banners: [["edge", "V", 0.14], ["patch", "=", 0.5], ["clump", "u", 1, 1]],
    litter: [["patch", "%", 0.55], ["clump", "l", 2, 1], ["clump", "T", 1, 2]],
  } },
  maple_tomb: { name: "얼음 왕릉 앞", theme: "autumn", chest: "maple", pool: "w", ground: ":", alt: "=", road: "=", wall: [["P", 0.55], ["R", 0.2], ["q", 0.15], ["T", 0.1]], deep: "P", rooms: {
    frost: [["patch", "=", 0.3], ["clump", "P", 3, 2], ["clump", "R", 1, 2]],
    tomb: [["altar", "z", "J"], ["ring", "J", 3], ["patch", "=", 0.4]],
    pond: [["pool", "w", 3], ["edge", "P", 0.1], ["patch", "=", 0.25]],
    pines: [["clump", "P", 4, 2], ["patch", ":", 0.5]],
    ruin: [["clump", "q", 3, 2], ["clump", "U", 2, 2], ["patch", "=", 0.4]],
  } },
});
const FIELD_RAIDS = {
  forest: { map: "forest", name: "속삭임 숲", minLv: 37, maxLv: 60, hk: 0.72, theme: "forest", floors: [
    { name: "이끼 협곡", style: "caves", look: "forest_gorge", rooms: [17, 20], loops: [3, 6], packs: 1.4 },
    { name: "잊힌 사원 뜰", style: "halls", look: "forest_temple", rooms: [18, 21], loops: [3, 6], packs: 1.4 },
    { name: "속삭임 늪", style: "arena", look: "forest_bog", rooms: [16, 19], loops: [4, 8], packs: 1.1 },
  ] },
  coast: { map: "coast", name: "산호 해안", minLv: 95, maxLv: 125, theme: "coast", floors: [
    { name: "백사장", style: "caves", look: "coast_beach", rooms: [17, 20], loops: [3, 6], packs: 1.4 },
    { name: "산호 얕은 물", style: "arena", look: "coast_reef", rooms: [16, 19], loops: [4, 8], packs: 1.1 },
    { name: "난파선 만", style: "halls", look: "coast_wreck", rooms: [18, 21], loops: [3, 6], packs: 1.4 },
  ] },
  oasis: { map: "oasis", name: "모래바람 오아시스", minLv: 110, maxLv: 140, theme: "desert", floors: [
    { name: "모래바람 사구", style: "arena", look: "oasis_dunes", rooms: [16, 19], loops: [4, 8], packs: 1.1 },
    { name: "야자 오아시스", style: "caves", look: "oasis_palm", rooms: [17, 20], loops: [3, 6], packs: 1.4 },
    { name: "모래 유적", style: "halls", look: "oasis_ruin", rooms: [18, 21], loops: [3, 6], packs: 1.4 },
  ] },
  maple: { map: "maple", name: "단풍 왕도", minLv: 155, maxLv: 200, theme: "autumn", boss: [1.8, 1.35], floors: [
    { name: "단풍 숲길", style: "caves", look: "maple_trail", rooms: [17, 20], loops: [3, 6], packs: 1.4 },
    { name: "무너진 성문", style: "halls", look: "maple_gate", rooms: [18, 21], loops: [3, 6], packs: 1.4 },
    { name: "얼음 왕릉 앞", style: "arena", look: "maple_tomb", rooms: [16, 19], loops: [4, 8], packs: 1.1 },
  ] },
};
/**
 * The floor plans a raid's single floor may take (owner 2026-11-21: one floor, its mid-boss, then the boss's own room), one
 * picked from the run's seed: the underground looks (DIM_FLOORS' layouts), the hanok halls and the field looks above.
 */
const RAID_ROWS = {
  crypt: { ...DIM_FLOORS[0], themes: ["crypt"] },
  sewer: { ...DIM_FLOORS[0], name: "오수 회랑", themes: ["sewer"] },
  cave: DIM_FLOORS[1],
  abyss: DIM_FLOORS[2],
  ...Object.fromEntries(HANOK_FLOORS.map((r, i) => ["hanok" + (i + 1), { ...r, hanok: 1 }])),
  ...Object.fromEntries(Object.values(FIELD_RAIDS).flatMap((R) => R.floors.map((r) => [r.look, r]))),
};
/**
 * The ten raids (owner 2026-11-21: the raids and the boss challenges are one content), in the order they open. Each is one
 * of the boss challenge's bosses (DIM_CHAL.bosses: its patterns and phases, 56-boss-script.js), fought in its own room
 * (dimArena) behind a procedural floor of one of its `looks` (RAID_ROWS) and that floor's mid-boss (dimBuild: the look's field
 * boss near the level, else its toughest kind; `master` names one). 보통 is made for the hero's level inside `minLv`–`maxLv`
 * (a hero past it gets the ceiling); 헬 for Lv.200+ whatever the raid (RAID_DIF).
 */
const RAID = {
  wickregent: { name: "밀랍 지하묘", minLv: 20, maxLv: 40, looks: ["crypt", "sewer"] },
  knotwidow: { name: "등불매듭 숲", minLv: 40, maxLv: 60, looks: ["forest_gorge", "forest_bog"] },
  knellkeeper: { name: "달그림자 한옥", minLv: 60, maxLv: 80, looks: ["hanok1", "hanok2", "hanok3"], master: "jaemaei" },
  loomcolossus: { name: "모래 직조탑", minLv: 80, maxLv: 100, looks: ["oasis_ruin", "oasis_dunes"] },
  sluiceleviathan: { name: "난파 배수만", minLv: 100, maxLv: 120, looks: ["coast_wreck", "coast_reef"] },
  prismcantor: { name: "공명 수정굴", minLv: 120, maxLv: 140, looks: ["cave", "oasis_palm"] },
  boss: { name: "균열 군주의 왕도", minLv: 140, maxLv: 160, looks: ["maple_gate", "maple_trail"] },
  abyssboss: { name: "핏빛 심연", minLv: 160, maxLv: 180, looks: ["abyss", "forest_temple"] },
  cloakbat: { name: "밤장막 왕릉", minLv: 180, maxLv: 200, looks: ["maple_tomb", "crypt"] },
  bloomwhale: { name: "꽃무덤 해구", minLv: 200, maxLv: 200, looks: ["coast_reef", "coast_beach", "cave"] },
};
const RAID_KEYS = Object.keys(RAID);
const dimRaidKey = (k) => (typeof k === "string" && Object.hasOwn(RAID, k) ? k : RAID_KEYS[0]);
/** The floor plan of a run of `raid` from its seed. */
const dimRow = (raid, seed) => { const L = RAID[dimRaidKey(raid)].looks; return RAID_ROWS[L[((seed >>> 3) >>> 0) % L.length]]; };
/** The world tier a run of `raid` is made for: the best hero's, kept inside the raid's window. */
const dimRaidLv = (raid, tier) => { const R = RAID[dimRaidKey(raid)], lo = Math.floor(toTier(R.minLv)); return clamp(tier, lo, Math.max(lo, Math.floor(toTier(R.maxLv)))); };
/**
 * Difficulty steps of every raid (owner 2026-11-21). 보통 is the raid as tuned; 어려움 and 악몽 keep the raid's own levels
 * but want strong gear for them; 헬 (Lv.200+, any raid, no level window) scales every monster to the world's top
 * tier first (dimHell, 64-dim.js), then hardens it. `hp` / `atk` × on every raid monster and the master; the chest pays
 * `gold` / `xp` × and `gear` extra rare pieces and `stone` extra 강화석. 헬 is one entry a day per raid (dimBar, ch.dim.hd) and
 * its chest has an `ancient` chance of a 고대 piece (item level IL_ANCIENT).
 */
const RAID_HELL_LV = 200;
const RAID_DIF = [
  { name: "보통", hp: 1, atk: 1, gold: 1, xp: 1, gear: 0, stone: 0 },
  { name: "어려움", hp: 2, atk: 1.5, gold: 1.6, xp: 1.4, gear: 1, stone: 2 },
  { name: "악몽", hp: 3.5, atk: 2.2, gold: 2.4, xp: 1.9, gear: 2, stone: 4 },
  { name: "헬", hp: 2.5, atk: 1.8, gold: 3.5, xp: 2.5, gear: 3, stone: 6, hell: 1, ancient: 0.04 },
];
const dimDif = (d) => (Number.isInteger(d) ? clamp(d, 0, RAID_DIF.length - 1) : 0);
/** Why a hero of shown level `lv` may not go into a raid at difficulty `dif` ("" when they may): 헬 wants Lv.200; else the raid's own floor. */
const dimRaidBar = (raid, lv, dif = 0) => {
  if (RAID_DIF[dimDif(dif)].hell) return lv < RAID_HELL_LV ? `헬 난이도는 Lv.${RAID_HELL_LV}부터 들어갈 수 있습니다.` : "";
  const R = RAID[dimRaidKey(raid)];
  return lv < R.minLv ? `[${R.name}]은 Lv.${R.minLv}부터 들어갈 수 있습니다.` : "";
};
