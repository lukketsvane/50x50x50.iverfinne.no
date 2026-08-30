/**
 * GJEST: ei GLB inn, ei kuttliste ut.
 *
 * Heile vegen i eitt steg — les fila, pass forma inn i kuben, snitt henne
 * i to ribbefamiliar, skjer ledda, pakk delane på plate og skriv arket.
 * Same pakkaren og same luftkravet som motorane i sandkassen brukar; det
 * einaste som er nytt er kvar profilen kjem frå.
 *
 *   npx tsx scripts/gjest.ts <fil.glb> [ut.svg]
 *   npx tsx scripts/gjest.ts stol.glb ark.svg --ribber 11x11 --tjukn 12
 */
import { readFileSync, writeFileSync } from "node:fs"
import { iKuben, lesGlb } from "../lib/gjest/glb.ts"
import { byggVev, STANDARD, type GjestVal } from "../lib/gjest/vev.ts"
import { nestRaster, placedRings, type NestDel } from "../lib/nestraster.ts"

const args = process.argv.slice(2)
const fil = args.find((a) => !a.startsWith("--") && a.endsWith(".glb"))
const svgUt = args.find((a) => !a.startsWith("--") && a.endsWith(".svg"))
if (!fil) {
  console.log("bruk: npx tsx scripts/gjest.ts <fil.glb> [ut.svg] [--ribber 9x9] [--tjukn 9]")
  process.exit(1)
}
const flagg = (namn: string) => {
  const i = args.indexOf("--" + namn)
  return i >= 0 ? args[i + 1] : undefined
}

const val: GjestVal = { ...STANDARD }
const rib = flagg("ribber")
if (rib) {
  const [a, b] = rib.split("x").map(Number)
  if (a > 0) val.nX = a
  if (b > 0) val.nY = b
}
const tj = Number(flagg("tjukn"))
if (tj > 0) val.t = tj
const ma = Number(flagg("maal"))
if (ma > 0) val.maal = ma

const t0 = performance.now()
const raa = lesGlb(readFileSync(fil).buffer as ArrayBuffer)
const tri = iKuben(raa, val.maal)
const tLes = performance.now() - t0

const t1 = performance.now()
const vev = byggVev(tri, val)
const tVev = performance.now() - t1

console.log(`${fil}`)
console.log(`  ${raa.n} trekantar · lesne på ${tLes.toFixed(0)} ms`)
console.log(
  `  ytre mål ${vev.boks.map((v) => v.toFixed(0)).join(" × ")} mm ` +
    `(passa inn til ${val.maal} mm)`,
)
console.log(
  `  ${vev.ribber.length} ribber (${val.nX} × ${val.nY}) · ${vev.ledd} ledd · ` +
    `snitt på ${tVev.toFixed(0)} ms`,
)
if (vev.opne) {
  console.log(
    `  \x1b[33m${vev.opne} opne kjeder — mesh-en er ikkje lukka der, og dei vart ` +
      `lukka med ei rett line\x1b[0m`,
  )
}
if (vev.lause) {
  console.log(
    `  \x1b[31m${vev.lause} ribber har ikkje eit einaste ledd — dei heng ikkje ` +
      `saman med noko\x1b[0m`,
  )
}

// --- held konturane? --------------------------------------------------------
/**
 * Sporskjeringa er den einaste staden i heile kjeda som kan lage ein
 * kontur som kryssar seg sjølv, og ein slik kontur er ikkje ein del: han
 * er ei kuttbane som skjer gjennom sitt eige gods. Han ville dessutan
 * pakka FINT — arealet vert rekna som om han var enkel — so feilen ville
 * lese som ein billeg del.
 */
