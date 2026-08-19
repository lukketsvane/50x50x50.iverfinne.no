/**
 * SANDKASSE — SVG ut.
 *
 * Rein streng, ingen bibliotek. Brukareininga ER millimeteren: viewBox står
 * i mm, breidda står i mm, og strekbreidda står i mm. Det gjer at fila kan
 * gå rett i ein skjerar eller på ein plottar utan at nokon må gjette
 * målestokken undervegs.
 *
 * Svart strek på kvitt, ingen fyll. Ei teikning som er fylt kan ikkje
 * lesast som kutt.
 */
import { makeShell, planArcs, type Shell } from "./field"
import type { Pt, Stack } from "./laminae"
import { placedRings, type Nesting } from "./nest"
import type { Params } from "./params"

const DEG = Math.PI / 180

// =============================================================================
// KONTURKARTET
// =============================================================================
/**
 * Alle laga lagde oppå kvarandre, sett ovanfrå. Kvart femte lag med heil
 * strek, resten tynt.
 *
 * Dette er samstundes plan og kuttdata, og det er det mest lesbare snittet
 * gjennom eit objekt som ikkje har ein einaste rett kant å måle frå: der
 * konturane ligg tett, står veggen bratt; der dei sprikjer, legg han seg.
 * Ein les stigninga av avstanden mellom strekane, slik ein les eit
 * høgdekart.
 *
 * `every` er kor ofte den tunge streken kjem, `w` er breidda på det ferdige
 * biletet i millimeter (utan han vert det 1:1).
 */
export function contourMapSvg(
  stack: Stack,
  opts: { every?: number; w?: number } = {},
): string {
  const every = Math.max(1, Math.round(opts.every ?? 5))
  const B = new Box()
  for (const L of stack.layers) for (const q of L.parts) B.add(q.outline)
  const vb = B.pad(12)
  const k = scale(vb.w, opts.w)

  const thin: string[] = []
  const thick: string[] = []
  for (const L of stack.layers) {
    const to = L.i % every === 0 ? thick : thin
    for (const q of L.parts) {
      to.push(path(q.outline))
      for (const h of q.holes) to.push(path(h))
    }
  }

  return wrap(vb, opts.w, [
    group(thin, 0.12 * k),
    group(thick, 0.5 * k),
  ])
}

// =============================================================================
// KUTTARKET
// =============================================================================
/** Eitt ark, 1:1, med plateomriss, delekonturar og delenummer. */
export function sheetSvg(nesting: Nesting, i: number): string {
  const sheet = nesting.sheets[i]
  if (!sheet) return wrap({ x: 0, y: 0, w: 10, h: 10 }, undefined, [])

  const vb = { x: -12, y: -sheet.h - 12, w: sheet.w + 24, h: sheet.h + 24 }
  const plate = path([
    [0, 0],
    [sheet.w, 0],
    [sheet.w, sheet.h],
    [0, sheet.h],
  ])

  const cuts: string[] = []
  const marks: string[] = []
  for (const q of sheet.placed) {
    const r = placedRings(q)
    cuts.push(path(r.outline))
    for (const h of r.holes) cuts.push(path(h))
    const c = middle(r.outline)
    marks.push(
      `<text x="${n(c[0])}" y="${n(-c[1])}" font-family="sans-serif"` +
        ` font-size="9" text-anchor="middle" fill="#000">` +
        `${q.part.layer + 1}.${q.part.index + 1}</text>`,
    )
  }

  // brukt lengd: streken der pakkinga sluttar og resten av plata står att
  const cut = path(
    [
      [0, sheet.used],
      [sheet.w, sheet.used],
    ],
    false,
  )

  return wrap(vb, undefined, [
    group([plate], 0.5),
    `<g fill="none" stroke="#000" stroke-width="0.3" stroke-dasharray="6 4">${cut}</g>`,
    group(cuts, 0.3),
    marks.join(""),
  ])
}

// =============================================================================
// OPPRISSET
// =============================================================================
/**
 * Silhuetten sett frå vinkelen `dir`, i grader kring aksen.
 *
 * Skuggen av eit vassrett snitt er alltid eitt samanhengande intervall —
 * ein ring kastar full skugge, for strålen som går gjennom hòlet treffer
 * framveggen og bakveggen — så oppriset kan byggjast av snitt utan at
 * nokon strålar må sporast. Der laget er delt i tre bein, er intervalla
 * tre, og då opnar beinopningane seg i silhuetten slik dei skal.
 *
 * Snitta vert rasterte og kanten spora langs rutenettet. Trappa som då
 * oppstår er ikkje objektet, ho er målestokken vår, difor vert lykkjene
 * runda av til slutt.
 */
