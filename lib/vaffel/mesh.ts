/**
 * VAFFEL — nettet, i tre lesemåtar.
 *
 *   flate   kroppen slik han ville sett ut om nokon sleip rutenettet ned
 *           til éi flate. Det er ikkje objektet — det er forma objektet
 *           er ei tilnærming til, og skilnaden mellom dei to er heile
 *           typologien.
 *   lag     atten plater med spor, kvar der ho står. Dette ER objektet.
 *   kontur  profilane lagde flatt ved sida av kvarandre, slik dei ligg på
 *           plata. Her ser ein at ni av dei atten er ulike.
 *
 * Nettet og kuttfila kjem frå dei same polygona. Ein fres som fylgjer
 * konturen skjer den ribba biletet viser.
 */
import type { Pt, Vec3 } from "../core"
import type { Body } from "./body"
import type { Grid, Rib } from "./ribs"

export const DETAIL = {
  lav: { nt: 72, nz: 40, step: 4.2 },
  mid: { nt: 128, nz: 72, step: 2.6 },
  hog: { nt: 208, nz: 116, step: 1.7 },
} as const

/** kan/k: 0 = plateflate (tek beis), 1 = kutt (rå kryssfinér-kant) */
export type Soup = { pos: number[]; nrm: number[]; kan: number[]; k: number }
export const newSoup = (): Soup => ({ pos: [], nrm: [], kan: [], k: 1 })

export function tri(s: Soup, a: Vec3, b: Vec3, c: Vec3, n?: Vec3) {
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

/** trekant med sin eigen normal i kvart hjørne — det er dette som skil ei
 *  krum flate frå ei flate hoggen i fasettar */
export function tri3(s: Soup, a: Vec3, b: Vec3, c: Vec3, na: Vec3, nb: Vec3, nc: Vec3) {
  s.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
  s.nrm.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2])
  s.kan.push(s.k, s.k, s.k)
}

export function soupToMesh(s: Soup) {
  const positions = new Float32Array(s.pos)
  const normals = new Float32Array(s.nrm)
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k]
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
  }
  if (!Number.isFinite(min[0])) { min[0] = min[1] = min[2] = 0; max[0] = max[1] = max[2] = 1 }
  return { positions, normals, kant: new Float32Array(s.kan), tris: positions.length / 9, min, max }
}

// =============================================================================
// TRIANGULERING
// =============================================================================
/**
 * Øyreklipping. Polygonet er lite (kring to hundre hjørne), og ein
 * kvadratisk algoritme på to hundre hjørne er raskare enn å dra inn eit
 * bibliotek — og han er lesbar, som er den andre grunnen.
 */
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

/**
 * Eit hòl vert sydd inn i ytterkanten med ei bru fram og attende, så
 * polygonet framleis er eitt einfelt polygon. Brua er null brei og
 * forsvinn i trianguleringa.
 */
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
    // hòlet skal gå motsett veg av ytterkanten, elles er brua ein knute
    let a2 = 0
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      a2 += a[0] * b[1] - b[0] * a[1]
    }
    const r = a2 > 0 ? ring.slice().reverse() : ring
    poly = poly
      .slice(0, bi + 1)
      .concat(r, [r[0]], poly.slice(bi))
  }
  return poly
}

// =============================================================================
// FLATE — kroppen sleipt ned til éi flate
// =============================================================================
/** superellipse-punktet på einingssirkelen, med eksponenten n */
function superPt(th: number, n: number): [number, number] {
  const c = Math.cos(th)
  const s = Math.sin(th)
  const e = 2 / n
  return [Math.sign(c) * Math.pow(Math.abs(c), e), Math.sign(s) * Math.pow(Math.abs(s), e)]
}

