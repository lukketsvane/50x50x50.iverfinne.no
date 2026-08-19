/**
 * SANDKASSE — feltet.
 *
 * Objektet er ikkje ei skisse. Det er ei likning: eit snitt som vandrar
 * langs ein ryggrad, roterer på vegen opp og skiftar akseforhold
 * undervegs. Kvar det skal vera hòl er eit felt over vinkel og høgd.
 *
 * Alt i denne fila er reine funksjonar av `Params`. Mesh, lag, kuttark,
 * berekning og teikning les herifrå og ingen annan stad, slik at eit
 * tal på arket alltid er det same talet som teikninga.
 *
 *   θ  vinkel kring aksen, verdsfast (0 = +X = framover)
 *   z  høgd i millimeter over golvet
 *   h  z normalisert mot toppen av objektet, [0,1]
 *   r  radius frå ryggraden si plassering i det planet
 */
import { keep } from "../core"
import { CUBE, type Params } from "./params"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

export type Vec3 = [number, number, number]

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * (3 - 2 * u)
}

/** kortaste vinkelavstand, alltid i (-π, π] */
export function wrapPi(a: number): number {
  let x = a % TAU
  if (x > Math.PI) x -= TAU
  if (x <= -Math.PI) x += TAU
  return x
}

/** Ei opning i det utrulla rektangelet (vinkel × høgd). */
type Hole = {
  th0: number // sentervinkel ved h = 0
  drift: number // kor mange radianar senteret vandrar per full høgd
  hw: number // halv breidd i radianar
  hc: number // senterhøgd, normalisert (kan liggja under golvet)
  hh: number // halv høgd, normalisert
  m: number // superellipse-eksponent; < 2 gjev spisse endar
}

export type Shell = {
  p: Params
  /** plan-skala: radien til eit snitt med r = 1 i normalisert form */
  R: number
  /** høgda på det høgste punktet av rimet, mm */
  zTop: number
  /** setehøgda etter at objektet er passa inn i kuben, mm */
  seatZ: number
  holes: Hole[]

  /** normalisert høgd */
  hOf(z: number): number
  /** vridinga i radianar ved høgda h */
  twistAt(h: number): number
  /** ryggraden si plassering i planet ved høgda h, mm */
  spine(h: number): [number, number]
  /** ytre radius frå ryggraden, mm */
  rOuter(th: number, z: number): number
  /** skaltjukna målt normalt på flata, mm */
  wall(th: number, z: number): number
  /** ytre flatepunkt i verdskoordinatar, mm */
  outer(th: number, z: number): Vec3
  /** utoverpeikande einingsnormal på den ytre flata */
  normal(th: number, z: number): Vec3
  /** materialfeltet: >= 1 er material, < 1 er opning */
  matAt(th: number, h: number): number
  /** øvre kant av veggen, mm */
  rimZ(th: number): number
  /** der setet festar seg i veggen, mm */
  seatEdgeZ(th: number): number
  /** setehøgd i normalisert radius q ∈ [0,1], mm */
  dishZ(th: number, q: number): number
  /** indre radius ved setekanten, mm */
  seatR(th: number): number
  /** er punktet inne i godset? (θ, radius frå ryggraden, høgd) */
  solidAt(th: number, r: number, z: number): boolean
}

// =============================================================================
// SNITTET
// =============================================================================
/** Superellipse-radius for eksponent n og akseforhold gjeve i log-skala. */
function superR(thLocal: number, n: number, asp: number): number {
  const A = Math.exp(asp * 0.5)
  const B = Math.exp(-asp * 0.5)
  const c = Math.abs(Math.cos(thLocal) / A)
  const s = Math.abs(Math.sin(thLocal) / B)
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n)
}

// =============================================================================
// KONSTRUKSJON
// =============================================================================
const SKAL_HUGS = keep<Shell>(3)
/** Skalet for eit punkt vert reist éin gong og lese tre gonger: av bygget,
 *  av målinga og av reglane. Hugsen er det som gjer dei tre til éin. */
export function makeShell(p: Params): Shell {
  return SKAL_HUGS(JSON.stringify(p), () => makeShellRaw(p))
}

