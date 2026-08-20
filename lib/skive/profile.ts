/**
 * SKIVE — silhuetten.
 *
 * Éin lukka kontur i (x, z): golv under bakfoten, bogen opp og over til
 * framfoten, golv, framkanten med flare opp til nasen, setet bakover med
 * gropa, ryggen opp og over, og bakkanten ned att til golvet. Kvart segment
 * har FAST punkttal, så to silhuettar med ulike tal alltid kan leggjast
 * oppå kvarandre punkt for punkt — det er det som gjer lofta i flate-
 * visinga mogleg, og det som gjer at terningen aldri kan byggje ein
 * kontur med hol i.
 *
 * Morfen ut mot sidene er heile skilnaden mellom skive og skive: ryggen
 * fell av (kuppelen), setet fell av (sidefallet), og heile silhuetten vert
 * dregen litt inn (innsvinget). u er 0 midt i møbelet og 1 ytst.
 */
import { keep, shoelace, type Pt } from "../core"
import type { Params } from "./params"

/** punkttal per segment, skalert av detaljnivået */
export type ProfDetail = { k: number }
export const DETAIL: Record<"lav" | "mid" | "hog", ProfDetail> = {
  lav: { k: 0.6 },
  mid: { k: 1 },
  hog: { k: 1.7 },
}

const N = (base: number, k: number) => Math.max(3, Math.round(base * k))

/** setetoppen ved x, FØR morf: gropa er djupast 60 % bak på setet */
function seatTop(p: Params, x: number, gropEkstra: number): number {
  const xN = p.djup / 2
  const xB = -p.djup / 2
  const t = Math.min(1, Math.max(0, (xN - x) / (xN - xB)))
  const bell = Math.sin(Math.PI * Math.pow(t, 0.85)) ** 2
  return p.hogd - (p.grop + gropEkstra) * bell
}

export type Profile = {
  /** lukka kontur, mot klokka (positivt areal) */
  outline: Pt[]
  /** stavhòla, med klokka */
  holes: Pt[][]
  /** nøkkelpunkt til måling og reglar */
  xNase: number
  xRygg: number
  ryggH: number
  framfot: [number, number]
  bakfot: [number, number]
  area: number
}

/**
 * Silhuetten for morf-graden u i [0, 1], utan hòl. Same punkttal same kva
 * u og parametrar — det er kontrakten lofta byggjer på.
 */
