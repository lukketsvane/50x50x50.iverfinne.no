import { buildStack } from "../lib/skal/laminae.ts"
import { DEFAULT_PARAMS } from "../lib/skal/params.ts"
const t0 = Date.now()
const st = buildStack(DEFAULT_PARAMS)
console.log("lag", st.count, "delar", st.parts, "areal", (st.area/100).toFixed(0), "cm2", "masse", st.mass.toFixed(2), "kg", Date.now()-t0, "ms")
for (const L of st.layers) {
  console.log(`lag ${String(L.i+1).padStart(2)} z=${L.z0.toFixed(0).padStart(3)}  delar=${L.parts.length}  ${L.parts.map(q=>(q.ring?"ring":"bit")+" "+(q.area/100).toFixed(0)+"cm² w"+q.wmin.toFixed(0)).join("  ")}`)
}
