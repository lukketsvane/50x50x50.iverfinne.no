/**
 * BØYG — nettet, i tre lesemåtar.
 *
 *   flate   skala som glatte flater: same sveip, men tverrsnittet er ein
 *           stadion med runde kantar og dybelen er teken bort. Det er
 *           forma slik ho ligg i pressa, før nokon har kappa noko.
 *   lag     objektet SLIK DET ER BYGD: skala med verkeleg tjukn, lufta
 *           mellom dei, dei kappa endane og den eine dybelen som held alt.
 *   kontur  blankettane rulla ut flate — det skal skjerast før bøying,
 *           med bøyelinene og dybelhòlet på plass.
 *
 * Nettet er eit SVEIP og ikkje eit høgdefelt: kvart skal er ein lukka
 * slange bygd av eit tverrsnitt som vert flytt langs senterlina. Lukkinga
 * fylgjer av korleis han er laga og vert ikkje kontrollert etterpå — kvar
 * ring har same punkttal, kvar rute mellom to ringar er sydd med same
 * vinding, og dei to endelokka går motsett veg av veggen dei møter.
 *
 * DYBELEN gjennomtrengjer skala i staden for å vera boolsk skoren ut av
 * dei. Kvar del er lukka og rett vend for seg, og revisoren tel to lukka
 * flater som rører kvarandre som lovleg. Prisen står i metrics.ts: det
 * overlappa godset vert trekt frå volumet analytisk i staden for å verta
 * talt to gonger.
 */
import type { Vec3 } from "../core"
import { endePunkt, flatePunkt, type Bygg, type Skal, type Stasjon } from "./form"
import type { Params } from "./params"

export type Mesh = {
  positions: Float32Array
  normals: Float32Array
  kant: Float32Array
  tris: number
  min: Vec3
  max: Vec3
}

class Suppe {
  pos: number[] = []
  nrm: number[] = []
  kan: number[] = []
  k = 1
  tri(a: Vec3, b: Vec3, c: Vec3) {
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const L = Math.hypot(nx, ny, nz) || 1
    nx /= L
    ny /= L
    nz /= L
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
    for (let i = 0; i < 3; i++) this.nrm.push(nx, ny, nz)
    this.kan.push(this.k, this.k, this.k)
  }
  kvad(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
    this.tri(a, b, c)
    this.tri(a, c, d)
  }
}

function ferdig(s: Suppe): Mesh {
  const positions = new Float32Array(s.pos)
  const normals = new Float32Array(s.nrm)
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const v = positions[i + c]
      if (v < min[c]) min[c] = v
      if (v > max[c]) max[c] = v
    }
  }
  if (!Number.isFinite(min[0])) {
    min[0] = min[1] = min[2] = 0
    max[0] = max[1] = max[2] = 1
  }
  return { positions, normals, kant: new Float32Array(s.kan), tris: positions.length / 9, min, max }
}

// =============================================================================
// TVERRSNITTA
// =============================================================================
/**
 * Ringen kring skalet i éin stasjon. Fyrst oversida frå kant til kant, so
 * undersida attende — ringen går difor mot klokka kring tangenten, og det
 * er DEN vindinga alle rutene og begge lokka er bygde etter.
 *
 * Endane er ikkje kutta tvert av: fiberen vert skoten fram til kutteplanet
 * i staden, so ein sale-kappa fot ligg flatt i golvet i staden for å stå
 * på ein kant av finér.
 */
function ring(q: Stasjon, p: Params, nw: number, cut: [number, number] | null, ende: 0 | 1): Vec3[] {
  const ut: [number, number] = ende === 0 ? [-q.tx, -q.tz] : [q.tx, q.tz]
  const pt = (v: number, sg: number): Vec3 =>
    cut ? endePunkt(q, v, sg, p.plyT, cut, ut) : flatePunkt(q, v, sg, p.plyT)
  const out: Vec3[] = []
  for (let j = 0; j <= nw; j++) out.push(pt(-1 + (2 * j) / nw, -1))
  for (let j = nw; j >= 0; j--) out.push(pt(-1 + (2 * j) / nw, 1))
  return out
}

