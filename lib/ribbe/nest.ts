/**
 * RIBBE — delane lagde ut på plate.
 *
 * Rasterpakkinga i lib/nestraster.ts, med ribba sine mål. Før låg her
 * frie rektangel over omrissa, og fila sa sjølv kva det kosta: ringane
 * er annulusar, og hòlet i midten var reint avfall. Rasteret pakkar
 * etter YTTERKONTUREN, so blad legg seg inn i ringane sine opningar —
 * det var den pakkinga kommentaren lova.
 */
import { nestRaster, placedRings, type NestVal } from "../nestraster"
import type { Part } from "./parts"

export const SHEET_W = 2500
export const SHEET_H = 1250

export type Placed = import("../nestraster").Placed<Part>
export type Sheet = import("../nestraster").Sheet<Part>
export type Nesting = import("../nestraster").Nesting<Part>

export function nest(parts: Part[], val?: Partial<NestVal>): Nesting {
  return nestRaster(parts, { sheetW: SHEET_W, sheetH: SHEET_H, gap: 8, cell: 6, ...val })
}

/** medgått plateareal: breidda gonger den brukte lengda, summert over arka */
export function nestArea(ns: Nesting): number {
  return ns.sheets.reduce((s, q) => s + q.used * ns.sheetW, 0)
}

export { placedRings }
