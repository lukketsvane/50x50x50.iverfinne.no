/**
 * GJEST — fila inn, og forma passa inn i kuben.
 *
 * Sjølve LESINGA bur ikkje her lenger. Ho ligg i `io/`, lånt uendra frå
 * slicerman (lukketsvane/slicer.iverfinne.no, MIT, same forfattar), og ho
 * les fem format i staden for eitt. Den handskrivne GLB-lesaren som stod
 * her las berre .glb, og han var den einaste i huset som ikkje hadde vore
 * prøvd mot filer frå ein skannar.
 *
 * Det som står att her er det sandkassen sitt: å gjere ei vilkårleg form
 * om til eit objekt i OPPGÅVA sitt koordinat. Det er to ting lesaren ikkje
 * kan vita noko om — kva veg som er opp, og kor stort det skal vera.
 */
import type { Vec3 } from "../core"
import {
  bounds,
  flip,
  makeSoup,
  openEdges,
  shade,
  signedVolume,
  weld,
  type Soup,
} from "./soup"

export type { Soup } from "./soup"
export { parseMesh, FORMAT } from "./io/index"

/**
 * Kor mange kantar i nettet som berre høyrer til éin trekant.
 *
 * Null tyder at flata er lukka. Alt over tyder at ho er open ein stad, og
 * DÅ er det verdt å seie frå FØR snittet: eit snitt gjennom eit ope skal
 * gjev kjeder som ikkje møtest, og dei vert lukka med ei rett line. Talet
 * her er ein eigenskap ved FILA; talet `Vev.opne` er kor mange gonger det
 * faktisk slo ut i eit snitt.
 */
export const opneKantar = (s: Soup) => openEdges(weld(s))

/**
 * Sveis nettet, og snu det om det er UT-INN.
 *
 * Dette steget fanst ikkje før, av di den gamle snittinga ikkje trong det:
 * ho las berre KANTEN — kvar trekant som kryssa planet gav eit linestykke —
 * og ein kant er den same kanten same kva veg trekanten vender.
 *
 * Strålen les noko anna: han les kva veg kvar trekant vender, og summerer
 * seg fram til kor mange skal han står inne i. Vender heile nettet feil
 * veg, er svaret hans at ALT er luft. Det er ikkje ei melding — det er
 * null ribber og ein tom skjerm, og ingenting som seier kvifor.
 *
 * Og det er ikkje eit sjeldsyn. Prøveskåla i denne repoen er ut-inn, i
 * alle fire formata: signert volum −1,46. Snudd gjev ho gods i 341 av 361
 * søyler; usnudd i null. Ei fil frå ein skannar, ein eksport gjennom feil
 * handhendte akse, ein modell spegla i staden for rotert — alle tre gjev
 * dette, og brukaren har ingen måte å sjå det på.
 *
 * Fortegnet på volumet seier kva veg det er. Det krev at nettet er
 * LUKKA — for eit ope skal er talet ikkje eit volum — men eit ope skal er
 * alt meldt, og for det er det ingen rett svar å finne.
 */
export function rettVend(s: Soup): { soup: Soup; snudd: boolean } {
  const w = weld(s)
  if (signedVolume(w) >= 0) return { soup: s, snudd: false }
  return { soup: makeSoup(shade(flip(w)).pos), snudd: true }
}

/**
 * Passar forma inn i oppgåva sin kube: sentrer i planet, set botnen på
 * golvet og skaler so det største målet er `maal` millimeter.
 *
 * VENDINGA STÅR IKKJE HER. Lesarane i `io/` snur alt frå Y-opp til Z-opp
 * sjølve, før soupen kjem ut. Denne funksjonen gjorde det ein gong til då
 * han vart kopla på dei, og då stod objektet på sida: den same skåla gav
 * 50 ledd i staden for 69, av di ribbeplana skar henne på tvers av det
 * dei skulle. To vendingar er ikkje ei vending til — dei er ei ANNA
 * vending, og feilen syner seg berre som eit tal som er litt for lågt.
 *
 * Berre NED i den tydinga at kuben er oppgåva: ber nokon om eit større
 * objekt, er det eit val, og skyvaren står der.
 */
export function iKuben(s: Soup, maal: number): Soup {
  const pos = new Float32Array(s.pos)
  const b = bounds(pos)
  const spenn: Vec3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
  const f = maal / Math.max(1e-6, Math.max(spenn[0], spenn[1], spenn[2]))
  const cx = (b.min[0] + b.max[0]) / 2
  const cy = (b.min[1] + b.max[1]) / 2
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - cx) * f
    pos[i + 1] = (pos[i + 1] - cy) * f
    pos[i + 2] = (pos[i + 2] - b.min[2]) * f
  }
  return makeSoup(pos)
}
