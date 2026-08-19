/**
 * SANDKASSE — det alle motorane deler.
 *
 * Fire typologiar står i denne sandkassen, og dei er ikkje fire former.
 * Dei er fire måtar å byggje ei krum flate av flate plater:
 *
 *   RIBBE   radiale blad og vassrette band, kryssholdte i kvarandre
 *   VAFFEL  dei same ribbene lagde i to rette retningar i staden for radialt
 *   SKAL    vassrette lamellar stabla og slipte ned til éi flate
 *   STRAUM  éin kropp skoren i skrå skiveplan, finnar sette i spor
 *
 * Kvar av dei har si eiga likning, sitt eige parameterrom og sine eigne
 * ledd. Det dei deler er denne fila: kva eit måltal er, kva ein regel er,
 * kva eit band rundt ein skyvar er, og kva ein motor må kunne svare på for
 * å få stå på scena. Grensesnittet, den delbare lenkja og måltavla kjenner
 * berre kontrakten her — ikkje ein einaste av dei fire.
 */

export const CUBE = 500 // oppgåva sin kube, mm

export type Pt = [number, number]
export type Vec3 = [number, number, number]

// =============================================================================
// MATERIALE
// =============================================================================
export type Material = "bjork" | "poppel" | "bok"

export const MATERIALS: Record<
  Material,
  { label: string; rho: number; fmk: number; fck: number }
> = {
  // rho kg/m³ · fm,k og fc,k i MPa, karakteristiske verdiar for finér
  bjork: { label: "bjørkefinér", rho: 680, fmk: 40, fck: 26 },
  bok: { label: "bøkefinér", rho: 720, fmk: 44, fck: 28 },
  poppel: { label: "poppelkjerne", rho: 460, fmk: 24, fck: 15 },
}

/** NS-EN 1728, kontraktnivå: 1600 N konsentrert på setet. */
export const SEAT_LOAD = 1600
/** NS-EN 1995-1-1: kmod for klasse 1 og korttidslast, og materialfaktoren. */
export const KMOD = 0.8
export const GAMMA_M = 1.2

// =============================================================================
// PARAMETERROM
// =============================================================================
export type Range = {
  min: number
  max: number
  step: number
  label: string
  unit?: string
  int?: boolean
}

export type Group = { id: string; label: string; keys: readonly string[] }

/**
 * Ein parametersats slik grensesnittet ser han: berre tal, pluss materialet.
 * Kvar motor har sin eigen typa versjon inne i seg; det er berre på vegen ut
 * til panelet og URL-en at han vert lesen som ein sekk med nøklar.
 */
export type ParamBag = Record<string, number | string>

const clamp1 = (v: number, r: Range) => {
  if (!Number.isFinite(v)) return NaN
  const c = Math.min(r.max, Math.max(r.min, v))
  return r.int ? Math.round(c) : +c.toFixed(4)
}

/**
 * URL-hashen er ikkje til å stole på. Kvart felt vert lese for seg, klemt
 * inn i sitt eige band, og alt som ikkje er eit tal fell tilbake til det som
 * stod frå før — inga laga lenkje kan skyve NaN inn i ein motor.
 */
export function clampBag<P extends ParamBag>(
  o: unknown,
  prev: P,
  ranges: Record<string, Range>,
  keys: readonly string[],
): P {
  if (!o || typeof o !== "object") return prev
  const rec = o as Record<string, unknown>
  const out = { ...prev } as Record<string, number | string>
  for (const k of keys) {
    const raw = rec[k]
    if (typeof raw !== "number") continue
    const v = clamp1(raw, ranges[k])
    if (Number.isFinite(v)) out[k] = v
  }
  if (typeof rec.material === "string" && rec.material in MATERIALS) {
    out.material = rec.material
  }
  return out as P
}

