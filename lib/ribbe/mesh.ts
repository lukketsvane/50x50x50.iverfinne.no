/**
 * RIBBE — dei tre lesemåtane.
 *
 * `flate` er skalet blada er meridianar i, som ei samanhengande flate: det
 * objektet nærmar seg, men aldri er. `lag` er det som faktisk står der —
 * blad, band og sete, kvar for seg, med spora synlege. `kontur` er dei
 * flate kuttprofilane, lagde oppå kvarandre slik dei ligg på plata.
 *
 * Skilnaden mellom `flate` og `lag` er heile typologien. Alt anna i
 * prosjektet handlar om kva den skilnaden kostar.
 */
import { keep, type BuildOut, type DetailKey, type Vec3, type View } from "../core"
import type { Params } from "./params"
import { makeShell, type Shell } from "./shell"
import { bladeGeom, type BladeGeom } from "./blade"
import { bandGeom, type BandGeom } from "./band"
import { seatGeom, type SeatGeom } from "./seat"
import { newSoup, soupToMesh, strip, type Soup } from "./solid"

export const DETAIL: Record<DetailKey, { nz: number; nt: number }> = {
  lav: { nz: 26, nt: 96 },
  mid: { nz: 54, nt: 168 },
  hog: { nz: 96, nt: 288 },
}

/** Kvar tom Float32Array må vera si eiga. Ein delt konstant vert frakopla
 *  fyrste gongen han går gjennom postMessage, og då døyr kvar melding
 *  etter den fyrste — ein feil som ser ut som ein frosen skjerm. */
const EMPTY = () => new Float32Array(0)

export type Built = {
  sh: Shell
  blades: BladeGeom[]
  bands: BandGeom[]
  seat: SeatGeom
}

/** Heile objektet som geometri, ein gong, slik at nett, delar, mål og
 *  reglar les det same og ikkje kvar sin versjon av det. */
const BYGG_HUGS = keep<Built>(3)
export function buildAll(p: Params, d: { nz: number; nt: number }, sh0?: Shell): Built {
  return BYGG_HUGS(`${JSON.stringify(p)}|${d.nz}x${d.nt}`, () => buildAllRaw(p, d, sh0))
}

function buildAllRaw(p: Params, d: { nz: number; nt: number }, sh0?: Shell): Built {
  const sh = sh0 ?? makeShell(p)
  const blades: BladeGeom[] = []
  for (let k = 0; k < sh.angles.length; k++) blades.push(bladeGeom(sh, k, d.nz))
  const bands: BandGeom[] = []
  for (let j = 0; j < sh.bandZ.length; j++) bands.push(bandGeom(sh, j, d.nt))
  return { sh, blades, bands, seat: seatGeom(sh, d.nt) }
}

// =============================================================================
// KROPPANE
// =============================================================================
/** Bladet ligg i sitt eige plan: s ut langs bladlina, z opp, og tjukna på
 *  tvers. (z, s, n) er høgrehendt, så vindinga i `strip` treng ingen flip. */
function bladeSolid(s: Soup, sh: Shell, g: BladeGeom) {
  const h = sh.p.bladeT / 2
  const b = g.b
  strip(
    s,
    g.st,
    (u, v, w) => [b.a[0] + v * b.d[0] + w * b.n[0], b.a[1] + v * b.d[1] + w * b.n[1], u],
    { w0: () => -h, w1: () => h },
  )
}

/** Ringen er (θ, r, z), og det er venstrehendt — difor flip. */
function bandSolid(s: Soup, g: BandGeom) {
  strip(s, g.st, (u, v, w) => [v * Math.cos(u), v * Math.sin(u), w], {
    closed: true,
    flip: true,
    w0: () => g.z0,
    w1: () => g.z1,
  })
}

/**
 * Setet er ei skål og ikkje ei kjegle, og ei skål treng meir enn to punkt
 * langs radien. Difor vert han bygd som konsentriske ringar: kvar ring er
 * ein LUKKA kropp for seg, og to naboringar deler ei flate som ligg inne i
 * materialet. Den flata er talt to gonger — éin gong med kvar si retning —
 * så volumet er framleis eksakt, og ingen kant står att utan motpart.
 */
function seatSolid(s: Soup, sh: Shell, g: SeatGeom, nr = 10) {
  const surf = (u: number, v: number) => Math.max(g.z0 + 2, sh.seatSurf(u, v))
  for (let k = 0; k < nr; k++) {
    const ring = g.st.map((q) => ({ u: q.u, a: (q.b * k) / nr, b: (q.b * (k + 1)) / nr }))
    strip(s, ring, (u, v, w) => [v * Math.cos(u), v * Math.sin(u), w], {
      closed: true,
      flip: true,
      loSide: k === 0,
      hiSide: k === nr - 1,
      w0: () => g.z0,
      w1: surf,
    })
  }
}

/** Skalet som flate: same (θ, z, r), og det er høgrehendt. Same stabling som
 *  i setet — eit skal med midje treng fleire enn to høgder for å ha midje. */
