/**
 * SANDKASSE — laga.
 *
 * Same objekt, lese som konstruksjon. Ein flate som er krum i to
 * retningar samstundes let seg ikkje bøyge av ei plate utan å kutte
 * henne opp; ho let seg derimot stable av flate lag og slipast ned.
 *
 * Eit lag er eit vassrett snitt gjennom godset, med slipemon lagt på
 * ytterkanten og innerkanten ståande som kutta. Nede er snittet fleire
 * lause delar — beina — og oppe er det éin lukka ring. Ingen del er krum
 * før ho er limt.
 */
import { makeShell, wrapPi, type Shell } from "./field"
import { MATERIALS, type Params } from "./params"

const TAU = Math.PI * 2

export type Pt = [number, number]

export type Part = {
  layer: number
  index: number
  /** ytre kontur, lukka polygon, mm — slipemon er lagt til */
  outline: Pt[]
  /** hòl inne i delen, som kutta */
  holes: Pt[][]
  /** true når laget er ein lukka ring, false når delen er ei laus bit */
  ring: boolean
  /** kor mange vinkelsteg delen dekkjer — held paret mellom ytre og indre
   *  kant eksplisitt, slik at delen kan trianguleras utan ei ear-clipping */
  span: number
  area: number // mm², netto
  mass: number // kg
  wmin: number // smalaste gods i delen, mm
}

export type Layer = {
  i: number
  z0: number
  z1: number
  t: number
  parts: Part[]
}

export type Stack = {
  layers: Layer[]
  plyT: number
  count: number // tal lag
  parts: number // tal delar
  area: number // mm² finér i alt
  mass: number // kg som kutta
}

type Iv = { lo: number; hi: number } | null

/**
 * Bandet veggen opptek langs radien ved høgda z, målt frå ryggraden i
 * laget sitt midtplan.
 *
 * Det er ikkje det same som skaltjukna. Innerflata er skuva langs
 * normalen, ikkje vassrett, så eit vassrett snitt gjennom ein vegg som
 * ligg ned vert breitt og eitt gjennom ein vegg som står bratt vert
 * smalt — nett difor står limfugene tett der flata er bratt og spreidd
 * der ho legg seg. Vi må difor finne kva høgd på ytterflata som havnar
 * på z etter offsettet, ikkje berre trekkje frå tjukna.
 */
function wallBand(sh: Shell, th: number, z: number, cx: number, cy: number): Iv {
  const top = sh.rimZ(th)
  if (z > top || sh.matAt(th, sh.hOf(z)) < 1) return null
  const o = sh.outer(th, z)
  const hi = Math.hypot(o[0] - cx, o[1] - cy)
  let zs = z
  for (let k = 0; k < 3; k++) {
    const n = sh.normal(th, zs)
    const t = sh.wall(th, zs)
    zs = Math.min(top, Math.max(0, z + n[2] * t))
  }
  const n2 = sh.normal(th, zs)
  const t2 = sh.wall(th, zs)
  const o2 = sh.outer(th, zs)
  const lo = Math.hypot(o2[0] - n2[0] * t2 - cx, o2[1] - n2[1] * t2 - cy)
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) }
}

/** Kvar skåla si flate skjer høgda z, uttrykt i normalisert radius. */
function dishQ(sh: Shell, p: Params, th: number, z: number): number {
  const ctr = p.seatZ - p.dish
  const edge = sh.seatEdgeZ(th)
  if (edge <= ctr) return 1
  const u = (z - ctr) / (edge - ctr)
  if (u <= 0) return 0
  if (u >= 1) return 1
  const e = p.dishExp * (1 + p.saddle * Math.cos(2 * (th - (p.saddleDir * Math.PI) / 180)))
  return Math.pow(u, 1 / e)
}

/** Bandet setet opptek langs radien over høgdespennet [z0, z1]. */
function seatBand(
  sh: Shell,
  p: Params,
  th: number,
  z0: number,
  z1: number,
  cx: number,
  cy: number,
): Iv {
  const bot = p.seatZ - p.dish - p.shellT
  if (z1 < bot || z0 > p.seatZ) return null
  const zEdge = sh.seatEdgeZ(th)
  const rTop = sh.rOuter(th, zEdge) + p.lip
  const qLo = dishQ(sh, p, th, z0)
  const qHi = dishQ(sh, p, th, z1 + p.shellT)
  if (qHi <= qLo) return null
  const c = sh.spine(sh.hOf(zEdge))
  const d = Math.hypot(c[0] - cx, c[1] - cy)
  return { lo: Math.max(0, qLo * rTop - d), hi: qHi * rTop + d }
}

