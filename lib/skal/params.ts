/**
 * SANDKASSE — parameterrommet.
 *
 * Eitt objekt er eitt punkt her inne. Ingen ting anna i koden held tal:
 * geometri, mål, kuttark, berekning og teikning er alle funksjonar av
 * `Params`. Difor kan teikning og tabell aldri kome i utakt.
 *
 * Aksar: X = fram(+)/bak(-), Y = sideveg, Z = opp. Alle mål i millimeter,
 * alle vinklar i grader i grensesnittet og radianar inne i motoren.
 */

export const CUBE = 500 // oppgåva sin kube, mm

export type Material = "bjork" | "poppel" | "bok"

export const MATERIALS: Record<
  Material,
  { label: string; rho: number; fmk: number; fck: number }
> = {
  // rho kg/m3 · fm,k og fc,k i MPa, karakteristiske verdiar for kryssfiner
  bjork: { label: "bjørkefinér", rho: 680, fmk: 40, fck: 26 },
  bok: { label: "bøkefinér", rho: 720, fmk: 44, fck: 28 },
  poppel: { label: "poppelkjerne", rho: 460, fmk: 24, fck: 15 },
}

export type Params = {
  // --- SNITT: superellipsa som vandrar oppover ---------------------------
  secN0: number // eksponent ved golvet (2 = ellipse, 8 = nesten rett kant)
  secN1: number // eksponent ved rimet
  asp0: number // akseforhold ved golvet, log-skala: 0 = rundt
  asp1: number // akseforhold i midja
  asp2: number // akseforhold ved rimet

  // --- RYGGRAD: kurva snittsenteret fylgjer ------------------------------
  spineBack: number // kor langt attende senteret går lågt nede (del av R)
  spineFwd: number // kor langt fram det går øvst (del av R)
  spineDir: number // retninga S-en ligg i, grader
  spineBias: number // kor høgt vendepunktet ligg

  // --- VRIDING ------------------------------------------------------------
  twist: number // grader frå golv til rim
  twistBias: number // eksponent: <1 vrir tidleg, >1 vrir seint

  // --- MIDJE --------------------------------------------------------------
  waist: number // innsnøring, del av radien
  waistZ: number // høgda for det trongaste, normalisert
  waistWide: number // kor brei innsnøringa er
  flare: number // kor mykje skalet svulmar ut att under midja
  foot: number // kor mykje snittet snører seg inn mot golvet
  shoulder: number // kor mykje snittet snører seg inn att under setet

  // --- BEIN ---------------------------------------------------------------
  legs: number // tal bein (3–5)
  legGap: number // opningsbreidd mellom beina, grader
  legRise: number // kor høgt beinopningane rekk, normalisert
  legStretch: number // eitt bein dratt lenger ut, del av radien
  legDir: number // retninga det strekte beinet peikar, grader
  legSkew: number // ulik breidd på opningane, 0 = like

  // --- SVEIPET: den fjerde opninga ---------------------------------------
  sweepSpan: number // grader opninga dekkjer
  sweepZ: number // senterhøgd, normalisert
  sweepH: number // halv høgd, normalisert
  sweepDrift: number // kor mange grader senteret vandrar over høgda
  sweepExp: number // superellipse-eksponent: <2 gjev spisse endar
  sweepDir: number // kvar sveipet startar, grader

  // --- RIM OG RYGG --------------------------------------------------------
  rimWave: number // bylgja i øvre kant, mm
  rimPhase: number // grader
  finRise: number // kor høgt ryggen reiser seg over setet, mm
  finLean: number // kor mykje han lener seg innover
  finWide: number // kor brei ryggen er, grader
  finDir: number // kvar ryggen står, grader

  // --- SETE ---------------------------------------------------------------
  seatZ: number // setehøgd, mm
  dish: number // skåldjupn, mm
  dishExp: number // >2 gjev flat botn og bratt kant
  saddle: number // sal: grunnare på tvers enn på langs
  saddleDir: number // grader
  lip: number // kor mykje setekanten stikk ut over skalet, mm

  // --- BYGG ---------------------------------------------------------------
  // Talet på lag er ikkje ein parameter. Det er høgda delt på platetjukna,
  // og det er den rette vegen: ein vel plata, ikkje talet.
  plyT: number // platetjukn, mm
  shellT: number // skaltjukn, mm
  edgeT: number // tjukn ved eggkanten av opningane, mm
  sand: number // slipemon på ytterkanten, mm
  material: Material
}

export type ParamKey = Exclude<keyof Params, "material">

export type Range = {
  min: number
  max: number
  step: number
  label: string
  unit?: string
  int?: boolean
}

