/**
 * STRAUM — kroppen.
 *
 * Objektet er ikkje ei skisse. Det er éin kropp: ei superellipse som
 * morfar oppover, vrir seg om si eiga akse og skyv senteret sitt framover
 * på vegen. Åtte kontrollsnitt er lagde inn, og alt imellom dei er ein
 * naturleg kubisk spline — nett difor er forma mjuk og ikkje stykkevis.
 *
 * Alt i denne fila er reine funksjonar av `Params`. Finnane, sokkelen,
 * kappa, måltala og teikninga les herifrå og ingen annan stad.
 *
 *   θ  vinkel kring aksen, verdsfast (0 = +X = framover)
 *   z  høgd i millimeter over golvet
 *   t  z normalisert mot høgda, [0,1]
 *
 * Skiveplana bur òg her. Eit plan er ein u = konstant, der u er avstanden
 * langs planormalen; normalen ligg `skraa` grader over vassrett, og planet
 * dreiar om høgda `planSenter`. Difor er kvar finne framleis flat.
 */
import { CUBE, keep, superR, smooth, type Pt, type Vec3 } from "../core"
import type { Params } from "./params"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** kor mykje av kuben som skal stå att som luft når objektet må krympast */
const FIT_MARGIN = 2

// =============================================================================
// NATURLEG KUBISK SPLINE
// =============================================================================
/**
 * Naturleg kubisk spline gjennom (xs, ys) — andrederiverte null i endane.
 * Tjue linjer, og han er heile skilnaden mellom ei form som er mjuk og ei
 * som er stykkevis: ein lineær interpolant gjev eit knekk i kvart
 * kontrollsnitt, og eit knekk i snittet vert ei kant i den freste flata.
 */
function splineOf(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  const m = new Array<number>(n).fill(0)
  const u = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const sig = (xs[i] - xs[i - 1]) / (xs[i + 1] - xs[i - 1])
    const pp = sig * m[i - 1] + 2
    m[i] = (sig - 1) / pp
    const d =
      (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) -
      (ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1])
    u[i] = ((6 * d) / (xs[i + 1] - xs[i - 1]) - sig * u[i - 1]) / pp
  }
  for (let i = n - 2; i >= 0; i--) m[i] = m[i] * m[i + 1] + u[i]
  return (x: number) => {
    let lo = 0
    let hi = n - 1
    if (x <= xs[0]) return ys[0] + ((ys[1] - ys[0]) / (xs[1] - xs[0])) * (x - xs[0])
    if (x >= xs[n - 1]) {
      return (
        ys[n - 1] +
        ((ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2])) * (x - xs[n - 1])
      )
    }
    while (hi - lo > 1) {
      const k = (hi + lo) >> 1
      if (xs[k] > x) hi = k
      else lo = k
    }
    const h = xs[hi] - xs[lo]
    const a = (xs[hi] - x) / h
    const b = (x - xs[lo]) / h
    return (
      a * ys[lo] +
      b * ys[hi] +
      (((a * a * a - a) * m[lo] + (b * b * b - b) * m[hi]) * h * h) / 6
    )
  }
}

// =============================================================================
// KROPPEN
// =============================================================================
export type Frame = {
  /** planormalen */
  n: Vec3
  /** vassrett retning i planet */
  e1: Vec3
  /** oppoverretning i planet, `skraa` grader ut av loddrett */
  e2: Vec3
  cosA: number
  sinA: number
  cosF: number
  sinF: number
  zPivot: number
}

