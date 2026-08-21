/**
 * KOTE — nettet, i tre lesemåtar.
 *
 *   flate   den glatte kroppen platene er ei avbroten utgåve av: kotelina
 *           lofta kontinuerleg frå golv til sete, med skåla som ei rein
 *           paraboloide i toppen.
 *   lag     objektet SLIK DET STÅR: platene med hòl, stavane gjennom dei,
 *           hylsene i gapa og kilene øvst. Dette ER møbelet.
 *   kontur  kotelinene lagde flatt ved sida av kvarandre. For denne
 *           typologien er det ikkje ein illustrasjon — det er kuttfila.
 *
 * Alle tre er lukka skal. Vindinga, ikkje normalen, er kontrakten: to
 * naboflater må gå kvar sin veg over den delte kanten, elles står skalet
 * ope same kor rett normalen peikar.
 */
import type { Pt, Vec3 } from "../core"
import type { Build, Plate, Stav } from "./stack"
import type { Kropp } from "./plan"
import type { Params } from "./params"

const TAU = Math.PI * 2

/** kan/k: 0 = plateflate (tek beis), 1 = kutt (rå kryssfinér eller rått tre) */
type Soup = { pos: number[]; nrm: number[]; kan: number[]; k: number }
const newSoup = (): Soup => ({ pos: [], nrm: [], kan: [], k: 1 })

function tri(s: Soup, a: Vec3, b: Vec3, c: Vec3, n?: Vec3) {
  let nx: number, ny: number, nz: number
  if (n) [nx, ny, nz] = n
  else {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    const L = Math.hypot(nx, ny, nz) || 1
    nx /= L; ny /= L; nz /= L
  }
  s.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  for (let i = 0; i < 3; i++) s.nrm.push(nx, ny, nz)
  s.kan.push(s.k, s.k, s.k)
}

function soupToMesh(s: Soup) {
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
  if (!Number.isFinite(min[0])) { min[0] = min[1] = min[2] = 0; max[0] = max[1] = max[2] = 1 }
  return {
    positions,
    normals,
    kant: new Float32Array(s.kan),
    tris: positions.length / 9,
    min,
    max,
  }
}

// =============================================================================
// TRIANGULERING — same øyreklipping som SKIVE og VAFFEL, av same grunn
// =============================================================================
function earClip(poly: Pt[]): [Pt, Pt, Pt][] {
  const n = poly.length
  if (n < 3) return []
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    area += a[0] * b[1] - b[0] * a[1]
  }
  const idx = Array.from({ length: n }, (_, i) => i)
  if (area < 0) idx.reverse()
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  // STRENGT inni, og punkt som fell saman med eit hjørne tel ikkje: brua
  // frå eit hòl legg att koordinat-dublettar, og med >= ville kvar dublett
  // blokkere kvart einaste øyre han rører — klipparen stoggar då halvvegs
  // og lèt loket stå ope.
  const same = (u: Pt, v: Pt) => u[0] === v[0] && u[1] === v[1]
  const inside = (a: Pt, b: Pt, c: Pt, q: Pt) =>
    !same(q, a) && !same(q, b) && !same(q, c) &&
    cross(a, b, q) > 0 && cross(b, c, q) > 0 && cross(c, a, q) > 0
  const out: [Pt, Pt, Pt][] = []
  let guard = idx.length * idx.length + 16
  while (idx.length > 3 && guard-- > 0) {
    let cut = false
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length]
      const ib = idx[i]
      const ic = idx[(i + 1) % idx.length]
      const a = poly[ia], b = poly[ib], c = poly[ic]
      const cc = cross(a, b, c)
      if (cc === 0) {
        // Eit hjørne utan areal. Er det ein DUBLETT (brua sin kopi), fell
        // det stilt bort. Er det eit ekte kolineært hjørne, må trekanten
        // med null areal LIKEVEL leggjast: veggen under har kantar til
        // hjørnet, og utan makkeren i loket står skalet ope der.
        if (!same(a, b) && !same(b, c)) out.push([a, b, c])
        idx.splice(i, 1)
        cut = true
        break
      }
      if (cc < 0) continue
      let bad = false
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue
        if (inside(a, b, c, poly[j])) { bad = true; break }
      }
      if (bad) continue
      out.push([a, b, c])
      idx.splice(i, 1)
      cut = true
      break
    }
    if (!cut) break
  }
  if (idx.length === 3) out.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]])
  return out
}

