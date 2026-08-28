/**
 * LAFT — nettet, i tre lesemåtar.
 *
 *   lag     platene slik dei står, med tappar i spor. Dette ER objektet.
 *   flate   dei to flatene kroppen møter: setet og ryggen. LAFT nærmar
 *           seg ikkje ei krum flate — han seier at ei plate er ei plate —
 *           so «flate» her er dei to plana, og skilnaden på dei og «lag»
 *           er nettopp typologien sitt svar.
 *   kontur  dei fem kuttprofilane lagde flatt ved sida av kvarandre.
 *
 * Prismet er felles for alle platene: konturen som lok i begge endar og
 * ein vegg kring kvar ring. Lokket er PLATEFLATE (tek beis), veggen er
 * KUTT (rå finér) — merkinga fylgjer med som attributt, so materialet i
 * framsyninga veit kva som er kva utan å gisse.
 */
import type { Pt, Vec3 } from "../core"
import { bygg as byggProfil, tilVerda, type Bygg, type Del } from "./profil"
import type { Params } from "./params"

type Soup = { pos: number[]; nrm: number[]; kan: number[]; k: number }
const newSoup = (): Soup => ({ pos: [], nrm: [], kan: [], k: 1 })

/**
 * Ein trekant med normalen sin — og med VIKLINGA retta etter henne.
 *
 * Plana til delane har ikkje same handa: setet og lista har eit
 * høgrehendt (u, v, n), bladene og kilen eit venstrehendt, av di aksane
 * er valde etter kva som er naturleg å teikne i kvart plan. Same
 * viklingsrekkja gjev då motsett geometrisk normal i dei to tilfella, og
 * bakflatekutten i framsyninga et halve platene: det ein ser er innsida,
 * og innsida vender frå sola og er svart. Difor snur denne funksjonen
 * viklinga når ho ikkje er samd med normalen. Handa til planet er då eit
 * indre val i profilen, slik det skal vera, og ikkje noko nettet arvar.
 */
function tri(s: Soup, a: Vec3, b: Vec3, c: Vec3, n?: Vec3) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  let gx = uy * vz - uz * vy
  let gy = uz * vx - ux * vz
  let gz = ux * vy - uy * vx
  const L = Math.hypot(gx, gy, gz) || 1
  gx /= L; gy /= L; gz /= L
  let nx = gx, ny = gy, nz = gz
  let snu = false
  if (n) {
    ;[nx, ny, nz] = n
    snu = nx * gx + ny * gy + nz * gz < 0
  }
  const p = snu ? [a, c, b] : [a, b, c]
  for (const q of p) s.pos.push(q[0], q[1], q[2])
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
  return { positions, normals, kant: new Float32Array(s.kan), tris: positions.length / 9, min, max }
}

// =============================================================================
// TRIANGULERING — same øyreklipping som dei andre motorane, av same grunn
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

/** hòl sydde inn i ytterkanten med null-breie bruer */
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
// EI PLATE SOM PRISME
// =============================================================================
function plateSolid(s: Soup, d: Del) {
  const t = d.t
  const at = (q: Pt, w: number) => tilVerda(d.plass, q, w)
  const n = d.plass.n
  const bak: Vec3 = [-n[0], -n[1], -n[2]]
  // plateflatene: framsida og baksida
  s.k = 0
  const merged = d.holes.length ? bridge(d.outline, d.holes) : d.outline
  for (const [a, b, c] of earClip(merged)) {
    tri(s, at(a, t), at(c, t), at(b, t), n)
    tri(s, at(a, 0), at(b, 0), at(c, 0), bak)
  }
  // kuttet: ytterkanten og kvar ring i hòla
  s.k = 1
  for (const ring of [d.outline, ...d.holes]) vegg(s, d, ring)
}

/** Ein vegg kring ein ring, med utovernormalen rekna i PLANET: for ei
 *  rekkje mot klokka ligg utsida til høgre for gangretninga, og det held
 *  same kva hand planet har. Hòla går motsett veg, og då snur normalen
 *  seg av seg sjølv — akkurat slik han skal. */
