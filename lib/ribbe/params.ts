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
  randomBag,
  type Group,
  type Material,
  type ParamBag,
  type Range,
} from "../core"

/** Params må vera tildelbar til ParamBag, difor eit type-alias og ikkje
 *  eit interface: eit interface har ingen indekssignatur og let seg ikkje
 *  lesa som ein sekk med nøklar på vegen ut til panelet. */
export type Params = {
  // --- PLAN: superellipsa objektet er dratt opp av ------------------------
  planN: number // eksponent: 2 er ellipse, 6 les kuben tilbake inn i planet
  planAsp: number // akseforhold i log-skala; 0 er rundt
  planR: number // nominell plan-radius, mm — vert klemd ned av kuben

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

  footR: { min: 0.4, max: 1.05, step: 0.005, label: "fotbreidd" },
  taper: { min: 0.5, max: 2.4, step: 0.01, label: "silhuettforløp" },
  waist: { min: 0, max: 0.36, step: 0.005, label: "midje" },
  waistZ: { min: 0.2, max: 0.85, step: 0.005, label: "midjehøgd" },
  waistW: { min: 0.12, max: 0.7, step: 0.005, label: "midjebreidd" },
  swell: { min: 0, max: 0.3, step: 0.005, label: "fotsvulm" },

  blades: { min: 10, max: 34, step: 1, label: "blad", int: true },
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
  lip: { min: 0, max: 26, step: 0.5, label: "overheng", unit: "mm" },

  fit: { min: 0.05, max: 1.2, step: 0.05, label: "sporklaring", unit: "mm" },
  relief: { min: 3, max: 12, step: 0.5, label: "avlasting", unit: "mm" },
  corner: { min: 0, max: 14, step: 0.5, label: "hjørneradius", unit: "mm" },
  bit: { min: 2, max: 10, step: 0.5, label: "fresediameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "plan", label: "plan", keys: ["planN", "planAsp", "planR"] },
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
  { id: "sete", label: "sete", keys: ["seatZ", "seatT", "dish", "moon", "moonR", "lip"] },
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

  footR: 0.72,
  taper: 1,
  waist: 0.26,
  waistZ: 0.52,
  waistW: 0.34,
  swell: 0.05,

  blades: 22,
  bladeT: 15,
  twist: 0,
  inner: 0.17,
  innerZ: 0.45,
  innerW: 0.8,
  footArc: 93,
  hubGap: 3.5,

  bands: 3,
  bandZ0: 0.13,
  bandZ1: 0.85,
  bandT: 15,
  bandW: 40,
  bandOut: 16,

  seatZ: 448,
  seatT: 22,
  dish: 14,
  moon: 0.18,
  moonR: 1.1,
  lip: 8,

  fit: 0.3,
  relief: 6,
  corner: 6,
  bit: 3,

  material: "bjork",
}

/** Kva to-fingers-rulling på lerretet skrur på. Midja og vridinga er dei
 *  to som endrar kva objektet ER og ikkje berre kva det måler. */
export const NUDGE_PARAMS = { vertical: "waist", horizontal: "twist" }

export const clampParams = (o: unknown, prev: Params): Params =>
  clampBag(o, prev as unknown as ParamBag, PARAM_RANGES, PARAM_KEYS) as unknown as Params

export const randomParams = (
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params =>
  randomBag(
    rnd,
    prev as unknown as ParamBag,
    PARAM_RANGES,
    PARAM_KEYS,
    locked,
  ) as unknown as Params
