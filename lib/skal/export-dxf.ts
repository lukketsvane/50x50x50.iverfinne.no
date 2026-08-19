/**
 * SANDKASSE — DXF ut.
 *
 * R12 ASCII, millimeter, to lag: KUTT og GRAVER. R12 er gamalt og fattig,
 * og nett difor rett: LWPOLYLINE kom fyrst i R13, så eldre fresprogram og
 * laserpanel les han ikkje. POLYLINE med VERTEX og SEQEND opnar alle stader.
 * Fila vert større; det er ein pris verd å betale for at ho let seg køyre.
 *
 * Arka ligg etter kvarandre oppover i Y med ei luke mellom, så eitt uttak
 * kan innehalde heile jobben.
 *
 * SNITTBREIDDA
 * Fresen har breidd. Køyrer senteret langs den nominelle konturen, et
 * halve snittet seg inn i delen på kvar side, og delen kjem ut ein heil
 * snittbreidd for lita. Det er ikkje ein finess: det smalaste godset i
 * stabelen er kring 5 mm, og 3 mm av det er meir enn halve veggen. Difor
 * vert ytre konturar flytte kerf/2 utover og hòl kerf/2 innover.
 */
import { shoelace, type Pt, type Stack } from "./laminae"
import { placedRings, type Nesting, type Placed } from "./nest"

/** luka mellom arka i uttaket, mm */
const SHEET_GAP = 200

export function stackToDxf(stack: Stack, nesting: Nesting, kerf = 3): string {
  const out: string[] = []
  const h = kerf / 2
  const pitch = nesting.sheetH + SHEET_GAP
  const extY = nesting.sheets.length * pitch

  head(out, nesting.sheetW, Math.max(nesting.sheetH, extY))

  nesting.sheets.forEach((sheet, i) => {
    const oy = i * pitch
    // plateomrisset står på GRAVER: det er ei opplysning, ikkje eit kutt
    poly(
      out,
      "GRAVER",
      [
        [0, oy],
        [sheet.w, oy],
        [sheet.w, oy + sheet.h],
        [0, oy + sheet.h],
      ],
      true,
    )
    text(
      out,
      "GRAVER",
      [sheet.w / 2, oy + sheet.h - 26],
      18,
      `ARK ${i + 1}/${nesting.sheets.length}  ${fmtT(stack.plyT)} MM`,
    )

    for (const q of sheet.placed) {
      const r = placedRings({ ...q, y: q.y + oy })
      poly(out, "KUTT", offsetPoly(r.outline, +h), true)
      for (const hole of r.holes) poly(out, "KUTT", offsetPoly(hole, -h), true)
      label(out, q, r.outline, r.holes)
    }
  })

  out.push("0", "ENDSEC", "0", "EOF")
  return out.join("\r\n") + "\r\n"
}

// =============================================================================
// DXF-STILLAS
// =============================================================================
const f = (v: number) => (Math.abs(v) < 1e-9 ? "0.0" : v.toFixed(4))
const fmtT = (v: number) => String(+v.toFixed(2))

function head(out: string[], w: number, h: number) {
  out.push(
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    // $INSUNITS kom fyrst i R14, men ukjende hovudvariablar vert hoppa over;
    // utan han står det ingen stad i fila at tala er millimeter.
    "9", "$INSUNITS", "70", "4",
    "9", "$EXTMIN", "10", "0.0", "20", "0.0", "30", "0.0",
    "9", "$EXTMAX", "10", f(w), "20", f(h), "30", "0.0",
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LAYER", "70", "2",
    "0", "LAYER", "2", "KUTT", "70", "0", "62", "1", "6", "CONTINUOUS",
    "0", "LAYER", "2", "GRAVER", "70", "0", "62", "3", "6", "CONTINUOUS",
    "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
  )
}

function poly(out: string[], layer: string, pts: Pt[], closed: boolean) {
  if (pts.length < 2) return
  out.push(
    "0", "POLYLINE", "8", layer,
    "66", "1", // hjørna fylgjer som eigne VERTEX-entitetar
    "70", closed ? "1" : "0",
    "10", "0.0", "20", "0.0", "30", "0.0",
  )
  for (const q of pts) {
    out.push("0", "VERTEX", "8", layer, "10", f(q[0]), "20", f(q[1]), "30", "0.0")
  }
  out.push("0", "SEQEND", "8", layer)
}

function text(out: string[], layer: string, at: Pt, hgt: number, s: string) {
  out.push(
    "0", "TEXT", "8", layer,
    "10", f(at[0]), "20", f(at[1]), "30", "0.0",
    "40", f(hgt),
    "1", s,
    "72", "1", "73", "2", // midtstilt i begge retningar
    "11", f(at[0]), "21", f(at[1]), "31", "0.0",
  )
}

/** Delnummeret står vassrett same kor delen er vridd — teksten skal
 *  lesast av eit menneske som plukkar delar, ikkje av fresen. */
function label(out: string[], q: Placed, outline: Pt[], holes: Pt[][]) {
  const at = labelPoint(outline, holes)
  if (!at) return
  const hgt = Math.min(14, Math.max(3, at.r * 0.9))
  text(out, "GRAVER", [at.x, at.y], hgt, `${q.part.layer + 1}.${q.part.index + 1}`)
}

