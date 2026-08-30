/**
 * RIBBE — måla.
 *
 * Skilnaden på ein parameter og eit mål er heile poenget: ein parameter
 * seier kva ein bad om, eit mål seier kva ein fekk. Kuben klemmer planet
 * ned, navet klemmer den indre kanten ut, halvmånen et av setet — så det
 * ein bad om og det som står der treng ikkje vera same tal.
 *
 * Tre tal skal namngjevast i staden for å gøymast:
 *
 *   `seatZ` er høgda på setekanten og er identisk med `p.seatZ`. Berre
 *   planet vert skalert av kubekontrollen; Z er alt gjeve i millimeter.
 *
 *   `sitZ` er der ein FAKTISK sit, og på ei skål er det eit anna tal. Det
 *   vert integrert over den indre delen av skåla og ikkje rekna av
 *   `seatZ − dish`: rimet på kanten dreg snittet opp att.
 *
 *   `minSecZ` er ikkje det minste snittet. Utnyttinga vert rekna i mange
 *   snitt og maksimum teke — leitte ein etter minste AREAL, ville svaret
 *   vore sett av kvar løkkja sluttar og ikkje av geometrien.
 */
import {
  armToHull,
  capacities,
  hull,
  hullArea,
  MATERIALS,
  meshVolume,
  metric,
  nn,
  CUBE,
  type Metric,
  type Metrics,
  type Pt,
} from "../core"
import type { Params } from "./params"
import { makeShell, type Shell } from "./shell"
import { buildAll, DETAIL, lagMesh, type Built } from "./mesh"
import { buildParts } from "./parts"
import { nest, nestArea } from "./nest"
import { lastVerste } from "./last"

/** veven i eit blad ved ei gjeven høgd, interpolert mellom stasjonane */
function webAt(bl: Built["blades"][number], z: number): number {
  const st = bl.st
  for (let i = 0; i + 1 < st.length; i++) {
    if (z >= st[i].u && z <= st[i + 1].u) {
      const d = st[i + 1].u - st[i].u
      const t = d > 1e-9 ? (z - st[i].u) / d : 0
      const w0 = st[i].b - st[i].a
      const w1 = st[i + 1].b - st[i + 1].a
      return Math.max(0, w0 + (w1 - w0) * t)
    }
  }
  return 0
}