/** Terningen: nye tal innanfor grensene, låste nøklar rører seg ikkje. */
export function randomBag<P extends ParamBag>(
  rnd: () => number,
  prev: P,
  ranges: Record<string, Range>,
  keys: readonly string[],
  locked: ReadonlySet<string> = new Set(),
): P {
  const out = { ...prev } as Record<string, number | string>
  for (const k of keys) {
    if (locked.has(k)) continue
    const r = ranges[k]
    // Trekk mot midten av bandet. Reine uniforme trekk gjev for mange
    // objekt som ligg og skrapar mot ei grense, og eit objekt som ligg
    // mot grensa er som regel eit objekt som bryt ein regel.
    const t = (rnd() + rnd() + rnd()) / 3
    out[k] = clamp1(r.min + t * (r.max - r.min), r)
  }
  return out as P
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

/** Norsk desimalskiljeteikn. Eit tal med punktum i ein norsk tabell les som
 *  eit tal henta frå eit anna dokument. */
export const nn = (v: number, d = 0) =>
  Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "–"

// =============================================================================
// MÅLTAL
// =============================================================================
/** Eit måltal med ferdig sats. Formateringa skjer i motoren og ikkje i
 *  grensesnittet: målinga går i ein worker, og ein funksjon kan ikkje sendast
 *  gjennom postMessage — han ville drepe heile meldinga. */
export type Metric = {
  id: string
  label: string
  value: number
  unit: string
  /** talet slik det skal stå på skjermen, med komma og eining */
  text: string
}

/**
 * Det kvar motor må kunne måle. Ein typologi som ikkje kan svare på desse
 * elleve gruppene er ikkje eit sitjemøbel — han er ein skulptur, og då høyrer
 * han heime i det andre studioet.
 */
export type Metrics = {
  envX: number // ytre mål, mm
  envY: number
  envZ: number
  clearX: number // det som er att til 500-kuben, mm
  clearY: number
  clearZ: number

  seatZ: number // høgda på setekanten, mm
  sitZ: number // der ein faktisk sit, mm
  seatW: number // brukbar sitjeflate på tvers, mm
  seatD: number // brukbar sitjeflate fram og attende, mm

  footX: number // fotavtrykket sin omsluttande boks, mm
  footY: number
  footArea: number // støtteflata, altså det konvekse hylsteret, mm²
  contacts: number // kor mange skilde flater objektet står på
  comZ: number // tyngdepunktet over golvet, mm
  tipArm: number // kortaste vippearm frå setesenteret, mm
  tipAngle: number // veltevinkel, grader

  minSecArea: number // det styrande vassrette tverrsnittet, mm²
  minSecZ: number // høgda det ligg i, mm
  sigmaC: number // trykkspenning, MPa
  sigmaM: number // bøyespenning, MPa
  capC: number // trykkapasitet, MPa
  capM: number // bøyekapasitet, MPa
  util: number // samla utnytting, 0–1

  volume: number // godsvolum, mm³
  mass: number // ferdig masse, kg
  massCut: number // masse som kutta, kg

  parts: number // tal delar
  plyArea: number // finérareal i alt, mm²
  /** kva den einskilde typologien tel som «lag»: lamellar, blad, finnar */
  units: number
  unitLabel: string

  list: Metric[] // alt over, i tabellrekkjefylgje
}

// =============================================================================
// REGLAR
// =============================================================================
/**
 * Det som skil ein reiskap frå ein demonstrasjon er om han seier nei.
 * `hard` tyder at objektet bryt oppgåva eller ikkje kan byggjast; ein mjuk
 * regel er eit val som skal stå på papiret i staden for i hovudet.
 */
export type Rule = {
  id: string
  label: string
  ok: boolean
  hard: boolean
  value: string
  why: string
}

// =============================================================================
// NETT
// =============================================================================
export type MeshData = {
  positions: Float32Array<ArrayBufferLike>
  normals: Float32Array<ArrayBufferLike>
  tris: number
  min: Vec3
  max: Vec3
}

export type DetailKey = "lav" | "mid" | "hog"

/** Dei tre lesemåtane av eit og same objekt. Kva dei tyder er opp til
 *  motoren: for SKAL er «lag» stabelen som kutta, for STRAUM er det dei 24
 *  finnane, for RIBBE blada og banda kvar for seg. */
export type View = "flate" | "lag" | "kontur"

export type ExportKind = "stl" | "dxf" | "svg" | "ark"

export type BuildOut = {
  positions: Float32Array<ArrayBufferLike>
  normals: Float32Array<ArrayBufferLike>
  tris: number
  min: Vec3
  max: Vec3
  lines: Float32Array<ArrayBufferLike>
  heavy: Float32Array<ArrayBufferLike>
}

export type ExportOut = {
  name: string
  mime: string
  text?: string
  data?: ArrayBuffer
}

// =============================================================================
// MOTORKONTRAKTEN
// =============================================================================
export type EngineId = "skal" | "straum" | "ribbe" | "vaffel"

export type EngineDef = {
  id: EngineId
  /** kort namn i nedtrekket */
  label: string
  /** éi line om kva produksjonsvegen er — det er han som skil typologiane */
  note: string
  ranges: Record<string, Range>
  groups: readonly Group[]
  keys: readonly string[]
  defaults: ParamBag
  /** kva to-fingers-rulling på lerretet skrur på */
  nudge: { vertical: string; horizontal: string }
  /** namnet på det motoren tel: «lag», «blad», «finnar» */
  unitLabel: string

  clamp(o: unknown, prev: ParamBag): ParamBag
  random(rnd: () => number, prev: ParamBag, locked: ReadonlySet<string>): ParamBag
  build(p: ParamBag, detail: DetailKey, view: View): BuildOut
  measure(p: ParamBag): Metrics
  rules(p: ParamBag, m: Metrics): Rule[]
  exportFile(p: ParamBag, what: ExportKind): ExportOut
}

// =============================================================================
// GEOMETRI SOM ALLE FIRE TRENG
// =============================================================================
const cross = (o: Pt, a: Pt, b: Pt) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/**
 * Monotone kjeder (Andrew). Punkta vert sorterte etter x, så vert nedre og
 * øvre kjede bygde med ein stakk der alle høgresvingar fell ut. Resultatet
 * er mot klokka, og det er den orienteringa avstandsrekninga byggjer på:
 * innsida ligg til venstre for kvar retta kant.
 */
export function hull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice()
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lo: Pt[] = []
  const hi: Pt[] = []
  for (const q of p) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop()
    lo.push(q)
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop()
    hi.push(q)
  }
  lo.pop()
  hi.pop()
  return lo.concat(hi)
}