export function shellMesh(b: Body, d: { nt: number; nz: number }) {
  const p = b.p
  const NT = d.nt
  const NZ = d.nz
  const NF = 6 // rader i setekantradien
  const r = Math.min(p.kantR, 40)

  // rekkja med punkt: golv → vegg → kantradius → sete → midt
  const grid: Vec3[][] = []
  const cols: { ux: number; uy: number; zRim: number }[] = []
  for (let i = 0; i < NT; i++) {
    const th = (i / NT) * Math.PI * 2
    const [sx, sy] = superPt(th, p.planN)
    // kanten er der veggen møter setet
    let lo = 0
    let hi = b.zTop
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2
      const rh = b.rho(m / b.zTop)
      const x = b.A * rh * sx
      const y = b.B * rh * sy
      if (b.seatSurf(x, y) > m) lo = m
      else hi = m
    }
    cols.push({ ux: sx, uy: sy, zRim: (lo + hi) / 2 })
  }

  const wallAt = (i: number, z: number): Vec3 => {
    const c = cols[i]
    const rh = b.rho(z / b.zTop)
    return [b.A * rh * c.ux, b.B * rh * c.uy, z]
  }

  for (let j = 0; j <= NZ; j++) {
    const row: Vec3[] = []
    for (let i = 0; i < NT; i++) {
      const zr = Math.max(0, cols[i].zRim - r)
      row.push(wallAt(i, (j / NZ) * zr))
    }
    grid.push(row)
  }
  // kantradien: ein kvartsirkel frå veggen inn på setet
  for (let f = 1; f <= NF; f++) {
    const a = (f / NF) * (Math.PI / 2)
    const row: Vec3[] = []
    for (let i = 0; i < NT; i++) {
      const c = cols[i]
      const w = wallAt(i, Math.max(0, c.zRim - r))
      const L = Math.hypot(w[0], w[1]) || 1
      const inx = -w[0] / L
      const iny = -w[1] / L
      row.push([
        w[0] + inx * r * (1 - Math.cos(a)),
        w[1] + iny * r * (1 - Math.cos(a)),
        w[2] + r * Math.sin(a),
      ])
    }
    grid.push(row)
  }
  // setet innover mot midten
  const rim = grid[grid.length - 1]
  // Midtpunktet er EITT punkt og ikkje ei rad. Ei rad med NT samanfallande
  // hjørne gjev NT utsvolta trekantar og dobbelt opp med retta kantar, og
  // eit slikt nett er ikkje lukka same kor tett det ser ut.
  const NS = Math.max(6, Math.round(NZ / 3))
  for (let s = 1; s < NS; s++) {
    const t = s / NS
    const row: Vec3[] = []
    for (let i = 0; i < NT; i++) {
      const x = rim[i][0] * (1 - t)
      const y = rim[i][1] * (1 - t)
      const z0 = rim[i][2]
      // nær kanten skal setet halde seg til radien det kom frå
      row.push([x, y, Math.min(z0, b.seatSurf(x, y))])
    }
    grid.push(row)
  }
  const mid: Vec3 = [0, 0, b.seatSurf(0, 0)]

  // glatte normalar: eit rutenett har naboar, og då treng ikkje ei krum
  // flate sjå ut som ho er hoggen i fasettar
  const R = grid.length
  const nrm: Vec3[][] = grid.map((row) => row.map(() => [0, 0, 0] as Vec3))
  const add = (j: number, i: number, n: Vec3) => {
    const v = nrm[j][i]
    v[0] += n[0]; v[1] += n[1]; v[2] += n[2]
  }
  const faceN = (a: Vec3, c: Vec3, e: Vec3): Vec3 => {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2]
    const vx = e[0] - a[0], vy = e[1] - a[1], vz = e[2] - a[2]
    const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    const L = Math.hypot(n[0], n[1], n[2]) || 1
    return [n[0] / L, n[1] / L, n[2] / L]
  }
  for (let j = 0; j < R - 1; j++) {
    for (let i = 0; i < NT; i++) {
      const i2 = (i + 1) % NT
      const n1 = faceN(grid[j][i], grid[j][i2], grid[j + 1][i])
      add(j, i, n1); add(j, i2, n1); add(j + 1, i, n1)
      const n2 = faceN(grid[j][i2], grid[j + 1][i2], grid[j + 1][i])
      add(j, i2, n2); add(j + 1, i2, n2); add(j + 1, i, n2)
    }
  }
  for (const row of nrm) {
    for (const v of row) {
      const L = Math.hypot(v[0], v[1], v[2]) || 1
      v[0] /= L; v[1] /= L; v[2] /= L
    }
  }

  const s = newSoup()
  for (let j = 0; j < R - 1; j++) {
    for (let i = 0; i < NT; i++) {
      const i2 = (i + 1) % NT
      tri3(s, grid[j][i], grid[j][i2], grid[j + 1][i], nrm[j][i], nrm[j][i2], nrm[j + 1][i])
      tri3(s, grid[j][i2], grid[j + 1][i2], grid[j + 1][i],
        nrm[j][i2], nrm[j + 1][i2], nrm[j + 1][i])
    }
  }
  // vifta inn til midtpunktet
  const last = grid[R - 1]
  const nMid: Vec3 = [0, 0, 1]
  for (let i = 0; i < NT; i++) {
    const i2 = (i + 1) % NT
    tri3(s, last[i], last[i2], mid, nrm[R - 1][i], nrm[R - 1][i2], nMid)
  }
  // golvet, så kroppen er lukka
  const base = grid[0]
  for (let i = 1; i < NT - 1; i++) {
    tri(s, base[0], base[i + 1], base[i], [0, 0, -1])
  }
  return soupToMesh(s)
}