export function profileAt(p: Params, u: number, k = 1): Pt[] {
  const sx = 1 - p.innsving * u * u
  const gropEkstra = p.sidefall * u * u
  const ryggH = Math.max(2, p.ryggH * (1 - p.kuppel * u * u))
  // GROTTA: bogen krympar ut mot sidene og toppen hans sig på skrå —
  // hòla vert eit skulptert rom gjennom stabelen, ikkje ein tunnel
  const bogeH = p.bogeH * (1 - p.bogefall * u * u)
  const drift = p.bogedrift * u * u

  const xN0 = p.djup / 2
  const xB0 = -p.djup / 2
  const tanV = Math.tan((p.ryggV * Math.PI) / 180)

  // føtene, i u-lause koordinatar (morfen skalerer alt til slutt)
  const xFFy = xN0 + 0.25 * p.frambein // framfot, fremste hjørne
  const xFF0 = xFFy - p.frambein
  const bakFl = p.bakflare * p.bakbein // bakkanten sparkar bakover ned mot golvet
  const xRF0 = xB0 - p.ryggT - bakFl
  const xRF1r = xRF0 + p.bakbein
  // bogen treng eit spenn: bakfoten får aldri eta seg forbi framfoten
  const xRF1 = Math.min(xRF1r, xFF0 - 40)

  const pts: Pt[] = []
  const put = (x: number, z: number) => pts.push([x * sx, Math.max(0, z)])

  // 1 — golvet under bakfoten
  const nGolvB = N(2, k)
  for (let i = 0; i < nGolvB; i++) put(xRF0 + (i / nGolvB) * (xRF1 - xRF0), 0)

  // 2 — bogen: opp frå bakfoten, over, ned på framfoten. Toppunktet kan
  // sitje skeivt (drifta), og då vert w rekna mot det skeive toppunktet i
  // staden for midten — same kurvefamilie, berre dregen i eine enden.
  const nBoge = N(44, k)
  const span = Math.max(1, xFF0 - xRF1)
  const tp = Math.min(0.85, Math.max(0.15, 0.5 + drift / span))
  // MIDTFOTEN: kløyver bogen i to sjølvstendige bogar med golv imellom —
  // akvedukten. Foten står der bogetoppen elles ville stått, so drifta
  // let han VANDRE gjennom stabelen. Vert eit av boga smalare enn 26 mm,
  // lukkar det seg og foten veks saman med grannen sin. Utan bogehøgd i
  // det heile er silhuetten ein massiv PIDESTALL frå golv til sete.
  const fw = Math.min(p.mellomfot, Math.max(0, span - 60)) / 2
  const arch = (x: number): number => {
    if (fw < 1) {
      const t = (x - xRF1) / span
      const w = t < tp ? (tp - t) / tp : (t - tp) / (1 - tp)
      return bogeH * Math.pow(Math.max(0, 1 - Math.pow(w, p.bogeN)), 1 / p.bogeN)
    }
    const xM = xRF1 + tp * span
    const s0 = x < xM ? xRF1 : xM + fw
    const s1 = x < xM ? xM - fw : xFF0
    const sw = s1 - s0
    if (sw < 26 || x < s0 || x > s1) return 0
    const h = Math.min(bogeH, sw * 2.2)
    const w = Math.abs(x - (s0 + s1) / 2) / (sw / 2)
    return h * Math.pow(Math.max(0, 1 - Math.pow(w, p.bogeN)), 1 / p.bogeN)
  }
  for (let i = 0; i < nBoge; i++) {
    const t = i / (nBoge - 1)
    put(xRF1 + t * (xFF0 - xRF1), arch(xRF1 + t * (xFF0 - xRF1)))
  }

  // 3 — golvet under framfoten
  const nGolvF = N(2, k)
  for (let i = 0; i < nGolvF; i++) put(xFF0 + (i / nGolvF) * (xFFy - xFF0), 0)

  // 4 — framkanten: flare frå foten opp til nasen
  const zNase = seatTop(p, xN0, gropEkstra) - p.nase
  const nFram = N(22, k)
  for (let i = 0; i < nFram; i++) {
    const t = i / nFram
    const z = t * zNase
    const x = xN0 + (xFFy - xN0) * Math.pow(1 - t, p.flare)
    put(x, z)
  }

  // 5 — nasen: kvartsirkel inn på setet
  const cN: Pt = [xN0 - p.nase, zNase]
  const nNase = N(10, k)
  for (let i = 0; i <= nNase; i++) {
    const a = (i / nNase) * (Math.PI / 2)
    put(cN[0] + p.nase * Math.cos(a), cN[1] + p.nase * Math.sin(a))
  }

  // 6 — setet bakover, med gropa
  const nSete = N(38, k)
  for (let i = 1; i <= nSete; i++) {
    const x = cN[0] + (i / nSete) * (xB0 - cN[0])
    put(x, seatTop(p, x, gropEkstra))
  }

  // 7 — ryggen si framside, opp
  const zSeteB = seatTop(p, xB0, gropEkstra)
  const topR = Math.min(p.ryggT / 2, Math.max(4, ryggH * 0.45))
  const zTopp = zSeteB + ryggH
  const nRyggF = N(16, k)
  for (let i = 1; i <= nRyggF; i++) {
    const t = i / nRyggF
    const z = zSeteB + t * (ryggH - topR)
    const x = xB0 - tanV * (z - zSeteB) - p.ryggB * Math.sin(Math.PI * t) * 0.4
    put(x, z)
  }

  // 8 — over toppen: halvsirkel frå framsida til baksida
  const xToppF = xB0 - tanV * (ryggH - topR)
  const cT: Pt = [xToppF - p.ryggT / 2, zTopp - topR]
  const nTopp = N(12, k)
  for (let i = 0; i <= nTopp; i++) {
    const a = (i / nTopp) * Math.PI
    put(cT[0] + (p.ryggT / 2) * Math.cos(a), cT[1] + topR * Math.sin(a))
  }

  // 9 — baksida ned til setenivå, parallell med framsida
  const nRyggB = N(14, k)
  for (let i = 1; i <= nRyggB; i++) {
    const t = 1 - i / nRyggB
    const z = zSeteB + t * (ryggH - topR)
    put(xB0 - p.ryggT - tanV * (z - zSeteB) + p.ryggB * Math.sin(Math.PI * t) * 0.2, z)
  }

  // 10 — bakkanten ned til golvet, med flaren bakover
  const nBak = N(16, k)
  for (let i = 1; i <= nBak; i++) {
    const t = i / nBak
    const z = zSeteB * (1 - t)
    const x = xB0 - p.ryggT - bakFl * Math.pow(t, 1.7)
    put(x, z)
  }

  // Segmentskøytane legg att nokre doble punkt (bogen sluttar der golvet
  // byrjar, ryggen der toppbogen byrjar). Dei ligg på SAME indeksar for
  // kvar einaste u, so fjerninga endrar ikkje taljekontrakten lofta
  // byggjer på — men eit dobbelt punkt i eit lok er ei retta kant utan
  // makker, og då er skalet ope.
  const clean: Pt[] = []
  for (const q of pts) {
    const prev = clean[clean.length - 1]
    if (prev && Math.abs(prev[0] - q[0]) < 1e-7 && Math.abs(prev[1] - q[1]) < 1e-7) continue
    clean.push(q)
  }
  while (
    clean.length > 3 &&
    Math.abs(clean[0][0] - clean[clean.length - 1][0]) < 1e-7 &&
    Math.abs(clean[0][1] - clean[clean.length - 1][1]) < 1e-7
  ) {
    clean.pop()
  }
  if (shoelace(clean) < 0) clean.reverse()
  return clean
}

