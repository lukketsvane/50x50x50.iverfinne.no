/**
 * RIBBE — dei flate delane.
 *
 * Alt i objektet er skore ut av plate, og det er her plata er. Kvar del er
 * ein lukka kontur i sitt eige plan pluss dei hòla ho har; alt anna —
 * kuttark, DXF, SVG, materialliste og masse — er funksjonar av denne lista.
 *
 * Konturane kjem frå dei SAME stasjonane som nettet vert bygd av. Det er
 * ikkje ei effektivisering: det er den einaste måten teikninga og kuttfila
 * ikkje kan kome i utakt på.
 *
 * Éin ting står i kuttfila og ikkje i nettet, og det skal seiast høgt:
 * avlastinga i dei indre hjørna. Ho er ei boring på seks millimeter som
 * bit seg inn i tre kvadrantar kring hjørnet, og eit slikt utsnitt er ikkje
 * lenger eit band mellom to kurver — det er ei øy. Nettet er bygd av band,
 * så nettet viser sporet med skarpe hjørne, og fila som styrer fresen
 * viser det med avlasting. Det er nett den vegen feilen må gå: fresen får
 * det rette, og lesaren får det leselege.
 */
import { shoelace, type Pt } from "../core"
import type { Shell } from "./shell"
import type { Built } from "./mesh"
import { outlineOf } from "./mesh"

export type Part = {
  /** delnummer — like delar deler nummer, av di dei er like */
  id: string
  outline: Pt[]
  holes: Pt[][]
  /** platetjukn, mm */
  t: number
  /** netto areal, mm² */
  area: number
  /** kg */
  mass: number
}

export type PartList = {
  parts: Part[]
  /** unike delnummer i rekkjefylgje */
  ids: string[]
  area: number // mm² i alt
  mass: number // kg i alt
}

// =============================================================================
// AVLASTING I INDRE HJØRNE
// =============================================================================
/**
 * Ein fres kan ikkje lage eit skarpt innvendig hjørne. Utan avlasting vert
 * delane ståande tre millimeter frå kvarandre — ti gonger klaringa — av di
 * radien i hjørnet er full fresediameter.
 *
 * Kvart indre hjørne vert difor bytt ut med ein 270-graders boge kring
 * hjørnepunktet. Hjørna vert funne på polygonet sjølv og ikkje oppgjevne
 * frå geometrien: eit indre hjørne er ein punkt der konturen svingar mot
 * materialet, og det er sant same kva del ein ser på.
 */
export function relieveCorners(poly: Pt[], r: number, minTurn = 0.6): Pt[] {
  const n = poly.length
  if (n < 6 || r <= 0.05) return poly
  const ccw = shoelace(poly) > 0
  const at = (i: number) => poly[((i % n) + n) % n]
  const out: Pt[] = []
  const skip = new Set<number>()
  const arcs = new Map<number, Pt[]>()

  for (let i = 0; i < n; i++) {
    // gå bakover og framover til boglengda r, slik at eit tett samla
    // hjørne vert lese som eitt hjørne og ikkje som femten små svingar
    const walk = (dir: number): { p: Pt; steps: number } | null => {
      let acc = 0
      let j = i
      for (let s = 0; s < 40; s++) {
        const a = at(j)
        const b = at(j + dir)
        const L = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (acc + L >= r) {
          const t = (r - acc) / (L || 1)
          return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], steps: s }
        }
        acc += L
        j += dir
      }
      return null
    }
    const back = walk(-1)
    const fwd = walk(1)
    if (!back || !fwd) continue
    const c = at(i)
    const d1: Pt = [c[0] - back.p[0], c[1] - back.p[1]]
    const d2: Pt = [fwd.p[0] - c[0], fwd.p[1] - c[1]]
    const cr = d1[0] * d2[1] - d1[1] * d2[0]
    const dot = d1[0] * d2[0] + d1[1] * d2[1]
    const turn = Math.atan2(cr, dot)
    // indre hjørne: konturen svingar mot materialet
    if ((ccw ? turn : -turn) > -minTurn) continue
    if (back.steps > 6 || fwd.steps > 6) continue

    const a0 = Math.atan2(back.p[1] - c[1], back.p[0] - c[0])
    const a1 = Math.atan2(fwd.p[1] - c[1], fwd.p[0] - c[0])
    // sveipet skal gå den lange vegen, gjennom materialet
    let sweep = a1 - a0
    while (sweep <= 0) sweep += Math.PI * 2
    if (ccw) sweep -= Math.PI * 2
    const steps = Math.max(6, Math.round((Math.abs(sweep) / Math.PI) * 12))
    const arc: Pt[] = []
    for (let s = 0; s <= steps; s++) {
      const a = a0 + (sweep * s) / steps
      arc.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)])
    }
    arcs.set(i, arc)
    for (let s = 1; s <= back.steps; s++) skip.add(((i - s) % n + n) % n)
    for (let s = 1; s <= fwd.steps; s++) skip.add((i + s) % n)
  }

  if (arcs.size === 0) return poly
  for (let i = 0; i < n; i++) {
    const a = arcs.get(i)
    if (a) out.push(...a)
    else if (!skip.has(i)) out.push(poly[i])
  }
  return out
}

