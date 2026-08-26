/**
 * Poseprøva: kvar kuratert pose i KVAR motor skal halde ALLE reglane —
 * harde og mjuke. Posane er ansikta utetter; dei står som inngangar i
 * panelet, og annakvar terningkast startar i ein av dei. Ein pose som
 * bryt ei regel er eit dårleg fyrsteinntrykk.
 *
 * Namna kjem frå motoren sjølv (`poses` i kontrakten) — same liste som
 * panelet syner, so det som vert prøvd her er nøyaktig det brukaren ser.
 *
 *   npx tsx scripts/posar.ts          alle motorar
 *   npx tsx scripts/posar.ts skive    berre éin
 */
import { ALLE_MOTORAR as ENGINES } from "../lib/engines.ts"

const berre = process.argv[2]
let fails = 0

for (const eng of ENGINES) {
  if (berre && eng.id !== berre) continue
  console.log(`== ${eng.id.toUpperCase()} ==`)
  eng.poses.forEach((pose) => {
    const p = eng.clamp({ ...eng.defaults, ...pose.bag }, eng.defaults)
    const m = eng.measure(p)
    const rules = eng.rules(p, m)
    const broken = rules.filter((r) => !r.ok)
    if (broken.length) {
      fails++
      console.log(`  FEIL ${pose.namn}: ${broken.map((r) => `${r.id}=${r.value}`).join(", ")}`)
    } else {
      console.log(`  ok   ${pose.namn}   ${m.mass.toFixed(1)} kg · ${m.tipAngle.toFixed(0)}° · ${m.units} ${eng.unitLabel}`)
    }
  })
}
process.exit(fails ? 1 : 0)
