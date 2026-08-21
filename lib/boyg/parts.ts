/**
 * BØYG — delane.
 *
 * Ein del er ein BLANKETT: den flate plata slik ho vert skoren FØR ho går
 * i pressa. Utrullinga er eksakt så lenge skalet er einkrumt — bøyinga
 * går kring ein akse på tvers, og bogelengda langs senterlina er den same
 * flat som bøygd. Difor er blanketten rett fram lengda langs og breidda på
 * tvers, med skuldra i hjørna og dybelhòlet der det sit.
 *
 * Ingen to blankettar er like. Kvart skal ligg utanpå det førre i forma,
 * so radien i kvar fold veks med forskuvinga, og lengda veks med han.
 * Talet på UNIKE delar er difor lik talet på skal — og det er nett det
 * talet som seier kor mange innlegg forma treng.
 */
import { MATERIALS, shoelace, type Material, type Pt } from "../core"
import type { Part, PartList } from "../vaffel/parts"
import { blankett, type Bygg } from "./form"
import type { Params } from "./params"

export function buildParts(b: Bygg, p: Params): PartList {
  const rho = MATERIALS[p.material as Material].rho
  const parts: Part[] = []
  const ids: string[] = []

  b.skal.forEach((sk, i) => {
    const bl = blankett(sk, p, Math.max(1, Math.round(sk.st.length / 90)))
    let area = Math.abs(shoelace(bl.outline as Pt[]))
    for (const h of bl.holes) area -= Math.abs(shoelace(h as Pt[]))
    if (area < 400) return
    const id = `B${String(i + 1).padStart(2, "0")}`
    ids.push(id)
    parts.push({
      id,
      outline: bl.outline as Pt[],
      holes: bl.holes as Pt[][],
      t: p.plyT,
      area,
      mass: (area * p.plyT * rho) / 1e9,
    })
  })

  return {
    parts,
    ids,
    area: parts.reduce((s, q) => s + q.area, 0),
    mass: parts.reduce((s, q) => s + q.mass, 0),
  }
}
