/**
 * VAFFEL — delane lagde ut på plate.
 *
 * Rasterpakking. Plata er eit rutenett av celler på CELL millimeter, og
 * kvar del er ei bitmaske av YTTERKONTUREN sin — ikkje av omrisset. Det er
 * heile skilnaden: bogen under kvar ribbe er eit stort, tomt og fullt
 * brukbart felt, og ei ribbe snudd 180° grip inn i naboen i staden for å
 * leggje seg oppå boksen hans. Kvar del vert prøvd i dei fire
 * kvartrotasjonane og lagd på den lågaste (og so venstraste) ledige
 * plassen som gjev lågast topp; det er lengda pakkinga når opp på plata
 * som avgjer kor mange plater ein må kjøpa. Hòl i ein del er framleis del
 * av delen — det vert ikkje pakka i dei.
 *
 * Maska er dilatert med éi celle på kvar side, og det er ikkje pynt: to
 * masker som ikkje deler celle er då garanterte å liggje minst GAP
 * millimeter frå kvarandre, same kvar i cellene konturane ligg. (Provet
 * krev CELL ≥ GAP/2 — to punkt nærare enn GAP kan då aldri hamne meir enn
 * to celleindeksar frå kvarandre.) Prisen er at lufta i praksis vert ei
 * celle eller to romslegare enn minstekravet; det er rasteret sin natur,
 * og han er billegare enn ei ny plate.
 *
 * Deterministisk: ingen slump og inga klokke — same delar inn gjev same
 * pakking ut. Like delar (same `part.id`) deler bitmasker og søkjepeikar,
 * so dei atten ribbene kostar fjorten rasteriseringar og kvar maske
 * skannar arket høgst éin gong i alt. Målt på denne maskina (node 22,
 * CELL = 6): standardvaffelen ~18 ms per nest(), verste av 40
 * terningkast ~47 ms — godt under taket på 80 ms som avlen sine 90 steg
 * set. (CELL = 4 gav 1–2 prosentpoeng meir og eitt ark mindre for SKIVE,
 * men verste kast tok 128 ms; det er feil side av taket.)
 */
import { bbox, type Pt } from "../core"
import type { Part } from "./parts"

export const SHEET_W = 2500
export const SHEET_H = 1250
/** luft mellom delane, mm — fresen sin diameter pluss litt å ta i */
const GAP = 8
/** rastercella, mm. Må vera ≥ GAP/2 for at dilateringa skal halde ord. */
const CELL = 6
/** dilatering, celler på kvar side av maska */
const DIL = 1

/** rot er kvarte omdreiingar MOT klokka: 0, 90, 180, 270 grader */
export type Placed = { part: Part; x: number; y: number; rot: 0 | 1 | 2 | 3 }
export type Sheet = { w: number; h: number; placed: Placed[]; used: number }
export type Nesting = { sheets: Sheet[]; sheetW: number; sheetH: number; util: number }

const dims = (p: Part) => {
  const b = bbox(p.outline)
  return { w: b.x1 - b.x0, h: b.y1 - b.y0, x0: b.x0, y0: b.y0 }
}

// =============================================================================
// RASTERET
// =============================================================================
/** arkgrida: éi celle margin til dilateringa på kvar side, pluss slark */
const GW = Math.ceil(SHEET_W / CELL) + 2 * DIL + 1
const GH = Math.ceil(SHEET_H / CELL) + 2 * DIL + 1
/** ord per rad i arkmaska — eitt ekstra so eit skifta maskeord aldri
 *  bles inn i rada under */
const WPR = (GW >> 5) + 2

type Mask = {
  /** my rader à mw ord; bit i i rad j er cella (i, j) */
  bits: Uint32Array
  mw: number
  my: number
  /** fotavtrykket i mm etter rotasjonen */
  rw: number
  rh: number
  /** lovlege plasseringar på grida, medrekna GAP mot platekanten */
  giMin: number
  giMax: number
  gjMin: number
  gjMax: number
}