export function buildStack(p: Params, shell?: Shell, nth = 360): Stack {
  const sh = shell ?? makeShell(p)
  const rho = MATERIALS[p.material].rho
  // Høgda går sjeldan opp i platetjukna. Blir resten øvst mindre enn eit
  // halvt lag, vert han slått saman med laget under i staden for å bli ein
  // eigen del: ei flis på nokre millimeter let seg korkje kutta reint,
  // spenna opp eller lima på plass. Det øvste laget vert då eit fullt lag
  // som er skore etter det breiaste snittet gjennom sitt eige spenn, og
  // resten går bort i slipinga — som han uansett ville gjort.
  let count = Math.max(2, Math.ceil(sh.zTop / p.plyT))
  if (count > 2 && sh.zTop - (count - 1) * p.plyT < p.plyT * 0.5) count -= 1
  const layers: Layer[] = []
  let totArea = 0
  let nParts = 0

  for (let i = 0; i < count; i++) {
    const z0 = i * p.plyT
    const z1 = i === count - 1 ? sh.zTop : Math.min(sh.zTop, z0 + p.plyT)
    if (z1 - z0 < 0.5) break
    const zm = (z0 + z1) / 2
    const [cx, cy] = sh.spine(sh.hOf(zm))
    const zs = [z0 + 0.02, zm, z1 - 0.02]

    // radielle band per vinkel
    const outerR = new Array<number>(nth).fill(NaN)
    const innerR = new Array<number>(nth).fill(NaN)
    const ringLo = new Array<number>(nth).fill(NaN)
    const ringHi = new Array<number>(nth).fill(NaN)

    for (let k = 0; k < nth; k++) {
      const th = (k / nth) * TAU
      let lo = Infinity
      let hi = -Infinity
      for (const z of zs) {
        const b = wallBand(sh, th, z, cx, cy)
        if (!b) continue
        lo = Math.min(lo, b.lo)
        hi = Math.max(hi, b.hi)
      }
      const sb = seatBand(sh, p, th, z0, z1, cx, cy)
      const haveWall = hi > -Infinity
      if (haveWall && sb && sb.hi >= lo - 0.5) {
        // setet og veggen heng saman — eitt band
        lo = Math.min(lo, sb.lo)
        hi = Math.max(hi, sb.hi)
      } else if (sb) {
        ringLo[k] = sb.lo
        ringHi[k] = sb.hi
      }
      if (haveWall) {
        outerR[k] = hi + p.sand
        innerR[k] = Math.max(1, lo)
      }
    }

    const parts: Part[] = []
    const push = (
      run: number[],
      ro: number[],
      ri: number[],
      ring: boolean,
    ) => {
      const outline: Pt[] = []
      const holes: Pt[][] = []
      let wmin = Infinity
      for (let q = 0; q < run.length; q++) {
        const th = (run[q] / nth) * TAU
        wmin = Math.min(wmin, ro[q] - ri[q])
      }
      if (ring) {
        for (let q = 0; q < run.length; q++) {
          const th = (run[q] / nth) * TAU
          outline.push([cx + ro[q] * Math.cos(th), cy + ro[q] * Math.sin(th)])
        }
        const hole: Pt[] = []
        for (let q = run.length - 1; q >= 0; q--) {
          const th = (run[q] / nth) * TAU
          hole.push([cx + ri[q] * Math.cos(th), cy + ri[q] * Math.sin(th)])
        }
        holes.push(hole)
      } else {
        for (let q = 0; q < run.length; q++) {
          const th = (run[q] / nth) * TAU
          outline.push([cx + ro[q] * Math.cos(th), cy + ro[q] * Math.sin(th)])
        }
        for (let q = run.length - 1; q >= 0; q--) {
          const th = (run[q] / nth) * TAU
          outline.push([cx + ri[q] * Math.cos(th), cy + ri[q] * Math.sin(th)])
        }
      }
      const area = Math.abs(shoelace(outline)) - holes.reduce((a, h) => a + Math.abs(shoelace(h)), 0)
      if (area < 200) return
      parts.push({
        layer: i,
        index: parts.length,
        outline,
        holes,
        ring,
        span: run.length,
        area,
        mass: (area * p.plyT * rho) / 1e9,
        wmin: Number.isFinite(wmin) ? wmin : 0,
      })
    }

    const present = outerR.map((v) => Number.isFinite(v))
    if (present.every(Boolean)) {
      push(
        Array.from({ length: nth }, (_, k) => k),
        outerR,
        innerR,
        true,
      )
    } else if (present.some(Boolean)) {
      let start = -1
      for (let k = 0; k < nth; k++) if (!present[k] && present[(k + 1) % nth]) start = (k + 1) % nth
      if (start >= 0) {
        let k = start
        let run: number[] = []
        for (let c = 0; c < nth; c++) {
          if (present[k]) run.push(k)
          else if (run.length) {
            push(run, run.map((q) => outerR[q]), run.map((q) => innerR[q]), false)
            run = []
          }
          k = (k + 1) % nth
        }
        if (run.length) push(run, run.map((q) => outerR[q]), run.map((q) => innerR[q]), false)
      }
    }

    // setet som eigen ring der det ikkje heng saman med veggen
    if (ringHi.every((v) => Number.isFinite(v))) {
      push(
        Array.from({ length: nth }, (_, k) => k),
        ringHi.map((v) => v + p.sand),
        ringLo,
        true,
      )
    }

    for (const q of parts) totArea += q.area
    nParts += parts.length
    // tjukna er plata si, ikkje spennet: det er plata som veg og som skal
    // limast, sjølv om det øvste laget dekkjer litt meir høgd enn ho er tjukk
    layers.push({ i, z0, z1, t: p.plyT, parts })
  }

  return {
    layers,
    plyT: p.plyT,
    count: layers.length,
    parts: nParts,
    area: totArea,
    mass: (totArea * p.plyT * rho) / 1e9,
  }
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

export { wrapPi }