function shellSolid(s: Soup, sh: Shell, d: { nz: number; nt: number }) {
  const t = sh.p.bladeT
  // Flata er glatt i begge retningar, så ho treng like mange steg opp som
  // rundt. Vinkelen er overprøvd i dei to andre lesemåtane — der er det
  // spora som krev tettleik — og halvparten er nok her.
  const nz = Math.max(10, Math.round(d.nz / 2))
  const nt = Math.max(48, Math.round(d.nt / 2))
  const ths: number[] = []
  for (let i = 0; i < nt; i++) ths.push((i / nt) * Math.PI * 2)
  for (let j = 0; j < nz; j++) {
    const z0 = (sh.zBlade * j) / nz
    const z1 = (sh.zBlade * (j + 1)) / nz
    strip(
      s,
      ths.map((th) => ({ u: th, a: z0, b: z1 })),
      (u, v, w) => [w * Math.cos(u), w * Math.sin(u), v],
      {
        closed: true,
        loSide: j === 0,
        hiSide: j === nz - 1,
        w0: (u, v) => Math.max(4, sh.rOuter(u, v) - t),
        w1: (u, v) => sh.rOuter(u, v),
      },
    )
  }
}

// =============================================================================
// BYGGET
// =============================================================================
export function build(p: Params, detail: DetailKey, view: View, sh0?: Shell): BuildOut {
  const d = DETAIL[detail]
  const sh = sh0 ?? makeShell(p)

  if (view === "kontur") {
    const g = buildAll(p, DETAIL.mid, sh)
    const c = contourLines(g)
    // Boksen vert lesen av linene sjølve. Konturteikninga legg bladprofilane
    // i eitt plan og ringane der dei står, så ho fyller eit anna rom enn
    // objektet — og kameraet skal ramme inn det som faktisk vert teikna.
    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const arr of [c.lines, c.heavy]) {
      for (let i = 0; i < arr.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          if (arr[i + k] < min[k]) min[k] = arr[i + k]
          if (arr[i + k] > max[k]) max[k] = arr[i + k]
        }
      }
    }
    if (!Number.isFinite(min[0])) {
      min[0] = min[1] = min[2] = 0
      max[0] = max[1] = max[2] = 1
    }
    return {
      positions: EMPTY(),
      normals: EMPTY(),
      tris: 0,
      min,
      max,
      lines: c.lines,
      heavy: c.heavy,
    }
  }

  const s = newSoup()
  if (view === "flate") {
    shellSolid(s, sh, d)
    seatSolid(s, sh, seatGeom(sh, d.nt))
  } else {
    lagSoup(s, sh, buildAll(p, d, sh))
  }
  const m = soupToMesh(s)
  return { ...m, lines: EMPTY(), heavy: EMPTY() }
}

/** Objektet slik det står: kvar del for seg, med klaring i ledda, så ingen
 *  to kroppar skjer kvarandre og volumet er talt éin gong. */
export function lagSoup(s: Soup, sh: Shell, g: Built) {
  for (const bl of g.blades) bladeSolid(s, sh, bl)
  for (const bd of g.bands) bandSolid(s, bd)
  seatSolid(s, sh, g.seat)
}

export function lagMesh(sh: Shell, g: Built) {
  const s = newSoup()
  lagSoup(s, sh, g)
  return soupToMesh(s)
}

// =============================================================================
// KONTUR
// =============================================================================
/**
 * Bladprofilane lagde oppå kvarandre i eitt loddrett plan, og ringane i
 * si eiga høgd. Det er den einaste teikninga som viser kva som er felles
 * og kva som skil: er planet rundt, fell alle tjueto profilane saman i éin
 * strek, og då finst det berre éin unik del.
 */
export function contourLines(g: Built): { lines: Float32Array; heavy: Float32Array } {
  const thin: number[] = []
  const bold: number[] = []
  const seg = (dst: number[], a: Vec3, b: Vec3) => dst.push(a[0], a[1], a[2], b[0], b[1], b[2])

  for (const bl of g.blades) {
    const dst = bl.b.k % 3 === 0 ? bold : thin
    const poly = outlineOf(bl)
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      seg(dst, [g.sh.rHub + a[0], 0, a[1]], [g.sh.rHub + b[0], 0, b[1]])
    }
  }
  for (const bd of g.bands) {
    for (const ring of [bd.st.map((q) => [q.b, q.u]), bd.st.map((q) => [q.a, q.u])]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]
        const b = ring[(i + 1) % ring.length]
        seg(
          bold,
          [a[0] * Math.cos(a[1]), a[0] * Math.sin(a[1]), bd.z],
          [b[0] * Math.cos(b[1]), b[0] * Math.sin(b[1]), bd.z],
        )
      }
    }
  }
  const so = g.seat.outline
  for (let i = 0; i < so.length; i++) {
    const a = so[i]
    const b = so[(i + 1) % so.length]
    seg(bold, [a[0], a[1], g.seat.z1], [b[0], b[1], g.seat.z1])
  }
  return { lines: new Float32Array(thin), heavy: new Float32Array(bold) }
}

/** Bladet som lukka polygon i (s, z): ytterkanten opp, innerkanten ned. */
export function outlineOf(g: BladeGeom): [number, number][] {
  const out: [number, number][] = []
  for (const q of g.st) out.push([q.b, q.u])
  for (let i = g.st.length - 1; i >= 0; i--) out.push([g.st[i].a, g.st[i].u])
  return out
}
