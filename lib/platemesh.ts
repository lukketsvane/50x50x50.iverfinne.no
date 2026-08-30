/**
 * EI PLATE SOM PRISME — nettet under alle motorar som byggjer av plater.
 *
 * Fila låg under lib/laft/ til VIKING vart bygd, og stod att då LAFT
 * gjekk ut. Ingenting i henne veit kva ho teiknar: ho tek eit omriss,
 * nokre hòl, eit plan og ei tjukn, og gjev eit prisme. Øyreklippinga,
 * hòlbrua og veggnormalane er dei tre tinga som er vonde å få rett —
 * kollineære punkt som forsvinn i klippet men ikkje i veggen, hòl som
 * må bruast inn i omrisset utan å kollapse trianguleringa, plan med
 * ulik hand — og dei skal skrivast éin gong.
 *
 * Lokket er PLATEFLATE (tek beis), veggen er KUTT (rå finér). Merkinga
 * fylgjer med som attributt, so materialet i framsyninga veit kva som er
 * kva utan å gisse.
 */
import type { Pt, Vec3 } from "./core"
import { tilVerda, type Plass } from "./plater"

/**
 * REINSK EIN RING FØR HAN VERT TIL NETT.
 *
 * Øyreklippinga kastar kollineære hjørne; veggen gjer det ikkje. Står det
 * tre punkt på line i eit omriss, lagar lokket ein kant frå det fyrste
 * til det siste medan veggen går innom det midtre — og skalet får eit hòl
 * nøyaktig der. Difor skal kvar ring reinskast ÉIN gong, før begge les
 * han, so dei ser same lista.
 */
export function reinsk(ring: Pt[], eps = 0.02): Pt[] {
  const ut: Pt[] = []
  for (const q of ring) {
    const f = ut[ut.length - 1]
    if (f && Math.hypot(q[0] - f[0], q[1] - f[1]) < eps) continue
    ut.push(q)
  }
  while (ut.length > 1 && Math.hypot(ut[0][0] - ut[ut.length - 1][0], ut[0][1] - ut[ut.length - 1][1]) < eps) {
    ut.pop()
  }
  const rein: Pt[] = []
  const n = ut.length
  for (let i = 0; i < n; i++) {
    const a = ut[(i + n - 1) % n]
    const b = ut[i]
    const c = ut[(i + 1) % n]
    const cc = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if (Math.abs(cc) < eps * 4) continue
    rein.push(b)
  }
  return rein.length >= 3 ? rein : ut
}

/** alt nettet treng vita om ein del */
export type Plate = { outline: Pt[]; holes: Pt[][]; plass: Plass; t: number }

export type Soup = { pos: number[]; nrm: number[]; kan: number[]; k: number }
export const newSoup = (): Soup => ({ pos: [], nrm: [], kan: [], k: 1 })

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
export function tri(s: Soup, a: Vec3, b: Vec3, c: Vec3, n?: Vec3) {
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

export function soupToMesh(s: Soup) {
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
export function earClip(poly: Pt[]): [Pt, Pt, Pt][] {
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
      // Tre punkt på line er ikkje ein trekant. Slepp ein slik gjennom,
      // og skalet får ein flate utan areal: kvar kant vert gått to
      // gonger same veg, og lukkeprøva finn både dobbel og hòl.
      if (Math.abs(cc) < 1e-9) {
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
  // Same prøva på den SISTE trekanten. Vert han sleppt gjennom utan
  // arealprøve, er det nettopp der eit flatt øyre hamnar — det siste som
  // står att av eit omriss med ei rett line i seg er ofte tre punkt på
  // rekkje, og då er hòlet i skalet på den eine plata som har ei slik
  // line: skuldra på ryggen.
  if (idx.length === 3) {
    const [a, b, c] = [poly[idx[0]], poly[idx[1]], poly[idx[2]]]
    if (Math.abs(cross(a, b, c)) > 1e-9) out.push([a, b, c])
  }
  return out
}

/** hòl sydde inn i ytterkanten med null-breie bruer */
export function bridge(outline: Pt[], holes: Pt[][]): Pt[] {
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
export function plateSolid(s: Soup, d: Plate) {
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
export function vegg(s: Soup, d: Plate, ring: Pt[]) {
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


/** eit knippe plater som eitt nett */
export function plateMesh(delar: readonly Plate[]) {
  const s = newSoup()
  for (const d of delar) plateSolid(s, d)
  return soupToMesh(s)
}
