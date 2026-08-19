/**
 * SANDKASSE — kvar tida går.
 *
 * `plan-budget.ts` seier kor lang tid ei runde tek; denne seier kvifor.
 * Poenget er å skilje arbeid som må gjerast frå arbeid som vert gjort
 * to gonger, slik at PLAN.md kan peike på eit tal og ikkje på ei kjensle.
 */
import { performance } from "node:perf_hooks"
import { makeShell } from "../lib/skal/field"
import { buildMesh, DETAIL } from "../lib/skal/surface"
import { buildStack } from "../lib/skal/laminae"
import { measure } from "../lib/skal/metrics"
import { DEFAULT_PARAMS } from "../lib/skal/params"

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
const ms = (n: number) => n.toFixed(1) + " ms"

const p = DEFAULT_PARAMS
const sh = makeShell(p)

const tShell = timeIt(9, () => makeShell(p))
const tLav = timeIt(5, () => buildMesh(p, DETAIL.lav, sh))
const tStack = timeIt(5, () => buildStack(p, sh))
const tMeasure = timeIt(5, () => measure(p))

console.log("=== måling: kva som er nytt arbeid og kva som er omatt ===")
console.log("measure i alt              ", ms(tMeasure))
console.log("  herav makeShell om att   ", ms(tShell))
console.log("  herav buildMesh(lav) omatt", ms(tLav))
console.log("  herav buildStack om att  ", ms(tStack))
console.log("  eige arbeid              ", ms(tMeasure - tShell - tLav - tStack))
console.log("sparing ved å sende inn det bygde:", ms(tShell + tLav + tStack))

console.log()
console.log("=== buildStack mot vinkeloppløysinga ===")
for (const nth of [120, 180, 240, 360, 512]) {
  const t = timeIt(5, () => buildStack(p, sh, nth))
  const st = buildStack(p, sh, nth)
  console.log(`nth=${String(nth).padStart(3)}  ${ms(t).padStart(9)}  delar ${st.parts}  masse ${st.mass.toFixed(3)} kg`)
}

console.log()
console.log("=== buildMesh mot rutenettet ===")
for (const d of [
  { nth: 160, nv: 52, nq: 12 },
  DETAIL.lav,
  DETAIL.mid,
  DETAIL.hog,
]) {
  const t = timeIt(3, () => buildMesh(p, d, sh))
  const mesh = buildMesh(p, d, sh)
  const cells = d.nth * d.nv
  console.log(
    `nth=${String(d.nth).padStart(3)} nv=${String(d.nv).padStart(3)}  ` +
      `${String(mesh.tris).padStart(7)} tri  ${ms(t).padStart(9)}  ` +
      `${((t * 1000) / cells).toFixed(2)} µs per rute`,
  )
}

console.log()
console.log("=== kor mykje ei runde kostar om alt vert delt ===")
const tShared = timeIt(3, () => {
  const s = makeShell(p)
  const lav = buildMesh(p, DETAIL.lav, s)
  buildStack(p, s, 360)
  void lav
})
console.log("shell + lav-mesh + stack, éin gong:", ms(tShared))
