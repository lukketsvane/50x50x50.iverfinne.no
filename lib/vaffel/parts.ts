/**
 * VAFFEL — dei flate delane, og plata dei kjem av.
 *
 * Kvar del er ei ribbe, og ribba ER konturen: spora står alt i polygonet
 * frå `ribs.ts`, av di dei vart skorne i feltet og ikkje lagde oppå
 * etterpå. Difor finst det ikkje eit steg her der kuttfila kan skilje lag
 * frå biletet.
 *
 * To ribber med same profil er den same delen. Med eit symmetrisk plan er
 * ni av atten unike, og det talet står i lista av di det er talet som
 * avgjer kor mange oppspenningar ein treng.
 */
import { bbox, MATERIALS, shoelace, type Material, type Pt } from "../core"
import type { Grid } from "./ribs"

export type Part = {
  id: string
  outline: Pt[]
  holes: Pt[][]
  t: number
  area: number
  mass: number
}

export type PartList = {
  parts: Part[]
  ids: string[]
  area: number
  mass: number
}

/** Ein signatur som er lik for like delar og ulik for ulike. Punkta vert
 *  runda til ein tidel: to profilar som skil seg med mindre enn det, skil
 *  seg med mindre enn fresen kan halde. */
function shapeKey(o: Pt[], holes: Pt[][]): string {
  const b = bbox(o)
  const round = (v: number) => Math.round(v * 10)
  const one = (ring: Pt[]) =>
    ring.map((q) => `${round(q[0] - b.x0)},${round(q[1] - b.y0)}`).join(";")
  return [one(o), ...holes.map(one)].join("|")
}

export function buildParts(g: Grid, mat: Material): PartList {
  const rho = MATERIALS[mat].rho
  const t = g.b.p.ribbT
  const parts: Part[] = []
  const seen = new Map<string, string>()
  const ids: string[] = []

  const push = (o: Pt[], holes: Pt[][]) => {
    let area = Math.abs(shoelace(o))
    for (const h of holes) area -= Math.abs(shoelace(h))
    if (area < 400) return
    const key = shapeKey(o, holes)
    let id = seen.get(key)
    if (!id) {
      id = `V${String(ids.length + 1).padStart(2, "0")}`
      seen.set(key, id)
      ids.push(id)
    }
    parts.push({ id, outline: o, holes, t, area, mass: (area * t * rho) / 1e9 })
  }

  for (const r of g.ribs) {
    // Hòl høyrer til det ytterkanten som omsluttar dei. Med éin ytterkant
    // er det trivielt; er ribba delt, må kvart hòl finne heimen sin.
    for (const o of r.outlines) {
      const b = bbox(o)
      const mine = r.holes.filter((h) => {
        const c = bbox(h)
        return c.x0 >= b.x0 && c.x1 <= b.x1 && c.y0 >= b.y0 && c.y1 <= b.y1
      })
      push(o, r.outlines.length === 1 ? r.holes : mine)
    }
  }

  return {
    parts,
    ids,
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
