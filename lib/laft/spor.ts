/**
 * SPOR SOM VERT REKNA, IKKJE TEIKNA.
 *
 * Eit spor i ei plate er ikkje ein rektangel ein skriv opp. Det er
 * SKUGGEN av den delen som skal gjennom, kasta ned i plata sitt plan og
 * sveipa gjennom heile tjukna hennar.
 *
 * Skilnaden er ikkje akademisk. Ei plate som lener seg femten grader og
 * går gjennom eit sete på femten millimeter, flytter seg femten gonger
 * tangens femten — fire millimeter — sidelengs medan ho passerer. Eit
 * spor rekna som «platetjukna pluss klaring» er då fire millimeter for
 * smalt, og dei fire millimetrane er materiale som må vera to stader
 * samstundes. På skjermen ser det heilt fint ut; i verkstaden går ikkje
 * delen ned.
 *
 * Difor tek desse funksjonane GJESTEN som argument og reknar sporet av
 * han. Då kan ingen lening, ingen vipp og ingen vridning koma på tvers
 * seinare: endrar gjesten seg, endrar sporet seg med.
 */
import type { Pt, Vec3 } from "../core"

/** Plasseringa av ei plate: origo og to aksar i planet, tjukna langs n. */
export type Plass = { o: Vec3; u: Vec3; v: Vec3; n: Vec3 }

export const tilVerda = (p: Plass, q: Pt, w: number): Vec3 => [
  p.o[0] + p.u[0] * q[0] + p.v[0] * q[1] + p.n[0] * w,
  p.o[1] + p.u[1] * q[0] + p.v[1] * q[1] + p.n[1] * w,
  p.o[2] + p.u[2] * q[0] + p.v[2] * q[1] + p.n[2] * w,
]

/** frå verda inn i eit plan: (u, v) i planet og w langs normalen */
export function tilPlan(p: Plass, w: Vec3): [number, number, number] {
  const d: Vec3 = [w[0] - p.o[0], w[1] - p.o[1], w[2] - p.o[2]]
  const pr = (a: Vec3) => d[0] * a[0] + d[1] * a[1] + d[2] * a[2]
  return [pr(p.u), pr(p.v), pr(p.n)]
}

/** ein gjest er alt som skal gjennom noko anna: eit omriss i eit plan */
export type Gjest = { plass: Plass; outline: Pt[]; t: number }

/** rektangel som ring, mot klokka */
export function rekt(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

/**
 * Sporet klart til bruk, og det ligg LANGS LEDDET.
 *
 * Ein akseparallell boks kring ein tapp som står på skrå er ikkje eit
 * spor — han er ein luke. Ein tapp på åttifem millimeter og femten
 * tjukk, sett inn i eit sete i trettini grader, får ein akseparallell
 * boks på syttifem gonger sekstifem: fem gonger så mykje plate borte
 * som leddet treng, midt i den flata ein sit på.
 *
 * Difor vert skuggen målt i ei ramme som ligg langs SKJERINGSLINA mellom
 * dei to plana — den einaste retninga som er naturleg for eit ledd
 * mellom to plater — og sporet vert eit smalt rektangel på skrå, slik
 * det ville vore om nokon teikna det for hand.
 *
 * Klaringa er DIAMETER, ikkje radius: `pressfit` 0,2 tyder eit spor som
 * er to tiendedelar breiare enn delen, altså ei tidels klaring på kvar
 * kant. Det er ein pressfit i finér, og det er med vilje — eit flatpakka
 * møbel utan lim held av friksjon.
 */
export function sporRing(
  vert: Plass,
  tVert: number,
  gjest: Gjest,
  klaring: number,
  berre?: (q: Pt) => boolean,
): Pt[] | null {
  // skjeringslina mellom dei to plana, sett i verten sitt plan
  const n1 = vert.n
  const n2 = gjest.plass.n
  const d: Vec3 = [
    n1[1] * n2[2] - n1[2] * n2[1],
    n1[2] * n2[0] - n1[0] * n2[2],
    n1[0] * n2[1] - n1[1] * n2[0],
  ]
  const du = d[0] * vert.u[0] + d[1] * vert.u[1] + d[2] * vert.u[2]
  const dv = d[0] * vert.v[0] + d[1] * vert.v[1] + d[2] * vert.v[2]
  const L = Math.hypot(du, dv)
  // parallelle plan har inga skjeringsline: då er akseramma like god
  const co = L > 1e-6 ? du / L : 1
  const si = L > 1e-6 ? dv / L : 0

  let a0 = Infinity
  let b0 = Infinity
  let a1 = -Infinity
  let b1 = -Infinity
  const NK = 24
  const NT = 12
  const ring = gjest.outline
  for (let i = 0; i < ring.length; i++) {
    const p0 = ring[i]
    const p1 = ring[(i + 1) % ring.length]
    for (let s2 = 0; s2 <= NK; s2++) {
      const q: Pt = [
        p0[0] + ((p1[0] - p0[0]) * s2) / NK,
        p0[1] + ((p1[1] - p0[1]) * s2) / NK,
      ]
      if (berre && !berre(q)) continue
      for (let k = 0; k <= NT; k++) {
        const [u, v, w] = tilPlan(vert, tilVerda(gjest.plass, q, (gjest.t * k) / NT))
        if (w < -1e-6 || w > tVert + 1e-6) continue
        const a = u * co + v * si
        const b = -u * si + v * co
        if (a < a0) a0 = a
        if (a > a1) a1 = a
        if (b < b0) b0 = b
        if (b > b1) b1 = b
      }
    }
  }
  if (!Number.isFinite(a0)) return null
  const k = klaring / 2
  return [
    [a0 - k, b0 - k],
    [a1 + k, b0 - k],
    [a1 + k, b1 + k],
    [a0 - k, b1 + k],
  ].map(([a, b]) => [a * co - b * si, a * si + b * co] as Pt)
}