export function hullArea(h: Pt[]): number {
  let a = 0
  for (let i = 0; i < h.length; i++) {
    const b = h[(i + 1) % h.length]
    a += h[i][0] * b[1] - b[0] * h[i][1]
  }
  return Math.abs(a) / 2
}

/** Kortaste avstand frå eit punkt til kanten av eit konvekst hylster.
 *  Negativ når punktet ligg utanfor — då står objektet ikkje under seg sjølv. */
export function armToHull(h: Pt[], x: number, y: number): number {
  if (h.length < 3) return 0
  let best = Infinity
  for (let i = 0; i < h.length; i++) {
    const a = h[i]
    const b = h[(i + 1) % h.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    // mot klokka: innsida er til venstre, så positiv er innanfor
    const d = ((x - a[0]) * dy - (y - a[1]) * dx) / L
    if (-d < best) best = -d
  }
  return best
}

export function shoelace(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const b = poly[(i + 1) % poly.length]
    a += poly[i][0] * b[1] - b[0] * poly[i][1]
  }
  return a / 2
}

export function bbox(poly: Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const q of poly) {
    if (q[0] < x0) x0 = q[0]
    if (q[0] > x1) x1 = q[0]
    if (q[1] < y0) y0 = q[1]
    if (q[1] > y1) y1 = q[1]
  }
  return { x0, y0, x1, y1 }
}

/** Superellipse-radius for eksponent n og akseforhold gjeve i log-skala. */
export function superR(th: number, n: number, asp: number): number {
  const A = Math.exp(asp * 0.5)
  const B = Math.exp(-asp * 0.5)
  const c = Math.abs(Math.cos(th) / A)
  const s = Math.abs(Math.sin(th) / B)
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n)
}

/** kortaste vinkelavstand, alltid i (-π, π] */
export function wrapPi(a: number): number {
  const TAU = Math.PI * 2
  let x = a % TAU
  if (x > Math.PI) x -= TAU
  if (x <= -Math.PI) x += TAU
  return x
}

export const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * (3 - 2 * u)
}

/**
 * Volum og fyrste moment om golvet, av divergenssetninga. Nettet må vera
 * lukka og samstemt orientert; er det to skal som gjennomtrengjer kvarandre,
 * vert overlappen talt to gonger, og det skal seiast der det skjer.
 */
export function meshVolume(m: { positions: Float32Array; tris: number }): [number, number] {
  let v = 0
  let mz = 0
  const P = m.positions
  for (let t = 0; t < m.tris; t++) {
    const i = t * 9
    const ax = P[i]
    const ay = P[i + 1]
    const az = P[i + 2]
    const bx = P[i + 3]
    const by = P[i + 4]
    const bz = P[i + 5]
    const cx = P[i + 6]
    const cy = P[i + 7]
    const cz = P[i + 8]
    const d =
      ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
    v += d / 6
    mz += (d / 24) * (az + bz + cz)
  }
  return [v, mz]
}

/** dei fire kapasitetstala som alle motorane reknar mot */
export function capacities(mat: Material) {
  const m = MATERIALS[mat]
  return { capC: (m.fck * KMOD) / GAMMA_M, capM: (m.fmk * KMOD) / GAMMA_M, rho: m.rho }
}

/** sats av eit måltal: teksten som skal stå på skjermen */
export function metric(
  id: string,
  label: string,
  value: number,
  unit: string,
  text: string,
): Metric {
  return { id, label, value, unit, text }
}