export type Body = {
  p: Params
  H: number
  /** plan-skala etter innpassinga i kuben; 1 når objektet gjekk inn som det var */
  scale: number

  /** halvakse i X ved høgda t ∈ [0,1], mm */
  ax(t: number): number
  /** halvakse i Y, mm */
  ay(t: number): number
  /** vridinga i radianar */
  tw(t: number): number
  /** superellipse-eksponenten */
  nExp(t: number): number
  /** senterskyv i X, mm */
  ctr(z: number): Pt

  /** ytre radius frå snittsenteret slik plata vert kutta, mm */
  ro(th: number, z: number): number
  /** ferdig ytterpunkt i verdskoordinatar, med setekanten avrunda */
  outer(th: number, z: number): Vec3
  /** utoverpeikande einingsnormal på ytterflata */
  normal(th: number, z: number): Vec3

  voidZ0: number
  voidZ1: number
  /** radius til tomrommet frå snittsenteret; 0 der kroppen er massiv */
  ri(th: number, z: number): number

  /** salen: høgda på setet over eit punkt i planet */
  seatTop(x: number, y: number): number
  /** der ytterflata møter salen, mm */
  zTop(th: number): number

  /** ytterkonturen ved høgda z som lukka polygon, med valfritt mon på radien */
  sectionPoly(z: number, nth?: number, grow?: number): Pt[]
  /** tomromskonturen ved høgda z, eller null der kroppen er massiv */
  voidPoly(z: number, nth?: number): Pt[] | null

  frame: Frame
  /** skiveplana sine u-verdiar, i rekkjefylgje */
  planes: number[]
  /** finnedelinga målt vassrett, mm */
  pitch: number
  /** frå plankoordinat til verda */
  toWorld(u: number, a: number, b: number): Vec3
  /** høgda til (u, b) */
  zOf(u: number, b: number): number
  /** b-verdien som gjev høgda z i planet u */
  bOf(u: number, z: number): number
}

/** dei åtte kontrollsnitta, som delar av vegen frå golv til sete */
const NODE_T = [0, 0.055, 0.19, 1, 1, 1, 1, 1] // dei fire siste vert sette under
/** kor mykje av spranget frå midje til sete som er teke ut i kvart snitt */
const UP_FRAC = [0.22, 0.46, 0.75]
/** senterskyven, som del av (fot − midje) på djupna */
const SHIFT_PROFILE = [0, 0.02, 0.09, 0.2, 0.16, 0.07, -0.04, -0.18]

const KROPP_HUGS = keep<Body>(3)
/** Kroppen for eit punkt vert reist éin gong og lese av bygg, mål og reglar. */
export function makeBody(p: Params): Body {
  return KROPP_HUGS(JSON.stringify(p), () => makeBodyRaw(p))
}