/**
 * Hòl sydde inn i ytterkanten med null-breie bruer.
 *
 * Brua vert IKKJE lagd der avstanden er kortast. Ei kortaste bru kan
 * krysse eit anna hòl eller ei bru som alt ligg der, og eit polygon med
 * kryssande bruer er sjølvskjerande: øyreklipparen finn ikkje eit einaste
 * lovleg øyre, stoggar halvvegs, og lèt loket stå ope. Seteplata er
 * verstefallet — der ligg tre stavhòl og skålkanten tett i hop midt i ei
 * stor kotelinje, og ei kortaste-bru-sying sprakk kvar gong.
 *
 * I staden er brua lagd dit hòlet SER. Frå hòlet sitt høgraste punkt går
 * ein stråle mot +x; det fyrste hjørnet strålen kan sjå utan å gå gjennom
 * gods er brufestet. Det er standardframgangsmåten (Eberly), og han gjev
 * eit polygon som beviseleg ikkje skjer seg sjølv — difor kan hòla sist
 * i lista trygt feste seg i ringen til dei fyrste.
 *
 * Kontrakten inn: ytterkanten går MOT KLOKKA, kvart hòl MED. Er eit hòl
 * snudd feil veg, vert det snudd her.
 */
function bridge(outline: Pt[], holes: Pt[][]): Pt[] {
  const area2 = (ring: Pt[]) => {
    let a = 0
    for (let i = 0; i < ring.length; i++) {
      const b = ring[(i + 1) % ring.length]
      a += ring[i][0] * b[1] - b[0] * ring[i][1]
    }
    return a
  }
  let poly = area2(outline) < 0 ? outline.slice().reverse() : outline.slice()

  // Hòla vert sydde frå høgre mot venstre. Eit hòl lenger til høgre kan
  // aldri stengje for eitt lenger til venstre, so rekkjefylgja gjer at
  // kvar bru er lagd i eit polygon som alt er ferdig til høgre for henne.
  const order = holes
    .map((h) => ({ h, x: Math.max(...h.map((q) => q[0])) }))
    .sort((a, b) => b.x - a.x)

  for (const { h } of order) {
    const ring0 = area2(h) > 0 ? h.slice().reverse() : h.slice()
    // M: hòlet sitt høgraste hjørne — strålen derifrå møter garantert
    // ytterkanten, for hòlet ligg inne i henne
    let mi = 0
    for (let i = 1; i < ring0.length; i++) {
      if (ring0[i][0] > ring0[mi][0] || (ring0[i][0] === ring0[mi][0] && ring0[i][1] > ring0[mi][1])) mi = i
    }
    const M = ring0[mi]

    // strålen M → +x mot kvar kant i polygonet: næraste treff til høgre
    let tx = Infinity
    let pi = -1
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if (a[1] > M[1] === b[1] > M[1]) continue
      const x = a[0] + ((M[1] - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
      if (x < M[0] - 1e-9 || x >= tx) continue
      tx = x
      // P er den enden av kanten som ligg lengst til høgre — brua skal
      // aldri feste seg i eit hjørne strålen har passert
      pi = a[0] >= b[0] ? i : (i + 1) % poly.length
    }
    if (pi < 0) {
      // Skulle ikkje kunne skje for eit hòl som ligg inne i kanten. Skjer
      // det likevel, er det betre å sløyfe hòlet enn å sy eit polygon som
      // riv opp heile loket.
      continue
    }

    // Ligg det reflekse hjørne inne i trekanten M–I–P, stengjer dei for
    // P, og brua må feste seg i det av dei som ligg lågast i vinkel frå
    // strålen. Er det ingen, ser M rett på P.
    const I: Pt = [tx, M[1]]
    const P = poly[pi]
    const cross = (o: Pt, a: Pt, b: Pt) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const tri3: [Pt, Pt, Pt] = cross(M, I, P) >= 0 ? [M, I, P] : [M, P, I]
    const inTri = (q: Pt) =>
      cross(tri3[0], tri3[1], q) >= 0 &&
      cross(tri3[1], tri3[2], q) >= 0 &&
      cross(tri3[2], tri3[0], q) >= 0
    let bi = pi
    let bestTan = Infinity
    let bestD = Infinity
    for (let i = 0; i < poly.length; i++) {
      const q = poly[i]
      if (q === P || (q[0] === P[0] && q[1] === P[1])) continue
      const pr = poly[(i + poly.length - 1) % poly.length]
      const nx = poly[(i + 1) % poly.length]
      if (cross(pr, q, nx) > 0) continue // ikkje reflekst — kan ikkje stengje
      if (q[0] <= M[0] || !inTri(q)) continue
      const dx = q[0] - M[0]
      const dy = q[1] - M[1]
      const tan = Math.abs(dy) / (dx || 1e-9)
      const d = dx * dx + dy * dy
      if (tan < bestTan - 1e-9 || (Math.abs(tan - bestTan) <= 1e-9 && d < bestD)) {
        bestTan = tan
        bestD = d
        bi = i
      }
    }

    const ring = ring0.slice(mi).concat(ring0.slice(0, mi))
    poly = poly.slice(0, bi + 1).concat(ring, [ring[0]], poly.slice(bi))
  }
  return poly
}

// =============================================================================
// BYGGEKLOSSAR
// =============================================================================
/**
 * Loddrett vegg mellom to høgder langs ein ring. Ringen si retning ER
 * orienteringa: går han mot klokka, peikar normalen ut; går han med
 * klokka (eit hòl), peikar han inn i hòlet. Botnkanten går same veg som
 * ringen og toppkanten motsett — det er nett det loket over og under
 * treng for å møte veggen med kvar sin retning.
 */
function wall(s: Soup, ring: Pt[], z0: number, z1: number) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    let nx = b[1] - a[1]
    let ny = -(b[0] - a[0])
    const L = Math.hypot(nx, ny) || 1
    nx /= L; ny /= L
    const n: Vec3 = [nx, ny, 0]
    tri(s, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], n)
    tri(s, [a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], n)
  }
}

