/**
 * KARVE — forma, og det fresen når inn til.
 *
 * Objektet er ikkje sett saman. Det er ein limt blokk med materiale teke
 * VEKK, og alt her inne er skrive frå den premissen.
 *
 * Tre band i planet ber heile silhuetten. Dei er uavhengige funksjonar av
 * vinkelen, og det er krysset mellom dei som gjer forma:
 *
 *   rSete(θ)   seterosetten — lobane, kjerva imellom
 *   rFot(θ)    beinstjerna på golvet — ho er stor der eit bein står og
 *              lita mellom beina, og det er DET som opnar bogane
 *   rMidje(θ)  halsen, klemd mellom dei to
 *
 * To høgdefelt lukkar objektet: salen på oppsida og kvelvinga på undersida.
 *
 * FRESEN NÅR IKKJE INN.
 * Ein treakses fres kjem ovanfrå og har eit skaft. Han kan lage ei flate
 * som er eit høgdefelt sett frå éi side, og ikkje anna. Emnet vert snudd
 * og køyrt frå begge sider, og det som står att er søyla mellom det
 * øvste og det nedste materialet i kvar planposisjon. Ligg det luft
 * MELLOM to lag material i same søyla — eit sete som heng ut over eit
 * bein — når korkje det eine eller det andre passet inn dit, og lufta
 * vert ståande som gods. Difor er det ikkje nok å teikne forma: her vert
 * ho SKANNA søyle for søyle, og det som ikkje let seg nå vert talt.
 *
 * Halsen er difor bunden. `rMidje` vert aldri lagd fritt: han vert lagd
 * eit tal millimeter — `midjeInn` — innanfor min(rSete, rFot), og nett det
 * talet er kor langt forma stikk seg sjølv under fresen. Er han null, er
 * silhuetten monoton i kvar einaste vinkel og heile objektet let seg
 * frese. Difor er den synlege midja ikkje eit innhogg, men noko som skjer
 * der beinstjerna er lita: mellom beina.
 *
 * FARTEN. Skanninga spør om dei same fem tala tusenvis av gonger for same
 * vinkel. Difor er vinkelen sitt eige oppslag — STRIPA — rekna éin gong,
 * og alt inni søylelykkja er reine tal etter det. Utan henne kostar eit
 * bygg tre gonger så mykje, og skyvaren nøler.
 */
import { SEAT_LOAD, armToHull, hull, hullArea, keep, smooth, wrapPi, type Pt } from "../core"
import type { Params } from "./params"

const DEG = Math.PI / 180
/** tynnaste gods nettet får ha; under dette er søyla luft */
export const MIN_T = 0.25

