/**
 * RIBBE — kroppen som eit band.
 *
 * Kvar einaste del i objektet er det same: eit område mellom to kurver,
 * dratt ut i ein tredje retning. Bladet er området mellom indre og ytre
 * kant, dratt ut i bladtjukna. Bandet er området mellom indre og ytre
 * ring, dratt ut i bandtjukna. Setet er området frå aksen ut til
 * setekanten, dratt ut mellom underside og skål. Skalet er området mellom
 * golv og setekant, dratt ut i skaltjukna.
 *
 * Difor står det éin nettbyggjar her og ikkje fire. Han tek ei liste av
 * stasjonar (u, a, b) og eit koordinatskifte, og gjev eit LUKKA nett med
 * samstemt orientering. To ting gjer at det held:
 *
 *   Eit sprang er ein eigen vegg. Står to stasjonar på same u med ulikt
 *   band, er skilnaden ei loddrett flate — det er slik eit spor, ei
 *   avlasting og eit hakk vert til, og det er difor ingen kant vert
 *   ståande utan motpart.
 *
 *   Vindinga kjem av rekkjefylgja og ikkje av ein normal. Normalen vert
 *   rekna av trekanten etterpå, så han kan ikkje seia noko anna enn
 *   vindinga gjer. Ein trekant med to like hjørne fell ut.
 */
import type { Vec3 } from "../core"

/** eitt snitt gjennom bandet: material for v i [a, b] ved u */
export type Station = { u: number; a: number; b: number }

/** (u, v, w) → verda. Må vera høgrehendt, elles set ein `flip`. */
export type Frame = (u: number, v: number, w: number) => Vec3

/** `k` er flate/kant-merket for det som vert lagt inn no: 0 er ei
 *  plateflate (tek beis), 1 er eit kutt (rå finér). Sjå BuildOut i core. */
export type Soup = { pos: number[]; nor: number[]; kan: number[]; k: number }

export const newSoup = (): Soup => ({ pos: [], nor: [], kan: [], k: 1 })

export type StripOpts = {
  /** lukka løkkje i u — ein ring har ingen endeflater */
  closed?: boolean
  /** koordinatskiftet er venstrehendt, snu alle trekantar */
  flip?: boolean
  /** nedre og øvre grense i w; funksjonar av (u, v) for skål og skal */
  w0: (u: number, v: number) => number
  w1: (u: number, v: number) => number
  /**
   * Sideflatene ved v = a og v = b. Byggjer ein éin kropp av fleire band
   * som ligg kant i kant — ei skål av ringar, eit skal av høgdesjikt — skal
   * flata mellom to nabo-band ikkje teiknast i det heile: to samanfallande
   * flater med kvar si retning er ikkje feil, men dei er dobbelt så mange
   * trekantar for eit skil ingen kan sjå. Vert dei båe utelatne, veks dei
   * to banda saman til éin kropp, og nettet er framleis lukka.
   */
  loSide?: boolean
  hiSide?: boolean
}

const EPS = 1e-7

function tri(s: Soup, A: Vec3, B: Vec3, C: Vec3, flip: boolean) {
  const ux = B[0] - A[0]
  const uy = B[1] - A[1]
  const uz = B[2] - A[2]
  const vx = C[0] - A[0]
  const vy = C[1] - A[1]
  const vz = C[2] - A[2]
  let nx = uy * vz - uz * vy
  let ny = uz * vx - ux * vz
  let nz = ux * vy - uy * vx
  const L = Math.hypot(nx, ny, nz)
  if (!(L > EPS)) return // degenerert: ingen flate, ingen kant
  nx /= L
  ny /= L
  nz /= L
  if (flip) {
    s.pos.push(A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2])
    s.nor.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz)
  } else {
    s.pos.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2])
    s.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz)
  }
  s.kan.push(s.k, s.k, s.k)
}

const same = (A: Vec3, B: Vec3) =>
  Math.abs(A[0] - B[0]) < 1e-6 && Math.abs(A[1] - B[1]) < 1e-6 && Math.abs(A[2] - B[2]) < 1e-6

/** Firkanten vert to trekantar. Fell eit hjørne saman med eit anna — og det
 *  gjer det i navet på setet, der heile innerkanten er eitt punkt — vert
 *  det ein trekant i staden, ikkje ein trekant med null areal. */
