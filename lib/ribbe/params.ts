/**
 * RIBBE — parameterrommet.
 *
 * Eitt objekt er eitt punkt her inne. Ingen annan fil held tal: skal, blad,
 * band, sete, kuttark og berekning er alle funksjonar av `Params`, og difor
 * kan teikninga og tabellen aldri kome i utakt.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader ut mot skyvaren og i radianar inne i motoren.
 *
 * To tal er ikkje parametrar, og det er med vilje. Talet på unike
 * bladprofilar er ein konsekvens av planet — eit rundt plan gjev éin, eit
 * ovalt gjev seks — og minste indre radius er ein konsekvens av bladtal og
 * bladtjukn. Begge vert målte, ikkje bedne om.
 */
import {
  clampBag,
  GAMMA_M,
  KMOD,
  MATERIALS,
  poseBag,
  randomBag,
  smooth,
  superR,
  type Group,
  type Hovuddrag,
  type Material,
  type ParamBag,
  type Pose,
  type Range,
} from "../core"
// metrics.ts hentar berre TYPEN Params herifrå, so importen er asyklisk
import { measure } from "./metrics"
import type { Metrics } from "../core"

/** Params må vera tildelbar til ParamBag, difor eit type-alias og ikkje
 *  eit interface: eit interface har ingen indekssignatur og let seg ikkje
 *  lesa som ein sekk med nøklar på vegen ut til panelet. */
export type Params = {
  // --- PLAN: superellipsa objektet er dratt opp av ------------------------
  planN: number // eksponent: 2 er ellipse, 6 les kuben tilbake inn i planet
  planAsp: number // akseforhold i log-skala; 0 er rundt
  planR: number // nominell plan-radius, mm — vert klemd ned av kuben
  flikar: number // tal flikar i planet: 5 er ein blome, 0 er rein superellipse
  flik: number // flikdjup, del av radien — over 0,22 riv fliken konturen open

  // --- SILHUETT: kva radien gjer på vegen opp ----------------------------
  footR: number // radien ved golvet, del av radien øvst
  taper: number // kor tidleg skalet opnar seg oppover
  waist: number // innsnøringa i midja, del av radien
  waistZ: number // høgda for det trongaste, normalisert
  waistW: number // kor brei innsnøringa er
  swell: number // fotsvulm: kor mykje skalet bular ut att under midja

  // --- BLAD ---------------------------------------------------------------
  blades: number // tal blad
  bladeT: number // bladtjukn, mm
  twist: number // vriding: kor mykje bladplanet står på skrå, grader
  inner: number // indre kant: kor langt han står ut frå navet, del av R
  innerZ: number // høgda han når full radius i, normalisert
  innerW: number // kva han gjer over den høgda: opnar (+) eller lukkar (−)
  footArc: number // fotbogen: kor høgt botnkanten stig mot navet, mm
  hubGap: number // klaring i navet ut over n·t/2π, mm

  // --- BAND ---------------------------------------------------------------
  bands: number // tal band
  bandZ0: number // nedste bandet, normalisert høgd
  bandZ1: number // øvste bandet, normalisert høgd
  bandT: number // bandtjukn, mm
  bandW: number // bandbreidd i planet, mm
  bandOut: number // kor langt bandet stikk fram forbi bladet, mm

  // --- SETE ---------------------------------------------------------------
  seatZ: number // høgda på setekanten, mm
  seatT: number // setetjukn, mm
  dish: number // skåldjupn, mm
  moon: number // halvmånen: kor djupt innsnittet bit, del av halvdjupna
  moonR: number // radien i halvmånen, del av halvdjupna
  moneV: number // retninga halvmånen bit frå, grader — 180 er bakfrå
  lip: number // kor langt setet heng ut over skalet, mm

  // --- LEDD ---------------------------------------------------------------
  fit: number // klaring per side i sporet, mm
  relief: number // avlasting i indre hjørne, diameter mm
  corner: number // radius på ytre hjørne, mm
  bit: number // fresediameter, mm

  material: Material
}