export type Detail = { nth: number; nrad: number; nz: number }
export const DETAIL: Record<"lav" | "mid" | "hog", Detail> = {
  lav: { nth: 72, nrad: 22, nz: 44 },
  mid: { nth: 120, nrad: 34, nz: 64 },
  hog: { nth: 192, nrad: 50, nz: 96 },
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

// =============================================================================
// FELTA
// =============================================================================
/** alt som berre kjem an på vinkelen, rekna éin gong */
export type Stripe = {
  th: number
  cos: number
  sin: number
  /** seterosetten sin radius */
  rs: number
  /** beinstjerna på golvet */
  rf: number
  /** halsen */
  rm: number
  /** setekanten si høgd */
  ze: number
  /** lobefunksjonen, 0 i kjervet og 1 på lobetuppen */
  Ls: number
  /** kor nær eit bein vinkelen ligg: 1 på beinaksen, 0 midt imellom */
  ang: number
}

export type Felt = {
  p: Params
  H: number
  /** midjehøgda i millimeter */
  zw: number
  /** krona, klemt slik at det alltid står gods mellom henne og setet */
  kvelv: number
  /** kjølen etter at freseradien har butta han */
  kryssEff: number
  k: number
  kb: number

  stripe(th: number): Stripe
  rSete(th: number): number
  rFot(th: number): number
  rMidje(th: number): number
  zEdge(th: number): number
  /** ytterradien i høgda z */
  rOut(st: Stripe, z: number): number
  /** setehøgda over eit punkt i planet */
  zSete(st: Stripe, rho: number): number
  /** kvelvinga si høgd under eit punkt i planet */
  zKvelv(st: Stripe, rho: number): number
  /** største planradius forma kan nå i det heile */
  rMax: number
}

function feltRaw(p: Params): Felt {
  const H = p.hogd
  const k = Math.max(2, Math.round(p.lobar))
  const kb = Math.max(2, Math.round(p.bein))
  const phi = p.vri * DEG
  const hb = Math.max(40, p.seteB / 2)
  const hd = Math.max(40, p.seteD / 2)
  const zw = p.midjeH * H

  // Kjølen er ei gaussisk renne. Ein kulefres med radius R kan ikkje lage
  // ei renne som krummar skarpare enn R, og krumminga i botnen er
  // 4,6·djup/halvbreidd². Difor vert djupna kappa her og ikkje i regelen:
  // regelen skal seie kor mykje som gjekk tapt, ikkje late som det står.
  const w = Math.max(12, p.kryssB / 2)
  const kryssEff = Math.min(p.kryss, (w * w) / (4.6 * Math.max(1, p.fresR)))
  const aFlat = Math.min(0.42, Math.max(0.08, 0.1 + 0.2 / p.beinbreidd))

  const Lsete = (th: number) => Math.pow((1 - Math.cos(k * th)) / 2, p.lobeform)
  const Lbein = (th: number) =>
    Math.pow((1 - Math.cos(kb * (th - phi))) / 2, p.beinbreidd)
  const ell = (th: number) =>
    (hd * hb) / Math.hypot(hb * Math.cos(th), hd * Math.sin(th))

  const rSete = (th: number) => ell(th) * (1 - p.lobeDjup * (1 - Lsete(th)))
  const rFot = (th: number) => p.fot * (p.innsnitt + (1 - p.innsnitt) * Lbein(th))
  // Halsen ligg `midjeInn` millimeter innanfor det største han kunne vore
  // utan å lage eit rom fresen ikkje når — og aldri smalare enn halsradien.
  const rMidje = (th: number) =>
    Math.max(p.midjeR, Math.min(rSete(th), rFot(th)) - p.midjeInn)

  // --- salen ---------------------------------------------------------------
  // Setet er ikkje ei skål: det er ein SAL. Renna på tvers gjer at dei to
  // halvdelane krøller seg opp ytst, kjølen deler dei frå kvarandre langs
  // midten, og lobetuppane ligg eit hakk over resten. Kvart ledd er
  // negativt eller null, so summen har eit toppunkt — og heile flata vert
  // løfta so det toppunktet ligg nøyaktig i `hogd`.
  const salRaw = (rs: number, Ls: number, c: number, s: number, rho: number) => {
    const rc = rho < rs ? rho : rs
    const y = rc * s
    const sy = y / hb
    const fx = (rc * c) / hd
    let z = -p.sal * (1 - Math.min(1, sy * sy))
    const ky = y / w
    z -= kryssEff * Math.exp(-2.3 * ky * ky)
    const ff = clamp01(fx)
    const fb = clamp01(-fx)
    z -= p.framfall * ff * ff * Math.sqrt(ff)
    z -= p.bakfall * fb * fb * Math.sqrt(fb)
    z -= p.lobekroll * (1 - Ls * smooth(rc / rs))
    const e = rs - rc
    if (e < p.kantR) {
      const d = p.kantR - e
      z -= p.kantR - Math.sqrt(Math.max(0, p.kantR * p.kantR - d * d))
    }
    return z
  }

  let topp = -Infinity
  for (let i = 0; i < 64; i++) {
    const th = (i / 64) * Math.PI * 2
    const rs = rSete(th)
    const Ls = Lsete(th)
    const c = Math.cos(th)
    const s = Math.sin(th)
    for (let j = 0; j <= 10; j++) {
      const v = salRaw(rs, Ls, c, s, (j / 10) * rs)
      if (v > topp) topp = v
    }
  }
  if (!Number.isFinite(topp)) topp = 0
  const lift = H - topp

  const stripe = (th: number): Stripe => {
    const c = Math.cos(th)
    const s = Math.sin(th)
    const Ls = Lsete(th)
    const rs = ell(th) * (1 - p.lobeDjup * (1 - Ls))
    const rf = rFot(th)
    const rm = Math.max(p.midjeR, Math.min(rs, rf) - p.midjeInn)
    const ze = lift + salRaw(rs, Ls, c, s, rs)
    const a = Math.abs(wrapPi(kb * (th - phi) - Math.PI)) / Math.PI
    const ang = Math.pow(smooth((1 - a) / (1 - aFlat)), p.bogeform)
    return { th, cos: c, sin: s, rs, rf, rm, ze, Ls, ang }
  }

  const zSete = (st: Stripe, rho: number) =>
    lift + salRaw(st.rs, st.Ls, st.cos, st.sin, rho)
  const zNav = zSete(stripe(0), 0)

  // Krona er taket i rommet under møbelet. Ho må stå under setet med gods
  // imellom, elles er objektet ikkje eitt stykke lenger.
  const kvelv = Math.min(Math.max(8, p.kvelv), zNav - 26)

  // --- ytterflata ----------------------------------------------------------
  // Over midja bømer halsen ut i setet, under sveipar han ut i beina.
  // Begge er `smooth(u^n)`: tangenten er loddrett i BEGGE endar, so
  // silhuetten står vertikalt under setekanten og vertikalt over fotputa,
  // og halsen møter dei utan knekk. Ein rein potens ville lagt ei kvass
  // egg under setekanten, og ei kvass egg er ikkje noko ein slipar fram.
  const rOut = (st: Stripe, z: number) => {
    let r: number
    if (z >= zw) {
      const ze = st.ze > zw + 6 ? st.ze : zw + 6
      const u = clamp01((z - zw) / (ze - zw))
      r = st.rm + (st.rs - st.rm) * smooth(Math.pow(u, p.halsN))
    } else {
      const u = clamp01((zw - z) / (zw > 1 ? zw : 1))
      r = st.rm + (st.rf - st.rm) * smooth(Math.pow(u, p.beinN))
    }
    if (z < p.foteR) {
      const d = p.foteR - z
      r -= p.foteR - Math.sqrt(Math.max(0, p.foteR * p.foteR - d * d))
    }
    return r > 1.5 ? r : 1.5
  }

  // --- kvelvinga -----------------------------------------------------------
  // Undersida er ein kryssande boge. Rett under eit bein ligg ho på golvet
  // over fotputa si lengd; på veg innover stig ho, og midt mellom to bein
  // står ho i krona heile vegen ut. Det er DEN forskjellen som gjer at
  // objektet står på skilde putar og ikkje på ein sokkel.
  const zKvelv = (st: Stripe, rho: number) => {
    if (st.ang <= 0) return kvelv
    // Putа byrjar `pute` millimeter innanfor beinenden, og springet seier
    // kor langt inne kvelvinga tek av. Rampa mellom dei to må ha lengd:
    // eit spring som kryp heilt ut til puta gjer overgangen til ei egg på
    // nokre få millimeter, og då står beinet att som ein flis i eitt snitt
    // og som ein klump i det neste. Tjue millimeter er golvet.
    const rp = Math.max(24, st.rf - p.pute)
    const r0 = Math.min(p.spring * st.rm, rp - 20)
    return kvelv * (1 - smooth((rho - r0) / (rp - r0)) * st.ang)
  }

  let rMax = 0
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * Math.PI * 2
    const a = rSete(th)
    const b = rFot(th)
    if (a > rMax) rMax = a
    if (b > rMax) rMax = b
  }

  return {
    p, H, zw, kvelv, kryssEff, k, kb,
    stripe, rSete, rFot, rMidje,
    zEdge: (th) => stripe(th).ze,
    rOut, zSete, zKvelv,
    rMax: rMax + 4,
  }
}

