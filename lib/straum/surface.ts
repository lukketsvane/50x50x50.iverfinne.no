/**
 * STRAUM — den freste flata.
 *
 * Dette er objektet slik det står ferdig: éin kropp, med salen frest ned i
 * toppen og setekanten rundt av, og med tomrommet inni som ei lukka hole.
 * Ingen skiver, ingen fuger — skiveinndelinga er ein måte å byggje det på,
 * ikkje ein eigenskap ved forma.
 *
 * Nettet er lukka og samstemt orientert, og det er ikkje pynt: massen og
 * tyngdepunktet vert rekna med divergenssetninga over nettopp desse
 * trekantane. Ei einaste kant utan motpart gjer volumet til eit tal utan
 * meining. Difor er hola bygd som ei eiga lukka flate med normalane snudd
 * innover — då trekkjer ho seg sjølv frå volumet, utan eit einaste
 * boolsk steg.
 */
import type { MeshData, Vec3 } from "../core"
import { makeBody, type Body } from "./body"
import { Soup } from "./mesh"
import type { Params } from "./params"

const TAU = Math.PI * 2

export type Detail = { nth: number; nv: number; nq: number; nz: number }

export const DETAIL: Record<"lav" | "mid" | "hog", Detail> = {
  lav: { nth: 132, nv: 44, nq: 9, nz: 16 },
  mid: { nth: 216, nv: 72, nq: 14, nz: 26 },
  hog: { nth: 340, nv: 116, nq: 22, nz: 40 },
}

export function buildMesh(p: Params, d: Detail, body?: Body): MeshData {
  const b = body ?? makeBody(p)
  const s = new Soup()
  const th = (i: number) => ((i % d.nth) / d.nth) * TAU

  // --- ytterflata ---------------------------------------------------------
  const top: number[] = []
  for (let i = 0; i < d.nth; i++) top.push(b.zTop(th(i)))
  const P: Vec3[][] = []
  const N: Vec3[][] = []
  for (let i = 0; i < d.nth; i++) {
    const col: Vec3[] = []
    const nol: Vec3[] = []
    for (let j = 0; j <= d.nv; j++) {
      const z = (top[i] * j) / d.nv
      col.push(b.outer(th(i), z))
      nol.push(b.normal(th(i), z))
    }
    P.push(col)
    N.push(nol)
  }
  for (let i = 0; i < d.nth; i++) {
    const i2 = (i + 1) % d.nth
    for (let j = 0; j < d.nv; j++) {
      s.triN(P[i][j], P[i2][j], P[i2][j + 1], N[i][j], N[i2][j], N[i2][j + 1])
      s.triN(P[i][j], P[i2][j + 1], P[i][j + 1], N[i][j], N[i2][j + 1], N[i][j + 1])
    }
  }

  // --- golvet -------------------------------------------------------------
  const c0 = b.ctr(0)
  const foot: Vec3 = [c0[0], c0[1], 0]
  const dn: Vec3 = [0, 0, -1]
  for (let i = 0; i < d.nth; i++) {
    const i2 = (i + 1) % d.nth
    s.triN(foot, P[i2][0], P[i][0], dn, dn, dn)
  }

  // --- salen --------------------------------------------------------------
  // Kvar stråle går frå setesenteret ut til det same ytterpunktet som
  // ytterflata sluttar i. Punktet er ikkje rekna på nytt, det er det same
  // — to punkt som er «like» på tiandeplassen er to punkt, og då er det
  // ei sprekk i nettet.
  const cs = b.ctr(b.H)
  const rim = P.map((col) => col[d.nv])
  const grad = (x: number, y: number): Vec3 => {
    const h = 0.6
    const gx = (b.seatTop(x + h, y) - b.seatTop(x - h, y)) / (2 * h)
    const gy = (b.seatTop(x, y + h) - b.seatTop(x, y - h)) / (2 * h)
    const L = Math.hypot(gx, gy, 1)
    return [-gx / L, -gy / L, 1 / L]
  }
  const seatPt = (i: number, q: number): Vec3 => {
    if (q >= 1) return rim[i]
    const x = cs[0] + q * (rim[i][0] - cs[0])
    const y = cs[1] + q * (rim[i][1] - cs[1])
    return [x, y, b.seatTop(x, y)]
  }
  const apex: Vec3 = [cs[0], cs[1], b.seatTop(cs[0], cs[1])]
  const aN = grad(cs[0], cs[1])
  for (let i = 0; i < d.nth; i++) {
    const i2 = (i + 1) % d.nth
    for (let k = 0; k < d.nq; k++) {
      const q0 = 1 - k / d.nq
      const q1 = 1 - (k + 1) / d.nq
      const A = seatPt(i, q0)
      const B = seatPt(i2, q0)
      const C = seatPt(i2, q1)
      const D = seatPt(i, q1)
      const nA = grad(A[0], A[1])
      const nB = grad(B[0], B[1])
      if (k === d.nq - 1) {
        s.triN(A, B, apex, nA, nB, aN)
      } else {
        s.triN(A, B, C, nA, nB, grad(C[0], C[1]))
        s.triN(A, C, D, nA, grad(C[0], C[1]), grad(D[0], D[1]))
      }
    }
  }

  // --- tomrommet ----------------------------------------------------------
  // Ei lukka hole inne i godset, med normalane inn mot hola. Volumet av
  // henne kjem då ut negativt av divergenssetninga, og massen vert rett
  // utan at nokon har rekna henne to gonger.
  const z0 = b.voidZ0
  const z1 = b.voidZ1
  if (z1 - z0 > 4) {
    const M = d.nz
    const V: Vec3[][] = []
    for (let i = 0; i < d.nth; i++) {
      const col: Vec3[] = []
      for (let j = 1; j < M; j++) {
        const z = z0 + ((z1 - z0) * j) / M
        const c = b.ctr(z)
        const r = b.ri(th(i), z)
        col.push([c[0] + r * Math.cos(th(i)), c[1] + r * Math.sin(th(i)), z])
      }
      V.push(col)
    }
    const cLo = b.ctr(z0)
    const cHi = b.ctr(z1)
    const tipLo: Vec3 = [cLo[0], cLo[1], z0]
    const tipHi: Vec3 = [cHi[0], cHi[1], z1]
    for (let i = 0; i < d.nth; i++) {
      const i2 = (i + 1) % d.nth
      s.tri(tipLo, V[i][0], V[i2][0])
      for (let j = 0; j + 1 < M - 1; j++) {
        s.tri(V[i][j], V[i][j + 1], V[i2][j + 1])
        s.tri(V[i][j], V[i2][j + 1], V[i2][j])
      }
      s.tri(tipHi, V[i2][M - 2], V[i][M - 2])
    }
  }

  return s.done()
}