function makeShellRaw(p: Params): Shell {
  const finDir = p.finDir * DEG
  const finHalf = Math.max(6 * DEG, (p.finWide * DEG) / 2)
  const rimPhase = p.rimPhase * DEG
  const legDir = p.legDir * DEG
  const saddleDir = p.saddleDir * DEG

  // Rimet bylgjer NEDOVER frå setet, ikkje kring det. Ei bylgje som gjekk
  // begge vegar ville reise ein krage rundt heile setet, og då er objektet
  // ei krukke. Slik det står her ligg rimet i eller under setehøgda overalt
  // — bortsett frå på eitt punkt, der ryggen reiser seg. Djupna er bunden
  // av skåla: rimet kan ikkje falle djupare enn den skåla det held.
  const dip = Math.min(p.rimWave, p.dish * 0.7)
  const rimZ = (th: number) => {
    const wave = -dip * (0.5 - 0.5 * Math.sin(th - rimPhase))
    const d = Math.abs(wrapPi(th - finDir))
    const fin =
      d < finHalf ? p.finRise * 0.5 * (1 + Math.cos((Math.PI * d) / finHalf)) : 0
    return p.seatZ + wave + fin
  }
  const seatEdgeZ = (th: number) => Math.min(rimZ(th), p.seatZ)

  // Toppen av objektet er det høgste punktet på rimet — bylgja og ryggen
  // har ikkje same toppunkt, så han må målast, ikkje leggjast saman.
  let zTop = p.seatZ
  for (let i = 0; i < 720; i++) zTop = Math.max(zTop, rimZ((i / 720) * TAU))
  const hOf = (z: number) => z / zTop

  // --- lovene som styrer snittet oppover ----------------------------------
  const twistAt = (h: number) =>
    p.twist * DEG * Math.pow(Math.min(1, Math.max(0, h)), p.twistBias)

  const aspAt = (h: number) => {
    const w = p.waistZ
    return h < w
      ? p.asp0 + (p.asp1 - p.asp0) * smooth(h / Math.max(w, 1e-6))
      : p.asp1 + (p.asp2 - p.asp1) * smooth((h - w) / Math.max(1 - w, 1e-6))
  }
  const nAt = (h: number) => p.secN0 + (p.secN1 - p.secN0) * smooth(h)

  /** Midja er ei innsnøring med tyngdepunkt der waistZ ligg. Under henne
   *  svulmar skalet ut att (flare), og heilt nede snører det seg inn mot
   *  golvet (foot) — det er dét som gjer at objektet står på eit
   *  fotavtrykk som er mindre enn den vidaste plana si, og som gjev
   *  utkraginga. Det kostar veltevinkel; regelen seier frå når det er
   *  betalt for mykje. */
  const FOOT_Z = 0.24
  const SHOULDER_Z = 0.72
  const rhoAt = (h: number) => {
    const u = (h - p.waistZ) / Math.max(p.waistWide, 1e-6)
    const pinch = 1 - p.waist * Math.exp(-u * u)
    const below = Math.max(0, 1 - h / Math.max(p.waistZ, 1e-6))
    const foot = 1 - p.foot * (1 - smooth(h / FOOT_Z))
    // Skuldra. Utan henne er setet det vidaste punktet på objektet, og då
    // les rimet som ein brem lagd oppå ein vase i staden for som toppen av
    // ei flate. Innsnøringa er målt mot setehøgda, ikkje mot toppen av
    // ryggen, slik at ho sit på same stad om ein hevar eller senkar ryggen.
    const hs = (h * zTop) / Math.max(p.seatZ, 1e-6)
    const sh_ = 1 - p.shoulder * smooth((hs - SHOULDER_Z) / (1 - SHOULDER_Z))
    return pinch * (1 + p.flare * below * below) * foot * sh_
  }

  /** eitt bein dratt lenger ut, i den retninga setet lener seg */
  const legPull = (th: number, h: number) => {
    if (p.legStretch <= 0) return 1
    const g = Math.max(0, Math.cos(wrapPi(th - legDir)))
    const fz = Math.max(0, 1 - h / Math.max(p.legRise * 1.3, 1e-6))
    return 1 + p.legStretch * Math.pow(g, 2.2) * fz * fz
  }

  /** ryggraden: fyrst litt attende, så framover — ein S */
  const spineS = (h: number) => {
    const back = Math.exp(-Math.pow((h - p.spineBias) / 0.3, 2))
    return p.spineFwd * Math.pow(h, 1.7) - p.spineBack * back
  }

  // --- opningane ----------------------------------------------------------
  const holes: Hole[] = []
  const legN = Math.max(3, Math.round(p.legs))
  for (let k = 0; k < legN; k++) {
    // beina står midt mellom opningane, og eitt av dei peikar mot legDir
    const th0 = legDir + ((k + 0.5) * TAU) / legN
    const skew = 1 + p.legSkew * Math.cos(wrapPi(th0 - legDir))
    holes.push({
      th0,
      drift: 0,
      hw: Math.max(4 * DEG, ((p.legGap * DEG) / 2) * skew),
      hc: -0.06,
      hh: p.legRise + 0.06,
      m: 2.2,
    })
  }
  holes.push({
    th0: p.sweepDir * DEG,
    drift: p.sweepDrift * DEG,
    hw: Math.max(6 * DEG, (p.sweepSpan * DEG) / 2),
    hc: p.sweepZ,
    hh: p.sweepH,
    m: p.sweepExp,
  })

  /** Feltverdien er avstanden til den næraste opninga si eiga superellipse,
   *  målt i einingar av opninga sjølv. 1 er kanten. */
  const matAt = (th: number, h: number) => {
    let best = Infinity
    for (const q of holes) {
      const a = Math.abs(wrapPi(th - (q.th0 + q.drift * h))) / q.hw
      const b = Math.abs(h - q.hc) / q.hh
      const v = Math.pow(Math.pow(a, q.m) + Math.pow(b, q.m), 1 / q.m)
      if (v < best) best = v
    }
    return best
  }

  // --- radius og skal -----------------------------------------------------
  // R vert sett av innpassinga under; her held vi ein boks som fyller han inn.
  const box = { R: 200 }

  /** Ryggen lener seg innover over setet. Ein rygg som står loddrett er
   *  ein vegg; det er lenet som gjer at han tek imot nokon. Lenet gjeld
   *  berre over setehøgda og berre der ryggen er, så resten av rimet ligg
   *  uendra. */
  const finLeanAt = (th: number, z: number) => {
    if (p.finLean <= 0 || p.finRise <= 0 || z <= p.seatZ) return 1
    const d = Math.abs(wrapPi(th - finDir))
    if (d >= finHalf) return 1
    const across = 0.5 * (1 + Math.cos((Math.PI * d) / finHalf))
    const up = Math.min(1, (z - p.seatZ) / p.finRise)
    return 1 - p.finLean * across * up * up
  }

  const rOuter = (th: number, z: number) => {
    const h = hOf(z)
    const local = th - twistAt(h)
    return (
      box.R *
      superR(local, nAt(h), aspAt(h)) *
      rhoAt(h) *
      legPull(th, h) *
      finLeanAt(th, z)
    )
  }

  const spine = (h: number): [number, number] => {
    const s = spineS(h) * box.R
    const d = p.spineDir * DEG
    return [s * Math.cos(d), s * Math.sin(d)]
  }

  const outer = (th: number, z: number): Vec3 => {
    const [cx, cy] = spine(hOf(z))
    const r = rOuter(th, z)
    return [cx + r * Math.cos(th), cy + r * Math.sin(th), z]
  }

  /** Normalen vert rekna av parametriseringa sjølv, ikkje sett lik radien:
   *  flata heller både med høgda og med vinkelen, og eit skal som er
   *  offsett radielt i staden for normalt vert tjukkare der veggen står bratt. */
  const normal = (th: number, z: number): Vec3 => {
    const dz = Math.max(0.75, zTop * 0.004)
    const dt = 0.004
    const a = outer(th, z)
    const bz = outer(th, Math.min(zTop, z + dz))
    const az = outer(th, Math.max(0, z - dz))
    const bt = outer(th + dt, z)
    const at = outer(th - dt, z)
    const u: Vec3 = [bz[0] - az[0], bz[1] - az[1], bz[2] - az[2]]
    const v: Vec3 = [bt[0] - at[0], bt[1] - at[1], bt[2] - at[2]]
    // v × u peikar utover for ei venstredreidd parametrisering i (θ, z)
    let n: Vec3 = [
      v[1] * u[2] - v[2] * u[1],
      v[2] * u[0] - v[0] * u[2],
      v[0] * u[1] - v[1] * u[0],
    ]
    const L = Math.hypot(n[0], n[1], n[2]) || 1
    n = [n[0] / L, n[1] / L, n[2] / L]
    // sikre at han peikar bort frå ryggraden
    const [cx, cy] = spine(hOf(z))
    if (n[0] * (a[0] - cx) + n[1] * (a[1] - cy) < 0) n = [-n[0], -n[1], -n[2]]
    return n
  }

  /** Skalet er `shellT` tjukt, men går ned mot `edgeT` langs kanten av
   *  kvar opning. Utan det les opningane som dører skorne i ein vegg. */
  const EDGE_BAND = 0.26
  const wall = (th: number, z: number) => {
    const f = matAt(th, hOf(z)) - 1
    if (f <= 0) return p.edgeT
    const t = Math.min(1, f / EDGE_BAND)
    return p.edgeT + (p.shellT - p.edgeT) * Math.pow(t, 0.65)
  }

  // --- setet ---------------------------------------------------------------
  /** Radien der setet møter veggen. Han ligg på 35 % av veggtjukna, rekna
   *  frå ytterflata, og ikkje på innerflata: setet og veggen skal
   *  gjennomtrengja kvarandre, ikkje tangere. To flater som berre tek
   *  borti kvarandre gjev ei skøyt som korkje meshet, slicaren eller
   *  limfuga kan gjere noko fornuftig med. */
  const seatR = (th: number) => {
    const z = seatEdgeZ(th)
    return Math.max(10, rOuter(th, z) - wall(th, z) * 0.35)
  }

  /** Skåla er målt i normalisert radius innanfor snittet, ikkje i x og y,
   *  difor fylgjer ho kanten same kva form snittet har. Salen er lagd inn
   *  som ein variasjon i eksponenten: skåla vert flatare — og dermed
   *  grunnare å sitja i — på tvers av salretninga. */
  const dishZ = (th: number, q: number) => {
    const edge = seatEdgeZ(th)
    const ctr = p.seatZ - p.dish
    const e = p.dishExp * (1 + p.saddle * Math.cos(2 * (th - saddleDir)))
    return ctr + (edge - ctr) * Math.pow(Math.min(1, Math.max(0, q)), e)
  }

  const seatBot = p.seatZ - p.dish - p.shellT

  const solidAt = (th: number, r: number, z: number) => {
    if (z < 0 || z > zTop + 1e-6) return false
    const h = hOf(z)
    if (z <= rimZ(th) && matAt(th, h) >= 1) {
      const ro = rOuter(th, z)
      const ri = ro - wall(th, z)
      if (r <= ro && r >= ri) return true
    }
    if (z <= p.seatZ + 1e-6 && z >= seatBot) {
      const rs = seatR(th)
      const q = r / rs
      if (q <= 1) {
        const top = dishZ(th, q)
        if (z <= top && z >= top - p.shellT) return true
      }
    }
    return false
  }

  const shell: Shell = {
    p,
    get R() {
      return box.R
    },
    zTop,
    seatZ: p.seatZ,
    holes,
    hOf,
    twistAt,
    spine,
    rOuter,
    wall,
    outer,
    normal,
    matAt,
    rimZ,
    seatEdgeZ,
    dishZ,
    seatR,
    solidAt,
  }

  fitToCube(shell, box)
  return shell
}

