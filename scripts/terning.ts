/**
 * Terningprøva: kor ofte leverer terningen eit lovleg møbel?
 *
 * Poseprøva vaktar dei kuraterte punkta; denne vaktar alt imellom. Kvar
 * motor får N seeda kast gjennom si eiga randomParams, og kvart kast vert
 * målt mot ALLE reglane. Tala her er kvaliteten slik brukaren møter han
 * på terningknappen — kvart harde brot er eit ubyggbart objekt på skjermen.
 *
 *   npx tsx scripts/terning.ts             alle motorar, 200 kast
 *   npx tsx scripts/terning.ts skive 500   éin motor, eige tal kast
 */
import { seeded } from "../lib/core.ts"
import { ENGINES } from "../lib/engines.ts"

const berre = process.argv[2]
const N = Number(process.argv[3] ?? 200)

for (const eng of ENGINES) {
  if (berre && eng.id !== berre) continue
  const feil = new Map<string, { n: number; hard: boolean }>()
  let hardOk = 0
  let alleOk = 0
  let p = eng.defaults
  for (let i = 0; i < N; i++) {
    const rnd = seeded(`terning-${eng.id}-${i}`)
    p = eng.random(rnd, p, new Set())
    const m = eng.measure(p)
    const rules = eng.rules(p, m)
    const broken = rules.filter((r) => !r.ok)
    if (!broken.some((r) => r.hard)) hardOk++
    if (!broken.length) alleOk++
    for (const r of broken) {
      const e = feil.get(r.id) ?? { n: 0, hard: r.hard }
      e.n++
      feil.set(r.id, e)
    }
  }
  const pct = (v: number) => `${Math.round((100 * v) / N)} %`
  const verst = [...feil.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 5)
    .map(([id, e]) => `${id}${e.hard ? "!" : ""} ${pct(e.n)}`)
    .join(" · ")
  console.log(
    `${eng.id.padEnd(7)} harde ${pct(hardOk).padStart(5)}   alle ${pct(alleOk).padStart(5)}   ${verst}`,
  )
}