/** stadion-tverrsnitt: same ring, men kantane er runde av halve tjukna */
function ringRund(q: Stasjon, p: Params, nw: number, nr: number): Vec3[] {
  const r = p.plyT / 2
  const sk = Math.max(0.02, (q.w - r) / Math.max(1e-6, q.w))
  const out: Vec3[] = []
  for (let j = 0; j <= nw; j++) out.push(flatePunkt(q, (-1 + (2 * j) / nw) * sk, -1, p.plyT))
  const boge = (side: 1 | -1) => {
    const c = flatePunkt(q, side * sk, 0, 0)
    const up = flatePunkt(q, side * sk, -1, p.plyT)
    const nx = up[0] - c[0]
    const ny = up[1] - c[1]
    const nz = up[2] - c[2]
    for (let j = 1; j < nr; j++) {
      const a = (j / nr) * Math.PI
      const co = Math.cos(a)
      const si = r * Math.sin(a) * side
      out.push([c[0] + nx * co, c[1] + ny * co + si, c[2] + nz * co])
    }
  }
  boge(1)
  for (let j = nw; j >= 0; j--) out.push(flatePunkt(q, (-1 + (2 * j) / nw) * sk, 1, p.plyT))
  boge(-1)
  return out
}

// =============================================================================
// SVEIPET
// =============================================================================
function sveip(s: Suppe, sk: Skal, p: Params, nw: number, rund: boolean, nr: number) {
  const N = sk.st.length - 1
  const ringar: Vec3[][] = []
  for (let i = 0; i <= N; i++) {
    const cut = i === 0 ? (sk.cutA as [number, number]) : i === N ? (sk.cutB as [number, number]) : null
    ringar.push(
      rund ? ringRund(sk.st[i], p, nw, nr) : ring(sk.st[i], p, nw, cut, i === 0 ? 0 : 1),
    )
  }
  const M = ringar[0].length
  // Kva rutekolonne som er PRESSFLATE og kva som er KUTT. Pressflata tek
  // beis; kuttet er rå finérkant og skal syne laga.
  const kant = (m: number) => (rund ? 0 : m === nw || m === M - 1 ? 1 : 0)
  for (let i = 0; i < N; i++) {
    const A = ringar[i]
    const B = ringar[i + 1]
    for (let m = 0; m < M; m++) {
      const m2 = (m + 1) % M
      s.k = kant(m)
      s.kvad(A[m], A[m2], B[m2], B[m])
    }
  }
  // LOKKA. Eit tverrsnitt med krone er eit BOGA band og ikkje eit konvekst
  // polygon, so lokket kan ikkje klippast som eit vilkårleg polygon: rutene
  // må gå TVERS OVER tjukna, frå eit punkt på oversida til punktet med same
  // breiddekoordinat på undersida. Då ligg kvar rute i godset same kor mykje
  // krona bular. Dei runde kantane i flate-visinga får kvar sin vifte.
  s.k = 1
  const lok = (R: Vec3[], fram: boolean) => {
    const kv = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) =>
      fram ? s.kvad(a, b, c, d) : s.kvad(d, c, b, a)
    const tr = (a: Vec3, b: Vec3, c: Vec3) => (fram ? s.tri(a, b, c) : s.tri(c, b, a))
    const inn = rund ? 2 * nw + nr : 2 * nw + 1
    for (let j = 0; j < nw; j++) kv(R[j], R[j + 1], R[inn - j - 1], R[inn - j])
    if (!rund) return
    for (let i = 1; i < nr; i++) tr(R[nw], R[nw + i], R[nw + i + 1])
    const b0 = 2 * nw + nr
    for (let i = 1; i < nr; i++) tr(R[b0], R[b0 + i], R[(b0 + i + 1) % M])
  }
  lok(ringar[N], true)
  lok(ringar[0], false)
}

