/**
 * STRAUM — skiva som del.
 *
 * Alle dei flate delane i objektet er same greia: eit område i eit plan,
 * med hòl i, dratt ut til ei plate. Finna er kroppen skoren av eit skrått
 * plan; sokkelen og kappa er kroppen skoren av eit vassrett eitt. Difor
 * står det éin byggjar her og ikkje tre.
 *
 * Området vert lese som rader. Kvar rad er ei rett line gjennom delen med
 * material frå `lo` til `hi`, og `bands` er dei stykka som er skorne bort i
 * den rada — tomrommet i ei finne, spora i ein sokkel. Kvart band ber ein
 * id, og eit band med same id i to naborader er det same hòlet. Hòl vert
 * kopla på identitet og ikkje på overlapp, og difor kan to hòl aldri
 * smelte saman til eitt i eit nett som skulle vore lukka.
 *
 * SAUMEN. Lokket vert delt i band mellom hòla, og kvart band gjev ei kant
 * langs rada. Skulle dei kantane gå opp, må ei rad delast likt i begge
 * naboparane sine — elles møter ei heil kant to halve, og nettet er ope
 * nøyaktig der eit hòl byrjar. Difor har KVAR rad ein skilnad for KVART
 * hòl i heile delen: der hòlet ikkje finst, er skilnaden eit punkt. Saumen
 * er usynleg — han ligg i eit flatt lokk — og han er det som gjer at
 * delen kan trianguleras utan øyreklipping og likevel vera lukka.
 */
import { shoelace, type Pt, type Vec3 } from "../core"
import type { Soup } from "./mesh"

export type Band = { id: number; lo: number; hi: number }
export type Row = { v: number; lo: number; hi: number; bands: Band[] }

export type Rings = { outline: Pt[]; holes: Pt[][] }

/** ein skilnad i ei rad: eit band, eller punktet der bandet kilar seg ut */
type Div = { id: number; lo: number; hi: number; real: boolean }

/** minste luft mellom to skilnader i ei rad, mm */
const GAP = 0.005

export type Slab = {
  rows: Row[]
  divs: Div[][]
  rings: Rings
  area: number
}

/**
 * Skilnadene, rad for rad. Rekkjefylgja er den same i alle rader — han er
 * sett av kvar hòlet ligg i snitt — og posisjonane vert dytta til dei står
 * i streng rekkjefylgje innanfor rada. Eit ekte band vert aldri flytt av
 * eit punkt; punkta er dei som gjev etter.
 */
function prepare(rows: Row[]): Div[][] {
  const mid = new Map<number, number[]>()
  for (const r of rows) {
    for (const b of r.bands) {
      const cur = mid.get(b.id)
      if (cur) cur.push((b.lo + b.hi) / 2)
      else mid.set(b.id, [(b.lo + b.hi) / 2])
    }
  }
  const nominal = new Map<number, number>()
  for (const [id, cs] of mid) {
    const q = cs.slice().sort((a, b) => a - b)
    nominal.set(id, q[q.length >> 1])
  }
  const order = [...nominal.keys()].sort(
    (a, b) => (nominal.get(a) as number) - (nominal.get(b) as number),
  )

  return rows.map((r) => {
    const ds: Div[] = order.map((id) => {
      const b = r.bands.find((q) => q.id === id)
      if (b) return { id, lo: b.lo, hi: b.hi, real: true }
      const m = nominal.get(id) as number
      return { id, lo: m, hi: m, real: false }
    })
    let prev = r.lo + GAP
    for (const d of ds) {
      if (d.lo < prev) {
        d.hi = Math.max(d.hi, prev + (d.hi - d.lo))
        d.lo = prev
      }
      prev = d.hi + GAP
    }
    let next = r.hi - GAP
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i]
      if (d.hi > next) {
        d.lo = Math.min(d.lo, next - (d.hi - d.lo))
        d.hi = next
      }
      if (d.lo > d.hi) d.lo = d.hi
      next = d.lo - GAP
    }
    // Får ikkje banda plass i rada i det heile, kan baklengspasset ha
    // skuva den fyrste UNDER radstarten — og då faldar konturen seg og
    // hòla fløymer utanfor materialet: delen kjem ut vrengd. Siste ord:
    // alt vert klemt inn i rada, om so kvart band endar som eit punkt.
    // At spora då er for tronge, er det fresregelen som skal seia.
    for (const d of ds) {
      d.lo = Math.min(Math.max(d.lo, r.lo + GAP), r.hi - GAP)
      d.hi = Math.min(Math.max(d.hi, d.lo), r.hi - GAP)
    }
    return ds
  })
}

/**
 * Ytterkonturen og hòla, som lukka polygon i delen sitt eige plan.
 * Ytterkonturen går mot klokka, hòla med klokka: då peikar veggnormalen ut
 * av materialet i begge tilfelle, og fresen les same forteikn som nettet.
 */
