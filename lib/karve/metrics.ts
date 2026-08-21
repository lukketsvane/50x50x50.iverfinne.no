/**
 * KARVE — måltala.
 *
 * Alt er lese av det freste nettet og av skanninga bak det. Tre tal er
 * særeigne for typologien, og dei er dei tre som avgjer om objektet er
 * mogleg og verdt det:
 *
 *   INNESTENGT   gods dei to fresepassa ikkje når inn til, og som difor
 *                står att i det ferdige møbelet som ein klump forma
 *                ikkje bad om.
 *   SVINN        emnet minus objektet. Blokken er limt opp og betalt for;
 *                spona er pengar på golvet.
 *   KOTEAVSTAND  limfugene si tettleik på skinna — det einaste teiknet
 *                laga set att, og heile den visuelle signaturen.
 *
 * Snittet vert målt ETTER fresing. Blokken er sterk; det er halsen og
 * beinet som står att som ber, og dei er begge resultat av kva som er
 * teke vekk.
 */
import {
  CUBE,
  MATERIALS,
  capacities,
  hullArea,
  keep,
  meshVolume,
  metric,
  nn,
  wrapPi,
  type Material,
  type Metric,
  type Metrics,
} from "../core"
import { nest } from "../vaffel/nest"
import { DETAIL, karv, plater, snitt, type Karv, type Snitt } from "./form"
import { flateMesh, koteMaal } from "./mesh"
import { buildParts } from "./parts"
import type { Params } from "./params"

const DEG = Math.PI / 180

export type { Snitt }

// =============================================================================
// SAMLEPUNKTET
// =============================================================================
/**
 * Måling og reglar spør om nøyaktig dei same tala for nøyaktig same punkt,
 * og kvart av dei kostar ei skanning. Difor vert dei rekna éin gong og
 * lagde her. Ingen buffer frå eit nett vert med — eit hugsa nett som er
 * sendt gjennom postMessage er eit usynleg objekt.
 */
export type Bunt = {
  k: Karv
  bl: ReturnType<typeof plater>
  pl: ReturnType<typeof buildParts>
  sheets: number
  sn: Snitt
  kote: ReturnType<typeof koteMaal>
  emneV: number
  boksV: number
  envX: number
  envY: number
  envZ: number
  volume: number
  comZ: number
}

const BUNT_HUGS = keep<Bunt>(3)

export function bunt(p: Params): Bunt {
  return BUNT_HUGS(JSON.stringify(p), () => {
    const k = karv(p, DETAIL.mid)
    const mesh = flateMesh(k)
    const [vol, mz] = meshVolume(mesh)
    const volume = Math.abs(vol)
    const bl = plater(k, p)
    const pl = buildParts(k, p)
    let emneV = 0
    let bx = 0
    let by = 0
    for (const q of bl) {
      emneV += q.area * (q.z1 - q.z0)
      for (const v of q.outline) {
        bx = Math.max(bx, Math.abs(v[0]))
        by = Math.max(by, Math.abs(v[1]))
      }
    }
    return {
      k,
      bl,
      pl,
      sheets: nest(pl.parts).sheets.length,
      sn: snitt(k),
      kote: koteMaal(k, p.plyT),
      emneV,
      boksV: 4 * bx * by * k.f.H,
      envX: mesh.max[0] - mesh.min[0],
      envY: mesh.max[1] - mesh.min[1],
      envZ: mesh.max[2] - mesh.min[2],
      volume,
      comZ: volume > 0 ? Math.abs(mz) / volume : 0,
    }
  })
}