/** flatt lok ved z. `opp` snur vindinga so normalen peikar +Z eller −Z. */
function cap(s: Soup, poly: Pt[], z: number, opp: boolean) {
  const n: Vec3 = opp ? [0, 0, 1] : [0, 0, -1]
  for (const [a, b, c] of earClip(poly)) {
    if (opp) tri(s, [a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z], n)
    else tri(s, [a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z], n)
  }
}

/** ein sirkel mot klokka */
function circle(cx: number, cy: number, r: number, m: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < m; i++) {
    const a = (i / m) * TAU
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}

/** lukka sylinder langs Z */
function rodSolid(s: Soup, x: number, y: number, r: number, z0: number, z1: number, seg = 20) {
  const ring = circle(x, y, r, seg)
  wall(s, ring, z0, z1)
  cap(s, ring, z1, true)
  cap(s, ring, z0, false)
}

/** hylsa: eit røyr kring staven, med lok på begge endar */
function tubeSolid(
  s: Soup, x: number, y: number, ri: number, ro: number, z0: number, z1: number, seg = 20,
) {
  const inn = circle(x, y, ri, seg)
  const ut = circle(x, y, ro, seg)
  wall(s, ut, z0, z1)
  wall(s, inn.slice().reverse(), z0, z1)
  const ringLok = (z: number, opp: boolean) => {
    const n: Vec3 = opp ? [0, 0, 1] : [0, 0, -1]
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg
      const A: Vec3 = [inn[i][0], inn[i][1], z]
      const B: Vec3 = [ut[i][0], ut[i][1], z]
      const C: Vec3 = [ut[j][0], ut[j][1], z]
      const D: Vec3 = [inn[j][0], inn[j][1], z]
      if (opp) { tri(s, A, B, C, n); tri(s, A, C, D, n) }
      else { tri(s, A, C, B, n); tri(s, A, D, C, n) }
    }
  }
  ringLok(z1, true)
  ringLok(z0, false)
}

