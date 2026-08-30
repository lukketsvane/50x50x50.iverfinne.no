/**
 * NESTINGSBENKEN: kor mykje av plata vert til del, over HEILE settet?
 *
 * `scripts/nesting.ts` måler standardobjektet i kvar motor. Eitt objekt
 * er ikkje eit tal ein kan optimere mot: ein pakkar som vinn på éin
 * deleliste kan tape på ti andre, og då har ein flytta talet og ikkje
 * pakkinga. Denne benken pakkar KVAR POSE i kvar motor — 22 delelister i
 * dag — og melder middelet, det verste og tida.
 *
 * To modus vert målte, av di dei har kvar si grense:
 *   levande   det målinga køyrer på kvart skyvarslepp; cella er grov og
 *             sorteringa er éi. Taket er avlen sitt: 80 ms.
 *   tett      det eksporten køyrer; fleire sorteringar, finare celle.
 *             Han skjer éin gong og har råd til å leite.
 *
 * Talet som tel er `snitt`. Eit tillegg som lyfter snittet og ikkje
 * senkar det verste, er ei betring; alt anna er ei omfordeling.
 *
 *   npx tsx scripts/nestbenk.ts
 *   npx tsx scripts/nestbenk.ts vaffel     berre éin motor
 */
import { ENGINES } from "../lib/engines.ts"
import type { EngineDef, Material, ParamBag } from "../lib/core.ts"
import { MATERIALS } from "../lib/core.ts"

import { nest as vaffelNest } from "../lib/vaffel/nest.ts"
import { makeBody as vaffelBody } from "../lib/vaffel/body.ts"
import { buildGrid } from "../lib/vaffel/ribs.ts"
import { buildParts as vaffelParts } from "../lib/vaffel/parts.ts"

import { nest as straumNest } from "../lib/straum/nest.ts"
import { makeBody as straumBody } from "../lib/straum/body.ts"
import { buildParts as straumParts } from "../lib/straum/parts.ts"

import { nest as ribbeNest } from "../lib/ribbe/nest.ts"
import { makeShell } from "../lib/ribbe/shell.ts"
import { buildAll, DETAIL as RIBBE_DETAIL } from "../lib/ribbe/mesh.ts"
import { buildParts as ribbeParts } from "../lib/ribbe/parts.ts"

import type { NestDel, NestVal } from "../lib/nestraster.ts"
import { placedRings } from "../lib/nestraster.ts"
import type { Pt } from "../lib/core.ts"

/**
 * STRAUM melder pakkinga si i ei anna form enn dei to andre — han
 * grupperer etter platetjukn og gjev `{ area, used }`, der `used` er
 * NETTO delareal og `area` er summen av omskrivne boksar. Benken reknar
 * difor utnyttinga hans slik måltavla hans gjer det: netto delareal delt
 * på medgått plateareal, same brøk som `util` er i dei to andre.
 */
type Lagd = { outline: Pt[]; holes: Pt[][] }
type Svar = { util: number; ark: number; lagde: Lagd[][] }
type Rigg = { parts: NestDel[]; nest: (v?: Partial<NestVal>) => Svar }

/** delane og pakkaren som høyrer motoren til */
function rigg(id: string, p: ParamBag): Rigg | null {
  const mat = p.material as Material
  switch (id) {
    case "vaffel": {
      const parts = vaffelParts(buildGrid(vaffelBody(p as never)), mat).parts
      return {
        parts,
        nest: (v) => {
          const n = vaffelNest(parts, v)
          return {
            util: n.util,
            ark: n.sheets.length,
            lagde: n.sheets.map((a) => a.placed.map(placedRings)),
          }
        },
      }
    }
    case "straum": {
      const parts = straumParts(straumBody(p as never)).parts
      return {
        parts,
        nest: (v) => {
          const n = straumNest(parts, v)
          const flate = n.sheets.reduce((q, a) => q + a.used * a.w, 0)
          return {
            util: flate > 0 ? n.used / flate : 0,
            ark: n.sheets.length,
            lagde: n.sheets.map((a) => a.placed.map(placedRings)),
          }
        },
      }
    }
    case "ribbe": {
      const sh = makeShell(p as never)
      const g = buildAll(p as never, RIBBE_DETAIL.lav, sh)
      const parts = ribbeParts(sh, g, MATERIALS[mat].rho).parts
      return {
        parts,
        nest: (v) => {
          const n = ribbeNest(parts, v)
          return {
            util: n.util,
            ark: n.sheets.length,
            lagde: n.sheets.map((a) => a.placed.map(placedRings)),
          }
        },
      }
    }
    default:
      return null
  }
}