/**
 * Bitmaska for éin del i éin rotasjon. Konservativ med vilje: kvar celle
 * konturen så mykje som strekar innom vert sett (kantane vert prøvde med
 * steg på ei halv celle, flata med jamnhøge skannliner), og so vert alt
 * dilatert med éi celle. Ei ledig celle i denne maska er difor ei celle
 * ein trygt kan frese ved. Returnerer null når delen ikkje får plass på
 * ei tom plate i denne leia.
 */
function buildMask(part: Part, rot: 0 | 1 | 2 | 3): Mask | null {
  const d = dims(part)
  const rw = rot & 1 ? d.h : d.w
  const rh = rot & 1 ? d.w : d.h
  const giMin = Math.ceil(GAP / CELL)
  const gjMin = giMin
  const nx = Math.max(1, Math.ceil(rw / CELL))
  const ny = Math.max(1, Math.ceil(rh / CELL))
  const mx = nx + 2 * DIL
  const my = ny + 2 * DIL
  const giMax = Math.min(Math.floor((SHEET_W - GAP - rw) / CELL), GW - mx)
  const gjMax = Math.min(Math.floor((SHEET_H - GAP - rh) / CELL), GH - my)
  if (giMax < giMin || gjMax < gjMin) return null

  // ytterkonturen inn i rotasjonsramma — same avbilding som placedRings
  const P = part.outline
  const n = P.length
  const tx = new Float64Array(n)
  const ty = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const u = P[i][0] - d.x0
    const v = P[i][1] - d.y0
    if (rot === 1) {
      tx[i] = d.h - v
      ty[i] = u
    } else if (rot === 2) {
      tx[i] = d.w - u
      ty[i] = d.h - v
    } else if (rot === 3) {
      tx[i] = v
      ty[i] = d.w - u
    } else {
      tx[i] = u
      ty[i] = v
    }
  }

  const cell = new Uint8Array(mx * my)
  const mark = (x: number, y: number) => {
    let i = Math.floor(x / CELL)
    let j = Math.floor(y / CELL)
    if (i < 0) i = 0
    else if (i >= nx) i = nx - 1
    if (j < 0) j = 0
    else if (j >= ny) j = ny - 1
    cell[(j + DIL) * mx + (i + DIL)] = 1
  }

  // kantane: kvar celle streken går gjennom
  const step = CELL / 2
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n
    const ax = tx[i]
    const ay = ty[i]
    const bx = tx[k]
    const by = ty[k]
    const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step))
    for (let s = 0; s <= m; s++) {
      const t = s / m
      mark(ax + (bx - ax) * t, ay + (by - ay) * t)
    }
  }

  // flata: jamn/odde-fylling langs midtlina i kvar rad
  const xs: number[] = []
  for (let j = 0; j < ny; j++) {
    const y = (j + 0.5) * CELL
    xs.length = 0
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n
      const ay = ty[i]
      const by = ty[k]
      if (ay > y === by > y) continue
      xs.push(tx[i] + ((y - ay) / (by - ay)) * (tx[k] - tx[i]))
    }
    xs.sort((a, b) => a - b)
    const row = (j + DIL) * mx + DIL
    for (let q = 0; q + 1 < xs.length; q += 2) {
      let i0 = Math.floor(xs[q] / CELL)
      let i1 = Math.floor(xs[q + 1] / CELL)
      if (i0 < 0) i0 = 0
      if (i1 >= nx) i1 = nx - 1
      for (let i = i0; i <= i1; i++) cell[row + i] = 1
    }
  }

  // dilater éi celle i kross og pakk radene til bit-ord i same vending
  const tmp = new Uint8Array(mx * my)
  for (let j = 0; j < my; j++) {
    const r0 = j * mx
    for (let i = 0; i < mx; i++) {
      if (!cell[r0 + i]) continue
      tmp[r0 + i] = 1
      if (i > 0) tmp[r0 + i - 1] = 1
      if (i + 1 < mx) tmp[r0 + i + 1] = 1
    }
  }
  const mw = (mx + 31) >> 5
  const bits = new Uint32Array(my * mw)
  for (let j = 0; j < my; j++) {
    const r0 = j * mx
    for (let i = 0; i < mx; i++) {
      const on =
        tmp[r0 + i] | (j > 0 ? tmp[r0 - mx + i] : 0) | (j + 1 < my ? tmp[r0 + mx + i] : 0)
      if (on) bits[j * mw + (i >> 5)] |= 1 << (i & 31)
    }
  }

  return { bits, mw, my, rw, rh, giMin, giMax, gjMin, gjMax }
}