const FELT_HUGS = keep<Felt>(4)
export function felt(p: Params): Felt {
  return FELT_HUGS(JSON.stringify(p), () => feltRaw(p))
}

// =============================================================================
// SKANNINGA — kva dei to fresepassa når
// =============================================================================
export type Karv = {
  f: Felt
  nth: number
  nrad: number
  /** vinklane */
  th: Float64Array
  /** ytre planradius per vinkel */
  R: Float64Array
  /** planradien i kvar søyle */
  rho: Float64Array
  /** underside og overside etter fresing */
  zU: Float64Array
  zO: Float64Array
  /** innestengd tjukn i søyla — luft ingen av dei to passa når */
  hol: Float64Array
  /** planarealet søyla eig */
  cell: Float64Array

  /** volumet som faktisk står att etter fresing, mm³ */
  vol: number
  /** volumet forma ville hatt om alt lét seg nå, mm³ */
  ideal: number
  /** innestengt gods, mm³ */
  stengd: number
  /** innestengt gods som del av det freste volumet */
  stengdDel: number

  /** kontaktpunkta i planet */
  fot: Pt[]
  /** konveksa hylsteret av føtene */
  hylster: Pt[]
  /** kortaste vippearm frå midten, mm */
  vippArm: number
  /** kor mange skilde flater objektet står på */
  kontaktar: number
  /** støtteflata, altså hylsteret mellom putene, mm² */
  fotAreal: number

  // Fire tal reparasjonskaskaden treng, rekna her av di dei kostar
  // ingenting når skanninga fyrst er gjord — og av di kvart av dei er ein
  // SUM over geometrien og ikkje noko terningen kan kaste.
  envX: number
  envY: number
  /** arealvekta setehøgd over den midtre skiva, mm */
  sitZ: number
  /** brukbar sitjeflate, mm */
  seteW: number
  seteD: number
}

