/**
 * SANDKASSE — måla.
 *
 * Skilnaden på ein parameter og eit mål er heile poenget med fila: ein
 * parameter seier kva ein bad om, eit mål seier kva ein fekk. Skalet vert
 * skalert inn i kuben etter at ein har skrudd, opningane et av rimet, og
 * ryggen kan vera eten opp av eit sveip — så det ein bad om og det som
 * står der treng ikkje vera same tal.
 *
 * Tre tal er unnatak, og dei skal namngjevast i staden for å gøymast:
 *
 *   `seatZ` er høgda på setekanten, og han er identisk med `p.seatZ`.
 *   `fitToCube` skalerer berre planet — Z er alt gjeve i millimeter og
 *   vert aldri rørt — så setekanten ligg nøyaktig der ein sette han.
 *   Talet som svarar på «kor høgt sit eg» er `sitZ`, og det er eit anna.
 *
 *   `sitZ` og `dishDepth` er rekna av geometrien, men skåla har analytisk
 *   botn i `p.seatZ - p.dish`, så botnen er ikkje uavhengig av parametrane.
 *   Det som er målt, er kor mykje av skåla rimbylgja et opp.
 *
 * Alt anna her er lese av geometrien: flata frå `surface`, laga frå
 * `laminae`, snitta frå `field`.
 */
import { makeShell, planArcs, wrapPi, type Shell } from "./field"
import { buildStack, type Stack, type Pt } from "./laminae"
import { buildMesh, DETAIL, type MeshData } from "./surface"
import { CUBE, MATERIALS, type Params } from "./params"
import { keep, type Metrics as Core } from "../core"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** NS-EN 1728, kontraktnivå: 1600 N konsentrert på setet. */
const SEAT_LOAD = 1600
/** NS-EN 1995-1-1: kmod for klasse 1 og korttidslast, og gammaM for kryssfiner. */
const KMOD = 0.8
const GAMMA_M = 1.2

/** kor høgt over botnen av skåla den brukbare flata vert målt, mm */
const DISH_REF = 15

/** Eit måltal med ferdig sats. Formateringa skjer her og ikkje i
 *  grensesnittet: målinga går i ein worker, og ein funksjon kan ikkje
 *  sendast gjennom postMessage — han ville drepe heile meldinga. */
export type Metric = {
  id: string
  label: string
  value: number
  unit: string
  /** talet slik det skal stå på skjermen, med komma og eining */
  text: string
}

export type Metrics = Core & {
  envX: number // ytre mål, mm
  envY: number
  envZ: number
  clearX: number // det som er att til 500-kuben, mm
  clearY: number
  clearZ: number
  seatZ: number // høgda på setekanten, mm — identisk med p.seatZ, sjå toppen
  sitZ: number // kor høgt ein faktisk sit: planet 15 mm over botnen av skåla, mm
  dishW: number // brukbar skål på tvers, mm
  dishD: number // brukbar skål fram og attende, mm
  dishDepth: number // kor djup skåla er der ho er brukbar, mm
  footX: number // fotavtrykket sin bbox, mm
  footY: number
  footArea: number // støtteflata, altså det konvekse hylsteret, mm²
  tipAngle: number // veltevinkel, grader
  tipArm: number // kortaste vippearm frå setesenteret, mm
  contacts: number // kor mange skilde flater objektet står på; ein ring er 1
  minSecArea: number // det dimensjonerande vassrette tverrsnittet, mm²
  minSecZ: number // høgda det ligg i, mm
  sigmaC: number // trykkspenning i det snittet, MPa
  sigmaM: number // bøyespenning same stad, MPa
  util: number // samla utnytting, 1,0 er kapasiteten
  capC: number // dimensjonerande trykkfastleik, MPa
  capM: number // dimensjonerande bøyefastleik, MPa
  mass: number // ferdig, etter sliping, kg
  massCut: number // som kutta, med slipemon, kg
  layers: number
  parts: number
  plyArea: number // finér i alt, mm²
  volume: number // godsvolum som kutta, mm³
  comZ: number // tyngdepunktet over golvet, mm
  finRise: number // kor høgt ryggen står over setet der han står, mm
  rimSpan: number // kor mange grader av rimet som finst
  list: Metric[] // alt over, i tabellrekkjefylgje
}