export function measure(p: Params): Metrics {
  const b = bunt(p)
  const k = b.k
  const f = k.f
  const mat = p.material as Material
  const cap = capacities(mat)
  const pl = b.pl
  const bl = b.bl

  const envX = b.envX
  const envY = b.envY
  const envZ = b.envZ
  const volume = b.volume
  const comZ = b.comZ
  const mass = (volume * MATERIALS[mat].rho) / 1e9

  // --- setet ----------------------------------------------------------------
  // Setekanten er middelet av rosetten sin kant; sitjehøgda er det arealet
  // ein faktisk sit på — ei skive på 300 mm midt i setet, vekta med areal,
  // so salen og kjølen tel med slik dei verkeleg dreg ned.
  let kantSum = 0
  for (let i = 0; i < k.nth; i++) kantSum += f.zEdge(k.th[i])
  const seatZ = kantSum / k.nth

  const m = k.nrad + 1
  let sitA = 0
  let sitS = 0
  let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity
  const setegolv = f.zw + (f.H - f.zw) * 0.5
  for (let i = 0; i < k.nth; i++) {
    const c = Math.cos(k.th[i])
    const s = Math.sin(k.th[i])
    for (let j = 0; j <= k.nrad; j++) {
      const q = i * m + j
      if (k.zO[q] < setegolv) continue
      const x = k.rho[q] * c
      const y = k.rho[q] * s
      if (x < sx0) sx0 = x
      if (x > sx1) sx1 = x
      if (y < sy0) sy0 = y
      if (y > sy1) sy1 = y
      if (k.rho[q] <= 150) {
        sitA += k.cell[q]
        sitS += k.cell[q] * k.zO[q]
      }
    }
  }
  const sitZ = sitA > 0 ? sitS / sitA : seatZ
  const seatD = Number.isFinite(sx0) ? sx1 - sx0 : 0
  const seatW = Number.isFinite(sy0) ? sy1 - sy0 : 0

  // --- fotavtrykk og velting ------------------------------------------------
  const footArea = k.hylster.length >= 3 ? hullArea(k.hylster) : 0
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity
  for (const q of k.hylster) {
    if (q[0] < fx0) fx0 = q[0]
    if (q[0] > fx1) fx1 = q[0]
    if (q[1] < fy0) fy0 = q[1]
    if (q[1] > fy1) fy1 = q[1]
  }
  if (!Number.isFinite(fx0)) { fx0 = fx1 = fy0 = fy1 = 0 }
  const tipArm = k.vippArm
  const tipAngle = (Math.atan2(tipArm, Math.max(1, sitZ)) * 180) / Math.PI

  const sn = b.sn
  const util = sn.sigC / cap.capC + sn.sigM / cap.capM

  const svinn = b.emneV > 0 ? 1 - volume / b.emneV : 0
  const boksSvinn = b.boksV > 0 ? 1 - volume / b.boksV : 0
  const massCut = (b.emneV * MATERIALS[mat].rho) / 1e9
  const kote = b.kote

  const mm = (v: number) => nn(v, 0) + " mm"
  const mm1 = (v: number) => nn(v, 1) + " mm"
  const cm2 = (v: number) => nn(v / 100, 0) + " cm²"
  const dm3 = (v: number) => nn(v / 1e6, 2) + " dm³"
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
    ["sal", "salhøgd", f.p.sal, "mm", mm(f.p.sal)],
    ["kjol", "kjøl etter fres", f.kryssEff, "mm", mm1(f.kryssEff)],
    ["footX", "fotavtrykk X", fx1 - fx0, "mm", mm(fx1 - fx0)],
    ["footY", "fotavtrykk Y", fy1 - fy0, "mm", mm(fy1 - fy0)],
    ["footArea", "støtteflate", footArea, "mm²", cm2(footArea)],
    ["contacts", "føter mot golvet", k.kontaktar, "stk", nn(k.kontaktar, 0)],
    ["comZ", "tyngdepunkt", comZ, "mm", mm(comZ)],
    ["tipArm", "vippearm", tipArm, "mm", mm(tipArm)],
    ["tipAngle", "veltevinkel", tipAngle, "°", nn(tipAngle, 1) + "°"],
    ["stengd", "innestengt gods", k.stengd, "mm³", dm3(k.stengd)],
    ["stengdDel", "innestengt del", k.stengdDel, "", pct(k.stengdDel)],
    ["kote", "koteavstand", kote.snitt, "mm", mm1(kote.snitt)],
    ["kotemed", "median koteavstand", kote.median, "mm", mm1(kote.median)],
    ["kotelengd", "samla kotelengd", kote.lengd, "mm", nn(kote.lengd / 1000, 1) + " m"],
    ["naken", "naken skinn", kote.naken, "", pct(kote.naken)],
    ["skinn", "skinnareal", kote.areal, "mm²", cm2(kote.areal)],
    ["minSecArea", "styrande snitt", sn.minA, "mm²", cm2(sn.minA)],
    ["minSecZ", "snittet ligg", sn.minZ, "mm", mm(sn.minZ)],
    ["beinA", "smalaste beinsnitt", sn.beinA, "mm²", cm2(sn.beinA)],
    ["fuge", "beinakse mot limfuge", sn.fugeVinkel, "°", nn(sn.fugeVinkel, 0) + "°"],
    ["sigmaC", "trykkspenning", sn.sigC, "MPa", nn(sn.sigC, 2)],
    ["capC", "trykkapasitet", cap.capC, "MPa", nn(cap.capC, 1)],
    ["sigmaM", "bøyespenning", sn.sigM, "MPa", nn(sn.sigM, 2)],
    ["capM", "bøyekapasitet", cap.capM, "MPa", nn(cap.capM, 1)],
    ["util", "utnytting", util, "", pct(util)],
    ["units", "lag", bl.length, "stk", nn(bl.length, 0)],
    ["plyT", "platetjukn", p.plyT, "mm", mm1(p.plyT)],
    ["kinds", "unike plater", pl.ids.length, "stk", nn(pl.ids.length, 0)],
    ["sheets", "plater", b.sheets, "stk", nn(b.sheets, 0)],
    ["plyArea", "finérareal", pl.area, "mm²", cm2(pl.area)],
    ["emne", "emnevolum", b.emneV, "mm³", dm3(b.emneV)],
    ["volume", "godsvolum", volume, "mm³", dm3(volume)],
    ["svinn", "svinn frå emnet", svinn, "", pct(svinn)],
    ["boks", "svinn frå kassa", boksSvinn, "", pct(boksSvinn)],
    ["massCut", "masse som limt", massCut, "kg", nn(massCut, 2)],
    ["mass", "masse ferdig", mass, "kg", nn(mass, 2)],
  ]
  const list: Metric[] = raw.map((r) => metric(r[0], r[1], r[2], r[3], r[4]))

  return {
    envX, envY, envZ,
    clearX: CUBE - envX, clearY: CUBE - envY, clearZ: CUBE - envZ,
    seatZ, sitZ, seatW, seatD,
    footX: fx1 - fx0, footY: fy1 - fy0, footArea, contacts: k.kontaktar,
    comZ, tipArm, tipAngle,
    minSecArea: sn.minA, minSecZ: sn.minZ,
    sigmaC: sn.sigC, sigmaM: sn.sigM, capC: cap.capC, capM: cap.capM, util,
    volume, mass, massCut,
    parts: pl.parts.length, plyArea: pl.area,
    units: bl.length, unitLabel: "lag",
    list,
  }
}