function makeBodyRaw(p: Params): Body {
  const H = p.hogd
  const wT = Math.min(0.72, Math.max(0.12, p.midjeH))
  const alpha = p.skraa * DEG
  const phi = p.planRetning * DEG

  // --- snittabellen ------------------------------------------------------
  const ts = NODE_T.slice()
  ts[3] = wT
  for (let k = 0; k < 3; k++) ts[4 + k] = wT + (1 - wT) * [0.3, 0.55, 0.8][k]
  ts[7] = 1

  const build = (foot: number, waist: number, seat: number) => {
    const v = new Array<number>(8)
    v[0] = foot
    v[1] = foot * 1.025
    v[2] = foot + (waist - foot) * 0.28
    v[3] = waist
    for (let k = 0; k < 3; k++) v[4 + k] = waist + (seat - waist) * UP_FRAC[k]
    v[7] = seat
    // MAGE: ei gaussisk bule på kontrollverdiane kring magehøgda — amfora,
    // klokke og pære er denne eine linja. Verdiane er halvaksar, difor
    // mage/2. Millimeterane vert lagde på FØR innpassinga, so plana held
    // seg eksakt lineær i skalafaktoren; golvet på 6 mm hindrar at ei stor
    // negativ mage snører snittet ned til ein tråd.
    for (let i = 0; i < 8; i++) {
      const d = (ts[i] - p.mageH) / 0.18
      v[i] = Math.max(6, v[i] + (p.mage / 2) * Math.exp(-d * d))
    }
    return v
  }

  const axN = build(p.fotD / 2, p.midjeD / 2, p.seteD / 2)
  const ayN = build(p.fotB / 2, p.midjeB / 2, p.seteB / 2)
  const shiftAmp = (p.fotD - p.midjeD) * 0.2
  const shN = SHIFT_PROFILE.map((q) => q * shiftAmp)

  const axS = splineOf(ts, axN)
  const ayS = splineOf(ts, ayN)
  const shS = splineOf(ts, shN)

  // Vridinga er ikkje ein kanal i tabellen: ho er to tal og eit senter, og
  // eit senter er noko anna enn eit kontrollpunkt. Bias-eksponenten gjer at
  // halve vridinga er teken ut ved `vridSenter`, kva no den høgda er.
  const kBias = Math.log(0.5) / Math.log(Math.min(0.85, Math.max(0.15, p.vridSenter)))
  const twist = (t: number) => {
    const u = Math.pow(Math.min(1, Math.max(0, t)), kBias)
    return (p.vridFot + (p.vridSete - p.vridFot) * smooth(u)) * DEG
  }
  const nExp = (t: number) =>
    p.morfNed + (p.morfOpp - p.morfNed) * smooth(Math.min(1, Math.max(0, t)))

  // --- plan-skala: innpassinga i kuben -----------------------------------
  // Alle fem kanalane er millimeter i planet, og både radien og senterskyven
  // er proporsjonale med skalaen. Salen les normaliserte setekoordinatar, så
  // `zTop` er den same uansett skala. Difor er heile plana eksakt lineær i
  // skalafaktoren, og éin omgang set han rett — det er ikkje flaks, det er
  // grunnen til at innpassinga kan skrivast slik.
  const box = { s: 1 }

  const ax = (t: number) => box.s * axS(t)
  const ay = (t: number) => box.s * ayS(t)
  const ctr = (z: number): Pt => [box.s * shS(z / H), 0]

  const ro = (th: number, z: number) => {
    const t = z / H
    const A = Math.max(1, ax(t))
    const B = Math.max(1, ay(t))
    return Math.sqrt(A * B) * superR(th - twist(t), nExp(t), Math.log(A / B))
  }

  // --- salen -------------------------------------------------------------
  // seatZ − salsøkk(1 − f²) − sidesøkk·s² − framkant·clip(f,0,1)³, der f og
  // s er normaliserte setekoordinatar. f er langs salen, s er på tvers, og
  // salen fylgjer si EIGA ramme og ikkje vridinga: ein sit i rommet, ikkje
  // i snittet. Snittet under kan vera vridd so mykje det vil — salen står.
  //
  // SALRETNINGA dreiar heile salforma kring setesenteret, ikkje berre
  // trauaksen: f og s er same paret som før, lese i ei ramme som er dreidd
  // `salretning` grader. Difor er trauet like djupt og framkanten like
  // brei kva veg salen ligg, og null grader gjev nøyaktig gamal åtferd —
  // cos 0 = 1 og sin 0 = 0 er eksakte, so kvart ledd fell attende på seg
  // sjølv, ikkje på noko som liknar.
  const cosS = Math.cos(p.salretning * DEG)
  const sinS = Math.sin(p.salretning * DEG)
  const seatTop = (x: number, y: number) => {
    const c = ctr(H)
    const dx = x - c[0]
    const dy = y - c[1]
    const f = (dx * cosS + dy * sinS) / Math.max(1, ax(1))
    const s = (dy * cosS - dx * sinS) / Math.max(1, ay(1))
    const fc = Math.min(1, Math.max(0, f))
    return (
      H -
      p.salsokk * (1 - Math.min(1, f * f)) -
      p.sidesokk * Math.min(1, s * s) -
      p.framkant * fc * fc * fc
    )
  }

  // --- setekanten ---------------------------------------------------------
  // Kanten er ein kvartrunding over dei siste `kantR` millimeterane opp mot
  // salkanten. Radien fylgjer plana når objektet vert krympa inn i kuben:
  // ein kant som stod att i full storleik på eit objekt som er krympa ti
  // prosent er ikkje same kanten, og — viktigare — då ville plana ikkje
  // lenger vera lineær i skalafaktoren, og innpassinga måtte gå fleire
  // omgangar for å finne seg sjølv.
  const edge = () => box.s * Math.max(0.5, p.kantR)

  /** høgda ytterflata sluttar i, med kanten alt trekt av */
  const zTopRaw = (th: number) => {
    const e = edge()
    let z = H
    for (let k = 0; k < 3; k++) {
      const c = ctr(z)
      const r = Math.max(1, ro(th, z) - e)
      z = seatTop(c[0] + r * Math.cos(th), c[1] + r * Math.sin(th))
    }
    return Math.min(H, Math.max(1, z))
  }
  // zTop vert slege opp for kvar vinkel i kvart oppslag av flata; utan
  // dette minnet reknar innpassinga same fikspunktet hundre gonger.
  const topCache = new Map<number, number>()
  const zTop = (th: number) => {
    const k = Math.round(th * 1e6)
    const hit = topCache.get(k)
    if (hit !== undefined) return hit
    const v = zTopRaw(th)
    topCache.set(k, v)
    return v
  }

  const roFin = (th: number, z: number) => {
    const e = edge()
    const t = zTop(th)
    const w = (z - (t - e)) / e
    if (w <= 0) return ro(th, z)
    const u = Math.min(1, w)
    return ro(th, z) - e * (1 - Math.sqrt(Math.max(0, 1 - u * u)))
  }

  const outer = (th: number, z: number): Vec3 => {
    const c = ctr(z)
    const r = roFin(th, z)
    return [c[0] + r * Math.cos(th), c[1] + r * Math.sin(th), z]
  }

  /** Normalen vert rekna av parametriseringa og ikkje sett lik radien:
   *  flata heller både med høgda og med vinkelen, og ein superellipse med
   *  n = 5 har ein normal som peikar langt frå radien i hjørna. */
  const normal = (th: number, z: number): Vec3 => {
    const dz = Math.max(0.5, H * 0.004)
    const dt = 0.004
    const bz = outer(th, Math.min(H, z + dz))
    const az = outer(th, Math.max(0, z - dz))
    const bt = outer(th + dt, z)
    const at = outer(th - dt, z)
    const u: Vec3 = [bz[0] - az[0], bz[1] - az[1], bz[2] - az[2]]
    const v: Vec3 = [bt[0] - at[0], bt[1] - at[1], bt[2] - at[2]]
    let n: Vec3 = [
      v[1] * u[2] - v[2] * u[1],
      v[2] * u[0] - v[0] * u[2],
      v[0] * u[1] - v[1] * u[0],
    ]
    const L = Math.hypot(n[0], n[1], n[2]) || 1
    n = [n[0] / L, n[1] / L, n[2] / L]
    const a = outer(th, z)
    const c = ctr(z)
    if (n[0] * (a[0] - c[0]) + n[1] * (a[1] - c[1]) < 0) n = [-n[0], -n[1], -n[2]]
    return n
  }

  // --- tomrommet ---------------------------------------------------------
  // Tomrommet vert klemt inn mellom sokkelen og kappa. Eit tomrom som nådde
  // heilt ut i sporet ville dele finna i to lause delar som ingen sokkel
  // held saman — og då er det ikkje eit tomrom, det er eit kutt.
  const zFinBot = p.sokkelT
  const zFinTop = H - 3 * p.kappeT
  const wedge = Math.max(2, p.kile * H)
  const voidZ0 = Math.max(p.tomFra * H, zFinBot + 3)
  const voidZ1 = Math.min(p.tomTil * H, zFinTop - 3)

  /**
   * VEGGEN ER TREKT AV RADIEN, IKKJE FORSKUVEN.
   * Ei ekte innoverforskyving av eit polygon rundar av eit skarpt hjørne
   * innanfrå og kan dele kurva i to; her vert veggtjukna berre trekt av
   * radien i kvar retning. For ein superellipse med n = 3,6 i midja tyder
   * det at hjørna på innsida står skarpare enn dei skulle, og at veggen
   * ikkje er 28 mm overalt: målt tvers over eit bein varierer han frå kring
   * 22 til kring 31 millimeter på standardobjektet. Det er godt nok til å
   * telje bein og areal med, og det er for grovt til å måle limflate med —
   * og det er difor regelen «smalaste beinet» måler og ikkje les.
   */
  /**
   * TOMSKYVET: tomrommet skuva sidevegs utan at ytterflata rører seg.
   * Skyvet vert lagt på RADIEN og ikkje på senteret — d millimeter meir i
   * `tomretning`, d mindre rett imot — so tomrommet held seg ei stjerneform
   * kring same senteret som kroppen, og kvar lesar som spør «kor langt ut
   * går hola i denne retninga» får framleis eitt svar. Retninga peikar mot
   * den LETTE sida: der veggen vert tynnast og beinet lettast.
   *
   * `skyv.d` er ikkje `p.tomskyv`. Han vert klemt mot rommet som verkeleg
   * finst, sett etter innpassinga — sjå `fitVoidShift`.
   */
  const voidDir = p.tomretning * DEG
  const skyv = { d: 0 }

  const ri = (th: number, z: number) => {
    if (z <= voidZ0 || z >= voidZ1) return 0
    const g = Math.min(
      smooth((z - voidZ0) / wedge),
      smooth((voidZ1 - z) / wedge),
    )
    if (g <= 0) return 0
    const r = ro(th, z)
    return Math.max(0, Math.min(r * 0.92, r - p.veggT) + skyv.d * Math.cos(th - voidDir)) * g
  }

  // --- konturar ----------------------------------------------------------
  const sectionPoly = (z: number, nth = 192, grow = 0): Pt[] => {
    const c = ctr(z)
    const out: Pt[] = []
    for (let i = 0; i < nth; i++) {
      const th = (i / nth) * TAU
      const r = ro(th, z) + grow
      out.push([c[0] + r * Math.cos(th), c[1] + r * Math.sin(th)])
    }
    return out
  }

  const voidPoly = (z: number, nth = 192): Pt[] | null => {
    if (z <= voidZ0 || z >= voidZ1) return null
    const c = ctr(z)
    const out: Pt[] = []
    let big = 0
    for (let i = 0; i < nth; i++) {
      const th = (i / nth) * TAU
      const r = ri(th, z)
      if (r > big) big = r
      out.push([c[0] + r * Math.cos(th), c[1] + r * Math.sin(th)])
    }
    return big > 1 ? out : null
  }

  // --- skiveplana --------------------------------------------------------
  const cosA = Math.cos(alpha)
  const sinA = Math.sin(alpha)
  const cosF = Math.cos(phi)
  const sinF = Math.sin(phi)
  const zPivot = p.planSenter * H
  const frame: Frame = {
    n: [cosA * cosF, cosA * sinF, sinA],
    e1: [-sinF, cosF, 0],
    e2: [-sinA * cosF, -sinA * sinF, cosA],
    cosA,
    sinA,
    cosF,
    sinF,
    zPivot,
  }
  const toWorld = (u: number, a: number, b: number): Vec3 => [
    u * cosA * cosF - a * sinF - b * sinA * cosF,
    u * cosA * sinF + a * cosF - b * sinA * sinF,
    u * sinA + b * cosA + zPivot,
  ]
  const zOf = (u: number, b: number) => u * sinA + b * cosA + zPivot
  const bOf = (u: number, z: number) => (z - zPivot - u * sinA) / cosA

  const body: Body = {
    p,
    H,
    get scale() {
      return box.s
    },
    ax,
    ay,
    tw: twist,
    nExp,
    ctr,
    ro,
    outer,
    normal,
    voidZ0,
    voidZ1,
    ri,
    seatTop,
    zTop,
    sectionPoly,
    voidPoly,
    frame,
    planes: [],
    pitch: 0,
    toWorld,
    zOf,
    bOf,
  }

  fitToCube(body, box, () => topCache.clear())
  fitVoidShift(body, skyv)
  layPlanes(body)
  return body
}