// =============================================================================
// STAVANE
// =============================================================================
export type Rod = { x: number; z: number }

function inPoly(poly: Pt[], x: number, z: number): boolean {
  let inn = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) {
      inn = !inn
    }
  }
  return inn
}

/** minste avstand frå punktet til konturen — stavhòlet treng gods rundt seg */
function clearance(poly: Pt[], x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const L2 = dx * dx + dz * dz || 1
    const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / L2))
    const d = Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz))
    if (d < best) best = d
  }
  return best
}

/**
 * Tre stavar: éin i kvart bein og éin i godset mellom bogen og setet.
 * Kandidaten må stå i gods med mon i ALLE skivene — morfen dreg dei ytste
 * inn, så det som er trygt midt i møbelet kan vera luft ytst. Finn han
 * ikkje plass, fell staven bort, og regelen seier frå.
 */
export function findRods(
  p: Params,
  profiles: Pt[][],
  toLocal: (x: number, z: number, i: number) => [number, number] = (x, z) => [x, z],
): Rod[] {
  const need = p.stavD / 2 + 6
  const ok = (x: number, z: number) =>
    profiles.every((poly, i) => {
      const [lx, lz] = toLocal(x, z, i)
      return inPoly(poly, lx, lz) && clearance(poly, lx, lz) >= need
    })

  const seek = (x0: number, z0: number): Rod | null => {
    for (const r of [0, 8, 16, 26, 38]) {
      for (let a = 0; a < 8; a++) {
        const x = x0 + r * Math.cos((a / 8) * Math.PI * 2)
        const z = z0 + r * Math.sin((a / 8) * Math.PI * 2)
        if (z > need && ok(x, z)) return { x, z }
        if (r === 0) break
      }
    }
    return null
  }

  const xN0 = p.djup / 2
  const xB0 = -p.djup / 2
  const rods: (Rod | null)[] = [
    // framboten: midt i framfoten, lågt
    seek(xN0 + 0.25 * p.frambein - p.frambein / 2, 55),
    // bakbeinet
    seek(xB0 - p.ryggT - p.bakflare * p.bakbein + p.bakbein / 2, 55),
    // setebandet: mellom bogetoppen og gropa
    seek(0, (p.bogeH + p.hogd - p.grop) / 2),
  ]
  return rods.filter((r): r is Rod => r !== null)
}

