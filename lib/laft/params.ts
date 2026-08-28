/**
 * LAFT — parameterrommet.
 *
 * Eitt objekt er eitt punkt her inne. Ingen annan fil held tal: platene,
 * ledda, kuttarket og berekninga er alle funksjonar av `Params`.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader ut mot skyvaren og i radianar inne i motoren.
 *
 * TYPOLOGIEN er det motsette svaret av dei fire andre. Dei byggjer den
 * krumme flata av MANGE flate delar — ribber, skiver, finnar, blad. LAFT
 * byggjer henne ikkje i det heile: han seier at ei plate er ei plate, og
 * lagar sitjekomforten av VINKLAR i staden — setet vippa, lena i ryggen.
 * Prisen er ærleg (flata er flat), og vinsten er dei to tala ingen av dei
 * andre kan slå: FIRE delar og ein kile, og eit kuttark der store, enkle
 * former pakkar tett. Det er grensa i den eine enden av rommet, og eit
 * argument treng begge endane.
 *
 * OG SO ER DET KUBEN. Ein flatpakka stol av denne familien er kring 800
 * mm høg ute i verda; oppgåva her gjev femhundre, og sitjehøgda et fire
 * av dei. Difor er ryggen her ikkje ein rygg — han er ei LIST: høg nok
 * til å lene korsryggen mot, og med bereholet i seg, so det ein lener seg
 * mot er det same ein ber stolen etter. Det er ikkje ein amputert
 * referanse; det er kva referansen VERT når han må stå i ein halv meter,
 * og den omsetjinga er sjølve oppgåva.
 */
import {
  clampBag,
  MATERIALS,
  poseBag,
  randomBag,
  type Group,
  type Hovuddrag,
  type Material,
  type ParamBag,
  type Pose,
  type Range,
} from "../core"

