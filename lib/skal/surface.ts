/**
 * SANDKASSE — flata.
 *
 * Skalet er eitt rutenett over (vinkel, høgd). Opningane er ikkje hòl som
 * vert skorne etterpå: kvar rute vert klipt mot feltet der det er lik éin,
 * så kanten av ei opning ligg der likninga seier, ikkje der rutenettet
 * tilfeldigvis har eit punkt. Difor kan ein skru på ei opning utan at
 * kanten hakkar.
 *
 * Objektet er to lukka skal som gjennomtrengjer kvarandre: veggen frå
 * golvet til rimet, og setet. Skøyten er ikkje tangential — setet stikk
 * inn på 35 % av veggtjukna, rekna frå ytterflata — slik at både slicaren
 * og limfuga har noko å ta i.
 */
import { makeShell, type Shell, type Vec3 } from "./field"
import type { Params } from "./params"

const TAU = Math.PI * 2

export type Detail = { nth: number; nv: number; nq: number }

export const DETAIL: Record<"lav" | "mid" | "hog", Detail> = {
  lav: { nth: 208, nv: 68, nq: 14 },
  mid: { nth: 320, nv: 104, nq: 20 },
  hog: { nth: 464, nv: 152, nq: 30 },
}

export type MeshData = {
  positions: Float32Array
  normals: Float32Array
  tris: number
  min: Vec3
  max: Vec3
  /** flate/kant per hjørne (0/1) — sjå BuildOut i core; valfri: manglar han,
   *  gjettar visaren av normalen */
  kant?: Float32Array
}

/** eit klipt hjørnepunkt i parameterplanet */
type CV = { fi: number; fj: number; cut: boolean }

class Soup {
  pos: number[] = []
  nor: number[] = []
  min: Vec3 = [Infinity, Infinity, Infinity]
  max: Vec3 = [-Infinity, -Infinity, -Infinity]

  vert(p: Vec3, n: Vec3) {
    this.pos.push(p[0], p[1], p[2])
    this.nor.push(n[0], n[1], n[2])
    for (let k = 0; k < 3; k++) {
      if (p[k] < this.min[k]) this.min[k] = p[k]
      if (p[k] > this.max[k]) this.max[k] = p[k]
    }
  }

  /** trekant med flat normal, snudd om han peikar feil veg */
  tri(a: Vec3, b: Vec3, c: Vec3, want?: Vec3) {
    let n = face(a, b, c)
    if (!n) return
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) {
      const t = b
      b = c
      c = t
      n = [-n[0], -n[1], -n[2]]
    }
    this.vert(a, n)
    this.vert(b, n)
    this.vert(c, n)
  }

  /** trekant med gjevne hjørnenormalar — mjuk flate */
  triN(a: Vec3, b: Vec3, c: Vec3, na: Vec3, nb: Vec3, nc: Vec3) {
    if (!face(a, b, c)) return
    this.vert(a, na)
    this.vert(b, nb)
    this.vert(c, nc)
  }

  done(): MeshData {
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nor),
      tris: this.pos.length / 9,
      min: this.min,
      max: this.max,
    }
  }
}

function face(a: Vec3, b: Vec3, c: Vec3): Vec3 | null {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
  const L = Math.hypot(n[0], n[1], n[2])
  if (!(L > 1e-9)) return null
  return [n[0] / L, n[1] / L, n[2] / L]
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const norm3 = (v: Vec3): Vec3 => {
  const L = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / L, v[1] / L, v[2] / L]
}

/**
 * Sutherland–Hodgman mot feltet: firkanten i parameterplanet vert klipt
 * mot m >= 1, og kvart nytt hjørne veit om det kom av eit kryss (og
 * dermed ligg på kanten av ei opning) eller ikkje.
 *
 * Ei salcelle — to hjørne inne på kvar sin diagonal — vert handsama feil:
 * han byggjer bru over opninga i staden for å skilje dei to hjørna, og
 * legg då tre gonger for mykje material i den eine cella. Målt over ni
 * objekt er det éi celle av 148 637, så feilen er ein halv kvadratmillimeter
 * på ein stad ingen ser. Vil ein lukke han, held det å dele cella på
 * diagonalen med den lågaste hjørneverdien og klippe dei to trekantane
 * kvar for seg.
 */