// =============================================================================
// INNPASSING I KUBEN
// =============================================================================
/**
 * Innpassinga i kuben.
 *
 * Berre planet vert passa inn. Høgda er alt gjeve i millimeter — setekanten
 * og ryggen står nøyaktig der ein sette dei — og å skalere Z ville tyde at
 * setehøgda ein bad om ikkje var setehøgda ein fekk. Eit for høgt objekt
 * vert difor ikkje retta her; det vert fanga av den harde regelen «kuben»,
 * og det er meininga: reiskapen skal seia frå, ikkje stille om.
 *
 * Éin omgang er nok, og det er ikkje flaks. Både ryggraden og radien er
 * proporsjonale med R, og materialfeltet kjenner ikkje R i det heile — så
 * heile plana skalerer eksakt lineært, og eit einaste kvotient set han rett.
 *
 * Marginen på 14 mm er derimot ikkje pynt. Rutenettet finn randa av kvar
 * opning ved halvering, men det finst framleis toppar mellom to rader som
 * eit grovt sveip ikkje ser. Målt over 31 tilfeldige objekt ligg det
 * vidaste meshet 10,6 mm over det innpassinga trudde. Difor er dette eit
 * anslag og ikkje ein garanti — garantien er den harde regelen «kuben».
 */
function fitToCube(sh: Shell, box: { R: number }) {
  const NT = 288
  const NZ = 56
  const want = CUBE - 14

  const span = () => {
    let minx = Infinity
    let maxx = -Infinity
    let miny = Infinity
    let maxy = -Infinity
    const see = (x: number, y: number) => {
      if (x < minx) minx = x
      if (x > maxx) maxx = x
      if (y < miny) miny = y
      if (y > maxy) maxy = y
    }
    const on = (th: number, z: number) =>
      z <= sh.rimZ(th) && sh.matAt(th, sh.hOf(z)) >= 1

    // Randa av eit hòl er der ytterpunktet oftast ligg, og ho treffer
    // sjeldan ei rad i rutenettet. Eit grovt sveip åleine bommar med opptil
    // elleve millimeter — nok til å skyve objektet ut av kuben utan at
    // innpassinga merkar det. Difor vert kvar overgang halvert fram, i
    // BEGGE retningar: eit bein sluttar i ei viss høgd like ofte som ei
    // opning sluttar i ein viss vinkel.
    const th_ = (i: number) => (i / NT) * TAU
    const z_ = (j: number) => (j / NZ) * sh.zTop
    const grid: boolean[][] = []
    for (let i = 0; i < NT; i++) {
      const col: boolean[] = []
      for (let j = 0; j <= NZ; j++) {
        const yes = on(th_(i), z_(j))
        col.push(yes)
        if (yes) {
          const q = sh.outer(th_(i), z_(j))
          see(q[0], q[1])
        }
      }
      grid.push(col)
    }

    for (let i = 0; i < NT; i++) {
      const i1 = (i + 1) % NT
      for (let j = 0; j <= NZ; j++) {
        // overgang i vinkel
        if (grid[i][j] !== grid[i1][j]) {
          const z = z_(j)
          let lo = th_(i)
          let hi = i1 === 0 ? TAU : th_(i1)
          const keep = grid[i][j]
          for (let k = 0; k < 10; k++) {
            const mid = (lo + hi) / 2
            if (on(mid, z) === keep) lo = mid
            else hi = mid
          }
          const q = sh.outer(keep ? lo : hi, z)
          see(q[0], q[1])
        }
        // overgang i høgd
        if (j < NZ && grid[i][j] !== grid[i][j + 1]) {
          const th = th_(i)
          let lo = z_(j)
          let hi = z_(j + 1)
          const keep = grid[i][j]
          for (let k = 0; k < 10; k++) {
            const mid = (lo + hi) / 2
            if (on(th, mid) === keep) lo = mid
            else hi = mid
          }
          const q = sh.outer(th, keep ? lo : hi)
          see(q[0], q[1])
        }
      }
    }

    // Rimet er ei rand i høgda på same vis, og på eit objekt med rygg er
    // det ofte der det vidaste punktet ligg.
    for (let i = 0; i < NT; i++) {
      const th = th_(i)
      const z = sh.rimZ(th)
      if (sh.matAt(th, sh.hOf(z)) < 1) continue
      const q = sh.outer(th, z)
      see(q[0], q[1])
    }
    // Setekanten stikk lip millimeter lenger ut enn skalet.
    for (let i = 0; i < NT; i++) {
      const th = th_(i)
      const z = sh.seatEdgeZ(th)
      if (sh.matAt(th, sh.hOf(z)) < 1) continue
      const c = sh.spine(sh.hOf(z))
      const r = sh.rOuter(th, z) + sh.p.lip
      see(c[0] + r * Math.cos(th), c[1] + r * Math.sin(th))
    }
    if (!Number.isFinite(minx)) return 0
    return Math.max(maxx - minx, maxy - miny)
  }

  const w = span()
  if (!(w > 0)) return
  box.R *= Math.min(2.4, want / w)
}

