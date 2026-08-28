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
 *
 * UNDERSTELLET ER EIN X. To blad står i kvar sitt loddrette plan, og dei
 * to plana KRYSSAR kvarandre midt under setet. Difor er dei fire føtene
 * fire hjørne og ikkje to sider, difor har kvart blad eit ope hakk på
 * midten — det eine oppover, det andre nedover — og difor treng heile
 * møbelet berre eitt ledd til: setet som fell ned over toppen av krysset.
 * To parallelle sidevegger ville gjeve same silhuetten frå sida og ein
 * heilt annan stol: fire ledd, ingen kryss, og ei ramme som klappar
 * saman den vegen ingen ser før ho gjer det.
 *
 * OG SO ER DET KUBEN. Ein flatpakka stol av denne familien er kring 800
 * mm høg ute i verda; oppgåva her gjev femhundre. Difor er setehøgda her
 * ei LOUNGEHØGD og ikkje ei arbeidshøgd: under fire hundre, so det vert
 * rygg att over. Det harde bandet startar på 330 — golvnært, men framleis
 * ein stol ein kjem seg opp av — og det mjuke seier frå når ein er under
 * arbeidshøgd. Det er ikkje ein amputert referanse; det er kva referansen
 * VERT når han må stå i ein halv meter.
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
  // --- setet ---------------------------------------------------------------
  /** høgda på framkanten av setet over golvet, mm */
  hogd: number
  /** setedjupna, kutta i plata, mm */
  djup: number
  /** setebreidda, kutta i plata, mm */
  breidd: number
  /** vippen bakover, grader — framkanten er den høge */
  setevipp: number
  /** kor mykje breiare framkanten er enn bakkanten, del av breidda */
  setekile: number
  /** framkanten buar fram på midten, mm */
  nase: number
  /** bakkanten buar FRAM på midten, mm — det er halvmånen */
  bakbukt: number
  /** hjørna: 0 er rektangel med runda hjørne, 1 er rein ellipse */
  hjorne: number

  // --- ryggen --------------------------------------------------------------
  /** høgda over setet, målt langs plata, mm */
  ryggH: number
  /** leninga bakover, grader */
  ryggV: number
  /** breidda på ryggen i alt, mm */
  ryggT: number
  /** éi brei plate eller to smale stavar */
  ryggdel: number
  /** glipa mellom stavane når det er to, mm */
  ryggglipe: number
  /** toppen: 0 er rett, 1 er heilrunda */
  ryggtopp: number
  /** bereholet si lengd, mm — null er inkje hòl */
  grep: number
  /** bereholet sitt senter under toppen, mm */
  grepZ: number

  // --- beina ---------------------------------------------------------------
  /** halve fotavstanden fram og attende, mm */
  fotX: number
  /** halve fotavstanden sideveg, mm */
  fotY: number
  /** bogen mellom føtene, del av bladhøgda på midten */
  bogeH: number
  /** foten si breidd langs bladet, mm */
  fotbreidd: number
  /** skuldra: kor langt ut bladet held full høgd, del av armen */
  hals: number
  /** utskjeringa: 0 trekant, 0,5 drope, 1 boge */
  holform: number
  /** utskjeringa si storleik, 0 er inkje hòl */
  holstorleik: number

  // --- ledda ---------------------------------------------------------------
  /** platetjukna, mm */
  plyT: number
  /** klaringa i spora, mm — diameter, ikkje radius */
  pressfit: number
  /** fresediameteren, mm: avlastinga i kvart indre hjørne */
  fresD: number
  /** kilen si lengd, mm */
  kileB: number
  /** tunga under setet, mm */
  tunge: number

  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 330, max: 470, step: 1, label: "setehøgd" },
  djup: { min: 300, max: 430, step: 1, label: "setedjup" },
  breidd: { min: 300, max: 470, step: 1, label: "setebreidd" },
  setevipp: { min: 0, max: 14, step: 0.5, label: "setevipp" },
  setekile: { min: -0.1, max: 0.3, step: 0.01, label: "setekile" },
  nase: { min: 0, max: 60, step: 1, label: "nase" },
  bakbukt: { min: -30, max: 170, step: 1, label: "bakbukt" },
  hjorne: { min: 0, max: 1, step: 0.01, label: "hjørne" },

  ryggH: { min: 60, max: 220, step: 1, label: "rygghøgd" },
  ryggV: { min: 4, max: 34, step: 0.5, label: "rygglening" },
  ryggT: { min: 200, max: 440, step: 1, label: "ryggbreidd" },
  ryggdel: { min: 1, max: 2, step: 1, label: "ryggdelar" },
  ryggglipe: { min: 8, max: 60, step: 1, label: "ryggglipe" },
  ryggtopp: { min: 0, max: 1, step: 0.01, label: "ryggtopp" },
  grep: { min: 0, max: 200, step: 1, label: "berehol" },
  grepZ: { min: 30, max: 90, step: 1, label: "hòl under topp" },

  fotX: { min: 150, max: 260, step: 1, label: "fot fram/bak" },
  fotY: { min: 110, max: 235, step: 1, label: "fot sideveg" },
  bogeH: { min: 0.25, max: 0.85, step: 0.01, label: "boge" },
  fotbreidd: { min: 40, max: 120, step: 1, label: "fotbreidd" },
  hals: { min: 0.3, max: 0.92, step: 0.01, label: "skulder" },
  holform: { min: 0, max: 1, step: 0.01, label: "hòlform" },
  holstorleik: { min: 0, max: 0.9, step: 0.01, label: "hòlstorleik" },

  plyT: { min: 12, max: 21, step: 0.5, label: "platetjukn" },
  pressfit: { min: 0.1, max: 0.4, step: 0.05, label: "klaring" },
  fresD: { min: 3, max: 8, step: 0.5, label: "fresediameter" },
  kileB: { min: 50, max: 110, step: 1, label: "kilelengd" },
  tunge: { min: 60, max: 200, step: 1, label: "tunge" },
}