/**
 * Kila: eit flatt, tilspissa blad drive ned i eit sagsnitt i stavenden.
 * Bladet står PÅ TVERS av staven sin lengderetning — ei kile lagd langs
 * fibra i staven ville kløyve han i staden for å spreie han.
 */
function wedgeSolid(s: Soup, st: Stav, p: Params, zTopp: number) {
  const w = p.stavD * 0.62
  const t1 = p.kileB / 2
  const t0 = p.kileB * 0.12
  const z0 = zTopp - 0.6 * p.kileH
  const z1 = zTopp + 0.4 * p.kileH
  // kileplanet ligg radielt ut frå aksen: då syner kvar kile flatsida si
  const ca = Math.cos(st.ang)
  const sa = Math.sin(st.ang)
  const at = (u: number, v: number, z: number): Vec3 => [
    st.x + u * ca - v * sa,
    st.y + u * sa + v * ca,
    z,
  ]
  const lo: Vec3[] = [at(-w, -t0, z0), at(w, -t0, z0), at(w, t0, z0), at(-w, t0, z0)]
  const hi: Vec3[] = [at(-w, -t1, z1), at(w, -t1, z1), at(w, t1, z1), at(-w, t1, z1)]
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    tri(s, lo[i], lo[j], hi[j])
    tri(s, lo[i], hi[j], hi[i])
  }
  tri(s, hi[0], hi[1], hi[2])
  tri(s, hi[0], hi[2], hi[3])
  tri(s, lo[0], lo[2], lo[1])
  tri(s, lo[0], lo[3], lo[2])
}

// =============================================================================
// LAG — objektet slik det står
// =============================================================================
/** ei plate som prisme: to plateflater og kutt heile vegen rundt */
function plateSolid(s: Soup, pl: Plate) {
  s.k = 0
  const merged = pl.holes.length ? bridge(pl.outline, pl.holes) : pl.outline
  cap(s, merged, pl.z1, true)
  cap(s, merged, pl.z0, false)
  s.k = 1
  wall(s, pl.outline, pl.z0, pl.z1)
  for (const h of pl.holes) wall(s, h, pl.z0, pl.z1)
}

/**
 * Seteplata: same prisme, men toppen er skoren ut som ei SKÅL av
 * konsentriske riller. Kvar rille er eit vassrett trinn, og trinnet
 * blottar finérlaga — difor les setet som eit kotekart, og difor er
 * skålflatene merkte som kutt og ikkje som plateflate.
 */
