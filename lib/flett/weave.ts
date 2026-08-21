/**
 * FLETT — veven.
 *
 * Alt objektet er, ligg her: planet, ramma, banda og krysspunkta deira.
 * Byggjaren, måltala, reglane og kuttfila les denne fila og ingen annan.
 *
 * TRE KOORDINATAR STYRER ALT
 *   y      sideveg — der RENNINGSbanda ligg, eitt band per y
 *   σ      langs vevflata frå framkanten og bakover; på setet er σ = a − x,
 *          og held veven fram opp i ryggbogen, er σ setelengda pluss
 *          klatrelengda. Eitt INNSLAGsband per σ.
 *   ζ      klatrelengda opp i bogen, null ved bakkanten
 *
 * Grunnen til at σ finst i staden for berre x: ryggen er ikkje eit anna
 * stykke, han er DEI SAME BANDA bøygde opp. Med σ er setet og ryggen éin
 * flate, og mønsteret held fram over kanten utan eit einaste unntak i
 * koden. Det er heile grunnen til at ein vev kan klatre og ei plate ikkje.
 *
 * PLANET er ei superellipse om ramma si INNERKANT: (|x/a|^n + |y/b|^n) = 1.
 * Framme brukar han eksponenten planN; bak brukar han planN + 14·bakflat,
 * so bakkanten kan rettast ut utan at forma får eit knekk nokon stad.
 * Bogen krev den rette bakkanten: eit rakt band kan ikkje leggjast langs
 * ei kurve i sitt eige plan.
 */
import { keep, type Pt, type Vec3 } from "../core"
import { EMOD, type Params } from "./params"

const DEG = Math.PI / 180

/** eitt fletta band, ferdig lagt i rommet */
export type Band = {
  /** 0 er renning (fram–bak), 1 er innslag (på tvers) */
  dir: 0 | 1
  k: number
  /** y for renning, σ for innslag */
  pos: number
  w: number
  t: number
  /** senterlina, tett samla frå feste til feste */
  pts: Vec3[]
  /** kor mange av punkta som er festetamp i kvar ende */
  tail0: number
  tail1: number
  /** minste bøyeradius i den FLETTA delen, mm */
  rmin: number
  /** flat kuttlengd, mm — bogelengda langs heile lina */
  cut: number
  /** rett spenn mellom festa, mm */
  spenn: number
  /** kor mange band han kryssar */
  kryss: number
}

/** eitt innslag sin plass langs σ */
export type Stasjon = {
  i: number
  s: number
  /** halv utstrekning på tvers ved denne σ, mm */
  Y: number
  bak: boolean
}

export type Leg = {
  /** vinkelen i planet der beinet står */
  th: number
  /** radius til ramma si midtlinje der */
  r: number
}

export type Weave = {
  p: Params
  a: number
  b: number
  /** eksponenten framme og bak */
  nF: number
  nB: number
  /** ramma si midtlinje, radius i retning th */
  rimR(th: number): number
  /** ramma si INNERKANT, radius i retning th */
  innR(th: number): number
  /** rammeplanet si høgd ved x (ramma er flat, men kan vera vippa) */
  zRim(x: number): number
  /** vevmidtplanet */
  zm(x: number, y: number): number
  /** halv utstrekning på tvers ved σ */
  spanAt(s: number): number
  /** setelengda langs σ, mm */
  sSeat: number
  /** klatrelengda veven når opp i bogen, mm */
  hVev: number
  /** breidda på sjølve bogeplata, målt langs klatringa, mm */
  wBow: number
  /** radien bandet vert bøygd i over bakkanten, mm */
  Rk: number
  /** bogelengda i knekken, og den rette klatringa etter han, mm */
  arcLen: number
  hClimb: number
  /** bogen si lening i radianar */
  vLean: number
  /** kor stor del av bogehøgda som står att ved y */
  bowArch(y: number): number
  /** ryggflata som funksjon av vegstykket bakom setekanten */
  backAt(t: number, y: number): Vec3
  /** bogen si halve breidd, mm */
  bw: number
  /** x der bogen reiser seg */
  xChord: number
  /** punkt på vevflata */
  srf(s: number, y: number): Vec3

  warp: Band[]
  weft: Band[]
  stasjonar: Stasjon[]
  /** y-posisjonen til kvart renningsband */
  ys: number[]
  /** minste luft mellom banda kvar veg, mm */
  gapRen: number
  gapInn: number
  /** deling: bandbreidd pluss luft, mm */
  pRen: number
  pInn: number
  /** total tjukn i eit kryss */
  stakk: number

  legs: Leg[]
  /** ramma sine bogar som [th0, th1] — ein lukka hank er eitt heilt lag */
  arcs: [number, number][]
  /** ramma si overside, høgd over rammeplanet */
  rimOff: number
  /** E-modul for bandet, MPa */
  E: number
}