/** Params må vera tildelbar til ParamBag, difor eit type-alias. */
export type Params = {
  // --- SETE: plata ein sit på -------------------------------------------
  hogd: number // setehøgd framme, mm
  djup: number // setedjupn, mm
  breidd: number // setebreidd, mm
  setevipp: number // vipp bakover kring framkanten, grader
  svai: number // kor mykje fram- og bakkanten bognar, del av djupna
  nase: number // hjørneradius på setet, mm

  // --- RYGG: plata ein lener seg mot ------------------------------------
  ryggH: number // lenehøgd over setet, mm
  ryggV: number // ryggen si lening bakover, grader
  ryggT: number // listebreidd øvst, mm
  ryggF: number // tungebreidd ved setet — skuldra som ber, mm
  ryggsvai: number // sidekantane: inn (−) eller ut (+), del av breidda
  grep: number // berehol: lengd, mm — under 60 finst det ikkje
  grepZ: number // berehol: senter under ryggtoppen, mm

  // --- BEIN: dei to sideramene ------------------------------------------
  spenn: number // senteravstand mellom bladene, mm
  framspark: number // framfoten forbi setekanten, mm
  bakspark: number // bakfoten bak setekanten, mm
  hals: number // halsen på bladet under setet, mm
  fotboge: number // bogen under bladet: del av bladhøgda, ikkje mm
  beinsvai: number // kor mykje beina smalnar på vegen ned, del

  // --- LEDD: det som held det saman -------------------------------------
  plyT: number // platetjukn, mm
  pressfit: number // sporet breiare enn plata, mm
  kileB: number // kilelengd langs draget, mm
  fresD: number // fresediameter — avlasting i indre hjørne, mm

  material: Material
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 372, max: 470, step: 1, label: "setehøgd", unit: "mm" },
  djup: { min: 300, max: 460, step: 1, label: "setedjupn", unit: "mm" },
  breidd: { min: 300, max: 470, step: 1, label: "setebreidd", unit: "mm" },
  setevipp: { min: 0, max: 14, step: 0.5, label: "setevipp", unit: "°" },
  svai: { min: 0, max: 0.14, step: 0.005, label: "kantsvai" },
  nase: { min: 8, max: 46, step: 1, label: "hjørneradius", unit: "mm" },

  // lista over setet: taket er kuben minus sitjehøgda, og då er dette
  // heile rommet som finst
  ryggH: { min: 30, max: 120, step: 1, label: "lenehøgd", unit: "mm" },
  ryggV: { min: 4, max: 30, step: 0.5, label: "rygglening", unit: "°" },
  ryggT: { min: 200, max: 450, step: 1, label: "listebreidd", unit: "mm" },
  ryggF: { min: 200, max: 450, step: 1, label: "tungebreidd", unit: "mm" },
  ryggsvai: { min: -0.18, max: 0.18, step: 0.005, label: "ryggsvai" },
  grep: { min: 0, max: 220, step: 1, label: "berehol", unit: "mm" },
  grepZ: { min: 26, max: 90, step: 1, label: "berehol, høgd", unit: "mm" },

  spenn: { min: 150, max: 390, step: 1, label: "beinspenn", unit: "mm" },
  framspark: { min: -30, max: 150, step: 1, label: "framspark", unit: "mm" },
  bakspark: { min: -30, max: 150, step: 1, label: "bakspark", unit: "mm" },
  hals: { min: 50, max: 190, step: 1, label: "hals", unit: "mm" },
  // Bogen er ein DEL av bladhøgda og ikkje eit millimetertal: eit blad
  // på 380 mm og eit på 250 skal ha same slanke beina, og då må bogen
  // fylgje høgda i staden for å stå fast.
  fotboge: { min: 0, max: 0.82, step: 0.01, label: "fotboge" },
  beinsvai: { min: 0, max: 0.6, step: 0.005, label: "beinsvai" },

  plyT: { min: 9, max: 24, step: 0.5, label: "platetjukn", unit: "mm" },
  pressfit: { min: 0, max: 0.6, step: 0.05, label: "sporklaring", unit: "mm" },
  kileB: { min: 44, max: 120, step: 1, label: "kilelengd", unit: "mm" },
  fresD: { min: 2, max: 10, step: 0.5, label: "fresediameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "sete", label: "sete", keys: ["hogd", "djup", "breidd", "setevipp", "svai", "nase"] },
  {
    id: "rygg",
    label: "rygg",
    keys: ["ryggH", "ryggV", "ryggT", "ryggF", "ryggsvai", "grep", "grepZ"],
  },
  {
    id: "bein",
    label: "bein",
    keys: ["spenn", "framspark", "bakspark", "hals", "fotboge", "beinsvai"],
  },
  { id: "ledd", label: "ledd", keys: ["plyT", "pressfit", "kileB", "fresD"] },
]

export const PARAM_KEYS: readonly string[] = GROUPS.flatMap((g) => [...g.keys])

/**
 * Standardobjektet. Tala er valde slik at objektet held kvar einaste
 * regel med mon, står på eitt ark, og les som det referansen les som:
 * ein høg, roleg rygg med berehol, eit vippa sete, og to bein som
 * sparkar fram og bak.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 400,
  djup: 368,
  breidd: 400,
  setevipp: 6,
  svai: 0.05,
  nase: 26,

  // 400 + 88 = 488: tolv under kubelokket, og det er med vilje. Lista er
  // høg nok til korsryggen og til ei hand gjennom bereholet, og ikkje ein
  // millimeter høgare. Sitjehøgda er MIDT på setet, ikkje framkanten —
  // vippen tek seksten millimeter, og NS-EN 1729 sin botn er 380.
  ryggH: 88,
  ryggV: 16,
  ryggT: 330,
  ryggF: 320,
  ryggsvai: 0.05,
  grep: 120,
  grepZ: 44,

  spenn: 250,
  framspark: 68,
  bakspark: 48,
  hals: 120,
  fotboge: 0.58,
  beinsvai: 0.28,

  plyT: 15,
  pressfit: 0.2,
  kileB: 78,
  fresD: 6,

  material: "bjork",
}

/**
 * Kuraterte posar. Rommet spenner frå den låge krakken utan rygg til den
 * høge lenestolen — og LAFT har berre fire plater å seie det med, so kvar
 * pose må endre PROPORSJON og ikkje pynt.
 */