// =============================================================================
// TOMSKYVET MOT ROMMET SITT
// =============================================================================
/**
 * Skyvet legg d til tomromsradien i éi retning og trekk d frå i den
 * motsette. To ting kan då gå til null, og begge er hòl i nettet og ikkje
 * berre stygge tal:
 *
 *   veggen  (ro − ri) − d  — ein vegg pressa til null er to skal som ligg
 *           oppå kvarandre, og godset mellom sokkel og kappe er borte
 *   radien  w − d          — eit tomrom snørt heilt inn til senter gjev ei
 *           rad utarta trekantar, og eit utarta lokk er eit hòl
 *
 * Rommet vert difor målt RETNINGSVIST og ikkje som eitt tal: skyvet et av
 * veggen berre der han legg til (cos > 0) og av radien berre der han trekk
 * frå (cos < 0), og bidraget er d·cos og ikkje d. Eit trongt punkt som ligg
 * på tvers av skyvretninga kostar difor ingen ting — det er nettopp difor
 * aksen har noko å gå på i det heile. Berre 45 % av rommet vert teke ut,
 * so minst 55 % av både vegg og radius står att kvar einaste stad, og
 * lukkinga fylgjer av konstruksjonen og ikkje av at ingen har prøvd.
 *
 * Der `w` alt er null eller under, er tomrommet stengt i den retninga frå
 * før — skyvet har ingen radius å øydeleggje der, og den grensa gjeld ikkje.
 *
 * Målinga må stå ETTER innpassinga: radien er lineær i skalafaktoren, og
 * eit rom målt før krympinga er eit rom som ikkje finst. `ri` vert aldri
 * lesen før dette — korkje innpassinga eller planlegginga spør etter hola.
 */