// =============================================================================
// SUPERELLIPSE
// =============================================================================
/**
 * Radius i retning th for superellipsa med halvaksane a og b.
 *
 * Rekninga er normalisert mot det største leddet FØR potensen. Med ein rett
 * bakkant er eksponenten oppe i seksten, og då er (cos th / a)^n kring
 * 1e-23: eit reint uttrykk flyt under og gjev radius null — beinet fell
 * inn i origo og møbelet står på ein tapp. Feilen syner seg ikkje i
 * planet, berre i fotavtrykket, og det er difor ho må stengjast her.
 */
function superRad(th: number, a: number, b: number, n: number): number {
  const c = Math.abs(Math.cos(th) / a)
  const s = Math.abs(Math.sin(th) / b)
  const mx = Math.max(c, s)
  if (mx < 1e-12) return 0
  const q = Math.pow(c / mx, n) + Math.pow(s / mx, n)
  return 1 / (mx * Math.pow(q, 1 / n))
}

/** halv utstrekning i y ved x — bak brukar han sin eigen eksponent */
function yAtX(x: number, a: number, b: number, n: number): number {
  const u = Math.min(1, Math.abs(x) / a)
  return b * Math.pow(Math.max(0, 1 - Math.pow(u, n)), 1 / n)
}

/** halv utstrekning i x ved y */
function xAtY(y: number, a: number, b: number, n: number): number {
  const v = Math.min(1, Math.abs(y) / b)
  return a * Math.pow(Math.max(0, 1 - Math.pow(v, n)), 1 / n)
}

// =============================================================================
// DELING — banda lagde ut over ei opning
// =============================================================================
/**
 * n band med breidda w lagde ut over ei opning på L, med n+1 luker.
 * Fallet graderer lukene: positivt fall pakkar banda mot midten og legg
 * lufta ut mot kantane. Summen av lukene står FAST — vektene vert
 * normaliserte mot sin eigen sum — so opninga og bandtalet er urørte av
 * fallet, og berre fordelinga endrar seg.
 */
function layOut(L: number, n: number, w: number, fall: number): { c: number[]; gap: number } {
  const m = n + 1
  const rest = L - n * w
  const ws: number[] = []
  for (let j = 0; j < m; j++) {
    const c = m > 1 ? Math.abs(j - (m - 1) / 2) / ((m - 1) / 2) : 1
    ws.push(Math.max(0.05, 1 - fall * (1 - c)))
  }
  const sum = ws.reduce((s, q) => s + q, 0)
  const gaps = ws.map((q) => (rest * q) / sum)
  const centres: number[] = []
  let at = -L / 2
  let gmin = Infinity
  for (let j = 0; j < n; j++) {
    at += gaps[j]
    if (gaps[j] < gmin) gmin = gaps[j]
    centres.push(at + w / 2)
    at += w
  }
  if (gaps[n] < gmin) gmin = gaps[n]
  return { c: centres, gap: gmin }
}

// =============================================================================
// MØNSTERET
// =============================================================================
/**
 * Ligg renningsband j OVER innslag i?
 *
 * Mønsteret er over-flott, under-flott, med eit skift per renning. Med
 * flott 1 og skift 1 er det toskaft — over eitt, under eitt, rutete. Med
 * flott 2 og skift 1 er det kypert: flotta går diagonalt. Med skift 0 er
 * det rips — kvar renning ligg likt, og flotta stiller seg opp i kolonner
 * i staden for å vandre. Skift lik flott gjev korg: banda parvis.
 *
 * Flottlengda er ikkje pynt. Ho set bøyeperioden: eit band som flyt over
 * to kryss har DOBBELT so lang veg på seg til å svinge frå topp til botn,
 * og radien veks med kvadratet av den vegen. Det er difor eit kypert kan
 * pakke banda dobbelt so tett som eit toskaft av same tjukn.
 */
