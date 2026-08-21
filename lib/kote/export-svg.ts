/**
 * KOTE — kotekartet.
 *
 * Alle kotelinene lagde flatt i eit rutenett, nummererte nedanfrå og opp,
 * med stavhòla der dei sit. Seteplata står med rillene sine som tynne
 * strek: dei er lommefres og ikkje gjennomkutt, so dei skal SYNAST i
 * teikninga og ikkje liggje i kuttlaget.
 *
 * SVG-en er i millimeter med viewBox i millimeter, so eit uttak kan
 * målast rett av fila.
 */
import { bbox, nn, type Pt } from "../core"
import type { Build } from "./stack"

const f = (v: number) => (Math.round(v * 100) / 100).toString()

export function planSvg(b: Build): string {
  const GAP = 30
  const n = b.plates.length
  const cols = Math.max(1, Math.round(Math.sqrt(n * 1.7)))
  let w = 0
  let h = 0
  for (const pl of b.plates) {
    const bb = bbox(pl.outline)
    w = Math.max(w, bb.x1 - bb.x0)
    h = Math.max(h, bb.y1 - bb.y0)
  }
  const stepX = w + GAP
  const stepY = h + GAP + 14
  const rows = Math.ceil(n / cols)
  const body: string[] = []

  for (let i = 0; i < n; i++) {
    const pl = b.plates[i]
    const bb = bbox(pl.outline)
    // rada snur: nedste kote nedst på arket, slik ho står i møbelet
    const c = i % cols
    const r = rows - 1 - Math.floor(i / cols)
    const ox = GAP + c * stepX + (w - (bb.x1 - bb.x0)) / 2 - bb.x0
    const oy = GAP + r * stepY + (h - (bb.y1 - bb.y0)) / 2
    const map = (q: Pt) => `${f(q[0] + ox)},${f(oy + (bb.y1 - q[1]))}`
    const seat = i === n - 1
    for (const ring of [pl.outline, ...pl.holes]) {
      body.push(
        `<path d="M ${ring.map(map).join(" L ")} Z" fill="none" stroke="#111" stroke-width="${seat ? 1.4 : 0.8}"/>`,
      )
    }
    if (seat) {
      for (const rg of b.skaal.ringar) {
        if (rg.r1 < 1) continue
        const cx = ox
        const cy = oy + (bb.y1 - 0)
        body.push(
          `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rg.r1)}" fill="none" stroke="#c33" stroke-width="0.5" stroke-dasharray="6 4"/>`,
        )
      }
    }
    body.push(
      `<text x="${f(GAP + c * stepX + w / 2)}" y="${f(GAP + r * stepY + h + 11)}" font-family="monospace" font-size="11" text-anchor="middle" fill="#111">kote ${i + 1} · z ${nn(pl.zm, 0)}</text>`,
    )
  }

  const W = 2 * GAP + cols * stepX - GAP
  const H = 2 * GAP + rows * stepY - GAP
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">`,
    ...body,
    "</svg>",
  ].join("\n")
}