function vegg(s: Soup, d: Del, ring: Pt[]) {
  const at = (q: Pt, w: number) => tilVerda(d.plass, q, w)
  const { u, v } = d.plass
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy)
    if (L < 1e-9) continue
    const ex = dy / L
    const ey = -dx / L
    const n: Vec3 = [
      u[0] * ex + v[0] * ey,
      u[1] * ex + v[1] * ey,
      u[2] * ex + v[2] * ey,
    ]
    tri(s, at(a, 0), at(b, d.t), at(b, 0), n)
    tri(s, at(a, 0), at(a, d.t), at(b, d.t), n)
  }
}

/** platene slik dei står */
export function lagMesh(b: Bygg) {
  const s = newSoup()
  for (const d of b.delar) plateSolid(s, d)
  return soupToMesh(s)
}

/**
 * Dei to flatene kroppen møter. Ikkje ein tilnærma krum flate — LAFT har
 * ingen — men setet og ryggen som dei plana dei ER, utan spor og utan
 * hòl: det ein kjenner mot kroppen, reinska for produksjon.
 */
export function flateMesh(b: Bygg) {
  const s = newSoup()
  s.k = 0
  for (const d of b.delar) {
    if (d.kind !== "sete" && d.kind !== "rygg") continue
    const at = (q: Pt, w: number) => tilVerda(d.plass, q, w)
    const n = d.plass.n
    const bak: Vec3 = [-n[0], -n[1], -n[2]]
    for (const [a, c, e] of earClip(d.outline)) {
      tri(s, at(a, d.t), at(e, d.t), at(c, d.t), n)
      tri(s, at(a, 0), at(c, 0), at(e, 0), bak)
    }
    vegg(s, d, d.outline)
  }
  return soupToMesh(s)
}

/**
 * Dei flate kuttprofilane.
 *
 * Dei andre motorane legg profilane sine på EI line, og det gjeng bra der
 * delane er mange og små. LAFT har fem delar og dei er store: ei line
 * vert to meter brei og ti centimeter høg, og innramminga — som reknar
 * avstand av halvdiagonalen — dyttar kameraet så langt bak at ho slår i
 * taket sitt og kuttar teikninga i begge endar. Difor bryt LAFT lina i
 * rader: målet er ei teikning som er om lag like brei som høg, av di det
 * er den forma eit lerret har.
 */
export function contourLines(b: Bygg): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const GAP = 40
  const boks = b.delar.map((d) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const q of d.outline) {
      if (q[0] < x0) x0 = q[0]
      if (q[0] > x1) x1 = q[0]
      if (q[1] < y0) y0 = q[1]
      if (q[1] > y1) y1 = q[1]
    }
    return { x0, y0, w: x1 - x0, h: y1 - y0 }
  })
  const sumB = boks.reduce((s, q) => s + q.w + GAP, -GAP)
  const maxH = boks.reduce((s, q) => Math.max(s, q.h), 1)
  // så mange rader at rekkja vert om lag kvadratisk
  const rader = Math.max(1, Math.min(boks.length, Math.round(Math.sqrt(sumB / maxH))))
  const maalB = sumB / rader
  let x = 0
  let y = 0
  let radH = 0
  let breidd = 0
  b.delar.forEach((d, i) => {
    const q = boks[i]
    if (x > 0 && x + q.w > maalB) {
      y += radH + GAP
      x = 0
      radH = 0
    }
    const dst = i === 0 ? bold : thin
    const seg = (a: Pt, c: Pt) =>
      dst.push(x - q.x0 + a[0], 0, y + a[1] - q.y0, x - q.x0 + c[0], 0, y + c[1] - q.y0)
    for (const ring of [d.outline, ...d.holes]) {
      for (let k = 0; k < ring.length; k++) seg(ring[k], ring[(k + 1) % ring.length])
    }
    x += q.w + GAP
    if (x - GAP > breidd) breidd = x - GAP
    if (q.h > radH) radH = q.h
  })
  const skift = -breidd / 2
  for (const arr of [thin, bold]) {
    for (let i = 0; i < arr.length; i += 3) arr[i] += skift
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}

export const bygg = byggProfil
export type { Bygg, Params }
