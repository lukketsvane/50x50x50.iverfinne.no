/**
 * VIKING — måla.
 *
 * Platene er prisme, som i LAFT, so volum, ytre mål og tyngdepunkt er
 * eksakte summar over konturane og ikkje målt på eit nett.
 *
 * To tal er særeigne for typologien, og dei er dei to som avgjer om
 * klinken er ein klink eller eit hjørne:
 *
 *   LAPPEVINKEL   den største vinkelen mellom to nabobord. Han er heile
 *                 krumminga — eit skrog av flate bord er krumt nettopp
 *                 fordi denne er større enn null — men han er òg heile
 *                 prisen, av di han opnar ei GLIPE i lappen.
 *   LAPPEGLIPE    kor brei den glipa vert, ute ved lappekanten. Ei opning
 *                 mellom fem og tjuefem millimeter tek ein finger, og det
 *                 er den eine staden i sandkassen der komforten og talet
 *                 på delar er den same skyvaren.
 */
import {
  CUBE,
  MATERIALS,
  armToHull,
  capacities,
  hull,
  hullArea,
  metric,
  nn,
  shoelace,
  type Metric,
  type Metrics,
  type Pt,
  type Vec3,
} from "../core"
import { tilVerda } from "../plater"
import { nest, usedArea } from "../vaffel/nest"
import { byggDelar, buildParts, delAreal, type Del } from "./parts"
import { lastVerste } from "./last"
import { materialet, type Params } from "./params"

/** senterpunktet til ein ring, med areal — for tyngdepunktet */
function ringSenter(r: Pt[]): { A: number; cx: number; cy: number } {
  let A = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < r.length; i++) {
    const [x0, y0] = r[i]
    const [x1, y1] = r[(i + 1) % r.length]
    const f = x0 * y1 - x1 * y0
    A += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  A /= 2
  if (Math.abs(A) < 1e-9) return { A: 0, cx: 0, cy: 0 }
  return { A, cx: cx / (6 * A), cy: cy / (6 * A) }
}

