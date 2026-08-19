/**
 * RIBBE — SVG ut.
 *
 * To teikningar, og dei svarar på kvar sitt spørsmål. Kuttarket svarar på
 * «kva må eg kjøpe og kva ligg kvar», og profilarket svarar på «kor mange
 * ulike delar er dette eigentleg». Det siste er det interessante talet i
 * typologien: er planet rundt, fell alle bladprofilane saman i éin strek og
 * objektet er tjueto kopiar av éin del. Er det ovalt, er dei seks.
 *
 * SVG-en er i millimeter med viewBox i millimeter, så eit uttak kan
 * skrivast ut i 1:1 utan at nokon må rekna om noko.
 */
import { bbox, type Pt } from "../core"
import type { Shell } from "./shell"
import type { Built } from "./mesh"
import { outlineOf } from "./mesh"
import { placedRings, type Nesting } from "./nest"

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
 * Profilarket: alle bladprofilane lagde oppå kvarandre i sitt eige plan, og
 * ringane sett ovanfrå ved sida av. Det er den einaste teikninga som viser
 * kva som er felles og kva som skil.
 */
export function profileSvg(sh: Shell, g: Built): string {
  const W = 1200
  const H = 700
  const body: string[] = []

  let rMax = 0
  for (const bl of g.blades) for (const q of bl.st) rMax = Math.max(rMax, q.b)
  const sc = Math.min((W * 0.52) / (rMax + sh.rHub), (H * 0.86) / sh.zTop)
  const ox = 40
  const oy = H - 40

  for (const bl of g.blades) {
    const d = path(outlineOf(bl).map((q): Pt => [ox + (sh.rHub + q[0]) * sc, oy - q[1] * sc]))
    body.push(
      `<path d="${d}" fill="none" stroke="#111" stroke-width="${bl.b.k % 3 === 0 ? 1.4 : 0.4}" opacity="${bl.b.k % 3 === 0 ? 1 : 0.55}"/>`,
    )
  }

  const cx = W - 260
  const cy = 250
  const rs = Math.min(220 / (rMax + sh.p.bandOut), 1)
  for (const bd of g.bands) {
    for (const ring of [
      bd.st.map((q): Pt => [cx + q.b * rs * Math.cos(q.u), cy - q.b * rs * Math.sin(q.u)]),
      bd.st.map((q): Pt => [cx + q.a * rs * Math.cos(q.u), cy - q.a * rs * Math.sin(q.u)]),
    ]) {
      body.push(`<path d="${path(ring)}" fill="none" stroke="#111" stroke-width="0.8"/>`)
    }
  }
  const so = g.seat.outline.map((q): Pt => [cx + q[0] * rs, cy + 400 - q[1] * rs])
  body.push(`<path d="${path(so)}" fill="none" stroke="#111" stroke-width="1.4"/>`)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="#fff"/>`,
    ...body,
    `<text x="40" y="30" font-family="monospace" font-size="16" fill="#111">RIBBE · ${g.blades.length} bladprofilar over kvarandre · ${g.bands.length} ringar · sete</text>`,
    `</svg>`,
  ].join("\n")
}