const berre = process.argv[2]
/** overstyr rastercella i levande modus, for å måle kva ho kostar */
const SELL = Number(process.env.SELL ?? 0) || 0
const motorar = ENGINES.filter((e) => !berre || e.id === berre)

type Rad = {
  motor: string
  pose: string
  util: number
  ark: number
  ms: number
  lagde: Lagd[][]
}

function kjor(eng: EngineDef, tett: boolean): Rad[] {
  const ut: Rad[] = []
  const punkt: [string, ParamBag][] = [
    ["standard", eng.defaults],
    ...eng.poses.map((q) => [q.namn, eng.clamp({ ...eng.defaults, ...q.bag }, eng.defaults)] as [string, ParamBag]),
  ]
  for (const [namn, p] of punkt) {
    const r = rigg(eng.id, p)
    if (!r) continue
    const t0 = performance.now()
    const ns = r.nest(
      tett ? { tett: true, cell: 4 } : SELL ? { cell: SELL } : undefined,
    )
    const ms = performance.now() - t0
    ut.push({ motor: eng.id, pose: namn, util: ns.util, ark: ns.ark, ms, lagde: ns.lagde })
  }
  return ut
}

const pst = (v: number) => `${(v * 100).toFixed(1)} %`

// =============================================================================
// KOLLISJONSPRØVA
// =============================================================================
/**
 * Pakkaren lovar to ting, og ingen prøve har halde auge med dei:
 *
 *   1. To delar rører aldri kvarandre. Dei skal liggja minst `gap`
 *      millimeter frå kvarandre — det er fresen sin diameter pluss
 *      monn, og delar som ligg nærare vert til éin del med eit tynt
 *      band imellom.
 *   2. Ingen del stikk utanfor plata.
 *
 *   Nummer éin er den farlege. Han er ikkje synleg i utnyttingstalet —
 *   ei pakking som lèt delane gå inn i kvarandre får BETRE tal — so ein
 *   feil her ville lese som ei forbetring heilt til nokon kutta plata.
 *
 * Prøva måler avstanden mellom kvar kant i kvar del og kvar kant i kvar
 * annan del på same arket. Det er kvadratisk i talet på delar, og det er
 * heilt greitt: prøva skjer her og ikkje i nettlesaren.
 */
function segAvstand(a: Pt, b: Pt, c: Pt, d: Pt): number {
  // avstand mellom to linestykke; null om dei kryssar
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const vx = d[0] - c[0]
  const vy = d[1] - c[1]
  const wx = a[0] - c[0]
  const wy = a[1] - c[1]
  const A = ux * ux + uy * uy
  const B = ux * vx + uy * vy
  const C = vx * vx + vy * vy
  const D = ux * wx + uy * wy
  const E = vx * wx + vy * wy
  const nem = A * C - B * B
  let sN: number
  let sD = nem
  let tN: number
  let tD = nem
  if (nem < 1e-12) {
    sN = 0
    sD = 1
    tN = E
    tD = C
  } else {
    sN = B * E - C * D
    tN = A * E - B * D
    if (sN < 0) {
      sN = 0
      tN = E
      tD = C
    } else if (sN > sD) {
      sN = sD
      tN = E + B
      tD = C
    }
  }
  if (tN < 0) {
    tN = 0
    if (-D < 0) sN = 0
    else if (-D > A) sN = sD
    else {
      sN = -D
      sD = A
    }
  } else if (tN > tD) {
    tN = tD
    if (-D + B < 0) sN = 0
    else if (-D + B > A) sN = sD
    else {
      sN = -D + B
      sD = A
    }
  }
  const sc = Math.abs(sD) < 1e-12 ? 0 : sN / sD
  const tc = Math.abs(tD) < 1e-12 ? 0 : tN / tD
  return Math.hypot(wx + sc * ux - tc * vx, wy + sc * uy - tc * vy)
}