export function elevationSvg(p: Params, dir: number): string {
  const sh = makeShell(p)
  const NZ = 176
  const NU = 320
  const dz = sh.zTop / NZ
  const ux = Math.sin(dir * DEG)
  const uy = -Math.cos(dir * DEG)
  const u = (x: number, y: number) => x * ux + y * uy

  const rows: [number, number][][] = []
  let lo = Infinity
  let hi = -Infinity
  for (let r = 0; r < NZ; r++) {
    const z = (r + 0.5) * dz
    const iv: [number, number][] = []
    const [cx, cy] = sh.spine(sh.hOf(z))
    for (const run of planArcs(sh, z, 288)) {
      let a = Infinity
      let b = -Infinity
      for (const q of run) {
        const c = Math.cos(q.th)
        const s = Math.sin(q.th)
        for (const rr of [q.ro, q.ri]) {
          const v = u(cx + rr * c, cy + rr * s)
          if (v < a) a = v
          if (v > b) b = v
        }
      }
      if (b > a) iv.push([a, b])
    }
    const seat = seatSpan(sh, p, z, u)
    if (seat) iv.push(seat)
    const m = merge(iv)
    for (const q of m) {
      if (q[0] < lo) lo = q[0]
      if (q[1] > hi) hi = q[1]
    }
    rows.push(m)
  }
  if (!Number.isFinite(lo)) return wrap({ x: 0, y: 0, w: 10, h: 10 }, undefined, [])

  lo -= 2
  hi += 2
  const du = (hi - lo) / NU
  const occ = new Uint8Array(NU * NZ)
  for (let r = 0; r < NZ; r++) {
    for (const q of rows[r]) {
      const c0 = Math.max(0, Math.floor((q[0] - lo) / du))
      const c1 = Math.min(NU - 1, Math.ceil((q[1] - lo) / du) - 1)
      for (let c = c0; c <= c1; c++) occ[r * NU + c] = 1
    }
  }

  const loops = trace(occ, NU, NZ)
    .map((L) => L.map((v): Pt => [lo + v[0] * du, v[1] * dz]))
    .filter((L) => L.length >= 8)
    .map((L) => chaikin(chaikin(L)))

  const vb = { x: lo - 8, y: -sh.zTop - 8, w: hi - lo + 16, h: sh.zTop + 16 }
  return wrap(vb, undefined, [group(loops.map((L) => path(L)), 0.5)])
}

/** Skuggen av setet ved høgda z. Skåla er monoton i q, så snittet vert
 *  funne ved halvering i staden for å blottleggja eksponenten. */
function seatSpan(
  sh: Shell,
  p: Params,
  z: number,
  u: (x: number, y: number) => number,
): [number, number] | null {
  if (z < p.seatZ - p.dish - p.shellT || z > p.seatZ) return null
  let a = Infinity
  let b = -Infinity
  const [cx, cy] = sh.spine(sh.hOf(z))
  for (let i = 0; i < 144; i++) {
    const th = (i / 144) * Math.PI * 2
    const z0 = sh.dishZ(th, 0)
    const z1 = sh.dishZ(th, 1)
    if (z1 - z0 < 1e-6) continue
    const inv = (t: number) => {
      if (t <= z0) return 0
      if (t >= z1) return 1
      let x0 = 0
      let x1 = 1
      for (let k = 0; k < 22; k++) {
        const m = (x0 + x1) / 2
        if (sh.dishZ(th, m) < t) x0 = m
        else x1 = m
      }
      return (x0 + x1) / 2
    }
    const qa = inv(z)
    const qb = inv(z + p.shellT)
    if (qb <= qa) continue
    const rT = sh.rOuter(th, sh.seatEdgeZ(th)) + p.lip
    const c = Math.cos(th)
    const s = Math.sin(th)
    for (const q of [qa, qb]) {
      const v = u(cx + q * rT * c, cy + q * rT * s)
      if (v < a) a = v
      if (v > b) b = v
    }
  }
  return b > a ? [a, b] : null
}

// =============================================================================
// FELLES
// =============================================================================
type Vb = { x: number; y: number; w: number; h: number }

class Box {
  x0 = Infinity
  y0 = Infinity
  x1 = -Infinity
  y1 = -Infinity
  add(pts: Pt[]) {
    for (const q of pts) {
      if (q[0] < this.x0) this.x0 = q[0]
      if (q[0] > this.x1) this.x1 = q[0]
      if (q[1] < this.y0) this.y0 = q[1]
      if (q[1] > this.y1) this.y1 = q[1]
    }
  }
  /** viewBox i skjermkoordinatar: y er spegla, sjå `path` */
  pad(m: number): Vb {
    if (!Number.isFinite(this.x0)) return { x: 0, y: 0, w: 10, h: 10 }
    return {
      x: this.x0 - m,
      y: -this.y1 - m,
      w: this.x1 - this.x0 + 2 * m,
      h: this.y1 - this.y0 + 2 * m,
    }
  }
}

