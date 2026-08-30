/**
 * VAFFEL — delane lagde ut på plate.
 *
 * Sjølve pakkinga bur i lib/nestraster.ts (flytt dit då STRAUM og RIBBE
 * skulle få same rasteret); her står berre vaffelen sine mål: heil
 * fresarplate og 8 mm luft — fresen sin diameter pluss litt å ta i.
 * Cella på 6 mm er budsjettet for den levande målinga; eksporten sender
 * eigne val gjennom `val`.
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
export function usedArea(ns: Nesting): number {
  return ns.sheets.reduce((s, q) => s + q.used * ns.sheetW, 0)
}

export { placedRings }
