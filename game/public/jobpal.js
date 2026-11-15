/**
 * Job palettes for skill icons and effects (docs/design/skills-v2.md §1, §6). The rules own the colours:
 * `welcome.defs.jobPal[job].c = [main, light, dark, accent]` and `defs.skillJob[skill] = job`; net.js hands the
 * defs here once (`setJobDefs`). A palette is the four colours plus a few mixes, built once per job and cached:
 *   w white-hot flash · l light · m main · md main→dark · d dark (outline, the one shadow) · a accent · al · ad
 * Until defs arrive (preview pages) every skill draws in 모험가's colours.
 */
let D = null;
const pals = new Map(), byFx = new Map(), resets = [];
const FALLBACK = ["#c8a46a", "#f0dcae", "#5e4626", "#7fb6d9"];

/** Called once with welcome.defs; drops every cached palette and whatever was drawn from them. */
export function setJobDefs(defs) {
  D = defs; pals.clear(); byFx.clear();
  for (const [id, s] of Object.entries(defs?.skills || {})) if (s.fx != null && !byFx.has(s.fx)) byFx.set(s.fx, id);
  for (const f of resets) f();
}
/** Run `f` whenever the palettes change (icon caches). */
export const onJobDefs = (f) => resets.push(f);

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
function make(c) {
  const [m, l, d, a] = c;
  return { m, l, d, a, w: mix(l, "#ffffff", 0.55), md: mix(m, d, 0.45), al: mix(a, "#ffffff", 0.45), ad: mix(a, d, 0.5) };
}
/** One job's palette (cached). */
export function jobPal(job) {
  let p = pals.get(job);
  if (!p) pals.set(job, (p = make(D?.jobPal?.[job]?.c || FALLBACK)));
  return p;
}
export const skillOwner = (id) => D?.skillJob?.[id] || "adventurer";
/** The palette a skill is drawn in; a hybrid caster using one of its weapons' skills lends it its own accent. */
export function skillPal(id, casterJob) {
  const own = skillOwner(id), j = D?.jobs?.[casterJob];
  if (!casterJob || casterJob === own || j?.kind !== "hybrid" || !j.wk.includes(D?.skills?.[id]?.wk)) return jobPal(own);
  const key = own + "+" + casterJob;
  let p = pals.get(key);
  if (!p) { const c = jobPal(casterJob); pals.set(key, (p = { ...jobPal(own), a: c.a, al: c.al, ad: c.ad })); }
  return p;
}
/** The skill id behind an "a" event's fx code (70–145), from defs.skills. */
export const fxSkill = (code) => byFx.get(code);
/** The palette of the skill behind an fx code, for the caster `eid` (its job from `who`). */
export function fxPal(code, G, eid) {
  const id = byFx.get(code);
  return id ? skillPal(id, G?.who?.get(eid)?.cls) : jobPal("adventurer");
}
/** A hybrid's two weapons' single jobs (for a blended icon rim), else null. */
export function hybridParts(job) {
  const j = D?.jobs?.[job];
  if (j?.kind !== "hybrid") return null;
  const single = (wk) => Object.keys(D.jobs).find((k) => D.jobs[k].kind === "single" && D.jobs[k].wk[0] === wk);
  const a = single(j.wk[0]), b = single(j.wk[1]);
  return a && b ? [a, b] : null;
}
export const skillDef = (id) => D?.skills?.[id];