/** Strekbreidda skal vere den same på papiret same kva målestokk teikninga
 *  står i, difor vert ho gonga opp når biletet vert krympa. */
const scale = (natural: number, want?: number) =>
  want && want > 0 ? natural / want : 1

const n = (v: number) => (Math.abs(v) < 5e-4 ? "0" : v.toFixed(3).replace(/\.?0+$/, ""))

/** Modellen har y oppover, SVG har y nedover. Vi snur teiknet på y i staden
 *  for å leggje inn ein transform — då står tekst framleis rett veg. */
function path(pts: Pt[], close = true): string {
  if (pts.length < 2) return ""
  let s = `M${n(pts[0][0])} ${n(-pts[0][1])}`
  for (let i = 1; i < pts.length; i++) s += `L${n(pts[i][0])} ${n(-pts[i][1])}`
  return `<path d="${s}${close ? "Z" : ""}"/>`
}

const group = (body: string[], sw: number) =>
  body.length
    ? `<g fill="none" stroke="#000" stroke-width="${n(sw)}" stroke-linejoin="round">${body.join("")}</g>`
    : ""

function wrap(vb: Vb, want: number | undefined, body: string[]): string {
  const w = want && want > 0 ? want : vb.w
  const h = (w * vb.h) / vb.w
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}mm" height="${n(h)}mm"` +
    ` viewBox="${n(vb.x)} ${n(vb.y)} ${n(vb.w)} ${n(vb.h)}">` +
    `<rect x="${n(vb.x)}" y="${n(vb.y)}" width="${n(vb.w)}" height="${n(vb.h)}" fill="#fff"/>` +
    body.join("") +
    `</svg>`
  )
}

const middle = (pts: Pt[]): Pt => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const q of pts) {
    if (q[0] < x0) x0 = q[0]
    if (q[0] > x1) x1 = q[0]
    if (q[1] < y0) y0 = q[1]
    if (q[1] > y1) y1 = q[1]
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2]
}

function merge(iv: [number, number][]): [number, number][] {
  const s = iv.slice().sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  for (const q of s) {
    const last = out[out.length - 1]
    if (last && q[0] <= last[1]) last[1] = Math.max(last[1], q[1])
    else out.push([q[0], q[1]])
  }
  return out
}

/**
 * Kanten kring det fylte området. Kvar fylt rute legg dei fire kantane
 * sine inn mot klokka; møtest to ruter, står kantane deira mot kvarandre og
 * strykar kvarandre ut. Det som står att er nett randa — også kring hòl, og
 * utan noko val av startpunkt.
 */
function trace(occ: Uint8Array, nu: number, nz: number): [number, number][][] {
  const W = nu + 1
  const id = (c: number, r: number) => r * W + c
  const V = W * (nz + 1)
  const edges = new Set<number>()
  const put = (a: number, b: number) => {
    if (edges.delete(b * V + a)) return
    edges.add(a * V + b)
  }
  for (let r = 0; r < nz; r++) {
    for (let c = 0; c < nu; c++) {
      if (!occ[r * nu + c]) continue
      const a = id(c, r)
      const b = id(c + 1, r)
      const d = id(c + 1, r + 1)
      const e = id(c, r + 1)
      put(a, b)
      put(b, d)
      put(d, e)
      put(e, a)
    }
  }
  const next = new Map<number, number[]>()
  for (const k of edges) {
    const a = Math.floor(k / V)
    const b = k % V
    const list = next.get(a)
    if (list) list.push(b)
    else next.set(a, [b])
  }
  const loops: [number, number][][] = []
  for (const [start] of next) {
    for (;;) {
      const first = next.get(start)
      if (!first || first.length === 0) break
      const loop: [number, number][] = []
      let at = start
      for (let guard = 0; guard < 1e6; guard++) {
        const list = next.get(at)
        if (!list || list.length === 0) break
        const to = list.pop()
        if (to === undefined) break
        loop.push([at % W, Math.floor(at / W)])
        at = to
        if (at === start) break
      }
      if (loop.length >= 4) loops.push(loop)
    }
  }
  return loops
}

/** eitt Chaikin-steg: hjørna kappa på fjerdedelane, lykkja held seg lukka */
function chaikin(loop: Pt[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
    out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
  }
  return out
}
