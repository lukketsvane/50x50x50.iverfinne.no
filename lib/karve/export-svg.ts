/**
 * KARVE — platekartet.
 *
 * Alle laga i limstabelen, teikna oppå kvarandre i eitt bilete med
 * høgdetalet ved sida av. Det er ikkje ei kuttfil — kuttfila er arket —
 * men det er den einaste teikninga som syner kva blokken faktisk er:
 * eit kotekart av objektet, med same linjene som seinare kjem fram i
 * den slipte flata.
 *
 * SVG-en er i millimeter med viewBox i millimeter, so eit uttak kan
 * målast rett av fila.
 */
import type { Pt } from "../core"
import { plater, type Karv } from "./form"
import type { Params } from "./params"

const f = (v: number) => (Math.abs(v) < 1e-4 ? "0" : (Math.round(v * 100) / 100).toString())
const path = (pts: Pt[]) =>
  pts.map((q, i) => `${i ? "L" : "M"}${f(q[0])},${f(q[1])}`).join(" ") + " Z"

export function koteSvg(k: Karv, p: Params): string {
  const pl = plater(k, p)
  let R = 1
  for (const q of pl) for (const v of q.outline) R = Math.max(R, Math.hypot(v[0], v[1]))
  const M = 40
  const W = 2 * R + 2 * M
  const body: string[] = []
  pl.forEach((q, i) => {
    const t = pl.length > 1 ? i / (pl.length - 1) : 0
    const g = Math.round(30 + t * 150)
    body.push(
      `<path d="${path(q.outline)}" fill="none" stroke="rgb(${g},${g},${g})" stroke-width="${i === 0 ? 1.6 : 0.7}"/>`,
    )
  })
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(W)}mm" viewBox="0 0 ${f(W)} ${f(W)}">`,
    `<rect x="0" y="0" width="${f(W)}" height="${f(W)}" fill="#fff"/>`,
    `<g transform="translate(${f(W / 2)} ${f(W / 2)}) scale(1,-1)">`,
    ...body,
    `</g>`,
    `<text x="${f(M)}" y="${f(W - 16)}" font-family="monospace" font-size="16" fill="#111">KARVE · ${pl.length} lag à ${f(p.plyT)} mm · emne ${f(2 * R)} mm</text>`,
    `</svg>`,
  ].join("\n")
}
