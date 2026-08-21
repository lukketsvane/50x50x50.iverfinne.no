/**
 * KARVE — nettet, i tre lesemåtar.
 *
 *   flate   det freste objektet, glatt. Overflata er to høgdefelt — det
 *           øvste passet og det nedste — sydde saman langs silhuetten.
 *           Dette ER det ferdige møbelet.
 *   lag     EMNET: dei grovkutta platene limte i stabel, trappa, før
 *           fresen har rørt dei. Det du ser fjerna mellom lag og flate er
 *           spona.
 *   kontur  plateomrissa lagde flatt — kuttfila til limstabelen.
 *
 * Lukkinga er gjeven av korleis nettet vert laga og ikkje kontrollert i
 * etterkant: øvste og nedste flate deler nøyaktig same ytre ring, ringen
 * inst fell saman i eitt punkt kvar veg, og kappa mellom dei to går heile
 * vegen rundt. Kvar retta kant har difor makkeren sin i nabotrekanten.
 *
 * Trekanttalet er kjent på førehand — nth · 4 · nrad for den freste
 * kroppen — so bufferane vert fylte etter indeks og ikkje dytta inn i ei
 * JS-liste. Skilnaden er seks gonger på eit bygg.
 */
import { keep, type Vec3 } from "../core"
import { MIN_T, plater, type Karv } from "./form"
import type { Params } from "./params"

export type Mesh = {
  positions: Float32Array
  normals: Float32Array
  kant: Float32Array
  tris: number
  min: Vec3
  max: Vec3
}

/** ein skriveblokk med kjent storleik: posisjon, normal og flate/kant-merke */
class Blokk {
  pos: Float32Array
  nrm: Float32Array
  kan: Float32Array
  n = 0
  k = 1
  constructor(tris: number) {
    this.pos = new Float32Array(tris * 9)
    this.nrm = new Float32Array(tris * 9)
    this.kan = new Float32Array(tris * 3)
  }
  tri(a: Vec3, b: Vec3, c: Vec3, n: Vec3) {
    const i = this.n * 9
    const P = this.pos
    const N = this.nrm
    P[i] = a[0]; P[i + 1] = a[1]; P[i + 2] = a[2]
    P[i + 3] = b[0]; P[i + 4] = b[1]; P[i + 5] = b[2]
    P[i + 6] = c[0]; P[i + 7] = c[1]; P[i + 8] = c[2]
    for (let q = 0; q < 9; q += 3) {
      N[i + q] = n[0]; N[i + q + 1] = n[1]; N[i + q + 2] = n[2]
    }
    const j = this.n * 3
    this.kan[j] = this.k
    this.kan[j + 1] = this.k
    this.kan[j + 2] = this.k
    this.n++
  }
  /** trekant med eigen normal per hjørne — den glatte flata treng det */
  triN(P0: Float64Array, N0: Float64Array, a: number, b: number, c: number) {
    const i = this.n * 9
    const P = this.pos
    const N = this.nrm
    for (let q = 0; q < 3; q++) {
      P[i + q] = P0[a + q]; N[i + q] = N0[a + q]
      P[i + 3 + q] = P0[b + q]; N[i + 3 + q] = N0[b + q]
      P[i + 6 + q] = P0[c + q]; N[i + 6 + q] = N0[c + q]
    }
    const j = this.n * 3
    this.kan[j] = this.k
    this.kan[j + 1] = this.k
    this.kan[j + 2] = this.k
    this.n++
  }
  ferdig(): Mesh {
    const positions = this.pos.slice(0, this.n * 9)
    const normals = this.nrm.slice(0, this.n * 9)
    const kant = this.kan.slice(0, this.n * 3)
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
    return { positions, normals, kant, tris: this.n, min, max }
  }
}

function faceN(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const L = Math.hypot(nx, ny, nz) || 1
  return [nx / L, ny / L, nz / L]
}

// =============================================================================
// DEI TO HØGDEFELTA
// =============================================================================
export type Ark = { P: Float64Array; N: Float64Array }
export type Arkpar = { T: Ark; B: Ark; navU: number; navO: number }

/**
 * Eit høgdefelt som punkt og normalar. Normalen vert rekna av rutenettet
 * sjølv og ikkje av ei formel: flata er eit resultat av ei skanning, og
 * einaste staden den sanne helninga finst er i naboane.
 */