// =============================================================================
// KONVEKST HYLSTER
// =============================================================================
const cross = (o: Pt, a: Pt, b: Pt) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/**
 * Monotone kjeder (Andrew). Punkta vert sorterte etter x, så vert nedre og
 * øvre kjede bygde med eit stakk der alle høgresvingar fell ut. Resultatet
 * er mot klokka, og det er den orienteringa avstandsrekninga under byggjer
 * på: innsida ligg til venstre for kvar retta kant.
 */
function hull(pts: Pt[]): Pt[] {
  const q = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (q.length < 3) return q
  const lo: Pt[] = []
  for (const pt of q) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], pt) <= 0) lo.pop()
    lo.push(pt)
  }
  const hi: Pt[] = []
  for (let i = q.length - 1; i >= 0; i--) {
    const pt = q[i]
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], pt) <= 0) hi.pop()
    hi.push(pt)
  }
  lo.pop()
  hi.pop()
  return lo.concat(hi)
}

const hullArea = (h: Pt[]): number => {
  let a = 0
  for (let i = 0; i < h.length; i++) {
    const b = h[(i + 1) % h.length]
    a += h[i][0] * b[1] - b[0] * h[i][1]
  }
  return Math.abs(a) / 2
}

/**
 * Kortaste normalavstand frå eit punkt til ei kant i hylsteret, positiv
 * når punktet ligg innanfor. Det er avstanden til kantlina, ikkje til
 * hjørna: objektet vippar om ei linje mellom to bein, ikkje om eit punkt.
 */
function armToHull(h: Pt[], px: number, py: number): number {
  if (h.length < 3) return -Infinity
  let best = Infinity
  for (let i = 0; i < h.length; i++) {
    const a = h[i]
    const b = h[(i + 1) % h.length]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const L = Math.hypot(ex, ey)
    if (L < 1e-9) continue
    const d = (ex * (py - a[1]) - ey * (px - a[0])) / L
    if (d < best) best = d
  }
  return best
}

// =============================================================================
// TVERRSNITT
// =============================================================================
type Cell = { x: number; y: number; dA: number }

/** ringarealet ved høgda z, integrert over dei vinkelintervalla som finst */
function ringArea(sh: Shell, z: number, nt: number): number {
  const dth = TAU / nt
  let a = 0
  for (const run of planArcs(sh, z, nt)) {
    for (const s of run) a += 0.5 * (s.ro * s.ro - s.ri * s.ri) * dth
  }
  return a
}

/**
 * Same snittet, men delt opp i celler slik at ein kan rekna tyngdepunkt og
 * andremoment av det. Cellene ligg i verdskoordinatar — planArcs gjev
 * radiane frå ryggraden, og ryggraden står ikkje i origo.
 */
function sectionCells(sh: Shell, z: number, nt: number, nr = 8): Cell[] {
  const dth = TAU / nt
  const [cx, cy] = sh.spine(sh.hOf(z))
  const out: Cell[] = []
  for (const run of planArcs(sh, z, nt)) {
    for (const s of run) {
      const dr = (s.ro - s.ri) / nr
      if (!(dr > 0)) continue
      for (let k = 0; k < nr; k++) {
        const r = s.ri + (k + 0.5) * dr
        out.push({
          x: cx + r * Math.cos(s.th),
          y: cy + r * Math.sin(s.th),
          dA: r * dr * dth,
        })
      }
    }
  }
  return out
}

// =============================================================================
// SLIPEMONET
// =============================================================================
/**
 * Slipemonet ligg alt inne i delane frå `buildStack`: ytterkonturen er
 * skuva `sand` millimeter utover, radielt frå ryggraden i laget sitt
 * midtplan. Det som vert slipt bort er difor ringsektoren mellom r og
 * r − sand, og arealet av han er
 *
 *     ∫ (r² − (r − s)²)/2 dθ  =  ∫ (s·r − s²/2) dθ
 *
 * summert langs ytterkonturen med det vinkelsteget punkta faktisk har.
 * Kontrollert mot ei heil ombygging av stabelen med sand = 0: 52409 mot
 * 52406 mm² på SKAL, altså under ein promille. Difor er det ikkje verdt
 * å byggja stabelen to gonger berre for å få eit tal på arealtapet.
 */

