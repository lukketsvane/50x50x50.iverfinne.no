/**
 * Nestingsprøva: kor godt legg kvar motor delane sine på plata?
 *
 * For kvar motor i ALLE_MOTORAR, på standardobjektet: plateutnyttinga
 * (`sheetUtil` frå måltavla — netto delareal delt på medgått plateareal),
 * platetalet, og kor lang tid sjølve nest() tek. Tida er pakkinga åleine:
 * delane er bygde på førehand, so talet er det avlen og kvart
 * skyvarslepp faktisk betaler.
 *
 *   npx tsx scripts/nesting.ts
 */
import { MATERIALS, type Material } from "../lib/core.ts"
import { ALLE_MOTORAR } from "../lib/engines.ts"

import { nest as vaffelNest } from "../lib/vaffel/nest.ts"
import { makeBody as vaffelBody } from "../lib/vaffel/body.ts"
import { buildGrid } from "../lib/vaffel/ribs.ts"
import { buildParts as vaffelParts } from "../lib/vaffel/parts.ts"

import { nest as straumNest } from "../lib/straum/nest.ts"
import { makeBody as straumBody } from "../lib/straum/body.ts"
import { buildParts as straumParts } from "../lib/straum/parts.ts"

import { nest as ribbeNest } from "../lib/ribbe/nest.ts"
import { makeShell } from "../lib/ribbe/shell.ts"
import { buildAll, DETAIL as RIBBE_DETAIL } from "../lib/ribbe/mesh.ts"
import { buildParts as ribbeParts } from "../lib/ribbe/parts.ts"

import { bygg, DETAIL as BOYG_DETAIL } from "../lib/boyg/form.ts"
import { buildParts as boygParts } from "../lib/boyg/parts.ts"

/** delane til standardobjektet, og nest-en som høyrer motoren til */
function rigg(id: string, p: Record<string, number | string>) {
  const mat = p.material as Material
  switch (id) {
    case "vaffel": {
      const parts = vaffelParts(buildGrid(vaffelBody(p as never)), mat).parts
      return { parts, nest: () => vaffelNest(parts) }
    }
    case "boyg": {
      const parts = boygParts(bygg(p as never, BOYG_DETAIL.mid), p as never).parts
      return { parts, nest: () => vaffelNest(parts) }
    }
    case "straum": {
      const parts = straumParts(straumBody(p as never)).parts
      return { parts, nest: () => straumNest(parts) }
    }
    case "ribbe": {
      const sh = makeShell(p as never)
      const g = buildAll(p as never, RIBBE_DETAIL.lav, sh)
      const parts = ribbeParts(sh, g, MATERIALS[mat].rho).parts
      return { parts, nest: () => ribbeNest(parts) }
    }
    default:
      return null
  }
}

console.log("motor    delar  ark  sheetUtil  nest-tid")
for (const e of ALLE_MOTORAR) {
  const m = e.measure(e.defaults)
  const r = rigg(e.id, e.defaults)
  if (!r) {
    console.log(`${e.id.padEnd(8)} — ukjend motor, ingen rigg`)
    continue
  }
  // varm opp éin gong, mål so snittet av fem
  r.nest()
  const RUNS = 5
  const t0 = performance.now()
  for (let i = 0; i < RUNS; i++) r.nest()
  const dt = (performance.now() - t0) / RUNS
  console.log(
    `${e.id.padEnd(8)} ${String(r.parts.length).padStart(5)} ${String(m.sheets).padStart(4)}  ` +
      `${(m.sheetUtil * 100).toFixed(1).replace(".", ",").padStart(7)} %  ${dt.toFixed(1).replace(".", ",").padStart(6)} ms`,
  )
}
