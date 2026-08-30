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
/**
 * ALLE arka i éi fil, stabla under kvarandre. Arka i STRAUM kan ha ulik
 * storleik (finner, sokkel og kappe har kvar si platetjukn), so kvart
 * band er så høgt som sitt eige ark.
 */
export function alleArkSvg(nesting: Nesting): string {
  const GAP = 60
  const W = Math.max(...nesting.sheets.map((s) => s.w))
  const total = nesting.sheets.reduce((a, s) => a + s.h, 0) + GAP * (nesting.sheets.length - 1)
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${total}mm" viewBox="0 0 ${W} ${total}">`,
  ]
  let off = 0
  nesting.sheets.forEach((s, i) => {
    const eitt = sheetSvg(nesting, i)
    const indre = eitt.slice(eitt.indexOf(">") + 1, eitt.lastIndexOf("</svg>"))
    out.push(`<g transform="translate(0,${off})">${indre}</g>`)
    off += s.h + GAP
  })
  out.push(`</svg>`)
  return out.join("\n")
}

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
 * Konturkartet: finneemna lagde oppå kvarandre i sitt eige felt, og sokkel-
 * og kappeplatene i sitt — med SAME målestokk, so storleiken kan lesast på
 * tvers. Kvar femte finneprofil står tjukkare, slik at auga kan telje seg
 * gjennom stabelen utan å telje kvar linje.
 *
 * Dei to familiane fekk kvar sitt felt av ein grunn: finnane er STÅANDE
 * snitt gjennom kroppen og platene er LIGGJANDE plan, og lagde oppå
 * kvarandre i eitt koordinatsystem las ingen nokon av delane — det var
 * berre ein graut av strekar. Arket er fast og innhaldet skalert inn;
 * kuttfila er ARK-en, denne teikninga er til å lesa.
 */
export function contourMapSvg(build: Build): string {
  const W = 1200
  const H = 700
  const M = 40

  const famBox = (parts: { outline: Pt[] }[]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const q of parts) {
      const b = bbox(q.outline)
      if (b.x0 < x0) x0 = b.x0
      if (b.x1 > x1) x1 = b.x1
      if (b.y0 < y0) y0 = b.y0
      if (b.y1 > y1) y1 = b.y1
    }
    if (!Number.isFinite(x0)) { x0 = x1 = y0 = y1 = 0 }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
  }
  const fb = famBox(build.fins)
  const pb = famBox(build.plates)

  // venstre felt til finnane, høgre til platene — felles målestokk
  const finSlotW = W * 0.5
  const plateSlotW = W - finSlotW - 3 * M
  const slotH = H - 2 * M - 30
  const sc = Math.min(
    finSlotW / Math.max(1, fb.w),
    plateSlotW / Math.max(1, pb.w),
    slotH / Math.max(1, fb.h),
    slotH / Math.max(1, pb.h),
  )

  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`,
  )

  // finnane: sentrerte i sitt felt, Y snudd — emna står oppreiste
  const fcx = M + finSlotW / 2
  const fcy = 30 + M + slotH / 2
  const fmap = (q: Pt): Pt => [
    fcx + (q[0] - (fb.x0 + fb.x1) / 2) * sc,
    fcy - (q[1] - (fb.y0 + fb.y1) / 2) * sc,
  ]
  build.fins.forEach((q, i) => {
    const bold = i % 5 === 0
    out.push(
      `<path d="${path([q.outline.map(fmap), ...q.holes.map((h) => h.map(fmap))])}" fill="none" stroke="${bold ? "#111" : "#999"}" stroke-width="${bold ? 1.3 : 0.6}" fill-rule="evenodd"/>`,
    )
  })

  // platene: konsentriske i sitt felt, som eit kotekart
  const pcx = M + finSlotW + M + plateSlotW / 2
  const pcy = fcy
  const pmap = (q: Pt): Pt => [
    pcx + (q[0] - (pb.x0 + pb.x1) / 2) * sc,
    pcy - (q[1] - (pb.y0 + pb.y1) / 2) * sc,
  ]
  build.plates.forEach((q) => {
    out.push(
      `<path d="${path([q.outline.map(pmap), ...q.holes.map((h) => h.map(pmap))])}" fill="none" stroke="#8a8377" stroke-width="0.9" fill-rule="evenodd"/>`,
    )
  })

  out.push(
    `<text x="${M}" y="30" font-family="monospace" font-size="16" fill="#111">STRAUM · ${build.fins.length} finneemne over kvarandre · sokkel og kappe</text>`,
    `</svg>`,
  )
  return out.join("\n")
}
