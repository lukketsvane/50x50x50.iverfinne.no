/**
 * Prøva for den korte lenkja: #s= skal vere kort, stabil og ærleg.
 *
 *  - KORT: under 80 teikn for kvart einaste punkt, i kvar motor.
 *  - STABIL: å kode og lese eit punkt éin gong kvantiserer det til banda
 *    sine eigne steg; å gjere det ein gong til skal ikkje flytte NOKO.
 *  - ÆRLEG: ingen verdi flyttar seg meir enn eit halvt steg, og alt går
 *    gjennom motoren sin eigen clamp på vegen inn.
 *  - GAMMAL: #p=-forma (JSON) skal framleis lesast, felt for felt.
 *
 *   npx tsx scripts/hash.ts
 */
import { seeded } from "../lib/core.ts"
import { ALLE_MOTORAR as ENGINES } from "../lib/engines.ts"
import { kortHash, lesHash } from "../lib/hash.ts"

let fails = 0
const ok = (cond: boolean, what: string, detail = "") => {
  if (!cond) fails++
  console.log(`${cond ? "  ok  " : "  FEIL"} ${what}${detail ? "   " + detail : ""}`)
}

const KAST = 40

for (const eng of ENGINES) {
  console.log(`\n== ${eng.id.toUpperCase()} ==`)
  const rnd = seeded("hash-" + eng.id)
  let verste = 0
  let drift = ""
  let ustabil = ""
  for (let i = 0; i < KAST; i++) {
    const p = i === 0 ? eng.defaults : eng.random(rnd, eng.defaults, new Set())
    const h = kortHash(eng.id, p, "lag", "aho")
    if (h.length > verste) verste = h.length
    const lese = lesHash(h)
    if (!lese || lese.engine !== eng.id) {
      fails++
      console.log(`  FEIL kast ${i}: hashen let seg ikkje lese`)
      continue
    }
    const q1 = eng.clamp(lese.obj, eng.defaults)
    // ærleg: aldri meir enn eit halvt steg frå originalen
    for (const k of eng.keys) {
      const r = eng.ranges[k]
      const a = p[k] as number
      const b = q1[k] as number
      if (Math.abs(a - b) > r.step / 2 + 1e-6) drift = `${k}: ${a} → ${b}`
    }
    // stabil: andre runda flyttar ingenting
    const lese2 = lesHash(kortHash(eng.id, q1, "lag", "aho"))
    const q2 = lese2 ? eng.clamp(lese2.obj, eng.defaults) : null
    if (!q2 || eng.keys.some((k) => q1[k] !== q2[k]) || q1.material !== q2.material) {
      ustabil = ustabil || `kast ${i}`
    }
  }
  ok(verste < 80, `kort: verste lengd ${verste} teikn`)
  ok(drift === "", "ærleg: ingen verdi flytta over eit halvt steg", drift)
  ok(ustabil === "", "stabil: andre kvantiseringa flyttar ingenting", ustabil)
  // den gamle forma vert framleis lesen
  const gamal = "p=" + encodeURIComponent(JSON.stringify({ engine: eng.id, ...eng.defaults }))
  const leseGamal = lesHash(gamal)
  ok(
    leseGamal !== null &&
      leseGamal.engine === eng.id &&
      eng.keys.every((k) => eng.clamp(leseGamal.obj, eng.defaults)[k] === eng.defaults[k]),
    "gammal: #p= vert lesen felt for felt",
  )
  // overgangsforma «s=b…» frå førehandsvisinga vert framleis lesen
  const over = lesHash("s=b" + kortHash(eng.id, eng.defaults, "lag", "aho"))
  ok(over !== null && over.engine === eng.id, "overgang: s=b-forma vert lesen")
}

// søppel skal gje null, aldri kaste
console.log("\n== RUSK ==")
for (const rusk of ["s=", "s=a", "s=zz!!", "s=avZZZZ★", "p={brote", "x=42", ""]) {
  let r: unknown = "kasta"
  try {
    r = lesHash(rusk)
  } catch {
    // vert fanga av ok-linja under
  }
  ok(r === null, `rusk «${rusk}» gjev null, kastar ikkje`)
}

console.log(fails ? `\n\x1b[31m${fails} brot\x1b[0m` : "\n\x1b[32mlenkja held\x1b[0m")
process.exit(fails ? 1 : 0)
