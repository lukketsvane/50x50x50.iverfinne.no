/**
 * SKIVE — delane.
 *
 * Kvar skive er ein del, og delen ER silhuetten med stavhòla i — same
 * polygon som nettet og kuttfila les. Morfen er symmetrisk, so skive i og
 * skive n−1−i er den same delen; det er talet på UNIKE delar som avgjer
 * kor mange oppspenningar verkstaden treng.
 *
 * Delane har same form som VAFFEL sine, med vilje: då kan nestinga,
 * DXF-en og kuttarket brukast om att utan å skrivast opp att.
 */
import { MATERIALS, bbox, shoelace, type Material, type Pt } from "../core"
import type { Part, PartList } from "../vaffel/parts"
import type { Build } from "./profile"
import type { Params } from "./params"

function shapeKey(o: Pt[], holes: Pt[][]): string {
  const b = bbox(o)
  const round = (v: number) => Math.round(v * 10)
  const one = (ring: Pt[]) =>
    ring.map((q) => `${round(q[0] - b.x0)},${round(q[1] - b.y0)}`).join(";")
  return [one(o), ...holes.map(one)].join("|")
}

export function buildParts(p: Params, b: Build): PartList {
  const rho = MATERIALS[p.material as Material].rho
  const parts: Part[] = []
  const seen = new Map<string, string>()
  const ids: string[] = []

  for (const sl of b.slices) {
    let area = Math.abs(shoelace(sl.outline))
    for (const h of sl.holes) area -= Math.abs(shoelace(h))
    if (area < 400) continue
    const key = shapeKey(sl.outline, sl.holes)
    let id = seen.get(key)
    if (!id) {
      id = `S${String(ids.length + 1).padStart(2, "0")}`
      seen.set(key, id)
      ids.push(id)
    }
    parts.push({
      id,
      outline: sl.outline,
      holes: sl.holes,
      t: p.plyT,
      area,
      mass: (area * p.plyT * rho) / 1e9,
    })
  }

  return {
    parts,
    ids,
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