export function measure(p: Params, pre?: { sh?: Shell; g?: Built }): Metrics {
  const sh = pre?.sh ?? makeShell(p)
  const g = pre?.g ?? buildAll(p, DETAIL.lav, sh)
  const mat = MATERIALS[p.material]
  const cap = capacities(p.material)

  const mesh = lagMesh(sh, g)
  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- foten -------------------------------------------------------------
  // Objektet står på tjueto flate føter og ikkje på ein ring. Kvar fot er
  // eit rektangel i golvplanet: bladtjukna på tvers, den flate delen av
  // fotbogen langs bladet. Alle fire hjørna vert lagde inn, av di det er
  // dei som avgjer kor breidt hylsteret vert.
  const foot: Pt[] = []
  for (const bl of g.blades) {
    const b = bl.b
    const s0 = bl.st[0]
    const h = p.bladeT / 2
    for (const s of [s0.a, s0.b]) {
      for (const w of [-h, h]) {
        foot.push([b.a[0] + s * b.d[0] + w * b.n[0], b.a[1] + s * b.d[1] + w * b.n[1]])
      }
    }
  }
  const H = hull(foot)
  let fx0 = Infinity
  let fx1 = -Infinity
  let fy0 = Infinity
  let fy1 = -Infinity
  for (const q of foot) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  const footArea = hullArea(H)
  const contacts = g.blades.length

  // --- masse og tyngdepunkt ------------------------------------------------
  // Delane skjer ikkje kvarandre — klaringa i ledda held dei frå
  // kvarandre — så volumet av nettet er unionen og ikkje ein sum med
  // overlapp. Det er skilnaden på ein stabel og eit ledd.
  // `massCut` er plateareal gonga tjukn — det ein kjøper. `mass` er
  // volumet av nettet — det som står att. Skilnaden er skåla som er frest
  // ned i setet, avlastingane i hjørna og mortisane for kilane, og han er
  // eit halvt kilo: det er den einaste massen i objektet som vert til spon
  // etter at delane er skorne ut.
  const [volume, momZ] = meshVolume(mesh)
  const comZ = volume > 0 ? momZ / volume : 0
  const mass = (volume * mat.rho) / 1e9
  const pl = buildParts(sh, g, mat.rho)
  const ns = nest(pl.parts)
  const sArea = nestArea(ns)

  // --- setet ---------------------------------------------------------------
  let sx0 = Infinity
  let sx1 = -Infinity
  let sy0 = Infinity
  let sy1 = -Infinity
  for (const q of g.seat.outline) {
    if (q[0] < sx0) sx0 = q[0]
    if (q[0] > sx1) sx1 = q[0]
    if (q[1] < sy0) sy0 = q[1]
    if (q[1] > sy1) sy1 = q[1]
  }
  // Der ein sit er ikkje der kanten står. Flata vert integrert over den
  // indre to tredjedelen av skåla — lenger ute stør ein seg mot kanten,
  // ein sit ikkje på han.
  let sitSum = 0
  let sitA = 0
  const NR = 24
  for (let i = 0; i < 180; i++) {
    const th = (i / 180) * Math.PI * 2
    const rEdge = Math.min(sh.seatEdge(th), sh.rOuter(th, sh.zBlade)) * 0.66
    for (let k = 0; k < NR; k++) {
      const r = (rEdge * (k + 0.5)) / NR
      const dA = r * (rEdge / NR)
      sitSum += sh.seatSurf(th, r) * dA
      sitA += dA
    }
  }
  const sitZ = sitA > 0 ? sitSum / sitA : sh.zTop

  // --- velting -------------------------------------------------------------
  // Lasta kjem inn ved setet, ikkje ved objektet sitt eige tyngdepunkt:
  // ein person på 80 kg gjer dei ni kiloa i krakken til avrunding. Armen
  // er avstanden frå setesenteret ut til nærmaste kant i hylsteret — ei
  // linje mellom to føter, ikkje ein fot.
  const tipArm = H.length >= 3 ? armToHull(H, 0, 0) : 0
  const tipAngle = (Math.atan2(tipArm, Math.max(sitZ, 1)) * 180) / Math.PI

  // --- det styrande snittet ------------------------------------------------
  // Momentet kjem ikkje frå lasta, men frå at ribba ikkje er rett: midja
  // bular innanfor korda mellom fot og sete, og det er den avstanden som
  // lagar bøyemomentet. Sjølve rekninga bur i last.ts og er NØYAKTIG den
  // lastkartet les — difor kan tavla og kartet ikkje seie kvar sitt:
  // maksimumet i kartet ER dette talet.
  const nRib = g.blades.length
  const lv = lastVerste(sh, g, p)
  const worst = { z: lv.z, A: lv.A, sc: lv.sc, sm: lv.sm, util: lv.util, tot: 0 }
  // Snittarealet er summen over alle blada i den høgda som styrer, og
  // ikkje eitt blad gonga med talet: er planet ovalt, er blada ulike.
  for (const bl of g.blades) worst.tot += webAt(bl, worst.z) * p.bladeT

  // --- satsen --------------------------------------------------------------
  const mm = (v: number) => nn(v, 0)
  const mm1 = (v: number) => nn(v, 1)
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
    ["seatZ", "setekant", sh.zTop, "mm", mm(sh.zTop)],
    ["sitZ", "sitjehøgd", sitZ, "mm", mm(sitZ)],
    ["seatW", "sete på tvers", sy1 - sy0, "mm", mm(sy1 - sy0)],
    ["seatD", "sete framover", sx1 - sx0, "mm", mm(sx1 - sx0)],
    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm(fx1 - fx0)],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm(fy1 - fy0)],
    ["footArea", "støtteflate", footArea, "mm²", cm2(footArea)],
    ["contacts", "føter mot golvet", contacts, "stk", mm(contacts)],
    ["comZ", "tyngdepunkt", comZ, "mm", mm(comZ)],
    ["tipArm", "vippearm", tipArm, "mm", mm(tipArm)],
    ["tipAngle", "veltevinkel", tipAngle, "°", mm1(tipAngle)],
    ["minSecArea", "styrande snitt", worst.tot, "mm²", cm2(worst.tot)],
    ["minSecZ", "snittet ligg", worst.z, "mm", mm(worst.z)],
    ["sigmaC", "trykkspenning", worst.sc, "MPa", nn(worst.sc, 2)],
    ["capC", "trykkapasitet", cap.capC, "MPa", nn(cap.capC, 1)],
    ["sigmaM", "bøyespenning", worst.sm, "MPa", nn(worst.sm, 2)],
    ["capM", "bøyekapasitet", cap.capM, "MPa", nn(cap.capM, 1)],
    ["util", "utnytting", worst.util, "", pct(worst.util)],
    ["units", "blad", nRib, "stk", mm(nRib)],
    ["bands", "band", sh.bandZ.length, "stk", mm(sh.bandZ.length)],
    ["hub", "nav, minste radius", sh.rHub, "mm", mm1(sh.rHub)],
    ["parts", "delar", pl.parts.length, "stk", mm(pl.parts.length)],
    ["kinds", "unike delar", pl.ids.length, "stk", mm(pl.ids.length)],
    ["sheets", "plater", ns.sheets.length, "stk", mm(ns.sheets.length)],
    ["sheetArea", "plate medgått", sArea, "mm²", m2(sArea)],
    ["sheetUtil", "plateutnytting", ns.util, "", pct(ns.util)],
    ["plyArea", "finérareal", pl.area, "mm²", cm2(pl.area)],
    ["volume", "godsvolum", volume, "mm³", dm3(volume)],
    ["massCut", "masse som kutta", pl.mass, "kg", nn(pl.mass, 2)],
    ["mass", "masse ferdig", mass, "kg", nn(mass, 2)],
  ]
  const list: Metric[] = raw.map((r) => metric(r[0], r[1], r[2], r[3], r[4]))

  return {
    envX,
    envY,
    envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ: sh.zTop,
    sitZ,
    seatW: sy1 - sy0,
    seatD: sx1 - sx0,
    footX: fx1 - fx0,
    footY: fy1 - fy0,
    footArea,
    contacts,
    comZ,
    tipArm,
    tipAngle,
    minSecArea: worst.tot,
    minSecZ: worst.z,
    sigmaC: worst.sc,
    sigmaM: worst.sm,
    capC: cap.capC,
    capM: cap.capM,
    util: worst.util,
    volume,
    mass,
    massCut: pl.mass,
    parts: pl.parts.length,
    plyArea: pl.area,
    sheets: ns.sheets.length,
    sheetArea: sArea,
    sheetUtil: ns.util,
    units: nRib,
    unitLabel: "blad",
    list,
  }
}
