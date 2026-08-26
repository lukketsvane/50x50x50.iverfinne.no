/**
 * SKIVE — parameterrommet.
 *
 * Typologien er den enklaste av alle: parallelle, ståande skiver med luft
 * imellom, tredde på stavar. Kvar skive er heile møbelet sett frå sida —
 * sete, rygg og to føter i EITT stykke — og møbelet er den same silhuetten
 * gjenteken med små endringar på vegen ut mot sidene. Det er den einaste
 * typologien her der snittet og møbelet er same teikning.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg (skivene står normalt på Y),
 * Z = opp. Alle mål i millimeter, vinklar i grader.
 */
import {
  MATERIALS,
  clampBag,
  poseBag,
  randomBag,
  shoelace,
  type Group,
  type Hovuddrag,
  type ParamBag,
  type Pose,
  type Range,
} from "../core"
import { buildSlices } from "./profile"

export type Params = {
  // --- SETE ---------------------------------------------------------------
  hogd: number // setekanten ved nasen, mm
  djup: number // sete frå nase til rygg, mm
  grop: number // setegropa på det djupaste, mm
  nase: number // naseradius framme, mm
  setevipp: number // setet vippa bakover kring nasen, grader — negativt kronar bak

  // --- RYGG ---------------------------------------------------------------
  ryggH: number // ryggkanten over setet, mm — null er ein krakk
  ryggV: number // bakoverlening, grader
  ryggB: number // ryggboge: kor mykje ryggen bular bakover på midten, mm
  ryggT: number // ryggtjukn i profilen, mm
  grep: number // berehòl i ryggen, lengd langs ryggaksen, mm — null er inkje hòl

  // --- BEIN OG BOGE -------------------------------------------------------
  frambein: number // framfoten si breidd på golvet, mm
  bakbein: number // bakfoten si breidd på golvet, mm
  bogeH: number // kor høgt opninga under setet når, mm — null er ein PIDESTALL
  bogeN: number // bogeeksponent: 2 er ellipse, 4 er nesten firkant
  mellomfot: number // midtfot som kløyver bogen i to — akvedukten, mm brei
  flare: number // kor brått framkanten flarar ut mot foten
  bakflare: number // kor langt bakkanten sparkar bakover ned mot golvet, del av bakbein

  // --- SKIVENE ------------------------------------------------------------
  skiver: number // kor mange skiver
  plyT: number // skivetjukn, mm
  luft: number // opning mellom skivene, mm
  luftfall: number // gapgradient gjennom stabelen: + pakkar mot midten, − mot kantane
  kuppel: number // kor mykje ryggen fell av ut mot sidene, 0–1
  sidefall: number // kor mykje setet fell av ut mot sidene, mm
  innsving: number // kor mykje dei ytste skivene er dregne inn, 0–1
  bogefall: number // kor mykje bogen krympar ut mot sidene, 0–1 — hòla vert ei GROTTE
  bogedrift: number // kor langt bogetoppen sig bakover/framover ut mot sidene, mm
  vifte: number // skivene roterte i solfjøs kring midten, grader per ytste skive

  // --- BYGG ---------------------------------------------------------------
  stavD: number // stavdiameter, mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  hogd: { min: 380, max: 470, step: 1, label: "setehøgd", unit: "mm" },
  djup: { min: 300, max: 420, step: 1, label: "setedjup", unit: "mm" },
  grop: { min: 0, max: 40, step: 0.5, label: "setegrop", unit: "mm" },
  nase: { min: 8, max: 45, step: 0.5, label: "naseradius", unit: "mm" },
  setevipp: { min: -3, max: 8, step: 0.5, label: "setevipp", unit: "°" },

  ryggH: { min: 0, max: 120, step: 1, label: "rygghøgd", unit: "mm" },
  ryggV: { min: 0, max: 28, step: 0.5, label: "rygglening", unit: "°" },
  ryggB: { min: 0, max: 40, step: 0.5, label: "ryggboge", unit: "mm" },
  ryggT: { min: 40, max: 110, step: 1, label: "ryggtjukn", unit: "mm" },
  grep: { min: 0, max: 110, step: 1, label: "berehòl", unit: "mm" },

  frambein: { min: 90, max: 210, step: 1, label: "framfot", unit: "mm" },
  bakbein: { min: 90, max: 220, step: 1, label: "bakfot", unit: "mm" },
  bogeH: { min: 0, max: 330, step: 1, label: "bogehøgd", unit: "mm" },
  bogeN: { min: 1.6, max: 5, step: 0.05, label: "bogeform" },
  mellomfot: { min: 0, max: 130, step: 1, label: "midtfot", unit: "mm" },
  flare: { min: 0.8, max: 3.6, step: 0.05, label: "flare" },
  bakflare: { min: 0, max: 0.8, step: 0.01, label: "bakflare" },

  skiver: { min: 7, max: 21, step: 1, label: "skiver", int: true },
  plyT: { min: 9, max: 24, step: 0.5, label: "skivetjukn", unit: "mm" },
  luft: { min: 0, max: 60, step: 0.5, label: "luft", unit: "mm" },
  luftfall: { min: -0.6, max: 0.6, step: 0.005, label: "luftfall" },
  kuppel: { min: -0.5, max: 0.8, step: 0.005, label: "kuppel" },
  sidefall: { min: -20, max: 30, step: 0.5, label: "sidefall", unit: "mm" },
  innsving: { min: -0.1, max: 0.16, step: 0.002, label: "innsving" },
  bogefall: { min: 0, max: 0.9, step: 0.005, label: "grotte" },
  bogedrift: { min: -90, max: 90, step: 1, label: "bogedrift", unit: "mm" },
  vifte: { min: -14, max: 14, step: 0.5, label: "vifte", unit: "°" },

  stavD: { min: 8, max: 16, step: 0.5, label: "stavdiameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "sete", label: "sete", keys: ["hogd", "djup", "grop", "nase", "setevipp"] },
  { id: "rygg", label: "rygg", keys: ["ryggH", "ryggV", "ryggB", "ryggT", "grep"] },
  {
    id: "bein",
    label: "bein",
    keys: ["frambein", "bakbein", "bogeH", "bogeN", "mellomfot", "flare", "bakflare"],
  },
  {
    id: "skiver",
    label: "skiver",
    keys: ["skiver", "plyT", "luft", "luftfall", "kuppel", "sidefall", "innsving", "bogefall", "bogedrift", "vifte"],
  },
  { id: "bygg", label: "bygg", keys: ["stavD"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden siktar på referansespråket: tretten skiver, tjue millimeter
 * luft, ein låg kuppelrygg som fell av mot sidene, og ei stor opning under
 * setet. Ryggen er låg med vilje — kuben på 500 og sitjehøgdbandet i
 * NS-EN 1729 gjev til saman under 120 mm rygg over setet, og det er nok
 * til ei lend, ikkje til eit skulderblad.
 */
export const DEFAULT_PARAMS: Params = {
  hogd: 404,
  djup: 324,
  grop: 16,
  nase: 26,
  setevipp: 0,

  ryggH: 90,
  ryggV: 13,
  ryggB: 14,
  ryggT: 50,
  grep: 0,

  frambein: 112,
  bakbein: 116,
  bogeH: 290,
  bogeN: 2.6,
  mellomfot: 0,
  flare: 2.2,
  bakflare: 0.35,

  skiver: 11,
  plyT: 14,
  luft: 31,
  luftfall: 0,
  kuppel: 0.42,
  sidefall: 10,
  innsving: 0.05,
  bogefall: 0,
  bogedrift: 0,
  vifte: 0,

  stavD: 12,
  material: "bjork",
}

/**
 * Kuraterte posar: handdesigna utgangspunkt terningen jittrar kring
 * annakvar gong. Grotta er den mørke referansen — bogen krympar og sig på
 * skrå gjennom stabelen; benken er rein og rygglaus; stolen er den blå
 * referansen med høg kuppel; den lette er luft og nesten ingenting anna.
 * Pidestallen, akvedukten og sleden er dei tre nye familiane: sokkelen
 * utan boge, midtfoten som kløyver bogen, og bereholet i ryggen.
 * Kvilestolen er den siste: setet vippa bakover kring nasen, so ryggfoten
 * fell og det vert rom under kubelokket til ein rygg ein kan lena seg mot.
 */
export const POSES: readonly Partial<Params>[] = [
  // grotta
  {
    bogefall: 0.72, bogedrift: 55, bogeH: 320, bogeN: 2.2,
    skiver: 10, plyT: 14, luft: 34, ryggH: 70, kuppel: 0.15,
    grop: 20, sidefall: 16, innsving: 0.03, djup: 330,
  },
  // benken
  {
    ryggH: 0, hogd: 396, djup: 360, frambein: 130, bakbein: 130,
    bogeH: 300, luft: 36, skiver: 10, plyT: 15, kuppel: 0,
    sidefall: 18, grop: 24, bogefall: 0.2,
  },
  // stolen
  {
    ryggH: 100, hogd: 396, ryggV: 20, ryggB: 24, kuppel: 0.55,
    skiver: 12, plyT: 13, luft: 28, djup: 330, grop: 14, sidefall: 8,
  },
  // den lette
  {
    skiver: 8, plyT: 19, luft: 44, bogeH: 320, bogeN: 1.9,
    frambein: 100, bakbein: 104, ryggH: 60, kuppel: 0.3,
    innsving: 0.09, stavD: 14,
  },
  // vifta: skivene roterte i solfjøs — same kuttfil, heilt anna møbel
  {
    vifte: 7, skiver: 12, plyT: 13, luft: 26, ryggH: 80,
    kuppel: 0.35, grop: 18, djup: 322, bogeH: 290, frambein: 104, bakbein: 106,
  },
  // vengene: ryggen STIG ut mot sidene og setet kronar seg
  {
    kuppel: -0.45, ryggH: 68, hogd: 396, sidefall: -12,
    ryggV: 16, skiver: 12, plyT: 14, luft: 27, grop: 22,
  },
  // spent: dei ytste skivene er STØRRE — silhuetten spriker som ein gange
  {
    innsving: -0.08, djup: 324, hogd: 398, frambein: 100, bakbein: 104,
    skiver: 11, plyT: 14, luft: 30, ryggH: 74, kuppel: 0.3, bogeH: 300,
  },
  // pidestallen: ingen boge — møbelet er ein massiv sokkel av få, tjukke
  // skiver med mykje luft. Lufta er den einaste opninga som finst.
  {
    bogeH: 0, ryggH: 0, skiver: 7, plyT: 12, luft: 58, hogd: 414,
    djup: 330, grop: 20, sidefall: 14, frambein: 92, bakbein: 92,
    flare: 0.9, bakflare: 0.05, innsving: 0.1, nase: 20,
  },
  // akvedukten: midtfoten kløyver bogen i to — og drifta let han VANDRE
  // gjennom stabelen, so dei to boga byter storleik frå skive til skive
  {
    mellomfot: 85, bogeH: 250, bogeN: 3, bogedrift: 20, djup: 360,
    ryggH: 0, hogd: 402, frambein: 120, bakbein: 120, bakflare: 0.12,
    skiver: 9, plyT: 12, luft: 42, grop: 24, sidefall: 16, kuppel: 0,
  },
  // sleden: bakkanten sparkar langt bakover og grepet sit i ryggen —
  // stolen ein ber med eine handa og set frå seg på skrå
  {
    grep: 80, ryggH: 100, ryggT: 68, ryggV: 15, hogd: 394,
    bakflare: 0.5, bakbein: 150, bogeH: 260, bogedrift: -30,
    skiver: 12, plyT: 12, luft: 28, kuppel: 0.28, grop: 16, djup: 320,
  },
  // orgelet: lufta fell frå midten og ut — skivene står tett som piper
  // midt i benken og glisnar mot kantane. Same kuttfil, berre gapa er
  // graderte; luft 40 held minste gap (~28 mm) over fingerfella på 25.
  {
    luftfall: 0.55, skiver: 9, plyT: 14, luft: 40, ryggH: 0,
    bogeH: 300, kuppel: 0, hogd: 404, djup: 340, grop: 22, sidefall: 14,
    frambein: 120, bakbein: 120, bogefall: 0.15,
  },
  // kvilestolen: setet vippa åtte grader bakover kring nasen og ryggen
  // lena tjueto — ein sit ikkje oppreist i han, ein søkk bakover. Vippen
  // senkar ryggfoten femti millimeter og kjøper heile ryggen plass under
  // lokket, og setehøgda står på 440 av di dei femti er betalte att.
  {
    setevipp: 8, ryggV: 22, ryggH: 100, hogd: 440, djup: 360, bakflare: 0.3,
    grop: 18, sidefall: 10, ryggB: 22, ryggT: 54, bogeH: 310, bogeN: 2.4,
    skiver: 11, plyT: 12.5, luft: 32, kuppel: 0.4, frambein: 120,
    bakbein: 130, innsving: 0.05, nase: 30,
  },
]

/** Posane med namna sine — same liste, synlege som inngangar i panelet.
 *  Namnet står her og ikkje inne i kvar pose, so poseBag (terningen) les
 *  lista uendra. Rekkjefylgja er lista over. */
const POSE_NAMN: readonly string[] = [
  "grotta", "benken", "stolen", "den lette", "vifta", "vengene", "spent",
  "pidestallen", "akvedukten", "sleden", "orgelet", "kvilestolen",
]
export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag,
}))

/** Hovuddraga: dei få kontrollane som verkeleg formar. Kvart drag styrer
 *  eitt eller fleire eksisterande band saman — ingen nye parametrar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["hogd", 1]] },
  { id: "rygg", label: "rygg", keys: [["ryggH", 1]] },
  { id: "boge", label: "boge", keys: [["bogeH", 1]] },
  { id: "luft", label: "luft", keys: [["luft", 1]] },
  { id: "skiver", label: "skiver", keys: [["skiver", 1]] },
  { id: "kuppel", label: "kuppel", keys: [["kuppel", 1]] },
]

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "luft", pinch: "djup" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(rnd, prev, POSES, DEFAULT_PARAMS, PARAM_RANGES, PARAM_KEYS, locked)
  const q = posed ?? (randomBag(rnd, prev, PARAM_RANGES, PARAM_KEYS, locked) as Params)
  // Terningen får kaste kva han vil, men somme tal er SUMAR av andre og
  // bryt reglane nesten alltid utan hjelp: breidda, høgda og djupna er
  // konvoluttar, massen er eit integral, og somme band er daudsoner der
  // forma korkje er det eine eller det andre. Reparasjonen går i fast
  // rekkjefylgje — snappar, breidd, masse, luftfall, kube — og rører berre
  // ulåste skyvarar, alltid innanfor banda.
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k]
    ;(q as Record<string, number | string>)[k] = Math.min(r.max, Math.max(r.min, +v.toFixed(3)))
  }
  const wMax = 492
  const deg = Math.PI / 180

  // --- daudsone-snapparane --------------------------------------------------
  // Terningen når smale band der forma korkje er det eine eller det andre:
  // ein slisseboge, ein flis av midtfot, ei leppe av rygg, eit grep
  // gripHole nektar å bora. Kvart kast må VELJE side av daudsona.
  if (q.bogeH > 0 && q.bogeH < 60) fix("bogeH", q.bogeH < 30 ? 0 : 60)
  if (q.mellomfot >= 2 && q.mellomfot < 40) fix("mellomfot", q.mellomfot < 20 ? 0 : 45)
  if (q.ryggH > 0 && q.ryggH < 30) fix("ryggH", q.ryggH < 15 ? 0 : 30)
  if (q.grep > 0 && q.grep < 30) fix("grep", 0)
  // luft mellom 5 og 25 mm er fingerfella klemfare-regelen vaktar
  if (q.luft >= 5 && q.luft < 25) fix("luft", q.luft < 12 ? 4.5 : 25)
  // under 324 mm setedjup fell sitjeflata under 320-bandet
  if (q.djup < 324) fix("djup", 324)

  // --- setevippen: den NEGATIVE betaler fyrst -------------------------------
  // Vippen dreg setet ned med tan(vipp)·djup/2 i middel — nett den arma
  // skanninga i metrics har — og bakkanten med tan(vipp)·djup. Negativ vipp
  // snur begge oppover: han lyfter sitjehøgda mot 480-taket OG heile
  // ryggfoten mot kubelokket. Vinkelen er det billegaste å gje frå seg, so
  // han vert kappa mot begge to før noko anna vert rørt.
  const vippSig = () => Math.tan(q.setevipp * deg) * (q.djup / 2)
  const vippTak = () => {
    if (q.setevipp >= 0) return
    const kUp0 = 1 - Math.min(0, q.kuppel)
    const krone = Math.max(0, -(q.grop + q.sidefall))
    // øvre skjøn på sitjehøgda før vippen: gropa dreg minst 0.6 av seg ned,
    // og negativt sidefall kronar setet oppover
    const sitHi = q.hogd - 0.6 * q.grop + 0.08 * Math.max(0, -q.sidefall)
    const budsjett = Math.max(0, 494 - q.hogd - Math.max(q.ryggH * kUp0, krone))
    const tak = Math.max(0, Math.min((477 - sitHi) / (q.djup / 2), budsjett / q.djup))
    if (-Math.tan(q.setevipp * deg) > tak) fix("setevipp", -Math.atan(tak) / deg)
  }
  vippTak()

  // sitjehøgda: gropa dreg middelet ned med ~0.65 av seg, sidefallet berre
  // ~0.08 — og NEGATIVT sidefall kronar setet, det dreg ikkje ned. Vippen
  // kjem i tillegg, med forteikn: han senkar det låge og lyfter det høge.
  if (q.hogd - 0.65 * q.grop - 0.08 * Math.max(0, q.sidefall) - vippSig() < 383) {
    fix("grop", Math.max(0, (q.hogd - 383 - 0.08 * Math.max(0, q.sidefall) - vippSig()) / 0.65))
  }
  if (q.hogd - 0.65 * q.grop - vippSig() < 383) fix("hogd", 383 + 0.65 * q.grop + vippSig())

  // --- setebandet må halde seg heilt ----------------------------------------
  // Bogetoppen sit midt i spennet, og der er setet alt vippa ned med halve
  // arma si. Fire millimeter over dei tretti regelen krev er mon mot
  // bogedrifta; ein rest under seksti er slissebogen si daudsone, og då er
  // pidestallen svaret i staden.
  const heilFix = () => {
    const tak = q.hogd - q.grop - Math.max(0, q.sidefall) - 34 - vippSig()
    if (q.bogeH > tak) fix("bogeH", tak < 60 ? 0 : tak)
  }
  heilFix()

  // --- breidda er ein sum og et kuben fyrst ---------------------------------
  const n = Math.max(2, Math.round(q.skiver))
  if (n * q.plyT + (n - 1) * q.luft > wMax) {
    fix("luft", (wMax - n * q.plyT) / (n - 1))
    const n2 = Math.max(2, Math.round(q.skiver))
    if (n2 * q.plyT + (n2 - 1) * q.luft > wMax) {
      fix("skiver", Math.floor((wMax + q.luft) / (q.plyT + q.luft)))
    }
    // breiddefiksen kan ha lagt lufta i fingerfella att: snapp opp om
    // kuben toler det, elles ned
    if (q.luft >= 5 && q.luft < 25) {
      const n3 = Math.max(2, Math.round(q.skiver))
      fix("luft", n3 * q.plyT + (n3 - 1) * 25 <= wMax ? 25 : 4.5)
    }
  }

  // --- massetrimmen, med breidde-restitusjon --------------------------------
  // Massen vert målt eksakt på dei bygde skivene. Er han for stor, er det
  // finéren som må vike — men velting, støtteflate og sete på tvers lever
  // alle på breidda, so lufta får att kvar millimeter tjukna gjev frå seg:
  // luft veg ingenting.
  const massOf = () => {
    const rho = MATERIALS[q.material as keyof typeof MATERIALS].rho
    return buildSlices(q).slices.reduce(
      (s, sl) => s + (Math.abs(shoelace(sl.outline)) * q.plyT * rho) / 1e9,
      0,
    )
  }
  let mass = massOf()
  if (mass > 11.5) {
    const n1 = Math.max(2, Math.round(q.skiver))
    const W0 = n1 * q.plyT + (n1 - 1) * q.luft
    fix("plyT", q.plyT * Math.max(0.55, 11.5 / mass))
    mass = massOf()
    if (mass > 11.5) fix("skiver", Math.max(7, Math.floor(n1 * (11.5 / mass))))
    const n2 = Math.max(2, Math.round(q.skiver))
    const Wt = Math.min(wMax, Math.max(W0, 330))
    let luft2 = (Wt - n2 * q.plyT) / (n2 - 1)
    if (luft2 >= 5 && luft2 < 25) luft2 = n2 * q.plyT + (n2 - 1) * 25 <= wMax ? 25 : 4.5
    fix("luft", luft2)
  }

  // --- luftfallet må ikkje gradere eit lovleg gap inn i fingerfella ---------
  // Minste gap er om lag luft·(1 − 0.62·|luftfall|); her vert han rekna
  // eksakt for dette skivetalet, so kvart einaste gap held seg utanfor
  // bandet 5–25 mm — regelen les berre p.luft, men fingrane les gapa.
  const minGapRatio = (lf: number): number => {
    const nG = Math.max(2, Math.round(q.skiver))
    const mG = nG - 1
    if (mG < 1 || lf === 0) return 1
    let sum = 0
    let wmin = Infinity
    for (let j = 0; j < mG; j++) {
      const c = mG > 1 ? Math.abs(j - (mG - 1) / 2) / ((mG - 1) / 2) : 1
      const w = Math.max(0.05, 1 - lf * (1 - c))
      sum += w
      if (w < wmin) wmin = w
    }
    return (mG * wmin) / sum
  }
  if (q.luftfall !== 0) {
    if (q.luft < 25) {
      fix("luftfall", 0)
    } else {
      // 25.05 og steget på 0.005: monnen svelgjer avrundinga i fix()
      let lf = Math.min(Math.abs(q.luftfall), (1 - 25 / q.luft) / 0.62)
      while (lf > 0 && minGapRatio(Math.sign(q.luftfall) * lf) * q.luft < 25.05) {
        lf = Math.max(0, lf - 0.02)
      }
      if (lf < 0.005) lf = 0
      if (lf < Math.abs(q.luftfall)) fix("luftfall", Math.sign(q.luftfall) * lf)
    }
  }

  // --- kube-kaskaden --------------------------------------------------------
  // (Z) negativ kuppel LYFTER ryggen ute ved kantane, og krona (negativ
  // grop+sidefall) lyfter setet — høgda må målast der ho er høgst. Ryggen
  // står på setet sin bakkant, og den kanten fylgjer vippen: positiv vipp
  // senkar foten med tan(vipp)·djup og KJØPER rygg, negativ lyfter han og
  // krev rygg tilbake. Krona kan aldri koma over hogd under positiv vipp,
  // so ho les setekanten rein.
  const kubeZ = () => {
    const kUp = 1 - Math.min(0, q.kuppel)
    const fall = Math.tan(q.setevipp * deg) * q.djup
    if (q.hogd - fall + q.ryggH * kUp > 494) fix("ryggH", (494 - q.hogd + fall) / kUp)
    if (q.hogd + Math.max(0, -(q.grop + q.sidefall)) > 494) {
      fix("sidefall", -(q.grop + (494 - q.hogd)))
    }
  }
  kubeZ()
  // (X/Y) konvolutten: nase + flare framme, rygg + bakflare eller lening
  // bak, alt skalert av negativt innsving — og vifta et av BEGGE aksane.
  const env = () => {
    const nE = Math.max(2, Math.round(q.skiver))
    const W = nE * q.plyT + (nE - 1) * q.luft
    const sxOut = 1 - Math.min(0, q.innsving)
    const xFront = (q.djup / 2 + 0.25 * q.frambein) * sxOut
    const bakArm = Math.max(
      q.bakflare * q.bakbein,
      Math.tan(q.ryggV * deg) * Math.max(0, q.ryggH),
    )
    const xBack = (q.djup / 2 + q.ryggT + bakArm) * sxOut
    const sa = Math.sin(Math.abs(q.vifte) * deg)
    return {
      W, xFront, xBack, sxOut,
      envX: xFront + xBack + (W / 2) * sa,
      envY: W + 2 * Math.max(xFront, xBack) * sa,
      sa,
    }
  }
  // vifta betaler fyrst — ho er pynt, djupna og ryggen er møbel
  let e = env()
  if ((e.envX > wMax || e.envY > wMax) && q.vifte !== 0) {
    const sa2 = Math.min(
      e.sa,
      Math.max(0, (wMax - e.xFront - e.xBack) / (e.W / 2)),
      Math.max(0, (wMax - e.W) / (2 * Math.max(e.xFront, e.xBack))),
    )
    fix("vifte", (Math.sign(q.vifte) * Math.asin(Math.min(1, sa2))) / deg)
    e = env()
  }
  // so sparket bakover — men berre når det faktisk er sparket som stikk ut
  if (e.envX > wMax && q.bakflare * q.bakbein > Math.tan(q.ryggV * deg) * Math.max(0, q.ryggH)) {
    fix("bakflare", q.bakflare - (e.envX - wMax) / e.sxOut / q.bakbein)
    e = env()
  }
  // so djupna, med golv på 324 so sitjeflata ikkje vert offer for kuben
  if (e.envX > wMax) {
    fix("djup", Math.max(324, q.djup - (e.envX - wMax)))
    e = env()
  }
  // siste utveg: ryggtjukna
  if (e.envX > wMax) fix("ryggT", q.ryggT - (e.envX - wMax))
  // Konvolutt-kaskaden kan ha krympa djupna, og djupna er sjølve arma
  // vippen verkar gjennom: både taket på vinkelen, kube-Z og setebandet
  // må reknast om på det djupet som faktisk står att.
  vippTak()
  kubeZ()
  heilFix()
  return q
}
