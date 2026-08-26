/**
 * STRAUM — delane lagde ut på plate.
 *
 * Hylleplassering: delane vert sorterte etter høgd og lagde i rader
 * bortover, ei ny rad når rada er full. Det er den enklaste plasseringa
 * som gjev eit ærleg tal på kor mange plater jobben tek, og det er talet
 * regelen «platetal» les.
 *
 * Nestinga er med vilje ikkje smart. Tjuefire finneemne på 350 × 400 mm
 * let seg ikkje nesta tett same kva ein gjer — utnyttinga ligg kring tjue
 * prosent, og det er ein eigenskap ved forma og ikkje ved algoritmen.
 * Ein pakkar som klemmer to prosent meir ut av arket ville skjule det.
 */
import { bbox, type Pt } from "../core"
import type { Part } from "./parts"

/** standardplate, mm */
export const SHEET_W = 2440
export const SHEET_H = 1220
/** luft mellom to delar: fresebreidd pluss slingring */
const PAD = 12

export type Placed = { part: Part; x: number; y: number; rot: boolean }
export type Sheet = {
  t: number
  w: number
  h: number
  placed: Placed[]
  util: number
  /** brukt lengd av arket, mm — den stripa som faktisk går gjennom maskina */
  used: number
}
export type Nesting = { sheets: Sheet[]; area: number; used: number }

/** konturen slik han ligg på plata */
export function placedRings(q: Placed): { outline: Pt[]; holes: Pt[][] } {
  const b = bbox(q.part.outline)
  const map = (p: Pt): Pt =>
    q.rot
      ? [q.x + (p[1] - b.y0), q.y + (b.x1 - p[0])]
      : [q.x + (p[0] - b.x0), q.y + (p[1] - b.y0)]
  return {
    outline: q.part.outline.map(map),
    holes: q.part.holes.map((h) => h.map(map)),
  }
}

export function nest(parts: Part[]): Nesting {
  const groups = new Map<number, Part[]>()
  for (const q of parts) {
    const k = Math.round(q.t * 10)
    const cur = groups.get(k)
    if (cur) cur.push(q)
    else groups.set(k, [q])
  }
  const sheets: Sheet[] = []
  let area = 0
  for (const [k, list] of [...groups].sort((a, b) => a[0] - b[0])) {
    const t = k / 10
    // høgast fyrst: ei hylle er så høg som den fyrste delen i henne, og ein
    // liten del lagd fyrst kastar bort resten av rada
    const items = list
      .map((q) => {
        const b = bbox(q.outline)
        const w = b.x1 - b.x0
        const h = b.y1 - b.y0
        // legg delen den vegen som gjev lågast hylle
        const rot = h > w
        return { part: q, w: rot ? h : w, h: rot ? w : h, rot }
      })
      .sort((a, b) => b.h - a.h)

    let sheet: Sheet | null = null
    let x = PAD
    let y = PAD
    let shelf = 0
    for (const it of items) {
      area += it.w * it.h
      if (!sheet || x + it.w + PAD > SHEET_W || (y + it.h + PAD > SHEET_H && x > PAD)) {
        if (sheet && x + it.w + PAD > SHEET_W && y + shelf + it.h + 2 * PAD <= SHEET_H) {
          y += shelf + PAD
          x = PAD
          shelf = 0
        } else {
          sheet = { t, w: SHEET_W, h: SHEET_H, placed: [], util: 0, used: 0 }
          sheets.push(sheet)
          x = PAD
          y = PAD
          shelf = 0
        }
      }
      sheet = sheet as Sheet
      sheet.placed.push({ part: it.part, x, y, rot: it.rot })
      sheet.used = Math.max(sheet.used, y + it.h + PAD)
      x += it.w + PAD
      if (it.h > shelf) shelf = it.h
    }
  }
  let used = 0
  for (const s of sheets) {
    let a = 0
    for (const q of s.placed) a += q.part.area
    s.util = a / (s.w * s.h)
    used += a
  }
  return { sheets, area, used }
}
