/**
 * KOTE — delane.
 *
 * Kvar plate er ein del, og delen ER kotelina med stavhòla i — nøyaktig
 * det same polygonet nettet og kuttfila les. Det finst ikkje eit steg
 * mellom biletet og fila der dei to kan skilje lag.
 *
 * Skåla i setet står IKKJE i delen: ho er ei lommefresing og ikkje eit
 * gjennomkutt, og eit hòl i kuttfila ville skore botnen ut av setet.
 * Ho er teikna for seg i profilarket.
 *
 * Delane har same form som VAFFEL sine, med vilje: då kan nestinga,
 * DXF-en og kuttarket brukast om att utan å skrivast opp att.
 */
import { MATERIALS, bbox, shoelace, type Material, type Pt } from "../core"
import type { Part, PartList } from "../vaffel/parts"
import type { Build } from "./stack"
import type { Params } from "./params"

/** Ein signatur som er lik for like delar. Punkta vert runda til ein
 *  tidel: to kotelinjer som skil seg med mindre enn det, skil seg med
 *  mindre enn fresen kan halde. */
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

  for (const pl of b.plates) {
    let area = Math.abs(shoelace(pl.outline))
    for (const h of pl.holes) area -= Math.abs(shoelace(h))
    if (area < 400) continue
    const key = shapeKey(pl.outline, pl.holes)
    let id = seen.get(key)
    if (!id) {
      id = `K${String(ids.length + 1).padStart(2, "0")}`
      seen.set(key, id)
      ids.push(id)
    }
    parts.push({
      id,
      outline: pl.outline,
      holes: pl.holes,
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