// =============================================================================
// ARKET
// =============================================================================
type Ark = {
  sheet: Sheet
  /** GH rader à WPR ord — cellene som alt er tekne, dilatering medrekna */
  occ: Uint32Array
  /**
   * Kvar den fyrste ledige plassen for kvar (del-id, rotasjon) sist var.
   * Arket vert berre fullare, so ein plass som var oppteken held seg
   * oppteken — søket kan halde fram der det slapp, og kvar maske les
   * arket høgst éin gong i alt, same kor mange like delar som kjem.
   */
  resume: Map<string, number>
}

/** kolliderer maska med arket når ho ligg med hjørnet sitt i (gi, gj)? */
function fits(occ: Uint32Array, m: Mask, gi: number, gj: number): boolean {
  const s = gi & 31
  const k0 = gi >> 5
  const bits = m.bits
  if (s === 0) {
    for (let j = 0; j < m.my; j++) {
      const so = (gj + j) * WPR + k0
      const po = j * m.mw
      for (let k = 0; k < m.mw; k++) if (occ[so + k] & bits[po + k]) return false
    }
  } else {
    const rs = 32 - s
    for (let j = 0; j < m.my; j++) {
      const so = (gj + j) * WPR + k0
      const po = j * m.mw
      let prev = 0
      for (let k = 0; k <= m.mw; k++) {
        const cur = k < m.mw ? bits[po + k] : 0
        const w = ((cur << s) | (prev >>> rs)) >>> 0
        if (w !== 0 && (occ[so + k] & w) !== 0) return false
        prev = cur
      }
    }
  }
  return true
}

/** legg maska inn i arket — same vandring som fits, men med ELLER */
function stamp(occ: Uint32Array, m: Mask, gi: number, gj: number) {
  const s = gi & 31
  const k0 = gi >> 5
  const bits = m.bits
  if (s === 0) {
    for (let j = 0; j < m.my; j++) {
      const so = (gj + j) * WPR + k0
      const po = j * m.mw
      for (let k = 0; k < m.mw; k++) occ[so + k] |= bits[po + k]
    }
  } else {
    const rs = 32 - s
    for (let j = 0; j < m.my; j++) {
      const so = (gj + j) * WPR + k0
      const po = j * m.mw
      let prev = 0
      for (let k = 0; k <= m.mw; k++) {
        const cur = k < m.mw ? bits[po + k] : 0
        occ[so + k] |= ((cur << s) | (prev >>> rs)) >>> 0
        prev = cur
      }
    }
  }
}

/** fyrste ledige plass i radvis lesing, frå der same maske slapp sist;
 *  -1 når arket er uttømt for denne maska */
function scan(ark: Ark, m: Mask, key: string): number {
  const from = ark.resume.get(key) ?? m.gjMin * GW + m.giMin
  let gj = Math.floor(from / GW)
  let gi = from - gj * GW
  if (gj < m.gjMin) {
    gj = m.gjMin
    gi = m.giMin
  }
  if (gi < m.giMin) gi = m.giMin
  for (; gj <= m.gjMax; gj++) {
    for (; gi <= m.giMax; gi++) {
      if (fits(ark.occ, m, gi, gj)) {
        const pos = gj * GW + gi
        ark.resume.set(key, pos)
        return pos
      }
    }
    gi = m.giMin
  }
  ark.resume.set(key, (m.gjMax + 1) * GW)
  return -1
}

