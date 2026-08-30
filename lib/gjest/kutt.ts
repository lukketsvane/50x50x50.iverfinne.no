/**
 * GJEST — frå vev til kuttfil.
 *
 * Steget som gjer ribbene til noko ein kan sende til ei maskin. Det er
 * med vilje TYNT: pakkinga er `nestRaster`, kuttarket er `alleArkSvg` og
 * DXF-en er `partsToDxf` — dei same tre rutinene motorane i sandkassen
 * brukar. Ein importert mesh skal ikkje få si eiga kuttfil-verd; han skal
 * inn i den som finst, slik at ei betring i pakkaren kjem han til gode
 * utan at nokon hugsar på det.
 *
 * Fila finst likevel, og grunnen er at BÅDE kommandolina og sida i appen
 * treng nøyaktig same kjeda. Låg ho to stader, ville dei drive frå
 * kvarandre, og det talet brukaren ser på skjermen ville ikkje vera det
 * same som det i fila han lastar ned.
 */
import { nestRaster, type NestDel, type NestVal, type Nesting } from "../nestraster"
import { alleArkSvg } from "../vaffel/export-svg"
import { partsToDxf } from "../vaffel/export-dxf"
import type { Vev } from "./vev"

/** standardplata, same som i VAFFEL */
export const ARK_W = 2440
export const ARK_H = 1220

export type Kutt = {
  delar: NestDel[]
  pakking: Nesting<NestDel>
  /** netto delareal, mm² */
  netto: number
  /** medgått plateareal — den stripa som faktisk går gjennom maskina, mm² */
  medgaatt: number
  util: number
  ark: number
}

/**
 * Delane, pakka. `tett` er standard her og ikkje i den levande målinga:
 * ein import er ein éin-gongs-operasjon, og då er det rett å leite.
 */
export function kutt(vev: Vev, val?: Partial<NestVal>): Kutt {
  const delar: NestDel[] = vev.ribber.map((r, i) => ({
    // id-en er BÅDE namnet på arket og nøkkelen pakkaren deler masker på.
    // Difor aksen og nummeret og ikkje ein løpande teljar: to like ribber
    // i same familien får då same maska, og pakkaren slepp å byggje henne
    // to gonger.
    id: `${r.akse === 0 ? "X" : "Y"}${i + 1}`,
    outline: r.outline,
    holes: r.holes,
    area: r.area,
  }))
  const pakking = nestRaster(delar, {
    sheetW: ARK_W,
    sheetH: ARK_H,
    gap: 8,
    cell: 4,
    tett: true,
    ...val,
  })
  const netto = delar.reduce((s, d) => s + d.area, 0)
  const medgaatt = pakking.sheets.reduce((s, a) => s + a.used * a.w, 0)
  return { delar, pakking, netto, medgaatt, util: pakking.util, ark: pakking.sheets.length }
}

/** kuttarket som SVG — same teikninga motorane gjev */
export const kuttSvg = (k: Kutt) => alleArkSvg(k.pakking)

/** kuttfila som DXF, med fresekompensasjon som i motorane */
export const kuttDxf = (k: Kutt, tjukn: number) => partsToDxf(k.pakking, tjukn)

/**
 * Kryssar konturen seg sjølv?
 *
 * Sporskjeringa er den einaste staden i kjeda som kan lage ein slik
 * kontur, og han er ikkje ein del: han er ei kuttbane som skjer gjennom
 * sitt eige gods. Han ville dessutan pakka FINT — arealet vert rekna som
 * om han var enkel — so feilen les som ein billeg del heilt til nokon
 * kuttar plata.
 *
 * Testen er på AVSTAND og ikkje på kryssprodukt. Eit kryssprodukt er eit
 * areal, so han vert null når eit punkt tilfeldigvis ligg på den
 * uendelege lina gjennom eit segment langt vekke — og ein rotasjonsflate
 * gjev slike samanfall heile tida. Delt på segmentlengda er talet ein
 * avstand i millimeter, og då tyder terskelen noko.
 */
export function kryssarSegSjolv(ring: readonly (readonly [number, number])[]): boolean {
  const n = ring.length
  const EPS = 1e-6
  const kr = (
    p: readonly [number, number],
    q: readonly [number, number],
    r: readonly [number, number],
  ) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const motsett = (u: number, v: number) => (u > EPS && v < -EPS) || (u < -EPS && v > EPS)
  for (let i = 0; i < n; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % n]
    const lab = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // naboar over skøyten
      const c = ring[j]
      const d = ring[(j + 1) % n]
      const lcd = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1
      if (
        motsett(kr(c, d, a) / lcd, kr(c, d, b) / lcd) &&
        motsett(kr(a, b, c) / lab, kr(a, b, d) / lab)
      ) {
        return true
      }
    }
  }
  return false
}
