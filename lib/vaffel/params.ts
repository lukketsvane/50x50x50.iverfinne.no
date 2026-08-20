/**
 * VAFFEL — parameterrommet.
 *
 * Eitt objekt er eitt punkt her inne. Kroppen, bogen, ribbene og ledda er
 * alle funksjonar av desse to og tjue tala, og ingen annan fil i mappa held
 * eit tal som ikkje kjem herifrå.
 *
 * Aksar: X = fram(+)/bak(−), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader ut mot skyvaren.
 *
 * Djupna på ledda står ikkje her. Ho ER halve overlappet, og eit tal for
 * noko som alt er bestemt av geometrien er eit tal som kan kome i utakt med
 * henne. Det einaste som er eit val, er kvar i overlappet delinga ligg.
 */
import {
  clampBag,
  poseBag,
  randomBag,
  type Group,
  type ParamBag,
  type Range,
} from "../core"

export type Params = {
  // --- PLAN: superellipsa kroppen er dratt opp av ------------------------
  planN: number // eksponent: 2 er ellipse, 6 les kuben inn i planet
  planA: number // halve utstrekninga fram og attende, mm
  planB: number // halve utstrekninga på tvers, mm

  // --- SILHUETT: kva planet gjer på vegen opp ----------------------------
  hogd: number // setekanten over golvet, mm
  fot: number // planet ved golvet, del av planet ved setet
  midje: number // innsnøringa i midja, del av planet
  midjeZ: number // høgda for det trongaste, normalisert
  midjeW: number // kor brei innsnøringa er
  skulder: number // kor mykje planet opnar seg att under setekanten

  // --- SETE ---------------------------------------------------------------
  sokk: number // setegropa på det djupaste, mm
  framkant: number // lårlette framme, mm
  kantR: number // setekantradius, mm

  // --- RIBBER -------------------------------------------------------------
  ribbX: number // ribber på tvers av X
  ribbY: number // ribber på tvers av Y
  ribbT: number // ribbetjukn, mm
  pressfit: number // sporet breiare enn ribba, mm
  lapp: number // kvar i overlappet delinga ligg, 0,5 er halvt om halvt

  // --- BOGE: opninga som gjer ribba til bein ------------------------------
  bogeH: number // kor høgt bogen når, del av ribbehøgda
  bogeB: number // kor brei bogen er, del av ribbebreidda
  bogeN: number // bogeeksponent: 2 er ellipse, 4 er nesten firkant

  // --- BYGG ---------------------------------------------------------------
  fresD: number // fresediameter, mm
  material: string
}

export const PARAM_RANGES: Record<string, Range> = {
  planN: { min: 2, max: 6, step: 0.05, label: "planform" },
  planA: { min: 130, max: 245, step: 1, label: "plan djup", unit: "mm" },
  planB: { min: 130, max: 245, step: 1, label: "plan tvers", unit: "mm" },

  hogd: { min: 350, max: 470, step: 1, label: "høgd", unit: "mm" },
  fot: { min: 0.55, max: 1.35, step: 0.005, label: "fot" },
  midje: { min: 0, max: 0.34, step: 0.005, label: "midje" },
  midjeZ: { min: 0.18, max: 0.72, step: 0.005, label: "midjehøgd" },
  midjeW: { min: 0.14, max: 0.62, step: 0.005, label: "midjebreidd" },
  skulder: { min: 0.86, max: 1.16, step: 0.005, label: "skulder" },

  sokk: { min: 0, max: 42, step: 0.5, label: "setegrop", unit: "mm" },
  framkant: { min: 0, max: 26, step: 0.5, label: "lårlette", unit: "mm" },
  kantR: { min: 2, max: 26, step: 0.5, label: "kantradius", unit: "mm" },

  ribbX: { min: 3, max: 15, step: 1, label: "ribber langs X", int: true },
  ribbY: { min: 3, max: 15, step: 1, label: "ribber langs Y", int: true },
  ribbT: { min: 6, max: 24, step: 0.5, label: "ribbetjukn", unit: "mm" },
  pressfit: { min: 0.05, max: 0.4, step: 0.01, label: "pressfit", unit: "mm" },
  lapp: { min: 0.3, max: 0.7, step: 0.01, label: "leddeling" },

  bogeH: { min: 0, max: 0.86, step: 0.005, label: "bogehøgd" },
  bogeB: { min: 0, max: 0.9, step: 0.005, label: "bogebreidd" },
  bogeN: { min: 1.4, max: 5, step: 0.05, label: "bogeform" },

  fresD: { min: 4, max: 12, step: 0.5, label: "fresediameter", unit: "mm" },
}