function arkOf(k: Karv, top: boolean, navZ: number): Ark {
  const m = k.nrad + 1
  const n = k.nth * m
  const P = new Float64Array(n * 3)
  const N = new Float64Array(n * 3)
  const Z = top ? k.zO : k.zU
  for (let i = 0; i < k.nth; i++) {
    const c = Math.cos(k.th[i])
    const s = Math.sin(k.th[i])
    for (let j = 0; j <= k.nrad; j++) {
      const q = (i * m + j) * 3
      const r = k.rho[i * m + j]
      P[q] = r * c
      P[q + 1] = r * s
      P[q + 2] = j === 0 ? navZ : Z[i * m + j]
    }
  }
  const at = (i: number, j: number) =>
    ((((i % k.nth) + k.nth) % k.nth) * m + (j < 0 ? 0 : j > k.nrad ? k.nrad : j)) * 3
  for (let i = 0; i < k.nth; i++) {
    for (let j = 0; j <= k.nrad; j++) {
      const q = (i * m + j) * 3
      if (j === 0) {
        N[q] = 0
        N[q + 1] = 0
        N[q + 2] = top ? 1 : -1
        continue
      }
      const a0 = at(i, j - 1)
      const a1 = at(i, j + 1)
      const b0 = at(i - 1, j)
      const b1 = at(i + 1, j)
      const rx = P[a1] - P[a0]
      const ry = P[a1 + 1] - P[a0 + 1]
      const rz = P[a1 + 2] - P[a0 + 2]
      const tx = P[b1] - P[b0]
      const ty = P[b1 + 1] - P[b0 + 1]
      const tz = P[b1 + 2] - P[b0 + 2]
      let nx = ty * rz - tz * ry
      let ny = tz * rx - tx * rz
      let nz = tx * ry - ty * rx
      const L = Math.hypot(nx, ny, nz)
      if (!L) {
        nx = 0; ny = 0; nz = top ? 1 : -1
      } else {
        nx /= L; ny /= L; nz /= L
        if (top === nz < 0) { nx = -nx; ny = -ny; nz = -nz }
      }
      N[q] = nx
      N[q + 1] = ny
      N[q + 2] = nz
    }
  }
  return { P, N }
}

const ARK_HUGS = keep<Arkpar>(3)

/**
 * Begge felta for eitt punkt. Nettbygginga og kotemålinga les nøyaktig dei
 * same punkta, so dei vert reiste éin gong. Ingen av bufferane her går
 * gjennom postMessage — dei er reine reknetal, og då er hugsen trygg.
 */
export function arkpar(k: Karv): Arkpar {
  return ARK_HUGS(JSON.stringify(k.f.p) + "|" + k.nth, () => {
    const m = k.nrad + 1
    let uSum = 0
    let oSum = 0
    for (let i = 0; i < k.nth; i++) {
      uSum += k.zU[i * m]
      oSum += k.zO[i * m]
    }
    // Navet er eitt punkt kvar veg. Kvar vinkel gjev same tal her, men
    // middelet gjer det EKSAKT likt — og eit lok som ikkje er eitt punkt
    // er eit lok med hòl i.
    const navU = uSum / k.nth
    const navO = Math.max(navU + MIN_T, oSum / k.nth)
    return { T: arkOf(k, true, navO), B: arkOf(k, false, navU), navU, navO }
  })
}

// =============================================================================
// FLATE — det freste objektet
// =============================================================================
export function flateMesh(k: Karv): Mesh {
  const m = k.nrad + 1
  const { T, B } = arkpar(k)
  const b = new Blokk(k.nth * 4 * k.nrad)
  const id = (i: number, j: number) => (i * m + j) * 3
  const P = (A: Ark, i: number, j: number): Vec3 => {
    const q = id(i, j)
    return [A.P[q], A.P[q + 1], A.P[q + 2]]
  }

  // --- oversida: heile den freste skinna er eit KUTT gjennom platene ----
  b.k = 1
  for (let i = 0; i < k.nth; i++) {
    const i2 = (i + 1) % k.nth
    for (let j = 0; j < k.nrad; j++) {
      b.triN(T.P, T.N, id(i, j), id(i, j + 1), id(i2, j + 1))
      if (j > 0) b.triN(T.P, T.N, id(i, j), id(i2, j + 1), id(i2, j))
    }
  }

  // --- undersida ---------------------------------------------------------
  // Putene under føtene er den einaste flata på heile møbelet fresen
  // ALDRI rører: der ligg botnplata si eiga side, urørt, og ho tek beis
  // som ei plateflate. Alt anna er skore.
  for (let i = 0; i < k.nth; i++) {
    const i2 = (i + 1) % k.nth
    for (let j = 0; j < k.nrad; j++) {
      const za = B.P[id(i, j) + 2]
      const zc = B.P[id(i2, j + 1) + 2]
      b.k = (za + zc) / 2 < 0.35 ? 0 : 1
      b.triN(B.P, B.N, id(i, j), id(i2, j + 1), id(i, j + 1))
      if (j > 0) b.triN(B.P, B.N, id(i, j), id(i2, j), id(i2, j + 1))
    }
  }

  // --- kappa: der dei to passa møtest -------------------------------------
  b.k = 1
  const j = k.nrad
  for (let i = 0; i < k.nth; i++) {
    const i2 = (i + 1) % k.nth
    const t0 = P(T, i, j)
    const t1 = P(T, i2, j)
    const b0 = P(B, i, j)
    const b1 = P(B, i2, j)
    b.tri(t0, b0, b1, faceN(t0, b0, b1))
    b.tri(t0, b1, t1, faceN(t0, b1, t1))
  }

  return b.ferdig()
}

