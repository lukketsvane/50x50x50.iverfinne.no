/**
 * RIBBE — form av lasta.
 *
 * Spaken er BLADTJUKNA, og målet er eit TAK og ikkje eit mål: tynnaste
 * lovlege blad som held seg under 60 % av kapasiteten. I denne
 * typologien er ikkje utnyttinga monoton i tjukna — slissene og ledda
 * har eigne meiningar, og vevbreiddene skifter med kva spora et — so
 * det einaste ærlege er å gå ned steg for steg med den verkelege kjeda
 * som dommar. Kvart steg sparer materiale; taket og dei harde reglane
 * seier når det er nok.
 */
import { makeShell } from "./shell"
import { buildAll, DETAIL } from "./mesh"
import { lastVerste } from "./last"
import { measure } from "./metrics"
import { checkRules } from "./rules"
import { PARAM_RANGES, clampParams, type Params } from "./params"

const MAAL = 0.6

function harde(p: Params): number {
  return checkRules(p, measure(p)).filter((q) => q.hard && !q.ok).length
}

export function lastForm(p: Params): Params {
  // GRÅDIG TYNNING, ikkje halvering: ved endane av bandet sprengjer
  // slisse- og leddgeometrien modellen (eit blad på åtte millimeter kan
  // vera skore sund av spora sine), so ei halvering som les endane fyrst
  // navigerer etter to galne fyrtårn. I staden går tjukna NED steg for
  // steg frå der ho står — kvart steg målt med den verkelege kjeda — og
  // stoggar på det siste steget som held seg under målet og ikkje bryt
  // fleire harde reglar enn utgangspunktet. Kvart steg sparer materiale;
  // ingen steg vert teke på veg mot verre.
  const r = PARAM_RANGES.bladeT
  const utnytt = (q: Params) => {
    const sh = makeShell(q)
    return lastVerste(sh, buildAll(q, DETAIL.lav, sh), q).util
  }
  const tak = harde(p)

  let beste = clampParams({ ...p }, p)
  let t = beste.bladeT
  for (let i = 0; i < 32 && t - r.step >= r.min; i++) {
    const t2 = +(t - r.step).toFixed(4)
    const q = clampParams({ ...p, bladeT: t2 }, p)
    const u = utnytt(q)
    if (u > MAAL || !Number.isFinite(u)) break
    if (harde(q) > tak) break
    beste = q
    t = t2
  }
  return beste
}