// =============================================================================
// LISTA
// =============================================================================
const areaOf = (outline: Pt[], holes: Pt[][]) =>
  Math.abs(shoelace(outline)) - holes.reduce((s, h) => s + Math.abs(shoelace(h)), 0)

/** Signaturen skil delar frå kvarandre slik ein plukkar dei: er dei like på
 *  millimeteren i omriss og areal, er dei same delen. */
const sign = (p: { outline: Pt[]; area: number; t: number }) => {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const q of p.outline) {
    if (q[0] < x0) x0 = q[0]
    if (q[0] > x1) x1 = q[0]
    if (q[1] < y0) y0 = q[1]
    if (q[1] > y1) y1 = q[1]
  }
  return [x1 - x0, y1 - y0, p.area / 100, p.t].map((v) => Math.round(v)).join("/")
}

export function buildParts(sh: Shell, g: Built, rho: number): PartList {
  const p = sh.p
  const rel = p.relief / 2
  const raw: { kind: string; outline: Pt[]; holes: Pt[][]; t: number }[] = []

  for (const bl of g.blades) {
    const holes: Pt[][] = []
    if (bl.mortise) holes.push(bl.mortise)
    raw.push({
      kind: "R",
      outline: relieveCorners(outlineOf(bl), rel),
      holes,
      t: p.bladeT,
    })
  }
  for (const bd of g.bands) {
    const outer: Pt[] = bd.st.map((q): Pt => [q.b * Math.cos(q.u), q.b * Math.sin(q.u)])
    const inner: Pt[] = bd.st
      .map((q): Pt => [q.a * Math.cos(q.u), q.a * Math.sin(q.u)])
      .reverse()
    raw.push({ kind: "B", outline: outer, holes: [relieveCorners(inner, rel)], t: p.bandT })
  }
  raw.push({ kind: "S", outline: g.seat.outline, holes: [], t: p.seatT })

  // Kilane står på kvart tredje blad, over øvste bandet, og dreg det ned mot
  // sporbotnen. Dei er det einaste i objektet som ikkje er finér — ask toler
  // å verta slegen på, og kila kan slåast til att når finéren har sett seg.
  //
  // Mortisen er derimot skoren i ALLE blada. Eit blad utan mortis er ein
  // annan del, og å spara fjorten hol på fjorten kvadratcentimeter ville
  // doble talet på unike bladprofilar. Delelista er dyrare enn hola.
  const wedge = g.blades[0]?.mortise
  if (wedge) {
    const w = Math.abs(wedge[1][0] - wedge[0][0])
    const h = Math.abs(wedge[2][1] - wedge[1][1])
    const nW = Math.max(1, Math.ceil(sh.angles.length / 3))
    for (let i = 0; i < nW; i++) {
      raw.push({
        kind: "K",
        outline: [
          [0, 0],
          [w, 0],
          [w * 0.62, h * 1.6],
          [0, h * 1.6],
        ],
        holes: [],
        t: Math.max(4, p.bladeT - 1),
      })
    }
  }

  // nummerering: like delar får same nummer, i den rekkjefylgja dei dukkar
  // opp — det er den rekkjefylgja ein plukkar dei i
  const seen = new Map<string, string>()
  const count = new Map<string, number>()
  const parts: Part[] = []
  const ids: string[] = []
  for (const r of raw) {
    const area = areaOf(r.outline, r.holes)
    const s = r.kind + "/" + sign({ outline: r.outline, area, t: r.t })
    let id = seen.get(s)
    if (!id) {
      const c = (count.get(r.kind) ?? 0) + 1
      count.set(r.kind, c)
      id = r.kind + c
      seen.set(s, id)
      ids.push(id)
    }
    parts.push({
      id,
      outline: r.outline,
      holes: r.holes,
      t: r.t,
      area,
      mass: (area * r.t * rho) / 1e9,
    })
  }

  return {
    parts,
    ids,
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
