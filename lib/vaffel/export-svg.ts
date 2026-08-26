/**
 * VAFFEL — SVG ut.
 *
 * To teikningar, og dei svarar på kvar sitt spørsmål. Kuttarket svarar på
 * «kva må eg kjøpe og kva ligg kvar», og profilarket svarar på «kor mange
 * ulike delar er dette eigentleg». Det siste er det interessante talet i
 * typologien: er planet kvadratisk, fell X- og Y-familien saman og
 * objektet er nitten kopiar av éin del. Er planet ovalt, er dei fleire.
 *
 * SVG-en er i millimeter med viewBox i millimeter, så eit uttak kan
 * skrivast ut i 1:1 utan at nokon må rekna om noko.
 */
import { bbox, type Pt } from "../core"
import { placedRings, type Nesting } from "./nest"
import type { Grid } from "./ribs"

const f = (v: number) => (Math.abs(v) < 1e-4 ? "0" : v.toFixed(2))
const path = (pts: Pt[]) =>
  pts.map((q, i) => `${i ? "L" : "M"}${f(q[0])},${f(q[1])}`).join(" ") + "Z"

/**
 * Kuttarket. Y vert spegla, av di SVG reknar nedover og ei plate ikkje gjer
 * det: delen som ligg nede til venstre på plata skal liggja nede til
 * venstre på arket.
 */
export function sheetSvg(n: Nesting, index = 0): string {
  const sheet = n.sheets[Math.min(index, n.sheets.length - 1)]
  if (!sheet) return "<svg xmlns='http://www.w3.org/2000/svg'/>"
  const W = n.sheetW
  const H = n.sheetH
  const body: string[] = []
  for (const q of sheet.placed) {
    const r = placedRings(q)
    body.push(`<path d="${path(r.outline)}" fill="#f2efe9" stroke="#111" stroke-width="1"/>`)
    for (const h of r.holes) {
      body.push(`<path d="${path(h)}" fill="#fff" stroke="#111" stroke-width="1"/>`)
    }
    const b = bbox(r.outline)
    body.push(
      `<text x="${f((b.x0 + b.x1) / 2)}" y="${f((b.y0 + b.y1) / 2)}" font-family="monospace" font-size="16" text-anchor="middle" fill="#111">${q.part.id}</text>`,
    )
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
    `<g transform="translate(0,${H}) scale(1,-1)">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#c00" stroke-width="2" stroke-dasharray="12 8"/>`,
    ...body,
    `</g>`,
    `<text x="20" y="${H - 16}" font-family="monospace" font-size="20" fill="#111">ARK ${index + 1}/${n.sheets.length} · ${W} × ${H} mm · utnytting ${Math.round(n.util * 100)} %</text>`,
    `</svg>`,
  ].join("\n")
}

/**
 * Profilarket. Alle ribbene lagde ut ved sida av kvarandre i den
 * rekkjefylgja dei står i, X-familien øvst og Y-familien nedst.
 *
 * Arket svarar på eitt spørsmål: kor mange ULIKE delar er dette? Er planet
 * kvadratisk og ribbetalet likt, fell dei to familiane saman og heile
 * møbelet er nitten kopiar av ni delar. Er planet ovalt, er dei atten.
 *
 * Arket er FAST og innhaldet skalert inn, ikkje omvendt: eit ark i
 * millimeter etter atten ribber vart over to meter breidt, og på det
 * arket var ein strek på 0,6 mm usynleg i panelet. Kuttfila er ARK-en;
 * denne teikninga er til å lesa.
 */
export function profileSvg(g: Grid): string {
  const W = 1200
  const M = 40
  const GAP = 24 // luft mellom ribbene, i røynda-millimeter før skalering
  const xr = g.ribs.filter((r) => r.axis === "x")
  const yr = g.ribs.filter((r) => r.axis === "y")

  const extent = (rs: typeof g.ribs) => {
    let w = 0
    let h = 0
    for (const r of rs) {
      let lo = Infinity
      let hi = -Infinity
      let top = 0
      for (const ring of r.outlines) {
        for (const q of ring) {
          lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]); top = Math.max(top, q[1])
        }
      }
      w += hi - lo + GAP
      h = Math.max(h, top)
    }
    return { w, h }
  }
  const ex = extent(xr)
  const ey = extent(yr)
  const contentW = Math.max(ex.w, ey.w)
  const contentH = ex.h + ey.h + GAP
  // breidda styrer skalaen; høgda fylgjer innhaldet, so arket er tett
  // kring teikninga i staden for å bera ei halv side kvit luft. Taket på
  // 700 vernar mot eit smalt, høgt rutenett med få, høge ribber.
  const sc = Math.min((W - 2 * M) / Math.max(1, contentW), (700 - 2 * M - 70) / Math.max(1, contentH))
  const H = Math.ceil(30 + M + contentH * sc + 36 + M / 2)

  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`)
  out.push(`<rect width="${W}" height="${H}" fill="#fff"/>`)

  let yOff = M + 30 + ex.h * sc
  for (const rs of [xr, yr]) {
    let x = M
    for (const r of rs) {
      let lo = Infinity
      let hi = -Infinity
      for (const ring of r.outlines) for (const q of ring) {
        lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0])
      }
      if (!Number.isFinite(lo)) continue
      for (const ring of [...r.outlines, ...r.holes]) {
        // Y vert spegla: SVG reknar nedover, og ei ribbe står oppreist.
        const pts = ring.map((q) => [x + (q[0] - lo) * sc, yOff - q[1] * sc] as Pt)
        out.push(`<path d="${path(pts)}" fill="none" stroke="#111" stroke-width="0.9"/>`)
      }
      out.push(
        `<text x="${f(x + 2)}" y="${f(yOff + 14)}" font-family="monospace" ` +
          `font-size="11" fill="#666">${r.axis.toUpperCase()}${r.k + 1}</text>`,
      )
      x += (hi - lo) * sc + GAP * sc
    }
    yOff += ey.h * sc + GAP * sc + 18
  }
  out.push(
    `<text x="${M}" y="30" font-family="monospace" font-size="16" fill="#111">VAFFEL · ${xr.length} ribber langs X · ${yr.length} langs Y</text>`,
  )
  out.push("</svg>")
  return out.join("\n")
}
