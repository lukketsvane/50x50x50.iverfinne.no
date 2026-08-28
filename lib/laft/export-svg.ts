/**
 * LAFT — profilarket.
 *
 * Dei fem kuttprofilane lagde flatt ved sida av kvarandre i eitt band,
 * med spor og hòl teikna der dei sit. SVG-en er i millimeter med viewBox
 * i millimeter, so eit uttak kan målast rett av fila. Dei to bladene er
 * same emnet og står difor éin gong, merkte med talet.
 */
import { bbox, type Pt } from "../core"
import type { Bygg } from "./profil"

const f = (v: number) => (Math.round(v * 100) / 100).toString()
const path = (pts: Pt[]) => `M ${pts.map((q) => `${f(q[0])},${f(q[1])}`).join(" L ")} Z`

export function profileSvg(b: Bygg): string {
  const GAP = 40
  const M = 30
  const seen = new Set<string>()
  const unike = b.delar.filter((d) => {
    const k = d.kind === "bein" ? "bein" : d.id
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  let x = M
  let H = 0
  const grupper: string[] = []
  for (const d of unike) {
    const bb = bbox(d.outline)
    const w = bb.x1 - bb.x0
    const h = bb.y1 - bb.y0
    if (h > H) H = h
    // Y speglar: SVG reknar nedover, ei plate gjer ikkje det
    const map = (q: Pt) => `${f(q[0] - bb.x0 + x)},${f(bb.y1 - q[1])}`
    const ringar = [d.outline, ...d.holes]
      .map(
        (ring) =>
          `<path d="M ${ring.map(map).join(" L ")} Z" fill="none" stroke="#111" stroke-width="0.8"/>`,
      )
      .join("")
    const tal = d.kind === "bein" ? " × 2" : ""
    grupper.push(
      ringar +
        `<text x="${f(x)}" y="${f(h + 18)}" font-family="monospace" font-size="12" fill="#666">${d.kind}${tal}</text>`,
    )
    x += w + GAP
  }
  const W = x + M
  const HH = H + 2 * M
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(HH)}mm" viewBox="0 0 ${f(W)} ${f(HH)}">`,
    `<text x="${M}" y="20" font-family="monospace" font-size="14" fill="#111">LAFT · ${b.delar.length} delar · ${unike.length} ulike emne · ingen lim, ingen skruar</text>`,
    `<g transform="translate(0 ${f(M)})">`,
    ...grupper,
    "</g></svg>",
  ].join("\n")
}
export { path }
