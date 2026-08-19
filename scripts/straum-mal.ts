/**
 * STRAUM — måltavla på kommandolina.
 *
 * Skriv ut alle måltala og alle reglane for standardobjektet, eller for
 * eit frø: `npx tsx scripts/straum-mal.ts terning-3`. Skriptet finst for
 * at ingen skal melde seg ferdig utan å ha sett tala med eigne auge.
 */
import { nn, seeded } from "../lib/core.ts"
import { makeBody } from "../lib/straum/body.ts"
import { buildParts } from "../lib/straum/parts.ts"
import { measure } from "../lib/straum/metrics.ts"
import { checkRules } from "../lib/straum/rules.ts"
import { nest } from "../lib/straum/nest.ts"
import { DEFAULT_PARAMS, randomParams } from "../lib/straum/params.ts"

const seed = process.argv[2]
const p = seed ? randomParams(seeded(seed), DEFAULT_PARAMS) : DEFAULT_PARAMS
const t0 = Date.now()
const bd = makeBody(p)
const B = buildParts(bd)
const m = measure(p, { body: bd, build: B })
const rules = checkRules(p, m, { body: bd, build: B })
const ms = Date.now() - t0

console.log(`\nSTRAUM  ${seed ? `frø «${seed}»` : "standardobjektet"}   ${ms} ms\n`)
console.log("MÅLTAL")
for (const q of m.list) {
  console.log(`  ${q.label.padEnd(26)} ${q.text.padStart(14)} ${q.unit}`)
}

console.log("\nREGLAR")
let hardBad = 0
for (const r of rules) {
  const tag = r.ok ? "  ok  " : r.hard ? " BROT " : " nei  "
  if (!r.ok && r.hard) hardBad++
  console.log(`${tag}${r.hard ? "hard" : "mjuk"}  ${r.label.padEnd(26)} ${r.value}`)
}

const nst = nest(B.parts)
console.log("\nDELAR")
for (const q of B.parts) {
  console.log(
    `  ${q.id.padEnd(6)} ${q.kind.padEnd(7)} t=${nn(q.t, 1).padStart(5)} ` +
      `areal=${nn(q.area / 100, 0).padStart(5)} cm²  hòl=${String(q.holes.length).padStart(2)}  ` +
      `bein=${q.legs}  ${q.kind === "finne" ? `z ${nn(q.zLo, 0)}–${nn(q.zHi, 0)}` : ""}`,
  )
}
console.log(
  `\n  ${nst.sheets.length} plater · ` +
    nst.sheets.map((s) => `${nn(s.t, 1)} mm ${s.placed.length} delar ${nn(s.util * 100, 0)} %`).join(" · "),
)
console.log(
  `\n  ${hardBad === 0 ? "alle harde reglar held" : `${hardBad} harde reglar bryt`}` +
    `  ·  ${rules.filter((r) => !r.ok && !r.hard).length} mjuke seier nei\n`,
)