/**
 * FLOTTLENGDA I KVAR RETNING.
 *
 * Langs eit renningsband er flottet alltid `flott` langt: indeksen aukar
 * med eitt per kryss. Langs eit INNSLAG er det ikkje sikkert i det heile —
 * der aukar mønsterargumentet med `skift` per band, og med skift 2 i eit
 * kypert på to hoppar arguméntet forbi kvart anna steg: flottet vert eitt
 * einaste kryss langt, og innslaget må svinge dobbelt so ofte som
 * renninga. Same mønster, to heilt ulike bøyeradiar.
 *
 * Skift null er ripsen: alle renningane ligg likt, so innslaget kryssar
 * aldri over til andre sida og har inga svinging i det heile.
 */
export function floats(flott: number, skift: number): { renning: number; innslag: number } {
  const m = Math.max(1, Math.round(flott))
  const per = 2 * m
  const sh = (((Math.round(skift) % per) + per) % per)
  if (sh === 0) return { renning: m, innslag: 64 }
  const N = 4 * per + 2
  const v: boolean[] = []
  for (let j = 0; j < N; j++) v.push(((-sh * j) % per + per) % per < m)
  let best = Infinity
  let run = 1
  for (let j = 1; j < N; j++) {
    if (v[j] === v[j - 1]) run++
    else {
      if (j > per) best = Math.min(best, run)
      run = 1
    }
  }
  return { renning: m, innslag: Number.isFinite(best) ? best : 64 }
}

function over(i: number, j: number, flott: number, skift: number): boolean {
  const m = Math.max(1, Math.round(flott))
  const per = 2 * m
  const q = (((i - Math.round(skift) * j) % per) + per) % per
  return q < m
}

// =============================================================================
// KURVATUR
// =============================================================================
/** radius gjennom tre punkt — omkrinsradien. Rett line gjev uendeleg. */
function triR(a: Vec3, b: Vec3, c: Vec3): number {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2]
  const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2]
  const cx = uy * vz - uz * vy
  const cy = uz * vx - ux * vz
  const cz = ux * vy - uy * vx
  const area2 = Math.hypot(cx, cy, cz)
  if (area2 < 1e-12) return Infinity
  return (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) * Math.hypot(wx, wy, wz)) / (2 * area2)
}

/**
 * Overgangen mellom to flottmidtar er ei HALV COSINUSBYLGJE og ikkje ein
 * smoothstep. Skilnaden er ikkje kosmetisk: ein smoothstep har toppkrumming
 * 6/Δ² medan cosinusen har π²/Δ², altso tjueto prosent mindre — og det er
 * cosinusen som svarar til formelen regelen om bøyeradius byggjer på.
 * Bytte ein interpolant her, ville geometrien og regelen ikkje lenger
 * snakke om det same bandet.
 */
const ss = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return (1 - Math.cos(Math.PI * u)) / 2
}

// =============================================================================
// VEVEN
// =============================================================================
const VEV_HUGS = keep<Weave>(4)

export function makeWeave(p: Params): Weave {
  return VEV_HUGS(JSON.stringify(p), () => makeWeaveRaw(p))
}

