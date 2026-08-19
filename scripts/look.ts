import { writeFileSync } from "node:fs"
import { buildMesh, DETAIL } from "../lib/skal/surface.ts"
import { meshToStl } from "../lib/skal/export-stl.ts"
import { measure } from "../lib/skal/metrics.ts"
import { checkRules } from "../lib/skal/rules.ts"
import { DEFAULT_PARAMS, type Params } from "../lib/skal/params.ts"
const over = JSON.parse(process.argv[3] ?? "{}") as Partial<Params>
const p = { ...DEFAULT_PARAMS, ...over }
const m = measure(p)
const r = checkRules(p, m)
console.log(`env ${m.envX.toFixed(0)}×${m.envY.toFixed(0)}×${m.envZ.toFixed(0)}  kant ${m.seatZ}  sit ${m.sitZ.toFixed(0)}  skål ${m.dishW.toFixed(0)}×${m.dishD.toFixed(0)}×${m.dishDepth.toFixed(0)}  velte ${m.tipAngle.toFixed(1)}°  lag ${m.layers}  delar ${m.parts}  masse ${m.mass.toFixed(1)}  util ${(m.util*100).toFixed(0)}%`)
console.log("  brot:", r.filter(x=>!x.ok).map(x=>`${x.label} ${x.value}`).join(" · ") || "ingen")
if (process.argv[2] !== "-") writeFileSync(process.argv[2], meshToStl(buildMesh(p, DETAIL.mid), "skal"))