// =============================================================================
// DYBELEN
// =============================================================================
function dybel(s: Suppe, b: Bygg, p: Params) {
  const d = b.pinD
  const L0 = -b.d1 - p.pinnut
  const L1 = -b.d0 + p.pinnut
  const a0: Vec3 = [b.pinP[0] + d[0] * L0, 0, b.pinP[1] + d[1] * L0]
  const a1: Vec3 = [b.pinP[0] + d[0] * L1, 0, b.pinP[1] + d[1] * L1]
  const r = p.pinnD / 2
  const SEG = 18
  // lokal ramme: aksen ligg i (x, z), so Y er den eine tverraksen
  const ex: Vec3 = [d[0], 0, d[1]]
  const e1: Vec3 = [0, 1, 0]
  const e2: Vec3 = [-ex[2], 0, ex[0]]
  s.k = 1
  const P = (c: Vec3, i: number): Vec3 => {
    const t = (i / SEG) * Math.PI * 2
    return [
      c[0] + r * (e1[0] * Math.cos(t) + e2[0] * Math.sin(t)),
      c[1] + r * (e1[1] * Math.cos(t) + e2[1] * Math.sin(t)),
      c[2] + r * (e1[2] * Math.cos(t) + e2[2] * Math.sin(t)),
    ]
  }
  for (let i = 0; i < SEG; i++) {
    s.kvad(P(a0, i), P(a0, i + 1), P(a1, i + 1), P(a1, i))
  }
  for (let i = 1; i + 1 < SEG; i++) {
    s.tri(P(a1, 0), P(a1, i), P(a1, i + 1))
    s.tri(P(a0, 0), P(a0, i + 1), P(a0, i))
  }
}

// =============================================================================
// DEI TRE LESEMÅTANE
// =============================================================================
export function lagMesh(b: Bygg, p: Params, nw: number): Mesh {
  const s = new Suppe()
  for (const sk of b.skal) sveip(s, sk, p, nw, false, 0)
  dybel(s, b, p)
  return ferdig(s)
}

export function flateMesh(b: Bygg, p: Params, nw: number): Mesh {
  const s = new Suppe()
  for (const sk of b.skal) sveip(s, sk, p, Math.max(3, nw), true, 5)
  return ferdig(s)
}

// =============================================================================
// KONTUR — blankettane flate
// =============================================================================
/**
 * Blankettane lagde under kvarandre, i den rekkjefylgja dei kjem ut av
 * pressa: det inste skalet nedst, det ytste øvst. Kvar blankett er eit
 * rektangel med skulder i hjørna, bøyelinene tvers over og dybelhòlet der
 * det sit. Bøyelinene står TJUKKE, av di dei er den einaste opplysninga
 * som ikkje kan lesast av omrisset — og det er dei som seier kva form
 * plata skal i.
 */
export function konturLines(
  b: Bygg,
  p: Params,
  boyeliner: (sk: Skal) => { s: number; label: string; r: number }[],
  blankett: (sk: Skal, p: Params, steg?: number) => { outline: [number, number][]; holes: [number, number][][] },
): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const GAP = 34
  let maxLen = 0
  for (const sk of b.skal) maxLen = Math.max(maxLen, sk.len)
  const rad = p.breidd + GAP
  const H = b.skal.length * rad
  b.skal.forEach((sk, idx) => {
    const cy = H / 2 - (idx + 0.5) * rad
    const cx = -maxLen / 2
    const bl = blankett(sk, p, 2)
    for (const ringP of [bl.outline, ...bl.holes]) {
      const dst = ringP === bl.outline ? thin : bold
      for (let i = 0; i < ringP.length; i++) {
        const a = ringP[i]
        const c = ringP[(i + 1) % ringP.length]
        dst.push(cx + a[0], 0, cy + a[1], cx + c[0], 0, cy + c[1])
      }
    }
    for (const l of boyeliner(sk)) {
      const w = halvBreidd(sk, l.s)
      bold.push(cx + l.s, 0, cy - w, cx + l.s, 0, cy + w)
    }
  })
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}

function halvBreidd(sk: Skal, s: number): number {
  let best = sk.st[0]
  let bd = Infinity
  for (const q of sk.st) {
    const d = Math.abs(q.s - s)
    if (d < bd) {
      bd = d
      best = q
    }
  }
  return best.w
}