/** graderinga langs radien: tettare ute, der flanken snur */
const grad = (v: number) => 0.45 * v + 0.55 * (1 - Math.pow(1 - v, 1.7))
/** graderinga i det ytre bandet: tett i begge endar */
const grad2 = (v: number) => v * v * (3 - 2 * v)

// Søylesvaret som tre tal på modulnivå: ei allokering per søyle vert
// hundretusen allokeringar per bygg, og det er GC-en som betaler.
let sU = 0
let sO = 0
let sMat = 0

/**
 * Éi søyle. Materialet er dei høgdene der ytterradien rekk ut til ρ, klipt
 * mellom kvelvinga og setet. Fresen leverer INTERVALLET frå det nedste til
 * det øvste — alt imellom vert ståande, om det so var luft i teikninga.
 */
function soyle(
  f: Felt,
  st: Stripe,
  rho: number,
  Rz: Float64Array,
  zs: Float64Array,
): boolean {
  const kv = f.zKvelv(st, rho)
  const lo = kv > 0 ? kv : 0
  const hi = f.zSete(st, rho)
  sU = 0
  sO = 0
  sMat = 0
  if (hi - lo <= MIN_T) return false
  let first = Infinity
  let last = -Infinity
  let mat = 0
  const n = Rz.length - 1
  for (let j = 0; j < n; j++) {
    const za = zs[j]
    const zb = zs[j + 1]
    if (zb <= lo || za >= hi) continue
    const ra = Rz[j]
    const rb = Rz[j + 1]
    const insA = ra >= rho
    const insB = rb >= rho
    if (!insA && !insB) continue
    let s = za
    let e = zb
    if (insA !== insB) {
      const t = (rho - ra) / (rb - ra)
      const zc = za + t * (zb - za)
      if (insA) e = zc
      else s = zc
    }
    if (s < lo) s = lo
    if (e > hi) e = hi
    if (e <= s) continue
    if (s < first) first = s
    if (e > last) last = e
    mat += e - s
  }
  if (!(last - first >= MIN_T)) return false
  sU = first
  sO = last
  sMat = mat
  return true
}

