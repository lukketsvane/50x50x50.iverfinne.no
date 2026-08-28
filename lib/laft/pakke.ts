/**
 * PAKKEN.
 *
 * Eit flatpakka møbel har TO former, ikkje éi. Den eine er stolen. Den
 * andre er brettet han kjem som — og i referansane er det brettet eit
 * designa objekt: alle delane nesta inne i eitt rektangel med runda
 * hjørne, og bereholet i ryggen ligg øvst, so ein ber pakken etter det
 * same hòlet ein seinare ber stolen etter.
 *
 * Kuttarket seier kor mange plater jobben krev. Pakken seier noko anna:
 * kor STOR ein bunt dette vert, kor mykje av brettet som er stol og kor
 * mykje som er luft, og om ein kan bera det med éi hand. Det er det
 * talet ein oppgjev når nokon spør kva ein flatpakka stol ER.
 *
 * Han vert funnen ved søk: pakkaren i lib/nestraster.ts kan svare på om
 * eit gjeve rektangel tek alle delane, og då er resten binærsøk på
 * arealet. Sideforholdet er STÅANDE, av di ein pakke vert boren ståande
 * — og det er ikkje langt frå eitt: eit brett som er tre gonger så høgt
 * som det er breidt er ikkje ein pakke, det er ei planke.
 */
import { nestRaster, placedRings, type Nesting } from "../nestraster"
import type { Part } from "./parts"

export type Pakke = {
  /** brettet sine mål, mm */
  w: number
  h: number
  /** nestinga, klar til teikning */
  ns: Nesting<Part>
  /** kor mykje av brettet som er del og ikkje luft */
  util: number
  /** samla delareal, mm² */
  areal: number
}

const GAP = 6

/**
 * EITT gir, og det er eit VAL.
 *
 * Det var to ei stund: eit grovt til måltavla og eit fint til eksporten.
 * Det gav to ulike svar på same spørsmål — talet ved sida av biletet
 * skildra eit anna brett enn det biletet synte, opp mot ein fjerdedel i
 * areal. Ei tavle som ikkje skildrar biletet ved sida av seg er verre enn
 * ei grov tavle.
 *
 * Difor eitt søk, brukt av begge: celle på åtte millimeter, eitt
 * sideforhold og fire halveringar. Brettet vert nokre prosent større enn
 * det aller minste som finst — og det er eit ærleg svar, for det er
 * brettet pakkaren FANN. Så vert delane pakka ein siste gong TETT inne i
 * det brettet, so biletet syner dei så samla som dei kan liggje.
 *
 * Sideforholdet er fast med vilje. Ein pakke som skifter proporsjon frå
 * skyv til skyv er ikkje eit produkt, det er eit søkeresultat.
 */
const CELLE = 8
const RUNDER = 4
const FORHOLD = 1.1

/** tek dette brettet alle delane, på EITT ark? */
function held(parts: Part[], w: number, h: number, tett: boolean): Nesting<Part> | null {
  const ns = nestRaster(parts, { sheetW: w, sheetH: h, gap: GAP, cell: CELLE, tett })
  return ns.sheets.length === 1 && ns.sheets[0].placed.length === parts.length ? ns : null
}

/**
 * Minste brett som tek alle delane. Sideforholdet er gjeve (breidd delt
 * på høgd); arealet vert søkt. Ei øvre grense må finnast fyrst — ein
 * binærsøk utan tak er ein uendeleg lykkje — og delen som er størst set
 * botnen: brettet kan aldri vera mindre enn han.
 */
/**
 * Tavla, reglane og kortet spør om det same brettet rett etter
 * kvarandre, og søket er det dyraste i heile motoren. Difor eitt steg
 * minne: same delane, same svaret. Nøkkelen er delane sine areal og
 * ikkje parametrane, av di det er delane pakkaren ser.
 */
let siste: { nokkel: string; k: Pakke } | null = null

export function pakke(parts: Part[]): Pakke {
  const nokkel = parts.map((d) => d.id + d.area.toFixed(0)).join("|")
  if (siste && siste.nokkel === nokkel) return siste.k
  let areal = 0
  let breiast = 0
  for (const d of parts) {
    areal += d.area
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const q of d.outline) {
      if (q[0] < x0) x0 = q[0]
      if (q[0] > x1) x1 = q[0]
      if (q[1] < y0) y0 = q[1]
      if (q[1] > y1) y1 = q[1]
    }
    breiast = Math.max(breiast, Math.min(x1 - x0, y1 - y0) + 2 * GAP)
  }

  const maal = (k: number) => {
    const A = areal * k
    const w = Math.sqrt(A * FORHOLD)
    return { w, h: A / w }
  }
  // finn eit tak: doble til det held. Ein binærsøk utan tak er ei
  // uendeleg lykkje, og delen som er størst set botnen — brettet kan
  // aldri vera smalare enn han.
  let hi = 1.25
  let funne = false
  for (let i = 0; i < 9; i++) {
    const { w, h } = maal(hi)
    if (Math.min(w, h) >= breiast && held(parts, w, h, false)) { funne = true; break }
    hi *= 1.22
  }
  if (!funne) {
    const w = Math.sqrt(areal * 2 * FORHOLD)
    const h = (areal * 2) / w
    return { w, h, ns: nestRaster(parts, { sheetW: w, sheetH: h, gap: GAP, cell: CELLE }), util: 0, areal }
  }
  let lo = 1.0
  for (let i = 0; i < RUNDER; i++) {
    const mid = (lo + hi) / 2
    const { w, h } = maal(mid)
    if (Math.min(w, h) >= breiast && held(parts, w, h, false)) hi = mid
    else lo = mid
  }
  const { w, h } = maal(hi)
  // Siste pakkinga er TETT. Brettet er alt funne, so dette flytter ikkje
  // eit einaste mål — det samlar berre delane inne i det, so biletet
  // syner ein bunt og ikkje eit sprei. Held ikkje den tette pakkinga
  // (rasteret kan i sjeldne høve pakke dårlegare tett enn laust), vinn
  // den lause: eit brett med alle delane slår eit penare med færre.
  const ns = held(parts, w, h, true) ?? held(parts, w, h, false)!
  const k: Pakke = { w, h, ns, util: areal / (w * h), areal }
  siste = { nokkel, k }
  return k
}