function ringsOf(rows: Row[], divs: Div[][]): Rings {
  const n = rows.length
  const outline: Pt[] = []
  const spread = (j: number, rev: boolean): Pt[] => {
    const pts: Pt[] = []
    for (const q of divs[j]) {
      if (q.hi - q.lo < 1e-9) pts.push([q.lo, rows[j].v])
      else pts.push([q.lo, rows[j].v], [q.hi, rows[j].v])
    }
    return rev ? pts.reverse() : pts
  }

  outline.push([rows[0].lo, rows[0].v])
  for (const q of spread(0, false)) outline.push(q)
  outline.push([rows[0].hi, rows[0].v])
  for (let j = 1; j < n; j++) outline.push([rows[j].hi, rows[j].v])
  for (const q of spread(n - 1, true)) outline.push(q)
  for (let j = n - 1; j >= 1; j--) outline.push([rows[j].lo, rows[j].v])

  // Hòla: eitt løp per samanhengande rekkje av ekte band. Løpet må ha ei
  // rad utan hòl på kvar side — når det ikkje har det, er delen delt i to,
  // og då er det radbyggjaren som har gjort feil og ikkje denne fila.
  const holes: Pt[][] = []
  const k = divs[0].length
  for (let c = 0; c < k; c++) {
    let j = 0
    while (j < n) {
      if (!divs[j][c].real) {
        j++
        continue
      }
      let e = j
      while (e + 1 < n && divs[e + 1][c].real) e++
      if (j > 0 && e < n - 1) {
        const ring: Pt[] = []
        ring.push([divs[j - 1][c].lo, rows[j - 1].v])
        for (let q = j; q <= e; q++) ring.push([divs[q][c].lo, rows[q].v])
        ring.push([divs[e + 1][c].lo, rows[e + 1].v])
        for (let q = e; q >= j; q--) ring.push([divs[q][c].hi, rows[q].v])
        holes.push(ring)
      }
      j = e + 1
    }
  }
  return { outline, holes }
}

export function makeSlab(rows: Row[]): Slab {
  const divs = prepare(rows)
  const rings = ringsOf(rows, divs)
  let area = Math.abs(shoelace(rings.outline))
  for (const h of rings.holes) area -= Math.abs(shoelace(h))
  return { rows, divs, rings, area: Math.max(0, area) }
}

// =============================================================================
// NETTET
// =============================================================================
export type Placer = {
  /** frå (koordinat langs rada, radverdi, avstand langs uttrekket) til verda */
  at(c: number, v: number, s: number): Vec3
  /** uttrekksretninga, eining */
  dir: Vec3
  /** platetjukna */
  t: number
}

/**
 * Delen som lukka nett: to lokk og ein vegg langs kvar ring.
 *
 * Lokka vert bygde av dei same skilnadene som ringane, så kvar kant i eit
 * lokk har nøyaktig ein motpart — anten i det andre bandet ved sida av,
 * eller i veggen. Ei triangulering som er gjeven av korleis geometrien
 * vart lesen, kan ikkje slå feil på ein konkav kontur.
 */
export function slabMesh(sl: Slab, pl: Placer, s: Soup) {
  const { rows, divs } = sl
  const n = rows.length
  const h = pl.t / 2

  // HANDTHEITA. Vindinga her inne reknar med at ramma (c, v, s) er
  // høgrehendt i verda. Plasseringane er det som regel — men eit skrått
  // snittplan kan spegelvenda ramma for einskilde plater ved einskilde
  // parameterpunkt, og då kjem HEILE delen ut vrengd: lukka, konsistent,
  // og innsida-ut. Difor vert determinanten målt, og vindinga snudd når
  // ramma er venstrehendt.
  const o0 = pl.at(0, 0, 0)
  const ec = [pl.at(1, 0, 0)[0] - o0[0], pl.at(1, 0, 0)[1] - o0[1], pl.at(1, 0, 0)[2] - o0[2]]
  const ev = [pl.at(0, 1, 0)[0] - o0[0], pl.at(0, 1, 0)[1] - o0[1], pl.at(0, 1, 0)[2] - o0[2]]
  const es = [pl.at(0, 0, 1)[0] - o0[0], pl.at(0, 0, 1)[1] - o0[1], pl.at(0, 0, 1)[2] - o0[2]]
  const det =
    ec[0] * (ev[1] * es[2] - ev[2] * es[1]) -
    ec[1] * (ev[0] * es[2] - ev[2] * es[0]) +
    ec[2] * (ev[0] * es[1] - ev[1] * es[0])
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3) =>
    det < 0 ? s.quad(d, c, b, a) : s.quad(a, b, c, d)

  for (let j = 0; j + 1 < n; j++) {
    const ra = rows[j]
    const rb = rows[j + 1]
    let pa = ra.lo
    let pb = rb.lo
    // banda er dei to store plateflatene (±h); dei tek beis
    s.k = 0
    const band = (qa: number, qb: number) => {
      quad(
        pl.at(pa, ra.v, h),
        pl.at(qa, ra.v, h),
        pl.at(qb, rb.v, h),
        pl.at(pb, rb.v, h),
      )
      quad(
        pl.at(pa, ra.v, -h),
        pl.at(pb, rb.v, -h),
        pl.at(qb, rb.v, -h),
        pl.at(qa, ra.v, -h),
      )
    }
    for (let c = 0; c < divs[j].length; c++) {
      band(divs[j][c].lo, divs[j + 1][c].lo)
      pa = divs[j][c].hi
      pb = divs[j + 1][c].hi
    }
    band(ra.hi, rb.hi)
  }

  // omrisset er kuttet gjennom plata — rå finér
  s.k = 1
  for (const ring of [sl.rings.outline, ...sl.rings.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]
      const q = ring[(i + 1) % ring.length]
      quad(
        pl.at(p[0], p[1], -h),
        pl.at(q[0], q[1], -h),
        pl.at(q[0], q[1], h),
        pl.at(p[0], p[1], h),
      )
    }
  }
}
