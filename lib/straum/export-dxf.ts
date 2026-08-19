/**
 * STRAUM — DXF ut.
 *
 * R12 ASCII, millimeter, to lag: KUTT og GRAVER. R12 er gamalt og fattig,
 * og nett difor rett: LWPOLYLINE kom fyrst i R13, så eldre fresprogram og
 * laserpanel les han ikkje. POLYLINE med VERTEX og SEQEND opnar alle
 * stader. Fila vert større; det er ein pris verd å betale for at ho let
 * seg køyre.
 *
 * Arka ligg etter kvarandre oppover i Y med ei luke mellom, så eitt uttak
 * kan innehalde heile jobben.
 *
 * KVA SOM STÅR PÅ ARKET. Delane er emne og ikkje ferdige delar: salen og
 * ytterkanten vert freste av heile stabelen etter oppliming, og det er
 * grunnen til at ingen finne har den kanten her som ho har i modellen.
 * Spora derimot er ferdige — dei er skorne no, og dei er det einaste
 * leddet som finst.
 */
import type { Pt } from "../core"
import { placedRings, SHEET_H, SHEET_W, type Nesting, type Placed } from "./nest"

/** luka mellom arka i uttaket, mm */
const SHEET_GAP = 220

export function partsToDxf(nesting: Nesting): string {
  const out: string[] = []
  const pitch = SHEET_H + SHEET_GAP
  head(out, SHEET_W, Math.max(SHEET_H, nesting.sheets.length * pitch))

  nesting.sheets.forEach((sheet, i) => {
    const oy = i * pitch
    // plateomrisset står på GRAVER: det er ei opplysning, ikkje eit kutt
    poly(out, "GRAVER", [
      [0, oy],
      [sheet.w, oy],
      [sheet.w, oy + sheet.h],
      [0, oy + sheet.h],
    ])
    text(
      out,
      "GRAVER",
      [sheet.w / 2, oy + sheet.h - 30],
      22,
      `ARK ${i + 1}/${nesting.sheets.length}  ${fmt(sheet.t)} MM`,
    )
    for (const q of sheet.placed) {
      const r = placedRings({ ...q, y: q.y + oy })
      poly(out, "KUTT", r.outline)
      for (const h of r.holes) poly(out, "KUTT", h)
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
const fmt = (v: number) => String(+v.toFixed(2))

function head(out: string[], w: number, h: number) {
  out.push(
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    // $INSUNITS kom fyrst i R14, men ukjende hovudvariablar vert hoppa
    // over; utan han står det ingen stad i fila at tala er millimeter.
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

function poly(out: string[], layer: string, pts: Pt[]) {
  if (pts.length < 2) return
  out.push(
    "0", "POLYLINE", "8", layer,
    "66", "1", // hjørna fylgjer som eigne VERTEX-entitetar
    "70", "1", // lukka
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

/**
 * Delnummeret står vassrett same kor delen er vridd — teksten skal lesast
 * av eit menneske som plukkar delar, ikkje av fresen. Han vert lagd så
 * langt ned i delen som det er plass til: nedkanten er den kanten som
 * står synleg i sokkelen, og eit nummer der kan lesast utan å snu delen.
 */
function label(out: string[], q: Placed, outline: Pt[], holes: Pt[][]) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of outline) {
    if (p[0] < x0) x0 = p[0]
    if (p[0] > x1) x1 = p[0]
    if (p[1] < y0) y0 = p[1]
    if (p[1] > y1) y1 = p[1]
  }
  const clear = (x: number, y: number) => {
    if (!within(outline, x, y)) return -1
    for (const h of holes) if (within(h, x, y)) return -1
    let d = distTo(outline, x, y)
    for (const h of holes) d = Math.min(d, distTo(h, x, y))
    return d
  }
  // Nedst vinn: eit lågare punkt med same klaring er betre, av di
  // nedkanten er den kanten som står synleg ut av sokkelen. Kravet på
  // klaringa vert sett ned til delen tek imot ein tekst i det heile —
  // ein del utan nummer er ein del som kan hamne i feil spor.
  const scan = (need: number): Spot | null => {
    let hit: Spot | null = null
    for (let j = 1; j < 22; j++) {
      for (let i = 1; i < 22; i++) {
        const x = x0 + ((x1 - x0) * i) / 22
        const y = y0 + ((y1 - y0) * j) / 22
        const r = clear(x, y)
        if (r >= need && (hit === null || y < hit.y - 1e-9)) hit = { x, y, r }
      }
    }
    return hit
  }
  const best = scan(10) ?? scan(5) ?? scan(2.5)
  if (!best) return
  text(out, "GRAVER", [best.x, best.y], Math.min(16, best.r * 1.6), q.part.id.toUpperCase())
}

type Spot = { x: number; y: number; r: number }

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
