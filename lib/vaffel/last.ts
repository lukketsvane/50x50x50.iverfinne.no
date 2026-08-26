/**
 * VAFFEL — lasta, målt PÅ flata.
 *
 * Utnyttinga i tavla er eitt tal: det verste punktet. Dette er same
 * rekninga evaluert LANGS kvar ribbe og over høgda, so ho kan målast på
 * sjølve nettet som eit lastkart. Modellen er identisk med `measure` sin:
 *
 *   bøying   bandet over kvelvinga som fritt opplagd bjelke med punktlast
 *            midt i: M(t) veks lineært frå beina inn mot midten, og
 *            motstanden W = t·d(t)²/6 les djupna av geometrien — setflata
 *            minus bogen minus sporet, i nøyaktig det punktet.
 *   fiber    bøyespenninga er null i nøytralaksen og størst i ytterkant:
 *            faktoren |2(z − midt)/d| legg henne der ho faktisk er.
 *   trykk    beinet under bogen ber sin halvdel av ribbelasta rett ned.
 *
 * Same last (1600 N etter NS-EN 1728, delt på fire ribber), same
 * kapasitetar (NS-EN 1995-1-1). Verdien 1,0 ER kapasiteten — kartet og
 * tavla kan ikkje seie kvar sitt. Ei ribbe som ikkje når golvet sjølv
 * spenner mellom dei ytste kryssa sine i staden for å falle ut av
 * rekninga. Det kartet IKKJE er: elementmetode. Ingen samverknad utover
 * kryssoverføringa, inga skiveverknad i rutenettet — det er eit overslag,
 * og det seier det sjølv.
 */
import { SEAT_LOAD, capacities, type Material } from "../core"
import type { Grid, Rib } from "./ribs"
import { runsOnRib } from "./metrics"

/** same lastdeling som i measure: to ribber per familie under puta */
const NRIB = 2

type RibFelt = {
  legL: number
  legR: number
  /** trykkutnyttinga i beinet, konstant */
  uc: number
  /** sampla over bandet: botn (bogen), topp (setet) og bøyeutnyttinga */
  z0: number[]
  z1: number[]
  um: number[]
}

const N = 48

export type LastFelt = { at(r: Rib, t: number, z: number): number }

export function lastFelt(g: Grid): LastFelt {
  const p = g.b.p
  const cap = capacities(p.material as Material)
  const nLoad = SEAT_LOAD / (2 * NRIB)
  const felt = new Map<Rib, RibFelt | null>()

  const build = (r: Rib): RibFelt | null => {
    const foot = runsOnRib(r, 1.2)
    let legL: number
    let legR: number
    let uc: number
    if (foot.length >= 2) {
      legL = (foot[0][0] + foot[0][1]) / 2
      legR = (foot[foot.length - 1][0] + foot[foot.length - 1][1]) / 2
      const legW = Math.min(
        foot[0][1] - foot[0][0],
        foot[foot.length - 1][1] - foot[foot.length - 1][0],
      )
      uc = nLoad / 2 / Math.max(1, legW * p.ribbT) / cap.capC
    } else {
      // Ribba når ikkje golvet sjølv — bogen har lyfta henne. Ho ber
      // likevel: lasta går ut i kryssa og ned dei kryssande ribbene, so
      // overslaget lèt henne spenne mellom dei YTSTE kryssa sine. Utan
      // bein er trykkleddet null. Før returnerte desse ribbene null, og
      // då stod halve nettet med eksakt 0 i kartet — som om dei indre
      // ribbene ikkje fanst for lasta i det heile.
      if (r.slots.length < 2) return null
      let lo = Infinity
      let hi = -Infinity
      for (const q of r.slots) {
        if (q.t < lo) lo = q.t
        if (q.t > hi) hi = q.t
      }
      legL = lo
      legR = hi
      uc = 0
    }
    const span = legR - legL
    if (span < 1) return null

    const z0: number[] = []
    const z1: number[] = []
    const um: number[] = []
    for (let i = 0; i <= N; i++) {
      const t = legL + (i / N) * span
      const w: [number, number] = r.axis === "x" ? [r.pos, t] : [t, r.pos]
      const top = g.b.seatSurf(w[0], w[1])
      const arc = g.b.arch(w[0], w[1])
      let cut = 0
      for (const q of r.slots) {
        if (Math.abs(q.t - t) > q.w / 2) continue
        cut = Math.max(cut, Math.abs(q.zMouth - q.zEnd))
      }
      const d = Math.max(1, top - arc - cut)
      const W = (p.ribbT * d * d) / 6
      const M = (nLoad / 2) * Math.min(t - legL, legR - t)
      z0.push(arc)
      z1.push(top)
      um.push(M / W / cap.capM)
    }
    return { legL, legR, uc, z0, z1, um }
  }

  return {
    at(r: Rib, t: number, z: number): number {
      let f = felt.get(r)
      if (f === undefined) {
        f = build(r)
        felt.set(r, f)
      }
      if (!f) return 0
      // utanfor bandet, eller under bogen: beinet, reint trykk
      if (t <= f.legL || t >= f.legR) return f.uc
      const s = ((t - f.legL) / (f.legR - f.legL)) * N
      const i = Math.min(N - 1, Math.floor(s))
      const a = s - i
      const bot = f.z0[i] * (1 - a) + f.z0[i + 1] * a
      const top = f.z1[i] * (1 - a) + f.z1[i + 1] * a
      if (z < bot) return f.uc
      const d = Math.max(1, top - bot)
      // fiberen: null i nøytralaksen, full i ytterkant
      const fiber = Math.min(1, Math.abs((2 * (z - (bot + top) / 2)) / d))
      const um = f.um[i] * (1 - a) + f.um[i + 1] * a
      return f.uc + fiber * um
    },
  }
}

/**
 * Feltet lagt på nettet: éin utnyttingsverdi per hjørne, 1,0 = kapasitet.
 * Kvart hjørne høyrer til plata si — i eit kryss ber begge, og då gjeld
 * den verste.
 */
export function feltPaMesh(
  g: Grid,
  positions: Float32Array,
): Float32Array {
  const f = lastFelt(g)
  const ht = g.b.p.ribbT / 2 + 0.5
  const nv = positions.length / 3
  const out = new Float32Array(nv)
  for (let i = 0; i < nv; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    let u = 0
    for (const r of g.ribs) {
      const d = r.axis === "x" ? x - r.pos : y - r.pos
      if (d > ht || d < -ht) continue
      const t = r.axis === "x" ? y : x
      const v = f.at(r, t, z)
      if (v > u) u = v
    }
    out[i] = u
  }
  return out
}