export function measure(p: Params): Metrics {
  const { sk, delar } = byggDelar(p)
  const pl = buildParts(p)
  const rho = MATERIALS[materialet(p)].rho

  // --- ytre mål, eksakt over alle hjørne i verda ---------------------------
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
  const verda: Vec3[] = []
  for (const d of delar) {
    for (const q of d.outline) {
      for (const w of [0, d.t]) {
        const v = tilVerda(d.plass, q, w)
        verda.push(v)
        if (v[0] < x0) x0 = v[0]
        if (v[0] > x1) x1 = v[0]
        if (v[1] < y0) y0 = v[1]
        if (v[1] > y1) y1 = v[1]
        if (v[2] < z0) z0 = v[2]
        if (v[2] > z1) z1 = v[2]
      }
    }
  }
  const envX = x1 - x0
  const envY = y1 - y0
  const envZ = z1 - z0

  // --- tyngdepunkt og volum ------------------------------------------------
  let volume = 0
  let momZ = 0
  for (const d of delar) {
    const A = delAreal(d)
    const V = A * d.t
    volume += V
    const c = ringSenter(d.outline)
    const mid = tilVerda(d.plass, [c.cx, c.cy], d.t / 2)
    momZ += V * mid[2]
  }
  const comZ = volume > 0 ? momZ / volume : 0
  const mass = (volume * rho) / 1e9

  // --- fotavtrykket: alt som rører golvet ----------------------------------
  const GOLV = z0 + 6
  const fot: Pt[] = []
  for (const v of verda) if (v[2] <= GOLV) fot.push([v[0], v[1]])
  const skrog = fot.length >= 3 ? hull(fot) : fot
  const footArea = skrog.length >= 3 ? hullArea(skrog) : 0
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const [x, y] of fot) {
    if (x < fx0) fx0 = x
    if (x > fx1) fx1 = x
    if (y < fy0) fy0 = y
    if (y > fy1) fy1 = y
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }
  // spanta står på to føter kvar: fire kontaktflater
  const contacts = delar.filter((d) => d.kind === "spant").length * 2

  const tipArm = skrog.length >= 3 ? armToHull(skrog, 0, 0) : 0
  const tipAngle = comZ > 0 ? (Math.atan(tipArm / comZ) * 180) / Math.PI : 90

  // --- sitjeflata ----------------------------------------------------------
  // Ho er ikkje eit bord: ho er dei borda som ligg flatt nok til å sitje
  // på. Eit bord som står meir enn 32° frå vassrett er ein rygg eller ein
  // stamn, og eit tal som talde det med ville lyge om komforten.
  let seteA = 0
  let sx0 = Infinity, sx1 = -Infinity, sy = 0
  for (const d of delar) {
    if (d.kind !== "bord") continue
    const helling = (Math.acos(Math.min(1, Math.abs(d.plass.n[2]))) * 180) / Math.PI
    if (helling > 32) continue
    seteA += delAreal(d)
    for (const q of d.outline) {
      const v = tilVerda(d.plass, q, d.t)
      if (v[0] < sx0) sx0 = v[0]
      if (v[0] > sx1) sx1 = v[0]
      if (Math.abs(v[1]) > sy) sy = Math.abs(v[1])
    }
  }
  const seatD = Number.isFinite(sx0) ? sx1 - sx0 : 0
  const seatW = 2 * sy
  const sitZ = sk.sitZ
  const seatZ = sk.sitZ + p.skaal

  // --- lappen --------------------------------------------------------------
  const lappV = sk.lappVinkel.length ? Math.max(...sk.lappVinkel.map(Math.abs)) : 0
  const lappGlipe = p.lapp * Math.sin((lappV * Math.PI) / 180)

  // --- berekning -----------------------------------------------------------
  const v = lastVerste(p)
  const { capC, capM } = capacities(materialet(p))

  // --- arket ---------------------------------------------------------------
  const ns = nest(pl.parts)
  const sheetArea = usedArea(ns)
  const sheetUtil = sheetArea > 0 ? pl.area / sheetArea : 0

  const mm = (q: number) => nn(q, 0)
  const mm1 = (q: number) => nn(q, 1)
  const cm2 = (q: number) => nn(q / 100, 0) + " cm²"
  const m2 = (q: number) => nn(q / 1e6, 2) + " m²"
  const dm3 = (q: number) => nn(q / 1e6, 2) + " dm³"
  const kg = (q: number) => nn(q, 2)
  const pct = (q: number) => nn(q * 100, 0) + " %"
  const mpa = (q: number) => nn(q, 2)

  const unike = new Set(pl.ids).size

  const raw: [string, string, number, string, (n: number) => string][] = [
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
    ["seteA", "sitjeflate areal", seteA, "mm²", cm2],

    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm],
    ["footArea", "støtteflate", footArea, "mm²", cm2],
    ["contacts", "kontaktflater mot golvet", contacts, "stk", mm],
    ["comZ", "tyngdepunkt", comZ, "mm", mm],
    ["tipArm", "vippearm", tipArm, "mm", mm],
    ["tipAngle", "veltevinkel", tipAngle, "°", mm1],

    ["minSecArea", "styrande snitt", v.A, "mm²", cm2],
    ["minSecZ", "snittet ligg", v.z, "mm", mm],
    ["sigmaC", "trykkspenning", v.sc, "MPa", mpa],
    ["capC", "trykkapasitet", capC, "MPa", mpa],
    ["sigmaM", "bøyespenning", v.sm, "MPa", mpa],
    ["capM", "bøyekapasitet", capM, "MPa", mpa],
    ["util", "utnytting", v.util, "", pct],

    ["units", "bord", sk.knute.length - 1, "stk", mm],
    ["lappV", "lappevinkel", lappV, "°", mm1],
    ["lappGlipe", "glipe i lappen", lappGlipe, "mm", mm1],
    ["bogeLengd", "skroget si bogelengd", sk.bogeLengd, "mm", mm],
    ["parts", "delar", pl.parts.length, "stk", mm],
    ["unike", "ulike delar", unike, "stk", mm],

    ["sheets", "plater", ns.sheets.length, "stk", mm],
    ["sheetArea", "plate medgått", sheetArea, "mm²", m2],
    ["sheetUtil", "plateutnytting", sheetUtil, "", pct],
    ["plyArea", "finérareal", pl.area, "mm²", cm2],
    ["volume", "godsvolum", volume, "mm³", dm3],
    ["mass", "masse ferdig", mass, "kg", kg],
    ["massCut", "masse som emne", pl.mass, "kg", kg],
  ]

  const list: Metric[] = raw.map(([id, label, value, unit, fmt]) =>
    metric(id, label, value, unit, fmt(value)),
  )

  return {
    envX, envY, envZ,
    clearX: CUBE - envX,
    clearY: CUBE - envY,
    clearZ: CUBE - envZ,
    seatZ, sitZ, seatW, seatD,
    footX: fx1 - fx0,
    footY: fy1 - fy0,
    footArea,
    contacts,
    comZ,
    tipArm,
    tipAngle,
    minSecArea: v.A,
    minSecZ: v.z,
    sigmaC: v.sc,
    sigmaM: v.sm,
    capC,
    capM,
    util: v.util,
    volume,
    mass,
    massCut: pl.mass,
    parts: pl.parts.length,
    plyArea: pl.area,
    sheets: ns.sheets.length,
    sheetArea,
    sheetUtil,
    units: sk.knute.length - 1,
    unitLabel: "bord",
    list,
  }
}

export type { Del }
void shoelace
