/**
 * STRAUM — delane lagde ut på plate.
 *
 * Rasterpakkinga i lib/nestraster.ts, gruppert etter platetjukn: finnane
 * på si plate, sokkel og kappe på sine. Før låg her hyllerader med tolv
 * millimeter luft, og fila orsaka seg med at tjuefire finneemne ikkje
 * let seg nesta tett; rasteret pakkar etter ytterkonturen og let emna
 * gripe inn i kvarandre, so talet vart betre enn orsakinga.
 */
import { nestRaster, placedRings, type NestVal } from "../nestraster"
import { bbox } from "../core"
import type { Part } from "./parts"

/** standardplate, mm */
export const SHEET_W = 2440
export const SHEET_H = 1220

export type Placed = import("../nestraster").Placed<Part>
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

export function nest(parts: Part[], val?: Partial<NestVal>): Nesting {
  const groups = new Map<number, Part[]>()
  for (const q of parts) {
    const k = Math.round(q.t * 10)
    const cur = groups.get(k)
    if (cur) cur.push(q)
    else groups.set(k, [q])
  }
  const sheets: Sheet[] = []
  let area = 0
  let used = 0
  for (const [k, list] of [...groups].sort((a, b) => a[0] - b[0])) {
    const t = k / 10
    for (const q of list) {
      const b = bbox(q.outline)
      area += (b.x1 - b.x0) * (b.y1 - b.y0)
    }
    const ns = nestRaster(list, {
      sheetW: SHEET_W,
      sheetH: SHEET_H,
      gap: 8,
      cell: 6,
      ...val,
    })
    for (const s of ns.sheets) {
      let a = 0
      for (const q of s.placed) a += q.part.area
      used += a
      // utnyttinga mot BRUKT stripe, som i dei andre motorane — resten av
      // plata er ikkje avfall, han er plate ein framleis har
      sheets.push({
        t,
        w: s.w,
        h: s.h,
        placed: s.placed,
        util: a / (s.w * Math.max(1, s.used)),
        used: s.used,
      })
    }
  }
  return { sheets, area, used }
}

export { placedRings }
