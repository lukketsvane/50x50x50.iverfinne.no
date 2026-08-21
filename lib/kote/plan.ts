/**
 * KOTE — kroppen og kotelina.
 *
 * Objektet er éin kropp skoren av VASSRETTE plan. Kroppen er ei rundkanta
 * mangekant som endrar radius, rundleik og vinkel oppover: brei flat fot,
 * ei midje eit stykke over halve høgda, og ei ny utfliking til eit
 * rundkanta trekantsete. Ei kotelinje er kroppen sitt snitt ved éi høgd,
 * og DEN er plata som vert kutta av arket.
 *
 * Alt i fila er reine funksjonar av `Params`. Stabelen, stavane, måltala,
 * reglane og kuttfila les herifrå og ingen annan stad.
 *
 *   θ  vinkel kring aksen, verdsfast (0 = +X = framover)
 *   φ  same vinkel lese i plata sitt eige kryss, altså θ minus vridinga
 *   z  høgd i millimeter over golvet
 *   t  z normalisert mot setehøgda, [0, 1]
 */
import { keep, smooth, type Pt } from "../core"
import type { Params } from "./params"

const DEG = Math.PI / 180
const TAU = Math.PI * 2

/** punkttal kring planet og talet på z-stasjonar i den glatte kroppen */
export const DETAIL: Record<"lav" | "mid" | "hog", { m: number; zst: number }> = {
  lav: { m: 16, zst: 22 },
  mid: { m: 26, zst: 40 },
  hog: { m: 40, zst: 66 },
}

/** punkttal for eit plan: eit heilt tal lober, so kvar lobe vert lik */
export const nth = (p: Params, m: number) =>
  Math.max(45, Math.min(180, Math.round(m) * Math.round(p.lober)))

// =============================================================================
// RUNDKANTA MANGEKANT
// =============================================================================
/**
 * Radien til ei rundkanta mangekant med ytre radius 1, i polarform.
 *
 * Konstruksjonen er den ein møbelsnikkar teiknar: n hjørnesirklar med
 * radius ρ, senter i avstand d = 1 − ρ, og sider som ligg på den ytre
 * felles tangenten. `rund` er ρ: null gjev ei rein mangekant, éin gjev ein
 * sirkel, og alt imellom er ei mangekant med runda hjørne.
 *
 * `bog` bular sida ut (positiv) eller inn (negativ) med sin²-profil.
 * Sin² er valt av di han har NULL stigning i begge endar: sida møter
 * hjørnesirkelen tangentielt, og då kjem det ingen knekk i konturen der
 * bogen tek over — ein knekk i kotelina er ei kant i den freste plata.
 */
export function lobeR(psi: number, n: number, rund: number, bog: number): number {
  const rho = Math.min(0.998, Math.max(0.002, rund))
  const d = 1 - rho
  const half = Math.PI / n
  let a = psi % (2 * half)
  if (a > half) a -= 2 * half
  if (a < -half) a += 2 * half
  a = Math.abs(a)
  // tangentpunktet mellom hjørnesirkelen og sida, lese som vinkel
  const psiT = Math.atan2(rho * Math.sin(half), d + rho * Math.cos(half))
  if (a <= psiT || half - psiT < 1e-6) {
    const s = d * Math.sin(a)
    return d * Math.cos(a) + Math.sqrt(Math.max(1e-9, rho * rho - s * s))
  }
  const p0 = d * Math.cos(half) + rho
  const t = 0.5 * (a - psiT) / (half - psiT)
  // ein innoverbog som et meir enn tre firedelar av sida ville dra
  // konturen mot senteret og gjere planet stjerneforma på feil måte
  const bul = Math.max(-0.75 * p0, bog) * Math.pow(Math.sin(Math.PI * t), 2)
  return (p0 + bul) / Math.cos(a - half)
}

// =============================================================================
// KROPPEN
// =============================================================================
export type Kropp = {
  p: Params
  /** setehøgda, altså toppen av stabelen, mm */
  H: number
  /** midjehøgda i millimeter */
  wZ: number
  /** lobetal */
  n: number
  /** bita sine lokale vinklar, radianar */
  bitar: number[]
  /** ytre radius (lobetoppen) ved høgda z, mm */
  R(z: number): number
  /** rundleiken ved z, 0–1 */
  rund(z: number): number
  /** vridinga ved z, radianar */
  vri(z: number): number
  /** kor djupt holet bit ved z, 0–1 av radien */
  bit(z: number): number
  /** bitvindauget ved vinkelen θ og høgda z, 0 utanfor og 1 i midten */
  vindu(th: number, z: number): number
  /** radien i verdsvinkel θ ved høgda z, med holet rekna inn, mm */
  r(th: number, z: number): number
  /** kotelina ved z som lukka polygon mot klokka, nth punkt */
  plan(z: number, nth: number): Pt[]
  /** minste radius i planet ved z — kjernen som står att etter bita */
  kjerne(z: number, nth: number): number
}

const KROPP_HUGS = keep<Kropp>(4)

/** Kroppen for eit punkt vert reist éin gong og lese av bygg, mål og reglar. */
export function makeKropp(p: Params): Kropp {
  return KROPP_HUGS(JSON.stringify(p), () => makeKroppRaw(p))
}