export const GROUPS: Group[] = [
  {
    id: "sete",
    label: "sete",
    keys: ["hogd", "djup", "breidd", "setevipp", "setekile", "nase", "bakbukt", "hjorne"],
  },
  {
    id: "rygg",
    label: "rygg",
    keys: ["ryggH", "ryggV", "ryggT", "ryggdel", "ryggglipe", "ryggtopp", "grep", "grepZ"],
  },
  {
    id: "bein",
    label: "bein",
    keys: ["fotX", "fotY", "bogeH", "fotbreidd", "hals", "holform", "holstorleik"],
  },
  { id: "ledd", label: "ledd", keys: ["plyT", "pressfit", "fresD", "kileB", "tunge"] },
]

export const PARAM_KEYS: string[] = GROUPS.flatMap((g) => g.keys)

/**
 * Standardobjektet er referansen sitt formspråk B: skjoldsete med runda
 * hjørne, éin brei rygg, blad med trekanta utskjering. Sitjehøgda 372 er
 * med vilje under arbeidshøgd — det er det kuben kjøper rygg for.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 402,
  djup: 372,
  breidd: 404,
  setevipp: 7,
  setekile: 0.18,
  nase: 22,
  bakbukt: 26,
  hjorne: 0.36,

  ryggH: 136,
  ryggV: 17,
  ryggT: 274,
  ryggdel: 1,
  ryggglipe: 42,
  ryggtopp: 0.86,
  grep: 132,
  grepZ: 52,

  fotX: 214,
  fotY: 176,
  bogeH: 0.56,
  fotbreidd: 74,
  hals: 0.6,
  holform: 0.15,
  holstorleik: 0.7,

  plyT: 15,
  pressfit: 0.2,
  fresD: 6,
  kileB: 78,
  tunge: 132,

  material: "bjork",
}

export const clampParams = (o: unknown, prev: Params): Params =>
  clampBag(o, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS) as unknown as Params

/** materialet, med bjørk som fallback for ein sekk som lyg */
export const materialet = (p: Params): Material =>
  (p.material as Material) in MATERIALS ? (p.material as Material) : "bjork"

export { clampBag, poseBag, randomBag }

/**
 * Kuraterte posar. Rommet spenner frå den låge, breie lenestolen til den
 * høge, smale arbeidsstolen — og LAFT har berre fem plater å seie det
 * med, so kvar pose må endre PROPORSJON og ikkje pynt. Dei tre fyrste er
 * dei tre formspråka i referansane; dei to siste er rommet imellom.
 */