export const PARAM_RANGES: Record<ParamKey, Range> = {
  secN0: { min: 2, max: 8, step: 0.05, label: "snitt nede" },
  secN1: { min: 2, max: 8, step: 0.05, label: "snitt oppe" },
  asp0: { min: -0.45, max: 0.45, step: 0.005, label: "akse nede" },
  asp1: { min: -0.7, max: 0.7, step: 0.005, label: "akse midje" },
  asp2: { min: -0.45, max: 0.45, step: 0.005, label: "akse oppe" },

  spineBack: { min: 0, max: 0.3, step: 0.002, label: "ryggrad attende" },
  spineFwd: { min: 0, max: 0.4, step: 0.002, label: "ryggrad fram" },
  spineDir: { min: 0, max: 360, step: 1, label: "ryggrad retning", unit: "°" },
  spineBias: { min: 0.25, max: 0.85, step: 0.005, label: "vendepunkt" },

  twist: { min: -150, max: 150, step: 1, label: "vriding", unit: "°" },
  twistBias: { min: 0.5, max: 2.2, step: 0.01, label: "vriding forløp" },

  waist: { min: 0, max: 0.58, step: 0.005, label: "midje" },
  waistZ: { min: 0.2, max: 0.85, step: 0.005, label: "midjehøgd" },
  waistWide: { min: 0.12, max: 0.7, step: 0.005, label: "midjebreidd" },
  flare: { min: 0, max: 0.45, step: 0.005, label: "fotsvulm" },
  foot: { min: 0, max: 0.42, step: 0.005, label: "fotinnsnitt" },
  shoulder: { min: 0, max: 0.34, step: 0.005, label: "skulder" },

  legs: { min: 3, max: 5, step: 1, label: "bein", int: true },
  legGap: { min: 34, max: 118, step: 1, label: "beinopning", unit: "°" },
  legRise: { min: 0.18, max: 0.78, step: 0.005, label: "beinhøgd" },
  legStretch: { min: 0, max: 0.5, step: 0.005, label: "strekt bein" },
  legDir: { min: 0, max: 360, step: 1, label: "beinretning", unit: "°" },
  legSkew: { min: 0, max: 0.5, step: 0.005, label: "ulike bein" },

  sweepSpan: { min: 40, max: 250, step: 1, label: "sveip", unit: "°" },
  sweepZ: { min: 0.34, max: 0.94, step: 0.005, label: "sveiphøgd" },
  sweepH: { min: 0.04, max: 0.32, step: 0.002, label: "sveipbreidd" },
  sweepDrift: { min: -140, max: 140, step: 1, label: "sveipvandring", unit: "°" },
  sweepExp: { min: 1.1, max: 3.4, step: 0.02, label: "sveipeksponent" },
  sweepDir: { min: 0, max: 360, step: 1, label: "sveipretning", unit: "°" },

  rimWave: { min: 0, max: 70, step: 0.5, label: "rimbylgje", unit: "mm" },
  rimPhase: { min: 0, max: 360, step: 1, label: "rimfase", unit: "°" },
  finRise: { min: 0, max: 130, step: 1, label: "rygg", unit: "mm" },
  finLean: { min: 0, max: 0.5, step: 0.005, label: "rygglen" },
  finWide: { min: 24, max: 150, step: 1, label: "ryggbreidd", unit: "°" },
  finDir: { min: 0, max: 360, step: 1, label: "ryggretning", unit: "°" },

  seatZ: { min: 330, max: 470, step: 1, label: "setehøgd", unit: "mm" },
  dish: { min: 8, max: 76, step: 0.5, label: "skåldjupn", unit: "mm" },
  dishExp: { min: 1.5, max: 5.2, step: 0.02, label: "skålform" },
  saddle: { min: 0, max: 0.55, step: 0.005, label: "sal" },
  saddleDir: { min: 0, max: 180, step: 1, label: "salretning", unit: "°" },
  lip: { min: 0, max: 5, step: 0.1, label: "setekant", unit: "mm" },

  plyT: { min: 8, max: 25, step: 0.5, label: "platetjukn", unit: "mm" },
  shellT: { min: 8, max: 26, step: 0.5, label: "skaltjukn", unit: "mm" },
  edgeT: { min: 2, max: 12, step: 0.5, label: "eggkant", unit: "mm" },
  sand: { min: 0, max: 4, step: 0.1, label: "slipemon", unit: "mm" },
}

/**
 * SKAL — objektet i mappa, målt tilbake inn i dette rommet. Det er
 * utgangspunktet, ikkje ein «preset»: sandkassen har ingen meny av former,
 * berre eitt punkt du alt står i.
 */
