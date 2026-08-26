/**
 * VAFFEL — måltala.
 *
 * Alt her er LESE av geometrien og ikkje henta frå parameterlista. Tre tal
 * er unntak, og dei skal stå med namn i staden for å gøymast: `seatZ` er
 * `hogd`, `plyT` er `ribbT`, og materialet er materialet. Alt anna —
 * fotavtrykk, tyngdepunkt, veltevinkel, det styrande snittet, massen — er
 * målt, og endrar seg om nokon endrar forma utan å endre talet.
 *
 * Det styrande snittet er ikkje det minste. Eit smalt snitt høgt oppe kan
 * ha lita spenning av di lastvegen er rett der; eit breiare snitt nede kan
 * vera verre av di bogen har skuva lasta ut til sida. Difor vert
 * UTNYTTINGA maksimert over høgda, og ikkje arealet minimert.
 */
import {
  CUBE,
  MATERIALS,
  SEAT_LOAD,
  capacities,
  hull,
  hullArea,
  armToHull,
  meshVolume,
  metric,
  nn,
  type Material,
  type Metric,
  type Metrics,
  type Pt,
} from "../core"
import { makeBody } from "./body"
import { buildGrid, type Rib } from "./ribs"
import { lagMesh } from "./mesh"
import { buildParts } from "./parts"
import { nest, usedArea } from "./nest"
import type { Params } from "./params"

/** Der ribba har gods i høgda z, som stykke langs profilen. Krysspunkta
 *  vert henta av polygonet sjølv, så eit spor tel som luft utan at nokon
 *  har fortalt målinga at det finst spor. */
export function runsOnRib(r: Rib, z: number): [number, number][] {
  const xs: number[] = []
  for (const ring of [...r.outlines, ...r.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      if (a[1] === b[1]) continue
      if (z >= Math.min(a[1], b[1]) && z < Math.max(a[1], b[1])) {
        xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
    }
  }
  xs.sort((u, v) => u - v)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > 0.2) out.push([xs[i], xs[i + 1]])
  }
  return out
}

/** verdsposisjonen til eit punkt på profilen */
const world = (r: Rib, t: number): Pt => (r.axis === "x" ? [r.pos, t] : [t, r.pos])

