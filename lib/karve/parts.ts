/**
 * KARVE — delane.
 *
 * Ein del er ei PLATE i limstabelen, grovkutta til det største omrisset
 * objektet har innanfor plata si eiga høgd. Det er den einaste kuttfila
 * typologien har: alt anna vert gjort av fresen etter at limet er tørt.
 *
 * Delane har same form som VAFFEL sine med vilje, so nestinga, DXF-en og
 * kuttarket kan brukast om att utan å skrivast opp att. Ingen plate har
 * hòl — eit hòl i emnet ville vore ein stad fresen ikkje fekk lov å gå.
 */
import { MATERIALS, bbox, type Material, type Pt } from "../core"
import type { Part, PartList } from "../vaffel/parts"
import { plater, type Karv } from "./form"
import type { Params } from "./params"

/** signatur som er lik for like plater; ein tidels millimeter er under fresen */
function shapeKey(o: Pt[]): string {
  const b = bbox(o)
  return o.map((q) => `${Math.round((q[0] - b.x0) * 10)},${Math.round((q[1] - b.y0) * 10)}`).join(";")
}

/** færre punkt i kuttfila enn i nettet: fresen les mm, ikkje mikron */
function tynn(ring: Pt[], steg: number): Pt[] {
  if (steg <= 1) return ring
  const out: Pt[] = []
  for (let i = 0; i < ring.length; i += steg) out.push(ring[i])
  return out.length >= 8 ? out : ring
}

export function buildParts(k: Karv, p: Params): PartList {
  const rho = MATERIALS[p.material as Material].rho
  const parts: Part[] = []
  const seen = new Map<string, string>()
  const ids: string[] = []
  const steg = Math.max(1, Math.round(k.nth / 96))

  for (const pl of plater(k, p)) {
    const t = pl.z1 - pl.z0
    if (pl.area < 400 || t < 0.5) continue
    const outline = tynn(pl.outline, steg)
    const key = shapeKey(outline)
    let id = seen.get(key)
    if (!id) {
      id = `K${String(ids.length + 1).padStart(2, "0")}`
      seen.set(key, id)
      ids.push(id)
    }
    parts.push({
      id,
      outline,
      holes: [],
      t,
      area: pl.area,
      mass: (pl.area * t * rho) / 1e9,
    })
  }

  return {
    parts,
    ids,
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
