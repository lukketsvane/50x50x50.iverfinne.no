/**
 * LAFT — delane slik dei ligg på plata.
 *
 * Konturen i planet ER kuttprofilen: ingen utrekning, ingen projeksjon.
 * Det er heile poenget med typologien — det du ser i «kontur» er det
 * fresen køyrer. Like delar (dei to bladene) deler id, so nestinga kan
 * dele maske og teikninga kan telje dei som eitt emne.
 */
import { MATERIALS, type Pt } from "../core"
import { bygg, delAreal, materialet } from "./profil"
import type { Params } from "./params"

export type Part = {
  id: string
  outline: Pt[]
  holes: Pt[][]
  t: number
  area: number
  mass: number
}

export type PartList = { parts: Part[]; ids: string[]; area: number; mass: number }

export function buildParts(p: Params): PartList {
  const b = bygg(p)
  const rho = MATERIALS[materialet(p)].rho
  const parts: Part[] = b.delar.map((d) => {
    const area = delAreal(d)
    return {
      // dei to bladene er same emnet: same id, éi maske, ein blankett
      id: d.kind === "bein" ? "bein" : d.id,
      outline: d.outline,
      holes: d.holes,
      t: d.t,
      area,
      mass: (area * d.t * rho) / 1e9,
    }
  })
  return {
    parts,
    ids: parts.map((q) => q.id),
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
