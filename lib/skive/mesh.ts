/**
 * SKIVE — nettet, i tre lesemåtar.
 *
 *   flate   silhuetten lofta kontinuerleg over breidda — den forma møbelet
 *           er ei avbroten utgåve av. Skivene er prøver av denne flata.
 *   lag     skivene og stavane slik dei står. Dette ER objektet.
 *   kontur  dei unike silhuettane lagde flatt ved sida av kvarandre.
 *
 * Lofta byggjer på at kvar silhuett har nøyaktig same punkttal (sjå
 * profile.ts): stasjon j og stasjon j+1 kan då sysaman punkt for punkt, og
 * endane vert lokka att med øyreklipping av endeprofilane sjølve.
 */
import type { Pt, Vec3 } from "../core"
import { profileAt, type Build } from "./profile"
import type { Params } from "./params"

/** kan/k: 0 = plateflate (tek beis), 1 = kutt (rå kryssfinér-kant) */
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
// TRIANGULERING — same øyreklipping som VAFFEL, av same grunn: lesbar og nok
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
  // frå eit hòl legg att koordinat-dublettar i polygonet, og med >= ville
  // kvar dublett blokkere kvart einaste øyre han rører — klipparen stoggar
  // då halvvegs og lèt loket stå ope.
  const same = (u: Pt, v: Pt) => u[0] === v[0] && u[1] === v[1]
  const inside = (a: Pt, b: Pt, c: Pt, p: Pt) =>
    !same(p, a) && !same(p, b) && !same(p, c) &&
    cross(a, b, p) > 0 && cross(b, c, p) > 0 && cross(c, a, p) > 0
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

/** hòl sydde inn i ytterkanten med null-breie bruer — som i VAFFEL */
function bridge(outline: Pt[], holes: Pt[][]): Pt[] {
  let poly = outline.slice()
  for (const h of holes) {
    let bi = 0
    let hi = 0
    let best = Infinity
    for (let i = 0; i < poly.length; i++) {
      for (let j = 0; j < h.length; j++) {
        const d = Math.hypot(poly[i][0] - h[j][0], poly[i][1] - h[j][1])
        if (d < best) { best = d; bi = i; hi = j }
      }
    }
    const ring = h.slice(hi).concat(h.slice(0, hi))
    let a2 = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      a2 += a[0] * b[1] - b[0] * a[1]
    }
    const r = a2 > 0 ? ring.slice().reverse() : ring
    poly = poly.slice(0, bi + 1).concat(r, [r[0]], poly.slice(bi))
  }
  return poly
}

// =============================================================================
// LAG — skivene og stavane slik dei står
// =============================================================================
/** éi skive som prisme: to plateflater og kutt heile vegen rundt.
 *  rot er vifterotasjonen kring Z: plata står med normal n̂ = (−sin a, cos a)
 *  og u-akse û = (cos a, sin a) — offset langs n̂, profil langs û. */
function sliceSolid(s: Soup, outline: Pt[], holes: Pt[][], y: number, t: number, rot = 0) {
  const h = t / 2
  const ca = Math.cos(rot)
  const sa = Math.sin(rot)
  const at = (q: Pt, off: number): Vec3 => [
    q[0] * ca - (y + off) * sa,
    q[0] * sa + (y + off) * ca,
    q[1],
  ]
  // plateflatene — dei fine sidene som tek beis. Profilplanet er (x, z) og
  // skiva står normalt på Y, so +y-sida skal peike +y.
  s.k = 0
  const merged = holes.length ? bridge(outline, holes) : outline
  // Vindinga er kontrakten, ikkje normalen: positivt skolisseareal i
  // (x, z) gjev −y-normal i rommet, so botnloket brukar øyreklippinga si
  // rekkjefylgje beint fram og topploket den snudde — då går kvart lok
  // MOTSETT veg av veggen over den delte kanten, og skiva er lukka.
  for (const [a, b, c] of earClip(merged)) {
    tri(s, at(a, h), at(c, h), at(b, h), [0, 1, 0])
    tri(s, at(a, -h), at(b, -h), at(c, -h), [0, -1, 0])
  }
  // kuttet: ytterkanten og stavhòla
  s.k = 1
  const wall = (ring: Pt[], inward: boolean) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      let nx = b[1] - a[1]
      let nz = -(b[0] - a[0])
      const L = Math.hypot(nx, nz) || 1
      nx /= L; nz /= L
      if (inward) { nx = -nx; nz = -nz }
      const n: Vec3 = [nx * ca, nx * sa, nz]
      tri(s, at(a, -h), at(b, h), at(b, -h), n)
      tri(s, at(a, -h), at(a, h), at(b, h), n)
    }
  }
  wall(outline, false)
  for (const hole of holes) wall(hole, false)
}