export const POSES: readonly Partial<Params>[] = [
  // sigden: halvmånesete med djup konkav bakkant, to smale ryggstavar,
  // rette og kantete blad — lågast sete og mest rygg
  { hogd: 403, djup: 395, breidd: 424, setevipp: 10.5, setekile: 0.16, nase: 30, bakbukt: 77, hjorne: 0.3, ryggH: 159, ryggV: 26, ryggT: 331, ryggdel: 2, ryggglipe: 30, ryggtopp: 0.12, grep: 110, fotX: 221, fotY: 186, bogeH: 0.5, hals: 0.52, holform: 0.02, holstorleik: 0.42, tunge: 149 },
  // skjoldet: referansen sitt midtspråk — runda hjørne, éin brei rygg,
  // trekanta utskjering
  { hogd: 398, djup: 369, breidd: 405, setekile: 0.2, bakbukt: 24, hjorne: 0.4, ryggH: 143, ryggV: 22.5, ryggT: 301, ryggtopp: 0.3, grep: 130, holform: 0.14, holstorleik: 0.54 },
  // stadion: ovalt sete, runda ryggskuldrer, organiske blad med
  // dropeforma utsparing — det mjukaste språket
  { hogd: 399, djup: 376, breidd: 383, setevipp: 6, setekile: 0.02, nase: 19, bakbukt: -28, hjorne: 0.95, ryggH: 150, ryggV: 29, ryggT: 269, ryggtopp: 0.92, grep: 123, fotX: 206, fotY: 169, bogeH: 0.62, fotbreidd: 62, hals: 0.75, holform: 0.62, holstorleik: 0.5 },
  // pinnen: høgast sete, smalast plate, rygg utan hòl — den ein sit på
  // kanten av og reiser seg frå
  { hogd: 442, djup: 330, breidd: 336, setevipp: 3.5, setekile: 0.1, nase: 14, bakbukt: 9, hjorne: 0.5, ryggH: 73, ryggV: 9, ryggT: 250, ryggtopp: 0.5, grep: 0, fotX: 176, fotY: 151, bogeH: 0.4, fotbreidd: 75, hals: 0.84, holform: 0.5, holstorleik: 0.3, tunge: 96 },
  // benken: breiast sete og vidast fotavtrykk — den som vert sitt på av
  // to og sparka av fleire
  { hogd: 392, djup: 344, breidd: 442, setevipp: 5, setekile: 0.22, nase: 26, bakbukt: 39, hjorne: 0.37, ryggH: 128, ryggT: 433, ryggdel: 2, ryggglipe: 52, ryggtopp: 0.2, grep: 150, fotX: 230, fotY: 214, bogeH: 0.52, fotbreidd: 92, hals: 0.44, holform: 0.3, holstorleik: 0.6, tunge: 133 },
]

const POSE_NAMN: readonly string[] = ["sigden", "skjoldet", "stadion", "pinnen", "benken"]
export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag: bag as Pose["bag"],
}))

/** Hovuddraga: dei få kontrollane som verkeleg formar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "rygg", label: "rygg", keys: [["ryggH", 1]] },
  { id: "lening", label: "lening", keys: [["ryggV", 1], ["setevipp", 0.5]] },
  { id: "sigd", label: "sigd", keys: [["bakbukt", 1], ["setekile", 0.3]] },
  { id: "mjuk", label: "mjukleik", keys: [["hjorne", 1], ["holform", 0.8], ["ryggtopp", 0.8]] },
  { id: "kryss", label: "kryss", keys: [["fotY", 1], ["fotX", 0.5]] },
  { id: "boge", label: "boge", keys: [["bogeH", 1], ["holstorleik", 0.6]] },
]

/** Kva to-fingers-rulling på lerretet skrur på. */
export const NUDGE_PARAMS = { vertical: "ryggH", horizontal: "ryggV", pinch: "breidd" }

/** produksjonsval, ikkje form: tjukna og innpassinga vel ein etter plata
 *  og maskina ein faktisk har — terningen rører dei aldri */
const FREDA = ["plyT", "pressfit", "fresD"] as const

