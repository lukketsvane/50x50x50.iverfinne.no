/**
 * SKIVE — måltala.
 *
 * Alt er lese av geometrien. Skivene er parallelle rammer: kvar av dei ber
 * for seg, og lasta frå NS-EN 1728 fell berre på dei skivene som faktisk
 * ligg under puta — det er det som gjer lufta mellom skivene til eit
 * styrkeval og ikkje berre eit estetisk eitt.
 */
import {
  CUBE,
  MATERIALS,
  armToHull,
  capacities,
  hull,
  hullArea,
  meshVolume,
  metric,
  nn,
  shoelace,
  type Material,
  type Metric,
  type Metrics,
  type Pt,
} from "../core"
import { nest, usedArea } from "../vaffel/nest"
import { lastVerste } from "./last"
import { buildSlices, profileAt, type Build } from "./profile"
import { lagMesh } from "./mesh"
import { buildParts } from "./parts"
import type { Params } from "./params"

/** kor breitt materialet er i høgda z, som stykke langs x */
export function runsAt(outline: Pt[], z: number): [number, number][] {
  const xs: number[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    if (a[1] === b[1]) continue
    if (z >= Math.min(a[1], b[1]) && z < Math.max(a[1], b[1])) {
      xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
    }
  }
  xs.sort((u, v) => u - v)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > 0.2) out.push([xs[i], xs[i + 1]])
  }
  return out
}

export function measure(p: Params, pre?: Build): Metrics {
  const b = pre ?? buildSlices(p)
  const mat = p.material as Material
  const cap = capacities(mat)
  const mesh = lagMesh(p, b)
  const pl = buildParts(p, b)
  const ns = nest(pl.parts)
  const sArea = usedArea(ns)

  const envX = mesh.max[0] - mesh.min[0]
  const envY = mesh.max[1] - mesh.min[1]
  const envZ = mesh.max[2] - mesh.min[2]

  // --- setet -----------------------------------------------------------------
  // Setekanten er nasen på midtskiva; sitjehøgda er middelet av setetoppen
  // over den midtre flata ein faktisk sit på — gropa OG sidefallet rekna med.
  const mid = profileAt(p, 0, 0.6)
  const seatZ = p.hogd
  // NEGATIV setevipp lyfter bakkanten over setekanten: skiljet som held
  // ryggen ute av målinga må stige med han, elles les skanninga bogen i
  // staden for setet.
  const vippLyft = Math.max(0, -Math.tan((p.setevipp * Math.PI) / 180)) * p.djup
  let ssum = 0
  let sn = 0
  for (let i = 0; i <= 8; i++) {
    const u = (i / 8) * 0.7
    const prof = i % 2 === 0 ? mid : profileAt(p, u, 0.6)
    for (let j = 1; j <= 5; j++) {
      const x = -p.djup / 2 + (j / 6) * p.djup
      // setetoppen: høgste z i materialet ved x — les han av konturen
      let top = 0
      for (let q = 0; q < prof.length; q++) {
        const a = prof[q]
        const c = prof[(q + 1) % prof.length]
        if (x >= Math.min(a[0], c[0]) && x < Math.max(a[0], c[0]) && a[0] !== c[0]) {
          const z = a[1] + ((x - a[0]) / (c[0] - a[0])) * (c[1] - a[1])
          if (z > top && z < p.hogd + vippLyft + 2) top = z
        }
      }
      if (top > 0) { ssum += top; sn++ }
    }
  }
  const sitZ = sn ? ssum / sn : seatZ

  const seatW = b.width
  const seatD = p.djup

  // --- fotavtrykk og velting -------------------------------------------------
  const feet: Pt[] = []
  let contacts = 0
  for (const sl of b.slices) {
    const ca = Math.cos(sl.rot)
    const sa = Math.sin(sl.rot)
    const W2 = (q0: number, off: number): Pt => [
      q0 * ca - (sl.y + off) * sa,
      q0 * sa + (sl.y + off) * ca,
    ]
    const runs = runsAt(sl.outline, 1)
    contacts += runs.length
    for (const [x0, x1] of runs) {
      feet.push(W2(x0, -p.plyT / 2), W2(x1, -p.plyT / 2))
      feet.push(W2(x0, p.plyT / 2), W2(x1, p.plyT / 2))
    }
  }
  const h = hull(feet)
  const footArea = hullArea(h)
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const q of h) {
    fx0 = Math.min(fx0, q[0]); fx1 = Math.max(fx1, q[0])
    fy0 = Math.min(fy0, q[1]); fy1 = Math.max(fy1, q[1])
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }

  const [vol, mz] = meshVolume(mesh)
  const volume = Math.abs(vol)
  const comZ = volume > 0 ? Math.abs(mz) / volume : 0
  const mass = (volume * MATERIALS[mat].rho) / 1e9

  const tipArm = Math.max(0, armToHull(h, 0, 0))
  const tipAngle = (Math.atan2(tipArm, Math.max(1, sitZ)) * 180) / Math.PI

  // --- styrken ---------------------------------------------------------------
  // Lasta fell på skivene under puta, bandet ber i bøying og beina i
  // trykk. Sjølve rekninga bur i last.ts og er NØYAKTIG den lastkartet
  // les — moment og banddjupn i SAME punkt, lese av den verkelege
  // konturen, maksimum over alle berande skiver og alle snitt. Difor kan
  // tavla og kartet ikkje seie kvar sitt: maksimumet i kartet ER dette
  // talet.
  const lv = lastVerste(p, b)
  const sigmaM = lv.sm
  const sigmaC = lv.sc
  const util = lv.util
  const minSecArea = lv.A
  const minSecZ = lv.z

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
    ["contacts", "føter mot golvet", contacts, "stk", nn(contacts, 0)],
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
    ["units", "skiver", b.slices.length, "stk", nn(b.slices.length, 0)],
    ["stavar", "stavar", b.rods.length, "stk", nn(b.rods.length, 0)],
    ["luft", "luft mellom skivene", p.luft, "mm", mm1(p.luft)],
    ["parts", "delar", pl.parts.length + b.rods.length, "stk", nn(pl.parts.length + b.rods.length, 0)],
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
    footX: fx1 - fx0, footY: fy1 - fy0, footArea, contacts, comZ, tipArm, tipAngle,
    minSecArea, minSecZ,
    sigmaC, sigmaM, capC: cap.capC, capM: cap.capM, util,
    volume, mass, massCut: pl.mass,
    parts: pl.parts.length + b.rods.length, plyArea: pl.area,
    sheets: ns.sheets.length, sheetArea: sArea, sheetUtil: ns.util,
    units: b.slices.length, unitLabel: "skiver",
    list,
  }
}
