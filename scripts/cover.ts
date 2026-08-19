/** Kontrollerer at kuttlista dekkjer alt godset feltet seier finst. */
import { makeShell } from "../lib/skal/field.ts"
import { buildStack, type Pt } from "../lib/skal/laminae.ts"
import { DEFAULT_PARAMS, seeded, randomParams, type Params } from "../lib/skal/params.ts"

function inPoly(p: Pt, poly: Pt[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if (a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c
  }
  return c
}
function check(p: Params, name: string) {
  const sh = makeShell(p)
  const st = buildStack(p, sh)
  const STEP = Number(process.env.STEP ?? 3)
  let solid = 0, uncovered = 0, worst = 0, worstL = -1
  for (const L of st.layers) {
    const zm = (L.z0 + L.z1) / 2
    let s = 0, u = 0
    for (let x = -260; x <= 260; x += STEP) for (let y = -260; y <= 260; y += STEP) {
      const [cx, cy] = sh.spine(sh.hOf(zm))
      const th = Math.atan2(y - cy, x - cx)
      const r = Math.hypot(x - cx, y - cy)
      if (!sh.solidAt(th < 0 ? th + Math.PI * 2 : th, r, zm)) continue
      s++
      const q: Pt = [x, y]
      const inside = L.parts.some((pt) =>
        inPoly(q, pt.outline) && !pt.holes.some((h) => inPoly(q, h)))
      if (!inside) u++
    }
    solid += s; uncovered += u
    if (s && u / s > worst) { worst = u / s; worstL = L.i }
  }
  const pct = solid ? (uncovered / solid) * 100 : 0
  console.log(`${name.padEnd(12)} gods ${(solid*STEP*STEP/100).toFixed(0).padStart(5)} cm²  udekt ${pct.toFixed(2)}%  verste lag ${worstL} (${(worst*100).toFixed(1)}%)`)
  return pct
}
let bad = 0
if (check(DEFAULT_PARAMS, "SKAL") > 1) bad++
for (let i = 1; i <= 6; i++) {
  const p = randomParams(seeded("frø" + i), DEFAULT_PARAMS)
  if (check(p, "frø " + i) > 1) bad++
}
console.log(bad ? `${bad} objekt har udekt gods over 1 %` : "alle innanfor 1 %")