function karvRaw(p: Params, d: Detail): Karv {
  const f = felt(p)
  const nth = d.nth
  const nrad = d.nrad
  const nz = d.nz
  const th = new Float64Array(nth)
  const R = new Float64Array(nth)
  const m = nrad + 1
  const rho = new Float64Array(nth * m)
  const zU = new Float64Array(nth * m)
  const zO = new Float64Array(nth * m)
  const hol = new Float64Array(nth * m)
  const cell = new Float64Array(nth * m)
  const dth = (Math.PI * 2) / nth

  const zs = new Float64Array(nz + 1)
  for (let j = 0; j <= nz; j++) zs[j] = (j / nz) * f.H
  const Rz = new Float64Array(nz + 1)
  // RUTENETTET FYLGJER DEI TO KANTANE.
  // Objektet har to loddrette vegger, og båe er ekte. Den eine står rett
  // utanfor setekanten, der oversida stuper frå setet ned på oversida av
  // beinet. Den andre står ytst på beinet, der undersida stuper frå
  // kvelvinga opp til undersida av setet. Ligg ikkje veggen på ei
  // rutelinje, fell ho mellom to ulike j frå vinkel til vinkel, og då kjem
  // ho ut som ein KAM av tynne finnar i staden for som ei vegg. Difor har
  // radien to BREKKPUNKT som fylgjer vinkelen sin eigen geometri.
  const j1 = Math.max(3, Math.round(nrad * 0.55))
  const j2 = Math.max(j1 + 2, Math.round(nrad * 0.86))
  const rj = new Float64Array(nrad + 2)

  let vol = 0
  let ideal = 0
  const fot: Pt[] = []
  const rort = new Uint8Array(nth)
  let envX = 0
  let envY = 0
  let sitA = 0
  let sitS = 0
  let sx0 = Infinity
  let sx1 = -Infinity
  let sy0 = Infinity
  let sy1 = -Infinity
  const setegolv = f.zw + (f.H - f.zw) * 0.5

  for (let i = 0; i < nth; i++) {
    const t = i * dth
    th[i] = t
    const st = f.stripe(t)
    for (let j = 0; j <= nz; j++) Rz[j] = f.rOut(st, zs[j])

    // Ytterkanten: største ρ der det står gods. Halvering, av di
    // materialet er samanhengande utover frå aksen — aksen har alltid
    // gods, av di krona er klemd under setet.
    let lo = 0
    let hi = f.rMax
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2
      if (soyle(f, st, mid, Rz, zs)) lo = mid
      else hi = mid
    }
    const Ri = lo > 8 ? lo : 8
    R[i] = Ri
    const base = i * m
    // setekanten og beinkanten, sorterte
    const rSeteK = st.rs
    const rBeinK = st.rf > st.rm ? st.rf : st.rm
    let b1 = Math.min(rSeteK, rBeinK, Ri * 0.9)
    let b2 = Math.min(Math.max(rSeteK, rBeinK), Ri * 0.97)
    if (b1 < Ri * 0.06) b1 = Ri * 0.06
    if (b2 <= b1 + Ri * 0.04) b2 = (b1 + Ri) / 2
    for (let j = 0; j <= nrad + 1; j++) {
      const jj = j > nrad ? nrad : j
      rj[j] =
        jj <= j1
          ? b1 * grad(jj / j1)
          : jj <= j2
            ? b1 + (b2 - b1) * grad2((jj - j1) / (j2 - j1))
            : b2 + (Ri - b2) * grad2((jj - j2) / (nrad - j2))
    }
    rj[nrad + 1] = Ri

    for (let j = 0; j <= nrad; j++) {
      const r = rj[j]
      rho[base + j] = r
      let u: number
      let o: number
      let h = 0
      if (soyle(f, st, r, Rz, zs)) {
        u = sU
        o = sO
        h = o - u - sMat
        if (h < 0) h = 0
      } else {
        // Ei tom søyle innanfor ytterkanten skal ikkje lage hol i nettet:
        // ho får ein film som ligg under det fresen kan skilje.
        const kv = f.zKvelv(st, r)
        u = kv > 0 ? kv : 0
        o = u + MIN_T
      }
      zU[base + j] = u
      zO[base + j] = o
      hol[base + j] = h
      const rl = j === 0 ? 0 : (rho[base + j - 1] + r) / 2
      const rh = j === nrad ? r : (r + rj[j + 1]) / 2
      const a = (dth / 2) * (rh * rh - rl * rl)
      cell[base + j] = a
      vol += (o - u) * a
      ideal += (o - u - h) * a
      if (u <= 0.6 && o - u > MIN_T * 4) {
        fot.push([r * st.cos, r * st.sin])
        rort[i] = 1
      }
      const x = r * st.cos
      const y = r * st.sin
      if (x > envX || -x > envX) envX = x > 0 ? x : -x
      if (y > envY || -y > envY) envY = y > 0 ? y : -y
      if (o >= setegolv) {
        if (x < sx0) sx0 = x
        if (x > sx1) sx1 = x
        if (y < sy0) sy0 = y
        if (y > sy1) sy1 = y
      }
      if (r <= 150) {
        sitA += a
        sitS += a * o
      }
    }
  }

  const hyl = fot.length >= 3 ? hull(fot) : []
  const vippArm = hyl.length >= 3 ? Math.max(0, armToHull(hyl, 0, 0)) : 0

  // Kor mange skilde flater står objektet på? Vinklane der det finst
  // kontakt vert talde som samanhengande bogar; ein boge er ein fot.
  // Bogen vert lesen av SØYLEINDEKSEN og ikkje av ein atan2 tilbake: eit
  // punkt som ligg nett på ei binngrense fell elles ut, og éi tom binn
  // midt i ei pute gjer éin fot om til to.
  let kontaktar = 0
  for (let i = 0; i < nth; i++) {
    if (rort[i] && !rort[(i + nth - 1) % nth]) kontaktar++
  }
  if (!kontaktar && fot.length) kontaktar = 1

  const stengd = vol - ideal
  return {
    f, nth, nrad, th, R, rho, zU, zO, hol, cell,
    vol, ideal, stengd,
    stengdDel: vol > 0 ? stengd / vol : 0,
    fot, hylster: hyl, vippArm, kontaktar,
    fotAreal: hyl.length >= 3 ? hullArea(hyl) : 0,
    envX: 2 * envX,
    envY: 2 * envY,
    sitZ: sitA > 0 ? sitS / sitA : f.H,
    seteW: Number.isFinite(sy0) ? sy1 - sy0 : 0,
    seteD: Number.isFinite(sx0) ? sx1 - sx0 : 0,
  }
}

