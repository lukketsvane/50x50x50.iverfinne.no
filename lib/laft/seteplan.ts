/**
 * SETEPLANET, og kvar ryggen får stå i det.
 *
 * Denne fila er skild ut frå profil.ts av éin grunn: BÅDE geometrien og
 * reparasjonen i params.ts må kunne rekne det same. `fiks()` klipper
 * parametrar til noko som kan byggjast, og gjer ho det på ei anna likning
 * enn den som byggjer, reparerer ho mot ein stol som ikkje finst. Det var
 * nettopp det som hende då ryggen vart løyst mot setekanten: fiks trudde
 * framleis ryggen stod på bakkanten, og lét tunga renne tom.
 *
 * Éi likning, éin stad.
 */
import type { Pt } from "../core"
import type { Params } from "./params"

/**
 * Superellipsen gjev hjørna: eksponenten to er ellipsen, tolv er
 * rektangelet, og alt imellom er dei runda hjørna. Kilen gjer framkanten
 * breiare enn bakkanten. Nasen skyv framkanten fram på midten, og BUKTA
 * skyv bakkanten fram — det er halvmånen, og det er den einaste
 * skilnaden mellom eit skjold og ein sigd.
 *
 * Kurva vert gått gjennom på TVERS og ikkje kring ein vinkel. Ein
 * vinkelsveip hoppar over bakkanten når eksponenten er høg: der er kurva
 * nesten loddrett i y, og to steg i vinkel kan vera eit halvt sete. Då
 * vert bukta ein spiss i staden for ein boge.
 */
export function setePlan(p: Params, N = 132): Pt[] {
  const A = p.djup / 2
  const B = p.breidd / 2
  const n = 2 + 10 * (1 - p.hjorne) ** 2
  const pkt = (s: number, fram: boolean): Pt => {
    const yn = Math.sin((Math.PI * s) / 2)
    const x0 = (fram ? A : -A) * Math.max(0, 1 - Math.abs(yn) ** n) ** (1 / n)
    const q = x0 / A
    const kile = 1 + p.setekile * q
    const y = B * yn * kile
    const midt = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, Math.abs(yn))))
    const x = x0 + p.nase * Math.max(0, q) * midt + p.bakbukt * Math.max(0, -q) * midt
    return [x, y]
  }
  const ut: Pt[] = []
  for (let i = 0; i <= N; i++) ut.push(pkt(-1 + (2 * i) / N, true))
  for (let i = 1; i < N; i++) ut.push(pkt(1 - (2 * i) / N, false))
  return ut
}


/**
 * Setet si halve breidd ved ein x i setet sitt eige plan — men berre det
 * SAMANHENGANDE godset kring midtlina. Ytterkanten åleine ville lyge på
 * ein sigd: der ligg dei to hornene langt bak, med bukta tom imellom, og
 * ein rygg sett etter ytterkanten hamnar i lufta mellom dei.
 */
export function halvBreidd(planet: Pt[], x: number): number {
  const kryss: number[] = []
  for (let i = 0, j = planet.length - 1; i < planet.length; j = i++) {
    const [xi, yi] = planet[i]
    const [xj, yj] = planet[j]
    if (xi > x === xj > x) continue
    kryss.push(yi + ((x - xi) / (xj - xi)) * (yj - yi))
  }
  kryss.sort((a, b) => a - b)
  for (let i = 0; i + 1 < kryss.length; i += 2) {
    if (kryss[i] <= 0 && kryss[i + 1] >= 0) return Math.min(-kryss[i], kryss[i + 1])
  }
  return 0
}

/** under dette er ryggen ikkje ein rygg — då er det billegare å flytte han */
const MINRYGG = 150

/**
 * KVAR RYGGEN FÅR STÅ, OG KOR BREI HAN FÅR VERA.
 *
 * Ryggen vil stå bakerst og vera så brei som skyvaren seier. Setet har
 * siste ordet på begge, og det er ikkje eit skjøn — det er ei måling.
 *
 * Bakkanten er nemleg ikkje eit TAL, han er ei KURVE, og han bøyer seg
 * framover ut mot sidene. Lese på midtlina gav eit ellipseforma sete ein
 * rygg som stod hundre millimeter bak sin eigen kant: sporet låg i lufta,
 * trekantnettet teikna det utan å klage, og biletet vart ein stol med ein
 * rygg som ikkje er festa i noko. `scripts/laft-gods.ts` måler det no —
 * 55 prosent av sporet låg utanfor plata.
 *
 * Difor vert BEGGE løyste. Stillinga går så langt bak som setet ber ein
 * rygg det er råd å sitja mot; breidda vert det setet faktisk gjev der,
 * aldri meir enn ynsket. Same språket som tunga: skyvaren er eit ynske,
 * geometrien har siste ordet, og tavla melder kva det vart.
 */
export function ryggPlass(p: Params, planet = setePlan(p)): { xRygg: number; ryggB: number } {
  const t = p.plyT
  const ca = Math.cos((p.setevipp * Math.PI) / 180)
  const rv = (p.ryggV * Math.PI) / 180
  /**
   * Gods ved SIDA av sporet, so enden ikkje flisar ut i kanten. Fresen
   * legg ei avlasting i kvart hjørne som stikk ut om lag 0,84 · diameteren
   * forbi sporet sjølv, og den skal òg ha materiale kring seg — elles er
   * det avlastinga og ikkje sporet som bryt kanten.
   */
  const sideGods = t + 10 + p.fresD
  /**
   * Sporet er ikkje ei LINE, det er eit rektangel: plata er tjukk, og ho
   * lener seg, so skuggen hennar gjennom setet rekk eit stykke bak
   * midtlina si. Prøvestaden ligg difor eit heilt gods BAK bakkanten av
   * sporet. Då er spørsmålet ikkje «finst det materiale der sporet er»,
   * som ein sigd kan svare ja på med fem millimeter att, men «finst det
   * materiale rundt heile sporet» — og det er det som ber.
   */
  const prov = (x: number) => x - (t / (2 * Math.cos(rv)) + 6) - sideGods
  let xTupp = Infinity
  for (const [x] of planet) if (x < xTupp) xTupp = x
  const treng = Math.min(p.ryggT, MINRYGG) / 2 + sideGods
  let x = xTupp + (t + 26) / ca
  while (x < 0 && halvBreidd(planet, prov(x)) < treng) x += 2
  return {
    xRygg: x * ca,
    ryggB: Math.min(p.ryggT, Math.max(0, 2 * (halvBreidd(planet, prov(x)) - sideGods))),
  }
}
