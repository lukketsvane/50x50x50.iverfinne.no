/** RIBBE — måltavla. Alle måltal og alle reglar for standardobjektet. */
import { DEFAULT_PARAMS } from "../lib/ribbe/params.ts"
import { makeShell } from "../lib/ribbe/shell.ts"
import { buildAll, DETAIL } from "../lib/ribbe/mesh.ts"
import { measure } from "../lib/ribbe/metrics.ts"
import { checkRules } from "../lib/ribbe/rules.ts"
import { buildParts } from "../lib/ribbe/parts.ts"
import { nest } from "../lib/ribbe/nest.ts"
import { MATERIALS } from "../lib/core.ts"

const p = DEFAULT_PARAMS
const sh = makeShell(p)
const g = buildAll(p, DETAIL.lav, sh)
const m = measure(p, { sh, g })
const rules = checkRules(p, m, { sh, g })

console.log("=== MÅLTAL ===")
for (const q of m.list) {
  // eininga står alt i teksten når ho ikkje er millimeter
  const u = /[a-zA-Z²³%°]/.test(q.text) ? "" : q.unit
  console.log(`  ${q.label.padEnd(24)} ${q.text.padStart(14)} ${u}`)
}

console.log("\n=== REGLAR ===")
let hardBad = 0
for (const r of rules) {
  const tag = r.ok ? "  ok " : r.hard ? "BROT" : "mjuk"
  if (!r.ok && r.hard) hardBad++
  console.log(`  ${tag}  ${r.label.padEnd(22)} ${r.value}`)
}
console.log(`\n  ${rules.length} reglar · ${rules.filter((r) => r.hard).length} harde · ${hardBad} harde brot`)

const pl = buildParts(sh, g, MATERIALS[p.material].rho)
const ns = nest(pl.parts)
console.log("\n=== DELAR ===")
const byId = new Map<string, { n: number; a: number; kg: number; t: number }>()
for (const q of pl.parts) {
  const e = byId.get(q.id) ?? { n: 0, a: q.area, kg: 0, t: q.t }
  e.n++
  e.kg += q.mass
  byId.set(q.id, e)
}
for (const [id, e] of byId) {
  console.log(
    `  ${id.padEnd(4)} ${String(e.n).padStart(3)} stk · ${e.t.toFixed(0).padStart(3)} mm · ${(e.a / 100).toFixed(0).padStart(5)} cm² · ${e.kg.toFixed(2)} kg`,
  )
}
console.log(
  `  sum ${pl.parts.length} delar · ${(pl.area / 100).toFixed(0)} cm² · ${pl.mass.toFixed(2)} kg · ${ns.sheets.length} ark · utnytting ${(ns.util * 100).toFixed(0)} %`,
)
