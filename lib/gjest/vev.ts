/**
 * GJEST — vevet: to ribbefamiliar av ein importert mesh.
 *
 * Same leddet som VAFFEL, same produksjonsvegen, same kuttarket. Det som
 * er ANNLEIS er kvar profilen kjem frå: VAFFEL les han ut av eit felt han
 * skreiv sjølv, GJEST les han ut av eit snitt gjennom nokon annan sin
 * mesh. Nedstraums er det ingen skilnad — ei ribbe er ein kontur med hòl
 * og spor, og pakkaren spør ikkje kvar ho kjem frå.
 *
 * SPORA er heile arbeidet. To ribber som kryssar kvarandre kan ikkje båe
 * vera heile: den eine må ha eit spor ned frå toppen og den andre eit opp
 * frå botnen, kvart av dei halve overlappet. Overlappet er ikkje eit tal
 * ein kan skrive ned på førehand — det er kor høgt DENNE X-ribba og DENNE
 * Y-ribba begge har material i akkurat dette krysset, og det må lesast ut
 * av båe konturane.
 *
 * Difor: alle snitta fyrst, so overlappa, so spora. Ei ribbe som ikkje
 * kryssar nokon annan får ingen spor, og ho vert MELDT — ho er ein del
 * som ikkje er festa til noko, og det er ein feil brukaren skal sjå.
 */
import type { Pt } from "../core"
import type { Trekantar } from "./glb"
import { forenkl, reinsk, skjer, type Akse } from "./skjer"

export type GjestVal = {
  /** ribber på tvers av X, og på tvers av Y */
  nX: number
  nY: number
  /** platetjukn, mm */
  t: number
  /** sporet breiare enn ribba, mm */
  klaring: number
  /** kor stort objektet vert i kuben, mm */
  maal: number
  /** kor mykje konturen vert retta ut, mm */
  glatt: number
}

export const STANDARD: GjestVal = {
  nX: 9,
  nY: 9,
  t: 9,
  klaring: 0.2,
  maal: 470,
  glatt: 1.2,
}

export type GjestRibbe = {
  akse: Akse
  /** planet ribba står i, mm */
  pos: number
  /** ytterkonturen(ane) i (t, z) */
  outline: Pt[]
  holes: Pt[][]
  /** spora, som hòl er dei ikkje — dei er skorne UT av ytterkonturen */
  spor: number
  /** høgd og breidd på plata ribba treng, mm */
  w: number
  h: number
  /** netto areal, mm² */
  area: number
}

export type Vev = {
  ribber: GjestRibbe[]
  /** kor mange kryss som faktisk gav eit ledd */
  ledd: number
  /** ribber utan eit einaste ledd */
  lause: number
  /** kjeder som måtte lukkast med ei rett line — mesh-en var open der */
  opne: number
  /** kor stort objektet vart, mm */
  boks: [number, number, number]
}

/** z-intervalla der ringen har material ved t */
function hogdVed(ringar: Pt[][], t: number): [number, number][] {
  const kryss: number[] = []
  for (const ring of ringar) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      if (a[0] > t === b[0] > t) continue
      kryss.push(a[1] + ((t - a[0]) / (b[0] - a[0])) * (b[1] - a[1]))
    }
  }
  kryss.sort((x, y) => x - y)
  const ut: [number, number][] = []
  for (let i = 0; i + 1 < kryss.length; i += 2) ut.push([kryss[i], kryss[i + 1]])
  return ut
}

/**
 * Sporet skore ut av konturen.
 *
 * Eit spor er ikkje eit hakk ein kan klemme punkta inn i. Det er ein
 * KANAL: konturen som før gjekk rett over sporet skal no gå ned den eine
 * sporveggen, langs botnen og opp den andre. Klemmer ein berre punkta,
 * får ein ei bulk — og ei bulk er ikkje eit ledd, det er ein del som
 * ikkje går ned over naboen sin.
 *
 * Sporet er alltid ope mot ein KANT, oppe eller nede. Det er ikkje ei
 * forenkling: eit spor som ikkje når kanten er eit hòl, og ei ribbe med
 * eit hòl der leddet skulle vore kan ikkje treast på plass. Difor er
 * området som skal bort ei stripe `t ∈ (t0, t1)` som går heilt ut til
 * uendeleg i opningsretninga, og randa hans er ein VEG med to hjørne:
 *
 *     (t0, ∞) → (t0, botn) → (t1, botn) → (t1, ∞)
 *
 * Kvar gong konturen går inn i stripa og ut att, vert stykket imellom
 * bytt ut med den vegen. Hjørna som ligg mellom inn- og utgangspunktet
 * vert lagde inn i den retninga konturen faktisk går, so ei ribbe som
 * kjem inn frå høgre får den same kanalen som ei som kjem inn frå
 * venstre.
 */