// =============================================================================
// MÅLINGA
// =============================================================================
/**
 * Det arbeidaren alt har bygd, som målinga kan låne i staden for å byggje
 * om att. Ei full runde bygde skalet tre gonger og stabelen to før dette
 * fanst; 86 prosent av tida målinga tok gjekk med til arbeid som låg
 * ferdig i minnet ein funksjon unna.
 *
 * `mesh` MÅ vera det ferdige skalet frå `buildMesh` — stabelmeshet er
 * objektet slik det kjem ut av fresen, med slipemon og trapp, og ville
 * gje eit for stort volum og ei for stor omhylling.
 */
export type Prebuilt = { shell?: Shell; mesh?: MeshData; stack?: Stack }
/**
 * Volum og fyrste moment om golvet, av divergenssetninga. Nettet er
 * samstemt orientert og lukka, så summen over trekantane er eksakt — men
 * han reknar vindingstalet, ikkje unionen.
 *
 * Setet og veggen gjennomtrengjer kvarandre med vilje i skøyten, og det
 * volumet vert difor talt to gonger. Målt med strålekasting gjennom det
 * verkelege nettet er overlappen 3,3 % på standardobjektet og 2,1–4,7 %
 * over tilfeldige trekk — ikkje ein promille, som det stod her før.
 *
 * Massen og tyngdepunktet er altså om lag tre prosent for høge. Det er
 * ein kjend feil og ikkje ei avrunding: å rette han krev ein union, og
 * ein union krev anten ein boolsk operasjon på nettet eller ei integrering
 * av `solidAt` over eit fint rutenett. Begge kostar meir enn eit tal som
 * uansett skal kontrollmålast på ei vekt.
 */
function meshVolume(m: { positions: Float32Array; tris: number }): [number, number] {
  let v = 0
  let mz = 0
  const P = m.positions
  for (let t = 0; t < m.tris; t++) {
    const i = t * 9
    const ax = P[i], ay = P[i + 1], az = P[i + 2]
    const bx = P[i + 3], by = P[i + 4], bz = P[i + 5]
    const cx = P[i + 6], cy = P[i + 7], cz = P[i + 8]
    const d =
      ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
    v += d / 6
    mz += (d / 24) * (az + bz + cz)
  }
  return [v, mz]
}


const MAAL_NETT = keep<MeshData>(2)