export const POSES: readonly Partial<Params>[] = [
  // lenestolen: mest lena list, mest vippa sete, breiast plate — den ein
  // sit lengst i. Djupna er IKKJE størst: kuben tek henne, av di setet
  // og sparket deler dei same fem hundre millimetrane fram og attende.
  {
    hogd: 408, djup: 366, breidd: 431, setevipp: 10, ryggH: 112, ryggV: 26,
    ryggT: 360, ryggF: 339, framspark: 52, bakspark: 88, fotboge: 0.7,
    hals: 150, svai: 0, ryggsvai: 0.1, beinsvai: 0.3,
  },
  // pinnen: høgast sete, smalast plate, list utan hòl — arbeidsstolen
  // ved benken, der ein sit på kanten og reiser seg ofte
  {
    hogd: 462, djup: 330, breidd: 340, setevipp: 2, ryggH: 32, ryggV: 8,
    ryggT: 301, ryggF: 300, spenn: 236, framspark: 46, bakspark: 38,
    fotboge: 0.3, beinsvai: 0.4, grep: 0, nase: 16, svai: 0, ryggsvai: 0,
  },
  // benken: brei nok til to, med vidt beinspenn so setet ikkje bøyer seg
  // — og tjukkare plate, av di ein benk vert sparka
  {
    breidd: 470, djup: 356, spenn: 336, hogd: 402, setevipp: 4, ryggT: 430,
    ryggF: 400, ryggsvai: -0.1, grep: 170, framspark: 76, bakspark: 69,
    hals: 160, plyT: 18, svai: 0,
  },
  // spriket: beina sparkar langt fram og bladet er smalt i midja — mest
  // luft, minst plate, og den lettaste posen i motoren på 3,3 kg
  {
    framspark: 114, bakspark: 52, beinsvai: 0.6, fotboge: 0.6, hals: 76,
    hogd: 396, djup: 339, ryggH: 97, ryggV: 21, ryggsvai: 0.1, plyT: 12,
    breidd: 386, spenn: 230, ryggT: 301, ryggF: 299, svai: 0.1, grep: 121,
  },
  // tavla: rett list utan lening og eit langt berehol — den som står
  // stabla mot veggen og vert boren med éi hand
  {
    ryggV: 5, ryggH: 114, ryggT: 400, ryggF: 350, grep: 200, grepZ: 54,
    djup: 343, breidd: 420, spenn: 292, setevipp: 3, svai: 0, nase: 34,
    framspark: 60, bakspark: 54, fotboge: 0.4, ryggsvai: 0, beinsvai: 0.3,
  },
]

const POSE_NAMN: readonly string[] = ["lenestolen", "pinnen", "benken", "spriket", "tavla"]
export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag: bag as Pose["bag"],
}))

/** Hovuddraga: dei få kontrollane som verkeleg formar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "rygg", label: "rygg", keys: [["ryggH", 1]] },
  { id: "lening", label: "lening", keys: [["ryggV", 1], ["setevipp", 0.5]] },
  { id: "spenn", label: "beinspenn", keys: [["spenn", 1]] },
  { id: "spark", label: "spark", keys: [["framspark", 1], ["bakspark", 0.8]] },
  { id: "breidd", label: "breidd", keys: [["breidd", 1], ["ryggT", 0.6]] },
]

/** Kva to-fingers-rulling på lerretet skrur på. */
export const NUDGE_PARAMS = { vertical: "ryggH", horizontal: "ryggV", pinch: "breidd" }