function skjerSpor(
  ring: Pt[],
  t0: number,
  t1: number,
  botn: number,
  /** +1: sporet opnar seg oppover (alt over `botn` skal bort) */
  opp: 1 | -1,
): Pt[] {
  const inne = (p: Pt) => p[0] > t0 && p[0] < t1 && (p[1] - botn) * opp > 0
  /** kor langt ut langs randvegen eit punkt på randa ligg */
  const langs = (p: Pt) => {
    if (Math.abs(p[0] - t0) < 1e-7) return -(p[1] - botn) * opp
    if (Math.abs(p[0] - t1) < 1e-7) return t1 - t0 + (p[1] - botn) * opp
    return p[0] - t0
  }
  const C0: Pt = [t0, botn]
  const C1: Pt = [t1, botn]

  /** s-intervallet der segmentet a→b ligg inne i stripa */
  const intervall = (a: Pt, b: Pt): [number, number] | null => {
    let lo = 0
    let hi = 1
    const klipp = (na: number, nb: number) => {
      // na + (nb − na)·s > 0
      const d = nb - na
      if (Math.abs(d) < 1e-12) {
        if (na <= 0) hi = -1
        return
      }
      const s = -na / d
      if (d > 0) lo = Math.max(lo, s)
      else hi = Math.min(hi, s)
    }
    klipp(a[0] - t0, b[0] - t0)
    klipp(t1 - a[0], t1 - b[0])
    klipp((a[1] - botn) * opp, (b[1] - botn) * opp)
    return hi - lo > 1e-9 ? [Math.max(0, lo), Math.min(1, hi)] : null
  }

  type Node = { p: Pt; rand: 0 | 1 | 2 } // 0 = vanleg, 1 = inngang, 2 = utgang
  const noder: Node[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const iv = intervall(a, b)
    if (!iv) {
      if (!inne(a)) noder.push({ p: a, rand: 0 })
      continue
    }
    const [s0, s1] = iv
    const pt = (s: number): Pt => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]
    if (s0 > 1e-9) {
      noder.push({ p: a, rand: 0 })
      noder.push({ p: pt(s0), rand: 1 })
    }
    if (s1 < 1 - 1e-9) noder.push({ p: pt(s1), rand: 2 })
  }
  if (noder.length < 3) return ring

  // …og so hjørna, mellom kvar inngang og den utgangen som fylgjer
  const ut: Pt[] = []
  for (let i = 0; i < noder.length; i++) {
    const n = noder[i]
    ut.push(n.p)
    const m = noder[(i + 1) % noder.length]
    if (n.rand !== 1 || m.rand !== 2) continue
    const ua = langs(n.p)
    const ub = langs(m.p)
    const mellom = [C0, C1].filter((c) => {
      const u = langs(c)
      return ua < ub ? u > ua && u < ub : u < ua && u > ub
    })
    if (ua > ub) mellom.reverse()
    ut.push(...mellom)
  }
  return ut.length >= 3 ? ut : ring
}

function arealAv(ring: Pt[]): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    s += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
  }
  return Math.abs(s / 2)
}

/**
 * Bygg vevet.
 *
 * Ribbeplana ligg i CELLESENTER og ikkje på cellekantar, av same grunn
 * som i VAFFEL: ei ribbe heilt ute i kanten er ei ribbe med null breidd,
 * og ho ville stått i kuttlista utan å bera noko.
 */