function quad(s: Soup, A: Vec3, B: Vec3, C: Vec3, D: Vec3, flip: boolean) {
  if (same(A, B) || same(C, D)) {
    if (!same(A, D) && !same(B, C)) tri(s, A, same(A, B) ? C : B, D, flip)
    return
  }
  tri(s, A, B, C, flip)
  tri(s, A, C, D, flip)
}

/**
 * Bygg éin lukka kropp av stasjonane.
 *
 * Rekkjefylgja i kvar firkant er valt i (u, v, w) og ikkje i verda: er
 * skiftet høgrehendt, peikar alle normalane ut av kroppen utan at nokon
 * treng å samanlikna med eit senter. Det er den einaste måten eit skal
 * med skrå vegger kan orienterast utan å gjetta.
 */
export function strip(s: Soup, st: Station[], f: Frame, o: StripOpts) {
  const n = st.length
  if (n < 2) return
  const flip = !!o.flip
  const lo = o.loSide !== false
  const hi = o.hiSide !== false
  const P = (u: number, v: number, top: boolean): Vec3 =>
    f(u, v, top ? o.w1(u, v) : o.w0(u, v))

  const last = o.closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const A = st[i]
    const Bt = st[(i + 1) % n]
    if (Math.abs(Bt.u - A.u) > EPS) {
      // topp og botn er plateFLATENE (w-retninga er tjukna) — dei tek beis
      s.k = 0
      // topp: utover er +w, altså mot klokka i (u, v)
      quad(s, P(A.u, A.a, true), P(Bt.u, Bt.a, true), P(Bt.u, Bt.b, true), P(A.u, A.b, true), flip)
      // botn: same flate, motsett veg
      quad(s, P(A.u, A.b, false), P(Bt.u, Bt.b, false), P(Bt.u, Bt.a, false), P(A.u, A.a, false), flip)
      // sidene er kutt gjennom plata — rå finér
      s.k = 1
      // sida v = b: utover er +v, altså langs +w og så +u
      if (hi) quad(s, P(A.u, A.b, false), P(A.u, A.b, true), P(Bt.u, Bt.b, true), P(Bt.u, Bt.b, false), flip)
      // sida v = a: utover er −v
      if (lo) quad(s, P(A.u, A.a, true), P(A.u, A.a, false), P(Bt.u, Bt.a, false), P(Bt.u, Bt.a, true), flip)
    } else {
      s.k = 1
      // sprang: den nedre grensa som stig, og den øvre som fell, er begge
      // material som finst før og ikkje etter — dei vender i +u
      step(s, P, A.u, A.a, Bt.a, Bt.a > A.a, flip)
      step(s, P, A.u, A.b, Bt.b, Bt.b < A.b, flip)
    }
  }

  if (!o.closed) {
    const A = st[0]
    const Z = st[n - 1]
    s.k = 1
    // enden i −u
    quad(s, P(A.u, A.a, true), P(A.u, A.b, true), P(A.u, A.b, false), P(A.u, A.a, false), flip)
    // enden i +u
    quad(s, P(Z.u, Z.a, false), P(Z.u, Z.b, false), P(Z.u, Z.b, true), P(Z.u, Z.a, true), flip)
  }
}

/**
 * Veggen i eit sprang. `plusU` seier at materialet ligg føre spranget og
 * flata difor vender i +u; elles vender ho i −u. Er dei to grensene like,
 * finst det ingen vegg, og då vert det ingen trekant.
 */
function step(
  s: Soup,
  P: (u: number, v: number, top: boolean) => Vec3,
  u: number,
  v0: number,
  v1: number,
  plusU: boolean,
  flip: boolean,
) {
  const lo = Math.min(v0, v1)
  const hi = Math.max(v0, v1)
  if (hi - lo < 1e-9) return
  if (plusU) {
    quad(s, P(u, lo, false), P(u, hi, false), P(u, hi, true), P(u, lo, true), flip)
  } else {
    quad(s, P(u, lo, true), P(u, hi, true), P(u, hi, false), P(u, lo, false), flip)
  }
}

export function soupToMesh(s: Soup): {
  positions: Float32Array
  normals: Float32Array
  kant: Float32Array
  tris: number
  min: Vec3
  max: Vec3
} {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < s.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = s.pos[i + k]
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
  }
  if (!Number.isFinite(min[0])) {
    min[0] = min[1] = min[2] = 0
    max[0] = max[1] = max[2] = 0
  }
  return {
    positions: new Float32Array(s.pos),
    kant: new Float32Array(s.kan),
    normals: new Float32Array(s.nor),
    tris: s.pos.length / 9,
    min,
    max,
  }
}
