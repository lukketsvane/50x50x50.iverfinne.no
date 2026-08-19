/**
 * STRAUM — måla.
 *
 * Skilnaden på ein parameter og eit mål er heile poenget med fila: ein
 * parameter seier kva ein bad om, eit mål seier kva ein fekk. Kroppen kan
 * vera krympa inn i kuben, eit skiveplan kan ha gått ut av kroppen og late
 * eit stykke falle bort, og salen et av setekanten — så det ein bad om og
 * det som står der treng ikkje vera same tal.
 *
 * TRE TAL SOM MÅ NAMNGJEVAST I STADEN FOR Å GØYMAST:
 *
 *   `seatZ` er høgda på setekanten, målt som det høgste punktet på
 *   salranda. `sitZ` er der ein faktisk sit: arealvegd middelhøgd over den
 *   inste tredelen av setet. På denne salen ligg dei tretti millimeter frå
 *   kvarandre, og den skilnaden skal stå.
 *
 *   `mass` er den ferdige massen, rekna som arealet av dei vassrette
 *   snitta gjennom det som verkeleg er material — 24 finnar med luft
 *   imellom, ikkje ein massiv kropp — integrert over høgda. `massCut` er
 *   emna: heile plateareal gonga med tjukna. Den freste kroppen som eitt
 *   massivt stykke er eit tredje tal, og det står i lista for seg, av di
 *   det er det talet biletet viser.
 *
 *   `minSecArea` er ikkje det minste snittet. Det er det STYRANDE: areal
 *   og utmiddel dreg kvar sin veg oppover, og utnyttinga vert rekna i
 *   kvart snitt og maksimum teke. Leitte ein etter minste AREAL, ville
 *   svaret vore sett av kvar sveipet sluttar og ikkje av geometrien.
 */
import {
  CUBE,
  MATERIALS,
  SEAT_LOAD,
  armToHull,
  capacities,
  hull,
  hullArea,
  meshVolume,
  metric,
  nn,
  type Material,
  type Metric,
  type Metrics,
  type Pt,
  keep,
} from "../core"
import { crossings, makeBody, spans, type Body } from "./body"
import { buildParts, type Build } from "./parts"
import { buildMesh, DETAIL } from "./surface"
import type { Params } from "./params"

const TAU = Math.PI * 2

/** kor høgt over botnen av salen den brukbare sitjeflata vert lesen, mm */
const SIT_BAND = 0.62

export type Prebuilt = { body?: Body; build?: Build }

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

const MAAL_NETT = keep<ReturnType<typeof buildMesh>>(2)

