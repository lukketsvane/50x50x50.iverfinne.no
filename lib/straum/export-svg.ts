/**
 * STRAUM — SVG ut.
 *
 * To teikningar. `sheetSvg` er eitt plateoppsett slik det kjem ut av
 * nestinga, med delnummer i kvar del — det er arket ein tek med seg til
 * fresen. `contourMapSvg` er alle finneemna lagde oppå kvarandre i eitt
 * plan; det er den einaste teikninga som viser kva skiveplana gjer med
 * kroppen, av di kvar profil er eit snitt gjennom han.
 *
 * Ingen skrift utanom talet på delen: eit ark som skal skrivast ut skal
 * kunne lesast av ein som ikkje har opna sandkassen.
 */
import { bbox, nn, type Pt } from "../core"
import type { Build } from "./parts"
import { placedRings, type Nesting } from "./nest"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
const num = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(2))

function path(rings: Pt[][]): string {
  const out: string[] = []
  for (const r of rings) {
    if (r.length < 2) continue
    out.push(`M${num(r[0][0])} ${num(r[0][1])}`)
    for (let i = 1; i < r.length; i++) out.push(`L${num(r[i][0])} ${num(r[i][1])}`)
    out.push("Z")
  }
  return out.join(" ")
}

/**
 * Eitt ark. Y vert snudd, av di SVG tel nedover og plata ikkje gjer det;
 * ein del som er spegelvendt i høve til DXF-en er ein del som vert kutta
 * spegelvendt.
 */
export function sheetSvg(nesting: Nesting, i: number): string {
  const s = nesting.sheets[Math.max(0, Math.min(nesting.sheets.length - 1, i))]
  if (!s) return `<svg xmlns="http://www.w3.org/2000/svg"/>`
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}mm" height="${s.h}mm" viewBox="0 0 ${s.w} ${s.h}">`,
    `<rect x="0" y="0" width="${s.w}" height="${s.h}" fill="#fff" stroke="#bbb" stroke-width="2"/>`,
    `<g transform="translate(0,${s.h}) scale(1,-1)">`,
  )
  for (const q of s.placed) {
    const r = placedRings(q)
    out.push(
      `<path d="${path([r.outline, ...r.holes])}" fill="#f2efe9" stroke="#111" stroke-width="1.4" fill-rule="evenodd"/>`,
    )
  }
  out.push(`</g>`)
  for (const q of s.placed) {
    const r = placedRings(q)
    const b = bbox(r.outline)
    const cx = (b.x0 + b.x1) / 2
    const cy = s.h - (b.y0 + (b.y1 - b.y0) * 0.22)
    out.push(
      `<text x="${num(cx)}" y="${num(cy)}" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#111">${esc(q.part.id)}</text>`,
    )
  }
  out.push(
    `<text x="20" y="34" font-family="sans-serif" font-size="26" fill="#111">ARK ${i + 1}/${nesting.sheets.length} · ${nn(s.t, 1)} mm · ${s.placed.length} delar · utnytting ${nn(s.util * 100, 0)} %</text>`,
    `</svg>`,
  )
  return out.join("\n")
}

/**
 * Konturkartet: alle finneemna lagde oppå kvarandre i sitt eige plan, med
 * sokkel- og kappeomrissa under. Kvar femte profil står tjukkare, slik at
 * auga kan telje seg gjennom stabelen utan å telje kvar linje.
 */
export function contourMapSvg(build: Build): string {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const q of build.parts) {
    const b = bbox(q.outline)
    if (b.x0 < x0) x0 = b.x0
    if (b.x1 > x1) x1 = b.x1
    if (b.y0 < y0) y0 = b.y0
    if (b.y1 > y1) y1 = b.y1
  }
  const pad = 30
  const w = x1 - x0 + 2 * pad
  const h = y1 - y0 + 2 * pad
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}mm" height="${num(h)}mm" viewBox="0 0 ${num(w)} ${num(h)}">`,
    `<rect x="0" y="0" width="${num(w)}" height="${num(h)}" fill="#fff"/>`,
    `<g transform="translate(${num(pad - x0)},${num(h - pad + y0)}) scale(1,-1)">`,
  )
  build.plates.forEach((q) => {
    out.push(
      `<path d="${path([q.outline, ...q.holes])}" fill="none" stroke="#c8c2b6" stroke-width="0.8" fill-rule="evenodd"/>`,
    )
  })
  build.fins.forEach((q, i) => {
    const bold = i % 5 === 0
    out.push(
      `<path d="${path([q.outline, ...q.holes])}" fill="none" stroke="${bold ? "#111" : "#777"}" stroke-width="${bold ? 1.2 : 0.5}" fill-rule="evenodd"/>`,
    )
  })
  out.push(`</g>`, `</svg>`)
  return out.join("\n")
}