function makeWeaveRaw(p: Params): Weave {
  const a = p.djup / 2
  const b = p.breidd / 2
  const nF = p.planN
  const nB = p.planN + 14 * p.bakflat
  const E = EMOD(p.material)
  const stakk = p.renT + p.innT
  const tanH = Math.tan(p.helling * DEG)

  // Ramma er FLAT — ho er skoren av plate og ligg vassrett. Setehellinga
  // vippar heile planet, og eit vippa plan er framleis eit plan, so ringen
  // held seg kuttbar. Difor er zRim lineær i x og ikkje ei kurve.
  const zRim = (x: number) => p.hogd - tanH * (a - x)

  /**
   * Vevmidtplanet.
   *
   * Krona er ei BULE SOM ER NULL PÅ RAMMA: banda kan ikkje ende høgare enn
   * festet sitt, so amplituden må gå ut i (1 − ρ²) der ρ er superellipsa
   * sin eigen radius. Kantfallet dreg heile kanten `vulst` under
   * rammeplanet, likt heile vegen rundt — det er den mjuke overgangen frå
   * sitjeflate til ramme.
   *
   * Retningsvekta står som (1 − 0,5·u²) og ikkje som (1 − u²). Skilnaden
   * er heile bøyebudsjettet: eit produkt av to (1 − u²) er ein FJERDEGRADS
   * flate, og ein fjerdegrads flate har si verste krumming nett ute ved
   * ramma — der bandet alt er bøygd av flettinga. Med halv vekt held
   * krumminga seg under ein tredel av det, og krona kostar då ikkje meir
   * enn ho er verd.
   */
  const zm = (x: number, y: number): number => {
    const u = Math.min(1.15, Math.abs(x) / a)
    const v = Math.min(1.15, Math.abs(y) / b)
    const n = x >= 0 ? nF : nB
    const rho = Math.min(1.15, Math.pow(Math.pow(u, n) + Math.pow(v, n), 1 / n))
    const amp =
      p.kroneTvers * (1 - 0.5 * u * u) + p.kroneLangs * (1 - 0.5 * v * v)
    return zRim(x) + amp * (1 - rho * rho) - p.vulst * rho * rho
  }

  // --- ryggbogen ------------------------------------------------------------
  // Bogen er ei plate på tvers øvst i ryggen, og det er HO som tek imot
  // bandendane. Difor kan ikkje veven klatre heilt til topps: dei øvste
  // `wBow` millimeterane er sjølve plata. Under tretti millimeter plate
  // finst det ikkje gods til eit feste, og over nitti er ho ei rygglene i
  // staden for ein boge.
  const wBow = Math.min(90, Math.max(30, p.ryggH * (1 - p.ryggDekk)))
  const vLean = p.ryggV * DEG
  const bw = b * 0.86

  // KNEKKEN. Eit band kan ikkje snu eit hjørne. Går veven frå sete til
  // rygg, må han svinge kring bakkanten av ramma, og den svingen er ein
  // ekte sirkelboge med radien til den kanten — ikkje eit knekkpunkt. Ein
  // rett vinkel i lina ville gjeve ein bøyeradius på nokre få millimeter,
  // og det er ikkje ein tett vev, det er eit brot.
  //
  // Radien er halve rammebreidda: bandet legg seg kring bakkanten slik det
  // ville gjort kring ein rundstav. Det er den same VARIGE bøyinga som i
  // omslagsfestet — bandet vert bløytt og lagt — og han vert prøvd mot det
  // same kravet, ikkje mot det kalde på hundre til hundre og femti.
  const Rk = Math.max(16, p.rammeH * 0.45)
  const theta = Math.PI / 2 - vLean
  const zArc = Rk * (1 - Math.cos(theta))
  const hVevTot = p.ryggH >= 30 ? Math.max(0, p.ryggH - wBow) : 0
  const klatrar = hVevTot >= zArc + 25
  const arcLen = klatrar ? Rk * theta : 0
  const hClimb = klatrar ? (hVevTot - zArc) / Math.max(0.3, Math.cos(vLean)) : 0
  const hVev = klatrar ? arcLen + hClimb : 0

  // Bogen reiser seg frå ein RETT streng. Kor rett bakkanten faktisk er,
  // avgjer kor mykje av setet som fell utanfor strengen — difor er
  // bakflat-regelen hard når bogen finst.
  let xChord = -a
  if (hVev > 0) {
    let sum = 0
    for (let q = 0; q < 7; q++) sum += xAtY((q / 6) * bw, a, b, nB)
    xChord = -sum / 7
  }

  const sSeat = a - xChord
  const sTot = sSeat + hVev

  /**
   * Ryggen si flate, som funksjon av vegstykket `t` bakom setekanten.
   * Fyrst bogen kring bakkanten, so den rette klatringa med bukta si.
   * Funksjonen er definert LENGRE enn veven når — bogeplata bur i det
   * same rommet, berre ovanfor.
   */
  const backAt = (t: number, y: number): Vec3 => {
    const z0 = zm(xChord, y)
    if (t <= arcLen || arcLen <= 0) {
      const phi = arcLen > 0 ? t / Rk : 0
      return [xChord - Rk * Math.sin(phi), y, z0 + Rk * (1 - Math.cos(phi))]
    }
    const z = t - arcLen
    // Bukta krummar bogen MONOTONT bakover på vegen opp, som ei kvadratisk
    // parabel. Ei bule — ut og inn att — ville ha ti gonger så stor
    // krumming for same utslag, og ho ville dessutan gje eit knekk i
    // skøyten mot bogen: ein sinus har si brattaste stigning der han
    // startar. Parabelen startar med null stigning, so lina er glatt heilt
    // frå setekanten og opp.
    // Bukta vert målt over HEILE den rette strekninga — klatringa pluss
    // bogeplata over henne — og ikkje berre over den delen veven når. Ein
    // boge er eitt bøygd stykke, og krumminga hans fell med kvadratet av
    // lengda han får krumme seg over: same utslag over dobbelt so lang veg
    // er fire gonger mildare for bandet som skal fylgje han.
    const hTot = hClimb + wBow / Math.max(0.35, Math.cos(vLean))
    const bukt = hTot > 0 ? p.ryggB * Math.pow(Math.min(1.4, z / hTot), 2) : 0
    return [
      xChord - Rk * Math.sin(theta) - Math.sin(vLean) * z - bukt * Math.cos(vLean),
      y,
      z0 + zArc + Math.cos(vLean) * z - bukt * Math.sin(vLean),
    ]
  }

  /** vevflata: punkt ved (σ, y) */
  const srf = (s: number, y: number): Vec3 => {
    if (s <= sSeat) {
      const x = a - s
      return [x, y, zm(x, y)]
    }
    return backAt(s - sSeat, y)
  }

  /** kor stor del av bogehøgda som står att ved y — superelliptisk boge */
  const bowArch = (y: number) =>
    Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(y) / bw), 2.6)), 1 / 2.6)

  /** halv utstrekning på tvers ved σ */
  const spanAt = (s: number): number => {
    if (s <= sSeat) {
      const x = a - s
      return yAtX(x, a, b, x >= 0 ? nF : nB)
    }
    const t = hVev > 0 ? Math.min(1, (s - sSeat) / hVev) : 1
    return bw * Math.pow(Math.max(0, 1 - Math.pow(t, 2.6)), 1 / 2.6)
  }

  // --- deling ---------------------------------------------------------------
  const nRen = Math.max(3, Math.round(p.renN))
  const nInn = Math.max(3, Math.round(p.innN))
  const lr = layOut(p.breidd, nRen, p.renW, p.renFall)
  const ys = lr.c
  const gapRen = lr.gap
  const li = layOut(sSeat, nInn, p.innW, p.innFall)
  const gapInn = li.gap
  const pRen = p.renW + gapRen
  const pInn = p.innW + gapInn

  // Innslaga på setet ligg der delinga la dei; held veven fram opp i
  // bogen, kjem det fleire til med SAME deling. Ryggen er ikkje ei ny
  // rekning — han er den same veven, berre lengre.
  const stasjonar: Stasjon[] = []
  li.c.forEach((c, i) => {
    stasjonar.push({ i, s: c + sSeat / 2, Y: spanAt(c + sSeat / 2), bak: false })
  })
  if (hVev > 0) {
    let s = sSeat + gapInn + p.innW / 2
    while (s + p.innW / 2 <= sTot + 1e-6 && stasjonar.length < 60) {
      stasjonar.push({ i: stasjonar.length, s, Y: spanAt(s), bak: true })
      s += pInn
    }
  }

  // =========================================================================
  // BANDA
  // =========================================================================
  /**
   * Festetampen. Tre måtar å ta imot ein bandende på, og dei tre kostar
   * kvar sitt: slissa et gods av ramma, omslaget krev at ramma er tjukk
   * nok til å bøye bandet rundt, og leppa krev limflate.
   */
  const tailPts = (
    end: Vec3,
    dirv: Vec3,
    up: Vec3,
  ): Vec3[] => {
    const out: Vec3[] = []
    const go = (d: number, u: number) =>
      out.push([
        end[0] + dirv[0] * d + up[0] * u,
        end[1] + dirv[1] * d + up[1] * u,
        end[2] + dirv[2] * d + up[2] * u,
      ])
    if (p.feste === 2) {
      // leppa: bandet stig opp i ein fals i ramma si overkant og sluttar der
      const L = Math.min(p.kant, p.rammeH - 10)
      go(L * 0.5, p.rammeT * 0.18)
      go(L, p.rammeT * 0.3)
      return out
    }
    if (p.feste === 1) {
      // omslaget: ut over ramma, kring ytterkanten og ned utsida
      const R = p.rammeT / 2
      go(p.rammeH - R, 0)
      for (let q = 1; q <= 4; q++) {
        const t = (q / 4) * (Math.PI / 2)
        go(p.rammeH - R + R * Math.sin(t), -R + R * Math.cos(t))
      }
      go(p.rammeH, -R - p.kant)
      return out
    }
    // slissa: rett inn i eit sagsnitt i ramma si innerside
    const L = Math.min(p.kant, p.rammeH - 12)
    go(L * 0.5, 0)
    go(L, 0)
    return out
  }

  /**
   * `hopp` merkjer dei punkta som ligg i KNEKKEN over bakkanten. Den bøyen
   * er ei varig form og ikkje ei elastisk, og han vert prøvd for seg i
   * regelen om festebøyen — tek han med her, ville han skygge for den
   * einaste bøyen regelen om bøyeradius handlar om: sjølve flettinga.
   */
  const bandCurve = (pts: Vec3[], t0: number, t1: number, w: number, t: number, dir: 0 | 1, k: number, pos: number, kryss: number, hopp?: boolean[]): Band => {
    let cut = 0
    for (let q = 1; q < pts.length; q++) {
      cut += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2])
    }
    let rmin = Infinity
    for (let q = t0 + 1; q < pts.length - t1 - 1; q++) {
      if (hopp && (hopp[q - 1 - t0] || hopp[q - t0] || hopp[q + 1 - t0])) continue
      const r = triR(pts[q - 1], pts[q], pts[q + 1])
      if (r < rmin) rmin = r
    }
    const A = pts[t0]
    const B = pts[pts.length - 1 - t1]
    return {
      dir, k, pos, w, t, pts, tail0: t0, tail1: t1,
      rmin: Number.isFinite(rmin) ? rmin : 1e6,
      cut,
      spenn: Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]),
      kryss,
    }
  }

  /**
   * Kontrollpunkta for over-under-lina. Krysspunkta med same forteikn vert
   * samla i FLOTT, og kvart flott får eitt kontrollpunkt i sitt eige
   * midtpunkt. Det er nett den konstruksjonen som gjer at eit langt flott
   * gjev ei lang, roleg svinging og eit kort flott ei brå: perioden er
   * avstanden mellom flottmidtane, og han er flottlengda gonger delinga.
   */
  const controls = (
    pos: number[],
    sign: number[],
    p0: number,
    p1: number,
    m: number,
    pitch: number,
  ): { x: number[]; g: number[] } => {
    const X: number[] = []
    const G: number[] = []
    X.push(p0)
    G.push(sign.length ? sign[0] : 0)
    let q = 0
    while (q < pos.length) {
      let r = q
      while (r + 1 < pos.length && sign[r + 1] === sign[q]) r++
      let mid = 0
      for (let z = q; z <= r; z++) mid += pos[z]
      const len = r - q + 1
      mid /= len
      // Fyrste og siste flott er som regel AVKUTTA — bandet byrjar midt i
      // eit flott. Eit avkutta flott har midtpunktet sitt for nær nabo-
      // flottet, og då vert den fyrste svingen brattare enn alle dei andre
      // utan at mønsteret er annleis der. Difor vert midtpunktet skuve ut
      // til der det ville lege om flottet var heilt.
      if (len < m) {
        if (q === 0) mid -= ((m - len) / 2) * pitch
        if (r === pos.length - 1) mid += ((m - len) / 2) * pitch
      }
      if (mid > p0 + 0.5 && mid < p1 - 0.5) {
        X.push(mid)
        G.push(sign[q])
      }
      q = r + 1
    }
    X.push(p1)
    G.push(sign.length ? sign[sign.length - 1] : 0)
    return { x: X, g: G }
  }

  /** verdien til den glatta forteiknkurva ved t */
  const gAt = (c: { x: number[]; g: number[] }, t: number): number => {
    if (t <= c.x[0]) return c.g[0]
    for (let q = 1; q < c.x.length; q++) {
      if (t <= c.x[q]) {
        const d = c.x[q] - c.x[q - 1]
        if (d < 1e-9) return c.g[q]
        return c.g[q - 1] + (c.g[q] - c.g[q - 1]) * ss((t - c.x[q - 1]) / d)
      }
    }
    return c.g[c.g.length - 1]
  }

  // --- renning: eitt band per y ---------------------------------------------
  const warp: Band[] = []
  ys.forEach((y, j) => {
    // kva innslag kryssar dette bandet?
    const cs: number[] = []
    const sg: number[] = []
    for (const st of stasjonar) {
      if (Math.abs(y) <= st.Y - 0.5) {
        cs.push(st.s)
        sg.push(over(st.i, j, p.flott, p.skift) ? 1 : -1)
      }
    }
    if (cs.length < 1) return
    // spennet: frå framkanten til bakkanten, eller heilt opp i bogen
    const sFront = a - xAtY(y, a, b, nF)
    const klatrarHer = hVev > 0 && Math.abs(y) < bw - 1
    const sBack = klatrarHer
      ? sSeat + Math.max(arcLen + 8, hVev * bowArch(y))
      : a + xAtY(y, a, b, nB)
    if (sBack - sFront < 40) return
    const c = controls(cs, sg, sFront, sBack, Math.max(1, Math.round(p.flott)), pInn)
    const N = Math.max(24, Math.min(180, Math.round((sBack - sFront) / 4)))
    const core: Vec3[] = []
    const hopp: boolean[] = []
    for (let q = 0; q <= N; q++) {
      const s = sFront + ((sBack - sFront) * q) / N
      const P = srf(s, y)
      const g = gAt(c, s)
      core.push([P[0], P[1], P[2] + (p.innT / 2) * g])
      hopp.push(arcLen > 0 && s > sSeat - 3 && s < sSeat + arcLen + 3)
    }
    // tampane: retninga er lina si eiga, spegla ut av veven
    const d0: Vec3 = norm3(sub3(core[0], core[1]))
    const d1: Vec3 = norm3(sub3(core[core.length - 1], core[core.length - 2]))
    const t0 = tailPts(core[0], d0, [0, 0, 1]).reverse()
    const t1 = tailPts(core[core.length - 1], d1, [0, 0, 1])
    warp.push(
      bandCurve([...t0, ...core, ...t1], t0.length, t1.length, p.renW, p.renT, 0, j, y, cs.length, hopp),
    )
  })

  // --- innslag: eitt band per σ ---------------------------------------------
  const weft: Band[] = []
  for (const st of stasjonar) {
    const cs: number[] = []
    const sg: number[] = []
    ys.forEach((y, j) => {
      if (Math.abs(y) <= st.Y - 0.5) {
        cs.push(y)
        // innslaget ligg motsett av renninga i kvart kryss
        sg.push(over(st.i, j, p.flott, p.skift) ? -1 : 1)
      }
    })
    if (cs.length < 1) continue
    const Y = st.Y
    if (2 * Y < 40) continue
    const c = controls(cs, sg, -Y, Y, Math.max(1, Math.round(p.flott)), pRen)
    const N = Math.max(24, Math.min(180, Math.round((2 * Y) / 4)))
    const core: Vec3[] = []
    for (let q = 0; q <= N; q++) {
      const y = -Y + (2 * Y * q) / N
      const P = srf(st.s, y)
      const g = gAt(c, y)
      core.push([P[0], P[1], P[2] + (p.renT / 2) * g])
    }
    const d0: Vec3 = norm3(sub3(core[0], core[1]))
    const d1: Vec3 = norm3(sub3(core[core.length - 1], core[core.length - 2]))
    const t0 = tailPts(core[0], d0, [0, 0, 1]).reverse()
    const t1 = tailPts(core[core.length - 1], d1, [0, 0, 1])
    weft.push(bandCurve([...t0, ...core, ...t1], t0.length, t1.length, p.innW, p.innT, 1, st.i, st.s, cs.length))
  }

  // =========================================================================
  // RAMMA OG BEINA
  // =========================================================================
  // Ramma er ein flat ring om innerkanten, rammeH brei radialt og rammeT
  // tjukk. Kva RAMMELUKKINGA gjer, er å kutte ringen: ein heil hank tek
  // bandstrekket som rein ringtrykk, medan ein kutta ring må ta det same
  // strekket i BØYING mellom festepunkta. Det er skilnaden mellom eit
  // møbel som held forma og eit som spriker.
  const arcs: [number, number][] =
    p.rammetype === 0
      ? [[0, Math.PI * 2]]
      : p.rammetype === 1
        ? [
            [8 * DEG, 172 * DEG],
            [188 * DEG, 352 * DEG],
          ]
        : [
            [50 * DEG, 130 * DEG],
            [140 * DEG, 220 * DEG],
            [230 * DEG, 310 * DEG],
            [320 * DEG, 40 * DEG],
          ]

  // Beina står i DIAGONALANE. Det er ikkje pynt: eit bein som spriker
  // utover langs ein akse et heile den aksen av kuben åleine, medan eit
  // bein i diagonalen deler spriket sitt likt mellom to aksar. Same
  // spreiing, same veltevinkel, tjue centimeter mindre omhylling.
  const legTh = [45, 135, 225, 315].map((d) => d * DEG)
  const legs: Leg[] = legTh.map((th) => ({ th, r: superRad(th, a, b, th > Math.PI / 2 && th < 1.5 * Math.PI ? nB : nF) }))

  // Vevkanten ligg `vulst` under rammeplanet heile vegen rundt, og ramma
  // si overside vert lagd i høve til DEN og ikkje til planet: elles ville
  // eit stort kantfall grave bandet ned under ramma sin botn.
  const rimOff =
    p.feste === 1 ? -p.vulst - stakk / 2 - 1 : -p.vulst + stakk / 2 + (p.feste === 2 ? 1 : 3)

  return {
    p, a, b, nF, nB,
    rimR: (th) => superRad(th, a, b, Math.cos(th) >= 0 ? nF : nB) + p.rammeH / 2,
    innR: (th) => superRad(th, a, b, Math.cos(th) >= 0 ? nF : nB),
    zRim, zm, spanAt, sSeat, hVev, wBow, bw, xChord, srf,
    Rk, arcLen, hClimb, vLean, bowArch, backAt,
    warp, weft, stasjonar, ys,
    gapRen, gapInn, pRen, pInn, stakk,
    legs, arcs, rimOff, E,
  }
}