export function measure(p: Params, pre: Prebuilt = {}): Metrics {
  const bd = pre.body ?? makeBody(p)
  const B = pre.build ?? buildParts(bd)
  const mat: Material = (p.material as Material) in MATERIALS ? (p.material as Material) : "bjork"
  const { capC, capM, rho } = capacities(mat)
  const { cosA, e1 } = bd.frame

  // --- ytre mål -----------------------------------------------------------
  // Midtre detaljnivå: boksen er den same på «lav» som på «hog» til under
  // ein tidels millimeter, men volumet av den massive kroppen er det
  // ikkje — eit grovt nett skriv inn ytterflata og skriv ut hola, og då
  // slår begge feila same vegen.
  // målinga sitt eige nett — vert aldri sendt, og kan difor hugsast
  const mesh = MAAL_NETT(JSON.stringify(p), () => buildMesh(p, DETAIL.mid, bd))
  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]
  const [solidVol] = meshVolume(mesh)

  // --- foten --------------------------------------------------------------
  // Kontaktpunkta er dei hjørna i nettet som ligg i golvplanet. Eit punkt
  // eit par millimeter oppe ber ingen ting, og der veggen svulmar utover
  // frå golvkanten ville det blåse opp støtteflata og gjeve ein
  // veltevinkel som er for snill.
  const floor: Pt[] = []
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i + 2] < 0.01) floor.push([mesh.positions[i], mesh.positions[i + 1]])
  }
  const Hull = hull(floor)
  const footArea = hullArea(Hull)
  let fx0 = Infinity
  let fx1 = -Infinity
  let fy0 = Infinity
  let fy1 = -Infinity
  for (const q of floor) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  const footX = floor.length ? fx1 - fx0 : 0
  const footY = floor.length ? fy1 - fy0 : 0
  // Kor mange skilde flater objektet står på. STRAUM står på ein
  // samanhengande sokkel, så talet er eitt — men det vert talt og ikkje
  // skrive inn, av di eit tomrom som når ned i sokkelen ville dele han.
  let contacts = 0
  const on: boolean[] = []
  for (let i = 0; i < 720; i++) on.push(bd.ri((i / 720) * TAU, 0.5) < bd.ro((i / 720) * TAU, 0.5))
  if (on.every(Boolean)) contacts = 1
  else for (let i = 0; i < 720; i++) if (!on[i] && on[(i + 1) % 720]) contacts++

  // --- setet --------------------------------------------------------------
  const NT = 720
  let seatZ = -Infinity
  const rim: Pt[] = []
  for (let i = 0; i < NT; i++) {
    const th = (i / NT) * TAU
    const q = bd.outer(th, bd.zTop(th))
    if (q[2] > seatZ) seatZ = q[2]
    rim.push([q[0], q[1]])
  }
  // Brukbar sitjeflate: randa trekt inn med setekantradien, av di ein sit
  // ikkje på ei avrunding. Talet er difor mindre enn ytre mål, og det er
  // meininga.
  const cs = bd.ctr(bd.H)
  let sx0 = Infinity
  let sx1 = -Infinity
  let sy0 = Infinity
  let sy1 = -Infinity
  for (const q of rim) {
    const dx = q[0] - cs[0]
    const dy = q[1] - cs[1]
    const r = Math.hypot(dx, dy) || 1
    const s = Math.max(0, r - p.kantR) / r
    const x = cs[0] + dx * s
    const y = cs[1] + dy * s
    if (x < sx0) sx0 = x
    if (x > sx1) sx1 = x
    if (y < sy0) sy0 = y
    if (y > sy1) sy1 = y
  }
  const seatD = sx1 - sx0
  const seatW = sy1 - sy0

  // Der ein faktisk sit: arealvegd middelhøgd over den inste delen av
  // salen. Setekanten er eit anna tal, og på ein sal er skilnaden det
  // meste av salsøkket.
  let wSum = 0
  let zSum = 0
  for (let i = 0; i < 240; i++) {
    const th = (i / 240) * TAU
    const j = Math.round((i / 240) * NT) % NT
    for (let k = 1; k <= 12; k++) {
      const q = ((k - 0.5) / 12) * SIT_BAND
      const x = cs[0] + q * (rim[j][0] - cs[0])
      const y = cs[1] + q * (rim[j][1] - cs[1])
      const dA = q
      wSum += dA
      zSum += dA * bd.seatTop(x, y)
    }
  }
  const sitZ = wSum > 0 ? zSum / wSum : seatZ

  // --- velting ------------------------------------------------------------
  // Lasta kjem inn ved setet og ikkje ved objektet sitt eige tyngdepunkt:
  // ein person på 80 kg gjer dei sju kiloa i krakken til avrunding, og då
  // er det setehøgda som er armen. Talet er difor konservativt og kan
  // samanliknast med dei som står i litteraturen — men det er framleis
  // rekna og ikkje målt, og NS-EN 1022 må prøvast fysisk.
  const tipArm = Hull.length >= 3 ? armToHull(Hull, cs[0], cs[1]) : 0
  const tipAngle = (Math.atan2(tipArm, Math.max(seatZ, 1e-6)) * 180) / Math.PI

  // --- snittet gjennom det som verkeleg er material -----------------------
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

  let worst: ReturnType<typeof stress> = null
  const NS = 72
  for (let i = 0; i <= NS; i++) {
    const q = stress((i / NS) * (bd.H - 4 * p.kappeT))
    if (q && (!worst || q.util > worst.util)) worst = q
  }
  if (worst) {
    const h = (bd.H - 4 * p.kappeT) / NS
    for (let i = -6; i <= 6; i++) {
      const q = stress(Math.max(0.5, worst.z + (i * h) / 6))
      if (q && q.util > worst.util) worst = q
    }
  }
  const minSecArea = worst ? worst.A : 0
  const minSecZ = worst ? worst.z : 0
  const sigmaC = worst ? worst.sc : Infinity
  const sigmaM = worst ? worst.sm : 0
  const util = worst ? worst.util : Infinity

  // --- volum og tyngdepunkt -----------------------------------------------
  // Same snittet, integrert over høgda. Det er den einaste ærlege massen
  // for denne typologien: den freste kroppen er ikkje massiv, han er 24
  // finnar med luft imellom, og lufta veg ingen ting.
  let volume = 0
  let mom = 0
  const band = (z0: number, z1: number, n: number) => {
    if (!(z1 - z0 > 0.5)) return
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / n
      const segs = cut(z)
      let A = 0
      for (const s of segs) A += s.dA
      volume += (A * (z1 - z0)) / n
      mom += (A * z * (z1 - z0)) / n
    }
  }
  band(0, zS0, 8)
  band(zS0, zS1, 120)
  band(zS1, bd.H, 24)
  const comZ = volume > 0 ? mom / volume : 0
  const mass = (volume * rho) / 1e9

  let plyArea = 0
  let massCut = 0
  let legs = 0
  for (const q of B.parts) {
    plyArea += q.area
    massCut += q.mass
  }
  for (const q of B.fins) legs += q.legs

  const mm = (v: number) => nn(v, 0)
  const mm1 = (v: number) => nn(v, 1)
  const cm2 = (v: number) => nn(v / 100, 0) + " cm²"
  const dm3 = (v: number) => nn(v / 1e6, 2) + " dm³"
  const pct = (v: number) => nn(v * 100, 0) + " %"
  const kg = (v: number) => nn(v, 2)
  const mpa = (v: number) => nn(v, 2)

  const raw: [string, string, number, string, (v: number) => string][] = [
    ["envX", "ytre mål X", envX, "mm", mm1],
    ["envY", "ytre mål Y", envY, "mm", mm1],
    ["envZ", "høgd", envZ, "mm", mm1],
    ["clearX", "klaring X", CUBE - envX, "mm", mm1],
    ["clearY", "klaring Y", CUBE - envY, "mm", mm1],
    ["clearZ", "klaring høgd", CUBE - envZ, "mm", mm1],

    ["seatZ", "setekant", seatZ, "mm", mm],
    ["sitZ", "sitjehøgd", sitZ, "mm", mm],
    ["seatW", "sitjeflate tvers", seatW, "mm", mm],
    ["seatD", "sitjeflate djup", seatD, "mm", mm],
    ["saddle", "salsøkk, målt", seatZ - sitZ, "mm", mm1],

    ["footX", "fotavtrykk X", footX, "mm", mm],
    ["footY", "fotavtrykk Y", footY, "mm", mm],
    ["footArea", "støtteflate", footArea, "mm²", cm2],
    ["contacts", "kontaktflater mot golvet", contacts, "stk", mm],
    ["comZ", "tyngdepunkt", comZ, "mm", mm],
    ["tipArm", "vippearm", tipArm, "mm", mm],
    ["tipAngle", "veltevinkel", tipAngle, "°", mm1],

    ["minSecArea", "styrande snitt", minSecArea, "mm²", cm2],
    ["minSecZ", "snittet ligg", minSecZ, "mm", mm],
    ["sigmaC", "trykkspenning", sigmaC, "MPa", mpa],
    ["capC", "trykkapasitet", capC, "MPa", mpa],
    ["sigmaM", "bøyespenning", sigmaM, "MPa", mpa],
    ["capM", "bøyekapasitet", capM, "MPa", mpa],
    ["util", "utnytting", util, "", pct],

    ["units", "finnar", B.fins.length, "stk", mm],
    ["planes", "skiveplan i bruk", B.usedPlanes, "stk", mm],
    ["pitch", "finnedeling", bd.pitch, "mm", mm1],
    ["legs", "bein i midja", legs, "stk", mm],
    ["gap", "luft mellom finnane", bd.pitch * cosA - p.finneT, "mm", mm1],
    ["slot", "sporbreidd i planet", p.finneT / cosA + p.pressfit, "mm", mm1],
    ["parts", "delar", B.parts.length, "stk", mm],
    ["plyArea", "finérareal", plyArea, "mm²", cm2],
    ["volume", "godsvolum", volume, "mm³", dm3],
    ["solid", "kroppen som massiv", solidVol, "mm³", dm3],
    ["mass", "masse ferdig", mass, "kg", kg],
    ["massCut", "masse som emne", massCut, "kg", kg],
  ]

  const list: Metric[] = raw.map(([id, label, value, unit, fmt]) =>
    metric(id, label, value, unit, fmt(value)),
  )

  return {
    envX,
    envY,
    envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ,
    sitZ,
    seatW,
    seatD,
    footX,
    footY,
    footArea,
    contacts,
    comZ,
    tipArm,
    tipAngle,
    minSecArea,
    minSecZ,
    sigmaC,
    sigmaM,
    capC,
    capM,
    util,
    volume,
    mass,
    massCut,
    parts: B.parts.length,
    plyArea,
    units: B.fins.length,
    unitLabel: "finnar",
    list,
  }
}