// =============================================================================
// SKIVENE SOM DELAR
// =============================================================================
export type Slice = {
  /** senterposisjonen langs Y, mm */
  y: number
  /** morf-graden, 0 midt og 1 ytst */
  u: number
  /** vifterotasjonen kring Z, radianar — signert: minus på eine sida */
  rot: number
  outline: Pt[]
  holes: Pt[][]
  area: number
}

export type Build = {
  slices: Slice[]
  rods: Rod[]
  /** samla breidd langs Y, mm */
  width: number
}

/** stavhòlet som sekstenkant, med klokka (hòl går motsett veg av konturen) */
function rodHole(r: Rod, radius: number): Pt[] {
  const ring: Pt[] = []
  for (let i = 15; i >= 0; i--) {
    const a = (i / 16) * Math.PI * 2
    ring.push([r.x + radius * Math.cos(a), r.z + radius * Math.sin(a)])
  }
  return ring
}

/**
 * Berehòlet: ein kapsel midt i ryggen, lagd langs ryggaksen so han følgjer
 * leninga. Hòlet finst berre der ryggen har gods til det — kuppelen dreg
 * ryggen ned ut mot sidene, og då smeltar grepet att skive for skive.
 * Fingrane treng 26 mm: smalare hòl vert ikkje bora i det heile.
 */
function gripHole(p: Params, u: number, outline: Pt[]): Pt[] | null {
  if (p.grep < 30) return null
  const ryggH = Math.max(2, p.ryggH * (1 - p.kuppel * u * u))
  if (ryggH < 55) return null
  const sx = 1 - p.innsving * u * u
  const gropEkstra = p.sidefall * u * u
  const xB0 = -p.djup / 2
  const v = (p.ryggV * Math.PI) / 180
  const ax = { x: -Math.sin(v), z: Math.cos(v) }
  const nx = { x: Math.cos(v), z: Math.sin(v) }
  const zSeteB = seatTop(p, xB0, gropEkstra)
  const r = 13
  const L = Math.min(p.grep, ryggH * 0.55) / 2
  if (L < 15) return null
  const sL = Math.max(0, L - r)
  const topR = Math.min(p.ryggT / 2, Math.max(4, ryggH * 0.45))
  const hC = ryggH * 0.5
  const tB = Math.min(1, hC / Math.max(1, ryggH - topR))
  const xC = xB0 - p.ryggT / 2 - Math.tan(v) * hC - p.ryggB * Math.sin(Math.PI * tB) * 0.1
  const zC = zSeteB + hC
  const raw: Pt[] = []
  for (let j = 0; j <= 10; j++) {
    const a = (j / 10) * Math.PI
    raw.push([
      xC + ax.x * sL + r * (nx.x * Math.cos(a) + ax.x * Math.sin(a)),
      zC + ax.z * sL + r * (nx.z * Math.cos(a) + ax.z * Math.sin(a)),
    ])
  }
  for (let j = 0; j <= 10; j++) {
    const a = Math.PI + (j / 10) * Math.PI
    raw.push([
      xC - ax.x * sL + r * (nx.x * Math.cos(a) + ax.x * Math.sin(a)),
      zC - ax.z * sL + r * (nx.z * Math.cos(a) + ax.z * Math.sin(a)),
    ])
  }
  const ring: Pt[] = []
  for (const q of raw) {
    const s: Pt = [q[0] * sx, q[1]]
    const prev = ring[ring.length - 1]
    if (prev && Math.abs(prev[0] - s[0]) < 1e-7 && Math.abs(prev[1] - s[1]) < 1e-7) continue
    ring.push(s)
  }
  while (
    ring.length > 3 &&
    Math.abs(ring[0][0] - ring[ring.length - 1][0]) < 1e-7 &&
    Math.abs(ring[0][1] - ring[ring.length - 1][1]) < 1e-7
  ) {
    ring.pop()
  }
  if (ring.length < 3) return null
  // hòlet må stå i gods med mon i DENNE skiva — elles finst det ikkje her
  for (const q of ring) {
    if (!inPoly(outline, q[0], q[1]) || clearance(outline, q[0], q[1]) < 6.5) return null
  }
  ring.reverse() // hòl går med klokka
  return ring
}

