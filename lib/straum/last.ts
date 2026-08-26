/**
 * STRAUM — snittet gjennom det som verkeleg er material, og lasta på det.
 *
 * Maskineriet her ÅTTE måltala før: kva høgder kvart skiveplan har eit
 * stykke som vart ståande, dei vassrette stykka i eit snitt, og spenninga
 * i det. No bur det éin stad og tener tre herrar — tavla (verste snittet),
 * volumintegralet (same snitta, integrerte) og lastkartet (utnyttinga per
 * høgd, lagd på nettet). Difor kan ingen av dei tre seie sitt eige tal.
 *
 * Modellen: i finnesona ber berre finnane, og kvar finne er eit rektangel
 * på tvers av rekkja; i sokkel- og kappesona ber heile snittet. Lasta er
 * 1600 N i setesenteret; eksentrisiteten mellom snittet sitt tyngdepunkt
 * og setesenteret gjev momentet. Kartet fargar kvart snitt med SI
 * utnytting — éin verdi per høgd, ikkje per fiber: snittmodellen er
 * global i planet, og eit kart som fann på ei fiberfordeling han ikkje
 * har rekna, ville dikte. Det kartet IKKJE er: elementmetode.
 */
import { MATERIALS, SEAT_LOAD, capacities, type Material } from "../core"
import { crossings, spans, type Body } from "./body"
import type { Build } from "./parts"
import type { Params } from "./params"

const TAU = Math.PI * 2

type Seg = {
  /** vassrett tverrsnitt av stykket, mm² */
  dA: number
  x: number
  y: number
  /** retning og halve lengder for eige andremoment */
  ux: number
  uy: number
  L: number
  w: number
}

export type SnittMaskin = {
  zS0: number
  zS1: number
  cut(z: number): Seg[]
  stress(z: number): { z: number; A: number; sc: number; sm: number; util: number } | null
}

/** snitta og spenninga for eitt objekt — bygd éin gong, spurd mange */
export function snittMaskin(p: Params, bd: Body, B: Build): SnittMaskin {
  const { capC, capM } = capacities(
    (p.material as Material) in MATERIALS ? (p.material as Material) : "bjork",
  )
  const { cosA, e1 } = bd.frame
  const cs = bd.ctr(bd.H)
  const zS0 = 2 * p.sokkelT
  const zS1 = bd.H - 4 * p.kappeT

  /** kva høgder kvart skiveplan har eit stykke som vart ståande */
  const alive = new Map<number, [number, number][]>()
  B.fins.forEach((q) => {
    const cur = alive.get(q.plane)
    if (cur) cur.push([q.zLo, q.zHi])
    else alive.set(q.plane, [[q.zLo, q.zHi]])
  })

  /** dei vassrette stykka i eit snitt, som rektangel */
  const cut = (z: number): Seg[] => {
    const out: Seg[] = []
    const vp = bd.voidPoly(z, 160)
    if (z > zS0 && z < zS1) {
      const poly = bd.sectionPoly(z, 160)
      // finnesona: berre finnane ber, og kvar finne er eit rektangel på
      // tvers av rekkja — tjukna i planet er tjukna delt på cosinus til
      // skråstillinga, av di snittet gjennom ei skrå plate er breiare enn
      // plata
      const w = p.finneT / cosA
      bd.planes.forEach((u, k) => {
        const runs = alive.get(k)
        if (!runs || !runs.some((r) => z >= r[0] - 0.5 && z <= r[1] + 0.5)) return
        const b = bd.bOf(u, z)
        const o = bd.toWorld(u, 0, b)
        let seg = spans(crossings(poly, o[0], o[1], e1[0], e1[1]))
        if (vp) {
          const inn = spans(crossings(vp, o[0], o[1], e1[0], e1[1]))
          if (inn.length) {
            const a = inn[0][0]
            const c = inn[inn.length - 1][1]
            const nx: [number, number][] = []
            for (const s of seg) {
              if (c <= s[0] || a >= s[1]) nx.push(s)
              else {
                if (a > s[0]) nx.push([s[0], a])
                if (c < s[1]) nx.push([c, s[1]])
              }
            }
            seg = nx
          }
        }
        for (const s of seg) {
          const m = (s[0] + s[1]) / 2
          const q = bd.toWorld(u, m, b)
          out.push({
            dA: (s[1] - s[0]) * w,
            x: q[0],
            y: q[1],
            ux: e1[0],
            uy: e1[1],
            L: s[1] - s[0],
            w,
          })
        }
      })
      return out
    }
    // sokkel- og kappesona: heile snittet ber, men over botnen av salen er
    // det berre det som ligg under den freste flata som finst
    const c = bd.ctr(z)
    const NR = 10
    for (let i = 0; i < 180; i++) {
      const th = (i / 180) * TAU
      const dth = TAU / 180
      const ro = bd.ro(th, z)
      const riv = bd.ri(th, z)
      const dr = (ro - riv) / NR
      if (!(dr > 0)) continue
      for (let k = 0; k < NR; k++) {
        const r = riv + (k + 0.5) * dr
        const x = c[0] + r * Math.cos(th)
        const y = c[1] + r * Math.sin(th)
        if (z > bd.seatTop(x, y)) continue
        const dA = r * dr * dth
        out.push({ dA, x, y, ux: 1, uy: 0, L: 0, w: 0 })
      }
    }
    return out
  }

  const stress = (z: number) => {
    const segs = cut(z)
    let A = 0
    let gx = 0
    let gy = 0
    for (const s of segs) {
      A += s.dA
      gx += s.x * s.dA
      gy += s.y * s.dA
    }
    if (!(A > 1)) return null
    gx /= A
    gy /= A
    const ex = cs[0] - gx
    const ey = cs[1] - gy
    const e = Math.hypot(ex, ey)
    let W = 0
    if (e > 1e-6) {
      const ux = ex / e
      const uy = ey / e
      let I = 0
      let c = 0
      for (const s of segs) {
        const d = (s.x - gx) * ux + (s.y - gy) * uy
        // eige andremoment om tyngdepunktet sitt: rektangelet ligg med
        // lengda langs rada og breidda på tvers av henne
        const a1 = (s.ux * ux + s.uy * uy) * s.L
        const a2 = (-s.uy * ux + s.ux * uy) * s.w
        I += s.dA * (d * d + (a1 * a1 + a2 * a2) / 12)
        const far = Math.abs(d) + (Math.abs(a1) + Math.abs(a2)) / 2
        if (far > c) c = far
      }
      W = c > 1e-6 ? I / c : 0
    }
    const sc = SEAT_LOAD / A
    const sm = W > 0 ? (SEAT_LOAD * e) / W : 0
    return { z, A, sc, sm, util: sc / capC + sm / capM }
  }

  return { zS0, zS1, cut, stress }
}