export const DEFAULT_PARAMS: Params = {
  secN0: 3.1,
  secN1: 2.6,
  asp0: 0.06,
  asp1: 0.36,
  asp2: 0.04,

  spineBack: 0.062,
  spineFwd: 0.115,
  spineDir: 18,
  spineBias: 0.44,

  twist: 78,
  twistBias: 1.15,

  waist: 0.28,
  waistZ: 0.56,
  waistWide: 0.42,
  flare: 0.05,
  foot: 0.3,
  shoulder: 0.08,

  legs: 3,
  legGap: 62,
  legRise: 0.44,
  legStretch: 0.34,
  legDir: 24,
  legSkew: 0.16,

  sweepSpan: 175,
  sweepZ: 0.63,
  sweepH: 0.135,
  sweepDrift: 58,
  sweepExp: 1.72,
  sweepDir: 196,

  rimWave: 40,
  rimPhase: 116,
  finRise: 100,
  finLean: 0.3,
  finWide: 110,
  finDir: 206,

  seatZ: 380,
  dish: 42,
  dishExp: 2.4,
  saddle: 0.26,
  saddleDir: 34,
  lip: 1,

  plyT: 15,
  shellT: 13,
  edgeT: 3,
  sand: 2.2,
  material: "bjork",
}

export const GROUPS: readonly { id: string; label: string; keys: ParamKey[] }[] = [
  { id: "snitt", label: "snitt", keys: ["secN0", "secN1", "asp0", "asp1", "asp2"] },
  {
    id: "ryggrad",
    label: "ryggrad og vriding",
    keys: ["spineBack", "spineFwd", "spineDir", "spineBias", "twist", "twistBias"],
  },
  {
    id: "midje",
    label: "midje og fot",
    keys: ["waist", "waistZ", "waistWide", "flare", "foot", "shoulder"],
  },
  {
    id: "bein",
    label: "bein",
    keys: ["legs", "legGap", "legRise", "legStretch", "legDir", "legSkew"],
  },
  {
    id: "sveip",
    label: "sveipet",
    keys: ["sweepSpan", "sweepZ", "sweepH", "sweepDrift", "sweepExp", "sweepDir"],
  },
  {
    id: "rim",
    label: "rim og rygg",
    keys: ["rimWave", "rimPhase", "finRise", "finLean", "finWide", "finDir"],
  },
  {
    id: "sete",
    label: "sete",
    keys: ["seatZ", "dish", "dishExp", "saddle", "saddleDir", "lip"],
  },
  { id: "bygg", label: "bygg", keys: ["plyT", "shellT", "edgeT", "sand"] },
]

export const PARAM_KEYS = GROUPS.flatMap((g) => g.keys)

/** Kva to-fingers-rulling på lerretet skrur på. */
export const NUDGE_PARAMS = {
  vertical: "waist" as ParamKey,
  horizontal: "twist" as ParamKey,
}

/** typesikker skriving av eit talfelt */
const setNum = (o: Params, k: ParamKey, v: number) => {
  ;(o as unknown as Record<ParamKey, number>)[k] = v
}

const clamp1 = (v: number, r: Range) => {
  if (!Number.isFinite(v)) return NaN
  const c = Math.min(r.max, Math.max(r.min, v))
  return r.int ? Math.round(c) : +c.toFixed(4)
}

/**
 * URL-hashen er ikkje til å stole på. Kvart felt vert lese for seg,
 * klemt inn i sitt eige band, og alt som ikkje er eit tal fell tilbake
 * til det som stod frå før — ingen laga lenkje kan skyve NaN inn i motoren.
 */
export function clampParams(o: unknown, prev: Params): Params {
  if (!o || typeof o !== "object") return prev
  const rec = o as Record<string, unknown>
  const out = { ...prev }
  for (const k of PARAM_KEYS) {
    const raw = rec[k]
    if (typeof raw !== "number") continue
    const v = clamp1(raw, PARAM_RANGES[k])
    if (Number.isFinite(v)) setNum(out, k, v)
  }
  if (typeof rec.material === "string" && rec.material in MATERIALS) {
    out.material = rec.material as Material
  }
  return out
}

/** Terningen: nye tal innanfor grensene, låste nøklar rører seg ikkje. */
export function randomParams(
  rnd: () => number,
  prev: Params,
  locked: ReadonlySet<string> = new Set(),
): Params {
  const out = { ...prev }
  for (const k of PARAM_KEYS) {
    if (locked.has(k)) continue
    const r = PARAM_RANGES[k]
    // trekk mot midten av bandet: reine uniforme trekk gjev for mange
    // objekt som ligg og skrapar mot ei grense
    const t = (rnd() + rnd() + rnd()) / 3
    setNum(out, k, clamp1(r.min + t * (r.max - r.min), r))
  }
  return out
}

/** Deterministisk PRNG, slik at éin frøtekst alltid gjev same objekt. */
export function seeded(seed: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return () => {
    h ^= h << 13
    h >>>= 0
    h ^= h >> 17
    h ^= h << 5
    h >>>= 0
    return h / 4294967296
  }
}