export function measure(p: Params): Metrics {
  const b = makeBody(p)
  const g = buildGrid(b)
  const mat = p.material as Material
  const cap = capacities(mat)
  const mesh = lagMesh(g)
  const pl = buildParts(g, mat)
  const ns = nest(pl.parts)
  const sArea = usedArea(ns)

  // --- ytre mål --------------------------------------------------------------
  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- setet -----------------------------------------------------------------
  const seatZ = b.zTop
  // Sitjehøgda er ikkje setekanten. Ein sit i gropa, og gropa er 26 mm djup;
  // middelet over den flata beina faktisk kviler på er talet NS-EN 1729
  // meiner når han seier 380–480.
  //
  // Flata er GROPA og ikkje ryggen: stig setekanten bak, er den stiginga ein
  // rygg å lene seg mot, ikkje ein stad å sitje, og eit middel som tek henne
  // med melder ei sitjehøgd som ingen sit i. Difor sitSurf og ikkje seatSurf,
  // og difor er skiva sentrert der setet står — planet kan ha sige framover.
  const xSeat = b.sig(1)
  let ssum = 0
  let sn = 0
  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      const x = (i / 6) * 100
      const y = (j / 6) * 100
      if (x * x + y * y > 100 * 100) continue
      ssum += b.sitSurf(xSeat + x, y)
      sn++
    }
  }
  const sitZ = sn ? ssum / sn : seatZ

  // Brukbart sete: der ribbene framleis ber i sitjehøgda.
  let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity
  for (const r of g.ribs) {
    for (const [t0, t1] of runsOnRib(r, sitZ - 12)) {
      for (const t of [t0, t1]) {
        const w = world(r, t)
        sx0 = Math.min(sx0, w[0]); sx1 = Math.max(sx1, w[0])
        sy0 = Math.min(sy0, w[1]); sy1 = Math.max(sy1, w[1])
      }
    }
  }
  if (!Number.isFinite(sx0)) { sx0 = sx1 = sy0 = sy1 = 0 }

  // --- fotavtrykket ----------------------------------------------------------
  // Foten på ei Y-ribbe er hakka opp av spora X-ribbene går ned i, men i
  // det ferdige møbelet står X-ribba i det hakket. Difor tel ikkje hakka
  // som skilde føter: talet skal vera kor mange lause flater objektet
  // faktisk kviler på, og det finn ein ved å sjå kva som heng saman.
  const feet: Pt[] = []
  type Box = { x0: number; x1: number; y0: number; y1: number }
  const boxes: Box[] = []
  const ht = p.ribbT / 2
  for (const r of g.ribs) {
    for (const [t0, t1] of runsOnRib(r, 1.2)) {
      feet.push(world(r, t0), world(r, t1))
      boxes.push(
        r.axis === "x"
          ? { x0: r.pos - ht, x1: r.pos + ht, y0: t0, y1: t1 }
          : { x0: t0, x1: t1, y0: r.pos - ht, y1: r.pos + ht },
      )
    }
  }
  const parent = boxes.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  // Ein millimeter slark. Godset i Y-ribba stoggar ved sporkanten og
  // X-ribba byrjar 0,075 mm seinare — det er pressfiten. Dei to rører
  // kvarandre, og eit reint rektangeltest ville sagt at dei ikkje gjer det.
  const TOL = 1
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const c = boxes[j]
      if (
        a.x0 - TOL <= c.x1 && c.x0 - TOL <= a.x1 &&
        a.y0 - TOL <= c.y1 && c.y0 - TOL <= a.y1
      ) {
        parent[find(i)] = find(j)
      }
    }
  }
  const contacts = new Set(boxes.map((_, i) => find(i))).size
  const h = hull(feet)
  const footArea = hullArea(h)
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const q of h) {
    fx0 = Math.min(fx0, q[0]); fx1 = Math.max(fx1, q[0])
    fy0 = Math.min(fy0, q[1]); fy1 = Math.max(fy1, q[1])
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }

  // --- masse og tyngdepunkt --------------------------------------------------
  const [vol, mz] = meshVolume(mesh)
  const volume = Math.abs(vol)
  const comZ = volume > 0 ? Math.abs(mz) / volume : 0
  const mass = (volume * MATERIALS[mat].rho) / 1e9

  // --- velting ---------------------------------------------------------------
  // Vippearmen vert målt frå der ein sit og ikkje frå tyngdepunktet: det er
  // brukaren si vekt som veltar krakken, ikkje krakken si eiga. Sig planet
  // framover, sit ein framom føtene, og då er armen kortare — det er den
  // rekninga som held lutet i sjakk, ikkje ei grense på skyvaren.
  const tipArm = Math.max(0, armToHull(h, xSeat, 0))
  const tipAngle = (Math.atan2(tipArm, Math.max(1, sitZ)) * 180) / Math.PI

  // --- det styrande snittet --------------------------------------------------
  //
  // Ei vaffelribbe ber ikkje som ei søyle. Ho er ein boge: lasta kjem ned
  // i bandet over kvelvinga, går sidevegs ut til beina og så ned. Difor er
  // det TO kontrollar, og dei har kvar sitt snitt:
  //
  //   bøying   i bandet over kvelvinga, som ein fritt opplagd bjelke med
  //            spennvidd mellom beina og høgd lik godset over bogen —
  //            målt der godset er tynnast, spora medrekna
  //   trykk    i beinet, rett ned
  //
  // Lasta er 1600 N på ei lita pute (NS-EN 1728). Ho fell ikkje på heile
  // rutenettet, men på dei ribbene som ligg under puta: to av kvar familie.
  // Fire ribber deler henne, og kvar familie tek si helvt.
  const NRIB = 2
  const nLoad = SEAT_LOAD / (2 * NRIB)
  let worst = { z: 0, A: 0, sc: 0, sm: 0, util: 0, tot: 0 }

  // det samla vassrette snittet, til trykk og til tabellen
  let totAt = 0
  let totZ = 0
  for (let k = 1; k < 72; k++) {
    const z = (k / 72) * b.zTop
    let tot = 0
    for (const r of g.ribs) {
      for (const [t0, t1] of runsOnRib(r, z)) tot += (t1 - t0) * p.ribbT
    }
    if (tot > 0 && (totAt === 0 || tot < totAt)) { totAt = tot; totZ = z }
  }

  for (const r of g.ribs) {
    const foot = runsOnRib(r, 1.2)
    if (foot.length < 2) continue
    const legL = (foot[0][0] + foot[0][1]) / 2
    const legR = (foot[foot.length - 1][0] + foot[foot.length - 1][1]) / 2
    const span = Math.abs(legR - legL)
    if (span < 1) continue

    // godset over kvelvinga, der det er tynnast
    let depth = Infinity
    let atZ = 0
    for (let i = 1; i < 40; i++) {
      const t = legL + (i / 40) * (legR - legL)
      const w = r.axis === "x" ? world(r, t) : world(r, t)
      const top = b.seatSurf(w[0], w[1])
      const arc = b.arch(w[0], w[1])
      // sporet et av bandet nett der det er tynnast
      let cut = 0
      for (const q of r.slots) {
        if (Math.abs(q.t - t) > q.w / 2) continue
        cut = Math.max(cut, Math.abs(q.zMouth - q.zEnd))
      }
      const d = top - arc - cut
      if (d < depth) { depth = d; atZ = arc }
    }
    if (!Number.isFinite(depth) || depth < 1) continue

    const W = (p.ribbT * depth * depth) / 6
    const M = (nLoad * span) / 4
    const sm = M / W

    // trykket i beinet
    const legW = Math.min(foot[0][1] - foot[0][0], foot[foot.length - 1][1] - foot[foot.length - 1][0])
    const sc = nLoad / 2 / Math.max(1, legW * p.ribbT)

    const util = sc / cap.capC + sm / cap.capM
    if (util > worst.util) {
      worst = { z: atZ, A: depth * p.ribbT, sc, sm, util, tot: totAt }
    }
  }
  worst.tot = totAt
  if (worst.util === 0) worst.z = totZ

  const mm = (v: number) => nn(v, 0) + " mm"
  const mm1 = (v: number) => nn(v, 1) + " mm"
  const cm2 = (v: number) => nn(v / 100, 0) + " cm²"
  const dm3 = (v: number) => nn(v / 1e6, 2) + " dm³"
  const m2 = (v: number) => nn(v / 1e6, 2) + " m²"
  const pct = (v: number) => nn(v * 100, 0) + " %"

  const raw: [string, string, number, string, string][] = [
    ["envX", "ytre mål X", envX, "mm", mm1(envX)],
    ["envY", "ytre mål Y", envY, "mm", mm1(envY)],
    ["envZ", "høgd", envZ, "mm", mm1(envZ)],
    ["clearX", "klaring X", CUBE - envX, "mm", mm1(CUBE - envX)],
    ["clearY", "klaring Y", CUBE - envY, "mm", mm1(CUBE - envY)],
    ["clearZ", "klaring høgd", CUBE - envZ, "mm", mm1(CUBE - envZ)],
    ["seatZ", "setekant", seatZ, "mm", mm(seatZ)],
    ["sitZ", "sitjehøgd", sitZ, "mm", mm(sitZ)],
    ["seatW", "sete på tvers", sy1 - sy0, "mm", mm(sy1 - sy0)],
    ["seatD", "sete framover", sx1 - sx0, "mm", mm(sx1 - sx0)],
    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm(fx1 - fx0)],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm(fy1 - fy0)],
    ["footArea", "støtteflate", footArea, "mm²", cm2(footArea)],
    ["contacts", "føter mot golvet", contacts, "stk", nn(contacts, 0)],
    ["comZ", "tyngdepunkt", comZ, "mm", mm(comZ)],
    ["tipArm", "vippearm", tipArm, "mm", mm(tipArm)],
    ["tipAngle", "veltevinkel", tipAngle, "°", nn(tipAngle, 1) + "°"],
    ["minSecArea", "styrande snitt", worst.tot, "mm²", cm2(worst.tot)],
    ["minSecZ", "snittet ligg", worst.z, "mm", mm(worst.z)],
    ["sigmaC", "trykkspenning", worst.sc, "MPa", nn(worst.sc, 2)],
    ["capC", "trykkapasitet", cap.capC, "MPa", nn(cap.capC, 1)],
    ["sigmaM", "bøyespenning", worst.sm, "MPa", nn(worst.sm, 2)],
    ["capM", "bøyekapasitet", cap.capM, "MPa", nn(cap.capM, 1)],
    ["util", "utnytting", worst.util, "", pct(worst.util)],
    ["units", "ribber", g.ribs.length, "stk", nn(g.ribs.length, 0)],
    ["joints", "ledd", g.joints, "stk", nn(g.joints, 0)],
    ["gap", "opning mellom ribber", Math.min(g.gapX, g.gapY), "mm", mm1(Math.min(g.gapX, g.gapY))],
    ["parts", "delar", pl.parts.length, "stk", nn(pl.parts.length, 0)],
    ["kinds", "unike delar", pl.ids.length, "stk", nn(pl.ids.length, 0)],
    ["sheets", "plater", ns.sheets.length, "stk", nn(ns.sheets.length, 0)],
    ["sheetArea", "plate medgått", sArea, "mm²", m2(sArea)],
    ["sheetUtil", "plateutnytting", ns.util, "", pct(ns.util)],
    ["plyArea", "finérareal", pl.area, "mm²", cm2(pl.area)],
    ["volume", "godsvolum", volume, "mm³", dm3(volume)],
    ["massCut", "masse som kutta", pl.mass, "kg", nn(pl.mass, 2)],
    ["mass", "masse ferdig", mass, "kg", nn(mass, 2)],
  ]
  const list: Metric[] = raw.map((r) => metric(r[0], r[1], r[2], r[3], r[4]))

  return {
    envX, envY, envZ,
    clearX: CUBE - envX, clearY: CUBE - envY, clearZ: CUBE - envZ,
    seatZ, sitZ, seatW: sy1 - sy0, seatD: sx1 - sx0,
    footX: fx1 - fx0, footY: fy1 - fy0, footArea, contacts, comZ, tipArm, tipAngle,
    minSecArea: worst.tot, minSecZ: worst.z,
    sigmaC: worst.sc, sigmaM: worst.sm, capC: cap.capC, capM: cap.capM, util: worst.util,
    volume, mass, massCut: pl.mass,
    parts: pl.parts.length, plyArea: pl.area,
    sheets: ns.sheets.length, sheetArea: sArea, sheetUtil: ns.util,
    units: g.ribs.length, unitLabel: "ribber",
    list,
  }
}