export type LastProfil = {
  /** sampelhøgdene og utnyttinga i kvart snitt, stigande i z */
  z: number[]
  util: number[]
  verste: { z: number; A: number; sc: number; sm: number; util: number }
}

/**
 * Utnyttinga over høgda, og det verste snittet — same sveip som tavla
 * les, med lokal finpuss kring toppen. Maksimumet HER er utnyttinga DER.
 */
export function lastProfil(mask: SnittMaskin, H: number, kappeT: number): LastProfil {
  const zs: number[] = []
  const us: number[] = []
  let worst: ReturnType<SnittMaskin["stress"]> = null
  const NS = 72
  const zTop = H - 4 * kappeT
  for (let i = 0; i <= NS; i++) {
    const z = (i / NS) * zTop
    const q = mask.stress(z)
    zs.push(z)
    us.push(q ? q.util : 0)
    if (q && (!worst || q.util > worst.util)) worst = q
  }
  if (worst) {
    const h = zTop / NS
    for (let i = -6; i <= 6; i++) {
      const q = mask.stress(Math.max(0.5, worst.z + (i * h) / 6))
      if (q && q.util > worst.util) worst = q
    }
  }
  return {
    z: zs,
    util: us,
    verste: worst ?? { z: 0, A: 0, sc: Infinity, sm: 0, util: Infinity },
  }
}

/**
 * Feltet lagt på nettet: kvart hjørne får utnyttinga til snittet i SI
 * høgd, interpolert mellom sampla. Éin verdi per høgd — sjå toppteksten.
 */
export function feltPaMesh(lp: LastProfil, positions: Float32Array): Float32Array {
  const nv = positions.length / 3
  const out = new Float32Array(nv)
  const zs = lp.z
  const us = lp.util
  const n = zs.length
  for (let i = 0; i < nv; i++) {
    const z = positions[i * 3 + 2]
    if (z <= zs[0]) {
      out[i] = us[0]
      continue
    }
    if (z >= zs[n - 1]) {
      out[i] = us[n - 1]
      continue
    }
    let k = 1
    while (k < n - 1 && zs[k] < z) k++
    const t = (z - zs[k - 1]) / Math.max(1e-6, zs[k] - zs[k - 1])
    out[i] = us[k - 1] * (1 - t) + us[k] * t
  }
  return out
}
