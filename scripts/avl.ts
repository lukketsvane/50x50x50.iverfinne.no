/**
 * Avlen frå kommandolina: tåle mest mogleg, bruke minst mogleg materiale.
 *
 *   npx tsx scripts/avl.ts              alle motorane, 160 steg
 *   npx tsx scripts/avl.ts vaffel       berre éin
 *   npx tsx scripts/avl.ts vaffel 400   fleire steg
 *   npx tsx scripts/avl.ts vaffel 400 mittfrø
 *
 * Utskrifta er rekneskapen: kva standardobjektet kostar i plate, kva det
 * avla objektet kostar, kva band som flytte seg — og lenkja som opnar
 * resultatet i sandkassen, så ingen treng ta ordet for det.
 */
import { ENGINES } from "../lib/engines.ts"
import { avl, lenkje } from "../lib/avl.ts"
import { nn } from "../lib/core.ts"

const berre = process.argv[2]
const steg = Number(process.argv[3]) || 160
const frø = process.argv[4]

const list = berre ? ENGINES.filter((e) => e.id === berre) : ENGINES
if (!list.length) {
  console.error(`ukjend motor: ${berre}`)
  process.exit(2)
}

for (const eng of list) {
  console.log(`\n== ${eng.id.toUpperCase()} · ${steg} steg ==`)
  const t0 = performance.now()
  const res = avl(eng, eng.defaults, {
    steg,
    frø: frø ? `${frø}-${eng.id}` : undefined,
    påBetre: (i, s) => {
      console.log(
        `  steg ${String(i).padStart(3)}: ${nn(s.matInn, 1)} dm³ plate · ` +
          `${nn(s.mass, 2)} kg ferdig · utnytting ${nn(s.sheetUtil * 100, 0)} % ark / ` +
          `${nn(s.util * 100, 0)} % styrke${s.mjuke ? ` · ${s.mjuke} mjuke brot` : ""}`,
      )
    },
  })
  const tid = (performance.now() - t0) / 1000

  const a = res.start
  const b = res.beste
  console.log(`  --`)
  console.log(
    `  start: ${nn(a.matInn, 1)} dm³ plate · ${nn(a.plateM2, 2)} m² · ` +
      `${nn(a.mass, 2)} kg · ark ${nn(a.sheetUtil * 100, 0)} % · styrke ${nn(a.util * 100, 0)} %`,
  )
  console.log(
    `  avla:  ${nn(b.matInn, 1)} dm³ plate · ${nn(b.plateM2, 2)} m² · ` +
      `${nn(b.mass, 2)} kg · ark ${nn(b.sheetUtil * 100, 0)} % · styrke ${nn(b.util * 100, 0)} %` +
      ` · ${b.harde} harde / ${b.mjuke} mjuke brot`,
  )
  const spart = a.matInn > 0 ? 1 - b.matInn / a.matInn : 0
  console.log(`  spart: ${nn(spart * 100, 0)} % av plata · ${nn(tid, 0)} s søk`)

  // banda som flytte seg, med retning — det er dei som er argumentet
  const flytt = eng.keys
    .filter((k) => a.p[k] !== b.p[k])
    .map((k) => {
      const u = a.p[k]
      const v = b.p[k]
      if (typeof u === "number" && typeof v === "number") {
        return `${k} ${nn(u, 1)}→${nn(v, 1)}`
      }
      return `${k} ${String(u)}→${String(v)}`
    })
  if (flytt.length) console.log(`  band:  ${flytt.join(" · ")}`)
  console.log(`  ${lenkje(eng.id, b.p)}`)
}