// =============================================================================
// LAG — emnet: dei grovkutta platene, limte og trappa
// =============================================================================
export function lagMesh(k: Karv, p: Params): Mesh {
  const pl = plater(k, p)
  const b = new Blokk(pl.length * 4 * k.nth + 8)
  for (const q of pl) {
    const ring = q.outline
    const n = ring.length
    // Plateomrisset er ein radiusfunksjon kring aksen, so han er
    // stjerneforma om senteret: vifta frå (0,0) er ei gyldig triangulering
    // uansett kor bukta konturen er. Ingen øyreklipping trengst.
    b.k = 0
    for (let i = 0; i < n; i++) {
      const a = ring[i]
      const c = ring[(i + 1) % n]
      b.tri([0, 0, q.z1], [a[0], a[1], q.z1], [c[0], c[1], q.z1], [0, 0, 1])
      b.tri([0, 0, q.z0], [c[0], c[1], q.z0], [a[0], a[1], q.z0], [0, 0, -1])
    }
    b.k = 1
    for (let i = 0; i < n; i++) {
      const a = ring[i]
      const c = ring[(i + 1) % n]
      let nx = c[1] - a[1]
      let ny = -(c[0] - a[0])
      const L = Math.hypot(nx, ny) || 1
      nx /= L
      ny /= L
      const nv: Vec3 = [nx, ny, 0]
      // Vindinga, ikkje normalen, er det som lukkar prismet: sideflata må
      // gå MOTSETT veg av loket over den delte ringkanten.
      b.tri([a[0], a[1], q.z0], [c[0], c[1], q.z0], [c[0], c[1], q.z1], nv)
      b.tri([a[0], a[1], q.z0], [c[0], c[1], q.z1], [a[0], a[1], q.z1], nv)
    }
  }
  return b.ferdig()
}

// =============================================================================
// KONTUR — plateomrissa flatt
// =============================================================================
export function konturLines(
  k: Karv,
  p: Params,
): { lines: Float32Array; heavy: Float32Array } {
  const pl = plater(k, p)
  const thin: number[] = []
  const bold: number[] = []
  const GAP = 34
  const cols = Math.max(1, Math.ceil(Math.sqrt(pl.length * 1.4)))
  let w = 0
  let h = 0
  for (const q of pl) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const v of q.outline) {
      if (v[0] < x0) x0 = v[0]
      if (v[0] > x1) x1 = v[0]
      if (v[1] < y0) y0 = v[1]
      if (v[1] > y1) y1 = v[1]
    }
    w = Math.max(w, x1 - x0)
    h = Math.max(h, y1 - y0)
  }
  const pw = w + GAP
  const ph = h + GAP
  const rows = Math.ceil(pl.length / cols)
  const ox = -((cols - 1) * pw) / 2
  const oy = ((rows - 1) * ph) / 2
  pl.forEach((q, idx) => {
    // Den fyrste plata er den nedste: ho står tjukk, av di ho er den ein
    // legg i pressa fyrst og den alle dei andre vert retta etter.
    const dst = idx === 0 ? bold : thin
    const cx = ox + (idx % cols) * pw
    const cy = oy - Math.floor(idx / cols) * ph
    const ring = q.outline
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const c = ring[(i + 1) % ring.length]
      dst.push(cx + a[0], 0, cy + a[1], cx + c[0], 0, cy + c[1])
    }
  })
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}

