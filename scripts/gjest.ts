/**
 * GJEST: ei fil inn, ei kuttliste ut.
 *
 * Heile vegen i eitt steg — les fila, rett vendinga, pass forma inn i
 * kuben, les ribbene ut av eit strålefelt, skjer ledda, pakk stykka på
 * plate og skriv arket. Same pakkaren, same luftkravet og same teikninga
 * som motorane i sandkassen brukar; det einaste som er nytt er kvar
 * profilen kjem frå.
 *
 * Kjeda sjølv bur i `lib/gjest/` og er delt med sida i appen. Dette
 * skriptet er berre eit skal kring henne — det er med vilje: eit tal på
 * kommandolina skal vera det same talet som står på skjermen.
 *
 *   npx tsx scripts/gjest.ts <fil> [ut.svg]
 *   npx tsx scripts/gjest.ts stol.glb ark.svg --ribber 11x11 --tjukn 12
 */
import { readFileSync, writeFileSync } from "node:fs"
import { FORMAT, iKuben, opneKantar, parseMesh, rettVend } from "../lib/gjest/glb.ts"
import { makeSolid } from "../lib/gjest/solid.ts"
import { byggVev, STANDARD, type GjestVal } from "../lib/gjest/ribber.ts"
import { kutt, kuttDxf, kuttSvg, kryssarSegSjolv } from "../lib/gjest/kutt.ts"

const args = process.argv.slice(2)
const inn = args.filter((a) => !a.startsWith("--"))
const svgUt = inn.find((a) => a.endsWith(".svg"))
const dxfUt = inn.find((a) => a.endsWith(".dxf"))
const fil = inn.find((a) => FORMAT.some((e) => a.toLowerCase().endsWith(e)))
if (!fil) {
  console.log(
    `bruk: npx tsx scripts/gjest.ts <fil> [ut.svg] [ut.dxf] [--ribber 9x9] [--tjukn 9]\n` +
      `      [--maal 470] [--detalj 150] [--glatt 0.25] [--behald-lause]\n` +
      `      format: ${FORMAT.join(" ")}`,
  )
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
const de = Number(flagg("detalj"))
if (de > 0) val.detalj = de
const gl = Number(flagg("glatt"))
if (gl > 0) val.glatt = gl
if (args.includes("--behald-lause")) val.kastLause = false

const raud = (s: string) => `\x1b[31m${s}\x1b[0m`
const gul = (s: string) => `\x1b[33m${s}\x1b[0m`
const gron = (s: string) => `\x1b[32m${s}\x1b[0m`

const t0 = performance.now()
const raa = parseMesh(fil, readFileSync(fil).buffer as ArrayBuffer)
const kantar = opneKantar(raa)
const { soup: vend, snudd } = rettVend(raa)
const sol = makeSolid(iKuben(vend, val.maal))
const tLes = performance.now() - t0

const t1 = performance.now()
const vev = byggVev(sol, val)
const tVev = performance.now() - t1

console.log(fil)
console.log(
  `  ${raa.tris} trekantar · lesne på ${tLes.toFixed(0)} ms` +
    (kantar ? gul(` · ${kantar} opne kantar — flata er ikkje lukka`) : " · lukka flate"),
)
if (snudd) {
  console.log(
    gul(`  nettet var UT-INN og vart snudd — utan det hadde alt vore luft`),
  )
}
console.log(
  `  ytre mål ${vev.boks.map((v) => v.toFixed(0)).join(" × ")} mm ` +
    `(passa inn til ${val.maal} mm)`,
)

const stykke = vev.ribber.flatMap((r) => r.stykke)
const delte = vev.ribber.filter((r) => r.stykke.length > 1).length
const hol = stykke.reduce((a, s) => a + s.holes.length, 0)
console.log(
  `  ${vev.ribber.length} ribber (${val.nX} × ${val.nY}) · ${stykke.length} stykke` +
    (delte ? ` (${delte} delte ribber)` : "") +
    (hol ? ` · ${hol} hòl` : "") +
    ` · ${vev.ledd} ledd · felt på ${tVev.toFixed(0)} ms`,
)

// Smalaste godset gjennom eit spor er talet som avgjer om ei ribbe knekk
// når nokon tek i — ikkje høgda hennar og ikkje breidda.
const medSpor = vev.ribber.filter((r) => r.spor.length)
if (medSpor.length) {
  const smalast = Math.min(...medSpor.map((r) => r.smalast))
  console.log(
    `  smalaste godset gjennom eit spor: ${smalast.toFixed(1)} mm` +
      (smalast < val.t * 2 ? gul(" — tynt, ribba kan knekke der") : ""),
  )
}

if (vev.kasta) {
  console.log(
    gul(
      `  ${vev.kasta} stykke kasta — dei hang ikkje i eit einaste ledd ` +
        `(--behald-lause tek dei med)`,
    ),
  )
}
if (vev.lause) {
  console.log(
    raud(`  ${vev.lause} stykke er med UTAN eit einaste ledd — dei heng ikkje saman med noko`),
  )
}
const sjolv = stykke.filter((s) => kryssarSegSjolv(s.outline))
console.log(
  sjolv.length
    ? raud(`  ${sjolv.length} stykke har ein kontur som kryssar seg sjølv`)
    : gron(`  alle ${stykke.length} konturane er enkle`),
)

const k = kutt(vev)
console.log(
  `  ${k.ark} plate(r) · plateutnytting ${(k.util * 100).toFixed(1)} % · ` +
    `netto ${(k.netto / 1e6).toFixed(2)} m² finér · ` +
    `kuttlengd ${(vev.ribber.reduce((a, r) => a + r.kuttLengd, 0) / 1000).toFixed(1)} m`,
)

if (svgUt) {
  writeFileSync(svgUt, kuttSvg(k))
  console.log(`  kuttarket skrive til ${svgUt}`)
}
if (dxfUt) {
  writeFileSync(dxfUt, kuttDxf(k, val.t))
  console.log(`  DXF-en skriven til ${dxfUt}`)
}