function kryssarSegSjolv(ring: [number, number][]): boolean {
  const n = ring.length
  // Krysstestet må vera på AVSTAND og ikkje på kryssprodukt. Eit
  // kryssprodukt er eit areal, so han vert liten når segmentet er kort og
  // stor når det er langt — og eit punkt som tilfeldigvis ligg på den
  // uendelege lina gjennom eit segment langt vekke gjev null. Ein
  // rotasjonsflate gjev slike samanfall heile tida, og med rå
  // kryssprodukt les kvar av dei som ein sjølvkryssing. Delt på lengda er
  // talet ein avstand i millimeter, og då tyder terskelen noko.
  const EPS = 1e-6
  const skjer2 = (a: number[], b: number[], c: number[], d: number[]) => {
    const kr = (p: number[], q: number[], r: number[]) =>
      (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    const lcd = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1
    const lab = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const d1 = kr(c, d, a) / lcd
    const d2 = kr(c, d, b) / lcd
    const d3 = kr(a, b, c) / lab
    const d4 = kr(a, b, d) / lab
    const motsett = (u: number, v: number) =>
      (u > EPS && v < -EPS) || (u < -EPS && v > EPS)
    return motsett(d1, d2) && motsett(d3, d4)
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // naboar over skøyten
      if (skjer2(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true
    }
  }
  return false
}
const sjolv = vev.ribber.filter((r) => kryssarSegSjolv(r.outline))
if (sjolv.length) {
  console.log(
    `  \x1b[31m${sjolv.length} ribber har ein kontur som kryssar seg sjølv — ` +
      `sporskjeringa er broten\x1b[0m`,
  )
} else {
  console.log(`  \x1b[32malle ${vev.ribber.length} konturane er enkle\x1b[0m`)
}

// --- på plata ---------------------------------------------------------------
const delar: NestDel[] = vev.ribber.map((r, i) => ({
  id: `${r.akse === 0 ? "x" : "y"}${i}`,
  outline: r.outline,
  holes: r.holes,
  area: r.area,
}))
const SHEET_W = 2440
const SHEET_H = 1220
const ns = nestRaster(delar, {
  sheetW: SHEET_W,
  sheetH: SHEET_H,
  gap: 8,
  cell: 4,
  tett: true,
})
const netto = delar.reduce((s, d) => s + d.area, 0)
console.log(
  `  ${ns.sheets.length} plate(r) på ${SHEET_W} × ${SHEET_H} · ` +
    `plateutnytting ${(ns.util * 100).toFixed(1)} % · ` +
    `netto ${(netto / 1e6).toFixed(2)} m² finér`,
)

// --- kuttarket --------------------------------------------------------------
if (svgUt) {
  const bit: string[] = []
  const H = ns.sheets.reduce((s, a) => s + a.h + 60, 0)
  bit.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}" height="${H}" ` +
      `viewBox="0 0 ${SHEET_W} ${H}">`,
    `<rect width="${SHEET_W}" height="${H}" fill="#fff"/>`,
  )
  let y = 0
  ns.sheets.forEach((ark, i) => {
    bit.push(
      `<g transform="translate(0 ${y})">`,
      `<rect width="${ark.w}" height="${ark.h}" fill="none" stroke="#ccc" stroke-width="2"/>`,
      `<rect width="${ark.w}" height="${ark.used}" fill="none" stroke="#e33" ` +
        `stroke-width="1" stroke-dasharray="12 8"/>`,
      `<text x="8" y="-14" font-family="monospace" font-size="22" fill="#333">` +
        `plate ${i + 1} — ${ark.placed.length} delar, brukt ${ark.used.toFixed(0)} mm</text>`,
    )
    for (const q of ark.placed) {
      const r = placedRings(q)
      const d =
        [r.outline, ...r.holes]
          .map((ring) => "M" + ring.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L") + "Z")
          .join("") || ""
      bit.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="1" fill-rule="evenodd"/>`)
    }
    bit.push(`</g>`)
    y += ark.h + 60
  })
  bit.push("</svg>")
  writeFileSync(svgUt, bit.join("\n"))
  console.log(`  arket skrive til ${svgUt}`)
}
