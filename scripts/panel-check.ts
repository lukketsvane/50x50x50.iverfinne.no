/**
 * Sjekk av kontrollflata utan nettlesar.
 *
 * Panelet har to stader det kan gå stilt gale: ein parameter som ingen
 * gruppe nemner får aldri ein skyvar, og ein regel-id som tavla peikar på
 * utan at han finst gjer at raudfargen aldri slår til. Begge deler ser
 * heilt rette ut på skjermen. Difor vert dei prøvde her.
 */
import {
  DEFAULT_PARAMS,
  GROUPS,
  MATERIALS,
  PARAM_KEYS,
  PARAM_RANGES,
  randomParams,
  seeded,
  type ParamKey,
} from "../lib/skal/params"
import { measure } from "../lib/skal/metrics"
import { checkRules } from "../lib/skal/rules"

/** dei regel-id-ane måltavla i controls-panel.tsx fargar radene sine etter */
const TAVLA_RULES = [
  "kube",
  "setehogd",
  "skal",
  "skaldjupn",
  "bein",
  "velte",
  "lagtal",
  "utnytting",
] as const

let feil = 0
const nei = (s: string) => {
  feil++
  console.log("  FEIL  " + s)
}

// --- 1 kvar parameter må ha ein skyvar -------------------------------------
const iGrupper = new Set<string>()
for (const g of GROUPS) for (const k of g.keys) iGrupper.add(k)

const alle = new Set<ParamKey>(PARAM_KEYS)
for (const k of alle) if (!iGrupper.has(k)) nei(`${k} har ingen gruppe, altså ingen skyvar`)
for (const k of iGrupper) if (!alle.has(k as ParamKey)) nei(`${k} står i ei gruppe utan å vera ein parameter`)
if (PARAM_KEYS.length !== iGrupper.size) nei("ein nøkkel står i to grupper")

// --- 2 kvart band må vera brukbart -----------------------------------------
for (const k of PARAM_KEYS) {
  const r = PARAM_RANGES[k]
  if (!(r.max > r.min)) nei(`${k}: tomt band`)
  if (!(r.step > 0)) nei(`${k}: steg 0`)
  const v = DEFAULT_PARAMS[k]
  if (v < r.min || v > r.max) nei(`${k}: SKAL står utanfor bandet, ${v} i [${r.min}, ${r.max}]`)
}

// --- 3 regel-id-ane tavla peikar på må finnast ------------------------------
const m = measure(DEFAULT_PARAMS)
const rules = checkRules(DEFAULT_PARAMS, m)
const ids = new Set(rules.map((r) => r.id))
for (const id of TAVLA_RULES) if (!ids.has(id)) nei(`tavla peikar på regelen «${id}» som ikkje finst`)
for (const r of rules) {
  if (!r.why.trim()) nei(`regelen ${r.id} manglar grunngjeving`)
  if (!r.value.trim()) nei(`regelen ${r.id} manglar verdi`)
}

// --- det panelet faktisk viser på SKAL --------------------------------------
const n0 = (v: number) => v.toFixed(0)
const n1 = (v: number) => v.toFixed(1)
console.log("skyvarar:", PARAM_KEYS.length, "i", GROUPS.length, "grupper")
console.log("grupper: " + GROUPS.map((g) => `${g.label} ${g.keys.length}`).join(" · "))
console.log("materiale:", Object.keys(MATERIALS).join(" · "))
console.log("")
console.log("MÅLTAVLA på SKAL")
console.log("  ytre mål     ", `${n1(m.envX)} × ${n1(m.envY)} × ${n1(m.envZ)} mm`)
console.log("  klaring      ", `${n1(m.clearX)} · ${n1(m.clearY)} · ${n1(m.clearZ)} mm`)
console.log("  setehøgd     ", n0(m.seatZ), "mm")
console.log("  brukbar skål ", `${n0(m.dishW)} × ${n0(m.dishD)} mm`)
console.log("  skåldjupn    ", n1(m.dishDepth), "mm")
console.log("  fotavtrykk   ", `${n0(m.footX)} × ${n0(m.footY)} mm`)
console.log("  støtteflate  ", n0(m.footArea / 100), "cm²")
console.log("  veltevinkel  ", n1(m.tipAngle), "°")
console.log("  masse        ", m.mass.toFixed(2), "kg")
console.log("  lag · delar  ", `${m.layers} · ${m.parts}`)
console.log("  utnytting    ", n0(m.util * 100), "%")
console.log("")
// --- 4 raudfargen må kunne slå til ------------------------------------------
// Ein id som finst er ikkje nok: tavla er berre til nytte om eit hardt brot
// faktisk hamnar i ei rad ein les. Terningen vert kasta over mange frø, og
// kvart brot vert ført til den rada som skal lysa.
const RAD: Record<string, string> = {
  kube: "ytre mål / klaring",
  setehogd: "setehøgd",
  skal: "brukbar skål",
  skaldjupn: "skåldjupn",
  bein: "fotavtrykk / støtteflate",
  velte: "veltevinkel",
  lagtal: "lag · delar",
  utnytting: "utnytting",
}
const traff = new Map<string, { n: number; hard: boolean }>()
let utanRad = 0
const N = 40
for (let i = 0; i < N; i++) {
  const p2 = randomParams(seeded("frø-" + i), DEFAULT_PARAMS)
  for (const r of checkRules(p2, measure(p2))) {
    if (r.ok) continue
    const t = traff.get(r.id) ?? { n: 0, hard: r.hard }
    t.n++
    traff.set(r.id, t)
    if (r.hard && !(r.id in RAD)) utanRad++
  }
}
if (utanRad > 0) nei(`${utanRad} harde brot hamna ikkje i noka rad i tavla`)
console.log(`brot over ${N} frø, med rada som lyser:`)
for (const [id, t] of [...traff].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${t.hard ? "hardt" : "mjukt"} · ${id.padEnd(11)} ${String(t.n).padStart(3)}/${N}  → ${RAD[id] ?? "berre i lista under"}`)
}
console.log("")
const brotne = rules.filter((r) => !r.ok)
console.log(`reglar: ${rules.length}, ${brotne.length} ikkje oppfylte`)
for (const r of brotne) console.log(`  ${r.hard ? "bryt" : "merk"} · ${r.label}: ${r.value}`)
console.log("")
console.log(feil === 0 ? "panel-check: i orden" : `panel-check: ${feil} feil`)
process.exit(feil === 0 ? 0 : 1)
