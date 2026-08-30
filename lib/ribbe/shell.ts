/**
 * RIBBE — skalet.
 *
 * Objektet er ikkje ei teikning av tjueto blad. Det er eit skal — ein
 * superellipse i planet, dratt oppover med ein midjefunksjon — og blada er
 * meridianar i det skalet. Difor står forma i denne fila og ingen annan:
 * blad, band, sete, kuttark og berekning les herifrå, og eit tal på arket
 * er alltid det same talet som teikninga.
 *
 *   θ  vinkel kring aksen, verdsfast (0 = +X = framover)
 *   z  høgd i millimeter over golvet
 *   u  z normalisert mot toppen av blada, [0,1]
 *   r  radius frå aksen; RIBBE har inga ryggrad, aksen står i origo
 *
 * Navet er den eine grensa som ikkje er ein smak. Tjueto blad på 15 mm
 * treng 22·15/2π = 52,5 mm radius berre for å stå ved sida av kvarandre;
 * den indre kanten vert klemd mot det talet og ikkje mot ein ynskjeverdi.
 */
import { CUBE, keep, smooth, superR } from "../core"
import type { Params } from "./params"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

export type Shell = {
  p: Params
  /** plan-skala etter innpassinga i kuben, mm */
  R: number
  /** toppen av blada — undersida av setet, mm */
  zBlade: number
  /** toppen av objektet: setekanten, mm */
  zTop: number
  /** minste indre radius: n·t/2π pluss klaring, mm */
  rHub: number
  /** bladvinklane, radianar */
  angles: number[]
  /** bandhøgdene, mm */
  bandZ: number[]
  /** vridinga, radianar */
  tw: number

  /** normalisert høgd */
  uOf(z: number): number
  /** kva radien gjer på vegen opp, som del av R */
  rho(u: number): number
  /** ytre radius i skalet, mm */
  rOuter(th: number, z: number): number
  /**
   * Ytre radius for BLADET, mm. Bladet treng ikkje slutte der skalet gjer:
   * tuppen kan stikke fram forbi det, og då er silhuetten teikna av tjueto
   * frie tunger i staden for av éin jamn kontur. Nedst er tuppen null — der
   * er bladet ein fot som skal stå i skalet — og han veks mot toppen.
   */
  rBlade(th: number, z: number): number
  /** den indre kanten av bladet — ein eigen kurve, ikkje eit offset, mm */
  rInner(z: number): number
  /** ytre radius av eit band, mm */
  bandOuter(th: number, j: number): number
  /** indre radius av eit band, mm */
  bandInner(th: number, j: number): number
  /** setekanten sin radius før halvmånen, mm */
  seatOuter(th: number): number
  /** setekanten sin radius etter at halvmånen har bite, mm */
  seatEdge(th: number): number
  /** overflata i setet ved radius r, mm */
  seatSurf(th: number, r: number): number
}

const SKAL_HUGS = keep<Shell>(3)
export function makeShell(p: Params): Shell {
  return SKAL_HUGS(JSON.stringify(p), () => makeShellRaw(p))
}

