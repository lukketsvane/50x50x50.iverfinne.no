/**
 * SKIVE — profilkartet.
 *
 * Dei unike silhuettane lagde flatt ved sida av kvarandre, med stavhòla
 * teikna der dei sit. SVG-en er i millimeter med viewBox i millimeter, so
 * eit uttak kan målast rett av fila.
 */
import { bbox, type Pt } from "../core"
import type { Build } from "./profile"

const f = (v: number) => (Math.round(v * 100) / 100).toString()

export function profileSvg(b: Build): string {
  const GAP = 26
  const seen = new Set<number>()
  const uniq = b.slices.filter((sl) => {
    const key = Math.round(sl.u * 1000)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let x = GAP
  let H = 0
  const groups: string[] = []
  for (const sl of uniq) {
    const bb = bbox(sl.outline)
    const w = bb.x1 - bb.x0
    const h = bb.y1 - bb.y0
    H = Math.max(H, h)
    const map = (q: Pt) => `${f(q[0] - bb.x0 + x)},${f(bb.y1 - q[1])}`
    const rings = [sl.outline, ...sl.holes]
      .map(
        (ring) =>
          `<path d="M ${ring.map(map).join(" L ")} Z" fill="none" stroke="#111" stroke-width="0.8"/>`,
      )
      .join("")
    groups.push(rings)
    x += w + GAP
  }
  const W = x
  const HH = H + 2 * GAP
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(HH)}mm" viewBox="0 0 ${f(W)} ${f(HH)}">`,
    `<g transform="translate(0 ${f(GAP)})">`,
    ...groups,
    "</g></svg>",
  ].join("\n")
}