/** alle kantane i ein lagd del, ytterkontur og hòl */
function kantar(l: Lagd): [Pt, Pt][] {
  const ut: [Pt, Pt][] = []
  for (const ring of [l.outline, ...l.holes]) {
    for (let i = 0; i < ring.length; i++) ut.push([ring[i], ring[(i + 1) % ring.length]])
  }
  return ut
}

const boks = (l: Lagd) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of l.outline) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1 }
}

/** minste avstand mellom to lagde delar; Infinity om boksane er langt frå
 *  kvarandre (då treng ingen kant målast) */
function delAvstand(a: Lagd, b: Lagd, tak: number): number {
  const ba = boks(a)
  const bb = boks(b)
  const dx = Math.max(0, Math.max(ba.x0 - bb.x1, bb.x0 - ba.x1))
  const dy = Math.max(0, Math.max(ba.y0 - bb.y1, bb.y0 - ba.y1))
  if (Math.hypot(dx, dy) > tak) return Infinity
  let min = Infinity
  const ka = kantar(a)
  const kb = kantar(b)
  for (const [p0, p1] of ka) {
    for (const [q0, q1] of kb) {
      const d = segAvstand(p0, p1, q0, q1)
      if (d < min) {
        min = d
        if (min === 0) return 0
      }
    }
  }
  return min
}

let feil = 0
for (const modus of ["levande", "tett"] as const) {
  console.log(`\n=== ${modus} ===`)
  console.log("motor    punkt              utnytting   ark   tid")
  const alle: Rad[] = []
  for (const eng of motorar) {
    const rader = kjor(eng, modus === "tett")
    alle.push(...rader)
    for (const r of rader) {
      console.log(
        `${r.motor.padEnd(8)} ${r.pose.padEnd(18)} ${pst(r.util).padStart(8)}   ` +
          `${String(r.ark).padStart(2)}   ${r.ms.toFixed(0).padStart(4)} ms`,
      )
    }
  }
  if (!alle.length) continue
  const snitt = alle.reduce((s, r) => s + r.util, 0) / alle.length
  const verst = alle.reduce((a, b) => (a.util <= b.util ? a : b))
  const treg = alle.reduce((a, b) => (a.ms >= b.ms ? a : b))
  const arkSum = alle.reduce((s, r) => s + r.ark, 0)
  console.log(
    `\n  snitt ${pst(snitt)} over ${alle.length} delelister · ` +
      `verst ${verst.motor}/${verst.pose} ${pst(verst.util)} · ` +
      `${arkSum} ark i alt · tregast ${treg.ms.toFixed(0)} ms (${treg.motor}/${treg.pose})`,
  )

  // --- og so det som ikkje er eit tal, men eit løfte -----------------------
  // Luftkravet er 8 mm mot fresen. Rasteret er konservativt og gjev i
  // praksis meir, men aldri mindre; ein halv millimeter monn her er for
  // avrunding i konturane, ikkje for pakkaren.
  const KRAV = 8 - 0.5
  let par = 0
  let verstePar = Infinity
  let brot = 0
  for (const r of alle) {
    for (const ark of r.lagde) {
      for (let i = 0; i < ark.length; i++) {
        for (let j = i + 1; j < ark.length; j++) {
          par++
          const d = delAvstand(ark[i], ark[j], 40)
          if (d < verstePar) verstePar = d
          if (d < KRAV) {
            brot++
            if (brot <= 5) {
              console.log(
                `  \x1b[31mKOLLISJON  ${r.motor}/${r.pose}: del ${i} og ${j} ` +
                  `ligg ${d.toFixed(2)} mm frå kvarandre\x1b[0m`,
              )
            }
          }
        }
      }
    }
  }
  console.log(
    brot
      ? `  \x1b[31m${brot} par av ${par} bryt luftkravet\x1b[0m`
      : `  \x1b[32mluft: ${par} par prøvde, minste avstand ` +
        `${verstePar === Infinity ? "—" : verstePar.toFixed(2) + " mm"} mot kravet 8 mm\x1b[0m`,
  )
  if (brot) feil += brot
}

if (feil) {
  console.log(`\n\x1b[31m${feil} brot\x1b[0m`)
  process.exit(1)
}
