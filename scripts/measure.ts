/**
 * Skriv ut heile målearket og alle reglane for SKAL, slik dei står i
 * DEFAULT_PARAMS. Køyr med: npx tsx scripts/measure.ts
 */
import { measure } from "../lib/skal/metrics"
import { checkRules } from "../lib/skal/rules"
import { DEFAULT_PARAMS } from "../lib/skal/params"

const t0 = Date.now()
const m = measure(DEFAULT_PARAMS)
const t1 = Date.now()
const rules = checkRules(DEFAULT_PARAMS, m)
const t2 = Date.now()

console.log("MÅL")
for (const q of m.list) {
  const v = q.text
  console.log("  " + q.label.padEnd(18) + v.padStart(14))
}

console.log("\nREGLAR")
for (const r of rules) {
  const mark = r.ok ? "  ja" : r.hard ? "NEI!" : " nei"
  console.log(
    `  ${mark}  ${r.hard ? "hard" : "mjuk"}  ${r.label.padEnd(14)} ${r.value}`,
  )
  if (!r.ok) console.log(`         ${r.why}`)
}

const hardBad = rules.filter((r) => !r.ok && r.hard).length
const softBad = rules.filter((r) => !r.ok && !r.hard).length
console.log(
  `\n${rules.length} reglar · ${hardBad} harde brot · ${softBad} mjuke merknader`,
)
console.log(`måling ${t1 - t0} ms · reglar ${t2 - t1} ms`)
