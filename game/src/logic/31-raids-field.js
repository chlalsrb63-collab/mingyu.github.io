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
  maple: { map: "maple", name: "단풍 왕도", minLv: 155, maxLv: 200, theme: "autumn", floors: [
    { name: "단풍 숲길", style: "caves", look: "maple_trail", rooms: [17, 20], loops: [3, 6], packs: 1.4 },
    { name: "무너진 성문", style: "halls", look: "maple_gate", rooms: [18, 21], loops: [3, 6], packs: 1.4 },
    { name: "얼음 왕릉 앞", style: "arena", look: "maple_tomb", rooms: [16, 19], loops: [4, 8], packs: 1.1 },
  ] },
};
/** Every raid, in display order: `under` (the four underground themes), `hanok`, then the four field raids. `maxLv` 0: no ceiling. */
const RAID = {
  under: { name: "차원의 균열", minLv: 37, maxLv: 0, floors: DIM_FLOORS },
  hanok: { name: "달그림자 한옥", minLv: 37, maxLv: 0, floors: HANOK_FLOORS },
  ...Object.fromEntries(Object.entries(FIELD_RAIDS).map(([k, r]) => [k, { ...r, field: 1 }])),
};
const dimRaidKey = (k) => (typeof k === "string" && Object.hasOwn(RAID, k) ? k : "under");
/** Floor `floor`'s name in `raid` (an old caller's `true` is the hanok raid). */
const dimFloorName = (floor, raid) => RAID[dimRaidKey(raid === true ? "hanok" : raid)].floors[clamp(floor | 0, 1, DIM.floors) - 1].name;
/** Why a hero of shown level `lv` may not go into a field raid ("" when they may); the first two bar nobody (the level is clamped up). */
const dimRaidBar = (raid, lv) => { const R = RAID[dimRaidKey(raid)]; return R.field && (lv < R.minLv || lv > R.maxLv) ? `이 레이드는 Lv.${R.minLv}~${R.maxLv} 파티만 들어갈 수 있습니다.` : ""; };
/** A raid's toughness scale (RAID `hk`, default 1): the forest's low band (Lv.37–60) is the underground raid's steepest hp ramp, so it is eased to keep the 10-minute pace (bots: 8.2–14.4 min at 1, see tests/dimrift.mjs). */
const dimRaidHk = (raid) => RAID[dimRaidKey(raid)].hk || 1;
