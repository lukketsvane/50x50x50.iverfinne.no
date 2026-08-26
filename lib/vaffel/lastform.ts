/**
 * VAFFEL — form av lasta.
 *
 * Sirkelen sluttar her: same funksjonen som MÅLER utnyttinga (tavla) og
 * FARGAR henne (kartet) får no FORME. Bogen er materialfjerninga i denne
 * typologien — kvar millimeter kvelving er gods som ikkje vert kjøpt — og
 * spørsmålet «kor høg kan bogen vera?» har eit svar i lastmodellen, ikkje
 * i magekjensla: so høg at det verste punktet landar på målet.
 *
 * Målet er 60 % av kapasiteten. Ikkje 100: modellen er eit overslag og
 * seier det sjølv, lasta i NS-EN 1728 er kontraktnivået og ikkje taket,
 * og eit møbel dimensjonert til randa av eit overslag er eit møbel utan
 * feilmargin. 60 er der materialet arbeider utan å skjelve.
 *
 * Løysinga er halvering på bogehøgda med den VERKELEGE modellen i kvart
 * steg — makeBody → buildGrid → lastVerste, same kjede som tavla — so
 * talet du får ER talet tavla viser etterpå. Rekk ikkje bogen målet
 * innanfor bandet sitt, stoggar han ærleg på enden som kjem nærast.
 */
import { makeBody } from "./body"
import { buildGrid } from "./ribs"
import { lastVerste } from "./last"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { PARAM_RANGES, clampParams, type Params } from "./params"

/** harde brot i eit punkt — det einaste reglane vert spurde om her */
function harde(p: Params): number {
  return checkRules(p, measure(p)).filter((q) => q.hard && !q.ok).length
}

/** målet: det verste punktet skal arbeide på 60 % av kapasiteten */
const MAAL = 0.6

export function lastForm(p: Params): Params {
  const r = PARAM_RANGES.bogeH
  const utnytt = (h: number) =>
    lastVerste(buildGrid(makeBody(clampParams({ ...p, bogeH: +h.toFixed(4) }, p)))).util

  let lo = r.min
  let hi = r.max
  const uLo = utnytt(lo)
  const uHi = utnytt(hi)

  let h: number
  if (MAAL <= Math.min(uLo, uHi)) {
    // sjølv den lågaste bogen arbeider over målet: ta den snillaste enden
    h = uLo <= uHi ? lo : hi
  } else if (MAAL >= Math.max(uLo, uHi)) {
    // ikkje eingong full boge når målet: ta enden som kjem nærast
    h = uLo >= uHi ? lo : hi
  } else {
    // Halvering. Utnyttinga veks (som regel) med bogehøgda — tynnare band
    // over kvelvinga — men retninga vert lesen av endane i staden for å
    // takast for gjeve: spora og føtene kan snu henne lokalt.
    const stig = uHi >= uLo
    for (let i = 0; i < 11; i++) {
      const m = (lo + hi) / 2
      if ((utnytt(m) < MAAL) === stig) lo = m
      else hi = m
    }
    h = (lo + hi) / 2
  }

  // Ærleg retrett: ein boge som når målet, men skjer ei ribbe eller bryt
  // ei anna hard regel på vegen, er ikkje eit svar — det er eit nytt
  // problem. Senk høgda til punktet held minst like godt som
  // utgangspunktet gjorde; reglar som var brotne FØR knappen, er ikkje
  // knappen sitt ansvar å løyse.
  const tak = harde(p)
  let ut = clampParams({ ...p, bogeH: h }, p)
  for (let i = 0; i < 8 && harde(ut) > tak && h > r.min; i++) {
    h -= (r.max - r.min) * 0.04
    ut = clampParams({ ...p, bogeH: Math.max(r.min, h) }, p)
  }
  return ut
}