function fitVoidShift(b: Body, skyv: { d: number }) {
  const want = Math.max(0, b.p.tomskyv)
  if (!(want > 0)) return
  const dir = b.p.tomretning * DEG
  let room = want
  for (let j = 1; j < 12; j++) {
    const z = b.voidZ0 + ((b.voidZ1 - b.voidZ0) * j) / 12
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * TAU
      const c = Math.cos(th - dir)
      const r = b.ro(th, z)
      const w = Math.min(r * 0.92, r - b.p.veggT)
      if (c > 1e-6) room = Math.min(room, (0.45 * (r - w)) / c)
      else if (c < -1e-6 && w > 0) room = Math.min(room, (0.45 * w) / -c)
    }
  }
  skyv.d = Math.max(0, room)
}

// =============================================================================
// INNPASSING I KUBEN
// =============================================================================
/**
 * Berre planet vert passa inn, og berre nedover. Høgda er alt gjeven i
 * millimeter — setekanten står nøyaktig der ein sette han — og å skalere Z
 * ville tyde at setehøgda ein bad om ikkje var setehøgda ein fekk. Eit for
 * høgt objekt vert difor ikkje retta her; det vert fanga av den harde
 * regelen «kuben», og det er meininga: reiskapen skal seia frå.
 *
 * Objektet vert heller ikkje blåse opp for å fylle kuben. Ein krakk på
 * 412 mm er ikkje feil av di han har luft att rundt seg.
 *
 * Randa av flata er ikkje eit hòl her, men ho finst: nedst golvplanet og
 * øvst salen. Begge rendene vert sampla eksakt, og maksimum vert halvert
 * fram i BEGGE retningar. Utan det bommar eit rutenett på 720 × 120 med
 * kring éin millimeter, og eit slikt anslag er ingen kubekontroll.
 */
