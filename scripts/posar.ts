/**
 * Poseprøva: kvar kuratert pose skal halde ALLE reglane — harde og mjuke.
 * Posane er ansikta utetter; ein pose som bryt ei regel er ein dårleg
 * fyrsteinntrykk terningen aldri skulle ha fått dele ut.
 *
 *   npx tsx scripts/posar.ts
 */
import { DEFAULT_PARAMS, POSES, clampParams } from "../lib/skive/params.ts"
import { measure } from "../lib/skive/metrics.ts"
import { checkRules } from "../lib/skive/rules.ts"
import { buildSlices } from "../lib/skive/profile.ts"
import { lagMesh } from "../lib/skive/mesh.ts"

const NAMN = [
  "grotta", "benken", "stolen", "den lette", "vifta", "vengene", "spent",
  "pidestallen", "akvedukten", "sleden",
]

let fails = 0
POSES.forEach((pose, i) => {
  const p = clampParams({ ...DEFAULT_PARAMS, ...pose }, DEFAULT_PARAMS)
  const m = measure(p)
  const rules = checkRules(p, m)
  const broken = rules.filter((r) => !r.ok)
  const b = buildSlices(p)
  const holes = b.slices.reduce((s, sl) => s + sl.holes.length, 0)
  const mesh = lagMesh(p, b)
  let nan = 0
  for (let j = 0; j < mesh.positions.length; j++) if (!Number.isFinite(mesh.positions[j])) nan++
  const name = NAMN[i] ?? `pose ${i}`
  if (broken.length || nan) {
    fails++
    console.log(`FEIL  ${name}: ${broken.map((r) => `${r.id}=${r.value}`).join(", ")}${nan ? ` NaN×${nan}` : ""}`)
  } else {
    console.log(`  ok  ${name}   ${m.mass.toFixed(1)} kg, ${m.tipAngle.toFixed(0)}°, ${holes} hòl, ${b.slices.length} skiver`)
  }
})
process.exit(fails ? 1 : 0)