function makeShellRaw(p: Params): Shell {
  const n = Math.max(3, Math.round(p.blades))
  const tw = p.twist * DEG
  const zBlade = Math.max(60, p.seatZ - p.seatT)
  const zTop = p.seatZ
  const uOf = (z: number) => z / zBlade

  // Navet er ei hard grense og ikkje ein parameter: blada kan ikkje møtast
  // i sentrum. Klaringa kjem i tillegg, ho er ikkje ein del av talet.
  const rHub = (n * p.bladeT) / TAU + p.hubGap

  /**
   * Silhuetten. Tre lag som gongar kvarandre, av di dei svarar på kvar sin
   * ting: kor vidt objektet opnar seg oppover, kor hardt det snører seg i
   * midja, og kor mykje det bular ut att under henne. Legg ein dei saman i
   * staden for å gonga dei, dreg fotsvulmen midja ut med seg.
   */
  const rho = (u0: number) => {
    const u = Math.min(1, Math.max(0, u0))
    const base = p.footR + (1 - p.footR) * smooth(Math.pow(u, p.taper))
    const d = (u - p.waistZ) / Math.max(p.waistW, 1e-6)
    const pinch = 1 - p.waist * Math.exp(-d * d)
    const below = Math.max(0, 1 - u / Math.max(p.waistZ, 1e-6))
    const swell = 1 + p.swell * below * below
    return base * pinch * swell
  }

  // Plan-skalaen vert sett av innpassinga under; boksen let resten av
  // fila lesa han som ein konstant.
  const box = { R: p.planR }

  // Flikane: eit kosinusledd oppå superellipsa gjev blome- og stjerneplan.
  // Med flik ≤ 0,22 held faktoren seg over 0,78 — konturen er alltid lukka
  // og positiv. Utan flikar er leddet nøyaktig éin og fell bort, og alt
  // nedstraums (blad, band, sete, kutt) les gOf og treng ikkje vita noko.
  const nFlik = Math.max(0, Math.round(p.flikar))
  const gOf = (th: number) =>
    superR(th, p.planN, p.planAsp) * (1 + p.flik * Math.cos(nFlik * th))
  const rOuter = (th: number, z: number) => box.R * gOf(th) * rho(uOf(z))

  // Tuppen veks frå ingenting i midja og opp: under 0,45 av bladhøgda er
  // han null, over den stig han jamt til full lengd øvst. Hjørneradien
  // rundar han av, so tunga endar i ein boge og ikkje i ein spiss.
  const tipOut = (z: number) =>
    p.bladTupp <= 0 ? 0 : p.bladTupp * smooth((uOf(z) - 0.45) / 0.55)
  const rBlade = (th: number, z: number) => rOuter(th, z) + tipOut(z)

  /**
   * Den indre kanten fylgjer ikkje den ytre. Han stig frå navet og legg
   * seg så på sin eigen radius, nesten ein sylinder — og det er difor
   * holrommet OPNAR seg der skalet snører seg inn: veven vert smal i midja
   * ikkje fordi den indre kanten gjer noko der, men fordi den ytre gjer
   * det. Var han eit offset av den ytre, ville holrommet vore ein kopi av
   * silhuetten, og då hadde ein sett rett gjennom objektet like lite
   * nedst som i midja.
   */
  const rInner = (z: number) => {
    const u = Math.min(1, Math.max(0, uOf(z)))
    // Opp frå navet til si eiga høgd, og så eit eige vedtak om kva han gjer
    // over henne: positiv `innerW` held fram å opna holrommet mot toppen —
    // ein kjegle av luft — negativ lukkar det att under setet.
    if (u <= p.innerZ) {
      return rHub + p.inner * box.R * smooth(u / Math.max(p.innerZ, 1e-6))
    }
    const t = smooth((u - p.innerZ) / Math.max(1 - p.innerZ, 1e-6))
    return rHub + p.inner * box.R * Math.max(0.05, 1 + p.innerW * t)
  }

  // Bandhøgdene. Med to band er det berre endane; med fleire ligg dei jamt
  // fordelte mellom dei, av di eit band som ligg tett inntil eit anna
  // hjelper korkje mot vriding eller mot lesinga.
  const m = Math.max(2, Math.round(p.bands))
  const bandZ: number[] = []
  for (let j = 0; j < m; j++) {
    const t = m === 1 ? 0.5 : j / (m - 1)
    bandZ.push((p.bandZ0 + (p.bandZ1 - p.bandZ0) * t) * zBlade)
  }

  const angles: number[] = []
  for (let k = 0; k < n; k++) angles.push((k / n) * TAU)

  // Bandet ligg UTANPÅ blada og stikk fram forbi dei. Det er difor bandet
  // og ikkje bladet som lagar silhuetten i si eiga høgd — ligg dei i flukt,
  // vert sporet i bladet ei sagtann heile vegen rundt.
  const bandOuter = (th: number, j: number) => rOuter(th, bandZ[j]) + p.bandOut
  // Bandbreidda kan vera større enn ringen sin eigen radius. Då er bandet
  // ikkje ein ring lenger — det er ei HYLLE, ei full plate med eit lite hol
  // i midten, og blada står i henne med same kryssholdte leddet som før.
  // Holet må stå att: ein plate utan hol er ein plate blada ikkje kjem
  // gjennom, og seks millimeter er det fresen treng for å byrje snittet.
  const bandInner = (th: number, j: number) => Math.max(6, bandOuter(th, j) - p.bandW)

  const seatOuter = (th: number) => rOuter(th, zBlade) + p.lip

  /**
   * Halvmånen er eit sirkelinnsnitt frå den sida `moneV` peikar ut — 180
   * grader er bakfrå, som før. Radien og djupna er målte mot setekanten i
   * biteretninga, slik at innsnittet held same proporsjon når kuben
   * klemmer objektet ned. Vinkelen vert rekna som avvik frå π, so
   * standardretninga står bit-identisk med det gamle uttrykket.
   */
  const moonGeom = () => {
    const da = (p.moneV - 180) * DEG
    const back = seatOuter(Math.PI + da)
    const depth = p.moon * back
    const rad = Math.max(1, p.moonR * back)
    // sentrum ligg så langt ute i biteretninga at sirkelen sin inste kant
    // bit `depth` inn i setekanten
    const dist = back - depth + rad
    return { cx: -dist * Math.cos(da), cy: -dist * Math.sin(da), dist, rad }
  }
  const moon = moonGeom()

  const seatEdge = (th: number) => {
    const ro = seatOuter(th)
    if (p.moon <= 0) return ro
    // avstanden ut til der strålen skjer halvmånesirkelen
    const b = Math.cos(th) * moon.cx + Math.sin(th) * moon.cy
    const disc = b * b - (moon.dist * moon.dist - moon.rad * moon.rad)
    if (disc <= 0) return ro
    // den NÆRASTE rota: materialet sluttar der strålen fyrst går inn i
    // halvmånen, ikkje der han kjem ut att på andre sida
    const s = b - Math.sqrt(disc)
    return s > 0 ? Math.min(ro, s) : ro
  }

  /** Skåla er målt mot kor breitt skalet er øvst og ikkje mot setekanten:
   *  overhenget skal lesast som ein flat kant, ikkje som meir skål. */
  const seatSurf = (th: number, r: number) => {
    const rt = Math.max(1, rOuter(th, zBlade))
    const q = Math.min(1, r / rt)
    return zTop - p.dish * (1 - q * q)
  }

  const sh: Shell = {
    p,
    get R() {
      return box.R
    },
    zBlade,
    zTop,
    rHub,
    angles,
    bandZ,
    tw,
    uOf,
    rho,
    rOuter,
    rBlade,
    rInner,
    bandOuter,
    bandInner,
    seatOuter,
    seatEdge,
    seatSurf,
  }

  fitToCube(sh, box, gOf)
  return sh
}