function seatSolid(s: Soup, pl: Plate, b: Build, m: number) {
  const R = b.skaal.R
  const rings = b.skaal.ringar
  if (!rings.length) {
    plateSolid(s, pl)
    return
  }
  const M = Math.max(24, Math.min(72, Math.round(m * 1.6)))
  const rimP = circle(0, 0, R, M)

  s.k = 0
  const topHoles = pl.holes.concat([rimP.slice().reverse()])
  cap(s, bridge(pl.outline, topHoles), pl.z1, true)
  const merged = pl.holes.length ? bridge(pl.outline, pl.holes) : pl.outline
  cap(s, merged, pl.z0, false)

  s.k = 1
  wall(s, pl.outline, pl.z0, pl.z1)
  for (const h of pl.holes) wall(s, h, pl.z0, pl.z1)

  // skåla: ringflater, og eit loddrett trinn mellom kvar
  const nR = rings.length
  const nUp: Vec3 = [0, 0, 1]
  for (let j = 0; j < nR; j++) {
    const rg = rings[j]
    const zj = rg.z
    const inn = rg.r0 > 0.5 ? circle(0, 0, rg.r0, M) : null
    const ut = circle(0, 0, rg.r1, M)
    for (let i = 0; i < M; i++) {
      const i2 = (i + 1) % M
      if (inn) {
        tri(s, [inn[i][0], inn[i][1], zj], [ut[i][0], ut[i][1], zj], [ut[i2][0], ut[i2][1], zj], nUp)
        tri(s, [inn[i][0], inn[i][1], zj], [ut[i2][0], ut[i2][1], zj], [inn[i2][0], inn[i2][1], zj], nUp)
      } else {
        tri(s, [0, 0, zj], [ut[i][0], ut[i][1], zj], [ut[i2][0], ut[i2][1], zj], nUp)
      }
    }
    // trinnet ved ytterkanten: opp til neste rille, eller opp til setet
    const zNext = j + 1 < nR ? rings[j + 1].z : pl.z1
    for (let i = 0; i < M; i++) {
      const i2 = (i + 1) % M
      const A: Vec3 = [ut[i][0], ut[i][1], zj]
      const A2: Vec3 = [ut[i2][0], ut[i2][1], zj]
      const B: Vec3 = [ut[i][0], ut[i][1], zNext]
      const B2: Vec3 = [ut[i2][0], ut[i2][1], zNext]
      const nn: Vec3 = [-ut[i][0] / rg.r1, -ut[i][1] / rg.r1, 0]
      tri(s, A2, A, B, nn)
      tri(s, A2, B, B2, nn)
    }
  }
}

export function lagMesh(p: Params, b: Build, m: number) {
  const s = newSoup()
  for (let i = 0; i < b.plates.length; i++) {
    const pl = b.plates[i]
    if (i === b.plates.length - 1) seatSolid(s, pl, b, m)
    else plateSolid(s, pl)
  }
  s.k = 1
  const zTopp = p.hogd + p.stavOver
  for (const st of b.stavar) {
    rodSolid(s, st.x, st.y, p.stavD / 2, 0, zTopp)
    wedgeSolid(s, st, p, zTopp)
  }
  // hylsene: eitt røyr per stav i kvart ope gap. Dei ER lastvegen — det
  // er dei som fører 1600 N frå kote til kote gjennom lufta.
  const ri = p.stavD / 2 + 0.25
  const ro = b.hylseD / 2
  for (let i = 0; i + 1 < b.plates.length; i++) {
    const z0 = b.plates[i].z1
    const z1 = b.plates[i + 1].z0
    if (z1 - z0 < 0.8) continue
    for (const st of b.stavar) tubeSolid(s, st.x, st.y, ri, ro, z0, z1)
  }
  return soupToMesh(s)
}