// =============================================================================
// LAG — objektet slik det står
// =============================================================================
/**
 * Ribba som ei plate: to sider og ein kant heile vegen rundt.
 *
 * X-ribba legg profilen i (y, z) og Y-ribba i (x, z). Dei to plana er
 * spegelvende av kvarandre — y × z peikar langs +x, men x × z peikar langs
 * −y — så ein profil mot klokka gjev utoverpeikande trekantar i det eine
 * planet og innoverpeikande i det andre. Difor snur Y-familien vindinga.
 * Utan det er halve objektet eit hòl med negativt volum, og massen som
 * står i tabellen er skilnaden mellom dei to helvtene.
 */
export function ribSolid(s: Soup, r: Rib, t: number) {
  const h = t / 2
  const isX = r.axis === "x"
  const put = (q: Pt, off: number): Vec3 =>
    isX ? [r.pos + off, q[0], q[1]] : [q[0], r.pos + off, q[1]]
  const nAxis: Vec3 = isX ? [1, 0, 0] : [0, 1, 0]
  const nBack: Vec3 = isX ? [-1, 0, 0] : [0, -1, 0]
  /** snur trekanten for Y-familien */
  const T = (a: Vec3, b: Vec3, c: Vec3, n?: Vec3) =>
    isX ? tri(s, a, b, c, n) : tri(s, c, b, a, n)

  for (const o of r.outlines) {
    const merged = r.holes.length ? bridge(o, r.holes) : o
    s.k = 0 // platesidene — dei fine flatene som tek beis
    for (const [a, b, c] of earClip(merged)) {
      T(put(a, h), put(b, h), put(c, h), nAxis)
      T(put(c, -h), put(b, -h), put(a, -h), nBack)
    }
    s.k = 1 // kuttkantane — rå kryssfinér der fresen gjekk
    for (let i = 0; i < o.length; i++) {
      const a = o[i]
      const b = o[(i + 1) % o.length]
      T(put(a, -h), put(b, -h), put(b, h))
      T(put(a, -h), put(b, h), put(a, h))
    }
    for (const hole of r.holes) {
      for (let i = 0; i < hole.length; i++) {
        const a = hole[i]
        const b = hole[(i + 1) % hole.length]
        T(put(b, -h), put(a, -h), put(a, h))
        T(put(b, -h), put(a, h), put(b, h))
      }
    }
  }
}

export function lagMesh(g: Grid) {
  const s = newSoup()
  for (const r of g.ribs) ribSolid(s, r, g.b.p.ribbT)
  return soupToMesh(s)
}

// =============================================================================
// KONTUR — profilane flatt ved sida av kvarandre
// =============================================================================
export function contourLines(g: Grid): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const seg = (dst: number[], a: Vec3, b: Vec3) =>
    dst.push(a[0], a[1], a[2], b[0], b[1], b[2])
  const GAP = 26
  let x = 0
  for (const r of g.ribs) {
    const dst = r.axis === "x" ? bold : thin
    let w = 0
    for (const o of r.outlines) for (const q of o) w = Math.max(w, Math.abs(q[0]))
    for (const ring of [...r.outlines, ...r.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]
        const b = ring[(i + 1) % ring.length]
        seg(dst, [x + a[0], 0, a[1]], [x + b[0], 0, b[1]])
      }
    }
    x += 2 * w + GAP
  }
  // sentrer rekkja, elles står ho og dreg kameraet med seg
  const shift = -x / 2
  for (const arr of [thin, bold]) {
    for (let i = 0; i < arr.length; i += 3) arr[i] += shift
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}