// =============================================================================
// INNPASSING I KUBEN
// =============================================================================
/**
 * Éin omgang held, og det er ikkje flaks.
 *
 * Omhyllinga til RIBBE er plankonturen sjølv: blada sine ytterkantar ligg
 * i skalet, banda er heile ringar utanpå det, og setet er den same
 * konturen pluss overhenget. Utan flikar har superellipsa ytterpunkta
 * sine på aksane — der er x = A og y = B, eksakt — og då er det einaste
 * som må leitast fram numerisk kvar silhuetten er vidast. Det er eitt tal
 * i éi variabel, og det vert halvert fram i BEGGE retningar kring det
 * grovaste sveipet: eit grovt rutenett bommar med over ti millimeter på
 * ein midje, og då er kubekontrollen ingen kontroll. MED flikar flytter
 * ytterpunkta seg av aksane, og snarvegen gjeld ikkje lenger: då vert
 * omhyllinga sveipt numerisk over konturen i staden.
 *
 * Alle tre familiane er affine i skalafaktoren — R·(omhylling·ρ) pluss
 * eit fast tillegg for band, overheng og halve bladtjukna — så faktoren
 * fell ut av ei deling og ikkje av ei iterasjon. Objektet vert berre
 * skalert NED: ber nokon om eit mindre objekt, er det eit val og ikkje
 * ein feil.
 */
function fitToCube(sh: Shell, box: { R: number }, gOf: (th: number) => number) {
  const p = sh.p
  const want = CUBE - 4

  // vidaste punktet i silhuetten: grovt sveip, så halvering i begge
  // retningar kring vinnaren
  const N = 96
  let uBest = 0
  let vBest = -Infinity
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const v = sh.rho(u)
    if (v > vBest) {
      vBest = v
      uBest = u
    }
  }
  let lo = Math.max(0, uBest - 1 / N)
  let hi = Math.min(1, uBest + 1 / N)
  for (let k = 0; k < 40; k++) {
    const a = lo + (hi - lo) / 3
    const b = hi - (hi - lo) / 3
    if (sh.rho(a) < sh.rho(b)) lo = a
    else hi = b
  }
  const rhoMax = Math.max(vBest, sh.rho((lo + hi) / 2))

  // omhyllinga i planet, per akse: utan flikar analytisk, med flikar sveipt
  let half: number
  if (p.flik > 0) {
    let eX = 0
    let eY = 0
    for (let i = 0; i < 256; i++) {
      const th = (i / 256) * Math.PI * 2
      const g = gOf(th)
      eX = Math.max(eX, g * Math.abs(Math.cos(th)))
      eY = Math.max(eY, g * Math.abs(Math.sin(th)))
    }
    half = Math.max(eX, eY)
  } else {
    const A = Math.exp(p.planAsp * 0.5)
    const B = Math.exp(-p.planAsp * 0.5)
    half = Math.max(A, B)
  }

  // kvar familie gjev eit tak på R: (halve kuben − det faste tillegget)
  // delt på det som er proporsjonalt
  const caps: number[] = []
  const capOf = (prop: number, add: number) =>
    prop > 1e-9 ? (want / 2 - add) / prop : Infinity
  // skalet, med halve bladtjukna som monn for at bladhjørna står på skrå
  caps.push(capOf(half * rhoMax, p.bladeT / 2))
  // bladtuppen står lengst ute der skalet er vidast OVER midja, og han er
  // eit fast tillegg i millimeter — difor i teljaren og ikkje i nemnaren
  if (p.bladTupp > 0) caps.push(capOf(half * sh.rho(1), p.bladeT / 2 + p.bladTupp))
  for (let j = 0; j < sh.bandZ.length; j++) {
    caps.push(capOf(half * sh.rho(sh.uOf(sh.bandZ[j])), p.bandOut))
  }
  caps.push(capOf(half * sh.rho(1), p.lip))

  const cap = Math.min(...caps)
  if (cap > 0 && cap < box.R) box.R = cap
}