export type ParamKey = Exclude<keyof Params, "material">

export const PARAM_RANGES: Record<string, Range> = {
  planN: { min: 2, max: 6.5, step: 0.05, label: "planform" },
  planAsp: { min: -0.5, max: 0.5, step: 0.005, label: "akseforhold" },
  planR: { min: 120, max: 260, step: 1, label: "planradius", unit: "mm" },
  flikar: { min: 0, max: 8, step: 1, label: "flikar", int: true },
  flik: { min: 0, max: 0.22, step: 0.005, label: "flikdjup" },

  footR: { min: 0.4, max: 1.05, step: 0.005, label: "fotbreidd" },
  taper: { min: 0.5, max: 2.4, step: 0.01, label: "silhuettforløp" },
  waist: { min: 0, max: 0.36, step: 0.005, label: "midje" },
  waistZ: { min: 0.2, max: 0.85, step: 0.005, label: "midjehøgd" },
  waistW: { min: 0.12, max: 0.7, step: 0.005, label: "midjebreidd" },
  swell: { min: 0, max: 0.3, step: 0.005, label: "fotsvulm" },

  // ned til seks: under ti sluttar objektet å lesa som skal og vert eit
  // beinkryss — det er ein annan krakk, ikkje eit brot
  blades: { min: 6, max: 34, step: 1, label: "blad", int: true },
  bladeT: { min: 8, max: 24, step: 0.5, label: "bladtjukn", unit: "mm" },
  twist: { min: -40, max: 40, step: 1, label: "vriding", unit: "°" },
  inner: { min: 0.02, max: 0.36, step: 0.005, label: "indre kant" },
  innerZ: { min: 0.15, max: 0.9, step: 0.005, label: "indre kant, høgd" },
  innerW: { min: -0.6, max: 1.0, step: 0.01, label: "indre kant, oppe" },
  footArc: { min: 0, max: 150, step: 1, label: "fotboge", unit: "mm" },
  hubGap: { min: 0, max: 24, step: 0.5, label: "navklaring", unit: "mm" },

  bands: { min: 2, max: 6, step: 1, label: "band", int: true },
  bandZ0: { min: 0.04, max: 0.4, step: 0.005, label: "nedste band" },
  bandZ1: { min: 0.55, max: 0.97, step: 0.005, label: "øvste band" },
  bandT: { min: 8, max: 24, step: 0.5, label: "bandtjukn", unit: "mm" },
  bandW: { min: 22, max: 70, step: 0.5, label: "bandbreidd", unit: "mm" },
  bandOut: { min: 0, max: 34, step: 0.5, label: "band ut", unit: "mm" },

  seatZ: { min: 360, max: 480, step: 1, label: "setekant", unit: "mm" },
  seatT: { min: 16, max: 34, step: 0.5, label: "setetjukn", unit: "mm" },
  dish: { min: 0, max: 26, step: 0.5, label: "skåldjupn", unit: "mm" },
  moon: { min: 0, max: 0.5, step: 0.005, label: "halvmåne" },
  moonR: { min: 0.5, max: 2.2, step: 0.01, label: "halvmåneradius" },
  moneV: { min: 0, max: 360, step: 5, label: "halvmåneretning", unit: "°" },
  lip: { min: 0, max: 26, step: 0.5, label: "overheng", unit: "mm" },

  fit: { min: 0.05, max: 1.2, step: 0.05, label: "sporklaring", unit: "mm" },
  relief: { min: 3, max: 12, step: 0.5, label: "avlasting", unit: "mm" },
  corner: { min: 0, max: 14, step: 0.5, label: "hjørneradius", unit: "mm" },
  bit: { min: 2, max: 10, step: 0.5, label: "fresediameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "plan", label: "plan", keys: ["planN", "planAsp", "planR", "flikar", "flik"] },
  {
    id: "silhuett",
    label: "silhuett",
    keys: ["footR", "taper", "waist", "waistZ", "waistW", "swell"],
  },
  {
    id: "blad",
    label: "blad",
    keys: ["blades", "bladeT", "twist", "inner", "innerZ", "innerW", "footArc", "hubGap"],
  },
  {
    id: "band",
    label: "band",
    keys: ["bands", "bandZ0", "bandZ1", "bandT", "bandW", "bandOut"],
  },
  {
    id: "sete",
    label: "sete",
    keys: ["seatZ", "seatT", "dish", "moon", "moonR", "moneV", "lip"],
  },
  { id: "ledd", label: "ledd", keys: ["fit", "relief", "corner", "bit"] },
]

export const PARAM_KEYS: readonly string[] = GROUPS.flatMap((g) => [...g.keys])

/**
 * RIBBE 01 — objektet i dokumentet, målt tilbake inn i dette rommet. Det er
 * eit utgangspunkt og ikkje ein «preset»: motoren har ingen meny av former,
 * berre eitt punkt du alt står i. Rommet er rommet.
 */
export const DEFAULT_PARAMS: Params = {
  planN: 3.4,
  planAsp: 0.15,
  planR: 230,
  flikar: 0,
  flik: 0,

  footR: 0.72,
  taper: 1,
  waist: 0.26,
  waistZ: 0.52,
  waistW: 0.34,
  swell: 0.05,

  // Bladtjukna og bandtjukna stod på 15 og bar 6–7 gonger lasta utan at
  // nokon hadde spurt: 11 mm held kvar einaste regel, sparer over kiloen
  // og lyfter arkutnyttinga frå 32 til 38 prosent — plata inn fell med
  // fjerdedelen. Tynnare enn 11 vipper nestinga til to ark og vinsten
  // er borte, so dette ER botnen av dalen, ikkje eit kompromiss.
  blades: 22,
  bladeT: 11,
  twist: 0,
  inner: 0.17,
  innerZ: 0.45,
  innerW: 0.8,
  footArc: 93,
  hubGap: 3.5,

  bands: 3,
  bandZ0: 0.13,
  bandZ1: 0.85,
  bandT: 11,
  bandW: 40,
  bandOut: 16,

  seatZ: 448,
  seatT: 22,
  // dish 12 og ikkje 14: 14 ligg NØYAKTIG på skål-grensa seatT−8, og då
  // feller sjølv den minste jitteren kring ein pose den harde regelen
  dish: 12,
  moon: 0.18,
  moonR: 1.1,
  moneV: 180,
  lip: 8,

  fit: 0.3,
  relief: 6,
  corner: 6,
  bit: 3,

  material: "bjork",
}

/** Kuraterte posar: handdesigna utgangspunkt terningen jittrar kring.
 *  Tjuknene er målte botnar, ikkje arv: sopp stoggar på 10 (9,5 vipper
 *  nestinga til to ark), krysset på 20 (under det fell plateutnyttinga
 *  under den mjuke grensa), resten står på 9 — eit medvite mon over
 *  bandbotnen på 8, av di modellane ikkje reknar knekking. Slankinga
 *  åleine tek 0,8–2,5 kg per pose. */
export const POSES: readonly Partial<Params>[] = [
  // vridd: trettifire graders vriding med opna nav — meridianane skrur
  // seg forbi kvarandre med målt 1,1 mm fritt
  { twist: 34, blades: 19, bladeT: 9, bandT: 9, hubGap: 15, inner: 0.18 },
  // timeglas: djup midje midt i høgda, klokkefot
  { waist: 0.35, waistZ: 0.5, waistW: 0.5, footR: 0.9, taper: 1.4, bladeT: 9, bandT: 9 },
  // amfora: svulmen sit HØGT og halsen over — swell-aksen som elles står
  // ubrukt, og den best pakka posen i settet (40 prosent)
  { waist: 0.3, waistZ: 0.78, waistW: 0.22, swell: 0.22, footR: 0.62, taper: 0.85, bladeT: 9, bandT: 9 },
  // sopp: smal fot under vid hatt — foten på 0,57 for mon på veltevinkelen
  { footR: 0.57, swell: 0.14, planR: 250, taper: 0.75, moon: 0.3, bladeT: 10, bandT: 10 },
  // søyla: lite plan i full høgd — proporsjonsaksen, lettast i settet
  { planR: 160, planAsp: 0, footR: 1.05, taper: 1.3, waist: 0.12, blades: 18, seatZ: 480, bladeT: 9, bandT: 9 },
  // blomen: fem flikar i planet — kronblad i staden for oval
  { flikar: 5, flik: 0.18, planN: 2.4, planAsp: 0, blades: 20, waist: 0.18, bladeT: 9, bandT: 9 },
  // krysset: sju tjukke blad og store opningar — beinkryss-enden av
  // typologien, der objektet sluttar å vera skal
  {
    blades: 7, bladeT: 20, bandT: 10, inner: 0.12, waist: 0.12,
    footR: 0.8, hubGap: 5, bandW: 34.5,
  },
]

/** Posane med namna sine — same liste, synlege som inngangar i panelet.
 *  Namnet står her og ikkje inne i kvar pose, so poseBag (terningen) les
 *  lista uendra. Rekkjefylgja er lista over. */
const POSE_NAMN: readonly string[] = [
  "vridd", "timeglas", "amfora", "sopp", "søyla", "blomen", "krysset",
]
export const POSAR: readonly Pose[] = POSES.map((bag, i) => ({
  namn: POSE_NAMN[i] ?? `pose ${i + 1}`,
  bag,
}))

/** Hovuddraga: dei få kontrollane som verkeleg formar. Kvart drag styrer
 *  eitt eller fleire eksisterande band saman — ingen nye parametrar. */
export const HOVUDDRAG: readonly Hovuddrag[] = [
  { id: "hogd", label: "høgd", keys: [["seatZ", 1]] },
  { id: "midje", label: "midje", keys: [["waist", 1], ["waistW", 0.5]] },
  { id: "vriding", label: "vriding", keys: [["twist", 1]] },
  { id: "blad", label: "blad", keys: [["blades", 1]] },
  { id: "band", label: "band", keys: [["bands", 1]] },
  { id: "skaal", label: "skål", keys: [["dish", 1]] },
]

/** Kva to-fingers-rulling på lerretet skrur på. Midja og vridinga er dei
 *  to som endrar kva objektet ER og ikkje berre kva det måler. */
export const NUDGE_PARAMS = { vertical: "waist", horizontal: "twist", pinch: "planR" }

export const clampParams = (o: unknown, prev: Params): Params =>
  clampBag(o, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS) as unknown as Params

// =============================================================================
// TERNINGREPARASJONEN
// =============================================================================
const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** planfaktoren, med flikane — same uttrykk som i skalet, so modellen og
 *  geometrien les same kontur */
const gOfP = (q: Params, th: number) =>
  superR(th, q.planN, q.planAsp) *
  (1 + q.flik * Math.cos(Math.max(0, Math.round(q.flikar)) * th))

/**
 * Aritmetisk modell av det bygde objektet: same silhuett, same
 * kubeinnpassing og same vev- og utnyttingsuttrykk som geometrien, men
 * utan nett — reparasjonen får ikkje kosta eit bygg per steg. Modellen
 * bommar under ein halv millimeter på veven, og terskelane i vassfallet
 * ligg difor to millimeter over regelgrensene.
 */
function model(q: Params) {
  const n = Math.max(3, Math.round(q.blades))
  const rHub = (n * q.bladeT) / TAU + q.hubGap
  const rho = (u0: number) => {
    const u = Math.min(1, Math.max(0, u0))
    const base = q.footR + (1 - q.footR) * smooth(Math.pow(u, q.taper))
    const d = (u - q.waistZ) / Math.max(q.waistW, 1e-6)
    const pinch = 1 - q.waist * Math.exp(-d * d)
    const below = Math.max(0, 1 - u / Math.max(q.waistZ, 1e-6))
    return base * pinch * (1 + q.swell * below * below)
  }
  let rhoMax = 0
  for (let i = 0; i <= 64; i++) rhoMax = Math.max(rhoMax, rho(i / 64))
  // omhyllinga i planet: med flikar ligg ytterpunkta ikkje på aksane
  // lenger, so ho må sveipast — utan flikar er ho eksakt exp(±asp/2)
  let env: number
  if (q.flik > 0) {
    let eX = 0
    let eY = 0
    for (let i = 0; i < 256; i++) {
      const th = (i / 256) * TAU
      const g = gOfP(q, th)
      eX = Math.max(eX, g * Math.abs(Math.cos(th)))
      eY = Math.max(eY, g * Math.abs(Math.sin(th)))
    }
    env = Math.max(eX, eY)
  } else {
    env = Math.max(Math.exp(q.planAsp * 0.5), Math.exp(-q.planAsp * 0.5))
  }
  const want = 496
  const caps = [(want / 2 - q.bladeT / 2) / (env * rhoMax)]
  const m = Math.max(2, Math.round(q.bands))
  for (let j = 0; j < m; j++) {
    const u = q.bandZ0 + ((q.bandZ1 - q.bandZ0) * j) / (m - 1)
    caps.push((want / 2 - q.bandOut) / (env * rho(u)))
  }
  caps.push((want / 2 - q.lip) / (env * rho(1)))
  const R = Math.min(q.planR, ...caps)
  let gMin = Infinity
  const twr = q.twist * DEG
  for (let k = 0; k < n; k++) {
    const phi = (k / n) * TAU
    if (q.flik > 0) {
      // eit vridd blad sveiper frå navvinkelen mot φ+vriding på vegen ut,
      // og med flikar kan dalen liggja midt i sveipet — heile vindauget
      // må prøvast, elles les modellen veven for stor
      for (let s = 0; s <= 6; s++) gMin = Math.min(gMin, gOfP(q, phi + (twr * s) / 6))
    } else {
      gMin = Math.min(gMin, gOfP(q, phi))
    }
  }
  const rInner = (u: number) => {
    if (u <= q.innerZ) return rHub + q.inner * R * smooth(u / Math.max(q.innerZ, 1e-6))
    const t = smooth((u - q.innerZ) / Math.max(1 - q.innerZ, 1e-6))
    return rHub + q.inner * R * Math.max(0.05, 1 + q.innerW * t)
  }
  let web = Infinity
  for (let i = 0; i <= 40; i++) {
    const u = i / 40
    web = Math.min(web, R * gMin * rho(u) - rInner(u))
  }
  const zB = Math.max(60, q.seatZ - q.seatT)
  const arcTop = Math.min(q.footArc, zB * 0.45) / zB
  const mat = MATERIALS[q.material]
  const capC = (mat.fck * KMOD) / GAMMA_M
  const capM = (mat.fmk * KMOD) / GAMMA_M
  const nCarry = Math.max(3, Math.round(n / 4))
  const N = (1600 * 0.6) / nCarry
  const aOf = (u: number) => rInner(u) - rHub
  const bOf = (u: number) => R * gMin * rho(u) - rHub
  const mid = (u: number) => (aOf(u) + bOf(u)) / 2
  // korda er forankra i FOTFLATA (stasjon 0), ikkje i toppen av fotbogen —
  // det er der målinga forankrar henne
  const m0 = bOf(0) - 8 - q.corner
  const m1 = mid(1)
  // i sporhøgdene misser bladet halve overlappen av veven sin
  const lap = Math.max(0, q.bandW - q.bandOut)
  const evalU = (u: number, cut: number) => {
    const a = aOf(u)
    const b = bOf(u) - cut
    const w = b - a
    if (w <= 1) return cut > 0 ? 9 : 0
    const chord = m0 + (m1 - m0) * u
    const e = Math.abs((a + b) / 2 - chord)
    return N / (w * q.bladeT) / capC + (N * e * 6) / (q.bladeT * w * w) / capM
  }
  let util = 0
  for (let i = 0; i <= 40; i++) util = Math.max(util, evalU(arcTop + ((1 - arcTop) * i) / 40, 0))
  for (let j = 0; j < m; j++) {
    const u = q.bandZ0 + ((q.bandZ1 - q.bandZ0) * j) / (m - 1)
    if (u >= arcTop) util = Math.max(util, evalU(u, lap / 2))
  }
  const rFoot = R * gMin * rho(0)
  const arm = rFoot * Math.cos(Math.PI / n)
  const tip = (Math.atan2(arm, q.seatZ - 0.55 * q.dish) * 180) / Math.PI
  return { n, rHub, R, gMin, web, util, tip, rho0: rho(0) }
}

/** klaringa navet MÅ ha for at blada skal gå klar av kvarandre der, løyst
 *  eksakt or same uttrykket regelen måler med — vridinga med forteikn, av
 *  di regelen berre måler mot grannen på +Δ-sida */
const navNeedGap = (q: Params) => {
  const n = Math.max(3, Math.round(q.blades))
  const h = Math.PI / n
  const c = Math.cos(q.twist * DEG + h)
  const rNeed = c > 1e-6 ? q.bladeT / (2 * Math.sin(h) * c) : Infinity
  return rNeed - (n * q.bladeT) / TAU
}

/**
 * Terningreparasjonen. Kastet får falla som det vil, men fleire av krava
 * er SUMAR og KVOTAR av andre parametrar og bryt reglane nesten alltid
 * utan hjelp: skåla mot setetjukna, navet mot vridinga, veven og
 * utnyttinga mot alt på ein gong. Vassfallet rettar berre ulåste
 * skyvarar, alltid innanfor banda, og alltid i same rekkjefylgje — same
 * frø gjev framleis same objekt.
 */
function fiksTerning(q: Params, locked: ReadonlySet<string>): Params {
  const fix = (k: keyof Params, v: number) => {
    if (locked.has(k)) return
    const r = PARAM_RANGES[k as string]
    ;(q as Record<string, number | string>)[k as string] = Math.min(
      r.max,
      Math.max(r.min, r.int ? Math.round(v) : +v.toFixed(3)),
    )
  }
  // sitjehøgda fyrst: ho flytter zBlade som resten les
  if (q.seatZ - 0.78 * q.dish < 383) fix("seatZ", 383 + 0.78 * q.dish)
  // skåla mot setetjukna — den halve millimeteren i monn er ikkje pynt:
  // toFixed(3) på den eksakte grensa fell tilbake i brotet via avrundinga
  if (q.dish > q.seatT - 8) {
    if (!locked.has("dish")) fix("dish", q.seatT - 8.5)
    else fix("seatT", q.dish + 8.5)
  }
  if (q.relief <= q.bit) {
    if (!locked.has("relief")) fix("relief", Math.min(12, q.bit + 1))
    else fix("bit", Math.max(2, q.relief - 1))
  }
  // leddet: overlappen bandW−bandOut skal gje minst 6 mm i kvar del, og
  // bandet skal framleis stikka ut — bandW ≥ 22 held intervallet ope
  if (q.bandOut > q.bandW - 12) fix("bandOut", q.bandW - 12.5)
  if (q.bandOut < 8) fix("bandOut", 8)
  // sporklaringa: glatt omprojisering, ikkje klipp — eit klipp stablar
  // alle kast oppå 0,5 og der ligg regelgrensa
  if (q.fit > 0.5) fix("fit", 0.1 + ((q.fit - 0.05) / 1.15) * 0.4)
  if (q.fit < 0.1) fix("fit", 0.1)

  // navet: fyrst klaringa, og rekk ho ikkje til, vridinga
  const navFix = () => {
    const need = navNeedGap(q)
    if (q.hubGap >= need + 0.2) return
    if (need + 0.3 <= PARAM_RANGES.hubGap.max && !locked.has("hubGap")) {
      fix("hubGap", need + 0.3)
      return
    }
    if (!locked.has("twist")) {
      const n = Math.max(3, Math.round(q.blades))
      const h = Math.PI / n
      const rMax = (n * q.bladeT) / TAU + Math.max(q.hubGap, 0)
      const cosArg = q.bladeT / (2 * Math.sin(h) * rMax)
      const twMax = cosArg < 1 ? (Math.acos(cosArg) - h) / DEG : 0
      fix("twist", Math.sign(q.twist || 1) * Math.max(0, twMax - 1))
      const need2 = navNeedGap(q)
      if (q.hubGap < need2 + 0.2) fix("hubGap", Math.min(PARAM_RANGES.hubGap.max, need2 + 0.3))
    }
  }
  navFix()

  // veven, utnyttinga og veltevinkelen heng saman gjennom R og navet, so
  // dei vert retta i lag: eitt grep per runde, mildaste fyrst
  for (let step = 0; step < 32; step++) {
    const md = model(q)
    const gapFloor = Math.max(0, navNeedGap(q)) + 0.3
    if (md.web >= 26 && md.util <= 0.7 && md.tip >= 16) break
    if (md.web < 26) {
      const d = 26 - md.web
      if (q.hubGap > gapFloor + 0.25 && !locked.has("hubGap")) {
        fix("hubGap", Math.max(gapFloor, q.hubGap - d))
        continue
      }
      if (q.inner > 0.03 && !locked.has("inner")) {
        fix("inner", Math.max(0.02, q.inner - Math.max(0.015, d / Math.max(60, md.R))))
        continue
      }
      if (q.waist > 0.02 && !locked.has("waist")) {
        fix("waist", q.waist * 0.75)
        continue
      }
      if (q.footR < 1.0 && !locked.has("footR")) {
        fix("footR", Math.min(1.0, q.footR + 0.06))
        continue
      }
      if (q.blades > 12 && !locked.has("blades")) {
        fix("blades", q.blades - 2)
        navFix()
        continue
      }
      if (q.planR < 260 && !locked.has("planR")) {
        fix("planR", Math.min(260, q.planR + 20))
        continue
      }
      break
    }
    if (md.util > 0.7) {
      if (q.bandW > Math.max(22, q.bandOut + 12.5) && !locked.has("bandW")) {
        fix("bandW", Math.max(22, q.bandOut + 12.5))
        continue
      }
      if (q.waist > 0.02 && !locked.has("waist")) {
        fix("waist", q.waist * 0.7)
        continue
      }
      if (q.bladeT < 24 && !locked.has("bladeT")) {
        fix("bladeT", q.bladeT + 2)
        navFix()
        continue
      }
      if (q.inner > 0.03 && !locked.has("inner")) {
        fix("inner", Math.max(0.02, q.inner - 0.03))
        continue
      }
      if (q.taper > 1.05 && !locked.has("taper")) {
        fix("taper", 1 + (q.taper - 1) * 0.5)
        continue
      }
      if (q.footArc > 30 && !locked.has("footArc")) {
        fix("footArc", q.footArc * 0.7)
        continue
      }
      break
    }
    if (md.tip < 16) {
      if (q.footR < 1.05 && !locked.has("footR")) {
        fix("footR", Math.min(1.05, q.footR + 0.06))
        continue
      }
      if (q.planR < 260 && !locked.has("planR")) {
        fix("planR", Math.min(260, q.planR + 20))
        continue
      }
      break
    }
  }

  // opninga mellom blada (mjuk): færre blad til opninga ber ein bladtjukn
  const md = model(q)
  const rW = md.R * md.gMin * Math.max(md.rho0, 0.4)
  if (rW > 2 * q.bladeT + 1 && !locked.has("blades")) {
    const nMax = Math.floor(Math.PI / Math.asin(Math.min(1, (q.bladeT + 0.5) / rW)))
    if (Math.round(q.blades) > nMax) {
      fix("blades", nMax)
      navFix()
    }
  }

  // HALSEN, målt og ikkje gissa.
  //
  // Alt over reknar på eit aksesymmetrisk blad. Det held for kuben, navet
  // og veltevinkelen, men ikkje for utnyttinga: der midja dreg ytterkanten
  // inn OG den indre tomkjernen stig ut i same høgda, står det att ein hals
  // på nokre få millimeter i EITT blad — og den halsen finst ikkje i
  // gjennomsnittet modellen les. Verre: spaken ein skulle tru hjelpte gjer
  // det motsette, av di navradien veks med bladtjukna og snører halsen
  // ytterlegare (eit måld kast gjekk frå 104 % til 813 % av seks
  // millimeter tjukkare blad).
  //
  // Difor spør dette siste steget geometrien sjølv. Det kostar ei måling
  // (kring 40 ms mot 1 ms for resten av kastet), og berre dei kasta som
  // faktisk ligg over grensa betalar for fleire. Grepa er dei tre som
  // måling viste er einsretta: mindre midje, mindre tomkjerne og kortare
  // overlapp i sporet — alle gjer objektet mindre ekstremt, aldri meir.
  // Veltevinkelen har same blindsone: modellen reknar vippearmen som
  // fotradien gonga cosinus til halve bladvinkelen, men den verkelege
  // armen går til KONVEKSE HYLSTERET av føtene, og med flikar i planet
  // ligg dalane innanfor det snittet. Difor står han i same lykkja.
  for (let pass = 0; pass < 8; pass++) {
    let m: Metrics
    try {
      m = measure(q)
    } catch {
      break // eit kast som ikkje let seg måle er ikkje eit kast dette steget kan berge
    }
    const halsen = Number.isFinite(m.util) && m.util > 0.95
    const vippen = Number.isFinite(m.tipAngle) && m.tipAngle < 15.5
    if (!halsen && !vippen) break
    let rørt = false
    if (halsen) {
      if (
        (!locked.has("waist") && q.waist > 0.01) ||
        (!locked.has("inner") && q.inner > PARAM_RANGES.inner.min + 0.01) ||
        (!locked.has("bandOut") && q.bandOut < q.bandW - 0.5)
      ) {
        fix("waist", q.waist * 0.55)
        fix("inner", q.inner - 0.05)
        fix("bandOut", q.bandOut + (q.bandW - q.bandOut) * 0.5)
        rørt = true
      }
    }
    if (vippen) {
      // Foten er den einaste spaken som flytter vippearmen utan å røre
      // sitjehøgda — og han rører ikkje omhyllinga heller, av di han er
      // eit FORHOLD til planet og ikkje eit mål. Midja hjelper berre når
      // ho når heilt ned i foten, so ho kjem sist.
      if (!locked.has("footR") && q.footR < PARAM_RANGES.footR.max) {
        fix("footR", Math.min(PARAM_RANGES.footR.max, q.footR + 0.07))
        rørt = true
      } else if (!locked.has("waist") && q.waist > 0.01) {
        fix("waist", q.waist * 0.7)
        rørt = true
      }
    }
    if (!rørt) break
  }
  return q
}

export const randomParams = (
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params =>
  fiksTerning(
    (poseBag(
      rnd,
      prev as unknown as ParamBag,
      POSES as unknown as readonly Partial<Record<string, number | string>>[],
      DEFAULT_PARAMS as unknown as ParamBag,
      PARAM_RANGES,
      PARAM_KEYS,
      locked,
      // reglane til RIBBE er skjøre kring navet: jitteren må vera varsam
      0.025,
    ) as unknown as Params | null) ??
      (randomBag(
        rnd,
        prev as unknown as ParamBag,
        PARAM_RANGES,
        PARAM_KEYS,
        locked,
      ) as unknown as Params),
    locked,
  )
