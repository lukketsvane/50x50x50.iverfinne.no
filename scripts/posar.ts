/**
 * Poseprøva: kvar kuratert pose i KVAR motor skal halde ALLE reglane —
 * harde og mjuke. Posane er ansikta utetter; annakvar terningkast startar
 * i ein av dei, og ein pose som bryt ei regel er eit dårleg fyrsteinntrykk
 * terningen aldri skulle ha fått dele ut.
 *
 *   npx tsx scripts/posar.ts          alle motorar
 *   npx tsx scripts/posar.ts skive    berre éin
 */
import { ALLE_MOTORAR as ENGINES } from "../lib/engines.ts"
import { POSES as VAFFEL_POSES } from "../lib/vaffel/params.ts"
import { POSES as SKIVE_POSES } from "../lib/skive/params.ts"
import { POSES as STRAUM_POSES } from "../lib/straum/params.ts"
import { POSES as RIBBE_POSES } from "../lib/ribbe/params.ts"

const POSAR: Record<string, readonly Record<string, number | string>[]> = {
  vaffel: VAFFEL_POSES as never,
  skive: SKIVE_POSES as never,
  straum: STRAUM_POSES as never,
  ribbe: RIBBE_POSES as never,
}

const NAMN: Record<string, readonly string[]> = {
  vaffel: [
    "tett rutenett", "mjuk sylinder", "nesten kube", "timeglas", "portalbenken",
    "lågryggstolen", "lenekrakken",
  ],
  skive: [
    "grotta", "benken", "stolen", "den lette", "vifta", "vengene", "spent",
    "pidestallen", "akvedukten", "sleden", "orgelet", "kvilestolen",
  ],
  straum: ["vridd søyle", "timeglas", "dokumentobjektet", "amfora", "diagonaltrauet"],
  ribbe: ["vridd", "timeglas", "sopp", "krysset", "blomen"],
}

const berre = process.argv[2]
let fails = 0

for (const eng of ENGINES) {
  if (berre && eng.id !== berre) continue
  const poses = POSAR[eng.id] ?? []
  console.log(`== ${eng.id.toUpperCase()} ==`)
  poses.forEach((pose, i) => {
    const namn = NAMN[eng.id]?.[i] ?? `pose ${i}`
    const p = eng.clamp({ ...eng.defaults, ...pose }, eng.defaults)
    const m = eng.measure(p)
    const rules = eng.rules(p, m)
    const broken = rules.filter((r) => !r.ok)
    if (broken.length) {
      fails++
      console.log(`  FEIL ${namn}: ${broken.map((r) => `${r.id}=${r.value}`).join(", ")}`)
    } else {
      console.log(`  ok   ${namn}   ${m.mass.toFixed(1)} kg · ${m.tipAngle.toFixed(0)}° · ${m.units} ${eng.unitLabel}`)
    }
  })
}
process.exit(fails ? 1 : 0)