function fitToCube(b: Body, box: { s: number }, forget: () => void) {
  const NT = 720
  const NZ = 120
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  const see = (q: Vec3) => {
    if (q[0] < x0) x0 = q[0]
    if (q[0] > x1) x1 = q[0]
    if (q[1] < y0) y0 = q[1]
    if (q[1] > y1) y1 = q[1]
  }

  /** ternærsøk på ein av dei fire projeksjonane over eit z-intervall */
  const refineZ = (th: number, lo: number, hi: number, k: number, sgn: number) => {
    let a = lo
    let c = hi
    for (let i = 0; i < 26; i++) {
      const m1 = a + (c - a) / 3
      const m2 = c - (c - a) / 3
      if (sgn * b.outer(th, m1)[k] < sgn * b.outer(th, m2)[k]) a = m1
      else c = m2
    }
    see(b.outer(th, (a + c) / 2))
  }

  for (let i = 0; i < NT; i++) {
    const th = (i / NT) * TAU
    const top = b.zTop(th)
    // Golvet og salkanten er dei to rendene flata sluttar i. Dei vert
    // sampla eksakt; ein rad som fell ein millimeter under salkanten ser
    // ikkje det breiaste punktet på eit objekt som er vidast øvst.
    see(b.outer(th, 0))
    see(b.outer(th, top))
    for (let j = 1; j < NZ; j++) see(b.outer(th, (j / NZ) * top))
    for (const [k, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1]] as [number, number][]) {
      refineZ(th, 0, top, k, sgn)
    }
  }
  // og så same halveringa i vinkel kring dei fire ytterpunkta
  const span = Math.max(x1 - x0, y1 - y0)
  if (!(span > 0)) return
  box.s = Math.min(1, (CUBE - FIT_MARGIN) / span)
  forget()
}