/** staven som lukka sylinder langs Y — rå tre, kutt i attributtet */
function rodSolid(s: Soup, x: number, z: number, r: number, y0: number, y1: number) {
  s.k = 1
  const SEG = 20
  const ring: Pt[] = []
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2
    ring.push([x + r * Math.cos(a), z + r * Math.sin(a)])
  }
  for (let i = 0; i < SEG; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % SEG]
    const na: Vec3 = [(a[0] - x) / r, 0, (a[1] - z) / r]
    tri(s, [a[0], y0, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]], na)
    tri(s, [a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], na)
  }
  for (let i = 1; i + 1 < SEG; i++) {
    tri(s, [ring[0][0], y1, ring[0][1]], [ring[i + 1][0], y1, ring[i + 1][1]], [ring[i][0], y1, ring[i][1]], [0, 1, 0])
    tri(s, [ring[0][0], y0, ring[0][1]], [ring[i][0], y0, ring[i][1]], [ring[i + 1][0], y0, ring[i + 1][1]], [0, -1, 0])
  }
}

export function lagMesh(p: Params, b: Build) {
  const s = newSoup()
  for (const sl of b.slices) sliceSolid(s, sl.outline, sl.holes, sl.y, p.plyT, sl.rot)
  const y0 = -b.width / 2
  const y1 = b.width / 2
  for (const r of b.rods) rodSolid(s, r.x, r.z, p.stavD / 2, y0, y1)
  return soupToMesh(s)
}

// =============================================================================
// FLATE — silhuetten lofta kontinuerleg over breidda
// =============================================================================
export function loftMesh(p: Params, k: number, stations: number) {
  const s = newSoup()
  const W = Math.max(2, Math.round(p.skiver)) * p.plyT + (Math.max(2, Math.round(p.skiver)) - 1) * p.luft
  const M = Math.max(4, stations)
  const profs: Pt[][] = []
  const ys: number[] = []
  const rots: number[] = []
  for (let j = 0; j <= M; j++) {
    const y = -W / 2 + (j / M) * W
    const su = y / (W / 2)
    profs.push(profileAt(p, Math.abs(su), k))
    ys.push(y)
    rots.push((p.vifte * su * Math.PI) / 180)
  }
  const at3 = (q: Pt, y: number, rot: number): Vec3 => {
    const ca = Math.cos(rot)
    const sa = Math.sin(rot)
    return [q[0] * ca - y * sa, q[0] * sa + y * ca, q[1]]
  }
  const nt = profs[0].length
  // veggen mellom stasjonane — mot klokka i (x, z) sett frå +y gjev
  // utoverpeikande normalar med denne vindinga
  for (let j = 0; j < M; j++) {
    const A = profs[j]
    const B = profs[j + 1]
    const ya = ys[j]
    const yb = ys[j + 1]
    for (let i = 0; i < nt; i++) {
      const i2 = (i + 1) % nt
      const a0 = at3(A[i], ya, rots[j])
      const a1 = at3(A[i2], ya, rots[j])
      const b0 = at3(B[i], yb, rots[j + 1])
      const b1 = at3(B[i2], yb, rots[j + 1])
      tri(s, a0, b1, a1)
      tri(s, a0, b0, b1)
    }
  }
  // Endane, lokka att med endeprofilane sjølve. Vindinga er motsett av
  // veggene sine kantretningar — det er DET som gjer skalet lukka, ikkje
  // normalane: to naboflater må gå kvar sin veg over den delte kanten.
  const n0: Vec3 = [Math.sin(rots[0]), -Math.cos(rots[0]), 0]
  const nM: Vec3 = [-Math.sin(rots[M]), Math.cos(rots[M]), 0]
  for (const [a, b, c] of earClip(profs[0])) {
    tri(s, at3(a, ys[0], rots[0]), at3(b, ys[0], rots[0]), at3(c, ys[0], rots[0]), n0)
  }
  for (const [a, b, c] of earClip(profs[M])) {
    tri(s, at3(a, ys[M], rots[M]), at3(c, ys[M], rots[M]), at3(b, ys[M], rots[M]), nM)
  }
  return soupToMesh(s)
}

// =============================================================================
// KONTUR — dei unike silhuettane flatt ved sida av kvarandre
// =============================================================================
export function contourLines(b: Build): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const seg = (dst: number[], a: Pt, bq: Pt, x: number) =>
    dst.push(x + a[0], 0, a[1], x + bq[0], 0, bq[1])
  const GAP = 30
  // morfen er symmetrisk: berre helvta av skivene er unike former
  const seen = new Set<number>()
  const uniq = b.slices.filter((sl) => {
    const key = Math.round(sl.u * 1000)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  let x = 0
  for (let qi = 0; qi < uniq.length; qi++) {
    const sl = uniq[qi]
    const dst = qi === 0 ? bold : thin
    let w0 = Infinity
    let w1 = -Infinity
    for (const q of sl.outline) {
      if (q[0] < w0) w0 = q[0]
      if (q[0] > w1) w1 = q[0]
    }
    for (const ring of [sl.outline, ...sl.holes]) {
      for (let i = 0; i < ring.length; i++) {
        seg(dst, ring[i], ring[(i + 1) % ring.length], x - w0)
      }
    }
    x += w1 - w0 + GAP
  }
  const shift = -x / 2
  for (const arr of [thin, bold]) {
    for (let i = 0; i < arr.length; i += 3) arr[i] += shift
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}