function makeKroppRaw(p: Params): Kropp {
  const H = p.hogd
  const n = Math.max(3, Math.round(p.lober))
  // midja må ha luft til begge sider: ei midje i golvet eller i setet er
  // ikkje ei midje, det er ein kjegle
  const w = Math.min(0.86, Math.max(0.14, p.midjeH))
  const wZ = w * H

  const R = (z: number): number => {
    const t = Math.min(1, Math.max(0, z / H))
    if (t <= w) {
      const u = w > 1e-6 ? t / w : 1
      return p.midjeR + (p.fotR - p.midjeR) * (1 - smooth(Math.pow(u, p.fotkurve)))
    }
    const v = (t - w) / (1 - w)
    return p.midjeR + (p.seteR - p.midjeR) * smooth(Math.pow(v, p.setekurve))
  }

  const rund = (z: number): number => {
    const t = Math.min(1, Math.max(0, z / H))
    return Math.min(0.985, Math.max(0.015, p.rundhet + p.rundvri * (2 * t - 1)))
  }

  // Vridinga er rekna KRING MIDJA. Då står den smalaste kotelina fast
  // medan foten og setet vrir seg kvar sin veg, og stabelen les som eit
  // timeglas som er skrudd, ikkje som ein skrue med eit fast golv.
  const vri = (z: number): number => (p.vri * DEG) * (z / H - w)

  // Holet opnar seg nedanfrå og lukkar seg SEINT oppover. Skeivfordelinga
  // er ikkje pynt — det er TAKET over holet som elles vert eit krage: kvar
  // plate over opninga veks utover att, og veks ho meir enn ho er tjukk,
  // står ho på ingen ting (sjå overheng-regelen). Nedkanten har ikkje det
  // problemet; der smalnar stabelen, og det er ein underskjæring.
  //
  // Begge rampane er likevel haldne lange nok til å strekkje seg over
  // fleire plater. Ein rampe som opnar seg på ei einaste plate legg att
  // ei hylle så djup som heile biten, og det er hylla `trappa` tel.
  const zc = p.holZ * H
  const zLo = zc - 0.42 * p.holhogd
  const zHi = zc + 0.58 * p.holhogd
  const bit = (z: number): number => {
    if (p.holhogd < 8 || p.holtal < 1 || p.holdjup <= 0) return 0
    if (z <= zLo || z >= zHi) return 0
    const u = z < zc ? (z - zc) / (zc - zLo) : (z - zc) / (zHi - zc)
    return p.holdjup * 0.5 * (1 + Math.cos(Math.PI * u))
  }

  // Bita står mellom lobene, med `holfase` som eit skyv derifrå. Det er
  // dei tynne stadene i planet som toler å bli borte; sit biten på ein
  // lobe, et han opp den same lobene stavane skal stå i.
  const nb = Math.max(1, Math.min(6, Math.round(p.holtal)))
  const bitar: number[] = []
  for (let k = 0; k < nb; k++) {
    bitar.push(Math.PI / n + p.holfase * DEG + (k * TAU) / nb)
  }
  const hb = Math.max(4, p.holbreidd) * DEG
  // Vindauget har FLAT BOTN med cos-skuldrer: full djupn over midtpartiet
  // og null verdi OG null stigning ved kanten. Eit reint cos-vindauge er
  // djupast i eitt einaste punkt, og då vert opninga ei bulk i konturen i
  // staden for eit vindauge — det som skal stå att mellom bita er BEIN med
  // luft imellom, ikkje ei bylgje. Skuldra er ein tredel av halvbreidda,
  // og aldri meir enn tjue grader: ei brei skulder et opp bordet ho skal
  // gje form til.
  const sk = Math.min(hb, Math.min(20 * DEG, hb / 3))
  const flat = hb - sk

  /** vindauget åleine, utan djupna: kvar biten VERKAR, ikkje kor hardt */
  const vindu = (th: number, z: number): number => {
    const phi = th - vri(z)
    let f = 0
    for (const b of bitar) {
      let a = (phi - b) % TAU
      if (a > Math.PI) a -= TAU
      if (a < -Math.PI) a += TAU
      a = Math.abs(a)
      if (a >= hb) continue
      const g = a <= flat ? 1 : 0.5 * (1 + Math.cos((Math.PI * (a - flat)) / sk))
      if (g > f) f = g
    }
    return f
  }

  const r = (th: number, z: number): number => {
    const phi = th - vri(z)
    let rr = R(z) * lobeR(phi, n, rund(z), p.sidebog)
    const d = bit(z)
    if (d > 0) rr *= 1 - d * vindu(th, z)
    return Math.max(4, rr)
  }

  const plan = (z: number, N: number): Pt[] => {
    const out: Pt[] = new Array(N)
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU
      const rr = r(th, z)
      out[i] = [rr * Math.cos(th), rr * Math.sin(th)]
    }
    return out
  }

  const kjerne = (z: number, N: number): number => {
    let m = Infinity
    for (let i = 0; i < N; i++) {
      const v = r((i / N) * TAU, z)
      if (v < m) m = v
    }
    return m
  }

  return { p, H, wZ, n, bitar, R, rund, vri, bit, vindu, r, plan, kjerne }
}

/**
 * Areal og omkrins av eit lukka polygon. Nestinga og kuttlista treng
 * arealet, og reglane treng omkrinsen for å rekne fresetid.
 */
export function polyArea(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const b = poly[(i + 1) % poly.length]
    a += poly[i][0] * b[1] - b[0] * poly[i][1]
  }
  return Math.abs(a) / 2
}

/** kortaste avstand frå eit punkt til kanten av eit polygon */
export function edgeDist(poly: Pt[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L2 = dx * dx + dy * dy || 1
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / L2))
    const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy))
    if (d < best) best = d
  }
  return best
}

/** ligg punktet inne i polygonet? */
export function inPoly(poly: Pt[], x: number, y: number): boolean {
  let inn = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inn = !inn
    }
  }
  return inn
}