// =============================================================================
// PLAN-KONTUR VED EI HØGD
// =============================================================================
/**
 * Den ytre plankonturen ved høgda z, sett saman av dei vinkelintervalla
 * der det faktisk er material. Kvart intervall er ein del: nede er dei eitt
 * bein kvar — så mange som `legs` seier — og oppe er dei éin lukka ring.
 */
export function planArcs(
  sh: Shell,
  z: number,
  nt = 512,
): { th: number; ro: number; ri: number }[][] {
  const present: boolean[] = new Array(nt)
  for (let i = 0; i < nt; i++) {
    const th = (i / nt) * TAU
    present[i] = z <= sh.rimZ(th) && sh.matAt(th, sh.hOf(z)) >= 1
  }
  const runs: number[][] = []
  const all = present.every(Boolean)
  if (all) {
    runs.push(Array.from({ length: nt }, (_, i) => i))
  } else {
    let start = -1
    for (let i = 0; i < nt; i++) if (!present[i] && present[(i + 1) % nt]) start = (i + 1) % nt
    if (start >= 0) {
      let i = start
      let cur: number[] = []
      for (let c = 0; c < nt; c++) {
        if (present[i]) cur.push(i)
        else if (cur.length) {
          runs.push(cur)
          cur = []
        }
        i = (i + 1) % nt
      }
      if (cur.length) runs.push(cur)
    }
  }
  return runs.map((run) =>
    run.map((i) => {
      const th = (i / nt) * TAU
      const ro = sh.rOuter(th, z)
      return { th, ro, ri: Math.max(2, ro - sh.wall(th, z)) }
    }),
  )
}
