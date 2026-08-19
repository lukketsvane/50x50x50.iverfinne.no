/** Held innpassinga objektet inne i kuben? Målt på meshet, ikkje på feltet. */
import { buildMesh, DETAIL } from "../lib/skal/surface.ts"
import { DEFAULT_PARAMS, randomParams, seeded, CUBE } from "../lib/skal/params.ts"
let worst = 0, over = 0
for (let i = 0; i <= 30; i++) {
  const p = i === 0 ? DEFAULT_PARAMS : randomParams(seeded("kube" + i), DEFAULT_PARAMS)
  const m = buildMesh(p, DETAIL.mid)
  const sx = m.max[0] - m.min[0], sy = m.max[1] - m.min[1]
  const s = Math.max(sx, sy)
  if (s > worst) worst = s
  if (s > CUBE) { over++; console.log(`  ${i}: plan ${s.toFixed(1)} mm — UTANFOR`) }
}
console.log(`31 objekt · største plan ${worst.toFixed(1)} mm · ${over} utanfor kuben`)
