/**
 * BØYG — blankettkartet.
 *
 * Den eine teikninga typologien verkeleg treng: skala RULLA UT, slik dei
 * skal skjerast før dei går i pressa. Kvar blankett står med omrisset sitt,
 * bøyelinene tvers over og dybelhòlet der det sit, og kvar bøyeline er
 * merkt med radien og med den vinkelen FORMA skal ha — altså vinkelen
 * pluss spretten attende, av di plata rettar seg ut att når ho slepper.
 *
 * SVG-en er i millimeter med viewBox i millimeter, so eit uttak kan
 * skrivast ut i 1:1 og leggjast rett på plata.
 */
import { nn, type Pt } from "../core"
import { blankett, boyeliner, naerSt, type Bygg } from "./form"
import type { Params } from "./params"

const f = (v: number) => (Math.abs(v) < 1e-4 ? "0" : (Math.round(v * 100) / 100).toString())
const path = (pts: Pt[]) =>
  pts.map((q, i) => `${i ? "L" : "M"}${f(q[0])},${f(q[1])}`).join(" ") + " Z"

export function blankettSvg(b: Bygg, p: Params): string {
  const M = 60
  let maxLen = 0
  for (const sk of b.skal) maxLen = Math.max(maxLen, sk.len)
  const rad = p.breidd + 46
  const W = maxLen + 2 * M
  const H = b.skal.length * rad + 2 * M
  const body: string[] = []

  b.skal.forEach((sk, i) => {
    const oy = M + i * rad + rad / 2
    const bl = blankett(sk, p, 2)
    const map = (q: Pt): Pt => [M + q[0], oy - q[1]]
    body.push(
      `<path d="${path(bl.outline.map(map))}" fill="#f4f1ea" stroke="#111" stroke-width="1.2"/>`,
    )
    for (const h of bl.holes) {
      body.push(`<path d="${path(h.map(map))}" fill="#fff" stroke="#111" stroke-width="1.2"/>`)
    }
    for (const l of boyeliner(sk)) {
      const w = naerSt(sk.st, l.s).w
      const a = map([l.s, -w])
      const c = map([l.s, w])
      body.push(
        `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(c[0])}" y2="${f(c[1])}" stroke="#b4472e" stroke-width="1" stroke-dasharray="9 5"/>`,
      )
      body.push(
        `<text x="${f(a[0] + 3)}" y="${f(a[1] - 6)}" font-family="monospace" font-size="13" fill="#b4472e">R${nn(l.r, 0)}</text>`,
      )
    }
    body.push(
      `<text x="${f(M)}" y="${f(oy - p.breidd / 2 - 12)}" font-family="monospace" font-size="15" fill="#111">B${String(i + 1).padStart(2, "0")} · ${nn(sk.len, 0)} × ${nn(p.breidd, 0)} mm · forskuving ${nn(sk.delta, 0)} mm</text>`,
    )
  })

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">`,
    `<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="#fff"/>`,
    ...body,
    `<text x="${f(M)}" y="${f(H - 20)}" font-family="monospace" font-size="16" fill="#111">BØYG · ${b.skal.length} blankettar à ${nn(p.plyT, 1)} mm · forma overbøygd ${nn(p.sprett, 1)}° · dybel ⌀${nn(p.pinnD, 1)}</text>`,
    `</svg>`,
  ].join("\n")
}
