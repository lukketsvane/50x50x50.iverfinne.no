/**
 * VIKING — kva som ber, og kvar det ryk.
 *
 * Lastvegen er kort og heilt annleis enn i dei andre motorane, og det er
 * typologien sitt eige argument: du sit ikkje på kanten av ei plate, du
 * sit på FLATA hennar. Ei plateflate i bøying er eit heilt anna problem
 * enn ein plateKANT i trykk.
 *
 *   1  Kroppen kviler på dei borda som ligg flatt nok til å sitje på.
 *      Lasta fordeler seg mellom dei etter areal.
 *   2  Kvart bord er ei PLATE I BØYING mellom dei to spanta. Spennet er
 *      avstanden mellom dei, og tverrsnittet er bordbreidda gonger
 *      platetjukna. Det er dette leddet som ryk fyrst, og det er difor
 *      `spantY` er ein styrkeparameter og ikkje ein plasseringsparameter.
 *   3  Utanfor spanta krager bordet ut. Kraget er kort og lasta der er
 *      liten, men han vert rekna med: eit bord som stikk hundre
 *      millimeter forbi spantet med ein kropp på seg bøyer seg synleg.
 *   4  Spanta tek det heile ned i golvet i trykk og bøying.
 *
 * Bøyespenninga i ei fritt opplagd plate med jamt fordelt last:
 *
 *      M = w·L² / 8        σ = M / Z        Z = b·t² / 6
 *
 * der L er spennet mellom spanta, b er bordbreidda langs skroget og t er
 * platetjukna. Det er ei konservativ tilnærming — i røynda hjelper
 * naboborda gjennom lappen, og skalet verkar som ei folda plate — men
 * hjelpa kjem av eit ledd som er nagla og ikkje limt, og då skal ho ikkje
 * reknast med.
 */
import { SEAT_LOAD, capacities } from "../core"
import { byggDelar, delAreal } from "./parts"
import { materialet, type Params } from "./params"

export type Verste = {
  sc: number
  sm: number
  util: number
  A: number
  z: number
}

export type Modell = {
  verste: Verste
  /** utnyttinga i eit bord, gjeve avstanden frå midten langs y */
  bord(dy: number): number
  capC: number
  capM: number
}

export function lastModell(p: Params): Modell {
  const { sk, delar } = byggDelar(p)
  const { capC, capM } = capacities(materialet(p))
  const t = p.plyT
  const spenn = 2 * sk.spantY

  // dei borda ein faktisk sit på
  const sete = delar.filter((d) => {
    if (d.kind !== "bord") return false
    const helling = (Math.acos(Math.min(1, Math.abs(d.plass.n[2]))) * 180) / Math.PI
    return helling <= 40
  })
  const areal = sete.reduce((s, d) => s + delAreal(d), 0)

  let verste: Verste = { sc: 0, sm: 0, util: 0, A: 0, z: 0 }
  for (const d of sete) {
    const A = delAreal(d)
    if (A <= 0) continue
    // delen av lasta dette bordet tek
    const P = SEAT_LOAD * (areal > 0 ? A / areal : 1)
    // bordbreidda langs skroget: arealet delt på breidda på tvers
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
    for (const [u, v] of d.outline) {
      if (u < u0) u0 = u
      if (u > u1) u1 = u
      if (v < v0) v0 = v
      if (v > v1) v1 = v
    }
    const b = Math.max(1, u1 - u0)
    const breidd = Math.max(1, v1 - v0)
    // jamt fordelt over spennet mellom spanta
    const w = P / Math.max(1, breidd)
    const M = (w * spenn * spenn) / 8
    const Z = (b * t * t) / 6
    const sm = Z > 0 ? M / Z : 0
    // trykket i bordet er lite — det er bøyinga som styrer — men
    // kragetrykket mot spantkanten vert rekna med
    const sc = P / Math.max(1, b * t)
    const util = Math.max(sm / capM, sc / capC)
    if (util > verste.util) verste = { sc, sm, util, A: b * t, z: sk.sitZ }
  }

  return {
    verste,
    bord: (dy: number) => {
      // parabolsk over spennet: null ved spanta, maks på midten
      const q = Math.min(1, Math.abs(dy) / Math.max(1, sk.spantY))
      return verste.util * (1 - q * q)
    },
    capC,
    capM,
  }
}

export const lastVerste = (p: Params): Verste => lastModell(p).verste

/**
 * Lastkartet på nettet: kvart hjørne får utnyttinga der det står. Karta i
 * dei andre motorane fargar ei krum flate; her fargar han dei borda ein
 * sit på, og han er null på spanta — som er rett, for der er bordet lagt
 * opp og bøyer seg ikkje.
 */
export function feltPaMesh(p: Params, positions: Float32Array): Float32Array {
  const m = lastModell(p)
  const ut = new Float32Array(positions.length / 3)
  for (let i = 0, k = 0; i < positions.length; i += 3, k++) {
    ut[k] = m.bord(positions[i + 1])
  }
  return ut
}
