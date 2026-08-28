/**
 * LAFT — form av lasta.
 *
 * Spaken er KRYSSET si breidd, og målet er ikkje eit tak: det er ei
 * BALANSE. Skyv føtene utover, og setet må bere lenger ut til hjørnet
 * mellom to armar (M = P·a); skyv dei innover, og armane held opp mindre
 * av plata, so berebreidda fell. Dei to dreg kvar sin veg, og det finst
 * nøyaktig éi breidd der dei er like store — det punktet er så lite
 * plate som setet nokon gong kan koma unna med, og modellen kan rekne
 * seg fram til det.
 *
 * Difor formar denne knappen annleis enn i dei andre motorane: der
 * tynnar han til han når seksti prosent, her går han til BOTNEN av
 * kurva. Å stoppe på eit tal ville vore å velje ein dårlegare stol med
 * vilje.
 */
import { bygg } from "./profil"
import { lastVerste } from "./last"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { PARAM_RANGES, clampParams, type Params } from "./params"

function harde(p: Params): number {
  return checkRules(p, measure(p)).filter((q) => q.hard && !q.ok).length
}

export function lastForm(p: Params): Params {
  const r = PARAM_RANGES.fotY
  const utnytt = (s: number) => {
    const q = clampParams({ ...p, fotY: +s.toFixed(3) }, p)
    return lastVerste(bygg(q)).util
  }

  // gyllent snitt: kurva har éin botn, so det held å klemme intervallet
  const gr = (Math.sqrt(5) - 1) / 2
  let lo = r.min
  let hi = r.max
  let c = hi - gr * (hi - lo)
  let d = lo + gr * (hi - lo)
  let fc = utnytt(c)
  let fd = utnytt(d)
  for (let i = 0; i < 24 && hi - lo > r.step; i++) {
    if (fc < fd) {
      hi = d
      d = c
      fd = fc
      c = hi - gr * (hi - lo)
      fc = utnytt(c)
    } else {
      lo = c
      c = d
      fc = fd
      d = lo + gr * (hi - lo)
      fd = utnytt(d)
    }
  }
  let s = (lo + hi) / 2

  // ærleg retrett: eit fotY som balanserer lasta, men bryt ein hard
  // regel den førre satsen heldt, er ikkje ei betring
  const tak = harde(p)
  let ut = clampParams({ ...p, fotY: s }, p)
  for (let i = 0; i < 10 && harde(ut) > tak; i++) {
    s += (p.fotY - s) * 0.3
    ut = clampParams({ ...p, fotY: s }, p)
  }
  return ut
}
