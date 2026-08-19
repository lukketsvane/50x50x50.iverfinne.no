import { buildMesh, DETAIL } from "../lib/skal/surface.ts"
import { DEFAULT_PARAMS } from "../lib/skal/params.ts"
const t0 = Date.now()
const m = buildMesh(DEFAULT_PARAMS, DETAIL.mid)
console.log("tris", m.tris, "ms", Date.now() - t0)
console.log("bbox", m.min.map(v=>v.toFixed(1)).join(", "), " → ", m.max.map(v=>v.toFixed(1)).join(", "))
console.log("span", (m.max[0]-m.min[0]).toFixed(1), (m.max[1]-m.min[1]).toFixed(1), (m.max[2]-m.min[2]).toFixed(1))