export function byggVev(tri: Trekantar, v: GjestVal): Vev {
  const bx = tri.max[0] - tri.min[0]
  const by = tri.max[1] - tri.min[1]
  const bz = tri.max[2] - tri.min[2]
  const rute = Math.max(bx, by, bz) / 4000
  const halvT = v.t / 2

  const plan = (n: number, lo: number, hi: number) => {
    const ut: number[] = []
    const steg = (hi - lo) / n
    for (let i = 0; i < n; i++) ut.push(lo + (i + 0.5) * steg)
    return ut
  }
  const xs = plan(v.nX, tri.min[0], tri.max[0])
  const ys = plan(v.nY, tri.min[1], tri.max[1])

  let opne = 0
  const snittAv = (akse: Akse, pos: number) => {
    const s = skjer(tri, akse, pos, rute)
    opne += s.opne
    const rein = reinsk(s.loops)
    return rein.map((l) => forenkl(l, v.glatt)).filter((l) => l.length >= 3)
  }

  // Snitta fyrst, alle saman: spora treng å vita kva NABOEN gjer i
  // krysset, og det kan ein ikkje vita før naboen er skoren.
  const xSnitt = xs.map((p) => snittAv(0, p))
  const ySnitt = ys.map((p) => snittAv(1, p))

  /** overlappet i krysset (i, j): kva z-intervall båe har material i */
  const overlapp = (i: number, j: number): [number, number] | null => {
    // X-ribba står i x = xs[i]; ho vert lesen ved t = ys[j]
    const a = hogdVed(xSnitt[i], ys[j])
    const b = hogdVed(ySnitt[j], xs[i])
    let beste: [number, number] | null = null
    for (const [a0, a1] of a) {
      for (const [b0, b1] of b) {
        const lo = Math.max(a0, b0)
        const hi = Math.min(a1, b1)
        if (hi - lo <= v.t) continue // for grunt til å bera eit ledd
        if (!beste || hi - lo > beste[1] - beste[0]) beste = [lo, hi]
      }
    }
    return beste
  }

  let ledd = 0
  const ribber: GjestRibbe[] = []
  const spor: number[][] = xs.map(() => [])
  const sporY: number[][] = ys.map(() => [])
  const kryss: { i: number; j: number; lo: number; hi: number }[] = []
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < ys.length; j++) {
      const o = overlapp(i, j)
      if (!o) continue
      kryss.push({ i, j, lo: o[0], hi: o[1] })
      spor[i].push(j)
      sporY[j].push(i)
      ledd++
    }
  }

  const halvKlar = halvT + v.klaring

  const lagRibbe = (
    akse: Akse,
    pos: number,
    ringar: Pt[][],
    mine: { t: number; lo: number; hi: number; ovanfra: boolean }[],
  ): GjestRibbe | null => {
    if (!ringar.length) return null
    // største ringen er ytterkonturen; resten er hòl
    const sortert = [...ringar].sort((a, b) => arealAv(b) - arealAv(a))
    let outline = sortert[0]
    const holes = sortert.slice(1)
    for (const s of mine) {
      // Halvt om halvt: X-ribba opnar seg NEDANFRÅ, Y-ribba ovanfrå. Då
      // kan ein leggje X-familien på bordet og senke Y-familien ned i han.
      const midt = (s.lo + s.hi) / 2
      outline = skjerSpor(
        outline,
        s.t - halvKlar,
        s.t + halvKlar,
        midt,
        s.ovanfra ? 1 : -1,
      )
    }
    let t0 = Infinity, t1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const p of outline) {
      if (p[0] < t0) t0 = p[0]
      if (p[0] > t1) t1 = p[0]
      if (p[1] < z0) z0 = p[1]
      if (p[1] > z1) z1 = p[1]
    }
    let area = arealAv(outline)
    for (const h of holes) area -= arealAv(h)
    return {
      akse,
      pos,
      outline,
      holes,
      spor: mine.length,
      w: t1 - t0,
      h: z1 - z0,
      area: Math.max(0, area),
    }
  }

  for (let i = 0; i < xs.length; i++) {
    const mine = kryss
      .filter((k) => k.i === i)
      .map((k) => ({ t: ys[k.j], lo: k.lo, hi: k.hi, ovanfra: false }))
    const r = lagRibbe(0, xs[i], xSnitt[i], mine)
    if (r) ribber.push(r)
  }
  for (let j = 0; j < ys.length; j++) {
    const mine = kryss
      .filter((k) => k.j === j)
      .map((k) => ({ t: xs[k.i], lo: k.lo, hi: k.hi, ovanfra: true }))
    const r = lagRibbe(1, ys[j], ySnitt[j], mine)
    if (r) ribber.push(r)
  }

  return {
    ribber,
    ledd,
    lause: ribber.filter((r) => r.spor === 0).length,
    opne,
    boks: [bx, by, bz],
  }
}