const KARV_HUGS = keep<Karv>(4)
export function karv(p: Params, d: Detail): Karv {
  return KARV_HUGS(JSON.stringify(p) + "|" + d.nth, () => karvRaw(p, d))
}

/** den grove skanninga reparasjonskaskaden spør — same hugs, lågt nivå */
export function formOf(p: Params): Karv {
  return karv(p, DETAIL.lav)
}

// =============================================================================
// PLATENE I BLOKKEN
// =============================================================================
export type Plate = {
  i: number
  z0: number
  z1: number
  /** grovkutta kontur, mot klokka */
  outline: Pt[]
  area: number
}

/**
 * Emnet. Kvar plate vert grovkutta til det største omrisset objektet har
 * innanfor sitt eige høgdeband, pluss sagmon — og aldri smalare enn ein
 * bod som held plata i eitt stykke gjennom limpressa. Nedst er objektet
 * fire skilde putar, men plata kan ikkje vera fire lause bitar før ho er
 * limt: fresen skil føtene, ikkje saga.
 *
 * `emneform` dreg konturen mot sitt eige omskrivne rektangel. På éin er
 * emnet ein rein KASSE, og då er svinnet det ein får når ein limer opp
 * ein blokk og karvar alt anna vekk.
 */
const PLATE_HUGS = keep<Plate[]>(4)

export function plater(k: Karv, p: Params): Plate[] {
  return PLATE_HUGS(JSON.stringify(p) + "|" + k.nth, () => platerRaw(k, p))
}