// =============================================================================
// PLASSEN TIL NUMMERET
// =============================================================================
/**
 * Tyngdepunktet duger ikkje: i ein ring ligg det midt i hòlet. Vi leitar
 * i staden etter punktet lengst frå all kant — grovt rutenett fyrst, så ei
 * finare runde kring vinnaren. Det er same idé som «pole of inaccessibility»,
 * berre utan datastrukturen.
 */
function labelPoint(
  outline: Pt[],
  holes: Pt[][],
): { x: number; y: number; r: number } | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const q of outline) {
    if (q[0] < x0) x0 = q[0]
    if (q[0] > x1) x1 = q[0]
    if (q[1] < y0) y0 = q[1]
    if (q[1] > y1) y1 = q[1]
  }
  if (!Number.isFinite(x0)) return null

  const clear = (x: number, y: number) => {
    if (!within(outline, x, y)) return -1
    for (const h of holes) if (within(h, x, y)) return -1
    let d = distTo(outline, x, y)
    for (const h of holes) d = Math.min(d, distTo(h, x, y))
    return d
  }

  const scan = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    n: number,
  ): { x: number; y: number; r: number } | null => {
    let hit: { x: number; y: number; r: number } | null = null
    for (let i = 1; i < n; i++) {
      for (let j = 1; j < n; j++) {
        const x = ax + ((bx - ax) * i) / n
        const y = ay + ((by - ay) * j) / n
        const r = clear(x, y)
        if (r > 0 && (hit === null || r > hit.r)) hit = { x, y, r }
      }
    }
    return hit
  }

  const coarse = scan(x0, y0, x1, y1, 28)
  if (coarse === null) return null
  const s = Math.max(x1 - x0, y1 - y0) / 28
  const fine = scan(coarse.x - s, coarse.y - s, coarse.x + s, coarse.y + s, 8)
  return fine !== null && fine.r > coarse.r ? fine : coarse
}

function within(poly: Pt[], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      hit = !hit
    }
  }
  return hit
}

function distTo(poly: Pt[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const L = ex * ex + ey * ey
    let t = L > 0 ? ((x - a[0]) * ex + (y - a[1]) * ey) / L : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const d = Math.hypot(x - (a[0] + ex * t), y - (a[1] + ey * t))
    if (d < best) best = d
  }
  return best
}

// =============================================================================
// POLYGON-OFFSETT
// =============================================================================
/**
 * Flyttar heile konturen `d` millimeter ut frå det området han omsluttar.
 * Negativ `d` krympar. Vindinga speler ingi rolle — retninga vert lesen av
 * forteikna på arealet — så same funksjonen tek ytre konturar og hòl.
 *
 * Kvar kant vert skuva langs normalen sin, og nabokantane skorne mot
 * kvarandre. Skarpe utoverhjørne gjev eit gjæringspunkt som stikk mot
 * uendeleg; når det vert lenger enn tre gonger offsettet, vert hjørnet
 * kappa i staden. Sjølvskjeringar vert rydda med den enkle prøva: eit
 * gyldig offsettpunkt kan ikkje liggja nærare den gamle konturen enn |d|,
 * så alt som endar innanfor halve offsettet vert kasta.
 *
 * AVGRENSINGAR. Dette er ein lokal offsett, ikkje ein rett Minkowski-sum:
 *   · han deler ikkje eit polygon som offsettet riv i to, og
 *   · han smeltar ikkje saman to lykkjer som møtest.
 * For konturane her er det uproblematisk. Dei er sampla kvar grad, så
 * krumningsradien er stor overalt bortsett frå i endane på beinbitane, og
 * offsettet er 1,5 mm mot eit gods som aldri er smalare enn 5 mm. Vert
 * kerf sett urimeleg høgt, eller plyT så tynn at delane vert trådsmale,
 * må ein rett offsettbibliotek inn.
 */
export function offsetPoly(poly: Pt[], d: number): Pt[] {
  const n = poly.length
  if (n < 3 || d === 0) return poly
  const s = shoelace(poly) >= 0 ? 1 : -1

  const nx = new Array<number>(n)
  const ny = new Array<number>(n)
  const ex = new Array<number>(n)
  const ey = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    ex[i] = dx / L
    ey[i] = dy / L
    nx[i] = (s * dy) / L
    ny[i] = (-s * dx) / L
  }

  const raw: Pt[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + n - 1) % n // kanten inn i hjørnet
    const pj: Pt = [poly[i][0] + nx[j] * d, poly[i][1] + ny[j] * d]
    const pi: Pt = [poly[i][0] + nx[i] * d, poly[i][1] + ny[i] * d]
    const cr = ex[j] * ey[i] - ey[j] * ex[i]
    if (Math.abs(cr) < 1e-9) {
      raw.push(pi)
      continue
    }
    const t = ((pi[0] - pj[0]) * ey[i] - (pi[1] - pj[1]) * ex[i]) / cr
    const q: Pt = [pj[0] + ex[j] * t, pj[1] + ey[j] * t]
    if (Math.hypot(q[0] - poly[i][0], q[1] - poly[i][1]) > Math.abs(d) * 3) {
      raw.push(pj, pi) // kappa hjørne
    } else {
      raw.push(q)
    }
  }

  const lim = Math.abs(d) * 0.5
  const keep: Pt[] = []
  for (const q of raw) {
    if (distTo(poly, q[0], q[1]) < lim) continue
    const last = keep[keep.length - 1]
    if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 1e-4) continue
    keep.push(q)
  }
  return keep.length >= 3 ? keep : poly
}
