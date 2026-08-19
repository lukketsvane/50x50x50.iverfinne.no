/**
 * Heile fabrikasjonsvegen for SKAL: mesh, stabel, nesting og fire filer ut.
 *   npx tsx scripts/fab.ts
 */
import { mkdirSync, writeFileSync, statSync } from "node:fs"
import { meshToStl, stlFilename } from "../lib/skal/export-stl.ts"
import { stackToDxf } from "../lib/skal/export-dxf.ts"
import { contourMapSvg, elevationSvg, sheetSvg } from "../lib/skal/export-svg.ts"
import { makeShell } from "../lib/skal/field.ts"
import { buildStack } from "../lib/skal/laminae.ts"
import { nest } from "../lib/skal/nest.ts"
import { DEFAULT_PARAMS } from "../lib/skal/params.ts"
import { buildMesh, DETAIL } from "../lib/skal/surface.ts"

const p = DEFAULT_PARAMS
const t0 = Date.now()
const sh = makeShell(p)
const mesh = buildMesh(p, DETAIL.mid, sh)
const stack = buildStack(p, sh)
const nesting = nest(stack)
console.log(`bygd på ${Date.now() - t0} ms`)

mkdirSync("out", { recursive: true })
const files: [string, string | Uint8Array][] = [
  ["out/skal.stl", meshToStl(mesh)],
  ["out/skal.dxf", stackToDxf(stack, nesting)],
  ["out/kontur.svg", contourMapSvg(stack)],
  ["out/ark1.svg", sheetSvg(nesting, 0)],
  ["out/oppriss.svg", elevationSvg(p, 0)],
]
for (const [name, data] of files) writeFileSync(name, data)

const span = (i: number) => (mesh.max[i] - mesh.min[i]).toFixed(1)
console.log(
  `mesh   ${mesh.tris} trekantar   ${span(0)} × ${span(1)} × ${span(2)} mm`,
)
console.log(
  `stabel ${stack.count} lag   ${stack.parts} delar   ` +
    `${(stack.area / 100).toFixed(0)} cm²   ${stack.mass.toFixed(2)} kg`,
)
console.log(
  `nesting ${nesting.sheets.length} plater à ${nesting.sheetW}×${nesting.sheetH} mm   ` +
    `utnytting ${(nesting.util * 100).toFixed(1)} %   ` +
    `brukt lengd ${nesting.usedLen.toFixed(0)} mm`,
)
nesting.sheets.forEach((s, i) => {
  console.log(
    `  ark ${i + 1}: ${String(s.placed.length).padStart(2)} delar   ` +
      `fylt til ${s.used.toFixed(0)} mm   utnytting ${(s.util * 100).toFixed(1)} %`,
  )
})
console.log(`stl-namn ${stlFilename(p)}`)
for (const [name] of files) {
  console.log(`  ${name.padEnd(16)} ${(statSync(name).size / 1024).toFixed(1)} kB`)
}
