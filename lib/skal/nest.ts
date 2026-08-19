/**
 * SANDKASSE — kuttarka.
 *
 * Stabelen er delar; plata er ei flate. Nestinga er leddet der geometrien
 * møter innkjøpet: kor mange plater objektet kostar, og kor mykje av kvar
 * plate som vert spon.
 *
 * Pakkinga er hyllepakking med fri vriding i 15-graders steg og
 * par-nesting: to delar side om side, den andre snudd 180 grader, slik at
 * ein kul på den eine kan leggja seg i eit innsving på den andre. Skiftet
 * mellom dei vert skanna rad for rad — høgre silhuett av den fyrste mot
 * venstre silhuett av den andre — ikkje rekna av omsluttande boksar, for
 * delane her er halvmånar og ein boks rundt ein halvmåne er mest luft.
 *
 * Dette er ikkje optimalt. Nesting er NP-hardt, og ingen verkstad køyrer
 * optimalt uansett. Det er derimot gjennomsiktig: kvar plassering kan
 * reknast etter for hand.
 *
 * `util` er verkeleg polygonareal delt på den plateflata som faktisk er
 * teken i bruk. Hòla inne i ringane tel som spon — dei står i nemnaren
 * gjennom plateflata, men ikkje i teljaren. Det er den ærlege lesinga: eit
 * hòl på 1400 cm² midt i seteringen er avfall same kor pent det ligg.
 * (Ein kunne nesta småbitar inne i det hòlet; denne pakkaren gjer det ikkje.)
 */
import { bbox, type Part, type Pt, type Stack } from "./laminae"

const DEG = Math.PI / 180

/** Vridingssteget. Kvart steg kostar ei full omrekning av konturen, og
 *  under 15 grader betaler pakkinga stadig mindre attende. */
const STEP = 15

export type Placed = { part: Part; x: number; y: number; rot: number }
export type Sheet = { w: number; h: number; used: number; placed: Placed[]; util: number }
export type Nesting = {
  sheets: Sheet[]
  sheetW: number
  sheetH: number
  util: number
  /** samla lengd plate teken i bruk, summen av `used` over alle ark, mm */
  usedLen: number
}

/**
 * Delen sin kontur i arkkoordinatar: fyrst vridd `rot` grader kring origo,
 * så flytt til (x, y). Kvar eksportør må gjere nett same rekninga, så ho
 * ligg her og ikkje tre stader.
 */
export function placedRings(q: Placed): { outline: Pt[]; holes: Pt[][] } {
  const a = q.rot * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  const f = (t: Pt): Pt => [q.x + t[0] * c - t[1] * s, q.y + t[0] * s + t[1] * c]
  return { outline: q.part.outline.map(f), holes: q.part.holes.map((h) => h.map(f)) }
}

// =============================================================================
// VRIDING
// =============================================================================
/** ein del vridd og flytt slik at boksen hans startar i (0, 0) */
type Turned = { rot: number; ox: number; oy: number; w: number; h: number; pts: Pt[] }

function turn(part: Part, rot: number): Turned {
  const a = rot * DEG
  const c = Math.cos(a)
  const s = Math.sin(a)
  const r = part.outline.map((q): Pt => [q[0] * c - q[1] * s, q[0] * s + q[1] * c])
  const b = bbox(r)
  const ox = -b.x0
  const oy = -b.y0
  return {
    rot,
    ox,
    oy,
    w: b.x1 - b.x0,
    h: b.y1 - b.y0,
    pts: r.map((q): Pt => [q[0] + ox, q[1] + oy]),
  }
}

/**
 * Vridinga som gjev lågast hylle. Hyllehøgda er den knappe ressursen i ein
 * hyllepakkar — ei einaste høg del set høgda for alt som ligg ved sida av
 * henne — så vi legg delane ned, ikkje på høgkant. 180 grader gjev same
 * boks som 0, difor held det å prøve halve sirkelen her.
 */
function bestTurn(part: Part, maxW: number, maxH: number): Turned {
  let best = turn(part, 0)
  const fits = (t: Turned) => t.w <= maxW && t.h <= maxH
  for (let a = STEP; a < 180; a += STEP) {
    const t = turn(part, a)
    if (fits(t) !== fits(best)) {
      if (fits(t)) best = t
      continue
    }
    if (t.h < best.h - 0.5 || (Math.abs(t.h - best.h) <= 0.5 && t.w < best.w)) best = t
  }
  return best
}

