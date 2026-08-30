/**
 * SKIVE — form av lasta.
 *
 * Spaken er BOGEN: kvar millimeter opning under setet er gods som ikkje
 * vert kjøpt, og spørsmålet «kor høg kan bogen vera?» har svaret sitt i
 * lastmodellen — so høg at det verste punktet i setebandet landar på
 * målet. Same funksjonen som måler (tavla) og fargar (kartet) løyser;
 * halvering på bogehøgda med den verkelege kjeda i kvart steg, og ærleg
 * retrett om ein boge som når målet bryt ei hard regel på vegen. Målet
 * er 60 % av kapasiteten, av same grunn som i vaffel: modellen er eit
 * overslag, og eit møbel dimensjonert til randa av eit overslag er eit
 * møbel utan feilmargin.
 */
import { buildSlices } from "./profile"
import { lastVerste } from "./last"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { PARAM_RANGES, clampParams, type Params } from "./params"

const MAAL = 0.6

function harde(p: Params): number {
  return checkRules(p, measure(p)).filter((q) => q.hard && !q.ok).length
}

export function lastForm(p: Params): Params {
  const r = PARAM_RANGES.bogeH
  const utnytt = (h: number) => {
    const q = clampParams({ ...p, bogeH: +h.toFixed(4) }, p)
    return lastVerste(q, buildSlices(q)).util
  }

  let lo = r.min
  let hi = r.max
  const uLo = utnytt(lo)
  const uHi = utnytt(hi)

  let h: number
  if (MAAL <= Math.min(uLo, uHi)) {
    h = uLo <= uHi ? lo : hi
  } else if (MAAL >= Math.max(uLo, uHi)) {
    h = uLo >= uHi ? lo : hi
  } else {
    const stig = uHi >= uLo
    for (let i = 0; i < 11; i++) {
      const m = (lo + hi) / 2
      if ((utnytt(m) < MAAL) === stig) lo = m
      else hi = m
    }
    h = (lo + hi) / 2
  }

  const tak = harde(p)
  let ut = clampParams({ ...p, bogeH: h }, p)
  for (let i = 0; i < 8 && harde(ut) > tak && h > r.min; i++) {
    h -= (r.max - r.min) * 0.04
    ut = clampParams({ ...p, bogeH: Math.max(r.min, h) }, p)
  }
  return ut
}
