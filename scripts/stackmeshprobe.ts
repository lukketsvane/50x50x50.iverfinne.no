import { buildStack } from "../lib/skal/laminae.ts"
import { stackMesh, contourLines } from "../lib/skal/stack-mesh.ts"
import { DEFAULT_PARAMS } from "../lib/skal/params.ts"
const st = buildStack(DEFAULT_PARAMS)
const t0 = Date.now()
const m = stackMesh(st)
const c = contourLines(st)
console.log("stackMesh tris", m.tris, "ms", Date.now()-t0)
console.log("bbox", m.min.map(v=>v.toFixed(1)).join(", "), "→", m.max.map(v=>v.toFixed(1)).join(", "))
console.log("kontur linjer", c.positions.length/6, "tunge", c.heavy.length/6)