export function measure(p: Params, pre: Prebuilt = {}): Metrics {
  const sh = pre.shell ?? makeShell(p)
  const mat = MATERIALS[p.material]

  // --- ytre mål ------------------------------------------------------------
  // Lågaste detaljnivå er nok: ytterpunkta ligg på parametriseringa, ikkje
  // på trekantane, så bboxen er den same på «lav» som på «hog» til under ein
  // tidels millimeter. Det er ingen grunn til å byggja eit fint mesh berre
  // for å måle det.
  // Nettet her er målinga sitt eige og vert ALDRI sendt nokon stad —
  // difor er det trygt å hugse, i motsetnad til nettet bygget leverer.
  const mesh = pre.mesh ?? MAAL_NETT(JSON.stringify(p), () => buildMesh(p, DETAIL.lav, sh))
  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- kontaktflatene mot golvet -------------------------------------------
  // Innerflata vert klemd opp til z = 0 i meshet, så alt som har material ved
  // golvet ligg i golvplanet, og eit tett sveip finn både kor mange skilde
  // flater det er og kor breidt dei står. Berre golvplanet sjølv vert teke
  // med: eit punkt eit par millimeter oppe ber ikkje, og der veggen svulmar
  // utover frå golvkanten ville det blåse opp støtteflata og gjeve ein
  // veltevinkel som er for snill.
  const NC = 1440
  const foot: Pt[] = []
  const here: boolean[] = new Array(NC)
  for (let i = 0; i < NC; i++) {
    const th = (i / NC) * TAU
    const on = sh.matAt(th, 0) >= 1
    here[i] = on
    if (!on) continue
    const o = sh.outer(th, 0)
    foot.push([o[0], o[1]])
  }
  let contacts = 0
  for (let i = 0; i < NC; i++) if (!here[i] && here[(i + 1) % NC]) contacts++
  if (contacts === 0 && here[0]) contacts = 1

  let fx0 = Infinity
  let fx1 = -Infinity
  let fy0 = Infinity
  let fy1 = -Infinity
  for (const q of foot) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  const H = hull(foot)
  const footX = foot.length ? fx1 - fx0 : 0
  const footY = foot.length ? fy1 - fy0 : 0
  const footArea = hullArea(H)

  // --- lag, masse og tyngdepunkt -------------------------------------------
  // Det ferdige godset er nettet, ikkje stabelen. Stabelen er trappa slik
  // ho kjem ut av fresen — kvart lag skore etter det breiaste snittet
  // gjennom sitt eige spenn, pluss slipemon — og slipinga tek bort heile
  // den trappa. Å rekne ferdig masse som kutta masse minus slipemonet i
  // planet gjev difor eit tal som er nesten dobbelt for høgt: monet er
  // to millimeter, men trappa er halve laghøgda der flata legg seg ned.
  const st = pre.stack ?? buildStack(p, sh)
  const [volume, momZ] = meshVolume(mesh)
  const comZ = volume > 0 ? momZ / volume : 0
  const massCut = st.mass
  const mass = (volume * MATERIALS[p.material].rho) / 1e9

  // --- velting -------------------------------------------------------------
  // Lasta kjem inn ved setet, ikkje ved objektet sitt eige tyngdepunkt: ein
  // person på 80 kg gjer dei seks kiloa i krakken til avrunding, og då er
  // det setehøgda som er armen. Å rekne med objektet sitt comZ på 255 mm gjev
  // eit tal som er ti grader for snilt og som ikkje kan samanliknast med dei
  // som står i litteraturen. Talet her er difor konservativt og kan målast
  // mot Stool 60 sine 23 grader — men det er framleis rekna, ikkje målt, og
  // NS-EN 1022 må prøvast fysisk.
  const [sx, sy] = sh.spine(sh.hOf(p.seatZ))
  const tipArm = H.length >= 3 ? armToHull(H, sx, sy) : 0
  const tipAngle = (Math.atan2(tipArm, Math.max(p.seatZ, 1e-6)) * 180) / Math.PI

  // --- minste tverrsnitt ---------------------------------------------------
  // Berre opp til setet: over setehøgda er det ryggen som står att, og han
  // fører ikkje setelasta ned i golvet. Grovt sveip fyrst, så eitt fint
  // snitt der minimumet ligg — det er berre der talet skal brukast til noko.
  // Det dimensjonerande snittet er ikkje det minste. Areal og utmiddel
  // dreg kvar sin veg oppover: nede er snittet lite, men setesenteret står
  // nesten over det, så momentet er null; oppe er utmiddelet stort, men
  // snittet er vidt. Difor vert utnyttinga rekna i kvart snitt og
  // maksimum teke — leitte ein etter minste AREAL i staden, ville svaret
  // vore sett av kvar sveipet sluttar og ikkje av geometrien.
  //
  // Sveipet går berre til botnen av skåla. Over det er det setet som ber,
  // og setet er ikkje ei søyle.
  const capC = (mat.fck * KMOD) / GAMMA_M
  const capM = (mat.fmk * KMOD) / GAMMA_M
  const NS = 60
  const zCol = Math.max(20, p.seatZ - p.dish - p.shellT)

  /** areal, tyngdepunkt, utmiddel, motstandsmoment og utnytting i eitt snitt */
  const section = (z: number) => {
    const cells = sectionCells(sh, z, 384)
    let A = 0
    let gx = 0
    let gy = 0
    for (const c of cells) {
      A += c.dA
      gx += c.x * c.dA
      gy += c.y * c.dA
    }
    if (!(A > 1)) return null
    gx /= A
    gy /= A
    const ex = sx - gx
    const ey = sy - gy
    const e = Math.hypot(ex, ey)
    let W = 0
    if (e > 1e-6) {
      const ux = ex / e
      const uy = ey / e
      let I = 0
      let c = 0
      for (const q of cells) {
        const u = (q.x - gx) * ux + (q.y - gy) * uy
        I += u * u * q.dA
        if (Math.abs(u) > c) c = Math.abs(u)
      }
      W = c > 1e-6 ? I / c : 0
    }
    const sc = SEAT_LOAD / A
    const sm = W > 0 ? (SEAT_LOAD * e) / W : 0
    return { z, A, sc, sm, util: sc / capC + sm / capM }
  }

  let worst: ReturnType<typeof section> = null
  for (let i = 0; i <= NS; i++) {
    const q = section((i / NS) * zCol)
    if (q && (!worst || q.util > worst.util)) worst = q
  }
  // eitt finare sveip kring vinnaren, slik at talet ikkje heng på steget
  if (worst) {
    const h = zCol / NS
    for (let i = -8; i <= 8; i++) {
      const q = section(Math.max(0, Math.min(zCol, worst.z + (i * h) / 8)))
      if (q && q.util > worst.util) worst = q
    }
  }

  const minSecArea = worst ? worst.A : 0
  const minSecZ = worst ? worst.z : 0
  const sigmaC = worst ? worst.sc : Infinity
  const sigmaM = worst ? worst.sm : 0
  const util = worst ? worst.util : Infinity

  // --- setet ---------------------------------------------------------------
  // Den brukbare skåla er den flata som ligg innanfor femten millimeter over
  // botnen: lenger opp er kanten så bratt at ein ikkje sit på henne, ein
  // stør seg mot henne. Radien vert funnen ved å halvera på dishZ i staden
  // for å snu skålformelen — eksponenten varierer med salen, og eit
  // halveringssøk toler kva som helst kurve.
  const NT = 720
  const bot = p.seatZ - p.dish
  const target = bot + DISH_REF
  let dx0 = Infinity
  let dx1 = -Infinity
  let dy0 = Infinity
  let dy1 = -Infinity
  let edgeSum = 0
  // skåla vert målt i eitt og same plan, så ryggraden står i ro her
  const [dcx, dcy] = sh.spine(sh.hOf(target))
  for (let i = 0; i < NT; i++) {
    const th = (i / NT) * TAU
    const zEdge = sh.seatEdgeZ(th)
    edgeSum += zEdge
    const rTop = sh.rOuter(th, zEdge) + p.lip
    let q = 1
    if (sh.dishZ(th, 1) > target) {
      let a = 0
      let b = 1
      for (let k = 0; k < 32; k++) {
        const m = (a + b) / 2
        if (sh.dishZ(th, m) < target) a = m
        else b = m
      }
      q = (a + b) / 2
    }
    const r = q * rTop
    const x = dcx + r * Math.cos(th)
    const y = dcy + r * Math.sin(th)
    if (x < dx0) dx0 = x
    if (x > dx1) dx1 = x
    if (y < dy0) dy0 = y
    if (y > dy1) dy1 = y
  }
  // X er fram og attende, Y er sideveg
  const dishD = dx1 - dx0
  const dishW = dy1 - dy0
  // Skåldjupna er ikkje parameteren: rimbylgja dreg setekanten under
  // p.seatZ over delar av omkrinsen, og då er det mindre skål att.
  const dishDepth = Math.max(0, edgeSum / NT - bot)
  // Setekanten er ikkje der ein sit. Sitjeflata ligg nede i skåla, og ho
  // vert lesen i det same planet som den brukbare flata: femten millimeter
  // over botnen. På eit djupt sete er skilnaden mot setekanten tre
  // centimeter, og det er tre centimeter som elles ikkje står nokon stad.
  const sitZ = bot + DISH_REF

  // --- rim og rygg ---------------------------------------------------------
  let rimHave = 0
  for (let i = 0; i < NT; i++) {
    const th = (i / NT) * TAU
    if (sh.matAt(th, sh.hOf(sh.rimZ(th))) >= 1) rimHave++
  }
  const rimSpan = (rimHave / NT) * 360

  // Ryggen vert målt der han står, ikkje der parameteren seier: eit sveip
  // kan ha ete han opp, og då er det ingen rygg å lena seg mot.
  const finHalf = Math.max(6, p.finWide / 2) * DEG
  const finDir = p.finDir * DEG
  let finTop = -Infinity
  for (let i = -60; i <= 60; i++) {
    const th = finDir + (finHalf * i) / 60
    const z = sh.rimZ(th)
    if (sh.matAt(th, sh.hOf(z)) >= 1 && z > finTop) finTop = z
  }
  const finRise = Number.isFinite(finTop) ? Math.max(0, finTop - p.seatZ) : 0

  // Norsk desimalskiljeteikn overalt: eit tal med punktum i ein norsk
  // tabell les som eit tal henta frå eit anna dokument.
  const nn = (v: number, d: number) => v.toFixed(d).replace(".", ",")
  const mm = (v: number) => nn(v, 0)
  const mm1 = (v: number) => nn(v, 1)
  const cm2 = (v: number) => nn(v / 100, 0) + " cm²"
  const dm3 = (v: number) => nn(v / 1e6, 2) + " dm³"
  const pct = (v: number) => nn(v * 100, 0) + " %"
  const kg = (v: number) => nn(v, 2)
  const mpa = (v: number) => nn(v, 2)

  const raw = [
    { id: "envX", label: "ytre mål X", value: envX, unit: "mm", fmt: mm1 },
    { id: "envY", label: "ytre mål Y", value: envY, unit: "mm", fmt: mm1 },
    { id: "envZ", label: "høgd", value: envZ, unit: "mm", fmt: mm1 },
    { id: "clearX", label: "klaring X", value: CUBE - envX, unit: "mm", fmt: mm1 },
    { id: "clearY", label: "klaring Y", value: CUBE - envY, unit: "mm", fmt: mm1 },
    { id: "clearZ", label: "klaring høgd", value: CUBE - envZ, unit: "mm", fmt: mm1 },

    { id: "seatZ", label: "setekant", value: sh.seatZ, unit: "mm", fmt: mm },
    { id: "sitZ", label: "sitjehøgd", value: sitZ, unit: "mm", fmt: mm },
    { id: "dishW", label: "skål på tvers", value: dishW, unit: "mm", fmt: mm },
    { id: "dishD", label: "skål framover", value: dishD, unit: "mm", fmt: mm },
    { id: "dishDepth", label: "skåldjupn, målt", value: dishDepth, unit: "mm", fmt: mm1 },
    { id: "finRise", label: "rygg over sete", value: finRise, unit: "mm", fmt: mm },
    { id: "rimSpan", label: "rim som finst", value: rimSpan, unit: "°", fmt: mm },

    { id: "footX", label: "fotavtrykk X", value: footX, unit: "mm", fmt: mm },
    { id: "footY", label: "fotavtrykk Y", value: footY, unit: "mm", fmt: mm },
    { id: "footArea", label: "støtteflate", value: footArea, unit: "mm²", fmt: cm2 },
    { id: "contacts", label: "kontaktflater mot golvet", value: contacts, unit: "stk", fmt: mm },
    { id: "comZ", label: "tyngdepunkt", value: comZ, unit: "mm", fmt: mm },
    { id: "tipArm", label: "vippearm", value: tipArm, unit: "mm", fmt: mm },
    { id: "tipAngle", label: "veltevinkel", value: tipAngle, unit: "°", fmt: mm1 },

    { id: "minSecArea", label: "dimensjonerande snitt", value: minSecArea, unit: "mm²", fmt: cm2 },
    { id: "minSecZ", label: "snittet ligg", value: minSecZ, unit: "mm", fmt: mm },
    { id: "sigmaC", label: "trykkspenning", value: sigmaC, unit: "MPa", fmt: mpa },
    { id: "capC", label: "trykkapasitet", value: capC, unit: "MPa", fmt: mpa },
    { id: "sigmaM", label: "bøyespenning", value: sigmaM, unit: "MPa", fmt: mpa },
    { id: "capM", label: "bøyekapasitet", value: capM, unit: "MPa", fmt: mpa },
    { id: "util", label: "utnytting", value: util, unit: "", fmt: pct },

    { id: "layers", label: "lag", value: st.count, unit: "stk", fmt: mm },
    { id: "parts", label: "delar", value: st.parts, unit: "stk", fmt: mm },
    { id: "plyArea", label: "finérareal", value: st.area, unit: "mm²", fmt: cm2 },
    { id: "volume", label: "godsvolum", value: volume, unit: "mm³", fmt: dm3 },
    { id: "massCut", label: "masse som kutta", value: massCut, unit: "kg", fmt: kg },
    { id: "mass", label: "masse ferdig", value: mass, unit: "kg", fmt: kg },
  ]

  const list: Metric[] = raw.map((r) => ({
    id: r.id,
    label: r.label,
    value: r.value,
    unit: r.unit,
    text: r.fmt ? r.fmt(r.value) : String(r.value),
  }))

  return {
    envX,
    envY,
    envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ: sh.seatZ,
    sitZ,
    // dei felles namna kontrakten i core.ts krev; SKAL kallar dei skål,
    // av di det er ei skål, men panelet og dei andre motorane kjenner
    // dei berre som sitjeflate
    seatW: dishW,
    seatD: dishD,
    units: st.count,
    unitLabel: "lag",
    dishW,
    dishD,
    dishDepth,
    footX,
    footY,
    footArea,
    tipAngle,
    tipArm,
    contacts,
    minSecArea,
    minSecZ,
    sigmaC,
    sigmaM,
    util,
    capC,
    capM,
    mass,
    massCut,
    layers: st.count,
    parts: st.parts,
    plyArea: st.area,
    volume,
    comZ,
    finRise,
    rimSpan,
    list,
  }
}