/**
 * TERNINGREPARASJONEN.
 *
 * Eit fritt kast bryt nesten alltid, av di krava er SUMAR: kuben tek
 * både fotavtrykket og setet pluss ryggen, ryggen må få plass på setet,
 * og sitjehøgda er setehøgda minus vippen. Kvar retting rører berre
 * ULÅSTE band og held seg innanfor dei. Rettingane heng saman — ein
 * lågare rygg kan opne for eit vidare fotavtrykk som sprengjer kuben som
 * steget over nett hadde ordna — so heile settet vert køyrt til det står
 * stille.
 */
function fiks(q: Params, laast: ReadonlySet<string>): Params {
  for (let i = 0; i < 4; i++) eittPass(q, laast)
  return q
}

function eittPass(q: Params, laast: ReadonlySet<string>): Params {
  const R = PARAM_RANGES
  const set = (k: keyof Params, v: number) => {
    if (laast.has(k)) return
    const r = R[k]
    ;(q as Record<string, number | string>)[k] = Math.min(r.max, Math.max(r.min, +v.toFixed(3)))
  }
  // Dei same formlane måltavla les. Ein reparasjon som reknar
  // omtrentleg reparerer omtrentleg, og då slår regelen ut likevel.
  const geo = () => {
    const a = (q.setevipp * Math.PI) / 180
    const rv = (q.ryggV * Math.PI) / 180
    const ca = Math.cos(a)
    const A = q.djup / 2
    const framX = (A + q.nase) * ca
    const bakX = (A - q.bakbukt) * ca
    const xRygg = (-A + q.bakbukt) * ca + q.plyT + 26
    const zSete = q.hogd - (A - xRygg / ca) * Math.sin(a)
    const phi = Math.atan2(q.fotY, q.fotX)
    // kilen står der tunga er i kilehøgda, ikkje der ho gjekk gjennom setet
    const xTunge = xRygg + (q.plyT / ca + 44) * Math.tan(rv)
    return {
      envX: Math.max(q.fotX, framX) + Math.max(q.fotX, bakX),
      envY: Math.max(2 * q.fotY, q.breidd * (1 + Math.abs(q.setekile)), q.ryggT),
      envZ: zSete + q.ryggH * Math.cos(rv) + q.plyT * Math.sin(rv),
      sitZ: q.hogd - (A - (framX + xRygg) / 2 / ca) * Math.sin(a),
      seteD: Math.max(0, framX - xRygg),
      seteB: q.breidd * (1 - Math.abs(q.setekile) * 0.5),
      stave: (q.ryggT - (q.ryggdel >= 1.5 ? q.ryggglipe : 0)) / (q.ryggdel >= 1.5 ? 2 : 1),
      // kilerommet: kor langt kilen står frå næraste kryssarm
      kile: Math.abs(xTunge) * Math.sin(phi) - q.plyT,
      xRygg,
    }
  }

  // 1 kuben i høgda: ryggen gjev etter fyrst, so setet
  let g = geo()
  if (g.envZ > 498) {
    set("ryggH", q.ryggH - (g.envZ - 494) / Math.cos((q.ryggV * Math.PI) / 180))
    g = geo()
    if (g.envZ > 498) set("hogd", q.hogd - (g.envZ - 494))
  }
  // 2 sitjehøgda i det harde bandet, og helst i arbeidsbandet: er det
  //   rom i kuben, er det inga grunn til å liggje under 380
  g = geo()
  if (g.sitZ < 332) set("hogd", q.hogd + (332 - g.sitZ))
  else if (g.sitZ > 498) set("hogd", q.hogd - (g.sitZ - 498))
  // Arbeidshøgda fyrst, ryggen etterpå. Kuben rommar ikkje begge, og av
  // dei to er det setet ein IKKJE kan gje etter på: ein stol ein ikkje
  // kjem seg opp av er ikkje betre av å ha høg rygg. Ryggen gjev difor
  // frå seg det setet treng — ned til sytti, som framleis er ei list å
  // lene korsryggen mot.
  g = geo()
  if (g.sitZ < 384) {
    const rom = 492 - g.envZ
    const treng = 384 - g.sitZ
    if (rom < treng && q.ryggH > 70) {
      set("ryggH", Math.max(70, q.ryggH - (treng - rom) / Math.cos((q.ryggV * Math.PI) / 180)))
      g = geo()
    }
    set("hogd", q.hogd + Math.min(treng, Math.max(0, 492 - g.envZ)))
  }
  // 3 kuben fram og attende: fotavtrykket fyrst, so setet
  g = geo()
  if (g.envX > 498) {
    set("fotX", Math.min(q.fotX, 248))
    g = geo()
    if (g.envX > 498) {
      set("djup", q.djup - (g.envX - 492))
      set("bakbukt", Math.min(q.bakbukt, q.djup * 0.42))
    }
  }
  // 4 kuben sideveg
  g = geo()
  if (g.envY > 498) {
    set("fotY", Math.min(q.fotY, 247))
    set("breidd", Math.min(q.breidd, 494 / (1 + Math.abs(q.setekile))))
    set("ryggT", Math.min(q.ryggT, 494))
  }
  // 5 ryggen må stå PÅ setet, med gods på kvar side
  g = geo()
  if (q.ryggT > g.seteB - 56) set("ryggT", g.seteB - 56)
  // 6 sitjeflata
  g = geo()
  if (g.seteB < 312) set("breidd", q.breidd + (312 - g.seteB))
  g = geo()
  if (g.seteD < 268) {
    // Djupna er framkanten minus ryggen. Bukta et henne dobbelt — ho
    // flyttar bakkanten fram OG dreg ryggen med seg — so ho gjev etter
    // fyrst, og djupna berre om det ikkje er nok.
    set("bakbukt", q.bakbukt - (268 - g.seteD))
    g = geo()
    if (g.seteD < 268) set("djup", q.djup + (268 - g.seteD) * 1.1)
  }
  // 7 tunga må ha gods kring kilehòlet
  g = geo()
  if (g.stave < 2 * 40 + q.plyT + 8) {
    if (q.ryggdel >= 1.5) set("ryggdel", 1)
    else set("ryggT", 2 * 40 + q.plyT + 12)
  }
  // 8 bereholet: anten inkje hòl, eller eit ei hand kjem gjennom med
  //   gods kring seg
  g = geo()
  if (q.grep > 0) {
    if (g.stave < 132) set("grep", 0)
    else set("grep", Math.min(Math.max(q.grep, 90), g.stave - 42))
  }
  // 9 kilen må stå klar av kryssarmane. Tunga lener seg framover medan
  //   ho fell, og armane kjem imot: mindre lening gjev meir rom, og eit
  //   brattare kryss gjev meir rom. Leninga vik fyrst — ho er komfort,
  //   krysset er stabilitet.
  for (let k = 0; k < 3; k++) {
    g = geo()
    if (g.kile >= 20) break
    if (q.ryggV > PARAM_RANGES.ryggV.min + 0.5) set("ryggV", q.ryggV - 4)
    else if (q.bakbukt > 0) set("bakbukt", q.bakbukt - 20)
    else set("fotY", q.fotY + 14)
  }
  // 10 stabiliteten: fotavtrykket må stå i høve til høgda. Ein X med
  //    korte armar er ein pidestall, og han vippar når nokon lener seg.
  if (q.fotX < 0.42 * q.hogd) set("fotX", 0.42 * q.hogd)
  if (q.fotY < 0.34 * q.hogd) set("fotY", 0.34 * q.hogd)
  // 11 krysshalvinga treng noko å hogge i: overlappet minst førtifire
  const kryssTopp = q.hogd - q.plyT - 12
  if (kryssTopp * (1 - q.bogeH) < 50) set("bogeH", 1 - 50 / Math.max(70, kryssTopp))
  return q
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const laast = new Set<string>([...locked, ...FREDA])
  const posed = poseBag(
    rnd,
    prev as unknown as ParamBag,
    POSES as readonly Partial<Record<string, number | string>>[],
    DEFAULT_PARAMS as unknown as ParamBag,
    PARAM_RANGES,
    PARAM_KEYS,
    laast,
  )
  const q = (posed ??
    randomBag(rnd, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS, laast)) as unknown as Params
  return clampParams(fiks({ ...q }, laast), prev)
}