// =============================================================================
// PAR-NESTING
// =============================================================================
/** Ytste x-verdiane der ei vassrett linje i høgda y skjer polygonet. */
function spanAt(poly: Pt[], y: number): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if ((a[1] <= y) === (b[1] <= y)) continue
    const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
    if (x < lo) lo = x
    if (x > hi) hi = x
  }
  return hi < lo ? null : [lo, hi]
}

/**
 * Kor langt til høgre B må skuvast for å gå klar av A når begge står på
 * same hyllebotn.
 *
 * Fyrst ei rad-for-rad-skanning: høgre silhuett av A mot venstre silhuett
 * av B, med krav om `pad` klaring i kvar rad der begge har material. Fordi
 * silhuetten vert lesen og ikkje boksen, kan ein halvmåne krype inn i buken
 * på ein annan.
 *
 * Skanninga åleine er ikkje nok. Ho måler klaringa vassrett, og to kantar
 * som begge heller kan stå heile klaringa frå kvarandre langs rada og
 * likevel berre ein tredjedel av henne på tvers — då står det att eit gods
 * smalare enn snittet, og dei to delane heng saman etter fresen. Difor vert
 * skiftet etterpå prøvd mot den verkelege avstanden mellom konturane og
 * skuva til klaringa held overalt.
 */
function pairShift(a: Turned, b: Turned, pad: number): number {
  const step = 1
  const top = Math.min(a.h, b.h)
  let dx = 0
  let found = false
  for (let y = step * 0.5; y < top; y += step) {
    const sa = spanAt(a.pts, y)
    const sb = spanAt(b.pts, y)
    if (!sa || !sb) continue
    found = true
    const need = sa[1] - sb[0] + pad
    if (need > dx) dx = need
  }
  // Ingen felles rad tyder på at skanninga bomma, ikkje at delane er frie.
  const apart = a.w + pad
  if (!found) return apart

  const A = thin(a.pts)
  const B = thin(b.pts)
  for (let k = 0; k < 8; k++) {
    const g = gapBetween(A, B, dx)
    if (g >= pad - 0.01) return dx
    dx += pad - g
    if (dx >= apart) return apart
  }
  return apart
}

/** Avstandsmålinga er O(n·m), så svære konturar vert tynna. Grensa ligg
 *  over det laga vert sampla med i dag og slår fyrst inn om `nth` vert
 *  skrudd opp: prøvde vi med 200 punkt, bomma målinga med over ein
 *  millimeter, for beinbitane har skarpe endar eit grovt utval hoppar over. */
function thin(pts: Pt[], max = 900): Pt[] {
  const k = Math.max(1, Math.ceil(pts.length / max))
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i += k) out.push(pts[i])
  return out
}

/** Minste avstand mellom to konturar når B er skuva `dx` til høgre.
 *  Målt hjørne mot kant båe vegar. To konturar som kryssar kvarandre
 *  mellom hjørna gjev framleis eit positivt tal — dette er inga
 *  kryssprøve. Det held her av di konturane er sampla kvar grad og
 *  aldri har ein kant som er lengre enn klaringa. */
function gapBetween(a: Pt[], b: Pt[], dx: number): number {
  const shifted = b.map((q): Pt => [q[0] + dx, q[1]])
  return Math.min(oneWay(a, shifted), oneWay(shifted, a))
}

function oneWay(pts: Pt[], poly: Pt[]): number {
  let best = Infinity
  for (const p of pts) {
    for (let i = 0; i < poly.length; i++) {
      const u = poly[i]
      const v = poly[(i + 1) % poly.length]
      // kanten kan ikkje slå den beste når han ligg utanfor ruta kring
      // punktet; utan denne prøva tek nestinga fem gonger så lang tid
      if (p[0] < Math.min(u[0], v[0]) - best || p[0] > Math.max(u[0], v[0]) + best) continue
      if (p[1] < Math.min(u[1], v[1]) - best || p[1] > Math.max(u[1], v[1]) + best) continue
      const ex = v[0] - u[0]
      const ey = v[1] - u[1]
      const L = ex * ex + ey * ey
      let t = L > 0 ? ((p[0] - u[0]) * ex + (p[1] - u[1]) * ey) / L : 0
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const d = Math.hypot(p[0] - (u[0] + ex * t), p[1] - (u[1] + ey * t))
      if (d < best) best = d
    }
  }
  return best
}