/**
 * HANKEN I PAKKEN.
 *
 * Brettet er ein ting ein ber, og då må det ha noko å bera i. Referansane
 * legg bereholet i ryggen øvst i pakken, so ein ber pakken etter det
 * same hòlet ein seinare ber stolen etter; det krev at pakkaren veit kva
 * ein rygg er, og det gjer han ikkje. I staden får brettet sitt EIGE hòl,
 * skore i avkappet: eit stykke ledig plate øvst som er stort nok til ei
 * hand. Det kostar ingen ting — plata der er skrot same kva — og det gjer
 * pakken til eit objekt i staden for eit ark.
 *
 * Finst det ikkje eit slikt stykke, får pakken ikkje hank, og måltavla
 * seier frå. Det er eit ærleg svar: nokre pakkingar er så tette at det
 * ikkje er skrot att å bera i.
 */
export type Hank = { cx: number; cy: number; len: number; hogd: number }

export function hank(k: Pakke, len = 110, hogd = 32): Hank | null {
  const { ns, w, h } = k
  if (!ns.sheets[0]) return null
  // opptekne firkantar, grovt: kvar del sitt omskrivne rektangel
  const opptekne: [number, number, number, number][] = []
  for (const q of ns.sheets[0].placed) {
    const r = placedRings(q)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const p of r.outline) {
      if (p[0] < x0) x0 = p[0]
      if (p[0] > x1) x1 = p[0]
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
    opptekne.push([x0, y0, x1, y1])
  }
  const fritt = (cx: number, cy: number) => {
    const a = cx - len / 2 - 14
    const b = cy - hogd / 2 - 14
    const c = cx + len / 2 + 14
    const d = cy + hogd / 2 + 14
    if (a < 8 || b < 8 || c > w - 8 || d > h - 8) return false
    return !opptekne.some(([x0, y0, x1, y1]) => a < x1 && c > x0 && b < y1 && d > y0)
  }
  // øvst og på midten fyrst: der ein faktisk ville teke tak
  for (let cy = h - 30; cy > h * 0.5; cy -= 8) {
    for (let d = 0; d <= w / 2; d += 10) {
      for (const cx of d === 0 ? [w / 2] : [w / 2 - d, w / 2 + d]) {
        if (fritt(cx, cy)) return { cx, cy, len, hogd }
      }
    }
  }
  return null
}

/**
 * Pakken som teikning. Brettet med runda hjørne, hanken, og kvar del der
 * ho ligg. Målestokken er millimeter, som i alle dei andre arka her, so
 * eit uttak kan målast rett av fila.
 */
export function pakkeSvg(k: Pakke, h: Hank | null): string {
  const { w, h: H, ns } = k
  const r = Math.min(w, H) * 0.055
  const ut: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${w.toFixed(1)} ${H.toFixed(1)}">`,
    `<rect x="0.6" y="0.6" width="${(w - 1.2).toFixed(1)}" height="${(H - 1.2).toFixed(1)}" rx="${r.toFixed(1)}" fill="#ffffff" stroke="#111" stroke-width="1.2"/>`,
  ]
  if (h) {
    const y = H - h.cy
    ut.push(
      `<rect x="${(h.cx - h.len / 2).toFixed(1)}" y="${(y - h.hogd / 2).toFixed(1)}" width="${h.len.toFixed(1)}" height="${h.hogd.toFixed(1)}" rx="${(h.hogd / 2).toFixed(1)}" fill="none" stroke="#111" stroke-width="1.2"/>`,
    )
  }
  for (const q of ns.sheets[0]?.placed ?? []) {
    const rings = placedRings(q)
    for (const [ring, brei] of [[rings.outline, 0.9] as const, ...rings.holes.map((x) => [x, 0.55] as const)]) {
      const d = ring.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${(H - p[1]).toFixed(2)}`).join(" ") + "Z"
      ut.push(`<path d="${d}" fill="${brei > 0.7 ? "#f2f2f2" : "#ffffff"}" stroke="#111" stroke-width="${brei}"/>`)
    }
  }
  ut.push(`</svg>`)
  return ut.join("\n")
}