// =============================================================================
// SKIVEPLANA
// =============================================================================
/**
 * Plana ligg jamt over den vassrette breidda kroppen har på tvers av
 * rekkja, ikkje over heile u-spennet. Skilnaden er skråstillinga: eit plan
 * som stod ytst i u ville berre snerta eit hjørne av kappa, og med 12° er
 * det seksti millimeter av spennet som ikkje er kropp i det heile.
 */
function layPlanes(b: Body) {
  const n = Math.max(2, Math.round(b.p.finnar))
  const { cosF, sinF, cosA } = b.frame
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j <= 96; j++) {
    const z = (j / 96) * b.H
    const poly = b.sectionPoly(z, 256)
    for (const q of poly) {
      const w = q[0] * cosF + q[1] * sinF
      if (w < lo) lo = w
      if (w > hi) hi = w
    }
  }
  const pitch = (hi - lo) / n
  const out: number[] = []
  for (let k = 0; k < n; k++) out.push((lo + (k + 0.5) * pitch) * cosA)
  ;(b as { planes: number[] }).planes = out
  ;(b as { pitch: number }).pitch = pitch
}

// =============================================================================
// LINJE MOT KONTUR
// =============================================================================
/**
 * Kvar ei rett line skjer eit lukka polygon, uttrykt som parameter langs
 * lina. Verdiane kjem sorterte og i par: to og to er inn og ut. Ein
 * konveks kontur gjev alltid nøyaktig to, men koden lit ikkje på det —
 * ein vridd superellipse kan verta lett konkav i overgangen mellom to
 * kontrollsnitt om nokon dreg eit band heilt ut.
 */
export function crossings(
  poly: Pt[],
  ox: number,
  oy: number,
  dx: number,
  dy: number,
): number[] {
  const out: number[] = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const c = poly[(i + 1) % n]
    const ex = c[0] - a[0]
    const ey = c[1] - a[1]
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-12) continue
    const s = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den
    const u = (dx * (a[1] - oy) - dy * (a[0] - ox)) / -den
    if (u >= 0 && u < 1) out.push(s)
  }
  out.sort((p, q) => p - q)
  return out
}

/** para intervall ut av kryssingane; ulikt tal kryssingar vert forkasta */
export function spans(cs: number[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < cs.length; i += 2) {
    if (cs[i + 1] - cs[i] > 1e-6) out.push([cs[i], cs[i + 1]])
  }
  return out
}
