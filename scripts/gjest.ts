/**
 * GJEST: ei GLB inn, ei kuttliste ut.
 *
 * Heile vegen i eitt steg — les fila, pass forma inn i kuben, snitt henne
 * i to ribbefamiliar, skjer ledda, pakk delane på plate og skriv arket.
 * Same pakkaren, same luftkravet og same teikninga som motorane i
 * sandkassen brukar; det einaste som er nytt er kvar profilen kjem frå.
 *
 * Kjeda sjølv bur i `lib/gjest/` og er delt med sida i appen. Dette
 * skriptet er berre eit skal kring henne — det er med vilje: eit tal på
 * kommandolina skal vera det same talet som står på skjermen.
 *
 *   npx tsx scripts/gjest.ts <fil.glb> [ut.svg]
 *   npx tsx scripts/gjest.ts stol.glb ark.svg --ribber 11x11 --tjukn 12
 */
import { readFileSync, writeFileSync } from "node:fs"
import { iKuben, lesGlb } from "../lib/gjest/glb.ts"
import { byggVev, STANDARD, type GjestVal } from "../lib/gjest/vev.ts"
import { kutt, kuttDxf, kuttSvg, kryssarSegSjolv } from "../lib/gjest/kutt.ts"

const args = process.argv.slice(2)
const fil = args.find((a) => !a.startsWith("--") && a.endsWith(".glb"))
const svgUt = args.find((a) => !a.startsWith("--") && a.endsWith(".svg"))
const dxfUt = args.find((a) => !a.startsWith("--") && a.endsWith(".dxf"))
if (!fil) {
  console.log("bruk: npx tsx scripts/gjest.ts <fil.glb> [ut.svg] [ut.dxf] [--ribber 9x9] [--tjukn 9]")
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

const raud = (s: string) => `\x1b[31m${s}\x1b[0m`
const gul = (s: string) => `\x1b[33m${s}\x1b[0m`
const gron = (s: string) => `\x1b[32m${s}\x1b[0m`

console.log(fil)
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
    gul(
      `  ${vev.opne} opne kjeder — mesh-en er ikkje lukka der, og dei vart ` +
        `lukka med ei rett line`,
    ),
  )
}
if (vev.lause) {
  console.log(
    raud(`  ${vev.lause} ribber har ikkje eit einaste ledd — dei heng ikkje saman med noko`),
  )
}
const sjolv = vev.ribber.filter((r) => kryssarSegSjolv(r.outline))
console.log(
  sjolv.length
    ? raud(`  ${sjolv.length} ribber har ein kontur som kryssar seg sjølv — sporskjeringa er broten`)
    : gron(`  alle ${vev.ribber.length} konturane er enkle`),
)

const k = kutt(vev)
console.log(
  `  ${k.ark} plate(r) · plateutnytting ${(k.util * 100).toFixed(1)} % · ` +
    `netto ${(k.netto / 1e6).toFixed(2)} m² finér`,
)

if (svgUt) {
  writeFileSync(svgUt, kuttSvg(k))
  console.log(`  kuttarket skrive til ${svgUt}`)
}
if (dxfUt) {
  writeFileSync(dxfUt, kuttDxf(k, val.t))
  console.log(`  DXF-en skriven til ${dxfUt}`)
}