// =============================================================================
// PAKKING
// =============================================================================
type Member = { part: Part; t: Turned; dx: number }
type Item = { members: Member[]; w: number; h: number; area: number }
type Shelf = { y: number; h: number; x: number }
type Bin = { shelves: Shelf[]; placed: Placed[]; area: number }

export function nest(
  stack: Stack,
  sheetW = 2500,
  sheetH = 1250,
  kerf = 3,
  gap = 6,
): Nesting {
  // Klaringa mellom to nabokonturar må romme heile snittbreidda pluss det
  // monnet ein treng for at delane ikkje skal renne i hop.
  const pad = kerf + gap
  const margin = gap
  const maxW = Math.max(1, sheetW - 2 * margin)
  const maxH = Math.max(1, sheetH - 2 * margin)

  const parts: Part[] = []
  for (const L of stack.layers) for (const q of L.parts) parts.push(q)

  const turned = parts.map((q) => bestTurn(q, maxW, maxH))
  const order = parts.map((_, i) => i).sort((a, b) => turned[b].h - turned[a].h)

  // Par vert laga av naboar i høgdesortert rekkjefylgje: to like høge delar
  // deler hylle uansett, og då kostar det ingen ting å prøve å tvinne dei
  // inn i kvarandre fyrst.
  const items: Item[] = []
  for (let k = 0; k < order.length; k++) {
    const ia = order[k]
    const ta = turned[ia]
    if (k + 1 < order.length) {
      const ib = order[k + 1]
      const tb = turn(parts[ib], (turned[ib].rot + 180) % 360)
      const dx = pairShift(ta, tb, pad)
      const w = Math.max(ta.w, dx + tb.w)
      if (w <= maxW) {
        items.push({
          members: [
            { part: parts[ia], t: ta, dx: 0 },
            { part: parts[ib], t: tb, dx },
          ],
          w,
          h: Math.max(ta.h, tb.h),
          area: parts[ia].area + parts[ib].area,
        })
        k++
        continue
      }
    }
    items.push({
      members: [{ part: parts[ia], t: ta, dx: 0 }],
      w: ta.w,
      h: ta.h,
      area: parts[ia].area,
    })
  }

  const put = (bin: Bin, sh: Shelf, it: Item) => {
    for (const m of it.members) {
      bin.placed.push({
        part: m.part,
        x: sh.x + m.dx + m.t.ox,
        y: sh.y + m.t.oy,
        rot: m.t.rot,
      })
    }
    sh.x += it.w + pad
    bin.area += it.area
  }

  const bins: Bin[] = []
  for (const it of items) {
    let done = false
    for (const bin of bins) {
      for (const sh of bin.shelves) {
        if (it.h <= sh.h + 1e-6 && sh.x + it.w <= sheetW - margin) {
          put(bin, sh, it)
          done = true
          break
        }
      }
      if (done) break
      const last = bin.shelves[bin.shelves.length - 1]
      const y = last ? last.y + last.h + pad : margin
      if (y + it.h <= sheetH - margin) {
        const sh: Shelf = { y, h: it.h, x: margin }
        bin.shelves.push(sh)
        put(bin, sh, it)
        done = true
        break
      }
    }
    if (done) continue
    // Er delen større enn plata, hjelper ingen pakking. Han vert lagd på
    // eit eige ark og stikk utanfor; det skal synast i teikninga, ikkje
    // gøymast i eit unntak.
    const bin: Bin = { shelves: [], placed: [], area: 0 }
    const sh: Shelf = { y: margin, h: it.h, x: margin }
    bin.shelves.push(sh)
    bins.push(bin)
    put(bin, sh, it)
  }

  const sheets: Sheet[] = bins.map((bin) => {
    let top = margin
    for (const sh of bin.shelves) top = Math.max(top, sh.y + sh.h)
    const used = Math.min(sheetH, top + margin)
    return {
      w: sheetW,
      h: sheetH,
      used,
      placed: bin.placed,
      util: bin.area / Math.max(1, sheetW * used),
    }
  })

  const usedLen = sheets.reduce((a, s) => a + s.used, 0)
  const area = bins.reduce((a, b) => a + b.area, 0)
  return {
    sheets,
    sheetW,
    sheetH,
    util: area / Math.max(1, sheetW * usedLen),
    usedLen,
  }
}
