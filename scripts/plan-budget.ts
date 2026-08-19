/**
 * SANDKASSE — budsjettet.
 *
 * Måler det PLAN.md lovar å måle: kor lang tid kvart steg i motoren tek,
 * kor stort meshet vert, kor mykje kvar eksport veg, og kor lang den
 * delbare lenkja er. Tala i planen skal koma herifrå og ingen annan stad
 * — ein plan med gjetne tal er ein plan ingen kan falsifisere.
 */
import { performance } from "node:perf_hooks"
import { makeShell } from "../lib/skal/field"
import { buildMesh, DETAIL } from "../lib/skal/surface"
import { buildStack } from "../lib/skal/laminae"
import { contourLines, stackMesh } from "../lib/skal/stack-mesh"
import { measure } from "../lib/skal/metrics"
import { checkRules } from "../lib/skal/rules"
import { nest } from "../lib/skal/nest"
import { meshToStl } from "../lib/skal/export-stl"
import { stackToDxf } from "../lib/skal/export-dxf"
import { contourMapSvg, sheetSvg } from "../lib/skal/export-svg"
import { DEFAULT_PARAMS, PARAM_KEYS, randomParams, seeded } from "../lib/skal/params"

/** median av n køyringar — snittet vert dratt av éin treg fyrste runde */
function timeIt(n: number, f: () => void): number {
  const ts: number[] = []
  for (let i = 0; i < n; i++) {
    const t0 = performance.now()
    f()
    ts.push(performance.now() - t0)
  }
  ts.sort((a, b) => a - b)
  return ts[ts.length >> 1]
}

const kb = (n: number) => (n / 1024).toFixed(0) + " kB"
const ms = (n: number) => n.toFixed(1) + " ms"

const p = DEFAULT_PARAMS

console.log("=== steg for steg, standardobjektet ===")
console.log("makeShell      ", ms(timeIt(9, () => makeShell(p))))

const sh = makeShell(p)
console.log("buildStack     ", ms(timeIt(9, () => buildStack(p, sh))))
console.log("measure        ", ms(timeIt(5, () => measure(p))))
const m = measure(p)
console.log("checkRules     ", ms(timeIt(9, () => checkRules(p, m))))

const stack = buildStack(p, sh)
console.log("stackMesh      ", ms(timeIt(9, () => stackMesh(stack))))
console.log("contourLines   ", ms(timeIt(9, () => contourLines(stack))))
console.log("nest           ", ms(timeIt(5, () => nest(stack))))

console.log()
console.log("=== mesh per detaljnivå ===")
for (const k of ["lav", "mid", "hog"] as const) {
  const d = DETAIL[k]
  const t = timeIt(5, () => buildMesh(p, d, sh))
  const mesh = buildMesh(p, d, sh)
  const bytes = mesh.positions.byteLength + mesh.normals.byteLength
  console.log(
    `${k.padEnd(4)} nth=${d.nth} nv=${d.nv}  ${String(mesh.tris).padStart(7)} tri  ` +
      `${kb(bytes).padStart(8)}  bygg ${ms(t)}`,
  )
}

console.log()
console.log("=== full runde slik arbeidaren gjer henne ===")
for (const k of ["lav", "mid", "hog"] as const) {
  const t = timeIt(5, () => {
    const s = makeShell(p)
    buildStack(p, s)
    const mm = measure(p)
    checkRules(p, mm)
    buildMesh(p, DETAIL[k], s)
  })
  console.log(`flate/${k.padEnd(4)} ${ms(t)}`)
}
{
  const t = timeIt(5, () => {
    const s = makeShell(p)
    const st = buildStack(p, s)
    const mm = measure(p)
    checkRules(p, mm)
    stackMesh(st)
  })
  console.log("lag        ", ms(t))
}
{
  const t = timeIt(5, () => {
    const s = makeShell(p)
    const st = buildStack(p, s)
    const mm = measure(p)
    checkRules(p, mm)
    contourLines(st)
  })
  console.log("kontur     ", ms(t))
}

console.log()
console.log("=== eksport ===")
{
  const mesh = buildMesh(p, DETAIL.hog, sh)
  const t = timeIt(3, () => meshToStl(mesh, "skal"))
  console.log("stl        ", kb(meshToStl(mesh, "skal").byteLength), "·", ms(t))
}
{
  const n = nest(stack)
  const t = timeIt(3, () => stackToDxf(stack, n))
  console.log("dxf        ", kb(stackToDxf(stack, n).length), "·", ms(t))
  const s1 = sheetSvg(n, 0)
  console.log("ark1.svg   ", kb(s1.length), "·", ms(timeIt(3, () => sheetSvg(n, 0))))
  console.log("plater     ", n.sheets.length, "· utnytting", (n.sheets[0].util * 100).toFixed(1) + " %")
}
{
  const t = timeIt(3, () => contourMapSvg(stack))
  console.log("kontur.svg ", kb(contourMapSvg(stack).length), "·", ms(t))
}

console.log()
console.log("=== stabelen ===")
console.log("lag", stack.count, "· delar", stack.parts, "· masse", stack.mass.toFixed(2), "kg")

console.log()
console.log("=== den delbare lenkja ===")
const hash = "#p=" + encodeURIComponent(JSON.stringify({ ...p, view: "flate" }))
console.log("felt         ", PARAM_KEYS.length + 1)
console.log("hash         ", hash.length, "teikn")
console.log("full URL     ", ("https://50x50x50.iverfinne.no/" + hash).length, "teikn")

console.log()
console.log("=== spreiing over rommet: 24 tilfeldige punkt ===")
let worstMesh = 0
let worstTri = 0
let worstFull = 0
let worstHash = 0
let broken = 0
for (let i = 0; i < 24; i++) {
  const q = randomParams(seeded("budsjett:" + i), p)
  const t0 = performance.now()
  const s = makeShell(q)
  const st = buildStack(q, s)
  const mm = measure(q)
  const rr = checkRules(q, mm)
  const mesh = buildMesh(q, DETAIL.mid, s)
  const dt = performance.now() - t0
  worstFull = Math.max(worstFull, dt)
  worstTri = Math.max(worstTri, mesh.tris)
  worstMesh = Math.max(worstMesh, mesh.positions.byteLength + mesh.normals.byteLength)
  worstHash = Math.max(
    worstHash,
    ("#p=" + encodeURIComponent(JSON.stringify({ ...q, view: "flate" }))).length,
  )
  if (rr.some((r) => r.hard && !r.ok)) broken++
  if (!Number.isFinite(mesh.min[0]) || st.count < 2) {
    console.log("  PUNKT", i, "gav eit ubrukeleg objekt")
  }
}
console.log("verste full runde (mid)", ms(worstFull))
console.log("verste mesh            ", worstTri, "tri ·", kb(worstMesh))
console.log("lengste hash           ", worstHash, "teikn")
console.log("punkt som bryt hard regel", broken, "av 24")