export const GROUPS: readonly Group[] = [
  { id: "plan", label: "plan", keys: ["planN", "planA", "planB"] },
  {
    id: "silhuett",
    label: "silhuett",
    keys: ["hogd", "fot", "midje", "midjeZ", "midjeW", "skulder"],
  },
  { id: "sete", label: "sete", keys: ["sokk", "framkant", "kantR"] },
  {
    id: "ribber",
    label: "ribber",
    keys: ["ribbX", "ribbY", "ribbT", "pressfit", "lapp"],
  },
  { id: "boge", label: "boge", keys: ["bogeH", "bogeB", "bogeN"] },
  { id: "bygg", label: "bygg", keys: ["fresD"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/**
 * Standarden. Ni ribber kvar veg gjev sytti ledd, og ribbene er tynne av
 * di dei står i eit rutenett: ei plate på 7,5 mm som skal bera åleine er
 * for tynn, men ei som er avstiva kvar fyrtiande millimeter av ei plate på
 * tvers er det ikkje.
 *
 * Midja er grunn med vilje. Ho ser ut som ein smak, men ho er ei grense:
 * bit ho djupare enn fotavtrykket til den ytste ribba er breitt, vert den
 * ribba kutta i to av kroppen sin eigen form, og to lause stykke som heng
 * i naboen er ikkje ein del — dei er to delar som ikkje står i lista.
 */
export const DEFAULT_PARAMS: Params = {
  planN: 4.0,
  planA: 172,
  planB: 180,

  hogd: 432,
  fot: 1.06,
  midje: 0.09,
  midjeZ: 0.44,
  midjeW: 0.26,
  skulder: 1.03,

  sokk: 26,
  framkant: 11,
  kantR: 14,

  ribbX: 9,
  ribbY: 9,
  ribbT: 7.5,
  pressfit: 0.15,
  lapp: 0.5,

  bogeH: 0.62,
  bogeB: 0.60,
  bogeN: 2.6,

  fresD: 6,
  material: "bjork",
}

/** Kuraterte posar: fire handdesigna utgangspunkt terningen jittrar kring. */
export const POSES: readonly Partial<Params>[] = [
  // tett rutenett
  { ribbX: 9, ribbY: 9, ribbT: 8, bogeH: 0.7, bogeB: 0.72 },
  // mjuk sylinder
  { planN: 2.1, planA: 192, planB: 192, midje: 0.04, fot: 1.0, bogeH: 0.5, bogeB: 0.5, ribbX: 8, ribbY: 8, ribbT: 9 },
  // nesten kube
  { planN: 5.8, planA: 200, planB: 200, midje: 0.11, midjeZ: 0.5, midjeW: 0.3, fot: 1.0, bogeH: 0.75, bogeB: 0.8, bogeN: 3.6 },
  // timeglas
  { midje: 0.2, midjeW: 0.45, midjeZ: 0.45, fot: 1.18, skulder: 1.1, bogeH: 0.55 },
]

/** kva to fingrar på lerretet skrur på */
export const NUDGE_PARAMS = { vertical: "hogd", horizontal: "midje" }

export function clampParams(o: unknown, prev: Params): Params {
  return clampBag(o, prev, PARAM_RANGES, PARAM_KEYS)
}

export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const posed = poseBag(rnd, prev, POSES, DEFAULT_PARAMS, PARAM_RANGES, PARAM_KEYS, locked)
  return posed ?? randomBag(rnd, prev, PARAM_RANGES, PARAM_KEYS, locked)
}