// =============================================================================
// KOTETETTLEIK — kor tett limfugene ligg på den freste skinna
// =============================================================================
/**
 * Ei kotelinje er ei limfuge som er komen til syne. Ho er snittet mellom
 * skinna og eit vassrett plan i kvar platetjukn, og avstanden mellom to av
 * dei — MÅLT LANGS FLATA — er platetjukna delt på sinus til helninga.
 *
 * Difor har talet to endar, og båe er stygge. På ein loddrett flanke ligg
 * fugene så tett dei kan koma, altså éi platetjukn frå kvarandre; er plata
 * tynn nok, kryp dei saman til ein tekstur i staden for til lag. På ei
 * flate som ligg nesten vassrett spenner éi plate over ei handbreidd, og
 * objektet les som ein malt klump.
 *
 * Samla kotelengd er integralet av 1/avstand over heile skinna. Middelet —
 * areal delt på lengd — er det eine talet som fangar begge endane.
 */
export type Kote = {
  /** samla skinnareal, mm² */
  areal: number
  /** samla lengd av alle kotelinjene på skinna, mm */
  lengd: number
  /** arealvekta middelavstand mellom kotene, mm */
  snitt: number
  /** del av skinna der det er meir enn 110 mm mellom kotene */
  naken: number
  /** arealvekta median-koteavstand, mm */
  median: number
}

/** logaritmisk histogram: medianen utan å sortere titusen prøver */
const BINS = 96
const SPAN = 4000 / 0.05
const binOf = (s: number) => {
  const v = Math.log(Math.max(0.05, Math.min(4000, s)) / 0.05) / Math.log(SPAN)
  const b = Math.floor(v * BINS)
  return b < 0 ? 0 : b >= BINS ? BINS - 1 : b
}
const binMid = (b: number) => 0.05 * Math.pow(SPAN, (b + 0.5) / BINS)

export function koteMaal(k: Karv, plyT: number): Kote {
  const m = k.nrad + 1
  const { T, B } = arkpar(k)
  const hist = new Float64Array(BINS)
  let areal = 0
  let lengd = 0
  let naken = 0
  const t = Math.max(0.5, plyT)

  const legg = (a: number, sinA: number) => {
    if (!(a > 0)) return
    areal += a
    lengd += (a * sinA) / t
    const s = sinA > 1e-4 ? t / sinA : 1e6
    if (s > 110) naken += a
    hist[binOf(s)] += a
  }

  // Arealet vert rekna på TREKANTEN og ikkje som planareal delt på
  // normalen: kring silhuetten går flata mot loddrett, og der sprengjer
  // 1/nz seg sjølv. Trekanten veit kor stor han er.
  const flate = (A: Ark, q0: number, q1: number, q2: number) => {
    const ux = A.P[q1] - A.P[q0]
    const uy = A.P[q1 + 1] - A.P[q0 + 1]
    const uz = A.P[q1 + 2] - A.P[q0 + 2]
    const vx = A.P[q2] - A.P[q0]
    const vy = A.P[q2 + 1] - A.P[q0 + 1]
    const vz = A.P[q2 + 2] - A.P[q0 + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const L = Math.hypot(nx, ny, nz)
    if (!(L > 0)) return
    legg(L / 2, Math.hypot(nx, ny) / L)
  }
  const id = (i: number, j: number) => (i * m + j) * 3

  for (const A of [T, B]) {
    for (let i = 0; i < k.nth; i++) {
      const i2 = (i + 1) % k.nth
      for (let j = 0; j < k.nrad; j++) {
        flate(A, id(i, j), id(i, j + 1), id(i2, j + 1))
        if (j > 0) flate(A, id(i, j), id(i2, j + 1), id(i2, j))
      }
    }
  }

  // Kappa står loddrett: der ligg kotene så tett dei kan koma, éi
  // platetjukn frå kvarandre, og det er ho som teiknar den stripa som
  // fylgjer silhuetten heile vegen rundt.
  for (let i = 0; i < k.nth; i++) {
    const i2 = (i + 1) % k.nth
    const q = i * m + k.nrad
    const q2 = i2 * m + k.nrad
    const L = Math.hypot(
      k.rho[q2] * Math.cos(k.th[i2]) - k.rho[q] * Math.cos(k.th[i]),
      k.rho[q2] * Math.sin(k.th[i2]) - k.rho[q] * Math.sin(k.th[i]),
    )
    legg((L * (k.zO[q] - k.zU[q] + k.zO[q2] - k.zU[q2])) / 2, 1)
  }

  let halv = 0
  let median = 0
  for (let b = 0; b < BINS; b++) {
    halv += hist[b]
    if (halv >= areal / 2) {
      median = binMid(b)
      break
    }
  }
  return {
    areal,
    lengd,
    snitt: lengd > 0 ? areal / lengd : 1e6,
    naken: areal > 0 ? naken / areal : 0,
    median,
  }
}