function clipCell(m: number[]): CV[] {
  const corner: CV[] = [
    { fi: 0, fj: 0, cut: false },
    { fi: 1, fj: 0, cut: false },
    { fi: 1, fj: 1, cut: false },
    { fi: 0, fj: 1, cut: false },
  ]
  const out: CV[] = []
  for (let k = 0; k < 4; k++) {
    const a = corner[k]
    const b = corner[(k + 1) % 4]
    const va = m[k] - 1
    const vb = m[(k + 1) % 4] - 1
    if (va >= 0) out.push(a)
    if (va >= 0 !== vb >= 0) {
      const t = va / (va - vb)
      out.push({ fi: a.fi + (b.fi - a.fi) * t, fj: a.fj + (b.fj - a.fj) * t, cut: true })
    }
  }
  return out
}

export function buildMesh(p: Params, d: Detail, shell?: Shell): MeshData {
  const sh = shell ?? makeShell(p)
  const s = new Soup()
  wall(sh, p, d, s)
  seat(sh, p, d, s)
  return s.done()
}

// =============================================================================
// VEGGEN
// =============================================================================
function wall(sh: Shell, p: Params, d: Detail, s: Soup) {
  const { nth, nv } = d
  const O: Vec3[][] = []
  const I: Vec3[][] = []
  const N: Vec3[][] = []
  const M: number[][] = []
  for (let i = 0; i < nth; i++) {
    const th = (i / nth) * TAU
    const top = sh.rimZ(th)
    const co: Vec3[] = []
    const ci: Vec3[] = []
    const cn: Vec3[] = []
    const cm: number[] = []
    for (let j = 0; j < nv; j++) {
      const v = j / (nv - 1)
      const z = v * top
      const o = sh.outer(th, z)
      const n = sh.normal(th, z)
      const t = sh.wall(th, z)
      co.push(o)
      cn.push(n)
      // Innerflata vert klemd til golvet: normalen heller utover nede, så
      // eit reint normaloffsett legg dei nedste punkta under golvplanet og
      // objektet vippar på ein liten flekk i staden for å stå på heile foten.
      ci.push([
        o[0] - n[0] * t,
        o[1] - n[1] * t,
        Math.max(0, o[2] - n[2] * t),
      ])
      cm.push(sh.matAt(th, sh.hOf(z)))
    }
    O.push(co)
    I.push(ci)
    N.push(cn)
    M.push(cm)
  }

  const bil = (G: Vec3[][], i: number, fi: number, j: number, fj: number): Vec3 => {
    const i1 = (i + 1) % nth
    const a = lerp3(G[i][j], G[i1][j], fi)
    const b = lerp3(G[i][j + 1], G[i1][j + 1], fi)
    return lerp3(a, b, fj)
  }

  for (let i = 0; i < nth; i++) {
    const i1 = (i + 1) % nth
    for (let j = 0; j < nv - 1; j++) {
      const m = [M[i][j], M[i1][j], M[i1][j + 1], M[i][j + 1]]
      if (m[0] < 1 && m[1] < 1 && m[2] < 1 && m[3] < 1) continue
      const poly = clipCell(m)
      if (poly.length < 3) continue

      const op = poly.map((c) => bil(O, i, c.fi, j, c.fj))
      const ip = poly.map((c) => bil(I, i, c.fi, j, c.fj))
      const np = poly.map((c) => norm3(bil(N, i, c.fi, j, c.fj)))

      // ytre og indre flate — mjuke normalar frå parametriseringa
      for (let k = 1; k + 1 < poly.length; k++) {
        s.triN(op[0], op[k], op[k + 1], np[0], np[k], np[k + 1])
        s.triN(ip[0], ip[k + 1], ip[k], neg(np[0]), neg(np[k + 1]), neg(np[k]))
      }

      // kantband: eggkanten av opningane, golvflata og rimet
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k]
        const b = poly[(k + 1) % poly.length]
        const onCut = a.cut && b.cut
        const onFloor = j === 0 && a.fj < 1e-6 && b.fj < 1e-6
        const onRim = j === nv - 2 && a.fj > 1 - 1e-6 && b.fj > 1 - 1e-6
        if (!onCut && !onFloor && !onRim) continue
        // Bandet må vendast motsett veg av det ein fyrst trur. Ytterflata
        // sin randgang går mot klokka sett utanfrå, og godset ligg på
        // innsida av den gangen — så ein trekant (ytre a, ytre b, indre b)
        // peikar inn i godset. Med feil vending vert nettet framleis
        // lukka, men ikkje samstemt orientert, og signert volum vert tull.
        const oa = op[k]
        const ob = op[(k + 1) % poly.length]
        const ia = ip[k]
        const ib = ip[(k + 1) % poly.length]
        s.tri(oa, ib, ob)
        s.tri(oa, ia, ib)
      }
    }
  }
}