/**
 * Prøv dei fire rotasjonane på dette arket og legg delen der toppen vert
 * lågast — sekundært lågast rad, so lengst til venstre, so lågaste
 * rotasjon. Sant der maska seier det er ledig, òg nede i bogen til ein
 * nabo som alt ligg.
 */
function tryPlace(ark: Ark, part: Part, ms: (Mask | null)[]): boolean {
  let best: Mask | null = null
  let bestRot = 0
  let bestGi = 0
  let bestGj = 0
  let bestTop = Infinity
  for (let r = 0; r < 4; r++) {
    const m = ms[r]
    if (!m) continue
    const pos = scan(ark, m, part.id + "|" + r)
    if (pos < 0) continue
    const gj = Math.floor(pos / GW)
    const gi = pos - gj * GW
    const top = gj * CELL + m.rh
    if (
      top < bestTop ||
      (top === bestTop && (gj < bestGj || (gj === bestGj && gi < bestGi)))
    ) {
      best = m
      bestRot = r
      bestGi = gi
      bestGj = gj
      bestTop = top
    }
  }
  if (!best) return false
  stamp(ark.occ, best, bestGi, bestGj)
  ark.sheet.placed.push({
    part,
    x: bestGi * CELL,
    y: bestGj * CELL,
    rot: bestRot as 0 | 1 | 2 | 3,
  })
  if (bestTop > ark.sheet.used) ark.sheet.used = bestTop
  return true
}

// =============================================================================
// PAKKINGA
// =============================================================================
export function nest(parts: Part[]): Nesting {
  const items = parts
    .map((p) => ({ p, d: dims(p) }))
    .sort((a, b) => b.d.w * b.d.h - a.d.w * a.d.h)

  // like delar deler masker: `part.id` er same form, per bygg
  const memo = new Map<string, (Mask | null)[]>()
  const masksFor = (q: Part) => {
    let ms = memo.get(q.id)
    if (!ms) {
      ms = [buildMask(q, 0), buildMask(q, 1), buildMask(q, 2), buildMask(q, 3)]
      memo.set(q.id, ms)
    }
    return ms
  }

  const arks: Ark[] = []
  const open = (): Ark => {
    const a: Ark = {
      sheet: { w: SHEET_W, h: SHEET_H, placed: [], used: 0 },
      occ: new Uint32Array(GH * WPR),
      resume: new Map(),
    }
    arks.push(a)
    return a
  }
  open()

  for (const it of items) {
    const ms = masksFor(it.p)
    if (!ms.some((m) => m !== null)) continue // større enn plata i alle leier
    let done = false
    for (let si = 0; si < arks.length && !done; si++) {
      done = tryPlace(arks[si], it.p, ms)
    }
    // ho får plass på ei tom plate — det sa maska sjølv
    if (!done) tryPlace(open(), it.p, ms)
  }

  const sheets = arks.map((a) => a.sheet)
  const area = parts.reduce((s, p) => s + p.area, 0)
  const usedArea = sheets.reduce((s, q) => s + q.used * SHEET_W, 0)
  return { sheets, sheetW: SHEET_W, sheetH: SHEET_H, util: usedArea > 0 ? area / usedArea : 0 }
}

/** medgått plateareal: breidda gonger den brukte lengda, summert over arka */
export function usedArea(ns: Nesting): number {
  return ns.sheets.reduce((s, q) => s + q.used * ns.sheetW, 0)
}

/** delen sine konturar der han faktisk ligg på plata */
export function placedRings(q: Placed): { outline: Pt[]; holes: Pt[][] } {
  const d = dims(q.part)
  const map = (p: Pt): Pt => {
    const x = p[0] - d.x0
    const y = p[1] - d.y0
    if (q.rot === 1) return [q.x + d.h - y, q.y + x]
    if (q.rot === 2) return [q.x + d.w - x, q.y + d.h - y]
    if (q.rot === 3) return [q.x + y, q.y + d.w - x]
    return [q.x + x, q.y + y]
  }
  return { outline: q.part.outline.map(map), holes: q.part.holes.map((h) => h.map(map)) }
}