// =============================================================================
// FLATE — kroppen platene er ei avbroten utgåve av
// =============================================================================
export function flateMesh(k: Kropp, b: Build, N: number, zst: number) {
  const s = newSoup()
  const H = k.H
  const M = Math.max(6, zst)
  const rings: Pt[][] = []
  for (let j = 0; j <= M; j++) rings.push(k.plan((j / M) * H, N))
  for (let j = 0; j < M; j++) {
    const A = rings[j]
    const B = rings[j + 1]
    const za = (j / M) * H
    const zb = ((j + 1) / M) * H
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N
      const a0: Vec3 = [A[i][0], A[i][1], za]
      const a1: Vec3 = [A[i2][0], A[i2][1], za]
      const b0: Vec3 = [B[i][0], B[i][1], zb]
      const b1: Vec3 = [B[i2][0], B[i2][1], zb]
      tri(s, a0, a1, b1)
      tri(s, a0, b1, b0)
    }
  }
  cap(s, rings[0], 0, false)

  // Toppen: skåla som ei rein paraboloide, lagd på eit polarnett som deler
  // ytterringen med veggen — same punkt, so skalet er lukka.
  //
  // Skålradien vert kappa til nitti prosent av den TRONGASTE staden i
  // setekonturen. Utan den kappinga kan ein skål som er vidare enn
  // kotelina er brei senke sjølve kanten ned under H, medan veggen under
  // framleis endar i H — og då står det ein sprekk heile vegen rundt der
  // dei to skulle ha møttest. Det skjer berre for smale, djupt bitne
  // sete, men det skjer stilt, og eit hòl i skalet syner seg ikkje før
  // nokon skal skrive ut fila.
  let seteTrongast = Infinity
  for (const q of rings[M]) {
    const rr = Math.hypot(q[0], q[1])
    if (rr < seteTrongast) seteTrongast = rr
  }
  const Rd = Math.min(b.skaal.R, 0.9 * seteTrongast)
  const dj = b.skaal.djup
  const Q = 10
  const top = rings[M]
  const dish = (r: number) => (Rd > 1 && r < Rd ? dj * (1 - (r / Rd) * (r / Rd)) : 0)
  const at = (i: number, j: number): Vec3 => {
    const f = j / Q
    const x = top[i][0] * f
    const y = top[i][1] * f
    return [x, y, H - dish(Math.hypot(x, y))]
  }
  const mid: Vec3 = [0, 0, H - dish(0)]
  for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N
    tri(s, mid, at(i, 1), at(i2, 1))
    for (let j = 1; j < Q; j++) {
      tri(s, at(i, j), at(i, j + 1), at(i2, j + 1))
      tri(s, at(i, j), at(i2, j + 1), at(i2, j))
    }
  }
  return soupToMesh(s)
}

// =============================================================================
// KONTUR — kotelinene flatt ved sida av kvarandre. Dette ER kuttfila.
// =============================================================================
export function contourLines(b: Build): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const GAP = 34
  const n = b.plates.length
  const cols = Math.max(1, Math.round(Math.sqrt(n * 1.7)))

  // rutene vert like store: den største kotelina set målet, so rutenettet
  // les seg som eit kart og ikkje som ei hylle med ujamne bøker
  let w = 0
  let h = 0
  for (const pl of b.plates) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const q of pl.outline) {
      if (q[0] < x0) x0 = q[0]
      if (q[0] > x1) x1 = q[0]
      if (q[1] < y0) y0 = q[1]
      if (q[1] > y1) y1 = q[1]
    }
    w = Math.max(w, x1 - x0)
    h = Math.max(h, y1 - y0)
  }
  const stepX = w + GAP
  const stepY = h + GAP
  const rows = Math.ceil(n / cols)
  const ox = -((Math.min(n, cols) - 1) * stepX) / 2
  const oy = ((rows - 1) * stepY) / 2

  const seg = (dst: number[], a: Pt, q: Pt, cx: number, cy: number) =>
    dst.push(a[0] + cx, a[1] + cy, 0, q[0] + cx, q[1] + cy, 0)

  for (let i = 0; i < n; i++) {
    const pl = b.plates[i]
    const c = i % cols
    const r = Math.floor(i / cols)
    const cx = ox + c * stepX
    const cy = oy - r * stepY
    const seat = i === n - 1
    const dst = seat ? bold : thin
    for (const ring of [pl.outline, ...pl.holes]) {
      for (let j = 0; j < ring.length; j++) {
        seg(dst, ring[j], ring[(j + 1) % ring.length], cx, cy)
      }
    }
    if (seat) {
      // rillene i setet står med i teikninga som lommefres — dei er ikkje
      // gjennomkutt, men dei er det som gjer setet til eit kotekart
      for (const rg of b.skaal.ringar) {
        if (rg.r1 < 1) continue
        const ring = circle(cx, cy, rg.r1, 48)
        for (let j = 0; j < ring.length; j++) {
          const a = ring[j]
          const q = ring[(j + 1) % ring.length]
          thin.push(a[0], a[1], 0, q[0], q[1], 0)
        }
      }
    }
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}