// =============================================================================
// SMÅ VEKTORHJELPARAR
// =============================================================================
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const norm3 = (v: Vec3): Vec3 => {
  const L = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / L, v[1] / L, v[2] / L]
}
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** ramma si midtlinje som lukka polygon i planet */
export function rimRing(w: Weave, nth = 96): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < nth; i++) {
    const th = (i / nth) * Math.PI * 2
    const r = w.innR(th) + w.p.rammeH / 2
    out.push([r * Math.cos(th), r * Math.sin(th)])
  }
  return out
}

export { over as overUnder }

/**
 * Bogeplata i sitt eige rom. Ho ligg i FORLENGINGA av vevflata: same
 * kurve, berre eit stykke lenger opp. Difor er ho definert av den same
 * `backAt` som banda fylgjer, og ikkje av ei eiga rekning som kunne drive
 * frå henne.
 */
export function bowGeom(w: Weave) {
  const wPath = w.wBow / Math.max(0.35, Math.cos(w.vLean))
  const tVev = w.hVev > 0 ? w.hVev : Math.max(w.arcLen, 10)
  return {
    wPath,
    tVev,
    tTop: tVev + wPath,
    bwE: w.bw,
    arch: (y: number) => w.bowArch(y),
    at: (y: number, t: number) => w.backAt(t, y),
    v: w.vLean,
  }
}