const BYGG_HUGS = keep<Build>(3)

export function buildSlices(p: Params, k = 1): Build {
  return BYGG_HUGS(JSON.stringify(p) + "|" + k, () => buildSlicesRaw(p, k))
}

function buildSlicesRaw(p: Params, k: number): Build {
  const n = Math.max(2, Math.round(p.skiver))
  const width = n * p.plyT + (n - 1) * p.luft
  const half = (n - 1) / 2

  // LUFTFALLET: gapa kan gradast gjennom stabelen — positivt luftfall
  // pakkar skivene saman mot midten (orgelpipa), negativt mot kantane.
  // Vektene vert normaliserte mot sin eigen sum, so summen av gapa — og
  // dermed breidda — står nøyaktig fast: kuben, setet på tvers og nestinga
  // les same tal som før. Golvet på 0.05 held kvart gap ope.
  const m = n - 1
  const gaps: number[] = []
  if (p.luftfall !== 0 && m > 0) {
    const ws: number[] = []
    for (let j = 0; j < m; j++) {
      const c = m > 1 ? Math.abs(j - (m - 1) / 2) / ((m - 1) / 2) : 1
      ws.push(Math.max(0.05, 1 - p.luftfall * (1 - c)))
    }
    const sum = ws.reduce((s, w) => s + w, 0)
    for (const w of ws) gaps.push((p.luft * m * w) / sum)
  }

  const outlines: Pt[][] = []
  const us: number[] = []
  const ys: number[] = []
  const rots: number[] = []
  let yAt = -width / 2 + p.plyT / 2
  for (let i = 0; i < n; i++) {
    const su = half > 0 ? (i - half) / half : 0
    us.push(Math.abs(su))
    ys.push(gaps.length ? yAt : (i - half) * (p.plyT + p.luft))
    if (gaps.length && i < m) yAt += p.plyT + gaps[i]
    rots.push((p.vifte * su * Math.PI) / 180)
    outlines.push(profileAt(p, Math.abs(su), k))
  }

  // Staven står i VERDA og skivene står i vifta: hòlet i skive i sit der
  // stavlina kryssar plata sitt plan — u_lokal = (x0 + y·sin a) / cos a.
  // Kandidaten må difor prøvast i kvar skive sine EIGNE koordinatar.
  const local = (x0: number, i: number): number =>
    (x0 + ys[i] * Math.sin(rots[i])) / Math.cos(rots[i])
  const rods = findRods(p, outlines, (x0, z, i) => [local(x0, i), z])

  // hòlet er staven pluss klaring, vidga eit hår for skråkryssinga
  const maxRot = (Math.abs(p.vifte) * Math.PI) / 180
  const holeR = (p.stavD / 2 + 0.2) / Math.max(0.6, Math.cos(maxRot))

  const slices: Slice[] = outlines.map((o, i) => {
    const holes = rods.map((r) => rodHole({ x: local(r.x, i), z: r.z }, holeR))
    const grip = gripHole(p, us[i], o)
    if (grip) holes.push(grip)
    return {
      y: ys[i],
      u: us[i],
      rot: rots[i],
      outline: o,
      holes,
      area:
        Math.abs(shoelace(o)) - holes.reduce((s, h) => s + Math.abs(shoelace(h)), 0),
    }
  })

  return { slices, rods, width }
}
