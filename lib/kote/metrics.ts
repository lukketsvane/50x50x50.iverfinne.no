/**
 * KOTE — måltala.
 *
 * Alt er lese av geometrien som faktisk vart bygd. Det som skil denne
 * typologien frå dei andre står i to av tala: det STYRANDE TVERRSNITTET
 * ligg ikkje i noko materiale, det ligg i LUFTA — der berre stavane og
 * hylsene står — og sitjehøgda er ikkje setekanten, ho er botnen av
 * skåla midt i setet.
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
} from "../core"
import { nest, usedArea } from "../vaffel/nest"
import { buildStack, type Build } from "./stack"
import { lagMesh } from "./mesh"
import { buildParts } from "./parts"
import type { Params } from "./params"

/** oppløysinga måltala og reglane les på — den same uansett detaljnivå */
export const MEASURE_M = 26

/** skåldjupna ved radien ρ, lese av dei verkelege rillene */
export function dishAt(b: Build, r: number): number {
  const rg = b.skaal.ringar
  if (!rg.length || r >= b.skaal.R) return 0
  for (let j = rg.length - 1; j >= 0; j--) {
    if (r >= rg[j].r0) return b.H - rg[j].z
  }
  return b.H - rg[0].z
}

export function measure(p: Params, pre?: Build): Metrics {
  const b = pre ?? buildStack(p, MEASURE_M)
  const mat = p.material as Material
  const cap = capacities(mat)
  const mesh = lagMesh(p, b, MEASURE_M)
  const pl = buildParts(p, b)
  const ns = nest(pl.parts)
  const sArea = usedArea(ns)

  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- setet ---------------------------------------------------------------
  const seat = b.plates[b.plates.length - 1]
  const seatZ = b.H
  // Sitjehøgda er middelet av setetoppen over den flata rumpa faktisk
  // dekkjer: ein sirkel på halve den innskrivne radien i setet. Skåla er
  // rekna med, rille for rille, so kvar millimeter djupn syner i talet.
  const rSit = Math.max(20, 0.5 * seat.kjerne)
  let ssum = 0
  let sn = 0
  for (let i = 1; i <= 6; i++) {
    const rr = (i / 6) * rSit
    for (let j = 0; j < 12; j++) {
      ssum += seatZ - dishAt(b, rr)
      sn++
    }
  }
  const sitZ = sn ? ssum / sn : seatZ

  let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity
  for (const q of seat.outline) {
    if (q[0] < sx0) sx0 = q[0]
    if (q[0] > sx1) sx1 = q[0]
    if (q[1] < sy0) sy0 = q[1]
    if (q[1] > sy1) sy1 = q[1]
  }
  const seatD = sx1 - sx0
  const seatW = sy1 - sy0

  // --- fotavtrykk og velting -----------------------------------------------
  // Botnplata er éi samanhengande flate mot golvet: støtteflata ER
  // kotelina hennar, og vippearma går frå setesenteret ut til kanten.
  const feet: Pt[] = b.plates[0].outline.map((q) => [q[0], q[1]] as Pt)
  const h = hull(feet)
  const footArea = hullArea(h)
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const q of h) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }

  const [vol, mz] = meshVolume(mesh)
  const volume = Math.abs(vol)
  const comZ = volume > 0 ? Math.abs(mz) / volume : 0
  const mass = (volume * MATERIALS[mat].rho) / 1e9

  const tipArm = Math.max(0, armToHull(h, 0, 0))
  const tipAngle = (Math.atan2(tipArm, Math.max(1, sitZ)) * 180) / Math.PI

  // --- styrken -------------------------------------------------------------
  // Lastvegen: setet ber 1600 N mellom stavane (bøying), stavane og
  // hylsene fører han ned gjennom kvart gap (trykk). Det trongaste
  // vassrette snittet i heile objektet er difor eit GAP — der står berre
  // stavtverrsnitta, og ingenting anna.
  const nsv = b.stavar.length
  const gapSec = (nsv * Math.PI * b.hylseD * b.hylseD) / 4
  let minSecArea = Infinity
  let minSecZ = 0
  for (let i = 0; i + 1 < b.plates.length; i++) {
    const g = b.plates[i + 1].z0 - b.plates[i].z1
    if (g < 0.8) continue
    if (gapSec < minSecArea) {
      minSecArea = gapSec
      minSecZ = b.plates[i].z1 + g / 2
    }
  }
  for (const q of b.plates) {
    if (q.area < minSecArea) {
      minSecArea = q.area
      minSecZ = q.zm
    }
  }
  if (!Number.isFinite(minSecArea) || minSecArea < 1) minSecArea = 1

  const sigmaC = SEAT_LOAD / minSecArea
  // seteplata som fritt opplagt skive mellom stavane: spennet er
  // stavringen sin diameter, og den berande breidda er sett konservativt
  // til radien — det er ikkje heile plata som svarar på ei punktlast.
  const span = Math.max(40, 2 * b.rho)
  const bw = Math.max(30, b.rho)
  const Wm = (bw * p.plyT * p.plyT) / 6
  const sigmaM = (SEAT_LOAD * span) / 8 / Math.max(1, Wm)
  const util = sigmaC / cap.capC + sigmaM / cap.capM

  const hylser = b.gaps.filter((g) => g > 0.8).length * nsv
  const parts = pl.parts.length + nsv * 2 + hylser

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
    ["seatW", "sete på tvers", seatW, "mm", mm(seatW)],
    ["seatD", "sete framover", seatD, "mm", mm(seatD)],
    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm(fx1 - fx0)],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm(fy1 - fy0)],
    ["footArea", "støtteflate", footArea, "mm²", cm2(footArea)],
    ["contacts", "føter mot golvet", 1, "stk", "1"],
    ["comZ", "tyngdepunkt", comZ, "mm", mm(comZ)],
    ["tipArm", "vippearm", tipArm, "mm", mm(tipArm)],
    ["tipAngle", "veltevinkel", tipAngle, "°", nn(tipAngle, 1) + "°"],
    ["minSecArea", "styrande snitt", minSecArea, "mm²", cm2(minSecArea)],
    ["minSecZ", "snittet ligg", minSecZ, "mm", mm(minSecZ)],
    ["sigmaC", "trykkspenning", sigmaC, "MPa", nn(sigmaC, 2)],
    ["capC", "trykkapasitet", cap.capC, "MPa", nn(cap.capC, 1)],
    ["sigmaM", "bøyespenning", sigmaM, "MPa", nn(sigmaM, 2)],
    ["capM", "bøyekapasitet", cap.capM, "MPa", nn(cap.capM, 1)],
    ["util", "utnytting", util, "", pct(util)],
    ["units", "plater", b.plates.length, "stk", nn(b.plates.length, 0)],
    ["luft", "luft mellom platene", b.luft, "mm", mm1(b.luft)],
    ["steg", "steg i flanken", b.steg.flanke, "mm", mm1(b.steg.flanke)],
    ["overheng", "største overheng", b.steg.ut, "mm", mm1(b.steg.ut)],
    [
      "munn",
      "opninga",
      b.munn.h,
      "mm",
      b.munn.h > 1 ? `${mm(b.munn.b)} × ${mm(b.munn.h)} i z ${nn(b.munn.z, 0)}` : "inga",
    ],
    ["stavar", "stavar", nsv, "stk", nn(nsv, 0)],
    ["stavring", "stavringen", b.rho, "mm", mm(b.rho)],
    ["klaring", "gods kring staven", b.klaring, "mm", mm1(b.klaring)],
    ["skaal", "skåla", b.skaal.R, "mm", `${mm(b.skaal.R)} × ${nn(b.skaal.djup, 1)} djup`],
    ["riller", "riller i setet", b.skaal.ringar.length, "stk", nn(b.skaal.ringar.length, 0)],
    ["parts", "delar", parts, "stk", nn(parts, 0)],
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
    seatZ, sitZ, seatW, seatD,
    footX: fx1 - fx0, footY: fy1 - fy0, footArea, contacts: 1, comZ, tipArm, tipAngle,
    minSecArea, minSecZ,
    sigmaC, sigmaM, capC: cap.capC, capM: cap.capM, util,
    volume, mass, massCut: pl.mass,
    parts, plyArea: pl.area,
    sheets: ns.sheets.length, sheetArea: sArea, sheetUtil: ns.util,
    units: b.plates.length, unitLabel: "plater",
    list,
  }
}