function platerRaw(k: Karv, p: Params): Plate[] {
  const H = k.f.H
  const n = Math.max(2, Math.min(90, Math.ceil(H / p.plyT)))
  const m = k.nrad + 1
  const bod = Math.max(26, p.midjeR * 0.55)
  // rad[band · nth + i] — største radius objektet har i bandet ved vinkelen.
  // ρ veks med j, so den siste tilordninga i lykkja er den største.
  const rad = new Float64Array(n * k.nth).fill(bod)
  for (let i = 0; i < k.nth; i++) {
    for (let j = 0; j <= k.nrad; j++) {
      const q = i * m + j
      let b0 = Math.floor(k.zU[q] / p.plyT)
      let b1 = Math.floor(k.zO[q] / p.plyT)
      if (b0 < 0) b0 = 0
      if (b1 > n - 1) b1 = n - 1
      const r = k.rho[q]
      for (let b = b0; b <= b1; b++) rad[b * k.nth + i] = r
    }
  }

  const out: Plate[] = []
  for (let b = 0; b < n; b++) {
    const z0 = b * p.plyT
    const z1 = Math.min(H, z0 + p.plyT)
    let bx = 0
    let by = 0
    for (let i = 0; i < k.nth; i++) {
      const r = rad[b * k.nth + i] + p.sagmon
      rad[b * k.nth + i] = r
      const ax = Math.abs(r * Math.cos(k.th[i]))
      const ay = Math.abs(r * Math.sin(k.th[i]))
      if (ax > bx) bx = ax
      if (ay > by) by = ay
    }
    const ring: Pt[] = []
    for (let i = 0; i < k.nth; i++) {
      const c = Math.cos(k.th[i])
      const s = Math.sin(k.th[i])
      const r0 = rad[b * k.nth + i]
      const rect = Math.min(
        Math.abs(c) > 1e-6 ? bx / Math.abs(c) : 1e9,
        Math.abs(s) > 1e-6 ? by / Math.abs(s) : 1e9,
      )
      const r = r0 + (rect - r0) * p.emneform
      ring.push([r * c, r * s])
    }
    let area = 0
    for (let a = 0; a < ring.length; a++) {
      const q = ring[(a + 1) % ring.length]
      area += ring[a][0] * q[1] - q[0] * ring[a][1]
    }
    out.push({ i: b, z0, z1, outline: ring, area: Math.abs(area) / 2 })
  }
  return out
}

// =============================================================================
// SNITTET ETTER FRESEN
// =============================================================================
export type Snitt = {
  /** minste vassrette snitt i det freste godset, mm² */
  minA: number
  minZ: number
  /** største trykkspenning, MPa */
  sigC: number
  /** største bøyespenning i eit bein, MPa */
  sigM: number
  /** vinkelen beinaksen står i mot limfuga, grader — 90 er reint trykk */
  fugeVinkel: number
  /** godset i det smalaste beinsnittet, mm² */
  beinA: number
  beinZ: number
}

/**
 * Skanninga av snitt. Éin gjennomgang per høgd gjev både det samla
 * tverrsnittet og kvart bein for seg — og beinet treng meir enn arealet:
 * tyngdepunktet og andremomentet, av di eit sveipa bein får bøying av at
 * godset ikkje ligg på trykklina mellom halsen og fotputa.
 */