const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]

// =============================================================================
// SETET
// =============================================================================
/**
 * Setet er ikkje ei plate. Det er toppen av same flata: ei skål målt i
 * normalisert radius innanfor snittet, med ein skråkant på `lip`
 * millimeter mot skalet som gjev ein skarp skuggestrek heile vegen rundt.
 */
function seat(sh: Shell, p: Params, d: Detail, s: Soup) {
  const { nth, nq } = d
  const rTop = (th: number) => {
    const z = sh.seatEdgeZ(th)
    return sh.rOuter(th, z) + p.lip
  }
  const rBot = (th: number) => sh.seatR(th)

  const top = (i: number, k: number): Vec3 => {
    const th = ((i % nth) / nth) * TAU
    const q = k / (nq - 1)
    const z = sh.dishZ(th, q)
    const r = q * rTop(th)
    const [cx, cy] = sh.spine(sh.hOf(z))
    return [cx + r * Math.cos(th), cy + r * Math.sin(th), z]
  }
  const bot = (i: number, k: number): Vec3 => {
    const th = ((i % nth) / nth) * TAU
    const q = k / (nq - 1)
    const z = sh.dishZ(th, q) - p.shellT
    const r = q * rBot(th)
    const [cx, cy] = sh.spine(sh.hOf(z))
    return [cx + r * Math.cos(th), cy + r * Math.sin(th), z]
  }

  const T: Vec3[][] = []
  const B: Vec3[][] = []
  for (let i = 0; i < nth; i++) {
    const ct: Vec3[] = []
    const cb: Vec3[] = []
    for (let k = 0; k < nq; k++) {
      ct.push(top(i, k))
      cb.push(bot(i, k))
    }
    T.push(ct)
    B.push(cb)
  }

  const up: Vec3 = [0, 0, 1]
  const dn: Vec3 = [0, 0, -1]
  for (let i = 0; i < nth; i++) {
    const i1 = (i + 1) % nth
    for (let k = 0; k < nq - 1; k++) {
      if (k === 0) {
        s.tri(T[i][0], T[i][1], T[i1][1], up)
        s.tri(B[i][0], B[i][1], B[i1][1], dn)
        continue
      }
      s.tri(T[i][k], T[i][k + 1], T[i1][k + 1], up)
      s.tri(T[i][k], T[i1][k + 1], T[i1][k], up)
      s.tri(B[i][k], B[i][k + 1], B[i1][k + 1], dn)
      s.tri(B[i][k], B[i1][k + 1], B[i1][k], dn)
    }
    // skråkanten: den skrå flata frå setekanten ned mot skalet
    const q = nq - 1
    const oa = T[i][q]
    const ob = T[i1][q]
    const ia = B[i][q]
    const ib = B[i1][q]
    const [cx, cy] = sh.spine(sh.hOf(oa[2]))
    const outw: Vec3 = norm3([oa[0] - cx, oa[1] - cy, 0])
    s.tri(oa, ob, ib, outw)
    s.tri(oa, ib, ia, outw)
  }
}