export const clampParams = (o: unknown, prev: Params): Params =>
  clampBag(o, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS) as unknown as Params

/** produksjonsval, ikkje form: tjukna og innpassinga vel ein etter plata
 *  og maskina ein faktisk har — terningen rører dei aldri */
const FREDA = ["plyT", "pressfit", "fresD"] as const

/**
 * TERNINGREPARASJONEN.
 *
 * Eit fritt kast bryt nesten alltid, av di krava her er SUMAR: høgda er
 * sete pluss rygg, breidda må rome beinspennet med gods att, og tunga må
 * vera brei nok til å bera dei to sporene bladene skjer i henne. Kvar
 * retting rører berre ULÅSTE band og held seg innanfor dei.
 */
/**
 * Rettingane heng saman: eit breiare spenn krev ei breiare tunge, ei
 * breiare tunge krev ei breiare list, og ei breiare list kan sprengje
 * kuben som steget over nett hadde ordna. Difor vert heile settet køyrt
 * til det står stille — tre rundar held alltid, og fleire ville berre
 * vera pynt.
 */
function fiks(q: Params, laast: ReadonlySet<string>): Params {
  for (let i = 0; i < 3; i++) eittPass(q, laast)
  return q
}

function eittPass(q: Params, laast: ReadonlySet<string>): Params {
  const R = PARAM_RANGES
  const set = (k: keyof Params, v: number) => {
    if (laast.has(k)) return
    const r = R[k]
    ;(q as Record<string, number | string>)[k] = Math.min(r.max, Math.max(r.min, +v.toFixed(3)))
  }
  // Dei same formlane som måltavla les — ei reparasjon som reknar
  // omtrentleg, reparerer omtrentleg, og då slår regelen ut likevel.
  const geo = () => {
    const a = (q.setevipp * Math.PI) / 180
    const rv = (q.ryggV * Math.PI) / 180
    const ca = Math.cos(a)
    const xF = (q.djup / 2) * ca
    const xR = -xF + q.djup * 0.1 * ca + q.plyT
    return {
      a, rv, ca, xF, xR,
      /** brukbar setedjupn: framkanten fram til lista */
      seatD: xF - xR,
      /** sitjehøgda: midt på den brukbare flata */
      sitZ: q.hogd - (xF - (xF + xR) / 2) * Math.tan(a),
      /** kor langt bak lista lener seg, målt frå midten */
      // Setet sjølv er med i rekninga: med negativt bakspark står føtene
      // INNANFOR bakkanten, og då er det plata som er ytterpunktet.
      bakUt: Math.max(xF, xF + q.bakspark, -xR + q.ryggH * Math.tan(rv)),
      /** framkanten BOGNAR utover: svaien legg seg utanpå plata */
      framUt: Math.max(xF + q.framspark, xF * (1 + q.svai)),
      /** lista bognar sidevegs, og kan verta breiare enn setet */
      listeUt: q.ryggT * (1 + Math.abs(q.ryggsvai)),
    }
  }

  // 1) kuben i høgda: setet og lista legg seg rett oppå kvarandre, og
  // `ryggH` er alt målt loddrett — ingen cosinus, berre ein sum
  const forHogt = q.hogd + q.ryggH - 488
  if (forHogt > 0) {
    // lista gjev fyrst: ho er det ein kan miste utan å miste stolen
    const gjev = Math.min(forHogt, q.ryggH - R.ryggH.min)
    set("ryggH", q.ryggH - gjev)
    if (forHogt - gjev > 0) set("hogd", q.hogd - (forHogt - gjev))
  }
  // 2) sitjehøgda vert målt MIDT på setet, og vippen dreg henne ned dit.
  // NS-EN 1729 sin botn er 380; framkanten må liggje over han.
  {
    const g = geo()
    if (g.sitZ < 384) set("hogd", q.hogd + (384 - g.sitZ))
    else if (g.sitZ > 496) set("hogd", q.hogd - (g.sitZ - 496))
  }
  // 3) brukbar djupn: plata er djupare enn setet, av di lista står i vegen
  {
    const g = geo()
    if (g.seatD < 268) set("djup", q.djup + (268 - g.seatD) / 0.89)
  }
  // 4) kuben i djupna, med lista si lening rekna med
  {
    const g = geo()
    const envX = g.framUt + g.bakUt
    if (envX > 488) {
      const kutt = envX - 488
      set("framspark", q.framspark - kutt / 2)
      set("bakspark", q.bakspark - kutt / 2)
    }
    // ... og lista skal ikkje vera breiare enn setet ho står i
    if (g.listeUt > q.breidd) set("ryggT", q.breidd / (1 + Math.abs(q.ryggsvai)))
  }
  // 5) VELTEVINKELEN er beinspennet sitt ansvar. Stolen vippar sidevegs
  // lenge før han vippar framover, av di føtene står smalare enn dei er
  // lange — so botnen for spennet er rett og slett kva femten grader
  // krev av arm ved denne setehøgda.
  {
    const g = geo()
    const arm = 0.29 * g.sitZ
    if (q.spenn / 2 + q.plyT / 2 < arm) set("spenn", 2 * arm - q.plyT)
  }
  // 6) bladene må stå INNE i setet med gods att kring tappesporet
  {
    const minBreidd = q.spenn + q.plyT + 42
    if (q.breidd < minBreidd) set("breidd", minBreidd)
    const maksSpenn = q.breidd - q.plyT - 42
    if (q.spenn > maksSpenn) set("spenn", maksSpenn)
  }
  // 7) sitjeflata må vera brei nok ETTER at hjørna er runda av
  if (q.breidd - 2 * q.nase < 306) set("nase", (q.breidd - 306) / 2)
  // 8) tunga må rome begge hakka med gods utanfor
  if (q.ryggF < q.spenn + 2 * q.plyT + 30) set("ryggF", q.spenn + 2 * q.plyT + 30)
  if (q.ryggT < q.ryggF * 0.62) set("ryggT", q.ryggF * 0.62)
  // 9) kilehòlet står midt i tunga og må ha gods ut til hakka
  const kileGods = q.spenn / 2 - q.plyT / 2 - (q.plyT + q.pressfit) / 2
  if (kileGods < 24) set("spenn", q.spenn + 2 * (24 - kileGods))
  // 10) bereholet: gods kring det, og gods over og under det i lista
  if (q.grep > 0 && q.grep > q.ryggT - 86) set("grep", Math.max(0, q.ryggT - 86))
  if (q.grep > 0 && q.ryggH < 84) set("grep", 0)
  if (q.grep > 0) set("grepZ", Math.min(q.grepZ, Math.max(26, q.ryggH - 30)))
  if (q.grep > 0 && q.grep < 90) set("grep", 0)
  // 11) halsen må vera smalare enn setedjupna, elles finst ikkje bladet
  if (q.hals > q.djup * 0.62) set("hals", q.djup * 0.62)
  return q
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  laastInn: ReadonlySet<string> = new Set(),
): Params {
  const laast = new Set([...laastInn, ...FREDA])
  const posed = poseBag(
    rnd,
    prev as unknown as ParamBag,
    POSES as unknown as readonly Partial<Record<string, number | string>>[],
    DEFAULT_PARAMS as unknown as ParamBag,
    PARAM_RANGES,
    PARAM_KEYS,
    laast,
  )
  const q = (posed ??
    randomBag(rnd, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS, laast)) as unknown as Params
  return clampParams(fiks({ ...q }, laast), prev)
}

/** materialet, med bjørk som fallback for ein sekk som lyg */
export const materialet = (p: Params): Material =>
  (p.material as Material) in MATERIALS ? (p.material as Material) : "bjork"