export function snitt(k: Karv): Snitt {
  const p = k.f.p
  const H = k.f.H
  const zw = k.f.zw
  const kb = k.f.kb
  const phi = p.vri * DEG
  const m = k.nrad + 1
  const NZ = 30

  // kva bein kvar vinkel høyrer til
  const legIdx = new Int32Array(k.nth)
  for (let i = 0; i < k.nth; i++) {
    const t = k.th[i]
    const q = Math.round((t - phi - Math.PI / kb) / ((Math.PI * 2) / kb))
    legIdx[i] = ((q % kb) + kb) % kb
  }

  // fotputa sitt tyngdepunkt per bein — enden på trykklina
  const padA = new Float64Array(kb)
  const padR = new Float64Array(kb)
  for (let i = 0; i < k.nth; i++) {
    for (let j = 0; j <= k.nrad; j++) {
      const q = i * m + j
      if (k.zU[q] > 0.6) continue
      const a = k.cell[q]
      padA[legIdx[i]] += a
      padR[legIdx[i]] += a * k.rho[q]
    }
  }

  // Snittet skal lesast der LASTA går: frå golvet opp gjennom halsen. Over
  // midja veks snittet til heile setekroppen, og heilt oppe under
  // setekanten krympar det til null att — men det er ikkje eit berande
  // snitt, det er kanten på ei plate ingen sit på.
  const zLim = zw + (H - zw) * 0.1
  const zLegLo = Math.max(12, p.foteR + 6)
  let minA = Infinity
  let minZ = 0
  let sigC = SEAT_LOAD / 1e6
  let sigM = 0
  let beinA = Infinity
  let beinZ = 0
  let fugeVinkel = 90

  const A = new Float64Array(kb)
  const S1 = new Float64Array(kb)
  const S2 = new Float64Array(kb)
  const rlo = new Float64Array(kb)
  const rhi = new Float64Array(kb)

  for (let s = 1; s < NZ; s++) {
    const z = 3 + ((s - 1) / (NZ - 1)) * (zLim - 3)
    A.fill(0)
    S1.fill(0)
    S2.fill(0)
    rlo.fill(Infinity)
    rhi.fill(0)
    let tot = 0
    for (let i = 0; i < k.nth; i++) {
      const L = legIdx[i]
      for (let j = 0; j <= k.nrad; j++) {
        const q = i * m + j
        if (k.zU[q] > z || k.zO[q] < z) continue
        const a = k.cell[q]
        const r = k.rho[q]
        tot += a
        A[L] += a
        S1[L] += a * r
        S2[L] += a * r * r
        if (r < rlo[L]) rlo[L] = r
        if (r > rhi[L]) rhi[L] = r
      }
    }
    if (tot > 0 && tot < minA) {
      minA = tot
      minZ = z
    }
    if (z >= zw * 0.9 || z < zLegLo) continue
    // under midja er snittet delt i bein, og kvart bein ber for seg
    for (let L = 0; L < kb; L++) {
      if (A[L] < 200) continue
      const rbar = S1[L] / A[L]
      const I = Math.max(1, S2[L] - A[L] * rbar * rbar)
      const c = Math.max(4, Math.max(rhi[L] - rbar, rbar - rlo[L]))
      const W = I / c
      // trykklina: frå halsen ned til fotputa sitt tyngdepunkt
      const rTop = k.f.rMidje(phi + Math.PI / kb + (L * Math.PI * 2) / kb)
      const rPad = padA[L] > 0 ? padR[L] / padA[L] : rTop
      const dx = rPad - rTop
      const dz = -zw
      const Lc = Math.hypot(dx, dz) || 1
      const cosB = Math.abs(dz) / Lc
      const e = Math.abs((rbar - rTop) * dz - (z - zw) * dx) / Lc
      const N = SEAT_LOAD / kb / Math.max(0.25, cosB)
      const sc = N / Math.max(1, A[L] * cosB)
      const sm = (N * e) / Math.max(1, W * cosB)
      if (sc > sigC) sigC = sc
      if (sm > sigM) sigM = sm
      if (A[L] < beinA) {
        beinA = A[L]
        beinZ = z
        // Limfugene ligg vassrett. Vinkelen mellom beinaksen og fuga seier
        // om lasta står PÅ fuga eller SKYV langs henne.
        fugeVinkel = (Math.acos(Math.min(1, Math.max(0, Math.abs(dx) / Lc))) * 180) / Math.PI
      }
    }
  }
  if (!Number.isFinite(minA)) minA = 1
  if (!Number.isFinite(beinA)) beinA = minA
  sigC = Math.max(sigC, SEAT_LOAD / Math.max(1, minA))
  return { minA, minZ, sigC, sigM, fugeVinkel, beinA, beinZ }
}