/** tala reglane treng utover Metrics — same skanning, ingen ny bygging */
export function ekstra(p: Params) {
  const b = bunt(p)
  return {
    k: b.k,
    lag: b.bl.length,
    emneV: b.emneV,
    svinn: b.emneV > 0 ? 1 - b.k.vol / b.emneV : 0,
    kote: b.kote,
    sn: b.sn,
    sheets: b.sheets,
    /** kor mykje av kjølen freseradien åt opp */
    kjolTap: p.kryss - b.k.f.kryssEff,
    /** kor mange grader beinaksen står frå limfuga */
    fugeVinkel: b.sn.fugeVinkel,
    /** vinkelavstand frå næraste bein til næraste lobe, grader */
    vriAvvik: vriAvvik(p),
  }
}

/** kor langt beinet står frå kjervet det burde stå i */
function vriAvvik(p: Params): number {
  const k = Math.max(2, Math.round(p.lobar))
  const kb = Math.max(2, Math.round(p.bein))
  const phi = p.vri * DEG
  let verst = 0
  for (let m2 = 0; m2 < kb; m2++) {
    const bein = phi + Math.PI / kb + (m2 * Math.PI * 2) / kb
    // kjerva ligg i θ = 0 og kvar 2π/k derifrå
    const n = Math.round((bein * k) / (Math.PI * 2))
    const kjerv = (n * Math.PI * 2) / k
    const d = Math.abs(wrapPi(bein - kjerv)) * (180 / Math.PI)
    if (d > verst) verst = d
  }
  return verst
}
